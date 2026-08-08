#!/usr/bin/env node
// Fort Josh balance harness — measure any level with the SHIPPED oracle.
//
//   node tools/td-sim.js                 # every level, normal + heroic
//   node tools/td-sim.js 13,17           # just those levels
//   SEEDS=1,2,3,4,5,6 node tools/td-sim.js 20
//   DIFFS=normal,heroic,casual node tools/td-sim.js
//
// WHY THIS FILE IS IN THE REPO. Every balance claim in CLAUDE.md and the
// PLAN_*.md files was produced by a harness exactly like this one, and the
// single most expensive mistake this project made was tuning against a solver
// STRONGER than the one in the test suite (World 4 was built, passed a local
// sim, failed `PLAYABILITY`, and had to be reverted). So the oracle below is
// copied verbatim from `tests/td-logic.test.js` — fill pads in array order as
// gold allows, upgrade cheapest-tier-first, never buy a tier-4 branch, take the
// better of a dart-swarm and a fixed mixed plan. If you change one, change both.
//
// Node-only. Nothing here is loaded by the site.
const path = require("path");
const ROOT = path.join(__dirname, "..");
const TD = require(path.join(ROOT, "scripts/td-logic.js"));
const DATA = require(path.join(ROOT, "scripts/td-data.js"));

const cost = (line, tier) => DATA.TOWERS[line].tiers[tier].cost;

function playWith(level, seed, plan, difficulty) {
  const e = TD.createEngine(level, { seed, difficulty });
  const padIds = level.pads.map((p) => p.id);
  let idx = 0, guard = 0;
  const livesAtWave = [];
  while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 900000) {
    if (e.state.phase === "build") {
      let spent = true;
      while (spent) {
        spent = false;
        for (const pid of padIds) {
          if (!e.state.towers.find((t) => t.padId === pid)) {
            const line = plan[idx % plan.length];
            if (e.state.gold >= cost(line, 0)) { if (e.place(line, pid).ok) { idx++; spent = true; } }
            break;
          }
        }
        if (spent) continue;
        const ups = e.state.towers.filter((t) => t.tier < 3).sort((a, b) => a.tier - b.tier);
        for (const t of ups) { if (e.state.gold >= cost(t.lineId, t.tier)) { if (e.upgrade(t.id).ok) spent = true; break; } }
      }
      livesAtWave.push(e.state.lives);
      e.callWave();
    }
    e.tick();
  }
  return { phase: e.state.phase, lives: e.state.lives, livesAtWave };
}

const DART = ["dart"];
const MIXED = ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"];

