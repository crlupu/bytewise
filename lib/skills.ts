import type { Lesson } from "@/lib/types";
import type { Progress, ReviewRec, StepRec } from "@/lib/progress";
import { addDays, dateKey, parseKey, today } from "@/lib/dates";

/**
 * Skills: the engineering skill tree, and everything the Skills tab works
 * out from progress — mastery, XP and level, rank, bosses and the day's
 * quests. Nothing here is stored except boss results; the rest is derived,
 * so it can't drift from what the learner actually did.
 *
 * Mastery is deliberately not completion. An exercise counts a little once
 * answered, and fully only once it has survived reviews months apart, so a
 * skill is mastered by remembering it, not by finishing its lessons.
 */

// ---- The tree ----

export type Branch = "code" | "systems" | "design";

export type SkillDef = {
  id: string;
  title: string;
  branch: Branch;
  /** Topics, and single courses from other topics, whose lessons train it. */
  topics: string[];
  courses?: string[];
  /** Courses of those topics that belong to another skill instead. */
  except?: string[];
  boss: { name: string; blurb: string };
};

export const BRANCHES: { id: Branch; title: string }[] = [
  { id: "code", title: "Code" },
  { id: "systems", title: "Systems" },
  { id: "design", title: "Design" },
];

export const SKILLS: SkillDef[] = [
  {
    id: "java",
    title: "Java",
    branch: "code",
    topics: ["java", "thinking-in-java", "java-puzzlers", "modern-java", "well-grounded"],
    boss: { name: "The Puzzler", blurb: "Code that compiles, runs, and does something other than what it says." },
  },
  {
    id: "effective-java",
    title: "Effective Java & Generics",
    branch: "code",
    topics: ["effective-java", "generics-collections"],
    except: ["ej-concurrency"],
    boss: { name: "The Leaky Abstraction", blurb: "An API that looked fine until its clients started using it." },
  },
  {
    id: "concurrency",
    title: "Concurrency",
    branch: "code",
    topics: ["jcip"],
    courses: ["ej-concurrency"],
    boss: { name: "The Race Condition", blurb: "Shared state, two threads, and a bug that only shows up in production." },
  },
  {
    id: "jvm",
    title: "JVM & Performance",
    branch: "systems",
    topics: ["java-performance", "troubleshooting-java"],
    boss: { name: "The Leaking Heap", blurb: "Latency creeps up, the GC runs flat out, and nobody changed anything." },
  },
  {
    id: "os",
    title: "Operating Systems",
    branch: "systems",
    topics: ["operating-systems"],
    boss: { name: "The Thrashing Scheduler", blurb: "Every process is busy and none of them is getting anywhere." },
  },
  {
    id: "networking",
    title: "Networking",
    branch: "systems",
    topics: ["networking"],
    boss: { name: "The Dropped Packet", blurb: "Intermittent timeouts between two services that are both healthy." },
  },
  {
    id: "databases",
    title: "Databases",
    branch: "systems",
    topics: ["databases"],
    boss: { name: "The Slow Query", blurb: "A page that took 40 ms now takes four seconds." },
  },
  {
    id: "patterns",
    title: "Design Patterns",
    branch: "design",
    topics: ["design-patterns"],
    boss: { name: "The Tangled Hierarchy", blurb: "Forty subclasses, and the next feature needs a forty-first." },
  },
  {
    id: "testing",
    title: "Testing",
    branch: "design",
    topics: ["software-testing"],
    boss: { name: "The Flaky Suite", blurb: "Green on your machine, red in CI, green again on retry." },
  },
  {
    id: "architecture",
    title: "Architecture",
    branch: "design",
    topics: ["architecture"],
    boss: { name: "The Cascading Failure", blurb: "One slow dependency, and the whole platform goes down with it." },
  },
];

