#!/usr/bin/env node
// 🏰 Fort Josh — THREAT-SHAPE doser: search for a safe way to make a level that
// nobody can lose actually ask a question.
//
//   node tools/td-threat.js                 # audit: what counter does each level's late game demand?
//   node tools/td-threat.js 22,26,30         # grid-search those levels for a safe (wave, dose)
//   DOSES=2,3,4,5,6 node tools/td-threat.js 26
//   TYPE=cushion node tools/td-threat.js 26  # try a different shape
//
// WHY THIS FILE IS IN THE REPO. The fork sweep sat open for two whole releases
// because its generator was a scratch script that got thrown away, so "re-run it
// over the newer maps" was unactionable — and two worlds shipped with no lever.
// The same would happen here: 10 of 36 levels still finish 20/20 on normal, and
// the only way to move one is a per-level (wave, dose) search that has to be
// repeatable. It uses the SHIPPED oracle verbatim (dart-swarm vs a fixed mixed
// plan, best of the two, no tier-4 branches) — tuning against a stronger solver
// is what got World 4 reverted.
//
// WHAT IS ALREADY SETTLED (do not re-measure):
//   * bigger HP piles, backbone stat shape, gold, budget base, lane length and
//     side-door dose are each measured NOT to move a flat level;
//   * an additive mini-boss is a disguised constant (spread 0 across 8 seeds at
//     every hp, with or without a jam/summon kit);
//   * `heal` is the lever that works — it is a DPS-THRESHOLD shape, and it was
//     the one counter appearing on a single level (L4) in the whole campaign.
//
// THREE LAWS THE SEARCH ENFORCES, each learned by breaking one:
//   1. FORK LEVELS ARE EXCLUDED. L31's swap measured beautifully and still broke
//      the build: `TD7 lever advantage` needs a thin board to LOSE on the short
//      route and WIN with the diversion thrown, and making the level harder made
//      it lose on both. A fork level's difficulty IS its lever's value.
//   2. A candidate is screened on 4 seeds and CONFIRMED on 8. Two doses looked
//      clean on 4 and lost heroic on 8 (L26 w12 x3, L22 w12 x5).
//   3. The swap REPLACES the wave's one special and returns the reclaimed HP to
//      the fattest backbone group. Every late wave of every flat level already
//      carries exactly one special, so `W5 wave composition` forbids ADDING one;
//      returning the HP keeps the +/-25% budget number and RAISES the >=70%
//      backbone share, so all three contracts hold by construction. Never let the
//      swap ADD hp, and never drain the FLIER group — that would silently delete
//      the anti-air property `AUDIT threat shape` protects.
const path = require("path");
const ROOT = path.join(__dirname, "..");
const TD = require(path.join(ROOT, "scripts/td-logic.js"));
const DATA = require(path.join(ROOT, "scripts/td-data.js"));

const BACK = new Set(DATA.BACKBONE_TYPES), VALVE = new Set(["pinata"]);
const cost = (l, t) => DATA.TOWERS[l].tiers[t].cost;
const DART = ["dart"];
const MIXED = ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"];
// Levels carrying a lever (derived, so a tenth world inherits the exclusion).
const FORKS = new Set(DATA.LEVELS.filter((l) => (l.paths || []).length > 1).map((l) => l.id));

function playWith(level, seed, plan, difficulty) {
  const e = TD.createEngine(level, { seed, difficulty });
  const padIds = level.pads.map((p) => p.id);
  let idx = 0, guard = 0;
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
      e.callWave();
    }
    e.tick();
  }
  return e.state.phase === "won" ? e.state.lives : -1;
}
const best = (lv, s, d) => Math.max(playWith(lv, s, DART, d), playWith(lv, s, MIXED, d));
function neglect(lv, s) {
  const e = TD.createEngine(lv, { seed: s });
  let g = 0;
  while (e.state.phase !== "won" && e.state.phase !== "lost" && g++ < 400000) { if (e.state.phase === "build") e.callWave(); e.tick(); }
  return e.state.phase;
}

function swapped(level, waveNo, count, type) {
  const L = JSON.parse(JSON.stringify(level));
  const w = L.waves[waveNo - 1];
  if (!w || w.boss) return null;
  const gi = w.groups.findIndex((g) => !BACK.has(g.type) && !VALVE.has(g.type));
  if (gi < 0) return null;
  const old = w.groups[gi];
  const oldHp = DATA.ENEMIES[old.type].hp * old.count;
  const newHp = DATA.ENEMIES[type].hp * count;
  if (newHp > oldHp) return null;                    // an HP-preserving swap never ADDS
  w.groups[gi] = { type, count, gap: old.gap, delay: old.delay };
  if (old.at != null) w.groups[gi].at = old.at;
  const backs = w.groups.filter((g) => BACK.has(g.type) && !DATA.ENEMIES[g.type].flier)
    .sort((a, b) => DATA.ENEMIES[b.type].hp * b.count - DATA.ENEMIES[a.type].hp * a.count);
  if (backs.length) backs[0].count += Math.max(0, Math.round((oldHp - newHp) / DATA.ENEMIES[backs[0].type].hp));
  return { level: L, was: old.type, count };
}

