import type { z } from "zod";
import * as threads from "@/lib/widgets/threads";
import * as btree from "@/lib/widgets/btree";
import * as paging from "@/lib/widgets/paging";
import * as tcp from "@/lib/widgets/tcp";
import * as tradeoff from "@/lib/widgets/tradeoff";
import * as scheduler from "@/lib/widgets/scheduler";
import * as congestion from "@/lib/widgets/congestion";

/**
 * Every widget a lesson can name, with the schemas its `config` and `goal`
 * are validated against at build time. The React side lives in
 * components/widgets; the logic here has no UI so the build can use it.
 */
export const WIDGET_SCHEMAS: Record<string, { config: z.ZodTypeAny; goal: z.ZodTypeAny; title: string }> = {
  threads: { config: threads.config, goal: threads.goal, title: "Thread interleaving" },
  btree: { config: btree.config, goal: btree.goal, title: "B-tree" },
  paging: { config: paging.config, goal: paging.goal, title: "Page replacement" },
  tcp: { config: tcp.config, goal: tcp.goal, title: "TCP connection" },
  tradeoff: { config: tradeoff.config, goal: tradeoff.goal, title: "Trade-off scenario" },
  scheduler: { config: scheduler.config, goal: scheduler.goal, title: "CPU scheduler" },
  congestion: { config: congestion.config, goal: congestion.goal, title: "Congestion window" },
};
