// Fort Josh: Toybox Defense — canvas renderer (TD-2.1, artistic pass).
// Reads engine state, never mutates it. ORIENTATION-AWARE: in a portrait
// viewport the FLOOR (bg + path + pads, 24×14 cells) is drawn ROTATED 90° so
// the battlefield fills the tall phone screen; in landscape it draws unrotated.
// Geometry stays in world cells everywhere — worldToScreen/screenToWorld are the
// ONE mapping (taps, bubbles and HUD share it, so rotation can never desync input
// from drawing). Passes per frame:
//   1. FLOOR pass under the rotation transform (baked bg, path, pads, range
//      rings, world particle fx — all rotation-safe circles/lines)
//   2. CHARACTER pass in SCREEN space, UPRIGHT (towers, soldiers, enemies,
//      shells, projectiles, hp bars, glyphs, gold floaters) — so a sock's face
//      and a turret's barrels never render sideways in portrait.
// All motion here is deterministic (tick/id driven) — no Math.random, no state
// mutation; the renderer only ever READS engine state.

(function (global) {
  function create(canvas, engine) {
    const ctx = canvas.getContext("2d");
    const GRID = global.TDData.GRID;
    let cell = 16, dpr = 1, rotated = false, cssW = 0, cssH = 0;
    let selection = null; // {pad?, ghostRange?, tower?}
    const fx = [];        // {kind, x, y, ttl, max, text?} (world coords)
    const prevPos = new Map();
    let bg = null;
    const NIGHT = !!engine.levelDef.night;
    const ZONES = engine.levelDef.zones || null;
    // TD-6 fx juice: a tiny screen-shake on heavy impacts (boss/Bertha/stomp),
    // capped ≤4px and DISABLED under prefers-reduced-motion. Deterministic decay
    // (tick-driven, no Math.random). Damage numbers are opt-in (settings toggle).
    const reduceMotion = !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
    let shakeTtl = 0, shakeMag = 0;
    let showDmg = false; // set via api.setDamageNumbers
    function triggerShake(mag) {
      if (reduceMotion) return;
      mag = Math.min(4, mag);
      if (mag >= shakeMag * (shakeTtl > 0 ? shakeTtl / 10 : 0)) { shakeMag = mag; shakeTtl = 10; }
    }
    // The range-preview multiplier comes from the ENGINE (it folds in the Night
    // Owl star-tree node) — recomputing it here from RULES would lie once the
    // node is owned.
    const nightMul = engine.rangeMul || 1;
    // TD-7: a level can have multiple lanes; the engine built them all.
    const lanes = engine.levelDef.paths || [engine.levelDef.path];
    const pathTotal = engine.paths[0].total; // primary lane length (decor + fallback)
    // Lever levels: precompute each lane's DIVERGENT middle (the waypoints that
    // are not part of the shared prefix/tail) so the live route overlay can veil
    // exactly the branch the train will NOT take — never the shared segments,
    // which belong to BOTH routes. Padded one shared point each side so the
    // veil stroke visually meets the fork/rejoin.
    let leverSeg = null;
    if (engine.levelDef.lever && lanes.length > 1) {
      const a = lanes[0], b = lanes[1];
      let pre = 0;
      while (pre < a.length && pre < b.length && a[pre][0] === b[pre][0] && a[pre][1] === b[pre][1]) pre += 1;
      let suf = 0;
      while (suf < a.length - pre && suf < b.length - pre &&
             a[a.length - 1 - suf][0] === b[b.length - 1 - suf][0] &&
             a[a.length - 1 - suf][1] === b[b.length - 1 - suf][1]) suf += 1;
      const mid = (arr) => arr.slice(Math.max(0, pre - 1), arr.length - suf + 1);
      leverSeg = { mids: [mid(a), mid(b)] };
    }
    let lastLitLane = -1; // leverInfo() test hook: which lane the overlay lit last draw
    function tangentAt(dist) { const a = engine.posAt(Math.max(0, dist - 0.35)), b = engine.posAt(Math.min(pathTotal, dist + 0.35)); let tx = b.x - a.x, ty = b.y - a.y; const m = Math.hypot(tx, ty) || 1; return { x: tx / m, y: ty / m }; }

    function resize() {
      const parent = canvas.parentElement;
      const vw = parent ? parent.clientWidth : 360;
      // A hidden screen measures 0 wide, and `Math.max(10, …)` would silently
      // rebuild the whole field at the MINIMUM cell — a collapsed battlefield
      // that survives until something resizes again. Keep the last good size
      // instead; the screen resizes for real when it is shown.
      if (parent && vw <= 0 && cssW) return;
      // vertical budget: MEASURED — everything from the wrap's top edge down to
      // the bottom of the viewport is field (the CALL button floats over it, and
      // the site topbar is hidden inside the fort), minus a small safe margin.
      let chromeTop = 250;
      if (parent && parent.getBoundingClientRect) {
        const top = parent.getBoundingClientRect().top;
        if (top > 0) chromeTop = top;
      }
      // …minus anything laid out BELOW the field (the power strip in portrait).
      // Measured generically — an absolutely-positioned control costs nothing, so
      // a future floating widget needs no change here, and an in-flow one is
      // accounted for automatically instead of silently pushing the page taller.
      let below = 0;
      for (let n = parent && parent.nextElementSibling; n; n = n.nextElementSibling) {
        if (n.hidden) continue;
        const cs = global.getComputedStyle ? global.getComputedStyle(n) : null;
        if (cs && (cs.position === "absolute" || cs.position === "fixed")) continue;
        if (n.offsetHeight) below += n.offsetHeight + 8;
      }
      const vh = Math.max(240, (global.innerHeight || 700) - chromeTop - 18 - below);
      rotated = (global.innerHeight || 700) > (global.innerWidth || 360);
      if (rotated) cell = Math.max(10, Math.min(Math.floor(vw / GRID.h), Math.floor(vh / GRID.w)));
      else cell = Math.max(10, Math.min(Math.floor(vw / GRID.w), Math.floor(vh / GRID.h)));
      cssW = cell * (rotated ? GRID.h : GRID.w);
      cssH = cell * (rotated ? GRID.w : GRID.h);
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bg = null;
    }

    // ---- The ONE world↔screen mapping (CSS px, canvas-relative) ----
    function worldToScreen(wx, wy) {
      if (rotated) return { x: cssW - wy * cell, y: wx * cell };
      return { x: wx * cell, y: wy * cell };
    }
    function screenToWorld(sx, sy) {
      if (rotated) return { x: sy / cell, y: (cssW - sx) / cell };
      return { x: sx / cell, y: sy / cell };
    }
    function enterWorld() { // apply the rotation transform for the FLOOR pass
      ctx.save();
      if (rotated) { ctx.translate(cssW, 0); ctx.rotate(Math.PI / 2); }
    }
    function exitWorld() { ctx.restore(); }

    // ---- Baked floor: gradient, subtle rug texture, the path ribbon, pads ----
    function bakeBg() {
      bg = document.createElement("canvas");
      const W = cell * GRID.w, H = cell * GRID.h; // WORLD-oriented bake
      bg.width = W * dpr; bg.height = H * dpr;
      const b = bg.getContext("2d");
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = b.createLinearGradient(0, 0, 0, H);
      if (NIGHT) { g.addColorStop(0, "#070d1c"); g.addColorStop(1, "#0c1526"); } // firefly-night: darker floor
      else { g.addColorStop(0, "#12213c"); g.addColorStop(1, "#1c2c49"); }
      b.fillStyle = g; b.fillRect(0, 0, W, H);
      if (NIGHT) { // scattered firefly glows (baked, deterministic positions)
        for (let i = 0; i < 14; i++) {
          const fx0 = ((i * 137) % (GRID.w * 10)) / 10, fy0 = ((i * 71) % (GRID.h * 10)) / 10;
          const gl = b.createRadialGradient(fx0 * cell, fy0 * cell, 0, fx0 * cell, fy0 * cell, cell * 0.7);
          gl.addColorStop(0, "rgba(200,255,150,0.20)"); gl.addColorStop(1, "rgba(200,255,150,0)");
          b.fillStyle = gl; b.beginPath(); b.arc(fx0 * cell, fy0 * cell, cell * 0.7, 0, 7); b.fill();
        }
      }
      // soft vignette so the field feels like a lit playmat
      const vig = b.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.62);
      vig.addColorStop(0, "rgba(255,255,255,0.05)"); vig.addColorStop(1, "rgba(0,0,0,0.18)");
      b.fillStyle = vig; b.fillRect(0, 0, W, H);
      // faint carpet weave
      b.strokeStyle = "rgba(255,255,255,0.035)"; b.lineWidth = 1;
      for (let y = 0; y < GRID.h; y += 1) { b.beginPath(); b.moveTo(0, y * cell); b.lineTo(W, y * cell); b.stroke(); }
      for (let x = 0; x < GRID.w; x += 1) { b.beginPath(); b.moveTo(x * cell, 0); b.lineTo(x * cell, H); b.stroke(); }

      b.lineCap = "round"; b.lineJoin = "round";
      const primaryPath = lanes[0];
      const ribbon = (path, width, color, dash) => {
        b.strokeStyle = color; b.lineWidth = width;
        if (dash) b.setLineDash(dash); else b.setLineDash([]);
        b.beginPath();
        b.moveTo((path[0][0] + 0.5) * cell, (path[0][1] + 0.5) * cell);
        for (const [x, y] of path.slice(1)) b.lineTo((x + 0.5) * cell, (y + 0.5) * cell);
        b.stroke();
      };
      // TD-7: secondary lanes (the lever's "switch track") beneath, in a cooler
      // steel-blue so the alternate route reads as a toy train siding.
      for (let i = lanes.length - 1; i >= 1; i--) {
        ribbon(lanes[i], cell * 1.12, "#243244");
        ribbon(lanes[i], cell * 0.9, "#4d6b86");
        ribbon(lanes[i], Math.max(2, cell * 0.08), "rgba(180,220,255,0.5)", [cell * 0.28, cell * 0.28]);
      }
      // the primary (default) lane on top: a warm wooden toy-road
      ribbon(primaryPath, cell * 1.16, "#3c2f22");
      ribbon(primaryPath, cell * 1.0, "#caa268");
      ribbon(primaryPath, cell * 0.86, "#e0bd83");
      ribbon(primaryPath, Math.max(2, cell * 0.09), "rgba(255,255,255,0.55)", [cell * 0.34, cell * 0.34]);
      b.setLineDash([]);
      // spawn/exit endcaps tinted so the route reads at a glance (lanes share both)
      const cap = (pt, color) => { b.fillStyle = color; b.beginPath(); b.arc((pt[0] + 0.5) * cell, (pt[1] + 0.5) * cell, cell * 0.6, 0, 7); b.fill(); };
      cap(primaryPath[0], "rgba(120,170,255,0.25)");
      cap(primaryPath[primaryPath.length - 1], "rgba(120,255,170,0.25)");

      // build pads: bolted steel sockets that clearly say "build here"
      for (const p of engine.levelDef.pads) {
        const px = (p.cx + 0.5) * cell, py = (p.cy + 0.5) * cell;
        b.fillStyle = "rgba(0,0,0,0.22)";
        b.beginPath(); b.ellipse(px, py + cell * 0.12, cell * 0.44, cell * 0.2, 0, 0, 7); b.fill();
        b.fillStyle = "#334a6b";
        b.beginPath(); b.arc(px, py, cell * 0.4, 0, 7); b.fill();
        b.fillStyle = "#3f5c85";
        b.beginPath(); b.arc(px, py, cell * 0.32, 0, 7); b.fill();
        b.setLineDash([cell * 0.14, cell * 0.12]);
        b.strokeStyle = "rgba(197,222,255,0.5)"; b.lineWidth = Math.max(1.5, cell * 0.05);
        b.beginPath(); b.arc(px, py, cell * 0.22, 0, 7); b.stroke();
        b.setLineDash([]);
        b.strokeStyle = "rgba(197,222,255,0.75)"; b.lineWidth = Math.max(1.5, cell * 0.06); b.lineCap = "round";
        b.beginPath(); b.moveTo(px - cell * 0.1, py); b.lineTo(px + cell * 0.1, py);
        b.moveTo(px, py - cell * 0.1); b.lineTo(px, py + cell * 0.1); b.stroke();
        // corner bolts
        b.fillStyle = "#2b3f5c";
        for (let k = 0; k < 4; k++) {
          const a = Math.PI / 4 + k * Math.PI / 2;
          b.beginPath(); b.arc(px + Math.cos(a) * cell * 0.34, py + Math.sin(a) * cell * 0.34, cell * 0.045, 0, 7); b.fill();
        }
        // TD-16 ⚡ POWER PAD: a live socket. Whatever is built here is
        // permanently buffed, so it has to look different from twenty feet away
        // — an amber ring, a spark, and a wired lead running off the plate.
        if (p.boost) {
          b.strokeStyle = "rgba(255,196,84,0.95)"; b.lineWidth = Math.max(2, cell * 0.08);
          b.beginPath(); b.arc(px, py, cell * 0.44, 0, 7); b.stroke();
          b.strokeStyle = "rgba(255,196,84,0.35)"; b.lineWidth = Math.max(1.5, cell * 0.05);
          b.beginPath(); b.arc(px, py, cell * 0.55, 0, 7); b.stroke();
          b.fillStyle = "#ffd35c";                       // the spark in the socket
          b.beginPath();
          b.moveTo(px - cell * 0.07, py - cell * 0.16); b.lineTo(px + cell * 0.05, py - cell * 0.03);
          b.lineTo(px - cell * 0.01, py - cell * 0.01); b.lineTo(px + cell * 0.07, py + cell * 0.16);
          b.lineTo(px - cell * 0.05, py + cell * 0.02); b.lineTo(px + cell * 0.01, py + cell * 0.0);
          b.closePath(); b.fill();
          b.strokeStyle = "rgba(255,196,84,0.6)"; b.lineWidth = Math.max(1.5, cell * 0.045); // the lead
          b.beginPath();
          b.moveTo(px + cell * 0.42, py + cell * 0.16);
          b.quadraticCurveTo(px + cell * 0.72, py + cell * 0.34, px + cell * 0.62, py + cell * 0.6);
          b.stroke();
        }
      }
    }

    // ---------- shared bits ----------
    function shadow(x, y, rx, ry) {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
    }

    // ---------- enemies (upright, screen space) ----------
    // A boss must LOOK like one. The scale is a data field (`size`), so a new
    // boss is big by declaring it, not by hand-tuning a constant in here.
    function bossScale(e, fallback) {
      const def = global.TDData.ENEMIES[e.type];
      return (def && def.size) || fallback;
    }
    // 🧨's reveal rider: a flushed-out hider must LOOK catchable, or the player
    // has no way to know the blast did anything (the picture is the mechanic —
    // the same lesson the side-door marker taught).
    function revealed(e) { return !!(engine.isRevealed && engine.isRevealed(e)); }
    function drawEnemy(e, sx, sy) {
      const r = cell * 0.34;
      if (revealed(e)) {
        const pulse = 0.25 + 0.15 * Math.sin(engine.state.tick / 4 + e.id);
        ctx.fillStyle = "rgba(255,214,120," + pulse.toFixed(2) + ")";
        ctx.beginPath(); ctx.arc(sx, sy, r * 1.5, 0, 7); ctx.fill();
      }
      if (e.type === "balloon") {
        // a floating balloon-bug: small ground shadow (it hovers), body, knot, string
        shadow(sx, sy + cell * 0.5, r * 0.6, r * 0.22);
        const by = sy - cell * 0.06;
        ctx.strokeStyle = "rgba(230,235,245,0.7)"; ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.beginPath(); ctx.moveTo(sx, by + r * 1.0);
        ctx.quadraticCurveTo(sx + r * 0.4, by + r * 1.5, sx, by + r * 1.9); ctx.stroke();
        const gg = ctx.createRadialGradient(sx - r * 0.35, by - r * 0.4, r * 0.1, sx, by, r * 1.15);
        gg.addColorStop(0, "#ff9aa9"); gg.addColorStop(1, "#e23b57");
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.ellipse(sx, by, r * 0.9, r * 1.08, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#e23b57";
        ctx.beginPath(); ctx.moveTo(sx - r * 0.16, by + r * 1.02); ctx.lineTo(sx + r * 0.16, by + r * 1.02); ctx.lineTo(sx, by + r * 1.28); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath(); ctx.ellipse(sx - r * 0.34, by - r * 0.36, r * 0.2, r * 0.3, -0.5, 0, 7); ctx.fill();
        // buggy eyes
        ctx.fillStyle = "#22304a";
        ctx.beginPath(); ctx.arc(sx - r * 0.28, by, r * 0.13, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.28, by, r * 0.13, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(sx - r * 0.31, by - r * 0.04, r * 0.045, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.25, by - r * 0.04, r * 0.045, 0, 7); ctx.fill();
      } else if (e.type === "marble") {
        // a glossy speed-marble with a cat's-eye swirl + specular pop
        shadow(sx, sy + cell * 0.28, r * 0.7, r * 0.26);
        const rr = r * 0.78;
        const gm = ctx.createRadialGradient(sx - rr * 0.35, sy - rr * 0.4, rr * 0.15, sx, sy, rr);
        gm.addColorStop(0, "#d6f0ff"); gm.addColorStop(0.55, "#5aa9e6"); gm.addColorStop(1, "#245b95");
        ctx.fillStyle = gm;
        ctx.beginPath(); ctx.arc(sx, sy, rr, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.85)"; // swirl lens
        ctx.beginPath(); ctx.ellipse(sx + rr * 0.1, sy, rr * 0.5, rr * 0.22, 0.5, 0, 7); ctx.fill();
        ctx.fillStyle = "#e86bd0";
        ctx.beginPath(); ctx.ellipse(sx + rr * 0.1, sy, rr * 0.34, rr * 0.13, 0.5, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.95)"; // specular
        ctx.beginPath(); ctx.arc(sx - rr * 0.38, sy - rr * 0.4, rr * 0.2, 0, 7); ctx.fill();
      // ---- Phase 2: the per-world backbone SKINS ----
      // Same body as the Sock Goblin (34hp trooper) or the Speedy Marble (16hp
      // sprinter), a different costume per world — so the Garage and Moving Day
      // stop being the same wave table in different level names. Each needs a
      // real branch: the chain ends in a default sock, and the ART guardrail
      // fails if any two enemy types hash the same, which is how a missing
      // branch announces itself.
      } else if (e.type === "acorn") {
        // 🌰 Acorn Trooper — a nut in a cap, marching with a stubby stem
        shadow(sx, sy + r * 0.55, r * 0.6, r * 0.18);
        const ga = ctx.createLinearGradient(sx, sy - r * 0.2, sx, sy + r * 0.6);
        ga.addColorStop(0, "#e6b678"); ga.addColorStop(1, "#b57a3c");
        ctx.fillStyle = ga;
        ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.16, r * 0.6, r * 0.62, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#6b4423"; // cap
        ctx.beginPath(); ctx.ellipse(sx, sy - r * 0.3, r * 0.68, r * 0.36, 0, Math.PI, 0); ctx.fill();
        ctx.fillRect(sx - r * 0.68, sy - r * 0.32, r * 1.36, r * 0.12);
        ctx.strokeStyle = "#4d3018"; ctx.lineWidth = Math.max(1, cell * 0.035);
        ctx.beginPath(); ctx.moveTo(sx, sy - r * 0.6); ctx.lineTo(sx + r * 0.1, sy - r * 0.92); ctx.stroke(); // stem
        ctx.fillStyle = "#3a2412";
        ctx.beginPath(); ctx.arc(sx - r * 0.2, sy + r * 0.1, r * 0.09, 0, 7); ctx.arc(sx + r * 0.2, sy + r * 0.1, r * 0.09, 0, 7); ctx.fill();
        ctx.strokeStyle = "#3a2412"; ctx.lineWidth = Math.max(1, cell * 0.025);
        ctx.beginPath(); ctx.arc(sx, sy + r * 0.3, r * 0.18, 0.25, Math.PI - 0.25); ctx.stroke();
      } else if (e.type === "ant") {
        // 🐜 Ant Scout — three beads and skittering legs, so speed READS
        shadow(sx, sy + r * 0.4, r * 0.6, r * 0.14);
        const sk = Math.sin(engine.state.tick / 2 + e.id) * r * 0.12;
        ctx.strokeStyle = "#2b1b10"; ctx.lineWidth = Math.max(1, cell * 0.028);
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath(); ctx.moveTo(sx + k * r * 0.22, sy); ctx.lineTo(sx + k * r * 0.22 - r * 0.3, sy + r * 0.42 + (k ? sk : -sk)); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx + k * r * 0.22, sy); ctx.lineTo(sx + k * r * 0.22 + r * 0.3, sy + r * 0.42 - (k ? sk : -sk)); ctx.stroke();
        }
        ctx.fillStyle = "#54331c";
        ctx.beginPath(); ctx.ellipse(sx + r * 0.42, sy, r * 0.34, r * 0.3, 0, 0, 7); ctx.fill(); // abdomen
        ctx.fillStyle = "#7a4a26";
        ctx.beginPath(); ctx.ellipse(sx, sy, r * 0.24, r * 0.22, 0, 0, 7); ctx.fill(); // thorax
        ctx.fillStyle = "#3d2413";
        ctx.beginPath(); ctx.ellipse(sx - r * 0.42, sy - r * 0.04, r * 0.28, r * 0.26, 0, 0, 7); ctx.fill(); // head
        ctx.strokeStyle = "#3d2413"; ctx.lineWidth = Math.max(1, cell * 0.022);
        ctx.beginPath(); ctx.moveTo(sx - r * 0.6, sy - r * 0.15); ctx.lineTo(sx - r * 0.85, sy - r * 0.5); ctx.moveTo(sx - r * 0.55, sy - r * 0.2); ctx.lineTo(sx - r * 0.68, sy - r * 0.58); ctx.stroke();
        ctx.fillStyle = "#ffe9c4";
        ctx.beginPath(); ctx.arc(sx - r * 0.5, sy - r * 0.06, r * 0.07, 0, 7); ctx.fill();
      } else if (e.type === "yoyo") {
        // 🪀 Yo-Yo Bandit — two discs on an axle, hanging off its own string
        ctx.strokeStyle = "rgba(240,240,250,0.75)"; ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.beginPath(); ctx.moveTo(sx, sy - r * 1.05); ctx.lineTo(sx, sy - r * 0.15); ctx.stroke();
        shadow(sx, sy + r * 0.7, r * 0.6, r * 0.18);
        const spin = (engine.state.tick / 4 + e.id) % 6.283;
        const gy = ctx.createRadialGradient(sx - r * 0.25, sy - r * 0.2, r * 0.1, sx, sy + r * 0.1, r * 0.8);
        gy.addColorStop(0, "#ff9e6b"); gy.addColorStop(1, "#c8412a");
        ctx.fillStyle = gy;
        ctx.beginPath(); ctx.arc(sx, sy + r * 0.1, r * 0.7, 0, 7); ctx.fill();
        ctx.strokeStyle = "#7d2415"; ctx.lineWidth = Math.max(1, cell * 0.04);
        ctx.beginPath(); ctx.arc(sx, sy + r * 0.1, r * 0.7, 0, 7); ctx.stroke();
        ctx.strokeStyle = "rgba(255,240,220,0.85)"; ctx.lineWidth = Math.max(1, cell * 0.03);
        for (let k = 0; k < 3; k++) { // spokes make the spin visible
          const a = spin + k * 2.094;
          ctx.beginPath(); ctx.moveTo(sx, sy + r * 0.1); ctx.lineTo(sx + Math.cos(a) * r * 0.55, sy + r * 0.1 + Math.sin(a) * r * 0.55); ctx.stroke();
        }
        ctx.fillStyle = "#ffe6c8";
        ctx.beginPath(); ctx.arc(sx, sy + r * 0.1, r * 0.16, 0, 7); ctx.fill();
      } else if (e.type === "die") {
        // 🎲 Runaway Die — a tumbling white cube; the pip face rolls as it moves
        shadow(sx, sy + r * 0.55, r * 0.6, r * 0.16);
        const face = 1 + (Math.floor(e.dist * 1.5) % 6);
        ctx.save();
        ctx.translate(sx, sy); ctx.rotate(Math.sin(e.dist * 0.9 + e.id) * 0.35);
        const gd = ctx.createLinearGradient(0, -r * 0.6, 0, r * 0.6);
        gd.addColorStop(0, "#ffffff"); gd.addColorStop(1, "#cfd6e2");
        ctx.fillStyle = gd; ctx.beginPath(); ctx.rect(-r * 0.58, -r * 0.58, r * 1.16, r * 1.16); ctx.fill();
        ctx.strokeStyle = "#8d97a8"; ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.strokeRect(-r * 0.58, -r * 0.58, r * 1.16, r * 1.16);
        ctx.fillStyle = "#28303f";
        const pip = (px, py) => { ctx.beginPath(); ctx.arc(px * r * 0.32, py * r * 0.32, r * 0.11, 0, 7); ctx.fill(); };
        if (face % 2) pip(0, 0);
        if (face > 1) { pip(-1, -1); pip(1, 1); }
        if (face > 3) { pip(-1, 1); pip(1, -1); }
        if (face === 6) { pip(-1, 0); pip(1, 0); }
        ctx.restore();
      } else if (e.type === "mitten") {
        // 🧤 Lost Mitten — a knitted mitten with a cuff and a dangling thread
        shadow(sx, sy + r * 0.6, r * 0.55, r * 0.16);
        const gmi = ctx.createLinearGradient(sx, sy - r * 0.6, sx, sy + r * 0.6);
        gmi.addColorStop(0, "#e0567a"); gmi.addColorStop(1, "#9c2f4d");
        ctx.fillStyle = gmi;
        ctx.beginPath();
        ctx.moveTo(sx - r * 0.42, sy + r * 0.55); ctx.lineTo(sx - r * 0.42, sy - r * 0.2);
        ctx.quadraticCurveTo(sx - r * 0.42, sy - r * 0.72, sx + r * 0.06, sy - r * 0.72);
        ctx.quadraticCurveTo(sx + r * 0.5, sy - r * 0.72, sx + r * 0.5, sy - r * 0.2);
        ctx.lineTo(sx + r * 0.5, sy + r * 0.55); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#c14264"; // thumb
        ctx.beginPath(); ctx.ellipse(sx + r * 0.6, sy - r * 0.02, r * 0.18, r * 0.3, -0.3, 0, 7); ctx.fill();
        ctx.fillStyle = "#f4e3d0"; // cuff
        ctx.beginPath(); ctx.rect(sx - r * 0.5, sy + r * 0.4, r * 1.1, r * 0.28); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = Math.max(1, cell * 0.022);
        for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(sx + k * r * 0.24, sy - r * 0.6); ctx.lineTo(sx + k * r * 0.24, sy + r * 0.36); ctx.stroke(); }
        ctx.strokeStyle = "#f4e3d0"; ctx.lineWidth = Math.max(1, cell * 0.02); // loose thread
        ctx.beginPath(); ctx.moveTo(sx - r * 0.5, sy + r * 0.54);
        ctx.quadraticCurveTo(sx - r * 0.9, sy + r * 0.4, sx - r * 0.8, sy + r * 0.75); ctx.stroke();
        ctx.fillStyle = "#3a2030";
        ctx.beginPath(); ctx.arc(sx - r * 0.12, sy - r * 0.16, r * 0.08, 0, 7); ctx.arc(sx + r * 0.2, sy - r * 0.16, r * 0.08, 0, 7); ctx.fill();
      } else if (e.type === "yarn") {
        // 🧶 Yarn Ball — a wound ball trailing its own strand, rolling
        shadow(sx, sy + r * 0.4, r * 0.62, r * 0.2);
        const rr = r * 0.72, roll = e.dist * 1.4 + e.id;
        const gyn = ctx.createRadialGradient(sx - rr * 0.35, sy - rr * 0.4, rr * 0.12, sx, sy, rr);
        gyn.addColorStop(0, "#b9e6c8"); gyn.addColorStop(1, "#3f8f66");
        ctx.fillStyle = gyn; ctx.beginPath(); ctx.arc(sx, sy, rr, 0, 7); ctx.fill();
        ctx.save();
        ctx.beginPath(); ctx.arc(sx, sy, rr, 0, 7); ctx.clip();
        ctx.strokeStyle = "rgba(20,70,50,0.5)"; ctx.lineWidth = Math.max(1, cell * 0.03);
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.ellipse(sx, sy, rr * 0.95, rr * 0.34, roll * 0.3 + k * 0.6, 0, 7);
          ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = "#3f8f66"; ctx.lineWidth = Math.max(1, cell * 0.028); // trailing strand
        ctx.beginPath(); ctx.moveTo(sx - rr * 0.9, sy + rr * 0.3);
        ctx.quadraticCurveTo(sx - rr * 1.6, sy + rr * 0.1, sx - rr * 1.5, sy + rr * 0.8); ctx.stroke();
      } else if (e.type === "rag") {
        // 🧽 Grease Rag — a slumped oily cloth with drips
        shadow(sx, sy + r * 0.5, r * 0.7, r * 0.18);
        const gg2 = ctx.createLinearGradient(sx, sy - r * 0.5, sx, sy + r * 0.5);
        gg2.addColorStop(0, "#7f8896"); gg2.addColorStop(1, "#454d59");
        ctx.fillStyle = gg2;
        ctx.beginPath();
        ctx.moveTo(sx - r * 0.75, sy + r * 0.4);
        ctx.quadraticCurveTo(sx - r * 0.85, sy - r * 0.35, sx - r * 0.25, sy - r * 0.5);
        ctx.quadraticCurveTo(sx + r * 0.3, sy - r * 0.68, sx + r * 0.7, sy - r * 0.25);
        ctx.quadraticCurveTo(sx + r * 0.92, sy + r * 0.2, sx + r * 0.5, sy + r * 0.44);
        ctx.quadraticCurveTo(sx, sy + r * 0.24, sx - r * 0.75, sy + r * 0.4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(24,22,18,0.65)"; // grease patches
        ctx.beginPath(); ctx.ellipse(sx - r * 0.2, sy - r * 0.05, r * 0.26, r * 0.17, 0.4, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(sx + r * 0.36, sy + r * 0.1, r * 0.16, r * 0.11, -0.3, 0, 7); ctx.fill();
        ctx.fillStyle = "#1b1a16"; // a drip below
        ctx.beginPath(); ctx.ellipse(sx + r * 0.1, sy + r * 0.62, r * 0.08, r * 0.14, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#f0f3f8";
        ctx.beginPath(); ctx.arc(sx - r * 0.22, sy - r * 0.22, r * 0.1, 0, 7); ctx.arc(sx + r * 0.16, sy - r * 0.26, r * 0.1, 0, 7); ctx.fill();
        ctx.fillStyle = "#20242c";
        ctx.beginPath(); ctx.arc(sx - r * 0.2, sy - r * 0.2, r * 0.05, 0, 7); ctx.arc(sx + r * 0.18, sy - r * 0.24, r * 0.05, 0, 7); ctx.fill();
      } else if (e.type === "cog") {
        // ⚙️ Rogue Cog — a toothed steel gear that spins as it rolls
        shadow(sx, sy + r * 0.45, r * 0.6, r * 0.16);
        const rr2 = r * 0.66, spin2 = e.dist * 1.1 + e.id;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(spin2);
        const gc = ctx.createRadialGradient(-rr2 * 0.3, -rr2 * 0.3, rr2 * 0.1, 0, 0, rr2);
        gc.addColorStop(0, "#dfe6f0"); gc.addColorStop(1, "#7c879a");
        ctx.fillStyle = gc;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a0 = (k / 8) * 6.283, a1 = a0 + 0.28, a2 = a0 + 0.505;
          ctx.lineTo(Math.cos(a0) * rr2, Math.sin(a0) * rr2);
          ctx.lineTo(Math.cos(a0 + 0.14) * rr2 * 1.32, Math.sin(a0 + 0.14) * rr2 * 1.32);
          ctx.lineTo(Math.cos(a1) * rr2 * 1.32, Math.sin(a1) * rr2 * 1.32);
          ctx.lineTo(Math.cos(a2) * rr2, Math.sin(a2) * rr2);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#4d5765"; ctx.lineWidth = Math.max(1, cell * 0.03); ctx.stroke();
        ctx.fillStyle = "#2f3743"; ctx.beginPath(); ctx.arc(0, 0, rr2 * 0.34, 0, 7); ctx.fill();
        ctx.restore();
      } else if (e.type === "wad") {
        // 🗞️ Packing Wad — a crumpled ball of newsprint with creases + print
        shadow(sx, sy + r * 0.5, r * 0.6, r * 0.17);
        ctx.fillStyle = "#eee7d6";
        ctx.beginPath();
        const lobes = 9;
        for (let k = 0; k <= lobes; k++) {
          const a = (k / lobes) * 6.283;
          const rad = r * (0.62 + 0.16 * Math.sin(k * 2.3 + e.id));
          ctx.lineTo(sx + Math.cos(a) * rad, sy + Math.sin(a) * rad);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#b9ad93"; ctx.lineWidth = Math.max(1, cell * 0.025);
        ctx.beginPath();
        ctx.moveTo(sx - r * 0.5, sy - r * 0.2); ctx.lineTo(sx - r * 0.05, sy + r * 0.06); ctx.lineTo(sx + r * 0.45, sy - r * 0.3);
        ctx.moveTo(sx - r * 0.25, sy + r * 0.45); ctx.lineTo(sx + r * 0.05, sy + r * 0.05); ctx.lineTo(sx + r * 0.4, sy + r * 0.4);
        ctx.stroke();
        ctx.fillStyle = "rgba(90,84,72,0.55)"; // scraps of print
        for (let k = 0; k < 3; k++) ctx.fillRect(sx - r * 0.34 + k * r * 0.06, sy - r * 0.46 + k * r * 0.3, r * 0.4, r * 0.06);
        ctx.fillStyle = "#4a4438";
        ctx.beginPath(); ctx.arc(sx - r * 0.18, sy - r * 0.06, r * 0.07, 0, 7); ctx.arc(sx + r * 0.18, sy - r * 0.06, r * 0.07, 0, 7); ctx.fill();
      } else if (e.type === "peanut") {
        // 🥜 Packing Peanut — a pale foam S-curve, bouncing along
        const bob = Math.sin(engine.state.tick / 4 + e.id) * r * 0.12;
        shadow(sx, sy + r * 0.5, r * 0.45, r * 0.13);
        ctx.save(); ctx.translate(sx, sy + bob); ctx.rotate(-0.5);
        const gp = ctx.createLinearGradient(-r * 0.4, -r * 0.4, r * 0.4, r * 0.4);
        gp.addColorStop(0, "#fdfaf0"); gp.addColorStop(1, "#ddd4bd");
        ctx.fillStyle = gp;
        ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.22, r * 0.3, r * 0.26, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.3, r * 0.22, r * 0.3, r * 0.26, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.rect(-r * 0.3, -r * 0.24, r * 0.6, r * 0.48); ctx.fill();
        ctx.strokeStyle = "rgba(160,150,125,0.7)"; ctx.lineWidth = Math.max(1, cell * 0.022);
        ctx.beginPath(); ctx.moveTo(-r * 0.42, -r * 0.02); ctx.lineTo(r * 0.42, -r * 0.02); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = "#6a6252";
        ctx.beginPath(); ctx.arc(sx - r * 0.16, sy + bob - r * 0.08, r * 0.06, 0, 7); ctx.arc(sx + r * 0.06, sy + bob - r * 0.2, r * 0.06, 0, 7); ctx.fill();
      } else if (e.type === "blob" || e.type === "mudlet") {
        // Mud Blob / Mudlet: a gloopy brown blob with a wobble and a grumpy face
        const rr = (e.type === "blob" ? r * 1.0 : r * 0.62), w = Math.sin(engine.state.tick / 5 + e.id) * rr * 0.08;
        shadow(sx, sy + rr * 0.9, rr * 0.9, rr * 0.3);
        const gb = ctx.createRadialGradient(sx - rr * 0.3, sy - rr * 0.3, rr * 0.1, sx, sy, rr);
        gb.addColorStop(0, "#a9814e"); gb.addColorStop(1, "#6e4d24");
        ctx.fillStyle = gb;
        ctx.beginPath();
        ctx.moveTo(sx - rr, sy + rr * 0.6);
        ctx.quadraticCurveTo(sx - rr * 1.05, sy - rr * 0.7, sx - rr * 0.3, sy - rr * 0.8 + w);
        ctx.quadraticCurveTo(sx, sy - rr * 1.05, sx + rr * 0.3, sy - rr * 0.8 - w);
        ctx.quadraticCurveTo(sx + rr * 1.05, sy - rr * 0.7, sx + rr, sy + rr * 0.6);
        ctx.quadraticCurveTo(sx + rr, sy + rr * 0.95, sx, sy + rr * 0.9);
        ctx.quadraticCurveTo(sx - rr, sy + rr * 0.95, sx - rr, sy + rr * 0.6);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath(); ctx.arc(sx - rr * 0.28, sy - rr * 0.1, rr * 0.16, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + rr * 0.28, sy - rr * 0.1, rr * 0.16, 0, 7); ctx.fill();
        ctx.fillStyle = "#241a0e";
        ctx.beginPath(); ctx.arc(sx - rr * 0.28, sy - rr * 0.08, rr * 0.08, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + rr * 0.28, sy - rr * 0.08, rr * 0.08, 0, 7); ctx.fill();
      } else if (e.type === "knight") {
        // Plastic Knight: a steel-blue armored toy with a shield emblem + helmet slit
        shadow(sx, sy + r * 0.5, r * 0.6, r * 0.2);
        const gk = ctx.createLinearGradient(sx - r, sy - r, sx + r, sy + r);
        gk.addColorStop(0, "#cfd8e6"); gk.addColorStop(0.5, "#8a9bb4"); gk.addColorStop(1, "#5b6b86");
        ctx.fillStyle = gk;
        ctx.beginPath(); ctx.moveTo(sx, sy - r * 0.85);
        ctx.quadraticCurveTo(sx + r * 0.75, sy - r * 0.75, sx + r * 0.7, sy + r * 0.2);
        ctx.quadraticCurveTo(sx + r * 0.6, sy + r * 0.9, sx, sy + r * 0.95);
        ctx.quadraticCurveTo(sx - r * 0.6, sy + r * 0.9, sx - r * 0.7, sy + r * 0.2);
        ctx.quadraticCurveTo(sx - r * 0.75, sy - r * 0.75, sx, sy - r * 0.85);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#3a475e"; ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.beginPath(); ctx.moveTo(sx - r * 0.32, sy - r * 0.28); ctx.lineTo(sx + r * 0.32, sy - r * 0.28); ctx.stroke(); // helmet slit
        ctx.fillStyle = "#22304a"; ctx.beginPath(); ctx.rect(sx - r * 0.28, sy - r * 0.32, r * 0.56, r * 0.14); ctx.fill();
        ctx.strokeStyle = "#ffe27a"; ctx.lineWidth = Math.max(1, cell * 0.045); ctx.lineCap = "round"; // shield cross
        ctx.beginPath(); ctx.moveTo(sx, sy + r * 0.12); ctx.lineTo(sx, sy + r * 0.62); ctx.moveTo(sx - r * 0.22, sy + r * 0.34); ctx.lineTo(sx + r * 0.22, sy + r * 0.34); ctx.stroke();
      } else if (e.type === "bull") {
        // Wind-up Bull: a tan bull with horns + a wind-up key; reddens while charging
        const charging = e.chargeUntil && engine.state.tick < e.chargeUntil;
        shadow(sx, sy + r * 0.5, r * 0.7, r * 0.22);
        ctx.strokeStyle = "#efe4c8"; ctx.lineWidth = Math.max(1.5, cell * 0.06); ctx.lineCap = "round"; // horns
        ctx.beginPath(); ctx.moveTo(sx - r * 0.55, sy - r * 0.35); ctx.quadraticCurveTo(sx - r * 0.8, sy - r * 0.7, sx - r * 0.5, sy - r * 0.85);
        ctx.moveTo(sx + r * 0.55, sy - r * 0.35); ctx.quadraticCurveTo(sx + r * 0.8, sy - r * 0.7, sx + r * 0.5, sy - r * 0.85); ctx.stroke();
        ctx.strokeStyle = "#c9b487"; ctx.lineWidth = Math.max(1.5, cell * 0.05); // wind-up key
        ctx.beginPath(); ctx.moveTo(sx, sy - r * 0.6); ctx.lineTo(sx, sy - r * 0.95); ctx.stroke();
        ctx.beginPath(); ctx.arc(sx - r * 0.12, sy - r, r * 0.12, 0, 7); ctx.arc(sx + r * 0.12, sy - r, r * 0.12, 0, 7); ctx.stroke();
        const gu = ctx.createRadialGradient(sx - r * 0.2, sy - r * 0.2, r * 0.1, sx, sy, r * 0.85);
        gu.addColorStop(0, charging ? "#e88a6a" : "#c9a877"); gu.addColorStop(1, charging ? "#b4482e" : "#8a6a3e");
        ctx.fillStyle = gu; ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.08, r * 0.7, r * 0.62, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#3a2a18"; ctx.beginPath(); ctx.arc(sx - r * 0.22, sy - r * 0.05, r * 0.1, 0, 7); ctx.arc(sx + r * 0.22, sy - r * 0.05, r * 0.1, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.32, r * 0.18, r * 0.12, 0, 0, 7); ctx.fill(); // snout
        if (charging) { ctx.strokeStyle = "rgba(255,120,90,0.7)"; ctx.lineWidth = 2; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(sx + r * 0.9, sy + k * r * 0.3); ctx.lineTo(sx + r * 1.3, sy + k * r * 0.3); ctx.stroke(); } }
      } else if (e.type === "healer") {
        // Junk Healer: a grey bot with a glowing green + (heal) and a wrench antenna
        shadow(sx, sy + r * 0.5, r * 0.55, r * 0.2);
        ctx.strokeStyle = "#9aa7b8"; ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.beginPath(); ctx.moveTo(sx, sy - r * 0.6); ctx.lineTo(sx, sy - r * 0.92); ctx.stroke();
        ctx.fillStyle = "#8f9db0"; ctx.beginPath(); ctx.arc(sx, sy - r * 0.98, r * 0.1, 0, 7); ctx.fill();
        const gh = ctx.createLinearGradient(sx, sy - r * 0.6, sx, sy + r * 0.7);
        gh.addColorStop(0, "#b9c4d2"); gh.addColorStop(1, "#79879a");
        ctx.fillStyle = gh; ctx.beginPath(); ctx.moveTo(sx - r * 0.6, sy - r * 0.45);
        ctx.arcTo(sx - r * 0.6, sy + r * 0.7, sx, sy + r * 0.7, r * 0.3); ctx.arcTo(sx + r * 0.6, sy + r * 0.7, sx + r * 0.6, sy - r * 0.45, r * 0.3);
        ctx.arcTo(sx + r * 0.6, sy - r * 0.6, sx, sy - r * 0.6, r * 0.3); ctx.arcTo(sx - r * 0.6, sy - r * 0.6, sx - r * 0.6, sy - r * 0.45, r * 0.3); ctx.closePath(); ctx.fill();
        const glow = 0.55 + 0.35 * Math.sin(engine.state.tick / 6 + e.id);
        ctx.fillStyle = "rgba(90,220,120," + glow.toFixed(2) + ")"; // heal +
        ctx.beginPath(); ctx.rect(sx - r * 0.08, sy - r * 0.28, r * 0.16, r * 0.7); ctx.rect(sx - r * 0.28, sy - r * 0.08, r * 0.56, r * 0.16); ctx.fill();
      } else if (e.type === "pinata") {
        // Piñata: a chubby festive body with colored frills + a little party face
        shadow(sx, sy + r * 0.85, r * 1.0, r * 0.28);
        const cols = ["#f25c78", "#ffd94a", "#5ac8e6", "#7ed957"];
        ctx.fillStyle = "#b64a86"; ctx.beginPath(); ctx.ellipse(sx, sy, r * 0.95, r * 0.85, 0, 0, 7); ctx.fill();
        for (let s = 0; s < 5; s++) { ctx.fillStyle = cols[s % cols.length]; ctx.beginPath(); ctx.ellipse(sx, sy - r * 0.7 + s * r * 0.4, r * 0.95, r * 0.14, 0, 0, 7); ctx.fill(); }
        ctx.strokeStyle = "#ffd94a"; ctx.lineWidth = Math.max(1, cell * 0.04); ctx.beginPath(); ctx.moveTo(sx, sy - r * 0.85); ctx.lineTo(sx, sy - r * 1.15); ctx.stroke(); // string
        ctx.fillStyle = "#241a2a"; ctx.beginPath(); ctx.arc(sx - r * 0.24, sy - r * 0.05, r * 0.08, 0, 7); ctx.arc(sx + r * 0.24, sy - r * 0.05, r * 0.08, 0, 7); ctx.fill();
      } else if (e.type === "brick") {
        // Brick: a red toy brick with mortar lines
        shadow(sx, sy + r * 0.45, r * 0.6, r * 0.16);
        const gr = ctx.createLinearGradient(sx, sy - r * 0.5, sx, sy + r * 0.5);
        gr.addColorStop(0, "#d16a4a"); gr.addColorStop(1, "#a94a30");
        ctx.fillStyle = gr; ctx.beginPath(); ctx.rect(sx - r * 0.7, sy - r * 0.42, r * 1.4, r * 0.84); ctx.fill();
        ctx.strokeStyle = "rgba(255,240,230,0.5)"; ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.beginPath(); ctx.moveTo(sx - r * 0.7, sy); ctx.lineTo(sx + r * 0.7, sy); ctx.moveTo(sx, sy - r * 0.42); ctx.lineTo(sx, sy); ctx.moveTo(sx - r * 0.35, sy); ctx.lineTo(sx - r * 0.35, sy + r * 0.42); ctx.moveTo(sx + r * 0.35, sy); ctx.lineTo(sx + r * 0.35, sy + r * 0.42); ctx.stroke();
      } else if (e.type === "bedmonster") {
        // Bed Monster boss: a big scary-cute bed with eyes + a toothy grin
        const R = r * bossScale(e, 1.9);
        shadow(sx, sy + R * 0.55, R * 0.8, R * 0.24);
        ctx.fillStyle = "#6a4a8a"; ctx.beginPath(); ctx.moveTo(sx - R * 0.7, sy - R * 0.2); ctx.lineTo(sx - R * 0.7, sy - R * 0.62); ctx.arcTo(sx - R * 0.7, sy - R * 0.78, sx - R * 0.5, sy - R * 0.78, R * 0.16); ctx.lineTo(sx + R * 0.5, sy - R * 0.78); ctx.arcTo(sx + R * 0.7, sy - R * 0.78, sx + R * 0.7, sy - R * 0.62, R * 0.16); ctx.lineTo(sx + R * 0.7, sy - R * 0.2); ctx.closePath(); ctx.fill(); // headboard
        const gm = ctx.createLinearGradient(sx, sy - R * 0.3, sx, sy + R * 0.5);
        gm.addColorStop(0, "#e7edf7"); gm.addColorStop(1, "#c2cbe0");
        ctx.fillStyle = gm; ctx.beginPath(); ctx.moveTo(sx - R * 0.8, sy + R * 0.5); ctx.arcTo(sx - R * 0.8, sy - R * 0.35, sx, sy - R * 0.35, R * 0.3); ctx.arcTo(sx + R * 0.8, sy - R * 0.35, sx + R * 0.8, sy + R * 0.5, R * 0.3); ctx.closePath(); ctx.fill(); // mattress
        ctx.fillStyle = "#e2626b"; ctx.beginPath(); ctx.ellipse(sx + R * 0.42, sy - R * 0.18, R * 0.3, R * 0.16, 0, 0, 7); ctx.fill(); // pillow
        // face on the mattress
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sx - R * 0.28, sy + R * 0.02, R * 0.17, 0, 7); ctx.arc(sx + R * 0.05, sy + R * 0.02, R * 0.17, 0, 7); ctx.fill();
        ctx.fillStyle = "#2a1030"; ctx.beginPath(); ctx.arc(sx - R * 0.24, sy + R * 0.05, R * 0.08, 0, 7); ctx.arc(sx + R * 0.09, sy + R * 0.05, R * 0.08, 0, 7); ctx.fill();
        ctx.fillStyle = "#7a2030"; ctx.beginPath(); ctx.moveTo(sx - R * 0.35, sy + R * 0.26); ctx.quadraticCurveTo(sx, sy + R * 0.5, sx + R * 0.35, sy + R * 0.26); ctx.closePath(); ctx.fill(); // grin
        ctx.fillStyle = "#fff"; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(sx + k * R * 0.13, sy + R * 0.27); ctx.lineTo(sx + k * R * 0.13 + R * 0.06, sy + R * 0.27); ctx.lineTo(sx + k * R * 0.13 + R * 0.03, sy + R * 0.37); ctx.closePath(); ctx.fill(); } // teeth
      } else if (e.type === "ghost") {
        // Glitter Ghost: a translucent sheet ghost; fades right out mid-phase so
        // the player SEES why it can't be targeted, then shimmers back.
        ctx.save();
        ctx.globalAlpha = (e.phaseHidden && !revealed(e)) ? 0.22 : 0.9;
        const rr = r * 0.95, w = Math.sin(engine.state.tick / 6 + e.id) * rr * 0.06;
        const gg = ctx.createLinearGradient(sx, sy - rr, sx, sy + rr);
        gg.addColorStop(0, "#eaf2ff"); gg.addColorStop(1, "#b9caf0");
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(sx, sy - rr * 0.15, rr * 0.8, Math.PI, 0);
        ctx.lineTo(sx + rr * 0.8, sy + rr * 0.7 + w);
        for (let k = 2; k >= -2; k--) { const bx = sx + k * rr * 0.32; ctx.quadraticCurveTo(bx + rr * 0.16, sy + rr * (k % 2 ? 0.5 : 0.85), bx, sy + rr * 0.7 - w * (k % 2)); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#38507a";
        ctx.beginPath(); ctx.arc(sx - rr * 0.26, sy - rr * 0.12, rr * 0.14, 0, 7); ctx.arc(sx + rr * 0.26, sy - rr * 0.12, rr * 0.14, 0, 7); ctx.fill();
        if (e.phaseHidden) { ctx.strokeStyle = "rgba(180,210,255,0.5)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy, rr * 1.1, 0, 7); ctx.stroke(); }
        ctx.restore();
      } else if (e.type === "battery") {
        // Battery Bot: a boxy tin robot; a blue shield bubble shows while charged
        shadow(sx, sy + r * 0.5, r * 0.6, r * 0.2);
        ctx.strokeStyle = "#9aa7b8"; ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.beginPath(); ctx.moveTo(sx - r * 0.2, sy - r * 0.62); ctx.lineTo(sx - r * 0.2, sy - r * 0.9); ctx.moveTo(sx + r * 0.2, sy - r * 0.62); ctx.lineTo(sx + r * 0.2, sy - r * 0.9); ctx.stroke();
        ctx.fillStyle = "#cdd7e6"; ctx.beginPath(); ctx.arc(sx - r * 0.2, sy - r * 0.94, r * 0.08, 0, 7); ctx.arc(sx + r * 0.2, sy - r * 0.94, r * 0.08, 0, 7); ctx.fill();
        const gbt = ctx.createLinearGradient(sx, sy - r * 0.6, sx, sy + r * 0.6);
        gbt.addColorStop(0, "#c3ccd8"); gbt.addColorStop(1, "#7d8a9c");
        ctx.fillStyle = gbt; ctx.beginPath(); ctx.rect(sx - r * 0.6, sy - r * 0.6, r * 1.2, r * 1.2); ctx.fill();
        ctx.strokeStyle = "#59677a"; ctx.lineWidth = Math.max(1, cell * 0.03); ctx.strokeRect(sx - r * 0.6, sy - r * 0.6, r * 1.2, r * 1.2);
        ctx.fillStyle = "#22304a"; ctx.beginPath(); ctx.arc(sx - r * 0.22, sy - r * 0.16, r * 0.11, 0, 7); ctx.arc(sx + r * 0.22, sy - r * 0.16, r * 0.11, 0, 7); ctx.fill();
        // battery gauge (green bars)
        ctx.fillStyle = "#69d06a"; for (let k = 0; k < 3; k++) { ctx.fillRect(sx - r * 0.34 + k * r * 0.26, sy + r * 0.18, r * 0.16, r * 0.18); }
        if (e.shield > 0) { const sh = 0.4 + 0.3 * Math.sin(engine.state.tick / 5 + e.id); ctx.strokeStyle = "rgba(120,190,255," + sh.toFixed(2) + ")"; ctx.lineWidth = Math.max(2, cell * 0.06); ctx.beginPath(); ctx.arc(sx, sy, r * 1.05, 0, 7); ctx.stroke(); }
      } else if (e.type === "mole") {
        // Digger Mole: above ground a brown mole; in the middle third it BURROWS —
        // shown as a scrolling dirt mound (matches the engine's untargetable zone).
        const laneTot = engine.paths[e.pathIdx || 0].total; // its own lane's middle third
        const under = e.dist > laneTot / 3 && e.dist < (laneTot * 2) / 3 && !revealed(e);
        if (under) {
          ctx.fillStyle = "#6e4d29"; ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.2, r * 0.95, r * 0.5, 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = "#5a3e20"; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.arc(sx + k * r * 0.4, sy + r * 0.18, r * 0.14, 0, 7); ctx.fill(); }
          ctx.fillStyle = "rgba(120,90,55,0.6)"; ctx.beginPath(); ctx.moveTo(sx - r * 0.2, sy - r * 0.1); ctx.lineTo(sx, sy - r * 0.4); ctx.lineTo(sx + r * 0.2, sy - r * 0.1); ctx.closePath(); ctx.fill();
        } else {
          shadow(sx, sy + r * 0.5, r * 0.55, r * 0.18);
          const gml = ctx.createRadialGradient(sx - r * 0.2, sy - r * 0.2, r * 0.1, sx, sy, r * 0.9);
          gml.addColorStop(0, "#8a6a44"); gml.addColorStop(1, "#5c4023");
          ctx.fillStyle = gml; ctx.beginPath(); ctx.ellipse(sx, sy, r * 0.75, r * 0.68, 0, 0, 7); ctx.fill();
          ctx.fillStyle = "#f0c9a0"; ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.28, r * 0.28, r * 0.2, 0, 0, 7); ctx.fill(); // snout
          ctx.fillStyle = "#3a2a18"; ctx.beginPath(); ctx.arc(sx, sy + r * 0.3, r * 0.08, 0, 7); ctx.fill();
          ctx.fillStyle = "#2a1c10"; ctx.beginPath(); ctx.arc(sx - r * 0.2, sy - r * 0.02, r * 0.07, 0, 7); ctx.arc(sx + r * 0.2, sy - r * 0.02, r * 0.07, 0, 7); ctx.fill();
          ctx.strokeStyle = "#e9dccb"; ctx.lineWidth = Math.max(1.5, cell * 0.05); ctx.lineCap = "round"; // claws
          ctx.beginPath(); ctx.moveTo(sx - r * 0.5, sy + r * 0.5); ctx.lineTo(sx - r * 0.66, sy + r * 0.62); ctx.moveTo(sx - r * 0.36, sy + r * 0.56); ctx.lineTo(sx - r * 0.48, sy + r * 0.72); ctx.stroke();
        }
      } else if (e.type === "hawk") {
        // Kite Hawk: a fast diamond kite with a bow tail — a flier, so it hovers
        shadow(sx, sy + cell * 0.5, r * 0.5, r * 0.18);
        const by = sy - cell * 0.05;
        const gh = ctx.createLinearGradient(sx, by - r * 0.7, sx, by + r * 0.7);
        gh.addColorStop(0, "#ff8f5a"); gh.addColorStop(1, "#e0552f");
        ctx.fillStyle = gh;
        ctx.beginPath(); ctx.moveTo(sx, by - r * 0.75); ctx.lineTo(sx + r * 0.55, by); ctx.lineTo(sx, by + r * 0.75); ctx.lineTo(sx - r * 0.55, by); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = Math.max(1, cell * 0.025);
        ctx.beginPath(); ctx.moveTo(sx, by - r * 0.75); ctx.lineTo(sx, by + r * 0.75); ctx.moveTo(sx - r * 0.55, by); ctx.lineTo(sx + r * 0.55, by); ctx.stroke();
        // bow tail (flutters)
        const fl = Math.sin(engine.state.tick / 3 + e.id) * r * 0.2;
        ctx.strokeStyle = "#ffd94a"; ctx.lineWidth = Math.max(1.5, cell * 0.04);
        ctx.beginPath(); ctx.moveTo(sx, by + r * 0.75); ctx.quadraticCurveTo(sx + fl, by + r * 1.1, sx - fl, by + r * 1.4); ctx.stroke();
        ctx.fillStyle = "#22304a"; ctx.beginPath(); ctx.arc(sx - r * 0.12, by, r * 0.08, 0, 7); ctx.arc(sx + r * 0.12, by, r * 0.08, 0, 7); ctx.fill();
      } else if (e.type === "vacuumking") {
        // Vacuum King boss: a swirling tornado with a little gold crown
        const R = r * bossScale(e, 1.8), spin = engine.state.tick * 0.2;
        shadow(sx, sy + R * 0.55, R * 0.7, R * 0.2);
        const gv = ctx.createLinearGradient(sx, sy - R * 0.8, sx, sy + R * 0.7);
        gv.addColorStop(0, "#8fa6c8"); gv.addColorStop(1, "#4c5e80");
        ctx.fillStyle = gv;
        ctx.beginPath();
        ctx.moveTo(sx - R * 0.7, sy - R * 0.75); ctx.quadraticCurveTo(sx, sy - R, sx + R * 0.7, sy - R * 0.75);
        ctx.quadraticCurveTo(sx + R * 0.2, sy - R * 0.1, sx + R * 0.28, sy + R * 0.5);
        ctx.quadraticCurveTo(sx, sy + R * 0.72, sx - R * 0.28, sy + R * 0.5);
        ctx.quadraticCurveTo(sx - R * 0.2, sy - R * 0.1, sx - R * 0.7, sy - R * 0.75); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = Math.max(2, cell * 0.06);
        for (let k = 0; k < 4; k++) { const yy = sy - R * 0.6 + k * R * 0.35, ph = spin + k; ctx.beginPath(); ctx.ellipse(sx + Math.sin(ph) * R * 0.12, yy, R * (0.62 - k * 0.12), R * 0.1, 0, 0, 7); ctx.stroke(); }
        ctx.fillStyle = "#22304a"; ctx.beginPath(); ctx.arc(sx - R * 0.16, sy - R * 0.35, R * 0.1, 0, 7); ctx.arc(sx + R * 0.16, sy - R * 0.35, R * 0.1, 0, 7); ctx.fill();
        ctx.fillStyle = "#ffd94a"; // crown
        ctx.beginPath(); ctx.moveTo(sx - R * 0.4, sy - R * 0.78); ctx.lineTo(sx - R * 0.4, sy - R * 1.02); ctx.lineTo(sx - R * 0.2, sy - R * 0.86); ctx.lineTo(sx, sy - R * 1.08); ctx.lineTo(sx + R * 0.2, sy - R * 0.86); ctx.lineTo(sx + R * 0.4, sy - R * 1.02); ctx.lineTo(sx + R * 0.4, sy - R * 0.78); ctx.closePath(); ctx.fill();
      } else if (e.type === "thestatic") {
        // The Static boss: a crackling electric cloud; brighter as it escalates
        const R = r * bossScale(e, 1.85), frac = e.hp / e.maxHp;
        const hot = frac <= 0.33 ? 1 : frac <= 0.66 ? 0.6 : 0.3;
        shadow(sx, sy + R * 0.5, R * 0.75, R * 0.22);
        const gc = ctx.createRadialGradient(sx, sy, R * 0.2, sx, sy, R);
        gc.addColorStop(0, "#5a6b8f"); gc.addColorStop(1, "#2e3a55");
        ctx.fillStyle = gc;
        ctx.beginPath();
        for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, rr = R * (0.7 + 0.18 * Math.sin(k * 2 + engine.state.tick / 8)); const px = sx + Math.cos(a) * rr, py = sy + Math.sin(a) * rr * 0.8; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(180,220,255," + (0.5 + 0.5 * hot) + ")"; ctx.lineWidth = Math.max(1.5, cell * 0.05); ctx.lineCap = "round";
        for (let k = 0; k < 3; k++) { const a = engine.state.tick * 0.3 + k * 2.1; ctx.beginPath(); ctx.moveTo(sx, sy); let bx = sx, by = sy; for (let j = 0; j < 3; j++) { bx += Math.cos(a + j) * R * 0.3; by += Math.sin(a + j) * R * 0.3; ctx.lineTo(bx + (j % 2 ? R * 0.12 : -R * 0.12), by); } ctx.stroke(); }
        ctx.fillStyle = "#fff2a0"; ctx.beginPath(); ctx.arc(sx - R * 0.2, sy - R * 0.12, R * 0.12, 0, 7); ctx.arc(sx + R * 0.2, sy - R * 0.12, R * 0.12, 0, 7); ctx.fill();
        ctx.fillStyle = "#22304a"; ctx.beginPath(); ctx.arc(sx - R * 0.2, sy - R * 0.12, R * 0.05, 0, 7); ctx.arc(sx + R * 0.2, sy - R * 0.12, R * 0.05, 0, 7); ctx.fill();
      } else if (e.type === "cushion") {
        // Couch Cushion: a plump square pillow, corner tassels, a sleepy face.
        // Reads SOFT on purpose — it soaks blasts, so it should look like it would.
        shadow(sx, sy + cell * 0.36, r * 0.9, r * 0.26);
        const g = ctx.createLinearGradient(sx - r, sy - r, sx + r, sy + r);
        g.addColorStop(0, "#c98a6a"); g.addColorStop(1, "#9c5f45");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(sx - r * 0.9, sy - r * 0.62);
        ctx.quadraticCurveTo(sx, sy - r * 0.95, sx + r * 0.9, sy - r * 0.62);
        ctx.quadraticCurveTo(sx + r * 1.16, sy, sx + r * 0.9, sy + r * 0.62);
        ctx.quadraticCurveTo(sx, sy + r * 0.95, sx - r * 0.9, sy + r * 0.62);
        ctx.quadraticCurveTo(sx - r * 1.16, sy, sx - r * 0.9, sy - r * 0.62);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,235,215,0.28)";
        ctx.beginPath(); ctx.ellipse(sx - r * 0.3, sy - r * 0.32, r * 0.32, r * 0.16, -0.4, 0, 7); ctx.fill();
        ctx.fillStyle = "#7a4630"; // button dimple in the middle
        ctx.beginPath(); ctx.arc(sx, sy, r * 0.13, 0, 7); ctx.fill();
        ctx.fillStyle = "#22304a";
        ctx.beginPath(); ctx.arc(sx - r * 0.34, sy - r * 0.06, r * 0.09, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.34, sy - r * 0.06, r * 0.09, 0, 7); ctx.fill();
      } else if (e.type === "screw") {
        // Loose Screw: a slotted head that keeps turning — it jams your guns.
        shadow(sx, sy + cell * 0.34, r * 0.6, r * 0.2);
        const g = ctx.createLinearGradient(sx - r * 0.6, sy - r, sx + r * 0.6, sy + r);
        g.addColorStop(0, "#d7dde8"); g.addColorStop(1, "#8b96a8");
        ctx.fillStyle = g;
        ctx.beginPath(); // tapered shank
        ctx.moveTo(sx - r * 0.32, sy - r * 0.2);
        ctx.lineTo(sx + r * 0.32, sy - r * 0.2);
        ctx.lineTo(sx + r * 0.12, sy + r * 1.0);
        ctx.lineTo(sx - r * 0.12, sy + r * 1.0);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(60,72,92,0.55)"; ctx.lineWidth = Math.max(1, cell * 0.022);
        for (let k = 0; k < 3; k++) { const yy = sy + r * (0.05 + k * 0.3); ctx.beginPath(); ctx.moveTo(sx - r * 0.28 + k * r * 0.05, yy); ctx.lineTo(sx + r * 0.28 - k * r * 0.05, yy + r * 0.1); ctx.stroke(); }
        ctx.fillStyle = g; // round head
        ctx.beginPath(); ctx.ellipse(sx, sy - r * 0.42, r * 0.66, r * 0.44, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = "#4d5870"; ctx.lineWidth = Math.max(1.5, cell * 0.045); ctx.lineCap = "round";
        const a = engine.state.tick * 0.16; // the slot spins — it is working loose
        ctx.beginPath();
        ctx.moveTo(sx - Math.cos(a) * r * 0.42, sy - r * 0.42 - Math.sin(a) * r * 0.26);
        ctx.lineTo(sx + Math.cos(a) * r * 0.42, sy - r * 0.42 + Math.sin(a) * r * 0.26);
        ctx.stroke();
        ctx.fillStyle = "#22304a";
        ctx.beginPath(); ctx.arc(sx - r * 0.22, sy - r * 0.5, r * 0.07, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.22, sy - r * 0.5, r * 0.07, 0, 7); ctx.fill();
      } else if (e.type === "slime") {
        // Drip Slime: a wobbling droplet that GROWS while it is slowed.
        shadow(sx, sy + cell * 0.34, r * 0.7, r * 0.22);
        const wob = Math.sin(engine.state.tick / 7) * r * 0.08;
        const g = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, r * 0.1, sx, sy, r * 1.1);
        g.addColorStop(0, "#9df3b8"); g.addColorStop(1, "#2f9c5c");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(sx, sy - r * 1.0 - wob);
        ctx.quadraticCurveTo(sx + r * 0.95, sy + r * 0.1, sx + r * 0.5, sy + r * 0.7);
        ctx.quadraticCurveTo(sx, sy + r * 1.12, sx - r * 0.5, sy + r * 0.7);
        ctx.quadraticCurveTo(sx - r * 0.95, sy + r * 0.1, sx, sy - r * 1.0 - wob);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath(); ctx.ellipse(sx - r * 0.28, sy - r * 0.1, r * 0.16, r * 0.26, -0.4, 0, 7); ctx.fill();
        ctx.fillStyle = "#12432a";
        ctx.beginPath(); ctx.arc(sx - r * 0.24, sy + r * 0.18, r * 0.1, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.24, sy + r * 0.18, r * 0.1, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(sx - r * 0.27, sy + r * 0.14, r * 0.035, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.21, sy + r * 0.14, r * 0.035, 0, 7); ctx.fill();
      } else if (e.type === "tinplane") {
        // Tin Plane: a little riveted tin aeroplane — ARMOURED and it flies, so
        // it reads metal (plates + rivets) rather than soft, and it banks.
        const bank = Math.sin(engine.state.tick / 9 + e.id) * 0.16;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(bank);
        const g = ctx.createLinearGradient(0, -r, 0, r);
        g.addColorStop(0, "#d7dfeb"); g.addColorStop(1, "#8b97ab");
        ctx.fillStyle = g; // wings
        ctx.beginPath();
        ctx.moveTo(-r * 1.15, r * 0.06); ctx.lineTo(-r * 0.2, -r * 0.2);
        ctx.lineTo(r * 0.2, -r * 0.2); ctx.lineTo(r * 1.15, r * 0.06);
        ctx.lineTo(r * 0.2, r * 0.3); ctx.lineTo(-r * 0.2, r * 0.3);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#aab6c8"; // fuselage
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.34, r * 0.9, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#6f7c92"; // tail fin
        ctx.beginPath(); ctx.moveTo(0, r * 0.62); ctx.lineTo(-r * 0.42, r * 1.02); ctx.lineTo(r * 0.42, r * 1.02); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#5e6a7e"; // rivets down the plates
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.arc(0, k * r * 0.3, r * 0.055, 0, 7); ctx.fill(); }
        ctx.fillStyle = "#7fe3ff"; // canopy
        ctx.beginPath(); ctx.ellipse(0, -r * 0.42, r * 0.2, r * 0.28, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = Math.max(1.5, cell * 0.05); // prop blur
        ctx.beginPath(); ctx.ellipse(0, -r * 0.95, r * 0.5, r * 0.1, 0, 0, 7); ctx.stroke();
        ctx.restore();
      } else if (e.type === "tickmaster") {
        // The Tickmaster (World-4 boss): a battered wind-up alarm clock. Its HANDS
        // spin faster as it escalates, so the hp-gated phases are readable on the
        // enemy itself, not only in the banner.
        const R = r * bossScale(e, 1.8), frac = e.hp / (e.maxHp || 1);
        const rage = frac <= 0.33 ? 3.2 : frac <= 0.66 ? 1.8 : 1;
        shadow(sx, sy + R * 0.55, R * 0.72, R * 0.2);
        ctx.fillStyle = "#8d99ad"; // bells
        ctx.beginPath(); ctx.arc(sx - R * 0.66, sy - R * 0.66, R * 0.26, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + R * 0.66, sy - R * 0.66, R * 0.26, 0, 7); ctx.fill();
        ctx.strokeStyle = "#6d788c"; ctx.lineWidth = Math.max(2, cell * 0.07); // feet
        ctx.beginPath(); ctx.moveTo(sx - R * 0.4, sy + R * 0.78); ctx.lineTo(sx - R * 0.6, sy + R * 1.0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx + R * 0.4, sy + R * 0.78); ctx.lineTo(sx + R * 0.6, sy + R * 1.0); ctx.stroke();
        const gk = ctx.createRadialGradient(sx - R * 0.25, sy - R * 0.25, R * 0.15, sx, sy, R);
        gk.addColorStop(0, "#e3e9f4"); gk.addColorStop(1, "#96a2b6");
        ctx.fillStyle = gk; ctx.beginPath(); ctx.arc(sx, sy, R * 0.86, 0, 7); ctx.fill();
        ctx.strokeStyle = "#59647a"; ctx.lineWidth = Math.max(2, cell * 0.08); ctx.stroke();
        ctx.fillStyle = "#fdf6e6"; ctx.beginPath(); ctx.arc(sx, sy, R * 0.68, 0, 7); ctx.fill();
        ctx.fillStyle = "#59647a"; // hour ticks
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          ctx.beginPath(); ctx.arc(sx + Math.cos(a) * R * 0.56, sy + Math.sin(a) * R * 0.56, R * 0.045, 0, 7); ctx.fill();
        }
        const spin = engine.state.tick * 0.05 * rage;
        ctx.strokeStyle = "#22304a"; ctx.lineCap = "round";
        ctx.lineWidth = Math.max(2, cell * 0.09);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(spin - 1.57) * R * 0.34, sy + Math.sin(spin - 1.57) * R * 0.34); ctx.stroke();
        ctx.lineWidth = Math.max(1.5, cell * 0.06);
        ctx.strokeStyle = frac <= 0.33 ? "#ff6f6f" : "#22304a";
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(spin * 6 - 1.57) * R * 0.54, sy + Math.sin(spin * 6 - 1.57) * R * 0.54); ctx.stroke();
        ctx.fillStyle = "#ffd94a"; ctx.beginPath(); ctx.arc(sx, sy, R * 0.09, 0, 7); ctx.fill();
        ctx.fillStyle = "#22304a"; // eyes on the rim, above the dial
        ctx.beginPath(); ctx.arc(sx - R * 0.26, sy - R * 0.4, R * 0.09, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + R * 0.26, sy - R * 0.4, R * 0.09, 0, 7); ctx.fill();
        ctx.fillStyle = "#ffd94a"; // crown — it is a boss
        ctx.beginPath();
        ctx.moveTo(sx - R * 0.4, sy - R * 0.9); ctx.lineTo(sx - R * 0.4, sy - R * 1.16);
        ctx.lineTo(sx - R * 0.2, sy - R * 1.0); ctx.lineTo(sx, sy - R * 1.22);
        ctx.lineTo(sx + R * 0.2, sy - R * 1.0); ctx.lineTo(sx + R * 0.4, sy - R * 1.16);
        ctx.lineTo(sx + R * 0.4, sy - R * 0.9); ctx.closePath(); ctx.fill();
      } else if (e.type === "bubblewrap") {
        // Bubble Wrap: a fat roll of wrap, its bubbles visibly intact. Single
        // hits pop one at a time, so the picture has to look like MANY small
        // cushions rather than one body — that IS the mechanic.
        shadow(sx, sy + r * 0.55, r * 0.72, r * 0.2);
        const gw = ctx.createLinearGradient(sx - r * 0.6, 0, sx + r * 0.6, 0);
        gw.addColorStop(0, "#9fd8e8"); gw.addColorStop(0.45, "#e6f7ff"); gw.addColorStop(1, "#84bccd");
        ctx.fillStyle = gw;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(sx - r * 0.62, sy - r * 0.5, r * 1.24, r * 1.0, r * 0.26)
                                       : ctx.rect(sx - r * 0.62, sy - r * 0.5, r * 1.24, r * 1.0);
        ctx.fill();
        ctx.strokeStyle = "rgba(90,150,170,0.8)"; ctx.lineWidth = Math.max(1.5, cell * 0.045); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.75)";                 // the bubbles
        for (let ry = -1; ry <= 1; ry++) for (let rx = -1; rx <= 1; rx++) {
          ctx.beginPath(); ctx.arc(sx + rx * r * 0.34, sy + ry * r * 0.3, r * 0.11, 0, 7); ctx.fill();
        }
        ctx.fillStyle = "#2a3140";
        ctx.beginPath(); ctx.arc(sx - r * 0.2, sy + r * 0.62, r * 0.07, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.2, sy + r * 0.62, r * 0.07, 0, 7); ctx.fill();
      } else if (e.type === "boombox") {
        // Boom Box: a chunky stereo with two speakers and sound rings pulsing
        // out of it — the rings are the tell, because the threat is the AURA,
        // not the body. They pulse off state.tick, so they freeze when paused.
        shadow(sx, sy + r * 0.5, r * 0.7, r * 0.18);
        const ph = (engine.state.tick * 0.06) % 1;
        ctx.strokeStyle = "rgba(255,180,90," + (0.45 * (1 - ph)).toFixed(3) + ")";
        ctx.lineWidth = Math.max(1.5, cell * 0.05);
        ctx.beginPath(); ctx.arc(sx, sy, r * (0.7 + ph * 0.7), 0, 7); ctx.stroke();
        ctx.fillStyle = "#3b4453";
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(sx - r * 0.66, sy - r * 0.36, r * 1.32, r * 0.78, r * 0.12)
                                       : ctx.rect(sx - r * 0.66, sy - r * 0.36, r * 1.32, r * 0.78);
        ctx.fill();
        ctx.strokeStyle = "#20262f"; ctx.lineWidth = Math.max(1.5, cell * 0.04); ctx.stroke();
        ctx.strokeStyle = "#8d99ad"; ctx.lineWidth = Math.max(2, cell * 0.05);   // handle
        ctx.beginPath(); ctx.arc(sx, sy - r * 0.36, r * 0.36, Math.PI, 0); ctx.stroke();
        for (const dx of [-0.34, 0.34]) {                                        // speakers
          ctx.fillStyle = "#1b2029";
          ctx.beginPath(); ctx.arc(sx + r * dx, sy + r * 0.04, r * 0.22, 0, 7); ctx.fill();
          ctx.fillStyle = "#5a677d";
          ctx.beginPath(); ctx.arc(sx + r * dx, sy + r * 0.04, r * 0.09, 0, 7); ctx.fill();
        }
        ctx.fillStyle = "#ffd35c";                                               // the dial
        ctx.fillRect(sx - r * 0.1, sy - r * 0.24, r * 0.2, r * 0.08);
      } else if (e.type === "movingvan") {
        // The Moving Van (World-6 boss): a box truck with its roller door up,
        // stacked with boxes it keeps unloading. The door RISES as its hp-gated
        // phases escalate, so the phase reads on the boss itself — the
        // Tickmaster's spinning hands and the Titan's gaping lid, again.
        const R = r * bossScale(e, 1.8), frac = e.hp / (e.maxHp || 1);
        const open = frac <= 0.33 ? 0.66 : frac <= 0.66 ? 0.4 : 0.16;
        shadow(sx, sy + R * 0.66, R * 0.9, R * 0.2);
        ctx.fillStyle = "#2a3140";                                               // wheels
        for (const dx of [-0.52, 0.42]) { ctx.beginPath(); ctx.arc(sx + R * dx, sy + R * 0.58, R * 0.17, 0, 7); ctx.fill(); }
        const gv = ctx.createLinearGradient(sx, sy - R * 0.5, sx, sy + R * 0.5);
        gv.addColorStop(0, "#eef2f8"); gv.addColorStop(1, "#b9c3d2");
        ctx.fillStyle = gv;                                                      // the box body
        ctx.beginPath();
        ctx.moveTo(sx - R * 0.78, sy - R * 0.46); ctx.lineTo(sx + R * 0.34, sy - R * 0.46);
        ctx.lineTo(sx + R * 0.34, sy + R * 0.5); ctx.lineTo(sx - R * 0.78, sy + R * 0.5);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#6b7688"; ctx.lineWidth = Math.max(2, cell * 0.06); ctx.stroke();
        ctx.fillStyle = "#8d99ad";                                               // cab
        ctx.beginPath();
        ctx.moveTo(sx + R * 0.34, sy - R * 0.1); ctx.lineTo(sx + R * 0.62, sy - R * 0.1);
        ctx.lineTo(sx + R * 0.78, sy + R * 0.18); ctx.lineTo(sx + R * 0.78, sy + R * 0.5);
        ctx.lineTo(sx + R * 0.34, sy + R * 0.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#cfe3f5";
        ctx.fillRect(sx + R * 0.42, sy + R * 0.02, R * 0.26, R * 0.2);           // windscreen
        ctx.fillStyle = "#4a5462";                                               // the dark hold
        ctx.fillRect(sx - R * 0.7, sy - R * 0.38, R * 0.96, R * 0.8);
        ctx.fillStyle = "#c08a48";                                               // boxes inside
        for (const [bx, by] of [[-0.5, 0.18], [-0.16, 0.18], [-0.34, -0.12]]) {
          ctx.fillRect(sx + R * bx, sy + R * by, R * 0.28, R * 0.24);
          ctx.strokeStyle = "#8a5f2c"; ctx.lineWidth = Math.max(1, cell * 0.03);
          ctx.strokeRect(sx + R * bx, sy + R * by, R * 0.28, R * 0.24);
        }
        ctx.fillStyle = "#dfe6f0";                                               // the roller door, riding up
        ctx.fillRect(sx - R * 0.72, sy - R * 0.42, R * 1.0, R * 0.84 * (1 - open));
        ctx.strokeStyle = "#98a3b4"; ctx.lineWidth = Math.max(1, cell * 0.025);
        for (let k = 1; k < 5; k++) {
          const yy = sy - R * 0.42 + (R * 0.84 * (1 - open)) * (k / 5);
          ctx.beginPath(); ctx.moveTo(sx - R * 0.72, yy); ctx.lineTo(sx + R * 0.28, yy); ctx.stroke();
        }
        ctx.fillStyle = "#ffd94a";                                               // crown — it is a boss
        ctx.beginPath();
        ctx.moveTo(sx - R * 0.34, sy - R * 0.86); ctx.lineTo(sx - R * 0.34, sy - R * 1.1);
        ctx.lineTo(sx - R * 0.17, sy - R * 0.96); ctx.lineTo(sx, sy - R * 1.16);
        ctx.lineTo(sx + R * 0.17, sy - R * 0.96); ctx.lineTo(sx + R * 0.34, sy - R * 1.1);
        ctx.lineTo(sx + R * 0.34, sy - R * 0.86); ctx.closePath(); ctx.fill();
      } else if (e.type === "racer") {
        // Grease Racer: a skateboard with a grease-slick trail. Low, wide and
        // leaning forward — it should READ as fast, because "slows do nothing"
        // is only fair if you can see which one is the runner.
        shadow(sx, sy + r * 0.5, r * 0.9, r * 0.22);
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(-0.12);
        ctx.strokeStyle = "rgba(120,200,255,0.5)"; ctx.lineWidth = Math.max(1.5, cell * 0.05); // speed lines
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath(); ctx.moveTo(-r * 1.5, k * r * 0.34); ctx.lineTo(-r * 0.85, k * r * 0.34); ctx.stroke();
        }
        ctx.fillStyle = "#39424f"; // wheels
        ctx.beginPath(); ctx.arc(-r * 0.5, r * 0.42, r * 0.2, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.5, r * 0.42, r * 0.2, 0, 7); ctx.fill();
        const gd = ctx.createLinearGradient(0, -r * 0.4, 0, r * 0.2);
        gd.addColorStop(0, "#ff9f45"); gd.addColorStop(1, "#c2661d");
        ctx.fillStyle = gd; // deck
        ctx.beginPath();
        ctx.moveTo(-r * 0.95, r * 0.02); ctx.quadraticCurveTo(-r * 1.12, -r * 0.36, -r * 0.62, -r * 0.3);
        ctx.lineTo(r * 0.62, -r * 0.3); ctx.quadraticCurveTo(r * 1.12, -r * 0.36, r * 0.95, r * 0.02);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#2a3140"; // grip tape
        ctx.fillRect(-r * 0.58, -r * 0.3, r * 1.16, r * 0.1);
        ctx.fillStyle = "#ffe9a8"; // a determined little face on the nose
        ctx.beginPath(); ctx.arc(r * 0.72, -r * 0.52, r * 0.3, 0, 7); ctx.fill();
        ctx.fillStyle = "#2a3140";
        ctx.beginPath(); ctx.arc(r * 0.8, -r * 0.58, r * 0.07, 0, 7); ctx.fill();
        ctx.restore();
      } else if (e.type === "bucket") {
        // Bolt Bucket: a galvanised pail brimming with bolts, one spilling over
        // the rim — the drip is the whole mechanic, so it shows on the sprite.
        shadow(sx, sy + r * 0.6, r * 0.7, r * 0.2);
        const gb = ctx.createLinearGradient(sx - r * 0.6, 0, sx + r * 0.6, 0);
        gb.addColorStop(0, "#9aa7b8"); gb.addColorStop(0.45, "#dfe6f0"); gb.addColorStop(1, "#7f8b9c");
        ctx.fillStyle = gb;
        ctx.beginPath();
        ctx.moveTo(sx - r * 0.62, sy - r * 0.42); ctx.lineTo(sx + r * 0.62, sy - r * 0.42);
        ctx.lineTo(sx + r * 0.44, sy + r * 0.62); ctx.lineTo(sx - r * 0.44, sy + r * 0.62);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#5c6779"; ctx.lineWidth = Math.max(1.5, cell * 0.05); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx - r * 0.55, sy + r * 0.12); ctx.lineTo(sx + r * 0.55, sy + r * 0.12); ctx.stroke(); // rib
        ctx.strokeStyle = "#6d788c"; ctx.lineWidth = Math.max(2, cell * 0.06); // handle
        ctx.beginPath(); ctx.arc(sx, sy - r * 0.44, r * 0.6, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = "#b9762f"; // bolts heaped above the rim
        for (const [bx, by] of [[-0.34, -0.56], [0, -0.66], [0.34, -0.54], [-0.14, -0.44], [0.18, -0.42]]) {
          ctx.beginPath(); ctx.arc(sx + r * bx, sy + r * by, r * 0.15, 0, 7); ctx.fill();
        }
        ctx.fillStyle = "#8f5620"; // one spilling out of the side
        ctx.beginPath(); ctx.arc(sx + r * 0.74, sy + r * 0.3, r * 0.14, 0, 7); ctx.fill();
        ctx.fillStyle = "#2a3140";
        ctx.beginPath(); ctx.arc(sx - r * 0.18, sy + r * 0.3, r * 0.07, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.18, sy + r * 0.3, r * 0.07, 0, 7); ctx.fill();
      } else if (e.type === "titan") {
        // The Toolbox Titan (World-5 boss): a red steel toolbox stomping on two
        // stubby legs, its tray-lid cracked open. The lid gapes wider as its
        // hp-gated phases escalate, so the phase reads on the boss itself — the
        // Tickmaster's spinning hands, applied to a different silhouette.
        const R = r * bossScale(e, 1.8), frac = e.hp / (e.maxHp || 1);
        const gape = frac <= 0.33 ? 0.62 : frac <= 0.66 ? 0.34 : 0.12;
        shadow(sx, sy + R * 0.62, R * 0.8, R * 0.2);
        ctx.strokeStyle = "#4a5462"; ctx.lineWidth = Math.max(2, cell * 0.09); // legs
        ctx.beginPath(); ctx.moveTo(sx - R * 0.42, sy + R * 0.5); ctx.lineTo(sx - R * 0.5, sy + R * 0.92); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx + R * 0.42, sy + R * 0.5); ctx.lineTo(sx + R * 0.5, sy + R * 0.92); ctx.stroke();
        ctx.save(); // the cracked-open lid, hinged at the back
        ctx.translate(sx - R * 0.72, sy - R * 0.34); ctx.rotate(-gape);
        ctx.fillStyle = "#8e2f2a";
        ctx.fillRect(0, -R * 0.2, R * 1.44, R * 0.22);
        ctx.strokeStyle = "#5d1c19"; ctx.lineWidth = Math.max(1.5, cell * 0.05);
        ctx.strokeRect(0, -R * 0.2, R * 1.44, R * 0.22);
        ctx.restore();
        const gt = ctx.createLinearGradient(sx, sy - R * 0.4, sx, sy + R * 0.5);
        gt.addColorStop(0, "#d6453c"); gt.addColorStop(1, "#8e2f2a");
        ctx.fillStyle = gt; // body
        ctx.beginPath();
        ctx.moveTo(sx - R * 0.72, sy - R * 0.3); ctx.lineTo(sx + R * 0.72, sy - R * 0.3);
        ctx.lineTo(sx + R * 0.62, sy + R * 0.52); ctx.lineTo(sx - R * 0.62, sy + R * 0.52);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#5d1c19"; ctx.lineWidth = Math.max(2, cell * 0.07); ctx.stroke();
        ctx.fillStyle = "#c8cfdb"; // latch + drawer pull
        ctx.fillRect(sx - R * 0.1, sy - R * 0.08, R * 0.2, R * 0.16);
        ctx.fillRect(sx - R * 0.4, sy + R * 0.24, R * 0.8, R * 0.08);
        ctx.strokeStyle = "#c8cfdb"; ctx.lineWidth = Math.max(2, cell * 0.06); // carry handle
        ctx.beginPath(); ctx.arc(sx, sy - R * 0.46, R * 0.34, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = frac <= 0.33 ? "#ffd0d0" : "#ffe9a8"; // eyes, glaring when enraged
        ctx.beginPath(); ctx.arc(sx - R * 0.26, sy + R * 0.06, R * 0.11, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + R * 0.26, sy + R * 0.06, R * 0.11, 0, 7); ctx.fill();
        ctx.fillStyle = "#ffd94a"; // crown — it is a boss
        ctx.beginPath();
        ctx.moveTo(sx - R * 0.34, sy - R * 0.78); ctx.lineTo(sx - R * 0.34, sy - R * 1.02);
        ctx.lineTo(sx - R * 0.17, sy - R * 0.88); ctx.lineTo(sx, sy - R * 1.08);
        ctx.lineTo(sx + R * 0.17, sy - R * 0.88); ctx.lineTo(sx + R * 0.34, sy - R * 1.02);
        ctx.lineTo(sx + R * 0.34, sy - R * 0.78); ctx.closePath(); ctx.fill();
      } else {
        // Sock Goblin: a cream sock with a folded cuff, a toe, and a cheeky face
        shadow(sx, sy + cell * 0.34, r * 0.72, r * 0.24);
        ctx.save();
        ctx.translate(sx, sy); ctx.rotate(-0.18);
        // leg + foot as one rounded silhouette
        ctx.fillStyle = "#eef1f8";
        ctx.beginPath();
        ctx.moveTo(-r * 0.42, -r * 0.7);
        ctx.lineTo(r * 0.36, -r * 0.7);
        ctx.quadraticCurveTo(r * 0.52, -r * 0.7, r * 0.52, -r * 0.2);
        ctx.lineTo(r * 0.52, r * 0.2);
        ctx.quadraticCurveTo(r * 0.52, r * 0.5, r * 0.9, r * 0.52); // heel/toe kick
        ctx.quadraticCurveTo(r * 1.12, r * 0.56, r * 1.12, r * 0.9);
        ctx.quadraticCurveTo(r * 1.12, r * 1.16, r * 0.72, r * 1.16);
        ctx.lineTo(-r * 0.42, r * 1.16);
        ctx.quadraticCurveTo(-r * 0.64, r * 1.16, -r * 0.64, r * 0.7);
        ctx.lineTo(-r * 0.64, -r * 0.4);
        ctx.quadraticCurveTo(-r * 0.64, -r * 0.7, -r * 0.42, -r * 0.7);
        ctx.closePath(); ctx.fill();
        // soft shade on the underside
        ctx.fillStyle = "rgba(160,175,205,0.4)";
        ctx.beginPath(); ctx.ellipse(r * 0.55, r * 0.95, r * 0.5, r * 0.22, 0, 0, 7); ctx.fill();
        // folded cuff (colored band)
        ctx.fillStyle = "#e2626b";
        ctx.beginPath(); ctx.rect(-r * 0.64, -r * 0.7, r * 1.16, r * 0.34); ctx.fill();
        ctx.fillStyle = "#c94a54";
        ctx.beginPath(); ctx.rect(-r * 0.64, -r * 0.44, r * 1.16, r * 0.08); ctx.fill();
        ctx.restore();
        // face (upright, not rotated with the sock)
        ctx.fillStyle = "#22304a";
        ctx.beginPath(); ctx.arc(sx - r * 0.16, sy + r * 0.02, r * 0.1, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.14, sy + r * 0.02, r * 0.1, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(sx - r * 0.19, sy - r * 0.01, r * 0.035, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + r * 0.11, sy - r * 0.01, r * 0.035, 0, 7); ctx.fill();
        ctx.strokeStyle = "#22304a"; ctx.lineWidth = Math.max(1, cell * 0.03); ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(sx - r * 0.01, sy + r * 0.2, r * 0.14, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      }
    }

    // ---------- towers (upright, screen space) ----------
    // Every LINE reads at a glance, and so does every TIER: a tier-2 gun must be
    // visibly a different object from the tier-1 it replaced, not the same
    // sprite with an extra dot. Each line grows along its own axis (barrels /
    // tube length + iron / blades + cage / camp size), gains a plinth at T2 and
    // an armour skirt at T3, and each of the six tier-4 BRANCHES is its own
    // silhouette so the endgame board reads as a fort of unique machines.
    function towerPlinth(x, y, u, tier) {
      if (tier < 2) return;
      ctx.fillStyle = tier >= 4 ? "#4a3f14" : "#26334f";
      ctx.beginPath(); ctx.ellipse(x, y + u * 0.3, u * (tier >= 3 ? 0.44 : 0.38), u * (tier >= 3 ? 0.17 : 0.14), 0, 0, 7); ctx.fill();
      ctx.strokeStyle = tier >= 4 ? "#ffd94a" : "#4a628f"; ctx.lineWidth = Math.max(1, u * 0.035); ctx.stroke();
      if (tier >= 3) { // bolt heads around the skirt
        ctx.fillStyle = tier >= 4 ? "#ffe9a3" : "#8fa6d0";
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * u * 0.4, y + u * 0.3 + Math.sin(a) * u * 0.14, u * 0.028, 0, 7); ctx.fill();
        }
      }
    }
    function drawTower(t) {
      const p = worldToScreen(t.cx + 0.5, t.cy + 0.5);
      const x = p.x, y = p.y, u = cell;
      const tier = t.tier, br = tier >= 4 ? t.branch : "";
      // ⚡ Overclock reads on the TOWER's own ring — hot while boosted, cold
      // while it is paying the crash back. Deliberately not a full-field tint:
      // stacking translucent overlays is a defect this project already shipped
      // once (a burst of leak flashes piled into an opaque red wall).
      const tick = engine.state.tick;
      if (t.boostUntil && tick < t.boostUntil) {
        const g = 0.35 + 0.2 * Math.sin(tick / 3 + t.id);
        ctx.strokeStyle = "rgba(255,214,80," + g.toFixed(2) + ")"; ctx.lineWidth = Math.max(2, u * 0.07);
        ctx.beginPath(); ctx.arc(x, y, u * 0.46, 0, 7); ctx.stroke();
      } else if (t.crashUntil && tick < t.crashUntil) {
        ctx.strokeStyle = "rgba(120,150,190,0.5)"; ctx.lineWidth = Math.max(2, u * 0.05);
        ctx.beginPath(); ctx.arc(x, y, u * 0.44, 0, 7); ctx.stroke();
        // a small drooping arc so "resting" reads even in a still frame
        ctx.strokeStyle = "rgba(150,175,205,0.75)"; ctx.lineWidth = Math.max(1, u * 0.045);
        ctx.beginPath(); ctx.arc(x, y - u * 0.02, u * 0.28, 0.5, Math.PI - 0.5); ctx.stroke();
      }
      shadow(x, y + u * 0.36, u * 0.4, u * 0.16);
      towerPlinth(x, y, u, tier);
      if (t.lineId === "dart") {
        // Pea Shooter → Double Dart → Triple Threat → Sniper Scope / Minigun.
        // Growth axis: barrel COUNT, then a scope, then the branch silhouette.
        const domeR = br === "a" ? 0.3 : br === "b" ? 0.33 : 0.25 + tier * 0.026;
        if (br === "a") {
          // Sniper: ONE long heavy barrel, bipod legs, a big scope on top.
          ctx.strokeStyle = "#14452c"; ctx.lineWidth = Math.max(2, u * 0.07); ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(x - u * 0.16, y + u * 0.1); ctx.lineTo(x - u * 0.3, y + u * 0.3); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + u * 0.16, y + u * 0.1); ctx.lineTo(x + u * 0.3, y + u * 0.3); ctx.stroke();
          ctx.strokeStyle = "#123c26"; ctx.lineWidth = Math.max(4, u * 0.17);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - u * 0.72); ctx.stroke();
          ctx.strokeStyle = "#2f7d3f"; ctx.lineWidth = Math.max(2, u * 0.09);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - u * 0.7); ctx.stroke();
          ctx.fillStyle = "#ffd94a"; // muzzle brake
          ctx.beginPath(); ctx.rect(x - u * 0.11, y - u * 0.78, u * 0.22, u * 0.1); ctx.fill();
        } else if (br === "b") {
          // Minigun: a spinning 5-barrel cluster + an ammo drum.
          const spin = engine.state.tick * 0.35 + t.id;
          ctx.fillStyle = "#1c5c3a";
          ctx.beginPath(); ctx.ellipse(x + u * 0.3, y + u * 0.06, u * 0.16, u * 0.2, 0, 0, 7); ctx.fill();
          ctx.strokeStyle = "#123c26"; ctx.lineWidth = Math.max(2, u * 0.08); ctx.lineCap = "round";
          for (let i = 0; i < 5; i++) {
            const off = Math.cos(spin + (i * Math.PI * 2) / 5) * u * 0.13;
            ctx.beginPath(); ctx.moveTo(x + off, y - u * 0.1); ctx.lineTo(x + off, y - u * 0.56); ctx.stroke();
          }
          ctx.fillStyle = "#ffd94a";
          ctx.beginPath(); ctx.arc(x, y - u * 0.58, u * 0.09, 0, 7); ctx.fill();
        } else {
          const barrels = tier;
          ctx.strokeStyle = "#1c5c3a"; ctx.lineWidth = Math.max(3, u * (0.1 + tier * 0.015)); ctx.lineCap = "round";
          const reach = 0.4 + tier * 0.045;
          for (let i = 0; i < barrels; i++) {
            const a = -Math.PI / 2 + (i - (barrels - 1) / 2) * 0.42;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * u * reach, y + Math.sin(a) * u * reach); ctx.stroke();
          }
          ctx.fillStyle = tier >= 3 ? "#ffd94a" : "#2f7d3f";
          for (let i = 0; i < barrels; i++) {
            const a = -Math.PI / 2 + (i - (barrels - 1) / 2) * 0.42;
            ctx.beginPath(); ctx.arc(x + Math.cos(a) * u * reach, y + Math.sin(a) * u * reach, u * 0.07, 0, 7); ctx.fill();
          }
        }
        const gd = ctx.createRadialGradient(x - u * 0.12, y - u * 0.12, u * 0.05, x, y, u * 0.32);
        gd.addColorStop(0, br ? "#8ff0b4" : "#63d38f"); gd.addColorStop(1, br ? "#1f8f52" : "#2fa562");
        ctx.fillStyle = gd; ctx.beginPath(); ctx.arc(x, y, u * domeR, 0, 7); ctx.fill();
        ctx.strokeStyle = "#1c5c3a"; ctx.lineWidth = Math.max(1.5, u * 0.05); ctx.stroke();
        if (tier >= 3) { // armour collar bolted round the dome
          ctx.strokeStyle = "#8fa6d0"; ctx.lineWidth = Math.max(1.5, u * 0.045);
          ctx.beginPath(); ctx.arc(x, y, u * (domeR + 0.06), 0.15, Math.PI - 0.15); ctx.stroke();
        }
        if (tier >= 3 || br) { // scope
          ctx.fillStyle = "#12203a";
          ctx.beginPath(); ctx.rect(x - u * (br === "a" ? 0.2 : 0.14), y - u * 0.34, u * (br === "a" ? 0.4 : 0.28), u * 0.12); ctx.fill();
          ctx.fillStyle = "#7fe3ff";
          ctx.beginPath(); ctx.arc(x + u * (br === "a" ? 0.16 : 0.11), y - u * 0.28, u * 0.045, 0, 7); ctx.fill();
        }
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath(); ctx.arc(x - u * 0.1, y - u * 0.1, u * 0.07, 0, 7); ctx.fill();
      } else if (t.lineId === "mortar") {
        // Block Lobber → Brick Cannon → Crate Cannon → Big Bertha / Sticky Bomb.
        // Growth axis: tube LENGTH + calibre, iron bands, then the branch.
        const len = br ? 0.62 : 0.3 + tier * 0.06;
        const bore = br === "a" ? 0.3 : br === "b" ? 0.26 : 0.14 + tier * 0.03;
        const ang = -Math.PI / 3; // up-right
        const mx = x + Math.cos(ang) * u * len, my = y + Math.sin(ang) * u * len;
        ctx.strokeStyle = br === "b" ? "#7a5a12" : "#4a3118";
        ctx.lineWidth = Math.max(4, u * (bore + 0.06)); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x - u * 0.06, y + u * 0.06); ctx.lineTo(mx, my); ctx.stroke();
        ctx.strokeStyle = br === "b" ? "#d69a2a" : br === "a" ? "#8c7a5e" : "#5f4022";
        ctx.lineWidth = Math.max(2, u * bore);
        ctx.beginPath(); ctx.moveTo(x - u * 0.06, y + u * 0.06); ctx.lineTo(mx, my); ctx.stroke();
        if (tier >= 2) { // iron bands along the tube
          ctx.strokeStyle = "#9aa6bd"; ctx.lineWidth = Math.max(1.5, u * 0.045);
          for (let i = 1; i <= (tier >= 3 ? 3 : 2); i++) {
            const f = i / ((tier >= 3 ? 3 : 2) + 1);
            const bx = x - u * 0.06 + (mx - (x - u * 0.06)) * f, by = y + u * 0.06 + (my - (y + u * 0.06)) * f;
            ctx.beginPath(); ctx.arc(bx, by, u * (bore * 0.6 + 0.03), 0, 7); ctx.stroke();
          }
        }
        ctx.fillStyle = "#2b1c0e";
        ctx.beginPath(); ctx.arc(mx, my, u * (bore * 0.7 + 0.04), 0, 7); ctx.fill();
        if (br === "a") { // Bertha: a vented muzzle brake + gold trim
          ctx.strokeStyle = "#ffd94a"; ctx.lineWidth = Math.max(2, u * 0.06);
          ctx.beginPath(); ctx.arc(mx, my, u * 0.22, 0, 7); ctx.stroke();
          ctx.strokeStyle = "#12203a"; ctx.lineWidth = Math.max(1.5, u * 0.05);
          for (let k = -1; k <= 1; k += 2) {
            ctx.beginPath(); ctx.moveTo(mx + k * u * 0.16, my - u * 0.1); ctx.lineTo(mx + k * u * 0.24, my - u * 0.02); ctx.stroke();
          }
        }
        if (br === "b") { // Sticky: honey drips off the muzzle
          ctx.fillStyle = "#ffcf4d";
          for (let k = 0; k < 3; k++) {
            const dy = ((engine.state.tick * 0.6 + k * 9) % 18) / 18;
            ctx.beginPath(); ctx.ellipse(mx - u * 0.05 + k * u * 0.06, my + u * (0.1 + dy * 0.3), u * 0.045, u * 0.06, 0, 0, 7); ctx.fill();
          }
        }
        const gm = ctx.createRadialGradient(x - u * 0.12, y - u * 0.1, u * 0.06, x, y, u * 0.34);
        if (br === "b") { gm.addColorStop(0, "#ffd76a"); gm.addColorStop(1, "#b8801c"); }
        else { gm.addColorStop(0, br === "a" ? "#c9c1b0" : "#b07c48"); gm.addColorStop(1, br === "a" ? "#6d6455" : "#7a5230"); }
        ctx.fillStyle = gm; ctx.beginPath(); ctx.arc(x, y, u * (0.28 + tier * 0.014), 0, 7); ctx.fill();
        ctx.strokeStyle = "#4a3118"; ctx.lineWidth = Math.max(1.5, u * 0.05); ctx.stroke();
        if (tier >= 3) { // ammo crate beside the breech
          ctx.fillStyle = "#8a5f32";
          ctx.beginPath(); ctx.rect(x - u * 0.42, y + u * 0.06, u * 0.2, u * 0.18); ctx.fill();
          ctx.strokeStyle = "#5f4022"; ctx.lineWidth = Math.max(1, u * 0.03); ctx.stroke();
        }
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath(); ctx.arc(x - u * 0.1, y - u * 0.08, u * 0.07, 0, 7); ctx.fill();
      } else if (t.lineId === "fan") {
        // Cool Breeze → Chill Wind → Freezer Blast → Blizzard Cone / Static Zap.
        // Growth axis: blade COUNT + a guard cage, then the branch.
        const gf = ctx.createRadialGradient(x, y, u * 0.05, x, y, u * 0.34);
        gf.addColorStop(0, br === "b" ? "#8c6ad6" : "#2a8fb0"); gf.addColorStop(1, br === "b" ? "#5b3fa0" : "#1f6e8c");
        ctx.fillStyle = gf; ctx.beginPath(); ctx.arc(x, y, u * (0.26 + tier * 0.014), 0, 7); ctx.fill();
        if (br === "b") {
          // Static Zap: a tesla coil — copper windings and live arcs, no blades.
          ctx.strokeStyle = "#d98b4a"; ctx.lineWidth = Math.max(1.5, u * 0.05);
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x, y - u * (0.12 + i * 0.1), u * (0.2 - i * 0.03), u * 0.05, 0, 0, 7); ctx.stroke(); }
          ctx.fillStyle = "#e9dcff"; ctx.beginPath(); ctx.arc(x, y - u * 0.52, u * 0.11, 0, 7); ctx.fill();
          ctx.strokeStyle = "rgba(200,170,255,0.95)"; ctx.lineWidth = Math.max(1, u * 0.035); ctx.lineCap = "round";
          for (let k = 0; k < 3; k++) {
            const a = engine.state.tick * 0.5 + k * 2.1;
            ctx.beginPath(); ctx.moveTo(x, y - u * 0.52);
            ctx.lineTo(x + Math.cos(a) * u * 0.2, y - u * 0.52 + Math.sin(a) * u * 0.2);
            ctx.stroke();
          }
        } else {
          const blades = br === "a" ? 6 : 2 + tier;
          const spin = engine.state.tick * (br ? 0.24 : 0.14) + t.id;
          const reach = br === "a" ? 0.42 : 0.3 + tier * 0.014;
          for (let i = 0; i < blades; i++) {
            const a = spin + (i * Math.PI * 2) / blades;
            ctx.save(); ctx.translate(x, y); ctx.rotate(a);
            const gb = ctx.createLinearGradient(0, 0, u * reach, 0);
            gb.addColorStop(0, "rgba(232,247,255,0.95)"); gb.addColorStop(1, "rgba(126,220,255,0.35)");
            ctx.fillStyle = gb;
            ctx.beginPath(); ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(u * reach * 0.82, -u * 0.14, u * (reach + 0.04), u * 0.02);
            ctx.quadraticCurveTo(u * reach * 0.76, u * 0.08, 0, 0); ctx.fill();
            ctx.restore();
          }
          if (tier >= 2) { // guard cage
            ctx.strokeStyle = "rgba(180,225,245,0.7)"; ctx.lineWidth = Math.max(1, u * 0.03);
            ctx.beginPath(); ctx.arc(x, y, u * (reach + 0.06), 0, 7); ctx.stroke();
          }
          if (tier >= 3) { // frost crystals at the compass points
            ctx.fillStyle = "#dff4ff";
            for (let i = 0; i < 4; i++) {
              const a = (i / 4) * Math.PI * 2 + 0.4;
              ctx.beginPath();
              ctx.arc(x + Math.cos(a) * u * (reach + 0.06), y + Math.sin(a) * u * (reach + 0.06), u * 0.05, 0, 7);
              ctx.fill();
            }
          }
          if (br === "a") { // Blizzard: a swirling snow ring
            ctx.fillStyle = "rgba(230,248,255,0.85)";
            for (let k = 0; k < 6; k++) {
              const a = -spin * 0.6 + (k / 6) * Math.PI * 2;
              ctx.beginPath(); ctx.arc(x + Math.cos(a) * u * 0.56, y + Math.sin(a) * u * 0.56, u * 0.05, 0, 7); ctx.fill();
            }
          }
        }
        ctx.fillStyle = "#eaf8ff"; ctx.beginPath(); ctx.arc(x, y, u * 0.08, 0, 7); ctx.fill();
        ctx.fillStyle = br === "b" ? "#5b3fa0" : "#1f6e8c"; ctx.beginPath(); ctx.arc(x, y, u * 0.04, 0, 7); ctx.fill();
      } else if (t.lineId === "camp") {
        // Squad Tent → Barracks → Elite Platoon → Dino Squad / RC Racers.
        // Growth axis: camp SIZE + defences, then the branch's own outpost.
        const w = 0.3 + tier * 0.03, h = 0.28 + tier * 0.03;
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath(); ctx.ellipse(x, y + u * 0.3, u * 0.42, u * 0.14, 0, 0, 7); ctx.fill();
        const roof = br === "a" ? "#4f8b3a" : br === "b" ? "#3f5f8b" : "#3c7a45";
        const roofDk = br === "a" ? "#3d6f2c" : br === "b" ? "#2f4a70" : "#2f6438";
        ctx.fillStyle = roof;
        ctx.beginPath();
        ctx.moveTo(x - u * w, y + u * 0.28); ctx.lineTo(x, y - u * h); ctx.lineTo(x + u * w, y + u * 0.28);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = roofDk;
        ctx.beginPath();
        ctx.moveTo(x, y - u * h); ctx.lineTo(x + u * w, y + u * 0.28); ctx.lineTo(x + u * 0.08, y + u * 0.28);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#23502e";
        ctx.beginPath();
        ctx.moveTo(x - u * 0.12, y + u * 0.28); ctx.lineTo(x, y - u * 0.02); ctx.lineTo(x + u * 0.12, y + u * 0.28);
        ctx.closePath(); ctx.fill();
        if (br === "a") { // Dino Squad: scale ridge along the roof + a bone banner
          ctx.fillStyle = "#c9f06a";
          for (let i = 0; i < 4; i++) {
            const f = 0.15 + i * 0.2;
            ctx.beginPath();
            ctx.moveTo(x - u * w * (1 - f), y + u * 0.28 - u * (h + 0.28) * f);
            ctx.lineTo(x - u * w * (1 - f) - u * 0.09, y + u * 0.28 - u * (h + 0.28) * f - u * 0.05);
            ctx.lineTo(x - u * w * (1 - f), y + u * 0.28 - u * (h + 0.28) * f - u * 0.12);
            ctx.closePath(); ctx.fill();
          }
        }
        if (br === "b") { // RC Racers: an antenna + a tiny car in the pit lane
          ctx.strokeStyle = "#cfe2ff"; ctx.lineWidth = Math.max(1, u * 0.03); ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(x + u * 0.22, y - u * 0.1); ctx.lineTo(x + u * 0.34, y - u * 0.52); ctx.stroke();
          ctx.fillStyle = "#ff6f6f"; ctx.beginPath(); ctx.arc(x + u * 0.34, y - u * 0.54, u * 0.05, 0, 7); ctx.fill();
          ctx.fillStyle = "#e2626b";
          ctx.beginPath(); ctx.rect(x - u * 0.4, y + u * 0.14, u * 0.2, u * 0.1); ctx.fill();
          ctx.fillStyle = "#22304a";
          ctx.beginPath(); ctx.arc(x - u * 0.35, y + u * 0.25, u * 0.05, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(x - u * 0.24, y + u * 0.25, u * 0.05, 0, 7); ctx.fill();
        }
        ctx.strokeStyle = "#caa268"; ctx.lineWidth = Math.max(1.5, u * 0.05); // pole
        ctx.beginPath(); ctx.moveTo(x, y - u * h); ctx.lineTo(x, y - u * (h + 0.22)); ctx.stroke();
        ctx.fillStyle = br === "a" ? "#c9f06a" : br === "b" ? "#eaf2ff" : "#e2626b"; // flag (checkered for RC)
        ctx.beginPath(); ctx.moveTo(x, y - u * (h + 0.22)); ctx.lineTo(x + u * 0.2, y - u * (h + 0.16)); ctx.lineTo(x, y - u * (h + 0.08)); ctx.closePath(); ctx.fill();
        if (br === "b") { ctx.fillStyle = "#22304a"; ctx.beginPath(); ctx.rect(x + u * 0.05, y - u * (h + 0.2), u * 0.06, u * 0.06); ctx.fill(); }
        // sandbags: more of them as the camp grows
        ctx.fillStyle = "#9c7a52";
        const bags = 1 + tier;
        for (let i = 0; i < bags; i++) {
          const off = (i - (bags - 1) / 2) * u * 0.19;
          ctx.beginPath(); ctx.ellipse(x + off, y + u * 0.28, u * 0.11, u * 0.07, 0, 0, 7); ctx.fill();
        }
        if (tier >= 3) { // a lookout post on the left
          ctx.fillStyle = "#6b4f2c";
          ctx.beginPath(); ctx.rect(x - u * 0.46, y - u * 0.16, u * 0.12, u * 0.44); ctx.fill();
          ctx.fillStyle = "#8a6a3c";
          ctx.beginPath(); ctx.rect(x - u * 0.52, y - u * 0.28, u * 0.24, u * 0.14); ctx.fill();
        }
      }
      // tier pips — a tier-4 branch gets a crown instead of a fourth dot
      if (tier >= 4) {
        ctx.fillStyle = "#ffd94a";
        ctx.beginPath();
        ctx.moveTo(x - u * 0.16, y + u * 0.46); ctx.lineTo(x - u * 0.16, y + u * 0.38);
        ctx.lineTo(x - u * 0.06, y + u * 0.44); ctx.lineTo(x, y + u * 0.34);
        ctx.lineTo(x + u * 0.06, y + u * 0.44); ctx.lineTo(x + u * 0.16, y + u * 0.38);
        ctx.lineTo(x + u * 0.16, y + u * 0.46);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = "#ffe27a";
        for (let i = 0; i < tier; i++) {
          ctx.beginPath(); ctx.arc(x - u * 0.2 + i * u * 0.14, y + u * 0.42, u * 0.045, 0, 7); ctx.fill();
        }
      }
      // jammed by The Static: a pulsing red crackle so the player sees the gun is down
      if (t.disabledUntil && engine.state.tick < t.disabledUntil) {
        const pu = 0.5 + 0.5 * Math.sin(engine.state.tick / 3);
        ctx.strokeStyle = "rgba(255,110,110," + (0.5 + 0.4 * pu).toFixed(2) + ")"; ctx.lineWidth = Math.max(2, u * 0.07);
        ctx.beginPath(); ctx.arc(x, y, u * 0.44, 0, 7); ctx.stroke();
        ctx.strokeStyle = "rgba(255,220,120,0.9)"; ctx.lineWidth = Math.max(1.5, u * 0.045); ctx.lineCap = "round";
        for (let k = 0; k < 3; k++) { const a = engine.state.tick * 0.4 + k * 2.1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * u * 0.42, y + Math.sin(a) * u * 0.42 - u * 0.1); ctx.stroke(); }
      }
    }

    // ---------- soldiers (upright, screen space) ----------
    function drawSoldier(s) {
      // Soldier posts come from posAt(), the same corner-based space as enemies —
      // which the enemy pass shifts by +0.5. Without it the squad drew half a
      // cell off the lane, so the "visible wall" never stood on the road.
      const p = worldToScreen(s.x + 0.5, s.y + 0.5);
      const x = p.x, y = p.y, u = cell;
      // A squad must SHOW its camp's rank: every soldier used to draw as the same
      // tier-1 grunt, so upgrading a camp — and especially taking Dino Squad or
      // RC Racers — changed nothing you could see on the field.
      const camp = engine.state.towers.find((t) => t.id === s.campId);
      const tier = camp ? camp.tier : 1, br = camp && camp.tier >= 4 ? camp.branch : "";
      shadow(x, y + u * 0.24, u * 0.2, u * 0.09);
      if (br === "a") { // Dino Squad: a stout little dinosaur with a spine ridge
        ctx.fillStyle = "#2f6a38";
        ctx.beginPath(); ctx.ellipse(x, y + u * 0.22, u * 0.18, u * 0.06, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#6cc24a";
        ctx.beginPath(); ctx.ellipse(x - u * 0.02, y + u * 0.04, u * 0.17, u * 0.14, 0, 0, 7); ctx.fill();
        ctx.beginPath(); // tail
        ctx.moveTo(x - u * 0.14, y + u * 0.06); ctx.quadraticCurveTo(x - u * 0.32, y + u * 0.02, x - u * 0.3, y + u * 0.18);
        ctx.quadraticCurveTo(x - u * 0.2, y + u * 0.12, x - u * 0.12, y + u * 0.14); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(x + u * 0.13, y - u * 0.11, u * 0.11, 0, 7); ctx.fill(); // head
        ctx.fillStyle = "#4e9c33"; // legs
        ctx.beginPath(); ctx.rect(x - u * 0.09, y + u * 0.13, u * 0.07, u * 0.1); ctx.fill();
        ctx.beginPath(); ctx.rect(x + u * 0.04, y + u * 0.13, u * 0.07, u * 0.1); ctx.fill();
        ctx.fillStyle = "#c9f06a"; // spines
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(x - u * (0.06 - k * 0.06), y - u * 0.06);
          ctx.lineTo(x - u * (0.02 - k * 0.06), y - u * 0.18);
          ctx.lineTo(x + u * (0.02 + k * 0.06), y - u * 0.06);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = "#22304a";
        ctx.beginPath(); ctx.arc(x + u * 0.17, y - u * 0.14, u * 0.028, 0, 7); ctx.fill();
        ctx.fillStyle = "#fff"; // teeth
        ctx.beginPath(); ctx.moveTo(x + u * 0.2, y - u * 0.05); ctx.lineTo(x + u * 0.23, y - u * 0.005); ctx.lineTo(x + u * 0.16, y - u * 0.03); ctx.closePath(); ctx.fill();
      } else if (br === "b") { // RC Racers: a tiny radio-controlled car
        ctx.fillStyle = "#22304a";
        ctx.beginPath(); ctx.ellipse(x, y + u * 0.2, u * 0.18, u * 0.05, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#e2626b";
        ctx.beginPath(); ctx.rect(x - u * 0.19, y + u * 0.02, u * 0.38, u * 0.13); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - u * 0.1, y + u * 0.02); ctx.lineTo(x - u * 0.05, y - u * 0.1);
        ctx.lineTo(x + u * 0.08, y - u * 0.1); ctx.lineTo(x + u * 0.13, y + u * 0.02);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#7fe3ff";
        ctx.beginPath(); ctx.rect(x - u * 0.05, y - u * 0.08, u * 0.11, u * 0.07); ctx.fill();
        ctx.fillStyle = "#12203a"; // wheels
        ctx.beginPath(); ctx.arc(x - u * 0.13, y + u * 0.17, u * 0.075, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(x + u * 0.13, y + u * 0.17, u * 0.075, 0, 7); ctx.fill();
        ctx.fillStyle = "#8fa6d0";
        ctx.beginPath(); ctx.arc(x - u * 0.13, y + u * 0.17, u * 0.03, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(x + u * 0.13, y + u * 0.17, u * 0.03, 0, 7); ctx.fill();
        ctx.strokeStyle = "#cfe2ff"; ctx.lineWidth = Math.max(1, u * 0.025); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x + u * 0.16, y - u * 0.02); ctx.lineTo(x + u * 0.22, y - u * 0.26); ctx.stroke();
        ctx.fillStyle = "#ffd94a";
        ctx.beginPath(); ctx.arc(x + u * 0.22, y - u * 0.28, u * 0.035, 0, 7); ctx.fill();
      } else {
        // Army guy — darker fatigues and better kit as the camp ranks up.
        const body = tier >= 3 ? "#3f7a46" : tier === 2 ? "#458c4e" : "#4c9a55";
        const hat = tier >= 3 ? "#2c5c33" : tier === 2 ? "#356b3c" : "#3f8248";
        ctx.fillStyle = "#2f6a38";
        ctx.beginPath(); ctx.ellipse(x, y + u * 0.22, u * 0.16, u * 0.06, 0, 0, 7); ctx.fill(); // base
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(x - u * 0.12, y + u * 0.2);
        ctx.quadraticCurveTo(x - u * 0.14, y - u * 0.06, x - u * 0.08, y - u * 0.1);
        ctx.lineTo(x + u * 0.08, y - u * 0.1);
        ctx.quadraticCurveTo(x + u * 0.14, y - u * 0.06, x + u * 0.12, y + u * 0.2);
        ctx.closePath(); ctx.fill();
        if (tier >= 3) { // flak vest + shoulder pads
          ctx.fillStyle = "#6d7c58";
          ctx.beginPath(); ctx.rect(x - u * 0.1, y - u * 0.06, u * 0.2, u * 0.14); ctx.fill();
          ctx.beginPath(); ctx.ellipse(x - u * 0.12, y - u * 0.06, u * 0.05, u * 0.035, 0, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.ellipse(x + u * 0.12, y - u * 0.06, u * 0.05, u * 0.035, 0, 0, 7); ctx.fill();
        }
        // rifle — longer and heavier with rank
        ctx.strokeStyle = "#274a2c"; ctx.lineWidth = Math.max(1.5, u * (0.04 + tier * 0.012)); ctx.lineCap = "round";
        const gunReach = 0.18 + tier * 0.025;
        ctx.beginPath(); ctx.moveTo(x + u * 0.02, y + u * 0.04); ctx.lineTo(x + u * gunReach, y - u * 0.12); ctx.stroke();
        // head + helmet
        ctx.fillStyle = "#e9c39a";
        ctx.beginPath(); ctx.arc(x, y - u * 0.16, u * 0.085, 0, 7); ctx.fill();
        ctx.fillStyle = hat;
        ctx.beginPath(); ctx.arc(x, y - u * 0.19, u * 0.1, Math.PI, 0); ctx.fill();
        ctx.fillRect(x - u * 0.12, y - u * 0.2, u * 0.24, u * 0.03);
        if (tier >= 2) { // rank chevrons on the chest
          ctx.fillStyle = "#ffd94a";
          for (let k = 0; k < tier - 1; k++) {
            ctx.beginPath();
            ctx.moveTo(x - u * 0.06, y + u * 0.04 + k * u * 0.05);
            ctx.lineTo(x, y + u * 0.01 + k * u * 0.05);
            ctx.lineTo(x + u * 0.06, y + u * 0.04 + k * u * 0.05);
            ctx.lineTo(x, y + u * 0.03 + k * u * 0.05);
            ctx.closePath(); ctx.fill();
          }
        }
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath(); ctx.arc(x - u * 0.04, y - u * 0.22, u * 0.03, 0, 7); ctx.fill();
      }
      if (s.hp < s.maxHp) {
        const w = u * 0.42, frac = Math.max(0, s.hp / s.maxHp);
        ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(x - w / 2, y - u * 0.38, w, 3);
        ctx.fillStyle = frac > 0.5 ? "#69d06a" : "#f0b040"; ctx.fillRect(x - w / 2, y - u * 0.38, w * frac, 3);
      }
    }

    function drawRange(cx, cy, range, ok) {
      ctx.fillStyle = ok ? "rgba(110,200,255,0.10)" : "rgba(255,120,120,0.10)";
      ctx.strokeStyle = ok ? "rgba(110,200,255,0.55)" : "rgba(255,120,120,0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc((cx + 0.5) * cell, (cy + 0.5) * cell, range * cell, 0, 7);
      ctx.fill(); ctx.stroke();
    }

    // EVERY fx coordinate is stored in SPRITE space (cell centres), because that
    // is what drawWorldFx/drawScreenFx paint in. Engine coordinates — both grid
    // cells and path positions — are corner-based, so they need exactly one
    // +0.5. Only the grid-sourced pushes used to do it, so every fx sourced from
    // an ENEMY (poof, damage number, splash, stomp, death stars, +gold, stun,
    // rally ring, the suck beam, the leak toll) painted half a cell up-left of
    // the thing it belonged to. One helper now applies the shift once.
    const fxAt = (o, x, y) => { o.x = x + 0.5; o.y = y + 0.5; return o; };
    function pushFx(e) {
      if (e.type === "hit") {
        fx.push(fxAt({ kind: "poof", ttl: 8, max: 8 }, e.x, e.y));
        if (e.crit) triggerShake(2);
        if (showDmg && e.dmg) fx.push(fxAt({ kind: "dmgnum", ttl: 22, max: 22, text: (e.crit ? "" : "") + e.dmg, crit: !!e.crit }, e.x, e.y));
      }
      else if (e.type === "splash") { fx.push(fxAt({ kind: "boom", r: e.r, ttl: 12, max: 12 }, e.x, e.y)); triggerShake(1.5); }
      else if (e.type === "stomp") { fx.push(fxAt({ kind: "boom", r: e.r, ttl: 14, max: 14 }, e.x, e.y)); triggerShake(3.5); } // boss shockwave
      else if (e.type === "boss") triggerShake(3);
      else if (e.type === "die") {
        fx.push(fxAt({ kind: "stars", ttl: 16, max: 16 }, e.x, e.y));
        fx.push(fxAt({ kind: "gold", ttl: 26, max: 26, text: "+" + e.bounty }, e.x, e.y));
      } else if (e.type === "build" || e.type === "upgrade") fx.push(fxAt({ kind: "ring", ttl: 12, max: 12 }, e.x, e.y));
      else if (e.type === "leak") { // a burst of leaks REFRESHES one flash — never stacks to an opaque wall
        const cost = e.lives || 1;
        const cur = fx.find((f) => f.kind === "leak");
        // A boss eating 8 stickers at once must not read as the same blink a
        // sock makes: it flashes deeper and for longer, and shakes the field.
        const ttl = e.boss ? 26 : 10, deep = e.boss ? 0.5 : 0.25;
        if (cur) { cur.ttl = Math.max(cur.ttl, ttl); cur.max = Math.max(cur.max, ttl); cur.deep = Math.max(cur.deep || 0.25, deep); }
        else fx.push({ kind: "leak", x: 0, y: 0, ttl, max: ttl, deep });
        if (cost > 1 && !e.shielded) {
          // the toll, floated at the door so you SEE what it cost
          const end = engine.posOn(0, 1e9);
          fx.push(fxAt({ kind: "toll", ttl: 34, max: 34, text: "−" + cost + " ❤️" }, end.x, end.y));
          if (e.boss) triggerShake(5);
        }
      }
      else if (e.type === "chain") fx.push({ kind: "chain", points: (e.points || []).map((q) => ({ x: q.x + 0.5, y: q.y + 0.5 })), ttl: 7, max: 7 });
      else if (e.type === "stun") fx.push(fxAt({ kind: "stars", ttl: 10, max: 10 }, e.x, e.y));
      else if (e.type === "rally") fx.push(fxAt({ kind: "ring", ttl: 10, max: 10 }, e.x, e.y));
      else if (e.type === "suck") fx.push(fxAt({ kind: "suck", sx: e.sx + 0.5, sy: e.sy + 0.5, ttl: 14, max: 14 }, e.x, e.y)); // Vacuum King inhale
      else if (e.type === "disable") fx.push(fxAt({ kind: "spark", ttl: 16, max: 16 }, e.x, e.y)); // The Static jam
      else if (e.type === "summon") fx.push(fxAt({ kind: "ring", ttl: 12, max: 12 }, e.x, e.y)); // minion pop
      // TD-9 powers had SOUND but no picture: a 130-gold Toy Box Drop damaged
      // enemies with nothing on screen to show where it landed (the "some of
      // them don't even seem to work" report). A point power now blooms at its
      // real radius, so you can see what it covered — and whether you aimed it.
      else if (e.type === "ability" && e.radius) {
        fx.push(fxAt({ kind: "boom", r: e.radius, ttl: 16, max: 16 }, e.x, e.y));
        if (e.id === "drop") triggerShake(2.5);
      }
    }

    // Speed zones. A conveyor (mult > 1) is scrolling forward chevrons; a TD-16
    // MUD PATCH (mult < 1) is the mirror image and must NOT look like one — it
    // is a stretch you WANT them walking through, so it draws as sticky ground
    // with rising bubbles and no direction at all. Same data field, opposite
    // meaning, so the picture has to carry the difference.
    function drawConveyors() {
      if (!ZONES) return;
      const scroll = (engine.state.tick * 0.08) % 1;
      for (const z of ZONES) {
        const span = z.to - z.from, n = Math.max(2, Math.round(span / 0.6));
        const slow = z.mult < 1;
        for (let i = 0; i <= n; i++) {
          const d = z.from + ((i + (slow ? 0 : scroll)) / n) * span;
          if (d < z.from || d > z.to) continue;
          const p = engine.posAt(d), tan = tangentAt(d);
          const cx = (p.x + 0.5) * cell, cy = (p.y + 0.5) * cell;
          const nx = -tan.y, ny = tan.x, s = cell * 0.28;
          if (slow) {
            // a gloopy blot across the lane…
            ctx.fillStyle = "rgba(96,74,44,0.55)";
            ctx.beginPath(); ctx.ellipse(cx, cy, cell * 0.42, cell * 0.34, Math.atan2(tan.y, tan.x), 0, 7); ctx.fill();
            // …with one slow bubble rising, so it reads as WET, not as a hole
            const ph = ((engine.state.tick * 0.03) + i * 0.37) % 1;
            ctx.fillStyle = "rgba(206,180,132," + (0.5 * (1 - ph)).toFixed(3) + ")";
            ctx.beginPath(); ctx.arc(cx + nx * cell * 0.1, cy + ny * cell * 0.1 - ph * cell * 0.22, cell * 0.07 * (1 - ph * 0.5), 0, 7); ctx.fill();
            continue;
          }
          ctx.strokeStyle = "rgba(120,230,255,0.55)"; ctx.lineWidth = Math.max(2, cell * 0.06); ctx.lineCap = "round"; ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(cx - tan.x * s + nx * s, cy - tan.y * s + ny * s);
          ctx.lineTo(cx + tan.x * s, cy + tan.y * s);
          ctx.lineTo(cx - tan.x * s - nx * s, cy - tan.y * s - ny * s);
          ctx.stroke();
        }
      }
    }

    // TD-16 🚪 Side Door: a wave group can walk in PARTWAY down the lane, so the
    // player has to be able to see where before they commit gold. Drawn during
    // BUILD only (once the wave is walking the enemies themselves say it), and
    // only for doors the NEXT wave actually uses — a permanent marker on a lane
    // that is not being used this wave is a lie.
    // ONE owner — the floor pass draws the line and the UPRIGHT pass draws the
    // 🚪 (characters never rotate), so both must agree on which doors are live.
    // REPORTED FROM REAL PLAY: "cannot see the door or anticipate it happening."
    // Two causes, both fixed here. (1) It vanished the instant the wave started —
    // the old comment claimed "the enemies themselves say it", but they walk in
    // BEHIND your guns, so by the time you see them the marker that would have
    // explained them is gone. A door now stays lit for as long as a wave using it
    // is in flight (waveIdx..sentIdx-1 — waves can OVERLAP since TD-15, so it is
    // a range, not one index). (2) It wore the EXIT's 🚪 — see the upright pass.
    function nextDoors() {
      const st = engine.state, waves = engine.levelDef.waves || [];
      const idxs = st.phase === "build" ? [st.sentIdx] : [];
      for (let i = st.waveIdx; i < st.sentIdx; i++) idxs.push(i); // in flight (empty during build)
      const out = new Set();
      for (const i of idxs) {
        const w = waves[i];
        if (w) w.groups.forEach((g) => { if (g.at > 0) out.add(g.at); });
      }
      return [...out];
    }
    function drawSideDoors() {
      for (const at of nextDoors()) {
        const p = engine.posAt(at), tan = tangentAt(at);
        const cx = (p.x + 0.5) * cell, cy = (p.y + 0.5) * cell;
        const nx = -tan.y, ny = tan.x;
        const pulse = 0.55 + 0.25 * Math.sin(engine.state.tick * 0.12);
        ctx.strokeStyle = "rgba(255,190,90," + pulse.toFixed(3) + ")";
        ctx.lineWidth = Math.max(2, cell * 0.08); ctx.lineCap = "round";
        // the gate itself, across the lane
        ctx.beginPath();
        ctx.moveTo(cx + nx * cell * 0.62, cy + ny * cell * 0.62);
        ctx.lineTo(cx - nx * cell * 0.62, cy - ny * cell * 0.62);
        ctx.stroke();
        // …and a chevron pointing DOWN-lane, so the marker says "they come in
        // here and walk THAT way" rather than just "something is here". Without
        // a direction a bare tick reads as a decoration.
        const hx = tan.x * cell * 0.55, hy = tan.y * cell * 0.55;
        for (const side of [1, -1]) {
          ctx.beginPath();
          ctx.moveTo(cx + nx * cell * 0.34 * side, cy + ny * cell * 0.34 * side);
          ctx.lineTo(cx + hx, cy + hy);
          ctx.stroke();
        }
      }
    }

    // TD-7 lever readability: the switch is a PERSISTENT toggle, so the field
    // itself must show which way the next train goes — running golden lights
    // along the whole ACTIVE route, and a dark veil over the branch the train
    // will NOT take (only its divergent middle — the shared prefix/tail belong
    // to both routes and stay lit). Drawn live in the FLOOR pass (the baked bg
    // never changes), animated off state.tick (frozen while paused; static, not
    // scrolling, under prefers-reduced-motion).
    function drawLeverRoute(st) {
      if (!leverSeg) return;
      const route = st.leverRoute ? 1 : 0;
      const polyline = (pts) => {
        ctx.beginPath();
        ctx.moveTo((pts[0][0] + 0.5) * cell, (pts[0][1] + 0.5) * cell);
        for (const [x, y] of pts.slice(1)) ctx.lineTo((x + 0.5) * cell, (y + 0.5) * cell);
        ctx.stroke();
      };
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      // veil the closed branch
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(10, 14, 22, 0.42)";
      ctx.lineWidth = cell * 1.05;
      polyline(leverSeg.mids[route ? 0 : 1]);
      // soft under-glow + running lights along the whole active route
      const active = lanes[route];
      ctx.strokeStyle = "rgba(255, 214, 90, 0.18)";
      ctx.lineWidth = cell * 0.5;
      polyline(active);
      ctx.strokeStyle = "rgba(255, 224, 120, 0.9)";
      ctx.lineWidth = Math.max(2, cell * 0.14);
      ctx.setLineDash([cell * 0.3, cell * 0.55]);
      ctx.lineDashOffset = reduceMotion ? 0 : -((st.tick * cell * 0.055) % (cell * 0.85));
      polyline(active);
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      lastLitLane = route;
    }

    // world-space particle fx (circles/lines — rotation-safe, drawn in FLOOR pass)
    function drawWorldFx() {
      for (const f of fx) {
        const a = f.ttl / f.max;
        if (f.kind === "poof") {
          ctx.fillStyle = "rgba(255,255,255," + (0.5 * a) + ")";
          ctx.beginPath(); ctx.arc(f.x * cell, f.y * cell, cell * 0.2 * (2 - a), 0, 7); ctx.fill();
        } else if (f.kind === "stars") {
          ctx.fillStyle = "rgba(255,226,122," + a + ")";
          for (let i = 0; i < 5; i++) {
            const ang = (i / 5) * Math.PI * 2 + f.ttl * 0.1;
            const r = cell * 0.45 * (1 - a);
            ctx.beginPath(); ctx.arc(f.x * cell + Math.cos(ang) * r, f.y * cell + Math.sin(ang) * r, 2.2, 0, 7); ctx.fill();
          }
        } else if (f.kind === "ring") {
          ctx.strokeStyle = "rgba(126,220,255," + a + ")"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(f.x * cell, f.y * cell, cell * (1.2 - a * 0.6), 0, 7); ctx.stroke();
        } else if (f.kind === "chain") {
          ctx.strokeStyle = "rgba(160,240,255," + a + ")"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo((f.points[0].x + 0.5) * cell, (f.points[0].y + 0.5) * cell);
          for (const p of f.points.slice(1)) ctx.lineTo((p.x + 0.5) * cell, (p.y + 0.5) * cell);
          ctx.stroke();
        } else if (f.kind === "boom") {
          ctx.strokeStyle = "rgba(255,180,90," + a + ")"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(f.x * cell, f.y * cell, f.r * cell * (1.15 - a * 0.35), 0, 7); ctx.stroke();
        } else if (f.kind === "suck") { // Vacuum King inhale: a line + a shrinking ring at the boss
          const bx = (f.x + 0.5) * cell, by = (f.y + 0.5) * cell, sxp = f.sx * cell, syp = f.sy * cell;
          ctx.strokeStyle = "rgba(180,205,240," + (0.7 * a) + ")"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(sxp, syp); ctx.lineTo(bx, by); ctx.stroke();
          ctx.strokeStyle = "rgba(150,185,230," + a + ")"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(bx, by, cell * 0.7 * a, 0, 7); ctx.stroke();
        } else if (f.kind === "spark") { // The Static jam burst on a tower
          ctx.strokeStyle = "rgba(255,220,120," + a + ")"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
          for (let i = 0; i < 6; i++) { const ang = (i / 6) * Math.PI * 2 + f.ttl * 0.2, rr = cell * 0.5 * (1.2 - a); ctx.beginPath(); ctx.moveTo(f.x * cell, f.y * cell); ctx.lineTo(f.x * cell + Math.cos(ang) * rr, f.y * cell + Math.sin(ang) * rr); ctx.stroke(); }
        }
      }
    }

    function drawScreenFx() { // text + full-screen flashes, never rotated
      for (const f of fx) {
        const a = f.ttl / f.max;
        if (f.kind === "gold") {
          const p = worldToScreen(f.x, f.y);
          ctx.fillStyle = "rgba(255,226,122," + a + ")";
          ctx.font = "bold " + Math.round(cell * 0.55) + "px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(f.text, p.x, p.y - (1 - a) * cell);
        } else if (f.kind === "dmgnum") { // TD-6 opt-in damage numbers
          const p = worldToScreen(f.x, f.y);
          ctx.fillStyle = (f.crit ? "rgba(255,180,90," : "rgba(255,255,255,") + a + ")";
          ctx.font = "bold " + Math.round(cell * (f.crit ? 0.6 : 0.44)) + "px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(f.text, p.x, p.y - cell * 0.5 - (1 - a) * cell * 0.8);
        } else if (f.kind === "leak") {
          ctx.fillStyle = "rgba(255,90,90," + ((f.deep || 0.25) * a) + ")";
          ctx.fillRect(0, 0, cssW, cssH);
        } else if (f.kind === "toll") { // what a multi-life leak actually cost
          const p = worldToScreen(f.x, f.y);
          const ty = p.y - (1 - a) * cell * 2;
          ctx.font = "bold " + Math.round(cell * 0.85) + "px sans-serif";
          ctx.textAlign = "center";
          // WHITE on a dark outline: this floats over the leak's red wash, so
          // red text would be invisible exactly when it matters most.
          ctx.lineWidth = Math.max(3, cell * 0.12);
          ctx.strokeStyle = "rgba(20,10,14," + a + ")";
          ctx.lineJoin = "round";
          ctx.strokeText(f.text, p.x, ty);
          ctx.fillStyle = "rgba(255,255,255," + a + ")";
          ctx.fillText(f.text, p.x, ty);
        }
        f.ttl -= 1;
      }
      for (let i = fx.length - 1; i >= 0; i--) if (fx[i].ttl <= 0) fx.splice(i, 1);
    }

    // TD-9 Sticky Floor: an amber puddle on the FLOOR (drawn in the rotated world
    // pass with the path and conveyors — it is terrain, not a character), fading
    // out over its last second so its expiry is readable without a timer.
    function drawPuddles(st) {
      const list = st.puddles || [];
      if (!list.length) return;
      for (const z of list) {
        const left = (z.until - st.tick) / global.TDData.TICK_RATE;
        const a = Math.max(0.12, Math.min(0.42, left));
        ctx.fillStyle = "rgba(255, 196, 74, " + a.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc((z.x + 0.5) * cell, (z.y + 0.5) * cell, z.r * cell, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 226, 122, " + Math.min(0.8, a + 0.25).toFixed(3) + ")";
        ctx.lineWidth = Math.max(1.5, cell * 0.05);
        ctx.stroke();
      }
    }

    function draw(alpha) {
      if (!bg) bakeBg();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      // TD-6 screen-shake: offset the whole frame a few px on heavy impacts,
      // decaying deterministically. enterWorld()/character pass inherit it.
      if (shakeTtl > 0) {
        const m = shakeMag * (shakeTtl / 10);
        ctx.setTransform(dpr, 0, 0, dpr, Math.sin(shakeTtl * 1.9) * m * dpr, Math.cos(shakeTtl * 2.7) * m * dpr);
        shakeTtl -= 1;
      }
      const st = engine.state;

      // ---------- FLOOR pass (rotation-transformed) ----------
      enterWorld();
      ctx.drawImage(bg, 0, 0, cell * GRID.w, cell * GRID.h);
      drawConveyors();
      drawSideDoors();
      drawLeverRoute(st);
      drawPuddles(st);
      if (selection && selection.pad) drawRange(selection.pad.cx, selection.pad.cy, (selection.ghostRange || 2.6) * nightMul, true);
      if (selection && selection.tower) {
        const t = st.towers.find((x) => x.id === selection.tower);
        if (t) {
          const def = global.TDData.TOWERS[t.lineId];
          const s = (t.tier === 4 && t.branch) ? def.branches[t.branch] : def.tiers[t.tier - 1];
          // night dims dart/mortar reach — show the TRUE (reduced) ring, Fan exempt
          const ring = t.lineId === "fan" ? s.auraRange
            : t.lineId === "camp" ? global.TDData.TOWERS.camp.rallyRange
            : s.range * nightMul;
          drawRange(t.cx, t.cy, ring, true);
        }
      }
      drawWorldFx();
      exitWorld();

      // ---------- CHARACTER pass (upright, screen space) ----------
      for (const t of st.towers) drawTower(t);
      for (const s of st.soldiers) if (s.alive) drawSoldier(s);
      // mortar shells arc between launch and impact
      for (const sh of st.shells) {
        const f = Math.min(1, sh.t / sh.T);
        const arc = Math.sin(Math.PI * f) * cell * 0.9;
        const p = worldToScreen(sh.x + 0.5, sh.y + 0.5);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(p.x, p.y, cell * 0.12, cell * 0.06, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#c9803a";
        ctx.beginPath(); ctx.arc(p.x, p.y - arc, cell * 0.14, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath(); ctx.arc(p.x - cell * 0.04, p.y - arc - cell * 0.04, cell * 0.04, 0, 7); ctx.fill();
      }
      const lerped = [];
      for (const e of st.enemies) {
        if (!e.alive) continue;
        const curP = engine.posOn(e.pathIdx, e.dist);
        const prev = prevPos.get(e.id) || curP;
        const wx = prev.x + (curP.x - prev.x) * alpha + 0.5;
        const wy = prev.y + (curP.y - prev.y) * alpha + 0.5;
        const p = worldToScreen(wx, wy);
        const bob = Math.sin((st.tick / 4) + e.id) * cell * 0.06;
        drawEnemy(e, p.x, p.y + bob);
        if (e.slowUntil && st.tick < e.slowUntil) { // frost tint
          ctx.fillStyle = "rgba(140,210,255,0.32)";
          ctx.beginPath(); ctx.arc(p.x, p.y + bob, cell * 0.36, 0, 7); ctx.fill();
        }
        lerped.push({ e, x: p.x, y: p.y + bob });
      }
      // projectiles (upright dots, on top of enemies)
      for (const pr of st.projectiles) {
        const p = worldToScreen(pr.x + 0.5, pr.y + 0.5);
        ctx.fillStyle = "#fff3b0";
        ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.11, 0, 7); ctx.fill();
        ctx.fillStyle = "#ffd94a";
        ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.07, 0, 7); ctx.fill();
      }

      // upright glyphs (bed / door / rally flag)
      const glyph = (wx, wy, ch, sz) => {
        const p = worldToScreen(wx + 0.5, wy + 0.5);
        ctx.font = Math.round(cell * (sz || 0.9)) + "px sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        // A COLOUR emoji ignores fillStyle, but a monochrome fallback glyph does
        // not — and this helper used to inherit whatever fill the previous draw
        // call happened to leave, so the bed/door/flag changed colour depending
        // on what was on the field. Always state it.
        ctx.fillStyle = "#eef3ff";
        ctx.fillText(ch, p.x, p.y);
      };
      // TD-7: the track-switch lever — a tappable round button on the fork. Red
      // when ready, steel + a sweeping ring while cooling down; a little arm shows
      // which way the track is currently thrown (route 0 = short, 1 = long).
      if (engine.levelDef.lever) {
        const lv = engine.levelDef.lever;
        const lp = worldToScreen(lv.cx + 0.5, lv.cy + 0.5);
        // TD-17: the diversion is TIMED, so the button is a clock. Three states,
        // read straight off the engine (never recomputed here — leverState() is
        // the one owner): RUNNING counts the diversion down, COOLDOWN counts to
        // re-arm, READY is tappable. The arc drains in both timed states, so
        // "how long have I got?" is answerable at a glance without reading text.
        const RU = global.TDData.RULES;
        const ls = engine.leverState() || { phase: "ready", secs: 0 };
        const span = ls.phase === "running" ? (RU.leverHold || 10) : (RU.leverCooldown || 10);
        const frac = ls.phase === "ready" ? 0 : Math.max(0, Math.min(1, ls.secs / span));
        const rad = cell * 0.46;
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(lp.x, lp.y + cell * 0.14, rad * 0.95, rad * 0.45, 0, 0, 7); ctx.fill();
        // running = live blue (it is DOING something), cooling = dead steel, ready = red
        ctx.fillStyle = ls.phase === "running" ? "#1f6fb2" : ls.phase === "cooldown" ? "#54627a" : "#c8382a";
        ctx.beginPath(); ctx.arc(lp.x, lp.y, rad, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = Math.max(2, cell * 0.06);
        ctx.beginPath(); ctx.arc(lp.x, lp.y, rad, 0, 7); ctx.stroke();
        if (frac > 0) { // arc DRAINS clockwise as the timer runs out
          ctx.strokeStyle = ls.phase === "running" ? "rgba(160,225,255,0.98)" : "rgba(255,225,120,0.95)";
          ctx.lineWidth = Math.max(2, cell * 0.1);
          ctx.beginPath(); ctx.arc(lp.x, lp.y, rad * 0.72, -Math.PI / 2, -Math.PI / 2 + frac * 2 * Math.PI); ctx.stroke();
        }
        // …and the number itself, because an arc says "some" and a player
        // deciding whether to spend a wave on it needs "3".
        if (ls.phase !== "ready") {
          ctx.font = "800 " + Math.max(10, Math.round(cell * 0.42)) + "px sans-serif";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          const secs = String(Math.ceil(ls.secs));
          ctx.lineWidth = Math.max(2, cell * 0.14); ctx.strokeStyle = "rgba(8,12,20,0.85)"; ctx.lineJoin = "round";
          ctx.strokeText(secs, lp.x, lp.y);
          ctx.fillStyle = "#fff"; ctx.fillText(secs, lp.x, lp.y);
        }
        // the thrown-arm indicator (points toward the active branch direction)
        const dir = st.leverRoute ? -1 : 1;
        ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(2, cell * 0.09); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(lp.x, lp.y + cell * 0.1); ctx.lineTo(lp.x + dir * cell * 0.24, lp.y - cell * 0.24); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(lp.x + dir * cell * 0.24, lp.y - cell * 0.24, cell * 0.08, 0, 7); ctx.fill();
        // The tag names the CURRENT route, and when the lever is armed it says so
        // — "SHORT WAY" alone never told you the button was waiting for a tap,
        // which is half of why the old toggle read as fire-and-forget.
        const tag = ls.phase === "running" ? "LONG WAY" : ls.phase === "cooldown" ? "SHORT WAY" : "TAP: LONG WAY";
        ctx.font = "700 " + Math.max(9, Math.round(cell * 0.3)) + "px sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        const ty = lp.y + rad + cell * 0.16;
        ctx.lineWidth = Math.max(2, cell * 0.12); ctx.strokeStyle = "rgba(8, 12, 20, 0.85)"; ctx.lineJoin = "round";
        ctx.strokeText(tag, lp.x, ty);
        ctx.fillStyle = st.leverRoute ? "#9fd2ff" : "#ffd9a0";
        ctx.fillText(tag, lp.x, ty);
      }
      const prim = lanes[0]; const s0 = prim[0], s1 = prim[prim.length - 1]; // lanes share spawn+exit
      // The spawn marker is a DATA field on the world, not an if/else chain —
      // the chain silently fell through to the bedroom's 🛏️ for the whole attic
      // (the same class as the enemy draw that marched the Tickmaster in as a
      // sock), so a 5th world would have inherited a bed too.
      const spawnGlyph = (global.TDData.WORLDS[engine.levelDef.world] || {}).spawnGlyph || "🛏️";
      glyph(s0[0], s0[1], spawnGlyph);
      // TD-16 side doors, upright like every other character. ON the crossbar,
      // not offset from it: the FLOOR rotates 90° in portrait while characters
      // stay upright, so a world-y offset here would come out as a screen-x
      // offset and the door would sit beside its own marker.
      //
      // It used to draw 🚪 — the EXIT's own glyph (below). Identical pictures for
      // "enemies come IN here" and "enemies escape here, costing you lives" is
      // exactly the defect the enemy-art pixel hash exists to catch, applied to
      // field markers instead of sprites. A side door IS a second spawn, so it
      // wears the WORLD's spawn glyph (a data field, so a new world inherits it)
      // at 0.72 — same picture as where they already come from, smaller so the
      // primary spawn still reads as primary.
      for (const at of nextDoors()) { const dp = engine.posAt(at); glyph(dp.x, dp.y, spawnGlyph, 0.72); }
      glyph(s1[0], s1[1], "🚪");
      if (selection && selection.tower) {
        const selT = st.towers.find((x) => x.id === selection.tower);
        // rallyX/rallyY are path points — cell-index space, exactly like an
        // enemy's position — so the flag centres like every other sprite. The
        // old `- 0.5` cancelled glyph()'s centring and planted the flag half a
        // cell up-left of the soldiers actually standing on it.
        if (selT && selT.lineId === "camp") glyph(selT.rallyX, selT.rallyY, "🚩", 0.8);
      }
      // enemy hp bars (upright). A boss draws at its `size` scale, so a bar
      // pinned 0.6 cells above the CENTRE was painted inside the body of every
      // boss in the game — exactly the enemy whose health you most need to read.
      // It rides the sprite's real half-height, and grows with it.
      for (const { e, x, y } of lerped) {
        if (e.hp >= e.maxHp) continue;
        const sc = bossScale(e, 1);
        const w = cell * 0.6 * Math.min(2, sc), frac = Math.max(0, e.hp / e.maxHp);
        const top = y - cell * (0.5 * sc + 0.16), h = Math.max(3, Math.round(3 * Math.min(2, sc)));
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(x - w / 2, top, w, h);
        ctx.fillStyle = frac > 0.5 ? "#69d06a" : "#f0b040";
        ctx.fillRect(x - w / 2, top, w * frac, h);
      }
      drawScreenFx();
    }

    function afterTick() {
      prevPos.clear();
      for (const e of engine.state.enemies) if (e.alive) prevPos.set(e.id, engine.posOn(e.pathIdx, e.dist));
    }

    resize();
    return {
      draw, resize, pushFx, afterTick,
      setSelection: (s) => { selection = s; },
      setDamageNumbers: (on) => { showDmg = !!on; }, // TD-6 opt-in
      shakeInfo: () => ({ ttl: shakeTtl, mag: shakeMag, reduced: reduceMotion }), // test hook
      leverInfo: () => ({ hasSeg: !!leverSeg, lit: lastLitLane }), // test hook: which lane the route overlay lit last draw
      // test hook (the leverInfo precedent): which side doors are lit right now
      // and what picture marks them. Reported from real play as invisible —
      // it wore the EXIT's 🚪 and vanished the moment the wave started — so the
      // guardrail asserts a DISTINCT glyph and that it survives into the wave.
      doorInfo: () => ({
        doors: nextDoors(),
        glyph: (global.TDData.WORLDS[engine.levelDef.world] || {}).spawnGlyph || "🛏️",
        exitGlyph: "🚪",
      }),
      cellSize: () => cell,
      isRotated: () => rotated,
      worldToScreen, screenToWorld,
    };
  }

  const API = { create };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (global && typeof global === "object") global.TDRender = API;
})(typeof window !== "undefined" ? window : globalThis);
