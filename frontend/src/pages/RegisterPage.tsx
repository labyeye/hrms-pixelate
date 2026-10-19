import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { AlertCircle, ArrowRight } from "lucide-react";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await register(form);
    setLoading(false);
    if (result.success) navigate("/onboarding");
    else setError(result.error || "Registration failed.");
  };

  return (
    <AuthShell>
        <h2 className="font-display font-bold text-3xl text-black mb-1">
          Create account
        </h2>
        <p className="text-muted-foreground text-sm mb-8">
          Set up your HRMS workspace ·{" "}
          <Link
            to="/login"
            className="font-bold text-black underline hover:text-[#FA731C] transition-colors"
          >
            Sign in
          </Link>
        </p>

        {error && (
          <div className="flex items-center gap-2 bg-[#EF4444]/10 border-2 border-[#EF4444] text-[#EF4444] text-sm px-3 py-2.5 mb-5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 login-anim">
          <div>
            <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="John Smith"
              className="w-full px-4 py-3 border-2 border-black text-sm font-medium bg-white focus:outline-none transition-colors"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@company.com"
              className="w-full px-4 py-3 border-2 border-black text-sm font-medium bg-white focus:outline-none transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min. 6 characters"
              className="w-full px-4 py-3 border-2 border-black text-sm font-medium bg-white focus:outline-none transition-colors"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#024BAB] text-white py-3.5 text-sm font-bold border-2 border-black hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#0a0a0a] transition-all flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating account...
              </span>
            ) : (
              <>Create Account <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-4 text-center">
          © 2026 Pixelate Nest. All rights reserved.{" "}
          <a
            href="https://www.pixelatenest.com/legal/privacy-policy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#024BAB] hover:underline"
          >
            Privacy Policy
          </a>
          {" · "}
          <a
            href="https://www.pixelatenest.com/legal/terms-of-service.html"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#024BAB] hover:underline"
          >
            Terms of Service
          </a>
        </p>
    </AuthShell>
  );
}
