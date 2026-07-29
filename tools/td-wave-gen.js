#!/usr/bin/env node
// Fort Josh wave generator + composition validator.
//
//   node tools/td-wave-gen.js            # re-emit the World-5 waves as a worked example
//   node tools/td-wave-gen.js --check    # validate every SHIPPED level instead
//
// WHY THIS FILE IS IN THE REPO. Hand-writing ~60 waves to a ±25% budget curve is
// error-prone, so the rule this project settled on is that **the data file is
// written LAST**: emit the literals, validate them, and only then touch
// td-data.js. That instruction is unactionable without the emitter, so it lives
// here rather than in a scratchpad.
//
// TWO CONTRACTS, both enforced below and both mirrored by shipped guardrails
// (`TD wave-budget audit` and `W5 wave composition` in tests/td-logic.test.js):
//
//  1. BUDGET — raw Σ(def.hp × count) within ±25% of budgetBase·1.18^n. Note the
//     exponent: each wave is 1.18× the last, so the FINAL wave is most of a
//     level's difficulty and the wave COUNT is itself a difficulty knob.
//     Boss waves are exempt but must actually contain a boss.
//
//  2. COMPOSITION — the World-4 scar. Drawing freely from the special roster
//     produced waves of shielded + splash-resistant + self-healing enemies with
//     no answer, unwinnable at every base and start-gold. So: ≥70% of a wave's
//     THREAT hp is plain backbone, at most ONE disruptive special at ≤25%, the
//     Piñata is an economy valve capped at 12% (and excluded from the backbone
//     ratio — any board pops it and it pays you), and the opening three waves
//     are plain, because a wave-1 gotcha costs lives before a board can exist.
//
// Sizing note: a spawner's capped LOAD is real threat the budget formula cannot
// see (it sums the source only), so groups are sized against `ehp` — the
// enemy's hp plus everything it will ever drop.
//
// Node-only. Nothing here is loaded by the site.
const path = require("path");
const ROOT = path.join(__dirname, "..");
const DATA = require(path.join(ROOT, "scripts/td-data.js"));
const E = DATA.ENEMIES;

// DERIVED from the worlds' own backbone declarations. This used to be a literal
// here AND a second copy in tests/td-logic.test.js, which is the mechanical
// reason all 24 levels shared ~85% of their bodies.
const BACKBONE = new Set(DATA.BACKBONE_TYPES);
const VALVE = new Set(["pinata"]);
const ehp = (t) => E[t].hp + (E[t].spawner ? (E[t].spawner.max || 0) * E[E[t].spawner.type].hp : 0);
const hp = (g) => E[g.type].hp * g.count;

function buildWave(target, o) {
  const groups = []; let spent = 0;
  const add = (type, want, gap, delay) => {
    const n = Math.max(1, Math.round(want / ehp(type)));
    groups.push({ type, count: n, gap, delay }); spent += E[type].hp * n;
  };
  // the valve rounds DOWN and is skipped when even one would breach its cap —
  // a 400hp piñata is a sixth of an early wave and would gold-shower it
  if (o.valve) {
    const nv = Math.floor(target * 0.10 / E[o.valve].hp);
    if (nv >= 1) { groups.push({ type: o.valve, count: nv, gap: 1, delay: 0 }); spent += E[o.valve].hp * nv; }
  }
  if (o.special) add(o.special, target * o.specialPct, 0.9, 4);
  if (o.flier) add(o.flier, target * o.flierPct, E[o.flier].speed > 1.8 ? 0.3 : 0.4, 2);
  // The PRIMARY backbone slot carries 60% and therefore decides how many BODIES
  // a wave has. Marbles are 16hp at speed 1.7, so leading with them makes an
  // even wave a 200-strong sprint that outruns every board — the beefy slow
  // Blob leads and marbles garnish.
  const rest = Math.max(target * 0.2, target - spent);
  add(o.ground[0], rest * 0.6, 0.65, 0);
  add(o.ground[1], rest * 0.4, 0.8, 3);
  // repair: nudge the first backbone group so the raw sum hugs the curve
  const g = groups[groups.length - 2];
  const others = groups.reduce((s, x) => s + (x === g ? 0 : hp(x)), 0);
  g.count = Math.max(1, Math.round((target - others) / E[g.type].hp));
  return { groups };
}

// The two ground slots per parity, PER WORLD. This was one hard-coded pair for
// all 24 levels — the single mechanical cause of the sameness the audit
// measured — so it now reads the world's own `backbone.ground`, laid out as
// [odd primary, odd secondary, even primary, even secondary].
function groundSlots(world, n) {
  const g = (DATA.WORLDS[world] || DATA.WORLDS.bedroom).backbone.ground;
  return n % 2 ? [g[0], g[1]] : [g[2], g[3]];
}
const sPct = (n, t) => 0.10 + 0.14 * ((n - 4) / Math.max(1, t - 4));   // 10% → 24%, never the 25% cap
const fPct = (n, t) => 0.10 + 0.08 * ((n - 6) / Math.max(1, t - 6));

function makeWaves(base, count, schedule, world) {
  const out = [];
  for (let n = 1; n <= count; n++) {
    const s = schedule(n) || {};
    if (s.boss) { out.push(s.boss); continue; }
    out.push(buildWave(base * Math.pow(1.18, n), {
      ground: groundSlots(world || "bedroom", n),
      special: s.special || null, specialPct: s.special ? sPct(n, count) : 0,
      flier: s.flier || null, flierPct: s.flier ? fPct(n, count) : 0,
      valve: s.valve || null,
    }));
  }
  return out;
}

