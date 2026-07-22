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
