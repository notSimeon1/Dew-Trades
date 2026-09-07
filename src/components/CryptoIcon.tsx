import React from "react";

interface CryptoIconProps {
  symbol: string;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

const SIZE_MAP = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-11 w-11 text-base",
  xl: "h-14 w-14 text-xl",
};

/* Official Solana Vector SVG with 3 distinct bar gradients matching the exact logo */
const SolanaLogo: React.FC<{ className?: string }> = ({ className = "w-[68%] h-[68%]" }) => (
  <svg viewBox="0 0 500 500" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      {/* Top bar gradient: Teal Green -> Cyan */}
      <linearGradient id="solTopGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#00FFA3" />
        <stop offset="100%" stopColor="#00C2FF" />
      </linearGradient>
      {/* Middle bar gradient: Cyan -> Purple */}
      <linearGradient id="solMidGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#00C2FF" />
        <stop offset="100%" stopColor="#9945FF" />
      </linearGradient>
      {/* Bottom bar gradient: Purple -> Magenta */}
      <linearGradient id="solBotGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#9945FF" />
        <stop offset="100%" stopColor="#DC1FFF" />
      </linearGradient>
    </defs>
    {/* Top bar (slanted right) */}
    <path
      d="M102.5 137.8c2.2-2.2 5.2-3.4 8.3-3.4h280.9c4.3 0 6.5 5.2 3.5 8.2l-58.7 58.7c-2.2 2.2-5.2 3.4-8.3 3.4H47.3c-4.3 0-6.5-5.2-3.5-8.2l58.7-58.7z"
      fill="url(#solTopGrad)"
    />
    {/* Middle bar (slanted left) */}
    <path
      d="M397.5 220.8c-2.2-2.2-5.2-3.4-8.3-3.4H108.3c-4.3 0-6.5 5.2-3.5 8.2l58.7 58.7c2.2 2.2 5.2 3.4 8.3 3.4h280.9c4.3 0 6.5-5.2 3.5-8.2l-58.7-58.7z"
      fill="url(#solMidGrad)"
    />
    {/* Bottom bar (slanted right) */}
    <path
      d="M102.5 303.8c2.2-2.2 5.2-3.4 8.3-3.4h280.9c4.3 0 6.5 5.2 3.5 8.2l-58.7 58.7c-2.2 2.2-5.2 3.4-8.3 3.4H47.3c-4.3 0-6.5-5.2-3.5-8.2l58.7-58.7z"
      fill="url(#solBotGrad)"
    />
  </svg>
);

/* Official Ethereum Vector SVG */
const EthereumLogo: React.FC<{ className?: string }> = ({ className = "w-[55%] h-[55%]" }) => (
  <svg viewBox="0 0 256 417" className={className} fill="none">
    <path
      d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z"
      fill="#E0E7FF"
      fillOpacity="0.95"
    />
    <path d="M127.962 0L0 212.32l127.962 75.638V152.47z" fill="#C7D2FE" />
    <path
      d="M127.961 312.187l-1.57 1.92v98.199l1.57 4.601 128.038-180.32z"
      fill="#A5B4FC"
      fillOpacity="0.95"
    />
    <path d="M127.962 416.907V312.187L0 236.41z" fill="#818CF8" />
  </svg>
);

/* Official BNB Vector SVG */
const BnbLogo: React.FC<{ className?: string }> = ({ className = "w-[60%] h-[60%]" }) => (
  <svg viewBox="0 0 120 120" className={className} fill="none">
    <path d="M60 15L74.8 29.8L38.2 66.4L23.4 51.6L60 15Z" fill="#F0B90B" />
    <path d="M60 15L96.6 51.6L81.8 66.4L45.2 29.8L60 15Z" fill="#F0B90B" />
    <path d="M60 105L45.2 90.2L81.8 53.6L96.6 68.4L60 105Z" fill="#F0B90B" />
    <path d="M60 105L23.4 68.4L38.2 53.6L74.8 90.2L60 105Z" fill="#F0B90B" />
    <path d="M60 45L74.8 60L60 75L45.2 60L60 45Z" fill="#F0B90B" />
  </svg>
);

/* Tether USDT Vector SVG */
const UsdtLogo: React.FC<{ className?: string }> = ({ className = "w-full h-full" }) => (
  <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="100" fill="#26A17B" />
    <path d="M52.8 50.4h94.4v22.4h-35.2v96.8H88V72.8H52.8V50.4z" fill="#FFFFFF" />
    <path
      d="M100 88.8c-32 0-58.4 4.8-58.4 10.8s26.4 10.8 58.4 10.8 58.4-4.8 58.4-10.8-26.4-10.8-58.4-10.8zm0 16.4c-25.2 0-45.6-3.4-45.6-5.6s20.4-5.6 45.6-5.6 45.6 3.4 45.6 5.6-20.4 5.6-45.6 5.6z"
      fill="#FFFFFF"
    />
  </svg>
);

