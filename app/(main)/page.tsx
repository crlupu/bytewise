import { SkillsView } from "@/components/SkillsView";
import { getAllLessons, getCatalog } from "@/lib/content";
import { buildSkillIndex } from "@/lib/skills";

export default async function Home() {
  return <SkillsView catalog={await getCatalog()} index={buildSkillIndex(await getAllLessons())} />;
}
