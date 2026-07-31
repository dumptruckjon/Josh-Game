# PLAN_EXPANSION.md — Fort Josh: quantity, distinctness, and the meta economy

Status: PLAN. Nothing here is built. Every number below was measured against the shipped
data/engine (`node -e` against `scripts/td-data.js`, `tools/td-sim.js` with the **shipped**
best-of-two oracle) or verified by line number in the repo. Where a claim is inherited from an
analysis and was *not* independently re-run, it is marked **[unverified]** and carries a
re-measure gate before it can be acted on.

---

## 0. The star-ceiling blocker — exact numbers and the resolution

### 0.1 What is actually true today

| quantity | value | source |
|---|---|---|
| levels | 24 | `DATA.LEVELS.length` |
| earnable star ceiling | **72** (`LEVELS.length * 3`) | `scripts/td-main.js:158`, `scripts/td-ui.js:497` |
| star tree cost | **77⭐** across 23 nodes | `DATA.META_NODES` |
| fraction of the tree a completionist can afford | **93.5%** | 72/77 |
| fraction TD-8 designed for | **46.8%** | 36/77 |
| the guardrail that is supposed to protect this | `assert.ok(total > 36, …)` | `tests/td-logic.test.js:995` **and** `:1343` |

**The brief's blocker statement is wrong in mechanism, and the truth is worse.** `total > 36` is a
stale World-3-era literal, duplicated. 77 > 36 passes at 24 levels, at 32 levels, at any level
count. Expanding would **not** turn the suite red — the dead-stars property is *already dead*
(93.5% affordable vs a designed 46.8%) and **nothing can see it**. That is hard constraint 10
("a test that cannot fail is worse than no test") violated live in the repo, and it is the same
class as `TOTAL_PLANNED = 12`, the missing attic arena, and the VS16 file list.

### 0.2 Why the obvious fix (grow the tree) is rejected

Restoring the 46.8% ratio requires the tree to cost `ceiling / 0.468`:

| campaign | levels | ceiling | tree cost needed for 46.8% | nodes needed (avg 3.35⭐) |
|---|---|---|---|---|
| today | 24 | 72 | 154⭐ | ~46 |
| +1 world | 28 | 84 | 179⭐ | ~53 |
| **+2 worlds (this plan)** | **32** | **96** | **205⭐** | **~61** |

Rejected on three grounds:

1. **Measured harm.** With the full 77⭐ tree owned, the shipped oracle takes L20 Toolbox Titan —
   CLAUDE.md's "tensest ending in the game", median 9/20 — to **24,24,24 flawless on normal**, and
   L16 Tickmaster from **heroic 7 → 24**. *[unverified — re-measure is Phase 1 item P1.5, and it is
   the gate for the whole of §0.3.]* The tree is already the single strongest difficulty knob in
   the game, larger than any gimmick or threat shape, and every balance number in the corpus is a
   **no-meta** number. Adding +26 to +128⭐ of ranked power to close a ratio pushes the completionist
   further past a curve nothing guards.
2. **`metaMods` is a hard-coded ternary chain** (`scripts/td-logic.js:104-125`), highest-rank-wins.
   Every new rank is a pure-engine edit, not a data append. "+47 nodes" is not a content pass.
3. **The overlay already scroll-breaks at 23 nodes** (documented: the rebuild-resets-scrollTop bug).
   ~61 nodes on a 390×844 phone is a UX regression on top.

### 0.3 The resolution: cost stops being the constraint; **slots** become the constraint

Make level count and applied meta power **orthogonal**:

- **Keep** the `total > ceiling` assertion, but derive it. It stays as a cheap anti-dead-star *floor*,
  not as the economy's real bound.
- **Add `save.loadout` + `RULES.metaSlots`**: you OWN nodes with stars, you BRING `metaSlots` of
  them into a run. Applied power is then bounded by a single number that does not move when the
  campaign grows.

Target numbers:

| | today | after Phase 4 | after Phase 5 (32 levels) |
|---|---|---|---|
| levels / ceiling | 24 / 72 | 24 / 72 | 32 / **96** |
| tree nodes / cost | 23 / 77⭐ | 23 / 77⭐ | **30 / 103⭐** (+7 nodes of *breadth*, avg 3.7⭐) |
| `total > ceiling` | 77 > 72 ✅ (margin 5) | 77 > 72 ✅ | 103 > 96 ✅ (margin 7) |
| **brought per run** | 23/23 = 100% | **`metaSlots` (default 6) = 26%** | 6/30 = **20%** |

The +7 nodes are **new kinds, not new ranks** — each needs a real read site, and each competes for
one of 6 slots, so the tree grows in *choice* without growing *power*. `metaSlots` is chosen by
sweep in P4.2 against the boss-tension band, not by taste.

**This is the only resolution that survives a 7th, 8th or 9th world.** Cost-as-the-choice provably
does not scale (§0.2 table).

---

## 1. Phase order

| phase | what | risk | ships green alone | gates the next phase |
|---|---|---|---|---|
| **1** | Make the tests able to fail (tests + 2 free derivations) | none | ✅ | yes — P1.5/P1.6 are the balance instruments for everything after |
| **2** | Differentiate the 24 shipped levels (data-only, HP-preserving) | low | ✅ | yes — proves the differentiation method before it is applied to new worlds |
| **3** | Three power fixes (engine, small, **no new button**) | low | ✅ | no |
| **4** | Meta economy: loadout slots + tree breadth | medium | ✅ | yes — must land before the ceiling moves |
| **5** | Worlds 7 + 8 (24 → 32 levels) | high | ✅ per world | — |
| **6** | Optional: challenge runs + 🧲 Reel It In | medium | ✅ | — |

**Phase 1 is the highest value per unit of risk** because every later phase's safety argument rests
on instruments that do not exist yet: there is no meta-aware balance test, no ability-abuse test,
and no differentiation metric. Building 8 new levels first would repeat the World-4 revert.

---

## 2. Phase 1 — Make the tests able to fail

All tests + two free derivation fixes. Zero balance change. Every item mutation-checked.

### P1.1 Derive the star-economy guardrail
- **Files:** `tests/td-logic.test.js` (:995, :1343), `scripts/site.test.js:107` comment, `scripts/td-ui.js:226` comment.
- **Change:** both assertions become
  `const cap = DATA.LEVELS.length * 3; assert.ok(total > cap, \`tree total (${total}⭐) must exceed the earnable ceiling (${cap}⭐) — dead stars stop it being a choice\`)`.
  Delete the duplicate at :995 (verbatim copy inside a `metaMods` test; no coverage lost).
