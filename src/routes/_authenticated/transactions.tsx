import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/transactions")({
  component: Transactions,
});

function Transactions() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`account-activity-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["transactions", user.id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deposits", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["activity_deposits", user.id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawals", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["activity_withdrawals", user.id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "complaints", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["activity_complaints", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  const txQ = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: 8000,
  });
  const depQ = useQuery({
    queryKey: ["activity_deposits", user?.id],
    queryFn: async () =>
      (
        await supabase
          .from("deposits")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!user,
    refetchInterval: 8000,
  });
  const wdQ = useQuery({
    queryKey: ["activity_withdrawals", user?.id],
    queryFn: async () =>
      (
        await supabase
          .from("withdrawals")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!user,
    refetchInterval: 8000,
  });
  const cQ = useQuery({
    queryKey: ["activity_complaints", user?.id],
    queryFn: async () =>
      (
        await supabase
          .from("complaints")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!user,
    refetchInterval: 8000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Account activity</h1>
        <p className="text-sm text-muted-foreground">Complete history of your account.</p>
      </div>

      <Tabs defaultValue="ledger">
        <TabsList className="flex-wrap">
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          <TabsTrigger value="complaints">Complaints</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          <Card className="p-4">
            {!txQ.data?.length ? (
              <p className="text-sm text-muted-foreground">No entries yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="pb-3">Date</th>
                      <th>Description</th>
                      <th>Type</th>
                      <th className="text-right">Amount</th>
                      <th className="text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txQ.data.map((t: any) => (
                      <tr key={t.id} className="border-t border-border">
                        <td className="py-3 text-muted-foreground">
                          {new Date(t.created_at).toLocaleString()}
                        </td>
                        <td className="font-medium">{t.asset_name ?? "—"}</td>
                        <td>
                          <Badge variant="secondary">{t.type}</Badge>
                        </td>
                        <td className="text-right font-medium tabular-nums">
                          ${Number(t.amount).toFixed(2)}
                        </td>
                        <td className="text-right">
                          <Badge variant="outline">{t.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="deposits">
          <SimpleList
            items={depQ.data}
            render={(d: any) => `$${Number(d.amount).toFixed(2)} · ${d.crypto_currency}`}
            sub={(d: any) => d.tx_hash}
          />
        </TabsContent>
        <TabsContent value="withdrawals">
          <SimpleList
            items={wdQ.data}
            render={(w: any) => `$${Number(w.amount).toFixed(2)} · ${w.crypto_currency}`}
            sub={(w: any) => w.wallet_address}
          />
        </TabsContent>
        <TabsContent value="complaints">
          <SimpleList items={cQ.data} render={(c: any) => c.subject} sub={(c: any) => c.message} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SimpleList({
  items,
  render,
  sub,
}: {
  items?: any[];
  render: (i: any) => string;
  sub: (i: any) => string;
}) {
  if (!items?.length)
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">No entries yet.</p>
      </Card>
    );
  return (
    <Card className="p-4">
      <div className="space-y-2">
        {items.map((it) => (
          <div
            key={it.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{render(it)}</div>
              {sub(it) && <div className="text-xs text-muted-foreground break-all">{sub(it)}</div>}
              <div className="text-xs text-muted-foreground">
                {new Date(it.created_at).toLocaleString()}
              </div>
            </div>
            <Badge
              variant={
                it.status === "approved" || it.status === "resolved"
                  ? "default"
                  : it.status === "rejected"
                    ? "destructive"
                    : "secondary"
              }
              className={
                it.status === "approved" || it.status === "resolved"
                  ? "bg-success text-success-foreground"
                  : ""
              }
            >
              {it.status}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
