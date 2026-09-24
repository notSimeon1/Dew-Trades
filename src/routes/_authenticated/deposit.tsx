import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CryptoIcon } from "@/components/CryptoIcon";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useBinancePrices } from "@/hooks/useBinancePrices";
import { FlashBonusBanner } from "@/components/FlashBonusBanner";
import { VipBadge, getVipTier } from "@/components/VipBadge";
import { soundFX } from "@/lib/sound-engine";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  CircleCheck as CheckCircle2,
  Clock,
  Circle as XCircle,
  Loader2,
  Search,
  Bitcoin,
  Coins,
  Shield,
  Receipt,
  CircleAlert as AlertCircle,
  Upload,
  ArrowLeft,
  ArrowRight,
  Building2,
  Landmark,
  Wallet as WalletIcon,
  TrendingDown,
  Gift,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Flame,
  Crown,
  Zap,
  Trophy,
  Percent,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/_authenticated/deposit")({
  component: DepositPage,
  head: () => ({ meta: [{ title: "Deposit — Dew Trades" }] }),
});

type CryptoOption = {
  id: string;
  label: string;
  symbol: string;
  network: string;
  settingsKey: string;
  icon: string;
};
const CRYPTOS: CryptoOption[] = [
  {
    id: "xrp",
    label: "XRP (Ripple Ledger)",
    symbol: "XRP",
    network: "Ripple (XRPL)",
    settingsKey: "deposit_wallet_xrp",
    icon: "xrp",
  },
  {
    id: "usdt_trc20",
    label: "Tether USD (TRC20)",
    symbol: "USDT",
    network: "TRC20 (Tron)",
    settingsKey: "deposit_wallet_usdt_trc20",
    icon: "usdt",
  },
  {
    id: "usdt_bep20",
    label: "Tether USD (BEP20)",
    symbol: "USDT",
    network: "BEP20 (BSC)",
    settingsKey: "deposit_wallet_usdt_bep20",
    icon: "usdt",
  },
  {
    id: "btc",
    label: "Bitcoin",
    symbol: "BTC",
    network: "Bitcoin Native",
    settingsKey: "deposit_wallet_btc",
    icon: "btc",
  },
  {
    id: "eth",
    label: "Ethereum",
    symbol: "ETH",
    network: "ERC20 Mainnet",
    settingsKey: "deposit_wallet_eth",
    icon: "eth",
  },
  {
    id: "sol",
    label: "Solana",
    symbol: "SOL",
    network: "Solana Native SPL",
    settingsKey: "deposit_wallet_sol",
    icon: "sol",
  },
  {
    id: "bnb",
    label: "Binance Coin",
    symbol: "BNB",
    network: "BSC (BEP20)",
    settingsKey: "deposit_wallet_bnb",
    icon: "bnb",
  },
  {
    id: "doge",
    label: "Dogecoin",
    symbol: "DOGE",
    network: "Dogecoin Mainnet",
    settingsKey: "deposit_wallet_doge",
    icon: "doge",
  },
  {
    id: "ada",
    label: "Cardano",
    symbol: "ADA",
    network: "Cardano Shelley",
    settingsKey: "deposit_wallet_ada",
    icon: "ada",
  },
  {
    id: "ltc",
    label: "Litecoin",
    symbol: "LTC",
    network: "Litecoin Native",
    settingsKey: "deposit_wallet_ltc",
    icon: "ltc",
  },
];

const DEFAULT_DEPOSIT_WALLETS: Record<string, string> = {
  deposit_wallet_xrp: "rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh",
  deposit_wallet_usdt_trc20: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  deposit_wallet_usdt_bep20: "0x71c8b3f465d38a37f59d57a2e584f3ab1d3e8e19",
  deposit_wallet_btc: "bc1qx96yh78eq52yrfe7fqk9hhcgr9w886s7pffjay",
  deposit_wallet_eth: "0x8B911165295C78935F53753e9D8DBC566104C514",
  deposit_wallet_sol: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  deposit_wallet_bnb: "0x71c8b3f465d38a37f59d57a2e584f3ab1d3e8e19",
  deposit_wallet_doge: "D8vERFXvPZ29KkK7hKkL7mH5n8mPZ8kH8",
  deposit_wallet_ada: "addr1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  deposit_wallet_ltc: "LQt8w9K5oP5oW5rW5vX5yZ5aB5cD5eF5gH",
};

