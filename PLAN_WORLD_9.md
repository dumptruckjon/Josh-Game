# 🏭 PLAN — World 9: The Toy Works (L33-L36)

The campaign's last world, and the one that closes the loop: the step after
♻️ The Sort Line is the factory that melts you down and makes a **new toy** out
of you.

Written against `00fb5b2` (32 levels / 8 worlds, star tree 123⭐ / 35 nodes).

> **Status: DESIGNED + GEOMETRY VERIFIED. Not built.**
> Everything in §3 is output from `tools/td-map-search.js` and satisfies every
> shipped geometry law. Nothing here is in `td-data.js` yet, and it must land as
> **one commit** — a half-built world breaks the per-world guardrails (every
> world needs exactly one lever, an endless arena behind 4 levels, a boss
> finale, its own backbone) and would put unreachable content on the grid, which
> is the documented World-4 defect.

---

## 0. The blocker is CLEARED

The star ceiling derives as `LEVELS.length * 3`. A ninth world makes it **108⭐**,
and the shipped guardrail requires the tree to cost *more* than you can earn.

| | before | now |
|---|---|---|
| tree | 105⭐ / 30 nodes | **123⭐ / 35 nodes** |
| ceiling (32 levels) | 96 | 96 |
| ceiling (36 levels) | 108 → **RED** | 108 → margin **15⭐** |

Grown by BREADTH, per the standing rule (⏱️ Fast Hands · 🎯 Close Quarters ·
🔧 Handyman · 🔌 Warmed Up · 🛬 Soft Landing). No further tree work is owed.

---

## 1. What the world has to bring

Eight worlds already exist, so the bar for a ninth is **distinctness**, not
volume. Four things are non-negotiable because each is guardrail-locked:

1. **Its own backbone crowd.** `P2 identity` requires ≥1 ground shape no other
   world uses. Two new skins are needed (a 34hp/0.8 body and a 16hp/1.7 body),
   both inheriting `sortKey` from their ancestors so historical tick streams are
   untouched.
2. **Exactly one fork+lever.** The guardrail derives the world list from the data
   and fails a world with none — or with two.
3. **A boss finale**, wearing the crown (`bossCrown()`), with an hp-gated kit
   that a test can FORCE band-by-band (the Static/Tickmaster precedent — a
   solver may never drop it low enough to exercise the code).
4. **An endless arena**, unlocked behind all four levels at 3⭐.

Plus the floor: its own `pattern`/palette/`road` style and a `props` triple, or
the floor guardrail's lane-corridor hash will match another world's.

---

## 2. Content

### 2.1 Backbone skins

| slot | id | name | icon | ancestor | shape |
|---|---|---|---|---|---|
| 0 | `reject` | Reject Piece | 🧩 | `sock` | 34hp / 0.8 |
| 3 | `sprue` | Sprue Bit | 🪵 | `marble` | 16hp / 1.7 |

Slots 1 and 2 stay the shared `knight` / `blob`, as every world does.

**Colour law:** each must sit ≥20 from every other body in the World-9 wave pool
(`site.test.js`). The steel monoculture is already documented — pick warm
factory colours (moulded plastic orange, raw resin tan) rather than another
grey. Verify with the shipped scan before committing; do not eyeball it.

**Emoji law:** ≤ Emoji 13.0, and VS16 on anything text-default. 🧩 (U+1F9E9,
Emoji 11.0) and 🪵 (U+1FAB5, **Emoji 13.0** — allowed, but check the scan).

### 2.2 The boss — 🗜️ The Stamping Press

The finale of the campaign. Its kit reuses paths the engine already runs, per
the standing rule that a boss is a data change and not new engine code:

- `phases` with an hp-gated `disable` (jams a gun) — the Static's path
- `stomp` — the Bed Monster's path, thematically the press coming down
- `armor` + `shield` like the other three big bosses

**hp/toll are NOT chosen here.** They come from `--boss`, judged on **spread,
not median** (the L8 lesson): sweep until both outcomes genuinely occur, and
record it if no value grades the finale.

### 2.3 Floor

`pattern` industrial; a dark oiled-steel palette; `road` style a moving belt
(distinct from bedroom/toystore/garage's shared default, which shipped
identical three times); `spawnGlyph` 🏭; props triple from the eight primitives,
not the same triple as the Sort Line.

