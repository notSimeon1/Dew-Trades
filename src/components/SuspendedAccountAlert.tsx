import { AlertTriangle, MessageSquare, ShieldAlert, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuspendedAccountAlertProps {
  compact?: boolean;
}

export function SuspendedAccountAlert({ compact = false }: SuspendedAccountAlertProps) {
  const openChat = () => {
    window.dispatchEvent(new CustomEvent("open-support-chat"));
  };

  if (compact) {
    return (
      <div className="mb-4 rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-950/90 via-red-900/80 to-slate-950 p-3.5 shadow-lg shadow-rose-950/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                <span>Account Suspended</span>
                <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[10px] text-rose-300 font-bold">
                  ACTION REQUIRED
                </span>
              </div>
              <p className="text-xs text-rose-100/90 mt-0.5">
                Order execution and withdrawals are temporarily locked. If you believe this is a
                mistake, please contact customer support.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={openChat}
            className="shrink-0 bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md shadow-rose-600/30 text-xs"
          >
            <Headphones className="mr-1.5 h-3.5 w-3.5" />
            Contact Support
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-rose-500/50 bg-gradient-to-br from-rose-950 via-slate-950 to-red-950 p-5 sm:p-6 shadow-2xl shadow-rose-950/50">
      <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-rose-500/10 blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-inner animate-pulse">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-white uppercase tracking-wider">
                🚨 Account Temporarily Suspended
              </span>
              <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[11px] font-extrabold text-rose-300 border border-rose-500/30">
                Restricted Status
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-3xl">
              Your trading account is currently suspended. While suspended, active order execution,
              AI trading bots, and withdrawals are locked. Deposits and purchasing crypto remain
              available.
            </p>
            <p className="text-xs text-rose-300 font-medium pt-1">
              If you believe this suspension was made in error or wish to restore full trading
              access, please get in touch with our Customer Support desk right away.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
          <Button
            onClick={openChat}
            className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold shadow-lg shadow-rose-600/30 px-5 py-2.5 text-xs uppercase tracking-wider"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Contact Support Now
          </Button>
        </div>
      </div>
    </div>
  );
}
