# 📦 PLAN — World 6: Moving Day (Fort Josh L21-L24)

Takes the fort from 20 levels to **24 · 6 worlds · 6 bosses**. Written 2026-07
against the shipped state (`74ea690`).

Read this with `PLAN_WORLD_5.md` §11 — its four negative results are the reason
this plan does not try several things that look obvious.

---

## 1. Fiction

**Moving Day.** The van is at the curb and everything is going in boxes. This is
the end of the arc the worlds have been walking: Bedroom (home) → Backyard →
Toy Store → Attic (stored away) → Garage (on the way out) → **the curb**. The
toys' last stand is against the movers.

Spawn marker is a stack of 📦; the finale is **🚚 The Moving Van** itself.

## 2. Difficulty position — set by measurement, not ambition

World 5 measured ~180 configurations and found the boundary: **normal difficulty
and heroic winnability are separated by a step, not a slope.** Every setting
where heroic was robustly winnable finished normal at 18-20; everything that bit
on normal made heroic unwinnable.

So World 6 does **not** chase "harder than World 3". It targets:

- normal **17-20** across levels, with the **finale** carrying the tension
  (World 5's Titan lands at a median 9/20 — that is the model)
- heroic **winnable on every seed**, with margins ≥6 where possible
- losable by neglect everywhere

If the sims land there, that is a pass, recorded honestly.

## 3. Two new enemies — each breaks a board nothing else does

Every existing shape is taken: vanilla, flier, fast flier, armored, armored
flier, splitter, charger, healer, gold-burst, phaser, tunneler, shielded,
splash-resistant, slow-healer, gun-jammer, slow-immune, spawner. These two are
genuinely new, and each is one read site.

### 🧻 Bubble Wrap — `bonkResist`

```
hp 130 · speed 0.6 · armor 0 · bounty 15 · lives 1 · bonkResist 0.6
```

The **mirror of the Couch Cushion**: single hits only pop one bubble at a time,
so **dart and soldier melee land at 40%** — while splash, zap and abilities cut
straight through. The Cushion says "stop using AoE"; this says "stop using only
single-target", and it is the first enemy that directly answers the **Dart**,
the generalist that CLAUDE.md records as clearing 16/16 on normal.

*Engine:* one clause beside `splashResist` in the ONE `dealDamage`, keyed on the
`how` values the bonk family already uses (`dart`, `melee`).

### 📻 Boom Box — `hurry: { mult, radius }`

```
hp 90 · speed 0.7 · armor 0 · bounty 16 · lives 1 · hurry { mult 1.35, radius 2.2 }
```

Blares out a beat that makes **every ally near it hustle**. It does not fight —
it makes the wave arrive faster than your board expects, and it punishes
ignoring a low-value target. The Junk Healer's shape (an aura that rewards
focus-firing the support) applied to *time* instead of hp.

