#!/usr/bin/env node
// Fort Josh FORK search — which shipped maps admit a second lane WITHOUT moving
// a single pad?
//
//   node tools/td-fork-search.js              # every level that has no fork yet
//   node tools/td-fork-search.js 13,14,21     # just those
//   MIN_GAIN=1.30 node tools/td-fork-search.js
//
// WHY THIS FILE IS IN THE REPO. TD-11 answered this question with a SCRATCH
// generator that was then thrown away, and CLAUDE.md has carried "re-run the
// generator over the maps authored since" as an open item ever since — an
// instruction nobody could act on, because the generator was gone. Same reason
// td-sim.js and td-map-search.js live here: the method has to outlive the phase
// that invented it.
//
// A fork is a DEFAULT-NOOP retrofit — lane 0 stays byte-identical, so every
// winnability sim (none of which pulls the lever) is untouched and the level
// needs no re-tune. That is only true if the candidate clears every law the
// shipped guardrails enforce, so this tool checks exactly those, in the same
// CELL-INDEX space the engine targets in:
//
//   · lane 0 IS the original `path`                    (TD-11 default-noop)
//   · the lanes COINCIDE up to fork.at and DIVERGE after
//        — this is what lets a thrown lever reroute in-flight enemies with no
//          teleport, so the detour must branch off a point that lies exactly ON
//          the original polyline
//   · the long route is >= 1.15x                       (or the lever buys nothing)
//   · every pad is >= 0.99 cells from BOTH lanes       (L10 shipped one 0.50
//                                                       from its second lane
//                                                       because only lane 0 was
//                                                       ever checked)
//   · every pad is >= 1.9 cells from the lever          (contending tap zones)
//   · the detour stays in bounds and does not run back along the default lane
//
// The shape searched is the one BOTH shipped forks use: leave the default at a
// lattice point D, bulge perpendicular by `depth`, run parallel, and rejoin the
// same segment at R. Added length is 2*depth, so depth is the whole knob — on a
// 46-cell lane you need depth >= 4 to clear 1.15x.
//
// Node-only. Nothing here is loaded by the site.
const path = require("path");
const DATA = require(path.join(__dirname, "..", "scripts/td-data.js"));

const G = { w: 24, h: 14 };
const MIN_GAIN = Number(process.env.MIN_GAIN || 1.2);   // margin over the 1.15 guardrail
// A fork at distance ~0 is legal but pointless: the lever sits on the spawn tile
// and there is no shared prefix, so the "reroute in-flight enemies with no
// teleport" invariant it exists to serve has nothing to act on.
const MIN_PREFIX = Number(process.env.MIN_PREFIX || 8);
const inBounds = (p) => p[0] >= 0 && p[0] < G.w && p[1] >= 0 && p[1] < G.h;
const len = (p) => { let t = 0; for (let i = 1; i < p.length; i++) t += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return t; };

const segDist = (a, b, x, y) => {
  const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy;
  let t = L2 ? ((x - a[0]) * vx + (y - a[1]) * vy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (a[0] + vx * t), y - (a[1] + vy * t));
};
const laneDist = (lane, x, y) => Math.min(...lane.slice(1).map((_, i) => segDist(lane[i], lane[i + 1], x, y)));

// Walk a polyline to a distance — the engine's posAt, so "do the lanes
// coincide?" is answered the way the guardrail asks it.
function posAt(lane, d) {
  let acc = 0;
  for (let i = 1; i < lane.length; i++) {
    const L = Math.hypot(lane[i][0] - lane[i - 1][0], lane[i][1] - lane[i - 1][1]);
    if (acc + L >= d) { const t = L ? (d - acc) / L : 0; return { x: lane[i - 1][0] + (lane[i][0] - lane[i - 1][0]) * t, y: lane[i - 1][1] + (lane[i][1] - lane[i - 1][1]) * t }; }
    acc += L;
  }
  const e = lane[lane.length - 1];
  return { x: e[0], y: e[1] };
}

