#!/usr/bin/env node
// 🗺️ Builds scripts/map-shapes.js — the REAL outlines behind every World map
// game — from Natural Earth (public domain, naturalearthdata.com) projected
// with d3-geo (ISC). The site never loads either: this writes plain SVG path
// strings and pin positions into one generated file. Never hand-edit that
// file; change the specs below or content.js and run this again.
//
//   mkdir /tmp/mg && cd /tmp/mg && npm init -y && npm i d3-geo@3.1.1
//   B=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
//   for f in ne_110m_admin_0_countries ne_50m_admin_0_countries ne_10m_admin_1_states_provinces; do
//     curl -sO $B/$f.geojson; done
//   node tools/map-gen.js /tmp/mg
//
// Each place in content.js carries its TRUE spot (`at: [lon, lat]`). Its pin
// (a ≥78px button) sits right on that spot when there is room; where two real
// places are closer than two pins can be (Seattle and Mount Rainier, Beijing
// and Shanghai), the pin moves to the nearest open space and a line joins it
// to a dot on the true spot. Every true spot must land on its own drawn region
// (the browser test checks it), and no pin may cover another place's spot.
"use strict";
const fs = require("fs");
const path = require("path");
const DIR = process.argv[2];
if (!DIR) { console.error("usage: node tools/map-gen.js <dir with d3-geo and the Natural Earth geojson>"); process.exit(1); }
const d3 = require(path.join(path.resolve(DIR), "node_modules", "d3-geo"));
const ROOT = path.join(__dirname, "..");
global.window = global;
const C = require(path.join(ROOT, "scripts/content.js"));
const load = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f + ".geojson"), "utf8"));
const C110 = load("ne_110m_admin_0_countries").features;
const C50 = load("ne_50m_admin_0_countries").features;
const S10 = load("ne_10m_admin_1_states_provinces").features;

const W = 340, H = 400;
const col = { sea: "#8fd3ff", land: "#e9e4d4", edge: "#ffffff" };

// ---- small geometry helpers ------------------------------------------------
const circle = (lon, lat, r, n = 28) => {
  const ring = [];
  for (let i = 0; i <= n; i++) { const a = (2 * Math.PI * i) / n; ring.push([lon + r * Math.cos(a) / Math.cos(lat * Math.PI / 180), lat + r * Math.sin(a)]); }
  return small({ type: "Polygon", coordinates: [ring] });
};
// d3 reads ring order on the SPHERE: wound the wrong way, a small shape is
// the whole globe but itself (it flooded the map). Wind it the small way.
const small = (g) => (d3.geoArea(g) > 2 * Math.PI ? { type: "Polygon", coordinates: g.coordinates.map((r) => r.slice().reverse()) } : g);
const poly = (pts) => small({ type: "Polygon", coordinates: [pts.concat([pts[0]])] });
// a band along a polyline, `half` degrees each side (the Great Wall, the Cascades)
const band = (pts, half) => {
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    L.push([pts[i][0] - (dy / d) * half, pts[i][1] + (dx / d) * half]);
    R.push([pts[i][0] + (dy / d) * half, pts[i][1] - (dx / d) * half]);
  }
  return poly(L.concat(R.reverse()));
};
// a longitude box, densified so it curves with the projection
const lonBox = (lon0, lat0, lon1, lat1) => {
  const pts = [];
  for (let x = lon0; x <= lon1; x += 2) pts.push([x, lat0]);
  for (let y = lat0; y <= lat1; y += 2) pts.push([lon1, y]);
  for (let x = lon1; x >= lon0; x -= 2) pts.push([x, lat1]);
  for (let y = lat1; y >= lat0; y -= 2) pts.push([lon0, y]);
  return poly(pts);
};
// Sutherland-Hodgman against a meridian: keep the side west (or east) of lon
function clipLon(geom, lon, keepWest) {
  const inside = (p) => (keepWest ? p[0] <= lon : p[0] >= lon);
  const cut = (a, b) => { const t = (lon - a[0]) / (b[0] - a[0]); return [lon, a[1] + t * (b[1] - a[1])]; };
  const ring = (r) => {
    const out = [];
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i], b = r[i + 1];
      if (inside(a)) { out.push(a); if (!inside(b)) out.push(cut(a, b)); } else if (inside(b)) out.push(cut(a, b));
    }
    if (out.length > 2) out.push(out[0]);
    return out.length > 3 ? out : null;
  };
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  const res = polys.map((p) => p.map(ring)).filter((p) => p[0]).map((p) => p.filter(Boolean));
  return { type: "MultiPolygon", coordinates: res };
}