// `opts` mirrors exactly what the SHIPPED guardrails enforce, so this tool and
// the suite can never disagree:
//   · budget + boss sanity — universal (`TD wave-budget audit`)
//   · composition          — only levels authored under the rule (`W5 wave
//                            composition`); the older worlds predate the
//                            World-4 revert that taught it
//   · late fliers          — every world EXCEPT the bedroom, which is the
//                            deliberate flier-free tutorial (`AUDIT threat shape`)
// A checker that flags deliberate design as BAD is a checker nobody reads.
function validate(label, base, waves, opts) {
  const o = Object.assign({ composition: true, lateFliers: true }, opts || {});
  const bad = [];
  waves.forEach((w, i) => {
    const n = i + 1;
    if (w.boss) {
      if (!w.groups.some((g) => E[g.type].boss)) bad.push(`w${n} flagged boss with no boss enemy`);
      return;                                    // a finale is its own difficulty axis
    }
    const total = w.groups.reduce((s, g) => s + hp(g), 0);
    const target = base * Math.pow(1.18, n);
    const off = (total - target) / target;
    if (Math.abs(off) > 0.25) bad.push(`w${n} budget ${(off * 100).toFixed(0)}% off curve (${total} vs ${Math.round(target)})`);
    if (!o.composition) return;
    const valve = w.groups.filter((g) => VALVE.has(g.type)).reduce((s, g) => s + hp(g), 0);
    const back = w.groups.filter((g) => BACKBONE.has(g.type)).reduce((s, g) => s + hp(g), 0);
    const specials = w.groups.filter((g) => !BACKBONE.has(g.type) && !VALVE.has(g.type));
    if (back / (total - valve) < 0.7) bad.push(`w${n} backbone only ${Math.round(back / (total - valve) * 100)}% of threat hp`);
    if (specials.length > 1) bad.push(`w${n} stacks ${specials.length} specials (${specials.map((g) => g.type).join("+")})`);
    for (const g of specials) if (hp(g) / total > 0.25) bad.push(`w${n} ${g.type} is ${Math.round(hp(g) / total * 100)}% of the wave`);
    if (valve / total > 0.12) bad.push(`w${n} piñata is ${Math.round(valve / total * 100)}% of the wave`);
    if (n <= 3 && specials.length) bad.push(`w${n} is an opening wave and must be plain`);
  });
  if (o.lateFliers) {
    const late = waves.slice(Math.ceil(waves.length * 0.55));
    if (!late.some((w) => w.groups.some((g) => E[g.type] && E[g.type].flier))) bad.push("no fliers in the late waves (mono-build check)");
  }
  console.log(`${label}: ${waves.length} waves · ${bad.length ? "BAD\n    " + bad.join("\n    ") : "OK"}`);
  return bad.length === 0;
}

const emit = (waves) => waves.map((w) =>
  `        { ${w.boss ? "boss: true, " : ""}groups: [ ${w.groups.map((g) =>
    `{ type: "${g.type}", count: ${g.count}, gap: ${g.gap}, delay: ${g.delay}${g.at ? ", at: " + g.at : ""} }`).join(", ")} ] },`).join("\n");

// ---- --check: validate what is actually SHIPPED ----
if (require.main === module && process.argv.includes("--check")) {
  // The composition rule arrived with World 5 (it is what the World-4 revert
  // taught), so it is applied to the world that was authored under it. The
  // older worlds are held to the budget contract they were built against —
  // retro-fitting the newer rule would flag deliberate design as broken.
  const RULED = new Set(["garage"]);
  let ok = true;
  for (const l of DATA.LEVELS) {
    ok = validate(`L${l.id} ${l.name}`, l.budgetBase, l.waves,
      { composition: RULED.has(l.world), lateFliers: l.world !== "bedroom" }) && ok;
  }
  console.log(ok ? "\nall shipped levels satisfy the contracts they were authored under" : "\nsee above");
  process.exit(ok ? 0 : 1);
}

// ---- worked example: the World-5 schedules that produced L17-L20 ----
// A schedule names, per wave, the ONE disruptive special, whether a flier group
// rides along, and whether the economy valve appears. Everything else is
// derived. Copy this shape for a new world.
const EXAMPLE = {
  17: { base: 700, count: 14, schedule: (n) => ({
    special: ({ 4: "racer", 5: "racer", 6: "screw", 7: "racer", 8: "cushion", 9: "racer",
                10: "ghost", 11: "racer", 12: "slime", 13: "tinplane", 14: "racer" })[n],
    flier: n >= 7 ? "hawk" : null, valve: n === 10 || n === 14 ? "pinata" : null }) },
  18: { base: 760, count: 14, schedule: (n) => ({
    special: ({ 4: "screw", 5: "ghost", 6: "bucket", 7: "battery", 8: "cushion", 9: "mole",
                10: "bucket", 11: "racer", 12: "slime", 13: "tinplane", 14: "bucket" })[n],
    flier: n >= 7 ? "hawk" : null, valve: n === 10 || n === 14 ? "pinata" : null }) },
};
// Only when RUN, never when required — a module that prints on import makes
// its own output impossible to distinguish from its caller's.
if (require.main === module) for (const id of Object.keys(EXAMPLE)) {
  const spec = EXAMPLE[id];
  const world = (DATA.LEVELS.find((l) => String(l.id) === String(id)) || {}).world;
  const waves = makeWaves(spec.base, spec.count, spec.schedule, world);
  if (validate(`L${id} (regenerated)`, spec.base, waves) && process.argv.includes("--emit")) {
    console.log(`\n      waves: [\n${emit(waves)}\n      ],\n`);
  }
}
module.exports = { makeWaves, validate, emit };
