import { SessionView } from "@/components/SessionView";
import { getAllLessons, getCatalog } from "@/lib/content";
import { lessonTitles } from "@/lib/titles";
import { isExercise, type ExerciseStep } from "@/lib/types";

/** A review session needs every exercise, since any of them may be due. */
export default async function SessionPage() {
  const steps: Record<string, ExerciseStep> = {};
  for (const l of await getAllLessons()) for (const s of l.body) if (isExercise(s)) steps[s.key] = s;
  return <SessionView steps={steps} titles={lessonTitles(await getCatalog())} />;
}
