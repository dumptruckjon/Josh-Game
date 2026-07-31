# 🌫️ PLAN: the decision-enemy — and the instrument that can measure one

Status: **Phase 1 BUILT — and it CUT phases 2-5.** The decision-aware oracle
exists (`tools/td-sim.js --priority`), it is calibrated, and it measured the
proposed enemy's entire value proposition at **zero**. 🌫️ Dust Bunny is not
built and should not be; §6 is the report the plan's own kill criterion demanded.

Read §1 for the constraint set and **§6 for the result** — §§2-4 are preserved as
the design that was refuted, not as a backlog.

---

## §0 — Why this plan exists

`CLAUDE.md` records that the fort's roster has run out of *number* axes. The
resist matrix is full and its last three entries measured at roughly **zero
lives**; bigger HP piles are refuted six times over; a bypass shape is refuted;
`hitCap` is a line-keyed HP multiplier wearing a hat. The one axis left is the
one 🛢️ Oil Drum opened: **change a DECISION, not a number.**

But the Oil Drum also exposed the problem with that axis. It shipped
**outcome-neutral on the shipped oracle**, and the recorded reason is not that
the mechanic is weak — it is that *the auto-solver has no positional agency*. It
builds, it fires, and it can never choose to break a drum early. A sock crossing
the slick really does cover 1.45× the ground; no gate we own can see it.

So a second decision-enemy built against the same blind oracle would be a second
unmeasurable feature. **The instrument comes first.**

---

## §1 — The constraint set (do not re-litigate these)

| Axis | Verdict | Where measured |
|---|---|---|
| A new **resist** | matrix full; 🦆 `zapResist` **0 lives**, `plated` **0**, 🥫 shield cut | CLAUDE.md learnings |
| Bigger **HP piles** | threshold domination, reproduced **6×** | Worlds 5, 6, 9 sweeps |
| **Bypass / coverage-gap** | Digger Mole **0 lives**; kills 73% front-loaded, DPS is not | difficulty audit |
| **hitCap** | equals a line-keyed HP multiplier | dead-ends list |
| **Backbone stat shape** | refuted — normal never moved once | `--swap`, 3 dirs × 5 levels |
| **Destructible obstacle** | consumed in wave 1-2 at every authorable hp | 🧱 barricade, built then cut |

Anything proposed must therefore: **not be a resist**, **not be an HP pile**,
route through an existing single-owner seam, produce a derived guide trait line,
be reachable by `AUDIT roster`, and be dosed HP-preservingly so the ±25% budget
contract is untouched.

---

## §2 — Phase 1 (BUILT): the decision-aware oracle

`node tools/td-sim.js <levels> --priority`

The shipped oracle's build loop, unchanged, plus one thing: it spends 📌 **Call
the Shot** on the body that matters. 📌 is the right lever because `markId`
already overrides every targeting mode through the ONE `pickByMode` plus the
dart's sticky-KEEP, so "a player who prioritises" needs no new engine support.

It is honest by construction — it pays 📌's real price (70 gold, 2 ⚙️, a 24s
cooldown, wave-only), so it cannot out-earn the blind oracle for free.

**The measurement is the GAP**, not the absolute: a decision-mechanic is worth
`priority-aware lives − priority-blind lives`. That number is the thing a
guardrail can pin.

### What Phase 1 measured

See §6. The headline is recorded there rather than here so the number cannot
drift from the run that produced it.

---

## §3 — Phase 2 (designed): 🌫️ Dust Bunny, an escort that hides its group

While it lives, enemies within `escort.r` cells are **untargetable**. Kill it and
the group is exposed.

Why this shape and not another:

- **Zero new read sites.** One clause inside `isHidden`, the gate already
  enforced at all 14 acquisition / sticky-keep / splash / chain / melee / puddle
  / ability paths. Compare 🛢️, which needed a write site *and* surfaced a
  two-writer bug.
- **It is not a bypass.** The mole measured 0 because a full board kills it at
  the ends regardless. The Bunny has an **off switch the player controls**, so
  its cost scales with how long *you* take to prioritise it — a skill axis, which
  is exactly what the constraint set says is left.
- **It gives 📌 a purpose.** Measured at 2.50× but with no dedicated reason to
  exist. Here the counter is a power already in the box.
- **It is legible.** "Shoot the fog." One `enemyTraits` line and the Toybox
  Guide documents it automatically, so `FIELD_TRAIT` forces the entry.

### Two implementation laws, non-negotiable

1. **A Bunny may never hide a Bunny, or itself.** A pair would be mutually
   immortal. Explicit, and guardrailed.
