import { describe, expect, it } from "vitest";
import type { AuthUser, NotificationItem } from "../data/mockData";
import { formatCount } from "./format";
import { saveOrigin, savedOrigin } from "./geo";
import { dashboardPath, notificationLink, safeNext } from "./links";
import { slotRange, slotsOverlap } from "./slots";

const user = (role: AuthUser["role"]): AuthUser => ({ id: 1, name: "U", role, email: "u@x.test", avatar: "" });
const note = (extra: Partial<NotificationItem> = {}): NotificationItem =>
  ({ id: "1", type: "booking", title: "t", body: "b", time: "now", read: false, ...extra });

describe("dashboardPath", () => {
  it("routes each role to its own dashboard", () => {
    expect(dashboardPath(null)).toBe("/auth");
    expect(dashboardPath(user("customer"))).toBe("/customer-dashboard");
    expect(dashboardPath(user("provider"))).toBe("/provider-dashboard");
    expect(dashboardPath(user("admin"))).toBe("/admin-dashboard");
  });
});

describe("notificationLink", () => {
  it("prefers the conversation, then the booking card on the right dashboard", () => {
    expect(notificationLink(note({ conversationId: "7", bookingId: "3" }), user("customer"))).toBe("/messages?c=7");
    expect(notificationLink(note({ bookingId: "3" }), user("provider"))).toBe("/provider-dashboard#booking-3");
    expect(notificationLink(note({ bookingId: "3" }), user("customer"))).toBe("/customer-dashboard#booking-3");
  });
  it("falls back sensibly", () => {
    expect(notificationLink(note({ type: "system" }), user("provider"))).toBe("/provider-dashboard");
    expect(notificationLink(note(), user("customer"))).toBe("/notifications");
  });
});

describe("safeNext", () => {
  it("only allows same-origin paths", () => {
    expect(safeNext("/book/4?service=2")).toBe("/book/4?service=2");
    expect(safeNext(null)).toBeNull();
    expect(safeNext("https://evil.test")).toBeNull();
    expect(safeNext("//evil.test")).toBeNull();
    expect(safeNext("/\\evil.test")).toBeNull();
  });
});

describe("formatCount", () => {
  it("abbreviates large numbers", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1500)).toMatch(/^1\.5k$/i);
    expect(formatCount(2_000_000)).toMatch(/^2M$/i);
  });
});

describe("slots", () => {
  it("parses ranges into minutes", () => {
    expect(slotRange("10:00 - 12:30")).toEqual([600, 750]);
    expect(slotRange("noon")).toBeNull();
  });
  it("treats touching slots as free and partial overlaps as clashes", () => {
    expect(slotsOverlap("09:00 - 11:00", "10:00 - 12:00")).toBe(true);
    expect(slotsOverlap("09:00 - 11:00", "08:00 - 10:00")).toBe(true);
    expect(slotsOverlap("10:00 - 12:00", "12:00 - 14:00")).toBe(false);
    expect(slotsOverlap("bad", "10:00 - 12:00")).toBe(false);
  });
});

describe("saved origin", () => {
  it("round-trips through sessionStorage and ignores junk", () => {
    expect(savedOrigin()).toBeNull();
    saveOrigin({ lat: 30.27, lng: -97.74 });
    expect(savedOrigin()).toEqual({ lat: 30.27, lng: -97.74 });
    sessionStorage.setItem("fixmate_origin", "{bad json");
    expect(savedOrigin()).toBeNull();
    saveOrigin(null);
    expect(sessionStorage.getItem("fixmate_origin")).toBeNull();
  });
});
