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
  const [mode, setMode] = useState<AccountMode>("demo");
  const [fiatLiveBalance, setFiatLiveBalance] = useState(0);
  const [cryptoBalance, setCryptoBalance] = useState(0);
  const [liveBalance, setLiveBalance] = useState(0);
  const [demoBalance, setDemoBalance] = useState(10000);
  const [cryptoAssets, setCryptoAssets] = useState<EnrichedAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const { tickers } = useBinancePrices(CRYPTO_PRICE_SYMBOLS);

  // Fetch user balances (fiat + crypto assets directly matching Assets ledger)
  const fetchAllBalances = useCallback(async () => {
    if (!user) {
      setMode("demo");
      setFiatLiveBalance(0);
      setCryptoBalance(0);
      setLiveBalance(0);
      setDemoBalance(10000);
      setCryptoAssets([]);
      setLoading(false);
      return;
    }

    try {
      const [profRes, cryptoRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "account_mode, live_balance, account_balance, available_cash, demo_balance, crypto_balances",
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("user_crypto_balances")
          .select("asset_symbol, balance")
          .eq("user_id", user.id),
      ]);

      const prof = profRes.data;
      const cryptoRows = cryptoRes.data;

      const fiatLive = Number(
        prof?.available_cash ?? prof?.live_balance ?? prof?.account_balance ?? 0,
      );
      const demo = Number(prof?.demo_balance ?? 10000);

      // Compute identical crypto valuation as Assets page using unified helper
      const { assets, totalCryptoUsd } = computeEnrichedCryptoAssets(
        cryptoRows,
        (prof?.crypto_balances ?? {}) as Record<string, number>,
        tickers,
      );

      let m = (prof?.account_mode as AccountMode) ?? "demo";
      if (!prof?.account_mode || (m === "demo" && (fiatLive > 0 || totalCryptoUsd > 0))) {
        m = fiatLive > 0 || totalCryptoUsd > 0 ? "live" : "demo";
      }

      const totalLive = Number((fiatLive + totalCryptoUsd).toFixed(2));

      setMode(m);
      setFiatLiveBalance(Number(fiatLive.toFixed(2)));
      setCryptoBalance(totalCryptoUsd);
      setCryptoAssets(assets);
      setLiveBalance(totalLive);
      setDemoBalance(demo);
    } catch (err) {
      console.error("[AccountModeProvider] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, tickers]);

  useEffect(() => {
    fetchAllBalances();
  }, [fetchAllBalances]);

  // Realtime subscriptions for profiles & user_crypto_balances
  useEffect(() => {
    if (!user) return;

    const channelName = `acc_mode_${user.id}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => {
          fetchAllBalances();
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
          fetchAllBalances();
          qc.invalidateQueries({ queryKey: ["my_crypto_wallets", user.id] });
          qc.invalidateQueries({ queryKey: ["my_crypto_wallets"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAllBalances, qc]);

  const switchMode = async (next: AccountMode) => {
    if (!user || next === mode) return;
    const { error } = await supabase
      .from("profiles")
      .update({ account_mode: next, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMode(next);
    toast.success(`Switched to ${next.toUpperCase()} account`);
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
    qc.invalidateQueries({ queryKey: ["my_crypto_wallets"] });
  };

  const balance = mode === "live" ? liveBalance : demoBalance;

  return (
    <AccountModeContext.Provider
      value={{
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
        refreshBalances: fetchAllBalances,
      }}
    >
      {children}
    </AccountModeContext.Provider>
  );
}

export function useAccountMode() {
  return useContext(AccountModeContext);
}
