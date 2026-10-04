"use client";

import Link from "next/link";
import { CalendarIcon, PlayIcon, ReviewIcon } from "@/components/icons";
import { PageHead, plural } from "@/components/ui";
import { addDays, formatDay, today } from "@/lib/dates";
import { INTERVALS, dueItems, useHydrated, useProgress } from "@/lib/progress";

/**
 * The review queue: what's due now, and what's coming up over the next
 * week. Every exercise finished in a lesson lands here, coming back at
 * growing intervals; a miss or a hint brings it back sooner.
 */
export function ReviewView({ exerciseKeys, titles }: { exerciseKeys: string[]; titles: Record<string, string> }) {
  const p = useProgress();
  const hydrated = useHydrated();
  const known = new Set(exerciseKeys);
  const due = dueItems(p, known);
  const items = Object.entries(p.review).filter(([k]) => known.has(k));
  const t = today();
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, i + 1)).map((d) => ({
    d,
    n: items.filter(([, r]) => r.due === d).length,
  }));
  const later = items.filter(([, r]) => r.due > addDays(t, 7)).length;
  const byLesson = new Map<string, number>();
  for (const k of due) {
    const lk = k.split("/").slice(0, 2).join("/");
    byLesson.set(lk, (byLesson.get(lk) ?? 0) + 1);
  }

  return (
    <>
      <PageHead
        title="Review"
        lede="Exercises you've finished come back at growing intervals — 1, 3, 7, 14 days and on — so they stick. A miss or a hint brings one back sooner."
      />

      <div className="card card--pad hero">
        {hydrated && due.length > 0 ? (
          <>
            <div>
              <p className="hero__eyebrow">Due today</p>
              <h2 className="hero__title">{plural(due.length, "item")} to review</h2>
              <p className="muted" style={{ fontSize: "0.9375rem", marginTop: 4 }}>
                Mixed from {plural(byLesson.size, "lesson")}. About {Math.max(1, Math.round(Math.min(due.length, 20) * 0.5))} min
                {due.length > 20 ? "; a session takes 20 at a time" : ""}.
              </p>
            </div>
            <div>
              <Link href="/session/" className="btn btn--primary">
                <PlayIcon aria-hidden />
                Start review
              </Link>
            </div>
          </>
        ) : (
          <div className="empty" style={{ padding: "1rem 0" }}>
            <ReviewIcon className="empty__icon" aria-hidden />
            <p className="empty__title">Nothing due</p>
            <p>{items.length ? "You're up to date. New items arrive as their intervals come round." : "Finish a lesson and its exercises will start appearing here."}</p>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <section>
          <h2 className="section-title">Coming up</h2>
          <ul className="list">
            {week.map(({ d, n }, i) => (
              <li key={d}>
                <div className="list-row">
                  <CalendarIcon className="muted" aria-hidden style={{ width: 20, height: 20 }} />
                  <span className="list-row__body">{i === 0 ? "Tomorrow" : formatDay(d)}</span>
                  <span className="list-row__end figure">{n ? plural(n, "item") : "–"}</span>
                </div>
              </li>
            ))}
            <li>
              <div className="list-row">
                <CalendarIcon className="muted" aria-hidden style={{ width: 20, height: 20 }} />
                <span className="list-row__body">Later</span>
                <span className="list-row__end figure">{later ? plural(later, "item") : "–"}</span>
              </div>
            </li>
          </ul>
        </section>
      )}

      {due.length > 0 && (
        <section>
          <h2 className="section-title">Due by lesson</h2>
          <ul className="list">
            {[...byLesson].map(([lk, n]) => (
              <li key={lk}>
                <div className="list-row">
                  <span className="list-row__body">{titles[lk] ?? lk}</span>
                  <span className="list-row__end figure">{n}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="caption">
        Intervals: {INTERVALS.join(", ")} days.
      </p>
    </>
  );
}
