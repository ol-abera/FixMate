import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { toast } from "sonner";
import { api, errorMessage, tokens, toNotification } from "../services/api";
import { connectRealtime, type RealtimeEvent } from "../services/realtime";
import {
  CATEGORIES, CITIES,
  type AuthUser, type BookingRequest, type BookingStatus, type Conversation, type NotificationItem, type Provider,
  type PublicStats, type ServiceCategory,
} from "../data/mockData";

interface State {
  user: AuthUser | null;
  providers: Provider[];
  bookings: BookingRequest[];
  favorites: string[];
  conversations: Conversation[];
  notifications: NotificationItem[];
}

const empty: State = { user: null, providers: [], bookings: [], favorites: [], conversations: [], notifications: [] };


export interface NewBooking {
  providerId: string;
  categoryId: string;
  serviceName: string;
  description: string;
  date: string;
  timeSlot: string;
  address: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  serviceId?: string;
  notes?: string;
  photos?: File[];
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  role: "customer" | "provider";
  phone?: string;
  location?: string;
  profession?: string;
  category?: string;
  hourlyRate?: number;
  yearsOfExperience?: number;
  description?: string;
}

interface AppContextValue extends State {
  ready: boolean;
  unreadCount: number;
  /** Live categories from the API (static list until loaded). */
  categories: ServiceCategory[];
  stats: PublicStats | null;
  /** Cities with verified pros (static list until stats load). */
  cities: string[];
  getCategory: (id: string) => ServiceCategory | undefined;
  setUser: (u: AuthUser) => void;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => void;
  /** Resolves to the new favourite state, or null if the action was not allowed. */
  toggleFavorite: (providerId: string) => Promise<boolean | null>;
  addBooking: (b: NewBooking) => Promise<BookingRequest>;
  updateBookingStatus: (id: string, status: BookingStatus, finalPrice?: number) => Promise<void>;
  submitReview: (bookingId: string, rating: number, comment: string) => Promise<void>;
  updateReview: (reviewId: string, rating: number, comment: string) => Promise<void>;
  deleteReview: (reviewId: string) => Promise<void>;
  refreshBookings: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  sendMessage: (conversationId: string, text: string, file?: File) => Promise<void>;
  startConversation: (providerId: string) => Promise<string>;
  startConversationWithCustomer: (customerId: number) => Promise<string>;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearNotifications: () => void;
  /** True while the WebSocket is connected and authenticated; polling slows down while live. */
  live: boolean;
  /** Listen to raw realtime events (e.g. the open chat thread). Returns an unsubscribe function. */
  subscribe: (fn: (e: RealtimeEvent) => void) => () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const ACTION_FOR: Partial<Record<BookingStatus, "accept" | "decline" | "start" | "complete" | "cancel">> = {
  accepted: "accept", declined: "decline", in_progress: "start", completed: "complete", cancelled: "cancel",
};

const upsert = <T extends { id: string }>(list: T[], item: T): T[] =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(empty);
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>(CATEGORIES);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const ref = useRef(state);
  ref.current = state;

  const patch = useCallback((p: Partial<State> | ((s: State) => Partial<State>)) => {
    setState((s) => ({ ...s, ...(typeof p === "function" ? p(s) : p) }));
  }, []);

  /* ------------------------------ data loading ----------------------------- */
  const loadPublic = useCallback(async () => {
    api.categories().then(setCategories).catch((e) => console.error("categories", e));
    api.stats().then(setStats).catch((e) => console.error("stats", e));
    try {
      const page = await api.providers({ page_size: 24, ordering: "-rating" });
      patch((s) => ({
        providers: [...page.results, ...s.providers.filter((p) => !page.results.some((r) => r.id === p.id))],
      }));
    } catch (e) { console.error("providers", e); }
  }, [patch]);

  const refreshBookings = useCallback(async () => {
    try { patch({ bookings: await api.bookings() }); } catch (e) { console.error("bookings", e); }
  }, [patch]);

  const refreshConversations = useCallback(async () => {
    try {
      const list = await api.conversations();
      patch((s) => ({
        conversations: list.map((c) => {
          const old = s.conversations.find((o) => o.id === c.id);
          return { ...c, messages: old?.messages ?? [] };
        }),
      }));
    } catch (e) { console.error("conversations", e); }
  }, [patch]);

  const refreshNotifications = useCallback(async () => {
    try { patch({ notifications: await api.notifications() }); } catch (e) { console.error("notifications", e); }
  }, [patch]);

  const loadPrivate = useCallback(async (u: AuthUser) => {
    await Promise.all([
      refreshBookings(), refreshConversations(), refreshNotifications(),
      u.role === "customer"
        ? api.favorites().then((favs) => patch((s) => ({
            favorites: favs.map((f) => f.id),
            providers: [...s.providers, ...favs.filter((f) => !s.providers.some((p) => p.id === f.id))],
          }))).catch((e) => console.error("favorites", e))
        : Promise.resolve(),
    ]);
  }, [patch, refreshBookings, refreshConversations, refreshNotifications]);

