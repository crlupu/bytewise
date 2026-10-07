import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { Marked } from "marked";
import { createHighlighter, type Highlighter } from "shiki";
import type { z } from "zod";
import { BooksFile, CourseFile, GlossaryFile, LessonFile, STEP_SCHEMAS, TopicFile, type RawStep } from "@/lib/schema";
import { makeAnnotator, type Annotator, type GlossaryEntry } from "@/lib/glossary";
import type { Book, Catalog, CourseMeta, Html, Lesson, LessonMeta, Option, Step, TopicMeta } from "@/lib/types";

/**
 * Reads every file under content/, validates it and renders it.
 *
 * This runs only at build time (and in `next dev`): pages call it from server
 * components, and the static export bakes the result into HTML and props.
 * Adding a lesson is adding a YAML file — no application code changes.
 *
 * Any problem stops the build with every error found, each naming its file
 * and field, e.g. `content/networking/tcp/handshake.yaml: steps[2].options: …`.
 */

const ROOT = path.join(process.cwd(), "content");
const LANGS = ["java", "sql", "c", "python", "bash", "javascript", "typescript", "json", "yaml", "http", "text"];

export class ContentError extends Error {
  constructor(public problems: string[]) {
    super(`Invalid lesson content:\n  - ${problems.join("\n  - ")}`);
    this.name = "ContentError";
  }
}

function fieldPath(p: (string | number)[]): string {
  return p.reduce<string>((acc, k) => (typeof k === "number" ? `${acc}[${k}]` : acc ? `${acc}.${k}` : k), "") || "(file)";
}

function issues(file: string, error: z.ZodError, prefix: (string | number)[] = []): string[] {
  return error.issues.map((i) => `${rel(file)}: ${fieldPath([...prefix, ...i.path])}: ${i.message}`);
}

const rel = (f: string) => path.relative(process.cwd(), f);

function readYaml(file: string, problems: string[]): unknown {
  try {
    return YAML.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    problems.push(`${rel(file)}: ${(e as Error).message.split("\n")[0]}`);
    return undefined;
  }
}

// ---- Rendering ----

let highlighter: Promise<Highlighter> | null = null;
function getHighlighter() {
  highlighter ??= createHighlighter({ themes: ["github-light", "github-dark"], langs: LANGS });
  return highlighter;
}

function makeRenderer(hl: Highlighter) {
  const highlight = (code: string, lang: string | undefined) =>
    hl.codeToHtml(code.replace(/\n$/, ""), {
      lang: lang && LANGS.includes(lang) ? lang : "text",
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    });
  const marked = new Marked({
    gfm: true,
    renderer: {
      code({ text, lang }) {
        return highlight(text, lang);
      },
      link({ href, text }) {
        const external = /^https?:/.test(href);
        return `<a href="${href}"${external ? ' target="_blank" rel="noreferrer"' : ""}>${text}</a>`;
      },
    },
  });
  return {
    block: (s: string): Html => marked.parse(s.trim(), { async: false }) as string,
    inline: (s: string): Html => marked.parseInline(s.trim(), { async: false }) as string,
    /** Idea slides: one short sentence per line, each shown as its own paragraph. */
    slide: (s: string): Html => marked.parse(sentencesToParagraphs(s.trim()), { async: false }) as string,
    code: highlight,
  };
}

type Render = ReturnType<typeof makeRenderer>;

/** Puts a blank line between consecutive lines of prose — not inside code fences, tables or lists. */
function sentencesToParagraphs(md: string): string {
  const out: string[] = [];
  let fenced = false;
  const prose = (l: string | undefined) => !!l && l.trim() !== "" && !/^\s*(\||[-*+] |\d+\. |>|```)/.test(l);
  for (const line of md.split("\n")) {
    if (line.startsWith("```")) fenced = !fenced;
    else if (!fenced && prose(line) && prose(out[out.length - 1])) out.push("");
    out.push(line);
  }
  return out.join("\n");
}

// ---- Deterministic shuffles ----
// The pages are pre-rendered, so the shuffled order must be the same on the
// server and in the browser: it's seeded from the step's key.

