#!/usr/bin/env node
// ---- td-miniboss: is an ADDITIVE elite a real difficulty lever? ----
//
//   node tools/td-miniboss.js 26                 # sweep hp on one level
//   HP=2600 KIT=disable node tools/td-miniboss.js 26,27
//   WAVES=2 TOLL=4 node tools/td-miniboss.js 26
//
// WHY THIS EXISTS, AND WHAT IT MUST NOT REPEAT. Two shapes are already refuted
// and this tool is built to reproduce both before anything is designed on top:
//
//   1. The HP-PRESERVING SWAP (tools/td-elite.js) is not leak-preserving. Every
//      small body it replaces carries `lives: 1`, so trading ~97 bodies for ~10
//      elites REMOVES ~97 potential leak-lives and adds 10. Concentration cuts a
//      level's leak capacity, which is the opposite of difficulty.
//
//   2. The ADDITIVE fat body moves the median but is recorded as a DISGUISED
//      CONSTANT: spread 0 across 8 seeds at every hp, with or without a
//      disable/spawn kit. A level that costs the same on every seed asks the
//      player nothing; it just charges a toll.
//
// So the metric here is NOT "did the median move". It is the four rules the
// shipped threat-shape doser already enforces, plus spread:
//
//   moves3*   the 3-star outcome must actually change   (stars3 < baseline)
//   keeps3*   ...and must not become unreachable        (stars3 > 0)
//   spread    lives must not be identical on every seed (the disguised constant)
//   diversity the mixed plan must beat dart-only on MORE seeds than baseline —
//             this is what a dose is FOR, and it is the rule that separated
//             every shipped healer dose from every rejected one
//
// A candidate that moves the median and fails `spread` or `diversity` is the
// refuted shape wearing new numbers, and this tool says so out loud.
const path = require("path");
const ROOT = path.join(__dirname, "..");
const TD = require(path.join(ROOT, "scripts/td-logic.js"));
const DATA = require(path.join(ROOT, "scripts/td-data.js"));

const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
const DART = ["dart"];
const MIXED = ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"];

// The SHIPPED oracle, copied verbatim from tests/td-logic.test.js — never a
// stronger solver. Tuning against one is what got World 4 reverted.
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
  return { phase: e.state.phase, lives: e.state.lives };
}
const livesOf = (r) => (r.phase === "won" ? r.lives : -1);
const clone = (o) => JSON.parse(JSON.stringify(o));
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

const SEEDS = (process.env.SEEDS || "1,7,13,23,2,99,404,5").split(",").map(Number);

// Score a level the way the dose rules do: per seed, take the BEST plan (that
// is the oracle), but ALSO keep the two plans apart so diversity is measurable.
function score(level, difficulty) {
  const dart = [], mixed = [], bestv = [];
  for (const s of SEEDS) {
    const a = livesOf(playWith(level, s, DART, difficulty));
    const b = livesOf(playWith(level, s, MIXED, difficulty));
    dart.push(a); mixed.push(b); bestv.push(Math.max(a, b));
  }
  const stars = DATA.RULES.stars || [[18, 3], [10, 2], [1, 1]];
  const three = stars.find((s) => s[1] === 3)[0];
  return {
    dart, mixed, best: bestv,
    median: med(bestv),
    min: Math.min(...bestv), max: Math.max(...bestv),
    spread: Math.max(...bestv) - Math.min(...bestv),
    lost: bestv.filter((v) => v < 0).length,
    // 3-star seeds: what the player actually chases
    stars3: bestv.filter((v) => v >= three).length,
    // diversity: seeds where the MIXED plan strictly beats a dart swarm
    diversity: SEEDS.filter((_, i) => mixed[i] > dart[i]).length,
  };
}

// ---- the ADDITIVE dose: a mini-boss is EXTRA, never a swap ----
// Total wave HP grows, which is why the wave needs the same budget exemption a
// boss wave already has. That is the whole point: the refuted swap kept HP
// constant and therefore cut leak capacity.
function dose(level, opts) {
  const lv = clone(level);
  const n = lv.waves.length;
  const targets = [];
  for (let i = n - 1; i >= 0 && targets.length < opts.waves; i--) {
    if (lv.waves[i].boss) continue;             // never touch a real finale
    targets.push(i);
  }
  for (const i of targets) {
    lv.waves[i].groups.push({ type: opts.type, count: opts.count, gap: 2.2, delay: 3 });
    lv.waves[i].elite = true;                   // the budget exemption this needs
  }
  return { level: lv, waves: targets.map((i) => i + 1) };
}

// A synthetic body, so nothing has to be added to the shipped roster to MEASURE
// it. Kits are the ones the engine already runs, so a positive result is
// buildable with no new engine code.
function makeBody(hp, toll, kit) {
  const b = {
    name: "Probe Elite", icon: "🧪", hp, speed: 0.4, armor: 0.2, shield: 0, shieldRegen: 0,
    bounty: Math.round(hp / 12), lives: toll, size: 2.2, flier: false,
    meleeDmg: 0, meleeRate: 1,
  };
  if (kit === "disable" || kit === "both") {
    b.phases = [{ upTo: 1.0 }, { upTo: 0.6, disable: { every: 6, seconds: 3 } }];
  }
  if (kit === "spawn" || kit === "both") {
    b.phases = (b.phases || [{ upTo: 1.0 }]).concat([{ upTo: 0.35, spawn: { type: "marble", count: 6, every: 5 } }]);
  }
  if (kit === "heal") b.heal = { hps: 40, radius: 2.0 };
  if (kit === "aura") b.hurry = { mult: 1.3, radius: 2.5 };
  return b;
}

const only = /^[0-9]+(,[0-9]+)*$/.test(process.argv[2] || "") ? process.argv[2].split(",").map(Number) : null;
const HPS = (process.env.HP || "0,1800,2400,3000,3600").split(",").map(Number);
const KIT = process.env.KIT || "none";
const TOLL = Number(process.env.TOLL || 3);
const WAVES = Number(process.env.WAVES || 1);
const COUNT = Number(process.env.COUNT || 1);
const DIFFS = (process.env.DIFFS || "normal,heroic").split(",");

const TYPE = "__probe";
for (const lvl of DATA.LEVELS.filter((l) => !only || only.includes(l.id))) {
  console.log(`\n=== L${lvl.id} ${lvl.name} — additive elite, kit=${KIT} toll=${TOLL} x${COUNT} on the last ${WAVES} non-boss wave(s) ===`);
  for (const diff of DIFFS) {
    console.log(`  [${diff}]  hp     median  min..max  spread  3★/${SEEDS.length}  div  lost   lives`);
    for (const hp of HPS) {
      let lev = lvl, where = [];
      if (hp > 0) {
        DATA.ENEMIES[TYPE] = makeBody(hp, TOLL, KIT);
        const d = dose(lvl, { type: TYPE, count: COUNT, waves: WAVES });
        lev = d.level; where = d.waves;
      }
      const r = score(lev, diff);
      delete DATA.ENEMIES[TYPE];
      const tag = hp === 0 ? "base" : String(hp);
      console.log(`         ${tag.padStart(5)}  ${String(r.median).padStart(6)}  ${String(r.min).padStart(3)}..${String(r.max).padEnd(3)}  ` +
        `${String(r.spread).padStart(6)}  ${String(r.stars3).padStart(4)}  ${String(r.diversity).padStart(3)}  ${String(r.lost).padStart(4)}   [${r.best.join(",")}]` +
        (where.length ? `  w${where.join(",")}` : ""));
    }
  }
}