/* Bitcoin Vector SVG */
const BitcoinLogo: React.FC<{ className?: string }> = ({ className = "w-[60%] h-[60%]" }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none">
    <circle cx="32" cy="32" r="32" fill="#F7931A" />
    <path
      d="M46.1 27.4c.7-4.4-2.7-6.8-7.3-8.4l1.5-6-3.7-.9-1.4 5.7c-1-.2-2-.5-3-.7l1.5-5.9-3.7-.9-1.5 6-8.1-2-.9 3.8s2.7.6 2.7.7c1.5.4 1.8 1.4 1.7 2.2l-1.7 6.8c.1 0 .2.1.4.1h-.4l-2.4 9.6c-.2.5-.7 1.2-1.8.9 0 .1-2.7-.7-2.7-.7l-1.8 4 7.6 1.9c1.4.4 2.8.7 4.2 1.1l-1.5 6.1 3.7.9 1.5-6c1 .3 2 .5 3 .8l-1.5 6 3.7.9 1.5-6.1c6.3 1.2 11 0 13-5 1.6-4.1-.1-6.5-3-8 2.2-1 3.8-2.8 4.2-7.1zm-7.6 14.1c-1.1 4.6-8.9 2.1-11.4 1.5l2-8.2c2.5.6 10.6 1.9 9.4 6.7zm1.2-14.3c-1 4.2-7.5 2.1-9.6 1.5l1.8-7.4c2.1.5 8.9 1.6 7.8 5.9z"
      fill="#FFFFFF"
    />
  </svg>
);

/* XRP Vector SVG */
const XrpLogo: React.FC<{ className?: string }> = ({ className = "w-[55%] h-[55%]" }) => (
  <svg viewBox="0 0 512 512" className={className} fill="none">
    <path
      d="M381.3 128l-88.8 88.8-88.8-88.8H108l133.3 133.3L374.6 128h6.7zM108 384h95.7l88.8-88.8 88.8 88.8H477L343.7 250.7 248 346.4 152.3 250.7 108 295V384z"
      fill="#00AAE4"
    />
  </svg>
);

export const CryptoIcon: React.FC<CryptoIconProps> = ({ symbol, className = "", size = "md" }) => {
  const cleanSym = symbol.replace(/USDT|USD|\/USDT/g, "").toUpperCase() || "BTC";

  const sizeStyle = SIZE_MAP[size] ?? SIZE_MAP.md;

  if (cleanSym === "SOL" || cleanSym === "SOLANA") {
    return (
      <div
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-black border border-zinc-800 shadow-md shadow-emerald-500/10 ${sizeStyle} ${className}`}
        title="Solana"
      >
        <SolanaLogo />
      </div>
    );
  }

  if (cleanSym === "ETH" || cleanSym === "ETHEREUM") {
    return (
      <div
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-indigo-400/40 bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#1E1B4B] shadow-md shadow-indigo-500/20 ${sizeStyle} ${className}`}
        title="Ethereum"
      >
        <EthereumLogo />
      </div>
    );
  }

  if (cleanSym === "BNB") {
    return (
      <div
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-yellow-500/40 bg-[#121824] shadow-md shadow-yellow-500/20 ${sizeStyle} ${className}`}
        title="BNB"
      >
        <BnbLogo />
      </div>
    );
  }

  if (cleanSym === "USDT") {
    return (
      <div
        className={`inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden shadow-md shadow-emerald-500/20 ${sizeStyle} ${className}`}
        title="Tether USD"
      >
        <UsdtLogo className="w-full h-full" />
      </div>
    );
  }

  if (cleanSym === "BTC" || cleanSym === "BITCOIN") {
    return (
      <div
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-[#1A150B] shadow-md shadow-amber-500/20 ${sizeStyle} ${className}`}
        title="Bitcoin"
      >
        <BitcoinLogo className="w-full h-full" />
      </div>
    );
  }

  if (cleanSym === "XRP") {
    return (
      <div
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-sky-400/40 bg-[#0B1726] shadow-md shadow-sky-500/20 ${sizeStyle} ${className}`}
        title="XRP"
      >
        <XrpLogo />
      </div>
    );
  }

  // Fallback for ADA, DOGE, MNT, etc. with clean crisp typography
  const FALLBACK_CONFIGS: Record<
    string,
    { bg: string; text: string; border: string; char: string }
  > = {
    ADA: {
      bg: "bg-gradient-to-br from-blue-600 to-sky-900",
      text: "text-white font-black",
      border: "border-blue-400/50",
      char: "₳",
    },
    DOGE: {
      bg: "bg-gradient-to-br from-amber-400 to-yellow-600",
      text: "text-slate-950 font-black",
      border: "border-amber-300/80",
      char: "Ð",
    },
    MNT: {
      bg: "bg-gradient-to-br from-teal-500 to-slate-900",
      text: "text-teal-200 font-black",
      border: "border-teal-400/50",
      char: "M",
    },
  };

  const conf = FALLBACK_CONFIGS[cleanSym] ?? {
    bg: "bg-gradient-to-br from-blue-600 to-slate-900",
    text: "text-white font-bold",
    border: "border-blue-400/40",
    char: cleanSym.charAt(0),
  };

  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center rounded-full border shadow-md ${conf.bg} ${conf.text} ${conf.border} ${sizeStyle} ${className}`}
      title={cleanSym}
    >
      <span>{conf.char}</span>
    </div>
  );
};
