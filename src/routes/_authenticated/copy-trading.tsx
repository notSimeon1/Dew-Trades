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
} from "lucide-react";
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
          <h2 className="text-lg font-semibold">Your Active Allocations</h2>
          {allocations.map((a: any) => (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{a.copy_trading_tiers?.tier_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    Strategist: {a.copy_trading_tiers?.strategist_name ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Allocated: ${Number(a.allocated_amount).toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-bold text-success tabular-nums">
                      +${Number(a.current_profit).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">Current profit</div>
                  </div>
                  <Badge
                    className={
                      a.status === "active"
                        ? "bg-success/20 text-success border-success/40"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {a.status}
                  </Badge>
                </div>
              </div>
            </Card>
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
          .select(balanceCol)
          .eq("id", user!.id)
          .single();
        const currentBal = Number((prof as any)?.[balanceCol] ?? 0);
        if (currentBal < usd) throw new Error("Insufficient balance");

        const newBal = currentBal - usd;
        const { error: balErr } = await supabase
          .from("profiles")
          .update({ [balanceCol]: newBal } as never)
          .eq("id", user!.id);
        if (balErr) throw balErr;

        const { error: copyErr } = await supabase.from("user_copy_allocations").insert({
          user_id: user!.id,
          tier_id: tier.id,
          allocated_amount: usd,
          current_profit: 0,
          status: "active",
        } as never);
        if (copyErr) throw copyErr;

        await supabase.from("transactions").insert({
          user_id: user!.id,
          type: "copy_trade",
          amount: usd,
          asset_name: `Copy Trading: ${tier.tier_name}`,
          status: "completed",
        } as never);
      }

      toast.success(`Copy trading activated with ${tier.tier_name}!`);
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
