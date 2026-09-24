import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { calculateBotProfitByTime, calculateCopyProfitByTime } from "@/lib/profit-timing";

export function useRealtimeProfitEngine() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;

    let isRunning = false;

    const interval = setInterval(async () => {
      if ((typeof document !== "undefined" && document.hidden) || isRunning) return;
      isRunning = true;
      try {
        // 1. Fetch bots and copy allocations in parallel
        const [botsRes, copyRes] = await Promise.all([
          supabase
            .from("user_active_bots")
            .select(
              "id, bot_id, bot_name, invested_amount, profit_accumulated, daily_payout, hourly_payout, status, account_mode, created_at, last_payout_at, expires_at",
            )
            .eq("user_id", user.id)
            .or("status.eq.active,status.eq.running"),
          supabase
            .from("user_copy_allocations")
            .select(
              "id, tier_id, tier_key, allocated_amount, total_profit, strategist_name, status, created_at, expires_at",
            )
            .eq("user_id", user.id)
            .or("status.eq.active,status.eq.running"),
        ]);

        const activeBots = (botsRes.data as any[]) || [];
        const copyAllocations = (copyRes.data as any[]) || [];

        if (activeBots.length === 0 && copyAllocations.length === 0) {
          isRunning = false;
          return;
        }

        const now = Date.now();

        const botUpdates = activeBots.map(async (bot: any) => {
          const timing = calculateBotProfitByTime(bot, now);
          const computedProfit = timing.totalProfit;
          const currentStored = Number(bot.profit_accumulated ?? 0);

          // Only sync to DB if profit has grown by at least $0.50 since last DB write
          if (Math.abs(computedProfit - currentStored) >= 0.5) {
            return supabase
              .from("user_active_bots")
              .update({
                profit_accumulated: computedProfit,
              } as never)
              .eq("id", bot.id);
          }
        });

        const copyUpdates = copyAllocations.map(async (alloc: any) => {
          const timing = calculateCopyProfitByTime(alloc, now);
          const computedProfit = timing.totalProfit;
          const currentStored = Number(alloc.total_profit ?? 0);

          if (Math.abs(computedProfit - currentStored) >= 0.5) {
            return supabase
              .from("user_copy_allocations")
              .update({
                total_profit: computedProfit,
              } as never)
              .eq("id", alloc.id);
          }
        });

        await Promise.all([...botUpdates.filter(Boolean), ...copyUpdates.filter(Boolean)]);
      } catch (e) {
        console.error("[RealtimeProfitEngine Error]", e);
      } finally {
        isRunning = false;
      }
    }, 120000); // Relaxed to 2 minutes background sync (client UI computes live seconds-level profit directly)

    return () => clearInterval(interval);
  }, [user, qc]);
}
