/**
 * The mark: a capital B drawn as a repeat loop. The stem stands on its
 * own; the top bowl is a white arrow and the bottom bowl a mint one, each
 * ending in a single barb that points back at the stem. Learn, then come
 * back round to review. Violet tile, white line, one mint arrow.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="logo">
      <defs>
        <linearGradient id="bw-logo-tile" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
          <stop offset="0" stopColor="#8166ff" />
          <stop offset="1" stopColor="#5636e6" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22.37" fill="url(#bw-logo-tile)" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M55.78 49.12A11.44 11.44 0 0 1 55.78 72.0H44.78" stroke="#75fa90" strokeWidth="10.5" />
        <path d="M51.58 65.2L44.78 72.0" stroke="#75fa90" strokeWidth="10.5" />
        <path d="M31.78 28.0V72.0" stroke="#ffffff" strokeWidth="10.5" />
        <path d="M31.78 28.0H53.78A10.56 10.56 0 0 1 53.78 49.12H44.78" stroke="#ffffff" strokeWidth="10.5" />
        <path d="M51.58 42.32L44.78 49.12" stroke="#ffffff" strokeWidth="10.5" />
      </g>
    </svg>
  );
}
