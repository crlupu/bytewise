"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useMemo } from "react";
import { LearnIcon, ProgressIcon, ReviewIcon, SettingsIcon, SkillsIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { dueItems, useProgress } from "@/lib/progress";

const TABS = [
  { href: "/", label: "Skills", icon: SkillsIcon },
  { href: "/learn/", label: "Learn", icon: LearnIcon },
  { href: "/review/", label: "Review", icon: ReviewIcon },
  { href: "/progress/", label: "Progress", icon: ProgressIcon },
  { href: "/settings/", label: "Settings", icon: SettingsIcon },
];

function isActive(path: string, href: string) {
  const p = path.endsWith("/") ? path : `${path}/`;
  if (href === "/") return p === "/";
  if (href === "/learn/") return ["/learn/", "/course/", "/topic/", "/search/"].some((x) => p.startsWith(x));
  return p.startsWith(href);
}

/**
 * Phones and tablets get a tab bar along the bottom; desktops a sidebar.
 * The Review tab carries a badge with the number of items due.
 */
export function Shell({ exerciseKeys, children }: { exerciseKeys: string[]; children: ReactNode }) {
  const path = usePathname();
  const p = useProgress();
  const known = useMemo(() => new Set(exerciseKeys), [exerciseKeys]);
  const due = dueItems(p, known).length;

  return (
    <>
      <aside className="sidebar bar-material" aria-label="Sections">
        <div className="sidebar__brand">
          <Logo size={26} />
          Bytewise
        </div>
        <nav className="sidebar__nav">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className={`side-link${isActive(path, t.href) ? " is-active" : ""}`}>
              <t.icon aria-hidden />
              {t.label}
              {t.href === "/review/" && due > 0 && (
                <span className="side-link__badge figure" aria-label={`${due} due`}>
                  {due}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="app-main">
        <div className="app-content">{children}</div>
      </main>
      <nav className="tabbar bar-material" aria-label="Sections">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`tabbar__tab${isActive(path, t.href) ? " is-active" : ""}`}
            aria-current={isActive(path, t.href) ? "page" : undefined}
          >
            <t.icon aria-hidden />
            {t.label}
            {t.href === "/review/" && due > 0 && (
              <span className="tabbar__badge figure" aria-label={`${due} due`}>
                {due}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </>
  );
}
