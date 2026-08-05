#!/usr/bin/env node
// HYPOTHESIS: on a formality level, what bites is CONCENTRATION, not
// composition. Every level that costs lives is a boss level (a single large
// body that must die before it crosses); the flat-20 levels are all crowds of
// small bodies, which a full board simply holds. So swap some late-wave HP from
// many-small into few-large at CONSTANT total HP — the budget contract (which
// sums def.hp * count) is untouched, so this is legal by construction.
//
// Measured against the SHIPPED oracle (best of dart-mono / mixed), 8 seeds.
const path = require("path");
const ROOT = path.join(__dirname, "..");
const TD = require(path.join(ROOT, "scripts/td-logic.js"));
const DATA = require(path.join(ROOT, "scripts/td-data.js"));

const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
const DART = ["dart"];
const MIXED = ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"];

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
function best(level, seed, difficulty) {
  const a = playWith(level, seed, DART, difficulty), b = playWith(level, seed, MIXED, difficulty);
  if (a.phase === "won" && b.phase === "won") return a.lives >= b.lives ? a : b;
  return a.phase === "won" ? a : b.phase === "won" ? b : a;
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

// Convert `frac` of the LAST `tail` waves' HP from whatever is there into
// `heavy` bodies, preserving total wave HP to within a body.
function concentrate(level, frac, heavy, tail) {
  const lv = clone(level);
  const H = DATA.ENEMIES[heavy].hp;
  const n = lv.waves.length;
  for (let i = Math.max(0, n - tail); i < n; i++) {
    const w = lv.waves[i];
    if (w.boss) continue;                       // never touch a finale's boss wave
    let moved = 0;
    for (const g of w.groups || []) {
      const def = DATA.ENEMIES[g.type];
      if (!def || def.boss) continue;
      const hp = def.hp * g.count;
      const take = Math.floor((hp * frac) / def.hp);
      if (take < 1) continue;
      g.count -= take;
      moved += take * def.hp;
    }
    const add = Math.round(moved / H);
    if (add > 0) w.groups.push({ type: heavy, count: add, gap: 1.4, delay: 2 });
    // drop any group emptied by the conversion
    w.groups = w.groups.filter((g) => g.count > 0);
  }
  return lv;
}

// MINI-BOSS test: a synthetic elite at configurable hp, injected HP-preservingly.
// Proves (or refutes) the hypothesis without committing to art or content.
if (process.env.ELITE_HP) {
  DATA.ENEMIES.__elite = {
    name: "Test Elite", hp: Number(process.env.ELITE_HP), speed: 0.5, bounty: 90,
    armor: 0.2, lives: 1,
  };
}
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const ids = (process.env.LEVELS || "27").split(",").map(Number);
const HEAVY = process.env.HEAVY || "pinata";
const TAIL = Number(process.env.TAIL || 6);
const FRACS = (process.env.FRACS || "0,0.2,0.35,0.5").split(",").map(Number);

console.log(`# concentration swap — heavy=${HEAVY} over the last ${TAIL} waves, HP preserved\n`);
console.log("lvl  frac  normal-med  normal        heroic-med  heroic        wave-HP drift");
for (const id of ids) {
  const base = DATA.LEVELS.find((l) => l.id === id);
  const baseHp = base.waves.reduce((a, w) => a + (w.groups || []).reduce((b, g) => b + (DATA.ENEMIES[g.type] ? DATA.ENEMIES[g.type].hp * g.count : 0), 0), 0);
  for (const f of FRACS) {
    const lv = f === 0 ? base : concentrate(base, f, HEAVY, TAIL);
    const hp = lv.waves.reduce((a, w) => a + (w.groups || []).reduce((b, g) => b + (DATA.ENEMIES[g.type] ? DATA.ENEMIES[g.type].hp * g.count : 0), 0), 0);
    const nm = SEEDS.map((s) => { const r = best(lv, s, "normal"); return r.phase === "won" ? r.lives : -1; });
    const hr = SEEDS.map((s) => { const r = best(lv, s, "heroic"); return r.phase === "won" ? r.lives : -1; });
    console.log(
      String(id).padStart(3), String(f).padStart(5),
      String(med(nm)).padStart(11), "  " + nm.join(",").padEnd(26),
      String(med(hr)).padStart(9), "  " + hr.join(",").padEnd(26),
      ((100 * (hp - baseHp)) / baseHp).toFixed(1) + "%"
    );
  }
  console.log("");
}
