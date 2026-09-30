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

  // The scene keeps its AREA and adapts its ASPECT to the screen. Quantized so
  // a saved run rebuilds exactly the same layout.
  function sizeFor(aspect) {
    const a = Number.isFinite(aspect) ? aspect : 0.75;
    const q = Math.round(clamp(a, RULES.ASPECT[0], RULES.ASPECT[1]) * 100) / 100;
    return { aspect: q, W: Math.sqrt(RULES.AREA * q), H: Math.sqrt(RULES.AREA / q) };
  }

  function sceneById(id) { return DATA.SCENES.find((s) => s.id === id) || null; }

  // ---- Layout: where every object stands (deterministic) -------------------
  // The FINALE stands at the top centre as the scene's landmark (the goal you
  // can see from the start); the three STARTERS sit right beside Gobble so the
  // first gulp is instant; then the rest go down biggest-first by best-
  // candidate sampling (of 24 legal spots, keep the one with the most room),
  // which spreads a scene evenly without a grid look.
  function layout(def, aspect) {
    const { aspect: q, W, H } = sizeFor(aspect);
    const rr = rng(hashStr(def.id + ":radius"));      // sizes: the same on every screen
    const rp = rng(hashStr(def.id + ":place:" + q));  // places: per aspect
    const start = { x: W / 2, y: H - RULES.START_Y };
    const want = [];
    def.tiers.forEach((t, i) => {
      for (const it of t.items) {
        for (let k = 0; k < it[1]; k++) {
          want.push({ e: it[0], tier: i + 1, r: t.r[0] + (t.r[1] - t.r[0]) * rr(), zone: it[2] || null });
        }
      }
    });
    const placed = [];
    const topMin = (r) => Math.max(r * SQ + RULES.EDGE, RULES.SPRITE_H * r - RULES.TOP_SLACK);
    const legal = (x, y, r, starter, sep) => {
      if (x < r + RULES.EDGE || x > W - r - RULES.EDGE) return false;
      if (y < topMin(r) || y > H - r * SQ - RULES.EDGE) return false;
      if (!starter && gdist(x, y, start.x, start.y) < RULES.START_CLEAR + r) return false;
      for (const p of placed) if (gdist(x, y, p.x, p.y) < sep * (r + p.r)) return false;
      return true;
    };
    const room = (x, y, r) => {
      let m = Infinity;
      for (const p of placed) m = Math.min(m, gdist(x, y, p.x, p.y) - (r + p.r));
      return m;
    };
    const put = (o, x, y) => { o.x = x; o.y = y; placed.push(o); };

    // 1. the finale: top centre, low enough for its tall sprite to fit
    const fin = { e: def.finale.e, tier: def.tiers.length + 1, r: def.finale.r, zone: null, finale: true };
    put(fin, W / 2, Math.max(0.3 * H, topMin(fin.r)));

    // 2. the starters: a little arc just above Gobble
    const n0 = Math.min(def.starters || 0, want.length);
    const arc = [[-7, -6.5], [0, -9.5], [7, -6.5]];
    const starters = [];
    for (let i = 0; i < n0; i++) {
      const o = want.find((w) => w.tier === 1 && !w.starter && !starters.includes(w));
      if (!o) break;
      o.starter = true; starters.push(o);
      const a = arc[i % arc.length];
      put(o, start.x + a[0], start.y + a[1]);
    }

    // 3. everything else, biggest first (a big thing needs the most room)
    const rest = want.filter((w) => !w.starter).sort((a, b) => b.r - a.r);
    let relaxed = 0, zoneMiss = 0;
    const zoneRects = (z) => ((def.zones && def.zones[z]) || []).map((b) => [b[0] * W, b[1] * H, b[2] * W, b[3] * H]);
    for (const o of rest) {
      let sep = RULES.SEP, done = false;
      const rects = o.zone ? zoneRects(o.zone) : [];
      for (let pass = 0; pass < 6 && !done; pass++) {
        const inZone = rects.length > 0 && pass < 3;
        let best = null, bestRoom = -Infinity, found = 0;
        for (let tries = 0; tries < 1500 && found < 24; tries++) {
          let x, y;
          if (inZone) {
            const b = rects[Math.floor(rp() * rects.length)];
            // a zone is where the thing SITS: its centre in the zone (it may
            // overhang the edge a little — a bus is wider than a lane)
            x = b[0] + (b[2] - b[0]) * rp();
            y = b[1] + (b[3] - b[1]) * rp();
          } else {
            x = o.r + RULES.EDGE + (W - 2 * (o.r + RULES.EDGE)) * rp();
            y = topMin(o.r) + (H - o.r * SQ - RULES.EDGE - topMin(o.r)) * rp();
          }
          if (!legal(x, y, o.r, false, sep)) continue;
          found++;
          const m = room(x, y, o.r);
          if (m > bestRoom) { bestRoom = m; best = [x, y]; }
        }
        if (best) {
          put(o, best[0], best[1]);
          if (rects.length && !inZone) zoneMiss++;
          done = true;
        } else if (pass >= 2) {
          sep *= 0.9; relaxed++;
        }
      }
      if (!done) { relaxed++; put(o, W / 2, H / 2); } // never happens for a shipped scene (tested)
    }

    const objects = placed.map((p, i) => ({
      id: i, e: p.e, tier: p.tier, r: round3(p.r), x: round3(p.x), y: round3(p.y),
      xp: Math.round(p.r * p.r * 10), finale: !!p.finale, starter: !!p.starter,
      st: IDLE, f: 0, fx: 0, fy: 0, wob: 0, cd: 0, pull: 0,
    }));
    return { W, H, aspect: q, start, objects, relaxed, zoneMiss };
  }
  function round3(v) { return Math.round(v * 1000) / 1000; }

  // ---- Levels: DERIVED from the scene's own objects, never hand-tuned ----
  // Level L eats every tier <= L+1. R[L] clears tier L+1's biggest thing by
  // HEAD; C[L] (cumulative xp to reach level L) is ALPHA of everything that
  // was edible below it — so a grow is always reachable, never needs the last
  // hidden crumb, and the first one comes fast.
  function levelsOf(objects) {
    const T = Math.max(...objects.map((o) => o.tier));
    const R = [], C = [0];
    for (let L = 0; L < T; L++) {
      const big = Math.max(...objects.filter((o) => o.tier === L + 1).map((o) => o.r));
      R.push(round3(big / RULES.FIT * RULES.HEAD));
    }
    for (let L = 1; L < T; L++) {
      const xp = objects.filter((o) => o.tier <= L).reduce((s, o) => s + o.xp, 0);
      const a = RULES.ALPHA[Math.min(L - 1, RULES.ALPHA.length - 1)];
      C.push(Math.round(a * xp));
    }
    return { R, C };
  }

  // ---- A run --------------------------------------------------------------
  function createGame(def, opts) {
    if (typeof def === "string") def = sceneById(def);
    opts = opts || {};
    const lay = layout(def, opts.aspect);
    const lv = levelsOf(lay.objects);
    return {
      id: def.id, W: lay.W, H: lay.H, aspect: lay.aspect, start: lay.start,
      objects: lay.objects, levels: lv,
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
    emit(st, { type: "eat", id: o.id, e: o.e, r: o.r, tier: o.tier, combo: st.combo, finale: o.finale });
    while (!st.won && h.level + 1 < st.levels.R.length && h.xp >= st.levels.C[h.level + 1]) {
      h.level++;
      h.R = st.levels.R[h.level];
      emit(st, { type: "grow", level: h.level });
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
      const move = Math.min(d, Math.min(d * RULES.GAIN, RULES.VMAX) * dt);
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

    // 4. the hint: nothing eaten for a while → point at the nearest bite
    if (!st.won) {
      st.sinceEat += dt;
      if (st.sinceEat >= RULES.HINT_AFTER) {
        const n = nearestEdible(st);
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
      scene: st.id, aspect: st.aspect,
      // a thing already FALLING is as good as eaten: leaving mid-gulp must
      // not bring it back standing on the rim
      eaten: st.objects.filter((o) => o.st !== IDLE).map((o) => o.id),
      x: round3(st.hole.x), y: round3(st.hole.y),
    };
  }
  function restore(snap) {
    if (!snap || typeof snap !== "object") return null;
    const def = sceneById(snap.scene);
    if (!def) return null;
    const st = createGame(def, { aspect: Number(snap.aspect) });
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
    rng, hashStr, gdist, sizeFor, sceneById, layout, levelsOf,
    createGame, setTarget, step, nearestEdible, edible, botTarget,
    snapshot, restore, hashState,
  };
  global.HoleLogic = HoleLogic;
  if (typeof module !== "undefined" && module.exports) module.exports = HoleLogic;
})(typeof window !== "undefined" ? window : globalThis);
