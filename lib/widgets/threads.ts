import { z } from "zod";

/**
 * Thread interleaving: two or three threads each run `count++`, which the JVM
 * carries out as a read, an add and a write. The learner picks which thread
 * runs its next instruction and watches updates get lost — or, with
 * `synchronized`, watches the lock stop that from happening.
 */

export const config = z
  .object({
    threads: z.number().int().min(2).max(3).default(2),
    /** How many times each thread increments. */
    increments: z.number().int().min(1).max(2).default(1),
    synchronized: z.boolean().default(false),
    /** Write with compare-and-swap: succeed only if the variable still holds the value read; otherwise retry. */
    cas: z.boolean().default(false),
    variable: z.string().default("count"),
    initial: z.number().int().default(0),
  })
  .strict();

export const goal = z
  .object({
    /** The shared variable's value once every thread has finished. */
    count: z.number().int().optional(),
    /** At least this many compare-and-swaps failed and retried. */
    retries: z.number().int().min(1).optional(),
  })
  .strict();

export type Config = z.infer<typeof config>;
export type Goal = z.infer<typeof goal>;

export type Op = "lock" | "read" | "add" | "write" | "unlock" | "cas";

export type State = {
  pcs: number[];
  regs: (number | null)[];
  /** The value each thread read, for compare-and-swap. */
  seen?: (number | null)[];
  /** Failed compare-and-swaps so far. */
  retries?: number;
  shared: number;
  lock: number | null;
  trace: { thread: number; op: Op; text: string }[];
};

export function program(c: Config): Op[] {
  const one: Op[] = c.synchronized ? ["lock", "read", "add", "write", "unlock"] : c.cas ? ["read", "add", "cas"] : ["read", "add", "write"];
  return Array.from({ length: c.increments }, () => one).flat();
}

export function opText(op: Op, c: Config): string {
  const v = c.variable;
  switch (op) {
    case "lock":
      return "acquire lock";
    case "read":
      return `tmp = ${v}`;
    case "add":
      return "tmp = tmp + 1";
    case "write":
      return `${v} = tmp`;
    case "unlock":
      return "release lock";
    case "cas":
      return `CAS ${v}: old → tmp`;
  }
}

export function initial(c: Config): State {
  return {
    pcs: Array(c.threads).fill(0),
    regs: Array(c.threads).fill(null),
    seen: Array(c.threads).fill(null),
    retries: 0,
    shared: c.initial,
    lock: null,
    trace: [],
  };
}

/** Why thread `t` can't run now, or null when it can. */
export function blocked(s: State, c: Config, t: number): string | null {
  const prog = program(c);
  if (s.pcs[t] >= prog.length) return "finished";
  if (prog[s.pcs[t]] === "lock" && s.lock !== null && s.lock !== t) return `waiting for the lock (held by T${s.lock + 1})`;
  return null;
}

export function step(s: State, c: Config, t: number): State {
  if (blocked(s, c, t)) return s;
  const op = program(c)[s.pcs[t]];
  const pcs = s.pcs.slice();
  const regs = s.regs.slice();
  const seen = (s.seen ?? Array(c.threads).fill(null)).slice();
  let retries = s.retries ?? 0;
  let { shared, lock } = s;
  pcs[t] += 1;
  let text = opText(op, c);
  if (op === "lock") lock = t;
  if (op === "unlock") lock = null;
  if (op === "read") {
    regs[t] = shared;
    seen[t] = shared;
    text = `tmp = ${c.variable}  → tmp is ${shared}`;
  }
  if (op === "add") {
    regs[t] = (regs[t] ?? 0) + 1;
    text = `tmp = tmp + 1  → tmp is ${regs[t]}`;
  }
  if (op === "write") {
    shared = regs[t] ?? 0;
    text = `${c.variable} = tmp  → ${c.variable} is ${shared}`;
  }
  if (op === "cas") {
    if (shared === seen[t]) {
      shared = regs[t] ?? 0;
      text = `CAS succeeded: ${c.variable} was still ${seen[t]}, now ${shared}`;
    } else {
      // Someone else wrote first: go back and read again.
      retries++;
      pcs[t] -= 3;
      text = `CAS failed: expected ${seen[t]} but ${c.variable} is ${shared} — retry`;
    }
  }
  return { pcs, regs, seen, retries, shared, lock, trace: [...s.trace, { thread: t, op, text }] };
}

export function finished(s: State, c: Config): boolean {
  const n = program(c).length;
  return s.pcs.every((pc) => pc >= n);
}

export function check(g: Goal, s: State, c: Config): { met: boolean; why?: string } {
  if (!finished(s, c)) return { met: false, why: "Run every thread to the end first." };
  if (g.count !== undefined && s.shared !== g.count)
    return { met: false, why: `The threads finished with ${c.variable} = ${s.shared}; the goal is ${g.count}.` };
  if (g.retries !== undefined && (s.retries ?? 0) < g.retries)
    return { met: false, why: `${s.retries ?? 0} CAS ${(s.retries ?? 0) === 1 ? "retry" : "retries"} so far; make at least ${g.retries} happen.` };
  return { met: true };
}
