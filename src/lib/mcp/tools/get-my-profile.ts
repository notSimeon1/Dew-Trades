import { getMcpDbClient } from "../db";
import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "get_my_profile",
  title: "Get my profile",
  description:
    "Return the signed-in Dew Trades user's profile: name, email, country, KYC status, account mode (demo/live), balances, and AI-trading flag.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await getMcpDbClient(ctx)
      .from("profiles")
      .select("*")
      .eq("id", ctx.getUserId())
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { profile: data },
    };
  },
});
