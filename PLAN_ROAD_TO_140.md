# 🗺️ Road to 140 — plan for the next 40 Josh games

**Status: PLANNED — not yet built.** This is the complete, handoff-ready build plan for
adding **40 new English-side games** (Josh's world only; 华丽's 40 are untouched),
taking Josh's catalog **100 → 140** (site total 180). It is written to be executed
by a fresh session with no other context beyond this repo: every game has its
mechanic, wiring, logic function, content, and tests specced; every known footgun
is called out. **Read `CLAUDE.md` (the 7 RULES + the self-healing learnings list)
and `JOSH_PROFILE.md` first — they are the constitution; this file is the work order.**

Difficulty mix follows the profile dial: ~70% **[W]** challenge (his live growth
edges), ~30% **[M]** confidence, a few gently-scaffolded **[P]/[NA]** — and co-op
(his #1 lever), transformation-not-decoration, Spidey/Numberblocks/space/friends
theming throughout.

---

## 0) Non-negotiables (pre-flight checklist for the builder)

Every one of these has burned us before or is guardrail-enforced. Violating any
of them will fail the suite — design them in from the start:

1. **Test contract.** Every game: correct next tap carries `data-correct="1"`
   (removed once consumed), `api.win()` when finished, `api.tryAgain(el)` on a
   wrong tap, pure toys mark `[data-toy]` + `api.tickPlay()` and STILL reach a
   one-time `api.win()` via a **click-count** (never a timer). The generic e2e
   harness plays every game by tapping the first `[data-correct]` (else first
   `[data-toy]`) for up to 800 iterations — so:
   - **Never leave `data-correct` on a hidden/inert element** (the menu-memory
     stall): if a reveal button gates the round, THE BUTTON holds the flag until
     tapped.
   - **Concentration games flag only the currently-solvable pair** (`syncFlags`
     pattern from `memory` / `hl-tile-memory`).
   - **Demo/watch phases ≤ ~8s per round** so the 800-iteration budget holds
     (copy-beat precedent).
2. **No distractor may also be correct.** The audit's #1 lesson. For every
   pick-the-answer game: prove the wrong choices are *uniquely wrong* (curate
   exclusion lists like `alsoOk` where reality is plural), restate the truth in
   `tests/content.test.js`, and remember **platform rendering is part of
   correctness** (the iOS "I"/"l" bare-stroke confusable → `lettersConfusable`).
3. **Mobile audit is merciless.** Every visible button ≥75×75px with ≥14px gaps
   at **320px** — so **button grids are ≤3 columns, always** (spans/display-only
   cells are exempt). Wrapping flex rows need `min-width: var(--tap)` on items.
   No horizontal overflow. `touch-action: manipulation` etc. come free from the
   shared `.choice`/`.tap` classes — use them.
4. **RULE 5 forever:** no timers, no fail states, no rapid-tap/precision, no
   multi-touch, `100dvh` not `100vh`, static background, sound OFF by default,
   every new animation gets a `prefers-reduced-motion` freeze (and a frozen
   state that still SHOWS the content).
5. **Audio through the framework only.** `api.say/setPrompt` for voice;
   instrument/effect notes via `JoshAudio.tone()` — a `new AudioContext` in a
   game file fails the guardrail.
6. **`JoshLogic.article(word)`** for any "a/an + dynamic word"; **no article
   before a proper name** (the "The Josh" lesson — friend names are capitalised,
   test with `/^[A-Z]/`).
7. **Pictures must name themselves** (sound-off law): the natural 4-year-old
   name of the emoji must BE the intended word. When unsure, pick a clearer
   picture (the 🐑"lamb"→🦐"shrimp" lesson).
8. **Emoji floor:** nothing newer than Unicode 13.0 (iOS 14.2). Everything in
   this plan is ≤13.0 (🦬 13.0 is our accepted floor precedent; 🛸 11, 🪐 12.0,
   🪙 13.0, 🦥 12.0, 🎆 6.0, 🀄 5.1 all fine). Do not substitute newer glyphs —
   already rejected here: 🫙 (U14), 🫲 (U14), 🥸 (U13.1). When in doubt, check
   the version before using a glyph.
9. **Playwright strict mode:** never reuse a class that a test locates globally
   (`.gate`, `.tile--surprise`, `.tile--stickers` are taken); scope any new
   test locator to its screen id.
10. **Registration & wiring:** register into the EXISTING domain file
    (`games-math.js`, `games-literacy.js`, `games-logic.js`, `games-science.js`,
    `games-fun.js`, `games-find.js`, `games-calm.js`) — no new script files, so
    `index.html`/`sw.js`/`SCRIPTS` wiring stays untouched. Add **every** new id
    to `CATEGORY_OF` in `main.js` (the "every game has a home tile" e2e test
    fails otherwise). Ids must be unique — the 40 below are pre-checked against
    the current 140.
11. **Pure logic lives in `scripts/logic.js`** (dual-export), unit-tested with
    the seeded `mulberry32` pattern; **all editable facts live in
    `scripts/content.js`** with a truth-table restatement in
    `tests/content.test.js`.
12. **Ship cadence (RULE 1/2/6):** build in 4 waves of 10. Per wave:
    `node --check` all touched files → unit tests → **full `npm test`** (plays
    all games incl. the new ones to a win + mobile audit) → fix → one commit →
    push to `main` → watch CI (test → deploy → **verify-live**) to green before
    the next wave. Never stack waves on a red.

---

## 1) Category distribution (40 new → per-menu totals)

| Category | now | + | new total | rationale |
|---|---|---|---|---|
| 🔢 Numbers | 18 | +7 | 25 | money [NA] scaffold step 2, measurement [P], descending count, doubles |
| 🔤 Letters | 15 | +7 | 22 | ending/middle sounds, word families, sentences — his [W] core |
| 🧠 Thinking | 15 | +6 | 21 | matrix reasoning, mental rotation, interpolated patterns |
| 🔍 Find It | 10 | +5 | 15 | inference-hunts + numeral hunt (confidence) |
| 🔬 Science | 16 | +5 | 21 | all-[M] fresh domains: sounds, diets, body, day/night animals |
| 🎉 Fun & Play | 10 | +4 | 14 | transformation toys: fireworks, web-swing, birthday |
| 🤝 Calm & Friends | 16 | +6 | 22 | co-op = his #1 lever; + a 华丽-bridge charmer |
| **Total** | **100** | **+40** | **140** | |

---

## 2) The 40 games — full specs

Format: **id · Title · icon — category · file · skill tag**. Then mechanic,
wiring, logic, content, tests, and layout notes. "Reuses X" = zero new logic.

### 🔢 Numbers (+7 → games-math.js)

**1. `nickel-trade` · Nickel Trade · 🪙 — numbers · [NA→P] money step 2**
The next money beat after Penny Shop/Piggy Bank: "a NICKEL is worth FIVE
pennies." Round: a big nickel (5¢ label) on top; below, 3 penny piles (drawn as
rows of 🪙×n, n distinct, one =5). Tap the pile worth the same. On correct the
pennies slide under the nickel and it "pops" (`.pop`). ROUNDS=4; ramp: piles
6/4/5 style near-misses once `shouldRamp(2)`.
*Logic:* new `makeCoinTrade(rng)` → `{ value: 5, piles: [{count, correct}]×3 }`
(counts distinct, exactly one === value, all 1..9).
*Tests:* unit — exactly one correct, counts distinct; content — none (no facts).
*Layout:* 3 pile buttons in `.choices--3` ✓. Prompt icons 🪙👀👉.

