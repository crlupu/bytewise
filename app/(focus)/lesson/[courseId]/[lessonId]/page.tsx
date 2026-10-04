import { notFound } from "next/navigation";
import { LessonPlayer } from "@/components/LessonPlayer";
import { getCatalog, getLesson } from "@/lib/content";

export async function generateStaticParams() {
  const cat = await getCatalog();
  return cat.topics.flatMap((t) => t.courses.flatMap((c) => c.lessons.map((l) => ({ courseId: c.id, lessonId: l.id }))));
}

export default async function LessonPage({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = await params;
  const lesson = await getLesson(courseId, lessonId);
  const cat = await getCatalog();
  const course = cat.topics.flatMap((t) => t.courses).find((c) => c.id === courseId);
  if (!lesson || !course) notFound();
  const i = course.lessons.findIndex((l) => l.id === lessonId);
  return <LessonPlayer lesson={lesson} courseTitle={course.title} next={course.lessons[i + 1] ?? null} books={cat.books} />;
}
