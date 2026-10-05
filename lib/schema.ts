import { z } from "zod";
import { WIDGET_SCHEMAS } from "@/lib/widgets/registry";

/**
 * The shape of the authored content files under content/.
 *
 * Markdown fields are plain strings here; lib/content.ts renders them to HTML
 * at build time, so the browser never ships a Markdown parser or a
 * highlighter.
 */

const md = z.string().min(1);
const id = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "use lowercase letters, digits and hyphens");

export const TopicFile = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1),
    /** Position on the home screen; lower comes first. */
    order: z.number().int(),
    /** The topic's courses, in the order they are shown. */
    courses: z.array(id).min(1),
    /** Books whose glossary terms are explained here, besides the ones its lessons cite. */
    glossary: z.array(id).default([]),
  })
  .strict();

/** content/books.yaml: the books lessons draw on, by id. */
export const BooksFile = z.record(
  id,
  z
    .object({
      title: z.string().min(1),
      authors: z.string().min(1),
      edition: z.string().optional(),
      year: z.number().int(),
      /** Where to get it, or read it if it's free. */
      url: z.string().url().optional(),
    })
    .strict(),
);

/** A lesson's debt to a book: which one, and where in it to read more. */
const Source = z.object({ book: id, ref: z.string().min(1) }).strict();

export const CourseFile = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1),
    /** The lessons, in order. `requires` names prerequisite lessons, either by
     * id within this course or as course/lesson. */
    lessons: z
      .array(
        z.union([
          id,
          z.object({ id, requires: z.array(z.string().min(1)).default([]) }).strict(),
        ]),
      )
      .min(1),
  })
  .strict();

// ---- Steps ----

/** Fields every exercise may carry. */
const exerciseBase = {
  id: id.optional(),
  /** The question itself. */
  prompt: md,
  /** Shown after a correct answer: why it is correct. */
  explanation: md.optional(),
  /** Shown after a wrong answer when nothing more specific is authored. */
  feedback: md.optional(),
  /** Revealed one at a time on request. */
  hints: z.array(md).default([]),
};

const code = z.string().min(1);
const language = z.string().default("text");

const Explanation = z
  .object({ type: z.literal("explanation"), id: id.optional(), title: z.string().optional(), body: md })
  .strict();

const ChoiceOption = z
  .object({ text: md, correct: z.boolean().default(false), feedback: md.optional() })
  .strict();

const Choice = z
  .object({
    type: z.literal("choice"),
    ...exerciseBase,
    code: code.optional(),
    language,
    options: z.array(ChoiceOption).min(2),
  })
  .strict()
  .refine((s) => s.options.some((o) => o.correct), {
    message: "at least one option must be marked correct: true",
    path: ["options"],
  });

const Predict = z
  .object({
    type: z.literal("predict"),
    ...exerciseBase,
    code: code.optional(),
    language,
    /** The accepted typed answers. Leave out when `options` is given. */
    answer: z.union([z.string(), z.array(z.string()).min(1)]).optional(),
    /** Present: the learner selects; absent: the learner types. */
    options: z.array(ChoiceOption).min(2).optional(),
    caseSensitive: z.boolean().default(false),
    /** Feedback for particular wrong typed answers. */
    wrong: z.array(z.object({ answer: z.string(), feedback: md }).strict()).default([]),
  })
  .strict()
  .refine((s) => (s.answer === undefined) !== (s.options === undefined), {
    message: "give either `answer` (typed) or `options` (selected), not both",
    path: ["answer"],
  })
  .refine((s) => !s.options || s.options.filter((o) => o.correct).length === 1, {
    message: "exactly one option must be correct",
    path: ["options"],
  });

const Order = z
  .object({
    type: z.literal("order"),
    ...exerciseBase,
    /** In the correct order; the learner sees them shuffled. */
    items: z.array(md).min(3),
  })
  .strict();

