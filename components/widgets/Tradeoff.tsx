"use client";

import { SimBar, useReport, useSim, type WidgetProps } from "@/components/widgets/sim";
import * as T from "@/lib/widgets/tradeoff";

export function Tradeoff({ config: c, goal, onState }: WidgetProps<T.Config, T.Goal, T.State>) {
  const sim = useSim(T.initial);
  const s = sim.state;
  useReport(s, onState);
  const m = T.metrics(c, s);
  const chosen = c.decisions.flatMap((d) => {
    const o = d.options.find((o) => o.id === s.choices[d.id]);
    return o ? [{ d, o }] : [];
  });

  return (
    <div className="sim">
      <div className="sim__stage tradeoff">
        <div>
          {c.decisions.map((d) => (
            <div className="decision" key={d.id}>
              <p className="decision__label">{d.label}</p>
              <div className="decision__options" role="group" aria-label={d.label}>
                {d.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className="choice-chip"
                    aria-pressed={s.choices[d.id] === o.id}
                    onClick={() => sim.push((x) => ({ choices: { ...x.choices, [d.id]: o.id } }))}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {chosen.length > 0 && (
            <ul className="consequences" aria-live="polite">
              {chosen.map(({ d, o }) => (
                <li key={d.id}>
                  <b>{o.label}:</b> {o.consequence}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          {c.metrics.map((x) => {
            const req = goal?.require.find((r) => r.metric === x.id);
            const off = req && ((req.min !== undefined && m[x.id] < req.min) || (req.max !== undefined && m[x.id] > req.max));
            const limit = req?.min ?? req?.max;
            return (
              <div className="metric" key={x.id}>
                <div className="metric__head">
                  <span>
                    {x.label}{" "}
                    <span className="caption">
                      ({x.better} is better{req ? `; need ${req.min !== undefined ? `≥ ${req.min}` : `≤ ${req.max}`}` : ""})
                    </span>
                  </span>
                  <b>{m[x.id]}</b>
                </div>
                <div className={`metric__bar${off ? " is-off" : ""}`}>
                  <span style={{ inlineSize: `${m[x.id] * 10}%` }} />
                  {limit !== undefined && <i className="metric__limit" style={{ insetInlineStart: `calc(${limit * 10}% - 1px)` }} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <SimBar
        onBack={sim.back}
        onForward={sim.redo}
        onReset={sim.reset}
        canBack={sim.canBack}
        canForward={sim.canRedo}
        label={`${chosen.length} of ${c.decisions.length} decided`}
      />
    </div>
  );
}
