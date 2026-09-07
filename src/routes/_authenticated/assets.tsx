import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCurrency } from "@/lib/currency-context";
import { useBinancePrices } from "@/hooks/useBinancePrices";
import { ConvertCryptoModal } from "@/components/ConvertCryptoModal";
import { CryptoIcon } from "@/components/CryptoIcon";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bitcoin,
  Wallet as WalletIcon,
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  PieChart,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  computeEnrichedCryptoAssets,
  CRYPTO_PRICE_SYMBOLS,
  SUPPORTED_CRYPTO_ASSETS,
} from "@/lib/crypto-assets";

export const Route = createFileRoute("/_authenticated/assets")({
  component: AssetsPage,
  head: () => ({
    meta: [
      { title: "My Assets — Dew Trades" },
      {
        name: "description",
        content: "Individual crypto wallets with live valuation and portfolio distribution.",
      },
      { property: "og:title", content: "My Assets — Dew Trades" },
      { property: "og:description", content: "Track every crypto wallet balance in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function fmt(n: number, decimals: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: Math.min(2, decimals),
    maximumFractionDigits: decimals,
  });
}

function AssetsPage() {
  const { user } = useAuth();
  const { formatCurrency, formatPrice, currencyInfo } = useCurrency();
  const { tickers } = useBinancePrices(CRYPTO_PRICE_SYMBOLS);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"value" | "name">("value");
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertSymbol, setConvertSymbol] = useState("ALL");

  const { data: wallets, isLoading } = useQuery({
    queryKey: ["my_crypto_wallets", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("user_crypto_balances")
        .select("*")
        .eq("user_id", user.id);
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select(
          "live_balance, available_cash, account_balance, demo_balance, account_mode, crypto_balances",
        )
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  const mode = (profile as any)?.account_mode as "demo" | "live" | undefined;
  const fiatBalance =
    mode === "demo"
      ? Number((profile as any)?.demo_balance ?? 0)
      : Number(
          (profile as any)?.available_cash ??
            (profile as any)?.live_balance ??
            (profile as any)?.account_balance ??
            0,
        );

  const { assets: enriched, totalCryptoUsd: totalCryptoValue } = useMemo(() => {
    return computeEnrichedCryptoAssets(wallets, (profile as any)?.crypto_balances, tickers);
  }, [wallets, profile, tickers]);

  const totalValue = fiatBalance + totalCryptoValue;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = enriched.filter((h) => !q || `${h.symbol} ${h.name}`.toLowerCase().includes(q));
    return [...list].sort((a, b) =>
      sort === "value" ? b.usdValue - a.usdValue : a.symbol.localeCompare(b.symbol),
    );
  }, [enriched, search, sort]);

  const distribution = useMemo(
    () => enriched.filter((h) => h.usdValue > 0).sort((a, b) => b.usdValue - a.usdValue),
    [enriched],
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-hero shadow-glow">
          <WalletIcon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Assets</h1>
          <p className="text-sm text-muted-foreground">
            Dedicated wallets for every supported cryptocurrency, valued live.
          </p>
        </div>
      </div>

      <Card className="p-6 bg-morph">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Live Balance (Total)
            </div>
            {isLoading ? (
              <Skeleton className="mt-2 h-9 w-40" />
            ) : (
              <div className="mt-1 text-3xl font-black tabular-nums text-foreground">
                {formatCurrency(totalValue)}
              </div>
            )}
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Sum of Cash Balance + Crypto Holdings
            </div>
          </div>
          <div className="rounded-xl bg-surface/80 border border-border/60 p-3.5">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">
              Cash Balance (USD)
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {formatCurrency(fiatBalance)}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Available cash for trading
            </div>
          </div>
          <div className="rounded-xl bg-surface/80 border border-border/60 p-3.5">
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Crypto Holdings
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-400">
              {formatCurrency(totalCryptoValue)}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">Valued in real-time</div>
          </div>
        </div>
      </Card>

      {/* QUICK CRYPTO TO LIVE BALANCE CONVERT BANNER */}
      <Card className="p-4 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border-emerald-500/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-emerald-950/40">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shrink-0">
            <RefreshCw className="h-6 w-6 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-white">
                Convert Crypto Holdings to {currencyInfo.code} Live Balance
              </span>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                0% Fee Instant
              </Badge>
            </div>
            <p className="text-xs text-slate-300">
              Liquidate your crypto holdings directly into your USD Live Balance to make funds
              immediately usable for trades & withdrawals.
            </p>
          </div>
        </div>

        <Button
          onClick={() => {
            setConvertSymbol("ALL");
            setConvertModalOpen(true);
          }}
          className="w-full sm:w-auto shrink-0 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {totalCryptoValue > 0
            ? `Convert All Crypto to USD ($${fmt(totalCryptoValue, 2)})`
            : "Convert Crypto to Live Cash"}
        </Button>
      </Card>

      {distribution.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <PieChart className="h-4 w-4 text-primary" /> Portfolio distribution
          </h2>
          <div className="space-y-2">
            {distribution.map((h) => {
              const pct = totalCryptoValue > 0 ? (h.usdValue / totalCryptoValue) * 100 : 0;
              return (
                <div key={h.symbol}>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">{h.symbol}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {pct.toFixed(1)}% · ${fmt(h.usdValue, 2)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface">
                    <motion.div
                      className="h-full rounded-full bg-gradient-hero"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Bitcoin className="h-4 w-4 text-primary" /> Crypto wallets
          </h2>
          <div className="relative ml-auto w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-8"
              placeholder="Search asset…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSort(sort === "value" ? "name" : "value")}
          >
            Sort: {sort === "value" ? "Value" : "Name"}
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((h, i) => (
              <motion.div
                key={h.symbol}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-center gap-3">
                  <CryptoIcon symbol={h.symbol} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{h.symbol}</div>
                    <div className="text-xs text-muted-foreground">{h.name}</div>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    spot
                  </Badge>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Balance</span>
                    <motion.span
                      key={h.qty}
                      initial={{ scale: 1.15, color: "hsl(var(--success))" }}
                      animate={{ scale: 1 }}
                      className="font-semibold tabular-nums"
                    >
                      {fmt(h.qty, h.decimals)} {h.symbol}
                    </motion.span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Live price</span>
                    <span className="font-semibold tabular-nums">{formatPrice(h.price)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1 text-sm">
                    <span className="text-muted-foreground">{currencyInfo.code} value</span>
                    <span className="font-bold tabular-nums text-success">
                      {formatCurrency(h.usdValue)}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 font-bold text-xs"
                    onClick={() => {
                      setConvertSymbol(h.symbol);
                      setConvertModalOpen(true);
                    }}
                  >
                    <RefreshCw className="mr-1 h-3 w-3 shrink-0" /> Convert
                  </Button>
                  <Button asChild size="sm" variant="outline" className="text-xs">
                    <Link to="/deposit">
                      <ArrowDownToLine className="mr-1 h-3 w-3 shrink-0" /> Deposit
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="text-xs">
                    <Link to="/withdraw">
                      <ArrowUpFromLine className="mr-1 h-3 w-3 shrink-0" /> Withdraw
                    </Link>
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      <ConvertCryptoModal
        open={convertModalOpen}
        onOpenChange={setConvertModalOpen}
        defaultSymbol={convertSymbol}
      />
    </motion.div>
  );
}
