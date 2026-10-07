import { notFound } from "next/navigation";
import { TopicView } from "@/components/TopicView";
import { getCatalog } from "@/lib/content";

export async function generateStaticParams() {
  const cat = await getCatalog();
  return cat.topics.map((t) => ({ topicId: t.id }));
}

export default async function TopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  const cat = await getCatalog();
  const topic = cat.topics.find((t) => t.id === topicId);
  if (!topic) notFound();
  return <TopicView topic={topic} books={cat.books} />;
}
