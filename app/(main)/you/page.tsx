import { YouView } from "@/components/YouView";
import { getAllLessons } from "@/lib/content";
import { buildSkillIndex } from "@/lib/skills";

export default async function YouPage() {
  return <YouView index={buildSkillIndex(await getAllLessons())} />;
}
