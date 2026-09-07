import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAccountMode } from "@/lib/account-mode-context";
import { useCurrency } from "@/lib/currency-context";
import { ConvertCryptoModal } from "@/components/ConvertCryptoModal";
import { SuspendedAccountAlert } from "@/components/SuspendedAccountAlert";
import { CryptoIcon } from "@/components/CryptoIcon";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Star,
  RefreshCw,
} from "lucide-react";
import { useBinancePrices, type Ticker } from "@/hooks/useBinancePrices";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — Dew Trades" },
      {
        name: "description",
        content: "Your live Dew Trades trading account and real-time crypto market.",
      },
      { property: "og:title", content: "Dashboard — Dew Trades" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SYMBOLS = [
  "XRPUSDT",
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "ADAUSDT",
  "MNTUSDT",
  "DOGEUSDT",
];
const SYMBOL_META: Record<
  string,
  { icon: string; name: string; leverage: string; hot?: boolean; gainer?: boolean }
> = {
  XRPUSDT: { icon: "✕", name: "XRP", leverage: "10x", hot: true, gainer: true },
  BTCUSDT: { icon: "₿", name: "Bitcoin", leverage: "10x", hot: true, gainer: true },
  ETHUSDT: { icon: "Ξ", name: "Ethereum", leverage: "10x", hot: true, gainer: true },
  BNBUSDT: { icon: "B", name: "BNB", leverage: "10x", hot: true },
  SOLUSDT: { icon: "◎", name: "Solana", leverage: "5x", hot: true, gainer: true },
  ADAUSDT: { icon: "₳", name: "Cardano", leverage: "5x" },
  MNTUSDT: { icon: "M", name: "Mantle", leverage: "5x" },
  DOGEUSDT: { icon: "Ð", name: "Dogecoin", leverage: "5x", hot: true },
};

type FilterId = "favorites" | "hot" | "new" | "gainers" | "losers";
const FILTERS: { id: FilterId; label: string }[] = [
  { id: "favorites", label: "Favorites" },
  { id: "hot", label: "Hot" },
  { id: "new", label: "New" },
  { id: "gainers", label: "Gainers" },
  { id: "losers", label: "Losers" },
];

function Dashboard() {
  const { user } = useAuth();
  const { mode, balance, fiatLiveBalance, cryptoBalance, switchMode } = useAccountMode();
  const { formatCurrency } = useCurrency();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterId>("hot");
  const [market, setMarket] = useState<"spot" | "futures">("spot");
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [favs, setFavs] = useState<string[]>(() =>
    typeof window !== "undefined" ? JSON.parse(localStorage.getItem("dewtrades_favs") ?? "[]") : [],
  );

  const { tickers, status } = useBinancePrices(SYMBOLS);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const kyc = (profile as any)?.kyc_status ?? "none";
  const name = (profile as any)?.full_name?.split(" ")[0] ?? "trader";

  const toggleMode = async () => {
    const next = mode === "live" ? "demo" : "live";
    await switchMode(next);
  };

  const toggleFav = (s: string) => {
    setFavs((prev) => {
      const next = prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s];
      if (typeof window !== "undefined")
        localStorage.setItem("dewtrades_favs", JSON.stringify(next));
      return next;
    });
  };

  const filteredSymbols = useMemo(() => {
    const list = SYMBOLS.filter((s) => {
      const t = tickers[s];
      const meta = SYMBOL_META[s];
      if (filter === "favorites") return favs.includes(s);
      if (filter === "hot") return meta.hot;
      if (filter === "gainers") return (t?.change ?? 0) > 0;
      if (filter === "losers") return (t?.change ?? 0) < 0;
      if (filter === "new") return ["MNTUSDT", "DOGEUSDT"].includes(s);
      return true;
    });
    return list.sort((a, b) => (tickers[b]?.change ?? 0) - (tickers[a]?.change ?? 0));
  }, [filter, tickers, favs]);

  const isSuspended = Boolean(profile?.is_suspended);

  return (
    <div className="space-y-5">
      {/* Account Suspended Alert Banner */}
      {isSuspended && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <SuspendedAccountAlert />
        </motion.div>
      )}

      {/* LIVE TRADING ACCOUNT card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden border-border/70 bg-[color:var(--navy)]/40 p-6 shadow-elegant">
          <div className="absolute inset-0 opacity-30 bg-morph pointer-events-none" />
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {mode === "demo" ? "DEMO TRADING ACCOUNT" : "LIVE TRADING ACCOUNT"}
              </div>
              <div className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
                {formatCurrency(balance)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="h-7 w-7 rounded-full object-cover border border-primary/40 shadow-sm"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white shadow-sm border border-blue-400/40">
                      {(user?.email?.[0] ?? "U").toUpperCase()}
                    </div>
                  )}
                  <span>
                    Welcome back, <span className="font-semibold text-foreground">{name}</span>
                  </span>
                </Link>
                {mode === "live" && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-400 border border-blue-500/20">
                      Cash Balance: {formatCurrency(fiatLiveBalance)}
                    </span>
                    <Link
                      to="/assets"
                      className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                      title="View crypto assets ledger"
                    >
                      Crypto Holdings: {formatCurrency(cryptoBalance)}
                    </Link>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2">
              <button
                onClick={toggleMode}
                className="flex items-center gap-1 rounded-full bg-card/60 p-1 text-xs backdrop-blur"
              >
                <span
                  className={`rounded-full px-3 py-1 font-bold ${mode === "demo" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                >
                  DEMO
                </span>
                <span
                  className={`rounded-full px-3 py-1 font-bold ${mode === "live" ? "bg-success text-success-foreground" : "text-muted-foreground"}`}
                >
                  LIVE
                </span>
              </button>
              {kyc === "approved" ? (
                <Badge className="bg-success/20 text-success border-success/40">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  KYC verified
                </Badge>
              ) : (
                <Link to="/kyc">
                  <Badge variant="outline" className="cursor-pointer">
                    Submit KYC
                  </Badge>
                </Link>
              )}
            </div>
          </div>
          <div className="relative z-10 mt-5 flex flex-wrap gap-3">
            <Button
              asChild
              className="flex-1 sm:flex-none min-w-[130px] bg-primary text-primary-foreground hover:opacity-90"
            >
              <Link to="/deposit">
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                Deposit
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 sm:flex-none min-w-[130px]">
              <Link to="/withdraw">
                <ArrowUpFromLine className="mr-2 h-4 w-4" />
                Withdraw
              </Link>
            </Button>
            <Button
              onClick={() => setConvertModalOpen(true)}
              className="flex-1 sm:flex-none min-w-[160px] bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold shadow-md shadow-emerald-600/20"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Convert Crypto
            </Button>
            <Link
              to="/transactions"
              className="ml-auto self-center text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center"
            >
              Activity <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </motion.div>

      {/* XRP IS THE NEW BITCOIN - SPOTLIGHT BANNER */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-r from-sky-950/40 via-card to-background p-5 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/30">
                <CryptoIcon symbol="XRP" size="md" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-base tracking-tight text-foreground">
                    “XRP is the new bitcoin”
                  </span>
                  <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/40 text-[10px] uppercase font-bold">
                    Institutional Supercycle
                  </Badge>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]">
                    $50+ Target
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground max-w-2xl">
                  Global interbank liquidity is flowing into the XRP Ledger. Instant 3-sec
                  settlement with institutional deep liquidity is now live on Dew Trades.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                asChild
                size="sm"
                className="bg-sky-500 hover:bg-sky-600 text-white font-bold shadow-md shadow-sky-500/20"
              >
                <Link to="/buy-xrp">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Buy XRP
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10"
              >
                <Link to="/trade">Trade XRP</Link>
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Live Crypto Market */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Live Crypto Market</h2>
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
            <span
              className={`h-1.5 w-1.5 rounded-full ${status === "live" ? "bg-success animate-pulse" : "bg-muted-foreground"}`}
            />
            {status}
          </div>
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${filter === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1">
          {(["spot", "futures"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`rounded-md px-3 py-1 text-xs font-semibold ${market === m ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <div className="mt-3 divide-y divide-border">
          {filteredSymbols.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              No pairs match this filter.
            </div>
          ) : (
            filteredSymbols.map((s) => (
              <TickerRow
                key={s}
                sym={s}
                t={tickers[s]}
                fav={favs.includes(s)}
                toggleFav={() => toggleFav(s)}
              />
            ))
          )}
        </div>
      </Card>

      <ConvertCryptoModal open={convertModalOpen} onOpenChange={setConvertModalOpen} />
    </div>
  );
}

function TickerRow({
  sym,
  t,
  fav,
  toggleFav,
}: {
  sym: string;
  t?: Ticker;
  fav: boolean;
  toggleFav: () => void;
}) {
  const { formatPrice } = useCurrency();
  const meta = SYMBOL_META[sym];
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (!t) return;
    setFlash(t.direction === "up" ? "up" : t.direction === "down" ? "down" : null);
    const id = setTimeout(() => setFlash(null), 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.price, t?.direction]);

  const price = t?.price ?? 0;
  const change = t?.change ?? 0;
  const positive = change >= 0;
  const display = sym.replace("USDT", "/USDT");

  return (
    <Link
      to="/trade"
      className="flex items-center gap-3 px-1 py-3 hover:bg-accent/30 rounded-md transition"
    >
      <button
        onClick={(e) => {
          e.preventDefault();
          toggleFav();
        }}
        className="shrink-0 text-muted-foreground hover:text-primary"
      >
        <Star className={`h-3.5 w-3.5 ${fav ? "fill-primary text-primary" : ""}`} />
      </button>
      <CryptoIcon symbol={sym} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold truncate">{display}</span>
          <span className="rounded bg-muted px-1 py-px text-[9px] font-bold text-muted-foreground">
            {meta.leverage}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground">{meta.name}</div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={price}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          className={`shrink-0 text-right text-sm font-bold tabular-nums ${flash === "up" ? "text-success" : flash === "down" ? "text-destructive" : ""}`}
        >
          {formatPrice(price)}
        </motion.div>
      </AnimatePresence>
      <div
        className={`shrink-0 min-w-[62px] rounded-md px-2 py-1 text-right text-[11px] font-bold tabular-nums ${positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}
      >
        {positive ? "+" : ""}
        {change.toFixed(2)}%
      </div>
    </Link>
  );
}
