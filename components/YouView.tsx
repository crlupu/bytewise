"use client";

import Link from "next/link";
import { ChevronIcon, ProgressIcon, SettingsIcon, SkillsIcon } from "@/components/icons";
import { RankCard } from "@/components/SkillsView";
import { PageHead } from "@/components/ui";
import { streak, useHydrated, useProgress } from "@/lib/progress";
import type { SkillIndex } from "@/lib/skills";

/**
 * You: the rank card, three numbers at a glance, and the way into the
 * skill tree, the activity history and settings.
 */
export function YouView({ index }: { index: SkillIndex }) {
  const p = useProgress();
  const hydrated = useHydrated();
  const s = streak(p);
  const done = Object.values(p.lessons).filter((r) => r.status === "completed").length;
  const tried = Object.values(p.steps).filter((r) => r.firstTry !== null);
  const firstTry = tried.length ? Math.round((tried.filter((r) => r.firstTry).length / tried.length) * 100) : null;
  const show = (v: string | number) => (hydrated ? v : "–");

  const rows = [
    { href: "/skills/", icon: SkillsIcon, title: "Skill tree", meta: "Mastery, quests and bosses for every skill" },
    { href: "/progress/", icon: ProgressIcon, title: "Activity", meta: "Your streak, history and lessons per week" },
    { href: "/settings/", icon: SettingsIcon, title: "Settings", meta: "Appearance, motion, backing up progress" },
  ];

  return (
    <>
      <PageHead title="You" />
      <RankCard index={index} />

      <div className="you-stats">
        <div className="card card--pad you-stat">
          <span className="you-stat__value figure">{show(s.current)}</span>
          <span className="you-stat__label">day streak</span>
        </div>
        <div className="card card--pad you-stat">
          <span className="you-stat__value figure">{show(done)}</span>
          <span className="you-stat__label">lessons done</span>
        </div>
        <div className="card card--pad you-stat">
          <span className="you-stat__value figure">{show(firstTry === null ? "–" : `${firstTry}%`)}</span>
          <span className="you-stat__label">right first try</span>
        </div>
      </div>

      <ul className="list">
        {rows.map((r) => (
          <li key={r.href}>
            <Link href={r.href} className="list-row list-row--icon">
              <r.icon className="sources__icon" aria-hidden />
              <span className="list-row__body">
                <span className="list-row__title">{r.title}</span>
                <span className="list-row__meta" style={{ display: "block" }}>
                  {r.meta}
                </span>
              </span>
              <ChevronIcon className="chevron" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