// "Winnable" means EITHER sensible build clears it — a competent player picks
// the tool for the level, and the roster deliberately splits the two plans.
function best(level, seed, difficulty) {
  const a = playWith(level, seed, DART, difficulty), b = playWith(level, seed, MIXED, difficulty);
  if (a.phase === "won" && b.phase === "won") return a.lives >= b.lives ? a : b;
  return a.phase === "won" ? a : b.phase === "won" ? b : a;
}
function neglect(level, seed, meta) {
  const e = TD.createEngine(level, { seed, meta });
  let g = 0;
  while (e.state.phase !== "won" && e.state.phase !== "lost" && g++ < 400000) { if (e.state.phase === "build") e.callWave(); e.tick(); }
  return e.state.phase;
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

const SEEDS = (process.env.SEEDS || "7,23,99,404").split(",").map(Number);
const DIFFS = (process.env.DIFFS || "normal,heroic").split(",");
// argv[2] is the level list ONLY when it actually looks like one — otherwise
// `node tools/td-sim.js --priority` parses the FLAG as levels, yields [NaN] and
// silently selects nothing. (It did; that is why this guard exists.)
const only = /^[0-9]+(,[0-9]+)*$/.test(process.argv[2] || "") ? process.argv[2].split(",").map(Number) : null;
const ALL_META = DATA.META_NODES.map((n) => n.id);

// ---- --priority: a DECISION-AWARE oracle, and why one has to exist ----
//
//   node tools/td-sim.js 17,34,36 --priority
//   node tools/td-sim.js 17 --priority --focus drum
//
// 🛢️ Oil Drum shipped OUTCOME-NEUTRAL on the shipped oracle, and the recorded
// reason is not that the mechanic is weak — it is that the auto-solver has no
// positional agency. It builds, it fires, and it can never CHOOSE to break a
// drum early. A sock crossing the slick really does cover 1.45x the ground and
// no gate we own can see it. Every future "changes a decision, not a number"
// enemy has the same problem, so the instrument has to come before the content.
//
// The player this models spends 📌 Call the Shot on the body that matters. 📌 is
// the right lever because `markId` already overrides every targeting mode
// through the ONE `pickByMode` plus the dart's sticky-KEEP, so "a player who
// prioritises" needs no new engine support. It pays 📌's real price — 70 gold,
// 2 ⚙️, a 24s cooldown, wave-only — so it cannot out-earn the blind oracle for
// free.
//
// THE CONTROL ARM IS THE WHOLE POINT. Marking at all converts idle mid-wave gold
// into focused DPS, which is a RESOURCE effect, not a decision. So there are
// three arms and the answer is the difference between the last two:
//
//   blind   — never marks (the shipped oracle, unchanged)
//   spend   — marks the FIRST living body it can reach: same gold, same
//             cooldown, no discrimination
//   focus   — marks the body the mechanic is about
//
//   decision worth  =  focus - spend        (NOT focus - blind)
//
// Without the control, any mechanic would "measure positive" purely because the
// arm that uses a power beats the arm that does not.
const MARK = "mark";
function playSmart(level, seed, plan, difficulty, mode, focusTypes) {
  const e = TD.createEngine(level, { seed, difficulty });
  const padIds = level.pads.map((p) => p.id);
  let idx = 0, guard = 0, marks = 0;
  const want = new Set(focusTypes || []);
  const tryMark = () => {
    if (mode === "blind") return;
    if (e.state.phase !== "wave") return;                 // 📌 is wave-only
    if (!e.abilityReady(MARK).ok) return;
    // A COMPETENT player marks something a gun can actually shoot. Marking the
    // first matching body in state order happily picks one no tower can reach —
    // the mark then expires before it arrives and the arm measures nothing.
    // (Verified separately: `markId` only overrides among in-range candidates,
    // which is correct engine behaviour, so an out-of-range mark is a no-op.)
    const reach = (en) => {
      const p = e.posOn(en.pathIdx || 0, en.dist);
      return e.state.towers.some((t) => {
        if (t.lineId === "camp") return false;
        const def = DATA.TOWERS[t.lineId];
        const s = (t.tier === 4 && t.branch) ? def.branches[t.branch] : def.tiers[t.tier - 1];
        return s && Math.hypot(p.x - t.cx, p.y - t.cy) <= (s.range || 0);
      });
    };
    let pick = null;
    for (const en of e.state.enemies) {
      if (!en.alive || e.isHidden(en)) continue;
      if (mode === "focus" && !want.has(en.type)) continue;
      if (!reach(en)) continue;
      pick = en; break;
    }
    if (!pick) return;
    const p = e.posOn(pick.pathIdx || 0, pick.dist);
    const gold0 = e.state.gold, charge0 = e.state.charge;
    if (e.useAbility(MARK, { x: p.x, y: p.y }).ok) {
      marks += 1;
      // FREE=1 refunds the price so the DECISION can be measured apart from what
      // it COSTS. This is not a playable run and is not a balance claim — it is
      // the only way to separate "prioritising does not matter" from "this
      // oracle can never afford to prioritise". It matters because the priced
      // arm scored NEGATIVE even on the Junk Healer, the textbook focus target:
      // the solver builds greedily to exhaustion every build phase, so its
      // marginal 70 gold is always worth more as a tower than as a mark.
      if (process.env.FREE) { e.state.gold = gold0; e.state.charge = charge0; }
    }
  };
  while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 900000) {
    if (e.state.phase === "build") {
      let spent = true;
      while (spent) {
        spent = false;
        for (const pid of padIds) {
          if (!e.state.towers.find((t) => t.padId === pid)) {
            const line = plan[idx % plan.length];
            if (e.state.gold >= cost(line, 0)) { if (e.place(line, pid).ok) { idx++; spent = true; } }
            break;
          }
        }
        if (spent) continue;
        const ups = e.state.towers.filter((t) => t.tier < 3).sort((a, b) => a.tier - b.tier);
        for (const t of ups) { if (e.state.gold >= cost(t.lineId, t.tier)) { if (e.upgrade(t.id).ok) spent = true; break; } }
      }
      e.callWave();
    }
    e.tick();
    tryMark();
  }
  return { phase: e.state.phase, lives: e.state.lives, marks };
}
const bestSmart = (level, seed, difficulty, mode, focusTypes) => {
  const a = playSmart(level, seed, DART, difficulty, mode, focusTypes);
  const b = playSmart(level, seed, MIXED, difficulty, mode, focusTypes);
  if (a.phase === "won" && b.phase === "won") return a.lives >= b.lives ? a : b;
  return a.phase === "won" ? a : b.phase === "won" ? b : a;
};

