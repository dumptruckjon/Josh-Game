// 🕳️ Gobble Hole — engine tests (node, no browser). The engine is pure and
// deterministic (a 60Hz fixed step, a seeded RNG, zero DOM), so whole places
// are laid out and PLAYED here headless, exactly as the browser plays them.
// PLAN_GOBBLE.md §8, §9.8 and §14 list what these pin.
//
// Phase 2 (§9): a place is a BIG world — far larger than the screen, which is
// a camera that follows Gobble and pulls back as he grows. Phase 4 (§14, the
// owner's pick of 2026-10-06: "double the levels … the layout and shape of
// the level and challenge should feel different"): twenty-four places, each
// with its own SHAPE (a heart, a spiral, islands, a maze, a music note …) and
// its own CHALLENGE (walls, water, keys, portals, currents, ice, the dark,
// things that ride, boxes that pop, rows that topple). So beside the laws of
// a world worth moving around in, these pin that no place is a reskin of
// another, that every gate really shuts, and that Gobble can never stand
// where the rules say he cannot.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const DATA = require("../scripts/hole-data.js");
const L = require("../scripts/hole-logic.js");

const { RULES, SCENES } = DATA;
// A picture's top may overhang the world's back edge by TOP_SLACK; nothing
// stands closer to it than EDGE (the engine's own rule, restated).
const topMin = (r) => Math.max(RULES.EDGE, RULES.SPRITE_H * r - RULES.TOP_SLACK);
const tiersOf = (def) => def.tiers.length + 1;   // + the finale
// Every item line of a place, through the engine's own reader (a line is
// [emoji, count, zone?, clump?] or [emoji, count, {options}]).
const itemsOf = (def) => def.tiers.flatMap((t, i) => t.items.map((raw) => ({ ...L.itemOf(raw), tier: i + 1 })));
// The surprises inside the boxes and trees: [emoji, count, tier].
const kidsOf = (def) => itemsOf(def).flatMap((it) => (it.pop || it.shake || []).map((k) => ({ e: k[0], n: k[1], tier: k[2] || 1, box: it.e })));
// A plain bite: tier 1 and nothing special (the starters and the trails are
// made of these — the engine's own rule, restated).
const plain = (it) => it.tier === 1 && !it.zone && !(it.clump > 1) && !it.ride && !it.at && !it.pop && !it.shake && !it.key && !it.lock && !it.solid && !it.chain;
// Where Gobble's centre may stand (the engine's freeAt, restated): on ground
// he can walk, outside the core of every wall of things.
const freeAt = (st, G, x, y) => G.walk(x, y) <= 1e-6 && st.objects.every((o) => !L.activeSolid(st, o) || L.gdist(x, y, o.x, o.y) >= o.r * RULES.CORE - 1e-6);

// Play a run with the greedy bot (the same one the browser hook uses). With
// `check`, every step asserts Gobble stands where he may.
function playOut(st, maxSeconds, check) {
  const log = [];
  const G = check ? L.geomOf(st.id) : null;
  let bad = null;
  while (!st.done && st.t < maxSeconds) {
    if (!st.won) { const tg = L.botTarget(st); if (tg) L.setTarget(st, tg.x, tg.y); }
    L.step(st, L.DT);
    for (const ev of st.events) log.push({ t: st.t, ...ev });
    st.events.length = 0;
    if (G && !bad && !freeAt(st, G, st.hole.x, st.hole.y)) bad = { t: st.t, x: st.hole.x, y: st.hole.y, walk: G.walk(st.hole.x, st.hole.y) };
  }
  if (check) assert.equal(bad, null, st.id + ": Gobble's centre stood where it may not (in water, off the ground or inside a wall): " + JSON.stringify(bad));
  return log;
}
// Park Gobble at a spot (and aim him there), as a test fixture.
function park(st, x, y) { const h = st.hole; h.x = h.tx = x; h.y = h.ty = y; h.vx = h.vy = 0; }
function run(st, seconds, aim) {
  const evs = [];
  const n = Math.round(seconds / L.DT);
  for (let i = 0; i < n; i++) {
    if (aim) L.setTarget(st, aim.x, aim.y);
    L.step(st);
    evs.push(...st.events);
    st.events.length = 0;
  }
  return evs;
}
// Put Gobble at the TOP size: big enough for the finale (what a grow to the
// last level does, without playing there).
function makeTop(st) {
  const top = st.levels.R.length - 1;
  st.hole.level = top; st.hole.R = st.hole.r = st.levels.R[top]; st.hole.xp = st.levels.C[top];
  return top;
}
// ...or any level.
function makeLevel(st, lv) { st.hole.level = lv; st.hole.R = st.hole.r = st.levels.R[lv]; st.hole.xp = st.levels.C[lv]; }

