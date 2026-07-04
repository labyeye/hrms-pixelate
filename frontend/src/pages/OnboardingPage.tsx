import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { billingAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/Toaster";
import CompanyDetailsForm from "@/components/CompanyDetailsForm";
import {
  Check,
  Zap,
  Users,
  Loader2,
  ChevronRight,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    Razorpay: any;
  }
}

type Step = "company" | "employees" | "plan" | "payment";

interface CompanyFormData {
  name: string;
  email: string;
  phone: string;
  industry: string;
  website: string;
  gstNumber: string;
  panNumber: string;
}

const PRICING_TIERS = [
  { min: 1, max: 10, rate: 60, label: "1-10 employees" },
  { min: 11, max: 20, rate: 55, label: "11-20 employees" },
  { min: 21, max: 40, rate: 50, label: "21-40 employees" },
  { min: 41, max: 60, rate: 45, label: "41-60 employees" },
  { min: 61, max: Infinity, rate: 40, label: "60+ employees" },
];

function getPricingTier(count: number) {
  return (
    PRICING_TIERS.find((t) => count >= t.min && count <= t.max) ||
    PRICING_TIERS[0]
  );
}

const PLAN_FEATURES = [
  "Employee management",
  "Attendance tracking",
  "Leave management",
  "Payroll processing",
  "Performance reviews",
  "WhatsApp notifications",
  "Reports & analytics",
];

