#!/usr/bin/env node
// Fort Josh balance harness — measure any level with the SHIPPED oracle.
//
//   node tools/td-sim.js                 # every level, normal + heroic
//   node tools/td-sim.js 13,17           # just those levels
//   SEEDS=1,2,3,4,5,6 node tools/td-sim.js 20
//   DIFFS=normal,heroic,casual node tools/td-sim.js
//
// WHY THIS FILE IS IN THE REPO. Every balance claim in CLAUDE.md and the
// PLAN_*.md files was produced by a harness exactly like this one, and the
// single most expensive mistake this project made was tuning against a solver
// STRONGER than the one in the test suite (World 4 was built, passed a local
// sim, failed `PLAYABILITY`, and had to be reverted). So the oracle below is
// copied verbatim from `tests/td-logic.test.js` — fill pads in array order as
// gold allows, upgrade cheapest-tier-first, never buy a tier-4 branch, take the
// better of a dart-swarm and a fixed mixed plan. If you change one, change both.
//
// Node-only. Nothing here is loaded by the site.
const path = require("path");
const ROOT = path.join(__dirname, "..");
const TD = require(path.join(ROOT, "scripts/td-logic.js"));
const DATA = require(path.join(ROOT, "scripts/td-data.js"));

const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;

function playWith(level, seed, plan, difficulty) {
  const e = TD.createEngine(level, { seed, difficulty });
  const padIds = level.pads.map((p) => p.id);
  let idx = 0, guard = 0;
  const livesAtWave = [];
  while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 900000) {
    if (e.state.phase === "build") {
      let spent = true;
      while (spent) {
        spent = false;
        for (const pid of padIds) {
          if (!e.state.towers.find((t) => t.padId === pid)) {
            const line = plan[idx % plan.length];
            if (e.state.gold >= cost(line, 0)) { if (e.place(line, pid).ok) { idx++; spent = true; } }
            break;
          }
        }
        if (spent) continue;
        const ups = e.state.towers.filter((t) => t.tier < 3).sort((a, b) => a.tier - b.tier);
        for (const t of ups) { if (e.state.gold >= cost(t.lineId, t.tier)) { if (e.upgrade(t.id).ok) spent = true; break; } }
      }
      livesAtWave.push(e.state.lives);
      e.callWave();
    }
    e.tick();
  }
  return { phase: e.state.phase, lives: e.state.lives, livesAtWave };
}

const DART = ["dart"];
const MIXED = ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"];

// "Winnable" means EITHER sensible build clears it — a competent player picks
// the tool for the level, and the roster deliberately splits the two plans.
function best(level, seed, difficulty) {
  const a = playWith(level, seed, DART, difficulty), b = playWith(level, seed, MIXED, difficulty);
  if (a.phase === "won" && b.phase === "won") return a.lives >= b.lives ? a : b;
  return a.phase === "won" ? a : b.phase === "won" ? b : a;
}
function neglect(level, seed, meta) {
  const e = TD.createEngine(level, { seed, meta });
  let g = 0;
  while (e.state.phase !== "won" && e.state.phase !== "lost" && g++ < 400000) { if (e.state.phase === "build") e.callWave(); e.tick(); }
  return e.state.phase;
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

const SEEDS = (process.env.SEEDS || "7,23,99,404").split(",").map(Number);
const DIFFS = (process.env.DIFFS || "normal,heroic").split(",");
const only = process.argv[2] ? process.argv[2].split(",").map(Number) : null;
const ALL_META = DATA.META_NODES.map((n) => n.id);

// ---- --lever: what is a fork's lever actually WORTH? ----
//
//   node tools/td-sim.js 15,23 --lever
//
// A full board kills everything on either route, so the lever is unmeasurable at
// full strength — its value shows up on a THIN build, exactly as the shipped
// `TD7 lever advantage` guardrail defines it: a build that LOSES on the short
// route and WINS with the lever thrown. That is the knife edge, and it is the
// right way to CHOOSE between fork candidates: L23's longest candidate (1.46x)
// left a thin build losing on both routes, while the shorter one (1.42x) rescued
// a 7-, 8- OR 9-pad build on every seed. Longest != best.
//
// Pair it with tools/td-fork-search.js, which finds candidates that need no pad
// moved; this says which of them is worth shipping.
function playCapped(level, seed, plan, pull, cap) {
  const e = TD.createEngine(level, { seed, difficulty: "normal" });
  const padIds = level.pads.map((p) => p.id).slice(0, cap);
  let idx = 0, guard = 0;
  while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 900000) {
    if (e.state.phase === "build") {
      let spent = true;
      while (spent) {
        spent = false;
        for (const pid of padIds) {
          if (!e.state.towers.find((t) => t.padId === pid)) {
            const line = plan[idx % plan.length];
            if (e.state.gold >= cost(line, 0) && e.place(line, pid).ok) { idx++; spent = true; }
            break;
          }
        }
        if (spent) continue;
        const ups = e.state.towers.filter((t) => t.tier < 3).sort((a, b) => a.tier - b.tier);
        for (const t of ups) if (e.state.gold >= cost(t.lineId, t.tier)) { if (e.upgrade(t.id).ok) spent = true; break; }
      }
      e.callWave();
    }
    // keep the long route thrown — pullLever has a cooldown, so just retry
    if (pull && e.state.leverRoute !== 1) e.pullLever();
    e.tick();
  }
  return e.state.phase === "won" ? e.state.lives : null;
}
if (process.argv.includes("--lever")) {
  for (const lvl of DATA.LEVELS.filter((l) => l.fork && (!only || only.includes(l.id)))) {
    console.log(`\nL${lvl.id} ${lvl.name}  (${lvl.pads.length} pads)`);
    for (const cap of [6, 7, 8, 9, 10, 11]) {
      const row = [];
      for (const [name, plan] of [["dart", DART], ["mixed", MIXED]]) {
        const off = SEEDS.map((s) => playCapped(lvl, s, plan, false, cap));
        const on = SEEDS.map((s) => playCapped(lvl, s, plan, true, cap));
        const w = (r) => r.filter((x) => x !== null).length;
        row.push(`${name} short ${w(off)}/${SEEDS.length} → LONG ${w(on)}/${SEEDS.length}`);
      }
      console.log(`   cap ${String(cap).padStart(2)}  ${row.join("   |   ")}`);
    }
  }
  process.exit(0);
}

