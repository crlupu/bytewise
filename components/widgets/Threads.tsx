"use client";

import { PlayIcon } from "@/components/icons";
import { SimBar, useReport, useSim, type WidgetProps } from "@/components/widgets/sim";
import * as T from "@/lib/widgets/threads";

export function Threads({ config: c, onState, reducedMotion }: WidgetProps<T.Config, T.Goal, T.State>) {
  const sim = useSim(() => T.initial(c));
  const s = sim.state;
  useReport(s, onState);
  const prog = T.program(c);
  const done = T.finished(s, c);
  const lastWrite = s.trace.length && s.trace[s.trace.length - 1].op === "write";

  return (
    <div className="sim">
      <div className="sim__stage">
        <div className="threads" style={{ ["--n" as string]: c.threads }}>
          {s.pcs.map((pc, t) => {
            const why = T.blocked(s, c, t);
            return (
              <div className="thread" key={t}>
                <div className="thread__head">
                  <span className="thread__name">T{t + 1}</span>
                  {s.lock === t && <span className="pill pill--accent">holds lock</span>}
                </div>
                <ol className="thread__ops">
                  {prog.map((op, i) => (
                    <li key={i} className={i < pc ? "is-done" : i === pc ? "is-next" : ""}>
                      <span className="pc" aria-hidden>
                        {i === pc ? "▸" : ""}
                      </span>
                      {T.opText(op, c)}
                    </li>
                  ))}
                </ol>
                <p className="thread__reg">
                  tmp: <b>{s.regs[t] ?? "–"}</b>
                </p>
                <button type="button" className="btn btn--secondary btn--sm btn--block" disabled={!!why} onClick={() => sim.push((x) => T.step(x, c, t))}>
                  {why === "finished" ? "Finished" : why ? "Blocked" : (
                    <>
                      <PlayIcon aria-hidden /> Run T{t + 1}
                    </>
                  )}
                </button>
                {why && why !== "finished" && <p className="caption" style={{ marginTop: 6 }}>{why}</p>}
              </div>
            );
          })}
          <div className="shared" aria-live="polite">
            <span className={`shared__value${lastWrite && !reducedMotion ? " flash" : ""}`} key={s.trace.length}>
              {s.shared}
            </span>
            <span className="shared__label">shared {c.variable}</span>
          </div>
        </div>
        {s.trace.length > 0 && (
          <ol className="trace" aria-label="What has run">
            {s.trace.map((e, i) => (
              <li key={i}>
                <span className="trace__who">T{e.thread + 1}</span>
                <span>{e.text}</span>
              </li>
            ))}
          </ol>
        )}
        {done && (
          <p className="sim__message">
            All threads finished. {c.variable} is <b>{s.shared}</b> after{" "}
            {c.threads * c.increments} increments.
          </p>
        )}
      </div>
      <SimBar
        onBack={sim.back}
        onForward={sim.redo}
        onReset={sim.reset}
        canBack={sim.canBack}
        canForward={sim.canRedo}
        label={`${s.trace.length} of ${prog.length * c.threads} instructions`}
      />
    </div>
  );
}