test("the data: TWENTY-FOUR places, five tiers each plus a finale, every door, picture, district, track and trail present", () => {
  // The owner doubled the places twice (2026-10-01: six became twelve;
  // 2026-10-06: twelve became twenty-four). A place quietly dropped from the
  // data would leave a door-less hole in the journey ▶ walks through.
  assert.ok(SCENES.length >= 24, "twenty-four places to eat (" + SCENES.length + ")");
  const ids = new Set();
  for (const def of SCENES) {
    const where = def.id;
    assert.ok(!ids.has(def.id), "scene ids are unique: " + def.id);
    ids.add(def.id);
    assert.equal(def.tiers.length, 5, where + " has five size tiers");
    assert.ok(def.finale && def.finale.e && def.finale.r > 0, where + " has a finale");
    assert.ok(def.door && def.name && /^#[0-9a-f]{6}$/i.test(def.color), where + " has a door, a name and a colour");
    assert.ok(Array.isArray(def.backdrop) && def.backdrop.length === 2, where + " has a two-stop backdrop");
    for (let i = 1; i < def.tiers.length; i++) {
      assert.ok(def.tiers[i].r[0] > def.tiers[i - 1].r[1], where + ": tier " + (i + 1) + " is bigger than tier " + i);
    }
    assert.ok(def.finale.r > def.tiers[def.tiers.length - 1].r[1], where + ": the finale is the biggest thing");
    for (const [what, p] of [["the finale's stage", def.finale.at], ["the start", def.start]]) {
      assert.ok(Array.isArray(p) && p[0] > 0 && p[0] < 1 && p[1] > 0 && p[1] < 1, where + ": " + what + " is inside the world");
    }
    // A place may have a world of its own shape (a wide airport, a tall
    // jungle), but never less ground than the default: "make each level even
    // larger" (2026-10-01) — at least twice phase 2's 300 x 420 worlds.
    const { W, H } = L.worldOf(def);
    assert.ok(Number.isFinite(W) && Number.isFinite(H) && W * H >= 2 * 300 * 420 * 0.98, where + ": a big world (" + W + "x" + H + ")");
    const G = L.geomOf(def);   // every shape compiles, and there is ground to stand on
    const items = itemsOf(def);
    // DISTRICTS: every zone an item names exists and has ground to stand on,
    // and every zone is used (a district nothing stands in is a patch of
    // ground that promises a thing and has none) — by an item, or as the
    // ice or a private district
    const zones = def.zones || {};
    for (const it of items) {
      if (!it.zone) continue;
      const Z = G.zone(it.zone);
      assert.ok(Z, where + ": " + it.e + " names a zone that exists (" + it.zone + ")");
      assert.ok(Z.cells.length > 0, where + ": zone " + it.zone + " has ground to stand on");
    }
    const usedZ = new Set(items.map((it) => it.zone).filter(Boolean));
    for (const z of def.private || []) usedZ.add(z);
    if (Array.isArray(def.slide)) for (const z of def.slide) usedZ.add(z);
    for (const z of Object.keys(zones)) assert.ok(usedZ.has(z), where + ": zone " + z + " is used by something");
    // TRACKS: every rider names a track, and every track carries something
    // (a road with no cars on it is a promise the place does not keep)
    const ridden = new Set(items.filter((it) => it.ride).map((it) => it.ride));
    for (const r of ridden) assert.ok(def.tracks && def.tracks[r], where + ": a rider names a track that exists (" + r + ")");
    for (const t of Object.keys(def.tracks || {})) assert.ok(ridden.has(t), where + ": track " + t + " carries something");
    // CLUMPS: a group of 2-5, and a count that comes in whole groups
    for (const it of items) {
      if (!(it.clump > 1)) continue;
      assert.ok(Number.isInteger(it.clump) && it.clump >= 2 && it.clump <= 5, where + ": " + it.e + " clumps in 2s to 5s (" + it.clump + ")");
      assert.equal(it.n % it.clump, 0, where + ": " + it.n + " " + it.e + " come in whole clumps of " + it.clump);
    }
    // TRAILS lead out from the start, each made of a PLAIN tier-1 bite (a
    // spiral has one way out, so one trail; most places have two)
    assert.ok(Array.isArray(def.trails) && def.trails.length >= 1, where + ": a trail of bites leads out from the start");
    for (const tr of def.trails) {
      assert.ok(items.some((it) => it.e === tr.e && plain(it)), where + ": a trail is made of a plain tier-1 bite (" + tr.e + ")");
    }
    // …and there are plain bites for the starters (else the layout places
    // none — Building Site shipped that way, all its tier-1 bites zoned)
    assert.ok(items.some(plain), where + ": there are plain bites for the starters and trails");
    assert.ok(Array.isArray(def.decals) && def.decals.length >= 1, where + ": the ground has a feature to find your way by");
    // KEEP-OUTS: a private zone is a real zone of this place (ground nothing
    // may stand on — lava, the sea, a pond — is a BLOCK)
    for (const z of def.private || []) assert.ok(Array.isArray(zones[z]) && zones[z].length, where + ": private zone " + z + " exists");
    // PORTALS: both ends on ground he can stand on, inside the world
    for (const p of def.portals || []) {
      for (const q of [p.a, p.b]) {
        assert.ok(q[0] > 0 && q[0] < 1 && q[1] > 0 && q[1] < 1, where + ": a portal end is inside the world");
        assert.ok(G.walk(q[0] * W, q[1] * H) <= -RULES.PORTAL_R * 0.5, where + ": a portal end stands on ground (" + q + ")");
      }
    }
    // a place's TUNE (the notes its gulps play, §14.4): real notes
    assert.ok(Array.isArray(def.tune) && def.tune.length >= 4 && def.tune.every((f) => f >= 100 && f <= 2000), where + ": a tune of real notes");
  }
  // every place has its own door picture (two doors wearing one picture is a
  // home screen a non-reader cannot tell apart), its own name and its own
  // finale (the thing the whole place builds to)
  assert.equal(new Set(SCENES.map((d) => d.door)).size, SCENES.length, "every door wears its own picture");
  assert.equal(new Set(SCENES.map((d) => d.name)).size, SCENES.length, "every place has its own name");
  assert.equal(new Set(SCENES.map((d) => d.finale.e)).size, SCENES.length, "every place builds to its own finale");
});

test("each picture belongs to ONE tier in its scene (so a grow's 'now you can eat us!' is true) — the surprises too", () => {
  // The growth meter ends in a PICTURE of the next thing Gobble can eat, and a
  // grow makes the newly edible tier hop. Both lie if one emoji sits in two
  // tiers — a small 🚗 you may eat beside a big 🚗 you may not. (The
  // shop of Shopping Day first had its till trolleys a tier above its aisle
  // trolleys.)
  for (const def of SCENES) {
    const tierOf = new Map();
    const note = (e, tier, what) => {
      const prev = tierOf.get(e);
      assert.ok(prev === undefined || prev === tier, def.id + ": " + e + " is in tier " + prev + " AND tier " + tier + " (" + what + ")");
      tierOf.set(e, tier);
    };
    for (const it of itemsOf(def)) note(it.e, it.tier, "an item");
    for (const k of kidsOf(def)) note(k.e, k.tier, "inside the " + k.box);
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
    // The sports block is NOT all people: 1F3C5-1F3C6 are a medal and a
    // trophy, 1F3C8-1F3C9 two footballs. One coarse range 1F3C2-1F3CC once
    // counted 🏆 and 🏈 as alive (Sports Day caught it); the people in it are
    // the snowboarder, runner and surfer, the rider on a horse, and the
    // swimmer, lifter and golfer.
    [0x1F3C2, 0x1F3C4, "people"], [0x1F3C7, 0x1F3C7, "a rider and a horse"], [0x1F3CA, 0x1F3CC, "people"],
    [0x1F926, 0x1F93E, "people"], [0x1F9CD, 0x1F9DF, "people"],
    [0x1F9B8, 0x1F9B9, "people"], [0x1F385, 0x1F385, "a person"], [0x1F46A, 0x1F46F, "people"],
  ];
  const bad = [];
  for (const def of SCENES) {
    // everything he can eat: the things, the surprises inside them, the
    // trails' bites and the finale (and the door, which wears one of them)
    const pics = [def.door, def.finale.e, ...def.trails.map((t) => t.e), ...itemsOf(def).map((it) => it.e), ...kidsOf(def).map((k) => k.e)];
    for (const e of pics) {
      for (const ch of Array.from(e)) {
        const cp = ch.codePointAt(0);
        const hit = ALIVE.find(([a, b]) => cp >= a && cp <= b);
        if (hit) bad.push(def.id + ": " + e + " (" + hit[2] + ")");
      }
    }
  }
  assert.deepEqual(bad, [], "Gobble must never eat anything alive:\n" + bad.join("\n"));
  // …and the check is not vacuous: it really does catch an animal and a
  // person — and it knows a trophy is a thing, not somebody.
  const alive = (cp) => ALIVE.some(([a, b]) => cp >= a && cp <= b);
  assert.ok(alive(0x1F436), "the scan must know a dog 🐶 is alive");
  for (const cp of [0x1F3C3, 0x1F3C4, 0x1F3C7, 0x1F3CA]) assert.ok(alive(cp), "the scan must know " + String.fromCodePoint(cp) + " is a person");
  for (const cp of [0x1F3C5, 0x1F3C6, 0x1F3C8, 0x1F3C9]) assert.ok(!alive(cp), String.fromCodePoint(cp) + " is a thing, not a person");
});

test("layout: every place fills its world — on ground he can walk, no overlaps, a clear start, nothing squeezed, every thing in its district", () => {
  for (const def of SCENES) {
    const lay = L.layout(def), G = L.geomOf(def);
    const where = def.id;
    const { W, H } = L.worldOf(def);
    assert.deepEqual([lay.W, lay.H], [W, H], where + ": the world is its fixed size — the screen is only a camera onto it");
    assert.equal(lay.relaxed, 0, where + ": every thing found a spot without squeezing");
    assert.equal(lay.zoneMiss, 0, where + ": every zoned thing found a spot in its zone");
    assert.equal(lay.broken, 0, where + ": every clump stood together, every formation on its ground, every surprise by its box");
    assert.equal(lay.objects.length, L.countOf(def), where + ": every thing (and every surprise inside one) is placed");
    // a big world is FULL of things. (Phase 3's rectangles held 360+; a place
    // with water, walls or open sky holds fewer on less ground — the time
    // law in the bot test is what keeps every place a long one.)
    assert.ok(lay.objects.length >= 280, where + ": a big world is full of things (" + lay.objects.length + ")");
    for (const o of lay.objects) {
      if (o.ride) continue;   // a rider is ON its track; the track is a keep-out for everyone else
      // a formation stands exactly where the data says (a gate, a row of
      // dominoes), a starter in its little arc: both on ground; everything
      // else with its whole footprint on ground, EDGE clear of water, walls
      // and the island's edge
      const need = o.finale || o.form || o.starter ? -o.r * 0.6 : -(o.r + RULES.EDGE);
      assert.ok(G.walk(o.x, o.y) <= need + 1e-6, where + ": " + o.e + " stands on ground he can walk (" + G.walk(o.x, o.y).toFixed(2) + " vs " + need.toFixed(2) + ")");
      assert.ok(o.y >= topMin(o.r) - 1e-3 && o.x >= 0 && o.x <= lay.W && o.y <= lay.H, where + ": " + o.e + " is inside the world, its picture on the screen");
      if (!o.starter) {
        assert.ok(L.gdist(o.x, o.y, lay.start.x, lay.start.y) >= RULES.START_CLEAR + o.r - 1e-3, where + ": " + o.e + " keeps clear of Gobble's start");
      }
    }
    const still = lay.objects.filter((o) => !o.ride);
    for (let i = 0; i < still.length; i++) {
      for (let j = i + 1; j < still.length; j++) {
        const p = still[i], q = still[j];
        if (p.form && q.form && p.e === q.e) continue;   // a formation's own members touch (a wall of bricks)
        assert.ok(L.gdist(p.x, p.y, q.x, q.y) >= RULES.SEP * (p.r + q.r) - 1e-3, where + ": " + p.e + " and " + q.e + " overlap");
      }
    }
    // Zoned things stand in their district — checked on the GEOMETRY (the
    // engine's own zone test: a rect, a shape or a stretch of the journey),
    // not on the layout's own counter.
    // (One picture may come in several lines — logs in a clump and one log
    // that is a locked gate — so the count in each district is what is
    // checked: at least as many in it as the lines that put them there.)
    const byPic = new Map();
    for (const it of itemsOf(def)) {
      if (it.ride || it.at) continue;
      if (!byPic.has(it.e)) byPic.set(it.e, []);
      byPic.get(it.e).push(it);
    }
    for (const [e, lines] of byPic) {
      const objs = lay.objects.filter((o) => o.e === e && !o.ride && !o.form && o.par == null);
      for (const z of new Set(lines.map((l) => l.zone).filter(Boolean))) {
        const want = lines.filter((l) => l.zone === z).reduce((s, l) => s + l.n, 0), Z = G.zone(z);
        const inZ = objs.filter((o) => Z.test(o.x, o.y)).length;
        assert.ok(inZ >= want, where + ": " + want + " " + e + " stand in their " + z + " (" + inZ + " do)");
        if (lines.every((l) => l.zone === z)) {
          for (const o of objs) assert.ok(Z.test(o.x, o.y), where + ": " + e + " stands in its " + z + " (at " + o.x.toFixed(1) + "," + o.y.toFixed(1) + ")");
        }
      }
    }
  }
});

test("layout: the finale stands on its stage at the end of the journey, three bites sit right beside Gobble, and TRAILS of bites lead out", () => {
  for (const def of SCENES) {
    const st = L.createGame(def), G = L.geomOf(def);
    const fin = st.objects.find((o) => o.finale);
    const at = def.finale.at;
    assert.ok(Math.abs(fin.x - st.W * at[0]) < 0.01, def.id + ": the finale stands on its stage (x; positions are rounded to 0.001)");
    assert.ok(Math.abs(fin.y - Math.max(st.H * at[1], topMin(fin.r))) < 0.01, def.id + ": …and y");
    assert.ok(G.walk(fin.x, fin.y) <= -fin.r, def.id + ": its whole footprint is on its stage");
    // "far away" is measured by the WALK: at the centre of a spiral or a
    // maze the finale is near the start as the crow flies and a long way
    // round on foot (the old law, "in the far half of the screen", is false
    // for every place whose journey winds)
    assert.ok(G.routeFrac(fin.x, fin.y) >= 0.6, def.id + ": the finale is at the far end of the journey (" + G.routeFrac(fin.x, fin.y).toFixed(2) + ")");
    const starters = st.objects.filter((o) => o.starter);
    assert.equal(starters.length, def.starters, def.id + ": " + def.starters + " starters");
    for (const s of starters) {
      assert.equal(s.tier, 1, def.id + ": a starter is a tier-1 bite");
      assert.ok(L.gdist(s.x, s.y, st.start.x, st.start.y) < 14, def.id + ": a starter sits right beside Gobble");
    }
    // Every trail: bites from a short glide out, each one further along the
    // WALK than the last (round a pond, round a spiral), none skipped,
    // heading where it points.
    let total = 0;
    def.trails.forEach((tr, ti) => {
      const bites = st.objects.filter((o) => o.trail === ti + 1);   // in placement order
      const where = def.id + " trail " + (ti + 1) + " (" + tr.e + ")";
      total += bites.length;
      assert.ok(bites.length >= 4, where + ": at least 4 bites to follow (" + bites.length + ")");
      assert.ok(bites.every((o) => o.e === tr.e && o.tier === 1), where + ": made of its own bite");
      assert.ok(L.gdist(bites[0].x, bites[0].y, st.start.x, st.start.y) < 30, where + ": the first bite is a short glide from the start");
      const along = bites.map((o) => G.routeFrac(o.x, o.y) * G.rdMax);
      for (let i = 1; i < bites.length; i++) {
        assert.ok(along[i] >= along[i - 1] + 4, where + ": bite " + (i + 1) + " is further along the way than bite " + i);
        const gap = Math.hypot(bites[i].x - bites[i - 1].x, bites[i].y - bites[i - 1].y);
        assert.ok(gap <= 1.6 * RULES.TRAIL_STEP, where + ": no bite is skipped (a gap of " + gap.toFixed(1) + ")");
      }
      const to = { x: st.W * tr.to[0], y: st.H * tr.to[1] }, last = bites[bites.length - 1];
      assert.ok(L.gdist(last.x, last.y, to.x, to.y) < L.gdist(st.start.x, st.start.y, to.x, to.y), where + ": it leads toward where it points");
    });
    assert.ok(total >= 8, def.id + ": the trails lay at least 8 bites to follow (" + total + ")");
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
    const want = itemsOf(def).reduce((n, it) => n + (it.clump > 1 ? it.n / it.clump : 0), 0);
    assert.equal(groups.size, want, def.id + ": every clump the data asks for was laid out");
    for (const g of groups.values()) {
      assert.equal(new Set(g.map((o) => o.e)).size, 1, def.id + ": a clump is one kind of thing");
      const k = itemsOf(def).find((it) => it.e === g[0].e && it.clump > 1).clump;
      assert.equal(g.length, k, def.id + ": a clump of " + g[0].e + " has " + k);
      for (const m of g) {
        const link = Math.min(...g.filter((n) => n !== m).map((n) => L.gdist(m.x, m.y, n.x, n.y) / (m.r + n.r)));
        assert.ok(link <= 1.1, def.id + ": " + m.e + " stands with its clump (link " + link.toFixed(3) + ")");
      }
      let spread = 0;
      for (const m of g) for (const n of g) spread = Math.max(spread, L.gdist(m.x, m.y, n.x, n.y) / (m.r + n.r));
      assert.ok(spread <= 1.1 * (k - 1), def.id + ": a clump of " + k + " " + g[0].e + " is one bunch (spread " + spread.toFixed(2) + ")");
    }
  }
});

test("layout: KEEP-OUTS — a private district holds only its own things, and nothing stands on a track, a current, a bridge or a portal", () => {
  // The airport's runways hold only aeroplanes; a train never drives through
  // a house; no sweet floats on the river (unless the river is FOR things); a
  // bridge and a portal's pad stay clear to walk. Checked on the GEOMETRY of
  // the laid-out world, not on the layout's own bookkeeping.
  const seen = { privs: 0, tracks: 0, flows: 0, bridges: 0, portals: 0 };
  const segD = (px, py, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)) : 0;
    return Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t);
  };
  const lineD = (gp, x, y) => {
    if (gp.length === 1) return Math.hypot(x - gp[0][0], y - gp[0][1]);
    let d = Infinity;
    for (let i = 1; i < gp.length; i++) d = Math.min(d, segD(x, y, gp[i - 1], gp[i]));
    return d;
  };
  for (const def of SCENES) {
    const lay = L.layout(def), G = L.geomOf(def);
    const zoneOf = new Map(itemsOf(def).filter((it) => it.zone).map((it) => [it.e, it.zone]));
    for (const z of def.private || []) {
      seen.privs++;
      const Z = G.zone(z);
      const own = lay.objects.filter((o) => !o.finale && zoneOf.get(o.e) === z);
      assert.ok(own.length > 0, def.id + ": the private " + z + " holds its own things");
      const intruders = lay.objects.filter((o) => !o.finale && !o.ride && zoneOf.get(o.e) !== z && Z.test(o.x, o.y));
      assert.deepEqual(intruders.map((o) => o.e + "@" + o.x.toFixed(0) + "," + o.y.toFixed(0)), [], def.id + ": only " + z + " things stand in the " + z);
    }
    // the lines things move along, with how much room each keeps
    const riderR = {};
    for (const o of lay.objects) if (o.ride) riderR[o.ride] = Math.max(riderR[o.ride] || 0, o.r);
    const keeps = [];
    for (const [id, rmax] of Object.entries(riderR)) { keeps.push({ what: "track " + id, gp: G.tracks[id].gp, half: rmax + RULES.KEEP_LANE }); seen.tracks++; }
    for (const f of G.flows) if (!f.things) { keeps.push({ what: "the " + f.look, gp: f.gp, half: f.w / 2 }); seen.flows++; }
    for (const b of G.bridges) { keeps.push({ what: "a bridge", gp: b.gp, half: b.w / 2 + 1 }); seen.bridges++; }
    for (const e of G.ends) { keeps.push({ what: "a portal", gp: [[e.x, e.y / RULES.SQ]], half: RULES.PORTAL_R + 4 }); seen.portals++; }
    for (const o of lay.objects) {
      if (o.ride || o.form || o.starter || o.finale) continue;   // a rider is ON its line; a formation and the starters stand where the data says
      for (const k of keeps) {
        assert.ok(lineD(k.gp, o.x, o.y / RULES.SQ) - k.half >= o.r - 1e-3, def.id + ": " + o.e + " stands clear of " + k.what);
      }
    }
  }
  // not vacuous: the places really have every kind of keep-out
  for (const [k, n] of Object.entries(seen)) assert.ok(n >= 1, "fixture: some place has " + k + " (" + n + ")");
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
  const wins = [];
  let slurps = 0;
  for (const def of SCENES) {
    const st = L.createGame(def);
    // …and every step of the way his centre stands where it may (never
    // in the water, off the island or inside a wall of things)
    const log = playOut(st, 120, true);
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
    wins.push(win.t);
    // the SUPER SLURP (§15.6) in real play: it goes off on the way, never
    // after the win, and none is still running once the place is done
    for (const s of log.filter((e) => e.type === "slurp")) {
      assert.ok(s.t <= win.t, where + ": a super slurp went off after the win (" + s.t.toFixed(2) + "s, the win at " + win.t.toFixed(2) + "s)");
      slurps++;
    }
    assert.equal(st.slurpT, 0, where + ": no super slurp is still running when the place is done");
    // "so they take more time" (the owner, 2026-10-01): even this perfect,
    // greedy eater — far quicker than a four-year-old — needs a while. Phase
    // 2's smaller worlds took it 14-25 game-seconds; the bigger ones 25-45.
    assert.ok(win.t >= 20, where + ": a place takes the bot at least 20s to win (" + win.t.toFixed(1) + "s)");
  }
  const mean = wins.reduce((a, b) => a + b, 0) / wins.length;
  assert.ok(mean >= 30, "on average a place takes the bot at least 30s (phase 2: about 20s) — " + mean.toFixed(1) + "s");
  // measured 61 across the 24 places: a real thing that happens in play,
  // not a fixture-only one
  assert.ok(slurps >= 24, "the bot sets off the super slurp in real play — about two a place (" + slurps + " in " + SCENES.length + " places)");
});

