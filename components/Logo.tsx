/**
 * The mark: a lowercase b drawn in straight lines, with the repeat loop
 * built in. The white stroke is the stem and the arrow leaving it on a
 * 45° shoulder; the mint stroke runs down the right and back along the
 * base, pointing at the stem. Learn, then come back round to review.
 * Violet tile, white and one mint.
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
      <g>
        <path d="M69.00 63.00L78.00 54.00L78.00 72.00L70.00 80.00L36.00 80.00L36.00 85.00L22.00 75.50L36.00 66.00L36.00 71.00L66.30 71.00L69.00 68.30Z" fill="#75fa90" stroke="#75fa90" strokeWidth="2.4" strokeLinejoin="miter" />
        <path d="M22.00 23.00L31.00 14.00L31.00 45.10L36.60 39.50L64.00 39.50L64.00 34.50L78.00 44.00L64.00 53.50L64.00 48.50L40.40 48.50L31.00 57.90L22.00 66.90Z" fill="#ffffff" stroke="#ffffff" strokeWidth="2.4" strokeLinejoin="miter" />
      </g>
    </svg>
  );
}