// ---- audit mode: which counters does each level's late game never ask for? ----
const TRAITS = {
  air: (e) => !!e.flier, armor: (e) => (e.armor || 0) > 0, shield: (e) => (e.shield || 0) > 0,
  splashRes: (e) => (e.splashResist || 0) > 0, bonkRes: (e) => (e.bonkResist || 0) > 0,
  zapRes: (e) => (e.zapResist || 0) > 0, slowImm: (e) => !!e.slowImmune, slowHeal: (e) => !!e.slowHeal,
  hidden: (e) => !!e.phase || !!e.tunnel, heal: (e) => !!e.heal, spawn: (e) => !!e.spawner, hurry: (e) => !!e.hurry,
};
function audit() {
  const keys = Object.keys(TRAITS);
  console.log("lvl  world      " + keys.map((k) => k.padStart(9)).join("") + "   (% of late-wave HP)");
  for (const lvl of DATA.LEVELS) {
    let total = 0; const by = {};
    for (const w of lvl.waves.slice(-5)) {
      if (w.boss) continue;
      for (const g of w.groups) {
        const def = DATA.ENEMIES[g.type];
        if (!def || def.boss) continue;
        const hp = def.hp * g.count; total += hp;
        for (const [k, f] of Object.entries(TRAITS)) if (f(def)) by[k] = (by[k] || 0) + hp;
      }
    }
    const cells = keys.map((k) => (total && by[k] ? Math.round(by[k] / total * 100) + "%" : "·").padStart(9)).join("");
    console.log(String(lvl.id).padStart(4) + " " + lvl.world.padEnd(10) + cells + "  " + lvl.name);
  }
}

const SCREEN = [1, 3, 5, 7];
const FULL = [1, 3, 5, 7, 11, 13, 17, 19];
const TYPE = process.env.TYPE || "healer";
const DOSES = (process.env.DOSES || "2,3,4,5,6,8").split(",").map(Number);
const arg = process.argv[2];

if (!arg) { audit(); process.exit(0); }

for (const id of arg.split(",").map(Number)) {
  const base = DATA.LEVELS.find((l) => l.id === id);
  if (!base) { console.log(`L${id}: no such level`); continue; }
  if (FORKS.has(id)) { console.log(`L${id} ${base.name}: SKIPPED — carries a lever (its difficulty is the lever's value)`); continue; }
  const n = base.waves.length;
  // Measure the level's OWN baseline first. The screen used to be
  // `!nn.every(x => x === 20)`, which is only equivalent to "the dose did
  // something" on a level that starts at a flat 20 — on L33, whose base is
  // 20,19,20,20,19,20,20,20, two doses "passed" while reproducing the baseline
  // EXACTLY. A criterion that a no-op satisfies is the same defect as a test
  // that cannot fail, so a candidate must now cost strictly more than the
  // untouched level does.
  const baseNormal = SCREEN.map((sd) => best(base, sd, "normal"));
  const baseSum = baseNormal.reduce((a, b) => a + b, 0);
  let baseFullSum = null;   // computed lazily: only needed if something survives the screen
  const hits = [];
  for (let wv = Math.max(1, n - 5); wv <= n; wv++) {
    for (const dose of DOSES) {
      const sw = swapped(base, wv, dose, TYPE);
      if (!sw) continue;
      const nn = SCREEN.map((s) => best(sw.level, s, "normal"));
      if (nn.some((x) => x < 0)) continue;
      if (nn.reduce((a, b) => a + b, 0) >= baseSum) continue;   // no-op or easier: not a dose
      const hh = SCREEN.map((s) => best(sw.level, s, "heroic"));
      if (hh.some((x) => x < 0)) continue;
      if (neglect(sw.level, SCREEN[0]) !== "lost") continue;
      hits.push({ wv, dose, was: sw.was, nn, level: sw.level });
      console.log(`L${id} w${wv} ${sw.was} x${dose} SCREEN-OK | normal ${nn.join(",")} | heroic ${hh.join(",")}`);
    }
  }
  if (!hits.length) { console.log(`L${id} ${base.name}: NO safe (wave,dose) in the grid`); continue; }
  // Confirm a SPREAD of candidates, not just the most aggressive ones. The first
  // cut sorted by strongest normal movement and 8-seed-confirmed the top 3 —
  // which on L34 meant every confirmed candidate was one that blows out heroic,
  // while the mild ones that might have survived were never tested at all. What
  // you actually want is the GENTLEST dose that still moves the level, so try
  // the strongest, the weakest and the middle.
  baseFullSum = FULL.map((sd) => best(base, sd, "normal")).reduce((a, b) => a + b, 0);
  hits.sort((a, b) => a.nn.reduce((s, x) => s + x, 0) - b.nn.reduce((s, x) => s + x, 0));
  const pick = hits.length <= 3 ? hits
    : [hits[0], hits[Math.floor(hits.length / 2)], hits[hits.length - 1]];
  for (const h of pick) {
    const nn = FULL.map((s) => best(h.level, s, "normal"));
    const hh = FULL.map((s) => best(h.level, s, "heroic"));
    const dd = FULL.map((s) => playWith(h.level, s, DART, "normal"));
    // Compare like with like: this arm runs FULL seeds, so it must be judged
    // against a FULL-seed baseline. The first cut compared an 8-seed sum to the
    // 4-seed screen baseline, which is always smaller, so every candidate
    // reported FAIL — including one with zero heroic losses. A fix that
    // introduces its own false negative is exactly the failure this tool has
    // now produced three times, so the baseline is computed per arm.
    const ok = !hh.some((x) => x < 0) && !nn.some((x) => x < 0) &&
      nn.reduce((a, b) => a + b, 0) < baseFullSum;
    console.log(`L${id} w${h.wv} ${h.was} x${h.dose} @8seeds ${ok ? "PASS" : "FAIL"} | normal ${nn.join(",")} | heroic ${hh.join(",")} | dart ${dd.join(",")}`);
  }
}