if (process.argv.includes("--priority")) {
  const fi = process.argv.indexOf("--focus");
  const focus = fi >= 0 && process.argv[fi + 1] ? process.argv[fi + 1].split(",") : ["drum"];
  const levels = only ? DATA.LEVELS.filter((l) => only.includes(l.id))
    : DATA.LEVELS.filter((l) => l.waves.some((w) => w.groups.some((g) => focus.includes(g.type))));
  console.log(`DECISION-AWARE oracle — focusing [${focus.join(",")}] · seeds ${SEEDS.join(",")}`);
  console.log("decision worth = focus - spend (the spend arm marks indiscriminately, so it nets out the resource effect)\n");
  for (const diff of DIFFS) {
    console.log(`--- ${diff} ---`);
    let sumGap = 0, n = 0;
    for (const l of levels) {
      const row = {};
      for (const mode of ["blind", "spend", "focus"]) {
        const rs = SEEDS.map((s) => bestSmart(l, s, diff, mode, focus));
        row[mode] = rs.map((r) => (r.phase === "won" ? r.lives : -1));
        row[mode + "M"] = rs.reduce((a, r) => a + r.marks, 0);
      }
      const avg = (v) => v.reduce((a, b) => a + b, 0) / v.length;
      // BOTH gaps, and the verdict is the FIRST one. Reporting only focus-spend
      // is how this tool lied on its first run: the spend arm is not neutral, it
      // is actively HARMFUL on heroic (56 indiscriminate marks divert ~4000 gold
      // from building), so `focus - spend` read +2.00 while `focus - blind` was
      // exactly 0.00 — the focus arm had merely returned to baseline. A control
      // that costs something only nets out the resource effect if you also check
      // the arm that spends nothing.
      const vsBlind = avg(row.focus) - avg(row.blind);
      const vsSpend = avg(row.focus) - avg(row.spend);
      sumGap += vsBlind; n += 1;
      console.log(`L${String(l.id).padStart(2)} ${l.name.slice(0, 16).padEnd(17)} ` +
        `blind ${avg(row.blind).toFixed(1)}  spend ${avg(row.spend).toFixed(1)} (${row.spendM} marks)  ` +
        `focus ${avg(row.focus).toFixed(1)} (${row.focusM} marks)   ` +
        `vs-blind ${vsBlind >= 0 ? "+" : ""}${vsBlind.toFixed(2)}   vs-spend ${vsSpend >= 0 ? "+" : ""}${vsSpend.toFixed(2)}`);
    }
    if (n) console.log(`    DECISION WORTH (focus - blind): ${(sumGap / n >= 0 ? "+" : "")}${(sumGap / n).toFixed(2)} lives\n`);
  }
  process.exit(0);
}

