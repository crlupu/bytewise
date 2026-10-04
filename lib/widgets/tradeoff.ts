import { z } from "zod";

/**
 * Trade-off scenarios: a few design decisions, each with options that move a
 * set of qualities (latency, cost, consistency…) up or down. The learner
 * chooses, sees the consequences, and tries to meet the requirements.
 * Everything — qualities, decisions, effects — is authored in the lesson.
 */

const metricId = z.string().regex(/^[a-z][a-z0-9-]*$/);

export const config = z
  .object({
    metrics: z
      .array(
        z
          .object({
            id: metricId,
            label: z.string(),
            /** 0–10, before any decision. */
            start: z.number().min(0).max(10).default(5),
            better: z.enum(["higher", "lower"]),
          })
          .strict(),
      )
      .min(1),
    decisions: z
      .array(
        z
          .object({
            id: metricId,
            label: z.string(),
            options: z
              .array(
                z
                  .object({
                    id: metricId,
                    label: z.string(),
                    effects: z.record(z.number()).default({}),
                    consequence: z.string(),
                  })
                  .strict(),
              )
              .min(2),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((c, ctx) => {
    const ids = new Set(c.metrics.map((m) => m.id));
    c.decisions.forEach((d, di) =>
      d.options.forEach((o, oi) =>
        Object.keys(o.effects).forEach((k) => {
          if (!ids.has(k))
            ctx.addIssue({ code: "custom", path: ["decisions", di, "options", oi, "effects", k], message: `unknown metric "${k}"` });
        }),
      ),
    );
  });

export const goal = z
  .object({
    require: z
      .array(z.object({ metric: metricId, min: z.number().optional(), max: z.number().optional() }).strict())
      .default([]),
  })
  .strict();

export type Config = z.infer<typeof config>;
export type Goal = z.infer<typeof goal>;

export type State = { choices: Record<string, string> };

export function initial(): State {
  return { choices: {} };
}

export function metrics(c: Config, s: State): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of c.metrics) out[m.id] = m.start;
  for (const d of c.decisions) {
    const o = d.options.find((o) => o.id === s.choices[d.id]);
    if (!o) continue;
    for (const [k, v] of Object.entries(o.effects)) out[k] = (out[k] ?? 0) + v;
  }
  for (const k of Object.keys(out)) out[k] = Math.max(0, Math.min(10, out[k]));
  return out;
}

export function check(g: Goal, s: State, c: Config): { met: boolean; why?: string } {
  const open = c.decisions.filter((d) => !s.choices[d.id]);
  if (open.length) return { met: false, why: `Decide: ${open.map((d) => d.label).join(", ")}.` };
  const m = metrics(c, s);
  const fails = g.require.filter((r) => (r.min !== undefined && m[r.metric] < r.min) || (r.max !== undefined && m[r.metric] > r.max));
  if (fails.length) {
    const label = (id: string) => c.metrics.find((x) => x.id === id)?.label ?? id;
    return {
      met: false,
      why: `This design misses: ${fails
        .map((r) => `${label(r.metric)} ${r.min !== undefined ? `at least ${r.min}` : `at most ${r.max}`} (it's ${m[r.metric]})`)
        .join("; ")}.`,
    };
  }
  return { met: true };
}
