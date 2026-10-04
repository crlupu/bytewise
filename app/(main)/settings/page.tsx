import { SettingsView } from "@/components/SettingsView";
import { getCatalog } from "@/lib/content";

export default async function SettingsPage() {
  const cat = await getCatalog();
  const courses = cat.topics.flatMap((t) => t.courses);
  return (
    <SettingsView
      counts={{ topics: cat.topics.length, courses: courses.length, lessons: courses.reduce((n, c) => n + c.lessons.length, 0) }}
    />
  );
}
