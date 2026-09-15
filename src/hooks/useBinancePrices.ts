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

// -----------------------------------------------------------------------------
// SHARED GLOBAL SINGLETON PRICE STORE
// Consolidates all price streams across the entire app into a single WebSocket
// and a single throttled 800ms state dispatch. Prevents main-thread freezing,
// redundant network queries, and multiple competing WebSockets.
// -----------------------------------------------------------------------------

type SubscriberCallback = () => void;

let globalWs: WebSocket | null = null;
let globalWsConnecting = false;
let globalPollInterval: any = null;
let globalFlushInterval: any = null;
let globalStatus: "connecting" | "live" | "error" = "connecting";
let disconnectTimeout: any = null;

const globalTickers: Record<string, Ticker> = {};
const pendingBatch: Record<string, Ticker> = {};
const prevPriceMap: Record<string, number> = {};
const activeSubscribers = new Set<SubscriberCallback>();
const requestedSymbols = new Set<string>(DEFAULT_SYMBOLS);

// Populate initial baseline fallbacks so UI renders instantly without layout shifts
Object.entries(FALLBACK_PRICES).forEach(([sym, val]) => {
  const baseSym = sym.replace(/USDT$/, "");
  const item: Ticker = {
    symbol: sym,
    price: val.price,
    change: val.change,
    high: val.price * 1.02,
    low: val.price * 0.98,
    volume: 100000,
    direction: "flat",
  };
  globalTickers[sym] = item;
  globalTickers[baseSym] = item;
  prevPriceMap[sym] = val.price;
  prevPriceMap[baseSym] = val.price;
});

function notifySubscribers() {
  activeSubscribers.forEach((cb) => {
    try {
      cb();
    } catch {
      // Ignore errors in unmounted subscribers
    }
  });
}

function queueGlobalTicker(
  sym: string,
  price: number,
  change = 0,
  high = 0,
  low = 0,
  volume = 0,
  immediate = false,
) {
  if (!price || isNaN(price)) return;
  const baseSym = sym.replace(/USDT$/, "");
  const prev = prevPriceMap[sym] ?? price;
  const direction: Ticker["direction"] = price > prev ? "up" : price < prev ? "down" : "flat";
  prevPriceMap[sym] = price;
  prevPriceMap[baseSym] = price;

  const item: Ticker = {
    symbol: sym,
    price,
    change,
    high: high || price,
    low: low || price,
    volume: volume || 10000,
    direction,
  };

  if (immediate) {
    globalTickers[sym] = item;
    globalTickers[baseSym] = item;
    notifySubscribers();
  } else {
    pendingBatch[sym] = item;
    pendingBatch[baseSym] = item;
  }
}

async function fetchSingletonRestPrices() {
  if (typeof document !== "undefined" && document.hidden) return;
  queueGlobalTicker("USDTUSDT", 1.0, 0, 1.0, 1.0, 1000000, false);

  const syms = Array.from(requestedSymbols).filter((s) => s !== "USDTUSDT");
  if (syms.length === 0) return;

  try {
    const results = await proxyCryptoPrices({ data: syms });
    if (results && results.length > 0) {
      results.forEach((r) => {
        queueGlobalTicker(r.symbol, r.price, r.change, r.high, r.low, r.volume, false);
      });
      globalStatus = "live";
      return;
    }
  } catch {
    // Fallback to local defaults on server error
  }

  // Local fallback
  if (globalStatus !== "live") {
    globalStatus = "error";
    syms.forEach((sym) => {
      const fb = FALLBACK_PRICES[sym] || FALLBACK_PRICES["BTCUSDT"];
      if (fb) queueGlobalTicker(sym, fb.price, fb.change, 0, 0, 0, false);
    });
  }
}

function startSingletonStreams() {
  if (typeof window === "undefined") return;

  // Clear disconnect delay if re-subscribing
  if (disconnectTimeout) {
    clearTimeout(disconnectTimeout);
    disconnectTimeout = null;
  }

  // Setup batch flusher if not running (~750ms throttled dispatch for 60fps smoothness)
  if (!globalFlushInterval) {
    globalFlushInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      const keys = Object.keys(pendingBatch);
      if (keys.length > 0) {
        for (const k of keys) {
          globalTickers[k] = pendingBatch[k];
          delete pendingBatch[k];
        }
        notifySubscribers();
      }
    }, 750);
  }

  // Setup fallback polling (every 15s, lazy and efficient)
  if (!globalPollInterval) {
    fetchSingletonRestPrices();
    globalPollInterval = setInterval(fetchSingletonRestPrices, 15000);
  }

  // Connect WebSocket if not connected
  if (!globalWs && !globalWsConnecting) {
    globalWsConnecting = true;
    try {
      const cleanSymbols = Array.from(requestedSymbols)
        .filter((s) => s !== "USDTUSDT" && s !== "MNTUSDT")
        .map((s) => `${s.toLowerCase()}@ticker`);

      if (cleanSymbols.length > 0) {
        const wsUrl = `wss://stream.binance.com:9443/ws/${cleanSymbols.join("/")}`;
        const ws = new WebSocket(wsUrl);
        globalWs = ws;

        ws.onopen = () => {
          globalWsConnecting = false;
          globalStatus = "live";
        };

        ws.onmessage = (event) => {
          if (typeof document !== "undefined" && document.hidden) return;
          try {
            const data = JSON.parse(event.data);
            if (data && data.s && data.c) {
              queueGlobalTicker(
                data.s,
                Number(data.c),
                Number(data.P || 0),
                Number(data.h || 0),
                Number(data.l || 0),
                Number(data.v || 0),
                false,
              );
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onerror = () => {
          globalWsConnecting = false;
          // Silent fallback to REST
        };

        ws.onclose = () => {
          globalWsConnecting = false;
          globalWs = null;
        };
      } else {
        globalWsConnecting = false;
      }
    } catch {
      globalWsConnecting = false;
    }
  }
}

function stopSingletonStreamsGracefully() {
  if (activeSubscribers.size > 0) return;
  if (disconnectTimeout) clearTimeout(disconnectTimeout);

  disconnectTimeout = setTimeout(() => {
    if (activeSubscribers.size === 0) {
      if (globalWs) {
        try {
          globalWs.close();
        } catch {
          // ignore
        }
        globalWs = null;
      }
      if (globalFlushInterval) {
        clearInterval(globalFlushInterval);
        globalFlushInterval = null;
      }
      if (globalPollInterval) {
        clearInterval(globalPollInterval);
        globalPollInterval = null;
      }
      globalWsConnecting = false;
    }
  }, 10000); // 10-second grace period before teardown
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && activeSubscribers.size > 0) {
      fetchSingletonRestPrices();
    }
  });
}

export function useBinancePrices(symbols: string[] = DEFAULT_SYMBOLS) {
  const symbolsKey = symbols.join(",");

  // Track if we need to update state
  const [, setTick] = useState(0);

  useEffect(() => {
    const cleanSymbols = symbols.map((s) => {
      const u = s.toUpperCase().trim();
      if (u === "USDT") return "USDTUSDT";
      return u.endsWith("USDT") ? u : `${u}USDT`;
    });

    cleanSymbols.forEach((s) => requestedSymbols.add(s));

    const onUpdate = () => {
      setTick((t) => (t + 1) % 1000000);
    };

    activeSubscribers.add(onUpdate);
    startSingletonStreams();

    return () => {
      activeSubscribers.delete(onUpdate);
      stopSingletonStreamsGracefully();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  return { tickers: globalTickers, status: globalStatus };
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
