import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectRealtime, wsUrl } from "./realtime";
import { tokens } from "./api";

class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  constructor(public url: string) { FakeSocket.instances.push(this); }
  send(d: string) { this.sent.push(d); }
  close() { this.readyState = 3; }
  open() { this.readyState = 1; this.onopen?.(); }
  emit(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }); }
  drop(code: number) { this.readyState = 3; this.onclose?.({ code }); }
}

const factory = (u: string) => new FakeSocket(u) as unknown as WebSocket;
const last = () => FakeSocket.instances[FakeSocket.instances.length - 1];

describe("wsUrl", () => {
  const here = { href: "https://app.fixmate.test/explore" } as Location;
  it("derives the socket URL from the API URL", () => {
    expect(wsUrl("http://localhost:8000/api", undefined, here)).toBe("ws://localhost:8000/ws/");
    expect(wsUrl("/api", undefined, here)).toBe("wss://app.fixmate.test/ws/");
    expect(wsUrl("/api", "wss://rt.example/ws/", here)).toBe("wss://rt.example/ws/");
  });
});

describe("connectRealtime", () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", { OPEN: 1 });
    tokens.set("acc-1", "ref-1");
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); tokens.clear(); });

  it("authenticates with the first message, then forwards events", () => {
    const onEvent = vi.fn();
    const onStatus = vi.fn();
    const stop = connectRealtime({ onEvent, onStatus, url: "ws://x/ws/", socketFactory: factory });
    last().open();
    expect(JSON.parse(last().sent[0])).toEqual({ type: "auth", token: "acc-1" });
    last().emit({ type: "ready" });
    expect(onStatus).toHaveBeenLastCalledWith(true);
    last().emit({ type: "booking", booking_id: 3, status: "ACCEPTED" });
    last().emit({ type: "pong" });
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({ type: "booking", booking_id: 3, status: "ACCEPTED" });
    vi.advanceTimersByTime(25_000);
    expect(JSON.parse(last().sent[1])).toEqual({ type: "ping" });
    stop();
  });

  it("reconnects with backoff after a drop and stops cleanly", () => {
    const onStatus = vi.fn();
    const stop = connectRealtime({ onEvent: vi.fn(), onStatus, url: "ws://x/ws/", socketFactory: factory });
    last().open();
    last().drop(1006);
    expect(onStatus).toHaveBeenLastCalledWith(false);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1500);
    expect(FakeSocket.instances).toHaveLength(2);
    stop();
    last().drop(1000);
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("refreshes the access token when the server closes with 4001", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access: "acc-2", refresh: "ref-2" }) });
    vi.stubGlobal("fetch", fetchMock);
    const stop = connectRealtime({ onEvent: vi.fn(), url: "ws://x/ws/", socketFactory: factory });
    last().open();
    last().drop(4001);
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/auth/token/refresh/"), expect.anything());
    last().open();
    expect(JSON.parse(last().sent[0])).toEqual({ type: "auth", token: "acc-2" });
    stop();
  });
});
