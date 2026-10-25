import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUsageTracker } from "@/hooks/useUsageTracker";
import TermsGate from "@/components/TermsGate";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import IntroOnboarding from "@/components/IntroOnboarding";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { ToastProvider } from "@/hooks/use-toast";
import { ConfirmProvider } from "@/hooks/use-confirm";
import { usePushNotification } from "@/hooks/usePushNotification";
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const EmployeeCredentialsPage = lazy(() => import("./pages/EmployeeCredentialsPage"));
const EmployeeDashboard = lazy(() => import("./pages/EmployeeDashboard"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const LeavePage = lazy(() => import("./pages/LeavePage"));
const PayrollPage = lazy(() => import("./pages/PayrollPage"));
const PerformancePage = lazy(() => import("./pages/PerformancePage"));
const PerformanceReportPage = lazy(() => import("./pages/PerformanceReportPage"));
const DepartmentsPage = lazy(() => import("./pages/DepartmentsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const BiometricPage = lazy(() => import("./pages/BiometricPage"));
const BiometricDevicePage = lazy(() => import("./pages/BiometricDevicePage"));
const HolidaysPage = lazy(() => import("./pages/HolidaysPage"));
const NfcManagerPage = lazy(() => import("./pages/NfcManagerPage"));
const AttendanceSettingsPage = lazy(() => import("./pages/AttendanceSettingsPage"));
const LateApprovalsPage = lazy(() => import("./pages/LateApprovalsPage"));
const PaymentFailedPage = lazy(() => import("./pages/PaymentFailedPage"));
const WelcomePage = lazy(() => import("./pages/WelcomePage"));
const ManagePage = lazy(() => import("./pages/ManagePage"));
const EmployeePayrollPage = lazy(() => import("./pages/EmployeePayrollPage"));
const MyLoansPage = lazy(() => import("./pages/MyLoansPage"));
const EmployeeReportPage = lazy(() => import("./pages/EmployeeReportPage"));
const LoansPage = lazy(() => import("./pages/LoansPage"));
import NotFound from "./pages/NotFound";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
const ExitManagementPage = lazy(() => import("./pages/ExitManagementPage"));
const AuditLogPage = lazy(() => import("./pages/AuditLogPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const DocumentVaultPage = lazy(() => import("./pages/DocumentVaultPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const AnnouncementsPage = lazy(() => import("./pages/AnnouncementsPage"));
const TrashPage = lazy(() => import("./pages/TrashPage"));
const CreditsPage = lazy(() => import("./pages/CreditsPage"));
import nesthrlogo from "../assets/nesthr.png";
import PageTransition from "@/components/layout/PageTransition";
import RefundNotice from "@/components/RefundNotice";
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

  const hasCompany = user?.company;
  if (!hasCompany) return <Navigate to="/onboarding" replace />;

  const hasActiveSubscription =
    user?.subscription?.status === "active" ||
    user?.subscription?.status === "pending_renewal";
  if (!hasActiveSubscription) {
    if (user?.role === "super_admin") return <Navigate to="/billing" replace />;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function BillingRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.company) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { user } = useAuth();
  if (user?.role === "employee") return <Navigate to="/my-profile" replace />;
  return <DashboardPage />;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  useUsageTracker();
  usePushNotification(isAuthenticated);
  if (isLoading) return <LoadingScreen />;

  return (
    <PageTransition>
      <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route
          path="/login"
          element={
            !isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />
          }
        />
        <Route
          path="/register"
          element={
            !isAuthenticated ? <RegisterPage /> : <Navigate to="/" replace />
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
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
        {}
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
          path="/welcome"
          element={
            isAuthenticated ? <WelcomePage /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RootRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <BillingRoute>
              <BillingPage />
            </BillingRoute>
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
          path="/performance"
          element={
            <ProtectedRoute>
              <PerformancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/performance/report"
          element={
            <ProtectedRoute>
              <PerformanceReportPage />
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
          path="/attendance-settings"
          element={
            <ProtectedRoute>
              <AttendanceSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/late-approvals"
          element={
            <ProtectedRoute>
              <LateApprovalsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manage"
          element={
            <ProtectedRoute>
              <ManagePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-payroll"
          element={
            <ProtectedRoute>
              <EmployeePayrollPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-report"
          element={
            <ProtectedRoute>
              <EmployeeReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-loans"
          element={
            <ProtectedRoute>
              <MyLoansPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/loans"
          element={
            <ProtectedRoute>
              <LoansPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exit-management"
          element={
            <ProtectedRoute>
              <ExitManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-log"
          element={
            <ProtectedRoute>
              <AuditLogPage />
            </ProtectedRoute>
          }
        />
        {}
        <Route
          path="/support"
          element={
            <ProtectedRoute>
              <SupportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <ProtectedRoute>
              <DocumentVaultPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <TasksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/announcements"
          element={
            <ProtectedRoute>
              <AnnouncementsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/device/:token" element={<BiometricDevicePage />} />
        <Route
          path="/trash"
          element={
            <ProtectedRoute>
              <TrashPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/credits"
          element={
            <ProtectedRoute>
              <CreditsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </PageTransition>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <CreditsProvider>
            <BrowserRouter>
              <AppRoutes />
              <TermsGate />
              <IntroOnboarding />
              <RefundNotice />
            </BrowserRouter>
          </CreditsProvider>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  </QueryClientProvider>
);

export default App;
