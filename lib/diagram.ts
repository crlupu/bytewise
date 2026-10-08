import { z } from "zod";

/**
 * Diagrams for lessons, described in YAML and drawn as inline SVG.
 *
 * `class` diagrams are UML-style: boxes for classes, interfaces and enums,
 * with optional fields and methods, joined by `extends`, `implements`,
 * has-a (`has`), `uses` and `inner` relations. Inheritance decides the
 * layout — parents above children — so authors never place anything.
 *
 * `objects` diagrams show memory: variables on the left, objects on the
 * right, and arrows for references, including references between objects.
 *
 * The SVG uses CSS classes only (see `.dg` in globals.css), so it follows
 * the light and dark themes. Rendering is pure, so it runs at build time
 * and in the browser (the `hierarchy` widget makes the boxes tappable).
 */

const name = z.string().min(1).max(40);

const ClassBox = z
  .object({
    name,
    kind: z.enum(["class", "abstract", "interface", "enum", "record", "final"]).default("class"),
    fields: z.array(z.string().min(1).max(48)).default([]),
    methods: z.array(z.string().min(1).max(48)).default([]),
  })
  .strict();

const Relation = z
  .object({
    from: name,
    to: name,
    type: z.enum(["extends", "implements", "has", "uses", "inner"]),
    label: z.string().max(24).optional(),
  })
  .strict();

export const ClassDiagram = z
  .object({
    kind: z.literal("class").default("class"),
    classes: z.array(ClassBox).min(1).max(14),
    relations: z.array(Relation).default([]),
    highlight: z.array(name).default([]),
    dim: z.array(name).default([]),
    caption: z.string().optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    const names = new Set(d.classes.map((c) => c.name));
    d.relations.forEach((r, i) => {
      for (const end of ["from", "to"] as const)
        if (!names.has(r[end])) ctx.addIssue({ code: "custom", path: ["relations", i, end], message: `no class named "${r[end]}"` });
    });
    for (const key of ["highlight", "dim"] as const)
      d[key].forEach((n, i) => {
        if (!names.has(n)) ctx.addIssue({ code: "custom", path: [key, i], message: `no class named "${n}"` });
      });
  });

const ObjField = z
  .object({ name, value: z.string().max(40).optional(), to: name.optional() })
  .strict();

export const ObjectDiagram = z
  .object({
    kind: z.literal("objects"),
    vars: z.array(z.object({ name, value: z.string().max(24).optional(), to: name.optional() }).strict()).default([]),
    objects: z.array(z.object({ id: name, type: name, fields: z.array(ObjField).default([]) }).strict()).max(8).default([]),
    highlight: z.array(name).default([]),
    caption: z.string().optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (!d.vars.length && !d.objects.length) ctx.addIssue({ code: "custom", path: [], message: "an objects diagram needs vars or objects" });
    const ids = new Set(d.objects.map((o) => o.id));
    d.vars.forEach((v, i) => {
      if (v.to && !ids.has(v.to)) ctx.addIssue({ code: "custom", path: ["vars", i, "to"], message: `no object with id "${v.to}"` });
    });
    d.objects.forEach((o, oi) =>
      o.fields.forEach((f, fi) => {
        if (f.to && !ids.has(f.to)) ctx.addIssue({ code: "custom", path: ["objects", oi, "fields", fi, "to"], message: `no object with id "${f.to}"` });
      }),
    );
  });

export type ClassDiagramT = z.infer<typeof ClassDiagram>;
export type ObjectDiagramT = z.infer<typeof ObjectDiagram>;
export type DiagramT = ClassDiagramT | ObjectDiagramT;

/** Validates a raw diagram of either kind (`kind` defaults to `class`), with the cross-reference checks. */
export function parseDiagram(raw: unknown): z.SafeParseReturnType<unknown, DiagramT> {
  const kind = raw && typeof raw === "object" && "kind" in raw ? (raw as { kind: unknown }).kind : "class";
  return kind === "objects" ? ObjectDiagram.safeParse(raw) : ClassDiagram.safeParse({ kind: "class", ...(raw as object) });
}

/** For schemas: any diagram, validated and defaulted. */
export const Diagram = z.unknown().transform((raw, ctx): DiagramT => {
  const r = parseDiagram(raw);
  if (!r.success) {
    r.error.issues.forEach((i) => ctx.addIssue(i));
    return z.NEVER;
  }
  return r.data;
});

