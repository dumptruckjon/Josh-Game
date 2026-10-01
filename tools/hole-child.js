#!/usr/bin/env node
// 🕳️ Gobble Hole: the WANDERING-CHILD model (PLAN_GOBBLE.md §12.1).
//
// The tests' greedy bot heads for the nearest bite, so it finds the finale at
// once and can never show where a child gets stuck. This model plays the way a
// four-year-old does: it goes for what it SEES (big shiny things too, which
// only bump), pauses, wanders, and follows the hint or the edge arrow only HALF
// the time. It is a model, not a measurement of a real child — its numbers are
// for COMPARING designs, which is the only thing they were ever used for.
//
// It is the instrument behind two decisions, so it lives here rather than in a
// scratchpad (a scratch script is thrown away and the decision it justified
// becomes unrepeatable — the fort's fork sweep sat open two releases that way):
//   * the finale's CALL (§12.2): before it, once Gobble was big enough nothing
//     pointed at the finale, and from "big enough" to the win took a median of
//     16-93s by place (up to 122s); with the call, 2-9s;
//   * a hint at the NEWEST tier (§12.6) made no difference, so it was not built.
//
//   node tools/hole-child.js [places] [--newest]
//     places    a comma list of place ids (default: all twelve)
//     (default) BEFORE the call vs the SHIPPED game
//     --newest  the SHIPPED game vs a hint at the newest tier
//   SEEDS=n     runs per arm and place (default 6)
//
// Output per place and arm: the median win time [range], the median time from
// "big enough for the finale" to the win [max], the median longest gap
// between gulps, and the share of time with nothing he can eat on screen.
"use strict";
const path = require("path");
const ROOT = path.join(__dirname, "..");
const D = require(path.join(ROOT, "scripts/hole-data.js"));
const L = require(path.join(ROOT, "scripts/hole-logic.js"));
const R = D.RULES;

const argv = process.argv.slice(2);
const NEWEST = argv.includes("--newest");
const places = (argv.find((a) => !a.startsWith("--")) || "").split(",").filter(Boolean);
const SEEDS = Math.max(1, +(process.env.SEEDS || 6));
for (const id of places) if (!L.sceneById(id)) { console.error("no such place: " + id); process.exit(2); }

// What a phone in portrait shows (the canvas is about 78% of a 390x844
// screen). The island's margins mirror hole-render.js (MARGIN, THICK).
const PX = [390, 844], MARGIN = 8, THICK = 6;
function viewOf(st, cam) {
  const s = PX[0] / L.viewSpan(st, PX[0]);
  const hw = PX[0] / 2 / s, hh = PX[1] * 0.78 / 2 / s;
  const x0 = -MARGIN, x1 = st.W + MARGIN, y0 = -R.TOP_SLACK - MARGIN, y1 = st.H + THICK + MARGIN;
  const cx = x1 - x0 <= 2 * hw ? (x0 + x1) / 2 : Math.min(Math.max(cam.x, x0 + hw), x1 - hw);
  const cy = y1 - y0 <= 2 * hh ? (y0 + y1) / 2 : Math.min(Math.max(cam.y, y0 + hh), y1 - hh);
  return { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh };
}
const inView = (v, o, m) => o.x >= v.x0 + m && o.x <= v.x1 - m && o.y >= v.y0 + m && o.y <= v.y1 - m;

