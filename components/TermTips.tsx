"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * The popover for glossary terms (buttons with class "term", added to lesson
 * text at build time by lib/glossary.ts). Tap or click a term to open it;
 * on devices with a mouse, hovering opens it too. One popover serves the
 * whole page, positioned under the term — or above it, near the bottom of
 * the screen — and kept inside the viewport.
 */

type Open = { el: HTMLElement; term: string; def: string; book?: string; hover: boolean };

const GUTTER = 16;
const GAP = 8;

export function TermTips() {
  const [open, setOpen] = useState<Open | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const tip = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const pathname = usePathname();

  // Mirrors `open` for the document listeners, which outlive renders.
  const current = useRef<Open | null>(null);

  const set = useCallback((next: Open | null) => {
    const prev = current.current;
    if (prev && prev.el !== next?.el) {
      prev.el.setAttribute("aria-expanded", "false");
      prev.el.removeAttribute("aria-describedby");
    }
    if (next) {
      next.el.setAttribute("aria-expanded", "true");
      next.el.setAttribute("aria-describedby", "term-tip");
    }
    current.current = next;
    setOpen(next);
    if (!next) setPos(null);
  }, []);

  const close = useCallback(
    (refocus = false) => {
      const el = current.current?.el;
      set(null);
      if (refocus) el?.focus();
    },
    [set],
  );

  const show = useCallback(
    (el: HTMLElement, hover: boolean) => {
      window.clearTimeout(closeTimer.current);
      const o = current.current;
      if (o?.el === el) {
        if (o.hover && !hover) set({ ...o, hover: false });
        return;
      }
      set({ el, term: el.dataset.term ?? "", def: el.dataset.def ?? "", book: el.dataset.book, hover });
    },
    [set],
  );

  // Pages change under the popover: close it on navigation.
  useEffect(() => close(), [pathname, close]);

  useEffect(() => {
    const termOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>("button.term") : null);
    const onClick = (e: MouseEvent) => {
      const el = termOf(e.target);
      if (el) {
        e.preventDefault();
        e.stopPropagation();
        // A click on the open term closes it — unless hovering just opened it.
        const o = current.current;
        if (o?.el === el && !o.hover) close();
        else show(el, false);
      } else if (!tip.current?.contains(e.target as Node)) close();
    };
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = termOf(e.target);
      if (el) show(el, true);
      else if (tip.current?.contains(e.target as Node)) window.clearTimeout(closeTimer.current);
    };
    const onOut = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const from = termOf(e.target) ?? (tip.current?.contains(e.target as Node) ? tip.current : null);
      if (!from) return;
      window.clearTimeout(closeTimer.current);
      closeTimer.current = window.setTimeout(() => {
        if (current.current?.hover) close();
      }, 150);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onMove = () => close();
    document.addEventListener("click", onClick, true);
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [show, close]);

  useLayoutEffect(() => {
    if (!open || !tip.current) return;
    const r = open.el.getBoundingClientRect();
    const t = tip.current.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const above = r.bottom + GAP + t.height > vh - GUTTER && r.top - GAP - t.height >= GUTTER;
    const left = Math.min(Math.max(GUTTER, r.left + r.width / 2 - t.width / 2), vw - GUTTER - t.width);
    setPos({ top: above ? r.top - GAP - t.height : r.bottom + GAP, left, above });
  }, [open]);

  if (!open) return null;
  return (
    <div
      ref={tip}
      id="term-tip"
      role="tooltip"
      className={`term-tip${pos?.above ? " term-tip--above" : ""}`}
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: "hidden" }}
    >
      <p className="term-tip__term">{open.term}</p>
      <p className="term-tip__def" dangerouslySetInnerHTML={{ __html: open.def }} />
      {open.book && <p className="term-tip__src">{open.book}</p>}
    </div>
  );
}
