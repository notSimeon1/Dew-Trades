import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Copy, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/referrals")({
  component: ReferralsPage,
});

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return `FRB-${out}`;
}

function ReferralsPage() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["referral_profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: earnings } = useQuery({
    queryKey: ["my_referrals", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("referral_earnings")
        .select("*")
        .eq("referrer_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const [fallbackCode] = useState(() => randomCode());
  const code = profile?.referral_code ?? fallbackCode;
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  // Persist referral code to database if user profile has none yet
  useEffect(() => {
    if (user?.id && profile && !profile.referral_code && fallbackCode) {
      supabase
        .from("profiles")
        .update({ referral_code: fallbackCode })
        .eq("id", user.id)
        .then(() => {});
    }
  }, [user?.id, profile, fallbackCode]);
  const link = origin && code ? `${origin}/auth?ref=${code}` : "";
  const total = (earnings ?? []).reduce((s: number, r: any) => s + Number(r?.amount ?? 0), 0);

  const copy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy — please copy manually");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-hero shadow-glow">
          <Users className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Earn 20% per referral</h1>
          <p className="text-sm text-muted-foreground">
            Invite others and earn 20% of their profits before withdrawal.
          </p>
        </div>
      </div>

      <Card className="p-6 bg-morph">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Your referral code</div>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
              <span className="flex-1 truncate text-xl font-bold tracking-widest">
                {code || "—"}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy(code, "Code")}
                aria-label="Copy referral code"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="rounded-lg bg-surface p-3">
            <div className="text-xs text-muted-foreground">Total earned</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-success">
              ${total.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="text-xs text-muted-foreground">Your referral link</div>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
            <code className="flex-1 truncate text-xs">{link || "—"}</code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copy(link, "Link")}
              aria-label="Copy referral link"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-success" /> Commission history
        </h2>
        {!earnings?.length ? (
          <p className="text-sm text-muted-foreground">
            No earnings yet. Share your link to start earning.
          </p>
        ) : (
          <div className="space-y-2">
            {earnings.map((e: any) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-semibold tabular-nums text-success">
                    +${Number(e.amount).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">20% commission</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