// ---- Rendering ----

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MONO = 7.8; // px per character at 13px monospace
const SANS = 7.9; // px per character at 14px bold Inter Tight (measured ~7.6), with a little slack
const LINE = 18;

type Box = { x: number; y: number; w: number; h: number };
type Pt = { x: number; y: number };

function arrowHead(tip: Pt, from: Pt, size = 11, half = 6): string {
  const a = Math.atan2(tip.y - from.y, tip.x - from.x);
  const bx = tip.x - size * Math.cos(a), by = tip.y - size * Math.sin(a);
  const px = -Math.sin(a) * half, py = Math.cos(a) * half;
  return `${tip.x},${tip.y} ${bx + px},${by + py} ${bx - px},${by - py}`;
}
function diamond(tip: Pt, from: Pt, size = 16, half = 6): string {
  const a = Math.atan2(tip.y - from.y, tip.x - from.x);
  const mx = tip.x - (size / 2) * Math.cos(a), my = tip.y - (size / 2) * Math.sin(a);
  const ex = tip.x - size * Math.cos(a), ey = tip.y - size * Math.sin(a);
  const px = -Math.sin(a) * half, py = Math.cos(a) * half;
  return `${tip.x},${tip.y} ${mx + px},${my + py} ${ex},${ey} ${mx - px},${my - py}`;
}
/** Where the segment from the box's centre towards `p` leaves the box. */
function clip(b: Box, p: Pt): Pt {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const dx = p.x - cx, dy = p.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const t = Math.min(dx ? b.w / 2 / Math.abs(dx) : Infinity, dy ? b.h / 2 / Math.abs(dy) : Infinity);
  return { x: cx + dx * t, y: cy + dy * t };
}

const STEREO: Record<string, string | null> = { class: null, abstract: "abstract", interface: "interface", enum: "enum", record: "record", final: "final" };

export type RenderOptions = { interactive?: boolean; selected?: string | null; label?: string };

export function renderDiagram(d: DiagramT, opts: RenderOptions = {}): string {
  return d.kind === "objects" ? renderObjects(d) : renderClasses(d, opts);
}

