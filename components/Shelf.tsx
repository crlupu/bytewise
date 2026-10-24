"use client";

import Link from "next/link";
import { ChevronIcon } from "@/components/icons";
import { booksOf } from "@/components/Books";
import { Meter, plural } from "@/components/ui";
import type { Progress } from "@/lib/progress";
import type { Catalog, TopicMeta as Topic } from "@/lib/types";

const SMALL = new Set(["in", "of", "the", "and", "a", "for", "to"]);
/** Two letters for a book's mark: initials, or the first two letters of a one-word title. */
export function monogram(title: string) {
  const words = title.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w && !SMALL.has(w.toLowerCase()));
  return words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : (words[0] ?? "").slice(0, 2).replace(/^./, (c) => c.toUpperCase());
}

/** How far through a topic the learner is. */
export function topicProgress(t: Topic, p: Progress) {
  const lessons = t.courses.flatMap((c) => c.lessons);
  const done = lessons.filter((l) => p.lessons[l.key]?.completed).length;
  const started = lessons.some((l) => p.lessons[l.key]);
  return { done, total: lessons.length, started };
}

/** The line under a topic's title: its author when it's built on one book. */
function byline(t: Topic, catalog: Catalog) {
  const lessons = t.courses.flatMap((c) => c.lessons);
  const used = booksOf(lessons.map((l) => l.sources), catalog.books);
  // A topic built on one book (others only cited in passing) shows that book's author.
  const main = used.find((b) => lessons.filter((l) => l.sources.some((s) => s.book === b.id)).length > lessons.length / 2);
  const lead = used.length === 1 ? used[0] : main;
  return lead ? lead.authors.split(/,|&/)[0].trim() + (/[,&]/.test(lead.authors) ? " et al." : "") : used.length ? plural(used.length, "book") : t.summary;
}

/** One topic (a book, usually) as a list row: its mark, title, author and progress. */
export function TopicRow({ topic, catalog, p }: { topic: Topic; catalog: Catalog; p: Progress }) {
  const { done, total, started } = topicProgress(topic, p);
  const complete = total > 0 && done === total;
  return (
    <li>
      <Link href={`/topic/${topic.id}/`} className={`list-row topic-row${complete ? " is-done" : ""}`}>
        <span className="book__mark topic-row__mark" aria-hidden>
          {topic.mark ?? monogram(topic.title)}
        </span>
        <span className="list-row__body">
          <span className="list-row__title topic-row__title">{topic.title}</span>
          <span className="list-row__meta topic-row__by">{byline(topic, catalog)}</span>
          <span className="topic-row__foot">
            <Meter value={total ? (done / total) * 100 : 0} label={`${topic.title} progress`} />
            <span className="figure">{complete ? "Done" : done || started ? `${done} of ${total}` : "Not started"}</span>
          </span>
        </span>
        <ChevronIcon className="chevron" aria-hidden />
      </Link>
    </li>
  );
}
