"use client";

import { useMemo, type KeyboardEvent, type MouseEvent } from "react";
import { useReport, useSim, type WidgetProps } from "@/components/widgets/sim";
import { renderDiagram } from "@/lib/diagram";
import * as H from "@/lib/widgets/hierarchy";

/** A class diagram whose classes are buttons: the answer is the class you pick. */
export function Hierarchy({ config: c, onState }: WidgetProps<H.Config, H.Goal, H.State>) {
  const sim = useSim(H.initial);
  const s = sim.state;
  useReport(s, onState);
  const html = useMemo(
    () => renderDiagram(H.diagramOf(c), { interactive: true, selected: s.selected, label: "Class diagram — choose a class" }),
    [c, s.selected],
  );
  const pick = (target: EventTarget | null) => {
    const node = (target as Element | null)?.closest?.("[data-node]");
    if (node) sim.push({ selected: node.getAttribute("data-node") });
  };
  return (
    <div className="hierarchy">
      <div
        onClick={(e: MouseEvent) => pick(e.target)}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick(e.target);
          }
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <p className="hierarchy__hint" aria-live="polite">
        {s.selected ? (
          <>
            Chosen: <strong>{s.selected}</strong>
          </>
        ) : (
          "Tap a class to choose it."
        )}
      </p>
    </div>
  );
}
