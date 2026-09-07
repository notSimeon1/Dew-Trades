import { supabase } from "@/integrations/supabase/client";

export type SupportThread = {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
};

/**
  Retrieves or creates the single continuous support thread for a user.
  Ensures a user only ever has ONE active, continuous support thread history.
 */
export async function getOrCreateUserSupportThread(
  userId: string,
  userName?: string,
): Promise<SupportThread | null> {
  if (!userId) return null;

  try {
    // 1. Fetch latest thread for user
    const { data: existingThreads, error: fetchErr } = await supabase
      .from("support_threads")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchErr) {
      console.warn("Error querying support_threads:", fetchErr);
    }

    if (existingThreads && existingThreads.length > 0) {
      return existingThreads[0] as SupportThread;
    }

    // 2. Create continuous thread if none exists
    const { data: created, error: createErr } = await supabase
      .from("support_threads")
      .insert({
        user_id: userId,
        subject: "Dew Trades Customer Support",
        last_message_at: new Date().toISOString(),
      } as never)
      .select()
      .maybeSingle();

    if (createErr) {
      console.error("Error creating support thread:", createErr);
      throw new Error("Unable to reach customer support server, service unavailable");
    }

    const thread = created as SupportThread;

    if (thread) {
      // Send initial welcoming bot message
      const displayName = userName || "trader";
      await supabase.from("support_messages").insert({
        thread_id: thread.id,
        user_id: userId,
        sender: "bot",
        body: `Hello ${displayName}! Welcome to Dew Trades Official 24/7 Live Support. How can our team assist you with your account, deposits, withdrawals, or trading today?`,
        is_read: true,
      } as never);
    }

    return thread;
  } catch (e) {
    console.error("Failed to get or create support thread:", e);
    throw e;
  }
}
