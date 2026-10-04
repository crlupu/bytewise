"use client";

import { SimBar, useReport, useSim, type WidgetProps } from "@/components/widgets/sim";
import * as T from "@/lib/widgets/tcp";

export function Tcp({ config: c, onState }: WidgetProps<T.Config, T.Goal, T.State>) {
  const sim = useSim(() => T.initial(c));
  const s = sim.state;
  useReport(s, onState);
  const acts = T.actions(c);

  const press = (side: T.Side, action: T.Action) => {
    const next = T.act(s, c, side, action);
    // A refused move explains itself but isn't a step to undo.
    if (next.refusal) sim.replace(next);
    else sim.push(next);
  };

  const side = (who: T.Side) => (
    <div className="tcp__side">
      <div className="tcp__name">{who === "client" ? "Client" : "Server"}</div>
      <div className={`tcp__state${s[who] === "ESTABLISHED" ? " is-est" : ""}`} aria-live="polite">
        {s[who]}
      </div>
    </div>
  );

  return (
    <div className="sim">
      <div className="sim__stage">
        <div className="tcp">
          {side("client")}
          <div className="tcp__wire">
            <div className="tcp__lane" aria-label="Segments sent">
              {s.segments.length === 0 && <p className="caption" style={{ textAlign: "center", paddingTop: 8 }}>No segments yet</p>}
              {s.segments.map((g, i) => (
                <div key={i} className={`seg-arrow seg-arrow--${g.from === "client" ? "right" : "left"}`}>
                  <div className="seg-arrow__flags">{g.flags}</div>
                  <div className="seg-arrow__nums">
                    seq={g.seq}
                    {g.ack !== null && ` ack=${g.ack}`}
                  </div>
                  <div className="seg-arrow__line" />
                </div>
              ))}
            </div>
          </div>
          {side("server")}
        </div>
        <div className="tcp__actions">
          {(["client", "server"] as const).map((who) => (
            <div key={who}>
              <p className="sim__label" style={{ marginBottom: 6 }}>
                {who === "client" ? "Client sends" : "Server sends"}
              </p>
              <div className="tcp__actions-col">
                {acts
                  .filter((a) => a.side === who)
                  .map((a) => (
                    <button key={a.action} type="button" className="btn btn--secondary btn--sm" onClick={() => press(who, a.action)}>
                      {a.label}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
        {s.refusal && (
          <p className="sim__message sim__message--warn" role="status">
            {s.refusal}
          </p>
        )}
      </div>
      <SimBar
        onBack={sim.back}
        onForward={sim.redo}
        onReset={sim.reset}
        canBack={sim.canBack}
        canForward={sim.canRedo}
        label={`${s.segments.length} segment${s.segments.length === 1 ? "" : "s"}`}
      />
    </div>
  );
}