test("the win: the VORTEX empties even a big world by itself — no hunt for the last crumb", () => {
  for (const def of SCENES) {
    const st = L.createGame(def);
    const top = makeTop(st);
    // Start Gobble at the TOP size with every key turned (a lock is a wall
    // until its key is eaten) and send him for the finale — round water and
    // walls, through portals — so most of the world is still standing when
    // it goes down: a vortex with nothing left to slurp would prove nothing.
    for (const o of st.objects) if (o.key) st.unlocked[o.key] = true;
    const fin = st.objects.find((o) => o.finale);
    const evs = [];
    while (!st.won && st.t < 120) {
      // no run of gulps builds on the way: a super slurp would hoover up a
      // swathe of the place first, and this is about the vortex
      st.combo = 0;
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
    assert.equal(st.eaten, st.total, def.id + ": everything is gone — the surprises still in their boxes too");
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


test("THE GOAL: once Gobble is big enough for the finale, it is what he is here for — the hint points at it from anywhere", () => {
  for (const def of SCENES) {
    const st = L.createGame(def);
    const fin = st.objects.find((o) => o.finale);
    assert.equal(fin.id, 0, def.id + ": the finale is placed first, so it is id 0 (the door's ring relies on it)");
    for (let lv = 0; lv < st.levels.R.length - 1; lv++) {
      st.hole.level = lv;
      assert.equal(L.goalOf(st), null, def.id + ": no goal at level " + lv + " — he cannot eat the finale yet");
    }
    makeTop(st);
    // a finale shut away behind a gate makes its KEY the goal first — that
    // has its own test below; here every gate is open
    for (const k of st.objects) if (k.key) { st.unlocked[k.key] = true; k.st = L.GONE; }
    assert.equal(L.goalOf(st), fin, def.id + ": at the top size the finale IS the goal");
    // the hint: stand at the start, where plenty is edible and far nearer
    // than the finale, and wait — the hint points at the finale anyway
    st.hole.x = st.hole.tx = st.start.x; st.hole.y = st.hole.ty = st.start.y;
    const near = L.nearestEdible(st);
    assert.notEqual(near.id, fin.id, def.id + ": fixture — something nearer than the finale is edible");
    st.sinceEat = RULES.HINT_AFTER;
    L.step(st); st.events.length = 0;
    assert.equal(st.hint, fin.id, def.id + ": the hint points at the finale, not at the nearest crumb");
    fin.st = L.GONE;
    assert.equal(L.goalOf(st), null, def.id + ": once it is eaten there is no goal");
  }
});

test("a finale BEHIND A GATE: while the gate is shut the goal is its KEY (the hint, the arrow and the beacon all ask goalOf); eat the key and the finale is the goal", () => {
  // Found by the wandering-child model (§15.1): on the farm the goal pointed
  // at the pumpkin through its locked fence, and from "big enough" to the win
  // took a median 200s, against 3-12s everywhere else. Which gates guard a
  // finale is DERIVED from the walking grid, so a new gated place inherits
  // this without being named here.
  const D = require("../scripts/hole-data.js");
  let guarded = 0;
  for (const def of SCENES) {
    const st = L.createGame(def);
    const fin = st.objects.find((o) => o.finale);
    makeTop(st);
    const keys = st.objects.filter((o) => o.key);
    const g = L.goalOf(st);
    if (!g || g === fin) {
      // no gate in the way: the finale is the goal (and nothing is guarded)
      assert.equal(g, fin, def.id + ": the finale is the goal");
      continue;
    }
    guarded++;
    assert.ok(g.key, def.id + ": a goal that is not the finale must be a key (" + g.e + ")");
    // the hint (which the arrow follows) points at the key, not the finale
    st.hole.x = st.hole.tx = st.start.x; st.hole.y = st.hole.ty = st.start.y;
    st.sinceEat = RULES.HINT_AFTER;
    L.step(st); st.events.length = 0;
    assert.equal(st.hint, g.id, def.id + ": the hint points at the key " + g.e);
    // the key it names must be reachable with every gate shut — a key behind
    // its own gate would make the place unwinnable
    const st2 = L.createGame(def);
    makeTop(st2);
    const key2 = st2.objects[g.id];
    for (let i = 0; i < 2400 && key2.st !== L.GONE; i++) { L.setTarget(st2, key2.x, key2.y); L.step(st2); st2.events.length = 0; }
    assert.equal(key2.st, L.GONE, def.id + ": Gobble can walk to the key " + g.e + " with the gate still shut, and eat it");
    // …and once it is eaten, the finale is the goal again
    assert.equal(L.goalOf(st2), st2.objects[fin.id], def.id + ": with the key eaten the finale is the goal");
    // the line at the ready grow says "find the key", never "now eat" a
    // finale he cannot reach
    assert.ok(D.SAY.readyKey.includes("{finale}") && /key/i.test(D.SAY.readyKey), "the ready line for a gated finale names the key and the finale");
    // a shut gate with its key already gone is open: no stale key goal
    for (const k of keys) { st.unlocked[k.key] = true; k.st = L.GONE; }
    assert.equal(L.goalOf(st), fin, def.id + ": every gate open, the finale is the goal");
  }
  assert.ok(guarded >= 2, "the farm's pumpkin and the castle sit behind locked gates, so at least those two goals must be a KEY first (saw " + guarded + ")");
});

test("the grow that makes him big enough for the finale SAYS so (ready) — exactly one, the last", () => {
  for (const def of SCENES) {
    const log = playOut(L.createGame(def), 120);
    const grows = log.filter((e) => e.type === "grow");
    const ready = grows.filter((g) => g.ready);
    assert.equal(ready.length, 1, def.id + ": exactly one grow is the ready one");
    assert.equal(ready[0], grows[grows.length - 1], def.id + ": …and it is the last grow");
  }
});

test("TREASURES: three things glitter in every place — a tiny one early on the way, a small one halfway, a medium one far along", () => {
  for (const def of SCENES) {
    const st = L.createGame(def), G = L.geomOf(def);
    const where = def.id;
    assert.equal(st.gold.length, 3, where + ": three treasures");
    const g = st.gold.map((id) => st.objects[id]);
    assert.deepEqual(g.map((o) => o.tier), [1, 2, 3], where + ": a tiny one, a small one and a medium one");
    g.forEach((o, i) => {
      // the bands are stretches of the JOURNEY (by walk), so on a spiral or
      // a river "far along" means far to walk, not far down the screen
      const b = L.GOLD_BANDS[i], f = G.routeFrac(o.x, o.y);
      assert.ok(f >= b[0] && f <= b[1], where + ": treasure " + (i + 1) + " is in its stretch of the journey (" + f.toFixed(2) + ")");
      assert.ok(!o.starter && !o.trail && !o.finale && !o.ride && o.par == null && !o.lock && !o.key && !o.solid && !o.kids,
        where + ": a treasure is an ordinary thing — never a starter, a trail bite, the finale, a rider, a key, a gate, a box or what is inside one");
      assert.ok(L.gdist(o.x, o.y, st.start.x, st.start.y) >= 150, where + ": treasure " + (i + 1) + " is far from the start — a thing to FIND");
      // apart from each other (a crescent or a spiral is narrow, so this is
      // looser than "far from the start")
      for (let j = 0; j < i; j++) assert.ok(L.gdist(o.x, o.y, g[j].x, g[j].y) >= 120, where + ": treasures " + (j + 1) + " and " + (i + 1) + " are far apart");
    });
    assert.equal(st.objects.filter((o) => o.gold).length, 3, where + ": exactly the three carry the gold mark");
    // picked FROM the layout, never added to it: the world is exactly what
    // it was, so a saved run keeps its meaning
    const lay = L.layout(def);
    assert.deepEqual(st.objects.map((o) => [o.e, o.x, o.y, o.r]), lay.objects.map((o) => [o.e, o.x, o.y, o.r]), where + ": the treasures change nothing about where things stand");
    assert.deepEqual(L.createGame(def).gold, st.gold, where + ": the same three every time");
    assert.deepEqual(L.restore(L.snapshot(st)).gold, st.gold, where + ": …and after a restore");
  }
});

test("eating a treasure says so (gold); the win's slurp is not finding one (vortex)", () => {
  const st = L.createGame("toyroom");
  const t1 = st.objects[st.gold[0]];
  st.hole.x = st.hole.tx = t1.x + 6; st.hole.y = st.hole.ty = t1.y;
  const evs = [];
  for (let i = 0; i < 240 && t1.st !== L.GONE; i++) { L.setTarget(st, t1.x, t1.y); L.step(st); evs.push(...st.events); st.events.length = 0; }
  const eat = evs.find((e) => e.type === "eat" && e.id === t1.id);
  assert.ok(eat, "the tiny treasure was eaten");
  assert.equal(eat.gold, true, "its eat event carries gold");
  assert.equal(eat.vortex, false, "…and he found it himself");
  assert.ok(evs.filter((e) => e.type === "eat" && e.id !== t1.id).every((e) => e.gold === false), "an ordinary thing is not gold");
  // the finale goes down with the other two treasures still standing: the
  // slurp eats them, and that is not FINDING them
  makeTop(st);
  const fin = st.objects.find((o) => o.finale);
  const all = [];
  while (!st.done && st.t < 200) { if (!st.won) L.setTarget(st, fin.x, fin.y); L.step(st); all.push(...st.events); st.events.length = 0; }
  const late = all.filter((e) => e.type === "eat" && e.gold);
  assert.equal(late.length, 2, "the other two went down in the slurp");
  assert.ok(late.every((e) => e.vortex === true), "…marked vortex, not found");
});

test("countOf: how many things a place holds comes from its DATA alone — exactly what the layout places", () => {
  for (const def of SCENES) assert.equal(L.countOf(def), L.layout(def).objects.length, def.id);
});

test("every finale has a spoken NAME, and no line Gobble says reads a picture aloud", () => {
  const pict = /\p{Extended_Pictographic}/u;
  for (const def of SCENES) {
    const n = def.finale.say;
    assert.ok(typeof n === "string" && /^the [A-Za-z]/.test(n), def.id + ": the finale is named, like 'the castle' (" + n + ")");
    assert.ok(!pict.test(n), def.id + ": its name is words, not a picture");
  }
  assert.ok(DATA.SAY.ready.includes("{finale}"), "the ready line names the finale");
  // every line, however deep it sits (SAY.taste is a table of lines) — a
  // check that met the table itself would test the words "[object Object]"
  let lines = 0;
  const walk = (v, at) => {
    if (typeof v === "string") { lines++; assert.ok(!pict.test(v), at + " speaks words, not a picture: " + v); }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, at + "[" + i + "]"));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, at + "." + k);
    else assert.fail(at + " is not a line: " + v);
  };
  walk(DATA.SAY, "SAY");
  // 32 today; a walk that never went inside a table would reach 17
  assert.ok(lines >= 25, "fixture: the walk reached the lines, nested ones too (" + lines + ")");
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
  assert.ok(typeof snap.f === "string" && snap.f === st.print, "…and carries its layout's fingerprint");
  const back = L.restore(snap);
  assert.equal(back.id, st.id);
  assert.equal(back.eaten, st.objects.filter((o) => o.st === L.GONE).length);
  assert.deepEqual(back.objects.filter((o) => o.st === L.GONE).map((o) => o.id).sort(), [...snap.eaten].sort());
  assert.equal(back.hole.level, st.hole.level, "the same size");
  assert.equal(back.hole.xp, st.hole.xp, "the same xp (re-derived, never stored)");
  assert.ok(Math.abs(back.hole.x - st.hole.x) < 0.01 && Math.abs(back.hole.y - st.hole.y) < 0.01, "Gobble stands where he was");
  playOut(back, 120);
  assert.ok(back.done, "a restored run can still be finished");
  // A run from ANOTHER layout names ids that mean different things here. It
  // is dropped, never guessed at (the ⭐ lives elsewhere in the save).
  const { v, ...phase1 } = snap;
  assert.equal(v, RULES.LAYOUT);
  assert.equal(L.restore(phase1), null, "a save with no layout version (phase 1) is dropped");
  assert.equal(L.restore({ ...snap, v: RULES.LAYOUT + 1 }), null, "…and so is one from any other layout");
  // phase 2 was layout 2, phase 3's bigger worlds layout 3; the shaped
  // places of phase 4 are layout 4 (a phase-3 run of the Building Site names
  // ids laid out on a plain rectangle)
  assert.equal(RULES.LAYOUT, 4, "fixture: the shaped places are layout 4");
  for (const old of [2, 3]) assert.equal(L.restore({ ...snap, v: old }), null, "…and so is one from layout " + old);
  assert.equal(L.restore({ ...snap, v: String(RULES.LAYOUT) }), null, "…and a version must be the number itself");
});

// Every place's layout FINGERPRINT at layout 4, when runs began to carry
// one. A run saved before that has no `f`, and is trusted for a place whose
// layout is still this one; a place laid out again since must be listed in
// RULES.RELAID, or its old runs would name different things.
const LAYOUT4 = {
  toyroom: "1947k3a", picnic: "1g4vkq1", farm: "13blerv", build: "ywvw66", town: "17yvt8h", sports: "v53ml2",
  party: "f6dnu", beach: "jt44zz", volcano: "1jc48z9", snow: "1envzaw", airport: "1491zr1", space: "n3kc7a",
  market: "faztxz", maze: "n0qcoy", cave: "118mqfl", castle: "2bnkqq", factory: "1l7a1tb", circus: "17vc6ur",
  jungle: "zlixaj", cloud: "1pd56ev", pirate: "uv2cyg", themepark: "1k92zh0", candy: "1oadlp4", music: "fcwsf7",
};

test("a run carries its layout's FINGERPRINT: edit ONE place and only that place's half-eaten run is dropped — never re-pointed at different things", () => {
  // An id means "the n-th thing this layout placed". Measured before this
  // law: one sweet added to the Toy Room re-pointed 24 of a 64-bite run's
  // ids at other pictures and handed Gobble a level he never earned, while
  // the save's version still matched. Bumping the version instead would
  // have dropped the half-eaten runs of EVERY place.
  const at = SCENES.findIndex((d) => d.id === "toyroom");
  const orig = SCENES[at];
  const st = L.createGame(orig);
  playOut(st, 6);
  assert.ok(st.eaten >= 6, "fixture: the run has eaten a few things (" + st.eaten + ")");
  const snap = JSON.parse(JSON.stringify(L.snapshot(st)));
  const other = JSON.parse(JSON.stringify(L.snapshot(L.createGame("picnic"))));
  // the same place, edited: one more sweet among its tier-1 things
  const edited = JSON.parse(JSON.stringify(orig));
  edited.tiers[0].items[0][1] += 1;
  SCENES[at] = edited;
  try {
    assert.notEqual(L.createGame(edited).print, st.print, "fixture: the edit really moved the layout");
    assert.equal(L.restore(snap), null, "a run from before the edit is dropped, not re-pointed");
    assert.ok(L.restore(other), "…while every OTHER place's run still restores");
    const fresh = L.createGame(edited);
    playOut(fresh, 4);
    assert.ok(L.restore(JSON.parse(JSON.stringify(L.snapshot(fresh)))), "a run played on the edited layout restores");
  } finally { SCENES[at] = orig; }
  assert.ok(L.restore(snap), "back on its own layout, the run restores");
  // a hostile fingerprint never passes
  for (const f of [7, null, "", "nope", { x: 1 }]) assert.equal(L.restore({ ...snap, f }), null, "a fingerprint of " + JSON.stringify(f) + " is dropped");
  // a run saved before fingerprints (no `f`) is trusted… unless its place
  // has been laid out again since
  const { f, ...legacy } = snap;
  assert.ok(f, "fixture: the run had a fingerprint");
  assert.ok(L.restore(legacy), "a run from before fingerprints restores on an unchanged place");
  RULES.RELAID.push("toyroom");
  try { assert.equal(L.restore(legacy), null, "…and is dropped once its place is listed as laid out again"); }
  finally { RULES.RELAID.pop(); }
});

test("RELAID is exact: a place whose layout changed since layout 4 is listed (or its old runs would re-point), and no listed place is unchanged", () => {
  assert.ok(Array.isArray(RULES.RELAID), "RULES.RELAID is a list");
  for (const id of RULES.RELAID) assert.ok(LAYOUT4[id], id + " is listed as laid out again, but no such place existed at layout 4");
  for (const [id, print] of Object.entries(LAYOUT4)) {
    assert.ok(L.sceneById(id), id + " existed at layout 4 and must still exist (a removed place strands its runs)");
    const now = L.createGame(id).print;
    if (now !== print) assert.ok(RULES.RELAID.includes(id), id + "'s layout changed since layout 4 (" + print + " -> " + now + "): list it in RULES.RELAID, or a run saved before fingerprints re-points at different things");
    else assert.ok(!RULES.RELAID.includes(id), id + " is listed in RULES.RELAID but its layout is unchanged — its players would lose a half-eaten run for nothing");
  }
});

test("restore RE-DERIVES what the gulps did: keys turned, boxes popped, trees shaken — never stored, never trusted", () => {
  // A save stores only WHICH things were eaten; what eating them DID is
  // worked out again, so a door eaten-open stays open and a box's sweets
  // stay out after a restore — and a hand-edited save cannot open a door.
  const farm = L.createGame("farm");
  const key = farm.objects.find((o) => o.key);
  const back = L.restore({ v: RULES.LAYOUT, scene: "farm", eaten: [key.id] });
  assert.ok(back.unlocked[key.key], "the key was eaten, so its door is open");
  const gate = back.objects.find((o) => o.lock === key.key);
  assert.ok(!L.activeSolid(back, gate), "…and the gate is no longer a wall");
  assert.ok(!L.restore({ v: RULES.LAYOUT, scene: "farm", eaten: [] }).unlocked[key.key], "an untouched farm's gate is locked");
  // a box (party piñatas, factory parcels): eaten → its surprises are out
  for (const id of ["party", "factory", "pirate"]) {
    const fresh = L.createGame(id);
    const box = fresh.objects.find((o) => o.box === "pop");
    assert.ok(box, "fixture: " + id + " has a box");
    assert.ok(box.kids.every((k) => fresh.objects[k].st === L.HIDDEN), id + ": the surprises start hidden");
    const b2 = L.restore({ v: RULES.LAYOUT, scene: id, eaten: [box.id] });
    assert.ok(box.kids.every((k) => b2.objects[k].st === L.IDLE), id + ": after a restore with the box eaten, its surprises are out");
  }
  // a tree (the picnic's): one of its fruit eaten means it WAS shaken
  const pic = L.createGame("picnic");
  const tree = pic.objects.find((o) => o.box === "shake");
  assert.ok(tree, "fixture: the picnic has a fruit tree");
  const b3 = L.restore({ v: RULES.LAYOUT, scene: "picnic", eaten: [tree.kids[0]] });
  assert.ok(b3.objects[tree.id].shook, "a fruit eaten means its tree was shaken");
  assert.ok(tree.kids.slice(1).every((k) => b3.objects[k].st === L.IDLE), "…so the rest of its fruit is out");
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

test("every place DRESSES Gobble (§15.2): what it wears is drawn, and every kind the renderer can draw is worn somewhere", () => {
  // A wear kind with no drawing would leave Gobble bare in that place with
  // nothing going red (the bedroom's `carpet` class); a drawing nobody wears
  // is dead code a test still has to carry.
  const HR = require("../scripts/hole-render.js");
  const hex = /^#[0-9a-f]{6}$/i;
  const worn = new Set();
  for (const def of SCENES) {
    assert.ok(Array.isArray(def.wear) && def.wear.length >= 2 && def.wear.length <= 3, def.id + ": wear is [kind, colour, colour2?]");
    const W = HR.WEAR[def.wear[0]];
    assert.ok(W && typeof W.draw === "function" && typeof W.up === "function", def.id + ": wear '" + def.wear[0] + "' has a drawing");
    assert.ok(W.slot === "top" || W.slot === "side", def.id + ": '" + def.wear[0] + "' sits on his head or at his side");
    for (const c of def.wear.slice(1)) assert.ok(hex.test(c), def.id + ": wear colour '" + c + "' is #rrggbb");
    worn.add(def.wear[0]);
  }
  for (const k of Object.keys(HR.WEAR)) assert.ok(worn.has(k), "wear kind '" + k + "' is worn in no place");
  assert.ok(worn.size >= 15, "the places dress him in many different things, not a few (" + worn.size + ")");
  // the headroom the camera keeps covers whatever he wears, at every size
  for (const def of SCENES) {
    for (const R of [12, 40, 90, 160]) {
      const e = HR.eyeR(R) * HR.EYE.wide, line = R * DATA.RULES.SQ + HR.eyeR(R) * 0.25;
      const W = HR.WEAR[def.wear[0]];
      assert.ok(HR.faceUp(R, false, def.wear) >= line + W.up(e, R * 0.42) - 1e-9, def.id + " R=" + R + ": the camera's headroom covers its " + def.wear[0]);
    }
  }
});

test("every place has WEATHER (§15.4): its air is drawn, every kind the renderer can draw blows somewhere, a dark place's is drawn after the dark, and the finale's fireworks all burst before the win box comes up", () => {
  // The same both-ways law as what Gobble wears: a kind with no drawing would
  // leave a place still; a drawing no place uses is dead code a test carries.
  const HR = require("../scripts/hole-render.js");
  const hex = /^#[0-9a-f]{6}$/i;
  const used = new Set();
  for (const def of SCENES) {
    assert.ok(Array.isArray(def.air) && def.air.length >= 1 && def.air.length <= 2, def.id + ": air is [kind, colour?]");
    const A = HR.AIR[def.air[0]];
    assert.ok(A && typeof A.draw === "function", def.id + ": air '" + def.air[0] + "' has a drawing");
    assert.ok(A.n > 0 && A.size > 0, def.id + ": its " + def.air[0] + " has specks and a size");
    if (def.air[1]) {
      assert.ok(hex.test(def.air[1]), def.id + ": air colour '" + def.air[1] + "' is #rrggbb");
      // confetti and sprinkles bring their own colours: a colour given to them is never used
      assert.ok(A.col !== null, def.id + ": '" + def.air[0] + "' brings its own colours, so the colour given to it is dead data");
    }
    used.add(def.air[0]);
  }
  for (const k of Object.keys(HR.AIR)) assert.ok(used.has(k), "air kind '" + k + "' blows in no place");
  assert.ok(used.size >= 12, "the places have many different weathers, not a few (" + used.size + ")");
  // a dark place's weather is drawn AFTER the dark, so fireflies glow in it
  // rather than under it (read from the frame's own drawing order)
  const src = fs.readFileSync(path.join(__dirname, "../scripts/hole-render.js"), "utf8");
  const dark = src.indexOf("\n      drawDark();\n"), air = src.indexOf("\n      drawAir(now);\n");
  assert.ok(dark > 0 && air > 0, "fixture: the frame draws the dark and the air");
  assert.ok(air > dark, "the air is drawn after the dark");
  assert.ok(SCENES.some((d) => d.dark), "fixture: there is a dark place");
  for (const d of SCENES.filter((x) => x.dark)) assert.equal(d.air[0], "fireflies", d.id + ": a dark place's air glows (fireflies)");
  // the finale's fireworks: six, and every one bursts within 2s of the win —
  // the win box comes up soon after and covers the field
  const F = HR.FIREWORKS;
  assert.equal(F.at.length, 6, "six fireworks");
  assert.ok(F.at.every((t, i) => i === 0 || t > F.at[i - 1]), "launched one after another");
  assert.ok(Math.max(...F.at) + F.rise <= 2, "the last bursts within 2s of the win (" + (Math.max(...F.at) + F.rise) + "s)");
});

test("TASTES (§15.3): a thing with a taste SOUNDS, LOOKS and is NAMED like itself — every family has all three, every picture listed is one he can really eat, and none is listed twice", () => {
  // A family with no sound would gulp like anything else; one with no look
  // would vanish with the sound off (and Josh plays with it off); a picture
  // listed that no place serves is dead data, and a picture written a hair
  // differently from the place's own (a missing U+FE0F) would never taste of
  // anything at all, silently. So all of it is derived, both ways.
  const HR = require("../scripts/hole-render.js");
  const T = DATA.TASTES, fams = Object.keys(T).sort();
  assert.ok(fams.length >= 10, "fixture: the families were found (" + fams.length + ")");
  // the page's sounds are a table in hole-main.js (a page script — the
  // browser test drives them through the real drain)
  const main = fs.readFileSync(path.join(__dirname, "../scripts/hole-main.js"), "utf8");
  const at = main.indexOf("const TASTE_SFX = {");
  assert.ok(at > 0, "fixture: the page has its taste sounds");
  const sfx = [...main.slice(at, main.indexOf("\n  };", at)).matchAll(/^ {4}(\w+): \(k\) =>/gm)].map((m) => m[1]).sort();
  assert.deepEqual(sfx, fams, "every family has its own SOUND, and every sound a family");
  assert.deepEqual(Object.keys(HR.TASTE_LOOK).sort(), fams, "every family has its own LOOK, and every look a family");
  assert.deepEqual(Object.keys(DATA.SAY.taste).sort(), fams, "every family has its first-time WORD, and every word a family");
  for (const f of fams) {
    const look = HR.TASTE_LOOK[f];
    assert.ok(look.face || look.fx || look.boing, f + ": its look shows something (a face, a burst or a boing)");
    if (look.col) assert.ok(/^#[0-9a-f]{6}$/i.test(look.col), f + ": its colour is #rrggbb");
  }
  // no two families sound alike (a sound is its table entry's text)
  const bodies = new Map();
  for (const m of main.slice(at, main.indexOf("\n  };", at)).matchAll(/^ {4}(\w+): \(k\) => (.*)$/gm)) {
    const body = m[2].replace(/\s*\/\/.*$/, "");
    assert.ok(!bodies.has(body), m[1] + " sounds exactly like " + bodies.get(body));
    bodies.set(body, m[1]);
  }
  // every picture is in ONE family
  const fam = new Map();
  for (const [f, list] of Object.entries(T)) {
    for (const e of list) { assert.ok(!fam.has(e), e + " tastes of both " + fam.get(e) + " and " + f); fam.set(e, f); }
  }
  // …and is something a place really serves (its own things, the surprises
  // in its boxes and trees). Four are also some place's FINALE (🍭 🎂 🤖 🧸):
  // there the finale's own gulp wins, which the browser test drives.
  const served = new Set();
  for (const def of SCENES) {
    for (const it of itemsOf(def)) served.add(it.e);
    for (const k of kidsOf(def)) served.add(k.e);
  }
  for (const [e, f] of fam) {
    assert.ok(served.has(e), f + ": " + e + " is listed but no place serves it (dead data — or written differently from the place's own)");
    assert.equal(DATA.tasteOf(e), f, "tasteOf(" + e + ") is its family");
  }
  // a thing a place serves that differs from a listed picture only by its
  // emoji-presentation mark would never taste of anything — say so
  const bare = (e) => e.replace(/️/g, "");
  const byBare = new Map([...fam.keys()].map((e) => [bare(e), e]));
  for (const e of served) {
    const twin = byBare.get(bare(e));
    if (twin) assert.equal(e, twin, "a place serves " + JSON.stringify(e) + " but TASTES lists " + JSON.stringify(twin) + " — it would never taste of " + fam.get(twin));
  }
  // tasteless things gulp as before
  const plainOne = [...served].find((e) => !fam.has(e));
  assert.ok(plainOne && DATA.tasteOf(plainOne) === null, "a thing with no taste has none (" + plainOne + ")");
  // tastes are COMMON: most places serve several families, and every place at least one
  let many = 0;
  for (const def of SCENES) {
    const here = new Set([...itemsOf(def), ...kidsOf(def)].map((it) => DATA.tasteOf(it.e)).filter(Boolean));
    assert.ok(here.size >= 1, def.id + ": nothing here tastes of anything");
    if (here.size >= 3) many++;
  }
  assert.ok(many >= SCENES.length / 2, "most places serve three families or more (" + many + " of " + SCENES.length + ")");
});

test("every field a place DECLARES is read by the code, and every field the code reads off a place is declared by one — no dead data, no dead feature", () => {
  // Two fields died in phase 4 with every test green: lava and the sea became
  // BLOCKS, which left the engine still reading `avoid` (rects nothing stands
  // in) and `holes` (voids cut out of the island) that no place declared any
  // more — code no test could reach, guarded by loops over nothing. The other
  // way round is the older, quieter defect: a field a place declares that
  // nothing reads (a typo — `brigdes`) does nothing at all, silently. Derived
  // both ways from the sources, comments stripped (a sentence ABOUT a field
  // is not a read of it).
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const src = ["hole-logic.js", "hole-render.js", "hole-main.js"]
    .map((f) => strip(fs.readFileSync(path.join(__dirname, "../scripts/" + f), "utf8"))).join("\n");
  const readOffPlace = new Set([...src.matchAll(/\bdef\.(\w+)/g)].map((m) => m[1]));
  const declared = new Set();
  for (const def of SCENES) for (const k of Object.keys(def)) declared.add(k);
  assert.ok(readOffPlace.size >= 15 && declared.size >= 15, "fixture: the scan found the fields (" + readOffPlace.size + " read, " + declared.size + " declared)");
  for (const k of readOffPlace) {
    assert.ok(declared.has(k), "the code reads `def." + k + "` but no place declares it — a feature nothing can reach (delete it, or give a place one)");
  }
  for (const k of declared) {
    assert.ok(new RegExp("\\." + k + "\\b").test(src), "places declare `" + k + "` but nothing in the game reads it");
  }
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

// ---- phase 4 (§14): SHAPES, CHALLENGES, and the rules of where he can go ----

// The CHALLENGE of a place: the set of mechanics it uses, read off its data.
function twistsOf(def) {
  const t = new Set();
  for (const b of def.blocks || []) t.add("block:" + (b.look || "water"));
  if ((def.bridges || []).length) t.add("bridges");
  if ((def.portals || []).length) t.add("portals");
  for (const f of def.flows || []) t.add("flow:" + (f.look || "river"));
  if (def.slide) t.add("ice");
  if (def.dark) t.add("dark");
  if (def.notes) t.add("notes");
  for (const z of Object.values(def.zones || {})) {
    const parts = Array.isArray(z) && typeof z[0] !== "number" ? z : [z];
    if (parts.some((p) => p && p.band)) t.add("bands");
  }
  for (const tr of Object.values(def.tracks || {})) t.add("track:" + (tr.orbit ? "orbit" : tr.train ? "train" : tr.loop ? "loop" : "line"));
  for (const it of itemsOf(def)) for (const k of ["ride", "at", "solid", "lock", "key", "pop", "shake", "chain"]) if (it[k]) t.add(k);
  return t;
}
// The SHAPE of a place: where he can walk, on a 32 x 32 grid over its world.
function maskOf(def) {
  const G = L.geomOf(def), M = 32, m = new Uint8Array(M * M);
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) m[j * M + i] = G.walk(((i + 0.5) / M) * G.W, ((j + 0.5) / M) * G.H) <= 0 ? 1 : 0;
  return { m, aspect: G.W / G.H };
}
// Two places are a RESKIN of each other when their ground is the same shape
// (on the same kind of world) AND their challenge is all but the same.
function reskin(a, b) {
  let i = 0, u = 0;
  for (let k = 0; k < a.mask.m.length; k++) { if (a.mask.m[k] && b.mask.m[k]) i++; if (a.mask.m[k] || b.mask.m[k]) u++; }
  const iou = i / u, asp = Math.max(a.mask.aspect / b.mask.aspect, b.mask.aspect / a.mask.aspect);
  let diff = 0;
  for (const x of a.tw) if (!b.tw.has(x)) diff++;
  for (const x of b.tw) if (!a.tw.has(x)) diff++;
  return { same: iou >= 0.9 && asp < 1.15 && diff < 2, iou, asp, diff };
}

test("every EVENT the engine can emit reaches the page: a sound for each (or a stated reason it has none)", () => {
  // A new mechanic speaks to the page through an event; an event the page
  // never listens for is a challenge that happens in silence (the fort found
  // two of those by diffing its emit list against its dispatcher). Derived
  // from the sources: every `emit(st, { type: "x"` and every kind reveal()
  // is called with, against every `ev.type === "x"` in hole-main's drain.
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const logic = strip(fs.readFileSync(path.join(__dirname, "../scripts/hole-logic.js"), "utf8"));
  const main = strip(fs.readFileSync(path.join(__dirname, "../scripts/hole-main.js"), "utf8"));
  const emitted = new Set([
    ...[...logic.matchAll(/emit\(st, \{ type: "(\w+)"/g)].map((m) => m[1]),
    ...[...logic.matchAll(/reveal\(st, [^,]+, "(\w+)"\)/g)].map((m) => m[1]),
  ]);
  const at = main.indexOf("function drain(");
  assert.ok(at > 0, "fixture: the page has its drain");
  const drain = main.slice(at, main.indexOf("\n  }\n", at));
  const heard = new Set([...drain.matchAll(/ev\.type === "(\w+)"/g)].map((m) => m[1]));
  // the gulp sounds on `eat`, a moment after the fall begins — a sound at the
  // fall as well would double every gulp
  const SILENT = { fall: "the gulp sounds on eat" };
  assert.ok(emitted.size >= 10, "fixture: the engine's events were found (" + [...emitted] + ")");
  for (const t of emitted) assert.ok(heard.has(t) || SILENT[t], "the engine emits '" + t + "' and the page never listens for it");
  for (const t of Object.keys(SILENT)) assert.ok(emitted.has(t), "'" + t + "' is excused but the engine no longer emits it");
});

test("NO PLACE IS A RESKIN: every place has a challenge of its own, and no two share both a shape and a challenge", () => {
  // The owner (2026-10-06): "make sure the setup of objects varies per
  // level significantly. i dont want each level to just a copy with a
  // different skin. the layout and shape of the level and challenge should
  // feel different". So: every place has a twist; no two places have the
  // same set of twists; and for every PAIR, their ground differs (the
  // walkable shape, or the world's own proportions) or their challenge
  // differs by at least two mechanics.
  const dna = SCENES.map((def) => ({ id: def.id, tw: twistsOf(def), mask: maskOf(def) }));
  for (const d of dna) assert.ok(d.tw.size >= 1, d.id + ": a place has a challenge of its own");
  const sig = new Map();
  for (const d of dna) {
    const k = [...d.tw].sort().join("|");
    assert.ok(!sig.has(k), d.id + " and " + sig.get(k) + " pose the very same challenge (" + k + ")");
    sig.set(k, d.id);
  }
  for (let x = 0; x < dna.length; x++) {
    for (let y = x + 1; y < dna.length; y++) {
      const r = reskin(dna[x], dna[y]);
      assert.ok(!r.same, dna[x].id + " and " + dna[y].id + " are a reskin: the same ground (" + r.iou.toFixed(2) + ") and nearly the same challenge (" + r.diff + " apart)");
    }
  }
  // not vacuous: the measure does call a place a reskin of itself, and of a
  // copy with one mechanic more
  const toy = dna.find((d) => d.id === "toyroom");
  assert.ok(reskin(toy, toy).same, "fixture: a place is a reskin of itself");
  assert.ok(reskin(toy, { ...toy, tw: new Set([...toy.tw, "dark"]) }).same, "fixture: …and of itself with one mechanic more");
  // and the places really do spread over the shapes: there is more than one
  // kind of ground (a heart, a spiral, islands …), not a dozen rectangles
  const shapes = [];
  for (const d of dna) if (!shapes.some((s) => reskin({ ...s, tw: d.tw }, d).same)) shapes.push(d);
  assert.ok(shapes.length >= 15, "at least 15 different shapes of ground among the places (" + shapes.length + ")");
});

test("PROGRESS: at every size there is at least TWICE the next grow's worth he can reach and eat — round every wall still too big, behind no door still locked — and the finale can be reached", () => {
  // The old law ("at most half of everything edible") counts things across
  // the moat as if he could walk to them. This one walks: the engine's own
  // progressOf floods the ground from the start with every wall of things
  // too big for him still standing, turns a key only when he can reach it,
  // and counts what he can reach and eat.
  for (const def of SCENES) {
    const p = L.progressOf(def);
    for (const lv of p.levels) {
      if (lv.need == null) continue;
      assert.ok(lv.avail >= 2 * lv.need, def.id + ": at level " + lv.level + " there is " + lv.avail + " to reach and eat for a grow that needs " + lv.need);
    }
    assert.ok(p.finale, def.id + ": at the top size the finale can be reached");
    const locks = [...new Set(itemsOf(def).filter((it) => it.lock).map((it) => it.lock))].sort();
    const keys = [...new Set(itemsOf(def).filter((it) => it.key).map((it) => it.key))].sort();
    assert.deepEqual(keys, locks, def.id + ": every lock has its key and every key its lock");
    for (const k of locks) assert.ok(p.unlocked.includes(k), def.id + ": the key to " + k + " can be reached and eaten");
  }
});

test("every GATE shuts: a wall of things too big to eat, or a locked door, closes its gap — Gobble's centre cannot squeeze past", () => {
  // Only Gobble's CENTRE meets a wall (his mouth slides over a fence), so a
  // gate's things must cover their whole gap with their cores. The Sunny
  // Farm's locked log stood in a gap 16.7 units wide with a 13.4 core, and he
  // could walk past the gate without the key. Measured on the GEOMETRY: a
  // window round each gate sampled finely, the free ground in it (on ground
  // he can walk, outside the gate's cores) split into pieces — with the gate
  // standing, the ground it guards must be a different piece from the ground
  // he comes from; with it eaten, one.
  const sides = (G, g, up, box) => {
    const res = 0.25, [x0, y0, x1, y1] = box;
    const nx = Math.ceil((x1 - x0) / res) + 1, ny = Math.ceil((y1 - y0) / res) + 1;
    const free = new Uint8Array(nx * ny), core = new Uint8Array(nx * ny), lab = new Int32Array(nx * ny).fill(-1);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const x = x0 + i * res, y = y0 + j * res, k = j * nx + i;
        if (G.walk(x, y) > 0) continue;
        const inCore = g.some((o) => L.gdist(x, y, o.x, o.y) < o.r * RULES.CORE);
        core[k] = inCore ? 1 : 0;
        free[k] = up && inCore ? 0 : 1;
      }
    }
    const q = new Int32Array(nx * ny);
    let n = 0;
    for (let s = 0; s < nx * ny; s++) {
      if (!free[s] || lab[s] >= 0) continue;
      let h = 0, t = 0;
      q[t++] = s; lab[s] = n;
      while (h < t) {
        const k = q[h++], i = k % nx, j = (k / nx) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
          const m = jj * nx + ii;
          if (free[m] && lab[m] < 0) { lab[m] = n; q[t++] = m; }
        }
      }
      n++;
    }
    // the pieces that reach the window's edge (the ways in and out) AND
    // touch the gate (the ground it guards, and the ground he comes from)
    const edge = new Set(), touch = new Set();
    for (let k = 0; k < nx * ny; k++) {
      if (lab[k] < 0) continue;
      const i = k % nx, j = (k / nx) | 0;
      if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) edge.add(lab[k]);
      if (!core[k]) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < nx && jj < ny && core[jj * nx + ii]) { touch.add(lab[k]); break; }
      }
    }
    return [...touch].filter((p) => edge.has(p)).length;
  };
  let gates = 0;
  for (const def of SCENES) {
    const st = L.createGame(def), G = L.geomOf(def);
    // a gate is a formation of wall things: the same picture, standing close
    const groups = [];
    for (const o of st.objects.filter((ob) => ob.solid || ob.lock)) {
      let g = groups.find((gr) => gr.some((m) => m.e === o.e && L.gdist(m.x, m.y, o.x, o.y) < 3 * (m.r + o.r)));
      if (!g) groups.push((g = []));
      g.push(o);
    }
    for (const g of groups) {
      gates++;
      const pad = 30, box = [Math.min(...g.map((o) => o.x)) - pad, Math.min(...g.map((o) => o.y)) - pad, Math.max(...g.map((o) => o.x)) + pad, Math.max(...g.map((o) => o.y)) + pad];
      const up = sides(G, g, true, box), gone = sides(G, g, false, box);
      assert.ok(up >= 2, def.id + ": the " + g[0].e + " gate shuts its gap (" + up + " side(s) with it standing — it leaks)");
      assert.equal(gone, 1, def.id + ": with the " + g[0].e + " gate eaten, the way is open (" + gone + ")");
    }
  }
  assert.ok(gates >= 5, "fixture: the places have gates to shut (" + gates + ")");
});

test("OUTLINES: every edge the renderer draws — the island's, the water's, the walls' — is a CLOSED ring, never a scrap", () => {
  // The picture's edge and the walking edge are one line: marching squares
  // over the place's own fields. A shape still INSIDE at the edge of the
  // sampled grid (a lava river running to the coast) left an open chain, and
  // tracing it from its middle split it into scraps: the Volcano Island's
  // rivers drew as a row of little bits and its crater filled in.
  const area = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };
  const gap = (P) => Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]);
  let n = 0;
  for (const def of SCENES) {
    const O = L.outlineOf(def);
    assert.ok(O.land.length >= 1, def.id + ": the island has an outline");
    for (const [what, rings] of [["the island", O.land], ...Object.entries(O.blocks)]) {
      for (const R of rings) {
        n++;
        assert.ok(R.length >= 3 && gap(R) <= 3 * RULES.FIELD, def.id + ": a ring of " + what + " closes (" + gap(R).toFixed(1) + " from its end to its start)");
        assert.ok(area(R) >= 6, def.id + ": a ring of " + what + " is a shape, not a scrap (area " + area(R).toFixed(1) + ")");
      }
    }
  }
  assert.ok(n >= 40, "fixture: the places have outlines (" + n + ")");
  // a wall's outline is only drawn where it stands ON the island: a fence
  // that runs off the edge (the farm's do) stops at the coast, never draws
  // over the sea
  let off = 0, pts = 0;
  for (const def of SCENES) {
    const G = L.geomOf(def), O = L.outlineOf(def);
    for (const rings of Object.values(O.blocks)) for (const R of rings) for (const p of R) {
      pts++;
      if (G.isl(p[0], p[1]) > RULES.FIELD) off++;
    }
  }
  assert.ok(pts >= 200, "fixture: the places have walls to outline (" + pts + " points)");
  assert.equal(off, 0, "every wall's outline lies on the island (" + off + " of " + pts + " points stand off it)");
  // the bug itself, in miniature: a band of field INSIDE along the grid's
  // left edge is one closed ring round the band
  const nx = 20, ny = 12, F = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[j * nx + i] = i < 6 ? -1 : 1;
  const rings = L.contours(F, nx, ny, 0, 0, 1);
  assert.equal(rings.length, 1, "one shape, one ring (" + rings.length + ")");
  assert.ok(gap(rings[0]) <= 2, "…and it closes (" + gap(rings[0]).toFixed(2) + ")");
  assert.ok(Math.abs(area(rings[0]) - 5.5 * 11) < 1, "…round the whole band (area " + area(rings[0]).toFixed(2) + ", want 60.5)");
});