const CRYPTO_PRICE_SYMBOLS: Record<string, string> = {
  xrp: "XRPUSDT",
  btc: "BTCUSDT",
  eth: "ETHUSDT",
  usdt_bep20: "USDTUSDT",
  usdt_trc20: "USDTUSDT",
  sol: "SOLUSDT",
  bnb: "BNBUSDT",
  doge: "DOGEUSDT",
  ada: "ADAUSDT",
  ltc: "LTCUSDT",
};

type Step = "select" | "generating" | "instructions" | "review";

function DepositPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("select");
  const [gatewayKind, setGatewayKind] = useState<"crypto" | "bank" | "giftcard" | null>(null);
  const [selectedCryptoId, setSelectedCryptoId] = useState<string>("");
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [selectedGiftCardId, setSelectedGiftCardId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");

  // Single receipt for crypto / bank
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  // Front & Back uploads for Gift Cards
  const [giftCardFrontFile, setGiftCardFrontFile] = useState<File | null>(null);
  const [uploadedFrontUrl, setUploadedFrontUrl] = useState<string>("");
  const [uploadingFront, setUploadingFront] = useState(false);

  const [giftCardBackFile, setGiftCardBackFile] = useState<File | null>(null);
  const [uploadedBackUrl, setUploadedBackUrl] = useState<string>("");
  const [uploadingBack, setUploadingBack] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("*");
      const m: Record<string, string> = {};
      (data ?? []).forEach((r: any) => {
        m[r.key] = r.value;
      });
      return m;
    },
    refetchInterval: 3000,
  });
  const { data: platformSettings } = useQuery({
    queryKey: ["platform_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("*");
      const m: Record<string, any> = {};
      (data ?? []).forEach((r: any) => {
        try {
          m[r.key_name] = typeof r.value === "string" ? JSON.parse(r.value) : r.value;
        } catch {
          m[r.key_name] = r.value;
        }
      });
      return m;
    },
  });
  const { data: bankMethods } = useQuery({
    queryKey: ["bank_methods_active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bank_deposit_methods")
        .select("*")
        .eq("is_active", true)
        .order("method_name");
      return data ?? [];
    },
  });
  const priceSymbols = useMemo(() => Array.from(new Set(Object.values(CRYPTO_PRICE_SYMBOLS))), []);
  const { tickers } = useBinancePrices(priceSymbols);

  const { data: deposits, refetch } = useQuery({
    queryKey: ["my_deposits", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deposits")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  const cumulativeDeposits = useMemo(() => {
    let sum = Number(profile?.live_balance ?? 0);
    (deposits ?? []).forEach((d: any) => {
      if (d.status === "approved") {
        sum += Number(d.amount_usd ?? d.amount ?? 0);
      }
    });
    return sum;
  }, [profile, deposits]);

  const currentTier = getVipTier(cumulativeDeposits);

  const nextTierInfo = useMemo(() => {
    if (cumulativeDeposits >= 5000)
      return { next: "Whale VIP 🐋 (Max Unlocked)", target: 5000, pct: 100, remaining: 0 };
    if (cumulativeDeposits >= 2000)
      return {
        next: "Whale VIP 🐋 ($5,000)",
        target: 5000,
        pct: Math.min(100, Math.round((cumulativeDeposits / 5000) * 100)),
        remaining: 5000 - cumulativeDeposits,
      };
    if (cumulativeDeposits >= 500)
      return {
        next: "Gold VIP 👑 ($2,000)",
        target: 2000,
        pct: Math.min(100, Math.round((cumulativeDeposits / 2000) * 100)),
        remaining: 2000 - cumulativeDeposits,
      };
    return {
      next: "Silver Tier 🥈 ($500)",
      target: 500,
      pct: Math.min(100, Math.round((cumulativeDeposits / 500) * 100)),
      remaining: 500 - cumulativeDeposits,
    };
  }, [cumulativeDeposits]);

  const gasFeePercent = Number(platformSettings?.gas_fee_percent ?? 5);
  const minDeposit = Number(platformSettings?.min_deposit_usd ?? 50);
  const expiryHours = Number(platformSettings?.payment_order_expiry_hours ?? 2);

  const baseAmount = Number(amount) || 0;
  const gasFeeAmount = Number(((baseAmount * gasFeePercent) / 100).toFixed(2));
  const totalPayable = Number((baseAmount + gasFeeAmount).toFixed(2));

  const selectedCrypto = CRYPTOS.find((c) => c.id === selectedCryptoId);
  const selectedBank = (bankMethods ?? []).find((b: any) => b.id === selectedBankId);
  const wallet = selectedCrypto
    ? settings?.[selectedCrypto.settingsKey] ||
      DEFAULT_DEPOSIT_WALLETS[selectedCrypto.settingsKey] ||
      ""
    : undefined;

  const receiveCryptoAmount = useMemo(() => {
    if (!selectedCrypto || totalPayable <= 0) return null;
    const priceSymbol = CRYPTO_PRICE_SYMBOLS[selectedCrypto.id];
    const price = priceSymbol ? (tickers[priceSymbol]?.price ?? 0) : 0;
    if (price <= 0) return null;
    return totalPayable / price;
  }, [selectedCrypto, totalPayable, tickers]);
  const receiveLabel = useMemo(() => {
    if (!selectedCrypto) return "";
    if (receiveCryptoAmount == null) return "Waiting for live price…";
    const decimals =
      selectedCrypto.symbol === "BTC"
        ? 6
        : selectedCrypto.symbol === "ETH"
          ? 5
          : selectedCrypto.symbol === "XRP"
            ? 4
            : 2;
    return `~${receiveCryptoAmount.toFixed(decimals)} ${selectedCrypto.symbol}`;
  }, [selectedCrypto, receiveCryptoAmount]);

  const filteredCryptos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CRYPTOS;
    return CRYPTOS.filter((c) => `${c.label} ${c.symbol} ${c.network}`.toLowerCase().includes(q));
  }, [search]);

  const onSearchChange = (val: string) => {
    setSearch(val);
    if (val.trim().toLowerCase() === "/adminaccess") {
      toast.success("Access unlocked");
      setSearch("");
      navigate({ to: "/admin" });
    }
  };

  // 2-hour countdown, keyed to entering instructions step
  const deadlineRef = useRef<number>(0);
  const [remainingMs, setRemainingMs] = useState(expiryHours * 3600 * 1000);
  useEffect(() => {
    if (step !== "instructions") return;
    deadlineRef.current = Date.now() + expiryHours * 3600 * 1000;
    const tick = () => setRemainingMs(Math.max(0, deadlineRef.current - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [step, expiryHours]);
  const hh = String(Math.floor(remainingMs / 3600000)).padStart(2, "0");
  const mm = String(Math.floor((remainingMs % 3600000) / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0");

  // Move from generating -> instructions after 3s
  useEffect(() => {
    if (step !== "generating") return;
    const id = window.setTimeout(() => setStep("instructions"), 3000);
    return () => window.clearTimeout(id);
  }, [step]);

  const pickCrypto = (id: string) => {
    setGatewayKind("crypto");
    setSelectedCryptoId(id);
    setSelectedBankId("");
    setSelectedGiftCardId("");
  };
  const pickBank = (id: string) => {
    setGatewayKind("bank");
    setSelectedBankId(id);
    setSelectedCryptoId("");
    setSelectedGiftCardId("");
  };
  const pickGiftCard = (id: string = "apple_gift_card") => {
    setGatewayKind("giftcard");
    setSelectedGiftCardId(id);
    setSelectedCryptoId("");
    setSelectedBankId("");
  };

  const goGenerate = () => {
    const base = Number(amount);
    if (!base || base <= 0) return toast.error("Enter a valid amount");
    if (base < minDeposit) return toast.error(`Minimum deposit is $${minDeposit}`);
    if (!gatewayKind) return toast.error("Select a payment gateway");
    if (gatewayKind === "crypto" && !selectedCryptoId)
      return toast.error("Select a crypto network");
    if (gatewayKind === "bank" && !selectedBankId) return toast.error("Select a bank");
    if (gatewayKind === "giftcard" && !selectedGiftCardId)
      return toast.error("Select a gift card option");
    setStep("generating");
  };

  const uploadFileToStorage = async (f: File): Promise<string> => {
    if (!user) throw new Error("Not authenticated");
    const ext = f.name.split(".").pop() ?? "png";
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

    const { error: err1 } = await supabase.storage
      .from("deposit-receipts")
      .upload(path, f, { upsert: true, contentType: f.type });
    if (!err1) return path;

    const { error: err2 } = await supabase.storage
      .from("support_attachments")
      .upload(path, f, { upsert: true, contentType: f.type });
    if (!err2) return path;

    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(f);
    });
  };

  const uploadReceipt = async (f: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const urlToUse = await uploadFileToStorage(f);
      setUploadedUrl(urlToUse);
      setReceiptFile(f);
      toast.success("Receipt uploaded successfully");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const uploadGiftCardSide = async (f: File, side: "front" | "back") => {
    if (!user) return;
    if (side === "front") setUploadingFront(true);
    else setUploadingBack(true);

    try {
      const urlToUse = await uploadFileToStorage(f);
      if (side === "front") {
        setUploadedFrontUrl(urlToUse);
        setGiftCardFrontFile(f);
        toast.success("Gift Card FRONT uploaded");
      } else {
        setUploadedBackUrl(urlToUse);
        setGiftCardBackFile(f);
        toast.success("Gift Card BACK uploaded");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      if (side === "front") setUploadingFront(false);
      else setUploadingBack(false);
    }
  };

  const submit = async () => {
    if (gatewayKind === "giftcard") {
      if (!uploadedFrontUrl || !uploadedBackUrl) {
        return toast.error("Please upload both the FRONT and BACK of your gift card");
      }
    } else {
      if (!uploadedUrl) return toast.error("Upload your payment receipt first");
    }

    if (gatewayKind === "crypto" && !txHash.trim())
      return toast.error("Enter the on-chain transaction hash");
    setSubmitting(true);

    const expiresAt = new Date(Date.now() + expiryHours * 3600000).toISOString();
    const methodKey =
      gatewayKind === "crypto"
        ? selectedCryptoId
        : gatewayKind === "bank"
          ? `bank_${selectedBankId}`
          : "apple_gift_card";

    const currency =
      gatewayKind === "crypto"
        ? `${selectedCrypto?.symbol} ${selectedCrypto?.network}`
        : gatewayKind === "bank"
          ? `${selectedBank?.method_name ?? "Bank"} (USD)`
          : "Apple Gift Card (USD)";

    const finalReceiptUrl =
      gatewayKind === "giftcard"
        ? JSON.stringify({ front: uploadedFrontUrl, back: uploadedBackUrl, type: "giftcard" })
        : uploadedUrl;

    const { error } = await supabase.from("deposits").insert({
      user_id: user!.id,
      amount: totalPayable,
      crypto_currency: currency,
      tx_hash:
        gatewayKind === "crypto"
          ? txHash.trim()
          : gatewayKind === "giftcard"
            ? "GiftCard-Apple"
            : null,
      payment_method:
        gatewayKind === "crypto" ? "crypto" : gatewayKind === "bank" ? "bank" : "giftcard",
      bank_method_id: gatewayKind === "bank" ? selectedBankId : null,
      receipt_url: finalReceiptUrl,
      base_amount: baseAmount,
      gas_fee_amount: gasFeeAmount,
      total_payable: totalPayable,
      payment_method_key: methodKey,
      expires_at: expiresAt,
    });
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }

    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user!.id,
      type: "deposit_request",
      amount: totalPayable,
      asset_name: `Deposit ${currency} (base ${baseAmount.toFixed(2)} + fee ${gasFeeAmount.toFixed(2)})`,
      status: "pending",
      source_table: "deposits",
    });
    if (txError) console.error("[deposit] transaction insert failed:", txError.message);

    setSubmitting(false);
    toast.success("Deposit request submitted successfully!");
    setStep("select");
    setAmount("");
    setTxHash("");
    setReceiptFile(null);
    setUploadedUrl("");
    setGiftCardFrontFile(null);
    setUploadedFrontUrl("");
    setGiftCardBackFile(null);
    setUploadedBackUrl("");
    setGatewayKind(null);
    setSelectedCryptoId("");
    setSelectedBankId("");
    setSelectedGiftCardId("");
    qc.invalidateQueries({ queryKey: ["my_deposits"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    refetch();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Deposit funds</h1>
            <VipBadge tier={currentTier} size="md" />
          </div>
          <p className="text-sm text-muted-foreground">
            Follow the guided wizard — pick a gateway, receive payment instructions, upload proof.
          </p>
        </div>
      </div>

      {/* FLASH BONUS BANNER */}
      <FlashBonusBanner
        onClaim={() => {
          setAmount("1000");
          soundFX.playDepositBonus();
        }}
      />

      {/* DEPOSIT PROGRESS MILESTONE BAR */}
      <Card className="p-4 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-emerald-500/30 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <span className="font-semibold text-slate-200">VIP Rank Milestone:</span>
            <VipBadge tier={currentTier} size="sm" />
          </div>
          <div className="text-slate-400">
            Total Deposited:{" "}
            <strong className="text-emerald-400 font-mono">
              ${cumulativeDeposits.toLocaleString()} USD
            </strong>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>
              Next Target: <strong className="text-amber-300">{nextTierInfo.next}</strong>
            </span>
            <span>
              {nextTierInfo.remaining > 0
                ? `$${nextTierInfo.remaining.toLocaleString()} remaining`
                : "Max Unlocked!"}
            </span>
          </div>

          <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden border border-slate-700/60">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${nextTierInfo.pct}%` }}
            />
          </div>
        </div>
      </Card>

      <Stepper step={step} />

      {/* STEP 1: SELECT GATEWAY + AMOUNT */}
      {step === "select" && (
        <Card className="p-6 space-y-6 bg-morph">
          {/* TIERED DEPOSIT MATCH BONUS PRESETS */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Tiered Deposit Boosters & Rewards
            </Label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setAmount("100");
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  amount === "100"
                    ? "border-amber-400 bg-amber-500/10 shadow-glow"
                    : "border-border bg-surface hover:bg-accent/40"
                }`}
              >
                <div className="text-xs font-bold text-foreground">$100 Starter</div>
                <div className="text-[10px] text-amber-400 font-extrabold mt-0.5">
                  100 Leaderboard Pts
                </div>
                <div className="text-[9px] text-muted-foreground">0% Bonus (&lt; $1k)</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setAmount("500");
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  amount === "500"
                    ? "border-slate-300 bg-slate-300/10 shadow-glow"
                    : "border-border bg-surface hover:bg-accent/40"
                }`}
              >
                <div className="text-xs font-bold text-foreground">$500 Silver</div>
                <div className="text-[10px] text-slate-300 font-extrabold mt-0.5">
                  500 Leaderboard Pts
                </div>
                <div className="text-[9px] text-muted-foreground">0% Bonus (&lt; $1k)</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setAmount("2000");
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  amount === "2000"
                    ? "border-amber-500 bg-amber-500/20 shadow-glow"
                    : "border-border bg-surface hover:bg-accent/40"
                }`}
              >
                <div className="text-xs font-bold text-amber-300">$2,000 Gold VIP</div>
                <div className="text-[10px] text-amber-400 font-extrabold mt-0.5">
                  +10% Match Bonus
                </div>
                <div className="text-[9px] text-amber-300/80">2,000 Leaderboard Pts</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFX.playDepositBonus();
                  setAmount("5000");
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  amount === "5000"
                    ? "border-purple-500 bg-purple-500/20 shadow-glow"
                    : "border-border bg-surface hover:bg-accent/40"
                }`}
              >
                <div className="text-xs font-bold text-purple-300">$5,000 Whale 🐋</div>
                <div className="text-[10px] text-purple-400 font-extrabold mt-0.5">
                  +20% Match Bonus
                </div>
                <div className="text-[9px] text-purple-300/80">5,000 Leaderboard Pts</div>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Amount (USD)</Label>
            <Input
              type="number"
              min={minDeposit}
              step="0.01"
              placeholder={String(minDeposit)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Minimum deposit: ${minDeposit} · Processing fee: {gasFeePercent}%
            </p>

            {Number(amount) > 0 && Number(amount) < 1000 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 font-medium">
                <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  Deposits under $1,000 earn <strong>{Number(amount)} Leaderboard Points</strong>{" "}
                  (0% Cash Bonus). Deposit $1,000+ to unlock 10% deposit match bonuses!
                </span>
              </div>
            )}
            {Number(amount) >= 1000 && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 font-medium">
                <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  Eligible for{" "}
                  <strong>+{Number(amount) >= 5000 ? 20 : 10}% Instant Deposit Match Bonus</strong>{" "}
                  (${(Number(amount) * (Number(amount) >= 5000 ? 0.2 : 0.1)).toLocaleString()} bonus
                  — Total credited: $
                  {(Number(amount) * (1 + (Number(amount) >= 5000 ? 0.2 : 0.1))).toLocaleString()})
                  + <strong>{Number(amount).toLocaleString()} Leaderboard Points</strong>!
                </span>
              </div>
            )}
          </div>

          {baseAmount > 0 && (
            <>
              <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Receipt className="h-3.5 w-3.5" /> You will pay
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base:</span>
                  <span className="font-semibold tabular-nums">${baseAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Processing fee ({gasFeePercent}%):</span>
                  <span className="font-semibold tabular-nums text-destructive">
                    ${gasFeeAmount.toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-sm">
                  <span className="font-semibold">Total payable:</span>
                  <span className="font-bold tabular-nums text-primary">
                    ${totalPayable.toFixed(2)}
                  </span>
                </div>
              </div>
              {gatewayKind === "crypto" && selectedCrypto && (
                <div className="rounded-xl border border-success/30 bg-success/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <TrendingDown className="h-3.5 w-3.5" /> You will receive
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estimated crypto credited</span>
                    <span className="text-lg font-bold tabular-nums text-success">
                      {receiveLabel}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Live rate from CoinGecko. Final amount confirmed on settlement.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label>Search asset / network</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search USDT, BTC, ETH, bank…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <WalletIcon className="h-3.5 w-3.5" /> Crypto gateways
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {filteredCryptos.map((c) => {
                  const active = c.id === selectedCryptoId && gatewayKind === "crypto";
                  return (
                    <motion.button
                      layout
                      key={c.id}
                      type="button"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => pickCrypto(c.id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${active ? "border-primary bg-accent/50 shadow-glow" : "border-border bg-surface hover:bg-accent/30"}`}
                    >
                      <CryptoIcon symbol={c.symbol} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">
                          {c.symbol}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            · {c.network}
                          </span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{c.label}</div>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {!!bankMethods?.length && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Landmark className="h-3.5 w-3.5" /> Interbank / wire gateways
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {bankMethods.map((b: any) => {
                  const active = b.id === selectedBankId && gatewayKind === "bank";
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => pickBank(b.id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${active ? "border-primary bg-accent/50 shadow-glow" : "border-border bg-surface hover:bg-accent/30"}`}
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? "bg-blue-600 text-white" : "bg-surface-elevated text-foreground"}`}
                      >
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{b.method_name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {b.method_type ?? "Bank transfer"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* GIFT CARDS GATEWAY */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Gift className="h-3.5 w-3.5" /> Gift card gateways
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => pickGiftCard("apple_gift_card")}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  gatewayKind === "giftcard" && selectedGiftCardId === "apple_gift_card"
                    ? "border-primary bg-accent/50 shadow-glow"
                    : "border-border bg-surface hover:bg-accent/30"
                }`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${gatewayKind === "giftcard" ? "bg-blue-600 text-white" : "bg-surface-elevated text-foreground"}`}
                >
                  <Gift className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">Apple Gift Card</div>
                  <div className="truncate text-xs text-muted-foreground">
                    Buy online at Apple & upload front/back
                  </div>
                </div>
              </button>
            </div>
          </div>

          <Button onClick={goGenerate} className="w-full">
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Card>
      )}

      {/* STEP 2: GENERATING */}
      {step === "generating" && (
        <Card className="p-10 bg-morph text-center space-y-4">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <h2 className="text-xl font-semibold">Generating secure payment gateway…</h2>
          <p className="text-sm text-muted-foreground">
            Provisioning a one-time settlement address, verifying network liquidity and locking your
            rate.
          </p>
          <div className="mx-auto max-w-md h-1.5 overflow-hidden rounded-full bg-border">
            <motion.div
              className="h-full bg-gradient-hero"
              initial={{ width: "5%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 3 }}
            />
          </div>
        </Card>
      )}

      {/* STEP 3: INSTRUCTIONS + PROOF UPLOAD */}
      {step === "instructions" && (
        <Card className="p-6 bg-morph space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-primary" />
              <span className="font-semibold">
                Send exactly{" "}
                <span className="text-primary tabular-nums">${totalPayable.toFixed(2)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
              <Clock className="h-3.5 w-3.5" /> Expires in {hh}:{mm}:{ss}
            </div>
          </div>

          {gatewayKind === "crypto" && selectedCrypto && (
            <div className="space-y-4 rounded-xl border border-dashed border-border bg-surface p-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {wallet && (
                  <div className="rounded-xl border border-border bg-white p-2 shrink-0 shadow-sm">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(wallet)}`}
                      alt={`${selectedCrypto.symbol} Deposit QR Code`}
                      className="h-28 w-28 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <div className="flex-1 space-y-2 min-w-0 w-full">
                  <p className="text-xs font-medium text-muted-foreground">
                    Send {selectedCrypto.symbol} ({selectedCrypto.network}) to:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded-md bg-background px-3 py-2 text-xs font-mono font-medium">
                      {wallet || "Address not set — contact support"}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1"
                      onClick={() => {
                        const addr = wallet;
                        if (addr) {
                          navigator.clipboard.writeText(addr);
                          toast.success(`Copied ${selectedCrypto.symbol} Address`);
                        }
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Scan the QR code or copy the address above using your crypto wallet.
                  </p>
                </div>
              </div>

              {selectedCrypto.symbol === "XRP" && (
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-sky-400">
                      Destination Tag / Memo (Required):
                    </span>
                    <span className="text-[11px] text-muted-foreground">XRPL Ledger Tag</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-md bg-background px-3 py-1.5 text-xs font-mono font-bold text-sky-300">
                      {settings?.deposit_tag_xrp || "849201"}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-sky-500/40 text-sky-400 hover:bg-sky-500/10"
                      onClick={() => {
                        const tag = settings?.deposit_tag_xrp || "849201";
                        navigator.clipboard.writeText(tag);
                        toast.success("Destination Tag Copied");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy Tag
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    ⚡ Make sure to include this Destination Tag so your XRP deposit is credited
                    instantly.
                  </p>
                </div>
              )}

              <div>
                <Label>Transaction hash</Label>
                <Input
                  placeholder="0x… or XRP ledger tx id"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                />
              </div>
            </div>
          )}

          {gatewayKind === "bank" && selectedBank && (
            <div className="space-y-2 rounded-xl border border-dashed border-border bg-surface p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Wire {selectedBank.method_name} instructions
              </p>
              <InfoRow label="Account name" value={selectedBank.account_name} />
              <InfoRow label="Account number" value={selectedBank.account_number} />
              <InfoRow label="Routing / sort" value={selectedBank.routing_number} />
              <InfoRow label="SWIFT / BIC" value={selectedBank.swift_code} />
              <InfoRow label="Bank address" value={selectedBank.bank_address} />
              {selectedBank.notes && (
                <p className="pt-2 text-xs text-muted-foreground border-t border-border">
                  {selectedBank.notes}
                </p>
              )}
            </div>
          )}

          {gatewayKind === "giftcard" && (
            <div className="space-y-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Gift className="h-4 w-4 text-primary" /> Purchase Apple Gift Card
              </div>
              <p className="text-xs text-muted-foreground">
                Please purchase an official Apple Gift Card for the total payable amount of{" "}
                <span className="font-semibold text-primary tabular-nums">
                  ${totalPayable.toFixed(2)}
                </span>
                .
              </p>

              <div>
                <a
                  href="https://www.apple.com/shop/buy-giftcard/giftcard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all"
                >
                  Buy Apple Gift Card <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="rounded-lg bg-surface/80 p-3 space-y-1.5 text-xs text-muted-foreground border border-border">
                <div className="font-semibold text-foreground">Instructions on how to deposit:</div>
                <ol className="list-decimal list-inside space-y-1">
                  <li>
                    Click the button above to open Apple's official gift card store in a new tab.
                  </li>
                  <li>
                    Purchase an Apple Gift Card matching your exact deposit amount:{" "}
                    <strong>${totalPayable.toFixed(2)}</strong>.
                  </li>
                  <li>
                    When you are done, snap a clear photo or take a screenshot of both the{" "}
                    <strong>FRONT</strong> and <strong>BACK</strong> of the gift card.
                  </li>
                  <li>
                    Ensure the code, claim PIN, or numbers on the back are completely readable.
                  </li>
                  <li>
                    Upload both the Front and Back images below, then click{" "}
                    <strong>Submit deposit request</strong>.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* PROOF UPLOADS */}
          {gatewayKind === "giftcard" ? (
            <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Upload className="h-4 w-4 text-primary" /> Gift Card Front & Back Proofs{" "}
                <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Please upload clear photos or screenshots of both the front and back of your gift
                card.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* FRONT UPLOAD */}
                <div className="space-y-1.5 rounded-lg border border-border bg-surface p-3">
                  <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-primary" /> Gift Card FRONT{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploadingFront}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadGiftCardSide(f, "front");
                    }}
                  />
                  {uploadingFront && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading front…
                    </div>
                  )}
                  {giftCardFrontFile && !uploadingFront && (
                    <div className="flex items-center gap-2 text-xs text-success font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Front: {giftCardFrontFile.name}
                    </div>
                  )}
                </div>

                {/* BACK UPLOAD */}
                <div className="space-y-1.5 rounded-lg border border-border bg-surface p-3">
                  <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-primary" /> Gift Card BACK (with PIN){" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploadingBack}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadGiftCardSide(f, "back");
                    }}
                  />
                  {uploadingBack && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading back…
                    </div>
                  )}
                  {giftCardBackFile && !uploadingBack && (
                    <div className="flex items-center gap-2 text-xs text-success font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Back: {giftCardBackFile.name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <Label className="flex items-center gap-2 text-sm">
                <Upload className="h-4 w-4 text-primary" /> Payment receipt{" "}
                <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Upload a screenshot of your payment. Required before submission — your wallet will
                be credited upon confirmation.
              </p>
              <Input
                type="file"
                accept="image/*,application/pdf"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadReceipt(f);
                }}
              />
              {uploading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                </div>
              )}
              {receiptFile && !uploading && (
                <div className="flex items-center gap-2 text-xs text-success">
                  <CheckCircle2 className="h-3 w-3" /> {receiptFile.name}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("select")} className="flex-1">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button
              onClick={submit}
              disabled={
                submitting ||
                (gatewayKind === "giftcard"
                  ? uploadingFront || uploadingBack || !uploadedFrontUrl || !uploadedBackUrl
                  : uploading || !uploadedUrl || (gatewayKind === "crypto" && !txHash.trim()))
              }
              className="flex-1"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit deposit request
            </Button>
          </div>
        </Card>
      )}

      {/* HISTORY */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Your deposit history</h2>
        {!deposits?.length ? (
          <p className="text-sm text-muted-foreground">No deposits yet.</p>
        ) : (
          <div className="space-y-2">
            {deposits.map((d: any) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-semibold tabular-nums">
                    ${Number(d.amount).toFixed(2)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {d.crypto_currency}
                    </span>
                  </div>
                  {d.base_amount && d.gas_fee_amount != null && (
                    <div className="text-xs text-muted-foreground">
                      Base: ${Number(d.base_amount).toFixed(2)} + Fee: $
                      {Number(d.gas_fee_amount).toFixed(2)}
                    </div>
                  )}
                  {d.payment_method_key && (
                    <div className="text-xs text-muted-foreground">
                      Method: {d.payment_method_key}
                    </div>
                  )}
                  {d.expires_at && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Expires:{" "}
                      {new Date(d.expires_at).toLocaleString()}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleString()}
                  </div>
                </div>
                <StatusBadge status={d.status} />
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Need help?{" "}
        <Link to="/support" className="text-primary underline">
          Contact support
        </Link>
      </p>
    </motion.div>
  );
}

function Stepper({ step }: { step: Step }) {
  const items: { id: Step; label: string }[] = [
    { id: "select", label: "Select gateway" },
    { id: "generating", label: "Generate" },
    { id: "instructions", label: "Pay & upload" },
  ];
  const idx = items.findIndex((i) => i.id === step);
  return (
    <div className="flex items-center gap-2">
      {items.map((it, i) => (
        <div key={it.id} className="flex flex-1 items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i <= idx ? "bg-blue-600 text-white" : "bg-surface border border-border text-muted-foreground"}`}
          >
            {i + 1}
          </div>
          <span
            className={`text-xs font-medium ${i <= idx ? "text-foreground" : "text-muted-foreground"}`}
          >
            {it.label}
          </span>
          {i < items.length - 1 && (
            <div className={`h-px flex-1 ${i < idx ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 max-w-[60%]">
        <code className="break-all rounded bg-background px-2 py-1 text-xs font-mono">{value}</code>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success("Copied");
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return (
      <Badge className="bg-success text-success-foreground">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Approved
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" /> Rejected
      </Badge>
    );
  return (
    <Badge variant="secondary">
      <Clock className="mr-1 h-3 w-3" /> Pending
    </Badge>
  );
}
