import { writePrintDocument } from "@/lib/printWindow";
import { useState, useEffect } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { billingAPI } from "@/services/api";
import { buildInvoiceHTML } from "@/lib/buildInvoiceHTML";
import {
  Check,
  Crown,
  AlertTriangle,
  Users,
  Calendar,
  Building2,
  Zap,
  Download,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function BillingPage() {
  const { user } = useAuth();

  const [subscription, setSubscription] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      billingAPI
        .getSubscription()
        .then((r) => {
          if (r.success) {
            setSubscription(r.data);
          }
        })
        .catch(() => {}),
      billingAPI
        .getInvoices()
        .then((r) => {
          if (r.success) setInvoices(r.data);
        })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);
  const sub = subscription || user?.company?.subscription;
  const currentPlanId = sub?.plan || "1-10 employees";

  const currentPlan = {
    name: currentPlanId,
    monthlyPrice: sub?.monthlyPrice || 0,
    yearlyPrice: sub?.yearlyPrice || 0,
    maxEmployees: sub?.maxEmployees || 0,
  };

  const empUsed = sub?.currentEmployeeCount ?? 0;
  const empMax = sub?.maxEmployees ?? currentPlan.maxEmployees ?? 0;
  const empPct =
    empMax > 0 ? Math.min(Math.round((empUsed / empMax) * 100), 100) : 0;

  const isTrial = sub?.isTrial ?? false;
  const trialEndDate = sub?.trialEndDate ? new Date(sub.trialEndDate) : null;
  const renewalDate = sub?.renewalDate ? new Date(sub.renewalDate) : null;
  const expiryDate = isTrial ? trialEndDate : renewalDate;
  const daysLeft = expiryDate
    ? Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / 86400000))
    : null;
  const totalDays = isTrial ? 60 : sub?.billingCycle === "yearly" ? 365 : 30;
  const daysPct =
    daysLeft != null
      ? Math.min(Math.round((daysLeft / totalDays) * 100), 100)
      : 100;

  const isActive =
    sub?.status === "active" || sub?.status === "pending_renewal";
  const isCancelled = sub?.status === "cancelled";

  const handleDownloadInvoice = (inv: any) => {
    setDownloading(inv._id);
    try {
      const html = buildInvoiceHTML(inv);
      const w = window.open("", "_blank");
      if (w) {
        writePrintDocument(w, html);
        setTimeout(() => {
          w.print();
        }, 500);
      }
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Billing">
        <div className="flex items-center justify-center h-[60vh]">
          <img src={nesthrlogo} alt="NestHR" className="h-16 w-auto" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Billing">
      <div className="mx-auto space-y-6 sm:space-y-8 p-4 sm:p-6">
        {}
        {isTrial && (
          <div className="border-2 border-[#FBBF24] bg-[#FBBF24]/10 p-4 flex items-start gap-3">
            <Zap className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#D97706] text-sm">
                2-Month Free Trial Active — {daysLeft ?? 0} days remaining
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You're on a free trial until{" "}
                {trialEndDate?.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                . To continue after the trial, contact Pixelate Nest.
              </p>
            </div>
          </div>
        )}
        {!isActive && !isTrial && (
          <div className="border-2 border-[#EF4444] bg-[#EF4444]/5 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#EF4444] text-sm">
                No Active Subscription
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your account is not yet activated. Please contact Pixelate Nest to activate your plan.
              </p>
            </div>
          </div>
        )}

        {}
        <div className="border-2 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#024BAB]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-[#024BAB]" />
            </div>
            <div>
              <p className="font-display font-bold text-white text-lg">
                {sub?.customPlanName || currentPlan.name} Plan —{" "}
                {isTrial ? "Free Trial" : isActive ? "Active" : "Inactive"}
              </p>
              <p className="text-sm font-medium text-white/70">
                {isTrial && trialEndDate
                  ? `Trial ends: ${trialEndDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
                  : renewalDate
                    ? `Next billing: ${renewalDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
                    : "No active subscription"}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <div
              className={cn(
                "flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 border-2 border-black font-bold text-sm",
                isTrial
                  ? "bg-[#FBBF24] text-black"
                  : isCancelled
                    ? "bg-[#FBBF24] text-black"
                    : isActive
                      ? "bg-white text-[#024BAB]"
                      : "bg-[#EF4444] text-white",
              )}
            >
              {isTrial || isCancelled ? (
                <Zap className="w-4 h-4" />
              ) : isActive ? (
                <Check className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              {isTrial
                ? `${daysLeft ?? 0} days left`
                : isCancelled
                  ? "Cancelling"
                  : isActive
                    ? "Paid & Active"
                    : "Attention Required"}
            </div>
            {isCancelled && (
              <span className="text-xs font-bold text-white/70">
                Cancelled — access until{" "}
                {expiryDate?.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }) || "period end"}
              </span>
            )}
          </div>
        </div>

        {}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Employees",
              value: empUsed,
              max: empMax === 999 ? "∞" : empMax,
              pct: empMax === 999 ? 10 : empPct,
              icon: Users,
              bg: "bg-[#024BAB]",
            },
            {
              label: "Days Remaining",
              value: daysLeft ?? "—",
              max: totalDays,
              pct: daysPct,
              icon: Calendar,
              bg: "bg-[#FA731C]",
            },
            {
              label: "Plan Limit",
              value: empMax === 999 ? "Unlimited" : `${empMax} emp`,
              max: "",
              pct: 100,
              icon: Building2,
              bg: "bg-[#00C48C]",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border-2 p-4 flex flex-col gap-3 bg-white"
            >
              <div
                className={cn(
                  "w-10 h-10 border-2 border-black flex items-center justify-center shrink-0",
                  stat.bg,
                )}
              >
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-display font-bold text-3xl text-black">
                  {stat.value}
                  {stat.max !== "" && (
                    <span className="text-sm font-medium text-muted-foreground ml-1">
                      / {stat.max}
                    </span>
                  )}
                </p>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                  {stat.label}
                </p>
              </div>
              <div className="h-2 bg-[#024BAB]/20 border border-black">
                <div
                  className={cn(
                    "h-full border-r border-black",
                    stat.pct > 85 ? "bg-[#EF4444]" : "bg-[#024BAB]",
                  )}
                  style={{ width: `${stat.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="border-2 p-4 sm:p-5 bg-white">
          <h2 className="font-display font-bold text-xl text-black mb-4">
            What's included in your plan
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(sub?.customFeatures?.length
              ? sub.customFeatures
              : [
              `Up to ${empMax === 999 ? "unlimited" : empMax} employees`,
              "Employee management, departments & documents",
              "Attendance with biometric device support",
              "Leave, holidays & late approvals",
              "Payroll, loans & payslips",
              "Performance, tasks & announcements",
              "Web & mobile app access",
              ...(String(sub?.tier || "").includes("whatsapp")
                ? ["WhatsApp notifications & OTP"]
                : []),
            ]).map((f: string) => (
              <div key={f} className="flex items-start gap-2 text-sm text-black">
                <Check className="w-4 h-4 text-[#00C48C] shrink-0 mt-0.5" />
                {f}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 shrink-0" />
            Need a different plan or more employees? Contact Pixelate Nest at
            support@pixelatenest.com or WhatsApp +91 84069 12345 and we will
            update it for you.
          </p>
        </div>

        {}
        {}
        <div className="border-2 p-4 sm:p-5 bg-white">
          <h3 className="font-display font-bold text-lg text-black mb-4">
            Invoice History
          </h3>
          {invoices.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-black/30">
              <p className="text-xs text-muted-foreground">No invoices found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div
                  key={inv._id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border-2 border-black hover:bg-[#024BAB]/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-muted-foreground">
                      {inv.invoiceNumber}
                    </span>
                    <span className="text-sm font-medium text-black">
                      {new Date(inv.paidAt || inv.createdAt).toLocaleDateString(
                        "en-IN",
                        { day: "numeric", month: "long", year: "numeric" },
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {inv.plan} · {inv.billingCycle}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-black">
                      ₹{inv.amount?.toLocaleString("en-IN")}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 border-2 border-black text-[11px] font-bold",
                        inv.status === "paid"
                          ? "bg-[#00C48C] text-black"
                          : "bg-[#FA731C] text-white",
                      )}
                    >
                      {inv.status === "paid" && <Check className="w-3 h-3" />}
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </span>
                    <button
                      onClick={() => handleDownloadInvoice(inv)}
                      disabled={downloading === inv._id}
                      className="text-xs font-bold text-[#024BAB] underline hover:text-[#024BAB]/80 transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      <Download className="w-3 h-3" />
                      {downloading === inv._id ? "Opening…" : "Download"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </AppLayout>
  );
}