test("the SEGMENT INDEX is exact where it matters: within reach it is the true distance to the nearest line, beyond it never less than the reach", () => {
  // Lines (a hedge ring, a spiral path, a lava river, the layout's keep-outs)
  // are measured through an index that only looks at the segments near a
  // point — a speed-up that must not change one answer that matters.
  const segD = (x, y, g) => {
    const dx = g.bx - g.ax, dy = g.by - g.ay, l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - g.ax) * dx + (y - g.ay) * dy) / l2)) : 0;
    return Math.hypot(x - g.ax - dx * t, y - g.ay - dy * t) - g.half;
  };
  const r = L.rng(L.hashStr("segindex"));
  let near = 0, far = 0;
  for (let trial = 0; trial < 40; trial++) {
    const pts = [];
    const n = 1 + Math.floor(r() * 9);
    for (let i = 0; i < n; i++) pts.push([r() * 300, r() * 300]);
    const segs = L.segsOf(pts, 1 + r() * 20);
    const f = L.segIndex(segs, L.SHAPE_CAP);
    for (let k = 0; k < 300; k++) {
      const x = r() * 420 - 60, y = r() * 420 - 60;
      const brute = Math.min(...segs.map((g) => segD(x, y, g)));
      const v = f(x, y);
      if (brute < L.SHAPE_CAP) { near++; assert.ok(Math.abs(v - brute) < 1e-9, "within reach the index is exact (" + v + " vs " + brute + ")"); }
      else { far++; assert.ok(v >= L.SHAPE_CAP - 1e-9, "beyond reach the index never says nearer (" + v + ")"); }
    }
  }
  assert.ok(near > 2000 && far > 500, "fixture: points both near and far were tried (" + near + " / " + far + ")");
});

