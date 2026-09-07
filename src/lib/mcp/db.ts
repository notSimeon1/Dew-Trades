import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

const DEFAULT_URL = "https://dmfdovwiczhpnqlykjix.supabase.co";
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtZmRvdndpY3pocG5xbHlraml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MzA1OTMsImV4cCI6MjEwMTEwNjU5M30.Hho5fwB9yPk_cCTAAfN9wD_yxGZIMkPagArg_RuQFXE";

export function getMcpDbClient(ctx: ToolContext) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL;

  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_ANON_KEY;

  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
