# 🧪 The mini-boss — BUILT AS AN INSTRUMENT, MEASURED, **NOT BUILT AS CONTENT**

**Status: REFUTED (third time), now with the mechanism.** Nothing shipped to
`td-data.js`, the engine, the roster or any wave table. What shipped is the
instrument (`tools/td-miniboss.js`) and this document, so the next author starts
from the measurement instead of the hope.

This was commissioned as a full content phase. The honest outcome of a content
phase is sometimes that the content must not exist, and this is one of those —
but the reason is now a *law about the engine* rather than another null result.

---

## 0. What was already refuted before this phase

CLAUDE.md records two prior attempts, both reverted:

1. **The HP-preserving SWAP** (🗑️ Wheelie Bin, 900hp, dosed at 35% into the last
   six waves of eight flat levels). Normal stayed **20/20 on all 8 seeds on every
   level**; heroic moved in *both* directions (L19 15→20 and L23 13→17 got
   EASIER). The mechanism: every body the swap replaces carries `lives: 1`, so
   trading ~97 small bodies for ~10 elites **removes ~97 potential leak-lives and
   adds 10**. Concentration cuts a level's leak capacity — the opposite of
   difficulty. To be leak-neutral a 900hp elite replacing 16hp Spare Keys would
   need ~56 lives.
2. **The ADDITIVE fat body** — "spread 0 across 8 seeds at every hp, with or
   without a jam/summon kit". A disguised constant.

This phase re-ran (2) rather than trusting it, because a large content pass built
on a mis-remembered null is exactly how World 4 got reverted.

## 1. The instrument

`tools/td-miniboss.js`. It uses the **shipped oracle verbatim** (best of
dart-mono / mixed, fill pads in order, upgrade cheapest-first, never buy a
tier-4 branch) — never a stronger solver. The dose is **ADDITIVE**: the body is
pushed onto a late wave as an extra group, so total wave HP grows. That is the
whole point, and it is why such a wave would need the budget exemption a `boss`
wave already has. *(No such `elite` flag exists in the shipped engine; the tool
sets one on its own clone. Nothing was added to the product.)*

It judges on the four rules the shipped threat-shape doser already enforces,
plus spread — **not** on "did the median move":

| rule | meaning |
| --- | --- |
| `moves3★` | the 3-star outcome must actually change (`stars3 < baseline`) |
| `keeps3★` | …and must not become unreachable (`stars3 > 0`) |
| `spread` | lives must not be identical on every seed — the disguised-constant test |
| `diversity` | the mixed plan must beat dart-only on MORE seeds than baseline |

## 2. Six shapes, all measured on 8 seeds

Baseline L26 "Up the Stairs": `[20,20,20,20,20,20,20,20]`, spread 0, 3★ 8/8.

| # | shape | result | verdict |
| --- | --- | --- | --- |
| 1 | additive toll elite (toll 3) | 2400+: `17×8`, spread **0**, 3★ **0/8** | constant, and erases 3★ |
| 2 | split into 3 plain elites | 600–1100hp each: `20×8` — all die | no effect at all |
| 3 | single **heal** elite | 2400–3600: `19×8`, spread **0** | constant at a different offset |
| 4 | **spawn** kit | 2400+: `18×8`, spread **0** | constant |
| 5 | **hurry** aura | 2400: spread 2, but 3★ stays 8/8 | doesn't move the star outcome |
| 6 | 3 × mid-weight **heal** elites | L26 `17×8` spread 0; L22 spread 4 but 3★ **0/8** | constant / 3★-eraser |

**Shape 6 is the decisive one: 400hp, 600hp and 800hp give byte-identical
results on both levels.** The hp is not a knob — it saturates.

### The transition band exists, and is far too narrow to design with

The record says a single fat body is a constant. That is *almost* right, and the
refinement matters. Sweeping **into** the cliff (the L8 lesson) on L26:

```
2100 →  20,20,20,20,20,20,20,20   spread 0   3★ 8/8
2200 →  17,17,20,17,17,17,17,17   spread 3   3★ 1/8    <-- the whole band
2300 →  17,17,17,17,17,17,17,17   spread 0   3★ 0/8
```

So the graded band is **~100hp of ~2200 (4.5%)**, it is weighted **7:1** toward
one outcome, and inside it 3★ has already collapsed from 8/8 to 1/8. That is not
a graded fight; it is a coin flip that also removes the reward.

## 3. THE LAW (this is the deliverable)

> **In this engine a SINGLE body is deterministic, so it can only ever charge a
> FIXED TOLL. Variance comes from MANY MARGINAL AGENTS, not from one big one.**

The board's damage output and the body's transit are both deterministic, so one
elite either dies before the exit or it does not — a step function, with a ~4.5%
transition band where the deterministic outcome happens to flip. Every kit tried
(toll, heal, spawn, hurry) merely moves *which* constant it lands on.