test("RIDERS ride their tracks — a train keeps its row, a lane goes there and back — and one the magnet catches leaves its track and is eaten", () => {
  const st = L.createGame("toyroom"), G = L.geomOf("toyroom");
  const cars = st.objects.filter((o) => o.ride);
  assert.ok(cars.length >= 3 && G.tracks[cars[0].ride].train, "fixture: the toy train has cars");
  const T = G.tracks[cars[0].ride];
  const onTrack = (o) => {
    let d = Infinity;
    for (let i = 1; i < T.gp.length; i++) {
      const a = T.gp[i - 1], b = T.gp[i], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((o.x - a[0]) * dx + (o.y / RULES.SQ - a[1]) * dy) / l2)) : 0;
      d = Math.min(d, Math.hypot(o.x - a[0] - dx * t, o.y / RULES.SQ - a[1] - dy * t));
    }
    return d;
  };
  const before = cars.map((o) => [o.x, o.y]);
  for (let s = 0; s < 4; s++) {
    run(st, 0.5, st.start);   // Gobble waits at the start
    for (const o of cars) assert.ok(onTrack(o) < 0.5, "a car stays on its rails (" + onTrack(o).toFixed(2) + " off)");
    // a train's cars keep their gap along the rails (round a corner the
    // straight distance shrinks a little, never to a pile-up)
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
      assert.ok(L.gdist(cars[i].x, cars[i].y, cars[j].x, cars[j].y) >= 0.8 * (cars[i].r + cars[j].r), "two cars never pile up");
    }
  }
  cars.forEach((o, i) => assert.ok(Math.hypot(o.x - before[i][0], o.y - before[i][1]) > 5, "the train moves (" + o.e + ")"));
  // an open line goes there and back
  const lane = Object.values(L.geomOf("town").tracks).find((t) => !t.loop);
  assert.ok(lane, "fixture: the town has a street that is not a loop");
  for (const d of [1, 7, 19]) {
    const a = lane.pos(lane.len + d), b = lane.pos(lane.len - d);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-6, "past its end a rider comes back the way it went");
  }
  // the magnet catches a car: it leaves the rails and goes down
  makeTop(st);
  const car = cars[0], p = T.pos(car.s0 + T.speed * st.t + Math.sign(T.speed) * 8);
  park(st, p.x, p.y);
  const evs = run(st, 3, { x: p.x, y: p.y });
  assert.ok(car.free || car.st === L.GONE, "the car left its track when the magnet caught it");
  assert.ok(evs.some((e) => e.type === "eat" && e.id === car.id), "…and was eaten");
});