// ---- --boss: sweep a finale's boss hp x leak toll, looking for SPREAD ----
//
//   node tools/td-sim.js 8 --boss
//   BOSS_HP=5200,6400,7600 BOSS_TOLL=4,6,8 node tools/td-sim.js 8 --boss
//
// A finale is QUANTIZED when its level leaks nothing before the boss wave: the
// whole run then reduces to "does the boss die?", one leak is worth its entire
// toll, and the outcome can only land on a few values. The tell is not a bad
// median — it is ZERO VARIANCE. L8 measured heroic 10 on all 8 seeds.
//
// So this prints the SPREAD (min..max) as well as the median, because a sweep
// judged on medians alone will happily pick a setting that is perfectly flat.
// It mutates DATA in-process rather than editing the data file between runs, so
// every row goes through the same shipped `best()`.
if (process.argv.includes("--boss")) {
  const HPS = (process.env.BOSS_HP || "").split(",").filter(Boolean).map(Number);
  const TOLLS = (process.env.BOSS_TOLL || "").split(",").filter(Boolean).map(Number);
  for (const lvl of DATA.LEVELS.filter((l) => !only || only.includes(l.id))) {
    const finale = lvl.waves[lvl.waves.length - 1];
    const key = (finale.groups || []).map((g) => g.type).find((t) => DATA.ENEMIES[t] && DATA.ENEMIES[t].boss);
    if (!key) { console.log(`L${lvl.id} ${lvl.name}: no boss finale`); continue; }
    const def = DATA.ENEMIES[key], hp0 = def.hp, toll0 = def.lives;
    console.log(`\nL${lvl.id} ${lvl.name} — ${def.name} (shipped hp ${hp0}, toll ${toll0})`);
    for (const hp of (HPS.length ? HPS : [hp0])) {
      for (const toll of (TOLLS.length ? TOLLS : [toll0])) {
        def.hp = hp; def.lives = toll;
        const cols = [];
        for (const d of DIFFS) {
          const r = SEEDS.map((s) => best(lvl, s, d));
          const w = r.filter((x) => x.phase === "won").map((x) => x.lives);
          const lost = r.length - w.length;
          cols.push(w.length
            ? `${d} ${w.join(",")} med ${median(w)} spread ${Math.min(...w)}..${Math.max(...w)}${lost ? ` LOST x${lost}` : ""}`
            : `${d} LOST on every seed`);
        }
        console.log(`   hp=${String(hp).padStart(5)} toll=${toll} | ${cols.join(" | ")}`);
      }
    }
    def.hp = hp0; def.lives = toll0;
  }
  process.exit(0);
}