- **Passes today:** 77 > 72, margin 5⭐.
- **Guardrail proof (mutation):** append 8 fake levels in-process → ceiling 96 → **must go red**. The
  literal-36 version survives that mutation. Both stale comments still say "ceiling stays 36".
- **Sim:** none needed (no engine change).

### P1.2 Endless coverage derives from the campaign, not from itself
- **File:** `tests/td-logic.test.js` (`AUDIT endless`, ~:2567).
- **Change:** `const worlds = [...new Set(DATA.LEVELS.map(l => l.world))]` instead of
  `Object.keys(DATA.ENDLESS.worlds)`. Keep the per-world asserts (arena present, `path>=2 && pads>=8`,
  label, `miniBoss` not a campaign boss).
- **Why:** today the audit iterates the endless table and asserts `>= 4` levels behind each key — a
  7th *campaign* world with no arena passes green. That is exactly the attic-arena defect that shipped.
  Verified: `ENDLESS.worlds` = bedroom, backyard, toystore, attic, moving, garage (6, matching).
- **Mutation:** delete `ENDLESS.worlds.moving` + `arenas.moving` → passes today, **must fail after**.

### P1.3 Every boss badge must be EARNABLE, not merely present
- **Files:** `tests/td-logic.test.js` (new), reads `scripts/td-main.js` as text.
- **Change:** for every level with `waves.some(w => w.boss)`, assert the award chain in `td-main.js`
  (:325-331) contains an `earnAch` guarded by that level id.
- **Why:** `ACHIEVEMENTS.length === bosses + 9` (verified: 15 = 6 + 9) forces a badge to *exist*;
  nothing forces it to be reachable. Prefer the text check to refactoring a shipped award path.
- **Mutation:** delete `if (st.levelId === 24) earnAch(...)` → count guardrail still green, **this must go red**.

### P1.4 Control-strip overlap + landscape-height audit
- **File:** `tests/td.test.js` (extend the existing 7-viewport portrait audit at ~:1898 and the
  landscape assertion at ~:1961).
- **Change:** (i) adjacent `.td-controls` buttons must not overlap (`rect.left >= previous rect.right`
  on the same row); (ii) the landscape gutter column's measured height must fit above the viewport.
- **Why:** `.td-abil { min-width: 44px }` (`styles/td.css:294`) masks track starvation — a 5th tile
  keeps every button at 44px, `scrollWidth` stays 0, and the buttons **physically overlap by 6px at
  320px and 19px at 6 tiles** *[unverified — reproduce in the browser before writing the numbers into
  the test comment]*, while landscape `scrollHeight` hits 391 in a 390-tall viewport. Every shipped
  guardrail stays green through that. This is the audit hole that makes "the strip is full at four"
  enforceable.
- **Mutation:** clone a 5th `.td-abil` at 320×568 (overlap → red) and at 844×390 (height → red).

### P1.5 **ALL_META boss-tension guardrail** — the missing balance instrument
- **File:** `tests/td-logic.test.js`, beside PLAYABILITY's existing "neglect loses with the FULL tree owned" (:617).
- **Change:** with every meta node owned, each boss finale's **median lives across ≥8 seeds** must
  stay inside the same 5-17 band `AUDIT boss tension` (:1600) already demands of the no-meta run.
- **Expected result: this FAILS today on L16 and L20.** That is the finding, not a blocker. Ship it
  with an explicit named exemption list `META_TENSION_EXEMPT = ["16", "20"]` **plus an assertion that
  the exemption list is a strict subset of the finales** (the conveyor/L7 precedent — the exemption
  must be intentional, not an accidental hole). Phase 4 removes both entries.
- **Sim:** `node tools/td-sim.js 4,8,12,16,20,24` with `--meta=all`, 8 seeds, normal + heroic. This is
  the run that produces the §0.2 numbers; **do it first**, because if it does not reproduce, §0.3's
  justification changes and P4.2 loses its target.
- **Mutation:** drop a node set and watch the median move.

### P1.6 ABILITY-ABUSE sim
- **File:** `tests/td-logic.test.js` (new), `tools/td-sim.js` (`--spam` flag).
- **Change:** re-run the shipped oracle with **every ability spammed at max cooldown rate** on the
  final wave of each boss level; assert each finale still lands in its documented band
  (L16 median 16, L20 median 9, L24 median 14, ±band).
- **Why:** the oracle never calls `useAbility`, so all four *shipped* abilities' effect on the
  finales is invisible to the entire suite. This closes the blindspot for what exists **and** is the
  test any future power must pass. Preliminary indication: spamming 🧨 Drop takes L16 normal from
  5/12 to 20/20 *[unverified — this run is the point of the item]*.
- **Mutation:** raise `drop.dmg` 3× → must go red.

### P1.7 Free RULE-7 derivations (tower facts)
- **Files:** `scripts/td-logic.js:1459` (`reachedBy`), `scripts/td-ui.js` ~:345, `scripts/td-main.js` ~:842.
- **Change:** build the line list from `Object.keys(DATA.TOWERS)` and the air answer from
  `DATA.TOWERS[k].hitsFliers`; the build menu's `["dart","mortar","fan","camp"]` literal likewise.
- **Mutation:** flip a `hitsFliers` in a fixture → both the guide's cannot-hit-fliers string and
  `reachedBy` must follow. Fails on pre-fix code.

### P1.8 One-owner fix: the targeting-mode control
- **Files:** `scripts/td-main.js:940`, `scripts/td-logic.js:1191`.
- **Change:** the UI asks the engine which modes are legal instead of re-reading `save.meta`, and
  honours the `{ok:false}` return before relabelling. Today the button can offer a mode
  `setTargeting` refuses — the documented "a power that changes nothing must never charge you" class,
  and it becomes a *live* bug the moment loadouts land (P4.1).

**Phase 1 deliverable:** 8 items, ~250 lines, all tests + 2 derivations, suite green (with L16/L20
on a named exemption). No data, no balance, no engine behaviour change.

---

## 3. Phase 2 — Differentiate the 24 shipped levels (data-only)

Measured sameness, re-verified against `DATA.LEVELS`:

- **L13, L14, L15 carry byte-identical enemy cast sets**
  (`battery+blob+cushion+ghost+hawk+knight+marble+mole+screw+slime+sock+tinplane`), and **L18 = L19**
  with the same 15-type set. That is 5 of 24 levels with zero roster identity.