/** Facets of engineering judgment, each fed by the exercises that call on it. */
export const FACETS = [
  { id: "tradeoffs", title: "Trade-offs" },
  { id: "debugging", title: "Debugging" },
  { id: "performance", title: "Performance" },
  { id: "design", title: "Design" },
  { id: "risk", title: "Failure & risk" },
] as const;
export type FacetId = (typeof FACETS)[number]["id"];

/** Which skill each lesson trains, and which facets each exercise calls on — worked out at build time. */
export type SkillIndex = {
  /** skill id → its lessons' keys, in course order */
  lessons: Record<string, string[]>;
  /** skill id → its exercises' keys */
  exercises: Record<string, string[]>;
  /** facet id → exercise keys */
  facets: Record<FacetId, string[]>;
};

export function skillOfLesson(topicId: string, courseId: string): SkillDef | undefined {
  return (
    SKILLS.find((s) => s.courses?.includes(courseId)) ??
    SKILLS.find((s) => s.topics.includes(topicId) && !s.except?.includes(courseId))
  );
}

const has = (tags: string[], ...want: string[]) => want.some((w) => tags.includes(w));

function facetsOf(l: Lesson, widget: string | undefined): FacetId[] {
  const t = l.tags;
  const out: FacetId[] = [];
  if (
    (widget && ["tradeoff", "scheduler", "congestion"].includes(widget)) ||
    ["architecture"].includes(l.topicId) ||
    ["design-tradeoffs", "ej-classes", "hfdp-principles", "tij-reuse"].includes(l.courseId) ||
    has(t, "api design", "composition", "trade-offs")
  )
    out.push("tradeoffs");
  if (
    (widget && ["locks", "threads"].includes(widget)) ||
    ["troubleshooting-java", "java-puzzlers"].includes(l.topicId) ||
    has(t, "deadlock", "memory leak", "liveness", "profiling", "debugging")
  )
    out.push("debugging");
  if (
    (widget && ["paging", "btree"].includes(widget)) ||
    l.topicId === "java-performance" ||
    ["sql-performance", "jcip-performance"].includes(l.courseId) ||
    has(t, "performance")
  )
    out.push("performance");
  if (
    widget === "hierarchy" ||
    l.topicId === "design-patterns" ||
    ["tij-polymorphism", "tij-interfaces", "tij-reuse", "ej-classes"].includes(l.courseId) ||
    has(t, "interfaces", "inheritance", "polymorphism", "encapsulation")
  )
    out.push("design");
  if (
    ["stability-patterns", "jcip-cancellation", "ej-exceptions", "transactions", "jcip-thread-safety"].includes(l.courseId) ||
    has(t, "exceptions", "timeouts", "security", "invariants", "thread safety")
  )
    out.push("risk");
  return [...new Set(out)];
}

/** Build-time: sort every lesson and exercise into skills and facets. */
export function buildSkillIndex(lessons: Lesson[]): SkillIndex {
  const index: SkillIndex = {
    lessons: Object.fromEntries(SKILLS.map((s) => [s.id, []])),
    exercises: Object.fromEntries(SKILLS.map((s) => [s.id, []])),
    facets: Object.fromEntries(FACETS.map((f) => [f.id, []])) as unknown as Record<FacetId, string[]>,
  };
  for (const l of lessons) {
    const skill = skillOfLesson(l.topicId, l.courseId);
    if (skill) {
      index.lessons[skill.id].push(l.key);
      index.exercises[skill.id].push(...l.exercises);
    }
    for (const s of l.body) {
      if (s.type === "explanation") continue;
      for (const f of facetsOf(l, s.type === "widget" ? s.widget : undefined)) index.facets[f].push(s.key);
    }
  }
  return index;
}

// ---- Mastery ----

/** What an answered exercise is worth, by its rung on the review ladder (1, 3, 7, 14, 30, 60, 120 days). */
const LADDER = [0.25, 0.4, 0.55, 0.7, 0.8, 0.9, 1];

