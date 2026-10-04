"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CloseIcon, DoneIcon, ReviewIcon, StreakIcon, TrophyIcon } from "@/components/icons";
import { StepView } from "@/components/steps/StepView";
import { dueItems, progress, streak, useHydrated, useProgress } from "@/lib/progress";
import type { ExerciseStep } from "@/lib/types";

const SESSION_SIZE = 20;

/**
 * A review session: due exercises from every course, shuffled together.
 * The first answer to each decides where it goes on the ladder; a wrong one
 * can still be retried until right, as in a lesson.
 */
export function SessionView({ steps, titles }: { steps: Record<string, ExerciseStep>; titles: Record<string, string> }) {
  const hydrated = useHydrated();
  const p = useProgress();
  const [queue, setQueue] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [firstRight, setFirstRight] = useState(0);

  useEffect(() => {
    if (!hydrated || queue) return;
    const due = dueItems(p, new Set(Object.keys(steps)));
    // Mixed order: a fresh shuffle each session.
    for (let i = due.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [due[i], due[j]] = [due[j], due[i]];
    }
    setQueue(due.slice(0, SESSION_SIZE));
  }, [hydrated, queue, p, steps]);

  useEffect(() => {
    document.title = "Review · Bytewise";
  }, []);

  if (!queue) return <div className="player" />;
  const total = queue.length;
  const done = index >= total;
  const key = queue[index];
  const step = key ? steps[key] : null;
  const lessonKey = key?.split("/").slice(0, 2).join("/");

  return (
    <div className="player">
      <header className="player__top bar-material">
        <div className="player__top-inner">
          <Link href="/review/" className="icon-btn" aria-label="End review">
            <CloseIcon aria-hidden />
          </Link>
          <div className="player__progress">
            <div className="segments" aria-hidden>
              {queue.map((k, i) => (
                <span key={k} className={i < index ? "is-done" : i === index ? "is-current" : ""} />
              ))}
            </div>
            <span className="player__count figure">{done ? "Done" : `${index + 1} / ${total}`}</span>
          </div>
        </div>
      </header>

      {total === 0 && (
        <div className="player__body">
          <div className="empty">
            <ReviewIcon className="empty__icon" aria-hidden />
            <p className="empty__title">Nothing to review</p>
            <p>
              <Link href="/" className="btn btn--primary" style={{ marginTop: 16 }}>
                Back to lessons
              </Link>
            </p>
          </div>
        </div>
      )}

      {step && (
        <>
          <StepView
            key={step.key}
            step={step}
            onAttempt={(correct, hintsBefore, first) => {
              if (!first) return;
              const good = correct && hintsBefore === 0;
              progress.reviewed(step.key, good);
              if (good) setFirstRight((n) => n + 1);
            }}
            onContinue={() => {
              if (index + 1 >= total) progress.completeReviewSession();
              setIndex(index + 1);
              window.scrollTo({ top: 0 });
            }}
            continueLabel={index === total - 1 ? "Finish review" : undefined}
          />
          <p className="sr-only">From {titles[lessonKey!]}</p>
        </>
      )}

      {done && total > 0 && (
        <>
          <div className="player__body">
            <div className="done">
              <span className="done__badge">
                <DoneIcon aria-hidden />
              </span>
              <div>
                <p className="page-subtitle">Review complete</p>
                <h1 className="step__title" style={{ marginBottom: 0 }}>
                  {total} reviewed
                </h1>
              </div>
              <div className="stats">
                <div className="card card--pad">
                  <TrophyIcon className="stat__icon" aria-hidden />
                  <div className="stat__value">{Math.round((firstRight / total) * 100)}%</div>
                  <div className="stat__label">right first time</div>
                </div>
                <div className="card card--pad">
                  <StreakIcon className="stat__icon" aria-hidden />
                  <div className="stat__value">{streak(p).current}</div>
                  <div className="stat__label">day streak</div>
                </div>
              </div>
              <p className="caption">Items you missed come back tomorrow; the rest move further out.</p>
            </div>
          </div>
          <footer className="player__foot bar-material">
            <div className="player__foot-inner">
              <div className="player__actions">
                <Link href="/" className="btn btn--primary">
                  Done
                </Link>
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