2. **Write pass, not a lookup.** A naive `isHidden` scan is O(n²) per tick across
   14 call sites — at L24's 125-enemy peak that is real cost against a measured
   16.7 ms budget. Use the `hurryTick` shape: one pass per tick sets
   `e.escortedUntil`, and `isHidden` reads the flag. This is also the
   `applyHurry` lesson: one write site, one read site.

### Data shape

```js
bunny: { name: "Dust Bunny", icon: "🌫️", hp: …, speed: …,
         escort: { r: 1.6 } }     // hides OTHERS within r; never itself, never another escort
```

---

## §4 — Phases 3-5 (designed)

| Phase | Work | Gate |
|---|---|---|
| **3** | Art + guide: haze render, derived `enemyTraits` line | near-twin + silhouette + per-tier pixel hashes; emoji ≤ 13.0 with VS16 |
| **4** | Dose HP-preservingly into World 4+ late waves | ±25% budget contract; ≥70% backbone; ≤1 special ≤25%; every level winnable on all three difficulties AND losable by neglect |
| **5** | Measure worth with the Phase-1 instrument | the priority-gap, 8 seeds; a guardrail pins it |

---

## §5 — Kill criteria (stated up front)

The 🧱 barricade and 🥫 Pantry Can discipline: **decide in advance what refutes
this, and record the refutation rather than shipping around it.**

- If Phase 1 shows the Oil Drum is *still* worth ~0 to a priority player, the
  whole decision axis is suspect. **Stop and report** — do not build the Bunny on
  a hope.
- If Phase 5 shows the Bunny's priority-gap is under ~2 lives, **cut it** and
  write down the number.
- If dosing it cannot satisfy §4's gates at any level, **cut it**.

A world with no new mechanic is a legitimate outcome. An unrecorded one is the
defect.

---

## §6 — Phase 1 results — **the kill criterion FIRED. Do not build the Bunny.**

### The headline

**Targeting priority — applied perfectly, for free, on the most focus-worthy body
in the entire roster — moves the outcome by exactly 0.00 lives.**

| Focus target | Levels | normal | heroic |
|---|---|---|---|
| 🔧 Junk Healer (*mends its allies — the textbook focus target*) | L4 | **+0.00** | **+0.00** |
| 🛢️ Oil Drum | L17, L34, L36 | **+0.00** | **−0.08** |

Both rows are `focus − blind`, with 📌's price **refunded** (`FREE=1`) and marks
restricted to bodies a gun can actually reach. There is no cost excuse and no
competence excuse left in the fixture.

### Why — and it is not the reason §0 assumed

§0 blamed the blind oracle's lack of *positional agency*. That was too kind. The
real cause is **threshold domination, reproduced for a seventh time and now in
the ORDERING domain**: a board that holds a wave holds it regardless of firing
order, and a board that collapses collapses regardless. Ordering only pays at the
margin, and this engine has no margin.

That explains 🛢️ Oil Drum's neutrality far better than "the solver cannot choose"
— a solver that *can* choose, perfectly and for free, still gains nothing.

### Consequence

🌫️ **Dust Bunny is cut before it is built.** Its whole value proposition is "kill
this one first", and that is precisely the quantity measured at zero. Building it
would ship a third unmeasurable body after 🦆 `zapResist` (0 lives) and 🛢️
(outcome-neutral). §5 said stop and report; this is the report.

### Three method lessons, each of which produced a WRONG answer first

1. **A control arm that costs something is not a control.** The first metric was
   `focus − spend`, and it read **+2.00 on heroic** — which looked like the
   decision paying off. It was not: `focus − blind` was **0.00**, and the spend
   arm was simply *harmful* (56 marks × 70 gold diverted from building). The tool
   now prints both gaps and judges on `focus − blind`.
2. **Calibrate on a case that must succeed.** The null only became trustworthy
   after focusing the Junk Healer *also* returned 0.00. Without that arm, "the
   drum's decision is worth nothing" and "this instrument measures nothing" are
   indistinguishable.
3. **Verify the mechanism, then the fixture.** A direct probe showed the mark
   "did not redirect fire" — the instrument looked broken. It was not: the body
   was out of every tower's range, and `markId` correctly only overrides among
   in-range candidates. Re-run with an in-range body, fire redirected (target
   6 → 7). Suspect the fixture before the engine — again.

### What would still be worth trying

Not another targeting-priority body. If the decision axis is to be re-opened, it
has to be a decision that changes **what the board IS**, not what it shoots
first — the levers that measurably move this engine are all of that kind (a fork
lever re-routes the lane; a gimmick changes the ground; a threat shape changes
what must be countered). `tools/td-sim.js --priority` stays in the repo so the
next such claim can be refuted in one command instead of a phase.
