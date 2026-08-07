import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { WS_DASHBOARD_PATH } from "../lib/constants";

export type WSMessage = {
  type: string;
  [key: string]: unknown;
};

type MessageListener = (data: WSMessage) => void;

type WebSocketContextValue = {
  connected: boolean;
  lastMessage: WSMessage | null;
  subscribe: (type: string, callback: MessageListener) => () => void;
};

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

const RECONNECT_MS = 3_000;

/**
 * Shared dashboard WebSocket (auto-reconnect + typed pub/sub).
 * Mount once under AppLayout so Header and pages share one connection.
 */
export function WebSocketProvider({ children }: { children: ReactNode }) {
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

  const value = useMemo(
    () => ({ connected, lastMessage, subscribe }),
    [connected, lastMessage, subscribe],
  );

  return createElement(WebSocketContext.Provider, { value }, children);
}

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return ctx;
}
