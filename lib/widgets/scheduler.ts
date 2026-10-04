import { z } from "zod";

/**
 * CPU scheduling: a handful of jobs with arrival times and run lengths,
 * played out tick by tick under FIFO, SJF, STCF or round robin. The whole
 * timeline is computed up front; stepping moves through it. Metrics follow
 * OSTEP: turnaround = completion − arrival, response = first run − arrival.
 */

export const ALGORITHMS = ["FIFO", "SJF", "STCF", "RR"] as const;
export type Algorithm = (typeof ALGORITHMS)[number];

const job = z.object({ name: z.string().min(1).max(3), arrival: z.number().int().min(0), burst: z.number().int().min(1).max(30) }).strict();

export const config = z
  .object({
    jobs: z.array(job).min(2).max(6),
    algorithms: z.array(z.enum(ALGORITHMS)).min(1).default(["FIFO", "SJF", "STCF", "RR"]),
    /** Time slice for RR. */
    quantum: z.number().int().min(1).max(10).default(2),
    /** Slices the learner may switch between; leave out to fix `quantum`. */
    quantumChoices: z.array(z.number().int().min(1).max(10)).optional(),
  })
  .strict()
  .superRefine((c, ctx) => {
    const names = c.jobs.map((j) => j.name);
    if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", path: ["jobs"], message: "job names must be unique" });
    if (c.jobs.reduce((n, j) => n + j.burst, 0) > 60) ctx.addIssue({ code: "custom", path: ["jobs"], message: "keep the total run time to 60 ticks or less" });
  });

export const goal = z
  .object({
    algorithm: z.enum(ALGORITHMS).optional(),
    quantum: z.number().int().optional(),
    avgTurnaroundAtMost: z.number().optional(),
    avgResponseAtMost: z.number().optional(),
  })
  .strict();

export type Config = z.infer<typeof config>;
export type Goal = z.infer<typeof goal>;
export type Job = z.infer<typeof job>;

export type State = { algorithm: Algorithm; quantum: number; time: number };

export type Run = {
  /** Which job ran in each tick (index into jobs), or null when idle. */
  slots: (number | null)[];
  firstRun: number[];
  completion: number[];
};

export function simulate(jobs: Job[], alg: Algorithm, quantum: number): Run {
  const n = jobs.length;
  const left = jobs.map((j) => j.burst);
  const firstRun = Array(n).fill(-1);
  const completion = Array(n).fill(-1);
  const slots: (number | null)[] = [];
  let t = 0;
  let current: number | null = null;
  let sliceUsed = 0;
  const queue: number[] = [];
  const admitted = new Set<number>();
  const admit = () => {
    jobs.forEach((j, i) => {
      if (j.arrival <= t && !admitted.has(i)) {
        admitted.add(i);
        queue.push(i);
      }
    });
  };

  while (completion.some((c) => c < 0)) {
    admit();
    const ready = queue.filter((i) => left[i] > 0);
    if (alg === "FIFO" || alg === "SJF") {
      // Non-preemptive: keep the running job until it finishes.
      if (current === null || left[current] === 0) {
        current = null;
        if (ready.length) {
          current = alg === "FIFO" ? ready[0] : ready.reduce((a, b) => (jobs[b].burst < jobs[a].burst ? b : a));
          queue.splice(queue.indexOf(current), 1);
        }
      }
    } else if (alg === "STCF") {
      // Preemptive: always the job with the least work left; on a tie, keep the one running.
      const pool = [...admitted].filter((i) => left[i] > 0);
      current = pool.length ? pool.reduce((a, b) => (left[b] < left[a] || (left[b] === left[a] && b === current) ? b : a)) : null;
    } else {
      // Round robin: new arrivals join the queue before a job whose slice just ended.
      if (current !== null && (left[current] === 0 || sliceUsed >= quantum)) {
        if (left[current] > 0) queue.push(current);
        current = null;
      }
      if (current === null) {
        const next = queue.findIndex((i) => left[i] > 0);
        if (next >= 0) {
          current = queue[next];
          queue.splice(next, 1);
          sliceUsed = 0;
        }
      }
    }

    if (current === null) {
      slots.push(null);
    } else {
      if (firstRun[current] < 0) firstRun[current] = t;
      slots.push(current);
      left[current]--;
      sliceUsed++;
      if (left[current] === 0) completion[current] = t + 1;
    }
    t++;
    if (t > 500) break;
  }
  return { slots, firstRun, completion };
}

export function metrics(jobs: Job[], run: Run) {
  const turnaround = jobs.map((j, i) => run.completion[i] - j.arrival);
  const response = jobs.map((j, i) => run.firstRun[i] - j.arrival);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return { turnaround, response, avgTurnaround: avg(turnaround), avgResponse: avg(response) };
}

export function initial(c: Config): State {
  return { algorithm: c.algorithms[0], quantum: c.quantum, time: 0 };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export function check(g: Goal, s: State, c: Config): { met: boolean; why?: string } {
  if (g.algorithm && s.algorithm !== g.algorithm) return { met: false, why: `Switch to ${g.algorithm}.` };
  if (g.quantum !== undefined && s.quantum !== g.quantum) return { met: false, why: `Use a time slice of ${g.quantum}.` };
  const run = simulate(c.jobs, s.algorithm, s.quantum);
  if (s.time < run.slots.length) return { met: false, why: "Play the schedule through to the end." };
  const m = metrics(c.jobs, run);
  if (g.avgTurnaroundAtMost !== undefined && m.avgTurnaround > g.avgTurnaroundAtMost)
    return { met: false, why: `Average turnaround is ${round1(m.avgTurnaround)}; the goal is at most ${g.avgTurnaroundAtMost}.` };
  if (g.avgResponseAtMost !== undefined && m.avgResponse > g.avgResponseAtMost)
    return { met: false, why: `Average response is ${round1(m.avgResponse)}; the goal is at most ${g.avgResponseAtMost}.` };
  return { met: true };
}