**2. `line-hop` · Number Line Hop · 🐸 — numbers · [M/W] teens on the line**
A number line window of 4 consecutive numerals with one blank (`?`), frog
sitting on it; tap the missing number from 3 chips. Rounds 1-2 draw from 0-10,
then 8-20 once ramped (teen practice). ROUNDS=4.
*Logic:* **reuses `makeOrderTrain`** (proven for 华丽) with
`String(n)` lists `["0".."10"]` / `["8".."20"]`.
*Tests:* none new beyond existing makeOrderTrain coverage (already unit-tested).
*Layout:* display tiles are spans (`.hl-runtile`-like, make a neutral
`.line__tile` class), 3 number chips ✓.

**3. `double-up` · Double It! · 🦋 — numbers · [W] doubles 1+1…5+5**
A butterfly with n dots on the left wing and the SAME n mirrored on the right
(mirror = the concrete control-of-error). "How many dots in all?" 3 numeral
chips. On correct the butterfly flutters (`.pop`). ROUNDS=4; n 1-3 first, 1-5
ramped.
*Logic:* new `makeDouble(rng, max)` → `{ n, sum, choices: [{n, correct}]×3 }`
(distractors `sum±1`, `sum±2`, all ≥1, distinct).
*Tests:* unit — sum===2n, one correct, distinct positive choices.
*Layout:* wing dots are spans inside an SVG/div; 3 chips ✓.

**4. `long-short` · Long or Short? · 📏 — numbers · [P] measurement compare**
Three caterpillars (rows of 🟢 segments, lengths clearly distinct — min delta 2
segments). Prompt alternates "Tap the LONGEST!" / "Tap the SHORTEST!" (spoken +
icon ⬅️➡️ arrows sized to match). Whole-row buttons. ROUNDS=4.
*Logic:* new `makeLengthPick(rng, last)` → `{ ask: "longest"|"shortest",
rows: [{len, correct}]×3 }` (lens distinct, pairwise delta ≥2, ask ≠ last).
*Tests:* unit — exactly one correct (the true max/min), deltas ≥2.
*Layout:* 3 full-width row buttons stacked (1 column) — each ≥75px tall ✓.

**5. `count-down` · Blast-Off Countdown · 🚀 — numbers · [W] descending order**
Solo version of the co-op countdown skill: numerals 5..1 (ramped: 10..1)
scattered as chips; tap them in DESCENDING order; each tap moves the rocket up
one notch, last tap launches it (reduced-motion: instant final frame). Uses the
order-num `flagNext` pattern with reversed ranks. ROUNDS=3.
*Logic:* new `makeCountdown(len, rng)` → `{ items: [{value, order}] }` where
order 0 = the LARGEST value (tap-first). Reuse `makeNumberSequence` internals or
implement standalone; ranks must be a permutation.
*Tests:* unit — descending mapping correct (order 0 is max), permutation valid.
*Layout:* chips in `.choices--3` (5 chips → 3+2 rows) ✓; rocket art via
`JoshArt.rocket()` (exists).

