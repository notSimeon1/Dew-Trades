import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// IMPORTANT: these must stay pointed at the same project the server validates
// tokens against (see .env SUPABASE_URL). If the browser signs in against a
// different project than the server checks, every authenticated server call
// fails with "Unauthorized: Invalid token".
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://dmfdovwiczhpnqlykjix.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtZmRvdndpY3pocG5xbHlraml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MzA1OTMsImV4cCI6MjEwMTEwNjU5M30.Hho5fwB9yPk_cCTAAfN9wD_yxGZIMkPagArg_RuQFXE";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
