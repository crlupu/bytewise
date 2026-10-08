import { z } from "zod";
import { Diagram, type ClassDiagramT } from "@/lib/diagram";

/**
 * Hierarchy: a class diagram whose boxes can be tapped. The learner answers
 * by choosing a class — which `draw()` runs, where a field is declared,
 * which handler catches an exception. `feedback` gives a hint per wrong pick.
 */

export const config = z
  .object({
    diagram: Diagram.refine((d) => d.kind === "class", "the hierarchy widget needs a class diagram"),
    /** Shown when the learner picks this class and it's wrong. */
    feedback: z.record(z.string()).default({}),
  })
  .strict();

export const goal = z
  .object({
    /** The class to pick. */
    select: z.string().min(1),
  })
  .strict();

export type Config = z.infer<typeof config>;
export type Goal = z.infer<typeof goal>;
export type State = { selected: string | null };

export const initial = (): State => ({ selected: null });

export const diagramOf = (c: Config) => c.diagram as ClassDiagramT;

export function check(g: Goal, s: State, c: Config): { met: boolean; why?: string } {
  if (!s.selected) return { met: false, why: "Tap a class to choose it." };
  if (s.selected === g.select) return { met: true };
  return { met: false, why: c.feedback[s.selected] ?? `Not ${s.selected}.` };
}
