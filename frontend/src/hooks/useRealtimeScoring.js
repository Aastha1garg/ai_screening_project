import { useEffect, useRef, useCallback, useState } from 'react';
export function useRealtimeScoring(onResultReceived) {
  const wsRef = useRef(null);
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

  const getWebsocketEndpoints = () => {
    const envUrl = normalizeWebsocketUrl(process.env.REACT_APP_WEBSOCKET_URL || '');
    const primaryUrl = 'ws://127.0.0.1:8000/ws/upload';
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
              setProgress({
                event: 'started',
                total_pairs: message.total_pairs,
                current_pair: 0,
                current_resume: '',
                current_jd: '',
                progress_percent: 0
              });
            } else if (message.event === 'processing') {
              setProgress({
                event: 'processing',
                total_pairs: message.total_pairs,
                current_pair: message.current_pair,
                current_resume: message.current_resume,
                current_jd: message.current_jd,
                progress_percent: message.progress_percent
              });
            } else if (message.event === 'completed') {
              const newResult = {
                ...message.result,
                id: Math.random()
              };
              setResults((prev) => [...prev, newResult]);
              if (onResultReceived) {
                onResultReceived(newResult);
              }
              setProgress({
                event: 'completed',
                total_pairs: message.total_pairs,
                current_pair: message.current_pair,
                current_resume: message.current_resume,
                current_jd: message.current_jd,
                progress_percent: message.progress_percent
              });
            } else if (message.event === 'error') {
              setError(message.error || 'Unknown error occurred');
              setProgress({
                event: 'error',
                total_pairs: message.total_pairs,
                current_pair: message.current_pair,
                current_resume: message.current_resume,
                current_jd: message.current_jd,
                error: message.error
              });
            } else if (message.event === 'all_completed') {
              setProgress({
                event: 'all_completed',
                total_results: message.total_results
              });
              resolve({
                results: message.results || results,
                total: message.total_results
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