const Match = z
  .object({
    type: z.literal("match"),
    ...exerciseBase,
    pairs: z.array(z.object({ left: md, right: md }).strict()).min(2),
  })
  .strict()
  // Grading checks each pair by position, so two identical items on one side
  // would make a correct-looking answer count as wrong.
  .superRefine((s, ctx) => {
    for (const side of ["left", "right"] as const) {
      const seen = new Set<string>();
      s.pairs.forEach((p, i) => {
        if (seen.has(p[side])) ctx.addIssue({ code: "custom", path: ["pairs", i, side], message: `duplicate ${side} item; each must be unique` });
        seen.add(p[side]);
      });
    }
  });

const Blank = z
  .object({
    type: z.literal("blank"),
    ...exerciseBase,
    /** Text with blanks written as [[answer]] or [[answer|alternative]]. */
    template: z.string().refine((t) => /\[\[[^\]]+\]\]/.test(t), "needs at least one [[blank]]"),
    /** Show the template as code (monospace, line breaks kept). */
    code: z.boolean().default(false),
    caseSensitive: z.boolean().default(false),
  })
  .strict();

const WidgetQuestion = z
  .object({ prompt: md, options: z.array(ChoiceOption).min(2) })
  .strict()
  .refine((q) => q.options.some((o) => o.correct), {
    message: "at least one option must be marked correct: true",
    path: ["options"],
  });

const Widget = z
  .object({
    type: z.literal("widget"),
    ...exerciseBase,
    widget: z.string(),
    config: z.record(z.unknown()).default({}),
    /** A target state the learner must reach, in the widget's terms. */
    goal: z.record(z.unknown()).optional(),
    /** A question about the simulation, answered once the goal (if any) is met. */
    question: WidgetQuestion.optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    const w = WIDGET_SCHEMAS[s.widget];
    if (!w) {
      ctx.addIssue({
        code: "custom",
        path: ["widget"],
        message: `unknown widget "${s.widget}"; known: ${Object.keys(WIDGET_SCHEMAS).join(", ")}`,
      });
      return;
    }
    if (!s.goal && !s.question) {
      ctx.addIssue({ code: "custom", path: ["goal"], message: "a widget step needs a `goal`, a `question`, or both" });
    }
    const cfg = w.config.safeParse(s.config);
    if (!cfg.success) {
      for (const i of cfg.error.issues) ctx.addIssue({ ...i, path: ["config", ...i.path] });
    }
    if (s.goal) {
      const g = w.goal.safeParse(s.goal);
      if (!g.success) for (const i of g.error.issues) ctx.addIssue({ ...i, path: ["goal", ...i.path] });
    }
  });

/** One schema per step type. Steps are told apart by `type` first, so an
 * error names the fields of the type the author meant. */
export const STEP_SCHEMAS = {
  explanation: Explanation,
  choice: Choice,
  predict: Predict,
  order: Order,
  match: Match,
  blank: Blank,
  widget: Widget,
} as const;

export type StepType = keyof typeof STEP_SCHEMAS;
export type RawStep = { [K in StepType]: z.infer<(typeof STEP_SCHEMAS)[K]> }[StepType];

export const LessonFile = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1),
    /** Estimated minutes. */
    duration: z.number().int().min(1).max(30),
    tags: z.array(z.string()).default([]),
    /** Books the lesson's ideas come from. The lesson is written fresh; these
     * say where the full treatment lives. */
    sources: z.array(Source).default([]),
    /** Each step is checked against its own type's schema by lib/content.ts. */
    steps: z
      .array(z.object({ type: z.enum(Object.keys(STEP_SCHEMAS) as [StepType, ...StepType[]]) }).passthrough())
      .min(5, "a lesson has 5 to 15 steps")
      .max(15, "a lesson has 5 to 15 steps"),
  })
  .strict();

/** content/glossary.yaml: terms grouped by book id (or "general"). */
export const GlossaryFile = z.record(
  id,
  z.array(
    z
      .object({
        term: z.string().min(1),
        aliases: z.array(z.string().min(1)).default([]),
        /** Only match inside inline code: keywords and class names. */
        code: z.boolean().default(false),
        def: md,
      })
      .strict(),
  ),
);

export type BooksFileT = z.infer<typeof BooksFile>;
export type TopicFileT = z.infer<typeof TopicFile>;
export type CourseFileT = z.infer<typeof CourseFile>;
export type LessonFileT = z.infer<typeof LessonFile>;
