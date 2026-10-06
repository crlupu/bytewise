/**
 * The mark: a lowercase b built from soft tiles, the way Home is built —
 * a stem and a bowl joined into one shape, and one lime tile above for
 * the spark.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo">
      <rect x="0.5" y="0.5" width="63" height="63" rx="16" fill="#0a0d09" stroke="rgba(166,238,106,0.25)" />
      <rect x="11" y="8" width="14" height="48" rx="6" fill="#fff" />
      <rect x="11" y="26" width="42" height="30" rx="12" fill="#fff" />
      <rect x="25" y="34" width="18" height="14" rx="5" fill="#0a0d09" />
      <rect x="31" y="8" width="13" height="13" rx="4.5" fill="#a6ee6a" />
    </svg>
  );
}