test("a SOLID thing is a wall while it is too big — he bumps it and cannot pass — and once he is big enough he eats his way through", () => {
  // The Building Site: barrels stand in the gap of the wall between the
  // yards. Only Gobble's centre meets a wall.
  const st = L.createGame("build"), G = L.geomOf("build");
  const barrels = st.objects.filter((o) => o.solid && o.e === "🛢️");
  assert.equal(barrels.length, 2, "fixture: two barrels shut the gap");
  assert.ok(barrels.every((o) => L.activeSolid(st, o)), "at the start they are a wall");
  const gx = barrels[0].x, gy = (barrels[0].y + barrels[1].y) / 2;
  park(st, gx + 22, gy);
  const far = { x: gx - 40, y: gy };
  let evs = [], crossed = false, bad = null;
  for (let i = 0; i < 240; i++) {
    L.setTarget(st, far.x, far.y);
    L.step(st);
    evs.push(...st.events); st.events.length = 0;
    if (st.hole.x < gx - 3) crossed = true;
    if (!bad && !freeAt(st, G, st.hole.x, st.hole.y)) bad = [st.hole.x, st.hole.y];
  }
  assert.equal(bad, null, "his centre never entered a barrel");
  assert.ok(!crossed, "he could not squeeze through the gate");
  assert.ok(evs.some((e) => e.type === "bump" && e.solid), "he bumped the wall (and it said so)");
  // big enough: they are not walls any more — he eats them and walks through
  makeLevel(st, 2);
  assert.ok(barrels.every((o) => !L.activeSolid(st, o)), "at level 2 the barrels are things to eat");
  evs = run(st, 6, far);
  assert.ok(barrels.some((o) => o.st === L.GONE), "he ate a barrel");
  assert.ok(st.hole.x < gx - 10, "…and walked through the gap");
});

test("a LOCK holds until its KEY is eaten: he bumps it, the hint points at the key at once, eating the key opens the way", () => {
  const st = L.createGame("farm"), G = L.geomOf("farm");
  const gate = st.objects.find((o) => o.lock), key = st.objects.find((o) => o.key === gate.lock);
  assert.ok(gate && key, "fixture: the farm has a locked gate and its key");
  makeLevel(st, 2);   // big enough to eat the log, were it not locked
  assert.ok(gate.r <= st.hole.r * RULES.FIT && L.activeSolid(st, gate) && !L.edible(st, gate), "the locked log is a wall, not food");
  // he walks up from the farmyard below and pushes on the gate
  park(st, gate.x, gate.y + 24);
  const inside = { x: gate.x, y: gate.y - 40 };
  let evs = [];
  for (let i = 0; i < 150; i++) { L.setTarget(st, inside.x, inside.y); L.step(st); evs.push(...st.events); st.events.length = 0; }
  assert.ok(evs.some((e) => e.type === "bump" && e.id === gate.id && e.locked), "he bumped the gate, and it said LOCKED");
  assert.equal(st.wantKey, gate.lock, "Gobble wants the key");
  assert.equal(st.hint, key.id, "the hint points at the key straight away (no waiting)");
  assert.ok(st.hole.y > gate.y, "he did not get past the gate");
  assert.equal(gate.st, L.IDLE, "the gate still stands");
  // the key: eat it and the gate opens
  park(st, key.x, key.y);
  evs = run(st, 3, { x: key.x, y: key.y });
  assert.ok(key.st === L.GONE && evs.some((e) => e.type === "unlock" && e.key === gate.lock && e.ids.includes(gate.id)), "eating the key opens the gate (unlock)");
  assert.ok(!L.activeSolid(st, gate) && L.edible(st, gate), "…and the log is now a thing to eat");
  assert.equal(st.wantKey, null, "…and he no longer wants a key");
  park(st, gate.x, gate.y + 24);
  run(st, 5, inside);
  assert.equal(gate.st, L.GONE, "he ate the gate");
  assert.ok(st.hole.y < gate.y - 10, "…and walked into the pumpkin patch");
});

test("a BOX pops when eaten and its surprises spill out; a TREE shakes its fruit down the first time he bumps it — once", () => {
  // the party's piñatas
  const st = L.createGame("party");
  const box = st.objects.find((o) => o.box === "pop");
  assert.ok(box && box.kids.length, "fixture: a piñata full of sweets");
  makeTop(st);
  park(st, box.x + 6, box.y);
  const evs = run(st, 3, { x: box.x, y: box.y });
  const pop = evs.find((e) => e.type === "pop" && e.id === box.id);
  assert.ok(box.st === L.GONE && pop, "eating the piñata pops it");
  assert.deepEqual(pop.kids.slice().sort((a, b) => a - b), box.kids.slice().sort((a, b) => a - b), "…and every sweet inside comes out");
  for (const id of box.kids) assert.notEqual(st.objects[id].st, L.HIDDEN, "a sweet is out (" + st.objects[id].e + ")");
  // the picnic's fruit trees
  const p = L.createGame("picnic");
  const tree = p.objects.find((o) => o.box === "shake");
  assert.ok(tree && tree.kids.length, "fixture: a fruit tree");
  assert.ok(tree.r > p.hole.r * RULES.FIT, "fixture: the tree is too big to eat at the start");
  park(p, tree.x + p.hole.r + tree.r * 0.3, tree.y);
  const e1 = run(p, 1.5, { x: tree.x, y: tree.y });
  assert.equal(e1.filter((e) => e.type === "shake" && e.id === tree.id).length, 1, "bumping the tree shakes it");
  assert.ok(tree.kids.every((id) => p.objects[id].st !== L.HIDDEN), "…and its fruit falls out");
  const e2 = run(p, 4, { x: tree.x, y: tree.y });
  assert.equal(e2.filter((e) => e.type === "shake").length, 0, "a tree shakes once — bumping again does nothing more");
});

test("a CHAIN topples: eat one of a row and the rest roll in after it, one by one, with Gobble standing still", () => {
  for (const id of ["sports", "music"]) {
    const st = L.createGame(id);
    const first = st.objects.find((o) => o.chain);
    const row = st.objects.filter((o) => o.chain === first.chain);
    assert.ok(row.length >= 5, "fixture: " + id + " has a row that topples (" + row.length + ")");
    makeLevel(st, first.tier - 1);
    // stand right on the end of the row
    const end = row.reduce((a, o) => (o.order < a.order ? o : a), row[0]);
    park(st, end.x, end.y);
    const at = { x: end.x, y: end.y };
    const evs = run(st, 5, at);
    assert.ok(row.every((o) => o.st === L.GONE), id + ": the whole row rolled in (" + row.filter((o) => o.st === L.GONE).length + " of " + row.length + ")");
    const order = evs.filter((e) => e.type === "eat" && row.some((o) => o.id === e.id)).map((e) => st.objects[e.id].order);
    assert.equal(order.length, row.length, id + ": each went down once");
    assert.ok(Math.hypot(st.hole.x - at.x, st.hole.y - at.y) < 2, id + ": …while he stood still");
  }
});

