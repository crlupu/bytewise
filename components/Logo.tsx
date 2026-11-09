/**
 * The mark: a pull-request glyph closed into a loop. Three rings on the
 * corners of a square, joined down the left and along the bottom; the
 * right side climbs and turns back with a mint arrow to the start ring.
 * Learn, review, come back round. Night tile, white line, one mint.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="logo">
      <defs>
        <linearGradient id="bw-logo-tile" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
          <stop offset="0" stopColor="#2a2a30" />
          <stop offset="1" stopColor="#0e0e10" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22.37" fill="url(#bw-logo-tile)" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="10">
        <path d="M27 41.5V58.5M41.5 73H58.5M73 58.5V37A10 10 0 0 0 63 27H57" stroke="#f4f4f6" />
        <path d="M59 18L47 27L59 36Z" fill="#75fa90" stroke="#75fa90" strokeWidth="4" />
        <circle cx="27" cy="73" r="9.5" stroke="#f4f4f6" />
        <circle cx="73" cy="73" r="9.5" stroke="#f4f4f6" />
        <circle cx="27" cy="27" r="9.5" stroke="#f4f4f6" />
      </g>
    </svg>
  );
}
