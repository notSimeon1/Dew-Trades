import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Navbar } from "@/components/Navbar";
import { LiveChatWidget } from "@/components/LiveChatWidget";
import { SuspendedAccountAlert } from "@/components/SuspendedAccountAlert";
import { useRealtimeProfitEngine } from "@/hooks/useRealtimeProfitEngine";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Loader as Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useRealtimeProfitEngine();
  useRealtimeSync();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("is_suspended")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 15000,
  });

  const isSuspended = Boolean(profile?.is_suspended);
  const isDashboard = location.pathname === "/dashboard" || location.pathname === "/dashboard/";

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { next: "" } });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 pb-24 sm:pb-28">
        {isSuspended && !isDashboard && <SuspendedAccountAlert compact />}
        <Outlet />
      </main>
      <LiveChatWidget />
    </div>
  );
}
