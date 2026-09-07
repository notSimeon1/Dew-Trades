import { getMcpDbClient } from "../db";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_my_withdrawals",
  title: "List my withdrawals",
  description:
    "List the signed-in Dew Trades user's withdrawal requests and their approval/payout status.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await getMcpDbClient(ctx)
      .from("withdrawals")
      .select("*")
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { withdrawals: data ?? [] },
    };
  },
});
