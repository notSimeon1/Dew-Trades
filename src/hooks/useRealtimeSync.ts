import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

/**
 * useRealtimeSync: Listens to Supabase Realtime Postgres Changes and Broadcast events
 * so that any change in the Admin Panel or Admin Ops updates the website in REAL TIME!
 */
export function useRealtimeSync() {
  const qc = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    // Subscribe to database postgres_changes for admin-controlled and user-facing tables
    const channel = supabase
      .channel("dewtrades-global-realtime")
      // 1. Payment Methods (Admin Ops edits CashApp, Zelle, Bitcoin, PayPal, etc.)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_payment_methods" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["admin_payment_methods"] });
          qc.invalidateQueries({ queryKey: ["admin_payment_methods_active"] });
          qc.invalidateQueries({ queryKey: ["payment_methods"] });
          qc.invalidateQueries({ queryKey: ["buy_payment_methods"] });
          qc.invalidateQueries({ queryKey: ["deposit_wallets"] });
        },
      )
      // 2. Trading Bots (Admin edits tiers, ROI, capital)
      .on("postgres_changes", { event: "*", schema: "public", table: "trading_bots" }, () => {
        qc.invalidateQueries({ queryKey: ["trading_bots"] });
        qc.invalidateQueries({ queryKey: ["admin_bots"] });
      })
      // 3. Copy Trading Tiers (Admin edits strategists, ROI)
      .on("postgres_changes", { event: "*", schema: "public", table: "copy_trading_tiers" }, () => {
        qc.invalidateQueries({ queryKey: ["copy_trading_tiers"] });
        qc.invalidateQueries({ queryKey: ["admin_copy_tiers"] });
      })
      // 4. User Active Bots (User starts bot, or profits tick)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_active_bots" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["my_active_bots"] });
          qc.invalidateQueries({ queryKey: ["admin_active_bots_list"] });
        },
      )
      // 5. User Copy Allocations (User allocates capital, or profits tick)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_copy_allocations" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["my_copy_allocations"] });
          qc.invalidateQueries({ queryKey: ["admin_copy_allocations"] });
        },
      )
      // 6. Profiles (Admin adjusts balance, suspends, verifies user)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload: any) => {
          qc.invalidateQueries({ queryKey: ["admin_users"] });
          if (!user || payload?.new?.id === user.id || payload?.old?.id === user.id) {
            qc.invalidateQueries({ queryKey: ["profile"] });
          }
        },
      )
      // 7. Transactions (Deposits, withdrawals, payouts)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        qc.invalidateQueries({ queryKey: ["transactions"] });
        qc.invalidateQueries({ queryKey: ["admin_transactions"] });
        qc.invalidateQueries({ queryKey: ["profile"] });
      })
      // 8. KYC Submissions
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_submissions" }, () => {
        qc.invalidateQueries({ queryKey: ["kyc_status"] });
        qc.invalidateQueries({ queryKey: ["admin_kyc"] });
      })
      // 9. Admin Ops Broadcast Event for immediate cross-tab synchronization
      .on("broadcast", { event: "admin-ops-update" }, () => {
        qc.invalidateQueries({ queryKey: ["admin_payment_methods"] });
        qc.invalidateQueries({ queryKey: ["payment_methods"] });
        qc.invalidateQueries({ queryKey: ["trading_bots"] });
        qc.invalidateQueries({ queryKey: ["copy_trading_tiers"] });
        qc.invalidateQueries({ queryKey: ["profile"] });
        qc.invalidateQueries({ queryKey: ["admin_users"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, user]);
}
