import { notFound } from "next/navigation";
import { CourseView } from "@/components/CourseView";
import { getCatalog } from "@/lib/content";
import { lessonTitles } from "@/lib/titles";

export async function generateStaticParams() {
  const cat = await getCatalog();
  return cat.topics.flatMap((t) => t.courses.map((c) => ({ courseId: c.id })));
}

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const cat = await getCatalog();
  const topic = cat.topics.find((t) => t.courses.some((c) => c.id === courseId));
  const course = topic?.courses.find((c) => c.id === courseId);
  if (!topic || !course) notFound();
  return <CourseView course={course} topicTitle={topic.title} titles={lessonTitles(cat)} books={cat.books} />;
}
