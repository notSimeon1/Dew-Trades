import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Bot,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ArrowUpRight,
  Zap,
} from "lucide-react";
import { soundFX } from "@/lib/sound-engine";

export interface GoldSuccessDetails {
  type: "bot" | "staking" | "copy";
  title: string;
  subtitle?: string;
  tierName?: string;
  amount: number;
  currency?: string;
  dailyRoi?: number | string;
  durationDays?: number | string;
  txHash?: string;
}

interface InstitutionalGoldSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: GoldSuccessDetails | null;
  onViewActive?: () => void;
}

export const InstitutionalGoldSuccessModal: React.FC<InstitutionalGoldSuccessModalProps> = ({
  open,
  onOpenChange,
  details,
  onViewActive,
}) => {
  useEffect(() => {
    if (open) {
      try {
        soundFX.playTradeSuccess();
        soundFX.triggerHaptic(60);
      } catch {
        // audio might be restricted by browser policy
      }
    }
  }, [open]);

  if (!details) return null;

  const isBot = details.type === "bot";
  const currency = details.currency || "USD";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-amber-500/40 bg-[#0c0d12]/95 backdrop-blur-2xl shadow-[0_0_50px_rgba(245,158,11,0.25)] text-foreground">
        {/* Subtle Ambient Gold Gradient Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-gradient-to-br from-amber-400/20 via-yellow-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-20 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl" />
          {/* Subtle gold grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, #f59e0b 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          />
        </div>

        <div className="relative p-6 space-y-6 text-center">
          {/* Gold Glowing Icon with concentric expanding rings */}
          <div className="relative mx-auto flex items-center justify-center w-24 h-24">
            {/* Outer expanding gold rings */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [0.8, 1.25, 1.1], opacity: [0.8, 0.2, 0.4] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full border border-amber-400/40 bg-amber-500/10"
            />
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: [0.9, 1.4, 1.2], opacity: [0.5, 0.1, 0.2] }}
              transition={{ repeat: Infinity, duration: 3, delay: 0.4, ease: "easeInOut" }}
              className="absolute -inset-2 rounded-full border border-yellow-500/30"
            />

            {/* Inner Core Circle */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 14, stiffness: 200 }}
              className="relative z-10 flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-300 text-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.6)]"
            >
              {isBot ? (
                <Bot className="w-8 h-8 stroke-[2.5]" />
              ) : (
                <TrendingUp className="w-8 h-8 stroke-[2.5]" />
              )}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.25, type: "spring" }}
                className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white border-2 border-[#0c0d12] shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
              </motion.div>
            </motion.div>
          </div>

          {/* Heading & Subheading */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-amber-400/90">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Institutional Execution Initiated</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {details.title}
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              {details.subtitle ||
                (isBot
                  ? "Neural algorithmic routing deployed. Second-by-second yield accrual has commenced."
                  : "Copy staking protocol activated. Position mirror synchronization is live.")}
            </p>
          </div>

          {/* Capital & ROI Highlight Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 via-amber-950/20 to-black/40 p-4 space-y-3 shadow-inner"
          >
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5 text-xs">
              <span className="text-slate-400 font-medium">Allocated Capital:</span>
              <span className="text-base font-extrabold text-amber-300 font-mono">
                $
                {details.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                {currency}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-left">
              {details.dailyRoi && (
                <div className="rounded-lg bg-black/40 border border-amber-500/20 p-2 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Daily Return
                  </span>
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>
                      +
                      {typeof details.dailyRoi === "number"
                        ? details.dailyRoi.toFixed(2)
                        : details.dailyRoi}
                      % / day
                    </span>
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-black/40 border border-amber-500/20 p-2 space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Lock-In Period
                </span>
                <div className="text-xs font-bold text-amber-200">
                  {details.durationDays ? `${details.durationDays} Days` : "10 Days"}
                </div>
              </div>
            </div>

            {details.tierName && (
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Selected Tier:</span>
                <Badge
                  variant="outline"
                  className="border-amber-400/40 bg-amber-400/10 text-amber-300 text-[10px] font-bold"
                >
                  {details.tierName}
                </Badge>
              </div>
            )}
          </motion.div>

          {/* Institutional Compliance Seal */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Vault Hedged & Real-time Ledger Protected</span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            {onViewActive && (
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onViewActive();
                }}
                className="flex-1 border-amber-500/40 hover:bg-amber-500/10 text-amber-300 font-semibold text-xs h-9"
              >
                View Active Allocations
              </Button>
            )}
            <Button
              onClick={() => onOpenChange(false)}
              className="flex-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-600 hover:to-amber-600 text-slate-950 font-bold text-xs h-9 shadow-md shadow-amber-500/20"
            >
              Continue Trading <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
