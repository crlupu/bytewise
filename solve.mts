import fs from "node:fs"; import path from "node:path"; import YAML from "yaml";
import { createRequire } from "node:module";
import * as TR from "./lib/widgets/tradeoff.ts"; import * as SC from "./lib/widgets/scheduler.ts"; import * as CG from "./lib/widgets/congestion.ts"; import * as LK from "./lib/widgets/locks.ts"; import * as TC from "./lib/widgets/tcp.ts"; import * as PG from "./lib/widgets/paging.ts"; import * as BT from "./lib/widgets/btree.ts";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node-tools/node_modules/playwright");
const NEW = process.argv.slice(2);
const norm = (s: string) => s.replace(/[`*_]/g,"").replace(/&[a-z]+;/g,"").toLowerCase().replace(/[^a-z0-9<>?]/g,"");
const files: string[] = []; const walk = (d: string) => fs.readdirSync(d,{withFileTypes:true}).forEach(e => e.isDirectory()? walk(path.join(d,e.name)) : files.push(path.join(d,e.name))); walk("content");
const lessons = files.filter(f => !/topic|course|books/.test(path.basename(f))).filter(f => NEW.some(n => f.includes(n)));
const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
const p = await ctx.newPage(); const errs: string[] = []; p.on("pageerror", (e: any) => errs.push(String(e)));
let fails = 0;
// Options are shuffled at build time, so find each correct one by its text.
const clickOpts = async (scope: any, opts: any[]) => {
  const btns = scope.locator(".option");
  const texts = (await btns.allInnerTexts()).map(norm);
  for (const o of opts) if (o.correct) {
    const i = texts.indexOf(norm(String(o.text)));
    if (i < 0) throw new Error("option not found: " + o.text);
    await btns.nth(i).click();
  }
};
for (const f of lessons) {
  const doc = YAML.parse(fs.readFileSync(f, "utf8")); const [, , course, file] = f.split("/"); const lesson = file.replace(".yaml","");
  await p.goto(`http://localhost:4173/lesson/${course}/${lesson}/`); await p.waitForTimeout(400);
  let ok = true;
  for (const [i, s] of doc.steps.entries()) {
    if (s.type === "explanation") { await p.locator(".player__actions .btn--primary").click(); await p.waitForTimeout(60); continue; }
    if (s.type === "choice" || (s.type === "predict" && s.options)) await clickOpts(p, s.options);
    else if (s.type === "predict") await p.locator(".field").fill(String(Array.isArray(s.answer)? s.answer[0] : s.answer));
    else if (s.type === "blank") { const ans = [...s.template.matchAll(/\[\[([^\]]+)\]\]/g)].map((m: any) => m[1].split("|")[0]); for (const [k, a] of ans.entries()) { await p.getByRole("button", { name: new RegExp(`^Blank ${k+1}\\b`) }).click(); await p.locator(".word-bank").getByRole("button", { name: a, exact: true }).click(); } }
    else if (s.type === "order") {
      for (let guard = 0; guard < 40; guard++) {
        const texts = (await p.locator(".order-item__text").allInnerTexts()).map(norm);
        const want = s.items.map(norm); const bad = texts.findIndex((t: string, k: number) => t !== want[k]); if (bad < 0) break;
        const j = texts.indexOf(want[bad]); await p.locator(".order-item").nth(j).getByRole("button", { name: "Move up" }).click();
      }
    } else if (s.type === "match") {
      for (const pr of s.pairs) {
        const L = p.locator(".match__col").nth(0).locator(".match-item"); const R = p.locator(".match__col").nth(1).locator(".match-item");
        const lt = (await L.allInnerTexts()).map(norm); const rt = (await R.allInnerTexts()).map(norm);
        await L.nth(lt.findIndex((t: string) => t === norm(pr.left) || t.slice(1) === norm(pr.left))).click();
        await R.nth(rt.findIndex((t: string) => t === norm(pr.right) || t.slice(1) === norm(pr.right))).click();
      }
    } else if (s.type === "widget") {
      if (s.widget === "tradeoff") {
        const c = TR.config.parse(s.config), g = TR.goal.parse(s.goal ?? {}); let combos: any[] = [{}];
        for (const d of c.decisions) combos = combos.flatMap(x => d.options.map(o => ({ ...x, [d.id]: o.id })));
        const win = combos.find(ch => TR.check(g, { choices: ch }, c).met);
        for (const d of c.decisions) await p.getByRole("group", { name: d.label }).getByRole("button", { name: d.options.find(o => o.id === win[d.id])!.label, exact: true }).click();
      } else if (s.widget === "scheduler") {
        const c = SC.config.parse(s.config), g = SC.goal.parse(s.goal ?? {});
        const cands = c.algorithms.flatMap(a => (a === "RR" && c.quantumChoices ? c.quantumChoices : [c.quantum]).map(q => ({ algorithm: a, quantum: q })));
        const win = cands.find(x => SC.check(g, { ...x, time: 999 }, c).met)!;
        const names: any = { FIFO: "FIFO", SJF: "SJF", STCF: "STCF", RR: "Round robin" };
        if (c.algorithms.length > 1) await p.getByRole("group", { name: "Scheduler" }).getByRole("button", { name: names[win.algorithm], exact: true }).click();
        if (win.algorithm === "RR" && c.quantumChoices) await p.getByRole("button", { name: `slice ${win.quantum}`, exact: true }).click();
        await p.getByRole("button", { name: "Play to the end" }).click();
      } else if (s.widget === "congestion") {
        const g = CG.goal.parse(s.goal ?? {});
        if (g.variant) await p.getByRole("group", { name: "TCP variant" }).getByRole("button", { name: g.variant === "reno" ? "Reno" : "Tahoe" }).click();
        await p.locator(".cwnd").waitFor(); const max = async () => Math.max(...(await p.locator(".cwnd__val").allTextContents()).map(Number));
        while (g.cwndAtLeast && (await max()) < g.cwndAtLeast) await p.getByRole("button", { name: "All ACKed", exact: true }).click();
        for (const e of g.events ?? []) await p.getByRole("button", { name: e === "dupack" ? "3 duplicate ACKs" : "Timeout" }).click();
        while (g.rounds && (await p.locator(".cwnd__bar").count()) - 1 < g.rounds) await p.getByRole("button", { name: "All ACKed", exact: true }).click();
      } else if (s.widget === "locks") {
        // Breadth-first search over schedules for one that meets the goal, then play it.
        const c = LK.config.parse(s.config), g = LK.goal.parse(s.goal ?? {});
        type N = { st: LK.State; path: number[] };
        const q: N[] = [{ st: LK.initial(c), path: [] }]; const seen = new Set<string>(); let found: number[] | null = null;
        while (q.length && !found) {
          const n = q.shift()!; const key = JSON.stringify([n.st.pcs, n.st.holders]);
          if (seen.has(key)) continue; seen.add(key);
          if (LK.check(g, n.st, c).met) { found = n.path; break; }
          c.threads.forEach((_, t) => { if (!LK.blocked(n.st, c, t)) q.push({ st: LK.step(n.st, c, t), path: [...n.path, t] }); });
        }
        if (!found) console.log("  no schedule found for", course, lesson, i);
        for (const t of found ?? []) await p.getByRole("button", { name: `Run ${LK.threadName(c, t)}`, exact: true }).click();
      } else if (s.widget === "btree") {
        const c = BT.config.parse(s.config), g = BT.goal.parse(s.goal ?? {});
        if (g.found !== undefined) {
          await p.getByLabel("Key", { exact: true }).fill(String(g.found));
          await p.getByRole("button", { name: "Search", exact: true }).click();
        } else for (const k of c.sequence) await p.getByRole("button", { name: `Insert ${k}`, exact: true }).click();
      } else if (s.widget === "paging") {
        const c = PG.config.parse(s.config), g = PG.goal.parse(s.goal ?? {});
        if (g.algorithm && c.algorithms.length > 1) await p.getByRole("group", { name: "Policy" }).getByRole("button", { name: g.algorithm, exact: true }).click();
        if (g.frames !== undefined && c.frameChoices) await p.getByRole("button", { name: `${g.frames} frames`, exact: true }).click();
        const fwd = p.getByRole("button", { name: "Step forward", exact: true });
        while (await fwd.isEnabled()) await fwd.click();
      } else if (s.widget === "tcp") {
        const c = TC.config.parse(s.config), g = TC.goal.parse(s.goal ?? {});
        const acts = TC.actions(c);
        type N = { st: TC.State; path: number[] };
        const q: N[] = [{ st: TC.initial(c), path: [] }]; const seen = new Set<string>(); let found: number[] | null = null;
        while (q.length) {
          const n = q.shift()!; const key = JSON.stringify([n.st.client, n.st.server, n.st.pending]);
          if (seen.has(key)) continue; seen.add(key);
          if (TC.check(g, n.st).met) { found = n.path; break; }
          acts.forEach((a, ai) => { const nx = TC.act(n.st, c, a.side, a.action); if (!nx.refusal) q.push({ st: nx, path: [...n.path, ai] }); });
        }
        for (const ai of found ?? []) {
          const a = acts[ai];
          await p.locator(".tcp__actions > div").nth(a.side === "client" ? 0 : 1).getByRole("button", { name: a.label, exact: true }).click();
        }
      } else if (s.widget === "threads") {
        // Round robin: every thread reads before any writes, so unsynchronized runs lose updates
        // and synchronized ones serialize through the lock.
        for (let guard = 0; guard < 60; guard++) {
          let ran = false;
          const n = await p.locator(".thread").count();
          for (let t = 1; t <= n; t++) {
            const b = p.getByRole("button", { name: `Run T${t}`, exact: true });
            if ((await b.count()) && (await b.isEnabled())) { await b.click(); ran = true; }
          }
          if (!ran) break;
        }
      } else { console.log("  skip widget", s.widget); }
      if (s.question) await clickOpts(p.locator(".widget-question"), s.question.options);
    }
    if (await p.getByRole("button", { name: "Check", exact: true }).isDisabled()) { console.log("STUCK", course, lesson, i, s.type); ok = false; fails++; break; }
    await p.getByRole("button", { name: "Check", exact: true }).click();
    const title = await p.locator(".feedback__title").innerText();
    if (title === "Not quite") { ok = false; fails++; console.log(`FAIL ${course}/${lesson} steps[${i}] (${s.type}):`, await p.locator(".feedback--wrong").innerText()); break; }
    await p.locator(".player__actions .btn--primary").click(); await p.waitForTimeout(60);
  }
  if (ok) { const done = await p.locator(".done").count(); const books = await p.locator(".sources .list-row").count(); console.log(`ok   ${course}/${lesson}  complete=${done} books=${books}`); }
}
console.log("fails:", fails, "page errors:", errs);
await browser.close();
