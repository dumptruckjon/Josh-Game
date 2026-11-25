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
  assert.ok(D.PLACES.length >= 18, "eighteen places at least (the owner's minimum)");
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
      if (e.clue) {
        // a clue hunt: the one it asks for, and one or two of the SAME thing
        // that do not fit the clue — the clue picks out exactly one
        assert.ok(D.LEVELS[level].clue, tag + ": no clue before its level");
        const finds = same.filter((it) => it.role === "find"), decoys = same.filter((it) => it.role === "decoy");
        assert.equal(finds.length, 1, tag + ": one " + e.kind + " fits the clue");
        assert.equal(finds[0].art, e.art, tag + ": …and it is the card's picture");
        assert.ok(decoys.length >= 1 && decoys.length <= D.CLUES.decoys, tag + ": " + decoys.length + " that do not");
        assert.equal(decoys.length + 1, same.length, tag + ": nothing else of its group");
        assert.ok(L.clueHolds(p, o.items, e), tag + ": the clue (" + e.clue.word + ") is TRUE of exactly one");
        continue;
      }
      assert.equal(same.length, e.n, tag + ": " + e.kind + " is in the picture " + same.length + " times, the list says " + e.n);
      assert.ok(same.every((it) => it.role === "find" && it.kind === e.kind), tag + ": every " + e.kind + " is one of the finds");
      assert.ok(same.every((it) => it.art === e.art), tag + ": every " + e.kind + " is the SAME picture as its card");
    }
  });
  assert.ok(pictures >= 250, "laid out " + pictures + " pictures");
});

test("CLUE hunts: most harder pictures ask for one thing with a position or colour word; the clue is true of exactly one, the decoys plainly not; a colour clue's shirts are three different named colours", () => {
  let pics = 0, clued = 0;
  const types = {};
  each((p, level, seed, o) => {
    const c = o.list.filter((e) => e.clue);
    assert.ok(c.length <= 1, "at most one clue a picture");
    if (!D.LEVELS[level].clue) { assert.equal(c.length, 0, p.id + ": no clue on level " + level); assert.equal(o.items.filter((it) => it.role === "decoy").length, 0, "no decoys without a clue"); return; }
    pics++;
    if (!c.length) return;
    clued++;
    const e = c[0];
    types[e.clue.type] = (types[e.clue.type] || 0) + 1;
    assert.ok(!D.KINDS[e.kind].sky && e.n === 1, p.id + ": a clue asks for ONE thing on the ground");
    if (e.clue.type === "colour") {
      const same = o.items.filter((it) => it.kind === e.kind);
      const shirts = same.map((it) => it.art.split("~")[1]);
      assert.equal(new Set(shirts).size, shirts.length, p.id + ": every " + e.kind + " wears a different shirt");
      for (const sh of shirts) assert.ok(D.CLUES.colours[sh], p.id + ": shirt " + sh + " has a plain colour name");
      assert.ok(D.CLUES.colourKinds.indexOf(e.kind) >= 0, p.id + ": " + e.kind + "'s shirt really changes");
    } else {
      assert.match(e.clue.word, /^(under|on|next to) the [a-z ]+$/, "a position word and a thing: " + e.clue.word);
      // the decoys are not merely outside the clue: they are plainly far
      const marks = L.anchors(p, o.items).filter((a) => a.say === e.clue.say);
      assert.ok(marks.length >= 1, p.id + ": the " + e.clue.say + " is in the picture");
      for (const it of o.items.filter((x) => x.role === "decoy")) for (const a of marks) {
        const d = Math.hypot(it.x - a.x, it.y + it.size / 2 - a.foot);
        assert.ok(d > a.w / 2 + it.size * 0.7 + L.FAR - 0.01, p.id + ": a decoy " + it.kind + " stands well away from every " + a.say);
      }
    }
  });
  assert.ok(clued / pics >= 0.85, "most harder pictures carry a clue (" + clued + "/" + pics + ")");
  for (const t of ["under", "next", "on", "colour"]) assert.ok(types[t] >= 10, "clues of every kind turn up: " + t + " " + (types[t] || 0));
});

