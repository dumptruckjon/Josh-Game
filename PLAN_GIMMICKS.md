# 🎛️ PLAN — TD-16: Level Gimmicks

Closes the open item CLAUDE.md has carried since World 4: *"Level gimmicks stay
thin: `night` on L6, `conveyor` on L7 and L17, the mole tunnel, and that is all
across 20 levels."*

Written 2026-07 against the shipped state (`7237138`, 20 levels / 5 worlds).

---

## 1. What a gimmick has to be here

This engine has burned two gimmick ideas already, and both failures were the
same shape: a knob that moves *tower uptime* is untunable, because uptime is the
one thing gold cannot buy back.

- **`night`** (−15% Dart/Mortar reach) held L14 at heroic 0/3 across a 600→1500
  gold sweep. Dropped from World 4.
- **A conveyor at ×1.45** held L17's normal comfortably and made heroic
  unwinnable on *every* seed. Shipped at ×1.30, guardrail-capped at 1.35.

And the World-5 sweep (~180 configurations) established the boundary those
failures sit on: **normal difficulty and heroic winnability are separated by a
step, not a slope.** Any gimmick that meaningfully moves a tuned level's power
budget flips it out of band.

So the design rule for this phase:

> **A gimmick must be a DECISION, not a difficulty multiplier.** Its job is to
> make one board layout better than another — not to make the level harder.
> Anything that moves measured lives by more than ~2 is a re-tune, not a
> gimmick, and belongs in a content phase.

Four more constraints, each a scar:

1. **Data field read at ONE place** (RULE 7). If a mechanic needs a second
   read site, find the site both can share first.
2. **Headlessly provable.** A node sim must be able to drive it and read a
   number. A gimmick a sim can't see is a gimmick that ships dead — the Static's
   phases, the Vacuum King's suck, the Tickmaster's whole kit.
3. **Visible on the field.** An effect the player can't see is a gotcha. Every
   one of these gets renderer terrain or a marker.
4. **Re-sim every level it touches**, all three difficulties, ≥6 seeds, with the
   shipped best-of-two oracle. Never a stronger local solver.

---

## 2. The three gimmicks

### 2.1 🕳️ Mud Patch — `zones[].mult < 1`

A stretch of spilled slime / sand / oil-soaked rag where enemies **crawl**.

The conveyor already multiplies base speed over a path range, and the engine
does not care which side of 1.0 the multiplier is on — so this is **zero new
engine code**. It is the conveyor's mirror image: the conveyor is a stretch you
wish you could cover, the mud patch is a stretch you *want* to build around.

- **Engine:** none. `zones: [{ from, to, mult: 0.7 }]`.
- **Renderer:** a distinct terrain draw (dark sticky ground + bubbles) so it
  cannot be mistaken for a conveyor's chevrons.
- **Guardrail:** the zone-strength check becomes two-sided —
  `0.6 ≤ mult ≤ 1.35` — because a strong enough slow is as much a free win as a
  strong conveyor is a free loss.

### 2.2 ⚡ Power Pad — `pads[].boost = { range, rate }`

One socket per level that gives whatever is built on it a permanent buff.

This is the phase's headline **decision**: the pad is placed somewhere decent
but not obviously best, so "which line deserves it" is a real question — a Dart
wants the fire rate, a Mortar wants the reach, a Fan wants both and covers less.

- **Engine:** fire rate folds into `boostOf(t)`, already the ONE multiplier read
  at every cooldown-set site (so a future tower line inherits it free). Range
  needs a new `reachOf(t, r)` wrapper — and it must wrap **all five** range
  reads (dart acquire, dart sticky-keep, mortar, fan aura, fan zap), which is
  precisely the "grep every place a target is chosen OR kept" discipline.
- **Renderer:** the pad draws as a socket with a glow; a built tower keeps it.
- **Guardrail:** a headless sim proves a boosted tower both **fires faster** and
  **reaches further** than the identical tower on a plain pad, and that the
  buff survives an upgrade and a tier-4 branch.

### 2.3 🚪 Side Door — `groups[].at`

A wave group that walks in **partway down the lane**, bypassing everything you
built at the entrance.

This is the only one of the three that is a genuine threat SHAPE, and the World-5
measurements say shape is the lever this engine responds to. It also directly
punishes the board every auto-solver builds (fill from pad 1 outward).

- **Engine:** `spawnEnemy` already takes a `dist` (split children and boss
  summons use it), so this is one field carried through the spawn queue.
- **Renderer:** a 🚪 marker on the lane at that distance during BUILD, so the
  player sees where they will come from before committing gold.
- **Guardrail:** a sim asserts a side-door group really enters past the marker
  and that a front-loaded board leaks it while a spread board does not.

---

## 3. Distribution

Goal: **every world has gimmick levels, and no level that gains a demand goes
without a gift**, so tuned bands hold.

| World | Level | Gains |
|---|---|---|
| 1 Bedroom | L2 Closet Door | 🕳️ mud patch (the gentle introduction) |
| 1 Bedroom | L3 Toy Shelf Run | ⚡ power pad |
| 2 Backyard | L5 Sandbox Siege | 🕳️ mud + ⚡ pad |
| 2 Backyard | L8 Vacuum King | 🚪 side door + ⚡ pad |
| 3 Toy Store | L9 Aisle Nine | ⚡ power pad |
| 3 Toy Store | L11 Checkout Chaos | 🚪 side door + 🕳️ mud |
| 4 Attic | L13 Dusty Rafters | 🕳️ mud patch |
| 4 Attic | L15 The Old Trunk | ⚡ power pad |
| 5 Garage | L18 The Workbench | ⚡ power pad |
| 5 Garage | L20 The Toolbox Titan | 🚪 side door |

