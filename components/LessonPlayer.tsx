"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CloseIcon, DoneIcon, StreakIcon, TimeIcon, TrophyIcon } from "@/components/icons";
import { StepView } from "@/components/steps/StepView";
import { plural } from "@/components/ui";
import { progress, streak, useHydrated, useProgress } from "@/lib/progress";
import type { Book, Lesson, LessonMeta } from "@/lib/types";
import { SourceList } from "@/components/Books";

/**
 * A lesson, one step at a time. The bar along the top closes the lesson
 * and shows where you are; the position is saved on every move, so leaving
 * part-way and coming back resumes at the same step.
 */
export function LessonPlayer({
  lesson,
  courseTitle,
  next,
  books,
}: {
  lesson: Lesson;
  courseTitle: string;
  next: LessonMeta | null;
  books: Record<string, Book>;
}) {
  const hydrated = useHydrated();
  const p = useProgress();
  const [index, setIndex] = useState<number | null>(null);
  const [startedAt] = useState(() => Date.now());

  // Once progress is read: open at the saved step, or at the start.
  useEffect(() => {
    if (!hydrated || index !== null) return;
    const rec = p.lessons[lesson.key];
    const at = rec?.status === "in_progress" ? Math.min(rec.position, lesson.body.length - 1) : 0;
    progress.openLesson(lesson.key, at);
    setIndex(at);
  }, [hydrated, index, p.lessons, lesson]);

  useEffect(() => {
    document.title = `${lesson.title} · Bytewise`;
  }, [lesson.title]);

  const courseHref = `/course/${lesson.courseId}/`;
  const total = lesson.body.length;
  const finished = index !== null && index >= total;

  const go = (i: number) => {
    setIndex(i);
    if (i < total) progress.setPosition(lesson.key, i);
    window.scrollTo({ top: 0 });
  };

  const advance = () => {
    if (index === null) return;
    if (index + 1 >= total) {
      progress.completeLesson(lesson.key, lesson.exercises);
    }
    go(index + 1);
  };

  const step = index !== null && index < total ? lesson.body[index] : null;

  return (
    <div className="player">
      <header className="player__top bar-material">
        <div className="player__top-inner">
          <Link href={courseHref} className="icon-btn" aria-label={`Close lesson, back to ${courseTitle}`}>
            <CloseIcon aria-hidden />
          </Link>
          <div className="player__progress">
            <div className="segments" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(index ?? 0, total)} aria-label="Lesson progress">
              {lesson.body.map((s, i) => (
                <span
                  key={s.key}
                  className={p.steps[s.key]?.completed || (index !== null && i < index) ? "is-done" : i === index ? "is-current" : ""}
                />
              ))}
            </div>
            <span className="player__count figure">{index === null ? "" : finished ? "Done" : `${index + 1} / ${total}`}</span>
          </div>
        </div>
      </header>

      {step && (
        <StepView
          key={step.key}
          step={step}
          alreadyDone={!!p.steps[step.key]?.completed}
          onBack={index! > 0 ? () => go(index! - 1) : undefined}
          onHint={() => progress.hint(step.key)}
          onAttempt={(correct, hintsBefore) => progress.attempt(step.key, correct, hintsBefore)}
          onContinue={() => {
            if (step.type === "explanation") progress.completeStep(step.key);
            advance();
          }}
          continueLabel={index === total - 1 ? "Finish lesson" : undefined}
        />
      )}

      {finished && <Complete lesson={lesson} next={next} books={books} minutes={Math.max(1, Math.round((Date.now() - startedAt) / 60000))} />}
    </div>
  );
}

function Complete({ lesson, next, minutes, books }: { lesson: Lesson; next: LessonMeta | null; minutes: number; books: Record<string, Book> }) {
  const p = useProgress();
  const rec = p.lessons[lesson.key];
  const share = Math.round((rec?.firstTryShare ?? 0) * 100);
  const s = streak(p);
  return (
    <>
      <div className="player__body">
        <div className="done">
          <span className="done__badge">
            <DoneIcon aria-hidden />
          </span>
          <div>
            <p className="page-subtitle">Lesson complete</p>
            <h1 className="step__title" style={{ marginBottom: 0 }}>
              {lesson.title}
            </h1>
          </div>
          <div className="stats">
            <div className="card card--pad">
              <TrophyIcon className="stat__icon" aria-hidden />
              <div className="stat__value">{lesson.exercises.length ? `${share}%` : "–"}</div>
              <div className="stat__label">right first time</div>
            </div>
            <div className="card card--pad">
              <StreakIcon className="stat__icon" aria-hidden />
              <div className="stat__value">{s.current}</div>
              <div className="stat__label">day streak</div>
            </div>
            <div className="card card--pad">
              <TimeIcon className="stat__icon" aria-hidden />
              <div className="stat__value">{minutes}</div>
              <div className="stat__label">{minutes === 1 ? "minute" : "minutes"}</div>
            </div>
          </div>
          {lesson.exercises.length > 0 && (
            <p className="caption">
              {plural(lesson.exercises.length, "exercise")} added to your review queue.
            </p>
          )}
          <SourceList sources={lesson.sources} books={books} />
        </div>
      </div>
      <footer className="player__foot bar-material">
        <div className="player__foot-inner">
          <div className="player__actions">
            <Link href={`/course/${lesson.courseId}/`} className="btn btn--secondary">
              Back to course
            </Link>
            {next ? (
              <Link href={`/lesson/${next.courseId}/${next.id}/`} className="btn btn--primary">
                Next lesson
              </Link>
            ) : (
              <Link href="/learn/" className="btn btn--primary">
                Done
              </Link>
            )}
          </div>
        </div>
      </footer>
    </>
  );
}
