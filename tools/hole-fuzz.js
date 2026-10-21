#!/usr/bin/env node
// 🕳️ Gobble Hole — the STUCK-SPOT fuzzer (PLAN_GOBBLE.md §20). The greedy bot
// heads straight for the nearest bite, so it only ever visits the states a
// perfect player reaches. A four-year-old does not: he holds a finger anywhere,
// holds it on the water or a wall, yanks it about, lets go. This plays each
// place that way, and every few seconds it asks the one question that decides
// whether a spot is a trap: FROM HERE, can the bot still get going? A spot where
// the bot (which always has somewhere to go) stands still for STILL_S seconds is
// reported with its saved run, in the shape the regression test in
// tests/hole-logic.test.js restores ("NEVER STUCK where a fuzzer found him
// stuck"), so a finding becomes a fixture by pasting one line.
//
//   node tools/hole-fuzz.js                  every place
//   node tools/hole-fuzz.js newyear,pandas   just these
//   SEEDS=4 SECS=90 node tools/hole-fuzz.js  more plays, longer each
//
// It lived only in the audit agents' scratch space in §20 and was lost with
// them; it is in the repo so the next land does not need it re-derived.
"use strict";
const path = require("path");
const DATA = require(path.join(__dirname, "../scripts/hole-data.js"));
const L = require(path.join(__dirname, "../scripts/hole-logic.js"));
const { SCENES } = DATA;

const want = process.argv[2] ? process.argv[2].split(",") : SCENES.map((d) => d.id);
const SEEDS = +process.env.SEEDS || 2;     // plays per place
const SECS = +process.env.SECS || 60;      // seconds of child-steering per play
const EVERY = +process.env.EVERY || 2;     // seconds between checks
const STILL_S = 5;                          // the regression test's own bar
const PROBE_S = 12;                         // how long the bot gets from a spot

