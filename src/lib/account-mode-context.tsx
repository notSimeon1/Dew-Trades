import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useBinancePrices } from "@/hooks/useBinancePrices";
import { toast } from "sonner";
import {
  computeEnrichedCryptoAssets,
  CRYPTO_PRICE_SYMBOLS,
  EnrichedAsset,
} from "@/lib/crypto-assets";

type AccountMode = "demo" | "live";

type AccountModeContextValue = {
  mode: AccountMode;
  balance: number;
  liveBalance: number;
  fiatLiveBalance: number;
  cashBalance: number;
  cryptoBalance: number;
  demoBalance: number;
  cryptoAssets: EnrichedAsset[];
  switchMode: (next: AccountMode) => Promise<void>;
  loading: boolean;
  refreshBalances: () => Promise<void>;
};

const AccountModeContext = createContext<AccountModeContextValue>({
  mode: "demo",
  balance: 0,
  liveBalance: 0,
  fiatLiveBalance: 0,
  cashBalance: 0,
  cryptoBalance: 0,
  demoBalance: 0,
  cryptoAssets: [],
  switchMode: async () => {},
  loading: true,
  refreshBalances: async () => {},
});

export function AccountModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [rawProfile, setRawProfile] = useState<any>(null);
  const [rawCryptoRows, setRawCryptoRows] = useState<{ asset_symbol: string; balance: number }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  const { tickers } = useBinancePrices(CRYPTO_PRICE_SYMBOLS);

  // Fetch user database balances strictly when DB changes, NOT on every price tick
  const fetchDbBalances = useCallback(async () => {
    if (!user) {
      setRawProfile(null);
      setRawCryptoRows([]);
      setLoading(false);
      return;
    }

    try {
      const [profRes, cryptoRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, account_mode, live_balance, account_balance, available_cash, demo_balance, crypto_balances",
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("user_crypto_balances")
          .select("asset_symbol, balance")
          .eq("user_id", user.id),
      ]);

      setRawProfile(profRes.data ?? null);
      setRawCryptoRows((cryptoRes.data as any[]) ?? []);
    } catch (err) {
      console.error("[AccountModeProvider] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDbBalances();
  }, [fetchDbBalances]);

  // Persistent Realtime subscription for profiles & user_crypto_balances (stable, never recreated on price ticks)
  useEffect(() => {
    if (!user?.id) return;

    const channelName = `acc_mode_${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => {
          fetchDbBalances();
          qc.invalidateQueries({ queryKey: ["profile", user.id] });
          qc.invalidateQueries({ queryKey: ["profile"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_crypto_balances",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchDbBalances();
          qc.invalidateQueries({ queryKey: ["my_crypto_wallets", user.id] });
          qc.invalidateQueries({ queryKey: ["my_crypto_wallets"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchDbBalances, qc]);

  // Real-time valuation derived via useMemo from raw rows & throttled prices
  const { cryptoAssets, cryptoBalance } = useMemo(() => {
    const { assets, totalCryptoUsd } = computeEnrichedCryptoAssets(
      rawCryptoRows,
      (rawProfile?.crypto_balances ?? {}) as Record<string, number>,
      tickers,
    );
    return { cryptoAssets: assets, cryptoBalance: totalCryptoUsd };
  }, [rawCryptoRows, rawProfile?.crypto_balances, tickers]);

  const fiatLiveBalance = Number(
    rawProfile?.available_cash ?? rawProfile?.live_balance ?? rawProfile?.account_balance ?? 0,
  );
  const demoBalance = Number(rawProfile?.demo_balance ?? 10000);
  const liveBalance = Number((fiatLiveBalance + cryptoBalance).toFixed(2));

  const mode: AccountMode = useMemo(() => {
    if (rawProfile?.account_mode === "live" || rawProfile?.account_mode === "demo") {
      return rawProfile.account_mode;
    }
    return fiatLiveBalance > 0 || cryptoBalance > 0 ? "live" : "demo";
  }, [rawProfile?.account_mode, fiatLiveBalance, cryptoBalance]);

  const balance = mode === "live" ? liveBalance : demoBalance;

  const switchMode = useCallback(
    async (next: AccountMode) => {
      if (!user?.id || next === mode) return;
      const { error } = await supabase
        .from("profiles")
        .update({ account_mode: next, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      setRawProfile((prev: any) => (prev ? { ...prev, account_mode: next } : prev));
      toast.success(`Switched to ${next.toUpperCase()} account`);
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
      qc.invalidateQueries({ queryKey: ["my_crypto_wallets"] });
    },
    [user?.id, mode, qc],
  );

  const contextValue = useMemo(
    () => ({
      mode,
      balance,
      liveBalance,
      fiatLiveBalance,
      cashBalance: fiatLiveBalance,
      cryptoBalance,
      demoBalance,
      cryptoAssets,
      switchMode,
      loading,
      refreshBalances: fetchDbBalances,
    }),
    [
      mode,
      balance,
      liveBalance,
      fiatLiveBalance,
      cryptoBalance,
      demoBalance,
      cryptoAssets,
      switchMode,
      loading,
      fetchDbBalances,
    ],
  );

  return <AccountModeContext.Provider value={contextValue}>{children}</AccountModeContext.Provider>;
}

export function useAccountMode() {
  return useContext(AccountModeContext);
}
