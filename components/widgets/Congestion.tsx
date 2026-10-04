"use client";

import { useEffect, useRef } from "react";
import { SimBar, useReport, useSim, type WidgetProps } from "@/components/widgets/sim";
import * as C from "@/lib/widgets/congestion";

const W = 34;
const H = 160;

export function Congestion({ config: c, onState }: WidgetProps<C.Config, C.Goal, C.State>) {
  const sim = useSim(() => C.initial(c));
  const s = sim.state;
  useReport(s, onState);
  const cur = s.rounds[s.rounds.length - 1];
  // Keep the newest round in view when the chart is wider than the screen.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = Math.max(0, s.rounds.length * W - el.clientWidth + W);
  }, [s.rounds.length]);
  const full = s.rounds.length > c.maxRounds;
  const top = Math.max(16, ...s.rounds.map((r) => Math.max(r.cwnd, r.ssthresh))) + 2;
  const y = (v: number) => H - (v / top) * H;
  const width = Math.max(c.maxRounds + 1, s.rounds.length) * W;

  return (
    <div className="sim">
      <div className="sim__stage">
        {c.switchable && (
          <div className="sim__controls" style={{ marginTop: 0, marginBottom: 14 }}>
            <div className="seg" role="group" aria-label="TCP variant">
              {(["reno", "tahoe"] as const).map((v) => (
                <button key={v} type="button" className="seg__btn" aria-pressed={s.variant === v} onClick={() => sim.push({ ...C.initial(c), variant: v })}>
                  {v === "reno" ? "Reno" : "Tahoe"}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="cwnd" ref={scroller} role="img" aria-label={`Congestion window by round: ${s.rounds.map((r) => r.cwnd).join(", ")}`}>
          <svg width={width} height={H + 34} viewBox={`0 -6 ${width} ${H + 40}`}>
            {[0, 4, 8, 12, 16, 20, 24, 28, 32].filter((v) => v <= top).map((v) => (
              <g key={v}>
                <line x1={0} x2={width} y1={y(v)} y2={y(v)} className="cwnd__grid" />
              </g>
            ))}
            {s.rounds.map((r, i) => (
              <g key={i}>
                <rect x={i * W + 6} y={y(r.cwnd)} width={W - 12} height={H - y(r.cwnd)} rx={4} className={`cwnd__bar${i === s.rounds.length - 1 ? " is-now" : ""}`} />
                <text x={i * W + W / 2} y={y(r.cwnd) - 5} textAnchor="middle" className="cwnd__val">
                  {r.cwnd}
                </text>
                <text x={i * W + W / 2} y={H + 16} textAnchor="middle" className="cwnd__axis">
                  {i + 1}
                </text>
                {r.event && r.event !== "ack" && (
                  <text x={i * W + W / 2} y={H + 30} textAnchor="middle" className="cwnd__event">
                    {r.event === "dupack" ? "3 dup" : "timeout"}
                  </text>
                )}
              </g>
            ))}
            <polyline
              className="cwnd__ssthresh"
              points={s.rounds.flatMap((r, i) => [`${i * W},${y(r.ssthresh)}`, `${(i + 1) * W},${y(r.ssthresh)}`]).join(" ")}
            />
          </svg>
        </div>
        <div className="sim__controls">
          <span className="pill figure">Round {s.rounds.length}</span>
          <span className="pill figure">cwnd {cur.cwnd} MSS</span>
          <span className="pill figure">ssthresh {cur.ssthresh}</span>
          <span className="pill pill--accent">{C.phase(cur)}</span>
          <span className="caption">Dashed line: ssthresh</span>
        </div>
        <p className="sim__label" style={{ marginTop: 14 }}>
          How does round {s.rounds.length} end?
        </p>
        <div className="sim__controls" style={{ marginTop: 6 }}>
          <button type="button" className="btn btn--secondary btn--sm" disabled={full} onClick={() => sim.push((x) => C.play(x, "ack"))}>
            All ACKed
          </button>
          <button type="button" className="btn btn--secondary btn--sm" disabled={full} onClick={() => sim.push((x) => C.play(x, "dupack"))}>
            3 duplicate ACKs
          </button>
          <button type="button" className="btn btn--secondary btn--sm" disabled={full} onClick={() => sim.push((x) => C.play(x, "timeout"))}>
            Timeout
          </button>
        </div>
      </div>
      <SimBar
        onBack={sim.back}
        onForward={() => (sim.canRedo ? sim.redo() : sim.push((x) => C.play(x, "ack")))}
        forwardLabel="Next round (all ACKed)"
        onReset={sim.reset}
        canBack={sim.canBack}
        canForward={sim.canRedo || !full}
        label={`${s.variant === "reno" ? "Reno" : "Tahoe"}`}
      />
    </div>
  );
}
