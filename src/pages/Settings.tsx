import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Camera, CheckCircle, FloppyDisk, Key, PencilSimple, Plus, Trash, UploadSimple, User as UserIcon, X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { useApp } from "../context/AppContext";
import { api, errorMessage } from "../services/api";
import { Avatar, SectionHeading } from "../components/Layout";
import type { Availability, Provider, ProviderService } from "../data/mockData";

/* ------------------------------ small helpers ------------------------------ */

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200";

function Labeled({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-slate-600">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Card({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SaveButton({ busy, label = "Save changes" }: { busy: boolean; label?: string }) {
  return (
    <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-95 disabled:opacity-60">
      <FloppyDisk size={16} /> {busy ? "Saving…" : label}
    </button>
  );
}

/** Hidden file input + trigger; images only, matching the backend validator. */
function useImagePicker(onPick: (f: File) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }} />
  );
  return { input, open: () => ref.current?.click() };
}

/* ----------------------------- Account settings ---------------------------- */

function PasswordCard() {
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.next.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (f.next !== f.confirm) { toast.error("New passwords don't match"); return; }
    setBusy(true);
    try {
      await api.changePassword(f.current, f.next);
      setF({ current: "", next: "", confirm: "" });
      toast.success("Password changed", { description: "Other devices have been signed out." });
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <Card title="Password" subtitle="Changing it signs you out everywhere else.">
      <form onSubmit={submit} className="space-y-4">
        <Labeled label="Current password">
          <input type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} className={inputCls} />
        </Labeled>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="New password" hint="At least 8 characters, not too common.">
            <input type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} className={inputCls} />
          </Labeled>
          <Labeled label="Confirm new password">
            <input type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} className={inputCls} />
          </Labeled>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Link to="/forgot-password" className="text-xs font-semibold text-emerald-700 hover:underline">Forgot your current password?</Link>
          <button type="submit" disabled={busy || !f.current} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-95 disabled:opacity-60">
            <Key size={16} /> {busy ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </Card>
  );
}

export function AccountSettingsPage() {
  const { user, setUser } = useApp();
  const [f, setF] = useState({ firstName: "", lastName: "", phone: "", location: "", bio: "" });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) setF({ firstName: user.firstName ?? "", lastName: user.lastName ?? "", phone: user.phone ?? "", location: user.location ?? "", bio: user.bio ?? "" });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const avatar = useImagePicker(async (file) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("profile_image", file);
      setUser(await api.updateMe(form));
      toast.success("Photo updated");
    } catch (e) { toast.error(errorMessage(e)); } finally { setUploading(false); }
  });

  if (!user) return null;

  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.firstName.trim()) { toast.error("First name is required"); return; }
    setBusy(true);
    try {
      setUser(await api.updateMe({ first_name: f.firstName.trim(), last_name: f.lastName.trim(), phone: f.phone.trim(), location: f.location.trim(), bio: f.bio }));
      toast.success("Account updated");
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <SectionHeading title="Account settings" subtitle={`Signed in as ${user.email}`} />
      <Card title="Profile photo" subtitle="JPG, PNG or WEBP up to 5 MB.">
        <div className="flex items-center gap-4">
          <Avatar src={user.avatar} alt={user.name} size={72} ring />
          {avatar.input}
          <button onClick={avatar.open} disabled={uploading} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <Camera size={16} /> {uploading ? "Uploading…" : user.hasAvatar ? "Change photo" : "Upload photo"}
          </button>
        </div>
      </Card>
      <Card title="Personal details">
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Labeled label="First name"><input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} className={inputCls} /></Labeled>
            <Labeled label="Last name"><input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} className={inputCls} /></Labeled>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Labeled label="Phone"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(512) 555-0100" className={inputCls} /></Labeled>
            <Labeled label="City"><input value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="Austin" className={inputCls} /></Labeled>
          </div>
          <Labeled label="About"><textarea value={f.bio} onChange={(e) => set("bio", e.target.value)} rows={3} className={inputCls} /></Labeled>
          <div className="flex justify-end"><SaveButton busy={busy} /></div>
        </form>
      </Card>
      <PasswordCard />
      {user.role === "provider" && (
        <p className="text-center text-sm text-slate-500">Looking for your pro profile, services or portfolio? <Link to="/provider-dashboard/settings" className="font-semibold text-emerald-700 hover:underline">Open pro settings</Link></p>
      )}
    </div>
  );
}

/* ----------------------------- Provider settings --------------------------- */

const AVAILABILITY: { id: Availability; label: string }[] = [
  { id: "AVAILABLE", label: "Available now" }, { id: "BUSY", label: "Busy" }, { id: "OFFLINE", label: "Offline" },
];

interface ProfileForm {
  title: string; bio: string; city: string; years: string; rate: string; minJob: string;
  responseMins: string; skills: string; categories: string[]; availability: Availability; instantBook: boolean;
}

const toForm = (p: Provider): ProfileForm => ({
  title: p.title, bio: p.bio, city: p.city, years: String(p.yearsExperience), rate: String(p.hourlyRate),
  minJob: String(p.minJobPrice), responseMins: String(p.responseTimeMins), skills: p.skills.join(", "),
  categories: p.categoryIds, availability: p.availability ?? "AVAILABLE", instantBook: p.instantBook,
});

