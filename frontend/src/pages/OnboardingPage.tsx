import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { billingAPI, companyAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/Toaster";
import CompanyDetailsForm from "@/components/CompanyDetailsForm";
import {
  Check,
  Zap,
  Users,
  Loader2,
  Building2,
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

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 999,
    yearlyPrice: 9590,
    maxEmployees: 10,
    description: "For small teams just getting started",
    features: [
      "Up to 10 employees",
      "Employee management",
      "Attendance tracking",
      "Leave management",
      "Basic reports",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    monthlyPrice: 1999,
    yearlyPrice: 19190,
    maxEmployees: 25,
    description: "For growing teams that need more",
    popular: true,
    features: [
      "Up to 25 employees",
      "Everything in Starter",
      "Payroll processing",
      "Performance reviews",
      "WhatsApp notifications",
      "Biometric integration",
      "Advanced reports",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: 3999,
    yearlyPrice: 38390,
    maxEmployees: 100,
    description: "For large organisations",
    features: [
      "Up to 100 employees",
      "Everything in Professional",
      "Custom workflows",
      "Recruitment module",
      "NFC card setup",
      "Priority support",
      "Dedicated account manager",
    ],
  },
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
  const [selectedPlan, setSelectedPlan] = useState<string>("professional");
  const [paying, setPaying] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState("");

  useEffect(() => {
    if (user?.company && user?.subscription?.status === "active") {
      navigate("/", { replace: true });
    }
  }, [user?.company, user?.subscription?.status, navigate]);

  useEffect(() => {
    if (!employeeCount) return;
    const count = Number(employeeCount);
    if (count <= 10) setSelectedPlan("starter");
    else if (count <= 25) setSelectedPlan("professional");
    else setSelectedPlan("enterprise");
  }, [employeeCount]);

  const handleCreateCompany = async (formData: {
    name: string;
    email: string;
    phone: string;
    industry: string;
    website: string;
    gstNumber: string;
    panNumber: string;
  }) => {
    setCompanyError("");
    setCompanyLoading(true);
    try {
      const res = await companyAPI.create(formData);
      const company = res.data;
      updateUser({
        company: {
          id: company._id,
          name: company.name,
          email: company.email,
          status: company.status,
        },
      });
      toast({
        title: "Company created!",
        description: "Now tell us about your team.",
        variant: "success",
      });
      setStep("employees");
    } catch (err: any) {
      const msg = err.message || "Failed to create company";
      if (msg.includes("User already has a company")) {
        toast({
          title: "Company already exists",
          description: "Redirecting...",
          variant: "destructive",
        });
        setTimeout(() => navigate("/", { replace: true }), 1800);
      } else {
        setCompanyError(msg);
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    } finally {
      setCompanyLoading(false);
    }
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
    if (count > 100) {
      toast({
        title: "Enterprise+",
        description: "For over 100 employees, contact us for a custom plan.",
        variant: "destructive",
      });
      return;
    }
    setStep("plan");
  };

  const handlePay = async () => {
    setPaying(true);
    try {
      const res = await billingAPI.createOrder(selectedPlan, billing);
      const { paymentUrl } = res.data;
      if (!paymentUrl)
        throw new Error("Payment URL not received. Please try again.");

      window.location.href = paymentUrl;
    } catch (err: any) {
      toast({
        title: "Could not initiate payment",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
      setPaying(false);
    }
  };

  const plan = PLANS.find((p) => p.id === selectedPlan)!;
  const planPrice =
    billing === "yearly"
      ? Math.round(plan.yearlyPrice / 12)
      : plan.monthlyPrice;
  const planTotal = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

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
                loading={companyLoading}
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
                max={100}
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
                <div
                  className={cn(
                    "flex items-center gap-2 p-3 border-2 border-black mb-5 text-sm font-black",
                    Number(employeeCount) <= 10
                      ? "bg-blue-50"
                      : Number(employeeCount) <= 25
                        ? "bg-orange-50"
                        : "bg-purple-50",
                  )}
                >
                  <Zap className="w-4 h-4 shrink-0" />
                  <span>
                    We recommend the{" "}
                    <span className="uppercase">
                      {Number(employeeCount) <= 10
                        ? "Starter"
                        : Number(employeeCount) <= 25
                          ? "Professional"
                          : "Enterprise"}
                    </span>{" "}
                    plan for {employeeCount} employees
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
                {employeeCount
                  ? `Based on ${employeeCount} employees — we've highlighted the best fit`
                  : "Select the plan that suits your team"}
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
                    Save 20%
                  </span>
                </button>
              </div>
            </div>

            {/* Plans */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
              {PLANS.map((p) => {
                const isSelected = selectedPlan === p.id;
                const isRecommended =
                  employeeCount !== "" &&
                  ((p.id === "starter" && Number(employeeCount) <= 10) ||
                    (p.id === "professional" &&
                      Number(employeeCount) > 10 &&
                      Number(employeeCount) <= 25) ||
                    (p.id === "enterprise" && Number(employeeCount) > 25));
                const isTooSmall =
                  employeeCount !== "" &&
                  p.maxEmployees < Number(employeeCount);
                const price =
                  billing === "yearly"
                    ? Math.round(p.yearlyPrice / 12)
                    : p.monthlyPrice;
                const total =
                  billing === "yearly" ? p.yearlyPrice : p.monthlyPrice;

                return (
                  <button
                    key={p.id}
                    onClick={() => !isTooSmall && setSelectedPlan(p.id)}
                    disabled={isTooSmall}
                    className={cn(
                      "relative p-6 border-2 transition-all text-left flex flex-col",
                      isSelected
                        ? "border-black bg-white border-2"
                        : "border-black bg-white",
                      isTooSmall
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:border-2 cursor-pointer",
                    )}
                  >
                    {isRecommended && !isTooSmall && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FA731C] border-2 border-black px-3 py-0.5 font-black text-xs text-white whitespace-nowrap">
                        RECOMMENDED
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute -top-3 -right-3 w-6 h-6 bg-[#024BAB] border-2 border-black flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {isTooSmall && (
                      <div className="absolute -top-3 right-2 bg-gray-500 border-2 border-black px-2 py-0.5 font-black text-xs text-white">
                        TOO SMALL
                      </div>
                    )}

                    <h3 className="font-black text-xl text-black mb-1">
                      {p.name}
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mb-4">
                      {p.description}
                    </p>

                    <div className="mb-4 pb-4 border-b-2 border-black">
                      <div className="font-display font-black text-3xl text-[#024BAB]">
                        ₹{price.toLocaleString("en-IN")}
                      </div>
                      <div className="text-xs text-gray-500 font-medium">
                        /month
                      </div>
                      {billing === "yearly" && (
                        <div className="text-xs text-green-600 font-black mt-0.5">
                          ₹{total.toLocaleString("en-IN")} billed yearly
                        </div>
                      )}
                      <div className="mt-2 inline-flex items-center gap-1 bg-[#024BAB] text-white border border-black px-2 py-0.5 text-xs font-black">
                        <Users className="w-3 h-3" />
                        Up to {p.maxEmployees} employees
                      </div>
                    </div>

                    <ul className="space-y-2 flex-grow">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs">
                          <Check className="w-3.5 h-3.5 text-[#024BAB] shrink-0 mt-0.5" />
                          <span className="text-gray-700 font-medium">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
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
                You'll be redirected to HDFC SmartGateway to complete payment
                securely
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
                    <span className="font-bold text-gray-600">Plan</span>
                    <span className="font-black text-black uppercase">
                      {plan.name}
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
                      Up to {plan.maxEmployees}
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
                        plan.monthlyPrice * 12 -
                        plan.yearlyPrice
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
                    You'll be redirected to HDFC SmartGateway (secure page)
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
                    HDFC redirects you back and your subscription activates
                    instantly
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
                    Redirecting to HDFC...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-5 h-5" />
                    Pay ₹{planTotal.toLocaleString("en-IN")} via HDFC
                    SmartGateway
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Secured by HDFC SmartGateway · PCI-DSS compliant
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