test("a CURRENT carries him (a river, a conveyor belt, a moving walkway, a rainbow slide) — let go and he floats along", () => {
  for (const id of ["jungle", "factory", "airport", "cloud"]) {
    const st = L.createGame(id), G = L.geomOf(id);
    const f = G.flows[0];
    const k = Math.floor(f.pts.length / 2), a = f.pts[Math.max(0, k - 1)], b = f.pts[Math.min(f.pts.length - 1, k)];
    const mid = { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 };
    park(st, mid.x, mid.y);
    L.setTarget(st, mid.x, mid.y);   // a finger let go where he stands
    const x0 = st.hole.x, y0 = st.hole.y, evs = [];
    for (let i = 0; i < 60; i++) { L.step(st); evs.push(...st.events); st.events.length = 0; }
    // downstream: along the flow's own direction (on the ground)
    const ux = b[0] - a[0], uy = (b[1] - a[1]) / RULES.SQ, ul = Math.hypot(ux, uy);
    const moved = ((st.hole.x - x0) * ux + ((st.hole.y - y0) / RULES.SQ) * uy) / ul;
    assert.ok(moved > f.v * 0.3, id + ": the " + f.look + " carried him " + moved.toFixed(1) + " units downstream in a second");
    assert.equal(evs.filter((e) => e.type === "flow").length, 1, id + ": stepping in says so, once (" + f.look + ")");
  }
});

test("ICE: on the ice he SLIDES — slow to start, slow to stop — and off it he stops at once", () => {
  const st = L.createGame("snow"), G = L.geomOf("snow");
  const Z = G.zone(L.sceneById("snow").slide[0]);
  // the middle of the ice
  let sx = 0, sy = 0;
  for (const k of Z.cells) { sx += G.cx(k); sy += G.cy(k); }
  const c = G.okNear(sx / Z.cells.length, sy / Z.cells.length), mid = { x: G.cx(c), y: G.cy(c) };
  assert.ok(G.slideAt(mid.x, mid.y), "fixture: the middle of the lake is ice");
  park(st, mid.x, mid.y);
  let evs = run(st, 0.15, { x: mid.x + 60, y: mid.y });
  const sp = Math.hypot(st.hole.vx, st.hole.vy);
  assert.ok(sp < RULES.VMAX * 0.5, "on ice he gets going slowly (" + sp.toFixed(1) + " after 0.15s)");
  assert.equal(evs.filter((e) => e.type === "ice").length, 1, "stepping on the ice says so, once");
  run(st, 0.6, { x: mid.x + 60, y: mid.y });
  // let go: he slides on
  const x1 = st.hole.x;
  evs = run(st, 0.3, { x: st.hole.x, y: st.hole.y });
  assert.ok(st.hole.x - x1 > 3, "let go on the ice and he slides on (" + (st.hole.x - x1).toFixed(1) + ")");
  // the same off the ice: he stops at once
  const g = L.createGame("snow");
  park(g, g.start.x, g.start.y);
  assert.ok(!G.slideAt(g.start.x, g.start.y), "fixture: the start is not ice");
  run(g, 0.15, { x: g.start.x + 30, y: g.start.y });
  const x2 = g.hole.x;
  run(g, 0.3, { x: g.hole.x, y: g.hole.y });
  assert.ok(Math.abs(g.hole.x - x2) < 0.5, "off the ice he stops where the finger lets go");
});

test("PORTALS: step on one and out of its partner you come — and you are not bounced straight back", () => {
  for (const id of ["space", "circus"]) {
    const st = L.createGame(id), G = L.geomOf(id);
    const e = G.ends.find((x) => x.live), to = G.ends[e.to];
    park(st, e.x, e.y);
    let evs = run(st, L.DT, { x: e.x, y: e.y });
    const w = evs.find((x) => x.type === "warp");
    assert.ok(w, id + ": stepping on the portal warps him");
    assert.ok(L.gdist(st.hole.x, st.hole.y, to.x, to.y) < 1, id + ": …out of its partner");
    evs = run(st, 1, { x: st.hole.x, y: st.hole.y });
    assert.equal(evs.filter((x) => x.type === "warp").length, 0, id + ": standing on the far end does not send him back");
    // walk off and come back: now it works again
    // a spot a short straight walk from the far end, on the same ground
    const straight = (p) => { for (let t = 0; t <= 1; t += 0.05) if (G.walk(to.x + (p.x - to.x) * t, to.y + (p.y - to.y) * t) > -1) return false; return true; };
    const away = G.okCells.map((k) => ({ x: G.cx(k), y: G.cy(k) })).find((p) => {
      const d = L.gdist(p.x, p.y, to.x, to.y);
      return d > RULES.PORTAL_R * 2 + 12 && d < RULES.PORTAL_R * 2 + 20 && straight(p) && G.ends.every((x) => L.gdist(p.x, p.y, x.x, x.y) > RULES.PORTAL_R * 2);
    });
    assert.ok(away, id + ": fixture: somewhere to walk off to");
    run(st, 2, away);
    assert.equal(st.warpLock, -1, id + ": walking away wakes the far end again");
  }
});

test("ROUTES: a finger across the water sends him ROUND it (or over a bridge) — never through it", () => {
  for (const id of ["themepark", "castle", "picnic"]) {
    const st = L.createGame(id), G = L.geomOf(id);
    const water = L.outlineOf(id).blocks.water;
    assert.ok(water && water.length, "fixture: " + id + " has water");
    // just off the water's left and right, at its middle height
    const R = water[0];
    const xs = R.map((p) => p[0]), ys = R.map((p) => p[1]);
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const okAt = (x, y) => G.walk(x, y) <= -2 && G.routeFrac(x, y) < 1;
    let A = null, B = null;
    for (let d = 6; d < 60 && !(A && B); d += 2) {
      if (!A && okAt(Math.min(...xs) - d, cy)) A = { x: Math.min(...xs) - d, y: cy };
      if (!B && okAt(Math.max(...xs) + d, cy)) B = { x: Math.max(...xs) + d, y: cy };
    }
    assert.ok(A && B, "fixture: ground on both sides of " + id + "'s water");
    park(st, A.x, A.y);
    let bad = null, arrived = false;
    for (let i = 0; i < 60 * 30 && !arrived; i++) {
      L.setTarget(st, B.x, B.y);
      L.step(st); st.events.length = 0;
      if (!bad && !freeAt(st, G, st.hole.x, st.hole.y)) bad = [st.hole.x.toFixed(1), st.hole.y.toFixed(1)];
      if (L.gdist(st.hole.x, st.hole.y, B.x, B.y) < 3) arrived = true;
    }
    assert.equal(bad, null, id + ": he never stood in the water");
    assert.ok(arrived, id + ": he got to the other side");
  }
});

test("PRESSED AGAINST A HEDGE he still finds his way (he plans from his own side of it, not from the nearest open cell across it)", () => {
  // The hedge maze: where his centre stands so close to a hedge that no
  // walking cell is free, the nearest free cell by straight distance can be
  // on the far side — a path planned from there starts across the hedge and
  // he never moved (the bot played the maze for ever). Found by searching the
  // maze for such spots, so the test does not depend on one coordinate.
  const G = L.geomOf("maze");
  const spots = [];
  for (let y = 4; y < G.H - 4 && spots.length < 8; y += 0.5) {
    for (let x = 4; x < G.W - 4 && spots.length < 8; x += 0.5) {
      if (G.walk(x, y) > -0.2) continue;
      const k = G.cellOf(x, y);
      if (G.ok[k]) continue;
      const m = G.okNear(x, y);
      let crosses = false;
      for (let t = 0.1; t <= 1; t += 0.1) if (G.walk(x + (G.cx(m) - x) * t, y + (G.cy(m) - y) * t) > 0) { crosses = true; break; }
      if (crosses && G.routeFrac(x, y) < 1) spots.push({ x, y });
    }
  }
  assert.ok(spots.length >= 3, "fixture: the maze has spots pressed against a hedge (" + spots.length + ")");
  for (const s of spots) {
    const st = L.createGame("maze");
    park(st, s.x, s.y);
    run(st, 3, G.mid);
    // Measured: planning from his own side, he is ~210 units on his way in
    // three seconds; planning from across the hedge, he only eases 8-15
    // units along it (round the corner) and stops. So "set off" means far.
    assert.ok(L.gdist(st.hole.x, st.hole.y, s.x, s.y) > 60, "from (" + s.x + "," + s.y + ") he set off toward the middle (moved " + L.gdist(st.hole.x, st.hole.y, s.x, s.y).toFixed(1) + ")");
  }
});

// ---- THE SUPER SLURP (§15.6) ---------------------------------------------
// Where the magnet's own pull ends for a thing, and how much further the
// super slurp reaches (the engine's two formulas, restated).
const magnetReach = (h, o) => h.r + o.r + RULES.PULL[0] + h.r * RULES.PULL[1];
const slurpReach = (h, o) => magnetReach(h, o) + RULES.SLURP.reach[0] + h.r * RULES.SLURP.reach[1];
// The straight line from a to b, judged by brute force at a fine step:
// does it cross water (or the edge of the world), a wall of things, or a
// live portal end? (The engine traces it; this samples it every 0.1 unit.)
function lineOf(st, G, x0, y0, x1, y1) {
  const solids = st.objects.filter((o) => L.activeSolid(st, o));
  const d = Math.hypot(x1 - x0, y1 - y0), out = { water: false, solid: false, portal: false };
  for (let s = 0; s <= d; s += 0.1) {
    const x = x0 + ((x1 - x0) * s) / d, y = y0 + ((y1 - y0) * s) / d;
    if (G.walk(x, y) > 0) out.water = true;
    if (solids.some((o) => L.gdist(x, y, o.x, o.y) < o.r * RULES.CORE)) out.solid = true;
    if (G.ends.some((E) => E.live && L.gdist(x, y, E.x, E.y) < RULES.PORTAL_R * 1.2)) out.portal = true;
  }
  out.open = !out.water && !out.solid && !out.portal;
  return out;
}
// A spot for Gobble at ground distance `d` from thing o where his centre may
// stand, whose line to o is open air (want "open") or crosses water and
// nothing else (want "water").
function spotFor(st, G, o, d, want) {
  for (let a = 0; a < 64; a++) {
    const ang = (a / 64) * Math.PI * 2;
    const x = o.x + Math.cos(ang) * d, y = o.y + Math.sin(ang) * d * RULES.SQ;
    if (x < 1 || y < 1 || x > G.W - 1 || y > G.H - 1 || !freeAt(st, G, x, y) || G.walk(x, y) > -1) continue;
    const ln = lineOf(st, G, x, y, o.x, o.y);
    if (want === "open" ? ln.open : ln.water && !ln.solid && !ln.portal) return { x, y };
  }
  return null;
}
// Clear the ground round a spot of every other thing he could eat, so a
// fixture measures ONE thing (a gulp of a neighbour would grow him, and a
// bigger Gobble reaches further).
function clearAround(st, P, keep, radius) {
  for (const o of st.objects) {
    if (o === keep || o.st !== L.IDLE || L.activeSolid(st, o)) continue;
    if (L.gdist(o.x, o.y, P.x, P.y) < radius) o.st = L.GONE;
  }
}

test("SUPER SLURP (§15.6): ten in a row sets it off — exactly once a run, for SLURP.secs, however long the run goes on; a run that breaks and builds again sets it off again", () => {
  const S = RULES.SLURP;
  const st = L.createGame("toyroom"), h = st.hole;
  // things that fit, dropped onto him 0.2s apart (a run keeps going while
  // each gulp comes within 0.6s of the last)
  const bites = st.objects.filter((o) => o.tier === 1 && o.st === L.IDLE && !o.ride && !o.chain && !o.key && o.r <= h.r * RULES.FIT);
  assert.ok(bites.length >= 30, "fixture: plenty of bites to drop (" + bites.length + ")");
  const log = [], timer = [];
  let n = 0, k = 0, maxT = 0;
  const tick = () => {
    L.setTarget(st, h.x, h.y); L.step(st);
    for (const e of st.events) log.push({ n, slurpT: st.slurpT, ...e });
    st.events.length = 0;
    timer[n] = st.slurpT;
    maxT = Math.max(maxT, st.slurpT);
    n++;
  };
  const runOf = (gulps) => { for (let i = 0; i < gulps * 12; i++) { if (i % 12 === 0) { const o = bites[k++]; o.x = h.x; o.y = h.y; } tick(); } };
  const rest = (secs) => { for (let i = 0; i < Math.round(secs / L.DT); i++) tick(); };
  runOf(15);                     // 15 gulps: the combo tops out at 10 and stays there
  const n1 = n;
  rest(3);                       // the run breaks (>0.6s), and the slurp runs out
  runOf(15);
  rest(3);
  const slurps = log.filter((e) => e.type === "slurp");
  assert.equal(slurps.length, 2, "one super slurp for each run of gulps — it does not go off again while a run tops out at " + S.at);
  assert.ok(slurps[0].n < n1 && slurps[1].n >= n1, "one in each run");
  for (const s of slurps) {
    // the gulp that set it off is in the same step: the combo is exactly AT
    const set = log.filter((e) => e.type === "eat" && e.n === s.n);
    assert.equal(set.length, 1, "fixture: one gulp in the step that set it off");
    assert.equal(set[0].combo, S.at, "it goes off on the gulp whose combo reaches " + S.at + " (saw " + set[0].combo + ")");
    assert.equal(s.slurpT, S.secs, "it starts at SLURP.secs");
    // …and it lasts SLURP.secs (the run keeps gulping, which must not stretch it)
    let end = s.n;
    while (end < timer.length && timer[end] > 0) end++;
    const lasted = (end - s.n) * L.DT;
    assert.ok(Math.abs(lasted - S.secs) <= 2 * L.DT, "it lasts " + S.secs + "s (" + lasted.toFixed(3) + "s)");
  }
  // no gulp short of AT ever set one off
  for (const e of log.filter((x) => x.type === "eat" && x.combo < S.at)) {
    assert.ok(!log.some((s) => s.type === "slurp" && s.n === e.n), "a gulp with combo " + e.combo + " set off a slurp");
  }
  assert.equal(maxT, S.secs, "it never stacks past SLURP.secs");
  assert.equal(st.slurpT, 0, "and it runs out");
  // the combo really did top out and stay there in each run (or "once a run"
  // would be untested)
  const tens = log.filter((e) => e.type === "eat" && e.combo === S.at).length;
  assert.ok(tens >= 6, "fixture: the runs kept gulping at the top of the combo (" + tens + " gulps at " + S.at + ")");
});

