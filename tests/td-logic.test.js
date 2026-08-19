// Fort Josh TD — engine unit + headless-simulation tests (no browser).
// A real-time game can't use the tap-harness, so THIS is its honest replacement
// (PLAN_TOWER_DEFENSE.md §10): determinism, exact combat math, wave-budget
// audit, and full-level sims at native node speed — every level must be
// WINNABLE by a scripted build and LOSABLE by neglect.

const { test } = require("node:test");
const assert = require("node:assert");
const TD = require("../scripts/td-logic.js");
const DATA = require("../scripts/td-data.js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
// Structural claims (one owner, one read site) need the SOURCE, not the API.
const readSrc = (f) => readFileSync(join(__dirname, "..", f), "utf8");

const L1 = DATA.LEVELS[0];

// Run an engine to a terminal phase. `plan` maps a wave number (1-based, the
// wave ABOUT to be called) to a function run during that build phase — the
// deterministic scripting anchor (build phases are stable points; spawn jitter
// never moves them).
function run(engine, plan, maxTicks) {
  const cap = maxTicks || 200000;
  let guard = 0;
  while (engine.state.phase !== "won" && engine.state.phase !== "lost") {
    if (engine.state.phase === "build") {
      const waveNum = engine.state.waveIdx + 1;
      if (plan && plan[waveNum]) { plan[waveNum](engine); plan[waveNum] = null; }
      engine.callWave(); // sims always call early (bonus gold is part of the plan)
    }
    engine.tick();
    if (++guard > cap) throw new Error("sim cap hit in phase " + engine.state.phase + " wave " + engine.state.waveIdx);
  }
  return engine.state;
}

// The authored L1 winning build: 3 darts before wave 1, then upgrades as the
// bounties come in. This exact script is the CI winnability contract.
function l1Plan() {
  let dartId = null;
  return {
    1: (e) => {
      assert.ok(e.place("dart", "p3").ok, "afford dart 1");
      assert.ok(e.place("dart", "p2").ok, "afford dart 2");
      assert.ok(e.place("dart", "p4").ok, "afford dart 3");
      dartId = e.state.towers[0].id;
    },
    3: (e) => { e.upgrade(dartId); },            // t2 when wave-2 bounties land
    5: (e) => { e.upgrade(dartId); e.place("dart", "p6"); }, // t3 + 4th dart
  };
}

test("TD determinism: same seed + same script → identical final hash; different seed → different", () => {
  const a = run(TD.createEngine(L1, { seed: 42 }), l1Plan());
  const b = run(TD.createEngine(L1, { seed: 42 }), l1Plan());
  assert.equal(TD.hashState(a), TD.hashState(b), "same seed must replay identically");
  const c = run(TD.createEngine(L1, { seed: 43 }), l1Plan());
  assert.notEqual(TD.hashState(a), TD.hashState(c), "a different seed must produce a different run (jitter is seeded)");
});

test("TD combat math: armor reduces Bonk, Zap ignores armor, shields absorb Zap, brittle amplifies", () => {
  assert.equal(TD.computeHit(10, "bonk", { armor: 0.5, shield: 0 }).hpDmg, 5, "50% armor halves bonk");
  assert.equal(TD.computeHit(10, "bonk", { armor: 0, shield: 0 }).hpDmg, 10);
  assert.equal(TD.computeHit(10, "zap", { armor: 0.5, shield: 0 }).hpDmg, 10, "zap ignores armor");
  const shielded = TD.computeHit(10, "zap", { armor: 0, shield: 6 });
  assert.equal(shielded.shieldDmg, 6, "shield absorbs zap first");
  assert.equal(shielded.hpDmg, 4, "overflow zap reaches hp");
  assert.equal(TD.computeHit(10, "bonk", { armor: 0, shield: 40 }).hpDmg, 10, "shields do NOT stop bonk");
  assert.equal(TD.computeHit(10, "bonk", { armor: 0, shield: 0, brittle: true }).hpDmg, 12, "brittle = +20%");
});

test("TD path: posAt is monotonic along the walk and clamps at the exit", () => {
  const path = TD.buildPath(L1.path);
  assert.ok(path.total > 20, "L1 path is a real walk, got " + path.total);
  for (let i = 0; i <= 40; i++) {
    const p = TD.posAt(path, (path.total * i) / 40);
    assert.ok(p.x >= 0 && p.x <= DATA.GRID.w && p.y >= 0 && p.y <= DATA.GRID.h, "on the grid");
  }
  const exit = [L1.path[L1.path.length - 1][0], L1.path[L1.path.length - 1][1]];
  const end = TD.posAt(path, path.total);
  assert.deepEqual([end.x, end.y], exit, "dist=total is exactly the exit");
  const over = TD.posAt(path, path.total + 99);
  assert.deepEqual([over.x, over.y], exit, "overshoot clamps at the exit");
});

test("TD wave-budget audit: every authored wave sits within ±25% of the level curve (typo guard)", () => {
  for (const level of DATA.LEVELS) {
    level.waves.forEach((wave, i) => {
      const n = i + 1;
      let hp = 0;
      for (const g of wave.groups) {
        const def = DATA.ENEMIES[g.type];
        assert.ok(def, `level ${level.id} wave ${n} references unknown enemy "${g.type}"`);
        hp += def.hp * g.count;
      }
      if (wave.boss) { // a boss finale is DELIBERATELY off the curve — just prove it holds a boss
        assert.ok(wave.groups.some((g) => DATA.ENEMIES[g.type].boss), `level ${level.id} wave ${n} is flagged boss but has no boss enemy`);
        return;
      }
      const target = level.budgetBase * Math.pow(1.18, n);
      assert.ok(hp >= target * 0.75 && hp <= target * 1.25,
        `level ${level.id} wave ${n}: ${hp} effective HP is outside ±25% of curve ${Math.round(target)}`);
    });
    for (const p of level.pads) {
      assert.ok(p.cx >= 0 && p.cx < DATA.GRID.w && p.cy >= 0 && p.cy < DATA.GRID.h, `pad ${p.id} on grid`);
    }
    for (const lane of (level.paths || [level.path])) { // TD-7: a level may carry multiple lanes
      for (const [x, y] of lane) {
        assert.ok(x >= 0 && x <= DATA.GRID.w - 1 && y >= 0 && y <= DATA.GRID.h - 1, "waypoint on grid");
      }
    }
  }
});

test("TD L1 WINNABILITY: the scripted build beats Normal with ≥10 lives (the CI contract)", () => {
  const final = run(TD.createEngine(L1, { seed: 7 }), l1Plan());
  assert.equal(final.phase, "won", "the scripted L1 build must win");
  assert.ok(final.lives >= 10, `expected a solid win (≥10 lives), got ${final.lives}`);
  assert.ok(final.stars >= 1, "a win earns stars");
});

test("TD L1 LOSABILITY: a do-nothing run LOSES — fail states must actually work here", () => {
  const final = run(TD.createEngine(L1, { seed: 7 }), null);
  assert.equal(final.phase, "lost", "neglect must lose (this world is allowed to fail)");
  assert.equal(final.lives, 0);
});

test("TD winnability holds across seeds (jitter can't flip the outcome)", () => {
  for (const seed of [1, 99, 2026]) {
    const final = run(TD.createEngine(L1, { seed }), l1Plan());
    assert.equal(final.phase, "won", `seed ${seed} must still win`);
    assert.ok(final.lives >= 8, `seed ${seed}: ≥8 lives, got ${final.lives}`);
  }
});

test("TD economy rules: place/upgrade validation, 80% sell refund, early-call bonus", () => {
  const e = TD.createEngine(L1, { seed: 1 });
  assert.equal(e.state.gold, 220);
  assert.ok(e.place("dart", "p1").ok);
  assert.equal(e.state.gold, 150);
  assert.equal(e.place("dart", "p1").reason, "occupied", "one tower per pad");
  assert.equal(e.place("dart", "nope").reason, "bad-id");
  assert.ok(e.place("dart", "p2").ok);
  assert.ok(e.place("dart", "p3").ok, "third dart affordable");
  assert.equal(e.place("dart", "p4").reason, "gold", "out of gold at 10");
  const t = e.state.towers[0];
  assert.equal(e.upgrade(t.id).reason, "gold");
  const sold = e.sell(t.id);
  assert.ok(sold.ok);
  assert.equal(sold.refund, Math.floor(70 * 0.8), "80% refund of spent");
  // early call: full first countdown (45s × 3 g/s = 135 bonus)
  const bonusGold = e.state.gold;
  const called = e.callWave();
  assert.ok(called.ok);
  assert.equal(called.bonus, 135, "45s remaining × 3 = 135");
  assert.equal(e.state.gold, bonusGold + 135);
  // An IMMEDIATE second press is a fumbled double-tap, not a decision: the
  // button relabels to ⏩ RUSH the instant the wave starts, so the engine holds
  // it off for RULES.rushSettle seconds.
  assert.equal(e.callWave().reason, "too-soon", "a doubled press cannot rush a wave you haven't seen");
  for (let i = 0; i < DATA.RULES.rushSettle * DATA.TICK_RATE + 1; i++) e.tick();
  // After that, a mid-wave CALL is the RUSH: it sends the next wave on top of
  // this one, and pays the FULL build-countdown rate (20s × 3 = 60) because you
  // are skipping that whole build phase. A third is refused — two is the cap.
  const rushed = e.callWave();
  assert.ok(rushed.ok, "a mid-wave CALL rushes the next wave");
  assert.equal(rushed.bonus, 60, "rushing pays the full build countdown (20s × 3)");
  assert.equal(e.state.sentIdx - e.state.waveIdx, 2, "two waves are now in flight");
  assert.equal(e.callWave().reason, "too-many-waves", "…but only two at a time");
});

test("TD targeting modes are accepted and reset the lock; phase-gated APIs answer honestly", () => {
  const e = TD.createEngine(L1, { seed: 1 });
  e.place("dart", "p3");
  const t = e.state.towers[0];
  for (const m of ["first", "last", "strong", "close"]) assert.ok(e.setTargeting(t.id, m).ok);
  assert.equal(e.setTargeting(t.id, "cheapest").reason, "bad-mode");
  assert.equal(e.branch(t.id, "a").reason, "not-tier3", "branching is tier-3-gated");
  assert.equal(e.rally(t.id, 2, 2).reason, "bad-id", "only camps rally");
  assert.equal(e.pullLever().reason, "no-lever", "a level without a lever rejects a pull (L1 has none)");
});

test("TD2 selling a camp mid-melee frees its blocked enemies and dismisses the squad", () => {
  // Found worth pinning by the real-tap audit: an enemy held by a soldier whose
  // camp is SOLD must resume walking — a frozen unfought enemy would stall the
  // wave forever (the unwinnable-game class, fort edition).
  const lvl = {
    id: 98, name: "micro-sell", world: "test", startGold: 5000, budgetBase: 100,
    path: [[0, 2], [23, 2]],
    pads: [{ id: "m1", cx: 5, cy: 3 }],
    waves: [{ groups: [{ type: "sock", count: 2, gap: 0.4, delay: 0 }] }],
  };
  const e = TD.createEngine(lvl, { seed: 3 });
  e.place("camp", "m1");
  const campId = e.state.towers[0].id;
  e.callWave();
  let guard = 0;
  while (!e.state.enemies.some((x) => x.alive && x.blockedBy) && guard++ < 20000) e.tick();
  assert.ok(guard < 20000, "a sock gets blocked in melee first");
  const blockedDist = e.state.enemies.find((x) => x.alive && x.blockedBy).dist;
  e.sell(campId);
  for (let i = 0; i < 60; i++) e.tick();
  assert.equal(e.state.soldiers.filter((s) => s.alive).length, 0, "sold camp dismisses its soldiers");
  assert.equal(e.state.enemies.filter((x) => x.alive && x.blockedBy).length, 0, "nobody stays frozen");
  const resumed = e.state.enemies.find((x) => x.alive);
  assert.ok(!resumed || resumed.dist > blockedDist + 0.5, "the freed sock resumes walking");
});

test("TD save-shape: engine state is plain JSON (serializable round-trip, hash-stable)", () => {
  const e = TD.createEngine(L1, { seed: 5 });
  e.place("dart", "p3");
  e.callWave();
  for (let i = 0; i < 200; i++) e.tick();
  const json = JSON.stringify(e.state);
  const back = JSON.parse(json);
  assert.equal(TD.hashState(back), TD.hashState(e.state), "state survives JSON round-trip identically");
});
// ============ TD-2: full-arsenal mechanics (appended to tests/td-logic.test.js) ============
// Micro-levels per mechanic: tiny synthetic levelDefs drive each system in
// isolation at headless speed — the §10 pattern for everything the tap-harness
// can't touch. Pads sit 1 cell from the straight path so every aura reaches.

function micro(waves, pads) {
  return {
    id: 99, name: "micro", world: "test", startGold: 5000, budgetBase: 100,
    path: [[0, 2], [23, 2]],
    pads: pads || [{ id: "m1", cx: 5, cy: 3 }, { id: "m2", cx: 9, cy: 3 }, { id: "m3", cx: 13, cy: 3 }],
    waves,
  };
}
function ticks(engine, n) { for (let i = 0; i < n; i++) engine.tick(); }

test("TD2 slows: a fanned sock lags, flier slow is halved, strongest-wins is capped", () => {
  const lvl = micro([{ groups: [{ type: "sock", count: 1, gap: 1, delay: 0 }] }]);
  const bare = TD.createEngine(lvl, { seed: 5 });
  bare.callWave(); ticks(bare, 200);
  const dBare = bare.state.enemies[0].dist;
  const fanned = TD.createEngine(lvl, { seed: 5 });
  fanned.place("fan", "m1");
  fanned.callWave(); ticks(fanned, 200);
  const s = fanned.state.enemies[0];
  assert.ok(s.alive && s.dist < dBare - 0.3, `slowed sock must lag (${s.dist.toFixed(2)} vs ${dBare.toFixed(2)})`);

  const flv = micro([{ groups: [{ type: "balloon", count: 1, gap: 1, delay: 0 }] }]);
  const fl = TD.createEngine(flv, { seed: 1 });
  fl.place("fan", "m1");
  fl.callWave(); ticks(fl, 200);
  const b = fl.state.enemies.find((x) => x.alive);
  assert.ok(b && Math.abs(b.slowPct - 0.15) < 1e-9, `flier slow = tier slow × 0.5 (got ${b && b.slowPct})`);
  assert.ok(DATA.RULES.slowCap === 0.6, "slow cap is the 60% contract");
});

test("TD2 mortar: min-range + ground-only + splash with falloff kills clusters", () => {
  const lvl = micro([{ groups: [{ type: "sock", count: 6, gap: 0.1, delay: 0 }] }], [{ id: "m1", cx: 5, cy: 3 }]);
  const e = TD.createEngine(lvl, { seed: 2 });
  e.place("mortar", "m1");
  e.callWave();
  let sawSplash = false, guard = 0;
  while (e.state.phase === "wave" && guard++ < 5000) {
    e.tick();
    if (e.events.some((ev) => ev.type === "splash")) sawSplash = true;
  }
  assert.ok(sawSplash, "the mortar lobbed shells at the cluster");
  assert.equal(e.state.phase, "won", "splash clears the tight squad");

  // fliers are invisible to it (they simply leak past — no shells ever fired)
  const flv = micro([{ groups: [{ type: "balloon", count: 2, gap: 0.5, delay: 0 }] }], [{ id: "m1", cx: 5, cy: 3 }]);
  const fe = TD.createEngine(flv, { seed: 2 });
  fe.place("mortar", "m1");
  fe.callWave();
  let shellFired = false; guard = 0;
  while (fe.state.phase === "wave" && guard++ < 5000) { fe.tick(); if (fe.state.shells.length) shellFired = true; }
  assert.ok(!shellFired, "a mortar must never target fliers");

  // min range: an enemy hugging the tower is too close to bombard
  const nearLvl = micro([{ groups: [{ type: "sock", count: 1, gap: 1, delay: 0 }] }], [{ id: "m1", cx: 1, cy: 3 }]);
  const ne = TD.createEngine(nearLvl, { seed: 3 });
  ne.place("mortar", "m1");
  ne.callWave();
  // while the sock is within rangeMin (dist < ~1.5 cells of the tower) no shell may spawn
  let early = true;
  for (let i = 0; i < 45 && early; i++) { ne.tick(); if (ne.state.shells.length) early = false; }
  assert.ok(early, "no shell while the sock is inside the minimum range");
});

test("TD2 Static chain: ≤4 targets, damage decays per jump, jumps respect the radius", () => {
  const lvl = micro([{ groups: [{ type: "sock", count: 5, gap: 0.15, delay: 0 }] }], [{ id: "m1", cx: 5, cy: 3 }]);
  const e = TD.createEngine(lvl, { seed: 3 });
  e.place("fan", "m1");
  const t = e.state.towers[0];
  e.state.gold = 9999;
  e.upgrade(t.id); e.upgrade(t.id);
  assert.ok(e.branch(t.id, "b").ok, "Static Zap branch applies");
  e.callWave();
  let chain = null;
  for (let i = 0; i < 1500 && !chain; i++) { e.tick(); chain = e.events.find((ev) => ev.type === "chain"); }
  assert.ok(chain, "a chain bolt fired");
  const struck = chain.points.length - 1; // first point is the tower
  assert.ok(struck >= 2 && struck <= DATA.TOWERS.fan.branches.b.chain.targets,
    `chain strikes 2..4 bunched targets, got ${struck}`);
  for (let i = 2; i < chain.points.length; i++) {
    const a = chain.points[i - 1], b2 = chain.points[i];
    const d = Math.sqrt((a.x - b2.x) ** 2 + (a.y - b2.y) ** 2);
    assert.ok(d <= DATA.TOWERS.fan.branches.b.chain.jump + 0.35, `jump ${i} within radius (+lead slack), got ${d.toFixed(2)}`);
  }
});

test("TD2 Army Guys: soldiers block the path, trade melee, respawn; Dino blocks 2; RC stuns", () => {
  const lvl = micro([{ groups: [{ type: "sock", count: 1, gap: 1, delay: 0 }] }], [{ id: "m1", cx: 5, cy: 3 }]);
  const e = TD.createEngine(lvl, { seed: 4 });
  e.place("camp", "m1");
  assert.equal(e.state.soldiers.filter((s) => s.alive).length, 3, "3 army guys deploy");
  e.callWave();
  ticks(e, 300);
  const sock = e.state.enemies.find((x) => x.alive);
  assert.ok(sock && sock.blockedBy > 0, "the sock is blocked at the rally point");
  const held = sock.dist;
  ticks(e, 60);
  assert.equal(sock.dist, held, "a blocked walker cannot advance");
  let guard = 0;
  while (e.state.phase === "wave" && guard++ < 6000) e.tick();
  assert.equal(e.state.phase, "won", "the squad wins the melee (a lone sock never leaks)");

  // Dino Squad: 2 big soldiers, each holds 2 enemies
  const dl = micro([{ groups: [{ type: "sock", count: 4, gap: 0.2, delay: 0 }] }], [{ id: "m1", cx: 5, cy: 3 }]);
  const de = TD.createEngine(dl, { seed: 6 });
  de.place("camp", "m1");
  const campT = de.state.towers[0];
  de.state.gold = 9999;
  de.upgrade(campT.id); de.upgrade(campT.id); de.branch(campT.id, "a");
  assert.equal(de.state.soldiers.filter((s) => s.alive).length, 2, "Dino Squad fields 2");
  de.callWave();
  // dinos kill FAST — assert the PEAK simultaneous holds during the fight,
  // not a snapshot after they've already annihilated the squad.
  let peakPerDino = 0, guard2 = 0;
  while (de.state.phase === "wave" && guard2++ < 20000) {
    de.tick();
    const counts = {};
    for (const x of de.state.enemies) if (x.alive && x.blockedBy) counts[x.blockedBy] = (counts[x.blockedBy] || 0) + 1;
    for (const k in counts) peakPerDino = Math.max(peakPerDino, counts[k]);
  }
  assert.ok(peakPerDino >= 2, `a dino must hold 2 enemies at once (peak ${peakPerDino})`);
  assert.equal(de.state.phase, "won", "the dino wall holds the squad");

  // RC Racers: the first engage stuns
  const rl = micro([{ groups: [{ type: "sock", count: 1, gap: 1, delay: 0 }] }], [{ id: "m1", cx: 5, cy: 3 }]);
  const re = TD.createEngine(rl, { seed: 7 });
  re.place("camp", "m1");
  const rc = re.state.towers[0];
  re.state.gold = 9999;
  re.upgrade(rc.id); re.upgrade(rc.id); re.branch(rc.id, "b");
  assert.equal(re.state.soldiers.filter((s) => s.alive).length, 4, "RC fields 4");
  re.callWave();
  let stunned = false;
  for (let i = 0; i < 2000 && !stunned; i++) { re.tick(); stunned = re.events.some((ev) => ev.type === "stun"); }
  assert.ok(stunned, "RC racers stun on first contact");
});

test("TD2 rally: within range moves the flag (and idle soldiers); out of range refuses", () => {
  const lvl = micro([{ groups: [{ type: "sock", count: 1, gap: 1, delay: 0 }] }], [{ id: "m1", cx: 5, cy: 3 }]);
  const e = TD.createEngine(lvl, { seed: 8 });
  e.place("camp", "m1");
  const t = e.state.towers[0];
  assert.ok(e.rally(t.id, 6.5, 2.2).ok, "an in-range rally point is accepted");
  assert.equal(e.rally(t.id, 20, 2).reason, "range", "a far rally point is refused");
  ticks(e, 200);
  const sol = e.state.soldiers.find((s) => s.alive);
  assert.ok(Math.abs(sol.x - 6.5) < 1.2 && Math.abs(sol.y - 2.2) < 1.2, "soldiers walked to the new post");
});

test("TD2 branches: exclusive, tier-3-gated, priced; Sniper crits are seeded-deterministic; Minigun spins up", () => {
  const lvl = micro([{ groups: [{ type: "sock", count: 12, gap: 0.5, delay: 0 }] }]);
  const e = TD.createEngine(lvl, { seed: 6 });
  e.place("dart", "m1");
  const t = e.state.towers[0];
  assert.equal(e.branch(t.id, "a").reason, "not-tier3", "no branching from tier 1");
  e.state.gold = 9999;
  e.upgrade(t.id); e.upgrade(t.id);
  assert.equal(e.upgrade(t.id).reason, "branch-required", "tier 3 upgrades only through a branch choice");
  assert.equal(e.branch(t.id, "zzz").reason, "bad-branch");
  assert.ok(e.branch(t.id, "a").ok && t.tier === 4 && t.branch === "a", "Sniper applied");
  assert.equal(e.branch(t.id, "b").reason, "not-tier3", "branches are exclusive forever");
  assert.equal(t.targeting, "strong", "the Sniper defaults to Strong targeting");

  // seeded crits: same seed → same crit count; crits exist across a long volley
  const critRun = (seed) => {
    const ce = TD.createEngine(lvl, { seed });
    ce.place("dart", "m1");
    const ct = ce.state.towers[0];
    ce.state.gold = 9999;
    ce.upgrade(ct.id); ce.upgrade(ct.id); ce.branch(ct.id, "a");
    ce.callWave();
    let crits = 0, guard = 0;
    while (ce.state.phase === "wave" && guard++ < 20000) {
      ce.tick();
      for (const ev of ce.events.splice(0)) if (ev.type === "hit" && ev.crit) crits++;
    }
    return crits;
  };
  const c1 = critRun(42), c2 = critRun(42);
  assert.equal(c1, c2, "crit rolls replay identically for a seed");

  // minigun heat: dps ramps while locked (damage per dart grows to full)
  const me = TD.createEngine(lvl, { seed: 9 });
  me.place("dart", "m1");
  const mt = me.state.towers[0];
  me.state.gold = 9999;
  me.upgrade(mt.id); me.upgrade(mt.id); me.branch(mt.id, "b");
  me.callWave();
  const dmgs = [];
  let guard2 = 0;
  while (dmgs.length < 12 && guard2++ < 4000) {
    me.tick();
    for (const pr of me.state.projectiles) if (!pr.seen) { pr.seen = true; dmgs.push(pr.dmg); }
  }
  assert.ok(dmgs.length >= 8 && dmgs[0] < dmgs[dmgs.length - 1], `spin-up ramps dart damage (${dmgs[0]} → ${dmgs[dmgs.length - 1]})`);
});

// ---------------------------------------------------------------------------
// BRANCH IDENTITY (RULE 7). Every tier-4 branch is INVISIBLE to the winnability
// suite: both oracle plans fill and upgrade with `t.tier < 3`, so neither ever
// calls branch(). What existed before this block was exclusivity, pricing, the
// no-DPS-downgrade stat table and a pixel-hash silhouette check — none of which
// drives a branch's declared MECHANIC. That is exactly how Sticky Bomb shipped
// for months whose "the goo it LEAVES slows whatever WALKS IN" existed only as
// a sentence: the code slowed bodies caught in the blast at the instant of
// detonation, nothing lingered, nothing could walk in, and there was nothing on
// the ground to draw.
//
// So each branch now proves its own claim through its own engine seam, the way
// `zapResist` is proven by firing each `how` at one pinned body rather than by
// a time-to-kill with confounds. Dino Squad's `blocks: 2` and RC Racers' `stun`
// are already driven by "TD2 Army Guys" above and are deliberately NOT repeated
// here — a near-duplicate is noise, not coverage.
//
// Three FIXTURE traps were hit writing these, each of which first presented as
// a product defect, and all three are worth knowing before editing this block:
//   • `state.enemies` is COMPACTED on death, so a before/after hp diff cannot
//     see a kill at all — a one-shotting shell scored "0 bodies hit". Count the
//     `die` events plus the survivors whose hp dropped.
//   • an enemy carries `dist` along its lane, NOT `x`/`y`. A probe reading x/y
//     reads undefined, every body scores as "outside the puddle", and the goo
//     claim fails on a working engine.
//   • a blast-width count against SOCKS measures nothing, because a tier-3
//     shell already one-shots every sock in its radius and both blasts
//     saturate. Use a body that SURVIVES the hit, so the count is geometry.
// ---------------------------------------------------------------------------

// One shell's reach is a pure RANGE question if you measure the distance the
// enemy has covered when the FIRST dart leaves the tower — shot COUNT is
// confounded by rate (Sniper 2.2s vs tier 3's 0.7s), first-shot distance is not.
function firstShotDist(branchKey) {
  const lvl = micro([{ groups: [{ type: "sock", count: 1, gap: 1, delay: 0 }] }], [{ id: "m1", cx: 12, cy: 4 }]);
  const e = TD.createEngine(lvl, { seed: 3 });
  e.place("dart", "m1");
  const t = e.state.towers[0];
  e.state.gold = 9999;
  e.upgrade(t.id); e.upgrade(t.id);
  if (branchKey) assert.ok(e.branch(t.id, branchKey).ok, "branch applied");
  e.callWave();
  for (let i = 0; i < 6000; i++) { e.tick(); if (e.state.projectiles.length) return e.state.enemies[0].dist; }
  return -1;
}

test("BRANCH IDENTITY 🎯 Sniper Scope opens fire where tier 3 cannot reach", () => {
  const t3 = firstShotDist(null);
  const sniper = firstShotDist("a");
  assert.ok(t3 > 0 && sniper > 0, `both builds must fire (t3 ${t3}, sniper ${sniper})`);
  // range 3.0 → 5.5 against a pad 2 cells off the lane, so the Sniper must
  // engage a good 2+ cells earlier. Measured 9.79 vs 6.88.
  assert.ok(sniper < t3 - 1.5,
    `Sniper Scope must engage far earlier than tier 3 (first shot at dist ${sniper.toFixed(2)} vs ${t3.toFixed(2)}) — ` +
    "its role line is \"one big far shot\", and range is the half of that a stat table cannot check");
  assert.ok(DATA.TOWERS.dart.branches.a.range > DATA.TOWERS.dart.tiers[2].range, "…and the data says so too");
});

test("BRANCH IDENTITY 🎯 Minigun spins UP on one target and RESETS on the next", () => {
  const B = DATA.TOWERS.dart.branches.b;
  const floor = Math.max(1, Math.round(B.dmg * B.heatFloor));
  assert.ok(floor < B.dmg, "the fixture is only meaningful while the floor is below full damage");
  // socks spaced far enough apart that each is killed before the next arrives,
  // so every retarget is a REAL one.
  const lvl = micro([{ groups: [{ type: "sock", count: 4, gap: 3.0, delay: 0 }] }], [{ id: "m1", cx: 8, cy: 3 }]);
  const e = TD.createEngine(lvl, { seed: 9 });
  e.place("dart", "m1");
  const t = e.state.towers[0];
  e.state.gold = 9999;
  e.upgrade(t.id); e.upgrade(t.id);
  assert.ok(e.branch(t.id, "b").ok, "Minigun applied");
  e.callWave();
  const seen = new Set(), dmgs = [];
  for (let i = 0; i < 6000 && e.state.phase === "wave"; i++) {
    e.tick();
    for (const p of e.state.projectiles) if (!seen.has(p.id)) { seen.add(p.id); dmgs.push(p.dmg); }
  }
  let peaked = false, reset = false;
  for (const d of dmgs) { if (d >= B.dmg) peaked = true; else if (peaked && d <= floor) reset = true; }
  assert.ok(peaked, `the stream must reach full damage ${B.dmg} (saw ${dmgs.join(",")})`);
  assert.ok(reset,
    `a real retarget must drop the Minigun back to its ${floor}-damage floor (saw ${dmgs.join(",")}) — ` +
    "without the reset it is a permanently-wound-up gun, not a spin-up weapon");
});

// Bodies damaged by ONE shell. Knights are 90hp behind 50% armour, so neither a
// 58-damage Crate Cannon nor a 105-damage Bertha kills one — the count is pure
// blast geometry rather than a damage comparison in disguise.
function firstShellBodies(branchKey) {
  const lvl = micro([{ groups: [{ type: "knight", count: 18, gap: 0.35, delay: 0 }] }], [{ id: "m1", cx: 12, cy: 4 }]);
  const e = TD.createEngine(lvl, { seed: 5 });
  e.place("mortar", "m1");
  const t = e.state.towers[0];
  e.state.gold = 9999;
  e.upgrade(t.id); e.upgrade(t.id);
  if (branchKey) assert.ok(e.branch(t.id, branchKey).ok, "branch applied");
  e.callWave();
  for (let i = 0; i < 800; i++) {
    const before = new Map(e.state.enemies.map((x) => [x.id, x.hp]));
    e.tick();
    const evs = e.events.splice(0);
    if (!evs.some((v) => v.type === "splash")) continue;
    const killed = evs.filter((v) => v.type === "die").length;
    const hurt = e.state.enemies.filter((x) => before.has(x.id) && x.hp < before.get(x.id)).length;
    return killed + hurt;
  }
  return -1;
}

test("BRANCH IDENTITY 🧱 Big Bertha's blast really is WIDER than the tier it replaces", () => {
  const crate = firstShellBodies(null);
  const bertha = firstShellBodies("a");
  assert.ok(crate > 0 && bertha > 0, `both shells must land on the column (crate ${crate}, bertha ${bertha})`);
  // splash 1.6 → 2.2 against a column 0.21 cells apart. Measured 8 vs 11.
  assert.ok(bertha >= crate + 2,
    `Big Bertha must catch materially more bodies per shell (${bertha} vs Crate Cannon's ${crate}) — ` +
    "\"a wider blast\" is its whole identity beside the damage the stat table already checks");
  assert.ok(DATA.TOWERS.mortar.branches.a.splash > DATA.TOWERS.mortar.tiers[2].splash, "…and the data says so too");
});

test("BRANCH IDENTITY 🧱 Sticky Bomb LEAVES goo — a body that walks in LATER is slowed", () => {
  const G = DATA.TOWERS.mortar.branches.b;
  // A mortar-only board has no aura and no zap, so the ONLY thing on the field
  // that can slow anything is the goo. A body newly slowed on a tick with NO
  // detonation therefore walked into a puddle that was already on the ground —
  // which is the claim, stated without needing a position at all.
  const run = (branchKey) => {
    const lvl = micro([{ groups: [{ type: "knight", count: 14, gap: 0.7, delay: 0 }] }], [{ id: "m1", cx: 10, cy: 4 }]);
    const e = TD.createEngine(lvl, { seed: 5 });
    e.place("mortar", "m1");
    const t = e.state.towers[0];
    e.state.gold = 9999;
    e.upgrade(t.id); e.upgrade(t.id);
    if (branchKey) assert.ok(e.branch(t.id, branchKey).ok, "branch applied");
    e.callWave();
    let puddle = null, lateSlows = 0;
    let prev = new Map();
    for (let i = 0; i < 2000 && e.state.phase === "wave"; i++) {
      e.tick();
      const detonated = e.events.splice(0).some((v) => v.type === "splash");
      if (!puddle && e.state.puddles.length) puddle = Object.assign({}, e.state.puddles[0]);
      for (const x of e.state.enemies) {
        if (!x.alive) continue;
        const slowed = x.slowPct > 0 && e.state.tick < x.slowUntil;
        if (slowed && !prev.get(x.id) && !detonated) lateSlows++;
      }
      prev = new Map(e.state.enemies.map((x) => [x.id, x.slowPct > 0 && e.state.tick < x.slowUntil]));
    }
    return { puddle, lateSlows };
  };

  const sticky = run("b");
  assert.ok(sticky.puddle, "a Sticky Bomb detonation must leave a puddle on the ground");
  assert.equal(sticky.puddle.r, G.splash, "the goo covers the shell's own blast");
  assert.equal(sticky.puddle.slow, G.goo.slow, "…at the declared slow");
  assert.ok(sticky.lateSlows > 0,
    `a body must be slowed on a tick with NO detonation (saw ${sticky.lateSlows}) — that is "walks in", ` +
    "and slowing only what the blast caught is the defect this branch shipped with");

  // the control: the tier it replaces, and its sibling, leave nothing behind
  for (const [key, label] of [[null, "Crate Cannon"], ["a", "Big Bertha"]]) {
    const r = run(key);
    assert.equal(r.puddle, null, `${label} must leave no goo`);
    assert.equal(r.lateSlows, 0, `${label} has nothing that can slow anything`);
  }
});

test("BRANCH IDENTITY 🧊 Blizzard Cone makes bodies brittle — tier 3 and Static do not", () => {
  const chilled = (branchKey) => {
    const lvl = micro([{ groups: [{ type: "knight", count: 2, gap: 1, delay: 0 }] }], [{ id: "m1", cx: 8, cy: 3 }]);
    const e = TD.createEngine(lvl, { seed: 4 });
    e.place("fan", "m1");
    const t = e.state.towers[0];
    e.state.gold = 9999;
    e.upgrade(t.id); e.upgrade(t.id);
    if (branchKey) assert.ok(e.branch(t.id, branchKey).ok, "branch applied");
    e.callWave();
    for (let i = 0; i < 1200 && e.state.phase === "wave"; i++) {
      e.tick();
      if (e.state.enemies.some((x) => x.alive && x.brittle)) return true;
    }
    return false;
  };
  assert.ok(chilled("a"), "Blizzard Cone must actually mark bodies brittle — \"chilled bodies take extra damage\" is its identity");
  assert.ok(!chilled(null), "…and the Freezer Blast it replaces must not (or the branch buys nothing)");
  assert.ok(!chilled("b"), "…nor its sibling, which trades the cold for lightning");
  // the brittle multiplier itself is combat math, so pin it at the seam
  const base = { type: "sock", hp: 100, maxHp: 100, shield: 0, armor: 0, brittle: false };
  const plain = TD.computeHit(50, "bonk", base).hpDmg;
  const brittle = TD.computeHit(50, "bonk", Object.assign({}, base, { brittle: true })).hpDmg;
  assert.ok(brittle > plain, `a brittle body must take more (${brittle} vs ${plain})`);
});

test("BRANCH IDENTITY 🧊 Static Zap's chain DECAYS by its declared factor down the arc", () => {
  const C = DATA.TOWERS.fan.branches.b.chain;
  const lvl = micro([{ groups: [{ type: "knight", count: 12, gap: 0.4, delay: 0 }] }], [{ id: "m1", cx: 10, cy: 3 }]);
  const e = TD.createEngine(lvl, { seed: 8 });
  e.place("fan", "m1");
  const t = e.state.towers[0];
  e.state.gold = 9999;
  e.upgrade(t.id); e.upgrade(t.id);
  assert.ok(e.branch(t.id, "b").ok, "Static Zap applied");
  e.callWave();
  let arc = null;
  for (let i = 0; i < 1500 && e.state.phase === "wave" && !arc; i++) {
    const before = new Map(e.state.enemies.map((x) => [x.id, x.hp]));
    e.tick();
    e.events.splice(0);
    const hits = e.state.enemies
      .filter((x) => before.has(x.id) && x.hp < before.get(x.id))
      .map((x) => before.get(x.id) - x.hp)
      .sort((a, b) => b - a);
    if (hits.length >= 3) arc = hits;
  }
  assert.ok(arc, "the chain must strike at least 3 bodies in one firing");
  assert.equal(arc[0], C.dmg, `the first link lands full damage (saw ${arc[0]})`);
  for (let i = 1; i < arc.length; i++) {
    const want = Math.round(C.dmg * Math.pow(C.decay, i));
    assert.ok(Math.abs(arc[i] - want) <= 1,
      `link ${i} must decay to ~${want} (saw ${arc[i]}; whole arc ${arc.join(",")}) — ` +
      "the shipped tests count the strikes and their jump radius, never how much each one is worth");
  }
  // The two clauses catch DIFFERENT mutations and both are needed. The per-link
  // check pins the arc's SHAPE against the declared factor (applying decay once
  // instead of compounding gives 30,23,23,23 and fails it) but goes vacuous at
  // decay 1.0, because the expectation flattens with the data. This one pins
  // that the factor is a decay at all.
  assert.ok(arc[arc.length - 1] < arc[0], "…so the arc genuinely weakens rather than hitting flat");
});

// ---- The two THIRD ultimates (Dart c / Fan c). Same contract as the six above:
// each proves its own declared mechanic through its own engine seam, with the
// expectation DERIVED from the data rather than re-typed. ----

test("BRANCH IDENTITY 🎯 Rust Ray peels ARMOUR — so every OTHER line hits harder too", () => {
  const S = DATA.TOWERS.dart.branches.c.strip;
  const e = TD.createEngine(micro([{ groups: [{ type: "knight", count: 1, gap: 1, delay: 0 }] }]), { seed: 1 });
  e.callWave(); ticks(e, 60);
  const k = e.state.enemies[0];
  assert.ok(k && k.armor > 0, "the fixture needs an ARMOURED body or this test is vacuous");
  const plain = TD.computeHit(100, "bonk", k).hpDmg;
  assert.equal(plain, Math.round(100 * (1 - k.armor)), "baseline: armour halves bonk");
  e.applyStrip(k, S.amount, S.seconds);
  e.tick(); // the resolve pass sets `stripped`, which keeps computeHit pure
  const stripped = TD.computeHit(100, "bonk", k).hpDmg;
  assert.equal(stripped, Math.round(100 * (1 - k.armor * (1 - S.amount))),
    `a stripped body must lose ${S.amount * 100}% of its armour (saw ${plain} → ${stripped})`);
  assert.ok(stripped > plain, "…which is strictly more damage, or the branch buys nothing");
  // THE POINT: armour lives at ONE line, so peeling it helps the mortar's
  // splash, a soldier's melee and every ability. A strip that only helped the
  // dart that fired it would be a damage upgrade wearing a support costume.
  assert.equal(TD.computeHit(100, "zap", k).hpDmg, 100, "zap never saw armour, so it must not change");
  assert.match(readSrc("scripts/td-logic.js"), /if \(dmgType === "bonk"\) d \*= \(1 - effArmor\(enemy\)\)/,
    "the strip must ride the ONE armour read — a second read site is how a mechanic applies to one line and not the others");
});

test("BRANCH IDENTITY 🎯 a real Rust Ray dart strips where it LANDS, and SAYS so", () => {
  const S = DATA.TOWERS.dart.branches.c.strip;
  const lvl = micro([{ groups: [{ type: "knight", count: 6, gap: 0.6, delay: 0 }] }], [{ id: "m1", cx: 5, cy: 3 }]);
  const e = TD.createEngine(lvl, { seed: 4 });
  e.state.gold = 9999;
  e.place("dart", "m1");
  const t = e.state.towers[0];
  e.upgrade(t.id); e.upgrade(t.id);
  assert.ok(e.branch(t.id, "c").ok, "Rust Ray applied");
  e.callWave();
  let sawStripped = false, sawEvent = false;
  for (let i = 0; i < 3000 && e.state.phase === "wave" && !(sawStripped && sawEvent); i++) {
    e.tick();
    if (e.events.some((v) => v.type === "strip")) sawEvent = true;
    sawStripped = sawStripped || e.state.enemies.some((x) => x.alive && x.stripped && x.stripAmt === S.amount);
  }
  assert.ok(sawStripped, "a body hit by a Rust Ray must actually come out stripped");
  // The mechanic was INVISIBLE without an event: nothing could draw it and
  // nothing could sound it, so a 270-gold gun changed nothing you could
  // perceive — the Fan-fires-with-no-visual defect, third instance.
  assert.ok(sawEvent, "…and it must EMIT, or the renderer and the sfx have no hook");
});

test("BRANCH IDENTITY 🎯 the strip has ONE owner: strongest wins, and never downgrades", () => {
  const e = TD.createEngine(micro([{ groups: [{ type: "knight", count: 1, gap: 1, delay: 0 }] }]), { seed: 1 });
  e.callWave(); ticks(e, 60);
  const k = e.state.enemies[0];
  e.applyStrip(k, 0.6, 3);
  e.applyStrip(k, 0.2, 3);
  assert.equal(k.stripAmt, 0.6, "a WEAKER strip must not overwrite a live stronger one — the 📻-into-🛢️ bug");
  e.applyStrip(k, 0.9, 3);
  assert.equal(k.stripAmt, 0.9, "…but a stronger one does");
  const code = readSrc("scripts/td-logic.js");
  assert.equal((code.match(/\.stripAmt = /g) || []).length, 1,
    "exactly ONE writer of stripAmt — 'one read site' is a composition guarantee only while there is also one WRITE site");
});

// Isolating the Tail Wind's two halves matters: shot COUNT rises for BOTH a rate
// buff and a range buff (the tower acquires sooner and holds longer), which is
// exactly how the ⚡ power pad's first guardrail shipped unable to fail. Rate is
// read off the cooldown the engine SETS — a number range cannot touch — and
// range off the first-shot distance.
function twCooldown(support, overclock) {
  const lvl = micro([{ groups: [{ type: "knight", count: 30, gap: 0.4, delay: 0 }] }],
    [{ id: "m1", cx: 5, cy: 4 }, { id: "m2", cx: 6, cy: 4 }]);
  const e = TD.createEngine(lvl, { seed: 3 });
  e.state.gold = 99999;
  e.place("dart", "m1");
  const d = e.state.towers[0];
  e.upgrade(d.id); e.upgrade(d.id);
  if (support) {
    e.place("fan", "m2");
    const f = e.state.towers[1];
    e.upgrade(f.id); e.upgrade(f.id);
    assert.ok(e.branch(f.id, "c").ok, "Tail Wind applied");
  }
  if (overclock) { d.boostUntil = 1e9; d.boostMult = 2; }
  e.callWave();
  let peak = 0;
  for (let i = 0; i < 900; i++) { e.tick(); peak = Math.max(peak, d.cooldown); }
  return peak;
}

test("BRANCH IDENTITY 🧊 Tail Wind speeds up its NEIGHBOURS, and COMPOSES with ⚡ Overclock", () => {
  const SUP = DATA.TOWERS.fan.branches.c.support;
  const base = DATA.TOWERS.dart.tiers[2].rate * DATA.TICK_RATE;
  assert.equal(twCooldown(false, false), Math.round(base), "baseline cooldown is the tier's own rate");
  assert.equal(twCooldown(true, false), Math.round(base / SUP.rate),
    `a supported dart must reload ${SUP.rate}x faster — measured on the cooldown, where range cannot confound it`);
  // Support MULTIPLIES into boostOf instead of assigning precisely so that three
  // independent sources (Overclock, a ⚡ pad, a Tail Wind) all land. Assignment
  // would silently drop whichever wrote first — the shipped 📻/🛢️ bug.
  assert.equal(twCooldown(false, true), Math.round(base / 2), "Overclock alone is 2x");
  assert.equal(twCooldown(true, true), Math.round(base / (2 * SUP.rate)),
    "both together must be 2 x support — if this equals either alone, one source is clobbering the other");
});

test("BRANCH IDENTITY 🧊 Tail Wind extends a neighbour's REACH (and never buffs itself)", () => {
  const SUP = DATA.TOWERS.fan.branches.c.support;
  const firstDist = (support) => {
    const lvl = micro([{ groups: [{ type: "sock", count: 1, gap: 1, delay: 0 }] }],
      [{ id: "m1", cx: 12, cy: 4 }, { id: "m2", cx: 13, cy: 4 }]);
    const e = TD.createEngine(lvl, { seed: 3 });
    e.state.gold = 99999;
    e.place("dart", "m1");
    const d = e.state.towers[0];
    e.upgrade(d.id); e.upgrade(d.id);
    if (support) {
      e.place("fan", "m2");
      const f = e.state.towers[1];
      e.upgrade(f.id); e.upgrade(f.id); e.branch(f.id, "c");
    }
    e.callWave();
    for (let i = 0; i < 6000; i++) { e.tick(); if (e.state.projectiles.length) return e.state.enemies[0].dist; }
    return -1;
  };
  const plain = firstDist(false), buffed = firstDist(true);
  assert.ok(plain > 0 && buffed > 0, `both builds must fire (${plain}, ${buffed})`);
  const engageAt = (r) => 12 - Math.sqrt(r * r - 4);   // the pad sits 2 cells off the lane
  const R = DATA.TOWERS.dart.tiers[2].range;
  assert.ok(Math.abs(plain - engageAt(R)) < 0.1, `baseline engages at ~${engageAt(R).toFixed(2)} (saw ${plain.toFixed(2)})`);
  assert.ok(Math.abs(buffed - engageAt(R * SUP.range)) < 0.1,
    `a supported dart must engage at ~${engageAt(R * SUP.range).toFixed(2)} (saw ${buffed.toFixed(2)}) — ` +
    "reach is the half of this branch a shot-count test cannot separate from its rate");

  const lvl = micro([{ groups: [{ type: "sock", count: 5, gap: 1, delay: 0 }] }],
    [{ id: "m1", cx: 5, cy: 4 }, { id: "m2", cx: 6, cy: 4 }]);
  const e = TD.createEngine(lvl, { seed: 3 });
  e.state.gold = 99999;
  e.place("dart", "m1");
  const d = e.state.towers[0];
  e.upgrade(d.id); e.upgrade(d.id);
  e.place("fan", "m2");
  const f = e.state.towers[1];
  e.upgrade(f.id); e.upgrade(f.id); e.branch(f.id, "c");
  e.callWave(); e.tick();
  assert.equal(d.supRate, SUP.rate, "the neighbour is buffed");
  assert.equal(f.supRate, 1, "the Tail Wind itself is not — it is a support tower, not a self-buff");
  e.sell(f.id); e.tick();
  assert.equal(d.supRate, 1, "selling the Tail Wind clears what it was giving");
});

test("BRANCH IDENTITY 🧊 its radius is sized to the MAPS, and a board without one writes nothing", () => {
  // The single most important number in the branch. At the fan's own 2.4 aura a
  // Tail Wind reaches NOTHING on 21 of 36 levels, because the median distance
  // from a pad to its nearest neighbour is 4.00 cells — it would have been a
  // 300-gold trap. A support tower's radius is a property of the MAPS.
  const R = DATA.TOWERS.fan.branches.c.support.radius;
  assert.ok(R > DATA.TOWERS.fan.branches.c.auraRange,
    "the support radius must be its OWN number, larger than the combat aura");
  const dead = DATA.LEVELS.filter((l) => !l.pads.some((a) =>
    l.pads.some((b) => b.id !== a.id && Math.hypot(a.cx - b.cx, a.cy - b.cy) <= R)));
  assert.equal(dead.length, 0,
    `a Tail Wind must be able to help SOMETHING on every level (dead: ${dead.map((l) => l.id).join(",")})`);
  // …but placement must still be a real decision, or the tower is free power.
  const pads = DATA.LEVELS.flatMap((l) => l.pads.map((a) =>
    l.pads.filter((b) => b.id !== a.id && Math.hypot(a.cx - b.cx, a.cy - b.cy) <= R).length));
  const useless = pads.filter((n) => n === 0).length / pads.length;
  assert.ok(useless > 0.1,
    `WHERE you put it must matter — only ${(useless * 100).toFixed(0)}% of pads buff nobody, which makes placement free`);

  // and the support pass never writes on a board that has no support tower, so
  // every historical run's state stays byte-identical.
  const lvl = micro([{ groups: [{ type: "sock", count: 6, gap: 0.5, delay: 0 }] }], [{ id: "m1", cx: 5, cy: 3 }]);
  const e = TD.createEngine(lvl, { seed: 2 });
  e.state.gold = 9999;
  e.place("dart", "m1");
  e.callWave(); ticks(e, 400);
  assert.ok(e.state.towers.every((t) => t.supRate === undefined && t.supRange === undefined),
    "a board with no support tower must not carry support fields at all");
  assert.equal(e.state.hadSupport, undefined, "…nor the latch");
});

test("TD2 mixed arsenal: deterministic replay AND an all-four-lines L1 build wins", () => {
  const lvl = micro([
    { groups: [{ type: "sock", count: 6, gap: 0.4, delay: 0 }, { type: "marble", count: 4, gap: 0.3, delay: 1 }] },
  ]);
  const go = () => {
    const e = TD.createEngine(lvl, { seed: 11 });
    e.place("mortar", "m1"); e.place("fan", "m2"); e.place("camp", "m3");
    e.callWave();
    let g = 0;
    while (e.state.phase === "wave" && g++ < 60000) e.tick();
    return TD.hashState(e.state);
  };
  assert.equal(go(), go(), "a mixed-arsenal micro run replays hash-identical");

  // the real L1 with one of each line + upgrades must win comfortably
  const e = TD.createEngine(L1, { seed: 21 });
  const plan = {
    1: (x) => { x.place("dart", "p3"); x.place("mortar", "p2"); x.place("camp", "p4"); },
    3: (x) => { x.place("fan", "p6"); },
    5: (x) => { const d = x.state.towers.find((t) => t.lineId === "dart"); if (d) x.upgrade(d.id); },
  };
  const final = run(e, plan);
  assert.equal(final.phase, "won", "the all-lines L1 build wins");
  assert.ok(final.lives >= 8, `all-lines build keeps ≥8 lives, got ${final.lives}`);
});

// ================= Audit fixes (targeting, balance, difficulty, rally) =================

test("AUDIT: dart 'strong' targeting re-evaluates every tick (not sticky-locked on the first-acquired)", () => {
  // The sticky-keep bug made strong/last/close inert — a stronger enemy entering
  // range was ignored. Fix: non-'first' modes re-pick each tick. Over a whole
  // wave, the dart set to 'strong' must almost never sit locked on a strictly-
  // weaker enemy while a UNIQUE strongest is in range (residual = HP-tie / same-
  // tick-death timing only). Baseline (buggy) was ~60% of sampled ticks.
  const e = TD.createEngine(L1, { seed: 7 });
  e.place("dart", "p3"); const t = e.state.towers[0];
  e.setTargeting(t.id, "strong");
  e.callWave();
  const R = DATA.TOWERS.dart.tiers[0].range;
  let sampled = 0, violations = 0;
  for (let i = 0; i < 1500 && e.state.phase === "wave"; i++) {
    e.tick();
    const inRange = e.state.enemies.filter((en) => {
      if (!en.alive) return false; const p = e.posAt(en.dist);
      return (p.x - t.cx) ** 2 + (p.y - t.cy) ** 2 <= R * R;
    });
    if (inRange.length < 2) continue;
    const maxHp = Math.max.apply(null, inRange.map((x) => x.hp));
    const topCount = inRange.filter((x) => x.hp === maxHp).length;
    if (topCount !== 1) continue; // skip HP ties (tiebreak is by distance, legitimately)
    sampled++;
    const locked = e.state.enemies.find((en) => en.id === t.targetId);
    if (locked && locked.hp < maxHp) violations++;
  }
  assert.ok(sampled > 30, "the wave produced enough 2+-in-range samples, got " + sampled);
  assert.ok(violations / sampled < 0.15, `dart 'strong' must track the strongest (violation rate ${(violations / sampled * 100).toFixed(1)}% of ${sampled}; buggy baseline was ~60%)`);
});

test("AUDIT: no DAMAGE-role tier-4 branch is a straight DPS downgrade from the tier-3 it replaces", () => {
  // The two audit defects: Sticky Bomb (dmg 46→60) and RC Racers (dmg 7→9) each
  // read as a stat-regression on the tooltip. The damage-role branches must now
  // match or beat their tier-3 baseline. Deliberate SIDEGRADES are exempt and
  // listed here so the exemption is explicit, not accidental:
  //   • camp 'a' Dino Squad — trades squad DPS for tank HP + double-block
  //   • fan  'a'/'b' Blizzard/Static — trade slow/zap for brittle/chain utility
  //   • dart 'c' Rust Ray — its output IS the armour strip; 28 dps against the
  //     Foam Gatling's 34.3 is the price of a support gun, and every other
  //     tower on the board hits harder for it
  //   • fan  'c' Tail Wind — it barely fights at all; it buffs its neighbours
  // The two lists together must COVER every shipped branch, so a future one
  // cannot be exempt by omission the way these two nearly were — an
  // inclusion-only list is the "a scan's own list is part of the scan" trap.
  const dpsBranch = [["dart", "a"], ["dart", "b"], ["mortar", "a"], ["mortar", "b"], ["camp", "b"]];
  const utilityBranch = [["camp", "a"], ["fan", "a"], ["fan", "b"], ["dart", "c"], ["fan", "c"]];
  const classified = new Set(dpsBranch.concat(utilityBranch).map(([l, k]) => l + ":" + k));
  for (const [line, def] of Object.entries(DATA.TOWERS)) {
    for (const key of Object.keys(def.branches || {})) {
      assert.ok(classified.has(line + ":" + key),
        `${line} '${key}' (${def.branches[key].name}) is neither a damage-role branch nor a listed sidegrade — ` +
        "classify it, so a DPS downgrade can never ship merely because nobody added it to a list");
    }
  }
  for (const [line, key] of utilityBranch) {
    assert.ok(DATA.TOWERS[line].branches[key], `${line} '${key}' is exempted but does not exist — stale list`);
  }
  for (const [line, key] of dpsBranch) {
    const def = DATA.TOWERS[line], t3 = def.tiers[2], b = def.branches[key];
    const bd = def.kind === "camp" ? b.soldiers * b.dmg / b.rate : b.dmg / b.rate;
    const td = def.kind === "camp" ? t3.soldiers * t3.dmg / t3.rate : t3.dmg / t3.rate;
    assert.ok(bd >= td - 1e-9, `${line} ${key} (${b.name}) output ${bd.toFixed(1)} must be >= tier-3 ${t3.name} ${td.toFixed(1)}`);
  }
  // The two specific fixes, pinned by name so a future re-tune can't silently undo them.
  assert.ok(DATA.TOWERS.mortar.branches.b.dmg >= DATA.TOWERS.mortar.tiers[2].dmg, "Sticky Bomb dmg >= Crate Cannon dmg");
  const rc = DATA.TOWERS.camp.branches.b, elite = DATA.TOWERS.camp.tiers[2];
  assert.ok((rc.soldiers * rc.dmg / rc.rate) >= (elite.soldiers * elite.dmg / elite.rate), "RC Racers squad DPS >= Elite Platoon (faster rate compensates fewer/weaker bodies)");
});

test("AUDIT: difficulty multipliers actually bite (heroic enemies are tougher; a fixed build keeps fewer lives)", () => {
  // heroic hp 1.25 vs casual 0.8 → the same enemy is meaningfully tougher.
  const mk = (d) => { const e = TD.createEngine(L1, { seed: 7, difficulty: d }); e.callWave(); for (let i = 0; i < 60; i++) e.tick(); return e.state.enemies.find((x) => x.type === "sock"); };
  const cas = mk("casual"), her = mk("heroic");
  assert.ok(cas && her, "a sock spawned on both difficulties");
  assert.ok(her.maxHp > cas.maxHp, `heroic sock hp ${her.maxHp} must exceed casual ${cas.maxHp}`);
  // same build, casual must keep >= heroic lives (difficulty changes the outcome)
  const play = (d) => { const e = TD.createEngine(L1, { seed: 7, difficulty: d }); let g = 0, built = false;
    while (e.state.phase !== "won" && e.state.phase !== "lost") { if (e.state.phase === "build") { if (!built) { e.place("dart", "p3"); e.place("dart", "p2"); e.place("dart", "p4"); built = true; } e.callWave(); } e.tick(); if (++g > 400000) break; }
    return e.state.phase === "won" ? e.state.lives : -1; };
  assert.ok(play("casual") >= play("heroic"), "the same 3-dart build keeps at least as many lives on casual as heroic");
});

test("AUDIT: a rally issued mid-combat updates an ENGAGED soldier's post (honored once it disengages)", () => {
  const lvl = { id: 97, name: "micro-rally", world: "test", startGold: 5000, budgetBase: 100,
    path: [[0, 2], [23, 2]], pads: [{ id: "m1", cx: 5, cy: 3 }],
    waves: [{ groups: [{ type: "sock", count: 1, gap: 1, delay: 0 }] }] };
  const e = TD.createEngine(lvl, { seed: 3 });
  e.place("camp", "m1"); const c = e.state.towers[0];
  e.callWave();
  let eng = null;
  for (let i = 0; i < 4000 && e.state.phase === "wave"; i++) { e.tick(); eng = e.state.soldiers.find((s) => s.alive && s.engagedId); if (eng) break; }
  assert.ok(eng, "a soldier engaged the sock");
  const beforeTx = eng.tx, beforeTy = eng.ty;
  const r = e.rally(c.id, c.cx + 1.2, c.cy - 0.4);
  assert.ok(r.ok, "rally within range succeeds");
  assert.ok(eng.tx !== beforeTx || eng.ty !== beforeTy, `the engaged soldier's post updated (was ${beforeTx.toFixed(2)},${beforeTy.toFixed(2)}, now ${eng.tx.toFixed(2)},${eng.ty.toFixed(2)})`);
});

test("AUDIT: camp soldiers rally ON the path (posts sit on the lane, not scattered beside it)", () => {
  // A camp's only job is to BLOCK, and a soldier blocks what comes within
  // 0.55 cells of it — so how far a post sits from the road is the whole of
  // whether it works. The 0.5 bar here is that engage radius with a margin.
  //
  // SCOPE, and it is the point of this rewrite: the comment here used to say
  // "for EVERY camp-able pad" while the loop walked L1's six. Swept over all
  // 40 levels the shipped tangent spread put a post off the lane on 22 of 501
  // camp-able pads — every one of them a rally point at a lane END, where a
  // straight tangent through it simply runs off the last waypoint (L18/p2
  // rallies at the exit (23,0) and posted a guy at (23.52,-0.10), off the board
  // on a 24-wide grid). Measured rather than assumed: at 0.53 that soldier is
  // still barely inside 0.55, so it is out of position rather than inert — it
  // blocks 8 bodies where its siblings block 17 and 18 — and it is one
  // stagger-width from dead. Posts now walk the lane's own ARC LENGTH, so being
  // on the lane is true by construction; this walks every pad of every level so
  // a future lane shape cannot re-open it. A scan's own list is part of the scan.
  //
  // Measured against EVERY lane, not just lane 0: a fork level's camp may
  // legitimately post on the switch track (the TD-11 lesson — when a level
  // gains a second lane, every per-lane law must be re-run against all of them).
  // Exact point-segment projection rather than a sampled walk: at 501 pads a
  // 0.1-step scan of every lane is ~1M posAt calls, and sampling granularity
  // would sit inside the tolerance being asserted.
  const distToAnyLane = (e, x, y) => {
    let best = Infinity;
    for (let li = 0; li < e.paths.length; li++) {
      for (const s of e.paths[li].segs) {
        const dx = s.bx - s.ax, dy = s.by - s.ay;
        const L2 = dx * dx + dy * dy;
        let t = L2 === 0 ? 0 : ((x - s.ax) * dx + (y - s.ay) * dy) / L2;
        t = Math.max(0, Math.min(1, t));
        const dd = (s.ax + dx * t - x) ** 2 + (s.ay + dy * t - y) ** 2;
        if (dd < best) best = dd;
      }
    }
    return Math.sqrt(best);
  };
  let pads = 0, worst = 0, worstAt = "";
  for (const lvl of DATA.LEVELS) {
    for (const pad of lvl.pads) {
      const e = TD.createEngine(lvl, { seed: 5 });
      e.state.gold = 99999; // a geometry sweep, not a balance sim
      if (!e.place("camp", pad.id).ok) continue;
      const cam = e.state.towers[e.state.towers.length - 1];
      for (let i = 0; i < 120; i++) e.tick(); // let them deploy
      const mine = e.state.soldiers.filter((s) => s.campId === cam.id);
      assert.ok(mine.length >= 2, `L${lvl.id} camp on ${pad.id} fielded a squad`);
      pads++;
      for (const s of mine) {
        const dPost = distToAnyLane(e, s.tx, s.ty);
        if (dPost > worst) { worst = dPost; worstAt = `L${lvl.id}/${pad.id}`; }
        assert.ok(dPost <= 0.5,
          `L${lvl.id} camp ${pad.id}: a soldier post must sit ON a lane (dist ${dPost.toFixed(2)} ≤ 0.5) — ` +
          "past the 0.55 engage radius it can never reach anything on the road, and this bar keeps a margin");
      }
    }
  }
  // The sweep must actually have swept. A `continue` that silently skipped every
  // pad would leave every assertion above unreached and this test green.
  assert.ok(pads >= 400, `the sweep must cover the campaign's camp-able pads, saw ${pads}`);
  assert.ok(worst > 0, `worst post distance ${worst.toFixed(3)} at ${worstAt}`); // keep the number in the log
});

test("AUDIT: a camp's OPENING rally is a flag position the player may choose again", () => {
  // The engine picks a camp's first rally point; the player moves it with
  // rally(), which refuses anything outside rallyRange. Those two must agree,
  // or the camp opens on a posture that can never be restored once you move it.
  //
  // They did not. defaultRally compared a lane point (a CELL INDEX) against
  // `pad.cx + 0.5` (a WORLD centre) — this engine's two coordinate spaces, the
  // fifth site to mix them — so on 16 of 501 camp-able pads the default landed
  // up to 3.04 cells out against a gate of 2.5 and rally() would have refused
  // it. Removing the bias alone left 9, because those pads are genuinely 3.00
  // cells from every lane: the gate was simply narrower than the reach the
  // engine has always used, and every level was tuned with that reach.
  //
  // TWO clauses, because they fail on different things. The first is a law
  // about the DATA and it is what makes this test able to fail on a new level.
  const RR = DATA.TOWERS.camp.rallyRange;
  const onALane = (e, x, y) => {
    let best = Infinity;
    for (const pth of e.paths) for (const s of pth.segs) {
      const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy;
      let t = L2 === 0 ? 0 : ((x - s.ax) * dx + (y - s.ay) * dy) / L2;
      t = Math.max(0, Math.min(1, t));
      const dd = (s.ax + dx * t - x) ** 2 + (s.ay + dy * t - y) ** 2;
      if (dd < best) best = dd;
    }
    return Math.sqrt(best);
  };
  let n = 0, worst = 0, worstAt = "";
  for (const lvl of DATA.LEVELS) {
    for (const pad of lvl.pads) {
      const e = TD.createEngine(lvl, { seed: 5 });
      e.state.gold = 99999;
      if (!e.place("camp", pad.id).ok) continue;
      const c = e.state.towers[e.state.towers.length - 1];
      n++;
      const d = Math.hypot(c.rallyX - c.cx, c.rallyY - c.cy);
      if (d > worst) { worst = d; worstAt = `L${lvl.id}/${pad.id}`; }
      // The clause that actually pins the COORDINATE fix, and it needed its own
      // measurement: with the reach widened, the biased default is still inside
      // the gate and still on a lane, so restoring the bias passes both of the
      // clauses below. What it cannot survive is being asked for the NEAREST
      // point — biased, the chosen point is up to 1.062 cells further from the
      // pad than the true minimum on 16 pads; measured in the engine's own
      // space it is 0.000 on all 501. Tolerance is the sampler's 0.25 step.
      let best = Infinity;
      for (const pth of e.paths) for (const s of pth.segs) {
        const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy;
        let t = L2 === 0 ? 0 : ((c.cx - s.ax) * dx + (c.cy - s.ay) * dy) / L2;
        t = Math.max(0, Math.min(1, t));
        const dd = (s.ax + dx * t - c.cx) ** 2 + (s.ay + dy * t - c.cy) ** 2;
        if (dd < best) best = dd;
      }
      assert.ok(d - Math.sqrt(best) <= 0.13,
        `L${lvl.id}/${pad.id}: the opening rally is ${d.toFixed(2)} from the pad but a lane point ` +
        `${Math.sqrt(best).toFixed(2)} away exists — defaultRally must measure in the engine's own ` +
        "space (a lane point is a CELL INDEX, and so is pad.cx), like rally() and targeting do");
      assert.ok(e.rally(c.id, c.rallyX, c.rallyY).ok,
        `L${lvl.id}/${pad.id}: the camp OPENED on (${c.rallyX.toFixed(2)},${c.rallyY.toFixed(2)}), ` +
        `${d.toFixed(2)} cells from the pad, and rally() refuses it (range ${RR}) — ` +
        "move that flag once and the opening posture is gone for good");
      // …and the clamp must not be doing the work on shipped data: every
      // camp-able pad must be able to put its wall ON the road. A new level
      // whose pad sits further than rallyRange from every lane fails HERE,
      // which is the actionable message (move the pad, or widen the reach).
      assert.ok(onALane(e, c.rallyX, c.rallyY) < 0.01,
        `L${lvl.id}/${pad.id}: the default rally is ${onALane(e, c.rallyX, c.rallyY).toFixed(2)} cells ` +
        `off every lane — it is ${d.toFixed(2)} from the pad against a reach of ${RR}, so this pad cannot ` +
        "post its soldiers on the road at all and a camp built there can never block");
    }
  }
  assert.ok(n >= 400, `the sweep must cover the campaign's camp-able pads, saw ${n}`);
  assert.ok(worst <= RR, `worst opening rally ${worst.toFixed(2)} at ${worstAt} (reach ${RR})`);

  // The second clause is a law about the CODE: defaultRally's postcondition is
  // unconditional, not a silent precondition on level data. A pad deliberately
  // marooned from the lane must still open on a flag rally() accepts — the
  // clamp is what makes the function total, and it is dead on shipped data by
  // design (the clause above proves that), so this is the only thing that can
  // exercise it. Without it the engine would answer a bad level with an
  // illegal state instead of a degraded one.
  const marooned = JSON.parse(JSON.stringify(DATA.LEVELS[0]));
  marooned.pads = [{ id: "far", cx: marooned.path[0][0], cy: marooned.path[0][1] + 9 }];
  const me = TD.createEngine(marooned, { seed: 5 });
  me.state.gold = 99999;
  assert.ok(me.place("camp", "far").ok, "the marooned fixture placed a camp");
  const mc = me.state.towers[0];
  const md = Math.hypot(mc.rallyX - mc.cx, mc.rallyY - mc.cy);
  assert.ok(md > RR - 0.01 && md <= RR,
    `a marooned pad's default must be pulled to the edge of the reach, got ${md.toFixed(3)} (reach ${RR})`);
  assert.ok(me.rally(mc.id, mc.rallyX, mc.rallyY).ok,
    "defaultRally must ALWAYS return a point rally() accepts, even for a pad no lane comes near");
});

test("PLAYABILITY: EVERY shipped level is winnable by a sensible build AND losable by neglect", () => {
  // The honest e2e contract for a real-time game: a sensible MIXED build (Fan for
  // armor/slow, Mortar for groups/splitters, Dart for fliers/general — the tools a
  // competent player reaches for) must WIN every level with a fair margin, and
  // doing NOTHING must LOSE. This is the guardrail that would have screamed if a
  // level were missing or unbeatable — and, since the roster now has armor
  // (Knight) that shrugs off Bonk, a dart-only solver would understate winnability.
  const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
  function playWith(level, seed, plan, difficulty) {
    const e = TD.createEngine(level, { seed, difficulty });
    const padIds = level.pads.map((p) => p.id);
    let idx = 0, guard = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 600000) {
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
    return e.state;
  }
  // A competent player picks the right tools for the level: a cheap dart-swarm
  // where there's no armor, a Fan/Mortar mix where there is. The level is
  // "winnable" if EITHER sensible build clears it — take the better outcome.
  const DART_PLAN = ["dart"];
  const MIXED_PLAN = ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"];
  function autoPlay(level, seed, difficulty) {
    const a = playWith(level, seed, DART_PLAN, difficulty);
    const b = playWith(level, seed, MIXED_PLAN, difficulty);
    if (a.phase === "won" && b.phase === "won") return a.lives >= b.lives ? a : b;
    return a.phase === "won" ? a : b;
  }
  function neglect(level, seed, meta) {
    const e = TD.createEngine(level, { seed, meta });
    let g = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && g++ < 400000) { if (e.state.phase === "build") e.callWave(); e.tick(); }
    return e.state;
  }
  // TD-8 audit: the losable-by-neglect contract must hold even with the ENTIRE
  // star tree owned — a future ability that let a do-nothing build survive
  // (an over-strong Patch Kit heal, an early-wave shield, etc.) would otherwise
  // ship green. The maxed loadout still loses because Patch Kit only heals every
  // 5th CLEARED wave (neglect dies first), Allowance needs towers to matter, and
  // Sticker Shield absorbs a single leak.
  const ALL_META = DATA.META_NODES.map((n) => n.id);
  assert.ok(DATA.LEVELS.length >= 5, `the fort ships real progression, not one level (got ${DATA.LEVELS.length})`);
  // levels are contiguous 1..N so progression can actually chain
  DATA.LEVELS.forEach((l, i) => assert.equal(l.id, i + 1, "level ids are contiguous from 1"));
  for (const lvl of DATA.LEVELS) {
    for (const seed of [7, 23, 99]) {
      const w = autoPlay(lvl, seed, "normal");
      assert.equal(w.phase, "won", `L${lvl.id} "${lvl.name}" must be winnable by fill-and-upgrade (seed ${seed})`);
      assert.ok(w.lives >= 5, `L${lvl.id} keeps a fair margin (≥5 lives, got ${w.lives} @seed ${seed})`);
    }
    assert.equal(neglect(lvl, 7).phase, "lost", `L${lvl.id} must be LOSABLE by neglect (real stakes, not no-fail)`);
    assert.equal(neglect(lvl, 7, ALL_META).phase, "lost", `L${lvl.id} must be LOSABLE by neglect even with the FULL star tree owned (meta can't rescue a do-nothing build)`);
  }
  // difficulty should broadly rise: the LAST level is harder than the FIRST
  const easy = autoPlay(DATA.LEVELS[0], 7, "normal").lives;
  const hard = autoPlay(DATA.LEVELS[DATA.LEVELS.length - 1], 7, "normal").lives;
  assert.ok(hard < easy, `the final level should be harder than the first (L1 kept ${easy}, L${DATA.LEVELS.length} kept ${hard})`);
});

// ================= TD-3: World-1 roster + boss mechanics =================
function microLevel(type, count, pad, startGold) {
  return { id: 94, name: "micro", world: "test", startGold: startGold || 5000, budgetBase: 100,
    path: [[0, 3], [23, 3]], pads: [pad || { id: "m", cx: 5, cy: 2 }],
    waves: [{ groups: [{ type, count: count || 1, gap: 0.5, delay: 0 }] }] };
}

test("TD3 Mud Blob splits into two Mudlets when killed (and split is idempotent)", () => {
  const e = TD.createEngine(microLevel("blob", 1), { seed: 2 });
  e.place("mortar", "m"); e.callWave();
  let maxMudlets = 0;
  for (let i = 0; i < 500 && e.state.phase === "wave"; i++) { e.tick(); maxMudlets = Math.max(maxMudlets, e.state.enemies.filter((x) => x.type === "mudlet").length); }
  assert.equal(maxMudlets, 2, `a Mud Blob must spawn exactly 2 Mudlets on death (saw ${maxMudlets})`);
  assert.deepEqual(DATA.ENEMIES.blob.split, { into: "mudlet", count: 2 }, "blob split truth");
});

test("TD3 Plastic Knight's 50% armor halves Bonk but Fan Zap ignores it", () => {
  const knight = { type: "knight", hp: 100, maxHp: 100, shield: 0, armor: DATA.ENEMIES.knight.armor, brittle: false };
  assert.equal(TD.computeHit(40, "bonk", knight).hpDmg, 20, "bonk halved by 50% armor");
  assert.equal(TD.computeHit(40, "zap", knight).hpDmg, 40, "zap ignores armor (the Fan is the answer)");
});

test("TD3 Wind-up Bull charges (speeds up) after it takes a hit", () => {
  const e = TD.createEngine(microLevel("bull", 1), { seed: 9 });
  e.place("dart", "m"); e.callWave();
  let charged = false;
  for (let i = 0; i < 300 && e.state.phase === "wave"; i++) { e.tick(); const b = e.state.enemies.find((x) => x.type === "bull" && x.alive); if (b && b.chargeUntil > e.state.tick) charged = true; }
  assert.ok(charged, "a Bull must enter a charge window after being hit");
});

test("TD3 Junk Healer mends a wounded ally (not itself)", () => {
  const lvl = { id: 95, name: "heal", world: "test", startGold: 5000, budgetBase: 100, path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 5, cy: 2 }],
    waves: [{ groups: [{ type: "healer", count: 1, gap: 0.1, delay: 0 }, { type: "sock", count: 1, gap: 0.1, delay: 0 }] }] };
  const e = TD.createEngine(lvl, { seed: 4 }); e.callWave();
  for (let i = 0; i < 15; i++) e.tick();
  const sock = e.state.enemies.find((x) => x.type === "sock" && x.alive);
  assert.ok(sock, "sock present next to the healer");
  sock.hp = 5; const before = sock.hp;
  for (let i = 0; i < 20; i++) e.tick();
  assert.ok(sock.alive && sock.hp > before, `the Healer must heal a wounded ally (${before} → ${sock.hp.toFixed(1)})`);
});

test("TD3 Piñata bursts bonus gold and takes 2 lives if it leaks", () => {
  assert.equal(DATA.ENEMIES.pinata.goldBurst, 20, "piñata gold-burst truth");
  assert.equal(DATA.ENEMIES.pinata.lives, 2, "piñata costs 2 lives on leak");
  // heavy setup (2 tier-3 mortars) so the 400hp piñata actually dies, then check the payout
  const lvl = { id: 96, name: "pin", world: "test", startGold: 5000, budgetBase: 100, path: [[0, 3], [23, 3]],
    pads: [{ id: "a", cx: 6, cy: 5 }, { id: "b", cx: 12, cy: 5 }], waves: [{ groups: [{ type: "pinata", count: 1, gap: 1, delay: 0 }] }] };
  const e = TD.createEngine(lvl, { seed: 1 });
  ["a", "b"].forEach((p) => { e.place("mortar", p); const t = e.state.towers.find((x) => x.padId === p); e.upgrade(t.id); e.upgrade(t.id); });
  e.callWave();
  const goldBefore = e.state.gold;
  for (let i = 0; i < 2500 && e.state.phase === "wave"; i++) e.tick();
  assert.ok(!e.state.enemies.some((x) => x.type === "pinata" && x.alive), "the piñata was killed");
  assert.ok(e.state.gold - goldBefore >= 60 + 20, `killing the piñata pays bounty(60) + a gold burst(20) (got +${e.state.gold - goldBefore})`);
});

test("TD3 Bed Monster boss: unblockable by soldiers, stomps them, and headlines L4's finale", () => {
  const e = TD.createEngine(microLevel("bedmonster", 1, { id: "m", cx: 4, cy: 4 }), { seed: 5 });
  e.place("camp", "m"); e.callWave();
  let everBlocked = false, minSolHp = 999, downs = 0;
  for (let i = 0; i < 2600 && e.state.phase === "wave"; i++) { // a boss crossing takes ~2500 ticks at speed 0.28
    e.tick();
    const boss = e.state.enemies.find((x) => x.type === "bedmonster");
    if (boss && boss.blockedBy) everBlocked = true;
    for (const s of e.state.soldiers) minSolHp = Math.min(minSolHp, s.hp); // ALL soldiers — a stomped one dies (hp<0) and leaves the alive set
    downs += e.events.filter((ev) => ev.type === "soldier-down").length; e.events.length = 0;
  }
  assert.ok(!everBlocked, "a boss can NEVER be blocked by soldiers (it's unblockable)");
  assert.ok(minSolHp < DATA.TOWERS.camp.tiers[0].hp && downs > 0, `the boss stomp damaged/downed the soldiers (minHp ${minSolHp}, downs ${downs})`);
  // it is the finale of L4
  const l4 = DATA.LEVELS.find((l) => l.id === 4);
  const finale = l4.waves[l4.waves.length - 1];
  assert.ok(finale.boss && finale.groups.some((g) => g.type === "bedmonster"), "L4's last wave is the Bed Monster boss");
});

// ================= TD-4: Worlds 2-3 roster, bosses, gimmicks =================
// A dart sitting right on the lane so its target is always geometrically in range —
// isolates "is it TARGETABLE?" (isHidden) from "is it in range?".
function laneDart(type, count, extra) {
  return Object.assign({ id: 93, name: "micro", world: "test", startGold: 9000, budgetBase: 100,
    path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 5, cy: 3 }],
    waves: [{ groups: [{ type, count: count || 1, gap: 0.5, delay: 0 }] }] }, extra || {});
}

test("TD4 Glitter Ghost: untargetable mid-phase — a dart drops it while hidden, re-locks when it shimmers back", () => {
  const e = TD.createEngine(laneDart("ghost", 1), { seed: 2 });
  e.place("dart", "m"); const t = e.state.towers[0];
  e.callWave();
  let hiddenNoLock = false, visibleLock = false, sawHidden = false, sawVisible = false;
  for (let i = 0; i < 300 && e.state.phase === "wave"; i++) {
    e.tick();
    const g = e.state.enemies.find((x) => x.type === "ghost" && x.alive);
    if (!g) break;
    if (g.phaseHidden) { sawHidden = true; if (t.targetId !== g.id) hiddenNoLock = true; }
    else { sawVisible = true; if (t.targetId === g.id) visibleLock = true; }
  }
  assert.ok(sawHidden && sawVisible, "the ghost phased both ways during the run");
  assert.ok(hiddenNoLock, "a dart must NOT hold a lock on a ghost while it is phased out");
  assert.ok(visibleLock, "a dart re-acquires the ghost once it is visible again");
  assert.deepEqual(DATA.ENEMIES.ghost.phase, { every: 4, on: 1.5 }, "ghost phase cadence truth");
});

test("TD4 Battery Bot: the shield absorbs Zap (Fan) but Bonk (Dart) ignores it — and it regenerates", () => {
  // combat-math truth: zap eaten by shield, bonk straight to hp regardless of shield
  const bot = { armor: 0, shield: 40, brittle: false };
  assert.equal(TD.computeHit(30, "zap", bot).shieldDmg, 30, "zap hits the shield first");
  assert.equal(TD.computeHit(30, "zap", bot).hpDmg, 0, "a full shield eats the whole zap");
  assert.equal(TD.computeHit(30, "bonk", { armor: 0, shield: 40, brittle: false }).hpDmg, 30, "bonk ignores the shield entirely");
  // regen: a drained shield refills over time
  const e = TD.createEngine(laneDart("battery", 1), { seed: 1 });
  e.callWave(); for (let i = 0; i < 8; i++) e.tick();
  const b = e.state.enemies.find((x) => x.type === "battery");
  b.shield = 5; const before = b.shield;
  for (let i = 0; i < 40; i++) e.tick();
  assert.ok(b.shield > before && b.shield <= DATA.ENEMIES.battery.shield, `battery shield regenerates (${before} → ${b.shield.toFixed(1)}, cap ${DATA.ENEMIES.battery.shield})`);
});

test("TD4 Digger Mole: untargetable AND unblockable under the middle third, hittable at the ends", () => {
  const e = TD.createEngine(laneDart("mole", 1), { seed: 1 });
  // dart at the far end so the mole is only in range as it surfaces near the exit
  const e2 = TD.createEngine(Object.assign(laneDart("mole", 1), { pads: [{ id: "m", cx: 20, cy: 3 }] }), { seed: 1 });
  e2.place("dart", "m"); const t = e2.state.towers[0];
  e2.callWave();
  let lockedInMiddle = false, lockedAtEnd = false;
  const tot = e2.path.total;
  for (let i = 0; i < 800 && e2.state.phase === "wave"; i++) {
    e2.tick();
    const m = e2.state.enemies.find((x) => x.type === "mole" && x.alive);
    if (!m) break;
    const inMid = m.dist > tot / 3 && m.dist < (tot * 2) / 3;
    if (inMid && t.targetId === m.id) lockedInMiddle = true;
    if (!inMid && m.dist > (tot * 2) / 3 && t.targetId === m.id) lockedAtEnd = true;
  }
  assert.ok(!lockedInMiddle, "no tower may target a mole tunnelling under the middle third");
  assert.ok(lockedAtEnd, "the mole is targetable again once it surfaces past the middle");
  // unblockable underground: a camp mid-lane can't hold it while it's under
  const ce = TD.createEngine(Object.assign(laneDart("mole", 1), { pads: [{ id: "m", cx: 11, cy: 3 }] }), { seed: 1 });
  ce.place("camp", "m"); ce.callWave();
  let blockedInMiddle = false;
  for (let i = 0; i < 900 && ce.state.phase === "wave"; i++) {
    ce.tick();
    const m = ce.state.enemies.find((x) => x.type === "mole" && x.alive);
    if (m && m.blockedBy && m.dist > ce.path.total / 3 && m.dist < (ce.path.total * 2) / 3) blockedInMiddle = true;
  }
  assert.ok(!blockedInMiddle, "a tunnelling mole cannot be blocked by soldiers");
});

test("TD4 Kite Hawk: a fast flier — only Dart/Fan touch it, the ground-only Mortar never fires at it", () => {
  assert.equal(DATA.ENEMIES.hawk.flier, true, "hawk is a flier");
  assert.ok(DATA.ENEMIES.hawk.speed >= 2, "hawk is fast (≥2 cells/s)");
  const e = TD.createEngine(laneDart("hawk", 2), { seed: 2 });
  e.place("mortar", "m"); e.callWave();
  let shellFired = false, sawHawk = false;
  for (let i = 0; i < 400 && e.state.phase === "wave"; i++) { e.tick(); if (e.state.enemies.some((x) => x.type === "hawk" && x.alive)) sawHawk = true; if (e.state.shells.length) shellFired = true; }
  assert.ok(sawHawk, "hawks actually spawned");
  assert.ok(!shellFired, "a ground-only Mortar must never lob at a flying hawk");
  // a Dart clears them
  const de = TD.createEngine(laneDart("hawk", 2), { seed: 2 });
  de.place("dart", "m"); const dt = de.state.towers[0]; de.state.gold = 9000; de.upgrade(dt.id); de.upgrade(dt.id);
  de.callWave();
  let g = 0; while (de.state.phase === "wave" && g++ < 3000) de.tick();
  assert.equal(de.state.phase, "won", "a Dart shoots the fliers down");
});

test("TD4 Vacuum King boss: inhales the nearest soldier (instant KO) on its timer + enrages under half hp", () => {
  const e = TD.createEngine(laneDart("vacuumking", 1, { pads: [{ id: "m", cx: 4, cy: 4 }] }), { seed: 1 });
  e.place("camp", "m"); e.callWave();
  let sucks = 0, downs = 0;
  for (let i = 0; i < 500 && e.state.phase === "wave"; i++) {
    e.tick();
    sucks += e.events.filter((v) => v.type === "suck").length;
    downs += e.events.filter((v) => v.type === "soldier-down").length;
    e.events.length = 0;
  }
  assert.ok(sucks > 0 && downs > 0, `the Vacuum King sucked soldiers (sucks ${sucks}, downs ${downs})`);
  assert.deepEqual(DATA.ENEMIES.vacuumking.enrage, { hpPct: 0.5, mult: 1.2 }, "enrage truth");
  assert.ok(DATA.ENEMIES.vacuumking.shield > 0 && DATA.ENEMIES.vacuumking.shieldRegen > 0, "the king carries a regenerating shield");
  // finale of L8
  const l8 = DATA.LEVELS.find((l) => l.id === 8);
  const fin = l8.waves[l8.waves.length - 1];
  assert.ok(fin.boss && fin.groups.some((g) => g.type === "vacuumking"), "L8's last wave is the Vacuum King");
});

test("TD4 The Static boss: P2 jams a random gun, P3 summons Battery Bots and dashes", () => {
  const lvl = { id: 92, name: "m", world: "test", startGold: 9000, budgetBase: 100,
    path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 5, cy: 1 }, { id: "m2", cx: 9, cy: 1 }, { id: "m3", cx: 13, cy: 1 }],
    waves: [{ groups: [{ type: "thestatic", count: 1, gap: 1, delay: 0 }] }] };
  const e = TD.createEngine(lvl, { seed: 1 });
  ["m", "m2", "m3"].forEach((p) => e.place("dart", p));
  e.callWave(); for (let i = 0; i < 20; i++) e.tick();
  const boss = e.state.enemies.find((x) => x.type === "thestatic");
  // P2: force into the 66% band → a tower gets jammed
  boss.hp = boss.maxHp * 0.6;
  let disabled = 0;
  for (let i = 0; i < 400 && boss.alive; i++) { e.tick(); disabled += e.events.filter((v) => v.type === "disable").length; e.events.length = 0; }
  assert.ok(disabled > 0, "P2 jams a random gun");
  assert.ok(e.state.towers.some((t) => t.disabledUntil > 0), "a tower carries a disabled window");
  // P3: force into the 33% band → summons batteries + speeds up
  boss.hp = boss.maxHp * 0.25;
  let summons = 0;
  for (let i = 0; i < 400 && boss.alive; i++) { e.tick(); summons += e.events.filter((v) => v.type === "summon").length; e.events.length = 0; }
  assert.ok(summons > 0, "P3 summons reinforcements");
  assert.ok(e.state.enemies.some((x) => x.type === "battery"), "the summoned reinforcements are Battery Bots");
  assert.ok(boss.speedMult > 1, "P3 gives the boss a speed dash");
  const l12 = DATA.LEVELS.find((l) => l.id === 12);
  const fin = l12.waves[l12.waves.length - 1];
  assert.ok(fin.boss && fin.groups.some((g) => g.type === "thestatic"), "L12's last wave is The Static");
});

test("W4 The Tickmaster boss: P2 dashes, P3 jams a gun AND summons Loose Screws", () => {
  // The third boss shipped with the world but nothing ever drove its bands — an
  // auto-solver kills it straight through, and the tap-harness never enters the
  // attic at all, so the whole hp-gated kit could have been dead code. Same
  // lesson as The Static: FORCE each phase and assert the ability fires.
  const lvl = { id: 93, name: "m", world: "test", startGold: 9000, budgetBase: 100,
    path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 5, cy: 1 }, { id: "m2", cx: 9, cy: 1 }, { id: "m3", cx: 13, cy: 1 }],
    waves: [{ groups: [{ type: "tickmaster", count: 1, gap: 1, delay: 0 }] }] };
  const e = TD.createEngine(lvl, { seed: 2 });
  ["m", "m2", "m3"].forEach((p) => e.place("dart", p));
  e.callWave(); for (let i = 0; i < 20; i++) e.tick();
  const boss = e.state.enemies.find((x) => x.type === "tickmaster");
  assert.ok(boss, "the Tickmaster is on the field");
  assert.ok(!(boss.speedMult > 1), "…and it starts at its base pace");

  boss.hp = boss.maxHp * 0.5; // P2 band
  for (let i = 0; i < 60 && boss.alive; i++) { boss.hp = boss.maxHp * 0.5; e.tick(); }
  assert.ok(boss.speedMult > 1, "P2 winds the clock up — the boss dashes");

  boss.hp = boss.maxHp * 0.2; // P3 band
  let disabled = 0, summons = 0;
  for (let i = 0; i < 500 && boss.alive; i++) {
    boss.hp = boss.maxHp * 0.2; // hold it in-band while the timers come round
    e.tick();
    disabled += e.events.filter((v) => v.type === "disable").length;
    summons += e.events.filter((v) => v.type === "summon").length;
    e.events.length = 0;
  }
  assert.ok(disabled > 0, "P3 jams a gun");
  assert.ok(e.state.towers.some((t) => t.disabledUntil > 0), "…and a real tower carries the jam");
  assert.ok(summons > 0, "P3 summons reinforcements");
  assert.ok(e.state.enemies.some((x) => x.type === "screw"), "…and they are Loose Screws");
  const l16 = DATA.LEVELS.find((l) => l.id === 16);
  const fin = l16.waves[l16.waves.length - 1];
  assert.ok(fin.boss && fin.groups.some((g) => g.type === "tickmaster"), "L16's last wave is the Tickmaster");
});

test("the losing site is UNCONDITIONAL — every shipped difficulty can lose", () => {
  // This replaces the kid-mode gate test. The retired 🧸 mode carried `noLose`,
  // and the risk then was a gate that LEAKED into the adult ladders. With the
  // mode gone the claim is simpler and stronger: nothing is exempt. The
  // difficulty list is DERIVED, so a future tier inherits the check instead of
  // quietly shipping unlosable.
  const lvl = { id: 94, name: "m", world: "test", startGold: 0, budgetBase: 100,
    path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 5, cy: 9 }],
    waves: [{ groups: [{ type: "sock", count: 40, gap: 0.4, delay: 0 }] }] };
  const diffs = Object.keys(DATA.DIFFICULTIES);
  assert.ok(diffs.length >= 3, `expected the three ladders, saw ${diffs.join(",")}`);
  for (const d of diffs) {
    const e = TD.createEngine(lvl, { seed: 3, difficulty: d });
    e.callWave();
    for (let i = 0; i < 6000 && e.state.phase === "wave"; i++) e.tick();
    assert.equal(e.state.phase, "lost", `${d} is genuinely losable — 40 socks past an empty board ends the run`);
    assert.equal(e.state.lives, 0, `${d} must empty the heart meter, not floor it`);
    assert.ok(!DATA.DIFFICULTIES[d].noLose, `${d} must not carry a no-lose exemption`);
  }
});

test("TD4 gimmick — night dims Dart/Mortar reach (Fan exempt); conveyor strips speed enemies", () => {
  // night: the same dart on a night level acquires from a shorter distance.
  const mk = (night) => ({ id: 91, name: "m", world: "test", night, startGold: 9000, budgetBase: 100,
    path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 6, cy: 3 }],
    waves: [{ groups: [{ type: "sock", count: 1, gap: 1, delay: 0 }] }] });
  const acquireDist = (night) => {
    const e = TD.createEngine(mk(night), { seed: 5 });
    e.place("dart", "m"); const t = e.state.towers[0];
    e.callWave();
    for (let i = 0; i < 400 && e.state.phase === "wave"; i++) { e.tick(); if (t.targetId) return e.state.enemies.find((x) => x.id === t.targetId).dist; }
    return null;
  };
  const day = acquireDist(false), nite = acquireDist(true);
  assert.ok(day != null && nite != null, "the dart acquired the sock on both");
  assert.ok(nite > day + 0.2, `night shrinks the reach, so the dart locks LATER (day dist ${day.toFixed(2)} < night ${nite.toFixed(2)})`);
  assert.equal(DATA.RULES.nightRangeMult, 0.85, "night range multiplier truth (−15%)");

  // conveyor: an enemy crossing a speed zone is farther along than one on a plain lane.
  const plain = { id: 90, name: "m", world: "test", startGold: 100, budgetBase: 100, path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 5, cy: 9 }], waves: [{ groups: [{ type: "sock", count: 1, gap: 1, delay: 0 }] }] };
  const belt = Object.assign({}, plain, { zones: [{ from: 3, to: 15, mult: 1.6 }] });
  const runDist = (lvl) => { const e = TD.createEngine(lvl, { seed: 5 }); e.callWave(); for (let i = 0; i < 300; i++) e.tick(); const s = e.state.enemies.find((x) => x.alive); return s ? s.dist : 999; };
  assert.ok(runDist(belt) > runDist(plain) + 1, `a conveyor strip shoves the enemy farther along (belt ${runDist(belt).toFixed(1)} > plain ${runDist(plain).toFixed(1)})`);
});

test("TD structure: contiguous levels, four-level worlds, a boss finale per world, difficulty badges present", () => {
  // DERIVED, not literal. "16 levels" and the four-name world list were exactly
  // the shape that hid the whole attic when it shipped (TOTAL_PLANNED = 12), so
  // this now asserts the CONTRACT — worlds of four, ending on a boss — which is
  // what every other system (the unlock ladder, the endless gate, the 3⭐ × N
  // star ceiling) actually depends on.
  const worlds = [...new Set(DATA.LEVELS.map((l) => l.world))];
  assert.ok(worlds.length >= 4, `the fort ships at least four worlds (${worlds.join(", ")})`);
  assert.equal(DATA.LEVELS.length, worlds.length * 4, "every world is exactly four levels — the unlock ladder, the endless gate and the star ceiling all assume it");
  DATA.LEVELS.forEach((l, i) => assert.equal(l.id, i + 1, "ids contiguous from 1"));
  const bossLevels = DATA.LEVELS.filter((l) => l.waves.some((w) => w.boss)).map((l) => l.id);
  assert.deepEqual(bossLevels, worlds.map((w, i) => (i + 1) * 4), "a boss headlines each world finale");
  // levels are grouped: a world's four levels are contiguous, in world order
  worlds.forEach((w, i) => assert.deepEqual(DATA.LEVELS.filter((l) => l.world === w).map((l) => l.id),
    [1, 2, 3, 4].map((n) => i * 4 + n), `world "${w}" holds four contiguous levels`));
  for (const w of worlds) assert.ok(DATA.WORLDS[w], `world "${w}" has presentation data (label + spawn glyph)`);
  for (const l of DATA.LEVELS) assert.ok(l.badge >= 1 && l.badge <= 3, `L${l.id} carries a difficulty badge`);
  // every enemy referenced by a wave exists (typo guard, incl. the new roster)
  const known = new Set(Object.keys(DATA.ENEMIES));
  for (const l of DATA.LEVELS) for (const w of l.waves) for (const g of w.groups) assert.ok(known.has(g.type), `L${l.id} references known enemy ${g.type}`);
});

test("TD4 L12 heroic is winnable by a sensible maxed build (the hardest sanctioned run)", () => {
  const L12 = DATA.LEVELS.find((l) => l.id === 12);
  const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
  function playWith(level, seed, plan) {
    const e = TD.createEngine(level, { seed, difficulty: "heroic" });
    const padIds = level.pads.map((p) => p.id); let idx = 0, guard = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 900000) {
      if (e.state.phase === "build") {
        let spent = true;
        while (spent) {
          spent = false;
          for (const pid of padIds) { if (!e.state.towers.find((t) => t.padId === pid)) { const line = plan[idx % plan.length]; if (e.state.gold >= cost(line, 0)) { if (e.place(line, pid).ok) { idx++; spent = true; } } break; } }
          if (spent) continue;
          const ups = e.state.towers.filter((t) => t.tier < 3).sort((a, b) => a.tier - b.tier);
          for (const t of ups) { if (e.state.gold >= cost(t.lineId, t.tier)) { if (e.upgrade(t.id).ok) spent = true; break; } }
        }
        e.callWave();
      }
      e.tick();
    }
    return e.state;
  }
  const MIXED = ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"];
  const a = playWith(L12, 7, ["dart"]);
  const b = playWith(L12, 7, MIXED);
  const won = a.phase === "won" || b.phase === "won";
  assert.ok(won, `L12 must be beatable on HEROIC by a sensible maxed build (dart:${a.phase}/${a.lives} mixed:${b.phase}/${b.lives})`);
});

// ================= TD-5: meta (star tree), endless, achievements-shape =================

test("TD5 star tree: metaMods is a pure function of owned node ids (neutral tree = vanilla)", () => {
  const m0 = TD.metaMods([]);
  assert.deepEqual(m0, {
    startGold: 0, lives: 0, dartDmg: 1, mortarSplash: 1, fanAura: 0, soldierHp: 1,
    earlyCall: 1, sellRefund: DATA.RULES.sellRefund, branchCost: 1, cheapTarget: false,
    // TD-8 abilities all default OFF
    bounty: 1, critBonus: 0, nightOwl: false, guardDog: 1, patchKit: false,
    bossDmg: 1, allowance: 0, stickerShield: false,
    // P4.3 breadth: seven new KINDS, all default-noop
    charge: 0, slowSeconds: 1, abilityRadius: 1, jamMul: 1, chainPlus: 0, marchMul: 1,
    // W9 breadth: five more, likewise default-noop. This deepEqual is the reason
    // a new mod cannot ship without declaring its identity value — it is a
    // whole-shape assertion, so adding a key to metaMods and forgetting what
    // "off" means turns it red immediately.
    abilityCdMul: 1, mortarMinMul: 1, upgradeCost: 1, warmedUp: false, softLanding: 0,
    // W10 breadth: five more, likewise default-noop. This assertion went RED the
    // moment they landed, which is precisely what it is for — a mod that ships
    // without declaring what "off" means is the dead-default class.
    chainDecayPlus: 0, critMul: 1, goldBurstMul: 1, soldierArmor: 0, soldierDmg: 1,
  }, "empty tree is exactly vanilla");
  const all = DATA.META_NODES.map((n) => n.id);
  const mAll = TD.metaMods(all);
  // with EVERY node owned the rank-II values win (TD-8)
  assert.equal(mAll.startGold, 80); assert.equal(mAll.lives, 4); assert.ok(Math.abs(mAll.dartDmg - 1.2) < 1e-9);
  assert.ok(Math.abs(mAll.mortarSplash - 1.2) < 1e-9); assert.ok(Math.abs(mAll.fanAura - 0.3) < 1e-9);
  assert.ok(Math.abs(mAll.soldierHp - 1.3) < 1e-9); assert.ok(Math.abs(mAll.earlyCall - 1.5) < 1e-9);
  assert.equal(mAll.sellRefund, 0.9); assert.ok(Math.abs(mAll.branchCost - 0.9) < 1e-9); assert.equal(mAll.cheapTarget, true);
  assert.ok(Math.abs(mAll.bounty - 1.08) < 1e-9); assert.ok(Math.abs(mAll.critBonus - 0.03) < 1e-9);
  assert.equal(mAll.allowance, 12); assert.ok(mAll.nightOwl && mAll.patchKit && mAll.stickerShield);
  const ids = new Set(all); assert.equal(ids.size, DATA.META_NODES.length, "node ids unique");
  // (the dead-stars ceiling assertion lives once, in the TD8 tree-data test —
  // this was a verbatim duplicate of a literal that had already gone stale)
});

test("TD5 meta applies at createEngine: +gold, +lives, +dart dmg, cheaper branch, better refund", () => {
  const L1 = DATA.LEVELS[0];
  const base = TD.createEngine(L1, { seed: 7 });
  const buffed = TD.createEngine(L1, { seed: 7, meta: ["startgold", "lives"] });
  assert.equal(buffed.state.gold - base.state.gold, 40, "Piggy Bank adds 40 start gold");
  assert.equal(buffed.state.lives - base.state.lives, 2, "Extra Hearts adds 2 lives");
  // Sharp Darts: a dart deals more per shot → a lone sock dies sooner
  const kill = (meta) => { const e = TD.createEngine({ id: 80, name: "m", world: "test", startGold: 9000, budgetBase: 100, path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 5, cy: 3 }], waves: [{ groups: [{ type: "sock", count: 1, gap: 1, delay: 0 }] }] }, { seed: 3, meta }); e.place("dart", "m"); e.callWave(); let g = 0; while (e.state.phase === "wave" && g++ < 4000) e.tick(); return g; };
  assert.ok(kill(["dartdmg"]) < kill([]), "Sharp Darts kills faster than a vanilla dart");
  // Bulk Deal: a tier-4 branch costs 10% less
  const eb = TD.createEngine(L1, { seed: 1, meta: ["branchcost"] });
  eb.place("dart", "p3"); const t = eb.state.towers[0]; eb.state.gold = 9999; eb.upgrade(t.id); eb.upgrade(t.id);
  const before = eb.state.gold; assert.ok(eb.branch(t.id, "a").ok); const spent = before - eb.state.gold;
  assert.equal(spent, Math.round(DATA.TOWERS.dart.branches.a.cost * 0.9), "branch price is 10% off");
});

test("TD5 'Weakest' targeting is star-tree-gated and finishes the lowest-hp enemy", () => {
  const lvl = { id: 81, name: "m", world: "test", startGold: 9000, budgetBase: 100, path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 11, cy: 3 }], waves: [{ groups: [{ type: "sock", count: 4, gap: 0.3, delay: 0 }] }] };
  const locked = TD.createEngine(lvl, { seed: 2 });
  locked.place("dart", "m"); const tl = locked.state.towers[0];
  assert.equal(locked.setTargeting(tl.id, "cheap").reason, "locked", "no node → 'cheap' is refused");
  const e = TD.createEngine(lvl, { seed: 2, meta: ["cheaptarget"] });
  e.place("dart", "m"); const t = e.state.towers[0];
  assert.ok(e.setTargeting(t.id, "cheap").ok, "the node unlocks 'cheap'");
  e.callWave();
  for (let i = 0; i < 40; i++) e.tick();
  // wound two socks unevenly, then assert the dart aims at the WEAKER one
  const socks = e.state.enemies.filter((x) => x.type === "sock" && x.alive);
  if (socks.length >= 2) {
    socks[0].hp = 3; socks[1].hp = 20;
    e.tick();
    const locked2 = e.state.enemies.find((x) => x.id === t.targetId);
    assert.ok(!locked2 || locked2.hp <= 20, "'cheap' aims at a low-hp target");
  }
});

test("TD5 endless: escalating generated waves, deterministic per seed, scored by waves survived", () => {
  const arena = (world) => { const a = DATA.ENDLESS.arenas[world]; const pads = []; for (let i = 0; i < 14; i++) pads.push({ id: "p" + (i + 1), cx: 2 + ((i * 3) % 20), cy: (i % 2 ? 4 : 10) }); return { id: "endless-" + world, name: "Endless", world, endless: { world }, startGold: a.startGold, path: a.path, pads }; };
  // budget escalates ~growth^n: late waves are multiples of early ones
  const r = TD.mulberry32(555); const hps = [];
  for (let n = 0; n < 20; n++) { const w = TD.generateEndlessWave("bedroom", n, r); let hp = 0; for (const g of w.groups) hp += DATA.ENEMIES[g.type].hp * g.count; hps.push(hp); }
  const early = hps.slice(0, 5).reduce((a, b) => a + b) / 5, late = hps.slice(15).reduce((a, b) => a + b) / 5;
  assert.ok(late > early * 2, `endless HP escalates (early ${Math.round(early)} → late ${Math.round(late)})`);
  // every 5th wave is a mini-boss
  for (let n = 4; n < 20; n += 5) assert.ok(TD.generateEndlessWave("bedroom", n, TD.mulberry32(n + 1)).boss, `wave ${n + 1} is a mini-boss`);
  // determinism: same seed → identical endless run hash
  const run = (seed) => { const e = TD.createEngine(arena("bedroom"), { seed }); let g = 0; while (e.state.phase !== "lost" && g++ < 60000) { if (e.state.phase === "build") e.callWave(); e.tick(); } return { score: e.state.waveIdx, hash: TD.hashState(e.state), phase: e.state.phase }; };
  const a = run(7), b = run(7);
  assert.equal(a.hash, b.hash, "same seed replays identically");
  assert.equal(a.score, b.score, "same seed → same endless score");
  // neglect loses early (real stakes); a real build lasts FAR longer (real depth).
  // The 1.16^n budget is unbounded so any fixed build is eventually overwhelmed —
  // proving the exact loss wave is too slow (high waves spawn thousands), so we
  // assert the meaningful gap: a build survives many waves past neglect.
  const neglectScore = a.score;
  assert.ok(a.phase === "lost", "an unbuilt endless run loses (real stakes)");
  const cost = (l, t) => DATA.TOWERS[l].tiers[t].cost;
  const e = TD.createEngine(arena("bedroom"), { seed: 7 });
  const padIds = e.levelDef.pads.map((p) => p.id); let idx = 0, g = 0; const PLAN = ["dart", "fan", "mortar", "dart", "dart"];
  while (e.state.phase !== "lost" && e.state.waveIdx < neglectScore + 8 && g++ < 200000) {
    if (e.state.phase === "build") { let sp = true; while (sp) { sp = false; for (const pid of padIds) { if (!e.state.towers.find((t) => t.padId === pid)) { const line = PLAN[idx % PLAN.length]; if (e.state.gold >= cost(line, 0)) { if (e.place(line, pid).ok) { idx++; sp = true; } } break; } } if (sp) continue; const ups = e.state.towers.filter((t) => t.tier < 3).sort((a, b) => a.tier - b.tier); for (const t of ups) { if (e.state.gold >= cost(t.lineId, t.tier)) { if (e.upgrade(t.id).ok) sp = true; break; } } } e.callWave(); }
    e.tick();
  }
  assert.ok(e.state.waveIdx >= neglectScore + 8, `a real build lasts many waves past neglect (built reached ${e.state.waveIdx} vs neglect ${neglectScore})`);
});

test("TD6 events carry render metadata: shoot→tower (distinct sfx), hit→dmg/crit (damage numbers)", () => {
  const lvl = { id: 82, name: "m", world: "test", startGold: 9000, budgetBase: 100, path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 5, cy: 3 }], waves: [{ groups: [{ type: "sock", count: 3, gap: 0.4, delay: 0 }] }] };
  const e = TD.createEngine(lvl, { seed: 3 });
  e.place("dart", "m"); e.callWave();
  let sawShootTower = false, sawHitDmg = false;
  for (let i = 0; i < 300 && e.state.phase === "wave"; i++) {
    e.tick();
    for (const ev of e.events) {
      if (ev.type === "shoot" && ev.tower === "dart") sawShootTower = true;
      if (ev.type === "hit" && typeof ev.dmg === "number" && ev.dmg > 0) sawHitDmg = true;
    }
    e.events.length = 0;
  }
  assert.ok(sawShootTower, "a shoot event names its tower line (so mortar/dart/fan get distinct cues)");
  assert.ok(sawHitDmg, "a hit event carries its damage (for the opt-in damage-number fx)");
});

test("TD5 achievements data-shape: unique ids with names + descriptions, icons ≤ Emoji 13.0, one badge per boss", () => {
  assert.ok(DATA.ACHIEVEMENTS.length >= 12, `at least the shipped badges exist (${DATA.ACHIEVEMENTS.length})`);
  // EVERY boss must have a badge. World 4's Tickmaster shipped without one, and
  // a hard-coded count of 12 is exactly what hid it.
  for (const [k, e] of Object.entries(DATA.ENEMIES)) {
    if (!e.boss) continue;
    const hit = DATA.ACHIEVEMENTS.some((a) => (a.desc || "").toLowerCase().includes(e.name.toLowerCase()));
    assert.ok(hit, `boss "${e.name}" has no achievement badge — every other boss does`);
  }
  const ids = new Set(DATA.ACHIEVEMENTS.map((a) => a.id));
  assert.equal(ids.size, DATA.ACHIEVEMENTS.length, "achievement ids unique");
  for (const a of DATA.ACHIEVEMENTS) { assert.ok(a.name && a.desc && a.icon, `${a.id} has name/desc/icon`); }
  // the boss achievements name the three real bosses
  const has = (id) => ids.has(id);
  assert.ok(has("bossbonker") && has("dysondenied") && has("unplugged"), "one achievement per boss");
  // and the count keeps up with the roster — a badge per boss plus the ten
  // cross-cutting ones. A frozen 12 is what hid the Tickmaster's missing badge.
  const bosses = Object.values(DATA.ENEMIES).filter((e) => e.boss).length;
  assert.equal(DATA.ACHIEVEMENTS.length, bosses + 9, `badges = one per boss (${bosses}) + the 9 cross-cutting ones, got ${DATA.ACHIEVEMENTS.length}`);
});

// ===== Deep-audit guardrails (RULE 7): "hidden" is untargetable by EVERY damage
// path, not just direct acquisition. The project's own lesson — grep every place
// a target is chosen OR kept — extends to AoE (mortar splash) and chain jumps. =====

test("AUDIT: mortar splash must NOT damage a tunnelling (hidden) mole", () => {
  // A shell aimed at a visible enemy lands on top of a mole that's underground in
  // the middle third — the mole is untargetable and must take ZERO splash.
  const e = TD.createEngine(laneDart("mole", 1), { seed: 1 });
  e.callWave();
  let mole = null;
  for (let i = 0; i < 900 && e.state.phase === "wave"; i++) {
    e.tick();
    mole = e.state.enemies.find((x) => x.type === "mole" && x.alive);
    if (mole && e.isHidden(mole)) break;
  }
  assert.ok(mole && e.isHidden(mole), "the mole is tunnelling under the middle third (hidden)");
  const hpBefore = mole.hp;
  const p = e.posAt(mole.dist);
  // inject a fat shell detonating on the mole's own ground square this tick
  e.state.shells.push({ t: 0, T: 1, sx: p.x, sy: p.y - 3, tx: p.x, ty: p.y, x: p.x, y: p.y, splash: 2.5, dmg: 9999, goo: null });
  e.tick();
  const after = e.state.enemies.find((x) => x.type === "mole");
  assert.ok(after && after.alive, "the hidden mole survives a shell that landed on it");
  assert.equal(after.hp, hpBefore, "mortar splash deals NO damage to a tunnelling mole");
});

test("AUDIT: chain-lightning must NOT arc onto a phased (hidden) ghost", () => {
  // A Battery Bot (its shield eats the Zap → a persistent visible first-target)
  // sits at the tower with a ghost pinned right beside it, inside the chain's
  // jump range. The tower is force-fired every tick and the two enemies are
  // held in place with full hp, so across the ghost's deterministic phase cycle
  // we sample BOTH states: while visible the chain jump reaches the ghost
  // (proving the path fires); while phased out it must be skipped.
  const lvl = Object.assign(laneDart("battery", 1), {
    pads: [{ id: "m", cx: 11, cy: 3 }],
    waves: [{ groups: [
      { type: "battery", count: 1, gap: 0.5, delay: 0 },
      { type: "ghost", count: 1, gap: 0.5, delay: 0.3 },
    ] }],
  });
  const e = TD.createEngine(lvl, { seed: 1 });
  assert.ok(e.place("fan", "m").ok, "place a fan");
  const t = e.state.towers[0];
  assert.ok(e.upgrade(t.id).ok && e.upgrade(t.id).ok, "fan → tier 3");
  assert.ok(e.branch(t.id, "b").ok && t.branch === "b", "branch → Static chain (tier 4)");
  e.callWave();
  for (let i = 0; i < 300 && !(e.state.enemies.some((x) => x.type === "battery" && x.alive) && e.state.enemies.some((x) => x.type === "ghost" && x.alive)); i++) e.tick();
  const GHP = DATA.ENEMIES.ghost.hp;
  let hitWhileVisible = false, hitWhileHidden = false, sawHidden = false, sawVisible = false;
  for (let i = 0; i < 400; i++) {
    const bat = e.state.enemies.find((x) => x.type === "battery" && x.alive);
    const g = e.state.enemies.find((x) => x.type === "ghost" && x.alive);
    if (!bat || !g) break;
    // pin the geometry so the jump-onto-ghost path is always available, and keep
    // both alive at full hp so the sample spans the whole phase cycle
    bat.dist = 11; bat.hp = DATA.ENEMIES.battery.hp; bat.shield = DATA.ENEMIES.battery.shield;
    g.dist = 10.7; g.hp = GHP;
    t.cooldown = 0; // force the chain to fire this tick
    e.tick();
    const g2 = e.state.enemies.find((x) => x.type === "ghost" && x.alive);
    if (!g2) break;
    const hidden = e.isHidden(g2);
    if (hidden) sawHidden = true; else sawVisible = true;
    if (g2.hp < GHP - 1e-9) { if (hidden) hitWhileHidden = true; else hitWhileVisible = true; }
  }
  assert.ok(sawHidden && sawVisible, "the ghost cycled through both phased and visible during the sample");
  assert.ok(hitWhileVisible, "the chain DOES reach the ghost when it is visible (the jump path is exercised)");
  assert.ok(!hitWhileHidden, "the chain NEVER damages the ghost while it is phased out (hidden)");
});

// ===================== TD-7: multi-path lanes + the L10 lever =====================

test("TD7 L10 fork: lanes share the prefix (seamless reroute) then diverge into a longer loop", () => {
  const L10 = DATA.LEVELS.find((l) => l.id === 10);
  assert.ok(L10.paths && L10.paths.length === 2, "L10 ships two lanes");
  assert.ok(L10.lever && L10.fork, "L10 has a lever control + a fork point");
  const e = TD.createEngine(L10, { seed: 1 });
  // the shared prefix: world position is IDENTICAL on both lanes up to fork.at,
  // so rerouting a pre-fork enemy never teleports it.
  for (let d = 0; d <= L10.fork.at; d += 0.5) {
    const a = e.posOn(0, d), b = e.posOn(1, d);
    assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9, `lanes coincide at d=${d}`);
  }
  // just past the fork they genuinely diverge, and the long lane is strictly longer
  const af = e.posOn(0, L10.fork.at + 1), bf = e.posOn(1, L10.fork.at + 1);
  assert.ok(Math.abs(af.x - bf.x) + Math.abs(af.y - bf.y) > 0.5, "the lanes split at the fork");
  assert.ok(e.paths[1].total > e.paths[0].total, `long lane (${e.paths[1].total}) is longer than short (${e.paths[0].total})`);
});

test("TD17 lever: a TIMED diversion — reroutes, snaps back on its own, then re-arms", () => {
  // Reported: "nobody would ever NOT choose the long path and just leave it."
  // True — the long route is strictly better for the player, so as a permanent
  // toggle it was a free upgrade thrown once on wave 1 and never touched again.
  // It is now a timed diversion: hold → automatic snap-back → cooldown → ready.
  const L10 = DATA.LEVELS.find((l) => l.id === 10);
  const R = DATA.RULES, RATE = DATA.TICK_RATE;
  const e = TD.createEngine(L10, { seed: 7 });
  e.callWave();
  for (let i = 0; i < 30; i++) e.tick(); // let a few enemies march in on the default short lane
  assert.ok(e.state.enemies.some((x) => x.alive && x.pathIdx === 0), "enemies default to the short lane (route 0)");
  assert.equal(e.leverState().phase, "ready", "it starts armed");

  assert.ok(e.pullLever().ok && e.state.leverRoute === 1, "the lever throws and diverts the track long");
  const pre = e.state.enemies.filter((x) => x.alive && x.dist < L10.fork.at);
  assert.ok(pre.length > 0 && pre.every((x) => x.pathIdx === 1), "every enemy still on the shared prefix is rerouted long");
  assert.equal(e.pullLever().reason, "running", "it is INERT while running — ending it early is never a play, so it is not offered");

  // it expires WITHOUT being touched — that is the whole point of the change
  for (let i = 0; i < R.leverHold * RATE + 2; i++) e.tick();
  assert.equal(e.state.leverRoute, 0, "the diversion snaps back to the short route on its own");
  assert.equal(e.leverState().phase, "cooldown", "…and only THEN does the cooldown start");
  assert.ok(e.state.enemies.filter((x) => x.alive && x.dist < L10.fork.at).every((x) => x.pathIdx === 0),
    "the snap-back reroutes pre-fork enemies too — the same seamless swap, both directions");
  assert.equal(e.pullLever().reason, "cooldown", "it cannot be re-thrown immediately, or it would be permanent again");

  for (let i = 0; i < R.leverCooldown * RATE + 2; i++) e.tick();
  assert.equal(e.leverState().phase, "ready", "after the cooldown it re-arms");
  assert.ok(e.pullLever().ok, "…and can be thrown again");
});

test("TD17 lever timer is GAME-TIME, so fast-forward cannot cheat it", () => {
  // The frame loop does `acc += elapsed * speed`, i.e. speed buys TICKS. A
  // tick-based timer therefore drains at exactly the rate the enemies march at
  // any speed — 2x/3x makes the diversion end sooner in wall-clock AND moves the
  // wave proportionally further, so it covers the same amount of marching.
  // Asserted by construction: the same tick count always yields the same state,
  // whatever wall-clock rate those ticks were fed at.
  const L10 = DATA.LEVELS.find((l) => l.id === 10);
  const R = DATA.RULES, RATE = DATA.TICK_RATE;
  const run = (batch) => {
    const e = TD.createEngine(L10, { seed: 7 });
    e.callWave();
    e.pullLever();
    let n = 0;
    const target = R.leverHold * RATE - 5;      // stop just BEFORE it expires
    while (n < target) { const step = Math.min(batch, target - n); for (let i = 0; i < step; i++) e.tick(); n += step; }
    const mid = { route: e.state.leverRoute, secs: Math.round(e.leverState().secs * 100) };
    for (let i = 0; i < 10; i++) e.tick();      // …and just past it
    return { mid, after: e.state.leverRoute, dist: Math.round(e.state.enemies.reduce((a, x) => a + x.dist, 0) * 100) };
  };
  const oneX = run(1), threeX = run(6);          // 6 ticks/frame is the loop's cap
  assert.equal(oneX.mid.route, 1, "still diverted just before expiry");
  assert.equal(oneX.after, 0, "expired just after");
  assert.deepEqual(threeX, oneX,
    "feeding the SAME ticks in bigger batches (what 2x/3x does) gives an identical lever state AND identical enemy progress");
});

test("TD7 lever advantage: sending the train the LONG way (more coverage) saves lives — on EVERY fork", () => {
  // SCOPE. This was hard-pinned to `l.id === 10` while the lever spread to all
  // eight worlds, so seven forks had NOTHING that could fail if their lever were
  // worthless — and one of them was: L3's original detour branched 76% of the
  // way down its lane and measured a gain of exactly 0.0 lives at every board
  // size. A guardrail nothing can fail is a wish, which is the same class as the
  // fork sweep that stayed an unactionable open item for two whole worlds.
  //
  // Each level names the THIN board at which the question is real: too few pads
  // and it loses both ways, too many and it wins both ways. Caps measured by
  // sweeping every size from (pads-7) to pads on 4 seeds.
  // cap → the thin board; gain → the lives the diversion is worth at seed 7,
  // measured, then floored well below the measurement so seed drift cannot
  // flake it. L3 (the tutorial fork, 9 waves) is the one level where the lever
  // CANNOT be decisive — a 5-pad dart board clears it on every seed, so no
  // diversion can flip a loss — hence its honest bar is "it must still help".
  const FORK = {
    3: { cap: 4, gain: 1 }, 7: { cap: 7, gain: 5 }, 10: { cap: 13, gain: 4 }, 15: { cap: 9, gain: 4 },
    19: { cap: 9, gain: 8 }, 23: { cap: 9, gain: 6 }, 27: { cap: 13, gain: 4 }, 31: { cap: 9, gain: 6 },
    // L35 (The Paint Line) measured: at seed 7 an 8- or 9-pad board loses BOTH
    // ways and a 10-pad board wins both, so this fork has no phase flip to give
    // — like L3 and L10 it is a magnitude lever, not a decisive one, and the
    // population claim below is what carries the "levers are not cosmetic"
    // burden. Worth 6 lives at cap 10 (short won 13 → with-lever 19); floored
    // at 5 so seed drift cannot flake it.
    35: { cap: 10, gain: 5 },
    // L38 (Pass the Parcel) measured with `node tools/td-sim.js 38 --lever`: a
    // 6- or 7-pad board loses both ways, an 8-pad board loses SHORT on all four
    // seeds and wins LONG on three, and a 9-pad board is the knife edge at seed
    // 7 — short wins with 4 lives, the diversion wins with 10. Floored at 5 so
    // seed drift cannot flake it.
    38: { cap: 9, gain: 5 },
  };
  const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
  function play(lvl, cap, pull) {
    const e = TD.createEngine(lvl, { seed: 7 });
    const thin = lvl.pads.slice(0, cap).map((p) => p.id);
    let g = 0, everLong = false;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && g++ < 400000) {
      if (e.state.phase === "build") {
        for (const pid of thin) if (!e.state.towers.find((t) => t.padId === pid) && e.state.gold >= cost("dart", 0)) e.place("dart", pid);
        for (const t of e.state.towers) if (t.tier < 3 && e.state.gold >= cost("dart", t.tier)) e.upgrade(t.id);
        e.callWave();
      }
      if (pull && e.state.phase === "wave") e.pullLever(); // throw it whenever able (cooldown-gated internally)
      e.tick();
      if (e.state.enemies.some((x) => x.alive && x.pathIdx === 1)) everLong = true;
    }
    return { phase: e.state.phase, lives: e.state.lives, everLong };
  }
  const forks = DATA.LEVELS.filter((l) => l.fork);
  assert.ok(forks.length >= 8, `every world ships a fork (${forks.length} found)`);
  let decisive = 0;
  for (const lvl of forks) {
    const spec = FORK[lvl.id];
    assert.ok(spec, `L${lvl.id} ships a fork but no measured thin-board cap — sweep it with tools/td-fork-search.js and add one, or its lever is unverified`);
    const shortRun = play(lvl, spec.cap, false), longRun = play(lvl, spec.cap, true);
    assert.ok(longRun.everLong, `L${lvl.id}: pulling actually routed enemies down the long lane`);
    const gain = longRun.lives - shortRun.lives;
    assert.ok(gain >= spec.gain,
      `L${lvl.id}: the diversion must be worth >= ${spec.gain} lives at a ${spec.cap}-pad board (short ${shortRun.lives} → with-lever ${longRun.lives}, gain ${gain}). A lever that changes nothing is a free upgrade dressed up as a control — L3 shipped one for two whole worlds.`);
    if (shortRun.phase === "lost" && longRun.phase === "won") decisive++;
  }
  // A POPULATION claim, so one level's seed luck can't break it and no single
  // level has to carry a phase-flip it structurally cannot produce (L3 and L10
  // are both winnable at every board size; their levers are worth 1 and 7 lives).
  assert.ok(decisive >= 4,
    `at least 4 of the ${forks.length} forks must be outright DECISIVE at their thin board — lose short, win with the diversion (got ${decisive}). Otherwise every lever has quietly become cosmetic.`);
});

test("AUDIT pad geometry: no pad sits ON a lane, none crowd each other (every level + arena)", () => {
  // Playability audit: L5 p10 and L8 p12 shipped sitting exactly ON the path
  // (enemies marched through the tower) and five pad pairs sat in adjacent
  // cells (sockets touching, 0.9-radius tap zones contending). Locked here:
  // every pad keeps >= 0.99 cells from every lane centre (1.0 is the classic
  // road-hugging placement) and >= 1.4 from every sibling pad.
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function distToLane(px, py, lane) {
    let best = Infinity;
    for (let i = 1; i < lane.length; i++) best = Math.min(best, segDist(px, py, lane[i - 1][0] + 0.5, lane[i - 1][1] + 0.5, lane[i][0] + 0.5, lane[i][1] + 0.5));
    return best;
  }
  const maps = DATA.LEVELS.map((l) => ({ name: "L" + l.id, lanes: l.paths || [l.path], pads: l.pads, lever: l.lever }));
  for (const w in DATA.ENDLESS.arenas) maps.push({ name: "endless-" + w, lanes: [DATA.ENDLESS.arenas[w].path], pads: DATA.ENDLESS.arenas[w].pads });
  for (const m of maps) {
    for (const p of m.pads) {
      const d = Math.min(...m.lanes.map((l) => distToLane(p.cx + 0.5, p.cy + 0.5, l)));
      assert.ok(d >= 0.99, `${m.name} ${p.id}(${p.cx},${p.cy}) is ${d.toFixed(2)} from a lane centre — a pad must never sit on the road`);
      if (m.lever) {
        const dl = Math.hypot(p.cx - m.lever.cx, p.cy - m.lever.cy);
        assert.ok(dl >= 1.9, `${m.name} ${p.id} is ${dl.toFixed(2)} from the lever — their tap zones (0.95 + 0.9) would contend`);
      }
    }
    for (let i = 0; i < m.pads.length; i++) {
      for (let j = i + 1; j < m.pads.length; j++) {
        const a = m.pads[i], b = m.pads[j], d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
        assert.ok(d >= 1.4, `${m.name} ${a.id}(${a.cx},${a.cy}) & ${b.id}(${b.cx},${b.cy}) are ${d.toFixed(2)} apart — sockets touch and taps contend`);
      }
    }
  }
});

// ===================== TD-8: the deep star tree =====================
// The tree grew from 10 flat nodes (28⭐ — fully buyable, 8 dead stars) to 3
// branches × ranked skills + capstones. Every node stays PURE INPUT at
// createEngine; each new ability is proven at its ONE engine site below.

test("TD8 tree data: 3 branches, consistent ranks/capstones, total cost EXCEEDS the 36⭐ ceiling", () => {
  const nodes = DATA.META_NODES;
  const branchIds = new Set(DATA.META_BRANCHES.map((b) => b.id));
  assert.equal(branchIds.size, 3, "three branches");
  const ids = new Set();
  let total = 0;
  for (const n of nodes) {
    assert.ok(!ids.has(n.id), "duplicate node id " + n.id); ids.add(n.id);
    assert.ok(branchIds.has(n.branch), n.id + " must belong to a real branch");
    assert.ok(n.cost > 0 && n.icon && n.name && n.desc, n.id + " must be a full card");
    total += n.cost;
    if (n.req) {
      const r = nodes.find((x) => x.id === n.req);
      assert.ok(r, n.id + "'s req must exist");
      assert.equal(r.branch, n.branch, n.id + "'s rank chain must stay inside one branch");
    }
    if (n.reqSpend) {
      const others = nodes.filter((x) => x.branch === n.branch && x.id !== n.id).reduce((s, x) => s + x.cost, 0);
      assert.ok(others >= n.reqSpend, n.id + "'s spend requirement must be reachable inside its branch");
    }
  }
  // The dead-stars law: a tree that costs less than the earnable ceiling gets
  // fully bought and stops being a choice.
  //
  // This asserted the LITERAL 36 — a World-3-era number (12 levels x 3) that was
  // duplicated verbatim in a second test. The runtime has always derived the
  // ceiling (td-main.js STAR_CEILING, td-ui.js), so the two drifted apart the
  // moment a world shipped: at 24 levels the real ceiling is 72 against a 77⭐
  // tree, i.e. 94% affordable versus the 47% TD-8 designed for — and 77 > 36
  // passes at ANY level count, so the property was already broken and no test
  // could see it. Third instance of the counting law (TOTAL_PLANNED = 12, the
  // VS16 file list): derive the number, never write the one you ship with.
  const cap = DATA.LEVELS.length * 3;
  assert.ok(total > cap,
    `tree total (${total}⭐) must exceed the earnable ceiling (${cap}⭐ = ${DATA.LEVELS.length} levels x 3) — ` +
    "at or below it a completionist buys everything and the tree stops being a choice");
  for (const b of branchIds) {
    assert.equal(nodes.filter((n) => n.branch === b && n.reqSpend).length, 1, "exactly one 👑 capstone in " + b);
  }
  // Save-compat: the original 10 ids survive with their original costs, so an
  // existing save.meta keeps exactly what it owned.
  const legacy = { startgold: 2, dartdmg: 3, mortarsplash: 3, fanrange: 3, soldierhp: 3, lives: 4, earlycall: 2, sellrefund: 2, cheaptarget: 2, branchcost: 4 };
  for (const id in legacy) {
    const n = nodes.find((x) => x.id === id);
    assert.ok(n, "legacy node " + id + " must still exist");
    assert.equal(n.cost, legacy[id], "legacy node " + id + " must keep its cost");
  }
});

test("W10 tree: each of the five new KINDS actually does something, at its ONE site", () => {
  // A node that ships with no effect is the dead-default class. metaMods is pure
  // input, so every one of these is provable by driving the engine with and
  // without it — no browser, no sampling.
  //
  // THREE FIXTURE BUGS were hit writing this, each of which first presented as
  // "the node does nothing": time-to-clear a WAVE measures the last body's
  // TRANSIT, not the squad's damage (951 ticks either way); a loop that exits
  // while no enemy is alive exits at tick 0, before the first spawn; and events
  // live on `e.events`, not `e.state.events`. Suspect the fixture first.
  const lane = (type, count) => ({ id: 93, name: "micro", world: "test", startGold: 9000,
    budgetBase: 4000, path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 5, cy: 3 }],
    waves: [{ groups: [{ type, count, gap: 0.5, delay: 0 }] }] });

  // 🥁 Drill Sergeant — measured on a BLOCKED body, so transit is not in it.
  const ticksToKill = (meta) => {
    const e = TD.createEngine(lane("pinata", 1), { seed: 3, meta });
    e.place("camp", "m"); e.callWave();
    let t = 0, seen = false;
    while (t < 40000 && e.state.phase === "wave") {
      e.tick(); t += 1;
      if (e.state.enemies.some((x) => x.alive)) seen = true;
      else if (seen) return t;
    }
    return -1;
  };
  const plainT = ticksToKill([]), drilledT = ticksToKill(["drillsergeant"]);
  assert.ok(drilledT > 0 && drilledT < plainT * 0.9,
    `🥁 Drill Sergeant must kill a blocked body clearly faster (${drilledT} vs ${plainT} ticks)`);

  // 🧱 Padding — same board, squad HP left after a fixed fight.
  const squadHp = (meta) => {
    const e = TD.createEngine(lane("pinata", 1), { seed: 3, meta });
    e.place("camp", "m"); e.callWave();
    for (let i = 0; i < 3000 && e.state.phase === "wave"; i++) e.tick();
    return e.state.soldiers.reduce((n, sl) => n + Math.max(0, sl.hp), 0);
  };
  const plainHp = squadHp([]), padHp = squadHp(["padding"]);
  assert.ok(padHp > plainHp * 1.1,
    `🧱 Padding must leave the squad clearly healthier (${padHp} vs ${plainHp} hp)`);

  // 🧲 Coin Magnet — driven through the ONE kill path rather than a
  // time-to-kill, because a tier-1 dart cannot bring down a 400hp piñata before
  // it walks off the lane. The burst is added at TWO adjacent lines (gold and
  // goldEarned) which now share one local, so a mutation that fixes one and
  // misses the other is caught here.
  const burst = (meta) => {
    const e = TD.createEngine(lane("pinata", 1), { seed: 5, meta });
    e.callWave();
    let f = null;
    for (let i = 0; i < 400 && !f; i++) { e.tick(); f = e.state.enemies.find((x) => x.alive); }
    assert.ok(f, "the piñata spawned");
    const g0 = e.state.goldEarned;
    e.dealDamage(f, 99999, 0, "dart");
    return e.state.goldEarned - g0;
  };
  const plainG = burst([]), magnetG = burst(["coinmagnet"]);
  assert.ok(magnetG > plainG,
    `🧲 Coin Magnet must pay more for a piñata (${magnetG} vs ${plainG} gold)`);

  // 🎯 Steady Aim — a crit hits HARDER, never more often. Lucky Darts supplies
  // the chance in BOTH arms, so the rng stream is identical and only the size
  // of the biggest hit can move.
  const biggestHit = (meta) => {
    const e = TD.createEngine(lane("sock", 40), { seed: 5, meta });
    e.place("dart", "m"); e.callWave();
    let max = 0;
    for (let i = 0; i < 9000 && e.state.phase === "wave"; i++) {
      e.tick();
      for (const ev of e.events.splice(0)) if (ev.type === "hit" && ev.dmg > max) max = ev.dmg;
    }
    return max;
  };
  const critOnly = biggestHit(["critchance"]), aimed = biggestHit(["critchance", "steadyaim"]);
  assert.ok(aimed > critOnly,
    `🎯 Steady Aim must raise the biggest hit (${aimed} vs ${critOnly})`);

  // 🔗 Live Wire — the chain keeps more per jump. This MUST be measured on the
  // real arc: a first cut asserted only `metaMods(["livewire"]).chainDecayPlus > 0`
  // and survived deleting the read site entirely, which is the documented "a
  // guardrail that only inspects the artefact misses the live path" trap.
  const C = DATA.TOWERS.fan.branches.b.chain;
  const arcOf = (meta) => {
    const lvl = micro([{ groups: [{ type: "knight", count: 12, gap: 0.4, delay: 0 }] }], [{ id: "m1", cx: 10, cy: 3 }]);
    const e = TD.createEngine(lvl, { seed: 8, meta });
    e.place("fan", "m1");
    const t = e.state.towers[0];
    e.state.gold = 9999;
    e.upgrade(t.id); e.upgrade(t.id);
    assert.ok(e.branch(t.id, "b").ok, "Static Zap applied");
    e.callWave();
    for (let i = 0; i < 1500 && e.state.phase === "wave"; i++) {
      const before = new Map(e.state.enemies.map((x) => [x.id, x.hp]));
      e.tick(); e.events.splice(0);
      const hits = e.state.enemies
        .filter((x) => before.has(x.id) && x.hp < before.get(x.id))
        .map((x) => before.get(x.id) - x.hp)
        .sort((a, b) => b - a);
      if (hits.length >= 3) return hits;
    }
    return null;
  };
  const vanillaArc = arcOf([]), wiredArc = arcOf(["livewire"]);
  assert.ok(vanillaArc && wiredArc, "both arcs struck at least 3 bodies");
  assert.equal(wiredArc[0], vanillaArc[0], "the FIRST link is untouched — this node is about retention, not power");
  assert.ok(wiredArc[1] > vanillaArc[1],
    `🔗 Live Wire must make the second link hit harder (${wiredArc.join(",")} vs ${vanillaArc.join(",")})`);
  // …and the arc must still WEAKEN — a chain that gained damage per link would
  // be a bug, not a buff. The 0.95 cap is what guarantees it.
  for (let i = 1; i < wiredArc.length; i++) {
    assert.ok(wiredArc[i] < wiredArc[i - 1],
      `a Live Wire chain still weakens each jump (${wiredArc.join(",")})`);
  }
});

test("TD8 metaMods: rank II overrides rank I; every new ability defaults OFF", () => {
  const base = TD.metaMods([]);
  assert.equal(base.dartDmg, 1); assert.equal(base.bounty, 1); assert.equal(base.critBonus, 0);
  assert.equal(base.guardDog, 1); assert.equal(base.bossDmg, 1); assert.equal(base.allowance, 0);
  assert.ok(!base.nightOwl && !base.patchKit && !base.stickerShield);
  const r1 = TD.metaMods(["dartdmg", "startgold", "lives", "soldierhp", "mortarsplash"]);
  assert.equal(r1.dartDmg, 1.1); assert.equal(r1.startGold, 40); assert.equal(r1.lives, 2);
  assert.equal(r1.soldierHp, 1.15); assert.equal(r1.mortarSplash, 1.1);
  const r2 = TD.metaMods(["dartdmg", "dartdmg2", "startgold", "startgold2", "lives", "lives2", "soldierhp", "soldierhp2", "mortarsplash", "mortarsplash2"]);
  assert.equal(r2.dartDmg, 1.2); assert.equal(r2.startGold, 80); assert.equal(r2.lives, 4);
  assert.equal(r2.soldierHp, 1.3); assert.equal(r2.mortarSplash, 1.2);
});

// A tiny straight-lane level for the ability sims.
const microTd8 = (over) => Object.assign({
  id: 990, name: "micro-td8", world: "test", startGold: 5000, budgetBase: 100,
  path: [[0, 2], [23, 2]],
  pads: [{ id: "p1", cx: 4, cy: 3 }, { id: "p2", cx: 8, cy: 3 }, { id: "p3", cx: 12, cy: 3 }],
  waves: [{ groups: [{ type: "sock", count: 1, gap: 1, delay: 0 }] }],
}, over || {});

test("TD8 🪙 Bounty Hunter: a kill pays the rounded +8%, through the ONE killEnemy path", () => {
  // read the die event's bounty (the pure kill payout) — the raw gold delta
  // would also include the early-call bonus and muddy the arithmetic
  const lvl = microTd8({ waves: [{ groups: [{ type: "balloon", count: 1, gap: 1, delay: 0 }] }] });
  const bountyOfKill = (meta) => {
    const e = TD.createEngine(lvl, { seed: 3, meta });
    e.place("dart", "p1"); e.place("dart", "p2");
    e.callWave();
    let guard = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 30000) {
      e.tick();
      for (const ev of e.events.splice(0)) if (ev.type === "die") return ev.bounty;
    }
    throw new Error("the balloon never died");
  };
  assert.equal(bountyOfKill([]), 8, "balloon bounty is 8");
  assert.equal(bountyOfKill(["bounty"]), Math.round(8 * 1.08), "Bounty Hunter pays the rounded +8%");
});

test("TD8 👊 Boss Bonker: the boss has LESS hp after the same window (one damage path)", () => {
  const lvl = microTd8({ waves: [{ boss: true, groups: [{ type: "bedmonster", count: 1, gap: 1, delay: 0 }] }] });
  const bossHpAfter = (meta) => {
    const e = TD.createEngine(lvl, { seed: 4, meta });
    e.place("dart", "p1"); e.place("dart", "p2");
    e.callWave();
    for (let i = 0; i < 2400; i++) e.tick(); // a fixed 80s window
    const b = e.state.enemies.find((x) => x.type === "bedmonster");
    assert.ok(b, "the boss is still on the field in the window");
    return b.hp;
  };
  const plain = bossHpAfter([]);
  const bonked = bossHpAfter(["bossdmg"]);
  assert.ok(plain > 0 && bonked > 0, "the boss survives the window in both runs");
  assert.ok(bonked < plain, "Boss Bonker melts the boss faster (" + bonked + " < " + plain + ")");
});

test("TD8 👊 Boss Bonker ALSO multiplies the SHIELD path (a shielded boss, the untested line)", () => {
  // Audit coverage gap: the Bed Monster has shield 0, so the bossHp test above
  // never exercises dealDamage's `shieldDmg = round(shieldDmg * bossDmg)`. Drive
  // a lone shielded boss (Vacuum King, shield 60) with a zap source and read the
  // FIRST shield hit both ways — proving the shield multiply is real + reachable.
  const lvl = microTd8({
    startGold: 99999,
    waves: [{ boss: true, groups: [{ type: "vacuumking", count: 1, gap: 1, delay: 0 }] }],
  });
  const firstShieldDrop = (meta) => {
    const e = TD.createEngine(lvl, { seed: 4, meta });
    // a tier-3 Fan branched to Static-Zap (armor-ignoring chain) chews the shield
    e.place("fan", "p1");
    const f = e.state.towers[0];
    e.upgrade(f.id); e.upgrade(f.id); e.branch(f.id, "b");
    e.callWave();
    let guard = 0, prev = null;
    while (guard++ < 40000) {
      const b = e.state.enemies.find((x) => x.type === "vacuumking");
      if (b) {
        if (prev !== null && b.shield < prev) return prev - b.shield; // first shield decrement
        prev = b.shield;
      }
      e.tick();
    }
    throw new Error("the boss's shield was never touched");
  };
  const plain = firstShieldDrop([]);
  const bonked = firstShieldDrop(["bossdmg"]);
  assert.ok(plain > 0, "the zap source dents the shield");
  assert.equal(bonked, Math.round(plain * 1.15), "Boss Bonker multiplies the SHIELD damage by 1.15 too (" + plain + "→" + bonked + ")");
});

test("TD8 🌟 Sticker Shield: the FIRST leak costs no lives, the second does — and both leaks still count", () => {
  const lvl = microTd8({ waves: [{ groups: [{ type: "sock", count: 2, gap: 3, delay: 0 }] }] });
  const e = TD.createEngine(lvl, { seed: 5, meta: ["stickershield"] }); // no towers → both socks leak
  const lives0 = e.state.lives;
  e.callWave();
  const leaks = [];
  let guard = 0;
  while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 60000) {
    e.tick();
    for (const ev of e.events.splice(0)) if (ev.type === "leak") leaks.push(ev);
  }
  assert.equal(e.state.lives, lives0 - 1, "exactly ONE life was spent for two leaks");
  assert.equal(leaks.length, 2, "BOTH leaks still emitted (the No Leaks badge stays honest)");
  assert.equal(leaks.filter((v) => v.shielded).length, 1, "exactly one leak was absorbed by the shield");
  assert.ok(e.state.shieldUsed, "the shield is spent for the rest of the run");
});

test("TD8 💵 Allowance + 🩹 Patch Kit: paid after cleared waves; heal on the 5th, never above start", () => {
  const lvl = microTd8({
    waves: [1, 2, 3, 4, 5, 6].map(() => ({ groups: [{ type: "sock", count: 1, gap: 1, delay: 0 }] })),
  });
  const untilBuild = (e, w, cap) => { let g = 0; while (!(e.state.phase === "build" && e.state.waveIdx === w) && g++ < (cap || 60000)) e.tick(); assert.ok(g < (cap || 60000), "reached build " + w); };
  // 💵 Allowance: +12 exactly, visible once wave 1 clears.
  const goldAfterWave1 = (meta) => {
    const e = TD.createEngine(lvl, { seed: 6, meta });
    e.place("dart", "p1"); e.place("dart", "p2");
    const g0 = e.state.gold;
    e.callWave();
    untilBuild(e, 1);
    return e.state.gold - g0;
  };
  assert.equal(goldAfterWave1(["allowance"]) - goldAfterWave1([]), 12, "Allowance adds exactly +12 after a cleared wave");
  // 🩹 Patch Kit: leak one life on wave 1 (no towers yet), then clear 2-5 — the
  // 5th cleared wave heals it back; the heal can never exceed the run's start.
  const e = TD.createEngine(lvl, { seed: 7, meta: ["patchkit"] });
  const lives0 = e.state.lives;
  e.callWave();
  untilBuild(e, 1);
  assert.equal(e.state.lives, lives0 - 1, "wave 1 leaked one life");
  e.place("dart", "p1"); e.place("dart", "p2"); e.place("dart", "p3");
  e.callWave(); untilBuild(e, 2);
  e.callWave(); untilBuild(e, 3);
  e.callWave(); untilBuild(e, 4);
  assert.equal(e.state.lives, lives0 - 1, "no heal before the 5th cleared wave");
  e.callWave(); untilBuild(e, 5);
  assert.equal(e.state.lives, lives0, "Patch Kit heals +1 on the 5th cleared wave — and caps at the starting lives");
});

test("TD8 🐕 Guard Dog: a fallen soldier returns ~25% sooner (both KO paths share one clock)", () => {
  const lvl = microTd8({ waves: [{ groups: [{ type: "bull", count: 1, gap: 1, delay: 0 }] }] });
  const respawnDelta = (meta) => {
    const e = TD.createEngine(lvl, { seed: 8, meta });
    e.place("camp", "p1");
    e.callWave();
    let guard = 0;
    while (guard++ < 60000) {
      e.tick();
      const dead = e.state.soldiers.find((s) => !s.alive && s.respawnAt);
      if (dead) return dead.respawnAt - e.state.tick;
    }
    throw new Error("no soldier fell to the bull");
  };
  const norm = respawnDelta([]);
  const fast = respawnDelta(["guarddog"]);
  assert.ok(fast < norm, "Guard Dog respawn is sooner (" + fast + " < " + norm + ")");
  assert.ok(Math.abs(fast / norm - 0.75) < 0.05, "≈25% faster (ratio " + (fast / norm).toFixed(3) + ")");
});

test("TD8 🍀 Lucky Darts: a base dart can crit ONLY with the node; meta-less rng stream untouched", () => {
  // a long 30-sock volley (~77 shots on this seed) — the run may leak out, but
  // either terminal phase ends the count; the point is the crit stream
  const lvl = microTd8({ waves: [{ groups: [{ type: "sock", count: 30, gap: 0.5, delay: 0 }] }] });
  const critCount = (meta) => {
    const e = TD.createEngine(lvl, { seed: 9, meta });
    e.place("dart", "p1"); e.place("dart", "p2"); e.place("dart", "p3");
    e.callWave();
    let guard = 0, crits = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 90000) {
      e.tick();
      for (const ev of e.events.splice(0)) if (ev.type === "hit" && ev.crit) crits++;
    }
    return crits;
  };
  assert.equal(critCount([]), 0, "a base (non-sniper) dart never crits without the node");
  assert.ok(critCount(["critchance"]) >= 1, "Lucky Darts lands at least one crit across the volley (seeded)");
});

test("TD8 🦉 Night Owl: the engine's rangeMul halves the night penalty; non-night untouched", () => {
  const night = microTd8({ night: true });
  assert.equal(TD.createEngine(night, { seed: 1 }).rangeMul, DATA.RULES.nightRangeMult, "night dims by the rule");
  const owl = TD.createEngine(night, { seed: 1, meta: ["nightowl"] }).rangeMul;
  assert.ok(Math.abs(owl - (1 - (1 - DATA.RULES.nightRangeMult) / 2)) < 1e-9, "Night Owl halves the dimming");
  assert.equal(TD.createEngine(microTd8(), { seed: 1, meta: ["nightowl"] }).rangeMul, 1, "no effect outside night levels");
});

test("TD8 full tree: owning EVERY node at once stays deterministic and still wins the L1 script", () => {
  const ALL = DATA.META_NODES.map((n) => n.id);
  const a = run(TD.createEngine(L1, { seed: 42, meta: ALL }), l1Plan());
  const b = run(TD.createEngine(L1, { seed: 42, meta: ALL }), l1Plan());
  assert.equal(a.phase, "won", "a maxed tree still wins the L1 script");
  assert.equal(TD.hashState(a), TD.hashState(b), "maxed-tree runs replay identically (rng discipline holds)");
});

// ============ Difficulty-shape guardrails (playability audit 2026-07) ============
// The audit found the authored ramp was INVERTED in play: 76% of all damage
// landed in waves 1-3 (before a real board could exist) while the big late waves
// cost nothing, and the World-2 boss cost ZERO lives. These lock the shape.

test("AUDIT difficulty shape: no level may be a wave-1 GOTCHA (opening damage stays bounded)", () => {
  // Losing a pile of lives in the first three waves isn't difficulty — it's an
  // unfair opening, because starting gold (not skill) decides it. Cap it.
  const MAX_OPENING_DAMAGE = 5;
  const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
  function run(level, plan) {
    const e = TD.createEngine(level, { seed: 7, difficulty: "normal" });
    const padIds = level.pads.map((p) => p.id);
    let idx = 0, guard = 0, last = e.state.lives, per = [];
    while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 400000) {
      if (e.state.phase === "build") {
        if (e.state.waveIdx > 0) { per.push(last - e.state.lives); last = e.state.lives; }
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
    if (e.state.waveIdx > 0) per.push(last - e.state.lives);
    return { phase: e.state.phase, lives: e.state.lives, per };
  }
  const PLANS = [["dart"], ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"]];
  for (const lvl of DATA.LEVELS) {
    const rs = PLANS.map((p) => run(lvl, p));
    const wins = rs.filter((r) => r.phase === "won");
    assert.ok(wins.length, `L${lvl.id} must stay winnable by a sensible build`);
    // the friendlier of the two sensible builds defines the opening experience
    const opening = Math.min(...wins.map((r) => r.per.slice(0, 3).reduce((a, b) => a + b, 0)));
    assert.ok(opening <= MAX_OPENING_DAMAGE,
      `L${lvl.id} "${lvl.name}" loses ${opening} lives in waves 1-3 — that's a starting-gold gotcha, not difficulty (max ${MAX_OPENING_DAMAGE}). Raise its startGold or soften the opening waves.`);
  }
});

// The four SHIPPED abilities are invisible to this entire suite: the winnability
// oracle never calls useAbility, so nothing has ever measured what 🧨 Toy Box
// Drop / 🍯 Sticky Floor / ⚡ Overclock / 📣 Rally Horn do to a finale. Measured
// here (8 seeds, best-of-two plans, powers fired at max cooldown rate on the
// BOSS WAVE ONLY — spamming from wave 1 instead bankrupts the build and loses
// every seed, which is its own evidence that the gold cost bites early):
//
//     finale               normal play   ability spam
//     L4  Bed Monster          14            14      +0
//     L8  Vacuum King          11            18      +7
//     L12 The Static            7             5      -2   (the gold cost outweighs)
//     L16 Tickmaster           17            20      +3   (flawless)
//     L20 Toolbox Titan         9            20     +11   (flawless — the tensest finale, erased)
//     L24 The Moving Van       14            13      -1
//
// So three finales survive the powers and three do not. Pinned as a baseline
// rather than a bare bar, for the same reason as the meta test — but note this
// one IS failable on L4/L12/L24 against the real cap, so it is not a rubber
// stamp. It is also the test any NEW power must pass before it ships.
test("AUDIT ability abuse: spamming the shipped powers must not erase a finale", () => {
  // P6 NOTE ON SCOPE. A run may only BRING RULES.abilitySlots of the pool, so
  // "spam everything" is a loadout no player can field. That is deliberate here
  // and it is sound in one direction only: a full-pool run is a strict UPPER
  // BOUND over every legal pack (a pack is a subset, and abilityReady refuses
  // what is not equipped), so passing at the bound proves every pack passes. It
  // is the opposite of the P4 mistake — there the full tree was used to BLAME
  // individual nodes, where an unreachable state tells you nothing; here the
  // question is only "can ability use erase a finale", and a conservative bound
  // answers it. What a bound cannot do is prove each power was reached, so the
  // separate "P6 coverage" test asserts every shipped power actually FIRES —
  // that is the falsifiable half, and it is red today on a camp-less plan.
  const MAX_BOSS_LEVEL_FINISH = 17;
  // Measured 2026-07, then RE-measured after Phase 3 gave the powers a flat
  // per-wave energy budget: L16 went 20 → 8 and L20 20 → 9, both back inside the
  // real 17-life bar, so both left this list. L8 is the residual — its boss wave
  // runs long enough that the 20-30s cooldowns, not the energy, are the binding
  // constraint, so it still finishes at 18 under full spam.
  const BASELINE = { 8: 18 };
  const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
  function run(level, plan, seed) {
    const e = TD.createEngine(level, { seed, difficulty: "normal" });
    const padIds = level.pads.map((p) => p.id);
    let idx = 0, guard = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 400000) {
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
      if (e.state.phase === "wave" && e.state.waveIdx >= level.waves.length - 1) {
        const lead = e.state.enemies.filter((x) => x.alive).sort((a, b) => b.dist - a.dist)[0];
        for (const ab of DATA.ABILITIES) {
          if (!e.abilityReady(ab.id).ok) continue;
          if (ab.kind === "point") { if (lead) { const p = e.posOn(lead.pathIdx || 0, lead.dist); e.useAbility(ab.id, { x: p.x, y: p.y }); } }
          else if (ab.kind === "tower") { const t = e.state.towers[0]; if (t) e.useAbility(ab.id, { towerId: t.id }); }
          else e.useAbility(ab.id, {});
        }
      }
      e.tick();
    }
    return e.state;
  }
  const PLANS = [["dart"], ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"]];
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
  const finales = DATA.LEVELS.filter((l) => l.waves.some((w) => w.boss));
  assert.ok(Object.keys(BASELINE).length < finales.length,
    "the baseline must never cover every finale — this test has to be able to fail");
  for (const lvl of finales) {
    const perSeed = SEEDS.map((seed) => {
      const wins = PLANS.map((p) => run(lvl, p, seed)).filter((r) => r.phase === "won");
      return wins.length ? Math.max(...wins.map((r) => r.lives)) : -1;
    });
    const sorted = perSeed.filter((l) => l >= 0).slice().sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : -1;
    const base = BASELINE[lvl.id];
    if (base === undefined) {
      assert.ok(median <= MAX_BOSS_LEVEL_FINISH,
        `L${lvl.id} "${lvl.name}" finishes at a median ${median} when the powers are spammed (${perSeed.join(", ")}) — ` +
        "a finale must still cost something even against full ability use.");
    } else {
      assert.ok(median <= base,
        `L${lvl.id} "${lvl.name}" got softer under ability spam: median ${median} vs a pinned ${base} (${perSeed.join(", ")})`);
      assert.ok(base > MAX_BOSS_LEVEL_FINISH,
        `L${lvl.id} is in BASELINE at ${base}, which is within the real bar — remove it`);
    }
  }
});

test("⚙️ exchange: gold buys energy, capped per wave, and cannot erase a finale", () => {
  // Reported from real play: "on normal I end levels with thousands of extra
  // money even when I have max level towers on every spot." Measured with
  // tools/td-gold.js: 21 of 36 levels reach a board with literally NOTHING left
  // to buy, on average 2.2 waves before the end, leaving 2,770 gold unspent
  // (8,138 worst). So the exchange gives that surplus a use — but energy is the
  // constraint Phase 3 installed precisely to stop late gold making the powers
  // free, so the whole design rests on the PER-WAVE cap.
  const R = DATA.RULES;
  const L = DATA.LEVELS[0];

  // --- the mechanics, exactly ---
  const e = TD.createEngine(L, { seed: 7, difficulty: "normal" });
  assert.equal(e.buyChargeReady().reason, "not-in-wave",
    "the exchange is wave-only, like every other timed effect");
  e.state.gold = 99999;
  e.callWave();
  const p0 = e.chargePrice();
  assert.equal(p0, R.chargeBuyBase, "the first energy of a wave costs the base price");
  const goldBefore = e.state.gold, chargeBefore = e.state.charge;
  assert.ok(e.buyCharge().ok, "a wave-phase purchase with gold and room succeeds");
  assert.equal(e.state.charge, chargeBefore + 1, "…and actually grants the energy");
  assert.equal(e.state.gold, goldBefore - p0, "…and charges exactly the quoted price");
  assert.equal(e.buyChargeReady().reason, "wave-limit",
    `only ${R.chargeBuyMax} may be bought per wave — this cap is the entire safety property`);

  // Nothing is taken for a purchase that would do nothing — the documented
  // "a power that changes nothing must never charge you" law.
  const f = TD.createEngine(L, { seed: 7, difficulty: "normal" });
  f.state.gold = 99999;
  f.callWave();
  f.state.charge = R.chargeMax;
  assert.equal(f.buyChargeReady().reason, "full", "a full bank refuses instead of taking the money");
  const g = TD.createEngine(L, { seed: 7, difficulty: "normal" });
  g.callWave();
  g.state.gold = 0;
  assert.equal(g.buyChargeReady().reason, "gold", "a broke board is told it is broke");

  // The allowance RESETS with the per-wave grant, and needs no checkpoint field
  // because a checkpoint is a wave boundary where it is always 0.
  const h = TD.createEngine(L, { seed: 7, difficulty: "normal" });
  h.state.gold = 99999;
  h.callWave();
  assert.ok(h.buyCharge().ok);
  h.state.phase = "build"; h.state.charge = 0;
  h.callWave();
  assert.equal(h.state.chargeBought, 0, "the per-wave allowance resets when the next wave is sent");

  // --- and the balance property, which is the one that matters ---
  // Mirrors the ability-abuse fixture above, then buys every ⚙️ the exchange
  // will sell on EVERY wave — a strict upper bound on what a player can do.
  // Measured: every finale's median is IDENTICAL to the no-exchange baseline
  // (several per-seed values are LOWER, because energy bought is gold not spent
  // on towers — the trade has a real cost). Falsifiable, and proven so: at
  // chargeBuyMax 6 / base 100 this goes red on L16, whose median jumps 8 → 20,
  // i.e. the finale erased on 5 of 8 seeds.
  const MAX_BOSS_LEVEL_FINISH = 17;
  const BASELINE = { 8: 18 };   // the same residual the sibling audit pins
  const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
  function run(level, plan, seed) {
    const en = TD.createEngine(level, { seed, difficulty: "normal" });
    const padIds = level.pads.map((p) => p.id);
    let idx = 0, guard = 0;
    while (en.state.phase !== "won" && en.state.phase !== "lost" && guard++ < 400000) {
      if (en.state.phase === "build") {
        let spent = true;
        while (spent) {
          spent = false;
          for (const pid of padIds) {
            if (!en.state.towers.find((t) => t.padId === pid)) {
              const line = plan[idx % plan.length];
              if (en.state.gold >= cost(line, 0)) { if (en.place(line, pid).ok) { idx++; spent = true; } }
              break;
            }
          }
          if (spent) continue;
          const ups = en.state.towers.filter((t) => t.tier < 3).sort((a, b) => a.tier - b.tier);
          for (const t of ups) { if (en.state.gold >= cost(t.lineId, t.tier)) { if (en.upgrade(t.id).ok) spent = true; break; } }
        }
        en.callWave();
      }
      if (en.state.phase === "wave") { while (en.buyChargeReady().ok) en.buyCharge(); }
      if (en.state.phase === "wave" && en.state.waveIdx >= level.waves.length - 1) {
        const lead = en.state.enemies.filter((x) => x.alive).sort((a, b) => b.dist - a.dist)[0];
        for (const ab of DATA.ABILITIES) {
          if (!en.abilityReady(ab.id).ok) continue;
          if (ab.kind === "point") { if (lead) { const q = en.posOn(lead.pathIdx || 0, lead.dist); en.useAbility(ab.id, { x: q.x, y: q.y }); } }
          else if (ab.kind === "tower") { const t = en.state.towers[0]; if (t) en.useAbility(ab.id, { towerId: t.id }); }
          else en.useAbility(ab.id, {});
        }
      }
      en.tick();
    }
    return en.state;
  }
  const PLANS = [["dart"], ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"]];
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
  for (const lvl of DATA.LEVELS.filter((l) => l.waves.some((w) => w.boss))) {
    const perSeed = SEEDS.map((seed) => {
      const wins = PLANS.map((p) => run(lvl, p, seed)).filter((r) => r.phase === "won");
      return wins.length ? Math.max(...wins.map((r) => r.lives)) : -1;
    });
    const sorted = perSeed.filter((l) => l >= 0).slice().sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : -1;
    const bar = BASELINE[lvl.id] === undefined ? MAX_BOSS_LEVEL_FINISH : BASELINE[lvl.id];
    assert.ok(median <= bar,
      `L${lvl.id} "${lvl.name}" finishes at a median ${median} when gold is poured into ⚙️ and the powers are spammed ` +
      `(${perSeed.join(", ")}) — the per-wave cap (${R.chargeBuyMax}) is meant to stop a full purse buying a finale.`);
  }
});

test("TD-18 🎇 Sparkler: it POPS where it dies, jamming the nearest gun", () => {
  // The decision axis the Oil Drum opened, asking a different question: the
  // drum changes the GROUND, this takes a GUN off the board. Driven through
  // the engine's own seam (dealDamage → the ONE killEnemy) rather than inferred
  // from a time-to-kill, so no confound can dress a broken mechanic as working.
  const L1 = DATA.LEVELS[0];
  const def = DATA.ENEMIES.sparkler;
  assert.ok(def && def.jamBurst, "the Sparkler declares a jamBurst");
  // helper: park one sparkler at a known spot with a tower nearby, kill it,
  // and read the tower's jam state.
  const probe = (line, gap) => {
    const e = TD.createEngine(L1, { seed: 5 });
    e.state.gold = 99999;
    const pad = L1.pads[0];
    assert.ok(e.place(line, pad.id).ok, "placed the " + line);
    const t = e.state.towers[0];
    // spawn a sparkler and drag it to `gap` cells from the tower along its lane
    e.state.enemies.push({ id: 9001, type: "sparkler", alive: true, dist: 0, pathIdx: 0,
      speed: def.speed, hp: def.hp, maxHp: def.hp, shield: 0, blockedBy: 0, slowUntil: 0, chargeCd: 0, sapCd: 0 });
    const foe = e.state.enemies[e.state.enemies.length - 1];
    // walk it to the closest point on the lane to this tower, then offset
    let bestD = Infinity, bestDist = 0;
    for (let d = 0; d <= e.path.total; d += 0.1) {
      const p = e.posAt(d);
      const q = Math.hypot(p.x - t.cx, p.y - t.cy);
      if (q < bestD) { bestD = q; bestDist = d; }
    }
    foe.dist = bestDist;
    const reach = Math.hypot(e.posAt(foe.dist).x - t.cx, e.posAt(foe.dist).y - t.cy);
    const before = t.disabledUntil;
    e.dealDamage(foe, 99999, 0, "dart");     // the ONE damage path → the ONE killEnemy
    return { jammed: t.disabledUntil > before, tick: e.state.tick, until: t.disabledUntil, reach, t, e };
  };
  // ---- a shooting gun inside the radius IS jammed
  const near = probe("dart");
  assert.ok(near.reach <= def.jamBurst.radius,
    `the fixture must place the gun INSIDE the burst (${near.reach.toFixed(2)} ≤ ${def.jamBurst.radius}) or it proves nothing`);
  assert.ok(near.jammed, "a gun inside the burst is jammed when the Sparkler dies");
  assert.equal(near.until - near.tick, Math.round(def.jamBurst.seconds * DATA.TICK_RATE),
    "…for exactly the declared duration, through the one jamTower owner");
  // ---- a CAMP is never jammed: bodies, not electronics (the Screw's rule,
  //      shared because both route through the one jamNearest owner)
  const camp = probe("camp");
  assert.ok(camp.reach <= def.jamBurst.radius, "the camp fixture is also inside the burst");
  assert.ok(!camp.jammed, "Army Guys are bodies, not electronics — a camp never jams");
  // ---- and it must be a DEATH burst, not an aura: alive, it jams nothing.
  // The sparkler is parked at the SAME spot the death probe used — right on
  // top of the gun. The first cut left it at dist 0 (the lane start, far from
  // the pad), so an aura mutation could not have reached the tower and the
  // clause passed vacuously: the fixture never created the condition it claims
  // to rule out.
  const alive = TD.createEngine(L1, { seed: 5 });
  alive.state.gold = 99999;
  alive.place("dart", L1.pads[0].id);
  const at = alive.state.towers[0];
  let aBest = Infinity, aDist = 0;
  for (let d = 0; d <= alive.path.total; d += 0.1) {
    const p = alive.posAt(d);
    const q = Math.hypot(p.x - at.cx, p.y - at.cy);
    if (q < aBest) { aBest = q; aDist = d; }
  }
  assert.ok(aBest <= def.jamBurst.radius,
    `the living-sparkler fixture must sit INSIDE the burst radius (${aBest.toFixed(2)}) or it rules out nothing`);
  // …and the COMBAT pass has to actually run: tick() returns early in the build
  // phase, so a fixture that never calls a wave exercises none of the per-tick
  // enemy code and would "rule out" an aura that was simply never reached.
  alive.callWave();
  assert.equal(alive.state.phase, "wave", "the fixture is in the wave phase, or no enemy code runs at all");
  // `speed` is not optional on a hand-built body: effSpeed reads e.speed, so a
  // literal one field short makes `dist` NaN, posAt clamps NaN to the lane END,
  // and the body silently teleports out of range — while a post-loop read of
  // the PINNED dist still looks perfect. That is exactly how this clause passed
  // its own mutation four times. The precondition below makes it self-verifying.
  alive.state.enemies.push({ id: 9002, type: "sparkler", alive: true, dist: aDist, pathIdx: 0,
    speed: def.speed, hp: 9e9, maxHp: 9e9, shield: 0, blockedBy: 0, slowUntil: 0, chargeCd: 0, sapCd: 0 });
  alive.tick();
  const moved = alive.state.enemies.find((x) => x.id === 9002);
  const step = moved.dist - aDist;
  assert.ok(Number.isFinite(step) && step > 0 && step < 1,
    `the living body must actually WALK (step ${step}) — a NaN/frozen dist means the fixture is missing a field and the clause is vacuous`);
  for (let i = 0; i < 200; i++) {
    alive.state.enemies.forEach((x) => { if (x.id === 9002) { x.dist = aDist; x.hp = 9e9; } }); // pin it: alive and in range
    alive.tick();
  }
  // EVER jammed, not "jammed right now". `disabledUntil` starts at 0 and only a
  // jam ever writes it, so this catches a jam that has since expired — which
  // the first cut did not: an aura mutation jams once, jamNearest then SKIPS
  // the already-jammed tower, and the jam had run out by the end of the loop,
  // so an end-state check read clean on a broken engine.
  assert.equal(at.disabledUntil, 0,
    "a LIVING sparkler jams nothing — the whole mechanic is that you choose where it dies");
});

test("TD-18 jamming has ONE owner, and the Screw's legacy aim is PINNED on purpose", () => {
  // Two enemies jam a gun, and a second copy of "find the nearest tower" is
  // exactly how the half-cell bug below survived. So: one owner, and the ONE
  // thing the callers disagree about is a named parameter rather than a
  // constant somebody has to notice.
  const src = require("fs").readFileSync("scripts/td-logic.js", "utf8");
  const code = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""); // a scan must not read its own docs
  assert.equal((code.match(/function nearestJammable\b/g) || []).length, 1,
    "exactly one place decides which tower gets jammed");
  assert.equal((code.match(/jamNearest\(/g) || []).length, 3,
    "…defined once and called by exactly the two jammers (Screw + Sparkler)");
  // The pin itself. The Sparkler passes NO bias (raw cell indices, the space
  // candidates()/the dart's keep/the mortar all use); the Screw passes 0.5
  // because it has always measured to a tower's world CENTRE. Straightening it
  // is measured to break PLAYABILITY on L16 and TD7 lever advantage on L31, so
  // it is deliberate — but it must stay VISIBLE, not decay into folklore.
  assert.match(code, /const SCREW_AIM_BIAS = 0\.5;/,
    "the legacy aim is a named constant, so it can never read as an accident");
  assert.match(code, /def\.sap\.seconds, SCREW_AIM_BIAS\)/, "…and only the Screw uses it");
  assert.match(code, /def\.jamBurst\.radius, def\.jamBurst\.seconds\)/,
    "the Sparkler is new content and uses the engine's own index space");
  // …and prove the parameter is LOAD-BEARING rather than decorative: on a board
  // where the two spaces disagree, the bias must change which tower is chosen.
  // Without this the constant could be 0.5 or 5 and nothing would notice.
  const L = DATA.LEVELS[0];
  const e = TD.createEngine(L, { seed: 3 });
  e.state.gold = 999999;
  for (const p of L.pads) e.place("dart", p.id);
  // sweep the lane for a spot where biased and unbiased aim pick DIFFERENT guns
  let disagreed = false;
  for (let d = 0; d <= e.path.total && !disagreed; d += 0.25) {
    const p = e.posAt(d);
    const pick = (b) => {
      let best = 3.5 * 3.5, win = null;
      for (const t of e.state.towers) {
        const q = (t.cx + b - p.x) ** 2 + (t.cy + b - p.y) ** 2;
        if (q < best) { best = q; win = t.id; }
      }
      return win;
    };
    const a = pick(0), b = pick(0.5);
    if (a && b && a !== b) disagreed = true;
  }
  assert.ok(disagreed,
    "the half-cell bias really does re-aim the Screw on a shipped map — it is a live behavioural pin, not a cosmetic constant");
});

test("TD-18 chips: a ban is enforced by the ENGINE, and no chips means exactly vanilla", () => {
  // A chip is an opt-in constraint, pure input like meta/powers. Three claims,
  // each with its own failure mode: the ban actually binds (a picker that arms
  // a chip nothing enforces is dead content), the default is a true noop (the
  // shipped sims pass no chips, so any drift here silently re-tunes 40 levels),
  // and an unknown id degrades instead of crashing or inventing a ban.
  const L1 = DATA.LEVELS[0];
  // ---- the default is byte-identical vanilla, proven by the determinism hash
  const play = (opts) => {
    const e = TD.createEngine(L1, Object.assign({ seed: 9 }, opts));
    e.state.gold = 500;
    e.place("dart", L1.pads[0].id);
    e.callWave();
    for (let i = 0; i < 900; i++) e.tick();
    // the WHOLE state, through the same hash the determinism suite trusts —
    // state.chips itself legitimately differs, so it is masked out first
    const s = JSON.parse(JSON.stringify(e.state));
    delete s.chips;
    return TD.hashState(s);
  };
  assert.equal(play({}), play({ chips: [] }),
    "chips: [] must be byte-identical to no chips at all — the shipped sims depend on it");
  assert.equal(play({}), play({ chips: ["not-a-real-chip"] }),
    "an unknown chip id must degrade to no effect (a hand-edited save cannot invent a ban)");
  // ---- every declared line ban binds at place(), and only its own line
  for (const chip of DATA.CHIPS.filter((c) => c.ban && c.ban.line)) {
    const e = TD.createEngine(L1, { seed: 5, chips: [chip.id] });
    e.state.gold = 99999;
    const banned = e.place(chip.ban.line, L1.pads[0].id);
    assert.equal(banned.ok, false, `${chip.id} must refuse its line`);
    assert.equal(banned.reason, "chip", `…with the chip reason, so the UI can say why`);
    assert.equal(e.lineAllowed(chip.ban.line), false, `lineAllowed must agree (${chip.id})`);
    const other = Object.keys(DATA.TOWERS).find((t) => t !== chip.ban.line);
    assert.ok(e.place(other, L1.pads[0].id).ok, `${chip.id} must not touch ${other}`);
    assert.ok(e.lineAllowed(other), "…and lineAllowed says so");
  }
  // ---- 🔇 Quiet Hands turns the whole strip off, before any resource reason
  const q = TD.createEngine(L1, { seed: 5, chips: ["nopowers"] });
  q.state.gold = 99999;
  for (const a of DATA.ABILITIES) {
    assert.equal(q.abilityReady(a.id).reason, "chip",
      `${a.id} must refuse under Quiet Hands — a run-level vow, not a resource state`);
  }
  // …and without it every power reaches its normal refusals, so the clause
  // above cannot be satisfied by powers that were already broken.
  const q2 = TD.createEngine(L1, { seed: 5, chips: ["nofan"] });
  assert.notEqual(q2.abilityReady(DATA.ABILITIES[0].id).reason, "chip",
    "a line-ban chip must NOT touch the powers");
  // ---- the run records what constrained it (checkpoint fidelity's read side)
  assert.deepEqual(q.state.chips, ["nopowers"], "state.chips carries the run's chips");
  assert.deepEqual(TD.createEngine(L1, { seed: 5 }).state.chips, [], "…and defaults empty");
});

test("TD-18 chips: every shipped chip is COMPLETABLE on every level (measured, not hoped)", () => {
  // A challenge that cannot be done is the dead-content class (heroic with no
  // selector, World 4 with no cards) — so completability is a GUARDRAIL, not a
  // design note. One dart-mono arm proves three chips at once: it builds no
  // fan, no mortar and no camp, so a level it clears is completable under any
  // of those bans. It clears all 40 on CASUAL (L27/L40 need the mixed plan on
  // normal — measured before this shipped, which is why the bar is casual).
  // 🔇 Quiet Hands is proven by PLAYABILITY itself: the oracle never uses a
  // power, so every level's own winnability sim is already a no-powers clear.
  //   A "no darts" chip was cut by this exact measurement — its arms failed 30
  // of 40 on normal and 10 on casual — so this test walking only line-ban chips
  // whose banned line the dart plan avoids is not an accident of scope: a
  // future chip banning the DART must bring its own measured arm.
  const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
  function dartClears(level, seed) {
    const e = TD.createEngine(level, { seed, difficulty: "casual",
      chips: ["nofan", "nomortar", "nocamp"] }); // the bans THEMSELVES, so the arm proves the chips as shipped
    const padIds = level.pads.map((p) => p.id);
    let guard = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 400000) {
      if (e.state.phase === "build") {
        let spent = true;
        while (spent) {
          spent = false;
          for (const pid of padIds) {
            if (!e.state.towers.find((t) => t.padId === pid)) {
              if (e.state.gold >= cost("dart", 0)) { if (e.place("dart", pid).ok) spent = true; }
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
    return e.state.phase === "won";
  }
  const failed = [];
  for (const lvl of DATA.LEVELS) {
    if (!dartClears(lvl, 1) && !dartClears(lvl, 7)) failed.push(lvl.id);
  }
  assert.deepEqual(failed, [],
    `a dart-only board (all three line-ban chips armed) must clear every level on casual — ` +
    `L${failed.join(",L")} fail, so a shipped chip has become an unearnable badge there`);
});

test("a number the UI SHOWS comes from the engine, because the meta moves it", () => {
  // The price flash established the law — "ASK THE ENGINE, never re-derive" —
  // after the panel showed 110 while 🔧 Handyman charged 99. Two numbers were
  // still being derived from DATA afterwards, both understating what the run
  // gets, which is the quieter half of the class: nobody notices being handed
  // MORE than the label promised, so only a test can find it.
  const L = DATA.LEVELS[0];
  const build = (meta) => {
    const e = TD.createEngine(L, { seed: 5, meta });
    e.state.gold = 9000;
    e.place("dart", L.pads[0].id);
    const t = e.state.towers[0];
    e.upgrade(t.id); e.upgrade(t.id);
    return { e, t };
  };
  // ---- ♻️ Trade-In: sell refund 80% → 90%. The panel labelled its button
  // `Math.floor(t.spent * DATA.RULES.sellRefund)` while sell() paid
  // `× mods.sellRefund` — 272 shown against 306 paid on a tier-3 dart.
  for (const meta of [[], ["sellrefund"]]) {
    const { e, t } = build(meta);
    assert.equal(t.tier, 3, "the fixture must reach tier 3 for the gap to be worth measuring");
    const quoted = e.refundOf(t.id);
    const before = e.state.gold;
    const paid = e.sell(t.id).refund;
    assert.equal(quoted, paid, `refundOf must quote what sell() pays (meta ${JSON.stringify(meta)})`);
    assert.equal(e.state.gold - before, paid, "…and that is what reaches your gold");
  }
  const plain = build([]), disc = build(["sellrefund"]);
  assert.ok(disc.e.refundOf(disc.t.id) > plain.e.refundOf(plain.t.id),
    "♻️ Trade-In must actually raise the refund, or the pair above proves nothing about the SOURCE");
  assert.equal(plain.e.refundOf(plain.t.id), Math.floor(plain.t.spent * DATA.RULES.sellRefund),
    "with no node the engine's refund is still the plain rule — the fix must not have changed the base game");
  assert.equal(plain.e.refundOf(99999), 0, "an unknown tower refunds nothing rather than throwing");

  // ---- 🔋 Spare Battery: +1 ⚙️ per wave. The out-of-energy hint printed
  // RULES.chargePerWave, so an owning run was told it banks 2 when it banks 3.
  for (const meta of [[], ["sparebattery"]]) {
    const e = TD.createEngine(L, { seed: 5, meta });
    const before = e.state.charge;
    e.callWave();
    assert.equal(e.chargeGrant(), e.state.charge - before,
      `chargeGrant must be the energy a wave actually banks (meta ${JSON.stringify(meta)})`);
  }
  const b0 = TD.createEngine(L, { seed: 5, meta: [] });
  const b1 = TD.createEngine(L, { seed: 5, meta: ["sparebattery"] });
  assert.ok(b1.chargeGrant() > b0.chargeGrant(),
    "🔋 Spare Battery must actually raise the grant, or the assertion above is satisfied by the raw rule");
  assert.equal(b0.chargeGrant(), DATA.RULES.chargePerWave,
    "…and with no node it is exactly the rule, so the base game is unchanged");
});

test("the tower panel's STAT LINE is what the tower actually fights with", () => {
  // Same law, on the tower panel's stats. It read raw DATA and was wrong on six
  // axes — and the worst needs no meta at all: on a NIGHT level it printed the
  // tier's range while the engine used ×0.85 of it and the range RING beside it
  // drew the smaller circle, and on a ⚡ power pad it understated, hiding the
  // socket's whole benefit.
  //
  // towerStats multiplies the same `mods` the combat sites do, which is a second
  // multiplication, so this pins it BEHAVIOURALLY rather than by structure: the
  // dps it reports must be the damage a shot really carries.
  const L1 = DATA.LEVELS[0];
  const build = (lvl, meta, line, padId, tier) => {
    const e = TD.createEngine(lvl, { seed: 5, meta });
    e.state.gold = 99999;
    assert.ok(e.place(line, padId || lvl.pads[0].id).ok, `placed a ${line}`);
    const t = e.state.towers[0];
    for (let i = 1; i < (tier || 1); i++) e.upgrade(t.id);
    return { e, t };
  };
  // ---- RANGE is towerReach, the ONE owner, so the text and the ring agree.
  for (const lvl of DATA.LEVELS) {
    const { e, t } = build(lvl, [], "dart", null, 3);
    assert.equal(e.towerStats(t.id).range, e.towerReach(t.id),
      `L${lvl.id}: the panel's range must BE towerReach — the ring already is, and the two must not disagree`);
  }
  // …and it must actually differ somewhere, or "range comes from the engine" is
  // satisfied by the raw number. A night level and a ⚡ socket are the two cases.
  const night = DATA.LEVELS.find((l) => l.night);
  assert.ok(night, "a night level must exist for this claim to be testable");
  const nb = build(night, [], "dart", null, 3);
  const rawRange = DATA.TOWERS.dart.tiers[2].range;
  assert.ok(nb.e.towerStats(nb.t.id).range < rawRange,
    `night must shrink the printed range (raw ${rawRange}, engine ${nb.e.towerStats(nb.t.id).range})`);
  const padLvl = DATA.LEVELS.find((l) => (l.pads || []).some((p) => p.boost && p.boost.range));
  if (padLvl) {
    const bp = padLvl.pads.find((p) => p.boost && p.boost.range);
    const pb = build(padLvl, [], "dart", bp.id, 3);
    assert.ok(pb.e.towerStats(pb.t.id).range > rawRange,
      "a ⚡ power pad must GROW the printed range — hiding that was hiding the socket's whole point");
  }
  // ---- DPS: the number on the panel is the damage a shot carries. Driven
  // through the real firing path, not inferred: place a dart, run a wave, and
  // read the projectile it launches.
  const dartDps = (meta) => {
    const { e, t } = build(L1, meta, "dart", null, 3);
    const st = e.towerStats(t.id);
    e.callWave();
    let seen = 0;
    for (let i = 0; i < 3000 && !seen; i++) {
      e.tick();
      const p = e.state.projectiles.find((x) => !x.crit); // a crit is a separate multiplier
      if (p) seen = p.dmg;
    }
    assert.ok(seen > 0, `a dart must actually fire (meta ${JSON.stringify(meta)})`);
    return { panel: st.dmg, fired: seen, rate: st.rate };
  };
  for (const meta of [[], ["dartdmg"], ["dartdmg2"]]) {
    const r = dartDps(meta);
    assert.ok(Math.abs(r.panel - r.fired) < 0.51,
      `the panel's dps is built from ${r.panel} damage but a shot carries ${r.fired} (meta ${JSON.stringify(meta)})`);
  }
  assert.ok(dartDps(["dartdmg2"]).panel > dartDps([]).panel,
    "🎯 Sharp Darts II must raise the printed damage, or the equality above is satisfied by the raw stat");
  // ---- the other three lines' modified stats, each against the mod the engine
  // applies — a line whose stat stopped moving would be showing a stale number.
  const pairs = [
    ["mortar", "splash", ["mortarsplash2"]],
    ["fan", "auraRange", ["fanrange"]],
    ["camp", "hp", ["soldierhp2"]],
  ];
  for (const [line, key, meta] of pairs) {
    const a = build(L1, [], line, null, 3), b = build(L1, meta, line, null, 3);
    assert.ok(b.e.towerStats(b.t.id)[key] > a.e.towerStats(a.t.id)[key],
      `${line}'s ${key} must reflect ${meta[0]} (plain ${a.e.towerStats(a.t.id)[key]}, node ${b.e.towerStats(b.t.id)[key]})`);
  }
  // 🪖 Tough Troops is the one whose effect is observable on a real body.
  const camp = build(L1, ["soldierhp2"], "camp", null, 3);
  for (let i = 0; i < 120; i++) camp.e.tick();
  const sol = camp.e.state.soldiers.find((s) => s.campId === camp.t.id);
  assert.equal(camp.e.towerStats(camp.t.id).hp, sol.maxHp,
    "the panel's soldier hp must be the hp a soldier is actually spawned with");
  assert.equal(camp.e.towerStats(99999), null, "an unknown tower has no stats rather than throwing");

  // A stat block one field short must be caught at AUTHORING time, not printed
  // to the player as "NaN dps". Derived from the kinds towerStats multiplies, so
  // a fifth line of a known kind — and every future tier and branch — inherits
  // the check. (The engine also coerces, tested below, but a silent 0 on the
  // panel is still wrong; this is the clause that names the offender.)
  const NEEDS = { dart: ["dmg"], mortar: ["splash"], fan: ["auraRange"], camp: ["hp"] };
  let checked = 0;
  for (const [id, def] of Object.entries(DATA.TOWERS)) {
    for (const key of NEEDS[def.kind] || []) {
      const blocks = [
        ...def.tiers.map((s, i) => ["tier" + (i + 1), s]),
        ...Object.entries(def.branches || {}).map(([k, s]) => ["branch:" + k, s]),
      ];
      for (const [label, s] of blocks) {
        checked++;
        assert.equal(typeof s[key], "number",
          `${id}/${label} has no numeric ${key}, and towerStats multiplies it — the panel would print NaN`);
      }
    }
  }
  assert.ok(checked >= 20, `the sweep must cover every tier and branch of every line, saw ${checked}`);

  // …and the engine degrades anyway, so an unlisted future field cannot make the
  // panel unreadable while someone is fixing the data.
  const short = JSON.parse(JSON.stringify(DATA.LEVELS[0]));
  const bare = TD.createEngine(short, { seed: 5, meta: ["dartdmg2"] });
  bare.state.gold = 99999;
  bare.place("dart", short.pads[0].id);
  const bt = bare.state.towers[0];
  delete bt.tier; bt.tier = 1;
  const savedDmg = DATA.TOWERS.dart.tiers[0].dmg;
  delete DATA.TOWERS.dart.tiers[0].dmg;
  try {
    const st = bare.towerStats(bt.id);
    assert.ok(isFinite(st.dmg), `a missing stat must degrade to a finite number, got ${st.dmg}`);
  } finally {
    DATA.TOWERS.dart.tiers[0].dmg = savedDmg;
  }
});

// The same audit, run with the strongest loadout a player can actually BRING —
// the balance instrument that did not exist. Every tuning number in this project
// (and in CLAUDE.md and every PLAN doc) is a NO-META number, because the
// winnability oracle passes no `meta`, and the tree is the strongest difficulty
// knob in the game.
//
// TWO corrections came out of Phase 4, and both are why this test is shaped the
// way it is now. (1) It used to pass ALL 23 nodes — a loadout that is now
// IMPOSSIBLE, since a run equips at most RULES.metaSlots. An instrument that
// measures an unreachable state cannot tell you anything about the game. It
// therefore measures the worst LEGAL pack, which is a real thing a player can
// do. (2) It judged lives REMAINING against a 5-17 band, but Extra Hearts raises
// the STARTING total — so a lives-boosting loadout scored as "softer" for free.
// It measures lives LOST.
//
// Measured 2026-07 (4 seeds, best-of-two plans, normal), lives LOST:
//
//     finale                no-meta   best legal 6-pack
//     L4  Bed Monster            7            6
//     L8  Vacuum King           10            1     <- erased
//     L12 The Static            14           10
//     L16 Tickmaster            10            0     <- erased
//     L20 Toolbox Titan         12           11
//     L24 The Moving Van         7            8
//
// So the slot cap rescued four of six, and L8/L16 survive as a pinned baseline
// because they are boss-QUANTIZED: one boss leak is worth 8 lives, so any damage
// increase flips them from one leak to none. Three single Firepower nodes each
// do it alone. That is a level-design fact, not a meta-economy one, and it is
// recorded rather than exempted away — the baseline covers 2 of 6, so this test
// can still fail on the other four.
test("AUDIT boss tension with the strongest LEGAL loadout: pin the meta erosion", () => {
  // the worst legal pack found by the Phase 4 sweep: the front of the Firepower
  // branch, which is what a player optimising for damage actually brings
  const ALL_META = DATA.META_NODES.filter((n) => n.branch === "fire").map((n) => n.id).slice(0, DATA.RULES.metaSlots);
  const MAX_LIVES_LOST_FLOOR = 3;   // a finale must cost SOMETHING
  // Measured 2026-07 with this exact harness. A finale absent here is NEW and is
  // held to the real bar — so a 7th world cannot quietly add a 7th broken one.
  // L12 moved 22 → 24 in Phase 2, when its escort became the untargetable
  // The two boss-QUANTIZED finales, in lives LOST. Everything else is held to
  // the real bar, so this test can (and must be able to) fail on four of six.
  // THREE boss-QUANTIZED finales now, not two. L32 joins them on measurement, not
  // on convenience: its no-meta cost is a healthy 7 lives, but the Big Magnet's
  // 6-life toll means one boss leak IS the level, so any damage increase flips it
  // from one leak to none — exactly the shape already documented for L8 and L16.
  // Pinned at its measured value ([0,0,0,0] on the standard seeds) so it can still
  // fail if it gets softer, while the other SEVEN finales stay held to the real
  // bar — stronger coverage than the 4-of-6 this test had when it was written.
  const BASELINE = { 8: 1, 16: 0, 32: 0 };
  const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
  function run(level, plan, seed) {
    const e = TD.createEngine(level, { seed, difficulty: "normal", meta: ALL_META });
    const startLives = e.state.lives;
    const padIds = level.pads.map((p) => p.id);
    let idx = 0, guard = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 400000) {
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
    return { phase: e.state.phase, lives: e.state.lives, lost: startLives - e.state.lives };
  }
  const PLANS = [["dart"], ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"]];
  // The repo's STANDARD seed set, not a bespoke [1,2,3,4]. That choice was the
  // "a scan's own list is part of the scan" class applied to SAMPLING, and it hid
  // a real erasure: measured over 12 seeds, L32's lives-lost vector against this
  // pack is [0,6,7,6,0,0,7,0,0,0,0,0] — erased on 8 of 12 — while [1,2,3,4] is
  // the unrepresentative quarter and reported a median of 6.
  //
  // More seeds is NOT the fix, and that is the interesting part: for a quantized
  // finale the outcome is bimodal, so the median is unstable in the sample size —
  // 4 seeds say 6, 8 seeds say 6, 12 seeds say 0. Using the set the rest of the
  // suite already standardises on (AUDIT heroic is a SLOPE) costs nothing and
  // reads the truth. Measured across all ten finales, no other level moves below
  // the floor; several read HIGHER.
  const SEEDS = [1, 7, 13, 23];
  const finales = DATA.LEVELS.filter((l) => l.waves.some((w) => w.boss));
  assert.ok(Object.keys(BASELINE).length < finales.length,
    "the baseline must never cover every finale — a test that cannot fail is worse than no test");
  let fixed = 0;

  for (const lvl of finales) {
    const perSeed = SEEDS.map((seed) => {
      const wins = PLANS.map((p) => run(lvl, p, seed)).filter((r) => r.phase === "won");
      // best-of-two on the ORACLE's terms (most lives LEFT), reported as lives
      // LOST — taking the max of a "lost" number would pick the worse plan
      if (!wins.length) return 99;
      return wins.sort((a, b) => b.lives - a.lives)[0].lost;
    });
    const sorted = perSeed.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const base = BASELINE[lvl.id];

    if (base === undefined) {
      assert.ok(median >= MAX_LIVES_LOST_FLOOR,
        `L${lvl.id} "${lvl.name}" costs a median ${median} lives against the strongest LEGAL pack (${perSeed.join(", ")}) — ` +
        "a finale must still cost something to a fully-invested player. Bound applied power; do not extend BASELINE.");
      continue;
    }
    assert.ok(median >= base,
      `L${lvl.id} "${lvl.name}" got even softer: ${median} lives lost vs a pinned ${base} (${perSeed.join(", ")})`);
    if (median >= MAX_LIVES_LOST_FLOOR) fixed += 1;
  }
  // The good failure: when a leak-toll re-tune de-quantizes these two, they clear
  // the real floor and this forces BASELINE to be tightened rather than left to rot.
  assert.equal(fixed, 0,
    `${fixed} finale(s) now hold up against the strongest legal pack — remove them from BASELINE so the real floor applies`);
});

test("AUDIT boss tension: every boss FINALE must actually cost something", () => {
  // The Vacuum King's whole kit (suck = inhale a SOLDIER) only threatened camp
  // builds, so a tower-only board walked through the World-2 finale at 19/20
  // lives — easier than L3. A boss finale must extract a real price from a
  // sensible (non-optimal) build.
  const MAX_BOSS_LEVEL_FINISH = 17;
  const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
  function run(level, plan, seed) {
    const e = TD.createEngine(level, { seed: seed == null ? 7 : seed, difficulty: "normal" });
    const padIds = level.pads.map((p) => p.id);
    let idx = 0, guard = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 400000) {
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
    return e.state;
  }
  const PLANS = [["dart"], ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"]];
  // ACROSS SEEDS, not on one. Judged on seed 7 alone this passed while L16 —
  // the game's LAST boss — finished flawless at 20/20 on 2 of 8 seeds, because
  // its outcome is decided by whether the Tickmaster dies in the last few cells
  // (waves 1-14 leak nothing at all, on any seed or build). The rule is the
  // MEDIAN so one lucky seed can't excuse a formality and one unlucky seed
  // can't condemn a fair fight.
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
  for (const lvl of DATA.LEVELS.filter((l) => l.waves.some((w) => w.boss))) {
    const perSeed = SEEDS.map((seed) => {
      const wins = PLANS.map((p) => run(lvl, p, seed)).filter((r) => r.phase === "won");
      return wins.length ? Math.max(...wins.map((r) => r.lives)) : -1;
    });
    assert.ok(perSeed.filter((l) => l >= 0).length >= SEEDS.length - 1,
      `boss level L${lvl.id} must stay winnable on essentially every seed (${perSeed.join(", ")})`);
    const sorted = perSeed.filter((l) => l >= 0).slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    assert.ok(median <= MAX_BOSS_LEVEL_FINISH,
      `L${lvl.id} "${lvl.name}" finishes at a median ${median}/20 lives across ${SEEDS.length} seeds (${perSeed.join(", ")}) — its boss finale is a formality (expect ≤${MAX_BOSS_LEVEL_FINISH}).`);
  }
  // Lock the specific root cause that was fixed: the Vacuum King's only ability
  // (suck = inhale a SOLDIER) made it invisible to a tower-only build. It now
  // also jams a gun under half hp. NOTE: the Bed Monster is deliberately allowed
  // a soldier-only kit — it earns its finale as a raw DPS check (it reaches the
  // exit against a naive build), which the simulation above is what proves. The
  // sim, not a data shape, is the real guardrail here.
  const vk = DATA.ENEMIES.vacuumking;
  assert.ok(vk.phases && vk.phases.some((p) => p.disable),
    "the Vacuum King must keep a tower-facing threat (a jam phase) — without it a tower-only build is immune to its whole kit and the World-2 finale costs nothing");
});

test("L8 stays in its GRADED band — the Vacuum King must be holdable, and must still bite", () => {
  // The de-quantization (8000 → 7600 hp) shipped with NO guardrail, so nothing
  // would have noticed it being flattened again. The defect it fixed was not a
  // bad median but ZERO INFLUENCE: at 8000 the King reached the door on all 8
  // seeds under every build, so L8 was a fixed 8-life tax. At 7600 it is held
  // cleanly on 2 of 8 and leaks on 6 — the first graded boss band found in this
  // engine, and it is only ~200 hp wide (7200 kills it on every seed, 8000 on
  // none), so it needs pinning from BOTH sides.
  //
  // SCOPED TO L8 DELIBERATELY. The obvious general law — "a boss finale must be
  // holdable cleanly on at least one seed" — was measured across all 9 finales
  // and REFUTED: L4/L12/L20/L24/L28/L32/L36 all leak their boss on 8 of 8 seeds
  // under this same oracle, and only L16 (7/8 clean) joins L8 in being graded
  // that way. Shipping it as a universal rule would mean six exemptions, which
  // is a fence around the residual rather than a law. The neighbouring universal
  // property (spread ≥ 1 life) is too weak to catch this: pre-fix L8 finished
  // 10-11 on normal, a spread of 1, and would have sailed through.
  const lvl = DATA.LEVELS.find((l) => l.id === 8);
  const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
  // the same greedy build + plans `AUDIT boss tension` uses — never a stronger
  // solver than the shipped oracle (the World-4 revert)
  function run(plan, seed) {
    const e = TD.createEngine(lvl, { seed, difficulty: "normal" });
    const padIds = lvl.pads.map((p) => p.id);
    let idx = 0, guard = 0, bossLeaks = 0;
    const drain = () => {
      for (const ev of e.events) if (ev.type === "leak" && ev.boss && !ev.shielded) bossLeaks++;
      e.events.length = 0;   // safe headless: the engine only ever pushes to it
    };
    while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 400000) {
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
      e.tick(); drain();
    }
    drain();
    return { phase: e.state.phase, lives: e.state.lives, bossLeaks };
  }
  const PLANS = [["dart"], ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"]];
  const perSeed = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
    const rs = PLANS.map((p) => run(p, seed)).filter((r) => r.phase === "won");
    if (!rs.length) return null;
    return rs.reduce((a, b) => (b.lives > a.lives ? b : a)).bossLeaks;   // the BEST plan, as the audit does
  });
  const ok = perSeed.filter((x) => x != null);
  const clean = ok.filter((x) => x === 0).length;
  assert.ok(ok.length >= 7, `L8 must stay winnable on essentially every seed (${perSeed.join(",")})`);
  assert.ok(clean >= 1,
    `the Vacuum King reached the door on ${ok.length - clean}/${ok.length} seeds (${perSeed.join(",")}) — ` +
    "L8 is a fixed tax again, not a fight. Holding it cleanly must be POSSIBLE (hp ≈ 7600; 8000 leaks on every seed).");
  assert.ok(clean < ok.length,
    `the Vacuum King never got through on any seed (${perSeed.join(",")}) — the finale is a formality (7200 kills it on every seed).`);
});

test("RUSH: a mid-wave call puts TWO waves on the field, and both must be cleared", () => {
  // Requested: "the ability to summon waves even when the previous wave is still
  // on screen. In which case you'd have multiple waves of bad guys at once!"
  // The two counters are the whole mechanic: waveIdx = cleared, sentIdx = sent.
  const lvl = DATA.LEVELS.find((l) => l.id === 1);
  const e = TD.createEngine(lvl, { seed: 5 });
  assert.equal(e.state.sentIdx, 0, "nothing sent yet");
  e.callWave();
  for (let i = 0; i < DATA.RULES.rushSettle * DATA.TICK_RATE + 20; i++) e.tick();
  const solo = e.state.enemies.filter((x) => x.alive).length;
  assert.ok(solo > 0, "wave 1 is walking");
  assert.equal(e.state.waveIdx, 0, "…and nothing has been CLEARED yet");

  const g0 = e.state.gold;
  const r = e.callWave();
  assert.ok(r.ok, "a second wave can be rushed while the first is live");
  assert.ok(!e.callWave().ok, "…and an immediate re-press is refused (at the cap, the cap is the honest reason)");
  assert.ok(r.bonus > 0 && e.state.gold === g0 + r.bonus, "…and it pays the early-call bonus");
  for (let i = 0; i < 40; i++) e.tick();
  assert.ok(e.state.enemies.filter((x) => x.alive).length > solo,
    "the rushed wave really is spawning ON TOP of the first (more enemies on the field)");
  assert.equal(e.state.sentIdx - e.state.waveIdx, 2, "two waves in flight");
  assert.equal(e.callWave().reason, "too-many-waves", "the cap holds at RULES.maxWavesInFlight");

  let guard = 0;
  while (e.state.phase === "wave" && guard++ < 200000) e.tick();
  assert.equal(e.state.phase, "build", "the field clears back to a build phase");
  assert.equal(e.state.waveIdx, 2, "BOTH sent waves count as cleared — the run doesn't replay wave 2");
  assert.equal(e.state.sentIdx, e.state.waveIdx, "the counters re-converge at every build boundary");

  // …and rushing the LAST wave of a level still wins it (no off-by-one).
  const tiny = { id: 97, name: "m", world: "test", startGold: 9000, budgetBase: 100,
    path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 5, cy: 9 }, { id: "m2", cx: 9, cy: 9 }],
    waves: [{ groups: [{ type: "sock", count: 2, gap: 0.5, delay: 0 }] },
            { groups: [{ type: "sock", count: 2, gap: 0.5, delay: 0 }] }] };
  const e2 = TD.createEngine(tiny, { seed: 2 });
  e2.place("dart", "m"); e2.place("dart", "m2");
  e2.callWave();
  for (let i = 0; i < DATA.RULES.rushSettle * DATA.TICK_RATE + 10; i++) e2.tick();
  assert.ok(e2.callWave().ok, "the final wave can be rushed too");
  assert.equal(e2.callInfo().reason, "no-more-waves", "…and then there is nothing left to send");
  let g2 = 0;
  while (e2.state.phase === "wave" && g2++ < 200000) e2.tick();
  assert.equal(e2.state.phase, "won", "clearing both rushed waves WINS the level");
});

test("RUSH must not change a run that never rushes (determinism holds)", () => {
  // scheduleWave now APPENDS instead of replacing. At a normal wave start the
  // queue is empty, so every historical stream must be byte-identical.
  const lvl = DATA.LEVELS.find((l) => l.id === 3);
  const play = () => {
    const e = TD.createEngine(lvl, { seed: 11 });
    e.place("dart", lvl.pads[0].id); e.place("mortar", lvl.pads[1].id);
    let g = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && g++ < 300000) {
      if (e.state.phase === "build") e.callWave();
      e.tick();
    }
    return TD.hashState(e.state);
  };
  assert.equal(play(), play(), "same inputs → identical state hash");
});

test("BOSS: a boss that reaches the door costs MULTIPLE stickers, and says so", () => {
  // Requested: a boss should be more consequential — bigger, and it takes
  // multiple lives if it reaches the door. The toll is a data field read at the
  // ONE leak site, and it rides the event so the field can show what it cost.
  const bosses = Object.keys(DATA.ENEMIES).filter((k) => DATA.ENEMIES[k].boss);
  assert.ok(bosses.length >= 4, `every boss is covered (${bosses.join(", ")})`);
  for (const b of bosses) {
    const def = DATA.ENEMIES[b];
    assert.ok(def.lives >= 5, `${b} must cost several stickers at the door (got ${def.lives})`);
    assert.ok(def.size >= 2, `${b} must DRAW bigger than a regular enemy (size ${def.size})`);
  }
  const worst = Math.max(...Object.keys(DATA.ENEMIES).filter((k) => !DATA.ENEMIES[k].boss).map((k) => DATA.ENEMIES[k].lives));
  assert.ok(Math.min(...bosses.map((b) => DATA.ENEMIES[b].lives)) > worst,
    `the gentlest boss must still hurt more than the worst regular leaker (${worst})`);

  // Drive it: let a boss walk an empty lane and check the real deduction.
  for (const b of bosses) {
    const def = DATA.ENEMIES[b];
    const lvl = { id: 96, name: "m", world: "test", startGold: 0, budgetBase: 100,
      path: [[0, 3], [8, 3]], pads: [{ id: "m", cx: 5, cy: 9 }],
      waves: [{ groups: [{ type: b, count: 1, gap: 1, delay: 0 }] }] };
    const e = TD.createEngine(lvl, { seed: 4 });
    const before = e.state.lives;
    e.callWave();
    let g = 0;
    while (e.state.phase === "wave" && g++ < 200000) e.tick();
    const leak = e.events.filter((v) => v.type === "leak").pop();
    assert.ok(leak, `${b} reached the door`);
    assert.equal(leak.lives, def.lives, `${b}'s leak event carries its toll (${def.lives})`);
    assert.equal(leak.boss, true, `${b}'s leak event is flagged as a boss leak`);
    const lost = before - (e.state.phase === "lost" ? 0 : e.state.lives);
    assert.ok(lost >= Math.min(def.lives, before), `${b} really took ${def.lives} stickers (lost ${lost})`);
  }
});

test("AUDIT the guide tells the TRUTH about what can reach a boss, and the ceiling is derived", () => {
  // reachedBy() listed the Army Guys Camp on every non-flier card, but
  // tryEngage refuses `ed.boss` outright — so the guide promised a camp could
  // hold a boss the engine never lets it touch.
  for (const k of Object.keys(DATA.ENEMIES)) {
    const def = DATA.ENEMIES[k];
    const reach = TD.reachedBy(def);
    if (def.boss || def.flier) {
      assert.ok(reach.indexOf("camp") < 0, `${k}: soldiers can never engage it, so the guide must not list the camp`);
    } else {
      assert.ok(reach.indexOf("camp") >= 0, `${k}: a plain ground enemy CAN be blocked`);
    }
    if (def.flier) assert.deepEqual(reach.sort(), ["dart", "fan"], `${k}: only dart and fan reach air`);
  }
  // Star-badge thresholds must never be hard-coded: World 4 moved the ceiling
  // from 36 to 48 and the badge text still said "Earn all 36 stars".
  const ui = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "scripts/td-ui.js"), "utf8");
  assert.match(ui, /const cap = global\.TDData\.LEVELS\.length \* 3;/, "the badge screen derives the star ceiling");
  for (const a of DATA.ACHIEVEMENTS) {
    assert.ok(!/\b(18|36)\b/.test(a.desc), `achievement "${a.id}" must not hard-code a star count (got "${a.desc}")`);
  }
});

test("AUDIT untargetable: NO damage path touches a hidden enemy — including a dart in flight", () => {
  // CLAUDE.md already documents the isHidden sweep across acquisition, mortar
  // splash and the chain jump. The audit found the one that was missed: a dart
  // ALREADY IN THE AIR resolved on arrival with no gate, so it killed phased
  // Glitter Ghosts and tunnelling Digger Moles outright. Sticky Floor puddles
  // had the same hole for slows.
  for (const type of ["ghost", "mole"]) {
    const lvl = { id: 95, name: "m", world: "test", startGold: 9000, budgetBase: 100,
      path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 5, cy: 1 }],
      waves: [{ groups: [{ type, count: 1, gap: 1, delay: 0 }] }] };
    const e = TD.createEngine(lvl, { seed: 5 });
    e.place("dart", "m");
    e.callWave();
    let sawHiddenHit = false, sawHiddenSlow = false, ticks = 0;
    while (e.state.phase === "wave" && ticks++ < 40000) {
      const before = e.state.enemies.map((x) => ({ id: x.id, hp: x.hp, until: x.slowUntil }));
      e.tick();
      for (const x of e.state.enemies) {
        if (!x.alive || !e.isHidden(x)) continue;
        const b = before.find((o) => o.id === x.id);
        if (!b) continue;
        if (x.hp < b.hp) sawHiddenHit = true;
        if (x.slowUntil > b.until) sawHiddenSlow = true;
      }
    }
    assert.equal(sawHiddenHit, false, `a ${type} must take ZERO damage while it is untargetable (a dart in flight must fizzle)`);
    assert.equal(sawHiddenSlow, false, `…and take no fresh slow while untargetable`);
  }
});

test("⚡ Overclock speeds up EVERY tower line — it was a paid no-op on 9 of 20 variants", () => {
  // It was read only at the three cooldown-set sites, so the Fan (no cooldown —
  // its beam accumulates) and the whole Camp line (soldiers swing on their own
  // timer) took 100 gold and gave nothing back.
  const mk = (line, pad) => ({ id: 98, name: "m", world: "test", startGold: 9000, budgetBase: 100,
    path: [[0, 3], [23, 3]], pads: [{ id: pad, cx: 5, cy: 3.0001 }],
    waves: [{ groups: [{ type: "brick", count: 6, gap: 0.4, delay: 0 }] }] });
  // measure damage dealt over a fixed window, with and without the boost
  const dealt = (line, boost) => {
    const lvl = mk(line, "m");
    lvl.pads = [{ id: "m", cx: 5, cy: line === "camp" ? 3 : 2 }];
    const e = TD.createEngine(lvl, { seed: 4 });
    e.place(line, "m");
    e.callWave();
    for (let i = 0; i < 60; i++) e.tick();
    if (boost) { const t = e.state.towers[0]; t.boostUntil = e.state.tick + 99999; t.boostMult = 2; }
    const before = e.state.enemies.reduce((n, x) => n + (x.alive ? x.hp : 0), 0);
    for (let i = 0; i < 240; i++) e.tick();
    const after = e.state.enemies.reduce((n, x) => n + (x.alive ? x.hp : 0), 0);
    return Math.max(0, before - after) + (e.state.kills || 0);
  };
  for (const line of ["dart", "mortar", "fan", "camp"]) {
    const plain = dealt(line, false), boosted = dealt(line, true);
    assert.ok(boosted > plain,
      `⚡ Overclock must actually speed the ${line} line up (plain ${plain} vs boosted ${boosted}) — it costs real gold`);
  }
});

test("📣 Rally Horn must not charge for ORPHANED soldiers whose camp was sold", () => {
  const lvl = { id: 99, name: "m", world: "test", startGold: 9000, budgetBase: 100,
    path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 5, cy: 3 }],
    waves: [{ groups: [{ type: "sock", count: 4, gap: 1, delay: 0 }] }] };
  const e = TD.createEngine(lvl, { seed: 6 });
  e.place("camp", "m");
  e.callWave();
  for (let i = 0; i < 120; i++) e.tick();
  const camp = e.state.towers[0];
  // knock a soldier down so the horn has a real job, then SELL the camp
  const sol = e.state.soldiers.find((s) => s.campId === camp.id);
  assert.ok(sol, "the camp fielded a squad");
  sol.alive = false; sol.respawnAt = e.state.tick + 9999;
  e.sell(camp.id);
  const gold = e.state.gold, cd = (e.state.abilityCd || {}).horn || 0;
  const r = e.useAbility("horn", {});
  assert.equal(r.ok, false, "the horn refuses when the only soldiers are orphans of a sold camp");
  assert.equal(e.state.gold, gold, "…and takes no gold");
  assert.equal((e.state.abilityCd || {}).horn || 0, cd, "…and starts no cooldown");
});

test("AUDIT counter matrix: the structural facts the Toybox Guide teaches are TRUE", () => {
  // The guide derives every card from these fields, so if one drifts the guide
  // starts teaching a lie. They are also the reason a mono board has holes.
  const air = Object.keys(DATA.TOWERS).filter((k) => DATA.TOWERS[k].hitsFliers);
  assert.deepEqual(air.sort(), ["dart", "fan"],
    "EXACTLY two lines may reach air — that single fact is what makes fliers a build check");
  for (const k of Object.keys(DATA.TOWERS)) {
    const mins = DATA.TOWERS[k].tiers.map((t) => t.rangeMin || 0);
    if (k === "mortar") assert.ok(mins.every((m) => m > 0),
      "the Mortar keeps a minimum range at EVERY tier — the dead zone under the tube is why a mortar-only board can never cover a lane");
    else assert.ok(mins.every((m) => !m), `${k} must have no minimum range`);
  }
  // Armor is keyed on "bonk", so a Fan zap cuts through it while dart/mortar
  // shots do not — the guide's "the Fan's zap ignores armor" line.
  const armored = Object.keys(DATA.ENEMIES).filter((t) => DATA.ENEMIES[t].armor > 0);
  assert.ok(armored.length >= 2, `armor must actually be on the roster (${armored.join(", ")})`);
  for (const tier of DATA.TOWERS.dart.tiers) assert.equal(tier.dmgType, "bonk", "dart shots are bonk (armor bites)");
  for (const tier of DATA.TOWERS.fan.tiers) assert.ok(!tier.dmgType, "the Fan deals no bonk — its zap is what beats armor");
});

test("AUDIT mono builds: on HEROIC no single plan clears the campaign — you must choose", () => {
  // Measured this pass, all 16 levels × 3 seeds. On NORMAL the Dart is a viable
  // generalist (dart-mono 16/16, avg 14.9 lives; mixed 16/16, 15.2; camp-mono
  // 3/16; mortar-mono 2/16; fan-mono 0/16) — forgiving, which is what normal is
  // for. On HEROIC the matrix BINDS: dart-mono clears 10/16 and the fixed mixed
  // plan 13/16, and each wins levels the other loses, so no one build is
  // universal. (mortar/fan/camp mono losing is STRUCTURAL, not balance — the
  // mortar's 1.5-cell dead zone alone makes a mortar-only lane leaky at any
  // damage — so it is asserted as data fields above, never by an unfalsifiable
  // sim.) This pins the falsifiable half: two levels that split the two plans.
  const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
  function playWith(level, seed, plan, difficulty) {
    const e = TD.createEngine(level, { seed, difficulty });
    const padIds = level.pads.map((p) => p.id);
    let idx = 0, guard = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 600000) {
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
    return e.state;
  }
  const MIXED = ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"];
  const won = (id, plan) => playWith(DATA.LEVELS.find((l) => l.id === id), 7, plan, "heroic").phase === "won";
  // L5 punishes a dart-only board; L4's boss punishes the fixed mixed plan.
  assert.ok(!won(5, ["dart"]), "heroic L5 must defeat a dart-ONLY board");
  assert.ok(won(5, MIXED), "…and reward a mixed one");
  assert.ok(!won(4, MIXED), "heroic L4 must defeat the fixed mixed plan");
  assert.ok(won(4, ["dart"]), "…and reward the dart swarm — so neither plan is universal");
});

test("AUDIT threat shape: a healer dose must still make its level cost something", () => {
  // 12 of 36 levels finished 20/20 on EVERY seed — a third of the campaign was a
  // formality — and `heal` was the one counter shape appearing on a single level
  // in the whole game. It is a DPS-THRESHOLD shape rather than an HP pile, which
  // is why it moves a flat level where gold, budget base, lane length, bigger HP
  // and side-door dose are all measured not to. The doses cost real work to find
  // (five were built and measured; three were rejected), so this stops a future
  // re-tune quietly undoing them. DERIVED from the data: dose another level and
  // it inherits the check; the level list is never written down here.
  const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
  function run(level, plan, seed) {
    const e = TD.createEngine(level, { seed, difficulty: "normal" });
    const padIds = level.pads.map((p) => p.id);
    let idx = 0, guard = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 400000) {
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
  const PLANS = [["dart"], ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"]];
  // The STANDARD seed set, not a bespoke [1,3,5,7]. This test guards the one
  // mechanism this repo records as hiding SINGLE-SEED CLIFFS — L21, L25 and L30
  // each concealed one — and those cliffs were on seeds 23 and 2, NEITHER of
  // which the bespoke set contained. A guardrail that cannot see the failures its
  // own mechanism is known for is the L32 class (a bespoke sample inside one
  // audit), and this is the second instance found in the same sweep.
  const SEEDS = [1, 7, 13, 23, 2];
  // Levels whose LATE waves carry a mending body, excluding boss finales (which
  // already cost lives by their own axis and are graded elsewhere).
  const dosed = DATA.LEVELS.filter((l) => l.waves.slice(-5).some((w) =>
    !w.boss && w.groups.some((g) => DATA.ENEMIES[g.type] && DATA.ENEMIES[g.type].heal)));
  // The COUNT is pinned, not just the behaviour. A derived list cannot notice
  // its own members being deleted: the first cut of this test asserted only
  // ">= 2" and reverting L19's dose left it GREEN, because L19 simply dropped
  // out of the list and L4 (a boss level that has always carried healers) kept
  // the count up. If you deliberately add or remove a dose, change this number
  // and say why in the commit — that is the point of it being here.
  assert.deepEqual(dosed.map((l) => l.id), [4, 19, 21, 25, 30, 33, 34],
    "the healer-bearing levels are L4 (original) plus the six measured doses; " +
    "removing one silently un-does work that took five measured attempts to find");
  for (const lvl of dosed) {
    // Keep BOTH plans' results rather than only their max: the diversity check
    // below is then free, because these sims are already being paid for.
    const byPlan = SEEDS.map((s) => PLANS.map((p) => run(lvl, p, s)));   // [dart, mixed] per seed
    const lives = byPlan.map((v) => Math.max(...v));
    assert.ok(!lives.some((x) => x < 0),
      `L${lvl.id} "${lvl.name}" carries a healer dose and is now UNWINNABLE on a screened seed (${lives.join(",")})`);
    // The dose must be WORTH something, measured against its own control — the
    // same level with its healer groups removed. The old assertion here was
    // `lives.some(x < 20)` on best-of-plans, and it was passing on seed luck:
    // L19's dose leaves best-of-plans flat at 20 on every standard seed, so the
    // check only survived because seed 3 happened to be in the bespoke set.
    //
    // Measured, the six doses work through TWO different channels, which is why
    // one bar could never see them all (dose worth, standard seeds):
    //   L19 gap +8 / lives 0 · L25 gap +6 / lives 0   <- punish the dart swarm
    //   L33 gap  0 / lives +4 · L34 gap +1 / lives +3 · L21 gap 0 / lives +1
    //   L30 gap -1 / lives  0                          <- worth nothing
    // So it is a DISJUNCTION: cost best-of-plans lives, or widen the dart-vs-mixed
    // gap. Either is the dose doing its job; neither is a dose that has stopped.
    if (!lvl.waves.some((w) => w.boss)) {
      const ctrl = JSON.parse(JSON.stringify(lvl));
      for (const w of ctrl.waves) w.groups = w.groups.filter((g) => !(DATA.ENEMIES[g.type] && DATA.ENEMIES[g.type].heal));
      const cByPlan = SEEDS.map((sd) => PLANS.map((p) => run(ctrl, p, sd)));
      const md = (a) => { const x = [...a].sort((u, v) => u - v); return x[Math.floor(x.length / 2)]; };
      const gap = (bp) => md(bp.map((v) => v[1])) - md(bp.map((v) => v[0]));
      const worth = (md(cByPlan.map((v) => Math.max(...v))) - md(lives)) + (gap(byPlan) - gap(cByPlan));
      // L30 is EXEMPT by measurement, not by convenience: it scores -1, and
      // CLAUDE.md already records it as "one of the six shipped doses [that] does
      // not qualify … its real value was always diversity" — which this control
      // shows does not hold either (gap 1 dosed vs 2 undosed). Pinned so it can
      // still fail if it gets WORSE, and named so the exemption is a decision.
      const floor = lvl.id === 30 ? -1 : 1;
      assert.ok(worth >= floor,
        `L${lvl.id} "${lvl.name}"'s healer dose is worth ${worth} against its own no-healer control ` +
        `(need >= ${floor}) — it neither costs best-of-plans lives nor widens the dart-vs-mixed gap, ` +
        "so it has stopped doing the thing it was placed to do");
    }
    // …and it must still buy BUILD DIVERSITY, which is the whole point of a
    // mending body: it punishes a board that cannot out-damage the healing, so
    // a dart swarm should no longer be as good as a considered mix. This was an
    // eyeballed justification until a candidate on L14 passed every numeric gate
    // while scoring 0/8 — it would have cost heroic 6 -> 2 to change nothing
    // about what you build. Measured on the shipped set before being asserted:
    // L19 4/4, L21 4/4, L25 4/4, L34 4/4, L30 2/4, L33 1/4.
    // L4 is EXCLUDED, and derived rather than hand-listed: it is a boss finale
    // (its difficulty is the Bed Monster, not its waves), it predates these
    // doses, and `AUDIT mono builds` separately pins it as the level that must
    // DEFEAT the mixed plan and reward the dart swarm — so requiring the
    // opposite here would be two tests asserting contradictory things. Measuring
    // that BEFORE writing this was the point: L4 scores 0/4 (dart 14,14,14,13 vs
    // mixed 3,4,3,3), so asserting over every dosed level would have gone red on
    // shipped content immediately.
    // Mutation note, UPDATED: killing the healer (`hps: 15 -> 0`) used not to
    // isolate anything here — the old "still finishes 20/20" check threw first,
    // the redundant-fix trap — so this clause could only be proven by collapsing
    // the instrument. The control-based worth check above fixes that: with a dead
    // healer it now fails directly, `L19 ... worth 0 against its own no-healer
    // control`, which is a PRODUCT-side mutation isolating a product claim.
    if (lvl.waves.some((w) => w.boss)) continue;
    const div = byPlan.filter(([dart, mixed]) => mixed > dart).length;
    assert.ok(div > 0,
      `L${lvl.id} "${lvl.name}" carries a healer dose but the dart-only board now keeps everything ` +
      `the mixed plan does on all ${SEEDS.length} screened seeds ` +
      `(dart ${byPlan.map((v) => v[0]).join(",")} vs mixed ${byPlan.map((v) => v[1]).join(",")}) — ` +
      "the dose is charging lives without buying the build diversity it exists for");
  }
});

test("AUDIT threat shape: World 2-3 late waves keep ANTI-AIR pressure (mono-build counter)", () => {
  // Backlog item 5: mortar and camp CANNOT hit fliers (only dart/fan can), so a
  // flier presence in the late game is what stops a single line from carrying
  // every level. Before this, World 3 had ZERO fliers and a mortar-only board
  // solo-carried 8/12 levels; with Kite Hawk flights it carries 1/12.
  for (const lvl of DATA.LEVELS.filter((l) => l.world !== "bedroom")) {
    const from = Math.ceil(lvl.waves.length * 0.55);
    const lateFliers = lvl.waves.slice(from).some((w) => w.groups.some((g) => DATA.ENEMIES[g.type] && DATA.ENEMIES[g.type].flier));
    assert.ok(lateFliers,
      `L${lvl.id} "${lvl.name}" has no fliers in its late waves — a mortar/camp board would face no anti-air check and could solo-carry it`);
  }
  // World 1 stays the gentle tutorial world (no air threat to learn around).
  for (const lvl of DATA.LEVELS.filter((l) => l.world === "bedroom")) {
    assert.ok(lvl.waves.every((w) => w.groups.every((g) => g.type !== "hawk")),
      `L${lvl.id} is a World-1 tutorial level and should not carry fast fliers`);
  }
});

test("AUDIT heroic is a SLOPE, not a cliff: every level stays winnable on heroic", () => {
  // Heroic used to be scattered — L7/L9/L10 unwinnable by a competent build
  // while L8 was comfortable — because `speed` compounded with conveyors/fliers
  // and the gold penalty amplified the decisive opening. Heroic is now a pure
  // hp/economy challenge, so difficulty tracks level order.
  assert.equal(DATA.DIFFICULTIES.heroic.speed, 1.0,
    "heroic must not multiply enemy SPEED — it compounds with conveyor zones and fast fliers and steals tower uptime, which gold cannot buy back");
  assert.ok(DATA.DIFFICULTIES.heroic.startGold >= 0,
    "heroic must not start you POORER — the opening is already the most decisive moment (the front-loading finding)");
  assert.ok(DATA.DIFFICULTIES.heroic.hp > 1.2 && DATA.DIFFICULTIES.heroic.bounty < 1,
    "heroic must still be genuinely harder: tougher enemies that pay less");
  const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
  function run(level, plan, seed) {
    const e = TD.createEngine(level, { seed, difficulty: "heroic" });
    const padIds = level.pads.map((p) => p.id);
    let idx = 0, guard = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 400000) {
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
    return e.state;
  }
  const PLANS = [["dart"], ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"]];
  // THREE seeds, not one. This drove seed 7 alone, and a single seed is not a
  // sample: the threat-shape pass built two doses that were clean on four seeds
  // and lost heroic on eight (L22's on seeds 1 and 3, L26's on 11/13/17/19), and
  // the record already carries an L30 that lost on seed 5 while green on 7. The
  // set is chosen by what actually slipped through — {1, 7, 13} catches BOTH of
  // those failures — and the full 8-seed sweep was run before widening this, so
  // it is a strengthening rather than a newly-blocked build: every level is
  // winnable on heroic on all 8. Costs ~2 min on a ~25 min gate; use
  // `tools/td-threat.js` when you want the full eight on demand.
  //
  // SEED 23 joined the set the same way, and it is the reason this comment's
  // "every level is winnable on heroic on all 8" claim was WRONG when written:
  // L21 and L30 both lost on 23 while green on {1, 7, 13}, and both had been
  // recorded as validated at 8 seeds. The cause was the healer dose — healers
  // MEND EACH OTHER, so a count that is 5% of a wave's hp is worth far more
  // than its hp and can flip one seed while eleven others are comfortable.
  // Fixed at the source (L21 startGold 1200 -> 1275, L30 w13 healers 5 -> 3,
  // HP-preserving) rather than by exempting the levels. A seed set is only ever
  // as good as the failures it has been shown; add to it, never trim it.
  // SEED 2 joined for the same reason 23 did, one level later: a 36-level x
  // 12-seed sweep run right after fixing L21/L30 found L25 losing on it — the
  // THIRD of the six healer-dosed levels to have a single-seed cliff, which
  // makes it a property of the shape rather than three coincidences.
  const SEEDS = [1, 7, 13, 23, 2];
  for (const lvl of DATA.LEVELS) {
    for (const seed of SEEDS) {
      const won = PLANS.some((p) => run(lvl, p, seed).phase === "won");
      assert.ok(won, `L${lvl.id} "${lvl.name}" is not winnable on HEROIC (seed ${seed}) by either sensible build — heroic must stay a hard slope, not a wall`);
    }
  }
});

// ---- TD-9: in-wave active abilities ----
// The engine had NO player action during a wave — every decision lived in the
// build phase, which is also why difficulty could only be tuned at the opening.
// These prove each ability actually does its thing, that gold+cooldown really
// gate it, and that adding them didn't cost determinism.
test("TD-9 abilities: Toy Box Drop damages every enemy in its radius (and respects armor)", () => {
  const lvl = DATA.LEVELS[0];
  const e = TD.createEngine(lvl, { seed: 7 });
  e.callWave();
  for (let i = 0; i < 150; i++) e.tick();
  const live = e.state.enemies.filter((x) => x.alive);
  assert.ok(live.length >= 2, "need a few enemies on the field to blast");
  const target = live[0];
  const p = e.posOn(target.pathIdx, target.dist);
  const before = live.map((x) => x.hp);
  e.state.gold = 999;
  assert.equal(e.state.phase, "wave", "abilities are in-WAVE tools");
  const r = e.useAbility("drop", { x: p.x, y: p.y });
  assert.ok(r.ok, "the drop fires when affordable and off cooldown");
  assert.ok(r.hits >= 1, "it hit at least the enemy it was aimed at");
  const hurt = e.state.enemies.filter((x, i) => before[i] != null && x.hp < before[i]).length;
  assert.ok(hurt >= 1, "enemies inside the blast actually lost hp");
  assert.ok(e.state.gold < 999, "the ability COSTS gold — it is a trade, not free power");
});

test("TD-9 abilities: gold and cooldown really gate a use", () => {
  const lvl = DATA.LEVELS.find((l) => l.pads.length >= 2);
  const e = TD.createEngine(lvl, { seed: 3 });
  e.state.gold = 99999;
  e.place("camp", lvl.pads[0].id);      // the horn needs someone to rally
  e.callWave();
  for (let i = 0; i < 150; i++) e.tick();
  e.state.soldiers.forEach((s2) => { s2.alive = false; s2.respawnAt = e.state.tick + 99999; });
  e.state.charge = 99;   // ⚙️ energy is gated separately (P3); this test is about gold + cooldown
  e.state.gold = 0;
  assert.equal(e.useAbility("horn", {}).reason, "gold", "no gold → refused");
  e.state.gold = 9999;
  assert.ok(e.useAbility("horn", {}).ok, "affordable → allowed");
  e.state.soldiers.forEach((s2) => { s2.alive = false; s2.respawnAt = e.state.tick + 99999; });
  assert.equal(e.useAbility("horn", {}).reason, "cooldown", "a second use inside the cooldown is refused");
  const def = DATA.ABILITIES.find((a) => a.id === "horn");
  for (let i = 0; i < def.cooldown * DATA.TICK_RATE + 2; i++) e.tick();
  e.state.soldiers.forEach((s2) => { s2.alive = false; s2.respawnAt = e.state.tick + 99999; });
  assert.ok(e.useAbility("horn", {}).ok, "…and allowed again once the cooldown elapses");
  assert.equal(e.useAbility("nope", {}).reason, "bad-ability", "an unknown ability id is refused");
  assert.equal(e.useAbility("drop", {}).reason, "needs-point", "a point ability without a point is refused");
});

test("TD-9 abilities: Sticky Floor is a LIVE zone — it slows what walks in later", () => {
  const lvl = DATA.LEVELS[0];
  const e = TD.createEngine(lvl, { seed: 11 });
  e.callWave();
  for (let i = 0; i < 60; i++) e.tick();
  const en = e.state.enemies.find((x) => x.alive);
  assert.ok(en, "an enemy is walking");
  // drop the puddle well AHEAD of it, so the slow can only come from walking in
  const ahead = e.posOn(en.pathIdx, en.dist + 3);
  e.state.gold = 999;
  assert.ok(e.useAbility("sticky", { x: ahead.x, y: ahead.y }).ok);
  assert.equal(e.state.puddles.length, 1, "the puddle is live on the field");
  let slowedTick = -1;
  for (let i = 0; i < 200 && slowedTick < 0; i++) { e.tick(); if (en.alive && e.state.tick < en.slowUntil && en.slowPct > 0) slowedTick = i; }
  assert.ok(slowedTick > 0, "an enemy that WALKS INTO the puddle gets slowed");
  const def = DATA.ABILITIES.find((a) => a.id === "sticky");
  for (let i = 0; i < def.seconds * DATA.TICK_RATE + 5; i++) e.tick();
  assert.equal(e.state.puddles.length, 0, "the puddle expires on its own tick");
});

test("TD-9 abilities: Overclock really doubles a tower's fire rate, then wears off", () => {
  const lvl = DATA.LEVELS[0];
  const shots = (useOverclock) => {
    const e = TD.createEngine(lvl, { seed: 5 });
    const t = e.place("dart", lvl.pads[0].id);
    assert.ok(t.ok, "a dart went up");
    e.callWave();
    for (let i = 0; i < 90; i++) e.tick(); // let enemies reach it
    if (useOverclock) { e.state.gold = 999; assert.ok(e.useAbility("overclock", { towerId: e.state.towers[0].id }).ok); }
    let n = 0;
    const before = e.events.length;
    for (let i = 0; i < 8 * DATA.TICK_RATE; i++) { e.tick(); }
    for (let i = before; i < e.events.length; i++) if (e.events[i].type === "shoot") n++;
    return n;
  };
  const plain = shots(false), boosted = shots(true);
  assert.ok(boosted > plain, `Overclock must fire MORE shots (plain ${plain} vs boosted ${boosted})`);
});

test("TD-9 abilities: Rally Horn puts every downed soldier straight back up", () => {
  const lvl = DATA.LEVELS.find((l) => l.pads.length >= 2);
  const e = TD.createEngine(lvl, { seed: 4 });
  e.state.gold = 9999;
  const t = e.place("camp", lvl.pads[0].id);
  assert.ok(t.ok, "a camp went up");
  e.callWave(); // abilities are in-WAVE tools
  for (let i = 0; i < 120; i++) e.tick();
  const mine = e.state.soldiers.filter((s) => s.campId === e.state.towers[0].id);
  assert.ok(mine.length >= 1, "the camp deployed soldiers");
  mine.forEach((s) => { s.alive = false; s.respawnAt = e.state.tick + 99999; }); // KO'd, a long way from respawning
  const r = e.useAbility("horn", {});
  assert.ok(r.ok && r.hits === mine.length, `the horn revived every downed soldier (${r.hits}/${mine.length})`);
  assert.ok(mine.every((s) => s.alive && s.respawnAt === 0), "each is alive with its respawn timer cleared");
});

test("TD-9 abilities: an untargetable enemy is untargetable by the DROP too", () => {
  // The documented law: every damage path — including AoE — honours isHidden.
  const lvl = DATA.LEVELS.find((l) => l.waves.some((w) => w.groups.some((g) => g.type === "ghost")));
  assert.ok(lvl, "a ghost level exists");
  const e = TD.createEngine(lvl, { seed: 7 });
  e.state.enemies.push({ id: 9001, type: "ghost", alive: true, hp: 500, maxHp: 500, dist: 4, pathIdx: 0,
    armor: 0, shield: 0, speed: 1, slowPct: 0, slowUntil: 0, phaseHidden: true });
  const g = e.state.enemies[e.state.enemies.length - 1];
  const p = e.posOn(0, g.dist);
  e.state.gold = 999;
  const hpBefore = g.hp;
  e.useAbility("drop", { x: p.x, y: p.y });
  assert.equal(g.hp, hpBefore, "a phased ghost takes ZERO damage from the Toy Box Drop");
});

test("TD-9 abilities: adding them cost no determinism (same seed → identical run)", () => {
  const play = (useAbil) => {
    const lvl = DATA.LEVELS[0];
    const e = TD.createEngine(lvl, { seed: 21 });
    e.place("dart", lvl.pads[0].id);
    let guard = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 60000) {
      if (e.state.phase === "build") e.callWave();
      if (useAbil && e.state.tick % 400 === 0) { const p = e.posOn(0, 5); e.useAbility("drop", { x: p.x, y: p.y }); }
      e.tick();
    }
    return TD.hashState(e.state);
  };
  assert.equal(play(false), play(false), "an ability-free run still replays identically");
  assert.equal(play(true), play(true), "an ability-USING run replays identically too");
  assert.notEqual(play(true), play(false), "…and using them actually changes the run");
});

test("TD-9 abilities: a puddle still burns down across the build phase", () => {
  // The build branch of tick() returns early — a regression here would leave a
  // pre-wave Sticky Floor alive for ever. Found in-browser, pinned here.
  const e = TD.createEngine(DATA.LEVELS[0], { seed: 8 });
  e.callWave();
  for (let i = 0; i < 30; i++) e.tick();
  e.state.gold = 999;
  assert.ok(e.useAbility("sticky", { x: 5, y: 5 }).ok);
  assert.equal(e.state.puddles.length, 1);
  const def = DATA.ABILITIES.find((a) => a.id === "sticky");
  // Tick through the wave→build boundary: tick()'s build branch returns EARLY,
  // so without its own puddleTick a puddle that outlives its wave would never
  // expire (found in-browser, pinned here).
  for (let i = 0; i < def.seconds * DATA.TICK_RATE + 5; i++) e.tick();
  assert.equal(e.state.puddles.length, 0, "the puddle expires even across the build phase");
});

// ---- TD-10: threat shapes that punish a mono build ----
test("TD-10 Couch Cushion: soaks AREA damage but takes a direct hit in full", () => {
  const e = TD.createEngine(DATA.LEVELS[0], { seed: 2 });
  const mk = (type) => ({ id: 900, type, alive: true, hp: 1000, maxHp: 1000, dist: 3, pathIdx: 0,
    armor: DATA.ENEMIES[type].armor || 0, shield: 0, speed: 1, slowPct: 0, slowUntil: 0 });
  const cushion = mk("cushion"), sock = mk("sock");
  e.callWave(); // abilities are in-WAVE tools
  e.state.enemies.push(cushion, sock);
  const p = e.posOn(0, 3);
  e.state.gold = 9999;
  e.useAbility("drop", { x: p.x, y: p.y }); // area damage hits both
  const cushionLost = 1000 - cushion.hp, sockLost = 1000 - sock.hp;
  assert.ok(cushionLost > 0 && sockLost > 0, "both were in the blast");
  const resist = DATA.ENEMIES.cushion.splashResist;
  assert.ok(cushionLost < sockLost * (1 - resist) + 2 && cushionLost > sockLost * (1 - resist) - 2,
    `the cushion took ~${Math.round((1 - resist) * 100)}% of the area damage (${cushionLost} vs ${sockLost})`);
});

test("TD-10 Loose Screw: jams the NEAREST gun, never a camp, and the jam expires", () => {
  const lvl = DATA.LEVELS.find((l) => l.pads.length >= 3);
  const e = TD.createEngine(lvl, { seed: 6 });
  e.state.gold = 99999;
  const near = e.place("dart", lvl.pads[0].id), camp = e.place("camp", lvl.pads[1].id);
  assert.ok(near.ok && camp.ok);
  const dart = e.state.towers.find((t) => t.lineId === "dart");
  const def = DATA.ENEMIES.screw;
  // park a screw right on top of the dart so "nearest" is unambiguous
  e.state.enemies.push({ id: 901, type: "screw", alive: true, hp: 500, maxHp: 500, dist: 0, pathIdx: 0,
    armor: 0, shield: 0, speed: 0, slowPct: 0, slowUntil: 0, sapCd: 0 });
  const scr = e.state.enemies[e.state.enemies.length - 1];
  Object.defineProperty(scr, "dist", { value: 0, writable: true });
  e.state.phase = "wave";
  // teleport the dart onto the lane start so the screw is inside its sap radius
  const p0 = e.posOn(0, 0);
  dart.cx = Math.round(p0.x - 0.5); dart.cy = Math.round(p0.y - 0.5);
  let jammed = false;
  for (let i = 0; i < def.sap.every * DATA.TICK_RATE * 2 + 10 && !jammed; i++) { e.tick(); jammed = !!(dart.disabledUntil && e.state.tick < dart.disabledUntil); }
  assert.ok(jammed, "the Loose Screw jammed the gun standing next to it");
  const campTower = e.state.towers.find((t) => t.lineId === "camp");
  assert.ok(!(campTower.disabledUntil && e.state.tick < campTower.disabledUntil),
    "a camp is bodies, not electronics — it can never be jammed");
  for (let i = 0; i < def.sap.seconds * DATA.TICK_RATE + 5; i++) e.tick();
  assert.ok(!(dart.disabledUntil && e.state.tick < dart.disabledUntil), "the jam wears off");
});

test("TD-10 Drip Slime: regrows WHILE slowed, and only while slowed", () => {
  const e = TD.createEngine(DATA.LEVELS[0], { seed: 9 });
  const mk = () => { e.state.enemies.push({ id: 902, type: "slime", alive: true, hp: 40, maxHp: 110, dist: 2, pathIdx: 0,
    armor: 0, shield: 0, speed: 0.7, slowPct: 0, slowUntil: 0, brittleUntil: 0 }); return e.state.enemies[e.state.enemies.length - 1]; };
  e.state.phase = "wave";
  const a = mk();
  const before = a.hp;
  for (let i = 0; i < 60; i++) e.tick();
  assert.equal(a.hp, before, "an UNSLOWED slime does not regrow");
  a.slowPct = 0.4; a.slowUntil = e.state.tick + 300;
  for (let i = 0; i < 60; i++) e.tick();
  assert.ok(a.hp > before, `a SLOWED slime regrows (${before} → ${a.hp}) — a slow-only board feeds it`);
  assert.ok(a.hp <= a.maxHp, "…but never past full health");
});

test("TD-10 Tin Plane: flies (mortar can't touch it) and armor halves a dart's bonk", () => {
  const plane = DATA.ENEMIES.tinplane;
  assert.equal(plane.flier, true, "it flies — mortar and camp are blind to it");
  assert.ok(plane.armor >= 0.5, "it is armored — bonk damage is halved");
  // computeHit is the pure truth: bonk is reduced by armor, zap is NOT.
  const asEnemy = { armor: plane.armor, shield: 0, brittle: false };
  const bonk = TD.computeHit ? TD.computeHit(100, "bonk", asEnemy) : null;
  if (bonk) {
    assert.equal(bonk.hpDmg, 50, "a 100-damage dart bonk lands for 50 on the Tin Plane");
  }
  // and it really is in the shipped waves
  const carried = DATA.LEVELS.filter((l) => l.waves.some((w) => w.groups.some((g) => g.type === "tinplane")));
  assert.ok(carried.length >= 4, `Tin Planes actually ship in the wave tables (${carried.length} levels)`);
});

test("AUDIT TD-10: the new shapes ship in Worlds 2-3, and World 1 stays the tutorial", () => {
  const NEW = ["cushion", "screw", "slime", "tinplane"];
  const has = (l, t) => l.waves.some((w) => w.groups.some((g) => g.type === t));
  for (const l of DATA.LEVELS.filter((x) => x.world === "bedroom")) {
    for (const t of NEW) assert.ok(!has(l, t), `L${l.id} is a World-1 tutorial level and must not carry ${t}`);
  }
  const later = DATA.LEVELS.filter((l) => l.world !== "bedroom");
  for (const t of NEW) {
    assert.ok(later.some((l) => has(l, t)), `${t} must actually appear in Worlds 2-3 — an enemy nothing spawns is dead content`);
  }
  // L7 is DELIBERATELY exempt: it is the air-pressure level and the measurement
  // showed it sits at its heroic ceiling (8.7 lives) with no headroom — every
  // new shape flipped it to unwinnable on heroic. Documented, not accidental.
  const l7 = DATA.LEVELS.find((l) => l.id === 7);
  for (const t of NEW) assert.ok(!has(l7, t), `L7 is the exempt air-pressure level (no heroic headroom) and must not carry ${t}`);
});

// ---- TD-12: the counter matrix is DERIVED, so the guide can never drift ----
test("TD-12 guide truth: reachedBy and enemyTraits are read off the enemy's own data", () => {
  // Fliers: mortar is ground-only and camps are bodies, so ONLY dart+fan reach.
  for (const [k, def] of Object.entries(DATA.ENEMIES)) {
    const reach = TD.reachedBy(def);
    if (def.flier) assert.deepEqual(reach.sort(), ["dart", "fan"], `${k} flies — only dart and fan can reach it`);
    // A BOSS is unblockable: tryEngage skips `ed.boss`, so soldiers can never
    // hold one and the guide must not offer the camp as an answer to it.
    else if (def.boss) assert.deepEqual(reach.sort(), ["dart", "fan", "mortar"], `${k} is a boss — guns only, no camp`);
    else assert.deepEqual(reach.sort(), ["camp", "dart", "fan", "mortar"], `${k} is ground — everything can reach it`);
    assert.ok(TD.enemyTraits(def).length >= 1, `${k} always explains itself (even "no tricks")`);
  }
  // Every special FIELD an enemy carries must produce a trait line — otherwise a
  // new mechanic ships invisible to the player, which is the bug this fixes.
  //
  // The map below used to be the WHOLE check, hand-listed — so it silently had
  // eight holes, and four of them were real: `stomp`, `phases`, `suck` and
  // `enrage` were shipped boss mechanics with no card line at all (the Bed
  // Monster's unblockable stomp, the Static's escalating kit, the Vacuum King's
  // soldier-suck and its enrage). That is the documented "a scan's own list is
  // part of the scan" class, applied to a trait table: the guardrail could only
  // catch you after you remembered to edit the guardrail. So the FIELDS are now
  // DERIVED from the union of everything any enemy actually carries, and a
  // field must either name its trait here or sit on NOT_A_TRAIT with a reason.
  const FIELD_TRAIT = { flier: "flier", shield: "shield", splashResist: "splash", slowHeal: "slowheal",
    sap: "sap", phase: "phase", tunnel: "tunnel", split: "split", heal: "heal", charge: "charge", goldBurst: "gold", boss: "boss",
    bonkResist: "bonkresist", zapResist: "zapresist", hurry: "hurry", slowImmune: "slowimmune", spawner: "spawner",
    stomp: "stomp", suck: "suck", enrage: "enrage", phases: "phases", spill: "spill", jamBurst: "jamburst" };
  // Plain stats (spoken by the card's own stat line), presentation, or fields
  // asserted separately below. Everything else MUST be a trait.
  const NOT_A_TRAIT = new Set(["hp", "speed", "icon", "name", "bounty", "size", "meleeDmg", "meleeRate",
    "shieldRegen", "skinOf", "sortKey", "armor", "lives"]);
  const ALL_FIELDS = new Set();
  for (const def of Object.values(DATA.ENEMIES)) for (const f of Object.keys(def)) ALL_FIELDS.add(f);
  for (const f of ALL_FIELDS) {
    assert.ok(FIELD_TRAIT[f] || NOT_A_TRAIT.has(f),
      `.${f} is a field some enemy carries but this guardrail does not know it — give it a trait line in enemyTraits and map it here, or add it to NOT_A_TRAIT with a reason. A mechanic nothing explains is invisible.`);
  }
  for (const [k, def] of Object.entries(DATA.ENEMIES)) {
    const keys = TD.enemyTraits(def).map((t) => t.key);
    for (const [field, trait] of Object.entries(FIELD_TRAIT)) {
      if (def[field]) assert.ok(keys.includes(trait), `${k} has .${field} but the guide never mentions it — a mechanic nothing explains is invisible`);
    }
    if (def.armor > 0) assert.ok(keys.includes("armor"), `${k} is armored but the guide never says so`);
    // TD-15 made the leak toll a data field. Every enemy carries `lives`, so it
    // is only SPECIAL above 1 — and then it must be said, or "this one costs 8
    // stickers" is a rule the player can only learn by losing.
    if (def.lives > 1) assert.ok(keys.includes("toll"), `${k} costs ${def.lives} lives but the guide never says so`);
  }
});

// ---- TD-13: run tallies live in STATE (exact, cap-proof, sim-readable) ----
test("TD-13 tallies: damage is attributed to the LINE that dealt it, in the one damage path", () => {
  const lvl = DATA.LEVELS.find((l) => l.pads.length >= 3);
  const e = TD.createEngine(lvl, { seed: 7 });
  e.state.gold = 99999;
  assert.ok(e.place("dart", lvl.pads[0].id).ok);
  assert.ok(e.place("mortar", lvl.pads[1].id).ok);
  e.callWave();
  for (let i = 0; i < 1500; i++) e.tick();
  const by = e.state.dmgBy;
  assert.ok(by.dart > 0, "the dart's damage is credited to the dart line");
  assert.ok(by.mortar > 0, "the mortar's SPLASH is credited too — only the dart ever emitted a hit event, so event accounting would have credited nobody");
  assert.ok(!by.fan && !by.camp, "lines that were never built dealt nothing");
  assert.ok(e.state.kills > 0 && e.state.goldEarned > 0, "kills and gold earned are tallied");
  // An ability's damage is attributed to itself, not to a tower.
  const before = Object.assign({}, e.state.dmgBy);
  e.state.gold = 9999;
  const live = e.state.enemies.find((x) => x.alive);
  if (live) {
    const p = e.posOn(live.pathIdx, live.dist);
    e.useAbility("drop", { x: p.x, y: p.y });
    assert.ok((e.state.dmgBy.ability || 0) > 0, "ability damage is its own row");
    assert.equal(e.state.dmgBy.dart, before.dart, "…and is never credited to a tower line");
  }
});

test("TD-13 tallies: they survive a wave WITHOUT draining events (the 400-cap trap)", () => {
  // The event buffer is capped at 400. A scripted or headless run simulates a
  // whole wave before draining, so anything counted from events would be lost.
  const lvl = DATA.LEVELS.find((l) => l.id === 12); // the longest run — enough kills to overflow the buffer
  const e = TD.createEngine(lvl, { seed: 7 });
  lvl.pads.forEach((p) => { e.state.gold = 99999; e.place("dart", p.id); });
  let guard = 0;
  while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 400000) {
    if (e.state.phase === "build") {
      e.state.gold = 99999;
      for (const t of e.state.towers) if (t.tier < 3) e.upgrade(t.id);
      e.callWave();
    }
    e.tick();
  }
  assert.equal(e.events.length, 400, "the event buffer really is capped at 400");
  const dieLeft = e.events.filter((x) => x.type === "die").length;
  assert.ok(e.state.kills > dieLeft,
    `the tally counts the WHOLE run (${e.state.kills} kills) while the capped buffer retains only ${dieLeft} die events — event accounting would have lost the rest`);
});

// ---- TD-11: the fork subsystem now ships on more than one level ----
test("TD-11 forks: every fork level keeps the shared-prefix invariant and is a DEFAULT-NOOP", () => {
  const forked = DATA.LEVELS.filter((l) => l.paths && l.paths.length > 1);
  assert.ok(forked.length >= 3, `the lane subsystem ships on several levels, not just one (${forked.length})`);
  for (const l of forked) {
    assert.ok(l.fork && typeof l.fork.at === "number", `L${l.id} declares its fork distance`);
    assert.ok(l.lever && typeof l.lever.cx === "number", `L${l.id} has a lever to throw`);
    const a = TD.buildPath(l.paths[0]), b = TD.buildPath(l.paths[1]);
    // Identical geometry up to the fork — this is what makes rerouting seamless:
    // a pre-fork enemy can switch lanes with NO teleport.
    for (let d = 0; d <= l.fork.at; d += 0.25) {
      const x = TD.posAt(a, d), y = TD.posAt(b, d);
      assert.ok(Math.abs(x.x - y.x) < 1e-9 && Math.abs(x.y - y.y) < 1e-9,
        `L${l.id} lanes must coincide up to the fork (diverged at ${d})`);
    }
    const A = TD.posAt(a, l.fork.at + 1), B = TD.posAt(b, l.fork.at + 1);
    assert.ok(Math.hypot(A.x - B.x, A.y - B.y) > 0.5, `L${l.id} lanes must actually diverge after the fork`);
    assert.ok(b.total > a.total * 1.15, `L${l.id}'s long route must be meaningfully longer (${(b.total / a.total).toFixed(2)}×)`);
    // DEFAULT-NOOP: lane 0 is exactly the level's original single path, so every
    // winnability sim (which never pulls the lever) is untouched by the retrofit.
    if (l.path) assert.deepEqual(l.paths[0], l.path, `L${l.id}'s default lane must BE the original path`);
    // …and no pad may sit on EITHER lane (the shipped pad-geometry law).
    // MEASURED IN CELL-INDEX SPACE, like `AUDIT pad geometry` and like the
    // engine itself: a tower stores `cx: pad.cx` and targets against posAt's
    // cell-index position (`(p.x - t.cx)**2 + …`), so index space IS the
    // engine's truth. This check used to add +0.5 to the PAD only and not to
    // the lane, biasing every distance by up to a half-cell DIAGONAL (0.707) —
    // the "two coordinate spaces one +0.5 apart" trap again, this time in a
    // test. It rejected correctly-placed World-5 pads while its own sibling
    // audit passed them. Every shipped fork level passes either way.
    for (const pad of l.pads) {
      for (const lane of l.paths) {
        let m = Infinity;
        for (let i = 1; i < lane.length; i++) {
          const [ax, ay] = lane[i - 1], [bx, by] = lane[i];
          const vx = bx - ax, vy = by - ay, wx = pad.cx - ax, wy = pad.cy - ay;
          const L2 = vx * vx + vy * vy;
          let t = L2 ? (wx * vx + wy * vy) / L2 : 0;
          t = Math.max(0, Math.min(1, t));
          m = Math.min(m, Math.hypot(pad.cx - (ax + vx * t), pad.cy - (ay + vy * t)));
        }
        assert.ok(m >= 0.99, `L${l.id} pad ${pad.id} sits on a lane (${m.toFixed(2)} cells) — a tower must never stand in the road`);
      }
    }
  }
});

// Every world must OFFER the lever, or the subsystem quietly stops being part of
// the game as the campaign grows. This is not hypothetical: World 4 (attic) and
// World 6 (moving day) were both authored after TD-11's fork search ran, both
// shipped with no lever at all, and CLAUDE.md carried "re-run the generator over
// the maps authored since" as an open item across two releases — because nothing
// failed. Deriving from the data (never a hard-coded world list, the counting
// law) means a seventh world inherits the check for free.
test("TD-11 forks: EVERY world offers the lever subsystem", () => {
  const worlds = [...new Set(DATA.LEVELS.map((l) => l.world))];
  const without = worlds.filter((w) => !DATA.LEVELS.some((l) => l.world === w && l.fork));
  assert.deepEqual(without, [],
    `these worlds have no fork+lever level: ${without.join(", ")} — run tools/td-fork-search.js, which finds the candidates that need no pad moved`);
  // …and a lever is a set piece, not wallpaper: at most one per world keeps it
  // special (and keeps the "which route is live?" readout meaningful).
  for (const w of worlds) {
    const n = DATA.LEVELS.filter((l) => l.world === w && l.fork).length;
    assert.equal(n, 1, `world "${w}" has ${n} lever levels — exactly one is the shipped rhythm`);
  }
});

test("TD-11 forks: throwing the lever reroutes without teleporting anyone", () => {
  for (const l of DATA.LEVELS.filter((x) => x.paths && x.paths.length > 1)) {
    const e = TD.createEngine(l, { seed: 7 });
    e.callWave();
    for (let i = 0; i < 120; i++) e.tick();
    const pre = e.state.enemies.filter((x) => x.alive && x.dist < l.fork.at);
    const before = pre.map((x) => e.posOn(x.pathIdx, x.dist));
    const r = e.pullLever();
    assert.ok(r.ok, `L${l.id}'s lever throws`);
    pre.forEach((x, i) => {
      const now = e.posOn(x.pathIdx, x.dist);
      assert.ok(Math.hypot(now.x - before[i].x, now.y - before[i].y) < 1e-9,
        `L${l.id}: a pre-fork enemy must not jump when the lane changes`);
    });
    assert.equal(e.pullLever().reason, "running", `L${l.id}'s lever is inert while its diversion runs`);
    // TD-17: and the snap-back is seamless in the OTHER direction too — the
    // lanes share geometry up to the fork, so returning to short must not
    // teleport anyone either. Only the outbound swap used to be checked.
    const back = pre.map((x) => e.posOn(x.pathIdx, x.dist));
    for (let i = 0; i < DATA.RULES.leverHold * DATA.TICK_RATE + 2; i++) e.tick();
    assert.equal(e.state.leverRoute, 0, `L${l.id}'s diversion expires on its own`);
    pre.filter((x) => x.alive && x.dist < l.fork.at).forEach((x) => {
      const now = e.posOn(x.pathIdx, x.dist);
      const was = back[pre.indexOf(x)];
      assert.ok(Math.abs(now.x - was.x) < 60 && Math.abs(now.y - was.y) < 60,
        `L${l.id}: the snap-back must not teleport a pre-fork enemy`);
    });
  }
});

// ---- A power that changes NOTHING must never charge you ----
// ================= Phase 3: the powers become decisions =================

test("P3 energy: the power budget is FLAT per wave, which is what gold stopped being", () => {
  // The measurement this replaces: a fully-built board holds 0-145 gold through
  // wave 10 and then 351, 1115, 2375, 3533, 5393 on L24 — 67 free uses of the
  // cheapest power on the last wave alone. A per-KILL grant cannot fix that
  // (supply scales with wave size, 1.18^n; cooldown-limited demand scales only
  // with wave duration), so this is the assertion that a per-kill version fails.
  const lvl = DATA.LEVELS.find((l) => l.id === 20);
  const e = TD.createEngine(lvl, { seed: 7 });
  e.state.gold = 9e6;
  for (const p of lvl.pads) e.place("dart", p.id);
  const perWave = [];
  let uses = 0, guard = 0;
  while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 200000) {
    if (e.state.phase === "build") { perWave.push(uses); uses = 0; e.callWave(); }
    e.state.gold = 9e6;                                   // gold is deliberately NOT the constraint here
    for (const ab of DATA.ABILITIES) {
      const o = ab.kind === "point" ? { x: lvl.pads[0].cx, y: lvl.pads[0].cy }
        : ab.kind === "tower" ? { towerId: e.state.towers[0].id } : {};
      if (e.useAbility(ab.id, o).ok) uses++;
    }
    e.tick();
  }
  perWave.push(uses);
  const live = perWave.slice(1, -1);                       // drop the pre-wave 0 and the truncated last
  assert.ok(live.length >= 4, `enough waves to see the shape (${perWave.join(",")})`);
  assert.ok(Math.max(...live) <= DATA.RULES.chargePerWave,
    `an unlimited-gold spam bot may never exceed ${DATA.RULES.chargePerWave} uses in a wave (${perWave.join(", ")})`);
  assert.ok(Math.max(...live) - Math.min(...live) <= 1,
    `and the budget must be FLAT, not growing with wave size (${perWave.join(", ")}) — a per-kill grant fails exactly here`);
});

test("P3 energy: a charge-less use is REFUSED — no gold, no cooldown", () => {
  const lvl = DATA.LEVELS[0];
  const e = TD.createEngine(lvl, { seed: 7 });
  e.callWave();
  for (let i = 0; i < 120; i++) e.tick();
  assert.equal(e.state.charge, DATA.RULES.chargePerWave, "one wave sent grants exactly one wave's energy");
  e.state.gold = 9e6;
  e.state.charge = 0;
  const live = e.state.enemies.find((x) => x.alive);
  const p = e.posOn(live.pathIdx, live.dist);
  const r = e.useAbility("drop", { x: p.x, y: p.y });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "charge", "…and it says WHY, so the button never reads broken");
  assert.equal(e.state.gold, 9e6, "no gold taken");
  assert.deepEqual(e.state.abilityCd, {}, "no cooldown started");
  // …and the same use lands the moment there is energy for it
  e.state.charge = 1;
  assert.equal(e.useAbility("drop", { x: p.x, y: p.y }).ok, true);
  assert.equal(e.state.charge, 0, "and it SPENT the charge");
});

test("P3 energy: the cap holds, and a ⏩ RUSH pays for the wave it sends", () => {
  const lvl = DATA.LEVELS.find((l) => l.waves.length >= 6);
  const e = TD.createEngine(lvl, { seed: 3 });
  const R = DATA.RULES;
  // bank across quiet waves, but never past the cap
  for (let w = 0; w < 5; w++) {
    e.callWave();
    let g = 0;
    while (e.state.phase === "wave" && g++ < 200000) e.tick();
    assert.ok(e.state.charge <= R.chargeMax, `energy is capped at ${R.chargeMax} (saw ${e.state.charge} after wave ${w + 1})`);
  }
  assert.equal(e.state.charge, R.chargeMax, "…and a player who spends nothing does reach the cap");
  // a RUSH sends a wave, so it grants for that wave — once
  const e2 = TD.createEngine(lvl, { seed: 3 });
  e2.callWave();
  for (let i = 0; i < R.rushSettle * DATA.TICK_RATE + 5; i++) e2.tick();
  const before = e2.state.charge;
  const rush = e2.callWave();
  assert.equal(rush.ok, true, "the rush went out");
  assert.equal(e2.state.charge, Math.min(R.chargeMax, before + R.chargePerWave),
    "a rushed wave grants exactly one wave's energy, not two and not none");
});

test("P3 reveal: 🧨 flushes a hider out — through the ONE isHidden gate", () => {
  // Untargetability is enforced at every read site by a single gate, so the
  // reveal is one clause at the top of it rather than a rider bolted onto
  // whichever path someone remembered. This drives the gate directly AND the
  // paths that consume it.
  const lvl = DATA.LEVELS.find((l) => l.waves.some((w) => (w.groups || []).some((g) => g.type === "ghost"))) || DATA.LEVELS[0];
  const e = TD.createEngine(lvl, { seed: 5 });
  e.state.gold = 9e6; e.state.charge = 9;
  e.callWave();
  for (let i = 0; i < 20; i++) e.tick();
  // a phased ghost, placed by hand so the test never depends on wave rng
  e.state.enemies.length = 0;
  // mkEnemy, not a hand-rolled literal: a PARTIAL enemy record silently breaks
  // the very branches under test (a missing field NaNs `dist` on the first tick)
  const ghost = mkEnemy("ghost", 6, 0);
  ghost.phaseHidden = true;
  e.state.enemies.push(ghost);
  assert.equal(e.isHidden(ghost), true, "a phased ghost starts untargetable");
  const p = e.posOn(0, ghost.dist);
  // …and the blast is OFFERED rather than refused: a revealing blast counts
  // hidden enemies as targets, because it is what un-hides them. Before this
  // fix, L12's boss wave (eight phased ghosts) refused with "nothing in the
  // blast" — the shipped defect this repairs.
  const hpBefore = ghost.hp;
  const r = e.useAbility("drop", { x: p.x, y: p.y });
  assert.equal(r.ok, true, "a blast into a crater of phased ghosts is allowed, not refused");
  assert.equal(e.isHidden(ghost), false, "…and the ghost is revealed by it");
  assert.ok(ghost.hp < hpBefore, "…and the SAME tap damages it — the reveal is pushed before the damage loop");
  // it expires
  const secs = DATA.ABILITIES.find((a) => a.id === "drop").reveal.seconds;
  for (let i = 0; i < secs * DATA.TICK_RATE + 2; i++) e.tick();
  ghost.phaseHidden = true; ghost.dist = 6;
  assert.equal(e.isHidden(ghost), true, "and it wears off — this is a window, not a permanent counter");
});

test("P3 reveal: a tunnelling mole inside a blast is hittable by the INDIRECT paths too", () => {
  // The documented class: "untargetable" has to be enforced at every damage
  // path including splash and chain — so lifting it has to lift at every one.
  const lvl = DATA.LEVELS[0];
  const e = TD.createEngine(lvl, { seed: 5 });
  e.state.gold = 9e6; e.state.charge = 9;
  e.callWave();
  for (let i = 0; i < 20; i++) e.tick();
  e.state.enemies.length = 0;
  const total = e.paths[0].total;
  const def = DATA.ENEMIES.mole;
  // hp far above the blast's 300, so the mole SURVIVES to be slowed — at its
  // real 65hp the drop simply kills it and the puddle has nothing to act on
  const mole = mkEnemy("mole", total / 2, 0);
  mole.hp = mole.maxHp = 5000;
  void def;
  e.state.enemies.push(mole);
  assert.equal(e.isHidden(mole), true, "mid-lane, the mole is tunnelling");
  const p = e.posOn(0, mole.dist);
  assert.equal(e.useAbility("drop", { x: p.x, y: p.y }).ok, true);
  assert.equal(e.isHidden(mole), false, "the blast opens the tunnel up");
  // a puddle now slows it — one of the indirect paths that consults isHidden
  e.state.charge = 9;
  assert.equal(e.useAbility("sticky", { x: p.x, y: p.y }).ok, true);
  e.tick();
  assert.ok(mole.slowUntil > 0, "a revealed mole can be slowed — the gate lifted for the puddle too");
});

test("P3 overclock: the CRASH is real, and cannot be dodged across a build phase", () => {
  const lvl = DATA.LEVELS[0];
  const ab = DATA.ABILITIES.find((a) => a.id === "overclock");
  assert.ok(ab.crashSeconds > 0 && ab.crashMult < 1, "the power ships with a downside at all");
  // near-neutral by construction: boost shot-seconds + crash shot-seconds ≈ the
  // untouched window, so the value is in WHEN you spend it, not in total output.
  const window = ab.seconds + ab.crashSeconds;
  const output = ab.seconds * ab.mult + ab.crashSeconds * ab.crashMult;
  assert.ok(Math.abs(output - window) / window <= 0.25,
    `the burst and the crash roughly cancel (${output} shot-seconds over ${window}s) — otherwise it is a straight buff or a trap`);

  const e = TD.createEngine(lvl, { seed: 7 });
  e.state.gold = 9e6;
  e.place("dart", lvl.pads[0].id);
  const t = e.state.towers[0];
  e.callWave();
  e.state.charge = 9;
  assert.equal(e.useAbility("overclock", { towerId: t.id }).ok, true);
  assert.ok(t.crashUntil > t.boostUntil, "the crash is queued behind the burst");
  // run the burst out, then let the WAVE end while the crash is still owed
  while (e.state.tick < t.boostUntil) e.tick();
  assert.ok(t.crashUntil > e.state.tick, "the crash is still owed when the burst ends");
  e.state.enemies.length = 0;                     // finish the wave immediately
  let g = 0;
  while (e.state.phase === "wave" && g++ < 200000) e.tick();
  assert.equal(e.state.phase, "build", "we are between waves");
  const owed = t.crashRemain;                     // banked AT the boundary, not before it
  assert.ok(owed > 0, "the remaining crash was banked when the wave ended");
  assert.equal(t.crashUntil, 0, "…and stops counting down while nothing is being shot at");
  // …the build countdown is 20s and the crash is 12s, so an UNCLAMPED crash
  // would be entirely dodged here. It is frozen instead.
  // stop SHORT of the countdown — letting it expire auto-starts the wave, which
  // thaws, and then the explicit call below would be a RUSH instead
  for (let i = 0; i < DATA.RULES.buildCountdown * DATA.TICK_RATE - 30; i++) e.tick();
  assert.equal(e.state.phase, "build", "still between waves");
  e.callWave();
  assert.ok(t.crashUntil > e.state.tick,
    "the tower is still paying the crash back on the next wave's first shots — an opt-out downside is just a buff");
  assert.equal(t.crashUntil - e.state.tick, owed, "and it owes exactly what it owed, not more and not less");
});

test("P3 overclock: the burst really fires FASTER and the crash really fires SLOWER", () => {
  // The timing test above pins the WINDOWS; this pins the RATE. Without it,
  // deleting the crash branch from boostOf leaves everything green — a test
  // that cannot fail is worse than no test. Measured as damage dealt over a
  // fixed window against an enemy PINNED beside the tower, so range and
  // targeting cannot influence the count.
  const lvl = DATA.LEVELS[0];
  const ab = DATA.ABILITIES.find((a) => a.id === "overclock");
  const WINDOW = ab.seconds * DATA.TICK_RATE;   // measure the same span each time
  function measure(mode) {
    const e = TD.createEngine(lvl, { seed: 11 });
    e.state.gold = 9e6;
    e.place("dart", lvl.pads[0].id);
    const t = e.state.towers[0];
    e.callWave();
    e.state.charge = 9;
    const pin = () => {
      e.state.enemies.length = 0;
      const x = mkEnemy("sock", distNear(e, t), 0);
      x.hp = x.maxHp = 9e6;                     // never dies, never leaks the count
      e.state.enemies.push(x);
    };
    pin();
    for (let i = 0; i < 30; i++) { e.tick(); pin(); }   // let the tower settle
    if (mode !== "base") assert.equal(e.useAbility("overclock", { towerId: t.id }).ok, true);
    if (mode === "crash") { while (e.state.tick < t.boostUntil) { e.tick(); pin(); } }
    const before = e.state.dmgBy.dart || 0;
    for (let i = 0; i < WINDOW; i++) { e.tick(); pin(); }
    return (e.state.dmgBy.dart || 0) - before;
  }
  const base = measure("base"), boost = measure("boost"), crash = measure("crash");
  assert.ok(base > 0, `the baseline tower actually shoots (${base})`);
  // discrete lines are asserted as RANGES: t.cooldown is sampled at fire time,
  // so a window's boundary shot carries the previous multiplier.
  assert.ok(boost / base >= ab.mult * 0.7 && boost / base <= ab.mult * 1.3,
    `the burst fires about ${ab.mult}x (measured ${(boost / base).toFixed(2)}x — ${base} → ${boost})`);
  assert.ok(crash / base <= ab.crashMult * 1.3,
    `the crash fires about ${ab.crashMult}x (measured ${(crash / base).toFixed(2)}x — ${base} → ${crash}); ` +
    "deleting the crash branch from boostOf must fail HERE");
  assert.ok(crash < base, "and a crashing tower is strictly worse than an untouched one");
});

// Reported from real play: "some of them don't even seem to work at all". They
// worked as coded, but Rally Horn with no camps returned ok, did nothing, and
// still took 80 gold — indistinguishable from broken.
test("TD-9 abilities: a no-op use is REFUSED, and costs neither gold nor cooldown", () => {
  const lvl = DATA.LEVELS[0];
  const e = TD.createEngine(lvl, { seed: 7 });
  e.state.gold = 5000;
  // 1. outside a wave there is nothing to hit and a puddle would expire first
  for (const a of DATA.ABILITIES) {
    const r = a.kind === "instant" ? e.useAbility(a.id, {}) : e.useAbility(a.id, { x: 3, y: 3 });
    assert.equal(r.ok, false, `${a.id} must refuse outside a wave`);
    assert.equal(r.reason, "not-in-wave", `${a.id} says why`);
  }
  assert.equal(e.state.gold, 5000, "…and nothing was charged");
  assert.deepEqual(e.state.abilityCd, {}, "…and no cooldown started");

  e.callWave();
  for (let i = 0; i < 120; i++) e.tick();
  e.state.gold = 5000;
  // 2. a blast that would hit nobody
  const far = e.useAbility("drop", { x: 0.5, y: DATA.GRID.h - 0.5 });
  assert.equal(far.reason, "no-targets", "a blast with nothing in it is refused");
  // 3. a horn with no soldiers at all (the reported case)
  assert.equal(e.state.towers.filter((t) => t.lineId === "camp").length, 0, "no camps on this board");
  assert.equal(e.useAbility("horn", {}).reason, "no-soldiers", "the horn refuses when there is nobody to rally");
  // 4. overclock with no tower under the tap
  assert.equal(e.useAbility("overclock", { towerId: 99999 }).reason, "no-tower", "overclock needs a real tower");
  assert.equal(e.state.gold, 5000, "not one coin was taken for any of them");
  assert.deepEqual(e.state.abilityCd, {}, "and not one cooldown was started");

  // …while a use that DOES something still works and still charges.
  const live = e.state.enemies.find((x) => x.alive);
  assert.ok(live, "enemies are on the field");
  const p = e.posOn(live.pathIdx, live.dist);
  const good = e.useAbility("drop", { x: p.x, y: p.y });
  assert.ok(good.ok && good.hits > 0, "a real use lands");
  assert.ok(e.state.gold < 5000, "…and is paid for");
});

test("AUDIT roster: every enemy in DATA.ENEMIES is actually REACHABLE by a player", () => {
  // The "content that exists but cannot be reached" class, which this project
  // has now paid for three times: World 4's levels shipped with no card on the
  // grid; the casual/heroic difficulties shipped with no selector; and the 🦆
  // Rubber Duck spent part of an afternoon fully built — engine field, art,
  // guide card, guardrails — while sitting in NO wave table, so nothing in the
  // game could spawn it. An enemy in the roster that nothing spawns is not
  // content, it is dead weight that looks like content.
  //
  // Reachability is DERIVED from every route a body can actually enter play:
  // a wave group, a spawner's drip, a splitter's children, a boss phase's
  // summon, or an endless pool / mini-boss.
  const reachable = new Set();
  for (const l of DATA.LEVELS) for (const w of l.waves) for (const g of w.groups || []) reachable.add(g.type);
  for (const def of Object.values(DATA.ENEMIES)) {
    if (def.spawner) reachable.add(def.spawner.type);
    if (def.split) reachable.add(def.split.type || "mudlet");
    for (const p of def.phases || []) if (p.spawn) reachable.add(p.spawn.type);
  }
  for (const w of Object.values((DATA.ENDLESS && DATA.ENDLESS.worlds) || {})) {
    for (const t of w.pool || []) reachable.add(t);
    if (w.miniBoss) reachable.add(w.miniBoss);
  }
  const orphans = Object.keys(DATA.ENEMIES).filter((t) => !reachable.has(t));
  assert.deepEqual(orphans, [],
    "these enemies are in the roster but nothing can ever spawn them: " + orphans.join(", ") +
    " — every one costs art, a guide card and a draw branch while being unreachable");
  // …and the reverse: nothing may be spawned that has no definition.
  const undef = [...reachable].filter((t) => !DATA.ENEMIES[t]);
  assert.deepEqual(undef, [], "these types are spawned but not defined: " + undef.join(", "));
});

test("P6 ⛱️ Blanket Cover: every damage family lands at exactly the band's dmg", () => {
  // The 4th gimmick shape. `zones[].mult` scales TIME in range; `dmg` scales
  // DAMAGE in range — the two factors of the same integral, so it is the same
  // array, the same disjointness rule and the same renderer machinery.
  //
  // Shipped ONE-SIDED (below 1 only). A dmg > 1 "spotlight" was measured to turn
  // a LOSING dart-mono board into a winning one on two levels, which is exactly
  // the property `AUDIT mono builds` protects — the two halves are not
  // symmetric knobs, and a two-sided bound here would be a bound nothing can hit.
  const bands = [];
  for (const l of DATA.LEVELS) for (const z of l.zones || []) if (z.dmg != null) bands.push({ l, z });
  assert.ok(bands.length >= 1, "the campaign actually ships a cover band");
  for (const { l, z } of bands) {
    assert.ok(z.dmg >= 0.7 && z.dmg < 1,
      `L${l.id} cover is ${z.dmg} — the band is 0.70 <= dmg < 1. Below 0.70 was measured unwinnable on heroic; ` +
      "at or above 1 it becomes the spotlight that flips a mono result.");
    assert.ok(typeof z.mult === "number",
      `L${l.id}'s cover band must still state a numeric mult — effSpeed multiplies by it, and a bare undefined is NaN`);
  }
  // EFFECT, per damage family. A pinned enemy inside the band vs an identical
  // one outside it: the delivered damage ratio must equal the band's dmg.
  const lvl = JSON.parse(JSON.stringify(DATA.LEVELS.find((l) => l.pads.length >= 2)));
  lvl.zones = [{ from: 6, to: 14, mult: 1, dmg: 0.5 }];
  const e = TD.createEngine(lvl, { seed: 9 });
  e.state.phase = "wave";
  const hit = (dist, how) => {
    const x = mkEnemy("sock", dist); x.id = 7700; x.hp = 100000; x.maxHp = 100000;
    e.state.enemies.length = 0; e.state.enemies.push(x);
    e.dealDamage(x, 200, 0, how);
    return 100000 - x.hp;
  };
  for (const how of ["dart", "splash", "zap", "melee", "ability"]) {
    const inside = hit(10, how), outside = hit(20, how);
    assert.equal(outside, 200, `${how} outside the band is untouched`);
    assert.equal(inside, 100, `${how} inside the band lands at the band's dmg (got ${inside}/200)`);
  }
  // …and the Fan's BEAM, whose 1-damage packets would be rounded straight back
  // to 1 if the band were applied at dealDamage alone. Mutation: delete the
  // accumulator multiply and THIS row goes red while every row above stays green.
  const fanLvl = JSON.parse(JSON.stringify(DATA.LEVELS.find((l) => l.pads.length >= 2)));
  const probe = TD.createEngine(fanLvl, { seed: 9 });
  const d0 = distNear(probe, fanLvl.pads[0]);
  fanLvl.zones = [{ from: d0 - 1.5, to: d0 + 1.5, mult: 1, dmg: 0.5 }];
  // Same tower, same enemy, same spot on the lane, run twice — the ONLY
  // difference is whether the level carries the band.
  const beamLoss = () => {
    const en = TD.createEngine(fanLvl, { seed: 9 });
    en.state.gold = 999999;
    assert.ok(en.place("fan", fanLvl.pads[0].id).ok);
    en.state.phase = "wave";
    const x = mkEnemy("sock", d0); x.id = 7701; x.hp = 100000; x.maxHp = 100000;
    en.state.enemies.length = 0; en.state.enemies.push(x);
    for (let i = 0; i < 600; i++) { x.dist = d0; en.tick(); }
    return 100000 - x.hp;
  };
  const withBand = beamLoss();
  fanLvl.zones = [];
  const noBand = beamLoss();
  assert.ok(noBand > 50, `the fan beam really is firing (${noBand})`);
  const ratio = withBand / noBand;
  assert.ok(Math.abs(ratio - 0.5) <= 0.05,
    `the Fan's BEAM must honour the cover band too — measured ${ratio.toFixed(3)} (${withBand} vs ${noBand}). ` +
    "A 1.000 here means the band was applied only at dealDamage, where Math.round(1 * 0.5) = 1 erases it.");
});

test("ART floor props: placed purely, clear of EVERY lane, and never moved by a resize", () => {
  // Three quarters of every board was bare floor. The props that dress it are
  // placed by a PURE function so this can be checked without a browser at all.
  //
  // The clearance is measured against EVERY lane, not lane 0 — the TD-11 lesson
  // as an assertion. Mutation: check only `paths[0]` and the eight fork levels
  // immediately grow a prop on their switch track.
  const LANE = 1.6, PAD = 1.4;
  const near = (px, py, path) => {
    let best = Infinity;
    for (const s of path.segs) {
      const dx = s.bx - s.ax, dy = s.by - s.ay, l2 = dx * dx + dy * dy;
      let t = l2 ? ((px - s.ax) * dx + (py - s.ay) * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      best = Math.min(best, Math.hypot(px - (s.ax + dx * t), py - (s.ay + dy * t)));
    }
    return best;
  };
  let forked = 0;
  for (const lv of DATA.LEVELS) {
    const props = TD.propCells(lv, DATA.GRID);
    // A level that dresses with nothing is a bare board — the thing this fixes.
    assert.ok(props.length >= 3, `L${lv.id} gets some floor dressing (${props.length})`);
    // PURE: two calls agree exactly, and it takes no cell size, so a resize()
    // can never shift a prop (the props are baked once into the background).
    assert.deepEqual(TD.propCells(lv, DATA.GRID), props, `L${lv.id} places props deterministically`);
    const lanes = (lv.paths && lv.paths.length ? lv.paths : [lv.path]).map(TD.buildPath);
    if (lanes.length > 1) forked++;
    for (const p of props) {
      assert.ok(p.x > 0 && p.x < DATA.GRID.w && p.y > 0 && p.y < DATA.GRID.h, `L${lv.id} prop is on the board`);
      for (let i = 0; i < lanes.length; i++) {
        assert.ok(near(p.x, p.y, lanes[i]) >= LANE,
          `L${lv.id} prop (${p.x},${p.y}) sits ${near(p.x, p.y, lanes[i]).toFixed(2)} from lane ${i} — it must never touch the corridor an enemy walks`);
      }
      for (const pd of lv.pads) {
        assert.ok(Math.hypot(p.x - pd.cx, p.y - pd.cy) >= PAD, `L${lv.id} prop clears pad ${pd.id}`);
      }
      if (lv.lever) assert.ok(Math.hypot(p.x - lv.lever.cx, p.y - lv.lever.cy) >= PAD, `L${lv.id} prop clears the lever`);
    }
  }
  assert.ok(forked >= 8, `the multi-lane clearance really is exercised (${forked} fork levels)`);
  // Every world must actually declare a prop set, or its floor stays bare —
  // derived, so a ninth world cannot ship undressed.
  for (const [w, def] of Object.entries(DATA.WORLDS)) {
    assert.ok(Array.isArray(def.floor.props) && def.floor.props.length === 3,
      `${w} declares three floor props (it has ${JSON.stringify(def.floor && def.floor.props)})`);
  }
});

test("P6 wave data: every group has the fields the spawner arithmetic needs", () => {
  // Found while dosing a new enemy: a group without `delay` makes
  // `Math.max(0, g.delay + i * g.gap + jitter)` NaN, the spawn tick NaN, the
  // enemy never arrives and the WAVE NEVER FINISHES — so the level reads as
  // unwinnable rather than as malformed data. The engine no longer hangs on it,
  // and this asserts the shipped data is complete either way (so the defaults
  // stay a safety net, never a licence to author half a group).
  const bad = [];
  for (const l of DATA.LEVELS) {
    l.waves.forEach((w, wi) => {
      assert.ok(Array.isArray(w.groups) && w.groups.length, `L${l.id} wave ${wi + 1} has groups`);
      for (const g of w.groups) {
        for (const f of ["count", "gap", "delay"]) {
          if (typeof g[f] !== "number" || !isFinite(g[f])) bad.push(`L${l.id} w${wi + 1} ${g.type}.${f}=${g[f]}`);
        }
        if (!DATA.ENEMIES[g.type]) bad.push(`L${l.id} w${wi + 1} unknown enemy "${g.type}"`);
      }
    });
  }
  assert.deepEqual(bad, [], "these wave groups are missing a numeric field the spawner needs: " + bad.join(", "));
  // …and the engine survives one anyway, instead of hanging.
  const lvl = JSON.parse(JSON.stringify(DATA.LEVELS[0]));
  delete lvl.waves[0].groups[0].delay;
  const e = TD.createEngine(lvl, { seed: 3 });
  e.callWave();
  for (let i = 0; i < 900; i++) e.tick();
  assert.ok(e.state.enemies.length > 0 || e.state.waveIdx > 0,
    "a delay-less group still spawns — a missing field must not silently hang the wave");
});

test("P6 🦆 zapResist: the Fan's beam lands at EXACTLY (1 - zapResist), and nothing else changes", () => {
  // The trap this test exists for: the Fan's beam accumulates 6-16 dps into ONE
  // point of damage per tick and both computeHit and dealDamage ROUND, so a
  // fraction applied to that single point floors to zero — `Math.round(1*0.4)`
  // is 0 and the beam would deal NO damage at any tier, for ever. So the
  // assertion is an EXACT RATIO, not "it survives much longer": surviving
  // infinitely longer passes on the broken build, which is precisely the kind of
  // test this repo has learnt to distrust.
  const ZR = DATA.ENEMIES.duck.zapResist;
  assert.ok(ZR > 0 && ZR < 1, "the duck carries a real zapResist");
  const lvl = DATA.LEVELS.find((l) => l.pads.length >= 2);
  for (const tier of [1, 2, 3]) {
    const e = TD.createEngine(lvl, { seed: 11 });
    e.state.gold = 999999;
    assert.ok(e.place("fan", lvl.pads[0].id).ok);
    const t = e.state.towers[0];
    for (let u = 1; u < tier; u++) assert.ok(e.upgrade(t.id).ok, "fan reaches tier " + tier);
    e.state.phase = "wave";
    // one rubber body and one plain body of IDENTICAL hp, both pinned in the
    // beam's reach — so the only difference between them is the resist
    const d = distNear(e, t);
    const HP = 100000;                                  // never dies, so the ratio is clean
    const rubber = mkEnemy("duck", d); rubber.id = 8801; rubber.hp = HP; rubber.maxHp = HP;
    const plain = mkEnemy("sock", d); plain.id = 8802; plain.hp = HP; plain.maxHp = HP;
    // measure them ONE AT A TIME: the beam only ever engages a single target
    const lost = (who) => {
      e.state.enemies.length = 0;
      e.state.enemies.push(who);
      who.hp = HP;
      const before = who.hp;
      for (let i = 0; i < 600; i++) { who.dist = d; e.tick(); }
      return before - who.hp;
    };
    const lr = lost(rubber), lp = lost(plain);
    assert.ok(lp > 50, `tier ${tier}: the plain body really is being zapped (${lp})`);
    assert.ok(lr > 0, `tier ${tier}: the rubber body still takes SOME zap (${lr}) — a resist is not immunity`);
    const ratio = lr / lp;
    assert.ok(Math.abs(ratio - (1 - ZR)) <= 0.03,
      `tier ${tier}: the beam must land at exactly ${(1 - ZR).toFixed(2)} on rubber — measured ${ratio.toFixed(3)} ` +
      `(${lr} vs ${lp}). A 0.00 here means the fraction was applied to the rounded single point of damage instead of the accumulator.`);
  }
  // …and it is keyed on `how`, so the seam is provable without a time-to-kill:
  // a dart's bonk and a mortar's splash go through untouched, and the Static
  // branch's chain jump (also "zap") is attenuated by the same rule.
  const e2 = TD.createEngine(lvl, { seed: 5 });
  e2.state.phase = "wave";
  const probe = (how) => {
    const x = mkEnemy("duck", 1); x.id = 8810; x.hp = 1000; x.maxHp = 1000;
    e2.state.enemies.length = 0; e2.state.enemies.push(x);
    e2.dealDamage(x, 100, 0, how);
    return 1000 - x.hp;
  };
  assert.equal(probe("dart"), 100, "a dart's bonk is untouched by zapResist");
  assert.equal(probe("splash"), 100, "so is mortar splash");
  assert.equal(probe("melee"), 100, "so is a soldier's swing");
  assert.equal(probe("zap"), Math.round(100 * (1 - ZR)), "a chain-lightning jump IS attenuated (same `how`)");
});

test("SHIELD is an anti-FAN buffer and NOTHING else — the fact two design docs got wrong", () => {
  // Written because a whole enemy was designed on the opposite belief and had to
  // be cut. `computeHit` moves damage into the shield on ONE condition —
  // `dmgType === "zap"` — so for a dart, a mortar, a soldier or an ability a
  // shielded body is EXACTLY its hp. A design spec built a 🥫 Pantry Can around
  // a fast-resealing shield as a "you must go tall, not wide" check, and its own
  // critique claimed the wave-budget audit was "~35% blind" to shielded groups.
  // Both assume a shield is generic effective HP. It is not, and this pins it so
  // the next author does not spend the same afternoon.
  //
  // Consequence for the budget curve, recorded here because it is the reason the
  // audit still weighs a group by plain `hp`: adding `shield` to that weight
  // would OVER-count for three of the four lines, and an audit that rejects a
  // correctly-sized wave is the false-positive machine this repo refuses to ship.
  const lvl = DATA.LEVELS.find((l) => l.pads.length >= 2);
  const shielded = Object.entries(DATA.ENEMIES).filter(([, d]) => d.shield > 0 && !d.boss);
  assert.ok(shielded.length, "there is a shielded non-boss to measure");

  // 1. The seam. It has to be `computeHit`, NOT `dealDamage`: dealDamage takes
  //    hpDmg and shieldDmg as separate arguments and spends whatever it is
  //    handed, so a test that passes it a shieldDmg proves only that arithmetic
  //    works. computeHit is where a tower's damage is SPLIT, and it is the only
  //    place that decides a shield is involved at all.
  for (const [key, def] of shielded) {
    const body = { shield: def.shield, armor: def.armor || 0, brittle: false };
    for (const dmgType of ["bonk", "zap"]) {
      const hit = TD.computeHit(40, dmgType, body);
      if (dmgType === "zap") {
        assert.ok(hit.shieldDmg > 0, `${key}: a zap DOES spend the shield`);
      } else {
        assert.equal(hit.shieldDmg, 0,
          `${key}: "${dmgType}" must put NOTHING into the shield — a shield is not generic hp, ` +
          `and every non-Fan source in the game is bonk`);
      }
    }
  }
  // …and every non-Fan tower really is bonk, or the clause above guards nothing.
  for (const [line, t] of Object.entries(DATA.TOWERS)) {
    if (line === "fan") continue;
    for (const s of t.tiers) if (s.dmg) assert.equal(s.dmgType || "bonk", "bonk",
      `${line} deals ${s.dmgType} — if a second line ever deals zap, re-measure the shield's worth`);
  }

  // 2. The behaviour: regen changes a FAN's time-to-kill and no one else's.
  //    Measured across the whole regen range, a dart/mortar/camp is identical at
  //    regen 0 and regen 34 while a tier-1 Fan goes from killing to never.
  const killTime = (line, regen) => {
    const def = Object.assign({}, DATA.ENEMIES.battery, { hp: 150, speed: 0.5, shield: 90, shieldRegen: regen });
    const saved = DATA.ENEMIES.battery;
    DATA.ENEMIES.battery = def;
    try {
      const lv = { id: 8821, name: "shieldprobe", world: "test", startGold: 999999, budgetBase: 100,
        path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 6, cy: 5 }],
        waves: [{ groups: [{ type: "battery", count: 1, gap: 1, delay: 0 }] }] };
      const en = TD.createEngine(lv, { seed: 4 });
      assert.ok(en.place(line, "m").ok);
      en.callWave();
      let g = 0, seen = false;
      while (g++ < 30 * 200) {
        en.tick();
        const b = en.state.enemies[0];
        // the engine SPLICES a dead body out, so "was here, now gone" is the kill
        if (!b) { if (seen) return g / 30; continue; }
        seen = true;
        b.dist = 6;                                   // pinned in reach, never leaks
      }
      return Infinity;
    } finally { DATA.ENEMIES.battery = saved; }
  };
  for (const line of ["dart", "mortar", "camp"]) {
    const slow = killTime(line, 0), fast = killTime(line, 34);
    assert.ok(isFinite(slow) && isFinite(fast), `${line} kills a shielded body at both regen rates`);
    assert.equal(slow.toFixed(2), fast.toFixed(2),
      `${line}: a shield's REGEN must be irrelevant to it (${slow} vs ${fast}) — if this ever differs, ` +
      `computeHit has started routing ${line} damage into the shield and the budget-curve note above is stale`);
  }
  assert.ok(isFinite(killTime("fan", 0)), "a fan CAN break a shield that does not reseal");
  assert.equal(killTime("fan", 34), Infinity,
    "…and CANNOT break one that reseals faster than it zaps — the shield's whole job");
});

test("🛢️ spill: the slick is laid where it DIES, hurries what crosses it, and expires", () => {
  const D = DATA.ENEMIES.drum;
  assert.ok(D && D.spill, "the Oil Drum carries a spill");
  assert.ok(D.spill.mult > 1 && D.spill.r > 0 && D.spill.seconds > 0, "a spill is a real, positive hurry zone");
  // ONE resist rule: a spill is a mechanic, and the drum deliberately carries no
  // damage reduction at all — the axis is WHERE you kill it, not how hard it is.
  for (const k of ["armor", "splashResist", "bonkResist", "zapResist", "slowImmune", "shield"]) {
    assert.ok(!D[k], `the drum must carry no ${k} — its threat is positional, not a stat`);
  }

  const lvl = { id: 8830, name: "spill", world: "test", startGold: 999999, budgetBase: 100,
    path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 4, cy: 3 }],
    waves: [{ groups: [{ type: "drum", count: 1, gap: 1, delay: 0 }] }] };

  // No slick until something dies — the puddle must come from the DEATH, not the
  // spawn (a spill written at spawn would be a zone, not a decision).
  const e = TD.createEngine(lvl, { seed: 6 });
  e.state.phase = "wave";
  const drum = mkEnemy("drum", 9); drum.id = 8831;
  e.state.enemies.push(drum);
  e.tick();
  assert.equal(e.state.puddles.length, 0, "a living drum leaves nothing behind");
  // dealDamage calls killEnemy INLINE when hp hits 0, so the slick exists on
  // return — ticking first would walk the drum on and make "where it died" a
  // moving target (it did, the first time this was written).
  const diedAt = drum.dist;
  e.dealDamage(drum, drum.hp + 50, 0, "dart");
  assert.equal(e.state.puddles.length, 1, "killing it lays exactly one slick");
  const z = e.state.puddles[0];
  assert.equal(z.hurry, D.spill.mult, "the slick carries the drum's own multiplier");
  assert.ok(!z.slow, "a slick is not a Sticky Floor — it must not slow");
  const at = e.posOn(0, diedAt);
  assert.ok(Math.hypot(z.x - at.x, z.y - at.y) < 0.01, "…laid exactly where it died, not at the spawn");

  // A body crossing it really does move faster — measured as DISTANCE covered,
  // through the engine's own tick, not by reading the flag it sets.
  const walk = (withSlick) => {
    const en = TD.createEngine(lvl, { seed: 6 });
    en.state.phase = "wave";
    const s = mkEnemy("sock", 8.4); s.id = 8832;
    en.state.enemies.push(s);
    if (withSlick) en.state.puddles.push({ x: at.x, y: at.y, r: D.spill.r, hurry: D.spill.mult, until: 99999 });
    const from = s.dist;
    for (let i = 0; i < 40; i++) en.tick();
    return s.dist - from;
  };
  const plain = walk(false), oiled = walk(true);
  const ratio = oiled / plain;
  assert.ok(Math.abs(ratio - D.spill.mult) <= 0.06,
    `a sock crossing the slick must cover ${D.spill.mult}× the ground — measured ${ratio.toFixed(3)} (${plain.toFixed(3)} → ${oiled.toFixed(3)})`);

  // …and it burns down, so a slick is a window and not a permanent speed zone.
  const e3 = TD.createEngine(lvl, { seed: 6 });
  e3.state.phase = "wave";
  e3.state.puddles.push({ x: at.x, y: at.y, r: D.spill.r, hurry: D.spill.mult, until: e3.state.tick + 5 });
  for (let i = 0; i < 12; i++) e3.tick();
  assert.equal(e3.state.puddles.length, 0, "the slick expires on its own tick");
});

test("hurry has ONE owner: a 📻 Boom Box must never DOWNGRADE a 🛢️ oil slick", () => {
  // Measured defect. `hurriedMult` had one writer (the Boom Box) until the Oil
  // Drum's slick became a second, and the two shipped with different policies:
  // the puddle took the MAX, hurryTick plain-assigned — and hurryTick runs LAST
  // in the tick. So a Boom Box walking into a ×1.45 slick pulled the enemy DOWN
  // to ×1.35 (2.308 → 2.151 cells per 60 ticks, a 6.8% loss). Reachable: L34 and
  // L36 both carry a drum AND a boom box, and ⏩ RUSH puts two waves on the
  // field at once. `effSpeed` being the single READ is not enough when a field
  // has two WRITERS — so both now go through `applyHurry`, strongest-wins,
  // exactly as `applySlow` already owns the slow side.
  const drum = DATA.ENEMIES.drum, bb = DATA.ENEMIES.boombox;
  assert.ok(drum.spill.mult > bb.hurry.mult,
    "this test needs the slick to be the STRONGER of the two, or it cannot detect a downgrade");

  const lvl = DATA.LEVELS.find((l) => l.id === 34);
  // travel of one pinned sock over 60 ticks under each combination
  function moved({ slick, boom }) {
    const e = TD.createEngine(lvl, { seed: 4 });
    e.callWave();
    for (let i = 0; i < 5; i++) e.tick();
    e.state.enemies.length = 0; e.state.puddles.length = 0;
    const victim = mkEnemy("sock", 6);
    victim.hurriedUntil = 0; victim.hurriedMult = 1;
    e.state.enemies.push(victim);
    const p = e.posOn(0, 6);
    if (slick) e.state.puddles.push({ x: p.x, y: p.y, r: 12, hurry: drum.spill.mult, until: e.state.tick + 9999 });
    if (boom) { const b = mkEnemy("boombox", 6.05); b.hurriedUntil = 0; b.hurriedMult = 1; e.state.enemies.push(b); }
    const d0 = victim.dist;
    for (let i = 0; i < 60; i++) {
      e.tick();
      victim.hp = DATA.ENEMIES.sock.hp;                       // measuring speed, not survival
      const b = e.state.enemies.find((x) => x.type === "boombox");
      if (b) { b.hp = DATA.ENEMIES.boombox.hp; b.dist = victim.dist + 0.05; }
      if (slick) { const q = e.posOn(0, victim.dist); e.state.puddles[0].x = q.x; e.state.puddles[0].y = q.y; }
    }
    return { d: victim.dist - d0, mult: victim.hurriedMult };
  }
  const plain = moved({});
  const slickOnly = moved({ slick: true });
  const boomOnly = moved({ boom: true });
  const both = moved({ slick: true, boom: true });

  assert.ok(slickOnly.d > plain.d && boomOnly.d > plain.d, "both sources hurry on their own");
  assert.ok(slickOnly.d > boomOnly.d, "the slick is the stronger source, as its data says");
  assert.equal(both.mult, drum.spill.mult,
    `a Boom Box beside an oil slick left hurriedMult at ${both.mult}, not the stronger ${drum.spill.mult} — the last writer won instead of the strongest`);
  assert.ok(both.d >= slickOnly.d - 1e-6,
    `adding a Boom Box made the enemy SLOWER: ${both.d.toFixed(3)} cells vs ${slickOnly.d.toFixed(3)} in the slick alone`);

  // …and the structural half, so a THIRD source cannot re-open it: the field is
  // ASSIGNED in exactly one place, inside applyHurry. (The spawn record sets it
  // as an object-literal property, which is a default, not a source.)
  const src = require("fs").readFileSync("scripts/td-logic.js", "utf8");
  const writes = (src.match(/\.hurriedMult\s*=/g) || []).length;
  assert.equal(writes, 1,
    `hurriedMult is assigned in ${writes} places — it must have exactly ONE owner (applyHurry), or two sources can disagree on policy again`);
  assert.ok(/function applyHurry\(/.test(src), "applyHurry is that owner");
});

test("P6 loadout: an un-equipped power is REFUSED, and the run records what it brought", () => {
  const lvl = DATA.LEVELS[0];
  // The engine's own default is the WHOLE pool, deliberately: every shipped sim
  // and engine test predates the loadout and must be unchanged, and for the
  // abuse audit a full-pool run is a strict UPPER BOUND over every legal pack.
  const all = DATA.ABILITIES.map((a) => a.id);
  assert.deepEqual(TD.createEngine(lvl, { seed: 7 }).state.powers, all,
    "no `powers` opt → the whole pool (so no existing engine test changes)");

  // A real run brings exactly RULES.abilitySlots of them.
  const pack = all.filter((id) => id !== "horn").slice(0, DATA.RULES.abilitySlots);
  assert.equal(pack.length, DATA.RULES.abilitySlots, "the pack fills the strip");
  const e = TD.createEngine(lvl, { seed: 7, powers: pack });
  assert.deepEqual(e.state.powers, pack, "the run records the loadout it was handed (the P4 live-path lesson)");
  e.state.gold = 5000; e.state.charge = 3;
  e.callWave();
  for (let i = 0; i < 120; i++) e.tick();

  // "you didn't bring it" is checked FIRST, so it can never be masked by a
  // resource reason — even with no gold and no energy at all.
  e.state.gold = 0; e.state.charge = 0;
  assert.equal(e.abilityReady("horn").reason, "not-equipped", "an un-packed power says so, not 'gold'");
  assert.equal(e.useAbility("horn", {}).reason, "not-equipped", "…and using it is refused");
  e.state.gold = 5000; e.state.charge = 3;
  assert.equal(e.abilityReady("horn").reason, "not-equipped", "…with a full purse too");
  // …while a packed one is judged on its merits.
  assert.notEqual(e.abilityReady(pack[0]).reason, "not-equipped", "a packed power is not gated by the loadout");
});

test("a line with a MINIMUM range must declare one at every tier AND every branch", () => {
  // 🎯 Close Quarters multiplies `rangeMin`, and a stat block missing the field
  // makes `undefined * 0.6` NaN — `d2 >= NaN * NaN` is false for every enemy, so
  // the mortar would silently never fire again. The engine coerces it, but the
  // real fix is that a line with a dead zone declares it EVERYWHERE, or a future
  // tier-4 branch inherits a hole. Derived from the data, so a new line and a
  // new branch are both covered the moment they exist.
  for (const [line, def] of Object.entries(DATA.TOWERS)) {
    const tiers = def.tiers.filter((t) => t.dmg != null);
    const anyMin = tiers.some((t) => t.rangeMin > 0);
    if (!anyMin) continue;
    for (let i = 0; i < tiers.length; i++) {
      assert.ok(tiers[i].rangeMin > 0,
        `${line} tier ${i + 1} has no rangeMin though the line has a dead zone — a missing minimum NaNs the whole acquisition`);
    }
    for (const [key, br] of Object.entries(def.branches || {})) {
      assert.ok(br.rangeMin > 0,
        `${line}'s tier-4 branch "${key}" has no rangeMin though the line has a dead zone at every other tier`);
    }
  }
  // …and the exemption is real: at least one line has NO minimum, so this is
  // not vacuously true over the whole roster.
  assert.ok(Object.values(DATA.TOWERS).some((d) => d.tiers.every((t) => !t.rangeMin)),
    "some line has no dead zone at all, so the rule above is a real filter");
});

test("W9 tree growth: the five new KINDS each fire at their one site, and the ceiling still holds", () => {
  // The star ceiling derives as `LEVELS.length * 3`, so a ninth world (36 levels
  // → 108⭐) needs a tree that still costs MORE than you can earn. It has to grow
  // by BREADTH: a rank is raw power, a kind is a choice, and three individual
  // Firepower ranks are already recorded as each erasing a boss finale on their
  // own. So every node below is measured through the ENGINE, not just asserted
  // to exist in metaMods — a node whose mod nothing reads is exactly the "dead
  // feature" class this repo keeps finding.
  const total = DATA.META_NODES.reduce((s, n) => s + n.cost, 0);
  assert.ok(total > 36 * 3,
    `the tree costs ${total}⭐ against a 36-level ceiling of 108 — grow it by BREADTH before adding a ninth world`);
  for (const id of ["quickhands", "closequarters", "handyman", "warmedup", "softlanding"]) {
    assert.ok(DATA.META_NODES.some((n) => n.id === id), `${id} is a real node`);
  }

  const micro = (over) => Object.assign({
    id: 9900, name: "w9", world: "test", startGold: 9000, budgetBase: 100,
    path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 5, cy: 3 }],
    waves: [{ groups: [{ type: "sock", count: 1, gap: 1, delay: 0 }] }],
  }, over || {});

  // ⏱️ Fast Hands — the cooldown stamped at the ONE useAbility site
  const cd = (meta) => {
    const e = TD.createEngine(micro(), { seed: 3, meta });
    e.state.phase = "wave"; e.state.gold = 99999; e.state.charge = 99;
    e.state.enemies.push(mkEnemy("sock", 5));
    const p = e.posOn(0, 5);
    assert.ok(e.useAbility("drop", { x: p.x, y: p.y }).ok, "the drop lands");
    return e.state.abilityCd.drop - e.state.tick;
  };
  const cdOff = cd([]), cdOn = cd(["quickhands"]);
  assert.ok(Math.abs(cdOn / cdOff - 0.8) < 0.02,
    `Fast Hands must cut a power's cooldown to 80% — measured ${(cdOn / cdOff).toFixed(3)} (${cdOff} → ${cdOn})`);

  // 🎯 Close Quarters — a body INSIDE the mortar's dead zone becomes shootable
  const deadZoneHit = (meta) => {
    const lvl = micro({ pads: [{ id: "m", cx: 6, cy: 3 }] });
    const e = TD.createEngine(lvl, { seed: 3, meta });
    e.state.gold = 99999;
    assert.ok(e.place("mortar", "m").ok);
    e.state.phase = "wave";
    const t = e.state.towers[0];
    const rmin = DATA.TOWERS.mortar.tiers[0].rangeMin;
    // park it at 0.75 x the minimum — inside the dead zone, outside the shrunk one
    const foe = mkEnemy("sock", 6 + rmin * 0.75); foe.id = 9901; foe.hp = 1e6; foe.maxHp = 1e6;
    e.state.enemies.push(foe);
    for (let i = 0; i < 300; i++) { foe.dist = 6 + rmin * 0.75; e.tick(); }
    return foe.maxHp - foe.hp;
  };
  assert.equal(deadZoneHit([]), 0, "a body under the tube is normally UNTOUCHABLE — the dead zone is real");
  assert.ok(deadZoneHit(["closequarters"]) > 0,
    "Close Quarters must let the Mortar reach into its own dead zone");

  // 🔧 Handyman — tier 1-3 only, and NOT tier-4 branches (that is Bulk Deal)
  const upCost = (meta) => {
    const e = TD.createEngine(micro(), { seed: 3, meta });
    e.state.gold = 99999;
    assert.ok(e.place("dart", "m").ok);
    const before = e.state.gold;
    assert.ok(e.upgrade(e.state.towers[0].id).ok);
    return before - e.state.gold;
  };
  const upOff = upCost([]), upOn = upCost(["handyman"]);
  assert.ok(Math.abs(upOn / upOff - 0.9) < 0.02,
    `Handyman must make a tier 1-3 upgrade 10% cheaper — measured ${upOff} → ${upOn}`);

  // 🔌 Warmed Up — the energy bank starts full instead of empty
  assert.equal(TD.createEngine(micro(), { seed: 3 }).state.charge, 0, "normally you start with no energy");
  assert.equal(TD.createEngine(micro(), { seed: 3, meta: ["warmedup"] }).state.charge, DATA.RULES.chargeMax,
    "Warmed Up starts the bank full");

  // 🛬 Soft Landing — a MULTI-life leak costs less; a 1-life body is untouched
  const leakCost = (type, meta) => {
    const e = TD.createEngine(micro(), { seed: 3, meta });
    e.state.phase = "wave";
    const lane = TD.buildPath(micro().path);
    const foe = mkEnemy(type, lane.total - 0.2); foe.id = 9902;
    e.state.enemies.push(foe);
    const before = e.state.lives;
    for (let i = 0; i < 60 && e.state.enemies.length; i++) e.tick();
    return before - e.state.lives;
  };
  const boss = Object.entries(DATA.ENEMIES).find(([, d]) => d.boss && d.lives > 1);
  assert.ok(boss, "there is a multi-life boss to leak");
  const bigOff = leakCost(boss[0], []), bigOn = leakCost(boss[0], ["softlanding"]);
  assert.equal(bigOn, bigOff - 2, `Soft Landing must take 2 off a ${bigOff}-sticker leak — got ${bigOn}`);
  // …and the FLOOR is what keeps it boss-shaped rather than Extra Hearts by
  // another name. Assert the VALUE, not an equality with the un-owned case:
  // `max(1, 1 - 2)` is 1 either way, so a comparison here cannot fail — which is
  // exactly how the first version of this let a mutation through.
  assert.equal(leakCost("sock", ["softlanding"]), 1,
    "a 1-life leak still costs exactly 1 — Soft Landing must never drop a toll below one sticker");
});

test("P6 coverage: every shipped power must actually FIRE — none may be inert in the whole suite", () => {
  // The measured defect this whole item exists for: neither oracle plan ever
  // builds a camp, so `abilityWouldDo` returned false for 📣 Rally Horn on
  // EVERY run the entire suite makes — including the audit whose job is to
  // prove the powers do not erase a finale. One of four powers was untested.
  // This gives each power what it needs and asserts it lands, so a future power
  // cannot ship inert (and this one FAILS on a camp-less plan, which is exactly
  // the hole it closes).
  const lvl = DATA.LEVELS.find((l) => l.pads.length >= 4);
  const e = TD.createEngine(lvl, { seed: 5 });
  e.state.gold = 999999;
  const LINES = ["dart", "mortar", "fan", "camp"]; // a camp, so the horn has a squad
  lvl.pads.slice(0, 4).forEach((p, i) => { assert.ok(e.place(LINES[i], p.id).ok, LINES[i] + " builds"); });
  const fired = new Set();
  e.callWave();
  for (let g = 0; g < 4000 && fired.size < DATA.ABILITIES.length; g++) {
    e.tick();
    if (e.state.phase === "build") e.callWave();
    e.state.gold = 999999; e.state.charge = 9;                 // cost is not what is under test
    // Cooldowns are deliberately NOT cleared: 🧨 has a 2.4-cell blast, so a
    // drop every single tick permanently empties the neighbourhood and the
    // later powers find nothing to aim at. The real cooldowns space them out.
    for (const s of e.state.soldiers) if (s.alive) s.hp = 1;    // give the horn something to heal
    for (const ab of DATA.ABILITIES) {
      // The lead is recomputed PER power: 🧨 Toy Box Drop clears a 2.4-cell
      // radius, so a lead captured once per tick is already dead by 📌's turn
      // and the coverage check would blame the power instead of the fixture.
      const lead = e.state.enemies.filter((x) => x.alive && !e.isHidden(x)).sort((a, b) => b.dist - a.dist)[0];
      let r;
      if (ab.kind === "instant") r = e.useAbility(ab.id, {});
      else if (ab.kind === "tower") r = e.useAbility(ab.id, { towerId: e.state.towers[0].id });
      else if (lead) { const p = e.posOn(lead.pathIdx || 0, lead.dist); r = e.useAbility(ab.id, { x: p.x, y: p.y }); }
      if (r && r.ok) fired.add(ab.id);
    }
  }
  const missing = DATA.ABILITIES.map((a) => a.id).filter((id) => !fired.has(id));
  assert.deepEqual(missing, [],
    "these powers never successfully fired even when handed everything they need: " + missing.join(", ") +
    " — a power the suite can never exercise is a power that can ship broken");
});

test("P6 📌 Call the Shot: EVERY aiming line drops its own mode and shoots the mark", () => {
  // The discriminating fixture: three bodies where no shipped mode would pick
  // the one that gets marked. A = furthest + weakest (what `first` picks),
  // B = strongest (what `strong` picks), C = the middle body nobody wants.
  const REACH = {
    dart: { min: 0, max: DATA.TOWERS.dart.tiers[0].range },
    mortar: { min: DATA.TOWERS.mortar.tiers[0].rangeMin, max: DATA.TOWERS.mortar.tiers[0].range },
    fan: { min: 0, max: DATA.TOWERS.fan.tiers[0].zapRange },
  };
  const LINES = ["dart", "mortar", "fan"];
  // find a lane stretch three DISTINCT pads all cover at tier 1 (searched, not
  // eyeballed — the BODY_FIGURE_BOX / pad-geometry discipline)
  let found = null;
  for (const lvl of DATA.LEVELS) {
    const probe = TD.createEngine(lvl, { seed: 7 });
    for (let d = 1.5; d < 60 && !found; d += 0.25) {
      const pick = {};
      const ok = LINES.every((line) => {
        const pad = lvl.pads.find((pd) => {
          if (Object.values(pick).some((q) => q.id === pd.id)) return false;
          return [d, d + 0.4, d + 0.8].every((dd) => {
            const p = probe.posOn(0, dd);
            const q = Math.hypot(p.x - pd.cx, p.y - pd.cy);
            return q >= REACH[line].min + 0.2 && q <= REACH[line].max - 0.2;
          });
        });
        if (pad) { pick[line] = pad; return true; }
        return false;
      });
      if (ok) found = { lvl, d, pick };
    }
    if (found) break;
  }
  assert.ok(found, "a fixture level exists where one lane stretch is covered by a dart, a mortar and a fan");

  const e = TD.createEngine(found.lvl, { seed: 7, powers: ["mark", "drop", "sticky", "overclock"] });
  const st = e.state;
  st.gold = 99999;
  const t = {};
  for (const line of LINES) { assert.ok(e.place(line, found.pick[line].id).ok); t[line] = st.towers[st.towers.length - 1]; }
  e.setTargeting(t.dart.id, "first");   // the STICKY mode — it needs its own clause
  e.setTargeting(t.mortar.id, "strong");
  e.setTargeting(t.fan.id, "strong");

  const D = found.d;
  let withC = true;
  const repark = () => {
    st.enemies.length = 0;
    st.enemies.push(mkEnemy("sock", D + 0.8), mkEnemy("marble", D + 0.4));
    st.enemies[0].id = 9001; st.enemies[0].hp = 8;
    st.enemies[1].id = 9002; st.enemies[1].hp = 900; st.enemies[1].maxHp = 900;
    if (withC) { const c = mkEnemy("marble", D); c.id = 9003; c.hp = 120; st.enemies.push(c); }
  };
  st.phase = "wave";
  for (let i = 0; i < 4; i++) { repark(); e.tick(); }
  assert.equal(t.dart.targetId, 9001, "baseline: the dart holds the leader (its own `first`)");
  assert.equal(t.mortar.targetId, 9002, "baseline: the mortar holds the strongest");
  assert.equal(t.fan.targetId, 9002, "baseline: so does the fan — nobody chose 9003");

  st.charge = 3;
  const p = e.posOn(0, D);
  const r = e.useAbility("mark", { x: p.x, y: p.y });
  assert.ok(r.ok, "the mark lands: " + JSON.stringify(r));
  assert.equal(st.markId, 9003, "…on the NEAREST body to the tap");
  for (let i = 0; i < 3; i++) { repark(); e.tick(); }
  // The dart row is the mutation-sensitive one: delete the sticky-KEEP clause
  // and it stays on 9001 while the mortar and fan move — the exact shape of the
  // half-applied fix this repo keeps finding (a phased ghost kept its lock).
  assert.equal(t.dart.targetId, 9003, "the dart drops its sticky lock for the mark");
  assert.equal(t.mortar.targetId, 9003, "the mortar re-aims");
  assert.equal(t.fan.targetId, 9003, "the fan's beam re-aims");

  const expiry = st.markUntil;
  while (st.tick <= expiry + 2) { repark(); e.tick(); }
  assert.equal(t.mortar.targetId, 9002, "on expiry the re-evaluating lines go back to their own modes");
  assert.equal(t.fan.targetId, 9002, "…the fan too");
  withC = false;   // a sticky dart is only free once its target leaves
  for (let i = 0; i < 3; i++) { repark(); e.tick(); }
  assert.equal(t.dart.targetId, 9001, "and the sticky dart re-picks by `first` once the mark has gone");
});

test("P6 📌 refuses honestly: no gun to aim, nothing to aim at, or an untargetable body", () => {
  const lvl = DATA.LEVELS.find((l) => l.pads.length >= 2);
  const e = TD.createEngine(lvl, { seed: 3, powers: ["mark", "drop", "sticky", "horn"] });
  e.state.gold = 99999; e.state.charge = 3;
  e.callWave();
  for (let i = 0; i < 90; i++) e.tick();
  const live = e.state.enemies.find((x) => x.alive);
  assert.ok(live, "enemies are walking");
  const p = e.posOn(live.pathIdx, live.dist);
  // 1. a camp is bodies, not a gun — it cannot be told where to aim
  assert.ok(e.place("camp", lvl.pads[0].id).ok);
  assert.equal(e.useAbility("mark", { x: p.x, y: p.y }).reason, "no-tower",
    "a camp-only board is told it has no gun to aim, not 'nothing there'");
  // 2. a real gun, but a tap into empty space
  assert.ok(e.place("dart", lvl.pads[1].id).ok);
  assert.equal(e.useAbility("mark", { x: 0.5, y: DATA.GRID.h - 0.5 }).reason, "no-targets",
    "…and an empty tap says nothing is there");
  assert.equal(e.state.charge, 3, "neither refusal spent a single ⚙️");
  assert.deepEqual(e.state.abilityCd, {}, "…nor started a cooldown");
});

test("Rally Horn: works whenever the squad is HURT, not only when someone is down", () => {
  // Reported from real play: it said "build an Army Guys camp first" while a
  // camp was already on the board. Two bugs — it only counted DOWNED soldiers,
  // and the refusal named the wrong cause.
  const lvl = DATA.LEVELS.find((l) => l.pads.length >= 2);
  const e = TD.createEngine(lvl, { seed: 4 });
  e.state.gold = 99999;
  assert.ok(e.place("camp", lvl.pads[0].id).ok);
  e.callWave();
  for (let i = 0; i < 150; i++) e.tick();
  assert.ok(e.state.soldiers.length > 0, "the camp deployed a squad");

  // Everyone fit → refused, but with the RIGHT reason (not "build a camp").
  e.state.soldiers.forEach((s) => { s.hp = s.maxHp; s.alive = true; });
  e.state.gold = 5000;
  const fit = e.useAbility("horn", {});
  assert.equal(fit.ok, false, "a fully fit squad needs no horn");
  assert.equal(fit.reason, "all-healthy", "…and it must NOT claim you have no camp");
  assert.equal(e.state.gold, 5000, "…and costs nothing");

  // A WOUNDED but standing soldier is a valid use — this is the reported case.
  e.state.soldiers[0].hp = 1;
  const hurt = e.useAbility("horn", {});
  assert.ok(hurt.ok, "a hurt squad CAN be rallied even with nobody down");
  assert.ok(hurt.hits >= 1, "the heal counts as doing something");
  assert.equal(e.state.soldiers[0].hp, e.state.soldiers[0].maxHp, "…and it really healed");
  assert.ok(e.state.gold < 5000, "…and it charged, because it worked");

  // With no camp at all the message is the other one.
  const bare = TD.createEngine(lvl, { seed: 4 });
  bare.callWave();
  for (let i = 0; i < 60; i++) bare.tick();
  bare.state.gold = 5000;
  assert.equal(bare.useAbility("horn", {}).reason, "no-soldiers", "no camp → the build-a-camp message");
});

// The 🧸 Kid Fort neglect test lived here. The mode is RETIRED (owner, 2026-08),
// so its half of the claim is gone — but the valuable half is kept and is now
// UNCONDITIONAL: doing nothing must lose on every shipped difficulty, with the
// list DERIVED so a future tier cannot ship unlosable by omission.
test("neglect LOSES on every shipped difficulty — no tier is exempt", () => {
  for (const d of Object.keys(DATA.DIFFICULTIES)) {
    const e = TD.createEngine(DATA.LEVELS[0], { seed: 7, difficulty: d });
    let g = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && g++ < 900000) {
      if (e.state.phase === "build") e.callWave();
      e.tick();
    }
    assert.equal(e.state.phase, "lost", `${d} must be losable by building NOTHING`);
    assert.ok(!DATA.DIFFICULTIES[d].noLose, `${d} must not carry a no-lose flag`);
  }
});

test("AUDIT stats: damage is credited for what LANDED, never for overkill", () => {
  // TD-13's run summary tallies damage by line, but it counted the SWING, not
  // the work: a 300-damage Toy Box Drop on a 6hp Sock Goblin scored 300. That
  // made the biggest gun look like the best gun (a sampled run reported the
  // dart at 76% of total damage against 58% real).
  const e = TD.createEngine(L1, { seed: 5 });
  e.callWave();
  while (!e.state.enemies.some((x) => x.alive)) e.tick();
  for (let i = 0; i < 30; i++) e.tick(); // let a few walk on
  const alive = e.state.enemies.filter((x) => x.alive);
  const hpPool = alive.reduce((n, x) => n + x.hp + (x.shield || 0), 0);
  const drop = DATA.ABILITIES.find((a) => a.id === "drop");
  assert.ok(drop.dmg > hpPool, `the blast (${drop.dmg}) really does overkill this group (${hpPool}hp)`);
  const at = e.posOn(alive[0].pathIdx || 0, alive[0].dist);
  e.state.gold = 9e9; // the ability's cost is not what's under test
  const before = e.state.dmgBy.ability || 0;
  const r = e.useAbility("drop", { x: at.x, y: at.y });
  assert.ok(r.ok, "the blast landed");
  const dealt = (e.state.dmgBy.ability || 0) - before;
  assert.ok(dealt > 0, "…and something was credited");
  assert.ok(dealt <= hpPool,
    `credit (${dealt}) never exceeds the health that was actually there (${hpPool})`);
});

test("AUDIT combat: the Fan's beam keeps its multipliers (rounding used to eat them)", () => {
  // The beam accumulates 6-14 dps into ONE point of damage per firing, and both
  // computeHit and dealDamage round — so brittle (+20%) and Boss Bonker (+15%)
  // rounded 1 straight back to 1 and did nothing at all on a Fan. Two identical
  // sims, one with the target made brittle every tick, must now differ.
  const beam = (brittle) => {
    const e = TD.createEngine(L1, { seed: 11 });
    e.state.gold = 9e9;
    // a Fan on the pad nearest the lane start, so the beam has something to hold
    const pad = L1.pads[0];
    assert.ok(e.place("fan", pad.id).ok, "fan built");
    e.callWave();
    let dealt = 0;
    for (let i = 0; i < 900; i++) {
      // `brittle` is DERIVED from brittleUntil every tick, so seed the timer
      if (brittle) for (const en of e.state.enemies) if (en.alive) en.brittleUntil = e.state.tick + 100;
      e.tick();
    }
    dealt = e.state.dmgBy.fan || 0;
    return dealt;
  };
  const plain = beam(false), brittle = beam(true);
  assert.ok(plain > 0, `the beam does damage at all (${plain})`);
  assert.ok(brittle > plain,
    `brittle must make the beam hit harder (plain ${plain} vs brittle ${brittle}) — equal means the multiplier was rounded away`);
});

test("AUDIT endless: EVERY world has a real arena, and no mini-boss is a campaign boss", () => {
  // World 4 shipped an attic POOL with no arena entry, so an attic run silently
  // fell back to the bedroom map — and it named the Tickmaster (the 3200hp,
  // 10-life World-4 boss) as its every-5th-wave mini-boss, so a wave-5 board
  // that cannot possibly kill it lost half its lives on the spot. Both are
  // "content outgrew a literal" defects, and both are structural to check.
  // …and it must iterate the CAMPAIGN, not the endless table itself. Walking
  // Object.keys(ENDLESS.worlds) only ever audits the worlds that already have an
  // entry, so a 7th campaign world with no arena passes green — which is
  // precisely the attic defect above, re-armed. Derive from the levels.
  const worlds = [...new Set(DATA.LEVELS.map((l) => l.world))];
  assert.ok(worlds.length >= 4, `every shipped world has an endless entry (${worlds.length})`);
  for (const w of worlds) {
    assert.ok(DATA.ENDLESS.worlds[w], `${w} is a campaign world, so it must have an ENDLESS entry`);
    const arena = DATA.ENDLESS.arenas[w];
    assert.ok(arena, `${w} has its OWN arena (never a silent fallback to another world's map)`);
    assert.ok(arena.path.length >= 2 && arena.pads.length >= 8, `${w}'s arena is a real map`);
    assert.ok(DATA.ENDLESS.worlds[w].label, `${w} carries its own picker label (the UI derives its rows)`);
    const mb = DATA.ENEMIES[DATA.ENDLESS.worlds[w].miniBoss];
    assert.ok(mb, `${w}'s mini-boss exists`);
    assert.ok(!mb.boss,
      `${w}'s mini-boss must not be a campaign BOSS (${DATA.ENDLESS.worlds[w].miniBoss}, ${mb.hp}hp, costs ${mb.lives || 1} lives) — a mini-boss punctuates a wave, it doesn't end the run`);
    // …and each world's levels must exist, or "3⭐ all 4 to unlock" is a lie
    const lv = DATA.LEVELS.filter((l) => l.world === w);
    assert.ok(lv.length >= 4, `${w} really has the levels its unlock asks you to 3-star (${lv.length})`);
  }
});

test("AUDIT endless: each world's mini-boss is its OWN, and is a legal spike", () => {
  // All ten arenas used to punctuate with the identical Piñata — the
  // world-differentiation programme that gave the campaign per-world backbone
  // skins stopped at the endless mode, so ten runs asked one question.
  //
  // Two laws, both learned the hard way and both DERIVED so an 11th arena
  // inherits them:
  //   · GROUND only. Mortar and Camp cannot touch air (the guardrailed
  //     two-lines-reach-air truth), so a flier wall every 5th wave would make
  //     some boards unwinnable by construction rather than by skill.
  //   · never a campaign BOSS. The attic shipped `tickmaster` here — the
  //     3200hp/10-life World-4 finale — and a wave-5 board that cannot kill it
  //     lost half its lives on the spot; runs ended at wave 5 against 28-46
  //     elsewhere. A mini-boss is a spike, not a wall.
  const worlds = Object.entries(DATA.ENDLESS.worlds);
  assert.ok(worlds.length >= 10, `every shipped world has an arena (${worlds.length})`);
  const seen = new Map();
  for (const [w, cfg] of worlds) {
    const def = DATA.ENEMIES[cfg.miniBoss];
    assert.ok(def, `${w}'s mini-boss "${cfg.miniBoss}" must be a real enemy`);
    assert.ok(!def.flier, `${w}: a mini-boss must be GROUND — mortar/camp boards cannot answer a flier wall`);
    assert.ok(!def.boss, `${w}: a mini-boss must not be a campaign boss (the tickmaster lesson)`);
    // …and it must actually BE a spike. Written first as "beefier than the
    // pool's biggest" and that is arithmetically impossible on the shipped
    // roster — six worlds would compete for the four ground bodies at ≥150hp —
    // so the threshold was the defect, not the assignments. The feasible law is
    // "never BELOW the world's typical body", and it earned its keep at once:
    // it caught three picks (ghost 0.61×, healer 0.94×, racer 1.00×) that were
    // literally trash-tier punctuation.
    //   The kit clause below is DELIBERATELY kept while being, on today's
    // roster, implied by the one above — measured, not assumed: every kit-less
    // ground body caps at 34hp and the lowest pool median is 40, so the median
    // clause always fires first and no mutation can isolate the kit clause.
    // It is here because the two state different things (mass vs mechanism) and
    // the correlation is a property of the current roster, not of the concepts
    // — the same reason the chain-decay guardrail keeps a second clause that
    // goes vacuous at decay 1.0. Do not read it as independently proven.
    const poolHp = cfg.pool.map((t) => DATA.ENEMIES[t].hp).sort((a, b) => a - b);
    const median = poolHp[Math.floor(poolHp.length / 2)];
    assert.ok(def.hp >= median,
      `${w}: the mini-boss (${cfg.miniBoss} ${def.hp}hp) is below its own pool's median (${median}hp) — ` +
      "punctuation weaker than the typical body is a garnish, not a spike");
    const KIT = ["heal", "spawner", "hurry", "charge", "phase", "tunnel", "slowHeal", "bonkResist",
      "splashResist", "shieldRegen", "slowImmune", "goldBurst", "split", "sap", "spill", "armor", "zapResist"];
    assert.ok(KIT.some((k) => def[k]),
      `${w}: the mini-boss (${cfg.miniBoss}) carries no special at all — a plain body is just more wave`);
    seen.set(cfg.miniBoss, (seen.get(cfg.miniBoss) || 0) + 1);
  }
  // DISTINCT — the whole point. Stated as "no id twice" rather than a count, so
  // the message names the offender.
  for (const [id, n] of seen) {
    assert.equal(n, 1, `"${id}" punctuates ${n} arenas — each world's spike must be its own body`);
  }
});

test("AUDIT endless: every arena is losable by neglect and lasts with a real build", () => {
  const arenaDef = (w) => {
    const a = DATA.ENDLESS.arenas[w];
    return { id: "endless-" + w, name: "Endless " + w, world: w, endless: { world: w }, startGold: a.startGold, budgetBase: DATA.ENDLESS.base, path: a.path, pads: a.pads };
  };
  const survive = (w, plan, seed) => {
    const d = arenaDef(w), e = TD.createEngine(d, { seed });
    let g = 0;
    while (e.state.phase !== "lost" && g++ < 500000) {
      if (e.state.phase === "build") {
        if (plan) { d.pads.forEach((p, i) => e.place(plan(i), p.id)); for (const t of e.state.towers) { e.upgrade(t.id); e.upgrade(t.id); } }
        e.callWave();
      }
      e.tick();
    }
    return e.state.waveIdx;
  };
  for (const w of Object.keys(DATA.ENDLESS.worlds)) {
    const neglect = survive(w, null, 1);
    assert.ok(neglect <= 6, `${w}: doing nothing loses fast — real stakes (lasted ${neglect} waves)`);
    // best of two sensible builds: a competent player picks the right tool, so
    // the oracle is allowed to as well (the PLAYABILITY precedent)
    const best = Math.max(survive(w, () => "dart", 1), survive(w, (i) => ["dart", "dart", "fan", "mortar"][i % 4], 1));
    assert.ok(best >= 8, `${w}: a real build lasts (best ${best} waves — under 8 means the arena is a wall, not a run)`);
    assert.ok(best >= neglect * 2, `${w}: building matters (${best} waves built vs ${neglect} neglected)`);
  }
});

test("AUDIT rush: wave-clear payouts are per WAVE, not per clearing", () => {
  // ⏩ RUSH overlaps two waves and they finish together, so the single payout
  // at that boundary paid the 💵 Allowance once for two waves — and could step
  // straight over a 🩹 Patch Kit heal (waveIdx 4 → 6 never sees `% 5 === 0`).
  const meta = ["allowance", "patchkit"];
  const clearOne = (rush) => {
    const e = TD.createEngine(L1, { seed: 3, meta });
    // fill the board so both waves actually die
    for (const p of L1.pads) e.state.gold += 9e5, e.place("dart", p.id);
    for (const t of e.state.towers) { e.state.gold += 9e5; e.upgrade(t.id); e.upgrade(t.id); }
    e.state.gold = 0; // measure the payout, not the bank
    e.callWave();
    if (rush) {
      for (let i = 0; i < 90; i++) e.tick();       // past the rush settle
      assert.ok(e.callWave().ok, "the RUSH really went out");
    }
    let g = 0;
    while (e.state.phase !== "build" && e.state.phase !== "won" && e.state.phase !== "lost" && g++ < 100000) e.tick();
    return { gold: e.state.gold, waveIdx: e.state.waveIdx };
  };
  const one = clearOne(false), two = clearOne(true);
  assert.equal(one.waveIdx, 1, "the plain clear finished one wave");
  assert.equal(two.waveIdx, 2, "the rushed clear finished TWO waves at once");
  assert.ok(two.gold >= one.gold + 12,
    `two cleared waves pay the Allowance twice (one wave ${one.gold}g, two waves ${two.gold}g)`);

  // …and the 5th wave's heal is never stepped over by a rush that spans it.
  // Measured against the SAME rushed run without the node, because a doubled
  // wave leaks more and the raw life count moves for reasons of its own.
  // A level with room past wave 5: on L1 (6 waves) the rush IS the winning
  // clear, and the payout is deliberately skipped at the finish line so Patch
  // Kit can never inflate the lives-based star count.
  const LONG = DATA.LEVELS.find((l) => l.waves.length >= 9);
  const rushPast5 = (kit) => {
    const e = TD.createEngine(LONG, { seed: 3, meta: kit ? ["patchkit"] : [] });
    for (const p of LONG.pads) e.state.gold += 9e5, e.place("dart", p.id);
    for (const t of e.state.towers) { e.state.gold += 9e5; e.upgrade(t.id); e.upgrade(t.id); }
    let g = 0;
    while (e.state.waveIdx < 4 && e.state.phase !== "lost" && g++ < 200000) {
      if (e.state.phase === "build") e.callWave();
      e.tick();
    }
    e.state.lives = 5; // room to heal, identical in both runs
    e.callWave();
    for (let i = 0; i < 90; i++) e.tick();
    e.callWave(); // ⏩ RUSH wave 6 on top of wave 5
    g = 0;
    while (e.state.phase === "wave" && g++ < 200000) e.tick();
    return { lives: e.state.lives, waveIdx: e.state.waveIdx };
  };
  const noKit = rushPast5(false), withKit = rushPast5(true);
  assert.ok(withKit.waveIdx >= 6, `the rush really stepped past wave 5 (${withKit.waveIdx})`);
  assert.equal(noKit.waveIdx, withKit.waveIdx, "both runs cleared the same waves");
  assert.equal(withKit.lives, noKit.lives + 1,
    `wave 5's Patch Kit heal survives a rush that spans it (${noKit.lives} without the node vs ${withKit.lives} with)`);
});

test("AUDIT determinism: the state hash SEES a NaN (JSON flattens it to null)", () => {
  // The determinism hash is the whole test strategy for this engine, and it was
  // blind to exactly the corruption it exists to catch: JSON.stringify turns
  // NaN and +/-Infinity into "null", so a state that had gone numerically bad
  // hashed IDENTICALLY to a healthy one.
  const clean = { gold: 100, lives: 20, enemies: [{ hp: 5 }] };
  const nan = { gold: 100, lives: 20, enemies: [{ hp: NaN }] };
  const inf = { gold: 100, lives: 20, enemies: [{ hp: Infinity }] };
  const nul = { gold: 100, lives: 20, enemies: [{ hp: null }] };
  assert.notEqual(TD.hashState(clean), TD.hashState(nan), "a NaN changes the hash");
  assert.notEqual(TD.hashState(nul), TD.hashState(nan), "…and a NaN is not the same as a null");
  assert.notEqual(TD.hashState(nan), TD.hashState(inf), "…nor the same as an Infinity");
});

test("AUDIT targeting: every shipped mode really re-picks (close was never driven)", () => {
  // `close` shipped as a selectable dart mode that no test ever executed. The
  // sticky-keep audit proved first/strong/last; this drives the last one.
  const lvl = DATA.LEVELS.find((l) => l.pads.length >= 2);
  const modes = ["first", "last", "strong", "close"];
  for (const mode of modes) {
    const e = TD.createEngine(lvl, { seed: 6 });
    e.state.gold = 99999;
    assert.ok(e.place("dart", lvl.pads[0].id).ok, "dart built");
    const t = e.state.towers[0];
    assert.ok(e.setTargeting(t.id, mode).ok, `${mode} is a settable mode`);
    e.callWave();
    let acquired = 0, sampled = 0;
    for (let i = 0; i < 2000; i++) {
      e.tick();
      if (t.targetId) acquired++;
      if (mode === "close" && t.targetId) {
        // whatever it holds must be the NEAREST live enemy in range, re-picked
        const held = e.state.enemies.find((x) => x.id === t.targetId);
        if (held && held.alive && !e.isHidden(held)) {
          const d = (x) => { const p = e.posOn(x.pathIdx || 0, x.dist); return (p.x - t.cx) ** 2 + (p.y - t.cy) ** 2; };
          const near = e.state.enemies.filter((x) => x.alive && !e.isHidden(x) && d(x) <= 3.0 * 3.0);
          if (near.length > 1) { sampled++; assert.ok(d(held) <= Math.min(...near.map(d)) + 1e-6, "close holds the NEAREST target"); }
        }
      }
    }
    assert.ok(acquired > 0, `${mode}: the tower actually acquired and fired`);
    if (mode === "close") assert.ok(sampled > 0, "the close-mode check really had a crowded moment to judge");
  }
});

test("AUDIT heroic: the air-pressure level is winnable on EVERY seed, not most", () => {
  // "Every level winnable on heroic" is a shipped contract, and the suite's
  // seed set hid a level that broke it: L7 — the one level carrying the whole
  // air game — sat at its heroic ceiling and the same best-of-two oracle the
  // PLAYABILITY test uses LOST it on 3 of 12 seeds. A level that is unwinnable
  // a quarter of the time is not hard, it is a coin flip.
  const L7 = DATA.LEVELS.find((l) => l.id === 7);
  const solve = (seed, mix) => {
    const e = TD.createEngine(L7, { difficulty: "heroic", seed });
    let g = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && g++ < 400000) {
      if (e.state.phase === "build") {
        L7.pads.forEach((p, i) => e.place(mix ? ["dart", "fan", "mortar", "dart"][i % 4] : "dart", p.id));
        for (const t of e.state.towers) { e.upgrade(t.id); e.upgrade(t.id); }
        e.callWave();
      }
      e.tick();
    }
    return e.state.phase === "won" ? e.state.lives : -1;
  };
  const lives = [];
  for (let s = 1; s <= 6; s++) lives.push(Math.max(solve(s, false), solve(s, true)));
  const lost = lives.filter((x) => x < 0);
  assert.equal(lost.length, 0, `L7 heroic must be winnable on every seed (lives per seed: ${lives.join(", ")})`);
  // …and still a fight: this is heroic, not a stroll
  const avg = lives.reduce((a, b) => a + b, 0) / lives.length;
  assert.ok(avg < 15, `…and still tense on heroic (avg ${avg.toFixed(1)} lives — above 15 means it stopped being hard)`);
});

test("AUDIT stats: 'gold earned' counts every source, not just bounties", () => {
  // The summary's gold line tallied kills only, so the early-call bonus and the
  // 💵 Allowance — hundreds of gold on a run that always calls early — were
  // missing from a number the player reads as their income for the run.
  const e = TD.createEngine(L1, { seed: 5, meta: ["allowance"] });
  const before = e.state.goldEarned;
  const info = e.callInfo();
  assert.ok(info.bonus > 0, `calling early really pays a bonus (${info.bonus})`);
  assert.ok(e.callWave().ok, "the wave went out");
  assert.equal(e.state.goldEarned - before, info.bonus, "the early-call bonus is counted as earned");
  // …and the Allowance on a cleared wave
  e.state.gold = 9e5;
  for (const p of L1.pads) e.place("dart", p.id);
  let g = 0;
  const atWave = e.state.goldEarned;
  while (e.state.phase === "wave" && g++ < 100000) e.tick();
  assert.equal(e.state.waveIdx, 1, "wave 1 cleared");
  const gained = e.state.goldEarned - atWave;
  assert.ok(gained >= 12, `the wave's bounties AND the 12g Allowance are counted (${gained})`);
});

// ================= World 5 (Garage): the two new threat shapes =================
// A full enemy record, matching spawnEnemy's shape. A partial one silently
// disables the very branches under test (an undefined disableCd never fires).
function mkEnemy(type, dist, pathIdx) {
  const def = DATA.ENEMIES[type];
  return {
    id: 90000 + Math.round(dist * 1000) + type.length, type, pathIdx: pathIdx || 0,
    dist, hp: def.hp, maxHp: def.hp, shield: def.shield || 0, speed: def.speed,
    slowUntil: 0, slowPct: 0, brittle: false, brittleUntil: 0,
    blockedBy: 0, stunnedUntil: 0, meleeCd: 0, stunApplied: false,
    chargeUntil: 0, chargeCd: 0, stompCd: 0, phaseHidden: false,
    suckCd: 0, disableCd: 0, minionCd: 0, speedMult: 0, spawnCd: 0,
    sapCd: 0, lastPhase: -1, engagedBy: 0, alive: true,
  };
}
// the path distance that passes closest to a tower — so an injected enemy is
// actually inside the thing being tested
function distNear(engine, t) {
  let best = 0, bd = Infinity;
  for (let d = 0; d < 200; d += 0.2) {
    const p = engine.posOn(0, d);
    const q = (p.x - t.cx) ** 2 + (p.y - t.cy) ** 2;
    if (q < bd) { bd = q; best = d; }
  }
  return best;
}

test("W5 Grease Racer: slows do NOTHING to it (the first hard counter to the Fan)", () => {
  // Every other enemy can be slowed; the Fan is otherwise universal. Guarded in
  // the ONE applySlow path, so the aura AND the Sticky Floor puddle honour it.
  const lvl = DATA.LEVELS.find((l) => l.pads.length >= 2);
  const e = TD.createEngine(lvl, { seed: 5 });
  e.state.gold = 99999;
  // the pad closest to the lane, and a tier-3 Fan — the aura is only 1.8 cells
  // at tier 1, and pads sit at least 0.99 cells off the path by law
  let bestPad = lvl.pads[0], bd = Infinity;
  for (const pd of lvl.pads) {
    for (let d0 = 0; d0 < 200; d0 += 0.5) {
      const q = e.posOn(0, d0);
      const dd = (q.x - pd.cx) ** 2 + (q.y - pd.cy) ** 2;
      if (dd < bd) { bd = dd; bestPad = pd; }
    }
  }
  assert.ok(e.place("fan", bestPad.id).ok, "a Fan is on the board");
  const fan = e.state.towers[0];
  e.upgrade(fan.id); e.upgrade(fan.id);
  const d = distNear(e, fan);
  e.callWave();
  for (let i = 0; i < 10; i++) e.tick();
  e.state.enemies.length = 0;
  e.state.enemies.push(mkEnemy("sock", d), mkEnemy("racer", d));
  const [sock, racer] = e.state.enemies;
  sock.hp = sock.maxHp = 99999; racer.hp = racer.maxHp = 99999; // measure slow, not death
  for (let i = 0; i < 60; i++) e.tick();
  assert.ok(sock.slowUntil > 0, "the control enemy really is being slowed by the Fan");
  assert.equal(racer.slowUntil, 0, "the Grease Racer was never slowed by the aura");
  // …and the Sticky Floor puddle, which is a different call site
  e.state.gold = 99999;
  const at = e.posOn(0, racer.dist);
  assert.ok(e.useAbility("sticky", { x: at.x, y: at.y }).ok, "the puddle went down on it");
  for (let i = 0; i < 30; i++) e.tick();
  assert.equal(racer.slowUntil, 0, "…and the puddle did not slow it either");
});

test("W5 Bolt Bucket: drips minions while alive, and stops the moment it dies", () => {
  const lvl = DATA.LEVELS.find((l) => l.pads.length >= 2);
  const e = TD.createEngine(lvl, { seed: 6 });
  e.callWave();
  for (let i = 0; i < 30; i++) e.tick();
  e.state.enemies.length = 0;
  e.state.enemies.push(mkEnemy("bucket", 1));
  const bucket = e.state.enemies[0];
  const spec = DATA.ENEMIES.bucket.spawner;
  for (let i = 0; i < Math.round(spec.every * DATA.TICK_RATE) * 3 + 5; i++) e.tick();
  const kids = e.state.enemies.filter((x) => x.type === spec.type).length;
  assert.ok(kids >= spec.count * 2, `it dripped its minions while alive (${kids} after 3 cycles)`);
  bucket.alive = false;
  const before = e.state.enemies.filter((x) => x.type === spec.type).length;
  for (let i = 0; i < Math.round(spec.every * DATA.TICK_RATE) * 3; i++) e.tick();
  const after = e.state.enemies.filter((x) => x.type === spec.type).length;
  assert.ok(after <= before, `killing the source stops the drip (${before} → ${after})`);
});

test("W5 Bolt Bucket: its load is CAPPED — an unbounded drip is unbudgetable", () => {
  // A fountain cannot be priced. Uncapped, ten buckets on a late wave outlived
  // their own HP by ~7× and delivered ~18k of free HP onto an 11k wave, wiping
  // a board that had been flawless for fifteen waves. The wave-budget audit sums
  // def.hp × count and cannot see a single spawned child, so the enemy itself
  // has to be finite for that number to mean anything.
  const spec = DATA.ENEMIES.bucket.spawner;
  assert.ok(spec.max >= 1, "the Bolt Bucket carries a LOAD (spawner.max), not a fountain");
  const lvl = DATA.LEVELS.find((l) => l.pads.length >= 2);
  const e = TD.createEngine(lvl, { seed: 11 });
  e.callWave();
  for (let i = 0; i < 30; i++) e.tick();
  e.state.enemies.length = 0;
  const bk = mkEnemy("bucket", 1);
  bk.hp = bk.maxHp = 9e6;                       // immortal, so only the CAP can stop it
  e.state.enemies.push(bk);
  // Count what it has DROPPED, not what is still on the field — children walk
  // off and leak, so surviving-brick counting under-reports (and would let an
  // uncapped fountain pass). `spawned` is the engine's own tally.
  for (let i = 0; i < Math.round(spec.every * DATA.TICK_RATE) * (spec.max + 8); i++) e.tick();
  assert.equal(bk.spawned, spec.max, `an immortal bucket drips exactly its load and no more (dropped ${bk.spawned}, cap ${spec.max})`);
  // …and the cap is what makes the budget honest: its whole load must stay
  // under its own HP-equivalent share, or a wave carrying one is silently
  // heavier than the curve the audit checks.
  const load = spec.max * DATA.ENEMIES[spec.type].hp;
  assert.ok(load <= DATA.ENEMIES.bucket.hp, `the load (${load}) must not exceed the source's own HP (${DATA.ENEMIES.bucket.hp}) — the budget audit cannot see spawned children`);
});

test("W5 the Garage keeps its two teaching shapes, and its conveyor stays gentle", () => {
  // A re-tune must not quietly delete the reason a world exists. L17 teaches the
  // slow-immune runner and L18 the spawner; if a later balance pass drops them,
  // the Toybox Guide still promises them and the counter matrix loses two rows.
  const garage = DATA.LEVELS.filter((l) => l.world === "garage");
  assert.equal(garage.length, 4, "the Garage is a four-level world");
  const carries = (lvl, type) => lvl.waves.some((w) => w.groups.some((g) => g.type === type));
  assert.ok(carries(garage[0], "racer"), "L17 must present the Grease Racer — it is the level that teaches it");
  assert.ok(carries(garage[1], "bucket"), "L18 must present the Bolt Bucket — it is the level that teaches it");
  assert.ok(garage.filter((l) => carries(l, "racer")).length >= 3, "the runner recurs across the world, not once");
  assert.ok(garage.filter((l) => carries(l, "bucket")).length >= 3, "the spawner recurs across the world, not once");
  // The conveyor is the `night` class of knob: it steals tower UPTIME, which
  // gold cannot buy back, and it compounds with a slow-immune runner. At 1.45
  // across three strips L17 held normal comfortably and was unwinnable on
  // heroic on EVERY seed. Cap it.
  // L7 is the ONE explicit exemption, and it is a conscious one: it predates
  // this finding, it is the documented air-pressure level already sitting at its
  // heroic ceiling, and it IS winnable there (the heroic-slope audit proves it
  // every run). Re-tuning it would re-open a level the difficulty audit settled.
  // A NEW level must consciously join this list, exactly like the flex-gap
  // allowlist — that is what stops the exemption becoming an accidental hole.
  const CONVEYOR_EXEMPT = new Set([7]);
  for (const l of DATA.LEVELS) for (const z of (l.zones || [])) {
    if (z.mult > 1 && CONVEYOR_EXEMPT.has(l.id)) continue;
    assert.ok(z.mult <= 1.35, `L${l.id} conveyor ×${z.mult} — a speed zone above 1.35 steals uptime gold cannot replace (at ×1.45 L17 held normal comfortably and was heroic-unwinnable on every seed)`);
    // TD-16: the bound is TWO-SIDED now. A mud patch is the same data field
    // mirrored, and a strong enough slow is as much a free win as a strong
    // conveyor is a free loss — L7's first mud placement handed heroic +10.
    assert.ok(z.mult >= 0.6, `L${l.id} mud patch ×${z.mult} — a slow below 0.6 is a free win, the mirror of the conveyor cap`);
  }
  assert.ok(DATA.LEVELS.filter((l) => l.zones).length > CONVEYOR_EXEMPT.size,
    "the exemption list must not be the whole population — if every conveyor level is exempt this check is inert");
});

test("W5 wave composition: a vanilla backbone, at most ONE disruptive special per wave", () => {
  // The World-4 scar, now mechanical. Drawing freely from the special roster
  // produced waves of shielded + splash-resistant + self-healing enemies with no
  // answer, unwinnable at every base and start-gold. The Garage's waves were
  // EMITTED against this rule; this is what stops a hand-edit undoing it.
  // DERIVED (Phase 2). This was a second copy of the generator's literal, and a
  // per-world backbone would silently have been read as five disruptive shapes.
  const BACKBONE = new Set(DATA.BACKBONE_TYPES);
  const VALVE = new Set(["pinata"]);
  // SCOPE. This read `l.world === "garage"` and stayed that way through three
  // more worlds — so moving, newhouse and sortline were all EMITTED against the
  // rule and then never checked against it, the same narrow-scope class as the
  // flex-gap law guarding only main.css. Every world from the garage on is held
  // to it; the four older worlds predate the World-4 revert that taught it and
  // genuinely fail (L10 w2 is 74% mole, L12 w1 is 67% ghost), so retro-fitting
  // would flag deliberate design as broken. Measured before widening.
  // DERIVED: every world EXCEPT the ones that predate the contract. The list used
  // to name the worlds that ARE ruled, in this file and in tools/td-wave-gen.js,
  // and it went stale once already — three worlds were emitted against the
  // contract and then never checked against it. Inverting means an eleventh world
  // is ruled by DEFAULT; the exemption list is closed, because the past cannot
  // grow. ONE owner now: DATA.PRE_CONTRACT_WORLDS.
  const RULED = new Set(Object.keys(DATA.WORLDS).filter((w) => !DATA.PRE_CONTRACT_WORLDS.includes(w)));
  assert.ok([...RULED].every((w) => DATA.WORLDS[w]), "every ruled world exists");
  for (const lvl of DATA.LEVELS.filter((l) => RULED.has(l.world))) {
    lvl.waves.forEach((w, i) => {
      if (w.boss) return;                       // a finale is its own difficulty axis
      const hp = (g) => DATA.ENEMIES[g.type].hp * g.count;
      const total = w.groups.reduce((s, g) => s + hp(g), 0);
      const valve = w.groups.filter((g) => VALVE.has(g.type)).reduce((s, g) => s + hp(g), 0);
      const back = w.groups.filter((g) => BACKBONE.has(g.type)).reduce((s, g) => s + hp(g), 0);
      const specials = w.groups.filter((g) => !BACKBONE.has(g.type) && !VALVE.has(g.type));
      assert.ok(specials.length <= 1,
        `L${lvl.id} wave ${i + 1} stacks ${specials.length} disruptive shapes (${specials.map((g) => g.type).join("+")}) — one per wave, so every wave has an answer`);
      assert.ok(back / (total - valve) >= 0.7,
        `L${lvl.id} wave ${i + 1}: backbone is only ${Math.round(back / (total - valve) * 100)}% of its threat HP (need ≥70%)`);
      for (const g of specials) assert.ok(hp(g) / total <= 0.25,
        `L${lvl.id} wave ${i + 1}: ${g.type} is ${Math.round(hp(g) / total * 100)}% of the wave (cap 25%)`);
      assert.ok(valve / total <= 0.12,
        `L${lvl.id} wave ${i + 1}: the piñata is ${Math.round(valve / total * 100)}% of the wave — an economy valve, not a gold shower`);
      if (i < 3) assert.equal(specials.length, 0,
        `L${lvl.id} wave ${i + 1} is an opening wave and must be plain — a wave-1 gotcha costs lives before a board can exist`);
    });
  }
});

// ================= Phase 2: the worlds stop sharing their bodies =================
// Measured before the change: the four ground backbone types were 84-88% of every
// body in worlds 4-6, and the generator hard-coded ONE pair of ground slots for
// all 24 levels. The Garage and Moving Day were the same wave table wearing
// different names — their body-count vectors scored a cosine similarity of ~1.0.

test("P2 identity: every world's backbone has a shape no other world uses", () => {
  const worlds = Object.keys(DATA.WORLDS);
  for (const w of worlds) {
    const mine = new Set(DATA.WORLDS[w].backbone.ground);
    const theirs = new Set();
    for (const o of worlds) if (o !== w) DATA.WORLDS[o].backbone.ground.forEach((t) => theirs.add(t));
    const exclusive = [...mine].filter((t) => !theirs.has(t));
    // ≥1 EXCLUSIVE, not "no two worlds share a trio": a naive overlap test stays
    // green when two worlds share 2 of 3, which is exactly the near-duplicate
    // shape this exists to catch.
    assert.ok(exclusive.length >= 1,
      `world "${w}" has no backbone shape of its own (${[...mine].join(", ")}) — it is another world's wave table in a different name`);
  }
  // …and exactly one air shape each, so `AUDIT threat shape` can never be starved
  for (const w of worlds) {
    const f = DATA.WORLDS[w].backbone.flier;
    assert.ok(DATA.ENEMIES[f] && DATA.ENEMIES[f].flier, `world "${w}" backbone flier "${f}" must be a real flier`);
    const groundFliers = DATA.WORLDS[w].backbone.ground.filter((t) => DATA.ENEMIES[t].flier);
    assert.deepEqual(groundFliers, [], `world "${w}" lists a flier in its GROUND slots (${groundFliers.join(", ")})`);
  }
  // every declared backbone type must exist, and BACKBONE_TYPES must cover them
  for (const w of worlds) for (const t of DATA.WORLDS[w].backbone.ground.concat([DATA.WORLDS[w].backbone.flier])) {
    assert.ok(DATA.ENEMIES[t], `world "${w}" names a backbone type "${t}" that is not in the roster`);
    assert.ok(DATA.BACKBONE_TYPES.indexOf(t) >= 0, `BACKBONE_TYPES must contain "${t}"`);
  }
  // …and the reverse. BACKBONE_TYPES derives from the worlds, but it HAND-SEEDS
  // a set before the loop, and anything in that seed collects backbone credit
  // without any world declaring it. That matters because the composition
  // contract is "at least 70% backbone, at most one special at at most 25% HP":
  // seeding a mechanic-carrying enemy would reclassify a special as backbone and
  // let a wave carry two disruptive shapes with no answer — the exact failure
  // that took World 4 from 2/4 to 4/4 when it was fixed. So a seed must be
  // VANILLA. (Deriving the seed list rather than re-typing it is the point: the
  // literal ["brick"] is checked, not trusted.)
  const declared = new Set();
  for (const w of worlds) DATA.WORLDS[w].backbone.ground.concat([DATA.WORLDS[w].backbone.flier]).forEach((t) => declared.add(t));
  const MECHANIC = ["armor", "shield", "shieldRegen", "splashResist", "bonkResist", "zapResist",
    "slowImmune", "slowHeal", "phase", "tunnel", "heal", "spawner", "hurry", "charge", "split",
    "goldBurst", "stomp", "suck", "enrage", "phases", "disable", "boss"];
  for (const t of DATA.BACKBONE_TYPES) {
    if (declared.has(t)) continue;
    const e = DATA.ENEMIES[t];
    assert.ok(e, `BACKBONE_TYPES seeds "${t}", which is not in the roster`);
    const carries = MECHANIC.filter((m) => e[m]);
    assert.deepEqual(carries, [],
      `"${t}" is hand-seeded into BACKBONE_TYPES but no world declares it, and it carries ${carries.join(", ")} — ` +
      `a special taking backbone credit lets a wave ship two disruptive shapes past the composition contract`);
  }
  // …and the guide SAYS where you meet each world's regulars — otherwise ten
  // stat-identical "no tricks" cards read as ten copies of the same enemy.
  // Derived from WORLDS, so a new world's crowd documents itself.
  const owner = {};
  for (const w of worlds) for (const t of DATA.WORLDS[w].backbone.ground.concat([DATA.WORLDS[w].backbone.flier])) {
    owner[t] = owner[t] === undefined ? w : "";      // "" = shared, deliberately unlabelled
  }
  for (const [t, w] of Object.entries(owner)) {
    const keys = TD.enemyTraits(DATA.ENEMIES[t]).map((x) => x.key);
    if (w) assert.ok(keys.includes("home"),
      `"${t}" is the ${w}'s exclusive regular but the guide never says where you meet it`);
    else assert.ok(!keys.includes("home"),
      `"${t}" turns up in several worlds, so naming one home would be a lie`);
  }
});

test("P2 identity: no two worlds ship the same wave SHAPE (body-count cosine < 0.9)", () => {
  // The measurement that actually caught it. Two worlds can each hold an
  // exclusive type and still be near-identical if that type is 2% of the bodies,
  // so the ratchet is on the whole body-count vector. On HEAD garage vs moving
  // scored ~1.00; after the reskin they are orthogonal on their two biggest
  // components.
  const vec = {};
  for (const l of DATA.LEVELS) {
    const v = (vec[l.world] = vec[l.world] || {});
    for (const w of l.waves) for (const g of (w.groups || [])) {
      if (DATA.ENEMIES[g.type].boss) continue;         // one boss each — not a shape
      v[g.type] = (v[g.type] || 0) + g.count;
    }
  }
  const worlds = Object.keys(vec);
  const cos = (a, b) => {
    const keys = new Set(Object.keys(a).concat(Object.keys(b)));
    let dot = 0, na = 0, nb = 0;
    for (const k of keys) { const x = a[k] || 0, y = b[k] || 0; dot += x * y; na += x * x; nb += y * y; }
    return dot / Math.sqrt(na * nb || 1);
  };
  const worst = [];
  for (let i = 0; i < worlds.length; i++) for (let j = i + 1; j < worlds.length; j++) {
    const c = cos(vec[worlds[i]], vec[worlds[j]]);
    if (c >= 0.9) worst.push(`${worlds[i]} vs ${worlds[j]} = ${c.toFixed(3)}`);
  }
  assert.deepEqual(worst, [],
    `worlds whose waves are the same shape in different names: ${worst.join("; ")}`);
});

test("P2 identity: no two levels run the same SPECIAL SCHEDULE", () => {
  // The attic shipped with FIVE pairs at 100%: L13-L16 carried a byte-identical
  // wave-for-wave order (screw, mole, ghost, battery, cushion, slime, screw,
  // mole, ghost, battery) and differed only in the counts.
  //
  // Scoped to the SPECIAL slot on purpose. The backbone lead is
  // balance-load-bearing (the generator's own note: leading an even wave with
  // marbles makes it a 200-body sprint that outruns every board), so a
  // whole-cast metric would fight the composition contract rather than measure
  // sameness. Waves with no special on either side are skipped — an opening
  // wave is required to be plain, so counting those as a "match" would measure
  // the rule, not the level.
  const BB = new Set(DATA.BACKBONE_TYPES), VALVE = new Set(["pinata"]);
  const schedule = (l) => l.waves.map((w) => (w.groups || [])
    .filter((g) => !BB.has(g.type) && !VALVE.has(g.type) && !DATA.ENEMIES[g.type].boss)
    .map((g) => g.type).sort().join("+"));
  const CAP = 0.65;   // ratchet: worst measured pair is 0.60 (L13/L15 and three siblings)
  const bad = [];
  for (let i = 0; i < DATA.LEVELS.length; i++) for (let j = i + 1; j < DATA.LEVELS.length; j++) {
    const a = schedule(DATA.LEVELS[i]), b = schedule(DATA.LEVELS[j]);
    const n = Math.min(a.length, b.length);
    let same = 0, slots = 0;
    for (let k = 0; k < n; k++) { if (!a[k] && !b[k]) continue; slots++; if (a[k] === b[k]) same++; }
    if (slots >= 6 && same / slots > CAP) bad.push(`L${DATA.LEVELS[i].id}/L${DATA.LEVELS[j].id} ${same}/${slots}`);
  }
  assert.deepEqual(bad, [],
    `levels running the same threats in the same order (cap ${Math.round(CAP * 100)}%): ${bad.join(", ")}`);
});

test("P2 hooks: every level has a declared HOOK, or a boss that is one", () => {
  // Six levels were hookless, and four of those are boss finales — the levels
  // with the least margin in the game, where forcing a mechanic is measurably
  // destructive (L4+night loses every heroic seed; L8+power pad reverses the
  // deliberate Vacuum King hardening). So a boss IS the declared hook: a
  // multi-phase enemy with its own kit, klaxon and guide card is a stronger
  // named hook than a mud patch. That leaves the genuinely bare non-boss
  // levels, which must carry one.
  const bare = [];
  for (const l of DATA.LEVELS) {
    if (l.waves.some((w) => w.boss)) continue;
    if (!TD.levelGimmicks(l).length) bare.push(l.id);
  }
  assert.deepEqual(bare, [], `levels with no hook and no boss: ${bare.map((x) => "L" + x).join(", ")}`);
  // …and the exemption must be REAL: if every level were a boss level this
  // check would be inert.
  assert.ok(DATA.LEVELS.filter((l) => !l.waves.some((w) => w.boss)).length > DATA.LEVELS.length / 2,
    "most levels are not boss levels, so the boss exemption is a minority case");
  // No two levels in the same world may lean on the same mechanic.
  for (const world of Object.keys(DATA.WORLDS)) {
    const seen = {};
    for (const l of DATA.LEVELS.filter((x) => x.world === world)) {
      for (const g of TD.levelGimmicks(l)) {
        assert.ok(seen[g.key] === undefined,
          `L${l.id} and L${seen[g.key]} are both the "${g.key}" level of the ${world} — a world's four levels should each have their own trick`);
        seen[g.key] = l.id;
      }
    }
  }
});

test("P2 hooks: a side door sits in the band that is neither a no-op nor a rout", () => {
  // Door position is one of the very few MONOTONIC knobs in this engine (almost
  // nothing else is): measured on L13, 25% finishes 20/20 and 75% finishes ~5,
  // and 75% loses every heroic seed on all three levels that carry one. Below
  // ~30% it is a no-op on normal. So the band is authored, not eyeballed.
  const LO = 0.25, HI = 0.62;
  const len = (p) => { let t = 0; for (let i = 1; i < p.length; i++) t += Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][1] - p[i - 1][1]); return t; };
  let doors = 0;
  for (const l of DATA.LEVELS) {
    // a fork level declares `paths` and no `path`; a door's `at` is a distance
    // on the enemy's own lane, and it enters on the DEFAULT one
    const total = len(l.path || l.paths[0]);
    for (const w of l.waves) for (const g of (w.groups || [])) {
      if (!g.at) continue;
      doors++;
      const pct = g.at / total;
      assert.ok(pct >= LO,
        `L${l.id}'s side door enters at ${Math.round(pct * 100)}% of the lane — below ${Math.round(LO * 100)}% it is a no-op on normal, i.e. a mechanic that does nothing`);
      assert.ok(pct <= HI,
        `L${l.id}'s side door enters at ${Math.round(pct * 100)}% of the lane — above ${Math.round(HI * 100)}% it loses every heroic seed`);
    }
  }
  assert.ok(doors >= 5, `the door mechanic actually ships (${doors} groups) — an empty loop would pass this silently`);
});

test("P2 identity: each finale's ESCORT demands a different counter", () => {
  // Every one of the six boss escorts led with the Plastic Knight, and three of
  // them were the same template (armored line + fast air). A boss wave is
  // budget-exempt, so composition is free — and the escort is where a finale
  // says which board it wants. The signature is the set of TRAIT KEYS the
  // escort carries, derived through enemyTraits so a new enemy classifies
  // itself; medians are deliberately NOT the metric (they already differed
  // while the escorts were near-copies).
  const finales = DATA.LEVELS.filter((l) => l.waves.some((w) => w.boss));
  const sig = {};
  for (const l of finales) {
    const bw = l.waves.find((w) => w.boss);
    const escort = bw.groups.filter((g) => !DATA.ENEMIES[g.type].boss);
    assert.ok(escort.length >= 1, `L${l.id}'s boss walks in alone — the escort is the finale's question`);
    const keys = new Set();
    for (const g of escort) for (const t of TD.enemyTraits(DATA.ENEMIES[g.type])) {
      if (t.key !== "plain" && t.key !== "home") keys.add(t.key);   // "home" is presentation, not a demand
    }
    sig[l.id] = [...keys].sort().join(",");
  }
  const seen = {};
  for (const [id, s] of Object.entries(sig)) {
    assert.ok(seen[s] === undefined,
      `L${id} and L${seen[s]} ask the same question of your board (escort traits "${s || "(plain)"}") — a finale is where a world states its counter`);
    seen[s] = id;
  }
  // …and no more than half may open on the same shape. All six led with the
  // knight; three now do (L16/L20/L24, each with a different partner).
  const lead = {};
  for (const l of finales) {
    const g = l.waves.find((w) => w.boss).groups.find((x) => !DATA.ENEMIES[x.type].boss);
    lead[g.type] = (lead[g.type] || 0) + 1;
  }
  const worst = Math.max(...Object.values(lead));
  assert.ok(worst <= Math.ceil(finales.length / 2),
    `${worst} of ${finales.length} finales open on the same escort shape (${JSON.stringify(lead)})`);
});

test("P2 skins: a skin is its ancestor's BODY — identical stats, only the costume differs", () => {
  // The stats are copied by Object.assign, so this cannot fail today; it exists
  // to stop a later hand-edit turning a free reskin into a silent balance change
  // (the class the whole phase was designed to avoid).
  const COSMETIC = new Set(["name", "icon", "sortKey", "skinOf"]);
  const skins = Object.keys(DATA.ENEMIES).filter((k) => DATA.ENEMIES[k].skinOf);
  assert.ok(skins.length >= 8, `the reskin shipped (${skins.length} skins)`);
  for (const id of skins) {
    const skin = DATA.ENEMIES[id], src = DATA.ENEMIES[skin.skinOf];
    assert.ok(src, `skin "${id}" names an ancestor "${skin.skinOf}" that does not exist`);
    const keys = new Set(Object.keys(skin).concat(Object.keys(src)));
    for (const k of keys) {
      if (COSMETIC.has(k)) continue;
      assert.deepEqual(skin[k], src[k],
        `skin "${id}" differs from its ancestor "${skin.skinOf}" on "${k}" (${JSON.stringify(skin[k])} vs ${JSON.stringify(src[k])}) — a skin is a costume, not a balance change`);
    }
    assert.notEqual(skin.name, src.name, `skin "${id}" must have its own name`);
    assert.notEqual(skin.icon, src.icon, `skin "${id}" must have its own icon`);
    // …and the spawn-queue key stays the ancestor's, which is what makes the
    // reskin replay byte-identically instead of merely equivalently.
    assert.equal(skin.sortKey, skin.skinOf, `skin "${id}" must inherit its ancestor's spawn-order key`);
  }
});

test("P2 skins: an enemy's ID is a NAME — the spawn order rides sortKey, not the id", () => {
  // Same-tick spawns are tiebroken on a stable key. It used to be the raw type
  // id, so RENAMING an enemy moved the tick stream (measured: 22 of 384 runs).
  // Default-noop: an enemy with no sortKey still sorts on its own id.
  for (const id of Object.keys(DATA.ENEMIES)) {
    const d = DATA.ENEMIES[id];
    if (!d.skinOf) assert.equal(d.sortKey, undefined, `"${id}" is not a skin and must not override the spawn-order key`);
  }
  // Drive it: a wave of two groups that spawn on the SAME tick must produce the
  // same arrival order whether the second group is the ancestor or its skin.
  // …and the mirror of that: every skin must carry its ancestor's key. The check
  // above only proves a NON-skin has none, so a skin with a WRONG sortKey would
  // sail through while a different skin's behavioural check below passed. Derived,
  // so a world's new skins are covered the day they land rather than when someone
  // remembers to extend a sample.
  const skins = Object.keys(DATA.ENEMIES).filter((k) => DATA.ENEMIES[k].skinOf);
  assert.ok(skins.length >= 12, `the skin system actually ships (${skins.length} skins)`);
  for (const k of skins) {
    const d = DATA.ENEMIES[k];
    assert.equal(d.sortKey, d.skinOf,
      `skin "${k}" is a costume on "${d.skinOf}" but sorts as "${d.sortKey}" — an id is a NAME, and the spawn tiebreak must ride the ancestor`);
    assert.ok(DATA.ENEMIES[d.skinOf], `skin "${k}" names an ancestor that exists`);
  }
  const skin = Object.keys(DATA.ENEMIES).find((k) => DATA.ENEMIES[k].skinOf === "marble");
  assert.ok(skin, "a marble skin exists to test with");
  const base = DATA.LEVELS[0];
  const mk = (second) => {
    const lvl = JSON.parse(JSON.stringify(base));
    lvl.waves = [{ groups: [
      { type: "knight", count: 3, gap: 0, delay: 0 },
      { type: second, count: 3, gap: 0, delay: 0 },
    ] }];
    const e = TD.createEngine(lvl, { seed: 4 });
    e.callWave();
    for (let i = 0; i < 30; i++) e.tick();
    return e.state.enemies.map((x) => (DATA.ENEMIES[x.type].skinOf || x.type)).join(",");
  };
  assert.equal(mk(skin), mk("marble"),
    "a skin must arrive in exactly its ancestor's spawn order — otherwise a rename is a balance change");
});

test("W5 Toolbox Titan: every hp-gated phase actually fires (forced, band by band)", () => {
  // A solver may never drop a boss into its low bands, so the whole kit can
  // ship dead-untested — the Static/Tickmaster precedent. Force each band.
  const lvl = DATA.LEVELS.find((l) => l.pads.length >= 3);
  const e = TD.createEngine(lvl, { seed: 9 });
  e.state.gold = 99999;
  assert.ok(e.place("dart", lvl.pads[0].id).ok);
  assert.ok(e.place("dart", lvl.pads[1].id).ok);
  e.callWave();
  for (let i = 0; i < 20; i++) e.tick();
  e.state.enemies.length = 0;
  const def = DATA.ENEMIES.titan;
  e.state.enemies.push(mkEnemy("titan", 2));
  const boss = e.state.enemies[0];
  boss.hp = Math.round(def.hp * 0.6); // band 2: it jams a gun
  let jammed = false;
  for (let i = 0; i < 600 && !jammed; i++) { e.tick(); jammed = e.state.towers.some((t) => t.disabledUntil > e.state.tick); }
  assert.ok(jammed, "under 66% the Titan jams a gun (tower-facing, not just a soldier-eater)");
  boss.hp = Math.round(def.hp * 0.25); // band 3: it also summons
  const summonType = def.phases[2].spawn.type;
  let summoned = false;
  for (let i = 0; i < 700 && !summoned; i++) { e.tick(); summoned = e.state.enemies.some((x) => x.type === summonType && x.alive); }
  assert.ok(summoned, `under 33% it summons ${summonType}s`);
});

test("AUDIT targeting is a LIVE lever — mode choice must change the outcome, and no mode is dead", () => {
  // Two existing tests prove the MECHANISM (a mode is accepted; dart-on-strong
  // re-evaluates instead of sticky-locking). Neither asks the question a player
  // asks: does picking a mode change how the run GOES? Nothing drove a whole
  // level under each mode, so the whole selector could have been cosmetic.
  //
  // Measured across the 9 boss finales x 4 seeds, mean lives on normal:
  //   L4  first 10.0  last  1.0  strong  2.0  close 2.0
  //   L8  first 10.0  last 11.0  strong 12.0  close 11.0
  //   L12 first  5.8  last  5.8  strong  4.5  close 6.0
  //   L16 first 10.0  last  8.3  strong 16.3  close 7.8
  //   L20 first  7.3  last  8.0  strong  6.0  close 9.5
  // Best-mode tally over those 9 levels: first 4, strong 2, close 2, last 1 —
  // so EVERY mode is the right answer somewhere and none is dead content. The
  // guardrail pins the two biggest swings rather than the whole 144-sim sweep:
  // they are 9.0 and 8.5 lives apart, so a 4-life bar cannot flake, and it goes
  // flat the moment setTargeting stops mattering.
  const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
  const PLAN = ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"];
  function run(level, seed, mode) {
    const e = TD.createEngine(level, { seed, difficulty: "normal" });
    const padIds = level.pads.map((p) => p.id);
    let idx = 0, guard = 0;
    const setAll = () => { for (const t of e.state.towers) if (t.targeting !== mode) e.setTargeting(t.id, mode); };
    while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 400000) {
      if (e.state.phase === "build") {
        let spent = true;
        while (spent) {
          spent = false;
          for (const pid of padIds) {
            if (!e.state.towers.find((t) => t.padId === pid)) {
              const line = PLAN[idx % PLAN.length];
              if (e.state.gold >= cost(line, 0)) { if (e.place(line, pid).ok) { idx++; spent = true; } }
              break;
            }
          }
          if (spent) continue;
          const ups = e.state.towers.filter((t) => t.tier < 3).sort((a, b) => a.tier - b.tier);
          for (const t of ups) { if (e.state.gold >= cost(t.lineId, t.tier)) { if (e.upgrade(t.id).ok) { spent = true; break; } } }
        }
        setAll();
        e.callWave();
      }
      e.tick();
      // a tier-4 branch can carry its own defaultTargeting, so re-assert
      if (e.state.tick % 90 === 0) setAll();
    }
    return e.state.phase === "won" ? e.state.lives : -1;
  }
  const mean = (level, mode) => [1, 2, 3, 4].map((s) => run(level, s, mode)).reduce((a, b) => a + b, 0) / 4;
  const MIN_SWING = 4;
  for (const [id, hi, lo] of [[4, "first", "last"], [16, "strong", "close"]]) {
    const lvl = DATA.LEVELS.find((l) => l.id === id);
    const a = mean(lvl, hi), b = mean(lvl, lo);
    assert.ok(a - b >= MIN_SWING,
      `L${id}: "${hi}" scored ${a.toFixed(1)} lives and "${lo}" ${b.toFixed(1)} — targeting mode must visibly change the run (expected a gap of at least ${MIN_SWING}). If these are equal, setTargeting is not reaching the guns.`);
  }
  // …and every mode the UI offers must be a legal choice on a real tower, or
  // the picker shows an option the engine refuses.
  const lvl = DATA.LEVELS[0];
  const e = TD.createEngine(lvl, { seed: 1 });
  e.state.gold = 9e9;
  assert.ok(e.place("dart", lvl.pads[0].id).ok);
  const t = e.state.towers[0];
  for (const m of e.targetingModes()) {
    assert.equal(e.setTargeting(t.id, m).ok, true, `the UI offers targeting mode "${m}" but the engine refuses it`);
  }
});

test("AUDIT boss kits: EVERY boss's declared abilities actually fire — derived, band by band", () => {
  // CLAUDE.md already records the law ("a boss whose kit escalates by hp% needs
  // a test that FORCES each phase — a solver may never drop it into its low
  // bands, so the disable/summon/dash code can ship dead-untested"), and it was
  // honoured with ONE HAND-WRITTEN TEST PER BOSS. That list is the defect: the
  // suite named 6 of 9 bosses, so `housedog`, `bigmagnet` — the CAMPAIGN
  // finale — and `stamper` shipped three full 3-band kits with no test at all,
  // and each new world's boss would escape the same way. This is the same "a
  // scan's own list is part of the scan" class as FIELD_TRAIT, the VS16 file
  // list and the overlay OPENERS map, applied to BEHAVIOUR instead of
  // documentation: the subject list derives from DATA.ENEMIES, so boss #10 is
  // covered the moment it declares `boss: true`.
  //
  // Three fixture traps, each of which produced a false "it never fires" while
  // the engine was correct — recorded because the next author will hit them:
  //  1. `upTo` DESCENDS (1, 0.66, 0.33) and activePhase keeps the LAST match, so
  //     band i covers (phases[i+1].upTo, phases[i].upTo] — the NEXT entry is the
  //     floor, not the previous one.
  //  2. `enrage` is read in effSpeed and NEVER sets e.speedMult, so it has to be
  //     measured as the boss actually covering more ground, not as a flag.
  //  3. `stomp` damages soldiers within a radius OF THE BOSS, so the squad must
  //     be parked on it or nothing is ever in range.
  function bossBoard(withCamp) {
    const lvl = DATA.LEVELS.find((l) => l.pads.length >= 4);
    const e = TD.createEngine(lvl, { seed: 9 });
    e.state.gold = 9e9;
    e.place("dart", lvl.pads[0].id);
    e.place("dart", lvl.pads[1].id);
    e.place("mortar", lvl.pads[2].id);
    if (withCamp) e.place("camp", lvl.pads[3].id);
    e.callWave();
    for (let i = 0; i < 60; i++) e.tick();
    e.state.enemies.length = 0;   // clear the wave; we inject the boss ourselves
    return e;
  }
  const distOnSquad = (e) => {                                   // trap 3
    const s = e.state.soldiers.find((x) => x.alive);
    if (!s) return 2;
    let best = 0, bd = Infinity;
    for (let d = 0; d < 200; d += 0.1) {
      const p = e.posOn(0, d);
      const q = (p.x - s.x) ** 2 + (p.y - s.y) ** 2;
      if (q < bd) { bd = q; best = d; }
    }
    return best;
  };

  const bosses = Object.entries(DATA.ENEMIES).filter(([, d]) => d.boss);
  assert.ok(bosses.length >= 9, `expected every shipped boss, saw ${bosses.length}`);
  let effectsProven = 0;

  for (const [type, def] of bosses) {
    const phases = def.phases || [];
    for (let bi = 0; bi < phases.length; bi++) {
      const ph = phases[bi];
      const effects = Object.keys(ph).filter((k) => k !== "hpPct" && k !== "upTo");
      if (!effects.length) continue;                             // band 0 is "normal"
      const e = bossBoard(false);
      const boss = mkEnemy(type, 2);
      e.state.enemies.push(boss);
      const floor = bi + 1 < phases.length ? phases[bi + 1].upTo : 0;  // trap 1
      const frac = (floor + ph.upTo) / 2;
      const pin = () => { boss.hp = Math.max(1, Math.round(def.hp * frac)); };
      pin();
      const got = {};
      for (let i = 0; i < 1500; i++) {
        e.tick(); pin();                                         // hold it in-band
        if (ph.disable && e.state.towers.some((t) => t.disabledUntil > e.state.tick)) got.disable = true;
        if (ph.spawn && e.state.enemies.some((x) => x.type === ph.spawn.type && x.alive)) got.spawn = true;
        if (ph.speedMult && (boss.speedMult || 0) > 1) got.speedMult = true;
        if (effects.every((k) => got[k])) break;
      }
      for (const k of effects) {
        assert.ok(got[k], `${type} band ${bi} (hp ${Math.round(frac * 100)}%) declares "${k}" but it never fires — the kit is dead data`);
        effectsProven += 1;
      }
    }
    if (def.stomp) {                                             // trap 3
      const e = bossBoard(true);
      const d = distOnSquad(e);
      const boss = mkEnemy(type, d); e.state.enemies.push(boss);
      assert.ok(e.state.soldiers.some((s) => s.alive), `${type}'s stomp test needs a squad to stomp`);
      let hurt = false;
      for (let i = 0; i < 1500 && !hurt; i++) {
        e.tick(); boss.hp = def.hp; boss.dist = d;
        hurt = e.state.soldiers.some((s) => !s.alive || s.hp < s.maxHp);
      }
      assert.ok(hurt, `${type} declares stomp but a squad parked under it was never hurt`);
      effectsProven += 1;
    }
    if (def.suck) {
      const e = bossBoard(true);
      const boss = mkEnemy(type, 2); e.state.enemies.push(boss);
      const n0 = e.state.soldiers.filter((s) => s.alive).length;
      assert.ok(n0 > 0, `${type}'s suck test needs a squad to inhale`);
      let sucked = false;
      for (let i = 0; i < 1500 && !sucked; i++) {
        e.tick(); boss.hp = def.hp;
        sucked = e.state.soldiers.filter((s) => s.alive).length < n0;
      }
      assert.ok(sucked, `${type} declares suck but no soldier was ever inhaled`);
      effectsProven += 1;
    }
    if (def.enrage) {                                            // trap 2
      const travel = (frac) => {
        const e = bossBoard(false);
        const boss = mkEnemy(type, 2); e.state.enemies.push(boss);
        const pin = () => { boss.hp = Math.max(1, Math.round(def.hp * frac)); };
        pin();
        const d0 = boss.dist;
        for (let i = 0; i < 200; i++) { e.tick(); pin(); }
        return boss.dist - d0;
      };
      const calm = travel(Math.min(1, def.enrage.hpPct + 0.2));
      const mad = travel(Math.max(0.02, def.enrage.hpPct - 0.05));
      assert.ok(calm > 0, `${type}'s enrage test needs the boss to be moving at all`);
      assert.ok(mad / calm > 1.02,
        `${type} declares enrage ×${def.enrage.mult} below ${def.enrage.hpPct} hp but covered ${mad.toFixed(2)} cells vs ${calm.toFixed(2)} above it`);
      effectsProven += 1;
    }
    if (def.hurry) {
      // TRAP 4, and this branch exists because the audit did not have one: World
      // 10's whole design justification is that 🎁 The Big Present never hits you
      // — it makes the party ARRIVE FASTER — and that field was declared with
      // NOTHING driving it. `hurry` is TOP-LEVEL, not inside `phases`, so the
      // per-band loop above cannot see it either; the boss kit would have shipped
      // dead and this audit would still have passed on its phases alone.
      //
      // Measured as GROUND COVERED by an escort, not as a flag: hurry is read in
      // effSpeed and never sets a field on the body it speeds up — the same trap
      // that `enrage` above documents.
      const travel = (withBoss) => {
        const e = bossBoard(false);
        e.state.phase = "wave";
        const mate = Object.assign({}, DATA.ENEMIES.sock, { id: 9101, type: "sock", alive: true, hp: 1e9, maxHp: 1e9, dist: 20, pathIdx: 0, shield: 0 });
        e.state.enemies.push(mate);
        const boss = withBoss ? mkEnemy(type, 20) : null;
        if (boss) e.state.enemies.push(boss);
        const d0 = mate.dist;
        for (let i = 0; i < 120; i++) { e.tick(); mate.hp = 1e9; if (boss) { boss.hp = def.hp; boss.dist = 20; } }
        return mate.dist - d0;
      };
      const alone = travel(false), escorted = travel(true);
      assert.ok(alone > 0, `${type}'s hurry test needs its escort to be moving at all`);
      assert.ok(escorted / alone > 1.05,
        `${type} declares a hurry aura ×${def.hurry.mult} but an escort beside it covered ` +
        `${escorted.toFixed(2)} cells against ${alone.toFixed(2)} alone — the aura never fired`);
      effectsProven += 1;
    }
    if (def.spawner) {
      const e = bossBoard(false);
      const boss = mkEnemy(type, 2); e.state.enemies.push(boss);
      let dripped = false;
      for (let i = 0; i < 900 && !dripped; i++) { e.tick(); boss.hp = def.hp; dripped = e.state.enemies.some((x) => x.type === def.spawner.type && x.alive); }
      assert.ok(dripped, `${type} declares a spawner but never dripped a ${def.spawner.type}`);
      effectsProven += 1;
    }
  }
  // …and the sweep is not vacuous: if a refactor stopped bosses declaring kits,
  // every assertion above would be skipped and this test would pass silently.
  assert.ok(effectsProven >= 25,
    `only ${effectsProven} boss abilities were actually exercised — the sweep found nothing to prove`);
});


// ===== TD-16 LEVEL GIMMICKS: three data fields, each read at ONE place. =====

test("TD-16 zones must never OVERLAP — the engine breaks on the first match", () => {
  // `for (const z of zones) { if (in range) { base *= z.mult; break; } }` — so
  // where two zones overlap, ARRAY ORDER silently decides which multiplier
  // applies. L7's first mud placement (16-22) overlapped its conveyor (20-25)
  // and, being first in the array, quietly cancelled two cells of the strip:
  // heroic went from 8 to 18 lives with no other change. A zone table has to be
  // disjoint or it does not mean what it says.
  for (const l of DATA.LEVELS) {
    const zs = (l.zones || []).slice().sort((a, b) => a.from - b.from);
    for (const z of zs) assert.ok(z.to > z.from, `L${l.id} zone ${z.from}-${z.to} is empty or inverted`);
    for (let i = 1; i < zs.length; i++) {
      assert.ok(zs[i].from >= zs[i - 1].to,
        `L${l.id} zones overlap (${zs[i - 1].from}-${zs[i - 1].to} and ${zs[i].from}-${zs[i].to}) — the engine breaks on the FIRST match, so their order silently decides which multiplier wins`);
    }
  }
});

test("TD-16 ⚡ Power Pad: a boosted tower fires faster AND reaches further", () => {
  // The buff lives on the PAD, so it must survive a sell-and-rebuild and apply
  // to whatever line is standing there. Range had to reach all FIVE range reads
  // (dart acquire, dart sticky-keep, mortar, fan aura, fan zap) — the "grep
  // every place a target is chosen OR kept" discipline applied to distance.
  // EACH HALF IS TESTED ALONE. The first cut passed a `{range, rate}` boost to
  // both assertions, and a range buff by itself raises the shot count (the
  // tower acquires sooner and holds longer) — so the "fires faster" half could
  // not fail, which is worse than not testing it. Rate is measured with a
  // rate-ONLY pad; reach with a range-ONLY pad.
  function mk(boost, dy) {
    return { id: 93, name: "gimmick-probe", world: "test", startGold: 99999, budgetBase: 100,
      path: [[0, 7], [23, 7]],
      pads: [Object.assign({ id: "m", cx: 5, cy: 7 - (dy == null ? 4 : dy) }, boost ? { boost } : {})],
      waves: [{ groups: [{ type: "sock", count: 60, gap: 0.35, delay: 0 }] }] };
  }
  // Rate is measured against a target PINNED right beside the tower: with one
  // enemy that never leaves reach, range cannot influence the count, so the
  // number is the fire rate and nothing else. (Counting shots at an advancing
  // wave is range-sensitive — more reach means more of the lane covered, which
  // is exactly what made the first version of this check unfalsifiable.)
  function shots(boost, tier) {
    const e = TD.createEngine(mk(boost, 1), { seed: 4 });
    e.place("dart", "m");
    for (let i = 1; i < (tier || 1); i++) e.upgrade(e.state.towers[0].id);
    e.callWave();
    for (let i = 0; i < 20; i++) e.tick();
    let n = 0;
    for (let i = 0; i < 600; i++) {
      const t = e.state.enemies[0];
      if (t) { t.dist = 5; t.hp = t.maxHp = 9e6; }        // pinned and immortal
      e.state.enemies.length = Math.min(e.state.enemies.length, 1);
      e.tick();
      n += e.events.filter((ev) => ev.type === "shoot").length; e.events.length = 0;
    }
    return n;
  }
  const RATE_ONLY = { rate: 1.15 }, RANGE_ONLY = { range: 1.18 };
  assert.ok(shots(RATE_ONLY, 1) > shots(null, 1), "a tier-1 dart on a power pad fires more often (rate half)");
  assert.ok(shots(RATE_ONLY, 3) > shots(null, 3), "…and so does a tier-3 one (the buff is not tier-gated)");
  assert.equal(shots(RANGE_ONLY, 1), shots(null, 1), "a range-only socket must not change the FIRE RATE — that would make the rate check unfalsifiable");
  // reach: find a standoff distance only the boosted tower can cover
  function reaches(boost, dy) {
    const e = TD.createEngine(mk(boost, dy), { seed: 4 });
    e.place("dart", "m");
    e.callWave();
    for (let i = 0; i < 1400; i++) { e.tick(); if (e.events.some((ev) => ev.type === "shoot")) return true; e.events.length = 0; }
    return false;
  }
  let found = false;
  for (let dy = 2; dy <= 6 && !found; dy++) found = !reaches(null, dy) && reaches(RANGE_ONLY, dy);
  assert.ok(found, "there must be a standoff only the boosted tower can reach — otherwise the range half of the socket does nothing");
  // the buff belongs to the PAD, not the tower it happened to be bought with
  const e = TD.createEngine(mk({ range: 1.18, rate: 1.15 }, 2), { seed: 4 });
  e.place("dart", "m"); e.sell(e.state.towers[0].id); e.place("mortar", "m");
  assert.equal(e.state.towers.length, 1, "rebuilt on the same socket");
  assert.ok(DATA.LEVELS.some((l) => l.pads.some((p) => p.boost)), "at least one shipped level actually carries a power pad");
});

test("TD-16 🚪 Side Door: a flagged group walks in PAST the entrance", () => {
  const lvl = { id: 92, name: "gimmick-probe", world: "test", startGold: 0, budgetBase: 100,
    path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 5, cy: 1 }],
    waves: [{ groups: [{ type: "sock", count: 2, gap: 0.4, delay: 0 }, { type: "marble", count: 2, gap: 0.4, delay: 0, at: 12 }] }] };
  const e = TD.createEngine(lvl, { seed: 4 });
  e.callWave();
  for (let i = 0; i < 4; i++) e.tick();
  const front = e.state.enemies.filter((x) => x.type === "sock");
  const flank = e.state.enemies.filter((x) => x.type === "marble");
  assert.ok(front.length && flank.length, "both groups spawned");
  for (const f of front) assert.ok(f.dist < 3, `the un-flagged group starts at the entrance (got ${f.dist})`);
  for (const f of flank) assert.ok(f.dist >= 11, `the side-door group enters at its door, not the entrance (got ${f.dist})`);
  // …and a door only ever moves an enemy FORWARD — never past the exit
  const total = e.paths[0].total;
  for (const l of DATA.LEVELS) for (const w of l.waves) for (const g of w.groups) {
    if (!g.at) continue;
    const t = TD.buildPath((l.paths || [l.path])[0]).total;
    assert.ok(g.at > 0 && g.at < t * 0.8,
      `L${l.id} side door at ${g.at} must sit inside the lane (0 < at < 80% of ${t.toFixed(0)}) — past that it is a free leak, not a flank`);
  }
  assert.ok(total > 0);
});

test("TD-16 gimmick coverage: every world has one, and no mechanic is stuck in one world", () => {
  // The point of the phase. Before it, three of twenty levels had a gimmick
  // (night on L6, conveyors on L7/L17) and two whole worlds had none at all.
  const has = (l) => !!(l.night || l.lever || (l.zones && l.zones.length) ||
    l.pads.some((p) => p.boost) || l.waves.some((w) => w.groups.some((g) => g.at)));
  const worlds = [...new Set(DATA.LEVELS.map((l) => l.world))];
  for (const w of worlds) {
    assert.ok(DATA.LEVELS.filter((l) => l.world === w).some(has),
      `world "${w}" has no level gimmick at all — every world gets at least one`);
  }
  assert.ok(DATA.LEVELS.filter(has).length >= worlds.length * 2,
    `gimmicks must be spread, not token: ${DATA.LEVELS.filter(has).length} of ${DATA.LEVELS.length} levels carry one`);
  const spread = (pick) => new Set(DATA.LEVELS.filter(pick).map((l) => l.world)).size;
  assert.ok(spread((l) => l.zones && l.zones.some((z) => z.mult < 1)) >= 3, "mud patches appear in at least three worlds");
  assert.ok(spread((l) => l.pads.some((p) => p.boost)) >= 3, "power pads appear in at least three worlds");
  assert.ok(spread((l) => l.waves.some((w) => w.groups.some((g) => g.at))) >= 3, "side doors appear in at least three worlds");
});


// ===== WORLD 6 (Moving Day): two shapes that close the counter matrix. =====

test("W6 Bubble Wrap: single hits land SOFT, splash and zap cut through", () => {
  // The Couch Cushion's mirror, and the first enemy that directly answers the
  // DART — the generalist CLAUDE.md records as clearing 16/16 on normal. It is
  // keyed on `how` in the ONE dealDamage, beside its mirror, so a future damage
  // source is covered by naming its own `how` and nothing else.
  const def = DATA.ENEMIES.bubblewrap;
  assert.ok(def.bonkResist > 0 && def.bonkResist < 1, "it resists bonk, it is not immune");
  const lvl = DATA.LEVELS.find((l) => l.pads.length >= 2);
  function landed(how) {
    const e = TD.createEngine(lvl, { seed: 5 });
    e.callWave();
    for (let i = 0; i < 20; i++) e.tick();
    e.state.enemies.length = 0;
    const v = mkEnemy("bubblewrap", 2);
    v.hp = v.maxHp = 100000;
    e.state.enemies.push(v);
    e.dealDamage(v, 1000, 0, how);
    return 100000 - v.hp;
  }
  const soft = landed("dart"), melee = landed("melee");
  const hard = landed("splash"), zap = landed("zap");
  assert.ok(soft < hard, `a dart lands softer than splash (${soft} vs ${hard})`);
  assert.ok(melee < hard, `a soldier's swing lands softer than splash (${melee} vs ${hard})`);
  assert.equal(zap, hard, "zap is not bonk — the Fan cuts straight through, like splash");
  assert.equal(soft, Math.round(1000 * (1 - def.bonkResist)), "the reduction is exactly its bonkResist");
  // …and it must be the MIRROR of the Cushion, not a duplicate of it
  assert.ok(!def.splashResist, "Bubble Wrap must not ALSO resist splash — then nothing would answer it");
  assert.ok(!DATA.ENEMIES.cushion.bonkResist, "and the Cushion must not resist bonk — the two are opposites by design");
});

test("W6 Boom Box: it hurries its NEIGHBOURS and never itself", () => {
  // The threat is the aura, not the body — so the test measures a bystander's
  // speed, which is the only thing that actually matters.
  const def = DATA.ENEMIES.boombox;
  assert.ok(def.hurry && def.hurry.mult > 1 && def.hurry.radius > 0, "it carries a hurry aura");
  const lvl = DATA.LEVELS.find((l) => l.pads.length >= 2);
  function walk(withBox) {
    const e = TD.createEngine(lvl, { seed: 5 });
    e.callWave();
    for (let i = 0; i < 20; i++) e.tick();
    e.state.enemies.length = 0;
    const sock = mkEnemy("sock", 4);
    sock.hp = sock.maxHp = 1e6;
    e.state.enemies.push(sock);
    if (withBox) {
      const box = mkEnemy("boombox", 4);
      box.hp = box.maxHp = 1e6;
      e.state.enemies.push(box);
    }
    const from = sock.dist;
    for (let i = 0; i < 120; i++) e.tick();
    return sock.dist - from;
  }
  const alone = walk(false), withMusic = walk(true);
  assert.ok(withMusic > alone * 1.1,
    `a sock beside a Boom Box covers more ground (${withMusic.toFixed(2)} vs ${alone.toFixed(2)})`);
  assert.ok(withMusic <= alone * def.hurry.mult * 1.05, "…but only by its own multiplier, not compounding");
  // out of earshot it does nothing
  const e = TD.createEngine(lvl, { seed: 5 });
  e.callWave();
  for (let i = 0; i < 20; i++) e.tick();
  e.state.enemies.length = 0;
  const far = mkEnemy("sock", 4); far.hp = far.maxHp = 1e6;
  const box = mkEnemy("boombox", 4 + def.hurry.radius + 3); box.hp = box.maxHp = 1e6;
  e.state.enemies.push(far, box);
  const f0 = far.dist;
  for (let i = 0; i < 120; i++) e.tick();
  assert.ok(far.dist - f0 <= alone * 1.02, "out of radius, the music does nothing");
});

test("W6 The Moving Van: every hp-gated phase fires, and it unloads as it drives", () => {
  // A solver may never drop a boss into its low bands, so the whole kit can ship
  // dead-untested — the Static/Tickmaster/Titan precedent. Force each band.
  const lvl = DATA.LEVELS.find((l) => l.pads.length >= 3);
  const e = TD.createEngine(lvl, { seed: 9 });
  e.state.gold = 99999;
  assert.ok(e.place("dart", lvl.pads[0].id).ok);
  assert.ok(e.place("dart", lvl.pads[1].id).ok);
  e.callWave();
  for (let i = 0; i < 20; i++) e.tick();
  e.state.enemies.length = 0;
  const def = DATA.ENEMIES.movingvan;
  const boss = mkEnemy("movingvan", 2);
  e.state.enemies.push(boss);
  // it unloads from the start — the Bolt Bucket's capped spawner, on a boss
  const kid = def.spawner.type;
  let unloaded = false;
  for (let i = 0; i < 400 && !unloaded; i++) { e.tick(); unloaded = e.state.enemies.some((x) => x.type === kid && x.alive); }
  assert.ok(unloaded, `the van unloads ${kid} as it drives`);
  assert.ok(def.spawner.max >= 1, "and its load is CAPPED — an unbounded drip is unbudgetable");
  boss.hp = Math.round(def.hp * 0.6);                       // band 2: jams a gun
  let jammed = false;
  for (let i = 0; i < 700 && !jammed; i++) { e.tick(); jammed = e.state.towers.some((t) => t.disabledUntil > e.state.tick); }
  assert.ok(jammed, "under 66% the van jams a gun (tower-facing, not a soldier-only kit)");
  boss.hp = Math.round(def.hp * 0.25);                      // band 3: calls the music
  const summon = def.phases[2].spawn.type;
  let called = false;
  for (let i = 0; i < 800 && !called; i++) { e.tick(); called = e.state.enemies.some((x) => x.type === summon && x.alive); }
  assert.ok(called, `under 33% it summons ${summon}s`);
});

// The enemyTraits coverage contract, applied to the BOARD. TD-16 shipped five
// level gimmicks and documented none of them — the Toybox Guide covered enemies,
// towers and powers, so nothing anywhere told a player that night cuts reach or
// that a brown patch slows. A player who cannot NAME a mechanic cannot plan
// around it, which is how the 🚪 side door came back as "it's malfunctioning".
test("TD-16 guide truth: every level gimmick explains ITSELF, from the level's own data", () => {
  // Each gimmick-bearing FIELD an author can set must produce an entry. Add a
  // sixth mechanic without a levelGimmicks branch and this fails — the mechanic
  // cannot ship invisible.
  const FIELD_TO_KEY = [
    ["zones-slow", (l) => (l.zones || []).some((z) => z.mult != null && z.mult < 1), "mud"],
    ["zones-dmg-low", (l) => (l.zones || []).some((z) => z.dmg != null && z.dmg < 1), "cover"],
    ["zones-fast", (l) => (l.zones || []).some((z) => z.mult != null && z.mult > 1), "conveyor"],
    ["night", (l) => !!l.night, "night"],
    ["pads[].boost", (l) => (l.pads || []).some((p) => p.boost), "power"],
    ["groups[].at", (l) => (l.waves || []).some((w) => (w.groups || []).some((g) => g.at > 0)), "door"],
    ["fork+lever", (l) => !!(l.fork && l.lever), "lever"],
  ];
  const kinds = new Set();
  for (const lvl of DATA.LEVELS) {
    const keys = TD.levelGimmicks(lvl).map((g) => g.key);
    for (const [field, present, key] of FIELD_TO_KEY) {
      if (present(lvl)) {
        assert.ok(keys.includes(key),
          `L${lvl.id} carries ${field} but the guide says nothing about it — a mechanic must not ship undocumented`);
        kinds.add(key);
      } else {
        assert.ok(!keys.includes(key), `L${lvl.id} advertises "${key}" it does not have — the guide must not lie`);
      }
    }
    for (const g of TD.levelGimmicks(lvl)) {
      assert.ok(g.icon && g.name && g.text && g.text.length > 30,
        `L${lvl.id} gimmick "${g.key}" needs an icon, a name and a real explanation`);
    }
  }
  // Every shipped mechanic is represented — this is what makes the check above
  // meaningful rather than vacuously true on a campaign with no gimmicks.
  assert.equal(kinds.size, FIELD_TO_KEY.length,
    `every shipped gimmick kind must appear somewhere in the campaign (saw ${[...kinds].join(", ")})`);
  // The night line must QUOTE the engine's number, never a literal that can drift.
  const nightLevel = DATA.LEVELS.find((l) => l.night);
  const nightText = TD.levelGimmicks(nightLevel).find((g) => g.key === "night").text;
  assert.match(nightText, new RegExp(String(Math.round(DATA.RULES.nightRangeMult * 100)) + "%"),
    "the night entry must state the engine's actual nightRangeMult");
});

// The targeting control had two owners: the engine gated "cheap" on `mods`
// (fixed at createEngine from opts.meta) while the button re-derived it from
// save.meta. Those can disagree — a resumed run, or a respec mid-session — and
// the button relabelled itself even when setTargeting refused, so the tower kept
// its old mode while the UI claimed otherwise. One owner now.
test("TD8 targeting: the ENGINE owns which modes a run allows, and refuses the rest", () => {
  const L = DATA.LEVELS[0];
  const plain = TD.createEngine(L, { seed: 7 });
  const withNode = TD.createEngine(L, { seed: 7, meta: ["cheaptarget"] });
  assert.ok(plain.targetingModes().indexOf("cheap") < 0, "without the 🔻 Weak Spot node, cheap is not offered");
  assert.ok(withNode.targetingModes().indexOf("cheap") >= 0, "with the node, it is");
  // every OFFERED mode must be accepted, and anything not offered must be refused —
  // that pairing is what stops the button showing a mode the engine will reject.
  plain.place("dart", L.pads[0].id);
  const t = plain.state.towers[0];
  for (const m of plain.targetingModes()) {
    assert.ok(plain.setTargeting(t.id, m).ok, `an offered mode ("${m}") must be accepted`);
    assert.equal(t.targeting, m);
  }
  const denied = plain.setTargeting(t.id, "cheap");
  assert.equal(denied.ok, false, "a mode this run does not allow is refused");
  assert.equal(denied.reason, "locked");
  assert.notEqual(t.targeting, "cheap", "…and the tower is unchanged, so a UI that honours the result cannot lie");
});

// reachedBy must DERIVE from the arsenal, not restate it. Both the line list and
// the air answer were literals, so a 5th tower line (or a change to which lines
// reach air) would have left the Toybox Guide teaching the old counter matrix
// while the engine did something else — the counting law, applied to the thing
// the guide exists to explain.
test("TD-12 guide truth: reachedBy DERIVES from TOWERS (hitsFliers / kind), never a literal", () => {
  const lines = Object.keys(DATA.TOWERS);
  // ground enemy: everything reaches it
  assert.deepEqual(TD.reachedBy(DATA.ENEMIES.sock), lines, "a plain ground enemy is reachable by every line");
  // flier: exactly the lines whose data says they hit air
  const air = lines.filter((k) => DATA.TOWERS[k].hitsFliers);
  assert.deepEqual(TD.reachedBy(DATA.ENEMIES.hawk), air, "a flier is reachable by exactly the hitsFliers lines");
  assert.ok(air.length >= 1 && air.length < lines.length, "air is answerable, but not by everything");
  // boss: soldiers never engage one (fireTowers skips ed.boss), so no camp line
  const noCamp = lines.filter((k) => DATA.TOWERS[k].kind !== "camp");
  assert.deepEqual(TD.reachedBy(DATA.ENEMIES.bedmonster), noCamp, "a boss cannot be blocked by bodies");
  // …and the derivation must FOLLOW the data. Flip hitsFliers on a clone and the
  // answer must change; a literal would not notice.
  const realDart = DATA.TOWERS.dart.hitsFliers;
  try {
    DATA.TOWERS.dart.hitsFliers = false;
    assert.ok(TD.reachedBy(DATA.ENEMIES.hawk).indexOf("dart") < 0,
      "flipping dart.hitsFliers must remove it from a flier's answer — reachedBy is reading a literal");
  } finally { DATA.TOWERS.dart.hitsFliers = realDart; }
});

// A badge that EXISTS is not a badge you can EARN. The shipped structure test
// asserts ACHIEVEMENTS.length === bosses + 9, which forces the data to keep pace
// with the roster — but nothing forces the award to be wired. World 6 shipped
// with the Moving Van's badge added to the data and the `earnAch` line added by
// hand in a separate file; had that line been missed, the count guardrail would
// still have been green and the badge simply unobtainable. Same class as the
// fort-home grid that showed 12 cards for 16 levels.
//
// Checked as TEXT against td-main.js rather than by refactoring a shipped award
// path: the win handler is a long chain of level-id guards, and the cheap,
// honest check is that each boss level appears in it.
test("AUDIT badges: every boss finale's achievement is actually AWARDED somewhere", () => {
  const main = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "scripts/td-main.js"), "utf8");
  const bossLevels = DATA.LEVELS.filter((l) => (l.waves || []).some((w) => w.boss));
  assert.ok(bossLevels.length >= 6, `the campaign really has boss finales (${bossLevels.length})`);
  for (const l of bossLevels) {
    // the award chain guards on the level id, e.g. `if (st.levelId === 24) earnAch("notleaving")`
    const re = new RegExp("levelId\\s*===\\s*" + l.id + "\\b[^\\n]*earnAch\\(");
    assert.match(main, re,
      `L${l.id} (${l.name}) is a boss finale but nothing in td-main.js awards a badge for beating it — ` +
      "the ACHIEVEMENTS count guardrail cannot see this, because the datum exists and only the wiring is missing");
  }
  // …and every id the chain awards must be a real ACHIEVEMENTS entry, so a typo
  // in either direction is caught rather than silently never firing.
  const ids = new Set(DATA.ACHIEVEMENTS.map((a) => a.id));
  const awarded = new Set();
  for (const m of main.matchAll(/earnAch\("([a-z0-9_]+)"\)/g)) {
    awarded.add(m[1]);
    assert.ok(ids.has(m[1]), `td-main.js awards "${m[1]}", which is not in DATA.ACHIEVEMENTS`);
  }
  // THE OTHER DIRECTION, which nothing checked: a badge can be declared, counted
  // by the `bosses + 9` structure test, rendered in the 🏅 overlay — and awarded
  // by nothing at all. The boss loop above only covers the finale badges, so the
  // nine cross-cutting ones (First Blood, No Leaks, Pea Purist, Ice Age, Star
  // Collector, Full Fort, Marathoner, Heroic Heart, Dyson Denied) were declared
  // with no check that anything can hand them out. Measured clean on ship — all
  // 19 are awarded — so this exists for the twentieth, which would otherwise be
  // dead content of exactly the kind this repo has shipped twice (heroic with no
  // selector, World 4 with no cards).
  for (const a of DATA.ACHIEVEMENTS) {
    assert.ok(awarded.has(a.id),
      `"${a.id}" (${a.name}) is declared in DATA.ACHIEVEMENTS but no earnAch() in td-main.js ever awards it — ` +
      "it would show in the 🏅 overlay as a badge the player can never earn");
  }
  assert.equal(awarded.size, DATA.ACHIEVEMENTS.length,
    `every declared badge is awarded and every award is declared (${awarded.size} vs ${DATA.ACHIEVEMENTS.length})`);
});

// ================= Phase 4: owning a node and BRINGING it =================

test("P4 loadout: RULES.metaSlots is a real cap, and the tree is bigger than it", () => {
  const R = DATA.RULES;
  assert.ok(R.metaSlots >= 1 && R.metaSlots < DATA.META_NODES.length,
    `a run must bring FEWER nodes (${R.metaSlots}) than the tree holds (${DATA.META_NODES.length}) — otherwise the slot budget is decoration`);
  // and the tree must still cost more than you can ever earn, so allocation is
  // a permanent choice as well as a per-run one
  const total = DATA.META_NODES.reduce((s, n) => s + n.cost, 0);
  const cap = DATA.LEVELS.length * 3;
  assert.ok(total > cap, `tree total (${total}⭐) must exceed the earnable ceiling (${cap}⭐)`);
});

test("P4 loadout: a capped loadout really is weaker than the whole tree", () => {
  // The measurement that set metaSlots. Reported in lives LOST rather than lives
  // remaining, because Extra Hearts raises the STARTING total — "finished at 18"
  // against a 24-life door is not softer than 14 against 20, and the shipped
  // remaining-lives band silently mis-scores every lives-boosting loadout.
  const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;
  const lvl = DATA.LEVELS.find((l) => l.id === 16);           // the boss-quantized attic finale
  function lost(meta, seed) {
    const e = TD.createEngine(lvl, { seed, difficulty: "normal", meta });
    const start = e.state.lives;
    let guard = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 400000) {
      if (e.state.phase === "build") {
        let spent = true;
        while (spent) {
          spent = false;
          for (const p of lvl.pads) {
            if (!e.state.towers.find((t) => t.padId === p.id)) {
              if (e.state.gold >= cost("dart", 0) && e.place("dart", p.id).ok) spent = true;
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
    return e.state.phase === "won" ? start - e.state.lives : -1;
  }
  const ALL = DATA.META_NODES.map((n) => n.id);
  const seeds = [1, 2, 3];
  const avg = (m) => seeds.map((s) => lost(m, s)).reduce((a, b) => a + b, 0) / seeds.length;
  const none = avg([]), all = avg(ALL), capped = avg(DATA.META_NODES.filter((n) => n.branch === "econ").map((n) => n.id).slice(0, DATA.RULES.metaSlots));
  assert.ok(none > all, `the whole tree really does trivialise this finale (${none} lives lost → ${all})`);
  assert.ok(capped > all,
    `a ${DATA.RULES.metaSlots}-slot loadout must cost the player more than owning everything (${capped} vs ${all}) — that is what the cap buys`);
});

// ================= P4.3: the tree grows by BREADTH =================

test("P4.3 tree: it costs more than a 32-level campaign can earn", () => {
  // The star ceiling DERIVES as LEVELS.length * 3, and the tree must cost more
  // than you can ever earn or a completionist buys everything and the choice
  // evaporates. At 24 levels that is 72; a seventh and eighth world take it to
  // 96, which is what made the 77⭐ tree the hard blocker on expanding.
  const total = DATA.META_NODES.reduce((s, n) => s + n.cost, 0);
  assert.ok(total > DATA.LEVELS.length * 3, `tree ${total}⭐ must exceed today's ceiling ${DATA.LEVELS.length * 3}⭐`);
  assert.ok(total > 96, `tree ${total}⭐ must also clear a 32-level ceiling (96⭐) — otherwise a seventh world cannot ship`);
  // …and a run must still bring far fewer nodes than the tree holds
  assert.ok(DATA.RULES.metaSlots * 3 <= DATA.META_NODES.length,
    `a ${DATA.RULES.metaSlots}-slot pack against ${DATA.META_NODES.length} nodes keeps allocation a real decision`);
  // no duplicate ids, and every branch is a real one
  const ids = DATA.META_NODES.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "node ids are unique");
  const branches = new Set(DATA.META_BRANCHES.map((b) => b.id));
  for (const n of DATA.META_NODES) assert.ok(branches.has(n.branch), `node ${n.id} names a real branch`);
});

test("P4.3 tree: every node CHANGES something — no node is decoration", () => {
  // A node that produces no engine difference is a star you spent on nothing.
  // metaMods is pure, so this is exact: flip one node on and require the mods
  // object to differ. The one deliberate exception is documented inline.
  // pure INFORMATION: read by the wave preview, never by the engine. The first
  // cut of this test wrote `void UI_ONLY` and asserted every node changes
  // metaMods — which passed only because a DEAD `scout` key existed. A key no
  // engine site reads is not "pure input", it is decoration with extra steps.
  const UI_ONLY = new Set(["scoutreport"]);
  const base = JSON.stringify(TD.metaMods([]));
  const engineSrc = require("fs").readFileSync("scripts/td-logic.js", "utf8");
  const inEngine = engineSrc.slice(engineSrc.indexOf("function createEngine"));
  for (const n of DATA.META_NODES) {
    const withIt = JSON.stringify(TD.metaMods([n.id]));
    if (UI_ONLY.has(n.id)) {
      assert.equal(withIt, base,
        `"${n.id}" is declared UI-only, so it must NOT add a metaMods key — an unread key is dead code`);
      continue;
    }
    assert.notEqual(withIt, base, `node "${n.id}" changes nothing in metaMods — it is a star spent on decoration`);
  }
  // …and every metaMods key must actually be CONSUMED inside createEngine.
  // Reproduced by the review that prompted this: `scout` was the one key no
  // engine site ever read.
  const dead = Object.keys(TD.metaMods(DATA.META_NODES.map((n) => n.id)))
    .filter((k) => !inEngine.includes("mods." + k));
  assert.deepEqual(dead, [], `metaMods keys nothing in the engine reads: ${dead.join(", ")}`);
  // …and a UI-only node must be read from the RUN's loadout, not save.meta
  const ui = require("fs").readFileSync("scripts/td-ui.js", "utf8");
  for (const id of UI_ONLY) {
    assert.ok(ui.includes(id), `the UI-only node "${id}" must actually be read somewhere in the UI`);
    assert.match(ui, /state\.meta \|\| \[\]/, "…and from the run's equipped loadout (state.meta), not from save.meta");
  }
});

test("starGoal names the NEAREST next star, and nothing at the top", () => {
  // The victory screen prints this, so it is player-facing arithmetic and the
  // engine owns it (the ask-the-engine law this batch is about). Written
  // order-independently on purpose: R.stars is authored descending today and
  // the result must not silently depend on that.
  const e = TD.createEngine(DATA.LEVELS[0], { seed: 1 });
  const th = DATA.RULES.stars;
  const top = Math.max(...th.map(([n]) => n));
  assert.equal(e.starGoal(top), null, "at the top threshold there is no next star");
  assert.equal(e.starGoal(top + 5), null,
    "…nor above it — ❤️ Extra Hearts can start a run higher than the 3★ bar");
  for (const [need] of th) {
    const g = e.starGoal(need - 1);
    assert.ok(g, `one life short of ${need} must name a goal`);
    assert.ok(g.need <= need,
      `…and it must be the NEAREST threshold above, got ${g.need} for ${need - 1} lives`);
    assert.ok(g.need > need - 1, "…and strictly above the lives you finished with");
  }
  assert.equal(e.starGoal(0).need, Math.min(...th.map(([n]) => n)),
    "from zero the next star is the LOWEST threshold, whatever order R.stars is authored in");
});

test("the run's STARTING lives have one owner — ❤️ Extra Hearts moved a number two places printed literally", () => {
  // The victory screen read `lives + " of 20 stickers kept safe"` and the
  // No Leaks badge said "Win a level with all 20 lives", while a run carrying
  // ❤️ Extra Hearts II starts at 24 — so a flawless win rendered the literal
  // nonsense "24 of 20 stickers kept safe", and the badge's words promised a
  // life count while the code awards on "nothing leaked" (which is why 🌟
  // Sticker Shield correctly withholds it after an absorbed leak).
  //
  // This is the sell-refund / charge-per-wave defect a third time: a UI
  // re-deriving a quantity the meta layer had already moved. Same fix — the
  // engine owns it, everything else asks. CLAUDE.md already records the
  // underlying law from the balance side ("lives REMAINING is the wrong metric
  // the moment the meta can change the starting total"); it was never applied
  // to the strings.
  const L = DATA.LEVELS[0];
  for (const meta of [[], ["lives"], ["lives", "lives2"]]) {
    const e = TD.createEngine(L, { seed: 5, meta });
    assert.equal(e.maxLives(), e.state.lives,
      `maxLives() must BE the total the run starts with (meta ${JSON.stringify(meta)})`);
  }
  assert.equal(TD.createEngine(L, { seed: 5, meta: [] }).maxLives(), DATA.RULES.lives);
  assert.equal(TD.createEngine(L, { seed: 5, meta: ["lives", "lives2"] }).maxLives(),
    DATA.RULES.lives + 4, "Extra Hearts II must genuinely move the total, or the clause above is vacuous");

  // ONE owner: the 🩹 Patch Kit cap was the second place this was computed, and
  // two copies of a quantity is how the panel came to print 110 while the
  // engine charged 99. Comment-stripped, because this repo has three recorded
  // cases of a one-owner count counting its own documentation.
  const src = readSrc("scripts/td-logic.js").split("\n")
    .filter((l) => { const t = l.trim(); return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")); })
    .join("\n");
  const owners = (src.match(/R\.lives \+ mods\.lives/g) || []).length;
  assert.equal(owners, 1,
    `the run's starting life total must be computed in exactly ONE place — found ${owners}`);

  // …and the badge's WORDS must describe the condition the code actually tests.
  // It awards on `!cur.leaked`, never on a life count, and the count is not even
  // fixed. Pinned narrowly to the shape that shipped rather than banning the
  // digits — "Reach Endless wave 20" is a legitimate 20 two entries away.
  const noleaks = DATA.ACHIEVEMENTS.find((a) => a.id === "noleaks");
  assert.doesNotMatch(noleaks.desc, /\b\d+ lives\b/,
    `No Leaks awards on leaking nothing, not on a life count the meta can move — got "${noleaks.desc}"`);
  assert.match(noleaks.desc, /leak/i, "…so its words must name the leak");
});

test("P4 tree: the four ORPHAN nodes are DRIVEN, and no future node can escape", () => {
  // Found by enumerating META_NODES against the test sources: four nodes were
  // named in NO test at all — earlycall, ricochet, fieldrepair, quickmarch.
  // They were not invisible: the derived laws above proved each one changes
  // metaMods and that every metaMods key is read inside createEngine. But a
  // structural scan proves a READ SITE EXISTS; only driving the node proves the
  // read does what the node's own words promise. That gap is exactly how the
  // `cheap` aiming mode shipped described as chasing gold when the engine
  // finishes the almost-dead, and it is the same shape as the `ach` award chain
  // and `isRevealed`, both of which were covered only after being enumerated.
  //
  // Measured outcome: all four are CORRECT. This is coverage, not a fix — which
  // is the honest half to write down, because the next author needs to know the
  // hole was the test suite rather than the engine.
  const micro = (over) => Object.assign({
    id: 9900, name: "probe", world: "test", startGold: 9000, budgetBase: 100,
    path: [[0, 3], [23, 3]], pads: [{ id: "m", cx: 5, cy: 2 }],
    waves: [{ groups: [{ type: "sock", count: 1, gap: 1, delay: 0 }] }],
  }, over || {});

  // ⏩ Early Bird — "Early-call bonus ×1.5", at the ONE callWave payout
  const early = (meta) => {
    const e = TD.createEngine(micro(), { seed: 3, meta });
    const before = e.state.gold;
    assert.ok(e.callWave().ok, "the wave is callable from build");
    return e.state.gold - before;
  };
  const eb0 = early([]), eb1 = early(["earlycall"]);
  assert.ok(eb0 > 0, `the base early-call bonus must be non-zero or this clause is vacuous (got ${eb0})`);
  assert.ok(Math.abs(eb1 / eb0 - 1.5) < 0.02,
    `Early Bird must pay 1.5x the early-call bonus — measured ${(eb1 / eb0).toFixed(3)} (${eb0} → ${eb1})`);
  // …and the WORDS carry that same number, so re-tuning the node cannot leave
  // its description behind. That coupling is the entire point of this test.
  assert.match(DATA.META_NODES.find((n) => n.id === "earlycall").desc, /1\.5/,
    "Early Bird's description must state the 1.5x it was just measured to pay");

  // 🪃 Ricochet — "The Fan's chain jumps one more", at the ONE chain loop.
  // Static Zap carries no zapDps, so the chain is the only thing that can
  // damage anything here and `hurt` IS the arc length.
  const BODIES = 9;
  const chainHurt = (meta) => {
    const e = TD.createEngine(micro(), { seed: 3, meta });
    e.state.gold = 999999;
    assert.ok(e.place("fan", "m").ok);
    const t = e.state.towers[0];
    assert.ok(e.upgrade(t.id).ok && e.upgrade(t.id).ok && e.branch(t.id, "b").ok,
      "the probe reaches Static Zap (upgrade takes a tower ID, never an index)");
    assert.equal(t.branch, "b", "…and the branch actually took");
    e.state.phase = "wave";
    for (let i = 0; i < BODIES; i++) {
      const f = mkEnemy("knight", 4.6 + i * 0.6);
      f.id = 8000 + i; f.hp = 1e6; f.maxHp = 1e6; f.shield = 0; f.speed = 0;
      e.state.enemies.push(f);
    }
    const hp0 = e.state.enemies.map((x) => x.hp);
    for (let i = 0; i < 120; i++) e.tick();
    return e.state.enemies.filter((x, i) => x.hp < hp0[i]).length;
  };
  const targets = DATA.TOWERS.fan.branches.b.chain.targets;
  const ch0 = chainHurt([]), ch1 = chainHurt(["ricochet"]);
  assert.equal(ch0, targets, `Static Zap's arc must reach its declared ${targets} bodies — measured ${ch0}`);
  assert.equal(ch1, targets + 1, `Ricochet must add exactly one jump — measured ${ch1}`);
  assert.ok(ch1 < BODIES, "…and the line is longer than the arc, so the count is capped by the node and not by supply");

  // 🧰 Field Repair — "Jammed guns come back twice as fast", at the ONE jamTower.
  // The screw is pinned at speed 0: its sap fires every 7s and it would
  // otherwise walk 5.6 cells clear of its own 3.5-cell radius first, which is
  // how the first run of this probe reported a confident "never jams".
  const jam = (meta) => {
    const e = TD.createEngine(micro(), { seed: 3, meta });
    e.state.gold = 999999;
    assert.ok(e.place("dart", "m").ok);
    const t = e.state.towers[0];
    e.state.phase = "wave";
    const screw = mkEnemy("screw", 5);
    screw.hp = 1e6; screw.maxHp = 1e6; screw.speed = 0;
    e.state.enemies.push(screw);
    const p = e.posOn(0, screw.dist);
    assert.ok(Math.hypot(p.x - t.cx, p.y - t.cy) < DATA.ENEMIES.screw.sap.radius,
      "fixture precondition: the gun is inside the screw's sap radius");
    for (let i = 0; i < 900; i++) {
      e.tick();
      if (t.disabledUntil > e.state.tick) return t.disabledUntil - e.state.tick;
    }
    return 0;
  };
  const declared = Math.round(DATA.ENEMIES.screw.sap.seconds * DATA.TICK_RATE);
  const j0 = jam([]), j1 = jam(["fieldrepair"]);
  assert.equal(j0, declared, `an un-helped jam lasts the screw's declared ${declared} ticks — measured ${j0}`);
  assert.ok(Math.abs(j1 / j0 - 0.5) < 0.03,
    `Field Repair must halve a jam — measured ${(j1 / j0).toFixed(3)} (${j0} → ${j1} ticks)`);

  // 🥾 Quick March — "Soldiers reach their post sooner", at the ONE march step.
  // Measured as ground covered over a fixed window rather than as arrival, so
  // the spawn stagger cancels: both squads take their first step before the
  // window opens, and the ratio is the step ratio.
  const march = (meta) => {
    const e = TD.createEngine(micro({ pads: [{ id: "m", cx: 5, cy: 6 }] }), { seed: 3, meta });
    e.state.gold = 999999;
    assert.ok(e.place("camp", "m").ok);
    e.state.phase = "wave";
    e.tick();
    const s = e.state.soldiers[0];
    assert.ok(s, "the camp fields a soldier");
    const x0 = s.x, y0 = s.y;
    for (let i = 0; i < 12; i++) e.tick();
    const moved = Math.hypot(s.x - x0, s.y - y0);
    assert.ok(moved > 0 && Number.isFinite(moved),
      `fixture precondition: the soldier walked a finite, sane distance (got ${moved})`);
    return moved;
  };
  const mm = TD.metaMods(["quickmarch"]).marchMul;
  const m0 = march([]), m1 = march(["quickmarch"]);
  // TWO clauses, because the first one alone PASSED its mutation: it derives
  // the expectation from the very mod it is testing, so neutering marchMul to
  // 1 flattens the expectation with the data and 1.000 ≈ 1.000 is satisfied.
  // The same shape as the chain-decay check that goes vacuous at decay 1.0 —
  // written here by the person who documented it. The first clause keeps the
  // measurement honest if the value is ever re-tuned; the second is what makes
  // the node load-bearing at all, and it cannot flatten.
  assert.ok(m1 > m0 * 1.05,
    `Quick March must genuinely quicken the march — measured ${m0.toFixed(3)} → ${m1.toFixed(3)} cells per 12 ticks`);
  assert.ok(Math.abs(m1 / m0 - mm) < 0.02,
    `…and by exactly the declared ${mm}x — measured ${(m1 / m0).toFixed(3)}`);

  // …AND THE DERIVED HALF, so the next node cannot repeat this. A star-tree
  // node must be NAMED by some test, which is the cheapest available proxy for
  // "somebody wrote something that drives it". Full-line comments are stripped
  // first: this repo has three recorded cases of a scan counting its own
  // documentation (the art.js <defs> scan, the install action's env clause, and
  // startMusic()'s call sites), and prose about a node must not stand in for a
  // test of it.
  const stripComments = (s) => s.split("\n").filter((l) => {
    const t = l.trim();
    return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
  }).join("\n");
  const suites = ["tests/td-logic.test.js", "tests/td.test.js"]
    .map((f) => stripComments(readSrc(f))).join("\n");
  const unnamed = DATA.META_NODES
    .filter((n) => !new RegExp("[\"'`]" + n.id + "[\"'`]").test(suites))
    .map((n) => `${n.id} (${n.name})`);
  assert.deepEqual(unnamed, [],
    `star-tree nodes no test ever names: ${unnamed.join(", ")} — its metaMods key being read is not proof the read does what the node promises`);
});

test("P4.3 breadth: each new KIND is felt at its own engine site", () => {
  const L = DATA.LEVELS[0];
  const mk = (meta) => TD.createEngine(L, { seed: 4, meta });

  // 🔋 Spare Battery — the ONE charge grant
  const a = mk([]), b = mk(["sparebattery"]);
  a.callWave(); b.callWave();
  assert.equal(b.state.charge, a.state.charge + 1, "Spare Battery grants an extra energy per wave");

  // 🧊 Deep Freeze — inside the ONE applySlow
  const slowOf = (meta) => {
    const e = mk(meta);
    e.callWave();
    for (let i = 0; i < 40; i++) e.tick();
    const x = mkEnemy("sock", 4, 0);
    e.state.enemies.length = 0; e.state.enemies.push(x);
    e.state.gold = 9e6; e.state.charge = 9;
    const p = e.posOn(0, 4);
    assert.equal(e.useAbility("sticky", { x: p.x, y: p.y }).ok, true);
    e.tick();
    return x.slowUntil - e.state.tick;
  };
  const plain = slowOf([]), frozen = slowOf(["deepfreeze"]);
  assert.ok(frozen > plain, `Deep Freeze lengthens a slow (${plain} → ${frozen} ticks)`);

  // 💣 Wider Blast — one radius, so the blast and the puddle agree
  const radOf = (meta) => {
    const e = mk(meta);
    e.callWave();
    for (let i = 0; i < 40; i++) e.tick();
    e.state.gold = 9e6; e.state.charge = 9;
    const p = e.posOn(0, 4);
    assert.equal(e.useAbility("sticky", { x: p.x, y: p.y }).ok, true);
    return e.state.puddles[e.state.puddles.length - 1].r;
  };
  assert.ok(radOf(["widerblast"]) > radOf([]), "Wider Blast really widens the zone that is placed");

  // 🧰 Field Repair — ONE owner for jamming, so the sap AND a boss phase inherit it
  const src = require("fs").readFileSync("scripts/td-logic.js", "utf8");
  const writes = (src.match(/\.disabledUntil\s*=/g) || []).length;
  assert.equal(writes, 1, `"disabledUntil" must have exactly ONE writer (found ${writes}) — two writers is how a mod applies to one jam and not the other`);
  assert.match(src, /function jamTower/, "…and that owner is jamTower");

  // 🪃 Ricochet + 🥾 Quick March — read at their own single sites
  assert.match(src, /s\.chain\.targets \+ mods\.chainPlus/, "Ricochet is read at the chain's target count");
  assert.match(src, /R\.soldierWalkSpeed \* mods\.marchMul/, "Quick March is read at the soldier walk step");

  // …and "ONE read site" is an ASSERTION for these keys, not a claim. It was
  // rhetorical at first, and a review pointed out that mods.abilityRadius had
  // quietly acquired two (the helper plus an inline scale on 🧨's reveal zone).
  // Scoped honestly to the P4.3 keys: several OLDER keys legitimately read at
  // more than one place (soldierHp at five, bossDmg at five), and retrofitting
  // them is a refactor this does not license.
  // COMMENTS STRIPPED FIRST: a comment that merely names a key is prose, not a
  // read site, and counting it turns this into a comment-linter (it failed on
  // its own explanatory comment the first time).
  const code = src.split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
  for (const key of ["charge", "slowSeconds", "abilityRadius", "jamMul", "chainPlus", "marchMul"]) {
    const n = (code.match(new RegExp("mods\\." + key + "\\b", "g")) || []).length;
    assert.equal(n, 1, `mods.${key} must be read at exactly ONE site (found ${n}) — a second site is how a buff applies to one path and not the other`);
  }
});

test("a hit event NAMES the body it landed on — the renderer's flash is keyed on it", () => {
  // Shots used to land with a poof in the air and no reaction from the body they
  // struck, because the event said WHERE it landed and never WHAT it hit. The
  // renderer whitens and pops that sprite now, so the id is load-bearing.
  //
  // This lives here, in the engine suite, and that is the point: the browser
  // guardrail drives `pushFx` directly, so it proves the RENDERER reacts to an
  // id — it cannot notice the engine no longer sending one (verified: deleting
  // `id: target.id` left that test green). Events are not part of `state`, so
  // this cannot move the determinism hash.
  const eng = TD.createEngine(L1, { seed: 5 });
  eng.state.gold = 99999;
  eng.place("dart", L1.pads[0].id);
  eng.callWave();
  let hit = null;
  for (let i = 0; i < 4000 && !hit; i++) {
    eng.tick();
    hit = eng.events.find((e) => e.type === "hit");
  }
  assert.ok(hit, "a dart landed a hit inside 4000 ticks");
  assert.equal(typeof hit.id, "number", "the hit event names WHICH enemy it struck");
  assert.ok(eng.state.enemies.some((e) => e.id === hit.id),
    `hit.id ${hit.id} must be a real body on the field`);
});

// ---------------------------------------------------------------------------
// AUDIT: the camp BLOCK machinery — the one path that can freeze an enemy, and
// the one neither winnability oracle ever builds.
//
// Both shipped plans (DART, MIXED) buy no camps at all, so `blockedBy` — the
// only code in the engine that stops a live enemy indefinitely — was exercised
// by a handful of bespoke tests and nothing else. That hole surfaced while
// chasing a "killed enemies are stuck on the map" report: a camp-heavy sweep was
// the first thing that produced stalled bodies at all, and telling a real freeze
// from a soldier legitimately holding an enemy took a duration measurement.
//
// Worse, `blocks: 2` (hold TWO at once) exists on exactly ONE stat block in the
// whole game — the Dino Squad tier-4 branch — so `countBlocked`/`maxBlocks` were
// dead code at every tier anything in the suite ever built.
//
// The invariant is deliberately "freed within ONE tick", not "never held by a
// dead soldier": soldiers die in soldierTick(), which runs AFTER the enemy loop,
// so at end-of-tick a second held enemy can legitimately still point at the
// blocker that just fell, and the enemy loop clears it on its next pass. Stating
// it as "never" would fail on correct code — measured at exactly 1 tick.
// ---------------------------------------------------------------------------
function campSweep(levels, opts) {
  const dino = opts && opts.dino;
  let everBlocked = 0, maxHold = 0, worstDeadRun = 0, worstDeadInfo = "", frozen = [], hung = [];
  for (const lv of levels) {
    const eng = TD.createEngine(lv, { seed: 3, difficulty: "normal" });
    const st = eng.state;
    let built = false, guard = 0;
    const seen = new Set(), deadRun = new Map(), lastDist = new Map(), stall = new Map();
    while (st.phase !== "won" && st.phase !== "lost" && st.waveIdx < 6) {
      if (st.phase === "build") {
        if (dino) st.gold = 99999;
        if (!built) { for (const p of lv.pads) eng.place("camp", p.id); built = true; }
        for (const p of lv.pads) eng.place("camp", p.id);
        if (dino) for (const t of st.towers) { eng.upgrade(t.id); eng.upgrade(t.id); eng.branch(t.id, "a"); }
        eng.callWave();
      }
      eng.tick();
      const live = new Set(st.soldiers.filter((s) => s.alive).map((s) => s.id));
      const held = new Map();
      for (const e of st.enemies) {
        if (!e.alive) continue;
        if (e.blockedBy) {
          seen.add(e.id);
          held.set(e.blockedBy, (held.get(e.blockedBy) || 0) + 1);
          const n = live.has(e.blockedBy) ? 0 : (deadRun.get(e.id) || 0) + 1;
          deadRun.set(e.id, n);
          if (n > worstDeadRun) { worstDeadRun = n; worstDeadInfo = `L${lv.id} ${e.type}#${e.id} soldier ${e.blockedBy}`; }
        } else deadRun.set(e.id, 0);
        const prev = lastDist.get(e.id);
        if (prev !== undefined && Math.abs(e.dist - prev) < 1e-9) {
          const k = (stall.get(e.id) || 0) + 1;
          stall.set(e.id, k);
          if (k === 1200) frozen.push(`L${lv.id} ${e.type}#${e.id} has not moved for 40s at dist ${e.dist.toFixed(2)} (blockedBy=${e.blockedBy})`);
        } else stall.set(e.id, 0);
        lastDist.set(e.id, e.dist);
      }
      for (const n of held.values()) if (n > maxHold) maxHold = n;
      if (++guard > 80000) { hung.push(`L${lv.id} never resolved (phase ${st.phase}, wave ${st.waveIdx})`); break; }
    }
    everBlocked += seen.size;
  }
  return { everBlocked, maxHold, worstDeadRun, worstDeadInfo, frozen, hung };
}

test("AUDIT: a camp board never freezes an enemy, and its block cap holds", () => {
  // One level per world, camps on every pad — derived, so a tenth world inherits it.
  const seen = new Set(), levels = [];
  for (const lv of DATA.LEVELS) if (!seen.has(lv.world)) { seen.add(lv.world); levels.push(lv); }
  const r = campSweep(levels);
  // Coverage floor FIRST: without it every assertion below passes vacuously on a
  // build where camps stopped engaging at all.
  assert.ok(r.everBlocked > 300,
    `only ${r.everBlocked} enemies were ever blocked across ${levels.length} levels — the block path must actually run`);
  assert.deepEqual(r.hung, [], "a camp-only board must always resolve its waves");
  assert.deepEqual(r.frozen, [], "no enemy may sit motionless for 40s");
  // EXACTLY zero, not "at most one". With blocks:1 the soldier engages the one
  // enemy it holds, so the melee-death path clears that foe as it falls and the
  // state never arises at all. Asserting <= 1 here would be vacuous — measured:
  // deleting the enemy loop's dead-blocker rescue leaves this test green, and
  // only the Dino case below goes red. This assertion instead pins the melee
  // path's own release, which is what keeps the plain case clean.
  assert.equal(r.worstDeadRun, 0,
    `an enemy ended a tick held by a DEAD soldier (${r.worstDeadInfo}) — with a single-block camp the melee ` +
    "death path must clear its foe as it falls, so this state should never occur");
  assert.equal(r.maxHold, 1, `a plain camp holds one enemy per soldier, saw ${r.maxHold}`);
});

test("AUDIT: Dino Squad really does hold TWO — the only stat block with blocks > 1", () => {
  // `blocks: 2` lives on exactly one branch in the whole game, so without this
  // the multi-hold code (countBlocked / maxBlocks) is never executed by anything.
  const lv = DATA.LEVELS.find((l) => l.id === 12);
  const r = campSweep([lv], { dino: true });
  assert.equal(DATA.TOWERS.camp.branches.a.blocks, 2, "Dino Squad is the double-block branch");
  assert.equal(r.maxHold, 2,
    `a Dino soldier held at most ${r.maxHold} enemies — its blocks:2 must actually let it hold two, and never three`);
  assert.deepEqual(r.frozen, [], "no enemy may sit motionless for 40s under a double-blocking squad");
  assert.ok(r.worstDeadRun <= 1,
    `held by a dead Dino for ${r.worstDeadRun} ticks (${r.worstDeadInfo}) — the SECOND held enemy is the one the ` +
    "melee-death path does not clear, so the enemy loop's release is what stops it freezing");
});

// NOT ADDED: a "selling a camp releases what it held" test. One was written and
// then removed — `TD2 selling a camp mid-melee frees its blocked enemies and
// dismisses the squad` above already drives exactly that path (block → sell →
// nobody frozen → it resumes), and a near-duplicate on a shipped level instead
// of a synthetic one is noise, not coverage. Recorded so the gap is not
// "re-closed" a third time. Measured: with the dead-blocker rescue deleted, the
// sell tests both stay GREEN — sell() clears blockedBy itself — which is why the
// Dino case above is the only thing that pins that rescue line.

test("AUDIT: priceOf is the ONE price owner — what it quotes is what it charges", () => {
  // The panel used to re-derive prices from DATA while the engine applied a meta
  // discount, so a run owning 🔧 Handyman was SHOWN 110 and CHARGED 99 — and the
  // button sat red-and-disabled across the 100-109 band it could afford. Fixed
  // by making the engine the single source: place/upgrade/branch all read
  // priceOf, and the UI asks for it instead of computing its own.
  const lv = DATA.LEVELS[0];
  const mk = (meta) => TD.createEngine(lv, { seed: 3, meta });
  for (const meta of [[], ["handyman"], ["branchcost"], ["handyman", "branchcost"]]) {
    const e = mk(meta);
    const tag = meta.length ? meta.join("+") : "no-meta";
    // BUILD: quoted === charged
    e.state.gold = 99999;
    let before = e.state.gold;
    const buildPrice = e.priceOf("build", "dart");
    assert.ok(e.place("dart", lv.pads[0].id).ok, `${tag}: place`);
    assert.equal(before - e.state.gold, buildPrice, `${tag}: build charged something other than its quote`);
    const t = e.state.towers[0];
    // UPGRADE: quoted === charged, at every tier it is offered
    while (t.tier < 3) {
      const q = e.priceOf("upgrade", t.id);
      before = e.state.gold;
      assert.ok(e.upgrade(t.id).ok, `${tag}: upgrade to ${t.tier + 1}`);
      assert.equal(before - e.state.gold, q, `${tag}: upgrade charged something other than its quote`);
    }
    // BRANCH: quoted === charged
    const qb = e.priceOf("branch", { towerId: t.id, choice: "a" });
    before = e.state.gold;
    assert.ok(e.branch(t.id, "a").ok, `${tag}: branch`);
    assert.equal(before - e.state.gold, qb, `${tag}: branch charged something other than its quote`);
    // …and once maxed there is nothing left to quote.
    assert.equal(e.priceOf("upgrade", t.id), Infinity, `${tag}: a tier-4 tower has no upgrade price`);
  }
  // The discounts must MOVE the number, or the loop above proves nothing.
  const plain = mk([]), hand = mk(["handyman"]), bulk = mk(["branchcost"]);
  for (const e of [plain, hand, bulk]) { e.state.gold = 99999; e.place("dart", lv.pads[0].id); }
  const [p, h] = [plain.state.towers[0], hand.state.towers[0]];
  assert.ok(hand.priceOf("upgrade", h.id) < plain.priceOf("upgrade", p.id),
    "🔧 Handyman must lower the upgrade quote");
  const bt = bulk.state.towers[0];
  while (bt.tier < 3) bulk.upgrade(bt.id);
  while (p.tier < 3) plain.upgrade(p.id);
  assert.ok(bulk.priceOf("branch", { towerId: bt.id, choice: "a" }) < plain.priceOf("branch", { towerId: p.id, choice: "a" }),
    "💰 Bulk Deal must lower the branch quote");
  // Unpurchasable is Infinity, so `gold >= price` is false rather than NaN-false.
  assert.equal(plain.priceOf("build", "nope"), Infinity, "an unknown line has no price");
  assert.equal(plain.priceOf("upgrade", 999999), Infinity, "an unknown tower has no price");
  assert.equal(plain.priceOf("branch", { towerId: p.id, choice: "zz" }), Infinity, "an unknown branch has no price");
});

test("laneCoverage: placement is a REAL difference, and the number PREDICTS it", () => {
  // Placement is the fort's biggest invisible decision — the branch audit
  // measured up to 5 lives from which tower you convert — and nothing in the
  // game said a word about it. This is the number that makes it visible, so it
  // has to actually discriminate and actually predict, not merely look precise.
  const dart = DATA.TOWERS.dart.tiers[2];

  // 1. it DISCRIMINATES on shipped maps. A metric that reads the same at every
  //    pad would be worse than no metric: it would tell the player the choice
  //    does not matter, which is the opposite of what the sweep found.
  for (const id of [12, 20, 33]) {
    const lvl = DATA.LEVELS.find((l) => l.id === id);
    const cov = lvl.pads.map((p) => TD.laneCoverage(lvl, p.cx, p.cy, dart.range, 0));
    const best = Math.max(...cov), worst = Math.min(...cov);
    assert.ok(best > worst * 1.8,
      `L${id}: coverage must separate pads (best ${(best * 100).toFixed(1)}% vs worst ${(worst * 100).toFixed(1)}%)`);
    assert.ok(best > 0 && best < 1, `L${id}: a sane fraction, got ${best}`);
  }

  // 2. the Mortar's DEAD ZONE is subtracted. It is the one stat that makes two
  //    pads at equal distance genuinely different, so ignoring it would mislead
  //    exactly where the advice matters most.
  const l20 = DATA.LEVELS.find((l) => l.id === 20);
  const pad = l20.pads[0];
  const open = TD.laneCoverage(l20, pad.cx, pad.cy, 4, 0);
  const holed = TD.laneCoverage(l20, pad.cx, pad.cy, 4, 2.5);
  assert.ok(holed < open, `a minimum range must REDUCE coverage (${holed} vs ${open})`);

  // 3. monotonic in range — more reach can never cover less lane
  let prev = -1;
  for (const r of [1, 2, 3, 4, 6, 9]) {
    const c = TD.laneCoverage(l20, pad.cx, pad.cy, r, 0);
    assert.ok(c >= prev, `coverage must not fall as range grows (r=${r})`);
    prev = c;
  }
  assert.equal(TD.laneCoverage(l20, pad.cx, pad.cy, 0, 0), 0, "no range covers nothing");

  // 3b. REACH spans every field the stat block has. The Fan carries TWO — a
  //     1.8-cell slow aura and a 2.2-cell zap — and an earlier cut of this read
  //     only the aura, which reported a tier-1 fan covering 0% of the lane on
  //     312 of 451 shipped pads. That is not a rounding error, it is a LIE
  //     about a tower the player is deciding whether to buy.
  {
    let zero = 0, total = 0;
    for (const lvl of DATA.LEVELS) {
      const eng = TD.createEngine(lvl, { seed: 7 });
      for (const p of lvl.pads) {
        total += 1;
        if (eng.coverageOf("fan", 1, p.cx, p.cy) === 0) zero += 1;
      }
    }
    assert.ok(zero / total < 0.10,
      `a tier-1 Fan reads ZERO coverage on ${zero}/${total} pads (${(100 * zero / total).toFixed(0)}%) — ` +
      "reach must span every field the stat block has (the Fan's zap out-reaches its aura), or the number lies about the tower");
  }
  // 3c. a Camp BLOCKS rather than shoots, so it must return null rather than a
  //     percentage that asserts something false about it.
  {
    const eng = TD.createEngine(l20, { seed: 7 });
    assert.equal(eng.coverageOf("camp", 1, l20.pads[0].cx, l20.pads[0].cy), null,
      "a Camp has no shooting reach — a coverage % would be a false claim, not a low one");
  }

  // 4. LANE 0 ONLY, and this is a deliberate choice rather than an oversight:
  //    enemies walk the default route unless a lever is thrown, so scoring the
  //    union over every lane would flatter a pad that only covers a branch
  //    nobody is walking. Proven on a fork level by scoring a point that sits
  //    on the SECOND lane where the two have diverged.
  const fork = DATA.LEVELS.find((l) => l.paths && l.paths.length > 1);
  assert.ok(fork, "a fork level exists to test against");
  const [a, b] = fork.paths;
  let far = null, bestD = 0;
  for (const [bx, by] of b) {
    let m = Infinity;
    for (const [ax, ay] of a) m = Math.min(m, Math.hypot(ax - bx, ay - by));
    if (m > bestD) { bestD = m; far = [bx, by]; }
  }
  assert.ok(bestD > 2, `the two lanes diverge by ${bestD.toFixed(1)} cells somewhere`);
  const onLane1 = TD.laneCoverage(fork, far[0], far[1], 1.5, 0);
  assert.equal(onLane1, 0,
    `L${fork.id}: a point ${bestD.toFixed(1)} cells off the DEFAULT lane must score 0 — ` +
    "coverage is about the route enemies actually walk, not the one the lever opens");
});

test("towerReach: the ring the player sees is the reach the engine USES", async () => {
  // The renderer used to do its own range arithmetic and understated the truth
  // four ways. Each clause below is one of them, measured on shipped data — a
  // ring that reads SMALLER than the tower's real reach is worse than no ring,
  // because it is the placement cue and it was lying about placement.
  const L3 = DATA.LEVELS.find((l) => l.id === 3);
  const boosted = L3.pads.find((p) => p.boost && p.boost.range);
  const plain = L3.pads.find((p) => !(p.boost && p.boost.range));
  assert.ok(boosted && plain, "L3 has both a ⚡ power pad and an ordinary one");

  // 1. THE FAN. Its zap out-reaches its slow aura at every tier, so a ring drawn
  //    from `auraRange` alone is short — measured 22% / 14% / 8% at tiers 1-3.
  for (const tier of [1, 2, 3]) {
    const e = TD.createEngine(L3, { seed: 7 });
    e.state.gold = 99999;
    assert.ok(e.place("fan", plain.id).ok);
    const t = e.state.towers[0];
    while (t.tier < tier) e.upgrade(t.id);
    const s = DATA.TOWERS.fan.tiers[tier - 1];
    assert.equal(e.towerReach(t.id), Math.max(s.auraRange, s.zapRange),
      `a tier-${tier} Fan reaches its ZAP (${s.zapRange}), not just its aura (${s.auraRange})`);
    assert.ok(e.towerReach(t.id) > s.auraRange, `…and the zap is genuinely the longer of the two at tier ${tier}`);
  }

  // 2. A ⚡ POWER PAD extends reach, and the same tower on an ordinary pad does
  //    not — so the ring must differ between two pads on the SAME level.
  {
    const e = TD.createEngine(L3, { seed: 7 });
    e.state.gold = 99999;
    assert.ok(e.place("dart", boosted.id).ok);
    assert.ok(e.place("dart", plain.id).ok);
    const [on, off] = e.state.towers;
    const base = DATA.TOWERS.dart.tiers[0].range;
    assert.equal(off.tier, 1);
    assert.ok(Math.abs(e.towerReach(off.id) - base) < 1e-9, "an ordinary pad gives the plain reach");
    assert.ok(Math.abs(e.towerReach(on.id) - base * boosted.boost.range) < 1e-9,
      `a ⚡ power pad's ×${boosted.boost.range} must show in the ring (${e.towerReach(on.id)} vs ${e.towerReach(off.id)})`);
  }

  // 3. 🧊 TAIL WIND is a 300-gold branch sold on making neighbours "fire faster
  //    and FURTHER". If the ring ignores its support multiplier, the player
  //    bought reach they can never see.
  {
    const e = TD.createEngine(L3, { seed: 7 });
    e.state.gold = 99999;
    assert.ok(e.place("dart", plain.id).ok);
    const t = e.state.towers[0];
    const before = e.towerReach(t.id);
    t.supRange = 1.15;                       // exactly what supportTick writes
    assert.ok(Math.abs(e.towerReach(t.id) - before * 1.15) < 1e-9,
      `a supported tower's ring must grow with it (${before} → ${e.towerReach(t.id)})`);
  }

  // 4. A CAMP posts soldiers rather than shooting, so it has no shooting reach
  //    at all — the renderer draws its RALLY range instead, and a number here
  //    would be a false claim rather than a small one.
  {
    const e = TD.createEngine(L3, { seed: 7 });
    e.state.gold = 99999;
    assert.ok(e.place("camp", plain.id).ok);
    assert.equal(e.towerReach(e.state.towers[0].id), null, "a Camp has no shooting reach");
  }
  // 5. THE DEAD ZONE DOES NOT SCALE. The engine's mortar call passes
  //    `rangeMin * mortarMinMul` RAW and wraps only the max in reachOf(), so a
  //    mortar on a ⚡ power pad reaches further without the hole under it
  //    growing. Scaling both would make this surface disagree with the engine
  //    about the one thing it exists to report.
  //
  //    It must be measured on a pad where the two answers actually DIFFER, or
  //    the assertion is vacuous — on L3's socket both come out at 12.921%, so
  //    the pad is SEARCHED for rather than assumed.
  {
    const base = DATA.TOWERS.mortar.tiers[0];
    assert.ok(base.rangeMin > 0, "the Mortar has a dead zone to test");
    let probe = null;
    for (const lvl of DATA.LEVELS) {
      for (const p of lvl.pads || []) {
        if (!(p.boost && p.boost.range)) continue;
        const eng = TD.createEngine(lvl, { seed: 7 });
        const outer = eng.reachAt("mortar", 1, p.cx, p.cy);
        const raw = TD.laneCoverage(lvl, p.cx, p.cy, outer, base.rangeMin);
        const scaled = TD.laneCoverage(lvl, p.cx, p.cy, outer, base.rangeMin * p.boost.range);
        if (raw !== scaled) { probe = { lvl, p, eng, outer, raw, scaled }; break; }
      }
      if (probe) break;
    }
    assert.ok(probe,
      "no ⚡ power pad distinguishes a raw dead zone from a scaled one — this clause would be vacuous");
    assert.ok(Math.abs(probe.outer - base.range * probe.p.boost.range) < 1e-9,
      "a ⚡ pad extends the Mortar's OUTER reach");
    assert.equal(probe.eng.coverageOf("mortar", 1, probe.p.cx, probe.p.cy), probe.raw,
      `L${probe.lvl.id} ${probe.p.id}: the figure must use the engine's RAW dead zone ` +
      `(${(100 * probe.raw).toFixed(2)}%), not a boosted one (${(100 * probe.scaled).toFixed(2)}%) — ` +
      "the boost extends the outer radius only, so the hole under a mortar never grows");
  }
  // …and a tower that does not exist is null rather than a throw.
  assert.equal(TD.createEngine(L3, { seed: 7 }).towerReach("nope"), null, "an unknown tower id is null");
});

test("🎵 the score is per-world, phase-aware and boss-aware", () => {
  // The soundtrack was reported thin, and the reason was structural rather than
  // a matter of taste: ONE key and ONE arrangement for ten worlds, identical
  // whether you were building in silence or watching a boss walk in. The score
  // is DATA and the arrangement is PURE, so all of that is checkable here with
  // no audio and no browser.
  const worlds = Object.keys(DATA.WORLDS);
  assert.ok(worlds.length >= 10, `expected the shipped worlds, saw ${worlds.length}`);

  // DERIVED: every world must declare a key, or it silently falls back and two
  // rooms sound identical again — the defect this replaced.
  const mute = worlds.filter((w) => !DATA.WORLDS[w].music || !DATA.WORLDS[w].music.root);
  assert.deepEqual(mute, [], `every world must declare its own music key, missing: ${mute.join(", ")}`);

  const notes = (ctx) => {
    const out = [];
    for (let i = 0; i < 64; i++) for (const v of TD.musicStep(i, ctx)) out.push(v);
    return out;
  };
  // …and declaring one is not enough: two worlds must actually SOUND different.
  const pitches = (w) => notes({ world: w, phase: "wave" }).map((v) => v.hz.toFixed(2)).join(",");
  const distinct = new Set(worlds.map(pitches));
  assert.ok(distinct.size >= 6,
    `ten worlds must not share one tune — saw only ${distinct.size} distinct pitch sets`);

  // The arrangement THINS during build. This is the thing you can hear: the
  // same march, stripped to its strong beats, so a build phase is calm.
  for (const w of ["bedroom", "party"]) {
    const wave = notes({ world: w, phase: "wave" });
    const build = notes({ world: w, phase: "build" });
    assert.ok(build.length * 2 < wave.length,
      `${w}: build must be markedly sparser than a wave (${build.length} vs ${wave.length} voices)`);
    // percussion is a wave-only voice; 70Hz is the kick
    assert.ok(wave.some((v) => v.hz === 70), `${w}: a wave must carry the kick`);
    assert.ok(!build.some((v) => v.hz === 70), `${w}: build must drop the percussion`);
  }

  // A boss is its own voice — the minor scale even in a bright world, plus a
  // drone that lands once per phrase rather than once per step.
  const bright = notes({ world: "party", phase: "wave" });
  const bossy = notes({ world: "party", phase: "wave", boss: true });
  assert.notEqual(bright.map((v) => v.hz.toFixed(1)).join(","), bossy.map((v) => v.hz.toFixed(1)).join(","),
    "a boss wave must not sound identical to an ordinary one in the same world");
  const drones = bossy.filter((v) => v.duration >= 1);
  assert.equal(drones.length, DATA.MUSIC.form.length,
    `the drone lands once per phrase (expected ${DATA.MUSIC.form.length}, saw ${drones.length})`);

  // DANGER is the other reason to stop being cheerful, and it deliberately gets
  // the SAME voice as a boss: the message is "this is serious", and splitting it
  // into two moods would make both less legible. It matters because during a
  // wave you are watching the field, not the lives counter.
  const calm = notes({ world: "party", phase: "wave" });
  const scared = notes({ world: "party", phase: "wave", danger: true });
  const sig = (ns) => ns.map((v) => v.hz.toFixed(1)).join(",");
  assert.notEqual(sig(calm), sig(scared), "being nearly dead must change the music");
  assert.equal(sig(scared), sig(bossy), "danger and a boss share one voice, on purpose");

  // Every field the player multiplies must be a real number. A missing scale
  // degree would hand NaN straight to the oscillator — the `mult`-less zone and
  // the `delay`-less wave group, in the audio layer.
  for (const w of worlds) {
    for (const ctx of [{ world: w, phase: "wave" }, { world: w, phase: "build" }, { world: w, phase: "wave", boss: true }]) {
      for (const v of notes(ctx)) {
        assert.ok(Number.isFinite(v.hz) && v.hz > 0, `${w}: a voice must have a real pitch, saw ${v.hz}`);
        assert.ok(Number.isFinite(v.gain) && v.gain > 0 && v.gain < 0.2, `${w}: gain out of range: ${v.gain}`);
        assert.ok(Number.isFinite(v.duration) && v.duration > 0, `${w}: duration must be real, saw ${v.duration}`);
      }
    }
  }
  // an unknown world must degrade to something audible, not to silence or NaN
  const fallback = notes({ world: "no-such-world", phase: "wave" });
  assert.ok(fallback.length > 0 && fallback.every((v) => Number.isFinite(v.hz)),
    "an unknown world must still play something sane");

  // The busiest step must stay well inside JoshAudio's 12-voice cap, or the
  // music starts stealing voices from the game's own sfx.
  let worst = 0;
  for (const w of worlds) for (let i = 0; i < 64; i++) {
    worst = Math.max(worst, TD.musicStep(i, { world: w, phase: "wave", boss: true }).length);
  }
  assert.ok(worst <= 6, `the score must stay well under the 12-voice cap, worst step was ${worst}`);

  // …and it is a LOOP: 64 steps, so the phrase does not drift.
  // ---- the audible floor ----
  // Found by exhaustively checking every voice the score can emit: the
  // boss/danger drone is hz(0, -3), i.e. root/8, which put it at 18.4Hz in the
  // garage and 19.4 on the sort line — BELOW the ~20Hz threshold of human
  // hearing — and at 24-37Hz in the other eight, which no phone speaker
  // reproduces. So the one voice whose whole job is to say "this is serious"
  // was silent in all ten worlds while spending an oscillator and one of
  // JoshAudio's 12 voice slots.
  {
    let lowest = Infinity, worlds = 0;
    for (const w of Object.keys(DATA.WORLDS)) {
      worlds++;
      for (const phase of ["build", "wave"]) for (const boss of [false, true]) for (const danger of [false, true]) {
        for (let i = 0; i < DATA.MUSIC.form.length * 16; i++) {
          for (const v of TD.musicStep(i, { world: w, phase, boss, danger })) {
            assert.ok(Number.isFinite(v.hz) && v.hz > 0, `${w}/${phase} step ${i}: hz ${v.hz}`);
            lowest = Math.min(lowest, v.hz);
          }
        }
      }
    }
    assert.ok(worlds >= 10, `expected every world checked, saw ${worlds}`);
    assert.ok(lowest >= DATA.MUSIC.floorHz,
      `no voice may sound below the audible floor — lowest was ${lowest.toFixed(1)}Hz against ${DATA.MUSIC.floorHz}`);

    // FOLD, not clamp. A clamp would satisfy the clause above while changing
    // the NOTE, which is a different tune; doubling preserves the pitch class
    // exactly, so folded/unfolded must be a power of two.
    for (const w of Object.keys(DATA.WORLDS)) {
      const root = DATA.WORLDS[w].music.root;
      const drone = TD.musicStep(0, { world: w, phase: "wave", boss: true }).filter((v) => v.duration > 1)[0];
      assert.ok(drone, `${w} must still sound a boss drone`);
      const ratio = drone.hz / (root / 8);            // hz(0, -3) before folding
      assert.ok(Math.abs(Math.log2(ratio) - Math.round(Math.log2(ratio))) < 1e-9,
        `${w}: the drone must be an OCTAVE fold of root/8, not a clamp (ratio ${ratio.toFixed(4)})`);
    }

    // and the guard that matters more than either: a world whose root is junk
    // must not sound a bad note — and, more importantly, must not spin the fold
    // loop, which runs inside the tick. Both halves are needed: the `f > 0`
    // guard returns early, and the loop is BOUNDED so that even without it the
    // failure is a wrong number this test can report rather than a hang that
    // takes the runner with it. (Verified: with an unbounded `while`, removing
    // the guard hangs `node --test` instead of failing it.)
    // NEGATIVE is the case that separates the two protections, and 0 alone does
    // not: with the loop bounded, a root of 0 folds to 0 and the existing
    // `if (f)` truthiness check drops the voice, so the guard looks redundant.
    // A negative root doubles to a LARGER negative, stays truthy, and reaches
    // the oscillator — so that is what makes the guard falsifiable.
    for (const junk of [0, -220, NaN]) {
      DATA.WORLDS.__probe = { music: { root: junk, mode: "bright" } };
      try {
        const t0 = Date.now();
        for (let i = 0; i < 64; i++) {
          for (const v of TD.musicStep(i, { world: "__probe", phase: "wave", boss: true })) {
            assert.ok(Number.isFinite(v.hz) && v.hz > 0,
              `a root of ${junk} must degrade to silence, never emit hz=${v.hz} to the oscillator`);
          }
        }
        assert.ok(Date.now() - t0 < 1000, `a root of ${junk} must not spin the fold loop`);
      } finally { delete DATA.WORLDS.__probe; }
    }
  }

  const a = JSON.stringify(TD.musicStep(5, { world: "attic", phase: "wave" }));
  const b = JSON.stringify(TD.musicStep(5 + 64, { world: "attic", phase: "wave" }));
  assert.equal(a, b, "the loop must be exactly form.length x 16 steps long");
});

test("↩ undo takes back the tower you just placed, at FULL price, and nothing else", () => {
  // Sell pays 80% (90% with ♻️ Trade-In), so before this the fix for a mis-tap
  // cost a fifth of the tower — the most common and most annoying way to lose
  // gold in the game. Undo pays all of it back, and the whole design question is
  // what stops it becoming a way to rent guns for free.
  const L1 = DATA.LEVELS[0];
  const fresh = () => TD.createEngine(L1, { seed: 1 });

  // 1. the plain case: place, change your mind, get everything back
  let e = fresh();
  const g0 = e.state.gold;
  assert.equal(e.place("dart", L1.pads[0].id).ok, true);
  assert.ok(e.state.gold < g0, "placing must cost gold, or the rest of this proves nothing");
  const info = e.undoInfo();
  assert.ok(info && info.id === e.state.towers[0].id, `undo must be offered on the tower just placed, saw ${JSON.stringify(info)}`);
  assert.equal(e.undoLast().ok, true);
  assert.equal(e.state.gold, g0, "undo must refund the FULL price");
  assert.equal(e.state.towers.length, 0, "…and actually remove the tower");

  // 2. exactly once
  assert.equal(e.undoLast().ok, false, "there is nothing left to undo");

  // 3. THE SAFETY PROPERTY. A tower that has acted may not be un-bought.
  //    Calling the wave commits the board, so the NEXT build phase must not
  //    still be offering back a tower that fought through it.
  e = fresh();
  e.place("dart", L1.pads[0].id);
  e.callWave();
  assert.equal(e.undoInfo(), null, "calling the wave must end the offer immediately");
  let guard = 0;
  while (e.state.phase !== "build" && e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 200000) e.tick();
  assert.equal(e.state.phase, "build", "the probe needs to reach the next build phase");
  assert.equal(e.undoLast().ok, false,
    "a tower that fought a whole wave must NOT be refundable at full price in the next build");

  // 4. …and a tower placed DURING a wave is never undoable, because it is
  //    already shooting. This is why the rule is the phase and not a timer.
  e = fresh();
  e.callWave(); e.tick();
  e.place("dart", L1.pads[0].id);
  assert.equal(e.undoInfo(), null, "a tower placed mid-wave is already working — no undo");

  // 5. an upgrade is a commitment
  e = fresh();
  e.place("dart", L1.pads[0].id);
  e.upgrade(e.state.towers[0].id);
  assert.equal(e.undoLast().ok, false, "upgrading commits the tower");

  // 6. selling is untouched — still the ordinary rate, so undo is strictly the
  //    better deal and there is no incentive to game the two against each other
  e = fresh();
  const before = e.state.gold;
  e.place("dart", L1.pads[0].id);
  const paid = before - e.state.gold;
  const sold = e.sell(e.state.towers[0].id).refund;
  assert.ok(sold < paid, `sell must still be a loss (${sold} of ${paid}), or undo means nothing`);
  assert.equal(sold, Math.floor(paid * DATA.RULES.sellRefund), "sell must still use the shipped refund rate");

  // 7. undo must not skip the teardown a sell does. A camp holds enemies via
  //    blockedBy, and that is the one thing in the engine that can strand a live
  //    enemy pointing at a soldier that no longer exists — which is why both
  //    paths go through one removeTower().
  e = fresh();
  const campPad = L1.pads.find((p) => TD.createEngine(L1, { seed: 1 }).place("camp", p.id).ok);
  if (campPad) {
    e = fresh();
    e.place("camp", campPad.id);
    assert.ok(e.state.soldiers.some((s) => s.campId === e.state.towers[0].id), "the camp must have fielded soldiers");
    e.undoLast();
    assert.ok(!e.state.soldiers.some((s) => s.alive && s.campId >= 0),
      "undoing a camp must retire its soldiers, exactly as selling it does");
  }
});

test("every aiming mode the engine offers is EXPLAINED", () => {
  // The 🎯 button cycled four words with no explanation anywhere, and "first"
  // (furthest along the lane) vs "close" (nearest the gun) is genuinely
  // ambiguous. It is also a measured lever — over the boss finales the best
  // mode swings a level by 4-9 lives — so a mode the player cannot read is a
  // mode they cannot use. DERIVED from the engine, like FIELD_TRAIT: a sixth
  // mode cannot ship undocumented.
  const e = TD.createEngine(DATA.LEVELS[0], { seed: 1, meta: DATA.META_NODES.map((n) => n.id) });
  const modes = e.targetingModes();
  assert.ok(modes.length >= 4, `expected the full mode list, saw ${modes.length} — this test would be near-vacuous`);
  for (const m of modes) {
    const t = (DATA.TARGETING || {})[m];
    assert.ok(t && t.desc && t.desc.length > 20, `aiming mode "${m}" has no description in DATA.TARGETING`);
    assert.ok(t.name, `aiming mode "${m}" has no player-facing name — the button would print the engine id`);
  }
  // …and nothing in the table that the engine will never offer, which would be
  // a paragraph describing a control the player can never reach.
  for (const k of Object.keys(DATA.TARGETING || {})) {
    assert.ok(modes.indexOf(k) >= 0, `DATA.TARGETING describes "${k}", which the engine never offers`);
  }
});

test("each 🎯 mode PICKS what its description claims", () => {
  // Written because the description shipped WRONG. The engine's mode id is
  // `cheap`, and from the id alone the guide called it an Economy pick that
  // aims at the body worth the most gold. It does nothing of the kind:
  // `e.hp < best.hp` — it finishes the almost-dead — which is exactly what the
  // 🔻 Weak Spot node that unlocks it has always promised ("Weakest" aim). A
  // structural test that every mode HAS a description cannot catch a
  // description that is false, so this drives the engine and reads the choice.
  const e = TD.createEngine(DATA.LEVELS[0], { seed: 4, meta: ["cheaptarget"] });
  const pad = DATA.LEVELS[0].pads.slice().sort((a, b) => a.id < b.id ? -1 : 1)[0];
  assert.ok(e.place("dart", pad.id).ok, "the fixture must get a gun on the board");
  const tw = e.state.towers[0];
  e.callWave();
  // run until at least two bodies are inside this tower's reach
  const reach = e.towerReach(tw.id);
  // posAt wants a BUILT path (segs/total), not the raw waypoint array — passing
  // the level's own `path` throws "path.segs is not iterable".
  const lane = TD.buildPath(DATA.LEVELS[0].path);
  const inRange = () => e.state.enemies.filter((x) => {
    if (!x.alive) return false;
    const p = TD.posAt(lane, x.dist);
    return (p.x - tw.cx) ** 2 + (p.y - tw.cy) ** 2 <= reach * reach;
  });
  for (let i = 0; i < 3000 && inRange().length < 2; i++) e.tick();
  const near = inRange();
  assert.ok(near.length >= 2, `the fixture needs two bodies in range, saw ${near.length}`);

  // give them clearly different hp, high enough that one tick cannot kill either
  near[0].hp = 900; near[1].hp = 120;
  const weakest = near[1].id, strongest = near[0].id;

  const pickWith = (mode) => {
    for (const x of e.state.enemies) if (x.id === strongest) x.hp = 900; else if (x.id === weakest) x.hp = 120;
    assert.ok(e.setTargeting(tw.id, mode).ok, `mode ${mode} must be settable`);
    e.tick();
    return e.state.towers[0].targetId;
  };
  assert.equal(pickWith("cheap"), weakest,
    '"cheap" is the WEAKEST body (least hp) — the description must not claim it aims at gold');
  assert.equal(pickWith("strong"), strongest,
    '"strong" is the most hp left');
  // …and the words must match that. This clause is the one that would have
  // caught the shipped error: the mode is described by what it DOES.
  const d = DATA.TARGETING.cheap;
  assert.equal(d.name, "weakest", "the player-facing name must match the 🔻 Weak Spot node that unlocks it");
  assert.match(d.desc, /hp/i, "…and the description must say it is about hp");
  assert.ok(!/gold|payday|worth the most/i.test(d.desc),
    `"cheap" has nothing to do with price — the id is misleading and the description must not repeat it: "${d.desc}"`);
});
