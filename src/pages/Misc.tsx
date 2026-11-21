import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChatCircle, PaperPlaneRight, Paperclip, MagnifyingGlass, Bell, CheckCircle,
  X, Trash, UserPlus, ShieldCheck, SealCheck, ArrowRight, Info,
  Envelope, MapPin, Wrench, Users, IdentificationCard, Building, Star,
} from "@phosphor-icons/react";
import { cn } from "../lib/utils";
import { useApp } from "../context/AppContext";
import { api, errorMessage } from "../services/api";
import { formatCount } from "../lib/format";
import { Avatar, EmptyState, SectionHeading } from "../components/Layout";
import { dashboardPath, notificationLink, safeNext } from "../lib/links";
import { toast } from "sonner";

/* -------------------------------- Messages --------------------------------- */

export function MessagesPage() {
  const { conversations, sendMessage, user, loadConversation, subscribe, live } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sp, setSp] = useSearchParams();
  const [activeId, setActiveId] = useState(sp.get("c") ?? conversations[0]?.id ?? "");
  const [text, setText] = useState("");
  const [mobileOpen, setMobileOpen] = useState(Boolean(sp.get("c")));
  const [search, setSearch] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];
  const visible = conversations.filter((c) => c.providerName.toLowerCase().includes(search.trim().toLowerCase()));

  useEffect(() => { const c = sp.get("c"); if (c) setActiveId(c); }, [sp]);

  // scroll only the thread panel, never the whole window
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [active?.id, active?.messages.length]);

  // load full thread (marks incoming as read); new messages arrive over the socket, with polling as fallback
  const activeConvId = active?.id;
  useEffect(() => {
    if (!activeConvId) return;
    loadConversation(activeConvId);
    const off = subscribe((e) => { if (e.type === "message" && String(e.conversation_id) === activeConvId) loadConversation(activeConvId); });
    const t = window.setInterval(() => loadConversation(activeConvId), live ? 30000 : 5000);
    return () => { off(); clearInterval(t); };
  }, [activeConvId, loadConversation, subscribe, live]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f && active) sendMessage(active.id, "", f);
  };

  const open = (id: string) => { setActiveId(id); setSp({ c: id }); setMobileOpen(true); };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !active) return;
    sendMessage(active.id, text.trim());
    setText("");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Messages</h1>
        {live && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100" title="New messages appear instantly"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live</span>}
      </div>
      <div className="grid h-[70vh] grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-[300px_1fr]">
        {/* list */}
        <aside className={cn("flex flex-col border-r border-slate-100", mobileOpen && "hidden md:flex")}>
          <div className="border-b border-slate-100 p-3">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3">
              <MagnifyingGlass size={16} className="text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats" className="w-full bg-transparent py-2 text-sm outline-none" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {visible.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">{conversations.length ? "No chats match your search." : "No conversations yet."}</p>}
            {visible.map((c) => (
              <button key={c.id} onClick={() => open(c.id)} className={cn("flex w-full items-center gap-3 border-b border-slate-50 px-3 py-3 text-left transition hover:bg-slate-50", active?.id === c.id && "bg-emerald-50/60")}>
                <div className="relative"><Avatar src={c.avatar} alt={c.providerName} size={44} />{c.online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{c.providerName}</p><p className="truncate text-xs text-slate-500">{c.lastMessage}</p></div>
                {!!c.unread && active?.id !== c.id && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">{c.unread}</span>}
              </button>
            ))}
          </div>
        </aside>

        {/* thread */}
        <section className={cn("flex flex-col", !mobileOpen && "hidden md:flex")}>
          {!active ? (
            <div className="grid flex-1 place-items-center p-8"><EmptyState icon={ChatCircle} title="No conversations yet" hint="Message a pro from their profile to start chatting." action={<Link to="/explore" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Find a pro</Link>} /></div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-slate-100 p-3">
                <button onClick={() => setMobileOpen(false)} className="grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100 md:hidden"><X size={18} /></button>
                <Avatar src={active.avatar} alt={active.providerName} size={40} />
                <div className="flex-1"><p className="text-sm font-bold text-slate-900">{active.providerName}</p><p className="text-xs text-emerald-600">{active.online ? "Online" : "Offline"}</p></div>
                {active.providerId && <Link to={`/providers/${active.providerId}`} aria-label="View profile" className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><IdentificationCard size={18} /></Link>}
              </div>
              <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">
                {active.messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.sender === "me" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm", m.sender === "me" ? "rounded-br-md bg-emerald-600 text-white" : "rounded-bl-md bg-white text-slate-700")}>
                      {m.attachment && <img src={m.attachment} alt="" className="mb-2 max-h-40 rounded-lg" />}
                      <p>{m.text}</p>
                      <p className={cn("mt-0.5 text-[10px]", m.sender === "me" ? "text-emerald-100" : "text-slate-400")}>{m.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={send} className="flex items-center gap-2 border-t border-slate-100 p-3">
                <button type="button" onClick={() => fileRef.current?.click()} className="grid h-10 w-10 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><Paperclip size={18} /></button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${active.providerName.split(" ")[0]}...`} className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />
                <button type="submit" className="grid h-10 w-10 place-items-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700 active:scale-95"><PaperPlaneRight size={18} weight="fill" /></button>
              </form>
            </>
          )}
        </section>
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">Signed in as {user?.name ?? "Guest"}</p>
    </div>
  );
}

/* ------------------------------ Notifications ------------------------------ */

const NOTIF_ICON = { booking: CheckCircle, message: ChatCircle, system: Info, offer: Star };
const NOTIF_STYLE = {
  booking: "bg-sky-100 text-sky-600", message: "bg-violet-100 text-violet-600",
  system: "bg-emerald-100 text-emerald-600", offer: "bg-amber-100 text-amber-600",
};

export function NotificationsPage() {
  const { notifications, markAllRead, markRead, clearNotifications, user } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const list = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading title="Notifications" />
        <div className="flex gap-2">
          <button onClick={() => setFilter(filter === "all" ? "unread" : "all")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">{filter === "all" ? "Unread only" : "Show all"}</button>
          <button onClick={() => { markAllRead(); toast.success("All marked read"); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Mark all read</button>
          {notifications.length > 0 && <button onClick={() => clearNotifications()} className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-100"><Trash size={14} /> Clear</button>}
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {list.length === 0 ? (
          <EmptyState icon={Bell} title="Nothing here" hint="You are all caught up — new updates will show here." />
        ) : list.map((n) => {
          const Icon = NOTIF_ICON[n.type];
          return (
            <button key={n.id} onClick={() => { markRead(n.id); const to = notificationLink(n, user); if (to !== "/notifications") navigate(to); }} className={cn("flex w-full items-start gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:shadow", n.read ? "border-slate-200" : "border-emerald-200 bg-emerald-50/40")}>
              <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", NOTIF_STYLE[n.type])}><Icon size={18} /></span>
              <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="font-semibold text-slate-900">{n.title}</span>{!n.read && <span className="h-2 w-2 rounded-full bg-emerald-500" />}</span><span className="mt-0.5 block text-sm text-slate-500">{n.body}</span><span className="mt-1 block text-xs text-slate-400">{n.time}</span></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------- Auth ----------------------------------- */

export function AuthPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const next = safeNext(sp.get("next"));
  const { login, register } = useApp();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<"customer" | "provider">("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && role === "provider") {
      toast.info("Complete your pro profile to join");
      navigate("/become-provider");
      return;
    }
    setBusy(true);
    try {
      let u;
      if (mode === "login") {
        u = await login(email, password);
      } else {
        const [first, ...rest] = name.trim().split(" ");
        u = await register({ email, password, firstName: first || "Customer", lastName: rest.join(" "), role: "customer" });
      }
      toast.success(mode === "login" ? "Welcome back!" : "Account created!");
      navigate(next ?? dashboardPath(u), { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, "Could not sign in"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2">
      <div className="hidden flex-col justify-center lg:flex">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100"><ShieldCheck size={14} /> Trusted marketplace</span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">Join thousands getting it fixed.</h1>
        <p className="mt-3 text-slate-500">Create an account to book verified pros, message them directly, and manage everything in one place.</p>
        <div className="mt-6 space-y-3">
          {["Instant booking with transparent pricing", "Every pro ID & background checked", "Secure in-app messaging & payments"].map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-slate-700"><CheckCircle size={18} className="text-emerald-600" /> {f}</div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          {(["login", "signup"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("rounded-lg py-2 text-sm font-semibold capitalize transition", mode === m ? "bg-white text-slate-900 shadow" : "text-slate-500")}>{m === "login" ? "Sign in" : "Sign up"}</button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">I am a</label>
            <div className="grid grid-cols-2 gap-2">
              {([["customer", Users, "Homeowner"], ["provider", Wrench, "Service pro"]] as const).map(([r, Icon, lbl]) => (
                <button type="button" key={r} onClick={() => setRole(r)} className={cn("flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition", role === r ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:border-emerald-300")}>
                  <Icon size={18} /> {lbl}
                </button>
              ))}
            </div>
          </div>
          {mode === "signup" && <Field icon={IdentificationCard} label="Full name" ph="Jane Doe" value={name} onChange={setName} />}
          <Field icon={Envelope} label="Email" ph="you@email.com" type="email" value={email} onChange={setEmail} />
          <Field icon={ShieldCheck} label="Password" ph="••••••••" type="password" value={password} onChange={setPassword} />
          {mode === "login" && (
            <div className="-mt-2 text-right">
              <Link to={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="text-xs font-semibold text-emerald-700 hover:underline">Forgot password?</Link>
            </div>
          )}
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-3 disabled:opacity-60 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-95">
            {mode === "login" ? "Sign in" : "Create account"} <ArrowRight size={16} />
          </button>
          <p className="text-center text-xs text-slate-400">Passwords are securely hashed. Sessions use short-lived JWTs.</p>
        </form>
      </div>
    </div>
  );
}

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><ShieldCheck size={22} /></span>
        <h1 className="mt-4 text-xl font-extrabold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [sp] = useSearchParams();
  const [email, setEmail] = useState(sp.get("email") ?? "");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email)) { toast.error("Enter the email you signed up with"); return; }
    setBusy(true);
    try {
      await api.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      toast.error(errorMessage(err, "Could not send reset email"));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthCard title="Check your inbox" subtitle={`If an account exists for ${email}, we've sent a link to reset your password. It expires in a few days and can only be used once.`}>
        <Link to="/auth" className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Back to sign in</Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Reset your password" subtitle="Enter your account email and we'll send you a reset link.">
      <form onSubmit={submit} className="space-y-4">
        <Field icon={Envelope} label="Email" ph="you@email.com" type="email" value={email} onChange={setEmail} />
        <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-95 disabled:opacity-60">
          Send reset link <ArrowRight size={16} />
        </button>
        <p className="text-center text-xs text-slate-500">Remembered it? <Link to="/auth" className="font-semibold text-emerald-700 hover:underline">Sign in</Link></p>
      </form>
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const uid = sp.get("uid") ?? "";
  const token = sp.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  if (!uid || !token) {
    return (
      <AuthCard title="Invalid reset link" subtitle="This link is incomplete. Request a new one and use the link from the latest email.">
        <Link to="/forgot-password" className="flex w-full items-center justify-center rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700">Request a new link</Link>
      </AuthCard>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Use at least 8 characters"); return; }
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    setBusy(true);
    try {
      await api.confirmPasswordReset(uid, token, password);
      toast.success("Password updated", { description: "Sign in with your new password." });
      navigate("/auth", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, "Could not reset password"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Choose a new password" subtitle="You'll be signed out on all other devices.">
      <form onSubmit={submit} className="space-y-4">
        <Field icon={ShieldCheck} label="New password (8+ characters)" ph="••••••••" type="password" value={password} onChange={setPassword} />
        <Field icon={ShieldCheck} label="Confirm new password" ph="••••••••" type="password" value={confirm} onChange={setConfirm} />
        <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-95 disabled:opacity-60">
          Update password <ArrowRight size={16} />
        </button>
        <p className="text-center text-xs text-slate-500">Link expired? <Link to="/forgot-password" className="font-semibold text-emerald-700 hover:underline">Request a new one</Link></p>
      </form>
    </AuthCard>
  );
}

function Field({
  icon: Icon,
  label,
  ph,
  type = "text",
  value,
  onChange,
}: {
  icon: typeof Info;
  label: string;
  ph: string;
  type?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600">{label}</label>
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:ring-2 focus-within:ring-emerald-200">
        <Icon size={16} className="text-slate-400" />
        <input
          type={type}
          placeholder={ph}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className="w-full bg-transparent py-2.5 text-sm outline-none"
        />
      </div>
    </div>
  );
}

/* ------------------------------ Become provider ---------------------------- */

export function BecomeProviderPage() {
  const navigate = useNavigate();
  const { register, categories, cities } = useApp();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", email: "", password: "", title: "", categoryId: "", city: "", rate: "60", experience: "5", bio: "" });
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.name && f.email && f.title && f.password.length >= 8 && Number(f.rate) > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) { toast.error("Please fill in your name, email, title, rate and a password (8+ characters)"); return; }
    setBusy(true);
    try {
      const [first, ...rest] = f.name.trim().split(" ");
      await register({
        email: f.email, password: f.password, firstName: first, lastName: rest.join(" "), role: "provider",
        profession: f.title, category: f.categoryId || categories[0]?.id, location: f.city.trim(), hourlyRate: Number(f.rate),
        yearsOfExperience: Number(f.experience), description: f.bio,
      });
      toast.success("Profile submitted!", { description: "You'll appear in search once our team verifies you." });
      navigate("/provider-dashboard");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100"><UserPlus size={14} /> Grow your business</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">Become a FixMate Pro</h1>
        <p className="mx-auto mt-2 max-w-lg text-slate-500">Set up your profile once and start receiving verified local leads.</p>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field icon={IdentificationCard} label="Business / personal name" ph="Rivera Plumbing" value={f.name} onChange={(v) => set("name", v)} />
          <Field icon={Envelope} label="Email" ph="you@email.com" type="email" value={f.email} onChange={(v) => set("email", v)} />
        </div>
        <Field icon={ShieldCheck} label="Password (8+ characters)" ph="••••••••" type="password" value={f.password} onChange={(v) => set("password", v)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Professional title</label>
            <input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Master Plumber" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Primary category</label>
            <select value={f.categoryId || categories[0]?.id} onChange={(e) => set("categoryId", e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">City</label>
            <input list="pro-cities" value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Austin" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />
            <datalist id="pro-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Hourly rate ($)</label>
            <input type="number" value={f.rate} onChange={(e) => set("rate", e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Experience (yrs)</label>
            <input type="number" value={f.experience} onChange={(e) => set("experience", e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">About you</label>
          <textarea value={f.bio} onChange={(e) => set("bio", e.target.value)} rows={4} placeholder="Tell homeowners about your work..." className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50/60 p-3 text-sm text-emerald-800"><Building size={18} /> We verify every pro with ID and background checks before going live.</div>
        <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-95">Create my pro profile <ArrowRight size={16} /></button>
      </form>
    </div>
  );
}

/* ---------------------------------- Help ----------------------------------- */

const FAQ = [
  { q: "How does booking work?", a: "Pick a pro, describe the job, choose a date and time slot, and confirm. The pro accepts or declines your request; you can follow every step from your dashboard." },
  { q: "When can I cancel?", a: "You can cancel a booking while it is pending or accepted. Once a job is in progress it can only be completed." },
  { q: "How are prices calculated?", a: "Estimates are calculated by FixMate from the pro's rates or the service you picked. The pro confirms the final price when the job is completed." },
  { q: "Who can leave reviews?", a: "Only customers with a completed booking can review that booking, once. This keeps ratings honest." },
  { q: "How do I become a pro?", a: "Create a pro profile from the Become a Pro page. Our team reviews every profile before it appears in search." },
];

export function HelpPage() {
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <SectionHeading center eyebrow="Help center" title="How can we help?" subtitle="Answers to the most common questions about booking and working with FixMate pros." />
      <div className="mt-8 space-y-3">
        {FAQ.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer list-none font-semibold text-slate-900">{f.q}</summary>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.a}</p>
          </details>
        ))}
      </div>

      <div id="trust" className="mt-10 scroll-mt-24 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ShieldCheck size={22} className="text-emerald-600" /> Trust & safety</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {["Every pro is reviewed by the FixMate team before appearing in search.", "Reviews come only from customers with a completed booking.", "Messages and bookings stay inside FixMate, so there is always a record."].map((t) => (
            <li key={t} className="flex items-start gap-2"><CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-600" /> {t}</li>
          ))}
        </ul>
      </div>

      <div id="contact" className="mt-6 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <Envelope size={26} className="mx-auto text-emerald-600" />
        <h2 className="mt-2 text-lg font-bold text-slate-900">Still need help?</h2>
        {supportEmail ? (
          <a href={`mailto:${supportEmail}`} className="mt-3 inline-flex rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">Email {supportEmail}</a>
        ) : (
          <p className="mt-1 text-sm text-slate-500">For a question about a job, message your pro directly from your dashboard.</p>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- About ---------------------------------- */

export function AboutPage() {
  const { stats } = useApp();
  const values = [
    { icon: ShieldCheck, t: "Trust first", d: "Every pro is ID and background verified before they can list a single service." },
    { icon: Users, t: "Community", d: "We champion local businesses and keep money in your neighborhood." },
    { icon: SealCheck, t: "Guaranteed", d: "The FixMate guarantee means you only pay when the job is done right." },
  ];
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">Our mission</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900">Making home help effortless</h1>
        <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">FixMate connects homeowners with vetted local professionals in minutes. We believe finding trustworthy help for your home should be simple, transparent, and reliable.</p>
      </motion.div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {values.map((v) => (
          <div key={v.t} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><v.icon size={22} /></span>
            <h3 className="mt-4 font-bold text-slate-900">{v.t}</h3>
            <p className="mt-1 text-sm text-slate-500">{v.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-4 rounded-3xl bg-slate-900 p-8 text-white sm:grid-cols-4">
        {[
          [formatCount(stats?.verifiedProviders), "Verified pros"], [formatCount(stats?.jobsCompleted), "Jobs completed"],
          [stats ? stats.avgRating.toFixed(1) : "–", "Average rating"], [formatCount(stats?.citiesCount), "Cities served"],
        ].map(([v, l]) => (
          <div key={l} className="text-center"><p className="text-3xl font-extrabold">{v}</p><p className="mt-1 text-sm text-slate-400">{l}</p></div>
        ))}
      </div>

      <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <MapPin size={28} className="text-emerald-600" />
        <h2 className="text-xl font-bold text-slate-900">Ready to get started?</h2>
        <p className="max-w-md text-sm text-slate-500">Find your next trusted pro or join as one today.</p>
        <div className="mt-2 flex gap-3">
          <Link to="/explore" className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">Explore pros</Link>
          <Link to="/become-provider" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Become a Pro</Link>
        </div>
      </div>
    </div>
  );
}