// One play of one place. arm: "before" (no call: the arrow only when nothing
// he can eat is in view, and the idle hint at the nearest bite, as the engine
// did before §12), "shipped" (the finale calls him once he is big enough), or
// "newest" (shipped + the hint at the newest tier, the rejected §12.6 idea).
function play(def, seed, arm) {
  const st = L.createGame(def);
  const rnd = L.rng(seed * 7919 + 13);
  const cam = { x: st.hole.x, y: st.hole.y };
  const fin = st.objects.find((o) => o.finale);
  let goal = null, nextThink = 0.8, pauseUntil = 0, lastEat = 0, longestGap = 0;
  let noEdibleT = 0, arrowSince = -1, readyAt = -1, winAt = -1;
  while (!st.done && st.t < 900) {
    cam.x += (st.hole.x - cam.x) * 0.2; cam.y += (st.hole.y - cam.y) * 0.2;
    const v = viewOf(st, cam), h = st.hole;
    const edibleOn = st.objects.some((o) => o.st === L.IDLE && o.r <= h.r * R.FIT && inView(v, o, 2));
    if (!edibleOn) { noEdibleT += L.DT; if (arrowSince < 0) arrowSince = st.t; } else arrowSince = -1;
    const top = h.level >= st.levels.R.length - 1;
    if (top && readyAt < 0) readyAt = st.t;
    // the hint the screen shows this frame
    let hinted = st.hint >= 0 ? st.objects[st.hint] : null;
    if (arm === "before" && hinted && hinted.finale) hinted = L.nearestEdible(st);   // the old hint
    if (arm === "newest" && hinted && !st.won) {
      let best = null, bd = Infinity;
      for (const o of st.objects) {
        if (o.st !== L.IDLE || o.tier !== h.level + 1 || o.r > h.r * R.FIT) continue;
        const d = L.gdist(o.x, o.y, h.x, h.y);
        if (d < bd) { bd = d; best = o; }
      }
      if (best) hinted = best;
    }
    // …and the edge arrow
    let arrow = null;
    if (!st.won) {
      if (arm !== "before" && L.goalOf(st) && !inView(v, fin, 2)) arrow = fin;
      else if (hinted && hinted.st === L.IDLE && !inView(v, hinted, 2)) arrow = hinted;
      else if (!edibleOn && arrowSince >= 0 && st.t - arrowSince >= 1.2) arrow = L.nearestEdible(st);
    }
    if (!st.won && st.t >= nextThink && st.t >= pauseUntil) {
      nextThink = st.t + 0.6 + rnd() * 1.2;
      const p = rnd();
      const visible = st.objects.filter((o) => o.st === L.IDLE && inView(v, o, 4));
      if (arrow && rnd() < 0.5) goal = { x: arrow.x, y: arrow.y };
      else if (hinted && hinted.st === L.IDLE && inView(v, hinted, 2) && rnd() < 0.5) goal = { x: hinted.x, y: hinted.y };
      else if (p < 0.4 && visible.length) {
        // the eye goes to BIG things: weighted by area
        let sum = 0; for (const o of visible) sum += o.r * o.r;
        let k = rnd() * sum, pick = visible[0];
        for (const o of visible) { k -= o.r * o.r; if (k <= 0) { pick = o; break; } }
        goal = { x: pick.x, y: pick.y };
      } else if (p < 0.7) {
        const ed = visible.filter((o) => o.r <= h.r * R.FIT);
        goal = ed.length ? (() => { const o = ed[Math.floor(rnd() * ed.length)]; return { x: o.x, y: o.y }; })() : null;
      } else if (p < 0.85) {
        const a = rnd() * Math.PI * 2, d = 20 + rnd() * 60;
        goal = { x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d };
      } else { pauseUntil = st.t + 1 + rnd() * 2.5; goal = null; }
      if (goal) L.setTarget(st, goal.x, goal.y);
    }
    L.step(st, L.DT);
    for (const ev of st.events) {
      if (ev.type === "eat") { longestGap = Math.max(longestGap, st.t - lastEat); lastEat = st.t; }
      if (ev.type === "win") winAt = st.t;
    }
    st.events.length = 0;
  }
  return { winAt, readyAt, longestGap, noEdible: noEdibleT / Math.max(1, st.t) };
}

const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const arms = NEWEST ? ["shipped", "newest"] : ["before", "shipped"];
console.log(`wandering-child model · ${SEEDS} seed(s) · ${arms.join(" vs ")} · seconds of play`);
for (const def of D.SCENES) {
  if (places.length && !places.includes(def.id)) continue;
  const line = [def.id.padEnd(8)];
  for (const arm of arms) {
    const rs = [];
    for (let s = 1; s <= SEEDS; s++) rs.push(play(def, s, arm));
    const win = rs.map((r) => (r.winAt < 0 ? 999 : r.winAt));
    const r2w = rs.map((r) => (r.winAt < 0 || r.readyAt < 0 ? 999 : r.winAt - r.readyAt));
    line.push(`${arm}: win ${med(win).toFixed(0)}s [${Math.min(...win).toFixed(0)}-${Math.max(...win).toFixed(0)}] ` +
      `ready->win ${med(r2w).toFixed(0)}s [${Math.max(...r2w).toFixed(0)} max] ` +
      `gap ${med(rs.map((r) => r.longestGap)).toFixed(1)}s noEdible ${(100 * med(rs.map((r) => r.noEdible))).toFixed(0)}%`);
  }
  console.log(line.join(" | "));
}
