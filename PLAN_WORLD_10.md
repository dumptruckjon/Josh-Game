# 🎉 World 10 — The Party (L37-L40)

**Status: BUILT.** Four levels, three backbone skins, the 🎁 Big Present boss, a
tenth endless arena, a new floor pattern and a new road style, and the world's
one fork+lever on L38.

---

## 0. Why a tenth world at all, and why it was BLOCKED until now

`PLAN_MINIBOSS.md` §5b closed the difficulty axis from three directions at once
and ended on the one thing left: *"the only structurally legal home for a new
finale is a TENTH WORLD (L37-40)"*. `TD structure` asserts

```js
assert.deepEqual(bossLevels, worlds.map((w, i) => (i + 1) * 4));
```

so a boss may only headline a world's fourth level. Adding a finale therefore
means adding a world — there is no other legal shape.

The blocker was the **star ceiling**, which derives as `LEVELS.length * 3`. At 36
levels it was 108⭐ against a 123⭐ tree (margin 15); at 40 levels it becomes
**120⭐**, which leaves 3 — inside the noise of a single node's price. So the tree
was grown FIRST, by BREADTH (five new KINDS, never ranks — a rank is raw power,
and three individual Firepower ranks are each recorded as erasing a boss finale
on their own). The tree now costs **140⭐** against a 120⭐ ceiling: margin **20**.

## 1. The fiction

The displacement chain ran one way for nine worlds — bedroom → backyard → toy
store → attic → garage → moving day → new house → sort line → toy works, each
one a step further from the child. World 9 closed the loop by melting you down
into a new toy. World 10 is the only world where the chain runs the OTHER way:
the new toy is wrapped and **given**. So it is deliberately the brightest floor
in the game rather than a tenth dim room.

## 2. What shipped

| piece | detail |
| --- | --- |
| world id | `party` — "🎉 The Party", spawnGlyph 🎉 |
| backbone skins | 🎊 **Party Popper** (sock), 🍬 **Loose Sweet** (marble), 🎏 **Stray Streamer** (hawk) |
| boss | 🎁 **The Big Present** (L40) |
| floor | `pattern: "confetti"` — paper flecks + fallen streamers on plum carpet |
| road | `style: "chain"` — a paper chain, link by link along the lane |
| levels | L37 Streamers Up · L38 Pass the Parcel · L39 Musical Chairs · L40 The Big Present |
| hooks | L37 ⚡ power pad · L38 🔀 fork+lever · L39 ⏩ conveyor · L40 the boss |
| endless | a tenth arena, unlocked by 3-starring all four levels |
| badge | 🎁 **Unwrapped** — beat The Big Present |

Nothing was typed by hand. Lanes and pads came out of `tools/td-map-search.js`
(every geometry law: ≥0.99 cells from EVERY lane, ≥1.4 pairwise, ≥1.9 from the
lever) and the waves out of `tools/td-wave-gen.js`, validated against BOTH
shipped contracts (±25% budget curve; ≥70% backbone / ≤1 special ≤25% / valve
≤12% / plain openers) before `td-data.js` was touched.

## 3. The boss is the point, and its kit is the one combination nobody used

Nine bosses ship `stomp` / `suck` / `enrage` / `disable` / `spawn` / `phases` in
various mixes. **None has ever carried `hurry`.** The Big Present therefore does
not hit you at all — it makes the whole party ARRIVE FASTER, which is a threat
damage cannot answer, and it is a path the engine already runs (the Boom Box's
write pass, read in the ONE `effSpeed`). The rest is shipped machinery: the
`shield` IS the wrapping paper, and the hp-gated phases tear it open (poppers
spill out at 66%) and then set the room off (a jammed gun + a dash at 33%). The
LID rides up as the bands fall, so the phase is readable on the box itself —
the Tickmaster's precedent.

Its escort is **healers + a piñata + streamers**, trait signature
`flier,gold,heal` — unique among the ten finales (`P2 identity: each finale's
ESCORT demands a different counter` derives the signature through `enemyTraits`,
so this is checked rather than claimed). It is also the first finale led by the
Junk Healer.

## 4. Measurements

See §5 for the numbers as shipped. Two are worth stating up front:

- **L40 is a genuinely graded finale** — it is the whole reason the world exists,
  and it lands inside the 5-17 band `AUDIT boss tension` demands with real
  per-seed variance rather than a fixed toll.
- The **step function held again**, for the seventh time: the levels whose normal
  could be moved were moved, and the ones that sit at a flat 20 are recorded as
  unreachable rather than faked. That is now a documented property of the engine
  (`PLAN_MINIBOSS.md` §3), not a defect of this world.

## 5. Shipped numbers