// ---- --lever: what is a fork's lever actually WORTH? ----
//
//   node tools/td-sim.js 15,23 --lever
//
// A full board kills everything on either route, so the lever is unmeasurable at
// full strength — its value shows up on a THIN build, exactly as the shipped
// `TD7 lever advantage` guardrail defines it: a build that LOSES on the short
// route and WINS with the lever thrown. That is the knife edge, and it is the
// right way to CHOOSE between fork candidates: L23's longest candidate (1.46x)
// left a thin build losing on both routes, while the shorter one (1.42x) rescued
// a 7-, 8- OR 9-pad build on every seed. Longest != best.
//
// Pair it with tools/td-fork-search.js, which finds candidates that need no pad
// moved; this says which of them is worth shipping.
function playCapped(level, seed, plan, pull, cap) {
  const e = TD.createEngine(level, { seed, difficulty: "normal" });
  const padIds = level.pads.map((p) => p.id).slice(0, cap);
  let idx = 0, guard = 0;
  while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 900000) {
    if (e.state.phase === "build") {
      let spent = true;
      while (spent) {
        spent = false;
        for (const pid of padIds) {
          if (!e.state.towers.find((t) => t.padId === pid)) {
            const line = plan[idx % plan.length];
            if (e.state.gold >= cost(line, 0) && e.place(line, pid).ok) { idx++; spent = true; }
            break;
          }
        }
        if (spent) continue;
        const ups = e.state.towers.filter((t) => t.tier < 3).sort((a, b) => a.tier - b.tier);
        for (const t of ups) if (e.state.gold >= cost(t.lineId, t.tier)) { if (e.upgrade(t.id).ok) spent = true; break; }
      }
      e.callWave();
    }
    // keep the long route thrown — pullLever has a cooldown, so just retry
    if (pull && e.state.leverRoute !== 1) e.pullLever();
    e.tick();
  }
  return e.state.phase === "won" ? e.state.lives : null;
}
if (process.argv.includes("--lever")) {
  for (const lvl of DATA.LEVELS.filter((l) => l.fork && (!only || only.includes(l.id)))) {
    console.log(`\nL${lvl.id} ${lvl.name}  (${lvl.pads.length} pads)`);
    for (const cap of [6, 7, 8, 9, 10, 11]) {
      const row = [];
      for (const [name, plan] of [["dart", DART], ["mixed", MIXED]]) {
        const off = SEEDS.map((s) => playCapped(lvl, s, plan, false, cap));
        const on = SEEDS.map((s) => playCapped(lvl, s, plan, true, cap));
        const w = (r) => r.filter((x) => x !== null).length;
        row.push(`${name} short ${w(off)}/${SEEDS.length} → LONG ${w(on)}/${SEEDS.length}`);
      }
      console.log(`   cap ${String(cap).padStart(2)}  ${row.join("   |   ")}`);
    }
  }
  process.exit(0);
}

// ---- --boss: sweep a finale's boss hp x leak toll, looking for SPREAD ----
//
//   node tools/td-sim.js 8 --boss
//   BOSS_HP=5200,6400,7600 BOSS_TOLL=4,6,8 node tools/td-sim.js 8 --boss
//
// A finale is QUANTIZED when its level leaks nothing before the boss wave: the
// whole run then reduces to "does the boss die?", one leak is worth its entire
// toll, and the outcome can only land on a few values. The tell is not a bad
// median — it is ZERO VARIANCE. L8 measured heroic 10 on all 8 seeds.
//
// So this prints the SPREAD (min..max) as well as the median, because a sweep
// judged on medians alone will happily pick a setting that is perfectly flat.
// It mutates DATA in-process rather than editing the data file between runs, so
// every row goes through the same shipped `best()`.
if (process.argv.includes("--boss")) {
  const HPS = (process.env.BOSS_HP || "").split(",").filter(Boolean).map(Number);
  const TOLLS = (process.env.BOSS_TOLL || "").split(",").filter(Boolean).map(Number);
  for (const lvl of DATA.LEVELS.filter((l) => !only || only.includes(l.id))) {
    const finale = lvl.waves[lvl.waves.length - 1];
    const key = (finale.groups || []).map((g) => g.type).find((t) => DATA.ENEMIES[t] && DATA.ENEMIES[t].boss);
    if (!key) { console.log(`L${lvl.id} ${lvl.name}: no boss finale`); continue; }
    const def = DATA.ENEMIES[key], hp0 = def.hp, toll0 = def.lives;
    console.log(`\nL${lvl.id} ${lvl.name} — ${def.name} (shipped hp ${hp0}, toll ${toll0})`);
    for (const hp of (HPS.length ? HPS : [hp0])) {
      for (const toll of (TOLLS.length ? TOLLS : [toll0])) {
        def.hp = hp; def.lives = toll;
        const cols = [];
        for (const d of DIFFS) {
          const r = SEEDS.map((s) => best(lvl, s, d));
          const w = r.filter((x) => x.phase === "won").map((x) => x.lives);
          const lost = r.length - w.length;
          cols.push(w.length
            ? `${d} ${w.join(",")} med ${median(w)} spread ${Math.min(...w)}..${Math.max(...w)}${lost ? ` LOST x${lost}` : ""}`
            : `${d} LOST on every seed`);
        }
        console.log(`   hp=${String(hp).padStart(5)} toll=${toll} | ${cols.join(" | ")}`);
      }
    }
    def.hp = hp0; def.lives = toll0;
  }
  process.exit(0);
}

