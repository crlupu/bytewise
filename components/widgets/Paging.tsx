"use client";

import { useMemo } from "react";
import { SimBar, useReport, useSim, type WidgetProps } from "@/components/widgets/sim";
import * as P from "@/lib/widgets/paging";

const WHY: Record<P.Algorithm, string> = {
  FIFO: "it was loaded earliest",
  LRU: "it was used least recently",
  OPT: "it's needed furthest in the future",
};

export function Paging({ config: c, onState }: WidgetProps<P.Config, P.Goal, P.State>) {
  const sim = useSim(() => P.initial(c));
  const s = sim.state;
  useReport(s, onState);
  const rows = useMemo(() => P.simulate(c.reference, s.frames, s.algorithm), [c.reference, s.frames, s.algorithm]);
  const shown = rows.slice(0, s.step);
  const faults = shown.filter((r) => r.fault).length;
  const cur = s.step > 0 ? rows[s.step - 1] : null;
  const done = s.step >= c.reference.length;

  let message = "Step forward to bring in the first page.";
  if (cur) {
    message = !cur.fault
      ? `Page ${cur.page} is already in memory: a hit.`
      : cur.victim === null
        ? `Page ${cur.page} isn't in memory: a fault. A frame is free, so it goes there.`
        : `Page ${cur.page} isn't in memory: a fault. ${s.algorithm} evicts page ${cur.victim}, because ${WHY[s.algorithm]}.`;
  }
  if (done) message = `Done: ${faults} faults and ${c.reference.length - faults} hits with ${s.frames} frames under ${s.algorithm}.`;

  return (
    <div className="sim">
      <div className="sim__stage">
        {(c.algorithms.length > 1 || c.frameChoices) && (
          <div className="sim__controls" style={{ marginTop: 0, marginBottom: 14 }}>
            {c.algorithms.length > 1 && (
              <div className="seg" role="group" aria-label="Policy">
                {c.algorithms.map((a) => (
                  <button key={a} type="button" className="seg__btn" aria-pressed={s.algorithm === a} onClick={() => sim.push({ ...s, algorithm: a })}>
                    {a}
                  </button>
                ))}
              </div>
            )}
            {c.frameChoices && (
              <div className="seg" role="group" aria-label="Frames">
                {c.frameChoices.map((f) => (
                  <button key={f} type="button" className="seg__btn" aria-pressed={s.frames === f} onClick={() => sim.push({ ...s, frames: f })}>
                    {f} frames
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="paging">
          <table>
            <thead>
              <tr>
                <th className="row-label" scope="col">
                  Page
                </th>
                {c.reference.map((p, i) => (
                  <th key={i} scope="col" className={i === s.step - 1 ? "is-now" : i >= s.step ? "is-future" : ""}>
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: s.frames }, (_, f) => (
                <tr key={f}>
                  <th className="row-label" scope="row">
                    Frame {f + 1}
                  </th>
                  {c.reference.map((_, i) => {
                    const r = shown[i];
                    if (!r) return <td key={i} className="is-empty" />;
                    const v = r.frames[f];
                    const loaded = r.fault && v === r.page;
                    const hit = !r.fault && v === r.page;
                    return (
                      <td key={i} className={v === null ? "is-empty" : loaded ? "is-loaded" : hit ? "is-hit" : ""}>
                        {v ?? ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <th className="row-label" scope="row">
                  Fault
                </th>
                {c.reference.map((_, i) => {
                  const r = shown[i];
                  return (
                    <td key={i} className={`fault${r ? (r.fault ? " is-fault" : " is-hit-mark") : ""}`}>
                      {r ? (r.fault ? "F" : "✓") : ""}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <p className={`sim__message${done ? " sim__message--good" : ""}`} aria-live="polite">
          {message}
        </p>
      </div>
      <SimBar
        onBack={() => sim.push({ ...s, step: s.step - 1 })}
        onForward={() => sim.push({ ...s, step: s.step + 1 })}
        onReset={() => sim.push({ ...s, step: 0 })}
        canBack={s.step > 0}
        canForward={!done}
        label={`Faults ${faults} · ${s.step}/${c.reference.length}`}
      />
    </div>
  );
}
