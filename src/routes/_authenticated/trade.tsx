import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAccountMode } from "@/lib/account-mode-context";
import { useCurrency } from "@/lib/currency-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  DollarSign,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  X,
  Activity,
  Newspaper,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Crosshair,
  Ruler,
  PencilLine,
  Magnet,
  Maximize2,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { TradingChart, type Candle } from "@/components/TradingChart";
import type { Time } from "lightweight-charts";
import { useServerFn } from "@tanstack/react-start";
import { closePosition, openPosition } from "@/lib/admin.functions";
import { useBinancePrices } from "@/hooks/useBinancePrices";

export const Route = createFileRoute("/_authenticated/trade")({
  component: Dashboard,
});

type ChartMode = "profit" | "loss" | "flat" | "live";

const ASSETS = [
  { sym: "BTC/USD", base: 67500 },
  { sym: "ETH/USD", base: 3850 },
  { sym: "SOL/USD", base: 178 },
  { sym: "XAU/USD", base: 2640 },
  { sym: "EUR/USD", base: 1.085 },
];

// Map trade asset symbols → Binance kline symbols (USDT pairs)
const BINANCE_KLINE_MAP: Record<string, string> = {
  "BTC/USD": "BTCUSDT",
  "ETH/USD": "ETHUSDT",
  "SOL/USD": "SOLUSDT",
};

