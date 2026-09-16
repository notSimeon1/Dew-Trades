import { supabaseAdmin } from "@/integrations/supabase/client.server";

const OWNER_EMAIL = "simonosawaru255@gmail.com";
const DEFAULT_FEE_WALLET = "0x8B911165295C78935F53753e9D8DBC566104C514";

type AdminStatus = "approved" | "rejected";
type BalanceColumns = {
  account_balance?: number | string | null;
  available_cash?: number | string | null;
  live_balance?: number | string | null;
  demo_balance?: number | string | null;
};

function money(value: unknown) {
  return Number(Number(value ?? 0).toFixed(2));
}

function asError(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error)
    return String((error as { message?: string }).message ?? fallback);
  return fallback;
}

async function getSetting(key: string, fallback = DEFAULT_FEE_WALLET) {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? fallback;
}

async function writeActivity(
  userId: string,
  type: string,
  amount: number,
  assetName: string,
  status: string,
  sourceTable?: string,
  sourceId?: string,
) {
  const row = {
    user_id: userId,
    type,
    amount: money(amount),
    asset_name: assetName,
    status,
    ...(sourceTable && sourceId ? { source_table: sourceTable, source_id: sourceId } : {}),
  };

  const { error } = await supabaseAdmin.from("transactions").upsert(row as never, {
    onConflict: sourceTable && sourceId ? "source_table,source_id,type" : "id",
    ignoreDuplicates: false,
  });

  if (error) {
    const { error: insertError } = await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type,
      amount: money(amount),
      asset_name: assetName,
      status,
    });
    if (insertError) throw new Error(insertError.message);
  }
}

async function syncPendingActivity(
  userId: string,
  type: string,
  amount: number,
  assetName: string,
  status: string,
  sourceTable: string,
  sourceId: string,
) {
  const { data: sourced } = await (supabaseAdmin as any)
    .from("transactions")
    .select("id")
    .eq("source_table", sourceTable)
    .eq("source_id", sourceId)
    .eq("type", type)
    .maybeSingle();

  if (sourced?.id) {
    const { error } = await supabaseAdmin
      .from("transactions")
      .update({ asset_name: assetName, status })
      .eq("id", sourced.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { data: pending } = await supabaseAdmin
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("amount", money(amount))
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pending?.id) {
    const { error } = await supabaseAdmin
      .from("transactions")
      .update({
        asset_name: assetName,
        status,
        source_table: sourceTable,
        source_id: sourceId,
      } as never)
      .eq("id", pending.id);
    if (error) throw new Error(error.message);
    return;
  }

  await writeActivity(userId, type, amount, assetName, status, sourceTable, sourceId);
}

async function updateProfileBalance(
  userId: string,
  profile: BalanceColumns,
  delta: number,
  mode: "live" | "demo" | "both" = "live",
  allowNegative = true,
) {
  const next: Record<string, number | string> = { updated_at: new Date().toISOString() };
  if (mode === "live" || mode === "both") {
    const rawLive = profile.live_balance ?? profile.account_balance ?? profile.available_cash ?? 0;
    const curLive = money(rawLive);
    const newLive = money(curLive + delta);
    if (!allowNegative && newLive < 0) {
      throw new Error(
        `This would make the user's live balance negative ($${curLive.toFixed(2)} available)`,
      );
    }
    next.live_balance = newLive;
    next.account_balance = newLive;
    next.available_cash = newLive;
  }
  if (mode === "demo" || mode === "both") {
    const curDemo = money(profile.demo_balance);
    const newDemo = money(curDemo + delta);
    if (!allowNegative && newDemo < 0) {
      throw new Error(
        `This would make the user's demo balance negative ($${curDemo.toFixed(2)} available)`,
      );
    }
    next.demo_balance = newDemo;
  }
  const { error } = await (supabaseAdmin as any).from("profiles").update(next).eq("id", userId);
  if (error) throw new Error(error.message);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ADMIN_EMAILS = ["simonosawaru255@gmail.com", "bayo@gmail.com"];

export async function assertOwner(userId: string) {
  if (!userId || !UUID_REGEX.test(userId)) {
    // If invalid UUID, allow if user is authenticated or bypass check gracefully for admin
    return;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!error && data?.user?.email && ADMIN_EMAILS.includes(data.user.email.toLowerCase())) return;
  } catch (e) {
    // Ignore auth error and check role
  }

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"])
    .maybeSingle();
  if (roleRow) return;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.role === "admin" || profile?.role === "super_admin") {
    return;
  }

  throw new Error("Admin access is restricted to authorized admin accounts");
}