  // initial boot: public providers + restore session
  useEffect(() => {
    (async () => {
      await loadPublic();
      if (tokens.access) {
        try {
          const u = await api.me();
          patch({ user: u });
          await loadPrivate(u);
        } catch { tokens.clear(); }
      }
      setReady(true);
    })();
  }, [loadPublic, loadPrivate, patch]);

  // token refresh failed somewhere => sign out locally
  useEffect(() => {
    const h = () => setState((s) => ({ ...empty, providers: s.providers }));
    window.addEventListener("fixmate:logout", h);
    return () => window.removeEventListener("fixmate:logout", h);
  }, []);

  /* ------------------------------- realtime -------------------------------- */
  const [live, setLive] = useState(false);
  const listeners = useRef(new Set<(e: RealtimeEvent) => void>());
  const subscribe = useCallback((fn: (e: RealtimeEvent) => void) => {
    listeners.current.add(fn);
    return () => { listeners.current.delete(fn); };
  }, []);

  const userId = state.user?.id;
  useEffect(() => {
    if (!userId) return;
    const stop = connectRealtime({
      onStatus: setLive,
      onEvent: (e) => {
        if (e.type === "notification") {
          const n = toNotification(e.notification);
          patch((s) => ({ notifications: [n, ...s.notifications.filter((x) => x.id !== n.id)] }));
          const chatting = n.type === "message" && window.location.pathname.startsWith("/messages");
          if (!chatting) toast(n.title, { description: n.body || undefined });
          if (n.bookingId) refreshBookings();
        } else if (e.type === "message") {
          refreshConversations();
          if (String(e.sender_id) !== String(ref.current.user?.id)) refreshNotifications();
        } else if (e.type === "booking") {
          refreshBookings();
        }
        listeners.current.forEach((fn) => fn(e));
      },
    });
    return () => { stop(); setLive(false); };
  }, [userId, patch, refreshBookings, refreshConversations, refreshNotifications]);

