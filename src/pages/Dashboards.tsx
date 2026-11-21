import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  House, CurrencyDollar, TrendUp, Star, Calendar, CheckCircle, X, ChatCircle,
  Wrench, Clock, Users, Gear, MapPin, ArrowRight, SealCheck, Bell,
} from "@phosphor-icons/react";
import { cn } from "../lib/utils";
import { useApp } from "../context/AppContext";
import { api, errorMessage } from "../services/api";
import { getCategory } from "../data/mockData";
import { Avatar, ProviderCard, RatingStars, StatusBadge, SectionHeading, EmptyState } from "../components/Layout";
import { toast } from "sonner";

const ACTIVE_STATUSES = ["pending", "accepted", "in_progress"];

interface ProviderDash {
  stats: { rating: string | number; total_reviews: number };
  earnings: { total: string | number; last_7_days: string | number; daily: { day: string; amount: string | number }[] };
  recent_reviews: { id: number; author: string; rating: number; comment: string }[];
}

function ReviewDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { submitReview } = useApp();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await submitReview(id, rating, comment);
      toast.success("Thanks for your review!");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-lg font-bold text-slate-900">Rate your pro</p>
        <div className="mt-3 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
              <Star size={28} weight={n <= rating ? "fill" : "regular"} className={n <= rating ? "text-amber-400" : "text-slate-300"} />
            </button>
          ))}
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} placeholder="How did it go?" className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50">Cancel</button>
          <button onClick={send} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Submit review</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, trend, accent }: { icon: typeof House; label: string; value: string; trend?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className={cn("grid h-10 w-10 place-items-center rounded-xl", accent ?? "bg-emerald-50 text-emerald-600")}><Icon size={20} /></span>
        {trend && <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600"><TrendUp size={13} /> {trend}</span>}
      </div>
      <p className="mt-3 text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

/* --------------------------- Customer dashboard ---------------------------- */

export function CustomerDashboard() {
  const { bookings, user, favorites, providers, ready, startConversation } = useApp();
  const navigate = useNavigate();
  const [reviewing, setReviewing] = useState<string | null>(null);
  if (ready && (!user || user.role !== "customer")) return <Navigate to="/auth" replace />;
  const mine = bookings; // already scoped to the signed-in customer by the API
  const favProviders = providers.filter((p) => favorites.includes(p.id));
  const completedJobs = mine.filter((b) => b.status === "completed");
  const openChat = async (providerId: string) => {
    try { navigate(`/messages?c=${await startConversation(providerId)}`); } catch (e) { toast.error(errorMessage(e)); }
  };
  const recommended = providers.filter((p) => !favorites.includes(p.id)).sort((a, b) => b.rating - a.rating).slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <Avatar src={user?.avatar ?? providers[0]?.avatar ?? ""} alt="me" size={48} />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Welcome back, {user?.name?.split(" ")[0] ?? "friend"}</h1>
          <p className="text-sm text-slate-500">Track your bookings and find your next trusted pro.</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Calendar} label="Active bookings" value={String(mine.filter((b) => ACTIVE_STATUSES.includes(b.status)).length)} />
        <StatCard icon={CheckCircle} label="Completed" value={String(completedJobs.length)} accent="bg-sky-50 text-sky-600" />
        <StatCard icon={Star} label="Avg. spend" value={`$${Math.round(completedJobs.reduce((s, b) => s + b.estimate, 0) / (completedJobs.length || 1))}`} accent="bg-amber-50 text-amber-600" />
        <StatCard icon={Users} label="Saved pros" value={String(favorites.length)} accent="bg-rose-50 text-rose-600" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionHeading title="Your bookings" />
          <div className="mt-4 space-y-4">
            {mine.length === 0 ? (
              <EmptyState icon={Calendar} title="No bookings yet" hint="Find a pro and book your first job." action={<Link to="/explore" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Explore pros</Link>} />
            ) : mine.map((b) => (
              <div key={b.id} id={`booking-${b.id}`} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Wrench size={20} /></span>
                    <div>
                      <p className="font-bold text-slate-900">{b.serviceName}</p>
                      <p className="text-sm text-slate-500">{b.providerName} · {getCategory(b.categoryId)?.name}</p>
                    </div>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><Calendar size={14} /> {b.date} · {b.timeSlot}</span>
                  <span className="inline-flex items-center gap-1"><MapPin size={14} /> {b.address}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-700"><CurrencyDollar size={14} /> ${b.estimate}</span>
                </div>
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between">
                    {b.timeline.map((t, i) => (
                      <div key={i} className="flex flex-1 items-center">
                        <div className="flex flex-col items-center">
                          <span className={cn("grid h-6 w-6 place-items-center rounded-full", i === b.timeline.length - 1 ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-600")}><CheckCircle size={13} weight="fill" /></span>
                          <span className="mt-1 hidden text-[10px] text-slate-400 sm:block">{t.time}</span>
                        </div>
                        {i < b.timeline.length - 1 && <div className="mx-1 h-0.5 flex-1 bg-emerald-200" />}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link to={`/providers/${b.providerId}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">View pro</Link>
                  <button onClick={() => openChat(b.providerId)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><ChatCircle size={14} /> Message</button>
                  {b.status === "completed" && b.canReview && <button onClick={() => setReviewing(b.id)} className="ml-auto rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">Leave review</button>}
                  {b.status === "completed" && b.hasReview && <span className="ml-auto text-xs font-medium text-emerald-600">Reviewed</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p id="favorites" className="font-bold text-slate-900">Saved pros</p>
              <Link to="/favorites" className="text-xs font-semibold text-emerald-700">View all</Link>
            </div>
            <div className="mt-3 space-y-3">
              {favProviders.length === 0 ? <p className="text-sm text-slate-400">No favorites yet.</p> : favProviders.map((p) => (
                <Link key={p.id} to={`/providers/${p.id}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-50">
                  <Avatar src={p.avatar} alt={p.name} size={40} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{p.name}</p><p className="flex items-center gap-1 text-xs text-slate-500"><Star size={11} weight="fill" className="text-amber-400" /> {p.rating} · ${p.hourlyRate}/hr</p></div>
                  <ArrowRight size={16} className="text-slate-300" />
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
            <p className="font-bold text-slate-900">Need it done fast?</p>
            <p className="mt-1 text-sm text-slate-600">Pros available now can be booked instantly.</p>
            <Link to="/explore" className="mt-3 inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Find available pros <ArrowRight size={14} /></Link>
          </div>
        </aside>
      </div>

      <div className="mt-10">
        <SectionHeading eyebrow="For you" title="Recommended pros" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{recommended.map((p) => <ProviderCard key={p.id} provider={p} />)}</div>
      </div>
      {reviewing && <ReviewDialog id={reviewing} onClose={() => setReviewing(null)} />}
    </div>
  );
}

/* -------------------------------- Favorites -------------------------------- */

export function FavoritesPage() {
  const { user, ready, favorites, providers } = useApp();
  if (ready && (!user || user.role !== "customer")) return <Navigate to="/auth" replace />;
  const saved = providers.filter((p) => favorites.includes(p.id));
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <SectionHeading title="Saved pros" subtitle="Pros you have favorited, ready to book again." />
      <div className="mt-6">
        {saved.length === 0 ? (
          <EmptyState icon={Star} title="No favorites yet" hint="Tap the heart on any pro to save them here." action={<Link to="/explore" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Explore pros</Link>} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{saved.map((p) => <ProviderCard key={p.id} provider={p} />)}</div>
        )}
      </div>
    </div>
  );
}

/* --------------------------- Provider dashboard ---------------------------- */

export function ProviderDashboard() {
  const { bookings, updateBookingStatus, user, providers, ready } = useApp();
  const mine = bookings; // already scoped to the signed-in provider by the API
  const [dash, setDash] = useState<ProviderDash | null>(null);
  useEffect(() => {
    if (user?.role !== "provider") return;
    api.providerDashboard().then(setDash).catch((e) => console.error(errorMessage(e)));
  }, [user?.id, user?.role, bookings]);
  if (ready && (!user || user.role !== "provider")) return <Navigate to="/auth" replace />;
  const earningsData = (dash?.earnings.daily ?? []).map((d) => ({ day: d.day, amt: Number(d.amount) }));
  const pending = mine.filter((b) => b.status === "pending");
  const active = mine.filter((b) => b.status === "accepted" || b.status === "in_progress");
  const revenue = dash ? Number(dash.earnings.last_7_days) : 0;

  const respond = async (id: string, ok: boolean) => {
    await updateBookingStatus(id, ok ? "accepted" : "declined");
    toast[ok ? "success" : "info"](ok ? "Request accepted" : "Request declined");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar src={user?.avatar ?? providers[0]?.avatar ?? ""} alt="pro" size={48} />
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">{user?.name ?? "Alex Rivera"} {user?.role === "provider" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100"><SealCheck size={13} weight="fill" /> Pro</span>}</h1>
            <p className="text-sm text-slate-500">Your jobs, leads and earnings at a glance.</p>
          </div>
        </div>
        <Link to="/provider-dashboard/settings" onClick={(e) => { e.preventDefault(); toast.info("Profile settings coming soon"); }} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Gear size={16} /> Edit profile</Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CurrencyDollar} label="Revenue (7d)" value={`$${revenue.toLocaleString()}`} />
        <StatCard icon={Bell} label="New requests" value={String(pending.length)} accent="bg-amber-50 text-amber-600" />
        <StatCard icon={Clock} label="Active jobs" value={String(active.length)} accent="bg-indigo-50 text-indigo-600" />
        <StatCard icon={Star} label="Rating" value={dash ? Number(dash.stats.rating).toFixed(1) : "–"} accent="bg-rose-50 text-rose-600" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-900">Incoming requests</p>
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">{pending.length} pending</span>
            </div>
            <div className="mt-4 space-y-3">
              {pending.length === 0 ? <EmptyState icon={CheckCircle} title="No pending requests" hint="New booking requests will appear here." /> : pending.map((b) => (
                <div key={b.id} id={`booking-${b.id}`} className="scroll-mt-24 rounded-xl border border-slate-200 p-4 transition">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{b.serviceName}</p>
                      <p className="text-sm text-slate-500">{b.customerName} · {b.date} {b.timeSlot}</p>
                      <p className="mt-1 text-sm text-slate-500">{b.description}</p>
                    </div>
                    <div className="text-right"><p className="text-lg font-extrabold text-emerald-700">${b.estimate}</p><p className="text-xs text-slate-400">estimate</p></div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => respond(b.id, true)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><CheckCircle size={15} /> Accept</button>
                    <button onClick={() => respond(b.id, false)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"><X size={15} /> Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-bold text-slate-900">Active jobs</p>
            <div className="mt-4 space-y-3">
              {active.length === 0 ? <p className="text-sm text-slate-400">No active jobs right now.</p> : active.map((b) => (
                <div key={b.id} id={`booking-${b.id}`} className="flex scroll-mt-24 items-center justify-between rounded-xl border border-slate-200 p-4 transition">
                  <div><p className="font-semibold text-slate-900">{b.serviceName}</p><p className="text-sm text-slate-500">{b.customerName} · {b.address}</p></div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={b.status} />
                    {b.status === "accepted" && <button onClick={() => updateBookingStatus(b.id, "in_progress")} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">Start job</button>}
                    {b.status === "in_progress" && <button onClick={() => updateBookingStatus(b.id, "completed")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Mark complete</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-bold text-slate-900">This week</p>
            <p className="text-xs text-slate-500">Earnings trend</p>
            <div className="mt-3 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={earningsData}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#059669" stopOpacity={0.35} /><stop offset="100%" stopColor="#059669" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(v: number) => [`$${v}`, "Earned"]} />
                  <Area type="monotone" dataKey="amt" stroke="#059669" strokeWidth={2} fill="url(#g)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-bold text-slate-900">Recent reviews</p>
            <div className="mt-3 space-y-3">
              {(dash?.recent_reviews ?? []).map((r) => ({ n: r.author, r: r.rating, t: r.comment })).map((rv) => (
                <div key={rv.n} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-800">{rv.n}</p><RatingStars rating={rv.r} /></div>
                  <p className="mt-1 text-sm text-slate-600">{rv.t}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
