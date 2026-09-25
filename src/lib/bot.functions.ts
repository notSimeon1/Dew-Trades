import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  calculateBotProfitByTime,
  calculateCopyProfitByTime,
  encodeCopyTierKey,
} from "@/lib/profit-timing";

export const activateBotServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      userId: string;
      botId: string;
      amount: number;
      mode: "demo" | "live";
      currencyPool?: "USD" | "USDT";
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const pool = data.currencyPool ?? "USD";

      // 1. Fetch bot definition
      const { data: bot, error: botFetchErr } = await supabaseAdmin
        .from("trading_bots" as any)
        .select("*")
        .eq("id", data.botId)
        .single();

      if (botFetchErr || !bot) {
        return { success: false, message: "Trading bot not found or inactive." };
      }

      const botData = bot as any;
      if (data.amount < Number(botData.capital_required || 0)) {
        return {
          success: false,
          message: `Minimum investment for ${botData.name} is $${botData.capital_required}`,
        };
      }

      // 2. Fetch user profile & check balance for chosen currency pool
      const { data: prof, error: profErr } = await supabaseAdmin
        .from("profiles" as any)
        .select("id, live_balance, account_balance, available_cash, demo_balance, crypto_balances")
        .eq("id", data.userId)
        .single();

      if (profErr || !prof) {
        return { success: false, message: "User profile not found." };
      }

      let availableBalance = 0;

      if (data.mode === "demo") {
        availableBalance = Number((prof as any).demo_balance ?? 10000);
      } else if (pool === "USDT") {
        // Query USDT balance from user_crypto_balances and profile.crypto_balances
        const { data: cryptoRow } = await supabaseAdmin
          .from("user_crypto_balances")
          .select("balance")
          .eq("user_id", data.userId)
          .eq("symbol", "USDT")
          .maybeSingle();

        const jsonUsdt = Number(((prof as any)?.crypto_balances ?? {}).USDT ?? 0);
        availableBalance = Math.max(jsonUsdt, Number(cryptoRow?.balance ?? 0));
      } else {
        // USD Fiat Live Pool
        availableBalance = Number(
          (prof as any).live_balance ??
            (prof as any).account_balance ??
            (prof as any).available_cash ??
            0,
        );
      }

      if (availableBalance < data.amount) {
        const errorMsg = `Insufficient liquidity in ${pool} pool. Required: $${data.amount} ${pool}, Available: $${availableBalance.toFixed(2)} ${pool}.`;

        // Explicit Error Logging for failed transaction attempt due to insufficient liquidity
        console.error(
          `[AI Trading Bot Execution Error] Failed transaction attempt due to insufficient liquidity! User ID: ${data.userId}, Bot: ${botData.name}, Mode: ${data.mode}, Currency Pool: ${pool}, Required: ${data.amount}, Available: ${availableBalance}`,
        );

        // Record failed transaction attempt for auditability
        await supabaseAdmin.from("transactions" as any).insert({
          user_id: data.userId,
          type: "bot_activation",
          amount: data.amount,
          asset_name: `Failed AI Bot (${botData.name}): Insufficient ${pool} Liquidity`,
          status: "failed",
          account_mode: data.mode,
        });

        return { success: false, message: errorMsg };
      }

      // 3. Deduct balance from specified pool
      const newBalance = availableBalance - data.amount;
      const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };

      if (data.mode === "demo") {
        updatePayload.demo_balance = newBalance;
        const { error: updateBalErr } = await supabaseAdmin
          .from("profiles" as any)
          .update(updatePayload)
          .eq("id", data.userId);

        if (updateBalErr) throw new Error("Failed to deduct demo balance.");
      } else if (pool === "USDT") {
        // Deduct from USDT crypto balances
        const currentJson = ((prof as any)?.crypto_balances ?? {}) as Record<string, number>;
        const updatedJson = { ...currentJson, USDT: Number(newBalance.toFixed(6)) };

        await supabaseAdmin
          .from("profiles" as any)
          .update({ crypto_balances: updatedJson, updated_at: new Date().toISOString() })
          .eq("id", data.userId);

        await supabaseAdmin.from("user_crypto_balances").upsert(
          {
            user_id: data.userId,
            symbol: "USDT",
            balance: Number(newBalance.toFixed(6)),
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "user_id,symbol" },
        );
      } else {
        // Deduct from USD fiat live balance
        updatePayload.live_balance = newBalance;
        updatePayload.account_balance = newBalance;
        updatePayload.available_cash = newBalance;

        const { error: updateBalErr } = await supabaseAdmin
          .from("profiles" as any)
          .update(updatePayload)
          .eq("id", data.userId);

        if (updateBalErr) throw new Error("Failed to deduct USD live balance.");
      }

      // 4. Calculate payouts & expiration date (strictly >= 20% daily ROI)
      const minRoi = Math.max(20, Number(botData.min_roi ?? 20));
      const maxRoi = Math.max(20, Number(botData.max_roi ?? 20));
      const avgRoi = (minRoi + maxRoi) / 2;
      const dailyPayout = Number(((data.amount * avgRoi) / 100).toFixed(2));
      const hourlyPayout = Number((dailyPayout / 24).toFixed(4));
      const durationDays = Number(botData.duration_days ?? 10);
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      // 5. Insert active bot record with clean schema-matching columns
      const cleanBotPayload = {
        user_id: data.userId,
        bot_id: data.botId,
        bot_name: botData.name || "AI Trading Bot",
        invested_amount: data.amount,
        profit_accumulated: 0,
        daily_payout: dailyPayout,
        hourly_payout: hourlyPayout,
        payout_interval: "daily",
        account_mode: data.mode,
        status: "active",
        expires_at: expiresAt,
        last_payout_at: new Date().toISOString(),
      };

      const { error: botErr } = await supabaseAdmin
        .from("user_active_bots" as any)
        .insert(cleanBotPayload);

      if (botErr) {
        console.error(
          `[AI Trading Bot Execution Error] Failed to insert active bot record: ${botErr.message}`,
        );

        // Rollback balance deduction
        if (data.mode === "demo") {
          await supabaseAdmin
            .from("profiles" as any)
            .update({ demo_balance: availableBalance })
            .eq("id", data.userId);
        } else if (pool === "USDT") {
          const currentJson = ((prof as any)?.crypto_balances ?? {}) as Record<string, number>;
          await supabaseAdmin
            .from("profiles" as any)
            .update({ crypto_balances: { ...currentJson, USDT: availableBalance } })
            .eq("id", data.userId);
          await supabaseAdmin
            .from("user_crypto_balances")
            .upsert({ user_id: data.userId, symbol: "USDT", balance: availableBalance } as any, {
              onConflict: "user_id,symbol",
            });
        } else {
          await supabaseAdmin
            .from("profiles" as any)
            .update({
              live_balance: availableBalance,
              account_balance: availableBalance,
              available_cash: availableBalance,
            })
            .eq("id", data.userId);
        }

        return { success: false, message: `Bot activation failed: ${botErr.message}` };
      }

      // 6. Record transaction
      await supabaseAdmin.from("transactions" as any).insert({
        user_id: data.userId,
        type: "bot_activation",
        amount: data.amount,
        asset_name: `Activated AI Bot: ${botData.name} (${pool})`,
        status: "completed",
        account_mode: data.mode,
      });

      return {
        success: true,
        message: `${botData.name} activated successfully using ${pool} pool!`,
      };
    } catch (err: any) {
      console.error(`[AI Trading Bot Exception Error]:`, err);
      return {
        success: false,
        message: err?.message || "Failed to activate trading bot.",
      };
    }
  });

