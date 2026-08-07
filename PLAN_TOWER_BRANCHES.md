# 🏰 Fort Josh — a third ultimate per tower? (decision document)

**Question asked (owner, 2026-08):** *"Deep brainstorm on either new tower types
or upgrade branches, eg each tower can have 3 ultimate choices vs current 2."*

**Status: Phase A ✅ BUILT; everything else DESIGNED, NOT BUILT.** The six branch
identity guardrails of §5a ship with this document (pure coverage, zero balance
risk, no new content). No new branch and no new tower line has been added.

---

## 0. The answer in four sentences

1. **Not three ultimates on every line.** Two of the four lines have a genuine
   third design axis; the other two do not, and forcing a third onto them
   produces filler that duplicates a shipped ability or breaks a guardrailed
   truth. Recommend a third branch on **Dart** and **Fan** only.
2. **Not a fifth tower line** — but the reason on record is now the *wrong* one,
   and the right one is smaller than it looks. See §4.
3. **Neither should be built first**, because the shipped branches' MECHANICS
   were unverified by the winnability suite — neither oracle plan buys tier 4 —
   which is exactly how Sticky Bomb spent months promising goo it never left.
   Going 8 → 12 would have made that hole 50% worse. **§5 was the real
   deliverable, and Phase A of it now ships with this document**: six branches
   gained an identity guardrail (Dino's `blocks: 2` and RC's `stun` already had
   one), each mutation-proven.
4. The order is therefore: **verify what exists (done) → make the UI able to
   show a third → then add content.** Each is independently shippable (§7).

---

## 1. What actually ships today (measured, not remembered)

| Line | T3 | Branch **a** | Branch **b** | Axis the pair spans |
|---|---|---|---|---|
| 🎯 **Dart** (single-shot, **hits air**) | Foam Gatling 24 dmg / 0.7s / 3.0 | **Sniper Scope** 260🪙 · 85 dmg / 2.2s / 5.5 · crit 15%×2.5 | **Minigun** 280🪙 · 9 dmg / 0.12s / 2.2 · spin-up 1.2 | damage **concentration** |
| 🧱 **Mortar** (splash, **no air**, dead zone 1.5) | Crate Cannon 58 / 2.8s / 4.0 · splash 1.6 | **Big Bertha** 320🪙 · 105 dmg · splash 2.2 | **Sticky Bomb** 300🪙 · 60 dmg · splash 1.7 · goo (slow 0.4, 2.5s) | blast **size vs ground control** |
| 🧊 **Fan** (slows, **hits air**, zap) | Freezer Blast slow .5 · aura 2.4 · zap 14 dps | **Blizzard Cone** 300🪙 · slow .6 · aura 2.6 · brittle 3s | **Static Zap** 320🪙 · slow .4 · chain 30×4, decay .75 | slow **depth vs damage spread** |
| 🪖 **Camp** (blocks, **no air**) | Elite Platoon 3× hp120 / 13 dmg | **Dino Squad** 300🪙 · 2× hp260 · **blocks 2** | **RC Racers** 280🪙 · 4× hp70 · stun .5 · respawn 4 | blocker **quality vs quantity** |

Two structural facts constrain everything below:

- **Exactly two lines reach air** (Dart, Fan). That is a truth-table guardrail
  (`AUDIT mono builds` and the derived guide truth) — giving Mortar or Camp air
  through a branch would go red, correctly.
- **Armor is the most common trait in the game** — 14 of 51 enemies carry it,
  against 6 with a shield and 5 fliers. It halves `bonk`, which is *every*
  non-Fan damage source. There is currently **no way to remove it**; you either
  bring the Fan (whose `zap` ignores it) or out-damage it.

### The overkill measurement (why "more damage" is not the axis)

Non-boss roster: **42 bodies, median hp 34, min 16, max 400.**

| | dmg | shots/s | one-shots |
|---|---|---|---|
| Dart T3 | 24 | **1.43** | 0 / 42 |
| Sniper Scope | 85 | 0.45 | **30 / 42 (71%)** |
| Minigun | 9 | 8.33 | 0 / 42 |

Sniper advertises 47.3 paper dps against T3's 34.3 and **loses** L22/L26/L31
outright plus 5 of 9 boss finales when you convert a whole board. That result is
already recorded in CLAUDE.md and is why every branch now states its ROLE at the
point of choosing. **The lesson for this document: a new branch must not be
another point on the damage axis.** The damage axis is full and it is a trap.

---

## 2. Duplication blocklist

Every idea below was checked against the 5 shipped abilities and the 35 meta
nodes. These mechanics are **taken** — a branch doing one of them is a rename:

