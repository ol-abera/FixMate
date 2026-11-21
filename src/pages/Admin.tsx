import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowSquareOut, Calendar, CheckCircle, CurrencyDollar, Eye, EyeSlash, SealCheck, ShieldCheck, Star, Users, X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { formatCount } from "../lib/format";
import { useApp } from "../context/AppContext";
import { api, DJANGO_ADMIN_URL, errorMessage, type AdminStats, type ModerationReview } from "../services/api";
import { Avatar, EmptyState, RatingStars, StatusBadge } from "../components/Layout";
import type { BookingStatus, Provider } from "../data/mockData";
import { Modal, StatCard } from "./Dashboards";

const STATUS_ORDER: { key: string; label: string; bar: string }[] = [
  { key: "PENDING", label: "Pending", bar: "bg-amber-400" },
  { key: "ACCEPTED", label: "Accepted", bar: "bg-sky-500" },
  { key: "IN_PROGRESS", label: "In progress", bar: "bg-indigo-500" },
  { key: "COMPLETED", label: "Completed", bar: "bg-emerald-500" },
  { key: "CANCELLED", label: "Cancelled", bar: "bg-slate-400" },
  { key: "DECLINED", label: "Declined", bar: "bg-rose-400" },
];

function Panel({ title, subtitle, action, children, className }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-slate-900">{title}</p>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function RejectDialog({ provider, onDone, onClose }: { provider: Provider; onDone: () => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.rejectProvider(provider.id, reason.trim());
      toast.success(`${provider.name} was rejected`, { description: "They've been notified." });
      onDone();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Reject ${provider.name}?`} onClose={onClose}>
      <p className="mt-1 text-sm text-slate-500">They won't appear in the marketplace. The reason is included in their notification.</p>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} placeholder="e.g. License photo is unreadable."
        className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Keep pending</button>
        <button onClick={submit} disabled={busy} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">Reject provider</button>
      </div>
    </Modal>
  );
}

export function AdminDashboard() {
  const { user, bookings, getCategory, refreshBookings } = useApp();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pending, setPending] = useState<Provider[] | null>(null);
  const [rejecting, setRejecting] = useState<Provider | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"all" | "low" | "hidden">("low");
  const [reviews, setReviews] = useState<ModerationReview[] | null>(null);

  const load = useCallback(() => {
    api.adminDashboard().then(setStats).catch((e) => toast.error(errorMessage(e)));
    api.pendingProviders().then(setPending).catch((e) => toast.error(errorMessage(e)));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    setReviews(null);
    api.moderationReviews(reviewFilter).then(setReviews).catch((e) => toast.error(errorMessage(e)));
  }, [reviewFilter]);

  const verify = async (p: Provider) => {
    try {
      await api.verifyProvider(p.id);
      toast.success(`${p.name} is now verified`, { description: "They're live in the marketplace." });
      load();
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const togglePublished = async (r: ModerationReview) => {
    try {
      await api.setReviewPublished(r.id, !r.published);
      toast.success(r.published ? "Review hidden" : "Review published", { description: "The pro's rating was recalculated." });
      setReviews((list) => (list ?? []).map((x) => (x.id === r.id ? { ...x, published: !r.published } : x)).filter((x) => reviewFilter !== "hidden" || !x.published));
      load();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const daily = (stats?.daily ?? []).map((d) => ({
    day: new Date(d.day + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" }),
    bookings: d.bookings, value: Number(d.completed_value),
  }));
  const statusTotal = Object.values(stats?.bookings_by_status ?? {}).reduce((a, b) => a + b, 0) || 1;
  const recent = [...bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-900 text-white"><ShieldCheck size={24} /></span>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Admin console</h1>
            <p className="text-sm text-slate-500">Signed in as {user?.email}. Verify pros, moderate reviews and watch platform health.</p>
          </div>
        </div>
        <a href={DJANGO_ADMIN_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Django admin <ArrowSquareOut size={15} />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={Users} label={`Users · ${formatCount(stats?.customers)} customers`} value={formatCount(stats?.users)} />
        <StatCard icon={SealCheck} label={`Pros · ${stats?.pending_providers ?? "–"} pending`} value={formatCount(stats?.providers)} accent="bg-amber-50 text-amber-600" />
        <StatCard icon={Calendar} label={`Bookings · ${formatCount(stats?.completed_bookings)} completed`} value={formatCount(stats?.bookings)} accent="bg-indigo-50 text-indigo-600" />
        <StatCard icon={CurrencyDollar} label="Completed job value" value={stats ? `$${formatCount(Math.round(Number(stats.gmv)))}` : "–"} />
        <StatCard icon={Star} label={`Avg rating · ${formatCount(stats?.reviews)} reviews`} value={stats ? Number(stats.avg_rating).toFixed(1) : "–"} accent="bg-rose-50 text-rose-500" />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Pending verification" subtitle="New pros only appear in the marketplace once verified."
          action={<span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">{pending?.length ?? 0} waiting</span>}>
          {pending === null ? <p className="text-sm text-slate-400">Loading…</p> : pending.length === 0 ? (
            <EmptyState icon={CheckCircle} title="All caught up" hint="No pros are waiting for verification." />
          ) : (
            <div className="space-y-3">
              {pending.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={p.avatar} alt={p.name} size={44} />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{p.name} <span className="font-normal text-slate-500">· {p.title}</span></p>
                      <p className="text-xs text-slate-500">
                        {[p.city, p.categoryIds.map((c) => getCategory(c)?.name ?? c).join(", "), `${p.yearsExperience} yrs`, `$${p.hourlyRate}/hr`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link to={`/providers/${p.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">View profile</Link>
                    <button onClick={() => setRejecting(p)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"><X size={13} /> Reject</button>
                    <button onClick={() => verify(p)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"><SealCheck size={13} /> Verify</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Bookings by status">
          <div className="space-y-2.5">
            {STATUS_ORDER.map((s) => {
              const n = stats?.bookings_by_status[s.key] ?? 0;
              return (
                <div key={s.key}>
                  <div className="flex justify-between text-xs"><span className="text-slate-600">{s.label}</span><span className="font-semibold text-slate-800">{n}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className={cn("h-1.5 rounded-full", s.bar)} style={{ width: `${(n / statusTotal) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
          <p className="mb-2 mt-6 text-sm font-bold text-slate-900">Newest accounts</p>
          <div className="space-y-2">
            {(stats?.recent_signups ?? []).map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-slate-700">{u.name || u.email}</span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-600">{u.role.toLowerCase()}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Last 14 days" subtitle="New booking requests per day">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily}>
                <defs><linearGradient id="adm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#059669" stopOpacity={0.35} /><stop offset="100%" stopColor="#059669" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={1} />
                <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(v: number, k: string) => (k === "bookings" ? [v, "Bookings"] : [`$${v}`, "Completed value"])} />
                <Area type="monotone" dataKey="bookings" stroke="#059669" strokeWidth={2} fill="url(#adm)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Recent bookings" action={<button onClick={refreshBookings} className="text-xs font-semibold text-emerald-700 hover:underline">Refresh</button>}>
          {recent.length === 0 ? <p className="text-sm text-slate-400">No bookings yet.</p> : (
            <div className="space-y-2.5">
              {recent.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{b.serviceName}</p>
                    <p className="truncate text-xs text-slate-500">{b.customerName} → {b.providerName} · {b.date}</p>
                  </div>
                  <StatusBadge status={b.status as BookingStatus} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-6" title="Review moderation" subtitle="Hidden reviews disappear from profiles and stop counting toward ratings."
        action={
          <div className="grid grid-cols-3 rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
            {([["low", "Low ratings"], ["all", "All"], ["hidden", "Hidden"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setReviewFilter(k)} className={cn("rounded-md px-3 py-1.5 transition", reviewFilter === k ? "bg-white text-slate-900 shadow" : "text-slate-500")}>{label}</button>
            ))}
          </div>
        }>
        {reviews === null ? <p className="text-sm text-slate-400">Loading…</p> : reviews.length === 0 ? (
          <EmptyState icon={Star} title={reviewFilter === "hidden" ? "No hidden reviews" : "Nothing to review"} hint={reviewFilter === "low" ? "No reviews rated 2 stars or lower." : undefined} />
        ) : (
          <div className="divide-y divide-slate-100">
            {reviews.map((r) => (
              <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <RatingStars rating={r.rating} size={13} />
                    <span className="text-sm font-semibold text-slate-800">{r.author}</span>
                    <span className="text-xs text-slate-400">on <Link to={`/providers/${r.providerId}`} className="hover:underline">{r.providerName}</Link> · {r.date}</span>
                    {!r.published && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Hidden</span>}
                  </div>
                  <p className={cn("mt-1 text-sm", r.published ? "text-slate-600" : "text-slate-400 line-through")}>{r.text || <em>No comment</em>}</p>
                </div>
                <button onClick={() => togglePublished(r)} className={cn("inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold",
                  r.published ? "border-slate-200 text-slate-600 hover:bg-slate-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50")}>
                  {r.published ? <><EyeSlash size={13} /> Hide</> : <><Eye size={13} /> Publish</>}
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {rejecting && <RejectDialog provider={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); load(); }} />}
    </div>
  );
}
