#!/usr/bin/env node
// Fort Josh map search — lanes and pads are SEARCHED against every geometry law,
// never eyeballed.
//
//   node tools/td-map-search.js
//   BAND=2.2 node tools/td-map-search.js      # tighter band, e.g. an endless arena
//
// WHY THIS FILE IS IN THE REPO. Authored coordinates need the same programmatic
// truth-check as authored waves — "the solver wins" never notices a pad the
// PLAYER cannot tap or a tower standing in the road. Every law below is a scar:
//
//   · >= 0.99 cells from EVERY lane   (L5/L8 shipped pads sitting ON the path;
//                                      L10 shipped one 0.50 cells from its
//                                      SECOND lane because only lane 0 was checked)
//   · >= 1.4 cells pairwise           (five pairs shipped in adjacent cells,
//                                      their 0.9-radius tap zones contending)
//   · >= 1.9 cells from a lever       (tap zones again)
//   · <= BAND cells from the lane it must COVER — and on a forked level that is
//     lane 0, the DEFAULT route: a pad hugging only the alternate loop is dead
//     weight until the lever is thrown, and the auto-solver fills pads in array
//     order, so a board full of them starves the route enemies actually walk.
//
// Everything is measured in CELL-INDEX space, matching the engine (a tower
// stores `cx: pad.cx` and its range check is `(enemy.x - t.cx)**2 + ...` against
// posAt, which also returns cell indices) and matching `AUDIT pad geometry`.
// Edit the map literals at the bottom, run, paste the output into td-data.js.
//
// Node-only. Nothing here is loaded by the site.
const G = { w: 24, h: 14 };
const segDist = (p, q, x, y) => {
  const dx = q[0] - p[0], dy = q[1] - p[1], L = dx * dx + dy * dy;
  let t = L ? ((x - p[0]) * dx + (y - p[1]) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (p[0] + t * dx), y - (p[1] + t * dy));
};
// CELL-INDEX space, matching the engine (a tower stores `cx: pad.cx` and its
// range check is `(enemy.x - t.cx)**2 + …` against posAt, which also returns
// cell indices) and matching `AUDIT pad geometry`, which adds +0.5 to BOTH the
// pad and the lane so the offsets cancel.
const laneDist = (lanes, x, y) => Math.min(...lanes.map(p => Math.min(...p.slice(1).map((_, i) => segDist(p[i], p[i + 1], x, y)))));
const pathLen = p => { let t = 0; for (let i = 0; i < p.length - 1; i++) t += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); return Math.round(t); };

// Greedy spread: take valid cells furthest from already-chosen pads, so they
// fan out across the board instead of clumping at one end.
// `lanes` is every lane (clearance is checked against ALL of them — L10 shipped
// a pad 0.50 cells from its SECOND lane for a whole release); `cover` is the
// lane a pad must actually be useful on. On a forked level that is lane 0, the
// DEFAULT route: a pad that only hugs the alternate loop is dead weight until
// you throw the lever, and the auto-solver fills pads in array order, so a
// board full of them starves the route enemies are actually walking.
function placePads(lanes, n, lever, cover) {
  const near0 = cover || lanes[0];
  const cand = [];
  for (let x = 0; x < G.w; x++) for (let y = 0; y < G.h; y++) {
    if (laneDist(lanes, x, y) < 1.05) continue;                       // ≥0.99 law, with margin
    if (lever && Math.hypot(x - lever.cx, y - lever.cy) < 2.0) continue; // ≥1.9 law
    cand.push({ x, y });
  }
  // Every shipped map keeps its pads within 3.0 cells of the lane — a tower in
  // a far corner covers nothing. Hard-cap it, then spread inside that band.
  const near = cand.filter(c => laneDist([near0], c.x, c.y) <= BAND);
  const chosen = [];
  near.sort((a, b) => laneDist([near0], a.x, a.y) - laneDist([near0], b.x, b.y));
  chosen.push(near[0]);
  while (chosen.length < n) {
    let best = null, bd = -1;
    for (const c of near) {
      const d = Math.min(...chosen.map(p => Math.hypot(p.x - c.x, p.y - c.y)));
      if (d < 1.45) continue;                                          // >=1.4 law, with margin
      // spread out, but coverage first: closeness to the lane dominates
      const score = d * 0.5 - laneDist([near0], c.x, c.y) * 1.4;
      if (score > bd) { bd = score; best = c; }
    }
    if (!best) break;
    chosen.push(best);
  }
  return chosen;
}
function validate(name, lanes, pads, lever) {
  const bad = [];
  pads.forEach((p, i) => {
    if (p.x < 0 || p.x >= G.w || p.y < 0 || p.y >= G.h) bad.push(`p${i + 1} out of bounds`);
    const d = laneDist(lanes, p.x, p.y);
    if (d < 0.99) bad.push(`p${i + 1} is ${d.toFixed(2)} from a lane`);
    if (lever && Math.hypot(p.x - lever.cx, p.y - lever.cy) < 1.9) bad.push(`p${i + 1} too near the lever`);
  });
  for (let i = 0; i < pads.length; i++) for (let j = i + 1; j < pads.length; j++) {
    const d = Math.hypot(pads[i].x - pads[j].x, pads[i].y - pads[j].y);
    if (d < 1.4) bad.push(`p${i + 1}/p${j + 1} only ${d.toFixed(2)} apart`);
  }
  const ds = pads.map(p => laneDist([lanes[0]], p.x, p.y)).sort((a, b) => a - b);
  if (ds[ds.length - 1] > BAND + 0.05) bad.push(`a pad sits ${ds[ds.length - 1].toFixed(1)} from the lane (house max ${BAND})`);
  console.log(`${name}: ${pads.length} pads · lanes ${lanes.map(pathLen).join("/")} · lane dist ${ds[0].toFixed(1)}-${ds[ds.length - 1].toFixed(1)} · ${bad.length ? "BAD → " + bad.join("; ") : "OK"}`);
  return bad.length === 0;
}
const emit = pads => "[ " + pads.map((p, i) => `{ id: "p${i + 1}", cx: ${p.x}, cy: ${p.y} }`).join(", ") + " ]";
const BAND = Number(process.env.BAND || 3.0);

