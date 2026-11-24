// 🔍 Seek & Find — the engine, headless: every place laid out on every level
// over many seeds, and every picture proven FAIR before a child sees it.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const D = require("../scripts/seek-data.js");
const L = require("../scripts/seek-logic.js");
const ART = require("../scripts/seek-art.js");

const SEEDS = Array.from({ length: 16 }, (_, i) => i * 7919 + 3);
const LEVELS = D.LEVELS.map((_, i) => i);
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function each(fn) {
  for (const p of D.PLACES) for (const level of LEVELS) for (const seed of SEEDS) fn(p, level, seed, L.layout(p.id, { seed, level }));
}

test("the content is whole: every place's kinds exist, every find lives in a zone, every count kind can be said in the plural", () => {
  assert.ok(D.PLACES.length >= 6, "six places at least");
  const ids = new Set();
  for (const p of D.PLACES) {
    assert.ok(!ids.has(p.id), "unique place id " + p.id);
    ids.add(p.id);
    assert.ok(D.KINDS[p.door], p.id + ": its door picture is a kind");
    const inZones = new Set();
    for (const z of p.zones) {
      for (const k of Object.keys(z.kinds || {})) { assert.ok(D.KINDS[k], p.id + "/" + z.id + ": unknown kind " + k); inZones.add(k); }
      for (const k of z.props || []) assert.ok(D.KINDS[k] && D.KINDS[k].prop, p.id + "/" + z.id + ": " + k + " is scenery");
      for (const k of z.fixed || []) assert.ok(D.KINDS[k], p.id + ": fixed " + k);
      const [x, y, w, h] = z.rect;
      assert.ok(x >= 0 && y >= 0 && x + w <= D.W && y + h <= p.h, p.id + "/" + z.id + " lies inside the picture");
    }
    for (const h of p.hide) assert.ok(p.zones.some((z) => (z.props || []).includes(h)), p.id + ": the buddy hides behind " + h + ", which some zone stands up");
    const counts = [], singles = [];
    for (const k of Object.keys(p.finds)) {
      assert.ok(inZones.has(k), p.id + ": the list may ask for " + k + ", so a zone must hold it");
      assert.ok(!D.KINDS[k].prop, p.id + ": scenery is never asked for (" + k + ")");
      if (p.finds[k] === "count") { counts.push(k); assert.ok(D.KINDS[k].many, k + " is counted, so it needs a plural"); }
      else singles.push(k);
    }
    assert.ok(counts.length >= 3 && singles.length >= 6, p.id + ": enough to vary the list (" + counts.length + " to count, " + singles.length + " single)");
  }
});

test("a place never holds two kinds a child would call by the same word (so a spoken name points at one picture)", () => {
  for (const p of D.PLACES) {
    const seen = new Map();
    const kinds = new Set();
    for (const z of p.zones) for (const k of Object.keys(z.kinds || {}).concat(z.props || [], z.fixed || [])) kinds.add(k);
    for (const k of kinds) {
      const w = D.KINDS[k].say;
      assert.ok(!seen.has(w) || L.groupOf(seen.get(w)) === L.groupOf(k), p.id + ': "' + w + '" names both ' + seen.get(w) + " and " + k);
      seen.set(w, k);
    }
  }
});

