import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { getCatalog } from "@/lib/content";

/** The sections: tab bar on phones, sidebar on desktops. */
export default async function MainLayout({ children }: { children: ReactNode }) {
  const catalog = await getCatalog();
  const exerciseKeys = catalog.topics.flatMap((t) => t.courses.flatMap((c) => c.lessons.flatMap((l) => l.exercises)));
  return <Shell exerciseKeys={exerciseKeys}>{children}</Shell>;
}
