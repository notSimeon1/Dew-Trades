import { useEffect, useRef, useState } from "react";
import { proxyCryptoPrices } from "../lib/crypto.functions";

export type Ticker = {
  symbol: string;
  price: number;
  change: number;
  high: number;
  low: number;
  volume: number;
  direction: "up" | "down" | "flat";
};

const DEFAULT_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "MNTUSDT",
  "DOGEUSDT",
];

const FALLBACK_PRICES: Record<string, { price: number; change: number }> = {
  BTCUSDT: { price: 64300, change: 0.75 },
  ETHUSDT: { price: 1875, change: 0.35 },
  BNBUSDT: { price: 594, change: 0.32 },
  SOLUSDT: { price: 74.2, change: 0.22 },
  XRPUSDT: { price: 1.08, change: -0.47 },
  ADAUSDT: { price: 0.19, change: -1.49 },
  MNTUSDT: { price: 0.78, change: 0.2 },
  DOGEUSDT: { price: 0.07, change: -0.04 },
  USDTUSDT: { price: 1.0, change: 0.0 },
};

export function useBinancePrices(symbols: string[] = DEFAULT_SYMBOLS) {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const prevRef = useRef<Record<string, number>>({});
  const symsKey = symbols.join(",");

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    let ws: WebSocket | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let flushInterval: NodeJS.Timeout | null = null;
    const pendingBatch: Record<string, Ticker> = {};

    // Normalizing requested symbols
    const cleanSymbols = Array.from(
      new Set(
        symbols.map((s) => {
          const u = s.toUpperCase().trim();
          if (u === "USDT") return "USDTUSDT";
          return u.endsWith("USDT") ? u : `${u}USDT`;
        }),
      ),
    );

    // Flush batch to state at controlled intervals (~300ms) for high performance & butter-smooth 60fps
    flushInterval = setInterval(() => {
      if (cancelled) return;
      const keys = Object.keys(pendingBatch);
      if (keys.length > 0) {
        setTickers((prev) => {
          const next = { ...prev };
          for (const k of keys) {
            next[k] = pendingBatch[k];
            delete pendingBatch[k];
          }
          return next;
        });
      }
    }, 300);

    const queueTicker = (
      sym: string,
      price: number,
      change: number = 0,
      high: number = 0,
      low: number = 0,
      volume: number = 0,
      immediate = false,
    ) => {
      if (cancelled || !price || isNaN(price)) return;
      const baseSym = sym.replace(/USDT$/, "");
      const previous = prevRef.current[sym] ?? price;
      const direction: Ticker["direction"] =
        price > previous ? "up" : price < previous ? "down" : "flat";
      prevRef.current[sym] = price;
      prevRef.current[baseSym] = price;

      const item: Ticker = {
        symbol: sym,
        price,
        change,
        high,
        low,
        volume,
        direction,
      };

      if (immediate) {
        setTickers((prev) => ({
          ...prev,
          [sym]: item,
          [baseSym]: item,
        }));
      } else {
        pendingBatch[sym] = item;
        pendingBatch[baseSym] = item;
      }
    };

    // 1. Fetch via Server-Side Proxy
    const fetchRestPrices = async () => {
      if (document.hidden) return;
      // Prepare USDT default
      queueTicker("USDTUSDT", 1.0, 0, 1.0, 1.0, 1000000, true);

      const binanceSymbols = cleanSymbols.filter((s) => s !== "USDTUSDT");
      if (binanceSymbols.length === 0) return;

      try {
        const results = await proxyCryptoPrices({ data: binanceSymbols });
        if (results && results.length > 0) {
          results.forEach((r) => {
            queueTicker(r.symbol, r.price, r.change, r.high, r.low, r.volume, true);
          });
          setStatus("live");
          return;
        }
      } catch (e) {
        // Fallback to local defaults on server error
      }

      // Ultimate local fallback prices
      if (!cancelled) {
        setStatus("error");
        cleanSymbols.forEach((sym) => {
          const fb = FALLBACK_PRICES[sym] || FALLBACK_PRICES["BTCUSDT"];
          if (fb) queueTicker(sym, fb.price, fb.change, 0, 0, 0, true);
        });
      }
    };

    // 2. Connect Binance Live Multi-Stream WebSocket
    const connectWebSocket = () => {
      try {
        const streamNames = cleanSymbols
          .filter((s) => s !== "USDTUSDT" && s !== "MNTUSDT")
          .map((s) => `${s.toLowerCase()}@ticker`);

        if (streamNames.length === 0) return;

        const wsUrl = `wss://stream.binance.com:9443/ws/${streamNames.join("/")}`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (!cancelled) setStatus("live");
        };

        ws.onmessage = (event) => {
          if (cancelled) return;
          try {
            const data = JSON.parse(event.data);
            if (data && data.s && data.c) {
              queueTicker(
                data.s,
                Number(data.c),
                Number(data.P || 0),
                Number(data.h || 0),
                Number(data.l || 0),
                Number(data.v || 0),
                false,
              );
            }
          } catch (e) {
            // Ignore parse errors
          }
        };

        ws.onerror = () => {
          // Fail gracefully to REST polling
        };

        ws.onclose = () => {
          // Reconnect or fall back
        };
      } catch (e) {
        // Fall back
      }
    };

    // Execute immediately
    fetchRestPrices();
    connectWebSocket();

    // Backup polling every 5 seconds (slightly slower polling via proxy)
    pollInterval = setInterval(fetchRestPrices, 5000);

    const handleVisibility = () => {
      if (!document.hidden) fetchRestPrices();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      if (flushInterval) clearInterval(flushInterval);
      if (ws) {
        ws.close();
        ws = null;
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symsKey]); // Use symsKey to avoid exhaustive deps warning and object identity changes

  return { tickers, status };
}

const BINANCE_KLINE_MAP: Record<string, string> = {
  "BTC/USD": "BTCUSDT",
  "ETH/USD": "ETHUSDT",
  "SOL/USD": "SOLUSDT",
  "BNB/USD": "BNBUSDT",
  "XRP/USD": "XRPUSDT",
  "ADA/USD": "ADAUSDT",
  "DOGE/USD": "DOGEUSDT",
  "MNT/USD": "MNTUSDT",
  BTCUSDT: "BTCUSDT",
  ETHUSDT: "ETHUSDT",
  SOLUSDT: "SOLUSDT",
  BNBUSDT: "BNBUSDT",
  XRPUSDT: "XRPUSDT",
  ADAUSDT: "ADAUSDT",
  DOGEUSDT: "DOGEUSDT",
  MNTUSDT: "MNTUSDT",
};

export async function fetchBinanceLiveCandles(
  sym: string,
  count = 120,
): Promise<import("../components/TradingChart").Candle[] | null> {
  const bSym =
    BINANCE_KLINE_MAP[sym] || (sym.includes("/") ? `${sym.replace("/", "")}USDT` : `${sym}USDT`);
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${bSym}&interval=1m&limit=${count}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) throw new Error("binance_fail");
    const data = await res.json();
    return (data as any[][]).map((k) => ({
      time: Math.floor(k[0] / 1000) as import("lightweight-charts").Time,
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
    }));
  } catch {
    try {
      const res = await fetch(
        `https://api.bybit.com/v5/market/kline?category=spot&symbol=${bSym}&interval=1&limit=${count}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!res.ok) throw new Error("bybit_fail");
      const j = await res.json();
      const list: any[][] = j?.result?.list ?? [];
      return list.reverse().map((k) => ({
        time: Math.floor(Number(k[0]) / 1000) as import("lightweight-charts").Time,
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
      }));
    } catch {
      return null;
    }
  }
}
