"use client";

import type { ComponentType } from "react";
import type { WidgetProps } from "@/components/widgets/sim";
import { Threads } from "@/components/widgets/Threads";
import { BTree } from "@/components/widgets/BTree";
import { Paging } from "@/components/widgets/Paging";
import { Tcp } from "@/components/widgets/Tcp";
import { Tradeoff } from "@/components/widgets/Tradeoff";
import * as threads from "@/lib/widgets/threads";
import * as btree from "@/lib/widgets/btree";
import * as paging from "@/lib/widgets/paging";
import * as tcp from "@/lib/widgets/tcp";
import * as tradeoff from "@/lib/widgets/tradeoff";
import * as scheduler from "@/lib/widgets/scheduler";
import * as congestion from "@/lib/widgets/congestion";
import { Scheduler } from "@/components/widgets/Scheduler";
import { Congestion } from "@/components/widgets/Congestion";
import { Locks } from "@/components/widgets/Locks";
import * as locks from "@/lib/widgets/locks";

type Check = (goal: never, state: never, config: never) => { met: boolean; why?: string };

/**
 * The widget library. A lesson names a widget; the step parses its config
 * (filling defaults), renders it, and asks `check` whether its reported
 * state meets the lesson's goal.
 */
export const WIDGETS: Record<
  string,
  { Component: ComponentType<WidgetProps<never, never, never>>; check: Check; config: { parse: (x: unknown) => unknown }; goal: { parse: (x: unknown) => unknown } }
> = {
  threads: { Component: Threads as never, check: threads.check as Check, config: threads.config, goal: threads.goal },
  btree: { Component: BTree as never, check: btree.check as Check, config: btree.config, goal: btree.goal },
  paging: { Component: Paging as never, check: paging.check as Check, config: paging.config, goal: paging.goal },
  tcp: { Component: Tcp as never, check: tcp.check as Check, config: tcp.config, goal: tcp.goal },
  tradeoff: { Component: Tradeoff as never, check: tradeoff.check as Check, config: tradeoff.config, goal: tradeoff.goal },
  scheduler: { Component: Scheduler as never, check: scheduler.check as Check, config: scheduler.config, goal: scheduler.goal },
  congestion: { Component: Congestion as never, check: congestion.check as Check, config: congestion.config, goal: congestion.goal },
  locks: { Component: Locks as never, check: locks.check as Check, config: locks.config, goal: locks.goal },
};
