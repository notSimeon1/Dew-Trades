import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { WhatsAppChat } from "@/components/WhatsAppChat";
import {
  adjustAdminBalance,
  adjustAdminCryptoBalance,
  approveAdminDepositCrypto,
  decideAdminDeposit,
  decideAdminKyc,
  decideAdminWithdrawal,
  getAdminKycUrl,
  getAdminOverview,
  getPlatformSettings,
  savePlatformSetting,
  postAdminNews,
  reconcileAdminLedger,
  toggleAdminAiTrading,
  toggleAdminAccountMode,
  toggleAdminSuspend,
  updateAdminChart,
  updateAdminComplaint,
  updateAdminSetting,
  updateAdminBankMethod,
  deleteAdminSetting,
  resetAdminSupportChats,
  markSupportMessagesRead,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader as Loader2,
  Shield,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Save,
  FileText,
  Newspaper,
  Ban,
  Bot,
  Users,
  Layers,
  Megaphone,
  Radio,
  Activity,
  DollarSign,
  ChartBar as BarChart3,
  Cpu,
  Headphones,
  Send,
  KeyRound,
  ScrollText,
  UserCog,
  Crown,
  ShieldCheck,
  Clock,
  Settings2,
  Wallet,
  Search,
  Copy,
  Plus,
  Trash2,
  QrCode,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useBinancePrices, fetchBinanceLiveCandles, type Ticker } from "@/hooks/useBinancePrices";
import { TradingChart, type Candle } from "@/components/TradingChart";
import { generateCandles, nextCandle, type ChartMode } from "@/lib/chart-engine";
import { computeEnrichedCryptoAssets, CRYPTO_FALLBACK_PRICES } from "@/lib/crypto-assets";

const SUPER_ADMIN_EMAILS = ["simonosawaru255@gmail.com", "izedomixavier@gmail.com"];
const OWNER_EMAIL = "simonosawaru255@gmail.com";
const ADMIN_EMAILS = ["simonosawaru255@gmail.com", "izedomixavier@gmail.com", "bayo@gmail.com"];

function safeOpenUrl(url: string) {
  if (!url) return;
  try {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
      } catch {
        /* ignore cleanup error */
      }
    }, 200);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fetchOverview = useServerFn(getAdminOverview);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const BINANCE_PRICE_SYMBOLS = useMemo(
    () => [
      "BTCUSDT",
      "ETHUSDT",
      "BNBUSDT",
      "SOLUSDT",
      "XRPUSDT",
      "ADAUSDT",
      "MNTUSDT",
      "DOGEUSDT",
      "USDTUSDT",
      "USDCUSDT",
    ],
    [],
  );
  const { tickers, status: wsStatus } = useBinancePrices(BINANCE_PRICE_SYMBOLS);

  useEffect(() => {
    if (!user) return;
    const userEmail = user.email?.toLowerCase();
    if (userEmail && ADMIN_EMAILS.includes(userEmail)) {
      setIsAdmin(true);
      return;
    }
    (async () => {
      try {
        const [{ data: roles }, { data: prof }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", user.id),
          supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
        ]);
        const hasRole = (roles ?? []).some(
          (r: any) => r.role === "admin" || r.role === "super_admin",
        );
        const hasProf = Boolean(prof?.role === "admin" || prof?.role === "super_admin");
        if (hasRole || hasProf) {
          setIsAdmin(true);
          return;
        }
      } catch (e) {
        console.warn("admin check failed", e);
      }
      setIsAdmin(false);
      navigate({ to: "/dashboard" });
    })();
  }, [user, navigate]);

  const overviewQuery = useQuery({
    queryKey: ["admin_overview", user?.id],
    queryFn: () => fetchOverview(),
    enabled: isAdmin === true,
    refetchInterval: 15000,
    staleTime: 10000,
    retry: false,
  });

  useEffect(() => {
    if (overviewQuery.error)
      toast.error(overviewQuery.error.message || "Admin data could not load");
  }, [overviewQuery.error]);

  if (isAdmin === null) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-morph relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-6 shadow-elegant">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 8, -6, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-hero shadow-glow shrink-0"
            >
              <Shield className="h-5 w-5 text-primary-foreground" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight shimmer-text">
                Admin control center
              </h1>
              <p className="text-sm text-muted-foreground">
                Approvals, balances, charts and wallet settings.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    wsStatus === "live" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  }`}
                />
                <span className="font-semibold text-foreground">Binance WebSocket:</span>
                <span
                  className={
                    wsStatus === "live" ? "text-emerald-400 font-medium" : "text-amber-400"
                  }
                >
                  {wsStatus === "live" ? "Live Feed Active" : "Connecting..."}
                </span>
                {wsStatus === "live" && tickers["BTCUSDT"]?.price && (
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground hidden sm:inline">
                    BTC: ${tickers["BTCUSDT"].price.toLocaleString()} · ETH: $
                    {(tickers["ETHUSDT"]?.price ?? 0).toLocaleString()} · SOL: $
                    {(tickers["SOLUSDT"]?.price ?? 0).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await overviewQuery.refetch();
                  toast.success("Admin overview refreshed");
                } catch {
                  toast.error("Failed to refresh admin data");
                }
              }}
              disabled={overviewQuery.isFetching}
              className="h-9 px-3 text-xs bg-background/50 hover:bg-background"
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${overviewQuery.isFetching ? "animate-spin" : ""}`}
              />
              {overviewQuery.isFetching ? "Refreshing..." : "Refresh Overview"}
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="deposits">
        <TabsList className="flex flex-wrap h-auto gap-1.5 p-1.5 bg-muted/50 w-full justify-start">
          <TabsTrigger value="deposits" className="shrink-0">
            Deposits
          </TabsTrigger>
          <TabsTrigger value="proofs" className="shrink-0">
            <FileText className="mr-1 h-3.5 w-3.5" />
            Deposit Proofs
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="shrink-0">
            Withdrawals
          </TabsTrigger>
          <TabsTrigger
            value="wallets"
            className="shrink-0 bg-primary/10 text-primary hover:bg-primary/20 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium"
          >
            <Wallet className="mr-1 h-3.5 w-3.5" />
            Deposit Wallets
          </TabsTrigger>
          <TabsTrigger value="users" className="shrink-0">
            Users &amp; Charts
          </TabsTrigger>
          <TabsTrigger value="kyc" className="shrink-0">
            KYC Review
          </TabsTrigger>
          <TabsTrigger value="news" className="shrink-0">
            Market News
          </TabsTrigger>
          <TabsTrigger value="complaints" className="shrink-0">
            Complaints
          </TabsTrigger>
          <TabsTrigger value="bots" className="shrink-0">
            <Bot className="mr-1 h-3.5 w-3.5" />
            Bots
          </TabsTrigger>
          <TabsTrigger value="copy" className="shrink-0">
            <Users className="mr-1 h-3.5 w-3.5" />
            Copy
          </TabsTrigger>
          <TabsTrigger value="premarket" className="shrink-0">
            <Layers className="mr-1 h-3.5 w-3.5" />
            Pre-Market
          </TabsTrigger>
          <TabsTrigger value="announcements" className="shrink-0">
            <Megaphone className="mr-1 h-3.5 w-3.5" />
            Announcements
          </TabsTrigger>
          <TabsTrigger value="signals" className="shrink-0">
            <Radio className="mr-1 h-3.5 w-3.5" />
            Signals
          </TabsTrigger>
          <TabsTrigger value="support" className="shrink-0">
            <Headphones className="mr-1 h-3.5 w-3.5" />
            Support
          </TabsTrigger>
          <TabsTrigger value="roles" className="shrink-0">
            <UserCog className="mr-1 h-3.5 w-3.5" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="audit" className="shrink-0">
            <ScrollText className="mr-1 h-3.5 w-3.5" />
            Audit
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="shrink-0 ml-auto bg-primary/10 text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Settings2 className="mr-1 h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deposits">
          <DepositsTab
            items={overviewQuery.data?.deposits}
            users={overviewQuery.data?.users}
            loading={overviewQuery.isLoading}
            refetch={overviewQuery.refetch}
            tickers={tickers}
          />
        </TabsContent>
        <TabsContent value="proofs">
          <DepositProofsTab
            items={overviewQuery.data?.deposits}
            users={overviewQuery.data?.users}
            loading={overviewQuery.isLoading}
            refetch={overviewQuery.refetch}
            tickers={tickers}
          />
        </TabsContent>
        <TabsContent value="withdrawals">
          <WithdrawalsTab
            items={overviewQuery.data?.withdrawals}
            users={overviewQuery.data?.users}
            loading={overviewQuery.isLoading}
            refetch={overviewQuery.refetch}
            tickers={tickers}
          />
        </TabsContent>
        <TabsContent value="wallets">
          <AdminWalletsTab
            walletItems={overviewQuery.data?.settings}
            bankMethods={overviewQuery.data?.bankMethods}
            walletsLoading={overviewQuery.isLoading}
            refetchWallets={overviewQuery.refetch}
          />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab
            users={overviewQuery.data?.users}
            loading={overviewQuery.isLoading}
            refetch={overviewQuery.refetch}
            tickers={tickers}
          />
        </TabsContent>
        <TabsContent value="kyc">
          <KycTab
            items={overviewQuery.data?.kyc}
            users={overviewQuery.data?.users}
            loading={overviewQuery.isLoading}
            refetch={overviewQuery.refetch}
          />
        </TabsContent>
        <TabsContent value="news">
          <NewsTab
            items={overviewQuery.data?.news}
            loading={overviewQuery.isLoading}
            refetch={overviewQuery.refetch}
          />
        </TabsContent>
        <TabsContent value="complaints">
          <ComplaintsTab
            items={overviewQuery.data?.complaints}
            loading={overviewQuery.isLoading}
            refetch={overviewQuery.refetch}
          />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab
            walletItems={overviewQuery.data?.settings}
            walletsLoading={overviewQuery.isLoading}
            refetchWallets={overviewQuery.refetch}
          />
        </TabsContent>
        <TabsContent value="bots">
          <AdminBotsTab />
        </TabsContent>
        <TabsContent value="copy">
          <AdminCopyTab />
        </TabsContent>
        <TabsContent value="premarket">
          <AdminPreMarketTab tickers={tickers} />
        </TabsContent>
        <TabsContent value="announcements">
          <AdminAnnouncementsTab />
        </TabsContent>
        <TabsContent value="signals">
          <AdminSignalsTab tickers={tickers} />
        </TabsContent>
        <TabsContent value="support">
          <AdminSupportTab users={overviewQuery.data?.users} />
        </TabsContent>
        <TabsContent value="roles">
          <AdminRolesTab
            users={overviewQuery.data?.users}
            loading={overviewQuery.isLoading}
            refetch={overviewQuery.refetch}
          />
        </TabsContent>
        <TabsContent value="audit">
          <AdminAuditTab users={overviewQuery.data?.users} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function DepositsTab({
  items,
  users,
  loading,
  refetch,
  tickers,
}: {
  items?: any[];
  users?: any[];
  loading: boolean;
  refetch: () => void | Promise<unknown>;
  tickers?: Record<string, Ticker>;
}) {
  const decideDeposit = useServerFn(decideAdminDeposit);
  const decide = async (d: any, status: "approved" | "rejected") => {
    try {
      await decideDeposit({ data: { id: d.id, status } });
      toast.success(`Deposit ${status}`);
      await refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Could not update deposit");
    }
  };

  return (
    <RequestList
      items={items}
      users={users}
      loading={loading}
      kind="Deposit"
      onDecide={decide}
      tickers={tickers}
    />
  );
}

