import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountMode } from "@/lib/account-mode-context";
import { useAuth } from "@/lib/auth-context";
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
  Users,
  Loader as Loader2,
  TrendingUp,
  CircleCheck as CheckCircle2,
  ArrowRight,
  Star,
  Sparkles,
  Clock,
} from "lucide-react";
import { soundFX } from "@/lib/sound-engine";
import { harvestCopyProfitServerFn, terminateCopyAllocationServerFn } from "@/lib/bot.functions";
import { calculateCopyProfitByTime } from "@/lib/profit-timing";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/copy-trading")({
  component: CopyTradingPage,
  head: () => ({
    meta: [
      { title: "Copy Trading — Dew Trades" },
      { name: "description", content: "Mirror the trades of elite strategists automatically." },
    ],
  }),
});

function CopyTradingPage() {
  const { user } = useAuth();
  const { mode, balance } = useAccountMode();
  const { formatCurrency } = useCurrency();
  const qc = useQueryClient();

  const { data: tiers } = useQuery({
    queryKey: ["copy_trading_tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("copy_trading_tiers")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allocations } = useQuery({
    queryKey: ["my_copy_allocations", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_copy_allocations")
        .select("*, copy_trading_tiers(tier_name, strategist_name)")
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
            <Users className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Copy Trading</h1>
            <p className="text-sm text-muted-foreground">
              Automatically mirror the positions of elite professional traders. Choose a strategist,
              allocate capital, and profit on autopilot.
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

      {allocations && allocations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Your Active Allocations ({allocations.length}
            )
          </h2>
          {allocations.map((a: any) => (
            <ActiveCopyAllocationItem key={a.id} alloc={a} userId={user!.id} />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {tiers?.map((tier: any, i: number) => (
          <CopyTierCard key={tier.id} tier={tier} balance={balance} index={i} />
        ))}
      </div>
    </div>
  );
}

function CopyTierCard({ tier, balance, index }: { tier: any; balance: number; index: number }) {
  const { user } = useAuth();
  const { mode, refreshBalances } = useAccountMode();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(tier.required_capital));
  const [busy, setBusy] = useState(false);

  const activate = async () => {
    const { data: prof } = await supabase
      .from("profiles")
      .select("is_suspended")
      .eq("id", user!.id)
      .maybeSingle();
    if (prof?.is_suspended) {
      toast.error("Account suspended — copy trading is disabled. Contact support.");
      return;
    }
    const usd = Number(amount);
    if (!usd || usd < tier.required_capital) {
      toast.error(`Minimum allocation is $${tier.required_capital}`);
      return;
    }
    if (usd > balance) {
      toast.error("Insufficient balance");
      return;
    }
    setBusy(true);
    try {
      let rpcError: any = null;
      try {
        const { error } = await supabase.rpc(
          "subscribe_copy_trader" as never,
          {
            _tier_id: tier.id,
            _allocated_amount: usd,
          } as never,
        );
        if (error) rpcError = error;
      } catch (e) {
        rpcError = e;
      }

      if (rpcError) {
        console.warn("[subscribe_copy_trader RPC failed, performing client fallback]", rpcError);
        const balanceCol = mode === "demo" ? "demo_balance" : "live_balance";
        const { data: prof } = await supabase
          .from("profiles")
          .select("demo_balance, live_balance, account_balance, available_cash")
          .eq("id", user!.id)
          .single();
        const currentBal = Number((prof as any)?.[balanceCol] ?? 0);
        if (currentBal < usd) throw new Error("Insufficient balance");

        const newBal = currentBal - usd;
        const updatePayload: Record<string, any> = { [balanceCol]: newBal };
        if (mode === "live") {
          updatePayload.account_balance = newBal;
          updatePayload.available_cash = newBal;
        }

        const { error: balErr } = await supabase
          .from("profiles")
          .update(updatePayload as never)
          .eq("id", user!.id);
        if (balErr) throw balErr;

        const expiresAt = new Date(
          Date.now() + (Number(tier.lock_in_days) || 30) * 24 * 60 * 60 * 1000,
        ).toISOString();

        const cleanTierKey =
          mode === "demo" ? `${tier.tier_key || "tier"}:demo` : tier.tier_key || "tier";

        const { error: copyErr } = await supabase.from("user_copy_allocations").insert({
          user_id: user!.id,
          tier_id: tier.id,
          tier_key: cleanTierKey,
          allocated_amount: usd,
          total_profit: 0,
          strategist_name: tier.strategist_name || null,
          status: "active",
          expires_at: expiresAt,
        } as never);
        if (copyErr) throw copyErr;

        await supabase.from("transactions").insert({
          user_id: user!.id,
          type: "copy_trade",
          amount: usd,
          asset_name: `Copy Trading: ${tier.strategist_name || tier.tier_name}`,
          status: "completed",
          account_mode: mode,
        } as never);
      }

      toast.success(`Copy trading activated with ${tier.tier_name}!`);
      await refreshBalances();
      window.dispatchEvent(new CustomEvent("dewtrades:refresh-balance"));
      qc.invalidateQueries({ queryKey: ["my_copy_allocations"] });
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
      transition={{ delay: index * 0.05 }}
    >
      <Card className="relative overflow-hidden">
        <div className="bg-gradient-hero h-2" />
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold">{tier.tier_name}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <Badge variant="secondary" className="text-[10px]">
                  {tier.strategist_name}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-1 text-primary">
              <Star className="h-4 w-4 fill-primary" />
              <span className="text-sm font-bold">{Number(tier.win_rate).toFixed(1)}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-surface p-3">
              <div className="text-xs text-muted-foreground">Required Capital</div>
              <div className="text-xl font-bold tabular-nums">
                ${Number(tier.required_capital).toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <div className="text-xs text-muted-foreground">Monthly ROI</div>
              <div className="text-xl font-bold tabular-nums text-success">
                {Number(tier.monthly_roi_min).toFixed(0)}-{Number(tier.monthly_roi_max).toFixed(0)}%
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[10px]">
            <Badge variant="secondary" title="Share of profits paid to the strategist">
              {Number(tier.profit_share ?? 20).toFixed(0)}% profit share
            </Badge>
            <Badge
              title="Risk rating based on historical drawdown"
              className={
                tier.risk_rating === "High"
                  ? "bg-destructive/15 text-destructive border-destructive/30"
                  : tier.risk_rating === "Low"
                    ? "bg-success/15 text-success border-success/30"
                    : "bg-primary/15 text-primary border-primary/30"
              }
            >
              {tier.risk_rating ?? "Medium"} risk
            </Badge>
            <Badge variant="outline" title="Minimum period before the allocation can be withdrawn">
              {Number(tier.lock_in_days ?? 30)}-day lock-in
            </Badge>
          </div>

          <ul className="space-y-1.5">
            {(tier.perks as string[]).map((perk, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                {perk}
              </li>
            ))}
          </ul>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="w-full bg-gradient-hero">
                <Users className="mr-2 h-4 w-4" /> Start Copying
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Copy {tier.tier_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg bg-surface p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Strategist:</span>
                    <span className="font-bold">{tier.strategist_name}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Win rate:</span>
                    <span className="font-bold">{Number(tier.win_rate).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Monthly ROI:</span>
                    <span className="font-bold text-success">
                      {Number(tier.monthly_roi_min).toFixed(0)}-
                      {Number(tier.monthly_roi_max).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Allocation amount (USD)</label>
                  <Input
                    type="number"
                    min={tier.required_capital}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Minimum: ${tier.required_capital} · Available: ${balance.toFixed(2)}
                  </p>
                </div>
                <Button onClick={activate} disabled={busy} className="w-full bg-gradient-hero">
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <TrendingUp className="mr-2 h-4 w-4" />
                  )}
                  Confirm allocation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Card>
    </motion.div>
  );
}

function ActiveCopyAllocationItem({ alloc, userId }: { alloc: any; userId: string }) {
  const qc = useQueryClient();
  const { refreshBalances, applyOptimisticBalance } = useAccountMode();
  const [harvesting, setHarvesting] = useState(false);
  const [settling, setSettling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [overrideTierKey, setOverrideTierKey] = useState<string | null>(null);

  // 1-second dynamic ticker for real-time second-by-second accuracy
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isDemo =
    alloc.account_mode === "demo" ||
    (typeof alloc.tier_key === "string" && alloc.tier_key.endsWith(":demo"));

  const effectiveAlloc = overrideTierKey
    ? { ...alloc, total_profit: 0, tier_key: overrideTierKey }
    : alloc;

  const timing = calculateCopyProfitByTime(effectiveAlloc, now);
  const allocated = Number(alloc.allocated_amount ?? 0);
  const profit = timing.totalProfit;
  const totalReturn = allocated + profit;
  const isRunning = alloc.status === "active" || alloc.status === "running";

  const handleHarvest = async () => {
    if (profit <= 0) {
      toast.info("Yield accrues with trade executions. Harvest is available once profit > $0.00.");
      return;
    }
    setHarvesting(true);
    // Optimistically update balance immediately for instant visual gratification
    applyOptimisticBalance({
      liveDelta: !isDemo ? profit : 0,
      demoDelta: isDemo ? profit : 0,
    });
    try {
      const res = await harvestCopyProfitServerFn({
        data: { userId, allocationId: alloc.id },
      });
      if (res?.success) {
        soundFX.playDepositBonus();
        soundFX.triggerHaptic(50);
        toast.success(res.message);
        const newKey =
          (res as any).newTierKey ||
          encodeCopyTierKey(alloc.tier_key || "tier", isDemo, Date.now());
        setOverrideTierKey(newKey);
        qc.setQueriesData({ queryKey: ["my_copy_allocations"] }, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((a) =>
            a.id === alloc.id ? { ...a, total_profit: 0, tier_key: newKey } : a,
          );
        });
        await refreshBalances();
        window.dispatchEvent(new CustomEvent("dewtrades:refresh-balance"));
        qc.invalidateQueries({ queryKey: ["my_copy_allocations"] });
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

  const handleClose = async () => {
    setSettling(true);
    try {
      const res = await terminateCopyAllocationServerFn({
        data: { userId, allocationId: alloc.id },
      });
      if (res?.success) {
        soundFX.playSuccess();
        soundFX.triggerHaptic(40);
        toast.success(res.message);
        setConfirmOpen(false);
        await refreshBalances();
        window.dispatchEvent(new CustomEvent("dewtrades:refresh-balance"));
        qc.invalidateQueries({ queryKey: ["my_copy_allocations"] });
        qc.invalidateQueries({ queryKey: ["profile"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      } else {
        toast.error(res?.message ?? "Close failed");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Close error");
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
              {alloc.copy_trading_tiers?.tier_name ?? "Copy Strategist"}
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              Strategist:{" "}
              <span className="font-semibold text-foreground">
                {alloc.copy_trading_tiers?.strategist_name ??
                  alloc.strategist_name ??
                  "Verified Pro"}
              </span>
            </span>
            <span>·</span>
            <span>
              Allocated:{" "}
              <span className="font-semibold text-foreground">${allocated.toFixed(2)}</span>
            </span>
            <span>·</span>
            <span>
              Mode:{" "}
              <span
                className={`uppercase font-bold ${isDemo ? "text-amber-400" : "text-emerald-400"}`}
              >
                {isDemo ? "Demo" : "Live Cash"}
              </span>
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
            {alloc.status}
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
                    title="Close copy trade and refund allocated funds + profit"
                  >
                    Close
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Close Copy Allocation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-2 text-sm">
                    <p className="text-muted-foreground">
                      Are you sure you want to stop copying{" "}
                      <span className="font-semibold text-foreground">
                        {alloc.copy_trading_tiers?.strategist_name ??
                          alloc.strategist_name ??
                          "this strategist"}
                      </span>
                      ?
                    </p>
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Allocated Capital:</span>
                        <span className="font-bold tabular-nums">${allocated.toFixed(2)}</span>
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
                        <span>Total Refund to Balance:</span>
                        <span className="text-amber-400 tabular-nums">
                          ${totalReturn.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
                      Keep Copying
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={settling}
                      onClick={handleClose}
                    >
                      {settling ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                      Confirm &amp; Close
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
