// Gobble Hole — the PURE engine (PLAN_GOBBLE.md §4). Deterministic: a 60Hz
// fixed step, a seeded RNG only (never Math.random — a guardrail scans for
// it), plain-JSON state and zero DOM, so a node sim plays a whole scene
// headless exactly as the browser does. The renderer only READS this state.
// Dual export: window.HoleLogic in the browser, module.exports under node.

(function (global) {
  "use strict";
  const DATA = global.HoleData || (typeof require === "function" ? require("./hole-data.js") : null);
  const RULES = DATA.RULES;
  const SQ = RULES.SQ;
  const DT = 1 / 60;
  const IDLE = 0, FALL = 1, GONE = 2;

  // mulberry32: small, fast, and the same numbers on every engine.
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
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ONE metric for every ground distance. The ground is seen in 3/4 view and
  // the renderer draws the hole as an ellipse with ry = rx * SQ, so measuring
  // with dy / SQ makes "inside the hole" in physics and in the picture the
  // same thing — an object can never fall in while it LOOKS outside the rim.
  function gdist(ax, ay, bx, by) { return Math.hypot(ax - bx, (ay - by) / SQ); }

  // A place is a fixed WORLD (PLAN_GOBBLE.md §9): it no longer bends to the
  // screen — the screen is a camera onto it — so a saved run never depends on
  // the device it was played on.
  function worldOf(def) {
    const w = (def && def.world) || RULES.WORLD;
    return { W: w[0], H: w[1] };
  }

  function sceneById(id) { return DATA.SCENES.find((s) => s.id === id) || null; }

  // ---- Layout: where every object stands (deterministic) -------------------
  // In this order, because each step needs room the next one would take:
  //   1. the FINALE on its stage (the landmark you head for),
  //   2. three STARTERS right beside Gobble (the first gulp is instant),
  //   3. the TRAILS — lines of tiny bites leading out from the start,
  //   4. the big single things (a big thing needs the most room),
  //   5. the CLUMPS — a group stands together, so one pass hoovers up the lot,
  //   6. everything else, biggest first.
  // Placement is best-candidate sampling (of up to 24 legal spots, keep the
  // one with the most room), which spreads a world evenly without a grid look;
  // a zoned thing stands with its centre in its zone.
  function layout(def) {
    const { W, H } = worldOf(def);
    const rr = rng(hashStr(def.id + ":radius"));
    const rp = rng(hashStr(def.id + ":place"));
    const s0 = def.start || [0.5, 0.9];
    const start = { x: W * s0[0], y: H * s0[1] };
    const want = [];
    let clumpN = 0;
    def.tiers.forEach((t, i) => {
      for (const it of t.items) {
        const k = Math.max(1, it[3] | 0);
        for (let n = 0; n < it[1]; n++) {
          if (k > 1 && n % k === 0) clumpN++;
          want.push({ e: it[0], tier: i + 1, r: t.r[0] + (t.r[1] - t.r[0]) * rr(), zone: it[2] || null, clump: k > 1 ? clumpN : 0 });
        }
      }
    });
    const placed = [];
    const topMin = (r) => Math.max(r * SQ + RULES.EDGE, RULES.SPRITE_H * r - RULES.TOP_SLACK);
    const zoneRects = (z) => ((def.zones && def.zones[z]) || []).map((b) => [b[0] * W, b[1] * H, b[2] * W, b[3] * H]);
    const inRects = (x, y, rects) => rects.some((b) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]);
    // KEEP-OUTS. A PRIVATE zone holds only its own things (the sea holds the
    // boats, never an ice cream), and an AVOID rect holds nothing at all (the
    // lava). Both are about where a thing's CENTRE stands, like a zone.
    const priv = (def.private || []).map((z) => ({ z, rects: zoneRects(z) }));
    const avoid = (def.avoid || []).map((b) => [b[0] * W, b[1] * H, b[2] * W, b[3] * H]);
    const blocked = (x, y, zone) => {
      if (inRects(x, y, avoid)) return true;
      for (const p of priv) if (p.z !== zone && inRects(x, y, p.rects)) return true;
      return false;
    };
    // A coarse grid of what is placed, so a test of "is this spot free?" looks
    // only at its neighbours — a world of ~400 things measured in seconds
    // without it, which is a frozen screen on an iPad when a door is tapped.
    // It changes no answer: every neighbour that can matter is in the cells
    // searched (the reach covers the biggest thing placed so far).
    const G = 24, cols = Math.ceil(W / G) + 1, rows = Math.ceil(H / G) + 1;
    const cells = new Array(cols * rows);
    let rMax = 0;
    const near = (x, y, reach, fn) => {
      const cx0 = clamp(Math.floor((x - reach) / G), 0, cols - 1), cx1 = clamp(Math.floor((x + reach) / G), 0, cols - 1);
      const cy0 = clamp(Math.floor((y - reach * SQ) / G), 0, rows - 1), cy1 = clamp(Math.floor((y + reach * SQ) / G), 0, rows - 1);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const c = cells[cy * cols + cx];
          if (c) for (const p of c) if (fn(p) === false) return false;
        }
      }
      return true;
    };
    const legal = (x, y, r, nearStart, sep, zone) => {
      if (x < r + RULES.EDGE || x > W - r - RULES.EDGE) return false;
      if (y < topMin(r) || y > H - r * SQ - RULES.EDGE) return false;
      if (!nearStart && gdist(x, y, start.x, start.y) < RULES.START_CLEAR + r) return false;
      if (blocked(x, y, zone || null)) return false;
      return near(x, y, sep * (r + rMax), (p) => gdist(x, y, p.x, p.y) >= sep * (r + p.r));
    };
    // How much room a spot has: the gap to its nearest neighbour, capped at
    // ROOM (any two spots with more room than that are equally good). The
    // search reaches far enough that nothing outside it could come closer.
    const ROOM = 90;
    const room = (x, y, r) => {
      let m = ROOM;
      near(x, y, ROOM + r + rMax, (p) => { m = Math.min(m, gdist(x, y, p.x, p.y) - (r + p.r)); });
      return m;
    };
    const put = (o, x, y) => {
      o.x = x; o.y = y; o.done = true; placed.push(o);
      rMax = Math.max(rMax, o.r);
      const k = clamp(Math.floor(y / G), 0, rows - 1) * cols + clamp(Math.floor(x / G), 0, cols - 1);
      (cells[k] || (cells[k] = [])).push(o);
    };
    let relaxed = 0, zoneMiss = 0, broken = 0;

    // Best-candidate spot for a footprint of radius `r` (in its zone if any).
    function spot(r, zone) {
      const rects = zone ? zoneRects(zone) : [];
      let sep = RULES.SEP;
      for (let pass = 0; pass < 6; pass++) {
        const inZone = rects.length > 0 && pass < 3;
        let best = null, bestRoom = -Infinity, found = 0;
        for (let tries = 0; tries < 1500 && found < 24; tries++) {
          let x, y;
          if (inZone) {
            const b = rects[Math.floor(rp() * rects.length)];
            x = b[0] + (b[2] - b[0]) * rp();
            y = b[1] + (b[3] - b[1]) * rp();
          } else {
            x = r + RULES.EDGE + (W - 2 * (r + RULES.EDGE)) * rp();
            y = topMin(r) + (H - r * SQ - RULES.EDGE - topMin(r)) * rp();
          }
          if (!legal(x, y, r, false, sep, zone)) continue;
          found++;
          const m = room(x, y, r);
          if (m > bestRoom) { bestRoom = m; best = [x, y]; }
        }
        if (best) {
          if (rects.length && !inZone) zoneMiss++;
          return best;
        }
        if (pass >= 2) { sep *= 0.9; relaxed++; }
      }
      relaxed++;
      return [W / 2, H / 2];   // never happens for a shipped place (tested)
    }

    // 1. the finale, on its stage
    const at = def.finale.at || [0.5, 0.16];
    const fin = { e: def.finale.e, tier: def.tiers.length + 1, r: def.finale.r, zone: null, clump: 0, finale: true };
    put(fin, W * at[0], Math.max(H * at[1], topMin(fin.r)));

    // 2. the starters: a little arc just above Gobble — plain tiny bites (the
    //    first trail's bite if it has one), never a zoned or clumped thing
    const trails = def.trails || [];
    const plain = (w) => !w.done && w.tier === 1 && !w.zone && !w.clump;
    const pref = trails.length ? trails[0].e : null;
    const arc = [[-7, -6.5], [0, -9.5], [7, -6.5]];
    for (let i = 0; i < (def.starters || 0); i++) {
      const o = want.find((w) => plain(w) && w.e === pref) || want.find(plain);
      if (!o) break;
      o.starter = true;
      const a = arc[i % arc.length];
      put(o, start.x + a[0], start.y + a[1]);
    }

    // 3. the trails: from just outside the start, a gently bending line of
    //    bites toward `to`; a spot that is not free is simply skipped
    trails.forEach((tr, ti) => {
      const tx = W * tr.to[0], ty = H * tr.to[1];
      const dx = tx - start.x, dy = ty - start.y, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len, bend = (ti % 2 ? -1 : 1) * 7;
      for (let i = 0; i < RULES.TRAIL_MAX; i++) {
        const d = RULES.START_CLEAR + 6 + i * RULES.TRAIL_STEP;
        if (d > len) break;
        const o = want.find((w) => plain(w) && w.e === tr.e);
        if (!o) break;
        const wob = Math.sin((i / Math.max(1, RULES.TRAIL_MAX - 1)) * Math.PI) * bend;
        const x = start.x + ux * d - uy * wob, y = start.y + uy * d + ux * wob;
        if (!legal(x, y, o.r, false, RULES.SEP, null)) continue;
        o.trail = ti + 1;
        put(o, x, y);
      }
    });

    // 4. big singles, biggest first
    const singles = (min) => want.filter((w) => !w.done && !w.clump && w.tier >= min).sort((a, b) => b.r - a.r);
    for (const o of singles(3)) { const p = spot(o.r, o.zone); put(o, p[0], p[1]); }

    // 5. the clumps: find a centre with room for the whole group, then grow
    //    the group outward from it, each member touching (almost) the last
    const clumps = new Map();
    for (const w of want) if (!w.done && w.clump) {
      if (!clumps.has(w.clump)) clumps.set(w.clump, []);
      clumps.get(w.clump).push(w);
    }
    const order = [...clumps.values()].sort((a, b) => b[0].r - a[0].r);
    for (const g of order) {
      const rMax = Math.max(...g.map((m) => m.r));
      const foot = rMax * (1 + 1.15 * Math.sqrt(g.length - 1));
      const c = spot(foot, g[0].zone);
      // a zoned clump grows INSIDE its zone: a tulip that wanders off the
      // park onto the road is a tulip on the road
      const rects = g[0].zone ? zoneRects(g[0].zone) : [];
      const here = [];
      for (const m of g) {
        let ok = null;
        const fits = (x, y) => legal(x, y, m.r, false, RULES.SEP, m.zone) && (!rects.length || inRects(x, y, rects));
        if (!here.length && fits(c[0], c[1])) ok = c;
        for (let tries = 0; !ok && tries < 80; tries++) {
          const nb = here.length ? here[Math.floor(rp() * here.length)] : { x: c[0], y: c[1], r: 0 };
          const ang = rp() * Math.PI * 2, d = RULES.SEP * (m.r + nb.r) * (here.length ? 1.06 : 0.5) + 0.05;
          const x = nb.x + Math.cos(ang) * d, y = nb.y + Math.sin(ang) * d * SQ;
          if (fits(x, y)) ok = [x, y];
        }
        if (!ok) { ok = spot(m.r, m.zone); broken++; }
        put(m, ok[0], ok[1]);
        here.push(m);
      }
    }

    // 6. everything else, biggest first
    for (const o of singles(1)) { const p = spot(o.r, o.zone); put(o, p[0], p[1]); }

    const objects = placed.map((p, i) => ({
      id: i, e: p.e, tier: p.tier, r: round3(p.r), x: round3(p.x), y: round3(p.y),
      xp: Math.round(p.r * p.r * 10), finale: !!p.finale, starter: !!p.starter,
      clump: p.clump || 0, trail: p.trail || 0,
      st: IDLE, f: 0, fx: 0, fy: 0, wob: 0, cd: 0, pull: 0,
    }));
    return { W, H, start, objects, relaxed, zoneMiss, broken };
  }
  function round3(v) { return Math.round(v * 1000) / 1000; }

  // ---- Levels: DERIVED from the place's own objects, never hand-tuned ----
  // Level L eats every tier <= L+1. R[L] clears tier L+1's biggest thing by
  // HEAD (and the tier law, tested, is that tier L+2 is still too big). A grow
  // from level L-1 to L needs GROW_BITES[L-1] bites' worth of the NEWEST
  // edible tier (tier L) — a fraction of "everything edible" makes no sense
  // when there are 80 sweets over six screens, and this way the first
  // "BIGGER!" comes after about six sweets and no grow ever needs a hunt.
  function levelsOf(objects) {
    const T = Math.max(...objects.map((o) => o.tier));
    const R = [], C = [0];
    for (let L = 0; L < T; L++) {
      const big = Math.max(...objects.filter((o) => o.tier === L + 1).map((o) => o.r));
      R.push(round3(big / RULES.FIT * RULES.HEAD));
    }
    for (let L = 1; L < T; L++) {
      const tier = objects.filter((o) => o.tier === L);
      const mean = tier.reduce((s, o) => s + o.xp, 0) / Math.max(1, tier.length);
      const bites = RULES.GROW_BITES[Math.min(L - 1, RULES.GROW_BITES.length - 1)];
      C.push(Math.round(C[L - 1] + bites * mean));
    }
    return { R, C };
  }

  // TREASURES (PLAN_GOBBLE.md §12): three ordinary things in every place
  // glitter gold — a tiny one low on the island (found early), a small one
  // across the middle and a medium one up top (found late), each as far as it
  // can be from the start and from the others. They are picked FROM the
  // layout, never added to it, so a saved run keeps its meaning and the
  // world is exactly what it was.
  const GOLD_BANDS = [[0.62, 1], [0.33, 0.62], [0, 0.33]];
  function goldOf(objects, start, H) {
    const out = [];
    GOLD_BANDS.forEach((b, i) => {
      let best = null, bd = -1;
      for (const o of objects) {
        if (o.tier !== i + 1 || o.starter || o.trail || o.finale) continue;
        if (o.y < b[0] * H || o.y > b[1] * H) continue;
        let d = gdist(o.x, o.y, start.x, start.y);
        for (const t of out) d = Math.min(d, gdist(o.x, o.y, t.x, t.y));
        if (d > bd) { bd = d; best = o; }
      }
      if (best) out.push(best);
    });
    return out.map((o) => o.id);
  }

  // How many things a place holds, from its DATA alone (every thing it asks
  // for is placed, plus the finale) — cheap enough for the home screen, which
  // shows how far a half-eaten place got without laying the world out.
  function countOf(def) {
    let n = 1;
    for (const t of def.tiers) for (const it of t.items) n += it[1];
    return n;
  }

  // How far the camera pulls back at a level, relative to the start: ONE
  // curve for the renderer's zoom and for Gobble's speed, so he always crosses
  // about a screen a second whether he is a tiny mouth or a crater.
  function zoomScale(st, level) {
    const R = st.levels.R, lv = level == null ? st.hole.level : level;
    return Math.pow(R[clamp(lv, 0, R.length - 1)] / R[0], RULES.ZOOM);
  }

  // How much world the camera shows across the screen's SHORT side, in world
  // units: a bigger screen shows more world (it is not a blow-up), and the
  // view widens as Gobble grows — by the same curve as his speed above, so he
  // crosses about a screen a second at every size. The renderer draws with
  // it; this is its one owner.
  function viewSpan(st, shortPx, level) {
    const px = Number.isFinite(shortPx) && shortPx > 0 ? shortPx : 400;
    return RULES.VIEW0 * Math.pow(px / 400, RULES.VIEW_SCREEN) * zoomScale(st, level);
  }

  // ---- A run --------------------------------------------------------------
  function createGame(def) {
    if (typeof def === "string") def = sceneById(def);
    const lay = layout(def);
    const lv = levelsOf(lay.objects);
    const gold = goldOf(lay.objects, lay.start, lay.H);
    for (const id of gold) lay.objects[id].gold = true;
    return {
      id: def.id, W: lay.W, H: lay.H, start: lay.start,
      objects: lay.objects, levels: lv, gold,
      hole: { x: lay.start.x, y: lay.start.y, r: lv.R[0], R: lv.R[0], level: 0, xp: 0, tx: lay.start.x, ty: lay.start.y },
      t: 0, tick: 0, eaten: 0, total: lay.objects.length,
      won: false, done: false, winT: 0,
      sinceEat: 0, hint: -1, combo: 0, lastEatT: -9,
      events: [],
    };
  }

  function emit(st, ev) {
    st.events.push(ev);
    if (st.events.length > 200) st.events.splice(0, st.events.length - 200);
  }

  // Where Gobble may stand: it can overhang the scene edge a little, so
  // nothing near a wall is out of reach.
  function clampXY(st, x, y) {
    const h = st.hole, m = h.r * 0.35;
    return [clamp(x, m, st.W - m), clamp(y, m * SQ, st.H - m * SQ)];
  }

  // Aim Gobble at a point (world units). The glide does the rest.
  function setTarget(st, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const c = clampXY(st, x, y);
    st.hole.tx = c[0]; st.hole.ty = c[1];
  }

  const edible = (st, o) => o.st === IDLE && o.r <= st.hole.r * RULES.FIT;

  function nearestEdible(st) {
    const h = st.hole;
    let best = null, bd = Infinity;
    for (const o of st.objects) {
      if (!edible(st, o)) continue;
      const d = gdist(o.x, o.y, h.x, h.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // THE GOAL: once Gobble is big enough to eat the biggest thing in the
  // place, that is what he is here for — the hint and the edge arrow point at
  // it (PLAN_GOBBLE.md §12). Before that, and once it is eaten, there is none.
  function goalOf(st) {
    if (!st || st.won || st.hole.level < st.levels.R.length - 1) return null;
    for (const o of st.objects) if (o.finale) return o.st === IDLE ? o : null;
    return null;
  }

  function startFall(st, o) {
    const h = st.hole;
    o.st = FALL; o.f = 0; o.fx = o.x - h.x; o.fy = o.y - h.y;
    emit(st, { type: "fall", id: o.id });
  }

  function eat(st, o) {
    const h = st.hole;
    o.st = GONE;
    st.eaten++;
    st.sinceEat = 0; st.hint = -1;
    st.combo = st.t - st.lastEatT < 0.6 ? Math.min(st.combo + 1, 10) : 0;
    st.lastEatT = st.t;
    if (!st.won) h.xp += o.xp;
    // `vortex`: eaten by the win's slurp, not found by him
    emit(st, { type: "eat", id: o.id, e: o.e, r: o.r, tier: o.tier, combo: st.combo, finale: o.finale, gold: !!o.gold, vortex: st.won });
    const top = st.levels.R.length - 1;
    while (!st.won && h.level < top && h.xp >= st.levels.C[h.level + 1]) {
      h.level++;
      h.R = st.levels.R[h.level];
      // `ready`: this grow makes him big enough for the finale
      emit(st, { type: "grow", level: h.level, ready: h.level === top });
    }
    if (o.finale && !st.won) { st.won = true; st.winT = 0; emit(st, { type: "win" }); }
    if (st.won && st.eaten >= st.total && !st.done) { st.done = true; emit(st, { type: "allgone" }); }
  }

  // One fixed step.
  function step(st, dt) {
    dt = dt || DT;
    st.t += dt; st.tick++;
    const h = st.hole;
    if (st.won) {
      st.winT += dt;
      // Gobble glides to the middle for the big slurp
      const c = clampXY(st, st.W / 2, st.H * 0.52);
      h.tx = c[0]; h.ty = c[1];
    }

    // 1. glide toward the target: fast when far, gentle as it arrives
    const dx = h.tx - h.x, dy = h.ty - h.y, d = Math.hypot(dx, dy);
    if (d > 0.005) {
      const move = Math.min(d, Math.min(d * RULES.GAIN, RULES.VMAX * zoomScale(st)) * dt);
      h.x += (dx / d) * move; h.y += (dy / d) * move;
    }
    const c = clampXY(st, h.x, h.y);
    h.x = c[0]; h.y = c[1];

    // 2. grow toward this level's size (the picture eases; physics uses r)
    h.r += (h.R - h.r) * Math.min(1, dt * 7);
    if (Math.abs(h.R - h.r) < 0.01) h.r = h.R;

    // 3. every object
    for (const o of st.objects) {
      if (o.st === GONE) continue;
      if (o.wob > 0) o.wob = Math.max(0, o.wob - dt);
      if (o.cd > 0) o.cd = Math.max(0, o.cd - dt);
      if (o.st === FALL) {
        o.f += dt / (0.28 + 0.32 * Math.min(1, o.r / Math.max(h.r, 0.01)));
        if (o.f >= 1) { o.f = 1; eat(st, o); }
        continue;
      }
      const dist = gdist(o.x, o.y, h.x, h.y);
      const fits = o.r <= h.r * RULES.FIT;
      if (st.won) {
        // THE VORTEX: after the finale everything left spirals in, faster and
        // faster — a win never ends in a hunt for the last crumb.
        if (dist <= h.r - o.r * 0.35) { startFall(st, o); continue; }
        const sp = (40 + st.winT * 140) * dt;
        const gx = h.x - o.x, gy = (h.y - o.y) / SQ, gl = Math.hypot(gx, gy) || 1;
        const k = Math.min(sp, gl);
        o.x += (gx / gl) * k + (-gy / gl) * k * 0.45;
        o.y += ((gy / gl) * k + (gx / gl) * k * 0.45) * SQ;
        o.pull = 1;
        continue;
      }
      if (fits && dist <= h.r - o.r * 0.35) { startFall(st, o); continue; }
      const reach = h.r + o.r + RULES.PULL[0] + h.r * RULES.PULL[1];
      if (fits && dist < reach) {
        // THE MAGNET: a thing near the rim slides in — forgiving, and it
        // grows with Gobble.
        const sp = (RULES.PULL_SPEED[0] + h.r * RULES.PULL_SPEED[1]) * dt;
        const gx = h.x - o.x, gy = (h.y - o.y) / SQ, gl = Math.hypot(gx, gy) || 1;
        const k = Math.min(sp, gl);
        o.x += (gx / gl) * k;
        o.y += (gy / gl) * k * SQ;
        o.pull = clamp((reach - dist) / (reach - (h.r - o.r * 0.35)), 0, 1);
      } else {
        o.pull = 0;
      }
      if (!fits && dist < h.r + o.r * 0.5) {
        // TOO BIG: it wobbles on the rim and Gobble looks up at it
        if (o.wob <= 0) o.wob = 0.45;
        if (o.cd <= 0) { o.cd = 1.2; emit(st, { type: "bump", id: o.id }); }
      }
    }

    // 4. the hint: nothing eaten for a while → point at the goal if he is
    //    big enough for it, else at the nearest bite
    if (!st.won) {
      st.sinceEat += dt;
      if (st.sinceEat >= RULES.HINT_AFTER) {
        const n = goalOf(st) || nearestEdible(st);
        st.hint = n ? n.id : -1;
      }
    }
  }

  // A small greedy bot: aim at the nearest thing Gobble can eat. The tests
  // play every scene with it, and the browser's test hook uses the same one.
  function botTarget(st) {
    const n = nearestEdible(st);
    return n ? { x: n.x, y: n.y } : null;
  }

  // ---- Save / restore ------------------------------------------------------
  // A save stores only WHICH things were eaten (plus where Gobble stood); the
  // xp and the level are re-derived from them, so a corrupt or hand-edited
  // save can never hand Gobble a size it did not earn.
  function snapshot(st) {
    return {
      v: RULES.LAYOUT, scene: st.id,
      // a thing already FALLING is as good as eaten: leaving mid-gulp must
      // not bring it back standing on the rim
      eaten: st.objects.filter((o) => o.st !== IDLE).map((o) => o.id),
      x: round3(st.hole.x), y: round3(st.hole.y),
    };
  }
  function restore(snap) {
    // a run from another layout (the one-screen islands of phase 1) names
    // ids that mean different things here: it is dropped, never guessed at
    if (!snap || typeof snap !== "object" || snap.v !== RULES.LAYOUT) return null;
    const def = sceneById(snap.scene);
    if (!def) return null;
    const st = createGame(def);
    const ids = Array.isArray(snap.eaten) ? snap.eaten : [];
    const h = st.hole;
    for (const raw of ids) {
      const o = st.objects[raw | 0];
      if (!o || o.finale || o.st === GONE || !Number.isInteger(raw)) continue;
      o.st = GONE; st.eaten++; h.xp += o.xp;
    }
    while (h.level + 1 < st.levels.R.length && h.xp >= st.levels.C[h.level + 1]) h.level++;
    h.R = h.r = st.levels.R[h.level];
    if (Number.isFinite(snap.x) && Number.isFinite(snap.y)) {
      const c = clampXY(st, snap.x, snap.y);
      h.x = h.tx = c[0]; h.y = h.ty = c[1];
    }
    return st;
  }

  // A compact fingerprint of everything that decides the game (tests compare
  // runs with it). Non-finite numbers are kept visible, never flattened.
  function hashState(st) {
    const n = (v) => (Number.isFinite(v) ? Math.round(v * 1000) : String(v));
    const parts = [st.tick, st.eaten, st.won, st.hole.level, st.hole.xp, n(st.hole.x), n(st.hole.y), n(st.hole.r)];
    for (const o of st.objects) parts.push(o.st, n(o.x), n(o.y), n(o.f));
    return hashStr(parts.join(","));
  }

  const HoleLogic = {
    DT, IDLE, FALL, GONE,
    rng, hashStr, gdist, worldOf, sceneById, layout, levelsOf, zoomScale, viewSpan,
    goldOf, countOf, GOLD_BANDS,
    createGame, setTarget, step, nearestEdible, edible, goalOf, botTarget,
    snapshot, restore, hashState,
  };
  global.HoleLogic = HoleLogic;
  if (typeof module !== "undefined" && module.exports) module.exports = HoleLogic;
})(typeof window !== "undefined" ? window : globalThis);
