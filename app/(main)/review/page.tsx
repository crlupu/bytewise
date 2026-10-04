import { ReviewView } from "@/components/ReviewView";
import { getCatalog } from "@/lib/content";
import { lessonTitles } from "@/lib/titles";

export default async function ReviewPage() {
  const cat = await getCatalog();
  const keys = cat.topics.flatMap((t) => t.courses.flatMap((c) => c.lessons.flatMap((l) => l.exercises)));
  return <ReviewView exerciseKeys={keys} titles={lessonTitles(cat)} />;
}
