import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, CreditCard, Lock, SpinnerGap, Warning, XCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { api, errorMessage, type PaymentSession } from "../services/api";

const money = (s: PaymentSession) => new Intl.NumberFormat(undefined, { style: "currency", currency: s.currency.toUpperCase() }).format(s.amount);

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md px-4 py-16 sm:px-6"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div></div>;
}

function Summary({ s }: { s: PaymentSession }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 text-sm">
      <div className="flex justify-between gap-3"><span className="text-slate-500">Job</span><span className="text-right font-semibold text-slate-800">{s.title}</span></div>
      <div className="mt-1.5 flex justify-between gap-3"><span className="text-slate-500">Pro</span><span className="font-medium text-slate-700">{s.providerName}</span></div>
      <div className="mt-3 flex justify-between border-t border-slate-200 pt-3"><span className="font-semibold text-slate-700">Total</span><span className="text-lg font-extrabold text-emerald-700">{money(s)}</span></div>
    </div>
  );
}

function Failed({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-rose-50 text-rose-600"><XCircle size={22} /></span>
      <h1 className="mt-4 text-xl font-extrabold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
      <Link to="/customer-dashboard" className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Back to my bookings</Link>
    </Shell>
  );
}

/** Stands in for Stripe Checkout when the backend runs without Stripe keys (development only). */
export function MockCheckoutPage() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = sp.get("session_id") ?? "";
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [error, setError] = useState("");
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sessionId) { setError("This checkout link is incomplete."); return; }
    api.paymentSession(sessionId).then(setSession).catch((e) => setError(errorMessage(e)));
  }, [sessionId]);

  if (error) return <Failed title="Checkout unavailable" body={error} />;
  if (!session) return <Shell><p className="flex items-center gap-2 text-sm text-slate-500"><SpinnerGap className="animate-spin" /> Loading checkout…</p></Shell>;
  if (session.status === "paid") return <Failed title="Already paid" body="This booking has already been paid. Nothing more to do." />;

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.confirmMockPayment(sessionId, card);
      navigate(`/checkout/return?session_id=${encodeURIComponent(sessionId)}`, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><CreditCard size={22} /></span>
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">Test mode</span>
      </div>
      <h1 className="mt-4 text-xl font-extrabold text-slate-900">Pay for your job</h1>
      <p className="mt-1 text-sm text-slate-500">Stripe is not configured, so this test checkout stands in for it. No real card is charged.</p>
      <div className="mt-5"><Summary s={session} /></div>
      <form onSubmit={pay} className="mt-5 space-y-3">
        <label className="block text-sm font-semibold text-slate-700">
          Card number
          <input value={card} onChange={(e) => setCard(e.target.value)} inputMode="numeric" autoComplete="cc-number"
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50" />
        </label>
        <p className="text-xs text-slate-400">Use 4242 4242 4242 4242 to succeed or 4000 0000 0000 0002 to simulate a decline.</p>
        <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {busy ? <SpinnerGap className="animate-spin" size={16} /> : <Lock size={16} />} Pay {money(session)}
        </button>
        <Link to={`/customer-dashboard?payment=cancelled#booking-${session.bookingId}`} className="block text-center text-sm font-medium text-slate-500 hover:text-slate-700">Cancel and go back</Link>
      </form>
    </Shell>
  );
}

/** Landing page after checkout. Confirms with the backend, which checks with Stripe directly. */
export function CheckoutReturnPage() {
  const [sp] = useSearchParams();
  const sessionId = sp.get("session_id") ?? "";
  const { refreshBookings } = useApp();
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) { setError("This link is missing its payment reference."); return; }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async (attempt: number) => {
      try {
        const s = await api.syncPayment(sessionId);
        if (!alive) return;
        setSession(s);
        if (s.status === "pending" && attempt < 6) timer = setTimeout(() => poll(attempt + 1), 1500);
        else refreshBookings();
      } catch (e) {
        if (alive) setError(errorMessage(e));
      }
    };
    poll(0);
    return () => { alive = false; clearTimeout(timer); };
  }, [sessionId, refreshBookings]);

  if (error) return <Failed title="We couldn't confirm your payment" body={error} />;
  if (!session || session.status === "pending") {
    return (
      <Shell>
        <p className="flex items-center gap-2 font-semibold text-slate-800"><SpinnerGap className="animate-spin text-emerald-600" size={20} /> Confirming your payment…</p>
        {session && <p className="mt-2 text-sm text-slate-500">This can take a few seconds. You can safely leave; we'll notify you when it's confirmed.</p>}
        {session && <Link to="/customer-dashboard" className="mt-4 inline-block text-sm font-semibold text-emerald-700">Go to my bookings</Link>}
      </Shell>
    );
  }
  if (session.status === "failed") {
    return <Failed title="Payment not completed" body={`${session.failureReason || "The payment did not go through."} You have not been charged; you can try again from your bookings.`} />;
  }
  return (
    <Shell>
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle size={22} weight="fill" /></span>
      <h1 className="mt-4 text-xl font-extrabold text-slate-900">Payment received</h1>
      <p className="mt-1 text-sm text-slate-500">Thanks! {session.providerName} has been notified.</p>
      <div className="mt-5"><Summary s={session} /></div>
      {session.gateway === "mock" && <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700"><Warning size={14} /> Test payment, no money was moved.</p>}
      <Link to={`/customer-dashboard#booking-${session.bookingId}`} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Back to my bookings</Link>
    </Shell>
  );
}
