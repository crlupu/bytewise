"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronIcon, PlayIcon, ReadIcon } from "@/components/icons";
import { booksOf } from "@/components/Books";
import { Confirm, Meter, PageHead, STATUS_LABEL, StatusMark, plural } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import { progress, useProgress } from "@/lib/progress";
import { courseProgress, lessonStatus, lessonSteps } from "@/lib/status";
import type { Book, CourseMeta, LessonMeta } from "@/lib/types";

/**
 * A course: its lessons in order, each locked, available, in progress or
 * completed. A locked lesson still opens, after a word about what it builds on.
 * Edit reveals the resets.
 */
export function CourseView({
  course,
  topicTitle,
  titles,
  books,
}: {
  course: CourseMeta;
  topicTitle: string;
  titles: Record<string, string>;
  books: Record<string, Book>;
}) {
  const p = useProgress();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [locked, setLocked] = useState<LessonMeta | null>(null);
  const [reset, setReset] = useState<{ keys: string[]; label: string } | null>(null);
  const cp = courseProgress(course, p);
  const minutes = course.lessons.reduce((n, l) => n + l.duration, 0);
  const href = (l: LessonMeta) => `/lesson/${l.courseId}/${l.id}/`;
  const touched = course.lessons.some((l) => p.lessons[l.key]);

  return (
    <>
      <PageHead title={course.title} subtitle={topicTitle} back={{ href: "/", label: "Learn" }} lede={course.summary}>
        {touched && (
          <button type="button" className="btn btn--plain btn--sm" onClick={() => setEditing((e) => !e)}>
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </PageHead>
      <div className="course-meta">
        <Meter value={cp.pct} label="Course progress" />
        <span className="figure">
          {cp.done} of {plural(cp.total, "lesson")}
        </span>
        <span>about {minutes} min</span>
      </div>
      {(() => {
        const used = booksOf(course.lessons.map((l) => l.sources), books);
        return used.length ? (
          <div className="course-books" aria-label="Drawn from">
            {used.map((b) => (
              <span key={b.id} className="pill">
                <ReadIcon aria-hidden style={{ color: "var(--accent)" }} />
                <i>{b.title}</i>&nbsp;· {b.authors.split(/,|&/)[0].trim()}
                {/[,&]/.test(b.authors) ? " et al." : ""}
              </span>
            ))}
          </div>
        ) : null;
      })()}

      <section>
        <ul className="list">
          {course.lessons.map((l, i) => {
            const status = lessonStatus(l, p);
            const st = lessonSteps(l, p);
            const rec = p.lessons[l.key];
            const pct = Math.round((st.done / st.total) * 100);
            const meta =
              status === "completed" && rec?.completed
                ? `Completed ${formatDay(rec.completed.slice(0, 10))}${rec.firstTryShare !== undefined && l.exercises.length ? ` · ${Math.round(rec.firstTryShare * 100)}% right first time` : ""}`
                : status === "in_progress"
                  ? `In progress · step ${Math.min(rec!.position + 1, l.steps)} of ${l.steps}`
                  : status === "locked"
                    ? `Builds on ${l.requires.filter((k) => p.lessons[k]?.status !== "completed").map((k) => titles[k] ?? k).join(", ")}`
                    : `${l.duration} min · ${plural(l.steps, "step")}`;
            const body = (
              <>
                <StatusMark status={status} index={i} pct={pct} />
                <span className="list-row__body">
                  <span className="list-row__title" style={{ display: "block" }}>
                    {l.title}
                  </span>
                  <span className="list-row__sub" style={{ display: "block" }}>
                    {l.summary}
                  </span>
                  <span className="list-row__meta" style={{ display: "block" }}>
                    <span className="sr-only">{STATUS_LABEL[status]}. </span>
                    {meta}
                  </span>
                  {l.sources.slice(0, 1).map((src) =>
                    books[src.book] ? (
                      <span key={src.book} className="book-ref">
                        <ReadIcon aria-hidden />
                        <span>
                          <i>{books[src.book].title}</i> — {src.ref}
                        </span>
                      </span>
                    ) : null,
                  )}
                </span>
              </>
            );
            return (
              <li key={l.key} className={`lesson-row${status === "locked" ? " is-locked" : ""}`}>
                {editing ? (
                  <div className="list-row">
                    {body}
                    {rec || st.done ? (
                      <button type="button" className="btn btn--danger btn--sm" onClick={() => setReset({ keys: [l.key], label: `“${l.title}”` })}>
                        Reset
                      </button>
                    ) : null}
                  </div>
                ) : status === "locked" ? (
                  <button type="button" className="list-row" onClick={() => setLocked(l)}>
                    {body}
                    <ChevronIcon className="chevron" aria-hidden />
                  </button>
                ) : (
                  <Link href={href(l)} className="list-row">
                    {body}
                    <ChevronIcon className="chevron" aria-hidden />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
        {editing && (
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn btn--danger btn--block"
              onClick={() => setReset({ keys: course.lessons.map((l) => l.key), label: `all of ${course.title}` })}
            >
              Reset course progress
            </button>
          </div>
        )}
        {!editing && cp.done < cp.total && (
          <div style={{ marginTop: 16 }}>
            {(() => {
              const next = course.lessons.find((l) => lessonStatus(l, p) === "in_progress") ?? course.lessons.find((l) => lessonStatus(l, p) === "available");
              return next ? (
                <Link href={href(next)} className="btn btn--primary">
                  <PlayIcon aria-hidden />
                  {p.lessons[next.key] ? "Continue" : cp.done ? "Next lesson" : "Start course"}
                </Link>
              ) : null;
            })()}
          </div>
        )}
      </section>

      <Confirm
        open={!!locked}
        title="This lesson is locked"
        body={
          locked && (
            <>
              <b>{locked.title}</b> builds on {locked.requires.map((k) => titles[k] ?? k).join(", ")}. You can still open it if you know that material already.
            </>
          )
        }
        action="Open anyway"
        onConfirm={() => locked && router.push(href(locked))}
        onClose={() => setLocked(null)}
      />
      <Confirm
        open={!!reset}
        title="Reset progress?"
        body={reset && <>This forgets your answers, completion and review items for {reset.label}. It can't be undone.</>}
        action="Reset"
        danger
        onConfirm={() => {
          if (reset) progress.resetLessons(reset.keys);
          setEditing(false);
        }}
        onClose={() => setReset(null)}
      />
    </>
  );
}
