import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AppProvider } from "./context/AppContext";
import { Layout } from "./components/Layout";
import { HomePage, ExplorePage, ProviderProfilePage } from "./pages/Browse";
import { BookingWizardPage } from "./pages/Booking";
import { CustomerDashboard, FavoritesPage, ProviderDashboard } from "./pages/Dashboards";
import { MessagesPage, NotificationsPage, AuthPage, BecomeProviderPage, AboutPage, HelpPage } from "./pages/Misc";

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
            <Route path="/book/:providerId" element={<BookingWizardPage />} />
            <Route path="/customer-dashboard" element={<CustomerDashboard />} />
            <Route path="/provider-dashboard" element={<ProviderDashboard />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/become-provider" element={<BecomeProviderPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        <Toaster position="top-right" richColors closeButton />
      </AppProvider>
    </BrowserRouter>
  );
}
