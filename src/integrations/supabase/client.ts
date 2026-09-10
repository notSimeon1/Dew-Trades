import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// IMPORTANT: these must stay pointed at the same project the server validates
// tokens against (see .env SUPABASE_URL). If the browser signs in against a
// different project than the server checks, every authenticated server call
// fails with "Unauthorized: Invalid token".
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://wbdfjruovvolsmzpihqc.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiZGZqcnVvdnZvbHNtenBpaHFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODc4ODIxOCwiZXhwIjoyMTA0MzY0MjE4fQ.Z8GUd0OkLSdWpilr2vbdlOeVDNDgfPe0wKBrtm4rujY";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
