"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ResetIcon, StepBackIcon, StepForwardIcon } from "@/components/icons";

/**
 * The history every simulation shares: each move pushes a new state, and
 * the learner can step back through them, forward again, or reset. A move
 * made after stepping back drops the states that were ahead.
 */
export function useSim<S>(init: () => S) {
  const [h, setH] = useState(() => ({ list: [init()], i: 0 }));
  const state = h.list[h.i];
  const push = useCallback((next: S | ((s: S) => S)) => {
    setH((h) => {
      const cur = h.list[h.i];
      const s = typeof next === "function" ? (next as (s: S) => S)(cur) : next;
      if (s === cur) return h;
      return { list: [...h.list.slice(0, h.i + 1), s], i: h.i + 1 };
    });
  }, []);
  /** Change the current state without making a step (a refusal message, say). */
  const replace = useCallback((s: S) => setH((h) => ({ list: [...h.list.slice(0, h.i), s, ...h.list.slice(h.i + 1)], i: h.i })), []);
  return {
    state,
    index: h.i,
    push,
    replace,
    back: () => setH((h) => ({ ...h, i: Math.max(0, h.i - 1) })),
    redo: () => setH((h) => ({ ...h, i: Math.min(h.list.length - 1, h.i + 1) })),
    reset: () => setH({ list: [init()], i: 0 }),
    canBack: h.i > 0,
    canRedo: h.i < h.list.length - 1,
  };
}

/** Report each new state to the step, which checks it against the goal. */
export function useReport<S>(state: S, onState: (s: S) => void) {
  const cb = useRef(onState);
  cb.current = onState;
  useEffect(() => cb.current(state), [state]);
}

export function SimBar({
  onBack,
  onForward,
  onReset,
  canBack,
  canForward,
  label,
  forwardLabel = "Step forward",
}: {
  onBack: () => void;
  onForward: () => void;
  onReset: () => void;
  canBack: boolean;
  canForward: boolean;
  label?: string;
  forwardLabel?: string;
}) {
  return (
    <div className="sim__bar">
      <button type="button" className="icon-btn" onClick={onBack} disabled={!canBack} aria-label="Step back" title="Step back">
        <StepBackIcon aria-hidden />
      </button>
      <button type="button" className="icon-btn" onClick={onForward} disabled={!canForward} aria-label={forwardLabel} title={forwardLabel}>
        <StepForwardIcon aria-hidden />
      </button>
      <button type="button" className="icon-btn" onClick={onReset} disabled={!canBack && !canForward} aria-label="Reset" title="Reset">
        <ResetIcon aria-hidden />
      </button>
      {label && <span className="sim__bar-label">{label}</span>}
    </div>
  );
}

export type WidgetProps<C, G, S> = {
  config: C;
  goal?: G;
  onState: (s: S) => void;
  reducedMotion: boolean;
};
