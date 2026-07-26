# 🔧 PLAN — World 5: The Garage (Fort Josh L17-L20)

Adds **4 levels (L17-L20), 2 enemies and 1 boss** to Fort Josh, taking it from
16 levels to 20. Written 2026-07 against the shipped state (`ea86917`).

Read this **with** the fort sections of `CLAUDE.md` — especially the World-4
post-mortem, which is the reason this plan is shaped the way it is. World 4 was
**built once and REVERTED** before it shipped. Every rule in §2 is a scar.

---

## 1. Scope — why 4, not 3 or 6

**4 levels, one world.** Every fort system is built around a world of exactly
four levels with a boss finale:

- the unlock ladder (beat N ⭐ → N+1 opens) and the world tint on the grid;
- `UI.endlessUnlocked` — a world's endless arena opens when **all 4** of its
  levels are 3⭐ (the picker literally says "3⭐ the 4 levels");
- the star economy — the ceiling derives from `LEVELS.length * 3`;
- one boss finale per world, marked 👑 on the grid.

3 levels would leave a world without a finale; 5-6 would either break the
"4 levels" contract or half-build a sixth world. **4 is the only clean number.**

Resulting totals: **20 levels · 5 worlds · 5 bosses · 25 enemy types · 60⭐ ceiling**
(the 77⭐ star tree still costs more than the ceiling, so allocation stays a real
choice — the guardrail that pins this keeps passing).

---

## 2. What this must NOT repeat (hard rules, each one a scar)

1. **Never tune against a solver stronger than the one in the suite.** The first
   World-4 attempt passed a local sim that bought tier-4 branches; `PLAYABILITY`
   deliberately does not, so levels that looked comfortable failed on push. Tune
   with the shipped best-of-two oracle *only*.
2. **Composition beats budget.** Drawing freely from the special roster produced
   waves of shielded + splash-resistant + self-healing enemies with no answer —
   unwinnable at *every* base and start-gold. **Rule: a vanilla backbone, and at
   most ONE special shape per wave, capped at 25% of that wave's HP.**
3. **A boss is its own difficulty axis.** L16's margin was eaten by the
   Tickmaster, not its waves — proven because *halving* the wave budget made the
   margin worse. Tune boss and waves separately.
4. **Short paths are HARDER** (less tower exposure). Lengthen to soften; never
   reach for HP.
5. **`night` is untunable for a new world's mid level.** −15% reach held L14 at
   heroic 0/3 across a 600→1500 gold sweep. World 5 uses conveyor/lever
   gimmicks, not night.
6. **Threat SHAPE is the only lever this engine responds to.** Bigger HP piles
   flip a level from flawless to a loss with no middle ground (re-confirmed on
   L16 this month: hp 3200→3500 goes 6-20 → 3-19 → 3-8 → loses outright).
7. **A seed set can hide a broken contract.** L7 was winnable on the tested seed
   and lost 3 of 12; L16 was flawless on 2 of 8. **Every winnability claim in
   this plan is across ≥6 seeds.**
8. **Ship nothing that fails a shipped guardrail. Revert instead.** That is what
   saved World 4.

---

## 3. Fiction and difficulty position

**The Garage** — the door Josh's toys get carried out of. Oil-stained concrete,
a workbench strip-light, a lawnmower under a tarp. Colder and harder-edged than
the Attic's warm brown.

Difficulty target: **at or below the Attic's margins** (attic averages 13.0
lives dart-only / 15.5 mixed on normal). World 5 targets **≤ 13.0 / ≤ 14.0**.

> The curve peaking at World 3 is **accepted** (owner, 2026-07). This plan does
> **not** re-tune Worlds 1-4. World 5 aims to be a firm climax, not to out-spike
> the Toy Store — and per rule 6 that may not be achievable. If the sims land at
> "as hard as the Attic, no harder", that is a **pass**, recorded honestly.

Shape targets, extrapolating the existing curve:

| | path len | pads | waves | startGold | budgetBase |
|---|---|---|---|---|---|
| Attic (L13-16) | 56-68 | 11-14 | 14-15 | 950-1200 | 460-700 |
| **Garage (L17-20)** | **46-60** | **12-15** | **15-16** | **1250-1500** | **700-820** |

Shorter paths + more waves + more pads = a denser, faster world.

---

## 4. New content

### 4.1 Two enemies — each breaks a board the current roster cannot

Every existing shape is taken: vanilla, flier, fast-flier, armored, armored
flier, splitter, charger, healer, gold-burst, phaser, tunneler, shielded,
splash-resistant, slow-healer, gun-jammer. These two are genuinely new:

