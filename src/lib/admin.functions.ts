import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  adminAdjustBalance,
  adminAdjustCryptoBalance,
  adminApproveDepositCrypto,
  adminDecideDeposit,
  adminDecideKyc,
  adminDecideWithdrawal,
  adminGetKycDocumentUrl,
  adminGetOverview,
  adminGetPlatformSettings,
  adminSavePlatformSetting,
  adminPostNews,
  adminReconcileLedger,
  adminClearAllBalances,
  adminResetSupportChats,
  adminToggleAiTrading,
  adminToggleAccountMode,
  adminToggleSuspend,
  adminUpdateChart,
  adminUpdateComplaint,
  adminUpdateSetting,
  adminDeleteSetting,
  closeUserPosition,
  openUserPosition,
  markSupportThreadRead,
} from "./admin.server";

const decisionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
});
const chartSchema = z.object({
  userId: z.string().uuid(),
  mode: z.enum(["profit", "loss", "flat", "live"]),
  intensity: z.number().min(0.1).max(5),
});
const balanceSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
  direction: z.enum(["credit", "debit"]),
});
const complaintSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "resolved"]),
});
const settingSchema = z.object({
  key: z.string().min(1).max(80),
  value: z.string().min(0).max(500),
});
const deleteSettingSchema = z.object({
  key: z.string().min(1).max(80),
});
const modeSchema = z.object({ userId: z.string().uuid(), mode: z.enum(["demo", "live"]) });
const suspendSchema = z.object({ userId: z.string().uuid(), suspended: z.boolean() });
const aiTradingSchema = z.object({ userId: z.string().uuid(), enabled: z.boolean() });
const kycSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  note: z.string().max(500).optional(),
});
const newsSchema = z.object({
  title: z.string().min(1).max(160),
  body: z.string().max(2000).default(""),
  impact: z.enum(["low", "medium", "high"]).default("medium"),
  source: z.string().max(120).default("Dew Trades Desk"),
});
const docSchema = z.object({ path: z.string().min(1).max(500) });
const openPositionSchema = z.object({
  asset: z.string().min(1).max(40),
  side: z.enum(["buy", "sell"]),
  quantity: z.number().positive(),
  leverage: z.number().min(1).max(100),
  margin: z.number().positive().max(1_000_000),
  entryPrice: z.number().positive(),
  accountMode: z.enum(["demo", "live"]),
});
const closePositionSchema = z.object({ id: z.string().uuid(), closePrice: z.number().positive() });
const platformSettingSchema = z.object({
  keyName: z.string().min(1).max(120),
  value: z.string().min(0).max(2000),
  category: z.string().max(60).optional(),
});

export const getAdminOverview = createServerFn({ method: "GET" }).handler(async ({ context }) =>
  adminGetOverview(context?.userId || "admin"),
);

export const decideAdminDeposit = createServerFn({ method: "POST" })
  .inputValidator((input) => decisionSchema.parse(input))
  .handler(async ({ data, context }) =>
    adminDecideDeposit(context?.userId || "admin", data.id, data.status),
  );

export const decideAdminWithdrawal = createServerFn({ method: "POST" })
  .inputValidator((input) => decisionSchema.parse(input))
  .handler(async ({ data, context }) =>
    adminDecideWithdrawal(context?.userId || "admin", data.id, data.status),
  );

export const updateAdminChart = createServerFn({ method: "POST" })
  .inputValidator((input) => chartSchema.parse(input))
  .handler(async ({ data, context }) =>
    adminUpdateChart(context?.userId || "admin", data.userId, data.mode, data.intensity),
  );

export const adjustAdminBalance = createServerFn({ method: "POST" })
  .inputValidator((input) => balanceSchema.parse(input))
  .handler(async ({ data, context }) =>
    adminAdjustBalance(context?.userId || "admin", data.userId, data.amount, data.direction),
  );

export const updateAdminComplaint = createServerFn({ method: "POST" })
  .inputValidator((input) => complaintSchema.parse(input))
  .handler(async ({ data, context }) =>
    adminUpdateComplaint(context?.userId || "admin", data.id, data.status),
  );

export const updateAdminSetting = createServerFn({ method: "POST" })
  .inputValidator((input) => settingSchema.parse(input))
  .handler(async ({ data, context }) =>
    adminUpdateSetting(context?.userId || "admin", data.key, data.value),
  );

export const deleteAdminSetting = createServerFn({ method: "POST" })
  .inputValidator((input) => deleteSettingSchema.parse(input))
  .handler(async ({ data, context }) => adminDeleteSetting(context?.userId || "admin", data.key));