This explains, rather than merely restates, why the one lever that DOES work
works: the shipped healer doses are **3–5 small (85hp) healers mixed into the
crowd**, and they grade with spread 4–5 because many small agents die at
different times under seed jitter and their effects compound differently. Scale
the same mechanic up into one big healer and the variance disappears.

It also explains why the shipped bosses grade at all: they are hand-tuned to sit
*in* their own narrow band (L8's is ~200hp wide at ~7500). That is a per-level
authoring act for nine finales, not a reusable content pattern.

## 4. Why there is nothing left to dose anyway

`SPREAD=1 node tools/td-threat.js` (8 seeds, all 36 levels) derives the levels
that ask no question — spread ≤ 1 and median ≥ 18:

```
1, 2, 5, 7*, 14, 17, 22, 23*, 26, 27*, 30, 31*, 35*      (* = carries a lever)
```

Every non-lever entry already has a recorded, measured reason:

- **L1, L2** — World 1's tutorial, flat by design.
- **L5** — PINNED: `AUDIT mono builds` asserts its heroic behaviour.
- **L14** — dart-favouring; its one star-passing dose buys **0/8** diversity.
- **L17** — its candidates were two heroic losses and a no-op.
- **L22** — no safe dose anywhere in the (wave × dose) grid.
- **L26** — every candidate passing the 4-seed screen FAILED at 8.
- **L30** — dose shipped; its value was always diversity, never normal lives.

So the threat-shape doser is exhausted on the flat set, and the mini-boss was the
remaining hope. It is now closed too.

## 5. Do not build

- ❌ A mini-boss body, in any of the six shapes above.
- ❌ An `elite` budget exemption for a mid-level wave (nothing needs it).
- ❌ Another hp sweep. The hp is not a knob; shapes 3, 4 and 6 saturate, and
  shape 1's usable band is 4.5% wide and erases 3★ inside it.

## 5b. ADDENDUM — the finale lever was tried too, and it is also closed

§6 below originally proposed a FINALE as the one remaining honest lever ("a boss
is additive, budget-exempt and hand-tuned into its own band"). That was proposed
without checking whether it was structurally available. It is not, and when the
underlying idea was measured anyway it failed for the same reason as everything
else. Three findings, all new:

**(a) A boss on a flat level is STRUCTURALLY FORBIDDEN.** `TD structure` asserts

```js
assert.deepEqual(bossLevels, worlds.map((w, i) => (i + 1) * 4),
                 "a boss headlines each world finale");
```

so boss levels must be exactly L4, L8, … L36 — one per world, on its last level.
Giving a flat mid-world level a boss wave breaks that contract, and the contract
is load-bearing (the unlock ladder, the endless gate and the star ceiling all
assume worlds of four ending on a boss). A tenth world is the only structurally
legal home for a new finale.

**(b) A near-constant finale cannot be de-quantized by boss hp.** Five of the
nine finales are near-constants by the spread scan — L4 (spread 1), L12, L20,
L24, L32 (spread 2) — which is the same defect as a flat level. Sweeping the Bed
Monster (L4) on 8 seeds:

```
1200-1680  ->  20,19,20,19,19,20,19,20     the boss always DIES
1700-3400  ->  14,13,14,13,13,14,13,14     the boss always LEAKS
```

Byte-identical across 2400-3400, so the shipped 2400 is nowhere near a band. The
whole transition is **1680 -> 1700: a 20hp window, 1.2% wide** — and at no value
do the seeds disagree. **They all flip together.**

**(c) The law extends from elites to BOSSES.** L24 does vary by seed (12..14 at
every hp) — but the Moving Van itself leaks on every seed at every hp from 3000
to 5400; all of that variance is *pre-boss chip damage from the crowd*. So a
boss's own fate is deterministic too, exactly like an elite's. L8 was
de-quantizable only because its level happens to carry enough pre-boss variance
for the boss's fate to land differently across seeds; that is a property of the
LEVEL, not a knob on the boss.

So the difficulty axis is now closed from three independent directions: non-boss
elites are constants (§2), a boss on a flat level is forbidden (a), and a finale
cannot be graded by hp (b). In every case the reason is the same single law in
§3 — one body is deterministic, variance is always the crowd.

## 6. What would actually be next, if anything

Nothing on the difficulty axis is supported by the data. The measured levers all
point elsewhere:

1. **Accept it.** The curve peaking at World 3 was already raised with the owner
   and explicitly accepted; the flat levels are the same class of finding.
2. **Threat shape remains the ONLY lever that moved anything**, and it is spent
   on the current level set. A *new counter shape* (an enemy that demands a
   build change) would re-open it — but note the last three resist shapes each
   measured ~zero lives, and targeting priority measured **0.00 even played
   perfectly and free**.
3. ~~If a level must feel harder, the honest lever is a **finale**.~~ **Refuted
   in §5b** — forbidden on a flat level by the world-structure contract, and a
   finale cannot be graded by boss hp anyway. The only structurally legal home
   for a new finale is a TENTH WORLD (L37-40), which is a full world pass and
   would leave the star ceiling at 120⭐ against the 123⭐ tree (margin 3).
