"use client";

import Link from "next/link";
import { ChevronIcon, LibraryIcon, PlayIcon, SearchIcon } from "@/components/icons";
import { TopicRow, topicProgress } from "@/components/Shelf";
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

/**
 * Today: what to do next as the big tile, the streak and the review queue
 * beside each other, then the books under way. The whole library lives in
 * its own tab.
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
  const lessonNo = course && target ? course.lessons.findIndex((l) => l.key === target.lesson.key) + 1 : 0;
  // Books under way, furthest along first.
  const going = catalog.topics
    .map((t) => ({ t, ...topicProgress(t, p) }))
    .filter((x) => x.started && x.done < x.total)
    .sort((a, b) => b.done / b.total - a.done / a.total)
    .slice(0, 3);

  return (
    <>
      <PageHead title="Today" subtitle={hydrated ? longDate() : " "}>
        <Link href="/search/" className="icon-btn icon-btn--tinted" aria-label="Search lessons">
          <SearchIcon aria-hidden />
        </Link>
      </PageHead>

      <div className="bento">
        {target && course && steps && (
          <Link
            href={`/lesson/${target.lesson.courseId}/${target.lesson.id}/`}
            className="tile tile--continue"
            onClick={() => {
              if (!target.fresh) progress.setPosition(target.lesson.key, target.step);
            }}
          >
            <span className="tile__eyebrow">
              {target.fresh ? (p.last ? "Up next" : "Start here") : "Continue"} · {course.title}
            </span>
            <span className="tile__title">{target.lesson.title}</span>
            {target.fresh ? (
              <span className="tile__meta">
                {target.lesson.duration} min · {plural(target.lesson.steps, "step")}
                {lessonNo > 0 && ` · lesson ${lessonNo} of ${course.lessons.length}`}
              </span>
            ) : (
              <span className="tile__meta tile__meta--bar">
                <Meter value={(steps.done / steps.total) * 100} label="Lesson progress" />
                <span className="figure">
                  {steps.done} of {steps.total}
                </span>
              </span>
            )}
            <span className="tile__cta">
              <PlayIcon aria-hidden />
              {target.fresh ? "Start lesson" : "Continue lesson"}
            </span>
          </Link>
        )}

        <Link href="/progress/" className="tile tile--streak">
          <span className="tile__big figure">
            {s.current}
            <Spark size={18} />
          </span>
          <span className="tile__label">day streak</span>
          <span className="tile__hint">{s.today ? "Done for today" : s.current ? "Keep it going today" : "Finish a lesson to start one"}</span>
        </Link>

        <Link href="/review/" className={`tile tile--review${due ? " has-due" : ""}`}>
          <span className="tile__big figure">{due}</span>
          <span className="tile__label">{due ? "due for review" : "nothing due"}</span>
          <span className="tile__hint">{due ? `About ${Math.max(1, Math.round(due / 2))} min` : "You're up to date"}</span>
        </Link>
      </div>

      <section aria-labelledby="keep-going">
        <h2 className="section-title" id="keep-going">
          Keep going
        </h2>
        <ul className="list">
          {going.map(({ t }) => (
            <TopicRow key={t.id} topic={t} catalog={catalog} p={p} />
          ))}
          <li>
            <Link href="/library/" className="list-row list-row--icon">
              <LibraryIcon className="sources__icon" aria-hidden />
              <span className="list-row__body">
                <span className="list-row__title">{going.length ? "All books" : "Browse the library"}</span>
                <span className="list-row__meta" style={{ display: "block" }}>
                  {plural(catalog.topics.length, "book")} and topics
                </span>
              </span>
              <ChevronIcon className="chevron" aria-hidden />
            </Link>
          </li>
        </ul>
      </section>
    </>
  );
}
