import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { toast } from "sonner";
import { api, errorMessage, tokens } from "../services/api";
import type {
  AuthUser, BookingRequest, BookingStatus, Conversation, NotificationItem, Provider,
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
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => void;
  /** Resolves to the new favourite state, or null if the action was not allowed. */
  toggleFavorite: (providerId: string) => Promise<boolean | null>;
  addBooking: (b: NewBooking) => Promise<BookingRequest>;
  updateBookingStatus: (id: string, status: BookingStatus) => Promise<void>;
  submitReview: (bookingId: string, rating: number, comment: string) => Promise<void>;
  refreshBookings: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  sendMessage: (conversationId: string, text: string, file?: File) => Promise<void>;
  startConversation: (provider: Provider) => Promise<string>;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearNotifications: () => void;
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
  const ref = useRef(state);
  ref.current = state;

  const patch = useCallback((p: Partial<State> | ((s: State) => Partial<State>)) => {
    setState((s) => ({ ...s, ...(typeof p === "function" ? p(s) : p) }));
  }, []);

  /* ------------------------------ data loading ----------------------------- */
  const loadPublic = useCallback(async () => {
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

  // lightweight polling (real-time via WebSockets can replace this later)
  useEffect(() => {
    if (!state.user) return;
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      refreshNotifications();
      refreshConversations();
    }, 15000);
    return () => clearInterval(t);
  }, [state.user, refreshNotifications, refreshConversations]);

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
    tokens.clear();
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
      provider: Number(b.providerId), category: b.categoryId || undefined, title: b.serviceName,
      description: b.description, scheduled_date: b.date, time_slot: b.timeSlot, location: b.address,
      contact_name: b.contactName, contact_phone: b.contactPhone, contact_email: b.contactEmail,
    });
    patch((s) => ({ bookings: upsert(s.bookings, created) }));
    refreshNotifications();
    return created;
  }, [patch, refreshNotifications]);

  const updateBookingStatus = useCallback(async (id: string, status: BookingStatus) => {
    const action = ACTION_FOR[status];
    if (!action) return;
    try {
      const updated = await api.bookingAction(id, action);
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

  /* -------------------------------- messaging ------------------------------ */
  const loadConversation = useCallback(async (id: string) => {
    try {
      const c = await api.conversation(id);
      patch((s) => ({ conversations: upsert(s.conversations, c) }));
    } catch (e) { console.error("conversation", e); }
  }, [patch]);

  const startConversation = useCallback(async (provider: Provider) => {
    if (!ref.current.user) throw new Error("Sign in to message a pro");
    if (ref.current.user.role !== "customer") throw new Error("Only customers can start a conversation");
    const c = await api.startConversation(provider.id);
    patch((s) => ({
      conversations: s.conversations.some((x) => x.id === c.id) ? s.conversations : [c, ...s.conversations],
    }));
    return c.id;
  }, [patch]);

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

  const unreadCount = useMemo(() => state.notifications.filter((n) => !n.read).length, [state.notifications]);

  const value: AppContextValue = {
    ...state, ready, unreadCount, login, register, logout, toggleFavorite, addBooking, updateBookingStatus,
    submitReview, refreshBookings, loadConversation, refreshConversations, sendMessage, startConversation,
    markAllRead, markRead, clearNotifications,
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
