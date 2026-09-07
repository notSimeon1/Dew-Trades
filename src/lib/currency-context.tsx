import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export type CurrencyCode =
  "USD" | "EUR" | "GBP" | "JPY" | "CAD" | "AUD" | "CHF" | "BRL" | "INR" | "NGN" | "AED";

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  flag: string;
  defaultRate: number;
  decimals: number;
}

export const AVAILABLE_CURRENCIES: CurrencyConfig[] = [
  { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸", defaultRate: 1.0, decimals: 2 },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺", defaultRate: 0.92, decimals: 2 },
  { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧", defaultRate: 0.79, decimals: 2 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", flag: "🇯🇵", defaultRate: 155.0, decimals: 0 },
  {
    code: "CAD",
    symbol: "C$",
    name: "Canadian Dollar",
    flag: "🇨🇦",
    defaultRate: 1.38,
    decimals: 2,
  },
  {
    code: "AUD",
    symbol: "A$",
    name: "Australian Dollar",
    flag: "🇦🇺",
    defaultRate: 1.52,
    decimals: 2,
  },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", flag: "🇨🇭", defaultRate: 0.88, decimals: 2 },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", flag: "🇧🇷", defaultRate: 5.6, decimals: 2 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", flag: "🇮🇳", defaultRate: 84.0, decimals: 2 },
  {
    code: "NGN",
    symbol: "₦",
    name: "Nigerian Naira",
    flag: "🇳🇬",
    defaultRate: 1600.0,
    decimals: 2,
  },
  { code: "AED", symbol: "AED", name: "UAE Dirham", flag: "🇦🇪", defaultRate: 3.67, decimals: 2 },
];

const DEFAULT_RATES: Record<CurrencyCode, number> = AVAILABLE_CURRENCIES.reduce(
  (acc, item) => {
    acc[item.code] = item.defaultRate;
    return acc;
  },
  {} as Record<CurrencyCode, number>,
);

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  currencyInfo: CurrencyConfig;
  rates: Record<CurrencyCode, number>;
  convert: (usdAmount: number, targetCurrency?: CurrencyCode) => number;
  formatCurrency: (
    usdAmount: number,
    options?: {
      compact?: boolean;
      showSymbol?: boolean;
      decimals?: number;
      targetCurrency?: CurrencyCode;
    },
  ) => string;
  formatPrice: (
    usdPrice: number,
    options?: { decimals?: number; targetCurrency?: CurrencyCode },
  ) => string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "USD",
  setCurrency: () => {},
  currencyInfo: AVAILABLE_CURRENCIES[0],
  rates: DEFAULT_RATES,
  convert: (amt) => amt,
  formatCurrency: (amt) => `$${amt.toFixed(2)}`,
  formatPrice: (amt) => `$${amt.toFixed(2)}`,
});

const LOCAL_STORAGE_KEY = "dewtrades_base_currency";

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    if (typeof window !== "undefined") {
      const saved = (localStorage.getItem(LOCAL_STORAGE_KEY) ||
        localStorage.getItem("solentrades_base_currency")) as CurrencyCode;
      if (saved && AVAILABLE_CURRENCIES.some((c) => c.code === saved)) {
        return saved;
      }
    }
    return "USD";
  });

  const [rates, setRates] = useState<Record<CurrencyCode, number>>(DEFAULT_RATES);

  // Sync preference with Supabase profile if logged in
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("base_currency")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.base_currency) {
          const code = data.base_currency as CurrencyCode;
          if (AVAILABLE_CURRENCIES.some((c) => c.code === code)) {
            setCurrencyState(code);
            if (typeof window !== "undefined") {
              localStorage.setItem(LOCAL_STORAGE_KEY, code);
            }
          }
        }
      });
  }, [user]);

  // Fetch live exchange rates relative to USD
  useEffect(() => {
    let cancelled = false;
    async function fetchRates() {
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        if (res.ok) {
          const json = await res.json();
          if (cancelled || !json?.rates) return;
          const next = { ...DEFAULT_RATES };
          AVAILABLE_CURRENCIES.forEach((item) => {
            if (json.rates[item.code]) {
              next[item.code] = Number(json.rates[item.code]);
            }
          });
          setRates(next);
        }
      } catch (e) {
        // Fallback to defaults on error
      }
    }

    fetchRates();
    const interval = setInterval(fetchRates, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const setCurrency = useCallback(
    async (code: CurrencyCode) => {
      setCurrencyState(code);
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_KEY, code);
      }
      if (user) {
        await supabase.from("profiles").update({ base_currency: code }).eq("id", user.id);
      }
    },
    [user],
  );

  const currencyInfo = useMemo(() => {
    return AVAILABLE_CURRENCIES.find((c) => c.code === currency) || AVAILABLE_CURRENCIES[0];
  }, [currency]);

  const convert = useCallback(
    (usdAmount: number, targetCurrency?: CurrencyCode): number => {
      if (usdAmount == null || isNaN(usdAmount)) return 0;
      const target = targetCurrency || currency;
      const rate = rates[target] ?? DEFAULT_RATES[target] ?? 1.0;
      return usdAmount * rate;
    },
    [currency, rates],
  );

  const formatCurrency = useCallback(
    (
      usdAmount: number,
      options?: {
        compact?: boolean;
        showSymbol?: boolean;
        decimals?: number;
        targetCurrency?: CurrencyCode;
      },
    ): string => {
      const target = options?.targetCurrency || currency;
      const info = AVAILABLE_CURRENCIES.find((c) => c.code === target) || AVAILABLE_CURRENCIES[0];
      const rate = rates[target] ?? DEFAULT_RATES[target] ?? 1.0;
      const converted = (usdAmount || 0) * rate;

      const dec = options?.decimals !== undefined ? options.decimals : info.decimals;
      const showSymbol = options?.showSymbol !== false;

      let formattedNumber = "";

      if (options?.compact && Math.abs(converted) >= 1000) {
        formattedNumber = new Intl.NumberFormat("en-US", {
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(converted);
      } else {
        formattedNumber = converted.toLocaleString("en-US", {
          minimumFractionDigits: dec,
          maximumFractionDigits: dec,
        });
      }

      if (!showSymbol) return formattedNumber;

      if (info.code === "AED") {
        return `${formattedNumber} AED`;
      }
      if (info.code === "CHF") {
        return `CHF ${formattedNumber}`;
      }
      return `${info.symbol}${formattedNumber}`;
    },
    [currency, rates],
  );

  const formatPrice = useCallback(
    (usdPrice: number, options?: { decimals?: number; targetCurrency?: CurrencyCode }): string => {
      const target = options?.targetCurrency || currency;
      const info = AVAILABLE_CURRENCIES.find((c) => c.code === target) || AVAILABLE_CURRENCIES[0];
      const rate = rates[target] ?? DEFAULT_RATES[target] ?? 1.0;
      const converted = (usdPrice || 0) * rate;

      let defaultDec = info.decimals;
      if (converted < 0.01 && converted > 0) defaultDec = 6;
      else if (converted < 1 && converted > 0) defaultDec = 4;

      const dec = options?.decimals !== undefined ? options.decimals : defaultDec;

      const formattedNumber = converted.toLocaleString("en-US", {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      });

      if (info.code === "AED") return `${formattedNumber} AED`;
      if (info.code === "CHF") return `CHF ${formattedNumber}`;
      return `${info.symbol}${formattedNumber}`;
    },
    [currency, rates],
  );

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        currencyInfo,
        rates,
        convert,
        formatCurrency,
        formatPrice,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