export const harvestBotProfitServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string; activeBotId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { data: bot, error: botErr } = await supabaseAdmin
        .from("user_active_bots" as any)
        .select("*")
        .eq("id", data.activeBotId)
        .eq("user_id", data.userId)
        .single();

      if (botErr || !bot) return { success: false, message: "Active bot not found." };

      const b = bot as any;
      const timing = calculateBotProfitByTime(b);
      const rawProfit = Math.max(timing.accruedProfit, Number(b.profit_accumulated ?? 0));
      const profit = Number(rawProfit.toFixed(2));
      if (profit < 0.01) {
        return {
          success: false,
          message: "Accumulated profit must be at least $0.01 to harvest.",
        };
      }

      // Fetch user profile
      const { data: prof } = await supabaseAdmin
        .from("profiles" as any)
        .select("id, demo_balance, live_balance, account_balance, available_cash")
        .eq("id", data.userId)
        .single();

      const p = prof as any;
      if (b.account_mode === "demo") {
        const cur = Number(p?.demo_balance ?? 10000);
        await supabaseAdmin
          .from("profiles" as any)
          .update({ demo_balance: Number((cur + profit).toFixed(2)) })
          .eq("id", data.userId);
      } else {
        const cur = Number(p?.live_balance ?? p?.account_balance ?? 0);
        const next = Number((cur + profit).toFixed(2));
        await supabaseAdmin
          .from("profiles" as any)
          .update({
            live_balance: next,
            account_balance: next,
            available_cash: next,
          })
          .eq("id", data.userId);
      }

      // Reset bot accumulated profit and stamp last_payout_at to now
      const nowIso = new Date().toISOString();
      const isExpired =
        timing.isExpired || (b.expires_at ? new Date() >= new Date(b.expires_at) : false);

      const updateBotPayload: Record<string, any> = {
        profit_accumulated: 0,
        last_payout_at: nowIso,
      };

      if (isExpired) {
        updateBotPayload.status = "completed";
      }

      const { error: updateBotErr } = await supabaseAdmin
        .from("user_active_bots" as any)
        .update(updateBotPayload)
        .eq("id", data.activeBotId);

      if (updateBotErr) {
        console.error("[Harvest Bot Error] Failed to update user_active_bots:", updateBotErr);
        throw new Error("Failed to reset accumulated profit: " + updateBotErr.message);
      }

      // Record transaction
      await supabaseAdmin.from("transactions" as any).insert({
        user_id: data.userId,
        type: "trade_profit",
        amount: profit,
        asset_name: `Harvested Yield: ${b.bot_name}`,
        status: "completed",
        account_mode: b.account_mode,
      });

      return {
        success: true,
        harvestedAmount: profit,
        timeElapsedLabel: timing.timeSinceLastHarvestLabel,
        newLastPayoutAt: nowIso,
        isCompleted: isExpired,
        message: isExpired
          ? `Final profit of $${profit.toFixed(2)} harvested! Bot has completed its runtime.`
          : `Successfully harvested $${profit.toFixed(2)} to your balance (${timing.timeSinceLastHarvestLabel})!`,
      };
    } catch (err: any) {
      return { success: false, message: err?.message || "Failed to harvest profit." };
    }
  });

