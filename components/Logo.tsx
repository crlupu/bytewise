const SPARK = "M32 21c1.2 7.3 3.7 9.8 11 11-7.3 1.2-9.8 3.7-11 11-1.2-7.3-3.7-9.8-11-11 7.3-1.2 9.8-3.7 11-11Z";

/** The mark: a lowercase b with a lime spark beside it — the moment something clicks. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo">
      <rect x="0.5" y="0.5" width="63" height="63" rx="16" fill="#0a0d09" stroke="rgba(166,238,106,0.25)" />
      <rect x="11" y="10" width="9" height="38" rx="4.5" fill="#fff" />
      <circle cx="31" cy="36" r="13" fill="#fff" />
      <circle cx="31" cy="36" r="6" fill="#0a0d09" />
      <path d={SPARK} fill="#a6ee6a" transform="translate(50 44) scale(.68) translate(-32 -32)" />
    </svg>
  );
}
