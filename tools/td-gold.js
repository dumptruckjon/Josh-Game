#!/usr/bin/env node
/**
 * 💰 What does a MAXED board do with its gold?
 *
 * Reported from real play: "on normal I end levels with thousands of extra
 * money even when I have max level towers on every spot." The shipped oracle
 * (tools/td-sim.js) deliberately stops at tier 3 and never buys a tier-4
 * branch, so it cannot see this at all — it is still spending when a real
 * player has run out of things to buy.
 *
 * This walks a level with a player-shaped build: fill every pad, upgrade
 * everything to tier 3, then take a tier-4 branch on every tower, and report
 * per wave: gold banked, what it could still buy, and the wave the board
 * became UNSPENDABLE (nothing left to purchase at any price).
 *
 *   node tools/td-gold.js            # every level, normal
 *   node tools/td-gold.js 20,24      # just those
 *   DIFF=heroic node tools/td-gold.js
 */
const path = require("path");
const ROOT = path.join(__dirname, "..");
const TD = require(path.join(ROOT, "scripts/td-logic.js"));
const DATA = require(path.join(ROOT, "scripts/td-data.js"));

const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
const branchKeys = (line) => Object.keys(DATA.TOWERS[line].branches || {});

// The MIXED plan the shipped oracle uses, so the board shape matches the one
// every winnability sim is tuned against.
const MIXED = ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"];

function run(level, seed, difficulty) {
  const e = TD.createEngine(level, { seed, difficulty });
  const padIds = level.pads.map((p) => p.id);
  let idx = 0, guard = 0;
  const rows = [];
  let maxedAt = null;

  const spendAll = () => {
    let spent = true;
    while (spent) {
      spent = false;
      // 1. fill an empty pad
      for (const pid of padIds) {
        if (!e.state.towers.find((t) => t.padId === pid)) {
          const line = MIXED[idx % MIXED.length];
          if (e.state.gold >= e.priceOf("build", line)) { if (e.place(line, pid).ok) { idx++; spent = true; } }
          break;
        }
      }
      if (spent) continue;
      // 2. upgrade the lowest tier
      const ups = e.state.towers.filter((t) => t.tier < 3).sort((a, b) => a.tier - b.tier);
      for (const t of ups) {
        if (e.state.gold >= e.priceOf("upgrade", t.id)) { if (e.upgrade(t.id).ok) { spent = true; break; } }
      }
      if (spent) continue;
      // 3. take a tier-4 branch — what a real player does, and what the shipped
      //    oracle deliberately never does
      for (const t of e.state.towers.filter((x) => x.tier === 3)) {
        const keys = branchKeys(t.lineId);
        if (!keys.length) continue;
        const k = keys[0];
        if (e.state.gold >= e.priceOf("branch", { towerId: t.id, choice: k })) {
          if (e.branch(t.id, k).ok) { spent = true; break; }
        }
      }
    }
  };
  // Cheapest thing still purchasable anywhere on the board, or null when the
  // board is FULL — that is the moment gold stops being a resource.
  const cheapestBuy = () => {
    let m = Infinity;
    for (const pid of padIds) if (!e.state.towers.find((t) => t.padId === pid)) m = Math.min(m, e.priceOf("build", "dart"));
    for (const t of e.state.towers) {
      if (t.tier < 3) m = Math.min(m, e.priceOf("upgrade", t.id));
      else if (t.tier === 3 && !t.branch) for (const k of branchKeys(t.lineId)) m = Math.min(m, e.priceOf("branch", { towerId: t.id, choice: k }));
    }
    return Number.isFinite(m) ? m : null;
  };

  while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 900000) {
    if (e.state.phase === "build") {
      spendAll();
      const buy = cheapestBuy();
      if (buy === null && maxedAt === null) maxedAt = e.state.waveIdx + 1;
      rows.push({ wave: e.state.waveIdx + 1, gold: e.state.gold, cheapest: buy, lives: e.state.lives });
      e.callWave();
    }
    e.tick();
  }
  return { phase: e.state.phase, lives: e.state.lives, gold: e.state.gold, rows, maxedAt, waves: level.waves.length };
}

