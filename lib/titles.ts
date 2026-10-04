import type { Catalog } from "@/lib/types";

/** Lesson titles by key, for pages that name lessons they don't otherwise need. */
export function lessonTitles(cat: Catalog): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of cat.topics) for (const c of t.courses) for (const l of c.lessons) out[l.key] = l.title;
  return out;
}
