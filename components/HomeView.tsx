"use client";

import Link from "next/link";
import { ChevronIcon, PlayIcon, ReviewIcon, StreakIcon } from "@/components/icons";
import { Meter, PageHead, Ring, plural } from "@/components/ui";
import { longDate } from "@/lib/dates";
import { dueItems, progress, streak, useHydrated, useProgress } from "@/lib/progress";
import { continueTarget, courseProgress, lessonSteps } from "@/lib/status";
import type { Catalog } from "@/lib/types";

const TOPIC_COLORS = ["var(--data-indigo)", "var(--data-teal)", "var(--data-orange)", "var(--data-magenta)", "var(--data-green)", "var(--data-slate)"];

export function HomeView({ catalog }: { catalog: Catalog }) {
  const p = useProgress();
  const hydrated = useHydrated();
  const known = new Set(catalog.topics.flatMap((t) => t.courses.flatMap((c) => c.lessons.flatMap((l) => l.exercises))));
  const due = dueItems(p, known).length;
  const s = streak(p);
  const target = continueTarget(catalog, p);
  const course = target && catalog.topics.flatMap((t) => t.courses).find((c) => c.id === target.lesson.courseId);
  const steps = target ? lessonSteps(target.lesson, p) : null;

  return (
    <>
      <PageHead title="Learn" subtitle={hydrated ? longDate() : " "} />

      <div className="home-top">
        {target && course && steps && (
          <div className="card card--pad hero">
            <div>
              <p className="hero__eyebrow">{target.fresh ? (p.last ? "Up next" : "Start here") : "Continue"} · {course.title}</p>
              <h2 className="hero__title">{target.lesson.title}</h2>
              <p className="muted" style={{ fontSize: "0.9375rem", marginTop: 4 }}>
                {target.lesson.summary}
              </p>
            </div>
            <div className="hero__meta">
              {target.fresh ? (
                <span>
                  {target.lesson.duration} min · {plural(target.lesson.steps, "step")}
                </span>
              ) : (
                <>
                  <Meter value={(steps.done / steps.total) * 100} label="Lesson progress" />
                  <span className="figure">
                    {steps.done} / {steps.total}
                  </span>
                </>
              )}
            </div>
            <div>
              <Link
                href={`/lesson/${target.lesson.courseId}/${target.lesson.id}/`}
                className="btn btn--primary"
                onClick={() => {
                  if (!target.fresh) progress.setPosition(target.lesson.key, target.step);
                }}
              >
                <PlayIcon aria-hidden />
                {target.fresh ? "Start lesson" : "Continue"}
              </Link>
            </div>
          </div>
        )}

        <div className="card card--pad mini-stats">
          <Link href="/review/" className="mini-stat">
            <span className={`mini-stat__icon${due ? " mini-stat__icon--warn" : ""}`}>
              <ReviewIcon aria-hidden />
            </span>
            <span style={{ flex: 1 }}>
              <span className="mini-stat__value" style={{ display: "block" }}>
                {due}
              </span>
              <span className="mini-stat__label">{due ? `review item${due === 1 ? "" : "s"} due` : "Nothing due for review"}</span>
            </span>
            <ChevronIcon className="chevron" aria-hidden />
          </Link>
          <Link href="/progress/" className="mini-stat">
            <span className="mini-stat__icon">
              <StreakIcon aria-hidden />
            </span>
            <span style={{ flex: 1 }}>
              <span className="mini-stat__value" style={{ display: "block" }}>
                {s.current} {s.current === 1 ? "day" : "days"}
              </span>
              <span className="mini-stat__label">{s.today ? "Streak — today's done" : s.current ? "Streak — keep it going today" : "Streak — finish a lesson to start one"}</span>
            </span>
            <ChevronIcon className="chevron" aria-hidden />
          </Link>
        </div>
      </div>

      <section aria-label="Topics">
        {catalog.topics.map((t, ti) => (
          <div className="topic" key={t.id}>
            <div className="topic__head">
              <span className="dot" style={{ background: TOPIC_COLORS[ti % TOPIC_COLORS.length] }} aria-hidden />
              <h2 className="section-title" style={{ margin: 0 }}>
                {t.title}
              </h2>
            </div>
            <p className="topic__summary">{t.summary}</p>
            <ul className="list">
              {t.courses.map((c) => {
                const cp = courseProgress(c, p);
                return (
                  <li key={c.id}>
                    <Link href={`/course/${c.id}/`} className="list-row">
                      <span className="course-row__ring">
                        <Ring pct={cp.pct} size={40} label={`${cp.done} of ${cp.total} lessons complete`} />
                      </span>
                      <span className="list-row__body">
                        <span className="list-row__title" style={{ display: "block" }}>
                          {c.title}
                        </span>
                        <span className="list-row__sub" style={{ display: "block" }}>
                          {c.summary}
                        </span>
                        <span className="list-row__meta" style={{ display: "block" }}>
                          {cp.done} of {plural(cp.total, "lesson")} complete
                        </span>
                      </span>
                      <ChevronIcon className="chevron" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}
