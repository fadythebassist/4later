import React, { Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AnalyticsConsentBanner from "@/components/AnalyticsConsentBanner";
import { DataProvider } from "@/contexts/DataContext";
import { trackPageView } from "@/services/AnalyticsService";
import "@/styles/globals.css";

// Route-level code splitting — each page is its own JS chunk.
// Vite will emit a separate file for each lazy import.
const Login = React.lazy(() => import("@/pages/Login"));
const Register = React.lazy(() => import("@/pages/Register"));
const Dashboard = React.lazy(() => import("@/pages/Dashboard"));
const ShareTarget = React.lazy(() => import("@/pages/ShareTarget"));
const Recovery = React.lazy(() => import("@/pages/Recovery"));
const Privacy = React.lazy(() => import("@/pages/Privacy"));
const Terms = React.lazy(() => import("@/pages/Terms"));

const PageSpinner: React.FC = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
    }}
  >
    <div className="spinner"></div>
  </div>
);

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, loading } = useAuth();

  if (loading) return <PageSpinner />;

  return user ? <>{children}</> : <Navigate to="/login" />;
};

// Public route wrapper (redirects to dashboard if already logged in)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <PageSpinner />;

  return user ? <Navigate to="/dashboard" /> : <>{children}</>;
};

const AnalyticsTracker: React.FC = () => {
  const location = useLocation();

  React.useEffect(() => {
    const path = `${location.pathname}${location.search}${location.hash}`;
    void trackPageView(path);
  }, [location.hash, location.pathname, location.search]);

  return null;
};

const App: React.FC = () => {
  return (
    <Router>
      <AnalyticsTracker />
      <AuthProvider>
        <DataProvider>
          <AnalyticsConsentBanner />
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              {/* Public routes */}
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                }
              />

              {/* Protected routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/share-target"
                element={
                  <ProtectedRoute>
                    <ShareTarget />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/recovery"
                element={
                  <ProtectedRoute>
                    <Recovery />
                  </ProtectedRoute>
                }
              />

              {/* Default redirect */}
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
          </Suspense>
        </DataProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
