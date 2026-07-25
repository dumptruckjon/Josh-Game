// Author World 4 (the Attic, L13-L16) the way TD-4 did: generate to the budget
// curve, place pads programmatically against every shipped geometry law, and
// VALIDATE before a byte of td-data.js is touched.
const TD = require("/home/user/Josh-Game/scripts/td-logic.js");
const DATA = require("/home/user/Josh-Game/scripts/td-data.js");
const G = DATA.GRID;

const PATHS = {
  13: [[0,3],[18,3],[18,10],[5,10],[5,6],[23,6]],
  14: [[0,7],[7,7],[7,1],[13,1],[13,10],[4,10],[4,13],[20,13],[20,4],[23,4]],
  15: [[0,11],[4,11],[4,2],[10,2],[10,9],[16,9],[16,2],[21,2],[21,12],[23,12]],
  16: [[0,2],[20,2],[20,7],[4,7],[4,12],[23,12]],
};
const NAMES = { 13: "Dusty Rafters", 14: "Moth Light", 15: "The Old Trunk", 16: "Tickmaster" };
const PADS_WANTED = { 13: 11, 14: 12, 15: 13, 16: 14 };

function dps(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const L2 = vx * vx + vy * vy; let t = L2 ? (wx * vx + wy * vy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}
const clearOf = (cx, cy, wps) => {
  let m = Infinity;
  for (let i = 1; i < wps.length; i++) m = Math.min(m, dps(cx + 0.5, cy + 0.5, wps[i-1][0], wps[i-1][1], wps[i][0], wps[i][1]));
  return m;
};
// Pads: ≥0.99 from the lane, ≥1.4 from each other, and spread ALONG the lane so
// the whole route is coverable (the end-coverage lesson from TD-4).
function placePads(wps, want) {
  const path = TD.buildPath(wps);
  const cand = [];
  for (let x = 0; x < G.w; x++) for (let y = 0; y < G.h; y++) {
    const c = clearOf(x, y, wps);
    if (c < 0.99 || c > 2.6) continue;                      // near the lane, not on it
    let best = Infinity, at = 0;
    for (let d = 0; d <= path.total; d += 0.5) {
      const p = TD.posAt(path, d);
      const dist = Math.hypot(p.x - (x + 0.5), p.y - (y + 0.5));
      if (dist < best) { best = dist; at = d; }
    }
    cand.push({ x, y, at, c });
  }
  cand.sort((a, b) => a.at - b.at);
  const out = [];
  for (const c of cand) {
    if (out.some((o) => Math.hypot(o.cx - c.x, o.cy - c.y) < 1.4)) continue;
    out.push({ id: "p" + (out.length + 1), cx: c.x, cy: c.y, at: c.at });
  }
  // thin evenly along the lane to the wanted count
  if (out.length > want) {
    const step = out.length / want, keep = [];
    for (let i = 0; i < want; i++) keep.push(out[Math.floor(i * step)]);
    return keep.map((p, i) => ({ id: "p" + (i + 1), cx: p.cx, cy: p.cy }));
  }
  return out.map((p, i) => ({ id: "p" + (i + 1), cx: p.cx, cy: p.cy }));
}

// Wave composition: World 4 faces the full roster. 25% of late HP is air (the
// proven anti-mono pressure), and the shapes rotate so no one line coasts.
// Wave composition, calibrated against the shipped worlds: a VANILLA backbone
// carries most of the HP, with at most ONE special shape per wave (capped share)
// plus the air pressure. The first cut let specials stack — a wave of shielded +
// splash-resistant + self-healing enemies has no answer, and the sim showed it:
// L14/L15 were unwinnable at EVERY budget and gold setting.
const VANILLA = ["sock", "marble", "knight", "blob"];
const SPECIAL = ["ghost", "battery", "cushion", "slime", "screw", "mole"];
function waves(id, base, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const target = base * Math.pow(1.18, i + 1);
    const frac = i / (n - 1);
    if (id === 16 && i === n - 1) {
      out.push({ boss: true, groups: [ { type: "tickmaster", count: 1, gap: 2, delay: 0 }, { type: "knight", count: 12, gap: 0.8, delay: 4 }, { type: "hawk", count: 14, gap: 0.35, delay: 6 } ] });
      continue;
    }
    const airShare = frac < 0.4 ? 0 : 0.2;
    const specShare = frac < 0.25 ? 0 : frac < 0.6 ? 0.18 : 0.25;
    const groups = [];
    let left = target * (1 - airShare - specShare);
    const backbone = [VANILLA[i % VANILLA.length], VANILLA[(i + 2) % VANILLA.length]];
    backbone.forEach((t, k) => {
      const share = k === backbone.length - 1 ? left : target * (1 - airShare - specShare) * 0.55;
      const c = Math.max(1, Math.round(share / DATA.ENEMIES[t].hp));
      left -= c * DATA.ENEMIES[t].hp;
      groups.push({ type: t, count: c, gap: +(0.6 + k * 0.15).toFixed(2), delay: k * 3 });
    });
    if (specShare) {
      const t = SPECIAL[i % SPECIAL.length];
      groups.push({ type: t, count: Math.max(1, Math.round(target * specShare / DATA.ENEMIES[t].hp)), gap: 0.9, delay: 4 });
    }
    if (airShare) {
      const air = i % 2 ? "tinplane" : "hawk";
      groups.push({ type: air, count: Math.max(2, Math.round(target * airShare / DATA.ENEMIES[air].hp)), gap: 0.35, delay: 2 });
    }
    out.push({ groups });
  }
  return out;
}
const waveHp = (w) => w.groups.reduce((a, g) => a + (DATA.ENEMIES[g.type] ? DATA.ENEMIES[g.type].hp * g.count : 0), 0);

