"use client";

import Link from "next/link";
import { ChevronIcon, PlayIcon } from "@/components/icons";
import { booksOf } from "@/components/Books";
import { Meter, PageHead, plural } from "@/components/ui";
import { longDate } from "@/lib/dates";
import { dueItems, progress, streak, useHydrated, useProgress } from "@/lib/progress";
import { continueTarget, lessonSteps } from "@/lib/status";
import type { Catalog } from "@/lib/types";

const SPARK = "M32 21c1.2 7.3 3.7 9.8 11 11-7.3 1.2-9.8 3.7-11 11-1.2-7.3-3.7-9.8-11-11 7.3-1.2 9.8-3.7 11-11Z";

function Spark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <path d={SPARK} fill="currentColor" transform="translate(32 32) scale(2.6) translate(-32 -32)" />
    </svg>
  );
}

const SMALL = new Set(["in", "of", "the", "and", "a", "for", "to"]);
/** Two letters for a book's mark: initials, or the first two letters of a one-word title. */
function monogram(title: string) {
  const words = title.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w && !SMALL.has(w.toLowerCase()));
  return words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : (words[0] ?? "").slice(0, 2).replace(/^./, (c) => c.toUpperCase());
}

/**
 * Home is a bento grid: what to do next as the big tile, then the streak,
 * the review queue and accuracy at a glance. Below it, the library: one
 * card per book (or topic), each opening the list of its courses.
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
          <span className="tile__big figure">
            {s.current}
            <Spark size={18} />
          </span>
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

      <section aria-label="Books">
        <h2 className="section-title">Library</h2>
        <ul className="shelf">
          {catalog.topics.map((t) => {
            const lessons = t.courses.flatMap((c) => c.lessons);
            const done = lessons.filter((l) => p.lessons[l.key]?.completed).length;
            const used = booksOf(lessons.map((l) => l.sources), catalog.books);
            const by =
              used.length === 1
                ? used[0].authors.split(/,|&/)[0].trim() + (/[,&]/.test(used[0].authors) ? " et al." : "")
                : used.length
                  ? plural(used.length, "book")
                  : t.summary;
            return (
              <li key={t.id}>
                <Link href={`/topic/${t.id}/`} className="book">
                  <span className="book__mark" aria-hidden>
                    {monogram(t.title)}
                  </span>
                  <span className="book__title">{t.title}</span>
                  <span className="book__by">{by}</span>
                  <span className="book__foot">
                    <Meter value={lessons.length ? (done / lessons.length) * 100 : 0} label={`${t.title} progress`} />
                    <span className="figure">
                      {done}/{lessons.length}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