---

## 3. Geometry — SEARCHED, not eyeballed

Output of `W9=1 node tools/td-map-search.js`. Every layout satisfies all four
laws (≥0.99 from **every** lane · ≥1.4 pairwise · ≥1.9 from a lever · ≤BAND from
the lane it must cover). Re-run to reproduce.

```
L33 The Intake        12 pads · lane 63       · lane dist 1.4-2.0 · OK
L34 The Mould Room    13 pads · lane 58       · lane dist 1.4-2.0 · OK
L35 The Paint Line    15 pads · lanes 51/71   · lane dist 1.4-2.0 · OK   (fork, 1.39x)
L36 The Stamping Press 14 pads · lane 64      · lane dist 1.4-2.0 · OK
Toy Works arena       14 pads · lane 67       · lane dist 1.4-2.0 · OK   (BAND=2.2)
```

```js
// L33 The Intake — one long sweep, so a thin opening board still gets exposure
path: [[0,2],[19,2],[19,8],[4,8],[4,12],[23,12]]
pads: [ { id: "p1", cx: 3, cy: 7 }, { id: "p2", cx: 23, cy: 10 }, { id: "p3", cx: 14, cy: 0 }, { id: "p4", cx: 13, cy: 10 }, { id: "p5", cx: 20, cy: 1 }, { id: "p6", cx: 3, cy: 13 }, { id: "p7", cx: 0, cy: 0 }, { id: "p8", cx: 7, cy: 0 }, { id: "p9", cx: 9, cy: 6 }, { id: "p10", cx: 17, cy: 6 }, { id: "p11", cx: 20, cy: 9 }, { id: "p12", cx: 7, cy: 10 } ]

// L34 The Mould Room — a tight double-back; depth beats breadth here
path: [[0,11],[16,11],[16,5],[6,5],[6,1],[21,1],[21,6],[23,6]]
pads: [ { id: "p1", cx: 5, cy: 0 }, { id: "p2", cx: 23, cy: 8 }, { id: "p3", cx: 0, cy: 13 }, { id: "p4", cx: 12, cy: 13 }, { id: "p5", cx: 22, cy: 0 }, { id: "p6", cx: 13, cy: 3 }, { id: "p7", cx: 5, cy: 6 }, { id: "p8", cx: 17, cy: 12 }, { id: "p9", cx: 6, cy: 13 }, { id: "p10", cx: 17, cy: 4 }, { id: "p11", cx: 9, cy: 9 }, { id: "p12", cx: 14, cy: 8 }, { id: "p13", cx: 20, cy: 7 } ]

// L35 The Paint Line — the world's fork. Shared prefix to the lever at (7,7),
// so a throw reroutes in-flight enemies with no teleport.
path: [[0,7],[7,7],[7,2],[18,2],[18,9],[12,9],[12,13],[23,13]]
alt : [[0,7],[7,7],[7,12],[2,12],[2,2],[7,2],[18,2],[18,9],[12,9],[12,13],[23,13]]
lever: { cx: 7, cy: 7 }
pads: [ { id: "p1", cx: 11, cy: 8 }, { id: "p2", cx: 23, cy: 11 }, { id: "p3", cx: 19, cy: 1 }, { id: "p4", cx: 0, cy: 5 }, { id: "p5", cx: 7, cy: 0 }, { id: "p6", cx: 5, cy: 9 }, { id: "p7", cx: 13, cy: 0 }, { id: "p8", cx: 17, cy: 11 }, { id: "p9", cx: 10, cy: 13 }, { id: "p10", cx: 16, cy: 6 }, { id: "p11", cx: 5, cy: 4 }, { id: "p12", cx: 20, cy: 8 }, { id: "p13", cx: 10, cy: 4 }, { id: "p14", cx: 0, cy: 9 }, { id: "p15", cx: 19, cy: 10 } ]

// L36 The Stamping Press — long approach into a short, brutal run at the door
path: [[0,13],[14,13],[14,7],[3,7],[3,2],[20,2],[20,10],[23,10]]
pads: [ { id: "p1", cx: 2, cy: 1 }, { id: "p2", cx: 23, cy: 12 }, { id: "p3", cx: 16, cy: 0 }, { id: "p4", cx: 10, cy: 11 }, { id: "p5", cx: 0, cy: 11 }, { id: "p6", cx: 15, cy: 6 }, { id: "p7", cx: 22, cy: 4 }, { id: "p8", cx: 9, cy: 0 }, { id: "p9", cx: 16, cy: 13 }, { id: "p10", cx: 6, cy: 5 }, { id: "p11", cx: 2, cy: 8 }, { id: "p12", cx: 19, cy: 11 }, { id: "p13", cx: 21, cy: 1 }, { id: "p14", cx: 11, cy: 4 } ]

// Toy Works arena — pads searched at BAND=2.2: an arena starts you poor, so a
// tier-1 dart's short reach must touch the lane from wave 1.
path: [[0,2],[20,2],[20,7],[3,7],[3,12],[23,12]]
pads: [ { id: "p1", cx: 2, cy: 6 }, { id: "p2", cx: 23, cy: 10 }, { id: "p3", cx: 14, cy: 0 }, { id: "p4", cx: 12, cy: 10 }, { id: "p5", cx: 21, cy: 1 }, { id: "p6", cx: 2, cy: 13 }, { id: "p7", cx: 6, cy: 0 }, { id: "p8", cx: 0, cy: 0 }, { id: "p9", cx: 9, cy: 5 }, { id: "p10", cx: 17, cy: 5 }, { id: "p11", cx: 6, cy: 9 }, { id: "p12", cx: 17, cy: 10 }, { id: "p13", cx: 21, cy: 8 }, { id: "p14", cx: 13, cy: 4 } ]
```