// ---- --swap: the BACKBONE STAT-SHAPE lever, at ~0% budget drift ----
//
//   node tools/td-sim.js 23 --swap
//   SWAP_FROM=2 SWAP_TO=3 SWAP_AT=0.5 node tools/td-sim.js 23,30,31 --swap
//
// Every world's ground backbone is the SAME four shapes wearing local names:
// slot 0 a 34hp/0.8 body, slot 1 the 90hp/0.6 armored Knight, slot 2 the 60hp/0.7
// splitter Blob, slot 3 a 16hp/1.7 swarm body. Substituting one slot for another
// and rescaling the count to preserve HP changes what a wave IS — how many
// bodies, how fast, whether armor matters — while leaving the ±25% budget curve
// it was authored against essentially untouched. That is the one lever left for a
// level that measures as a formality, because bigger HP piles are documented not
// to work anywhere in this engine.
//
// PLAN_EXPANSION.md §8 records this as a real and LARGE lever *and a cliff*, and
// marks its own numbers [unverified] — which is why it lives here rather than in
// a scratch file. It prints the whole per-seed row, and the drift it actually
// caused, so a swap can never be adopted on a median alone.
if (process.argv.includes("--swap")) {
  const FROM = Number(process.env.SWAP_FROM || 0), TO = Number(process.env.SWAP_TO || 3);
  const AT = Number(process.env.SWAP_AT || 0.5);          // swap waves from this fraction on
  for (const lvl of DATA.LEVELS.filter((l) => !only || only.includes(l.id))) {
    const bb = (DATA.WORLDS[lvl.world] || {}).backbone;
    if (!bb) { console.log(`L${lvl.id}: no world backbone`); continue; }
    const from = bb.ground[FROM], to = bb.ground[TO];
    const first = Math.ceil(lvl.waves.length * AT);
    // HP-PRESERVING substitution, rebuilt as a fresh level object so DATA is untouched
    let moved = 0, drift = 0, total = 0;
    const waves = lvl.waves.map((w, i) => {
      total += w.groups.reduce((s, g) => s + DATA.ENEMIES[g.type].hp * g.count, 0);
      if (i < first || w.boss) return w;
      return Object.assign({}, w, { groups: w.groups.map((g) => {
        if (g.type !== from) return g;
        const hp = DATA.ENEMIES[from].hp * g.count;
        const n = Math.max(1, Math.round(hp / DATA.ENEMIES[to].hp));
        moved++; drift += DATA.ENEMIES[to].hp * n - hp;
        return Object.assign({}, g, { type: to, count: n });
      }) });
    });
    const swapped = Object.assign({}, lvl, { waves });
    console.log(`\nL${lvl.id} ${lvl.name} — ${from} → ${to} from wave ${first + 1} on ` +
      `(${moved} groups, budget drift ${(100 * drift / total).toFixed(2)}%)`);
    if (!moved) { console.log("   (nothing to swap — that slot does not appear in those waves)"); continue; }
    for (const [label, target] of [["BEFORE", lvl], ["AFTER ", swapped]]) {
      const cols = [];
      for (const d of DIFFS) {
        const r = SEEDS.map((s) => best(target, s, d));
        const w = r.filter((x) => x.phase === "won").map((x) => x.lives);
        const lost = r.length - w.length;
        cols.push(w.length ? `${d} ${w.join(",")} med ${median(w)}${lost ? ` LOST x${lost}` : ""}` : `${d} LOST on every seed`);
      }
      console.log(`   ${label} | ${cols.join(" | ")}`);
    }
  }
  process.exit(0);
}

