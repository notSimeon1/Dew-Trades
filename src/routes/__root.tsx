import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { CurrencyProvider } from "@/lib/currency-context";
import { AccountModeProvider } from "@/lib/account-mode-context";
import { AlertTriangle, RotateCw, Home, ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05070c] px-4 text-zinc-100">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
          404
        </h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-zinc-400">This page doesn't exist on Dew Trades.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
        >
          Return to Terminal
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[DewTrades Root Error]:", error);
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);

  const handleHardReset = () => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.clear();
        localStorage.removeItem("dewtrades_base_currency");
        localStorage.removeItem("dewtrades_favs");
        window.location.href = "/auth";
      }
    } catch {
      if (typeof window !== "undefined") {
        window.location.href = "/auth";
      }
    }
  };

  const errorMessage =
    error?.message ||
    (typeof error === "string" ? error : "An unexpected execution error occurred.");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05070c] px-4 py-8 text-zinc-100 selection:bg-amber-500/30 selection:text-amber-200">
      <div className="w-full max-w-lg rounded-2xl border border-amber-500/20 bg-zinc-950/90 p-6 sm:p-8 shadow-2xl shadow-black/80 backdrop-blur-xl text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
          Institutional Terminal Notice
        </h1>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          The terminal encountered a network or gateway synchronization issue. Reconnecting to the
          Dew Trades liquidity mesh...
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => {
              try {
                router.invalidate();
                reset();
              } catch {
                if (typeof window !== "undefined") window.location.reload();
              }
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <RotateCw className="h-4 w-4" />
            Retry Connection
          </button>
          <a
            href="/auth"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <Home className="h-4 w-4" />
            Return to Terminal
          </a>
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-800/80 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="inline-flex items-center gap-1 text-zinc-400 hover:text-amber-400 transition-colors"
            >
              {showDetails ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              <span>{showDetails ? "Hide technical details" : "Show technical details"}</span>
            </button>
            <button
              type="button"
              onClick={handleHardReset}
              className="text-zinc-500 hover:text-rose-400 transition-colors underline underline-offset-2"
            >
              Reset Session
            </button>
          </div>

          {showDetails && (
            <div className="rounded-lg bg-black/60 border border-zinc-800/80 p-3 text-left">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Diagnostic Information</span>
              </div>
              <p className="font-mono text-[11px] text-zinc-400 break-words whitespace-pre-wrap leading-tight">
                {errorMessage}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Dew Trades — Institutional Prime Brokerage & Multi-Asset Execution" },
      {
        name: "description",
        content:
          "Dew Trades provides institutional prime brokerage, direct market access, AI algorithmic execution, deep liquidity, and multi-asset portfolio management.",
      },
      { property: "og:title", content: "Dew Trades — Institutional Prime Brokerage" },
      {
        property: "og:description",
        content:
          "Dew Trades provides institutional prime brokerage, direct market access, AI algorithmic execution, deep liquidity, and multi-asset portfolio management.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Dew Trades — Institutional Prime Brokerage" },
      {
        name: "twitter:description",
        content:
          "Institutional precision, deep multi-asset liquidity, and advanced trading algorithms with Dew Trades.",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/43464ef5-237a-4c5b-8628-26bd10420b9b",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/43464ef5-237a-4c5b-8628-26bd10420b9b",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "alternate icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CurrencyProvider>
          <AccountModeProvider>
            <Outlet />
            <Toaster />
          </AccountModeProvider>
        </CurrencyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