function DepositProofsTab({
  items,
  users,
  loading,
  refetch,
  tickers,
}: {
  items?: any[];
  users?: any[];
  loading: boolean;
  refetch: () => void | Promise<unknown>;
  tickers?: Record<string, Ticker>;
}) {
  const decideDeposit = useServerFn(decideAdminDeposit);
  const approveCryptoDeposit = useServerFn(approveAdminDepositCrypto);
  const [creditCrypto, setCreditCrypto] = useState<Record<string, string>>({});
  const [creditQty, setCreditQty] = useState<Record<string, string>>({});

  if (loading)
    return (
      <Card className="p-6">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  const withProof = (items ?? []).filter((d: any) => d.receipt_url || d.proof_url || d.tx_hash);
  if (!withProof.length)
    return (
      <Card className="p-6 text-sm text-muted-foreground">No deposit proofs uploaded yet.</Card>
    );

  const handleViewProof = async (storagePath: string) => {
    if (!storagePath) return;
    if (storagePath.startsWith("http") || storagePath.startsWith("data:")) {
      safeOpenUrl(storagePath);
      return;
    }

    // Try deposit-receipts bucket first
    const { data: d1 } = await supabase.storage
      .from("deposit-receipts")
      .createSignedUrl(storagePath, 3600);
    if (d1?.signedUrl) {
      safeOpenUrl(d1.signedUrl);
      return;
    }

    // Fallback to support_attachments bucket
    const { data: d2 } = await supabase.storage
      .from("support_attachments")
      .createSignedUrl(storagePath, 3600);
    if (d2?.signedUrl) {
      safeOpenUrl(d2.signedUrl);
      return;
    }

    // Fallback to public URL
    const { data: pub } = supabase.storage.from("deposit-receipts").getPublicUrl(storagePath);
    if (pub?.publicUrl) {
      safeOpenUrl(pub.publicUrl);
      return;
    }

    toast.error("Could not generate proof URL");
  };

  const creditCryptoAsset = async (d: any) => {
    const sym = (creditCrypto[d.id] ?? d.crypto_currency ?? "USDT").toUpperCase();
    const qty = Number(creditQty[d.id] ?? 0);
    if (!qty || qty <= 0) return toast.error("Enter crypto quantity to credit");

    try {
      await approveCryptoDeposit({
        data: {
          depositId: d.id,
          symbol: sym,
          cryptoQuantity: qty,
        },
      });

      toast.success(`Credited ${qty} ${sym} to user wallet successfully`);
      setCreditQty((p) => ({ ...p, [d.id]: "" }));
      await refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Could not credit crypto");
    }
  };

  return (
    <Card className="p-4">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <FileText className="h-4 w-4 text-primary" /> Deposit Proof Review
      </h2>
      <div className="space-y-3">
        {withProof.map((d: any) => {
          const requestUser = users?.find((u) => u.id === d.user_id);
          const proofPath = d.receipt_url || d.proof_url;

          let parsedGiftCard: { front?: string; back?: string } | null = null;
          if (proofPath && proofPath.trim().startsWith("{")) {
            try {
              parsedGiftCard = JSON.parse(proofPath);
            } catch {
              parsedGiftCard = null;
            }
          }

          return (
            <div key={d.id} className="rounded-lg border border-border bg-surface p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold tabular-nums">
                    ${Number(d.amount).toFixed(2)} · {d.crypto_currency}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {requestUser?.email ?? requestUser?.full_name ?? d.user_id}
                  </div>
                  {d.tx_hash && (
                    <div className="text-xs text-muted-foreground break-all">tx: {d.tx_hash}</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {parsedGiftCard?.front && parsedGiftCard?.back ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewProof(parsedGiftCard!.front!)}
                      >
                        <FileText className="mr-1 h-3.5 w-3.5 text-primary" /> View Front
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewProof(parsedGiftCard!.back!)}
                      >
                        <FileText className="mr-1 h-3.5 w-3.5 text-primary" /> View Back
                      </Button>
                    </div>
                  ) : proofPath ? (
                    <Button size="sm" variant="outline" onClick={() => handleViewProof(proofPath)}>
                      <FileText className="mr-1 h-4 w-4" /> View proof
                    </Button>
                  ) : null}
                  {d.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          decideDeposit({ data: { id: d.id, status: "rejected" } }).then(() =>
                            refetch(),
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          decideDeposit({ data: { id: d.id, status: "approved" } }).then(() =>
                            refetch(),
                          )
                        }
                      >
                        <Check className="mr-1 h-4 w-4" /> Approve
                      </Button>
                    </>
                  )}
                  {d.status !== "pending" && (
                    <Badge
                      variant={d.status === "approved" ? "default" : "destructive"}
                      className={
                        d.status === "approved" ? "bg-success text-success-foreground" : ""
                      }
                    >
                      {d.status}
                    </Badge>
                  )}
                </div>
              </div>
              {d.status === "pending" && (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Credit crypto</Label>
                    <Select
                      value={creditCrypto[d.id] ?? d.crypto_currency ?? "USDT"}
                      onValueChange={(v) => setCreditCrypto((p) => ({ ...p, [d.id]: v }))}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BTC">BTC</SelectItem>
                        <SelectItem value="ETH">ETH</SelectItem>
                        <SelectItem value="USDT">USDT</SelectItem>
                        <SelectItem value="BNB">BNB</SelectItem>
                        <SelectItem value="SOL">SOL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-[120px] space-y-1">
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      placeholder="0.00"
                      value={creditQty[d.id] ?? ""}
                      onChange={(e) => setCreditQty((p) => ({ ...p, [d.id]: e.target.value }))}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="bg-success hover:bg-success/90 text-success-foreground"
                    onClick={() => creditCryptoAsset(d)}
                  >
                    Credit to wallet
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WithdrawalsTab({
  items,
  users,
  loading,
  refetch,
  tickers,
}: {
  items?: any[];
  users?: any[];
  loading: boolean;
  refetch: () => void | Promise<unknown>;
  tickers?: Record<string, Ticker>;
}) {
  const decideWithdrawal = useServerFn(decideAdminWithdrawal);
  const decide = async (w: any, status: "approved" | "rejected") => {
    try {
      await decideWithdrawal({ data: { id: w.id, status } });
      toast.success(`Withdrawal ${status}`);
      await refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Could not update withdrawal");
    }
  };

  return (
    <RequestList
      items={items}
      users={users}
      loading={loading}
      kind="Withdrawal"
      onDecide={decide}
      tickers={tickers}
    />
  );
}

function RequestList({
  items,
  users,
  loading,
  kind,
  onDecide,
  tickers,
}: {
  items?: any[];
  users?: any[];
  loading: boolean;
  kind: string;
  onDecide: (item: any, status: "approved" | "rejected") => void | Promise<void>;
  tickers?: Record<string, Ticker>;
}) {
  if (loading)
    return (
      <Card className="p-6">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  if (!items?.length)
    return (
      <Card className="p-6 text-sm text-muted-foreground">No {kind.toLowerCase()} requests.</Card>
    );

  const handleViewProof = async (storagePath: string) => {
    if (!storagePath) return;
    if (storagePath.startsWith("http") || storagePath.startsWith("data:")) {
      safeOpenUrl(storagePath);
      return;
    }
    const { data: d1 } = await supabase.storage
      .from("deposit-receipts")
      .createSignedUrl(storagePath, 3600);
    if (d1?.signedUrl) {
      safeOpenUrl(d1.signedUrl);
      return;
    }
    const { data: d2 } = await supabase.storage
      .from("support_attachments")
      .createSignedUrl(storagePath, 3600);
    if (d2?.signedUrl) {
      safeOpenUrl(d2.signedUrl);
      return;
    }
    const { data: pub } = supabase.storage.from("deposit-receipts").getPublicUrl(storagePath);
    if (pub?.publicUrl) {
      safeOpenUrl(pub.publicUrl);
      return;
    }
    toast.error("Could not generate proof URL");
  };

  return (
    <Card className="p-4">
      <div className="space-y-2">
        {items.map((it) => {
          const requestUser = users?.find((u) => u.id === it.user_id);
          const proofPath = it.receipt_url || it.proof_url;
          let parsedGiftCard: { front?: string; back?: string } | null = null;
          if (proofPath && proofPath.trim().startsWith("{")) {
            try {
              parsedGiftCard = JSON.parse(proofPath);
            } catch {
              parsedGiftCard = null;
            }
          }

          const cryptoSymUpper = (it.crypto_currency ?? "USDT").toUpperCase();
          const tick = tickers?.[cryptoSymUpper] || tickers?.[`${cryptoSymUpper}USDT`];
          const liveUnitPrice =
            cryptoSymUpper === "USDT" || cryptoSymUpper === "USDC" ? 1.0 : (tick?.price ?? 0);
          const liveUsdVal = liveUnitPrice > 0 ? Number(it.amount) * liveUnitPrice : 0;

          return (
            <div
              key={it.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold tabular-nums flex flex-wrap items-center gap-2">
                  <span>
                    ${Number(it.amount).toFixed(2)} · {it.crypto_currency}
                  </span>
                  {liveUsdVal > 0 && cryptoSymUpper !== "USDT" && cryptoSymUpper !== "USDC" && (
                    <span className="text-xs text-emerald-400 font-normal">
                      (≈ $
                      {liveUsdVal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      Binance WS)
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {requestUser?.email ?? requestUser?.full_name ?? it.user_id}
                </div>
                {it.tx_hash && (
                  <div className="text-xs text-muted-foreground break-all">tx: {it.tx_hash}</div>
                )}
                {it.wallet_address && (
                  <div className="text-xs text-muted-foreground break-all">
                    to: {it.wallet_address}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {new Date(it.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {parsedGiftCard?.front && parsedGiftCard?.back ? (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewProof(parsedGiftCard!.front!)}
                    >
                      <FileText className="mr-1 h-3.5 w-3.5 text-primary" /> Front
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewProof(parsedGiftCard!.back!)}
                    >
                      <FileText className="mr-1 h-3.5 w-3.5 text-primary" /> Back
                    </Button>
                  </div>
                ) : proofPath ? (
                  <Button size="sm" variant="outline" onClick={() => handleViewProof(proofPath)}>
                    <FileText className="mr-1 h-3.5 w-3.5 text-primary" /> Proof
                  </Button>
                ) : null}
                {it.status === "pending" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => onDecide(it, "rejected")}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={() => onDecide(it, "approved")}>
                      <Check className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  </>
                ) : (
                  <Badge
                    variant={it.status === "approved" ? "default" : "destructive"}
                    className={it.status === "approved" ? "bg-success text-success-foreground" : ""}
                  >
                    {it.status}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function UsersTab({
  users,
  loading,
  refetch,
  tickers,
}: {
  users?: any[];
  loading: boolean;
  refetch: () => void | Promise<unknown>;
  tickers?: Record<string, Ticker>;
}) {
  const rolesQuery = useQuery({
    queryKey: ["admin_role_ids"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,role")
        .in("role", ["admin", "super_admin"]);
      return new Set((data ?? []).map((r: any) => r.id as string));
    },
    staleTime: 30000,
  });
  const adminIds = rolesQuery.data ?? new Set<string>();
  const reload = async () => {
    await Promise.all([refetch(), rolesQuery.refetch()]);
  };
  if (loading)
    return (
      <Card className="p-6">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );

  return (
    <div className="space-y-3">
      {users?.map((u: any) => (
        <UserRow
          key={u.id}
          user={u}
          isAdminUser={
            adminIds.has(u.id) ||
            SUPER_ADMIN_EMAILS.includes(u.email?.toLowerCase()) ||
            u.role === "super_admin" ||
            u.role === "admin"
          }
          onChange={reload}
          tickers={tickers}
        />
      ))}
      {!users?.length && <Card className="p-6 text-sm text-muted-foreground">No users yet.</Card>}
    </div>
  );
}

function AdminLiveChartPreview({
  mode,
  intensity,
  symbol = "BTC/USD",
}: {
  mode: string;
  intensity: number;
  symbol?: string;
}) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      if (mode === "live") {
        const live = await fetchBinanceLiveCandles(symbol, 100);
        if (live && live.length > 0 && active) {
          setCandles(live);
          setCurrentPrice(live[live.length - 1].close);
          setLoading(false);
          return;
        }
      }
      const basePrice = symbol.includes("ETH") ? 3850 : symbol.includes("SOL") ? 178 : 67500;
      const generated = generateCandles(
        symbol,
        basePrice,
        mode as ChartMode,
        intensity,
        Date.now(),
        100,
      );
      if (active) {
        setCandles(generated);
        setCurrentPrice(generated[generated.length - 1].close);
        setLoading(false);
      }
    };

    loadData();

    const interval = setInterval(async () => {
      if (mode === "live") {
        const live = await fetchBinanceLiveCandles(symbol, 100);
        if (live && live.length > 0 && active) {
          setCandles(live);
          setCurrentPrice(live[live.length - 1].close);
        }
      } else {
        setCandles((prev) => {
          if (!prev.length) return prev;
          const last = prev[prev.length - 1];
          const basePrice = symbol.includes("ETH") ? 3850 : symbol.includes("SOL") ? 178 : 67500;
          const next = nextCandle(last, basePrice, mode as ChartMode, intensity, Math.random);
          setCurrentPrice(next.close);
          return [...prev.slice(1), next];
        });
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [mode, intensity, symbol]);

  return (
    <div className="mt-3 rounded-xl border border-border bg-card/80 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
          <span className="font-bold text-xs uppercase tracking-wider">
            {symbol} Live Chart Stream
          </span>
          <Badge variant="outline" className="text-[10px] uppercase">
            Mode: {mode} ({intensity}x)
          </Badge>
        </div>
        <div className="text-right tabular-nums text-xs font-semibold text-emerald-400">
          $
          {currentPrice > 0
            ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })
            : "—"}
        </div>
      </div>
      {loading ? (
        <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" /> Loading live chart feed...
        </div>
      ) : (
        <div className="h-56 w-full">
          <TradingChart candles={candles} showMA={true} showRSI={false} />
        </div>
      )}
    </div>
  );
}

function UserRow({
  user,
  isAdminUser,
  onChange,
  tickers,
}: {
  user: any;
  isAdminUser?: boolean;
  onChange: () => void | Promise<unknown>;
  tickers?: Record<string, Ticker>;
}) {
  const saveUserChart = useServerFn(updateAdminChart);
  const adjustBalance = useServerFn(adjustAdminBalance);
  const adjustCrypto = useServerFn(adjustAdminCryptoBalance);
  const toggleMode = useServerFn(toggleAdminAccountMode);
  const toggleSuspend = useServerFn(toggleAdminSuspend);
  const toggleAiTrading = useServerFn(toggleAdminAiTrading);
  const [mode, setMode] = useState<string>(user.chart_mode ?? "live");
  const [intensity, setIntensity] = useState<string>(String(user.chart_intensity ?? 1));
  const [creditAmt, setCreditAmt] = useState("");
  const [cryptoSym, setCryptoSym] = useState("BTC");
  const [cryptoQty, setCryptoQty] = useState("");
  const [showChart, setShowChart] = useState(false);

  const liveCryptoUsd = useMemo(() => {
    const jsonCrypto = ((user as any)?.crypto_balances ?? {}) as Record<string, number>;
    const { totalCryptoUsd } = computeEnrichedCryptoAssets([], jsonCrypto, tickers);
    return totalCryptoUsd > 0 ? totalCryptoUsd : Number(user.crypto_usd_balance ?? 0);
  }, [user, tickers]);

  const curSymUpper = cryptoSym.toUpperCase();
  const curTick = tickers?.[curSymUpper] || tickers?.[`${curSymUpper}USDT`];
  const curPrice = curSymUpper === "USDT" || curSymUpper === "USDC" ? 1.0 : (curTick?.price ?? 0);
  const qtyVal = Number(cryptoQty || 0);
  const estDirectUsd = qtyVal * curPrice;

  const saveChart = async () => {
    try {
      await saveUserChart({
        data: {
          userId: user.id,
          mode: mode as "profit" | "loss" | "flat" | "live",
          intensity: Number(intensity) || 1,
        },
      });
      toast.success("Chart updated");
      await onChange();
    } catch (err: any) {
      toast.error(err.message ?? "Could not update chart");
    }
  };

  const creditProfit = async (sign: 1 | -1) => {
    const amt = Number(creditAmt);
    if (!amt || amt <= 0) return toast.error("Enter amount");
    try {
      await adjustBalance({
        data: { userId: user.id, amount: amt, direction: sign > 0 ? "credit" : "debit" },
      });
      toast.success(`${sign > 0 ? "Credited" : "Debited"} $${amt.toFixed(2)}`);
      setCreditAmt("");
      await onChange();
    } catch (err: any) {
      toast.error(err.message ?? "Could not adjust balance");
    }
  };

  const creditDirectCrypto = async (sign: 1 | -1) => {
    const qty = Number(cryptoQty);
    if (!qty || qty <= 0) return toast.error("Enter valid crypto quantity");
    const sym = cryptoSym.toUpperCase();

    try {
      await adjustCrypto({
        data: {
          userId: user.id,
          symbol: sym,
          quantity: qty,
          direction: sign > 0 ? "credit" : "debit",
        },
      });

      toast.success(`${sign > 0 ? "Credited" : "Debited"} ${qty} ${sym} from user's wallet`);
      setCryptoQty("");
      await onChange();
    } catch (err: any) {
      toast.error(err.message ?? `Failed to ${sign > 0 ? "credit" : "debit"} crypto`);
    }
  };

  const setAccountMode = async (checked: boolean) => {
    const nextMode = checked ? "live" : "demo";
    try {
      await toggleMode({ data: { userId: user.id, mode: nextMode } });
      toast.success(`Account switched to ${nextMode.toUpperCase()}`);
      await onChange();
    } catch (err: any) {
      toast.error(err.message ?? "Could not switch account mode");
    }
  };

  const setSuspended = async (checked: boolean) => {
    try {
      await toggleSuspend({ data: { userId: user.id, suspended: checked } });
      toast.success(checked ? "Account suspended" : "Account restored");
      await onChange();
    } catch (err: any) {
      toast.error(err.message ?? "Could not update suspension");
    }
  };

  const setAiTrading = async (checked: boolean) => {
    try {
      await toggleAiTrading({ data: { userId: user.id, enabled: checked } });
      toast.success(checked ? "AI trading enabled" : "AI trading disabled");
      await onChange();
    } catch (err: any) {
      toast.error(err.message ?? "Could not update AI trading");
    }
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold flex items-center gap-1.5">
            {(SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase?.()) ||
              user.role === "super_admin") && <Crown className="h-4 w-4 text-amber-400" />}
            {user.full_name ?? "—"}
            {(SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase?.()) ||
              user.role === "super_admin") && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-[10px]">
                Super Admin
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{user.email ?? user.id}</div>
          <div className="text-xs text-muted-foreground">
            Country: {user.country ?? "Australia"}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums">
            <span className="text-blue-400">
              Cash: $
              {Number(user.cash_balance ?? user.available_cash ?? user.live_balance ?? 0).toFixed(
                2,
              )}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-amber-400">
              Demo: ${Number(user.demo_balance ?? 0).toFixed(2)}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <Activity className="h-3 w-3 text-emerald-400 animate-pulse" />
              Crypto: ${liveCryptoUsd.toFixed(2)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge
              variant={user.account_mode === "live" ? "default" : "secondary"}
              className={user.account_mode === "live" ? "bg-success text-success-foreground" : ""}
            >
              {String(user.account_mode ?? "demo").toUpperCase()}
            </Badge>
            <Badge variant={user.kyc_status === "approved" ? "default" : "outline"}>
              {String(user.kyc_status ?? "none").toUpperCase()} KYC
            </Badge>
            <Badge variant={user.ai_trading_enabled ? "default" : "outline"}>
              {user.ai_trading_enabled ? "AI ON" : "AI OFF"}
            </Badge>
            {user.is_suspended && <Badge variant="destructive">Suspended</Badge>}
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
          <label className="flex items-center justify-between gap-3">
            <span>Live mode</span>
            <Switch checked={user.account_mode === "live"} onCheckedChange={setAccountMode} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>AI trading</span>
            <Switch checked={!!user.ai_trading_enabled} onCheckedChange={setAiTrading} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1">
              <Ban className="h-3 w-3" /> Suspend
            </span>
            <Switch checked={!!user.is_suspended} onCheckedChange={setSuspended} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-primary" /> Admin access
            </span>
            <Switch
              checked={!!isAdminUser}
              disabled={
                SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase?.()) ||
                user.role === "super_admin"
              }
              onCheckedChange={async (checked) => {
                if (
                  SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase?.()) ||
                  user.role === "super_admin"
                ) {
                  toast.error("Super Admin privileges cannot be modified");
                  return;
                }
                try {
                  const fn = checked ? "admin_grant_admin" : "admin_revoke_admin";
                  const { error } = await supabase.rpc(fn as never, { _target: user.id } as never);
                  if (error) throw error;
                  toast.success(checked ? "Admin access granted" : "Admin access revoked");
                  await onChange();
                } catch (err: any) {
                  toast.error(err.message ?? "Could not update role");
                }
              }}
            />
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Chart direction</Label>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="live">
                <Activity className="inline mr-1 h-3 w-3 text-emerald-400" /> Sync with live price
              </SelectItem>
              <SelectItem value="profit">
                <TrendingUp className="inline mr-1 h-3 w-3 text-emerald-500" /> Profit (up)
              </SelectItem>
              <SelectItem value="loss">
                <TrendingDown className="inline mr-1 h-3 w-3 text-rose-500" /> Loss (down)
              </SelectItem>
              <SelectItem value="flat">
                <Minus className="inline mr-1 h-3 w-3" /> Flat
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Intensity (0.1 – 5)</Label>
          <Input
            type="number"
            min={0.1}
            max={5}
            step={0.1}
            value={intensity}
            onChange={(e) => setIntensity(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={saveChart} className="flex-1">
            <Save className="mr-1.5 h-4 w-4" /> Save chart
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowChart((v) => !v)}
            title="Toggle Live Chart Stream"
          >
            <Activity className="h-4 w-4 text-emerald-400" />
          </Button>
        </div>
      </div>

      {showChart && (
        <AdminLiveChartPreview mode={mode} intensity={Number(intensity) || 1} symbol="BTC/USD" />
      )}

      {/* Credit USD & Direct Crypto Asset Controls */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 border-t border-border pt-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Credit / Debit Live Balance ($)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              placeholder="100.00"
              value={creditAmt}
              onChange={(e) => setCreditAmt(e.target.value)}
              className="text-xs"
            />
            <Button size="sm" variant="outline" onClick={() => creditProfit(-1)}>
              Debit
            </Button>
            <Button
              size="sm"
              onClick={() => creditProfit(1)}
              className="bg-success hover:bg-success/90 text-success-foreground"
            >
              Credit
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Credit Crypto Asset Balance</Label>
          <div className="flex items-center gap-2">
            <Select value={cryptoSym} onValueChange={setCryptoSym}>
              <SelectTrigger className="w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BTC">BTC</SelectItem>
                <SelectItem value="ETH">ETH</SelectItem>
                <SelectItem value="USDT">USDT</SelectItem>
                <SelectItem value="BNB">BNB</SelectItem>
                <SelectItem value="SOL">SOL</SelectItem>
                <SelectItem value="XRP">XRP</SelectItem>
                <SelectItem value="ADA">ADA</SelectItem>
                <SelectItem value="DOGE">DOGE</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              step="0.000001"
              placeholder="Qty (e.g. 0.5)"
              value={cryptoQty}
              onChange={(e) => setCryptoQty(e.target.value)}
              className="text-xs flex-1"
            />
            <div className="flex gap-1.5">
              <Button
                size="sm"
                onClick={() => creditDirectCrypto(-1)}
                variant="destructive"
                className="px-2"
              >
                Debit
              </Button>
              <Button
                size="sm"
                onClick={() => creditDirectCrypto(1)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-2"
              >
                Credit
              </Button>
            </div>
          </div>
          {curPrice > 0 && (
            <div className="mt-1 text-[11px] font-medium text-emerald-400 flex items-center gap-1">
              <span>
                1 {curSymUpper} = ${curPrice.toLocaleString()} (Binance WS)
              </span>
              {qtyVal > 0 && (
                <span className="font-bold">
                  · Total: $
                  {estDirectUsd.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function KycTab({
  items,
  users,
  loading,
  refetch,
}: {
  items?: any[];
  users?: any[];
  loading: boolean;
  refetch: () => void | Promise<unknown>;
}) {
  const decideKyc = useServerFn(decideAdminKyc);
  const getDocUrl = useServerFn(getAdminKycUrl);

  const decide = async (id: string, status: "approved" | "rejected") => {
    try {
      await decideKyc({
        data: {
          id,
          status,
          note: status === "approved" ? "Verified by admin" : "Rejected by admin",
        },
      });
      toast.success(`KYC ${status}`);
      await refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Could not update KYC");
    }
  };

  const openDoc = async (path: string) => {
    try {
      const res = await getDocUrl({ data: { path } });
      if (!res?.url) {
        toast.error("Could not generate document URL");
        return;
      }
      safeOpenUrl(res.url);
    } catch (err: any) {
      toast.error(err.message ?? "Could not open document");
    }
  };

  if (loading)
    return (
      <Card className="p-6">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  const pending = (items ?? []).filter((k) => k.status === "pending");
  const rows = pending.length ? pending : (items ?? []);
  if (!rows.length)
    return <Card className="p-6 text-sm text-muted-foreground">No KYC submissions yet.</Card>;

  return (
    <Card className="p-4">
      <div className="space-y-2">
        {rows.map((k: any) => {
          const owner = users?.find((u) => u.id === k.user_id);
          return (
            <div
              key={k.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {k.full_name} · {k.document_type}
                </div>
                <div className="text-xs text-muted-foreground">
                  {owner?.email ?? k.user_id} · {k.country ?? "—"} ·{" "}
                  {new Date(k.created_at).toLocaleString()}
                </div>
                {k.admin_note && (
                  <div className="text-xs text-muted-foreground">Note: {k.admin_note}</div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    k.status === "approved"
                      ? "default"
                      : k.status === "rejected"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {k.status}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => openDoc(k.document_url)}>
                  <FileText className="mr-1 h-4 w-4" /> View
                </Button>
                {k.status === "pending" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => decide(k.id, "rejected")}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={() => decide(k.id, "approved")}>
                      <Check className="mr-1 h-4 w-4" /> Approve
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function NewsTab({
  items,
  loading,
  refetch,
}: {
  items?: any[];
  loading: boolean;
  refetch: () => void | Promise<unknown>;
}) {
  const postNews = useServerFn(postAdminNews);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [impact, setImpact] = useState<"low" | "medium" | "high">("medium");
  const [source, setSource] = useState("Dew Trades Desk");

  const publish = async () => {
    if (!title.trim()) return toast.error("Enter a news headline");
    try {
      await postNews({
        data: {
          title: title.trim(),
          body: body.trim(),
          impact,
          source: source.trim() || "Dew Trades Desk",
        },
      });
      toast.success("Market news published");
      setTitle("");
      setBody("");
      await refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Could not publish news");
    }
  };

  if (loading)
    return (
      <Card className="p-6">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Card className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Newspaper className="h-4 w-4 text-primary" /> Publish market news
        </h2>
        <div className="space-y-2">
          <Label>Headline</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
        </div>
        <div className="space-y-2">
          <Label>Details</Label>
          <Textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Impact</Label>
            <Select value={impact} onValueChange={(v) => setImpact(v as "low" | "medium" | "high")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Source</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} maxLength={120} />
          </div>
        </div>
        <Button onClick={publish} className="w-full">
          <Save className="mr-1.5 h-4 w-4" /> Publish
        </Button>
      </Card>
      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold">Published ticker</h2>
        {!items?.length ? (
          <p className="text-sm text-muted-foreground">No news yet.</p>
        ) : (
          <div className="space-y-2">
            {items.map((n: any) => (
              <div
                key={n.id}
                className="rounded-lg border border-border bg-surface px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={n.impact === "high" ? "destructive" : "secondary"}>
                    {n.impact}
                  </Badge>
                  <span className="font-semibold">{n.title}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {n.source ?? "Wire"} · {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ComplaintsTab({
  items,
  loading,
  refetch,
}: {
  items?: any[];
  loading: boolean;
  refetch: () => void | Promise<unknown>;
}) {
  const updateComplaint = useServerFn(updateAdminComplaint);

  const setStatus = async (id: string, status: string) => {
    try {
      await updateComplaint({ data: { id, status: status as "pending" | "resolved" } });
      toast.success("Updated");
      await refetch();
    } catch (err: any) {
      toast.error(err.message ?? "Could not update complaint");
    }
  };

  if (loading)
    return (
      <Card className="p-6">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  if (!items?.length)
    return <Card className="p-6 text-sm text-muted-foreground">No complaints.</Card>;

  return (
    <div className="space-y-2">
      {items.map((c: any) => (
        <Card key={c.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{c.subject}</div>
              <div className="text-xs text-muted-foreground">
                {c.name} · {c.email} · {new Date(c.created_at).toLocaleString()}
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap">{c.message}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Badge
                variant={c.status === "resolved" ? "default" : "secondary"}
                className={c.status === "resolved" ? "bg-success text-success-foreground" : ""}
              >
                {c.status}
              </Badge>
              {c.status !== "resolved" && (
                <Button size="sm" onClick={() => setStatus(c.id, "resolved")}>
                  Mark resolved
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Comprehensive Settings Tab ─────────────────────────────────────────────

type PlatformRow = {
  id: string;
  category: string;
  key_name: string;
  value: string;
  description?: string;
};

type FieldDef = {
  key: string;
  label: string;
  type: "number" | "text";
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
};

type SectionDef = {
  category: string;
  label: string;
  icon: React.ReactNode;
  fields: FieldDef[];
};

const SETTINGS_SECTIONS: SectionDef[] = [
  {
    category: "fees",
    label: "Fees & Rates",
    icon: <DollarSign className="h-4 w-4" />,
    fields: [
      {
        key: "min_deposit_usd",
        label: "Minimum deposit",
        type: "number",
        unit: "$",
        min: 1,
        step: 1,
      },
      {
        key: "gas_fee_percent",
        label: "Processing / gas fee",
        type: "number",
        unit: "%",
        min: 0,
        max: 100,
        step: 0.1,
      },
      {
        key: "withdrawal_tax_percent",
        label: "Withdrawal tax",
        type: "number",
        unit: "%",
        min: 0,
        max: 100,
        step: 0.1,
      },
      {
        key: "referral_profit_share_percent",
        label: "Referral deposit bonus",
        type: "number",
        unit: "%",
        min: 0,
        max: 100,
        step: 1,
      },
      {
        key: "referral_min_deposit_usd",
        label: "Min deposit to trigger referral",
        type: "number",
        unit: "$",
        min: 0,
        step: 1,
      },
      {
        key: "withdrawal_clearing_days",
        label: "Withdrawal clearing period",
        type: "number",
        unit: "days",
        min: 0,
        max: 90,
        step: 1,
      },
      {
        key: "max_leverage",
        label: "Maximum trading leverage",
        type: "number",
        unit: "×",
        min: 1,
        max: 2000,
        step: 1,
      },
    ],
  },
  {
    category: "financial",
    label: "Financial Limits",
    icon: <BarChart3 className="h-4 w-4" />,
    fields: [
      {
        key: "max_deposit_usd",
        label: "Maximum single deposit",
        type: "number",
        unit: "$",
        min: 100,
        step: 1000,
      },
      {
        key: "min_withdrawal_usd",
        label: "Minimum withdrawal",
        type: "number",
        unit: "$",
        min: 1,
        step: 1,
      },
      {
        key: "max_withdrawal_usd",
        label: "Maximum single withdrawal",
        type: "number",
        unit: "$",
        min: 100,
        step: 1000,
      },
      {
        key: "demo_balance_default",
        label: "Demo account start balance",
        type: "number",
        unit: "$",
        min: 100,
        step: 1000,
      },
    ],
  },
  {
    category: "timing",
    label: "Time Intervals",
    icon: <Clock className="h-4 w-4" />,
    fields: [
      {
        key: "payment_expiry_hours",
        label: "Buy-BTC payment window",
        type: "number",
        unit: "hrs",
        min: 0.25,
        max: 168,
        step: 0.25,
      },
      {
        key: "deposit_processing_hours",
        label: "Deposit processing ETA (display)",
        type: "number",
        unit: "hrs",
        min: 0.5,
        max: 72,
        step: 0.5,
      },
      {
        key: "withdrawal_processing_hours",
        label: "Withdrawal processing ETA",
        type: "number",
        unit: "hrs",
        min: 1,
        max: 336,
        step: 1,
      },
      {
        key: "kyc_review_hours",
        label: "KYC review SLA (display)",
        type: "number",
        unit: "hrs",
        min: 1,
        max: 336,
        step: 1,
      },
    ],
  },
  {
    category: "trading",
    label: "Trading & AI Bots",
    icon: <Cpu className="h-4 w-4" />,
    fields: [
      {
        key: "chart_drift_pct",
        label: "Chart drift intensity",
        type: "number",
        min: 0,
        max: 5,
        step: 0.01,
      },
      {
        key: "chart_volatility",
        label: "Candle volatility factor",
        type: "number",
        min: 0.0001,
        max: 0.5,
        step: 0.0001,
      },
      {
        key: "ai_trade_cooldown_seconds",
        label: "AI trade cooldown (between trades)",
        type: "number",
        unit: "s",
        min: 1,
        max: 600,
        step: 1,
      },
      {
        key: "ai_loss_cooldown_seconds",
        label: "AI loss cooldown (after loss)",
        type: "number",
        unit: "s",
        min: 1,
        max: 1200,
        step: 1,
      },
      {
        key: "min_ai_trade_usd",
        label: "Min AI trade size",
        type: "number",
        unit: "$",
        min: 1,
        step: 1,
      },
      {
        key: "max_ai_trade_usd",
        label: "Max AI trade size",
        type: "number",
        unit: "$",
        min: 10,
        step: 10,
      },
      {
        key: "default_signal_credits",
        label: "Signal credits on signup",
        type: "number",
        min: 0,
        max: 1000,
        step: 1,
      },
    ],
  },
  {
    category: "branding",
    label: "Branding & Contact",
    icon: <Megaphone className="h-4 w-4" />,
    fields: [
      {
        key: "hero_headline",
        label: "Hero section headline",
        type: "text",
        placeholder: "Trade Smarter, Earn Bigger",
      },
      {
        key: "support_email",
        label: "Support email address",
        type: "text",
        placeholder: "support@dewtrades.com",
      },
      {
        key: "platform_name",
        label: "Platform display name",
        type: "text",
        placeholder: "Dew Trades",
      },
    ],
  },
];

// ============ WALLET & DEPOSIT ADDRESS METADATA ============
interface WalletMeta {
  key: string;
  name: string;
  symbol: string;
  network: string;
  category: "crypto" | "memo" | "fee" | "fiat" | "custom";
  description: string;
  placeholder: string;
  badgeColor: string;
  usage: string;
}

const KNOWN_WALLET_CONFIGS: WalletMeta[] = [
  {
    key: "deposit_wallet_btc",
    name: "Bitcoin (BTC)",
    symbol: "BTC",
    network: "Bitcoin Native Mainnet",
    category: "crypto",
    description:
      "Native Bitcoin mainnet address used for BTC deposits on /deposit, /buy-bitcoin, and everywhere across the platform",
    placeholder: "bc1qx96yh78eq52yrfe7fqk9hhcgr9w886s7pffjay",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    usage: "/deposit, /buy-bitcoin, Wallets",
  },
  {
    key: "deposit_wallet_eth",
    name: "Ethereum (ETH)",
    symbol: "ETH",
    network: "Ethereum Mainnet (ERC20)",
    category: "crypto",
    description:
      "Ethereum native deposit address for ETH transfers on /deposit and payment gateways",
    placeholder: "0x8B911165295C78935F53753e9D8DBC566104C514",
    badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    usage: "/deposit, Payment channels",
  },
  {
    key: "deposit_wallet_usdt_trc20",
    name: "Tether USD (TRC-20)",
    symbol: "USDT",
    network: "TRON (TRC20)",
    category: "crypto",
    description: "Low-fee Tron TRC-20 deposit address for Tether USDT deposits",
    placeholder: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    usage: "/deposit, Instant USDT",
  },
  {
    key: "deposit_wallet_usdt_bep20",
    name: "Tether USD (BEP-20)",
    symbol: "USDT",
    network: "BNB Smart Chain (BSC)",
    category: "crypto",
    description: "Binance Smart Chain BEP-20 deposit address for USDT",
    placeholder: "0x71c8b3f465d38a37f59d57a2e584f3ab1d3e8e19",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    usage: "/deposit",
  },
  {
    key: "deposit_wallet_usdt",
    name: "Tether USD (ERC-20)",
    symbol: "USDT",
    network: "Ethereum Mainnet (ERC20)",
    category: "crypto",
    description: "Ethereum Mainnet ERC-20 deposit address for USDT",
    placeholder: "0x71c8b3f465d38a37f59d57a2e584f3ab1d3e8e19",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    usage: "/deposit",
  },
  {
    key: "deposit_wallet_xrp",
    name: "Ripple (XRP)",
    symbol: "XRP",
    network: "XRPL Native Mainnet",
    category: "crypto",
    description:
      "Primary Ripple ledger wallet address used for XRP deposits and instant checkout on /buy-xrp",
    placeholder: "rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh",
    badgeColor: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    usage: "/deposit, /buy-xrp",
  },
  {
    key: "deposit_tag_xrp",
    name: "XRP Destination Tag / Memo",
    symbol: "XRP TAG",
    network: "Numeric Memo",
    category: "memo",
    description:
      "Unique numeric destination tag shown to users so XRP deposits are properly identified and credited",
    placeholder: "849201",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    usage: "/deposit, /buy-xrp",
  },
  {
    key: "deposit_wallet_sol",
    name: "Solana (SOL)",
    symbol: "SOL",
    network: "Solana Native SPL",
    category: "crypto",
    description: "Solana native deposit address for SOL transfers",
    placeholder: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    usage: "/deposit",
  },
  {
    key: "deposit_wallet_doge",
    name: "Dogecoin (DOGE)",
    symbol: "DOGE",
    network: "Dogecoin Mainnet",
    category: "crypto",
    description: "Dogecoin native deposit address",
    placeholder: "D8vERFXvPZ29KkK7hKkL7mH5n8mPZ8kH8",
    badgeColor: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    usage: "/deposit",
  },
  {
    key: "deposit_wallet_ada",
    name: "Cardano (ADA)",
    symbol: "ADA",
    network: "Cardano Shelley",
    category: "crypto",
    description: "Cardano native deposit address",
    placeholder: "addr1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    usage: "/deposit",
  },
  {
    key: "deposit_wallet_bnb",
    name: "Binance Coin (BNB)",
    symbol: "BNB",
    network: "BNB Smart Chain (BEP20)",
    category: "crypto",
    description: "Binance Coin native deposit address",
    placeholder: "0x71c8b3f465d38a37f59d57a2e584f3ab1d3e8e19",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    usage: "/deposit",
  },
  {
    key: "deposit_wallet_ltc",
    name: "Litecoin (LTC)",
    symbol: "LTC",
    network: "Litecoin Native",
    category: "crypto",
    description: "Litecoin native mainnet deposit address",
    placeholder: "LQt8w9K5oP5oW5rW5vX5yZ5aB5cD5eF5gH",
    badgeColor: "bg-slate-400/10 text-slate-300 border-slate-400/30",
    usage: "/deposit",
  },
  {
    key: "payment_method_cashapp",
    name: "Cash App ($Cashtag)",
    symbol: "CASH APP",
    network: "Instant Peer-to-Peer",
    category: "fiat",
    description:
      "Official Cash App $Cashtag displayed to users on /deposit and instant buy gateways",
    placeholder: "$DewTradesTreasury",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    usage: "/deposit, /buy-bitcoin, /buy-xrp",
  },
  {
    key: "payment_method_paypal",
    name: "PayPal (Email / Account)",
    symbol: "PAYPAL",
    network: "Instant Transfer",
    category: "fiat",
    description: "Official PayPal recipient account for instant deposits",
    placeholder: "deposits@dewtrades.com",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    usage: "/deposit, /buy-bitcoin, /buy-xrp",
  },
  {
    key: "payment_method_zelle",
    name: "Zelle (Email / Phone)",
    symbol: "ZELLE",
    network: "Bank Peer-to-Peer",
    category: "fiat",
    description: "Official Zelle recipient identifier for zero-fee USD deposits",
    placeholder: "deposits@dewtrades.com",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    usage: "/deposit, /buy-bitcoin, /buy-xrp",
  },
  {
    key: "payment_method_chime",
    name: "Chime (Handle / Tag)",
    symbol: "CHIME",
    network: "Instant Chime-to-Chime",
    category: "fiat",
    description: "Official Chime account handle for direct member transfers",
    placeholder: "@dewtradesdeposits",
    badgeColor: "bg-teal-500/10 text-teal-400 border-teal-500/30",
    usage: "/deposit, /buy-bitcoin, /buy-xrp",
  },
  {
    key: "payment_method_applepay",
    name: "Apple Pay (Phone Number)",
    symbol: "APPLE PAY",
    network: "Direct iOS Pay",
    category: "fiat",
    description: "Official Apple Pay recipient number for iMessage transfers",
    placeholder: "+1 (800) DEW-TRD",
    badgeColor: "bg-slate-200/10 text-slate-200 border-slate-200/30",
    usage: "/deposit, /buy-bitcoin, /buy-xrp",
  },
  {
    key: "payment_method_venmo",
    name: "Venmo (@Handle)",
    symbol: "VENMO",
    network: "Social Pay",
    category: "fiat",
    description: "Official Venmo handle for peer transfers",
    placeholder: "@DewTradesTreasury",
    badgeColor: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    usage: "/deposit, /buy-bitcoin, /buy-xrp",
  },
  {
    key: "payment_method_bankwire",
    name: "Bank Wire Transfer Coordinates",
    symbol: "BANK WIRE",
    network: "Fedwire / SWIFT",
    category: "fiat",
    description: "Official routing and account wire coordinates for institutional wire deposits",
    placeholder: "Routing: 021000021 · Account: 000123456789",
    badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    usage: "/deposit, /buy-bitcoin, /buy-xrp",
  },
  {
    key: "withdrawal_fee_wallet",
    name: "Withdrawal Fee Collection Wallet",
    symbol: "FEE",
    network: "System Escrow",
    category: "fee",
    description:
      "Default fee address displayed to users when tax or withdrawal fee settlement is required",
    placeholder: "0x8B911165295C78935F53753e9D8DBC566104C514",
    badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    usage: "/withdraw & Tax settlements",
  },
];

const PRESET_NEW_WALLETS = [
  { key: "deposit_wallet_sol", name: "Solana (SOL)", symbol: "SOL", network: "Solana SPL" },
  { key: "deposit_wallet_doge", name: "Dogecoin (DOGE)", symbol: "DOGE", network: "Dogecoin" },
  { key: "deposit_wallet_ada", name: "Cardano (ADA)", symbol: "ADA", network: "Cardano" },
  { key: "deposit_wallet_bnb", name: "BNB (Binance Coin)", symbol: "BNB", network: "BSC (BEP20)" },
  { key: "deposit_wallet_ltc", name: "Litecoin (LTC)", symbol: "LTC", network: "Litecoin Native" },
  { key: "deposit_wallet_ton", name: "Toncoin (TON)", symbol: "TON", network: "The Open Network" },
  { key: "deposit_wallet_avax", name: "Avalanche (AVAX)", symbol: "AVAX", network: "C-Chain" },
  { key: "deposit_wallet_pol", name: "Polygon (POL/MATIC)", symbol: "POL", network: "Polygon POS" },
  { key: "deposit_wallet_trx", name: "TRON (TRX)", symbol: "TRX", network: "TRC20" },
  {
    key: "custom",
    name: "Custom / Arbitrary Coin Key",
    symbol: "CUSTOM",
    network: "Custom Network",
  },
];

export function AdminWalletsTab({
  walletItems,
  bankMethods,
  walletsLoading,
  refetchWallets,
}: {
  walletItems?: any[];
  bankMethods?: any[];
  walletsLoading: boolean;
  refetchWallets: () => void | Promise<unknown>;
}) {
  const qc = useQueryClient();
  const updateWallet = useServerFn(updateAdminSetting);
  const deleteWallet = useServerFn(deleteAdminSetting);
  const updateBank = useServerFn(updateAdminBankMethod);

  const [walletVals, setWalletVals] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCat, setFilterCat] = useState<
    "all" | "crypto" | "fiat" | "bank" | "memo" | "fee" | "custom"
  >("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Bank Wire form state
  const [bankForm, setBankForm] = useState({
    id: "",
    method_name: "Federal Wire / ACH",
    bank_name: "JPMorgan Chase Bank, N.A.",
    account_name: "Dew Trades Prime LLC",
    account_number: "9876543210",
    routing_number: "021000021",
    swift_code: "CHASUS33",
    bank_address: "270 Park Ave, New York, NY 10017",
    notes:
      "Include your registered email in the transfer memo for instant automatic ledger crediting.",
  });
  const [savingBank, setSavingBank] = useState(false);

  // Sync bank methods from DB
  useEffect(() => {
    if (bankMethods && bankMethods.length > 0) {
      const b = bankMethods[0];
      setBankForm({
        id: b.id || "",
        method_name: b.method_name || "Federal Wire / ACH",
        bank_name: b.bank_name || "",
        account_name: b.account_name || "",
        account_number: b.account_number || "",
        routing_number: b.routing_number || "",
        swift_code: b.swift_code || "",
        bank_address: b.bank_address || "",
        notes: b.notes || "",
      });
    }
  }, [bankMethods]);

  // Sync incoming database settings into local edit buffer
  useEffect(() => {
    if (walletItems) {
      const m: Record<string, string> = {};
      walletItems.forEach((r: any) => {
        m[r.key] = r.value ?? "";
      });
      setWalletVals((prev) => {
        const merged = { ...m };
        Object.entries(prev).forEach(([k, v]) => {
          if (v !== m[k]) merged[k] = v;
        });
        return merged;
      });
    }
  }, [walletItems]);

  const handleSave = async (key: string) => {
    setSavingKey(key);
    try {
      const val = walletVals[key] ?? "";
      await updateWallet({ data: { key, value: val } });
      toast.success(`Saved address for ${key}`);

      // Keep BTC and withdrawal fee synchronized in local state as well
      if (key === "deposit_wallet_btc") {
        setWalletVals((prev) => ({ ...prev, withdrawal_fee_wallet: val }));
      } else if (key === "withdrawal_fee_wallet") {
        setWalletVals((prev) => ({ ...prev, deposit_wallet_btc: val }));
      }

      // Invalidate all query caches across the application
      await Promise.all([
        refetchWallets(),
        qc.invalidateQueries({ queryKey: ["public_payment_details"] }),
        qc.invalidateQueries({ queryKey: ["app_settings"] }),
        qc.invalidateQueries({ queryKey: ["deposit_wallets"] }),
        qc.invalidateQueries({ queryKey: ["admin_payment_methods"] }),
        qc.invalidateQueries({ queryKey: ["admin_payment_methods_active"] }),
        qc.invalidateQueries({ queryKey: ["payment_methods"] }),
        qc.invalidateQueries({ queryKey: ["payment_methods_active"] }),
        qc.invalidateQueries({ queryKey: ["buy_payment_methods"] }),
        qc.invalidateQueries({ queryKey: ["platform_settings"] }),
        qc.invalidateQueries({ queryKey: ["platform_settings_public"] }),
      ]);

      // Broadcast realtime event so open user tabs immediately refresh addresses
      supabase.channel("dewtrades-global-realtime").send({
        type: "broadcast",
        event: "admin-ops-update",
        payload: { table: "app_settings", key, value: val },
      });
      supabase.channel("dewtrades-deposit-wallets-realtime").send({
        type: "broadcast",
        event: "admin-ops-update",
        payload: { table: "app_settings", key, value: val },
      });
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveBank = async () => {
    setSavingBank(true);
    try {
      await updateBank({
        data: {
          id: bankForm.id || undefined,
          method_name: bankForm.method_name,
          bank_name: bankForm.bank_name,
          account_name: bankForm.account_name,
          account_number: bankForm.account_number,
          routing_number: bankForm.routing_number,
          swift_code: bankForm.swift_code,
          bank_address: bankForm.bank_address,
          notes: bankForm.notes,
        },
      });
      toast.success("Bank Wire & Interbank coordinates saved and live on site!");

      await Promise.all([
        refetchWallets(),
        qc.invalidateQueries({ queryKey: ["public_payment_details"] }),
        qc.invalidateQueries({ queryKey: ["bank_deposit_methods"] }),
        qc.invalidateQueries({ queryKey: ["app_settings"] }),
        qc.invalidateQueries({ queryKey: ["admin_payment_methods"] }),
        qc.invalidateQueries({ queryKey: ["admin_overview"] }),
      ]);

      supabase.channel("dewtrades-global-realtime").send({
        type: "broadcast",
        event: "admin-ops-update",
        payload: { table: "bank_deposit_methods", data: bankForm },
      });
      supabase.channel("dewtrades-deposit-wallets-realtime").send({
        type: "broadcast",
        event: "admin-ops-update",
        payload: { table: "bank_deposit_methods", data: bankForm },
      });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save bank coordinates");
    } finally {
      setSavingBank(false);
    }
  };

  const handleDelete = async (key: string) => {
    setDeletingKey(key);
    try {
      await deleteWallet({ data: { key } });
      toast.success(`Removed ${key}`);
      setWalletVals((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      await Promise.all([
        refetchWallets(),
        qc.invalidateQueries({ queryKey: ["app_settings"] }),
        qc.invalidateQueries({ queryKey: ["deposit_wallets"] }),
        qc.invalidateQueries({ queryKey: ["admin_payment_methods"] }),
        qc.invalidateQueries({ queryKey: ["admin_payment_methods_active"] }),
        qc.invalidateQueries({ queryKey: ["payment_methods"] }),
        qc.invalidateQueries({ queryKey: ["payment_methods_active"] }),
        qc.invalidateQueries({ queryKey: ["buy_payment_methods"] }),
      ]);

      supabase.channel("dewtrades-global-realtime").send({
        type: "broadcast",
        event: "admin-ops-update",
        payload: { table: "app_settings", key, action: "delete" },
      });
    } catch (err: any) {
      toast.error(err.message ?? "Delete failed");
    } finally {
      setDeletingKey(null);
      setConfirmDeleteKey(null);
    }
  };

  const handleCopy = (key: string, text: string) => {
    if (!text) {
      toast.info("No address to copy yet");
      return;
    }
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Address copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Combine known configs with any additional custom keys present in database
  const allKeys = useMemo(() => {
    const knownKeys = new Set(KNOWN_WALLET_CONFIGS.map((c) => c.key));
    const list: WalletMeta[] = [...KNOWN_WALLET_CONFIGS];

    // Check if there are keys in walletVals not in known list
    Object.keys(walletVals).forEach((k) => {
      if (
        (k.startsWith("deposit_wallet_") ||
          k.startsWith("deposit_tag_") ||
          k.includes("wallet") ||
          k.includes("deposit")) &&
        !knownKeys.has(k)
      ) {
        list.push({
          key: k,
          name:
            k.replace("deposit_wallet_", "").replace("deposit_tag_", "").toUpperCase() + " Address",
          symbol: k.split("_").pop()?.toUpperCase() || "CRYPTO",
          network: "Custom Key",
          category: "custom",
          description: `Custom configured key in app_settings table`,
          placeholder: "0x...",
          badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
          usage: "Active in app_settings",
        });
      }
    });

    return list;
  }, [walletVals]);

  const filteredList = useMemo(() => {
    return allKeys.filter((meta) => {
      if (filterCat !== "all" && meta.category !== filterCat) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        meta.name.toLowerCase().includes(q) ||
        meta.key.toLowerCase().includes(q) ||
        meta.symbol.toLowerCase().includes(q) ||
        meta.network.toLowerCase().includes(q) ||
        (walletVals[meta.key] ?? "").toLowerCase().includes(q)
      );
    });
  }, [allKeys, filterCat, searchQuery, walletVals]);

  return (
    <div className="space-y-6">
      {/* Top Banner with live synchronization explanation */}
      <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-r from-primary/10 via-background to-primary/5 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/20 p-2 text-primary">
                <Wallet className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold tracking-tight">
                Deposit Wallet & Payment Management
              </h2>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs gap-1"
              >
                <CheckCircle2 className="h-3 w-3" /> Live Synced
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
              Edit the official cryptocurrency addresses that users pay to. When you edit and save
              any address below, all user-facing screens (
              <span className="font-semibold text-foreground">/deposit</span>,{" "}
              <span className="font-semibold text-foreground">/buy-xrp</span>,{" "}
              <span className="font-semibold text-foreground">/buy-bitcoin</span>, and fee prompts)
              immediately update in real time with the new address and QR codes.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await refetchWallets();
                  toast.success("Wallet settings refreshed");
                } catch {
                  toast.error("Failed to refresh wallets");
                }
              }}
              disabled={walletsLoading}
              className="text-xs"
            >
              {walletsLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Refresh Data
            </Button>
          </div>
        </div>
      </Card>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search coin, network, key or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: "all", label: "All Keys" },
              { id: "crypto", label: "Crypto Wallets" },
              { id: "bank", label: "Bank Transfer & Wire" },
              { id: "fiat", label: "Payment Gateways" },
              { id: "memo", label: "Memos & Tags" },
              { id: "fee", label: "Fee Escrows" },
              { id: "custom", label: "Custom Added" },
            ] as const
          ).map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={filterCat === t.id ? "default" : "outline"}
              onClick={() => setFilterCat(t.id)}
              className="text-xs h-8 px-2.5 shrink-0"
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Official Bank Wire & Interbank Deposit Method Editor */}
      {(filterCat === "all" || filterCat === "bank" || filterCat === "fiat") && !searchQuery && (
        <Card className="overflow-hidden border-2 border-primary/30 bg-card shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 bg-primary/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/20 p-1.5 text-primary shrink-0">
                <Landmark className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                  Bank Wire & Interbank Transfer Coordinates
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]"
                  >
                    Active Gateway
                  </Badge>
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Official bank coordinates displayed on{" "}
                  <span className="font-semibold text-foreground">/deposit</span>,{" "}
                  <span className="font-semibold text-foreground">/buy-bitcoin</span>, and{" "}
                  <span className="font-semibold text-foreground">/buy-xrp</span> wire options.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleSaveBank}
              disabled={savingBank}
              className="text-xs h-8 bg-primary hover:bg-primary/90 font-bold shrink-0"
            >
              {savingBank ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1.5" />
              )}
              Save Bank Wire Details
            </Button>
          </div>

          <div className="p-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Bank Name</Label>
              <Input
                placeholder="e.g. JPMorgan Chase Bank, N.A."
                value={bankForm.bank_name}
                onChange={(e) => setBankForm((p) => ({ ...p, bank_name: e.target.value }))}
                className="text-xs h-8"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Account / Beneficiary Name</Label>
              <Input
                placeholder="e.g. Dew Trades Prime LLC"
                value={bankForm.account_name}
                onChange={(e) => setBankForm((p) => ({ ...p, account_name: e.target.value }))}
                className="text-xs h-8"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Account Number</Label>
              <Input
                placeholder="e.g. 9876543210"
                value={bankForm.account_number}
                onChange={(e) => setBankForm((p) => ({ ...p, account_number: e.target.value }))}
                className="text-xs h-8 font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Routing Number (ABA / Wire)</Label>
              <Input
                placeholder="e.g. 021000021"
                value={bankForm.routing_number}
                onChange={(e) => setBankForm((p) => ({ ...p, routing_number: e.target.value }))}
                className="text-xs h-8 font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">SWIFT / BIC Code</Label>
              <Input
                placeholder="e.g. CHASUS33"
                value={bankForm.swift_code}
                onChange={(e) => setBankForm((p) => ({ ...p, swift_code: e.target.value }))}
                className="text-xs h-8 font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Bank Physical Address</Label>
              <Input
                placeholder="e.g. 270 Park Ave, New York, NY 10017"
                value={bankForm.bank_address}
                onChange={(e) => setBankForm((p) => ({ ...p, bank_address: e.target.value }))}
                className="text-xs h-8"
              />
            </div>

            <div className="space-y-1 sm:col-span-2 md:col-span-3">
              <Label className="text-xs font-semibold">
                Wire Instructions / Reference Memo for Deposit
              </Label>
              <Input
                placeholder="e.g. Include your registered account email in the transfer memo for instant automatic ledger crediting."
                value={bankForm.notes}
                onChange={(e) => setBankForm((p) => ({ ...p, notes: e.target.value }))}
                className="text-xs h-8"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Wallets List Grid */}
      {walletsLoading ? (
        <Card className="p-8 flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading wallet configuration…</span>
        </Card>
      ) : filteredList.length === 0 ? (
        <Card className="p-8 text-center space-y-2">
          <Wallet className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
          <p className="text-sm font-medium">No matching wallet addresses found</p>
          <p className="text-xs text-muted-foreground">
            Try clearing your search query or add a new wallet key below.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredList.map((meta) => {
            const currentVal = walletVals[meta.key] ?? "";
            const isSaving = savingKey === meta.key;
            const isDeleting = deletingKey === meta.key;
            const isCopied = copiedKey === meta.key;
            const isSet = Boolean(currentVal && currentVal.trim().length > 0);

            return (
              <Card
                key={meta.key}
                className="overflow-hidden border border-border/80 hover:border-primary/40 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant="outline"
                        className={`font-mono text-[11px] px-2 py-0.5 border ${meta.badgeColor} shrink-0`}
                      >
                        {meta.symbol}
                      </Badge>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                          {meta.name}
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono truncate block">
                          {meta.network}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSet ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] py-0 px-1.5"
                        >
                          Configured
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] py-0 px-1.5"
                        >
                          Empty
                        </Badge>
                      )}
                      {meta.category === "custom" &&
                        (confirmDeleteKey === meta.key ? (
                          <div className="flex items-center gap-1 bg-destructive/10 border border-destructive/30 rounded px-1 py-0.5 animate-in fade-in">
                            <span className="text-[10px] text-destructive font-medium">
                              Delete?
                            </span>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(meta.key)}
                              disabled={isDeleting}
                              className="h-5 px-1.5 text-[10px] font-bold bg-rose-600 hover:bg-rose-500"
                            >
                              {isDeleting ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                "Yes"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmDeleteKey(null)}
                              disabled={isDeleting}
                              className="h-5 px-1 text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setConfirmDeleteKey(meta.key)}
                            disabled={isDeleting}
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            title="Delete custom key"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        ))}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-mono text-[11px] text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">
                        key: {meta.key}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Used on: <span className="font-medium text-foreground">{meta.usage}</span>
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {meta.description}
                    </p>

                    {/* Address Input & Actions */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium text-muted-foreground">
                          {meta.category === "memo"
                            ? "Destination Tag / Memo Value"
                            : meta.category === "fiat"
                              ? "Payment Address / Handle / Coordinates"
                              : "Wallet Address"}
                        </Label>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {currentVal.length} chars
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={currentVal}
                          onChange={(e) =>
                            setWalletVals((prev) => ({ ...prev, [meta.key]: e.target.value }))
                          }
                          onKeyDown={(e) => e.key === "Enter" && handleSave(meta.key)}
                          placeholder={meta.placeholder}
                          className="font-mono text-xs h-9 bg-background/50 focus:bg-background"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopy(meta.key, currentVal)}
                          disabled={!currentVal}
                          className="h-9 px-2.5 shrink-0"
                          title="Copy address"
                        >
                          {isCopied ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleSave(meta.key)}
                          disabled={isSaving}
                          className="h-9 px-3 shrink-0"
                        >
                          {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Save className="h-3.5 w-3.5 mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add New Custom / Override Wallet Card */}
      <CreateWalletCard
        onSave={async (key, value) => {
          await updateWallet({ data: { key, value } });
          await refetchWallets();
        }}
      />
    </div>
  );
}

function CreateWalletCard({ onSave }: { onSave: (key: string, value: string) => Promise<void> }) {
  const [selectedPreset, setSelectedPreset] = useState("deposit_wallet_sol");
  const [customKey, setCustomKey] = useState("");
  const [addressVal, setAddressVal] = useState("");
  const [saving, setSaving] = useState(false);

  const activeKey = selectedPreset === "custom" ? customKey.trim() : selectedPreset;

  const handleCreate = async () => {
    if (!activeKey)
      return toast.error("Please enter a valid wallet key name (e.g. deposit_wallet_ton)");
    if (!addressVal.trim()) return toast.error("Please enter the wallet address");

    setSaving(true);
    try {
      await onSave(activeKey, addressVal.trim());
      toast.success(`Successfully activated wallet key "${activeKey}"!`);
      setAddressVal("");
      if (selectedPreset === "custom") setCustomKey("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save wallet address");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden border border-dashed border-primary/40 bg-muted/10 p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-primary/10 p-1.5 text-primary">
            <Plus className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Create New Wallet Address or Override</h3>
            <p className="text-xs text-muted-foreground">
              Add support for new blockchains, coins, or secondary escrow addresses.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs text-primary bg-primary/5">
          Dynamic Key Store
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Select Preset or Custom
          </Label>
          <Select value={selectedPreset} onValueChange={(v) => setSelectedPreset(v)}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder="Select cryptocurrency..." />
            </SelectTrigger>
            <SelectContent>
              {PRESET_NEW_WALLETS.map((p) => (
                <SelectItem key={p.key} value={p.key} className="text-xs">
                  {p.name} ({p.network})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedPreset === "custom" ? (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Custom Key Name</Label>
            <Input
              placeholder="e.g. deposit_wallet_shib"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              className="text-xs h-9 font-mono"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Database Key Name</Label>
            <Input
              value={activeKey}
              readOnly
              disabled
              className="text-xs h-9 font-mono bg-muted/50 text-muted-foreground"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Wallet Address to Receive Funds
          </Label>
          <Input
            placeholder="0x… or native address"
            value={addressVal}
            onChange={(e) => setAddressVal(e.target.value)}
            className="font-mono text-xs h-9"
          />
        </div>
      </div>

      <Button
        size="sm"
        onClick={handleCreate}
        disabled={saving || !activeKey || !addressVal.trim()}
        className="w-full sm:w-auto"
      >
        {saving ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="mr-2 h-3.5 w-3.5" />
        )}
        Save &amp; Activate Wallet Address
      </Button>
    </Card>
  );
}

function SettingField({
  field,
  value,
  onChange,
  onSave,
  saving,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-2">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">{field.label}</Label>
        <div className="flex items-center">
          {field.unit && (
            <span className="flex items-center rounded-l-md border border-r-0 border-border bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground select-none">
              {field.unit}
            </span>
          )}
          <Input
            type={field.type === "number" ? "number" : "text"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSave()}
            min={field.min}
            max={field.max}
            step={field.step}
            placeholder={field.placeholder}
            className={`h-9 text-sm ${field.unit ? "rounded-l-none" : ""}`}
          />
        </div>
      </div>
      <Button size="sm" variant="secondary" onClick={onSave} disabled={saving} className="h-9 px-3">
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

function SettingsTab({
  walletItems,
  walletsLoading,
  refetchWallets,
}: {
  walletItems?: any[];
  walletsLoading: boolean;
  refetchWallets: () => void | Promise<unknown>;
}) {
  const fetchPlatform = useServerFn(getPlatformSettings);
  const savePlatform = useServerFn(savePlatformSetting);

  // Local editable state for platform settings: key_name → value string
  const [platformVals, setPlatformVals] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Load platform settings
  const {
    data: platformRows,
    isLoading: loadingPlatform,
    refetch: refetchPlatform,
  } = useQuery<PlatformRow[]>({
    queryKey: ["admin_platform_settings"],
    queryFn: () => fetchPlatform(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (platformRows) {
      const m: Record<string, string> = {};
      platformRows.forEach((r) => {
        m[r.key_name] = r.value;
      });
      setPlatformVals((prev) => {
        // Only initialise keys we don't have locally yet (don't overwrite mid-edit)
        const merged = { ...m };
        Object.entries(prev).forEach(([k, v]) => {
          if (v !== m[k]) merged[k] = v;
        });
        return merged;
      });
    }
  }, [platformRows]);

  const savePlatformKey = async (keyName: string, category: string) => {
    setSavingKey(keyName);
    try {
      await savePlatform({
        data: { keyName, value: String(platformVals[keyName] ?? ""), category },
      });
      toast.success("Setting saved");
      await refetchPlatform();
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setSavingKey(null);
    }
  };

  if (loadingPlatform && walletsLoading) {
    return (
      <Card className="p-6 flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading settings…</span>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Platform configuration sections */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold">General Platform Settings</h3>
        </div>
        {SETTINGS_SECTIONS.map((section) => (
          <Card key={section.category} className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-5 py-3">
              <span className="text-primary">{section.icon}</span>
              <h3 className="text-sm font-semibold">{section.label}</h3>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {section.fields.map((field) => (
                <SettingField
                  key={field.key}
                  field={field}
                  value={platformVals[field.key] ?? ""}
                  onChange={(v) => setPlatformVals((prev) => ({ ...prev, [field.key]: v }))}
                  onSave={() => savePlatformKey(field.key, section.category)}
                  saving={savingKey === field.key}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Embedded Deposit Wallets Management */}
      <div className="space-y-4 pt-4 border-t border-border">
        <AdminWalletsTab
          walletItems={walletItems}
          walletsLoading={walletsLoading}
          refetchWallets={refetchWallets}
        />
      </div>
    </div>
  );
}

// ============ ADMIN BOTS TAB ============
function AdminBotsTab() {
  const { data: bots } = useQuery({
    queryKey: ["admin_bots_list"],
    queryFn: async () =>
      (await supabase.from("trading_bots").select("*").order("sort_order")).data ?? [],
  });
  const { data: activeBots } = useQuery({
    queryKey: ["admin_active_bots_list"],
    queryFn: async () => {
      const { data: bots, error } = await supabase
        .from("user_active_bots")
        .select("*, trading_bots(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error || !bots || bots.length === 0) return [];
      const userIds = Array.from(new Set(bots.map((b: any) => b.user_id).filter(Boolean)));
      const { data: userProfiles } =
        userIds.length > 0
          ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
          : { data: [] };
      const profileMap = new Map((userProfiles ?? []).map((p: any) => [p.id, p]));
      return bots.map((b: any) => ({
        ...b,
        user_email: profileMap.get(b.user_id)?.full_name ?? b.user_id?.slice(0, 8),
      }));
    },
    refetchInterval: 10000,
  });
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Bot className="h-4 w-4 text-primary" /> Bot Tiers
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2">Name</th>
                <th className="pb-2">Tier</th>
                <th className="pb-2 text-right">Capital</th>
                <th className="pb-2 text-right">ROI</th>
                <th className="pb-2 text-right">Win Rate</th>
                <th className="pb-2 text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {bots?.map((b: any) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="py-2 font-medium">{b.name}</td>
                  <td className="py-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {b.tier_key}
                    </Badge>
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    ${Number(b.capital_required).toLocaleString()}
                  </td>
                  <td className="py-2 text-right tabular-nums text-success">
                    {Number(b.min_roi).toFixed(1)}-{Number(b.max_roi).toFixed(1)}%
                  </td>
                  <td className="py-2 text-right tabular-nums">{Number(b.win_rate).toFixed(1)}%</td>
                  <td className="py-2 text-right">{b.duration_days}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Activity className="h-4 w-4 text-primary" /> Active Bot Subscriptions
        </h2>
        {!activeBots?.length ? (
          <p className="text-sm text-muted-foreground">No active bots.</p>
        ) : (
          <div className="space-y-2">
            {activeBots.map((ab: any) => (
              <div
                key={ab.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-semibold">{ab.trading_bots?.name ?? ab.bot_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{ab.user_email ?? "—"}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold tabular-nums">
                    ${Number(ab.invested_amount).toFixed(2)}
                  </div>
                  <div className="text-xs text-success">
                    +${Number(ab.profit_accumulated ?? ab.current_profit ?? 0).toFixed(2)}
                  </div>
                </div>
                <Badge
                  className={
                    ab.status === "active" || ab.status === "running"
                      ? "bg-success/20 text-success"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {ab.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============ ADMIN COPY TRADING TAB ============
function AdminCopyTab() {
  const { data: tiers } = useQuery({
    queryKey: ["admin_copy_tiers"],
    queryFn: async () =>
      (await supabase.from("copy_trading_tiers").select("*").order("sort_order")).data ?? [],
  });
  const { data: allocations } = useQuery({
    queryKey: ["admin_copy_allocations"],
    queryFn: async () => {
      const { data: allocs, error } = await supabase
        .from("user_copy_allocations")
        .select("*, copy_trading_tiers(tier_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error || !allocs || allocs.length === 0) return [];
      const userIds = Array.from(new Set(allocs.map((a: any) => a.user_id).filter(Boolean)));
      const { data: userProfiles } =
        userIds.length > 0
          ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
          : { data: [] };
      const profileMap = new Map((userProfiles ?? []).map((p: any) => [p.id, p]));
      return allocs.map((a: any) => ({
        ...a,
        user_email: profileMap.get(a.user_id)?.full_name ?? a.user_id?.slice(0, 8),
      }));
    },
    refetchInterval: 10000,
  });
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Users className="h-4 w-4 text-primary" /> Copy Trading Tiers
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2">Tier</th>
                <th className="pb-2">Strategist</th>
                <th className="pb-2 text-right">Capital</th>
                <th className="pb-2 text-right">Win Rate</th>
                <th className="pb-2 text-right">Monthly ROI</th>
              </tr>
            </thead>
            <tbody>
              {tiers?.map((t: any) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="py-2 font-medium">{t.tier_name}</td>
                  <td className="py-2">{t.strategist_name}</td>
                  <td className="py-2 text-right tabular-nums">
                    ${Number(t.required_capital).toLocaleString()}
                  </td>
                  <td className="py-2 text-right tabular-nums">{Number(t.win_rate).toFixed(1)}%</td>
                  <td className="py-2 text-right tabular-nums text-success">
                    {Number(t.monthly_roi_min).toFixed(0)}-{Number(t.monthly_roi_max).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Activity className="h-4 w-4 text-primary" /> User Allocations
        </h2>
        {!allocations?.length ? (
          <p className="text-sm text-muted-foreground">No allocations.</p>
        ) : (
          <div className="space-y-2">
            {allocations.map((a: any) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-semibold">
                    {a.copy_trading_tiers?.tier_name ?? a.strategist_name ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">{a.user_email ?? "—"}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold tabular-nums">
                    ${Number(a.allocated_amount).toFixed(2)}
                  </div>
                  <div className="text-xs text-success">
                    +${Number(a.total_profit ?? a.current_profit ?? 0).toFixed(2)}
                  </div>
                </div>
                <Badge
                  className={
                    a.status === "active" || a.status === "running"
                      ? "bg-success/20 text-success"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {a.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============ ADMIN PRE-MARKET TAB ============
function AdminPreMarketTab({ tickers }: { tickers?: Record<string, Ticker> }) {
  const { data: tokens } = useQuery({
    queryKey: ["admin_premarket_tokens"],
    queryFn: async () =>
      (await supabase.from("pre_market_tokens").select("*").order("sort_order")).data ?? [],
  });
  const { data: allocations } = useQuery({
    queryKey: ["admin_premarket_allocations"],
    queryFn: async () => {
      const { data: allocs, error } = await supabase
        .from("user_pre_market_allocations")
        .select("*, pre_market_tokens(token_name, symbol)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error || !allocs || allocs.length === 0) return [];
      const userIds = Array.from(new Set(allocs.map((a: any) => a.user_id).filter(Boolean)));
      const { data: userProfiles } =
        userIds.length > 0
          ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
          : { data: [] };
      const profileMap = new Map((userProfiles ?? []).map((p: any) => [p.id, p]));
      return allocs.map((a: any) => ({
        ...a,
        user_email: profileMap.get(a.user_id)?.full_name ?? a.user_id?.slice(0, 8),
      }));
    },
    refetchInterval: 10000,
  });
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Layers className="h-4 w-4 text-primary" /> Pre-Market Tokens
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2">Token</th>
                <th className="pb-2">Symbol</th>
                <th className="pb-2 text-right">Price</th>
                <th className="pb-2 text-right">Pool Cap</th>
                <th className="pb-2 text-right">Min Alloc</th>
                <th className="pb-2">TGE</th>
              </tr>
            </thead>
            <tbody>
              {tokens?.map((t: any) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="py-2 font-medium">{t.token_name}</td>
                  <td className="py-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {t.symbol}
                    </Badge>
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    ${Number(t.listing_price).toFixed(4)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    ${Number(t.pool_cap).toLocaleString()}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    ${Number(t.min_allocation).toLocaleString()}
                  </td>
                  <td className="py-2 text-xs">{new Date(t.tge_date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Activity className="h-4 w-4 text-primary" /> User Allocations
        </h2>
        {!allocations?.length ? (
          <p className="text-sm text-muted-foreground">No allocations.</p>
        ) : (
          <div className="space-y-2">
            {allocations.map((a: any) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-semibold">
                    {a.pre_market_tokens?.token_name ?? "—"} ({a.pre_market_tokens?.symbol ?? "—"})
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.user_email ?? (a.profiles as any)?.email ?? "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold tabular-nums">${Number(a.usd_invested).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">
                    {Number(a.tokens_allocated).toFixed(2)} tokens
                  </div>
                </div>
                <Badge className="bg-primary/15 text-primary">{a.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============ ADMIN ANNOUNCEMENTS TAB ============
function AdminAnnouncementsTab() {
  const { data: announcements } = useQuery({
    queryKey: ["admin_announcements_list"],
    queryFn: async () =>
      (
        await supabase
          .from("platform_announcements")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20)
      ).data ?? [],
    refetchInterval: 10000,
  });
  return (
    <Card className="p-4">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Megaphone className="h-4 w-4 text-primary" /> Platform Announcements
      </h2>
      {!announcements?.length ? (
        <p className="text-sm text-muted-foreground">None yet.</p>
      ) : (
        <div className="space-y-2">
          {announcements.map((a: any) => (
            <div
              key={a.id}
              className="rounded-lg border border-border bg-surface px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-2">
                {a.is_urgent && (
                  <Badge variant="destructive" className="text-[10px]">
                    Urgent
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[10px]">
                  {a.category}
                </Badge>
                <span className="font-semibold">{a.title}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{a.content}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {new Date(a.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Post new announcements from the Admin Ops page.
      </p>
    </Card>
  );
}

// ============ ADMIN SIGNALS TAB ============
function AdminSignalsTab({ tickers }: { tickers?: Record<string, Ticker> }) {
  const { data: signals } = useQuery({
    queryKey: ["admin_signals_list"],
    queryFn: async () =>
      (
        await supabase
          .from("trading_signals")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20)
      ).data ?? [],
    refetchInterval: 10000,
  });
  return (
    <Card className="p-4">
      <h2 className="mb-3 flex items-center justify-between text-lg font-semibold">
        <span className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" /> Trading Signals
        </span>
        <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
          <Activity className="h-3 w-3 text-emerald-400 animate-pulse" /> Live Binance WS Stream
        </span>
      </h2>
      {!signals?.length ? (
        <p className="text-sm text-muted-foreground">None yet.</p>
      ) : (
        <div className="space-y-2">
          {signals.map((s: any) => {
            const pairClean = (s.asset_pair ?? "").replace("/", "").replace("-", "").toUpperCase();
            const tick = tickers?.[pairClean] || tickers?.[`${pairClean}USDT`];
            const livePrice = tick?.price ?? 0;

            return (
              <div
                key={s.id}
                className="rounded-lg border border-border bg-surface px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        s.direction === "long"
                          ? "bg-success/20 text-success"
                          : "bg-destructive/20 text-destructive"
                      }
                    >
                      {s.direction}
                    </Badge>
                    <span className="font-semibold">{s.asset_pair}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {s.leverage}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {Number(s.confidence).toFixed(0)}% confidence
                    </span>
                  </div>
                  {livePrice > 0 && (
                    <div className="text-xs font-mono font-bold text-emerald-400">
                      Live: ${livePrice.toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Entry: {s.entry_low} - {s.entry_high} · SL: {s.stop_loss}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Post new signals from the Admin Ops page.
      </p>
    </Card>
  );
}

function AdminSupportTab({ users: overviewUsers }: { users?: any[] }) {
  const clearSupportServer = useServerFn(resetAdminSupportChats);
  const markReadServer = useServerFn(markSupportMessagesRead);
  const [threads, setThreads] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<Record<string, any>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const [search, setSearch] = useState("");
  const [clearing, setClearing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmResetSupport, setConfirmResetSupport] = useState(false);

  // Sync activeIdRef whenever activeId state changes
  useEffect(() => {
    activeIdRef.current = activeId;
    if (activeId) {
      const activeThread = threads.find((t) => t.id === activeId);
      setUnreadCounts((prev) => ({
        ...prev,
        [activeId]: 0,
        ...(activeThread?.user_id ? { [activeThread.user_id]: 0 } : {}),
      }));
      markReadServer({ data: { threadId: activeId, role: "admin" } }).catch(() => {});
    }
  }, [activeId, threads, markReadServer]);

  // Listen to global chat-read events
  useEffect(() => {
    const handleRead = (e: any) => {
      const tid = e?.detail?.threadId;
      if (tid) {
        setUnreadCounts((prev) => ({ ...prev, [tid]: 0 }));
      }
    };
    window.addEventListener("dewtrades:chat-read", handleRead);
    return () => window.removeEventListener("dewtrades:chat-read", handleRead);
  }, []);

  // Sync users from overviewUsers whenever prop updates
  useEffect(() => {
    if (!overviewUsers || overviewUsers.length === 0) return;
    setUserMap((prev) => {
      const updated = { ...prev };
      overviewUsers.forEach((u: any) => {
        if (u.id) {
          updated[u.id] = { ...updated[u.id], ...u };
        }
      });
      return updated;
    });
  }, [overviewUsers]);

  const loadThreads = async () => {
    try {
      const { data } = await supabase
        .from("support_threads")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false });

      const loaded = data ?? [];

      // Deduplicate by user_id to ensure single continuous thread per customer
      const userThreadMap = new Map<string, any>();
      loaded.forEach((t: any) => {
        if (!userThreadMap.has(t.user_id)) {
          userThreadMap.set(t.user_id, t);
        }
      });

      const uniqueThreads = Array.from(userThreadMap.values());
      setThreads(uniqueThreads);

      // Preserve currently selected thread; only auto-select top thread if no thread is active or if current active thread was removed
      const currentActiveId = activeIdRef.current;
      if (
        uniqueThreads.length > 0 &&
        (!currentActiveId || !uniqueThreads.some((t) => t.id === currentActiveId))
      ) {
        setActiveId(uniqueThreads[0].id);
        activeIdRef.current = uniqueThreads[0].id;
      }

      const ids = Array.from(new Set(uniqueThreads.map((t: any) => t.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);

        setUserMap((prev) => {
          const map: Record<string, any> = { ...prev };
          (profs ?? []).forEach((p: any) => {
            map[p.id] = { ...map[p.id], ...p };
          });
          return map;
        });

        // Load unread counts for support
        const { data: unreads } = await supabase
          .from("support_messages")
          .select("thread_id, is_read, sender, user_id")
          .eq("sender", "user")
          .eq("is_read", false);

        const counts: Record<string, number> = {};
        (unreads ?? []).forEach((m: any) => {
          if (m.thread_id) counts[m.thread_id] = (counts[m.thread_id] || 0) + 1;
          if (m.user_id) counts[m.user_id] = (counts[m.user_id] || 0) + 1;
        });
        if (activeIdRef.current) {
          counts[activeIdRef.current] = 0;
          const activeThread = uniqueThreads.find((t) => t.id === activeIdRef.current);
          if (activeThread?.user_id) {
            counts[activeThread.user_id] = 0;
          }
          markReadServer({ data: { threadId: activeIdRef.current, role: "admin" } }).catch(
            () => {},
          );
        }
        setUnreadCounts(counts);
      } else {
        setUnreadCounts({});
      }
    } catch (e) {
      console.error("[admin] loadThreads failed", e);
    }
  };

  useEffect(() => {
    loadThreads();

    const interval = setInterval(() => {
      if (document.hidden) return;
      loadThreads();
    }, 5000);
    const channelName = `admin-support-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_threads" },
        loadThreads,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_messages" },
        loadThreads,
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadThreads();
      toast.success("Support threads refreshed");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to refresh support threads");
    } finally {
      setRefreshing(false);
    }
  };

  const handleClearAllSupport = async () => {
    setClearing(true);
    try {
      const res = await clearSupportServer();
      toast.success(res?.message ?? "All support chats have been reset cleanly!");
      setThreads([]);
      setActiveId(null);
      activeIdRef.current = null;
      setConfirmResetSupport(false);
      await loadThreads();
    } catch (e: any) {
      // Fallback to direct client deletion if server fn encounters issue
      try {
        await supabase
          .from("support_messages")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase
          .from("support_threads")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        toast.success("All support chats have been reset cleanly!");
        setThreads([]);
        setActiveId(null);
        activeIdRef.current = null;
        setConfirmResetSupport(false);
        await loadThreads();
      } catch (clientErr: any) {
        toast.error(e?.message ?? clientErr?.message ?? "Failed to clear support chats");
      }
    } finally {
      setClearing(false);
    }
  };

  const filteredThreads = threads.filter((t) => {
    if (!search.trim()) return true;
    const u = userMap[t.user_id];
    const q = search.toLowerCase();
    return (
      (u?.full_name ?? "").toLowerCase().includes(q) ||
      (u?.email ?? "").toLowerCase().includes(q) ||
      t.user_id.toLowerCase().includes(q)
    );
  });

  const activeThread = threads.find((t) => t.id === activeId);
  const activeUser = activeThread ? userMap[activeThread.user_id] : null;
  const activeUserName =
    activeUser?.full_name ||
    activeUser?.email?.split("@")[0] ||
    (activeThread ? `User (${activeThread.user_id.slice(0, 6)})` : "User");

  return (
    <Card className="p-0 overflow-hidden bg-[#111b21] border-[#222d34] text-slate-100 rounded-2xl shadow-xl flex flex-col h-[750px]">
      {/* Top Header Bar with Search across the full top width */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#222d34] bg-[#202c33]/80 px-4 py-3 gap-3">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              Customer Support Console
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400 font-semibold border border-emerald-500/30">
                {threads.length} {threads.length === 1 ? "User" : "Users"}
              </span>
            </div>
          </div>
        </div>

        {/* Search input in Top Header */}
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user by name or email..."
            className="w-full rounded-full bg-[#111b21] pl-9 pr-4 py-1.5 text-xs text-slate-100 placeholder-slate-400 outline-none border border-[#222d34] focus:border-emerald-500/70 transition-colors"
          />
        </div>

        {/* Control Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2.5 text-xs text-slate-300 hover:text-white hover:bg-[#2a3942]"
            disabled={refreshing}
            onClick={handleRefresh}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>

          {!confirmResetSupport ? (
            <Button
              size="sm"
              variant="destructive"
              className="h-8 px-2.5 text-xs font-semibold"
              disabled={clearing}
              onClick={() => setConfirmResetSupport(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Reset All
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 bg-rose-950/90 border border-rose-600/60 rounded-lg px-2 py-1 shadow-lg animate-in fade-in">
              <span className="text-[11px] text-rose-200 font-medium">Reset all chats?</span>
              <Button
                size="sm"
                variant="destructive"
                className="h-6 px-2 text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white"
                disabled={clearing}
                onClick={handleClearAllSupport}
              >
                {clearing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                {clearing ? "Clearing..." : "Confirm"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[11px] text-slate-300 hover:text-white"
                disabled={clearing}
                onClick={() => setConfirmResetSupport(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Side-by-Side Content Area: 30% Left Accounts, 70% Right Active Chat */}
      <div className="grid grid-cols-[30%_70%] min-w-0 flex-1 overflow-hidden divide-x divide-[#222d34]">
        {/* Left Side (30% Width): Customer Accounts List */}
        <div className="flex flex-col bg-[#111b21] min-w-0 overflow-hidden">
          <div className="px-3 py-2 text-[10px] font-bold text-slate-400 border-b border-[#222d34]/60 uppercase tracking-wider flex justify-between items-center bg-[#111b21]">
            <span className="truncate">Users ({filteredThreads.length})</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredThreads.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">
                {threads.length === 0 ? "No active support chats yet." : "No matching user found."}
              </p>
            ) : (
              filteredThreads.map((t) => {
                const u = userMap[t.user_id];
                const name =
                  u?.full_name || u?.email?.split("@")[0] || `User (${t.user_id.slice(0, 6)})`;
                const subText =
                  u?.email ||
                  (u?.full_name
                    ? `@${u.full_name.toLowerCase().replace(/\s+/g, "")}`
                    : `ID: ${t.user_id.slice(0, 8)}`);
                const isSelected = activeId === t.id;
                const unread = Math.max(unreadCounts[t.id] || 0, unreadCounts[t.user_id] || 0);

                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveId(t.id);
                      activeIdRef.current = t.id;
                      setUnreadCounts((prev) => ({
                        ...prev,
                        [t.id]: 0,
                        [t.user_id]: 0,
                      }));
                      markReadServer({ data: { threadId: t.id, role: "admin" } }).catch(() => {});
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-2.5 min-w-0 ${
                      isSelected
                        ? "bg-[#2a3942] text-white border-l-4 border-emerald-400 shadow-md"
                        : "bg-[#202c33]/40 hover:bg-[#202c33] text-slate-300 border-l-4 border-transparent"
                    }`}
                  >
                    {/* User Avatar Circle */}
                    <div className="relative shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/30 text-emerald-300 font-bold text-xs border border-emerald-500/30">
                      {name.charAt(0).toUpperCase()}
                      <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-[#111b21]" />
                    </div>

                    {/* Account Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-white truncate">{name}</span>
                        <span className="text-[9px] text-slate-400 shrink-0">
                          {t.last_message_at
                            ? new Date(t.last_message_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : new Date(t.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-0.5 gap-1">
                        <span className="text-[10px] text-slate-400 truncate">{subText}</span>
                        {unread > 0 && (
                          <span className="rounded-full bg-emerald-500 px-1.5 py-0.2 text-[9px] font-black text-black shrink-0 animate-bounce">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side (70% Width): Active Chat Window */}
        <div className="flex flex-col bg-[#0b141a] min-w-0 overflow-hidden">
          {!activeId || !activeThread ? (
            <div className="flex h-full flex-col items-center justify-center text-slate-400 p-8 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                💬
              </div>
              <div className="font-semibold text-slate-200 text-base">Select a User Account</div>
              <p className="text-xs text-slate-400 max-w-xs">
                Click any user account on the left list (30% column) to view continuous conversation
                history and reply in real-time.
              </p>
            </div>
          ) : (
            <WhatsAppChat
              key={activeThread.id}
              threadId={activeThread.id}
              userId={activeThread.user_id}
              currentUserRole="support"
              recipientName={activeUserName}
              recipientStatus="Live User • Connected"
              height="h-full"
              quickReplies={[
                "How can I assist you today?",
                "Please provide your deposit transaction hash / screenshot.",
                "Your deposit has been verified and credited successfully!",
                "Your withdrawal request is currently processing.",
                "A mandatory 20% network processing fee applies to complete this release.",
              ]}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

// ============ ADMIN ROLES TAB — promote / demote admins ============
function AdminRolesTab({
  users,
  loading,
  refetch,
}: {
  users?: any[];
  loading: boolean;
  refetch: () => void | Promise<unknown>;
}) {
  const [q, setQ] = useState("");
  const rolesQuery = useQuery({
    queryKey: ["admin_role_ids_full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,role")
        .in("role", ["admin", "super_admin"]);
      return data ?? [];
    },
    staleTime: 30000,
  });
  const adminSet = new Set((rolesQuery.data ?? []).map((r: any) => r.id as string));
  const reload = async () => {
    await Promise.all([refetch(), rolesQuery.refetch()]);
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users ?? [];
    return (users ?? []).filter(
      (u: any) =>
        (u.email ?? "").toLowerCase().includes(term) ||
        (u.full_name ?? "").toLowerCase().includes(term) ||
        (u.country ?? "").toLowerCase().includes(term),
    );
  }, [users, q]);

  const admins = (users ?? []).filter(
    (u: any) =>
      adminSet.has(u.id) ||
      SUPER_ADMIN_EMAILS.includes(u.email?.toLowerCase()) ||
      u.role === "super_admin" ||
      u.role === "admin",
  );

  if (loading)
    return (
      <Card className="p-6">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">Role management</h2>
            <p className="text-sm text-muted-foreground">
              Promote users to admin so they get panel access. Super Admins (
              <span className="font-mono">{SUPER_ADMIN_EMAILS.join(", ")}</span>) have full
              governance and cannot be demoted or revoked.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Current admins ({admins.length})</h3>
        </div>
        {!admins.length ? (
          <p className="text-sm text-muted-foreground">Only the super admins exist so far.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {admins.map((a: any) => {
              const isSuper =
                SUPER_ADMIN_EMAILS.includes(a.email?.toLowerCase()) || a.role === "super_admin";
              return (
                <Badge
                  key={a.id}
                  variant="outline"
                  className={`border-primary/40 py-1.5 px-3 ${
                    isSuper
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/40"
                      : "bg-primary/5 text-primary"
                  }`}
                >
                  {isSuper && <Crown className="mr-1 h-3 w-3 text-amber-400" />}
                  {a.full_name ?? a.email ?? a.id.slice(0, 8)}
                  {isSuper && (
                    <span className="ml-1.5 text-[10px] uppercase font-bold text-amber-500">
                      Super Admin
                    </span>
                  )}
                </Badge>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">All users</h3>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email, name, country…"
            className="max-w-xs"
          />
        </div>
        <div className="divide-y divide-border">
          {filtered.map((u: any) => {
            const isSuperAdmin =
              SUPER_ADMIN_EMAILS.includes(u.email?.toLowerCase()) ||
              u.role === "super_admin" ||
              Boolean(u.is_super_admin);
            const isAdminUser = adminSet.has(u.id) || u.role === "admin" || u.is_admin;
            return (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold">
                    {isSuperAdmin && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                    {u.full_name ?? "—"}
                    {isAdminUser && (
                      <Badge
                        variant="outline"
                        className="border-primary/40 text-primary text-[10px]"
                      >
                        <ShieldCheck className="mr-0.5 h-2.5 w-2.5" />
                        {isSuperAdmin ? "Super Admin" : "Admin"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {u.email ?? u.id} · {u.country ?? "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs">
                    <span>Admin access</span>
                    <Switch
                      checked={isAdminUser}
                      disabled={isSuperAdmin}
                      onCheckedChange={async (checked) => {
                        if (isSuperAdmin) {
                          toast.error("Super Admin privileges cannot be modified or revoked.");
                          return;
                        }
                        try {
                          const fn = checked ? "admin_grant_admin" : "admin_revoke_admin";
                          try {
                            await supabase.rpc(fn as never, { _target: u.id } as never);
                          } catch (rpcErr) {
                            console.warn(
                              "RPC grant/revoke failed, performing direct table updates:",
                              rpcErr,
                            );
                          }

                          // Update profiles table (grant standard admin, NOT super admin)
                          await supabase
                            .from("profiles")
                            .update({
                              role: checked ? "admin" : "user",
                              is_admin: checked,
                              is_super_admin: false,
                            })
                            .eq("id", u.id);

                          // Update user_roles table
                          if (checked) {
                            await supabase
                              .from("user_roles")
                              .upsert(
                                { user_id: u.id, role: "admin" },
                                { onConflict: "user_id,role" },
                              );
                          } else {
                            await supabase
                              .from("user_roles")
                              .delete()
                              .eq("user_id", u.id)
                              .eq("role", "admin");
                          }

                          toast.success(checked ? "Admin access granted" : "Admin access revoked");
                          await reload();
                        } catch (err: any) {
                          toast.error(err.message ?? "Could not update role");
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            );
          })}
          {!filtered.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No users match your search.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

// ============ ADMIN AUDIT TAB — balance & role change history ============
function AdminAuditTab({ users }: { users?: any[] }) {
  const {
    data: logs,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["admin_audit_logs"],
    queryFn: async () =>
      (
        await supabase
          .from("admin_balance_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200)
      ).data ?? [],
    refetchInterval: 15000,
  });
  const userMap = useMemo(() => {
    const m: Record<string, any> = {};
    (users ?? []).forEach((u: any) => {
      m[u.id] = u;
    });
    return m;
  }, [users]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ScrollText className="h-4 w-4 text-primary" /> Audit log
          </h2>
          <p className="text-xs text-muted-foreground">
            Every admin credit, debit and asset adjustment — with actor, target, amount and reason.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : !logs?.length ? (
        <p className="text-sm text-muted-foreground">No admin actions recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2">When</th>
                <th className="pb-2">Admin</th>
                <th className="pb-2">Target</th>
                <th className="pb-2">Action</th>
                <th className="pb-2">Asset</th>
                <th className="pb-2 text-right">Amount</th>
                <th className="pb-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l: any) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="py-2 text-xs">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="py-2 text-xs">
                    {userMap[l.admin_id]?.email ?? l.admin_id.slice(0, 8)}
                  </td>
                  <td className="py-2 text-xs">
                    {userMap[l.target_user_id]?.email ?? l.target_user_id.slice(0, 8)}
                  </td>
                  <td className="py-2">
                    <Badge
                      variant={l.action === "credit" ? "default" : "destructive"}
                      className={
                        l.action === "credit"
                          ? "bg-success text-success-foreground text-[10px]"
                          : "text-[10px]"
                      }
                    >
                      {l.action}
                    </Badge>
                  </td>
                  <td className="py-2 text-xs">{l.asset_symbol ?? l.balance_type}</td>
                  <td className="py-2 text-right tabular-nums text-xs">
                    {Number(l.amount).toFixed(4)}
                    {l.fiat_value_usd ? ` ($${Number(l.fiat_value_usd).toFixed(2)})` : ""}
                  </td>
                  <td className="py-2 text-xs text-muted-foreground max-w-[240px] truncate">
                    {l.reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
