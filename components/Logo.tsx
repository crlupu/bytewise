/** The mark: a byte as eight cells, the lit ones climbing — learning in bits. */
export function Logo({ size = 28 }: { size?: number }) {
  const cells = [0, 1, 1, 0, 1, 1, 1, 1];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--electric)" />
      {cells.map((on, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        return (
          <rect
            key={i}
            x={5 + col * 6}
            y={9 + row * 8}
            width="4.5"
            height="6"
            rx="1.5"
            fill="#fff"
            opacity={on ? 1 : 0.35}
          />
        );
      })}
    </svg>
  );
}
