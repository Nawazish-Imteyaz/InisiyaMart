// "Mehrab & Surahi" mark: arch frame with a black-pottery surahi (see docs/brand/colors-fonts.md).
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 156) / 120} viewBox="0 0 120 156" fill="none" aria-hidden="true">
      <path d="M14 150 V62 C14 34 36 14 60 4 C84 14 106 34 106 62 V150 Z" style={{ fill: "var(--plum)" }} />
      <g transform="translate(30 46) scale(0.5)">
        <path
          d="M52 13 L52 34 C52 40 30 46 24 66 C16 92 30 124 60 130 C90 124 104 92 96 66 C90 46 68 40 68 34 L68 13 Z"
          style={{ fill: "var(--ivory)" }}
        />
        <path
          d="M27 70 L35 62 L43 70 L51 62 L60 70 L69 62 L77 70 L85 62 L93 70"
          style={{ stroke: "var(--gold)" }}
          strokeWidth="5"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
