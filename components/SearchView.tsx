"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronIcon, ReadIcon, SearchIcon } from "@/components/icons";
import { PageHead, StatusMark, plural } from "@/components/ui";
import { useProgress } from "@/lib/progress";
import { lessonStatus, lessonSteps } from "@/lib/status";
import type { Catalog, LessonMeta } from "@/lib/types";

type Hit = { lesson: LessonMeta; index: number; course: string; topic: string; score: number };

function highlight(text: string, terms: string[]) {
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

/** Search lessons by title, summary and tags. Every term must match somewhere;
 * a match in the title counts most. */
export function SearchView({ catalog }: { catalog: Catalog }) {
  const p = useProgress();
  const [q, setQ] = useState("");
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const all = useMemo(
    () =>
      catalog.topics.flatMap((t) =>
        t.courses.flatMap((c) => c.lessons.map((l, index) => ({ lesson: l, index, course: c.title, topic: t.title }))),
      ),
    [catalog],
  );
  const library = useMemo(() => {
    const count = new Map<string, number>();
    for (const a of all) for (const src of new Set(a.lesson.sources.map((x) => x.book))) count.set(src, (count.get(src) ?? 0) + 1);
    return [...count]
      .filter(([id]) => catalog.books[id])
      .map(([id, n]) => ({ book: catalog.books[id], count: n }));
  }, [all, catalog.books]);
  const tags = useMemo(() => [...new Set(all.flatMap((a) => a.lesson.tags))].sort(), [all]);

  const hits: Hit[] = terms.length
    ? all
        .map((a) => {
          const title = a.lesson.title.toLowerCase();
          const summary = a.lesson.summary.toLowerCase();
          const tagText = a.lesson.tags.join(" ").toLowerCase();
          // Books count as context: searching "Effective Java" finds every lesson drawn from it.
          const bookText = a.lesson.sources
            .map((src) => (catalog.books[src.book] ? `${catalog.books[src.book].title} ${catalog.books[src.book].authors} ${src.ref}` : ""))
            .join(" ");
          const context = `${a.course} ${a.topic} ${bookText}`.toLowerCase();
          let score = 0;
          for (const t of terms) {
            const s = (title.includes(t) ? 4 : 0) + (tagText.includes(t) ? 3 : 0) + (summary.includes(t) ? 2 : 0) + (context.includes(t) ? 1 : 0);
            if (!s) return { ...a, score: 0 };
            score += s;
          }
          return { ...a, score };
        })
        .filter((h) => h.score > 0)
        .sort((a, b) => b.score - a.score)
    : [];

  return (
    <>
      <PageHead title="Search" />
      <label className="search">
        <SearchIcon aria-hidden />
        <span className="sr-only">Search lessons</span>
        <input type="search" placeholder="Lessons, topics, tags" value={q} onChange={(e) => setQ(e.target.value)} autoFocus enterKeyHint="search" />
      </label>

      {!terms.length ? (
        <>
          <section>
            <h2 className="group-label">Tags</h2>
            <div className="chip-row">
              {tags.map((t) => (
                <button key={t} type="button" className="choice-chip" onClick={() => setQ(t)}>
                  {t}
                </button>
              ))}
            </div>
          </section>
          {library.length > 0 && (
            <section>
              <h2 className="group-label">Library — the books behind the lessons</h2>
              <ul className="list">
                {library.map(({ book, count }) => (
                  <li key={book.id}>
                    <button type="button" className="list-row list-row--icon" onClick={() => setQ(book.title)}>
                      <ReadIcon className="sources__icon" aria-hidden />
                      <span className="list-row__body">
                        <span className="sources__title">{book.title}</span>
                        <span className="list-row__meta" style={{ display: "block" }}>
                          {book.authors}
                          {book.edition ? `, ${book.edition}` : ""} · {book.year}
                        </span>
                      </span>
                      <span className="list-row__end figure">{plural(count, "lesson")}</span>
                      <ChevronIcon className="chevron" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : hits.length ? (
        <section>
          <h2 className="group-label">{plural(hits.length, "lesson")}</h2>
          <ul className="list">
            {hits.map(({ lesson: l, index, course, topic }) => {
              const st = lessonSteps(l, p);
              return (
                <li key={l.key}>
                  <Link href={`/lesson/${l.courseId}/${l.id}/`} className="list-row">
                    <StatusMark status={lessonStatus(l, p)} index={index} pct={Math.round((st.done / st.total) * 100)} />
                    <span className="list-row__body">
                      <span className="list-row__title" style={{ display: "block" }}>
                        {highlight(l.title, terms)}
                      </span>
                      <span className="list-row__sub" style={{ display: "block" }}>
                        {highlight(l.summary, terms)}
                      </span>
                      <span className="list-row__meta" style={{ display: "block" }}>
                        {topic} · {course}
                        {l.tags.length > 0 && <> · {highlight(l.tags.join(", "), terms)}</>}
                      </span>
                    </span>
                    <ChevronIcon className="chevron" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <div className="empty">
          <SearchIcon className="empty__icon" aria-hidden />
          <p className="empty__title">No lessons match “{q}”</p>
          <p>Try a broader word, or one of the tags.</p>
        </div>
      )}
    </>
  );
}
