import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { billingAPI, companyAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import CompanyDetailsForm from "@/components/CompanyDetailsForm";
import {
  Check,
  Zap,
  Users,
  Loader2,
  Building2,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: 50,
    maxEmployees: 10,
    description: "For small teams",
    features: [
      "Up to 10 employees",
      "Employee Management",
      "Attendance Tracking",
      "Leave Management",
      "Basic Reports",
    ],
    whatsappAccess: false,
  },
  {
    id: "professional",
    name: "Professional",
    price: 100,
    maxEmployees: 20,
    description: "For growing teams",
    features: [
      "Up to 20 employees",
      "Advanced HR Management",
      "Payroll Processing",
      "Performance Reviews",
      "WhatsApp Integration",
      "Advanced Reports",
    ],
    whatsappAccess: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 200,
    maxEmployees: 50,
    description: "For large organizations",
    features: [
      "Up to 50 employees",
      "Full HR Suite",
      "Custom Workflows",
      "Advanced Analytics",
      "WhatsApp Integration",
      "Priority Support",
    ],
    whatsappAccess: true,
  },
];

function loadRazorpayScript() {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function OnboardingPage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<"company" | "plan">(
    user?.company ? "plan" : "company",
  );
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<
    "basic" | "professional" | "enterprise"
  >("professional");
  const [paying, setPaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [companyError, setCompanyError] = useState("");

  // If user already has company AND active subscription, redirect to dashboard
  useEffect(() => {
    if (user?.company && user?.subscription?.status === "active") {
      navigate("/", { replace: true });
    }
  }, [user?.company, user?.subscription?.status, navigate]);

  useEffect(() => {
    loadRazorpayScript();
  }, []);

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
    setLoading(true);
    try {
      const res = await companyAPI.create(formData);
      const company = res.data;

      // Update user with company info
      updateUser({
        company: {
          id: company._id,
          name: company.name,
          email: company.email,
          status: company.status,
        },
      });

      toast({ title: "Success", description: "Company created successfully!" });
      setStep("plan");
    } catch (err: any) {
      const errorMsg = err.message || "Failed to create company";
      if (errorMsg.includes("User already has a company")) {
        toast({
          title: "Company Already Exists",
          description:
            "Your account already has a company. Redirecting to dashboard...",
          variant: "destructive",
        });
        setTimeout(() => navigate("/", { replace: true }), 2000);
      } else {
        setCompanyError(errorMsg);
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const currentPlan = PLANS.find((p) => p.id === selectedPlan)!;

  const handlePay = async () => {
    setPaying(true);

    const loaded = await loadRazorpayScript();
    if (!loaded) {
      toast({
        title: "Payment unavailable",
        description: "Could not load payment gateway.",
        variant: "destructive",
      });
      setPaying(false);
      return;
    }

    try {
      const orderRes = await billingAPI.createOrder(selectedPlan, billing);
      const { orderId, amount } = orderRes.data;

      const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID;

      if (!keyId) {
        toast({
          title: "Configuration error",
          description: "Payment gateway is not configured.",
          variant: "destructive",
        });
        setPaying(false);
        return;
      }

      const options = {
        key: keyId,
        amount,
        currency: "INR",
        name: "NestHR",
        description: `${currentPlan.name} Plan (${currentPlan.maxEmployees} employees) — ${billing === "yearly" ? "Yearly" : "Monthly"}`,
        order_id: orderId,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
        },
        theme: { color: "#3B82F6" },
        modal: {
          ondismiss: () => setPaying(false),
        },
        handler: async (response: any) => {
          try {
            await billingAPI.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: selectedPlan,
              billingCycle: billing,
            });
            toast({
              title: "Payment successful!",
              description: `Welcome to NestHR ${currentPlan.name}!`,
            });

            // Update subscription and company status to active
            updateUser({
              company: { ...user?.company!, status: "active" },
              subscription: { status: "active" },
            });

            navigate("/", { replace: true });
          } catch (err: any) {
            toast({
              title: "Payment verification failed",
              description: err.message || "Please contact support.",
              variant: "destructive",
            });
            setPaying(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        toast({
          title: "Payment failed",
          description: "Please try again.",
          variant: "destructive",
        });
        setPaying(false);
      });
      rzp.open();
    } catch (err: any) {
      toast({
        title: "Could not initiate payment",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F6FF]">
      <header className="bg-white border-b-2 border-black sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
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

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Company Setup Step */}
        {step === "company" && (
          <div>
            <div className="text-center mb-12">
              {/* Progress circles */}
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-[#024BAB] border-2 border-black flex items-center justify-center text-white font-black text-sm">
                  1
                </div>
                <div className="w-12 h-0.5 bg-gray-300 border-t-2 border-dashed border-gray-300" />
                <div className="w-9 h-9 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-gray-400 font-black text-sm">
                  2
                </div>
              </div>
              <div className="inline-block bg-[#024BAB] text-white px-3 py-1.5 border-2 border-black text-xs font-black uppercase mb-4 nb-shadow-sm">
                Step 1 of 2
              </div>
              <h1 className="font-display font-black text-4xl text-black mb-3">
                Welcome to NestHR!
              </h1>
              <p className="text-gray-600 text-base font-medium">
                Set up your company details to get started
              </p>
            </div>

            <div className="bg-white border-2 border-black p-8 max-w-2xl mx-auto nb-shadow">
              <CompanyDetailsForm
                loading={loading}
                error={companyError}
                onError={setCompanyError}
                onSubmit={handleCreateCompany}
              />
            </div>
          </div>
        )}

        {/* Plan Selection Step */}
        {step === "plan" && (
          <div>
            <div className="text-center mb-12">
              {/* Progress circles */}
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-[#024BAB] border-2 border-black flex items-center justify-center text-white font-black text-sm">
                  <Check className="w-4 h-4" />
                </div>
                <div className="w-12 h-0.5 bg-[#024BAB] border-t-2 border-[#024BAB]" />
                <div className="w-9 h-9 rounded-full bg-[#024BAB] border-2 border-black flex items-center justify-center text-white font-black text-sm">
                  2
                </div>
              </div>
              <div className="inline-block bg-[#024BAB] text-white px-3 py-1.5 border-2 border-black text-xs font-black uppercase mb-4 nb-shadow-sm">
                Step 2 of 2
              </div>
              <h1 className="font-display font-black text-4xl text-black mb-3">
                Choose your plan
              </h1>
              <p className="text-gray-600 text-base font-medium">
                Select the right plan for your team size
              </p>
            </div>

            {/* Billing Toggle */}
            <div className="flex justify-center mb-12">
              <div className="flex items-center bg-white border-2 border-black overflow-hidden nb-shadow-sm">
                <button
                  onClick={() => setBilling("monthly")}
                  className={cn(
                    "px-6 py-3 text-sm font-black uppercase transition-all",
                    billing === "monthly"
                      ? "bg-[#024BAB] text-white border-r-2 border-black"
                      : "text-black hover:bg-gray-50",
                  )}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBilling("yearly")}
                  className={cn(
                    "px-6 py-3 text-sm font-black uppercase transition-all relative",
                    billing === "yearly"
                      ? "bg-[#024BAB] text-white"
                      : "text-black hover:bg-gray-50",
                  )}
                >
                  Yearly
                  {billing === "yearly" && (
                    <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-[#FA731C] text-white text-xs px-2 py-1 font-black border border-black">
                      Save 20%
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {PLANS.map((plan) => {
                const isSelected = selectedPlan === plan.id;
                const planMonthlyPrice = plan.price;
                const planYearlyPrice = plan.price * 12 * 0.8;

                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id as any)}
                    className={cn(
                      "relative p-6 border-2 transition-all text-left h-full flex flex-col nb-shadow-sm hover:nb-shadow",
                      isSelected
                        ? "border-black bg-white nb-shadow"
                        : "border-black bg-white hover:shadow-md",
                    )}
                  >
                    {isSelected && (
                      <div className="absolute -top-3 -right-3 bg-[#FA731C] border-2 border-black px-3 py-1 font-black text-xs text-white">
                        SELECTED
                      </div>
                    )}

                    <div className="mb-6">
                      <h3 className="font-display font-black text-2xl text-black">
                        {plan.name}
                      </h3>
                      <p className="text-xs text-gray-600 mt-2 font-medium">
                        {plan.description}
                      </p>
                    </div>

                    <div className="mb-6 pb-6 border-b-2 border-black">
                      <div className="font-display font-black text-3xl text-[#024BAB]">
                        ₹
                        {billing === "yearly"
                          ? Math.floor(planYearlyPrice / 12)
                          : planMonthlyPrice}
                      </div>
                      <span className="text-xs text-gray-600 font-medium">
                        {billing === "yearly" ? "/month (yearly)" : "/month"}
                      </span>
                      <div className="mt-3 text-xs font-black uppercase text-white bg-[#024BAB] border border-black px-2 py-1 inline-block">
                        Up to {plan.maxEmployees} employees
                      </div>
                    </div>

                    <ul className="space-y-3 mb-6 flex-grow">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-3 text-sm"
                        >
                          <Check className="w-4 h-4 text-[#024BAB] flex-shrink-0 mt-0.5 font-black" />
                          <span className="text-gray-700 font-medium">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            {/* Payment Button */}
            <div className="max-w-md mx-auto">
              <button
                onClick={handlePay}
                disabled={paying}
                className="w-full bg-[#024BAB] border-2 border-black text-white font-black uppercase text-sm px-4 py-4 hover:bg-[#023590] disabled:opacity-60 disabled:cursor-not-allowed transition-all nb-shadow-blue flex items-center justify-center gap-2"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Opening payment...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Pay & Activate →
                  </>
                )}
              </button>
              <p className="text-xs text-gray-600 text-center mt-4 font-medium">
                Secure payments powered by Razorpay
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