const DIFF = process.env.DIFF || "normal";
const SEED = Number(process.env.SEED || 7);
const only = /^[0-9]+(,[0-9]+)*$/.test(process.argv[2] || "") ? process.argv[2].split(",").map(Number) : null;
const levels = DATA.LEVELS.filter((l) => !only || only.includes(l.id));

console.log(`# maxed-board gold, ${DIFF}, seed ${SEED}\n`);
console.log("lvl  waves  maxed@  endGold  peakGold  deadWaves  goldWasted");
const summary = [];
for (const l of levels) {
  const r = run(l, SEED, DIFF);
  const peak = Math.max(...r.rows.map((x) => x.gold), r.gold);
  // waves played AFTER there was nothing left to buy — the stretch the report
  // is about, where income accrues against no sink at all
  const dead = r.maxedAt === null ? 0 : r.waves - r.maxedAt + 1;
  const wasted = r.gold;
  summary.push({ id: l.id, maxedAt: r.maxedAt, dead, end: r.gold, peak, phase: r.phase, waves: r.waves });
  console.log(
    String(l.id).padStart(3),
    String(r.waves).padStart(6),
    String(r.maxedAt === null ? "-" : r.maxedAt).padStart(7),
    String(r.gold).padStart(8),
    String(peak).padStart(9),
    String(dead).padStart(10),
    String(wasted).padStart(11),
    r.phase === "won" ? "" : "  <-- " + r.phase
  );
  if (only) {
    for (const x of r.rows) {
      console.log(`      w${String(x.wave).padStart(2)}  gold ${String(x.gold).padStart(5)}  cheapest-buy ${x.cheapest === null ? "NOTHING LEFT" : x.cheapest}  lives ${x.lives}`);
    }
  }
}
const withDead = summary.filter((s) => s.dead > 0);
console.log(`\n${withDead.length}/${summary.length} levels reach a board with NOTHING left to buy.`);
if (withDead.length) {
  const avgDead = withDead.reduce((a, s) => a + s.dead, 0) / withDead.length;
  const avgEnd = summary.reduce((a, s) => a + s.end, 0) / summary.length;
  console.log(`average dead waves after maxing: ${avgDead.toFixed(1)}`);
  console.log(`average gold left on the table at the end: ${Math.round(avgEnd)}`);
}

// ---------------------------------------------------------------------------
// SWEEP=1: does cutting income change anything? A board that still finishes
// maxed just banks less; only a cut deep enough to leave the board UNFINISHED
// is a difficulty lever. Run: SWEEP=1 node tools/td-gold.js 24,28,31
// ---------------------------------------------------------------------------
if (process.env.SWEEP) {
  const clone = (o) => JSON.parse(JSON.stringify(o));
  console.log("\n# income sweep — bounty x k\n");
  console.log("lvl     k   maxed@   endGold  lives  phase");
  for (const l of levels) {
    for (const k of [1.0, 0.85, 0.7, 0.55, 0.4]) {
      const lv = clone(l);
      // scale the per-kill bounty of every enemy this level can spawn
      const saved = {};
      for (const id of Object.keys(DATA.ENEMIES)) { saved[id] = DATA.ENEMIES[id].bounty; DATA.ENEMIES[id].bounty = DATA.ENEMIES[id].bounty * k; }
      const r = run(lv, SEED, DIFF);
      for (const id of Object.keys(DATA.ENEMIES)) DATA.ENEMIES[id].bounty = saved[id];
      console.log(String(l.id).padStart(3), String(k).padStart(5), String(r.maxedAt === null ? "-" : r.maxedAt).padStart(8),
        String(r.gold).padStart(9), String(r.lives).padStart(6), " " + r.phase);
    }
    console.log("");
  }
}