test("SUPER SLURP: while it lasts his pull reaches FURTHER — a thing past the magnet's own reach zooms in through open air — and pulls SLURP.speed times as FAST", () => {
  const S = RULES.SLURP;
  // THE SPEED: one step's pull on the same thing in the same spot, inside
  // the magnet's own reach, without and with a slurp (neither step reaches
  // the rim, so neither is cut short)
  {
    const pullOnce = (slurp) => {
      const st = L.createGame("toyroom"), h = st.hole;
      const o = st.objects.find((ob) => ob.tier === 1 && !ob.starter && !ob.ride);
      const d = (h.r - o.r * 0.35 + magnetReach(h, o)) / 2;
      clearAround(st, { x: o.x - d, y: o.y }, o, slurpReach(h, o) + 20);
      park(st, o.x - d, o.y);
      st.slurpT = slurp ? S.secs : 0;
      const x0 = o.x, y0 = o.y;
      L.step(st); st.events.length = 0;
      assert.equal(o.st, L.IDLE, "fixture: one step does not reach the rim");
      return L.gdist(o.x, o.y, x0, y0);
    };
    const plain = pullOnce(false), fast = pullOnce(true);
    assert.ok(plain > 0, "fixture: the magnet pulls it");
    assert.ok(Math.abs(fast / plain - S.speed) < 1e-6, "the pull is " + S.speed + " times as fast (" + (fast / plain).toFixed(4) + "x)");
  }
  // THE REACH: in every place, a thing halfway between the magnet's own
  // reach and the slurp's, with open air between — without a slurp it does
  // not stir; with one it zooms in and is eaten while the slurp lasts
  let tested = 0;
  for (const def of SCENES) {
    const G = L.geomOf(def);
    const st0 = L.createGame(def), h0 = st0.hole;
    let o0 = null, P = null;
    for (const o of st0.objects) {
      if (o.st !== L.IDLE || o.ride || o.finale || o.starter || L.activeSolid(st0, o) || o.r > h0.r * RULES.FIT) continue;
      P = spotFor(st0, G, o, (magnetReach(h0, o) + slurpReach(h0, o)) / 2, "open");
      if (P) { o0 = o; break; }
    }
    if (!o0) continue;
    tested++;
    for (const slurp of [false, true]) {
      const st = L.createGame(def), o = st.objects[o0.id];
      clearAround(st, P, o, slurpReach(st.hole, o) + 20);
      park(st, P.x, P.y);
      const x0 = o.x, y0 = o.y;
      let zoom = false;
      for (let i = 0; i < Math.round(S.secs / L.DT) && o.st !== L.GONE; i++) {
        if (slurp && i === 0) st.slurpT = S.secs;
        L.setTarget(st, P.x, P.y); L.step(st); st.events.length = 0;
        if (o.zoom) zoom = true;
      }
      if (!slurp) {
        assert.ok(o.x === x0 && o.y === y0 && o.st === L.IDLE, def.id + ": without a slurp a thing past the magnet's reach does not stir");
        assert.ok(!zoom, def.id + ": …and nothing zooms");
      } else {
        assert.equal(o.st, L.GONE, def.id + ": with a slurp it zooms in and is eaten while the slurp lasts (" + o.e + ", " + L.gdist(o.x, o.y, P.x, P.y).toFixed(1) + " away at the end)");
        assert.ok(zoom, def.id + ": …drawn zooming (it came from past the magnet's own reach)");
      }
    }
  }
  assert.ok(tested >= 20, "fixture: most places have open air to slurp across (" + tested + " of " + SCENES.length + ")");
});

test("SUPER SLURP: the pull never reaches ACROSS WATER, and never takes the FINALE (which he goes to eat himself) — not even as the tenth gulp in a row", () => {
  const S = RULES.SLURP;
  // ACROSS WATER: a thing in the slurp's reach, but over water from him
  let crossed = 0;
  for (const def of SCENES) {
    const G = L.geomOf(def);
    let fx = null;
    for (let lv = 0; lv <= 4 && !fx; lv++) {
      const st0 = L.createGame(def); makeLevel(st0, lv);
      const h0 = st0.hole;
      for (const o of st0.objects) {
        if (o.st !== L.IDLE || o.ride || o.finale || L.activeSolid(st0, o) || o.r > h0.r * RULES.FIT) continue;
        const P = spotFor(st0, G, o, (magnetReach(h0, o) + slurpReach(h0, o)) / 2, "water");
        if (P) { fx = { lv, id: o.id, P }; break; }
      }
    }
    if (!fx) continue;
    crossed++;
    const st = L.createGame(def); makeLevel(st, fx.lv);
    const o = st.objects[fx.id];
    clearAround(st, fx.P, o, slurpReach(st.hole, o) + 20);
    park(st, fx.P.x, fx.P.y);
    st.slurpT = S.secs;
    const x0 = o.x, y0 = o.y;
    let zoom = false;
    for (let i = 0; i < Math.round(S.secs / L.DT); i++) { L.setTarget(st, fx.P.x, fx.P.y); L.step(st); st.events.length = 0; if (o.zoom) zoom = true; }
    assert.ok(o.x === x0 && o.y === y0 && o.st === L.IDLE && !zoom, def.id + ": a thing over the water from him stays put (" + o.e + ")");
  }
  assert.ok(crossed >= 6, "fixture: places with water (or a gap in the world) to slurp across (" + crossed + ")");
  // THE FINALE: in reach of the slurp, through open air, at the top size —
  // and it stays put
  let finales = 0;
  for (const def of SCENES) {
    const G = L.geomOf(def);
    const st = L.createGame(def);
    makeTop(st);
    for (const o of st.objects) if (o.key) st.unlocked[o.key] = true;
    const fin = st.objects.find((o) => o.finale);
    assert.ok(fin.r <= st.hole.r * RULES.FIT, "fixture: " + def.id + "'s finale fits at the top size");
    const P = spotFor(st, G, fin, magnetReach(st.hole, fin) + (slurpReach(st.hole, fin) - magnetReach(st.hole, fin)) * 0.4, "open");
    if (!P) continue;
    finales++;
    clearAround(st, P, fin, slurpReach(st.hole, fin) + 20);
    park(st, P.x, P.y);
    st.slurpT = S.secs;
    const x0 = fin.x, y0 = fin.y;
    for (let i = 0; i < 60; i++) { L.setTarget(st, P.x, P.y); L.step(st); st.events.length = 0; }
    assert.ok(fin.x === x0 && fin.y === y0 && fin.st === L.IDLE && !fin.zoom, def.id + ": the slurp leaves the finale where it stands — he goes and eats it himself");
  }
  assert.ok(finales >= 20, "fixture: the finale has open ground round it in most places (" + finales + ")");
  // THE FINALE AS THE TENTH IN A ROW: eating it never sets one off (the win
  // takes the stage)
  for (const id of ["toyroom", "party"]) {
    const st = L.createGame(id);
    makeTop(st);
    const fin = st.objects.find((o) => o.finale);
    for (const o of st.objects) if (o !== fin) o.st = L.GONE;
    park(st, fin.x, fin.y);
    const evs = [];
    for (let i = 0; i < 180 && !st.won; i++) {
      st.combo = S.at - 1; st.lastEatT = st.t;     // the run is one gulp short
      L.setTarget(st, fin.x, fin.y); L.step(st); evs.push(...st.events); st.events.length = 0;
    }
    const ate = evs.find((e) => e.type === "eat" && e.finale);
    assert.ok(ate && ate.combo === S.at, id + ": fixture: the finale went down as the tenth in a row (combo " + (ate && ate.combo) + ")");
    assert.equal(evs.filter((e) => e.type === "slurp").length, 0, id + ": eating the finale never sets off a super slurp");
    assert.equal(st.slurpT, 0, id + ": …and none is running");
  }
});

test("PORTALS: standing on the end he came out of, with the way back through it, he walks off, it wakes, and back through he goes — never stood on it for ever", () => {
  // Found in space once a super slurp sent the bot back for a crumb: the end
  // he arrives at sleeps until he has walked away from it, and a way that
  // went back through that same end headed him for the spot he was already
  // standing on — so he stood there, and it never woke. Derived: every live
  // end of every place with portals, small and big.
  let cases = 0;
  for (const def of SCENES) {
    const G = L.geomOf(def);
    G.ends.forEach((X, xi) => {
      if (!X.live) return;
      const to = G.ends[X.to];
      // a spot just past the far end, on open ground and off every portal
      let T = null;
      for (const k of G.okCells) {
        const x = G.cx(k), y = G.cy(k), d = L.gdist(x, y, to.x, to.y);
        if (d < RULES.PORTAL_R * 2 + 6 || d > RULES.PORTAL_R * 2 + 16) continue;
        if (G.ends.some((E) => L.gdist(x, y, E.x, E.y) < RULES.PORTAL_R * 2)) continue;
        if (!T || d < T.d) T = { x, y, d };
      }
      assert.ok(T, def.id + ": fixture: open ground past end " + xi + "'s partner");
      for (const lv of [0, 3]) {
        const st = L.createGame(def); makeLevel(st, lv);
        park(st, X.x, X.y);
        st.warpLock = xi;                  // he has just come out of this end
        let through = false, there = false;
        for (let i = 0; i < 60 * 4 && !there; i++) {
          L.setTarget(st, T.x, T.y); L.step(st);
          for (const e of st.events) if (e.type === "warp" && e.from[0] === Math.round(X.x * 1000) / 1000 && e.from[1] === Math.round(X.y * 1000) / 1000) through = true;
          st.events.length = 0;
          there = L.gdist(st.hole.x, st.hole.y, T.x, T.y) < 3;
        }
        assert.ok(through && there, def.id + " level " + lv + ": from the sleeping end " + xi + " he went back through it and on (through " + through + ", there " + there + ", " + L.gdist(st.hole.x, st.hole.y, X.x, X.y).toFixed(1) + " from where he stood)");
        cases++;
      }
    });
  }
  assert.ok(cases >= 24, "fixture: every live end of the portal places, twice (" + cases + ")");
});

test("a LINE that looks clear but grazes a wall: he still gets there (the straight-line check traces the line, it does not sample it every 2 units)", () => {
  // Two spots the bot found stuck for good once a super slurp sent it past
  // them: a cave wall that juts out by half a unit, and a beach shore that
  // juts out by a tenth of one, each between the samples of the old
  // every-2-units look. It called the way straight, he was pressed into the
  // bulge, and he never moved again (0.0 units in 5s on both). Random lines
  // that graze a wall do NOT reproduce it — 26 measured, and the old look
  // got there on every one by sliding — so these two, found by play, are
  // the fixtures that can tell the two looks apart. Each asserts the
  // geometry that makes it one.
  const looksClear2 = (G, a, b) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2);
    for (let i = 1; i <= n; i++) if (G.walk(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n) > 0) return false;
    return true;
  };
  const grazes = (G, a, b) => {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    let w = -Infinity;
    for (let s = 0; s <= d; s += 0.05) w = Math.max(w, G.walk(a.x + ((b.x - a.x) * s) / d, a.y + ((b.y - a.y) * s) / d));
    return w;
  };
  for (const fx of [
    // the cave: the straight line itself grazes a jutting wall
    { id: "cave", lv: 3, A: { x: 275.36, y: 387.23 }, B: { x: 273.5, y: 404.9 }, via: { x: 273.5, y: 404.9 } },
    // the beach: the line to the first path cell on the way grazes the shore
    { id: "beach", lv: 4, A: { x: 121.32, y: 456.8 }, B: { x: 118.6, y: 529.8 }, via: { x: 122.5, y: 522.5 } },
  ]) {
    const G = L.geomOf(fx.id);
    const st = L.createGame(fx.id); makeLevel(st, fx.lv);
    assert.ok(freeAt(st, G, fx.A.x, fx.A.y) && freeAt(st, G, fx.B.x, fx.B.y), "fixture: " + fx.id + ": both ends are ground he may stand on");
    assert.ok(looksClear2(G, fx.A, fx.via), "fixture: " + fx.id + ": a look every 2 units sees no wall on the line");
    assert.ok(grazes(G, fx.A, fx.via) > 0.05, "fixture: " + fx.id + ": …but the line does cross the ground's edge (" + grazes(G, fx.A, fx.via).toFixed(3) + ")");
    park(st, fx.A.x, fx.A.y);
    let there = -1, bad = null;
    for (let i = 0; i < 60 * 3 && there < 0; i++) {
      L.setTarget(st, fx.B.x, fx.B.y); L.step(st); st.events.length = 0;
      if (!bad && !freeAt(st, G, st.hole.x, st.hole.y)) bad = [st.hole.x.toFixed(2), st.hole.y.toFixed(2)];
      if (L.gdist(st.hole.x, st.hole.y, fx.B.x, fx.B.y) < 1) there = st.t;
    }
    assert.equal(bad, null, fx.id + ": his centre never stood where it may not");
    assert.ok(there >= 0, fx.id + ": he got there (moved " + L.gdist(st.hole.x, st.hole.y, fx.A.x, fx.A.y).toFixed(1) + ", still " + L.gdist(st.hole.x, st.hole.y, fx.B.x, fx.B.y).toFixed(1) + " away)");
  }
});