// ---- the maps ---------------------------------------------------------------
// fit: what fills the box; layers, drawn in order: [region | null, colour, geometry]
const ne = (list, f) => list.filter(f).map((x) => x.geometry);
const named = (list, key, v) => ne(list, (x) => x.properties[key] === v);
const merged = (geoms) => ({ type: "GeometryCollection", geometries: geoms });
const state = (code) => ne(S10, (x) => x.properties.iso_3166_2 === code);
const cont = (name) => ne(C110, (x) => x.properties.CONTINENT === name && x.properties.ADMIN !== "Russia");
const russia110 = named(C110, "ADMIN", "Russia")[0];

const MAPS = {
  WA_MAP: {
    proj: d3.geoMercator(),
    fit: lonBox(-126, 45.4, -116.6, 49.2),
    layers: [
      ["sea", col.sea, "rect"],
      ["land", col.land, merged(state("US-OR").concat(state("US-ID"), ne(S10, (x) => x.properties.name === "British Columbia")))],
      ["land", "#9fd08a", merged(state("US-WA"))],
      ["dry", "#e8d28c", poly([[-120.55, 49.0], [-117.03, 49.0], [-117.03, 46.0], [-118.9, 45.95], [-120.3, 45.65], [-120.85, 46.6], [-120.6, 47.6], [-120.75, 48.6]])],
      ["cascades", "#6b7f62", band([[-121.2, 48.95], [-121.45, 48.0], [-121.35, 47.2], [-121.7, 46.4], [-121.9, 45.8]], 0.22)],
      ["rainier", "#7d8c86", circle(-121.76, 46.85, 0.18)],
      ["seattle", "#e05a4f", circle(-122.33, 47.61, 0.09)],
    ],
  },
  WORLD_MAP: {
    proj: d3.geoNaturalEarth1(),
    fit: { type: "Sphere" },
    layers: [
      ["sea", col.sea, "rect"],
      ["na", "#7ccf7a", merged(cont("North America"))],
      ["sa", "#9edc7a", merged(cont("South America"))],
      ["eu", "#c9a8e8", merged(cont("Europe").concat([clipLon(russia110, 60, true)]))],
      ["af", "#e8c46a", merged(cont("Africa"))],
      ["as", "#c2d86a", merged(cont("Asia").concat([clipLon(russia110, 60, false)]))],
      ["au", "#e8b25a", merged(cont("Oceania"))],
      ["an", "#f4f9ff", merged(cont("Antarctica"))],
    ],
  },
  OCEAN_MAP: {
    proj: d3.geoNaturalEarth1(),
    fit: { type: "Sphere" },
    layers: [
      ["sea", col.sea, "rect"],
      ["pacific", "#78c4f2", merged([lonBox(-180, -60, -70, 65), lonBox(145, -60, 180, 65)])],
      ["atlantic", "#8ad0f6", lonBox(-70, -60, 20, 65)],
      ["indian", "#80cbf0", lonBox(20, -60, 145, 25)],
      ["arctic", "#cdeefc", lonBox(-180, 65, 180, 90)],
      ["southern", "#a7dcf7", lonBox(-180, -90, 180, -60)],
      ["land", "#d9d2bc", merged(ne(C110, () => true))],
    ],
  },
  USA_MAP: {
    proj: d3.geoAlbersUsa(),
    fit: merged(ne(S10, (x) => x.properties.iso_a2 === "US")),
    layers: [
      ["sea", col.sea, "rect"],
      ["land", col.land, merged(ne(S10, (x) => x.properties.iso_a2 === "US"))],
      ["wa", "#7ccf7a", merged(state("US-WA"))],
      ["ca", "#f4c46a", merged(state("US-CA"))],
      ["tx", "#e88f6a", merged(state("US-TX"))],
      ["fl", "#7cc6d8", merged(state("US-FL"))],
      ["ny", "#c79ae0", merged(state("US-NY"))],
      ["ak", "#e9f4f9", merged(state("US-AK"))],
      ["hi", "#7ccf7a", merged(state("US-HI"))],
    ],
  },
  CHINA_MAP: {
    proj: d3.geoMercator(),
    fit: lonBox(72, 17, 136, 54),
    layers: [
      ["sea", col.sea, "rect"],
      ["land", col.land, merged(ne(C50, (x) => ["Asia", "Europe"].includes(x.properties.CONTINENT) && x.properties.ADMIN !== "China"))],
      ["land", "#f2d98c", merged(named(C50, "ADMIN", "China"))],
      ["wall", "#b5835a", band([[98.2, 39.8], [101.5, 38.9], [104.5, 38.2], [106.5, 38.6], [108.8, 39.7], [111.2, 40.4], [114.0, 40.8], [116.5, 40.45], [119.7, 40.0]], 0.45)],
      ["pandas", "#4fa84a", circle(103.4, 30.9, 1.6)],
      ["everest", "#8c9aa3", poly([[86.925, 29.2], [88.2, 27.4], [85.65, 27.4]])],
      ["beijing", "#e05a4f", circle(116.4, 39.9, 0.7)],
      ["shanghai", "#e05a4f", circle(121.47, 31.23, 0.7)],
    ],
  },
  EUROPE_MAP: {
    proj: d3.geoConicConformal().parallels([40, 62]).rotate([-15, 0]),
    fit: lonBox(-11, 35, 36, 71),
    layers: [
      ["sea", col.sea, "rect"],
      ["land", col.land, merged(ne(C50, (x) => ["Europe", "Asia", "Africa"].includes(x.properties.CONTINENT)))],
      ["uk", "#c9a8e8", merged(named(C50, "ADMIN", "United Kingdom"))],
      ["norway", "#a9d8f0", merged(named(C50, "ADMIN", "Norway"))],
      ["russia", "#e8a8a8", merged(named(C50, "ADMIN", "Russia"))],
      ["france", "#a8b8f0", merged(named(C50, "ADMIN", "France"))],
      ["spain", "#f4cf6a", merged(named(C50, "ADMIN", "Spain"))],
      ["italy", "#9edc7a", merged(named(C50, "ADMIN", "Italy"))],
    ],
  },
  SOUTH_AMERICA_MAP: {
    proj: d3.geoMercator(),
    fit: lonBox(-83, -56, -33, 13),
    layers: [
      ["sea", col.sea, "rect"],
      ["land", col.land, merged(ne(C50, (x) => ["South America", "North America"].includes(x.properties.CONTINENT)))],
      ["colombia", "#f4cf6a", merged(named(C50, "ADMIN", "Colombia"))],
      ["peru", "#e8a8a8", merged(named(C50, "ADMIN", "Peru"))],
      ["argentina", "#a9d8f0", merged(named(C50, "ADMIN", "Argentina"))],
      ["amazon", "#4fa84a", poly([[-77.5, -2], [-72, 1.5], [-66, 2.5], [-58, 3.5], [-52, 2], [-48, -2], [-49.5, -7.5], [-55, -11], [-63, -12], [-70, -10.5], [-74.5, -7.5], [-77, -4.5]])],
    ],
  },
  AUSTRALIA_MAP: {
    proj: d3.geoMercator(),
    fit: lonBox(112, -44, 155, -10),
    layers: [
      ["sea", col.sea, "rect"],
      ["land", col.land, merged(ne(C50, (x) => ["Oceania", "Asia"].includes(x.properties.CONTINENT) && x.properties.ADMIN !== "Australia"))],
      ["land", "#e8b25a", merged(named(C50, "ADMIN", "Australia"))],
      ["reef", "#5fd0c8", poly([[145.2, -13.8], [146.6, -15.6], [148.2, -18.4], [150.6, -20.6], [152.9, -23.4], [153.6, -22.6], [151.6, -19.6], [149.4, -17.2], [147.4, -14.6], [145.8, -11.8]])],
      ["perth", "#e05a4f", circle(115.86, -31.95, 0.55)],
      ["uluru", "#c8552a", circle(131.04, -25.34, 0.6)],
      ["sydney", "#e05a4f", circle(151.21, -33.87, 0.55)],
    ],
  },
};

