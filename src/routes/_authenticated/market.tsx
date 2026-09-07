import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Wifi,
  WifiOff,
  Loader2,
  Search,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { useBinancePrices } from "@/hooks/useBinancePrices";
import { useAuth } from "@/lib/auth-context";
import { useAccountMode } from "@/lib/account-mode-context";
import { useCurrency } from "@/lib/currency-context";
import { openPosition } from "@/lib/admin.functions";
import { CryptoIcon } from "@/components/CryptoIcon";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/market")({
  component: Market,
});

const SYMBOLS = [
  "XRPUSDT",
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "MATICUSDT",
  "LTCUSDT",
  "DOTUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "UNIUSDT",
  "SHIBUSDT",
  "MNTUSDT",
  "TRXUSDT",
  "NEARUSDT",
  "FTMUSDT",
  "SANDUSDT",
  "MANAUSDT",
];

const LABEL: Record<string, string> = {
  BTCUSDT: "Bitcoin",
  ETHUSDT: "Ethereum",
  BNBUSDT: "BNB",
  SOLUSDT: "Solana",
  XRPUSDT: "XRP",
  ADAUSDT: "Cardano",
  DOGEUSDT: "Dogecoin",
  MATICUSDT: "Polygon",
  LTCUSDT: "Litecoin",
  DOTUSDT: "Polkadot",
  AVAXUSDT: "Avalanche",
  LINKUSDT: "Chainlink",
  UNIUSDT: "Uniswap",
  SHIBUSDT: "Shiba Inu",
  MNTUSDT: "Mantle",
  TRXUSDT: "TRON",
  NEARUSDT: "NEAR Protocol",
  FTMUSDT: "Fantom",
  SANDUSDT: "The Sandbox",
  MANAUSDT: "Decentraland",
};

function ticker(sym: string) {
  return sym.replace("USDT", "");
}

function Market() {
  const { tickers, status } = useBinancePrices(SYMBOLS);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SYMBOLS;
    return SYMBOLS.filter(
      (s) => s.toLowerCase().includes(q) || (LABEL[s] ?? "").toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Buy / Sell & Invest</h1>
          <p className="text-sm text-muted-foreground">
            Real-time market prices. Invest in top crypto assets directly with a minimum of $300.
          </p>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search asset (BTC, Ethereum…)"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">No assets match your search.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((sym) => {
            const t = tickers[sym];
            return <CoinCard key={sym} sym={sym} ticker={t} />;
          })}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: "connecting" | "live" | "error" }) {
  if (status === "live")
    return (
      <Badge className="gap-1.5 bg-success/20 text-success border-success/30">
        <Wifi className="h-3 w-3" /> Live
      </Badge>
    );
  if (status === "error")
    return (
      <Badge variant="outline" className="gap-1.5 text-muted-foreground">
        <WifiOff className="h-3 w-3" /> Reconnecting…
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1.5 text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" /> Connecting…
    </Badge>
  );
}

function CoinCard({ sym, ticker: t }: { sym: string; ticker: any }) {
  const { user } = useAuth();
  const { mode, balance } = useAccountMode();
  const { formatPrice } = useCurrency();
  const qc = useQueryClient();
  const openPositionFn = useServerFn(openPosition);

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("300");
  const [leverage, setLeverage] = useState("10");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [busy, setBusy] = useState(false);

  const pct = t ? Number(t.change) : 0;
  const positive = pct > 0;
  const zero = pct === 0 || !t;
  const currentPrice = t ? Number(t.price) : 0;

  const handleInvest = async () => {
    if (!user) return toast.error("Please sign in first");
    const margin = Number(amount);
    const lev = Math.max(1, Math.min(100, Number(leverage)));
    if (!margin || margin < 300) return toast.error("Minimum investment amount is $300");
    if (margin > balance) return toast.error("Insufficient balance");
    if (currentPrice <= 0) return toast.error("Waiting for live price…");

    setBusy(true);
    try {
      const assetTicker = ticker(sym);
      const qty = (margin * lev) / currentPrice;
      await openPositionFn({
        data: {
          asset: assetTicker,
          side,
          quantity: qty,
          leverage: lev,
          margin,
          entryPrice: currentPrice,
          accountMode: mode,
        },
      });
      toast.success(`Successfully invested $${margin} in ${assetTicker} (${side.toUpperCase()})`);
      qc.invalidateQueries({ queryKey: ["positions"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to invest");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 transition-shadow hover:shadow-md flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <CryptoIcon symbol={ticker(sym)} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold">{ticker(sym)}</span>
                <span className="text-[10px] text-muted-foreground font-medium">USDT</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{LABEL[sym] ?? sym}</p>
            </div>
          </div>
          {zero ? (
            <Minus className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
          ) : positive ? (
            <ArrowUpRight className="mt-0.5 h-4 w-4 text-success shrink-0" />
          ) : (
            <ArrowDownRight className="mt-0.5 h-4 w-4 text-destructive shrink-0" />
          )}
        </div>

        <div className="mt-3">
          {t ? (
            <>
              <div className="text-xl font-bold tabular-nums">{formatPrice(Number(t.price))}</div>
              <div
                className={`mt-0.5 text-sm font-medium tabular-nums ${positive ? "text-success" : zero ? "text-muted-foreground" : "text-destructive"}`}
              >
                {positive ? "+" : ""}
                {pct.toFixed(2)}%
              </div>
            </>
          ) : (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/60">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-gradient-hero text-white font-semibold h-9 text-xs">
              <TrendingUp className="mr-1.5 h-3.5 w-3.5" /> Invest in {ticker(sym)}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-amber-400" />
                Invest in {LABEL[sym] ?? ticker(sym)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="rounded-xl bg-surface p-3 border border-border/60 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Live Price:</span>
                  <span className="font-bold tabular-nums">
                    ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available Balance:</span>
                  <span className="font-bold tabular-nums">
                    ${balance.toFixed(2)} ({mode.toUpperCase()})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={side === "buy" ? "default" : "outline"}
                  onClick={() => setSide("buy")}
                  className={side === "buy" ? "bg-success text-success-foreground font-bold" : ""}
                >
                  BUY (Long)
                </Button>
                <Button
                  type="button"
                  variant={side === "sell" ? "default" : "outline"}
                  onClick={() => setSide("sell")}
                  className={
                    side === "sell" ? "bg-destructive text-destructive-foreground font-bold" : ""
                  }
                >
                  SELL (Short)
                </Button>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <Label className="font-semibold">Investment Amount (USD)</Label>
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
                  placeholder="300"
                />
              </div>

              <div className="space-y-1.5">
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
                onClick={handleInvest}
                disabled={busy || currentPrice <= 0}
                className="w-full bg-gradient-hero text-white font-bold h-11"
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Investment (${Number(amount) || 300})
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}
