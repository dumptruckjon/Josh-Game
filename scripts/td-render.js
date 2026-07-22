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
    const nightMul = NIGHT ? global.TDData.RULES.nightRangeMult : 1;
    // static Manhattan length of the lane — the mole's "underground" middle third.
    const pathTotal = (() => { const wp = engine.levelDef.path; let t = 0; for (let i = 1; i < wp.length; i++) t += Math.abs(wp[i][0] - wp[i - 1][0]) + Math.abs(wp[i][1] - wp[i - 1][1]); return t; })();
    function tangentAt(dist) { const a = engine.posAt(Math.max(0, dist - 0.35)), b = engine.posAt(Math.min(pathTotal, dist + 0.35)); let tx = b.x - a.x, ty = b.y - a.y; const m = Math.hypot(tx, ty) || 1; return { x: tx / m, y: ty / m }; }

    function resize() {
      const parent = canvas.parentElement;
      const vw = parent ? parent.clientWidth : 360;
      // vertical budget: MEASURED — everything from the wrap's top edge down to
      // the bottom of the viewport is field (the CALL button floats over it, and
      // the site topbar is hidden inside the fort), minus a small safe margin.
      let chromeTop = 250;
      if (parent && parent.getBoundingClientRect) {
        const top = parent.getBoundingClientRect().top;
        if (top > 0) chromeTop = top;
      }
      const vh = Math.max(240, (global.innerHeight || 700) - chromeTop - 18);
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
      const path = engine.levelDef.path;
      const ribbon = (width, color, dash) => {
        b.strokeStyle = color; b.lineWidth = width;
        if (dash) b.setLineDash(dash); else b.setLineDash([]);
        b.beginPath();
        b.moveTo((path[0][0] + 0.5) * cell, (path[0][1] + 0.5) * cell);
        for (const [x, y] of path.slice(1)) b.lineTo((x + 0.5) * cell, (y + 0.5) * cell);
        b.stroke();
      };
      // a warm wooden toy-road: dark edge, sandy fill, dashed centre line
      ribbon(cell * 1.16, "#3c2f22");
      ribbon(cell * 1.0, "#caa268");
      ribbon(cell * 0.86, "#e0bd83");
      ribbon(Math.max(2, cell * 0.09), "rgba(255,255,255,0.55)", [cell * 0.34, cell * 0.34]);
      b.setLineDash([]);
      // spawn/exit endcaps tinted so the route reads at a glance
      const cap = (pt, color) => { b.fillStyle = color; b.beginPath(); b.arc((pt[0] + 0.5) * cell, (pt[1] + 0.5) * cell, cell * 0.6, 0, 7); b.fill(); };
      cap(path[0], "rgba(120,170,255,0.25)");
      cap(path[path.length - 1], "rgba(120,255,170,0.25)");

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
      }
    }

    // ---------- shared bits ----------
    function shadow(x, y, rx, ry) {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
    }

    // ---------- enemies (upright, screen space) ----------
    function drawEnemy(e, sx, sy) {
      const r = cell * 0.34;
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
        const R = r * 1.9;
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
        ctx.globalAlpha = e.phaseHidden ? 0.22 : 0.9;
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
        const under = e.dist > pathTotal / 3 && e.dist < (pathTotal * 2) / 3;
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
        const R = r * 1.8, spin = engine.state.tick * 0.2;
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
        const R = r * 1.85, frac = e.hp / e.maxHp;
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
    function drawTower(t) {
      const p = worldToScreen(t.cx + 0.5, t.cy + 0.5);
      const x = p.x, y = p.y, u = cell;
      shadow(x, y + u * 0.36, u * 0.4, u * 0.16);
      if (t.lineId === "dart") {
        // green blaster: base ring, dome, 1-3 barrels up, muzzle tips
        const barrels = Math.min(t.tier, 3);
        ctx.strokeStyle = "#1c5c3a"; ctx.lineWidth = Math.max(3, u * 0.13); ctx.lineCap = "round";
        for (let i = 0; i < barrels; i++) {
          const a = -Math.PI / 2 + (i - (barrels - 1) / 2) * 0.42;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * u * 0.46, y + Math.sin(a) * u * 0.46); ctx.stroke();
        }
        ctx.fillStyle = "#2f7d3f";
        for (let i = 0; i < barrels; i++) {
          const a = -Math.PI / 2 + (i - (barrels - 1) / 2) * 0.42;
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * u * 0.46, y + Math.sin(a) * u * 0.46, u * 0.07, 0, 7); ctx.fill();
        }
        const gd = ctx.createRadialGradient(x - u * 0.12, y - u * 0.12, u * 0.05, x, y, u * 0.32);
        gd.addColorStop(0, "#63d38f"); gd.addColorStop(1, "#2fa562");
        ctx.fillStyle = gd; ctx.beginPath(); ctx.arc(x, y, u * 0.3, 0, 7); ctx.fill();
        ctx.strokeStyle = "#1c5c3a"; ctx.lineWidth = Math.max(1.5, u * 0.05); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath(); ctx.arc(x - u * 0.1, y - u * 0.1, u * 0.07, 0, 7); ctx.fill();
      } else if (t.lineId === "mortar") {
        // stubby wooden mortar with a fat tube up-right
        ctx.strokeStyle = "#4a3118"; ctx.lineWidth = Math.max(4, u * 0.2); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x - u * 0.06, y + u * 0.06); ctx.lineTo(x + u * 0.22, y - u * 0.34); ctx.stroke();
        ctx.strokeStyle = "#5f4022"; ctx.lineWidth = Math.max(2, u * 0.12);
        ctx.beginPath(); ctx.moveTo(x - u * 0.06, y + u * 0.06); ctx.lineTo(x + u * 0.22, y - u * 0.34); ctx.stroke();
        ctx.fillStyle = "#2b1c0e";
        ctx.beginPath(); ctx.arc(x + u * 0.22, y - u * 0.34, u * 0.1, 0, 7); ctx.fill();
        const gm = ctx.createRadialGradient(x - u * 0.12, y - u * 0.1, u * 0.06, x, y, u * 0.34);
        gm.addColorStop(0, "#b07c48"); gm.addColorStop(1, "#7a5230");
        ctx.fillStyle = gm; ctx.beginPath(); ctx.arc(x, y, u * 0.32, 0, 7); ctx.fill();
        ctx.strokeStyle = "#4a3118"; ctx.lineWidth = Math.max(1.5, u * 0.05); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath(); ctx.arc(x - u * 0.1, y - u * 0.08, u * 0.07, 0, 7); ctx.fill();
      } else if (t.lineId === "fan") {
        // frosty hub + translucent spinning blades
        const gf = ctx.createRadialGradient(x, y, u * 0.05, x, y, u * 0.34);
        gf.addColorStop(0, "#2a8fb0"); gf.addColorStop(1, "#1f6e8c");
        ctx.fillStyle = gf; ctx.beginPath(); ctx.arc(x, y, u * 0.3, 0, 7); ctx.fill();
        const spin = engine.state.tick * 0.14 + t.id;
        for (let i = 0; i < 3; i++) {
          const a = spin + (i * Math.PI * 2) / 3;
          ctx.save(); ctx.translate(x, y); ctx.rotate(a);
          const gb = ctx.createLinearGradient(0, 0, u * 0.3, 0);
          gb.addColorStop(0, "rgba(232,247,255,0.95)"); gb.addColorStop(1, "rgba(126,220,255,0.35)");
          ctx.fillStyle = gb;
          ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(u * 0.28, -u * 0.14, u * 0.34, u * 0.02);
          ctx.quadraticCurveTo(u * 0.26, u * 0.08, 0, 0); ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = "#eaf8ff"; ctx.beginPath(); ctx.arc(x, y, u * 0.08, 0, 7); ctx.fill();
        ctx.fillStyle = "#1f6e8c"; ctx.beginPath(); ctx.arc(x, y, u * 0.04, 0, 7); ctx.fill();
      } else if (t.lineId === "camp") {
        // canvas tent with a flag + sandbags
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath(); ctx.ellipse(x, y + u * 0.3, u * 0.42, u * 0.14, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#3c7a45";
        ctx.beginPath();
        ctx.moveTo(x - u * 0.38, y + u * 0.28); ctx.lineTo(x, y - u * 0.34); ctx.lineTo(x + u * 0.38, y + u * 0.28);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#2f6438";
        ctx.beginPath();
        ctx.moveTo(x, y - u * 0.34); ctx.lineTo(x + u * 0.38, y + u * 0.28); ctx.lineTo(x + u * 0.08, y + u * 0.28);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#23502e"; // door flap
        ctx.beginPath();
        ctx.moveTo(x - u * 0.12, y + u * 0.28); ctx.lineTo(x, y - u * 0.02); ctx.lineTo(x + u * 0.12, y + u * 0.28);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#caa268"; ctx.lineWidth = Math.max(1.5, u * 0.05); // pole
        ctx.beginPath(); ctx.moveTo(x, y - u * 0.34); ctx.lineTo(x, y - u * 0.56); ctx.stroke();
        ctx.fillStyle = "#e2626b"; // flag
        ctx.beginPath(); ctx.moveTo(x, y - u * 0.56); ctx.lineTo(x + u * 0.2, y - u * 0.5); ctx.lineTo(x, y - u * 0.42); ctx.closePath(); ctx.fill();
        // sandbags
        ctx.fillStyle = "#9c7a52";
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(x + i * u * 0.2, y + u * 0.28, u * 0.11, u * 0.07, 0, 0, 7); ctx.fill(); }
      }
      // tier pips
      ctx.fillStyle = "#ffe27a";
      for (let i = 0; i < t.tier; i++) {
        ctx.beginPath(); ctx.arc(x - u * 0.2 + i * u * 0.14, y + u * 0.42, u * 0.045, 0, 7); ctx.fill();
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
      const p = worldToScreen(s.x, s.y);
      const x = p.x, y = p.y, u = cell;
      shadow(x, y + u * 0.24, u * 0.2, u * 0.09);
      // little green army guy on a base
      ctx.fillStyle = "#2f6a38";
      ctx.beginPath(); ctx.ellipse(x, y + u * 0.22, u * 0.16, u * 0.06, 0, 0, 7); ctx.fill(); // base
      ctx.fillStyle = "#4c9a55"; // body
      ctx.beginPath();
      ctx.moveTo(x - u * 0.12, y + u * 0.2);
      ctx.quadraticCurveTo(x - u * 0.14, y - u * 0.06, x - u * 0.08, y - u * 0.1);
      ctx.lineTo(x + u * 0.08, y - u * 0.1);
      ctx.quadraticCurveTo(x + u * 0.14, y - u * 0.06, x + u * 0.12, y + u * 0.2);
      ctx.closePath(); ctx.fill();
      // rifle
      ctx.strokeStyle = "#274a2c"; ctx.lineWidth = Math.max(1.5, u * 0.05); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x + u * 0.02, y + u * 0.04); ctx.lineTo(x + u * 0.22, y - u * 0.12); ctx.stroke();
      // head + helmet
      ctx.fillStyle = "#e9c39a";
      ctx.beginPath(); ctx.arc(x, y - u * 0.16, u * 0.085, 0, 7); ctx.fill();
      ctx.fillStyle = "#3f8248";
      ctx.beginPath(); ctx.arc(x, y - u * 0.19, u * 0.1, Math.PI, 0); ctx.fill();
      ctx.fillRect(x - u * 0.12, y - u * 0.2, u * 0.24, u * 0.03);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath(); ctx.arc(x - u * 0.04, y - u * 0.22, u * 0.03, 0, 7); ctx.fill();
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

    function pushFx(e) {
      if (e.type === "hit") fx.push({ kind: "poof", x: e.x, y: e.y, ttl: 8, max: 8 });
      else if (e.type === "die") {
        fx.push({ kind: "stars", x: e.x, y: e.y, ttl: 16, max: 16 });
        fx.push({ kind: "gold", x: e.x, y: e.y, ttl: 26, max: 26, text: "+" + e.bounty });
      } else if (e.type === "build" || e.type === "upgrade") fx.push({ kind: "ring", x: e.x + 0.5, y: e.y + 0.5, ttl: 12, max: 12 });
      else if (e.type === "leak") { // a burst of leaks REFRESHES one flash — never stacks to an opaque wall
        const cur = fx.find((f) => f.kind === "leak");
        if (cur) cur.ttl = cur.max; else fx.push({ kind: "leak", x: 0, y: 0, ttl: 10, max: 10 });
      }
      else if (e.type === "chain") fx.push({ kind: "chain", points: e.points, ttl: 7, max: 7 });
      else if (e.type === "splash") fx.push({ kind: "boom", x: e.x, y: e.y, r: e.r, ttl: 12, max: 12 });
      else if (e.type === "stun") fx.push({ kind: "stars", x: e.x, y: e.y, ttl: 10, max: 10 });
      else if (e.type === "stomp") fx.push({ kind: "boom", x: e.x, y: e.y, r: e.r, ttl: 14, max: 14 }); // boss shockwave
      else if (e.type === "rally") fx.push({ kind: "ring", x: e.x, y: e.y, ttl: 10, max: 10 });
      else if (e.type === "suck") fx.push({ kind: "suck", x: e.x, y: e.y, sx: e.sx, sy: e.sy, ttl: 14, max: 14 }); // Vacuum King inhale
      else if (e.type === "disable") fx.push({ kind: "spark", x: e.x + 0.5, y: e.y + 0.5, ttl: 16, max: 16 }); // The Static jam
      else if (e.type === "summon") fx.push({ kind: "ring", x: e.x, y: e.y, ttl: 12, max: 12 }); // minion pop
    }

    // Conveyor strips (Slip'n'Slide): scrolling forward chevrons over each speed
    // zone so the player SEES where enemies get a shove. Floor pass (cell coords).
    function drawConveyors() {
      if (!ZONES) return;
      const scroll = (engine.state.tick * 0.08) % 1;
      for (const z of ZONES) {
        const span = z.to - z.from, n = Math.max(2, Math.round(span / 0.6));
        for (let i = 0; i <= n; i++) {
          const d = z.from + ((i + scroll) / n) * span;
          if (d < z.from || d > z.to) continue;
          const p = engine.posAt(d), tan = tangentAt(d);
          const cx = (p.x + 0.5) * cell, cy = (p.y + 0.5) * cell;
          const nx = -tan.y, ny = tan.x, s = cell * 0.28;
          ctx.strokeStyle = "rgba(120,230,255,0.55)"; ctx.lineWidth = Math.max(2, cell * 0.06); ctx.lineCap = "round"; ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(cx - tan.x * s + nx * s, cy - tan.y * s + ny * s);
          ctx.lineTo(cx + tan.x * s, cy + tan.y * s);
          ctx.lineTo(cx - tan.x * s - nx * s, cy - tan.y * s - ny * s);
          ctx.stroke();
        }
      }
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
        } else if (f.kind === "leak") {
          ctx.fillStyle = "rgba(255,90,90," + (0.25 * a) + ")";
          ctx.fillRect(0, 0, cssW, cssH);
        }
        f.ttl -= 1;
      }
      for (let i = fx.length - 1; i >= 0; i--) if (fx[i].ttl <= 0) fx.splice(i, 1);
    }

    function draw(alpha) {
      if (!bg) bakeBg();
      ctx.clearRect(0, 0, cssW, cssH);
      const st = engine.state;

      // ---------- FLOOR pass (rotation-transformed) ----------
      enterWorld();
      ctx.drawImage(bg, 0, 0, cell * GRID.w, cell * GRID.h);
      drawConveyors();
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
        const curP = engine.posAt(e.dist);
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
        ctx.fillText(ch, p.x, p.y);
      };
      const s0 = engine.levelDef.path[0], s1 = engine.levelDef.path[engine.levelDef.path.length - 1];
      const spawnGlyph = engine.levelDef.world === "backyard" ? "🌳" : engine.levelDef.world === "toystore" ? "🧸" : "🛏";
      glyph(s0[0], s0[1], spawnGlyph);
      glyph(s1[0], s1[1], "🚪");
      if (selection && selection.tower) {
        const selT = st.towers.find((x) => x.id === selection.tower);
        if (selT && selT.lineId === "camp") glyph(selT.rallyX - 0.5, selT.rallyY - 0.5, "🚩", 0.8);
      }
      // enemy hp bars (upright)
      for (const { e, x, y } of lerped) {
        if (e.hp >= e.maxHp) continue;
        const w = cell * 0.6, frac = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(x - w / 2, y - cell * 0.6, w, 3);
        ctx.fillStyle = frac > 0.5 ? "#69d06a" : "#f0b040";
        ctx.fillRect(x - w / 2, y - cell * 0.6, w * frac, 3);
      }
      drawScreenFx();
    }

    function afterTick() {
      prevPos.clear();
      for (const e of engine.state.enemies) if (e.alive) prevPos.set(e.id, engine.posAt(e.dist));
    }

    resize();
    return {
      draw, resize, pushFx, afterTick,
      setSelection: (s) => { selection = s; },
      cellSize: () => cell,
      isRotated: () => rotated,
      worldToScreen, screenToWorld,
    };
  }

  const API = { create };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (global && typeof global === "object") global.TDRender = API;
})(typeof window !== "undefined" ? window : globalThis);
