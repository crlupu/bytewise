"use client";

import Link from "next/link";
import { ChevronIcon, PlayIcon } from "@/components/icons";
import { Meter, PageHead, plural } from "@/components/ui";
import { longDate } from "@/lib/dates";
import { dueItems, progress, streak, useHydrated, useProgress } from "@/lib/progress";
import { continueTarget, courseProgress, lessonSteps } from "@/lib/status";
import type { Catalog } from "@/lib/types";

const SPARK = "M32 21c1.2 7.3 3.7 9.8 11 11-7.3 1.2-9.8 3.7-11 11-1.2-7.3-3.7-9.8-11-11 7.3-1.2 9.8-3.7 11-11Z";

function Spark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <path d={SPARK} fill="currentColor" transform="translate(32 32) scale(2.6) translate(-32 -32)" />
    </svg>
  );
}

/**
 * Home is a bento grid: what to do next as the big tile, then the streak,
 * the review queue and accuracy at a glance. Below it, every course as a
 * row with a thin progress bar.
 */
export function HomeView({ catalog }: { catalog: Catalog }) {
  const p = useProgress();
  const hydrated = useHydrated();
  const known = new Set(catalog.topics.flatMap((t) => t.courses.flatMap((c) => c.lessons.flatMap((l) => l.exercises))));
  const due = dueItems(p, known).length;
  const s = streak(p);
  const target = continueTarget(catalog, p);
  const course = target && catalog.topics.flatMap((t) => t.courses).find((c) => c.id === target.lesson.courseId);
  const steps = target ? lessonSteps(target.lesson, p) : null;
  // Accuracy: the share of answered exercises that were right first time, with no hints.
  const tried = Object.values(p.steps).filter((r) => r.firstTry !== null);
  const accuracy = tried.length ? Math.round((tried.filter((r) => r.firstTry).length / tried.length) * 100) : null;

  return (
    <>
      <PageHead title="Learn" subtitle={hydrated ? longDate() : " "} />

      <div className="bento">
        {target && course && steps && (
          <Link
            href={`/lesson/${target.lesson.courseId}/${target.lesson.id}/`}
            className="tile tile--continue"
            onClick={() => {
              if (!target.fresh) progress.setPosition(target.lesson.key, target.step);
            }}
          >
            <span className="tile__eyebrow">{target.fresh ? (p.last ? "Up next" : "Start here") : "Continue"}</span>
            <span className="tile__play" aria-hidden>
              <PlayIcon />
            </span>
            <span className="tile__title">{target.lesson.title}</span>
            <span className="tile__sub">{course.title}</span>
            {target.fresh ? (
              <span className="tile__meta">
                {target.lesson.duration} min, {plural(target.lesson.steps, "step")}
              </span>
            ) : (
              <span className="tile__meta tile__meta--bar">
                <Meter value={(steps.done / steps.total) * 100} label="Lesson progress" />
                <span className="figure">
                  {steps.done} of {steps.total}
                </span>
              </span>
            )}
            <span className="sr-only">{target.fresh ? "Start lesson" : "Continue lesson"}</span>
          </Link>
        )}

        <Link href="/progress/" className="tile tile--streak">
          <Spark size={18} />
          <span className="tile__big figure">{s.current}</span>
          <span className="tile__label">day streak</span>
          <span className="tile__hint">{s.today ? "Today's done" : s.current ? "Keep it going today" : "Finish a lesson to start one"}</span>
        </Link>

        <Link href="/review/" className={`tile tile--review${due ? " has-due" : ""}`}>
          <span className="tile__big figure">{due}</span>
          <span className="tile__label">{due ? "due for review" : "nothing due"}</span>
          <span className="tile__pill">{due ? "Start" : "Review"}</span>
        </Link>

        <Link href="/progress/" className="tile tile--accuracy">
          <span>
            {accuracy !== null && <span className="tile__big tile__big--sm figure">{accuracy}%</span>}
            <span className="tile__label">{accuracy === null ? "Answer a question to see how often you're right first time" : "right first time"}</span>
          </span>
          {accuracy !== null && (
            // Ten tiles, one per ten percent.
            <span className="tile-meter" role="img" aria-label={`${accuracy}% right first time`}>
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} className={i < Math.round(accuracy / 10) ? "is-on" : undefined} />
              ))}
            </span>
          )}
          <ChevronIcon className="chevron" aria-hidden />
        </Link>
      </div>

      <section aria-label="Topics">
        {catalog.topics.map((t) => (
          <div className="topic" key={t.id}>
            <h2 className="section-title">{t.title}</h2>
            <p className="topic__summary">{t.summary}</p>
            <ul className="rows">
              {t.courses.map((c) => {
                const cp = courseProgress(c, p);
                return (
                  <li key={c.id}>
                    <Link href={`/course/${c.id}/`} className="row">
                      <span className="row__head">
                        <span className="row__title">{c.title}</span>
                        <span className="row__count figure">
                          {cp.done} of {plural(cp.total, "lesson")}
                        </span>
                      </span>
                      <span className="row__sub">{c.summary}</span>
                      <Meter value={cp.pct} label={`${c.title} progress`} />
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
