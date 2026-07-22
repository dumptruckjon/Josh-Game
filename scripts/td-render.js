// Fort Josh: Toybox Defense — canvas renderer (TD-1.1).
// Reads engine state, never mutates it. ORIENTATION-AWARE: in a portrait
// viewport the world (24×14 cells) is drawn ROTATED 90° so the battlefield
// fills the tall phone screen (14 cells across × 24 down); in landscape it
// draws unrotated. Geometry stays in world cells everywhere — worldToScreen/
// screenToWorld are the ONE mapping (taps, bubbles and HUD share it, so the
// rotation can never desync input from drawing). Two passes per frame:
//   1. world pass under the rotation transform (bg, path, pads, towers,
//      enemies, projectiles, rings, particle fx — circles survive rotation)
//   2. screen pass (hp bars, gold floaters, spawn/exit glyphs, leak flash) so
//      TEXT never renders sideways.
// Math.random here is VISUAL ONLY (never in the engine).

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
      // vertical budget: viewport minus the fort chrome (bar+HUD+controls)
      const vh = Math.max(240, (global.innerHeight || 700) - 250);
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
    function enterWorld() { // apply the rotation transform for the world pass
      ctx.save();
      if (rotated) { ctx.translate(cssW, 0); ctx.rotate(Math.PI / 2); }
    }
    function exitWorld() { ctx.restore(); }

    function bakeBg() {
      bg = document.createElement("canvas");
      const W = cell * GRID.w, H = cell * GRID.h; // WORLD-oriented bake
      bg.width = W * dpr; bg.height = H * dpr;
      const b = bg.getContext("2d");
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = b.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#101f38"); g.addColorStop(1, "#1b2a45");
      b.fillStyle = g; b.fillRect(0, 0, W, H);
      b.strokeStyle = "rgba(255,255,255,0.04)"; b.lineWidth = 1;
      for (let y = 0; y < GRID.h; y += 2) { b.beginPath(); b.moveTo(0, y * cell); b.lineTo(W, y * cell); b.stroke(); }
      b.lineCap = "round"; b.lineJoin = "round";
      const ribbon = (width, color, dash) => {
        b.strokeStyle = color; b.lineWidth = width;
        if (dash) b.setLineDash(dash); else b.setLineDash([]);
        b.beginPath();
        const first = engine.levelDef.path[0];
        b.moveTo((first[0] + 0.5) * cell, (first[1] + 0.5) * cell);
        for (const [x, y] of engine.levelDef.path.slice(1)) b.lineTo((x + 0.5) * cell, (y + 0.5) * cell);
        b.stroke();
      };
      ribbon(cell * 1.05, "#4a3b63");
      ribbon(cell * 0.85, "#5d4a7a");
      ribbon(2, "rgba(255,255,255,0.25)", [cell * 0.3, cell * 0.35]);
      b.setLineDash([]);
      for (const p of engine.levelDef.pads) {
        b.fillStyle = "#7a5c3e";
        b.beginPath(); b.arc((p.cx + 0.5) * cell, (p.cy + 0.5) * cell, cell * 0.42, 0, 7); b.fill();
        b.fillStyle = "#9c7a52";
        b.beginPath(); b.arc((p.cx + 0.5) * cell, (p.cy + 0.5) * cell, cell * 0.34, 0, 7); b.fill();
      }
    }

    function drawEnemy(e, x, y, t) {
      const wob = Math.sin((t / 4) + e.id) * cell * 0.06;
      const cxp = x * cell, cyp = y * cell + wob;
      if (e.type === "sock") {
        ctx.fillStyle = "#f3f4f8";
        ctx.beginPath(); ctx.ellipse(cxp, cyp, cell * 0.30, cell * 0.38, 0.3, 0, 7); ctx.fill();
        ctx.fillStyle = "#e2626b";
        ctx.beginPath(); ctx.ellipse(cxp + cell * 0.12, cyp + cell * 0.22, cell * 0.14, cell * 0.10, 0.3, 0, 7); ctx.fill();
        ctx.fillStyle = "#22304a";
        ctx.beginPath(); ctx.arc(cxp - cell * 0.08, cyp - cell * 0.12, cell * 0.05, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(cxp + cell * 0.08, cyp - cell * 0.12, cell * 0.05, 0, 7); ctx.fill();
      } else {
        const g = ctx.createRadialGradient(cxp - cell * 0.1, cyp - cell * 0.1, cell * 0.04, cxp, cyp, cell * 0.3);
        g.addColorStop(0, "#bfe6ff"); g.addColorStop(1, "#2f7fd1");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cxp, cyp, cell * 0.26, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath(); ctx.arc(cxp - cell * 0.09, cyp - cell * 0.1, cell * 0.06, 0, 7); ctx.fill();
      }
      if (e.slowUntil && engine.state.tick < e.slowUntil) { // frost tint
        ctx.fillStyle = "rgba(140,210,255,0.35)";
        ctx.beginPath(); ctx.arc(cxp, cyp, cell * 0.32, 0, 7); ctx.fill();
      }
    }

    function drawTower(t) {
      const x = (t.cx + 0.5) * cell, y = (t.cy + 0.5) * cell;
      if (t.lineId === "dart") {
        ctx.fillStyle = "#2fa562";
        ctx.beginPath(); ctx.arc(x, y, cell * 0.30, 0, 7); ctx.fill();
        ctx.fillStyle = "#57c98a";
        ctx.beginPath(); ctx.arc(x, y, cell * 0.22, 0, 7); ctx.fill();
        ctx.strokeStyle = "#1c5c3a"; ctx.lineWidth = Math.max(2, cell * 0.09); ctx.lineCap = "round";
        const barrels = Math.min(t.tier, 3);
        for (let i = 0; i < barrels; i++) {
          const a = -Math.PI / 2 + (i - (barrels - 1) / 2) * 0.5;
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * cell * 0.42, y + Math.sin(a) * cell * 0.42);
          ctx.stroke();
        }
      } else if (t.lineId === "mortar") {
        ctx.fillStyle = "#7a5230";
        ctx.beginPath(); ctx.arc(x, y, cell * 0.32, 0, 7); ctx.fill();
        ctx.fillStyle = "#9c6b3f";
        ctx.beginPath(); ctx.arc(x, y, cell * 0.24, 0, 7); ctx.fill();
        ctx.strokeStyle = "#4a3118"; ctx.lineWidth = Math.max(3, cell * 0.16); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x, y + cell * 0.06);
        ctx.lineTo(x + cell * 0.22, y - cell * 0.34); ctx.stroke(); // the lobber tube
      } else if (t.lineId === "fan") {
        ctx.fillStyle = "#1f6e8c";
        ctx.beginPath(); ctx.arc(x, y, cell * 0.30, 0, 7); ctx.fill();
        ctx.fillStyle = "#7edcff";
        const spin = engine.state.tick * 0.12 + t.id;
        for (let i = 0; i < 3; i++) { // spinning blades
          const a = spin + (i * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a) * cell * 0.14, y + Math.sin(a) * cell * 0.14, cell * 0.13, cell * 0.06, a, 0, 7);
          ctx.fill();
        }
        ctx.fillStyle = "#e8f7ff";
        ctx.beginPath(); ctx.arc(x, y, cell * 0.06, 0, 7); ctx.fill();
      } else if (t.lineId === "camp") {
        ctx.fillStyle = "#3c7a45"; // tent
        ctx.beginPath();
        ctx.moveTo(x - cell * 0.34, y + cell * 0.26);
        ctx.lineTo(x, y - cell * 0.3);
        ctx.lineTo(x + cell * 0.34, y + cell * 0.26);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#245230";
        ctx.beginPath();
        ctx.moveTo(x - cell * 0.1, y + cell * 0.26);
        ctx.lineTo(x, y - cell * 0.02);
        ctx.lineTo(x + cell * 0.1, y + cell * 0.26);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#e2626b"; ctx.lineWidth = 2; // flag
        ctx.beginPath(); ctx.moveTo(x, y - cell * 0.3); ctx.lineTo(x, y - cell * 0.5); ctx.stroke();
        ctx.fillStyle = "#e2626b";
        ctx.beginPath();
        ctx.moveTo(x, y - cell * 0.5); ctx.lineTo(x + cell * 0.16, y - cell * 0.44); ctx.lineTo(x, y - cell * 0.38);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = "#ffe27a"; // tier pips (all lines)
      for (let i = 0; i < t.tier; i++) {
        ctx.beginPath(); ctx.arc(x - cell * 0.2 + i * cell * 0.14, y + cell * 0.38, cell * 0.045, 0, 7); ctx.fill();
      }
    }

    function drawSoldier(s) {
      const x = s.x * cell, y = s.y * cell;
      ctx.fillStyle = "#4c9a55"; // body
      ctx.beginPath(); ctx.ellipse(x, y + cell * 0.06, cell * 0.11, cell * 0.15, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#6fbf78"; // helmet head
      ctx.beginPath(); ctx.arc(x, y - cell * 0.14, cell * 0.09, 0, 7); ctx.fill();
      if (s.hp < s.maxHp) {
        const w = cell * 0.4, frac = Math.max(0, s.hp / s.maxHp);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(x - w / 2, y - cell * 0.35, w, 2.5);
        ctx.fillStyle = frac > 0.5 ? "#69d06a" : "#f0b040";
        ctx.fillRect(x - w / 2, y - cell * 0.35, w * frac, 2.5);
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
      else if (e.type === "leak") fx.push({ kind: "leak", x: 0, y: 0, ttl: 10, max: 10 });
      else if (e.type === "chain") fx.push({ kind: "chain", points: e.points, ttl: 7, max: 7 });
      else if (e.type === "splash") fx.push({ kind: "boom", x: e.x, y: e.y, r: e.r, ttl: 12, max: 12 });
      else if (e.type === "stun") fx.push({ kind: "stars", x: e.x, y: e.y, ttl: 10, max: 10 });
      else if (e.type === "rally") fx.push({ kind: "ring", x: e.x, y: e.y, ttl: 10, max: 10 });
    }

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

      // ---------- world pass (rotation-transformed) ----------
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
      for (const t of st.towers) drawTower(t);
      for (const s of st.soldiers) if (s.alive) drawSoldier(s);
      // mortar shells arc between launch and impact
      for (const sh of st.shells) {
        const f = Math.min(1, sh.t / sh.T);
        const arc = Math.sin(Math.PI * f) * cell * 0.9;
        ctx.fillStyle = "#c9803a";
        ctx.beginPath(); ctx.arc((sh.x + 0.5) * cell, (sh.y + 0.5) * cell - arc, cell * 0.13, 0, 7); ctx.fill();
      }
      const lerped = [];
      for (const e of st.enemies) {
        if (!e.alive) continue;
        const curP = engine.posAt(e.dist);
        const prev = prevPos.get(e.id) || curP;
        const x = prev.x + (curP.x - prev.x) * alpha + 0.5;
        const y = prev.y + (curP.y - prev.y) * alpha + 0.5;
        drawEnemy(e, x, y, st.tick);
        lerped.push({ e, x, y });
      }
      ctx.fillStyle = "#ffd94a";
      for (const p of st.projectiles) {
        ctx.beginPath(); ctx.arc((p.x + 0.5) * cell, (p.y + 0.5) * cell, cell * 0.10, 0, 7); ctx.fill();
      }
      drawWorldFx();
      exitWorld();

      // ---------- screen pass (upright text/bars) ----------
      const glyph = (wx, wy, ch) => {
        const p = worldToScreen(wx + 0.5, wy + 0.5);
        ctx.font = Math.round(cell * 0.9) + "px sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(ch, p.x, p.y);
      };
      const s0 = engine.levelDef.path[0], s1 = engine.levelDef.path[engine.levelDef.path.length - 1];
      glyph(s0[0], s0[1], "🛏");
      glyph(s1[0], s1[1], "🚪");
      if (selection && selection.tower) {
        const selT = st.towers.find((x) => x.id === selection.tower);
        if (selT && selT.lineId === "camp") glyph(selT.rallyX - 0.5, selT.rallyY - 0.5, "🚩");
      }
      for (const { e, x, y } of lerped) {
        if (e.hp >= e.maxHp) continue;
        const p = worldToScreen(x, y);
        const w = cell * 0.6, frac = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(p.x - w / 2, p.y - cell * 0.55, w, 3);
        ctx.fillStyle = frac > 0.5 ? "#69d06a" : "#f0b040";
        ctx.fillRect(p.x - w / 2, p.y - cell * 0.55, w * frac, 3);
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
