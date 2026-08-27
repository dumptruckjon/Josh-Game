#!/usr/bin/env node
// 🏰 Fort Josh — THREAT-SHAPE doser: search for a safe way to make a level that
// nobody can lose actually ask a question.
//
//   node tools/td-threat.js                 # audit: what counter does each level's late game demand?
//   node tools/td-threat.js 22,26,30         # grid-search those levels for a safe (wave, dose)
//   DOSES=2,3,4,5,6 node tools/td-threat.js 26
//   TYPE=cushion node tools/td-threat.js 26  # try a different shape
//
// WHY THIS FILE IS IN THE REPO. The fork sweep sat open for two whole releases
// because its generator was a scratch script that got thrown away, so "re-run it
// over the newer maps" was unactionable — and two worlds shipped with no lever.
// The same would happen here: 10 of 36 levels still finish 20/20 on normal, and
// the only way to move one is a per-level (wave, dose) search that has to be
// repeatable. It uses the SHIPPED oracle verbatim (dart-swarm vs a fixed mixed
// plan, best of the two, no tier-4 branches) — tuning against a stronger solver
// is what got World 4 reverted.
//
// WHAT IS ALREADY SETTLED (do not re-measure):
//   * bigger HP piles, backbone stat shape, gold, budget base, lane length and
//     side-door dose are each measured NOT to move a flat level;
//   * an additive mini-boss is a disguised constant (spread 0 across 8 seeds at
//     every hp, with or without a jam/summon kit);
//   * `heal` is the lever that works — it is a DPS-THRESHOLD shape, and it was
//     the one counter appearing on a single level (L4) in the whole campaign.
//
// THREE LAWS THE SEARCH ENFORCES, each learned by breaking one:
//   1. FORK LEVELS ARE EXCLUDED. L31's swap measured beautifully and still broke
//      the build: `TD7 lever advantage` needs a thin board to LOSE on the short
//      route and WIN with the diversion thrown, and making the level harder made
//      it lose on both. A fork level's difficulty IS its lever's value.
//   2. A candidate is screened on 4 seeds and CONFIRMED on 8. Two doses looked
//      clean on 4 and lost heroic on 8 (L26 w12 x3, L22 w12 x5). The confirm set
//      is ranked by HEROIC HEADROOM, not by how far it moves normal — see the
//      comment at the pick, which is where this tool has been wrong twice.
//   3. The swap REPLACES the wave's one special and returns the reclaimed HP to
//      the fattest backbone group. Every late wave of every flat level already
//      carries exactly one special, so `W5 wave composition` forbids ADDING one;
//      returning the HP keeps the +/-25% budget number and RAISES the >=70%
//      backbone share, so all three contracts hold by construction. Never let the
//      swap ADD hp, and never drain the FLIER group — that would silently delete
//      the anti-air property `AUDIT threat shape` protects.
const path = require("path");
const ROOT = path.join(__dirname, "..");
const TD = require(path.join(ROOT, "scripts/td-logic.js"));
const DATA = require(path.join(ROOT, "scripts/td-data.js"));

const BACK = new Set(DATA.BACKBONE_TYPES), VALVE = new Set(["pinata"]);
const cost = (l, t) => DATA.TOWERS[l].tiers[t].cost;
const DART = ["dart"];
const MIXED = ["fan", "mortar", "dart", "dart", "fan", "mortar", "dart", "dart", "dart", "dart", "dart", "dart"];
// Levels carrying a lever (derived, so a tenth world inherits the exclusion).
const FORKS = new Set(DATA.LEVELS.filter((l) => (l.paths || []).length > 1).map((l) => l.id));
// …and levels whose DIFFICULTY IS A PINNED PROPERTY, which is the fork rule
// generalized. A fork level is excluded because `TD7 lever advantage` needs a
// thin board to lose on the short route and win with the diversion, so making
// the level harder breaks the thing the level exists to prove. Three more
// levels are load-bearing the same way, and the doser found this the expensive
// way — every L5 candidate measured beautifully while L5 is one of the two
// levels `AUDIT mono builds` uses to prove no single plan clears the campaign
// ("heroic L5 must defeat a dart-ONLY board … and reward a mixed one"). This
// cannot be derived from DATA — it is a fact about the TESTS — so it is an
// explicit list that names its pinner, and the tool says why it skipped.
const PINNED = {
  4: "AUDIT mono builds — its boss must defeat the fixed mixed plan on heroic",
  5: "AUDIT mono builds — must defeat a dart-ONLY board and reward a mixed one on heroic",
  8: "L8 stays in its GRADED band — pinned from BOTH sides in a ~200hp-wide window",
};
// A dose must leave 3 stars REACHABLE. Derived from the shipped ladder, never
// re-typed: `stars` is [[18,3],[10,2],[1,1]], so 18 lives is the 3-star line.
const STAR3 = DATA.RULES.stars.find((s) => s[1] === 3)[0];

