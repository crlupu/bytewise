"use client";

import Link from "next/link";
import { ReactNode, useEffect, useRef } from "react";
import { BackIcon, CheckIcon, LockIcon } from "@/components/icons";
import type { LessonStatus } from "@/lib/status";

/** The page's large title, with an optional line of context above it. */
export function PageHead({
  title,
  subtitle,
  lede,
  back,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  lede?: ReactNode;
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  useEffect(() => {
    document.title = title === "Learn" ? "Bytewise" : `${title} · Bytewise`;
  }, [title]);
  return (
    <header>
      {back && (
        <Link href={back.href} className="back-link">
          <BackIcon aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="page-head">
        <div className="page-head__text">
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
          <h1 className="page-title">{title}</h1>
        </div>
        {children}
      </div>
      {lede && <p className="page-lede">{lede}</p>}
    </header>
  );
}

export function Meter({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="meter" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ inlineSize: `${pct}%` }} />
    </div>
  );
}

export function Ring({ pct, size = 40, label, bare = false }: { pct: number; size?: number; label?: string; bare?: boolean }) {
  const stroke = size >= 40 ? 4 : 3;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const done = pct >= 100;
  const k = r * 0.38;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `${pct}% complete`}>
      <circle cx={cx} cy={cx} r={r} fill={done ? "var(--accent)" : "none"} stroke="var(--accent-track)" strokeWidth={stroke} />
      {!done && (
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform={`rotate(-90 ${cx} ${cx})`}
          className="ring-progress"
        />
      )}
      {done ? (
        <path
          d={`M${cx - k} ${cx + k * 0.05} L${cx - k * 0.3} ${cx + k * 0.75} L${cx + k} ${cx - k * 0.65}`}
          fill="none"
          stroke="var(--accent-foreground)"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        size >= 40 &&
        !bare && (
          <text x={cx} y={cx} dominantBaseline="central" textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--foreground)" className="figure">
            {pct}%
          </text>
        )
      )}
    </svg>
  );
}

/** A lesson's status as a 28px mark: number, ring, tick or lock. */
export function StatusMark({ status, index, pct }: { status: LessonStatus; index: number; pct: number }) {
  if (status === "completed")
    return (
      <span className="status status--completed" aria-label="Completed">
        <CheckIcon aria-hidden />
      </span>
    );
  if (status === "in_progress")
    return (
      <span className="status status--in_progress" aria-label={`In progress, ${pct}%`}>
        <Ring pct={Math.max(pct, 4)} size={28} label={`In progress, ${pct}%`} />
      </span>
    );
  if (status === "locked")
    return (
      <span className="status status--locked" aria-label="Locked">
        <LockIcon aria-hidden />
      </span>
    );
  return (
    <span className="status figure" aria-label="Available">
      {index + 1}
    </span>
  );
}

export const STATUS_LABEL: Record<LessonStatus, string> = {
  locked: "Locked",
  available: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

/** A small alert dialog: a question, Cancel, and one action. */
export function Confirm({
  open,
  title,
  body,
  action,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  action: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <h2 className="sheet__title">{title}</h2>
      <div className="sheet__body">{body}</div>
      <div className="sheet__actions">
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={`btn ${danger ? "btn--danger" : "btn--primary"}`}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {action}
        </button>
      </div>
    </dialog>
  );
}

export function Html({ html, className, as: Tag = "div" }: { html: string; className?: string; as?: "div" | "span" }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
