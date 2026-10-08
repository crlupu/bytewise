import { notFound } from "next/navigation";
import { BossView } from "@/components/BossView";
import { getAllLessons, getCatalog } from "@/lib/content";
import { SKILLS, buildSkillIndex } from "@/lib/skills";
import { lessonTitles } from "@/lib/titles";
import { isExercise, type ExerciseStep } from "@/lib/types";

export function generateStaticParams() {
  return SKILLS.map((s) => ({ skill: s.id }));
}

/** A boss battle draws on every exercise of its skill. */
export default async function BossPage({ params }: { params: Promise<{ skill: string }> }) {
  const { skill } = await params;
  if (!SKILLS.some((s) => s.id === skill)) notFound();
  const lessons = await getAllLessons();
  const keys = new Set(buildSkillIndex(lessons).exercises[skill]);
  const steps: Record<string, ExerciseStep> = {};
  for (const l of lessons) for (const s of l.body) if (isExercise(s) && keys.has(s.key)) steps[s.key] = s;
  return <BossView skillId={skill} steps={steps} titles={lessonTitles(await getCatalog())} />;
}
