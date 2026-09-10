import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useAccountMode } from "@/lib/account-mode-context";
import { useCurrency, AVAILABLE_CURRENCIES } from "@/lib/currency-context";
import { soundFX } from "@/lib/sound-engine";
import { CryptoIcon } from "@/components/CryptoIcon";
import { LiveTickerBar } from "./LiveTickerBar";
import { Button } from "@/components/ui/button";
import { DewLogo } from "@/components/DewLogo";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp,
  LogOut,
  Menu,
  X,
  Shield,
  LayoutDashboard,
  ChartLine as LineChart,
  Store,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  Activity,
  Users,
  Bot,
  Sparkles,
  Headphones,
  Megaphone,
  Mail,
  User,
  ChevronDown,
  Circle as HelpCircle,
  Gift,
  Play,
  ShoppingCart,
  SquareMinus as MinusSquare,
  Zap,
  Cpu,
  Layers,
  Bitcoin,
  Wallet,
  Camera,
  ArrowDownUp,
  Trophy,
  Volume2,
  VolumeX,
  Search,
  LayoutGrid,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationBell } from "./NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: { label: string; tone: "gold" | "yellow" | "platinum" | "amber" };
};

const ADMIN_EMAILS = ["simonosawaru255@gmail.com", "bayo@gmail.com"];