export function strength(step: StepRec | undefined, review: ReviewRec | undefined): number {
  if (!step?.completed) return 0;
  return LADDER[Math.min(review?.box ?? 0, LADDER.length - 1)];
}

/** 0–100: how much of these exercises is known and remembered. */
export function mastery(keys: string[], p: Progress): number {
  if (!keys.length) return 0;
  const sum = keys.reduce((n, k) => n + strength(p.steps[k], p.review[k]), 0);
  return Math.round((sum / keys.length) * 100);
}

export const learned = (keys: string[], p: Progress) => keys.filter((k) => p.steps[k]?.completed).length;

export const LEVELS = [
  "Unfamiliar",
  "Recognition",
  "Basic understanding",
  "Application",
  "Independent use",
  "Strong understanding",
  "Advanced application",
  "Debugging",
  "Design",
  "Trade-offs",
  "Mastery",
];

/** A skill's level, 0–10, from its mastery. */
export const skillLevel = (m: number) => Math.min(10, Math.floor(m / 10));

// ---- XP and level ----

export const XP = { firstTry: 10, answered: 6, perRung: 4, lesson: 20, boss: 150 };

/**
 * XP rewards activity, but only once per thing: an exercise pays when first
 * answered, then a little more for each review rung it climbs, so there's
 * nothing to grind. Bosses pay most.
 */
export function totalXp(p: Progress): number {
  let xp = 0;
  for (const [k, s] of Object.entries(p.steps)) {
    if (!s.completed || s.firstTry === null) continue;
    xp += s.firstTry ? XP.firstTry : XP.answered;
    xp += (p.review[k]?.box ?? 0) * XP.perRung;
  }
  xp += Object.values(p.lessons).filter((l) => l.status === "completed").length * XP.lesson;
  xp += Object.values(p.bosses).filter((b) => b.defeated).length * XP.boss;
  return xp;
}

/** Level L starts at 50·L·(L−1) XP: 0, 100, 300, 600… */
const levelStart = (l: number) => 50 * l * (l - 1);

export function playerLevel(xp: number): { level: number; into: number; span: number } {
  const level = Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2);
  const start = levelStart(level);
  return { level, into: xp - start, span: levelStart(level + 1) - start };
}

// ---- Rank ----

type RankReq = { skills?: [count: number, min: number]; bosses?: number; judgment?: number; must?: [skill: string, min: number] };
export const RANKS: { title: string; req: RankReq }[] = [
  { title: "Junior Engineer", req: {} },
  { title: "Engineer", req: { skills: [2, 10] } },
  { title: "Mid-level Engineer", req: { skills: [4, 20], bosses: 1 } },
  { title: "Senior Engineer", req: { skills: [6, 35], bosses: 3, judgment: 30 } },
  { title: "Staff Engineer", req: { skills: [8, 50], bosses: 6, judgment: 50, must: ["architecture", 50] } },
  { title: "Principal Engineer", req: { skills: [10, 65], bosses: 9, judgment: 65 } },
  { title: "Software Architect", req: { skills: [10, 80], bosses: 10, judgment: 80 } },
];

export type Standing = { skills: Record<string, number>; judgment: number; bosses: number };

export function requirements(req: RankReq, s: Standing): { text: string; met: boolean }[] {
  const out: { text: string; met: boolean }[] = [];
  if (req.skills) {
    const [count, min] = req.skills;
    const n = Object.values(s.skills).filter((m) => m >= min).length;
    out.push({ text: `${count === SKILLS.length ? "Every" : count} skill${count === 1 ? "" : "s"} at ${min}% mastery (${Math.min(n, count)}/${count})`, met: n >= count });
  }
  if (req.must) {
    const [id, min] = req.must;
    const sk = SKILLS.find((x) => x.id === id)!;
    out.push({ text: `${sk.title} at ${min}%`, met: (s.skills[id] ?? 0) >= min });
  }
  if (req.bosses) out.push({ text: `${req.bosses} boss${req.bosses === 1 ? "" : "es"} defeated (${Math.min(s.bosses, req.bosses)}/${req.bosses})`, met: s.bosses >= req.bosses });
  if (req.judgment) out.push({ text: `Engineering judgment at ${req.judgment} (${s.judgment})`, met: s.judgment >= req.judgment });
  return out;
}