- L17-L20 and L21-L24 each throw 12-16 shapes per level; late-game special HP share has collapsed to
  16-19% spread over 7-10 shapes, so no special is ever more than ~2% of a wave.
- `tools/td-wave-gen.js:72` hard-codes `G_ODD = ["sock","knight"]`, `G_EVEN = ["blob","marble"]` for
  **all 24 levels**, and `BACKBONE` (`:39`) is duplicated verbatim at `tests/td-logic.test.js:2920`.
  76-85% of every wave's HP is that fixed six.

### P2.1 Per-world backbone **SKINS** — the headline, at provably zero balance risk
The single largest differentiation available anywhere: the six backbone types are ~85% of all bodies
shipped. A **reskin** — same `hp`/`speed`/`armor`/`bounty`/`meleeDmg`/`meleeRate`, new id, name, icon
and art — replayed **byte-identically** under the shipped oracle on 4 seeds × normal + heroic
*[unverified — reproduce on L17 and L21 before writing any art]*. There are no pinned determinism
hash literals in `td-logic.test.js` (every hash is A-vs-A within a run), so new type ids break no
historical replay.

- **Files:** `scripts/td-data.js` (ENEMIES + `WORLDS[w].backbone`), `scripts/td-render.js` (art),
  `tools/td-wave-gen.js:39` and `tests/td-logic.test.js:2920` (both read `WORLDS[].backbone` instead
  of their own copy), `scripts/td-logic.js` (`enemyTraits` needs nothing — a fieldless enemy already
  emits "No tricks — anything can hit it", so guide coverage is free).
- **Scope:** 12 new types (per world: one shared continuity shape + two exclusives). Budget ~320
  lines of canvas art (the enemy draw is a 39-branch chain averaging 26.9 lines), 12 emoji vetted
  ≤ Emoji 13.0 **and** VS16 where text-default, 12 guide cards. If 12 is too much for one change,
  ship 6 (one exclusive per world) and say so — half of 85% is still the largest lever in the plan.
- **Guardrails** (all four mutation-checked):
  1. Every world's backbone contains ≥1 type used by no other world. *Mutation:* give two worlds a
     2-of-3 overlap → red (a naive "no two worlds share a trio" test stays green there).
  2. Cosine similarity between any two worlds' backbone **body-count** vectors < 0.9. *Mutation:*
     today garage vs moving scores ~1.0, so it **fails on HEAD** — that is the proof.
  3. Every world's backbone contains exactly one flier, so `AUDIT threat shape` cannot be starved.
  4. Every skin member's stat line asserted **equal** to its shared-six ancestor, so Phase 2.1 cannot
     silently become a balance change in a later hand-edit.
- **Sim:** `node tools/td-sim.js 1..24`, 4 seeds × normal + heroic, asserting **byte-identical**
  results. Any drift means a stat was mistyped.

### P2.2 De-duplicate the 5 identical special casts + the similarity ratchet
- **Files:** `scripts/td-data.js` (L13/L14/L15, L18/L19 special groups), `tests/td-logic.test.js`,
  `tools/td-wave-gen.js` (`--diff` mode).
