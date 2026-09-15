import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

/**
 * useRealtimeSync: Listens to Supabase Realtime Postgres Changes and Broadcast events
 * so that any change in the Admin Panel or Admin Ops updates the website in REAL TIME!
 * Batches and debounces query invalidations to prevent network flooding and UI stutter.
 */
export function useRealtimeSync() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const queueInvalidate = (keys: (string | undefined)[][]) => {
      keys.forEach((k) => {
        const clean = k.filter(Boolean);
        if (clean.length > 0) {
          pendingKeysRef.current.add(JSON.stringify(clean));
        }
      });

      if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          pendingKeysRef.current.forEach((str) => {
            try {
              const queryKey = JSON.parse(str);
              qc.invalidateQueries({ queryKey });
            } catch {
              // Ignore
            }
          });
          pendingKeysRef.current.clear();
        }, 500);
      }
    };

    // Subscribe to database postgres_changes for admin-controlled and user-facing tables
    const channel = supabase
      .channel("dewtrades-global-realtime")
      // 1. Payment Methods (Admin Ops edits CashApp, Zelle, Bitcoin, PayPal, etc.)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_payment_methods" },
        () => {
          queueInvalidate([
            ["admin_payment_methods"],
            ["admin_payment_methods_active"],
            ["payment_methods"],
            ["buy_payment_methods"],
            ["deposit_wallets"],
          ]);
        },
      )
      // 2. Trading Bots (Admin edits tiers, ROI, capital)
      .on("postgres_changes", { event: "*", schema: "public", table: "trading_bots" }, () => {
        queueInvalidate([["trading_bots"], ["admin_bots"]]);
      })
      // 3. Copy Trading Tiers (Admin edits strategists, ROI)
      .on("postgres_changes", { event: "*", schema: "public", table: "copy_trading_tiers" }, () => {
        queueInvalidate([["copy_trading_tiers"], ["admin_copy_tiers"]]);
      })
      // 4. User Active Bots (Only invalidate on insert, delete, or status change, NOT on profit accumulation ticks)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_active_bots" },
        (payload: any) => {
          if (
            payload.eventType === "INSERT" ||
            payload.eventType === "DELETE" ||
            payload.new?.status !== payload.old?.status
          ) {
            queueInvalidate([["my_active_bots"], ["admin_active_bots_list"]]);
          }
        },
      )
      // 5. User Copy Allocations (Only invalidate on insert, delete, or status change)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_copy_allocations" },
        (payload: any) => {
          if (
            payload.eventType === "INSERT" ||
            payload.eventType === "DELETE" ||
            payload.new?.status !== payload.old?.status
          ) {
            queueInvalidate([["my_copy_allocations"], ["admin_copy_allocations"]]);
          }
        },
      )
      // 6. Profiles (Admin adjusts balance, suspends, verifies user)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload: any) => {
          queueInvalidate([["admin_users"]]);
          if (!user || payload?.new?.id === user.id || payload?.old?.id === user.id) {
            queueInvalidate([["profile"]]);
          }
        },
      )
      // 7. Transactions (Deposits, withdrawals, payouts)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        queueInvalidate([["transactions"], ["admin_transactions"], ["profile"]]);
      })
      // 8. KYC Submissions
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_submissions" }, () => {
        queueInvalidate([["kyc_status"], ["admin_kyc"]]);
      })
      // 9. Admin Ops Broadcast Event for immediate cross-tab synchronization
      .on("broadcast", { event: "admin-ops-update" }, () => {
        queueInvalidate([
          ["admin_payment_methods"],
          ["payment_methods"],
          ["trading_bots"],
          ["copy_trading_tiers"],
          ["profile"],
          ["admin_users"],
        ]);
      })
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [qc, user]);
}
