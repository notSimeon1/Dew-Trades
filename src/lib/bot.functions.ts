import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
          .eq("asset_symbol", "USDT")
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
            asset_symbol: "USDT",
            balance: Number(newBalance.toFixed(6)),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,asset_symbol" },
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

      // 4. Calculate payouts & expiration date
      const minRoi = Number(botData.min_roi ?? 5);
      const maxRoi = Number(botData.max_roi ?? 15);
      const avgRoi = (minRoi + maxRoi) / 2;
      const dailyPayout = Number(botData.daily_payout ?? 0) || (data.amount * avgRoi) / 100;
      const hourlyPayout = Number(botData.hourly_payout ?? 0) || dailyPayout / 24;
      const durationDays = Number(botData.duration_days ?? 30);
      const expirationDate = new Date(
        Date.now() + durationDays * 24 * 60 * 60 * 1000,
      ).toISOString();

      // 5. Insert active bot record with clean schema-matching columns
      const cleanBotPayload = {
        user_id: data.userId,
        bot_id: data.botId,
        invested_amount: data.amount,
        activation_date: new Date().toISOString(),
        expiration_date: expirationDate,
        last_payout_at: new Date().toISOString(),
        current_profit: 0,
        status: "active",
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
            .upsert(
              { user_id: data.userId, asset_symbol: "USDT", balance: availableBalance },
              { onConflict: "user_id,asset_symbol" },
            );
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