// ---- --swap: the BACKBONE STAT-SHAPE lever, at ~0% budget drift ----
//
//   node tools/td-sim.js 23 --swap
//   SWAP_FROM=2 SWAP_TO=3 SWAP_AT=0.5 node tools/td-sim.js 23,30,31 --swap
//
// Every world's ground backbone is the SAME four shapes wearing local names:
// slot 0 a 34hp/0.8 body, slot 1 the 90hp/0.6 armored Knight, slot 2 the 60hp/0.7
// splitter Blob, slot 3 a 16hp/1.7 swarm body. Substituting one slot for another
// and rescaling the count to preserve HP changes what a wave IS — how many
// bodies, how fast, whether armor matters — while leaving the ±25% budget curve
// it was authored against essentially untouched. That is the one lever left for a
// level that measures as a formality, because bigger HP piles are documented not
// to work anywhere in this engine.
//
// PLAN_EXPANSION.md §8 records this as a real and LARGE lever *and a cliff*, and
// marks its own numbers [unverified] — which is why it lives here rather than in
// a scratch file. It prints the whole per-seed row, and the drift it actually
// caused, so a swap can never be adopted on a median alone.
if (process.argv.includes("--swap")) {
  const FROM = Number(process.env.SWAP_FROM || 0), TO = Number(process.env.SWAP_TO || 3);
  const AT = Number(process.env.SWAP_AT || 0.5);          // swap waves from this fraction on
  for (const lvl of DATA.LEVELS.filter((l) => !only || only.includes(l.id))) {
    const bb = (DATA.WORLDS[lvl.world] || {}).backbone;
    if (!bb) { console.log(`L${lvl.id}: no world backbone`); continue; }
    const from = bb.ground[FROM], to = bb.ground[TO];
    const first = Math.ceil(lvl.waves.length * AT);
    // HP-PRESERVING substitution, rebuilt as a fresh level object so DATA is untouched
    let moved = 0, drift = 0, total = 0;
    const waves = lvl.waves.map((w, i) => {
      total += w.groups.reduce((s, g) => s + DATA.ENEMIES[g.type].hp * g.count, 0);
      if (i < first || w.boss) return w;
      return Object.assign({}, w, { groups: w.groups.map((g) => {
        if (g.type !== from) return g;
        const hp = DATA.ENEMIES[from].hp * g.count;
        const n = Math.max(1, Math.round(hp / DATA.ENEMIES[to].hp));
        moved++; drift += DATA.ENEMIES[to].hp * n - hp;
        return Object.assign({}, g, { type: to, count: n });
      }) });
    });
    const swapped = Object.assign({}, lvl, { waves });
    console.log(`\nL${lvl.id} ${lvl.name} — ${from} → ${to} from wave ${first + 1} on ` +
      `(${moved} groups, budget drift ${(100 * drift / total).toFixed(2)}%)`);
    if (!moved) { console.log("   (nothing to swap — that slot does not appear in those waves)"); continue; }
    for (const [label, target] of [["BEFORE", lvl], ["AFTER ", swapped]]) {
      const cols = [];
      for (const d of DIFFS) {
        const r = SEEDS.map((s) => best(target, s, d));
        const w = r.filter((x) => x.phase === "won").map((x) => x.lives);
        const lost = r.length - w.length;
        cols.push(w.length ? `${d} ${w.join(",")} med ${median(w)}${lost ? ` LOST x${lost}` : ""}` : `${d} LOST on every seed`);
      }
      console.log(`   ${label} | ${cols.join(" | ")}`);
    }
  }
  process.exit(0);
}

// ---- --gold: sweep startGold, the opening-board knob ----
//
//   GOLDS=1000,1200,1500 node tools/td-sim.js 33 --gold
//
// startGold decides the OPENING board, and the difficulty audit measured that
// 76% of all damage lands in waves 1-3 — so on a fresh level it is the knob with
// the most authority. (On a TUNED level it is documented as near-inert upward:
// raising it just trivializes.) Prints every seed, because a median hides the
// floor and the floor is what `AUDIT heroic is a SLOPE` actually rides on.
if (process.argv.includes("--gold")) {
  const GOLDS = (process.env.GOLDS || "").split(",").filter(Boolean).map(Number);
  for (const lvl of DATA.LEVELS.filter((l) => !only || only.includes(l.id))) {
    console.log(`\nL${lvl.id} ${lvl.name} (shipped startGold ${lvl.startGold})`);
    for (const g of (GOLDS.length ? GOLDS : [lvl.startGold])) {
      const alt = Object.assign({}, lvl, { startGold: g });
      const cols = [];
      for (const d of DIFFS) {
        const r = SEEDS.map((s) => best(alt, s, d));
        const w = r.filter((x) => x.phase === "won").map((x) => x.lives);
        const lost = r.length - w.length;
        cols.push(w.length
          ? `${d} ${w.join(",")} med ${median(w)} min ${Math.min(...w)}${lost ? ` LOST x${lost}` : ""}`
          : `${d} LOST on every seed`);
      }
      console.log(`   gold=${String(g).padStart(5)} | ${cols.join(" | ")}`);
    }
  }
  process.exit(0);
}

for (const lvl of DATA.LEVELS.filter((l) => !only || only.includes(l.id))) {
  const cols = [];
  for (const d of DIFFS) {
    const r = SEEDS.map((s) => best(lvl, s, d));
    const lives = r.filter((x) => x.phase === "won").map((x) => x.lives);
    const lost = SEEDS.filter((s, i) => r[i].phase !== "won");
    cols.push(`${d} ${lost.length ? "LOST@" + lost.join("/") : lives.join(",") + " med " + median(lives)}`);
  }
  // "losable by neglect" is checked with the FULL star tree owned too — a
  // future ability that let a do-nothing build survive would otherwise ship.
  const n = `${neglect(lvl, SEEDS[0])}/${neglect(lvl, SEEDS[0], ALL_META)}`;
  console.log(`L${String(lvl.id).padStart(2)} ${lvl.name.padEnd(20)} ${cols.join(" | ")} | neglect ${n}`);
}
