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
};
