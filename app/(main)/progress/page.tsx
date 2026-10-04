import { ProgressView } from "@/components/ProgressView";
import { getCatalog } from "@/lib/content";
import { lessonTitles } from "@/lib/titles";

export default async function ProgressPage() {
  const cat = await getCatalog();
  return <ProgressView catalog={cat} titles={lessonTitles(cat)} />;
}