| Mechanic | Already owned by |
|---|---|
| Lingering slow puddle | 🍯 Sticky Floor **and** Sticky Bomb's goo |
| Fire-rate burst on one tower | ⚡ Overclock (`boostOf`) |
| Focus fire / target priority | 📌 Call the Shot — **measured 0.00 lives** |
| Chain-lightning +1 jump | 🌀 Ricochet (meta) |
| Slow duration | ❄️ Deep Freeze (meta) |
| Mortar dead-zone shrink | 🎯 Close Quarters (meta) |
| Crit chance | 🍀 Lucky Darts (meta) + Sniper |
| Soldier respawn speed | 🐕 Guard Dog (meta) |
| Flat +damage % | 🗡️ Sharp Darts I/II (meta) |
| Reveal hidden bodies | 🧨 Toy Box Drop's `reveal` |
| Blast radius on tap-powers | 💥 Wider Blast (meta) |

**Targeting priority is the important one.** `PLAN_ENEMY_ESCORT.md §6` measured
it at **+0.00 lives on normal AND heroic** even when played perfectly and for
free. Any branch whose identity is "shoots the right thing" is worth nothing.

---

## 3. Per-line recommendation

### 🎯 Dart — **YES, build a third.** `c: Rust Ray` (or Paint Stripper)

- **Role line:** *"strips the armour off whatever it hits — everyone else hits
  harder"*
- **Fields:** `{ cost: 270, dmg: 14, dmgType: "bonk", rate: 0.5, range: 3.2,
  strip: { amount: 0.5, seconds: 3 } }` — low damage, fast, its output is the
  debuff, not the hit.
- **Engine seam: ONE line.** `computeHit` applies armor at exactly one place
  (`td-logic.js:72`, `if (dmgType === "bonk") d *= (1 - (enemy.armor || 0))`).
  A `e.stripUntil` / `e.stripAmount` pair read there covers dart, mortar, soldier
  melee and abilities simultaneously — the Oil Drum template (**one write, zero
  new read sites**).
- **Why it is a real axis:** it is the first tower that makes *other towers*
  better, and it answers the single most common enemy trait. It is not a damage
  point, so it cannot be judged on paper dps.
- **Write-owner warning:** give it its OWN field. Do not reuse `e.armor` — a
  second writer with a different policy is exactly the `hurriedMult` bug (the
  weaker writer clobbered the stronger). Strongest-wins through one
  `applyStrip(e, amount, seconds)`, matching `applySlow` / `applyHurry`.

### 🧊 Fan — **YES, build a third.** `c: Desk Fan` (support aura)

- **Role line:** *"blows on your own towers — everything nearby fires faster and
  further"*
- **Fields:** `{ cost: 300, slow: 0.2, auraRange: 2.4, zapDps: 4,
  support: { rate: 1.25, range: 1.15 } }` — it barely fights; it is a buff pylon.
- **Engine seam: TWO existing single-read wrappers.** `boostOf(t)` (:397) and
  `reachOf(t, r)` (:411) are already the sole readers of fire-rate and range
  multipliers, and `boostOf` **already multiplies two independent sources**
  (`over * padBoost.rate`). A support term becomes a third factor —
  `over * padRate * supportRate` — which **cannot clobber ⚡ Overclock or a ⚡
  power pad**, because multiplication composes where assignment collides.
- **Why it is a real axis:** no tower currently affects another tower. It makes
  pad adjacency matter for the first time (the maps already have pairwise ≥1.4
  cell spacing, so "which pad" becomes a decision), and it is the only proposed
  branch that would make a *wide* build interesting — CLAUDE.md records that
  breadth is currently a valid-but-flat choice.
- **Balance caution:** a rate buff on a whole board is the strongest thing in
  this document. It must be dosed by measurement, and it is the one candidate
  that could plausibly flip `AUDIT mono builds`.

### 🧱 Mortar — **NO third branch, and the reason is informative**

Its two branches already span its entire axis (blast size vs ground control),
and every third idea fails:

| Idea | Why not |
|---|---|
| Anti-air mortar | Breaks the guardrailed "exactly two lines reach air" truth |
| Cluster shell | Splash with extra steps — same axis as Big Bertha |
| Damaging puddle | The `zones[].dmg > 1` "spotlight" was **built and CUT** — it flips `AUDIT mono builds` |
| Longer range | Not an identity; a stat |

**This is the finding that answers the owner's framing directly:** "3 ultimates
per tower" is not uniformly available. Shipping a filler mortar branch would put
a fourth unverified branch on the least-verifiable line.

### 🪖 Camp — **NO third branch**

