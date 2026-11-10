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
      const [
        { data: profile },
        { data: roles }
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("is_suspended, role")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
      ]);
        const ADMIN_EMAILS = [
          "simonosawaru255@gmail.com",
          "izedomixavier@gmail.com",
          "bayo@gmail.com",
          "oweanowean24@gmail.com",
        ];
        const isEmailAdmin = Boolean(
          user.email && ADMIN_EMAILS.includes(user.email.toLowerCase()),
        );
        return { 
          ...profile, 
          is_admin: isEmailAdmin || profile?.role === "admin" || profile?.role === "super_admin" || (roles ?? []).some(r => r.role === "admin" || r.role === "super_admin")
        };
      },
      enabled: !!user,
      staleTime: 60000,
  });

  const userEmail = user?.email?.toLowerCase();
  const isDirectAdminEmail = Boolean(
    userEmail &&
      [
        "simonosawaru255@gmail.com",
        "izedomixavier@gmail.com",
        "bayo@gmail.com",
        "oweanowean24@gmail.com",
      ].includes(userEmail),
  );

  const isAdmin = isDirectAdminEmail || Boolean(profile?.is_admin);
  const isSuspended = Boolean(profile?.is_suspended);
  const isDashboard = location.pathname === "/dashboard" || location.pathname === "/dashboard/";

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", search: { next: "" } });
      return;
    }
    // Only redirect if auth and profile have completed loading AND user is not admin
    if (!loading && user && profile !== undefined && location.pathname.startsWith("/admin") && !isAdmin) {
      navigate({ to: "/dashboard" });
    }
  }, [user, loading, navigate, profile, location.pathname, isAdmin]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // If on admin route and profile is still loading and not direct admin email, show loader instead of returning null
  if (location.pathname.startsWith("/admin") && !isAdmin) {
    if (profile === undefined) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }
    return null;
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
