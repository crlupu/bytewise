import { z } from "zod";

/**
 * Page replacement: a reference string played against a fixed number of
 * frames, under FIFO, LRU or the optimal (Bélády) policy. The whole run is
 * computed up front; stepping only moves through it.
 */

export const ALGORITHMS = ["FIFO", "LRU", "OPT"] as const;
export type Algorithm = (typeof ALGORITHMS)[number];

export const config = z
  .object({
    reference: z.array(z.number().int().min(0).max(99)).min(3).max(24),
    frames: z.number().int().min(1).max(7).default(3),
    /** Frame counts the learner may switch between; leave out to fix `frames`. */
    frameChoices: z.array(z.number().int().min(1).max(7)).optional(),
    algorithms: z.array(z.enum(ALGORITHMS)).min(1).default(["FIFO", "LRU", "OPT"]),
  })
  .strict();

export const goal = z
  .object({
    /** Played to the end under this policy… */
    algorithm: z.enum(ALGORITHMS).optional(),
    /** …with this many frames. */
    frames: z.number().int().optional(),
  })
  .strict();

export type Config = z.infer<typeof config>;
export type Goal = z.infer<typeof goal>;

export type Row = { page: number; frames: (number | null)[]; fault: boolean; victim: number | null };

export type State = { algorithm: Algorithm; frames: number; step: number };

export function simulate(reference: number[], frameCount: number, alg: Algorithm): Row[] {
  const frames: (number | null)[] = Array(frameCount).fill(null);
  const loadedAt: number[] = Array(frameCount).fill(-1);
  const usedAt: number[] = Array(frameCount).fill(-1);
  return reference.map((page, t) => {
    const hit = frames.indexOf(page);
    if (hit >= 0) {
      usedAt[hit] = t;
      return { page, frames: frames.slice(), fault: false, victim: null };
    }
    let slot = frames.indexOf(null);
    let victim: number | null = null;
    if (slot < 0) {
      if (alg === "FIFO") slot = argMin(loadedAt);
      else if (alg === "LRU") slot = argMin(usedAt);
      else {
        // The page whose next use is furthest away, or never.
        const nextUse = frames.map((p) => {
          const n = reference.indexOf(p as number, t + 1);
          return n < 0 ? Infinity : n;
        });
        slot = nextUse.indexOf(Math.max(...nextUse));
      }
      victim = frames[slot];
    }
    frames[slot] = page;
    loadedAt[slot] = t;
    usedAt[slot] = t;
    return { page, frames: frames.slice(), fault: true, victim };
  });
}

function argMin(xs: number[]): number {
  let best = 0;
  xs.forEach((x, i) => {
    if (x < xs[best]) best = i;
  });
  return best;
}

export function initial(c: Config): State {
  return { algorithm: c.algorithms[0], frames: c.frames, step: 0 };
}

export function check(g: Goal, s: State, c: Config): { met: boolean; why?: string } {
  if (g.algorithm && s.algorithm !== g.algorithm) return { met: false, why: `Switch to ${g.algorithm}.` };
  if (g.frames !== undefined && s.frames !== g.frames) return { met: false, why: `Use ${g.frames} frames.` };
  if (s.step < c.reference.length) return { met: false, why: "Step through the whole reference string." };
  return { met: true };
}
