import React from "react";
import { Crown, Zap, Flame, ShieldCheck } from "lucide-react";

export type VipTier = "Bronze" | "Silver" | "Gold" | "Whale" | "Standard";

export function getVipTier(balanceOrDeposit: number): VipTier {
  if (balanceOrDeposit >= 5000) return "Whale";
  if (balanceOrDeposit >= 2000) return "Gold";
  if (balanceOrDeposit >= 500) return "Silver";
  if (balanceOrDeposit >= 100) return "Bronze";
  return "Standard";
}

interface VipBadgeProps {
  tier?: VipTier;
  amount?: number;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const VipBadge: React.FC<VipBadgeProps> = ({
  tier: propTier,
  amount = 0,
  showText = true,
  size = "md",
  className = "",
}) => {
  const tier = propTier || getVipTier(amount);

  if (tier === "Standard") return null;

  const sizeClasses = {
    sm: "px-1.5 py-0.2 text-[9px] gap-1",
    md: "px-2 py-0.5 text-[10px] gap-1.5",
    lg: "px-2.5 py-1 text-xs gap-1.5 font-bold",
  }[size];

  const tierStyles = {
    Whale: {
      bg: "bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white border-purple-400/50 shadow-purple-500/20",
      icon: <Flame className="h-3 w-3 animate-pulse text-amber-300" />,
      label: "WHALE VIP 🐋",
    },
    Gold: {
      bg: "bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-extrabold border-yellow-300/80 shadow-yellow-500/30",
      icon: <Crown className="h-3 w-3 text-black fill-black" />,
      label: "VIP GOLD 👑",
    },
    Silver: {
      bg: "bg-gradient-to-r from-slate-400 to-slate-200 text-slate-950 font-bold border-slate-300 shadow-slate-400/20",
      icon: <Zap className="h-3 w-3 text-slate-900" />,
      label: "SILVER 🥈",
    },
    Bronze: {
      bg: "bg-gradient-to-r from-amber-800 to-amber-600 text-amber-100 font-bold border-amber-700/50",
      icon: <ShieldCheck className="h-3 w-3 text-amber-300" />,
      label: "BRONZE 🥉",
    },
  }[tier];

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-sm font-sans tracking-wide select-none ${tierStyles.bg} ${sizeClasses} ${className}`}
    >
      {tierStyles.icon}
      {showText && <span>{tierStyles.label}</span>}
    </span>
  );
};