`SEEDS=1,7,13,23,2,99,404,5 node tools/td-sim.js 37,38,39,40` — the shipped
best-of-two oracle, never a stronger solver (that is what got World 4 reverted).
Eight seeds, because this project has now twice shipped a dose that was clean on
four and lost heroic on eight.

| level | normal | heroic | neglect |
| --- | --- | --- | --- |
| L37 Streamers Up | `20 ×8` (flat) | `15,15,15,17,17,14,15,15` med **15** | loses |
| L38 Pass the Parcel | `20,17,19,18,18,18,19,16` med **18** | `8,9,9,6,6,9,11,11` med **9** | loses |
| L39 Musical Chairs | `19,19,19,20,19,20,20,20` med **20** | `12,10,10,14,13,13,14,11` med **13** | loses |
| L40 The Big Present | `6,12,12,6,12,11,12,12` med **12** | `6,8,6,6,9,9,8,8` med **8** | loses |

**No losses on either difficulty on any seed**, and neglect loses everywhere.
L40 is the deliverable: median 12 with a spread of 6, inside the 5-17 band
`AUDIT boss tension` demands, and it ends more than one way.

### 5.1 L38 was structurally unwinnable on heroic, and GOLD could not touch it

The first cut ran a **36-cell** default lane with 11 pads — the shortest lane in
the campaign. It measured normal med 10 and **heroic LOST on every seed**, and a
gold sweep says exactly why that was not a budget problem:

```
gold= 1300 | normal 12,6,7,10 med 10 | heroic LOST on every seed
gold= 1600 | normal  9,8,6,12 med  9 | heroic LOST on every seed
gold= 1900 | normal 11,8,7,12 med 11 | heroic LOST on every seed
gold= 2200 | normal  9,7,7,11 med  9 | heroic LOST on every seed
gold= 2500 | normal 12,3,5,11 med 11 | heroic LOST on every seed
```

Cutting the wave budget did not fix it either — at `base 700` normal finished
`20,20,20,17` (comfortable) while heroic still lost all four seeds. The quantity
that actually mattered is **total exposure**: `Σ(pad coverage) × lane length`,
i.e. how many cell-passes of tower fire the whole board delivers.

| level | pads | lane | Σ coverage | exposure |
| --- | --- | --- | --- | --- |
| L38 (first cut) | 11 | 36 | 108% | **39** |
| L31 (shipped) | 12 | 53 | 101% | 53 |
| L40 | 14 | 59 | 112% | 66 |

So the fix is the TD-4 law applied deliberately: **a short path is HARDER**, and
L38's was 40% short of a normal board. Re-searched to a **44/72** fork (ratio
1.64, exposure 43.7) and re-tuned to `base 800, count 13, gold 1700` — the only
band where heroic is comfortable AND normal is graded rather than flat 20:

```
base=600 n=13 | normal 20,20,20,20 | heroic 19,17,17,20 med 19   <- too soft
base=700 n=13 | normal 20,19,17,19 | heroic 14,13,14,12 med 14
base=800 n=13 | normal 17,18,18,19 | heroic  9, 6, 9,11 med  9   <- shipped
```

**Generalizable:** when a level is unwinnable on heroic while normal looks fine,
measure exposure before reaching for gold or the budget base. Gold was inert
across a 1300-2500 sweep, and the wave budget only moved normal.

### 5.2 The lever, measured

`node tools/td-sim.js 38 --lever` (thin boards, normal, 4 seeds):

```
cap  7  dart short 0/4 → LONG 0/4
cap  8  dart short 0/4 → LONG 3/4     <- decisive
cap  9  dart short 3/4 → LONG 4/4
cap 10  dart short 4/4 → LONG 4/4
```

`TD7 lever advantage` ships `38: { cap: 9, gain: 5 }` — at seed 7 a 9-pad board
wins short with 4 lives and with the diversion with 10.

### 5.3 L37 and L39 sit at a flat/near-flat normal, and that is RECORDED

L37 is `20 ×8`. That is the seventh reproduction of the step function
(`PLAN_MINIBOSS.md` §3): every setting where heroic is comfortably winnable
finishes normal at 18-20, and every setting that bites on normal makes heroic
unwinnable. World 5 and World 9 both ship the same shape for the same reason. It
is not faked with a knob the data does not support.

## 6. Do not

- ❌ Reach for a bigger HP pile, more gold, a longer lane, a backbone stat swap
  or a side-door dose to make a flat level bite. All six are measured NOT to
  work (CLAUDE.md, repeatedly).
- ❌ Add an eleventh world without growing the star tree first. At 44 levels the
  ceiling is 132⭐ against a 140⭐ tree — margin 8, and shrinking.
