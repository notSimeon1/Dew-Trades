import { getMcpDbClient } from "../db";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_my_positions",
  title: "List my open positions",
  description:
    "List the signed-in Dew Trades user's live trading positions (asset, side, size, entry price, current PnL).",
  inputSchema: {
    status: z
      .enum(["open", "closed", "all"])
      .optional()
      .describe("Filter by status (default: open)."),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = getMcpDbClient(ctx)
      .from("live_positions")
      .select("*")
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (status && status !== "all") q = q.eq("status", status);
    else if (!status) q = q.eq("status", "open");
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { positions: data ?? [] },
    };
  },
});
