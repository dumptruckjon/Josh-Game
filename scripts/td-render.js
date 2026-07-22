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
      g.addColorStop(0, "#12213c"); g.addColorStop(1, "#1c2c49");
      b.fillStyle = g; b.fillRect(0, 0, W, H);
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
      else if (e.type === "rally") fx.push({ kind: "ring", x: e.x, y: e.y, ttl: 10, max: 10 });
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
      if (selection && selection.pad) drawRange(selection.pad.cx, selection.pad.cy, selection.ghostRange || 2.6, true);
      if (selection && selection.tower) {
        const t = st.towers.find((x) => x.id === selection.tower);
        if (t) {
          const def = global.TDData.TOWERS[t.lineId];
          const s = (t.tier === 4 && t.branch) ? def.branches[t.branch] : def.tiers[t.tier - 1];
          const ring = t.lineId === "fan" ? s.auraRange
            : t.lineId === "camp" ? global.TDData.TOWERS.camp.rallyRange
            : s.range;
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
      glyph(s0[0], s0[1], "🛏");
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