export function ProviderSettingsPage() {
  const { user, categories, cities } = useApp();
  const [profile, setProfile] = useState<Provider | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [services, setServices] = useState<ProviderService[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"cover" | "portfolio" | null>(null);
  const [editing, setEditing] = useState<Partial<ProviderService> | null>(null);

  const isProvider = user?.role === "provider";
  useEffect(() => {
    if (!isProvider) return;
    api.myProvider().then((p) => { setProfile(p); setForm(toForm(p)); }).catch((e) => toast.error(errorMessage(e)));
    api.myServices().then(setServices).catch((e) => toast.error(errorMessage(e)));
  }, [isProvider]);

  const cover = useImagePicker(async (file) => {
    setUploading("cover");
    try {
      const fd = new FormData();
      fd.append("cover_image", file);
      setProfile(await api.updateMyProvider(fd));
      toast.success("Cover photo updated");
    } catch (e) { toast.error(errorMessage(e)); } finally { setUploading(null); }
  });
  const portfolio = useImagePicker(async (file) => {
    setUploading("portfolio");
    try {
      await api.addPortfolioImage(file);
      setProfile(await api.myProvider());
      toast.success("Photo added to portfolio");
    } catch (e) { toast.error(errorMessage(e)); } finally { setUploading(null); }
  });

  if (!profile || !form) return <div className="mx-auto max-w-3xl px-4 py-24 text-center text-slate-500">Loading…</div>;

  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => setForm((s) => (s ? { ...s, [k]: v } : s));
  const toggleCategory = (id: string) => set("categories", form.categories.includes(id) ? form.categories.filter((c) => c !== id) : [...form.categories, id]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Professional title is required"); return; }
    if (!(Number(form.rate) >= 0) || !(Number(form.minJob) >= 0)) { toast.error("Rates must be zero or more"); return; }
    setBusy(true);
    try {
      const p = await api.updateMyProvider({
        profession: form.title.trim(), description: form.bio, location: form.city.trim(),
        years_of_experience: Number(form.years) || 0, hourly_rate: Number(form.rate), starting_price: Number(form.minJob),
        response_time_mins: Number(form.responseMins) || 0, skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        categories: form.categories, availability: form.availability, instant_book: form.instantBook,
      });
      setProfile(p); setForm(toForm(p));
      toast.success("Profile saved");
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };

  const removePortfolio = async (id: string) => {
    try { await api.deletePortfolioImage(id); setProfile(await api.myProvider()); } catch (e) { toast.error(errorMessage(e)); }
  };

  const removeService = async (s: ProviderService) => {
    try { await api.deleteService(s.id); setServices((l) => l.filter((x) => x.id !== s.id)); toast.success("Service removed"); } catch (e) { toast.error(errorMessage(e)); }
  };
  const toggleService = async (s: ProviderService) => {
    try {
      const u = await api.saveService({ id: s.id, active: !s.active });
      setServices((l) => l.map((x) => (x.id === u.id ? u : x)));
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading title="Pro profile settings" subtitle="This is what customers see on your public profile." />
        <div className="flex gap-2">
          <Link to="/account" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><UserIcon size={16} /> Account</Link>
          <Link to={`/providers/${profile.id}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">View public profile</Link>
        </div>
      </div>

      <Card title="Cover photo" subtitle="Shown at the top of your profile and on search cards.">
        <div className="relative h-36 overflow-hidden rounded-xl bg-slate-100">
          <img src={profile.cover} alt="" className="h-full w-full object-cover" />
          {cover.input}
          <button onClick={cover.open} disabled={!!uploading} className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow backdrop-blur hover:bg-white disabled:opacity-60">
            <Camera size={16} /> {uploading === "cover" ? "Uploading…" : "Change cover"}
          </button>
        </div>
      </Card>

      <Card title="Profile">
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Labeled label="Professional title"><input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} /></Labeled>
            <Labeled label="City">
              <input list="settings-cities" value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
              <datalist id="settings-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
            </Labeled>
          </div>
          <Labeled label="About you"><textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={4} className={inputCls} /></Labeled>
          <div className="grid gap-4 sm:grid-cols-4">
            <Labeled label="Hourly rate ($)"><input type="number" min={0} value={form.rate} onChange={(e) => set("rate", e.target.value)} className={inputCls} /></Labeled>
            <Labeled label="Minimum job ($)"><input type="number" min={0} value={form.minJob} onChange={(e) => set("minJob", e.target.value)} className={inputCls} /></Labeled>
            <Labeled label="Experience (yrs)"><input type="number" min={0} max={70} value={form.years} onChange={(e) => set("years", e.target.value)} className={inputCls} /></Labeled>
            <Labeled label="Response time (min)"><input type="number" min={0} value={form.responseMins} onChange={(e) => set("responseMins", e.target.value)} className={inputCls} /></Labeled>
          </div>
          <Labeled label="Skills" hint="Comma-separated, up to 20."><input value={form.skills} onChange={(e) => set("skills", e.target.value)} placeholder="Leak repair, Water heaters" className={inputCls} /></Labeled>
          <Labeled label="Categories">
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button type="button" key={c.id} onClick={() => toggleCategory(c.id)} className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1 transition", form.categories.includes(c.id) ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-slate-600 ring-slate-200 hover:ring-emerald-300")}>{c.name}</button>
              ))}
            </div>
          </Labeled>
          <div className="grid gap-4 sm:grid-cols-2">
            <Labeled label="Availability">
              <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1">
                {AVAILABILITY.map((a) => (
                  <button type="button" key={a.id} onClick={() => set("availability", a.id)} className={cn("rounded-lg py-2 text-xs font-semibold transition", form.availability === a.id ? "bg-white text-slate-900 shadow" : "text-slate-500")}>{a.label}</button>
                ))}
              </div>
            </Labeled>
            <Labeled label="Booking mode">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
                <input type="checkbox" checked={form.instantBook} onChange={(e) => set("instantBook", e.target.checked)} className="h-4 w-4 accent-emerald-600" /> Allow instant booking
              </label>
            </Labeled>
          </div>
          <div className="flex justify-end"><SaveButton busy={busy} /></div>
        </form>
      </Card>

      <Card title="Services" subtitle="Each service becomes a pricing card on your profile and can be picked when booking."
        action={<button onClick={() => setEditing({ categoryId: form.categories[0] ?? categories[0]?.id, durationMins: 60, active: true })} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"><Plus size={14} /> Add service</button>}>
        {services.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">No services yet. Customers will see your hourly rate instead.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {services.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className={cn("font-semibold", s.active ? "text-slate-900" : "text-slate-400 line-through")}>{s.title}</p>
                  <p className="text-sm text-slate-500">{s.categoryName} · from ${s.price} · {s.durationMins} min</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => toggleService(s)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">{s.active ? "Hide" : "Show"}</button>
                  <button onClick={() => setEditing(s)} aria-label={`Edit ${s.title}`} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><PencilSimple size={15} /></button>
                  <button onClick={() => removeService(s)} aria-label={`Delete ${s.title}`} className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"><Trash size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Portfolio" subtitle="Up to 20 photos of your work."
        action={<>{portfolio.input}<button onClick={portfolio.open} disabled={!!uploading || (profile.portfolio?.length ?? 0) >= 20} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><UploadSimple size={14} /> {uploading === "portfolio" ? "Uploading…" : "Add photo"}</button></>}>
        {!profile.portfolio?.length ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">No photos yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {profile.portfolio.map((p) => (
              <div key={p.id} className="group relative overflow-hidden rounded-xl border border-slate-200">
                <img src={p.image} alt={p.caption} className="h-28 w-full object-cover" />
                <button onClick={() => removePortfolio(p.id)} aria-label="Remove photo" className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-rose-600 shadow"><Trash size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editing && (
        <ServiceDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(s) => { setServices((l) => (l.some((x) => x.id === s.id) ? l.map((x) => (x.id === s.id ? s : x)) : [s, ...l])); setEditing(null); }}
        />
      )}
    </div>
  );
}

function ServiceDialog({ initial, onClose, onSaved }: { initial: Partial<ProviderService>; onClose: () => void; onSaved: (s: ProviderService) => void }) {
  const { categories } = useApp();
  const [s, setS] = useState({
    title: initial.title ?? "", description: initial.description ?? "", price: initial.price != null ? String(initial.price) : "",
    durationMins: String(initial.durationMins ?? 60), categoryId: initial.categoryId ?? categories[0]?.id ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof s, v: string) => setS((x) => ({ ...x, [k]: v }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s.title.trim() || s.price === "" || Number(s.price) < 0) { toast.error("Add a title and a price of zero or more"); return; }
    setBusy(true);
    try {
      onSaved(await api.saveService({
        id: initial.id, title: s.title.trim(), description: s.description, price: Number(s.price),
        durationMins: Number(s.durationMins) || 60, categoryId: s.categoryId, active: initial.active ?? true,
      }));
      toast.success(initial.id ? "Service updated" : "Service added");
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form role="dialog" aria-label="Service" onSubmit={save} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold text-slate-900">{initial.id ? "Edit service" : "Add a service"}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <Labeled label="Title"><input value={s.title} onChange={(e) => set("title", e.target.value)} placeholder="Leak repair" className={inputCls} /></Labeled>
        <Labeled label="Category">
          <select value={s.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={inputCls}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Labeled>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Starting price ($)"><input type="number" min={0} value={s.price} onChange={(e) => set("price", e.target.value)} className={inputCls} /></Labeled>
          <Labeled label="Duration (min)"><input type="number" min={15} step={15} value={s.durationMins} onChange={(e) => set("durationMins", e.target.value)} className={inputCls} /></Labeled>
        </div>
        <Labeled label="Description (optional)"><textarea value={s.description} onChange={(e) => set("description", e.target.value)} rows={3} className={inputCls} /></Labeled>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"><CheckCircle size={16} /> {busy ? "Saving…" : "Save service"}</button>
        </div>
      </form>
    </div>
  );
}