test("HIDING INSIDE: on the harder levels one thing hides in a piece of scenery big enough to hold it; a tap cannot reach it until it is out, and out it shows like any find", () => {
  let pics = 0, hid = 0;
  each((p, level, seed, o) => {
    const inside = o.items.filter((it) => it.inside);
    if (!D.LEVELS[level].inside) { assert.equal(inside.length, 0, p.id + ": nothing hides before its level"); return; }
    pics++;
    if (!inside.length) return;
    hid++;
    assert.equal(inside.length, 1, "one thing a picture");
    const it = inside[0], i = o.items.indexOf(it);
    assert.ok(it.hidden && it.role === "find", "it is a hidden find");
    const e = o.list.find((x) => x.kind === it.kind);
    assert.ok(e && e.n === 1 && !e.clue && e.inside, p.id + ": the list knows " + it.kind + " is inside a " + e.inside);
    assert.ok(!p.zones.some((z) => z.lanes && z.kinds[it.kind]), p.id + ": what drives on a road never hides in a tree");
    const b = o.items.findIndex((x) => x.holds);
    assert.ok(b >= 0, p.id + ": the scenery that holds it");
    assert.equal(L.heldBy(o.items, b), i, p.id + ": heldBy finds it");
    assert.ok(o.items[b].size >= it.size * 1.4, p.id + ": the box is big enough");
    assert.ok(i > b, "out, it is drawn in front of its box");
    assert.ok(L.visibleFrac(o.items, i) >= 0.78, p.id + ": out, it shows");
    // a tap where it is lands on the box, never on it
    assert.notEqual(L.hitTest(o.items, it.x, it.y, 0), i, p.id + ": hidden, it cannot be tapped");
    const buddy = o.items.find((x) => x.role === "buddy");
    assert.ok(!(Math.hypot(o.items[b].x - buddy.x, o.items[b].y - buddy.y) < L.rOf(o.items[b]) + L.rOf(buddy)), p.id + ": never the buddy's hiding place");
  });
  assert.ok(hid / pics >= 0.7, "most harder pictures hide something (" + hid + "/" + pics + ")");
});

