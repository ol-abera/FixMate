import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MagnifyingGlass, MapPin, Star, ShieldCheck, SealCheck, ArrowRight,
  CheckCircle, Clock, CurrencyDollar, ChatCircle, Calendar, Users,
  Lightning, SlidersHorizontal, X, Quotes, Heart, Camera, NavigationArrow,
} from "@phosphor-icons/react";
import { cn } from "../lib/utils";
import { currentPosition, saveOrigin, savedOrigin, type LatLng } from "../lib/geo";
import { toast } from "sonner";
import { useApp, useProviderById } from "../context/AppContext";
import { api, errorMessage } from "../services/api";
import { HOW_IT_WORKS, type Provider, type Review } from "../data/mockData";
import { formatCount } from "../lib/format";
import { SectionHeading, ProviderCard, RatingStars, Avatar } from "../components/Layout";
import { CATEGORY_ICONS } from "../lib/icons";

/* --------------------------------- Home ------------------------------------ */

export function HomePage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const { providers, categories, cities, stats } = useApp();
  const STATS = [
    { label: "Verified pros", value: formatCount(stats?.verifiedProviders) },
    { label: "Jobs completed", value: formatCount(stats?.jobsCompleted) },
    { label: "Avg. rating", value: stats ? stats.avgRating.toFixed(1) : "–" },
    { label: "Cities served", value: formatCount(stats?.citiesCount) },
  ];
  const featured = useMemo(() => [...providers].sort((a, b) => b.rating - a.rating).slice(0, 4), [providers]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/explore?q=${encodeURIComponent(q)}${city ? `&city=${encodeURIComponent(city)}` : ""}`);
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/70 via-white to-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-100">
              <ShieldCheck size={14} /> {stats ? `${formatCount(stats.verifiedProviders)} verified local pros` : "Verified local pros"}
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
              Home repairs, <span className="text-emerald-600">handled</span> by pros you can trust.
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-slate-600">
              Search, compare and book vetted plumbers, electricians, cleaners and more near you — with instant estimates and transparent pricing.
            </p>

            <form onSubmit={submit} className="mt-7 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2 px-2">
                <MagnifyingGlass size={20} className="text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What needs fixing?" className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400" />
              </div>
              <div className="hidden h-6 w-px bg-slate-200 sm:block" />
              <div className="flex items-center gap-2 px-2">
                <MapPin size={20} className="text-slate-400" />
                <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full bg-transparent py-2.5 text-sm text-slate-600 outline-none sm:w-36">
                  <option value="">Any city</option>
                  {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button type="submit" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-95">
                Find pros <ArrowRight size={16} />
              </button>
            </form>

            <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-medium">Popular:</span>
              {categories.slice(0, 5).map((c) => (
                <Link key={c.id} to={`/explore?category=${c.id}`} className="rounded-full bg-white px-3 py-1 font-medium text-slate-600 ring-1 ring-slate-200 transition hover:text-emerald-700 hover:ring-emerald-200">{c.name}</Link>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: "easeOut" }} className="relative">
            <div className="grid grid-cols-2 gap-3">
              {featured.map((p, i) => (
                <div key={p.id} className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm", i % 2 === 1 && "mt-6")}>
                  <img src={p.cover} alt="" className="h-24 w-full object-cover" loading="lazy" />
                  <div className="flex items-center gap-2 p-2.5">
                    <Avatar src={p.avatar} alt={p.name} size={34} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                      <p className="flex items-center gap-1 text-xs text-slate-500"><Star size={11} weight="fill" className="text-amber-400" /> {p.rating}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-4 -left-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle size={18} weight="fill" /></span>
              <div><p className="text-sm font-bold text-slate-900">{formatCount(stats?.jobsCompleted)} jobs</p><p className="text-xs text-slate-500">completed & rated</p></div>
            </motion.div>
          </motion.div>
        </div>

        {/* stats */}
        <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{s.value}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SectionHeading eyebrow="Browse" title="What can we help you fix?" subtitle="Pick a category to instantly compare verified pros near you." />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => {
            const Icon = CATEGORY_ICONS[c.icon] ?? Users;
            return (
              <Link key={c.id} to={`/explore?category=${c.id}`} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-600 group-hover:text-white"><Icon size={22} /></span>
                <p className="mt-3 font-semibold text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-500">{c.providerCount ? `${c.providerCount} ${c.providerCount === 1 ? "pro" : "pros"} · $${c.avgPrice}/hr avg` : "Coming soon"}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured pros */}
      <section className="bg-slate-50/70">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="flex items-end justify-between">
            <SectionHeading eyebrow="Top rated" title="This week's best pros" />
            <Link to="/explore" className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-emerald-700 hover:underline sm:inline-flex">See all <ArrowRight size={15} /></Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((p) => <ProviderCard key={p.id} provider={p} />)}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14 sm:px-6">
        <SectionHeading center eyebrow="Simple" title="Get it fixed in three steps" />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {HOW_IT_WORKS.map((h, i) => {
            const Icon = CATEGORY_ICONS[h.icon] ?? Lightning;
            return (
              <div key={h.title} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="absolute right-5 top-5 text-5xl font-black text-slate-100">{i + 1}</span>
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-600 text-white"><Icon size={24} /></span>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{h.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{h.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Testimonials (real reviews) */}
      {!!stats?.featuredReviews.length && <section className="bg-slate-50/70">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <SectionHeading center eyebrow="Loved by" title="Homeowners trust FixMate" />
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {stats.featuredReviews.map((t) => (
              <figure key={t.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <Quotes size={28} className="text-emerald-200" weight="fill" />
                <RatingStars rating={t.rating} />
                <blockquote className="mt-3 text-sm leading-relaxed text-slate-600">{t.text}</blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  <Avatar src={t.avatar} alt={t.author} size={40} />
                  <div><p className="text-sm font-semibold text-slate-900">{t.author}</p><p className="text-xs text-slate-500">Hired {t.providerName}{t.city ? `, ${t.city}` : ""}</p></div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>}

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-12 text-center shadow-lg sm:px-16">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">Are you a pro? Grow your business with FixMate.</h2>
          <p className="mx-auto mt-2 max-w-xl text-emerald-50">Join thousands of local pros getting verified leads and repeat customers.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/become-provider" className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 shadow transition hover:bg-emerald-50 active:scale-95">Become a provider</Link>
            <Link to="/explore" className="rounded-xl bg-emerald-700/40 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/30 transition hover:bg-emerald-700/60">Browse jobs</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* -------------------------------- Explore ---------------------------------- */

const SORTS = [
  { id: "nearest", label: "Nearest first" },
  { id: "recommended", label: "Recommended" },
  { id: "rating", label: "Top rated" },
  { id: "price_low", label: "Price: low to high" },
];

export function ExplorePage() {
  const [sp] = useSearchParams();
  const { categories, cities } = useApp();
  const [query, setQuery] = useState(sp.get("q") ?? "");
  const [category, setCategory] = useState(sp.get("category") ?? "");
  const [city, setCity] = useState(sp.get("city") ?? "");
  const [maxPrice, setMaxPrice] = useState(150);
  const [minRating, setMinRating] = useState(0);
  const [availableNow, setAvailableNow] = useState(false);
  const [instantOnly, setInstantOnly] = useState(false);
  const [origin, setOrigin] = useState<LatLng | null>(savedOrigin);
  const [radius, setRadius] = useState(0);
  const [locating, setLocating] = useState(false);
  const [sort, setSort] = useState(origin ? "nearest" : "recommended");
  const [showFilters, setShowFilters] = useState(false);

  const locateMe = async () => {
    setLocating(true);
    try {
      const o = await currentPosition();
      saveOrigin(o);
      setOrigin(o);
      setSort("nearest");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't get your location");
    } finally { setLocating(false); }
  };
  const clearLocation = () => {
    saveOrigin(null);
    setOrigin(null);
    setRadius(0);
    if (sort === "nearest") setSort("recommended");
  };

  // Server-side search/filter/pagination (the marketplace only ever returns VERIFIED pros).
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const ordering = sort === "nearest" && origin ? "distance" : sort === "rating" ? "-rating" : sort === "price_low" ? "hourly_rate" : "-rating,-total_reviews";
  const key = JSON.stringify([debouncedQuery, category, city, maxPrice, minRating, availableNow, instantOnly, ordering, origin, radius]);
  const [pageState, setPageState] = useState({ key, page: 1 });
  const page = pageState.key === key ? pageState.page : 1;
  const [results, setResults] = useState<Provider[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.providers({
      search: debouncedQuery, category, location: city,
      max_rate: maxPrice < 150 ? maxPrice : undefined,
      rating: minRating || undefined, available_now: availableNow || undefined, instant_book: instantOnly || undefined,
      ordering, page, page_size: 12,
      lat: origin?.lat, lng: origin?.lng, radius_km: origin && radius ? radius : undefined,
    })
      .then((d) => {
        if (!live) return;
        setTotal(d.count);
        setResults((prev) => (page === 1 ? d.results : [...prev, ...d.results]));
      })
      .catch((e) => { if (live) toast.error(errorMessage(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [key, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => { setQuery(""); setCategory(""); setCity(""); setMaxPrice(150); setMinRating(0); setAvailableNow(false); setInstantOnly(false); setRadius(0); };

  const FilterPanel = (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">Distance</p>
        {origin ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
              <span className="inline-flex items-center gap-1.5"><NavigationArrow size={14} weight="fill" /> Using your location</span>
              <button onClick={clearLocation} className="font-semibold text-emerald-700 hover:underline">Clear</button>
            </div>
            <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Search radius" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200">
              {[0, 5, 10, 25, 50].map((r) => <option key={r} value={r}>{r ? `Within ${r} km` : "Any distance"}</option>)}
            </select>
          </div>
        ) : (
          <button onClick={locateMe} disabled={locating} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-60">
            <NavigationArrow size={15} /> {locating ? "Locating…" : "Use my location"}
          </button>
        )}
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">Category</p>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setCategory("")} className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1 transition", !category ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-slate-600 ring-slate-200 hover:ring-emerald-300")}>All</button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setCategory(c.id)} className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1 transition", category === c.id ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-slate-600 ring-slate-200 hover:ring-emerald-300")}>{c.name}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-800">Max hourly rate: <span className="text-emerald-600">${maxPrice}</span></label>
        <input type="range" min={40} max={150} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full accent-emerald-600" />
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">Minimum rating</p>
        <div className="flex gap-1.5">
          {[0, 4, 4.5, 4.8].map((r) => (
            <button key={r} onClick={() => setMinRating(r)} className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 transition", minRating === r ? "bg-amber-50 text-amber-700 ring-amber-300" : "bg-white text-slate-600 ring-slate-200")}>
              {r === 0 ? "Any" : <><Star size={12} weight="fill" className="text-amber-400" /> {r}+</>}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">City</p>
        <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200">
          <option value="">All cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={availableNow} onChange={(e) => setAvailableNow(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Available now</label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={instantOnly} onChange={(e) => setInstantOnly(e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Instant booking only</label>
      </div>
      <button onClick={reset} className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Reset filters</button>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Explore pros</h1>
          <p className="text-sm text-slate-500">{total} verified pros match your search{origin && radius ? ` within ${radius} km` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm sm:w-72">
            <MagnifyingGlass size={18} className="text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search skills, pros..." className="w-full bg-transparent py-2.5 text-sm outline-none" />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none sm:block">
            {SORTS.filter((s) => s.id !== "nearest" || origin).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button onClick={() => setShowFilters((s) => !s)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 lg:hidden">
            <SlidersHorizontal size={16} /> Filters
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className={cn("lg:block", showFilters ? "block" : "hidden")}>
          <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{FilterPanel}</div>
        </aside>
        <div>
          {loading && results.length === 0 ? (
            <p className="py-20 text-center text-sm text-slate-500">Loading pros…</p>
          ) : results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center">
              <X size={32} className="mx-auto text-slate-300" />
              <p className="mt-3 font-semibold text-slate-700">No pros match those filters</p>
              <p className="text-sm text-slate-500">Try widening your search or resetting filters.</p>
              <button onClick={reset} className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Reset filters</button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((p) => <ProviderCard key={p.id} provider={p} />)}
            </div>
          )}
          {results.length < total && (
            <div className="mt-6 text-center">
              <button disabled={loading} onClick={() => setPageState({ key, page: page + 1 })} className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Provider profile ----------------------------- */

const TABS = ["Overview", "Pricing", "Reviews", "Gallery"];

export function ProviderProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { startConversation, user, getCategory } = useApp();
  const { provider, loading } = useProviderById(id);
  const [tab, setTab] = useState("Overview");
  const [moreReviews, setMoreReviews] = useState<{ page: number; items: Review[]; total: number } | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  useEffect(() => { setMoreReviews(null); }, [id]);

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-24 text-center text-slate-500">Loading…</div>;
  }

  if (!provider) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Pro not found</h1>
        <Link to="/explore" className="mt-4 inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Back to explore <ArrowRight size={15} /></Link>
      </div>
    );
  }

  const cat = getCategory(provider.categoryIds[0]);
  const isOwner = !!user?.providerId && user.providerId === provider.id;
  const reviews = moreReviews?.items ?? provider.reviews;
  const hasMoreReviews = moreReviews ? reviews.length < moreReviews.total : provider.reviewCount > reviews.length;
  const loadMoreReviews = async () => {
    setLoadingReviews(true);
    try {
      // the profile already includes the first page (10 reviews)
      const next = moreReviews ? moreReviews.page + 1 : 2;
      const d = await api.providerReviews(provider.id, next);
      setMoreReviews((m) => ({ page: next, total: d.count, items: [...(m?.items ?? provider.reviews), ...d.results] }));
    } catch (e) { toast.error(errorMessage(e)); } finally { setLoadingReviews(false); }
  };
  const bookPath = (serviceId?: string) => `/book/${provider.id}${serviceId ? `?service=${serviceId}` : ""}`;
  const openChat = async () => {
    try {
      const cid = await startConversation(provider.id);
      navigate(`/messages?c=${cid}`);
    } catch (e) {
      toast.error(errorMessage(e));
      if (!user) navigate("/auth");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link to="/explore" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-emerald-700">← Back to results</Link>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="relative h-40 sm:h-52">
          <img src={provider.cover} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
        <div className="px-5 pb-5 sm:px-8">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <Avatar src={provider.avatar} alt={provider.name} size={96} ring />
              <div className="pb-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold text-slate-900">{provider.name}</h1>
                  {provider.verified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100"><SealCheck size={13} weight="fill" /> Verified</span>}
                </div>
                <p className="text-slate-500">{provider.title} · {cat?.name}</p>
              </div>
            </div>
            {isOwner ? (
              <div className="flex gap-2">
                <Link to="/provider-dashboard/settings" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">Edit my profile</Link>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={openChat} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><ChatCircle size={16} /> Message</button>
                <button onClick={() => navigate(bookPath())} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-95"><Calendar size={16} /> Book now</button>
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Star, label: "Rating", value: `${provider.rating} (${provider.reviewCount})` },
              { icon: CheckCircle, label: "Jobs done", value: provider.jobsCompleted.toLocaleString() },
              { icon: Clock, label: "Responds in", value: `~${provider.responseTimeMins}m` },
              { icon: CurrencyDollar, label: "From", value: `$${provider.hourlyRate}/hr` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-slate-50 p-3">
                <s.icon size={16} className="text-emerald-600" />
                <p className="mt-1 text-sm font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("relative px-4 py-2.5 text-sm font-medium transition", tab === t ? "text-emerald-700" : "text-slate-500 hover:text-slate-800")}>
            {t}
            {tab === t && <motion.span layoutId="tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald-600" />}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {tab === "Overview" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-slate-900">About {provider.name.split(" ")[0]}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{provider.bio}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-slate-900">Skills & services</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {provider.skills.map((s) => <span key={s} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">{s}</span>)}
                </div>
              </div>
            </div>
          )}
          {tab === "Pricing" && (
            <div className="grid gap-4 sm:grid-cols-3">
              {provider.tiers.map((t, i) => {
                const popular = provider.tiers.length >= 3 && i === 1;
                return (
                <div key={t.serviceId ?? t.name} className={cn("flex flex-col rounded-2xl border bg-white p-5 shadow-sm", popular ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200")}>
                  {popular && <span className="mb-2 inline-block w-fit rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">Popular</span>}
                  <p className="text-sm font-semibold text-slate-500">{t.name}</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-900">{t.unit ? "" : "From "}${t.price}<span className="text-sm font-medium text-slate-400">{t.unit}</span></p>
                  <ul className="mt-4 flex-1 space-y-2">
                    {t.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600" /> {f}</li>)}
                  </ul>
                  {!isOwner && <button onClick={() => navigate(bookPath(t.serviceId))} className={cn("mt-5 w-full rounded-lg py-2 text-sm font-semibold transition", popular || provider.tiers.length < 3 ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-slate-200 text-slate-700 hover:bg-slate-50")}>Choose {t.name}</button>}
                </div>
                );
              })}
            </div>
          )}
          {tab === "Reviews" && (
            <div className="space-y-4">
              {reviews.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-500">No reviews yet.</p>}
              {reviews.map((r) => (
                <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><Avatar src={r.avatar} alt={r.author} size={40} /><div><p className="text-sm font-semibold text-slate-900">{r.author}</p><p className="text-xs text-slate-400">{r.date}</p></div></div>
                    <RatingStars rating={r.rating} />
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{r.text}</p>
                </div>
              ))}
              {hasMoreReviews && (
                <button onClick={loadMoreReviews} disabled={loadingReviews} className="w-full rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  {loadingReviews ? "Loading…" : "Show more reviews"}
                </button>
              )}
            </div>
          )}
          {tab === "Gallery" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {provider.gallery.length === 0 && <p className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-500">No photos yet.</p>}
              {provider.gallery.map((g, i) => (
                <div key={i} className="group relative overflow-hidden rounded-xl border border-slate-200">
                  <img src={g} alt="" className="h-32 w-full object-cover transition group-hover:scale-105" loading="lazy" />
                  <Camera size={16} className="absolute bottom-2 right-2 text-white/80 drop-shadow" />
                </div>
              ))}
            </div>
          )}
        </div>

        <aside>
          <div className="sticky top-20 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Starting at</p>
              <p className="text-3xl font-extrabold text-slate-900">${provider.hourlyRate}<span className="text-base font-medium text-slate-400">/hr</span></p>
              <p className="mt-1 text-xs text-slate-500">Min. job ${provider.minJobPrice} · {provider.instantBook ? "Instant booking" : "Request-based"}</p>
              {!isOwner && <><button onClick={() => navigate(bookPath())} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-95">Book {provider.name.split(" ")[0]} <ArrowRight size={16} /></button>
              <button onClick={openChat} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ChatCircle size={16} /> Ask a question</button></>}
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-800">
              <ShieldCheck size={20} className="shrink-0" /> <span>Backed by the FixMate guarantee — you only pay when the job is done.</span>
            </div>
            {!!provider.favoritesCount && (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                <Heart size={18} className="text-rose-500" weight="fill" /> <span>Saved by {provider.favoritesCount} {provider.favoritesCount === 1 ? "homeowner" : "homeowners"}</span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}