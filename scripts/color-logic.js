// 🎨 Color Book — the PURE geometry and rules (PLAN_COLOR.md). No DOM, no
// randomness; dual export so node tests drive exactly what the page draws.
//
// Every shape on a page becomes a POLYGON (a circle is 56 points, a curve is
// sampled), so the same numbers decide what is drawn, where a number goes and
// what a tap hits. A page is painted in order into an owner grid: a later
// shape covers an earlier one, so a region's VISIBLE part is what its number
// and its taps use — never the part hidden under a wheel.

(function (global) {
  "use strict";

  const W = 200, H = 200; // every page is a 200x200 drawing
  const GRID = 2;         // raster cells per unit (400x400 owner grid)

  // ---- Shape helpers: every one returns a closed polygon [[x,y], ...] -------
  function circle(cx, cy, r, n) { return ellipse(cx, cy, r, r, 0, n); }
  function ellipse(cx, cy, rx, ry, rot, n) {
    const k = n || Math.max(24, Math.min(72, Math.round((rx + ry) * 1.2)));
    const a = ((rot || 0) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    const out = [];
    for (let i = 0; i < k; i++) {
      const t = (i / k) * Math.PI * 2, x = Math.cos(t) * rx, y = Math.sin(t) * ry;
      out.push([cx + x * ca - y * sa, cy + x * sa + y * ca]);
    }
    return out;
  }
  // A rectangle with rounded corners (r may be 0).
  function rect(x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r || 0, w / 2, h / 2));
    if (!rr) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    const out = [];
    const corner = (cx, cy, a0) => { for (let i = 0; i <= 6; i++) { const t = ((a0 + i * 15) * Math.PI) / 180; out.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]); } };
    corner(x + w - rr, y + rr, -90); corner(x + w - rr, y + h - rr, 0);
    corner(x + rr, y + h - rr, 90); corner(x + rr, y + rr, 180);
    return out;
  }
  function star(cx, cy, ro, ri, points, rot) {
    const out = [], k = points || 5, a0 = ((rot || -90) * Math.PI) / 180;
    for (let i = 0; i < k * 2; i++) {
      const r = i % 2 ? ri : ro, t = a0 + (i * Math.PI) / k;
      out.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
    }
    return out;
  }
  function poly(pts) { return pts.map((p) => [p[0], p[1]]); }

  // An SVG path (M L H V C Q Z, upper or lower case) sampled into one polygon.
  function path(d) {
    const tok = String(d).match(/[MLHVCQZmlhvcqz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
    const out = [];
    let i = 0, cmd = "M", x = 0, y = 0, sx = 0, sy = 0;
    const num = () => +tok[i++];
    while (i < tok.length) {
      if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
      if (C === "Z") { x = sx; y = sy; continue; }
      if (C === "M" || C === "L") {
        const nx = num() + (rel ? x : 0), ny = num() + (rel ? y : 0);
        x = nx; y = ny; out.push([x, y]);
        if (C === "M") { sx = x; sy = y; cmd = rel ? "l" : "L"; }
      } else if (C === "H") { x = num() + (rel ? x : 0); out.push([x, y]); }
      else if (C === "V") { y = num() + (rel ? y : 0); out.push([x, y]); }
      else if (C === "C") {
        const x1 = num() + (rel ? x : 0), y1 = num() + (rel ? y : 0), x2 = num() + (rel ? x : 0), y2 = num() + (rel ? y : 0), ex = num() + (rel ? x : 0), ey = num() + (rel ? y : 0);
        for (let s = 1; s <= 12; s++) {
          const t = s / 12, u = 1 - t;
          out.push([u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey]);
        }
        x = ex; y = ey;
      } else if (C === "Q") {
        const x1 = num() + (rel ? x : 0), y1 = num() + (rel ? y : 0), ex = num() + (rel ? x : 0), ey = num() + (rel ? y : 0);
        for (let s = 1; s <= 10; s++) {
          const t = s / 10, u = 1 - t;
          out.push([u * u * x + 2 * u * t * x1 + t * t * ex, u * u * y + 2 * u * t * y1 + t * t * ey]);
        }
        x = ex; y = ey;
      } else i++;
    }
    // a closed shape: drop a last point that repeats the first
    if (out.length > 2) { const a = out[0], b = out[out.length - 1]; if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) out.pop(); }
    return out;
  }

  // Transforms, for symmetric or repeated parts.
  const move = (pts, dx, dy) => pts.map((p) => [p[0] + dx, p[1] + dy]);
  const mirror = (pts, ax) => pts.map((p) => [2 * ax - p[0], p[1]]).reverse();
  function rotate(pts, deg, cx, cy) {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return pts.map((p) => { const x = p[0] - cx, y = p[1] - cy; return [cx + x * c - y * s, cy + x * s + y * c]; });
  }

  // A segment clipped to a CONVEX polygon (Cyrus-Beck), for detail lines that
  // must stay inside a shape (a cone's waffle, a ladder's rungs). null if out.
  function clipLine(a, b, pts) {
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    // orientation of the polygon, so "inside" is the same side of every edge
    let area = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
    const sgn = area > 0 ? 1 : -1;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const ex = pts[i][0] - pts[j][0], ey = pts[i][1] - pts[j][1];
      const nx = -ey * sgn, ny = ex * sgn; // inward normal
      const num = nx * (a[0] - pts[j][0]) + ny * (a[1] - pts[j][1]);
      const den = nx * dx + ny * dy;
      if (Math.abs(den) < 1e-9) { if (num < 0) return null; continue; }
      const t = -num / den;
      if (den > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
      if (t0 > t1) return null;
    }
    return [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]];
  }

  const r1 = (v) => Math.round(v * 10) / 10;
  function toD(pts) { return pts.length ? "M" + pts.map((p) => r1(p[0]) + " " + r1(p[1])).join("L") + "Z" : ""; }
  function lineD(pts) { return pts.length ? "M" + pts.map((p) => r1(p[0]) + " " + r1(p[1])).join("L") : ""; }

  // ---- The owner grid -----------------------------------------------------------
  // Each cell (sampled at its centre) belongs to the LAST region covering it,
  // or -1 for the background. Even-odd scanline fill per region, in order.
  function raster(page, grid) {
    const g = grid || GRID, gw = W * g, gh = H * g;
    const own = new Int16Array(gw * gh).fill(-1);
    page.regions.forEach((reg, idx) => {
      const pts = reg.pts, n = pts.length;
      for (let row = 0; row < gh; row++) {
        const y = (row + 0.5) / g, xs = [];
        for (let k = 0, j = n - 1; k < n; j = k++) {
          const a = pts[j], b = pts[k];
          if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
        }
        if (xs.length < 2) continue;
        xs.sort((p, q) => p - q);
        for (let q = 0; q + 1 < xs.length; q += 2) {
          let c0 = Math.ceil(xs[q] * g - 0.5), c1 = Math.floor(xs[q + 1] * g - 0.5);
          if (c0 < 0) c0 = 0;
          if (c1 > gw - 1) c1 = gw - 1;
          for (let c = c0; c <= c1; c++) own[row * gw + c] = idx;
        }
      }
    });
    return { own, gw, gh, g };
  }

  // Distance (in cells) from every cell to the nearest cell of another owner
  // (or the page's edge): a two-pass chamfer transform.
  function distance(r) {
    const { own, gw, gh } = r, D = new Float32Array(gw * gh), INF = 1e9, S = Math.SQRT2;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = y * gw + x, o = own[i];
      const edge = x === 0 || y === 0 || x === gw - 1 || y === gh - 1 ||
        own[i - 1] !== o || own[i + 1] !== o || own[i - gw] !== o || own[i + gw] !== o;
      D[i] = edge ? 0.5 : INF;
    }
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = y * gw + x; let d = D[i];
      if (x > 0) d = Math.min(d, D[i - 1] + 1);
      if (y > 0) { d = Math.min(d, D[i - gw] + 1); if (x > 0) d = Math.min(d, D[i - gw - 1] + S); if (x < gw - 1) d = Math.min(d, D[i - gw + 1] + S); }
      D[i] = d;
    }
    for (let y = gh - 1; y >= 0; y--) for (let x = gw - 1; x >= 0; x--) {
      const i = y * gw + x; let d = D[i];
      if (x < gw - 1) d = Math.min(d, D[i + 1] + 1);
      if (y < gh - 1) { d = Math.min(d, D[i + gw] + 1); if (x < gw - 1) d = Math.min(d, D[i + gw + 1] + S); if (x > 0) d = Math.min(d, D[i + gw - 1] + S); }
      D[i] = d;
    }
    return D;
  }

  // Where each numbered region's number goes: its widest visible point, and
  // how wide it is there (the radius, in page units). Also its visible area.
  // Ink lines (a smile, ladder rungs) are drawn over the shapes, so a number
  // must not sit on one: they are stamped into a copy of the grid as an
  // obstacle (-2) before the distance transform. Taps use the plain grid.
  function stampInk(page, r) {
    const { gw, gh, g } = r, own = Int16Array.from(r.own);
    for (const l of page.ink || []) {
      const half = (l.w || 2) / 2 + 0.6;
      for (let k = 0; k + 1 < l.pts.length; k++) {
        const a = l.pts[k], b = l.pts[k + 1];
        const x0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - half) * g)), x1 = Math.min(gw - 1, Math.ceil((Math.max(a[0], b[0]) + half) * g));
        const y0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - half) * g)), y1 = Math.min(gh - 1, Math.ceil((Math.max(a[1], b[1]) + half) * g));
        const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy || 1;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const px = (x + 0.5) / g, py = (y + 0.5) / g;
          const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
          const ex = a[0] + dx * t - px, ey = a[1] + dy * t - py;
          if (ex * ex + ey * ey <= half * half) own[y * gw + x] = -2;
        }
      }
    }
    return { own, gw, gh, g };
  }
  // The number goes where the region is widest — and among the points nearly
  // that wide, the one nearest the region's middle, so a long strip (a ladder,
  // a stripe) gets its number in the middle, not at its left end.
  function labels(page, r0) {
    const base = r0 || raster(page), r = stampInk(page, base);
    const D = distance(r), { own, gw, g } = r;
    const n = page.regions.length;
    const out = page.regions.map(() => ({ x: 0, y: 0, r: 0, area: 0 }));
    const max = new Float32Array(n), sx = new Float64Array(n), sy = new Float64Array(n);
    for (let i = 0; i < own.length; i++) {
      const o = base.own[i]; if (o < 0) continue;
      out[o].area += 1; sx[o] += (i % gw) + 0.5; sy[o] += Math.floor(i / gw) + 0.5;
      if (own[i] === o && D[i] > max[o]) max[o] = D[i];
    }
    const best = new Float64Array(n).fill(Infinity);
    for (let i = 0; i < own.length; i++) {
      const o = own[i]; if (o < 0 || D[i] < max[o] * 0.85) continue;
      const cx = sx[o] / out[o].area, cy = sy[o] / out[o].area;
      const x = (i % gw) + 0.5, y = Math.floor(i / gw) + 0.5;
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy) - D[i] * D[i] * 4;
      if (d < best[o]) { best[o] = d; out[o].x = x / g; out[o].y = y / g; out[o].r = D[i] / g; }
    }
    for (const L of out) L.area /= g * g;
    return out;
  }

  // What a math region shows: "a+b" that makes its number.
  function labelText(reg) {
    if (reg.sum) return reg.sum[0] + "+" + reg.sum[1];
    return String(reg.n);
  }
  // The smallest radius a label needs at the page's 200-unit width (a digit
  // must read on a 320px phone: about 13px of radius there).
  const R_MIN = 7, R_MIN_SUM = 11.5;
  const needR = (reg) => (reg.sum ? R_MIN_SUM : R_MIN);
  // The label's font size, in page units.
  function fontSize(reg, L) {
    const base = reg.sum ? L.r * 0.82 : L.r * 1.2;
    return Math.max(8, Math.min(reg.sum ? 15 : 20, base));
  }

  // ---- The forgiving tap ---------------------------------------------------------
  // x, y in page units. sel = the chosen number. done = Set of filled indices.
  // Returns { kind: "fill", i } | { kind: "wrong", i } | { kind: "done", i } | { kind: "none" }.
  const TOL = 14; // page units: about 26px on a phone — a fingertip's slop
  // A finger on a shape of ANOTHER number still paints a shape of the chosen
  // color when that one is this close (about 17px on a phone): he was aiming
  // at it and landed just over its edge. Further than that, he meant the
  // shape under his finger, and it shows him its number instead.
  const NEAR = 9;
  function judge(page, r, x, y, sel, done, tol) {
    const t = tol == null ? TOL : tol, { own, gw, gh, g } = r;
    const cx = Math.floor(x * g), cy = Math.floor(y * g);
    const at = cx >= 0 && cy >= 0 && cx < gw && cy < gh ? own[cy * gw + cx] : -1;
    const want = (i) => i >= 0 && page.regions[i].n === sel && !done.has(i);
    if (want(at)) return { kind: "fill", i: at };
    // the nearest region of the chosen number within a fingertip
    let best = -1, bd = Infinity;
    const R = Math.ceil(t * g);
    for (let dy = -R; dy <= R; dy++) {
      const yy = cy + dy; if (yy < 0 || yy >= gh) continue;
      for (let dx = -R; dx <= R; dx++) {
        const xx = cx + dx; if (xx < 0 || xx >= gw) continue;
        const d2 = dx * dx + dy * dy; if (d2 > R * R || d2 >= bd) continue;
        const o = own[yy * gw + xx];
        if (want(o)) { bd = d2; best = o; }
      }
    }
    // A finger well inside a different, unfilled numbered region meant THAT
    // region; only a finger near its edge goes to the chosen color.
    if (at >= 0 && page.regions[at].n && !done.has(at) && page.regions[at].n !== sel) {
      if (best >= 0 && Math.sqrt(bd) / g <= NEAR) return { kind: "fill", i: best };
      return { kind: "wrong", i: at };
    }
    if (best >= 0) return { kind: "fill", i: best };
    if (at >= 0 && done.has(at)) return { kind: "done", i: at };
    return { kind: "none" };
  }

  // Which region owns the page point (x, y), or -1.
  function ownerAt(r, x, y) {
    const cx = Math.floor(x * r.g), cy = Math.floor(y * r.g);
    return cx >= 0 && cy >= 0 && cx < r.gw && cy < r.gh ? r.own[cy * r.gw + cx] : -1;
  }
  // The numbered regions of each color, and the next color with any left.
  function remaining(page, done) {
    const left = {};
    for (const c of page.colors) left[c.n] = 0;
    page.regions.forEach((reg, i) => { if (reg.n && !done.has(i)) left[reg.n] += 1; });
    return left;
  }
  function nextColor(page, done, from) {
    const left = remaining(page, done), ns = page.colors.map((c) => c.n);
    const start = Math.max(0, ns.indexOf(from));
    for (let k = 1; k <= ns.length; k++) { const n = ns[(start + k) % ns.length]; if (left[n] > 0) return n; }
    return null;
  }
  const numbered = (page) => page.regions.map((reg, i) => (reg.n ? i : -1)).filter((i) => i >= 0);
  const finished = (page, done) => numbered(page).every((i) => done.has(i));

  // Hex helpers (contrast for labels and pots).
  function hexRgb(h) { const s = String(h).replace("#", ""); const f = s.length === 3 ? s.split("").map((c) => c + c).join("") : s; return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)); }
  function lum(h) { return hexRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0); }
  function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  // The ink a pot's number wears on its color: dark or white, whichever reads.
  const inkOn = (hex) => (contrast(hex, "#1f2333") >= contrast(hex, "#ffffff") ? "#1f2333" : "#ffffff");
  // A light tint of a color (the shimmer on a region waiting for it).
  function tint(hex, t) { const c = hexRgb(hex); return "#" + c.map((v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, "0")).join(""); }
  // The shimmer on a shape waiting for its color: a light tint of it, lightened
  // further when the number (LABEL, gray) would not read on it — a black's
  // 0.62 tint is a mid gray, 2.77:1 against the number.
  const LABEL = "#5f6675";
  function wantTint(hex) {
    let t = 0.62, c = tint(hex, t);
    while (contrast(LABEL, c) < 3.2 && t < 0.95) { t += 0.03; c = tint(hex, t); }
    return c;
  }

  // ---- The page as SVG markup --------------------------------------------------
  // fills: { regionIndex: hex } for what is painted · labels: from labels() (or
  // null for no numbers) · shade: the finished look (a light from the upper
  // left on every shape, the shared jart-lit gradient) · thumb: a small copy
  // (thinner lines, no hooks). Regions are grouped by `part`, in runs, so a
  // part can come alive without changing what covers what.
  const OUTLINE = "#232634";
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  // ---- Paint: a color, or a color with MAGIC on it ------------------------------
  // A paint is "#rrggbb", or "#rrggbb fx" where fx is one of the magic crayons.
  // The magic is drawn from gradients and patterns declared ONCE in index.html
  // (ids resolve document-wide, so the 12 thumbnails in the book and the page
  // share them, as JoshArt's light does): rainbow REPLACES the color, the other
  // three lie over it (white sparkles, stripes, dots), so they suit any color.
  const FX = ["rainbow", "glitter", "stripes", "dots"];
  function isPaint(v) {
    if (typeof v !== "string") return false;
    const m = /^#[0-9a-f]{6}(?: ([a-z]+))?$/i.exec(v);
    return !!m && (!m[1] || FX.includes(m[1]));
  }
  function paintOf(v) {
    const s = String(v || "#ffffff").split(" ");
    return { hex: s[0], fx: FX.includes(s[1]) ? s[1] : null };
  }
  // the fill attribute for a paint; the overlay (or "") that lies on top of it
  const paintFill = (v) => { const p = paintOf(v); return p.fx === "rainbow" ? "url(#cb-fx-rainbow) " + p.hex : p.hex; };
  const paintOver = (v, d) => { const p = paintOf(v); return p.fx && p.fx !== "rainbow" ? `<path class="cb-fx" d="${d}" fill="url(#cb-fx-${p.fx}) none" pointer-events="none"/>` : ""; };

  function pageSvg(page, o) {
    const opt = o || {}, fills = opt.fills || {}, labs = opt.labels || null;
    const sw = opt.thumb ? 2.4 : 1.8;
    const lastRun = {};
    page.regions.forEach((reg, i) => { if (reg.part) lastRun[reg.part] = i; });
    // A line with `after: i` is drawn right after region i (the waffle on a
    // cone the scoops then cover); the rest go over their part's last region.
    const inkLine = (l) => `<path d="${lineD(l.pts)}" fill="none" stroke="${l.color}" stroke-width="${l.w}" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`;
    const inkAfter = (i) => (page.ink || []).filter((l) => l.after === i).map(inkLine).join("");
    const inkOf = (part) => (page.ink || []).filter((l) => (l.part || null) === part && l.after == null)
      .map((l) => `<path d="${lineD(l.pts)}" fill="none" stroke="${l.color}" stroke-width="${l.w}" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`).join("");
    let out = `<svg class="${opt.cls || "cb-svg"}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">`;
    let open = null;
    page.regions.forEach((reg, i) => {
      const part = reg.part || null;
      if (part !== open) {
        if (open) out += "</g>";
        if (part) out += `<g class="cb-part" data-part="${esc(part)}">`;
        open = part;
      }
      const paint = reg.fill || fills[i] || "#ffffff", d = toD(reg.pts);
      const hook = opt.thumb ? "" : ` data-i="${i}"${reg.n ? ` data-n="${reg.n}"` : ""}`;
      out += `<path class="cb-r${reg.n ? " cb-num" : ""}" d="${d}" fill="${paintFill(paint)}" stroke="${OUTLINE}" stroke-width="${sw}" stroke-linejoin="round"${hook}/>`;
      out += paintOver(paint, d);
      if (opt.shade && i > 0) out += `<path d="${d}" fill="url(#jart-lit) none" pointer-events="none"/>`;
      out += inkAfter(i);
      if (part && lastRun[part] === i) out += inkOf(part);
    });
    if (open) out += "</g>";
    out += inkOf(null);
    if (labs) {
      out += `<g class="cb-labels" pointer-events="none">`;
      page.regions.forEach((reg, i) => {
        if (!reg.n || fills[i]) return;
        const L = labs[i], fs = fontSize(reg, L);
        out += `<text class="cb-label" data-for="${i}" x="${r1(L.x)}" y="${r1(L.y)}" font-size="${r1(fs)}" text-anchor="middle" dominant-baseline="central">${esc(labelText(reg))}</text>`;
      });
      out += "</g>";
    }
    return out + "</svg>";
  }

  const api = {
    W, H, GRID, R_MIN, R_MIN_SUM, TOL,
    circle, ellipse, rect, star, poly, path, move, mirror, rotate, clipLine, toD, lineD,
    raster, distance, labels, labelText, needR, fontSize,
    judge, ownerAt, remaining, nextColor, numbered, finished,
    FX, isPaint, paintOf, paintFill, paintOver,
    hexRgb, lum, contrast, inkOn, tint, wantTint, LABEL, pageSvg, OUTLINE,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.ColorLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