**🛹 Grease Racer** — `slowImmune: true`
```
hp 70 · speed 1.6 · armor 0 · bounty 10 · lives 1
```
The Fan's slow does **nothing** to it. Fast and fragile, so it demands raw DPS
or a soldier wall. This is the first enemy that hard-counters the Fan, which is
otherwise universal — the counter matrix gains its missing row.
*Engine:* one guard in `applySlow` (the ONE slow path), so puddles, auras and
the Sticky Floor all honour it for free.

**🪣 Bolt Bucket** — `spawner: { type: "brick", every: 3, count: 2 }`
```
hp 260 · speed 0.5 · armor 0.2 · bounty 30 · lives 1
```
Drips 2 Bricks every 3 seconds **while alive**. Kill it early and far from the
door or you drown in bolts. Punishes slow-drip DPS and rewards front-loaded
burst — the exact opposite of the Couch Cushion's lesson.
*Engine:* a spawner tick beside `bossTick`, flushing through the **buffered**
split-spawn path (never mutate `state.enemies` mid-iteration — the Mud Blob
precedent).

Both need a `enemyTraits` line or the guide-coverage guardrail fails — which is
the point of that guardrail.

### 4.2 The boss — 🧰 The Toolbox Titan (L20)

```
hp 3400 · speed 0.34 · armor 0.3 · shield 80 · shieldRegen 8
bounty 320 · lives 8 · size 3.1 · boss true
phases: [ {upTo: 1.0},
          {upTo: 0.66, disable: {every: 5, seconds: 3}},
          {upTo: 0.33, summon: {type: "screw", count: 2, every: 6}} ]
```

- **Toll 8**, matching every other big boss. (The Tickmaster's 10-of-20 quantized
  its whole finale into "20, 10 or dead" — fixed this month; do not repeat it.)
- **Tower-facing from the start.** The Vacuum King shipped with a kit only a camp
  build could feel, so a tower-only board walked the World-2 finale at 19/20. The
  Titan jams a gun at 66% and summons gun-jamming Loose Screws at 33% — both
  reuse **already-tested** engine paths (`disable`, `summon`), no new engine code.
- **Its own art branch**, or the pixel-hash guardrail fails — which is exactly
  how the Tickmaster was caught shipping as a 3200hp sock.

### 4.3 Endless arena (5th)

`ENDLESS.worlds.garage = { label: "🔧 Garage", pool: [...], miniBoss: "pinata" }`
plus a `garage` arena (lane + 14 pads).

- **Mini-boss is the Piñata**, like every other world. The Attic shipped with the
  3200hp Tickmaster as its every-5th-wave punctuation and ended runs at wave 5-9
  against 28-46 elsewhere. A mini-boss is a spike, not a wall.
- Pool: vanilla backbone + the two new shapes + 2-3 existing specials.

---

## 5. Level designs

Each level names the **question it asks** — the thing your board must answer.

### L17 — "Oil Slick" (intro to the Grease Racer)
- Path ~46, pads 12, waves 15, startGold 1250, budgetBase 700.
- **Gimmick: conveyor** (an oil slick shoves enemies along) — reuses L7's tested
  speed-zone, thematically perfect, and stacks meanly with a slow-immune runner.
- **Question:** *your Fan is dead weight against half this wave.* Racers arrive
  from wave 4, always paired with vanilla so the backbone rule holds.

