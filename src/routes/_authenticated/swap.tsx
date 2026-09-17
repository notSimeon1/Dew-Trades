import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useBinancePrices } from "@/hooks/useBinancePrices";
import { soundFX } from "@/lib/sound-engine";
import { CryptoIcon } from "@/components/CryptoIcon";
import { VipBadge, getVipTier } from "@/components/VipBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownUp,
  RefreshCw,
  Zap,
  ShieldCheck,
  TrendingUp,
  Coins,
  ArrowRight,
  Info,
  CheckCircle2,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/swap")({
  component: InstantSwapPage,
  head: () => ({ meta: [{ title: "Instant Crypto Swap — Dew Trades" }] }),
});

type TokenOption = {
  symbol: string;
  name: string;
  icon: string;
  priceSymbol?: string;
  fallbackPrice: number;
};

const TOKENS: TokenOption[] = [
  { symbol: "USDT", name: "Tether USD", icon: "₮", fallbackPrice: 1.0 },
  { symbol: "BTC", name: "Bitcoin", icon: "₿", priceSymbol: "BTCUSDT", fallbackPrice: 96500 },
  { symbol: "ETH", name: "Ethereum", icon: "Ξ", priceSymbol: "ETHUSDT", fallbackPrice: 3450 },
  { symbol: "SOL", name: "Solana", icon: "◎", priceSymbol: "SOLUSDT", fallbackPrice: 195 },
  { symbol: "BNB", name: "BNB", icon: "B", priceSymbol: "BNBUSDT", fallbackPrice: 650 },
  { symbol: "XRP", name: "Ripple", icon: "✕", priceSymbol: "XRPUSDT", fallbackPrice: 2.45 },
  { symbol: "ADA", name: "Cardano", icon: "₳", priceSymbol: "ADAUSDT", fallbackPrice: 0.85 },
  { symbol: "DOGE", name: "Dogecoin", icon: "Ð", priceSymbol: "DOGEUSDT", fallbackPrice: 0.28 },
];

const BINANCE_PRICE_SYMBOLS = TOKENS.filter((t) => t.priceSymbol).map((t) => t.priceSymbol!);

function InstantSwapPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [fromSymbol, setFromSymbol] = useState("USDT");
  const [toSymbol, setToSymbol] = useState("BTC");
  const [fromAmount, setFromAmount] = useState("");
  const [slippage, setSlippage] = useState(0.5); // %
  const [swapping, setSwapping] = useState(false);

  // Live prices from Binance
  const { tickers } = useBinancePrices(BINANCE_PRICE_SYMBOLS);

  // User profiles & crypto balances
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: cryptoBalances, refetch: refetchBalances } = useQuery({
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
  });

  // Calculate user total deposit / balance for VIP tier perks
  const totalUserValue = Number(profile?.live_balance ?? 0);
  const vipTier = getVipTier(totalUserValue);
  const isVipFeeFree = vipTier === "Whale" || vipTier === "Gold";

  // Helper to get USD price of token
  const getUsdPrice = (symbol: string): number => {
    if (symbol === "USDT") return 1.0;
    const token = TOKENS.find((t) => t.symbol === symbol);
    if (!token) return 1.0;
    if (token.priceSymbol && tickers[token.priceSymbol]?.price) {
      return tickers[token.priceSymbol].price;
    }
    return token.fallbackPrice;
  };

  const fromPrice = getUsdPrice(fromSymbol);
  const toPrice = getUsdPrice(toSymbol);

  // Rate: How many ToTokens per FromToken
  const swapRate = useMemo(() => {
    if (toPrice <= 0) return 0;
    return fromPrice / toPrice;
  }, [fromPrice, toPrice]);

  // Available Balance for selected token (USDT is treated as its own crypto token wallet, separate from live USD fiat balance)
  const getBalance = (symbol: string): number => {
    const symUpper = symbol.toUpperCase();
    const jsonBalances = ((profile as { crypto_balances?: Record<string, number> })
      ?.crypto_balances ?? {}) as Record<string, number>;
    const jsonQty = Number(jsonBalances[symUpper] ?? jsonBalances[symUpper.toLowerCase()] ?? 0);

    const found = (cryptoBalances ?? []).find(
      (b: Record<string, unknown>) =>
        String(b.asset_symbol || b.symbol || "").toUpperCase() === symUpper,
    );
    const rowQty = Number(
      (found as { balance?: number; amount?: number })?.balance ??
        (found as { balance?: number; amount?: number })?.amount ??
        0,
    );

    return Math.max(0, rowQty, jsonQty);
  };

  const availableFromBalance = getBalance(fromSymbol);

  // Output Amount
  const inputNum = Number(fromAmount) || 0;
  const rawOutput = inputNum * swapRate;
  const feePct = isVipFeeFree ? 0 : 0.25; // 0.25% standard, 0% VIP
  const feeAmount = (rawOutput * feePct) / 100;
  const netOutput = Math.max(0, rawOutput - feeAmount);

  const flipTokens = () => {
    soundFX.playClick();
    const temp = fromSymbol;
    setFromSymbol(toSymbol);
    setToSymbol(temp);
    setFromAmount("");
  };

  const handleSetMax = () => {
    soundFX.playClick();
    setFromAmount(availableFromBalance > 0 ? String(availableFromBalance) : "0");
  };

  const executeSwap = async () => {
    if (!user) return toast.error("Please log in to swap");
    if (inputNum <= 0) return toast.error("Enter a valid swap amount");
    if (inputNum > availableFromBalance) return toast.error(`Insufficient ${fromSymbol} balance`);
    if (fromSymbol === toSymbol) return toast.error("Select two different tokens to swap");

    setSwapping(true);
    soundFX.playSwap();
    soundFX.triggerHaptic(40);

    try {
      const currentFromBal = getBalance(fromSymbol);
      if (inputNum > currentFromBal) {
        throw new Error(`Insufficient ${fromSymbol} balance.`);
      }

      const newFromBal = Number(Math.max(0, currentFromBal - inputNum).toFixed(8));
      const currentToBal = getBalance(toSymbol);
      const newToBal = Number((currentToBal + netOutput).toFixed(8));

      // 1. Prepare updated JSON map for crypto_balances
      const updatedJson = {
        ...(((profile as { crypto_balances?: Record<string, number> })?.crypto_balances ??
          {}) as Record<string, number>),
        [fromSymbol]: newFromBal,
        [toSymbol]: newToBal,
      };

      // 2. Upsert both asset symbols in user_crypto_balances table
      await Promise.all([
        supabase.from("user_crypto_balances").upsert(
          {
            user_id: user.id,
            symbol: fromSymbol,
            balance: newFromBal,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "user_id,symbol" },
        ),
        supabase.from("user_crypto_balances").upsert(
          {
            user_id: user.id,
            symbol: toSymbol,
            balance: newToBal,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "user_id,symbol" },
        ),
      ]);

      // 3. Update profiles table crypto_balances JSON
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          crypto_balances: updatedJson as unknown as Record<string, number>,
        })
        .eq("id", user.id);

      if (profErr) throw profErr;

      // 4. Record transaction log
      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "trade",
        amount: inputNum * fromPrice,
        description: `Instant Swap: ${inputNum.toFixed(4)} ${fromSymbol} → ${netOutput.toFixed(4)} ${toSymbol}`,
        status: "approved",
      });

      soundFX.playDepositBonus();
      toast.success(
        `Swapped ${inputNum.toFixed(4)} ${fromSymbol} for ${netOutput.toFixed(4)} ${toSymbol} successfully!`,
      );

      setFromAmount("");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["my_crypto_wallets"] });
      qc.invalidateQueries({ queryKey: ["user_profile_navbar"] });
      refetchBalances();
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? "Swap failed");
    } finally {
      setSwapping(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Zap className="h-6 w-6 text-amber-400" /> Instant Crypto Swapper
            </h1>
            <VipBadge amount={totalUserValue} size="md" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Exchange your crypto assets instantly at real-time market rates with zero slippage
            guarantees.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/assets"
            className="rounded-xl bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Coins className="h-3.5 w-3.5 text-emerald-400" /> Portfolio Wallets
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_340px]">
        {/* Main Swapper Card */}
        <Card className="p-5 bg-slate-900/90 border-slate-800 rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="space-y-4">
            {/* FROM TOKEN SECTION */}
            <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4 space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span className="font-semibold text-slate-300">You Pay</span>
                <span>
                  Balance:{" "}
                  <strong className="text-emerald-400 font-mono">
                    {availableFromBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
                    {fromSymbol}
                  </strong>
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="border-0 bg-transparent text-2xl font-black font-mono text-white focus-visible:ring-0 p-0 h-auto"
                />

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleSetMax}
                    className="rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 text-[10px] font-bold hover:bg-emerald-500/30 transition-colors"
                  >
                    MAX
                  </button>

                  <div className="flex items-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 px-2 py-1">
                    <CryptoIcon symbol={fromSymbol} size="sm" />
                    <select
                      value={fromSymbol}
                      onChange={(e) => {
                        soundFX.playClick();
                        setFromSymbol(e.target.value);
                      }}
                      className="bg-transparent text-white font-bold text-sm outline-none cursor-pointer pr-1"
                    >
                      {TOKENS.map((t) => (
                        <option key={t.symbol} value={t.symbol} className="bg-slate-900 text-white">
                          {t.symbol} - {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 font-mono">
                ≈ $
                {(inputNum * fromPrice).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                USD
              </div>
            </div>

            {/* FLIP BUTTON */}
            <div className="flex justify-center -my-2 relative z-10">
              <button
                onClick={flipTokens}
                className="rounded-full bg-slate-800 border border-slate-700 p-2.5 text-amber-400 hover:text-white hover:bg-emerald-600 hover:border-emerald-500 transition-all shadow-lg hover:rotate-180 duration-300"
                title="Swap Direction"
              >
                <ArrowDownUp className="h-4 w-4" />
              </button>
            </div>

            {/* TO TOKEN SECTION */}
            <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4 space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span className="font-semibold text-slate-300">You Receive (Estimated)</span>
                <span>
                  Rate:{" "}
                  <strong className="text-slate-200 font-mono">
                    1 {fromSymbol} = {swapRate < 0.001 ? swapRate.toFixed(6) : swapRate.toFixed(4)}{" "}
                    {toSymbol}
                  </strong>
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-2xl font-black font-mono text-emerald-300 truncate">
                  {netOutput > 0
                    ? netOutput.toFixed(toSymbol === "BTC" ? 6 : toSymbol === "ETH" ? 5 : 4)
                    : "0.00"}
                </div>

                <div className="flex items-center gap-1.5 rounded-xl bg-slate-800 border border-slate-700 px-2 py-1 shrink-0">
                  <CryptoIcon symbol={toSymbol} size="sm" />
                  <select
                    value={toSymbol}
                    onChange={(e) => {
                      soundFX.playClick();
                      setToSymbol(e.target.value);
                    }}
                    className="bg-transparent text-white font-bold text-sm outline-none cursor-pointer pr-1"
                  >
                    {TOKENS.map((t) => (
                      <option key={t.symbol} value={t.symbol} className="bg-slate-900 text-white">
                        {t.symbol} - {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 font-mono">
                ≈ $
                {(netOutput * toPrice).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                USD
              </div>
            </div>

            {/* RATE & SLIPPAGE DETAILS */}
            <div className="rounded-xl bg-slate-950/40 border border-slate-800/80 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Network / Swap Fee</span>
                <span className="font-semibold text-emerald-400">
                  {isVipFeeFree ? "0% (VIP 免费)" : "0.25% Standard"}
                </span>
              </div>

              <div className="flex justify-between text-slate-400">
                <span>Execution Speed</span>
                <span className="font-semibold text-cyan-400 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Instant (&lt; 1 sec)
                </span>
              </div>

              <div className="flex justify-between text-slate-400">
                <span>Guaranteed Rate</span>
                <span className="font-mono text-slate-200">
                  ${fromPrice.toLocaleString()} / ${toPrice.toLocaleString()}
                </span>
              </div>
            </div>

            {/* SWAP SUBMIT BUTTON */}
            <Button
              onClick={executeSwap}
              disabled={swapping || inputNum <= 0 || inputNum > availableFromBalance}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 font-extrabold text-white text-base shadow-xl shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 transition-all active:scale-[0.99]"
            >
              {swapping ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Swapping Tokens…
                </>
              ) : inputNum > availableFromBalance ? (
                `Insufficient ${fromSymbol} Balance`
              ) : inputNum <= 0 ? (
                "Enter Swap Amount"
              ) : (
                <>
                  <Zap className="mr-2 h-5 w-5 fill-white" /> INSTANTLY SWAP NOW
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Sidebar Info & VIP Perks */}
        <div className="space-y-4">
          <Card className="p-4 bg-slate-900/90 border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> VIP Swap Privileges
            </h3>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Whale & Gold VIPs</div>
                  <div className="text-[10px] text-slate-400">0% Swap fees & priority routing</div>
                </div>
                <VipBadge tier="Gold" size="sm" />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Silver & Bronze Tier</div>
                  <div className="text-[10px] text-slate-400">0.25% standard swap fee</div>
                </div>
                <VipBadge tier="Silver" size="sm" />
              </div>
            </div>

            <Link
              to="/deposit"
              className="block text-center rounded-xl bg-purple-500/10 border border-purple-500/30 p-2.5 text-xs font-bold text-purple-300 hover:bg-purple-500/20 transition-colors"
            >
              Deposit to unlock 0% VIP Swap fees →
            </Link>
          </Card>

          {/* Real-time rates widget */}
          <Card className="p-4 bg-slate-900/90 border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Live Rates (Binance)
              </h3>
              <RefreshCw className="h-3 w-3 text-emerald-400 animate-spin" />
            </div>

            <div className="space-y-2 font-mono text-xs">
              {TOKENS.filter((t) => t.symbol !== "USDT").map((t) => {
                const price = getUsdPrice(t.symbol);
                return (
                  <div
                    key={t.symbol}
                    className="flex justify-between items-center py-1 border-b border-slate-800/60"
                  >
                    <span className="text-slate-300 font-bold">
                      {t.icon} {t.symbol}/USDT
                    </span>
                    <span className="text-emerald-400 font-extrabold">
                      ${price.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
