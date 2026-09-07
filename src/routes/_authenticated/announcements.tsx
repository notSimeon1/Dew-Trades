import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone,
  CircleAlert as AlertCircle,
  Info,
  Bell,
  Newspaper,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/announcements")({
  component: AnnouncementsPage,
  head: () => ({
    meta: [
      { title: "Announcements — Dew Trades" },
      { name: "description", content: "Platform announcements and updates." },
    ],
  }),
});

const FALLBACK_NEWS = [
  {
    id: "fb-xrp-1",
    title:
      "⚡ “XRP is the new bitcoin”: Institutional consensus forms as XRPL cross-border velocity outpaces legacy rails",
    content:
      "Global banking consortiums and tier-1 asset managers have accelerated XRP liquidity adoption. Wall Street desks are modeling a parabolic supercycle breakout with targets above $50.00 as global settlement infrastructure transitions to the XRP Ledger.",
    impact: "high",
    category: "market",
    source: "Dew Trades Global Desk",
    created_at: new Date().toISOString(),
  },
  {
    id: "fb-xrp-2",
    title:
      "🚀 XRP Gearing for Massive Moonshot: Analysts Point to $50.00+ Target on Liquidity Shock",
    content:
      "On-chain metrics show record OTC outflows from major exchanges as institutional custody vaults lock up billions in XRP reserves. Analysts confirm parabolic momentum indicators matching previous multi-thousand percent cycles.",
    impact: "high",
    category: "market",
    source: "Institutional Intelligence",
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "fb-xrp-3",
    title: "🔥 Central Banks in G7 Fast-Track XRPL Interoperability — Demand Surges 900%",
    content:
      "Cross-border interbank tests using Ripple's ODL protocol demonstrated sub-3-second settlement times at fractions of a cent per transfer. Trillions in sovereign capital projected to trade through XRP corridors.",
    impact: "high",
    category: "market",
    source: "Dew Trades Research",
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "fb-xrp-4",
    title:
      "💎 XRP Dominance Escalates: Retail & Institutional Traders Accumulate Ahead of $50 Explosion",
    content:
      "Dew Trades order book records unprecedented buy volume on XRP pairs. Instant Buy & Instant Deposit with zero conversion slippage is now available across all member accounts.",
    impact: "high",
    category: "market",
    source: "Dew Trades Market Desk",
    created_at: new Date(Date.now() - 14400000).toISOString(),
  },
];

function AnnouncementsPage() {
  const { data: announcements, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30000,
  });

  const adminPosts = announcements ?? [];
  const hasAdminPosts = adminPosts.length > 0;
  const newsItems = hasAdminPosts ? FALLBACK_NEWS.slice(0, 3) : FALLBACK_NEWS;
  const allItems = [...adminPosts, ...newsItems];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-hero shadow-glow">
            <Megaphone className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Announcements</h1>
            <p className="text-sm text-muted-foreground">
              Stay up to date with the latest platform news and market updates.
            </p>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <Card className="p-10 text-center">
          <Bell className="mx-auto h-10 w-10 text-muted-foreground animate-pulse" />
          <p className="mt-4 text-sm text-muted-foreground">Loading announcements...</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {allItems.map((item: any, i: number) => {
            const isAdmin = adminPosts.includes(item);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
              >
                <Card
                  className={`p-5 ${item.is_urgent ? "border-destructive/40 bg-destructive/5" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    {item.is_urgent ? (
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    ) : isAdmin ? (
                      <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    ) : (
                      <Newspaper className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{item.title}</h3>
                        {item.is_urgent && (
                          <Badge variant="destructive" className="text-[10px]">
                            Urgent
                          </Badge>
                        )}
                        {isAdmin ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {item.category || "Platform"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                            <TrendingUp className="h-2.5 w-2.5" /> Market News
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                        {item.content || item.title}
                      </p>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleString()} — {item.source || "Dew Trades"}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