/** The highest rank whose requirements, and every lower rank's, are met. */
export function rankOf(s: Standing): number {
  let r = 0;
  while (r + 1 < RANKS.length && requirements(RANKS[r + 1].req, s).every((x) => x.met)) r++;
  return r;
}

// ---- Bosses ----

export const BOSS = { rounds: 10, lives: 3 };

/** A boss opens once a good part of its skill has been learned. */
export function bossNeeds(total: number): number {
  return Math.max(6, Math.min(40, Math.ceil(total * 0.4)));
}

// ---- Quests ----

/** The learner's day for an ISO timestamp. */
export const dayOf = (iso: string) => dateKey(new Date(iso));

export type Quest = { id: string; title: string; detail: string; done: boolean; href: string };

const dayNumber = (k: string) => Math.round(parseKey(k).getTime() / 86_400_000);

/**
 * Three quests a day, fixed for the day: keep reviews clear, push one skill
 * forward (rotating through those under way, so the week covers several),
 * and face a boss when one is waiting.
 */
export function dailyQuests(p: Progress, index: SkillIndex, due: number, mast: Record<string, number>): Quest[] {
  const t = today();
  const act = p.activity[t] ?? { lessons: 0, reviews: 0, exercises: 0 };
  const quests: Quest[] = [];

  if (due > 0 || act.reviews > 0) {
    quests.push({ id: "review", title: "Clear your reviews", detail: act.reviews > 0 ? "Review session done" : `${due} due`, done: act.reviews > 0, href: "/review/" });
  } else {
    quests.push({ id: "answer", title: "Answer 5 new exercises", detail: `${Math.min(act.exercises, 5)} of 5`, done: act.exercises >= 5, href: "/learn/" });
  }

  const started = SKILLS.filter((s) => learned(index.exercises[s.id], p) > 0 && mast[s.id] < 100);
  const pool = started.length ? started : SKILLS.slice(0, 1);
  const focus = pool[dayNumber(t) % pool.length];
  const doneToday = index.lessons[focus.id].some((k) => {
    const c = p.lessons[k]?.completed;
    return !!c && dayOf(c) === t;
  });
  quests.push({ id: "focus", title: `Finish a lesson in ${focus.title}`, detail: doneToday ? "Done" : `${focus.title} is at ${mast[focus.id]}%`, done: doneToday, href: `/#${focus.id}` });

  const ready = SKILLS.find((s) => !p.bosses[s.id]?.defeated && learned(index.exercises[s.id], p) >= bossNeeds(index.exercises[s.id].length));
  const beatenToday = SKILLS.find((s) => p.bosses[s.id]?.defeated === t);
  if (beatenToday) quests.push({ id: "boss", title: `Defeat ${beatenToday.boss.name}`, detail: "Defeated", done: true, href: `/boss/${beatenToday.id}/` });
  else if (ready) quests.push({ id: "boss", title: `Defeat ${ready.boss.name}`, detail: `${ready.title} boss`, done: false, href: `/boss/${ready.id}/` });
  else quests.push({ id: "ten", title: "Answer 10 exercises", detail: `${Math.min(act.exercises, 10)} of 10`, done: act.exercises >= 10, href: "/learn/" });

  return quests;
}

/** Days this week (Mon–Sun) with something finished, for the momentum strip. */
export function weekDays(p: Progress): { day: string; n: number }[] {
  const t = today();
  const dow = (parseKey(t).getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(t, i - dow);
    const a = p.activity[day];
    return { day, n: a ? a.exercises + a.lessons + a.reviews : 0 };
  });
}
