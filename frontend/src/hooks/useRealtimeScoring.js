import { useEffect, useRef, useCallback, useState } from 'react';
export function useRealtimeScoring(onResultReceived, authToken) {
  const wsRef = useRef(null);
  const resultsRef = useRef([]);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  const normalizeWebsocketUrl = (rawUrl) => {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    let url = rawUrl.trim();
    if (/^https?:\/\//i.test(url)) {
      return url.replace(/^http/i, 'ws');
    }
    if (!/^wss?:\/\//i.test(url)) {
      url = url.replace(/\/+$/, '');
      return `ws://${url}`;
    }
    return url;
  };

  const buildWebsocketUrl = (baseUrl, token) => {
    if (!token) return baseUrl;
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
  };

  const getWebsocketEndpoints = () => {
    const envUrl = normalizeWebsocketUrl(process.env.REACT_APP_WEBSOCKET_URL || '');
    const token = authToken || localStorage.getItem('token');
    // Ensure token doesn't have Bearer prefix
    const cleanToken = token ? token.replace(/^Bearer\s+/i, '') : '';
    const primaryUrl = buildWebsocketUrl('ws://127.0.0.1:8000/ws/upload', cleanToken);
    const fallbackUrl = null;
    return Array.from(new Set([primaryUrl, fallbackUrl].filter(Boolean)));
  };

  const connect = useCallback(async (resumes, jds, template = '') => {
    return new Promise((resolve, reject) => {
      let ws = null;
      let opened = false;
      let rejected = false;
      const urls = getWebsocketEndpoints();
      let currentIndex = 0;

      const tryConnect = (urlIndex, sessionId = null) => {
        if (urlIndex >= urls.length) {
          const errorMsg = 'WebSocket connection failed for all endpoints. Fallback to REST upload will be used.';
          console.warn('[RealtimeScoring] ', errorMsg);
          setError(null);
          setIsConnected(false);
          rejected = true;
          reject(new Error('WebSocket unavailable'));
          return;
        }

        let wsUrl = urls[urlIndex];
        if (sessionId) {
          const baseUrl = normalizeWebsocketUrl(process.env.REACT_APP_WEBSOCKET_URL || 'ws://127.0.0.1:8000');
          const token = authToken || localStorage.getItem('token');
          const cleanToken = token ? token.replace(/^Bearer\s+/i, '') : '';
          wsUrl = buildWebsocketUrl(`${baseUrl}/ws/session/${sessionId}`, cleanToken);
        }

        console.log(`[RealtimeScoring] Trying WebSocket URL: ${wsUrl}`);
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          opened = true;
          setIsConnected(true);
          setError(null);
          setResults([]);
          console.log('[RealtimeScoring] WebSocket connected');
          
          if (!sessionId) {
            console.log("SENDING DATA:", resumes, jds);
            // Send upload data ONLY after connection opens for legacy method
            ws.send(JSON.stringify({
              resumes: resumes.map((r) => ({
                  name: r.name || 'Unknown Resume',
                  content_base64: r.content_base64 || undefined,
                  text: r.text && r.text.length > 20 ? r.text : `Sample resume content for ${r.name}`,
              })),
              jds: jds.map((j) => ({
                  name: j.name || 'Unknown JD',
                  content_base64: j.content_base64 || undefined,
                  text: j.text && j.text.length > 20 ? j.text : `Sample JD content for ${j.name}`,
              })),
              template: template || "Sample template"
            }));
            console.log('[RealtimeScoring] Sent initial payload to backend');
          }
        };

        ws.onmessage = (event) => {
          console.log('[RealtimeScoring] WebSocket message received:', event.data);
          try {
            const message = JSON.parse(event.data);

            if (message.event === 'started') {
              // Progress starts at 0% for all files
              setProgress({
                event: 'started',
                total_files: message.total_files,
                completed_files: 0,
                current_resume: '',
                current_jd: '',
                progress_percent: 0
              });
            } else if (message.event === 'completed') {
              // Track progress - only add result if provided (backend may not send it during progress)
              if (message.result) {
                const newResult = {
                  ...message.result,
                  id: Math.random(),
                  score: message.result?.score ?? message.result?.final_score,
                };
                setResults((prev) => {
                  const next = [...prev, newResult];
                  resultsRef.current = next;
                  return next;
                });
                if (onResultReceived) {
                  onResultReceived(newResult);
                }
              }
              
              setProgress({
                event: 'completed',
                total_files: message.total_files,
                completed_files: message.completed_files,
                current_resume: message.current_resume,
                current_jd: message.current_jd,
                progress_percent: Math.round(40 + ((message.progress_percent || 0) * 0.55))
              });
            } else if (message.event === 'error') {
              if (message.error && message.error.toLowerCase().includes('authentication')) {
                window.dispatchEvent(new Event('auth-failure'));
              }
              setError(message.error || 'Unknown error occurred');
              const total = message.total_files || 1;
              const loaded = message.completed_files || 0;
              setProgress({
                event: 'error',
                total_files: message.total_files,
                completed_files: message.completed_files,
                current_resume: message.current_resume,
                current_jd: message.current_jd,
                error: message.error,
                progress_percent: message.total_files > 0 ? Math.round(40 + (((loaded / total) * 100) * 0.55)) : 40
              });
            } else if (message.event === 'all_completed') {
              // All results are ready and saved to DB - NOW show 100%
              console.log('[RealtimeScoring] ALL COMPLETED - Results ready from DB:', message.results);
              const finalResults = Array.isArray(message.results)
                ? message.results.map((result) => ({
                    ...result,
                    score: result?.score ?? result?.final_score,
                  }))
                : resultsRef.current;
              setResults(finalResults);
              resultsRef.current = finalResults;
              setProgress({
                event: 'all_completed',
                total_files: message.total_files,
                completed_files: message.completed_files,
                current_resume: '',
                current_jd: '',
                progress_percent: 100.0,
                total_results: message.total_results,
              });
              resolve({
                results: finalResults,
                total: message.total_results || finalResults.length
              });
            } else {
              // Intermediate custom stages (e.g., 'Processing Resume', 'AI Analysis')
              setProgress({
                event: message.event,
                total_files: message.total_files,
                completed_files: message.completed_files,
                current_resume: message.current_resume,
                current_jd: message.current_jd,
                progress_percent: Math.round(40 + ((message.progress_percent || 0) * 0.55))
              });
            }
          } catch (parseError) {
            console.error('[RealtimeScoring] Failed to parse WebSocket message:', parseError);
          }
        };

        ws.onerror = (event) => {
          console.log('[RealtimeScoring] WebSocket error:', event);
          setError(null);
          setIsConnected(false);
          if (!opened) {
            wsRef.current = null;
            tryConnect(urlIndex + 1);
          }
        };

        ws.onclose = (event) => {
          setIsConnected(false);
          if (!opened && !rejected) {
            wsRef.current = null;
            tryConnect(urlIndex + 1);
            return;
          }
          if (!opened && urlIndex >= urls.length - 1) {
            if (!rejected) {
              rejected = true;
              setError(null);
              reject(new Error('WebSocket unavailable'));
            }
          }
        };
      };

      tryConnect(currentIndex);
    });
  }, [onResultReceived]);

  const connectRealtimeSession = useCallback(async (sessionId) => {
    return new Promise((resolve, reject) => {
      let ws = null;
      let opened = false;
      let rejected = false;

      const baseUrl = normalizeWebsocketUrl(process.env.REACT_APP_WEBSOCKET_URL || 'ws://127.0.0.1:8000');
      const token = authToken || localStorage.getItem('token');
      const cleanToken = token ? token.replace(/^Bearer\s+/i, '') : '';
      const wsUrl = buildWebsocketUrl(`${baseUrl}/ws/session/${sessionId}`, cleanToken);

      console.log(`[RealtimeScoring] Trying WebSocket Session URL: ${wsUrl}`);
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        opened = true;
        setIsConnected(true);
        setError(null);
        setResults([]);
        console.log('[RealtimeScoring] Session WebSocket connected');
      };

      ws.onmessage = (event) => {
        console.log('[RealtimeScoring] Session message received:', event.data);
        try {
          const message = JSON.parse(event.data);
          
          if (message.event === 'started') {
            setProgress({
              event: 'started',
              total_files: message.total_files,
              completed_files: 0,
              current_resume: '',
              current_jd: '',
              progress_percent: 0
            });
          } else if (message.event === 'error') {
            if (message.error && message.error.toLowerCase().includes('authentication')) {
              window.dispatchEvent(new Event('auth-failure'));
            }
            setError(message.error || message.message || 'Unknown error occurred');
            const total = message.total_files || 1;
            const loaded = message.completed_files || 0;
            setProgress({
              event: 'error',
              total_files: message.total_files,
              completed_files: message.completed_files,
              current_resume: message.current_resume,
              current_jd: message.current_jd,
              error: message.error || message.message,
              progress_percent: message.total_files > 0 ? Math.round(40 + (((loaded / total) * 100) * 0.55)) : 40
            });
          } else if (message.event === 'all_completed') {
            console.log('[RealtimeScoring] ALL COMPLETED - Results ready from DB:', message.results);
            const finalResults = Array.isArray(message.results)
              ? message.results.map((result) => ({
                  ...result,
                  score: result?.score ?? result?.final_score,
                }))
              : resultsRef.current;
            setResults(finalResults);
            resultsRef.current = finalResults;
            setProgress({
              event: 'all_completed',
              total_files: message.total_files,
              completed_files: message.completed_files,
              current_resume: '',
              current_jd: '',
              progress_percent: 100.0,
              total_results: message.total_results,
            });
            resolve({
              results: finalResults,
              total: message.total_results || finalResults.length
            });
          } else {
            setProgress({
              event: message.event,
              total_files: message.total_files,
              completed_files: message.completed_files,
              current_resume: message.current_resume,
              current_jd: message.current_jd,
              progress_percent: Math.round(40 + ((message.progress_percent || 0) * 0.55))
            });
          }
        } catch (parseError) {
          console.error('[RealtimeScoring] Failed to parse WebSocket message:', parseError);
        }
      };

      ws.onerror = (event) => {
        console.log('[RealtimeScoring] WebSocket Session error:', event);
        setError(null);
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        if (!opened && !rejected) {
          wsRef.current = null;
          rejected = true;
          reject(new Error('WebSocket unavailable'));
        }
      };
    });
  }, [authToken]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    connectRealtimeSession,
    disconnect,
    progress,
    results,
    isConnected,
    error
  };
}
