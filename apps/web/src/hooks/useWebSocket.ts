import { useCallback, useEffect, useRef, useState } from "react";

import { WS_DASHBOARD_PATH } from "../lib/constants";

export type WSMessage = {
  type: string;
  [key: string]: unknown;
};

type MessageListener = (data: WSMessage) => void;

const RECONNECT_MS = 3_000;

/**
 * Dashboard WebSocket with auto-reconnect and typed pub/sub.
 * Connects via Vite proxy in dev (`/ws` → backend).
 */
export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);
  const listenersRef = useRef(new Map<string, Set<MessageListener>>());
  const intentionalCloseRef = useRef(false);

  const connect = useCallback(() => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    intentionalCloseRef.current = false;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}${WS_DASHBOARD_PATH}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      let data: WSMessage;
      try {
        data = JSON.parse(event.data) as WSMessage;
      } catch {
        return;
      }
      setLastMessage(data);
      const listeners = listenersRef.current.get(data.type);
      if (listeners) {
        listeners.forEach((fn) => fn(data));
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      if (!intentionalCloseRef.current) {
        reconnectTimeoutRef.current = window.setTimeout(
          connect,
          RECONNECT_MS,
        );
      }
    };

    wsRef.current = ws;
  }, []);

  const subscribe = useCallback(
    (type: string, callback: MessageListener) => {
      if (!listenersRef.current.has(type)) {
        listenersRef.current.set(type, new Set());
      }
      listenersRef.current.get(type)!.add(callback);
      return () => {
        listenersRef.current.get(type)?.delete(callback);
      };
    },
    [],
  );

  useEffect(() => {
    connect();
    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimeoutRef.current !== undefined) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return { connected, lastMessage, subscribe };
}
