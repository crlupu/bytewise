"use client";

import { useState } from "react";
import { SimBar, useReport, useSim, type WidgetProps } from "@/components/widgets/sim";
import * as B from "@/lib/widgets/btree";

const CELL = 30;
const PAD = 6;
const GAP = 14;
const LEVEL = 70;
const H = 32;

type Placed = { node: B.Node; x: number; y: number; w: number; path: string; kids: Placed[] };

/** Leaves sit side by side; each parent is centred over its children. */
function layout(root: B.Node) {
  let cursor = 0;
  const width = (n: B.Node) => Math.max(1, n.keys.length) * CELL + PAD * 2;
  const place = (n: B.Node, depth: number, path: string): Placed => {
    const w = width(n);
    if (!n.children.length) {
      const p = { node: n, x: cursor, y: depth * LEVEL, w, path, kids: [] };
      cursor += w + GAP;
      return p;
    }
    const kids = n.children.map((c, i) => place(c, depth + 1, `${path}${i}.`));
    const left = kids[0].x;
    const right = kids[kids.length - 1].x + kids[kids.length - 1].w;
    let x = (left + right) / 2 - w / 2;
    if (x < 0) x = 0;
    return { node: n, x, y: depth * LEVEL, w, path, kids };
  };
  const root_ = place(root, 0, "");
  const all: Placed[] = [];
  const walk = (p: Placed) => {
    all.push(p);
    p.kids.forEach(walk);
  };
  walk(root_);
  const totalW = Math.max(cursor - GAP, ...all.map((p) => p.x + p.w));
  return { all, width: totalW, height: (B.height(root) - 1) * LEVEL + H };
}

export function BTree({ config: c, onState }: WidgetProps<B.Config, B.Goal, B.State>) {
  const sim = useSim(() => B.initial(c));
  const s = sim.state;
  useReport(s, onState);
  const [text, setText] = useState("");
  const { all, width, height } = layout(s.root);
  const onPath = (p: string) => {
    if (!s.last && !s.message) return false;
    const target = s.path.map((i) => `${i}.`).join("");
    return target.startsWith(p);
  };
  const nextKey = c.sequence[s.next];
  const value = Number.parseInt(text, 10);
  const valid = Number.isFinite(value) && String(value) === text.trim();

  return (
    <div className="sim">
      <div className="sim__stage">
        <div className="btree">
          <svg width={width + 4} height={height + 4} viewBox={`-2 -2 ${width + 4} ${height + 4}`} role="img" aria-label={`B-tree with keys ${B.keys(s.root).join(", ") || "none"}`}>
            {all.flatMap((p) =>
              p.kids.map((k, i) => {
                const sx = p.x + PAD + i * CELL;
                return (
                  <line
                    key={`${p.path}-${i}`}
                    className={`bt-edge${onPath(k.path) ? " is-path" : ""}`}
                    x1={p.node.keys.length ? sx : p.x + p.w / 2}
                    y1={p.y + H}
                    x2={k.x + k.w / 2}
                    y2={k.y}
                  />
                );
              }),
            )}
            {all.map((p) => (
              <g key={p.path || "root"} className={`bt-node${onPath(p.path) ? " is-path" : ""}`}>
                <rect x={p.x} y={p.y} width={p.w} height={H} rx={8} />
                {p.node.keys.map((k, i) => (
                  <g key={k}>
                    {i > 0 && <line x1={p.x + PAD + i * CELL} x2={p.x + PAD + i * CELL} y1={p.y + 7} y2={p.y + H - 7} />}
                    <text
                      x={p.x + PAD + i * CELL + CELL / 2}
                      y={p.y + H / 2}
                      dominantBaseline="central"
                      textAnchor="middle"
                      className={s.last?.key === k ? "is-new" : ""}
                    >
                      {k}
                    </text>
                  </g>
                ))}
                {!p.node.keys.length && (
                  <text x={p.x + p.w / 2} y={p.y + H / 2} dominantBaseline="central" textAnchor="middle" opacity={0.4}>
                    ∅
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>

        <div className="sim__controls">
          <span className="pill">Order {c.order} · up to {c.order - 1} keys a node</span>
          <span className="pill figure">Height {B.height(s.root)}</span>
          <span className="pill figure">Splits {s.splits}</span>
        </div>

        {c.sequence.length > 0 && (
          <div className="sim__controls">
            <span className="sim__label">To insert</span>
            <div className="chip-row">
              {c.sequence.map((k, i) => (
                <span key={i} className={`key-chip${i === s.next ? " is-next" : i < s.next ? " is-used" : ""}`}>
                  {k}
                </span>
              ))}
            </div>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={nextKey === undefined}
              onClick={() => sim.push((x) => B.doInsert(x, c, nextKey, true))}
            >
              Insert {nextKey ?? "–"}
            </button>
          </div>
        )}

        {(c.custom || c.search) && (
          <form
            className="sim__controls inline-form"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <input
              className="field"
              inputMode="numeric"
              placeholder="Key"
              aria-label="Key"
              value={text}
              onChange={(e) => setText(e.target.value.replace(/[^\d-]/g, ""))}
            />
            {c.custom && (
              <button
                type="submit"
                className="btn btn--secondary btn--sm"
                disabled={!valid}
                onClick={() => {
                  sim.push((x) => B.doInsert(x, c, value));
                  setText("");
                }}
              >
                Insert
              </button>
            )}
            {c.search && (
              <button type="button" className="btn btn--secondary btn--sm" disabled={!valid} onClick={() => sim.push((x) => B.doSearch(x, value))}>
                Search
              </button>
            )}
          </form>
        )}

        {s.message && (
          <p className={`sim__message${s.last?.split || s.last?.found ? " sim__message--good" : ""}`} aria-live="polite">
            {s.message}
          </p>
        )}
      </div>
      <SimBar
        onBack={sim.back}
        onForward={() => (sim.canRedo ? sim.redo() : nextKey !== undefined && sim.push((x) => B.doInsert(x, c, nextKey, true)))}
        onReset={sim.reset}
        canBack={sim.canBack}
        canForward={sim.canRedo || nextKey !== undefined}
        label={`${B.keys(s.root).length} keys`}
      />
    </div>
  );
}