That takes gimmick coverage from **3 of 20 levels to 12 of 20**, with all five
worlds represented and every mechanic appearing in more than one world.

---

## 4. Verification gates

Every shipped guardrail stays green, plus:

- `PLAYABILITY` — every level winnable on normal ≥5 lives, seeds 7/23/99
- `AUDIT heroic is a SLOPE` — every level winnable on heroic
- `AUDIT boss tension` — boss finales median ≤17 over 8 seeds
- `AUDIT: no level loses >5 lives in waves 1-3`
- pad geometry (a power pad is still a pad — same clearance laws)
- no level's measured normal margin moves by more than ~2 lives (the design rule)

New guardrails owed:

- zone strength is bounded on BOTH sides
- a boosted tower fires faster AND reaches further, at every tier
- a side-door group enters past its marker, and the marker is drawn
- gimmick coverage: every world has at least one, and the mechanics are not all
  concentrated in one world

---

## 5. Honest exits

| Risk | Exit |
|---|---|
| A gimmick moves a level out of its tuned band | drop it from that level, keep it where it measures flat — and record which levels refused it |
| The power pad's range buff turns out to need a 6th read site | that is the finding; fix it and write it down |
| Coverage lands below 12 levels | ship what measures clean and say which levels were left alone and why |

---

## 6. BUILT — what shipped, and what the measurements said

Status: **✅ SHIPPED.** Gimmick coverage **3 of 20 levels → 14 of 20**, all five
worlds represented, each mechanic in at least three worlds.

| World | Levels with a gimmick |
|---|---|
| 1 Bedroom | L1 🕳️ · L2 🚪 · L3 ⚡ (+ its lever) |
| 2 Backyard | L5 🚪 · L6 night · L7 🕳️ + conveyor (+ its lever) |
| 3 Toy Store | L9 ⚡ · L10 lever · L11 🚪 · L12 🕳️ |
| 4 Attic | L13 🚪 · L15 ⚡ |
| 5 Garage | L17 conveyor · L18 ⚡ + 🚪 · L19 lever · L20 🕳️ |

Every level still winnable on normal (≥5 lives) and heroic, and losable by
neglect, across the seed sets the shipped audits use.

### 6.1 What each gimmick is actually worth

Measured as a delta against the pre-phase baseline (best-of-two oracle, 4 seeds):

| Gimmick | Effect on normal | Effect on heroic | Notes |
|---|---|---|---|
| ⚡ Power Pad (1.18 range / 1.15 rate) | 0 to +2 | +1 to +4 | first cut at 1.3/1.25 was worth **+3 normal, +6 heroic** on L15 — far too strong for a "decision" |
| 🕳️ Mud Patch (×0.75, 6 cells) | 0 to +1 | +1 to +5 | biggest on levels whose lane is already tight |
| 🚪 Side Door (halfway, 1-3 waves) | −1 to −5 | −1 to −7 | **scales with map length and pad count** — near-zero on L2, −5 on L13 |

The door's variance is the headline: the *same* mechanic is a rounding error on
one map and a re-tune on another. It has to be dosed per level, by measurement.

### 6.2 Findings (each now guardrail-locked)

1. **Zones must never overlap.** The engine's zone loop `break`s on the first
   match, so where two zones overlap **array order silently decides** which
   multiplier applies. L7's first mud placement (16-22) overlapped its conveyor
   (20-25) and, being first in the array, cancelled two cells of the strip:
   heroic went 8 → 18 lives with nothing else changed. Guardrail asserts every
   level's zone table is disjoint.
2. **The zone bound is two-sided now.** A mud patch is the conveyor's data field
   mirrored, and a strong enough slow is as much a free win as a strong conveyor
   is a free loss: `0.6 ≤ mult ≤ 1.35`.
3. **A mud patch disproportionately rewards a DART SWARM.** L5's mud flipped the
   shipped "no single plan clears heroic" property — dart-only went from losing
   L5 to winning it with 12-14 lives, while the door alone left the property
   exactly intact. More time in range compounds across many small guns, so a
   slow zone favours breadth over burst. L5's mud was removed rather than
   re-pointing the guardrail at a different level.
4. **A range buff must reach all FIVE range reads** — dart acquire, dart
   sticky-KEEP, mortar, fan aura, fan zap. One `reachOf(t, r)` wrapper; the
   "grep every place a target is chosen OR kept" discipline applied to distance.

### 6.3 The one deliberate exception

**L13 Dusty Rafters** moved −5 normal / −7 heroic, outside this phase's own ±2
design rule. It is kept, and the reason is recorded rather than waved through:
L13 was the **only level in the game that finished 20/20/20/20 on normal** — a
flat maximum on every seed, i.e. a formality. It now finishes at a median 15,
and across **12 heroic seeds it loses none** (5,6,5,4,4,4,6,4,6,4,8,3), which
puts it in the same band as L4/L12/L16 (5) and above L10 (2).

L11 was the counter-case and was *not* kept: it was already a real level
(18/17/17/18), so a door there was drift, not improvement — softened to a single
late wave, landing at −1.

### 6.4 Not done

- **A dark/fog zone** (localised `night`) was designed and dropped before
  implementation: a reach penalty is the one knob this engine has twice proven
  untunable, and a localised version is the same knob with a smaller radius.
- **Destructible obstacles** and **timed gates** were both rejected for needing
  a second engine read site — the phase's own rule 1.