test("FAIR: each find is in the picture exactly as often as the list says, nothing else of its group is, and the buddy is there once", () => {
  let pictures = 0;
  each((p, level, seed, o) => {
    pictures++;
    const tag = p.id + " L" + level + " seed " + seed;
    assert.equal(o.list.length, 4, tag + ": two finds, one count, the buddy");
    assert.equal(o.list[o.list.length - 1].kind, "buddy", tag + ": the buddy comes last");
    const groups = o.list.filter((e) => e.kind !== "buddy").map((e) => L.groupOf(e.kind));
    assert.equal(new Set(groups).size, groups.length, tag + ": the list never asks for two of one group");
    const counted = o.list.filter((e) => e.n > 1);
    assert.equal(counted.length, 1, tag + ": exactly one thing to count");
    const [lo, hi] = D.LEVELS[level].count;
    assert.ok(counted[0].n >= lo && counted[0].n <= hi, tag + ": the count fits the level");
    for (const e of o.list) {
      if (e.kind === "buddy") { assert.equal(o.items.filter((it) => it.role === "buddy").length, 1, tag + ": one buddy"); continue; }
      const same = o.items.filter((it) => L.groupOf(it.kind) === L.groupOf(e.kind));
      assert.equal(same.length, e.n, tag + ": " + e.kind + " is in the picture " + same.length + " times, the list says " + e.n);
      assert.ok(same.every((it) => it.role === "find" && it.kind === e.kind), tag + ": every " + e.kind + " is one of the finds");
      assert.ok(same.every((it) => it.art === e.art), tag + ": every " + e.kind + " is the SAME picture as its card");
    }
  });
  assert.ok(pictures >= 250, "laid out " + pictures + " pictures");
});

test("FAIR: every find shows (nothing in front covers more than a little of it), the buddy peeks by the level's share, and all of it is inside the picture", () => {
  let worstFind = 1, buddyLo = 1, buddyHi = 0;
  each((p, level, seed, o) => {
    const tag = p.id + " L" + level + " seed " + seed;
    o.items.forEach((it, i) => {
      assert.ok(it.x - it.size / 2 >= -0.5 && it.x + it.size / 2 <= D.W + 0.5, tag + ": " + it.kind + " inside left/right");
      assert.ok(it.y - it.size / 2 >= -0.5 && it.y + it.size / 2 <= p.h + 0.5, tag + ": " + it.kind + " inside top/bottom");
      if (it.role === "find") {
        const v = L.visibleFrac(o.items, i);
        worstFind = Math.min(worstFind, v);
        assert.ok(v >= 0.78, tag + ": the " + it.kind + " shows only " + v.toFixed(2));
      }
      if (it.role === "buddy") {
        const v = L.visibleFrac(o.items, i);
        buddyLo = Math.min(buddyLo, v); buddyHi = Math.max(buddyHi, v);
        const [lo, hi] = D.LEVELS[level].buddy;
        assert.ok(v >= lo - 0.02, tag + ": the buddy shows only " + v.toFixed(2) + " (the level asks " + lo + ")");
        assert.ok(v <= hi + 0.08, tag + ": the buddy is not hiding at all (" + v.toFixed(2) + ")");
        const behind = o.items.slice(i + 1).some((o2) => o2.role === "prop" && Math.hypot(o2.x - it.x, o2.y - it.y) < L.rOf(o2) + L.rOf(it));
        assert.ok(behind, tag + ": the buddy peeks out from BEHIND scenery");
      }
    });
  });
  // the measurement is real: the buddy really is partly hidden
  assert.ok(buddyLo < 0.6 && buddyHi > 0.6, "the buddy's share ranges with the level (" + buddyLo.toFixed(2) + ".." + buddyHi.toFixed(2) + ")");
});

test("a picture is BUSY: the levels add things, and the same seed always gives the same picture", () => {
  for (const p of D.PLACES) {
    const n = LEVELS.map((level) => SEEDS.reduce((a, seed) => a + L.layout(p.id, { seed, level }).items.length, 0) / SEEDS.length);
    assert.ok(n[0] >= 60, p.id + ": a busy picture (" + n[0].toFixed(0) + " things on level 0)");
    for (let i = 1; i < n.length; i++) assert.ok(n[i] > n[i - 1], p.id + ": level " + i + " is busier than " + (i - 1));
    const a = JSON.stringify(L.layout(p.id, { seed: 99, level: 1 }));
    assert.equal(JSON.stringify(L.layout(p.id, { seed: 99, level: 1 })), a, p.id + ": deterministic");
    assert.notEqual(JSON.stringify(L.layout(p.id, { seed: 100, level: 1 })), a, p.id + ": another seed, another picture");
  }
});

