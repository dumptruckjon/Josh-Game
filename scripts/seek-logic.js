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
      const x = zx + r() * zw, y = zy + r() * zh;
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

  function personArt(r, k) {
    return k.tone ? k.art + "-" + pick(r, D.TONES) + "-skin-tone" : k.art;
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
        kind, art: artName || personArt(r, k), x: at.x, y: at.y, size: k.size, role,
        rot: k.prop || k.sky ? 0 : Math.round((r() - 0.5) * 16), flip: !k.prop && r() < 0.5,
      };
      it.z = bottomOf(it);
      items.push(it);
      return it;
    };

    const list = chooseList(r, place, lvl);
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
        const k = D.KINDS[p], slot = D.W / ps.length;
        const x = Math.max(k.size / 2, Math.min(D.W - k.size / 2, slot * (i + 0.5) + (r() - 0.5) * slot * 0.35));
        const y = Math.max(z.rect[1] + k.size * 0.35, Math.min(z.rect[1] + z.rect[3] - k.size / 2, z.rect[1] + z.rect[3] * (0.25 + r() * 0.45)));
        add(p, { x, y }, "prop");
      });
    }

    // 2. the buddy, peeking out from behind one of the hiding props: its body
    //    sits up-and-to-the-side of the prop, which is drawn IN FRONT of it, so
    //    only part of it shows — the share the level asks for.
    const hiders = items.filter((it) => it.role === "prop" && place.hide.indexOf(it.kind) >= 0);
    const props = items.slice();
    const BS = 104;
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

    // 3. the finds, each in a zone it lives in, kept clear of what is there
    for (const l of list) {
      for (let i = 0; i < l.n; i++) {
        const z = zoneFor(l.kind);
        const at = bestSpot(r, z, D.KINDS[l.kind].size, items, H, 16);
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
            const it = add(lk, bestSpot(r, z, D.KINDS[lk].size, items, H, 8), "fill");
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
      const n = Math.round(z.n * lvl.fill);
      for (let i = 0; i < n; i++) {
        const kind = weighted(r, table);
        const at = bestSpot(r, z, D.KINDS[kind].size, items, H, 8);
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
      const R = rOf(it);
      if ((x - it.x) * (x - it.x) + (y - it.y) * (y - it.y) <= R * R) return i;
    }
    let best = -1, bestD = Infinity;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
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
    for (const g of p.ground) {
      if (g[0] === "rect") s += '<rect x="' + g[1] + '" y="' + g[2] + '" width="' + g[3] + '" height="' + g[4] + '" fill="' + g[5] + '"/>';
      else if (g[0] === "ellipse") s += '<ellipse cx="' + g[1] + '" cy="' + g[2] + '" rx="' + g[3] + '" ry="' + g[4] + '" fill="' + g[5] + '"/>';
      else if (g[0] === "path") s += '<path d="' + g[1] + '" fill="none" stroke="' + g[2] + '" stroke-width="' + g[3] + '" stroke-linecap="round"/>';
    }
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

  const SeekLogic = { groundSvg, MARK, rng, hash, layout, hitTest, visibleFrac, groupOf, placeOf, levelOf, inZone, artNames, rOf, BODY };
  if (typeof module !== "undefined" && module.exports) module.exports = SeekLogic;
  global.SeekLogic = SeekLogic;
})(typeof window !== "undefined" ? window : globalThis);
