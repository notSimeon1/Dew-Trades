import type { Candle } from "@/components/TradingChart";
import type { Time } from "lightweight-charts";

export type ChartMode = "profit" | "loss" | "flat" | "live";

function seedRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function generateCandles(
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

export function nextCandle(
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
