import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AppProvider } from "./context/AppContext";
import { Layout } from "./components/Layout";
import { HomePage, ExplorePage, ProviderProfilePage } from "./pages/Browse";
import { BookingWizardPage } from "./pages/Booking";
import { CustomerDashboard, ProviderDashboard } from "./pages/Dashboards";
import { MessagesPage, NotificationsPage, AuthPage, BecomeProviderPage, AboutPage } from "./pages/Misc";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        <Toaster position="top-right" richColors closeButton />
      </AppProvider>
    </BrowserRouter>
  );
}
