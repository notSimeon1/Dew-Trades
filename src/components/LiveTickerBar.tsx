import React, { useEffect, useState } from "react";
import { TrendingUp, ArrowUpRight, Flame, Zap, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TickerItem {
  id: string;
  type: "deposit" | "payout" | "swap";
  user: string;
  amount: string;
  asset: string;
  tier?: string;
  time: string;
}

const INITIAL_TICKER_ITEMS: TickerItem[] = [
  {
    id: "1",
    type: "deposit",
    user: "simono***",
    amount: "$5,000",
    asset: "USDT",
    tier: "🐋 Whale VIP",
    time: "Just now",
  },
  { id: "2", type: "payout", user: "walter***", amount: "$2,450", asset: "BTC", time: "1 min ago" },
  {
    id: "3",
    type: "deposit",
    user: "alex_trader***",
    amount: "$1,200",
    asset: "ETH",
    tier: "👑 Gold",
    time: "3 mins ago",
  },
  {
    id: "4",
    type: "swap",
    user: "derek_pro***",
    amount: "$3,800",
    asset: "USDT → SOL",
    time: "4 mins ago",
  },
  {
    id: "5",
    type: "deposit",
    user: "elena_v***",
    amount: "$10,000",
    asset: "USDT",
    tier: "🐋 Whale VIP",
    time: "5 mins ago",
  },
  {
    id: "6",
    type: "payout",
    user: "marco88***",
    amount: "$920",
    asset: "USDT",
    time: "7 mins ago",
  },
];

export const LiveTickerBar: React.FC = () => {
  const [items, setItems] = useState<TickerItem[]>(INITIAL_TICKER_ITEMS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [items.length]);

  // Periodic random live addition to emulate lively global market liquidity
  useEffect(() => {
    const names = [
      "sophia",
      "marcus",
      "kwame",
      "lucas",
      "fatima",
      "zhen",
      "viktor",
      "olivia",
      "mateo",
    ];
    const assets = ["USDT", "BTC", "ETH", "SOL", "BNB"];
    const interval = setInterval(() => {
      const isDeposit = Math.random() > 0.35;
      const name = names[Math.floor(Math.random() * names.length)] + "***";
      const asset = assets[Math.floor(Math.random() * assets.length)];
      const rawAmt = isDeposit
        ? Math.floor(Math.random() * 4500 + 500)
        : Math.floor(Math.random() * 2500 + 300);
      const amount = `$${rawAmt.toLocaleString()}`;

      const newItem: TickerItem = {
        id: String(Date.now()),
        type: isDeposit ? "deposit" : "payout",
        user: name,
        amount,
        asset,
        tier: rawAmt >= 2000 ? (rawAmt >= 5000 ? "🐋 Whale VIP" : "👑 Gold") : undefined,
        time: "Just now",
      };

      setItems((prev) => [newItem, ...prev.slice(0, 11)]);
    }, 14000);
    return () => clearInterval(interval);
  }, []);

  if (dismissed || items.length === 0) return null;

  const current = items[currentIndex];

  return (
    <div className="relative z-40 bg-gradient-to-r from-[#090A0E] via-[#101217] to-[#090A0E] border-b border-amber-500/20 px-3 py-1.5 text-xs select-none">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/30 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            LIVE DESK
          </span>

          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 text-slate-200 truncate"
            >
              {current.type === "deposit" ? (
                <span className="flex items-center gap-1 font-semibold text-amber-400">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-400" /> Settlement:
                </span>
              ) : current.type === "payout" ? (
                <span className="flex items-center gap-1 font-semibold text-amber-300">
                  <ArrowUpRight className="h-3.5 w-3.5 text-amber-300" /> Disbursed:
                </span>
              ) : (
                <span className="flex items-center gap-1 font-semibold text-zinc-300">
                  <Zap className="h-3.5 w-3.5 text-amber-400" /> Order Fill:
                </span>
              )}

              <span className="font-bold text-white">{current.user}</span>
              <span>
                {current.type === "deposit"
                  ? "funded"
                  : current.type === "payout"
                    ? "withdrew"
                    : "executed"}
              </span>
              <span className="font-black text-amber-300 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-500/30">
                {current.amount} ({current.asset})
              </span>

              {current.tier && (
                <span className="rounded-full bg-zinc-800 px-2 py-0.2 text-[10px] text-amber-200 font-extrabold border border-amber-500/20">
                  {current.tier}
                </span>
              )}

              <span className="text-[10px] text-slate-400">({current.time})</span>
            </motion.div>
          </AnimatePresence>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-white p-1 rounded-md transition-colors shrink-0"
          title="Dismiss Live Activity Bar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
