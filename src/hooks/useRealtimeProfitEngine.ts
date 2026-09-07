import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAccountMode } from "@/lib/account-mode-context";

export function useRealtimeProfitEngine() {
  const { user } = useAuth();
  const { mode } = useAccountMode();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      if (document.hidden) return;
      try {
        const balanceCol = mode === "demo" ? "demo_balance" : "live_balance";

        // 1. Fetch bots and copy allocations in parallel
        const [botsRes, copyRes] = await Promise.all([
          supabase
            .from("user_active_bots")
            .select(
              "id, invested_amount, current_profit, trading_bots(hourly_payout, daily_payout)",
            )
            .eq("user_id", user.id)
            .or("status.eq.active,status.eq.running"),
          supabase
            .from("user_copy_allocations")
            .select("id, allocated_amount, current_profit")
            .eq("user_id", user.id)
            .or("status.eq.active,status.eq.running"),
        ]);

        const activeBots = botsRes.data || [];
        const copyAllocations = copyRes.data || [];

        if (activeBots.length === 0 && copyAllocations.length === 0) return;

        let totalBotCredit = 0;
        const botUpdates = activeBots.map(async (bot: any) => {
          const tb = bot.trading_bots;
          const invested = Number(bot.invested_amount) || 500;
          const hourlyFromTb = Number(tb?.hourly_payout) || 0;
          const dailyFromTb = Number(tb?.daily_payout) || 0;
          const hourly = hourlyFromTb || (dailyFromTb ? dailyFromTb / 24 : (invested * 0.1) / 24);
          const tickIncrement = Number((hourly / 360).toFixed(4));
          if (tickIncrement <= 0) return;

          const newProfit = Number((Number(bot.current_profit || 0) + tickIncrement).toFixed(4));
          totalBotCredit += tickIncrement;

          return supabase
            .from("user_active_bots")
            .update({ current_profit: newProfit } as never)
            .eq("id", bot.id);
        });

        let totalCopyCredit = 0;
        const copyUpdates = copyAllocations.map(async (alloc) => {
          const allocated = Number(alloc.allocated_amount) || 1000;
          const tickIncrement = Number((allocated * 0.00015).toFixed(4));
          if (tickIncrement <= 0) return;

          const newProfit = Number((Number(alloc.current_profit || 0) + tickIncrement).toFixed(4));
          totalCopyCredit += tickIncrement;

          return supabase
            .from("user_copy_allocations")
            .update({ current_profit: newProfit } as never)
            .eq("id", alloc.id);
        });

        await Promise.all([...botUpdates.filter(Boolean), ...copyUpdates.filter(Boolean)]);

        // Credit User Balance
        const totalCredit = Number((totalBotCredit + totalCopyCredit).toFixed(4));
        if (totalCredit > 0) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("live_balance, account_balance, available_cash, demo_balance")
            .eq("id", user.id)
            .single();

          if (mode === "demo") {
            const currentBal = Number((prof as any)?.demo_balance ?? 10000);
            const newBal = Number((currentBal + totalCredit).toFixed(4));
            await supabase
              .from("profiles")
              .update({ demo_balance: newBal } as never)
              .eq("id", user.id);
          } else {
            const currentBal = Number(
              (prof as any)?.live_balance ??
                (prof as any)?.account_balance ??
                (prof as any)?.available_cash ??
                0,
            );
            const newBal = Number((currentBal + totalCredit).toFixed(4));
            await supabase
              .from("profiles")
              .update({
                live_balance: newBal,
                account_balance: newBal,
                available_cash: newBal,
              } as never)
              .eq("id", user.id);
          }

          qc.invalidateQueries({ queryKey: ["profile"] });
          qc.invalidateQueries({ queryKey: ["my_active_bots"] });
          qc.invalidateQueries({ queryKey: ["my_copy_allocations"] });
        }
      } catch (e) {
        console.error("[RealtimeProfitEngine Error]", e);
      }
    }, 15000); // 15s interval for optimal DB RAM conservation

    return () => clearInterval(interval);
  }, [user, mode, qc]);
}
