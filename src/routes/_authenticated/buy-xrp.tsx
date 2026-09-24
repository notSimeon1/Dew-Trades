import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useBinancePrices } from "@/hooks/useBinancePrices";
import { soundFX } from "@/lib/sound-engine";
import { CryptoIcon } from "@/components/CryptoIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Check,
  CircleCheck as CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Shield,
  Upload,
  CloudUpload,
  Sparkles,
  Zap,
  Flame,
  TrendingUp,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/_authenticated/buy-xrp")({
  component: BuyXrpPage,
  head: () => ({
    meta: [
      { title: "Buy XRP — Dew Trades" },
      {
        name: "description",
        content:
          "Instant fiat-to-XRP purchase with institutional Ripple liquidity and 0% gas fees.",
      },
    ],
  }),
});

interface PaymentMethod {
  id: string;
  method_name: string;
  method_key: string;
  recipient_name: string;
  identifier_label: string;
  identifier: string;
  cash_app_link: string | null;
  memo_note: string | null;
  sort_order: number;
}

const FALLBACK_METHODS: PaymentMethod[] = [
  {
    id: "cash_app",
    method_name: "Cash App",
    method_key: "cash_app",
    recipient_name: "Dew Trades Desk",
    identifier_label: "Cashtag",
    identifier: "$DewTrades",
    cash_app_link: "https://cash.app/$DewTrades",
    memo_note: "Include your account email in the Cash App note.",
    sort_order: 1,
  },
  {
    id: "paypal",
    method_name: "PayPal",
    method_key: "paypal",
    recipient_name: "Dew Trades Billing",
    identifier_label: "PayPal Email",
    identifier: "pay@dewtrades.com",
    cash_app_link: null,
    memo_note: "Send via Friends & Family to prevent delay.",
    sort_order: 2,
  },
  {
    id: "zelle",
    method_name: "Zelle",
    method_key: "zelle",
    recipient_name: "Dew Trades Settlement",
    identifier_label: "Zelle Email / Phone",
    identifier: "settlement@dewtrades.com",
    cash_app_link: null,
    memo_note: "Use your registration email as reference.",
    sort_order: 3,
  },
  {
    id: "chime",
    method_name: "Chime",
    method_key: "chime",
    recipient_name: "Dew Trades LLC",
    identifier_label: "Chime Tag",
    identifier: "$DewTradesLLC",
    cash_app_link: null,
    memo_note: "Add your user ID or email.",
    sort_order: 4,
  },
  {
    id: "apple_pay",
    method_name: "Apple Pay",
    method_key: "apple_pay",
    recipient_name: "Dew Trades Desk",
    identifier_label: "Apple Pay Contact",
    identifier: "applepay@dewtrades.com",
    cash_app_link: null,
    memo_note: "Direct iMessage / Apple Cash transfer.",
    sort_order: 5,
  },
  {
    id: "venmo",
    method_name: "Venmo",
    method_key: "venmo",
    recipient_name: "Dew Trades LLC",
    identifier_label: "Venmo Username",
    identifier: "@DewTrades",
    cash_app_link: null,
    memo_note: "Turn off purchase protection to avoid fees.",
    sort_order: 6,
  },
  {
    id: "bank_wire",
    method_name: "Bank Wire / ACH",
    method_key: "bank_wire",
    recipient_name: "Dew Trades Global Custody",
    identifier_label: "Routing / Account",
    identifier: "Routing: 021000021 | Acc: 9874102938",
    cash_app_link: null,
    memo_note: "Same-day Fedwire or domestic ACH transfer.",
    sort_order: 7,
  },
  {
    id: "card",
    method_name: "Credit / Debit Card",
    method_key: "card",
    recipient_name: "Simplex / MoonPay Gateway",
    identifier_label: "Direct Card Processor",
    identifier: "Instant 3D-Secure Processing",
    cash_app_link: null,
    memo_note: "Instant approval for Visa / Mastercard.",
    sort_order: 8,
  },
];

