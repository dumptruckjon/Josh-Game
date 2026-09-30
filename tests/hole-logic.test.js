// 🕳️ Gobble Hole — engine tests (node, no browser). The engine is pure and
// deterministic (a 60Hz fixed step, a seeded RNG, zero DOM), so whole scenes
// are laid out and PLAYED here headless, exactly as the browser plays them.
// PLAN_GOBBLE.md §8 lists what these pin.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const DATA = require("../scripts/hole-data.js");
const L = require("../scripts/hole-logic.js");

const { RULES, SCENES } = DATA;
// The whole range a screen can pick (a tall phone … a wide landscape iPad),
// DERIVED from the rule rather than listed, plus points in between.
const ASPECTS = (() => {
  const [a0, a1] = RULES.ASPECT, out = [];
  for (let i = 0; i <= 5; i++) out.push(Math.round((a0 + ((a1 - a0) * i) / 5) * 100) / 100);
  return out;
})();
const topMin = (r) => Math.max(r * RULES.SQ + RULES.EDGE, RULES.SPRITE_H * r - RULES.TOP_SLACK);
const tiersOf = (def) => def.tiers.length + 1;   // + the finale

// Play a run with the greedy bot (the same one the browser hook uses).
function playOut(st, maxSeconds) {
  const log = [];
  while (!st.done && st.t < maxSeconds) {
    if (!st.won) { const tg = L.botTarget(st); if (tg) L.setTarget(st, tg.x, tg.y); }
    L.step(st, L.DT);
    for (const ev of st.events) log.push({ t: st.t, ...ev });
    st.events.length = 0;
  }
  return log;
}

