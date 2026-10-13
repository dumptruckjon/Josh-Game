#!/usr/bin/env node
// 🕳️ Gobble Hole — check a place against its laws in a few seconds, while you
// are AUTHORING it (the full proof is `node --test tests/hole-logic.test.js`,
// which also holds every place against every other).
//
//   node tools/hole-check.js            every place
//   node tools/hole-check.js zoo,golf   just these
//
// For each place: it lays out (how many things, per tier), the TIER law (each
// tier is too big until the size before it), the PROGRESS law (at every size
// twice the next grow's worth he can reach — round every wall, behind no door
// still locked — the finale reachable, every lock openable, never stranded by
// a one-way cannon), the greedy BOT wins it and how long it takes (the suite
// wants >= 20s each and >= 30s on average), its CHALLENGE (the twistsOf set)
// and whether another place already poses exactly that set. A line starting
// FAIL is a law broken; the suite will say the same, slower.
"use strict";
const path = require("path");
const DATA = require(path.join(__dirname, "../scripts/hole-data.js"));
const L = require(path.join(__dirname, "../scripts/hole-logic.js"));
const { RULES, SCENES } = DATA;

const want = process.argv[2] ? process.argv[2].split(",") : SCENES.map((d) => d.id);
const sig = (def) => [...L.twistsOf(def)].sort().join(" ");
let bad = 0;
const times = [];
for (const id of want) {
  const def = L.sceneById(id);
  if (!def) { console.log("FAIL " + id + ": no such place"); bad++; continue; }
  const out = [];
  const fail = (m) => { out.push("FAIL " + m); bad++; };
  let st;
  try { st = L.createGame(def); } catch (e) { fail("it does not lay out: " + e.message); console.log(id + "\n  " + out.join("\n  ")); continue; }
  const per = def.tiers.map((t, i) => st.objects.filter((o) => o.tier === i + 1 && !o.finale).length);
  const lv = st.levels;
  // the TIER law: at level L he can eat tier L+1 and not tier L+2
  for (let l = 0; l + 2 <= def.tiers.length; l++) {
    const R = lv.R[l], next = st.objects.filter((o) => o.tier === l + 2);
    if (!next.every((o) => o.r > R * RULES.FIT)) fail("tier law at level " + l + ": something in tier " + (l + 2) + " fits already");
  }
  const p = L.progressOf(def);
  const worst = p.levels.filter((x) => x.need != null).map((x) => (x.avail / x.need).toFixed(1));
  for (const x of p.levels) if (x.need != null && x.avail < 2 * x.need) fail("progress at level " + x.level + ": " + x.avail + " to reach for a grow needing " + x.need + " (want 2x)");
  if (!p.finale) fail("the finale cannot be reached at the top size");
  if (p.trapped.length) fail("stranded: " + JSON.stringify(p.trapped));
  const locks = new Set(st.objects.filter((o) => o.lock).map((o) => o.lock));
  for (const k of locks) if (!p.unlocked.includes(k)) fail("the lock '" + k + "' can never be opened");
  // the BOT
  const b = L.createGame(def);
  let win = null, stuckT = 0, lastXY = null;
  while (!b.done && b.t < 400) {
    if (!b.won) { const tg = L.botTarget(b); if (tg) L.setTarget(b, tg.x, tg.y); }
    L.step(b, L.DT);
    for (const ev of b.events) if (ev.type === "win") win = b.t;
    b.events.length = 0;
    // a bot standing still for 20s is stuck
    if (Math.round(b.t * 60) % 60 === 0) {
      const xy = Math.round(b.hole.x) + "," + Math.round(b.hole.y);
      stuckT = xy === lastXY ? stuckT + 1 : 0;
      lastXY = xy;
      if (stuckT > 20 && !b.won) { fail("the bot stands still at " + xy + " (" + b.eaten + " of " + b.total + " eaten, level " + b.hole.level + ")"); break; }
    }
  }
  if (win == null) fail("the bot never wins (" + b.eaten + " of " + b.total + " eaten, level " + b.hole.level + ", " + b.t.toFixed(0) + "s)");
  else { times.push(win); if (win < 20) fail("the bot wins in " + win.toFixed(1) + "s (want >= 20s)"); }
  const twin = SCENES.filter((d) => d.id !== id && sig(d) === sig(def)).map((d) => d.id);
  if (twin.length) fail("poses exactly the same challenges as " + twin.join(", "));
  const W = st.W, H = st.H;
  console.log(id + "  " + W + "x" + H + "  things " + st.total + " [" + per.join("/") + "]  bot " + (win == null ? "-" : win.toFixed(1) + "s") +
    "  progress x" + worst.join(" x") + "\n  twists: " + sig(def) + (out.length ? "\n  " + out.join("\n  ") : ""));
}
if (times.length > 1) console.log("mean bot time " + (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1) + "s over " + times.length);
process.exit(bad ? 1 : 0);
