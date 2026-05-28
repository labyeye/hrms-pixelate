import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { billingAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  Check,
  CreditCard,
  Crown,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Users,
  Calendar,
  Building2,
  Zap,
  Download,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Fallback plan UI config keyed by planType
const PLAN_COLORS: Record<string, string> = {
  starter: "#00C48C",
  professional: "#FA731C",
  enterprise: "#A855F7",
};
const PLAN_POPULAR: Record<string, boolean> = {
  professional: true,
};

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [plans, setPlans] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      billingAPI.getPlans().then((r) => {
        if (r.success) setPlans(r.data);
      }),
      billingAPI
        .getSubscription()
        .then((r) => {
          if (r.success) setSubscription(r.data);
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
  const currentPlanId = sub?.plan || "starter";

  // Find current plan from API data or fall back to a minimal object
  const currentPlan = plans.find((p) => p.planType === currentPlanId) || {
    name: currentPlanId.charAt(0).toUpperCase() + currentPlanId.slice(1),
    monthlyPrice: sub?.monthlyPrice || 0,
    yearlyPrice: sub?.yearlyPrice || 0,
    maxEmployees: sub?.maxEmployees || 0,
  };

  const empUsed = sub?.currentEmployeeCount ?? 0;
  const empMax = sub?.maxEmployees ?? currentPlan.maxEmployees ?? 0;
  const empPct =
    empMax > 0 ? Math.min(Math.round((empUsed / empMax) * 100), 100) : 0;

  const renewalDate = sub?.renewalDate ? new Date(sub.renewalDate) : null;
  const daysLeft = renewalDate
    ? Math.max(0, Math.ceil((renewalDate.getTime() - Date.now()) / 86400000))
    : null;
  const totalDays = sub?.billingCycle === "yearly" ? 365 : 30;
  const daysPct =
    daysLeft != null
      ? Math.min(Math.round((daysLeft / totalDays) * 100), 100)
      : 100;

  const isActive =
    sub?.status === "active" || sub?.status === "pending_renewal";

  const handleUpgrade = async (planId: string) => {
    if (planId === currentPlanId) return;
    try {
      setUpgrading(planId);
      await billingAPI.createOrder(planId, billing);
      toast({
        title: "Order created",
        description: `Redirecting to payment for ${planId} plan…`,
      });
      // In production: open Razorpay with order.data
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to create order",
        variant: "destructive",
      });
    } finally {
      setUpgrading(null);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Billing">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="w-10 h-10 bg-[#024BAB] border-2 border-black nb-shadow animate-bounce flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Billing">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 p-4 sm:p-6">
        {/* ── Current plan banner ── */}
        <div className="nb-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#024BAB]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-[#024BAB]" />
            </div>
            <div>
              <p className="font-display font-bold text-white text-lg">
                {currentPlan.name} Plan — {isActive ? "Active" : "Inactive"}
              </p>
              <p className="text-sm font-medium text-white/70">
                {renewalDate
                  ? `Next billing: ${renewalDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
                  : "No active subscription"}
              </p>
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 border-2 border-black font-bold text-sm",
              isActive ? "bg-white text-[#024BAB]" : "bg-[#EF4444] text-white",
            )}
          >
            {isActive ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            {isActive ? "Paid & Active" : "Attention Required"}
          </div>
        </div>

        {/* ── Usage stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Employees",
              value: empUsed,
              max: empMax === 999 ? "∞" : empMax,
              pct: empMax === 999 ? 10 : empPct,
              icon: Users,
            },
            {
              label: "Days Remaining",
              value: daysLeft ?? "—",
              max: totalDays,
              pct: daysPct,
              icon: Calendar,
            },
            {
              label: "Plan Limit",
              value: empMax === 999 ? "Unlimited" : `${empMax} emp`,
              max: "",
              pct: 100,
              icon: Building2,
            },
          ].map((stat) => (
            <div key={stat.label} className="nb-card p-4 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4 text-[#024BAB] shrink-0" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </p>
              </div>
              <p className="font-display font-bold text-2xl text-black mb-2">
                {stat.value}
                {stat.max !== "" && (
                  <span className="text-sm font-medium text-muted-foreground ml-1">
                    / {stat.max}
                  </span>
                )}
              </p>
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

        {/* ── Plan cards ── */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="font-display font-bold text-2xl text-black">
              Change Plan
            </h2>
            <div className="flex items-center border-2 border-black nb-shadow-sm overflow-hidden self-start">
              <button
                onClick={() => setBilling("monthly")}
                className={cn(
                  "px-4 py-2 text-sm font-bold transition-colors",
                  billing === "monthly"
                    ? "bg-[#024BAB] text-white"
                    : "bg-white text-black hover:bg-[#024BAB]/10",
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={cn(
                  "px-4 py-2 text-sm font-bold transition-colors border-l-2 border-black",
                  billing === "yearly"
                    ? "bg-[#024BAB] text-white"
                    : "bg-white text-black hover:bg-[#024BAB]/10",
                )}
              >
                Yearly
                <span className="ml-1.5 text-[10px] bg-[#00C48C] text-black border border-black px-1 py-0.5 font-bold">
                  -20%
                </span>
              </button>
            </div>
          </div>

          {plans.length === 0 ? (
            <div className="nb-card p-8 text-center bg-white">
              <RefreshCw className="w-8 h-8 text-[#024BAB] mx-auto mb-2 animate-spin" />
              <p className="text-sm text-muted-foreground">Loading plans…</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const isCurrent = plan.planType === currentPlanId;
                const price =
                  billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
                const isUpgrading = upgrading === plan.planType;
                const color = PLAN_COLORS[plan.planType] || "#024BAB";
                const popular = PLAN_POPULAR[plan.planType] || false;
                return (
                  <div
                    key={plan.planType}
                    className={cn(
                      "nb-card p-5 flex flex-col relative bg-white",
                      isCurrent && "border-[#024BAB] border-4",
                    )}
                    style={popular ? { boxShadow: `6px 6px 0px ${color}` } : {}}
                  >
                    {popular && (
                      <div className="absolute -top-3 left-4 bg-[#024BAB] border-2 border-black px-3 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider">
                        Most Popular
                      </div>
                    )}

                    <div
                      className="w-9 h-9 border-2 border-black flex items-center justify-center mb-3 shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      <Zap className="w-4 h-4 text-white" />
                    </div>

                    <h3 className="font-display font-bold text-xl text-black">
                      {plan.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      {plan.description}
                    </p>

                    <div className="mb-4">
                      <span className="font-display font-bold text-3xl text-black">
                        ₹{price.toLocaleString("en-IN")}
                      </span>
                      <span className="text-sm font-medium text-muted-foreground">
                        /{billing === "yearly" ? "yr" : "mo"}
                      </span>
                    </div>

                    <ul className="space-y-2 flex-1 mb-5">
                      {(plan.features || []).map((f: string) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-sm font-medium text-black"
                        >
                          <Check
                            className="w-4 h-4 shrink-0 mt-0.5"
                            style={{ color }}
                          />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleUpgrade(plan.planType)}
                      disabled={isCurrent || isUpgrading}
                      className={cn(
                        "nb-btn w-full py-2.5 text-sm flex items-center justify-center gap-2",
                        isCurrent
                          ? "bg-[#024BAB] text-white cursor-default"
                          : "bg-black text-white hover:bg-black/80",
                      )}
                    >
                      {isUpgrading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isCurrent ? (
                        "Current Plan"
                      ) : (
                        <>
                          {plan.planType === "enterprise"
                            ? "Contact Sales"
                            : "Upgrade Now"}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Payment method ── */}
        <div className="nb-card p-4 sm:p-5 bg-white">
          <h3 className="font-display font-bold text-lg text-black mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#024BAB]" /> Payment Method
          </h3>
          {sub?.paymentMethod ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border-2 border-black nb-shadow-sm bg-[#024BAB]/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-7 bg-black flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-xs uppercase">
                    {sub.paymentMethod}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-sm text-black capitalize">
                    {sub.paymentMethod} — last payment ₹
                    {sub.amountPaid?.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Paid on{" "}
                    {sub.startDate
                      ? new Date(sub.startDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                </div>
              </div>
              <button className="nb-btn bg-white text-black px-4 py-2 text-sm self-start sm:self-auto border-2 border-black">
                Change
              </button>
            </div>
          ) : (
            <div className="p-4 border-2 border-dashed border-black text-center">
              <p className="text-sm text-muted-foreground">
                No payment method on file
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Payments processed securely via Razorpay. We never store your card
            details.
          </p>
        </div>

        {/* ── Invoice history ── */}
        <div className="nb-card p-4 sm:p-5 bg-white">
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
                    <button className="text-xs font-bold text-[#024BAB] underline hover:text-[#024BAB]/80 transition-colors flex items-center gap-1">
                      <Download className="w-3 h-3" /> Download
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
