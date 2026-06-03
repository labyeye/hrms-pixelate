import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, ArrowRight } from "lucide-react";
import nesthrlogo from "../../assets/nesthr.png";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) navigate("/");
    else
      setError(result.error || "Login failed. Please check your credentials.");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Neubrutalism background accents */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#024BAB] opacity-5 -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#FA731C] opacity-5 translate-y-1/2 -translate-x-1/2" />

      {/* Card */}
      <div className="w-full max-w-md border-2 border-black bg-white nb-shadow-lg relative z-10">
        {/* Top accent bar */}
        <div className="h-2 bg-[#024BAB] border-b-2 border-black" />

        <div className="p-8 md:p-10">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img
              src={nesthrlogo}
              alt="NestHR"
              className="h-14 w-auto object-contain"
            />
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h1 className="text-2xl font-display font-black text-black leading-tight">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to your workspace
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-[#EF4444]/10 border-2 border-[#EF4444] text-[#EF4444] text-sm px-3 py-2.5 mb-5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="you@company.com"
                className="w-full px-3 py-2.5 border-2 border-black text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB] focus:ring-offset-0 nb-shadow-sm"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="flex border-2 border-black nb-shadow-sm">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Your password"
                  className="flex-1 px-3 py-2.5 bg-white text-sm font-medium outline-none"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="px-3 border-l-2 border-black hover:bg-gray-50 transition-colors"
                >
                  {showPw ? (
                    <EyeOff className="w-4 h-4 text-black" />
                  ) : (
                    <Eye className="w-4 h-4 text-black" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#024BAB] text-white py-3 text-sm font-black border-2 border-black nb-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#0a0a0a] transition-all mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-6 pt-6 border-t-2 border-black/10 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              New to NestHR?{" "}
              <Link
                to="/register"
                className="font-black text-black underline hover:text-[#024BAB] transition-colors"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Feature chips */}
      <div className="flex flex-wrap justify-center gap-2 mt-6 relative z-10">
        {["Attendance", "Payroll", "Leave", "Reports"].map((s) => (
          <span
            key={s}
            className="border-2 border-black bg-white text-black px-3 py-1 text-xs font-black nb-shadow-sm"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