type Stage = "select" | "generating" | "details";

const DEFAULT_EXPIRY_SECONDS = 7200; // 2 hours
const DEFAULT_GAS_FEE_PCT = 0.02; // 2% special discount for XRP purchases!
const DEFAULT_MIN_DEPOSIT = 30; // lower minimum for XRP

function WizardSteps({ stage }: { stage: Stage }) {
  const steps = [
    { id: "select", label: "Select Gateway" },
    { id: "generating", label: "Generating Gateway" },
    { id: "details", label: "Pay & Upload Receipt" },
  ];
  const order: Stage[] = ["select", "generating", "details"];
  const currentIdx = order.indexOf(stage);

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-4 py-3">
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  done
                    ? "bg-sky-500 text-white"
                    : active
                      ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-3 h-px flex-1 transition-colors ${done ? "bg-sky-500" : "bg-border"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function BuyXrpPage() {
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
        } else if (m.method_key === "xrp" && settingsMap.has("deposit_wallet_xrp")) {
          updatedIdentifier = settingsMap.get("deposit_wallet_xrp")!;
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
      .channel("dewtrades-buy-xrp-realtime")
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
    setSecondsLeft(EXPIRY_SECONDS);
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [stage, EXPIRY_SECONDS]);

  const countdown = useMemo(() => {
    const h = String(Math.floor(secondsLeft / 3600)).padStart(2, "0");
    const m = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, "0");
    const s = String(secondsLeft % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [secondsLeft]);

  const base = parseFloat(amount) || 0;
  const gas = +(base * GAS_FEE_PCT).toFixed(2);
  const total = +(base + gas).toFixed(2);

  const { tickers } = useBinancePrices(["XRPUSDT"]);
  const xrpPrice = tickers["XRPUSDT"]?.price ?? 2.85;
  const xrpAmount = xrpPrice > 0 ? total / xrpPrice : 0;

  // When a method card is clicked → go to generating stage
  const pickMethod = (m: PaymentMethod) => {
    if (base < MIN_DEPOSIT) {
      toast.error(`Enter a minimum amount of $${MIN_DEPOSIT} first`);
      return;
    }
    soundFX.playClick();
    setSelected(m);
    setStage("generating");
    // Auto-advance to details after 2.8s
    setTimeout(() => {
      setStage("details");
      soundFX.playSuccess();
    }, 2800);
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      soundFX.playClick();
      toast.success("Copied to clipboard");
    });
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
      soundFX.playSuccess();
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
        crypto_currency: "XRP",
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
        asset_name: `Buy XRP via ${selected.method_name} — ${total.toFixed(2)}`,
        status: "pending",
      });
      if (txError) console.error("[buy-xrp] transaction insert failed:", txError.message);

      soundFX.playDepositBonus();
      toast.success(
        "XRP purchase request submitted — your wallet will be credited upon confirmation!",
      );
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
      {/* XRP Institutional Moonshot Banner with Requested Quote */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-sky-500/40 bg-gradient-to-br from-sky-950/70 via-slate-900 to-[#071324] p-5 shadow-glow shadow-sky-500/10"
      >
        <div className="absolute right-0 top-0 -mt-8 -mr-8 h-40 w-40 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/40 bg-sky-500/10 shadow-md shadow-sky-500/20">
              <CryptoIcon symbol="XRP" size="md" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-sky-500 text-slate-950 font-black text-[10px] tracking-wider uppercase">
                  ⭐ Primary Broker Asset
                </Badge>
                <Badge variant="outline" className="border-sky-400/50 text-sky-300 text-[10px]">
                  Targeting $50+ Moonshot
                </Badge>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight mt-1 flex items-center gap-1.5">
                "XRP is the new bitcoin"
              </h2>
              <p className="text-xs text-sky-200/80">
                Institutional XRPL liquidity hub · 3-5 sec settlement · 0% gas fee promo
              </p>
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-sky-500/20 pt-3 sm:pt-0">
            <span className="text-[11px] text-sky-300 font-medium">Live XRP / USD</span>
            <div className="text-base font-extrabold text-white tabular-nums flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-emerald-400" />$
              {xrpPrice > 0 ? xrpPrice.toFixed(4) : "2.8500"}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Page title */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-lg shadow-sky-500/20">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Buy XRP</h1>
            <p className="text-xs text-muted-foreground">
              Instant fiat-to-XRP via all major payment gateways
            </p>
          </div>
        </div>

        <Badge
          variant="secondary"
          className="flex items-center gap-1 text-xs py-1 px-3 border border-sky-400/30"
        >
          <Flame className="h-3.5 w-3.5 text-amber-400" /> High Inflow
        </Badge>
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
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Amount (USD)</Label>
                <span className="text-xs text-sky-400 font-medium">Min ${MIN_DEPOSIT}</span>
              </div>
              <Input
                type="number"
                min={MIN_DEPOSIT}
                step="1"
                placeholder="Enter amount e.g. 500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-lg h-12 border-sky-500/20 focus-visible:border-sky-500"
              />

              {/* Quick Amount presets */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {["100", "250", "500", "1000"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      soundFX.playClick();
                      setAmount(preset);
                    }}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-all ${
                      amount === preset
                        ? "border-sky-500 bg-sky-500/20 text-sky-300 shadow-sm"
                        : "border-border bg-background/50 hover:bg-accent/40 text-muted-foreground"
                    }`}
                  >
                    ${preset}
                  </button>
                ))}
              </div>

              {base > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">
                    Base ${base.toFixed(2)} + Fee ({(GAS_FEE_PCT * 100).toFixed(0)}%) $
                    {gas.toFixed(2)}
                  </span>
                  <span className="font-bold text-sky-400">${total.toFixed(2)} total</span>
                </div>
              )}

              {base > 0 && xrpPrice > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 shadow-inner">
                  <span className="flex items-center gap-2 text-sm text-sky-200">
                    <CryptoIcon symbol="XRP" size="xs" />
                    You will receive estimated
                  </span>
                  <span className="font-bold text-lg tabular-nums text-sky-300">
                    {xrpAmount.toFixed(4)} XRP
                  </span>
                </div>
              )}

              {base > 0 && xrpPrice > 0 && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>1 XRP = ${xrpPrice.toFixed(4)} USD</span>
                  <span className="text-emerald-400 font-medium">
                    ✨ Target: $50.00+ (+{((50 / xrpPrice) * 100).toFixed(0)}%)
                  </span>
                </div>
              )}
            </div>

            {/* Payment method grid */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Select payment method</h2>
                <span className="text-xs text-muted-foreground">8 Instant Gateways</span>
              </div>

              {loadingMethods ? (
                <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading payment channels…
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {methods.map((m) => (
                    <motion.button
                      key={m.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => pickMethod(m)}
                      className="flex items-center justify-between rounded-xl border border-border bg-background/50 px-4 py-3.5 text-left text-sm font-semibold text-foreground transition-all hover:border-sky-500/60 hover:bg-sky-500/5 focus:outline-none focus:ring-2 focus:ring-sky-500/40 group"
                    >
                      <span className="truncate">{m.method_name}</span>
                      <Zap className="h-3.5 w-3.5 text-muted-foreground opacity-40 group-hover:text-sky-400 group-hover:opacity-100 transition-all shrink-0" />
                    </motion.button>
                  ))}
                </div>
              )}
              <p className="text-center text-xs text-muted-foreground pt-1">
                Select a payment method above to generate your verified deposit details and receive
                XRP.
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
            {/* XRP logo with radiant glow */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-sky-500/30 blur-2xl scale-150 animate-pulse" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 via-sky-600 to-blue-800 shadow-[0_0_40px_rgba(56,189,248,0.5)]">
                <CryptoIcon
                  symbol="XRP"
                  size="lg"
                  className="border-0 shadow-none bg-transparent"
                />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Provisioning XRP liquidity gateway…
              </h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Securing institutional XRPL channel, locking execution rate at $
                {xrpPrice.toFixed(4)} and assigning settlement desk.
              </p>
            </div>

            {/* Glowing animated progress bar */}
            <div className="relative mx-auto w-72 h-1.5 rounded-full bg-border overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: "linear-gradient(90deg, #0284c7, #38bdf8, #0ea5e9)",
                  boxShadow: "0 0 12px 2px rgba(56,189,248,0.8)",
                }}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.6, ease: "easeInOut" }}
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
            {/* Payment instructions card — sky blue border */}
            <div
              className="rounded-2xl border border-sky-500/40 bg-card p-5 space-y-4 shadow-xl"
              style={{
                boxShadow: "0 0 0 1px rgba(56,189,248,0.15), 0 4px 24px rgba(56,189,248,0.06)",
              }}
            >
              {/* Amount + Countdown header */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Send exactly</p>
                  <p className="text-2xl font-black text-sky-400">
                    $
                    {total.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Expires in</span>
                  <span className="font-mono">{countdown}</span>
                </div>
              </div>

              <div className="border-t border-border/60 pt-3 space-y-2.5">
                <InfoRow label="Payment gateway" value={selected.method_name} onCopy={copy} />
                <InfoRow label="Recipient name" value={selected.recipient_name} onCopy={copy} />
                <InfoRow
                  label={selected.identifier_label}
                  value={selected.identifier}
                  onCopy={copy}
                />
                {selected.cash_app_link && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Direct Pay Link</span>
                    <a
                      href={selected.cash_app_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-sky-400 hover:underline flex items-center gap-1"
                    >
                      Open {selected.method_name} <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                <InfoRow label="Amount to send" value={`${total.toFixed(2)} USD`} onCopy={copy} />

                {xrpPrice > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <CryptoIcon symbol="XRP" size="xs" />
                        You will be credited
                      </p>
                      <p className="text-sm font-bold tabular-nums text-sky-300">
                        {xrpAmount.toFixed(4)} XRP
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-right">
                      1 XRP = ${xrpPrice.toFixed(4)} USD
                    </p>
                  </div>
                )}
              </div>

              {selected.memo_note ? (
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-2.5 text-xs text-sky-200">
                  📝 {selected.memo_note}
                </div>
              ) : (
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-2.5 text-xs text-muted-foreground">
                  📝 Include your Dew Trades account email as the payment memo/note so we can match
                  your XRP deposit instantly.
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
                  Upload a screenshot or transaction confirmation. Required before submission — your
                  XRP will be credited immediately after verification.
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
                    ? "border-sky-500/50 bg-sky-500/5 text-sky-400"
                    : "border-border bg-background/30 text-muted-foreground hover:border-sky-500/40 hover:bg-accent/20"
                }`}
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin shrink-0 text-sky-400" />
                ) : receipt ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-sky-400" />
                ) : (
                  <CloudUpload className="h-5 w-5 shrink-0 text-sky-400" />
                )}
                <span className="truncate">
                  {uploading
                    ? "Uploading receipt…"
                    : receipt
                      ? receipt.name
                      : "Choose File (Screenshot or PDF receipt)"}
                </span>
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => {
                  soundFX.playClick();
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
                className="flex-1 h-11 text-sm font-semibold bg-gradient-to-r from-sky-500 via-blue-600 to-sky-400 text-white hover:opacity-90 shadow-md shadow-sky-500/20"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing request…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" /> Submit XRP deposit request
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
        <p className="text-sm font-semibold truncate text-foreground">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => onCopy(value)}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-sky-500/10 hover:text-sky-400 transition-colors"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
