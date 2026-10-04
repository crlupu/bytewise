import { z } from "zod";

/**
 * Locks and deadlock: each thread runs a short program of `lock X`,
 * `unlock X`, `trylock X` and plain work steps. The learner chooses which
 * thread runs its next step. A thread waiting for a lock another holds is
 * blocked; when every unfinished thread is blocked, that's a deadlock.
 * `trylock X` models a timed tryLock that backs off: if X is taken, the
 * thread releases everything it holds and starts its program again.
 */

const op = z
  .string()
  .regex(/^((lock|unlock|trylock) [A-Z]|[^]+)$/)
  .min(1);

export const config = z
  .object({
    threads: z
      .array(z.object({ name: z.string().max(12).optional(), ops: z.array(op).min(1).max(10) }).strict())
      .min(2)
      .max(3),
  })
  .strict()
  .superRefine((c, ctx) => {
    c.threads.forEach((t, ti) =>
      t.ops.forEach((o, oi) => {
        const m = o.match(/^unlock ([A-Z])$/);
        if (m && !t.ops.slice(0, oi).some((p) => p === `lock ${m[1]}` || p === `trylock ${m[1]}`))
          ctx.addIssue({ code: "custom", path: ["threads", ti, "ops", oi], message: `unlocks ${m[1]} before locking it` });
      }),
    );
  });

export const goal = z
  .object({
    /** true: reach a deadlock. false is not used; leave it out to ignore. */
    deadlock: z.literal(true).optional(),
    /** Every thread ran to the end. */
    finished: z.literal(true).optional(),
  })
  .strict();

export type Config = z.infer<typeof config>;
export type Goal = z.infer<typeof goal>;

export type State = {
  pcs: number[];
  holders: Record<string, number | null>;
  backoffs: number;
  trace: { thread: number; text: string }[];
};

export const parse = (o: string) => {
  const m = o.match(/^(lock|unlock|trylock) ([A-Z])$/);
  return m ? { kind: m[1] as "lock" | "unlock" | "trylock", lock: m[2] } : { kind: "work" as const, lock: null };
};

export function locksOf(c: Config): string[] {
  const s = new Set<string>();
  c.threads.forEach((t) => t.ops.forEach((o) => parse(o).lock && s.add(parse(o).lock!)));
  return [...s].sort();
}

export const threadName = (c: Config, t: number) => c.threads[t].name ?? `T${t + 1}`;

export function initial(c: Config): State {
  return { pcs: c.threads.map(() => 0), holders: Object.fromEntries(locksOf(c).map((l) => [l, null])), backoffs: 0, trace: [] };
}

/** Why thread t can't step now, or null. */
export function blocked(s: State, c: Config, t: number): string | null {
  const ops = c.threads[t].ops;
  if (s.pcs[t] >= ops.length) return "finished";
  const o = parse(ops[s.pcs[t]]);
  if (o.kind === "lock") {
    const h = s.holders[o.lock!];
    if (h !== null && h !== t) return `waiting for ${o.lock} (held by ${threadName(c, h)})`;
  }
  return null;
}

export function step(s: State, c: Config, t: number): State {
  if (blocked(s, c, t)) return s;
  const o = parse(c.threads[t].ops[s.pcs[t]]);
  const pcs = s.pcs.slice();
  const holders = { ...s.holders };
  const name = threadName(c, t);
  let text = c.threads[t].ops[s.pcs[t]];
  let backoffs = s.backoffs;
  if (o.kind === "lock") holders[o.lock!] = t;
  if (o.kind === "unlock") holders[o.lock!] = null;
  if (o.kind === "trylock") {
    const h = holders[o.lock!];
    if (h !== null && h !== t) {
      // Back off: release everything, start over.
      const released = Object.keys(holders).filter((l) => holders[l] === t);
      released.forEach((l) => (holders[l] = null));
      pcs[t] = 0;
      backoffs++;
      return {
        pcs,
        holders,
        backoffs,
        trace: [...s.trace, { thread: t, text: `trylock ${o.lock} failed — ${name} releases ${released.join(", ") || "nothing"} and retries` }],
      };
    }
    holders[o.lock!] = t;
    text = `trylock ${o.lock} succeeded`;
  }
  pcs[t]++;
  return { pcs, holders, backoffs, trace: [...s.trace, { thread: t, text }] };
}

export const finished = (s: State, c: Config) => s.pcs.every((pc, t) => pc >= c.threads[t].ops.length);

export function deadlocked(s: State, c: Config): boolean {
  if (finished(s, c)) return false;
  return s.pcs.every((_, t) => {
    const b = blocked(s, c, t);
    return b !== null;
  });
}

export function check(g: Goal, s: State, c: Config): { met: boolean; why?: string } {
  if (g.deadlock && !deadlocked(s, c)) return { met: false, why: "No deadlock yet — some thread can still make progress." };
  if (g.finished && !finished(s, c))
    return { met: false, why: deadlocked(s, c) ? "The threads are deadlocked, so they can never finish. Reset and try another order." : "Run every thread to the end." };
  return { met: true };
}