export const terminateBotServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string; activeBotId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { data: bot, error: botErr } = await supabaseAdmin
        .from("user_active_bots" as any)
        .select("*")
        .eq("id", data.activeBotId)
        .eq("user_id", data.userId)
        .single();

      if (botErr || !bot) return { success: false, message: "Active bot not found." };

      const b = bot as any;
      const principal = Number(b.invested_amount ?? 0);
      const timing = calculateBotProfitByTime(b);
      const profit = Number(timing.totalProfit.toFixed(2));
      const totalRefund = Number((principal + profit).toFixed(2));

      // Fetch user profile
      const { data: prof } = await supabaseAdmin
        .from("profiles" as any)
        .select("id, demo_balance, live_balance, account_balance, available_cash")
        .eq("id", data.userId)
        .single();

      const p = prof as any;
      if (b.account_mode === "demo") {
        const cur = Number(p?.demo_balance ?? 10000);
        await supabaseAdmin
          .from("profiles" as any)
          .update({ demo_balance: Number((cur + totalRefund).toFixed(2)) })
          .eq("id", data.userId);
      } else {
        const cur = Number(p?.live_balance ?? p?.account_balance ?? 0);
        const next = Number((cur + totalRefund).toFixed(2));
        await supabaseAdmin
          .from("profiles" as any)
          .update({
            live_balance: next,
            account_balance: next,
            available_cash: next,
          })
          .eq("id", data.userId);
      }

      // Mark bot completed/stopped
      const { error: termBotErr } = await supabaseAdmin
        .from("user_active_bots" as any)
        .update({
          status: "completed",
          profit_accumulated: 0,
          last_payout_at: new Date().toISOString(),
        })
        .eq("id", data.activeBotId);

      if (termBotErr) {
        console.error("[Terminate Bot Error]:", termBotErr);
        throw new Error("Failed to update bot status: " + termBotErr.message);
      }

      // Record transaction
      await supabaseAdmin.from("transactions" as any).insert({
        user_id: data.userId,
        type: "bot_settlement",
        amount: totalRefund,
        asset_name: `Settled AI Bot: ${b.bot_name} (Principal + Profit)`,
        status: "completed",
        account_mode: b.account_mode,
      });

      return {
        success: true,
        refundedAmount: totalRefund,
        message: `Bot settled successfully. Returned $${totalRefund.toFixed(2)} to your balance.`,
      };
    } catch (err: any) {
      return { success: false, message: err?.message || "Failed to settle bot." };
    }
  });

