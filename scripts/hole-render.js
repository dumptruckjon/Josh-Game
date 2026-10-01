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
// iOS 14.2 floor: no roundRect on the 2D context (Safari 16), no context
// filter (Safari 17), no OffscreenCanvas — rounded rects are drawn by hand,
// shadows are pre-rendered soft sprites, every emoji is rendered into a plain
// <canvas>, and the floor is solid fills and small vector marks.

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
  const CORNER = 12;     // the island's rounded corners
  const MARGIN = 8;      // the camera may look this far past the island's edge
  const TILE = 64;       // the floor's marks are drawn in squares this many world units wide
  const INK_REF = 128;   // every emoji's ink box is measured once, at this font size
  const INTRO_S = 1.6;   // the opening look at the whole island, then in to Gobble
  const ARROW_R = 30;    // the edge arrow's bubble (css px); it is tapped within ARROW_R + 16
  const NO_BITE_AFTER = 1.2;   // seconds with nothing edible on screen before the arrow shows

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
    belt: {   // the asteroid belt: a dusty band, and rocks along it
      prep(d, W, H, R) {
        const pts = ptsOf(d, W, H), rocks = [];
        const yAt = (x) => {
          for (let i = 1; i < pts.length; i++) {
            if (x <= pts[i][0]) { const t = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); return pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1]); }
          }
          return pts[pts.length - 1][1];
        };
        for (let i = 0; i < 90; i++) { const x = R() * W; rocks.push([x, yAt(x) + (R() - 0.5) * d.w * 0.8, 0.5 + R() * 1.1]); }
        return { rocks };
      },
      box: (d, W, H) => ptsBox(ptsOf(d, W, H), d.w),
      draw(c, d, W, H, p) {
        const pts = ptsOf(d, W, H);
        groundStroke(c, pts, d.w, "rgba(140,120,200,0.16)");
        groundStroke(c, pts, d.w * 0.55, "rgba(140,120,200,0.14)");
        c.fillStyle = "rgba(190,175,220,0.75)";
        c.beginPath();
        for (const [x, y, r] of p.rocks) { c.moveTo(x + r, y); c.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2); }
        c.fill();
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
    fence: {   // a wooden fence: posts and two rails
      box: (d, W, H) => ptsBox(ptsOf(d, W, H), 6),
      draw(c, d, W, H) {
        const pts = ptsOf(d, W, H);
        c.lineCap = "round";
        for (const [dy, col] of [[-3.6, "#a8743f"], [-1.8, "#a8743f"]]) {
          c.strokeStyle = col; c.lineWidth = 0.8;
          c.beginPath();
          pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1] + dy) : c.moveTo(p[0], p[1] + dy)));
          c.stroke();
        }
        c.fillStyle = "#8a5a2b";
        for (let i = 1; i < pts.length; i++) {
          const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / 6));
          for (let k = 0; k <= n; k++) {
            const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
            c.fillRect(x - 0.5, y - 4.6, 1, 4.6);
          }
        }
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
    track: {   // a running track: a red oval with white lanes, foreshortened like the ground
      box: (d, W, H) => { const rx = d.rx * W + 10, ry = d.ry * H + 10; return [d.x * W - rx, d.y * H - ry, d.x * W + rx, d.y * H + ry]; },
      draw(c, d, W, H) {
        c.translate(d.x * W, d.y * H); c.scale(1, SQ);
        const rx = d.rx * W, ry = (d.ry * H) / SQ;
        c.strokeStyle = "#d9643a"; c.lineWidth = 14;
        c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 0.5;
        for (const k of [-7, -2.4, 2.4, 7]) { c.beginPath(); c.ellipse(0, 0, rx + k, ry + k, 0, 0, Math.PI * 2); c.stroke(); }
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
    sea: {   // the sea along the far side, its waves, and a foamy shore
      prep(d, W, H, R) {
        const y1 = d.y1 * H, waves = [];
        for (let i = 0; i < 46; i++) waves.push([R() * W, 4 + R() * (y1 - 14), 2 + R() * 3]);
        return { y1, waves };
      },
      box: (d, W, H) => [-2, -10, W + 2, d.y1 * H + 6],
      draw(c, d, W, H, p) {
        const y1 = p.y1;
        c.fillStyle = "#3fa8e0"; c.fillRect(-2, -10, W + 4, y1 * 0.55 + 10);
        c.fillStyle = "#58bdee"; c.fillRect(-2, y1 * 0.55, W + 4, y1 * 0.45);
        // the shore: wet sand, then the water's edge as a gentle wave
        c.fillStyle = "rgba(160,120,60,0.22)";
        c.beginPath(); c.moveTo(-2, y1 - 2);
        for (let x = -2; x <= W + 2; x += 6) c.lineTo(x, y1 + 3 + Math.sin(x * 0.11) * 1.4);
        c.lineTo(W + 2, y1 - 2); c.closePath(); c.fill();
        c.fillStyle = "#84d3f4";
        c.beginPath(); c.moveTo(-2, y1 - 8);
        for (let x = -2; x <= W + 2; x += 6) c.lineTo(x, y1 + Math.sin(x * 0.11) * 1.4);
        c.lineTo(W + 2, y1 - 8); c.closePath(); c.fill();
        c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 0.9; c.lineCap = "round";
        c.beginPath();
        for (let x = -2; x <= W + 2; x += 6) (x === -2 ? c.moveTo(x, y1 + Math.sin(x * 0.11) * 1.4) : c.lineTo(x, y1 + Math.sin(x * 0.11) * 1.4));
        c.stroke();
        c.strokeStyle = "rgba(255,255,255,0.6)"; c.lineWidth = 0.6;
        c.beginPath();
        for (const [x, y, s] of p.waves) { c.moveTo(x - s, y); c.quadraticCurveTo(x, y - s * 0.6, x + s, y); }
        c.stroke();
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
    lava: {   // a stream of glowing lava (nothing stands in it: the place's `avoid`)
      box: (d, W, H) => ptsBox(ptsOf(d, W, H), d.w + 6),
      draw(c, d, W, H) {
        const pts = ptsOf(d, W, H);
        groundStroke(c, pts, d.w + 8, "rgba(255,120,40,0.22)");
        groundStroke(c, pts, d.w + 2.4, "#a8321f");
        groundStroke(c, pts, d.w, "#ff6a1a");
        groundStroke(c, pts, d.w * 0.35, "#ffd23f");
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
    taxiway: {   // a taxiway: a paler lane with its yellow centre line
      box: (d, W, H) => ptsBox(ptsOf(d, W, H), 8),
      draw(c, d, W, H) {
        const pts = ptsOf(d, W, H);
        groundStroke(c, pts, 13, "#7c838d");
        groundStroke(c, pts, 1.1, "#ffd24d");
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
    // the camera, in world units: where it looks and how wide (short side)
    let cam = null, camT = 0, mode = "follow", intro = null;
    let backdrop = null, backdropKey = "";
    let decals = [];
    const inks = new Map(), sprites = new Map();
    const fx = [];
    let clock = 0;
    let shakeT = 0;
    let happyUntil = 0, wideUntil = 0, lookUp = 0, blinkAt = 3, blinkUntil = 0;
    const hopUntil = new Map();
    let arrow = null, noBiteSince = -1;
    let lastDraw = { objects: 0, standing: 0, falling: 0, decals: 0, ground: false, ok: false };
    let frames = 0;   // every draw() that painted (the tests read it)

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
      const x0 = -MARGIN, x1 = st.W + MARGIN, y0 = -RULES.TOP_SLACK - MARGIN, y1 = st.H + THICK + MARGIN;
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
        const p = clamp((now - intro.t0) / INTRO_S, 0, 1), e = easeInOut(p), f = intro.from;
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
      fx.length = 0; hopUntil.clear(); shakeT = 0;
      arrow = null; noBiteSince = -1;
      if (sprites.size > 120) sprites.clear();
      backdrop = null;
      decals = prepDecals(def, st.W, st.H);
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
    // Does the view see only the island's top (no edge, no corner, no sky)?
    function viewInsideIsland() {
      const v = viewRect(0);
      if (v.x0 < 0 || v.x1 > st.W || v.y0 < 0 || v.y1 > st.H) return false;
      return !((v.x0 < CORNER || v.x1 > st.W - CORNER) && (v.y0 < CORNER || v.y1 > st.H - CORNER));
    }
    function drawIsland(inside) {
      const W = st.W, H = st.H;
      ctx.save();
      ctx.translate(view.ox, view.oy); ctx.scale(view.s, view.s);
      if (!inside) {
        const G = GROUNDS[def.ground] || GROUNDS.wood;
        // a soft drop shadow: stacked translucent fills (no ctx.filter on iOS 14)
        for (let k = 3; k >= 1; k--) {
          ctx.fillStyle = "rgba(0,0,0," + (0.05 * (4 - k)).toFixed(2) + ")";
          rrect(ctx, -k * 1.2 + 2, THICK + k * 1.6 - 1, W + k * 2.4, H, CORNER + k); ctx.fill();
        }
        // the island's front edge: two layers of earth
        ctx.fillStyle = G.edge[1]; rrect(ctx, 0, THICK, W, H, CORNER); ctx.fill();
        ctx.fillStyle = G.edge[0]; rrect(ctx, 0, THICK * 0.45, W, H, CORNER); ctx.fill();
      }
      ctx.save();
      if (!inside) { rrect(ctx, 0, 0, W, H, CORNER); ctx.clip(); }
      const v = viewRect(2);
      const x0 = Math.max(0, v.x0), y0 = Math.max(0, v.y0), x1 = Math.min(W, v.x1), y1 = Math.min(H, v.y1);
      let nd = 0;
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
        drawLight(x0, y0, x1, y1);
      }
      ctx.restore();
      if (!inside) {
        ctx.strokeStyle = def.ground === "space" ? "rgba(140,130,255,0.55)" : "rgba(255,255,255,0.55)";
        ctx.lineWidth = 0.8; rrect(ctx, 0.4, 0.4, W - 0.8, H - 0.8, CORNER); ctx.stroke();
      }
      ctx.restore();
      return nd;
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

    function drawObject(o, x, y, rot, scale, alpha) {
      // The sprite is always requested at the thing's FULL size and scaled at
      // draw time, so a shrinking fall never mints a canvas per size.
      const size = drawSize(o) * scale;
      const sp = sprite(o.e, drawSize(o) * dpr);
      const f = size / sp.b, w = sp.w * f, h = sp.h * f, pad = sp.pad * f;
      ctx.save();
      ctx.translate(x, y);
      if (rot) ctx.rotate(rot);
      if (alpha < 1) ctx.globalAlpha = alpha;
      ctx.drawImage(sp.cv, -w / 2, -(h - pad), w, h);
      ctx.restore();
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

    // ---- the hole ---------------------------------------------------------------
    function drawHole(now) {
      const h = st.hole, pal = HOLES[def.hole] || HOLES.gobble;
      const cx = sx(h.x), cy = sy(h.y), R = h.r * view.s, rx = R, ry = R * SQ;
      const chomp = happyUntil > now ? 1 + 0.06 * Math.sin((happyUntil - now) * 26) : 1;
      const lw = Math.max(2.5, R * 0.13);
      if (pal.glow) {
        ctx.fillStyle = pal.glow;
        ellipse(ctx, cx, cy, rx * 1.35, ry * 1.35); ctx.fill();
      }
      // the dark ring the ground sinks into
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ellipse(ctx, cx, cy + ry * 0.06, rx * 1.1 * chomp, ry * 1.12 * chomp); ctx.fill();
      // the inside: dark at the bottom, the far wall catching a little light
      const g = ctx.createRadialGradient(cx, cy + ry * 0.35, 0, cx, cy + ry * 0.2, rx * 1.05);
      g.addColorStop(0, pal.deep); g.addColorStop(0.62, pal.deep); g.addColorStop(1, pal.wall);
      ctx.fillStyle = g;
      ellipse(ctx, cx, cy, rx * chomp, ry * chomp); ctx.fill();
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
        const color = o ? inkOf(o.e).color : "#ffd24d";
        const n = 5 + Math.min(10, (ev.tier || 1) * 2);
        const rr = rng(hashStr("crumb" + ev.id));
        for (let i = 0; i < n; i++) {
          const a = -Math.PI * (0.15 + 0.7 * rr());
          fx.push({ k: "crumb", x: h.x, y: h.y, vx: Math.cos(a) * (10 + rr() * 18), vy: Math.sin(a) * (16 + rr() * 22),
            t0: now, life: 0.55 + rr() * 0.3, size: 0.5 + rr() * 0.6 + (ev.tier || 1) * 0.12, color });
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
        // pull all the way back: "look how much you ate!" while the vortex
        // slurps up the rest
        mode = "whole";
        intro = null;
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
          ellipse(ctx, sx(f.x), sy(f.y), r, r * SQ); ctx.stroke();
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
      const hinted = st.hint >= 0 ? st.objects[st.hint] : null;
      if (hinted && hinted.st === 0 && !onScreen(hinted, 12)) t = hinted;
      else if (!any && now - noBiteSince >= NO_BITE_AFTER) t = L.nearestEdible(st);
      if (!t) return;
      // on the screen's edge, on the line from Gobble toward it
      const gx = clamp(sx(h.x), 0, cssW), gy = clamp(sy(h.y), 0, cssH);
      let dx = sx(t.x) - gx, dy = sy(t.y) - gy;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const m = ARROW_R + 16;
      const kx = dx > 1e-6 ? (cssW - m - gx) / dx : dx < -1e-6 ? (m - gx) / dx : Infinity;
      const ky = dy > 1e-6 ? (cssH - m - gy) / dy : dy < -1e-6 ? (m - gy) / dy : Infinity;
      const k = Math.max(0, Math.min(kx, ky));
      const bob = reduceMotion() ? 0 : Math.sin(now * 5) * 4;
      arrow = { id: t.id, e: t.e, x: gx + dx * (k - bob), y: gy + dy * (k - bob), dx, dy, r: ARROW_R };
    }
    function drawArrow() {
      if (!arrow) return;
      const a = arrow, pal = HOLES[def.hole] || HOLES.gobble;
      const nx = -a.dy, ny = a.dx, base = a.r - 2, tip = a.r + 13;
      ctx.save();
      ctx.lineJoin = "round";
      // the pointer, on the side facing the thing
      ctx.fillStyle = "#ffd24d"; ctx.strokeStyle = pal.rim; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(a.x + a.dx * tip, a.y + a.dy * tip);
      ctx.lineTo(a.x + a.dx * base + nx * 12, a.y + a.dy * base + ny * 12);
      ctx.lineTo(a.x + a.dx * base - nx * 12, a.y + a.dy * base - ny * 12);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // the bubble, and the thing inside it
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = pal.rim; ctx.stroke();
      const size = a.r * 1.25, sp = sprite(a.e, size * dpr), f = size / sp.b;
      ctx.drawImage(sp.cv, a.x - (sp.w * f) / 2, a.y - (sp.h * f) / 2, sp.w * f, sp.h * f);
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
      if (!inside) ctx.drawImage(backdropCanvas(), 0, 0);   // else the ground covers every pixel
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (shaking) {
        const a = (shakeT - now) * 9;
        ctx.translate(Math.sin(now * 80) * a, Math.cos(now * 67) * a * 0.6);
      }
      const nd = drawIsland(inside);
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
        const half = VIS * o.r * 0.5 + 2;
        if (o.x + half < v.x0 || o.x - half > v.x1 || o.y - VIS * o.r * 1.3 > v.y1 || o.y + o.r * SQ + 2 < v.y0) continue;
        const near = Math.hypot(o.x - h.x, (o.y - h.y) / SQ) < h.r + o.r;
        // a thing ON the rim (too big, or being pulled) draws over the hole
        items.push({ y: near ? Math.max(o.y, h.y + 0.01) : o.y, o });
      }
      items.push({ y: h.y, hole: true });
      items.sort((a, b) => a.y - b.y || (a.hole ? 1 : 0) - (b.hole ? 1 : 0));
      for (const it of items) {
        if (it.hole) continue;
        const o = it.o;
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
        if (it.hole) continue;
        const k = 1 - clamp(it.lift / (it.o.r * view.s * 3), 0, 0.35);
        shadow(sx(it.o.x), sy(it.o.y), it.o.r, k);
      }
      // Pass 2: the things and the hole, back to front.
      let drawn = 0;
      for (const it of items) {
        if (it.hole) { drawHole(now); continue; }
        drawObject(it.o, sx(it.o.x), sy(it.o.y) - it.lift, it.rot, 1, 1);
        drawn++;
      }
      drawHint(now);
      drawFx(now);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      updateArrow(now);
      drawArrow();
      lastDraw = { objects: drawn, standing, falling: lastDraw.falling, decals: nd, ground: !inside, ok: true };
      frames++;
    }

    // Is anything still moving on screen? After the win — once the camera has
    // pulled all the way back and the last crumb and puff are gone — the
    // picture is still, and the game stops redrawing it behind the win
    // dialog (the confetti there needs the time more than a still picture
    // does). A pending effect keeps it busy until it has been drawn out.
    function busy(now) {
      if (!st || !cam || !cssW) return true;
      if (intro || fx.length || shakeT > now || happyUntil > now || wideUntil > now) return true;
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
      };
    }

    return { resize, setState, draw, event, toWorld, toScreen, snap, endIntro, camera, arrowAt, busy, info };
  }

  global.HoleRender = { create, prepDecals, DECALS, GROUND_ART, GROUNDS, BACKDROPS, HOLES, LOD, VIS, MARGIN, THICK };
  if (typeof module !== "undefined" && module.exports) module.exports = global.HoleRender;
})(typeof window !== "undefined" ? window : globalThis);
