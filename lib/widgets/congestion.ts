import { z } from "zod";

/**
 * TCP congestion control, one round-trip at a time, in the textbook model
 * (Kurose & Ross §3.7): the window is counted in segments (MSS); slow start
 * doubles it each RTT up to ssthresh, congestion avoidance adds one. A loss
 * halves ssthresh; a timeout drops the window to 1, while three duplicate
 * ACKs drop it to 1 under Tahoe and to ssthresh + 3 under Reno.
 */

export const config = z
  .object({
    variant: z.enum(["reno", "tahoe"]).default("reno"),
    ssthresh: z.number().int().min(2).max(64).default(8),
    /** Offer a switch between Reno and Tahoe. */
    switchable: z.boolean().default(false),
    maxRounds: z.number().int().min(4).max(30).default(20),
  })
  .strict();

export const goal = z
  .object({
    /** At least this many rounds played. */
    rounds: z.number().int().min(1).optional(),
    /** The window reached at least this size at some point. */
    cwndAtLeast: z.number().int().optional(),
    /** These loss events happened at least once. */
    events: z.array(z.enum(["dupack", "timeout"])).optional(),
    variant: z.enum(["reno", "tahoe"]).optional(),
  })
  .strict();

export type Config = z.infer<typeof config>;
export type Goal = z.infer<typeof goal>;

export type Event = "ack" | "dupack" | "timeout";
export type Round = { cwnd: number; ssthresh: number; event: Event | null };
export type State = { variant: "reno" | "tahoe"; rounds: Round[] };

export const phase = (r: Round) => (r.cwnd < r.ssthresh ? "Slow start" : "Congestion avoidance");

export function initial(c: Config): State {
  return { variant: c.variant, rounds: [{ cwnd: 1, ssthresh: c.ssthresh, event: null }] };
}

/** What the next round's window is after `event` ends the current one. */
export function next(cur: Round, event: Event, variant: "reno" | "tahoe"): Round {
  if (event === "ack") {
    const cwnd = cur.cwnd < cur.ssthresh ? Math.min(cur.cwnd * 2, cur.ssthresh) : cur.cwnd + 1;
    return { cwnd, ssthresh: cur.ssthresh, event: null };
  }
  const ssthresh = Math.max(Math.floor(cur.cwnd / 2), 2);
  if (event === "timeout" || variant === "tahoe") return { cwnd: 1, ssthresh, event: null };
  return { cwnd: ssthresh + 3, ssthresh, event: null };
}

export function play(s: State, event: Event): State {
  const rounds = s.rounds.slice();
  const cur = { ...rounds[rounds.length - 1], event };
  rounds[rounds.length - 1] = cur;
  rounds.push(next(cur, event, s.variant));
  return { ...s, rounds };
}

export function check(g: Goal, s: State): { met: boolean; why?: string } {
  if (g.variant && s.variant !== g.variant) return { met: false, why: `Switch to ${g.variant === "reno" ? "Reno" : "Tahoe"}.` };
  const played = s.rounds.length - 1;
  if (g.rounds !== undefined && played < g.rounds) return { met: false, why: `Play at least ${g.rounds} rounds (${played} so far).` };
  const max = Math.max(...s.rounds.map((r) => r.cwnd));
  if (g.cwndAtLeast !== undefined && max < g.cwndAtLeast)
    return { met: false, why: `The window has reached ${max} segments; get it to ${g.cwndAtLeast}.` };
  const missing = (g.events ?? []).filter((e) => !s.rounds.some((r) => r.event === e));
  if (missing.length)
    return { met: false, why: `Still to happen: ${missing.map((e) => (e === "dupack" ? "three duplicate ACKs" : "a timeout")).join(" and ")}.` };
  return { met: true };
}
