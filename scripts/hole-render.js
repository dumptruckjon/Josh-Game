// Gobble Hole — the canvas renderer (PLAN_GOBBLE.md §7). It READS the engine's
// state and never changes it. Everything that does not move — the backdrop,
// the diorama and its ground — is baked ONCE per scene and size into an
// offscreen canvas, so a frame is one blit, ~40 sprite blits, the hole and a
// few particles.
//
// iOS 14.2 floor: no roundRect on the 2D context (Safari 16), no context
// filter (Safari 17), no OffscreenCanvas — rounded rects are drawn by hand,
// shadows are pre-rendered soft sprites, and every emoji is rendered once into
// a plain <canvas>.

(function (global) {
  "use strict";
  const DATA = global.HoleData;
  const RULES = DATA.RULES;
  const SQ = RULES.SQ;
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  // A sprite's ink is scaled so its LARGER side is VIS * r: a bus is that
  // wide, a tower that tall, and every thing reads as the size it eats as.
  const VIS = 2.3;
  const MARGIN = 2.5, THICK = 4;   // world units around the island, and its front edge

  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
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
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const reduceMotion = () => {
    try { return !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (e) { return false; }
  };

  // A rounded rect path, by hand (the context's own roundRect is Safari 16).
  function rrect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r);
    c.closePath();
  }

  // ---- The grounds (world units; the island is 0..W × 0..H) ----------------
  const GROUNDS = {
    wood(c, W, H, R) {
      const tones = ["#e8bd7e", "#e0b16f", "#ecc68b"];
      for (let y = 0, i = 0; y < H; y += 8, i++) {
        c.fillStyle = tones[i % 3];
        c.fillRect(0, y, W, 8);
        c.strokeStyle = "rgba(160,110,60,0.55)"; c.lineWidth = 0.45;
        c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
        // staggered plank ends
        for (let x = (i % 2) * 17 + R() * 10; x < W; x += 30 + R() * 14) {
          c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 8); c.stroke();
        }
        c.strokeStyle = "rgba(170,120,70,0.22)"; c.lineWidth = 0.25;
        for (let g = 0; g < 2; g++) {
          const gy = y + 2 + g * 3 + R() * 1.5;
          c.beginPath(); c.moveTo(0, gy);
          for (let x = 0; x <= W; x += 10) c.lineTo(x, gy + Math.sin(x * 0.15 + i) * 0.5);
          c.stroke();
        }
      }
      // the big round rug, rings of colour, tassels round the edge
      const cx = W / 2, cy = H * 0.56, rx = W * 0.4;
      const rings = ["#ff6b6b", "#ffd93d", "#58c7ff", "#7be08a", "#c77dff", "#ff9a3d"];
      c.save();
      c.strokeStyle = "#ffffff"; c.lineWidth = 0.35;
      for (let a = 0; a < Math.PI * 2; a += 0.09) {
        const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * rx * SQ;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 1.4, y + Math.sin(a) * 1.4 * SQ); c.stroke();
      }
      rings.forEach((col, k) => {
        const f = 1 - k * 0.16;
        c.fillStyle = col;
        c.beginPath(); c.ellipse(cx, cy, rx * f, rx * f * SQ, 0, 0, Math.PI * 2); c.fill();
      });
      c.restore();
    },

    grass(c, W, H, R) {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#98d86f"); g.addColorStop(1, "#7cc257");
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 70; i++) {
        c.fillStyle = R() < 0.5 ? "rgba(172,226,132,0.45)" : "rgba(104,170,72,0.35)";
        const r = 2 + R() * 5;
        c.beginPath(); c.ellipse(R() * W, R() * H, r, r * SQ, 0, 0, Math.PI * 2); c.fill();
      }
      // a sand path winding up from Gobble's corner
      c.lineCap = "round";
      const path = () => { c.beginPath(); c.moveTo(W * 0.62, H + 2); c.bezierCurveTo(W * 0.9, H * 0.72, W * 0.35, H * 0.55, W * 0.62, H * 0.08); };
      c.strokeStyle = "#cdb57a"; c.lineWidth = 10.5; path(); c.stroke();
      c.strokeStyle = "#ead7a0"; c.lineWidth = 9; path(); c.stroke();
      // the checked picnic blanket (the food zone)
      const bx = W * 0.06, by = H * 0.46, bw = W * 0.42, bh = H * 0.28, n = 6, m = 5;
      c.fillStyle = "#ffffff"; c.fillRect(bx, by, bw, bh);
      c.fillStyle = "#ef4b5c";
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) if ((i + j) % 2 === 0) c.fillRect(bx + (i * bw) / n, by + (j * bh) / m, bw / n, bh / m);
      c.strokeStyle = "rgba(150,30,40,0.55)"; c.lineWidth = 0.6; c.strokeRect(bx, by, bw, bh);
      // a little pond with lily pads
      const px = W * 0.8, py = H * 0.84, pr = W * 0.12;
      c.fillStyle = "#4a9ed0"; c.beginPath(); c.ellipse(px, py, pr + 1, (pr + 1) * SQ, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#74c6f2"; c.beginPath(); c.ellipse(px, py, pr, pr * SQ, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#b8e6ff"; c.beginPath(); c.ellipse(px - pr * 0.3, py - pr * 0.2, pr * 0.35, pr * 0.1, -0.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#5daa45";
      for (const [dx, dy] of [[0.35, 0.1], [-0.2, 0.3]]) {
        c.beginPath(); c.moveTo(px + dx * pr, py + dy * pr * SQ);
        c.ellipse(px + dx * pr, py + dy * pr * SQ, 2.2, 1.5, 0, 0.3, Math.PI * 2 - 0.3); c.closePath(); c.fill();
      }
      // flowers and tufts
      for (let i = 0; i < 150; i++) {
        const x = R() * W, y = R() * H;
        c.strokeStyle = "rgba(80,150,55,0.65)"; c.lineWidth = 0.3;
        c.beginPath(); c.moveTo(x - 0.6, y - 1.2); c.lineTo(x, y); c.lineTo(x + 0.6, y - 1.3); c.stroke();
      }
      const petals = ["#ffffff", "#ffe066", "#ff9ecf"];
      for (let i = 0; i < 28; i++) {
        c.fillStyle = petals[i % 3];
        c.beginPath(); c.arc(R() * W, R() * H, 0.55, 0, Math.PI * 2); c.fill();
      }
    },

    dirt(c, W, H, R) {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#d4a56b"); g.addColorStop(1, "#c08c55");
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 70; i++) {
        c.fillStyle = R() < 0.5 ? "rgba(176,124,70,0.4)" : "rgba(226,186,130,0.4)";
        const r = 2 + R() * 6;
        c.beginPath(); c.ellipse(R() * W, R() * H, r, r * SQ, 0, 0, Math.PI * 2); c.fill();
      }
      // tyre tracks
      c.save(); c.strokeStyle = "rgba(125,82,42,0.55)"; c.lineWidth = 1.4; c.setLineDash([1.6, 1.1]);
      for (const off of [0, 4.5]) {
        c.beginPath(); c.moveTo(-4, H * 0.28 + off); c.bezierCurveTo(W * 0.35, H * 0.2 + off, W * 0.55, H * 0.9 + off, W + 4, H * 0.78 + off); c.stroke();
      }
      c.setLineDash([]); c.restore();
      // a gravel pile
      const gx = W * 0.78, gy = H * 0.18;
      for (let i = 0; i < 110; i++) {
        const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 11;
        const sh = 150 + Math.floor(R() * 70);
        c.fillStyle = "rgb(" + sh + "," + sh + "," + (sh - 8) + ")";
        c.beginPath(); c.arc(gx + Math.cos(a) * d, gy + Math.sin(a) * d * SQ, 0.45 + R() * 0.5, 0, Math.PI * 2); c.fill();
      }
      // hazard stripes all round the edge
      c.save();
      c.beginPath(); c.rect(0, 0, W, H); c.rect(2.6, 2.6, W - 5.2, H - 5.2);
      c.clip("evenodd");
      c.fillStyle = "#ffb703"; c.fillRect(0, 0, W, H);
      c.strokeStyle = "#343434"; c.lineWidth = 1.6;
      for (let k = -H; k < W + H; k += 4) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + H, H); c.stroke(); }
      c.restore();
    },

    town(c, W, H, R) {
      c.fillStyle = "#9bd46e"; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 50; i++) {
        c.fillStyle = R() < 0.5 ? "rgba(170,225,130,0.45)" : "rgba(110,175,78,0.3)";
        const r = 2 + R() * 4;
        c.beginPath(); c.ellipse(R() * W, R() * H, r, r * SQ, 0, 0, Math.PI * 2); c.fill();
      }
      const road = (x, y, w, h, vertical) => {
        c.fillStyle = "#d9d8d0";
        if (vertical) c.fillRect(x - 1.8, y, w + 3.6, h); else c.fillRect(x, y - 1.8, w, h + 3.6);
        c.fillStyle = "#5d6572"; c.fillRect(x, y, w, h);
        c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 0.35;
        c.beginPath();
        if (vertical) { c.moveTo(x + 0.8, y); c.lineTo(x + 0.8, y + h); c.moveTo(x + w - 0.8, y); c.lineTo(x + w - 0.8, y + h); }
        else { c.moveTo(x, y + 0.8); c.lineTo(x + w, y + 0.8); c.moveTo(x, y + h - 0.8); c.lineTo(x + w, y + h - 0.8); }
        c.stroke();
        c.save(); c.strokeStyle = "#ffd24d"; c.lineWidth = 0.55; c.setLineDash([3, 2.6]);
        c.beginPath();
        if (vertical) { c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); } else { c.moveTo(x, y + h / 2); c.lineTo(x + w, y + h / 2); }
        c.stroke(); c.setLineDash([]); c.restore();
      };
      road(W * 0.72, H * 0.34, W * 0.14, H * 0.66, true);
      road(0, H * 0.5, W, H * 0.16, false);
      // a zebra crossing
      c.fillStyle = "rgba(255,255,255,0.9)";
      for (let i = 0; i < 6; i++) c.fillRect(W * 0.3 + i * 2.2, H * 0.505, 1.2, H * 0.15);
      // little hedges
      c.fillStyle = "#6fb54e";
      for (let i = 0; i < 14; i++) {
        const x = R() * W, y = R() < 0.5 ? H * 0.47 : H * 0.7;
        c.beginPath(); c.arc(x, y, 1.1 + R() * 0.6, 0, Math.PI * 2); c.fill();
      }
    },

    party(c, W, H, R) {
      for (let y = 0, j = 0; y < H; y += 10, j++) {
        for (let x = 0, i = 0; x < W; x += 10, i++) {
          c.fillStyle = (i + j) % 2 ? "#ffe3ef" : "#fff5fa";
          c.fillRect(x, y, 10, 10);
        }
      }
      // a heart rug in the middle
      const cx = W / 2, cy = H * 0.58, rx = W * 0.38;
      c.fillStyle = "#ffc2dd"; c.beginPath(); c.ellipse(cx, cy, rx, rx * SQ, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#ff8fbf"; c.lineWidth = 0.8; c.stroke();
      const heart = (x, y, s) => {
        c.beginPath();
        c.moveTo(x, y + s * 0.9);
        c.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
        c.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
        c.fill();
      };
      c.fillStyle = "rgba(255,255,255,0.85)";
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) heart(cx + Math.cos(a) * rx * 0.72, cy + Math.sin(a) * rx * 0.72 * SQ, 1.6);
      c.fillStyle = "#ff5e7e"; heart(cx, cy, 3.4);
      const cols = ["#ff5e7e", "#ffd24d", "#5ec8ff", "#7be08a", "#c77dff", "#ffa64d"];
      for (let i = 0; i < 120; i++) {
        c.save();
        c.translate(R() * W, R() * H); c.rotate(R() * Math.PI);
        c.fillStyle = cols[i % cols.length];
        if (i % 3) c.fillRect(-0.6, -0.3, 1.2, 0.6); else { c.beginPath(); c.arc(0, 0, 0.45, 0, Math.PI * 2); c.fill(); }
        c.restore();
      }
    },

    space(c, W, H, R) {
      const g = c.createRadialGradient(W * 0.4, H * 0.35, 0, W * 0.4, H * 0.35, Math.max(W, H));
      g.addColorStop(0, "#2a2470"); g.addColorStop(1, "#0c0e2c");
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (const [x, y, r, col] of [[0.25, 0.3, 0.45, "rgba(255,122,192,0.20)"], [0.75, 0.62, 0.5, "rgba(94,200,255,0.14)"], [0.5, 0.9, 0.4, "rgba(199,125,255,0.20)"]]) {
        const n = c.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * W);
        n.addColorStop(0, col); n.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = n; c.fillRect(0, 0, W, H);
      }
      for (let i = 0; i < 190; i++) {
        c.fillStyle = "rgba(255,255,255," + (0.35 + R() * 0.65).toFixed(2) + ")";
        c.beginPath(); c.arc(R() * W, R() * H, 0.12 + R() * 0.32, 0, Math.PI * 2); c.fill();
      }
      c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 0.18;
      for (let i = 0; i < 14; i++) {
        const x = R() * W, y = R() * H, s = 0.8 + R() * 0.9;
        c.beginPath(); c.moveTo(x - s, y); c.lineTo(x + s, y); c.moveTo(x, y - s); c.lineTo(x, y + s); c.stroke();
      }
    },
  };

  // The island's front edge (the diorama's thickness) and backdrop per ground.
  const EDGE_TONE = {
    wood: ["#a4703d", "#8a5a2f"], grass: ["#8b5a2b", "#6e4420"], dirt: ["#9b6a3b", "#7d522b"],
    town: ["#7a5230", "#5f3f24"], party: ["#e59ac1", "#c8729f"], space: ["#2b2f6e", "#1a1d4a"],
  };

  // The hole's colours: Gobble's purple, or a black hole's glowing ring.
  const HOLES = {
    gobble: { deep: "#12071f", wall: "#3b1d6e", rim: "#7c4dff", hi: "#c2a8ff", lo: "#4f28b8" },
    blackhole: { deep: "#050208", wall: "#2a1540", rim: "#ff9f1c", hi: "#fff2b0", lo: "#d9480f", glow: "rgba(255,190,90,0.35)" },
  };

  function create(canvas) {
    const ctx = canvas.getContext("2d");
    let dpr = 1, cssW = 0, cssH = 0;
    let st = null, def = null;
    let view = { s: 1, ox: 0, oy: 0 };
    let bg = null, bgKey = "";
    const sprites = new Map();
    const fx = [];
    let clock = 0;             // seconds, from draw(now)
    let shakeT = 0;
    let happyUntil = 0, wideUntil = 0, lookUp = 0, blinkAt = 3, blinkUntil = 0;
    const hopUntil = new Map();
    let introAt = 0;
    let lastDraw = { objects: 0, falling: 0, ok: false };

    function resize() {
      const p = canvas.parentElement;
      const w = Math.max(1, Math.round(p ? p.clientWidth : canvas.clientWidth));
      const h = Math.max(1, Math.round(p ? p.clientHeight : canvas.clientHeight));
      const d = Math.min(2, global.devicePixelRatio || 1);
      if (w === cssW && h === cssH && d === dpr && canvas.width) return false;
      cssW = w; cssH = h; dpr = d;
      canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      fit(); bg = null;
      return true;
    }

    // The scale that shows a W×H scene (plus its margins) in this field.
    function scaleFor(W, H, w, h) {
      return Math.min(w / (W + 2 * MARGIN), h / (H + RULES.TOP_SLACK + THICK + 2 * MARGIN));
    }
    // Which scene aspect fills THIS field best (biggest scale wins).
    function bestAspect(w, h) {
      w = w || cssW; h = h || cssH;
      let best = 0.75, bs = -1;
      for (let a = RULES.ASPECT[0]; a <= RULES.ASPECT[1] + 1e-9; a += 0.01) {
        const W = Math.sqrt(RULES.AREA * a), H = Math.sqrt(RULES.AREA / a);
        const s = scaleFor(W, H, w, h);
        if (s > bs + 1e-9) { bs = s; best = Math.round(a * 100) / 100; }
      }
      return best;
    }
    function fit() {
      if (!st) return;
      const s = scaleFor(st.W, st.H, cssW, cssH);
      const usedH = (st.H + RULES.TOP_SLACK + THICK) * s;
      view = { s, ox: (cssW - st.W * s) / 2, oy: (cssH - usedH) / 2 + RULES.TOP_SLACK * s };
    }
    const sx = (x) => view.ox + x * view.s;
    const sy = (y) => view.oy + y * view.s;
    function toWorld(px, py) { return { x: (px - view.ox) / view.s, y: (py - view.oy) / view.s }; }
    function toScreen(x, y) { return { x: sx(x), y: sy(y) }; }

    function setState(next) {
      st = next;
      def = DATA.SCENES.find((d) => d.id === st.id) || DATA.SCENES[0];
      fit(); bg = null; fx.length = 0; hopUntil.clear();
      introAt = clock; shakeT = 0;
    }

    // ---- the baked background ----------------------------------------------
    function bake() {
      const key = [st.id, st.aspect, cssW, cssH, dpr].join("|");
      if (bg && bgKey === key) return bg;
      const cv = document.createElement("canvas");
      cv.width = canvas.width; cv.height = canvas.height;
      const c = cv.getContext("2d");
      c.scale(dpr, dpr);
      // backdrop
      const g = c.createLinearGradient(0, 0, 0, cssH);
      g.addColorStop(0, def.backdrop[0]); g.addColorStop(1, def.backdrop[1]);
      c.fillStyle = g; c.fillRect(0, 0, cssW, cssH);
      const R = rng(hashStr(def.id + ":bg"));
      if (def.ground === "space") {
        for (let i = 0; i < 90; i++) {
          c.fillStyle = "rgba(255,255,255," + (0.3 + R() * 0.6).toFixed(2) + ")";
          c.beginPath(); c.arc(R() * cssW, R() * cssH, 0.5 + R() * 1.2, 0, Math.PI * 2); c.fill();
        }
      } else if (def.ground === "wood" || def.ground === "party") {
        c.fillStyle = "rgba(255,255,255,0.45)";
        for (let y = 12; y < cssH; y += 26) for (let x = (y / 26) % 2 ? 12 : 25; x < cssW; x += 26) {
          c.beginPath(); c.arc(x, y, 2.2, 0, Math.PI * 2); c.fill();
        }
      } else {
        c.fillStyle = "rgba(255,255,255,0.85)";
        for (let i = 0; i < 4; i++) {
          const x = R() * cssW, y = 20 + R() * cssH * 0.9, r = 14 + R() * 12;
          for (const [dx, dy, k] of [[0, 0, 1], [r * 0.9, 4, 0.8], [-r * 0.9, 5, 0.7]]) {
            c.beginPath(); c.arc(x + dx, y + dy, r * k, 0, Math.PI * 2); c.fill();
          }
        }
      }
      // the diorama
      c.save();
      c.translate(view.ox, view.oy); c.scale(view.s, view.s);
      const W = st.W, H = st.H, rad = 4;
      const tone = EDGE_TONE[def.ground] || EDGE_TONE.wood;
      // soft drop shadow: stacked translucent fills (no ctx.filter on iOS 14)
      for (let k = 3; k >= 1; k--) {
        c.fillStyle = "rgba(0,0,0," + (0.05 * (4 - k)).toFixed(2) + ")";
        rrect(c, -k * 0.7 + 1.2, THICK + k * 0.9 - 0.5, W + k * 1.4, H, rad + k); c.fill();
      }
      // the front edge (thickness), with two earth layers
      c.fillStyle = tone[1]; rrect(c, 0, THICK, W, H, rad); c.fill();
      c.fillStyle = tone[0]; rrect(c, 0, THICK * 0.45, W, H, rad); c.fill();
      c.strokeStyle = "rgba(0,0,0,0.15)"; c.lineWidth = 0.4;
      c.beginPath(); c.moveTo(rad, H + THICK * 0.7); c.lineTo(W - rad, H + THICK * 0.7); c.stroke();
      // the top surface
      c.save();
      rrect(c, 0, 0, W, H, rad); c.clip();
      (GROUNDS[def.ground] || GROUNDS.wood)(c, W, H, rng(hashStr(def.id + ":ground")));
      // one light for the whole scene: from the upper left
      const lg = c.createLinearGradient(0, 0, W, H);
      lg.addColorStop(0, "rgba(255,255,255,0.14)"); lg.addColorStop(0.5, "rgba(255,255,255,0)"); lg.addColorStop(1, "rgba(0,0,0,0.10)");
      c.fillStyle = lg; c.fillRect(0, 0, W, H);
      c.restore();
      c.strokeStyle = def.ground === "space" ? "rgba(140,130,255,0.55)" : "rgba(255,255,255,0.55)";
      c.lineWidth = 0.6; rrect(c, 0.3, 0.3, W - 0.6, H - 0.6, rad); c.stroke();
      c.restore();
      bg = cv; bgKey = key;
      return bg;
    }

    // ---- sprites: each emoji rendered ONCE, cropped to its real ink ---------
    // measureText's ink box is not trustworthy across engines (the fort's
    // bed-glyph lesson), so the ink is found by scanning the pixels. A font
    // with no glyph yields no ink, and the object then draws as a coloured
    // ball rather than vanishing.
    function sprite(e, px) {
      const size = Math.max(8, Math.round(px / 4) * 4);   // device px, bucketed
      const key = e + "|" + size;
      let sp = sprites.get(key);
      if (sp) return sp;
      // bounded: a long session through many sizes (rotations, six scenes)
      // must not grow the cache without limit
      if (sprites.size > 260) sprites.clear();
      const pad = Math.ceil(size * 0.35) + 4;
      const box = size + pad * 2;
      const cv = document.createElement("canvas");
      cv.width = box; cv.height = box;
      const c = cv.getContext("2d");
      c.font = size + "px " + EMOJI_FONT;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(e, box / 2, box / 2);
      let x0 = box, y0 = box, x1 = -1, y1 = -1, n = 0, rs = 0, gs = 0, bs = 0;
      try {
        const d = c.getImageData(0, 0, box, box).data;
        for (let y = 0; y < box; y++) for (let x = 0; x < box; x++) {
          const i = (y * box + x) * 4;
          if (d[i + 3] > 24) {
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
            if (d[i + 3] > 200) { n++; rs += d[i]; gs += d[i + 1]; bs += d[i + 2]; }
          }
        }
      } catch (err) { x1 = -1; }
      let out, color;
      if (x1 < 0 || n < 8) {
        // no glyph: a coloured ball with a rim
        const hue = hashStr(e) % 360;
        out = document.createElement("canvas"); out.width = size; out.height = size;
        const o = out.getContext("2d");
        o.fillStyle = "hsl(" + hue + ",70%,60%)"; o.beginPath(); o.arc(size / 2, size / 2, size * 0.45, 0, Math.PI * 2); o.fill();
        o.strokeStyle = "hsl(" + hue + ",60%,30%)"; o.lineWidth = Math.max(1, size * 0.06); o.stroke();
        color = "hsl(" + hue + ",70%,60%)";
      } else {
        const w = x1 - x0 + 1, h = y1 - y0 + 1;
        out = document.createElement("canvas"); out.width = w; out.height = h;
        out.getContext("2d").drawImage(cv, x0, y0, w, h, 0, 0, w, h);
        color = "rgb(" + Math.round(rs / n) + "," + Math.round(gs / n) + "," + Math.round(bs / n) + ")";
      }
      sp = { cv: out, w: out.width, h: out.height, color, ink: x1 >= 0 && n >= 8 };
      sprites.set(key, sp);
      return sp;
    }
    // CSS-px size of an object's sprite: its larger ink side is VIS * r
    function drawSize(o) { return VIS * o.r * view.s; }

    function drawObject(o, x, y, rot, scale, alpha) {
      const target = drawSize(o) * scale;
      // The sprite is always the thing's FULL size, scaled at draw time: a
      // shrinking fall must not mint a new cached canvas for every size it
      // passes through (iOS Safari caps total canvas memory).
      const sp = sprite(o.e, drawSize(o) * dpr);
      const k = target / Math.max(sp.w, sp.h);
      const w = sp.w * k, h = sp.h * k;
      ctx.save();
      ctx.translate(x, y);
      if (rot) ctx.rotate(rot);
      if (alpha < 1) ctx.globalAlpha = alpha;
      ctx.drawImage(sp.cv, -w / 2, -h, w, h);
      ctx.restore();
    }

    // A SOFT contact shadow, from one pre-rendered sprite. A flat filled
    // ellipse under every thing read as a hard dark oval — the big things'
    // were 140px blobs, the "circles after circles" look the owner once
    // reported in the fort — so the falloff is a radial gradient that reaches
    // zero at the edge, stretched into the ground's 3/4 ellipse. One sprite,
    // drawn with drawImage: no per-frame gradient, no context filter (Safari 17).
    let shadowCv = null;
    function shadowSprite() {
      if (shadowCv) return shadowCv;
      const S = 64;
      shadowCv = document.createElement("canvas");
      shadowCv.width = S; shadowCv.height = S;
      const c = shadowCv.getContext("2d");
      const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.5, "rgba(0,0,0,0.6)"); g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g; c.fillRect(0, 0, S, S);
      return shadowCv;
    }
    function shadow(x, y, r, k) {
      const rx = r * view.s * 0.95 * k, ry = rx * SQ * 0.72;
      // the one light is upper-left, so a shadow falls a touch down-right
      ctx.globalAlpha = (def.ground === "space" ? 0.16 : 0.24) * k;
      ctx.drawImage(shadowSprite(), x - rx + rx * 0.12, y - ry + ry * 0.2, rx * 2, ry * 2);
      ctx.globalAlpha = 1;
    }

    // ---- the hole ------------------------------------------------------------
    function drawHole(now) {
      const h = st.hole, pal = HOLES[def.hole] || HOLES.gobble;
      const cx = sx(h.x), cy = sy(h.y), R = h.r * view.s, rx = R, ry = R * SQ;
      const chomp = happyUntil > now ? 1 + 0.06 * Math.sin((happyUntil - now) * 26) : 1;
      const lw = Math.max(2.5, R * 0.13);
      if (pal.glow) {
        ctx.fillStyle = pal.glow;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.35, ry * 1.35, 0, 0, Math.PI * 2); ctx.fill();
      }
      // the dark ring the ground sinks into
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.06, rx * 1.1 * chomp, ry * 1.12 * chomp, 0, 0, Math.PI * 2); ctx.fill();
      // the inside: dark at the bottom, the far wall catching a little light
      const g = ctx.createRadialGradient(cx, cy + ry * 0.35, 0, cx, cy + ry * 0.2, rx * 1.05);
      g.addColorStop(0, pal.deep); g.addColorStop(0.62, pal.deep); g.addColorStop(1, pal.wall);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * chomp, ry * chomp, 0, 0, Math.PI * 2); ctx.fill();
      // a slow swirl inside (still under reduced motion)
      ctx.save();
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2); ctx.clip();
      ctx.strokeStyle = def.hole === "blackhole" ? "rgba(255,190,90,0.18)" : "rgba(180,150,255,0.16)";
      ctx.lineWidth = Math.max(1, R * 0.05);
      const spin = reduceMotion() ? 0 : now * 1.4;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        for (let t = 0; t <= 1.001; t += 0.05) {
          const a = spin + k * 2.09 + t * 3.2, rr = (0.15 + t * 0.8) * rx;
          const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * SQ;
          if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
      // the back rim, then whatever is falling (so it sits in front of the
      // far wall), then the front lip over the top of it
      ctx.lineWidth = lw;
      ctx.strokeStyle = pal.lo;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * chomp, ry * chomp, 0, Math.PI, Math.PI * 2); ctx.stroke();
      drawFalling(cx, cy, rx * chomp, ry * chomp);
      ctx.strokeStyle = pal.rim;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * chomp, ry * chomp, 0, 0, Math.PI); ctx.stroke();
      ctx.strokeStyle = pal.hi; ctx.lineWidth = Math.max(1, lw * 0.35);
      ctx.beginPath(); ctx.ellipse(cx, cy - lw * 0.15, rx * chomp, ry * chomp, 0, 0.35, Math.PI - 0.35); ctx.stroke();
      drawEyes(now, cx, cy, R, ry);
    }

    // Falling things: clipped to the hole's mouth plus everything ABOVE its
    // middle, so a thing sinks behind the front lip while its top still pokes
    // up out of the ground.
    function drawFalling(cx, cy, rx, ry) {
      const h = st.hole;
      let n = 0;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.rect(cx - rx * 3, cy - cssH * 2, rx * 6, cssH * 2);
      ctx.clip();
      for (const o of st.objects) {
        if (o.st !== 1) continue;
        n++;
        const e = o.f * o.f;
        const x = sx(h.x + o.fx * (1 - e)), y = sy(h.y + o.fy * (1 - e));
        const sink = e * (drawSize(o) * 1.05 + ry * 0.7);
        const spin = (o.id % 2 ? 1 : -1) * o.f * 1.1;
        drawObject(o, x, y + sink, spin, 1 - 0.4 * o.f, 1);
      }
      ctx.restore();
      lastDraw.falling = n;
    }

    function drawEyes(now, cx, cy, R, ry) {
      const h = st.hole;
      const eR = clamp(R * 0.27, 7, 70);
      const ey = cy - ry - eR * 0.25;
      // look where Gobble is going, else at the nearest bite (or the hint)
      let lx = h.tx - h.x, ly = h.ty - h.y;
      if (Math.hypot(lx, ly) < 0.5) {
        const t = st.hint >= 0 ? st.objects[st.hint] : null;
        let best = t, bd = Infinity;
        if (!best) {
          for (const o of st.objects) {
            if (o.st !== 0 || o.r > h.r * RULES.FIT) continue;
            const d = Math.hypot(o.x - h.x, o.y - h.y);
            if (d < bd) { bd = d; best = o; }
          }
        }
        if (best) { lx = best.x - h.x; ly = best.y - h.y; }
      }
      const ll = Math.hypot(lx, ly) || 1;
      let px = lx / ll, py = ly / ll;
      if (lookUp > now) { px *= 0.3; py = -1; }
      if (!reduceMotion() && now > blinkAt) { blinkUntil = now + 0.12; blinkAt = now + 2.5 + ((now * 997) % 3); }
      const blink = blinkUntil > now;
      const happy = happyUntil > now, wide = wideUntil > now;
      const k = wide ? 1.22 : 1;
      for (const side of [-1, 1]) {
        const ex = cx + side * R * 0.42;
        const r = eR * k;
        ctx.save();
        ctx.translate(ex, ey);
        if (happy) {
          // ^ ^ — a happy squint after every gulp
          ctx.strokeStyle = "#1d1233"; ctx.lineWidth = Math.max(2, r * 0.3); ctx.lineCap = "round";
          ctx.beginPath(); ctx.arc(0, r * 0.35, r * 0.7, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        } else {
          ctx.scale(1, blink ? 0.12 : 1);
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#1d1233"; ctx.lineWidth = Math.max(1.5, r * 0.14);
          ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          if (!blink) {
            ctx.fillStyle = "#1d1233";
            ctx.beginPath(); ctx.arc(px * r * 0.36, py * r * 0.36, r * 0.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.beginPath(); ctx.arc(px * r * 0.36 - r * 0.17, py * r * 0.36 - r * 0.2, r * 0.16, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    // ---- effects -------------------------------------------------------------
    function event(ev) {
      if (!st || !ev) return;
      const h = st.hole;
      const now = clock;
      if (ev.type === "eat") {
        happyUntil = now + 0.35;
        const o = st.objects[ev.id];
        const sp = o ? sprite(o.e, drawSize(o) * dpr) : null;
        const n = 5 + Math.min(10, (ev.tier || 1) * 2);
        const rr = rng(hashStr("crumb" + ev.id));
        for (let i = 0; i < n; i++) {
          const a = -Math.PI * (0.15 + 0.7 * rr());
          fx.push({ k: "crumb", x: h.x, y: h.y, vx: Math.cos(a) * (10 + rr() * 18), vy: Math.sin(a) * (16 + rr() * 22),
            t0: now, life: 0.55 + rr() * 0.3, size: 0.5 + rr() * 0.6 + (ev.tier || 1) * 0.12, color: sp ? sp.color : "#ffd24d" });
        }
        if (ev.finale && !reduceMotion()) shakeT = now + 0.55;
      } else if (ev.type === "grow") {
        wideUntil = now + 0.8;
        fx.push({ k: "ring", x: h.x, y: h.y, t0: now, life: 0.7, r0: h.r });
        const rr = rng(hashStr("grow" + ev.level));
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          fx.push({ k: "star", x: h.x, y: h.y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30 * SQ - 8, t0: now, life: 0.8, size: 1.2 + rr() });
        }
        // the things that JUST became edible hop: "now you can eat us!"
        for (const o of st.objects) {
          if (o.st === 0 && o.tier === ev.level + 1) hopUntil.set(o.id, now + 0.55 + (o.id % 5) * 0.06);
        }
      } else if (ev.type === "bump") {
        lookUp = now + 0.6;
      } else if (ev.type === "win") {
        wideUntil = now + 1.5;
        fx.push({ k: "ring", x: h.x, y: h.y, t0: now, life: 1.1, r0: h.r * 1.1 });
        fx.push({ k: "burp", x: h.x, y: h.y, t0: now + 0.45, life: 1.2 });
      }
    }

    function drawFx(now) {
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i], t = now - f.t0;
        if (t > f.life) { fx.splice(i, 1); continue; }
        if (t < 0) continue;
        const p = t / f.life;
        if (f.k === "crumb") {
          const x = f.x + f.vx * t, y = f.y + f.vy * t + 40 * t * t;
          ctx.globalAlpha = 1 - p;
          ctx.fillStyle = f.color;
          ctx.beginPath(); ctx.arc(sx(x), sy(y), f.size * view.s, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        } else if (f.k === "ring") {
          const r = (f.r0 * (1 + p * 0.9)) * view.s;
          ctx.strokeStyle = "rgba(255,215,90," + (1 - p).toFixed(3) + ")";
          ctx.lineWidth = Math.max(2, 6 * (1 - p));
          ctx.beginPath(); ctx.ellipse(sx(f.x), sy(f.y), r, r * SQ, 0, 0, Math.PI * 2); ctx.stroke();
        } else if (f.k === "star") {
          const x = sx(f.x + f.vx * t), y = sy(f.y + f.vy * t);
          const s = f.size * view.s * (1 - p * 0.5);
          ctx.fillStyle = "rgba(255,230,120," + (1 - p).toFixed(3) + ")";
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2, rr = k % 2 ? s * 0.4 : s * 1.3;
            ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          }
          ctx.closePath(); ctx.fill();
        } else if (f.k === "burp") {
          // a burp: puffs rising from the hole
          const h = st.hole;
          for (let k = 0; k < 4; k++) {
            const q = clamp(p * 1.3 - k * 0.12, 0, 1);
            if (q <= 0) continue;
            const r = (4 + k * 2) * view.s * (0.5 + q);
            ctx.fillStyle = "rgba(255,255,255," + (0.85 * (1 - q)).toFixed(3) + ")";
            ctx.beginPath(); ctx.arc(sx(h.x + (k - 1.5) * 4), sy(h.y - h.r * SQ - q * 18 - k * 3), r, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }

    function drawHint(now) {
      if (!st || st.hint < 0 || st.won) return;
      const o = st.objects[st.hint];
      if (!o || o.st !== 0) return;
      const h = st.hole;
      const x0 = sx(h.x), y0 = sy(h.y - h.r * SQ), x1 = sx(o.x), y1 = sy(o.y - o.r);
      const L = Math.hypot(x1 - x0, y1 - y0);
      const gap = 14, phase = reduceMotion() ? 0 : (now * 40) % gap;
      ctx.fillStyle = "rgba(255,225,90,0.95)";
      for (let d = phase; d < L - 6; d += gap) {
        const t = d / L;
        ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 3.2, 0, Math.PI * 2); ctx.fill();
      }
      const pulse = reduceMotion() ? 1 : 1 + 0.15 * Math.sin(now * 8);
      const r = o.r * view.s * 1.25 * pulse;
      ctx.strokeStyle = "rgba(255,225,90,0.95)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(sx(o.x), sy(o.y), r, r * SQ, 0, 0, Math.PI * 2); ctx.stroke();
    }

    // ---- a frame ---------------------------------------------------------------
    function draw(now) {
      clock = now;
      if (!st || !cssW) return;
      const img = bake();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (shakeT > now) {
        const a = (shakeT - now) * 9;
        ctx.translate(Math.sin(now * 80) * a, Math.cos(now * 67) * a * 0.6);
      }
      const h = st.hole;
      const rm = reduceMotion();
      const intro = rm ? 1 : clamp((now - introAt) / 0.9, 0, 1);
      // painter's order: every standing thing, and the hole as one more item
      const items = [];
      let drawn = 0;
      for (const o of st.objects) {
        if (o.st !== 0) continue;
        const near = Math.hypot(o.x - h.x, (o.y - h.y) / SQ) < h.r + o.r;
        // a thing ON the rim (too big, or being pulled) draws over the hole
        items.push({ y: near ? Math.max(o.y, h.y + 0.01) : o.y, o });
      }
      items.push({ y: h.y, hole: true });
      items.sort((a, b) => a.y - b.y || (a.hole ? 1 : 0) - (b.hole ? 1 : 0));
      // Each thing's motion this frame, worked out once for both passes.
      for (const it of items) {
        if (it.hole) continue;
        const o = it.o;
        // the scene builds itself: things drop in, nearest to Gobble first
        const delay = Math.min(0.5, Math.hypot(o.x - st.start.x, o.y - st.start.y) / 300);
        it.q = clamp((intro * 0.9 - delay) / 0.4, 0, 1);
        it.drop = (1 - it.q) * (1 - it.q) * 30;
        it.lift = 0; it.rot = 0;
        const hop = hopUntil.get(o.id);
        if (hop && hop > now && !rm) it.lift = Math.sin(((hop - now) / 0.55) * Math.PI) * o.r * 0.6 * view.s;
        if (o.wob > 0) it.rot = Math.sin(now * 38) * 0.16 * (o.wob / 0.45) * (rm ? 0.3 : 1);
        else if (o.pull > 0) it.rot = clamp((h.x - o.x) / (o.r + h.r), -1, 1) * 0.4 * o.pull;
      }
      // Pass 1: every shadow, as one ground layer — so no shadow ever darkens a
      // thing standing behind it. A hopping thing's shadow stays on the ground
      // and shrinks a little: that is what makes the hop read as a jump.
      for (const it of items) {
        if (it.hole || it.q <= 0) continue;
        const k = it.q * (1 - clamp(it.lift / (it.o.r * view.s * 3), 0, 0.35));
        shadow(sx(it.o.x), sy(it.o.y), it.o.r, k);
      }
      // Pass 2: the things and the hole, back to front.
      for (const it of items) {
        if (it.hole) { drawHole(now); continue; }
        if (it.q <= 0) continue;
        const o = it.o;
        drawObject(o, sx(o.x), sy(o.y) - it.lift - it.drop, it.rot, 1, it.q);
        drawn++;
      }
      drawHint(now);
      drawFx(now);
      lastDraw = { objects: drawn, falling: lastDraw.falling, ok: true };
    }

    function info() {
      return {
        view: { ...view }, css: [cssW, cssH], dpr, sprites: sprites.size, fx: fx.length,
        shaking: shakeT > clock, drawn: lastDraw, inkless: [...sprites.values()].filter((s) => !s.ink).length,
      };
    }

    return { resize, setState, draw, event, toWorld, toScreen, bestAspect, info };
  }

  global.HoleRender = { create };
})(typeof window !== "undefined" ? window : globalThis);