test("a tap: the topmost body under the finger, else the nearest within reach, else nothing", () => {
  const items = [
    { kind: "a", x: 100, y: 100, size: 100 },
    { kind: "b", x: 140, y: 100, size: 100 },   // in front, overlapping
  ];
  assert.equal(L.hitTest(items, 120, 100, 0), 1, "where both cover, the one in FRONT");
  assert.equal(L.hitTest(items, 70, 100, 0), 0, "where only the back one covers, the back one");
  assert.equal(L.hitTest(items, 100, 160, 0), -1, "an empty corner of a box is not the thing");
  assert.equal(L.hitTest(items, 100, 160, 20), 0, "…but a finger just beside it still gets it");
  assert.equal(L.hitTest(items, 400, 400, 20), -1, "far away is nothing");
  // in real pictures, a tap on a find's centre (or the buddy's top) lands on it
  let tried = 0;
  for (const p of D.PLACES) for (const seed of SEEDS.slice(0, 4)) {
    const o = L.layout(p.id, { seed, level: 2 });
    o.items.forEach((it, i) => {
      if (it.role !== "find" && it.role !== "buddy") return;
      // a point on the visible part of its body
      const R = L.rOf(it);
      let hit = false;
      for (let gy = -3; gy <= 3 && !hit; gy++) for (let gx = -3; gx <= 3 && !hit; gx++) {
        const x = it.x + (gx / 3) * R * 0.9, y = it.y + (gy / 3) * R * 0.9;
        if (L.hitTest(o.items, x, y, 0) === i) hit = true;
      }
      tried++;
      assert.ok(hit, p.id + " seed " + seed + ": the " + it.kind + " can be tapped somewhere on it");
    });
  }
  assert.ok(tried > 100, "checked " + tried + " finds");
});

test("the pictures: exactly the ones a place can draw, all in seek-art.js, each a whole SVG, with the Noto licence shipped beside them", () => {
  const names = L.artNames();
  assert.deepEqual(Object.keys(ART).sort(), names, "seek-art.js holds exactly the pictures the places draw (re-run tools/seek-art.js)");
  for (const n of names) assert.match(ART[n], /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ \d+">[\s\S]+<\/svg>$/, n + " is a whole svg");
  assert.ok(names.includes(D.LOGO), "the world's logo is drawn too");
  const lic = fs.readFileSync(path.join(__dirname, "..", "NOTO-LICENSE.txt"), "utf8");
  assert.match(lic, /Apache License\s+Version 2\.0/, "the Apache 2.0 licence text ships with the art");
  const head = fs.readFileSync(path.join(__dirname, "..", "scripts", "seek-art.js"), "utf8").slice(0, 600);
  assert.match(head, /Apache License, Version 2\.0/, "…and the art file names it");
  assert.match(head, /Google/, "…and its author");
});

test("the ground: one flat svg per picture — no ids, no filters, no gradients (nothing to collide with another svg on the page) — and every mark kind a place uses is drawn", () => {
  for (const p of D.PLACES) {
    const g = L.groundSvg(p.id, 5);
    assert.ok(!/\sid=/.test(g) && !/<filter|Gradient/.test(g), p.id + ": a flat drawing");
    for (const m of p.marks || []) assert.ok(L.MARK[m[0]], p.id + ": mark kind " + m[0] + " has a drawing");
    assert.equal(L.groundSvg(p.id, 5), g, p.id + ": the same seed draws the same ground");
  }
});

test("every line the world says is words, never a picture", () => {
  const lines = [D.SAY.pick, D.SAY.win, D.SAY.look, D.SAY.find("x"), D.SAY.found("x"), D.SAY.foundAll(3, "x"), D.SAY.buddy("x"), D.SAY.that("a x")];
  for (const k of Object.keys(D.KINDS)) { lines.push(D.KINDS[k].say); if (D.KINDS[k].many) lines.push(D.KINDS[k].many); }
  for (const l of lines) assert.ok(!EMOJI.test(l), "no picture in: " + l);
});