test("the data: six scenes, five tiers each plus a finale, every door and picture present", () => {
  assert.ok(SCENES.length >= 6, "six places to eat");
  const ids = new Set();
  for (const def of SCENES) {
    assert.ok(!ids.has(def.id), "scene ids are unique: " + def.id);
    ids.add(def.id);
    assert.equal(def.tiers.length, 5, def.id + " has five size tiers");
    assert.ok(def.finale && def.finale.e && def.finale.r > 0, def.id + " has a finale");
    assert.ok(def.door && def.name && /^#[0-9a-f]{6}$/i.test(def.color), def.id + " has a door, a name and a colour");
    assert.ok(Array.isArray(def.backdrop) && def.backdrop.length === 2, def.id + " has a two-stop backdrop");
    // tiers strictly increase in size and never overlap
    for (let i = 1; i < def.tiers.length; i++) {
      assert.ok(def.tiers[i].r[0] > def.tiers[i - 1].r[1], def.id + ": tier " + (i + 1) + " is bigger than tier " + i);
    }
    assert.ok(def.finale.r > def.tiers[def.tiers.length - 1].r[1], def.id + ": the finale is the biggest thing");
  }
});

test("each picture belongs to ONE tier in its scene (so a grow's 'now you can eat us!' is true)", () => {
  // The growth meter ends in a PICTURE of the next thing Gobble can eat, and a
  // grow makes the newly edible tier hop. Both lie if one emoji sits in two
  // tiers — a small 🚗 you may eat beside a big 🚗 you may not.
  for (const def of SCENES) {
    const tierOf = new Map();
    def.tiers.forEach((t, i) => {
      for (const it of t.items) {
        const prev = tierOf.get(it[0]);
        assert.ok(prev === undefined || prev === i, def.id + ": " + it[0] + " is in tier " + (prev + 1) + " AND tier " + (i + 1));
        tierOf.set(it[0], i);
      }
    });
    assert.ok(!tierOf.has(def.finale.e), def.id + ": the finale is not also an ordinary thing");
  }
});

test("NOTHING ALIVE gets eaten: no animals, no people (checked by Unicode range, not by a list)", () => {
  // PLAN_GOBBLE.md §1. A list of banned emoji only catches what someone
  // thought of; the Unicode blocks for animals and people catch the next one.
  const ALIVE = [
    [0x1F400, 0x1F43F, "animals"], [0x1F980, 0x1F9AE, "animals"], [0x1F54A, 0x1F54A, "a dove"],
    [0x1F577, 0x1F578, "a spider"], [0x1F466, 0x1F487, "people"], [0x1F574, 0x1F575, "people"],
    [0x1F645, 0x1F64F, "people"], [0x1F6B4, 0x1F6B6, "people"], [0x1F6C0, 0x1F6C0, "a person"],
    [0x1F3C2, 0x1F3CC, "people"], [0x1F926, 0x1F93E, "people"], [0x1F9CD, 0x1F9DF, "people"],
    [0x1F9B8, 0x1F9B9, "people"], [0x1F385, 0x1F385, "a person"], [0x1F46A, 0x1F46F, "people"],
  ];
  const bad = [];
  for (const def of SCENES) {
    const pics = [def.door, def.finale.e];
    for (const t of def.tiers) for (const it of t.items) pics.push(it[0]);
    for (const e of pics) {
      for (const ch of Array.from(e)) {
        const cp = ch.codePointAt(0);
        const hit = ALIVE.find(([a, b]) => cp >= a && cp <= b);
        if (hit) bad.push(def.id + ": " + e + " (" + hit[2] + ")");
      }
    }
  }
  assert.deepEqual(bad, [], "Gobble must never eat anything alive:\n" + bad.join("\n"));
  // …and the check is not vacuous: it really does catch an animal.
  assert.ok(ALIVE.some(([a, b]) => 0x1F436 >= a && 0x1F436 <= b), "the scan must know a dog 🐶 is alive");
});

test("layout: every scene fits its island at EVERY aspect — no overlaps, a clear start, nothing relaxed", () => {
  for (const def of SCENES) {
    for (const a of ASPECTS) {
      const lay = L.layout(def, a);
      const where = def.id + "@" + a;
      assert.equal(lay.relaxed, 0, where + ": every thing found a spot without squeezing");
      assert.equal(lay.zoneMiss, 0, where + ": every zoned thing landed in its zone");
      const want = def.tiers.reduce((n, t) => n + t.items.reduce((m, it) => m + it[1], 0), 0) + 1;
      assert.equal(lay.objects.length, want, where + ": every thing is placed");
      for (const o of lay.objects) {
        assert.ok(o.x >= o.r + RULES.EDGE - 1e-3 && o.x <= lay.W - o.r - RULES.EDGE + 1e-3, where + ": " + o.e + " inside the island (x)");
        assert.ok(o.y >= topMin(o.r) - 1e-3 && o.y <= lay.H - o.r * RULES.SQ - RULES.EDGE + 1e-3, where + ": " + o.e + " inside the island (y)");
        if (!o.starter) {
          assert.ok(L.gdist(o.x, o.y, lay.start.x, lay.start.y) >= RULES.START_CLEAR + o.r - 1e-3,
            where + ": " + o.e + " keeps clear of Gobble's start");
        }
      }
      for (let i = 0; i < lay.objects.length; i++) {
        for (let j = i + 1; j < lay.objects.length; j++) {
          const p = lay.objects[i], q = lay.objects[j];
          assert.ok(L.gdist(p.x, p.y, q.x, q.y) >= RULES.SEP * (p.r + q.r) - 1e-3,
            where + ": " + p.e + " and " + q.e + " overlap");
        }
      }
      // zoned things stand in their zone
      for (const t of def.tiers) {
        for (const it of t.items) {
          if (!it[2]) continue;
          const rects = def.zones[it[2]].map((b) => [b[0] * lay.W, b[1] * lay.H, b[2] * lay.W, b[3] * lay.H]);
          for (const o of lay.objects.filter((ob) => ob.e === it[0] && !ob.starter)) {
            assert.ok(rects.some((b) => o.x >= b[0] && o.x <= b[2] && o.y >= b[1] && o.y <= b[3]),
              where + ": " + o.e + " stands in its " + it[2]);
          }
        }
      }
    }
  }
});

test("layout: the finale is the landmark at the top, and the first bites sit right beside Gobble", () => {
  for (const def of SCENES) {
    for (const a of ASPECTS) {
      const st = L.createGame(def, { aspect: a });
      const fin = st.objects.find((o) => o.finale);
      assert.ok(Math.abs(fin.x - st.W / 2) < 0.01, def.id + "@" + a + ": the finale stands at the top centre (positions are rounded to 0.001)");
      assert.ok(fin.y < st.H * 0.5, def.id + "@" + a + ": …in the back half");
      const starters = st.objects.filter((o) => o.starter);
      assert.equal(starters.length, def.starters, def.id + ": " + def.starters + " starters");
      for (const s of starters) {
        assert.equal(s.tier, 1, def.id + ": a starter is a tier-1 bite");
        // within a short glide: the first gulp comes within seconds
        assert.ok(L.gdist(s.x, s.y, st.start.x, st.start.y) < 14, def.id + ": a starter sits right beside Gobble");
      }
    }
  }
});

test("layout is deterministic, and a thing is the SAME SIZE on every screen", () => {
  for (const def of SCENES) {
    assert.deepEqual(L.layout(def, 0.78), L.layout(def, 0.78), def.id + ": the same layout every time");
    const a = L.layout(def, 0.6).objects.map((o) => o.e + o.r).sort();
    const b = L.layout(def, 1.7).objects.map((o) => o.e + o.r).sort();
    assert.deepEqual(a, b, def.id + ": sizes do not depend on the screen (only places do)");
  }
  // the aspect is clamped and quantized, so a saved run rebuilds the same layout
  assert.equal(L.sizeFor(99).aspect, RULES.ASPECT[1]);
  assert.equal(L.sizeFor(-5).aspect, RULES.ASPECT[0]);
  assert.equal(L.sizeFor(NaN).aspect, 0.75);
  assert.equal(L.sizeFor(0.7812).aspect, 0.78);
  for (const a of ASPECTS) {
    const s = L.sizeFor(a);
    assert.ok(Math.abs(s.W * s.H - RULES.AREA) < 1e-6, "the island keeps its AREA at aspect " + a);
  }
});

test("THE TIER LAW: each tier is edible at exactly its level — too big one level earlier", () => {
  // Level L eats every tier <= L+1. R[L] is DERIVED (biggest of tier L+1 /
  // FIT * HEAD); the law is that tier L+2 does NOT fit yet, so every tier has
  // its "too big — grow first!" moment and growing always unlocks something.
  for (const def of SCENES) {
    const st = L.createGame(def, { aspect: 0.78 });
    const { R } = st.levels;
    assert.equal(R.length, tiersOf(def), def.id + ": one level per tier (the last eats the finale)");
    for (let lv = 0; lv < R.length; lv++) {
      const inTier = (t) => st.objects.filter((o) => o.tier === t).map((o) => o.r);
      const edible = Math.max(...inTier(lv + 1));
      assert.ok(edible <= R[lv] * RULES.FIT + 1e-9, def.id + ": at level " + lv + " all of tier " + (lv + 1) + " fits");
      if (lv + 2 <= tiersOf(def)) {
        const next = Math.min(...inTier(lv + 2));
        assert.ok(next > R[lv] * RULES.FIT, def.id + ": at level " + lv + " tier " + (lv + 2) + " is still too big");
      }
      if (lv > 0) assert.ok(R[lv] > R[lv - 1], def.id + ": Gobble really grows at level " + lv);
    }
  }
});

test("grow thresholds are reachable, increasing, and never need the last crumb", () => {
  for (const def of SCENES) {
    const st = L.createGame(def, { aspect: 0.78 });
    const { C } = st.levels;
    assert.equal(C[0], 0);
    for (let lv = 1; lv < C.length; lv++) {
      assert.ok(C[lv] > C[lv - 1], def.id + ": thresholds increase");
      const reachable = st.objects.filter((o) => o.tier <= lv).reduce((s, o) => s + o.xp, 0);
      // at most ~2/3 of everything edible so far: a missed sweet behind a
      // tall thing never blocks a grow
      assert.ok(C[lv] <= 0.65 * reachable, def.id + ": level " + lv + " needs " + C[lv] + " of " + reachable + " reachable");
    }
  }
});

test("physics: a thing that fits falls in and is eaten; the hole's xp grows", () => {
  const st = L.createGame("toyroom", { aspect: 0.78 });
  const o = st.objects.find((ob) => ob.starter);
  const xp0 = st.hole.xp;
  L.setTarget(st, o.x, o.y);
  const seen = new Set();
  for (let i = 0; i < 180 && o.st !== L.GONE; i++) {
    L.step(st);
    for (const ev of st.events) if (ev.id === o.id) seen.add(ev.type);
    st.events.length = 0;
  }
  assert.equal(o.st, L.GONE, "the starter was eaten");
  assert.ok(seen.has("fall") && seen.has("eat"), "it FELL, then was eaten (" + [...seen] + ")");
  assert.equal(st.hole.xp, xp0 + o.xp, "its xp went to Gobble");
});

test("physics: a thing that is TOO BIG wobbles and says so — it never falls in", () => {
  const st = L.createGame("toyroom", { aspect: 0.78 });
  const big = st.objects.find((ob) => ob.tier === 3);
  // park Gobble right on top of it
  st.hole.x = st.hole.tx = big.x; st.hole.y = st.hole.ty = big.y;
  let bumps = 0;
  for (let i = 0; i < 240; i++) {
    L.step(st);
    bumps += st.events.filter((e) => e.type === "bump" && e.id === big.id).length;
    st.events.length = 0;
    st.hole.tx = big.x; st.hole.ty = big.y;
  }
  assert.equal(big.st, L.IDLE, "a tier-3 thing never falls into a level-0 Gobble");
  assert.ok(bumps >= 2 && bumps <= 4, "it bumps — throttled, not every frame (" + bumps + " in 4s)");
});

test("physics: the magnet pulls a thing that fits toward the rim (forgiving aim)", () => {
  const st = L.createGame("toyroom", { aspect: 0.78 });
  const o = st.objects.find((ob) => ob.tier === 1 && !ob.starter);
  const h = st.hole;
  // stand just outside the rim, inside the magnet's reach
  const reach = h.r + o.r + RULES.PULL[0] + h.r * RULES.PULL[1];
  const d = (h.r + reach) / 2;
  h.x = h.tx = o.x - d; h.y = h.ty = o.y;
  const before = L.gdist(o.x, o.y, h.x, h.y);
  L.step(st);
  const after = L.gdist(o.x, o.y, h.x, h.y);
  assert.ok(after < before, "the thing slid toward Gobble (" + before.toFixed(2) + " -> " + after.toFixed(2) + ")");
  assert.ok(o.pull > 0, "it leans in (the renderer tilts it)");
});

test("a greedy bot finishes EVERY scene at EVERY aspect: five grows in order, a fast first grow", () => {
  for (const def of SCENES) {
    for (const a of ASPECTS) {
      const st = L.createGame(def, { aspect: a });
      const log = playOut(st, 90);
      const where = def.id + "@" + a;
      assert.ok(st.done, where + ": the bot finished the scene");
      assert.equal(st.eaten, st.total, where + ": everything was eaten");
      const grows = log.filter((e) => e.type === "grow");
      assert.deepEqual(grows.map((g) => g.level), [1, 2, 3, 4, 5], where + ": grows 1..5 in order");
      assert.ok(grows[0].t < 6, where + ": the first grow comes fast (" + grows[0].t.toFixed(1) + "s for the bot)");
      const first = log.find((e) => e.type === "eat");
      assert.ok(first.t < 1.5, where + ": the first gulp is almost instant");
      const win = log.find((e) => e.type === "win");
      assert.ok(win, where + ": eating the finale wins");
      const fin = st.objects.find((o) => o.finale);
      assert.ok(log.find((e) => e.type === "eat" && e.id === fin.id), where + ": the win is the finale going down");
    }
  }
});

test("the win: the VORTEX empties the scene by itself — no hunt for the last crumb", () => {
  for (const def of SCENES) {
    const st = L.createGame(def, { aspect: 0.78 });
    const top = st.levels.R.length - 1;
    const evs = [];
    // Start Gobble at the TOP size and send him STRAIGHT for the finale, so
    // most of the scene is still standing when it goes down — a vortex with
    // nothing left to slurp would prove nothing (the bot alone leaves ~2).
    st.hole.level = top; st.hole.R = st.hole.r = st.levels.R[top];
    const fin = st.objects.find((o) => o.finale);
    while (!st.won && st.t < 120) {
      L.setTarget(st, fin.x, fin.y);
      L.step(st); evs.push(...st.events); st.events.length = 0;
    }
    assert.ok(st.won, def.id + ": won by eating the finale");
    const left = st.objects.filter((o) => o.st !== L.GONE).length;
    assert.ok(left >= 20, def.id + ": most of the scene is still standing at the win (" + left + ")");
    const tWin = st.t;
    while (!st.done && st.t < tWin + 12) { L.step(st); evs.push(...st.events); st.events.length = 0; }
    assert.ok(st.done, def.id + ": the vortex finished (" + left + " things were left)");
    assert.ok(st.t - tWin < 8, def.id + ": …within a few seconds (" + (st.t - tWin).toFixed(1) + "s)");
    assert.equal(st.eaten, st.total, def.id + ": everything is gone");
    assert.equal(evs.filter((e) => e.type === "allgone").length, 1, def.id + ": exactly one allgone");
    assert.equal(evs.filter((e) => e.type === "win").length, 1, def.id + ": exactly one win");
    assert.equal(st.hole.level, top, def.id + ": Gobble is at the top size");
  }
});

test("the hint: after a few quiet seconds Gobble points at the nearest thing it can eat", () => {
  const st = L.createGame("picnic", { aspect: 0.78 });
  // stand still somewhere empty (the start with the starters removed)
  for (const o of st.objects) if (o.starter) o.st = L.GONE;
  assert.equal(st.hint, -1);
  for (let i = 0; i < Math.ceil(RULES.HINT_AFTER / L.DT) + 2; i++) { L.step(st); st.events.length = 0; }
  assert.ok(st.hint >= 0, "a hint is showing");
  const n = L.nearestEdible(st);
  assert.equal(st.hint, n.id, "it points at the nearest edible thing");
  assert.ok(L.edible(st, st.objects[st.hint]), "…which Gobble really can eat");
});

test("determinism: the same inputs replay to the identical state", () => {
  const run = () => {
    const st = L.createGame("party", { aspect: 0.66 });
    const moves = [[10, 80], [60, 40], [30, 120], [70, 100]];
    for (let i = 0; i < 1200; i++) {
      if (i % 300 === 0) { const m = moves[(i / 300) % moves.length]; L.setTarget(st, m[0], m[1]); }
      L.step(st); st.events.length = 0;
    }
    return L.hashState(st);
  };
  assert.equal(run(), run());
});

test("save → restore keeps what was eaten, the size and where Gobble stood", () => {
  const st = L.createGame("build", { aspect: 1.2 });
  while (st.hole.level < 2 && st.t < 60) {
    const tg = L.botTarget(st); if (tg) L.setTarget(st, tg.x, tg.y);
    L.step(st); st.events.length = 0;
  }
  // let whatever is mid-gulp finish, so the live xp is settled
  L.setTarget(st, st.hole.x, st.hole.y);
  for (let i = 0; i < 120 && st.objects.some((o) => o.st === L.FALL); i++) { L.step(st); st.events.length = 0; }
  const snap = JSON.parse(JSON.stringify(L.snapshot(st)));   // through JSON, like localStorage
  const back = L.restore(snap);
  assert.equal(back.id, st.id);
  assert.equal(back.aspect, st.aspect, "the same aspect, so the same layout");
  assert.equal(back.eaten, st.objects.filter((o) => o.st === L.GONE).length);
  assert.deepEqual(back.objects.filter((o) => o.st === L.GONE).map((o) => o.id).sort(), [...snap.eaten].sort());
  assert.equal(back.hole.level, st.hole.level, "the same size");
  assert.equal(back.hole.xp, st.hole.xp, "the same xp (re-derived, never stored)");
  assert.ok(Math.abs(back.hole.x - st.hole.x) < 0.01 && Math.abs(back.hole.y - st.hole.y) < 0.01, "Gobble stands where he was");
  // …and a restored run plays on to the end
  playOut(back, 90);
  assert.ok(back.done, "a restored run can still be finished");
});

test("leaving MID-GULP: a thing already falling in is saved as eaten, never brought back on the rim", () => {
  const st = L.createGame("toyroom", { aspect: 0.78 });
  const o = st.objects.find((ob) => ob.starter);
  L.setTarget(st, o.x, o.y);
  for (let i = 0; i < 180 && o.st === L.IDLE; i++) { L.step(st); st.events.length = 0; }
  assert.equal(o.st, L.FALL, "fixture: the bite is falling");
  const back = L.restore(JSON.parse(JSON.stringify(L.snapshot(st))));
  assert.equal(back.objects[o.id].st, L.GONE, "restored as eaten");
  assert.equal(back.hole.xp, o.xp, "…and its xp counts");
});

test("a HOSTILE save can never inflate Gobble or crash the restore", () => {
  assert.equal(L.restore(null), null);
  assert.equal(L.restore("nope"), null);
  assert.equal(L.restore({ scene: "no-such-place" }), null);
  const def = SCENES[0];
  const fresh = L.createGame(def, { aspect: 0.78 });
  const fin = fresh.objects.find((o) => o.finale).id;
  const [a, b] = fresh.objects.filter((o) => !o.finale).map((o) => o.id);   // two real bites
  const junk = L.restore({
    scene: def.id, aspect: "wide",
    eaten: [a, a, b, b + 0.5, -1, 9999, String(b + 1), null, fin, { id: b + 2 }],
    x: "left", y: Infinity,
  });
  assert.ok(junk, "a junk save still restores the scene");
  assert.equal(junk.aspect, 0.75, "a junk aspect falls back to the default");
  assert.equal(junk.eaten, 2, "only real, unique, non-finale ids count");
  const xp = junk.objects.filter((o) => o.st === L.GONE).reduce((s, o) => s + o.xp, 0);
  assert.equal(junk.hole.xp, xp, "xp is re-derived from what was really eaten");
  assert.ok(!junk.won && junk.objects.find((o) => o.finale).st === L.IDLE, "the finale can never be pre-eaten");
  assert.ok(Number.isFinite(junk.hole.x) && Number.isFinite(junk.hole.y), "a junk position falls back to the start");
  // eaten everything-but-the-finale: the level is derived, capped, and sane
  const all = L.restore({ scene: def.id, aspect: 0.78, eaten: fresh.objects.filter((o) => !o.finale).map((o) => o.id) });
  assert.equal(all.hole.level, all.levels.R.length - 1, "eating everything else earns exactly the top size");
});

test("the engine is PURE: no Math.random, no DOM, dual export", () => {
  const src = fs.readFileSync(path.join(__dirname, "../scripts/hole-logic.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  assert.ok(!/Math\.random/.test(src), "hole-logic.js must use its seeded rng, never Math.random");
  assert.ok(!/\bdocument\b|\bwindow\.|localStorage|requestAnimationFrame/.test(src), "hole-logic.js must not touch the DOM");
  assert.equal(typeof L.step, "function");
  assert.equal(typeof L.createGame, "function");
  for (const f of ["hole-render.js", "hole-main.js"]) {
    const s = fs.readFileSync(path.join(__dirname, "../scripts/" + f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    assert.ok(!/Math\.random/.test(s), f + " must not use Math.random (a run replays identically)");
  }
});