function renderClasses(d: ClassDiagramT, opts: RenderOptions): string {
  const GAP_X = 32, GAP_Y = 60, PAD = 12;
  const inherit = d.relations.filter((r) => r.type === "extends" || r.type === "implements");

  // Levels: parents above children, and parts (has / uses / inner targets) one row below their owner.
  // A part that heads its own hierarchy (WeatherData has Observers) hangs below the owner too, taking
  // its subclasses with it — unless the owner is one of those subclasses (a decorator wraps its supertype).
  const supers = (n: string) => inherit.filter((r) => r.from === n).map((r) => r.to);
  const isBelow = (n: string, anc: string, seen = new Set<string>()): boolean =>
    supers(n).some((p) => p === anc || (!seen.has(p) && (seen.add(p), isBelow(p, anc, seen))));
  const inHierarchy = new Set(inherit.flatMap((r) => [r.from, r.to]));
  const parts = d.relations.filter(
    (r) => !inherit.includes(r) && r.to !== r.from && (!inHierarchy.has(r.to) || (!supers(r.to).length && !isBelow(r.from, r.to))),
  );
  const level = new Map<string, number>(d.classes.map((c) => [c.name, 0]));
  for (let pass = 0; pass < d.classes.length; pass++) {
    for (const r of inherit) level.set(r.from, Math.max(level.get(r.from)!, level.get(r.to)! + 1));
    for (const r of parts) level.set(r.to, Math.max(level.get(r.to)!, level.get(r.from)! + 1));
    // An owner outside any hierarchy, whose part sits inside one, goes on the part's row, beside it.
    for (const r of d.relations)
      if (!inherit.includes(r) && !parts.includes(r) && !inHierarchy.has(r.from)) level.set(r.from, Math.max(level.get(r.from)!, level.get(r.to)!));
  }

  // Box sizes.
  const size = new Map<string, { w: number; h: number; head: number }>();
  for (const c of d.classes) {
    const stereo = STEREO[c.kind];
    const head = stereo ? 44 : 32;
    const members = [...c.fields, ...c.methods];
    const w = Math.max(76, c.name.length * SANS + 2 * PAD, (stereo ? stereo.length + 4 : 0) * 7, ...members.map((m) => m.length * MONO + 2 * PAD));
    const h = head + (c.fields.length ? c.fields.length * LINE + 10 : 0) + (c.methods.length ? c.methods.length * LINE + 10 : 0);
    size.set(c.name, { w: Math.ceil(w), h, head });
  }

  // Tree layout: each class hangs under one "primary" parent — its superclass, else the first
  // interface it implements, else the class it's a part of — and sits centred over its own subtree.
  const order = new Map(d.classes.map((c, i) => [c.name, i]));
  const primary = new Map<string, string>();
  for (const c of d.classes) {
    const up =
      inherit.find((r) => r.from === c.name && r.type === "extends") ??
      inherit.find((r) => r.from === c.name) ??
      parts.find((r) => r.to === c.name);
    if (up) primary.set(c.name, up.type === "extends" || up.type === "implements" ? up.to : up.from);
  }
  // Guard against cycles: a node whose primary chain loops back becomes a root.
  for (const n of [...primary.keys()]) {
    const seen = new Set([n]);
    for (let p = primary.get(n); p; p = primary.get(p)) {
      if (seen.has(p)) { primary.delete(n); break; }
      seen.add(p);
    }
  }
  const kids = (n: string) => d.classes.map((c) => c.name).filter((k) => primary.get(k) === n).sort((a, b) => order.get(a)! - order.get(b)!);
  const roots = d.classes.map((c) => c.name).filter((n) => !primary.has(n));
  const span = new Map<string, number>();
  const measure = (n: string): number => {
    const ks = kids(n);
    const inner = ks.reduce((t, k) => t + measure(k), 0) + GAP_X * Math.max(0, ks.length - 1);
    const w = Math.max(size.get(n)!.w, inner);
    span.set(n, w);
    return w;
  };
  const cx = new Map<string, number>();
  const place = (n: string, left: number) => {
    const ks = kids(n);
    const inner = ks.reduce((t, k) => t + span.get(k)!, 0) + GAP_X * Math.max(0, ks.length - 1);
    let x = left + (span.get(n)! - inner) / 2;
    for (const k of ks) {
      place(k, x);
      x += span.get(k)! + GAP_X;
    }
    if (ks.length) {
      const centres = ks.map((k) => cx.get(k)!);
      let mid = (centres[0] + centres.at(-1)!) / 2;
      if (ks.length % 2) {
        const m = centres[(ks.length - 1) / 2];
        if (Math.abs(m - mid) < 20) mid = m;
      }
      cx.set(n, mid);
    } else cx.set(n, left + span.get(n)! / 2);
  };
  let left = 0;
  for (const r of roots) {
    measure(r);
    place(r, left);
    left += span.get(r)! + GAP_X;
  }
  // Rows by level; each row as tall as its tallest box.
  const maxLevel = Math.max(...level.values());
  const rowY: number[] = [];
  let y = 0;
  for (let l = 0; l <= maxLevel; l++) {
    rowY[l] = y;
    const hs = d.classes.filter((c) => level.get(c.name) === l).map((c) => size.get(c.name)!.h);
    y += (hs.length ? Math.max(...hs) : 0) + GAP_Y;
  }
  const box = new Map<string, Box>();
  for (const c of d.classes) {
    const sz = size.get(c.name)!;
    box.set(c.name, { x: cx.get(c.name)! - sz.w / 2, y: rowY[level.get(c.name)!], w: sz.w, h: sz.h });
  }
  // A class with several supertypes (Hero implements CanFight, CanSwim…) sits centred under all of them, if its row has room.
  for (const c of d.classes) {
    const ps = inherit.filter((r) => r.from === c.name).map((r) => box.get(r.to)!);
    if (ps.length < 2 || kids(c.name).length) continue;
    const me = box.get(c.name)!;
    const want = ps.reduce((t, p) => t + p.x + p.w / 2, 0) / ps.length - me.w / 2;
    const clash = [...box.entries()].some(([n, o]) => n !== c.name && Math.abs(o.y - me.y) < 1 && want < o.x + o.w + GAP_X / 2 && want + me.w > o.x - GAP_X / 2);
    if (!clash) me.x = want;
  }
  // Shift so nothing is left of 0, and measure.
  const minX = Math.min(...[...box.values()].map((b) => b.x));
  for (const b of box.values()) b.x -= minX;
  const width = Math.max(...[...box.values()].map((b) => b.x + b.w));
  const height = y - GAP_Y;

  let edges = "";
  // Inheritance: a shared "bus" per parent and relation type, UML-tree style.
  const groups = new Map<string, typeof inherit>();
  for (const r of inherit) {
    const k = `${r.to}|${r.type}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const [k, rs] of groups) {
    const [parent, type] = k.split("|");
    const p = box.get(parent)!;
    const px = p.x + p.w / 2, pb = p.y + p.h;
    const busY = pb + 14 + (type === "implements" ? 22 : 12);
    const cls = type === "implements" ? "dg-edge dg-edge--dashed" : "dg-edge";
    const xs = [px];
    for (const r of rs) {
      const c = box.get(r.from)!;
      const cx = c.x + c.w / 2;
      xs.push(cx);
      edges += `<path class="${cls}" d="M${cx} ${c.y} V${busY}"/>`;
    }
    edges += `<path class="${cls}" d="M${Math.min(...xs)} ${busY} H${Math.max(...xs)} M${px} ${busY} V${pb + 13}"/>`;
    edges += `<polygon class="dg-head dg-head--open" points="${px},${pb} ${px - 7},${pb + 13} ${px + 7},${pb + 13}"/>`;
  }
  // has / uses / inner: straight lines between the boxes' edges.
  let arcRight = 0;
  let labelRight = 0; // labels can stick out past the boxes
  const LABEL = 6.6; // px per character of a 11px mono label
  for (const r of d.relations.filter((r) => !inherit.includes(r))) {
    const a = box.get(r.from)!, b = box.get(r.to)!;
    const ac = { x: a.x + a.w / 2, y: a.y + Math.min(a.h / 2, 22) }, bc = { x: b.x + b.w / 2, y: b.y + Math.min(b.h / 2, 22) };
    const sameRow = Math.abs(a.y - b.y) < 1;
    const s = sameRow ? { x: ac.x < bc.x ? a.x + a.w : a.x, y: ac.y } : clip(a, bc);
    const e = sameRow ? { x: ac.x < bc.x ? b.x : b.x + b.w, y: ac.y } : clip(b, ac);
    // Boxes a straight line would cross (View → Model past the Controller).
    const between = [...box.entries()].filter(([n]) => n !== r.from && n !== r.to).map(([, o]) => o);
    const crossed = between.filter((o) =>
      Array.from({ length: 41 }, (_, i) => i / 40).some((t) => {
        const x = s.x + (e.x - s.x) * t, y = s.y + (e.y - s.y) * t;
        return x > o.x - 4 && x < o.x + o.w + 4 && y > o.y - 4 && y < o.y + o.h + 4;
      }),
    );
    const pairedByInheritance = inherit.some((i) => (i.from === r.from && i.to === r.to) || (i.from === r.to && i.to === r.from));
    if (pairedByInheritance || crossed.length) {
      // Same pair as an inheritance line (a decorator wraps its own supertype), or a box in the way: arc round the right side.
      const s0 = { x: a.x + a.w, y: a.y + Math.min(a.h / 2, 22) }, e0 = { x: b.x + b.w, y: b.y + Math.min(b.h / 2, 22) };
      const bulge = Math.max(s0.x, e0.x, ...crossed.map((o) => o.x + o.w)) + 48;
      arcRight = Math.max(arcRight, bulge + 10);
      edges += `<path class="dg-edge${r.type === "uses" ? " dg-edge--dashed" : ""}" d="M${s0.x} ${s0.y} C${bulge} ${s0.y} ${bulge} ${e0.y} ${e0.x} ${e0.y}"/>`;
      if (r.type === "has") edges += `<polygon class="dg-head dg-head--solid" points="${diamond(s0, { x: s0.x + 20, y: s0.y })}"/>`;
      else {
        const [tip, b1, b2] = arrowHead(e0, { x: e0.x + 20, y: e0.y }).split(" ");
        edges += `<polyline class="dg-edge" points="${b1} ${tip} ${b2}"/>`;
      }
      if (r.label) labelRight = Math.max(labelRight, bulge - 6 + r.label.length * LABEL);
      if (r.label) edges += `<text class="dg-label" x="${bulge - 6}" y="${(s0.y + e0.y) / 2 + 4}" text-anchor="start">${esc(r.label)}</text>`;
      continue;
    }
    const dashed = r.type === "uses" ? " dg-edge--dashed" : "";
    edges += `<path class="dg-edge${dashed}" d="M${s.x} ${s.y} L${e.x} ${e.y}"/>`;
    if (r.type === "has") edges += `<polygon class="dg-head dg-head--solid" points="${diamond(s, e)}"/>`;
    if (r.type === "uses") {
      const [tip, b1, b2] = arrowHead(e, s).split(" ");
      edges += `<polyline class="dg-edge" points="${b1} ${tip} ${b2}"/>`;
    }
    if (r.type === "inner") {
      const cx = s.x + (e.x - s.x) * (7 / Math.hypot(e.x - s.x, e.y - s.y) || 0), cy = s.y + (e.y - s.y) * (7 / Math.hypot(e.x - s.x, e.y - s.y) || 0);
      edges += `<circle class="dg-head dg-head--open" cx="${cx}" cy="${cy}" r="7"/><path class="dg-edge" d="M${cx - 4} ${cy} H${cx + 4} M${cx} ${cy - 4} V${cy + 4}"/>`;
    }
    if (r.label) {
      // Beside the line: to the right of a mostly vertical one, mid-way; above a mostly
      // horizontal one, near the far end so it never sits on the diamond.
      const len = Math.hypot(e.x - s.x, e.y - s.y) || 1;
      const ux = (e.x - s.x) / len, uy = (e.y - s.y) / len;
      const vertical = Math.abs(uy) > Math.abs(ux);
      const t = vertical ? len / 2 : Math.min(len - 14, Math.max(len * 0.6, 26));
      const lx = s.x + ux * t + (vertical ? 7 : -uy * 11), ly = s.y + uy * t + (vertical ? 4 : ux * 11 + 4);
      const anchor = vertical ? "start" : "middle";
      labelRight = Math.max(labelRight, lx + (vertical ? 1 : 0.5) * r.label.length * LABEL);
      edges += `<text class="dg-label" x="${lx}" y="${ly}" text-anchor="${anchor}">${esc(r.label)}</text>`;
    }
  }

  let nodes = "";
  for (const c of d.classes) {
    const b = box.get(c.name)!, s = size.get(c.name)!;
    const stereo = STEREO[c.kind];
    const state = [
      d.highlight.includes(c.name) ? " is-hi" : "",
      d.dim.includes(c.name) ? " is-dim" : "",
      opts.selected === c.name ? " is-sel" : "",
      ` dg-node--${c.kind}`,
    ].join("");
    const a11y = opts.interactive ? ` role="button" tabindex="0" aria-pressed="${opts.selected === c.name}" aria-label="${esc(c.name)}"` : "";
    let g = `<g class="dg-node${state}" data-node="${esc(c.name)}"${a11y}>`;
    g += `<rect class="dg-box" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10"/>`;
    let ty = b.y + 21;
    if (stereo) {
      g += `<text class="dg-stereo" x="${b.x + b.w / 2}" y="${b.y + 16}" text-anchor="middle">«${stereo}»</text>`;
      ty += 12;
    }
    g += `<text class="dg-name${c.kind === "abstract" ? " dg-name--abstract" : ""}" x="${b.x + b.w / 2}" y="${ty}" text-anchor="middle">${esc(c.name)}</text>`;
    let my = b.y + s.head;
    for (const list of [c.fields, c.methods]) {
      if (!list.length) continue;
      g += `<path class="dg-rule" d="M${b.x} ${my} H${b.x + b.w}"/>`;
      my += 4;
      for (const m of list) {
        my += LINE;
        g += `<text class="dg-member" x="${b.x + PAD}" y="${my - 4}">${esc(m)}</text>`;
      }
      my += 6;
    }
    nodes += g + "</g>";
  }
  return wrap(Math.max(width, arcRight + 40, labelRight + 6), height, edges + nodes, d.caption, opts.label);
}

