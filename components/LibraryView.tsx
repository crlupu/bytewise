"use client";

import { useState } from "react";
import { SearchIcon } from "@/components/icons";
import { SearchResults } from "@/components/SearchView";
import { TopicRow, topicProgress } from "@/components/Shelf";
import { PageHead } from "@/components/ui";
import { useProgress } from "@/lib/progress";
import type { Catalog } from "@/lib/types";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "going", label: "In progress" },
  { id: "new", label: "Not started" },
] as const;

/**
 * Every book and topic, with search on top. Typing searches the lessons
 * inside them; the filter narrows the list to what's under way or untouched.
 */
export function LibraryView({ catalog }: { catalog: Catalog }) {
  const p = useProgress();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const topics = catalog.topics.filter((t) => {
    const x = topicProgress(t, p);
    return filter === "all" || (filter === "going" ? x.started && x.done < x.total : !x.started);
  });

  return (
    <>
      <PageHead title="Library" />
      <label className="search">
        <SearchIcon aria-hidden />
        <span className="sr-only">Search lessons</span>
        <input type="search" placeholder="Books, lessons, tags" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
      </label>

      {q.trim() ? (
        <SearchResults catalog={catalog} q={q} />
      ) : (
        <>
          <div className="seg seg--block library-filter" role="group" aria-label="Show">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className="seg__btn" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          {topics.length ? (
            <ul className="list">
              {topics.map((t) => (
                <TopicRow key={t.id} topic={t} catalog={catalog} p={p} />
              ))}
            </ul>
          ) : (
            <div className="empty">
              <p className="empty__title">{filter === "going" ? "Nothing under way yet" : "You've started every book"}</p>
              <p>{filter === "going" ? "Start a lesson from any book and it shows up here." : "Pick up where you left off under In progress."}</p>
            </div>
          )}
        </>
      )}
    </>
  );
}