- **Change:** re-point the free specials so all 24 casts are mutually distinct
  (21 → 24 distinct, the metric's ceiling). HP-preserving: `count' = round(groupHP / newEnemyHP)`.
- **Hard rules, each from a measurement:**
  - Draw only from the measured-neutral set `{ghost, battery, cushion, slime}`.
    **Never `screw + mole`** — it takes L18 heroic to 1/4 seeds and L13 to 3/4 *[unverified]*, a
    constraint-3 failure and the documented "unwinnable a quarter of the time is a coin flip" class.
  - Hold `hawk / tinplane / racer / pinata / backbone / boss` groups byte-identical — those are the
    shapes measured to carry balance.
- **Guardrail:** no two levels may share more than N wave-index-aligned **special-slot** casts (cast
  minus backbone minus boss). Scoped to the special slot deliberately: the backbone lead is
  balance-load-bearing (`td-wave-gen`'s own comment — marbles leading makes a 200-body sprint), and
  with ~4 usable ground backbone types a whole-cast assertion pulls against hard constraint 4.
  Ratchet the threshold at today's second-worst world so it fires on the attic immediately.
  **Mutations:** (a) copy L17's special schedule onto L22 → red; (b) remove the special-slot filter so
  it degenerates to whole-cast → it now fires on levels the composition contract *forces*, proving
  the narrowing is what makes it honest.
- **Sim:** `node tools/td-sim.js 13,14,15,18,19`, seeds 7/23/99/404 × normal + heroic; each level
  within ~2 lives of baseline, no heroic seed lost. Plus `node tools/td-wave-gen.js --check`.
- **Also ship `--diff`:** print a candidate level's nearest special-slot neighbour **before** the data
  file is written (the repo's "the data file is written LAST" discipline), and print the hard-coded
  `G_ODD`/`G_EVEN`, since that literal is the mechanical cause of the sameness.

### P2.3 Boss finale **escort archetypes**
The six boss waves are budget-exempt, so composition is free — and today the escort is a copy-pasted
template: L16 `knight×12 + hawk×14`, L20 `knight×14 + racer×12 + hawk×16`, L24
`knight×14 + bubblewrap×10 + hawk×16`. Armored line + fast air, three times.

Measured on L20: replacing the escort with `knight×20 + bubblewrap×18` takes dart-mono from 9,8 to
**LOST, LOST** while the mixed plan **improves** 7,8 → 11,11 *[unverified — reproduce first]*. That is
the counter matrix moving, which is exactly the differentiation wanted, and it is visible through the
existing next-wave preview.

- **Files:** `scripts/td-data.js` (6 boss waves only), `tests/td-logic.test.js`.
- **Change:** one distinct archetype per finale — all-air, armored/bonkResist, many-small swarm,
  shielded+regen, hurry/speed, mixed.
- **Constraints:** each finale keeps its `AUDIT boss tension` median inside 5-17 across 8 seeds; at
  least one shipped plan clears on casual/normal/heroic; neglect still loses; and **check the heroic
  dart-vs-mixed split before and after** so an armored escort does not invert the recorded "no single
  plan is universal" property in the other direction.
- **Guardrail:** the six escorts' **trait signatures** must be pairwise distinct — the *set of trait
  keys* (`flier / armor / bonkResist / shield / slowHeal / splashResist / hurry`) derived via
  `enemyTraits` so a new enemy classifies itself. **Not** their medians, which already differ
  (17 / 9 / 14). *Mutation:* copy L20's escort onto L24 → red.
- **Sim:** `node tools/td-sim.js 4,8,12,16,20,24`, 8 seeds × 3 difficulties, both plans.

### P2.4 Side-door position, dosed per level (the only measured **graded** knob)
Position is monotonic on **normal**, which almost nothing in this engine is:
L13 20,20,19,20 (25%) → 15,14,14,15 (50%) → 5,4,5,6 (75%); L11 17.5 → 17 → 3.5;
L18 20 → 20 → 10.5 *[unverified]*. 75% loses every heroic seed on all three, so the band tops out
near 55-60%; ≤30% is a no-op on normal.

- **Files:** `scripts/td-data.js` (`groups[].at`), `tests/td-logic.test.js`.
- **Change:** author `at` in a **30-60%** band per level, chosen by sim. L13 stays at 50% (the
  recorded deliberate −5 exception); L11 and L18 have headroom to push toward 55-60%; L2 and L5 sit
  at the flat end — leave them and accept this differentiates ~3 levels.
- **Guardrail:** extend the TD-16 zone/dose check — every `groups[].at` ∈ [0.25, 0.62] × path length.
  **Mutation both bounds** (5% and 80% must each go red); a one-sided band is the can't-fail trap.
- **Sim:** only the levels whose door moved, ≥6 seeds × normal + heroic; heroic must win every seed;
  re-run `AUDIT mono builds` on heroic (the door is recorded as leaving the "no single plan clears
  heroic" property intact, unlike mud).

### P2.5 Gimmick assignment: **a boss IS the hook**
Six levels are hookless (L4, L8, L14, L16, L21, L24) — and four are boss finales, the levels with the
least margin in the game. Forcing a hook onto them is measurably destructive: L4+night **loses 6/6
heroic seeds**; L8+power pad takes normal 10 → 18, reversing the deliberate Vacuum King hardening;
L16+night takes normal 17 → 6 *[unverified]*.

- **Change:** make the boss the declared hook (a unique multi-phase enemy with its own kit, klaxon and
  guide card is a stronger named hook than a mud patch). Then give a hook only to the two genuinely
  bare non-boss levels: **L14 + mud patch** (0.75 over ~6 cells mid-lane; measured normal 18 → 19,
  heroic 8 → 9, neglect still loses), and **L21** only if a dose search moves ≥2 heroic lives while
  normal stays ≥17 — mud measured +0/+1 and a single-wave door measured **exactly zero on all 12
  runs**, so if nothing moves, ship no hook and record the negative result.
- **Guardrail:** every level has ≥1 hook **or** a boss wave, and no two levels in a world share a hook
  *type*. Mutations: strip L14's mud → red; give L21 the type L22 carries → red; remove the boss
  exemption path → L4 red (proving the exemption is deliberate).
- **Caution:** re-run "no single plan clears heroic" after L14's mud — mud disproportionately rewards
  a dart swarm and flipped that property on L5 once already.

**Phase 2 deliverable:** the 24 shipped levels stop sharing 85% of their bodies and 5 of them stop
being the same wave table. Data + art only, no engine read sites, no new levels, no star ceiling move.

---

## 4. Phase 3 — Three power fixes, no new button

The strip is **full at four**. `.td-abils` is `repeat(4, minmax(0,1fr))` in a 196px track at 320px;
five tiles at the adult 44px floor need 252px. Every enhancement below folds into an existing button.

### P3.1 ⚙️ Toy Energy — a **flat per-wave** charge budget
The cost model is broken after ~wave 10: a fully-built board holds 0-145 gold through wave 10 and
**5,570g by L20 w15 / 6,356g by L24 w15** against a 130g top price — 43 free uses *[partially
unverified; the L24 build-phase series 0, 88, 26, 88, 41, 132, 121, 12, 79, 35, 351, 1115, 2375,
3533, 5393 at seed 7 is the load-bearing measurement and must be reproduced]*.

A **per-kill** grant cannot fix this — supply ∝ wave size, which grows 1.18ⁿ, while cooldown-limited
demand grows only with wave duration; swept 1/12 → 1/80, uses/wave rises monotonically at every rate.
A **flat per-wave** grant yields 2,2,2,2,2,2,2,2 and tightens automatically where the problem is.

- **Files:** `scripts/td-logic.js` (grant at the wave-schedule site; `abilityReady` gate),
  `scripts/td-data.js` (`RULES.chargePerWave = 2`, `chargeMax = 3`, `ABILITIES[].charges = 1`),
  `scripts/td-ui.js` (HUD numeral beside ❤ and 🪙; guide Powers section gains the charge cost),
  `scripts/td-main.js` (`writeMidRun`/`resumeMidRun` only).
- **Gold prices stay 130/90/100/80.** Cutting them is a 4-5× buff in the wrong direction and deletes
  the last gold sink.
- **Persistence:** `state.charge` is per-run → rides `writeMidRun`/`resumeMidRun` **only** (legacy
  midRun lacking it → `chargePerWave`). It must **not** touch loader defaults, `freshSave`, or the
  two-tab monotonic merge — folding a per-run float as monotonic is the documented inconsistency.
- **Guardrails** (each mutation-checked): charge is exactly `min(cap, wavesStarted*perWave − uses)`;
  a charge-less use is **REFUSED**, takes no gold and starts no cooldown (extend the existing
  `deepEqual(state.abilityCd, {})` test at :2414); a spam bot with unlimited gold gets at most
  `perWave` uses per wave and the per-wave count is **flat** (`max − min <= 1` over 15 waves) — this
  is the assertion that fails on the per-kill version; a ⏩ RUSH clearing two waves grants for both
  exactly once (the 💵 Allowance precedent); determinism A-vs-A with abilities used; PLAYABILITY and
  neglect byte-identical (the oracle never calls `useAbility`).
- **Browser:** spend a charge → HUD numeral decrements; checkpoint with 2 charges → 2 come back (the
  `shieldUsed` precedent, which shipped missing from `writeMidRun` once).

### P3.2 🧨 Toy Box Drop gains a **reveal rider** — and repairs a live shipped defect
`abilityWouldDo`'s damage branch skips `isHidden`, so on L12's boss wave with 8 phased ghosts standing
in the crater, tapping 🧨 today refuses with "🎯 Nothing in the blast". The ability that reads broken
is already in the game.

- **Files:** `scripts/td-data.js` (`drop.reveal = { radius: 2.4, seconds: 4 }`),
  `scripts/td-logic.js` (`state.revealZones`; one clause `if (revealedAt(e)) return false;` at the top
  of `isHidden` — still ONE gate covering all 10 read sites; drop the `isHidden` skip in
  `abilityWouldDo`; push the zone **before** the damage loop), `scripts/td-render.js`
  (`render.isRevealed(e)` drives ghost alpha at :376 and the mole mound at :408, plus a warm glow).
- **Why a rider and not a 5th button:** untargetability is worth **exactly 0.0 lives on 13 of the 17
  levels that ship a ghost or mole** *[unverified]* — a standalone 🔦 is a permanently dead button on
  ~20 of 24 levels, and there is no ability loadout today. As a rider it inherits a real point-aim
  decision and needs no UI change.
- **Guardrails** (each must FAIL on pre-fix code): a dart at a lone phased ghost drops its lock and
  re-acquires inside the zone; all four indirect paths (mortar splash near a hidden mole, chain
  jumping to a phased ghost, soldier engaging a tunnelling mole, a puddle slowing one) MISS outside
  and LAND inside; a render frame-diff showing a revealed ghost's ink differs from a phased one.
- **Sim:** `tools/td-sim.js 6,9,10,11,12,13` — confirm the reveal is not so strong it erases ghosts
  and moles; an always-on reveal measures +6.0 on L10-mixed and +5.0 on L12-mixed, so the 4-second
  window and 2.4 radius are the dose to check.

### P3.3 ⚡ Overclock gains a **crash** — the only power with a consequence
Overclock is 100g for ×2 on one tower for 8s and no downside — a near-dead button. Give it
`mult: 2.5, seconds: 6, crashMult: 0.5, crashSeconds: 12` at 110g / 24s cooldown:
`6×2.5 + 12×0.5 = 21` shot-seconds over an 18s window whose baseline is 18 — **net ≈ neutral**, so
all the value is in *when* you spend it.

- **Files:** `scripts/td-logic.js` (`boostOf` at :302 becomes
  `tick < boostUntil ? boostMult : (tick < crashUntil ? crashMult : 1)` — one expression, inherited by
  all five cooldown-set sites: soldier melee :828, dart :895, mortar :915, fan chain :937, fan zap
  accumulator :978), `scripts/td-data.js`, `scripts/td-render.js` (the sagging tower's own ring goes
  cold — **no full-field tint**; stacking translucent overlays is a documented past defect).
- **Must ship with it:** the crash advances only on `wave`-phase ticks (or is clamped forward across a
  build phase). `RULES.buildCountdown` is 20s, so an unclamped crash is dodged by casting on the
  wave's stragglers — an opt-out downside is a straight buff.
- **Guardrails:** cast with one straggler alive, let the wave end, assert the tower is still sagging
  on the first shots of the next wave (*mutation:* remove the clamp → red); measure the rate against a
  **pinned** target per line — assert the Fan's continuous zap accumulator (:978) tightly and the
  discrete lines as ranges, since `t.cooldown` is sampled at fire time (a 6s window on a 2.8s mortar
  holds 2 shots and the boundary shot carries the previous multiplier). Mutation-prove each by
  deleting the crash branch.
- **Also:** P1.6's ability-abuse sim now covers all four powers with their new shapes.

**Expected balance movement from Phase 3: ≈ 0 on the oracle**, by construction (it never uses
abilities). Say so in the commit; the deliverable is that three buttons become decisions.

---

## 5. Phase 4 — The meta economy

### P4.1 `save.loadout` as a **default-noop**
- **Files:** `scripts/td-main.js` (`startLevel`/`createEngine` :546, `writeMidRun` :588,
  `resumeMidRun` :662, the targeting gate :940 — already fixed in P1.8 — plus loader defaults :16,
  `freshSave` :107, the two-tab merge :23), `scripts/td-logic.js` (`opts.loadout` → `metaMods`),
  `scripts/td-ui.js` (:443 node rows gain an equip toggle), `tests/td.test.js:1410` (re-point off
  `ABILITIES.length`).
- **Ship with `RULES.metaSlots = Infinity`** so loadout ≡ everything owned and behaviour is
  byte-identical (the TD-7 lane / RUSH `scheduleWave` discipline). Every determinism hash, PLAYABILITY
  run and browser test unchanged.
- **Rank implication:** equipping rank II implies rank I (verified: `metaMods(["dartdmg2"])` is
  byte-identical to `metaMods(["dartdmg","dartdmg2"])` for all 5 ranked pairs), so a slot can never
  buy zero — the "a power that changes nothing must never charge you" rule.
- **Guardrail:** script a run, quit at a build boundary, resume, assert the engine's meta equals the
  **loadout** and not `save.meta`. *Mutation:* revert `writeMidRun` to `save.meta.slice()` → red.
  (Today `writeMidRun` snapshots `meta: save.meta.slice()`, so an unthreaded loadout would hand a
  resumed run everything owned — the checkpoint-fidelity class, now on its seventh instance.)
- **Testing footgun:** `__TD.script()` calls `phaseWatch()` after every batch and writes a checkpoint
  the real rAF loop would not — split the batches when inspecting one.

### P4.2 Set `metaSlots` by sweep
- **Target:** the greedy best-N loadout must return **every** boss finale's 8-seed median inside 5-17,
  removing L16 and L20 from P1.5's exemption list.
- **Sweep:** `metaSlots ∈ {4, 5, 6, 7, 8, 10, ∞}` × a fixed panel of 5 named loadouts
  (`none / greedy / firepower / economy / fortification`) × 6 finales × 8 seeds × normal + heroic.
  ~3,400 oracle runs at ~1.4s ≈ 80 min. Do **not** search C(23,8) = 490k loadouts; the panel plus the
  greedy build is the honest bound.
- **Recommended default: 6.** Preliminary indication is that a *generic best-8* recovers ~91% of the
  full tree's power (avg heroic across 5 boss levels: none 7.8 / all-23 19.2 / greedy-8 17.4 /
  fort-8 16.2 / fire-8 11.4) *[unverified]* — i.e. 8 is too many to restore tension, which is why the
  sweep must run before the number is fixed.
- **Known hazard, recorded not hidden:** `metaMods` → lives is strongly **non-monotonic** — a strict
  superset can be ~13 lives *worse* (L20 fort-8 24,24,24,24,24 vs all-23 12,10,11,11,9) while L16
  inverts it. There is no scalar "today's power" to tune toward; the sweep therefore targets the
  **band**, not a point.

### P4.3 Grow the tree by **breadth** to clear the 8-world ceiling
- 7 new nodes, avg 3.7⭐ → **103⭐ / 30 nodes** vs a 32-level ceiling of 96 (margin 7).
- Each must be a **new kind with a real read site**, never a new rank on an existing ladder — ranks
  are `metaMods` ternary edits and add raw power; kinds add choice under a fixed slot budget.
- **Guardrail:** P1.1's derived assertion now binds at 96, and a second assertion
  `RULES.metaSlots < META_NODES.length` becomes meaningful (6 < 30). Mutation-check the first by
  removing three nodes.

---

## 6. Phase 5 — Worlds 7 and 8 (24 → 32 levels, +33%)

**Not before Phase 4.** The ceiling moves from 72 to 96 the moment L25 lands, and P1.1's assertion
will go red unless P4.3 has shipped. That is the feature: the economy question is forced at plan time.

Measured cost per world (from git, verbatim): **~650-750 insertions across 10 files**, ~180 tuning
sims, **+41s** of unit-test time (endless arena 15-21s, PLAYABILITY 11.3s, boss tension 8.1s, gotcha
3.7s, heroic slope 2.9s) on a `td-logic` suite already at 252s. Two worlds ≈ +82s → ~335s. Budget it.

### Per-world charter (both worlds)
| requirement | source |
|---|---|
| 4 levels: 3 + a boss finale | `LEVELS.length === worlds.length * 4`, contiguous ids, boss on every 4th |
| exactly **one** fork+lever level | guardrail-locked (`TD7 lever advantage`), and `tools/td-fork-search.js` says 18 of 20 un-forked maps admit one |
| its own **backbone skin family** (P2.1) with exactly one flier | P2.1 guardrails 1-3 |
| a **distinct** special-slot schedule (P2.2 ratchet) | P2.2 |
| a **distinct** boss escort archetype (P2.3) | P2.3 |
| ≥1 gimmick per non-boss level, no type repeated in-world | P2.5 |
| an endless arena + pool, mini-boss ≠ a campaign boss | P1.2 |
| `WORLDS[w].spawnGlyph` | already covered by `tests/td.test.js:2136` (pinned to the newest world) |
| a boss badge in the award chain | P1.3 |
| lane 51-84 cells, 14-15 waves, 10-14 pads | constraints 5-6; wave count is a difficulty knob |

### One new threat shape per world — and only of the **hard-counter** kind
Follow the Bubble Wrap precedent: a shape that directly answers a line currently unanswered, with a
guardrail asserting it and its mirror are opposites. **Do not** ship a bypass shape (untargetable /
unblockable): making the tunnelling mole a recurring special moved normal by **exactly zero lives** —
that is a measured dead end, and it is a *fourth* confirmation of threshold domination.

Candidate axes with no current answer, in preference order:
1. **A coverage-gap exploiter** — the board is coverage-limited, not damage-limited: the mean number
   of pads within a tier-3 dart's 3.0 reach of any lane point is **1.17** across all 24 default lanes
   (0.70 on L14/L21, 1.90 on L8) *[unverified]*, and 85-93% of kills land in the first four lane
   deciles. A shape that punishes a thin front-loaded board is the one axis the roster has never asked
   about.
2. **An economy shape** — gold binds hard through wave 10 (0-145 spare) and is meaningless after
   (5,570-6,356). Any economic threat must be dosed to bite early, and is inert late by construction —
   state that up front.

**Explicitly forbidden as a new shape:** anything using `speed` as the differentiator (documented
toxic — steals uptime gold cannot buy back, broke heroic once); a purse-theft enemy (dead late plus a
death spiral); a "gets faster the longer it lives" momentum enemy.

### `tools/td-gates.js` — a gate **report**, not a tuner
- **Files:** `tools/td-gates.js` (new, ~100 lines).
- **What:** for a candidate `levelDef`, run all four shipped gates (PLAYABILITY 3 seeds + both neglect
  runs, wave-1 gotcha, heroic slope, boss tension over 8 seeds when a boss wave exists) plus
  `td-wave-gen --check`, and print one pass/fail table with lives-per-seed.
- **What it is NOT:** a coordinate-descent auto-tuner. Measured refutations: `budgetBase` has **zero
  engine read sites** (`grep -c` on `scripts/td-logic.js` = 0; L20 at base 700 / 2100 / 1 all return
  an identical `{won, 9 lives}`) — it only grades authored waves; `padCount`/`waveCount` are not
  fields at all, just array lengths of hand-authored geometry (truncating waves on a finale deletes
  the boss); and the gate set has a **degenerate optimum at maximum gold** — L18 passes every gate at
  startGold 1350, 3000 and 9000, all at a flawless 20/20/20, because PLAYABILITY is a *floor*
  (lives ≥ 5) and only the 6 finales bound from above *[unverified]*. A descent against that objective
  converges on the measured dead end "raising gold alone trivializes everything".
- **Do not** refactor `tests/td-logic.test.js`'s 6 inline oracle copies to import from `tools/` — a
  dev tool must not be able to redefine the project's central guardrail. Keep the duplication and its
  "if you change one, change both" comment.

### The missing upper bound (raise before Phase 5, decide with the owner)
`AUDIT boss tension` bounds the 6 finales from above; **the other 18 levels are unbounded**, and the
formality class is live today (L18 measured 20/20/20; L22/L23 median 20). A proposed
`AUDIT no formality` (median lives under a ceiling for non-boss levels) would fail L18/L22/L23 today
and needs an explicit exemption list. It is a content judgment a sim cannot make — **Owner question
Q4**.

---

## 7. Phase 6 — Optional, both gated on a measurement

### P6.1 Challenge runs — 8 out-of-catalog roster swaps
Quantity without touching `LEVELS.length`, the star ceiling, or the world wiring.

- **Mechanic:** an HP-preserving **roster swap** over a shipped map (all-air on a ground-heavy map;
  all-armor; all-shielded; all-splash-resistant; all-hurry), synthesised through **one**
  `challengeLevelDef(id)` helper mirroring `endlessLevelDef`.
- **NOT a pad cap.** Measured: L22 at 13/12/11/10/9 pads is effectively flawless at every rung, then
  cap 8 = 2,4,10,3 (a **5× seed spread**), then cap 7 = loss on every seed *[unverified]*. That is
  threshold domination again plus the L7 coin-flip class — and `pads.slice()` is emission order, not
  geometry, so a cosmetic pad reorder would silently re-tune every challenge.
- **The integration surface is the real cost, ~10-12 branch sites**, and the *defeat retry* is the
  primary loop: build it first, not last — pause-restart (`td-main.js:309`), both defeat retries
  (:401-402), `resumeMidRun` (:659), `writeMidRun`, the star write (:358),
  `awardWinAchievements`, `nextId`/`nextExists` (:366), `td-ui.js` :186/:248/:565.
- **Do not reuse `cheated`** — it gates out `save.bests` at :372, which is the mode's only reward. Use
  an explicit `challengeId` that suppresses stars/unlock/badges while writing
  `save.bests[level:difficulty:challenge]`, covered at all four persisted-field sites.
- **Drop `banLines`** (a build menu offering a silently-refusing line is the dead-control class) **and
  reversed lanes** (forces discarding `zones` and `groups[].at`, i.e. strips the level's gimmick).
- **Guardrail:** one sim-table row per challenge — won by the shipped oracle on ≥3 seeds **with a
  lives floor**, and **reject any challenge whose seed spread exceeds ~6 lives** (the check that
  catches L22-cap-8's 2,4,10,3). Prove the table can fail with a deliberately impossible entry.

### P6.2 🧲 Reel It In — gated on re-measurement
Drag the lane backwards. Engine insertion is genuinely ~10 lines (`dist` is the single positional
truth; only writer `td-logic.js:1064`), no rng, boss-immune.

**Blocked until three things are fixed:**
1. **Price both ways: ~120 gold AND 1 life.** `RULES.stars = [[18,3],[10,2],[1,1]]` is three flat
   bands, so with a floor of 4 roughly **13 of 16 life-spends cost literally nothing** — the
   Tickmaster 10-of-20 quantization defect, reproduced.
2. **rewind 20 → 8 cells.** Invariant to guardrail: `rewind < cooldown × slowest-relevant-speed`.
   At 18s cooldown, 20 cells exceeds the walk for sock (14.4), blob (12.6), knight (10.8), cushion
   (9.9), bubblewrap (10.8) — a pack goes net backwards, a stall-lock rather than a rescue.
3. **The headline evidence does not reproduce** (claimed L12 2,3,5 → 9,9,9; the shipped best-of-two
   oracle gives plain 7,6,6 normal). Re-run before committing.
4. UI: the 5th tile is blocked (§4 header) — this must fold into an existing button or wait for a
   loadout picker, and `.td-abil__cost` hard-codes `a.gold + "🪙"` (renders "0🪙") while `--poor` is
   gold-only, so it could never say "not enough lives".

---

## 8. What this plan is NOT doing, and why

| rejected | measured reason |
|---|---|
| **Scaling late-wave HP** for difficulty | Flips flawless → loss with no middle. Confirmed 3× independently; this plan's own experiments make it 4× (concentrating the special slot moves **normal by exactly zero lives** and eases heroic by ~3). |
| **A 5th tower line** (support/aura) | At the proposed T3 dose (R=5.0), the **best pad on 23 of 24 levels buffs < 1 gun of rate-equivalent** (0.26-0.52 on L13-L24); a pad spent on a non-gun is a coverage hole on a board measured at 1.17 pads per lane point. Its only positive outliers were **boss finales** (L16 +6, L20 +3), the one place with no remaining lever. |
| **Knockback / pull-back tower** | A pull of K cells every C seconds **is a speed of K/C**. At K=3/C=8 (0.375 c/s), 5 of 6 bosses (0.28-0.34) are pulled back faster than they walk — a permanent hard lock — while the entire 22-strong non-boss roster (≥0.45) can never be locked. The safe window is **empty across the whole (K,C) space**: any dose worth ≥25% uptime on median trash slows the slowest boss ≥57%; any boss-safe dose buys +11% on trash vs the Fan's +100%. If revisited, the gate must be a **fraction** (`max(K/C) <= 0.30 * min(boss speed)` = 0.084 today, derived), not a floor — a floor of 0.28 passes 0.27, which is still a 96% lock. |
| **A 5th ability button** | 5 tiles need 252px in a 196px track at 320px; landscape scrollHeight 391 in a 390-tall viewport; Kid Fort's 2-track block grows to 3 rows over a field already called a third-of-the-screen exception. |
| **🍬 Sugar Rush as a peer power** | 2× for 6s then 0.5× for 6s is **+25% net**, not a trade; the crash is dodgeable over a 20s build phase; and it cannibalizes ⚡ Overclock 4.5× for 1.2× the gold. Folded into Overclock instead (P3.3). |
| **💥 scrap-a-tower (run-scoped cost)** | Boss waves run 129-225s vs a 60s cooldown = 3-4 free scraps on the finale, and a run-scoped cost **cannot be paid after the run ends**. Also mutates the shared `DATA.LEVELS` literal via `padById`. General law: *in a game whose difficulty lives in the final wave, a run-scoped cost is not a cost.* |
| **🪁 Low Ceiling (fliers forced down)** | Wrong direction — it *adds* a way to hit air, relaxing a counter requirement. Plus a structural exploit: all three fliers have `meleeDmg: 0` and the soldier trade is gated `if (fd.meleeDmg > 0)`, so a blocking soldier is **immortal** — a 90g camp becomes a permanent zero-risk air lock. |
| **Mud-dose variation** | Swept 0.85/0.75/0.65 on all four mud levels: normal moves 0-2 lives and is **non-monotonic** (a *stronger* slow produced *fewer* lives on L12 and L20 — seed reordering, not a knob). Only heroic moves: pure flip-risk, no payoff. |
| **Power-pad shape variation** | ±1 life on all five power-pad levels at matched magnitude; the renderer draws one fixed amber ring regardless of `p.boost` contents (invisible mechanic), and `td-ui.js:358` de-dupes guide entries by key, so varying the dose makes the **Toybox Guide lie** for 5 levels. |
| **Lane-shape rewrites for variety** | Direction-signature ignores segment length (L2 is 66 cells, L4 is 51 — same signature), and the remedy is a pad re-search against 5 geometry laws + the 8-viewport audit + a 3-difficulty re-sim on tuned levels. Demoted to a printed report line in `--diff`. |
| **Backbone STAT shape as a world-wide lever** | ~~At **0.00% budget drift**, two pure vanilla swaps took L21 heroic from median 13 to a **loss** and L17 from 10 to 5 while normal barely moved *[unverified]*.~~ **MEASURED AND REFUTED.** That claim was never run through the shipped oracle. Driven properly (`node tools/td-sim.js <levels> --swap`, added for exactly this) over **three swap directions × five levels at ~0% drift**, L21 heroic came out 12 → **12, identical**, and L17 12 → 13. More decisively, **normal never moved once**: L23, L30 and L31 — the three levels this file records as pinned at 20/20 and unmovable — stayed at exactly 20,20,20,20 whether their even-wave primary became the 16hp/1.7 swarm body or the 90hp/0.6 armored Knight, and heroic wandered ±3 in **both** directions (L30 got *easier* under both "harder" swaps). This is threshold domination reproduced a fifth time. The backbone's stat shape is a **flavour axis, not a difficulty axis** — do not reach for it to make a level harder. |
| **A 7th endless arena** | `AUDIT endless` asserts every key has ≥4 levels behind it, and `UI.endlessUnlocked` gates on all 4 being 3⭐ — a 7th key with no world renders permanently locked. Cost measured at **~21s of sim per arena**, the most expensive test surface in the repo. If arena variety is ever wanted, do per-world *variants* inside the existing picker. |
| **An unattended level generator** | Not because it is more repetitive than a human — measured, it emits **16 distinct wave scripts across 18 non-boss levels vs the humans' 14**. Because (a) "legal" ≠ "good" — the validators encode nothing about the heroic step, gimmick placement or finale grading; (b) `LEVELS.length === worlds.length * 4` means levels ship four at a time and the fourth is a **boss finale, which `validate()` explicitly exempts and cannot author**. Exit test for reversing this: four fresh levels that unattended pass `--check`, pass map geometry, clear the shipped oracle and lose to neglect on all 3 difficulties, land the finale median inside 5-17 across 8 seeds, and score ≤12/14 wave-script matches against any shipped level. |

---

## 9. Owner decisions — your taste overrides mine

**Q1 — Is the star tree's current power a defect or an accepted feature?**
With all 77⭐ owned, L20 (median 9/20, the game's tensest ending) finishes flawless and L16 goes
heroic 7 → 24. Phase 4's slot cap would take a completionist's applied power back down to ~6 nodes.
That is a **nerf to an existing save**, which brushes the standing "never a regression" rule.
→ **Recommended default: treat it as a defect and cap it** (`metaSlots = 6`, chosen by the P4.2
sweep), because an uncapped tree makes level count and difficulty inseparable and blocks all future
expansion. **Alternative:** record it as accepted (like the World-3 difficulty peak), keep
`metaSlots = ∞`, and leave L16/L20 permanently on the P1.5 exemption list — but then §0.3's
resolution collapses and the ceiling problem returns at World 9.

**Q2 — 12 new backbone enemy types, or 6?**
12 gives each world one shared continuity shape + two exclusives (~320 lines of art, 12 emoji, 12
guide cards). 6 gives one exclusive per world at half the art budget.
→ **Recommended default: 12.** It is the single largest differentiation lever in the plan (85% of all
bodies) at provably zero balance risk, and half-doing it leaves each world with one distinctive member
out of three.

**Q3 — Two new worlds (32 levels) or one (28)?**
Two costs ~1,400 lines, ~360 tuning sims and +82s of suite time; one is half that.
→ **Recommended default: two, sequenced.** Ship World 7 complete and green, then World 8. "Two" is
the plan; "one" is always a legitimate stopping point after World 7 lands. Do **not** author both in
parallel — that is the shape of the World-4 revert.

**Q4 — Should non-boss levels get an upper difficulty bound?**
18 of 24 levels are unbounded from above, and the formality class is live (L18 measured 20/20/20;
L22/L23 median 20). An `AUDIT no formality` would fail three shipped levels today and need a
documented exemption list.
→ **Recommended default: yes, but ship the exemption list honestly** in the conveyor/L7 precedent, and
only *after* Phase 2 (differentiation may move some of those numbers on its own). The ceiling value is
a taste call, not a sim output.

**Q5 — Challenge runs (Phase 6.1): worth ~10-12 branch sites?**
They add 8 playable configurations with no star-ceiling and no world-wiring cost, but the fort's
replay layer is already three deep (3 per-difficulty star ladders, 6 endless arenas, per-level bests).
→ **Recommended default: defer.** Build them only if, after Phase 5, the owner still wants replay
value on maps already learned. If the roster swaps measure flat, take the negative result and stop.

**Q6 — L21's hook: force one, or record a negative result?**
L21 is a 19-20/20 board that holds every wave; mud measured +0/+1 and a single-wave side door measured
**exactly zero on all 12 runs**.
→ **Recommended default: sweep the door count/placement once; if nothing moves ≥2 heroic lives while
normal stays ≥17, ship no hook and write the negative result into the plan doc.** Forcing flavour onto
a level with no margin is how the L8 regression class gets made.

---

## 10. Verification summary — one line per phase

| phase | headless sim | must be true |
|---|---|---|
| 1 | `tools/td-sim.js 4,8,12,16,20,24 --meta=all --seeds=8` (normal+heroic); `--spam` on the same set | P1.5 produces the exemption list; P1.6 pins all four current abilities |
| 2 | `td-sim.js 1..24`, 4 seeds × normal+heroic — **byte-identical** for P2.1; ≤2 lives drift + no heroic seed lost for P2.2/P2.4/P2.5; 8 seeds × 3 difficulties for P2.3; `td-wave-gen --check` after every edit | 24 distinct casts; no world pair above 0.9 backbone cosine; every finale median in 5-17 |
| 3 | PLAYABILITY + neglect **byte-identical** (oracle never uses abilities); P1.6's spam sim re-run with the new shapes | no finale leaves its band under spam |
| 4 | the P4.2 sweep (~3,400 runs, ~80 min) | greedy loadout returns L16 and L20 to 5-17; `103 > 96` |
| 5 | `tools/td-gates.js` per candidate level, then the full suite | every new level winnable by the shipped best-of-two oracle and losable by neglect on casual/normal/heroic; one lever per world; contiguous ids; boss on every 4th |
| 6 | per-challenge sim table with a lives floor and a ≤6-life seed-spread rejection | no challenge is a coin flip |

**Never tune against a stronger solver than the one in `tests/td-logic.test.js`.** That rule got
World 4 reverted once; `tools/td-sim.js` carries a verbatim copy for exactly this reason, and the
`tools/td-gates.js` addition in Phase 5 must not change it.