// ---- render -----------------------------------------------------------------
const PAD = 6;
function simplify(pts, eps) {
  // Douglas-Peucker on a ring (eps in px): keeps the shape, drops the noise
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], L = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function pathOf(pg, geom) {
  const raw = pg(geom) || "";
  let out = "";
  for (const seg of raw.split("M").slice(1)) {
    const closed = /Z\s*$/.test(seg);
    const pts = seg.replace(/Z\s*$/, "").split("L").map((q) => q.split(",").map(Number));
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 - x0 < 1.5 && y1 - y0 < 1.5) continue;
    // split at the point farthest from the start: on a ring that ends where it
    // began, every point measures 0 from the start-end line and the whole ring
    // was thrown away (it took Antarctica's coast with it)
    let far = 0, fd = -1;
    pts.forEach(([x, y], i) => { const dd = Math.hypot(x - pts[0][0], y - pts[0][1]); if (dd > fd) { fd = dd; far = i; } });
    const kept = far > 0 ? simplify(pts.slice(0, far + 1), 0.7).concat(simplify(pts.slice(far), 0.7).slice(1)) : simplify(pts, 0.7);
    if (kept.length < 3) continue;
    out += "M" + kept.map(([x, y]) => (Math.round(x * 10) / 10) + "," + (Math.round(y * 10) / 10)).join("L") + (closed ? "Z" : "");
  }
  return out;
}
// one pin per place: on its spot if it fits, else open space nearby. Every
// placing ORDER is tried (≤7 places), and the layout kept is the one that
// moves the pins least, with a heavy cost for two lines that cross.
function placePins(zones, spots, box) {
  const d = box.dot, gap = box.minGap, R = d / 2;
  const fits = (p, placed) => {
    for (const w of [box.w, 280]) {
      const x = (p[0] / 100) * w, y = (p[1] / 100) * box.h;
      if (x - R < 0 || x + R > w || y - R < 0 || y + R > box.h) return false;
      for (const q of placed) {
        const qx = (q[0] / 100) * w, qy = (q[1] / 100) * box.h, dx = Math.abs(x - qx), dy = Math.abs(y - qy);
        const oX = dx < d, oY = dy < d;
        if ((oX && oY) || (oX && dy - d < gap) || (oY && dx - d < gap)) return false;
      }
    }
    return true;
  };
  // a pin may not cover another place's true spot
  const covers = (p, id) => zones.some((z) => z.id !== id && Math.abs((spots[z.id][0] - p[0]) / 100 * box.w) < R + 5 && Math.abs((spots[z.id][1] - p[1]) / 100 * box.h) < R + 5);
  const cands = {};
  for (const z of zones) {
    const s = spots[z.id], list = [[Math.round(s[0] * 10) / 10, Math.round(s[1] * 10) / 10]];
    for (let x = 12; x <= 88; x += 1.5) for (let y = 10; y <= 90; y += 1.5) list.push([x, y]);
    cands[z.id] = list.filter((c) => !covers(c, z.id)).map((c) => [c, Math.hypot((c[0] - s[0]) / 100 * box.w, (c[1] - s[1]) / 100 * box.h)]).sort((a, b) => a[1] - b[1]);
  }
  const cross = (a, b, c, e) => {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) * o(a, b, e) < 0 && o(c, e, a) * o(c, e, b) < 0;
  };
  const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map((p) => [x].concat(p))));
  let best = null;
  for (const order of perms(zones.map((z) => z.id))) {
    const placed = [], pins = {};
    let cost = 0, okAll = true;
    for (const id of order) {
      const hit = cands[id].find(([c]) => fits(c, placed));
      if (!hit) { okAll = false; break; }
      placed.push(hit[0]); pins[id] = hit[0]; cost += hit[1];
    }
    if (!okAll) continue;
    const ids = Object.keys(pins);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
      if (cross(pins[ids[i]], spots[ids[i]], pins[ids[j]], spots[ids[j]])) cost += 1000;
    if (!best || cost < best.cost) best = { cost, pins };
  }
  if (!best) throw new Error("no room for the pins");
  return best.pins;
}

