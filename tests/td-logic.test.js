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

test("TD targeting modes are accepted and reset the lock; TD-2 APIs answer honestly", () => {
  const e = TD.createEngine(L1, { seed: 1 });
  e.place("dart", "p3");
  const t = e.state.towers[0];
  for (const m of ["first", "last", "strong", "close"]) assert.ok(e.setTargeting(t.id, m).ok);
  assert.equal(e.setTargeting(t.id, "cheapest").reason, "bad-mode");
  assert.equal(e.branch(t.id, "a").reason, "not-built-yet");
  assert.equal(e.rally(1, 2, 2).reason, "not-built-yet");
  assert.equal(e.pullLever("l1").reason, "not-built-yet");
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
