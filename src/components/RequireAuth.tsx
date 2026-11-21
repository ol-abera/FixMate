import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import type { UserRole } from "../data/mockData";
import { dashboardPath } from "../lib/links";

/** Route guard: guests go to /auth?next=<here>; signed-in users with the wrong role go to their own dashboard. */
export function RequireAuth({ roles, children }: { roles?: UserRole[]; children: React.ReactNode }) {
  const { user, ready } = useApp();
  const location = useLocation();
  if (!ready) return <div className="mx-auto max-w-3xl px-4 py-24 text-center text-slate-500">Loading…</div>;
  if (!user) {
    const next = location.pathname + location.search + location.hash;
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to={dashboardPath(user)} replace />;
  return <>{children}</>;
}
