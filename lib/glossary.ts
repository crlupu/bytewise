/**
 * Glossary tooltips. At build time, the first mention of each glossary term in
 * a step's text is wrapped in a button carrying the term's definition;
 * components/TermTips.tsx shows it when tapped or hovered.
 */
import type { Html } from "./types";

export type GlossaryEntry = { id: string; term: string; aliases: string[]; code: boolean; def: Html; book?: string };

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
const decode = (s: string) => s.replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e]);
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot", "'": "#39" }[c]};`);
const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Elements whose text is never annotated: code blocks, links, buttons, existing terms. */
const SKIP = new Set(["pre", "a", "button", "code", "h1", "h2", "h3", "h4", "h5", "h6"]);

export function makeAnnotator(entries: GlossaryEntry[], bookTitle: (id: string) => string | undefined) {
  // Longest names first, so "lock striping" wins over "lock".
  const names = entries
    .flatMap((e) => [e.term, ...e.aliases].map((name) => ({ name, e })))
    .sort((a, b) => b.name.length - a.name.length);
  const prose = names.filter((n) => !n.e.code);
  const byLower = new Map(prose.map((n) => [n.name.toLowerCase(), n.e]));
  // Inline code matches a code-only term exactly, or any other term ignoring case.
  const byCode = new Map(names.filter((n) => n.e.code).map((n) => [n.name, n.e]));

  // Apostrophes may be straight or curly; plurals add s or es.
  const alt = prose.map((n) => reEscape(n.name).replace(/'/g, "['’]")).join("|");
  const pattern = new RegExp(`(?<![\\w-])(?:${alt})(?:e?s)?(?![\\w-])`, "gi");

  const lookup = (match: string) => {
    const m = match.toLowerCase().replace(/’/g, "'");
    return byLower.get(m) ?? byLower.get(m.replace(/s$/, "")) ?? byLower.get(m.replace(/es$/, ""));
  };

  const button = (e: GlossaryEntry, inner: Html) => {
    const book = e.book && bookTitle(e.book);
    return (
      `<button type="button" class="term" aria-expanded="false" data-term="${escape(e.term)}" data-def="${escape(e.def)}"` +
      `${book ? ` data-book="${escape(book)}"` : ""}>${inner}</button>`
    );
  };

  /** Annotates `html`, skipping terms already in `used`, and adds the ones it marks. */
  function annotate(html: Html, used: Set<string>): Html {
    const parts = html.split(/(<[^>]+>)/);
    const stack: string[] = [];
    let out = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith("<")) {
        const tag = /^<\/?([a-zA-Z0-9]+)/.exec(part)?.[1]?.toLowerCase();
        // Inline code that is exactly a term: wrap the whole <code>…</code>.
        if (part === "<code>" && !stack.some((t) => SKIP.has(t)) && parts[i + 2] === "</code>") {
          const text = decode(parts[i + 1]).replace(/\(\)$/, "");
          const e = byCode.get(text) ?? byLower.get(text.toLowerCase());
          if (e && !used.has(e.id)) {
            used.add(e.id);
            out += button(e, `<code>${parts[i + 1]}</code>`);
            i += 2;
            continue;
          }
        }
        if (tag && !part.endsWith("/>") && !/^<(br|hr|img|input)\b/i.test(part)) {
          if (part.startsWith("</")) {
            const at = stack.lastIndexOf(tag);
            if (at >= 0) stack.length = at;
          } else stack.push(tag);
        }
        out += part;
        continue;
      }
      if (!part || stack.some((t) => SKIP.has(t)) || !alt) {
        out += part;
        continue;
      }
      const text = decode(part);
      let last = 0;
      let res = "";
      for (const m of text.matchAll(pattern)) {
        const e = lookup(m[0]);
        if (!e || used.has(e.id)) continue;
        used.add(e.id);
        res += escape(text.slice(last, m.index)) + button(e, escape(m[0]));
        last = m.index + m[0].length;
      }
      out += last ? res + escape(text.slice(last)) : part;
    }
    return out;
  }

  const byId = new Map(entries.map((e) => [e.id, e]));
  /** A standalone button for a term, for the "Key terms" row. */
  const chip = (id: string) => {
    const e = byId.get(id)!;
    return button(e, escape(e.term));
  };
  return { annotate, chip };
}

export type Annotator = ReturnType<typeof makeAnnotator>;