export const activateCopyTradingServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: { userId: string; tierId: string; amount: number; mode: "live" | "demo" }) => data,
  )
  .handler(async ({ data }) => {
    try {
      // 1. Check user profile & suspension status
      const { data: prof, error: profErr } = await supabaseAdmin
        .from("profiles" as any)
        .select("id, is_suspended, demo_balance, live_balance, account_balance, available_cash")
        .eq("id", data.userId)
        .single();

      if (profErr || !prof) {
        return { success: false, message: "User profile not found." };
      }

      if ((prof as any).is_suspended) {
        return {
          success: false,
          message: "Account suspended — copy trading is disabled. Contact support.",
        };
      }

      // 2. Fetch copy trading tier
      const { data: tier, error: tierErr } = await supabaseAdmin
        .from("copy_trading_tiers" as any)
        .select("*")
        .eq("id", data.tierId)
        .eq("is_active", true)
        .single();

      if (tierErr || !tier) {
        return {
          success: false,
          message: "Selected copy trading tier is not active or available.",
        };
      }

      const tierData = tier as any;
      const minCapital = Number(tierData.required_capital ?? 100);
      if (data.amount < minCapital) {
        return {
          success: false,
          message: `Minimum allocation for ${tierData.tier_name || "this tier"} is $${minCapital}.`,
        };
      }

      // 3. Balance verification
      const isDemo = data.mode === "demo";
      const availableBalance = isDemo
        ? Number((prof as any).demo_balance ?? 10000)
        : Number(
            (prof as any).available_cash ??
              (prof as any).live_balance ??
              (prof as any).account_balance ??
              0,
          );

      if (availableBalance < data.amount) {
        return {
          success: false,
          message: `Insufficient balance. Available: $${availableBalance.toFixed(2)}, Required: $${data.amount.toFixed(2)}`,
        };
      }

      // 4. Deduct balance from specified mode
      const newBalance = Number((availableBalance - data.amount).toFixed(2));
      if (isDemo) {
        const { error: balErr } = await supabaseAdmin
          .from("profiles" as any)
          .update({ demo_balance: newBalance, updated_at: new Date().toISOString() })
          .eq("id", data.userId);
        if (balErr) throw new Error("Failed to deduct demo balance.");
      } else {
        const { error: balErr } = await supabaseAdmin
          .from("profiles" as any)
          .update({
            live_balance: newBalance,
            account_balance: newBalance,
            available_cash: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.userId);
        if (balErr) throw new Error("Failed to deduct live balance.");
      }

      // 5. Expiration & clean tier key
      const lockDays = Number(tierData.lock_in_days) || 30;
      const expiresAt = new Date(Date.now() + lockDays * 24 * 60 * 60 * 1000).toISOString();
      const cleanTierKey = isDemo
        ? `${tierData.tier_key || "tier"}:demo`
        : tierData.tier_key || "tier";

      // 6. Insert allocation into user_copy_allocations with valid columns
      const allocationPayload = {
        user_id: data.userId,
        tier_id: tierData.id,
        tier_key: cleanTierKey,
        allocated_amount: data.amount,
        total_profit: 0,
        strategist_name: tierData.strategist_name || null,
        status: "active",
        expires_at: expiresAt,
      };

      const { data: newAlloc, error: allocErr } = await supabaseAdmin
        .from("user_copy_allocations" as any)
        .insert(allocationPayload)
        .select()
        .single();

      if (allocErr) {
        console.error("[Copy Trading Insert Error]:", allocErr);
        // Rollback balance deduction
        if (isDemo) {
          await supabaseAdmin
            .from("profiles" as any)
            .update({ demo_balance: availableBalance })
            .eq("id", data.userId);
        } else {
          await supabaseAdmin
            .from("profiles" as any)
            .update({
              live_balance: availableBalance,
              account_balance: availableBalance,
              available_cash: availableBalance,
            })
            .eq("id", data.userId);
        }
        return {
          success: false,
          message: `Failed to activate copy allocation: ${allocErr.message}`,
        };
      }

      // 7. Record transaction
      await supabaseAdmin.from("transactions" as any).insert({
        user_id: data.userId,
        type: "copy_trade",
        amount: data.amount,
        asset_name: `Copy Trading: ${tierData.strategist_name || tierData.tier_name}`,
        status: "completed",
        account_mode: data.mode,
      });

      return {
        success: true,
        allocationId: newAlloc?.id,
        message: `Copy trading successfully activated with ${tierData.tier_name}!`,
      };
    } catch (err: any) {
      console.error("[activateCopyTradingServerFn Exception]:", err);
      return { success: false, message: err?.message || "Failed to activate copy trading." };
    }
  });

export const harvestCopyProfitServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string; allocationId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { data: alloc, error: allocErr } = await supabaseAdmin
        .from("user_copy_allocations" as any)
        .select("*")
        .eq("id", data.allocationId)
        .eq("user_id", data.userId)
        .single();

      if (allocErr || !alloc) return { success: false, message: "Copy allocation not found." };

      const a = alloc as any;
      const timing = calculateCopyProfitByTime(a);
      const profit = Number(timing.totalProfit.toFixed(2));
      if (profit <= 0) {
        return { success: false, message: "No accumulated profit to harvest at this time." };
      }

      const { data: prof } = await supabaseAdmin
        .from("profiles" as any)
        .select("id, demo_balance, live_balance, account_balance, available_cash")
        .eq("id", data.userId)
        .single();

      const p = prof as any;
      const isDemo =
        a.account_mode === "demo" ||
        (typeof a.tier_key === "string" && a.tier_key.endsWith(":demo"));

      if (isDemo) {
        const cur = Number(p?.demo_balance ?? 10000);
        await supabaseAdmin
          .from("profiles" as any)
          .update({ demo_balance: Number((cur + profit).toFixed(2)) })
          .eq("id", data.userId);
      } else {
        const cur = Number(p?.live_balance ?? p?.account_balance ?? 0);
        const next = Number((cur + profit).toFixed(2));
        await supabaseAdmin
          .from("profiles" as any)
          .update({
            live_balance: next,
            account_balance: next,
            available_cash: next,
          })
          .eq("id", data.userId);
      }

      const newTierKey = encodeCopyTierKey(a.tier_key || "tier", isDemo, Date.now());
      const { error: updateCopyErr } = await supabaseAdmin
        .from("user_copy_allocations" as any)
        .update({
          tier_key: newTierKey,
          total_profit: 0,
        })
        .eq("id", data.allocationId);

      if (updateCopyErr) {
        console.error("[Harvest Copy Error]:", updateCopyErr);
        throw new Error("Failed to reset copy profit: " + updateCopyErr.message);
      }

      await supabaseAdmin.from("transactions" as any).insert({
        user_id: data.userId,
        type: "trade_profit",
        amount: profit,
        asset_name: `Harvested Copy Profit: ${a.strategist_name || "Strategist"}`,
        status: "completed",
        account_mode: isDemo ? "demo" : "live",
      });

      return {
        success: true,
        harvestedAmount: profit,
        timeElapsedLabel: timing.timeSinceLastHarvestLabel,
        newTierKey: newTierKey,
        message: `Successfully harvested $${profit.toFixed(2)} to your balance (${timing.timeSinceLastHarvestLabel})!`,
      };
    } catch (err: any) {
      return { success: false, message: err?.message || "Failed to harvest copy profit." };
    }
  });

