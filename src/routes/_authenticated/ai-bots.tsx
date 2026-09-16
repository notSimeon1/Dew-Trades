import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  activateBotServerFn,
  harvestBotProfitServerFn,
  terminateBotServerFn,
} from "@/lib/bot.functions";
import { calculateBotProfitByTime } from "@/lib/profit-timing";
import { soundFX } from "@/lib/sound-engine";
import { useAuth } from "@/lib/auth-context";
import { useAccountMode } from "@/lib/account-mode-context";
import { useCurrency } from "@/lib/currency-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Bot,
  Loader as Loader2,
  TrendingUp,
  Clock,
  CircleCheck as CheckCircle2,
  Zap,
  Cpu,
  Sparkles,
  ArrowRight,
  Timer,
  Flame,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/ai-bots")({
  component: AiBotsPage,
  head: () => ({
    meta: [
      { title: "AI Trading Bots — Dew Trades" },
      { name: "description", content: "Automated AI trading bots with hourly profit accrual." },
    ],
  }),
});

function AiBotsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { mode, balance } = useAccountMode();
  const { formatCurrency } = useCurrency();

  const { data: bots } = useQuery({
    queryKey: ["trading_bots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("trading_bots").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: activeBots } = useQuery({
    queryKey: ["my_active_bots", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_active_bots")
        .select("*, trading_bots(name, tier_key)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 15000,
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-hero shadow-glow">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Trading Bots</h1>
            <p className="text-sm text-muted-foreground">
              Automated algorithmic trading with guaranteed payouts. Choose a tier, invest, and earn
              — even while offline.
            </p>
          </div>
        </div>
      </motion.div>

      <Card className="border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              {mode === "demo" && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[9px]">
                  DEMO
                </Badge>
              )}
              Available Balance
            </div>
            <div className="text-2xl font-bold tabular-nums">{formatCurrency(balance)}</div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/deposit">
              Top up balance <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </Card>

      {activeBots && activeBots.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Your Active Bots ({activeBots.length})
          </h2>
          {activeBots.map((ab: any) => (
            <ActiveBotItem key={ab.id} bot={ab} userId={user!.id} />
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bots?.map((bot: any, i: number) => (
          <BotCard key={bot.id} bot={bot} balance={balance} index={i} mode={mode} />
        ))}
      </div>
    </div>
  );
}

const TIER_COLORS: Record<string, string> = {
  starter: "from-slate-600 to-slate-800",
  bronze: "from-amber-700 to-amber-900",
  bronze2: "from-amber-600 to-amber-800",
  silver: "from-gray-400 to-gray-600",
  silver2: "from-slate-400 to-slate-600",
  gold: "from-yellow-500 to-yellow-700",
  gold2: "from-yellow-600 to-amber-800",
  platinum: "from-cyan-500 to-blue-700",
  platinum2: "from-cyan-400 to-blue-600",
  diamond: "from-blue-500 to-indigo-700",
  diamond2: "from-blue-600 to-indigo-800",
  diamond3: "from-indigo-500 to-purple-700",
  elite: "from-purple-500 to-pink-700",
  elite2: "from-purple-600 to-pink-800",
  apex: "from-pink-500 to-rose-700",
};

function BotCard({
  bot,
  balance,
  index,
  mode,
}: {
  bot: any;
  balance: number;
  index: number;
  mode: "demo" | "live";
}) {
  const { user } = useAuth();
  const { fiatLiveBalance, refreshBalances } = useAccountMode();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(bot.capital_required));
  const [currencyPool, setCurrencyPool] = useState<"USD" | "USDT">("USD");
  const [busy, setBusy] = useState(false);

  const { data: usdtBalance = 0 } = useQuery({
    queryKey: ["usdt_balance_bot_card", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data: prof } = await supabase
        .from("profiles")
        .select("crypto_balances")
        .eq("id", user.id)
        .maybeSingle();
      const { data: cryptoRow } = await supabase
        .from("user_crypto_balances")
        .select("balance")
        .eq("user_id", user.id)
        .eq("asset_symbol", "USDT")
        .maybeSingle();
      const jsonVal = Number((prof?.crypto_balances as any)?.USDT ?? 0);
      const rowVal = Number(cryptoRow?.balance ?? 0);
      return Math.max(jsonVal, rowVal);
    },
    enabled: !!user && mode === "live",
    staleTime: 5000,
  });

  const activePoolBalance =
    mode === "demo" ? balance : currencyPool === "USD" ? fiatLiveBalance : usdtBalance;

  const gradient = TIER_COLORS[bot.tier_key] ?? "from-primary to-primary/80";
  const minRoi = Math.max(20, Number(bot.min_roi ?? 20));
  const maxRoi = Math.max(20, Number(bot.max_roi ?? 20));
  const isHourly = bot.payout_interval === "hourly";
  const dailyPayout =
    Number(bot.daily_payout ?? 0) || (Number(bot.capital_required) * ((minRoi + maxRoi) / 2)) / 100;
  const hourlyPayout = Number(bot.hourly_payout ?? 0) || dailyPayout / 24;
  const dailyRoiPct = Math.max(20, (dailyPayout / Number(bot.capital_required)) * 100);
  const duration = Number(bot.duration_days ?? 10);
  const totalReturn = dailyPayout * duration;
  const roiMultiple = totalReturn / Number(bot.capital_required);

  const activate = async () => {
    const { data: prof } = await supabase
      .from("profiles")
      .select("is_suspended")
      .eq("id", user!.id)
      .maybeSingle();
    if (prof?.is_suspended) {
      toast.error("Account suspended — AI bot activation is restricted. Contact support.");
      return;
    }
    const usd = Number(amount);
    if (!usd || usd < bot.capital_required) {
      toast.error(`Minimum investment is $${bot.capital_required}`);
      return;
    }

    if (activePoolBalance < usd) {
      toast.error(
        `Insufficient liquidity in ${currencyPool} pool. Required: $${usd}, Available: $${activePoolBalance.toFixed(2)} ${currencyPool}`,
      );
      return;
    }

    setBusy(true);
    try {
      // 1. Call server function using service role
      const res = await activateBotServerFn({
        data: {
          userId: user!.id,
          botId: bot.id,
          amount: usd,
          mode,
          currencyPool,
        },
      });

      if (res) {
        if (res.success) {
          toast.success(`${bot.name} activated! Payouts will accrue automatically.`);
          await refreshBalances();
          window.dispatchEvent(new CustomEvent("dewtrades:refresh-balance"));
          qc.invalidateQueries({ queryKey: ["my_active_bots"] });
          qc.invalidateQueries({ queryKey: ["profile"] });
          qc.invalidateQueries({ queryKey: ["transactions"] });
          setOpen(false);
          return;
        } else {
          throw new Error(res.message);
        }
      }

      // 2. Fallback to client insert with strict schema matching if serverFn is unreachable
      const balanceCol = mode === "demo" ? "demo_balance" : "live_balance";
      const { data: prof } = await supabase
        .from("profiles")
        .select(`${balanceCol}, crypto_balances`)
        .eq("id", user!.id)
        .single();

      let currentBal = 0;
      if (mode === "demo") {
        currentBal = Number((prof as any)?.demo_balance ?? 10000);
      } else if (currencyPool === "USDT") {
        currentBal = Number((prof as any)?.crypto_balances?.USDT ?? 0);
      } else {
        currentBal = Number((prof as any)?.live_balance ?? 0);
      }

      if (currentBal < usd) {
        console.error(
          `[AI Trading Bot Execution Error] Failed transaction attempt due to insufficient liquidity! User: ${user!.id}, Pool: ${currencyPool}, Required: ${usd}, Available: ${currentBal}`,
        );
        throw new Error(
          `Insufficient liquidity in ${currencyPool} pool. Available: $${currentBal.toFixed(2)}`,
        );
      }

      const newBal = currentBal - usd;
      if (mode === "demo") {
        await supabase
          .from("profiles")
          .update({ demo_balance: newBal } as never)
          .eq("id", user!.id);
      } else if (currencyPool === "USDT") {
        const curCrypto = (prof as any)?.crypto_balances ?? {};
        await supabase
          .from("profiles")
          .update({ crypto_balances: { ...curCrypto, USDT: newBal } } as never)
          .eq("id", user!.id);
      } else {
        await supabase
          .from("profiles")
          .update({
            live_balance: newBal,
            account_balance: newBal,
            available_cash: newBal,
          } as never)
          .eq("id", user!.id);
      }

      const { error: botErr } = await supabase.from("user_active_bots").insert({
        user_id: user!.id,
        bot_id: bot.id,
        bot_name: bot.name,
        invested_amount: usd,
        activation_date: new Date().toISOString(),
        expiration_date: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        last_payout_at: new Date().toISOString(),
        profit_accumulated: 0,
        status: "active",
        account_mode: mode,
      } as never);

      if (botErr) throw botErr;

      await supabase.from("transactions").insert({
        user_id: user!.id,
        type: "bot_activation",
        amount: usd,
        asset_name: `Activated AI Bot: ${bot.name} (${currencyPool})`,
        status: "completed",
        account_mode: mode,
      } as never);

      toast.success(`${bot.name} activated! Payouts will accrue automatically.`);
      qc.invalidateQueries({ queryKey: ["my_active_bots"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Activation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
    >
      <Card className="relative overflow-hidden border-border/70">
        <div className={`h-2 bg-gradient-to-r ${gradient}`} />
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h3 className="text-base font-bold leading-tight">{bot.name}</h3>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Badge variant="secondary" className="text-[9px] uppercase">
                  {bot.tier_key}
                </Badge>
                <Badge className="bg-success/15 text-success border-success/30 text-[9px]">
                  <TrendingUp className="mr-1 h-2.5 w-2.5" /> {bot.win_rate}% win
                </Badge>
              </div>
            </div>
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} shadow-lg`}
            >
              <Cpu className="h-5 w-5 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-surface p-3">
              <div className="text-xs text-muted-foreground">Capital</div>
              <div className="text-lg font-bold tabular-nums">
                ${Number(bot.capital_required).toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <div className="text-xs text-muted-foreground">
                {isHourly ? "Hourly payout" : "Daily payout"}
              </div>
              <div className="text-lg font-bold tabular-nums text-success">
                {isHourly ? `$${hourlyPayout.toFixed(2)}/hr` : `$${dailyPayout.toFixed(2)}/day`}
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-muted-foreground">Daily ROI:</span>
              <span className="font-bold text-primary">{dailyRoiPct.toFixed(2)}%</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Flame className="h-3.5 w-3.5 text-success shrink-0" />
              <span className="text-muted-foreground">10-day total:</span>
              <span className="font-bold text-success tabular-nums">${totalReturn.toFixed(2)}</span>
              <span className="text-muted-foreground">({roiMultiple.toFixed(1)}x)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Timer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">
                Duration: {bot.duration_days} days · 100% return in 7 days
              </span>
            </div>
          </div>

          <ul className="space-y-1.5">
            {(bot.perks as string[]).slice(0, 4).map((perk, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                {perk}
              </li>
            ))}
          </ul>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className={`w-full bg-gradient-to-r ${gradient} text-white hover:opacity-90`}>
                <Bot className="mr-2 h-4 w-4" /> Activate Bot
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Activate {bot.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg bg-surface p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active Pool Balance:</span>
                    <span className="font-bold tabular-nums">
                      ${activePoolBalance.toFixed(2)} {mode === "live" ? currencyPool : "DEMO"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payout:</span>
                    <span className="font-bold text-success">
                      {isHourly
                        ? `$${hourlyPayout.toFixed(2)}/hour`
                        : `$${dailyPayout.toFixed(2)}/day`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="font-bold">{bot.duration_days} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total return:</span>
                    <span className="font-bold text-success">${totalReturn.toFixed(2)}</span>
                  </div>
                </div>
                {mode === "live" && (
                  <div>
                    <label className="text-sm font-medium">Payment Currency Pool</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <Button
                        type="button"
                        variant={currencyPool === "USD" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrencyPool("USD")}
                        className="w-full text-xs"
                      >
                        USD Pool (${fiatLiveBalance.toFixed(2)})
                      </Button>
                      <Button
                        type="button"
                        variant={currencyPool === "USDT" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrencyPool("USDT")}
                        className="w-full text-xs"
                      >
                        USDT Pool (${usdtBalance.toFixed(2)})
                      </Button>
                    </div>
                  </div>
                )}
                {mode === "live" && activePoolBalance < Number(amount) && (
                  <div className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive flex items-start gap-2 font-medium border border-destructive/20">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <span>
                        Insufficient liquidity in {currencyPool} pool. Available: $
                        {activePoolBalance.toFixed(2)} {currencyPool}.
                      </span>
                      {currencyPool === "USDT" && fiatLiveBalance >= Number(amount) && (
                        <button
                          type="button"
                          className="block mt-1 text-primary underline text-left font-semibold hover:opacity-80"
                          onClick={() => setCurrencyPool("USD")}
                        >
                          Switch to USD Pool (${fiatLiveBalance.toFixed(2)} available)
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium">Investment amount ({currencyPool})</label>
                  <Input
                    type="number"
                    min={bot.capital_required}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Minimum: ${bot.capital_required} · Mode: {mode.toUpperCase()} · Pool:{" "}
                    {currencyPool}
                  </p>
                </div>
                <Button
                  onClick={activate}
                  disabled={busy || (mode === "live" && activePoolBalance < Number(amount))}
                  className="w-full bg-gradient-hero"
                >
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Bot className="mr-2 h-4 w-4" />
                  )}
                  Confirm activation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Card>
    </motion.div>
  );
}

function ActiveBotItem({ bot, userId }: { bot: any; userId: string }) {
  const qc = useQueryClient();
  const { refreshBalances, applyOptimisticBalance } = useAccountMode();
  const [harvesting, setHarvesting] = useState(false);
  const [settling, setSettling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [overrideLastPayoutAt, setOverrideLastPayoutAt] = useState<string | null>(null);

  // 1-second dynamic ticker for real-time second-by-second accuracy
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const effectiveBot = overrideLastPayoutAt
    ? { ...bot, profit_accumulated: 0, last_payout_at: overrideLastPayoutAt }
    : bot;
  const timing = calculateBotProfitByTime(effectiveBot, now);
  const invested = Number(bot.invested_amount ?? 0);
  const profit = timing.totalProfit;
  const totalReturn = invested + profit;
  const isRunning = bot.status === "active" || bot.status === "running";

  const handleHarvest = async () => {
    if (profit <= 0) {
      toast.info("Earnings accumulate continuously. Harvest is available once profit > $0.00.");
      return;
    }
    setHarvesting(true);
    // Optimistically bump balance immediately with zero visual lag
    applyOptimisticBalance({
      liveDelta: bot.account_mode === "live" ? profit : 0,
      demoDelta: bot.account_mode === "demo" ? profit : 0,
    });
    try {
      const res = await harvestBotProfitServerFn({
        data: { userId, activeBotId: bot.id },
      });
      if (res?.success) {
        soundFX.playDepositBonus();
        soundFX.triggerHaptic(50);
        toast.success(res.message);
        const newIso = (res as any).newLastPayoutAt || new Date().toISOString();
        setOverrideLastPayoutAt(newIso);
        qc.setQueriesData({ queryKey: ["my_active_bots"] }, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((b) =>
            b.id === bot.id ? { ...b, profit_accumulated: 0, last_payout_at: newIso } : b,
          );
        });
        await refreshBalances();
        window.dispatchEvent(new CustomEvent("dewtrades:refresh-balance"));
        qc.invalidateQueries({ queryKey: ["my_active_bots"] });
        qc.invalidateQueries({ queryKey: ["profile"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        toast.error(res?.message ?? "Harvest failed");
        await refreshBalances();
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Harvest error");
      await refreshBalances();
    } finally {
      setHarvesting(false);
    }
  };

  const handleSettle = async () => {
    setSettling(true);
    try {
      const res = await terminateBotServerFn({
        data: { userId, activeBotId: bot.id },
      });
      if (res?.success) {
        soundFX.playSuccess();
        soundFX.triggerHaptic(40);
        toast.success(res.message);
        setConfirmOpen(false);
        await refreshBalances();
        window.dispatchEvent(new CustomEvent("dewtrades:refresh-balance"));
        qc.invalidateQueries({ queryKey: ["my_active_bots"] });
        qc.invalidateQueries({ queryKey: ["profile"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        toast.error(res?.message ?? "Settlement failed");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Settlement error");
    } finally {
      setSettling(false);
    }
  };

  return (
    <Card className="p-4 border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-card to-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {isRunning && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isRunning ? "bg-emerald-500" : "bg-zinc-500"
                }`}
              />
            </span>
            <div className="font-semibold text-sm sm:text-base">
              {bot.trading_bots?.name ?? bot.bot_name ?? "AI Trading Bot"}
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              Invested:{" "}
              <span className="font-semibold text-foreground">${invested.toFixed(2)}</span>
            </span>
            <span>·</span>
            <span>
              Mode:{" "}
              <span
                className={`uppercase font-bold ${
                  bot.account_mode === "demo" ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                {bot.account_mode === "demo" ? "Demo" : "Live Cash"}
              </span>
            </span>
            <span>·</span>
            <span className="text-primary font-medium">
              Rate: ${timing.dailyPayout.toFixed(2)}/day
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <Badge
              variant="outline"
              className="text-[10px] border-border/60 bg-surface/50 font-normal"
            >
              <Clock className="w-3 h-3 mr-1 text-primary" />
              {timing.timeSinceLastHarvestLabel}
            </Badge>
            <span>·</span>
            <span>
              Started: {timing.startDate.toLocaleDateString()}{" "}
              {timing.startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {bot.expires_at && (
              <>
                <span>·</span>
                <span>Expires: {new Date(bot.expires_at).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="text-right mr-1">
            <div className="text-sm sm:text-base font-bold text-emerald-400 tabular-nums">
              +${profit.toFixed(2)}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Harvestable Profit
            </div>
          </div>

          <Badge
            className={
              isRunning
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]"
                : "bg-muted text-muted-foreground text-[10px]"
            }
          >
            {bot.status}
          </Badge>

          {isRunning && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={harvesting || profit <= 0}
                onClick={handleHarvest}
                className="h-8 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/15 hover:text-amber-200"
                title="Collect accumulated profits directly to your cash wallet"
              >
                {harvesting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-400" />
                    Harvest
                  </>
                )}
              </Button>

              <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                    title="Stop bot early and refund capital + profit"
                  >
                    Settle
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Settle &amp; Close Bot</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-2 text-sm">
                    <p className="text-muted-foreground">
                      Are you sure you want to stop{" "}
                      <span className="font-semibold text-foreground">
                        {bot.trading_bots?.name ?? bot.bot_name}
                      </span>
                      ?
                    </p>
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Principal Capital:</span>
                        <span className="font-bold tabular-nums">${invested.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Accrued Profit ({timing.timeSinceLastHarvestLabel}):
                        </span>
                        <span className="font-bold text-emerald-400 tabular-nums">
                          +${profit.toFixed(2)}
                        </span>
                      </div>
                      <div className="border-t border-white/10 pt-2 flex justify-between font-bold text-sm">
                        <span>Total Refund to Wallet:</span>
                        <span className="text-amber-400 tabular-nums">
                          ${totalReturn.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
                      Keep Running
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={settling}
                      onClick={handleSettle}
                    >
                      {settling ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                      Confirm &amp; Settle
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