// ---- --branch: what is a TIER-4 BRANCH actually worth? ----
//
//   node tools/td-sim.js 12,20 --branch
//   CAP=3 node tools/td-sim.js 20 --branch          # convert up to 3 of the line
//   CAP=99 DIFFS=heroic node tools/td-sim.js 16 --branch
//
// DIAGNOSTIC ONLY. This is deliberately a STRONGER solver than the shipped
// oracle — it is the same fill and upgrade loop plus a third step — and this
// project has already reverted a whole world for tuning against one of those.
// Precedent for a stronger solver as a diagnostic exists (the Full Fort
// reachability measurement) and the rule attached to it is the rule here: read
// it, never tune to it. `best()` and PLAYABILITY stay exactly as they are.
//
// It exists because NOTHING could answer "what is a branch worth". Both oracle
// plans fill and upgrade with `t.tier < 3`, so neither has ever called
// `branch()` — which is how Sticky Bomb shipped for months promising goo it
// never left, and how 🎯 Rust Ray and 🧊 Tail Wind shipped with no measurement
// of their effect on a level at all.
//
// FOUR FIXTURE BUGS were hit building the scratch version of this, every one of
// which reported "the branch is worth nothing" on a working engine. They are
// designed out here, and each is worth reading before editing:
//
//  1. AN ALL-IN ARM IS THE MORTAR-MONO SHAPE. Converting every dart to a Rust
//     Ray deletes the board's damage and measures the absence of a tier-3 line,
//     not the presence of a branch. A support or debuff branch is inherently a
//     few-of choice, so `CAP` (default 1) is how many get converted, and the
//     all-in arm is available but has to be asked for.
//  2. SPEND THE BUDGET ON A SUCCESS, NEVER AN ATTEMPT. An early try at 90 gold
//     against a 300-gold branch used to consume the one allowed conversion, and
//     it was never retried.
//  3. CHECK ELIGIBILITY BEFORE SPENDING IT. Asking the picker about a tier-1
//     tower burned the budget before the tower could possibly be branched.
//  4. PRINT `bought`. Every one of the above presents as every arm reading
//     identical to the control, which is indistinguishable from a real null —
//     so the count of purchases is part of the output, not a debug aid.
//
// Branches are bought ONLY from surplus, after every pad is filled and every
// tower is tier 3, so placement is never starved. That is what makes this a
// strict superset of the oracle rather than a different player.
function playBranch(level, seed, plan, difficulty, want) {
  const e = TD.createEngine(level, { seed, difficulty });
  const padIds = level.pads.map((p) => p.id);
  let idx = 0, guard = 0, bought = 0;
  while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 900000) {
    if (e.state.phase === "build") {
      let spent = true;
      while (spent) {
        spent = false;
        for (const pid of padIds) {
          if (!e.state.towers.find((t) => t.padId === pid)) {
            const line = plan[idx % plan.length];
            if (e.state.gold >= cost(line, 0)) { if (e.place(line, pid).ok) { idx++; spent = true; } }
            break;
          }
        }
        if (spent) continue;
        const ups = e.state.towers.filter((t) => t.tier < 3).sort((a, b) => a.tier - b.tier);
        for (const t of ups) { if (e.state.gold >= cost(t.lineId, t.tier)) { if (e.upgrade(t.id).ok) spent = true; break; } }
        if (spent || !want || bought >= want.cap) continue;
        if (!padIds.every((pid) => e.state.towers.find((t) => t.padId === pid))) continue;
        for (const t of e.state.towers) {
          if (t.tier !== 3 || t.lineId !== want.line) continue;   // eligibility BEFORE budget
          if (e.branch(t.id, want.key).ok) { bought += 1; spent = true; break; } // budget on SUCCESS
        }
      }
      e.callWave();
    }
    e.tick();
  }
  return { phase: e.state.phase, lives: e.state.lives, bought };
}

