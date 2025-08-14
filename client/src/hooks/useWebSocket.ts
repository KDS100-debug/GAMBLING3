import { useEffect, useRef, useCallback } from 'react';

interface UseWebSocketOptions {
  onMessage?: (data: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const ws = useRef<WebSocket | null>(null);
  const { onMessage, onOpen, onClose, onError } = options;

  const sendMessage = useCallback((data: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        ws.current = new WebSocket(url);

        ws.current.onopen = () => {
          console.log('WebSocket connected');
          onOpen?.();
        };

        ws.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            onMessage?.(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.current.onclose = (event) => {
          console.log('WebSocket disconnected');
          onClose?.();
          
          // Only attempt to reconnect if it wasn't a manual close
          if (event.code !== 1000) {
            reconnectTimeout = setTimeout(() => {
              console.log('Attempting to reconnect WebSocket...');
              connect();
            }, 3000);
          }
        };

        ws.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          onError?.(error);
        };
      } catch (error) {
        console.error('Error creating WebSocket:', error);
      }
    };

    connect();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.close(1000, 'Component unmounted');
      }
    };
  }, [url, onMessage, onOpen, onClose, onError]);

  return { sendMessage };
}