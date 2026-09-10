import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

const DEFAULT_URL = "https://wbdfjruovvolsmzpihqc.supabase.co";
const DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiZGZqcnVvdnZvbHNtenBpaHFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODc4ODIxOCwiZXhwIjoyMTA0MzY0MjE4fQ.Z8GUd0OkLSdWpilr2vbdlOeVDNDgfPe0wKBrtm4rujY";

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
