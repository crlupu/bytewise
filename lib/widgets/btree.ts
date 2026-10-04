import { z } from "zod";

/**
 * A B-tree of a given order (the most children a node may have). Keys are
 * inserted bottom-up: a key goes into its leaf, and a node that overflows
 * splits around its middle key, which moves up into the parent. A root that
 * splits makes a new root — the only way the tree gets taller.
 */

export const config = z
  .object({
    order: z.number().int().min(3).max(6).default(3),
    /** Keys already in the tree when the step opens. */
    initial: z.array(z.number().int()).default([]),
    /** Keys offered one at a time by "Step forward". */
    sequence: z.array(z.number().int()).default([]),
    /** Let the learner type their own keys to insert. */
    custom: z.boolean().default(true),
    /** Offer search as well as insert. */
    search: z.boolean().default(false),
  })
  .strict();

export const goal = z
  .object({
    height: z.number().int().min(1).optional(),
    /** At least this many splits since the step opened. */
    splits: z.number().int().min(1).optional(),
    /** Every one of these keys is in the tree. */
    contains: z.array(z.number().int()).optional(),
    /** The last search looked for this key and found it. */
    found: z.number().int().optional(),
  })
  .strict();

export type Config = z.infer<typeof config>;
export type Goal = z.infer<typeof goal>;

export type Node = { keys: number[]; children: Node[] };

export type State = {
  root: Node;
  splits: number;
  /** Position in `sequence` of the next key to offer. */
  next: number;
  /** Child indexes from the root: the path the last insert or search took. */
  path: number[];
  last: { kind: "insert" | "search"; key: number; found?: boolean; split?: boolean } | null;
  message: string | null;
};

const leaf = (keys: number[] = []): Node => ({ keys, children: [] });

export function height(n: Node): number {
  return n.children.length ? 1 + height(n.children[0]) : 1;
}

export function keys(n: Node): number[] {
  if (!n.children.length) return n.keys.slice();
  const out: number[] = [];
  n.children.forEach((c, i) => {
    out.push(...keys(c));
    if (i < n.keys.length) out.push(n.keys[i]);
  });
  return out;
}

function childIndex(n: Node, key: number): number {
  let i = 0;
  while (i < n.keys.length && key > n.keys[i]) i++;
  return i;
}

type Ins = { node: Node; up?: { left: Node; median: number; right: Node }; splits: number; path: number[] };

function ins(n: Node, key: number, order: number): Ins {
  let node: Node;
  let splits = 0;
  let path: number[] = [];
  if (!n.children.length) {
    const ks = n.keys.slice();
    ks.splice(childIndex(n, key), 0, key);
    node = leaf(ks);
  } else {
    const i = childIndex(n, key);
    const r = ins(n.children[i], key, order);
    splits += r.splits;
    path = [i, ...r.path];
    const ks = n.keys.slice();
    const cs = n.children.slice();
    if (r.up) {
      ks.splice(i, 0, r.up.median);
      cs.splice(i, 1, r.up.left, r.up.right);
      path = [i];
    } else {
      cs[i] = r.node;
    }
    node = { keys: ks, children: cs };
  }
  if (node.keys.length <= order - 1) return { node, splits, path };
  const mid = Math.floor(node.keys.length / 2);
  const hasKids = node.children.length > 0;
  const left: Node = { keys: node.keys.slice(0, mid), children: hasKids ? node.children.slice(0, mid + 1) : [] };
  const right: Node = { keys: node.keys.slice(mid + 1), children: hasKids ? node.children.slice(mid + 1) : [] };
  return { node, up: { left, median: node.keys[mid], right }, splits: splits + 1, path };
}

export function insert(root: Node, key: number, order: number): { root: Node; splits: number; path: number[] } {
  const r = ins(root, key, order);
  if (r.up) return { root: { keys: [r.up.median], children: [r.up.left, r.up.right] }, splits: r.splits, path: [] };
  return { root: r.node, splits: r.splits, path: r.path };
}

export function search(root: Node, key: number): { found: boolean; path: number[]; visited: number } {
  const path: number[] = [];
  let n = root;
  let visited = 1;
  for (;;) {
    if (n.keys.includes(key)) return { found: true, path, visited };
    if (!n.children.length) return { found: false, path, visited };
    const i = childIndex(n, key);
    path.push(i);
    n = n.children[i];
    visited++;
  }
}

export function initial(c: Config): State {
  let root = leaf();
  for (const k of c.initial) if (!keys(root).includes(k)) root = insert(root, k, c.order).root;
  return { root, splits: 0, next: 0, path: [], last: null, message: null };
}

export function doInsert(s: State, c: Config, key: number, fromSequence = false): State {
  const next = fromSequence ? s.next + 1 : s.next;
  if (keys(s.root).includes(key)) {
    return { ...s, next, path: search(s.root, key).path, last: null, message: `${key} is already in the tree; keys are unique.` };
  }
  const r = insert(s.root, key, c.order);
  const split = r.splits > 0;
  return {
    root: r.root,
    splits: s.splits + r.splits,
    next,
    path: r.path,
    last: { kind: "insert", key, split },
    message: split
      ? `Inserted ${key}. A node overflowed and split${r.splits > 1 ? ` (${r.splits} splits)` : ""}${
          height(r.root) > height(s.root) ? " — the root split, so the tree grew a level." : "."
        }`
      : `Inserted ${key} into its leaf.`,
  };
}

export function doSearch(s: State, key: number): State {
  const r = search(s.root, key);
  return {
    ...s,
    path: r.path,
    last: { kind: "search", key, found: r.found },
    message: `${r.found ? "Found" : "Didn't find"} ${key} after visiting ${r.visited} node${r.visited === 1 ? "" : "s"}.`,
  };
}

export function check(g: Goal, s: State): { met: boolean; why?: string } {
  if (g.height !== undefined && height(s.root) !== g.height)
    return { met: false, why: `The tree is ${height(s.root)} level${height(s.root) === 1 ? "" : "s"} tall; the goal is ${g.height}.` };
  if (g.splits !== undefined && s.splits < g.splits)
    return { met: false, why: `${s.splits} split${s.splits === 1 ? "" : "s"} so far; the goal is at least ${g.splits}.` };
  if (g.contains) {
    const have = keys(s.root);
    const missing = g.contains.filter((k) => !have.includes(k));
    if (missing.length) return { met: false, why: `Still missing: ${missing.join(", ")}.` };
  }
  if (g.found !== undefined && !(s.last?.kind === "search" && s.last.key === g.found && s.last.found))
    return { met: false, why: `Search for ${g.found}.` };
  return { met: true };
}
