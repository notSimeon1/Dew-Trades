import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useBinancePrices } from "@/hooks/useBinancePrices";

export interface CryptoAssetMeta {
  symbol: string;
  name: string;
  icon: string;
  decimals: number;
}

export const SUPPORTED_CRYPTO_ASSETS: CryptoAssetMeta[] = [
  { symbol: "BTC", name: "Bitcoin", icon: "₿", decimals: 6 },
  { symbol: "ETH", name: "Ethereum", icon: "Ξ", decimals: 5 },
  { symbol: "BNB", name: "BNB", icon: "B", decimals: 4 },
  { symbol: "SOL", name: "Solana", icon: "◎", decimals: 4 },
  { symbol: "XRP", name: "XRP", icon: "✕", decimals: 2 },
  { symbol: "ADA", name: "Cardano", icon: "₳", decimals: 2 },
  { symbol: "DOGE", name: "Dogecoin", icon: "Ð", decimals: 2 },
  { symbol: "USDT", name: "Tether", icon: "₮", decimals: 2 },
];

export const CRYPTO_PRICE_SYMBOLS = SUPPORTED_CRYPTO_ASSETS.filter((s) => s.symbol !== "USDT").map(
  (s) => `${s.symbol}USDT`,
);

export const CRYPTO_FALLBACK_PRICES: Record<string, number> = {
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

export interface EnrichedAsset extends CryptoAssetMeta {
  qty: number;
  price: number;
  usdValue: number;
}

export function resolveLiveCashBalance(profile: any): number {
  if (!profile) return 0;
  return Number(profile.available_cash ?? profile.live_balance ?? profile.account_balance ?? 0);
}

export function resolveDemoBalance(profile: any): number {
  if (!profile) return 10000;
  return Number(profile.demo_balance ?? 10000);
}

/**
 * Pure function to compute consistent enriched crypto assets from
 * database rows (user_crypto_balances) + profile JSON (crypto_balances) + live ticker prices.
 */
export function computeEnrichedCryptoAssets(
  cryptoRows: any[] | null | undefined,
  jsonBalances: Record<string, number> | null | undefined,
  tickers: Record<string, { price: number }> = {},
): {
  assets: EnrichedAsset[];
  totalCryptoUsd: number;
  assetMap: Map<string, EnrichedAsset>;
} {
  const rowMap = new Map<string, number>();
  (cryptoRows ?? []).forEach((r: any) => {
    const sym = String(r.asset_symbol || r.symbol || "")
      .toUpperCase()
      .trim();
    if (sym) {
      rowMap.set(sym, Number(r.balance ?? r.amount ?? 0));
    }
  });

  // Normalize jsonBalances to uppercase keys
  const normJson: Record<string, number> = {};
  if (jsonBalances && typeof jsonBalances === "object") {
    Object.entries(jsonBalances).forEach(([k, v]) => {
      const sym = String(k).toUpperCase().trim();
      normJson[sym] = Number(v ?? 0);
    });
  }

  // Collect all unique uppercase symbols (standard supported + any custom in DB)
  const allSymbols = new Set<string>(SUPPORTED_CRYPTO_ASSETS.map((a) => a.symbol));
  rowMap.forEach((_, k) => allSymbols.add(k));
  Object.keys(normJson).forEach((k) => allSymbols.add(k));

  const assets: EnrichedAsset[] = [];
  const assetMap = new Map<string, EnrichedAsset>();
  let totalCryptoUsd = 0;

  // Process standard supported first for consistent UI order, then custom coins
  const orderedSymbols = [
    ...SUPPORTED_CRYPTO_ASSETS.map((a) => a.symbol),
    ...Array.from(allSymbols).filter((s) => !SUPPORTED_CRYPTO_ASSETS.some((a) => a.symbol === s)),
  ];

  orderedSymbols.forEach((sym) => {
    const standard = SUPPORTED_CRYPTO_ASSETS.find((a) => a.symbol === sym);
    const meta: CryptoAssetMeta = standard || {
      symbol: sym,
      name: sym,
      icon: "🪙",
      decimals: 4,
    };

    const rowVal = rowMap.get(sym) ?? 0;
    const jsonVal = normJson[sym] ?? 0;
    const qty = Math.max(rowVal, jsonVal);

    let price = 1.0;
    if (sym === "USDT" || sym === "USDC") {
      price = 1.0;
    } else {
      const tickerPrice = tickers[`${sym}USDT`]?.price;
      if (tickerPrice && tickerPrice > 0) {
        price = tickerPrice;
      } else if (CRYPTO_FALLBACK_PRICES[sym]) {
        price = CRYPTO_FALLBACK_PRICES[sym];
      } else {
        price = 1.0;
      }
    }

    const usdValue = Number((qty * price).toFixed(4));
    totalCryptoUsd += usdValue;

    const enriched: EnrichedAsset = {
      ...meta,
      qty,
      price,
      usdValue,
    };

    assets.push(enriched);
    assetMap.set(sym, enriched);
  });

  return {
    assets,
    totalCryptoUsd: Number(totalCryptoUsd.toFixed(2)),
    assetMap,
  };
}

/**
 * Shared React hook for reactive crypto balances across any screen (Assets, Dashboard, Withdraw, Convert, etc.)
 */
export function useCryptoAssets() {
  const { user } = useAuth();
  const { tickers, status: binanceStatus } = useBinancePrices(CRYPTO_PRICE_SYMBOLS);

  const {
    data: wallets,
    isLoading: walletsLoading,
    refetch: refetchWallets,
  } = useQuery({
    queryKey: ["my_crypto_wallets", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("user_crypto_balances")
        .select("*")
        .eq("user_id", user.id);
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const {
    data: profile,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, live_balance, available_cash, account_balance, demo_balance, account_mode, crypto_balances, is_suspended",
        )
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const mode = (profile as any)?.account_mode as "demo" | "live" | undefined;
  const fiatBalance =
    mode === "demo"
      ? Number((profile as any)?.demo_balance ?? 10000)
      : Number(
          (profile as any)?.available_cash ??
            (profile as any)?.live_balance ??
            (profile as any)?.account_balance ??
            0,
        );

  const { assets, totalCryptoUsd, assetMap } = useMemo(() => {
    return computeEnrichedCryptoAssets(wallets, (profile as any)?.crypto_balances, tickers);
  }, [wallets, profile, tickers]);

  const totalValue = Number((fiatBalance + (mode === "demo" ? 0 : totalCryptoUsd)).toFixed(2));

  return {
    assets,
    totalCryptoUsd,
    assetMap,
    fiatBalance,
    totalValue,
    mode: mode ?? "demo",
    wallets,
    profile,
    tickers,
    binanceStatus,
    isLoading: walletsLoading || profileLoading,
    refetch: async () => {
      await Promise.all([refetchWallets(), refetchProfile()]);
    },
  };
}