Quality-vs-quantity is the whole axis, and the obvious third (ranged soldiers)
gives Camp air access and goes red on the same truth table. A "medic camp" is
🐕 Guard Dog. A support camp is the Desk Fan's job done worse.

**Note the asymmetry is honest, not a compromise:** the lines are already
asymmetric (Mortar has a dead zone and no air, Camp does not shoot). *"Each line
has as many ultimates as it has real axes"* is a defensible design statement;
*"every line has three"* would require inventing two.

---

## 4. The fifth-line question

CLAUDE.md records a 5th line as **NO**, with this reason: *"neither oracle plan
would buy one, so it would ship provably untested as a feature."*

**That reason is true — and it applies equally to a third branch.** It is not an
argument for branches over lines; it is an argument for §5 before either.

The real cost difference, measured:

| | 3rd branch (×2 lines) | 5th line |
|---|---|---|
| Build menu | free | **free** — derives from `Object.keys(DATA.TOWERS)`, wrapping 2-col grid, self-proving guardrail |
| Engine `branch()` | **free** — already `def.branches[choice]`, a `"c"` key needs zero engine change | new `kind`, new firing path |
| Tower panel UI | 2 template lines + 1 `dataset.b` read (§6) | free |
| Art | 2 new branch silhouettes | **3 tiers + 2 branches = 5 sprites**, each ≥0.33 distinct from all four existing lines (current worst pair 0.402 — thin) |
| `HOW_LINE` damage tally | free (inherits its line) | new entry or the run summary lies |
| Balance | 2 doses | a whole new strategy axis |

