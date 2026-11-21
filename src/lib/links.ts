import type { AuthUser, NotificationItem } from "../data/mockData";

export function dashboardPath(user: AuthUser | null): string {
  if (!user) return "/auth";
  if (user.role === "provider") return "/provider-dashboard";
  if (user.role === "admin") return "/admin-dashboard";
  return "/customer-dashboard";
}

/** Where clicking a notification should take the user. */
export function notificationLink(n: NotificationItem, user: AuthUser | null): string {
  if (n.conversationId) return `/messages?c=${n.conversationId}`;
  if (n.bookingId) return `${dashboardPath(user)}#booking-${n.bookingId}`;
  if (n.type === "system" && user?.role === "provider") return "/provider-dashboard";
  return "/notifications";
}

/** Only same-origin app paths are allowed as post-login redirects. */
export function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
}
