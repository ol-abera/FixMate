/**
 * FixMate API client + mappers from the Django REST API (snake_case, UPPERCASE enums)
 * to the existing frontend domain types (camelCase, lowercase).
 */
import type {
  AuthUser, BookingPayment, BookingRequest, BookingStatus, Conversation, Message, NotificationItem,
  PricingTier, Provider, ProviderService, PublicStats, Review, ServiceCategory,
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
export async function refreshAccess(): Promise<boolean> {
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

/* eslint-disable @typescript-eslint/no-explicit-any */
const duration = (mins: number) => (mins % 60 === 0 ? `${mins / 60}h` : mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`);

/** Pricing cards: the provider's real services, or a single hourly card when they have none. */
function buildTiers(rate: number, minJob: number, services: ProviderService[], instant: boolean): PricingTier[] {
  const active = services.filter((s) => s.active);
  if (active.length) {
    return active.map((s) => ({
      name: s.title, price: s.price, unit: "", serviceId: s.id,
      features: [s.categoryName, `About ${duration(s.durationMins)}`, ...(s.description ? [s.description] : [])],
    }));
  }
  return [{
    name: "Hourly", price: rate, unit: "/hr",
    features: [`Minimum job $${minJob}`, instant ? "Instant booking" : "Request-based booking", "Final price confirmed on completion"],
  }];
}

export function toService(s: any): ProviderService {
  return {
    id: String(s.id), title: s.title, description: s.description ?? "", price: Number(s.starting_price),
    durationMins: s.duration_minutes, categoryId: s.category, categoryName: s.category_name ?? "", active: s.is_active,
  };
}

export function toCategory(c: any): ServiceCategory {
  return {
    id: c.slug, name: c.name, icon: c.icon || "Wrench", description: c.description ?? "",
    avgPrice: Math.round(Number(c.avg_price ?? 0)), providerCount: c.provider_count ?? 0,
  };
}

export function toStats(d: any): PublicStats {
  return {
    verifiedProviders: d.verified_providers, jobsCompleted: d.jobs_completed, avgRating: Number(d.avg_rating),
    cities: d.cities ?? [], citiesCount: d.cities_count ?? 0,
    featuredReviews: (d.featured_reviews ?? []).map((r: any) => ({
      id: String(r.id), author: r.author, avatar: r.avatar || avatarFor(r.author), rating: r.rating, text: r.comment,
      providerName: r.provider_name, city: r.provider_city ?? "",
    })),
  };
}

export const toReview = (r: any): Review => ({
  id: String(r.id), author: r.author, avatar: r.avatar || avatarFor(r.author), rating: r.rating,
  date: timeAgo(r.created_at), text: r.comment,
});

/* --------------------------------- mappers --------------------------------- */
export function toProvider(p: any): Provider {
  const rate = Number(p.hourly_rate);
  const reviews: Review[] = (p.reviews ?? []).map(toReview);
  const services: ProviderService[] = (p.services ?? []).map(toService);
  return {
    id: String(p.id), userId: p.user_id, name: p.name, title: p.title,
    avatar: p.avatar || avatarFor(p.name),
    cover: p.cover || `https://picsum.photos/seed/fixmate-${p.id}/1200/400`,
    categoryIds: p.categories ?? [], city: p.city || "",
    // Only present when the search had an origin; the UI shows the city instead when it's 0.
    distanceKm: p.distance_km == null ? 0 : Math.max(Number(p.distance_km), 0.1),
    rating: Number(p.rating), reviewCount: p.total_reviews, hourlyRate: rate, minJobPrice: Number(p.starting_price),
    verified: p.verified, instantBook: p.instant_book, availableNow: p.available_now,
    yearsExperience: p.years_of_experience, jobsCompleted: p.jobs_completed, responseTimeMins: p.response_time_mins,
    bio: p.bio || `${p.name} is a trusted local ${String(p.title).toLowerCase()}.`,
    skills: p.skills ?? [], gallery: p.gallery ?? [], reviews, services,
    tiers: buildTiers(rate, Number(p.starting_price), services, p.instant_book),
    portfolio: (p.portfolio ?? []).map((i: any) => ({ id: String(i.id), image: i.image, caption: i.caption ?? "" })),
    favoritesCount: p.favorites_count, availability: p.availability, verificationStatus: p.verification_status,
    hasLocation: p.has_location,
    pin: p.pin ? { lat: p.pin.lat, lng: p.pin.lng, isCityCenter: p.pin.is_city_center } : null,
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
    canReview: b.can_review, hasReview: b.has_review, customerId: b.customer,
    serviceId: b.service == null ? undefined : String(b.service),
    review: b.review ? { id: String(b.review.id), rating: b.review.rating, comment: b.review.comment } : null,
    notes: b.notes ?? "",
    photos: (b.photos ?? []).map((p: any) => ({ id: String(p.id), url: p.image })),
    payment: b.payment ? { status: String(b.payment.status).toLowerCase() as BookingPayment["status"], amount: Number(b.payment.amount), paidAt: b.payment.paid_at ?? null } : null,
    canPay: !!b.can_pay,
  };
}

export interface PaymentSession {
  bookingId: string;
  title: string;
  providerName: string;
  amount: number;
  currency: string;
  gateway: "stripe" | "mock";
  status: BookingPayment["status"];
  failureReason: string;
}

export function toPaymentSession(p: any): PaymentSession {
  return {
    bookingId: String(p.booking), title: p.booking_title, providerName: p.provider_name, amount: Number(p.amount),
    currency: p.currency, gateway: p.gateway, status: String(p.status).toLowerCase() as BookingPayment["status"],
    failureReason: p.failure_reason ?? "",
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
    bookingId: n.data?.booking_id != null ? String(n.data.booking_id) : undefined,
    conversationId: n.data?.conversation_id != null ? String(n.data.conversation_id) : undefined,
  };
}

export function toUser(u: any): AuthUser {
  return {
    id: u.id, name: u.full_name || u.email, role: String(u.role).toLowerCase() as AuthUser["role"], email: u.email,
    avatar: u.profile_image || avatarFor(u.full_name || u.email),
    providerId: u.provider_id ? String(u.provider_id) : undefined,
    firstName: u.first_name, lastName: u.last_name, phone: u.phone, location: u.location, bio: u.bio,
    hasAvatar: !!u.profile_image,
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
  async logout() {
    const refresh = tokens.refresh;
    tokens.clear();
    if (refresh) await request("/auth/logout/", { method: "POST", body: { refresh }, auth: false }).catch(() => {});
  },
  async changePassword(currentPassword: string, newPassword: string) {
    const d = await request<any>("/auth/password/change/", { method: "POST", body: { current_password: currentPassword, new_password: newPassword } });
    tokens.set(d.access, d.refresh);
  },
  requestPasswordReset(email: string) {
    return request<{ detail: string }>("/auth/password/reset/", { method: "POST", body: { email }, auth: false });
  },
  confirmPasswordReset(uid: string, token: string, newPassword: string) {
    return request<{ detail: string }>("/auth/password/reset/confirm/", { method: "POST", body: { uid, token, new_password: newPassword }, auth: false });
  },
  async me(): Promise<AuthUser> { return toUser(await request<any>("/auth/me/")); },
  async updateMe(data: Record<string, string> | FormData): Promise<AuthUser> {
    const opts = data instanceof FormData ? { method: "PATCH", form: data } : { method: "PATCH", body: data };
    return toUser(await request<any>("/auth/me/", opts));
  },

  // marketplace data
  async categories(): Promise<ServiceCategory[]> { return (await request<any[]>("/categories/", { auth: false })).map(toCategory); },
  async stats(): Promise<PublicStats> { return toStats(await request<any>("/dashboard/public/", { auth: false })); },

  // providers
  async providers(query: Query): Promise<Page<Provider>> {
    const d = await request<Page<any>>("/providers/", { query, auth: false });
    return { ...d, results: d.results.map(toProvider) };
  },
  async provider(id: string): Promise<Provider> { return toProvider(await request<any>(`/providers/${id}/`)); },
  async providerReviews(id: string, page: number): Promise<Page<Review>> {
    const d = await request<Page<any>>(`/providers/${id}/reviews/`, { query: { page, page_size: 10 }, auth: false });
    return { ...d, results: d.results.map(toReview) };
  },
  async myProvider(): Promise<Provider> { return toProvider(await request<any>("/providers/me/")); },
  async updateMyProvider(data: Record<string, unknown> | FormData): Promise<Provider> {
    const opts = data instanceof FormData ? { method: "PATCH", form: data } : { method: "PATCH", body: data };
    return toProvider(await request<any>("/providers/me/", opts));
  },
  addPortfolioImage(file: File, caption = "") {
    const form = new FormData();
    form.append("image", file);
    form.append("caption", caption);
    return request("/providers/me/portfolio/", { method: "POST", form });
  },
  deletePortfolioImage(id: string) { return request(`/providers/me/portfolio/${id}/`, { method: "DELETE" }); },

  // services (provider-owned)
  async myServices(): Promise<ProviderService[]> {
    const d = await request<Page<any>>("/services/", { query: { mine: 1, page_size: 100 } });
    return d.results.map(toService);
  },
  async saveService(s: Partial<ProviderService>): Promise<ProviderService> {
    const body = {
      title: s.title, description: s.description, starting_price: s.price, duration_minutes: s.durationMins,
      category: s.categoryId, is_active: s.active,
    };
    return toService(await request<any>(s.id ? `/services/${s.id}/` : "/services/", { method: s.id ? "PATCH" : "POST", body }));
  },
  deleteService(id: string) { return request(`/services/${id}/`, { method: "DELETE" }); },

  // bookings
  async bookings(): Promise<BookingRequest[]> {
    const d = await request<Page<any>>("/bookings/", { query: { page_size: 100 } });
    return d.results.map(toBooking);
  },
  async createBooking(body: Record<string, unknown>): Promise<BookingRequest> {
    return toBooking(await request<any>("/bookings/", { method: "POST", body }));
  },
  busySlots(providerId: string) {
    return request<{ date: string; time_slot: string }[]>("/bookings/busy/", { query: { provider: providerId }, auth: false });
  },
  addBookingPhoto(id: string, file: File) {
    const form = new FormData();
    form.append("image", file);
    return request(`/bookings/${id}/photos/`, { method: "POST", form });
  },
  deleteBookingPhoto(id: string, photoId: string) { return request(`/bookings/${id}/photos/${photoId}/`, { method: "DELETE" }); },
  startCheckout(bookingId: string) {
    return request<{ checkout_url: string }>("/payments/checkout/", { method: "POST", body: { booking: Number(bookingId) } });
  },
  async paymentSession(sessionId: string): Promise<PaymentSession> { return toPaymentSession(await request<any>(`/payments/session/${encodeURIComponent(sessionId)}/`)); },
  async syncPayment(sessionId: string): Promise<PaymentSession> {
    return toPaymentSession(await request<any>("/payments/sync/", { method: "POST", body: { session_id: sessionId } }));
  },
  async confirmMockPayment(sessionId: string, cardNumber: string): Promise<PaymentSession> {
    return toPaymentSession(await request<any>("/payments/mock/confirm/", { method: "POST", body: { session_id: sessionId, card_number: cardNumber } }));
  },
  async bookingAction(id: string, action: "accept" | "decline" | "start" | "complete" | "cancel", finalPrice?: number): Promise<BookingRequest> {
    const body = finalPrice !== undefined ? { final_price: finalPrice } : undefined;
    return toBooking(await request<any>(`/bookings/${id}/${action}/`, { method: "POST", body }));
  },

  // reviews
  submitReview(booking: string, rating: number, comment: string) {
    return request("/reviews/", { method: "POST", body: { booking: Number(booking), rating, comment } });
  },
  updateReview(id: string, rating: number, comment: string) {
    return request(`/reviews/${id}/`, { method: "PATCH", body: { rating, comment } });
  },
  deleteReview(id: string) { return request(`/reviews/${id}/`, { method: "DELETE" }); },

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
  async startConversation(target: { provider: string } | { customer: number }): Promise<Conversation> {
    const body = "provider" in target ? { provider: Number(target.provider) } : { customer: target.customer };
    return toConversation(await request<any>("/conversations/", { method: "POST", body }));
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

  // admin console
  adminDashboard() { return request<AdminStats>("/dashboard/admin/"); },
  async pendingProviders(): Promise<Provider[]> {
    const d = await request<Page<any>>("/providers/", { query: { include_unverified: 1, status: "PENDING", page_size: 50, ordering: "created_at" } });
    return d.results.map(toProvider);
  },
  verifyProvider(id: string) { return request(`/providers/${id}/verify/`, { method: "POST" }); },
  rejectProvider(id: string, reason: string) { return request(`/providers/${id}/reject/`, { method: "POST", body: { reason } }); },
  async moderationReviews(filter: "all" | "low" | "hidden"): Promise<ModerationReview[]> {
    const query = { page_size: 30, ...(filter === "low" ? { max_rating: 2 } : filter === "hidden" ? { state: "hidden" } : {}) };
    const d = await request<Page<any>>("/reviews/moderation/", { query });
    return d.results.map((r) => ({ ...toReview(r), providerId: String(r.provider), providerName: r.provider_name, published: r.is_published }));
  },
  setReviewPublished(id: string, published: boolean) {
    return request(`/reviews/${id}/${published ? "publish" : "hide"}/`, { method: "POST" });
  },
};

export interface AdminStats {
  users: number; customers: number; providers: number; pending_providers: number; bookings: number;
  completed_bookings: number; gmv: string | number; reviews: number; avg_rating: string | number;
  bookings_by_status: Record<string, number>;
  daily: { day: string; bookings: number; completed_value: string | number }[];
  recent_signups: { id: number; name: string; email: string; role: string; created_at: string }[];
}

export type ModerationReview = Review & { providerId: string; providerName: string; published: boolean };

/** Django admin lives next to the API (same host, /admin/). */
export const DJANGO_ADMIN_URL = API_URL.replace(/\/api\/?$/, "") + "/admin/";
