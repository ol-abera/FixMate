import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  MagnifyingGlass, Bell, Heart, List as ListIcon, X, User as UserIcon,
  SealCheck, Star, MapPin, ArrowRight, ChatCircle, CheckCircle, Clock,
  CurrencyDollar, ShieldCheck, CaretDown, SignOut, House, Wrench,
  Info, Lightning,
} from "@phosphor-icons/react";
import { cn } from "../lib/utils";
import { notificationLink } from "../lib/links";
import { useApp } from "../context/AppContext";
import { getCategory, type BookingStatus, type Provider } from "../data/mockData";
import { toast } from "sonner";

/* ----------------------------- shared primitives ---------------------------- */

export function SectionHeading({
  eyebrow, title, subtitle, center,
}: { eyebrow?: string; title: string; subtitle?: string; center?: boolean }) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-slate-500">{subtitle}</p>}
    </div>
  );
}

export function RatingStars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          size={size}
          weight={i < Math.round(rating) ? "fill" : "regular"}
          className={i < Math.round(rating) ? "text-amber-400" : "text-slate-300"}
        />
      ))}
    </span>
  );
}

const STATUS_META: Record<BookingStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 ring-amber-200", Icon: Clock },
  accepted: { label: "Accepted", cls: "bg-sky-50 text-sky-700 ring-sky-200", Icon: CheckCircle },
  in_progress: { label: "In progress", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200", Icon: Lightning },
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", Icon: SealCheck },
  declined: { label: "Declined", cls: "bg-rose-50 text-rose-700 ring-rose-200", Icon: X },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-600 ring-slate-200", Icon: X },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1", m.cls)}>
      <m.Icon size={13} weight="bold" />
      {m.label}
    </span>
  );
}

export function Avatar({ src, alt, size = 40, ring }: { src: string; alt: string; size?: number; ring?: boolean }) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("rounded-full object-cover bg-slate-100", ring && "ring-2 ring-white shadow")}
      loading="lazy"
    />
  );
}