function playWith(level, seed, plan, difficulty) {
  const e = TD.createEngine(level, { seed, difficulty });
  const padIds = level.pads.map((p) => p.id);
  let idx = 0, guard = 0;
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
  }
  return e.state.phase === "won" ? e.state.lives : -1;
}
const best = (lv, s, d) => Math.max(playWith(lv, s, DART, d), playWith(lv, s, MIXED, d));
function neglect(lv, s) {
  const e = TD.createEngine(lv, { seed: s });
  let g = 0;
  while (e.state.phase !== "won" && e.state.phase !== "lost" && g++ < 400000) { if (e.state.phase === "build") e.callWave(); e.tick(); }
  return e.state.phase;
}

function swapped(level, waveNo, count, type) {
  const L = JSON.parse(JSON.stringify(level));
  const w = L.waves[waveNo - 1];
  if (!w || w.boss) return null;
  const gi = w.groups.findIndex((g) => !BACK.has(g.type) && !VALVE.has(g.type));
  if (gi < 0) return null;
  const old = w.groups[gi];
  const oldHp = DATA.ENEMIES[old.type].hp * old.count;
  const newHp = DATA.ENEMIES[type].hp * count;
  if (newHp > oldHp) return null;                    // an HP-preserving swap never ADDS
  w.groups[gi] = { type, count, gap: old.gap, delay: old.delay };
  if (old.at != null) w.groups[gi].at = old.at;
  const backs = w.groups.filter((g) => BACK.has(g.type) && !DATA.ENEMIES[g.type].flier)
    .sort((a, b) => DATA.ENEMIES[b.type].hp * b.count - DATA.ENEMIES[a.type].hp * a.count);
  if (backs.length) backs[0].count += Math.max(0, Math.round((oldHp - newHp) / DATA.ENEMIES[backs[0].type].hp));
  return { level: L, was: old.type, count };
}

// ---- audit mode: which counters does each level's late game never ask for? ----
const TRAITS = {
  air: (e) => !!e.flier, armor: (e) => (e.armor || 0) > 0, shield: (e) => (e.shield || 0) > 0,
  splashRes: (e) => (e.splashResist || 0) > 0, bonkRes: (e) => (e.bonkResist || 0) > 0,
  zapRes: (e) => (e.zapResist || 0) > 0, slowImm: (e) => !!e.slowImmune, slowHeal: (e) => !!e.slowHeal,
  hidden: (e) => !!e.phase || !!e.tunnel, heal: (e) => !!e.heal, spawn: (e) => !!e.spawner, hurry: (e) => !!e.hurry,
};
function audit() {
  const keys = Object.keys(TRAITS);
  console.log("lvl  world      " + keys.map((k) => k.padStart(9)).join("") + "   (% of late-wave HP)");
  for (const lvl of DATA.LEVELS) {
    let total = 0; const by = {};
    for (const w of lvl.waves.slice(-5)) {
      if (w.boss) continue;
      for (const g of w.groups) {
        const def = DATA.ENEMIES[g.type];
        if (!def || def.boss) continue;
        const hp = def.hp * g.count; total += hp;
        for (const [k, f] of Object.entries(TRAITS)) if (f(def)) by[k] = (by[k] || 0) + hp;
      }
    }
    const cells = keys.map((k) => (total && by[k] ? Math.round(by[k] / total * 100) + "%" : "·").padStart(9)).join("");
    console.log(String(lvl.id).padStart(4) + " " + lvl.world.padEnd(10) + cells + "  " + lvl.name);
  }
}

const SCREEN = [1, 3, 5, 7];
const FULL = [1, 3, 5, 7, 11, 13, 17, 19];
const TYPE = process.env.TYPE || "healer";
const DOSES = (process.env.DOSES || "2,3,4,5,6,8").split(",").map(Number);
const arg = process.argv[2];