// Build the alternate lane: leave `def` at D (a lattice point on segment i),
// bulge `k` cells to the `sx/sy` side, run parallel, rejoin at R on the SAME
// segment. Returns null when the shape is degenerate.
function buildAlt(def, i, a, b, k, sx, sy) {
  const V = def[i], W = def[i + 1];
  const ux = Math.sign(W[0] - V[0]), uy = Math.sign(W[1] - V[1]);
  const D = [V[0] + ux * a, V[1] + uy * a];
  const R = [V[0] + ux * b, V[1] + uy * b];
  const out = [D[0] + sx * k, D[1] + sy * k], back = [R[0] + sx * k, R[1] + sy * k];
  if (![D, R, out, back].every(inBounds)) return null;
  // Shape sanity: the two perpendicular legs are (b - a) apart, so a 1-cell
  // rejoin is a HAIRPIN — legal as a polyline, unreadable as a lane, and it
  // renders as one smeared double ribbon. Both shipped forks are proper
  // rectangles (L3 runs 6 cells across an 8-deep bulge).
  if (b - a < 3 || k < 3) return null;
  const head = def.slice(0, i + 1);
  if (a === 0) head.pop();                       // D is the vertex itself — don't duplicate it
  const tail = def.slice(i + 1);
  const alt = [...head, D, out, back, R, ...tail];
  // strip a duplicated R when the rejoin IS the segment's end vertex
  return { alt: alt.filter((p, n) => n === 0 || p[0] !== alt[n - 1][0] || p[1] !== alt[n - 1][1]), D, R, legs: [D, out, back, R] };
}

// The detour must not crawl back along the default lane — it would render as one
// smeared ribbon and "which route is live?" would be unreadable. Only the THREE
// detour legs are examined (outside them the two lanes are literally the same
// polyline, so distance 0 is correct and comparing them is meaningless — an
// earlier cut compared the two lanes at equal DISTANCE, which stops corresponding
// the moment they diverge, and passed a detour whose return leg lay exactly on
// the default's final segment). Samples within 1.2 of the branch/rejoin points
// are exempt: they are on the default lane by construction.
function detourIsClear(def, legs, D, R) {
  for (let s = 1; s < legs.length; s++) {
    const [ax, ay] = legs[s - 1], [bx, by] = legs[s];
    const L = Math.hypot(bx - ax, by - ay);
    for (let t = 0; t <= L; t += 0.25) {
      const x = ax + (bx - ax) * (t / L), y = ay + (by - ay) * (t / L);
      if (Math.hypot(x - D[0], y - D[1]) <= 1.2 || Math.hypot(x - R[0], y - R[1]) <= 1.2) continue;
      if (laneDist(def, x, y) < 1.0) return false;
    }
  }
  return true;
}

// Exactly the guardrails' checks, so anything this prints is shippable.
function check(level, def, alt, D, R, legs) {
  const forkAt = (() => { let t = 0; for (let i = 1; i < alt.length; i++) { const [px, py] = alt[i - 1]; if (px === D[0] && py === D[1]) return t; t += Math.hypot(alt[i][0] - px, alt[i][1] - py); } return t; })();
  for (let d = 0; d <= forkAt; d += 0.25) {
    const A = posAt(def, d), B = posAt(alt, d);
    if (Math.hypot(A.x - B.x, A.y - B.y) > 0.01) return { ok: false, why: `lanes diverge early (at ${d})` };
  }
  const A = posAt(def, forkAt + 1), B = posAt(alt, forkAt + 1);
  if (Math.hypot(A.x - B.x, A.y - B.y) <= 0.5) return { ok: false, why: "lanes do not actually split" };
  if (forkAt < MIN_PREFIX) return { ok: false, why: `fork at ${forkAt} — no real shared prefix` };
  const gain = len(alt) / len(def);
  if (gain < MIN_GAIN) return { ok: false, why: `only ${gain.toFixed(2)}x longer` };
  for (const pad of level.pads) {
    const dl = laneDist(alt, pad.cx, pad.cy);
    if (dl < 0.99) return { ok: false, why: `pad ${pad.id} sits ${dl.toFixed(2)} from the new lane` };
    if (Math.hypot(pad.cx - D[0], pad.cy - D[1]) < 1.9) return { ok: false, why: `pad ${pad.id} crowds the lever` };
  }
  if (!detourIsClear(def, legs, D, R)) return { ok: false, why: "the detour runs back along the default lane" };
  return { ok: true, forkAt: Math.round(forkAt), gain };
}