export function EmptyState({ icon: Icon = Info, title, hint, action }: {
  icon?: typeof Info; title: string; hint?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-slate-100">
        <Icon size={22} />
      </div>
      <p className="mt-3 font-semibold text-slate-700">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ProviderCard({ provider }: { provider: Provider }) {
  const { favorites, toggleFavorite } = useApp();
  const fav = favorites.includes(provider.id);
  const cat = getCategory(provider.categoryIds[0]);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative h-28 overflow-hidden">
        <img src={provider.cover} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
        <button
          onClick={async () => { const now = await toggleFavorite(provider.id); if (now === null) return; toast.success(now ? "Saved to favorites" : "Removed from favorites"); }}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-slate-500 shadow backdrop-blur transition hover:text-rose-500"
          aria-label="Toggle favorite"
        >
          <Heart size={16} weight={fav ? "fill" : "regular"} className={fav ? "text-rose-500" : ""} />
        </button>
        {provider.availableNow && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow">
            <span className="h-1.5 w-1.5 rounded-full bg-white" /> Available now
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-3">
          <Avatar src={provider.avatar} alt={provider.name} size={44} ring />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="truncate font-semibold text-slate-900">{provider.name}</h3>
              {provider.verified && <SealCheck size={16} weight="fill" className="shrink-0 text-emerald-600" />}
            </div>
            <p className="truncate text-sm text-slate-500">{provider.title}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><RatingStars rating={provider.rating} /> <b className="text-slate-700">{provider.rating}</b> ({provider.reviewCount})</span>
          {provider.distanceKm > 0 ? <span className="inline-flex items-center gap-1"><MapPin size={13} /> {provider.distanceKm} km</span> : <span className="inline-flex items-center gap-1"><MapPin size={13} /> {provider.city}</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {provider.skills.slice(0, 3).map((s) => (
            <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{s}</span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="text-sm">
            <b className="text-slate-900">${provider.hourlyRate}</b>
            <span className="text-slate-400">/hr</span>
            <span className="ml-1 text-xs text-slate-400">{cat?.name}</span>
          </div>
          <Link
            to={`/providers/${provider.id}`}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-95"
          >
            View <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

/* --------------------------------- Navbar ---------------------------------- */

function NotificationsMenu() {
  const { notifications, unreadCount, markAllRead, markRead, user } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = notifications.slice(0, 5);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-10 w-10 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="font-semibold text-slate-900">Notifications</p>
              <button onClick={() => markAllRead()} className="text-xs font-medium text-emerald-600 hover:underline">Mark all read</button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">You are all caught up.</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => { markRead(n.id); setOpen(false); navigate(notificationLink(n, user)); }}
                    className={cn("flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50", !n.read && "bg-emerald-50/40")}
                  >
                    <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full",
                      n.type === "booking" ? "bg-sky-100 text-sky-600" : n.type === "message" ? "bg-violet-100 text-violet-600" : "bg-emerald-100 text-emerald-600")}>
                      {n.type === "booking" ? <CheckCircle size={16} /> : n.type === "message" ? <ChatCircle size={16} /> : <Info size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800">{n.title}</span>
                      <span className="block truncate text-xs text-slate-500">{n.body}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">{n.time}</span>
                    </span>
                    {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                  </button>
                ))
              )}
            </div>
            <button onClick={() => { setOpen(false); navigate("/notifications"); }} className="block w-full bg-slate-50 py-2.5 text-center text-sm font-medium text-slate-600 hover:bg-slate-100">
              View all
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout, favorites } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const go = (p: string) => { setOpen(false); navigate(p); };
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-slate-100">
        {user ? <Avatar src={user.avatar} alt={user.name} size={32} /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-slate-500"><UserIcon size={16} /></span>}
        <CaretDown size={14} className="text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1.5 shadow-xl">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="font-semibold text-slate-900">{user ? user.name : "Guest"}</p>
              <p className="text-xs capitalize text-slate-500">{user ? user.role : "Not signed in"}</p>
            </div>
            <div className="border-t border-slate-100 px-1.5 py-1.5">
              {user?.role === "customer" && (
                <button onClick={() => go("/customer-dashboard")} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"><House size={16} /> Customer dashboard</button>
              )}
              {user?.role === "provider" && (
                <button onClick={() => go("/provider-dashboard")} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"><CurrencyDollar size={16} /> Provider dashboard</button>
              )}
              <button onClick={() => go("/messages")} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"><ChatCircle size={16} /> Messages</button>
              {user?.role === "customer" && (
                <button onClick={() => go("/favorites")} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"><Heart size={16} /> Favorites ({favorites.length})</button>
              )}
              {user && <button onClick={() => go("/notifications")} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"><Bell size={16} /> Notifications</button>}
              {!user && <button onClick={() => go("/auth")} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"><UserIcon size={16} /> Sign in</button>}
              {user && <button onClick={() => { logout(); setOpen(false); navigate("/"); toast.info("Signed out"); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-rose-600 hover:bg-rose-50"><SignOut size={16} /> Sign out</button>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/explore", label: "Explore" },
  { to: "/become-provider", label: "Become a Pro" },
  { to: "/about", label: "About" },
];

export function Navbar() {
  const { user } = useApp();
  const [mobile, setMobile] = useState(false);
  const navigate = useNavigate();
  const loc = useLocation();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-200"><Wrench size={20} weight="fill" /></span>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">Fix<span className="text-emerald-600">Mate</span></span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.to} to={l.to}
              className={cn("rounded-lg px-3 py-2 text-sm font-medium transition",
                loc.pathname === l.to ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-100")}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <button onClick={() => navigate("/explore")} className="hidden h-10 w-10 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 sm:grid" aria-label="Search">
            <MagnifyingGlass size={20} />
          </button>
          <Link to="/messages" className="hidden h-10 w-10 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 sm:grid" aria-label="Messages">
            <ChatCircle size={20} />
          </Link>
          <NotificationsMenu />
          <UserMenu />
          {!user && (
            <Link to="/auth" className="ml-1 hidden rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 sm:inline-flex">
              Sign in
            </Link>
          )}
          <button onClick={() => setMobile((m) => !m)} className="grid h-10 w-10 place-items-center rounded-full text-slate-700 hover:bg-slate-100 md:hidden" aria-label="Menu">
            {mobile ? <X size={22} /> : <ListIcon size={22} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobile && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden border-t border-slate-100 bg-white md:hidden"
          >
            <div className="space-y-1 px-4 py-3">
              {NAV_LINKS.map((l) => (
                <Link key={l.to} to={l.to} onClick={() => setMobile(false)}
                  className={cn("block rounded-lg px-3 py-2.5 text-sm font-medium",
                    loc.pathname === l.to ? "bg-emerald-50 text-emerald-700" : "text-slate-700 hover:bg-slate-50")}>
                  {l.label}
                </Link>
              ))}
              {user && <Link to="/messages" onClick={() => setMobile(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Messages</Link>}
              {!user && <Link to="/auth" onClick={() => setMobile(false)} className="mt-2 block rounded-lg bg-emerald-600 px-3 py-2.5 text-center text-sm font-semibold text-white">Sign in</Link>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* --------------------------------- Footer ---------------------------------- */

export function Footer() {
  const cols = [
    { title: "Company", links: [["About", "/about"], ["How it works", "/#how-it-works"]] },
    { title: "For customers", links: [["Explore pros", "/explore"], ["Favorites", "/favorites"], ["Trust & safety", "/help#trust"]] },
    { title: "For pros", links: [["Become a provider", "/become-provider"], ["Pro dashboard", "/provider-dashboard"]] },
    { title: "Support", links: [["Help center", "/help"], ["Contact", "/help#contact"]] },
  ];
  return (
    <footer className="mt-20 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-white"><Wrench size={18} weight="fill" /></span>
              <span className="text-lg font-extrabold tracking-tight text-slate-900">Fix<span className="text-emerald-600">Mate</span></span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-slate-500">The trusted marketplace connecting homeowners with verified local pros. Book in minutes, get it fixed.</p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <p className="text-sm font-semibold text-slate-900">{c.title}</p>
              <ul className="mt-3 space-y-2">
                {c.links.map(([l, to]) => (
                  <li key={l}><Link to={to} className="text-sm text-slate-500 transition hover:text-emerald-600">{l}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 text-sm text-slate-400 sm:flex-row">
          <p>© 2026 FixMate Inc. All rights reserved.</p>
          <p className="inline-flex items-center gap-1.5"><ShieldCheck size={16} className="text-emerald-600" /> Every pro is ID & background verified</p>
        </div>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
