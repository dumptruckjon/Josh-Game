// 🕳️ Gobble Hole — engine tests (node, no browser). The engine is pure and
// deterministic (a 60Hz fixed step, a seeded RNG, zero DOM), so whole places
// are laid out and PLAYED here headless, exactly as the browser plays them.
// PLAN_GOBBLE.md §8 and §9.8 list what these pin.
//
// Phase 2 (§9): a place is a BIG world — far larger than the screen, which is
// a camera that follows Gobble and pulls back as he grows. So these laws are
// about a world worth moving around in: districts, clumps, trails, a finale
// to head for, and grows that never need a hunt.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const DATA = require("../scripts/hole-data.js");
const L = require("../scripts/hole-logic.js");

const { RULES, SCENES } = DATA;
const topMin = (r) => Math.max(r * RULES.SQ + RULES.EDGE, RULES.SPRITE_H * r - RULES.TOP_SLACK);
const tiersOf = (def) => def.tiers.length + 1;   // + the finale
// Every item line of a place, flattened: its picture, count, zone, clump size, tier.
const itemsOf = (def) => def.tiers.flatMap((t, i) => t.items.map((it) => ({ e: it[0], n: it[1], zone: it[2] || null, clump: it[3] || 0, tier: i + 1 })));

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

test("the data: six places, five tiers each plus a finale, every door, picture, district and trail present", () => {
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
    // the finale's stage and Gobble's start are inside the world
    for (const [what, p] of [["the finale's stage", def.finale.at], ["the start", def.start]]) {
      assert.ok(Array.isArray(p) && p[0] > 0 && p[0] < 1 && p[1] > 0 && p[1] < 1, def.id + ": " + what + " is inside the world");
    }
    // DISTRICTS: every zone an item names exists, and every zone holds something
    // (a district nothing stands in is a patch of ground that promises a thing
    // and has none)
    const zones = def.zones || {};
    const items = itemsOf(def);
    for (const it of items) {
      if (it.zone) assert.ok(Array.isArray(zones[it.zone]) && zones[it.zone].length > 0, def.id + ": " + it.e + " names a zone that exists (" + it.zone + ")");
    }
    for (const [z, rects] of Object.entries(zones)) {
      assert.ok(items.some((it) => it.zone === z), def.id + ": zone " + z + " holds something");
      for (const b of rects) {
        assert.ok(b.length === 4 && b.every((v) => v >= 0 && v <= 1) && b[2] > b[0] && b[3] > b[1],
          def.id + ": zone " + z + " is a real rectangle inside the world (" + b.join(",") + ")");
      }
    }
    // CLUMPS: a group of 2-5, and a count that comes in whole groups
    for (const it of items) {
      if (!it.clump) continue;
      assert.ok(Number.isInteger(it.clump) && it.clump >= 2 && it.clump <= 5, def.id + ": " + it.e + " clumps in 2s to 5s (" + it.clump + ")");
      assert.equal(it.n % it.clump, 0, def.id + ": " + it.n + " " + it.e + " come in whole clumps of " + it.clump);
    }
    // TRAILS lead out from the start, each made of a PLAIN tier-1 bite (never
    // one that belongs in a district or a clump)
    assert.ok(Array.isArray(def.trails) && def.trails.length >= 2, def.id + ": trails of bites lead out from the start");
    for (const tr of def.trails) {
      assert.ok(items.some((it) => it.e === tr.e && it.tier === 1 && !it.zone && !it.clump), def.id + ": a trail is made of a plain tier-1 bite (" + tr.e + ")");
    }
    assert.ok(Array.isArray(def.decals) && def.decals.length >= 3, def.id + ": the ground has features to find your way by");
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
    const pics = [def.door, def.finale.e, ...def.trails.map((t) => t.e)];
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

test("layout: every place fills its BIG world — no overlaps, a clear start, nothing squeezed, every thing in its district", () => {
  for (const def of SCENES) {
    const lay = L.layout(def);
    const where = def.id;
    assert.deepEqual([lay.W, lay.H], RULES.WORLD, where + ": the world is its fixed size — the screen is only a camera onto it");
    assert.equal(lay.relaxed, 0, where + ": every thing found a spot without squeezing");
    assert.equal(lay.zoneMiss, 0, where + ": every zoned thing found a spot in its zone");
    assert.equal(lay.broken, 0, where + ": every clump stood together");
    const want = def.tiers.reduce((n, t) => n + t.items.reduce((m, it) => m + it[1], 0), 0) + 1;
    assert.equal(lay.objects.length, want, where + ": every thing is placed");
    assert.ok(lay.objects.length >= 180, where + ": a big world is FULL of things (" + lay.objects.length + ")");
    for (const o of lay.objects) {
      assert.ok(o.x >= o.r + RULES.EDGE - 1e-3 && o.x <= lay.W - o.r - RULES.EDGE + 1e-3, where + ": " + o.e + " inside the world (x)");
      assert.ok(o.y >= topMin(o.r) - 1e-3 && o.y <= lay.H - o.r * RULES.SQ - RULES.EDGE + 1e-3, where + ": " + o.e + " inside the world (y)");
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
    // Zoned things stand in their district — checked on the GEOMETRY, not on
    // the layout's own counter (a clump grown from a centre in the park once
    // walked two tulips out onto the road while the counter read 0).
    for (const it of itemsOf(def)) {
      if (!it.zone) continue;
      const rects = def.zones[it.zone].map((b) => [b[0] * lay.W, b[1] * lay.H, b[2] * lay.W, b[3] * lay.H]);
      for (const o of lay.objects.filter((ob) => ob.e === it.e)) {
        assert.ok(rects.some((b) => o.x >= b[0] && o.x <= b[2] && o.y >= b[1] && o.y <= b[3]),
          where + ": " + o.e + " stands in its " + it.zone + " (at " + o.x.toFixed(1) + "," + o.y.toFixed(1) + ")");
      }
    }
  }
});

test("layout: the finale stands on its stage far away, three bites sit right beside Gobble, and TRAILS of bites lead out", () => {
  for (const def of SCENES) {
    const st = L.createGame(def);
    const fin = st.objects.find((o) => o.finale);
    const at = def.finale.at;
    assert.ok(Math.abs(fin.x - st.W * at[0]) < 0.01, def.id + ": the finale stands on its stage (x; positions are rounded to 0.001)");
    assert.ok(Math.abs(fin.y - Math.max(st.H * at[1], topMin(fin.r))) < 0.01, def.id + ": …and y");
    assert.ok(fin.y < st.H * 0.5, def.id + ": the finale is in the far half — the landmark to head for");
    assert.ok(L.gdist(fin.x, fin.y, st.start.x, st.start.y) > st.H * 0.5, def.id + ": …a real journey from the start");
    const starters = st.objects.filter((o) => o.starter);
    assert.equal(starters.length, def.starters, def.id + ": " + def.starters + " starters");
    for (const s of starters) {
      assert.equal(s.tier, 1, def.id + ": a starter is a tier-1 bite");
      // within a short glide: the first gulp comes within a second
      assert.ok(L.gdist(s.x, s.y, st.start.x, st.start.y) < 14, def.id + ": a starter sits right beside Gobble");
    }
    // Every trail: at least 8 bites, starting a short glide from Gobble, each
    // one farther out than the last, none skipped, heading where it points.
    def.trails.forEach((tr, ti) => {
      const bites = st.objects.filter((o) => o.trail === ti + 1);   // in placement order
      const where = def.id + " trail " + (ti + 1) + " (" + tr.e + ")";
      assert.ok(bites.length >= 8, where + ": at least 8 bites to follow (" + bites.length + ")");
      assert.ok(bites.every((o) => o.e === tr.e && o.tier === 1), where + ": made of its own bite");
      const d = bites.map((o) => L.gdist(o.x, o.y, st.start.x, st.start.y));
      assert.ok(d[0] < 30, where + ": the first bite is a short glide from the start (" + d[0].toFixed(1) + ")");
      for (let i = 1; i < bites.length; i++) {
        assert.ok(d[i] > d[i - 1], where + ": bite " + (i + 1) + " is farther out than bite " + i);
        const gap = Math.hypot(bites[i].x - bites[i - 1].x, bites[i].y - bites[i - 1].y);
        assert.ok(gap <= 1.6 * RULES.TRAIL_STEP, where + ": no bite is skipped (a gap of " + gap.toFixed(1) + ")");
      }
      // it heads where it points: the last bite lies on the line to its target
      // (a long trail stops after TRAIL_MAX bites — it leads TOWARD, it need
      // not arrive)
      const to = { x: st.W * tr.to[0], y: st.H * tr.to[1] }, last = bites[bites.length - 1];
      const aim = Math.atan2(to.y - st.start.y, to.x - st.start.x), got = Math.atan2(last.y - st.start.y, last.x - st.start.x);
      const off = Math.abs(((got - aim + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * 180 / Math.PI;
      assert.ok(off < 12, where + ": it heads where it points (" + off.toFixed(1) + "° off)");
    });
  }
});

test("layout: a CLUMP stands together — one pass hoovers up the lot", () => {
  for (const def of SCENES) {
    const lay = L.layout(def);
    const groups = new Map();
    for (const o of lay.objects) {
      if (!o.clump) continue;
      if (!groups.has(o.clump)) groups.set(o.clump, []);
      groups.get(o.clump).push(o);
    }
    const want = itemsOf(def).reduce((n, it) => n + (it.clump ? it.n / it.clump : 0), 0);
    assert.equal(groups.size, want, def.id + ": every clump the data asks for was laid out");
    for (const g of groups.values()) {
      assert.equal(new Set(g.map((o) => o.e)).size, 1, def.id + ": a clump is one kind of thing");
      const k = itemsOf(def).find((it) => it.e === g[0].e).clump;
      assert.equal(g.length, k, def.id + ": a clump of " + g[0].e + " has " + k);
      // each member (almost) touches another: its nearest clump-mate stands no
      // more than 10% past touching
      for (const m of g) {
        const link = Math.min(...g.filter((n) => n !== m).map((n) => L.gdist(m.x, m.y, n.x, n.y) / (m.r + n.r)));
        assert.ok(link <= 1.1, def.id + ": " + m.e + " stands with its clump (link " + link.toFixed(3) + ")");
      }
      // …and the whole group is no longer than a chain of k touching things
      let spread = 0;
      for (const m of g) for (const n of g) spread = Math.max(spread, L.gdist(m.x, m.y, n.x, n.y) / (m.r + n.r));
      assert.ok(spread <= 1.1 * (k - 1), def.id + ": a clump of " + k + " " + g[0].e + " is one bunch (spread " + spread.toFixed(2) + ")");
    }
  }
});

test("layout is deterministic, and the screen has NO say in it", () => {
  for (const def of SCENES) {
    assert.deepEqual(L.layout(def), L.layout(def), def.id + ": the same layout every time");
  }
  // phase 1 laid a place out for the screen's aspect; a leftover option must
  // change nothing (a save made on a phone resumes on an iPad)
  for (const def of SCENES) {
    assert.equal(L.hashState(L.createGame(def, { aspect: 1.7 })), L.hashState(L.createGame(def)), def.id + ": no aspect, no screen");
  }
});

test("THE TIER LAW: each tier is edible at exactly its level — too big one level earlier", () => {
  // Level L eats every tier <= L+1. R[L] is DERIVED (biggest of tier L+1 /
  // FIT * HEAD); the law is that tier L+2 does NOT fit yet, so every tier has
  // its "too big — grow first!" moment and growing always unlocks something.
  for (const def of SCENES) {
    const st = L.createGame(def);
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

test("GROWING is derived: a grow needs GROW_BITES bites of the newest tier — reachable with most of the place still standing", () => {
  for (const def of SCENES) {
    const st = L.createGame(def);
    const { C } = st.levels;
    assert.equal(C[0], 0);
    for (let lv = 1; lv < C.length; lv++) {
      // restated here from the rule, not read back from the engine
      const tier = st.objects.filter((o) => o.tier === lv);
      const mean = tier.reduce((s, o) => s + o.xp, 0) / tier.length;
      const bites = RULES.GROW_BITES[Math.min(lv - 1, RULES.GROW_BITES.length - 1)];
      assert.equal(C[lv], Math.round(C[lv - 1] + bites * mean), def.id + ": level " + lv + " costs " + bites + " bites of tier " + lv);
      assert.ok(C[lv] > C[lv - 1], def.id + ": thresholds increase");
      // at most half of everything edible so far: a missed sweet behind a big
      // thing, or a whole district he never visits, never blocks a grow
      const reachable = st.objects.filter((o) => o.tier <= lv).reduce((s, o) => s + o.xp, 0);
      assert.ok(C[lv] <= 0.5 * reachable, def.id + ": level " + lv + " needs " + C[lv] + " of " + reachable + " reachable");
    }
    // the first "BIGGER!" comes after about six sweets
    assert.equal(RULES.GROW_BITES[0], 6, "fixture: six bites to the first grow");
  }
});

test("the camera's ZOOM and Gobble's SPEED are one curve: he crosses about a screen a second at every size", () => {
  const st = L.createGame("town");
  const top = st.levels.R.length - 1;
  assert.equal(L.zoomScale(st, 0), 1, "no zoom at the start");
  let prev = 0;
  for (let lv = 0; lv <= top; lv++) {
    const z = L.zoomScale(st, lv);
    assert.ok(Math.abs(z - Math.pow(st.levels.R[lv] / st.levels.R[0], RULES.ZOOM)) < 1e-9, "the zoom follows the level's radius (" + lv + ")");
    assert.ok(z > prev, "the view widens with every grow");
    prev = z;
    // screens per second: speed over the view — the same at every size
    const perSec = (RULES.VMAX * z) / L.viewSpan(st, 400, lv);
    assert.ok(Math.abs(perSec - RULES.VMAX / RULES.VIEW0) < 1e-9 && perSec > 0.8 && perSec < 1.5,
      "at level " + lv + " he crosses " + perSec.toFixed(2) + " screens a second");
  }
  // the view widens SLOWER than he grows, so he also grows ON screen
  assert.ok(st.levels.R[top] / st.levels.R[0] > L.zoomScale(st, top) * 1.4, "he grows on screen too");
  // and the engine really moves him at that speed: a long straight trip,
  // measured in one step, at the start and at the top size
  const speed = (lv) => {
    const s = L.createGame("town");
    for (const o of s.objects) o.st = L.GONE;          // an empty road: nothing to stop for
    s.hole.level = lv; s.hole.R = s.hole.r = s.levels.R[lv];
    s.hole.x = s.hole.tx = 60; s.hole.y = s.hole.ty = 300;
    L.setTarget(s, 60 + 200, 300);
    const x0 = s.hole.x;
    L.step(s);
    return (s.hole.x - x0) / L.DT;
  };
  const v0 = speed(0), vt = speed(top);
  assert.ok(Math.abs(v0 - RULES.VMAX) < 1e-6, "at the start he glides at VMAX (" + v0.toFixed(2) + ")");
  assert.ok(Math.abs(vt / v0 - L.zoomScale(st, top)) < 1e-6, "at the top he is faster by exactly the zoom (" + (vt / v0).toFixed(3) + ")");
});

test("the world is far BIGGER than the screen: the camera shows a small part of it, and more as Gobble grows", () => {
  const st = L.createGame("toyroom");
  const top = st.levels.R.length - 1;
  for (const px of [320, 390, 834]) {   // a small phone, a phone, an iPad's short side
    const v0 = L.viewSpan(st, px, 0), vt = L.viewSpan(st, px, top);
    assert.ok(v0 * 4 < st.W, px + "px: at the start the screen shows under a quarter of the world's width (" + v0.toFixed(1) + " of " + st.W + ")");
    assert.ok(vt < st.W, px + "px: even at the top size the world is bigger than the view (" + vt.toFixed(1) + ")");
    // Gobble's share of the screen's short side: a fair size, and growing
    const f0 = (2 * st.levels.R[0]) / v0, ft = (2 * st.levels.R[top]) / vt;
    assert.ok(f0 > 0.1 && f0 < 0.25, px + "px: at the start Gobble is " + (f0 * 100).toFixed(0) + "% of the screen");
    assert.ok(ft > f0 * 1.4 && ft < 0.4, px + "px: at the top he is " + (ft * 100).toFixed(0) + "% — bigger on screen, never filling it");
  }
  // a bigger screen shows MORE world, not a blow-up of the same
  assert.ok(L.viewSpan(st, 834, 0) > L.viewSpan(st, 390, 0) * 1.3, "an iPad shows more of the world than a phone");
  // a junk size never breaks the camera
  for (const junk of [0, -5, NaN, undefined]) assert.ok(Number.isFinite(L.viewSpan(st, junk, 0)), "a junk screen size falls back");
});

test("physics: a thing that fits falls in and is eaten; the hole's xp grows", () => {
  const st = L.createGame("toyroom");
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
  assert.ok(st.hole.xp >= xp0 + o.xp, "its xp went to Gobble");
});

test("physics: a thing that is TOO BIG wobbles and says so — it never falls in", () => {
  const st = L.createGame("toyroom");
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
  const st = L.createGame("toyroom");
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

test("a greedy bot finishes EVERY place: an instant first gulp, a quick first grow, five grows in order, then the finale", () => {
  for (const def of SCENES) {
    const st = L.createGame(def);
    const log = playOut(st, 120);
    const where = def.id;
    assert.ok(st.done, where + ": the bot finished the place");
    assert.equal(st.eaten, st.total, where + ": everything was eaten");
    const grows = log.filter((e) => e.type === "grow");
    assert.deepEqual(grows.map((g) => g.level), [1, 2, 3, 4, 5], where + ": grows 1..5 in order");
    assert.ok(grows[0].t < 3, where + ": the first grow comes fast (" + grows[0].t.toFixed(1) + "s for the bot)");
    const first = log.find((e) => e.type === "eat");
    assert.ok(first.t < 1.5, where + ": the first gulp is almost instant");
    const win = log.find((e) => e.type === "win");
    assert.ok(win, where + ": eating the finale wins");
    const fin = st.objects.find((o) => o.finale);
    assert.ok(log.find((e) => e.type === "eat" && e.id === fin.id), where + ": the win is the finale going down");
  }
});

test("the win: the VORTEX empties even a big world by itself — no hunt for the last crumb", () => {
  for (const def of SCENES) {
    const st = L.createGame(def);
    const top = st.levels.R.length - 1;
    const evs = [];
    // Start Gobble at the TOP size and send him STRAIGHT for the finale, so
    // most of the world is still standing when it goes down — a vortex with
    // nothing left to slurp would prove nothing.
    st.hole.level = top; st.hole.R = st.hole.r = st.levels.R[top];
    const fin = st.objects.find((o) => o.finale);
    while (!st.won && st.t < 120) {
      L.setTarget(st, fin.x, fin.y);
      L.step(st); evs.push(...st.events); st.events.length = 0;
    }
    assert.ok(st.won, def.id + ": won by eating the finale");
    const left = st.objects.filter((o) => o.st !== L.GONE).length;
    assert.ok(left >= st.total * 0.6, def.id + ": most of the world is still standing at the win (" + left + " of " + st.total + ")");
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
  const st = L.createGame("picnic");
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
    const st = L.createGame("party");
    const moves = [[80, 300], [220, 240], [150, 380], [40, 200]];
    for (let i = 0; i < 1200; i++) {
      if (i % 300 === 0) { const m = moves[(i / 300) % moves.length]; L.setTarget(st, m[0], m[1]); }
      L.step(st); st.events.length = 0;
    }
    return L.hashState(st);
  };
  assert.equal(run(), run());
});

test("save → restore keeps what was eaten, the size and where Gobble stood — and names the layout it belongs to", () => {
  const st = L.createGame("build");
  while (st.hole.level < 2 && st.t < 60) {
    const tg = L.botTarget(st); if (tg) L.setTarget(st, tg.x, tg.y);
    L.step(st); st.events.length = 0;
  }
  // let whatever is mid-gulp finish, so the live xp is settled
  L.setTarget(st, st.hole.x, st.hole.y);
  for (let i = 0; i < 120 && st.objects.some((o) => o.st === L.FALL); i++) { L.step(st); st.events.length = 0; }
  const snap = JSON.parse(JSON.stringify(L.snapshot(st)));   // through JSON, like localStorage
  assert.equal(snap.v, RULES.LAYOUT, "a save names the layout its ids belong to");
  const back = L.restore(snap);
  assert.equal(back.id, st.id);
  assert.equal(back.eaten, st.objects.filter((o) => o.st === L.GONE).length);
  assert.deepEqual(back.objects.filter((o) => o.st === L.GONE).map((o) => o.id).sort(), [...snap.eaten].sort());
  assert.equal(back.hole.level, st.hole.level, "the same size");
  assert.equal(back.hole.xp, st.hole.xp, "the same xp (re-derived, never stored)");
  assert.ok(Math.abs(back.hole.x - st.hole.x) < 0.01 && Math.abs(back.hole.y - st.hole.y) < 0.01, "Gobble stands where he was");
  // …and a restored run plays on to the end
  playOut(back, 120);
  assert.ok(back.done, "a restored run can still be finished");
  // A run from ANOTHER layout names ids that mean different things here — the
  // one-screen islands of phase 1 carried no version at all. It is dropped,
  // never guessed at (the ⭐ lives elsewhere in the save and is kept).
  const { v, ...phase1 } = snap;
  assert.equal(v, RULES.LAYOUT);
  assert.equal(L.restore(phase1), null, "a save with no layout version (phase 1) is dropped");
  assert.equal(L.restore({ ...snap, v: RULES.LAYOUT + 1 }), null, "…and so is one from any other layout");
  assert.equal(L.restore({ ...snap, v: String(RULES.LAYOUT) }), null, "…and a version must be the number itself");
});

test("leaving MID-GULP: a thing already falling in is saved as eaten, never brought back on the rim", () => {
  const st = L.createGame("toyroom");
  const o = st.objects.find((ob) => ob.starter);
  L.setTarget(st, o.x, o.y);
  for (let i = 0; i < 180 && o.st === L.IDLE; i++) { L.step(st); st.events.length = 0; }
  assert.equal(o.st, L.FALL, "fixture: the bite is falling");
  const snap = L.snapshot(st);
  const back = L.restore(JSON.parse(JSON.stringify(snap)));
  assert.equal(back.objects[o.id].st, L.GONE, "restored as eaten");
  const xp = back.objects.filter((ob) => ob.st === L.GONE).reduce((s, ob) => s + ob.xp, 0);
  assert.ok(xp >= o.xp && back.hole.xp === xp, "…and its xp counts");
});

test("a HOSTILE save can never inflate Gobble or crash the restore", () => {
  assert.equal(L.restore(null), null);
  assert.equal(L.restore("nope"), null);
  assert.equal(L.restore({ v: RULES.LAYOUT, scene: "no-such-place" }), null);
  const def = SCENES[0];
  const fresh = L.createGame(def);
  const fin = fresh.objects.find((o) => o.finale).id;
  const [a, b] = fresh.objects.filter((o) => !o.finale).map((o) => o.id);   // two real bites
  const junk = L.restore({
    v: RULES.LAYOUT, scene: def.id,
    eaten: [a, a, b, b + 0.5, -1, 9999, String(b + 1), null, fin, { id: b + 2 }],
    x: "left", y: Infinity,
  });
  assert.ok(junk, "a junk save still restores the place");
  assert.equal(junk.eaten, 2, "only real, unique, non-finale ids count");
  const xp = junk.objects.filter((o) => o.st === L.GONE).reduce((s, o) => s + o.xp, 0);
  assert.equal(junk.hole.xp, xp, "xp is re-derived from what was really eaten");
  assert.ok(!junk.won && junk.objects.find((o) => o.finale).st === L.IDLE, "the finale can never be pre-eaten");
  assert.ok(Number.isFinite(junk.hole.x) && Number.isFinite(junk.hole.y), "a junk position falls back to the start");
  // eaten everything-but-the-finale: the level is derived, capped, and sane
  const all = L.restore({ v: RULES.LAYOUT, scene: def.id, eaten: fresh.objects.filter((o) => !o.finale).map((o) => o.id) });
  assert.equal(all.hole.level, all.levels.R.length - 1, "eating everything else earns exactly the top size");
});

test("every ground feature, ground and hole a place declares has a DRAWING, with a real box on the island", () => {
  // A decal kind with no entry in the renderer draws NOTHING, silently — the
  // "a data field with no implementation" class (the fort's bedroom declared
  // a `carpet` floor with no branch and painted bare). And a decal's box is
  // what the renderer culls by, so a NaN box is a feature that never draws:
  // the gravel pile shipped that way in the first cut, because its box was
  // handed its prep object as a size factor.
  const HR = require("../scripts/hole-render.js");
  let n = 0;
  for (const def of SCENES) {
    const { W, H } = L.worldOf(def);
    for (const d of def.decals || []) assert.ok(HR.DECALS[d.k], def.id + ": decal kind '" + d.k + "' has no drawing");
    const ds = HR.prepDecals(def, W, H);
    assert.equal(ds.length, (def.decals || []).length, def.id + ": every decal was prepared");
    for (const x of ds) {
      const b = x.box;
      assert.ok(b.length === 4 && b.every(Number.isFinite) && b[0] < b[2] && b[1] < b[3], def.id + ": '" + x.d.k + "' has a real box (" + b + ")");
      assert.ok(b[2] > 0 && b[0] < W && b[3] > 0 && b[1] < H, def.id + ": '" + x.d.k + "' lies on the island");
      n++;
    }
    const G = HR.GROUND_ART[def.ground];
    assert.ok(G && typeof G.base === "function" && typeof G.marks === "function", def.id + ": ground '" + def.ground + "' has a floor (a base and its marks)");
    assert.ok(HR.GROUNDS[def.ground] && HR.BACKDROPS[HR.GROUNDS[def.ground].backdrop], def.id + ": ground '" + def.ground + "' has an edge and a backdrop");
    assert.ok(HR.HOLES[def.hole], def.id + ": hole '" + def.hole + "' has its colours (else it silently draws as another)");
  }
  assert.ok(n >= 40, "fixture: the places declare their features (" + n + ")");
  // …and nothing the renderer can draw is dead
  const used = new Set(SCENES.flatMap((d) => (d.decals || []).map((x) => x.k)));
  for (const k of Object.keys(HR.DECALS)) assert.ok(used.has(k), "decal kind '" + k + "' is drawn by no place");
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
