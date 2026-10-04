import type { Book, SourceRef } from "@/lib/types";
import { ReadIcon } from "@/components/icons";

/** "Effective Java (3rd ed.) · Joshua Bloch" */
export function bookLine(b: Book) {
  return `${b.title}${b.edition ? ` (${b.edition})` : ""} · ${b.authors}`;
}

/**
 * Where a lesson's ideas come from, as a short list: the book and the
 * chapter or item to read for the full treatment.
 */
export function SourceList({ sources, books, title = "Go deeper" }: { sources: SourceRef[]; books: Record<string, Book>; title?: string }) {
  if (!sources.length) return null;
  return (
    <section className="sources" aria-label={title}>
      <h2 className="group-label">{title}</h2>
      <ul className="list">
        {sources.map((s, i) => {
          const b = books[s.book];
          if (!b) return null;
          const body = (
            <>
              <ReadIcon className="sources__icon" aria-hidden />
              <span className="list-row__body">
                <span className="sources__title">{b.title}</span>
                <span className="list-row__meta" style={{ display: "block" }}>
                  {b.authors}
                  {b.edition ? `, ${b.edition}` : ""} — {s.ref}
                </span>
              </span>
            </>
          );
          return (
            <li key={i}>
              {b.url ? (
                <a className="list-row list-row--icon" href={b.url} target="_blank" rel="noreferrer">
                  {body}
                </a>
              ) : (
                <div className="list-row list-row--icon">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The distinct books a set of lessons draws on, in first-seen order. */
export function booksOf(sources: SourceRef[][], books: Record<string, Book>): Book[] {
  const seen = new Map<string, Book>();
  for (const list of sources) for (const s of list) if (books[s.book] && !seen.has(s.book)) seen.set(s.book, books[s.book]);
  return [...seen.values()];
}
