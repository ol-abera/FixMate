/**
 * Live updates over one WebSocket per tab. The server pushes notifications in full; messages and booking
 * changes arrive as small signals and the app re-fetches through the REST API. If the socket can't connect,
 * the app keeps working on polling and this keeps retrying with backoff.
 */
import { API_URL, refreshAccess, tokens } from "./api";

export type RealtimeEvent =
  | { type: "notification"; notification: Record<string, unknown> }
  | { type: "message"; conversation_id: number; message_id: number; sender_id: number }
  | { type: "booking"; booking_id: number; status: string };

export const UNAUTHORIZED = 4001;
const PING_MS = 25_000;
const MAX_BACKOFF_MS = 30_000;

/** ws(s)://host/ws/ derived from VITE_WS_URL, or from the API URL (same host, /api replaced by /ws). */
export function wsUrl(apiUrl = API_URL, explicit = import.meta.env.VITE_WS_URL as string | undefined, here: Location = window.location): string {
  if (explicit) return explicit;
  const api = new URL(apiUrl, here.href);
  api.protocol = api.protocol === "https:" ? "wss:" : "ws:";
  api.pathname = api.pathname.replace(/\/api\/?$/, "") + "/ws/";
  api.search = "";
  return api.toString();
}

interface Options {
  onEvent: (e: RealtimeEvent) => void;
  onStatus?: (live: boolean) => void;
  url?: string;
  socketFactory?: (url: string) => WebSocket;
}

export function connectRealtime({ onEvent, onStatus, url = wsUrl(), socketFactory = (u) => new WebSocket(u) }: Options): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let attempt = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;

  const schedule = () => {
    if (stopped) return;
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt) * (0.75 + Math.random() * 0.5);
    attempt += 1;
    retry = setTimeout(open, delay);
  };

  function open() {
    if (stopped || !tokens.access) return;
    const sock = socketFactory(url);
    ws = sock;
    sock.onopen = () => sock.send(JSON.stringify({ type: "auth", token: tokens.access }));
    sock.onmessage = (m) => {
      let data: { type?: string };
      try { data = JSON.parse(String(m.data)); } catch { return; }
      if (data.type === "ready") {
        attempt = 0;
        onStatus?.(true);
        clearInterval(ping);
        ping = setInterval(() => sock.readyState === WebSocket.OPEN && sock.send(JSON.stringify({ type: "ping" })), PING_MS);
      } else if (data.type && data.type !== "pong") {
        onEvent(data as RealtimeEvent);
      }
    };
    sock.onclose = async (e) => {
      clearInterval(ping);
      onStatus?.(false);
      if (stopped || ws !== sock) return;
      if (e.code === UNAUTHORIZED) {
        // Access token expired or was rejected: refresh once, then reconnect straight away.
        if (await refreshAccess()) { attempt = 0; open(); return; }
        if (!tokens.access) return;
      }
      schedule();
    };
  }

  open();
  return () => {
    stopped = true;
    clearTimeout(retry);
    clearInterval(ping);
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close(1000);
    ws = null;
  };
}