if (process.argv.includes("--branch")) {
  const CAP = Number(process.env.CAP || 1);
  const ARMS = [["none", null]];
  for (const [line, def] of Object.entries(DATA.TOWERS)) {
    for (const [key, b] of Object.entries(def.branches || {})) {
      ARMS.push([`${line}:${key} ${b.name}`, { line, key, cap: CAP }]);
    }
  }
  for (const lvl of DATA.LEVELS.filter((l) => !only || only.includes(l.id))) {
    const armour = lvl.waves.flatMap((w) => w.groups)
      .filter((g) => (DATA.ENEMIES[g.type] || {}).armor > 0).reduce((n, g) => n + g.count, 0);
    for (const diff of DIFFS) {
      console.log(`\nL${lvl.id} ${lvl.name} (${diff}, convert up to ${CAP}) — armoured bodies in its waves: ${armour}`);
      for (const [name, want] of ARMS) {
        let buys = 0;
        const v = SEEDS.map((seed) => {
          const rs = [DART, MIXED].map((pl) => playBranch(lvl, seed, pl, diff, want));
          buys += rs.reduce((n, r) => n + r.bought, 0);
          const won = rs.filter((r) => r.phase === "won");
          return won.length ? Math.max(...won.map((r) => r.lives)) : -1;
        });
        const lost = v.filter((x) => x < 0).length;
        console.log(`   ${name.padEnd(22)} median ${String(median(v)).padStart(3)}  [${v.join(",")}]` +
          `  bought=${buys}${lost ? `  LOST ${lost}/${SEEDS.length}` : ""}`);
      }
    }
  }
  process.exit(0);
}

// ---- --gold: sweep startGold, the opening-board knob ----
//
//   GOLDS=1000,1200,1500 node tools/td-sim.js 33 --gold
//
// startGold decides the OPENING board, and the difficulty audit measured that
// 76% of all damage lands in waves 1-3 — so on a fresh level it is the knob with
// the most authority. (On a TUNED level it is documented as near-inert upward:
// raising it just trivializes.) Prints every seed, because a median hides the
// floor and the floor is what `AUDIT heroic is a SLOPE` actually rides on.
if (process.argv.includes("--gold")) {
  const GOLDS = (process.env.GOLDS || "").split(",").filter(Boolean).map(Number);
  for (const lvl of DATA.LEVELS.filter((l) => !only || only.includes(l.id))) {
    console.log(`\nL${lvl.id} ${lvl.name} (shipped startGold ${lvl.startGold})`);
    for (const g of (GOLDS.length ? GOLDS : [lvl.startGold])) {
      const alt = Object.assign({}, lvl, { startGold: g });
      const cols = [];
      for (const d of DIFFS) {
        const r = SEEDS.map((s) => best(alt, s, d));
        const w = r.filter((x) => x.phase === "won").map((x) => x.lives);
        const lost = r.length - w.length;
        cols.push(w.length
          ? `${d} ${w.join(",")} med ${median(w)} min ${Math.min(...w)}${lost ? ` LOST x${lost}` : ""}`
          : `${d} LOST on every seed`);
      }
      console.log(`   gold=${String(g).padStart(5)} | ${cols.join(" | ")}`);
    }
  }
  process.exit(0);
}

for (const lvl of DATA.LEVELS.filter((l) => !only || only.includes(l.id))) {
  const cols = [];
  for (const d of DIFFS) {
    const r = SEEDS.map((s) => best(lvl, s, d));
    const lives = r.filter((x) => x.phase === "won").map((x) => x.lives);
    const lost = SEEDS.filter((s, i) => r[i].phase !== "won");
    cols.push(`${d} ${lost.length ? "LOST@" + lost.join("/") : lives.join(",") + " med " + median(lives)}`);
  }
  // "losable by neglect" is checked with the FULL star tree owned too — a
  // future ability that let a do-nothing build survive would otherwise ship.
  const n = `${neglect(lvl, SEEDS[0])}/${neglect(lvl, SEEDS[0], ALL_META)}`;
  console.log(`L${String(lvl.id).padStart(2)} ${lvl.name.padEnd(20)} ${cols.join(" | ")} | neglect ${n}`);
}