function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded random order — possibly the identity, unlike `shuffled`. */
function permutation(n: number, seed: string): number[] {
  const rnd = seeded(seed);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function shuffled(n: number, seed: string): number[] {
  const rnd = seeded(seed);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let attempt = 0; attempt < 10; attempt++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.some((v, i) => v !== i)) return order;
  }
  return order.reverse();
}

// ---- Steps ----

/** Marks glossary terms: once per step, counting everything shown together. */
function annotateStep(step: Step, { annotate, chip }: Annotator) {
  const used = new Set<string>();
  if (step.type === "explanation") {
    step.body = annotate(step.body, used);
    return;
  }
  step.prompt = annotate(step.prompt, used);
  if (step.type === "widget" && step.question) step.question.prompt = annotate(step.question.prompt, used);
  // Answers are buttons themselves, so terms in them can't be; they're listed
  // under the question instead.
  const answers: Html[] =
    step.type === "match"
      ? [...step.left, ...step.right]
      : step.type === "order"
        ? step.items
        : step.type === "blank"
          ? []
          : ((step.type === "widget" ? step.question?.options : step.options) ?? []).map((o) => o.html);
  if (step.type === "blank" && !step.code)
    for (const p of step.parts) if ("text" in p && p.html) p.html = annotate(p.html, used);
  const before = new Set(used);
  answers.forEach((h) => annotate(h, used));
  const key = [...used].filter((id) => !before.has(id));
  if (key.length) step.terms = key.map(chip);
  step.hints = step.hints.map((h) => annotate(h, used));
  if (step.explanation) step.explanation = annotate(step.explanation, used);
  // Only one piece of feedback shows at a time, so each gets its own count.
  const alone = (html: Html) => annotate(html, new Set(used));
  if (step.feedback) step.feedback = alone(step.feedback);
  const opts = step.type === "widget" ? step.question?.options : "options" in step ? step.options : undefined;
  for (const o of opts ?? []) if (o.feedback) o.feedback = alone(o.feedback);
}