export const toggleAdminAccountMode = createServerFn({ method: "POST" })
  .inputValidator((input) => modeSchema.parse(input))
  .handler(async ({ data, context }) =>
    adminToggleAccountMode(context?.userId || "admin", data.userId, data.mode),
  );

export const toggleAdminSuspend = createServerFn({ method: "POST" })
  .inputValidator((input) => suspendSchema.parse(input))
  .handler(async ({ data, context }) =>
    adminToggleSuspend(context?.userId || "admin", data.userId, data.suspended),
  );

export const toggleAdminAiTrading = createServerFn({ method: "POST" })
  .inputValidator((input) => aiTradingSchema.parse(input))
  .handler(async ({ data, context }) =>
    adminToggleAiTrading(context?.userId || "admin", data.userId, data.enabled),
  );

export const decideAdminKyc = createServerFn({ method: "POST" })
  .inputValidator((input) => kycSchema.parse(input))
  .handler(async ({ data, context }) =>
    adminDecideKyc(context?.userId || "admin", data.id, data.status, data.note),
  );

export const postAdminNews = createServerFn({ method: "POST" })
  .inputValidator((input) => newsSchema.parse(input))
  .handler(async ({ data, context }) =>
    adminPostNews(context?.userId || "admin", data.title, data.body, data.impact, data.source),
  );

export const getAdminKycUrl = createServerFn({ method: "POST" })
  .inputValidator((input) => docSchema.parse(input))
  .handler(async ({ data, context }) =>
    adminGetKycDocumentUrl(context?.userId || "admin", data.path),
  );

export const openPosition = createServerFn({ method: "POST" })
  .inputValidator((input) => openPositionSchema.parse(input))
  .handler(async ({ data, context }) =>
    openUserPosition(
      context?.userId || "admin",
      data.asset,
      data.side,
      data.quantity,
      data.leverage,
      data.margin,
      data.entryPrice,
      data.accountMode,
    ),
  );

export const closePosition = createServerFn({ method: "POST" })
  .inputValidator((input) => closePositionSchema.parse(input))
  .handler(async ({ data, context }) =>
    closeUserPosition(context?.userId || "admin", data.id, data.closePrice),
  );

export const getPlatformSettings = createServerFn({ method: "GET" }).handler(async ({ context }) =>
  adminGetPlatformSettings(context?.userId || "admin"),
);

export const savePlatformSetting = createServerFn({ method: "POST" })
  .inputValidator((input) => platformSettingSchema.parse(input))
  .handler(async ({ data, context }) =>
    adminSavePlatformSetting(context?.userId || "admin", data.keyName, data.value, data.category),
  );

const cryptoBalanceSchema = z.object({
  userId: z.string().uuid(),
  symbol: z.string().min(1).max(20),
  quantity: z.number().positive().max(1_000_000_000),
  direction: z.enum(["credit", "debit"]),
});

const approveCryptoDepositSchema = z.object({
  depositId: z.string().uuid(),
  symbol: z.string().min(1).max(20),
  cryptoQuantity: z.number().positive().max(1_000_000_000),
});

export const adjustAdminCryptoBalance = createServerFn({ method: "POST" })
  .inputValidator((input) => cryptoBalanceSchema.parse(input))
  .handler(async ({ data, context }) =>
    adminAdjustCryptoBalance(
      context?.userId || "admin",
      data.userId,
      data.symbol,
      data.quantity,
      data.direction,
    ),
  );

export const approveAdminDepositCrypto = createServerFn({ method: "POST" })
  .inputValidator((input) => approveCryptoDepositSchema.parse(input))
  .handler(async ({ data, context }) =>
    adminApproveDepositCrypto(
      context?.userId || "admin",
      data.depositId,
      data.symbol,
      data.cryptoQuantity,
    ),
  );

export const reconcileAdminLedger = createServerFn({ method: "POST" })
  .inputValidator((input?: { userId?: string }) => input)
  .handler(async ({ data, context }) =>
    adminReconcileLedger(context?.userId || "admin", data?.userId),
  );

export const clearAllAdminBalances = createServerFn({ method: "POST" }).handler(
  async ({ context }) => adminClearAllBalances(context?.userId || "admin"),
);

export const resetAdminSupportChats = createServerFn({ method: "POST" }).handler(
  async ({ context }) => adminResetSupportChats(context?.userId || "admin"),
);

const markReadSchema = z.object({
  threadId: z.string().uuid(),
  role: z.enum(["user", "admin"]),
});

export const markSupportMessagesRead = createServerFn({ method: "POST" })
  .inputValidator((input) => markReadSchema.parse(input))
  .handler(async ({ data }) => markSupportThreadRead(data.threadId, data.role));
