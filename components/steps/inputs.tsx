"use client";

import { useRef, useState } from "react";
import { CheckIcon, DownIcon, GripIcon, UpIcon, WrongIcon } from "@/components/icons";
import { Html } from "@/components/ui";
import type { BlankStep, MatchStep, Option, OrderStep } from "@/lib/types";

export type Phase = "answering" | "wrong" | "correct";

/**
 * The answer controls for each exercise type. Each is controlled: the step
 * owns the value, and passes the phase so the control can show which parts
 * were right after a Check.
 */

export function Options({
  options,
  multiple,
  value,
  onChange,
  phase,
}: {
  options: Option[];
  multiple: boolean;
  value: number[];
  onChange: (v: number[]) => void;
  phase: Phase;
}) {
  const locked = phase === "correct";
  return (
    <div>
      {multiple && <p className="choice-note">Choose all that apply.</p>}
      <div className="options" role={multiple ? "group" : "radiogroup"}>
        {options.map((o, i) => {
          const on = value.includes(i);
          const cls = [
            "option",
            on && phase === "wrong" && !o.correct ? "is-wrong" : on ? "is-selected" : "",
            phase === "correct" && o.correct ? "is-correct" : "",
          ].join(" ");
          return (
            <button
              key={i}
              type="button"
              role={multiple ? "checkbox" : "radio"}
              aria-checked={on}
              className={cls}
              disabled={locked}
              onClick={() => onChange(multiple ? (on ? value.filter((v) => v !== i) : [...value, i]) : [i])}
            >
              <span className={`option__mark${multiple ? " option__mark--square" : ""}`} aria-hidden>
                {on && (phase === "wrong" && !o.correct ? <WrongIcon /> : <CheckIcon />)}
              </span>
              <Html as="span" className="option__text" html={o.html} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TextAnswer({
  value,
  onChange,
  onSubmit,
  phase,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  phase: Phase;
}) {
  return (
    <label style={{ display: "block" }}>
      <span className="choice-note" style={{ display: "block" }}>
        Your answer
      </span>
      <input
        className="field field--code"
        value={value}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        readOnly={phase === "correct"}
        placeholder="Type what it prints"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onSubmit();
        }}
      />
    </label>
  );
}

/** Reorder by dragging the grip, or with the up and down buttons. */
export function OrderAnswer({
  step,
  value,
  onChange,
  phase,
}: {
  step: OrderStep;
  value: number[];
  onChange: (v: number[]) => void;
  phase: Phase;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const locked = phase === "correct";

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return;
    const next = value.slice();
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  };

  const onPointerDown = (e: React.PointerEvent, index: number) => {
    if (locked) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(index);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging === null || !listRef.current) return;
    const items = [...listRef.current.children] as HTMLElement[];
    let target = dragging;
    items.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (i < dragging && e.clientY < r.top + r.height / 2) target = Math.min(target, i);
      if (i > dragging && e.clientY > r.top + r.height / 2) target = Math.max(target, i);
    });
    if (target !== dragging) {
      move(dragging, target);
      setDragging(target);
    }
  };

  return (
    <ol className="order-list" ref={listRef} onPointerMove={onPointerMove} onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)}>
      {value.map((item, i) => {
        const marked = phase !== "answering";
        const cls = [
          "order-item",
          dragging === i ? "is-dragging" : "",
          marked && item === i ? "is-right" : "",
          phase === "wrong" && item !== i ? "is-off" : "",
        ].join(" ");
        return (
          <li key={item} className={cls}>
            <span className="order-item__index">{i + 1}</span>
            <Html as="span" className="order-item__text" html={step.items[item]} />
            {!locked && (
              <span className="order-item__moves">
                <button type="button" className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}>
                  <UpIcon aria-hidden />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Move down"
                  disabled={i === value.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  <DownIcon aria-hidden />
                </button>
                <span className="icon-btn grip" aria-hidden onPointerDown={(e) => onPointerDown(e, i)}>
                  <GripIcon />
                </span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const LETTERS = "ABCDEFGHIJ";

/** Tap an item on the left, then its partner on the right. Tap a pair again to undo it. */
export function MatchAnswer({
  step,
  value,
  onChange,
  phase,
}: {
  step: MatchStep;
  value: Record<number, number>;
  onChange: (v: Record<number, number>) => void;
  phase: Phase;
}) {
  const [active, setActive] = useState<{ side: "l" | "r"; i: number } | null>(null);
  const locked = phase === "correct";
  const leftOf = (r: number) => {
    const hit = Object.entries(value).find(([, v]) => v === r);
    return hit ? Number(hit[0]) : undefined;
  };

  const pair = (l: number, r: number) => {
    const next: Record<number, number> = {};
    for (const [k, v] of Object.entries(value)) if (Number(k) !== l && v !== r) next[Number(k)] = v;
    next[l] = r;
    onChange(next);
    setActive(null);
  };

  const tapLeft = (i: number) => {
    if (locked) return;
    if (active?.side === "r") return pair(i, active.i);
    if (value[i] !== undefined && active?.i !== i) {
      const next = { ...value };
      delete next[i];
      onChange(next);
    }
    setActive(active?.side === "l" && active.i === i ? null : { side: "l", i });
  };
  const tapRight = (r: number) => {
    if (locked) return;
    if (active?.side === "l") return pair(active.i, r);
    const l = leftOf(r);
    if (l !== undefined) {
      const next = { ...value };
      delete next[l];
      onChange(next);
    }
    setActive(active?.side === "r" && active.i === r ? null : { side: "r", i: r });
  };

  const state = (l: number | undefined) => {
    if (l === undefined || phase === "answering") return "";
    return value[l] === l ? " is-right" : phase === "wrong" ? " is-wrong" : "";
  };

  return (
    <div className="match">
      <div className="match__col">
        {step.left.map((html, i) => (
          <button
            key={i}
            type="button"
            className={`match-item${value[i] !== undefined ? " is-paired" : ""}${active?.side === "l" && active.i === i ? " is-active" : ""}${state(value[i] !== undefined ? i : undefined)}`}
            aria-pressed={active?.side === "l" && active.i === i}
            onClick={() => tapLeft(i)}
            disabled={locked}
          >
            <span className="match-item__tag">{LETTERS[i]}</span>
            <Html as="span" html={html} />
          </button>
        ))}
      </div>
      <div className="match__col">
        {step.rightOrder.map((r) => {
          const l = leftOf(r);
          return (
            <button
              key={r}
              type="button"
              className={`match-item${l !== undefined ? " is-paired" : ""}${active?.side === "r" && active.i === r ? " is-active" : ""}${state(l)}`}
              aria-pressed={active?.side === "r" && active.i === r}
              onClick={() => tapRight(r)}
              disabled={locked}
            >
              <span className="match-item__tag">{l !== undefined ? LETTERS[l] : ""}</span>
              <Html as="span" html={step.right[r]} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BlankAnswer({
  step,
  value,
  onChange,
  onSubmit,
  phase,
  right,
}: {
  step: BlankStep;
  value: string[];
  onChange: (v: string[]) => void;
  onSubmit: () => void;
  phase: Phase;
  right?: boolean[];
}) {
  let n = -1;
  return (
    <div className={step.code ? "blank-text blank-text--code" : "blank-text"}>
      {step.parts.map((p, i) => {
        if ("text" in p) return p.html !== undefined ? <span key={i} dangerouslySetInnerHTML={{ __html: p.html }} /> : <span key={i}>{p.text}</span>;
        n++;
        const k = n;
        const mark = phase !== "answering" && right ? (right[k] ? " is-right" : phase === "wrong" ? " is-wrong" : "") : "";
        return (
          <input
            key={i}
            className={`blank-input${mark}`}
            aria-label={`Blank ${k + 1}`}
            value={value[k] ?? ""}
            size={Math.max(p.size, (value[k] ?? "").length) + 1}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            readOnly={phase === "correct"}
            onChange={(e) => {
              const next = value.slice();
              next[k] = e.target.value;
              onChange(next);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit();
            }}
          />
        );
      })}
    </div>
  );
}