// a small seeded stream, so a finding can be replayed exactly
function stream(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// From a saved spot, does the bot get going? Returns the longest it stood still.
function probe(snap) {
  const st = L.restore(snap);
  if (!st) return { still: 0, lost: true };
  let lx = st.hole.x, ly = st.hole.y, still = 0, maxStill = 0;
  while (!st.won && st.t < PROBE_S) {
    const tg = L.botTarget(st);
    if (tg) L.setTarget(st, tg.x, tg.y);
    L.step(st, L.DT); st.events.length = 0;
    if (Math.hypot(st.hole.x - lx, st.hole.y - ly) > 1) { lx = st.hole.x; ly = st.hole.y; still = 0; } else still += L.DT;
    maxStill = Math.max(maxStill, still);
    if (maxStill >= STILL_S) break;
  }
  return { still: maxStill, x: st.hole.x, y: st.hole.y };
}

let stuck = 0, checked = 0;
for (const id of want) {
  const def = L.sceneById(id);
  if (!def) { console.log("FAIL " + id + ": no such place"); stuck++; continue; }
  const G = L.geomOf(def);
  let spots = 0, found = 0;
  const seen = new Set();
  for (let s = 1; s <= SEEDS; s++) {
    const R = stream(L.hashStr(id) + s * 7919);
    const st = L.createGame(def);
    const W = st.W, H = st.H;
    // a point he can NOT stand on: the water, a wall, a hedge (a finger held
    // there is how a child presses into an edge)
    const offGround = () => { for (let k = 0; k < 40; k++) { const x = R() * W, y = R() * H; if (G.walk(x, y) > 0) return [x, y]; } return [R() * W, R() * H]; };
    // …and NEAR him: just past the edge of the ground, or into a thing too
    // big to eat, a few steps away — where a finger presses him into a fence
    // end or between two drums (both §20 traps were found this close)
    const nearEdge = () => {
      const h = st.hole, big = st.objects.filter((o) => o.st === L.IDLE && o.r > h.r * DATA.RULES.FIT && Math.hypot(o.x - h.x, o.y - h.y) < 70);
      // between two of them, where little Gobble gets squeezed
      if (big.length > 1 && R() < 0.4) {
        const o = big[Math.floor(R() * big.length)];
        const p = big.filter((q) => q !== o).sort((a2, b2) => Math.hypot(a2.x - o.x, a2.y - o.y) - Math.hypot(b2.x - o.x, b2.y - o.y))[0];
        return [(o.x + p.x) / 2, (o.y + p.y) / 2];
      }
      if (big.length && R() < 0.5) { const o = big[Math.floor(R() * big.length)]; return [o.x, o.y]; }
      for (let k = 0; k < 40; k++) {
        const a = R() * Math.PI * 2, d = 10 + R() * 50, x = h.x + Math.cos(a) * d, y = h.y + Math.sin(a) * d;
        if (G.walk(x, y) > 0) return [x, y];
      }
      return offGround();
    };
    let mode = "", until = 0, tx = 0, ty = 0, nextCheck = EVERY;
    // where a held finger has pressed him into an edge: he has stood still a
    // moment with the finger far away. That is where every §20 trap was found
    // (the end of a fence, between two drums), so each such moment is checked
    // as well as the regular ones
    let lx = st.hole.x, ly = st.hole.y, still = 0, pressedChecked = false;
    while (!st.won && st.t < SECS) {
      if (st.t >= until) {
        const r = R();
        mode = r < 0.2 ? "hold" : r < 0.35 ? "edge" : r < 0.65 ? "near" : r < 0.78 ? "yank" : r < 0.85 ? "letgo" : "bot";
        until = st.t + 1 + R() * 3;
        // a finger held anywhere, often just across a wall (a path round it)
        if (mode === "hold") {
          if (R() < 0.5) { tx = R() * W; ty = R() * H; }
          else { const a = R() * Math.PI * 2, d = 30 + R() * 90; tx = st.hole.x + Math.cos(a) * d; ty = st.hole.y + Math.sin(a) * d; }
        }
        if (mode === "edge") [tx, ty] = offGround();
        if (mode === "near") [tx, ty] = nearEdge();
      }
      if (mode === "yank" && R() < 0.08) { tx = R() * W; ty = R() * H; }
      if (mode === "bot") { const tg = L.botTarget(st); if (tg) { tx = tg.x; ty = tg.y; } }
      if (mode === "letgo") L.setTarget(st, st.hole.x, st.hole.y);
      else L.setTarget(st, tx, ty);
      L.step(st, L.DT); st.events.length = 0;
      if (Math.hypot(st.hole.x - lx, st.hole.y - ly) > 1) { lx = st.hole.x; ly = st.hole.y; still = 0; pressedChecked = false; } else still += L.DT;
      const pressed = !pressedChecked && still >= 1.5 && Math.hypot(st.hole.tx - st.hole.x, st.hole.ty - st.hole.y) > 15;
      if (pressed || st.t >= nextCheck) {
        if (pressed) pressedChecked = true; else nextCheck += EVERY;
        if (st.fly) continue;               // mid-flight is not a spot
        const snap = L.snapshot(st);
        const p = probe(snap);
        spots++; checked++;
        if (p.lost) { console.log("FAIL " + id + ": a saved spot does not restore"); stuck++; continue; }
        if (p.still >= STILL_S) {
          // one report per trap (a child stuck in one stays stuck: the same
          // spot every check after), and the play stops there
          const key = Math.round(p.x / 3) + "," + Math.round(p.y / 3);
          if (seen.has(key)) break;
          seen.add(key);
          found++; stuck++;
          console.log("STUCK " + id + " seed " + s + " at t=" + st.t.toFixed(1) + "s, level " + st.hole.level + ": the bot stood still " +
            p.still.toFixed(1) + "s at " + p.x.toFixed(1) + "," + p.y.toFixed(1) + "\n  " + JSON.stringify(snap));
          break;
        }
      }
    }
  }
  console.log(id + ": " + spots + " spots checked, " + found + " stuck");
}
console.log("fuzzed " + want.length + " place(s), " + checked + " spots, " + stuck + " stuck");
process.exit(stuck ? 1 : 0);
