import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAccountMode } from "@/lib/account-mode-context";
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
  Layers,
  Loader as Loader2,
  CircleCheck as CheckCircle2,
  ArrowRight,
  Clock,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/pre-market")({
  component: PreMarketPage,
  head: () => ({
    meta: [
      { title: "Pre-Market — Dew Trades" },
      { name: "description", content: "Get early access to upcoming token launches." },
    ],
  }),
});

function PreMarketPage() {
  const { user } = useAuth();
  const { mode, balance } = useAccountMode();
  const qc = useQueryClient();

  const { data: tokens } = useQuery({
    queryKey: ["pre_market_tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pre_market_tokens")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allocations } = useQuery({
    queryKey: ["my_pre_market", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_pre_market_allocations")
        .select("*, pre_market_tokens(token_name, symbol)")
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
            <Layers className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pre-Market</h1>
            <p className="text-sm text-muted-foreground">
              Get early access to upcoming token launches before they hit the public market.
              Allocate funds and receive tokens at listing price.
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
            <div className="text-2xl font-bold tabular-nums">${balance.toFixed(2)}</div>
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
          <h2 className="text-lg font-semibold">Your Allocations</h2>
          {allocations.map((a: any) => (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">
                    {a.pre_market_tokens?.token_name ?? "—"} ({a.pre_market_tokens?.symbol ?? "—"})
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Invested: ${Number(a.usd_invested).toFixed(2)} · Tokens:{" "}
                    {Number(a.tokens_allocated).toFixed(2)}
                  </div>
                </div>
                <Badge className="bg-primary/15 text-primary border-primary/30">{a.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tokens?.map((token: any, i: number) => (
          <TokenCard key={token.id} token={token} balance={balance} index={i} />
        ))}
      </div>
    </div>
  );
}

function TokenCard({ token, balance, index }: { token: any; balance: number; index: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(token.min_allocation));
  const [busy, setBusy] = useState(false);

  const tgeDate = new Date(token.tge_date);
  const daysToTge = Math.max(0, Math.ceil((tgeDate.getTime() - Date.now()) / 86400000));
  const tokenAmount = Number(amount) > 0 ? Number(amount) / Number(token.listing_price) : 0;

  const allocate = async () => {
    const usd = Number(amount);
    if (!usd || usd < token.min_allocation) {
      toast.error(`Minimum allocation is $${token.min_allocation}`);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc(
        "allocate_pre_market" as never,
        {
          _token_id: token.id,
          _usd_amount: usd,
        } as never,
      );
      if (error) throw error;
      toast.success(`Allocated $${usd.toFixed(2)} to ${token.token_name} (${token.symbol})`);
      qc.invalidateQueries({ queryKey: ["my_pre_market"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Allocation failed");
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
        <div className="bg-gradient-to-r from-primary/80 to-primary/40 h-2" />
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold">{token.token_name}</h3>
              <Badge variant="secondary" className="text-[10px] mt-1">
                {token.symbol}
              </Badge>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-hero shadow-lg">
              <Rocket className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-surface p-3">
              <div className="text-xs text-muted-foreground">Listing Price</div>
              <div className="text-xl font-bold tabular-nums">
                ${Number(token.listing_price).toFixed(4)}
              </div>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <div className="text-xs text-muted-foreground">Min Allocation</div>
              <div className="text-xl font-bold tabular-nums">
                ${Number(token.min_allocation).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            TGE in {daysToTge} days ({tgeDate.toLocaleDateString()})
          </div>

          <ul className="space-y-1.5">
            {(token.perks as string[]).map((perk, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                {perk}
              </li>
            ))}
          </ul>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="w-full bg-gradient-hero">
                <Rocket className="mr-2 h-4 w-4" /> Allocate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Allocate to {token.token_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg bg-surface p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Listing price:</span>
                    <span className="font-bold">${Number(token.listing_price).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Min allocation:</span>
                    <span className="font-bold">
                      ${Number(token.min_allocation).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">TGE date:</span>
                    <span className="font-bold">{tgeDate.toLocaleDateString()}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Investment amount (USD)</label>
                  <Input
                    type="number"
                    min={token.min_allocation}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    ≈ {tokenAmount.toFixed(2)} {token.symbol} · Available: ${balance.toFixed(2)}
                  </p>
                </div>
                <Button onClick={allocate} disabled={busy} className="w-full bg-gradient-hero">
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="mr-2 h-4 w-4" />
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
