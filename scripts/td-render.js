// Fort Josh: Toybox Defense — canvas renderer (TD-1).
// Reads engine state, never mutates it. The main loop drains engine.events and
// feeds them here as fx. Interpolates enemy positions between the last two
// logic ticks (30Hz sim → smooth 60fps+). All art is programmatic — bedroom
// night palette, carpet path ribbon, wooden pads, toy dart towers, sock/marble
// enemies with wobble. Math.random here is VISUAL ONLY (never in the engine).

(function (global) {
  function create(canvas, engine) {
    const ctx = canvas.getContext("2d");
    const GRID = global.TDData.GRID;
    let cell = 16, dpr = 1;
    let selection = null; // {padId?, towerId?, ghostRange?}
    const fx = [];        // {kind, x, y, ttl, max, text?}
    const prevPos = new Map(); // enemyId → {x,y} from the previous tick (lerp)
    let bg = null;

    function resize() {
      const w = canvas.parentElement ? canvas.parentElement.clientWidth : 360;
      cell = Math.max(10, Math.floor(w / GRID.w));
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      canvas.style.width = cell * GRID.w + "px";
      canvas.style.height = cell * GRID.h + "px";
      canvas.width = cell * GRID.w * dpr;
      canvas.height = cell * GRID.h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bg = null; // re-bake
    }

    const px = (v) => v * cell;

    function bakeBg() {
      bg = document.createElement("canvas");
      bg.width = canvas.width; bg.height = canvas.height;
      const b = bg.getContext("2d");
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = cell * GRID.w, H = cell * GRID.h;
      const g = b.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#101f38"); g.addColorStop(1, "#1b2a45");
      b.fillStyle = g; b.fillRect(0, 0, W, H);
      // wood floor hint
      b.strokeStyle = "rgba(255,255,255,0.04)"; b.lineWidth = 1;
      for (let y = 0; y < GRID.h; y += 2) { b.beginPath(); b.moveTo(0, px(y)); b.lineTo(W, px(y)); b.stroke(); }
      // the carpet path ribbon
      const path = engine.path;
      b.lineCap = "round"; b.lineJoin = "round";
      const ribbon = (width, color) => {
        b.strokeStyle = color; b.lineWidth = width;
        b.beginPath();
        const first = engine.levelDef.path[0];
        b.moveTo(px(first[0] + 0.5), px(first[1] + 0.5));
        for (const [x, y] of engine.levelDef.path.slice(1)) b.lineTo(px(x + 0.5), px(y + 0.5));
        b.stroke();
      };
      ribbon(cell * 1.05, "#4a3b63");
      ribbon(cell * 0.85, "#5d4a7a");
      b.setLineDash([cell * 0.3, cell * 0.35]);
      ribbon(2, "rgba(255,255,255,0.25)");
      b.setLineDash([]);
      // spawn + exit markers
      const s = engine.levelDef.path[0], e = engine.levelDef.path[engine.levelDef.path.length - 1];
      b.font = Math.round(cell * 0.9) + "px sans-serif"; b.textAlign = "center"; b.textBaseline = "middle";
      b.fillText("🛏", px(s[0] + 0.5), px(s[1] + 0.5));
      b.fillText("🚪", px(e[0] + 0.5), px(e[1] + 0.5));
      // build pads
      for (const p of engine.levelDef.pads) {
        b.fillStyle = "#7a5c3e";
        b.beginPath(); b.arc(px(p.cx + 0.5), px(p.cy + 0.5), cell * 0.42, 0, 7); b.fill();
        b.fillStyle = "#9c7a52";
        b.beginPath(); b.arc(px(p.cx + 0.5), px(p.cy + 0.5), cell * 0.34, 0, 7); b.fill();
      }
      void path;
    }

    function drawEnemy(e, x, y, t) {
      const wob = Math.sin((t / 4) + e.id) * cell * 0.06;
      const cxp = x * cell, cyp = y * cell + wob;
      if (e.type === "sock") {
        ctx.fillStyle = "#f3f4f8";
        ctx.beginPath();
        ctx.ellipse(cxp, cyp, cell * 0.30, cell * 0.38, 0.3, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#e2626b"; // heel
        ctx.beginPath(); ctx.ellipse(cxp + cell * 0.12, cyp + cell * 0.22, cell * 0.14, cell * 0.10, 0.3, 0, 7); ctx.fill();
        ctx.fillStyle = "#22304a"; // eyes
        ctx.beginPath(); ctx.arc(cxp - cell * 0.08, cyp - cell * 0.12, cell * 0.05, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(cxp + cell * 0.08, cyp - cell * 0.12, cell * 0.05, 0, 7); ctx.fill();
      } else { // marble
        const g = ctx.createRadialGradient(cxp - cell * 0.1, cyp - cell * 0.1, cell * 0.04, cxp, cyp, cell * 0.3);
        g.addColorStop(0, "#bfe6ff"); g.addColorStop(1, "#2f7fd1");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cxp, cyp, cell * 0.26, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath(); ctx.arc(cxp - cell * 0.09, cyp - cell * 0.1, cell * 0.06, 0, 7); ctx.fill();
      }
      if (e.hp < e.maxHp) { // hp pip bar
        const w = cell * 0.6, frac = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(cxp - w / 2, cyp - cell * 0.5, w, 3);
        ctx.fillStyle = frac > 0.5 ? "#69d06a" : "#f0b040";
        ctx.fillRect(cxp - w / 2, cyp - cell * 0.5, w * frac, 3);
      }
    }

    function drawTower(t) {
      const x = (t.cx + 0.5) * cell, y = (t.cy + 0.5) * cell;
      ctx.fillStyle = "#2fa562";
      ctx.beginPath(); ctx.arc(x, y, cell * 0.30, 0, 7); ctx.fill();
      ctx.fillStyle = "#57c98a";
      ctx.beginPath(); ctx.arc(x, y, cell * 0.22, 0, 7); ctx.fill();
      // barrels per tier
      ctx.strokeStyle = "#1c5c3a"; ctx.lineWidth = Math.max(2, cell * 0.09); ctx.lineCap = "round";
      const barrels = t.tier;
      for (let i = 0; i < barrels; i++) {
        const a = -Math.PI / 2 + (i - (barrels - 1) / 2) * 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * cell * 0.42, y + Math.sin(a) * cell * 0.42);
        ctx.stroke();
      }
      // tier pips
      ctx.fillStyle = "#ffe27a";
      for (let i = 0; i < t.tier; i++) {
        ctx.beginPath(); ctx.arc(x - cell * 0.2 + i * cell * 0.2, y + cell * 0.34, cell * 0.05, 0, 7); ctx.fill();
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
    }

    function drawFx() {
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
        } else if (f.kind === "gold") {
          ctx.fillStyle = "rgba(255,226,122," + a + ")";
          ctx.font = "bold " + Math.round(cell * 0.55) + "px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(f.text, f.x * cell, f.y * cell - (1 - a) * cell);
        } else if (f.kind === "ring") {
          ctx.strokeStyle = "rgba(126,220,255," + a + ")"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(f.x * cell, f.y * cell, cell * (1.2 - a * 0.6), 0, 7); ctx.stroke();
        } else if (f.kind === "leak") {
          ctx.fillStyle = "rgba(255,90,90," + (0.25 * a) + ")";
          ctx.fillRect(0, 0, cell * GRID.w, cell * GRID.h);
        }
        f.ttl -= 1;
      }
      for (let i = fx.length - 1; i >= 0; i--) if (fx[i].ttl <= 0) fx.splice(i, 1);
    }

    function draw(alpha) {
      if (!bg) bakeBg();
      ctx.clearRect(0, 0, cell * GRID.w, cell * GRID.h);
      ctx.drawImage(bg, 0, 0, cell * GRID.w, cell * GRID.h);
      const st = engine.state;

      // selection / ghost range rings under everything else
      if (selection && selection.pad) {
        drawRange(selection.pad.cx, selection.pad.cy, selection.ghostRange || 2.6, true);
      }
      if (selection && selection.tower) {
        const t = st.towers.find((x) => x.id === selection.tower);
        if (t) {
          const def = global.TDData.TOWERS[t.lineId];
          drawRange(t.cx, t.cy, def.tiers[t.tier - 1].range, true);
        }
      }

      for (const t of st.towers) drawTower(t);

      // enemies (lerped between previous and current tick positions)
      for (const e of st.enemies) {
        if (!e.alive) continue;
        const cur = engine.posAt(e.dist);
        const prev = prevPos.get(e.id) || cur;
        const x = prev.x + (cur.x - prev.x) * alpha + 0.5;
        const y = prev.y + (cur.y - prev.y) * alpha + 0.5;
        drawEnemy(e, x, y, st.tick);
      }

      // projectiles
      ctx.fillStyle = "#ffd94a";
      for (const p of st.projectiles) {
        ctx.beginPath(); ctx.arc((p.x + 0.5) * cell, (p.y + 0.5) * cell, cell * 0.10, 0, 7); ctx.fill();
      }

      drawFx();
    }

    // Snapshot enemy positions right AFTER each logic tick (lerp base).
    function afterTick() {
      prevPos.clear();
      for (const e of engine.state.enemies) if (e.alive) prevPos.set(e.id, engine.posAt(e.dist));
    }

    resize();
    return {
      draw, resize, pushFx, afterTick,
      setSelection: (s) => { selection = s; },
      cellSize: () => cell,
    };
  }

  const API = { create };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (global && typeof global === "object") global.TDRender = API;
})(typeof window !== "undefined" ? window : globalThis);