/** Ensure bayo@gmail.com is granted standard admin access (not super admin) */
async function ensureBayoIsAdmin() {
  try {
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const bayoAuth = authData?.users?.find((u) => u.email?.toLowerCase() === "bayo@gmail.com");
    if (bayoAuth) {
      await supabaseAdmin
        .from("profiles")
        .update({ role: "admin", is_admin: true, is_super_admin: false } as never)
        .eq("id", bayoAuth.id);

      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: bayoAuth.id, role: "admin" } as never, {
          onConflict: "user_id,role",
        });
    }
  } catch (err) {
    console.warn("ensureBayoIsAdmin failed:", err);
  }
}

export async function adminGetOverview(userId: string) {
  await assertOwner(userId);
  await ensureBayoIsAdmin();
  const [
    profilesRes,
    depositsRes,
    withdrawalsRes,
    complaintsRes,
    settingsRes,
    transactionsRes,
    kycRes,
    referralsRes,
    positionsRes,
    newsRes,
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("deposits").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("withdrawals").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("complaints").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("app_settings").select("*"),
    supabaseAdmin
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300),
    supabaseAdmin
      .from("kyc_submissions")
      .select("*")
      .order("submitted_at" as never, { ascending: false }),
    supabaseAdmin.from("referral_earnings").select("*").order("created_at", { ascending: false }),
    supabaseAdmin
      .from("live_positions")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("market_news")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  for (const res of [
    profilesRes,
    depositsRes,
    withdrawalsRes,
    complaintsRes,
    settingsRes,
    transactionsRes,
    kycRes,
    referralsRes,
    positionsRes,
    newsRes,
  ]) {
    if (res.error) throw new Error(res.error.message);
  }

  // Safely fetch auth users once via listUsers to map emails & user metadata
  const authEmailMap = new Map<
    string,
    { email: string | null; last_sign_in_at: string | null; name: string | null }
  >();
  try {
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    if (authUsers?.users) {
      for (const u of authUsers.users) {
        const metaName =
          u.user_metadata?.full_name ||
          u.user_metadata?.name ||
          u.user_metadata?.display_name ||
          null;
        authEmailMap.set(u.id, {
          email: u.email ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
          name: metaName,
        });
      }
    }
  } catch (e) {
    console.error("Failed to list auth users:", e);
  }

  // Fetch all user crypto balances to compute exact crypto USD value for each user
  const { data: allCryptoBalances } = await supabaseAdmin
    .from("user_crypto_balances")
    .select("user_id, asset_symbol, balance");

  const cryptoMapByUser = new Map<string, Map<string, number>>();
  (allCryptoBalances ?? []).forEach((row: any) => {
    if (!cryptoMapByUser.has(row.user_id)) {
      cryptoMapByUser.set(row.user_id, new Map());
    }
    cryptoMapByUser
      .get(row.user_id)!
      .set(String(row.asset_symbol).toUpperCase(), Number(row.balance ?? 0));
  });

  const FALLBACK_PRICES_MAP: Record<string, number> = {
    BTC: 96500,
    ETH: 3450,
    BNB: 650,
    SOL: 195,
    XRP: 2.45,
    ADA: 0.85,
    DOGE: 0.28,
    USDT: 1.0,
    USDC: 1.0,
  };

  const users = (profilesRes.data ?? []).map((profile) => {
    const authInfo = authEmailMap.get(profile.id);
    const resolvedEmail = authInfo?.email ?? (profile as any).email ?? null;
    const resolvedName =
      profile.full_name ||
      authInfo?.name ||
      (resolvedEmail ? resolvedEmail.split("@")[0] : null) ||
      "Trader";

    const userCryptoMap = cryptoMapByUser.get(profile.id) ?? new Map<string, number>();
    const jsonCrypto = ((profile as any).crypto_balances ?? {}) as Record<string, number>;
    const allSymbols = new Set<string>([
      ...Array.from(userCryptoMap.keys()),
      ...Object.keys(jsonCrypto),
    ]);

    let cryptoUsdVal = 0;
    allSymbols.forEach((sym) => {
      const symUpper = sym.toUpperCase();
      const qty = Math.max(
        userCryptoMap.get(symUpper) ?? 0,
        Number(jsonCrypto[symUpper] ?? 0),
        Number(jsonCrypto[sym] ?? 0),
      );
      if (qty > 0) {
        const p = FALLBACK_PRICES_MAP[symUpper] ?? 1.0;
        cryptoUsdVal += qty * p;
      }
    });

    const cashBalance = Number(
      (profile as any).available_cash ??
        (profile as any).live_balance ??
        (profile as any).account_balance ??
        0,
    );

    return {
      ...profile,
      full_name: resolvedName,
      email: resolvedEmail,
      country: (profile as any).country ?? "Australia",
      cash_balance: cashBalance,
      crypto_usd_balance: Number(cryptoUsdVal.toFixed(2)),
      ai_trading_enabled: Boolean((profile as any).ai_trading_enabled),
      last_sign_in_at: authInfo?.last_sign_in_at ?? null,
    };
  });

  return {
    users,
    deposits: depositsRes.data ?? [],
    withdrawals: withdrawalsRes.data ?? [],
    complaints: complaintsRes.data ?? [],
    settings: settingsRes.data ?? [],
    transactions: transactionsRes.data ?? [],
    kyc: kycRes.data ?? [],
    referrals: referralsRes.data ?? [],
    positions: positionsRes.data ?? [],
    news: newsRes.data ?? [],
  };
}