const SPEC = { 13: { base: 700, gold: 950, n: 14 }, 14: { base: 460, gold: 1100, n: 14 }, 15: { base: 520, gold: 1000, n: 15 }, 16: { base: 600, gold: 1200, n: 15 } };
const levels = [];
for (const id of [13, 14, 15, 16]) {
  const sp = SPEC[id];
  const lv = {
    id, name: NAMES[id], world: "attic", badge: 3,
    startGold: sp.gold, budgetBase: sp.base,
    path: PATHS[id], pads: placePads(PATHS[id], PADS_WANTED[id]), waves: waves(id, sp.base, sp.n),
  };
  levels.push(lv);
}
// ---- VALIDATE before writing anything ----
let bad = [];
for (const l of levels) {
  l.path.forEach(([x, y]) => { if (x < 0 || x > G.w - 1 || y < 0 || y > G.h - 1) bad.push(`L${l.id} path out of bounds`); });
  if (l.pads.length < 9) bad.push(`L${l.id} only ${l.pads.length} pads`);
  l.pads.forEach((p) => {
    if (clearOf(p.cx, p.cy, l.path) < 0.99) bad.push(`L${l.id} ${p.id} on the lane`);
    l.pads.forEach((q) => { if (p !== q && Math.hypot(p.cx - q.cx, p.cy - q.cy) < 1.4) bad.push(`L${l.id} ${p.id}/${q.id} too close`); });
  });
  l.waves.forEach((w, i) => {
    if (w.boss) return;
    const t = l.budgetBase * Math.pow(1.18, i + 1), hp = waveHp(w);
    if (!(hp >= t * 0.75 && hp <= t * 1.25)) bad.push(`L${l.id} w${i+1} ${hp} outside ${Math.round(t*0.75)}-${Math.round(t*1.25)}`);
  });
}
console.log(bad.length ? "VALIDATION FAILURES:\n  " + bad.slice(0, 12).join("\n  ") : "validation ok");
levels.forEach((l) => console.log(`L${l.id} ${l.name.padEnd(15)} pads ${String(l.pads.length).padStart(2)} waves ${l.waves.length} hp ${l.waves.reduce((a,w)=>a+waveHp(w),0)}`));
require("fs").writeFileSync("/tmp/claude-0/-home-user-Josh-Game/881f4676-c717-5343-8764-48b71519bc4b/scratchpad/w4.json", JSON.stringify(levels, null, 1));