// ---- SPREAD=1: which levels does the SEED not change? --------------------
// This is the targeting list, and it must be DERIVED. The first pass looked for
// levels finishing a flat 20/20 and found 12 — but a level reading 19 on all
// eight seeds (L21 does) is exactly as much a disguised constant: the outcome
// does not depend on the roll, so the level asks no question, it just charges a
// fixed toll. SPREAD, not the value, is the signal. Keeping this as a mode of
// the tool rather than a remembered list is the fork-sweep lesson: an open item
// nothing can re-derive is a wish, not a task.
function spread() {
  console.log("lvl  world       min  med  max  spread   dart-med   (normal, 8 seeds, best-of-plans)");
  const flat = [];
  for (const lvl of DATA.LEVELS) {
    const v = FULL.map((s) => best(lvl, s, "normal")).sort((a, b) => a - b);
    const d = FULL.map((s) => playWith(lvl, s, DART, "normal")).sort((a, b) => a - b);
    const med = (a) => a[Math.floor(a.length / 2)];
    const sp = v[v.length - 1] - v[0];
    const fork = FORKS.has(lvl.id) ? " (lever)" : "";
    console.log(String(lvl.id).padStart(4) + " " + lvl.world.padEnd(10) +
      String(v[0]).padStart(5) + String(med(v)).padStart(5) + String(v[v.length - 1]).padStart(5) +
      String(sp).padStart(8) + String(med(d)).padStart(11) + "   " + lvl.name + fork);
    if (sp <= 1 && med(v) >= 18) flat.push(lvl.id + (fork ? "*" : ""));
  }
  console.log("\nAsks no question (spread <= 1 and median >= 18): " + (flat.join(", ") || "none"));
  console.log("* = carries a lever, so it is excluded from the doser by design.");
}

if (process.env.SPREAD) { spread(); process.exit(0); }
if (!arg) { audit(); process.exit(0); }

