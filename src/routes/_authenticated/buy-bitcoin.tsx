import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Bitcoin,
  Copy,
  Loader as Loader2,
  ArrowLeft,
  CircleCheck as CheckCircle2,
  Upload,
  CloudUpload,
} from "lucide-react";
import { useBinancePrices } from "@/hooks/useBinancePrices";

export const Route = createFileRoute("/_authenticated/buy-bitcoin")({
  component: BuyBitcoinPage,
  head: () => ({
    meta: [
      { title: "Buy Bitcoin — Dew Trades" },
      {
        name: "description",
        content: "Purchase Bitcoin instantly via bank transfer, Zelle, Cash App and more.",
      },
    ],
  }),
});

type Stage = "select" | "generating" | "details";

type PaymentMethod = {
  id: string;
  method_key: string;
  method_name: string;
  identifier_label: string;
  recipient_name: string;
  identifier: string;
  memo_note?: string;
  cash_app_link?: string;
  is_active: boolean;
};

// Fallback methods shown when DB is empty / not yet configured
const FALLBACK_METHODS: PaymentMethod[] = [
  {
    id: "cashapp",
    method_key: "cash_app",
    method_name: "Cash App",
    identifier_label: "$Cashtag",
    recipient_name: "Dew Trades Treasury",
    identifier: "$DewTradesTreasury",
    is_active: true,
  },
  {
    id: "paypal",
    method_key: "paypal",
    method_name: "PayPal",
    identifier_label: "Email",
    recipient_name: "Dew Trades Treasury",
    identifier: "deposits@dewtrades.com",
    is_active: true,
  },
  {
    id: "zelle",
    method_key: "zelle",
    method_name: "Zelle",
    identifier_label: "Phone/Email",
    recipient_name: "Dew Trades Treasury",
    identifier: "deposits@dewtrades.com",
    is_active: true,
  },
  {
    id: "chime",
    method_key: "chime",
    method_name: "Chime",
    identifier_label: "Handle",
    recipient_name: "Dew Trades Treasury",
    identifier: "@dewtradesdeposits",
    is_active: true,
  },
  {
    id: "applepay",
    method_key: "applepay",
    method_name: "Apple Pay",
    identifier_label: "Phone",
    recipient_name: "Dew Trades Treasury",
    identifier: "+1 (800) DEW-TRD",
    is_active: true,
  },
  {
    id: "venmo",
    method_key: "venmo",
    method_name: "Venmo",
    identifier_label: "Handle",
    recipient_name: "Dew Trades Treasury",
    identifier: "@DewTradesTreasury",
    is_active: true,
  },
  {
    id: "bankwire",
    method_key: "bankwire",
    method_name: "Bank Wire",
    identifier_label: "Account No.",
    recipient_name: "Dew Trades Treasury",
    identifier: "7823-4901-0056",
    memo_note: "Include your Dew Trades user ID as the wire memo.",
    is_active: true,
  },
];

// Static fallbacks — overridden by platform_settings at runtime
const DEFAULT_GAS_FEE_PCT = 0.03;
const DEFAULT_MIN_DEPOSIT = 50;
const DEFAULT_EXPIRY_SECONDS = 2 * 60 * 60;