function renderObjects(d: ObjectDiagramT): string {
  const PAD = 12, GAP = 18, VAR_H = 34, COL_GAP = 84;
  const varW = d.vars.length ? Math.max(...d.vars.map((v) => v.name.length * MONO + 18 + (v.value ? v.value.length * MONO + 18 : 32))) : 0;
  const objW = Math.max(120, ...d.objects.flatMap((o) => [o.type.length * SANS + 2 * PAD, ...o.fields.map((f) => (f.name.length + (f.value?.length ?? 0) + 3) * MONO + 2 * PAD + (f.to ? 24 : 0))]));
  const ox = d.vars.length && d.objects.length ? varW + COL_GAP : d.objects.length ? 0 : varW;
  const objBox = new Map<string, Box & { rows: number[] }>();
  let y = 0;
  for (const o of d.objects) {
    const h = 30 + (o.fields.length ? o.fields.length * 22 + 8 : 0);
    objBox.set(o.id, { x: ox, y, w: objW, h, rows: o.fields.map((_, i) => y + 30 + 4 + i * 22 + 11) });
    y += h + GAP;
  }
  const objH = y - GAP;
  const varsH = d.vars.length * (VAR_H + 12) - 12;
  const height = Math.max(objH, varsH);
  const vy0 = (height - varsH) / 2;

  let out = "";
  const hi = (id: string) => (d.highlight.includes(id) ? " is-hi" : "");
  // Variables.
  d.vars.forEach((v, i) => {
    const y = vy0 + i * (VAR_H + 12);
    const nameW = v.name.length * MONO + 18;
    const slotW = varW - nameW;
    out += `<g class="dg-var${hi(v.name)}"><rect class="dg-box" x="0" y="${y}" width="${varW}" height="${VAR_H}" rx="8"/>`;
    out += `<text class="dg-member dg-member--name" x="9" y="${y + 22}">${esc(v.name)}</text>`;
    out += `<path class="dg-rule" d="M${nameW} ${y} V${y + VAR_H}"/>`;
    if (v.to) out += `<circle class="dg-dot" cx="${nameW + slotW / 2}" cy="${y + VAR_H / 2}" r="4.5"/>`;
    else out += `<text class="dg-member" x="${nameW + slotW / 2}" y="${y + 22}" text-anchor="middle">${esc(v.value ?? "null")}</text>`;
    out += "</g>";
    if (v.to) {
      const t = objBox.get(v.to)!;
      const s = { x: nameW + slotW / 2, y: y + VAR_H / 2 }, e = { x: t.x, y: t.y + 15 };
      const mx = (s.x + e.x) / 2;
      out += `<path class="dg-edge" d="M${s.x} ${s.y} C${mx} ${s.y} ${mx} ${e.y} ${e.x - 2} ${e.y}"/>`;
      out += `<polygon class="dg-head dg-head--solid" points="${arrowHead(e, { x: mx, y: e.y }, 10, 5)}"/>`;
    }
  });
  // Objects.
  let refs = "";
  let lane = 0;
  for (const o of d.objects) {
    const b = objBox.get(o.id)!;
    out += `<g class="dg-node${hi(o.id)}"><rect class="dg-box" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10"/>`;
    out += `<text class="dg-name" x="${b.x + PAD}" y="${b.y + 20}">${esc(o.type)}</text>`;
    if (o.fields.length) out += `<path class="dg-rule" d="M${b.x} ${b.y + 30} H${b.x + b.w}"/>`;
    o.fields.forEach((f, i) => {
      const ry = b.rows[i];
      out += `<text class="dg-member" x="${b.x + PAD}" y="${ry + 4}">${esc(f.name)}${f.to ? "" : ` = ${esc(f.value ?? "null")}`}</text>`;
      if (f.to) {
        const dx = b.x + b.w - 18;
        out += `<circle class="dg-dot" cx="${dx}" cy="${ry}" r="4.5"/>`;
        const t = objBox.get(f.to)!;
        const loopX = b.x + b.w + 22 + 12 * lane++;
        const ty = t.y + 15;
        refs += `<path class="dg-edge" d="M${dx} ${ry} H${loopX} V${ty} H${t.x + t.w + 2}"/>`;
        refs += `<polygon class="dg-head dg-head--solid" points="${arrowHead({ x: t.x + t.w, y: ty }, { x: loopX, y: ty }, 10, 5)}"/>`;
      }
    });
    out += "</g>";
  }
  const width = d.objects.length ? ox + objW + (lane ? 30 + 12 * lane : 0) : varW;
  return wrap(width, height, refs + out, d.caption);
}

function wrap(w: number, h: number, inner: string, caption?: string, label?: string): string {
  const m = 8;
  const vb = `${-m} ${-m} ${w + 2 * m} ${h + 2 * m}`;
  const aria = label ?? caption ?? "Diagram";
  // Shrink to fit narrow screens, but never below 65% — wider diagrams scroll sideways instead.
  const nat = Math.round(w + 2 * m);
  const svg = `<svg class="dg" viewBox="${vb}" width="${nat}" style="width:100%;max-width:${nat}px;min-width:${Math.round(nat * 0.65)}px;height:auto" role="img" aria-label="${esc(aria)}">${inner}</svg>`;
  return `<figure class="diagram">${svg}${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}</figure>`;
}