test("a STORY's friends are Josh's own friends, and every new line is words", () => {
  const C = require("../scripts/content.js");
  const names = (C.FRIENDS || []).map((f) => f.name);
  for (const f of D.FRIENDS) assert.ok(names.indexOf(f) >= 0, f + " is one of his friends");
  const lines = [D.SAY.clue("dog", "under the tree"), D.SAY.decoy("the dog"), D.SAY.popped("dog", "tent"), D.SAY.storyStart("River", "the dog"),
    D.SAY.storyNext("River", "x"), D.SAY.storyCount("River", "3 x"), D.SAY.storyBuddy("River", "Spidey"), D.SAY.storyEnd("River"), D.SAY.notYet, D.SAY.night, D.SAY.lightsOn];
  for (const l of lines) assert.ok(!EMOJI.test(l), "no picture in: " + l);
  for (const l of lines) assert.ok(!/\b(he|she|his|her)\b/i.test(l), "no pronoun guessed for a friend: " + l);
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

test("TRICKY levels: shadows from the fourth picture, look-alikes from the fifth — every look-alike a real thing of ANOTHER name, from its own place, crowding round what he is after", () => {
  const shadowAt = D.LEVELS.findIndex((l) => l.shadow);
  const likeAt = D.LEVELS.findIndex((l) => l.like);
  assert.ok(shadowAt >= 3 && likeAt > shadowAt, "the easy levels stay easy; shadows come first, then look-alikes");
  // the pairs: real kinds, never scenery, never the same group (a look-alike
  // of the same group would be a second right answer)
  for (const [k, likes] of Object.entries(D.LIKE)) {
    assert.ok(D.KINDS[k] && !D.KINDS[k].prop, "LIKE: " + k + " is a findable kind");
    for (const x of likes) {
      assert.ok(D.KINDS[x] && !D.KINDS[x].prop, "LIKE: " + k + " -> " + x + " is a kind");
      assert.notEqual(L.groupOf(x), L.groupOf(k), "LIKE: " + k + " and " + x + " share a group, so " + x + " would also be right");
    }
  }
  let pics = 0, withLikes = 0;
  for (const p of D.PLACES) {
    const has = new Set();
    for (const z of p.zones) for (const k of Object.keys(z.kinds || {})) has.add(k);
    let mine = 0;
    for (const seed of SEEDS) {
      const o = L.layout(p.id, { seed, level: likeAt });
      const want = new Set(o.list.map((e) => L.groupOf(e.kind)));
      const likes = o.items.filter((it) => it.like);
      pics++;
      if (likes.length) withLikes++;
      mine += likes.length;
      for (const it of likes) {
        assert.ok(has.has(it.kind), p.id + ": a look-alike " + it.kind + " belongs to this place");
        assert.ok(!want.has(L.groupOf(it.kind)), p.id + ": a look-alike is never of a group the list asks for");
        assert.ok((D.LIKE[it.like] || []).indexOf(it.kind) >= 0, p.id + ": " + it.kind + " is a look-alike of " + it.like);
      }
      // and on the levels below, none
      assert.equal(L.layout(p.id, { seed, level: likeAt - 1 }).items.filter((it) => it.like).length, 0, p.id + ": no look-alikes before their level");
    }
    assert.ok(mine / SEEDS.length >= 1.2, p.id + ": look-alikes really turn up (" + (mine / SEEDS.length).toFixed(1) + " a picture)");
  }
  assert.ok(withLikes / pics >= 0.8, "most tricky pictures have look-alikes (" + withLikes + "/" + pics + ")");
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
      if (it.hidden) return;                   // inside scenery: its box is tapped (HIDING INSIDE)
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

test("a finger a little off still gets what he is after: a tap on the buddy (or a find) PEEKING OUT from behind scenery is meant for him, not the tree in front", () => {
  // Measured on Josh's iPhone 17 Pro (the picture is ~370px across), 8px-off
  // taps on the buddy landed on the tree he hides behind about half the time
  // ("That's a tree.") — while he could plainly see the buddy there.
  const tree = { kind: "tree", role: "prop", x: 100, y: 100, size: 120 };
  const buddy = { kind: "buddy", role: "buddy", x: 130, y: 70, size: 60 };
  const items = [buddy, tree];                // the tree is in FRONT of him
  const want = (j) => items[j].role === "buddy";
  const at = (x, y) => L.peekThrough(items, L.hitTest(items, x, y, 0), x, y, want);
  assert.equal(L.hitTest(items, 120, 80, 0), 1, "fixture: the tree in front takes this tap");
  assert.equal(at(120, 80), 0, "…but it lands on the buddy's body, so it is the buddy");
  assert.equal(at(70, 130), 1, "a tap on the tree away from him is still the tree");
  assert.equal(L.peekThrough(items, 1, 120, 80, () => false), 1, "once he is found (not wanted), the tree is the tree");
  assert.equal(L.peekThrough(items, 0, 120, 80, want), 0, "a tap on a thing that is not scenery is left alone");
  const hid = [{ ...buddy, hidden: true }, tree];
  assert.equal(L.peekThrough(hid, 1, 120, 80, (j) => hid[j].role === "buddy"), 1, "a thing hidden INSIDE scenery is never reached through it");
  // and over every real picture: taps 8px off a find or the buddy reach it
  const VIEW = 370, k = D.W / VIEW, TOL = 22 * k, ERR = 8 * k;
  let tot = 0, miss = 0;
  for (const p of D.PLACES) for (const level of LEVELS) for (const seed of SEEDS.slice(0, 4)) {
    const its = L.layout(p.id, { seed, level }).items;
    const w = (j) => its[j].role === "find" || its[j].role === "buddy";
    its.forEach((it, i) => {
      if (!w(i) || it.hidden) return;
      for (let a = 0; a < 8; a++) {
        const x = it.x + Math.cos(a * Math.PI / 4) * ERR, y = it.y + Math.sin(a * Math.PI / 4) * ERR;
        tot++; if (L.peekThrough(its, L.hitTest(its, x, y, TOL), x, y, w) !== i) miss++;
      }
    });
  }
  assert.ok(tot > 10000, "fixture: " + tot + " taps tried");
  assert.ok(miss / tot < 0.02, "an 8px-off tap misses what he aimed at " + (miss / tot * 100).toFixed(1) + "% of the time");
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

test("a WORLD, not a backdrop (the owner, 2026-11-24): every place is built from set pieces — paths, ponds, buildings, benches, beds, stalls, rails — with detail scattered over it, and its things are a crowd of small ones", () => {
  const S = require("../scripts/seek-scenery.js");
  const FLAT = new Set(["rect", "ellipse", "path"]);
  for (const p of D.PLACES) {
    const pieces = p.ground.filter((g) => !FLAT.has(g[0]));
    for (const g of p.ground) assert.ok(S.kinds.indexOf(g[0]) >= 0, p.id + ": unknown set piece " + g[0]);
    assert.ok(pieces.length >= 5, p.id + ": at least five set pieces build its world (" + pieces.length + ")");
    assert.ok(new Set(pieces.map((g) => g[0])).size >= 3, p.id + ": of at least three kinds");
    const svg = L.groundSvg(p.id, 5);
    const shapes = (svg.match(/<(rect|circle|ellipse|path|polygon|line) /g) || []).length;
    assert.ok(shapes >= 200, p.id + ": the world is DETAILED — " + shapes + " shapes, not a few flat bands");
    for (const g of pieces) assert.ok(S.draw(g, L.rng(1)).length > 0, p.id + ": " + g[0] + " draws something");
    const n = SEEDS.slice(0, 4).reduce((a, seed) => a + L.layout(p.id, { seed, level: 0 }).items.length, 0) / 4;
    assert.ok(n >= 110, p.id + ": a crowd of things (" + n.toFixed(0) + " on level 0)");
  }
  // every set piece the library offers is used somewhere (none dead)
  const used = new Set();
  for (const p of D.PLACES) for (const g of p.ground) used.add(g[0]);
  for (const k of S.kinds) if (!FLAT.has(k)) assert.ok(used.has(k), "set piece " + k + " is used by some place");
});

test("things stand IN the world: what lives on a road, rails or a runway stands on a lane line; a little scene is set where the world is built for it", () => {
  let laned = 0;
  for (const p of D.PLACES) {
    for (const seed of SEEDS.slice(0, 4)) {
      const o = L.layout(p.id, { seed, level: 2 });
      const want = new Set(o.list.map((e) => L.groupOf(e.kind)));
      for (const z of p.zones) {
        if (z.lanes) {
          for (const it of o.items) {
            if (it.role === "prop" || !L.inZone(z, it.x, it.y) || !z.kinds[it.kind]) continue;
            const feet = it.y + it.size / 2;
            const d = Math.min(...z.lanes.map((ly) => Math.abs(feet - (ly + it.size * 0.1))));
            assert.ok(d <= it.size * 0.3, p.id + "/" + z.id + ": " + it.kind + " stands on a lane (" + d.toFixed(1) + " off)");
            laned++;
          }
        }
        for (const v of z.at || []) {
          const here = o.items.some((it) => it.fixed && it.kind === v[0] && it.x === v[1] && it.y === v[2]);
          assert.equal(here, !want.has(L.groupOf(v[0])), p.id + ": the " + v[0] + " of a little scene is in place unless the list asks for its group");
        }
      }
    }
  }
  assert.ok(laned >= 50, "lanes are really used (" + laned + ")");
});

test("a crowd wears every colour: a person's orange clothes are recoloured to one of the shirts, skin and hair never touched", () => {
  const ART = require("../scripts/seek-art.js");
  const svg = ART["person-walking-medium-skin-tone"];
  assert.equal(L.recolor(svg, 0), svg, "shirt 0 is Noto's own orange");
  const blue = L.recolor(svg, 2);
  assert.notEqual(blue, svg, "another shirt changes the picture");
  assert.ok(!/#ed6d23/i.test(blue), "the orange shirt is gone");
  for (const skin of ["#ba8d68", "#a47b62", "#6d4c41"]) assert.ok(blue.indexOf(skin) >= 0, "skin and hair " + skin + " stay");
  // a real picture's people wear several shirts
  const o = L.layout("park", { seed: 11, level: 2 });
  const shirts = new Set(o.items.filter((it) => (D.KINDS[it.kind] || {}).tone).map((it) => (it.art.split("~")[1] || "0")));
  assert.ok(shirts.size >= 4, "a crowd in several colours (" + [...shirts].join(",") + ")");
  for (const it of o.items) if (it.role !== "buddy") assert.ok(ART[L.artBase(it.art)], it.art + " has a picture");
});

test("every line the world says is words, never a picture", () => {
  const lines = [D.SAY.pick, D.SAY.win, D.SAY.look, D.SAY.find("x"), D.SAY.found("x"), D.SAY.foundAll(3, "x"), D.SAY.buddy("x"), D.SAY.that("a x"), D.SAY.album(2, 9), D.SAY.albumEmpty, D.SAY.sticker("x"), D.SAY.ghost("x")];
  for (const k of Object.keys(D.KINDS)) { lines.push(D.KINDS[k].say); if (D.KINDS[k].many) lines.push(D.KINDS[k].many); }
  for (const l of lines) assert.ok(!EMOJI.test(l), "no picture in: " + l);
});

test("every door wears its own picture, and every place has its own name", () => {
  const doors = D.PLACES.map((p) => p.door), names = D.PLACES.map((p) => p.name);
  assert.equal(new Set(doors).size, doors.length, "no two doors share a picture");
  assert.equal(new Set(names).size, names.length, "no two places share a name");
});
