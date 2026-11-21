import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AppProvider } from "./context/AppContext";
import { Layout } from "./components/Layout";
import { HomePage, ExplorePage, ProviderProfilePage } from "./pages/Browse";
import { BookingWizardPage } from "./pages/Booking";
import { CustomerDashboard, FavoritesPage, ProviderDashboard } from "./pages/Dashboards";
import { AccountSettingsPage, ProviderSettingsPage } from "./pages/Settings";
import { RequireAuth } from "./components/RequireAuth";
import { MessagesPage, NotificationsPage, AuthPage, BecomeProviderPage, AboutPage, HelpPage, ForgotPasswordPage, ResetPasswordPage } from "./pages/Misc";

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
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/providers/:id" element={<ProviderProfilePage />} />
            <Route path="/book/:providerId" element={<RequireAuth><BookingWizardPage /></RequireAuth>} />
            <Route path="/customer-dashboard" element={<RequireAuth roles={["customer"]}><CustomerDashboard /></RequireAuth>} />
            <Route path="/provider-dashboard" element={<RequireAuth roles={["provider"]}><ProviderDashboard /></RequireAuth>} />
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
        </Layout>
        <Toaster position="top-right" richColors closeButton />
      </AppProvider>
    </BrowserRouter>
  );
}
