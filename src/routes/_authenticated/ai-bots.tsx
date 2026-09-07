import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { activateBotServerFn } from "@/lib/bot.functions";
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
            <Zap className="h-4 w-4 text-primary" /> Your Active Bots
          </h2>
          {activeBots.map((ab: any) => (
            <Card key={ab.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{ab.trading_bots?.name ?? "Bot"}</div>
                  <div className="text-xs text-muted-foreground">
                    Invested: ${Number(ab.invested_amount).toFixed(2)} · Expires:{" "}
                    {new Date(ab.expiration_date).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-bold text-success tabular-nums">
                      +${Number(ab.current_profit).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">Current profit</div>
                  </div>
                  <Badge
                    className={
                      ab.status === "running"
                        ? "bg-success/20 text-success border-success/40"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {ab.status}
                  </Badge>
                </div>
              </div>
            </Card>
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
  const { fiatLiveBalance } = useAccountMode();
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
  const minRoi = Number(bot.min_roi);
  const maxRoi = Number(bot.max_roi);
  const isHourly = bot.payout_interval === "hourly";
  const dailyPayout = isHourly
    ? Number(bot.hourly_payout ?? 0) * 24
    : Number(bot.daily_payout ?? 0) ||
      (Number(bot.capital_required) * ((minRoi + maxRoi) / 2)) / 100;
  const hourlyPayout = isHourly ? Number(bot.hourly_payout ?? 0) : dailyPayout / 24;
  const dailyRoiPct = (dailyPayout / Number(bot.capital_required)) * 100;
  const totalReturn = dailyPayout * 10;
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
        invested_amount: usd,
        activation_date: new Date().toISOString(),
        expiration_date: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        last_payout_at: new Date().toISOString(),
        current_profit: 0,
        status: "active",
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
