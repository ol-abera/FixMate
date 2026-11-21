import { Suspense, lazy, useEffect, type ComponentType } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AppProvider } from "./context/AppContext";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
// The landing/browse pages ship in the main bundle; everything else (incl. recharts) loads on demand.
import { HomePage, ExplorePage, ProviderProfilePage } from "./pages/Browse";

function named<M>(load: () => Promise<M>, name: keyof M) {
  return lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));
}
const booking = () => import("./pages/Booking");
const dashboards = () => import("./pages/Dashboards");
const settings = () => import("./pages/Settings");
const misc = () => import("./pages/Misc");

const BookingWizardPage = named(booking, "BookingWizardPage");
const CustomerDashboard = named(dashboards, "CustomerDashboard");
const ProviderDashboard = named(dashboards, "ProviderDashboard");
const FavoritesPage = named(dashboards, "FavoritesPage");
const AdminDashboard = named(() => import("./pages/Admin"), "AdminDashboard");
const AccountSettingsPage = named(settings, "AccountSettingsPage");
const ProviderSettingsPage = named(settings, "ProviderSettingsPage");
const MessagesPage = named(misc, "MessagesPage");
const NotificationsPage = named(misc, "NotificationsPage");
const AuthPage = named(misc, "AuthPage");
const BecomeProviderPage = named(misc, "BecomeProviderPage");
const AboutPage = named(misc, "AboutPage");
const HelpPage = named(misc, "HelpPage");
const ForgotPasswordPage = named(misc, "ForgotPasswordPage");
const ResetPasswordPage = named(misc, "ResetPasswordPage");

function PageFallback() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-label="Loading page">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
    </div>
  );
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) { window.scrollTo(0, 0); return; }
    // Anchored content (e.g. a booking card) may render only after data loads, so retry briefly.
    let tries = 0;
    const t = window.setInterval(() => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) {
        el.scrollIntoView({ block: "center" });
        el.classList.add("ring-2", "ring-emerald-400");
        window.setTimeout(() => el.classList.remove("ring-2", "ring-emerald-400"), 2000);
      }
      if (el || ++tries > 20) clearInterval(t);
    }, 150);
    return () => clearInterval(t);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <ScrollToTop />
        <Layout>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/providers/:id" element={<ProviderProfilePage />} />
            <Route path="/book/:providerId" element={<RequireAuth><BookingWizardPage /></RequireAuth>} />
            <Route path="/customer-dashboard" element={<RequireAuth roles={["customer"]}><CustomerDashboard /></RequireAuth>} />
            <Route path="/provider-dashboard" element={<RequireAuth roles={["provider"]}><ProviderDashboard /></RequireAuth>} />
            <Route path="/admin-dashboard" element={<RequireAuth roles={["admin"]}><AdminDashboard /></RequireAuth>} />
            <Route path="/provider-dashboard/settings" element={<RequireAuth roles={["provider"]}><ProviderSettingsPage /></RequireAuth>} />
            <Route path="/account" element={<RequireAuth><AccountSettingsPage /></RequireAuth>} />
            <Route path="/messages" element={<RequireAuth><MessagesPage /></RequireAuth>} />
            <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
            <Route path="/become-provider" element={<BecomeProviderPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/favorites" element={<RequireAuth roles={["customer"]}><FavoritesPage /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </Layout>
        <Toaster position="top-right" richColors closeButton />
      </AppProvider>
    </BrowserRouter>
  );
}