// Step header
function WizardSteps({ stage }: { stage: Stage }) {
  const steps = [
    { id: "select", label: "Select gateway" },
    { id: "generating", label: "Generate" },
    { id: "details", label: "Pay & upload" },
  ];
  const activeIdx = stage === "select" ? 0 : stage === "generating" ? 1 : 2;

  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={s.id} className="flex items-center gap-0 flex-1 last:flex-none">
            <div className="flex items-center gap-2 shrink-0">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                      : "border border-border bg-transparent text-muted-foreground"
                }`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-3 h-px flex-1 transition-colors ${done ? "bg-primary" : "bg-border"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function BuyBitcoinPage() {
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>("select");
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [selected, setSelected] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedPath, setUploadedPath] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_EXPIRY_SECONDS);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("is_suspended")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Load dynamic platform settings (public read, cached 5 min)
  const { data: siteSettings } = useQuery<Record<string, string>>({
    queryKey: ["platform_settings_public"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("key_name, value");
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => {
        const v = r.value;
        map[r.key_name] = typeof v === "number" ? String(v) : String(v).replace(/^"|"$/g, "");
      });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  const GAS_FEE_PCT =
    (parseFloat(siteSettings?.gas_fee_percent ?? "") || DEFAULT_GAS_FEE_PCT * 100) / 100;
  const MIN_DEPOSIT = parseFloat(siteSettings?.min_deposit_usd ?? "") || DEFAULT_MIN_DEPOSIT;
  const EXPIRY_SECONDS = Math.floor(
    (parseFloat(siteSettings?.payment_expiry_hours ?? "") || DEFAULT_EXPIRY_SECONDS / 3600) * 3600,
  );

  // Load payment methods from DB (synchronized with app_settings)
  const loadPaymentMethods = useCallback(async () => {
    try {
      const [{ data: methodsData }, { data: settingsData }] = await Promise.all([
        supabase
          .from("admin_payment_methods")
          .select("*")
          .eq("is_active", true)
          .order("sort_order" as never),
        supabase.from("app_settings").select("key, value"),
      ]);

      const settingsMap = new Map((settingsData ?? []).map((s: any) => [s.key, s.value]));
      const rawList =
        methodsData && methodsData.length > 0 ? (methodsData as PaymentMethod[]) : FALLBACK_METHODS;

      const list = rawList.map((m) => {
        let updatedIdentifier = m.identifier;
        let updatedCashAppLink = m.cash_app_link;

        if (m.method_key === "btc" && settingsMap.has("deposit_wallet_btc")) {
          updatedIdentifier = settingsMap.get("deposit_wallet_btc")!;
        } else if (m.method_key === "eth" && settingsMap.has("deposit_wallet_eth")) {
          updatedIdentifier = settingsMap.get("deposit_wallet_eth")!;
        } else if (m.method_key === "usdt_trc20" && settingsMap.has("deposit_wallet_usdt_trc20")) {
          updatedIdentifier = settingsMap.get("deposit_wallet_usdt_trc20")!;
        } else if (
          (m.method_key === "cashapp" || m.method_key === "cash_app") &&
          settingsMap.has("payment_method_cashapp")
        ) {
          updatedIdentifier = settingsMap.get("payment_method_cashapp")!;
          const clean = updatedIdentifier.trim().replace(/^\$+/, "");
          updatedCashAppLink = clean ? `https://cash.app/$${clean}` : null;
        } else if (m.method_key === "paypal" && settingsMap.has("payment_method_paypal")) {
          updatedIdentifier = settingsMap.get("payment_method_paypal")!;
        } else if (m.method_key === "zelle" && settingsMap.has("payment_method_zelle")) {
          updatedIdentifier = settingsMap.get("payment_method_zelle")!;
        } else if (m.method_key === "bankwire" && settingsMap.has("payment_method_bankwire")) {
          updatedIdentifier = settingsMap.get("payment_method_bankwire")!;
        }

        return {
          ...m,
          identifier: updatedIdentifier,
          cash_app_link: updatedCashAppLink,
        };
      });

      setMethods(list);
      setSelected((prev) => (prev ? list.find((item) => item.id === prev.id) || prev : null));
    } catch {
      setMethods(FALLBACK_METHODS);
    } finally {
      setLoadingMethods(false);
    }
  }, []);

  useEffect(() => {
    loadPaymentMethods();
    const ch = supabase
      .channel("dewtrades-buy-btc-realtime")
      .on("broadcast", { event: "admin-ops-update" }, () => loadPaymentMethods())
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () =>
        loadPaymentMethods(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_payment_methods" },
        () => loadPaymentMethods(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [loadPaymentMethods]);

  // Countdown timer — only ticks once payment details are shown
  useEffect(() => {
    if (stage !== "details") return;
    setSecondsLeft(EXPIRY_SECONDS); // uses dynamic value once siteSettings loaded
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const countdown = useMemo(() => {
    const h = String(Math.floor(secondsLeft / 3600)).padStart(2, "0");
    const m = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, "0");
    const s = String(secondsLeft % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [secondsLeft]);

  const base = parseFloat(amount) || 0;
  const gas = +(base * GAS_FEE_PCT).toFixed(2);
  const total = +(base + gas).toFixed(2);

  const { tickers } = useBinancePrices(["BTCUSDT"]);
  const btcPrice = tickers["BTCUSDT"]?.price ?? 0;
  const btcAmount = btcPrice > 0 ? total / btcPrice : 0;

  // When a method card is clicked → go to generating stage
  const pickMethod = (m: PaymentMethod) => {
    if (base < MIN_DEPOSIT) {
      toast.error(`Enter a minimum amount of $${MIN_DEPOSIT} first`);
      return;
    }
    setSelected(m);
    setStage("generating");
    // Auto-advance to details after 3s
    setTimeout(() => setStage("details"), 3000);
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"));
  };

  const handleFileChange = async (file: File) => {
    if (!user) return;
    setUploading(true);
    setReceipt(file);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/${Date.now()}.${ext}`;

      let urlToUse: string | null = null;
      const { error: err1 } = await supabase.storage
        .from("deposit-receipts")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (!err1) {
        urlToUse = path;
      } else {
        const { error: err2 } = await supabase.storage
          .from("support_attachments")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (!err2) {
          urlToUse = path;
        } else {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          urlToUse = base64;
        }
      }

      setUploadedPath(urlToUse);
      toast.success("Receipt uploaded successfully");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
      setReceipt(null);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!user || !selected) return;
    if (!uploadedPath) return toast.error("Upload your payment receipt first");
    setSubmitting(true);
    try {
      const { error } = await supabase.from("deposits").insert({
        user_id: user.id,
        amount: total,
        base_amount: base,
        gas_fee_amount: gas,
        total_payable: total,
        crypto_currency: "BTC",
        payment_method: selected.method_name,
        payment_method_key: selected.method_key,
        receipt_url: uploadedPath,
        status: "pending",
        expires_at: new Date(Date.now() + secondsLeft * 1000).toISOString(),
      });
      if (error) throw error;

      const { error: txError } = await supabase.from("transactions").insert({
        user_id: user.id,
        type: "deposit_request",
        amount: total,
        asset_name: `Buy BTC via ${selected.method_name} — ${total.toFixed(2)}`,
        status: "pending",
      });
      if (txError) console.error("[buy-btc] transaction insert failed:", txError.message);

      toast.success("Deposit request submitted — you will be notified once verified");
      // Reset
      setStage("select");
      setSelected(null);
      setAmount("");
      setReceipt(null);
      setUploadedPath("");
    } catch (err: any) {
      toast.error(err.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-2 pb-12">
      {/* Page title */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-yellow-400 shadow-lg">
          <Bitcoin className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Buy Bitcoin</h1>
          <p className="text-xs text-muted-foreground">
            Instant fiat-to-BTC via your preferred payment method
          </p>
        </div>
      </div>

      {/* Wizard step bar */}
      <WizardSteps stage={stage} />

      <AnimatePresence mode="wait">
        {/* ── STAGE 1: SELECT GATEWAY ── */}
        {stage === "select" && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            {/* Amount input */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <Label className="text-sm font-semibold">Amount (USD)</Label>
              <Input
                type="number"
                min={50}
                step="1"
                placeholder="Enter amount e.g. 500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-lg h-12"
              />
              {base > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">
                    Base ${base.toFixed(2)} + Fee (3%) ${gas.toFixed(2)}
                  </span>
                  <span className="font-bold text-primary">${total.toFixed(2)} total</span>
                </div>
              )}
              {base > 0 && btcPrice > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Bitcoin className="h-4 w-4 text-yellow-500" />
                    You will be getting
                  </span>
                  <span className="font-bold text-lg tabular-nums" style={{ color: "#d4a017" }}>
                    {btcAmount.toFixed(7)} BTC
                  </span>
                </div>
              )}
              {base > 0 && btcPrice > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  1 BTC = ${btcPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })} · Rate
                  updates every 30s
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Minimum $50 · 3% network processing fee applies
              </p>
            </div>

            {/* Payment method grid */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Select payment method</h2>
              {loadingMethods ? (
                <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading methods…
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {methods.map((m) => (
                    <motion.button
                      key={m.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => pickMethod(m)}
                      className="flex items-center justify-start rounded-xl border border-border bg-background/40 px-4 py-4 text-left text-sm font-semibold text-foreground transition-colors hover:border-primary/60 hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      {m.method_name}
                    </motion.button>
                  ))}
                </div>
              )}
              <p className="text-center text-xs text-muted-foreground pt-1">
                Select a payment method to view details and complete your purchase.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── STAGE 2: GENERATING ── */}
        {stage === "generating" && (
          <motion.div
            key="generating"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="flex min-h-[55vh] flex-col items-center justify-center space-y-6 text-center"
          >
            {/* Bitcoin logo with gradient glow */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-blue-500/25 blur-2xl scale-150 animate-pulse" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-yellow-400 shadow-[0_0_40px_rgba(59,130,246,0.5)]">
                <Bitcoin className="h-12 w-12 text-white drop-shadow" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight">
                Generating secure payment gateway…
              </h2>
              <p className="text-sm text-muted-foreground">
                Encrypting your session and preparing verified merchants.
              </p>
            </div>

            {/* Glowing animated progress bar */}
            <div className="relative mx-auto w-72 h-1 rounded-full bg-border overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: "linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6)",
                  boxShadow: "0 0 12px 2px rgba(96,165,250,0.7)",
                }}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.8, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        )}

        {/* ── STAGE 3: PAYMENT DETAILS + UPLOAD ── */}
        {stage === "details" && selected && (
          <motion.div
            key="details"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Payment instructions card — gold border */}
            <div
              className="rounded-2xl border border-yellow-500/40 bg-card p-5 space-y-4"
              style={{
                boxShadow: "0 0 0 1px rgba(234,179,8,0.15), 0 4px 24px rgba(234,179,8,0.05)",
              }}
            >
              {/* Amount + Countdown header */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Send exactly</p>
                  <p className="text-2xl font-bold" style={{ color: "#d4a017" }}>
                    $
                    {total.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400">
                  <span>Expires in</span>
                  <span className="font-mono">{countdown}</span>
                </div>
              </div>

              <div className="border-t border-border/60 pt-3 space-y-2.5">
                <InfoRow label="Payment method" value={selected.method_name} onCopy={copy} />
                <InfoRow label="Recipient name" value={selected.recipient_name} onCopy={copy} />
                <InfoRow
                  label={selected.identifier_label}
                  value={selected.identifier}
                  onCopy={copy}
                />
                {selected.cash_app_link && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Cash App Link</span>
                    <a
                      href={selected.cash_app_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary hover:underline"
                    >
                      Open Cash App
                    </a>
                  </div>
                )}
                <InfoRow label="Amount to send" value={`${total.toFixed(2)} USD`} onCopy={copy} />
                {btcPrice > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Bitcoin className="h-3 w-3 text-yellow-500" />
                        You will be getting
                      </p>
                      <p className="text-sm font-bold tabular-nums" style={{ color: "#d4a017" }}>
                        {btcAmount.toFixed(7)} BTC
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-right">
                      1 BTC = ${btcPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                )}
              </div>

              {selected.memo_note && (
                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-2.5 text-xs text-muted-foreground">
                  📝 {selected.memo_note}
                </div>
              )}
              {!selected.memo_note && (
                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-2.5 text-xs text-muted-foreground">
                  📝 Include your Dew Trades account email as the payment memo/note so we can match
                  your deposit instantly.
                </div>
              )}
            </div>

            {/* Receipt upload card */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div>
                <Label className="text-sm font-semibold">
                  Payment receipt <span className="text-red-500">*</span>
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Upload a screenshot of your payment. Required before submission — we will verify
                  and credit your wallet.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileChange(f);
                }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={`flex w-full items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 text-sm transition-colors focus:outline-none ${
                  receipt
                    ? "border-primary/50 bg-primary/5 text-primary"
                    : "border-border bg-background/30 text-muted-foreground hover:border-primary/40 hover:bg-accent/20"
                }`}
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                ) : receipt ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                ) : (
                  <CloudUpload className="h-5 w-5 shrink-0" />
                )}
                <span className="truncate">
                  {uploading
                    ? "Uploading…"
                    : receipt
                      ? receipt.name
                      : "Choose File   No file chosen"}
                </span>
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => {
                  setStage("select");
                  setSelected(null);
                  setReceipt(null);
                  setUploadedPath("");
                }}
                className="flex-none"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={submit}
                disabled={submitting || uploading || !uploadedPath}
                className="flex-1 h-11 text-sm font-semibold"
                style={{
                  background: "linear-gradient(135deg, #d4a017, #f5c842)",
                  color: "#1a1a1a",
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" /> Submit deposit request
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold truncate">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => onCopy(value)}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
