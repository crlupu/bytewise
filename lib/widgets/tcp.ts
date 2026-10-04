import { z } from "zod";

/**
 * TCP connection set-up and teardown between a client and a server. The
 * learner chooses which side sends which segment; a segment the protocol
 * wouldn't allow in the current state is refused, with the reason. Delivery
 * is instant and nothing is lost, so the sequence is the whole lesson.
 */

export const STATES = [
  "CLOSED",
  "LISTEN",
  "SYN_SENT",
  "SYN_RECEIVED",
  "ESTABLISHED",
  "FIN_WAIT_1",
  "FIN_WAIT_2",
  "CLOSE_WAIT",
  "LAST_ACK",
  "TIME_WAIT",
] as const;
export type TcpState = (typeof STATES)[number];

export const config = z
  .object({
    /** Begin before the handshake, or with the connection already open. */
    start: z.enum(["closed", "established"]).default("closed"),
    /** Offer the teardown actions (FIN, and waiting out TIME_WAIT). */
    teardown: z.boolean().default(false),
    clientIsn: z.number().int().min(0).default(1000),
    serverIsn: z.number().int().min(0).default(5000),
  })
  .strict();

export const goal = z
  .object({ client: z.enum(STATES).optional(), server: z.enum(STATES).optional() })
  .strict();

export type Config = z.infer<typeof config>;
export type Goal = z.infer<typeof goal>;

export type Side = "client" | "server";
export type Action = "SYN" | "SYN-ACK" | "ACK" | "FIN" | "WAIT";

export type Segment = { from: Side; flags: string; seq: number; ack: number | null };

export type State = {
  client: TcpState;
  server: TcpState;
  /** What each side has received and not yet answered. */
  pending: { client: string | null; server: string | null };
  segments: Segment[];
  /** The latest refused move, with why. */
  refusal: string | null;
};

export function initial(c: Config): State {
  if (c.start === "established") {
    return {
      client: "ESTABLISHED",
      server: "ESTABLISHED",
      pending: { client: null, server: null },
      segments: [],
      refusal: null,
    };
  }
  return { client: "CLOSED", server: "LISTEN", pending: { client: null, server: null }, segments: [], refusal: null };
}

export function actions(c: Config): { side: Side; action: Action; label: string }[] {
  const out: { side: Side; action: Action; label: string }[] = [
    { side: "client", action: "SYN", label: "SYN" },
    { side: "server", action: "SYN-ACK", label: "SYN-ACK" },
    { side: "client", action: "ACK", label: "ACK" },
    { side: "server", action: "ACK", label: "ACK" },
  ];
  if (c.teardown) {
    out.push(
      { side: "client", action: "FIN", label: "FIN" },
      { side: "server", action: "FIN", label: "FIN" },
      { side: "client", action: "WAIT", label: "Wait 2×MSL" },
    );
  }
  return out;
}

const name = (s: Side) => (s === "client" ? "client" : "server");

/** Apply one move; a move the protocol forbids leaves the state and sets `refusal`. */
export function act(s: State, c: Config, side: Side, action: Action): State {
  const x = c.clientIsn;
  const y = c.serverIsn;
  const refuse = (why: string): State => ({ ...s, refusal: why });
  const send = (next: Partial<State>, seg?: Omit<Segment, "from">): State => ({
    ...s,
    ...next,
    pending: { ...s.pending, ...(next.pending ?? {}) },
    segments: seg ? [...s.segments, { from: side, ...seg }] : s.segments,
    refusal: null,
  });
  const me = s[side];

  if (side === "client" && action === "SYN") {
    if (me !== "CLOSED") return refuse(`The client is in ${me}; it opens a connection only from CLOSED.`);
    if (s.server !== "LISTEN") return refuse("The server isn't listening.");
    return send({ client: "SYN_SENT", pending: { server: "SYN", client: null } }, { flags: "SYN", seq: x, ack: null });
  }
  if (side === "server" && action === "SYN-ACK") {
    if (s.pending.server !== "SYN")
      return refuse(`The server is in ${me} and hasn't received a SYN, so there's nothing to answer.`);
    return send({ server: "SYN_RECEIVED", pending: { server: null, client: "SYN-ACK" } }, { flags: "SYN, ACK", seq: y, ack: x + 1 });
  }
  if (action === "ACK") {
    if (side === "client" && s.pending.client === "SYN-ACK")
      return send({ client: "ESTABLISHED", server: "ESTABLISHED", pending: { client: null, server: null } }, { flags: "ACK", seq: x + 1, ack: y + 1 });
    if (side === "server" && s.pending.server === "FIN")
      return send({ client: "FIN_WAIT_2", pending: { server: "ACKED_FIN", client: null } }, { flags: "ACK", seq: y + 1, ack: x + 2 });
    if (side === "client" && s.pending.client === "FIN")
      return send({ client: "TIME_WAIT", server: "CLOSED", pending: { client: null, server: null } }, { flags: "ACK", seq: x + 2, ack: y + 2 });
    return refuse(
      `The ${name(side)} is in ${me} and has nothing to acknowledge. An ACK answers a segment that carried SYN or FIN.`,
    );
  }
  if (action === "FIN") {
    if (side === "client") {
      if (me !== "ESTABLISHED") return refuse(`The client is in ${me}; it can only start closing an ESTABLISHED connection.`);
      return send({ client: "FIN_WAIT_1", server: "CLOSE_WAIT", pending: { server: "FIN", client: null } }, { flags: "FIN, ACK", seq: x + 1, ack: y + 1 });
    }
    if (me === "ESTABLISHED")
      return refuse("In this simulation the client closes first. Let it send FIN, then answer as the server.");
    if (me !== "CLOSE_WAIT") return refuse(`The server is in ${me}; it can't close from here.`);
    if (s.pending.server === "FIN") return refuse("The server must first acknowledge the client's FIN.");
    return send({ server: "LAST_ACK", pending: { client: "FIN", server: null } }, { flags: "FIN, ACK", seq: y + 1, ack: x + 2 });
  }
  if (action === "WAIT") {
    if (me !== "TIME_WAIT") return refuse(`Only a side in TIME_WAIT waits out 2×MSL; the client is in ${me}.`);
    return send({ client: "CLOSED" });
  }
  return refuse(`The ${name(side)} can't send ${action} in ${me}.`);
}

export function check(g: Goal, s: State): { met: boolean; why?: string } {
  const miss: string[] = [];
  if (g.client && s.client !== g.client) miss.push(`client in ${g.client} (now ${s.client})`);
  if (g.server && s.server !== g.server) miss.push(`server in ${g.server} (now ${s.server})`);
  return miss.length ? { met: false, why: `Not yet: the goal is ${miss.join(" and ")}.` } : { met: true };
}
