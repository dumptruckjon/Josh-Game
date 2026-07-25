# World 4 (the Attic) + Kid-Mode Fort — build plan and measured findings

Status: **NOT SHIPPED.** A full attempt was made and reverted rather than ship
levels that fail the project's own guardrails. Everything below is measured, so
the next session starts ahead instead of repeating the search.

## What was built and proven to work

- **4 levels** (L13 Dusty Rafters, L14 Moth Light, L15 The Old Trunk, L16
  Tickmaster), world `attic`, contiguous ids, badge 3.
- **A boss**, The Tickmaster ⏰ — pure DATA reusing the Static's already-tested
  `phases` machinery (`speedMult` at 66%, `+disable` and `spawn` at 33%). No new
  engine code, per the TD-4 boss lesson.
- **A generator + validator** (`scratch-gen-w4.js`): authors paths, places pads
  programmatically against every shipped geometry law (≥0.99 from the lane,
  ≥1.4 pairwise), generates waves to `base·1.18^n`, and refuses to emit unless
  every wave sits inside the ±25% band. It reported `validation ok`.
- **Star economy scaling**: `checkStarAchievements` must derive from
  `DATA.LEVELS.length * 3`, never a literal 36 — World 4 moves the ceiling to
  48⭐, and a literal makes Full Fort fire three worlds early.
- **A 4th endless arena** (`attic`), so each world's 4×3⭐ still unlocks one.

## The measured findings (this is the valuable part)

1. **Composition matters more than budget.** The first generator drew freely
   from the special roster; a wave of shielded + splash-resistant + self-healing
   enemies has no answer, and L14/L15 were unwinnable at EVERY combination of
   budget base and start gold. Fix: a VANILLA backbone carries most of the HP,
   with at most ONE special shape per wave (≤25% of HP) plus the air share.
   That single change took World 4 from 2/4 to 4/4 winnable.
2. **Short paths are HARDER.** L14/L15 originally had the shortest lanes (40/45
   vs 60/65) — less tower exposure per enemy. Lengthening them fixed L15
   outright. This is the TD-4 "a longer path makes a level easier" law.
3. **`night` is untunable for a new world's mid-level.** −15% tower reach kept
   L14 at heroic 0/3 across a 600→1500 gold sweep. Dropped.
4. **Tune against the SUITE's solver, not your own.** The verification script
   here bought tier-4 branches; `td-logic.test.js`'s PLAYABILITY solver does
   NOT. Levels that passed the local sim comfortably still failed the suite.
   Always tune against the weaker, shipped solver.
5. **A boss's HP is its own axis.** Halving L16's wave budget made its margin
   WORSE (3 → 2 lives), which proves the wave table was never the bottleneck —
   the Tickmaster was. The Bed Monster precedent (3200 → 2400) applies.

## Where it stands

At revert time: all 4 levels winnable on casual/normal/heroic by the LOCAL
solver, band ok, neglect losing everywhere, front-loading 9%, no mono-carry —
but `PLAYABILITY` (L16 margin < 5 lives) and `AUDIT heroic` (one attic level)
still failed against the suite's weaker solver, and softening the boss then
tripped `AUDIT boss tension`. That three-way squeeze is the remaining work: the
Tickmaster must be beatable by a branch-free build with ≥5 lives of margin while
still costing a sensible build more than 3 lives.

## Kid-mode fort — NOT STARTED

Scoped but not built. Design notes: it must satisfy RULE 5 (≥75px targets, no
fail state, no timers), which the fort deliberately violates as an adult space.
The likely shape is a separate mode flag — 3 short levels, auto-called waves,
lives that cannot reach zero, and kid-sized controls — not a difficulty tier.
