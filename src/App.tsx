import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import AppLayout from "./layouts/AppLayout";
import OperationPage from "./pages/OperationPage";
import DashboardPage from "./pages/DashboardPage";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

// Rotas secundárias com Code-Splitting / Lazy Loading
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const ConversasPage = lazy(() => import("./pages/ConversasPage"));
const AdminAuth = lazy(() => import("./pages/AdminAuth"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminLoginForm = lazy(() => import("./components/auth/AdminLoginForm"));
const Login = lazy(() => import("./pages/Login"));
const Checkin = lazy(() => import("./pages/Checkin"));
const KdsPage = lazy(() => import("./pages/KdsPage"));

const PageLoader = () => (
  <div className="flex-1 min-h-[50vh] flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <span className="text-xs font-semibold text-muted-foreground animate-pulse">Carregando...</span>
    </div>
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<OperationPage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="conversas" element={<ConversasPage />} />
              </Route>
              <Route path="/login" element={<Login />} />
              <Route path="/admin" element={<AdminAuth><AdminDashboard /></AdminAuth>} />
              <Route path="/admin/login" element={<AdminLoginForm />} />
              <Route path="/checkin" element={<Checkin />} />
              <Route path="/kds/:station" element={<KdsPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