A fifth line is roughly **5× the work** and lands the same *"more ultimate
choices"* feeling as two third-branches. **Recommend against**, on cost, not on
principle — and note the recorded blocker ("it must not ALSO need a code hunt to
become buyable") is already cleared: the build menu derives.

---

## 5. THE TESTING PROBLEM — the real deliverable

**Every one of the 8 shipped tier-4 branches is unverified by the winnability
suite.** Both oracle plans (DART, MIXED) stop at tier 3 by design. What exists
today is only:

- `TD2 branches` — exclusivity, tier-3 gating, pricing, Sniper crit determinism,
  Minigun spin-up.
- The no-DPS-downgrade table and the overkill role-text law.
- Pixel-hash silhouette distinctness.

**Nothing drives a branch's declared mechanic.** That is precisely the gap that
let Sticky Bomb ship for months whose *"the goo it leaves slows whatever walks
in"* existed only as a sentence: the code slowed bodies caught in the blast at
the instant of detonation, nothing lingered, nothing could walk in, and there was
nothing on the ground to draw. Adding four more branches without closing this is
adding four more sentences.

### 5a. Branch identity guardrails — ✅ **BUILT** (Phase A, `td-logic.test.js`)

One test per branch, driving its **declared mechanic through its own engine
seam**, in the style of the `zapResist` proof (fire each `how` at one pinned
body and read the numbers — no time-to-kill, no confounds). **Correction to the
first draft of this document: it is six tests, not eight.** Dino Squad's
`blocks: 2` and RC Racers' `stun` are already driven by `TD2 Army Guys`, and a
near-duplicate is noise, not coverage.

| Branch | The claim | How it is proven | Mutation that turns it red |
|---|---|---|---|
| Sniper Scope | one big far shot | first-shot **distance** (shot *count* is confounded by rate; distance is pure range). Measured 6.88 vs T3's 9.79 | `range: 5.5 → 3.0` |
| Minigun | spins up **and resets** | dart damage over a wave reads `3,4,5,6,7,8,9,9,3,4,…` — ramp to full, then back to the floor on a real retarget | delete `else t.heat = s.heatFloor` |
| Big Bertha | wider blast | bodies caught by the **first** shell, against **knights that survive it**, so the count is geometry. 11 vs Crate Cannon's 8 | `splash: 2.2 → 1.6` |
| **Sticky Bomb** | goo **lingers** | on a mortar-only board nothing else can slow anything, so a body **newly slowed on a tick with no detonation** walked into goo already on the ground. 10 such. Crate and Bertha: 0 puddles, 0 slows | remove the `state.puddles.push` (i.e. the shipped defect) |
| Blizzard Cone | brittle | the branch marks bodies brittle; T3 **and** Static Zap do not | delete the `s.brittle` mark |
| Static Zap | arc **decays** | one firing reads `30, 23, 17, 13` = `30 × 0.75ⁿ`. Strike count and jump radius were already covered; the per-link **value** was not | `decay: 0.75 → 1.0`, and separately applying decay once (`30,23,23,23`) |

All six were run against each mutation and went red. Note the documented trap
that shaped test 6: **the two clauses catch different mutations and both are
needed** — the per-link check pins the arc's shape but goes vacuous at
`decay: 1.0`, because the expectation flattens with the data.

**Three fixture bugs were hit writing these, each of which first presented as a
product defect** — the "suspect the FIXTURE before the content" law, three times
in one sitting, and all three are recorded in the test block's header so the
next author does not re-derive them:

1. `state.enemies` is **compacted on death**, so a before/after hp diff cannot
   see a kill — a one-shotting shell scored "0 bodies hit". Count `die` events
   plus surviving hp drops.
2. An enemy carries `dist` along its lane, **not `x`/`y`**. A probe reading
   `x`/`y` reads `undefined`, every body scores as outside the puddle, and the
   goo claim fails on a perfectly working engine.
3. A blast-width count **against socks measures nothing** — a tier-3 shell
   already one-shots every sock in its radius and both blasts saturate (Crate 9,
   Bertha 9, Sticky 11: not even ordered by radius). Use a body that survives.

**This was worth building whether or not any new branch is ever added.** It
retroactively verifies six shipped features nobody had ever driven, and it is
the RULE 7 obligation the Sticky Bomb fix left open.

### 5b. A branch OBSERVATION arm (Phase B — diagnostic only)

Add `--branch` to `tools/td-sim.js` measuring what each branch is *worth*, the
way 🦆 (0 lives) and 📌 (2.50×) were measured.

Three hard constraints, each from a recorded failure:

1. **Strict superset of the shipped oracle.** Build exactly as the oracle does,
   and spend on a branch *only* from surplus. The first cut of the overkill probe
   bought a 260🪙 branch whenever it could not afford a 70🪙 tower, starved
   placement, and the "stronger" build lost 17 lives on a level the oracle clears
   at 20/20 — which looked exactly like a finding.
2. **Diagnostic, never a tuning target.** `PLAYABILITY` stays untouched. Precedent
   exists and is explicit: the Full Fort reachability measurement used branches +
   Extra Hearts and is recorded as *"fine as a DIAGNOSTIC and must never become a
   tuning target."* The World-4 revert is what happens when that line is crossed.
3. **A pad ORDERING is part of the oracle.** A hand-typed "same four lines"
   plan with a different pad order reported L29 heroic 20/20 where the shipped
   oracle reports 8. Reuse `best()`; never re-type a plan.

---

## 6. The UI problem (Phase C)

The engine is already generic. The **panel** is not:

- `td-main.js:1032` / `:1035` hard-code `data-b="a"` and `data-b="b"`.
- `td-main.js:1067` reads `btn.dataset.b` — that part already generalises.
- `td-ui.js:436` (the Toybox Guide) **already** derives:
  `Object.keys(T[k].branches || {}).map(...)`. Copy that shape.

**Layout IS a blocker — measured, and it overturns the first draft of this
section**, which reasoned that a third button simply wraps and called it fine.
Driving the real tier-3 panel and cloning its branch card (shipped CSS, nothing
changed), across the viewports the fort is audited at:

| Viewport | 2 branches | 3 branches |
|---|---|---|
| 320×480 | 304×239 fits | 304×**350** — **overflows by 12px** |
| 320×568 | 304×239 fits | 304×**350** — **overflows by 20px** |
| 360×640 | 340×239 fits | 340×334 fits |
| 390×844 | 340×308 fits | 340×390 fits |
| 844×390 (landscape) | 340×266 fits | 340×**335** — **overflows by 33px** |

`.td-panel` is `flex-wrap: wrap; max-width: 320px` with child margins (never flex
`gap` — Safari 14.0), and `.td-branch` is `max-width: 40vw`, so at 320px two fit
one row (128 + 8 + 128 = 264) and the third takes a whole third row: **+111px**,
past the fold on both 320-wide phones and in landscape. So Phase C is not "derive
the buttons"; it needs a real answer, and there are three:

1. **Three across on one row** — `.td-branch` from `max-width: 40vw` to ~30vw
   (3 × 96 + 2 × 8 = 304 at 320px). Cheapest, but 96px is tight for a name, a
   price and a role line, and iOS renders emoji wider than headless Chromium —
   the trap that has already spilled the tower panel, the next-wave line and the
   ability strip's cost.
2. **Let the bubble scroll** — `max-height` + `overflow-y: auto` + `contain`
   (the shipped overscroll law). Safe, but a scrolling context menu on a pad is
   poor feel.
3. **A dedicated ultimate step** — tier 3's panel offers one "⭐ Ultimate"
   button that swaps the bubble to a three-card chooser. Most work, best feel,
   and it is the only option that leaves room for a role line long enough to
   carry the overkill warning the branches now depend on.

Whichever is chosen, the shipped clamp discipline applies: measure the widest
CHILD edge in the FIELD's own offset coordinates, never `vw` or
`documentElement.clientWidth`.

**Fixture note** (the recurring class, hit again here): the panel now **stays
open and re-renders after a purchase**, so a probe that clicks `.td-up` three
times lands its third click on a branch card and silently measures a tier-4
panel with no branch row at all. Drive the upgrades through
`__TD.script([["upgrade", 0], …])` and click only to open.

**Guardrail:** inject a fixture third branch at runtime and assert the panel
GROWS **and still fits at every audited viewport** — the self-proving shape the
build-menu guardrail already uses (*"saw 4 of 5"* on the old literal), plus the
bound this measurement shows is the one that actually bites.

**Guardrail:** inject a fixture third branch at runtime and assert the panel
GROWS — the exact self-proving shape the build-menu guardrail already uses
(*"saw 4 of 5"* on the old literal), so it cannot rot into an unfalsifiable
check.

---

## 7. Phased build plan (smallest valuable increment first)

| Phase | What | Ships alone? | Balance risk | Value if nothing after it lands |
|---|---|---|---|---|
| **A** ✅ | 6 branch identity guardrails (§5a) — **BUILT** | ✅ | **none** | **High** — verifies 6 shipped features nobody had ever driven |
| **B** | `tools/td-sim.js --branch` observation arm (§5b) | ✅ | none (diagnostic) | High — first numbers on what a branch is worth |
| **C** | Derive the panel's branch buttons **and re-fit the panel** — a third card overflows 320×480, 320×568 and landscape by 12-33px (§6, measured) | ✅ | none | Medium — removes the structural blocker, and it is bigger than the first draft assumed |
| **D** | 🎯 Dart `c` **Rust Ray** — armour strip | ✅ | **low** (one seam, answers the commonest trait) | High |
| **E** | 🧊 Fan `c` **Desk Fan** — support aura | ✅ | **medium** (board-wide rate buff) | High |

A and B are pure infrastructure. C is too, but the §6 measurement moves it from
"two template lines" to a real panel re-fit, which is a point in favour of
settling the design question (Dart+Fan, or nothing) before paying for it. D and E are
each a data block, one engine seam, one sprite, one identity guardrail and a
dose measurement. **Stop after C and the project is strictly better off**, which
is the test of a correctly-ordered plan.

---

## 8. What NOT to build

| | Why |
|---|---|
| A third branch on **Mortar** or **Camp** | No third axis exists; every candidate duplicates a shipped system or breaks the two-lines-reach-air truth |
| A **fifth tower line** | ~5× the cost of two third-branches for the same feeling; 5 sprites against a thin 0.402 distinctness margin |
| Any branch whose identity is **target priority** | Measured +0.00 lives, perfectly played and free (`PLAN_ENEMY_ESCORT §6`) |
| Any branch that is **more damage** | The damage axis is full; Sniper already proves paper dps points the wrong way (71% overkill) |
| A **damaging ground zone** | The `zones[].dmg > 1` spotlight was built and CUT — it flips `AUDIT mono builds` |
| A branch that **reuses a shared field** (`e.armor`, `hurriedMult`, `t.boostMult`) | Two writers with different policies is the recorded clobber bug; multiply, or own the field |
| Building **D or E before B** | A is done, so the debt is now "nobody has measured what a branch is WORTH" — 🦆 measured 0 lives and 📌 measured 2.50×, and only a sim tells those apart |
| Tuning any level **against a branch-buying solver** | The World-4 revert. Diagnostic only |

---

## 9. Open questions this document does not answer

- **Is the Desk Fan too strong?** A board-wide fire-rate buff is the only
  candidate here that could plausibly break `AUDIT mono builds`. Phase B must
  measure it before Phase E commits.
- **Does a third branch make the tier-4 choice *worse*?** Three options on a
  small panel, on a phone, mid-wave, is more reading. The role lines exist
  precisely because the numbers mislead; three roles is more to read than two.
  Worth a real-device look after Phase C.
- **Does anyone reach tier 4 often enough for this to matter?** CLAUDE.md
  records that a TALL build reaches tier 4 by wave 7-11 on six levels, while a
  WIDE build reaches it on 2 of 12. If most real play is wide, a third branch
  serves a minority — and the **Desk Fan is the one candidate that makes wide
  play better**, which may be the strongest argument for building E over D.
