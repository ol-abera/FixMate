/**
 * FixMate API client + mappers from the Django REST API (snake_case, UPPERCASE enums)
 * to the existing frontend domain types (camelCase, lowercase).
 */
import type {
  AuthUser, BookingRequest, BookingStatus, Conversation, Message, NotificationItem,
  PricingTier, Provider, Review,
} from "../data/mockData";

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000/api";

/* ------------------------------- token store ------------------------------- */
// NOTE: localStorage tokens are readable by any XSS. Acceptable for this MVP; for production
// consider httpOnly cookies for the refresh token.
const ACCESS = "fixmate_access";
const REFRESH = "fixmate_refresh";
export const tokens = {
  get access() { return localStorage.getItem(ACCESS); },
  get refresh() { return localStorage.getItem(REFRESH); },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  },
  clear() { localStorage.removeItem(ACCESS); localStorage.removeItem(REFRESH); },
};

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[] | string>;
  constructor(status: number, detail: string, errors?: Record<string, string[] | string>) {
    super(detail);
    this.status = status;
    this.errors = errors;
  }
}

/** Human readable message from any thrown value. */
export function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  if (e instanceof ApiError) {
    if (e.errors) {
      const [field, msgs] = Object.entries(e.errors)[0] ?? [];
      if (field) {
        const m = Array.isArray(msgs) ? msgs[0] : msgs;
        return field === "non_field_errors" || field === "detail" ? String(m) : `${field.replace(/_/g, " ")}: ${m}`;
      }
    }
    return e.message || fallback;
  }
  return e instanceof Error ? e.message : fallback;
}

/* --------------------------------- request --------------------------------- */
type Query = Record<string, string | number | boolean | undefined | null>;
interface ReqOpts { method?: string; body?: unknown; query?: Query; form?: FormData; auth?: boolean }

let refreshing: Promise<boolean> | null = null;
async function refreshAccess(): Promise<boolean> {
  const refresh = tokens.refresh;
  if (!refresh) return false;
  refreshing ??= (async () => {
    try {
      const r = await fetch(`${API_URL}/auth/token/refresh/`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh }),
      });
      if (!r.ok) return false;
      const d = await r.json();
      tokens.set(d.access, d.refresh);
      return true;
    } catch { return false; } finally { setTimeout(() => { refreshing = null; }, 0); }
  })();
  return refreshing;
}

export async function request<T = unknown>(path: string, opts: ReqOpts = {}, retried = false): Promise<T> {
  const url = new URL(`${API_URL}${path}`);
  Object.entries(opts.query ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v)); });
  const headers: Record<string, string> = {};
  if (opts.auth !== false && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(opts.body); }

  let res: Response;
  try {
    res = await fetch(url, { method: opts.method ?? "GET", headers, body });
  } catch {
    throw new ApiError(0, "Cannot reach the FixMate server. Is the backend running?");
  }
  if (res.status === 401 && !retried && opts.auth !== false && tokens.refresh) {
    if (await refreshAccess()) return request<T>(path, opts, true);
    tokens.clear();
    window.dispatchEvent(new Event("fixmate:logout"));
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.detail ?? res.statusText, data?.errors);
  return data as T;
}

/* --------------------------------- helpers --------------------------------- */
const avatarFor = (name: string) => `https://ui-avatars.com/api/?background=059669&color=fff&size=160&name=${encodeURIComponent(name || "?")}`;

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}
const clock = (iso: string) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
};
const stamp = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function buildTiers(rate: number): PricingTier[] {
  return [
    { name: "Essential", price: rate, unit: "/hr", features: ["Diagnostic visit", "Labor included", "Same-day quote"] },
    { name: "Standard", price: Math.round(rate * 3.2), unit: "/job", features: ["Full service", "Parts up to $50", "7-day warranty"] },
    { name: "Premium", price: Math.round(rate * 6), unit: "/job", features: ["Priority scheduling", "Premium parts", "12-month warranty"] },
  ];
}

/* --------------------------------- mappers --------------------------------- */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function toProvider(p: any): Provider {
  const rate = Number(p.hourly_rate);
  const reviews: Review[] = (p.reviews ?? []).map((r: any) => ({
    id: String(r.id), author: r.author, avatar: r.avatar || avatarFor(r.author), rating: r.rating,
    date: timeAgo(r.created_at), text: r.comment,
  }));
  return {
    id: String(p.id), userId: p.user_id, name: p.name, title: p.title,
    avatar: p.avatar || avatarFor(p.name),
    cover: p.cover || `https://picsum.photos/seed/fixmate-${p.id}/1200/400`,
    categoryIds: p.categories ?? [], city: p.city || "",
    distanceKm: 0, // backend has no geolocation yet; UI hides the distance when 0
    rating: Number(p.rating), reviewCount: p.total_reviews, hourlyRate: rate, minJobPrice: Number(p.starting_price),
    verified: p.verified, instantBook: p.instant_book, availableNow: p.available_now,
    yearsExperience: p.years_of_experience, jobsCompleted: p.jobs_completed, responseTimeMins: p.response_time_mins,
    bio: p.bio || `${p.name} is a trusted local ${String(p.title).toLowerCase()}.`,
    skills: p.skills ?? [], gallery: p.gallery ?? [], tiers: buildTiers(rate), reviews,
  };
}

