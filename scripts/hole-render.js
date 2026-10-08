// Gobble Hole — the canvas renderer (PLAN_GOBBLE.md §7 and §9.6). It READS the
// engine's state and never changes it.
//
// A place is a BIG world and the canvas is a CAMERA onto it (§9): the camera
// follows Gobble, pulls back as he grows (how much world it shows is
// HoleLogic.viewSpan — the same curve as his speed), opens every place with a
// look at the whole island, and pulls back to the whole island again for the
// win. A baked picture of the whole world at play zoom would be tens of
// megapixels, so the ground is drawn every frame instead, cheaply:
//   - its TEXTURE is vector marks (plank seams, tufts, stars) drawn straight
//     onto the canvas, square by square, fewer as the camera pulls back —
//     never a bitmap pattern, which a software rasteriser filters per pixel;
//   - its FEATURES (rugs, blankets, roads, ponds …) are vector decals in world
//     units, drawn only when on screen;
//   - things are drawn only when on screen; every emoji's ink box is measured
//     ONCE, and sprites come in half-octave size steps, so a zoom never mints
//     a new canvas per frame.
//
// Phase 4 (§14): an island is any SHAPE — a heart, a spiral, a ring of
// islands, a maze — so it is drawn from its OUTLINE, the closed rings the
// engine traces round its land (HoleLogic.outlineOf); walls of the shape
// (hedges, shelves, rock) stand up as raised blocks, and bridges, currents
// and slides, tracks, portals and the dark are each drawn by their own pass.
//
// iOS 14.2 floor: no roundRect on the 2D context (Safari 16), no context
// filter (Safari 17), no OffscreenCanvas — every rounded edge is a traced
// outline, shadows are pre-rendered soft sprites, every emoji is rendered into
// a plain <canvas>, and the floor is solid fills and small vector marks.

