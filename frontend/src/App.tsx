import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ToastProvider } from "@/hooks/use-toast";
import { Users2 } from "lucide-react";
import DashboardPage from "./pages/DashboardPage";
import EmployeesPage from "./pages/EmployeesPage";
import EmployeeCredentialsPage from "./pages/EmployeeCredentialsPage";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import AttendancePage from "./pages/AttendancePage";
import LeavePage from "./pages/LeavePage";
import PayrollPage from "./pages/PayrollPage";
import RecruitmentPage from "./pages/RecruitmentPage";
import PerformancePage from "./pages/PerformancePage";
import DepartmentsPage from "./pages/DepartmentsPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OnboardingPage from "./pages/OnboardingPage";
import BillingPage from "./pages/BillingPage";
import ReportsPage from "./pages/ReportsPage";
import BiometricPage from "./pages/BiometricPage";
import BiometricDevicePage from "./pages/BiometricDevicePage";
import HolidaysPage from "./pages/HolidaysPage";
import NfcManagerPage from "./pages/NfcManagerPage";
import PayrollSettingsPage from "./pages/PayrollSettingsPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import PaymentFailedPage from "./pages/PaymentFailedPage";
import NotFound from "./pages/NotFound";
import nesthrlogo from "../assets/nesthr.png";
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#F0F6FF] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <img src={nesthrlogo} alt="NestHR" className="h-16 w-auto" />
        <p className="text-sm font-medium text-muted-foreground">
          Loading NestHR...
        </p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Check if user has company
  const hasCompany = user?.company;
  if (!hasCompany) return <Navigate to="/onboarding" replace />;

  // Check if user has active subscription
  const hasActiveSubscription = user?.subscription?.status === "active";
  if (!hasActiveSubscription) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;

  return (
    <Routes>
      <Route
        path="/login"
        element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/register"
        element={
          !isAuthenticated ? <RegisterPage /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/onboarding"
        element={
          isAuthenticated ? (
            <OnboardingPage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      {/* HDFC SmartGateway callback pages — require auth but not active subscription */}
      <Route
        path="/payment/success"
        element={
          isAuthenticated ? (
            <PaymentSuccessPage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/payment/failed"
        element={
          isAuthenticated ? (
            <PaymentFailedPage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing"
        element={
          <ProtectedRoute>
            <BillingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-profile"
        element={
          <ProtectedRoute>
            <EmployeeDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees"
        element={
          <ProtectedRoute>
            <EmployeesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee-credentials"
        element={
          <ProtectedRoute>
            <EmployeeCredentialsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <AttendancePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave"
        element={
          <ProtectedRoute>
            <LeavePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/payroll"
        element={
          <ProtectedRoute>
            <PayrollPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recruitment"
        element={
          <ProtectedRoute>
            <RecruitmentPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/performance"
        element={
          <ProtectedRoute>
            <PerformancePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/departments"
        element={
          <ProtectedRoute>
            <DepartmentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/biometric"
        element={
          <ProtectedRoute>
            <BiometricPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/holidays"
        element={
          <ProtectedRoute>
            <HolidaysPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/nfc-manager"
        element={
          <ProtectedRoute>
            <NfcManagerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/payroll-settings"
        element={
          <ProtectedRoute>
            <PayrollSettingsPage />
          </ProtectedRoute>
        }
      />
      {/* Public biometric device terminal — no login required */}
      <Route path="/device/:token" element={<BiometricDevicePage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  </QueryClientProvider>
);

export default App;
