import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { registerDirectUser, autoConfirmEmail } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/Navbar";
import { DewLogo } from "@/components/DewLogo";
import { toast } from "sonner";
import { PasswordResetModal } from "@/components/PasswordResetModal";
import { CryptoIcon } from "@/components/CryptoIcon";
import {
  Loader2,
  ShieldCheck,
  Zap,
  Lock,
  LineChart,
  Bot,
  KeyRound,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  TrendingUp,
  Wallet,
  Globe2,
} from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (s: Record<string, unknown>) => ({
    next:
      typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//")
        ? s.next
        : "",
    tab:
      typeof s.tab === "string" && (s.tab === "signup" || s.tab === "signin")
        ? (s.tab as "signup" | "signin")
        : undefined,
    mode:
      typeof s.mode === "string" && (s.mode === "signup" || s.mode === "signin")
        ? (s.mode as "signup" | "signin")
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign In / Register — Dew Trades" },
      {
        name: "description",
        content:
          "Access the Dew Trades executive terminal with institutional liquidity, zero-fee swaps, and AI trading bots.",
      },
    ],
  }),
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  fullName: z.string().trim().min(1).max(80).optional(),
});

export function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [tab, setTab] = useState<"signin" | "signup">(
    (search.tab || search.mode) === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("United States");
  const [referralCode, setReferralCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  const authCardRef = useRef<HTMLDivElement>(null);

  const returnTo =
    search.next && search.next.startsWith("/") && !search.next.startsWith("//")
      ? search.next
      : "/dashboard";

  // Listen to custom navigation events from header buttons
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab?: "signin" | "signup" }>;
      if (customEvent.detail?.tab) {
        setTab(customEvent.detail.tab);
      }
      if (authCardRef.current) {
        authCardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    window.addEventListener("auth-scroll-to", handler);
    return () => window.removeEventListener("auth-scroll-to", handler);
  }, []);

  useEffect(() => {
    const target = search.tab || search.mode;
    if (target === "signup" || target === "signin") {
      setTab(target);
    }
  }, [search.tab, search.mode]);

  useEffect(() => {
    if (!loading && user) {
      if (returnTo === "/dashboard") navigate({ to: "/dashboard" });
      else window.location.href = returnTo;
    }
  }, [user, loading, navigate, returnTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);

    try {
      const parsed = schema.safeParse({
        email,
        password,
        fullName: tab === "signup" ? fullName : undefined,
      });

      if (!parsed.success) {
        toast.error(parsed.error.issues[0].message);
        setBusy(false);
        return;
      }

      if (tab === "signup") {
        try {
          await registerDirectUser({
            data: {
              email,
              password,
              fullName,
              country,
              referralCode: referralCode.trim() || undefined,
            },
          });
        } catch (serverErr: any) {
          console.warn("Server direct register fallback:", serverErr);
        }

        // Direct sign-in without waiting for email verification
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // If unconfirmed error occurs, auto-confirm and retry immediately
          await autoConfirmEmail({ data: { email } });
          const retry = await supabase.auth.signInWithPassword({ email, password });
          if (retry.error) throw retry.error;
        }

        toast.success("Account initialized! Welcome to Dew Trades.");
      } else {
        let { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const errMsg = (error.message || "").toLowerCase();
          if (errMsg.includes("confirm") || errMsg.includes("email")) {
            await autoConfirmEmail({ data: { email } });
            const retry = await supabase.auth.signInWithPassword({ email, password });
            if (!retry.error) {
              error = null;
            } else {
              throw retry.error;
            }
          } else {
            throw error;
          }
        }
        toast.success("Welcome back.");
      }

      if (returnTo === "/dashboard") navigate({ to: "/dashboard" });
      else window.location.href = returnTo;
    } catch (err: any) {
      toast.error(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${returnTo}`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message ?? "Google sign-in could not be completed.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070c] text-zinc-100 flex flex-col relative overflow-x-hidden selection:bg-amber-500/30 selection:text-amber-200">
      <Navbar />

      {/* Caustic Liquid Glass Ambient Lighting Refractions */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Amber caustic glow */}
        <div className="absolute -top-[15%] left-[20%] h-[550px] w-[550px] rounded-full bg-gradient-to-tr from-amber-500/18 via-yellow-500/10 to-transparent blur-[130px]" />
        {/* Oceanic cyan caustic glow */}
        <div className="absolute top-[40%] -right-[10%] h-[600px] w-[600px] rounded-full bg-gradient-to-bl from-cyan-500/12 via-blue-600/6 to-transparent blur-[150px]" />
        {/* Soft violet accent */}
        <div className="absolute -bottom-[20%] left-[10%] h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-purple-600/10 via-amber-500/6 to-transparent blur-[140px]" />
      </div>

      {/* Main Glass Workspace */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12 lg:py-16">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Liquid Glass Visual Display */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            {/* Status Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300 backdrop-blur-xl shadow-[0_0_20px_rgba(245,158,11,0.15)] w-fit">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span>Next-Gen Institutional Liquidity</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Trade global markets with{" "}
                <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-200 bg-clip-text text-transparent">
                  frictionless edge.
                </span>
              </h1>
              <p className="text-sm sm:text-base text-zinc-400 max-w-xl leading-relaxed">
                Experience institutional-grade execution with zero-fee asset swaps, automated AI
                trading bots, and instantaneous order routing on one unified platform.
              </p>
            </div>

            {/* Liquid Glass Interactive Metrics Display */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:border-amber-500/30 transition-all">
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                  <Wallet className="h-3.5 w-3.5" />
                  <span>Demo</span>
                </div>
                <div className="text-xl font-bold text-white mt-1 tabular-nums">$10,000</div>
                <div className="text-[11px] text-zinc-400">Practice Capital</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:border-amber-500/30 transition-all">
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                  <Zap className="h-3.5 w-3.5" />
                  <span>Swaps</span>
                </div>
                <div className="text-xl font-bold text-white mt-1">0% Fee</div>
                <div className="text-[11px] text-zinc-400">Zero Markup</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:border-amber-500/30 transition-all">
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                  <LineChart className="h-3.5 w-3.5" />
                  <span>Margin</span>
                </div>
                <div className="text-xl font-bold text-white mt-1">100x</div>
                <div className="text-[11px] text-zinc-400">Max Leverage</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:border-amber-500/30 transition-all">
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                  <Bot className="h-3.5 w-3.5" />
                  <span>AI Engine</span>
                </div>
                <div className="text-xl font-bold text-white mt-1">24/7</div>
                <div className="text-[11px] text-zinc-400">Auto Strategies</div>
              </div>
            </div>

            {/* Liquid Glass Market Ticker Preview */}
            <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-zinc-300 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-400" /> Live Liquidity Pulse
                </span>
                <span className="text-[10px] text-amber-400/90 font-mono">Stream: Active</span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                  <CryptoIcon symbol="BTC" size="sm" />
                  <div>
                    <div className="text-xs font-bold text-white">BTC/USDT</div>
                    <div className="text-[11px] text-amber-300 font-mono font-medium">$88,420</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                  <CryptoIcon symbol="ETH" size="sm" />
                  <div>
                    <div className="text-xs font-bold text-white">ETH/USDT</div>
                    <div className="text-[11px] text-amber-300 font-mono font-medium">$3,180</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                  <CryptoIcon symbol="XRP" size="sm" />
                  <div>
                    <div className="text-xs font-bold text-white">XRP/USDT</div>
                    <div className="text-[11px] text-amber-300 font-mono font-medium">$2.45</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Guarantee List */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-zinc-400 pt-1">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                256-Bit Cold Vaults
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-amber-400" />
                1:1 Asset Reserve Backing
              </span>
              <span className="flex items-center gap-1.5">
                <Globe2 className="h-4 w-4 text-amber-400" />
                Instant Account Activation
              </span>
            </div>
          </div>

          {/* Right Column: Liquid Glass Auth Card */}
          <div className="lg:col-span-5 w-full" ref={authCardRef} id="auth-column">
            <div className="relative rounded-3xl p-[1px] bg-gradient-to-b from-white/20 via-white/10 to-transparent shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
              <div className="rounded-[23px] bg-[#0b0e17]/85 backdrop-blur-2xl p-6 sm:p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] space-y-6">
                {/* Brand Header */}
                <div className="flex items-center justify-between">
                  <DewLogo size="md" showText tagline={false} />
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px] font-bold"
                  >
                    SECURE PORTAL
                  </Badge>
                </div>

                {/* Liquid Glass Pill Tabs Switcher */}
                <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#06080e]/90 border border-white/10 backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={() => setTab("signin")}
                    className={`py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
                      tab === "signin"
                        ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/15 text-amber-300 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("signup")}
                    className={`py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
                      tab === "signup"
                        ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/15 text-amber-300 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {/* Google Sign In (Liquid Glass Button) */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md py-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/[0.08] hover:border-white/20 transition-all shadow-sm"
                  onClick={handleGoogleSignIn}
                  disabled={busy}
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{tab === "signup" ? "Sign up with Google" : "Continue with Google"}</span>
                </Button>

                {/* Divider */}
                <div className="relative flex items-center justify-center">
                  <div className="w-full border-t border-white/10" />
                  <span className="absolute bg-[#0b0e17] px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Or with email
                  </span>
                </div>

                {/* Form Elements */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {tab === "signup" && (
                    <>
                      <div>
                        <Label htmlFor="fullName" className="text-xs font-semibold text-zinc-300">
                          Full Name
                        </Label>
                        <Input
                          id="fullName"
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Simon O."
                          required={tab === "signup"}
                          maxLength={80}
                          className="mt-1.5 rounded-xl border border-white/10 bg-[#06080e]/80 py-2 px-3 text-xs text-white placeholder-zinc-500 focus:border-amber-400/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
                        />
                      </div>

                      <div>
                        <Label htmlFor="country" className="text-xs font-semibold text-zinc-300">
                          Country of Residence
                        </Label>
                        <Input
                          id="country"
                          type="text"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          placeholder="United States"
                          required={tab === "signup"}
                          maxLength={80}
                          className="mt-1.5 rounded-xl border border-white/10 bg-[#06080e]/80 py-2 px-3 text-xs text-white placeholder-zinc-500 focus:border-amber-400/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
                        />
                      </div>

                      <div>
                        <Label htmlFor="referral" className="text-xs font-semibold text-zinc-300">
                          Referral Code{" "}
                          <span className="text-zinc-500 font-normal">(Optional)</span>
                        </Label>
                        <Input
                          id="referral"
                          type="text"
                          value={referralCode}
                          onChange={(e) => setReferralCode(e.target.value)}
                          placeholder="DEW-VIP-2026"
                          maxLength={40}
                          className="mt-1.5 rounded-xl border border-white/10 bg-[#06080e]/80 py-2 px-3 text-xs text-white placeholder-zinc-500 focus:border-amber-400/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <Label htmlFor="email" className="text-xs font-semibold text-zinc-300">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="trader@dewtrades.com"
                      required
                      maxLength={255}
                      className="mt-1.5 rounded-xl border border-white/10 bg-[#06080e]/80 py-2 px-3 text-xs text-white placeholder-zinc-500 focus:border-amber-400/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-xs font-semibold text-zinc-300">
                        Password
                      </Label>
                      {tab === "signin" && (
                        <button
                          type="button"
                          onClick={() => setResetModalOpen(true)}
                          className="text-xs text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 font-medium transition-colors"
                        >
                          <KeyRound className="h-3 w-3" />
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="relative mt-1.5">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        minLength={8}
                        maxLength={72}
                        className="rounded-xl border border-white/10 bg-[#06080e]/80 py-2 pl-3 pr-10 text-xs text-white placeholder-zinc-500 focus:border-amber-400/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button (Liquid Gold) */}
                  <Button
                    type="submit"
                    className="w-full rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-black font-extrabold hover:brightness-110 shadow-[0_4px_25px_rgba(245,158,11,0.35)] py-2.5 text-xs tracking-wide transition-all duration-300"
                    disabled={busy}
                  >
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4 stroke-[2.5]" />
                    )}
                    {tab === "signup" ? "Open Account Instantly" : "Sign In to Terminal"}
                  </Button>

                  {/* Switcher Link */}
                  <div className="pt-2 text-center text-xs text-zinc-400">
                    {tab === "signup" ? (
                      <span>
                        Already registered?{" "}
                        <button
                          type="button"
                          onClick={() => setTab("signin")}
                          className="font-bold text-amber-400 hover:text-amber-300 hover:underline transition-colors"
                        >
                          Sign in here
                        </button>
                      </span>
                    ) : (
                      <span>
                        Need an account?{" "}
                        <button
                          type="button"
                          onClick={() => setTab("signup")}
                          className="font-bold text-amber-400 hover:text-amber-300 hover:underline transition-colors"
                        >
                          Create free account
                        </button>
                      </span>
                    )}
                  </div>
                </form>

                {/* Footer Security Notice */}
                <div className="border-t border-white/10 pt-4 text-center text-[10px] text-zinc-500 space-y-1">
                  <p>
                    By connecting, you accept Dew Trades's{" "}
                    <Link to="/support" className="text-zinc-400 hover:text-amber-400 underline">
                      Terms of Service &amp; Risk Policy
                    </Link>
                    .
                  </p>
                  <p className="flex items-center justify-center gap-1.5 text-zinc-500">
                    <Lock className="h-3 w-3 text-amber-400/80" />
                    Encrypted · Immediate Activation · No Email Lockouts
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Password Reset Modal */}
      <PasswordResetModal
        open={resetModalOpen}
        onOpenChange={setResetModalOpen}
        defaultEmail={email}
      />
    </div>
  );
}
