import type { BlankStep, ChoiceStep, MatchStep, Option, OrderStep, PredictStep } from "@/lib/types";

/**
 * Pure checks for each exercise type. Each returns whether the answer is
 * right and, when it isn't, the most specific feedback authored for it —
 * falling back to the step's general feedback in the caller.
 */

export type Verdict = { correct: boolean; feedback?: string; text?: string };

export function normalise(s: string, caseSensitive: boolean): string {
  const t = s.trim().replace(/\s+/g, " ").replace(/^["'`](.*)["'`]$/, "$1");
  return caseSensitive ? t : t.toLowerCase();
}

export function gradeOptions(options: Option[], picked: number[]): Verdict {
  const want = options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0);
  const correct = want.length === picked.length && want.every((i) => picked.includes(i));
  if (correct) return { correct };
  // The first wrong pick with its own feedback speaks for the answer.
  const wrongPick = picked.find((i) => !options[i].correct && options[i].feedback);
  if (wrongPick !== undefined) return { correct, feedback: options[wrongPick].feedback };
  if (want.length > 1 && picked.every((i) => options[i].correct))
    return { correct, text: `Those are right, but there ${want.length - picked.length === 1 ? "is one more" : "are more"}.` };
  return { correct };
}

export function gradeChoice(step: ChoiceStep, picked: number[]): Verdict {
  return gradeOptions(step.options, picked);
}

export function gradePredict(step: PredictStep, answer: string | number): Verdict {
  if (step.options) return gradeOptions(step.options, typeof answer === "number" ? [answer] : []);
  const given = normalise(String(answer), step.caseSensitive);
  if ((step.answers ?? []).some((a) => normalise(a, step.caseSensitive) === given)) return { correct: true };
  const w = step.wrong.find((w) => normalise(w.answer, step.caseSensitive) === given);
  return { correct: false, feedback: w?.feedback };
}

export function gradeOrder(_step: OrderStep, arrangement: number[]): Verdict & { placed: boolean[] } {
  const placed = arrangement.map((v, i) => v === i);
  const correct = placed.every(Boolean);
  const right = placed.filter(Boolean).length;
  return {
    correct,
    placed,
    text: correct ? undefined : `${right} of ${arrangement.length} are in the right place.`,
  };
}

export function gradeMatch(step: MatchStep, pairs: Record<number, number>): Verdict & { right: boolean[] } {
  const right = step.left.map((_, i) => pairs[i] === i);
  const correct = right.every(Boolean);
  return { correct, right, text: correct ? undefined : `${right.filter(Boolean).length} of ${right.length} pairs are right.` };
}

export function gradeBlank(step: BlankStep, values: string[]): Verdict & { right: boolean[] } {
  const blanks = step.parts.filter((p): p is { answers: string[]; size: number } => "answers" in p);
  const right = blanks.map((b, i) => b.answers.some((a) => normalise(a, step.caseSensitive) === normalise(values[i] ?? "", step.caseSensitive)));
  const correct = right.every(Boolean);
  return {
    correct,
    right,
    text: correct || blanks.length === 1 ? undefined : `${right.filter(Boolean).length} of ${blanks.length} blanks are right.`,
  };
}