**Still owed on geometry** (cheap, but they are separate laws): the CALL/power
block overlap audit across 8 viewports, and — because L35 has two lanes — every
per-lane law re-run against **both**, which is the defect that shipped L10's
pad p10 sitting 0.50 cells from its second lane.

---

## 4. Waves

Emit with `tools/td-wave-gen.js`, validate with `--check`, **write the data file
last**. World 9 joins the `RULED` set in both the tool and `W5 wave composition`
(the four newest worlds are already ruled; a ninth must not silently escape).

Contracts: ±25% of `budgetBase·1.18^n` · ≥70% backbone · ≤1 disruptive special
at ≤25% · valve ≤12% · plain openers · late air pressure (every world but the
bedroom).

Wave COUNT is itself a difficulty knob (each wave is 1.18× the last) — 14-15.

---

## 5. Verification gates

Nothing ships until every one of these is measured, not assumed:

- `PLAYABILITY` — winnable on normal by the shipped best-of-two oracle
- `AUDIT heroic is a SLOPE` — winnable on heroic, **≥8 seeds** (the shipped audit
  drives one seed; L30 lost on seed 5 while green)
- losable by NEGLECT on all three difficulties, including with the FULL tree
- `AUDIT boss tension` — finale median inside 5-17 across 8 seeds
- no level loses >5 lives in waves 1-3 (the gotcha class)
- `AUDIT roster` — both new skins are reachable from a real wave table
- `AUDIT mono builds` — the dart/mortar/fan/camp split must not flip
- enemy colour ≥20 within the world pool · emoji ≤13.0 + VS16 · floor+road hash
  distinct from all eight existing worlds · per-tier and per-enemy art hashes
- determinism: every existing level replays byte-identically (a new world must
  be a pure ADDITION — `sortKey` inheritance is what makes that true)

**Never tune against a stronger solver than the shipped one.** That is the
World-4 revert, and this session reproduced it in miniature: a hand-typed MIXED
plan with a different pad ORDERING reported L29 heroic 20/20 where the oracle
reports 8.

---

## 6. Honest exits

| Risk | Exit |
|---|---|
| A level will not land inside the heroic band | ship it at the value where every gate passes and RECORD the target as unreachable — the L23 precedent |
| The boss finale cannot be graded by hp | record it, like L16 and the Toolbox Titan; do not fake a band |
| A new skin measures as outcome-neutral | that is fine and expected — it is a flavour axis (the backbone stat-shape lever is measured NOT to be a difficulty axis) |
| The world ends up with no new MECHANIC | legitimate — World 5 shipped four negative results. An unrecorded omission is the defect, not the omission |