function renderStep(raw: RawStep, index: number, lessonKey: string, r: Render): Step {
  const id = raw.id ?? `step-${index + 1}`;
  const key = `${lessonKey}/${id}`;
  if (raw.type === "explanation") return { type: "explanation", id, key, title: raw.title, body: r.slide(raw.body) };

  const base = {
    id,
    key,
    prompt: r.block(raw.prompt),
    explanation: raw.explanation ? r.block(raw.explanation) : undefined,
    feedback: raw.feedback ? r.block(raw.feedback) : undefined,
    hints: raw.hints.map(r.block),
  };
  // Authors tend to write the right answer first, so options are shown in a
  // seeded random order — or in ascending order when they're all numbers,
  // which reads more naturally.
  const options = (os: { text: string; correct: boolean; feedback?: string }[], seed = key): Option[] => {
    const nums = os.map((o) => Number(o.text.replace(/[`%,]/g, "").trim()));
    const order = nums.every((n) => Number.isFinite(n) && /\d/.test(String(n)))
      ? os.map((_, i) => i).sort((a, b) => nums[a] - nums[b])
      : permutation(os.length, seed);
    return order.map((i) => {
      const o = os[i];
      return { html: r.inline(o.text), correct: o.correct, feedback: o.feedback ? r.block(o.feedback) : undefined };
    });
  };

  switch (raw.type) {
    case "choice":
      return {
        ...base,
        type: "choice",
        code: raw.code ? r.code(raw.code, raw.language) : undefined,
        options: options(raw.options),
        multiple: raw.options.filter((o) => o.correct).length > 1,
      };
    case "predict":
      return {
        ...base,
        type: "predict",
        code: raw.code ? r.code(raw.code, raw.language) : undefined,
        answers: raw.answer === undefined ? undefined : Array.isArray(raw.answer) ? raw.answer : [raw.answer],
        options: raw.options ? options(raw.options) : undefined,
        caseSensitive: raw.caseSensitive,
        wrong: raw.wrong.map((w) => ({ answer: w.answer, feedback: r.block(w.feedback) })),
      };
    case "order":
      return { ...base, type: "order", items: raw.items.map(r.inline), start: shuffled(raw.items.length, key) };
    case "match":
      return {
        ...base,
        type: "match",
        left: raw.pairs.map((p) => r.inline(p.left)),
        right: raw.pairs.map((p) => r.inline(p.right)),
        rightOrder: shuffled(raw.pairs.length, key),
      };
    case "blank": {
      const parts = raw.template.split(/\[\[([^\]]+)\]\]/).map((s, i) => {
        if (i % 2 === 0) {
          if (raw.code) return { text: s };
          // Inline Markdown for prose, keeping the spaces that sit against the blanks.
          const lead = s.match(/^\s*/)![0];
          const trail = s.slice(lead.length).match(/\s*$/)![0];
          const core = s.trim();
          return { text: s, html: core ? lead + r.inline(core) + trail : s };
        }
        const answers = s.split("|").map((a) => a.trim());
        return { answers, size: Math.max(3, ...answers.map((a) => a.length)) };
      });
      return { ...base, type: "blank", parts: parts.filter((p) => !("text" in p) || p.text), code: raw.code, caseSensitive: raw.caseSensitive };
    }
    case "widget":
      return {
        ...base,
        type: "widget",
        widget: raw.widget,
        // The widget's own schema fills in defaults.
        config: raw.config,
        goal: raw.goal,
        question: raw.question
          ? {
              prompt: r.block(raw.question.prompt),
              options: options(raw.question.options, `${key}:question`),
              multiple: raw.question.options.filter((o) => o.correct).length > 1,
            }
          : undefined,
      };
  }
}

// ---- Loading ----

type Loaded = { catalog: Catalog; lessons: Map<string, Lesson> };

let cache: Promise<Loaded> | null = null;

export function loadContent(): Promise<Loaded> {
  // In development the files change under us; read them fresh each time.
  if (process.env.NODE_ENV === "development") return load();
  cache ??= load();
  return cache;
}

async function load(): Promise<Loaded> {
  const r = makeRenderer(await getHighlighter());
  const problems: string[] = [];
  const topics: TopicMeta[] = [];
  const lessons = new Map<string, Lesson>();
  const courseIds = new Map<string, string>();
  const order = new Map<string, number>();
  // Where each lesson sits in its course file, and which lessons failed to
  // load — so a prerequisite error names the right line, and a broken lesson
  // isn't reported a second time as missing.
  const entryIndex = new Map<string, number>();
  const declared = new Set<string>();

  const booksFile = path.join(ROOT, "books.yaml");
  const books: Record<string, Book> = {};
  if (fs.existsSync(booksFile)) {
    const bp = BooksFile.safeParse(readYaml(booksFile, problems) ?? {});
    if (bp.success) for (const [bid, b] of Object.entries(bp.data)) books[bid] = { id: bid, ...b };
    else problems.push(...issues(booksFile, bp.error));
  }

  const glossaryFile = path.join(ROOT, "glossary.yaml");
  const glossary: GlossaryEntry[] = [];
  if (fs.existsSync(glossaryFile)) {
    const gp = GlossaryFile.safeParse(readYaml(glossaryFile, problems) ?? {});
    if (!gp.success) problems.push(...issues(glossaryFile, gp.error));
    else {
      const seen = new Map<string, string>();
      for (const [group, entries] of Object.entries(gp.data)) {
        if (group !== "general" && !books[group]) problems.push(`${rel(glossaryFile)}: ${group}: no such book in books.yaml`);
        for (const e of entries) {
          for (const name of [e.term, ...e.aliases]) {
            const k = name.toLowerCase();
            if (seen.has(k)) problems.push(`${rel(glossaryFile)}: "${name}" is listed under both ${seen.get(k)} and ${e.term}`);
            seen.set(k, e.term);
          }
          glossary.push({ ...e, id: `${group}:${e.term}`, def: r.inline(e.def), book: group === "general" ? undefined : group });
        }
      }
    }
  }
  // Each topic explains the terms of the books its lessons cite, so a term
  // like "index" means a database index only in database lessons.
  const glossaryBooks = new Map<string, Set<string>>();

  const topicDirs = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const topicId of topicDirs) {
    const topicFile = path.join(ROOT, topicId, "topic.yaml");
    if (!fs.existsSync(topicFile)) {
      problems.push(`${rel(topicFile)}: missing (every topic folder needs a topic.yaml)`);
      continue;
    }
    const tp = TopicFile.safeParse(readYaml(topicFile, problems));
    if (!tp.success) {
      problems.push(...issues(topicFile, tp.error));
      continue;
    }
    const topic: TopicMeta = { id: topicId, title: tp.data.title, summary: tp.data.summary, mark: tp.data.mark, courses: [] };
    order.set(topicId, tp.data.order);
    glossaryBooks.set(topicId, new Set(["general", ...tp.data.glossary]));
    tp.data.glossary.forEach((b, bi) => {
      if (!books[b]) problems.push(`${rel(topicFile)}: glossary[${bi}]: no book "${b}" in ${rel(booksFile)}`);
    });

    tp.data.courses.forEach((courseId, ci) => {
      const courseFile = path.join(ROOT, topicId, courseId, "course.yaml");
      if (!fs.existsSync(courseFile)) {
        problems.push(`${rel(topicFile)}: courses[${ci}]: no course at ${rel(courseFile)}`);
        return;
      }
      if (courseIds.has(courseId)) {
        problems.push(`${rel(courseFile)}: course id "${courseId}" is also used in ${courseIds.get(courseId)}`);
        return;
      }
      courseIds.set(courseId, rel(courseFile));
      const cp = CourseFile.safeParse(readYaml(courseFile, problems));
      if (!cp.success) {
        problems.push(...issues(courseFile, cp.error));
        return;
      }
      const course: CourseMeta = { id: courseId, topicId, title: cp.data.title, summary: cp.data.summary, lessons: [] };

      cp.data.lessons.forEach((entry, li) => {
        const { id: lessonId, requires } = typeof entry === "string" ? { id: entry, requires: [] } : entry;
        const lessonFile = path.join(ROOT, topicId, courseId, `${lessonId}.yaml`);
        entryIndex.set(`${courseId}/${lessonId}`, li);
        declared.add(`${courseId}/${lessonId}`);
        if (!fs.existsSync(lessonFile)) {
          problems.push(`${rel(courseFile)}: lessons[${li}]: no lesson file at ${rel(lessonFile)}`);
          return;
        }
        const raw = readYaml(lessonFile, problems);
        const lp = LessonFile.safeParse(raw);
        if (!lp.success) {
          problems.push(...issues(lessonFile, lp.error));
          return;
        }
        lp.data.sources.forEach((src, si) => {
          if (!books[src.book])
            problems.push(`${rel(lessonFile)}: sources[${si}].book: no book "${src.book}" in ${rel(booksFile)}`);
        });
        const key = `${courseId}/${lessonId}`;
        const steps: RawStep[] = [];
        const ids = new Set<string>();
        lp.data.steps.forEach((s, si) => {
          const sp = STEP_SCHEMAS[s.type].safeParse(s);
          if (!sp.success) {
            problems.push(...issues(lessonFile, sp.error, ["steps", si]));
            return;
          }
          const step = sp.data as RawStep;
          if (step.id) {
            if (ids.has(step.id)) problems.push(`${rel(lessonFile)}: steps[${si}].id: duplicate step id "${step.id}"`);
            ids.add(step.id);
          }
          steps.push(step);
        });
        if (steps.length !== lp.data.steps.length) return;
        // A lesson teaches two or three main ideas, each on its own slide.
        const ideas = steps.filter((s) => s.type === "explanation").length;
        if (ideas < 2 || ideas > 3)
          problems.push(`${rel(lessonFile)}: steps: has ${ideas} explanation slides; a lesson needs 2–3, one per main idea`);

        let body: Step[];
        try {
          body = steps.map((s, i) => renderStep(s, i, key, r));
        } catch (e) {
          problems.push(`${rel(lessonFile)}: ${(e as Error).message}`);
          return;
        }
        const meta: LessonMeta = {
          id: lessonId,
          courseId,
          topicId,
          key,
          title: lp.data.title,
          summary: lp.data.summary,
          duration: lp.data.duration,
          tags: lp.data.tags,
          sources: lp.data.sources,
          requires: requires.map((q) => (q.includes("/") ? q : `${courseId}/${q}`)),
          steps: body.length,
          stepKeys: body.map((s) => s.key),
          exercises: body.filter((s) => s.type !== "explanation").map((s) => s.key),
        };
        course.lessons.push(meta);
        lessons.set(key, { ...meta, body });
      });
      topic.courses.push(course);
    });
    topics.push(topic);
  }

  // Prerequisites must name real lessons.
  for (const t of topics)
    for (const c of t.courses)
      c.lessons.forEach((l) =>
        l.requires.forEach((q, qi) => {
          if (!declared.has(q))
            problems.push(`${courseIds.get(c.id)}: lessons[${entryIndex.get(l.key)}].requires[${qi}]: no lesson "${q}"`);
        }),
      );

  if (problems.length) throw new ContentError(problems);
  addBlankChoices(lessons);
  for (const l of lessons.values()) for (const src of l.sources) glossaryBooks.get(l.topicId)?.add(src.book);
  const annotators = new Map<string, ReturnType<typeof makeAnnotator>>();
  for (const l of lessons.values()) {
    const scope = glossaryBooks.get(l.topicId) ?? new Set(["general"]);
    if (!annotators.has(l.topicId))
      annotators.set(l.topicId, makeAnnotator(glossary.filter((e) => scope.has(e.book ?? "general")), (b) => books[b]?.title));
    l.body.forEach((s) => annotateStep(s, annotators.get(l.topicId)!));
  }
  topics.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return { catalog: { topics, books }, lessons };
}

export async function getCatalog(): Promise<Catalog> {
  return (await loadContent()).catalog;
}

export async function getLesson(courseId: string, lessonId: string): Promise<Lesson | undefined> {
  return (await loadContent()).lessons.get(`${courseId}/${lessonId}`);
}

export async function getAllLessons(): Promise<Lesson[]> {
  return [...(await loadContent()).lessons.values()];
}

/**
 * Blanks are answered by tapping one of a few words rather than typing.
 * The wrong choices are other blanks' answers — from the same course where
 * possible, then the same topic, then anywhere — so they're plausible
 * vocabulary, and code blanks draw on code while prose draws on prose.
 */
function addBlankChoices(lessons: Map<string, Lesson>) {
  type Entry = { answer: string; course: string; topic: string; code: boolean };
  const pool: Entry[] = [];
  for (const l of lessons.values())
    for (const s of l.body)
      if (s.type === "blank")
        for (const p of s.parts) if ("answers" in p) pool.push({ answer: p.answers[0], course: l.courseId, topic: l.topicId, code: s.code });

  const norm = (x: string) => x.trim().toLowerCase();
  for (const l of lessons.values())
    for (const s of l.body) {
      if (s.type !== "blank") continue;
      s.parts.forEach((p, pi) => {
        if (!("answers" in p)) return;
        const accepted = new Set(p.answers.map(norm));
        const seed = `${s.key}:${pi}`;
        const picked: string[] = [];
        const tiers = [
          (e: Entry) => e.course === l.courseId && e.code === s.code,
          (e: Entry) => e.topic === l.topicId && e.code === s.code,
          (e: Entry) => e.code === s.code,
          () => true,
        ];
        for (const [ti, tier] of tiers.entries()) {
          const candidates = [...new Set(pool.filter(tier).map((e) => e.answer))].filter(
            (a) => !accepted.has(norm(a)) && !picked.some((x) => norm(x) === norm(a)),
          );
          for (const i of permutation(candidates.length, `${seed}:${ti}`)) {
            if (picked.length >= 3) break;
            picked.push(candidates[i]);
          }
          if (picked.length >= 3) break;
        }
        const choices = [p.answers[0], ...picked];
        p.choices = permutation(choices.length, seed).map((i) => choices[i]);
      });
    }
}
