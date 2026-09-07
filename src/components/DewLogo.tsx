import React from "react";

interface DewLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  tagline?: boolean;
  className?: string;
  iconOnly?: boolean;
}

const SIZES = {
  xs: { icon: 20, text: "text-xs", sub: "text-[8px]" },
  sm: { icon: 28, text: "text-sm", sub: "text-[9px]" },
  md: { icon: 36, text: "text-base", sub: "text-[10px]" },
  lg: { icon: 44, text: "text-lg", sub: "text-[11px]" },
  xl: { icon: 56, text: "text-2xl", sub: "text-xs" },
};

/**
 * DewLogo: Sharp, official, institutional prime brokerage insignia.
 * Features a geometric capital 'D' with an integrated capital 'T' embedded within its counter.
 */
export function DewLogo({
  size = "md",
  showText = true,
  tagline = false,
  className = "",
  iconOnly = false,
}: DewLogoProps) {
  const { icon, text, sub } = SIZES[size] || SIZES.md;

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Insignia: Geometric D with embedded T in Corporate Black & Gold */}
      <div
        style={{ width: icon, height: icon }}
        className="relative flex-shrink-0 flex items-center justify-center rounded-[6px] bg-gradient-to-br from-[#181B22] via-[#101217] to-[#090A0E] p-[1.5px] border border-[#2E3442] shadow-[0_2px_12px_rgba(0,0,0,0.8)] group-hover:border-[#EAB308]/70 transition-colors"
      >
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1"
          aria-label="Dew Trades Insignia"
        >
          <defs>
            <linearGradient
              id="dewDGrad"
              x1="10"
              y1="10"
              x2="90"
              y2="90"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>
            <linearGradient
              id="dewTGrad"
              x1="30"
              y1="20"
              x2="70"
              y2="80"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="50%" stopColor="#EAB308" />
              <stop offset="100%" stopColor="#CA8A04" />
            </linearGradient>
            <linearGradient
              id="dewAccentGrad"
              x1="0"
              y1="0"
              x2="100"
              y2="100"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <filter id="dewGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="1"
                stdDeviation="1.5"
                floodColor="#000000"
                floodOpacity="0.8"
              />
            </filter>
          </defs>

          {/* Precision outer geometric D frame */}
          <path
            d="M 18 16 
               H 50 
               C 72 16, 84 28, 84 50 
               C 84 72, 72 84, 50 84 
               H 18 
               Z 
               M 30 27 
               V 73 
               H 49 
               C 64 73, 72 63, 72 50 
               C 72 37, 64 27, 49 27 
               Z"
            fill="url(#dewDGrad)"
            fillRule="evenodd"
            filter="url(#dewGlow)"
          />

          {/* Embedded Capital 'T' nestled with mathematical precision inside the counter */}
          {/* T Top Horizontal Bar */}
          <path d="M 36 34 H 65 V 42 H 36 Z" fill="url(#dewTGrad)" filter="url(#dewGlow)" />
          {/* T Vertical Stem */}
          <path d="M 46 42 H 55 V 66 H 46 Z" fill="url(#dewTGrad)" filter="url(#dewGlow)" />

          {/* Institutional gold corner accent */}
          <rect x="20" y="18" width="4" height="4" fill="#EAB308" opacity="0.95" />
        </svg>
      </div>

      {/* Typography */}
      {showText && !iconOnly && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-extrabold tracking-tight text-white uppercase font-display ${text}`}
              style={{ letterSpacing: "-0.01em" }}
            >
              Dew <span className="text-[#EAB308]">Trades</span>
            </span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase text-amber-300 bg-amber-950/70 border border-amber-500/40 rounded-[3px]">
              Prime
            </span>
          </div>
          {tagline && (
            <span
              className={`text-muted-foreground uppercase font-medium tracking-widest mt-0.5 ${sub}`}
            >
              Institutional Brokerage
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default DewLogo;
