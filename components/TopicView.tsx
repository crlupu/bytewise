"use client";

import Link from "next/link";
import { CheckIcon, ReadIcon } from "@/components/icons";
import { booksOf } from "@/components/Books";
import { Meter, PageHead, plural } from "@/components/ui";
import { useProgress } from "@/lib/progress";
import { courseProgress } from "@/lib/status";
import type { Book, TopicMeta } from "@/lib/types";

/** A topic (usually one book): its courses as rows with thin progress bars. */
export function TopicView({ topic, books }: { topic: TopicMeta; books: Record<string, Book> }) {
  const p = useProgress();
  const used = booksOf(topic.courses.flatMap((c) => c.lessons.map((l) => l.sources)), books);
  const lessons = topic.courses.reduce((n, c) => n + c.lessons.length, 0);
  return (
    <>
      <PageHead title={topic.title} subtitle={`${plural(topic.courses.length, "course")}, ${plural(lessons, "lesson")}`} back={{ href: "/learn/", label: "Learn" }} lede={topic.summary} />
      {used.length > 0 && (
        <div className="course-books" aria-label="Drawn from">
          {used.map((b) => (
            <span key={b.id} className="pill">
              <ReadIcon aria-hidden style={{ color: "var(--accent)" }} />
              <i>{b.title}</i>&nbsp;· {b.authors.split(/,|&/)[0].trim()}
              {/[,&]/.test(b.authors) ? " et al." : ""}
            </span>
          ))}
        </div>
      )}
      <section aria-label="Courses" className="topic-courses">
        <ul className="rows">
          {topic.courses.map((c) => {
            const cp = courseProgress(c, p);
            const done = cp.total > 0 && cp.done === cp.total;
            return (
              <li key={c.id}>
                <Link href={`/course/${c.id}/`} className={`row${done ? " is-done" : ""}`}>
                  <span className="row__head">
                    <span className="row__title">{c.title}</span>
                    {done ? (
                      <span className="row__count row__count--done">
                        <CheckIcon aria-hidden />
                        Done
                      </span>
                    ) : (
                      <span className="row__count figure">
                        {cp.done} of {plural(cp.total, "lesson")}
                      </span>
                    )}
                  </span>
                  <span className="row__sub">{c.summary}</span>
                  <Meter value={cp.pct} label={`${c.title} progress`} />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
