import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Navbar } from "@/components/Navbar";
import { WhatsAppChat } from "@/components/WhatsAppChat";
import { getOrCreateUserSupportThread } from "@/lib/support-service";

export const Route = createFileRoute("/support")({
  component: SupportPage,
  head: () => ({
    meta: [
      { title: "Support Live Chat — Dew Trades" },
      { name: "description", content: "Chat live with Dew Trades institutional support desk." },
      { property: "og:title", content: "Support Live Chat — Dew Trades" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SupportPage() {
  const { user } = useAuth();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    (async () => {
      try {
        const name = user.user_metadata?.full_name || user.email?.split("@")[0];
        const thread = await getOrCreateUserSupportThread(user.id, name);
        if (isMounted && thread) {
          setThreadId(thread.id);
        }
      } catch (err: any) {
        if (isMounted) setErrorMsg(err.message || "Service unavailable");
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex flex-1 flex-col mx-auto w-full max-w-4xl px-4 py-6">
        {!user ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-elegant">
            <h2 className="text-xl font-bold">Sign in for Live Chat</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Log in to connect with live support agents in real-time.
            </p>
          </div>
        ) : errorMsg ? (
          <div className="flex flex-col h-96 items-center justify-center text-sm text-red-500 gap-3">
            <div className="rounded-full bg-red-500/10 p-4 mb-2">
              <span className="text-2xl">⚠️</span>
            </div>
            <p className="font-semibold text-center max-w-md">{errorMsg}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
            >
              Retry Connection
            </button>
          </div>
        ) : !threadId ? (
          <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">
            Connecting to support server...
          </div>
        ) : (
          <WhatsAppChat
            threadId={threadId}
            userId={user.id}
            currentUserRole="user"
            recipientName="Dew Trades Institutional Support"
            recipientStatus="Online • Replies instantly"
            height="h-[700px]"
          />
        )}
      </main>
    </div>
  );
}
