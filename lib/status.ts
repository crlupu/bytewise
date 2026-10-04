import type { Catalog, CourseMeta, LessonMeta } from "@/lib/types";
import type { Progress } from "@/lib/progress";

export type LessonStatus = "locked" | "available" | "in_progress" | "completed";

/** Started or finished lessons keep their status even if a prerequisite was
 * skipped: once the learner overrides a lock, it stays open. */
export function lessonStatus(l: LessonMeta, p: Progress): LessonStatus {
  const rec = p.lessons[l.key];
  if (rec?.status === "completed") return "completed";
  if (rec) return "in_progress";
  return l.requires.every((k) => p.lessons[k]?.status === "completed") ? "available" : "locked";
}

export function courseProgress(c: CourseMeta, p: Progress): { done: number; total: number; pct: number } {
  const done = c.lessons.filter((l) => p.lessons[l.key]?.status === "completed").length;
  const total = c.lessons.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Steps completed in a lesson, out of its total. */
export function lessonSteps(l: LessonMeta, p: Progress): { done: number; total: number } {
  return { done: l.stepKeys.filter((k) => p.steps[k]?.completed).length, total: l.stepKeys.length };
}

export function allLessons(cat: Catalog): LessonMeta[] {
  return cat.topics.flatMap((t) => t.courses.flatMap((c) => c.lessons));
}

export function findLesson(cat: Catalog, key: string): LessonMeta | undefined {
  return allLessons(cat).find((l) => l.key === key);
}

export function findCourse(cat: Catalog, id: string): CourseMeta | undefined {
  return cat.topics.flatMap((t) => t.courses).find((c) => c.id === id);
}

/**
 * What "Continue" opens: the most recent lesson at its first unfinished
 * step; if that lesson is done, the next lesson in its course that isn't;
 * with no history, the first lesson of all.
 */
export function continueTarget(cat: Catalog, p: Progress): { lesson: LessonMeta; step: number; fresh: boolean } | null {
  const lessons = allLessons(cat);
  if (!lessons.length) return null;
  const last = p.last ? lessons.find((l) => l.key === p.last) : undefined;
  if (last && p.lessons[last.key]?.status !== "completed") {
    const step = last.stepKeys.findIndex((k) => !p.steps[k]?.completed);
    return { lesson: last, step: step < 0 ? last.steps - 1 : step, fresh: false };
  }
  if (last) {
    const course = findCourse(cat, last.courseId)!;
    const next = course.lessons.find((l) => p.lessons[l.key]?.status !== "completed" && lessonStatus(l, p) !== "locked");
    if (next) return { lesson: next, step: 0, fresh: !p.lessons[next.key] };
  }
  const next = lessons.find((l) => lessonStatus(l, p) === "available" || lessonStatus(l, p) === "in_progress");
  return next ? { lesson: next, step: 0, fresh: !p.lessons[next.key] } : null;
}