const out = {};
for (const [name, spec] of Object.entries(MAPS)) {
  const scene = C[name];
  if (!scene) throw new Error("content.js has no " + name);
  const box = scene.box;
  const proj = spec.proj.fitExtent([[PAD, PAD], [box.w - PAD, box.h - PAD]], spec.fit);
  // nothing outside the box is drawn (and so nothing outside it is shipped)
  if (proj.clipExtent) proj.clipExtent([[-2, -2], [box.w + 2, box.h + 2]]);
  const pg = d3.geoPath(proj);
  const spots = {};
  for (const z of scene.zones) {
    const p = proj(z.at);
    if (!p) throw new Error(name + ": " + z.id + " falls outside the projection");
    spots[z.id] = [(p[0] / box.w) * 100, (p[1] / box.h) * 100];
  }
  const pins = placePins(scene.zones, spots, box);
  let svg = '<svg viewBox="0 0 ' + box.w + " " + box.h + '" preserveAspectRatio="none" width="100%" height="100%">';
  for (const [region, fill, geom] of spec.layers) {
    if (geom === "rect") { svg += '<rect data-region="' + region + '" width="' + box.w + '" height="' + box.h + '" fill="' + fill + '"/>'; continue; }
    const dd = pathOf(pg, geom);
    if (!dd) throw new Error(name + ": the " + region + " layer drew nothing");
    svg += '<path data-region="' + region + '" d="' + dd + '" fill="' + fill + '" stroke="' + col.edge + '" stroke-width="0.8" stroke-linejoin="round"/>';
  }
  // the lines from a moved pin to its true spot, and the spot itself
  for (const z of scene.zones) {
    const s = spots[z.id], p = pins[z.id];
    const sx = (s[0] / 100) * box.w, sy = (s[1] / 100) * box.h, px = (p[0] / 100) * box.w, py = (p[1] / 100) * box.h;
    if (Math.hypot(sx - px, sy - py) > 6) svg += '<line x1="' + px.toFixed(1) + '" y1="' + py.toFixed(1) + '" x2="' + sx.toFixed(1) + '" y2="' + sy.toFixed(1) + '" stroke="#1d2b4a" stroke-width="2.5" stroke-linecap="round"/>';
    svg += '<circle cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) + '" r="4" fill="#1d2b4a" stroke="#ffffff" stroke-width="1.5"/>';
  }
  svg += "</svg>";
  out[name] = { svg, pins, spots: Object.fromEntries(Object.entries(spots).map(([k, v]) => [k, [Math.round(v[0] * 100) / 100, Math.round(v[1] * 100) / 100]])) };
  console.log(name.padEnd(18), (svg.length / 1024).toFixed(1) + "KB", Object.entries(pins).map(([k, v]) => k + (Math.hypot((v[0] - spots[k][0]) * box.w, (v[1] - spots[k][1]) * box.h) > 6 ? "→" : "") ).join(" "));
}

const file = "// GENERATED by tools/map-gen.js — do not hand-edit; change the specs there\n" +
  "// or the places in content.js and run it again.\n" +
  "// Outlines: Natural Earth (public domain, naturalearthdata.com), 1:110m,\n" +
  "// 1:50m and 1:10m; projected with d3-geo (ISC, github.com/d3/d3-geo).\n" +
  "// For each map: the SVG, each place's pin (x%, y% of the box) and its true\n" +
  "// spot (x%, y%). A pin that is not on its spot has a line to a dot on it.\n" +
  "(function (global) {\n  const JoshMaps = " + JSON.stringify(out) + ";\n" +
  "  global.JoshMaps = JoshMaps;\n  if (typeof module !== \"undefined\" && module.exports) module.exports = JoshMaps;\n" +
  "})(typeof window !== \"undefined\" ? window : globalThis);\n";
fs.writeFileSync(path.join(ROOT, "scripts/map-shapes.js"), file);
console.log("scripts/map-shapes.js", (file.length / 1024).toFixed(1) + "KB");
