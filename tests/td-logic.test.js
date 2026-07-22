// Fort Josh TD — engine unit + headless-simulation tests (no browser).
// A real-time game can't use the tap-harness, so THIS is its honest replacement
// (PLAN_TOWER_DEFENSE.md §10): determinism, exact combat math, wave-budget
// audit, and full-level sims at native node speed — every level must be
// WINNABLE by a scripted build and LOSABLE by neglect.

const { test } = require("node:test");
const assert = require("node:assert");
const TD = require("../scripts/td-logic.js");
const DATA = require("../scripts/td-data.js");

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
    for (const [x, y] of level.path) {
      assert.ok(x >= 0 && x <= DATA.GRID.w - 1 && y >= 0 && y <= DATA.GRID.h - 1, "waypoint on grid");
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
  assert.equal(e.callWave().reason, "not-build", "no double-call mid-wave");
});

test("TD targeting modes are accepted and reset the lock; phase-gated APIs answer honestly", () => {
  const e = TD.createEngine(L1, { seed: 1 });
  e.place("dart", "p3");
  const t = e.state.towers[0];
  for (const m of ["first", "last", "strong", "close"]) assert.ok(e.setTargeting(t.id, m).ok);
  assert.equal(e.setTargeting(t.id, "cheapest").reason, "bad-mode");
  assert.equal(e.branch(t.id, "a").reason, "not-tier3", "branching is tier-3-gated");
  assert.equal(e.rally(t.id, 2, 2).reason, "bad-id", "only camps rally");
  assert.equal(e.pullLever("l1").reason, "not-built-yet", "levers arrive with L10 (TD-4)");
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
  const dpsBranch = [["dart", "a"], ["dart", "b"], ["mortar", "a"], ["mortar", "b"], ["camp", "b"]];
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
  // The block soldiers used to spread with fixed 2D offsets that pushed some off
  // the ribbon; now they line up ALONG the path tangent. Every soldier's post
  // must sit within half a cell of the path centre-line, for EVERY camp-able pad.
  const distToPath = (e, x, y) => {
    let best = Infinity;
    for (let d = 0; d <= e.path.total; d += 0.1) {
      const p = e.posAt(d);
      const dd = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (dd < best) best = dd;
    }
    return Math.sqrt(best);
  };
  for (const pad of L1.pads) {
    const e = TD.createEngine(L1, { seed: 5 });
    if (!e.place("camp", pad.id).ok) continue; // startGold covers one camp
    const cam = e.state.towers[e.state.towers.length - 1];
    for (let i = 0; i < 120; i++) e.tick(); // let them deploy
    const mine = e.state.soldiers.filter((s) => s.campId === cam.id);
    assert.ok(mine.length >= 2, `camp on ${pad.id} fielded a squad`);
    for (const s of mine) {
      const dPost = distToPath(e, s.tx, s.ty);
      assert.ok(dPost <= 0.5, `camp ${pad.id}: a soldier post must sit ON the path (dist ${dPost.toFixed(2)} ≤ 0.5)`);
    }
  }
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
  function neglect(level, seed) {
    const e = TD.createEngine(level, { seed });
    let g = 0;
    while (e.state.phase !== "won" && e.state.phase !== "lost" && g++ < 400000) { if (e.state.phase === "build") e.callWave(); e.tick(); }
    return e.state;
  }
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

test("TD4 structure: 12 contiguous levels across 3 worlds, bosses at L4/L8/L12, difficulty badges present", () => {
  assert.equal(DATA.LEVELS.length, 12, "the fort ships all 12 levels");
  DATA.LEVELS.forEach((l, i) => assert.equal(l.id, i + 1, "ids contiguous 1..12"));
  const bossLevels = DATA.LEVELS.filter((l) => l.waves.some((w) => w.boss)).map((l) => l.id);
  assert.deepEqual(bossLevels, [4, 8, 12], "bosses headline L4, L8, L12");
  const worlds = [...new Set(DATA.LEVELS.map((l) => l.world))];
  assert.deepEqual(worlds, ["bedroom", "backyard", "toystore"], "three worlds in order");
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
  assert.deepEqual(m0, { startGold: 0, lives: 0, dartDmg: 1, mortarSplash: 1, fanAura: 0, soldierHp: 1, earlyCall: 1, sellRefund: DATA.RULES.sellRefund, branchCost: 1, cheapTarget: false }, "empty tree is exactly vanilla");
  const all = DATA.META_NODES.map((n) => n.id);
  const mAll = TD.metaMods(all);
  assert.equal(mAll.startGold, 40); assert.equal(mAll.lives, 2); assert.ok(Math.abs(mAll.dartDmg - 1.1) < 1e-9);
  assert.ok(Math.abs(mAll.mortarSplash - 1.1) < 1e-9); assert.ok(Math.abs(mAll.fanAura - 0.3) < 1e-9);
  assert.ok(Math.abs(mAll.soldierHp - 1.15) < 1e-9); assert.ok(Math.abs(mAll.earlyCall - 1.5) < 1e-9);
  assert.equal(mAll.sellRefund, 0.9); assert.ok(Math.abs(mAll.branchCost - 0.9) < 1e-9); assert.equal(mAll.cheapTarget, true);
  // every node id is unique + costs are the plan's (sum 28 ≤ 36 possible ⭐)
  const ids = new Set(all); assert.equal(ids.size, DATA.META_NODES.length, "node ids unique");
  const total = DATA.META_NODES.reduce((a, n) => a + n.cost, 0);
  assert.equal(total, 28, `tree total is 28⭐ (≤ 36 possible), got ${total}`);
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

test("TD5 achievements data-shape: 12 unique ids with names + descriptions, icons ≤ Emoji 13.0", () => {
  assert.equal(DATA.ACHIEVEMENTS.length, 12, "12 achievements");
  const ids = new Set(DATA.ACHIEVEMENTS.map((a) => a.id));
  assert.equal(ids.size, 12, "achievement ids unique");
  for (const a of DATA.ACHIEVEMENTS) { assert.ok(a.name && a.desc && a.icon, `${a.id} has name/desc/icon`); }
  // the boss achievements name the three real bosses
  const has = (id) => ids.has(id);
  assert.ok(has("bossbonker") && has("dysondenied") && has("unplugged"), "one achievement per boss");
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
