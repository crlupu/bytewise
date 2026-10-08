"use client";

import Link from "next/link";
import { BossIcon, CheckIcon, ChevronIcon, DoneIcon, LockIcon, PlayIcon, TodoIcon } from "@/components/icons";
import { Meter, PageHead, plural } from "@/components/ui";
import { dueItems, useHydrated, useProgress } from "@/lib/progress";
import { lessonStatus } from "@/lib/status";
import {
  BRANCHES,
  FACETS,
  LEVELS,
  RANKS,
  SKILLS,
  bossNeeds,
  dailyQuests,
  learned,
  mastery,
  playerLevel,
  rankOf,
  requirements,
  skillLevel,
  totalXp,
  weekDays,
  type SkillIndex,
} from "@/lib/skills";
import type { Catalog, LessonMeta } from "@/lib/types";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * The skill tree: who the learner is as an engineer, worked out from what
 * they've learned and still remember. Rank and level up top, the day's
 * quests, then every skill with its mastery and its boss, and engineering
 * judgment underneath, drawing on all of them.
 */
export function SkillsView({ catalog, index }: { catalog: Catalog; index: SkillIndex }) {
  const p = useProgress();
  const hydrated = useHydrated();

  const metas = new Map<string, LessonMeta>(catalog.topics.flatMap((t) => t.courses.flatMap((c) => c.lessons.map((l) => [l.key, l] as const))));
  const known = new Set([...metas.values()].flatMap((l) => l.exercises));
  const due = dueItems(p, known).length;

  const mast = Object.fromEntries(SKILLS.map((s) => [s.id, mastery(index.exercises[s.id], p)]));
  const facets = FACETS.map((f) => ({ ...f, score: mastery(index.facets[f.id], p) }));
  const judgment = Math.round(facets.reduce((n, f) => n + f.score, 0) / facets.length);
  const bosses = SKILLS.filter((s) => p.bosses[s.id]?.defeated).length;
  const standing = { skills: mast, judgment, bosses };
  const rank = rankOf(standing);
  const next = RANKS[rank + 1];
  const xp = totalXp(p);
  const lvl = playerLevel(xp);
  const quests = dailyQuests(p, index, due, mast);
  const week = weekDays(p);
  const weekMax = Math.max(1, ...week.map((d) => d.n));

  const nextLesson = (skillId: string) =>
    index.lessons[skillId].map((k) => metas.get(k)!).find((l) => l && p.lessons[l.key]?.status !== "completed" && lessonStatus(l, p) !== "locked");

  // The weakest skill under way — or the first not yet started — is where to go next.
  const started = SKILLS.filter((s) => learned(index.exercises[s.id], p) > 0);
  const focus = [...started].sort((a, b) => mast[a.id] - mast[b.id]).find((s) => nextLesson(s.id)) ?? SKILLS.find((s) => nextLesson(s.id));
  const rec = focus && nextLesson(focus.id);

  return (
    <>
      <PageHead title="Skills" subtitle="Your engineering skill tree" />

      <section className="card card--pad sk-hero" aria-label="Rank and level">
        <div className="sk-hero__top">
          <span className="sk-level figure" aria-label={`Level ${lvl.level}`}>
            <span className="sk-level__label">Level</span>
            {hydrated ? lvl.level : "–"}
          </span>
          <div className="sk-hero__text">
            <p className="sk-eyebrow">Rank {rank + 1} of {RANKS.length}</p>
            <h2 className="sk-hero__rank">{RANKS[rank].title}</h2>
            <div className="sk-xp">
              <Meter value={(lvl.into / lvl.span) * 100} label="XP to next level" />
              <span className="figure">
                {xp.toLocaleString()} XP · {(lvl.span - lvl.into).toLocaleString()} to level {lvl.level + 1}
              </span>
            </div>
          </div>
        </div>
        {next && (
          <div className="sk-next">
            <p className="sk-eyebrow">Next rank: {next.title}</p>
            <ul className="sk-reqs">
              {requirements(next.req, standing).map((r) => (
                <li key={r.text} className={r.met ? "is-met" : undefined}>
                  {r.met ? <CheckIcon aria-label="Met" /> : <TodoIcon aria-label="Not yet" />}
                  {r.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="sk-week" role="img" aria-label="Activity this week, Monday to Sunday">
          {week.map((d, i) => (
            <span key={d.day} className="sk-week__day">
              <span className="sk-week__bar">
                <span style={{ blockSize: `${(d.n / weekMax) * 100}%` }} className={d.n ? undefined : "is-zero"} />
              </span>
              <span className="sk-week__label">{DAYS[i]}</span>
            </span>
          ))}
        </div>
      </section>

      <section aria-label="Today's quests">
        <h2 className="section-title">Today&apos;s quests</h2>
        <ul className="list">
          {quests.map((q) => (
            <li key={q.id}>
              <Link href={q.href} className={`list-row sk-quest${q.done ? " is-done" : ""}`}>
                {q.done ? <DoneIcon className="sk-quest__mark" aria-label="Done" /> : <TodoIcon className="sk-quest__mark" aria-label="To do" />}
                <span className="list-row__body">
                  <span className="list-row__title" style={{ display: "block" }}>
                    {q.title}
                  </span>
                  <span className="list-row__meta" style={{ display: "block" }}>
                    {q.detail}
                  </span>
                </span>
                <ChevronIcon className="chevron" aria-hidden />
              </Link>
            </li>
          ))}
          {rec && focus && (
            <li>
              <Link href={`/lesson/${rec.courseId}/${rec.id}/`} className="list-row sk-quest">
                <PlayIcon className="sk-quest__mark sk-quest__mark--play" aria-hidden />
                <span className="list-row__body">
                  <span className="list-row__title" style={{ display: "block" }}>
                    {rec.title}
                  </span>
                  <span className="list-row__meta" style={{ display: "block" }}>
                    Recommended · {started.includes(focus) ? `${focus.title} is your weakest skill` : `Start ${focus.title}`}
                  </span>
                </span>
                <ChevronIcon className="chevron" aria-hidden />
              </Link>
            </li>
          )}
        </ul>
      </section>

      {BRANCHES.map((b) => (
        <section key={b.id} aria-label={b.title}>
          <h2 className="section-title">{b.title}</h2>
          <div className="sk-grid">
            {SKILLS.filter((s) => s.branch === b.id).map((s) => {
              const total = index.exercises[s.id].length;
              const got = learned(index.exercises[s.id], p);
              const m = mast[s.id];
              const lv = skillLevel(m);
              const need = bossNeeds(total);
              const boss = p.bosses[s.id];
              const nl = nextLesson(s.id);
              return (
                <article key={s.id} id={s.id} className="card card--pad sk-skill">
                  <header className="sk-skill__head">
                    <h3 className="sk-skill__title">{s.title}</h3>
                    <span className="sk-badge figure">Lv {lv}</span>
                  </header>
                  <p className="sk-skill__level">{LEVELS[lv]}</p>
                  <Meter value={m} label={`${s.title} mastery`} />
                  <p className="sk-skill__figures figure">
                    {m}% mastery · {got}/{total} learned
                  </p>
                  {nl && (
                    <Link href={`/lesson/${nl.courseId}/${nl.id}/`} className="sk-skill__next">
                      <span>
                        <span className="sk-eyebrow">{got ? "Next" : "Start"}</span>
                        {nl.title}
                      </span>
                      <ChevronIcon className="chevron" aria-hidden />
                    </Link>
                  )}
                  {boss?.defeated ? (
                    <Link href={`/boss/${s.id}/`} className="sk-boss is-defeated">
                      <DoneIcon aria-hidden />
                      <span>
                        {s.boss.name} <span className="muted">defeated</span>
                      </span>
                    </Link>
                  ) : got >= need ? (
                    <Link href={`/boss/${s.id}/`} className="sk-boss is-ready">
                      <BossIcon aria-hidden />
                      <span>Fight {s.boss.name}</span>
                    </Link>
                  ) : (
                    <p className="sk-boss is-locked">
                      <LockIcon aria-hidden />
                      <span>
                        Boss: learn {plural(need - got, "more exercise")}
                      </span>
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <section aria-label="Engineering judgment">
        <h2 className="section-title">Engineering judgment</h2>
        <div className="card card--pad sk-judgment">
          <div className="sk-judgment__head">
            <span className="sk-judgment__score figure">{judgment}</span>
            <p className="muted">
              Drawn from every skill: the exercises that ask you to weigh trade-offs, find bugs, reason about
              performance, shape designs and anticipate failure.
            </p>
          </div>
          <ul className="sk-facets">
            {facets.map((f) => (
              <li key={f.id}>
                <span className="sk-facets__name">{f.title}</span>
                <Meter value={f.score} label={`${f.title}`} />
                <span className="figure sk-facets__n">{f.score}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="caption">
        Mastery counts what you remember, not what you&apos;ve finished: an answered exercise counts a quarter, and the rest
        comes as it survives reviews further and further apart. XP is earned once per exercise, lesson and boss, so
        there&apos;s nothing to grind.
      </p>
    </>
  );
}