for (const id of arg.split(",").map(Number)) {
  const base = DATA.LEVELS.find((l) => l.id === id);
  if (!base) { console.log(`L${id}: no such level`); continue; }
  if (FORKS.has(id)) { console.log(`L${id} ${base.name}: SKIPPED — carries a lever (its difficulty is the lever's value)`); continue; }
  if (PINNED[id]) { console.log(`L${id} ${base.name}: SKIPPED — its difficulty is a pinned property (${PINNED[id]})`); continue; }
  const n = base.waves.length;
  // Measure the level's OWN baseline first. The screen used to be
  // `!nn.every(x => x === 20)`, which is only equivalent to "the dose did
  // something" on a level that starts at a flat 20 — on L33, whose base is
  // 20,19,20,20,19,20,20,20, two doses "passed" while reproducing the baseline
  // EXACTLY. A criterion that a no-op satisfies is the same defect as a test
  // that cannot fail, so a candidate must now cost strictly more than the
  // untouched level does.
  const baseNormal = SCREEN.map((sd) => best(base, sd, "normal"));
  const baseSum = baseNormal.reduce((a, b) => a + b, 0);
  // A level that ALREADY never 3-stars is not a level that asks nothing, and the
  // "must MOVE the star outcome" bound below could not be satisfied on it by
  // anything — a criterion nothing can meet is the mirror of a test that cannot
  // fail. Say so up front rather than grid-searching a boss finale for an hour
  // and then reporting every candidate as a failure.
  if (!baseNormal.some((x) => x >= STAR3)) {
    console.log(`L${id} ${base.name}: SKIPPED — its baseline already 3-stars on NO screened seed ` +
      `(${baseNormal.join(",")}), so it is not a level that asks nothing`);
    continue;
  }
  let baseFullSum = null, baseStars3 = 0;   // lazy: only needed if something survives the screen
  const hits = [];
  for (let wv = Math.max(1, n - 5); wv <= n; wv++) {
    for (const dose of DOSES) {
      const sw = swapped(base, wv, dose, TYPE);
      if (!sw) continue;
      const nn = SCREEN.map((s) => best(sw.level, s, "normal"));
      if (nn.some((x) => x < 0)) continue;
      if (nn.reduce((a, b) => a + b, 0) >= baseSum) continue;   // no-op or easier: not a dose
      const hh = SCREEN.map((s) => best(sw.level, s, "heroic"));
      if (hh.some((x) => x < 0)) continue;
      if (neglect(sw.level, SCREEN[0]) !== "lost") continue;
      hits.push({ wv, dose, was: sw.was, nn, hh, level: sw.level });
      console.log(`L${id} w${wv} ${sw.was} x${dose} SCREEN-OK | normal ${nn.join(",")} | heroic ${hh.join(",")}`);
    }
  }
  if (!hits.length) { console.log(`L${id} ${base.name}: NO safe (wave,dose) in the grid`); continue; }
  // RANK ON THE BINDING AXIS. This selection has now been wrong twice, the same
  // way each time. The first cut confirmed the three STRONGEST normal movers, so
  // on L34 every candidate tested was one that blows out heroic. The fix took the
  // strongest, the middle and the gentlest — still sorted by NORMAL, and on L33
  // that confirmed a dose whose heroic min was 1 while three candidates with
  // heroic headroom 4-5 were never run at all. Normal movement is what you WANT;
  // heroic survival is what BINDS (every rejection this tool has produced was a
  // heroic loss, never a normal one). So rank by heroic headroom and keep the
  // strongest normal mover as one arm for the record.
  const baseFull = FULL.map((sd) => best(base, sd, "normal"));
  baseFullSum = baseFull.reduce((a, b) => a + b, 0);
  baseStars3 = baseFull.filter((x) => x >= STAR3).length;
  const nsum = (h) => h.nn.reduce((s, x) => s + x, 0);
  const head = (h) => Math.min.apply(null, h.hh);
  const byHeroic = hits.slice().sort((a, b) => head(b) - head(a) || nsum(a) - nsum(b));
  const strongest = hits.slice().sort((a, b) => nsum(a) - nsum(b))[0];
  // The strongest mover needs a RESERVED slot, not a place in the queue: the
  // first cut appended it to `byHeroic` behind a `pick.length < 4` cap, so the
  // four heroic-headroom arms filled every slot and it was never actually run
  // (on L33 the 4th arm was bubblewrap x3 and the strongest, cushion x6, went
  // untested — the tool promising one thing in a comment and doing another).
  const pick = [];
  for (const h of byHeroic) if (pick.length < 3) pick.push(h);
  if (!pick.includes(strongest)) pick.push(strongest);
  for (const h of pick) {
    const nn = FULL.map((s) => best(h.level, s, "normal"));
    const hh = FULL.map((s) => best(h.level, s, "heroic"));
    const dd = FULL.map((s) => playWith(h.level, s, DART, "normal"));
    // Compare like with like: this arm runs FULL seeds, so it must be judged
    // against a FULL-seed baseline. The first cut compared an 8-seed sum to the
    // 4-seed screen baseline, which is always smaller, so every candidate
    // reported FAIL — including one with zero heroic losses. A fix that
    // introduces its own false negative is exactly the failure this tool has
    // now produced three times, so the baseline is computed per arm.
    // THE DOSE MUST MOVE THE STAR OUTCOME, AND MUST NOT ERASE IT. "Costs
    // strictly more than baseline" is too weak on one side and silent on the
    // other, and both halves cost a real measurement to learn:
    //   * too weak — L17 w11 passed while costing 2 lives across ALL EIGHT
    //     seeds (0.25 a seed, i.e. noise) and 3 stars stayed 8/8, so nothing a
    //     player experiences changed. It taxed heroic for free.
    //   * silent — every L5 candidate took a reliable 18-19 to 12-15 on 8 of 8
    //     with the spread unchanged, so 3 stars became UNREACHABLE. That is not
    //     a question, it is a strictly worse constant: the additive mini-boss
    //     result (spread 0 at every hp) wearing a threat shape.
    // Both bounds are read off the shipped star ladder rather than invented, and
    // they separate every data point this search has produced with no exceptions
    // — shipped doses land at 3-7 of 8 (from a baseline 8 of 8), while every
    // rejected candidate is either 0/8 or unmoved at 8/8.
    // …and it must buy BUILD DIVERSITY, which is what these doses are FOR.
    // CLAUDE.md states the purpose plainly — "what this buys is not
    // lives-remaining on normal but build diversity, since it roughly halves
    // what a dart-only board keeps" — and it was being eyeballed rather than
    // checked, so a candidate could pass every numeric gate while leaving the
    // dart swarm exactly as good as the best plan. Measured across every dose
    // this search has produced, the separation is total: all four previously
    // shipped doses and the two now shipping score 4/8 to 8/8 seeds where the
    // mixed plan beats dart-only, while L14 w10 and L5 w6 both score EXACTLY
    // 0/8 — a dart-favouring level that no healer dose changes, so it pays a
    // heroic cost for nothing. `div` is that count.
    const stars3 = nn.filter((x) => x >= STAR3).length;
    const div = nn.filter((x, i) => x > dd[i]).length;
    const moved = stars3 < baseStars3, keeps = stars3 > 0, diverse = div > 0;
    const ok = !hh.some((x) => x < 0) && !nn.some((x) => x < 0) &&
      nn.reduce((a, b) => a + b, 0) < baseFullSum && moved && keeps && diverse;
    const why = !keeps ? " [3★ UNREACHABLE on every seed]"
      : !moved ? " [3★ outcome UNCHANGED — the level plays the same]"
      : !diverse ? " [NO build diversity — dart-only keeps everything the best plan does]" : "";
    console.log(`L${id} w${h.wv} ${h.was} x${h.dose} @8seeds ${ok ? "PASS" : "FAIL"}${why} | normal ${nn.join(",")} | heroic ${hh.join(",")} | dart ${dd.join(",")} | 3★ ${baseStars3}/8 → ${stars3}/8 | mixed>dart ${div}/8`);
  }
}