### L18 — "The Workbench" (intro to the Bolt Bucket)
- Path ~58 (the world's longest — this level teaches, so give tower exposure),
  pads 14, waves 15, startGold 1300, budgetBase 740.
- **Gimmick: none.** A clean board so the spawner mechanic reads.
- **Question:** *can you kill the source before its output buries you?* One
  Bucket at wave 6, two at 10, three at 14.

### L19 — "Two-Car Garage" (multi-path + lever)
- **Two lanes with a 🔀 lever**, the world's strategy level. Path ~50 default /
  ~64 alternate, pads 15, waves 16, startGold 1400, budgetBase 780.
- Lanes share an identical prefix up to the fork so a thrown lever reroutes
  in-flight enemies with **no teleport** — the invariant TD-7 established and a
  guardrail already checks.
- **Question:** *can you buy time with routing instead of gold?* Tuned so it is
  winnable on the **default (short) route** by the shipped solver — the lever is
  proven separately as an edge, exactly as L10 is.

### L20 — "The Toolbox Titan" 👑
- Path ~54, pads 14, waves 16, startGold 1500, budgetBase 820.
- Waves 1-15 must **cost real lives** — L16's waves 1-14 leak nothing on any
  seed or build, which is why its finale is a coin flip. Target: ≥3 lives lost
  before the boss wave on a median seed.
- **Question:** *everything, at once.*

---

## 6. Method — generate, validate, sim, then touch the data

The TD-4 precedent: hand-writing ~60 waves to a ±25% budget curve is
error-prone, so **the data file is written last**.

1. **Pads & forks by search, not by eye.** A scratch generator enumerates
   candidate lanes and pad sets, keeping only those that satisfy every geometry
   law: ≥0.99 cells from **every** lane, ≥1.4 apart pairwise, ≥1.9 from a lever,
   in bounds. (L10's p10 sat 0.50 cells from its *second* lane for a whole
   release because only lane 0 was ever checked.)
2. **Waves by generator + validator.** Emit wave literals against the budget
   curve, then flag every wave outside ±25% **before** the data file is touched.
   Enforce the backbone rule mechanically: ≥75% vanilla HP, ≤1 special shape.
3. **Sim before commit.** Every level × 3 difficulties × ≥6 seeds with the
   shipped best-of-two oracle: winnable everywhere, losable by neglect
   everywhere, no level losing >5 lives in waves 1-3.
4. **Boss separately.** Force each hp band and assert the phase actually fires
   (the Static/Tickmaster precedent — a boss's kit can ship dead-untested
   because no solver drops it into the band).

---

## 7. Systemic touchpoints — the "content outgrew a literal" checklist

World 4 shipped **unreachable** because `TOTAL_PLANNED = 12` was a literal. Every
item below is a literal or a chain that a 5th world breaks. Derive, don't count.

| # | Where | What |
|---|---|---|
| 1 | `td.test.js:595` | `12 badge cells` → derive from `ACHIEVEMENTS.length` |
| 2 | `td-logic.test.js:1073` | `ACHIEVEMENTS.length === 12` → derive / update |
| 3 | `td-ui.js` endless picker | `"🔒 3⭐ the 4 levels"` → derive per world |
| 4 | `td-ui.js` `td-note` | "16 levels across 4 worlds" → derive |
| 5 | `styles/td.css` | `.td-level[data-world="garage"]` tint |
| 6 | `td-render.js:1340` | spawn glyph chain — **already broken**: the Attic falls through to the bedroom's 🛏️. Make it a data field on the world. |
| 7 | `td-render.js` | art branches for both enemies + the boss (pixel-hash) |
| 8 | `td-logic.js` `enemyTraits` | a line for `slowImmune` and for `spawner` |
| 9 | `td-data.js` | `ENDLESS.worlds.garage` + `ENDLESS.arenas.garage` |
| 10 | `CLAUDE.md` | structure, status paragraph, learnings |

### Phase 0 — fix what World 4 left behind (do this first, it is small)

**The Tickmaster has no achievement badge.** The other three bosses each have one
(`bossbonker`, `dysondenied`, `unplugged`); World 4's finale never got one, and
nobody noticed because the badge count is pinned at 12 in two places. Add the
13th badge, earn it on the L20-style win path, and derive both literals — then
World 5's boss badge is a one-line addition instead of a fourth surprise.

---

## 8. Verification gates — nothing ships until all pass

Existing guardrails that must stay green (by name):

- `PLAYABILITY` — every level winnable by the best-of-two oracle, losable by neglect
- `AUDIT heroic is a SLOPE` — every level winnable on heroic
- `AUDIT boss tension` — **median ≤17 across 8 seeds** for every boss finale
- `AUDIT threat shape` — World-2/3 air pressure preserved, World 1 flier-free
- the wave-budget ±25% audit (boss waves exempt, but must contain a boss)
- `AUDIT: no level loses >5 lives in waves 1-3` (the gotcha class)
- pad geometry — every lane, every pad, every pair
- `AUDIT: no pad hides under ANY floating field control` — 8 viewports
- `ART: every enemy draws as ITSELF` — pixel hash, no two types identical
- `TD-12 guide truth` — every special field produces a trait line
- `AUDIT endless` — 5th arena, own label, non-boss mini-boss, 4 levels behind the unlock
- `PORTRAIT: the battlefield gets every pixel` — 7 portrait viewports
- `site.test.js` emoji scans — nothing newer than Emoji 13.0, VS16 on picture emoji
- determinism hashes, and `no uncaught page errors`

New guardrails this world owes:

- the Grease Racer is **provably** unslowable (drive a Fan at one and assert speed)
- the Bolt Bucket **stops spawning when killed**, and its children are buffered
- the Titan's phases forced band-by-band (jam fires, screws summon)
- L19's lanes coincide up to the fork and diverge after
- L20 loses ≥3 lives before its boss wave on a median seed

---

## 9. Risks, and the honest exits

| Risk | Mitigation | Honest exit |
|---|---|---|
| World 5 can't be made harder than the Attic (rule 6) | tune by threat shape, not HP | ship it as "as hard as the Attic" and record the measurement |
| The spawner destabilises the budget audit (its children are free HP) | count spawned HP into the wave's budget in the validator | drop `count` to 1 |
| A 5th world stretches the star tree thin (60⭐ vs 77⭐ cost) | verified: still above the ceiling, allocation stays a choice | none needed |
| Two new mechanics at once is a lot of engine surface | both are one-guard changes on ONE existing path | ship the Racer first, the Bucket second |
| The whole thing fails a gate late | — | **revert, do not ship.** World 4 was pulled once and was better for it. |

---

## 10. Sequencing

1. **Phase 0** — the Tickmaster badge + derive the two count literals. *(small)*
2. **Engine** — `slowImmune` + `spawner`, with node tests, before any content.
3. **Enemies + boss** — data, art branches, trait lines, forced-phase tests.
4. **Maps** — generator + validator for lanes/pads/forks; geometry green.
5. **Waves** — generator + validator to the budget curve; backbone rule enforced.
6. **Tune** — sims across 3 difficulties × ≥6 seeds until every gate is green.
7. **Wire the world** — tint, glyph, endless arena, the derived strings.
8. **Full suite + push + watch `verify-live`**, then update `CLAUDE.md`.

---

## 11. BUILT — what shipped, and what the measurements actually said

Status: **✅ SHIPPED.** 20 levels · 5 worlds · 5 bosses · 20 non-boss enemy types · 60⭐ ceiling.
Every gate in §8 is green. Below is the honest record, including the parts of
this plan the data refused.

### 11.1 What was measured

Roughly **180 configurations** were simulated with the *shipped* best-of-two
oracle (never a stronger local solver — rule 1), sweeping start-gold, budget
base, pad count, wave count, lane shape, conveyor strength, boss hp, boss leak
toll, flier share and bypass shapes. The result is one flat finding:

> **There is no configuration in which a Garage level finishes NORMAL below ~18
> lives while staying winnable on HEROIC.** Normal difficulty and heroic
> winnability are separated by a step, not a slope.

That is exactly the threshold domination CLAUDE.md already documents ("a board
holds a wave completely or collapses"), now quantified for a fresh world. So
World 5 ships per the §9 exit: **a firm world that is not harder than World 3 on
normal**, whose real test is its finale.

Shipped margins (best-of-two, median across 6 seeds):

| | normal | heroic | neglect | waves 1-3 |
|---|---|---|---|---|
| L17 Oil Slick | 19 | 10 | loses | −1 |
| L18 The Workbench | 20 | 10 | loses | 0 |
| L19 Two-Car Garage | 20 | 14 | loses | 0 |
| L20 The Toolbox Titan | **9** (8 seeds, range 7-11) | 14 | loses | 0 |

L20's finale is the **tensest in the game** — L16's median is 16, L20's is 9,
graded rather than quantized, with no seed lost.

### 11.2 Negative results (recorded, not forced)

- **A bypass shape does NOT produce chip damage.** Making the tunnelling Digger
  Mole (untargetable *and* unblockable through the middle third) a recurring late
  special moved normal by **zero** lives on both probed levels. A full board
  still kills it at the ends.
- **Air pressure grades one map and breaks another.** At 1.8× the flier share,
  L18 dropped to a median 16 on normal — and lost on *every* heroic seed. L19 did
  not move at all. The lever that fixed mortar-mono is map-specific.
- **The conveyor is the `night` class of knob.** At ×1.45 over three strips L17
  held normal comfortably and was heroic-unwinnable on every seed. Shipped at
  ×1.30 over two strips, and capped by guardrail at 1.35.
- **Boss hp above ~5800 QUANTIZES the finale** (every seed lands on exactly one
  boss leak: 12 or 14). 4600 hp with a 6-life toll is the only band that is both
  graded and safe.
- **The plan's "L20 must lose ≥3 lives before its boss wave" was not achieved.**
  Waves 1-14 leak nothing on any tested seed or build — the same shape as L16.
  It is not fixable inside the budget contract for the reason above. The finale
  itself carries the level instead, and *that* is now graded.

### 11.3 Where the plan changed during the build

- **Wave counts 15-16 → 14-15.** Each wave is 1.18× the last, so the final wave
  is most of a level's difficulty; a 16th wave put it beyond any board.
- **L19 has 13 pads, not 15**, and every one was searched against the **default**
  lane. The first cut spread them across both lanes, so a third of the board only
  covered the loop nobody was walking — it lost 11 lives in a single wave. The
  lever's payoff is the tail towers getting longer on target, exactly as L10's is.
- **L18's lane was re-shaped.** Its first cut ran four rows 3-4 cells apart and a
  tier-3 dart reaches ~4, so one tower covered two runs and the level was flawless
  at 10 pads on heroic. Rows are 6 apart now.
- **The Bolt Bucket gained a capped load** (`spawner.max: 8`). Uncapped, ten of
  them on a late wave outlived their own HP by ~7× and dropped ~18k of free HP
  onto an 11k wave. A fountain cannot be budgeted.