const only = process.argv[2] ? process.argv[2].split(",").map(Number) : null;
// RESEARCH=1 re-searches a level that ALREADY has a fork. Needed because a fork
// can be legal and still be WORTHLESS: L3's shipped detour branches 76% of the
// way down its own lane, so the sim measured its lever at a gain of 0.0 lives at
// every board size — there is no board left downstream to exploit. Legality was
// checked; VALUE never was. Since lane 0 is untouched by a re-fork, swapping the
// second lane is still a default-noop and needs no re-tune.
const RESEARCH = !!process.env.RESEARCH;
const targets = DATA.LEVELS.filter((l) => (RESEARCH || !l.fork) && (!only || only.includes(l.id)));
console.log(`searching ${targets.length} level(s) · min gain ${MIN_GAIN}x${RESEARCH ? " · RE-searching forked maps" : ""}\n`);

const hits = {};
for (const level of targets) {
  const def = level.path || level.paths[0];
  const found = [];
  for (let i = 0; i < def.length - 1; i++) {
    const segLen = Math.round(Math.hypot(def[i + 1][0] - def[i][0], def[i + 1][1] - def[i][1]));
    const horiz = def[i][1] === def[i + 1][1];
    for (let a = 0; a < segLen; a++) for (let b = a + 1; b <= segLen; b++) {
      for (const [sx, sy] of horiz ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]]) {
        for (let k = 2; k <= 12; k++) {
          const V = def[i], ux = Math.sign(def[i + 1][0] - V[0]), uy = Math.sign(def[i + 1][1] - V[1]);
          const D = [V[0] + ux * a, V[1] + uy * a];
          const built = buildAlt(def, i, a, b, k, sx, sy);
          if (!built) continue;
          const r = check(level, def, built.alt, D, built.R, built.legs);
          if (r.ok) found.push({ alt: built.alt, D, ...r });
        }
      }
    }
  }
  // Prefer the LONGEST detour that still clears every law — the lever's whole
  // payoff is extra exposure for the tail towers.
  found.sort((x, y) => y.gain - x.gain);
  if (!found.length) { console.log(`L${String(level.id).padStart(2)} ${level.name.padEnd(22)} — no fork without moving pads`); continue; }
  const best = found[0];
  console.log(`L${String(level.id).padStart(2)} ${level.name.padEnd(22)} ✅ ${found.length} candidate(s) · best ${best.gain.toFixed(2)}x · lever (${best.D[0]},${best.D[1]}) · fork.at ${best.forkAt}`);
  // TOP=n prints the runners-up too: max gain is not always the nicest SHAPE,
  // and a lever's position on the board is a design choice, not just a number.
  for (const c of found.slice(1, Number(process.env.TOP || 1))) {
    console.log(`      alt: ${c.gain.toFixed(2)}x · lever (${c.D[0]},${c.D[1]}) · fork.at ${c.forkAt} · ${JSON.stringify(c.alt)}`);
  }
  hits[level.id] = best;
}

if (Object.keys(hits).length) {
  console.log("\n---- literals ----");
  for (const [id, h] of Object.entries(hits)) {
    const level = DATA.LEVELS.find((l) => l.id === Number(id));
    console.log(`L${id}:`);
    console.log(`      paths: [\n        ${JSON.stringify(level.path || level.paths[0])},\n        ${JSON.stringify(h.alt)},\n      ],`);
    console.log(`      fork: { at: ${h.forkAt} },`);
    console.log(`      lever: { cx: ${h.D[0]}, cy: ${h.D[1]} },\n`);
  }
}
