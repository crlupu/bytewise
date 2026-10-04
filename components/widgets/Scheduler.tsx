"use client";

import { useMemo } from "react";
import { SimBar, useReport, useSim, type WidgetProps } from "@/components/widgets/sim";
import * as S from "@/lib/widgets/scheduler";

const COLORS = ["var(--data-indigo)", "var(--data-teal)", "var(--data-orange)", "var(--data-magenta)", "var(--data-green)", "var(--data-slate)"];
const NAMES: Record<S.Algorithm, string> = { FIFO: "FIFO", SJF: "SJF", STCF: "STCF", RR: "Round robin" };
const r1 = (x: number) => (Math.round(x * 10) / 10).toString();

export function Scheduler({ config: c, onState }: WidgetProps<S.Config, S.Goal, S.State>) {
  const sim = useSim(() => S.initial(c));
  const s = sim.state;
  useReport(s, onState);
  const run = useMemo(() => S.simulate(c.jobs, s.algorithm, s.quantum), [c.jobs, s.algorithm, s.quantum]);
  const total = run.slots.length;
  const done = s.time >= total;
  const m = S.metrics(c.jobs, run);
  const shown = run.slots.slice(0, s.time);
  const running = s.time > 0 ? run.slots[s.time - 1] : null;
  const switchTo = (patch: Partial<S.State>) => sim.push({ ...s, ...patch, time: 0 });

  return (
    <div className="sim">
      <div className="sim__stage">
        {(c.algorithms.length > 1 || (s.algorithm === "RR" && c.quantumChoices)) && (
          <div className="sim__controls" style={{ marginTop: 0, marginBottom: 14 }}>
            {c.algorithms.length > 1 && (
              <div className="seg" role="group" aria-label="Scheduler">
                {c.algorithms.map((a) => (
                  <button key={a} type="button" className="seg__btn" aria-pressed={s.algorithm === a} onClick={() => switchTo({ algorithm: a })}>
                    {NAMES[a]}
                  </button>
                ))}
              </div>
            )}
            {s.algorithm === "RR" && c.quantumChoices && (
              <div className="seg" role="group" aria-label="Time slice">
                {c.quantumChoices.map((q) => (
                  <button key={q} type="button" className="seg__btn" aria-pressed={s.quantum === q} onClick={() => switchTo({ quantum: q })}>
                    slice {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="gantt" role="img" aria-label={`Timeline: ${shown.map((x) => (x === null ? "idle" : c.jobs[x].name)).join(", ") || "not started"}`}>
          <div className="gantt__row" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
            {run.slots.map((x, i) => (
              <span
                key={i}
                className={`gantt__cell${i >= s.time ? " is-future" : ""}${i === s.time - 1 ? " is-now" : ""}`}
                style={i < s.time && x !== null ? { background: COLORS[x % COLORS.length] } : undefined}
              >
                {i < s.time && x !== null && (i === 0 || run.slots[i - 1] !== x) ? c.jobs[x].name : ""}
              </span>
            ))}
          </div>
          <div className="gantt__axis" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
            {run.slots.map((_, i) => (
              <span key={i}>{i % 5 === 0 ? i : ""}</span>
            ))}
          </div>
        </div>

        <div className="sched-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Job</th>
                <th scope="col">Arrives</th>
                <th scope="col">Length</th>
                <th scope="col">Response</th>
                <th scope="col">Turnaround</th>
              </tr>
            </thead>
            <tbody>
              {c.jobs.map((j, i) => {
                const started = run.firstRun[i] >= 0 && run.firstRun[i] < s.time;
                const finished = run.completion[i] >= 0 && run.completion[i] <= s.time;
                return (
                  <tr key={j.name} className={running === i ? "is-running" : ""}>
                    <th scope="row">
                      <span className="dot" style={{ background: COLORS[i % COLORS.length] }} aria-hidden /> {j.name}
                    </th>
                    <td>{j.arrival}</td>
                    <td>{j.burst}</td>
                    <td>{started ? m.response[i] : "–"}</td>
                    <td>{finished ? m.turnaround[i] : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
            {done && (
              <tfoot>
                <tr>
                  <th scope="row" colSpan={3}>
                    Average
                  </th>
                  <td>{r1(m.avgResponse)}</td>
                  <td>{r1(m.avgTurnaround)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className={`sim__message${done ? " sim__message--good" : ""}`} aria-live="polite">
          {done
            ? `${NAMES[s.algorithm]}${s.algorithm === "RR" ? ` (slice ${s.quantum})` : ""}: average turnaround ${r1(m.avgTurnaround)}, average response ${r1(m.avgResponse)}.`
            : s.time === 0
              ? "Step forward to run the first tick, or play the whole schedule."
              : `Tick ${s.time - 1}: ${running === null ? "the CPU is idle" : `${c.jobs[running].name} runs`}.`}
        </p>
        {!done && (
          <div className="sim__controls">
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => sim.push({ ...s, time: total })}>
              Play to the end
            </button>
          </div>
        )}
      </div>
      <SimBar
        onBack={() => sim.push({ ...s, time: s.time - 1 })}
        onForward={() => sim.push({ ...s, time: s.time + 1 })}
        onReset={() => sim.push({ ...s, time: 0 })}
        canBack={s.time > 0}
        canForward={!done}
        label={`Time ${s.time} / ${total}`}
      />
    </div>
  );
}