**6. `seesaw` · Heavy or Light? · ⚖️ — numbers · [P] weight compare**
A seesaw with two animals; the heavier side is DOWN (drawn tilt = built-in
control-of-error, like the color-mix reveal). Prompt alternates "Tap the
HEAVIER one!"/"…LIGHTER…". Tap one of the two animal buttons. ROUNDS=4.
*Logic:* new `makeSeesaw(pairs, rng, lastIdx)` → `{ pair, ask, heavyIdx,
correctIdx }`.
*Content:* `WEIGHT_PAIRS` — canonical, kid-obvious only:
🐘/🐭, 🐻/🐰, 🚗/🎈, 🐋/🐟, 🪨/🍃, 🐴/🐤 (heavy listed first).
*Tests:* content truth — restate all pairs, assert heavy≠light and no emoji in
two pairs (so a distractor can't cross-fit); unit — correctIdx matches ask.
*Layout:* 2 big buttons ✓. Tilt via CSS transform (reduced-motion: keep the
static tilted end-state — the tilt IS the information, never remove it).

**7. `side-count` · Count the Sides · 🔺 — numbers · [W] geometry × counting**
A big outlined shape; its sides light up one-by-one as the prompt counts aloud
(pure CSS stroke highlight; ≤3s). "How many sides?" 3 numeral chips.
Shapes: triangle 3, square 4, rectangle 4, pentagon 5, hexagon 6, circle 0
("no straight sides — zero!" delightful edge). ROUNDS=4, no repeat.
*Logic:* new `makeSideCount(shapes, rng, last)` → `{ shape, sides, choices }`.
*Content:* `SIDE_SHAPES` `{name, sides, svg-key}` (reuse the existing `SHAPES`
SVGs where names overlap; add pentagon/hexagon paths to `art or content` as
inline path data).
*Tests:* content truth — the side counts (square 4, hexagon 6, circle 0…);
unit — one correct chip, distinct.
*Layout:* 1 shape + 3 chips ✓. **Rectangle and square both = 4:** never show
both in one round's *distractor math* — sides value collision is fine since the
answer is a NUMBER; just ensure distractor numbers ≠ true count (standard).

### 🔤 Letters (+7 → games-literacy.js)

**8. `end-sound` · Ending Sound · 🔚 — letters · [W] phonemic awareness step 2**
Mirror of Beginning Sound: picture shown + spoken ("bus… bussss"); tap the
letter it ENDS with, 3 letter chips. ROUNDS=4.
*Logic:* new `makeEndSound(words, rng, last)` — mirror `makeFirstSound`'s shape.
*Content:* `END_WORDS` — words whose final sound = final letter, unambiguous,
self-naming pictures, ALL DISTINCT final letters so a distractor can never also
be right: 🚌 bus→s · 🐱 cat→t · ☀️ sun→n · 🥤 cup→p · 🐶 dog→g · ⭐ star→r ·
🛏️ bed→d · 🦊 fox→x. (No silent-e words, no digraph endings.)
*Tests:* content truth — every word truly ends with its letter; letters unique
across the set (the first-sound precedent).
*Layout:* 3 chips ✓.

**9. `vowel-pick` · The Missing Middle · 🅰️ — letters · [W] CVC vowels**
`c ▢ t` with a big CAT picture; tap the vowel that makes the pictured word
(choices from a/e/i/o/u). The picture is the control-of-error — a distractor
may form ANOTHER real word (cot/cut) but never the pictured one (the
missing-letter precedent, restated here deliberately).
*Logic:* new `makeVowelPick(words, rng, last)` → `{ word: {emoji, word, vowel,
vowelIdx}, display, choices }` (distractor vowels ≠ answer).
*Content:* `VOWEL_WORDS` — c**a**t, d**o**g, s**u**n, p**i**g, b**e**d,
b**u**g, h**a**t, p**o**t (picture names itself; vowel is the middle letter).
*Tests:* content truth — each word's keyed vowel really is its middle letter &
the emoji names the word; unit — display blanks exactly the vowel index.
*Layout:* word display + 3 chips ✓.

**10. `word-family` · Word Family Houses · 🏠 — letters · [W] rimes**
Two "houses" labeled **-at** and **-og** (per round, drawn from disjoint family
sets); a word card (emoji + printed CVC word, spoken) appears; tap the house it
belongs to. Round pool rotates families: (-at/-og), (-un/-ig), (-ed/-op).
ROUNDS=6 (sorter cadence).
*Logic:* new `makeFamilySort(familySets, rng)` → `{ item: {emoji, word},
bins: [{label}], correctIndex }` — same shape as `makeSort` so the game code
mirrors the proven sorter loop.
*Content:* `WORD_FAMILIES` — 3 sets of 2 disjoint families, words self-naming:
-at: cat/hat/bat/rat · -og: dog/log/frog/jog(🏃? use fog☁️? "fog" weak — use
dog/log/frog only, 3 is enough) · -un: sun/bun/run · -ig: pig/wig/dig ·
-ed: bed/red/sled · -op: mop/top/hop. **Truth test asserts every word ends with
its family rime and no word appears in two families.**
*Layout:* 2 house buttons ✓ (sorter CSS reuse).

**11. `letter-pairs` · Letter Pairs · 🃏 — letters · [W] case matching memory**
Concentration: 4 pairs of cards, each pair = uppercase↔lowercase of one letter
(A↔a). Card backs 🔤; `syncFlags` keeps `data-correct` on the currently-solvable
pair ONLY (mandatory — copy `memory`'s implementation).
*Logic:* none new — deck built inline from `LETTER_PAIR_POOL`.
*Content:* `LETTER_PAIR_POOL: ["A","B","D","E","G","M","Q","R"]` — hand-picked
so upper/lower differ visibly AND excludes the I/L confusable group (restate the
`lettersConfusable` lesson in the content comment + truth test asserts neither
"I" nor "L" is in the pool).
*Layout:* 8 cards in a 3-col grid (3/3/2) ✓.

**12. `sentence-build` · Build the Sentence · 🧱 — letters · [W] simple sentences**
A picture scene (e.g. 🐶💤); hear "The dog naps."; 3-4 word tiles shuffled
below; tap them in order — each lands in the sentence slot and is spoken. When
complete the whole sentence is read back + scene pops. `flagNext` ordered-tap
pattern (name-spell precedent). ROUNDS=3.
*Logic:* new `makeSentence(sentences, rng, last)` → `{ words[], tiles:
[{word, rank}] shuffled, emoji }`. **Duplicate words** (two "the") must match by
rank-value like name-spell's repeated letters.
*Content:* `SENTENCES` — spoken-supported, decodable-leaning:
{emoji:"🐶💤", words:["The","dog","naps"]}, {emoji:"🐱🛏️", words:["The","cat","is","in","bed"]}… 6 total, ≤5 words, only words a grown-up hears + he decodes partially.
*Tests:* content — every sentence ≤5 words, non-empty; unit — tiles are a
permutation, ranks 0..n-1.
*Layout:* tiles in `.choices--3` max 3 cols; ≤5 tiles OK (3+2) ✓.

**13. `silly-match` · Silly Stories · 🤪 — letters · [W] listening comprehension**
Hear a silly sentence ("The DOG wears a HAT!"); tap the matching combo picture
among 3 composite cards (🐶🎩 vs 🐱🎩 vs 🐶👟) — distractors each differ in
exactly one element, never both match. Distinct from listen-answer (who-has-
what across a cast) — this is single-scene absurdity = comprehension + giggles.
ROUNDS=4.
*Logic:* new `makeSilly(scenes, rng, last)` → `{ scene: {animal, item, say},
choices: [{animal, item, correct}]×3 }` — distractors mutate exactly one slot;
assert no distractor equals the target pair.
*Content:* `SILLY_SCENES` — animals × items with spoken lines; both slots'
emoji self-naming (🐶 dog, 🎩 hat, 👟 shoe, 🎈 balloon, 🐸 frog, 👑 crown…).
*Tests:* unit — exactly one both-match; content — pool emoji self-naming set
non-overlapping (an item never doubles as an animal).
*Layout:* 3 composite cards ✓.

**14. `abc-dots` · ABC Dot-to-Dot · ✏️ — letters · [W] alphabet order + reveal**
Dot-to-dot, but the dots are A→H (8 letters, a window that ROTATES start per
round — reuse the alpha-train windowing so it's not always A-first). Tapping in
alphabet order draws the lacing line and reveals a surprise emoji (dot-dot's
reveal machinery/CSS reused, letter labels instead of numerals). ROUNDS=2.
*Logic:* reuse `makeAlphaTrain`-style windowing for the letter run (window 8 via
a tiny new `alphaRun(rng, len)` helper in logic.js returning consecutive
letters) + dot-dot's inline path/step code.
*Tests:* unit — run is consecutive, len 8, whole alphabet reachable.
*Layout:* the dot buttons are the existing `.trace__dot` var(--tap) class over
a `PATHS` layout — **reuse an existing `C.PATHS` geometry** (already
audit-proven at 320px) rather than inventing new dot coordinates.

### 🧠 Thinking (+6 → games-logic.js)

**15. `pattern-fix` · Fix the Pattern · 🩹 — thinking · [W] pattern interpolation**
What-next's sibling: the gap is in the MIDDLE (🔴🔵🔴▢🔴🔵), not the end. Uses
the same PATTERN_SETS/unit machinery; blank never index 0. 3 choices (the pair
token + one outside token). ROUNDS=4, AB then AAB when ramped.
*Logic:* new `makePatternFix(sets, rng, opts)` → `{ cells[], blankIdx≥1,
answer, choices }` — answer = `unit[blankIdx % unit.length]`.
*Tests:* unit — answer correctness across unit types & every blankIdx (exhaustive like makePattern's test).
*Layout:* pattern row = spans; 3 chips ✓.

**16. `little-matrix` · The Little Matrix · 🔲 — thinking · [W] attribute crossing**
2×2 matrix: rows = size (big/small), cols = color (red/blue) of one object;
three cells filled, bottom-right `?`. Tap the completing card among 3 (correct
= right size AND color; distractors differ in ≥1 attribute). His trinomial-cube
[W] made screen-sized. ROUNDS=3.
*Logic:* new `makeMatrix2(rng, opts)` → `{ cells: [{size, color}×3],
missing: {size, color}, choices×3 }` — colors from a 3-color pool, object emoji
from a small pool (⭐🎈🚗🐟); assert exactly one both-attribute match.
*Tests:* unit — missing cell = row∧col attributes; distractors never both-match.
*Layout:* 2×2 display grid (spans) + 3 card buttons ✓. Size shown by font-size
×1.6 vs ×1.0 (clearly distinct); color via emoji tint? — **use colored shape
divs (like hl-hunt-two's `.hl-shape` approach), not emoji tinting** (emoji
can't recolor).

**17. `left-right` · Left or Right? · ⬅️ — thinking · [P] directionality**
Two big boxes; a star sits in one. Prompt: "Tap the box on the LEFT!" with a
giant ⬅️/➡️ icon carrying it for sound-off. The star is a decoy ~half the time
(it may sit on the asked side or not — the question is about SIDES, not the
star; keep round 1-2 star-on-answer as the worked example, then decouple).
ROUNDS=4.
*Logic:* new `makeLeftRight(rng, last)` → `{ side, starSide, correctIdx }`
(side ≠ last).
*Tests:* unit — correctIdx matches side; alternation guard.
*Layout:* 2 boxes ✓.

**18. `block-count` · Count the Blocks · 🧊 — thinking · [W] spatial counting**
An isometric block figure (drawn like birds-eye's cubes) of 3-6 cubes in an
L/row arrangement where **every cube's top face is visible** (the Look-From-
Above occlusion law, restated: single-height only, no cube behind a taller
one). "How many blocks?" 3 chips. ROUNDS=4.
*Logic:* new `makeBlockCount(rng, last)` → `{ n, cells: [[gx,gy]…] }` from a
fixed set of legal single-height layouts (hand-authored, 6-8 layouts).
*Tests:* unit — layouts each have n distinct cells, all single-height (the
guardrail: assert the generator only emits height-1 — mirror the birds-eye
guardrail).
*Layout:* SVG figure + 3 chips ✓. Reuse birds-eye's cube-drawing helper if
exported; else copy its path math into this game (same file).

**19. `opposites` · Opposites! · ↔️ — thinking · [W] concept vocabulary**
Show a concept picture (🔥 hot); "What's the OPPOSITE of hot?" tap among 3
picture chips (🧊 cold + 2 non-opposites from other pairs). ROUNDS=4.
*Logic:* **reuses `makePairPick`** with items
`{q: "🔥 hot", a: "🧊 cold"}`-style objects — pairPick compares `.a` by value,
so make `a` the full `"emoji word"` string (its dedupe + ≠-answer filters then
work unchanged).
*Content:* `OPPOSITE_PAIRS` — one concept per pair, no concept reused:
hot🔥/cold🧊 · big🐘/small🐭 · day☀️/night🌙 · up⬆️/down⬇️ · happy😊/sad😢 ·
open📖/closed📕 · full🥛/empty🫙(→ use 🥛/🍽️? **🫙 is Unicode 14 — banned.**
Use wet💧/dry🏜️ instead of full/empty) · fast🐆/slow🐌.
*Tests:* content truth — restate all pairs; each emoji/word appears in exactly
one pair (the antonym-uniqueness precedent from 华丽).
*Layout:* 3 chips ✓.

**20. `turn-match` · Turned Around · 🔄 — thinking · [W→P] mental rotation**
A target shape (asymmetric: arrow, flag, boot-L, key-ish polygon); below, 3
choices: the SAME shape rotated 90°/180° (correct) + 2 DIFFERENT shapes at any
rotation. "Which one is the same shape, just turned?" First round is a worked
demo: the target visibly rotates onto the answer once (≤2s, reduced-motion:
skip straight to settled state). ROUNDS=3.
*Logic:* new `makeTurnMatch(shapes, rng, last)` → `{ target, rotation,
choices: [{shape, rot, correct}] }` — correct shares `shape`, differs in rot;
distractor shapes ≠ target shape.
*Content:* `SHAPES_ASYM` — 4 inline-SVG asymmetric paths (arrow, flag, L-boot,
lightning). **Never symmetric shapes** (a rotated circle/square is
indistinguishable → ambiguity trap; truth test asserts the pool is only these
curated four).
*Tests:* unit — one correct; correct's shape===target, distractors' ≠.
*Layout:* target + 3 shape buttons ✓ (SVG in `.choice--shape` sizing).

### 🔍 Find It (+5 → games-find.js)

**21. `whose-tracks` · Whose Tracks? · 🐾 — find · [W] inference hunt**
A trail of footprints (drawn: paw dots / bird arrows / hoof crescents as simple
SVG stamps) leads to a bush; "Who made these tracks?" 3 animal chips.
ROUNDS=4.
*Logic:* **reuses `makePairPick`** with `{q: trackKey, a: "🐶 dog"}`-style
items (a-values unique so distractors are auto-safe).
*Content:* `TRACKS` — paw→dog · bird-arrows→bird · hooves→horse ·
big-paw→bear · tiny-dots→mouse · webbed→duck. Six, visually DISTINCT stamp
styles (truth test: track keys unique, animals unique).
*Layout:* track scene (display) + 3 chips ✓.

**22. `more-in-scene` · More Fish or Ducks? · 🦆 — find · [W] count-compare in a scene**
A pond scene with a fish and b ducks scattered (spans, a≠b, both 2-5); "Are
there more FISH or more DUCKS?" — two big kind-buttons (🐟 vs 🦆). Tap the kind
with more; on correct each group counts itself aloud (items pulse one-by-one).
ROUNDS=4 with rotating kind-pairs (fish/ducks, stars/moons, cars/buses).
*Logic:* new `makeSceneCompare(kinds, rng, last)` → `{ a: {emoji, n},
b: {emoji, n}, answerIdx }` (n distinct, 2..5).
*Tests:* unit — answerIdx points at the larger n; n's distinct.
*Layout:* scene spans + 2 buttons ✓.

**23. `clue-hunt` · Little Detective · 🕵️ — find · [W] sequential deduction**
Six suspect cards (color × kind combos, all distinct); clues arrive ONE at a
time, each spoken + iconed: "It's an ANIMAL…" (non-animals dim), "…and it's
RED!" (non-red dim) — one card remains lit; tap it. The dimming does the
narrowing visually (self-checking). ROUNDS=3.
*Logic:* new `makeClueHunt(rng)` → `{ cards: [{kind, color, emoji}×6],
clues: [kindClue, colorClue], answerIdx }` — combos unique (the who-is-it
uniqueness precedent).
*Content:* small pools: kinds animal/vehicle, colors red/blue/green with per-
combo emoji (🐞 red animal, 🚗 red vehicle, 🐳 blue animal, 🚙 blue vehicle,
🐸 green animal, 🚜 green vehicle) — 6 exact.
*Tests:* content — the 6 combos each appear once and the emoji truly is that
color+kind; unit — clues select exactly one card.
*Layout:* 6 cards in 3-col grid (3/3) ✓; `data-correct` sits on the answer card
from round start (dimming is presentation; wrong taps get `tryAgain`).

**24. `number-hunt` · Number Hunt · 🎈 — find · [M→W] numeral recognition**
Letter Hunt's numeral sibling: pop every balloon showing the target number.
Rounds 1-2 targets 1-9; ramped rounds mix in teens (11-19) — his teen-board
[M/W]. Distractor numerals never equal the target.
*Logic:* **reuses `makeLetterHunt`** with a numeral-string pool
(`["1".."9"]`, ramped `["7".."19"]`), `mixCase: false`.
*Tests:* covered by existing makeLetterHunt tests; add one unit case with
numeral pools (target pinned-free, distractors ≠ target).
*Layout:* 9 balloons in 3-col grid ✓ (letter-hunt CSS reuse).

**25. `star-search` · Star Search · 🌟 — find · [M] cozy space hunt**
His space love: a deep-blue night scene; find and tap all K ⭐ hidden among
🌙☁️🚀🛸🪐 (all ≤ Unicode 12). Each found star "lights" (glow class); when all
K found the sky connects them with lines into a mini constellation (SVG
polyline through the found cells' centers) — transformation payoff. K=3,
ramped 4. ROUNDS=3.
*Logic:* inline build like `hl-lantern` (the pinned-target precedent): K×⭐ +
fill from the distractor pool, `api.shuffle`.
*Tests:* none beyond harness (inline composition precedent) — but add the
night-scene class to the reduced-motion freeze list if the glow animates.
*Layout:* 9 cells, 3-col ✓; scene container needs dark bg but the CELLS stay
the standard `.choice` size/contrast (dark tile face, light border).

### 🔬 Science (+5 → games-science.js)

**26. `animal-sounds` · Who Says Moo? · 🐮 — science · [M] + decoding crossover**
A big speech bubble with a short decodable sound word ("MOO", spoken aloud);
"Who says MOO?" tap among 3 animal chips. The bubble text is one of the few
child-facing words in the app — deliberately, because he decodes 3-letter
words [M].
*Logic:* **reuses `makePairPick`** `{q: "MOO", a: "🐮 cow"}`.
*Content:* `ANIMAL_SOUNDS` — cow→MOO · dog→WOOF · cat→MEOW · duck→QUACK ·
sheep→BAA (🐑 fine HERE: both sheep and lamb say baa — note this exemption in
the content comment) · frog→RIBBIT. Sounds unique, animals unique.
*Tests:* content truth — pairs restated; both columns unique.
*Layout:* 3 chips ✓.

**27. `who-eats` · Who Eats This? · 🍌 — science · [M] animal diets**
Show a food; "Who eats the banana?" 3 animal chips. **The audit lesson applies
hard here** (many animals eat many things): each food's content entry carries
an `eaters` list of EVERY plausible eater in our pool, and the distractor
picker excludes them (the `alsoOk` pattern, generalized).
*Logic:* new `makeWhoEats(items, rng, last)` → `{ food, choices }` —
distractors drawn from animals NOT in `food.eaters`.
*Content:* `FOOD_EATERS` — bamboo→🐼 (eaters: panda only) · worm→🐦 (bird) ·
acorn→🐿️ (squirrel) · banana→🐵 (eaters: monkey, *exclude* 🐦? birds don't eat
bananas in kid-canon — but list generously) · carrot→🐰 (eaters: rabbit,
horse — so 🐴 may never be a distractor for carrot) · bone→🐶 (dog).
*Tests:* content — every food's primary is in its eaters; unit — no distractor
∈ eaters (the makeMeasureWord guardrail shape, reused).
*Layout:* 3 chips ✓.

**28. `body-parts` · Simon Says: Touch! · 🙋 — science · [M/W] body vocabulary**
A big `JoshArt.friend()` figure with 5 large circular zone buttons overlaid
(head, hand, tummy, knee, foot — each ≥75px, hand-positioned %s like FU_PATH).
"Touch the KNEE!" — tap the right zone; it sparkles. ROUNDS=5, no repeat, friend
rotates per game.
*Logic:* new `makePartPick(parts, rng, last)` → `{ part, correctIdx }` (trivial
picker, still unit-tested for no-repeat).
*Content:* `BODY_PARTS` `{key, label, x, y}` — **geometry test like FU_PATH's:**
restate the mobile-audit math (76px dots on the figure's box at 320px, no
overlap, ≥14px gaps) in `content.test.js` so a future zone edit can't collide.
*Layout:* one figure + 5 absolute zone buttons (audited by geometry test) ✓.

**29. `night-friends` · Awake at Night? · 🦉 — science · [M] nocturnal sort**
Sorter-factory game (2 bins: 🌙 Night / ☀️ Day): owl, bat, firefly are awake at
night; rooster, bee, butterfly by day. Spoken whys on every bin ("Owls wake up
when the moon comes out!").
*Logic:* **reuses the `sorter()` factory + `makeSort`** — zero new logic.
*Content:* `NIGHT_DAY_SET` `{name:"nightday", prompt, icons, bins:[...]}`, all
items single-bin (**verify none of these emoji already sits in DAY_NIGHT_SETS
with a conflicting assignment — one-truth rule; if 🦉 exists there, reuse that
set's assignment or share the entry**).
*Tests:* content truth — bins restated, no dual membership, whys present.
*Layout:* sorter CSS ✓.

**30. `fast-slow` · Fast or Slow? · 🐆 — science · [M] speed sort**
Sorter-factory: 🐆 cheetah, 🚀 rocket, 🏎️ race car, ⚡ lightning = FAST;
🐌 snail, 🐢 turtle, 🦥 sloth (Unicode 12 ✓), 🚶 walking = SLOW. Whys spoken.
*Logic:* **reuses `sorter()` + `makeSort`.**
*Content:* `FAST_SLOW_SET`; truth test restates every item, no dual membership.
*Layout:* sorter CSS ✓.

### 🎉 Fun & Play (+4 → games-fun.js)

**31. `fireworks` · Fireworks Show · 🎆 — play · toy, cause→effect**
Tap the night-sky button anywhere → a firework bursts at a random spot (CSS
scale+fade of a burst div; JoshAudio-muted pop via `goodCue`? NO — cues are
framework-fired; use `A.tone()` short note like music-pad, gesture-gated).
Counts each burst aloud. `[data-toy]` + `tickPlay`; **wins once at 6 bursts**
("What a show!") then keeps playing. Reduced-motion: bursts render as an
instant static starburst, still visible.
*Logic:* none.
*Layout:* one full-stage button ✓.

**32. `silly-face` · Silly Face Maker · 😜 — play · toy, autonomy**
A friend's face (JoshArt) with 3 big part-buttons below: 👀 eyes · 👃 nose ·
👄 mouth — each tap cycles that feature through 3 silly variants (drawn as
overlay emoji/SVG swaps). All three are `[data-toy]`; win once after 6 total
taps ("What a fantastic silly face!") and keep playing.
*Logic:* none (cycle index per part).
*Layout:* face + 3 buttons ✓.

**33. `web-swing` · Web Swing! · 🕸️ — play · [M] ordered taps, hero transformation**
Spidey stands at the left of a 5-building skyline; the NEXT building carries
`data-correct` — tap it and he web-arcs to its roof (CSS transform transition;
reduced-motion: teleport). 5 taps crosses the city → `api.win()` ("You swung
across the whole city!"). ROUNDS=2 (second pass reverses direction).
*Logic:* none (sequential flagNext, order fixed left→right).
*Layout:* 5 building buttons — **5 across breaks 320px**: stagger as a 3-col
grid of tall buildings (3+2) with the skyline drawn behind; order is by number
badge 1-5 on the buildings, not x-position (keeps the ≤3-column law while the
hero still hops building-to-building).
*Art:* hero via `JoshArt.hero()`.

**34. `birthday-cake` · Birthday Cake · 🎂 — play · [M] counting + his Feb-14 hook**
"Josh is turning FIVE! Put 5 candles on the cake." One big candle-pile button
(`data-correct`) — each tap adds a lit candle to the cake (count spoken).
After the 5th, the pile's flag moves to the CAKE button ("Now blow them out!")
— tap → flames puff to smoke wisps + `api.win()` + confetti. Exactly one
`data-correct` at a time (the menu-memory lesson). ROUNDS=1 (it's a moment,
like certificate).
*Logic:* none. *Content:* none (age 5 stated as "turning five" — birthday
theme is profile-sanctioned).
*Layout:* cake display + 2 sequential buttons ✓.

### 🤝 Calm & Friends (+6 → games-calm.js)

**35. `team-story` · Team Story Time (2 players) · 📖 — friends · [W] co-op sequencing**
Story-order's co-op wrapper: players alternate tapping the NEXT panel of a
STORY_SEQUENCES sequence; `coopTurn()` banner shows whose go (friend faces).
Wrong-order tap = gentle bump, turn stays. Sequence completes → both celebrate.
ROUNDS=2 sequences.
*Logic:* **reuses `makeStoryOrder` + `coopTurn`** (both exist). The active
player's correct panel carries `data-correct` (only one flag: the intersection
of "right panel" AND "any player may tap it" — turn only gates WHO, panels gate
WHAT; simplest correct wiring: flag the right panel, on tap advance BOTH step
and turn).
*Layout:* panels in `.choices--3`/`--4` per sequence length ✓.

**36. `team-house` · Team House Build (2 players) · 🏘️ — friends · [W] co-op construction**
Six build-pieces in a tray (🟫 base, 🟥 wall, 🟨 window, 🚪 door, 🔺 roof,
🎏 flag); players alternate; the CURRENT step's piece carries `data-correct`;
tapped pieces fly onto the house outline which visibly assembles (transformation).
Complete → win.
*Logic:* fixed build order array (content `HOUSE_STEPS` with spoken step lines);
flagNext pattern.
*Layout:* house display + 6 tray buttons in 3-col ✓.

**37. `garden` · Quiet Garden · 🌷 — friends(calm) · toy, calm beat**
Calm toy: 5 flower buds (`[data-toy]`); tap a bud → it blooms slowly (1.5s CSS,
reduced-motion: instant bloom) with a soft `A.tone()` pentatonic-ish note.
All 5 bloomed = one-time win ("What a peaceful garden.") then buds re-seed for
endless calm play.
*Logic:* none.
*Layout:* 5 buds in 3-col ✓.

**38. `world-hello` · Hello Around the World · 👋 — friends · [M/W] social/culture**
The four friends' portraits; tap each friend and they wave + greet in a
language from their heritage: Josh "Hello!", River "你好!" (nǐ hǎo), Viraj
"Namaste!", Raegar "Privet!" — spoken via `api.say` (the zh line may use plain
`say` — the framework voice handles EN; 你好 spoken via the existing
`A.say(t, {lang:"zh-CN"})` override, which audio.js already supports). A
speech bubble shows the greeting for the grown-up. Greet all 4 → win ("You said
hello around the whole world!"). Repeatable taps keep waving after the win.
*Content:* `GREETINGS` `{name, word, lang?}` truth-tested: River↔你好(Chinese),
Viraj↔Namaste(Hindi), Raegar↔Privet(Russian), Josh↔Hello — matches each
friend's heritage in `FRIENDS`/profile.
*Wiring:* each ungreeted friend carries `data-correct`; greeting consumes it.
*Layout:* 4 portrait buttons in 2×2 ✓ (`choices--4`).

**39. `team-pizza` · Team Pizza Party (2 players) · 🍕 — friends · [W] co-op fair shares**
Six slices on a tray; two plates (Josh's + the friend's). Players alternate:
the active player taps a slice (`data-correct` on any remaining slice during
your turn — flag ONE specific slice to keep the contract single-target) and it
flies to the CURRENT player's plate. When the tray empties both plates show 3=3
("Equal shares — fair and square!") → win.
*Logic:* trivial inline (deal alternates automatically = always fair; the
learning is the ritual + turn-taking, fairness is the visible outcome).
*Layout:* tray slices 3-col + two plate displays ✓.

**40. `grandma-helper` · Grandma's Visit · 👵🏻 — friends · [M] cross-world charm**
The bridge game: "Grandma is visiting! Help her find her things." A 9-cell grid
of Josh's toys (🚗🧸⚽🎈🦖…) hiding K=3 of grandma's things (🀄 🏮 🍵 — her
world's motifs); tap all 3 → each tap says what it is ("Her mahjong tile!") and
on the win grandma appears (👵🏻 pop) with "谢谢! Thank you, Josh!" (the one
loving zh word, spoken with the zh-CN override; bubble text for the grown-up).
Pure warmth + narrative tie to the hidden world he may someday discover.
*Logic:* inline find-K (hl-lantern/star-search pattern).
*Content:* `GRANDMA_ITEMS` (targets) + toy distractor pool; truth test —
target set and distractor pool disjoint.
*Layout:* 9 cells 3-col ✓.

---

## 3) New shared code — consolidated

**`scripts/logic.js` — 16 new functions** (each dual-exported + seeded-RNG unit
tests in `tests/logic.test.js`, mulberry32 pattern, ≥300 iterations each):
`makeCoinTrade` · `makeDouble` · `makeLengthPick` · `makeCountdown` ·
`makeSeesaw` · `makeSideCount` · `makeEndSound` · `makeVowelPick` ·
`makeFamilySort` · `makeSentence` · `makeSilly` · `makePatternFix` ·
`makeMatrix2` · `makeLeftRight` · `makeBlockCount` · `makeTurnMatch` ·
`makeSceneCompare` · `makeClueHunt` · `makePartPick` · `alphaRun` (that's 20 —
the extra 4 are trivial pickers; shapes specced per-game above).
**Reused with zero changes:** makeOrderTrain, makeLetterHunt, makePairPick (×4
games), makeSort + sorter factory (×2), makeStoryOrder, coopTurn, JoshArt
(hero/rocket/friend), the memory `syncFlags` pattern, dot-dot path machinery.

**`scripts/content.js` — new blocks** (each with a truth restatement in
`tests/content.test.js`): `WEIGHT_PAIRS`, `SIDE_SHAPES`, `END_WORDS`,
`VOWEL_WORDS`, `WORD_FAMILIES`, `LETTER_PAIR_POOL`, `SENTENCES`,
`SILLY_SCENES`, `OPPOSITE_PAIRS`, `SHAPES_ASYM`, `TRACKS`, `SCENE_KINDS`,
`CLUE_CARDS`, `ANIMAL_SOUNDS`, `FOOD_EATERS`, `BODY_PARTS` (+geometry test),
`NIGHT_DAY_SET`, `FAST_SLOW_SET`, `HOUSE_STEPS`, `GREETINGS`, `GRANDMA_ITEMS`.

**`scripts/main.js`:** add all 40 ids to `CATEGORY_OF` (mapping in §2 headers).

**`styles/main.css`:** new classes per game (`.line__tile`, `.seesaw__*`,
`.matrix__*`, `.blocks__*`, `.sky__*`, `.house__*`, `.pizza__*`, zone dots,
etc.) — every button ≥ `var(--tap)`, ≤3 columns, and every new animation added
to the `prefers-reduced-motion` block **with its end-state still visible**.

**Docs:** at the final wave update `CLAUDE.md` (counts 100→140, category
bullet lists get the new titles, sticker meter 140/140, extend the learnings
list if new ones emerge) — the sticker book / launcher / badges / 华丽-
separation all inherit automatically (they filter `!g.hl`; Josh's book slot
count is asserted as the non-hl count, so it self-updates to 140).

---

## 4) Build waves (each ends green-and-live before the next)

| Wave | Games (10) | Character |
|---|---|---|
| **W1 — reuse-heavy spine** | line-hop, number-hunt, star-search, opposites, whose-tracks, animal-sounds, night-friends, fast-slow, team-story, garden | 9 of 10 reuse proven logic/factories — bank the wiring pattern & CATEGORY_OF/e2e/mobile plumbing with minimal new surface |
| **W2 — numbers & letters core** | nickel-trade, double-up, long-short, count-down, seesaw, side-count, end-sound, vowel-pick, word-family, letter-pairs | the new-logic cluster for his [W] academics; write unit tests FIRST |
| **W3 — thinking & language stretch** | pattern-fix, little-matrix, left-right, block-count, turn-match, sentence-build, silly-match, abc-dots, more-in-scene, clue-hunt | the most novel mechanics; each gets its worked-example onboarding beat |
| **W4 — play, co-op & finale** | fireworks, silly-face, web-swing, birthday-cake, team-house, world-hello, team-pizza, grandma-helper, body-parts, + CLAUDE.md/docs update | toys/co-op/charm + the docs commit; run the FULL audit-style diff review before the final push |

**Per-wave gate (mandatory, in order):**
1. Write the wave's content truth tests + logic unit tests (red), then the
   content + logic (green).
2. Build the 10 games; `node --check` every touched file.
3. `node --test tests/site.test.js tests/content.test.js tests/logic.test.js`
   → green.
4. **Full `npm test`** (e2e drives ALL games — 150/160/170/180 by wave — plus
   the 320px mobile audit) → green. Budget ~6-8 min locally; investigate ANY
   flake rather than re-running blind.
5. One commit (message lists the wave's games), push to `main`, watch CI:
   test → deploy → **verify-live** all green (poll the workflow run; the
   live-URL suite is the real proof).
6. Only then start the next wave. A red at any step is stop-the-line.

---

## 5) Risk register (what will bite, and the planned defense)

| Risk | Defense (designed-in above) |
|---|---|
| A distractor is also a true answer (the audit's top class) | curated exclusion lists (`eaters`, opposite-uniqueness, track/sound uniqueness), truth tests per fact table, direction-of-question chosen for uniqueness (who-eats asks food→animal) |
| Harness stall on gated/hidden flags | reveal buttons own `data-correct` (birthday-cake two-phase; menu-memory lesson), concentration uses syncFlags, exactly one flag at a time in turn games |
| 320px audit failures | every layout in §2 pre-checked ≤3 button columns; body-parts/abc-dots reuse or geometry-test their dot layouts (FU_PATH precedent) |
| Rotation/symmetry ambiguity (turn-match) | asymmetric-only curated shape pool, truth-tested |
| Occlusion ambiguity (block-count) | single-height layouts only, generator-level guardrail (birds-eye precedent) |
| Emoji not on Josh's iPad | Unicode ≤13 floor; 🫙 explicitly rejected in §2; verify any substitution against emojipedia version |
| Playwright strict-mode collisions | no reuse of globally-located classes; new-game e2e additions (if any) scope to `#screen-<id>` |
| Suite runtime growth (180 games) | waves keep it incremental; if e2e nears CI limits, bump the harness loop cap comment only — never weaken assertions |
| zh voice in world-hello/grandma-helper | uses the EXISTING `A.say(t,{lang:"zh-CN"})` override (audio.js already supports it); no framework changes |
| Doc drift | W4 includes the CLAUDE.md count/category/learnings update as a listed deliverable |

---

## 6) Definition of Done (the whole plan)

- 140 Josh games registered & mapped in `CATEGORY_OF`; 180 total on the site.
- Full suite green **locally and on CI**, including: every one of the 180 games
  driven to a win by the generic harness; 320px/390px mobile audits on every
  screen; all new truth tables and unit tests passing; zero uncaught page
  errors.
- Josh's Sticker Book reads **140 slots** (and fills to 140/140 after the
  harness run); 华丽's stays 40/40; his reset still preserves hers.
- `verify-live` green on the final push; CLAUDE.md updated (counts, category
  lists, any new learnings).
- No regression anywhere: every pre-existing test still passes unmodified
  except where a count assertion legitimately grows (e.g. docs, never weakened
  logic assertions).