(function (global) {
  "use strict";
  const DATA = global.HoleData, L = global.HoleLogic;
  const RULES = DATA.RULES;
  const SQ = RULES.SQ;
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  // A sprite's ink is scaled so its LARGER side is VIS * r: a bus is that
  // wide, a tower that tall, and every thing reads as the size it eats as.
  const VIS = 2.3;
  const THICK = 6;       // the island's front edge (world units)
  const MARGIN = 8;      // the camera may look this far past the island's edge
  const TILE = 64;       // the floor's marks are drawn in squares this many world units wide
  const INK_REF = 128;   // every emoji's ink box is measured once, at this font size
  const INTRO_S = 1.6;   // the opening look at the whole island, then in to Gobble
  // …which first RESTS on the whole island: with twenty-four places of their
  // own shapes (a heart, a spiral, a ring of islands), the opening look is the
  // moment a child sees what shape this place is and where its finale stands.
  // It used to start flying in on its very first frame. A finger ends it at
  // once, so an eager child never waits.
  const INTRO_HOLD = 0.6;
  const ARROW_R = 30;    // the edge arrow's bubble (css px); it is tapped within ARROW_R + 16
  const NO_BITE_AFTER = 1.2;   // seconds with nothing edible on screen before the arrow shows
  const GOAL_R = 36;     // the GOAL's bubble is bigger: it is what he is here for (§12)
  // Gold: the goal's beacon, its bubble, and the three treasures (§12). Each
  // gold mark is drawn twice, a dark band under a bright one, so it reads on
  // every floor from the snow to the night sky (the fort's dark-under-bright law).
  const GOLD = { rim: "#e0a100", hi: "#ffd24d", dark: "rgba(110,60,0,", bright: "rgba(255,206,48," };
  const GOAL_HOP = 1.6;  // the goal hops every GOAL_HOP seconds while it is on screen
  // Gobble's googly eyes: their radius for a hole R css px across, and how far
  // the top of his face stands above the hole's middle at its widest (the
  // wide-eyed look of a grow). drawEyes and the camera share these, so the
  // camera's headroom can never fall behind a bigger pair of eyes.
  const EYE = { k: 0.27, min: 7, max: 70, wide: 1.22 };
  const eyeR = (R) => clamp(R * EYE.k, EYE.min, EYE.max);
  // Once he is big enough for the finale Gobble wears a CROWN, sitting on top
  // of his eyes: its size and where its middle stands above the eyes' line.
  const CROWN = { size: 2.0, lift: 1.1 * EYE.wide + 0.15 };
  // …and whatever he WEARS in this place (§15.2): each kind says how far above
  // the eyes' line it reaches, at its widest (a grow's wide eyes lift the hat
  // with them). A hat gives way to the crown; a thing at his side stays.
  function faceUp(R, crowned, wear) {
    const e = eyeR(R), r = e * EYE.wide, line = R * SQ + e * 0.25;
    let top = line + r * 1.1 + Math.max(1.5, r * 0.14) / 2;
    const w = wear && WEAR[wear[0]];
    if (w && !(crowned && w.slot === "top")) top = Math.max(top, line + w.up(r, R * 0.42));
    return crowned ? Math.max(top, line + e * CROWN.lift + e * CROWN.size * 0.5) : top;
  }

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
  const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  const reduceMotion = () => {
    try { return !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (e) { return false; }
  };

  // A smooth curve through points (midpoint quadratics).
  function smoothPath(c, pts) {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      c.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    }
    c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  }
  function ellipse(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
  // An n-pointed star (a twinkle when n is 4).
  function starPath(c, x, y, R, r, n, a0) {
    c.beginPath();
    for (let k = 0; k < n * 2; k++) {
      const a = (a0 || -Math.PI / 2) + (k * Math.PI) / n, rr = k % 2 ? r : R;
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
  }

  // A heart on (x, y) at size s: its lobes reach y - 0.59s, its point
  // y + 0.95s, and it is 1.59s wide (a sweet's heart eyes, §15.3).
  function heartPath(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y + s * 0.95);
    c.bezierCurveTo(x - s * 1.25, y + s * 0.1, x - s * 0.85, y - s * 1.05, x, y - s * 0.4);
    c.bezierCurveTo(x + s * 0.85, y - s * 1.05, x + s * 1.25, y + s * 0.1, x, y + s * 0.95);
    c.closePath();
  }

  // ---- What Gobble WEARS in each place (PLAN_GOBBLE.md §15.2) ----------------
  // Drawn on the canvas in his own outline style — never an emoji, so a hat
  // can never be mistaken for a thing to eat. Every kind is drawn round the
  // eyes' line: x is the middle of his face, y the eyes' centres, e an eye's
  // radius and sp half the distance between the eyes (all css px). A "top"
  // thing sits on his head and gives way to the CROWN once he is big enough
  // for the finale; a "side" thing stays. Each kind's `up` says how far above
  // the eyes' line its ink reaches: the camera keeps that much headroom (so a
  // tall wizard's hat is never cut off at the island's top edge), and a test
  // draws every kind and checks its ink never goes higher than it says.
  const OUTLINE = "#1d1233";
  const wl = (e) => Math.max(1.2, e * 0.11);
  const halfW = (e, sp) => (sp + e) * 0.92;   // a hat spans both eyes
  function shade(hex, k) {
    // lighten (k > 0) or darken (k < 0) a #rrggbb colour
    const n = parseInt(String(hex).slice(1), 16);
    const f = (v) => clamp(Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)), 0, 255);
    const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function fillLine(c, fill, e) {
    c.fillStyle = fill; c.fill();
    c.lineWidth = wl(e); c.strokeStyle = OUTLINE; c.stroke();
  }
  // a rounded rectangle traced with arcTo (ctx.roundRect is Safari 16)
  function rrect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  // the top half of an ellipse, closed along its base
  function dome(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, Math.PI, Math.PI * 2); c.closePath(); }
  const base = (e) => e * 0.9;   // a hat's base sits just above the eyes' tops
  const WEAR = {
    cap: {
      slot: "top", up: (e, sp) => base(e) + halfW(e, sp) * 0.66 + e * 0.22,
      draw(c, x, y, e, sp, col, col2) {
        const hw = halfW(e, sp), by = y - base(e);
        // the peak, sticking out to his right
        ellipse(c, x + hw * 0.78, by, hw * 0.62, hw * 0.16); fillLine(c, shade(col, -0.25), e);
        dome(c, x, by, hw, hw * 0.62); fillLine(c, col, e);
        c.beginPath(); c.moveTo(x, by); c.lineTo(x, by - hw * 0.62); c.lineWidth = wl(e) * 0.8; c.strokeStyle = shade(col, -0.35); c.stroke();
        ellipse(c, x, by - hw * 0.62, e * 0.2, e * 0.14); fillLine(c, shade(col, -0.2), e);
        if (col2) { ellipse(c, x - hw * 0.42, by - hw * 0.3, hw * 0.2, hw * 0.16); fillLine(c, col2, e); }   // a badge (the pilot's)
      },
    },
    straw: {
      slot: "top", up: (e, sp) => base(e) + halfW(e, sp) * 0.62,
      draw(c, x, y, e, sp, col) {
        const hw = halfW(e, sp), by = y - base(e);
        ellipse(c, x, by, hw * 1.32, hw * 0.3); fillLine(c, "#f2d07a", e);
        dome(c, x, by - hw * 0.05, hw * 0.72, hw * 0.57); fillLine(c, "#f5d98a", e);
        c.fillStyle = col; c.fillRect(x - hw * 0.71, by - hw * 0.22, hw * 1.42, hw * 0.17);
        c.lineWidth = wl(e) * 0.6; c.strokeStyle = "rgba(150,110,40,0.55)";
        for (const k of [-0.5, -0.15, 0.2, 0.55]) { c.beginPath(); c.moveTo(x + hw * k, by - hw * 0.25); c.lineTo(x + hw * k * 0.8, by - hw * 0.5); c.stroke(); }
      },
    },
    hardhat: {
      slot: "top", up: (e, sp) => base(e) + halfW(e, sp) * 0.74,
      draw(c, x, y, e, sp, col) {
        const hw = halfW(e, sp), by = y - base(e);
        dome(c, x, by, hw * 0.98, hw * 0.74); fillLine(c, col, e);
        c.fillStyle = shade(col, 0.35); c.fillRect(x - hw * 0.12, by - hw * 0.72, hw * 0.24, hw * 0.7);
        ellipse(c, x, by, hw * 1.16, hw * 0.15); fillLine(c, shade(col, -0.12), e);
      },
    },
    party: {
      slot: "top", up: (e, sp) => base(e) + halfW(e, sp) * 1.3 + halfW(e, sp) * 0.2,
      draw(c, x, y, e, sp, col) {
        const hw = halfW(e, sp), by = y - base(e), ax = x + hw * 0.12, ay = by - hw * 1.3;
        c.beginPath(); c.moveTo(x - hw * 0.62, by); c.lineTo(ax, ay); c.lineTo(x + hw * 0.62, by); c.closePath();
        c.save(); c.clip();
        c.fillStyle = col; c.fillRect(x - hw, ay - 2, hw * 2, by - ay + 4);
        c.fillStyle = "#ffd24d";
        for (const k of [0.25, 0.6]) { c.beginPath(); c.moveTo(x - hw, by - hw * 1.3 * k); c.lineTo(x + hw, by - hw * 1.3 * k - hw * 0.35); c.lineTo(x + hw, by - hw * 1.3 * k - hw * 0.12); c.lineTo(x - hw, by - hw * 1.3 * k + hw * 0.23); c.closePath(); c.fill(); }
        c.restore();
        c.beginPath(); c.moveTo(x - hw * 0.62, by); c.lineTo(ax, ay); c.lineTo(x + hw * 0.62, by); c.closePath();
        c.lineWidth = wl(e); c.strokeStyle = OUTLINE; c.stroke();
        c.beginPath(); c.arc(ax, ay, hw * 0.19, 0, Math.PI * 2); fillLine(c, "#ffffff", e);
      },
    },
    propeller: {
      slot: "top", up: (e, sp) => base(e) + halfW(e, sp) * (0.58 + 0.3 + 0.13),
      draw(c, x, y, e, sp, col, col2, now) {
        const hw = halfW(e, sp), by = y - base(e), ry = hw * 0.58;
        dome(c, x, by, hw * 0.9, ry);
        c.save(); c.clip();
        const cols = [col, "#ffd24d", "#5ec8ff", "#7be08a"];
        for (let k = 0; k < 4; k++) { c.fillStyle = cols[k]; c.fillRect(x - hw * 0.9 + k * hw * 0.45, by - ry - 1, hw * 0.45 + 1, ry + 2); }
        c.restore();
        dome(c, x, by, hw * 0.9, ry); c.lineWidth = wl(e); c.strokeStyle = OUTLINE; c.stroke();
        const ty = by - ry - hw * 0.3;
        c.beginPath(); c.moveTo(x, by - ry); c.lineTo(x, ty); c.lineWidth = Math.max(1.5, e * 0.14); c.strokeStyle = OUTLINE; c.stroke();
        // the propeller turns (still under reduced motion)
        const sw = Math.abs(Math.cos((now || 0) * 9));
        ellipse(c, x, ty, Math.max(hw * 0.1, hw * 0.75 * sw), hw * 0.13); fillLine(c, col, e);
        ellipse(c, x, ty, e * 0.16, e * 0.16); fillLine(c, "#ffd24d", e);
      },
    },
    bobble: {
      slot: "top", up: (e, sp) => base(e) + halfW(e, sp) * (0.82 + 0.24) + halfW(e, sp) * 0.25,
      draw(c, x, y, e, sp, col) {
        const hw = halfW(e, sp), by = y - base(e), ry = hw * 0.82;
        dome(c, x, by - hw * 0.12, hw * 0.92, ry);
        c.save(); c.clip();
        c.fillStyle = col; c.fillRect(x - hw, by - hw * 1.2, hw * 2, hw * 1.2);
        c.fillStyle = "#ffffff";
        for (const k of [0.45, 0.72]) c.fillRect(x - hw, by - hw * 0.12 - ry * k, hw * 2, hw * 0.1);
        c.restore();
        dome(c, x, by - hw * 0.12, hw * 0.92, ry); c.lineWidth = wl(e); c.strokeStyle = OUTLINE; c.stroke();
        // the rolled band
        rrect(c, x - hw, by - hw * 0.24, hw * 2, hw * 0.3, hw * 0.12);
        fillLine(c, shade(col, 0.55), e);
        // the bobble
        const py = by - hw * 0.12 - ry - hw * 0.08;
        c.beginPath(); c.arc(x, py, hw * 0.25, 0, Math.PI * 2); fillLine(c, "#ffffff", e);
      },
    },
    bubble: {
      // a space helmet: a glass dome over his eyes, an antenna with a light
      slot: "top", up: (e, sp) => (sp + e * 1.45) - e * 0.95 + e * 0.6 + e * 0.2 + e * 0.12,
      draw(c, x, y, e, sp, col, col2, now) {
        const rb = sp + e * 1.45, cy = y + e * 0.95;
        c.beginPath(); c.ellipse(x, cy, rb, rb, 0, Math.PI, Math.PI * 2); c.closePath();
        c.fillStyle = "rgba(190,230,255,0.22)"; c.fill();
        c.lineWidth = Math.max(2, e * 0.2); c.strokeStyle = "rgba(235,248,255,0.95)"; c.stroke();
        c.beginPath(); c.ellipse(x, cy, rb * 0.82, rb * 0.82, 0, Math.PI * 1.15, Math.PI * 1.45);
        c.lineWidth = Math.max(2, e * 0.22); c.strokeStyle = "rgba(255,255,255,0.75)"; c.stroke();
        ellipse(c, x, cy, rb * 1.02, e * 0.32); fillLine(c, col, e);
        const top = cy - rb;
        c.beginPath(); c.moveTo(x, top); c.lineTo(x, top - e * 0.6); c.lineWidth = Math.max(1.5, e * 0.12); c.strokeStyle = OUTLINE; c.stroke();
        const on = reduceMotion() || ((now || 0) % 1.2) < 0.7;
        c.beginPath(); c.arc(x, top - e * 0.6, e * 0.2, 0, Math.PI * 2); fillLine(c, on ? "#ff5e7e" : "#a33a52", e);
      },
    },
    chef: {
      slot: "top", up: (e, sp) => base(e) + halfW(e, sp) * (0.3 + 0.42 + 0.48),
      draw(c, x, y, e, sp) {
        const hw = halfW(e, sp), by = y - base(e), bt = by - hw * 0.3;
        const puffs = [[-0.42, 0.42], [0, 0.48], [0.42, 0.42]];
        for (const [k, r] of puffs) { c.beginPath(); c.arc(x + hw * k, bt - hw * 0.42, hw * r, 0, Math.PI * 2); c.lineWidth = wl(e) * 2; c.strokeStyle = OUTLINE; c.stroke(); }
        for (const [k, r] of puffs) { c.beginPath(); c.arc(x + hw * k, bt - hw * 0.42, hw * r, 0, Math.PI * 2); c.fillStyle = "#ffffff"; c.fill(); }
        c.beginPath(); c.rect(x - hw * 0.72, bt, hw * 1.44, hw * 0.3); fillLine(c, "#f4f4f8", e);
      },
    },
    wizard: {
      slot: "top", up: (e, sp) => base(e) + halfW(e, sp) * 1.42,
      draw(c, x, y, e, sp, col) {
        const hw = halfW(e, sp), by = y - base(e);
        ellipse(c, x, by, hw * 1.14, hw * 0.2); fillLine(c, shade(col, -0.2), e);
        c.beginPath(); c.moveTo(x - hw * 0.56, by - hw * 0.05);
        c.quadraticCurveTo(x - hw * 0.1, by - hw * 0.9, x + hw * 0.42, by - hw * 1.38);
        c.quadraticCurveTo(x + hw * 0.18, by - hw * 0.7, x + hw * 0.56, by - hw * 0.05);
        c.closePath(); fillLine(c, col, e);
        c.fillStyle = "#ffd24d"; c.fillRect(x - hw * 0.55, by - hw * 0.2, hw * 1.1, hw * 0.13);
        for (const [k, j, r] of [[-0.18, 0.55, 0.13], [0.16, 0.85, 0.1], [0.05, 0.35, 0.09]]) {
          starPath(c, x + hw * k, by - hw * j, hw * r, hw * r * 0.42, 5); c.fillStyle = "#ffe36e"; c.fill();
        }
      },
    },
    knight: {
      slot: "top", up: (e, sp) => base(e) + halfW(e, sp) * (0.8 + 0.58),
      draw(c, x, y, e, sp, col) {
        const hw = halfW(e, sp), by = y - base(e), ry = hw * 0.8;
        // the plume, sweeping back, behind the helmet
        c.beginPath();
        c.moveTo(x + hw * 0.14, by - ry * 0.88);
        c.quadraticCurveTo(x + hw * 0.08, by - ry - hw * 0.66, x - hw * 0.7, by - ry - hw * 0.22);
        c.quadraticCurveTo(x - hw * 0.24, by - ry - hw * 0.06, x - hw * 0.1, by - ry * 0.84);
        c.closePath(); fillLine(c, col, e);
        c.lineWidth = Math.max(1, e * 0.08); c.strokeStyle = shade(col, 0.35);
        for (const k of [0.3, 0.55]) {
          c.beginPath(); c.moveTo(x + hw * 0.02, by - ry * 0.95);
          c.quadraticCurveTo(x - hw * 0.1 * k, by - ry - hw * 0.4 * k, x - hw * 0.55 * k - hw * 0.1, by - ry - hw * 0.2); c.stroke();
        }
        dome(c, x, by, hw * 0.95, ry); fillLine(c, "#b8c2cc", e);
        c.fillStyle = "#e3e9ef"; c.fillRect(x - hw * 0.1, by - ry * 0.95, hw * 0.2, ry * 0.92);
        c.beginPath(); c.rect(x - hw * 0.95, by - hw * 0.16, hw * 1.9, hw * 0.16); fillLine(c, "#8d99a6", e);
      },
    },
    tophat: {
      slot: "top", up: (e, sp) => base(e) + halfW(e, sp) * (1.25 + 0.14),
      draw(c, x, y, e, sp, col) {
        const hw = halfW(e, sp), by = y - base(e), h = hw * 1.25;
        ellipse(c, x, by, hw * 1.0, hw * 0.2); fillLine(c, shade(col, -0.3), e);
        c.beginPath(); c.rect(x - hw * 0.6, by - h, hw * 1.2, h); fillLine(c, col, e);
        ellipse(c, x, by - h, hw * 0.6, hw * 0.14); fillLine(c, shade(col, 0.2), e);
        c.beginPath(); c.rect(x - hw * 0.6, by - hw * 0.36, hw * 1.2, hw * 0.2); fillLine(c, "#ffd24d", e);
        c.fillStyle = "rgba(255,255,255,0.28)"; c.fillRect(x - hw * 0.42, by - h + hw * 0.12, hw * 0.12, h - hw * 0.55);
      },
    },
    explorer: {
      slot: "top", up: (e, sp) => base(e) + halfW(e, sp) * 0.7 + e * 0.32,
      draw(c, x, y, e, sp, col) {
        const hw = halfW(e, sp), by = y - base(e), ry = hw * 0.7;
        ellipse(c, x, by + hw * 0.02, hw * 1.25, hw * 0.24); fillLine(c, shade(col, -0.1), e);
        dome(c, x, by, hw * 0.86, ry); fillLine(c, col, e);
        c.fillStyle = shade(col, -0.32); c.fillRect(x - hw * 0.84, by - hw * 0.2, hw * 1.68, hw * 0.14);
        ellipse(c, x, by - ry, e * 0.2, e * 0.14); fillLine(c, shade(col, -0.2), e);
      },
    },
    pirate: {
      slot: "top", up: (e, sp) => base(e) + halfW(e, sp) * 0.98,
      draw(c, x, y, e, sp, col) {
        const hw = halfW(e, sp), by = y - base(e);
        c.beginPath();
        c.moveTo(x - hw * 1.2, by - hw * 0.05);
        c.quadraticCurveTo(x - hw * 1.15, by - hw * 0.95, x - hw * 0.5, by - hw * 0.82);
        c.quadraticCurveTo(x, by - hw * 1.05, x + hw * 0.5, by - hw * 0.82);
        c.quadraticCurveTo(x + hw * 1.15, by - hw * 0.95, x + hw * 1.2, by - hw * 0.05);
        c.quadraticCurveTo(x, by + hw * 0.18, x - hw * 1.2, by - hw * 0.05);
        c.closePath(); fillLine(c, col, e);
        c.lineWidth = Math.max(1.5, e * 0.14); c.strokeStyle = "#ffd24d";
        c.beginPath(); c.moveTo(x - hw * 1.05, by - hw * 0.12); c.quadraticCurveTo(x, by + hw * 0.08, x + hw * 1.05, by - hw * 0.12); c.stroke();
        // a skull and crossbones
        const sx0 = x, sy0 = by - hw * 0.48, s = hw * 0.18;
        c.lineWidth = Math.max(1.5, s * 0.45); c.strokeStyle = "#ffffff"; c.lineCap = "round";
        c.beginPath(); c.moveTo(sx0 - s * 1.5, sy0 - s * 0.6); c.lineTo(sx0 + s * 1.5, sy0 + s * 1.6); c.moveTo(sx0 + s * 1.5, sy0 - s * 0.6); c.lineTo(sx0 - s * 1.5, sy0 + s * 1.6); c.stroke();
        c.lineCap = "butt";
        c.beginPath(); c.arc(sx0, sy0, s, 0, Math.PI * 2); c.fillStyle = "#ffffff"; c.fill();
        c.fillStyle = col;
        c.beginPath(); c.arc(sx0 - s * 0.38, sy0 - s * 0.05, s * 0.26, 0, Math.PI * 2); c.arc(sx0 + s * 0.38, sy0 - s * 0.05, s * 0.26, 0, Math.PI * 2); c.fill();
      },
    },
    halo: {
      slot: "top", up: (e, sp) => e * 2.1 + (sp * 0.8 + e * 0.7) * 0.28 + e * 0.25 + e * 0.15,
      draw(c, x, y, e, sp, col, col2, now) {
        const bob = reduceMotion() ? 0 : Math.sin((now || 0) * 2.2) * e * 0.12;
        const rx = sp * 0.8 + e * 0.7, ry = rx * 0.28, hy = y - e * 2.1 + bob;
        ellipse(c, x, hy, rx, ry); c.lineWidth = e * 0.5; c.strokeStyle = "rgba(255,226,120,0.35)"; c.stroke();
        ellipse(c, x, hy, rx, ry); c.lineWidth = Math.max(2, e * 0.26); c.strokeStyle = col; c.stroke();
      },
    },
    flower: {
      slot: "side", up: (e) => e * 1.05 + e * 0.95 + e * 0.06,
      draw(c, x, y, e, sp, col) {
        const fx = x + sp + e * 0.8, fy = y - e * 1.05;
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          c.beginPath(); c.ellipse(fx + Math.cos(a) * e * 0.52, fy + Math.sin(a) * e * 0.52, e * 0.42, e * 0.25, a, 0, Math.PI * 2);
          fillLine(c, col, e * 0.8);
        }
        c.beginPath(); c.arc(fx, fy, e * 0.32, 0, Math.PI * 2); fillLine(c, "#ffc93c", e * 0.8);
      },
    },
    bow: {
      slot: "side", up: (e) => e * 1.15 + e * 0.5 + e * 0.08,
      draw(c, x, y, e, sp, col) {
        const bx = x + sp + e * 0.75, by = y - e * 1.15;
        for (const s of [-1, 1]) {
          c.beginPath(); c.moveTo(bx, by);
          c.quadraticCurveTo(bx + s * e * 1.15, by - e * 0.95, bx + s * e * 1.25, by);
          c.quadraticCurveTo(bx + s * e * 1.15, by + e * 0.95, bx, by);
          c.closePath(); fillLine(c, col, e);
        }
        c.beginPath(); c.arc(bx, by, e * 0.3, 0, Math.PI * 2); fillLine(c, shade(col, -0.2), e);
      },
    },
    headphones: {
      slot: "side", up: (e, sp) => (sp + e * 1.18) * 1.0 + e * 0.2,
      draw(c, x, y, e, sp, col) {
        const rh = sp + e * 1.18;
        c.beginPath(); c.arc(x, y, rh, Math.PI * 1.08, Math.PI * 1.92);
        c.lineWidth = Math.max(3, e * 0.34); c.strokeStyle = OUTLINE; c.stroke();
        c.lineWidth = Math.max(1.5, e * 0.18); c.strokeStyle = shade(col, 0.15); c.stroke();
        for (const s of [-1, 1]) {
          const cx0 = x + s * rh * 0.98;
          rrect(c, cx0 - e * 0.32, y - e * 0.55, e * 0.64, e * 1.1, e * 0.28);
          fillLine(c, col, e);
        }
      },
    },
    balloon: {
      slot: "side", up: (e) => e * 2.25 + e * 1.2 + e * 0.12 + e * 0.12,
      draw(c, x, y, e, sp, col, col2, now) {
        const bob = reduceMotion() ? 0 : Math.sin((now || 0) * 1.7) * e * 0.12;
        const bx = x + sp + e * 1.6, by = y - e * 2.25 + bob;
        c.beginPath(); c.moveTo(bx, by + e * 1.2);
        c.quadraticCurveTo(bx - e * 0.6, by + e * 2.1, x + sp + e * 0.55, y + e * 0.5);
        c.lineWidth = Math.max(1, e * 0.08); c.strokeStyle = "rgba(29,18,51,0.8)"; c.stroke();
        c.beginPath(); c.moveTo(bx - e * 0.17, by + e * 1.3); c.lineTo(bx, by + e * 1.12); c.lineTo(bx + e * 0.17, by + e * 1.3); c.closePath();
        c.fillStyle = shade(col, -0.2); c.fill();
        ellipse(c, bx, by, e * 1.0, e * 1.2); fillLine(c, col, e);
        ellipse(c, bx - e * 0.33, by - e * 0.43, e * 0.2, e * 0.33); c.fillStyle = "rgba(255,255,255,0.6)"; c.fill();
      },
    },
  };

  // Each kind above says where its SHAPE ends; its outline is drawn centred on
  // that edge, so the ink reaches half a line further (a chef's puffs carry a
  // doubled outline: a whole line), plus a pixel of antialiasing. That margin
  // is added here, once, for every kind — the ink test found up to 9px of
  // overshoot at the biggest sizes before it was. Outlines join ROUND: a
  // mitred join on a wizard's or a party hat's sharp tip spikes far past it.
  for (const k of Object.keys(WEAR)) {
    const shapeUp = WEAR[k].up, drawIt = WEAR[k].draw;
    WEAR[k].up = (e, sp) => shapeUp(e, sp) + wl(e) + 1;
    WEAR[k].draw = function (c, x, y, e, sp, col, col2, now) {
      c.save();
      c.lineJoin = "round";
      try { drawIt.call(this, c, x, y, e, sp, col, col2, now); } finally { c.restore(); }
    };
  }

  // ---- The ground's TEXTURE: vector marks drawn straight onto the canvas ------
  // NOT a bitmap pattern, and the reason is measured. In a software
  // rasteriser (the floor to plan for: Josh's iPad may draw a canvas this
  // way), a full-screen pattern fill cost 70-115ms a frame on an iPad-sized
  // canvas once it was scaled or sub-pixel — it is sampled and filtered per
  // pixel — against ~2ms for a solid fill and ~5ms for a screenful of small
  // vector marks. So each ground is a BASE (solid fills, anchored to the
  // world, drawn once for the visible part) and MARKS (plank seams, tufts,
  // stars…) drawn per TILE-unit square, each square seeded by where it is,
  // so the floor never shows a repeating grid. `d` is device pixels per world
  // unit, and marks too fine to see at that zoom are skipped — a level of
  // detail. Every feature draws from its OWN seeded stream, so skipping one
  // never moves another (flowers do not jump when the camera zooms).
  const LOD = { fine: 8, small: 6, dust: 2 };   // device px per world unit
  function blobs(c, T, R, n, cols, rMin, rMax) {
    const paths = cols.map(() => []);
    for (let i = 0; i < n; i++) {
      const x = R() * T, y = R() * T, r = rMin + R() * (rMax - rMin);
      paths[i % cols.length].push([x, y, r]);
    }
    cols.forEach((col, k) => {
      c.fillStyle = col;
      c.beginPath();
      for (const [x, y, r] of paths[k]) { c.moveTo(x + r, y); c.ellipse(x, y, r, r * SQ, 0, 0, Math.PI * 2); }
      c.fill();
    });
  }
  function tufts(c, T, R, n, col, h) {
    c.strokeStyle = col; c.lineWidth = 0.3; c.lineCap = "round";
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const x = R() * T, y = R() * T;
      c.moveTo(x - 0.6 * h, y - 1.2 * h); c.lineTo(x, y); c.lineTo(x + 0.6 * h, y - 1.3 * h);
    }
    c.stroke();
  }
  // Round dots, grouped into one path per colour (a fill per dot is the
  // expensive way to draw 70 stars). `colour(R)` names a dot's colour from a
  // small set; `rMin` keeps a dot at least that many world units wide.
  function dots(c, T, R, n, rLo, rHi, colour, rMin) {
    const by = new Map();
    for (let i = 0; i < n; i++) {
      const x = R() * T, y = R() * T, r = Math.max(rMin || 0, rLo + R() * (rHi - rLo)), col = colour(i, R);
      if (!by.has(col)) by.set(col, []);
      by.get(col).push([x, y, r]);
    }
    for (const [col, list] of by) {
      c.fillStyle = col;
      c.beginPath();
      for (const [x, y, r] of list) { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); }
      c.fill();
    }
  }
  const WOOD = ["#e8bd7e", "#e0b16f", "#ecc68b"];
  const CONFETTI = ["#ff5e7e", "#ffd24d", "#5ec8ff", "#7be08a", "#c77dff", "#ffa64d"];
  // ---- What a TASTE looks like (PLAN_GOBBLE.md §15.3) ----------------------
  // A thing with a taste sounds like itself (hole-main.js) AND shows it, so it
  // reads with the sound off: a sweet melts his eyes into hearts, a cold thing
  // makes him shiver, and the noisy families send their noise up from his
  // face — sound waves, steam, speed lines, robot blips, music notes,
  // sparkles, clanking stars, confetti, a boing of the rim. One entry per
  // family in HoleData.TASTES (a law checks both ways). `face` replaces his
  // eyes for a moment, `fx` is a little burst round his face, and `boing`
  // squashes and springs the rim (not under reduced motion).
  const TASTE_LOOK = {
    sweet: { face: "hearts", fx: "heart", col: "#ff4f7b" },
    cold: { face: "shiver", fx: "twinkle", col: "#e6f6ff" },
    honk: { fx: "wave", col: "#ffd24d" },
    siren: { fx: "wave", col: "#ff4f5e", col2: "#4fa8ff" },
    choo: { fx: "puff", col: "#ffffff" },
    horn: { fx: "wave", col: "#9fdcff" },
    zoom: { fx: "streak", col: "#ffffff" },
    boing: { boing: true, fx: "bounce", col: "#ffffff" },
    ding: { fx: "wave", col: "#ffe36e" },
    ching: { fx: "twinkle", col: "#ffd24d" },
    clank: { fx: "star", col: "#c9d3dd" },
    beep: { fx: "blip", col: "#7be08a" },
    squeak: { fx: "wave", col: "#ff9fd2" },
    music: { fx: "note", col: "#c77dff" },
    pop: { fx: "conf" },
  };
  const TASTE_S = 1.1;   // a taste face lasts this long (s)
  const FX_CAP = 240;    // no taste burst is added while this many effects are in flight
  const BOING_S = 0.5;   // …and a boing of the rim this long
  const INK_DARK = "#1d1233";

  // ---- The AIR of each place (PLAN_GOBBLE.md §15.4) ------------------------
  // A little weather over the ground: snow on Snow Day, embers over the
  // volcano, fireflies in the dark cave, petals in the park … It is drawn in
  // SCREEN space — a fixed number of specks for the screen whatever the zoom,
  // so it costs the same at every size — each speck at its own depth, so when
  // the camera moves the near ones slide past faster than the far ones and the
  // weather reads as IN the air, not painted on the ground. Not drawn at all
  // under reduced motion: drifting is all it does.
  //   n      specks per 100,000 css px² (a phone is about 330,000)
  //   size   a speck's size at depth 1 (css px)
  //   vx, vy its drift (css px a second); sway: how far it swings side to side
  //   col    its colour (a place may give its own, air[1]); null: confetti colours
  //   draw   one speck: (c, x, y, s, ph, t, col, i) — ph its own phase, 0..1
  const TAU = Math.PI * 2;
  const pulse = (t, ph, k) => 0.5 + 0.5 * Math.sin(t * k + ph * TAU);
  const AIR = {
    motes: { n: 6, size: 3, vx: 3, vy: -5, sway: 8, col: "#fff6cf",
      draw(c, x, y, s, ph, t, col) {
        c.globalAlpha = 0.4 + 0.4 * pulse(t, ph, 1.7);
        c.fillStyle = col; c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
      } },
    petals: { n: 3.5, size: 8, vx: 14, vy: 22, sway: 22, col: "#ffc2d9",
      draw(c, x, y, s, ph, t, col) {
        c.globalAlpha = 0.9;
        c.save(); c.translate(x, y); c.rotate(t * 1.6 + ph * TAU); c.scale(1, 0.45 + 0.55 * pulse(t, ph, 2.4));
        c.fillStyle = col; c.strokeStyle = shade(col, -0.3); c.lineWidth = 1;
        c.beginPath(); c.ellipse(0, 0, s, s * 0.62, 0, 0, TAU); c.fill(); c.stroke();
        c.restore();
      } },
    fluff: { n: 3, size: 7, vx: 12, vy: -7, sway: 14, col: "#ffffff",
      // a dandelion seed: a little ball of fluff on a stalk
      draw(c, x, y, s, ph, t, col) {
        c.globalAlpha = 0.85;
        c.strokeStyle = "rgba(29,18,51,0.3)"; c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + s * 1.5); c.stroke();
        c.strokeStyle = col; c.lineWidth = 1;
        c.beginPath();
        for (let k = 0; k < 7; k++) { const a = -Math.PI + (k / 6) * Math.PI; c.moveTo(x, y); c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); }
        c.moveTo(x, y); c.lineTo(x, y + s * 1.5);
        c.stroke();
      } },
    dust: { n: 5, size: 3, vx: 18, vy: -3, sway: 6, col: "#d6b27a",
      draw(c, x, y, s, ph, t, col) {
        c.globalAlpha = 0.35 + 0.3 * pulse(t, ph, 2.1);
        c.fillStyle = col; c.beginPath(); c.arc(x, y, s * (0.6 + ph * 0.8), 0, TAU); c.fill();
      } },
    leaves: { n: 3, size: 10, vx: 16, vy: 20, sway: 26, col: "#7cc95a",
      draw(c, x, y, s, ph, t, col) {
        c.globalAlpha = 0.92;
        c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.8 + ph * TAU) * 0.9 + ph * 3);
        c.fillStyle = col; c.strokeStyle = shade(col, -0.35); c.lineWidth = 1;
        c.beginPath(); c.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(-s, 0); c.lineTo(s, 0); c.stroke();
        c.restore();
      } },
    confetti: { n: 4, size: 6, vx: 6, vy: 26, sway: 16, col: null,
      draw(c, x, y, s, ph, t, col, i) {
        c.globalAlpha = 0.95;
        c.save(); c.translate(x, y); c.rotate(t * 3 + ph * TAU); c.scale(1, 0.3 + 0.7 * pulse(t, ph, 5));
        c.fillStyle = CONFETTI[i % CONFETTI.length]; c.fillRect(-s, -s * 0.45, s * 2, s * 0.9);
        c.restore();
      } },
    sparkles: { n: 3.5, size: 7, vx: 0, vy: -2, sway: 0, col: "#fff6c8",
      draw(c, x, y, s, ph, t, col) {
        const k = pulse(t, ph, 2.6);
        if (k < 0.25) return;
        c.globalAlpha = k;
        c.fillStyle = "rgba(29,18,51,0.35)"; starPath(c, x, y, s * k * 1.3, s * k * 0.45, 4); c.fill();
        c.fillStyle = col; starPath(c, x, y, s * k, s * k * 0.3, 4); c.fill();
      } },
    embers: { n: 4, size: 3.4, vx: 6, vy: -26, sway: 10, col: "#ffb347",
      draw(c, x, y, s, ph, t, col) {
        const k = 0.55 + 0.45 * pulse(t, ph, 9);
        c.globalAlpha = 0.35 * k; c.fillStyle = "#ff5a1f"; c.beginPath(); c.arc(x, y, s * 2.2, 0, TAU); c.fill();
        c.globalAlpha = k; c.fillStyle = col; c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
      } },
    snow: { n: 7, size: 4.5, vx: 6, vy: 30, sway: 14, col: "#ffffff",
      // a faint dark edge, so a flake still reads over the snow itself
      draw(c, x, y, s, ph, t, col) {
        c.globalAlpha = 0.95;
        c.fillStyle = col; c.strokeStyle = "rgba(29,18,51,0.22)"; c.lineWidth = 1;
        c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill(); c.stroke();
      } },
    clouds: { n: 0.5, size: 26, vx: 9, vy: 0, sway: 0, col: "#ffffff",
      draw(c, x, y, s, ph, t, col) {
        c.globalAlpha = 0.5;
        c.fillStyle = col;
        c.beginPath();
        c.arc(x - s * 0.9, y + s * 0.15, s * 0.7, 0, TAU);
        c.arc(x, y - s * 0.15, s, 0, TAU);
        c.arc(x + s * 0.95, y + s * 0.1, s * 0.75, 0, TAU);
        c.fill();
      } },
    stars: { n: 4, size: 4.5, vx: 0, vy: 0, sway: 0, col: "#fff9d9",
      draw(c, x, y, s, ph, t, col) {
        const k = 0.35 + 0.65 * pulse(t, ph, 3.1);
        c.globalAlpha = k; c.fillStyle = col;
        starPath(c, x, y, s * (0.7 + 0.5 * k), s * 0.3, 4); c.fill();
      } },
    fireflies: { n: 3, size: 3.6, vx: 0, vy: -3, sway: 26, col: "#eaff8f",
      // drawn AFTER the dark, so they glow in it
      draw(c, x, y, s, ph, t, col) {
        const k = pulse(t, ph, 2.2);
        if (k < 0.15) return;
        c.globalAlpha = 0.3 * k; c.fillStyle = col; c.beginPath(); c.arc(x, y, s * 3.2, 0, TAU); c.fill();
        c.globalAlpha = k; c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill();
      } },
    bubbles: { n: 3, size: 8, vx: 0, vy: -20, sway: 12, col: "#ffffff",
      draw(c, x, y, s, ph, t, col) {
        c.globalAlpha = 0.8;
        c.strokeStyle = "rgba(29,18,51,0.25)"; c.lineWidth = 3; c.beginPath(); c.arc(x, y, s, 0, TAU); c.stroke();
        c.strokeStyle = col; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, s, 0, TAU); c.stroke();
        c.fillStyle = col; c.beginPath(); c.arc(x - s * 0.35, y - s * 0.35, s * 0.22, 0, TAU); c.fill();
      } },
    sprinkles: { n: 4.5, size: 5.5, vx: 4, vy: 24, sway: 10, col: null,
      draw(c, x, y, s, ph, t, col, i) {
        c.globalAlpha = 0.95;
        const a = t * 2.2 + ph * TAU, dx = Math.cos(a) * s, dy = Math.sin(a) * s;
        c.lineCap = "round";
        c.strokeStyle = "rgba(29,18,51,0.3)"; c.lineWidth = s * 0.7 + 1.5;
        c.beginPath(); c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy); c.stroke();
        c.strokeStyle = CONFETTI[i % CONFETTI.length]; c.lineWidth = s * 0.7;
        c.beginPath(); c.moveTo(x - dx, y - dy); c.lineTo(x + dx, y + dy); c.stroke();
      } },
    notes: { n: 2.5, size: 7, vx: 4, vy: -14, sway: 16, col: "#c77dff",
      draw(c, x, y, s, ph, t, col, i) {
        c.globalAlpha = 0.9;
        c.fillStyle = [col, "#5ec8ff", "#ff5e7e"][i % 3]; c.strokeStyle = OUTLINE; c.lineWidth = 1.2;
        c.beginPath(); c.ellipse(x, y, s, s * 0.74, -0.4, 0, TAU); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(x + s * 0.82, y - s * 0.2); c.lineTo(x + s * 0.82, y - s * 3);
        c.quadraticCurveTo(x + s * 2.1, y - s * 2.3, x + s * 1.7, y - s * 1.4); c.stroke();
      } },
  };
  const AIR_MAX = 48;    // never more specks than this, on the biggest screen
  // The FINALE's fireworks (§15.5): when each one is launched (seconds after
  // the finale goes down) and how long it takes to rise before it bursts — the
  // page plays a pop at each burst from these same numbers. All six burst
  // within two seconds: the win box comes up soon after and covers the field.
  const FIREWORKS = { at: [0.2, 0.45, 0.7, 0.95, 1.2, 1.45], rise: 0.4, burst: 1.1 };
  const GROUND_ART = {
    wood: {
      // planks run across the room, 8 units wide, in three tones
      base(c, x0, y0, x1, y1) {
        for (let r = Math.floor(y0 / 8); r * 8 < y1; r++) {
          c.fillStyle = WOOD[(((r % 3) + 3) % 3)];
          c.fillRect(x0, r * 8, x1 - x0, 8);
        }
      },
      marks(c, T, Rk, d, tx, ty) {
        const R = Rk("planks");
        c.strokeStyle = "rgba(160,110,60,0.55)"; c.lineWidth = 0.45;
        c.beginPath();
        for (let i = 0; i < T / 8; i++) {
          // the seam, and two plank ends a row, staggered, never on the seam
          const y = i * 8, p = 3 + R() * (T / 2 - 6);
          c.moveTo(0, y); c.lineTo(T, y);
          c.moveTo(p, y); c.lineTo(p, y + 8);
          c.moveTo(p + T / 2, y); c.lineTo(p + T / 2, y + 8);
        }
        c.stroke();
        if (d < LOD.fine) return;
        // the grain: gentle waves whose phase belongs to the ROW of the world,
        // so a wave runs on unbroken into the next square
        c.strokeStyle = "rgba(170,120,70,0.22)"; c.lineWidth = 0.25;
        c.beginPath();
        for (let i = 0; i < T / 8; i++) {
          for (let g = 0; g < 2; g++) {
            const gy = i * 8 + 2.5 + g * 3, ph = (((ty * T) / 8 + i) * 1.7 + g * 2.3) % (Math.PI * 2);
            c.moveTo(0, gy + Math.sin(ph) * 0.5);
            for (let x = 4; x <= T; x += 4) c.lineTo(x, gy + Math.sin((x / T) * Math.PI * 4 + ph) * 0.5);
          }
        }
        c.stroke();
      },
    },
    grass: {
      base(c, x0, y0, x1, y1) { c.fillStyle = "#8fd16a"; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
      marks(c, T, Rk, d) {
        blobs(c, T, Rk("blobs"), 16, ["rgba(172,226,132,0.45)", "rgba(104,170,72,0.30)"], 2, 6);
        if (d >= LOD.small) tufts(c, T, Rk("tufts"), 40, "rgba(80,150,55,0.6)", 1);
        if (d >= LOD.small) dots(c, T, Rk("flowers"), 6, 0.5, 0.6, (i) => ["#ffffff", "#ffe066", "#ff9ecf"][i % 3]);
      },
    },
    dirt: {
      base(c, x0, y0, x1, y1) { c.fillStyle = "#cb9a63"; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
      marks(c, T, Rk, d) {
        blobs(c, T, Rk("blobs"), 16, ["rgba(176,124,70,0.40)", "rgba(226,186,130,0.40)"], 2, 7);
        if (d >= LOD.small) {
          dots(c, T, Rk("pebbles"), 26, 0.3, 0.75, (i, R) => {
            const v = 140 + 15 * Math.floor(R() * 4);    // four greys, one path each
            return "rgb(" + v + "," + (v - 12) + "," + (v - 30) + ")";
          });
        }
      },
    },
    town: {
      base(c, x0, y0, x1, y1) { c.fillStyle = "#9bd46e"; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
      marks(c, T, Rk, d) {
        blobs(c, T, Rk("blobs"), 14, ["rgba(170,225,130,0.45)", "rgba(110,175,78,0.28)"], 2, 5);
        if (d >= LOD.small) tufts(c, T, Rk("tufts"), 30, "rgba(90,160,60,0.5)", 0.9);
      },
    },
    party: {
      // a pink check, 8 units a square, anchored to the world
      base(c, x0, y0, x1, y1) {
        c.fillStyle = "#fff5fa"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        c.fillStyle = "#ffe3ef";
        c.beginPath();
        for (let j = Math.floor(y0 / 8); j * 8 < y1; j++) {
          for (let i = Math.floor(x0 / 8); i * 8 < x1; i++) if ((((i + j) % 2) + 2) % 2) c.rect(i * 8, j * 8, 8, 8);
        }
        c.fill();
      },
      marks(c, T, Rk, d) {
        if (d < LOD.dust) return;
        // confetti: little strips at every angle, and a few dots — one path
        // per colour, the corners worked out here (no save/rotate per piece)
        const R = Rk("confetti"), paths = CONFETTI.map(() => []);
        for (let i = 0; i < 22; i++) paths[i % CONFETTI.length].push([R() * T, R() * T, R() * Math.PI, i % 3 === 0]);
        CONFETTI.forEach((col, k) => {
          c.fillStyle = col;
          c.beginPath();
          for (const [x, y, a, round] of paths[k]) {
            if (round) { c.moveTo(x + 0.45, y); c.arc(x, y, 0.45, 0, Math.PI * 2); continue; }
            const ux = Math.cos(a), uy = Math.sin(a);
            const hx = ux * 0.6, hy = uy * 0.6, vx = -uy * 0.3, vy = ux * 0.3;
            c.moveTo(x - hx - vx, y - hy - vy); c.lineTo(x + hx - vx, y + hy - vy);
            c.lineTo(x + hx + vx, y + hy + vy); c.lineTo(x - hx + vx, y - hy + vy); c.closePath();
          }
          c.fill();
        });
      },
    },
    space: {
      base(c, x0, y0, x1, y1) { c.fillStyle = "#141845"; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
      marks(c, T, Rk, d) {
        // stars: space IS its stars, so a star never shrinks below about
        // two thirds of a device pixel, however far the camera pulls back
        const A = ["0.40", "0.55", "0.75", "0.95"];
        dots(c, T, Rk("stars"), 70, 0.12, 0.42, (i, R) => "rgba(255,255,255," + A[Math.floor(R() * 4)] + ")", 0.65 / Math.max(d, 0.1));
        if (d < LOD.small) return;
        const R = Rk("sparkles");
        c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 0.18;
        c.beginPath();
        for (let i = 0; i < 5; i++) {
          const x = R() * T, y = R() * T, s = 0.8 + R() * 0.9;
          c.moveTo(x - s, y); c.lineTo(x + s, y); c.moveTo(x, y - s); c.lineTo(x, y + s);
        }
        c.stroke();
      },
    },
    // ---- phase 3 (§11): the six new places' floors ----
    farm: {
      // sunny farm grass, yellower than the park's, with dry straw in it
      base(c, x0, y0, x1, y1) { c.fillStyle = "#b5d86a"; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
      marks(c, T, Rk, d) {
        blobs(c, T, Rk("blobs"), 14, ["rgba(214,236,138,0.45)", "rgba(146,184,72,0.30)"], 2, 6);
        if (d < LOD.small) return;
        tufts(c, T, Rk("tufts"), 28, "rgba(112,152,52,0.55)", 1);
        const R = Rk("straw");
        c.strokeStyle = "rgba(226,186,92,0.75)"; c.lineWidth = 0.28; c.lineCap = "round";
        c.beginPath();
        for (let i = 0; i < 10; i++) {
          const x = R() * T, y = R() * T, a = R() * Math.PI, s = 0.8 + R() * 0.8;
          c.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s * SQ); c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s * SQ);
        }
        c.stroke();
      },
    },
    pitch: {
      // a mown pitch: wide stripes of two greens across the world, anchored
      // to it (a stripe never slides as the camera moves)
      base(c, x0, y0, x1, y1) {
        for (let k = Math.floor(x0 / 14); k * 14 < x1; k++) {
          c.fillStyle = (((k % 2) + 2) % 2) ? "#63c15a" : "#70cc66";
          c.fillRect(k * 14, y0, 14, y1 - y0);
        }
      },
      marks(c, T, Rk, d) {
        if (d < LOD.small) return;
        tufts(c, T, Rk("tufts"), 18, "rgba(60,140,50,0.45)", 0.8);
      },
    },
    sand: {
      // warm sand with little ripples and pale shell-coloured specks
      base(c, x0, y0, x1, y1) { c.fillStyle = "#f2d8a0"; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
      marks(c, T, Rk, d) {
        blobs(c, T, Rk("blobs"), 14, ["rgba(255,236,190,0.5)", "rgba(214,178,112,0.30)"], 2, 7);
        if (d < LOD.small) return;
        const R = Rk("ripples");
        c.strokeStyle = "rgba(196,156,92,0.45)"; c.lineWidth = 0.3; c.lineCap = "round";
        c.beginPath();
        for (let i = 0; i < 9; i++) {
          const x = R() * T, y = R() * T, s = 1.6 + R() * 1.6;
          c.moveTo(x - s, y); c.quadraticCurveTo(x, y - s * 0.5, x + s, y);
        }
        c.stroke();
        dots(c, T, Rk("specks"), 12, 0.25, 0.5, (i) => ["#ffffff", "#ffd1dc", "#e8c8ff"][i % 3]);
      },
    },
    jungle: {
      // a deep green jungle floor: leafy patches, ferns and tiny flowers
      base(c, x0, y0, x1, y1) { c.fillStyle = "#57a94b"; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
      marks(c, T, Rk, d) {
        blobs(c, T, Rk("blobs"), 16, ["rgba(120,196,92,0.45)", "rgba(40,110,40,0.35)"], 2, 7);
        if (d < LOD.small) return;
        tufts(c, T, Rk("ferns"), 30, "rgba(30,96,36,0.6)", 1.3);
        dots(c, T, Rk("flowers"), 6, 0.45, 0.6, (i) => ["#ff5e7e", "#ffd24d", "#ffffff"][i % 3]);
      },
    },
    snow: {
      // fresh snow: soft blue shadows of the drifts, and a sparkle here and there
      base(c, x0, y0, x1, y1) { c.fillStyle = "#f2f6fc"; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
      marks(c, T, Rk, d) {
        blobs(c, T, Rk("blobs"), 12, ["rgba(196,214,240,0.40)", "rgba(255,255,255,0.75)"], 2, 7);
        if (d < LOD.small) return;
        dots(c, T, Rk("sparkles"), 10, 0.2, 0.35, (i) => (i % 2 ? "rgba(150,190,240,0.9)" : "rgba(255,255,255,1)"));
      },
    },
    tarmac: {
      // an airport's grey tarmac, speckled
      base(c, x0, y0, x1, y1) { c.fillStyle = "#8e959f"; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
      marks(c, T, Rk, d) {
        blobs(c, T, Rk("blobs"), 10, ["rgba(160,166,176,0.40)", "rgba(110,116,126,0.30)"], 3, 8);
        if (d < LOD.small) return;
        dots(c, T, Rk("specks"), 30, 0.15, 0.3, (i) => (i % 2 ? "rgba(70,74,82,0.6)" : "rgba(196,200,208,0.6)"));
      },
    },
    // ---- phase 4 (§14): the twelve new places' floors ----
    tiles: {
      // a shop floor: big pale tiles, every other one a touch darker (8 units,
      // so a tile's grid lines in a 64-unit square land on the tiles' own)
      base(c, x0, y0, x1, y1) {
        c.fillStyle = "#f5f6f9"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        c.fillStyle = "#e3e7ef";
        c.beginPath();
        for (let j = Math.floor(y0 / 8); j * 8 < y1; j++) {
          for (let i = Math.floor(x0 / 8); i * 8 < x1; i++) if ((((i + j) % 2) + 2) % 2) c.rect(i * 8, j * 8, 8, 8);
        }
        c.fill();
      },
      marks(c, T, Rk, d) {
        if (d < LOD.small) return;
        c.strokeStyle = "rgba(150,158,172,0.35)"; c.lineWidth = 0.22;
        c.beginPath();
        for (let k = 0; k <= T; k += 8) { c.moveTo(k, 0); c.lineTo(k, T); c.moveTo(0, k); c.lineTo(T, k); }
        c.stroke();
      },
    },
    cave: {
      // a cave floor: purple rock, pebbles, and crystal glints
      base(c, x0, y0, x1, y1) { c.fillStyle = "#6a5878"; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
      marks(c, T, Rk, d) {
        blobs(c, T, Rk("blobs"), 16, ["rgba(140,118,160,0.45)", "rgba(60,46,74,0.40)"], 2, 7);
        if (d < LOD.small) return;
        dots(c, T, Rk("pebbles"), 22, 0.3, 0.7, (i) => ["#55456a", "#8a78a0", "#4a3c5c"][i % 3]);
        dots(c, T, Rk("glints"), 7, 0.2, 0.35, (i) => ["#8ff0ff", "#ff9ff0", "#fff3a0"][i % 3]);
      },
    },
    stone: {
      // a castle's flagstones: rows of big grey slabs, joints staggered, a little moss
      base(c, x0, y0, x1, y1) {
        const S = ["#c7c1b3", "#bfb9ab", "#cdc8bb"];
        for (let r = Math.floor(y0 / 8); r * 8 < y1; r++) {
          c.fillStyle = S[(((r % 3) + 3) % 3)];
          c.fillRect(x0, r * 8, x1 - x0, 8);
        }
      },
      marks(c, T, Rk, d) {
        c.strokeStyle = "rgba(110,104,92,0.55)"; c.lineWidth = 0.4;
        c.beginPath();
        for (let i = 0; i < T / 8; i++) {
          const y = i * 8, off = (i % 2) * 6;
          c.moveTo(0, y); c.lineTo(T, y);
          for (let x = off; x < T; x += 12) { c.moveTo(x, y); c.lineTo(x, y + 8); }
        }
        c.stroke();
        if (d >= LOD.small) dots(c, T, Rk("moss"), 10, 0.3, 0.6, (i) => (i % 2 ? "rgba(110,150,80,0.55)" : "rgba(140,170,90,0.5)"));
      },
    },
    metal: {
      // a factory floor: steel plates with the raised diamond pattern
      base(c, x0, y0, x1, y1) { c.fillStyle = "#a7afba"; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
      marks(c, T, Rk, d) {
        c.strokeStyle = "rgba(90,98,110,0.5)"; c.lineWidth = 0.4;
        c.beginPath();
        for (let k = 0; k < T; k += 16) { c.moveTo(k, 0); c.lineTo(k, T); c.moveTo(0, k); c.lineTo(T, k); }
        c.stroke();
        if (d < LOD.small) return;
        c.strokeStyle = "rgba(220,226,234,0.7)"; c.lineWidth = 0.3; c.lineCap = "round";
        c.beginPath();
        for (let y = 2; y < T; y += 4) {
          for (let x = 2 + ((y / 4) % 2) * 2; x < T; x += 4) {
            const s = (x + y) % 8 < 4 ? 1 : -1;
            c.moveTo(x - 0.6, y - 0.6 * s); c.lineTo(x + 0.6, y + 0.6 * s);
          }
        }
        c.stroke();
      },
    },
    ring: {
      // a circus ring's sawdust
      base(c, x0, y0, x1, y1) { c.fillStyle = "#ecca8d"; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
      marks(c, T, Rk, d) {
        blobs(c, T, Rk("blobs"), 14, ["rgba(255,232,180,0.5)", "rgba(196,150,90,0.30)"], 2, 7);
        if (d < LOD.small) return;
        const R = Rk("dust");
        c.strokeStyle = "rgba(150,104,52,0.5)"; c.lineWidth = 0.25; c.lineCap = "round";
        c.beginPath();
        for (let i = 0; i < 30; i++) {
          const x = R() * T, y = R() * T, a = R() * Math.PI, s = 0.4 + R() * 0.5;
          c.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s); c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        }
        c.stroke();
      },
    },
    cloud: {
      // a cloud's soft top: white, with pale blue billows
      base(c, x0, y0, x1, y1) { c.fillStyle = "#fbfcff"; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
      marks(c, T, Rk, d) {
        blobs(c, T, Rk("blobs"), 12, ["rgba(206,220,248,0.45)", "rgba(255,255,255,1)"], 3, 9);
        if (d >= LOD.small) dots(c, T, Rk("sparkles"), 6, 0.2, 0.35, (i) => (i % 2 ? "rgba(255,214,120,0.9)" : "rgba(170,200,255,0.9)"));
      },
    },
    candy: {
      // a candy floor: pink, with sprinkles everywhere
      base(c, x0, y0, x1, y1) { c.fillStyle = "#ffdcef"; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
      marks(c, T, Rk, d) {
        blobs(c, T, Rk("blobs"), 10, ["rgba(255,240,248,0.6)", "rgba(240,170,210,0.30)"], 3, 8);
        if (d < LOD.dust) return;
        const R = Rk("sprinkles"), cols = ["#ff5e9c", "#5ec8ff", "#ffd24d", "#7be08a", "#c77dff", "#ffffff"];
        const paths = cols.map(() => []);
        for (let i = 0; i < 26; i++) paths[i % cols.length].push([R() * T, R() * T, R() * Math.PI]);
        c.lineWidth = 0.42; c.lineCap = "round";
        cols.forEach((col, k) => {
          c.strokeStyle = col;
          c.beginPath();
          for (const [x, y, a] of paths[k]) { c.moveTo(x - Math.cos(a) * 0.7, y - Math.sin(a) * 0.7); c.lineTo(x + Math.cos(a) * 0.7, y + Math.sin(a) * 0.7); }
          c.stroke();
        });
      },
    },
    stage: {
      // a music stage: lilac boards with little notes drawn on them
      base(c, x0, y0, x1, y1) {
        for (let r = Math.floor(y0 / 8); r * 8 < y1; r++) {
          c.fillStyle = (((r % 2) + 2) % 2) ? "#ece2ff" : "#e4d8fb";
          c.fillRect(x0, r * 8, x1 - x0, 8);
        }
      },
      marks(c, T, Rk, d) {
        if (d < LOD.small) return;
        const R = Rk("notes");
        c.fillStyle = "rgba(150,110,220,0.35)"; c.strokeStyle = "rgba(150,110,220,0.35)"; c.lineWidth = 0.3;
        c.beginPath();
        for (let i = 0; i < 4; i++) {
          const x = R() * T, y = R() * T;
          c.moveTo(x + 0.9, y); c.ellipse(x, y, 0.9, 0.65, -0.4, 0, Math.PI * 2);
        }
        c.fill();
        c.beginPath();
        const R2 = Rk("notes");
        for (let i = 0; i < 4; i++) { const x = R2() * T, y = R2() * T; c.moveTo(x + 0.8, y); c.lineTo(x + 0.8, y - 3); }
        c.stroke();
      },
    },
  };

  // ---- The ground's FEATURES: vector decals in world units ------------------
  // Each kind: an optional prep (anything random, worked out ONCE per place),
  // its bounding box (for culling), and a draw. A decal's `k` with no entry
  // here would silently draw nothing — the engine tests fail on that.
  const PAL = [
    ["#ff6b6b", "#ffd93d", "#58c7ff", "#7be08a", "#c77dff", "#ff9a3d"],   // a rainbow rug
    ["#7b52e8", "#a98bff", "#ffd24d", "#7b52e8"],                         // a royal stage rug
    ["#4f9cff", "#ffffff", "#4f9cff", "#ffffff"],                         // a blue-and-white rug
    ["#ff5e9c", "#ffd24d", "#ff8fbf", "#ffffff"],                         // a party stage rug
  ];
  const rectOf = (d, W, H) => [d.x0 * W, d.y0 * H, d.x1 * W, d.y1 * H];
  const circOf = (d, W, H, k) => {
    const r = d.r * W * (k || 1);
    return [d.x * W - r, d.y * H - r * SQ, d.x * W + r, d.y * H + r * SQ];
  };
  const ptsOf = (d, W, H) => d.pts.map((p) => [p[0] * W, p[1] * H]);
  const ptsBox = (pts, pad) => [
    Math.min(...pts.map((p) => p[0])) - pad, Math.min(...pts.map((p) => p[1])) - pad,
    Math.max(...pts.map((p) => p[0])) + pad, Math.max(...pts.map((p) => p[1])) + pad,
  ];
  const grow = (b, k) => [b[0] - k, b[1] - k, b[2] + k, b[3] + k];
  // a stroke along a ground curve, foreshortened like the ground itself: a
  // path running across the screen looks thinner than one running up it
  function groundStroke(c, pts, width, style) {
    c.save();
    c.scale(1, SQ);
    c.lineCap = "round"; c.lineJoin = "round";
    c.strokeStyle = style; c.lineWidth = width;
    smoothPath(c, pts.map((p) => [p[0], p[1] / SQ]));
    c.stroke();
    c.restore();
  }
  function spots(R, n, r, extra) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, q = Math.sqrt(R()) * 0.9;
      out.push([Math.cos(a) * q * r, Math.sin(a) * q * r * SQ, extra ? extra(i, R) : i]);
    }
    return out;
  }

  const DECALS = {
    rug: {
      box: (d, W, H) => grow(circOf(d, W, H), 1.6),
      draw(c, d, W, H) {
        const cx = d.x * W, cy = d.y * H, rx = d.r * W, pal = PAL[d.pal || 0] || PAL[0];
        c.strokeStyle = "#ffffff"; c.lineWidth = 0.35;
        c.beginPath();
        for (let a = 0; a < Math.PI * 2; a += 0.09) {
          const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * rx * SQ;
          c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 1.4, y + Math.sin(a) * 1.4 * SQ);
        }
        c.stroke();
        pal.forEach((col, k) => {
          const f = 1 - k * (0.8 / pal.length);
          c.fillStyle = col; ellipse(c, cx, cy, rx * f, rx * f * SQ); c.fill();
        });
      },
    },
    mat: {   // a foam play mat
      box: rectOf,
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H), cols = ["#ff8a8a", "#ffd166", "#7fd1ff", "#95e39c"];
        const nx = Math.max(1, Math.round((x1 - x0) / 13)), ny = Math.max(1, Math.round((y1 - y0) / (13 * SQ)));
        const w = (x1 - x0) / nx, h = (y1 - y0) / ny;
        c.fillStyle = "#ffffff"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        for (let j = 0; j < ny; j++) {
          for (let i = 0; i < nx; i++) { c.fillStyle = cols[(i + j * 2) % cols.length]; c.fillRect(x0 + i * w + 0.4, y0 + j * h + 0.4, w - 0.8, h - 0.8); }
        }
      },
    },
    splat: {   // a splash of paint
      prep: (d, W, H, R) => ({ drops: spots(R, 6, 1, (i, Rr) => 0.12 + Rr() * 0.16).map((p) => [p[0] * 1.6, p[1] * 1.6, p[2]]) }),
      box: (d, W, H) => circOf(d, W, H, 1.8),
      draw(c, d, W, H, p) {
        const cx = d.x * W, cy = d.y * H, r = d.r * W;
        c.fillStyle = d.c;
        c.beginPath();
        c.moveTo(cx + r, cy); c.ellipse(cx, cy, r, r * SQ, 0, 0, Math.PI * 2);
        for (const [dx, dy, rr] of p.drops) {
          const x = cx + dx * r, y = cy + dy * r;
          c.moveTo(x + rr * r, y); c.ellipse(x, y, rr * r, rr * r * SQ, 0, 0, Math.PI * 2);
        }
        c.fill();
        c.fillStyle = "rgba(255,255,255,0.35)";
        c.beginPath(); c.ellipse(cx - r * 0.3, cy - r * 0.25 * SQ, r * 0.35, r * 0.2 * SQ, -0.3, 0, Math.PI * 2); c.fill();
      },
    },
    stripes: {   // a striped rug with a fringe
      box: (d, W, H) => grow(rectOf(d, W, H), 2),
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H), n = 9, h = (y1 - y0) / n;
        for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? "#ffe8a3" : "#f28c52"; c.fillRect(x0, y0 + i * h, x1 - x0, h); }
        c.strokeStyle = "#fff4d6"; c.lineWidth = 0.35;
        c.beginPath();
        for (let y = y0 + 0.8; y < y1; y += 1.6) { c.moveTo(x0, y); c.lineTo(x0 - 1.6, y); c.moveTo(x1, y); c.lineTo(x1 + 1.6, y); }
        c.stroke();
      },
    },
    shade: {   // the soft shade of the trees
      box: circOf,
      draw(c, d, W, H) {
        const r = d.r * W;
        c.translate(d.x * W, d.y * H); c.scale(1, SQ);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, "rgba(40,90,30,0.34)"); g.addColorStop(0.7, "rgba(40,90,30,0.18)"); g.addColorStop(1, "rgba(40,90,30,0)");
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
      },
    },
    path: {   // a sand path
      box: (d, W, H) => ptsBox(ptsOf(d, W, H), d.w),
      draw(c, d, W, H) {
        const pts = ptsOf(d, W, H);
        groundStroke(c, pts, d.w + 1.8, "#c9ae70");
        groundStroke(c, pts, d.w, "#ead7a0");
      },
    },
    blanket: {   // a checked picnic blanket
      box: rectOf,
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H), nx = 7, ny = 5, w = (x1 - x0) / nx, h = (y1 - y0) / ny;
        c.fillStyle = "#ffffff"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        c.fillStyle = d.c;
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if ((i + j) % 2 === 0) c.fillRect(x0 + i * w, y0 + j * h, w, h);
        c.strokeStyle = "rgba(0,0,0,0.18)"; c.lineWidth = 0.6; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
      },
    },
    pond: {
      box: (d, W, H) => grow(circOf(d, W, H), 1.2),
      draw(c, d, W, H) {
        const px = d.x * W, py = d.y * H, pr = d.r * W;
        c.fillStyle = "#4a9ed0"; ellipse(c, px, py, pr + 1, (pr + 1) * SQ); c.fill();
        c.fillStyle = "#74c6f2"; ellipse(c, px, py, pr, pr * SQ); c.fill();
        c.fillStyle = "#b8e6ff"; c.beginPath(); c.ellipse(px - pr * 0.3, py - pr * 0.2 * SQ, pr * 0.35, pr * 0.1, -0.2, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#5daa45";
        for (const [dx, dy] of [[0.35, 0.1], [-0.2, 0.35], [0.05, -0.4]]) {
          const lx = px + dx * pr, ly = py + dy * pr * SQ, lr = Math.max(1.6, pr * 0.1);
          c.beginPath(); c.moveTo(lx, ly); c.ellipse(lx, ly, lr, lr * 0.7, 0, 0.3, Math.PI * 2 - 0.3); c.closePath(); c.fill();
        }
      },
    },
    flowers: {   // a flower bed
      prep: (d, W, H, R) => ({ dots: spots(R, 30, d.r * W, (i) => i % 4) }),
      box: (d, W, H) => grow(circOf(d, W, H), 1),
      draw(c, d, W, H, p) {
        const cx = d.x * W, cy = d.y * H, r = d.r * W, cols = ["#ff7eb6", "#ffe066", "#ffffff", "#c77dff"];
        c.fillStyle = "#7a5a3a"; ellipse(c, cx, cy, r, r * SQ); c.fill();
        c.fillStyle = "#8c6a45"; ellipse(c, cx, cy - 0.6, r * 0.94, r * 0.94 * SQ); c.fill();
        c.fillStyle = "#4e9a3a";
        c.beginPath();
        for (const [dx, dy] of p.dots) { c.moveTo(cx + dx + 0.85, cy + dy + 0.6); c.arc(cx + dx, cy + dy + 0.6, 0.85, 0, Math.PI * 2); }
        c.fill();
        for (let k = 0; k < 4; k++) {
          c.fillStyle = cols[k];
          c.beginPath();
          for (const [dx, dy, kk] of p.dots) if (kk === k) { c.moveTo(cx + dx + 0.8, cy + dy); c.arc(cx + dx, cy + dy, 0.8, 0, Math.PI * 2); }
          c.fill();
        }
      },
    },
    tracks: {   // tyre tracks in the dirt (or ski tracks in the snow: `c` is their colour)
      box: (d, W, H) => ptsBox(ptsOf(d, W, H), 6),
      draw(c, d, W, H) {
        const pts = ptsOf(d, W, H);
        c.strokeStyle = d.c || "rgba(125,82,42,0.5)"; c.lineWidth = 1.4; c.setLineDash([1.6, 1.1]);
        for (const off of [-2.3, 2.3]) {
          c.save(); c.translate(0, off); smoothPath(c, pts); c.stroke(); c.restore();
        }
        c.setLineDash([]);
      },
    },
    gravel: {   // a gravel pile
      prep: (d, W, H, R) => ({
        dots: spots(R, 70, d.r * W, (i, Rr) => { const v = 150 + Math.floor(Rr() * 70); return ["rgb(" + v + "," + v + "," + (v - 8) + ")", 0.4 + Rr() * 0.5]; }),
      }),
      box: circOf,
      draw(c, d, W, H, p) {
        const cx = d.x * W, cy = d.y * H, r = d.r * W;
        c.fillStyle = "rgba(120,110,100,0.35)"; ellipse(c, cx, cy, r, r * SQ); c.fill();
        for (const [dx, dy, [col, rr]] of p.dots) { c.fillStyle = col; c.beginPath(); c.arc(cx + dx, cy + dy, rr, 0, Math.PI * 2); c.fill(); }
      },
    },
    slab: {   // a concrete slab where the trucks park
      box: rectOf,
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H);
        c.fillStyle = "#c9c6bd"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        c.strokeStyle = "rgba(90,88,80,0.35)"; c.lineWidth = 0.4;
        c.beginPath();
        for (let x = x0 + 18; x < x1 - 1; x += 18) { c.moveTo(x, y0); c.lineTo(x, y1); }
        for (let y = y0 + 13; y < y1 - 1; y += 13) { c.moveTo(x0, y); c.lineTo(x1, y); }
        c.stroke();
        c.strokeStyle = "rgba(60,60,60,0.35)"; c.lineWidth = 0.8; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
      },
    },
    pallet: {   // a brick yard on pallets
      box: rectOf,
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H);
        c.fillStyle = "#a57845"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        c.fillStyle = "#d9ab70";
        for (let y = y0 + 0.8; y < y1 - 2; y += 5.2) c.fillRect(x0 + 0.8, y, x1 - x0 - 1.6, 3.6);
      },
    },
    puddle: {
      box: (d, W, H) => grow(circOf(d, W, H), 1),
      draw(c, d, W, H) {
        const cx = d.x * W, cy = d.y * H, r = d.r * W;
        c.fillStyle = "#8a6a4a"; ellipse(c, cx, cy, r + 0.8, (r + 0.8) * SQ); c.fill();
        c.fillStyle = "#7fa6bf"; ellipse(c, cx, cy, r, r * SQ); c.fill();
        c.fillStyle = "rgba(255,255,255,0.5)"; c.beginPath(); c.ellipse(cx - r * 0.3, cy - r * 0.2 * SQ, r * 0.35, r * 0.1, -0.2, 0, Math.PI * 2); c.fill();
      },
    },
    yard: {   // the schoolyard, with hopscotch in chalk
      box: rectOf,
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H);
        c.fillStyle = "#e3d6c4"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        c.strokeStyle = "rgba(0,0,0,0.12)"; c.lineWidth = 0.8; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
        c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 0.5;
        const hx = x0 + (x1 - x0) * 0.1, hy = y1 - 6, s = 5;
        c.beginPath();
        for (let i = 0; i < 5; i++) c.rect(hx, hy - (i + 1) * s * SQ, s, s * SQ);
        c.stroke();
        ellipse(c, x1 - (x1 - x0) * 0.16, y1 - 12, 7, 7 * SQ); c.stroke();
      },
    },
    road: {   // a street: pavement, asphalt, edge lines and a dashed middle
      box: (d, W, H) => grow(rectOf(d, W, H), 2),
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H), vert = y1 - y0 > x1 - x0;
        c.fillStyle = "#d9d8d0";
        if (vert) c.fillRect(x0 - 1.8, y0, x1 - x0 + 3.6, y1 - y0); else c.fillRect(x0, y0 - 1.8, x1 - x0, y1 - y0 + 3.6);
        c.fillStyle = "#5d6572"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 0.35;
        c.beginPath();
        if (vert) { c.moveTo(x0 + 0.8, y0); c.lineTo(x0 + 0.8, y1); c.moveTo(x1 - 0.8, y0); c.lineTo(x1 - 0.8, y1); }
        else { c.moveTo(x0, y0 + 0.8); c.lineTo(x1, y0 + 0.8); c.moveTo(x0, y1 - 0.8); c.lineTo(x1, y1 - 0.8); }
        c.stroke();
        c.strokeStyle = "#ffd24d"; c.lineWidth = 0.55; c.setLineDash([3, 2.6]);
        c.beginPath();
        if (vert) { c.moveTo((x0 + x1) / 2, y0); c.lineTo((x0 + x1) / 2, y1); } else { c.moveTo(x0, (y0 + y1) / 2); c.lineTo(x1, (y0 + y1) / 2); }
        c.stroke(); c.setLineDash([]);
      },
    },
    zebra: {   // a crossing: white bars from kerb to kerb
      box: rectOf,
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H), vert = y1 - y0 > x1 - x0;
        c.fillStyle = "rgba(255,255,255,0.92)";
        if (vert) { for (let x = x0 + 0.6; x < x1 - 0.6; x += 2.4) c.fillRect(x, y0 + 1.2, 1.3, y1 - y0 - 2.4); }
        else { for (let y = y0 + 0.6; y < y1 - 0.6; y += 2.4) c.fillRect(x0 + 1.2, y, x1 - x0 - 2.4, 1.3); }
      },
    },
    park: {   // a little round park with a path
      box: (d, W, H) => grow(circOf(d, W, H), 1.4),
      draw(c, d, W, H) {
        const cx = d.x * W, cy = d.y * H, r = d.r * W;
        c.fillStyle = "#7cc257"; ellipse(c, cx, cy, r + 1.2, (r + 1.2) * SQ); c.fill();
        c.fillStyle = "#b6e38f"; ellipse(c, cx, cy, r, r * SQ); c.fill();
        c.strokeStyle = "#ead7a0"; c.lineWidth = 2.2; ellipse(c, cx, cy, r * 0.62, r * 0.62 * SQ); c.stroke();
      },
    },
    lot: {   // a parking lot
      box: rectOf,
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H);
        c.fillStyle = "#6b7280"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 0.45;
        c.beginPath();
        for (let x = x0 + 12; x < x1 - 1; x += 12) {
          c.moveTo(x, y0 + 1); c.lineTo(x, y0 + (y1 - y0) * 0.42);
          c.moveTo(x, y1 - 1); c.lineTo(x, y1 - (y1 - y0) * 0.42);
        }
        c.stroke();
        c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 0.8; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
      },
    },
    hedge: {   // a row of bushes
      box: (d, W, H) => grow(rectOf(d, W, H), 3),
      draw(c, d, W, H) {
        const [x0, , x1] = rectOf(d, W, H), cy = (d.y0 + d.y1) / 2 * H, r = 2.4;
        for (const [col, k, dy] of [["#4f9a3a", 1, 0], ["#6fb54e", 0.7, -0.6]]) {
          c.fillStyle = col;
          c.beginPath();
          for (let x = x0 + r; x <= x1 - r + 0.01; x += r * 1.35) { c.moveTo(x + r * k, cy + dy); c.ellipse(x, cy + dy, r * k, r * 0.8 * k, 0, 0, Math.PI * 2); }
          c.fill();
        }
      },
    },
    heart: {   // a heart-shaped rug
      box: (d, W, H) => circOf(d, W, H, 1.1),
      draw(c, d, W, H) {
        const s = d.r * W;
        c.translate(d.x * W, d.y * H); c.scale(1, SQ);
        const heart = (k) => {
          c.beginPath();
          c.moveTo(0, s * 0.62 * k);
          c.bezierCurveTo(-s * 1.05 * k, -s * 0.05 * k, -s * 0.5 * k, -s * 0.78 * k, 0, -s * 0.3 * k);
          c.bezierCurveTo(s * 0.5 * k, -s * 0.78 * k, s * 1.05 * k, -s * 0.05 * k, 0, s * 0.62 * k);
          c.closePath();
        };
        c.fillStyle = "#ff8fbf"; heart(1); c.fill();
        c.fillStyle = "#ffc2dd"; heart(0.84); c.fill();
      },
    },
    cloth: {   // a party table's cloth, scalloped
      box: (d, W, H) => grow(rectOf(d, W, H), 2.2),
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H);
        c.fillStyle = "#ff8fbf";
        c.beginPath();
        for (let x = x0; x <= x1 + 0.01; x += 4) {
          c.moveTo(x + 2, y1); c.arc(x, y1, 2, 0, Math.PI * 2);
          c.moveTo(x + 2, y0); c.arc(x, y0, 2, 0, Math.PI * 2);
        }
        c.fill();
        c.fillStyle = "#ffffff"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        c.fillStyle = "rgba(255,143,191,0.35)";
        c.beginPath();
        for (let y = y0 + 4, j = 0; y < y1 - 2; y += 8, j++) {
          for (let x = x0 + 4 + (j % 2) * 4; x < x1 - 2; x += 8) { c.moveTo(x + 0.9, y); c.arc(x, y, 0.9, 0, Math.PI * 2); }
        }
        c.fill();
      },
    },
    dance: {   // a disco dance floor
      box: rectOf,
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H), nx = 7, ny = 5, w = (x1 - x0) / nx, h = (y1 - y0) / ny;
        const cols = ["#ff5e9c", "#ffd24d", "#5ec8ff", "#7be08a", "#c77dff"];
        for (let j = 0; j < ny; j++) {
          for (let i = 0; i < nx; i++) { c.fillStyle = cols[(i * 2 + j * 3) % cols.length]; c.fillRect(x0 + i * w, y0 + j * h, w - 0.5, h - 0.5); }
        }
      },
    },
    nebula: {   // a glowing cloud of space dust
      // Stepped rings, not a radial gradient: a nebula is wider than the
      // screen, and a gradient that size is a per-pixel shader (it cost Outer
      // Space ~35ms a frame on an iPad-sized canvas in a software rasteriser).
      // Each ring is its own band (a hole cut by the next one in), so every
      // pixel is filled ONCE, whatever the number of rings; the alpha falls
      // off with the radius exactly as the gradient's did.
      prep(d) {
        const m = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(String(d.c).replace(/\s+/g, ""));
        return m ? { rgb: m[1] + "," + m[2] + "," + m[3], a: +m[4] } : { rgb: "255,255,255", a: 0.15 };
      },
      box: (d, W, H) => { const r = d.r * W; return [d.x * W - r, d.y * H - r, d.x * W + r, d.y * H + r]; },
      draw(c, d, W, H, p) {
        const cx = d.x * W, cy = d.y * H, r = d.r * W, N = 18;   // steps under 1.3% of alpha
        for (let k = 0; k < N; k++) {
          const ro = r * (1 - k / N), ri = r * (1 - (k + 1) / N);
          c.fillStyle = "rgba(" + p.rgb + "," + (p.a * (1 - (ro + ri) / (2 * r))).toFixed(3) + ")";
          c.beginPath();
          c.arc(cx, cy, ro, 0, Math.PI * 2);
          if (ri > 0) { c.moveTo(cx + ri, cy); c.arc(cx, cy, ri, 0, Math.PI * 2, true); }
          c.fill();
        }
      },
    },
    station: {   // the space station's deck
      box: (d, W, H) => grow(rectOf(d, W, H), 1.4),
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H);
        c.fillStyle = "#5b6178"; c.fillRect(x0 - 1.2, y0 - 1.2, x1 - x0 + 2.4, y1 - y0 + 2.4);
        c.fillStyle = "#8a90a8"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        c.strokeStyle = "rgba(40,44,64,0.55)"; c.lineWidth = 0.4;
        c.beginPath();
        for (let x = x0 + 12; x < x1 - 1; x += 12) { c.moveTo(x, y0); c.lineTo(x, y1); }
        for (let y = y0 + 9; y < y1 - 1; y += 9) { c.moveTo(x0, y); c.lineTo(x1, y); }
        c.stroke();
        c.fillStyle = "#ffd24d";
        c.beginPath();
        for (const [x, y] of [[x0 + 2.5, y0 + 2.5], [x1 - 2.5, y0 + 2.5], [x0 + 2.5, y1 - 2.5], [x1 - 2.5, y1 - 2.5]]) { c.moveTo(x + 1, y); c.arc(x, y, 1, 0, Math.PI * 2); }
        c.fill();
      },
    },
    // ---- phase 3 (§11): the six new places' features ----
    patch: {   // a soft patch of bare ground (a farmyard, the volcano's ash, a village)
      box: (d, W, H) => grow(circOf(d, W, H), 1.4),
      draw(c, d, W, H) {
        const cx = d.x * W, cy = d.y * H, r = d.r * W;
        c.fillStyle = "rgba(0,0,0,0.10)"; ellipse(c, cx, cy + 0.6, r + 1.2, (r + 1.2) * SQ); c.fill();
        c.fillStyle = d.c; ellipse(c, cx, cy, r, r * SQ); c.fill();
        c.fillStyle = "rgba(255,255,255,0.14)"; ellipse(c, cx - r * 0.25, cy - r * 0.2 * SQ, r * 0.5, r * 0.3 * SQ); c.fill();
      },
    },
    crops: {   // a field of crops in rows
      box: (d, W, H) => grow(rectOf(d, W, H), 1),
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H);
        c.fillStyle = "#9a6b3f"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        c.lineCap = "round";
        c.strokeStyle = d.c; c.lineWidth = 2.6;
        c.beginPath();
        for (let y = y0 + 3; y < y1 - 1; y += 5.2) { c.moveTo(x0 + 2, y); c.lineTo(x1 - 2, y); }
        c.stroke();
        c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 0.6;
        c.beginPath();
        for (let y = y0 + 2.2; y < y1 - 1.8; y += 5.2) { c.moveTo(x0 + 2.4, y); c.lineTo(x1 - 2.4, y); }
        c.stroke();
      },
    },
    soil: {   // a vegetable patch: dark soil in furrows
      box: rectOf,
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H);
        c.fillStyle = "#7a4f2c"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        c.strokeStyle = "rgba(160,110,70,0.6)"; c.lineWidth = 0.9;
        c.beginPath();
        for (let y = y0 + 3; y < y1 - 1; y += 4.4) { c.moveTo(x0 + 1, y); c.lineTo(x1 - 1, y); }
        c.stroke();
        c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 0.7; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
      },
    },
    pitch: {   // a football pitch's white lines
      box: (d, W, H) => grow(rectOf(d, W, H), 1),
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H), w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        c.fillStyle = "rgba(255,255,255,0.08)"; c.fillRect(x0, y0, w, h);
        c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 0.7;
        c.strokeRect(x0, y0, w, h);
        c.beginPath(); c.moveTo(cx, y0); c.lineTo(cx, y1); c.stroke();
        ellipse(c, cx, cy, h * 0.3, h * 0.3 * SQ); c.stroke();
        for (const [bx, dir] of [[x0, 1], [x1, -1]]) {
          c.strokeRect(dir > 0 ? bx : bx - w * 0.14, cy - h * 0.3, w * 0.14, h * 0.6);
          c.strokeRect(dir > 0 ? bx : bx - w * 0.05, cy - h * 0.14, w * 0.05, h * 0.28);
        }
      },
    },
    court: {   // a court: coloured, with white lines
      box: (d, W, H) => grow(rectOf(d, W, H), 1),
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H), w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
        c.fillStyle = "rgba(255,255,255,0.75)"; c.fillRect(x0 - 1.2, y0 - 1.2, w + 2.4, h + 2.4);
        c.fillStyle = d.c; c.fillRect(x0, y0, w, h);
        c.strokeStyle = "rgba(255,255,255,0.92)"; c.lineWidth = 0.6;
        c.strokeRect(x0 + 2, y0 + 2, w - 4, h - 4);
        c.beginPath(); c.moveTo(cx, y0 + 2); c.lineTo(cx, y1 - 2); c.stroke();
        ellipse(c, cx, (y0 + y1) / 2, h * 0.22, h * 0.22 * SQ); c.stroke();
      },
    },
    podium: {   // the winners' podium: silver, gold and bronze steps
      box: (d, W, H) => { const b = rectOf(d, W, H); return [b[0], b[1] - 12, b[2], b[3] + 1]; },
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H), w = (x1 - x0) / 3, base = y1;
        const steps = [[0, 7, "#cfd6de", "#a9b3bf"], [1, 11, "#ffd24d", "#d9a91c"], [2, 5, "#e6a46a", "#b9773f"]];
        for (const [i, hgt, top, side] of steps) {
          const x = x0 + i * w;
          c.fillStyle = side; c.fillRect(x, base - hgt, w, hgt);
          c.fillStyle = top; c.fillRect(x, base - hgt - w * 0.32 * SQ, w, w * 0.32 * SQ);
        }
      },
    },
    towel: {   // a striped beach towel with a fringe
      box: (d, W, H) => grow(rectOf(d, W, H), 2),
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H), n = 6, w = (x1 - x0) / n;
        for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? "#ffffff" : d.c; c.fillRect(x0 + i * w, y0, w, y1 - y0); }
        c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 0.35;
        c.beginPath();
        for (let x = x0 + 0.8; x < x1; x += 1.6) { c.moveTo(x, y0); c.lineTo(x, y0 - 1.6); c.moveTo(x, y1); c.lineTo(x, y1 + 1.6); }
        c.stroke();
      },
    },
    rockpool: {   // a rock pool: a ring of rocks around a little pool of sea water
      prep: (d, W, H, R) => {
        const r = d.r * W, rocks = [];
        for (let a = 0; a < Math.PI * 2; a += 0.42) rocks.push([Math.cos(a) * r, Math.sin(a) * r * SQ, 1.2 + R() * 1.4, 150 + Math.floor(R() * 50)]);
        return { rocks };
      },
      box: (d, W, H) => grow(circOf(d, W, H), 3),
      draw(c, d, W, H, p) {
        const cx = d.x * W, cy = d.y * H, r = d.r * W;
        c.fillStyle = "#4fb3e0"; ellipse(c, cx, cy, r, r * SQ); c.fill();
        c.fillStyle = "rgba(255,255,255,0.4)"; c.beginPath(); c.ellipse(cx - r * 0.3, cy - r * 0.2 * SQ, r * 0.3, r * 0.08, -0.2, 0, Math.PI * 2); c.fill();
        for (const [dx, dy, rr, v] of p.rocks) {
          c.fillStyle = "rgb(" + v + "," + (v - 4) + "," + (v - 14) + ")";
          c.beginPath(); c.ellipse(cx + dx, cy + dy, rr, rr * 0.8, 0, 0, Math.PI * 2); c.fill();
        }
      },
    },
    footprints: {   // little footprints across the sand
      prep(d, W, H) {
        const pts = ptsOf(d, W, H), prints = [];
        let side = 1;
        for (let i = 1; i < pts.length; i++) {
          const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay);
          const ux = (bx - ax) / len, uy = (by - ay) / len;
          for (let s = 0; s < len; s += 5) {
            prints.push([ax + ux * s - uy * 1.2 * side, ay + uy * s + ux * 1.2 * side, Math.atan2(uy, ux)]);
            side = -side;
          }
        }
        return { prints };
      },
      box: (d, W, H) => ptsBox(ptsOf(d, W, H), 4),
      draw(c, d, W, H, p) {
        c.fillStyle = "rgba(170,128,72,0.35)";
        c.beginPath();
        for (const [x, y, a] of p.prints) { c.moveTo(x + 1.1, y); c.ellipse(x, y, 1.1, 0.55, a, 0, Math.PI * 2); }
        c.fill();
      },
    },
    stones: {   // stepping stones along a path
      prep(d, W, H) {
        const pts = ptsOf(d, W, H), out = [];
        for (let i = 1; i < pts.length; i++) {
          const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay);
          for (let s = (i === 1 ? 0 : 9); s < len; s += 9) out.push([ax + (bx - ax) * (s / len) + ((out.length % 2) ? 1.6 : -1.6), ay + (by - ay) * (s / len)]);
        }
        return { stones: out };
      },
      box: (d, W, H) => ptsBox(ptsOf(d, W, H), 6),
      draw(c, d, W, H, p) {
        c.fillStyle = "#8f8a80";
        c.beginPath();
        for (const [x, y] of p.stones) { c.moveTo(x + 3, y); c.ellipse(x, y, 3, 3 * SQ, 0, 0, Math.PI * 2); }
        c.fill();
        c.fillStyle = "#b9b4aa";
        c.beginPath();
        for (const [x, y] of p.stones) { c.moveTo(x + 2.2, y - 0.5); c.ellipse(x, y - 0.5, 2.2, 2.2 * SQ, 0, 0, Math.PI * 2); }
        c.fill();
      },
    },
    drift: {   // a soft snow drift with a blue shadow
      box: (d, W, H) => grow(circOf(d, W, H), 2),
      draw(c, d, W, H) {
        const cx = d.x * W, cy = d.y * H, r = d.r * W;
        c.fillStyle = "rgba(160,184,222,0.45)"; ellipse(c, cx + r * 0.08, cy + r * 0.1 * SQ, r, r * SQ); c.fill();
        c.fillStyle = "#ffffff"; ellipse(c, cx - r * 0.04, cy - r * 0.04 * SQ, r * 0.94, r * 0.9 * SQ); c.fill();
        c.fillStyle = "rgba(220,234,252,0.9)"; ellipse(c, cx + r * 0.2, cy + r * 0.25 * SQ, r * 0.5, r * 0.3 * SQ); c.fill();
      },
    },
    ice: {   // a frozen pond: pale blue ice with a shine and a few cracks
      prep: (d, W, H, R) => {
        const r = d.r * W, cracks = [];
        for (let i = 0; i < 4; i++) {
          const a = R() * Math.PI * 2, q = 0.3 + R() * 0.4;
          cracks.push([Math.cos(a) * r * q, Math.sin(a) * r * q * SQ, a + (R() - 0.5), r * (0.18 + R() * 0.18)]);
        }
        return { cracks };
      },
      box: (d, W, H) => grow(circOf(d, W, H), 1.6),
      draw(c, d, W, H, p) {
        const cx = d.x * W, cy = d.y * H, r = d.r * W;
        c.fillStyle = "#9ccbeb"; ellipse(c, cx, cy, r + 1.2, (r + 1.2) * SQ); c.fill();
        c.fillStyle = "#cdeaf9"; ellipse(c, cx, cy, r, r * SQ); c.fill();
        c.strokeStyle = "rgba(255,255,255,0.95)"; c.lineWidth = 1.2; c.lineCap = "round";
        c.beginPath();
        c.moveTo(cx - r * 0.5, cy - r * 0.15 * SQ); c.lineTo(cx - r * 0.1, cy - r * 0.35 * SQ);
        c.moveTo(cx - r * 0.35, cy + r * 0.05 * SQ); c.lineTo(cx - r * 0.12, cy - r * 0.07 * SQ);
        c.stroke();
        c.strokeStyle = "rgba(110,160,205,0.6)"; c.lineWidth = 0.35;
        c.beginPath();
        for (const [dx, dy, a, l] of p.cracks) {
          c.moveTo(cx + dx, cy + dy); c.lineTo(cx + dx + Math.cos(a) * l, cy + dy + Math.sin(a) * l * SQ);
        }
        c.stroke();
      },
    },
    runway: {   // a runway: asphalt, edge lines, a dashed centre line and the "piano keys"
      box: (d, W, H) => grow(rectOf(d, W, H), 1),
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H), h = y1 - y0, cy = (y0 + y1) / 2;
        c.fillStyle = "#4b5059"; c.fillRect(x0, y0, x1 - x0, h);
        c.fillStyle = "rgba(255,255,255,0.92)";
        c.fillRect(x0 + 2, y0 + 1.2, x1 - x0 - 4, 0.6);
        c.fillRect(x0 + 2, y1 - 1.8, x1 - x0 - 4, 0.6);
        for (let x = x0 + 26; x < x1 - 30; x += 16) c.fillRect(x, cy - 0.4, 9, 0.8);
        for (const ex of [x0 + 4, x1 - 16]) {
          for (let k = 0; k < 6; k++) c.fillRect(ex, y0 + 3 + k * ((h - 6) / 6), 12, ((h - 6) / 6) * 0.55);
        }
      },
    },
    helipad: {   // a helipad: a dark disc, a white ring and a big H
      box: (d, W, H) => grow(circOf(d, W, H), 1),
      draw(c, d, W, H) {
        const r = d.r * W;
        c.translate(d.x * W, d.y * H); c.scale(1, SQ);
        c.fillStyle = "#3e434c"; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
        c.strokeStyle = "#ffffff"; c.lineWidth = 1.1; c.beginPath(); c.arc(0, 0, r * 0.82, 0, Math.PI * 2); c.stroke();
        c.fillStyle = "#ffffff";
        const s = r * 0.42;
        c.fillRect(-s * 0.6, -s, s * 0.28, s * 2); c.fillRect(s * 0.32, -s, s * 0.28, s * 2); c.fillRect(-s * 0.6, -s * 0.14, s * 1.2, s * 0.28);
      },
    },
    terminal: {   // the terminal's tiled floor, with a carpet to the gates
      box: (d, W, H) => grow(rectOf(d, W, H), 1),
      draw(c, d, W, H) {
        const [x0, y0, x1, y1] = rectOf(d, W, H);
        c.fillStyle = "#e7e9ee"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        c.strokeStyle = "rgba(120,128,140,0.35)"; c.lineWidth = 0.35;
        c.beginPath();
        for (let x = x0 + 8; x < x1 - 1; x += 8) { c.moveTo(x, y0); c.lineTo(x, y1); }
        for (let y = y0 + 6; y < y1 - 1; y += 6) { c.moveTo(x0, y); c.lineTo(x1, y); }
        c.stroke();
        c.fillStyle = "#5b7fd6"; c.fillRect(x0 + (x1 - x0) * 0.44, y0, (x1 - x0) * 0.12, y1 - y0);
        c.strokeStyle = "rgba(60,70,90,0.45)"; c.lineWidth = 0.9; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
      },
    },
  };

  // A place's ground features, worked out ONCE: each decal with its kind, its
  // prep (anything random, seeded by the place and the decal's index, so a
  // place always looks the same) and its bounding box in world units (for
  // culling). Pure — the engine tests call it to prove every feature a place
  // declares has a drawing and a real box.
  function prepDecals(def, W, H) {
    return (def.decals || []).map((d, i) => {
      const K = DECALS[d.k];
      if (!K) return null;
      const p = K.prep ? K.prep(d, W, H, rng(hashStr(def.id + ":decal:" + i))) : null;
      // a box takes (d, W, H) only: several are circOf, whose 4th argument
      // is a size factor, so handing one the prep would make its box NaN
      return { d, K, p, box: K.box(d, W, H) };
    }).filter(Boolean);
  }

  // The backdrop past the island's edge, drawn in SCREEN space (it is far away,
  // so it never scrolls): a wall for the indoor places, sky outside, and stars.
  const BACKDROPS = {
    wall(c, w, h) {
      c.fillStyle = "rgba(255,255,255,0.45)";
      for (let y = 12; y < h; y += 26) for (let x = (y / 26) % 2 ? 12 : 25; x < w; x += 26) { c.beginPath(); c.arc(x, y, 2.2, 0, Math.PI * 2); c.fill(); }
    },
    sky(c, w, h, R) {
      c.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 5; i++) {
        const x = R() * w, y = 20 + R() * h * 0.9, r = 14 + R() * 12;
        for (const [dx, dy, k] of [[0, 0, 1], [r * 0.9, 4, 0.8], [-r * 0.9, 5, 0.7]]) { c.beginPath(); c.arc(x + dx, y + dy, r * k, 0, Math.PI * 2); c.fill(); }
      }
    },
    stars(c, w, h, R) {
      for (let i = 0; i < 90; i++) {
        c.fillStyle = "rgba(255,255,255," + (0.3 + R() * 0.6).toFixed(2) + ")";
        c.beginPath(); c.arc(R() * w, R() * h, 0.5 + R() * 1.2, 0, Math.PI * 2); c.fill();
      }
    },
    // the island floats on the sea: little white wave crests all around
    sea(c, w, h, R) {
      c.strokeStyle = "rgba(255,255,255,0.7)"; c.lineWidth = 2; c.lineCap = "round";
      for (let i = 0; i < 46; i++) {
        const x = R() * w, y = R() * h, s = 6 + R() * 8;
        c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x, y - s * 0.55, x + s, y); c.stroke();
      }
    },
    // a winter sky, still: snowflakes hang in it (never animated — an
    // animated full-page background flashes on iOS)
    snowfall(c, w, h, R) {
      for (let i = 0; i < 110; i++) {
        c.fillStyle = "rgba(255,255,255," + (0.55 + R() * 0.4).toFixed(2) + ")";
        c.beginPath(); c.arc(R() * w, R() * h, 1 + R() * 2.4, 0, Math.PI * 2); c.fill();
      }
    },
    // a cave all round: lumps of dark rock, and a few crystals glinting
    rock(c, w, h, R) {
      for (let i = 0; i < 46; i++) {
        c.fillStyle = "rgba(255,255,255," + (0.03 + R() * 0.05).toFixed(3) + ")";
        c.beginPath(); c.arc(R() * w, R() * h, 18 + R() * 50, 0, Math.PI * 2); c.fill();
      }
      for (let i = 0; i < 26; i++) {
        c.fillStyle = ["#7fe8ff", "#ff9ff0", "#fff3a0"][i % 3];
        c.globalAlpha = 0.5 + R() * 0.4;
        starPath(c, R() * w, R() * h, 3 + R() * 3, 1, 4);
        c.fill();
      }
      c.globalAlpha = 1;
    },
    // under a circus tent: red and cream stripes, and the safety net far below
    tent(c, w, h) {
      const n = Math.max(6, Math.round(w / 70)), sw = w / n;
      c.fillStyle = "rgba(255,240,220,0.32)";
      for (let i = 0; i < n; i += 2) c.fillRect(i * sw, 0, sw, h);
      c.strokeStyle = "rgba(255,255,255,0.22)"; c.lineWidth = 1;
      c.beginPath();
      for (let x = -h; x < w; x += 22) { c.moveTo(x, h); c.lineTo(x + h * 0.6, h * 0.4); }
      for (let x = 0; x < w + h; x += 22) { c.moveTo(x, h); c.lineTo(x - h * 0.6, h * 0.4); }
      c.stroke();
    },
  };
  // Per ground: its backdrop and the island's front edge (its floor is GROUND_ART).
  const GROUNDS = {
    wood: { backdrop: "wall", edge: ["#a4703d", "#8a5a2f"] },
    grass: { backdrop: "sky", edge: ["#8b5a2b", "#6e4420"] },
    dirt: { backdrop: "sky", edge: ["#9b6a3b", "#7d522b"] },
    town: { backdrop: "sky", edge: ["#7a5230", "#5f3f24"] },
    party: { backdrop: "wall", edge: ["#e59ac1", "#c8729f"] },
    space: { backdrop: "stars", edge: ["#2b2f6e", "#1a1d4a"] },
    farm: { backdrop: "sky", edge: ["#8b5a2b", "#6e4420"] },
    pitch: { backdrop: "sky", edge: ["#7a5230", "#5f3f24"] },
    sand: { backdrop: "sea", edge: ["#d8b26c", "#b48c4a"] },
    jungle: { backdrop: "sea", edge: ["#6e4a2b", "#523520"] },
    snow: { backdrop: "snowfall", edge: ["#c3d4ea", "#9db3d0"] },
    tarmac: { backdrop: "sky", edge: ["#6b7280", "#4b5563"] },
    tiles: { backdrop: "wall", edge: ["#c3c8d2", "#a3a9b5"] },
    cave: { backdrop: "rock", edge: ["#43354f", "#2e2438"] },
    stone: { backdrop: "sky", edge: ["#9a9488", "#7c776c"] },
    metal: { backdrop: "wall", edge: ["#78808c", "#5c636e"] },
    ring: { backdrop: "tent", edge: ["#d23c3c", "#a32a2a"] },
    cloud: { backdrop: "sky", edge: ["#e3e9f7", "#c9d3ea"] },
    candy: { backdrop: "sky", edge: ["#ee95c0", "#cf74a2"] },
    stage: { backdrop: "sky", edge: ["#c9a24a", "#9c7a2e"] },
  };

  // ---- phase 4 (§14): the things Gobble walks ROUND, and what moves -------
  // A place's BLOCKS (water, lava, hedges, fences, shelves, walls) are drawn
  // from the engine's own outline of them (HoleLogic.outlineOf), so the
  // picture's edge and the walking edge are the same line. Water and lava lie
  // BELOW the ground (a bank shows at their far side); a hedge, a fence, a
  // shelf or a wall stands up out of it (a front face, then its top).
  const BLOCK_LOOKS = {
    water: { flat: true, deep: "#3d95d1", top: "#5cb6ea", shine: "rgba(255,255,255,0.55)", foam: "rgba(255,255,255,0.85)" },
    lava: { flat: true, bank: "#4a2a20", deep: "#d8401a", top: "#ff7a1a", shine: "rgba(255,226,90,0.9)", foam: "rgba(255,150,60,0.7)", glow: "rgba(255,120,40,0.35)" },
    hedge: { h: 3.2, side: "#3b782d", top: "#58a742", rim: "#7ac85a", deco: "bumps" },
    fence: { h: 2.6, side: "#8a5a2b", top: "#c9925a", rim: "#e6b884", deco: "posts" },
    shelf: { h: 4.2, side: "#d7dce6", top: "#eef1f6", rim: "#9aa6ba", deco: "goods" },
    wall: { h: 3.6, side: "#8b8d97", top: "#b8bac4", rim: "#d8dae2", deco: "bricks" },
    rock: { h: 3.0, side: "#4e4058", top: "#73627f", rim: "#9a88a8", deco: null },
  };
  // How each kind of bridge looks (it crosses water, lava or the void).
  const BRIDGE_LOOKS = {
    planks: { side: "#6e4524", deck: "#b9824a", edge: "#8a5a2b", slat: "rgba(90,56,26,0.55)", gap: 2.2 },
    rope: { side: "#5e3a1d", deck: "#c9965a", edge: "#5e3a1d", slat: "rgba(94,58,29,0.6)", gap: 1.8, ropes: true },
    stones: { stones: true },
    sandbar: { side: "#c9a160", deck: "#f0d59c", edge: "#e3c486", slat: null },
    rainbow: { side: "rgba(150,160,210,0.55)", rainbow: ["#ff6b6b", "#ffb443", "#ffe066", "#7be08a", "#5ec8ff", "#a98bff"] },
    stone: { side: "#77736a", deck: "#b9b4a8", edge: "#8f8a7f", slat: "rgba(110,104,92,0.5)", gap: 4 },
  };
  // Vehicles drawn facing LEFT (on Apple's art and Noto's): one that rides a
  // track to the right is drawn mirrored, so it drives forwards.
  const FACES_LEFT = new Set(["🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜",
    "🚂", "🛵", "🏍️", "🚤", "⛵", "🛥️", "🚁", "🛺", "🚲", "🛒"]);

  // A ring's bounding box, and which of its edges face the viewer (their
  // outward side points DOWN the screen): a raised wall shows a front face
  // only there, and its decoration (posts, goods, bricks) goes only there.
  // A ring's hole-ness is its nesting depth among its set's rings, so the
  // outward side is right whatever way the contour tracer walked it.
  function ringsInfo(rings) {
    const inPoly = (x, y, P) => {
      let ins = false;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        if ((P[i][1] > y) !== (P[j][1] > y) && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) ins = !ins;
      }
      return ins;
    };
    return rings.map((P, ri) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, A = 0;
      for (let i = 0; i < P.length; i++) {
        const p = P[i], q = P[(i + 1) % P.length];
        if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
        A += p[0] * q[1] - q[0] * p[1];
      }
      let depth = 0;
      rings.forEach((Q, qi) => { if (qi !== ri && inPoly(P[0][0], P[0][1], Q)) depth++; });
      const sign = (A > 0 ? 1 : -1) * (depth % 2 ? -1 : 1);
      const front = new Uint8Array(P.length);
      for (let i = 0; i < P.length; i++) {
        const p = P[i], q = P[(i + 1) % P.length], dx = q[0] - p[0];
        // outward normal (dy, -dx) * sign: it faces the viewer when its y > 0
        front[i] = -dx * sign > 1e-6 ? 1 : 0;
      }
      return { pts: P, box: [x0, y0, x1, y1], front };
    });
  }
  // The same line moved sideways by d on the GROUND (a rail beside its twin,
  // a river's streaks), as world points.
  function offsetLine(pts, d) {
    const g = pts.map((p) => [p[0], p[1] / SQ]), out = [];
    for (let i = 0; i < g.length; i++) {
      const a = g[Math.max(0, i - 1)], b = g[Math.min(g.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      out.push([g[i][0] - (dy / l) * d, (g[i][1] + (dx / l) * d) * SQ]);
    }
    return out;
  }
  // A line's length on the ground, and the point a distance s along it.
  function walkLine(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], (pts[i][1] - pts[i - 1][1]) / SQ));
    return {
      len: cum[cum.length - 1],
      at(s) {
        let i = 1;
        while (i < cum.length - 1 && cum[i] < s) i++;
        const seg = cum[i] - cum[i - 1] || 1, f = clamp((s - cum[i - 1]) / seg, 0, 1);
        const a = pts[i - 1], b = pts[i], ux = b[0] - a[0], uy = (b[1] - a[1]) / SQ, l = Math.hypot(ux, uy) || 1;
        return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, ux: ux / l, uy: uy / l };
      },
    };
  }

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
    // the camera, in world units: where it looks and how wide (short side)
    let cam = null, camT = 0, mode = "follow", intro = null;
    let backdrop = null, backdropKey = "";
    let decals = [];
    const inks = new Map(), sprites = new Map();
    const fx = [];
    let clock = 0;
    let shakeT = 0;
    let happyUntil = 0, wideUntil = 0, lookUp = 0, blinkAt = 3, blinkUntil = 0, starUntil = 0;
    let tasteFace = null, tasteUntil = 0, boingUntil = 0;   // §15.3
    let lastSlurp = 0, lastStreaks = 0;                       // §15.6
    let lastGoal = null, lastGold = 0, lastFace = null, goalHopAt = 0;
    const hopUntil = new Map();
    let arrow = null, noBiteSince = -1;
    let lastDraw = { objects: 0, standing: 0, falling: 0, decals: 0, ground: false, ok: false, tastes: {} };
    let tasteMarks = {};   // §15.3: the marks each kind of taste burst painted this frame (the tests read them)
    // §15.4/§15.5: the place's air (its specks, and how far the camera has
    // moved them), the finale's fireworks and the burst of air it blows out
    let air = null, lastAir = 0, fireworks = [], airBurst = null, lastFw = 0, lastBurst = 0;
    let frames = 0;   // every draw() that painted (the tests read it)
    // phase 4: the place's shape and what is in it, worked out once per place
    let geo = null, landRings = [], blockSets = [], bridges = [], tracks = [], flows = [], portals = [];
    let darkCv = null, lightCv = null, lastDark = 0;
    const flyIn = new Map();   // a surprise popping out: id -> where from, and when
    let lastFeat = { blocks: 0, bridges: 0, tracks: 0, flows: 0, portals: 0, locks: 0, keys: 0, flipped: 0 };

    const shortSide = () => Math.min(cssW, cssH) || 1;

    function resize() {
      const p = canvas.parentElement;
      const w = Math.max(1, Math.round(p ? p.clientWidth : canvas.clientWidth));
      const h = Math.max(1, Math.round(p ? p.clientHeight : canvas.clientHeight));
      const d = Math.min(2, global.devicePixelRatio || 1);
      if (w === cssW && h === cssH && d === dpr && canvas.width) return false;
      cssW = w; cssH = h; dpr = d;
      canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      backdrop = null;
      if (st && cam) { clampCam(cam); applyView(); }
      return true;
    }

    // ---- the camera ------------------------------------------------------------
    function wholeSpan() {
      const s = Math.min(cssW / (st.W + 2 * MARGIN), cssH / (st.H + RULES.TOP_SLACK + THICK + 2 * MARGIN));
      return shortSide() / Math.max(s, 1e-6);
    }
    function followTarget() { return { x: st.hole.x, y: st.hole.y, span: L.viewSpan(st, shortSide(), st.hole.level) }; }
    function wholeTarget() { return { x: st.W / 2, y: (st.H + THICK - RULES.TOP_SLACK) / 2, span: wholeSpan() }; }
    // The camera never looks more than MARGIN past the island (at an edge you
    // see its rim and the backdrop beyond — "this is the end", without words);
    // a view wider than the island is centred on it.
    function clampCam(c) {
      const s = shortSide() / c.span, hw = cssW / 2 / s, hh = cssH / 2 / s;
      // At the island's back edge a big Gobble's eyes stand ABOVE the world's
      // top, so while the camera follows him it may look up just far enough to
      // keep his whole face in view, 2px to spare (they were cut off by up to
      // 19px at the biggest sizes). The win's look at the whole island is not
      // following anyone, and keeps its frame.
      let y0 = -RULES.TOP_SLACK - MARGIN;
      if (mode !== "whole") y0 = Math.min(y0, st.hole.y - (faceUp(st.hole.r * s, !!L.goalOf(st), def && def.wear) + 2) / s);
      const x0 = -MARGIN, x1 = st.W + MARGIN, y1 = st.H + THICK + MARGIN;
      c.x = x1 - x0 <= 2 * hw ? (x0 + x1) / 2 : clamp(c.x, x0 + hw, x1 - hw);
      c.y = y1 - y0 <= 2 * hh ? (y0 + y1) / 2 : clamp(c.y, y0 + hh, y1 - hh);
      return c;
    }
    function applyView() {
      const s = shortSide() / cam.span;
      view = { s, ox: cssW / 2 - cam.x * s, oy: cssH / 2 - cam.y * s };
    }
    function updateCamera(now) {
      const dt = camT ? clamp(now - camT, 0, 0.1) : 0;
      camT = now;
      const goal = clampCam(mode === "whole" ? wholeTarget() : followTarget());
      if (!cam) cam = { ...goal };
      if (intro) {
        if (intro.t0 < 0) { intro.t0 = now; intro.from = { ...cam }; }
        const p = clamp((now - intro.t0 - INTRO_HOLD) / INTRO_S, 0, 1), e = easeInOut(p), f = intro.from;
        cam.x = f.x + (goal.x - f.x) * e;
        cam.y = f.y + (goal.y - f.y) * e;
        cam.span = Math.exp(Math.log(f.span) + (Math.log(goal.span) - Math.log(f.span)) * e);
        if (p >= 1) intro = null;
      } else {
        // follow: a short lag (no look-ahead — with a finger held at the
        // middle a look-ahead would make him drift for ever), the zoom easing
        // over most of a second at a grow; the win pulls back slowly
        const slow = mode === "whole";
        const ap = 1 - Math.exp(-dt * (slow ? 2.4 : 12)), as = 1 - Math.exp(-dt * (slow ? 2.4 : 4));
        cam.x += (goal.x - cam.x) * ap;
        cam.y += (goal.y - cam.y) * ap;
        cam.span = Math.exp(Math.log(cam.span) + (Math.log(goal.span) - Math.log(cam.span)) * as);
      }
      clampCam(cam);
      applyView();
    }
    // Jump straight to where the camera is heading (the tests, and autoplay).
    function snap() {
      if (!st || !cssW) return;
      intro = null;
      cam = clampCam(mode === "whole" ? wholeTarget() : followTarget());
      applyView();
    }
    // A finger during the opening look: the camera hands over to following.
    function endIntro() { intro = null; }

    const sx = (x) => view.ox + x * view.s;
    const sy = (y) => view.oy + y * view.s;
    function toWorld(px, py) { return { x: (px - view.ox) / view.s, y: (py - view.oy) / view.s }; }
    function toScreen(x, y) { return { x: sx(x), y: sy(y) }; }
    function viewRect(pad) {
      const s = view.s;
      return { x0: -view.ox / s - pad, y0: -view.oy / s - pad, x1: (cssW - view.ox) / s + pad, y1: (cssH - view.oy) / s + pad };
    }

    function setState(next, opts) {
      st = next;
      def = DATA.SCENES.find((d) => d.id === st.id) || DATA.SCENES[0];
      mode = "follow";
      fx.length = 0; hopUntil.clear(); shakeT = 0; starUntil = 0; goalHopAt = 0;
      tasteFace = null; tasteUntil = 0; boingUntil = 0;
      air = null; fireworks = []; airBurst = null;
      arrow = null; noBiteSince = -1;
      if (sprites.size > 120) sprites.clear();
      backdrop = null;
      decals = prepDecals(def, st.W, st.H);
      prepShape();
      flyIn.clear();
      intro = opts && opts.intro && !reduceMotion() ? { t0: -1, from: null } : null;
      camT = 0;
      cam = null;
      if (cssW) {
        cam = clampCam(intro ? wholeTarget() : followTarget());
        applyView();
      }
    }

    // ---- the backdrop and the island ------------------------------------------
    function backdropCanvas() {
      const key = [def.id, cssW, cssH, dpr].join("|");
      if (backdrop && backdropKey === key) return backdrop;
      const cv = document.createElement("canvas");
      cv.width = canvas.width; cv.height = canvas.height;
      const c = cv.getContext("2d");
      c.scale(dpr, dpr);
      const g = c.createLinearGradient(0, 0, 0, cssH);
      g.addColorStop(0, def.backdrop[0]); g.addColorStop(1, def.backdrop[1]);
      c.fillStyle = g; c.fillRect(0, 0, cssW, cssH);
      const G = GROUNDS[def.ground] || GROUNDS.wood;
      (BACKDROPS[G.backdrop] || BACKDROPS.wall)(c, cssW, cssH, rng(hashStr(def.id + ":bg")));
      backdrop = cv; backdropKey = key;
      return cv;
    }
    // The floor under the view: the ground's BASE once for the visible part,
    // then its MARKS square by square (a mark may reach PAD units past its
    // square, so squares just outside the view are drawn too).
    function drawGround(x0, y0, x1, y1) {
      const G = GROUND_ART[def.ground] || GROUND_ART.wood, PAD = 7, d = view.s * dpr;
      G.base(ctx, x0, y0, x1, y1);
      for (let ty = Math.floor((y0 - PAD) / TILE); ty * TILE < y1 + PAD; ty++) {
        for (let tx = Math.floor((x0 - PAD) / TILE); tx * TILE < x1 + PAD; tx++) {
          const seed = hashStr(def.ground + ":" + tx + "," + ty);
          ctx.save();
          ctx.translate(tx * TILE, ty * TILE);
          G.marks(ctx, TILE, (k) => rng(seed ^ hashStr(k)), d, tx, ty);
          ctx.restore();
        }
      }
    }
    // One light for the whole world, from the upper left: white at the top
    // left, nothing in the middle, a little shade at the bottom right. Not a
    // gradient: a gradient is a per-pixel shader (15ms a frame over an iPad
    // screen in a software rasteriser). It is BANDS instead — strips across
    // the world at right angles to the light, each one flat tint at its own
    // strength — so every pixel is filled once, and 12 bands a half keep each
    // step under 1.2% (invisible on a floor full of marks).
    const LIGHT_BANDS = 12;
    function lightTint(t) {
      if (t < 0.5) return "rgba(255,255,255," + (0.14 * (1 - t / 0.5)).toFixed(4) + ")";
      const u = (t - 0.5) / 0.5, v = Math.round(255 * (1 - u));
      return "rgba(" + v + "," + v + "," + v + "," + (0.1 * u).toFixed(4) + ")";
    }
    function drawLight(x0, y0, x1, y1) {
      const W = st.W, H = st.H, L2 = W * W + H * H;
      // t along the light: t = (x*W + y*H) / L2, 0 at the top-left corner
      const tOf = (x, y) => (x * W + y * H) / L2;
      const tLo = clamp(Math.min(tOf(x0, y0), tOf(x1, y1)), 0, 1), tHi = clamp(Math.max(tOf(x0, y0), tOf(x1, y1)), 0, 1);
      const n = LIGHT_BANDS * 2;
      // A band is the strip between two lines of equal t, drawn as a long
      // quadrilateral: t's axis runs corner to corner, (t*W, t*H), and each
      // line runs along (-H, W) far enough to cross the whole island. No
      // clip is needed: this runs inside the island's own clip (or, when the
      // view is all island, the canvas edge does the cutting).
      const ux = -H / Math.sqrt(L2), uy = W / Math.sqrt(L2), far = (W + H) * 1.5;
      for (let k = Math.floor(tLo * n); k < n && k / n <= tHi; k++) {
        const ta = k / n, tb = (k + 1) / n;
        ctx.fillStyle = lightTint((ta + tb) / 2);
        ctx.beginPath();
        ctx.moveTo(ta * W + ux * far, ta * H + uy * far); ctx.lineTo(ta * W - ux * far, ta * H - uy * far);
        ctx.lineTo(tb * W - ux * far, tb * H - uy * far); ctx.lineTo(tb * W + ux * far, tb * H + uy * far);
        ctx.closePath(); ctx.fill();
      }
    }
    // Does the view see only the island's top (no edge, no water past a
    // shore, no void)? The engine's coarse test, four lookups.
    function viewInsideIsland() {
      const v = viewRect(0);
      return !!geo && geo.inside(v.x0, v.y0, v.x1, v.y1);
    }
    // The island is the engine's own outline of it (one or more rings, holes
    // included, filled even-odd), so its picture and its walking edge are the
    // same line, whatever its shape: a heart, a spiral, a string of islands.
    function ringsPath(list, dx, dy) {
      ctx.beginPath();
      for (const R of list) {
        const P = R.pts;
        ctx.moveTo(P[0][0] + dx, P[0][1] + dy);
        for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0] + dx, P[i][1] + dy);
        ctx.closePath();
      }
    }
    const boxIn = (b, v, pad) => !(b[2] + (pad || 0) < v.x0 || b[0] - (pad || 0) > v.x1 || b[3] + (pad || 0) < v.y0 || b[1] - (pad || 0) > v.y1);
    function drawIsland(inside, now) {
      const W = st.W, H = st.H;
      ctx.save();
      ctx.translate(view.ox, view.oy); ctx.scale(view.s, view.s);
      const G = GROUNDS[def.ground] || GROUNDS.wood;
      if (!inside) {
        // a soft drop shadow: stacked translucent fills (no ctx.filter on iOS 14)
        for (let k = 3; k >= 1; k--) {
          ctx.fillStyle = "rgba(0,0,0," + (0.05 * (4 - k)).toFixed(2) + ")";
          ringsPath(landRings, k * 0.9, THICK + k * 1.6 - 1); ctx.fill("evenodd");
        }
        // the island's front edge: two layers of earth (a pit's far wall
        // shows the same way, from inside it)
        ctx.fillStyle = G.edge[1]; ringsPath(landRings, 0, THICK); ctx.fill("evenodd");
        ctx.fillStyle = G.edge[0]; ringsPath(landRings, 0, THICK * 0.45); ctx.fill("evenodd");
      }
      ctx.save();
      if (!inside) { ringsPath(landRings, 0, 0); ctx.clip("evenodd"); }
      const v = viewRect(2);
      const x0 = Math.max(0, v.x0), y0 = Math.max(0, v.y0), x1 = Math.min(W, v.x1), y1 = Math.min(H, v.y1);
      let nd = 0;
      const feat = { blocks: 0, bridges: 0, tracks: 0, flows: 0, portals: 0, locks: 0, keys: 0, flipped: 0 };
      if (x1 > x0 && y1 > y0) {
        drawGround(x0, y0, x1, y1);
        for (const dc of decals) {
          const b = dc.box;
          if (b[2] < v.x0 || b[0] > v.x1 || b[3] < v.y0 || b[1] > v.y1) continue;
          ctx.save();
          dc.K.draw(ctx, dc.d, W, H, dc.p);
          ctx.restore();
          nd++;
        }
        // what lies IN the ground: water and lava, then the rivers and belts
        feat.blocks += drawBlocks(true, v, now);
        feat.flows += drawFlows(v, now);
        drawLight(x0, y0, x1, y1);
      }
      ctx.restore();
      if (!inside) {
        ctx.strokeStyle = def.ground === "space" ? "rgba(140,130,255,0.55)" : "rgba(255,255,255,0.55)";
        ctx.lineWidth = 0.8; ringsPath(landRings, 0, 0); ctx.stroke();
      }
      // what stands on it or spans the gaps: tracks, then hedges, fences,
      // shelves and walls, then the bridges, then the portals
      feat.tracks += drawTracks(v);
      feat.blocks += drawBlocks(false, v, now);
      feat.bridges += drawBridges(v);
      feat.flows += drawSlides(v, now);
      feat.portals += drawPortals(v, now);
      ctx.restore();
      lastFeat = feat;
      return nd;
    }

    // ---- phase 4 (§14): the place's SHAPE, its blocks and what moves ---------
    function prepShape() {
      geo = L.geomOf(def);
      const O = L.outlineOf(def);
      landRings = ringsInfo(O.land);
      // the flat looks first (they lie in the ground), then the raised ones
      blockSets = Object.keys(O.blocks)
        .map((look) => ({ look, L: BLOCK_LOOKS[look] || BLOCK_LOOKS.water, rings: ringsInfo(O.blocks[look]) }))
        .sort((a, b) => (a.L.flat ? 0 : 1) - (b.L.flat ? 0 : 1));
      bridges = geo.bridges.map((b) => ({
        pts: b.pts, w: b.w, look: b.look, box: ptsBox(b.pts, b.w), line: walkLine(b.pts),
        l: offsetLine(b.pts, b.w * 0.46), r: offsetLine(b.pts, -b.w * 0.46),
      }));
      tracks = Object.values(geo.tracks).filter((t) => t.look !== "none").map((t) => ({
        t, box: ptsBox(t.pts, t.w + 4),
        a: offsetLine(t.pts, t.w * 0.3), b: offsetLine(t.pts, -t.w * 0.3),
        ea: offsetLine(t.pts, t.w * 0.47), eb: offsetLine(t.pts, -t.w * 0.47),
      }));
      flows = geo.flows.map((f) => ({
        f, box: ptsBox(f.pts, f.w),
        a: offsetLine(f.pts, f.w * 0.26), b: offsetLine(f.pts, -f.w * 0.26),
        ea: offsetLine(f.pts, f.w * 0.5), eb: offsetLine(f.pts, -f.w * 0.5),
      }));
      portals = geo.ends.map((e) => ({ x: e.x, y: e.y, look: e.look, live: e.live, pi: e.pi }));
    }

    // A stroke along a line of WORLD points, laid on the ground (so it is
    // foreshortened like the ground), optionally dashed — inside a save, so a
    // dash can never leak into the next thing drawn (the fort's Tail Wind lesson).
    function gline(pts, width, style, dash, offset) {
      ctx.save();
      ctx.scale(1, SQ);
      ctx.lineCap = dash ? "butt" : "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = style; ctx.lineWidth = width;
      if (dash && ctx.setLineDash) { ctx.setLineDash(dash); ctx.lineDashOffset = offset || 0; }
      smoothPath(ctx, pts.map((p) => [p[0], p[1] / SQ]));
      ctx.stroke();
      ctx.restore();
    }

    // Water and lava lie in the ground: the bank shows at the far side, the
    // deep below it, the surface shimmering; a foam (or a glow) round the edge.
    function drawBlocks(flat, v, now) {
      let n = 0;
      for (const S of blockSets) {
        if (!!S.L.flat !== flat) continue;
        const vis = S.rings.filter((R) => boxIn(R.box, v, flat ? 2 : (S.L.h || 0) + 2));
        if (!vis.length) continue;
        n += vis.length;
        if (flat) drawFlat(S.L, vis, now);
        else drawRaised(S.L, vis, v);
      }
      return n;
    }
    function drawFlat(K, rings, now) {
      const G = GROUNDS[def.ground] || GROUNDS.wood;
      if (K.glow) { ctx.strokeStyle = K.glow; ctx.lineWidth = 3.4; ctx.lineJoin = "round"; ringsPath(rings, 0, 0); ctx.stroke(); }
      ctx.save();
      ctx.fillStyle = K.bank || G.edge[0]; ringsPath(rings, 0, 0); ctx.fill("evenodd");
      ringsPath(rings, 0, 0); ctx.clip("evenodd");
      ctx.fillStyle = K.deep; ringsPath(rings, 0, 1.4); ctx.fill("evenodd");
      ctx.fillStyle = K.top; ringsPath(rings, 0, 2.7); ctx.fill("evenodd");
      // little ripples, seeded per pool, drifting gently (still under reduced motion)
      const ph = reduceMotion() ? 0 : now * 0.7;
      ctx.strokeStyle = K.shine; ctx.lineWidth = 0.45; ctx.lineCap = "round";
      ctx.beginPath();
      for (const R of rings) {
        const b = R.box, area = (b[2] - b[0]) * (b[3] - b[1]);
        const m = Math.min(60, Math.max(2, Math.round(area / 240)));
        const rr = rng(hashStr(def.id + ":rip:" + Math.round(b[0]) + "," + Math.round(b[1])));
        for (let i = 0; i < m; i++) {
          const x = b[0] + rr() * (b[2] - b[0]), y = b[1] + 3 + rr() * Math.max(1, b[3] - b[1] - 3), s = 1.1 + rr() * 1.5;
          const dx = Math.sin(ph + i * 1.7) * 0.9;
          ctx.moveTo(x - s + dx, y); ctx.quadraticCurveTo(x + dx, y - s * 0.45, x + s + dx, y);
        }
      }
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = K.foam; ctx.lineWidth = 0.7; ctx.lineJoin = "round";
      ringsPath(rings, 0, 0); ctx.stroke();
    }
    // A hedge, a fence, a shelf or a wall stands up out of the ground: a front
    // face (one quad per edge that faces the viewer, all wound the same way so
    // one fill draws them), its decoration, then its top, h units up.
    const GOODS = ["#ff6b6b", "#ffd24d", "#5ec8ff", "#7be08a", "#c77dff", "#ff9a3d", "#ffffff"];
    function drawRaised(K, rings, v) {
      const h = K.h;
      const visEdge = (a, b) => !(Math.max(a[0], b[0]) < v.x0 || Math.min(a[0], b[0]) > v.x1 || Math.max(a[1], b[1]) < v.y0 - h || Math.min(a[1], b[1]) > v.y1 + h);
      ctx.beginPath();
      const fronts = [];
      for (const R of rings) {
        const P = R.pts, n = P.length;
        for (let i = 0; i < n; i++) {
          if (!R.front[i]) continue;
          const a = P[i], b = P[(i + 1) % n];
          if (!visEdge(a, b)) continue;
          const l = a[0] <= b[0] ? a : b, r = a[0] <= b[0] ? b : a;
          ctx.moveTo(l[0], l[1]); ctx.lineTo(r[0], r[1]); ctx.lineTo(r[0], r[1] - h); ctx.lineTo(l[0], l[1] - h); ctx.closePath();
          fronts.push([l, r]);
        }
      }
      ctx.fillStyle = K.side; ctx.fill();
      // decoration on the faces
      if (K.deco === "posts") {
        ctx.fillStyle = "#6b4220";
        ctx.beginPath();
        for (const [l, r] of fronts) {
          const len = r[0] - l[0];
          for (let s = 0; s <= len; s += 3.2) {
            const t = len > 0 ? s / len : 0, x = l[0] + (r[0] - l[0]) * t, y = l[1] + (r[1] - l[1]) * t;
            ctx.rect(x - 0.35, y - h - 0.9, 0.7, h + 0.9);
          }
        }
        ctx.fill();
      } else if (K.deco === "goods") {
        for (let row = 0; row < 2; row++) {
          const ya = h * (row ? 0.48 : 0.9), yb = h * (row ? 0.12 : 0.54);
          for (let ci = 0; ci < GOODS.length; ci++) {
            ctx.fillStyle = GOODS[ci];
            ctx.beginPath();
            for (const [l, r] of fronts) {
              const len = r[0] - l[0];
              for (let s = 0.4; s + 1.2 <= len; s += 1.7) {
                const x = l[0] + s, k = Math.floor((x + row * 3) / 1.7);
                if ((((k * 7 + row) % GOODS.length) + GOODS.length) % GOODS.length !== ci) continue;
                const y = l[1] + ((r[1] - l[1]) * s) / (len || 1);
                ctx.rect(x, y - ya, 1.2, ya - yb);
              }
            }
            ctx.fill();
          }
        }
      } else if (K.deco === "bricks") {
        ctx.strokeStyle = "rgba(70,72,80,0.5)"; ctx.lineWidth = 0.3;
        ctx.beginPath();
        for (const [l, r] of fronts) {
          for (const f of [1 / 3, 2 / 3]) { ctx.moveTo(l[0], l[1] - h * f); ctx.lineTo(r[0], r[1] - h * f); }
          const len = r[0] - l[0];
          for (let s = 1.5; s < len; s += 3) {
            const x = l[0] + s, y = l[1] + ((r[1] - l[1]) * s) / (len || 1);
            const band = Math.floor(s / 3) % 3;
            ctx.moveTo(x, y - (h * band) / 3); ctx.lineTo(x, y - (h * (band + 1)) / 3);
          }
        }
        ctx.stroke();
      } else if (K.deco === "bumps") {
        ctx.fillStyle = "rgba(30,80,20,0.35)";
        ctx.beginPath();
        for (const [l, r] of fronts) {
          const len = r[0] - l[0];
          for (let s = 1; s < len; s += 2.2) {
            const x = l[0] + s, y = l[1] + ((r[1] - l[1]) * s) / (len || 1) - h * (0.3 + 0.4 * ((s * 7) % 1));
            ctx.moveTo(x + 0.5, y); ctx.arc(x, y, 0.5, 0, Math.PI * 2);
          }
        }
        ctx.fill();
      }
      // the top
      ctx.fillStyle = K.top; ringsPath(rings, 0, -h); ctx.fill("evenodd");
      ctx.strokeStyle = K.rim; ctx.lineWidth = 0.5; ctx.lineJoin = "round";
      ringsPath(rings, 0, -h); ctx.stroke();
      if (K.deco === "bumps") {
        // a hedge's leafy top: soft round bumps all along its rim
        ctx.fillStyle = K.rim;
        ctx.beginPath();
        for (const R of rings) {
          const P = R.pts, n = P.length;
          let carry = 0;
          for (let i = 0; i < n; i++) {
            const a = P[i], b = P[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (!visEdge(a, b)) { carry = 0; continue; }
            for (let s = carry; s < len; s += 2.6) {
              const t = s / len, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t - h - 0.2;
              ctx.moveTo(x + 0.8, y); ctx.arc(x, y, 0.8, 0, Math.PI * 2);
            }
            carry = (2.6 - ((len - carry) % 2.6)) % 2.6;
          }
        }
        ctx.fill();
      }
      if (K.deco === "goods") {
        // a shelf seen from above is FULL: rows of little packets on its top,
        // so it reads as a shelf and not a blank white bar (only the part in
        // view, a colour at a time, so a whole aisle is a few fills)
        ctx.save();
        ringsPath(rings, 0, -h); ctx.clip("evenodd");
        const SX = 2.1, SY = 2.5;
        for (let ci = 0; ci < GOODS.length; ci++) {
          ctx.fillStyle = GOODS[ci];
          ctx.beginPath();
          for (const R of rings) {
            const b = R.box;
            const xa = Math.max(b[0], v.x0) , xb = Math.min(b[2], v.x1), ya = Math.max(b[1] - h, v.y0 - h), yb = Math.min(b[3] - h, v.y1);
            for (let gy = Math.floor(ya / SY); gy * SY < yb; gy++) {
              for (let gx = Math.floor(xa / SX); gx * SX < xb; gx++) {
                if ((((gx * 5 + gy * 3) % GOODS.length) + GOODS.length) % GOODS.length !== ci) continue;
                ctx.rect(gx * SX + 0.35, gy * SY + 0.4, SX - 0.7, SY - 0.9);
              }
            }
          }
          ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = K.rim; ctx.lineWidth = 0.5; ringsPath(rings, 0, -h); ctx.stroke();
      }
    }

    // Rivers, conveyor belts and moving walkways: they carry Gobble, and their
    // marks MOVE the way they carry (still under reduced motion).
    function drawFlows(v, now) {
      let n = 0;
      const rm = reduceMotion();
      for (const F of flows) {
        if (!boxIn(F.box, v)) continue;
        n++;
        const f = F.f, off = rm ? 0 : -((now * f.v) % 240);
        if (f.look === "slide") { n--; continue; } // drawn ON its bridge, by drawSlides
        if (f.look === "belt") {
          gline(f.pts, f.w + 1.8, "#2f343d");
          gline(f.pts, f.w, "#555c69");
          gline(f.pts, f.w * 0.9, "#7a8293", [0.8, 2.4], off);
          gline(F.ea, 0.6, "#ffd24d", [1.4, 1.4]); gline(F.eb, 0.6, "#ffd24d", [1.4, 1.4]);
        } else if (f.look === "walkway") {
          gline(f.pts, f.w + 1.6, "#7d8796");
          gline(f.pts, f.w, "#c6ccd6");
          gline(f.pts, f.w * 0.86, "#9aa3b1", [0.5, 1.4], off);
          gline(F.ea, 0.8, "#3d5a96"); gline(F.eb, 0.8, "#3d5a96");
        } else {
          gline(f.pts, f.w + 2.8, "#2d7cb0");
          gline(f.pts, f.w, "#4daee5");
          gline(f.pts, f.w * 0.55, "#63bdee");
          gline(F.a, 0.55, "rgba(255,255,255,0.6)", [3.5, 7.5], off);
          gline(F.b, 0.55, "rgba(255,255,255,0.6)", [2.5, 9.5], off * 1.15);
          gline(f.pts, 0.6, "rgba(255,255,255,0.45)", [5, 12], off * 0.9);
          gline(F.ea, 0.6, "rgba(255,255,255,0.55)"); gline(F.eb, 0.6, "rgba(255,255,255,0.55)");
        }
      }
      return n;
    }

    // A rainbow SLIDE runs along a bridge over the open sky, so it is drawn on
    // top of it: bright chevrons sliding the way it carries him, so a child
    // can see it is a ride and which way it goes.
    function drawSlides(v, now) {
      let n = 0;
      const rm = reduceMotion();
      for (const F of flows) {
        const f = F.f;
        if (f.look !== "slide" || !boxIn(F.box, v)) continue;
        n++;
        const P = f.pts, step = 9, half = f.w * 0.32;
        let along = rm ? 0 : (now * f.v * 0.5) % step;
        ctx.save();
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        for (const [style, lw] of [["rgba(70,40,120,0.35)", 2.2], ["rgba(255,255,255,0.95)", 1.1]]) {
          ctx.strokeStyle = style; ctx.lineWidth = lw;
          ctx.beginPath();
          let carry = along;
          for (let i = 1; i < P.length; i++) {
            const ax = P[i - 1][0], ay = P[i - 1][1], dx = P[i][0] - ax, dy = P[i][1] - ay, len = Math.hypot(dx, dy);
            if (len < 1e-6) continue;
            const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
            for (let s = carry; s < len; s += step) {
              const cx = ax + ux * s, cy = ay + uy * s;
              ctx.moveTo(cx - ux * 3 + nx * half, cy - uy * 3 + ny * half * SQ);
              ctx.lineTo(cx, cy);
              ctx.lineTo(cx - ux * 3 - nx * half, cy - uy * 3 - ny * half * SQ);
            }
            carry = ((carry - len) % step + step) % step;
          }
          ctx.stroke();
        }
        ctx.restore();
      }
      return n;
    }

    // The lines things ride: a toy train's rails, a road, a running lane, an
    // orbit, a taxiway. (A track that is part of a road decal draws nothing.)
    function drawTracks(v) {
      let n = 0;
      for (const T of tracks) {
        if (!boxIn(T.box, v)) continue;
        n++;
        const t = T.t;
        if (t.look === "rails" || t.look === "coaster") {
          const coaster = t.look === "coaster";
          gline(t.pts, t.w * 0.95, coaster ? "#ffffff" : "#8a5a2b", [0.9, 1.7]);
          const rail = coaster ? "#e0384f" : "#7d8794";
          gline(T.a, coaster ? 0.8 : 0.55, rail); gline(T.b, coaster ? 0.8 : 0.55, rail);
        } else if (t.look === "road") {
          gline(t.pts, t.w + 1.4, "#d9d8d0");
          gline(t.pts, t.w, "#5d6572");
          gline(t.pts, 0.5, "#ffd24d", [3, 2.6]);
        } else if (t.look === "lane") {
          gline(t.pts, t.w, "rgba(217,100,58,0.9)");
          gline(T.ea, 0.4, "rgba(255,255,255,0.9)"); gline(T.eb, 0.4, "rgba(255,255,255,0.9)");
        } else if (t.look === "taxi") {
          gline(t.pts, t.w, "rgba(255,255,255,0.10)");
          gline(t.pts, 0.55, "#ffd24d");
        } else if (t.look === "orbit") {
          gline(t.pts, 0.55, "rgba(205,215,255,0.5)", [1.6, 1.8]);
        } else if (t.look === "wire") {
          gline(t.pts, 0.45, "rgba(80,70,60,0.75)");
        }
      }
      return n;
    }

    // Bridges over water, lava or the void: a side (its thickness, seen where
    // it crosses), then the deck and its planks, ropes, stones or stripes.
    function drawBridges(v) {
      let n = 0;
      for (const B of bridges) {
        if (!boxIn(B.box, v)) continue;
        n++;
        const K = BRIDGE_LOOKS[B.look] || BRIDGE_LOOKS.planks;
        if (K.stones) {
          const ln = B.line, rr = B.w * 0.36;
          for (const [col, dy, k] of [["#8f8a80", 0.5, 1], ["#bdb8ae", 0, 0.82]]) {
            ctx.fillStyle = col;
            ctx.beginPath();
            for (let s = 3, i = 0; s < ln.len - 2; s += rr * 2.1, i++) {
              const p = ln.at(s), side = i % 2 ? 0.25 : -0.25;
              const x = p.x - p.uy * side * rr, y = p.y + p.ux * side * rr * SQ + dy;
              ctx.moveTo(x + rr * k, y); ctx.ellipse(x, y, rr * k, rr * k * SQ, 0, 0, Math.PI * 2);
            }
            ctx.fill();
          }
          continue;
        }
        if (K.rainbow) {
          gline(B.pts.map((p) => [p[0], p[1] + 1.8]), B.w, K.side);
          K.rainbow.forEach((col, i) => gline(B.pts, B.w * (1 - i / K.rainbow.length), col));
          continue;
        }
        gline(B.pts.map((p) => [p[0], p[1] + 1.8]), B.w, K.side);
        gline(B.pts, B.w + 0.8, K.edge);
        gline(B.pts, B.w, K.deck);
        if (K.slat) {
          const ln = B.line, half = B.w * 0.46;
          ctx.strokeStyle = K.slat; ctx.lineWidth = 0.32;
          ctx.beginPath();
          for (let s = K.gap / 2; s < ln.len; s += K.gap) {
            const p = ln.at(s);
            ctx.moveTo(p.x - p.uy * half, p.y + p.ux * half * SQ); ctx.lineTo(p.x + p.uy * half, p.y - p.ux * half * SQ);
          }
          ctx.stroke();
        }
        if (K.ropes) {
          // rope rails a little above the deck, on posts
          gline(B.l.map((p) => [p[0], p[1] - 1.4]), 0.4, K.edge);
          gline(B.r.map((p) => [p[0], p[1] - 1.4]), 0.4, K.edge);
          ctx.strokeStyle = K.edge; ctx.lineWidth = 0.4;
          ctx.beginPath();
          for (const side of [B.l, B.r]) {
            const w = walkLine(side);
            for (let s = 0; s <= w.len; s += 6) { const p = w.at(s); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 1.6); }
          }
          ctx.stroke();
        }
      }
      return n;
    }

    // Portals: a wormhole (space) or a trampoline (a spring that throws him
    // to another platform). Both ends shown; an exit-only end is fainter.
    function drawPortals(v, now) {
      let n = 0;
      const rm = reduceMotion(), R = RULES.PORTAL_R * 1.3;
      for (const E of portals) {
        if (E.x + R < v.x0 || E.x - R > v.x1 || E.y + R < v.y0 || E.y - R > v.y1) continue;
        n++;
        ctx.save();
        ctx.translate(E.x, E.y); ctx.scale(1, SQ);
        if (!E.live) ctx.globalAlpha = 0.6;
        if (E.look === "spring") {
          ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.arc(0.8, 1.2, R, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#cf2c4b"; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#2c43b0"; ctx.beginPath(); ctx.arc(0, 0, R * 0.78, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#ffd24d"; ctx.lineWidth = 0.45;
          ctx.beginPath();
          for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2;
            ctx.moveTo(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8); ctx.lineTo(Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98);
          }
          ctx.stroke();
          const b = rm ? 0.1 : 0.1 + Math.abs(Math.sin(now * 3 + E.pi)) * 0.12;
          ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.arc(0, 0, R * (0.4 + b), Math.PI * 1.1, Math.PI * 1.85); ctx.stroke();
        } else {
          const cols = ["#22104f", "#4320a0", "#7a52f0", "#b39cff"];
          cols.forEach((col, k) => {
            ctx.fillStyle = col;
            ctx.beginPath(); ctx.arc(0, 0, R * (1 - k * 0.2), 0, Math.PI * 2); ctx.fill();
          });
          ctx.fillStyle = "#0c0520"; ctx.beginPath(); ctx.arc(0, 0, R * 0.28, 0, Math.PI * 2); ctx.fill();
          const spin = rm ? 0 : now * (E.pi % 2 ? -2.2 : 2.2);
          ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 0.5; ctx.lineCap = "round";
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            for (let t = 0; t <= 1.001; t += 0.1) {
              const a = spin + k * 2.09 + t * 3, rr = (0.3 + t * 0.62) * R;
              if (t === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            ctx.stroke();
          }
        }
        ctx.restore();
      }
      return n;
    }

    // DARK places (a cave): the screen is dark but for the light round Gobble
    // and round every thing that glows (gems, keys, the finale, treasures).
    // The dark is a quarter-size canvas — light spots cut out of it, then it is
    // drawn up over the screen in one go — so a dozen lights cost a dozen tiny
    // draws, and the lights' edges come out soft. The lights come on for the win.
    function lightSprite() {
      if (lightCv) return lightCv;
      const S = 64;
      lightCv = document.createElement("canvas");
      lightCv.width = S; lightCv.height = S;
      const c = lightCv.getContext("2d");
      const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.55, "rgba(255,255,255,0.75)"); g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g; c.fillRect(0, 0, S, S);
      return lightCv;
    }
    function drawDark() {
      lastDark = 0;
      if (!def.dark) return;
      const k = st.won ? clamp(1 - st.winT / 1.4, 0, 1) : 1;
      if (k <= 0) return;
      const w = Math.max(32, Math.ceil(cssW / 4)), hh = Math.max(32, Math.ceil(cssH / 4)), q = w / cssW;
      if (!darkCv || darkCv.width !== w || darkCv.height !== hh) {
        darkCv = document.createElement("canvas");
        darkCv.width = w; darkCv.height = hh;
      }
      const d = darkCv.getContext("2d"), spot = lightSprite();
      d.globalCompositeOperation = "source-over";
      d.clearRect(0, 0, w, hh);
      d.fillStyle = "rgba(9,5,24," + (0.9 * k).toFixed(3) + ")";
      d.fillRect(0, 0, w, hh);
      d.globalCompositeOperation = "destination-out";
      const light = (x, y, r) => d.drawImage(spot, (x - r) * q, (y - r * 0.8) * q, 2 * r * q, 1.6 * r * q);
      const h = st.hole;
      light(sx(h.x), sy(h.y) - h.r * view.s * 0.4, Math.max(130, h.r * view.s * 3.6));
      let n = 1;
      for (const o of st.objects) {
        if (o.st !== 0 || !(o.glow || o.gold)) continue;
        if (!onScreen(o, -80)) continue;
        const size = drawSize(o);
        light(sx(o.x), sy(o.y) - size * 0.45, Math.max(30, size * 1.5));
        n++;
      }
      for (const E of portals) {
        const x = sx(E.x), y = sy(E.y);
        if (x < -80 || y < -80 || x > cssW + 80 || y > cssH + 80) continue;
        light(x, y, RULES.PORTAL_R * 2.6 * view.s);
        n++;
      }
      d.globalCompositeOperation = "source-over";
      ctx.drawImage(darkCv, 0, 0, cssW, cssH);
      lastDark = n;
    }

    // ---- sprites: every emoji's ink measured ONCE, drawn in size steps --------
    // measureText's ink box is not trustworthy across engines (the fort's
    // bed-glyph lesson), so the ink is found by scanning pixels — once per
    // emoji, at INK_REF, then scaled. A font with no glyph yields no ink, and
    // the thing draws as a coloured ball rather than vanishing.
    function inkOf(e) {
      let k = inks.get(e);
      if (k) return k;
      const f = INK_REF, box = Math.ceil(f * 1.8);
      const cv = document.createElement("canvas");
      cv.width = box; cv.height = box;
      const c = cv.getContext("2d");
      c.font = f + "px " + EMOJI_FONT;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(e, box / 2, box / 2);
      let x0 = box, y0 = box, x1 = -1, y1 = -1, n = 0, rs = 0, gs = 0, bs = 0;
      try {
        const d = c.getImageData(0, 0, box, box).data;
        for (let y = 0; y < box; y++) {
          for (let x = 0; x < box; x++) {
            const i = (y * box + x) * 4;
            if (d[i + 3] > 24) {
              if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
              if (d[i + 3] > 200) { n++; rs += d[i]; gs += d[i + 1]; bs += d[i + 2]; }
            }
          }
        }
      } catch (err) { x1 = -1; }
      if (x1 < 0 || n < 8) {
        const hue = hashStr(e) % 360;
        k = { ok: false, hue, color: "hsl(" + hue + ",70%,60%)" };
      } else {
        const o = box / 2;
        k = {
          ok: true,
          // the ink box, relative to the text's anchor, per font px
          x0: (x0 - o) / f, y0: (y0 - o) / f, x1: (x1 + 1 - o) / f, y1: (y1 + 1 - o) / f,
          color: "rgb(" + Math.round(rs / n) + "," + Math.round(gs / n) + "," + Math.round(bs / n) + ")",
        };
        k.big = Math.max(k.x1 - k.x0, k.y1 - k.y0);
      }
      inks.set(e, k);
      return k;
    }
    // Half-octave steps, rounded UP (a sprite is only ever drawn smaller).
    const stepOf = (px) => clamp(Math.pow(2, Math.ceil(Math.log2(Math.max(8, px)) * 2) / 2), 8, 512);
    function sprite(e, px) {
      const b = stepOf(px), key = e + "|" + b;
      let sp = sprites.get(key);
      if (sp) return sp;
      // bounded: a long session through many sizes (six places, rotations)
      // must not grow the cache without limit — iOS caps canvas memory
      if (sprites.size > 220) sprites.clear();
      const ink = inkOf(e), PAD = 2;
      const cv = document.createElement("canvas");
      if (!ink.ok) {
        const s = Math.round(b);
        cv.width = s + PAD * 2; cv.height = s + PAD * 2;
        const o = cv.getContext("2d");
        o.fillStyle = "hsl(" + ink.hue + ",70%,60%)"; o.beginPath(); o.arc(cv.width / 2, cv.height / 2, s * 0.45, 0, Math.PI * 2); o.fill();
        o.strokeStyle = "hsl(" + ink.hue + ",60%,30%)"; o.lineWidth = Math.max(1, s * 0.06); o.stroke();
        sp = { cv, w: cv.width, h: cv.height, b: s, pad: PAD, ink: false };
      } else {
        const f = b / ink.big;
        const w = Math.ceil((ink.x1 - ink.x0) * f) + PAD * 2, h = Math.ceil((ink.y1 - ink.y0) * f) + PAD * 2;
        cv.width = w; cv.height = h;
        const o = cv.getContext("2d");
        o.font = f.toFixed(2) + "px " + EMOJI_FONT;
        o.textAlign = "center"; o.textBaseline = "middle";
        o.fillText(e, PAD - ink.x0 * f, PAD - ink.y0 * f);
        sp = { cv, w, h, b, pad: PAD, ink: true };
      }
      sprites.set(key, sp);
      return sp;
    }
    // CSS-px size of an object's sprite: its larger ink side is VIS * r
    function drawSize(o) { return VIS * o.r * view.s; }
    // An emoji centred on (x, y), its larger ink side `size` css px.
    function glyph(e, x, y, size) {
      const sp = sprite(e, size * dpr), f = size / sp.b;
      ctx.drawImage(sp.cv, x - (sp.w * f) / 2, y - (sp.h * f) / 2, sp.w * f, sp.h * f);
    }

    function drawObject(o, x, y, rot, scale, alpha, flip) {
      // The sprite is always requested at the thing's FULL size and scaled at
      // draw time, so a shrinking fall never mints a canvas per size.
      const size = drawSize(o) * scale;
      const sp = sprite(o.e, drawSize(o) * dpr);
      const f = size / sp.b, w = sp.w * f, h = sp.h * f, pad = sp.pad * f;
      ctx.save();
      ctx.translate(x, y);
      if (rot) ctx.rotate(rot);
      if (flip) ctx.scale(-1, 1);
      if (alpha < 1) ctx.globalAlpha = alpha;
      ctx.drawImage(sp.cv, -w / 2, -(h - pad), w, h);
      ctx.restore();
    }
    // A KEY glows with a soft pulsing ring on the ground ("find me!"), and a
    // locked thing wears a little padlock until its key is eaten.
    function keyGlow(now, x, y, r) {
      const rm = reduceMotion(), R = r * view.s;
      for (let k = 0; k < 2; k++) {
        const p = rm ? 0.3 + k * 0.4 : (now * 0.9 + k * 0.5) % 1;
        const rr = R * (1.05 + 0.8 * p), a = rm ? 0.75 : 0.9 * (1 - p);
        ctx.lineWidth = Math.max(2.5, R * 0.12) + 3; ctx.strokeStyle = "rgba(110,60,0," + (a * 0.5).toFixed(3) + ")";
        ellipse(ctx, x, y, rr, rr * SQ); ctx.stroke();
        ctx.lineWidth = Math.max(2.5, R * 0.12); ctx.strokeStyle = "rgba(255,226,110," + a.toFixed(3) + ")";
        ellipse(ctx, x, y, rr, rr * SQ); ctx.stroke();
      }
    }
    function lockBadge(o, x, y) {
      const size = drawSize(o), s = Math.max(14, size * 0.36);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath(); ctx.arc(x + size * 0.3, y - size * 0.86, s * 0.62, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "#b8860b"; ctx.stroke();
      glyph("🔒", x + size * 0.3, y - size * 0.86, s * 0.8);
    }

    // A SOFT contact shadow, from one pre-rendered sprite. A flat filled
    // ellipse under every thing read as a hard dark oval — the "circles after
    // circles" look the owner once reported in the fort — so the falloff is a
    // radial gradient that reaches zero at the edge.
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

    // ---- gold: the treasures and the goal (PLAN_GOBBLE.md §12) --------------
    // A treasure is an ordinary thing that glitters: a soft gold glow on the
    // ground under it, and three twinkles round it (still under reduced
    // motion, and only once it is big enough on screen to carry them).
    let glowCv = null;
    function glowSprite() {
      if (glowCv) return glowCv;
      const S = 64;
      glowCv = document.createElement("canvas");
      glowCv.width = S; glowCv.height = S;
      const c = glowCv.getContext("2d");
      const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0, "rgba(255,214,64,1)"); g.addColorStop(0.55, "rgba(255,200,40,0.55)"); g.addColorStop(1, "rgba(255,190,30,0)");
      c.fillStyle = g; c.fillRect(0, 0, S, S);
      return glowCv;
    }
    function goldGlow(x, y, r) {
      const rx = r * view.s * 1.7, ry = rx * SQ;
      ctx.globalAlpha = 0.75;
      ctx.drawImage(glowSprite(), x - rx, y - ry, rx * 2, ry * 2);
      ctx.globalAlpha = 1;
    }
    function twinkles(now, o, x, y) {
      const size = drawSize(o);
      if (size < 14) return;
      const rm = reduceMotion(), cy = y - size * 0.45, rr = size * 0.58;
      const a0 = rm ? 0.4 : now * 0.9;
      for (let k = 0; k < 3; k++) {
        const a = a0 + k * 2.1, tw = rm ? 0.8 : 0.55 + 0.45 * Math.abs(Math.sin(now * 4 + k * 1.7));
        const px = x + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.8, R = Math.max(4, size * 0.17) * tw;
        ctx.fillStyle = GOLD.dark + "0.6)";
        starPath(ctx, px, py, R * 1.25, R * 0.45, 4); ctx.fill();
        ctx.fillStyle = GOLD.hi;
        starPath(ctx, px, py, R, R * 0.32, 4); ctx.fill();
        ctx.fillStyle = "#ffffff";
        starPath(ctx, px, py, R * 0.5, R * 0.18, 4); ctx.fill();
      }
    }
    // THE GOAL'S BEACON: once Gobble is big enough, the finale calls him —
    // rings pulse out on the ground round its foot (drawn UNDER it, like a
    // spotlight on the floor), it hops every GOAL_HOP seconds ("eat me!") and
    // it twinkles. The rings are white on a dark band, not gold: half the
    // finales stand on a stage that is gold already. Off screen, the edge
    // arrow points at it instead. Still rings and no hop under reduced motion.
    function drawGoal(now) {
      lastGoal = null;
      const g = L.goalOf(st);
      if (!g) return;
      const x = sx(g.x), y = sy(g.y), R = g.r * view.s;
      if (x < -R * 2 || x > cssW + R * 2 || y < -R * 2 || y > cssH + R * 2) return;
      const rm = reduceMotion();
      for (let k = 0; k < 2; k++) {
        const p = rm ? 0.25 + k * 0.4 : (now * 0.8 + k * 0.5) % 1;
        const r = R * (1.1 + 0.9 * p), a = rm ? 0.85 : 0.95 * (1 - p);
        const w = Math.max(3, R * 0.11 * (1 - p * 0.4));
        ctx.lineWidth = w + 4; ctx.strokeStyle = "rgba(60,25,90," + (a * 0.6).toFixed(3) + ")";
        ellipse(ctx, x, y, r, r * SQ); ctx.stroke();
        ctx.lineWidth = w; ctx.strokeStyle = "rgba(255,250,225," + a.toFixed(3) + ")";
        ellipse(ctx, x, y, r, r * SQ); ctx.stroke();
      }
      if (!rm && now >= goalHopAt) { hopUntil.set(g.id, now + 0.55); goalHopAt = now + GOAL_HOP; }
      lastGoal = { id: g.id, x, y };
    }

    // ---- the super slurp (§15.6) ---------------------------------------------------
    // While it lasts, arms of a swirl reach out over the ground round him as
    // far as the slurp pulls (for the smallest thing — a bigger thing's reach
    // is a little longer), turning inward; and a thing it has hold of from
    // afar streaks in. Dark under white, so it reads on every floor; the
    // swirl stands still under reduced motion, and fades over its last 0.4s.
    function drawSlurp(now) {
      lastSlurp = 0;
      if (!(st.slurpT > 0)) return;  // (the engine ends it at the win)
      const h = st.hole, S = RULES.SLURP, P = RULES.PULL;
      const cx = sx(h.x), cy = sy(h.y);
      const r1 = h.r * 1.15 * view.s;
      const r2 = (h.r * (1 + P[1] + S.reach[1]) + P[0] + S.reach[0]) * view.s;
      const a = clamp(st.slurpT / 0.4, 0, 1);
      const spin = reduceMotion() ? 0 : -now * 3.2;
      const w = Math.max(2.5, r1 * 0.09);
      const ARMS = 4;
      for (let k = 0; k < ARMS; k++) {
        ctx.beginPath();
        for (let t = 0; t <= 1.0001; t += 0.05) {
          const ang = spin + (k / ARMS) * TAU + t * 2.4, rr = r2 - (r2 - r1) * t;
          const px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr * SQ;
          if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.lineCap = "round";
        ctx.lineWidth = w + 4; ctx.strokeStyle = "rgba(40,20,80," + (0.42 * a).toFixed(3) + ")"; ctx.stroke();
        ctx.lineWidth = w; ctx.strokeStyle = (k % 2 ? "rgba(255,226,110," : "rgba(255,255,255,") + (0.9 * a).toFixed(3) + ")"; ctx.stroke();
        lastSlurp++;
      }
      // the edge of the pull: a faint ring
      ctx.lineWidth = Math.max(1.5, w * 0.45); ctx.strokeStyle = "rgba(255,255,255," + (0.35 * a).toFixed(3) + ")";
      ellipse(ctx, cx, cy, r2, r2 * SQ); ctx.stroke();
      ctx.lineCap = "butt";
    }
    // Speed lines behind a thing streaking in: three, from its side away
    // from Gobble, at its middle height.
    function streak(o, x, y) {
      const h = st.hole, R = o.r * view.s;
      const my = y - VIS * R * 0.5;
      let dx = x - sx(h.x), dy = my - sy(h.y);
      const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const L = R * 1.7, ox = -dy, oy = dx;
      ctx.lineCap = "round";
      for (let k = -1; k <= 1; k++) {
        const bx = x + dx * R * 0.7 + ox * k * R * 0.42, by = my + dy * R * 0.7 + oy * k * R * 0.42;
        const len = L * (k ? 0.7 : 1);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + dx * len, by + dy * len);
        ctx.lineWidth = Math.max(2, R * 0.16) + 3; ctx.strokeStyle = "rgba(40,20,80,0.4)"; ctx.stroke();
        ctx.lineWidth = Math.max(2, R * 0.16); ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.stroke();
      }
      ctx.lineCap = "butt";
    }

    // ---- the hole ---------------------------------------------------------------
    function drawHole(now) {
      const h = st.hole, pal = HOLES[def.hole] || HOLES.gobble;
      const cx = sx(h.x), cy = sy(h.y), R = h.r * view.s, rx = R, ry = R * SQ;
      const chomp = happyUntil > now ? 1 + 0.06 * Math.sin((happyUntil - now) * 26) : 1;
      // a boing (§15.3): squash, spring, settle — the eyes stay where they are
      const b = boingUntil > now && !reduceMotion() ? (boingUntil - now) / BOING_S : 0;
      const bs = b ? Math.sin((1 - b) * Math.PI * 3) * b : 0;
      const cX = chomp * (1 + 0.14 * bs), cY = chomp * (1 - 0.2 * bs);
      const lw = Math.max(2.5, R * 0.13);
      if (pal.glow) {
        ctx.fillStyle = pal.glow;
        ellipse(ctx, cx, cy, rx * 1.35, ry * 1.35); ctx.fill();
      }
      // the dark ring the ground sinks into
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ellipse(ctx, cx, cy + ry * 0.06, rx * 1.1 * cX, ry * 1.12 * cY); ctx.fill();
      // the inside: dark at the bottom, the far wall catching a little light
      const g = ctx.createRadialGradient(cx, cy + ry * 0.35, 0, cx, cy + ry * 0.2, rx * 1.05);
      g.addColorStop(0, pal.deep); g.addColorStop(0.62, pal.deep); g.addColorStop(1, pal.wall);
      ctx.fillStyle = g;
      ellipse(ctx, cx, cy, rx * cX, ry * cY); ctx.fill();
      // a slow swirl inside (still under reduced motion)
      ctx.save();
      ellipse(ctx, cx, cy, rx * 0.92, ry * 0.92); ctx.clip();
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
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * cX, ry * cY, 0, Math.PI, Math.PI * 2); ctx.stroke();
      drawFalling(cx, cy, rx * cX, ry * cY);
      ctx.strokeStyle = pal.rim;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * cX, ry * cY, 0, 0, Math.PI); ctx.stroke();
      ctx.strokeStyle = pal.hi; ctx.lineWidth = Math.max(1, lw * 0.35);
      ctx.beginPath(); ctx.ellipse(cx, cy - lw * 0.15, rx * cX, ry * cY, 0, 0.35, Math.PI - 0.35); ctx.stroke();
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
      const eR = eyeR(R);
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
      const starry = starUntil > now;
      // a taste face (§15.3) — a treasure's star eyes still win
      const taste = !starry && tasteUntil > now ? tasteFace : null;
      const happy = happyUntil > now && !starry && !taste, wide = wideUntil > now || starry;
      const k = wide ? EYE.wide : 1;
      // the top of his face this frame (the camera keeps it on screen)
      lastFace = { top: ey - eR * k * 1.1 - Math.max(1.5, eR * k * 0.14) / 2, bottom: cy + ry, crown: false, taste };
      for (const side of [-1, 1]) {
        const ex = cx + side * R * 0.42;
        const r = eR * k;
        ctx.save();
        ctx.translate(ex, ey);
        if (taste === "hearts") {
          // a sweet: his eyes melt into hearts, beating (unless motion is
          // reduced) — kept inside the eye's own outline, so the camera's
          // headroom for his face still holds
          const beat = reduceMotion() ? 1 : 1 + 0.07 * Math.max(0, Math.sin((tasteUntil - now) * 14));
          // at its biggest beat the heart's top is 0.83r above the eye's
          // middle, inside the eye's own 1.1r
          const hs = r * 1.15 * beat;
          ctx.fillStyle = "#ff4f7b"; ctx.strokeStyle = INK_DARK; ctx.lineWidth = Math.max(1.5, r * 0.14); ctx.lineJoin = "round";
          heartPath(ctx, 0, -r * 0.1, hs); ctx.fill(); ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.beginPath(); ctx.arc(-hs * 0.4, -r * 0.1 - hs * 0.2, hs * 0.15, 0, Math.PI * 2); ctx.fill();
        } else if (happy) {
          // ^ ^ — a happy squint after every gulp
          ctx.strokeStyle = "#1d1233"; ctx.lineWidth = Math.max(2, r * 0.3); ctx.lineCap = "round";
          ctx.beginPath(); ctx.arc(0, r * 0.35, r * 0.7, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        } else {
          // a cold thing: icy whites, small pupils, and his eyes shiver
          const cold = taste === "shiver";
          if (cold && !reduceMotion()) ctx.translate(Math.sin(now * 55 + side) * r * 0.08, 0);
          ctx.scale(1, blink ? 0.12 : 1);
          ctx.fillStyle = cold ? "#d8f1ff" : "#ffffff";
          ctx.strokeStyle = "#1d1233"; ctx.lineWidth = Math.max(1.5, r * 0.14);
          ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          if (!blink && starry) {
            // a treasure: his eyes turn to gold stars
            ctx.fillStyle = GOLD.hi; ctx.strokeStyle = "#1d1233"; ctx.lineWidth = Math.max(1.2, r * 0.08);
            starPath(ctx, 0, 0, r * 0.78, r * 0.34, 5);
            ctx.fill(); ctx.stroke();
          } else if (!blink) {
            ctx.fillStyle = "#1d1233";
            ctx.beginPath(); ctx.arc(px * r * 0.36, py * r * 0.36, r * (cold ? 0.32 : 0.5), 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.beginPath(); ctx.arc(px * r * 0.36 - r * 0.17, py * r * 0.36 - r * 0.2, r * 0.16, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.restore();
      }
      // what he wears in this place (§15.2) — a hat gives way to the crown
      const crowned = !!L.goalOf(st);
      lastFace.wear = null;
      const w = def.wear && WEAR[def.wear[0]];
      if (w && !(crowned && w.slot === "top")) {
        ctx.save();
        w.draw(ctx, cx, ey, eR * k, R * 0.42, def.wear[1] || "#ff5e7e", def.wear[2], now);
        ctx.restore();
        lastFace.top = Math.min(lastFace.top, ey - w.up(eR * k, R * 0.42));
        lastFace.wear = def.wear[0];
      }
      // big enough for the finale: King Gobble
      if (crowned) {
        const size = eR * CROWN.size, my = ey - eR * CROWN.lift;
        glyph("👑", cx, my, size);
        lastFace.top = Math.min(lastFace.top, my - size / 2);
        lastFace.crown = true;
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
        const color = o ? inkOf(o.e).color : "#ffd24d";
        const n = 5 + Math.min(10, (ev.tier || 1) * 2);
        const rr = rng(hashStr("crumb" + ev.id));
        for (let i = 0; i < n; i++) {
          const a = -Math.PI * (0.15 + 0.7 * rr());
          fx.push({ k: "crumb", x: h.x, y: h.y, vx: Math.cos(a) * (10 + rr() * 18), vy: Math.sin(a) * (16 + rr() * 22),
            t0: now, life: 0.55 + rr() * 0.3, size: 0.5 + rr() * 0.6 + (ev.tier || 1) * 0.12, color });
        }
        // a TASTE shows itself too (§15.3), so it reads with the sound off
        const fam = ev.vortex || ev.finale ? null : DATA.tasteOf(ev.e);
        if (fam && TASTE_LOOK[fam]) tasteFx(TASTE_LOOK[fam], ev, now);
        if (ev.finale && !reduceMotion()) shakeT = now + 0.55;
        if (ev.gold) {
          // a TREASURE: a ring and a burst of gold stars, and his eyes turn
          // to stars for a moment
          starUntil = now + 1.4;
          fx.push({ k: "ring", x: h.x, y: h.y, t0: now, life: 0.9, r0: h.r * 1.05, gold: true });
          const gr = rng(hashStr("gold" + ev.id));
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2 + gr() * 0.3, sp = 24 + gr() * 22;
            fx.push({ k: "star", x: h.x, y: h.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * SQ - 14, t0: now, life: 0.9 + gr() * 0.4, size: 1.4 + gr() * 1.2, gold: true });
          }
        }
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
      } else if (ev.type === "slurp") {
        // ten in a row (§15.6): his eyes go wide and a ring bursts out
        wideUntil = now + 0.8;
        fx.push({ k: "ring", x: h.x, y: h.y, t0: now, life: 0.7, r0: h.r * 1.1, white: true });
      } else if (ev.type === "bump") {
        lookUp = now + 0.6;
      } else if (ev.type === "pop" || ev.type === "shake") {
        // a box bursts (or a tree is shaken): the surprises fly out to their
        // spots, with confetti (or leaves)
        const pop = ev.type === "pop", par = st.objects[ev.id];
        const top = par ? par.r * VIS * 0.75 : 6;
        fx.push({ k: "ring", x: ev.x, y: ev.y, t0: now, life: 0.6, r0: par ? par.r * 0.8 : 4, white: true });
        const rr = rng(hashStr(ev.type + ev.id));
        for (let i = 0; i < (pop ? 16 : 10); i++) {
          const a = -Math.PI * (0.1 + 0.8 * rr()), sp = 14 + rr() * 22;
          fx.push({ k: pop ? "conf" : "leaf", x: ev.x, y: ev.y - (pop ? 2 : top), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            t0: now, life: 0.8 + rr() * 0.4, size: 0.6 + rr() * 0.5, color: pop ? CONFETTI[i % CONFETTI.length] : (i % 2 ? "#6fbf4b" : "#9ad66a"), a: rr() * 6 });
        }
        if (!reduceMotion()) {
          for (const id of ev.kids || []) flyIn.set(id, { x: ev.x, y: ev.y - (pop ? 0 : top), t0: now, dur: pop ? 0.5 : 0.6, h: pop ? 9 : 3 });
        }
      } else if (ev.type === "warp") {
        // through a portal: a swirl where he went in and where he came out,
        // and the camera is THERE at once (a fly across the world would lose him)
        fx.push({ k: "warp", x: ev.from[0], y: ev.from[1], t0: now, life: 0.7 });
        fx.push({ k: "warp", x: ev.to[0], y: ev.to[1], t0: now, life: 0.9, out: true });
        if (mode === "follow" && !intro && cam) { cam = clampCam(followTarget()); applyView(); }
      } else if (ev.type === "unlock") {
        // a key eaten: every lock it opens sparkles and lets go of its padlock
        for (const id of ev.ids || []) {
          const o = st.objects[id];
          if (!o) continue;
          fx.push({ k: "ring", x: o.x, y: o.y, t0: now, life: 0.8, r0: o.r * 1.1, gold: true });
          fx.push({ k: "glyph", e: "🔓", x: o.x, y: o.y - o.r * VIS * 0.8, t0: now, life: 1.3, size: Math.max(3, o.r * 0.9) });
          const gr = rng(hashStr("unlock" + id));
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + gr() * 0.4;
            fx.push({ k: "star", x: o.x, y: o.y - o.r, vx: Math.cos(a) * 20, vy: Math.sin(a) * 20 * SQ - 8, t0: now, life: 0.8, size: 1 + gr() * 0.8, gold: true });
          }
        }
      } else if (ev.type === "flow") {
        // into the river: a splash (a belt or a walkway just carries him)
        if (ev.look === "river") {
          const rr = rng(hashStr("splash" + Math.round(now * 10)));
          for (let i = 0; i < 10; i++) {
            const a = -Math.PI * (0.15 + 0.7 * rr());
            fx.push({ k: "crumb", x: h.x, y: h.y, vx: Math.cos(a) * (12 + rr() * 14), vy: Math.sin(a) * (14 + rr() * 16), t0: now, life: 0.5 + rr() * 0.3, size: 0.4 + rr() * 0.4, color: "#9fdcff" });
          }
        }
      } else if (ev.type === "win") {
        wideUntil = now + 1.5;
        // pull all the way back: "look how much you ate!" while the vortex
        // slurps up the rest
        mode = "whole";
        intro = null;
        fx.push({ k: "ring", x: h.x, y: h.y, t0: now, life: 1.1, r0: h.r * 1.1 });
        fx.push({ k: "burp", x: h.x, y: h.y, t0: now + 0.45, life: 1.2 });
        // fireworks over the island, and a burst of the place's own air
        return { fireworks: launchFinale(now) };
      }
      return null;
    }

    // ---- the air (§15.4) -------------------------------------------------------
    function airOf() { return def && def.air ? AIR[def.air[0]] : null; }
    function drawAir(now) {
      lastAir = 0;
      const A = airOf();
      if (!A || reduceMotion() || !cam) return;
      const n = clamp(Math.round(A.n * (cssW * cssH) / 100000), 2, AIR_MAX);
      const key = def.id + ":" + n;
      if (!air || air.key !== key) {
        const rr = rng(hashStr("air" + def.id));
        const specks = [];
        for (let i = 0; i < n; i++) specks.push({ u: rr(), v: rr(), d: 0.6 + rr() * 0.8, ph: rr(), i });
        air = { key, specks, ox: air ? air.ox : 0, oy: air ? air.oy : 0, last: null };
      }
      // the camera's move since the last frame, in screen px: a speck at depth
      // d slides d times as far as the ground does
      if (air.last) { air.ox += (cam.x - air.last.x) * view.s; air.oy += (cam.y - air.last.y) * view.s; }
      air.last = { x: cam.x, y: cam.y };
      const col = def.air[1] || A.col;
      const big = clamp(Math.min(cssW, cssH) / 390, 1, 1.8);   // an iPad's specks are bigger, never smaller
      const pad = A.size * big * 3 + 30, W = cssW + 2 * pad, H = cssH + 2 * pad;
      ctx.save();
      for (const p of air.specks) {
        let x = p.u * W + A.vx * now * p.d - air.ox * p.d + Math.sin(now * 0.9 + p.ph * TAU) * A.sway;
        let y = p.v * H + A.vy * now * p.d - air.oy * p.d;
        x = ((x % W) + W) % W - pad; y = ((y % H) + H) % H - pad;
        A.draw(ctx, x, y, A.size * big * (0.7 + p.d * 0.45), p.ph, now, col, p.i);
        lastAir++;
      }
      ctx.restore();
    }

    // ---- the finale's fireworks and its burst of air (§15.5) --------------------
    // Launched on the win, in screen space, in the place's own colours: its
    // costume's, its air's, gold and white. Not under reduced motion. Returns
    // when each one BURSTS (seconds from now), so the page can pop at the same
    // moments — the timing has one owner.
    function launchFinale(now) {
      fireworks = []; airBurst = null;
      if (reduceMotion()) return [];
      const A = airOf();
      const cols = [(def.wear && def.wear[1]) || "#ff5e7e", (def.air && def.air[1]) || (A && A.col) || "#5ec8ff", GOLD.hi, "#ffffff"];
      const rr = rng(hashStr("fireworks" + def.id));
      fireworks = FIREWORKS.at.map((d, i) => ({ t0: now + d, x: 0.14 + rr() * 0.72, y: 0.14 + rr() * 0.3,
        col: cols[i % cols.length], col2: cols[(i + 1) % cols.length], n: 14 + Math.floor(rr() * 6), spin: rr() * TAU }));
      if (A) {
        const parts = [];
        const up = A.vy < 0 ? -1 : 1;   // falling weather falls, rising weather rises
        for (let i = 0; i < 26; i++) {
          const a = -Math.PI * (0.05 + 0.9 * rr()), sp = 110 + rr() * 170;
          parts.push({ vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ph: rr(), i, g: up * (70 + rr() * 60) });
        }
        airBurst = { t0: now, life: 1.8, parts };
      }
      return FIREWORKS.at.map((d) => d + FIREWORKS.rise);
    }
    function drawFireworks(now) {
      lastFw = 0; lastBurst = 0;
      if (airBurst) {
        const t = now - airBurst.t0;
        const A = airOf();
        if (t > airBurst.life || !A) airBurst = null;
        else if (t >= 0) {
          const h = st.hole, x0 = sx(h.x), y0 = sy(h.y) - h.r * view.s * SQ;
          const col = def.air[1] || A.col;
          ctx.save();
          for (const p of airBurst.parts) {
            const x = x0 + p.vx * t, y = y0 + p.vy * t + p.g * t * t;
            A.draw(ctx, x, y, A.size * 1.25, p.ph, now, col, p.i);
            lastBurst++;
          }
          ctx.restore();
          ctx.globalAlpha = 1;
        }
      }
      if (!fireworks.length) return;
      const R0 = Math.min(cssW, cssH) * 0.22;
      ctx.save();
      ctx.lineCap = "round";
      for (let i = fireworks.length - 1; i >= 0; i--) {
        const f = fireworks[i], t = now - f.t0;
        if (t < 0) continue;
        if (t > FIREWORKS.rise + FIREWORKS.burst) { fireworks.splice(i, 1); continue; }
        const X = f.x * cssW, Y = f.y * cssH;
        if (t < FIREWORKS.rise) {
          // the rocket rising, with a short trail
          const q = t / FIREWORKS.rise, e = 1 - (1 - q) * (1 - q);
          const y = cssH + 10 + (Y - cssH - 10) * e;
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "rgba(29,18,51,0.4)"; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(X, y + 22); ctx.lineTo(X, y); ctx.stroke();
          ctx.strokeStyle = f.col2; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(X, y + 22); ctx.lineTo(X, y); ctx.stroke();
          lastFw++;
          continue;
        }
        // the burst: sparks streaking out from the middle, drooping and fading
        const q = (t - FIREWORKS.rise) / FIREWORKS.burst, e = 1 - Math.pow(1 - q, 3);
        ctx.globalAlpha = q < 0.55 ? 1 : 1 - (q - 0.55) / 0.45;
        const drop = q * q * R0 * 0.55, trail = R0 * 0.4 * (1 - q);
        for (let k = 0; k < f.n; k++) {
          const a = f.spin + (k / f.n) * TAU, r = R0 * e, ca = Math.cos(a), sa = Math.sin(a);
          const x = X + ca * r, y = Y + sa * r + drop;
          const x0 = X + ca * Math.max(0, r - trail), y0 = Y + sa * Math.max(0, r - trail) + drop * 0.7;
          const s = 3.2 * (1 - q * 0.5), col = k % 2 ? f.col2 : f.col;
          ctx.strokeStyle = "rgba(29,18,51,0.45)"; ctx.lineWidth = s * 1.3 + 2.5;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
          ctx.strokeStyle = col; ctx.lineWidth = s * 1.3;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
        }
        lastFw++;
      }
      ctx.restore();
    }

    // A taste's face and its little burst. A burst kind marked `face` is drawn
    // round his face wherever he goes (faceGeo), in units of his eye, so it
    // scales with him; "star" and "conf" are the world-anchored kinds the
    // other events already use.
    function tasteFx(look, ev, now) {
      if (look.face) { tasteFace = look.face; tasteUntil = now + TASTE_S; }
      if (look.boing) boingUntil = now + BOING_S;
      const k = look.fx;
      if (!k || fx.length > FX_CAP) return;   // a long run of gulps never floods the effects
      const rr = rng(hashStr("taste" + ev.id));
      const h = st.hole;
      if (k === "star") {
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI * (0.1 + 0.8 * (i / 5)) + (rr() - 0.5) * 0.3, sp = 20 + rr() * 12;
          fx.push({ k: "star", taste: true, x: h.x, y: h.y - h.r * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t0: now, life: 0.8, size: Math.max(1.6, h.r * 0.12) + rr() * 0.8, col: look.col });
        }
      } else if (k === "conf") {
        for (let i = 0; i < 14; i++) {
          const a = -Math.PI * (0.1 + 0.8 * rr()), sp = 14 + rr() * 20;
          fx.push({ k: "conf", taste: true, x: h.x, y: h.y - h.r * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            t0: now, life: 0.8 + rr() * 0.4, size: 0.6 + rr() * 0.5, color: CONFETTI[i % CONFETTI.length], a: rr() * 6 });
        }
      } else {
        const n = { heart: 3, twinkle: 5, wave: 3, puff: 3, streak: 5, bounce: 3, blip: 6, note: 3 }[k] || 3;
        const bits = [];
        for (let i = 0; i < n; i++) bits.push({ i, u: rr() * 2 - 1, v: rr(), d: rr() * 0.25 });
        fx.push({ k, face: true, t0: now, life: k === "wave" ? 0.8 : k === "streak" ? 0.55 : 1.0, col: look.col, col2: look.col2, bits });
      }
    }

    // Where his face is on screen this frame: the eyes' line, an eye's radius
    // and half the gap between the eyes (drawEyes works these out the same way).
    function faceGeo() {
      const h = st.hole, R = h.r * view.s, ry = R * SQ, eR = eyeR(R);
      return { cx: sx(h.x), ey: sy(h.y) - ry - eR * 0.25, eR, sp: R * 0.42, R };
    }

    // One taste burst round his face (§15.3). Every mark is drawn dark under
    // bright (the fort's law), so a white puff still reads on the snow and a
    // yellow wave on the sand.
    function drawTaste(f, t, p) {
      // in units of his eye — never smaller than a 12px eye, so a tiny
      // Gobble's taste still reads
      const g = faceGeo(), e = Math.max(g.eR, 12), still = reduceMotion();
      const fade = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
      let marks = 0;
      ctx.save();
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (f.k === "wave") {
        // sound waves — (( )) either side of his face, rolling outward
        for (const side of [-1, 1]) {
          for (const b of f.bits) {
            const q = clamp(p * 1.5 - b.i * 0.22, 0, 1);
            if (q <= 0 || q >= 1) continue;
            const x = g.cx + side * (g.sp + e * 1.15), r = e * (0.6 + q * 1.5);
            const a0 = side > 0 ? -0.75 : Math.PI - 0.75, a1 = a0 + 1.5;
            const w = Math.max(3, e * 0.22) * (1 - q * 0.4);
            ctx.globalAlpha = 1 - q;
            ctx.strokeStyle = "rgba(29,18,51,0.5)"; ctx.lineWidth = w + 2.5;
            ctx.beginPath(); ctx.arc(x, g.ey, r, a0, a1); ctx.stroke();
            ctx.strokeStyle = f.col2 && b.i % 2 ? f.col2 : f.col; ctx.lineWidth = w;
            ctx.beginPath(); ctx.arc(x, g.ey, r, a0, a1); ctx.stroke(); marks++;
          }
        }
      } else if (f.k === "heart") {
        // a sweet: little hearts float up from his face
        for (const b of f.bits) {
          const q = clamp(p * 1.25 - b.d, 0, 1);
          if (q <= 0) continue;
          const x = g.cx + (b.i - 1) * g.sp * 0.75 + (still ? 0 : Math.sin(t * 6 + b.i * 2) * e * 0.25);
          const y = g.ey - e * (1.2 + q * 2.6), s = e * (0.46 + b.v * 0.16);
          ctx.globalAlpha = q < 0.75 ? 1 : 1 - (q - 0.75) / 0.25;
          ctx.fillStyle = f.col; ctx.strokeStyle = INK_DARK; ctx.lineWidth = Math.max(1.2, s * 0.18);
          heartPath(ctx, x, y, s); ctx.fill(); ctx.stroke(); marks++;
        }
      } else if (f.k === "twinkle") {
        // four-point sparkles popping round his face (frost, or a shine)
        for (const b of f.bits) {
          const q = clamp(p * 1.3 - b.d, 0, 1);
          if (q <= 0 || q >= 1) continue;
          const x = g.cx + b.u * g.sp * 1.7, y = g.ey - e * (0.5 + b.v * 1.6);
          const s = e * 0.72 * Math.sin(q * Math.PI);
          ctx.globalAlpha = 1;
          ctx.fillStyle = "rgba(29,18,51,0.45)";
          starPath(ctx, x, y, s * 1.25, s * 0.42, 4); ctx.fill();
          ctx.fillStyle = f.col;
          starPath(ctx, x, y, s, s * 0.3, 4); ctx.fill(); marks++;
        }
      } else if (f.k === "puff") {
        // a little train: puffs of steam rising
        for (const b of f.bits) {
          const q = clamp(p * 1.3 - b.i * 0.18, 0, 1);
          if (q <= 0 || q >= 1) continue;
          const x = g.cx + (b.i - 1) * e * 0.7 + (still ? 0 : q * e * 0.6 * b.u);
          const y = g.ey - e * (1.0 + q * 2.8), r = e * (0.5 + q * 0.6);
          ctx.globalAlpha = q < 0.6 ? 1 : 1 - (q - 0.6) / 0.4;
          ctx.fillStyle = f.col; ctx.strokeStyle = "rgba(29,18,51,0.45)"; ctx.lineWidth = Math.max(1.5, e * 0.1);
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); marks++;
        }
      } else if (f.k === "streak") {
        // a rocket or a plane: speed lines shooting up past his face
        for (const b of f.bits) {
          const q = clamp(p * 1.2 - b.d * 0.6, 0, 1);
          if (q <= 0 || q >= 1) continue;
          const x = g.cx + b.u * (g.sp + e) * 1.2, y0 = g.ey - e * (0.4 + q * 3.2), len = e * (1.0 + q * 1.3);
          ctx.globalAlpha = 1 - q;
          ctx.strokeStyle = "rgba(29,18,51,0.5)"; ctx.lineWidth = Math.max(3, e * 0.2) + 2.5;
          ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 - len); ctx.stroke();
          ctx.strokeStyle = f.col; ctx.lineWidth = Math.max(3, e * 0.2);
          ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 - len); ctx.stroke(); marks++;
        }
      } else if (f.k === "bounce") {
        // a ball: little bounce marks curving up either side of his face
        for (const side of [-1, 1]) {
          ctx.save(); ctx.translate(g.cx, g.ey); ctx.scale(side, 1);
          for (const b of f.bits) {
            const q = still ? 0.5 : clamp(p * 1.4 - b.i * 0.15, 0, 1);
            const x = g.sp + e * (0.9 + b.i * 0.45), y = e * (0.6 - b.i * 0.55) - q * e * 0.6;
            ctx.globalAlpha = fade;
            for (const [col, w] of [["rgba(29,18,51,0.5)", Math.max(3, e * 0.2) + 2.5], [f.col, Math.max(3, e * 0.2)]]) {
              ctx.strokeStyle = col; ctx.lineWidth = w;
              ctx.beginPath(); ctx.arc(x, y, e * 0.6, -1.9, -0.5); ctx.stroke();
            }
            marks++;
          }
          ctx.restore();
        }
      } else if (f.k === "blip") {
        // a robot or a radio: little square blips that blink as they rise
        for (const b of f.bits) {
          const q = clamp(p * 1.2 - b.d, 0, 1);
          if (q <= 0 || q >= 1) continue;
          if (!still && Math.floor(t * 12 + b.i) % 3 === 0) continue;
          const x = g.cx + b.u * (g.sp + e) * 1.2, y = g.ey - e * (0.5 + q * 2.4 + b.v * 0.6), s = e * 0.38;
          ctx.globalAlpha = 1 - q * 0.6;
          ctx.fillStyle = INK_DARK; ctx.fillRect(x - s / 2 - 1.5, y - s / 2 - 1.5, s + 3, s + 3);
          ctx.fillStyle = f.col; ctx.fillRect(x - s / 2, y - s / 2, s, s); marks++;
        }
      } else if (f.k === "note") {
        // music: notes float up, swaying
        const cols = [f.col, "#5ec8ff", "#ff5e7e"];
        for (const b of f.bits) {
          const q = clamp(p * 1.25 - b.i * 0.15, 0, 1);
          if (q <= 0 || q >= 1) continue;
          const x = g.cx + (b.i - 1) * g.sp * 0.8 + (still ? 0 : Math.sin(t * 5 + b.i * 2.1) * e * 0.35);
          const y = g.ey - e * (1.0 + q * 2.6), hr = e * 0.42;
          ctx.globalAlpha = q < 0.7 ? 1 : 1 - (q - 0.7) / 0.3;
          ctx.fillStyle = cols[b.i % 3]; ctx.strokeStyle = INK_DARK; ctx.lineWidth = Math.max(1.2, hr * 0.28);
          ctx.beginPath(); ctx.ellipse(x, y, hr, hr * 0.74, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          const sx0 = x + hr * 0.82;
          ctx.beginPath(); ctx.moveTo(sx0, y - hr * 0.2); ctx.lineTo(sx0, y - hr * 3.1);
          ctx.quadraticCurveTo(sx0 + hr * 1.3, y - hr * 2.4, sx0 + hr * 0.9, y - hr * 1.5);
          ctx.stroke(); marks++;
        }
      }
      ctx.restore();
      tasteMarks[f.k] = (tasteMarks[f.k] || 0) + marks;
    }

    function drawFx(now) {
      tasteMarks = {};
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i], t = now - f.t0;
        if (t > f.life) { fx.splice(i, 1); continue; }
        if (t < 0) continue;
        const p = t / f.life;
        if (f.face) { drawTaste(f, t, p); continue; }
        if (f.taste) tasteMarks[f.k] = (tasteMarks[f.k] || 0) + 1;
        if (f.k === "crumb") {
          const x = f.x + f.vx * t, y = f.y + f.vy * t + 40 * t * t;
          ctx.globalAlpha = 1 - p;
          ctx.fillStyle = f.color;
          ctx.beginPath(); ctx.arc(sx(x), sy(y), f.size * view.s, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        } else if (f.k === "conf" || f.k === "leaf") {
          // confetti from a burst box, or leaves from a shaken tree
          const x = f.x + f.vx * t, y = f.y + f.vy * t + (f.k === "leaf" ? 18 : 34) * t * t;
          const s = f.size * view.s, a = f.a + t * (f.k === "leaf" ? 3 : 9);
          ctx.globalAlpha = 1 - p;
          ctx.fillStyle = f.color;
          ctx.save();
          ctx.translate(sx(x), sy(y)); ctx.rotate(a);
          if (f.k === "leaf") { ctx.beginPath(); ctx.ellipse(0, 0, s * 1.3, s * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
          else ctx.fillRect(-s, -s * 0.45, s * 2, s * 0.9);
          ctx.restore();
          ctx.globalAlpha = 1;
        } else if (f.k === "warp") {
          // a swirl of rings, closing in where he went in, opening where he came out
          const x = sx(f.x), y = sy(f.y), R = RULES.PORTAL_R * view.s;
          for (let k = 0; k < 3; k++) {
            const q = clamp(p * 1.3 - k * 0.15, 0, 1);
            const r = f.out ? R * (0.5 + q * 1.6) : R * (1.8 - q * 1.4);
            ctx.strokeStyle = "rgba(200,180,255," + (0.9 * (1 - q)).toFixed(3) + ")";
            ctx.lineWidth = Math.max(2, R * 0.16 * (1 - q * 0.5));
            ellipse(ctx, x, y, r, r * SQ); ctx.stroke();
          }
        } else if (f.k === "glyph") {
          // a picture floating up and fading (an open padlock)
          ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
          glyph(f.e, sx(f.x), sy(f.y - t * 8), f.size * view.s * (1 + 0.2 * Math.sin(p * Math.PI)));
          ctx.globalAlpha = 1;
        } else if (f.k === "ring") {
          const r = (f.r0 * (1 + p * 0.9)) * view.s;
          ctx.strokeStyle = (f.gold ? GOLD.bright : f.white ? "rgba(255,255,255," : "rgba(255,215,90,") + (1 - p).toFixed(3) + ")";
          ctx.lineWidth = Math.max(2, 6 * (1 - p));
          ellipse(ctx, sx(f.x), sy(f.y), r, r * SQ); ctx.stroke();
        } else if (f.k === "star") {
          const x = sx(f.x + f.vx * t), y = sy(f.y + f.vy * t);
          const s = f.size * view.s * (1 - p * 0.5);
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2, rr = k % 2 ? s * 0.4 : s * 1.3;
            ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          }
          ctx.closePath();
          if (f.col) {
            // a clank: a grey star with a dark edge, so it reads on any floor
            ctx.globalAlpha = 1 - p;
            ctx.strokeStyle = INK_DARK; ctx.lineWidth = Math.max(1, s * 0.3); ctx.lineJoin = "round";
            ctx.stroke(); ctx.fillStyle = f.col; ctx.fill();
            ctx.globalAlpha = 1;
          } else {
            ctx.fillStyle = (f.gold ? GOLD.bright : "rgba(255,230,120,") + (1 - p).toFixed(3) + ")";
            ctx.fill();
          }
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

    // Is a thing on screen (its base point, inset by m css px)?
    function onScreen(o, m) {
      const x = sx(o.x), y = sy(o.y);
      return x >= m && x <= cssW - m && y >= m && y <= cssH - m;
    }

    // The sparkle trail from Gobble to the hinted thing, when it is on screen.
    function drawHint(now) {
      if (!st || st.hint < 0 || st.won) return;
      const o = st.objects[st.hint];
      if (!o || o.st !== 0 || !onScreen(o, 0)) return;
      const h = st.hole;
      const x0 = sx(h.x), y0 = sy(h.y - h.r * SQ), x1 = sx(o.x), y1 = sy(o.y - o.r);
      const Ld = Math.hypot(x1 - x0, y1 - y0);
      const gap = 14, phase = reduceMotion() ? 0 : (now * 40) % gap;
      ctx.fillStyle = "rgba(255,225,90,0.95)";
      for (let d = phase; d < Ld - 6; d += gap) {
        const t = d / Ld;
        ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 3.2, 0, Math.PI * 2); ctx.fill();
      }
      const pulse = reduceMotion() ? 1 : 1 + 0.15 * Math.sin(now * 8);
      const r = o.r * view.s * 1.25 * pulse;
      ctx.strokeStyle = "rgba(255,225,90,0.95)"; ctx.lineWidth = 3;
      ellipse(ctx, sx(o.x), sy(o.y), r, r * SQ); ctx.stroke();
    }

    // NEVER LOST (§9.5): when nothing Gobble can eat has been on screen for a
    // moment — or the hint points off screen — a bubble at the screen's edge
    // holds a picture of the nearest thing he can eat and points at it.
    // Tapping it sends him there.
    function updateArrow(now) {
      arrow = null;
      if (!st || st.won || intro) { noBiteSince = -1; return; }
      const h = st.hole;
      let any = false;
      for (const o of st.objects) {
        if (o.st === 0 && o.r <= h.r * RULES.FIT && onScreen(o, 12)) { any = true; break; }
      }
      if (any) noBiteSince = -1; else if (noBiteSince < 0) noBiteSince = now;
      let t = null;
      // Once he is big enough for the finale it is THE goal: whenever it is
      // off screen the arrow points at it, at once, whatever else is in view
      // (with nothing pointing at it, a wandering child took up to two
      // minutes to find it — PLAN_GOBBLE.md §12).
      const goal = L.goalOf(st);
      const hinted = st.hint >= 0 ? st.objects[st.hint] : null;
      if (goal && !onScreen(goal, 12)) t = goal;
      else if (hinted && hinted.st === 0 && !onScreen(hinted, 12)) t = hinted;
      else if (!any && now - noBiteSince >= NO_BITE_AFTER) t = L.nearestEdible(st);
      if (!t) return;
      const isGoal = !!goal && t === goal, ar = isGoal ? GOAL_R : ARROW_R;
      // on the screen's edge, on the line from Gobble toward it
      const gx = clamp(sx(h.x), 0, cssW), gy = clamp(sy(h.y), 0, cssH);
      let dx = sx(t.x) - gx, dy = sy(t.y) - gy;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const m = ar + 16;
      const kx = dx > 1e-6 ? (cssW - m - gx) / dx : dx < -1e-6 ? (m - gx) / dx : Infinity;
      const ky = dy > 1e-6 ? (cssH - m - gy) / dy : dy < -1e-6 ? (m - gy) / dy : Infinity;
      const k = Math.max(0, Math.min(kx, ky));
      const bob = reduceMotion() ? 0 : Math.sin(now * 5) * 4;
      arrow = { id: t.id, e: t.e, x: gx + dx * (k - bob), y: gy + dy * (k - bob), dx, dy, r: ar, goal: isGoal };
    }
    function drawArrow(now) {
      if (!arrow) return;
      const a = arrow, pal = HOLES[def.hole] || HOLES.gobble;
      const rim = a.goal ? GOLD.rim : pal.rim;
      const nx = -a.dy, ny = a.dx, base = a.r - 2, tip = a.r + 13;
      ctx.save();
      ctx.lineJoin = "round";
      if (a.goal) {
        // the goal's bubble breathes a golden halo
        const p = reduceMotion() ? 0.5 : 0.5 + 0.5 * Math.sin(now * 5);
        ctx.fillStyle = GOLD.bright + (0.3 + 0.3 * p).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r + 5 + 5 * p, 0, Math.PI * 2); ctx.fill();
      }
      // the pointer, on the side facing the thing
      ctx.fillStyle = GOLD.hi; ctx.strokeStyle = rim; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(a.x + a.dx * tip, a.y + a.dy * tip);
      ctx.lineTo(a.x + a.dx * base + nx * 12, a.y + a.dy * base + ny * 12);
      ctx.lineTo(a.x + a.dx * base - nx * 12, a.y + a.dy * base - ny * 12);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // the bubble, and the thing inside it
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = a.goal ? 5 : 4; ctx.strokeStyle = rim; ctx.stroke();
      glyph(a.e, a.x, a.y, a.r * 1.25);
      ctx.restore();
    }
    // A tap on the bubble (with a finger's slack): which thing it points at.
    function arrowAt(px, py) {
      if (!arrow) return null;
      return Math.hypot(px - arrow.x, py - arrow.y) <= arrow.r + 16 ? arrow.id : null;
    }

    // ---- a frame ---------------------------------------------------------------
    function draw(now) {
      clock = now;
      if (!st || !cssW) return;
      updateCamera(now);
      const shaking = shakeT > now;
      const inside = !shaking && viewInsideIsland();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // Every frame starts from the SAME canvas state. Several strokes leave
      // round caps or joins behind (the cave ends every frame on a round
      // join), and a frame drawn after round ones came out 200-1800 px
      // different from one drawn after square ones: a frame was partly a
      // picture of whatever the frame before happened to draw last.
      ctx.lineCap = "butt"; ctx.lineJoin = "miter"; ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over"; ctx.setLineDash([]); ctx.lineDashOffset = 0;
      ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
      if (!inside) ctx.drawImage(backdropCanvas(), 0, 0);   // else the ground covers every pixel
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (shaking) {
        const a = (shakeT - now) * 9;
        ctx.translate(Math.sin(now * 80) * a, Math.cos(now * 67) * a * 0.6);
      }
      const nd = drawIsland(inside, now);
      const h = st.hole;
      const rm = reduceMotion();
      const v = viewRect(0);
      // painter's order: every standing thing ON SCREEN, and the hole as one
      // more item
      const items = [];
      let standing = 0;
      for (const o of st.objects) {
        if (o.st !== 0) continue;
        standing++;
        // a surprise popping out flies from its box (or its tree) to its spot
        let ox = o.x, oy = o.y, fly = 0;
        const fi = flyIn.get(o.id);
        if (fi) {
          const p = (now - fi.t0) / fi.dur;
          if (p >= 1 || p < 0) flyIn.delete(o.id);
          else {
            const e = 1 - (1 - p) * (1 - p);
            ox = fi.x + (o.x - fi.x) * e; oy = fi.y + (o.y - fi.y) * e;
            fly = Math.sin(p * Math.PI) * fi.h * view.s;
          }
        }
        const half = VIS * o.r * 0.5 + 2;
        if (ox + half < v.x0 || ox - half > v.x1 || oy - VIS * o.r * 1.3 > v.y1 || oy + o.r * SQ + 2 < v.y0) continue;
        const near = Math.hypot(o.x - h.x, (o.y - h.y) / SQ) < h.r + o.r;
        // a thing ON the rim (too big, or being pulled) draws over the hole
        items.push({ y: near ? Math.max(oy, h.y + 0.01) : oy, o, ox, oy, fly });
      }
      items.push({ y: h.y, hole: true });
      items.sort((a, b) => a.y - b.y || (a.hole ? 1 : 0) - (b.hole ? 1 : 0));
      let flipped = 0;
      for (const it of items) {
        if (it.hole) continue;
        const o = it.o;
        it.lift = it.fly; it.rot = 0;
        const hop = hopUntil.get(o.id);
        if (hop && hop > now && !rm) it.lift += Math.sin(((hop - now) / 0.55) * Math.PI) * o.r * 0.6 * view.s;
        if (o.wob > 0) it.rot = Math.sin(now * 38) * 0.16 * (o.wob / 0.45) * (rm ? 0.3 : 1);
        else if (o.pull > 0) it.rot = clamp((h.x - o.x) / (o.r + h.r), -1, 1) * 0.4 * o.pull;
        // a vehicle on a track drives FORWARDS: mirrored when it goes right
        it.flip = !!o.ride && o.dir === 1 && FACES_LEFT.has(o.e);
        if (it.flip) flipped++;
      }
      // Pass 1: every shadow, as one ground layer — so no shadow ever darkens a
      // thing standing behind it. A hopping thing's shadow stays on the ground
      // and shrinks a little: that is what makes the hop read as a jump.
      let keys = 0;
      for (const it of items) {
        if (it.hole) continue;
        const k = 1 - clamp(it.lift / (it.o.r * view.s * 3), 0, 0.35);
        shadow(sx(it.ox), sy(it.oy), it.o.r, k);
        if (it.o.gold) goldGlow(sx(it.ox), sy(it.oy), it.o.r);
        if (it.o.key && !st.unlocked[it.o.key]) { keyGlow(now, sx(it.ox), sy(it.oy), it.o.r); keys++; }
      }
      // the goal's beacon, on the ground under everything
      drawGoal(now);
      // a super slurp's swirl, on the ground round him (§15.6)
      drawSlurp(now);
      // Pass 2: the things and the hole, back to front.
      let drawn = 0, gold = 0, locks = 0;
      const slurping = st.slurpT > 0;
      lastStreaks = 0;
      for (const it of items) {
        if (it.hole) { drawHole(now); continue; }
        const x = sx(it.ox), y = sy(it.oy) - it.lift;
        // a thing the super slurp has hold of from afar streaks in
        if (slurping && it.o.zoom) { streak(it.o, x, y); lastStreaks++; }
        drawObject(it.o, x, y, it.rot, 1, 1, it.flip);
        if (it.o.gold) { twinkles(now, it.o, x, y); gold++; }
        else if (lastGoal && it.o.id === lastGoal.id) twinkles(now, it.o, x, y);
        if (it.o.lock && !st.unlocked[it.o.lock]) { lockBadge(it.o, x, y); locks++; }
        drawn++;
      }
      lastGold = gold;
      lastFeat.locks = locks; lastFeat.keys = keys; lastFeat.flipped = flipped;
      // a dark place: everything above is in the dark but for the lights
      drawDark();
      drawAir(now);
      drawHint(now);
      drawFx(now);
      drawFireworks(now);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      updateArrow(now);
      drawArrow(now);
      lastDraw = { objects: drawn, standing, falling: lastDraw.falling, decals: nd, ground: !inside, ok: true, tastes: tasteMarks };
      frames++;
    }

    // Is anything still moving on screen? After the win — once the camera has
    // pulled all the way back and the last crumb and puff are gone — the
    // picture is still, and the game stops redrawing it behind the win
    // dialog (the confetti there needs the time more than a still picture
    // does). A pending effect keeps it busy until it has been drawn out.
    function busy(now) {
      if (!st || !cam || !cssW) return true;
      if (intro || fx.length || flyIn.size || shakeT > now || happyUntil > now || wideUntil > now || starUntil > now) return true;
      if (tasteUntil > now || boingUntil > now || fireworks.length || airBurst) return true;
      if (def && def.dark && st.won && st.winT < 1.5) return true;
      for (const t of hopUntil.values()) if (t > now) return true;
      const g = clampCam(mode === "whole" ? wholeTarget() : followTarget());
      return Math.abs(Math.log(cam.span / g.span)) > 0.003 || Math.hypot(cam.x - g.x, cam.y - g.y) > 0.05;
    }

    function camera() {
      if (!st || !cam) return null;
      return {
        x: cam.x, y: cam.y, span: cam.span, s: view.s, mode, intro: !!intro,
        follow: L.viewSpan(st, shortSide(), st.hole.level), whole: wholeSpan(),
        view: viewRect(0),
      };
    }

    function info() {
      let inkless = 0;
      for (const k of inks.values()) if (!k.ok) inkless++;
      return {
        view: { ...view }, css: [cssW, cssH], dpr, sprites: sprites.size, inks: inks.size, fx: fx.length,
        shaking: shakeT > clock, drawn: { ...lastDraw }, frames, inkless, detail: view.s * dpr,
        camera: camera(), arrow: arrow ? { ...arrow, hit: arrow.r + 16 } : null,
        goal: lastGoal ? { ...lastGoal } : null, gold: lastGold, face: lastFace ? { ...lastFace } : null,
        starEyes: starUntil > clock,
        // §15.3: the taste face showing now, a boing of the rim, and how many
        // of each kind of effect are in flight
        tasteFace: tasteUntil > clock ? tasteFace : null, boing: boingUntil > clock,
        fxKinds: fx.reduce((m, f) => { m[f.k] = (m[f.k] || 0) + 1; return m; }, {}),
        // §15.4/§15.5: the place's air and how many specks were drawn this
        // frame; the fireworks still to come or bursting, and what was drawn
        air: { kind: def && def.air ? def.air[0] : null, drawn: lastAir },
        fireworks: { left: fireworks.length, drawn: lastFw, burst: lastBurst },
        // §15.6: the super slurp's swirl arms and the things streaking in,
        // as drawn this frame
        slurp: { on: !!st && st.slurpT > 0, arms: lastSlurp, streaks: lastStreaks },
        // phase 4: what the place's own shape put on screen this frame
        feat: { ...lastFeat }, dark: lastDark, flying: flyIn.size,
        rings: { land: landRings.length, blocks: blockSets.reduce((s, b) => s + b.rings.length, 0) },
      };
    }

    return { resize, setState, draw, event, toWorld, toScreen, snap, endIntro, camera, arrowAt, busy, info };
  }

  global.HoleRender = { create, prepDecals, DECALS, GROUND_ART, GROUNDS, BACKDROPS, HOLES, WEAR, TASTE_LOOK, AIR, FIREWORKS, EYE, eyeR, faceUp, LOD, VIS, MARGIN, THICK };
  if (typeof module !== "undefined" && module.exports) module.exports = global.HoleRender;
})(typeof window !== "undefined" ? window : globalThis);
