import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";
import { StartupScreen } from "@/components/StartupScreen";
import { useStartupSplash } from "@/hooks/useStartupSplash";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Auth from "./pages/Auth";
import Welcome from "./pages/Welcome";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Leadership from "./pages/Leadership";
import Hierarchy from "./pages/Hierarchy";
import Reports from "./pages/Reports";
import AuditLogs from "./pages/AuditLogs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function needsOnboarding(profile: any) {
  if (!profile) return true;
  return !profile.course || !profile.year_of_study;
}

function ProtectedRoute({ children, allowIncomplete = false }: { children: React.ReactNode; allowIncomplete?: boolean }) {
  const { user, profile, loading } = useAuth();
  const [dashboardReady, setDashboardReady] = useState(false);
  const showSplash = useStartupSplash(loading, dashboardReady, Boolean(user));

  useEffect(() => {
    if (!user) {
      setDashboardReady(false);
      return;
    }

    setDashboardReady(false);
    const timer = window.setTimeout(() => {
      setDashboardReady(true);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [user]);
  if (showSplash) return <StartupScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!allowIncomplete && needsOnboarding(profile)) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const showSplash = useStartupSplash(loading, true, Boolean(user));
  if (showSplash) return <StartupScreen />;
  if (user) {
    if (needsOnboarding(profile)) return <Navigate to="/welcome" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <PageTransition>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
        <Route path="/welcome" element={<ProtectedRoute allowIncomplete><Welcome /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
        <Route path="/leadership" element={<ProtectedRoute><Leadership /></ProtectedRoute>} />
        <Route path="/hierarchy" element={<ProtectedRoute><Hierarchy /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </PageTransition>
  );
}


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AnimatedRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
