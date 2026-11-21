import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, CheckCircle, Clock, MapPin, Phone,
  User as UserIcon, Paperclip, CurrencyDollar, ShieldCheck, Check,
  Info, Lightning, X,
} from "@phosphor-icons/react";
import { cn } from "../lib/utils";
import { useApp, useProviderById } from "../context/AppContext";
import { api, errorMessage } from "../services/api";
import { toast } from "sonner";

const STEPS = ["Service", "Schedule", "Contact", "Address", "Photos", "Review"];

function nextDates(n: number) {
  const out: { iso: string; label: string; dow: string }[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push({
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString([], { month: "short", day: "numeric" }),
      dow: d.toLocaleDateString([], { weekday: "short" }),
    });
  }
  return out;
}
const SLOTS = ["08:00 - 10:00", "10:00 - 12:00", "12:00 - 14:00", "14:00 - 16:00", "16:00 - 18:00"];
const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function slotRange(slot: string): [number, number] | null {
  const m = /^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/.exec(slot.trim());
  return m ? [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])] : null;
}
function slotsOverlap(a: string, b: string) {
  const x = slotRange(a), y = slotRange(b);
  return !!x && !!y && x[0] < y[1] && y[0] < x[1];
}

export function BookingWizardPage() {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const { addBooking, user, categories, cities } = useApp();
  const [sp] = useSearchParams();
  const { provider, loading } = useProviderById(providerId);
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState(0);
  const dates = useMemo(() => nextDates(7), []);
  const [form, setForm] = useState({
    categoryId: provider?.categoryIds[0] ?? "plumbing",
    serviceId: sp.get("service") ?? "",
    serviceName: "",
    description: "",
    date: dates[0].iso,
    timeSlot: SLOTS[1],
    name: user?.name ?? "",
    phone: "",
    email: user?.email ?? "",
    street: "",
    city: provider?.city ?? "",
    notes: "",
  });
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const photoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ date: string; time_slot: string }[]>([]);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (provider?.id) api.busySlots(provider.id).then(setBusy).catch(() => setBusy([]));
  }, [provider?.id]);

  const services = useMemo(() => (provider?.services ?? []).filter((s) => s.active), [provider?.services]);
  useEffect(() => {
    if (!provider) return;
    setForm((f) => {
      const wanted = f.serviceId || sp.get("service") || "";
      const svc = services.find((s) => s.id === wanted);
      return {
        ...f, city: f.city || provider.city,
        serviceId: svc ? svc.id : services.length ? "" : wanted,
        categoryId: svc?.categoryId ?? (provider.categoryIds[0] || f.categoryId),
        serviceName: f.serviceName || svc?.title || "",
      };
    });
  }, [provider?.id, services.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: f.name || user.name, email: f.email || user.email }));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-24 text-center text-slate-500">Loading…</div>;
  }

  if (!provider) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Provider not found</h1>
        <button onClick={() => navigate("/explore")} className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Back to explore</button>
      </div>
    );
  }

  if (!user || user.role !== "customer") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Sign in as a customer to book {provider.name}</h1>
        <button onClick={() => navigate("/auth")} className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Sign in</button>
      </div>
    );
  }

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const isBusy = (date: string, slot: string) => busy.some((b) => b.date === date && slotsOverlap(b.time_slot, slot));
  const addPhotos = (files: FileList | null) => {
    const picked = Array.from(files ?? []);
    const ok = picked.filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type) && f.size <= MAX_PHOTO_BYTES);
    if (ok.length < picked.length) toast.error("Photos must be JPG, PNG or WEBP and under 5 MB");
    const room = MAX_PHOTOS - photos.length;
    if (ok.length > room) toast.info(`You can attach up to ${MAX_PHOTOS} photos`);
    setPhotos((p) => [...p, ...ok.slice(0, Math.max(room, 0)).map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };
  const removePhoto = (i: number) => setPhotos((p) => {
    URL.revokeObjectURL(p[i].url);
    return p.filter((_, j) => j !== i);
  });
  const chosen = services.find((s) => s.id === form.serviceId);
  // mirrors the server-side estimate in bookings/serializers.py
  const estimate = chosen ? chosen.price : Math.max(provider.hourlyRate * 2, provider.minJobPrice);
  const pickService = (id: string) => {
    const svc = services.find((s) => s.id === id);
    setForm((f) => ({
      ...f, serviceId: id,
      categoryId: svc?.categoryId ?? f.categoryId,
      serviceName: svc && (!f.serviceName || services.some((s) => s.title === f.serviceName)) ? svc.title : f.serviceName,
    }));
  };
  const canNext = [
    !!form.serviceName && !!form.description,
    !!form.date && !!form.timeSlot && !isBusy(form.date, form.timeSlot),
    !!form.name && !!form.phone && /.+@.+\..+/.test(form.email),
    !!form.street && !!form.city,
    true,
    true,
  ][step];

  const confirm = async () => {
    setSubmitting(true);
    try {
      await addBooking({
        providerId: provider.id,
        serviceId: form.serviceId || undefined,
        categoryId: form.categoryId,
        serviceName: form.serviceName,
        description: form.description,
        date: form.date,
        timeSlot: form.timeSlot,
        address: `${form.street}, ${form.city}`,
        contactName: form.name,
        contactPhone: form.phone,
        contactEmail: form.email,
        notes: form.notes.trim(),
        photos: photos.map((p) => p.file),
      });
      toast.success("Booking request sent!", { description: `${provider.name} will confirm shortly.` });
      navigate("/customer-dashboard");
    } catch (e) {
      toast.error(errorMessage(e, "Could not create booking"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <img src={provider.avatar} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-emerald-100" />
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Book {provider.name}</h1>
          <p className="text-sm text-slate-500">{provider.title}</p>
        </div>
      </div>

      {/* stepper */}
      <div className="mb-8 flex items-center">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <div className={cn("grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition",
                i < step ? "bg-emerald-600 text-white" : i === step ? "bg-emerald-600 text-white ring-4 ring-emerald-100" : "bg-slate-100 text-slate-400")}>
                {i < step ? <Check size={16} weight="bold" /> : i + 1}
              </div>
              <span className={cn("mt-1 hidden text-[11px] font-medium sm:block", i === step ? "text-emerald-700" : "text-slate-400")}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={cn("mx-1 h-0.5 flex-1 rounded", i < step ? "bg-emerald-500" : "bg-slate-200")} />}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="font-bold text-slate-900">What do you need done?</h2>
                {services.length > 0 && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">Service</label>
                    <select value={form.serviceId} onChange={(e) => pickService(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200">
                      <option value="">Something else (hourly rate)</option>
                      {services.map((s) => <option key={s.id} value={s.id}>{s.title} · from ${s.price}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Category</label>
                  <select value={form.categoryId} disabled={!!chosen} onChange={(e) => set("categoryId", e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200 disabled:bg-slate-50 disabled:text-slate-500">
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Job title</label>
                  <input value={form.serviceName} onChange={(e) => set("serviceName", e.target.value)} placeholder="e.g. Kitchen sink leak" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Describe the job</label>
                  <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} placeholder="Tell the pro what is going on..." className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
              </div>
            )}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="font-bold text-slate-900">When do you need it?</h2>
                <p className="text-sm text-slate-500">Pick a date</p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {dates.map((d) => (
                    <button key={d.iso} onClick={() => set("date", d.iso)} className={cn("rounded-xl border py-2 text-center transition", form.date === d.iso ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 hover:border-emerald-300")}>
                      <span className="block text-[11px] text-slate-400">{d.dow}</span>
                      <span className="block text-sm font-bold">{d.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-sm text-slate-500">Pick a time slot</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SLOTS.map((s) => {
                    const taken = isBusy(form.date, s);
                    return (
                      <button key={s} disabled={taken} onClick={() => set("timeSlot", s)} title={taken ? `${provider.name} is already booked then` : undefined}
                        className={cn("flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium transition",
                          taken ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through"
                            : form.timeSlot === s ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:border-emerald-300")}>
                        <Clock size={14} /> {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-bold text-slate-900">Your contact details</h2>
                {[{ k: "name", l: "Full name", ph: "Jane Doe", Icon: UserIcon }, { k: "phone", l: "Phone", ph: "(512) 555-0100", Icon: Phone }, { k: "email", l: "Email", ph: "you@email.com", Icon: Info }].map((f) => (
                  <div key={f.k}>
                    <label className="mb-1 block text-sm font-medium text-slate-600">{f.l}</label>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:ring-2 focus-within:ring-emerald-200">
                      <f.Icon size={16} className="text-slate-400" />
                      <input value={(form as unknown as Record<string, string>)[f.k]} onChange={(e) => set(f.k, e.target.value)} placeholder={f.ph} className="w-full bg-transparent py-2.5 text-sm outline-none" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="font-bold text-slate-900">Where is the job?</h2>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Street address</label>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:ring-2 focus-within:ring-emerald-200">
                    <MapPin size={16} className="text-slate-400" />
                    <input value={form.street} onChange={(e) => set("street", e.target.value)} placeholder="1420 Oak Hollow Ln" className="w-full bg-transparent py-2.5 text-sm outline-none" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">City</label>
                  <input list="booking-cities" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Austin" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />
                  <datalist id="booking-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Access notes (optional)</label>
                  <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Gate code, parking, pets..." className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="space-y-4">
                <h2 className="font-bold text-slate-900">Add photos (optional)</h2>
                <p className="text-sm text-slate-500">Sharing a few photos helps pros give a sharper estimate.</p>
                <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                  onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
                <div className="grid grid-cols-3 gap-3">
                  {photos.map((p, i) => (
                    <div key={p.url} className="relative overflow-hidden rounded-xl border border-slate-200">
                      <img src={p.url} alt={`Job photo ${i + 1}`} className="h-24 w-full object-cover" />
                      <button onClick={() => removePhoto(i)} aria-label={`Remove photo ${i + 1}`} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-slate-500 shadow hover:text-rose-600"><X size={13} weight="bold" /></button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <button onClick={() => photoInput.current?.click()} className="grid h-24 place-items-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-emerald-400 hover:text-emerald-500">
                      <div className="text-center"><Paperclip size={20} /><span className="mt-1 block text-xs font-medium">Add photo</span></div>
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400">Up to {MAX_PHOTOS} photos · JPG, PNG or WEBP · 5 MB each</p>
              </div>
            )}
            {step === 5 && (
              <div className="space-y-4">
                <h2 className="font-bold text-slate-900">Review & confirm</h2>
                <div className="rounded-xl bg-slate-50 p-4 text-sm">
                  {[
                    ["Service", chosen && chosen.title !== form.serviceName ? `${form.serviceName} (${chosen.title})` : form.serviceName],
                    ["Category", categories.find((c) => c.id === form.categoryId)?.name],
                    ["Date", `${form.date} · ${form.timeSlot}`],
                    ["Address", `${form.street}, ${form.city}`],
                    ["Contact", `${form.name} · ${form.phone}`],
                    ["Notes", form.notes.trim()],
                    ["Photos", `${photos.length} attached`],
                  ].map(([l, v]) => (
                    <div key={l as string} className="flex justify-between border-b border-slate-200/70 py-1.5 last:border-0">
                      <span className="text-slate-500">{l}</span><span className="font-medium text-slate-800">{v || "—"}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-800"><CurrencyDollar size={18} /> Estimated cost</div>
                  <p className="text-2xl font-extrabold text-emerald-700">${estimate}</p>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck size={14} className="text-emerald-600" /> You only pay after the job is completed and approved.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
          <button onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50">
            <ArrowLeft size={16} /> {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < STEPS.length - 1 ? (
            <button disabled={!canNext} onClick={() => { if (canNext) setStep(step + 1); else toast.error("Please complete this step"); }}
              className={cn("inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold transition active:scale-95", canNext ? "bg-emerald-600 text-white hover:bg-emerald-700" : "cursor-not-allowed bg-slate-100 text-slate-400")}>
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={confirm} disabled={submitting} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-95">
              <Lightning size={16} weight="fill" /> Confirm booking
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
        <CheckCircle size={14} className="text-emerald-500" /> Free cancellation up to 2 hours before your slot
      </div>
    </div>
  );
}