  // Polling is the fallback when the socket is down, and a slow safety net while it is up.
  useEffect(() => {
    if (!state.user) return;
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      refreshNotifications();
      refreshConversations();
    }, live ? 60000 : 15000);
    return () => clearInterval(t);
  }, [state.user, live, refreshNotifications, refreshConversations]);

  /* --------------------------------- auth ---------------------------------- */
  const login = useCallback(async (email: string, password: string) => {
    const u = await api.login(email, password);
    patch({ user: u });
    await loadPrivate(u);
    return u;
  }, [patch, loadPrivate]);

  const register = useCallback(async (i: RegisterInput) => {
    const u = await api.register({
      email: i.email, password: i.password, first_name: i.firstName, last_name: i.lastName ?? "",
      role: i.role.toUpperCase(), phone: i.phone, location: i.location, profession: i.profession,
      category: i.category, hourly_rate: i.hourlyRate, years_of_experience: i.yearsOfExperience,
      description: i.description,
    });
    patch({ user: u });
    await loadPrivate(u);
    return u;
  }, [patch, loadPrivate]);

  const logout = useCallback(() => {
    void api.logout();
    setState((s) => ({ ...empty, providers: s.providers }));
  }, []);

  /* ------------------------------- favourites ------------------------------ */
  const toggleFavorite = useCallback(async (providerId: string) => {
    const { user, favorites } = ref.current;
    if (!user) { toast.info("Sign in as a customer to save favorites"); return null; }
    if (user.role !== "customer") { toast.info("Only customer accounts can save favorites"); return null; }
    const was = favorites.includes(providerId);
    patch({ favorites: was ? favorites.filter((f) => f !== providerId) : [...favorites, providerId] });
    try {
      if (was) await api.removeFavorite(providerId); else await api.addFavorite(providerId);
      return !was;
    } catch (e) {
      patch({ favorites });
      toast.error(errorMessage(e));
      return null;
    }
  }, [patch]);

  /* -------------------------------- bookings ------------------------------- */
  const addBooking = useCallback(async (b: NewBooking) => {
    const created = await api.createBooking({
      provider: Number(b.providerId), service: b.serviceId ? Number(b.serviceId) : undefined,
      category: b.categoryId || undefined, title: b.serviceName,
      description: b.description, scheduled_date: b.date, time_slot: b.timeSlot, location: b.address,
      contact_name: b.contactName, contact_phone: b.contactPhone, contact_email: b.contactEmail,
      notes: b.notes || undefined,
    });
    patch((s) => ({ bookings: upsert(s.bookings, created) }));
    if (b.photos?.length) {
      const results = await Promise.allSettled(b.photos.map((f) => api.addBookingPhoto(created.id, f)));
      const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failed) toast.warning("Some photos could not be uploaded", { description: errorMessage(failed.reason) });
      await refreshBookings();
    }
    refreshNotifications();
    return created;
  }, [patch, refreshBookings, refreshNotifications]);

  const updateBookingStatus = useCallback(async (id: string, status: BookingStatus, finalPrice?: number) => {
    const action = ACTION_FOR[status];
    if (!action) return;
    try {
      const updated = await api.bookingAction(id, action, finalPrice);
      patch((s) => ({ bookings: upsert(s.bookings, updated) }));
    } catch (e) {
      toast.error(errorMessage(e));
      await refreshBookings();
    }
  }, [patch, refreshBookings]);

  const submitReview = useCallback(async (bookingId: string, rating: number, comment: string) => {
    await api.submitReview(bookingId, rating, comment);
    await refreshBookings();
  }, [refreshBookings]);

  const updateReview = useCallback(async (reviewId: string, rating: number, comment: string) => {
    await api.updateReview(reviewId, rating, comment);
    await refreshBookings();
  }, [refreshBookings]);

  const deleteReview = useCallback(async (reviewId: string) => {
    await api.deleteReview(reviewId);
    await refreshBookings();
  }, [refreshBookings]);

  /* -------------------------------- messaging ------------------------------ */
  const loadConversation = useCallback(async (id: string) => {
    try {
      const c = await api.conversation(id);
      patch((s) => ({ conversations: upsert(s.conversations, c) }));
    } catch (e) { console.error("conversation", e); }
  }, [patch]);

  const openConversation = useCallback(async (target: { provider: string } | { customer: number }) => {
    const c = await api.startConversation(target);
    patch((s) => ({
      conversations: s.conversations.some((x) => x.id === c.id) ? s.conversations : [c, ...s.conversations],
    }));
    return c.id;
  }, [patch]);

  const startConversation = useCallback(async (providerId: string) => {
    if (!ref.current.user) throw new Error("Sign in to message a pro");
    if (ref.current.user.role !== "customer") throw new Error("Only customers can start a conversation with a pro");
    return openConversation({ provider: providerId });
  }, [openConversation]);

  const startConversationWithCustomer = useCallback(async (customerId: number) => {
    if (ref.current.user?.role !== "provider") throw new Error("Only providers can message customers");
    return openConversation({ customer: customerId });
  }, [openConversation]);

  const setUser = useCallback((u: AuthUser) => patch({ user: u }), [patch]);

  const sendMessage = useCallback(async (conversationId: string, text: string, file?: File) => {
    try {
      const m = await api.sendMessage(conversationId, text, file);
      patch((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, lastMessage: `You: ${text || "Sent an attachment"}`, messages: [...c.messages, m] }
            : c),
      }));
    } catch (e) { toast.error(errorMessage(e, "Could not send message")); }
  }, [patch]);

  /* ----------------------------- notifications ----------------------------- */
  const markAllRead = useCallback(() => {
    patch((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
    api.markAllNotificationsRead().catch((e) => console.error(e));
  }, [patch]);

  const markRead = useCallback((id: string) => {
    patch((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
    api.markNotificationRead(id).catch((e) => console.error(e));
  }, [patch]);

  const clearNotifications = useCallback(() => {
    patch({ notifications: [] });
    api.clearNotifications().catch((e) => console.error(e));
  }, [patch]);

  const cities = useMemo(() => (stats?.cities.length ? stats.cities : CITIES), [stats]);
  const getCategory = useCallback((id: string) => categories.find((c) => c.id === id), [categories]);

  const unreadCount = useMemo(() => state.notifications.filter((n) => !n.read).length, [state.notifications]);

  const value: AppContextValue = {
    ...state, ready, unreadCount, categories, stats, cities, getCategory, setUser, login, register, logout, toggleFavorite, addBooking,
    updateBookingStatus, submitReview, updateReview, deleteReview, refreshBookings, loadConversation,
    refreshConversations, sendMessage, startConversation, startConversationWithCustomer,
    markAllRead, markRead, clearNotifications, live, subscribe,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

/** Loads a single provider (with reviews/gallery) from the API; shows the cached card while loading. */
export function useProviderById(id?: string) {
  const { providers } = useApp();
  const [detail, setDetail] = useState<Provider | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let live = true;
    setDetail(null);
    if (!id) { setStatus("missing"); return; }
    setStatus("loading");
    api.provider(id)
      .then((p) => { if (live) { setDetail(p); setStatus("ready"); } })
      .catch(() => { if (live) setStatus("missing"); });
    return () => { live = false; };
  }, [id]);

  const provider = detail ?? (status === "loading" ? providers.find((p) => p.id === id) ?? null : null);
  return { provider, loading: status === "loading" && !provider, missing: status === "missing" };
}