export function Navbar() {
  const { user, signOut } = useAuth();
  const { mode, balance, fiatLiveBalance, cryptoBalance } = useAccountMode();
  const { currency, setCurrency, currencyInfo, formatCurrency } = useCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(soundFX.isEnabled());

  // Global hotkey: Cmd+K / Ctrl+K opens Navigation Menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const toggleAudio = () => {
    const next = soundFX.toggle();
    setAudioEnabled(next);
    if (next) soundFX.playClick();
  };

  const { data: profile } = useQuery({
    queryKey: ["user_profile_navbar", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, full_name, role")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const avatarUrl = profile?.avatar_url;

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    const userEmail = user.email?.toLowerCase();
    if (userEmail && ADMIN_EMAILS.includes(userEmail)) {
      setIsAdmin(true);
      return;
    }
    (async () => {
      try {
        const [{ data: roles }, { data: prof }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", user.id),
          supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
        ]);
        const hasRole = (roles ?? []).some(
          (r: any) => r.role === "admin" || r.role === "super_admin",
        );
        const hasProf = Boolean(prof?.role === "admin" || prof?.role === "super_admin");
        setIsAdmin(hasRole || hasProf || (userEmail ? ADMIN_EMAILS.includes(userEmail) : false));
      } catch (e) {
        console.warn("Navbar admin check failed:", e);
      }
    })();
  }, [user]);

  const sections: { title: string; items: NavItem[] }[] = useMemo(
    () => [
      {
        title: "TRADING",
        items: [
          {
            to: "/dashboard",
            label: "Dashboard",
            icon: <LayoutDashboard className="h-4 w-4" />,
            badge: { label: "CORE", tone: "gold" },
          },
          {
            to: "/trade",
            label: "Trade",
            icon: <LineChart className="h-4 w-4" />,
            badge: { label: "100x", tone: "amber" },
          },
          {
            to: "/swap",
            label: "Swap",
            icon: <ArrowDownUp className="h-4 w-4" />,
            badge: { label: "0% Fee", tone: "yellow" },
          },
          {
            to: "/buy-bitcoin",
            label: "Buy Bitcoin",
            icon: <Bitcoin className="h-4 w-4" />,
            badge: { label: "INSTANT", tone: "gold" },
          },
          {
            to: "/buy-xrp",
            label: "Buy XRP",
            icon: <CryptoIcon symbol="XRP" size="xs" />,
            badge: { label: "FAST", tone: "gold" },
          },
          {
            to: "/market",
            label: "Market",
            icon: <Store className="h-4 w-4" />,
          },
        ],
      },
      {
        title: "BOTS & SIGNALS",
        items: [
          {
            to: "/ai-bots",
            label: "AI Bots",
            icon: <Bot className="h-4 w-4" />,
            badge: { label: "AUTO", tone: "gold" },
          },
          {
            to: "/signals",
            label: "Signals",
            icon: <Sparkles className="h-4 w-4" />,
            badge: { label: "ALPHA", tone: "amber" },
          },
          {
            to: "/copy-trading",
            label: "Copy Trading",
            icon: <Users className="h-4 w-4" />,
            badge: { label: "TOP 1%", tone: "gold" },
          },
          {
            to: "/pre-market",
            label: "Pre-Market",
            icon: <Layers className="h-4 w-4" />,
          },
          {
            to: "/leaderboard",
            label: "Leaderboard",
            icon: <Trophy className="h-4 w-4" />,
            badge: { label: "$50k Pool", tone: "gold" },
          },
        ],
      },
      {
        title: "WALLET & FUNDS",
        items: [
          {
            to: "/deposit",
            label: "Deposit",
            icon: <ArrowDownToLine className="h-4 w-4" />,
            badge: { label: "INSTANT", tone: "gold" },
          },
          {
            to: "/withdraw",
            label: "Withdraw",
            icon: <ArrowUpFromLine className="h-4 w-4" />,
          },
          {
            to: "/assets",
            label: "Assets",
            icon: <Wallet className="h-4 w-4" />,
          },
          {
            to: "/transactions",
            label: "Transactions",
            icon: <Activity className="h-4 w-4" />,
          },
        ],
      },
      {
        title: "ACCOUNT & SUPPORT",
        items: [
          {
            to: "/profile",
            label: "Profile",
            icon: <User className="h-4 w-4" />,
          },
          {
            to: "/kyc",
            label: "KYC Verification",
            icon: <Shield className="h-4 w-4" />,
            badge: { label: "SECURE", tone: "platinum" },
          },
          {
            to: "/referrals",
            label: "Referrals",
            icon: <Gift className="h-4 w-4" />,
          },
          {
            to: "/announcements",
            label: "Announcements",
            icon: <Megaphone className="h-4 w-4" />,
          },
          {
            to: "/support",
            label: "Support",
            icon: <Mail className="h-4 w-4" />,
          },
          ...(isAdmin
            ? [
                {
                  to: "/admin",
                  label: "Admin Panel",
                  icon: <Shield className="h-4 w-4 text-amber-400" />,
                  badge: { label: "ADMIN", tone: "gold" },
                } as NavItem,
                {
                  to: "/admin-ops",
                  label: "Admin Ops",
                  icon: <Cpu className="h-4 w-4 text-amber-400" />,
                  badge: { label: "OPS", tone: "gold" },
                } as NavItem,
              ]
            : []),
        ],
      },
    ],
    [isAdmin],
  );

  const toneBg: Record<string, string> = {
    gold: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    yellow: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    platinum: "bg-zinc-800 text-zinc-300 border-zinc-700",
    amber: "bg-amber-400/20 text-amber-200 border-amber-400/30",
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (i) =>
            i.label.toLowerCase().includes(q) ||
            i.to.toLowerCase().includes(q) ||
            (i.badge && i.badge.label.toLowerCase().includes(q)),
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [searchQuery, sections]);

  const currentPath = location.pathname;

  return (
    <>
      <LiveTickerBar />
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07090e]/80 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:px-5">
          {/* Brand & Sleek Expandable Trigger */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link to="/" className="flex items-center shrink-0">
              <DewLogo size="sm" showText tagline={false} />
            </Link>

            {/* Sleek Hamburger Expandable Menu Trigger Button */}
            {user && (
              <button
                onClick={() => setOpen(true)}
                className="relative flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-200 backdrop-blur-md hover:bg-white/[0.08] hover:border-amber-500/40 hover:text-amber-300 transition-all duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] group"
                title="Open Navigation Menu (⌘K)"
                aria-label="Open Navigation Menu"
              >
                <div className="flex flex-col gap-1 items-center justify-center w-4 h-3.5">
                  <span className="w-3.5 h-[2px] rounded-full bg-amber-400 group-hover:w-4 transition-all" />
                  <span className="w-4 h-[2px] rounded-full bg-zinc-200 group-hover:bg-amber-300 transition-all" />
                  <span className="w-2.5 h-[2px] rounded-full bg-amber-400 group-hover:w-4 transition-all" />
                </div>
                <span className="hidden sm:inline font-medium tracking-wide">Menu</span>
                <kbd className="hidden lg:inline-flex items-center rounded border border-white/10 bg-black/40 px-1 py-0.2 text-[9px] font-mono text-zinc-400">
                  ⌘K
                </kbd>
              </button>
            )}
          </div>

          {/* Right Section: Currency, Audio, Balance, Profile */}
          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              {/* Currency Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex h-8 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md px-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/[0.08] hover:border-white/20 transition-all"
                    title="Change Base Currency"
                  >
                    <span>{currencyInfo.flag}</span>
                    <span className="text-zinc-200">{currencyInfo.code}</span>
                    <ChevronDown className="h-3 w-3 text-zinc-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 max-h-72 overflow-y-auto bg-[#0c0f17]/95 backdrop-blur-xl border border-white/10 shadow-2xl"
                >
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Base Currency
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  {AVAILABLE_CURRENCIES.map((c) => (
                    <DropdownMenuItem
                      key={c.code}
                      onClick={() => setCurrency(c.code)}
                      className={`flex items-center justify-between text-xs cursor-pointer ${
                        c.code === currency ? "bg-amber-500/20 text-amber-300 font-bold" : ""
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{c.flag}</span>
                        <span>{c.code}</span>
                        <span className="text-muted-foreground text-[10px]">({c.symbol})</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">{c.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Audio Sound FX Toggle */}
              <button
                onClick={toggleAudio}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08] transition-all"
                title={audioEnabled ? "Sound FX Enabled" : "Sound FX Muted"}
              >
                {audioEnabled ? (
                  <Volume2 className="h-4 w-4 text-amber-400" />
                ) : (
                  <VolumeX className="h-4 w-4 text-zinc-500" />
                )}
              </button>

              {/* Liquid Glass Balance Pill */}
              <div
                className="hidden sm:flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md px-3 py-1 cursor-default shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                title={
                  mode === "live"
                    ? `Live Balance: ${formatCurrency(balance)}\nCash: ${formatCurrency(fiatLiveBalance)}\nCrypto: ${formatCurrency(cryptoBalance)}`
                    : `Demo Balance: ${formatCurrency(balance)}`
                }
              >
                <Wallet className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs sm:text-sm font-bold tabular-nums text-white">
                  {formatCurrency(balance)}
                </span>
                {mode === "demo" && (
                  <Badge className="ml-0.5 bg-amber-500/15 text-amber-300 border-amber-500/30 text-[9px] px-1.5 py-0 font-bold">
                    DEMO
                  </Badge>
                )}
              </div>

              <NotificationBell />

              {/* User Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md px-2 py-1 hover:bg-white/[0.08] transition-all">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="h-6 w-6 rounded-full object-cover border border-amber-500/40"
                      />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/30 to-amber-600/10 text-[10px] font-bold text-amber-300 border border-amber-500/40">
                        {(user.email?.[0] ?? "U").toUpperCase()}
                      </div>
                    )}
                    <ChevronDown className="h-3 w-3 text-zinc-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-[#0c0f17]/95 backdrop-blur-xl border border-white/10 shadow-2xl"
                >
                  <DropdownMenuLabel className="truncate text-xs font-semibold text-zinc-200">
                    {profile?.full_name || user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })}>
                    <LayoutDashboard className="mr-2 h-4 w-4 text-amber-400" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                    <User className="mr-2 h-4 w-4 text-amber-400" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/kyc" })}>
                    <Shield className="mr-2 h-4 w-4 text-zinc-300" />
                    KYC Verification
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/referrals" })}>
                    <Gift className="mr-2 h-4 w-4 text-amber-300" />
                    Referrals
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/transactions" })}>
                    <Clock className="mr-2 h-4 w-4 text-zinc-400" />
                    Transactions
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        await signOut();
                      } catch (e) {
                        console.error(e);
                      }
                      navigate({ to: "/" });
                    }}
                    className="text-zinc-400 hover:text-white"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (
                    typeof window !== "undefined" &&
                    window.location.pathname.startsWith("/auth")
                  ) {
                    window.dispatchEvent(
                      new CustomEvent("auth-scroll-to", { detail: { tab: "signin" } }),
                    );
                  } else {
                    navigate({ to: "/auth", search: { next: "", tab: "signin" } });
                  }
                }}
              >
                Sign in
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold hover:brightness-110"
                onClick={() => {
                  if (
                    typeof window !== "undefined" &&
                    window.location.pathname.startsWith("/auth")
                  ) {
                    window.dispatchEvent(
                      new CustomEvent("auth-scroll-to", { detail: { tab: "signup" } }),
                    );
                  } else {
                    navigate({ to: "/auth", search: { next: "", tab: "signup" } });
                  }
                }}
              >
                Get started
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Expandable Side Hamburger Menu (Liquid Glass Drawer) */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed left-0 top-0 z-50 flex h-full w-[360px] max-w-[88vw] flex-col overflow-y-auto border-r border-white/10 bg-[#080b11]/95 text-zinc-100 backdrop-blur-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)]"
            >
              {/* Drawer Top Header */}
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 bg-[#06080e]/90">
                <Link to="/" onClick={() => setOpen(false)} className="flex items-center">
                  <DewLogo size="sm" showText tagline={true} />
                </Link>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-xl p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Instant Search Bar */}
              <div className="p-3 border-b border-white/10 bg-[#0b0e16]/80">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search features, tools, routes..."
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-8 text-xs text-white placeholder-zinc-500 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Quick Action Shortcuts */}
                <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
                  <button
                    onClick={() => {
                      setOpen(false);
                      navigate({ to: "/deposit" });
                    }}
                    className="flex items-center gap-1 shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-amber-300 hover:bg-amber-500/20 font-semibold transition-all"
                  >
                    <ArrowDownToLine className="h-3 w-3" /> Deposit
                  </button>
                  <button
                    onClick={() => {
                      setOpen(false);
                      navigate({ to: "/swap" });
                    }}
                    className="flex items-center gap-1 shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-zinc-200 hover:bg-white/[0.08] transition-all"
                  >
                    <ArrowDownUp className="h-3 w-3 text-amber-400" /> Swap
                  </button>
                  <button
                    onClick={() => {
                      setOpen(false);
                      navigate({ to: "/trade" });
                    }}
                    className="flex items-center gap-1 shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-zinc-200 hover:bg-white/[0.08] transition-all"
                  >
                    <LineChart className="h-3 w-3 text-amber-400" /> Trade
                  </button>
                </div>
              </div>

              {/* Categorized Navigation Items */}
              <nav className="flex-1 space-y-5 px-3 py-4">
                {filteredSections.map((s) => (
                  <div key={s.title}>
                    <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      {s.title}
                    </div>
                    <ul className="space-y-0.5">
                      {s.items.map((i) => (
                        <li key={i.to + i.label}>
                          <Link
                            to={i.to as any}
                            onClick={() => setOpen(false)}
                            className={`flex items-center justify-between rounded-xl px-2.5 py-2 text-sm transition-all ${
                              currentPath === i.to
                                ? "bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                                : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"
                            }`}
                          >
                            <span className="flex items-center gap-2.5">
                              <span className="text-amber-400/90">{i.icon}</span>
                              <span>{i.label}</span>
                            </span>
                            {i.badge && (
                              <span
                                className={`rounded-full border px-1.5 py-0.2 text-[9px] font-bold ${
                                  toneBg[i.badge.tone] || toneBg.gold
                                }`}
                              >
                                {i.badge.label}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {user ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-start rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.05]"
                    onClick={async () => {
                      try {
                        await signOut();
                      } catch (e) {
                        console.error(e);
                      }
                      setOpen(false);
                      navigate({ to: "/" });
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </Button>
                ) : (
                  <div className="pt-2 space-y-2">
                    <Button
                      className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold"
                      onClick={() => {
                        setOpen(false);
                        navigate({ to: "/auth", search: { next: "", tab: "signup" } });
                      }}
                    >
                      Create Account
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full rounded-xl font-semibold border-zinc-700"
                      onClick={() => {
                        setOpen(false);
                        navigate({ to: "/auth", search: { next: "", tab: "signin" } });
                      }}
                    >
                      Sign In
                    </Button>
                  </div>
                )}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Floating Liquid Glass Bottom Navigation Dock */}
      {user && (
        <div className="fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[94%] sm:w-auto px-3 sm:px-4 py-2 rounded-2xl bg-[#090d15]/85 backdrop-blur-2xl border border-white/12 shadow-[0_12px_40px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.15)] flex items-center justify-around gap-1 sm:gap-3">
          {/* 1. Dashboard */}
          <Link
            to="/dashboard"
            className={`flex flex-col items-center py-1 px-2.5 sm:px-3 text-[10px] font-semibold transition-all duration-200 rounded-xl ${
              currentPath === "/dashboard"
                ? "text-amber-400 bg-amber-500/15 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]"
            }`}
          >
            <LayoutDashboard className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            <span className="mt-0.5 tracking-tight">Dashboard</span>
          </Link>

          {/* 2. Trade */}
          <Link
            to="/trade"
            className={`flex flex-col items-center py-1 px-2.5 sm:px-3 text-[10px] font-semibold transition-all duration-200 rounded-xl ${
              currentPath.startsWith("/trade")
                ? "text-amber-400 bg-amber-500/15 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]"
            }`}
          >
            <LineChart className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            <span className="mt-0.5 tracking-tight">Trade</span>
          </Link>

          {/* 3. Deposit (Elevated Liquid Gold Center Button) */}
          <Link
            to="/deposit"
            className="flex flex-col items-center -mt-5 group"
            title="Instant Deposit"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 text-black shadow-[0_8px_25px_rgba(245,158,11,0.45),inset_0_1px_1px_rgba(255,255,255,0.6)] group-hover:scale-105 group-hover:shadow-[0_10px_30px_rgba(245,158,11,0.6)] transition-all duration-300">
              <Plus className="h-6 w-6 stroke-[2.8]" />
            </div>
            <span className="text-[10px] font-bold text-amber-400 mt-1">Deposit</span>
          </Link>

          {/* 4. Swap */}
          <Link
            to="/swap"
            className={`flex flex-col items-center py-1 px-2.5 sm:px-3 text-[10px] font-semibold transition-all duration-200 rounded-xl ${
              currentPath.startsWith("/swap")
                ? "text-amber-400 bg-amber-500/15 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]"
            }`}
          >
            <ArrowDownUp className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            <span className="mt-0.5 tracking-tight">Swap</span>
          </Link>

          {/* 5. AI Bots */}
          <Link
            to="/ai-bots"
            className={`flex flex-col items-center py-1 px-2.5 sm:px-3 text-[10px] font-semibold transition-all duration-200 rounded-xl ${
              currentPath.startsWith("/ai-bots")
                ? "text-amber-400 bg-amber-500/15 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]"
            }`}
          >
            <Bot className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            <span className="mt-0.5 tracking-tight">AI Bots</span>
          </Link>

          {/* 6. More (Hamburger Trigger) */}
          <button
            onClick={() => setOpen(true)}
            className="flex flex-col items-center py-1 px-2.5 sm:px-3 text-[10px] font-semibold text-zinc-400 hover:text-amber-400 hover:bg-white/[0.04] transition-all duration-200 rounded-xl"
            title="Expand All Features"
          >
            <Menu className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            <span className="mt-0.5 tracking-tight">More</span>
          </button>
        </div>
      )}
    </>
  );
}
