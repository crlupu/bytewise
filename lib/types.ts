/**
 * Content as the app sees it: validated, with Markdown already rendered to
 * HTML and code already highlighted. Built by lib/content.ts at build time
 * and handed to client components as props.
 */

export type Html = string;

export type Option = { html: Html; correct: boolean; feedback?: Html };

type ExerciseBase = {
  id: string;
  /** course/lesson/step: the step's identity in progress and review. */
  key: string;
  prompt: Html;
  explanation?: Html;
  /** A rendered class or object diagram, shown under the prompt. */
  diagram?: Html;
  /** The deeper explanation behind "Explain in detail", shown once answered. */
  details?: Html;
  feedback?: Html;
  hints: Html[];
  /** Glossary terms used in the answers, as buttons to show under the question. */
  terms?: Html[];
};

export type ExplanationStep = { type: "explanation"; id: string; key: string; title?: string; body: Html; diagram?: Html };

export type ChoiceStep = ExerciseBase & { type: "choice"; code?: Html; options: Option[]; multiple: boolean };

export type PredictStep = ExerciseBase & {
  type: "predict";
  code?: Html;
  /** Typed answers that count as correct; absent when `options` is set. */
  answers?: string[];
  options?: Option[];
  caseSensitive: boolean;
  wrong: { answer: string; feedback: Html }[];
};

export type OrderStep = ExerciseBase & {
  type: "order";
  /** In the correct order. */
  items: Html[];
  /** The order they're first shown in (indexes into `items`). */
  start: number[];
};

export type MatchStep = ExerciseBase & {
  type: "match";
  /** left[i] goes with right[i]. */
  left: Html[];
  right: Html[];
  /** The order the right-hand items are shown in. */
  rightOrder: number[];
};

/** Text between blanks keeps its raw form; `html` is set when the template is prose, rendered as inline Markdown. */
export type BlankPart = { text: string; html?: string } | { answers: string[]; size: number; /** Words offered to tap, the right one among them. */ choices?: string[] };
export type BlankStep = ExerciseBase & { type: "blank"; parts: BlankPart[]; code: boolean; caseSensitive: boolean };

export type WidgetStep = ExerciseBase & {
  type: "widget";
  widget: string;
  config: Record<string, unknown>;
  goal?: Record<string, unknown>;
  question?: { prompt: Html; options: Option[]; multiple: boolean };
};

export type ExerciseStep = ChoiceStep | PredictStep | OrderStep | MatchStep | BlankStep | WidgetStep;
export type Step = ExplanationStep | ExerciseStep;

export type Book = { id: string; title: string; authors: string; edition?: string; year: number; url?: string };

/** A book a lesson draws on, and where in it to read more. */
export type SourceRef = { book: string; ref: string };

export type LessonMeta = {
  id: string;
  courseId: string;
  topicId: string;
  /** course/lesson */
  key: string;
  title: string;
  summary: string;
  duration: number;
  tags: string[];
  sources: SourceRef[];
  /** Keys of prerequisite lessons. */
  requires: string[];
  steps: number;
  /** Keys of every step, in order. */
  stepKeys: string[];
  /** Keys of the lesson's exercise steps. */
  exercises: string[];
};

export type Lesson = LessonMeta & { body: Step[] };

export type CourseMeta = { id: string; topicId: string; title: string; summary: string; lessons: LessonMeta[] };
export type TopicMeta = { id: string; title: string; summary: string; mark?: string; courses: CourseMeta[] };
export type Catalog = { topics: TopicMeta[]; books: Record<string, Book> };

export const isExercise = (s: Step): s is ExerciseStep => s.type !== "explanation";
