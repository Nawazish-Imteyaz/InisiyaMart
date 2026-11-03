import type { Art } from "@/data/catalog";

// Illustrated stand-ins until real product photos arrive (TODO(owner): photos).
export function ProductArt({ art, size = 120, light = false }: { art: Art; size?: number; light?: boolean }) {
  const line = light ? "rgba(255,255,255,0.9)" : "rgba(43,27,34,0.85)";
  const fillSoft = light ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.7)";
  const gold = "#C9A24A";
  const common = { width: size, height: size, viewBox: "0 0 120 120", fill: "none", "aria-hidden": true, className: "art" } as const;

  switch (art) {
    case "pot":
      return (
        <svg {...common}>
          <path d="M52 14h16v16c0 5 20 10 24 30 4 26-12 46-32 48-20-2-36-22-32-48 4-20 24-25 24-30z" fill="#140c11" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
          <path d="M33 62l7-7 7 7 7-7 6 7 6-7 7 7 7-7 7 7" stroke="#E4E1DC" strokeWidth="2" strokeLinejoin="round" />
          <path d="M31 70c19 6 39 6 58 0" stroke={gold} strokeWidth="2" />
          <circle cx="60" cy="88" r="5" stroke={gold} strokeWidth="2" />
          <rect x="49" y="9" width="22" height="6" rx="2" fill={gold} />
        </svg>
      );
    case "fabric":
      return (
        <svg {...common}>
          <path d="M22 26c14-8 28 8 40 0s26-8 36 0v58c-10-8-24-8-36 0s-26-8-40 0z" fill={fillSoft} stroke={line} strokeWidth="2" />
          <path d="M22 40c14-8 28 8 40 0s26-8 36 0M22 70c14-8 28 8 40 0s26-8 36 0" stroke={gold} strokeWidth="2" />
          <path d="M30 84v10M40 82v10M50 84v10M70 84v10M80 82v10M90 84v10" stroke={line} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "gift":
      return (
        <svg {...common}>
          <rect x="24" y="48" width="72" height="50" rx="6" fill="#6B2142" />
          <rect x="18" y="36" width="84" height="16" rx="5" fill="#8a2f58" />
          <rect x="54" y="36" width="12" height="62" fill={gold} />
          <path d="M60 36c-8-14-26-14-22-2 2 6 14 4 22 2zM60 36c8-14 26-14 22-2-2 6-14 4-22 2z" fill={gold} />
        </svg>
      );
    case "frame":
      return (
        <svg {...common}>
          <rect x="22" y="16" width="76" height="90" rx="8" fill={fillSoft} stroke={line} strokeWidth="2.5" />
          <path d="M36 96V54c0-14 10-24 24-30 14 6 24 16 24 30v42z" stroke="#6B2142" strokeWidth="2.5" />
          <path d="M46 70c6-6 10 4 14-2s8-6 14 2" stroke={gold} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case "diya":
      return (
        <svg {...common}>
          <path d="M60 30c-8 10-8 18 0 22 8-4 8-12 0-22z" fill="#FFC857" />
          <path d="M60 38c-3 5-3 9 0 11 3-2 3-6 0-11z" fill="#F4A63A" />
          <path d="M20 62h80c-4 18-20 30-40 30S24 80 20 62z" fill="#140c11" stroke={gold} strokeWidth="2" />
          <path d="M34 72l6-5 6 5 6-5 8 5 8-5 6 5 6-5 6 5" stroke="#E4E1DC" strokeWidth="1.6" />
        </svg>
      );
    case "clutch":
      return (
        <svg {...common}>
          <path d="M18 46h84l-6 48H24z" fill={fillSoft} stroke={line} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M18 46l42 24 42-24" stroke={line} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="60" cy="70" r="5" fill={gold} />
          <path d="M34 82c4-4 8 4 12 0s8 4 12 0 8 4 12 0 8 4 12 0" stroke="#6B2142" strokeWidth="2" />
        </svg>
      );
  }
}