*Engine:* a `hurryTick()` write pass (the healer's precedent) sets a flag, and
`effSpeed` — already the ONE speed site, where zones and enrage and boss phases
all live — reads it. Never a second speed computation.

### 🚚 The Moving Van (L24)

```
hp 5200 · speed 0.3 · armor 0.3 · shield 100 · shieldRegen 10
bounty 340 · lives 6 · size 3.2 · boss true
spawner { type: "box", every: 4, count: 2, max: 12 }   ← it unloads as it drives
phases  [ {upTo 1.0}, {upTo 0.66, disable {every 5, seconds 3}},
          {upTo 0.33, speedMult 1.3, spawn {type: "boombox", count: 2, every: 7}} ]
```

- **Toll 6**, matching the band World 5 proved is both graded and safe (above
  ~5800hp a finale QUANTIZES to exactly one boss leak and stops being graded).
- **Its kit reuses tested paths only** — `spawner` (the Bolt Bucket's capped
  load, used on a boss for the first time and thematically perfect: a van
  unloading boxes), plus `disable`/`spawn` phases. No new boss code.
- **Its own art branch**, or the pixel-hash guardrail fails.

## 4. What this plan will NOT try

Each of these is a measured dead end from World 5 — retrying them is how a
phase burns a day:

- **Bigger HP piles** to make it hard. Flips flawless → loss with no middle.
- **A bypass shape as the difficulty lever.** Making the tunnelling mole a
  recurring special moved normal by exactly zero.
- **A conveyor above 1.35**, or `night` anywhere. Both steal tower uptime, which
  gold cannot buy back.
- **Boss hp above ~5800.** Quantizes the finale.
- **16-wave levels.** Each wave is 1.18× the last, so a 16th puts the final wave
  beyond any board. Levels run 14-15.

## 5. Method

Exactly the World-5 pipeline, now that the tooling is in the repo:

1. `tools/td-map-search.js` — lanes + pads against every geometry law.
   Lane rows ≥6 apart (a tier-3 dart reaches ~4; closer rows let one tower cover
   two runs and the level goes flawless). Pads searched against the DEFAULT lane.
2. `tools/td-wave-gen.js` — emit + validate against both contracts. **The data
   file is written LAST.**
3. `tools/td-sim.js` — every level × 3 difficulties × ≥6 seeds with the SHIPPED
   oracle. Never a stronger local solver (that is what got World 4 reverted).
4. Gimmicks from TD-16 dosed per level BY MEASUREMENT — a side door is worth −1
   life on one map and −5 on another.

## 6. Systemic touchpoints — the "content outgrew a literal" checklist

| # | Where | What |
|---|---|---|
| 1 | `td-data.js` `WORLDS` | `moving` label + spawn glyph (a world without one falls through the renderer's default) |
| 2 | `td-data.js` `ACHIEVEMENTS` | a badge for the Moving Van — every other boss has one |
| 3 | `td-main.js` | earn it on the L24 win path |
| 4 | `td-data.js` `ENDLESS` | 6th pool + arena (World 4 shipped a pool with no arena and silently fell back to the bedroom map) |
| 5 | `styles/td.css` | `.td-level[data-world="moving"]` tint |
| 6 | `td-render.js` | art branches for both enemies + the boss |
| 7 | `td-logic.js` `enemyTraits` | a guide line for `bonkResist` and for `hurry`, or the coverage guardrail fails |

**Star economy check:** the ceiling derives as `LEVELS.length × 3` = **72⭐**
against a 77⭐ tree, so allocation stays a real choice and the guardrail holds.
Note for the future: a *seventh* world would put the ceiling at 84 and break it —
the tree would need to grow with it.

## 7. Gates

Every shipped guardrail, plus: both new traits produce guide lines; the boss's
phases forced band-by-band; the new world reachable, tinted, and playable in a
browser; `AUDIT threat shape` air pressure; no level losing >5 lives in waves
1-3; boss finale median ≤17 over 8 seeds.

## 8. Honest exits

| Risk | Exit |
|---|---|
| `bonkResist` unbalances the dart line campaign-wide | it is opt-in per enemy and only World 6 uses it — dose it down or drop the enemy |
| The world lands at "as hard as World 5" | ship it and record the measurement, as World 5 did |
| A gate fails late | **revert, do not ship.** World 4 was pulled once and was better for it |

---

## 9. BUILT — what shipped, and what the measurements said

Status: **✅ SHIPPED.** **24 levels · 6 worlds · 6 bosses · 72⭐ ceiling** (against
a 77⭐ tree, so allocation stays a real choice).

| | normal (4 seeds) | heroic | neglect |
|---|---|---|---|
| L21 Boxes by the Door | 19,19,19,19 · med **19** | 11,7,14,13 · med 13 | lost |
| L22 Turn It Down | 20,20,20,17 · med **20** | 16,15,12,17 · med 16 | lost |
| L23 Wrapped Tight | 20,20,20,20 · med **20** | 9,15,17,9 · med 15 | lost |
| L24 The Moving Van 👑 | 12,14,13,14,14,12,14,12 (8 seeds) · med **14** | 12-14 · med 13 | lost |

The finale is the point, and it landed: **median 14/20 across 8 seeds, range
12-14, no losses** — graded rather than quantized, the same shape World 5's
Toolbox Titan achieved.

### 9.1 The step function, reproduced a third time

L23 was built to finish around 17 and **refused, on every lever tried**:

| change | normal | heroic |
|---|---|---|
| lane 41, gold 1300 | **14** | LOST on 3 of 4 seeds |
| lane 41, gold 1450 | 14 | LOST on 2 |
| lane 41, gold 1600 | 14 | LOST on 2 |
| lane 52, gold 1300 | **20** | 9,15,17,9 — no losses |
| lane 58, gold 1300 | 20 | 15 |
| lane 52, base 700→800 | 20 | LOST on 1 |
| lane 52, base 700→880 | 20 | LOST on 3 |

Normal never moved off 20 once the lane cleared ~50, while heroic swung from
losing to comfortable and back. That is the boundary World 5 measured across
~180 configurations, now reproduced on a fresh map with a fresh enemy: **normal
difficulty and heroic winnability are separated by a step, not a slope.** L23
ships at lane 52 / base 700 — every gate passes, and the ~17 target is recorded
as unreachable rather than faked.

### 9.2 What the two new shapes are for

- **🧻 Bubble Wrap** closes the counter matrix. The Couch Cushion punished
  leaning on AoE; nothing punished leaning on single-target, and CLAUDE.md
  records dart-mono clearing 16/16 on normal. Bonk (dart, soldier melee) now
  lands at 40% on it, while splash, zap and abilities cut through — so the two
  enemies are exact opposites and neither is answered by the same board.
- **📻 Boom Box** is a threat damage does not answer: it makes the wave *arrive
  faster*. The Junk Healer's shape (kill the support first) applied to time.

### 9.3 Notes for the next world

- **The star ceiling will break at seven worlds.** It derives as
  `LEVELS.length × 3` = 72 now, against a 77⭐ tree. A seventh world puts it at
  84 and the "tree costs more than you can earn" guardrail fails — the tree must
  grow with it.
- A tooling bug worth remembering: the apply script appended level objects
  **high-to-low**, which left ids `…20,24,23,22,21`. The contiguity assertion
  caught it immediately, which is exactly what it is for.