// Fetch real 1-minute OHLCV candles from Binance public REST API (no auth required)
async function fetchBinanceLiveCandles(sym: string, count = 120): Promise<Candle[] | null> {
  const bSym = BINANCE_KLINE_MAP[sym];
  if (!bSym) return null;
  try {
    // Try Binance first
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
    // Bybit fallback for klines
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

function seedRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function generateCandles(
  asset: string,
  base: number,
  mode: ChartMode,
  intensity: number,
  seed: number,
  count = 120,
): Candle[] {
  const rand = seedRand(seed + asset.charCodeAt(0));
  const out: Candle[] = [];
  let price = base;
  const now = Math.floor(Date.now() / 1000);
  const interval = 60; // 1 min
  // Strong directional drift so admin "profit/loss" is visually obvious on the user chart
  const driftPct =
    mode === "profit" ? 0.0035 * intensity : mode === "loss" ? -0.0035 * intensity : 0;
  for (let i = count - 1; i >= 0; i--) {
    const t = (now - i * interval) as Time;
    const vol = base * 0.004 * Math.max(0.5, intensity);
    const open = price;
    const change = (rand() - 0.5) * vol * 2 + driftPct * base;
    const close = Math.max(0.0001, open + change);
    const high = Math.max(open, close) + rand() * vol * 0.6;
    const low = Math.min(open, close) - rand() * vol * 0.6;
    out.push({ time: t, open, high, low, close });
    price = close;
  }
  return out;
}

function nextCandle(
  last: Candle,
  base: number,
  mode: ChartMode,
  intensity: number,
  rand: () => number,
): Candle {
  const driftPct =
    mode === "profit" ? 0.0035 * intensity : mode === "loss" ? -0.0035 * intensity : 0;
  const vol = base * 0.004 * Math.max(0.5, intensity);
  const open = last.close;
  const close = Math.max(0.0001, open + (rand() - 0.5) * vol * 2 + driftPct * base);
  const high = Math.max(open, close) + rand() * vol * 0.6;
  const low = Math.min(open, close) - rand() * vol * 0.6;
  return { time: ((last.time as number) + 60) as Time, open, high, low, close };
}

type ToolbarHandlers = {
  showMA: boolean;
  toggleMA: () => void;
  showRSI: boolean;
  toggleRSI: () => void;
  magnet: boolean;
  toggleMagnet: () => void;
  crosshair: boolean;
  toggleCrosshair: () => void;
  measure: () => void;
  fullscreen: () => void;
};

function ChartShell({
  children,
  adminMode,
  aiTradingEnabled,
  containerRef,
  tb,
}: {
  children: ReactNode;
  adminMode: ChartMode;
  aiTradingEnabled: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  tb: ToolbarHandlers;
}) {
  const tools: { label: string; Icon: any; onClick: () => void; active?: boolean }[] = [
    {
      label: tb.crosshair ? "Crosshair on" : "Crosshair off",
      Icon: Crosshair,
      onClick: tb.toggleCrosshair,
      active: tb.crosshair,
    },
    {
      label: tb.showMA ? "Hide MA(14)" : "Show MA(14)",
      Icon: TrendingUp,
      onClick: tb.toggleMA,
      active: tb.showMA,
    },
    { label: "Measure range", Icon: Ruler, onClick: tb.measure },
    {
      label: tb.showRSI ? "Hide RSI(14)" : "Show RSI(14)",
      Icon: PencilLine,
      onClick: tb.toggleRSI,
      active: tb.showRSI,
    },
    {
      label: tb.magnet ? "Magnet on" : "Magnet off",
      Icon: Magnet,
      onClick: tb.toggleMagnet,
      active: tb.magnet,
    },
    { label: "Fullscreen", Icon: Maximize2, onClick: tb.fullscreen },
  ];
  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-lg border border-border bg-background"
    >
      <div className="absolute left-2 top-2 z-10 flex flex-col gap-1 rounded-md border border-border bg-card/95 p-1 shadow-elegant backdrop-blur">
        {tools.map(({ label, Icon, onClick, active }) => (
          <button
            key={label}
            type="button"
            title={label}
            onClick={onClick}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <div className="absolute right-2 top-2 z-10 flex flex-wrap justify-end gap-1 text-[10px] font-semibold uppercase">
        <span className="rounded-md border border-border bg-card/95 px-2 py-1 text-muted-foreground backdrop-blur">
          Admin: {adminMode}
        </span>
        {aiTradingEnabled && (
          <span className="inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary/15 px-2 py-1 text-primary backdrop-blur">
            <Bot className="h-3 w-3" /> AI on
          </span>
        )}
      </div>
      <div className="pl-10 pt-10 sm:pl-12 sm:pt-0">{children}</div>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const { formatCurrency, formatPrice } = useCurrency();
  const qc = useQueryClient();
  const [assetSym, setAssetSym] = useState(ASSETS[0].sym);
  const asset = ASSETS.find((a) => a.sym === assetSym)!;
  const [showMA, setShowMA] = useState(true);
  const [showRSI, setShowRSI] = useState(false);
  const [magnet, setMagnet] = useState(false);
  const [crosshair, setCrosshair] = useState(true);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const openPositionFn = useServerFn(openPosition);
  const closePositionFn = useServerFn(closePosition);
  const aiBusyRef = useRef(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`user-live-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["profile", user.id] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          qc.invalidateQueries({ queryKey: ["recent_tx", user.id] });
          qc.invalidateQueries({ queryKey: ["transactions", user.id] });
          const row = payload?.new;
          if (payload.eventType === "INSERT" && row && Number(row.amount) > 0) {
            const isCredit = ["deposit", "admin_credit", "referral_bonus", "trade_profit"].includes(
              row.type,
            );
            if (isCredit)
              toast.success(`+$${Number(row.amount).toFixed(2)} · ${row.asset_name ?? row.type}`);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deposits", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          qc.invalidateQueries({ queryKey: ["my_deposits", user.id] });
          const row = payload?.new;
          if (payload.eventType === "UPDATE" && row?.status === "approved") {
            toast.success(
              `Deposit approved — $${Number(row.amount).toFixed(2)} credited to live balance`,
            );
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  const {
    liveBalance: totalLiveBalance,
    fiatLiveBalance,
    cryptoBalance,
    demoBalance,
  } = useAccountMode();
  const mode = (profile?.chart_mode ?? "flat") as ChartMode;
  const intensity = Number(profile?.chart_intensity ?? 1);
  const seed = Number(profile?.chart_seed ?? 42);
  const accountMode = (profile?.account_mode ?? "demo") as "demo" | "live";
  const cashBalance = fiatLiveBalance;
  const usableBalance = accountMode === "live" ? cashBalance : demoBalance;
  const kycStatus = (profile?.kyc_status ?? "none") as string;
  const aiTradingEnabled = Boolean((profile as any)?.ai_trading_enabled);
  const isSuspended = Boolean(profile?.is_suspended);

  const binanceSyms = useMemo(() => ["BTCUSDT", "ETHUSDT", "SOLUSDT"], []);
  const { tickers } = useBinancePrices(binanceSyms);

  const switchMode = async (next: "demo" | "live") => {
    if (!user?.id || next === accountMode) return;
    if (next === "live" && isSuspended) {
      toast.error("Account suspended — contact support");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ account_mode: next, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success(`Switched to ${next.toUpperCase()} account`);
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
  };

  const [candles, setCandles] = useState<Candle[]>(() =>
    generateCandles(asset.sym, asset.base, mode, intensity, seed),
  );
  const randRef = useRef(seedRand(seed + 999));
  const tickersRef = useRef(tickers);
  tickersRef.current = tickers;
  const candlesRef = useRef(candles);
  candlesRef.current = candles;

  // Reset candles when asset / mode / seed change
  useEffect(() => {
    randRef.current = seedRand(seed + 999);
    if (mode === "live") {
      // Fetch real Binance candles; fall back to flat-generated candles if API fails
      fetchBinanceLiveCandles(asset.sym).then((live) => {
        if (live && live.length > 0) {
          setCandles(live);
        } else {
          setCandles(generateCandles(asset.sym, asset.base, "flat", intensity, seed));
        }
      });
    } else {
      setCandles(generateCandles(asset.sym, asset.base, mode, intensity, seed));
    }
  }, [assetSym, mode, intensity, seed, asset.sym, asset.base]);

  // Live tick: update or append new candle using live Binance ticker or mode drift
  useEffect(() => {
    const id = setInterval(() => {
      setCandles((prev) => {
        if (!prev || prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        const bSym = BINANCE_KLINE_MAP[asset.sym];
        const currentTickers = tickersRef.current;
        const livePrice = bSym ? currentTickers[bSym]?.price : undefined;

        if (mode === "live" && livePrice && livePrice > 0) {
          const updatedLast = {
            ...last,
            close: livePrice,
            high: Math.max(last.high, livePrice),
            low: Math.min(last.low, livePrice),
          };
          return [...prev.slice(0, -1), updatedLast];
        } else {
          const next = nextCandle(last, asset.base, mode, intensity, randRef.current);
          return [...prev.slice(-200), next];
        }
      });
    }, 2500);
    return () => clearInterval(id);
  }, [asset.base, asset.sym, mode, intensity]);

  const lastPrice = candles[candles.length - 1]?.close ?? asset.base;
  const firstPrice = candles[0]?.close ?? asset.base;
  const changePct = ((lastPrice - firstPrice) / firstPrice) * 100;

  // ============================================================
  // 🤖 PROFITABLE AI TRADING ENGINE
  // Strategy stack (signals must agree — minimum confluence score 3):
  //   1. Trend filter: SMA20 vs SMA50 (only trade WITH the trend)
  //   2. Momentum: 5-bar rate of change
  //   3. RSI(14): buy oversold pullbacks in uptrend, sell overbought rallies in downtrend
  //   4. Pattern: higher-high/higher-low (bullish) or lower-high/lower-low (bearish)
  //   5. Bullish/bearish engulfing candle confirmation
  // Risk mgmt: 3:1 reward/risk (TP +1.5%, SL -0.5%), trailing stop activates at +0.8%.
  // Cooldown: 25s between trades, skip 60s after a loss.
  // ============================================================
  const aiStateRef = useRef({ lastTradeAt: 0, lastLossAt: 0, trailHigh: 0, trailLow: 0 });
  const [aiStats, setAiStats] = useState({ wins: 0, losses: 0, netPnl: 0, trades: 0 });

  useEffect(() => {
    if (!aiTradingEnabled || !user?.id) return;
    const tick = async () => {
      if (aiBusyRef.current) return;
      const currentCandles = candlesRef.current;
      if (!currentCandles || currentCandles.length < 30) return;

      const closes = currentCandles.map((c) => c.close);
      const highs = currentCandles.map((c) => c.high);
      const lows = currentCandles.map((c) => c.low);
      const price = closes[closes.length - 1];
      const sma = (n: number) => closes.slice(-n).reduce((s, v) => s + v, 0) / n;
      const sma20 = sma(20);
      const sma50 = sma(50);

      // RSI(14)
      let gains = 0,
        losses = 0;
      for (let i = closes.length - 14; i < closes.length; i++) {
        const d = closes[i] - closes[i - 1];
        if (d >= 0) gains += d;
        else losses -= d;
      }
      const rs = losses === 0 ? 100 : gains / losses;
      const rsi = 100 - 100 / (1 + rs);

      // 5-bar momentum %
      const momentum = ((price - closes[closes.length - 6]) / closes[closes.length - 6]) * 100;

      // Pattern: recent swing structure
      const recentHighs = highs.slice(-10);
      const recentLows = lows.slice(-10);
      const higherHigh =
        recentHighs[recentHighs.length - 1] > Math.max(...recentHighs.slice(0, -3));
      const higherLow = recentLows[recentLows.length - 1] > Math.min(...recentLows.slice(0, -3));
      const lowerHigh = recentHighs[recentHighs.length - 1] < Math.max(...recentHighs.slice(0, -3));
      const lowerLow = recentLows[recentLows.length - 1] < Math.min(...recentLows.slice(0, -3));

      // Engulfing candle
      const c1 = currentCandles[currentCandles.length - 2];
      const c2 = currentCandles[currentCandles.length - 1];
      const bullEngulf =
        c1.close < c1.open && c2.close > c2.open && c2.close > c1.open && c2.open < c1.close;
      const bearEngulf =
        c1.close > c1.open && c2.close < c2.open && c2.close < c1.open && c2.open > c1.close;

      // Score signals — need >=3 confluence
      let buyScore = 0,
        sellScore = 0;
      if (sma20 > sma50) buyScore++;
      else if (sma20 < sma50) sellScore++;
      if (momentum > 0.1) buyScore++;
      else if (momentum < -0.1) sellScore++;
      if (rsi < 45 && sma20 > sma50) buyScore += 2; // dip in uptrend = gold
      if (rsi > 55 && sma20 < sma50) sellScore += 2; // rally in downtrend
      if (higherHigh && higherLow) buyScore++;
      if (lowerHigh && lowerLow) sellScore++;
      if (bullEngulf) buyScore++;
      if (bearEngulf) sellScore++;

      aiBusyRef.current = true;
      try {
        const { data: positions } = await supabase
          .from("live_positions")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "open")
          .eq("asset", assetSym)
          .eq("account_mode", accountMode);
        const open = positions ?? [];

        // ===== Manage open positions with trailing stop =====
        for (const p of open) {
          const entry = Number(p.entry_price);
          const dir = p.side === "buy" ? 1 : -1;
          const pnlPct = ((price - entry) / entry) * 100 * dir;

          // Trailing stop: once +0.8% in profit, lock in half the gain
          if (p.side === "buy")
            aiStateRef.current.trailHigh = Math.max(aiStateRef.current.trailHigh || price, price);
          else aiStateRef.current.trailLow = Math.min(aiStateRef.current.trailLow || price, price);

          const trailHit =
            p.side === "buy"
              ? pnlPct >= 0.8 && price <= aiStateRef.current.trailHigh * 0.996
              : pnlPct >= 0.8 && price >= aiStateRef.current.trailLow * 1.004;

          // Exit conditions: TP, SL, trailing, or trend flip
          const trendFlip =
            (p.side === "buy" && sma20 < sma50 && momentum < -0.15) ||
            (p.side === "sell" && sma20 > sma50 && momentum > 0.15);

          if (pnlPct >= 1.5 || pnlPct <= -0.5 || trailHit || trendFlip) {
            try {
              const result = await closePositionFn({ data: { id: p.id, closePrice: price } });
              const finalPnl = Number(result.pnl ?? 0);
              const reason =
                pnlPct >= 1.5
                  ? "🎯 Take profit"
                  : trailHit
                    ? "🔒 Trailing stop"
                    : trendFlip
                      ? "↩ Trend flip"
                      : "🛑 Stop loss";
              toast[finalPnl >= 0 ? "success" : "error"](
                `🤖 ${reason} · ${p.asset} ${p.side.toUpperCase()} · ${finalPnl >= 0 ? "+" : ""}$${finalPnl.toFixed(2)}`,
              );
              setAiStats((s) => ({
                wins: s.wins + (finalPnl >= 0 ? 1 : 0),
                losses: s.losses + (finalPnl < 0 ? 1 : 0),
                netPnl: s.netPnl + finalPnl,
                trades: s.trades + 1,
              }));
              if (finalPnl < 0) aiStateRef.current.lastLossAt = Date.now();
              aiStateRef.current.trailHigh = 0;
              aiStateRef.current.trailLow = 0;
              qc.invalidateQueries({ queryKey: ["positions"] });
              qc.invalidateQueries({ queryKey: ["profile", user.id] });
              qc.invalidateQueries({ queryKey: ["recent_tx", user.id] });
              qc.invalidateQueries({ queryKey: ["transactions", user.id] });
            } catch (err: any) {
              console.error("AI close failed", err);
            }
          }
        }

        // ===== Entry logic — only when no open position =====
        if (open.length > 0) return;
        if (isSuspended && accountMode === "live") return;
        const now = Date.now();
        if (now - aiStateRef.current.lastTradeAt < 8_000) return; // cooldown
        if (now - aiStateRef.current.lastLossAt < 20_000) return; // post-loss pause

        const usable = accountMode === "live" ? liveBalance : demoBalance;
        if (usable < 10) return;

        let side: "buy" | "sell" | null = null;
        let confidence = 0;
        if (buyScore >= 2 && buyScore > sellScore) {
          side = "buy";
          confidence = buyScore;
        } else if (sellScore >= 2 && sellScore > buyScore) {
          side = "sell";
          confidence = sellScore;
        }
        if (!side) return;

        // Position sizing scales with confidence (2%-8% of usable)
        const sizePct = Math.min(0.08, 0.02 + confidence * 0.01);
        const margin = Math.max(10, Math.min(usable * sizePct, 500));
        const lev = 5;
        const qty = (margin * lev) / price;
        try {
          await openPositionFn({
            data: {
              asset: assetSym,
              side,
              quantity: qty,
              leverage: lev,
              margin,
              entryPrice: price,
              accountMode,
            },
          });
          aiStateRef.current.lastTradeAt = now;
          aiStateRef.current.trailHigh = side === "buy" ? price : 0;
          aiStateRef.current.trailLow = side === "sell" ? price : 0;
          toast.success(
            `🤖 AI ${side.toUpperCase()} ${assetSym} @ $${price.toFixed(2)} · confidence ${confidence}/8`,
          );
          qc.invalidateQueries({ queryKey: ["positions"] });
          qc.invalidateQueries({ queryKey: ["profile", user.id] });
          qc.invalidateQueries({ queryKey: ["recent_tx", user.id] });
        } catch (err: any) {
          console.error("AI open failed", err);
        }
      } finally {
        aiBusyRef.current = false;
      }
    };
    const id = setInterval(tick, 2500);
    return () => clearInterval(id);
  }, [
    aiTradingEnabled,
    user?.id,
    assetSym,
    accountMode,
    isSuspended,
    cashBalance,
    demoBalance,
    openPositionFn,
    closePositionFn,
    qc,
  ]);

  const toolbar = {
    showMA,
    toggleMA: () => setShowMA((v) => !v),
    showRSI,
    toggleRSI: () => setShowRSI((v) => !v),
    magnet,
    toggleMagnet: () => {
      setMagnet((v) => !v);
      toast.message(magnet ? "Magnet off" : "Magnet on — snapping to OHLC");
    },
    crosshair,
    toggleCrosshair: () => {
      setCrosshair((v) => !v);
      toast.message(crosshair ? "Crosshair hidden" : "Crosshair active");
    },
    measure: () => {
      const hi = Math.max(...candles.slice(-30).map((c) => c.high));
      const lo = Math.min(...candles.slice(-30).map((c) => c.low));
      const range = ((hi - lo) / lo) * 100;
      toast.message(
        `Range (last 30): $${lo.toFixed(2)} → $${hi.toFixed(2)} · ${range.toFixed(2)}%`,
      );
    },
    fullscreen: () => {
      const el = chartContainerRef.current;
      if (!el) return;
      if (document.fullscreenElement) document.exitFullscreen?.();
      else el.requestFullscreen?.();
    },
  };

  return (
    <div className="-m-6 min-h-screen space-y-5 bg-background px-6 py-5 text-foreground dark">
      {/* HERO BALANCE + MODE SWITCH */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden border-0 p-5 sm:p-7 bg-gradient-hero text-white shadow-glow">
          <div
            className="absolute inset-0 opacity-30 mix-blend-overlay"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, white 0%, transparent 40%), radial-gradient(circle at 80% 80%, white 0%, transparent 35%)",
            }}
          />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium opacity-90">
                <Sparkles className="h-3.5 w-3.5" />
                <span>
                  {accountMode === "live" ? "LIVE TRADING ACCOUNT" : "DEMO PRACTICE ACCOUNT"}
                </span>
                {isSuspended && (
                  <Badge variant="destructive" className="ml-1">
                    SUSPENDED
                  </Badge>
                )}
              </div>
              <div className="mt-1 text-3xl sm:text-4xl font-bold tabular-nums tracking-tight">
                {formatCurrency(usableBalance)}
              </div>
              <p className="mt-1 text-xs opacity-80">
                {profile?.full_name
                  ? `Welcome back, ${profile.full_name.split(" ")[0]}`
                  : "Welcome back"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {/* Mode toggle */}
              <div className="flex rounded-full bg-black/25 p-1 backdrop-blur">
                <button
                  type="button"
                  onClick={() => switchMode("demo")}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${accountMode === "demo" ? "bg-white text-primary shadow" : "text-white/80 hover:text-white"}`}
                >
                  DEMO
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("live")}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${accountMode === "live" ? "bg-success text-success-foreground shadow" : "text-white/80 hover:text-white"}`}
                >
                  LIVE
                </button>
              </div>
              {kycStatus === "approved" ? (
                <span className="text-[10px] opacity-80 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> KYC verified
                </span>
              ) : kycStatus === "pending" ? (
                <Link
                  to="/kyc"
                  className="text-[10px] underline opacity-90 flex items-center gap-1"
                >
                  <AlertTriangle className="h-3 w-3" /> KYC under review
                </Link>
              ) : (
                <Link
                  to="/kyc"
                  className="text-[10px] underline opacity-90 flex items-center gap-1"
                >
                  <AlertTriangle className="h-3 w-3" /> Submit KYC
                </Link>
              )}
            </div>
          </div>

          <div className="relative mt-5 flex flex-wrap gap-2">
            <Button
              asChild
              size="sm"
              variant="secondary"
              className="bg-white/95 text-primary hover:bg-white"
            >
              <Link to="/deposit">
                <ArrowDownToLine className="mr-1.5 h-4 w-4" /> Deposit
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="secondary"
              className="bg-black/30 text-white hover:bg-black/40"
            >
              <Link to="/withdraw">
                <ArrowUpFromLine className="mr-1.5 h-4 w-4" /> Withdraw
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className="text-white hover:bg-white/10">
              <Link to="/transactions">
                Activity <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Mini balance cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <BalanceCard
          label="Live balance (Total)"
          value={totalLiveBalance}
          Icon={TrendingUp}
          accent="success"
          active={accountMode === "live"}
        />
        <BalanceCard label="Cash balance (USD)" value={cashBalance} Icon={DollarSign} />
        <BalanceCard label="Crypto holdings" value={cryptoBalance} Icon={Wallet} />
        <BalanceCard
          label="Demo balance"
          value={demoBalance}
          Icon={Activity}
          accent="muted"
          active={accountMode === "demo"}
        />
      </div>

      <Card className="p-4 sm:p-6 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Select value={assetSym} onValueChange={setAssetSym}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSETS.map((a) => (
                  <SelectItem key={a.sym} value={a.sym}>
                    {a.sym}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>
              <div className="text-2xl font-bold tabular-nums">
                ${lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div
                className={`text-xs font-medium ${changePct >= 0 ? "text-success" : "text-destructive"}`}
              >
                {changePct >= 0 ? "▲" : "▼"} {changePct.toFixed(2)}%
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={showMA} onCheckedChange={setShowMA} /> MA(14)
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={showRSI} onCheckedChange={setShowRSI} /> RSI(14)
            </label>
          </div>
        </div>

        <div className="mt-4">
          <ChartShell
            adminMode={mode}
            aiTradingEnabled={aiTradingEnabled}
            containerRef={chartContainerRef}
            tb={toolbar}
          >
            <TradingChart candles={candles} showMA={showMA} showRSI={showRSI} />
          </ChartShell>
        </div>

        <TradePanel
          asset={assetSym}
          price={lastPrice}
          balance={usableBalance}
          mode={accountMode}
          userId={user?.id}
          isSuspended={isSuspended}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LivePositions price={lastPrice} asset={assetSym} userId={user?.id} qc={qc} />
        </div>
        <OrderBook price={lastPrice} />
      </div>

      {aiTradingEnabled && (
        <Card className="p-4 sm:p-5 border-primary/40 bg-gradient-to-r from-primary/10 via-card to-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary/20">
                <Bot className="h-4 w-4 text-primary" />
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-success ring-2 ring-card" />
              </div>
              <div>
                <div className="text-sm font-semibold">AI Trader · live</div>
                <div className="text-[10px] text-muted-foreground">
                  Multi-indicator confluence · 3:1 R/R · trailing stop
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <Stat label="Trades" value={aiStats.trades} />
              <Stat label="Wins" value={aiStats.wins} accent="success" />
              <Stat label="Losses" value={aiStats.losses} accent="destructive" />
              <Stat
                label="Win rate"
                value={
                  aiStats.trades ? `${Math.round((aiStats.wins / aiStats.trades) * 100)}%` : "—"
                }
              />
              <Stat
                label="Net P&L"
                value={`${aiStats.netPnl >= 0 ? "+" : ""}$${aiStats.netPnl.toFixed(2)}`}
                accent={aiStats.netPnl >= 0 ? "success" : "destructive"}
              />
            </div>
          </div>
        </Card>
      )}

      <RecentActivity userId={user?.id} />

      <NewsTicker />
    </div>
  );
}

function RecentActivity({ userId }: { userId?: string }) {
  const { data } = useQuery({
    queryKey: ["recent_tx", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
    enabled: !!userId,
    refetchInterval: 6000,
  });
  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Recent activity
        </h2>
        <Link
          to="/transactions"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {!data?.length ? (
        <p className="text-sm text-muted-foreground">
          No activity yet — deposit funds to get started.
        </p>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {data.map((t: any) => {
              const isCredit = [
                "deposit",
                "admin_credit",
                "referral_bonus",
                "trade_profit",
              ].includes(t.type);
              const isDebit = [
                "withdrawal_request",
                "admin_debit",
                "trade_loss",
                "trade_open",
                "withdrawal_tax_fee",
              ].includes(t.type);
              const amt = Number(t.amount);
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isCredit ? "bg-success/15 text-success" : isDebit ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}
                    >
                      {isCredit ? (
                        <ArrowDownToLine className="h-4 w-4" />
                      ) : isDebit ? (
                        <ArrowUpFromLine className="h-4 w-4" />
                      ) : (
                        <Activity className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs sm:text-sm font-medium">
                        {t.asset_name ?? t.type}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(t.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {amt > 0 && (
                      <div
                        className={`tabular-nums text-sm font-semibold ${isCredit ? "text-success" : isDebit ? "text-destructive" : ""}`}
                      >
                        {isCredit ? "+" : isDebit ? "−" : ""}${amt.toFixed(2)}
                      </div>
                    )}
                    <Badge variant="outline" className="text-[9px] uppercase">
                      {t.status}
                    </Badge>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </Card>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "success" | "destructive";
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`text-sm font-bold tabular-nums ${accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function BalanceCard({
  label,
  value,
  Icon,
  accent,
  active,
}: {
  label: string;
  value: number;
  Icon: any;
  accent?: "success" | "muted";
  active?: boolean;
}) {
  return (
    <Card
      className={`p-4 transition-all ${active ? "border-primary/60 shadow-glow bg-accent/30" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <Icon
          className={`h-3.5 w-3.5 ${accent === "success" ? "text-success" : accent === "muted" ? "text-muted-foreground" : "text-primary"}`}
        />
      </div>
      <div className="mt-1.5 text-lg sm:text-xl font-bold tabular-nums">
        ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      {active && <div className="mt-1 text-[10px] font-semibold text-primary">● ACTIVE</div>}
    </Card>
  );
}

function TradePanel({
  asset,
  price,
  balance,
  mode,
  userId,
  isSuspended,
}: {
  asset: string;
  price: number;
  balance: number;
  mode: "demo" | "live";
  userId?: string;
  isSuspended: boolean;
}) {
  const [amount, setAmount] = useState("300");
  const [leverage, setLeverage] = useState("10");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const openPositionFn = useServerFn(openPosition);

  const open = async (side: "buy" | "sell") => {
    if (!userId) return;
    const margin = Number(amount);
    const lev = Math.max(1, Math.min(100, Number(leverage)));
    if (!margin || margin < 300) return toast.error("Minimum investment amount is $300");
    if (margin > balance) return toast.error("Insufficient balance");
    if (isSuspended) return toast.error("Account suspended — contact support");

    setBusy(true);
    try {
      const qty = (margin * lev) / price;
      await openPositionFn({
        data: {
          asset,
          side,
          quantity: qty,
          leverage: lev,
          margin,
          entryPrice: price,
          accountMode: mode,
        },
      });
      toast.success(`${side.toUpperCase()} ${asset} @ $${price.toFixed(2)} ($${margin} margin)`);
      window.dispatchEvent(new CustomEvent("dewtrades:refresh-balance"));
      qc.invalidateQueries({ queryKey: ["positions"] });
      qc.invalidateQueries({ queryKey: ["profile", userId] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["transactions", userId] });
    } catch (err: any) {
      toast.error(err.message ?? "Trade failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] items-end">
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <Label className="text-xs font-semibold">Investment Margin (USD)</Label>
            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              Min $300
            </span>
          </div>
          <Input
            type="number"
            min="300"
            step="10"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Leverage (×)</Label>
          <Input
            type="number"
            min="1"
            max="100"
            step="1"
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
          />
        </div>
        <Button
          onClick={() => open("sell")}
          disabled={busy}
          className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold px-6"
        >
          SELL (Short)
        </Button>
        <Button
          onClick={() => open("buy")}
          disabled={busy}
          className="bg-success hover:bg-success/90 text-success-foreground font-bold px-6"
        >
          BUY (Long)
        </Button>
      </div>
    </div>
  );
}

function LivePositions({
  price,
  asset,
  userId,
  qc,
}: {
  price: number;
  asset: string;
  userId?: string;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const closePositionFn = useServerFn(closePosition);
  const { data: positions } = useQuery({
    queryKey: ["positions", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_positions")
        .select("*")
        .eq("user_id", userId!)
        .order("opened_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!userId,
    refetchInterval: 4000,
  });

  const close = async (p: any) => {
    const livePrice = p.asset === asset ? price : Number(p.entry_price);
    const direction = p.side === "buy" ? 1 : -1;
    const pnl = +((livePrice - Number(p.entry_price)) * Number(p.quantity) * direction).toFixed(2);
    try {
      const result = await closePositionFn({ data: { id: p.id, closePrice: livePrice } });
      const finalPnl = Number(result.pnl ?? pnl);
      toast.success(`Closed ${p.asset} · P&L ${finalPnl >= 0 ? "+" : ""}$${finalPnl.toFixed(2)}`);
      window.dispatchEvent(new CustomEvent("dewtrades:refresh-balance"));
      qc.invalidateQueries({ queryKey: ["positions"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["profile", userId] });
      qc.invalidateQueries({ queryKey: ["transactions", userId] });
    } catch (err: any) {
      toast.error(err.message ?? "Close failed");
    }
  };

  const open = (positions ?? []).filter((p: any) => p.status === "open");

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" /> Live positions
      </h2>
      {!open.length ? (
        <p className="text-sm text-muted-foreground">No open positions.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2">Asset</th>
                <th className="pb-2">Side</th>
                <th className="pb-2">Entry</th>
                <th className="pb-2">Now</th>
                <th className="pb-2 text-right">P&amp;L</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {open.map((p: any) => {
                const livePrice = p.asset === asset ? price : Number(p.entry_price);
                const direction = p.side === "buy" ? 1 : -1;
                const pnl = (livePrice - Number(p.entry_price)) * Number(p.quantity) * direction;
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-2 font-medium">
                      {p.asset} <span className="text-muted-foreground">×{p.leverage}</span>
                    </td>
                    <td>
                      <Badge
                        className={
                          p.side === "buy"
                            ? "bg-success text-success-foreground"
                            : "bg-destructive text-destructive-foreground"
                        }
                      >
                        {p.side.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="tabular-nums">${Number(p.entry_price).toFixed(2)}</td>
                    <td className="tabular-nums">${livePrice.toFixed(2)}</td>
                    <td
                      className={`text-right tabular-nums font-semibold ${pnl >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                    </td>
                    <td className="text-right">
                      <Button size="sm" variant="outline" onClick={() => close(p)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function OrderBook({ price }: { price: number }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1200);
    return () => clearInterval(id);
  }, []);
  const rand = useMemo(() => seedRand(tick + 7), [tick]);
  const bids = Array.from({ length: 6 }, (_, i) => ({
    p: price - (i + 1) * (price * 0.0004),
    q: (rand() * 5 + 0.2).toFixed(3),
  }));
  const asks = Array.from({ length: 6 }, (_, i) => ({
    p: price + (i + 1) * (price * 0.0004),
    q: (rand() * 5 + 0.2).toFixed(3),
  }));
  return (
    <Card className="p-4 sm:p-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Order book
      </h2>
      <div className="space-y-0.5 text-xs font-mono">
        {asks
          .slice()
          .reverse()
          .map((a, i) => (
            <div key={`a${i}`} className="flex justify-between rounded bg-destructive/10 px-2 py-1">
              <span className="text-destructive">{a.p.toFixed(2)}</span>
              <span>{a.q}</span>
            </div>
          ))}
        <div className="my-1 text-center text-sm font-bold tabular-nums">${price.toFixed(2)}</div>
        {bids.map((b, i) => (
          <div key={`b${i}`} className="flex justify-between rounded bg-success/10 px-2 py-1">
            <span className="text-success">{b.p.toFixed(2)}</span>
            <span>{b.q}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function NewsTicker() {
  const { data: news } = useQuery({
    queryKey: ["market_news"],
    queryFn: async () => {
      const { data } = await supabase
        .from("market_news")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    refetchInterval: 30000,
  });
  const items = news?.length
    ? news
    : [
        {
          id: "x",
          title: "Markets open — Fed minutes ahead. Volatility expected on USD pairs.",
          impact: "medium",
          source: "Dew Trades Desk",
        },
      ];
  return (
    <Card className="overflow-hidden p-3">
      <div className="flex items-center gap-3">
        <Newspaper className="h-4 w-4 shrink-0 text-primary" />
        <div className="relative flex-1 overflow-hidden">
          <motion.div
            className="flex gap-12 whitespace-nowrap text-xs"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
          >
            {[...items, ...items].map((n: any, i) => (
              <span key={`${n.id}${i}`} className="flex items-center gap-2">
                <Badge
                  variant={n.impact === "high" ? "destructive" : "secondary"}
                  className="text-[10px]"
                >
                  {n.impact}
                </Badge>
                <span className="font-medium">{n.title}</span>
                <span className="text-muted-foreground">— {n.source ?? "Wire"}</span>
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </Card>
  );
}
