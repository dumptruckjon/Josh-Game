// Gobble Hole — the PURE engine (PLAN_GOBBLE.md §4, §14). Deterministic: a
// 60Hz fixed step, a seeded RNG only (never Math.random — a guardrail scans for
// it), plain-JSON state and zero DOM, so a node sim plays a whole place
// headless exactly as the browser does. The renderer only READS this state.
// Dual export: window.HoleLogic in the browser, module.exports under node.
//
// Phase 4 (§14, the owner's pick of 2026-10-06: "make sure the setup of
// objects varies per level significantly … the layout and shape of the level
// and challenge should feel different"): a place is no longer a rectangle of
// scattered things. It has a SHAPE (a round park, a heart, islands, a spiral,
// a maze), things Gobble must walk AROUND (water, lava, hedges, shelves), and
// its own CHALLENGE (things that ride a track, walls of food he eats through
// once big enough, a key that opens a gate, portals, surprise boxes, a river
// that carries him, ice he slides on, a cave lit only round him). All of it is
// DATA in hole-data.js; this file is the one place it becomes rules.

(function (global) {
  "use strict";
  const DATA = global.HoleData || (typeof require === "function" ? require("./hole-data.js") : null);
  const RULES = DATA.RULES;
  const SQ = RULES.SQ;
  const DT = 1 / 60;
  // A thing's state. HIDDEN is a surprise not yet out: the toys inside a box
  // (out when the box is eaten) or the fruit in a tree (out when Gobble bumps
  // it). It counts in the place's total but is never drawn, eaten or pointed at.
  const IDLE = 0, FALL = 1, GONE = 2, HIDDEN = 3;
  const FAR = 1e6;

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
  function round3(v) { return Math.round(v * 1000) / 1000; }

  // ONE metric for every ground distance. The ground is seen in 3/4 view and
  // the renderer draws the hole as an ellipse with ry = rx * SQ, so measuring
  // with dy / SQ makes "inside the hole" in physics and in the picture the
  // same thing — an object can never fall in while it LOOKS outside the rim.
  function gdist(ax, ay, bx, by) { return Math.hypot(ax - bx, (ay - by) / SQ); }

  // A place is a fixed WORLD (PLAN_GOBBLE.md §9): it no longer bends to the
  // screen — the screen is a camera onto it — so a saved run never depends on
  // the device it was played on. A place may name its own size.
  function worldOf(def) {
    const w = (def && def.world) || RULES.WORLD;
    return { W: w[0], H: w[1] };
  }

  function sceneById(id) { return DATA.SCENES.find((s) => s.id === id) || null; }

  // ---- SHAPES ---------------------------------------------------------------
  // A place's outline, its water, its walls and its zones are SHAPES: signed
  // distance functions (negative inside) in GROUND space — y divided by SQ —
  // so "how far inside" is measured the way every other ground distance is.
  // Positions are normalized to the world ([0,1] across and down); a circle's
  // or ring's size is a fraction of the world's WIDTH on the ground (it draws
  // as an ellipse, like a rug); an oval's is a fraction of the world's width
  // and height AS SEEN (an oval island fills a portrait world); a path's `w`
  // and a rect's `round` are world units.
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    let t = L2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - ax - dx * t, py - ay - dy * t);
  }
  function compileShape(s, W, H) {
    const X = (n) => n * W, Y = (n) => (n * H) / SQ;
    let f = null;
    if (s.rect) {
      const b = s.rect;
      const x0 = X(Math.min(b[0], b[2])), x1 = X(Math.max(b[0], b[2])), y0 = Y(Math.min(b[1], b[3])), y1 = Y(Math.max(b[1], b[3]));
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const r = Math.max(0, Math.min(s.round || 0, (x1 - x0) / 2, (y1 - y0) / 2));
      const hx = (x1 - x0) / 2 - r, hy = (y1 - y0) / 2 - r;
      f = (px, py) => {
        const qx = Math.abs(px - cx) - hx, qy = Math.abs(py - cy) - hy;
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
      };
    } else if (s.circle) {
      const cx = X(s.circle[0]), cy = Y(s.circle[1]), r = s.circle[2] * W;
      f = (px, py) => Math.hypot(px - cx, py - cy) - r;
    } else if (s.oval) {
      // an ellipse as SEEN: semi-axes rx * W across and ry * H down the
      // screen (ry * H / SQ on the ground). The distance is the usual first-
      // order estimate, never deeper than the true depth (so a thing kept r
      // inside it really is r inside).
      const cx = X(s.oval[0]), cy = Y(s.oval[1]), ax = s.oval[2] * W, ay = (s.oval[3] * H) / SQ, m = Math.min(ax, ay);
      f = (px, py) => {
        const u = (px - cx) / ax, v = (py - cy) / ay, k = Math.hypot(u, v), g = Math.hypot(u / ax, v / ay);
        const a = (k - 1) * m;
        return g < 1e-12 ? a : Math.max(a, (k * (k - 1)) / g);
      };
    } else if (s.ring) {
      const cx = X(s.ring[0]), cy = Y(s.ring[1]), r0 = s.ring[2] * W, r1 = s.ring[3] * W, mid = (r0 + r1) / 2, half = (r1 - r0) / 2;
      f = (px, py) => Math.abs(Math.hypot(px - cx, py - cy) - mid) - half;
    } else if (s.path) {
      const P = s.path.map((p) => [X(p[0]), Y(p[1])]), half = (s.w || 10) / 2;
      f = segIndex(segsOf(P, half), SHAPE_CAP);
    } else if (s.poly) {
      const P = s.poly.map((p) => [X(p[0]), Y(p[1])]);
      f = (px, py) => {
        let d = Infinity, inside = false;
        for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
          const xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1];
          const v = segDist(px, py, xj, yj, xi, yi);
          if (v < d) d = v;
          if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside ? -d : d;
      };
    }
    if (!f) throw new Error("Gobble Hole: a shape of no known kind: " + JSON.stringify(s));
    if (s.not) {
      const g = compileShape(s.not, W, H), f0 = f;
      f = (px, py) => Math.max(f0(px, py), -g(px, py));
    }
    return f;
  }
  // A SPATIAL INDEX over line segments (ground coordinates), for the shapes
  // drawn as lines (a hedge ring, a spiral path, a lava river) and for the
  // keep-outs of the layout: f(x, y) is the distance to the nearest segment
  // less its half-width — EXACT whenever that is below `cap`, and some value
  // of at least `cap` otherwise. Nothing in the game asks how far past `cap`
  // a point is (a thing needs at most its radius + EDGE of room, the walking
  // grid one unit, an outline the zero line), so the far answer can be
  // cheap: a point only measures the segments near it. A hedge maze measured
  // every segment of every ring from every point of the island (most of a
  // second to build), and the layout's keep-outs did the same for every spot
  // it tried. A segment is listed in every cell its reach (half + cap)
  // touches, so the nearest one is always among a point's cell's list when
  // it is within reach.
  const SHAPE_CAP = 64, INDEX_CELL = 32;
  function segsOf(P, half) {
    if (P.length === 1) return [{ ax: P[0][0], ay: P[0][1], bx: P[0][0], by: P[0][1], half }];
    const out = [];
    for (let i = 1; i < P.length; i++) out.push({ ax: P[i - 1][0], ay: P[i - 1][1], bx: P[i][0], by: P[i][1], half });
    return out;
  }
  function segIndex(segs, cap) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const g of segs) {
      const pad = g.half + cap;
      x0 = Math.min(x0, Math.min(g.ax, g.bx) - pad); x1 = Math.max(x1, Math.max(g.ax, g.bx) + pad);
      y0 = Math.min(y0, Math.min(g.ay, g.by) - pad); y1 = Math.max(y1, Math.max(g.ay, g.by) + pad);
    }
    if (!segs.length) return () => cap;
    const S = INDEX_CELL, nx = Math.ceil((x1 - x0) / S) + 1, ny = Math.ceil((y1 - y0) / S) + 1;
    const cells = new Array(nx * ny);
    for (const g of segs) {
      const pad = g.half + cap;
      const i0 = Math.floor((Math.min(g.ax, g.bx) - pad - x0) / S), i1 = Math.floor((Math.max(g.ax, g.bx) + pad - x0) / S);
      const j0 = Math.floor((Math.min(g.ay, g.by) - pad - y0) / S), j1 = Math.floor((Math.max(g.ay, g.by) + pad - y0) / S);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) (cells[j * nx + i] || (cells[j * nx + i] = [])).push(g);
    }
    return (px, py) => {
      const i = Math.floor((px - x0) / S), j = Math.floor((py - y0) / S);
      if (i < 0 || j < 0 || i >= nx || j >= ny) return cap;
      const list = cells[j * nx + i];
      if (!list) return cap;
      let d = Infinity;
      for (const g of list) { const v = segDist(px, py, g.ax, g.ay, g.bx, g.by) - g.half; if (v < d) d = v; }
      return d;
    };
  }
  function unionOf(fs) {
    if (fs.length === 1) return fs[0];
    return (px, py) => {
      let d = FAR;
      for (const f of fs) { const v = f(px, py); if (v < d) d = v; }
      return d;
    };
  }
  // A point along a ground polyline: its distance to it and its direction.
  function nearSeg(gp, px, py) {
    let d = Infinity, ux = 0, uy = 0;
    for (let i = 1; i < gp.length; i++) {
      const ax = gp[i - 1][0], ay = gp[i - 1][1], bx = gp[i][0], by = gp[i][1];
      const v = segDist(px, py, ax, ay, bx, by);
      if (v < d) {
        d = v;
        const l = Math.hypot(bx - ax, by - ay) || 1;
        ux = (bx - ax) / l; uy = (by - ay) / l;
      }
    }
    return { d, ux, uy };
  }

  // ---- THE PLACE'S GEOMETRY (worked out once per place) ----------------------
  // FIELDS: the island's and the walkable ground's signed distance, sampled on
  // a FIELD-unit grid (with a margin past the world, so every outline closes)
  // and read back by bilinear interpolation — a thing placed or a step taken
  // costs a lookup, not a walk over every wall of a maze.
  // NAV: a NAV-unit grid of cells Gobble can stand in, with the moves between
  // them that cross no wall, for the paths that take him round water and
  // walls when the way under a finger is not straight.
  const geoms = new WeakMap();
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function geomOf(def) {
    if (typeof def === "string") def = sceneById(def);
    const cached = geoms.get(def);
    if (cached) return cached;
    const { W, H } = worldOf(def);
    const land = unionOf((def.land || [{ rect: [0, 0, 1, 1], round: RULES.CORNER }]).map((s) => compileShape(s, W, H)));
    const blockFs = (def.blocks || []).map((s) => compileShape(s, W, H));
    const bridgeFs = (def.bridges || []).map((s) => compileShape(Object.assign({}, s, { w: s.w || 24 }), W, H));
    const FS = RULES.FIELD, PAD = 6, fx0 = -PAD, fy0 = -PAD;
    const fnx = Math.ceil((W + 2 * PAD) / FS) + 1, fny = Math.ceil((H + 2 * PAD) / FS) + 1;
    const fIsl = new Float32Array(fnx * fny), fWalk = new Float32Array(fnx * fny);
    for (let j = 0; j < fny; j++) {
      const gy = (fy0 + j * FS) / SQ;
      for (let i = 0; i < fnx; i++) {
        const gx = fx0 + i * FS, k = j * fnx + i;
        const isl = land(gx, gy);
        let w = isl;
        for (const f of blockFs) { const v = -f(gx, gy); if (v > w) w = v; }
        for (const f of bridgeFs) { const v = f(gx, gy); if (v < w) w = v; }
        fIsl[k] = isl; fWalk[k] = w;
      }
    }
    function sample(F, x, y) {
      const u = (x - fx0) / FS, v = (y - fy0) / FS;
      if (!(u >= 0 && v >= 0 && u <= fnx - 1 && v <= fny - 1)) return FAR;
      const i = Math.min(fnx - 2, Math.floor(u)), j = Math.min(fny - 2, Math.floor(v));
      const a = u - i, b = v - j, k = j * fnx + i;
      return (F[k] * (1 - a) + F[k + 1] * a) * (1 - b) + (F[k + fnx] * (1 - a) + F[k + fnx + 1] * a) * b;
    }
    const isl = (x, y) => sample(fIsl, x, y);
    const walk = (x, y) => sample(fWalk, x, y);

    // the NAV grid
    const N = RULES.NAV, nc = Math.ceil(W / N), nr = Math.ceil(H / N), n = nc * nr;
    const cx = (k) => ((k % nc) + 0.5) * N, cy = (k) => (Math.floor(k / nc) + 0.5) * N;
    const cellOf = (x, y) => clamp(Math.floor(y / N), 0, nr - 1) * nc + clamp(Math.floor(x / N), 0, nc - 1);
    const ok = new Uint8Array(n);
    for (let k = 0; k < n; k++) ok[k] = walk(cx(k), cy(k)) <= -RULES.WALK_IN ? 1 : 0;
    const doff = DIRS.map(([dx, dy]) => dy * nc + dx);
    const dcost = DIRS.map(([dx, dy]) => Math.hypot(dx * N, (dy * N) / SQ));
    // a move is clear when both cells are standing room, the segment between
    // them crosses no wall (a thin hedge between two cell centres would
    // otherwise be walked through) and a diagonal cuts no corner
    const edge = new Uint8Array(n);
    for (let k = 0; k < n; k++) {
      if (!ok[k]) continue;
      const i = k % nc, j = Math.floor(k / nc);
      let bits = 0;
      for (let d = 0; d < 8; d++) {
        const ii = i + DIRS[d][0], jj = j + DIRS[d][1];
        if (ii < 0 || jj < 0 || ii >= nc || jj >= nr) continue;
        const m = jj * nc + ii;
        if (!ok[m]) continue;
        if (d >= 4 && (!ok[j * nc + ii] || !ok[jj * nc + i])) continue;
        let clear = true;
        for (const t of [0.25, 0.5, 0.75]) {
          if (walk(cx(k) + DIRS[d][0] * N * t, cy(k) + DIRS[d][1] * N * t) > 0) { clear = false; break; }
        }
        if (clear) bits |= 1 << d;
      }
      edge[k] = bits;
    }
    const okCells = [];
    for (let k = 0; k < n; k++) if (ok[k]) okCells.push(k);
    if (!okCells.length) throw new Error("Gobble Hole: " + def.id + " has no ground to stand on");
    // NEAR: for every cell, the nearest cell he can stand in (a finger on the
    // pond sends him to its shore)
    const near = new Int32Array(n).fill(-1);
    {
      const dist = new Float64Array(n).fill(Infinity), hp = new Heap();
      for (const k of okCells) { dist[k] = 0; near[k] = k; hp.push(0, k); }
      while (hp.n) {
        const c = hp.top(), k = hp.pop();
        if (c > dist[k]) continue;
        const i = k % nc, j = Math.floor(k / nc);
        for (let d = 0; d < 8; d++) {
          const ii = i + DIRS[d][0], jj = j + DIRS[d][1];
          if (ii < 0 || jj < 0 || ii >= nc || jj >= nr) continue;
          const m = jj * nc + ii, v = c + dcost[d];
          if (v < dist[m]) { dist[m] = v; near[m] = near[k]; hp.push(v, m); }
        }
      }
    }
    const okNear = (x, y) => {
      const k = cellOf(x, y);
      return ok[k] ? k : near[k];
    };

    const start = { x: W * (def.start || [0.5, 0.9])[0], y: H * (def.start || [0.5, 0.9])[1] };
    const startCell = okNear(start.x, start.y);

    // PORTALS: pairs of ends; stepping on a live end sends him to its partner
    // (a one-way portal's far end is only an exit)
    const ends = [];
    (def.portals || []).forEach((p, pi) => {
      const ia = ends.length;
      // a CANNON (§17) flies him over to the other end instead of popping him
      // out of it — a one-way cannon's landing spot is only an exit
      for (const [q, live] of [[p.a, true], [p.b, !p.oneway]]) {
        const x = q[0] * W, y = q[1] * H;
        ends.push({ x, y, cell: okNear(x, y), to: ends.length === ia ? ia + 1 : ia, pi, look: p.look || (p.fly ? "cannon" : "wormhole"), live, fly: !!p.fly });
      }
    });
    const jumps = new Map();
    ends.forEach((e, ei) => {
      if (!e.live) return;
      if (!jumps.has(e.cell)) jumps.set(e.cell, []);
      jumps.get(e.cell).push(ei);
    });
    // cells near a portal cost extra to cross, so a route goes ROUND a portal
    // unless the portal is the way
    const pen = new Uint8Array(n);
    if (ends.length) {
      for (const k of okCells) {
        for (const e of ends) if (e.live && gdist(cx(k), cy(k), e.x, e.y) < RULES.PORTAL_R * 1.4 + N) { pen[k] = 1; break; }
      }
    }

    // TRACKS: the lines things ride (a toy train's loop, a street, an orbit)
    const tracks = {};
    for (const [id, t] of Object.entries(def.tracks || {})) tracks[id] = compileTrack(id, t, W, H);
    // FLOWS: currents that carry him (a river, a conveyor belt)
    const flows = (def.flows || []).map((f) => {
      // a TURNTABLE (§17): a spinning ground circle — `spin` [x, y, r] (r a
      // fraction of the width), `v` the speed at its rim
      if (f.spin) {
        const x = f.spin[0] * W, y = f.spin[1] * H, rg = f.spin[2] * W;
        return { spin: { x, y, rg }, pts: [[x, y]], gp: [[x, y / SQ]], w: rg * 2, v: f.v || 20, look: f.look || "turntable", things: !!f.things };
      }
      const pts = f.pts.map((p) => [p[0] * W, p[1] * H]);
      return { pts, gp: pts.map((p) => [p[0], p[1] / SQ]), w: f.w || 30, v: f.v || 20, look: f.look || "river", things: !!f.things };
    });
    // BRIDGES (drawn by the renderer): over water, lava or the void
    const bridges = (def.bridges || []).map((b) => {
      const pts = b.path.map((p) => [p[0] * W, p[1] * H]);
      return { pts, gp: pts.map((p) => [p[0], p[1] / SQ]), w: b.w || 24, look: b.look || "planks" };
    });

    const G = {
      def, W, H, start, startCell, FS, fx0, fy0, fnx, fny, fIsl, fWalk, sample, isl, walk,
      N, nc, nr, n, ok, edge, doff, dcost, okCells, near, cx, cy, cellOf, okNear,
      ends, jumps, pen, tracks, flows, bridges, rd: null, rdMax: 1, mid: null,
      scratch: null, zones: new Map(),
    };
    G.scratch = { dist: new Float64Array(n), mark: new Uint32Array(n), done: new Uint32Array(n), prev: new Int32Array(n), via: new Int16Array(n), stamp: 0, heap: new Heap() };
    // ROUTE distance from the start (walls, water and portals considered;
    // gates not — they are eaten): "how far along the place" a spot is
    const res = search(G, startCell, -1, null, null, true);
    G.rd = Float64Array.from(G.scratch.dist.map((v, k) => (G.scratch.mark[k] === G.scratch.stamp && G.scratch.done[k] === G.scratch.stamp ? v : Infinity)));
    let mx = 1;
    for (const k of okCells) if (Number.isFinite(G.rd[k]) && G.rd[k] > mx) mx = G.rd[k];
    G.rdMax = mx;
    void res;
    // the middle of the place, where Gobble waits for the win's slurp
    {
      let sx = 0, sy = 0, c = 0;
      for (const k of okCells) if (Number.isFinite(G.rd[k])) { sx += cx(k); sy += cy(k); c++; }
      let best = startCell, bd = Infinity;
      for (const k of okCells) {
        if (!Number.isFinite(G.rd[k])) continue;
        const d = gdist(cx(k), cy(k), sx / c, sy / c) - (walk(cx(k), cy(k)) < -12 ? 6 : 0);
        if (d < bd) { bd = d; best = k; }
      }
      G.mid = { x: cx(best), y: cy(best) };
    }
    G.routeFrac = (x, y) => {
      const v = G.rd[okNear(x, y)];
      return Number.isFinite(v) ? v / G.rdMax : 1;
    };
    G.zone = (name) => zoneOf(G, name);
    const slide = def.slide;
    G.slideAt = slide === true ? () => true
      : Array.isArray(slide) ? (x, y) => slide.some((z) => { const Z = G.zone(z); return !!Z && Z.test(x, y); })
        : () => false;
    G.flowAt = (x, y) => flowAt(G, x, y);
    // INSIDE: is a rectangle of the world all island top (no edge, no void)?
    // The renderer skips the backdrop when the view is (a coarse grid and a
    // summed-area table, so the question costs four lookups).
    {
      const DC = 8, dnx = Math.ceil(W / DC), dny = Math.ceil(H / DC);
      const sat = new Int32Array((dnx + 1) * (dny + 1));
      for (let j = 0; j < dny; j++) {
        for (let i = 0; i < dnx; i++) {
          // deep when the island reaches past the whole coarse cell
          const deep = isl((i + 0.5) * DC, (j + 0.5) * DC) <= -(DC * 0.5 + (DC * 0.5) / SQ) ? 1 : 0;
          sat[(j + 1) * (dnx + 1) + i + 1] = deep + sat[j * (dnx + 1) + i + 1] + sat[(j + 1) * (dnx + 1) + i] - sat[j * (dnx + 1) + i];
        }
      }
      G.inside = (x0, y0, x1, y1) => {
        if (x0 < 0 || y0 < 0 || x1 > W || y1 > H) return false;
        const i0 = Math.floor(x0 / DC), j0 = Math.floor(y0 / DC), i1 = Math.min(dnx - 1, Math.floor(x1 / DC)), j1 = Math.min(dny - 1, Math.floor(y1 / DC));
        const s = sat[(j1 + 1) * (dnx + 1) + i1 + 1] - sat[j0 * (dnx + 1) + i1 + 1] - sat[(j1 + 1) * (dnx + 1) + i0] + sat[j0 * (dnx + 1) + i0];
        return s === (i1 - i0 + 1) * (j1 - j0 + 1);
      };
    }
    geoms.set(def, G);
    return G;
  }

  // A track: a polyline (a loop goes round; an open line goes there and back)
  // or an ORBIT, a ground circle. pos(s) is where a rider s units along it is.
  function compileTrack(id, t, W, H) {
    if (t.orbit) {
      const cx = t.orbit[0] * W, cy = t.orbit[1] * H, rg = t.orbit[2] * W, len = 2 * Math.PI * rg;
      const pts = [];
      for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2; pts.push([cx + Math.cos(a) * rg, cy + Math.sin(a) * rg * SQ]); }
      return {
        id, kind: "orbit", loop: true, len, pts, gp: pts.map((p) => [p[0], p[1] / SQ]), speed: t.speed || 8, look: t.look || "orbit",
        train: !!t.train, gap: t.gap || 0, w: t.w || 8,
        pos(s) { const a = s / rg; return { x: cx + Math.cos(a) * rg, y: cy + Math.sin(a) * rg * SQ }; },
      };
    }
    const pts = t.pts.map((p) => [p[0] * W, p[1] * H]);
    if (t.loop) pts.push(pts[0].slice());
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + gdist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
    const len = cum[cum.length - 1] || 1;
    return {
      id, kind: "line", loop: !!t.loop, len, pts, gp: pts.map((p) => [p[0], p[1] / SQ]), speed: t.speed || 8, look: t.look || "lane",
      train: !!t.train, gap: t.gap || 0, w: t.w || 10,
      pos(s) {
        let u;
        if (this.loop) u = ((s % len) + len) % len;
        else { u = ((s % (2 * len)) + 2 * len) % (2 * len); if (u > len) u = 2 * len - u; }
        let lo = 0, hi = cum.length - 1;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= u) lo = m; else hi = m; }
        const seg = cum[hi] - cum[lo] || 1, f = (u - cum[lo]) / seg;
        return { x: pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, y: pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f };
      },
    };
  }

  // ZONES: where a zoned thing's centre stands. A zone is a list of parts,
  // any of which counts: a rect [x0, y0, x1, y1] (normalized), a SHAPE (any of
  // the island's kinds, with an optional `not`), or a BAND {band: [f0, f1]} —
  // a stretch of the place measured by ROUTE distance from the start (0 at
  // the start, 1 at the far end), which is how a winding river or a spiral
  // puts the small things first and the big ones at the end of the journey.
  function zoneOf(G, name) {
    if (G.zones.has(name)) return G.zones.get(name);
    const z = G.def.zones && G.def.zones[name];
    let Z = null;
    if (z) {
      const parts = Array.isArray(z) && typeof z[0] !== "number" ? z : [z];
      const tests = parts.map((p) => {
        if (Array.isArray(p)) {
          const x0 = p[0] * G.W, y0 = p[1] * G.H, x1 = p[2] * G.W, y1 = p[3] * G.H;
          return (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
        }
        if (p.band) { const a = p.band[0], b = p.band[1]; return (x, y) => { const f = G.routeFrac(x, y); return f >= a && f <= b; }; }
        const f = compileShape(p, G.W, G.H);
        return (x, y) => f(x, y / SQ) <= 0;
      });
      const test = (x, y) => { for (const t of tests) if (t(x, y)) return true; return false; };
      Z = { name, test, cells: G.okCells.filter((k) => test(G.cx(k), G.cy(k))) };
    }
    G.zones.set(name, Z);
    return Z;
  }

  // A current at a spot: its push (world units per second), or null. Strong
  // in the middle of the stream, gentler at its banks.
  function flowAt(G, x, y) {
    if (!G.flows.length) return null;
    const gy = y / SQ;
    for (const f of G.flows) {
      if (f.spin) {
        // rigid rotation: still at the hub, fastest at the rim
        const gx = x - f.spin.x, gz = gy - f.spin.y / SQ, d = Math.hypot(gx, gz), rg = f.spin.rg;
        if (d < rg && d > 1e-6) {
          const k = f.v / rg;
          return { x: -gz * k, y: gx * k * SQ, look: f.look, spin: true };
        }
        continue;
      }
      const s = nearSeg(f.gp, x, gy), half = f.w / 2;
      if (s.d < half) {
        const k = 1 - 0.6 * (s.d / half) * (s.d / half);
        return { x: s.ux * f.v * k, y: s.uy * f.v * k * SQ, look: f.look };
      }
    }
    return null;
  }

  // ---- GRID SEARCH ------------------------------------------------------------
  // A small binary min-heap of (cost, cell).
  function Heap() { this.c = []; this.k = []; this.n = 0; }
  Heap.prototype.push = function (c, k) {
    let i = this.n++;
    this.c[i] = c; this.k[i] = k;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.c[p] <= this.c[i]) break;
      const tc = this.c[p]; this.c[p] = this.c[i]; this.c[i] = tc;
      const tk = this.k[p]; this.k[p] = this.k[i]; this.k[i] = tk;
      i = p;
    }
  };
  Heap.prototype.top = function () { return this.c[0]; };
  Heap.prototype.pop = function () {
    const out = this.k[0];
    const n = --this.n;
    if (n > 0) {
      this.c[0] = this.c[n]; this.k[0] = this.k[n];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < n && this.c[l] < this.c[m]) m = l;
        if (r < n && this.c[r] < this.c[m]) m = r;
        if (m === i) break;
        const tc = this.c[m]; this.c[m] = this.c[i]; this.c[i] = tc;
        const tk = this.k[m]; this.k[m] = this.k[i]; this.k[i] = tk;
        i = m;
      }
    }
    return out;
  };

  // Dijkstra (A* when the place has no portals and there is a goal) from a
  // cell. `block` closes cells (a wall of things too big to eat yet); `stopAt`
  // ends the search at the first cell it accepts; `all` floods the lot.
  // Results stay in G.scratch (dist / prev / via) under this search's stamp.
  function search(G, src, goal, block, stopAt, all) {
    const S = G.scratch, st = ++S.stamp, hp = S.heap;
    hp.n = 0;
    const gx = goal >= 0 ? G.cx(goal) : 0, gy = goal >= 0 ? G.cy(goal) : 0;
    const heur = goal >= 0 && !G.ends.length && !all;
    const h = (k) => (heur ? gdist(G.cx(k), G.cy(k), gx, gy) : 0);
    S.dist[src] = 0; S.prev[src] = -1; S.via[src] = -1; S.mark[src] = st;
    hp.push(h(src), src);
    let found = -1, best = src, bestD = goal >= 0 ? gdist(G.cx(src), G.cy(src), gx, gy) : 0;
    while (hp.n) {
      const k = hp.pop();
      if (S.done[k] === st) continue;
      S.done[k] = st;
      if (!all && (k === goal || (stopAt && stopAt(k)))) { found = k; break; }
      if (goal >= 0) {
        const d = gdist(G.cx(k), G.cy(k), gx, gy);
        if (d < bestD) { bestD = d; best = k; }
      }
      const base = S.dist[k], bits = G.edge[k];
      for (let d = 0; d < 8; d++) {
        if (!(bits & (1 << d))) continue;
        const m = k + G.doff[d];
        if (block && block[m]) continue;
        const v = base + G.dcost[d] + (G.pen[m] ? RULES.PORTAL_PEN : 0);
        if (S.mark[m] !== st || v < S.dist[m]) {
          S.mark[m] = st; S.dist[m] = v; S.prev[m] = k; S.via[m] = -1;
          hp.push(v + h(m), m);
        }
      }
      const js = G.jumps.get(k);
      if (js) {
        for (const ei of js) {
          const m = G.ends[G.ends[ei].to].cell;
          if (block && block[m]) continue;
          const v = base + RULES.PORTAL_COST;
          if (S.mark[m] !== st || v < S.dist[m]) {
            S.mark[m] = st; S.dist[m] = v; S.prev[m] = k; S.via[m] = ei;
            hp.push(v + h(m), m);
          }
        }
      }
    }
    return { found, best, stamp: st };
  }
  // The cells from the search's source to `k`, and where each step was a jump.
  function pathTo(G, k) {
    const S = G.scratch, cells = [], via = [];
    for (let c = k, guard = 0; c >= 0 && guard < G.n; c = S.prev[c], guard++) { cells.push(c); via.push(S.via[c]); }
    cells.reverse(); via.reverse();
    // jump[i] = the portal end taken from cells[i] to cells[i + 1], else -1
    const jump = cells.map((c, i) => (i + 1 < cells.length ? via[i + 1] : -1));
    return { cells, jump };
  }
  // A walkable route between two world points, as a smooth line of points
  // (the trails of bites follow it round ponds and walls). Static: nothing
  // blocks it but the place's own shape.
  function routeLine(G, a, b) {
    const from = G.okNear(a.x, a.y), to = G.okNear(b.x, b.y);
    const r = search(G, from, to, null, null, false);
    const p = pathTo(G, r.found >= 0 ? r.found : r.best);
    // only the walk before the first portal: a trail never leads through one
    let cells = p.cells;
    const j = p.jump.findIndex((v) => v >= 0);
    if (j >= 0) cells = cells.slice(0, j + 1);
    let pts = cells.map((k) => [G.cx(k), G.cy(k)]);
    pts[0] = [a.x, a.y];
    for (let pass = 0; pass < 3; pass++) {
      pts = pts.map((q, i) => (i === 0 || i === pts.length - 1 ? q : [(pts[i - 1][0] + 2 * q[0] + pts[i + 1][0]) / 4, (pts[i - 1][1] + 2 * q[1] + pts[i + 1][1]) / 4]));
    }
    return pts;
  }
  function lineLen(pts) {
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return s;
  }
  function lineAt(pts, d) {
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (d <= l || i === pts.length - 1) {
        const f = l > 0 ? Math.min(1, d / l) : 0;
        const ux = l > 0 ? (pts[i][0] - pts[i - 1][0]) / l : 0, uy = l > 0 ? (pts[i][1] - pts[i - 1][1]) / l : -1;
        return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f, ux, uy };
      }
      d -= l;
    }
    return { x: pts[0][0], y: pts[0][1], ux: 0, uy: -1 };
  }

  // ---- ITEMS and FORMATIONS ---------------------------------------------------
  // An item line: [emoji, count, zone?, clump?] or [emoji, count, {options}]:
  //   zone, clump — as before (a district; stand together in k's)
  //   ride: a track id — the things ride it (a train's cars, cars on a street)
  //   at: a FORMATION — the things stand exactly in a line, a grid, a ring, an
  //       arc, a bowling triangle or at given points (a row of dominoes, a
  //       wall of bricks across a gap)
  //   solid: a wall while too big to eat (eat through it once big enough)
  //   lock: "k" — a wall, and not to be eaten, until the thing with key "k" is
  //   key: "k" — eating it opens every lock "k"
  //   pop: [[emoji, n, tier], …] — surprises inside: out when it is eaten
  //   shake: [[emoji, n, tier], …] — out when Gobble BUMPS it (a fruit tree)
  //   chain: a formation that topples: eat one and the rest roll in after it
  //   glow: it glows in the dark
  // phase 5 (§17):
  //   press: "k" — a BUTTON in the floor: roll onto it and it clicks down.
  //          A lock "k" opens when EVERY key and button named "k" is done
  //          (one key, three keys, a button, a button and a key…)
  //   bounce: a BUMPER — while too big to eat it knocks him back, boing
  //   run: a RUNAWAY — once he can eat it, it scoots away (and tires)
  //   hits: n — a PIÑATA (a shake box): n bonks, each letting out a share
  //   power: "magnet" | "zoom" — a POWER-UP: eat it for a super pull or speed
  //   sprout: [[emoji, n, tier], …] — a SEEDLING: roll near it and what grows
  //          from it pops up out of the ground
  function itemOf(it) {
    const o = it[2];
    if (o && typeof o === "object" && !Array.isArray(o)) return Object.assign({ e: it[0], n: it[1] }, o);
    return { e: it[0], n: it[1], zone: it[2] || null, clump: it[3] | 0 };
  }
  // A place's CHALLENGE: the set of mechanics it uses, one atom each (the
  // no-reskin law compares them: no two places may pose the same set, and two
  // places on the same ground must differ by at least two). The ONE owner:
  // a new mechanic adds its atom here, beside the rule that runs it.
  const ITEM_TWISTS = ["ride", "at", "solid", "lock", "key", "pop", "shake", "chain", "bounce", "run", "hits", "power", "sprout"];
  function twistsOf(def) {
    const t = new Set();
    for (const b of def.blocks || []) t.add("block:" + (b.look || "water"));
    if ((def.bridges || []).length) t.add("bridges");
    // a portal you walk through, and a CANNON that flies you (§17)
    for (const p of def.portals || []) t.add(p.fly ? "launch" : "portals");
    // a current, and a TURNTABLE (a spinning floor, §17: its own kind of
    // movement, whatever it looks like)
    for (const f of def.flows || []) t.add(f.spin ? "spin" : "flow:" + (f.look || "river"));
    if (def.slide) t.add("ice");
    if (def.dark) t.add("dark");
    if (def.notes) t.add("notes");
    if (def.count) t.add("count");
    if (def.tiers.length > 5) t.add("giant");
    for (const z of Object.values(def.zones || {})) {
      const parts = Array.isArray(z) && typeof z[0] !== "number" ? z : [z];
      if (parts.some((p) => p && p.band)) t.add("bands");
    }
    for (const tr of Object.values(def.tracks || {})) t.add("track:" + (tr.orbit ? "orbit" : tr.train ? "train" : tr.loop ? "loop" : "line"));
    // a lock waiting for more than one thing (three keys; a key and a
    // button) is a quest; a button is a button however many there are
    const openers = {};
    for (const tier of def.tiers) for (const raw of tier.items) {
      const it = itemOf(raw);
      for (const k of ITEM_TWISTS) if (it[k]) t.add(k);
      if (it.press) t.add("button");
      for (const name of [it.key, it.press]) if (name) openers[name] = (openers[name] || 0) + it.n;
    }
    if (Object.values(openers).some((n) => n > 1)) t.add("keys");
    return t;
  }
  function formation(at, n, W, H) {
    const pts = [];
    if (at.line) {
      const a = at.line[0], b = at.line[1];
      for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); pts.push([(a[0] + (b[0] - a[0]) * t) * W, (a[1] + (b[1] - a[1]) * t) * H]); }
    } else if (at.grid) {
      const g = at.grid, cols = at.cols || Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
      for (let i = 0; i < n; i++) {
        const c = i % cols, r = Math.floor(i / cols);
        pts.push([(g[0] + (cols === 1 ? 0.5 : c / (cols - 1)) * (g[2] - g[0])) * W, (g[1] + (rows === 1 ? 0.5 : r / (rows - 1)) * (g[3] - g[1])) * H]);
      }
    } else if (at.ring) {
      const c = at.ring, a0 = ((at.a0 || 0) * Math.PI) / 180;
      for (let i = 0; i < n; i++) { const a = a0 + (i / n) * Math.PI * 2; pts.push([c[0] * W + Math.cos(a) * c[2] * W, c[1] * H + Math.sin(a) * c[2] * W * SQ]); }
    } else if (at.arc) {
      const c = at.arc;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1), a = ((c[3] + (c[4] - c[3]) * t) * Math.PI) / 180;
        pts.push([c[0] * W + Math.cos(a) * c[2] * W, c[1] * H + Math.sin(a) * c[2] * W * SQ]);
      }
    } else if (at.tri) {
      // a bowling triangle: the head pin nearest the player, rows behind it
      const c = at.tri, s = c[2];
      for (let row = 0, i = 0; i < n; row++) {
        for (let m = 0; m <= row && i < n; m++, i++) pts.push([c[0] * W + (m - row / 2) * s, c[1] * H - row * s * 0.87 * SQ]);
      }
    } else if (at.pts) {
      for (let i = 0; i < n; i++) { const p = at.pts[i % at.pts.length]; pts.push([p[0] * W, p[1] * H]); }
    }
    return pts;
  }

  // ---- LAYOUT: where every object stands (deterministic) -------------------
  // In this order, because each step needs room the next one would take:
  //   1. the FINALE on its stage (the landmark you head for),
  //   2. three STARTERS right beside Gobble (the first gulp is instant),
  //   3. the RIDERS on their tracks, and the FORMATIONS at their spots,
  //   4. the TRAILS — lines of tiny bites following the way out from the start,
  //   5. the big single things (a big thing needs the most room) — and the
  //      surprises hidden in or under each one,
  //   6. the CLUMPS — a group stands together, so one pass hoovers up the lot,
  //   7. everything else, biggest first.
  // Placement is best-candidate sampling (of up to 24 legal spots, keep the
  // one with the most room) over the ground he can stand on, which spreads a
  // world evenly without a grid look; a zoned thing stands with its centre in
  // its zone.
  function layout(def) {
    if (typeof def === "string") def = sceneById(def);
    const G = geomOf(def);
    const { W, H, start } = G;
    const rr = rng(hashStr(def.id + ":radius"));
    const rp = rng(hashStr(def.id + ":place"));
    const rOf = (tier) => { const t = def.tiers[tier - 1]; return t.r[0] + (t.r[1] - t.r[0]) * rr(); };
    const want = [];
    let clumpN = 0;
    def.tiers.forEach((t, i) => {
      t.items.forEach((raw, j) => {
        const it = itemOf(raw);
        const k = Math.max(1, it.clump | 0);
        const pts = it.at ? formation(it.at, it.n, W, H) : null;
        for (let m = 0; m < it.n; m++) {
          if (k > 1 && m % k === 0) clumpN++;
          want.push({
            e: it.e, tier: i + 1, r: rOf(i + 1), zone: it.zone || null, clump: k > 1 ? clumpN : 0,
            ride: it.ride || null, at: pts ? pts[m] : null, order: m, form: pts ? i * 100 + j + 1 : 0,
            solid: !!it.solid, lock: it.lock || null, key: it.key || null,
            pop: it.pop || null, shake: it.shake || null, chain: it.chain ? "c" + i + "_" + j : null, glow: !!it.glow,
            press: it.press || null, bounce: !!it.bounce, run: !!it.run, hits: it.hits | 0, power: it.power || null, sprout: it.sprout || null,
          });
        }
      });
    });
    const placed = [];
    const topMin = (r) => Math.max(RULES.EDGE, RULES.SPRITE_H * r - RULES.TOP_SLACK);
    // KEEP-OUTS. A PRIVATE zone holds only its own things (the runways hold
    // the aeroplanes, never an ice cream) — about where a thing's CENTRE
    // stands, like a zone. Ground NOTHING may stand on (lava, the sea, a
    // pond) is a block, which is not ground at all, so it needs no rule here.
    const priv = (def.private || []).map((z) => ({ z, Z: G.zone(z) }));
    const blocked = (x, y, zone) => {
      for (const p of priv) if (p.z !== zone && p.Z && p.Z.test(x, y)) return true;
      return false;
    };
    // …and nothing stands where something MOVES or carries: a track's lane
    // (a train never drives through a house), a current (no sweet floats on
    // the river unless the river is for things), a bridge, a portal's pad.
    const riderR = {};
    for (const w of want) if (w.ride) riderR[w.ride] = Math.max(riderR[w.ride] || 0, w.r);
    const keeps = [];
    for (const [id, rmax] of Object.entries(riderR)) {
      const T = G.tracks[id];
      if (!T) throw new Error("Gobble Hole: " + def.id + " rides a track it does not have: " + id);
      keeps.push({ gp: T.gp, half: rmax + RULES.KEEP_LANE });
    }
    for (const f of G.flows) if (!f.things) keeps.push({ gp: f.gp, half: f.w / 2 });
    for (const b of G.bridges) keeps.push({ gp: b.gp, half: b.w / 2 + 1 });
    for (const e of G.ends) keeps.push({ gp: [[e.x, e.y / SQ]], half: RULES.PORTAL_R + 4 });
    // how far a spot is from every keep-out (an index: a spot only measures
    // the lanes near it)
    const keepIdx = segIndex([].concat(...keeps.map((kp) => segsOf(kp.gp, kp.half))), SHAPE_CAP);
    const keepD = (x, y) => keepIdx(x, y / SQ);
    // A coarse grid of what is placed, so a test of "is this spot free?" looks
    // only at its neighbours (a world of ~400 things measured in seconds
    // without it). It changes no answer: every neighbour that can matter is in
    // the cells searched (the reach covers the biggest thing placed so far).
    const GC = 24, cols = Math.ceil(W / GC) + 1, rows = Math.ceil(H / GC) + 1;
    const cells = new Array(cols * rows);
    let rMax = 0;
    const near = (x, y, reach, fn) => {
      const cx0 = clamp(Math.floor((x - reach) / GC), 0, cols - 1), cx1 = clamp(Math.floor((x + reach) / GC), 0, cols - 1);
      const cy0 = clamp(Math.floor((y - reach * SQ) / GC), 0, rows - 1), cy1 = clamp(Math.floor((y + reach * SQ) / GC), 0, rows - 1);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const c = cells[cy * cols + cx];
          if (c) for (const p of c) if (fn(p) === false) return false;
        }
      }
      return true;
    };
    // Can a thing of radius r stand here? On ground he can walk (clear of the
    // water and the edge), its top on the world's screen, clear of the start,
    // the keep-outs and every other thing. `form`: a formation's own members
    // may stand closer than SEP (a wall of bricks is touching bricks).
    const legal = (x, y, r, sep, zone, form) => {
      if (y < topMin(r) || y > H || x < 0 || x > W) return false;
      if (G.walk(x, y) > -(r + RULES.EDGE)) return false;
      if (gdist(x, y, start.x, start.y) < RULES.START_CLEAR + r) return false;
      if (blocked(x, y, zone || null)) return false;
      if (keeps.length && keepD(x, y) < r) return false;
      return near(x, y, sep * (r + rMax), (p) => (form && p.form === form) || gdist(x, y, p.x, p.y) >= sep * (r + p.r));
    };
    // How much room a spot has: the gap to its nearest neighbour, capped at
    // ROOM (any two spots with more room than that are equally good).
    const ROOM = 90;
    const room = (x, y, r) => {
      let m = ROOM;
      near(x, y, ROOM + r + rMax, (p) => { m = Math.min(m, gdist(x, y, p.x, p.y) - (r + p.r)); });
      return m;
    };
    const put = (o, x, y) => {
      o.x = x; o.y = y; o.done = true; placed.push(o);
      rMax = Math.max(rMax, o.r);
      const k = clamp(Math.floor(y / GC), 0, rows - 1) * cols + clamp(Math.floor(x / GC), 0, cols - 1);
      (cells[k] || (cells[k] = [])).push(o);
    };
    let relaxed = 0, zoneMiss = 0, broken = 0;
    const N = G.N;
    // Best-candidate spot for a footprint of radius `r` (in its zone if any).
    function spot(r, zone) {
      const Z = zone ? G.zone(zone) : null;
      let sep = RULES.SEP;
      for (let pass = 0; pass < 6; pass++) {
        const inZone = !!(Z && Z.cells.length) && pass < 3;
        const pool = inZone ? Z.cells : G.okCells;
        let best = null, bestRoom = -Infinity, found = 0;
        for (let tries = 0; tries < 1500 && found < 24; tries++) {
          const c = pool[Math.floor(rp() * pool.length)];
          const x = ((c % G.nc) + rp()) * N, y = (Math.floor(c / G.nc) + rp()) * N;
          if (inZone && !Z.test(x, y)) continue;
          if (!legal(x, y, r, sep, zone)) continue;
          found++;
          const m = room(x, y, r);
          if (m > bestRoom) { bestRoom = m; best = [x, y]; }
        }
        if (best) {
          if (Z && !inZone) zoneMiss++;
          return best;
        }
        if (pass >= 2) { sep *= 0.9; relaxed++; }
      }
      relaxed++;
      return [G.mid.x, G.mid.y];   // never happens for a shipped place (tested)
    }
    // THE SURPRISES of a box or a tree, placed round it the moment it stands:
    // a box's goodies just past the reach of the Gobble who can first eat it
    // (they spray out, a little wiggle gobbles them); a tree's fruit at its foot.
    const kids = [];
    function placeKids(p) {
      const spec = p.pop || p.shake || p.sprout;
      if (!spec) return;
      const list = [];
      const how = p.pop ? "pop" : p.shake ? "shake" : "sprout";
      for (const s of spec) for (let i = 0; i < s[1]; i++) list.push({ e: s[0], tier: s[2] || 1, r: rOf(s[2] || 1), zone: null, clump: 0, kid: true, par: p, how });
      const reach = p.pop ? (def.tiers[p.tier - 1].r[1] / RULES.FIT) * RULES.HEAD * 1.25 + 2 : 0;
      list.forEach((k, i) => {
        let ok = null;
        for (let tries = 0; tries < 60 && !ok; tries++) {
          const a = (i / list.length) * Math.PI * 2 + rp() * 0.7 + tries * 0.61;
          const d = (p.pop ? reach + k.r : RULES.SEP * (p.r + k.r) + 0.6) + (tries > 20 ? (tries - 20) * 1.4 : 0) + rp() * 2;
          const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * SQ;
          if (legal(x, y, k.r, RULES.SEP, p.zone)) ok = [x, y];
        }
        if (!ok) { ok = spot(k.r, p.zone); broken++; }
        put(k, ok[0], ok[1]);
        kids.push(k);
      });
    }

    // 1. the finale, on its stage
    const at = def.finale.at || [0.5, 0.16];
    const fin = { e: def.finale.e, tier: def.tiers.length + 1, r: def.finale.r, zone: null, clump: 0, finale: true, glow: true };
    put(fin, W * at[0], Math.max(H * at[1], topMin(fin.r)));

    // 2. the starters: a little arc just ahead of Gobble — toward the way out
    //    (the first trail's route) — plain tiny bites, never zoned or clumped
    const trails = def.trails || [];
    const routes = trails.map((tr) => routeLine(G, start, { x: W * tr.to[0], y: H * tr.to[1] }));
    const plain = (w) => !w.done && w.tier === 1 && !w.zone && !w.clump && !w.ride && !w.at && !w.pop && !w.shake && !w.key && !w.lock && !w.solid &&
      !w.press && !w.bounce && !w.run && !w.hits && !w.power && !w.sprout;
    const pref = trails.length ? trails[0].e : null;
    let fx = 0, fy = -1;
    if (routes.length) { const p = lineAt(routes[0], 22); const l = Math.hypot(p.x - start.x, p.y - start.y); if (l > 1) { fx = (p.x - start.x) / l; fy = (p.y - start.y) / l; } }
    const arc = [[-7, -6.5], [0, -9.5], [7, -6.5]];
    for (let i = 0; i < (def.starters || 0); i++) {
      const o = want.find((w) => plain(w) && w.e === pref) || want.find(plain);
      if (!o) break;
      o.starter = true;
      // rotate the arc so its "up" points along the way out
      const a = arc[i % arc.length];
      let x = start.x + a[0] * -fy - a[1] * fx, y = start.y + a[0] * fx + a[1] * -fy;
      for (let k = 0; k < 4 && G.walk(x, y) > -(o.r * 0.6); k++) { x = start.x + (x - start.x) * 0.75; y = start.y + (y - start.y) * 0.75; }
      put(o, x, y);
    }

    // 3a. the riders, along their tracks (a train's cars one after another;
    //     anything else spread round evenly)
    const byTrack = new Map();
    for (const w of want) if (w.ride && !w.done) { if (!byTrack.has(w.ride)) byTrack.set(w.ride, []); byTrack.get(w.ride).push(w); }
    for (const [id, all] of byTrack) {
      const T = G.tracks[id];
      // a train: the biggest leads (the engine, then its carriages)
      const list = T.train ? all.slice().sort((a, b) => b.tier - a.tier) : all;
      const gap = T.gap || 2.3 * Math.max(...list.map((w) => w.r));
      list.forEach((w, i) => {
        w.s0 = T.train ? -i * gap * Math.sign(T.speed || 1) : (i * T.len) / list.length + rp() * Math.min(6, T.len / list.length / 4);
        const p = T.pos(w.s0);
        w.done = true; w.x = p.x; w.y = p.y;
        placed.push(w);
      });
    }
    // 3b. the formations, exactly where the data says (each checked: on
    //     ground he can walk, its members never piling onto anything else)
    for (const w of want) {
      if (w.done || !w.at) continue;
      const x = w.at[0], y = w.at[1];
      if (!(G.walk(x, y) <= -w.r * 0.6) || !near(x, y, w.r + rMax, (p) => p.form === w.form || gdist(x, y, p.x, p.y) >= RULES.SEP * (w.r + p.r))) broken++;
      put(w, x, y);
      placeKids(w);
    }

    // 4. the trails: from just outside the start, bites along the walkable
    //    way toward `to`, with a gentle wobble; a spot that is not free is
    //    simply skipped
    trails.forEach((tr, ti) => {
      const line = routes[ti], len = lineLen(line), bend = (ti % 2 ? -1 : 1) * 6;
      for (let i = 0; i < RULES.TRAIL_MAX; i++) {
        const d = RULES.START_CLEAR + 6 + i * RULES.TRAIL_STEP;
        if (d > len) break;
        const o = want.find((w) => plain(w) && w.e === tr.e);
        if (!o) break;
        const p = lineAt(line, d);
        const wob = Math.sin((i / Math.max(1, RULES.TRAIL_MAX - 1)) * Math.PI) * bend;
        let x = p.x - p.uy * wob, y = p.y + p.ux * wob;
        if (!legal(x, y, o.r, RULES.SEP, null)) { x = p.x; y = p.y; }
        if (!legal(x, y, o.r, RULES.SEP, null)) continue;
        o.trail = ti + 1;
        put(o, x, y);
      }
    });

    // 5. big singles, biggest first (and their surprises)
    const singles = (min) => want.filter((w) => !w.done && !w.clump && w.tier >= min).sort((a, b) => b.r - a.r);
    for (const o of singles(3)) { const p = spot(o.r, o.zone); put(o, p[0], p[1]); placeKids(o); }

    // 6. the clumps: find a centre with room for the whole group, then grow
    //    the group outward from it, each member touching (almost) the last
    const clumps = new Map();
    for (const w of want) if (!w.done && w.clump) {
      if (!clumps.has(w.clump)) clumps.set(w.clump, []);
      clumps.get(w.clump).push(w);
    }
    const order = [...clumps.values()].sort((a, b) => b[0].r - a[0].r);
    for (const g of order) {
      const rM = Math.max(...g.map((m) => m.r));
      const foot = rM * (1 + 1.15 * Math.sqrt(g.length - 1));
      const c = spot(foot, g[0].zone);
      // a zoned clump grows INSIDE its zone: a tulip that wanders off the
      // park onto the road is a tulip on the road
      const Z = g[0].zone ? G.zone(g[0].zone) : null;
      const here = [];
      for (const m of g) {
        let ok = null;
        const fits = (x, y) => legal(x, y, m.r, RULES.SEP, m.zone) && (!Z || Z.test(x, y));
        if (!here.length && fits(c[0], c[1])) ok = c;
        for (let tries = 0; !ok && tries < 80; tries++) {
          const nb = here.length ? here[Math.floor(rp() * here.length)] : { x: c[0], y: c[1], r: 0 };
          const ang = rp() * Math.PI * 2, d = RULES.SEP * (m.r + nb.r) * (here.length ? 1.06 : 0.5) + 0.05;
          const x = nb.x + Math.cos(ang) * d, y = nb.y + Math.sin(ang) * d * SQ;
          if (fits(x, y)) ok = [x, y];
        }
        if (!ok) { ok = spot(m.r, m.zone); broken++; }
        put(m, ok[0], ok[1]);
        placeKids(m);
        here.push(m);
      }
    }

    // 7. everything else, biggest first
    for (const o of singles(1)) { const p = spot(o.r, o.zone); put(o, p[0], p[1]); placeKids(o); }

    // ids are the placing order: the finale is always id 0
    placed.forEach((p, i) => { p.id = i; });
    const objects = placed.map((p) => {
      const o = {
        id: p.id, e: p.e, tier: p.tier, r: round3(p.r), x: round3(p.x), y: round3(p.y),
        xp: Math.round(p.r * p.r * 10), finale: !!p.finale, starter: !!p.starter,
        clump: p.clump || 0, trail: p.trail || 0,
        st: p.kid ? HIDDEN : IDLE, f: 0, fx: 0, fy: 0, wob: 0, cd: 0, pull: 0, zoom: 0,
      };
      if (p.ride) { o.ride = p.ride; o.s0 = round3(p.s0); o.dir = -1; }
      if (p.solid) o.solid = true;
      if (p.lock) o.lock = p.lock;
      if (p.key) o.key = p.key;
      if (p.chain) { o.chain = p.chain; o.order = p.order; }
      if (p.glow || p.key) o.glow = true;
      if (p.kid) { o.par = p.par.id; o.how = p.how; }
      if (p.pop || p.shake || p.sprout) { o.kids = []; o.box = p.pop ? "pop" : p.shake ? "shake" : "sprout"; }
      if (p.at) o.form = true;
      if (p.press) { o.press = p.press; o.pressed = false; }
      if (p.bounce) o.bounce = true;
      // a runaway remembers where it stood (it never strays far from home)
      if (p.run) { o.run = true; o.hx = o.x; o.hy = o.y; o.rest = 0; o.ran = 0; }
      if (p.hits) { o.hits = p.hits; o.hit = 0; }
      if (p.power) o.power = p.power;
      return o;
    });
    for (const k of kids) objects[k.par.id].kids.push(k.id);
    return { W, H, start, objects, relaxed, zoneMiss, broken };
  }

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
  // glitter gold — a tiny one early on the way, a small one halfway and a
  // medium one far along (measured by ROUTE, so on a spiral or a river "far"
  // means far to walk), each as far as it can be from the start and from the
  // others. They are picked FROM the layout, never added to it, so a saved run
  // keeps its meaning and the world is exactly what it was. The bites that
  // TEACH (starters, trails) and the things with a job (riders, keys, locks,
  // walls, boxes and what is hidden in them) are never treasures.
  const GOLD_BANDS = [[0, 0.42], [0.35, 0.72], [0.62, 1]];
  function goldOf(objects, G) {
    const out = [];
    const start = G.start;
    GOLD_BANDS.forEach((b, i) => {
      let best = null, bd = -1;
      for (const o of objects) {
        if (o.tier !== i + 1 || o.starter || o.trail || o.finale || o.ride || o.par != null || o.lock || o.key || o.solid || o.kids ||
          o.press || o.bounce || o.run || o.power) continue;
        const f = G.routeFrac(o.x, o.y);
        if (f < b[0] || f > b[1]) continue;
        let d = gdist(o.x, o.y, start.x, start.y);
        for (const t of out) d = Math.min(d, gdist(o.x, o.y, t.x, t.y));
        if (d > bd) { bd = d; best = o; }
      }
      if (best) out.push(best);
    });
    return out.map((o) => o.id);
  }

  // How many things a place holds, from its DATA alone (every thing it asks
  // for, the surprises inside them, and the finale) — cheap enough for the
  // home screen, which shows how far a half-eaten place got without laying
  // the world out.
  function countOf(def) {
    let n = 1;
    for (const t of def.tiers) {
      for (const raw of t.items) {
        const it = itemOf(raw);
        let per = 1;
        for (const k of it.pop || it.shake || it.sprout || []) per += k[1];
        n += it.n * per;
      }
    }
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
    const G = geomOf(def);
    const lay = layout(def);
    const lv = levelsOf(lay.objects);
    const gold = goldOf(lay.objects, G);
    for (const id of gold) lay.objects[id].gold = true;
    return {
      id: def.id, W: lay.W, H: lay.H, start: lay.start, print: printOf(lay.objects),
      objects: lay.objects, levels: lv, gold,
      hole: { x: lay.start.x, y: lay.start.y, r: lv.R[0], R: lv.R[0], level: 0, xp: 0, tx: lay.start.x, ty: lay.start.y, vx: 0, vy: 0,
        kx: 0, ky: 0, zoomT: 0 },
      t: 0, tick: 0, eaten: 0, total: lay.objects.length,
      won: false, done: false, winT: 0,
      sinceEat: 0, hint: -1, combo: 0, lastEatT: -9, slurpT: 0,
      unlocked: {}, wantKey: null, warpLock: -1, navGen: 0, onIce: false, inFlow: false,
      // §17: things counted so far, a cannon flight under way, the new
      // things already introduced this visit
      counted: 0, fly: null, met: {},
      events: [],
    };
  }

  // What a run knows that is NOT its state: the place's geometry and the
  // caches of the paths — kept beside it (a WeakMap), so the state itself
  // stays plain JSON for saves, hashes and the tests.
  const rts = new WeakMap();
  function rt(st) {
    let R = rts.get(st);
    if (R) return R;
    const def = sceneById(st.id);
    R = { def, G: geomOf(def), sig: null, solids: [], block: null, path: null, bot: -1, botT: -9, nearC: null, riders: [], chains: {}, openers: {}, locks: {}, solidObjs: [], runners: [] };
    for (const o of st.objects) {
      if (o.ride) R.riders.push(o);
      if (o.chain) (R.chains[o.chain] || (R.chains[o.chain] = [])).push(o);
      // what each lock waits for: every key AND every button with its name
      // (one key used to be kept per name, and a second key of the same name
      // was invisible to the goal and the hint)
      for (const name of [o.key, o.press]) if (name) (R.openers[name] || (R.openers[name] = [])).push(o);
      if (o.lock) (R.locks[o.lock] || (R.locks[o.lock] = [])).push(o);
      if (o.solid || o.lock || o.bounce) R.solidObjs.push(o);
      if (o.run) R.runners.push(o);
    }
    R.counts = def.count ? st.objects.filter((o) => o.e === def.count.e).length : 0;
    rts.set(st, R);
    return R;
  }

  // A WALL is a thing that is solid right now: a locked thing whose key he has
  // not eaten, or a solid thing too big for him to eat yet. A wall's core
  // stops him; the cells it covers are closed to the paths.
  function activeSolid(st, o) {
    return o.st === IDLE && ((!!o.lock && !st.unlocked[o.lock]) || ((!!o.solid || !!o.bounce) && o.r > st.hole.R * RULES.FIT));
  }
  const coreOf = (o) => o.r * RULES.CORE;
  function refreshSolids(st, R) {
    let sig = "";
    const act = [];
    for (const o of R.solidObjs) if (activeSolid(st, o)) { act.push(o); sig += o.id + ","; }
    if (sig === R.sig) return;
    R.sig = sig; R.solids = act; st.navGen++;
    R.path = null; R.nearC = null;
    if (!act.length) { R.block = null; return; }
    const G = R.G, B = new Uint8Array(G.n);
    for (const o of act) markCore(G, B, o);
    R.block = B;
  }
  function markCore(G, B, o) {
    const rc = coreOf(o) + G.N * 0.5;
    const i0 = clamp(Math.floor((o.x - rc) / G.N), 0, G.nc - 1), i1 = clamp(Math.floor((o.x + rc) / G.N), 0, G.nc - 1);
    const j0 = clamp(Math.floor((o.y - rc * SQ) / G.N), 0, G.nr - 1), j1 = clamp(Math.floor((o.y + rc * SQ) / G.N), 0, G.nr - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * G.nc + i;
      if (gdist(G.cx(k), G.cy(k), o.x, o.y) < rc) B[k] = 1;
    }
  }

  // Can Gobble's centre stand here? On walkable ground, outside every wall.
  function freeAt(st, R, x, y) {
    if (!(R.G.walk(x, y) <= 0)) return false;
    for (const o of R.solids) if (gdist(x, y, o.x, o.y) < coreOf(o)) return false;
    return true;
  }
  // A straight glide from a to b that meets no wall, no water and no portal
  // (other than the one he is heading for, or the one he has just come out of).
  // Traced, not sampled: from each point it steps on by the room it has (the
  // ground's own distance to the nearest edge, a wall of things or a portal),
  // so a narrow bulge in a wall's edge is never stepped over. Sampled every 2
  // units it stepped over a bulge where a shore or a cave wall juts out by a
  // unit, called the way straight, and pressed him into it for good (found
  // once a super slurp sent the bot past one). The 0.7 allows for the field
  // being bilinear (it can change a little faster than distance does).
  const LINE_STEP = 0.25;
  function clearLine(st, R, x0, y0, x1, y1, okEnd) {
    const G = R.G, d = Math.hypot(x1 - x0, y1 - y0);
    if (d < 1e-9) return true;
    const ux = (x1 - x0) / d, uy = (y1 - y0) / d, gl = Math.hypot(ux, uy / SQ);
    for (let s = 0; ;) {
      const x = x0 + ux * s, y = y0 + uy * s;
      let room = -G.walk(x, y);
      if (s > 0 && !(room >= 0)) return false;
      for (const o of R.solids) {
        const v = gdist(x, y, o.x, o.y) - coreOf(o);
        if (s > 0 && v < 0) return false;
        if (v < room) room = v;
      }
      for (let e = 0; e < G.ends.length; e++) {
        const E = G.ends[e];
        if (!E.live || e === okEnd || e === st.warpLock) continue;
        const v = gdist(x, y, E.x, E.y) - RULES.PORTAL_R * 1.2;
        if (s > 0 && v < 0) return false;
        if (v < room) room = v;
      }
      if (s >= d) return true;
      s = Math.min(d, s + Math.max(LINE_STEP, (Math.max(0, room) * 0.7) / gl));
    }
  }
  // The cell Gobble is IN, for planning a path. His centre may stand where
  // no cell's centre can (pressed against a hedge), and the nearest standing
  // room by straight distance can then be on the far side of that hedge — a
  // path planned from there starts across a wall and he never moves (found
  // in the hedge maze). So: the nearest open cell he can walk to in a
  // straight line.
  function cellHere(G, x, y) {
    const k = G.cellOf(x, y);
    if (G.ok[k]) return k;
    const i0 = k % G.nc, j0 = Math.floor(k / G.nc);
    let best = -1, bd = Infinity;
    for (let j = j0 - 2; j <= j0 + 2; j++) {
      for (let i = i0 - 2; i <= i0 + 2; i++) {
        if (i < 0 || j < 0 || i >= G.nc || j >= G.nr) continue;
        const m = j * G.nc + i;
        if (!G.ok[m]) continue;
        const d = gdist(G.cx(m), G.cy(m), x, y);
        if (d >= bd) continue;
        let clear = true;
        for (const t of [0.25, 0.5, 0.75, 1]) {
          if (G.walk(x + (G.cx(m) - x) * t, y + (G.cy(m) - y) * t) > 0) { clear = false; break; }
        }
        if (clear) { bd = d; best = m; }
      }
    }
    return best >= 0 ? best : G.okNear(x, y);
  }

  // WHERE TO HEAD this step. The finger points at a spot; if the way there is
  // straight and clear he glides straight at it (almost always). If water or
  // a wall is in the way, he follows a PATH round it — re-planned only when
  // the spot moves to another cell or a wall comes down — heading for the
  // farthest point along it he can see, so he cuts every corner he can.
  function waypoint(st, R) {
    const h = st.hole, G = R.G;
    let tx = clamp(h.tx, 0, G.W), ty = clamp(h.ty, 0, G.H);
    // a finger on a portal means "go through it"
    let goalEnd = -1;
    for (let e = 0; e < G.ends.length; e++) {
      const E = G.ends[e];
      if (E.live && e !== st.warpLock && gdist(tx, ty, E.x, E.y) < RULES.PORTAL_R * 1.5) { goalEnd = e; tx = E.x; ty = E.y; break; }
    }
    // a finger on the water sends him to its nearest shore
    if (goalEnd < 0 && !freeAt(st, R, tx, ty)) {
      const k = cellHere(G, tx, ty);
      tx = G.cx(k); ty = G.cy(k);
    }
    if (Math.hypot(tx - h.x, ty - h.y) < 0.01 || clearLine(st, R, h.x, h.y, tx, ty, goalEnd)) return { x: tx, y: ty, final: true };
    const from = cellHere(G, h.x, h.y), goal = cellHere(G, tx, ty);
    let P = R.path;
    let at = P && P.goal === goal && P.gen === st.navGen ? onPath(G, P, from) : -1;
    if (at < 0) {
      const res = search(G, from, goal, R.block, null, false);
      const end = res.found >= 0 ? res.found : res.best;
      const p = pathTo(G, end);
      P = R.path = { goal, gen: st.navGen, cells: p.cells, jump: p.jump, reached: res.found >= 0, idx: new Map(p.cells.map((c, i) => [c, i])) };
      at = 0;
    }
    const last = P.cells.length - 1;
    // The way is shut and he is as close as he can get. If it is shut by a
    // WALL OF THINGS (barrels too big to eat, a locked gate), he leans on it:
    // he presses against it and it wobbles, so a child SEES what is in the
    // way (and a locked gate says it wants its key). Shut by water, he waits
    // on the shore.
    if (!P.reached && at >= last) {
      let lean = null, ld = Infinity;
      for (const o of R.solids) {
        const d = gdist(o.x, o.y, h.x, h.y) - coreOf(o);
        if (d < G.N * 3 && d < ld) { ld = d; lean = o; }
      }
      if (lean) return { x: lean.x, y: lean.y, final: true };
    }
    if (last <= 0) return { x: P.reached ? tx : G.cx(P.cells[0]), y: P.reached ? ty : G.cy(P.cells[0]), final: true };
    let iMax = Math.min(last, at + 48);
    for (let i = at; i < iMax; i++) {
      if (P.jump[i] >= 0) {
        // the way goes through a portal: head straight for it — unless it is
        // the one he has just come out of. That one sleeps until he has
        // walked away (so he is not bounced straight back), and a way back
        // through it stood him on it for ever (found in space, once a super
        // slurp sent the bot back for a crumb): he walks away first, and then
        // the way takes him back through.
        if (P.jump[i] === st.warpLock) return wakeWalk(st, R, G.ends[st.warpLock]);
        const E = G.ends[P.jump[i]];
        if (clearLine(st, R, h.x, h.y, E.x, E.y, P.jump[i])) return { x: E.x, y: E.y, final: false };
        iMax = i;
        break;
      }
    }
    for (let i = iMax; i > at; i--) {
      const k = P.cells[i], end = i === last && P.reached;
      const x = end ? tx : G.cx(k), y = end ? ty : G.cy(k);
      if (clearLine(st, R, h.x, h.y, x, y, -1)) return { x, y, final: i === last };
    }
    const k = P.cells[Math.min(at + 1, last)];
    return { x: G.cx(k), y: G.cy(k), final: false };
  }
  // Away from a sleeping portal end, far enough for it to wake (warp() wakes
  // it past 2 * PORTAL_R + 4): the nearest open cell he can glide to in a
  // straight line, just past that.
  function wakeWalk(st, R, E) {
    const h = st.hole, G = R.G, wake = RULES.PORTAL_R * 2 + 4, far = wake + G.N * 3;
    const span = Math.ceil(far / G.N), i0 = Math.floor(E.x / G.N), j0 = Math.floor(E.y / G.N);
    let best = null, bd = Infinity;
    for (let j = j0 - span; j <= j0 + span; j++) {
      for (let i = i0 - span; i <= i0 + span; i++) {
        if (i < 0 || j < 0 || i >= G.nc || j >= G.nr) continue;
        const k = j * G.nc + i;
        if (!G.ok[k]) continue;
        const x = G.cx(k), y = G.cy(k), de = gdist(x, y, E.x, E.y);
        if (de <= wake + 1 || de > far) continue;
        const d = gdist(x, y, h.x, h.y);
        if (d < bd && clearLine(st, R, h.x, h.y, x, y, -1)) { bd = d; best = { x, y }; }
      }
    }
    return best ? { x: best.x, y: best.y, final: false } : { x: h.x, y: h.y, final: true };
  }
  // where along a planned path Gobble is (his cell, or one beside it)
  function onPath(G, P, from) {
    let at = P.idx.has(from) ? P.idx.get(from) : -1;
    if (at >= 0) return at;
    const i = from % G.nc, j = Math.floor(from / G.nc);
    for (const [dx, dy] of DIRS) {
      const ii = i + dx, jj = j + dy;
      if (ii < 0 || jj < 0 || ii >= G.nc || jj >= G.nr) continue;
      const v = P.idx.get(jj * G.nc + ii);
      if (v !== undefined && v > at) at = v;
    }
    return at;
  }

  // Move by (mx, my), in small steps so no thin wall can be skipped over,
  // sliding along a wall rather than stopping dead against it.
  const TURNS = [0.45, -0.45, 0.9, -0.9, 1.3, -1.3].map((a) => [Math.cos(a), Math.sin(a)]);
  function moveBy(st, R, mx, my) {
    const h = st.hole;
    const n = Math.max(1, Math.ceil(Math.hypot(mx, my) / 1.5));
    const sx = mx / n, sy = my / n;
    for (let i = 0; i < n; i++) {
      const nx = h.x + sx, ny = h.y + sy;
      if (freeAt(st, R, nx, ny)) { h.x = nx; h.y = ny; continue; }
      let moved = false;
      if (sx && freeAt(st, R, nx, h.y)) { h.x = nx; moved = true; } else h.vx = 0;
      if (sy && freeAt(st, R, h.x, ny)) { h.y = ny; moved = true; } else h.vy = 0;
      // Pressed into a corner where neither axis slides — a notch where a
      // bridge meets a cloud, the crook of an L of hedge — the step turned a
      // little either way usually is free: he eases round it instead of
      // stopping dead with the way ahead in plain sight (Cloud Land's top
      // size once stood still on a rainbow bridge for good).
      for (let a = 0; !moved && a < TURNS.length; a++) {
        const c = TURNS[a][0], s = TURNS[a][1];
        const qx = h.x + sx * c - sy * s, qy = h.y + sx * s + sy * c;
        if (freeAt(st, R, qx, qy)) { h.x = qx; h.y = qy; moved = true; }
      }
      if (!moved) break;
    }
    if (!freeAt(st, R, h.x, h.y)) unstick(st, R);
  }
  // Stood somewhere he cannot be (a save from before a wall, a push into the
  // bank): out to the nearest spot he can.
  function unstick(st, R) {
    const h = st.hole, G = R.G;
    for (const o of R.solids) {
      const d = gdist(h.x, h.y, o.x, o.y), rc = coreOf(o);
      if (d < rc) {
        const ux = d > 1e-6 ? (h.x - o.x) / d : 1, uy = d > 1e-6 ? (h.y - o.y) / SQ / d : 0;
        const x = o.x + ux * (rc + 0.2), y = o.y + uy * (rc + 0.2) * SQ;
        if (freeAt(st, R, x, y)) { h.x = x; h.y = y; return; }
      }
    }
    // the nearest open cell, by a widening ring
    const k0 = cellHere(G, h.x, h.y);
    const i0 = k0 % G.nc, j0 = Math.floor(k0 / G.nc);
    for (let ring = 0; ring < Math.max(G.nc, G.nr); ring++) {
      let best = -1, bd = Infinity;
      for (let j = j0 - ring; j <= j0 + ring; j++) {
        for (let i = i0 - ring; i <= i0 + ring; i++) {
          if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== ring || i < 0 || j < 0 || i >= G.nc || j >= G.nr) continue;
          const k = j * G.nc + i;
          if (!G.ok[k] || (R.block && R.block[k])) continue;
          const d = gdist(G.cx(k), G.cy(k), h.x, h.y);
          if (d < bd) { bd = d; best = k; }
        }
      }
      if (best >= 0) { h.x = G.cx(best); h.y = G.cy(best); return; }
    }
  }

  // Through a portal: out of its partner, which then sleeps until he has
  // walked away from it (so he is not bounced straight back).
  function warp(st, R) {
    const h = st.hole, G = R.G;
    if (!G.ends.length) return;
    if (st.warpLock >= 0) {
      const e = G.ends[st.warpLock];
      if (gdist(h.x, h.y, e.x, e.y) > RULES.PORTAL_R * 2 + 4) st.warpLock = -1;
    }
    for (let i = 0; i < G.ends.length; i++) {
      const e = G.ends[i];
      if (i === st.warpLock || !e.live || gdist(h.x, h.y, e.x, e.y) > RULES.PORTAL_R) continue;
      const to = G.ends[e.to];
      st.warpLock = e.to;
      R.path = null; R.nearC = null;
      h.vx = h.vy = h.kx = h.ky = 0;
      if (e.fly) {
        // A CANNON (§17): BOOM, and he flies to the far end in an arc — the
        // flight takes a moment, and nothing falls in on the way
        const d = gdist(h.x, h.y, to.x, to.y), F = RULES.FLY;
        st.fly = { x0: round3(h.x), y0: round3(h.y), x1: to.x, y1: to.y, t: 0, d: round3(clamp(d / F.speed, F.min, F.max)) };
        emit(st, { type: "launch", from: [round3(e.x), round3(e.y)], to: [round3(to.x), round3(to.y)], look: e.look, portal: e.pi });
        return;
      }
      emit(st, { type: "warp", from: [round3(e.x), round3(e.y)], to: [round3(to.x), round3(to.y)], look: e.look, portal: e.pi });
      h.x = h.tx = to.x; h.y = h.ty = to.y;
      return;
    }
  }

  // A cannon flight: along the ground line from where he was to the far end
  // (the renderer lifts him in an arc above it); he lands there.
  function flyStep(st, R, dt) {
    const F = st.fly, h = st.hole;
    F.t = Math.min(F.d, F.t + dt);
    const p = F.t / F.d;
    h.x = h.tx = F.x0 + (F.x1 - F.x0) * p;
    h.y = h.ty = F.y0 + (F.y1 - F.y0) * p;
    if (F.t >= F.d) {
      st.fly = null;
      R.path = null; R.nearC = null;
      if (!freeAt(st, R, h.x, h.y)) unstick(st, R);
      emit(st, { type: "land", x: round3(h.x), y: round3(h.y) });
    }
  }

  // RUNAWAYS (§17): a thing he can eat, near him, scoots away — off the
  // ground's edge never, into a wall never, and never further than its leash
  // from home. It tires and rests, and with no way left to run it is caught.
  function moveRunners(st, R, dt) {
    const h = st.hole, G = R.G, Z = zoomScale(st), U = RULES.RUN;
    for (const o of R.runners) {
      if (o.st !== IDLE || o.pull > 0 || !edible(st, o)) continue;
      if (o.rest > 0) { o.rest = Math.max(0, o.rest - dt); continue; }
      const d = gdist(o.x, o.y, h.x, h.y);
      if (d > h.r + o.r + U.flee * Z) { o.ran = Math.max(0, o.ran - dt * 0.5); continue; }
      const gx = o.x - h.x, gy = (o.y - h.y) / SQ, gl = Math.hypot(gx, gy) || 1;
      const sp = U.speed * RULES.VMAX * Z * dt;
      let moved = false;
      for (const a of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) {
        const c = Math.cos(a), sn = Math.sin(a);
        const ux = (gx / gl) * c - (gy / gl) * sn, uy = (gx / gl) * sn + (gy / gl) * c;
        const nx = o.x + ux * sp, ny = o.y + uy * sp * SQ;
        if (!(G.walk(nx, ny) <= -(o.r + RULES.EDGE)) || gdist(nx, ny, o.hx, o.hy) > U.leash) continue;
        let clash = false;
        for (const w of R.solids) if (gdist(nx, ny, w.x, w.y) < coreOf(w) + o.r) { clash = true; break; }
        if (clash) continue;
        o.x = nx; o.y = ny; moved = true;
        break;
      }
      if (moved && o.ran === 0) emit(st, { type: "flee", id: o.id });
      if (moved) o.dir = gx < 0 ? -1 : 1;
      o.ran += dt;
      if (o.ran >= U.tire) { o.ran = 0; o.rest = U.rest; }
    }
  }

  // The riders ride on (a thing the magnet has hold of leaves its track).
  function moveRiders(st, R) {
    for (const o of R.riders) {
      if (o.st !== IDLE || o.free) continue;
      if (o.pull > 0) { o.free = true; continue; }
      const T = R.G.tracks[o.ride], s = o.s0 + T.speed * st.t;
      const p = T.pos(s), q = T.pos(s + Math.sign(T.speed || 1) * 0.8);
      o.x = p.x; o.y = p.y;
      if (q.x > p.x + 1e-6) o.dir = 1; else if (q.x < p.x - 1e-6) o.dir = -1;
    }
  }

  function emit(st, ev) {
    st.events.push(ev);
    if (st.events.length > 200) st.events.splice(0, st.events.length - 200);
  }

  // Aim Gobble at a point (world units). The glide, and a path round anything
  // in the way, do the rest.
  function setTarget(st, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    st.hole.tx = clamp(x, 0, st.W); st.hole.ty = clamp(y, 0, st.H);
  }

  const edible = (st, o) => o.st === IDLE && !o.press && o.r <= st.hole.r * RULES.FIT && !(o.lock && !st.unlocked[o.lock]);
  // A BUTTON (§17) is never food — it is something to roll onto
  const wanted = (st, o) => edible(st, o) || (!!o.press && o.st === IDLE && !o.pressed && !st.unlocked[o.press]);
  // a key is done once eaten (or falling in); a button once pressed
  const openerDone = (o) => (o.press ? !!o.pressed : o.st === FALL || o.st === GONE);
  // The opener of lock `name` to head for next: the nearest one not yet done
  // that he can do now (a key he can eat, or any button).
  function nextOpener(st, R, name) {
    let best = null, bd = Infinity;
    for (const o of R.openers[name] || []) {
      if (openerDone(o) || !wanted(st, o)) continue;
      const d = gdist(o.x, o.y, st.hole.x, st.hole.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // The nearest thing Gobble can eat — nearest to WALK to (the sweet across
  // the pond is not the nearest one when the bridge is far). Cached while he
  // stands in one cell and nothing changes.
  function nearestEdible(st) {
    const R = rt(st), G = R.G, h = st.hole;
    refreshSolids(st, R);
    const from = cellHere(G, h.x, h.y);
    const key = from + ":" + st.navGen + ":" + st.eaten + ":" + h.level + ":" + (R.riders.length || R.runners.length ? Math.floor(st.t * 2) : 0) + ":" +
      st.objects.filter((o) => o.st === IDLE && !o.pressed).length;
    if (R.nearC && R.nearC.key === key && (!R.nearC.o || wanted(st, R.nearC.o))) return R.nearC.o;
    // (an unpressed button of a lock still shut counts: it is a thing to go to)
    const at = new Map();
    for (const o of st.objects) {
      if (!wanted(st, o)) continue;
      const k = cellHere(G, o.x, o.y);
      if (!at.has(k)) at.set(k, []);
      at.get(k).push(o);
    }
    let best = null;
    if (at.size) {
      const res = search(G, from, -1, R.block, (k) => at.has(k), false);
      if (res.found >= 0) {
        let bd = Infinity;
        for (const o of at.get(res.found)) { const d = gdist(o.x, o.y, h.x, h.y); if (d < bd) { bd = d; best = o; } }
      }
      if (!best) {
        // nothing he can walk to (never, for a shipped place): the nearest anyway
        let bd = Infinity;
        for (const list of at.values()) for (const o of list) { const d = gdist(o.x, o.y, h.x, h.y); if (d < bd) { bd = d; best = o; } }
      }
    }
    R.nearC = { key, o: best };
    return best;
  }

  // THE GOAL: once Gobble is big enough to eat the biggest thing in the
  // place, that is what he is here for — the hint and the edge arrow point at
  // it (PLAN_GOBBLE.md §12). Before that, and once it is eaten, there is none.
  // While the finale is still shut away behind a gate, the goal is that
  // gate's KEY (§15.1): a goal he cannot reach strands a child.
  function goalOf(st) {
    if (!st || st.won || st.hole.level < st.levels.R.length - 1) return null;
    let fin = null;
    for (const o of st.objects) if (o.finale) { fin = o; break; }
    if (!fin || fin.st !== IDLE) return null;
    const R = rt(st);
    for (const name of guardsOf(st, R)) {
      if (st.unlocked[name]) continue;
      const k = nextOpener(st, R, name);
      if (k) return k;
    }
    return fin;
  }
  // A FINALE BEHIND A GATE. Which locks stand between where Gobble starts and
  // the finale? Worked out once per place, on the walking grid: with every
  // gate shut there is no way to the finale; with ONE gate open there is —
  // that gate guards it. (Walls of things he can eat through do not count:
  // by the time he is big enough for the finale he can eat them.) Found
  // because the goal used to point at the farm's pumpkin through its locked
  // fence, and a wandering child took a median 200s from "big enough" to
  // the win there, against 3-12s everywhere else.
  function guardsOf(st, R) {
    if (R.guards) return R.guards;
    R.guards = [];
    const names = Object.keys(R.locks);
    let fin = null;
    for (const o of st.objects) if (o.finale) { fin = o; break; }
    if (!fin || !names.length) return R.guards;
    const G = R.G;
    const from = cellHere(G, st.start.x, st.start.y), goal = cellHere(G, fin.x, fin.y);
    const shut = (except) => {
      const B = new Uint8Array(G.n);
      for (const n of names) if (n !== except) for (const o of R.locks[n]) markCore(G, B, o);
      return B;
    };
    if (search(G, from, goal, shut(null), null, false).found >= 0) return R.guards;
    for (const n of names) if (search(G, from, goal, shut(n), null, false).found >= 0) R.guards.push(n);
    return R.guards;
  }

  function startFall(st, o) {
    const h = st.hole;
    o.st = FALL; o.f = 0; o.fx = o.x - h.x; o.fy = o.y - h.y; o.casc = 0;
    emit(st, { type: "fall", id: o.id });
  }

  // Surprises out: a box's goodies when it is eaten ("pop"), a tree's fruit
  // when it is bumped ("shake"), a seedling's flowers when he rolls by
  // ("sprout").
  function reveal(st, o, how) {
    if (!o.kids || !o.kids.length) return;
    if (how === "shake" || how === "sprout") o.shook = true;
    const ids = [];
    for (const id of o.kids) { const k = st.objects[id]; if (k && k.st === HIDDEN) { k.st = IDLE; ids.push(id); } }
    if (ids.length) emit(st, { type: how, id: o.id, kids: ids, x: round3(o.x), y: round3(o.y) });
  }
  // A PIÑATA (§17) bonked: a share of its treats tumbles out each time, and
  // the last bonk bursts it open.
  function bonk(st, o) {
    o.hit++;
    const left = o.kids.filter((id) => st.objects[id].st === HIDDEN);
    const last = o.hit >= o.hits;
    const share = last ? left.length : Math.max(1, Math.floor(o.kids.length / o.hits));
    const ids = left.slice(0, share);
    for (const id of ids) st.objects[id].st = IDLE;
    if (last) o.shook = true;
    emit(st, { type: "hit", id: o.id, n: o.hit, of: o.hits, kids: ids, last, x: round3(o.x), y: round3(o.y) });
  }
  // A key eaten, or a button pressed: one step nearer opening its lock. A
  // lock waits for EVERY opener with its name. One key alone just opens it
  // (as it always has); more than one, or a button, says how far it has got.
  function opened(st, o) {
    const name = o.key || o.press;
    if (!name || st.unlocked[name]) return;
    const all = rt(st).openers[name] || [o];
    const n = all.filter(openerDone).length;
    if (all.length > 1 || o.press) emit(st, { type: "opener", key: name, id: o.id, how: o.press ? "press" : "key", n, of: all.length });
    if (n >= all.length) unlock(st, name);
  }
  function unlock(st, key) {
    st.unlocked[key] = true;
    if (st.wantKey === key) st.wantKey = null;
    const R = rt(st);
    const ids = (R.locks[key] || []).filter((o) => o.st === IDLE).map((o) => o.id);
    emit(st, { type: "unlock", key, ids });
  }
  // a toppling line: eat one and the rest roll in after it, one by one
  function cascade(st, o) {
    const g = rt(st).chains[o.chain] || [];
    for (const m of g) {
      if (m === o || m.st !== IDLE || m.casc) continue;
      m.casc = st.t + 0.12 + 0.11 * Math.abs(m.order - o.order);
    }
  }

  function eat(st, o) {
    const h = st.hole;
    o.st = GONE;
    st.eaten++;
    st.sinceEat = 0; st.hint = -1;
    const was = st.combo;
    st.combo = st.t - st.lastEatT < 0.6 ? Math.min(st.combo + 1, 10) : 0;
    st.lastEatT = st.t;
    if (!st.won) h.xp += o.xp;
    // `vortex`: eaten by the win's slurp, not found by him
    emit(st, { type: "eat", id: o.id, e: o.e, r: o.r, tier: o.tier, combo: st.combo, finale: o.finale, gold: !!o.gold, vortex: st.won });
    // SUPER SLURP (§15.6): ten in a row (the combo counts the gulps after the
    // first, as the run's sparkle does). The run has to break (a pause of
    // 0.6s) and build again before the next one: once the combo tops out it
    // stays there.
    if (!st.won && !o.finale && was < RULES.SLURP.at && st.combo >= RULES.SLURP.at) { st.slurpT = RULES.SLURP.secs; emit(st, { type: "slurp" }); }
    if (!st.won) {
      if (o.kids && o.kids.length) reveal(st, o, "pop");
      if (o.key && !st.unlocked[o.key]) opened(st, o);
      if (o.chain) cascade(st, o);
      // POWER-UPS (§17): a magnet pulls everything near in (the super
      // slurp's own pull, for longer); a lightning bolt makes him zoom
      if (o.power) {
        if (o.power === "magnet") st.slurpT = Math.max(st.slurpT, RULES.POWER.magnet);
        else if (o.power === "zoom") h.zoomT = RULES.POWER.zoom;
        emit(st, { type: "power", kind: o.power, id: o.id });
      }
    }
    // COUNTING (§17): in a counting place every counted thing says the next
    // number — the win's slurp too, so the count always gets to the end
    const C = rt(st).def.count;
    if (C && o.e === C.e) {
      st.counted++;
      const by = C.by || 1, of = rt(st).counts;
      emit(st, { type: "count", k: st.counted, n: st.counted * by, of, last: st.counted >= of });
    }
    const top = st.levels.R.length - 1;
    while (!st.won && h.level < top && h.xp >= st.levels.C[h.level + 1]) {
      h.level++;
      h.R = st.levels.R[h.level];
      // `ready`: this grow makes him big enough for the finale; `gates`: how
      // many walls of things he can now eat through
      const R = rt(st);
      const gates = R.solidObjs.filter((s) => s.st === IDLE && s.solid && !s.lock && s.r <= h.R * RULES.FIT && s.r > st.levels.R[h.level - 1] * RULES.FIT).length;
      emit(st, { type: "grow", level: h.level, ready: h.level === top, gates });
    }
    if (o.finale && !st.won) {
      // the win ends a super slurp at once (the finale can be the last thing
      // left, and the place is done in this same step)
      st.won = true; st.winT = 0; st.wantKey = null; st.slurpT = 0;
      // every surprise still inside comes out for the slurp
      for (const k of st.objects) if (k.st === HIDDEN) k.st = IDLE;
      emit(st, { type: "win" });
    }
    if (st.won && st.eaten >= st.total && !st.done) { st.done = true; emit(st, { type: "allgone" }); }
  }

  // One fixed step.
  function step(st, dt) {
    dt = dt || DT;
    st.t += dt; st.tick++;
    const R = rt(st), G = R.G, h = st.hole;
    refreshSolids(st, R);
    if (R.riders.length) moveRiders(st, R);
    if (R.runners.length && !st.won) moveRunners(st, R, dt);
    if (st.won) {
      st.winT += dt;
      // Gobble glides to the middle for the big slurp
      h.tx = G.mid.x; h.ty = G.mid.y;
    }
    // in flight from a cannon he goes where the cannon sends him; otherwise
    // he glides where the finger points
    if (st.fly) flyStep(st, R, dt);
    else glide(st, R, dt);

    // 6. grow toward this level's size (the picture eases; physics uses r)
    h.r += (h.R - h.r) * Math.min(1, dt * 7);
    if (Math.abs(h.R - h.r) < 0.01) h.r = h.R;
    if (st.slurpT > 0) st.slurpT = Math.max(0, st.slurpT - dt);
    if (h.zoomT > 0) h.zoomT = Math.max(0, h.zoomT - dt);

    // 7. every object
    for (const o of st.objects) {
      if (o.st === GONE || o.st === HIDDEN) continue;
      if (o.wob > 0) o.wob = Math.max(0, o.wob - dt);
      if (o.cd > 0) o.cd = Math.max(0, o.cd - dt);
      if (o.st === FALL) {
        o.f += dt / (0.28 + 0.32 * Math.min(1, o.r / Math.max(h.r, 0.01)));
        if (o.f >= 1) { o.f = 1; eat(st, o); }
        continue;
      }
      // flying over from a cannon, nothing falls in and nothing is touched
      if (st.fly) continue;
      const dist = gdist(o.x, o.y, h.x, h.y);
      const locked = !!o.lock && !st.unlocked[o.lock];
      const fits = !locked && o.r <= h.r * RULES.FIT;
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
      if (o.press) {
        // A BUTTON in the floor (§17): roll onto it and it clicks down for
        // good. It is never food, never pulled, never too big.
        if (!o.pressed && dist < Math.max(o.r * RULES.PRESS[0], h.r * RULES.PRESS[1])) { o.pressed = true; opened(st, o); }
        continue;
      }
      // A SEEDLING (§17): roll near it and its flowers pop up
      if (o.box === "sprout" && !o.shook && dist < h.r + o.r + RULES.SPROUT_R) reveal(st, o, "sprout");
      if (fits && dist <= h.r - o.r * 0.35) { startFall(st, o); continue; }
      if (o.casc && st.t >= o.casc) {
        // a domino in a toppling line: it rolls all the way in by itself,
        // gathering speed (a long line — the Music Land's notes run the
        // whole stem — still arrives in a couple of seconds, not five)
        if (!fits) o.casc = 0;
        else {
          const sp = (70 + h.r * 4 + (st.t - o.casc) * 160) * dt;
          const gx = h.x - o.x, gy = (h.y - o.y) / SQ, gl = Math.hypot(gx, gy) || 1;
          const k = Math.min(sp, gl);
          o.x += (gx / gl) * k; o.y += (gy / gl) * k * SQ;
          o.pull = 1;
          if (o.ride) o.free = true;
          continue;
        }
      }
      const reach = h.r + o.r + RULES.PULL[0] + h.r * RULES.PULL[1];
      // SUPER SLURP (§15.6): while it lasts the pull reaches much further and
      // works much faster — through open air only (a straight line that
      // crosses no water, no wall of things, no locked gate and no portal),
      // and never on the finale
      const S = RULES.SLURP, slurp = st.slurpT > 0 && !o.finale;
      const far = slurp && fits && dist >= reach && dist < reach + S.reach[0] + h.r * S.reach[1] && clearLine(st, R, o.x, o.y, h.x, h.y, -1);
      if (fits && (dist < reach || far)) {
        // THE MAGNET: a thing near the rim slides in — forgiving, and it
        // grows with Gobble.
        const sp = (RULES.PULL_SPEED[0] + h.r * RULES.PULL_SPEED[1]) * (slurp ? S.speed : 1) * dt;
        const gx = h.x - o.x, gy = (h.y - o.y) / SQ, gl = Math.hypot(gx, gy) || 1;
        const k = Math.min(sp, gl);
        o.x += (gx / gl) * k;
        o.y += (gy / gl) * k * SQ;
        o.pull = far ? 1 : clamp((reach - dist) / (reach - (h.r - o.r * 0.35)), 0, 1);
        // `zoom`: slurped from beyond the magnet's own reach (the renderer
        // draws it streaking in)
        o.zoom = far ? 1 : 0;
        if (o.ride) o.free = true;
      } else {
        o.pull = 0; o.zoom = 0;
      }
      // TOO BIG (or locked): it wobbles on the rim and Gobble looks up at it.
      // A wall he is pressed against counts as touching even when his mouth
      // is small beside it.
      const wall = (o.solid || o.lock || o.bounce) && activeSolid(st, o);
      if (!fits && (dist < h.r + o.r * 0.5 || (wall && dist < coreOf(o) + 1.5))) {
        if (o.wob <= 0) o.wob = 0.45;
        if (o.cd <= 0) {
          o.cd = 1.2;
          emit(st, { type: "bump", id: o.id, solid: wall, locked, bounce: !!o.bounce });
          if (locked) st.wantKey = o.lock;
          if (o.bounce) {
            // BOING (§17): a bumper too big to eat knocks him back
            const gx = h.x - o.x, gy = (h.y - o.y) / SQ, gl = Math.hypot(gx, gy) || 1, kv = RULES.KNOCK.v * zoomScale(st);
            h.kx = (gx / gl) * kv; h.ky = (gy / gl) * kv * SQ;
          }
          // a PIÑATA (§17) counts its bonks, once a bump
          if (o.hits && !o.shook) bonk(st, o);
        }
        if (o.box === "shake" && !o.shook && !o.hits) reveal(st, o, "shake");
      }
    }

    // 8. the first time something new is near, it is introduced (§17)
    if (!st.won && st.tick % 10 === 0) meetTick(st, R);

    // 9. the hint: nothing eaten for a while → point at the goal if he is big
    //    enough for it, else at the nearest bite. Bumped into a lock? Point
    //    at its key (or its button) straight away.
    if (!st.won) {
      st.sinceEat += dt;
      const key = st.wantKey ? nextOpener(st, R, st.wantKey) : null;
      if (key) st.hint = key.id;
      else if (st.sinceEat >= RULES.HINT_AFTER) {
        const n = goalOf(st) || nearestEdible(st);
        st.hint = n ? n.id : -1;
      }
    }
  }

  // Where he heads and how he moves this step: the finger (or a path round
  // what is in the way), ice, currents, a bumper's knock, then portals.
  function glide(st, R, dt) {
    const G = R.G, h = st.hole;
    // 1. where to head, and how fast: fast when far, gentle as he arrives
    const wp = waypoint(st, R);
    const dx = wp.x - h.x, dy = wp.y - h.y, d = Math.hypot(dx, dy);
    let vx = 0, vy = 0;
    if (d > 0.005) {
      // (a lightning bolt, §17: he zooms)
      const sp = Math.min((wp.final ? d : d + G.N * 8) * RULES.GAIN, RULES.VMAX * zoomScale(st) * (h.zoomT > 0 ? RULES.POWER.zoomMul : 1));
      vx = (dx / d) * sp; vy = (dy / d) * sp;
    }
    // 2. ICE: he keeps sliding, and turns slowly
    const ice = G.slideAt(h.x, h.y);
    if (ice) {
      const k = 1 - Math.exp(-dt / RULES.ICE_TAU);
      h.vx += (vx - h.vx) * k; h.vy += (vy - h.vy) * k;
    } else { h.vx = vx; h.vy = vy; }
    if (ice !== st.onIce) { st.onIce = ice; if (ice) emit(st, { type: "ice" }); }
    let mx = h.vx * dt, my = h.vy * dt;
    if (!ice) {
      // never glide past the point he is heading for
      const m = Math.hypot(mx, my);
      if (m > d && m > 0) { mx *= d / m; my *= d / m; }
    }
    // 3. CURRENTS: the river (or the belt) carries him — and where he was
    //    heading drifts with it, so let go and he floats along
    const fl = G.flowAt(h.x, h.y);
    if (fl) { mx += fl.x * dt; my += fl.y * dt; h.tx += fl.x * dt; h.ty += fl.y * dt; }
    if (!!fl !== st.inFlow) { st.inFlow = !!fl; if (fl) emit(st, { type: "flow", look: fl.look }); }
    // a BUMPER's knock (§17): it fades fast, and goes through moveBy like
    // everything else — so it can never knock him into the water
    if (h.kx || h.ky) {
      mx += h.kx * dt; my += h.ky * dt;
      const kd = Math.exp(-dt / RULES.KNOCK.tau);
      h.kx *= kd; h.ky *= kd;
      if (Math.hypot(h.kx, h.ky) < 1) h.kx = h.ky = 0;
    }
    // 4. move, never into water or through a wall
    moveBy(st, R, mx, my);
    // 5. portals
    warp(st, R);
  }

  // THE FIRST TIME (§17): a new kind of thing is introduced the first time
  // it is near — a word, and the thing hops — once a kind, once a visit. A
  // place-wide one (counting) once the opening look is done.
  function meetsOf(st, R) {
    const out = [];
    const objs = (fn) => st.objects.filter(fn).map((o) => ({ o }));
    const add = (kind, at, n) => { if (at.length) out.push({ kind, at, n: n || 0 }); };
    add("button", objs((o) => !!o.press));
    for (const [name, all] of Object.entries(R.openers)) {
      const keys = all.filter((o) => o.key);
      if (all.length > 1 && keys.length) { add("keys", keys.map((o) => ({ o })), all.length); void name; break; }
    }
    add("bounce", objs((o) => !!o.bounce));
    add("hits", objs((o) => !!o.hits));
    add("power", objs((o) => !!o.power));
    add("sprout", objs((o) => o.box === "sprout"));
    add("launch", R.G.ends.filter((e) => e.fly && e.live).map((e) => ({ x: e.x, y: e.y })));
    add("spin", R.G.flows.filter((f) => f.spin).map((f) => ({ x: f.spin.x, y: f.spin.y, r: f.spin.rg })));
    if (R.def.count) out.push({ kind: "count", wide: true, n: R.counts });
    return out;
  }
  function meetTick(st, R) {
    if (!R.meet) R.meet = meetsOf(st, R);
    const h = st.hole, reach = RULES.MEET_R * zoomScale(st);
    for (const m of R.meet) {
      if (st.met[m.kind]) continue;
      let hit = null;
      if (m.wide) { if (st.t >= RULES.MEET_T) hit = { id: -1, x: h.x, y: h.y }; }
      else {
        for (const q of m.at) {
          if (q.o && (q.o.st !== IDLE || q.o.pressed || q.o.shook)) continue;
          const x = q.o ? q.o.x : q.x, y = q.o ? q.o.y : q.y;
          if (gdist(x, y, h.x, h.y) < reach + (q.r || 0)) { hit = { id: q.o ? q.o.id : -1, x, y }; break; }
        }
      }
      if (!hit) continue;
      st.met[m.kind] = true;
      emit(st, { type: "meet", kind: m.kind, id: hit.id, x: round3(hit.x), y: round3(hit.y), n: m.n });
      return;   // one at a time
    }
  }

  // A small greedy bot: head for the nearest thing Gobble can eat (by the
  // way he would walk), or the key a lock is asking for. The tests play every
  // place with it, and the browser's test hook uses the same one.
  function botTarget(st) {
    const R = rt(st);
    const key = st.wantKey ? nextOpener(st, R, st.wantKey) : null;
    if (key) return { x: key.x, y: key.y };
    let o = R.bot >= 0 ? st.objects[R.bot] : null;
    if (!o || !wanted(st, o) || st.t - R.botT > 0.5) {
      o = nearestEdible(st);
      R.bot = o ? o.id : -1; R.botT = st.t;
    }
    return o ? { x: o.x, y: o.y } : null;
  }

  // ---- Save / restore ------------------------------------------------------
  // A save stores only WHICH things were eaten (plus where Gobble stood); the
  // xp, the level, the keys turned and the surprises out are re-derived from
  // them, so a corrupt or hand-edited save can never hand Gobble a size or a
  // door it did not earn.
  //
  // An id means "the n-th thing this layout placed", so a run is only good on
  // the layout it was played on: add one sweet to a place and every id after
  // it names a different thing (measured: a 64-bite run then re-pointed 24
  // of its ids at other pictures and handed Gobble a level he never earned).
  // So a run carries its layout's FINGERPRINT, and a run whose fingerprint is
  // not this layout's is dropped — for that place alone.
  function printOf(objects) {
    const parts = objects.map((o) => o.e + "@" + Math.round(o.x * 10) + "," + Math.round(o.y * 10) + "," + Math.round(o.r * 100));
    return hashStr(parts.join(";")).toString(36);
  }
  function snapshot(st) {
    return {
      v: RULES.LAYOUT, scene: st.id, f: st.print,
      // a thing already FALLING is as good as eaten: leaving mid-gulp must
      // not bring it back standing on the rim
      eaten: st.objects.filter((o) => o.st === FALL || o.st === GONE).map((o) => o.id),
      // the buttons he has pressed (§17)
      pressed: st.objects.filter((o) => o.pressed).map((o) => o.id),
      // in the middle of a cannon flight he is saved where he lands
      x: round3(st.fly ? st.fly.x1 : st.hole.x), y: round3(st.fly ? st.fly.y1 : st.hole.y),
    };
  }
  function restore(snap) {
    // a run from another layout names ids that mean different things here:
    // it is dropped, never guessed at
    if (!snap || typeof snap !== "object" || snap.v !== RULES.LAYOUT) return null;
    const def = sceneById(snap.scene);
    if (!def) return null;
    const st = createGame(def);
    // a run saved before fingerprints is trusted unless its place has been
    // laid out again since (RULES.RELAID); a fingerprinted one must match
    if (typeof snap.f === "string" ? snap.f !== st.print : "f" in snap || (RULES.RELAID || []).includes(def.id)) return null;
    const ids = Array.isArray(snap.eaten) ? snap.eaten : [];
    const h = st.hole;
    for (const raw of ids) {
      const o = st.objects[raw | 0];
      if (!o || o.finale || o.st === GONE || !Number.isInteger(raw)) continue;
      o.st = GONE; st.eaten++; h.xp += o.xp;
    }
    // the buttons pressed (only real buttons: a hand-edited save cannot
    // press a key or a tree)
    for (const raw of Array.isArray(snap.pressed) ? snap.pressed : []) {
      const o = Number.isInteger(raw) ? st.objects[raw] : null;
      if (o && o.press) o.pressed = true;
    }
    // what those gulps did: boxes popped, trees shaken, seedlings sprouted,
    // piñatas burst, things counted
    const Rr = rt(st);
    for (const o of st.objects) {
      if (o.st !== GONE) continue;
      if (Rr.def.count && o.e === Rr.def.count.e) st.counted++;
      // a box or a tree eaten let everything in it out; a tree's fruit eaten
      // means it was shaken
      const par = o.par != null ? st.objects[o.par] : null;
      const fam = o.kids ? o : par && par.box !== "pop" ? par : null;
      if (fam) {
        if (fam !== o) { fam.shook = true; if (fam.hits) fam.hit = fam.hits; }
        for (const id of fam.kids) if (st.objects[id].st === HIDDEN) st.objects[id].st = IDLE;
      }
    }
    // a lock is open once every key and button with its name is done
    for (const [name, all] of Object.entries(Rr.openers)) if (all.every(openerDone)) st.unlocked[name] = true;
    while (h.level + 1 < st.levels.R.length && h.xp >= st.levels.C[h.level + 1]) h.level++;
    h.R = h.r = st.levels.R[h.level];
    const R = rt(st);
    refreshSolids(st, R);
    if (Number.isFinite(snap.x) && Number.isFinite(snap.y) && freeAt(st, R, clamp(snap.x, 0, st.W), clamp(snap.y, 0, st.H))) {
      h.x = h.tx = clamp(snap.x, 0, st.W); h.y = h.ty = clamp(snap.y, 0, st.H);
    }
    return st;
  }

  // A compact fingerprint of everything that decides the game (tests compare
  // runs with it). Non-finite numbers are kept visible, never flattened.
  function hashState(st) {
    const n = (v) => (Number.isFinite(v) ? Math.round(v * 1000) : String(v));
    const h = st.hole, F = st.fly;
    const parts = [st.tick, st.eaten, st.won, h.level, h.xp, n(h.x), n(h.y), n(h.r),
      n(h.vx || 0), n(h.vy || 0), Object.keys(st.unlocked || {}).sort().join("|"), st.warpLock,
      n(st.slurpT || 0), n(h.kx || 0), n(h.ky || 0), n(h.zoomT || 0), st.counted | 0,
      F ? [n(F.t), n(F.d), n(F.x1), n(F.y1)].join("/") : "-", Object.keys(st.met || {}).sort().join("|")];
    for (const o of st.objects) parts.push(o.st, n(o.x), n(o.y), n(o.f), o.pressed ? 1 : 0, o.hit | 0, n(o.rest || 0), n(o.ran || 0));
    return hashStr(parts.join(","));
  }

  // ---- PROGRESS: can every grow and the finale really be reached? ---------
  // Pure analysis (the tests and the design tools use it): at each size, the
  // ground he can walk to — with every wall too big for him still standing
  // and every lock whose key he cannot reach still shut — and the xp of
  // everything there he can eat (with the surprises he can get out). The LAW
  // is that each grow needs at most half of that, so a district he never
  // visits can never stall a grow, and the finale is reachable at the top.
  function progressOf(def) {
    if (typeof def === "string") def = sceneById(def);
    const G = geomOf(def), st = createGame(def), R = rt(st), lv = st.levels, top = lv.R.length - 1;
    const unlocked = {};
    const levels = [];
    let finale = false;
    const fin = st.objects.find((o) => o.finale);
    const reachOf = (dist, o, rad) => {
      if (o.ride) {
        // a rider is reachable if its track ever passes within his reach of
        // ground he can stand on
        const T = G.tracks[o.ride];
        for (let i = 0; i < 32; i++) {
          const p = T.pos((T.len * i) / 32), k = G.okNear(p.x, p.y);
          if (Number.isFinite(dist[k]) && gdist(p.x, p.y, G.cx(k), G.cy(k)) < rad * 1.15 + o.r + RULES.PULL[0]) return true;
        }
        return false;
      }
      return Number.isFinite(dist[G.okNear(o.x, o.y)]);
    };
    for (let L = 0; L <= top; L++) {
      const rad = lv.R[L];
      let dist = null;
      for (let guard = 0; guard < 20; guard++) {
        const B = new Uint8Array(G.n);
        for (const o of R.solidObjs) if ((o.lock && !unlocked[o.lock]) || ((o.solid || o.bounce) && o.r > rad * RULES.FIT)) markCore(G, B, o);
        const res = search(G, G.startCell, -1, B, null, true);
        const S = G.scratch;
        dist = new Float64Array(G.n).fill(Infinity);
        for (let k = 0; k < G.n; k++) if (S.done[k] === res.stamp) dist[k] = S.dist[k];
        // a lock opens when EVERY opener with its name can be done: each key
        // reachable and small enough (and, hidden in a box, its box eaten),
        // each button reachable (any size can roll onto a button)
        let more = false;
        for (const [name, all] of Object.entries(R.openers)) {
          if (unlocked[name]) continue;
          const can = all.every((o) => {
            if (o.press) return reachOf(dist, o, rad);
            if (o.r > rad * RULES.FIT) return false;
            const host = o.par != null ? st.objects[o.par] : o;
            if (host !== o && o.how === "pop" && (host.r > rad * RULES.FIT || (host.lock && !unlocked[host.lock]))) return false;
            return reachOf(dist, o, rad) && reachOf(dist, host, rad);
          });
          if (can) { unlocked[name] = true; more = true; }
        }
        if (!more) break;
      }
      let avail = 0;
      for (const o of st.objects) {
        if (o.finale || o.r > rad * RULES.FIT || (o.lock && !unlocked[o.lock])) continue;
        // a button is not food; a runaway may get away; a piñata's treats
        // need bonks a child may never give — none of them counts (§17)
        if (o.press || o.run) continue;
        if (!reachOf(dist, o, rad)) continue;
        if (o.par != null) {
          const p = st.objects[o.par];
          if (p.hits) continue;
          if (!reachOf(dist, p, rad)) continue;
          if (o.how === "pop" && (p.r > rad * RULES.FIT || (p.lock && !unlocked[p.lock]))) continue;
        }
        avail += o.xp;
      }
      levels.push({ level: L, avail, need: L < top ? lv.C[L + 1] : null });
      if (L === top) finale = reachOf(dist, fin, rad);
    }
    return { levels, finale, unlocked: Object.keys(unlocked) };
  }

  // ---- OUTLINES (for the renderer): the island's edge, and each look of
  // the things he walks round, as closed rings of world points ---------------
  // Marching squares over the place's own fields, so the picture's edge and
  // the walking edge are the same line.
  const outlines = new WeakMap();
  function outlineOf(def) {
    if (typeof def === "string") def = sceneById(def);
    let O = outlines.get(def);
    if (O) return O;
    const G = geomOf(def);
    const land = contours(G.fIsl, G.fnx, G.fny, G.fx0, G.fy0, G.FS);
    const blocks = {};
    const looks = new Map();
    (def.blocks || []).forEach((b) => { const l = b.look || "water"; if (!looks.has(l)) looks.set(l, []); looks.get(l).push(compileShape(b, G.W, G.H)); });
    for (const [look, fs] of looks) {
      const F = new Float32Array(G.fnx * G.fny);
      for (let j = 0; j < G.fny; j++) {
        const gy = (G.fy0 + j * G.FS) / SQ;
        for (let i = 0; i < G.fnx; i++) {
          let d = FAR;
          for (const f of fs) { const v = f(G.fx0 + i * G.FS, gy); if (v < d) d = v; }
          // only the part ON the island is drawn: a lava river that runs to
          // the coast ends at the coast, and a hedge never stands over the sea
          // (walking ignores a block off the island anyway)
          const k = j * G.fnx + i;
          F[k] = Math.max(d, G.fIsl[k]);
        }
      }
      blocks[look] = contours(F, G.fnx, G.fny, G.fx0, G.fy0, G.FS);
    }
    O = { land, blocks };
    outlines.set(def, O);
    return O;
  }
  function contours(F0, nx0, ny0, x00, y00, s) {
    // The grid is padded with one ring of OUTSIDE points, so every outline is
    // a closed ring. A shape still inside at the grid's edge would otherwise
    // leave an open chain, and tracing an open chain from its middle splits it
    // into scraps (the volcano's lava rivers drew as a row of little bits).
    const nx = nx0 + 2, ny = ny0 + 2, x0 = x00 - s, y0 = y00 - s;
    const F = new Float32Array(nx * ny).fill(FAR);
    for (let j = 0; j < ny0; j++) F.set(F0.subarray(j * nx0, (j + 1) * nx0), (j + 1) * nx + 1);
    const inside = (k) => F[k] <= 0;
    // an edge point's key: horizontal edges 2k, vertical edges 2k+1 (k = the
    // grid point they start at)
    const pos = new Map(), adj = new Map();
    const pt = (key) => {
      if (pos.has(key)) return;
      const k = key >> 1, i = k % nx, j = Math.floor(k / nx);
      const a = F[k], b = key & 1 ? F[k + nx] : F[k + 1], t = a === b ? 0.5 : clamp(a / (a - b), 0, 1);
      pos.set(key, key & 1 ? [x0 + i * s, y0 + (j + t) * s] : [x0 + (i + t) * s, y0 + j * s]);
    };
    const link = (p, q) => {
      pt(p); pt(q);
      if (!adj.has(p)) adj.set(p, []);
      if (!adj.has(q)) adj.set(q, []);
      adj.get(p).push(q); adj.get(q).push(p);
    };
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const k = j * nx + i;
        const tl = inside(k), tr = inside(k + 1), br = inside(k + nx + 1), bl = inside(k + nx);
        const code = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const T = 2 * k, B = 2 * (k + nx), Lf = 2 * k + 1, Rt = 2 * (k + 1) + 1;
        const centre = (F[k] + F[k + 1] + F[k + nx] + F[k + nx + 1]) / 4 <= 0;
        switch (code) {
          case 1: case 14: link(Lf, B); break;
          case 2: case 13: link(B, Rt); break;
          case 3: case 12: link(Lf, Rt); break;
          case 4: case 11: link(T, Rt); break;
          case 6: case 9: link(T, B); break;
          case 7: case 8: link(T, Lf); break;
          case 5: if (centre) { link(T, Lf); link(B, Rt); } else { link(T, Rt); link(Lf, B); } break;
          case 10: if (centre) { link(T, Rt); link(Lf, B); } else { link(T, Lf); link(B, Rt); } break;
        }
      }
    }
    const rings = [], seen = new Set();
    for (const startKey of adj.keys()) {
      if (seen.has(startKey)) continue;
      const ring = [];
      let prev = -1, cur = startKey;
      for (let guard = 0; guard < 200000; guard++) {
        seen.add(cur);
        ring.push(pos.get(cur));
        const nb = adj.get(cur);
        const next = nb[0] !== prev ? nb[0] : nb[1];
        if (next === undefined || next === startKey || seen.has(next)) break;
        prev = cur; cur = next;
      }
      if (ring.length >= 3) rings.push(simplify(ring, 0.35));
    }
    return rings;
  }
  // Ramer–Douglas–Peucker on a closed ring
  function simplify(ring, tol) {
    if (ring.length < 8) return ring;
    const keep = new Uint8Array(ring.length);
    keep[0] = 1; keep[ring.length - 1] = 1;
    const stack = [[0, ring.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      let md = 0, mi = -1;
      for (let i = a + 1; i < b; i++) {
        const d = segDist(ring[i][0], ring[i][1], ring[a][0], ring[a][1], ring[b][0], ring[b][1]);
        if (d > md) { md = d; mi = i; }
      }
      if (md > tol && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
    }
    return ring.filter((p, i) => keep[i]);
  }

  const HoleLogic = {
    DT, IDLE, FALL, GONE, HIDDEN,
    rng, hashStr, printOf, twistsOf, gdist, worldOf, sceneById, layout, levelsOf, zoomScale, viewSpan,
    goldOf, countOf, GOLD_BANDS, itemOf, geomOf, outlineOf, progressOf, routeLine,
    createGame, setTarget, step, nearestEdible, edible, goalOf, botTarget, activeSolid,
    snapshot, restore, hashState,
    // the shape machinery, for the tests that hold it to brute force
    compileShape, segIndex, segsOf, contours, SHAPE_CAP,
  };
  global.HoleLogic = HoleLogic;
  if (typeof module !== "undefined" && module.exports) module.exports = HoleLogic;
})(typeof window !== "undefined" ? window : globalThis);