// ---- the four Garage maps ----
// L17 Oil Slick — short + dense, a conveyor shoves you along
const L17 = [[0, 3], [17, 3], [17, 9], [5, 9], [5, 12], [23, 12]];
// L18 The Workbench — it teaches the spawner, so it gets the world's longest
// lane (short paths are HARDER, per the TD-4 law). The first cut ran FOUR rows
// only 3-4 cells apart, and a tier-3 dart reaches ~4 — so one tower covered two
// runs at once and the level was flawless at 10 pads on heroic. Rows are 6
// apart now: exposure comes from the walk, not from double coverage.
const L18 = [[0, 12], [17, 12], [17, 6], [4, 6], [4, 0], [23, 0]];
// L19 Two-Car Garage — a fork with an identical shared PREFIX up to the lever,
// so throwing it reroutes in-flight enemies with no teleport. The DEFAULT lane
// is deliberately ~51 (not the 36 the first cut produced): short paths are
// HARDER, and this level's difficulty is meant to come from its routing puzzle.
const L19a = [[0, 6], [8, 6], [8, 1], [19, 1], [19, 7], [13, 7], [13, 12], [23, 12]];
const L19b = [[0, 6], [8, 6], [8, 11], [3, 11], [3, 1], [8, 1], [19, 1], [19, 7], [13, 7], [13, 12], [23, 12]];
const LEVER19 = { cx: 8, cy: 6 };
// L20 The Toolbox Titan — a long approach into a tight final run
const L20 = [[0, 1], [15, 1], [15, 6], [4, 6], [4, 10], [19, 10], [19, 13], [23, 13]];
// The Garage endless arena — a long serpentine, like the other four. Its pads
// sit CLOSE (run with BAND=2.2): an arena starts you poor, so a tier-1 dart
// (short reach) has to be able to touch the lane from wave 1 or the run dies at
// wave 2 — which is exactly what the first cut did.
const ARENA = [[0, 3], [21, 3], [21, 8], [3, 8], [3, 13], [23, 13]];

const out = {};
for (const [name, lanes, n, lever] of [
  ["L17", [L17], 12, null], ["L18", [L18], 12, null],
  ["L19", [L19a, L19b], 15, LEVER19], ["L20", [L20], 14, null],
  ...(process.env.ARENA ? [["ARENA", [ARENA], 14, null]] : []),
]) {
  const pads = placePads(lanes, n, lever);
  const ok = validate(name, lanes, pads, lever);
  if (ok) out[name] = { lanes, pads, lever };
}
console.log("\n---- literals ----");
for (const [k, v] of Object.entries(out)) {
  console.log(`${k} path: ${JSON.stringify(v.lanes[0])}`);
  if (v.lanes[1]) console.log(`${k} alt : ${JSON.stringify(v.lanes[1])}`);
  console.log(`${k} pads: ${emit(v.pads)}\n`);
}
