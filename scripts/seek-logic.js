// 🔍 Seek & Find — the PURE layout engine. A place's picture is decided here
// from its data, its level and a seed: no DOM, no Math.random, dual export, so
// the node tests lay out every place on every level and prove each picture is
// fair before a child ever sees it.
//
// What makes a picture FAIR (each one is a law in tests/seek-logic.test.js):
//  - every thing on the list is in the picture exactly as often as it says
//    (one duck, or exactly three balloons), and nothing else in the picture
//    belongs to its group — so a right answer is never also wrong and a wrong
//    one never also right;
//  - every find stands where he can see most of it (nothing drawn in front of
//    it covers more than a small share), and the buddy peeks out from behind
//    scenery by a measured amount;
//  - everything is inside the picture.
//
// Coordinates are layout units (SeekData.W wide), y downwards. An item's (x, y)
// is its CENTRE; `size` its box. Items are returned in DRAW order: what stands
// lower in the picture is nearer, so it is drawn later, in front.

(function (global) {
  "use strict";
  const D = global.SeekData || (typeof require !== "undefined" ? require("./seek-data.js") : null);
  const S = global.SeekScenery || (typeof require !== "undefined" ? require("./seek-scenery.js") : null);
  // A picture's things are drawn this much smaller than their kind's size, and
  // there are this many times more of them: a look-and-find page is a crowd of
  // small things in a world, not a few big stickers on a colour.
  const SCALE = D.SCALE || 1, DENSE = D.DENSE || 1;
  const sizeOf = (kind) => D.KINDS[kind].size * SCALE;

  // mulberry32: the one random source. Same seed, same picture.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  function weighted(r, table) {
    const keys = Object.keys(table);
    let tot = 0;
    for (const k of keys) tot += table[k];
    let x = r() * tot;
    for (const k of keys) { x -= table[k]; if (x < 0) return k; }
    return keys[keys.length - 1];
  }
  function shuffle(r, a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  const groupOf = (kind) => (D.KINDS[kind] && D.KINDS[kind].group) || kind;
  const placeOf = (id) => D.PLACES.find((p) => p.id === id) || null;
  const levelOf = (n) => D.LEVELS[Math.max(0, Math.min(D.LEVELS.length - 1, n | 0))];

  // The radius a thing is HIT and SEEN by: its picture fills most of its box
  // but not the corners.
  const BODY = 0.42;
  const rOf = (it) => it.size * BODY;
  const bottomOf = (it) => it.y + it.size / 2;

  // Is (x, y) inside a zone (its rect, or the oval inscribed in it)?
  function inZone(z, x, y) {
    const [zx, zy, zw, zh] = z.rect;
    if (!z.oval) return x >= zx && x <= zx + zw && y >= zy && y <= zy + zh;
    const dx = (x - (zx + zw / 2)) / (zw / 2), dy = (y - (zy + zh / 2)) / (zh / 2);
    return dx * dx + dy * dy <= 1;
  }
  // A random spot for a thing of this size: its centre in the zone and its box
  // inside the picture.
  function spot(r, z, size, H) {
    const [zx, zy, zw, zh] = z.rect, half = size / 2;
    for (let i = 0; i < 30; i++) {
      // a zone with LANES (a road, rails, a runway) puts what stands in it on
      // one: its feet on the lane line, so a car drives along the road
      const x = zx + r() * zw, y = z.lanes ? pick(r, z.lanes) - half * 0.8 : zy + r() * zh;
      if (x < half || x > D.W - half || y < half || y > H - half) continue;
      if (inZone(z, x, y)) return { x, y };
    }
    return { x: Math.max(half, Math.min(D.W - half, zx + zw / 2)), y: Math.max(half, Math.min(H - half, zy + zh / 2)) };
  }
  // Best-candidate sampling: of a few random spots, the one furthest (relative
  // to the two sizes) from everything already placed. Things may touch and
  // overlap a little — it is a busy picture — but never pile up.
  function bestSpot(r, z, size, placed, H, tries) {
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < (tries || 10); i++) {
      const c = spot(r, z, size, H);
      let score = Infinity;
      for (const p of placed) {
        const d = Math.hypot(p.x - c.x, p.y - c.y) - 0.55 * (p.size + size) * BODY * 2;
        if (d < score) score = d;
      }
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  // A crowd wears every colour: Noto dresses all its people in one orange, so
  // a person's picture carries a SHIRT ("~n"), and the page recolours that
  // orange to shirt n (recolor below). Shirt 0 is Noto's own orange.
  const SHIRTS = [null, 0, 210, 130, 280, 50, 330, 175];
  function personArt(r, k) {
    if (!k.tone) return k.art;
    const base = k.art + "-" + pick(r, D.TONES) + "-skin-tone";
    const sh = Math.floor(r() * SHIRTS.length);
    return sh ? base + "~" + sh : base;
  }
  // The picture a drawn name stands for (its art, without the shirt).
  const artBase = (name) => String(name).split("~")[0];
  // Recolour a person's orange clothes to shirt n's hue. Orange here is a
  // strongly saturated colour of hue 15-40 (skin and hair are never that
  // saturated); its lightness is kept, so the folds and shading survive.
  function recolor(svg, n) {
    const hue = SHIRTS[n];
    if (hue == null) return svg;
    return svg.replace(/#([0-9a-fA-F]{6})\b/g, (m, h) => {
      const R = parseInt(h.slice(0, 2), 16) / 255, G = parseInt(h.slice(2, 4), 16) / 255, B = parseInt(h.slice(4, 6), 16) / 255;
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2, d = mx - mn;
      if (d === 0) return m;
      const sat = d / (1 - Math.abs(2 * l - 1));
      let hh = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
      hh = (hh * 60 + 360) % 360;
      if (sat < 0.72 || hh < 12 || hh > 42 || l < 0.3 || l > 0.75) return m;
      const c = (1 - Math.abs(2 * l - 1)) * Math.min(sat, 0.8), x = c * (1 - Math.abs(((hue / 60) % 2) - 1)), o = l - c / 2;
      const [r1, g1, b1] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
      const to = (v) => ("0" + Math.round((v + o) * 255).toString(16)).slice(-2);
      return "#" + to(r1) + to(g1) + to(b1);
    });
  }

  // How much of item i shows: the share of points over its body that nothing
  // drawn in front of it (later in the list) covers.
  function visibleFrac(items, i) {
    const it = items[i], R = rOf(it);
    let shown = 0, total = 0;
    for (let gy = -4; gy <= 4; gy++) {
      for (let gx = -4; gx <= 4; gx++) {
        const px = it.x + (gx / 4) * R, py = it.y + (gy / 4) * R;
        if ((px - it.x) * (px - it.x) + (py - it.y) * (py - it.y) > R * R) continue;
        total++;
        let covered = false;
        for (let j = i + 1; j < items.length && !covered; j++) {
          const o = items[j], ro = rOf(o);
          if ((px - o.x) * (px - o.x) + (py - o.y) * (py - o.y) <= ro * ro) covered = true;
        }
        if (!covered) shown++;
      }
    }
    return total ? shown / total : 1;
  }

  const byDraw = (a, b) => a.z - b.z;

  // ---- Choose the list ------------------------------------------------------
  // Two things to find once and one to COUNT (several of the same), from
  // different zones where it can, then the buddy. The list never asks for two
  // things of one group.
  function chooseList(r, place, lvl) {
    const singles = [], counts = [];
    for (const k of Object.keys(place.finds)) (place.finds[k] === "count" ? counts : singles).push(k);
    shuffle(r, singles);
    const zoneOf = (k) => (place.zones.find((z) => z.kinds && z.kinds[k]) || {}).id;
    const out = [], usedZones = new Set(), usedGroups = new Set();
    const take = (k, n) => { out.push({ kind: k, n }); usedZones.add(zoneOf(k)); usedGroups.add(groupOf(k)); };
    const c = pick(r, counts);
    take(c, lvl.count[0] + Math.floor(r() * (lvl.count[1] - lvl.count[0] + 1)));
    for (const k of singles) {
      if (out.length >= 3) break;
      if (usedGroups.has(groupOf(k)) || usedZones.has(zoneOf(k))) continue;
      take(k, 1);
    }
    for (const k of singles) {                 // a place with few zones: allow a repeat zone
      if (out.length >= 3) break;
      if (!usedGroups.has(groupOf(k))) take(k, 1);
    }
    // singles first on the list, the counting one last before the buddy
    const ord = out.slice(1).concat(out.slice(0, 1));
    return ord;
  }

  // ---- Clues ------------------------------------------------------------------
  // Which singles on the list may carry the clue, in the order to try them
  // (never the thing to count, never something in the sky).
  function clueCandidate(r, list) {
    const ok = [];
    for (let i = 0; i < list.length; i++) {
      const l = list[i], k = D.KINDS[l.kind];
      if (l.n === 1 && !k.sky) ok.push(i);
    }
    // a person whose shirt can change: half the time, a colour clue
    const col = ok.filter((i) => D.CLUES.colourKinds.indexOf(list[i].kind) >= 0);
    if (col.length && r() < 0.5) return col.concat(ok.filter((i) => col.indexOf(i) < 0));
    return ok;
  }
  // The pieces of the world a clue can name: the big scenery things (a tree,
  // a tent, a house) and the set pieces drawn in the ground (a bench, a lamp
  // post, a slide, a blanket). Each is a GROUND POINT (where its foot is) and
  // a width; `word` is how a thing stands at it.
  const LANDMARK = {
    bench: (a) => ({ say: "bench", x: a[0], foot: a[1] + 14, w: 64, word: "next" }),
    lamp: (a) => ({ say: "lamp post", x: a[0], foot: a[1], w: 18, word: "next" }),
    bin: (a) => ({ say: "trash can", x: a[0], foot: a[1], w: 24, word: "next" }),
    slide: (a) => ({ say: "slide", x: a[0] + 10, foot: a[1], w: 90, word: "next" }),
    swings: (a) => ({ say: "swings", x: a[0], foot: a[1], w: 100, word: "next" }),
    bush: (a) => ({ say: "bush", x: a[0], foot: a[1] + 14 * (a[2] || 1), w: 64 * (a[2] || 1), word: "next" }),
    tree: (a) => ({ say: "tree", x: a[0], foot: a[1], w: 90 * (a[2] || 1), word: "under" }),
    tent: (a) => ({ say: "tent", x: a[0], foot: a[1], w: 112, word: "next" }),
    wreck: (a) => ({ say: "shipwreck", x: a[0], foot: a[1], w: 200 * (a[2] || 1), word: "next" }),
    kelp: (a) => ({ say: "seaweed", x: a[0] + a[2] / 2, foot: a[1], w: Math.max(40, a[2]), word: "next" }),
    marketstall: (a) => ({ say: "market stall", x: a[0] + a[2] / 2, foot: a[1], w: a[2], word: "next" }),
    blanket: (a) => ({ say: "blanket", x: a[0] + a[2] / 2, foot: a[1] + a[3] / 2, w: Math.min(a[2], a[3] * 1.6), word: "on" }),
  };
  function anchors(place, items) {
    const out = [];
    for (const g of place.ground || []) if (LANDMARK[g[0]]) out.push(LANDMARK[g[0]](g.slice(1)));
    for (const p of items) {
      if (p.role !== "prop" || D.KINDS[p.kind].sky) continue;
      out.push({ say: D.KINDS[p.kind].say, x: p.x, foot: p.y + p.size * 0.4, w: p.size * 0.6, word: D.CLUES.under.indexOf(p.kind) >= 0 ? "under" : "next", bottom: p.y + p.size / 2 });
    }
    return out;
  }
  // Does a landmark stand by a zone? Its foot is in the zone, or (not for a
  // water zone) within a short step of its edge: the tree at the meadow's edge.
  function nearZone(z, a) {
    if (inZone(z, a.x, a.foot)) return true;
    if (z.oval) return false;
    const [x, y, w, h] = z.rect, M = 120;
    return a.x >= x - M && a.x <= x + w + M && a.foot >= y - M && a.foot <= y + h + M;
  }
  // Is a thing standing at landmark a? The one measure the placing, the
  // decoys and the test all use.
  const atMark = (it, a) => Math.hypot(it.x - a.x, it.y + it.size / 2 - a.foot) <= a.w / 2 + it.size * 0.7;
  // Decoys stand well clear of every landmark the clue names.
  const FAR = 70;
  const farFrom = (x, y, size, marks) => marks.every((a) => Math.hypot(x - a.x, y + size / 2 - a.foot) > a.w / 2 + size * 0.7 + FAR);
  // Does the clue on list entry l pick out exactly ONE thing in the picture,
  // and is every decoy plainly not it?
  function clueHolds(place, items, l) {
    const c = l.clue;
    const same = items.filter((it) => it.kind === l.kind && (it.role === "find" || it.role === "decoy"));
    if (!same.some((it) => it.role === "decoy")) return false;
    if (c.type === "colour") {
      const hits = same.filter((it) => it.art.split("~")[1] === String(c.shirt));
      return hits.length === 1 && hits[0].role === "find";
    }
    const marks = anchors(place, items).filter((a) => a.say === c.say);
    const hits = same.filter((it) => marks.some((a) => atMark(it, a)));
    if (hits.length !== 1 || hits[0].role !== "find") return false;
    return same.filter((it) => it.role === "decoy").every((it) => farFrom(it.x, it.y, it.size, marks));
  }
  // Would a thing here stand over the buddy (who is drawn behind scenery
  // and must keep showing the share its level asks)?
  function blocksBuddy(items, x, y, size) {
    const b = items.find((it) => it.role === "buddy");
    return !!b && Math.hypot(b.x - x, b.y - y) < rOf(b) + size * BODY;
  }
  // Place list entry l (one thing) with a clue, and its decoys. Returns false
  // (place it plainly instead) when this picture has no way to make one fair.
  function placeClue(r, place, l, items, H, add) {
    const k = D.KINDS[l.kind], C = D.CLUES;
    const sz = sizeOf(l.kind);
    const homes = place.zones.filter((z) => z.kinds && z.kinds[l.kind]);
    if (!homes.length) return false;
    // COLOUR: three of a person, three plainly different shirts
    if (C.colourKinds.indexOf(l.kind) >= 0 && r() < 0.7) {
      const shirts = shuffle(r, Object.keys(C.colours).map(Number)).slice(0, 1 + C.decoys);
      shirts.forEach((sh, i) => {
        let at = bestSpot(r, pick(r, homes), sz, items, H, 16);
        for (let t = 0; t < 12 && blocksBuddy(items, at.x, at.y, sz); t++) at = bestSpot(r, pick(r, homes), sz, items, H, 16);
        const it = add(l.kind, at, i ? "decoy" : "find");
        it.art = artBase(it.art) + "~" + sh;
        if (!i) l.art = it.art;
      });
      l.clue = { type: "colour", shirt: shirts[0], word: "in " + C.colours[shirts[0]] };
      return true;
    }
    // UNDER / NEXT TO / ON: a landmark where this thing lives (no fish next
    // to a house), its kind named once in the clue. Never for what drives
    // on a road or rails: it stays on its lane.
    if (homes.some((z) => z.lanes)) return false;
    const all = anchors(place, items);
    const marks = all.filter((a) => homes.some((z) => nearZone(z, a)));
    for (const a of shuffle(r, marks.slice())) {
      const same = all.filter((b) => b.say === a.say);
      let at;
      if (a.word === "under") at = { x: a.x + (r() - 0.5) * a.w * 0.3, y: a.foot - sz * 0.55 };
      else if (a.word === "on") at = { x: a.x + (r() - 0.5) * a.w * 0.2, y: a.foot - sz * 0.5 };
      else {
        const side = r() < 0.5 ? -1 : 1;
        at = { x: a.x + side * (a.w / 2 + sz * 0.45), y: a.foot - sz * 0.55 };
        if (at.x < sz / 2 || at.x > D.W - sz / 2) at.x = a.x - side * (a.w / 2 + sz * 0.45);
      }
      // in FRONT of scenery it stands at (drawn after it), so it is never
      // moved out from behind it later
      if (a.bottom) at.y = Math.max(at.y, a.bottom + 4 - sz / 2);
      if (at.x < sz / 2 || at.x > D.W - sz / 2 || at.y < sz / 2 || at.y > H - sz / 2) continue;
      if (blocksBuddy(items, at.x, at.y, sz)) continue;
      // the decoys: in the thing's own zones, far from every one of these
      const dec = [];
      for (let t = 0; t < 80 && dec.length < C.decoys; t++) {
        const c = spot(r, pick(r, homes), sz, H);
        if (farFrom(c.x, c.y, sz, same) && !blocksBuddy(items, c.x, c.y, sz) && dec.every((d) => Math.hypot(d.x - c.x, d.y - c.y) > sz * 1.4)) dec.push(c);
      }
      if (!dec.length) continue;
      const it = add(l.kind, at, "find");
      it.rot = 0;
      l.art = it.art;
      for (const d of dec) {
        const o = add(l.kind, d, "decoy");
        if (k.tone) o.art = it.art;               // the same picture: only the clue tells them apart
      }
      const pre = a.word === "under" ? "under the " : a.word === "on" ? "on the " : "next to the ";
      l.clue = { type: a.word, say: a.say, word: pre + a.say };
      return true;
    }
    return false;
  }

  // ---- Hiding inside scenery ---------------------------------------------------
  // One single on the list (never the clue, never a count, never in the sky)
  // moves INSIDE a piece of scenery: hidden until he taps the scenery, when
  // it pops out on top of it. The scenery never covers the buddy's hiding
  // place, and once out the thing shows as well as any find.
  function hideInside(r, list, items) {
    const l = list.find((e) => e.n === 1 && !e.clue && !D.KINDS[e.kind].sky && !e.lanes);
    if (!l) return;
    const it = items.find((x) => x.role === "find" && x.kind === l.kind);
    const buddy = items.find((x) => x.role === "buddy");
    // a box big enough to hide it, never the buddy's hiding place
    const boxes = items.filter((p) => p.role === "prop" && !D.KINDS[p.kind].sky && p.size >= it.size * 1.4 &&
      !(buddy && Math.hypot(p.x - buddy.x, p.y - buddy.y) < rOf(p) + rOf(buddy)));
    for (const p of shuffle(r, boxes)) {
      const keep = { x: it.x, y: it.y, z: it.z };
      it.x = p.x;
      it.y = Math.max(it.size / 2, p.y - p.size * 0.28);
      it.z = p.z + 0.5;
      items.sort(byDraw);
      // clear the fillers that would stand in front of it once it is out
      for (let g = 0; g < 40; g++) {
        const i = items.indexOf(it);
        if (visibleFrac(items, i) >= 0.78) break;
        let j = -1;
        for (let k = i + 1; k < items.length; k++) {
          const o = items[k];
          if (o.role === "fill" && Math.hypot(o.x - it.x, o.y - it.y) < rOf(o) + rOf(it)) { j = k; break; }
        }
        if (j < 0) break;
        items.splice(j, 1);
      }
      if (visibleFrac(items, items.indexOf(it)) >= 0.78 && !blocksBuddy(items.filter((x) => x !== it), it.x, it.y, it.size)) {
        it.hidden = true;
        it.inside = true;
        l.inside = p.kind;
        p.holds = true;
        return;
      }
      it.x = keep.x; it.y = keep.y; it.z = keep.z;
      items.sort(byDraw);
    }
  }
  // Where the thing hiding inside prop index b is (its index), or -1.
  function heldBy(items, b) {
    const p = items[b];
    if (!p || !p.holds) return -1;
    return items.findIndex((it) => it.inside && it.hidden && it.x === p.x);
  }

  // ---- Lay a place out -------------------------------------------------------
  // opts: { seed, level } → { place, list, items } where list is
  // [{ kind, n, art }…, { kind: "buddy", n: 1 }] and each item is
  // { kind, art, x, y, size, rot, flip, role: "find"|"buddy"|"fill"|"prop", z }.
  function layout(placeId, opts) {
    const place = placeOf(placeId);
    if (!place) throw new Error("no place " + placeId);
    const level = Math.max(0, Math.min(D.LEVELS.length - 1, (opts && opts.level) | 0));
    const lvl = levelOf(level);
    const seed = ((opts && opts.seed) >>> 0) ^ hash(placeId) ^ (level * 0x9e3779b1);
    const r = rng(seed);
    const H = place.h;
    const items = [];
    const add = (kind, at, role, artName) => {
      const k = D.KINDS[kind];
      const it = {
        kind, art: artName || personArt(r, k), x: at.x, y: at.y, size: sizeOf(kind), role,
        rot: k.prop || k.sky ? 0 : Math.round((r() - 0.5) * 16), flip: !k.prop && r() < 0.5,
      };
      it.z = bottomOf(it);
      items.push(it);
      return it;
    };

    const list = chooseList(r, place, lvl);
    // what lives on a road, rails or a runway never hides in a tree
    for (const l of list) if (place.zones.some((z) => z.lanes && z.kinds && z.kinds[l.kind])) l.lanes = true;
    const want = new Set(list.map((l) => groupOf(l.kind)));
    const zoneFor = (kind) => {
      const zs = place.zones.filter((z) => z.kinds && z.kinds[kind]);
      return pick(r, zs);
    };

    // 1. the big scenery, in a loose row across its zone
    for (const z of place.zones) {
      for (const f of z.fixed || []) add(f, { x: D.W - 90, y: z.rect[1] + 70 }, "prop");
      const ps = z.props || [];
      ps.forEach((p, i) => {
        const sz = sizeOf(p), slot = D.W / ps.length;
        const x = Math.max(sz / 2, Math.min(D.W - sz / 2, slot * (i + 0.5) + (r() - 0.5) * slot * 0.35));
        const y = Math.max(z.rect[1] + sz * 0.35, Math.min(z.rect[1] + z.rect[3] - sz / 2, z.rect[1] + z.rect[3] * (0.25 + r() * 0.45)));
        add(p, { x, y }, "prop");
      });
    }
    // little scenes the world is set up for (the kite flier at the end of the
    // drawn string, the dog on the leash): fixed fillers, never of a group the
    // list asks for, so a vignette can never hold a second right answer
    for (const z of place.zones) for (const v of z.at || []) {
      if (!want.has(groupOf(v[0]))) add(v[0], { x: v[1], y: v[2] }, "fill").fixed = true;
    }

    // 2. the buddy, peeking out from behind one of the hiding props: its body
    //    sits up-and-to-the-side of the prop, which is drawn IN FRONT of it, so
    //    only part of it shows — the share the level asks for.
    const hiders = items.filter((it) => it.role === "prop" && place.hide.indexOf(it.kind) >= 0);
    const props = items.slice();
    const BS = 104 * SCALE;
    let buddy = null;
    {
      const [vlo, vhi] = lvl.buddy, mid = (vlo + vhi) / 2;
      let bestErr = Infinity;
      for (const hider of shuffle(r, hiders.slice())) {
        const side = r() < 0.5 ? -1 : 1;
        for (let s = 0; s < 2; s++) {
          for (let i = 0; i <= 16; i++) {
            const t = i / 16, sd = s ? -side : side;
            const cand = {
              kind: "buddy", art: null, size: BS, role: "buddy", rot: 0, flip: false,
              x: hider.x + sd * hider.size * (0.16 + 0.34 * t),
              y: hider.y - hider.size * (0.1 + 0.22 * t),
            };
            cand.x = Math.max(BS / 2, Math.min(D.W - BS / 2, cand.x));
            cand.y = Math.max(BS / 2, cand.y);
            cand.z = Math.min(bottomOf(cand), hider.z - 1);
            const arr = props.concat([cand]).sort(byDraw);
            const v = visibleFrac(arr, arr.indexOf(cand));
            const err = v < vlo || v > vhi ? 1 + Math.abs(v - mid) : Math.abs(v - mid);
            if (err < bestErr) { bestErr = err; buddy = cand; }
          }
        }
        if (bestErr < 0.5) break;
      }
      items.push(buddy);
    }

    // 3. the finds, each in a zone it lives in, kept clear of what is there.
    //    One single on a clue level is asked for WITH A CLUE (placeClue).
    const clueAt = lvl.clue ? clueCandidate(r, list) : [];
    let clued = false;
    const order = clueAt.concat(list.map((_, i) => i).filter((i) => clueAt.indexOf(i) < 0));
    for (const li of order) {
      const l = list[li];
      if (!clued && clueAt.indexOf(li) >= 0 && placeClue(r, place, l, items, H, add)) { clued = true; continue; }
      for (let i = 0; i < l.n; i++) {
        const z = zoneFor(l.kind);
        const at = bestSpot(r, z, sizeOf(l.kind), items, H, 16);
        const it = add(l.kind, at, "find");
        if (!l.art) l.art = it.art;
        else if (D.KINDS[l.kind].tone) { it.art = l.art; }   // a counted crowd is the SAME picture
      }
    }

    // 3b. tricky pictures: look-alikes crowd round what he is after (the swan
    //     beside the duck). Only a kind this place already has, never of a
    //     group the list asks for, in a zone that holds the find where it can.
    if (lvl.like) {
      for (const l of list) {
        for (const lk of (D.LIKE && D.LIKE[l.kind]) || []) {
          if (!D.KINDS[lk] || D.KINDS[lk].prop || want.has(groupOf(lk))) continue;
          const homes = place.zones.filter((z) => z.kinds && z.kinds[lk]);
          if (!homes.length) continue;
          const near = homes.filter((z) => z.kinds[l.kind]);
          for (let i = 0; i < lvl.like; i++) {
            const z = pick(r, near.length ? near : homes);
            const it = add(lk, bestSpot(r, z, sizeOf(lk), items, H, 8), "fill");
            it.like = l.kind;
          }
        }
      }
    }

    // 4. the fillers: everything else, never of a group the list asks for
    for (const z of place.zones) {
      const table = {};
      for (const k of Object.keys(z.kinds || {})) if (!want.has(groupOf(k))) table[k] = z.kinds[k];
      if (!Object.keys(table).length) continue;
      // a lane holds a row, not a crowd: about four things to a lane
      const n = z.lanes ? Math.min(z.lanes.length * (z.perLane || 4), Math.round(z.n * lvl.fill)) : Math.round(z.n * lvl.fill * DENSE);
      for (let i = 0; i < n; i++) {
        const kind = weighted(r, table);
        const at = bestSpot(r, z, sizeOf(kind), items, H, 8);
        add(kind, at, "fill");
      }
    }

    // 5. fairness: what is drawn in front of a find may not hide much of it.
    //    The things in the way that cover it most go first (scenery stays —
    //    it is never in front of a find; a filler is simply left out).
    items.sort(byDraw);
    const MIN_SHOWN = 0.78;
    for (let guard = 0; guard < 400; guard++) {
      let fixed = true;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.role !== "find" && it.role !== "buddy") continue;
        const need = it.role === "buddy" ? lvl.buddy[0] - 0.02 : MIN_SHOWN;
        if (visibleFrac(items, i) >= need) continue;
        // the item in front of it that covers most, that may go
        let worst = -1, worstD = Infinity;
        for (let j = i + 1; j < items.length; j++) {
          const o = items[j];
          if (o.role !== "fill" && !(o.role === "prop" && it.role === "find")) continue;
          if (o.role === "prop" && it.role === "buddy") continue;
          const d = Math.hypot(o.x - it.x, o.y - it.y) - rOf(o);
          if (d < rOf(it) && d < worstD) { worstD = d; worst = j; }
        }
        if (worst < 0) continue;
        const o = items[worst];
        if (o.role === "prop") {
          // scenery in front of a find: move the FIND up out from behind it
          it.y = Math.max(it.size / 2, it.y - o.size * 0.5);
          it.z = bottomOf(it);
          items.sort(byDraw);
        } else {
          items.splice(worst, 1);
        }
        fixed = false;
        break;
      }
      if (fixed) break;
    }

    // 6. a clue must still hold after the fairness pass (a find moved up out
    //    from behind scenery may have left its tree): if not, it is dropped
    //    and its decoys go with it, so a clue on the list is always true
    for (const l of list) {
      if (!l.clue) continue;
      if (!clueHolds(place, items, l)) {
        for (let i = items.length - 1; i >= 0; i--) if (items[i].role === "decoy" && items[i].kind === l.kind) items.splice(i, 1);
        delete l.clue;
      }
    }

    // 7. one thing on the list hides INSIDE scenery on the harder levels
    if (lvl.inside) hideInside(r, list, items);

    list.push({ kind: "buddy", n: 1 });
    return { place, level, seed, H, list, items };
  }

  // ---- Which thing is under a finger -----------------------------------------
  // The topmost thing whose body holds the point; if none does, the nearest
  // thing whose body edge is within `tol` units (a little finger that lands
  // just beside a small picture still gets it). Returns an index or -1.
  function hitTest(items, x, y, tol) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.hidden) continue;
      const R = rOf(it);
      if ((x - it.x) * (x - it.x) + (y - it.y) * (y - it.y) <= R * R) return i;
    }
    let best = -1, bestD = Infinity;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.hidden) continue;
      const d = Math.hypot(x - it.x, y - it.y) - rOf(it);
      if (d <= (tol || 0) && d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  // Every picture name a place can draw (for the art bundle and its test).
  function artNames() {
    const s = new Set([D.LOGO]);
    for (const k of Object.keys(D.KINDS)) {
      const v = D.KINDS[k];
      if (v.tone) for (const t of D.TONES) s.add(v.art + "-" + t + "-skin-tone");
      else s.add(v.art);
    }
    return [...s].sort();
  }

  // ---- The ground: everything drawn BEHIND the things ---------------------------
  // One SVG, in layout units, from the place's `ground` shapes and its `marks`
  // (little tufts, waves, dots, stars, craters, lane stripes) scattered from
  // the picture's seed, so each picture's ground is its own and the same every
  // time. No ids, no gradients, no filters: a flat drawing one picture at a
  // time, nothing that can collide with another svg on the page.
  const MARK = {
    tufts: (x, y, s, c) => '<path d="M' + (x - 6 * s) + " " + y + " l" + 4 * s + " " + -9 * s + " l" + 2 * s + " " + 9 * s + " l" + 4 * s + " " + -11 * s + " l" + 2 * s + " " + 11 * s + " l" + 4 * s + " " + -8 * s + " l" + 2 * s + " " + 8 * s + '" fill="none" stroke="' + c + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    waves: (x, y, s, c) => '<path d="M' + (x - 14 * s) + " " + y + " q" + 7 * s + " " + -6 * s + " " + 14 * s + " 0 t" + 14 * s + ' 0" fill="none" stroke="' + c + '" stroke-width="2.6" stroke-linecap="round" opacity=".7"/>',
    dots: (x, y, s, c) => '<circle cx="' + x + '" cy="' + y + '" r="' + 2.6 * s + '" fill="' + c + '"/>',
    stars: (x, y, s, c) => '<circle cx="' + x + '" cy="' + y + '" r="' + 1.6 * s + '" fill="' + c + '" opacity="' + (0.45 + 0.5 * (s - 0.6)) + '"/>',
    craters: (x, y, s, c) => '<ellipse cx="' + x + '" cy="' + y + '" rx="' + 22 * s + '" ry="' + 9 * s + '" fill="' + c + '" stroke="#6b728a" stroke-width="2"/>',
    stripes: (x, y, s, c) => '<rect x="' + (x - 18) + '" y="' + (y - 3) + '" width="36" height="6" rx="3" fill="' + c + '"/>',
  };
  function groundSvg(placeId, seed) {
    const p = placeOf(placeId);
    const r = rng(((seed >>> 0) ^ hash(placeId + "/ground")) >>> 0);
    let s = "";
    for (const g of p.ground) s += S.draw(g, r);
    for (const m of p.marks || []) {
      const [kind, x, y, w, h, c, n] = m;
      if (kind === "stripes") {
        // lane markings: dashed rows across a road, evenly down it
        for (let i = 0; i < n; i++) {
          const yy = y + (h * (i + 0.5)) / n;
          for (let xx = 30; xx < D.W; xx += 90) s += MARK.stripes(xx, yy, 1, c);
        }
        continue;
      }
      for (let i = 0; i < n; i++) s += MARK[kind](Math.round(x + r() * w), Math.round(y + r() * h), 0.6 + r() * 0.8, c);
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + D.W + " " + p.h + '" preserveAspectRatio="none" aria-hidden="true" focusable="false">' + s + "</svg>";
  }

  const SeekLogic = { clueHolds, anchors, atMark, heldBy, FAR, recolor, artBase, SHIRTS, groundSvg, MARK, rng, hash, layout, hitTest, visibleFrac, groupOf, placeOf, levelOf, inZone, artNames, rOf, BODY };
  if (typeof module !== "undefined" && module.exports) module.exports = SeekLogic;
  global.SeekLogic = SeekLogic;
})(typeof window !== "undefined" ? window : globalThis);