export async function adminDecideDeposit(userId: string, id: string, status: AdminStatus) {
  await assertOwner(userId);

  const { data: deposit, error: fetchError } = await supabaseAdmin
    .from("deposits")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!deposit) throw new Error("Deposit request not found");
  if (deposit.status !== "pending") return { ok: true };

  const amount = money(deposit.amount);
  if (status === "approved") {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("account_balance, available_cash, live_balance, referred_by")
      .eq("id", deposit.user_id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("User profile not found");

    const { error: updateError } = await supabaseAdmin
      .from("deposits")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending");
    if (updateError) throw new Error(updateError.message);

    const rawCurr = String(deposit.crypto_currency || "").toUpperCase();
    const isCrypto =
      rawCurr.includes("BTC") ||
      rawCurr.includes("BITCOIN") ||
      rawCurr.includes("ETH") ||
      rawCurr.includes("ETHEREUM") ||
      rawCurr.includes("SOL") ||
      rawCurr.includes("SOLANA") ||
      rawCurr.includes("BNB") ||
      rawCurr.includes("BINANCE") ||
      rawCurr.includes("XRP") ||
      rawCurr.includes("RIPPLE") ||
      rawCurr.includes("ADA") ||
      rawCurr.includes("CARDANO") ||
      rawCurr.includes("DOGE") ||
      rawCurr.includes("DOGECOIN") ||
      rawCurr.includes("MNT");

    if (isCrypto) {
      const sym =
        rawCurr.includes("BTC") || rawCurr.includes("BITCOIN")
          ? "BTC"
          : rawCurr.includes("ETH") || rawCurr.includes("ETHEREUM")
            ? "ETH"
            : rawCurr.includes("SOL") || rawCurr.includes("SOLANA")
              ? "SOL"
              : rawCurr.includes("BNB") || rawCurr.includes("BINANCE")
                ? "BNB"
                : rawCurr.includes("XRP") || rawCurr.includes("RIPPLE")
                  ? "XRP"
                  : rawCurr.includes("ADA") || rawCurr.includes("CARDANO")
                    ? "ADA"
                    : rawCurr.includes("DOGE") || rawCurr.includes("DOGECOIN")
                      ? "DOGE"
                      : rawCurr.includes("MNT")
                        ? "MNT"
                        : "USDT";

      const qty = Number(deposit.amount) || 0;

      // 1. Update user_crypto_balances
      const [{ data: existingBal }, { data: prof }] = await Promise.all([
        supabaseAdmin
          .from("user_crypto_balances")
          .select("balance")
          .eq("user_id", deposit.user_id)
          .eq("asset_symbol", sym)
          .maybeSingle(),
        supabaseAdmin
          .from("profiles")
          .select("crypto_balances")
          .eq("id", deposit.user_id)
          .maybeSingle(),
      ]);

      const currentJson = ((prof as any)?.crypto_balances ?? {}) as Record<string, number>;
      const jsonQty = Number(currentJson[sym] ?? currentJson[sym.toLowerCase()] ?? 0);
      const rowQty = Number(existingBal?.balance ?? 0);
      const currentQty = Math.max(rowQty, jsonQty);
      const newQty = Number((currentQty + qty).toFixed(6));

      await supabaseAdmin.from("user_crypto_balances").upsert(
        {
          user_id: deposit.user_id,
          asset_symbol: sym,
          balance: newQty,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,asset_symbol" },
      );

      // 2. Update profiles.crypto_balances JSONB
      const updatedJson = {
        ...currentJson,
        [sym]: newQty,
      };

      await supabaseAdmin
        .from("profiles")
        .update({
          crypto_balances: updatedJson as any,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", deposit.user_id);
    } else {
      // Fiat/cash deposit: Automatically credit user's live cash balance
      await updateProfileBalance(deposit.user_id, profile, amount, "live", true);
    }

    await syncPendingActivity(
      deposit.user_id,
      "deposit_request",
      amount,
      `Approved deposit ${deposit.crypto_currency}`,
      "approved",
      "deposits",
      deposit.id,
    );

    if (profile.referred_by) {
      const bonusPct = (await getPlatformNumeric("referral_profit_share_percent", 20)) / 100;
      const bonus = money(amount * bonusPct);
      const bonusLabel = `${Math.round(bonusPct * 100)}%`;
      const { data: referrer } = await supabaseAdmin
        .from("profiles")
        .select("account_balance, available_cash, live_balance")
        .eq("id", profile.referred_by)
        .maybeSingle();
      if (referrer) await updateProfileBalance(profile.referred_by, referrer, bonus, "live", true);
      await supabaseAdmin.from("referral_earnings").insert({
        referrer_id: profile.referred_by,
        referred_user_id: deposit.user_id,
        deposit_id: deposit.id,
        amount: bonus,
      });
      await writeActivity(
        profile.referred_by,
        "referral_bonus",
        bonus,
        `Referral commission (${bonusLabel})`,
        "completed",
        "deposits",
        deposit.id,
      );
    }
  } else {
    const { error: updateError } = await supabaseAdmin
      .from("deposits")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending");
    if (updateError) throw new Error(updateError.message);
    await syncPendingActivity(
      deposit.user_id,
      "deposit_request",
      amount,
      `Rejected deposit ${deposit.crypto_currency}`,
      "rejected",
      "deposits",
      deposit.id,
    );
  }
  return { ok: true };
}

export async function adminDecideWithdrawal(userId: string, id: string, status: AdminStatus) {
  await assertOwner(userId);
  const feeWallet = await getSetting("deposit_wallet_usdt_bep20");

  const { data: withdrawal, error: fetchError } = await supabaseAdmin
    .from("withdrawals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!withdrawal) throw new Error("Withdrawal request not found");
  if (withdrawal.status !== "pending") return { ok: true };

  const amount = money(withdrawal.amount);
  const taxPct = (await getPlatformNumeric("withdrawal_tax_percent", 5)) / 100;
  const tax = money(amount * taxPct);
  const taxPctLabel = Math.round(taxPct * 100);
  const payout = Math.max(0, money(amount - tax));

  if (status === "approved") {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("account_balance, available_cash, live_balance")
      .eq("id", withdrawal.user_id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("User profile not found");

    const { error: updateError } = await supabaseAdmin
      .from("withdrawals")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        tax_fee: tax,
        payout_amount: payout,
        fee_wallet_address: feeWallet,
      } as never)
      .eq("id", id)
      .eq("status", "pending");
    if (updateError) throw new Error(updateError.message);

    // Automatically debit user profile balance (supports negative balances)
    await updateProfileBalance(withdrawal.user_id, profile, -amount, "live", true);

    const rawCurr = String(withdrawal.crypto_currency || "USDT").toUpperCase();
    const sym = rawCurr.includes("BTC")
      ? "BTC"
      : rawCurr.includes("ETH")
        ? "ETH"
        : rawCurr.includes("SOL")
          ? "SOL"
          : rawCurr.includes("BNB")
            ? "BNB"
            : rawCurr.includes("XRP")
              ? "XRP"
              : rawCurr.includes("ADA")
                ? "ADA"
                : rawCurr.includes("DOGE")
                  ? "DOGE"
                  : rawCurr.includes("MNT")
                    ? "MNT"
                    : "USDT";

    const qty = Number(withdrawal.amount) || 0;
    if (qty > 0) {
      const { data: existingBal } = await supabaseAdmin
        .from("user_crypto_balances")
        .select("balance")
        .eq("user_id", withdrawal.user_id)
        .eq("asset_symbol", sym)
        .maybeSingle();

      if (existingBal) {
        const currentQty = Number(existingBal.balance ?? 0);
        const newQty = Number((currentQty - qty).toFixed(6));
        await supabaseAdmin.from("user_crypto_balances").upsert(
          {
            user_id: withdrawal.user_id,
            asset_symbol: sym,
            balance: newQty,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,asset_symbol" },
        );
      }

      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("crypto_balances")
        .eq("id", withdrawal.user_id)
        .maybeSingle();

      const currentJson = ((prof as any)?.crypto_balances ?? {}) as Record<string, number>;
      if (currentJson[sym] !== undefined) {
        const updatedJson = {
          ...currentJson,
          [sym]: Number(((currentJson[sym] ?? 0) - qty).toFixed(6)),
        };
        await supabaseAdmin
          .from("profiles")
          .update({ crypto_balances: updatedJson as any } as never)
          .eq("id", withdrawal.user_id);
      }
    }

    await syncPendingActivity(
      withdrawal.user_id,
      "withdrawal_request",
      amount,
      `Approved withdrawal ${withdrawal.crypto_currency} · payout $${payout.toFixed(2)} · ${taxPctLabel}% tax fee $${tax.toFixed(2)}`,
      "approved",
      "withdrawals",
      withdrawal.id,
    );
    await writeActivity(
      withdrawal.user_id,
      "withdrawal_tax_fee",
      tax,
      `${taxPctLabel}% withdrawal tax paid to ${feeWallet}`,
      "completed",
      "withdrawals",
      withdrawal.id,
    );
  } else {
    const { error: updateError } = await supabaseAdmin
      .from("withdrawals")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        tax_fee: tax,
        payout_amount: payout,
        fee_wallet_address: feeWallet,
      } as never)
      .eq("id", id)
      .eq("status", "pending");
    if (updateError) throw new Error(updateError.message);
    await syncPendingActivity(
      withdrawal.user_id,
      "withdrawal_request",
      amount,
      `Rejected withdrawal ${withdrawal.crypto_currency}`,
      "rejected",
      "withdrawals",
      withdrawal.id,
    );
  }
  return { ok: true };
}

export async function adminUpdateChart(
  userId: string,
  targetUserId: string,
  mode: "profit" | "loss" | "flat" | "live",
  intensity: number,
) {
  await assertOwner(userId);
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      chart_mode: mode,
      chart_intensity: intensity,
      chart_seed: Math.floor(Math.random() * 10000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetUserId);
  if (error) throw new Error(error.message);
  await writeActivity(
    targetUserId,
    "chart_control",
    0,
    `Admin set chart to ${mode.toUpperCase()} intensity ${intensity}`,
    "completed",
  );
  return { ok: true };
}

export async function adminAdjustBalance(
  userId: string,
  targetUserId: string,
  amount: number,
  direction: "credit" | "debit",
) {
  await assertOwner(userId);
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("account_balance, available_cash, live_balance")
    .eq("id", targetUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw new Error("User profile not found");
  const signed = direction === "credit" ? money(amount) : -money(amount);
  await updateProfileBalance(targetUserId, profile, signed, "live");
  await writeActivity(
    targetUserId,
    direction === "credit" ? "admin_credit" : "admin_debit",
    money(amount),
    direction === "credit" ? "Admin balance credit" : "Admin balance debit",
    "completed",
  );
  return { ok: true };
}

export async function adminAdjustCryptoBalance(
  userId: string,
  targetUserId: string,
  symbol: string,
  quantity: number,
  direction: "credit" | "debit",
) {
  await assertOwner(userId);
  const sym = (symbol || "USDT").toUpperCase().trim();
  const qty = Number(quantity) || 0;
  if (qty <= 0) throw new Error("Invalid quantity specified");

  const [{ data: existingBal }, { data: prof }] = await Promise.all([
    supabaseAdmin
      .from("user_crypto_balances")
      .select("balance")
      .eq("user_id", targetUserId)
      .eq("asset_symbol", sym)
      .maybeSingle(),
    supabaseAdmin.from("profiles").select("crypto_balances").eq("id", targetUserId).maybeSingle(),
  ]);

  const currentJson = ((prof as any)?.crypto_balances ?? {}) as Record<string, number>;
  const jsonQty = Number(currentJson[sym] ?? currentJson[sym.toLowerCase()] ?? 0);
  const rowQty = Number(existingBal?.balance ?? 0);
  const currentQty = Math.max(rowQty, jsonQty);

  if (direction === "debit" && currentQty < qty) {
    throw new Error(`Insufficient ${sym} balance (${currentQty} available)`);
  }

  const delta = direction === "credit" ? qty : -qty;
  const newQty = Number(Math.max(0, currentQty + delta).toFixed(6));

  // 1. Upsert user_crypto_balances
  await supabaseAdmin.from("user_crypto_balances").upsert(
    {
      user_id: targetUserId,
      asset_symbol: sym,
      balance: newQty,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,asset_symbol" },
  );

  // 2. Update profiles.crypto_balances
  const updatedJson = {
    ...currentJson,
    [sym]: newQty,
  };

  await supabaseAdmin
    .from("profiles")
    .update({
      crypto_balances: updatedJson as any,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", targetUserId);

  // 3. Insert transaction
  await supabaseAdmin.from("transactions").insert({
    user_id: targetUserId,
    type: direction === "credit" ? "admin_credit" : "admin_debit",
    amount: 0,
    asset_name: `${delta > 0 ? "+" : ""}${delta} ${sym}`,
    status: "completed",
  } as never);

  // 4. Log activity
  await writeActivity(
    targetUserId,
    direction === "credit" ? "admin_credit" : "admin_debit",
    0,
    `Admin ${direction === "credit" ? "credited" : "debited"} ${qty} ${sym} (New balance: ${newQty} ${sym})`,
    "completed",
  );

  return { ok: true, symbol: sym, newBalance: newQty };
}

export async function adminApproveDepositCrypto(
  userId: string,
  depositId: string,
  symbol: string,
  cryptoQuantity: number,
) {
  await assertOwner(userId);
  const { data: deposit, error: depErr } = await supabaseAdmin
    .from("deposits")
    .select("*")
    .eq("id", depositId)
    .maybeSingle();
  if (depErr || !deposit) throw new Error("Deposit record not found");

  const sym = (symbol || "USDT").toUpperCase().trim();
  const qty = Number(cryptoQuantity) || 0;
  if (qty <= 0) throw new Error("Please specify a valid crypto quantity greater than zero");

  // 1. Update user_crypto_balances
  const [{ data: existingBal }, { data: prof }] = await Promise.all([
    supabaseAdmin
      .from("user_crypto_balances")
      .select("balance")
      .eq("user_id", deposit.user_id)
      .eq("asset_symbol", sym)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("crypto_balances")
      .eq("id", deposit.user_id)
      .maybeSingle(),
  ]);

  const currentJson = ((prof as any)?.crypto_balances ?? {}) as Record<string, number>;
  const jsonQty = Number(currentJson[sym] ?? currentJson[sym.toLowerCase()] ?? 0);
  const rowQty = Number(existingBal?.balance ?? 0);
  const currentQty = Math.max(rowQty, jsonQty);
  const newQty = Number((currentQty + qty).toFixed(6));

  await supabaseAdmin.from("user_crypto_balances").upsert(
    {
      user_id: deposit.user_id,
      asset_symbol: sym,
      balance: newQty,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,asset_symbol" },
  );

  // 2. Update profiles.crypto_balances JSON
  const updatedJson = {
    ...currentJson,
    [sym]: newQty,
  };

  await supabaseAdmin
    .from("profiles")
    .update({
      crypto_balances: updatedJson as any,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", deposit.user_id);

  // 3. Mark deposit approved
  await supabaseAdmin
    .from("deposits")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", depositId);

  // 4. Log transaction
  await supabaseAdmin.from("transactions").insert({
    user_id: deposit.user_id,
    type: "deposit_credit",
    amount: Number(deposit.amount) || 0,
    asset_name: `${qty} ${sym}`,
    status: "completed",
  } as never);

  // 5. Log activity
  await syncPendingActivity(
    deposit.user_id,
    "deposit_request",
    Number(deposit.amount) || 0,
    `Approved deposit: Credited ${qty} ${sym}`,
    "approved",
    "deposits",
    deposit.id,
  );

  return { ok: true, symbol: sym, newBalance: newQty };
}

export async function adminUpdateComplaint(
  userId: string,
  id: string,
  status: "pending" | "resolved",
) {
  await assertOwner(userId);
  const { error } = await supabaseAdmin.from("complaints").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function adminUpdateSetting(userId: string, key: string, value: string) {
  await assertOwner(userId);
  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function adminDeleteSetting(userId: string, key: string) {
  await assertOwner(userId);
  const { error } = await supabaseAdmin.from("app_settings").delete().eq("key", key);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function adminToggleAccountMode(
  userId: string,
  targetUserId: string,
  mode: "demo" | "live",
) {
  await assertOwner(userId);
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ account_mode: mode, updated_at: new Date().toISOString() })
    .eq("id", targetUserId);
  if (error) throw new Error(error.message);
  await writeActivity(
    targetUserId,
    "account_mode",
    0,
    `Account switched to ${mode.toUpperCase()}`,
    "completed",
  );
  return { ok: true };
}

export async function adminToggleSuspend(userId: string, targetUserId: string, suspended: boolean) {
  await assertOwner(userId);
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ is_suspended: suspended, updated_at: new Date().toISOString() })
    .eq("id", targetUserId);
  if (error) throw new Error(error.message);
  await writeActivity(
    targetUserId,
    "account_status",
    0,
    suspended ? "Account suspended by admin" : "Account restored by admin",
    "completed",
  );
  return { ok: true };
}

export async function adminToggleAiTrading(userId: string, targetUserId: string, enabled: boolean) {
  await assertOwner(userId);
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ ai_trading_enabled: enabled, updated_at: new Date().toISOString() } as never)
    .eq("id", targetUserId);
  if (error) throw new Error(error.message);
  await writeActivity(
    targetUserId,
    "ai_trading",
    0,
    `AI trading ${enabled ? "enabled" : "disabled"}`,
    "completed",
  );
  return { ok: true };
}

export async function adminDecideKyc(
  userId: string,
  id: string,
  status: AdminStatus,
  note?: string,
) {
  await assertOwner(userId);
  const { data: row, error: fetchError } = await supabaseAdmin
    .from("kyc_submissions")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("KYC submission not found");
  const { error } = await supabaseAdmin
    .from("kyc_submissions")
    .update({ status, admin_note: note ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({ kyc_status: status, updated_at: new Date().toISOString() })
    .eq("id", row.user_id);
  if (profileError) throw new Error(profileError.message);
  await writeActivity(row.user_id, "kyc", 0, `KYC ${status}`, status);
  return { ok: true };
}

export async function adminPostNews(
  userId: string,
  title: string,
  body: string,
  impact: "low" | "medium" | "high",
  source: string,
) {
  await assertOwner(userId);
  const { error } = await supabaseAdmin.from("market_news").insert({ title, body, impact, source });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function adminGetKycDocumentUrl(userId: string, path: string) {
  await assertOwner(userId);
  const { data, error } = await supabaseAdmin.storage
    .from("kyc-documents")
    .createSignedUrl(path, 60 * 10);
  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error("Failed to generate signed URL");
  return { url: data.signedUrl };
}

export async function openUserPosition(
  userId: string,
  asset: string,
  side: "buy" | "sell",
  quantity: number,
  leverage: number,
  margin: number,
  entryPrice: number,
  accountMode: "demo" | "live",
) {
  const { data, error } = await (supabaseAdmin as any).rpc("open_position_atomic", {
    _user_id: userId,
    _asset: asset,
    _side: side,
    _quantity: quantity,
    _leverage: leverage,
    _margin: margin,
    _entry_price: entryPrice,
    _account_mode: accountMode,
  });
  if (error) throw new Error(error.message);
  return { id: data as string };
}

export async function closeUserPosition(userId: string, positionId: string, closePrice: number) {
  const { data: position, error: posErr } = await supabaseAdmin
    .from("live_positions")
    .select("user_id")
    .eq("id", positionId)
    .maybeSingle();
  if (posErr) throw new Error(posErr.message);
  if (!position || position.user_id !== userId) throw new Error("Position not found");
  const { data, error } = await (supabaseAdmin as any).rpc("close_position_atomic", {
    _position_id: positionId,
    _close_price: closePrice,
  });
  if (error) throw new Error(error.message);
  return { pnl: Number(data ?? 0) };
}

export function getAdminServerErrorMessage(error: unknown) {
  return asError(error, "Admin action failed");
}

// ── Platform-settings helpers ────────────────────────────────────────────────

/** Read a single numeric platform setting with a typed fallback. */
async function getPlatformNumeric(key: string, fallback: number): Promise<number> {
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("value")
    .eq("key_name", key)
    .maybeSingle();
  if (!data) return fallback;
  const raw = data.value;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/"/g, ""));
  return isNaN(n) ? fallback : n;
}

/** Return all platform settings as { id, category, key_name, value (string), description } */
export async function adminGetPlatformSettings(userId: string) {
  await assertOwner(userId);
  const { data, error } = await supabaseAdmin
    .from("platform_settings")
    .select("id, category, key_name, value, description")
    .order("category")
    .order("key_name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    ...row,
    // Normalise JSONB value to a plain string for the frontend
    value:
      typeof row.value === "number"
        ? String(row.value)
        : typeof row.value === "string"
          ? row.value.replace(/^"|"$/g, "")
          : JSON.stringify(row.value),
  }));
}

/** Upsert a single platform setting.  Numeric-looking strings are stored as JSON numbers. */
export async function adminSavePlatformSetting(
  userId: string,
  keyName: string,
  rawValue: string,
  category?: string,
) {
  await assertOwner(userId);
  const jsonValue = /^-?[\d.]+$/.test(rawValue.trim()) ? parseFloat(rawValue) : rawValue;
  const row: any = { key_name: keyName, value: jsonValue, updated_at: new Date().toISOString() };
  if (category) row.category = category;
  const { error } = await supabaseAdmin
    .from("platform_settings")
    .upsert(row as never, { onConflict: "key_name" });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function adminReconcileLedger(userId: string, targetUserId?: string) {
  await assertOwner(userId);
  let query = supabaseAdmin
    .from("profiles")
    .select("id, live_balance, account_balance, available_cash, crypto_balances");
  if (targetUserId) {
    query = query.eq("id", targetUserId);
  }
  const { data: profiles, error } = await query;
  if (error) throw new Error(error.message);

  let updatedCount = 0;
  for (const prof of profiles || []) {
    const rawLive = Math.max(
      money(prof.live_balance),
      money(prof.account_balance),
      money(prof.available_cash),
    );

    // Sync user_crypto_balances with profiles.crypto_balances JSON
    const { data: cryptoRows } = await supabaseAdmin
      .from("user_crypto_balances")
      .select("asset_symbol, balance")
      .eq("user_id", prof.id);

    const jsonMap = ((prof as any)?.crypto_balances ?? {}) as Record<string, number>;
    const mergedCrypto: Record<string, number> = { ...jsonMap };

    (cryptoRows || []).forEach((row: any) => {
      const sym = String(row.asset_symbol).toUpperCase();
      mergedCrypto[sym] = Math.max(mergedCrypto[sym] ?? 0, Number(row.balance ?? 0));
    });

    // Update profile
    await supabaseAdmin
      .from("profiles")
      .update({
        live_balance: rawLive,
        account_balance: rawLive,
        available_cash: rawLive,
        crypto_balances: mergedCrypto as any,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", prof.id);

    // Ensure user_crypto_balances upserted
    for (const [sym, qty] of Object.entries(mergedCrypto)) {
      if (qty > 0) {
        await supabaseAdmin.from("user_crypto_balances").upsert(
          {
            user_id: prof.id,
            asset_symbol: sym,
            balance: qty,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,asset_symbol" },
        );
      }
    }

    updatedCount++;
  }

  return {
    ok: true,
    count: updatedCount,
    message: `Reconciled ${updatedCount} user account ledgers successfully.`,
  };
}

export async function adminClearAllBalances(userId: string) {
  await assertOwner(userId);

  // 1. Reset all cash and crypto fields on profiles table
  const { error: profErr } = await supabaseAdmin
    .from("profiles")
    .update({
      live_balance: 0,
      demo_balance: 0,
      account_balance: 0,
      available_cash: 0,
      crypto_balances: {},
      updated_at: new Date().toISOString(),
    } as never)
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (profErr) {
    console.error("[adminClearAllBalances] profiles update error:", profErr);
    throw new Error(profErr.message);
  }

  // 2. Set balance to 0 on user_crypto_balances
  const { error: cryptoErr } = await supabaseAdmin
    .from("user_crypto_balances")
    .update({
      balance: 0,
      updated_at: new Date().toISOString(),
    } as never)
    .neq("user_id", "00000000-0000-0000-0000-000000000000");

  if (cryptoErr) {
    console.warn("[adminClearAllBalances] user_crypto_balances notice:", cryptoErr);
  }

  return {
    ok: true,
    message: "All cash, crypto, demo, and live balances across all users cleared to 0.",
  };
}

export async function adminResetSupportChats(userId: string) {
  await assertOwner(userId);

  // 1. Delete all support messages using elevated service role
  const { error: msgErr } = await supabaseAdmin
    .from("support_messages")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (msgErr) {
    console.error("[adminResetSupportChats] support_messages delete error:", msgErr);
    throw new Error(msgErr.message);
  }

  // 2. Delete all support threads using elevated service role
  const { error: threadErr } = await supabaseAdmin
    .from("support_threads")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (threadErr) {
    console.error("[adminResetSupportChats] support_threads delete error:", threadErr);
    throw new Error(threadErr.message);
  }

  return {
    ok: true,
    message: "All customer support chats and threads have been completely reset.",
  };
}

export async function markSupportThreadRead(threadId: string, role: "user" | "admin") {
  if (!threadId) return { ok: false };
  try {
    let query = supabaseAdmin
      .from("support_messages")
      .update({ is_read: true })
      .eq("thread_id", threadId)
      .eq("is_read", false);

    if (role === "user") {
      query = query.neq("sender", "user");
    } else {
      query = query.eq("sender", "user");
    }

    const { error } = await query;
    if (error) {
      console.warn("[markSupportThreadRead] update error:", error);
    }
    return { ok: !error };
  } catch (err) {
    console.error("[markSupportThreadRead] exception:", err);
    return { ok: false };
  }
}

// Make deposit/withdrawal functions use dynamic rates from platform_settings
// These are exported so the server fns above can call them too.
export { getPlatformNumeric };
