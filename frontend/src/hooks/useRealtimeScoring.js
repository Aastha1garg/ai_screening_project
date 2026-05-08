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
    const primaryUrl = buildWebsocketUrl('ws://127.0.0.1:8000/ws/upload', token);
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

      const tryConnect = (urlIndex) => {
        if (urlIndex >= urls.length) {
          const errorMsg = 'WebSocket connection failed for all endpoints. Fallback to REST upload will be used.';
          console.warn('[RealtimeScoring] ', errorMsg);
          setError(null);
          setIsConnected(false);
          rejected = true;
          reject(new Error('WebSocket unavailable'));
          return;
        }

        const wsUrl = urls[urlIndex];
        console.log(`[RealtimeScoring] Trying WebSocket URL: ${wsUrl}`);
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          opened = true;
          setIsConnected(true);
          setError(null);
          setResults([]);
          console.log('[RealtimeScoring] WebSocket connected');
          console.log("SENDING DATA:", resumes, jds);
          // Send upload data ONLY after connection opens
          ws.send(JSON.stringify({
            resumes: resumes.map((r) => ({
                name: r.name || 'Unknown Resume',
                text: r.text && r.text.length > 20 
                ? r.text 
                : `Sample resume content for ${r.name}`
            })),
            jds: jds.map((j) => ({
                name: j.name || 'Unknown JD',
                text: j.text && j.text.length > 20 
                ? j.text 
                : `Sample JD content for ${j.name}`
            })),
            template: template || "Sample template"
            }));
          console.log('[RealtimeScoring] Sent initial payload to backend');
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
              // Progress increases as files are completed
              // Calculate as: (message.completed_files / message.total_files) * 100, but cap at 99%
              // We only show 100% when all_completed event arrives
              const progressPercent = Math.min(99, (message.completed_files / message.total_files) * 100);
              setProgress({
                event: 'completed',
                total_files: message.total_files,
                completed_files: message.completed_files,
                current_resume: message.current_resume,
                current_jd: message.current_jd,
                progress_percent: progressPercent
              });
            } else if (message.event === 'error') {
              setError(message.error || 'Unknown error occurred');
              setProgress({
                event: 'error',
                total_files: message.total_files,
                completed_files: message.completed_files,
                current_resume: message.current_resume,
                current_jd: message.current_jd,
                error: message.error,
                progress_percent: (message.completed_files / message.total_files) * 100
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
    disconnect,
    progress,
    results,
    isConnected,
    error
  };
}
