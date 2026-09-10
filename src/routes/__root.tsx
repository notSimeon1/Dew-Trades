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
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">This page doesn't exist on Dew Trades.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Return to Terminal
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Institutional Terminal Error</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please refresh or retry your request.</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Retry Connection
        </button>
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
