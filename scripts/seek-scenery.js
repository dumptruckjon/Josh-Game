// 🔍 Seek & Find — the WORLD a picture's things stand in: paths with kerbs,
// ponds with reeds and lily pads, buildings with windows, benches, fences,
// flower beds, tents, stalls, rails, roads… drawn as flat SVG in layout units.
// The owner (2026-11-24): "the backgrounds are too simplistic … basic
// backgrounds with endless sprites floating on top" — a look-and-find page is
// a WORLD first, and its people stand IN it. So a place's `ground` is now a
// list of set pieces from this file, each drawn with the same flat, outlined
// look (a darker edge, a lighter top), and the engine scatters small DETAIL
// (pebbles, flowers, grass) over what is left bare.
//
// Pure: no DOM, no Math.random (the seeded rng is handed in), dual export, so
// node renders every place and the tests can read what a place declares.

(function (global) {
  "use strict";

  const f = (n) => Math.round(n * 10) / 10;
  const EDGE = "rgba(40,30,20,.28)";
  // one shape with the shared outline
  const shape = (tag, attrs, fill, edge, w) =>
    "<" + tag + " " + attrs + ' fill="' + fill + '"' + (edge === false ? "" : ' stroke="' + (edge || EDGE) + '" stroke-width="' + (w || 2) + '" stroke-linejoin="round"') + "/>";
  const rect = (x, y, w, h, c, rx, edge) => shape("rect", 'x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '"' + (rx ? ' rx="' + rx + '"' : ""), c, edge);
  const circ = (x, y, r, c, edge) => shape("circle", 'cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r) + '"', c, edge);
  const ell = (x, y, rx, ry, c, edge) => shape("ellipse", 'cx="' + f(x) + '" cy="' + f(y) + '" rx="' + f(rx) + '" ry="' + f(ry) + '"', c, edge);
  const poly = (pts, c, edge) => shape("polygon", 'points="' + pts.map((p) => f(p[0]) + "," + f(p[1])).join(" ") + '"', c, edge);
  const line = (x1, y1, x2, y2, c, w, cap) => '<line x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2) + '" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="' + (cap || "round") + '"/>';
  const stroke = (d, c, w, extra) => '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (extra || "") + "/>";

  // ---- The set pieces ---------------------------------------------------------
  // Each takes the place's arguments and the seeded rng.
  const P = {
    // a lawn: mown stripes, tufts, daisies and clover — never a flat colour
    lawn(a, r) {
      const [x, y, w, h, c, c2] = a;
      let s = rect(x, y, w, h, c, 0, false);
      for (let yy = y; yy < y + h; yy += 72) s += rect(x, yy, w, 36, c2 || "rgba(255,255,255,.08)", 0, false);
      const n = Math.round((w * h) / 2600);
      for (let i = 0; i < n; i++) {
        const px = x + r() * w, py = y + r() * h, k = r();
        if (k < 0.55) s += stroke("M" + f(px - 5) + " " + f(py) + " l3 -8 l2 8 l3 -10 l2 10 l3 -7", "rgba(40,110,40,.45)", 1.8);
        else if (k < 0.75) s += circ(px, py, 2.4, "#fff8e0", false) + circ(px, py, 1, "#f2c230", false);
        else if (k < 0.88) s += circ(px, py, 2.2, "#ffe36b", false);
        else s += ell(px, py, 4, 2.6, "rgba(0,0,0,.08)", false);
      }
      return s;
    },
    // bare ground of one colour with small detail scattered: sand, soil, snow, floor
    field(a, r) {
      const [x, y, w, h, c, dot, n0] = a;
      let s = rect(x, y, w, h, c, 0, false);
      const n = n0 || Math.round((w * h) / 3000);
      for (let i = 0; i < n; i++) {
        const px = x + r() * w, py = y + r() * h;
        s += r() < 0.7 ? circ(px, py, 1.2 + r() * 2.2, dot, false) : ell(px, py, 5 + r() * 5, 2 + r() * 2, dot, false);
      }
      return s;
    },
    // a paved path along a curve: kerb, paving, a joint line down the middle
    walk(a) {
      const [d, w, c] = a;
      return stroke(d, "#9b8a6e", w + 10) + stroke(d, c || "#e9dbb6", w) +
        stroke(d, "rgba(120,100,70,.35)", 2, ' stroke-dasharray="14 10"');
    },
    // a road: kerbs, asphalt, lane dashes, and a zebra crossing
    road(a) {
      const [y, h, zx, n0] = a, n = n0 || 2;
      let s = rect(-10, y - 8, 560, h + 16, "#c9c3b6", 0, false) + rect(-10, y, 560, h, "#5d6470", 0, false);
      for (let k = 1; k < n; k++) for (let x = 10; x < 540; x += 70) s += rect(x, y + (h * k) / n - 3, 36, 6, "#f4f1e6", 2, false);
      if (zx != null) for (let i = 0; i < 6; i++) s += rect(zx, y + 8 + i * ((h - 16) / 6), 70, (h - 16) / 12, "#f4f1e6", 0, false);
      return s;
    },
    // railway: ballast, sleepers, two rails
    rails(a) {
      const [y, h] = a;
      let s = rect(-10, y, 560, h, "#8a7f72", 0, false);
      for (let x = 0; x < 560; x += 22) s += rect(x, y + 8, 12, h - 16, "#6b4a32", 2, false);
      s += rect(-10, y + h * 0.28, 560, 6, "#c7ccd4", 0, "#5b616b") + rect(-10, y + h * 0.66, 560, 6, "#c7ccd4", 0, "#5b616b");
      return s;
    },
    // a pond: sandy rim, deep and shallow water, ripples, reeds, lily pads
    pond(a, r) {
      const [cx, cy, rx, ry] = a;
      let s = ell(cx, cy, rx + 14, ry + 12, "#d9c58f") + ell(cx, cy, rx, ry, "#4fa8d8") + ell(cx, cy - 6, rx * 0.86, ry * 0.8, "#6fc0ea", false);
      for (let i = 0; i < 12; i++) {
        const t = r() * Math.PI * 2, d = r() * 0.7;
        const px = cx + Math.cos(t) * rx * d, py = cy + Math.sin(t) * ry * d;
        s += stroke("M" + f(px - 12) + " " + f(py) + " q12 -6 24 0", "rgba(255,255,255,.7)", 2);
      }
      for (let i = 0; i < 8; i++) {
        const t = r() * Math.PI * 2, px = cx + Math.cos(t) * rx * (0.55 + r() * 0.3), py = cy + Math.sin(t) * ry * (0.55 + r() * 0.3);
        s += shape("path", 'd="M' + f(px) + " " + f(py) + " m-11 0 a11 7 0 1 0 22 0 l-11 0 z" + '"', "#5aa548", "#3d7a2f", 1.5);
        if (r() < 0.4) s += circ(px + 4, py - 3, 3, "#ffb3d1", false);
      }
      for (let i = 0; i < 14; i++) {
        const t = r() * Math.PI * 2, px = cx + Math.cos(t) * (rx + 6), py = cy + Math.sin(t) * (ry + 4);
        for (let k = -1; k <= 1; k++) s += line(px + k * 4, py, px + k * 6, py - 18 - r() * 10, "#4e8a3a", 2.2);
        s += ell(px + 1, py - 26, 2.4, 6, "#7a4a2a", false);
      }
      return s;
    },
    // open water (sea, lake): bands of blue with crests
    water(a, r) {
      const [x, y, w, h, c, c2] = a;
      let s = rect(x, y, w, h, c || "#3fa1db", 0, false);
      for (let yy = y + 20; yy < y + h; yy += 46) s += rect(x, yy, w, 18, c2 || "rgba(255,255,255,.07)", 0, false);
      const n = Math.round((w * h) / 5000);
      for (let i = 0; i < n; i++) {
        const px = x + r() * w, py = y + r() * h;
        s += stroke("M" + f(px - 12) + " " + f(py) + " q6 -6 12 0 t12 0", "rgba(255,255,255,.55)", 2);
      }
      return s;
    },
    // a shore line: foam over sand
    shore(a) {
      const [y, c] = a;
      return stroke("M -20 " + y + " C 120 " + (y - 26) + " 260 " + (y + 22) + " 380 " + (y - 12) + " S 520 " + (y + 10) + " 560 " + (y - 6), "#fff", 16) +
        stroke("M -20 " + (y + 14) + " C 120 " + (y - 12) + " 260 " + (y + 36) + " 380 " + (y + 2) + " S 520 " + (y + 24) + " 560 " + (y + 8), c || "rgba(255,255,255,.5)", 6);
    },
    hedge(a, r) {
      const [x, y, w, h] = a;
      let s = rect(x, y, w, h, "#3f8f3a", h / 2.4, "#2d6b2a");
      for (let i = 0; i < w / 9; i++) s += circ(x + 6 + r() * (w - 12), y + 6 + r() * (h - 12), 3 + r() * 3, "#55a94b", false);
      return s;
    },
    bush(a, r) {
      const [x, y, s0] = a, k = s0 || 1;
      let s = ell(x, y + 14 * k, 30 * k, 8 * k, "rgba(0,0,0,.14)", false);
      s += circ(x - 14 * k, y, 16 * k, "#3f8f3a", "#2d6b2a") + circ(x + 14 * k, y, 16 * k, "#3f8f3a", "#2d6b2a") + circ(x, y - 10 * k, 19 * k, "#4b9e43", "#2d6b2a");
      for (let i = 0; i < 6; i++) s += circ(x + (r() - 0.5) * 36 * k, y - 4 * k + (r() - 0.5) * 18 * k, 2.6 * k, r() < 0.3 ? "#ff7ab0" : "#6cc25c", false);
      return s;
    },
    tree(a, r) {
      const [x, y, s0, c] = a, k = s0 || 1;
      let s = ell(x + 10 * k, y + 4 * k, 40 * k, 11 * k, "rgba(0,0,0,.16)", false);
      s += rect(x - 6 * k, y - 40 * k, 12 * k, 44 * k, "#8a5a36", 3, "#5e3b22");
      s += circ(x - 22 * k, y - 50 * k, 24 * k, c || "#3f8f3a", "#2d6b2a") + circ(x + 22 * k, y - 52 * k, 24 * k, c || "#3f8f3a", "#2d6b2a") + circ(x, y - 72 * k, 30 * k, c || "#4b9e43", "#2d6b2a");
      for (let i = 0; i < 6; i++) s += circ(x + (r() - 0.5) * 60 * k, y - 60 * k + (r() - 0.5) * 34 * k, 3 * k, "rgba(255,255,255,.18)", false);
      return s;
    },
    bench(a) {
      const [x, y, c] = a;
      return ell(x, y + 16, 34, 6, "rgba(0,0,0,.15)", false) + rect(x - 28, y - 8, 4, 22, "#555") + rect(x + 24, y - 8, 4, 22, "#555") +
        rect(x - 32, y - 20, 64, 7, c || "#b0743f", 2, "#6e4423") + rect(x - 32, y - 8, 64, 8, c || "#c98a4f", 2, "#6e4423");
    },
    lamp(a) {
      const [x, y] = a;
      return ell(x, y + 2, 10, 3, "rgba(0,0,0,.18)", false) + rect(x - 2.5, y - 70, 5, 72, "#3d4450", 2, false) + rect(x - 9, y - 82, 18, 14, "#3d4450", 3, false) + rect(x - 6, y - 79, 12, 8, "#ffe9a0", 2, false);
    },
    bin(a) {
      const [x, y] = a;
      return ell(x, y + 2, 12, 3, "rgba(0,0,0,.16)", false) + rect(x - 10, y - 24, 20, 26, "#3f7d55", 3, "#2a5539") + rect(x - 12, y - 28, 24, 6, "#2f6343", 2, false);
    },
    fence(a) {
      const [x1, y, x2, c] = a;
      let s = rect(x1, y - 22, x2 - x1, 5, c || "#f3ead8") + rect(x1, y - 10, x2 - x1, 5, c || "#f3ead8");
      for (let x = x1; x <= x2; x += 24) s += rect(x - 3, y - 30, 6, 30, c || "#f3ead8", 1);
      return s;
    },
    // a flower bed: brick border, soil, rows of flowers
    bed(a, r) {
      const [x, y, w, h] = a;
      let s = rect(x - 5, y - 5, w + 10, h + 10, "#b9654a", 4, "#7e3f2c") + rect(x, y, w, h, "#7a5236", 3, false);
      const cols = ["#ff5a7a", "#ffd24d", "#b07aff", "#ff9a3c", "#ffffff"];
      for (let yy = y + 10; yy < y + h - 4; yy += 16) for (let xx = x + 10; xx < x + w - 4; xx += 16) {
        s += line(xx, yy + 6, xx, yy, "#3f8f3a", 2) + circ(xx + (r() - 0.5) * 3, yy - 1, 4.2, cols[Math.floor(r() * cols.length)], "rgba(0,0,0,.2)");
      }
      return s;
    },
    blanket(a) {
      const [x, y, w, h, c] = a;
      let s = rect(x, y, w, h, "#fff", 3, "rgba(0,0,0,.25)");
      const n = 6, cw = w / n, ch = h / 4;
      for (let i = 0; i < n; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) s += rect(x + i * cw, y + j * ch, cw, ch, c || "#e85050", 0, false);
      return s;
    },
    // a building front: wall, windows (some lit, some with flowers), door, roof
    building(a, r) {
      const [x, y, w, h, wall, roof, kind] = a;
      let s = ell(x + w / 2, y + h + 4, w * 0.55, 8, "rgba(0,0,0,.14)", false) + rect(x, y, w, h, wall, 2);
      if (kind === "peak") s += poly([[x - 8, y + 2], [x + w / 2, y - h * 0.38], [x + w + 8, y + 2]], roof);
      else s += rect(x - 6, y - 12, w + 12, 14, roof, 2);
      const cols = Math.max(2, Math.floor(w / 34)), rows = Math.max(1, Math.floor((h - 46) / 38));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const wx = x + (w / cols) * (i + 0.5) - 10, wy = y + 12 + j * 38;
        s += rect(wx, wy, 20, 24, r() < 0.35 ? "#ffe9a0" : "#9fd3f2", 2, "#3a3a3a") + line(wx + 10, wy, wx + 10, wy + 24, "#3a3a3a", 1.4);
        if (r() < 0.3) s += rect(wx - 2, wy + 22, 24, 5, "#7a4a2a", 1, false) + circ(wx + 5, wy + 21, 3, "#ff5a7a", false) + circ(wx + 14, wy + 21, 3, "#ffd24d", false);
      }
      s += rect(x + w / 2 - 12, y + h - 34, 24, 34, "#7a4a2a", 2, "#4a2a16") + circ(x + w / 2 + 6, y + h - 16, 1.8, "#ffd24d", false);
      if (r() < 0.5) {
        const ac = r() < 0.5 ? "#e85050" : "#3f7dd8";
        for (let i = 0; i < 6; i++) s += poly([[x + w / 2 - 30 + i * 10, y + h - 42], [x + w / 2 - 20 + i * 10, y + h - 42], [x + w / 2 - 25 + i * 10, y + h - 34]], i % 2 ? "#fff" : ac, false);
        s += rect(x + w / 2 - 30, y + h - 48, 60, 7, ac, 1, false);
      }
      return s;
    },
    // a far-off town: overlapping roof shapes in one pale colour
    skyline(a, r) {
      const [y, c] = a;
      let s = "", x = -10;
      while (x < 550) {
        const w = 30 + r() * 46, h = 30 + r() * 80;
        s += rect(x, y - h, w, h + 4, c, 0, false);
        for (let k = 0; k < 4; k++) if (r() < 0.6) s += rect(x + 6 + r() * (w - 14), y - h + 8 + r() * (h - 18), 6, 8, "rgba(255,255,255,.5)", 0, false);
        x += w - 4;
      }
      return s;
    },
    hills(a) {
      const [y, c, c2] = a;
      return shape("path", 'd="M -20 ' + (y + 60) + " Q 70 " + (y - 40) + " 170 " + (y + 20) + " T 380 " + (y + 5) + " T 560 " + (y + 10) + " L 560 " + (y + 200) + " L -20 " + (y + 200) + ' Z"', c, false) +
        shape("path", 'd="M -20 ' + (y + 70) + " Q 120 " + (y + 10) + " 260 " + (y + 50) + " T 560 " + (y + 30) + " L 560 " + (y + 200) + " L -20 " + (y + 200) + ' Z"', c2 || c, false);
    },
    mountains(a) {
      const [y, c, snow] = a;
      let s = "";
      [[-40, 140], [90, 190], [230, 150], [360, 200], [490, 160]].forEach(([x, h]) => {
        s += poly([[x - 90, y], [x, y - h], [x + 90, y]], c, false);
        if (snow) s += poly([[x - 26, y - h + 58], [x, y - h], [x + 26, y - h + 58], [x + 10, y - h + 48], [x, y - h + 60], [x - 12, y - h + 48]], snow, false);
      });
      return s;
    },
    cloud(a) {
      const [x, y, k0] = a, k = k0 || 1;
      return circ(x, y, 18 * k, "#fff", false) + circ(x + 20 * k, y - 8 * k, 22 * k, "#fff", false) + circ(x + 42 * k, y, 17 * k, "#fff", false) + rect(x, y - 2 * k, 42 * k, 18 * k, "#fff", 0, false);
    },
    // playground pieces
    slide(a) {
      const [x, y] = a;
      return ell(x + 20, y + 4, 50, 8, "rgba(0,0,0,.14)", false) + line(x - 30, y, x - 30, y - 70, "#3f7dd8", 5) + line(x - 10, y, x - 10, y - 70, "#3f7dd8", 5) +
        [0, 1, 2, 3].map((i) => line(x - 30, y - 14 - i * 16, x - 10, y - 14 - i * 16, "#3f7dd8", 3)).join("") +
        rect(x - 34, y - 78, 28, 8, "#e85050", 2) + stroke("M " + (x - 8) + " " + (y - 74) + " Q " + (x + 30) + " " + (y - 60) + " " + (x + 56) + " " + (y - 4), "#ffcc33", 12) +
        stroke("M " + (x - 8) + " " + (y - 74) + " Q " + (x + 30) + " " + (y - 60) + " " + (x + 56) + " " + (y - 4), "rgba(0,0,0,.18)", 2);
    },
    swings(a) {
      const [x, y] = a;
      return ell(x, y + 4, 56, 7, "rgba(0,0,0,.14)", false) + line(x - 50, y, x - 40, y - 80, "#e85050", 5) + line(x + 50, y, x + 40, y - 80, "#e85050", 5) + line(x - 44, y - 80, x + 44, y - 80, "#e85050", 5) +
        line(x - 20, y - 80, x - 20, y - 22, "#777", 1.6) + line(x - 6, y - 80, x - 6, y - 22, "#777", 1.6) + rect(x - 24, y - 24, 22, 5, "#3f7dd8", 2, false) +
        line(x + 10, y - 80, x + 10, y - 26, "#777", 1.6) + line(x + 24, y - 80, x + 24, y - 26, "#777", 1.6) + rect(x + 6, y - 28, 22, 5, "#ffcc33", 2, false);
    },
    sandpit(a, r) {
      const [x, y, w, h] = a;
      let s = rect(x - 6, y - 6, w + 12, h + 12, "#b0743f", 6, "#6e4423") + rect(x, y, w, h, "#f0d98f", 4, false);
      for (let i = 0; i < 14; i++) s += circ(x + r() * w, y + r() * h, 1.6, "#d6b866", false);
      return s;
    },
    // a wooden bridge or jetty (planks)
    bridge(a) {
      const [x, y, w, h] = a;
      let s = rect(x, y, w, h, "#b0743f", 2, "#6e4423");
      for (let xx = x + 10; xx < x + w; xx += 12) s += line(xx, y, xx, y + h, "#6e4423", 1.4);
      return s + rect(x, y - 6, w, 5, "#8a5a36", 1, false) + rect(x, y + h + 1, w, 5, "#8a5a36", 1, false);
    },
    tent(a) {
      const [x, y, c] = a;
      return ell(x, y + 4, 60, 9, "rgba(0,0,0,.16)", false) + poly([[x - 56, y], [x, y - 70], [x + 56, y]], c || "#ff8c3a", "rgba(0,0,0,.3)") +
        poly([[x - 12, y], [x, y - 54], [x + 12, y]], "#3a2a1a", false) + line(x, y - 70, x, y - 82, "#555", 2) + line(x - 56, y, x - 72, y + 6, "#888", 1.2) + line(x + 56, y, x + 72, y + 6, "#888", 1.2);
    },
    rocks(a, r) {
      const [x, y, w, h, c] = a;
      let s = "";
      for (let i = 0; i < Math.round((w * h) / 1600); i++) {
        const px = x + r() * w, py = y + r() * h, k = 0.6 + r();
        s += ell(px, py, 12 * k, 8 * k, c || "#9a9488", "rgba(0,0,0,.3)") + ell(px - 3 * k, py - 3 * k, 5 * k, 2.4 * k, "rgba(255,255,255,.3)", false);
      }
      return s;
    },
    seaweed(a, r) {
      const [x, y, w, n0] = a;
      let s = "";
      for (let i = 0; i < (n0 || 6); i++) {
        const px = x + r() * w, h = 40 + r() * 50;
        s += stroke("M " + f(px) + " " + y + " q -12 " + f(-h / 3) + " 0 " + f(-h / 1.6) + " t 0 " + f(-h / 2.4), r() < 0.5 ? "#3f9e57" : "#5bbf6a", 6);
      }
      return s;
    },
    // bubbles drifting up
    bubbles(a, r) {
      const [x, y, w, h, n] = a;
      let s = "";
      for (let i = 0; i < n; i++) s += shape("circle", 'cx="' + f(x + r() * w) + '" cy="' + f(y + r() * h) + '" r="' + f(2 + r() * 5) + '"', "rgba(255,255,255,.25)", "rgba(255,255,255,.7)", 1.4);
      return s;
    },
    // a line between two points: a kite's string, a dog's leash, a fishing line
    string(a) {
      const [x1, y1, x2, y2, c] = a;
      return stroke("M " + f(x1) + " " + f(y1) + " Q " + f((x1 + x2) / 2) + " " + f(Math.max(y1, y2) + 20) + " " + f(x2) + " " + f(y2), c || "#555", 1.6);
    },
    // a fluffy snow drift
    drift(a) {
      const [x, y, w] = a;
      return shape("path", 'd="M ' + x + " " + y + " q " + w * 0.25 + " -30 " + w * 0.5 + " -10 t " + w * 0.5 + " 0 L " + (x + w) + " " + (y + 10) + " L " + x + " " + (y + 10) + ' Z"', "#ffffff", "#cfe0ee");
    },
    // a wall of stone blocks (castles, platforms)
    wall(a, r) {
      const [x, y, w, h, c] = a;
      let s = rect(x, y, w, h, c || "#b8b0a2", 0, "#7c7468");
      for (let yy = y; yy < y + h; yy += 18) {
        const off = ((yy - y) / 18) % 2 ? 0 : 18;
        for (let xx = x - off; xx < x + w; xx += 36) s += rect(Math.max(x, xx), yy, Math.min(36, x + w - Math.max(x, xx)), 18, "rgba(0,0,0," + (0.03 + r() * 0.06) + ")", 0, "rgba(0,0,0,.18)");
      }
      return s;
    },
    // a floor of tiles or planks (rooms, stations)
    floor(a) {
      const [x, y, w, h, c, c2, step] = a;
      let s = rect(x, y, w, h, c, 0, false);
      const k = step || 40;
      for (let yy = y; yy < y + h; yy += k) for (let xx = x + (((yy - y) / k) % 2 ? k / 2 : 0); xx < x + w; xx += k) s += rect(xx, yy, k, k, c2, 0, "rgba(0,0,0,.08)");
      return s;
    },
    // a rug with a border
    rug(a) {
      const [x, y, w, h, c, c2] = a;
      return rect(x, y, w, h, c, 10, "rgba(0,0,0,.2)") + rect(x + 10, y + 10, w - 20, h - 20, "none", 6, c2 || "rgba(255,255,255,.6)") + rect(x + 20, y + 20, w - 40, h - 40, "none", 4, c2 || "rgba(255,255,255,.4)");
    },
    // a shelf with books / jars
    shelf(a, r) {
      const [x, y, w] = a;
      let s = rect(x, y - 6, w, 8, "#8a5a36", 1, "#5e3b22");
      for (let xx = x + 4; xx < x + w - 10;) { const bw = 7 + r() * 8, bh = 22 + r() * 16; s += rect(xx, y - 6 - bh, bw, bh, ["#e85050", "#3f7dd8", "#ffcc33", "#4bb36a", "#b07aff"][Math.floor(r() * 5)], 1, "rgba(0,0,0,.3)"); xx += bw + 1; }
      return s;
    },
    // stars and planets for the night or space sky
    starfield(a, r) {
      const [x, y, w, h, n] = a;
      let s = "";
      for (let i = 0; i < n; i++) {
        const px = x + r() * w, py = y + r() * h;
        s += r() < 0.85 ? circ(px, py, 0.8 + r() * 1.6, "rgba(255,255,255," + (0.5 + r() * 0.5) + ")", false) : poly([[px, py - 6], [px + 2, py - 2], [px + 6, py], [px + 2, py + 2], [px, py + 6], [px - 2, py + 2], [px - 6, py], [px - 2, py - 2]], "#fff6c8", false);
      }
      return s;
    },
    craters(a, r) {
      const [x, y, w, h, n] = a;
      let s = "";
      for (let i = 0; i < n; i++) { const px = x + r() * w, py = y + r() * h, k = 0.5 + r() * 1.3; s += ell(px, py, 22 * k, 9 * k, "#9aa0b4", "#6b728a") + ell(px, py + 2 * k, 16 * k, 5 * k, "#878ca2", false); }
      return s;
    },
    // ---- under the sea ----
    // shafts of sunlight slanting down from the surface
    rays(a, r) {
      const [y, h, n] = a;
      let s = "";
      for (let i = 0; i < (n || 6); i++) {
        const x = 20 + r() * 500, w = 30 + r() * 50, lean = 80 + r() * 60;
        s += poly([[x, y], [x + w, y], [x + w + lean, y + h], [x + lean - w * 0.4, y + h]], "rgba(255,255,255," + (0.07 + r() * 0.06).toFixed(2) + ")", false);
      }
      return s;
    },
    // a kelp forest: tall swaying strands with leaves, from the floor up
    kelp(a, r) {
      const [x, y, w, h, n] = a;
      let s = "";
      for (let i = 0; i < (n || 5); i++) {
        const px = x + r() * w, hh = h * (0.6 + r() * 0.4), c = r() < 0.5 ? "#2f8a4a" : "#3fa058";
        let d = "M " + f(px) + " " + f(y);
        const seg = 6;
        for (let k = 1; k <= seg; k++) d += " Q " + f(px + (k % 2 ? 16 : -16)) + " " + f(y - (hh * (k - 0.5)) / seg) + " " + f(px) + " " + f(y - (hh * k) / seg);
        s += stroke(d, "#245f36", 9) + stroke(d, c, 6);
        for (let k = 1; k < seg; k++) {
          const ly = y - (hh * k) / seg, side = k % 2 ? 1 : -1;
          s += ell(px + side * 12, ly, 12, 5, c, "#245f36");
        }
      }
      return s;
    },
    // a coral reef mound: rocks in reef colours, branching coral, brain coral
    reef(a, r) {
      const [x, y, w] = a;
      const COL = ["#ff7a8a", "#ffb347", "#c27aff", "#ff9ec7", "#ffd866", "#7ad7c9"];
      let s = ell(x + w / 2, y + 6, w * 0.55, 16, "rgba(0,0,0,.18)", false);
      for (let i = 0; i < Math.round(w / 34); i++) s += ell(x + 16 + r() * (w - 32), y - 10 - r() * 18, 22 + r() * 16, 16 + r() * 8, "#8d7f72", "rgba(0,0,0,.3)");
      for (let i = 0; i < Math.round(w / 40); i++) {
        const px = x + 20 + r() * (w - 40), py = y - 20 - r() * 20, c = COL[Math.floor(r() * COL.length)], h = 30 + r() * 34;
        s += stroke("M " + f(px) + " " + f(py) + " l 0 " + f(-h) + " M " + f(px) + " " + f(py - h * 0.4) + " l " + f(-h * 0.4) + " " + f(-h * 0.4) + " M " + f(px) + " " + f(py - h * 0.6) + " l " + f(h * 0.35) + " " + f(-h * 0.35), "rgba(0,0,0,.25)", 9) +
          stroke("M " + f(px) + " " + f(py) + " l 0 " + f(-h) + " M " + f(px) + " " + f(py - h * 0.4) + " l " + f(-h * 0.4) + " " + f(-h * 0.4) + " M " + f(px) + " " + f(py - h * 0.6) + " l " + f(h * 0.35) + " " + f(-h * 0.35), c, 6);
      }
      for (let i = 0; i < Math.round(w / 70); i++) {
        const px = x + 20 + r() * (w - 40), py = y - 8 - r() * 12, rr = 12 + r() * 8;
        s += circ(px, py, rr, COL[Math.floor(r() * COL.length)], "rgba(0,0,0,.3)") + stroke("M " + f(px - rr * 0.6) + " " + f(py) + " q " + f(rr * 0.3) + " -6 " + f(rr * 0.6) + " 0 t " + f(rr * 0.6) + " 0", "rgba(0,0,0,.25)", 1.6);
      }
      return s;
    },
    // a sunken ship lying on the floor, a little tilted, with its broken mast
    wreck(a) {
      const [x, y, k0] = a, k = k0 || 1;
      const X = (v) => x + v * k, Y = (v) => y + v * k;
      let s = ell(X(0), Y(6), 130 * k, 16 * k, "rgba(0,0,0,.2)", false);
      s += poly([[X(-120), Y(-60)], [X(110), Y(-40)], [X(90), Y(0)], [X(-100), Y(-10)]], "#6b4a33", "#3e2a1c");
      for (let i = 1; i < 4; i++) s += line(X(-118 + i * 4), Y(-60 + i * 14), X(104 - i * 4), Y(-40 + i * 11), "#4b3423", 2);
      s += circ(X(-40), Y(-32), 8 * k, "#2a4a5a", "#3e2a1c") + circ(X(0), Y(-28), 8 * k, "#2a4a5a", "#3e2a1c") + circ(X(40), Y(-24), 8 * k, "#2a4a5a", "#3e2a1c");
      s += line(X(-10), Y(-48), X(-40), Y(-150), "#5a3d28", 8) + line(X(-34), Y(-128), X(10), Y(-118), "#5a3d28", 5);
      s += poly([[X(-30), Y(-140)], [X(8), Y(-122)], [X(-14), Y(-96)]], "rgba(240,232,210,.7)", "rgba(0,0,0,.25)");
      s += stroke("M " + f(X(-100)) + " " + f(Y(-14)) + " q 10 -26 26 -6 q 10 -24 24 -2", "#3f9e57", 5);
      return s;
    },
    // the sandy sea floor: ripples and pebbles
    seabed(a, r) {
      const [x, y, w, h] = a;
      let s = rect(x, y, w, h, "#e2c98a", 0, false) + stroke("M " + x + " " + y + " C " + (x + w * 0.3) + " " + (y - 24) + " " + (x + w * 0.6) + " " + (y + 18) + " " + (x + w) + " " + (y - 8), "#e2c98a", 30);
      for (let yy = y + 20; yy < y + h; yy += 26) {
        let d = "M " + x + " " + f(yy);
        for (let xx = x; xx < x + w; xx += 40) d += " q 10 -6 20 0 t 20 0";
        s += stroke(d, "rgba(160,120,60,.35)", 2);
      }
      for (let i = 0; i < Math.round((w * h) / 2500); i++) s += ell(x + r() * w, y + r() * h, 3 + r() * 4, 2 + r() * 2, r() < 0.5 ? "#b9a170" : "#cfd3cf", "rgba(0,0,0,.2)");
      return s;
    },
    // ---- the market ----
    // a big market stall: a striped awning on poles, TWO wooden shelves of
    // crates the produce stands on (top at y - 84, counter at y)
    marketstall(a) {
      const [x, y, w, c] = a;
      let s = ell(x + w / 2, y + 6, w * 0.6, 9, "rgba(0,0,0,.16)", false) + rect(x + 4, y - 160, 7, 160, "#8a5a36", 1) + rect(x + w - 11, y - 160, 7, 160, "#8a5a36", 1);
      const n = Math.round(w / 22);
      for (let i = 0; i < n; i++) s += rect(x + (w / n) * i, y - 178, w / n, 24, i % 2 ? "#fff" : c, 0, "rgba(0,0,0,.2)");
      for (let i = 0; i < n; i++) s += shape("path", 'd="M' + f(x + (w / n) * i) + " " + (y - 154) + " q" + f(w / n / 2) + " 11 " + f(w / n) + ' 0"', i % 2 ? "#fff" : c, "rgba(0,0,0,.2)", 1);
      // back shelf, then the front counter, each a row of crates
      s += rect(x + 8, y - 96, w - 16, 12, "#a8703f", 2, "#6e4423");
      for (let xx = x + 12; xx < x + w - 24; xx += 30) s += rect(xx, y - 112, 26, 16, "#e0b077", 2, "#8a5a36");
      s += rect(x, y - 30, w, 30, "#c98a4f", 2, "#6e4423");
      for (let xx = x + 6; xx < x + w - 22; xx += 28) s += rect(xx, y - 40, 24, 18, "#e0b077", 2, "#8a5a36") + line(xx + 2, y - 31, xx + 22, y - 31, "#8a5a36", 1.2);
      s += rect(x + w / 2 - 20, y - 150, 40, 14, "#fff8e0", 3, "rgba(0,0,0,.3)");
      return s;
    },

    // a campfire glow on the ground
    glow(a) {
      const [x, y, rr] = a;
      return ell(x, y, rr, rr * 0.45, "rgba(255,190,90,.22)", false) + ell(x, y, rr * 0.6, rr * 0.28, "rgba(255,200,110,.25)", false);
    },
  };

  // The old flat shapes still work (rect, ellipse, path), so a place can mix.
  function draw(g, r) {
    const k = g[0], a = g.slice(1);
    if (k === "rect") return rect(a[0], a[1], a[2], a[3], a[4], 0, false);
    if (k === "ellipse") return ell(a[0], a[1], a[2], a[3], a[4], false);
    if (k === "path") return stroke(a[0], a[1], a[2]);
    if (P[k]) return P[k](a, r);
    return "";
  }

  const SeekScenery = { draw, kinds: Object.keys(P).concat(["rect", "ellipse", "path"]) };
  if (typeof module !== "undefined" && module.exports) module.exports = SeekScenery;
  global.SeekScenery = SeekScenery;
})(typeof window !== "undefined" ? window : globalThis);
