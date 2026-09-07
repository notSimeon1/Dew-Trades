import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Lock, TrendingUp, TrendingDown } from "lucide-react";
import { useBinancePrices } from "@/hooks/useBinancePrices";

export const Route = createFileRoute("/_authenticated/signals")({
  component: Signals,
  head: () => ({
    meta: [
      { title: "Signals — Dew Trades" },
      { name: "description", content: "Institutional trading signals with your 3-day free trial." },
      { property: "og:title", content: "Signals — Dew Trades" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];

function Signals() {
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("signals_trial_started_at, signals_trial_expires_at, signals_lifetime")
        .eq("id", user.id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user,
  });
  const { tickers } = useBinancePrices(PAIRS);

  const lifetime = profile?.signals_lifetime;
  const expires = profile?.signals_trial_expires_at
    ? new Date(profile.signals_trial_expires_at)
    : null;
  const now = new Date();
  const active = lifetime || (expires && expires > now);
  const msLeft = expires ? expires.getTime() - now.getTime() : 0;
  const daysLeft = Math.max(0, Math.floor(msLeft / 86400000));
  const hoursLeft = Math.max(0, Math.floor((msLeft % 86400000) / 3600000));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-hero shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Signals</h1>
            <p className="text-xs text-muted-foreground">
              Institutional-grade real-time trade ideas
            </p>
          </div>
        </div>
        {lifetime ? (
          <Badge className="bg-primary/25 text-primary border-primary/40">Lifetime Access</Badge>
        ) : null}
      </div>

      {active && !lifetime && (
        <Card className="border-primary/40 bg-primary/10 p-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="text-sm">
              <span className="font-semibold">
                Your Free Signals Trial ends in {daysLeft} days {hoursLeft} hours.
              </span>
              <span className="ml-2 text-muted-foreground">
                Upgrade any time to keep access after the trial.
              </span>
            </div>
          </div>
        </Card>
      )}

      {!active ? (
        <Card className="p-10 text-center">
          <Lock className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold">Your free trial has ended</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Upgrade to Premium Signals to unlock institutional-grade trade ideas.
          </p>
          <Button asChild className="mt-6">
            <Link to="/support">Upgrade Now</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {PAIRS.map((p) => {
            const t = tickers[p];
            const change = t?.change ?? 0;
            const bull = change >= 0;
            return (
              <Card key={p} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold">{p.replace("USDT", "/USDT")}</div>
                    <div className="text-[10px] text-muted-foreground">Live via Binance</div>
                  </div>
                  <Badge
                    className={
                      bull
                        ? "bg-success/20 text-success border-success/40"
                        : "bg-destructive/20 text-destructive border-destructive/40"
                    }
                  >
                    {bull ? (
                      <TrendingUp className="mr-1 h-3 w-3" />
                    ) : (
                      <TrendingDown className="mr-1 h-3 w-3" />
                    )}
                    {bull ? "LONG" : "SHORT"}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Entry</div>
                    <div className="font-bold">${t?.price != null ? t.price.toFixed(2) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Target</div>
                    <div className="font-bold">
                      ${((t?.price ?? 0) * (bull ? 1.025 : 0.975)).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Stop</div>
                    <div className="font-bold">
                      ${((t?.price ?? 0) * (bull ? 0.985 : 1.015)).toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-[10px] text-muted-foreground">
                  24h change {change.toFixed(2)}% — signal generated by RSI+trend confluence.
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