export const terminateCopyAllocationServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string; allocationId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { data: alloc, error: allocErr } = await supabaseAdmin
        .from("user_copy_allocations" as any)
        .select("*")
        .eq("id", data.allocationId)
        .eq("user_id", data.userId)
        .single();

      if (allocErr || !alloc) return { success: false, message: "Copy allocation not found." };

      const a = alloc as any;
      const principal = Number(a.allocated_amount ?? 0);
      const timing = calculateCopyProfitByTime(a);
      const profit = Number(timing.totalProfit.toFixed(2));
      const totalRefund = Number((principal + profit).toFixed(2));

      const { data: prof } = await supabaseAdmin
        .from("profiles" as any)
        .select("id, demo_balance, live_balance, account_balance, available_cash")
        .eq("id", data.userId)
        .single();

      const p = prof as any;
      const isDemo =
        a.account_mode === "demo" ||
        (typeof a.tier_key === "string" && a.tier_key.endsWith(":demo"));

      if (isDemo) {
        const cur = Number(p?.demo_balance ?? 10000);
        await supabaseAdmin
          .from("profiles" as any)
          .update({ demo_balance: Number((cur + totalRefund).toFixed(2)) })
          .eq("id", data.userId);
      } else {
        const cur = Number(p?.live_balance ?? p?.account_balance ?? 0);
        const next = Number((cur + totalRefund).toFixed(2));
        await supabaseAdmin
          .from("profiles" as any)
          .update({
            live_balance: next,
            account_balance: next,
            available_cash: next,
          })
          .eq("id", data.userId);
      }

      const { error: termCopyErr } = await supabaseAdmin
        .from("user_copy_allocations" as any)
        .update({ status: "closed", total_profit: 0 })
        .eq("id", data.allocationId);

      if (termCopyErr) {
        console.error("[Terminate Copy Error]:", termCopyErr);
        throw new Error("Failed to close copy allocation: " + termCopyErr.message);
      }

      await supabaseAdmin.from("transactions" as any).insert({
        user_id: data.userId,
        type: "copy_trade_close",
        amount: totalRefund,
        asset_name: `Closed Copy Allocation: ${a.strategist_name || "Strategist"}`,
        status: "completed",
        account_mode: isDemo ? "demo" : "live",
      });

      return {
        success: true,
        refundedAmount: totalRefund,
        message: `Copy allocation closed. Returned $${totalRefund.toFixed(2)} to your balance.`,
      };
    } catch (err: any) {
      return { success: false, message: err?.message || "Failed to close copy allocation." };
    }
  });