const STEPS: { id: Step; label: string }[] = [
  { id: "company", label: "Company" },
  { id: "employees", label: "Team size" },
  { id: "plan", label: "Plan" },
  { id: "payment", label: "Payment" },
];

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-9 h-9 border-2 border-black flex items-center justify-center font-black text-sm transition-all",
                  done && "bg-[#024BAB] text-white",
                  active && "bg-[#FA731C] text-white",
                  !done && !active && "bg-white text-gray-400",
                )}
              >
                {done ? <Check className="w-4 h-4" /> : idx + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] font-black uppercase mt-1 tracking-wide",
                  active
                    ? "text-[#FA731C]"
                    : done
                      ? "text-[#024BAB]"
                      : "text-gray-400",
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-16 h-0.5 mt-[-14px] mx-1",
                  idx < currentIdx ? "bg-[#024BAB]" : "bg-gray-200",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardingPage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(
    user?.company ? "employees" : "company",
  );
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [employeeCount, setEmployeeCount] = useState<number | "">("");
  const [paying, setPaying] = useState(false);
  const [companyError, setCompanyError] = useState("");
  const [companyForm, setCompanyForm] = useState<CompanyFormData | null>(null);

  useEffect(() => {
    if (user?.company && user?.subscription?.status === "active") {
      navigate("/", { replace: true });
    }
  }, [user?.company, user?.subscription?.status, navigate]);

  const handleCreateCompany = async (formData: CompanyFormData) => {
    // No API call here — the company is only persisted in the database
    // once payment succeeds (see handlePay). We just hold the details
    // in state and move the wizard forward.
    setCompanyError("");
    setCompanyForm(formData);
    setStep("employees");
  };

  const handleEmployeeContinue = () => {
    const count = Number(employeeCount);
    if (!count || count < 1) {
      toast({
        title: "Enter employee count",
        description: "How many people will use NestHR?",
        variant: "destructive",
      });
      return;
    }
    setStep("plan");
  };

  const loadRazorpayScript = (): Promise<boolean> =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handlePay = async () => {
    const count = Number(employeeCount);
    if (!user?.company && !companyForm) {
      toast({
        title: "Company details missing",
        description: "Please go back and fill in your company details.",
        variant: "destructive",
      });
      return;
    }
    setPaying(true);
    try {
      const res = await billingAPI.createOrder(
        count,
        billing,
        "razorpay",
        user?.company ? undefined : companyForm!,
      );
      if (!res.success) throw new Error("Failed to create order");
      const order = res.data;

      const loaded = await loadRazorpayScript();
      if (!loaded)
        throw new Error(
          "Failed to load payment checkout. Check your connection.",
        );

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amount * 100,
          currency: order.currency || "INR",
          name: "NestHR",
          description: `NestHR — ${count} employees — ${billing}`,
          theme: { color: "#024BAB" },
          handler: async (response: any) => {
            try {
              const verifyRes = await billingAPI.verifyRazorpay({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              toast({
                title: "Payment Successful!",
                description: "Subscription activated. Welcome to NestHR!",
                variant: "success",
              });
              const createdCompany = verifyRes.data?.company;
              updateUser({
                company: createdCompany
                  ? {
                      id: createdCompany._id,
                      name: createdCompany.name,
                      email: createdCompany.email,
                      status: createdCompany.status,
                    }
                  : { ...user?.company!, status: "active" },
                subscription: { status: "active" },
              });
              setTimeout(() => navigate("/welcome", { replace: true }), 1500);
              resolve();
            } catch (err: any) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => reject(new Error("Payment cancelled")),
          },
        });
        rzp.open();
      });
    } catch (err: any) {
      const msg = err.message || "Please try again.";
      if (msg.includes("User already has a company")) {
        toast({
          title: "Company already exists",
          description: "Redirecting...",
          variant: "destructive",
        });
        setTimeout(() => navigate("/", { replace: true }), 1800);
      } else if (err.message !== "Payment cancelled") {
        toast({
          title: "Could not initiate payment",
          description: msg,
          variant: "destructive",
        });
      }
      setPaying(false);
    }
  };

  const empCount = Number(employeeCount) || 0;
  const tier = getPricingTier(empCount || 1);
  const monthlyPrice = empCount * tier.rate;
  const yearlyPrice = Math.round(monthlyPrice * 12 * 0.9);
  const planPrice =
    billing === "yearly" ? Math.round(yearlyPrice / 12) : monthlyPrice;
  const planTotal = billing === "yearly" ? yearlyPrice : monthlyPrice;

  return (
    <div className="min-h-screen bg-[#F0F6FF]">
      {}
      <header className="bg-white border-b-2 border-black sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#024BAB] border-2 border-black flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-black text-xl text-black">
              NestHR
            </span>
          </div>
          <button
            onClick={logout}
            className="text-sm font-bold text-black hover:text-[#024BAB] transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <StepIndicator current={step} />

        {}
        {step === "company" && (
          <div>
            <div className="text-center mb-8">
              <h1 className="font-display font-black text-3xl text-black mb-2">
                Set up your company
              </h1>
              <p className="text-gray-500 font-medium text-sm">
                Your legal and contact details
              </p>
            </div>
            <div className="bg-white border-2 border-black p-8 max-w-2xl mx-auto">
              <CompanyDetailsForm
                loading={false}
                error={companyError}
                onError={setCompanyError}
                onSubmit={handleCreateCompany}
              />
            </div>
          </div>
        )}

        {}
        {step === "employees" && (
          <div>
            <div className="text-center mb-8">
              <h1 className="font-display font-black text-3xl text-black mb-2">
                How big is your team?
              </h1>
              <p className="text-gray-500 font-medium text-sm">
                We'll recommend the right plan based on your team size
              </p>
            </div>

            <div className="bg-white border-2 border-black p-8 max-w-sm mx-auto">
              <label className="block text-xs font-black uppercase tracking-wider text-black mb-3">
                Number of employees
              </label>
              <input
                type="number"
                min={1}
                value={employeeCount}
                onChange={(e) =>
                  setEmployeeCount(
                    e.target.value === ""
                      ? ""
                      : Math.max(1, parseInt(e.target.value) || 1),
                  )
                }
                placeholder="e.g. 15"
                autoFocus
                className="w-full border-2 border-black px-4 py-3 text-2xl font-black text-center focus:outline-none focus:ring-2 focus:ring-[#024BAB] mb-2"
              />
              <p className="text-xs text-gray-400 font-medium text-center mb-6">
                Include full-time, part-time, and contract staff
              </p>

              {/* Quick picks */}
              <div className="grid grid-cols-4 gap-2 mb-6">
                {[5, 10, 20, 50].map((n) => (
                  <button
                    key={n}
                    onClick={() => setEmployeeCount(n)}
                    className={cn(
                      "py-2 text-sm font-black border-2 transition-all",
                      Number(employeeCount) === n
                        ? "bg-[#024BAB] text-white border-black"
                        : "bg-white text-black border-black hover:bg-gray-50",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {employeeCount !== "" && Number(employeeCount) > 0 && (
                <div className="flex items-center gap-2 p-3 border-2 border-black mb-5 text-sm font-black bg-blue-50">
                  <Zap className="w-4 h-4 shrink-0" />
                  <span>
                    ₹{getPricingTier(Number(employeeCount)).rate}/employee/mo
                    for {employeeCount} employees (
                    {getPricingTier(Number(employeeCount)).label})
                  </span>
                </div>
              )}

              <button
                onClick={handleEmployeeContinue}
                className="w-full bg-[#024BAB] text-white border-2 border-black font-black uppercase text-sm px-4 py-3 flex items-center justify-center gap-2 hover:bg-[#023590] transition-all"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Plan Selection ───────────────────────────────────── */}
        {step === "plan" && (
          <div>
            <div className="text-center mb-8">
              <h1 className="font-display font-black text-3xl text-black mb-2">
                Choose your plan
              </h1>
              <p className="text-gray-500 font-medium text-sm">
                Priced per employee — based on your team of {employeeCount}
              </p>
            </div>

            {/* Billing toggle */}
            <div className="flex justify-center mb-8">
              <div className="flex items-center bg-white border-2 border-black overflow-hidden">
                <button
                  onClick={() => setBilling("monthly")}
                  className={cn(
                    "px-6 py-3 text-sm font-black uppercase transition-all border-r-2 border-black",
                    billing === "monthly"
                      ? "bg-[#024BAB] text-white"
                      : "text-black hover:bg-gray-50",
                  )}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBilling("yearly")}
                  className={cn(
                    "px-6 py-3 text-sm font-black uppercase relative transition-all",
                    billing === "yearly"
                      ? "bg-[#024BAB] text-white"
                      : "text-black hover:bg-gray-50",
                  )}
                >
                  Yearly
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] font-black px-2 py-0.5 border border-black whitespace-nowrap">
                    Save 10%
                  </span>
                </button>
              </div>
            </div>

            {/* Plan summary */}
            <div className="max-w-sm mx-auto border-2 border-black bg-white p-6 mb-8">
              <div className="flex items-center gap-1 bg-[#024BAB] text-white border border-black px-2 py-0.5 text-xs font-black w-fit mb-3">
                <Users className="w-3 h-3" />
                {employeeCount} employees · {tier.label}
              </div>

              <div className="mb-4 pb-4 border-b-2 border-black">
                <div className="font-display font-black text-3xl text-[#024BAB]">
                  ₹{planPrice.toLocaleString("en-IN")}
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  /month · ₹{tier.rate}/employee
                </div>
                {billing === "yearly" && (
                  <div className="text-xs text-green-600 font-black mt-0.5">
                    ₹{planTotal.toLocaleString("en-IN")} billed yearly
                  </div>
                )}
              </div>

              <ul className="space-y-2">
                {PLAN_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs">
                    <Check className="w-3.5 h-3.5 text-[#024BAB] shrink-0 mt-0.5" />
                    <span className="text-gray-700 font-medium">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="max-w-sm mx-auto">
              <button
                onClick={() => setStep("payment")}
                className="w-full bg-[#024BAB] text-white border-2 border-black font-black uppercase text-sm px-4 py-3 flex items-center justify-center gap-2 hover:bg-[#023590] transition-all"
              >
                Continue to Payment
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setStep("employees")}
                className="w-full text-center text-xs text-gray-400 hover:text-black font-bold mt-3 transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Payment ─────────────────────────────────────────── */}
        {step === "payment" && (
          <div>
            <div className="text-center mb-8">
              <h1 className="font-display font-black text-3xl text-black mb-2">
                Confirm & Pay
              </h1>
              <p className="text-gray-500 font-medium text-sm">
                A secure Razorpay checkout will open to complete your payment
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-4">
              {/* Order summary */}
              <div className="bg-white border-2 border-black">
                <div className="p-5 border-b-2 border-black bg-[#F0F6FF]">
                  <p className="font-black text-xs uppercase text-gray-500">
                    Order Summary
                  </p>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-gray-600">Rate</span>
                    <span className="font-black text-black uppercase">
                      ₹{tier.rate}/employee/mo
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-gray-600">Billing</span>
                    <span className="font-black text-black capitalize">
                      {billing}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-gray-600">Employees</span>
                    <span className="font-black text-black">
                      {employeeCount}
                    </span>
                  </div>
                  {billing === "yearly" && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-gray-600">
                        Monthly equiv.
                      </span>
                      <span className="font-black text-gray-500">
                        ₹{planPrice.toLocaleString("en-IN")}/mo
                      </span>
                    </div>
                  )}
                  <div className="border-t-2 border-black pt-3 flex justify-between items-center">
                    <span className="font-black text-sm uppercase">Total</span>
                    <span className="font-black text-xl text-[#024BAB]">
                      ₹{planTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                  {billing === "yearly" && (
                    <div className="bg-green-50 border border-green-200 p-2 text-xs font-bold text-green-700 text-center">
                      You save ₹
                      {(
                        monthlyPrice * 12 -
                        yearlyPrice
                      ).toLocaleString("en-IN")}{" "}
                      compared to monthly billing
                    </div>
                  )}
                </div>
              </div>

              {/* What happens next */}
              <div className="bg-white border-2 border-black p-5">
                <p className="font-black text-xs uppercase text-gray-500 mb-3">
                  What happens next
                </p>
                <ol className="space-y-2 text-xs font-medium text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-[#024BAB] text-white flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    A Razorpay checkout window will open (secure page)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-[#024BAB] text-white flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    Complete payment using net banking, UPI, card, or wallet
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-[#024BAB] text-white flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    Complete payment and your subscription activates instantly
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-[#024BAB] text-white flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">
                      4
                    </span>
                    Confirmation sent to your email and WhatsApp
                  </li>
                </ol>
              </div>

              <button
                onClick={handlePay}
                disabled={paying}
                className="w-full bg-[#024BAB] text-white border-2 border-black font-black uppercase text-sm px-4 py-4 flex items-center justify-center gap-2 hover:bg-[#023590] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Opening checkout...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-5 h-5" />
                    Pay ₹{planTotal.toLocaleString("en-IN")} via Razorpay
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Secured by Razorpay · PCI-DSS compliant
              </div>

              <button
                onClick={() => setStep("plan")}
                className="w-full text-center text-xs text-gray-400 hover:text-black font-bold transition-colors"
              >
                ← Back to plan selection
              </button>
            </div>
          </div>
        )}
      </main>
      <Toaster />
    </div>
  );
}