export function toBooking(b: any): BookingRequest {
  return {
    id: String(b.id), providerId: String(b.provider), providerName: b.provider_name, customerName: b.customer_name,
    categoryId: b.category_slug ?? "", serviceName: b.title, description: b.description,
    date: b.scheduled_date, timeSlot: b.time_slot, address: b.location,
    contact: [b.contact_phone, b.contact_email].filter(Boolean).join(" · "),
    status: String(b.status).toLowerCase() as BookingStatus,
    estimate: Number(b.final_price ?? b.estimated_price), finalPrice: b.final_price == null ? null : Number(b.final_price),
    createdAt: b.created_at,
    timeline: (b.events ?? []).map((e: any) => ({ status: String(e.status).toLowerCase() as BookingStatus, label: e.label, time: stamp(e.created_at) })),
    canReview: b.can_review, hasReview: b.has_review,
  };
}

export function toMessage(m: any): Message {
  return { id: String(m.id), sender: m.is_mine ? "me" : "them", text: m.text, time: clock(m.created_at), attachment: m.attachment ?? undefined };
}

export function toConversation(c: any): Conversation {
  const o = c.other ?? {};
  const last = c.last_message;
  return {
    id: String(c.id), providerId: o.provider_id ? String(o.provider_id) : "", providerName: o.name ?? "Unknown",
    avatar: o.avatar || avatarFor(o.name), online: !!o.available_now,
    lastMessage: last ? `${last.is_mine ? "You: " : ""}${last.text || "Sent an attachment"}` : "",
    messages: (c.messages ?? []).map(toMessage), unread: c.unread_count,
  };
}

export function toNotification(n: any): NotificationItem {
  const t: string = n.notification_type;
  return {
    id: String(n.id),
    type: t === "NEW_MESSAGE" ? "message" : t === "PROVIDER_VERIFICATION" ? "system" : "booking",
    title: n.title, body: n.message, time: timeAgo(n.created_at), read: n.is_read,
  };
}

export function toUser(u: any): AuthUser {
  return {
    id: u.id, name: u.full_name || u.email, role: String(u.role).toLowerCase() as AuthUser["role"], email: u.email,
    avatar: u.profile_image || avatarFor(u.full_name || u.email),
    providerId: u.provider_id ? String(u.provider_id) : undefined,
  };
}

/* ------------------------------- endpoints --------------------------------- */
export interface Page<T> { count: number; next: string | null; results: T[] }

export const api = {
  // auth
  async login(email: string, password: string): Promise<AuthUser> {
    const d = await request<any>("/auth/login/", { method: "POST", body: { email, password }, auth: false });
    tokens.set(d.access, d.refresh);
    return toUser(d.user);
  },
  async register(input: Record<string, unknown>): Promise<AuthUser> {
    const d = await request<any>("/auth/register/", { method: "POST", body: input, auth: false });
    tokens.set(d.access, d.refresh);
    return toUser(d.user);
  },
  async me(): Promise<AuthUser> { return toUser(await request<any>("/auth/me/")); },

  // providers
  async providers(query: Query): Promise<Page<Provider>> {
    const d = await request<Page<any>>("/providers/", { query, auth: false });
    return { ...d, results: d.results.map(toProvider) };
  },
  async provider(id: string): Promise<Provider> { return toProvider(await request<any>(`/providers/${id}/`)); },

  // bookings
  async bookings(): Promise<BookingRequest[]> {
    const d = await request<Page<any>>("/bookings/", { query: { page_size: 100 } });
    return d.results.map(toBooking);
  },
  async createBooking(body: Record<string, unknown>): Promise<BookingRequest> {
    return toBooking(await request<any>("/bookings/", { method: "POST", body }));
  },
  async bookingAction(id: string, action: "accept" | "decline" | "start" | "complete" | "cancel"): Promise<BookingRequest> {
    return toBooking(await request<any>(`/bookings/${id}/${action}/`, { method: "POST" }));
  },

  // reviews
  submitReview(booking: string, rating: number, comment: string) {
    return request("/reviews/", { method: "POST", body: { booking: Number(booking), rating, comment } });
  },

  // favourites
  async favorites(): Promise<Provider[]> { return (await request<any[]>("/favorites/")).map(toProvider); },
  addFavorite(providerId: string) { return request("/favorites/", { method: "POST", body: { provider: Number(providerId) } }); },
  removeFavorite(providerId: string) { return request(`/favorites/${providerId}/`, { method: "DELETE" }); },

  // messaging
  async conversations(): Promise<Conversation[]> {
    const d = await request<Page<any>>("/conversations/", { query: { page_size: 100 } });
    return d.results.map(toConversation);
  },
  async conversation(id: string): Promise<Conversation> { return toConversation(await request<any>(`/conversations/${id}/`)); },
  async startConversation(providerId: string): Promise<Conversation> {
    return toConversation(await request<any>("/conversations/", { method: "POST", body: { provider: Number(providerId) } }));
  },
  async sendMessage(conversationId: string, text: string, file?: File): Promise<Message> {
    if (file) {
      const form = new FormData();
      form.append("text", text);
      form.append("attachment", file);
      return toMessage(await request<any>(`/conversations/${conversationId}/messages/`, { method: "POST", form }));
    }
    return toMessage(await request<any>(`/conversations/${conversationId}/messages/`, { method: "POST", body: { text } }));
  },

  // notifications
  async notifications(): Promise<NotificationItem[]> {
    const d = await request<Page<any>>("/notifications/", { query: { page_size: 50 } });
    return d.results.map(toNotification);
  },
  markNotificationRead(id: string) { return request(`/notifications/${id}/read/`, { method: "PATCH" }); },
  markAllNotificationsRead() { return request("/notifications/read-all/", { method: "POST" }); },
  clearNotifications() { return request("/notifications/", { method: "DELETE" }); },

  // dashboards
  providerDashboard() { return request<any>("/dashboard/provider/"); },
};
