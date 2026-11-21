import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, errorMessage, request, toBooking, toNotification, toProvider, tokens } from "./api";

const json = (status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const apiProvider = (extra: Record<string, unknown> = {}) => ({
  id: 4, name: "Alex Rivera", title: "Plumber", hourly_rate: "60.00", starting_price: "90.00", rating: "4.9",
  total_reviews: 3, instant_book: true, categories: ["plumbing"], ...extra,
});

describe("toProvider", () => {
  it("builds a single hourly pricing card when the pro has no active services", () => {
    const p = toProvider(apiProvider({ services: [{ id: 1, title: "Hidden", starting_price: "50", duration_minutes: 60, is_active: false }] }));
    expect(p.tiers).toHaveLength(1);
    expect(p.tiers[0]).toMatchObject({ name: "Hourly", price: 60, unit: "/hr" });
    expect(p.tiers[0].features).toContain("Minimum job $90");
    expect(p.tiers[0].features).toContain("Instant booking");
  });

  it("uses real services as pricing cards, keeping their ids for booking", () => {
    const p = toProvider(apiProvider({
      services: [{ id: 9, title: "Leak repair", starting_price: "120.00", duration_minutes: 90, category: "plumbing", category_name: "Plumbing", is_active: true }],
    }));
    expect(p.tiers).toEqual([expect.objectContaining({ name: "Leak repair", price: 120, serviceId: "9" })]);
    expect(p.tiers[0].features).toContain("Plumbing");
    expect(p.hourlyRate).toBe(60);
    expect(p.minJobPrice).toBe(90);
  });
});

describe("toBooking", () => {
  it("maps status, prices, notes and photos", () => {
    const b = toBooking({
      id: 12, provider: 4, status: "IN_PROGRESS", estimated_price: "100.00", final_price: null, title: "Leak",
      contact_phone: "555", contact_email: "a@b.test", notes: "Gate 44", events: [],
      photos: [{ id: 3, image: "http://x/media/booking_photos/a.png" }], service: 9, review: null,
    });
    expect(b).toMatchObject({ id: "12", providerId: "4", status: "in_progress", estimate: 100, finalPrice: null, notes: "Gate 44", serviceId: "9" });
    expect(b.contact).toBe("555 · a@b.test");
    expect(b.photos).toEqual([{ id: "3", url: "http://x/media/booking_photos/a.png" }]);
  });

  it("shows the final price once set", () => {
    expect(toBooking({ id: 1, status: "COMPLETED", estimated_price: "100", final_price: "145.50" }).estimate).toBe(145.5);
  });
});

describe("toNotification", () => {
  it("keeps the ids needed for deep links", () => {
    const n = toNotification({ id: 5, notification_type: "NEW_MESSAGE", title: "t", message: "m", created_at: new Date().toISOString(), is_read: false, data: { conversation_id: 8 } });
    expect(n).toMatchObject({ type: "message", conversationId: "8", bookingId: undefined });
  });
});

describe("errorMessage", () => {
  it("shows the first field error, without the field name for general errors", () => {
    expect(errorMessage(new ApiError(400, "Validation failed.", { time_slot: ["Already booked."] }))).toBe("time slot: Already booked.");
    expect(errorMessage(new ApiError(400, "Validation failed.", { detail: "Link expired." }))).toBe("Link expired.");
    expect(errorMessage(new ApiError(400, "Validation failed.", { non_field_errors: ["Nope."] }))).toBe("Nope.");
    expect(errorMessage(new ApiError(403, "Forbidden"))).toBe("Forbidden");
    expect(errorMessage("weird", "Fallback")).toBe("Fallback");
  });
});

describe("request", () => {
  // the client shares one in-flight refresh and clears it on the next tick
  afterEach(async () => { vi.unstubAllGlobals(); await new Promise((r) => setTimeout(r, 0)); });

  it("refreshes an expired access token once and retries", async () => {
    tokens.set("old-access", "refresh-1");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(401, { detail: "expired" }))
      .mockResolvedValueOnce(json(200, { access: "new-access", refresh: "refresh-2" }))
      .mockResolvedValueOnce(json(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(request("/bookings/")).resolves.toEqual({ ok: true });
    expect(String(fetchMock.mock.calls[1][0])).toBe("http://api.test/api/auth/token/refresh/");
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer new-access");
    expect(tokens.refresh).toBe("refresh-2");
  });

  it("signs out locally when the refresh token is rejected", async () => {
    tokens.set("old-access", "revoked");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(json(401, { detail: "expired" }))
      .mockResolvedValueOnce(json(401, { detail: "blacklisted" }))
    );
    const onLogout = vi.fn();
    window.addEventListener("fixmate:logout", onLogout);
    await expect(request("/bookings/")).rejects.toMatchObject({ status: 401 });
    expect(onLogout).toHaveBeenCalledOnce();
    expect(tokens.access).toBeNull();
    window.removeEventListener("fixmate:logout", onLogout);
  });

  it("reports an unreachable backend clearly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(request("/providers/")).rejects.toMatchObject({ status: 0, message: expect.stringContaining("Cannot reach") });
  });

  it("logout clears tokens and blacklists the refresh token on the server", async () => {
    tokens.set("a", "r-123");
    const fetchMock = vi.fn().mockResolvedValue(json(204, null));
    vi.stubGlobal("fetch", fetchMock);
    await api.logout();
    expect(tokens.refresh).toBeNull();
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://api.test/api/auth/logout/");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refresh: "r-123" });
  });
});
