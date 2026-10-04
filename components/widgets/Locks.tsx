"use client";

import { LockIcon, PlayIcon } from "@/components/icons";
import { SimBar, useReport, useSim, type WidgetProps } from "@/components/widgets/sim";
import * as L from "@/lib/widgets/locks";

export function Locks({ config: c, onState }: WidgetProps<L.Config, L.Goal, L.State>) {
  const sim = useSim(() => L.initial(c));
  const s = sim.state;
  useReport(s, onState);
  const dead = L.deadlocked(s, c);
  const done = L.finished(s, c);
  const total = c.threads.reduce((n, t) => n + t.ops.length, 0);

  return (
    <div className="sim">
      <div className="sim__stage">
        <div className="lock-row" aria-label="Locks">
          {L.locksOf(c).map((l) => {
            const h = s.holders[l];
            return (
              <span key={l} className={`lock-chip${h !== null ? " is-held" : ""}`}>
                <LockIcon aria-hidden /> {l}
                <span className="lock-chip__holder">{h === null ? "free" : `held by ${L.threadName(c, h)}`}</span>
              </span>
            );
          })}
        </div>
        <div className="threads" style={{ ["--n" as string]: c.threads.length, gridTemplateColumns: `repeat(${c.threads.length}, minmax(0, 1fr))` }}>
          {c.threads.map((t, ti) => {
            const why = L.blocked(s, c, ti);
            const pc = s.pcs[ti];
            return (
              <div className="thread" key={ti}>
                <div className="thread__head">
                  <span className="thread__name">{L.threadName(c, ti)}</span>
                </div>
                <ol className="thread__ops">
                  {t.ops.map((o, i) => (
                    <li key={i} className={i < pc ? "is-done" : i === pc ? "is-next" : ""}>
                      <span className="pc" aria-hidden>
                        {i === pc ? "▸" : ""}
                      </span>
                      {o}
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm btn--block"
                  style={{ marginTop: 8 }}
                  disabled={!!why}
                  onClick={() => sim.push((x) => L.step(x, c, ti))}
                >
                  {why === "finished" ? "Finished" : why ? "Blocked" : (
                    <>
                      <PlayIcon aria-hidden /> Run {L.threadName(c, ti)}
                    </>
                  )}
                </button>
                {why && why !== "finished" && (
                  <p className="caption" style={{ marginTop: 6 }}>
                    {why}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {dead && (
          <p className="sim__message sim__message--warn" role="status">
            <b>Deadlock.</b> Every unfinished thread is waiting for a lock another one holds — none can ever move again.
          </p>
        )}
        {done && (
          <p className="sim__message sim__message--good" role="status">
            All threads finished{s.backoffs ? ` after ${s.backoffs} back-off${s.backoffs === 1 ? "" : "s"}` : ""}.
          </p>
        )}
        {s.trace.length > 0 && (
          <ol className="trace" aria-label="What has run">
            {s.trace.map((e, i) => (
              <li key={i}>
                <span className="trace__who">{L.threadName(c, e.thread)}</span>
                <span>{e.text}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <SimBar
        onBack={sim.back}
        onForward={sim.redo}
        onReset={sim.reset}
        canBack={sim.canBack}
        canForward={sim.canRedo}
        label={`${s.pcs.reduce((a, b) => a + b, 0)} of ${total} steps`}
      />
    </div>
  );
}
