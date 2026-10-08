"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { addDays, today } from "@/lib/dates";

/**
 * Everything the app remembers about the learner, kept in localStorage on
 * this device. One JSON document, changed only through the actions below,
 * each of which writes it back and notifies every component reading it.
 */

const KEY = "bytewise:v1";

const StepRecord = z.object({
  completed: z.boolean(),
  attempts: z.number().int().min(0),
  /** Hints revealed, in total. */
  hints: z.number().int().min(0),
  /** Right on the first attempt, with no hint before it. Null until answered. */
  firstTry: z.boolean().nullable(),
});

const LessonRecord = z.object({
  status: z.enum(["in_progress", "completed"]),
  /** The step to reopen at. */
  position: z.number().int().min(0),
  started: z.string(),
  opened: z.string(),
  completed: z.string().optional(),
  /** Share of exercises right on the first attempt, 0–1, set on completion. */
  firstTryShare: z.number().min(0).max(1).optional(),
});

const ReviewItem = z.object({
  /** Which rung of the interval ladder the item is on. */
  box: z.number().int().min(0),
  /** Date key (YYYY-MM-DD) the item next comes up. */
  due: z.string(),
  last: z.string().optional(),
  lapses: z.number().int().min(0).default(0),
});

const Day = z.object({
  lessons: z.number().int().min(0).default(0),
  reviews: z.number().int().min(0).default(0),
  exercises: z.number().int().min(0).default(0),
});

const BossRecord = z.object({
  attempts: z.number().int().min(0),
  /** Date key of the first win. */
  defeated: z.string().optional(),
  /** Most lives left at the end of a win. */
  best: z.number().int().min(0).default(0),
});

export const ProgressSchema = z.object({
  version: z.literal(1),
  steps: z.record(StepRecord).default({}),
  lessons: z.record(LessonRecord).default({}),
  /** The lesson opened most recently. */
  last: z.string().nullable().default(null),
  review: z.record(ReviewItem).default({}),
  activity: z.record(Day).default({}),
  /** Boss battles on the Skills tab, by skill id. */
  bosses: z.record(BossRecord).default({}),
});

export type StepRec = z.infer<typeof StepRecord>;
export type LessonRec = z.infer<typeof LessonRecord>;
export type ReviewRec = z.infer<typeof ReviewItem>;
export type BossRec = z.infer<typeof BossRecord>;
export type Progress = z.infer<typeof ProgressSchema>;

const EMPTY: Progress = { version: 1, steps: {}, lessons: {}, last: null, review: {}, activity: {}, bosses: {} };

/** Days until an item comes up again, by rung. A miss drops it to rung 0. */
export const INTERVALS = [1, 3, 7, 14, 30, 60, 120];

// ---- The store ----

let state: Progress = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function read(): Progress {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const p = ProgressSchema.safeParse(JSON.parse(raw));
        if (p.success) state = p.data;
      }
    } catch {
      // Storage blocked or corrupt: start empty rather than fail.
    }
  }
  return state;
}

