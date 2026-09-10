/**
 * Precise time-based profit accrual engine.
 * Calculates exact earnings down to the second based on elapsed time since
 * the bot/copy allocation was started or last harvested.
 */

export interface TimingBreakdown {
  elapsedSeconds: number;
  elapsedHours: number;
  elapsedDays: number;
  dailyPayout: number;
  ratePerSecond: number;
  accruedProfit: number;
  totalProfit: number;
  lastHarvestDate: Date;
  startDate: Date;
  isExpired: boolean;
  progressPercent: number;
  timeSinceLastHarvestLabel: string;
}

export function formatTimeElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${remMinutes}m ago`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h ago`;
}

/**
 * Calculates deterministic time-elapsed profit for an AI trading bot.
 */
export function calculateBotProfitByTime(
  bot: {
    invested_amount?: number | string | null;
    daily_payout?: number | string | null;
    hourly_payout?: number | string | null;
    last_payout_at?: string | null;
    created_at?: string | null;
    expires_at?: string | null;
    profit_accumulated?: number | string | null;
    status?: string | null;
  },
  referenceTimeMs: number = Date.now(),
): TimingBreakdown {
  const startDate = bot.created_at ? new Date(bot.created_at) : new Date(referenceTimeMs);
  const lastHarvestDate = bot.last_payout_at ? new Date(bot.last_payout_at) : startDate;

  const expireDate = bot.expires_at ? new Date(bot.expires_at) : null;
  const isExpired = expireDate ? referenceTimeMs >= expireDate.getTime() : false;
  const effectiveEndMs = expireDate
    ? Math.min(referenceTimeMs, expireDate.getTime())
    : referenceTimeMs;

  const elapsedSeconds = Math.max(0, (effectiveEndMs - lastHarvestDate.getTime()) / 1000);
  const elapsedHours = elapsedSeconds / 3600;
  const elapsedDays = elapsedSeconds / 86400;

  const invested = Number(bot.invested_amount) || 0;
  // Floor daily payout at 20% of invested capital
  const minDailyFloor = (invested * 20) / 100;
  const rawDaily = Number(bot.daily_payout) || 0;
  const dailyPayout = Math.max(rawDaily, minDailyFloor);

  const ratePerSecond = dailyPayout / 86400;
  const accruedProfit = Number((elapsedSeconds * ratePerSecond).toFixed(4));
  const storedProfit = Number(bot.profit_accumulated) || 0;
  const totalProfit = Number(Math.max(accruedProfit, storedProfit).toFixed(2));

  let progressPercent = 0;
  if (expireDate) {
    const totalDurationMs = expireDate.getTime() - startDate.getTime();
    if (totalDurationMs > 0) {
      const activeMs = referenceTimeMs - startDate.getTime();
      progressPercent = Math.min(100, Math.max(0, (activeMs / totalDurationMs) * 100));
    }
  }

  const secSinceHarvest = Math.max(0, (referenceTimeMs - lastHarvestDate.getTime()) / 1000);
  const timeSinceLastHarvestLabel =
    bot.last_payout_at && bot.last_payout_at !== bot.created_at
      ? `Harvested ${formatTimeElapsed(secSinceHarvest)}`
      : `Active ${formatTimeElapsed(Math.max(0, (referenceTimeMs - startDate.getTime()) / 1000))}`;

  return {
    elapsedSeconds,
    elapsedHours,
    elapsedDays,
    dailyPayout,
    ratePerSecond,
    accruedProfit,
    totalProfit,
    lastHarvestDate,
    startDate,
    isExpired,
    progressPercent,
    timeSinceLastHarvestLabel,
  };
}

/**
 * Extracts metadata and last harvested timestamp from copy trading tier_key.
 * Format: "tier_name[:mode][:timestampMs]"
 */
export function parseCopyTierKey(tierKey?: string | null): {
  baseTier: string;
  isDemo: boolean;
  lastHarvestDate: Date | null;
} {
  if (!tierKey) return { baseTier: "standard", isDemo: false, lastHarvestDate: null };
  const parts = String(tierKey).split(":");
  const baseTier = parts[0] || "standard";
  const isDemo = parts.includes("demo");
  const tsPart = parts.find((p) => /^\d{12,14}$/.test(p));
  const lastHarvestDate = tsPart ? new Date(Number(tsPart)) : null;

  return { baseTier, isDemo, lastHarvestDate };
}

/**
 * Encodes mode and last harvested timestamp into tier_key.
 */
export function encodeCopyTierKey(
  baseTier: string,
  isDemo: boolean,
  harvestMs: number = Date.now(),
): string {
  const cleanBase = baseTier.split(":")[0] || "standard";
  return `${cleanBase}:${isDemo ? "demo" : "live"}:${harvestMs}`;
}

/**
 * Calculates deterministic time-elapsed profit for a Copy Trading allocation.
 */
export function calculateCopyProfitByTime(
  alloc: {
    allocated_amount?: number | string | null;
    tier_key?: string | null;
    created_at?: string | null;
    expires_at?: string | null;
    total_profit?: number | string | null;
    status?: string | null;
  },
  referenceTimeMs: number = Date.now(),
): TimingBreakdown {
  const startDate = alloc.created_at ? new Date(alloc.created_at) : new Date(referenceTimeMs);
  const { lastHarvestDate: parsedHarvest } = parseCopyTierKey(alloc.tier_key);
  const lastHarvestDate = parsedHarvest || startDate;

  const expireDate = alloc.expires_at ? new Date(alloc.expires_at) : null;
  const isExpired = expireDate ? referenceTimeMs >= expireDate.getTime() : false;
  const effectiveEndMs = expireDate
    ? Math.min(referenceTimeMs, expireDate.getTime())
    : referenceTimeMs;

  const elapsedSeconds = Math.max(0, (effectiveEndMs - lastHarvestDate.getTime()) / 1000);
  const elapsedHours = elapsedSeconds / 3600;
  const elapsedDays = elapsedSeconds / 86400;

  const allocated = Number(alloc.allocated_amount) || 0;
  // Copy trading target: approx 0.8% - 1.0% daily ROI (~25% monthly)
  const dailyPayout = allocated * 0.0085;
  const ratePerSecond = dailyPayout / 86400;

  const accruedProfit = Number((elapsedSeconds * ratePerSecond).toFixed(4));
  const storedProfit = Number(alloc.total_profit) || 0;
  const totalProfit = Number(Math.max(accruedProfit, storedProfit).toFixed(2));

  let progressPercent = 0;
  if (expireDate) {
    const totalDurationMs = expireDate.getTime() - startDate.getTime();
    if (totalDurationMs > 0) {
      const activeMs = referenceTimeMs - startDate.getTime();
      progressPercent = Math.min(100, Math.max(0, (activeMs / totalDurationMs) * 100));
    }
  }

  const secSinceHarvest = Math.max(0, (referenceTimeMs - lastHarvestDate.getTime()) / 1000);
  const timeSinceLastHarvestLabel = parsedHarvest
    ? `Harvested ${formatTimeElapsed(secSinceHarvest)}`
    : `Active ${formatTimeElapsed(Math.max(0, (referenceTimeMs - startDate.getTime()) / 1000))}`;

  return {
    elapsedSeconds,
    elapsedHours,
    elapsedDays,
    dailyPayout,
    ratePerSecond,
    accruedProfit,
    totalProfit,
    lastHarvestDate,
    startDate,
    isExpired,
    progressPercent,
    timeSinceLastHarvestLabel,
  };
}
