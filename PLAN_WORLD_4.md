# World 4 (the Attic) + Kid-Mode Fort — build plan and measured findings

Status: **✅ SHIPPED** (on the second attempt) — this line read "NOT SHIPPED" for
several releases AFTER the world went live, which is the "a list that outlives
its contents" class and is why a future author must check `DATA.LEVELS` rather
than trust a plan's own header. All four attic levels are in the campaign
(L13 Dusty Rafters, L14 Moth Light, L15 The Old Trunk, L16 Tickmaster) and the
Tickmaster is a real boss.

The FIRST attempt was reverted rather than ship levels that fail the project's
own guardrails, and that revert is the valuable part of this document: never
tune against a solver stronger than the one in the suite. Everything below is
the measured record of that search.

**🧸 Kid Fort, the other half of this plan, was later RETIRED** (owner, 2026-08:
"we don't use it") and removed WHOLE — button, `kid` difficulty, the `noLose`
branch and the `body.td-kid` skin — so that a mode nothing can select could not
linger as dead content. Do not rebuild it from this document.

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

## Where it stands — SHIPPED

The three-way squeeze was solved on the second attempt: the Tickmaster came down
to 3200hp / 8 lives, which lands L16 inside the 5-17 window `PLAYABILITY` and
`AUDIT boss tension` jointly demand; the waves took a VANILLA backbone with at
most one special shape per wave (≤25% HP); L14/L15's lanes were lengthened (short
paths are harder — less tower exposure); and `night` was dropped from L14, being
untunable for a new world's mid level. All 16 levels are winnable on all three
adult ladders and losable by neglect, and the star ceiling now DERIVES from
`DATA.LEVELS.length * 3` (48, not a literal 36).

## Kid-mode fort — BUILT

Shipped as a `kid` difficulty carrying `noLose`, read at the ONE place a run can
be lost, so casual/normal/heroic stay genuinely losable (guardrail-tested both
ways). A kid run is marked `cheated`, so it can never write a star or earn a
badge. Inside `body.td-kid` the RULE 5 laws switch back on (every restyled
control ≥75px, now asserted in a browser on the real screen). The adult skin is
untouched.

---

# Backlog status (all items requested 2026-07 — now CLOSED)

## 1. CALL vs the power strip — FIXED
Three earlier attempts moved CALL and failed. The real answer was that no
floating position works: measured across all 20 maps × both orientations, every
one of 24 anchor × layout combinations for a 4-button strip buries at least 12
pad centres (the shipped left column buried 27), because pads hug the lanes
across the whole board and building is legal mid-wave. So the strip left the
battlefield: a real layout row under the field in portrait (which is
width-limited, so the ~150px below the canvas was dead space — the field does not
shrink at all) and an absolutely-positioned column in the landscape side gutter.
`resize()` now subtracts any in-flow sibling below the field generically. During
build the strip is inert rather than hidden, so the field never resizes at a
phase boundary. Kid Fort keeps a floating 2×2 block (its ≥75px buttons would eat
a third of Josh's field, and `noLose` makes a covered pad harmless). The audit
generalisation was redone and immediately earned its keep, catching L5's p11.

## 2. World 4 + Kid Fort adversarial pass — DONE, four real defects found
- The fort home grid was `TOTAL_PLANNED = 12`, so **L13-L16 had no card and were
  unreachable**. Two existing tests asserted `12 level cards` / `11 locked`, so
  the suite was pinning the bug; all three now derive from `DATA.LEVELS.length`.
- **The Tickmaster had no art** and rendered as a Sock Goblin (so did the Tin
  Plane). Both drawn properly; a generic pixel-hash guardrail now fails if any
  two enemy types render identically, which is how a missing branch shows up.
- `resize()` measured a hidden screen as 0 wide and rebuilt the field at its
  minimum cell, leaving it collapsed.
- `JonTD.route()` only un-hid its destination, so direct callers could leave both
  fort screens in flow — which triggered exactly that collapse.
Coverage added: the Tickmaster's phases forced band-by-band, the kid `noLose`
gate proven in both directions, the 🧸 button actually pressed in a browser, an
attic level opened/tapped/built for real, and screenshots in both orientations.
Every new guardrail was mutation-checked against the pre-fix code.

## 3. Haptics — SHIPPED as option (a), Android-only behind a capability check
`navigator.vibrate` is unsupported by Safari on iOS, so the code feature-checks
it, shares the 🔔 toggle, is gated by `prefers-reduced-motion`, and rides the same
`sfx()` call site as audio. On Josh's iPad it is a no-op by design, not by
accident.

## 4. More sound effects — SHIPPED
Six new cues (`ability`, `arm`, `cleared`, `phase`, `lowlives`, `tier`), all
mute-gated and routed through the one iOS-safe `JoshAudio.tone`. The boss `phase`
cue needed a new engine event — a boss escalating was previously silent.

## 5. Screen wake lock — SHIPPED, version-gated
Feature-checked (Safari 16.4+), re-acquired on `visibilitychange` only while a
battle is live, released in `stopLoop()`. A no-op on the iOS 14.2 floor, as
documented.
