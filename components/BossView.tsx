"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BossIcon, CloseIcon, DoneIcon, HeartEmptyIcon, HeartIcon, LockIcon, PlayIcon, ReadIcon } from "@/components/icons";
import { StepView } from "@/components/steps/StepView";
import { plural } from "@/components/ui";
import { progress, useHydrated, useProgress } from "@/lib/progress";
import { BOSS, SKILLS, XP, bossNeeds } from "@/lib/skills";
import type { ExerciseStep } from "@/lib/types";

type Phase = "intro" | "fight" | "won" | "lost";

const lessonOf = (key: string) => key.split("/").slice(0, 2).join("/");

/**
 * A boss: questions from across a skill, one per lesson where possible so
 * the battle mixes everything the skill covers. No hints, and three lives —
 * a wrong first answer costs one. A loss shows what to revisit; the boss
 * can be fought again at once. Battles don't move the review ladder, so
 * fighting one repeatedly can't inflate mastery.
 */
export function BossView({ skillId, steps, titles }: { skillId: string; steps: Record<string, ExerciseStep>; titles: Record<string, string> }) {
  const skill = SKILLS.find((s) => s.id === skillId)!;
  const hydrated = useHydrated();
  const p = useProgress();
  const [phase, setPhase] = useState<Phase>("intro");
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [lives, setLives] = useState(BOSS.lives);
  const [missed, setMissed] = useState<string[]>([]);

  useEffect(() => {
    document.title = `${skill.boss.name} · Bytewise`;
  }, [skill]);

  const all = Object.keys(steps);
  const known = all.filter((k) => p.steps[k]?.completed);
  const need = bossNeeds(all.length);
  const record = p.bosses[skillId];

  const start = () => {
    // One question per lesson, lessons in random order, then round again if short.
    const byLesson = new Map<string, string[]>();
    for (const k of known) byLesson.set(lessonOf(k), [...(byLesson.get(lessonOf(k)) ?? []), k]);
    const groups = [...byLesson.values()].map((g) => shuffle(g));
    shuffle(groups);
    const picked: string[] = [];
    for (let round = 0; picked.length < BOSS.rounds && groups.some((g) => g.length > round); round++)
      for (const g of groups) if (g[round] && picked.length < BOSS.rounds) picked.push(g[round]);
    setQueue(picked);
    setIndex(0);
    setLives(BOSS.lives);
    setMissed([]);
    setPhase("fight");
  };

  const end = (won: boolean, left: number) => {
    progress.bossResult(skillId, won, left);
    setPhase(won ? "won" : "lost");
    window.scrollTo({ top: 0 });
  };

  const close = (
    <Link href={`/skills/#${skillId}`} className="icon-btn" aria-label="Leave">
      <CloseIcon aria-hidden />
    </Link>
  );

  if (phase === "fight") {
    const key = queue[index];
    const step = steps[key];
    return (
      <div className="player">
        <header className="player__top bar-material">
          <div className="player__top-inner">
            {close}
            <div className="player__progress">
              <div className="segments" aria-hidden>
                {queue.map((k, i) => (
                  <span key={k} className={i < index ? "is-done" : i === index ? "is-current" : ""} />
                ))}
              </div>
              <span className="boss-lives" aria-label={`${plural(lives, "life", "lives")} left`}>
                {Array.from({ length: BOSS.lives }, (_, i) => (i < lives ? <HeartIcon key={i} aria-hidden /> : <HeartEmptyIcon key={i} aria-hidden className="is-lost" />))}
              </span>
            </div>
          </div>
        </header>
        <StepView
          key={`${key}-${index}`}
          step={step}
          noHints
          onAttempt={(correct, _h, first) => {
            if (!first || correct) return;
            setMissed((m) => [...m, key]);
            const left = lives - 1;
            setLives(left);
            if (left === 0) end(false, 0);
          }}
          onContinue={() => {
            if (index + 1 >= queue.length) end(true, lives);
            else {
              setIndex(index + 1);
              window.scrollTo({ top: 0 });
            }
          }}
          continueLabel={index === queue.length - 1 ? "Final blow" : undefined}
        />
      </div>
    );
  }

  const revisit = [...new Set(missed.map(lessonOf))];

  return (
    <div className="player">
      <header className="player__top bar-material">
        <div className="player__top-inner">{close}</div>
      </header>
      <div className="player__body">
        <div className="boss">
          <span className={`boss__emblem${phase === "won" || record?.defeated ? " is-defeated" : ""}`}>
            {phase === "won" ? <DoneIcon aria-hidden /> : <BossIcon aria-hidden />}
          </span>
          <p className="page-subtitle">
            {skill.title} boss{phase === "won" ? " · defeated" : phase === "lost" ? " · you were defeated" : ""}
          </p>
          <h1 className="step__title" style={{ marginBottom: 0 }}>
            {skill.boss.name}
          </h1>

          {phase === "intro" && (
            <>
              <p className="boss__blurb">{skill.boss.blurb}</p>
              <ul className="boss__rules">
                <li>{BOSS.rounds} questions drawn from across {skill.title}, mixed together</li>
                <li>No hints</li>
                <li>{BOSS.lives} lives: a wrong first answer costs one</li>
                <li>+{XP.boss} XP the first time you win</li>
              </ul>
              {record && (
                <p className="caption">
                  {plural(record.attempts, "attempt")}
                  {record.defeated ? ` · best win with ${plural(record.best, "life", "lives")} left` : ""}
                </p>
              )}
            </>
          )}

          {phase === "won" && (
            <p className="boss__blurb">
              Won with {plural(lives, "life", "lives")} left.
              {missed.length ? " The questions you missed are worth another look:" : " Not a single miss."}
            </p>
          )}
          {phase === "lost" && <p className="boss__blurb">Out of lives. Every miss points at something to revisit — then try again.</p>}

          {(phase === "won" || phase === "lost") && revisit.length > 0 && (
            <ul className="list boss__revisit">
              {revisit.map((lk) => {
                const [c, l] = lk.split("/");
                return (
                  <li key={lk}>
                    <Link href={`/lesson/${c}/${l}/`} className="list-row">
                      <ReadIcon className="muted" aria-hidden style={{ width: 20, height: 20 }} />
                      <span className="list-row__body">{titles[lk] ?? lk}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <footer className="player__foot bar-material">
        <div className="player__foot-inner">
          <div className="player__actions">
            {!hydrated ? null : known.length < need ? (
              <p className="boss__locked">
                <LockIcon aria-hidden /> Learn {plural(need - known.length, "more exercise")} in {skill.title} to unlock this boss.
              </p>
            ) : phase === "won" ? (
              <Link href={`/skills/#${skillId}`} className="btn btn--primary">
                Back to skills
              </Link>
            ) : (
              <button type="button" className="btn btn--primary" onClick={start} autoFocus>
                <PlayIcon aria-hidden />
                {phase === "lost" ? "Try again" : record?.defeated ? "Fight again" : "Fight"}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