function commit(fn: (p: Progress) => Progress) {
  state = fn(read());
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full disk: the session still works, it just won't persist.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  // Another tab changed progress: pick it up.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    loaded = false;
    l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** False during the pre-rendered first paint, true once progress is read. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

// ---- Helpers ----

const now = () => new Date().toISOString();

function bump(p: Progress, field: "lessons" | "reviews" | "exercises"): Progress["activity"] {
  const d = today();
  const day = p.activity[d] ?? { lessons: 0, reviews: 0, exercises: 0 };
  return { ...p.activity, [d]: { ...day, [field]: day[field] + 1 } };
}

function scheduled(prev: ReviewRec | undefined, good: boolean): ReviewRec {
  const box = good ? Math.min((prev ? prev.box : 0) + 1, INTERVALS.length - 1) : 0;
  return {
    box,
    due: addDays(today(), INTERVALS[box]),
    last: today(),
    lapses: (prev?.lapses ?? 0) + (good ? 0 : 1),
  };
}

const blankStep = (): StepRec => ({ completed: false, attempts: 0, hints: 0, firstTry: null });

// ---- Actions ----

export const progress = {
  openLesson(lessonKey: string, position?: number) {
    commit((p) => {
      const prev = p.lessons[lessonKey];
      const rec: LessonRec = prev
        ? { ...prev, opened: now(), position: position ?? prev.position }
        : { status: "in_progress", position: position ?? 0, started: now(), opened: now() };
      return { ...p, last: lessonKey, lessons: { ...p.lessons, [lessonKey]: rec } };
    });
  },

  setPosition(lessonKey: string, position: number) {
    commit((p) => {
      const prev = p.lessons[lessonKey];
      if (!prev || prev.position === position) return p;
      return { ...p, lessons: { ...p.lessons, [lessonKey]: { ...prev, position } } };
    });
  },

  /** An explanation step has been read. */
  completeStep(stepKey: string) {
    commit((p) => {
      const prev = p.steps[stepKey] ?? blankStep();
      if (prev.completed) return p;
      return { ...p, steps: { ...p.steps, [stepKey]: { ...prev, completed: true } } };
    });
  },

  hint(stepKey: string) {
    commit((p) => {
      const prev = p.steps[stepKey] ?? blankStep();
      return { ...p, steps: { ...p.steps, [stepKey]: { ...prev, hints: prev.hints + 1 } } };
    });
  },

  /**
   * An answer to an exercise inside a lesson. The first correct answer
   * completes the step and puts it on the review ladder: on rung 1 when it
   * was right first time without a hint, on rung 0 (back tomorrow) otherwise.
   */
  attempt(stepKey: string, correct: boolean, hintsBefore: number) {
    commit((p) => {
      const prev = p.steps[stepKey] ?? blankStep();
      const first = prev.attempts === 0;
      const rec: StepRec = {
        ...prev,
        attempts: prev.attempts + 1,
        firstTry: first ? correct && hintsBefore === 0 : prev.firstTry,
        completed: prev.completed || correct,
      };
      const newlyDone = correct && !prev.completed;
      return {
        ...p,
        steps: { ...p.steps, [stepKey]: rec },
        review: newlyDone && !p.review[stepKey] ? { ...p.review, [stepKey]: scheduled(undefined, !!rec.firstTry) } : p.review,
        activity: newlyDone ? bump(p, "exercises") : p.activity,
      };
    });
  },

  completeLesson(lessonKey: string, exerciseKeys: string[]) {
    commit((p) => {
      const prev = p.lessons[lessonKey];
      const share = exerciseKeys.length
        ? exerciseKeys.filter((k) => p.steps[k]?.firstTry).length / exerciseKeys.length
        : 1;
      const first = prev?.status !== "completed";
      const rec: LessonRec = {
        started: prev?.started ?? now(),
        opened: now(),
        position: 0,
        status: "completed",
        completed: first ? now() : prev?.completed,
        firstTryShare: first ? share : prev?.firstTryShare,
      };
      return {
        ...p,
        lessons: { ...p.lessons, [lessonKey]: rec },
        activity: first ? bump(p, "lessons") : p.activity,
      };
    });
  },

  /** The first answer to an item in a review session moves it on the ladder. */
  reviewed(stepKey: string, good: boolean) {
    commit((p) => ({ ...p, review: { ...p.review, [stepKey]: scheduled(p.review[stepKey], good) } }));
  },

  /** A boss battle ended: won with `lives` left, or lost. */
  bossResult(skillId: string, won: boolean, lives: number) {
    commit((p) => {
      const prev = p.bosses[skillId] ?? { attempts: 0, best: 0 };
      const rec: BossRec = {
        attempts: prev.attempts + 1,
        defeated: prev.defeated ?? (won ? today() : undefined),
        best: won ? Math.max(prev.best, lives) : prev.best,
      };
      return { ...p, bosses: { ...p.bosses, [skillId]: rec } };
    });
  },

  completeReviewSession() {
    commit((p) => ({ ...p, activity: bump(p, "reviews") }));
  },

  /** Forget the given lessons: their steps, their record and their review items. */
  resetLessons(lessonKeys: string[]) {
    const prefixes = lessonKeys.map((k) => `${k}/`);
    const keep = <T,>(rec: Record<string, T>) =>
      Object.fromEntries(Object.entries(rec).filter(([k]) => !prefixes.some((pre) => k.startsWith(pre))));
    commit((p) => ({
      ...p,
      steps: keep(p.steps),
      review: keep(p.review),
      lessons: Object.fromEntries(Object.entries(p.lessons).filter(([k]) => !lessonKeys.includes(k))),
      last: p.last && lessonKeys.includes(p.last) ? null : p.last,
    }));
  },

  resetAll() {
    commit(() => EMPTY);
  },

  export(): string {
    return JSON.stringify({ app: "bytewise", exported: now(), progress: read() }, null, 2);
  },

  /** Replace progress with an exported file's. Throws with a readable reason. */
  import(text: string) {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("That file isn't JSON.");
    }
    const body = (json as { progress?: unknown })?.progress ?? json;
    const p = ProgressSchema.safeParse(body);
    if (!p.success) throw new Error("That file isn't a Bytewise progress export.");
    commit(() => p.data);
  },
};

// ---- Derived ----

/** Review items due today or earlier. */
export function dueItems(p: Progress, known: Set<string>): string[] {
  const t = today();
  return Object.entries(p.review)
    .filter(([k, r]) => r.due <= t && known.has(k))
    .map(([k]) => k);
}

export function activeDay(p: Progress, d: string): boolean {
  const a = p.activity[d];
  return !!a && (a.lessons > 0 || a.reviews > 0);
}

/** Consecutive days with a lesson or review session finished, ending today —
 * or yesterday, so the streak isn't lost before today's session. */
export function streak(p: Progress): { current: number; longest: number; today: boolean } {
  const t = today();
  let d = activeDay(p, t) ? t : addDays(t, -1);
  let current = 0;
  while (activeDay(p, d)) {
    current++;
    d = addDays(d, -1);
  }
  const days = Object.keys(p.activity).filter((k) => activeDay(p, k)).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of days) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = k;
  }
  return { current, longest: Math.max(longest, current), today: activeDay(p, t) };
}
