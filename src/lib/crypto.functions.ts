import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  computeEnrichedCryptoAssets,
  CRYPTO_FALLBACK_PRICES,
  resolveLiveCashBalance,
  resolveDemoBalance,
} from "./crypto-assets";

export interface UserPortfolioResult {
  userId: string;
  accountMode: "demo" | "live";
  cashBalance: number;
  demoBalance: number;
  cryptoUsdBalance: number;
  totalLiveBalance: number;
  cryptoBalances: Record<string, number>;
  cryptoRows: { asset_symbol: string; balance: number }[];
  isSuspended: boolean;
}

export const getUserAccountPortfolio = createServerFn({ method: "POST" })
  .validator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<UserPortfolioResult> => {
    const { userId } = data;
    if (!userId) {
      return {
        userId: "",
        accountMode: "demo",
        cashBalance: 0,
        demoBalance: 10000,
        cryptoUsdBalance: 0,
        totalLiveBalance: 0,
        cryptoBalances: {},
        cryptoRows: [],
        isSuspended: false,
      };
    }

    try {
      const [profRes, cryptoRowsRes] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select(
            "id, live_balance, available_cash, account_balance, demo_balance, account_mode, crypto_balances, is_suspended",
          )
          .eq("id", userId)
          .maybeSingle(),
        supabaseAdmin
          .from("user_crypto_balances")
          .select("asset_symbol, balance")
          .eq("user_id", userId),
      ]);

      const profile = profRes.data;
      const cryptoRows = cryptoRowsRes.data ?? [];

      const cashBalance = resolveLiveCashBalance(profile);
      const demoBalance = resolveDemoBalance(profile);

      // Extract JSON crypto balances
      const jsonCrypto = (profile?.crypto_balances ?? {}) as Record<string, number>;

      // Compute enriched crypto asset list
      const { totalCryptoUsd, assetMap } = computeEnrichedCryptoAssets(cryptoRows, jsonCrypto, {});

      // Determine proper mode: if user has real live funds and mode is demo, default to live
      let accountMode = ((profile?.account_mode as "demo" | "live") || "live") as "demo" | "live";
      if (!profile?.account_mode) {
        accountMode = cashBalance > 0 || totalCryptoUsd > 0 ? "live" : "demo";
      }

      // Auto-heal profiles table if columns are desynced
      if (
        profile &&
        (profile.live_balance !== cashBalance ||
          profile.available_cash !== cashBalance ||
          profile.account_balance !== cashBalance)
      ) {
        await supabaseAdmin
          .from("profiles")
          .update({
            live_balance: cashBalance,
            available_cash: cashBalance,
            account_balance: cashBalance,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", userId);
      }

      const totalLiveBalance = Number((cashBalance + totalCryptoUsd).toFixed(2));

      const cryptoBalancesMap: Record<string, number> = {};
      assetMap.forEach((asset, sym) => {
        if (asset.qty > 0) {
          cryptoBalancesMap[sym] = asset.qty;
        }
      });

      return {
        userId,
        accountMode,
        cashBalance,
        demoBalance,
        cryptoUsdBalance: totalCryptoUsd,
        totalLiveBalance,
        cryptoBalances: cryptoBalancesMap,
        cryptoRows,
        isSuspended: Boolean(profile?.is_suspended),
      };
    } catch (err) {
      console.error("[getUserAccountPortfolio] Error:", err);
      return {
        userId,
        accountMode: "live",
        cashBalance: 0,
        demoBalance: 10000,
        cryptoUsdBalance: 0,
        totalLiveBalance: 0,
        cryptoBalances: {},
        cryptoRows: [],
        isSuspended: false,
      };
    }
  });

// In-memory cache for server proxy prices (4-second TTL)
const serverPricesCache: { [key: string]: { timestamp: number; data: any[] } } = {};

export const proxyCryptoPrices = createServerFn({ method: "GET" })
  .validator((symbols: string[]) => symbols)
  .handler(async ({ data: symbols }) => {
    const cleanSymbols = Array.from(
      new Set(
        symbols.map((s) => {
          const u = s.toUpperCase().trim();
          if (u === "USDT") return "USDTUSDT";
          return u.endsWith("USDT") ? u : `${u}USDT`;
        }),
      ),
    );

    const binanceSymbols = cleanSymbols.filter((s) => s !== "USDTUSDT");
    if (binanceSymbols.length === 0) return [];

    const cacheKey = binanceSymbols.slice().sort().join(",");
    const now = Date.now();
    if (serverPricesCache[cacheKey] && now - serverPricesCache[cacheKey].timestamp < 4000) {
      return serverPricesCache[cacheKey].data;
    }

    const results: any[] = [];

    // Try Binance Primary Endpoint
    try {
      const binanceUrl = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(
        JSON.stringify(binanceSymbols),
      )}`;

      const res = await fetch(binanceUrl, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped = data.map((d: any) => ({
            symbol: d.symbol,
            price: Number(d.lastPrice),
            change: Number(d.priceChangePercent),
            high: Number(d.highPrice),
            low: Number(d.lowPrice),
            volume: Number(d.volume),
          }));
          serverPricesCache[cacheKey] = { timestamp: now, data: mapped };
          return mapped;
        }
      }
    } catch (e) {
      // Ignore
    }

    // Fallback Gateway 1: CryptoCompare
    try {
      const fsyms = Array.from(new Set(cleanSymbols.map((s) => s.replace(/USDT$/, "")))).join(",");
      const ccUrl = `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${fsyms}&tsyms=USD`;
      const ccRes = await fetch(ccUrl, { signal: AbortSignal.timeout(5000) });
      if (ccRes.ok) {
        const ccData = await ccRes.json();
        if (ccData && ccData.RAW) {
          cleanSymbols.forEach((sym) => {
            const base = sym.replace(/USDT$/, "");
            const item = ccData.RAW[base]?.USD;
            if (item && item.PRICE) {
              results.push({
                symbol: sym,
                price: Number(item.PRICE),
                change: Number(item.CHANGEPCT24HOUR || 0),
                high: Number(item.HIGH24HOUR || 0),
                low: Number(item.LOW24HOUR || 0),
                volume: Number(item.VOLUME24HOUR || 0),
              });
            }
          });
          if (results.length > 0) return results;
        }
      }
    } catch (e) {
      // Ignore
    }

    // Fallback Gateway 2: Coinbase
    try {
      const cbRes = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=USD", {
        signal: AbortSignal.timeout(5000),
      });
      if (cbRes.ok) {
        const cbData = await cbRes.json();
        const rates = cbData?.data?.rates || {};
        cleanSymbols.forEach((sym) => {
          const base = sym.replace(/USDT$/, "");
          if (rates[base]) {
            const rate = Number(rates[base]);
            if (rate > 0) {
              const usdPrice = Number((1 / rate).toFixed(base === "BTC" ? 2 : 4));
              results.push({
                symbol: sym,
                price: usdPrice,
                change: 0,
                high: 0,
                low: 0,
                volume: 0,
              });
            }
          }
        });
        if (results.length > 0) return results;
      }
    } catch (e) {
      // Ignore
    }

    return results;
  });
