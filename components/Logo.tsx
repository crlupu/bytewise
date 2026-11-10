/**
 * The mark: a capital B drawn as a repeat loop. The stem stands on its
 * own; the top bowl is a white arrow and the bottom bowl a mint one, each
 * ending in a single barb that points back at the stem. Learn, then come
 * back round to review. Night tile, white line, one mint arrow.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="logo">
      <defs>
        <linearGradient id="bw-logo-tile" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
          <stop offset="0" stopColor="#28282d" />
          <stop offset="1" stopColor="#0e0e10" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22.37" fill="url(#bw-logo-tile)" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M55.19 48.76A16.12 16.12 0 0 1 55.19 81.0H39.19" stroke="#75fa90" strokeWidth="9.5" />
        <path d="M47.19 73.0L39.19 81.0" stroke="#75fa90" strokeWidth="9.5" />
        <path d="M27.19 19.0V81.0" stroke="#f4f4f6" strokeWidth="9.5" />
        <path d="M27.19 19.0H53.19A14.88 14.88 0 0 1 53.19 48.76H39.19" stroke="#f4f4f6" strokeWidth="9.5" />
        <path d="M47.19 40.76L39.19 48.76" stroke="#f4f4f6" strokeWidth="9.5" />
      </g>
    </svg>
  );
}
