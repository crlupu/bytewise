"use client";

import Link from "next/link";
import { CalendarIcon, DoneIcon, StreakIcon, TrophyIcon } from "@/components/icons";
import { PageHead, plural } from "@/components/ui";
import { addDays, formatDay, parseKey, today, weekStart } from "@/lib/dates";
import { streak, useHydrated, useProgress, type Progress } from "@/lib/progress";
import type { Catalog } from "@/lib/types";

const WEEKS = 20;

function dayCount(p: Progress, d: string) {
  const a = p.activity[d];
  return a ? a.lessons + a.reviews : 0;
}

export function ProgressView({ catalog, titles }: { catalog: Catalog; titles: Record<string, string> }) {
  const p = useProgress();
  const hydrated = useHydrated();
  const s = streak(p);
  const t = today();

  const completed = Object.entries(p.lessons)
    .filter(([k, r]) => r.status === "completed" && titles[k])
    .sort((a, b) => (b[1].completed ?? "").localeCompare(a[1].completed ?? ""));
  const totalLessons = catalog.topics.reduce((n, tp) => n + tp.courses.reduce((m, c) => m + c.lessons.length, 0), 0);
  const answered = Object.values(p.steps).filter((x) => x.firstTry !== null);
  const firstTry = answered.length ? Math.round((answered.filter((x) => x.firstTry).length / answered.length) * 100) : null;

  // Heatmap: WEEKS columns of Monday–Sunday, ending this week.
  const start = addDays(weekStart(t), -7 * (WEEKS - 1));
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(start, i));
  const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4);

  // Lessons completed per week, last 8 weeks.
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(weekStart(t), -7 * (7 - i)));
  const perWeek = weeks.map((w) => ({
    w,
    n: Array.from({ length: 7 }, (_, i) => p.activity[addDays(w, i)]?.lessons ?? 0).reduce((a, b) => a + b, 0),
  }));
  const max = Math.max(1, ...perWeek.map((x) => x.n));

  return (
    <>
      <PageHead title="Progress" />

      <div className="stats">
        <div className="card card--pad">
          <StreakIcon className="stat__icon" aria-hidden />
          <div className="stat__value">{hydrated ? s.current : "–"}</div>
          <div className="stat__label">day streak{s.current && !s.today ? " — study today to keep it" : ""}</div>
        </div>
        <div className="card card--pad">
          <CalendarIcon className="stat__icon" aria-hidden />
          <div className="stat__value">{hydrated ? s.longest : "–"}</div>
          <div className="stat__label">longest streak</div>
        </div>
        <div className="card card--pad">
          <DoneIcon className="stat__icon" aria-hidden />
          <div className="stat__value">
            {completed.length}
            <span className="muted" style={{ fontSize: "1rem", fontWeight: 600 }}>
              {" "}
              / {totalLessons}
            </span>
          </div>
          <div className="stat__label">lessons completed</div>
        </div>
        <div className="card card--pad">
          <TrophyIcon className="stat__icon" aria-hidden />
          <div className="stat__value">{firstTry === null ? "–" : `${firstTry}%`}</div>
          <div className="stat__label">exercises right first time</div>
        </div>
      </div>

      <section>
        <div className="section-head">
          <h2 className="section-title">Activity</h2>
          <span className="legend" aria-hidden>
            Less
            {[0, 1, 2, 3, 4].map((l) => (
              <span key={l} className="sw" style={{ background: `var(--scale-${l})` }} />
            ))}
            More
          </span>
        </div>
        <div className="card card--pad">
          <div className="heatmap" role="img" aria-label={`Lessons and review sessions per day over the last ${WEEKS} weeks`}>
            {days.map((d) => {
              const n = dayCount(p, d);
              return d > t ? (
                <span key={d} className="is-future" />
              ) : (
                <span key={d} data-l={level(n)} title={`${formatDay(d)}: ${plural(n, "session")}`} />
              );
            })}
          </div>
          <p className="caption" style={{ marginTop: 8 }}>
            Each square is a day: lessons and review sessions finished. Weeks start on Monday.
          </p>
        </div>
      </section>

      <section>
        <h2 className="section-title">Lessons per week</h2>
        <div className="card card--pad">
          <div className="week-bars" role="img" aria-label="Lessons completed in each of the last 8 weeks">
            {perWeek.map(({ w, n }) => (
              <div className="week-bars__col" key={w}>
                <span className="week-bars__n">{n || ""}</span>
                <span className={`week-bars__bar${n ? "" : " is-zero"}`} style={{ blockSize: `${(n / max) * 80}%` }} />
                <span className="week-bars__label">{parseKey(w).getDate()}/{parseKey(w).getMonth() + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title">Completed</h2>
        {completed.length ? (
          <ul className="list">
            {completed.slice(0, 30).map(([k, r]) => {
              const [courseId, lessonId] = k.split("/");
              return (
                <li key={k}>
                  <Link href={`/lesson/${courseId}/${lessonId}/`} className="list-row">
                    <span className="list-row__body">
                      <span className="list-row__title" style={{ display: "block", fontWeight: 500 }}>
                        {titles[k]}
                      </span>
                      <span className="list-row__meta" style={{ display: "block" }}>
                        {r.completed && formatDay(r.completed.slice(0, 10))}
                        {r.firstTryShare !== undefined && ` · ${Math.round(r.firstTryShare * 100)}% right first time`}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="card empty">
            <p className="empty__title">No lessons finished yet</p>
            <p>Your completed lessons will be listed here.</p>
          </div>
        )}
      </section>
    </>
  );
}
