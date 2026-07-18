# 🗺️ Road to 180 — Set 2: forty MORE Josh games (build AFTER Road-to-140)

**Status: PLANNED — not yet built. Sequenced strictly AFTER
`PLAN_ROAD_TO_140.md`** (its 40 games are Set 1; this file is Set 2). Executing
this plan takes Josh's catalog **140 → 180** (site total 220 with 华丽's 40).

**Everything in §0 of `PLAN_ROAD_TO_140.md` applies verbatim** — the test
contract, the no-distractor-also-correct law, the ≤3-button-column 320px rule,
the Unicode ≤13.0 emoji floor, the wave gate (tests-first → full `npm test` →
push → CI green incl. verify-live). Do not start without reading `CLAUDE.md`,
`JOSH_PROFILE.md`, and that checklist. This file adds only what's NEW.

## What makes Set 2 different (the variety mandate)

Set 1 deepened the existing tap-the-answer shapes. Set 2 deliberately
introduces **six new interaction mechanics** — each specced here with its
harness-safe wiring so the generic e2e player can still win every game:

| New mechanic | How the harness stays happy |
|---|---|
| **A. Two-tap pick-and-place** (tap the thing, then tap where it goes) | Exactly ONE `data-correct` at any moment: first the pick item; once picked, the flag MOVES to the correct destination. Wrong destination → `tryAgain`, pick stays held. Never flag pick+place simultaneously (the menu-memory lesson, extended). |
| **B. Toggle-to-match** (tap cells to match a model) | Flag EVERY cell whose state ≠ the model (multi-flag is contract-legal — harness taps the first). Each correct tap fixes that cell and unflags it; zero flagged → auto-win. Tapping an already-matching cell does NOT toggle it (no undoing progress — no-fail): gentle bump + "that one already matches!". |
| **C. Progressive reveal** (peek/curtain steppers) | The reveal control carries NO flag (harness ignores it; the child uses it); the answer chips are flagged from round start, so blind-solving stays possible (the `hl-tile-peek` precedent). Reveals are self-paced taps, never timed. |
| **D. Leader/follower co-op echo** (P1 shows, P2 copies) | The demo tap is scripted by the game (auto-highlight, ≤2s), then the follower's matching button holds the flag. Alternating leadership each round. |
| **E. Pictograph / representation reading** (graphs, ordinals, parity) | Standard single-flag chips — the novelty is the REPRESENTATION, not the input. |
| **F. Path/continuity tracing choice** | Whole-path buttons (tap the path, not trace it) — visual tracing happens in the eyes, input stays one forgiving tap. |

Rules for the new shapes: every fly/settle animation ≤600ms with a
`prefers-reduced-motion` instant end-state; picked items get a visible "held"
state (lift + glow); a held item can be re-tapped to put it down (forgiving).

---

## 1) Category distribution (Set 2 → running totals after BOTH sets)

| Category | after Set 1 | Set 2 | after Set 2 |
|---|---|---|---|
| 🔢 Numbers | 25 | +6 | 31 |
| 🔤 Letters | 22 | +6 | 28 |
| 🧠 Thinking | 21 | +6 | 27 |
| 🔍 Find It | 15 | +6 | 21 |
| 🔬 Science | 21 | +5 | 26 |
| 🎉 Fun & Play | 14 | +4 | 18 |
| 🤝 Calm & Friends | 22 | +7 | 29 |
| **Josh total** | **140** | **+40** | **180** |

(Friends gets the biggest slice again — co-op is his #1 lever, and Set 2 adds
four NEW co-op shapes, not reskins.)

---

## 2) The 40 games — specs

Same format as Set 1; mechanics letter-tagged (A–F) where a new shape applies.
All ids pre-checked unique against the live registry AND Set 1's 40.

### 🔢 Numbers (+6 → games-math.js)

**1. `coin-mix` · Coin Mix-Up · 💰 — [NA→W] money step 3.** After nickel-trade:
count a small MIXED pile (1 nickel drawn big + 1-4 pennies) → total 6-9¢; 3
chips. On correct, the nickel bursts into 5 pennies that line up with the rest
and count themselves (the concrete proof). ROUNDS=4.
*Logic:* new `makeCoinMix(rng, last)` → `{ pennies, total: 5+pennies,
choices }`. *Layout:* coin display spans + 3 chips ✓.

**2. `ordinal-line` · First, Second, Third! · 🥇 — [P] ordinal words.** 4-5
animals queue for ice cream (a line, front clearly marked by the 🍦 stand);
"Tap the THIRD one in line!" — spoken + the numeral shown as "3rd". Correct
animal hops forward and gets a cone. ROUNDS=4, ordinal ≤ line length.
*Logic:* new `makeOrdinal(rng, opts)` → `{ len, ord, correctIdx }` (correctIdx
= ord-1 counted FROM THE STAND side; the stand side is fixed left so "first"
is visually unambiguous — state this in the content comment).
*Layout:* queue = one row of ≤5 animal BUTTONS… 5 across breaks 320px → queue
renders as a **vertical line walking down to the stand** (5 rows of 1, each
full-width ≥75px) — reads naturally as "who's next" top-to-bottom ✓.

**3. `about-five` · More or Fewer than 5? · 🖐️ — [W] number sense.** A
scattered group of n objects (n ∈ {2,3,4,6,7,8} — NEVER exactly 5); two big
bins: "fewer than 5" (🖐️ with few dots) / "more than 5" (🖐️ + more dots). On
correct the objects count themselves aloud one-by-one as proof. ROUNDS=4.
*Logic:* new `makeAboutFive(rng, last)` → `{ n, answerIdx }` with n≠5 asserted.
*Tests:* unit — n never 5, answer matches n<5/n>5. *Layout:* 2 bins ✓.

**4. `fruit-graph` · The Fruit Graph · 📊 — [P] pictograph reading (E).**
Three columns of stacked fruit emoji (heights distinct, 2-5); "Which fruit did
the friends pick the MOST?" (alternating MOST/FEWEST rounds, arrow icon sized
to match). Tap a column. On correct that column's fruits pulse-count.
ROUNDS=4. *Logic:* new `makeGraphPick(kinds, rng, last)` → `{ cols:
[{emoji, n}]×3, ask, answerIdx }` (n's distinct).
*Layout:* 3 tall column buttons ✓ (columns ARE the buttons, full height).

**5. `full-glass` · Fullest Glass · 🥛 — [P] volume compare.** Three drawn
glasses (SVG rect fills at clearly distinct levels, ≥25% apart); tap the
FULLEST (alternating EMPTIEST). Pour-in animation on correct (reduced-motion:
instant). ROUNDS=4. *Logic:* new `makeGlassPick(rng, last)` → `{ fills×3
distinct, ask, answerIdx }`. *Layout:* 3 glass buttons ✓.

**6. `partner-up` · Partner Up! · 🦆 — [P] parity, pairing mechanic (A-lite).**
n ducks (3-6) waddle in; "Can every duck find a partner? Tap two ducks to pair
them!" Two-tap pairing: tap duck 1 (held/glow), tap duck 2 → they link arms
and step aside as a pair. When done: either all paired ("EVEN — everyone has a
partner!") or one left over (it gets a friendly umbrella ☂️ and the word
"ODD — one left over!"). No wrong answers exist among unpaired ducks (ANY two
unpaired ducks pair) → all unpaired ducks stay flagged; the game is
finish-the-ritual, the LEARNING is the announced outcome. ROUNDS=4 (mix odd/
even n). *Logic:* new `makePartnerUp(rng, last)` → `{ n, parity }`.
*Layout:* ducks in 3-col grid ✓.

### 🔤 Letters (+6 → games-literacy.js)

**7. `little-letters` · Little Letter Maker · ✍️ — [W] lowercase writing.**
Letter-maker's lowercase sibling: trace-dot paths for **c · o · s · v · w**
(the round lowercase set — chosen because their forms differ visibly from
their capitals' paths, and their dot paths are simple single strokes). Same
dot-order machinery + CSS as letter-maker; new `PATHS_LOWER` coordinates
(**geometry-test them like FU_PATH** — 76px dots, no overlap at 320px).
*Logic:* none new. *Tests:* content geometry test on every path.

**8. `word-pairs` · Word Pairs · 🎴 — [W] sight-word print exposure.**
Concentration with 4 pairs of SIGHT-WORD cards (the↔the, was↔was, you↔you,
and↔and) — matching identical printed words trains visual word-form. Cards
speak their word when flipped. `syncFlags` mandatory. *Content:*
`WORD_PAIR_POOL` from existing `SIGHT_WORDS`, hand-pick 6+ visually DISTINCT
words (no the/she near-forms… truth test: no two pool words share first two
letters). *Layout:* 8 cards, 3-col ✓.

**9. `rhyme-pairs` · Rhyme Pairs · 🧦 — [W] rhyming × memory combo.**
Concentration where a "pair" = two DIFFERENT pictures that RHYME (cat↔hat,
dog↔log, star↔car). Deck = 3 pairs drawn from 3 DIFFERENT rhyme groups —
**the safety property: cross-group cards never rhyme, so no accidental valid
pair exists** (truth test asserts the deck-builder always uses distinct
groups; RHYME_GROUPS are already proven pairwise non-rhyming).
Flipped cards speak their word. `syncFlags` keyed by group. *Logic:* new
`makeRhymePairsDeck(groups, rng)` → `{ cards: [{emoji, word, group}]×6 }`.
*Layout:* 6 cards, 3-col ✓.

**10. `name-hunt` · Name Balloon Hunt · 🎈 — [M/W] his name's letters.**
Pop every balloon holding a letter of J-O-S-H (4 targets among distractor
letters). Found letters fly into name slots spelling JOSH in order of finding
(slots reorder to correct order at the end — the name assembles!). Ramped
rounds use a friend's name (RAEGAR/RIVER/VIRAJ — rotating). Distractor letters
exclude ALL letters of the round's name.
*Logic:* new `makeNameHunt(name, letters, rng)` → `{ targets, cells }` (dedupe
repeated letters in RAEGAR correctly: each occurrence is its own target card).
*Layout:* 9 balloons 3-col + slot row (spans) ✓.

**11. `blend-sort` · Two-Letter Teams · 🤝 — [P] consonant blends, gentle.**
Digraph-sort's cousin for blends **st / sn / fr** (2 bins per round from the
3). Ultra-iconic self-naming pictures only: ⭐ star, 🛑 stop (st) · ❄️
snowflake, 🐌 snail (sn) · 🐸 frog, 🍟 fries (fr). Spoken word on every card
(the DIGRAPH_WORDS lesson — bake `BLEND_WORDS` in from day one).
*Logic:* reuses the `makeSort` shape via a new tiny `BLEND_SETS` content block.
*Tests:* content truth — every word starts with its blend; pictures self-name
(comment the check); no word in two bins. *Layout:* sorter CSS ✓.

**12. `build-word-4` · Spell the Big Word · 🐸 — [M] 4-letter decoding.**
Build-word's 4-letter tier (profile: he decodes 3- AND 4-letter phonetic
words). Words: frog, fish, star, drum, hand, milk — no repeated letters, all
picture-true. Reuses the build-word/name-spell ordered-tile machinery
(`makeNameSpell(word)` works verbatim on any letter string).
*Logic:* none new. *Content:* `CVC4_WORDS {emoji, word}` + truth test (4
letters, no repeats, emoji self-naming). *Layout:* 4 tiles in `.choices--3`
(3+1) ✓.

### 🧠 Thinking (+6 → games-logic.js)

**13. `copy-grid` · Copy My Picture · 🖼️ — [W] visual copying, toggle (B).**
A small model picture (3×3 grid, 3-4 lit cells forming a simple shape —
heart/arrow/letter-J) beside an empty 3×3 of toggle buttons. Tap cells to
light them; match the model → the copy "becomes real" (fills with the model's
color + sparkle) and wins the round. Toggle wiring per mechanic B (flags on
every differing cell; already-matching cells bump). ROUNDS=3.
*Logic:* new `makeCopyGrid(patterns, rng, last)` → `{ model: bool[9] }`.
*Content:* `GRID_PATTERNS` (6 hand-authored 3×3 booleans, each 3-5 cells).
*Layout:* model = spans; play grid = 9 buttons 3-col ✓.

**14. `mirror-half` · Finish the Butterfly · 🦋 — [P] symmetry, toggle (B).**
The left wing of a butterfly shows a 3×3 dot pattern; the right wing is blank
toggles. Light the MIRROR image (columns flipped). Same toggle wiring; win →
the butterfly flaps away whole. ROUNDS=3.
*Logic:* new `makeMirrorHalf(patterns, rng, last)` → `{ left: bool[9],
target: bool[9] }` (target = column-mirrored left; unit test asserts the
mirror math exactly).
*Layout:* two 3×3s side by side at 320px = 6 columns of ~45px cells — **too
tight.** Layout law: stack VERTICALLY (left wing above, play grid below,
butterfly body between as a horizontal fold line) — mirror across the fold =
row-mirrored instead of column-mirrored; makeMirrorHalf takes an `axis`
param and the game uses `"row"`. Both axes unit-tested.

**15. `fits-inside` · Will It Fit? · 📦 — [W] relational size.** A drawn box
of a given size; 3 objects at clearly different scales (one smaller than the
box, two visibly bigger). "Which toy fits INSIDE the box?" Tap → it hops in
(lid closes = proof). ROUNDS=4.
*Logic:* new `makeFitsInside(rng, last)` → `{ boxScale, items: [{scale,
correct}]×3 }` (exactly one scale < box, others ≥ box×1.3 so it's never a
judgment call). *Tests:* unit — uniqueness + the ×1.3 margin. *Layout:* box
display + 3 item buttons ✓.

**16. `which-path` · Which Path Leads Home? · 🛤️ — [W] visual continuity (F).**
Spidey on the left, his house on the right; three drawn paths (SVG polylines)
— exactly ONE is continuous, the other two have a visible gap (a river break
with 🌊). Tap the unbroken path (whole-path fat-stroke buttons). On correct
the hero walks it (dot slides along the polyline; reduced-motion: appears at
the house). ROUNDS=3.
*Logic:* new `makeWhichPath(rng)` → `{ paths: [{broken, gapAt?}]×3,
answerIdx }` (paths are content-authored polyline trios; generator only picks
which slot is unbroken). *Content:* `PATH_TRIOS` (2 hand-authored layouts).
*Tests:* unit — exactly one unbroken. *Layout:* 3 stacked path buttons (full-
width rows ≥75px tall) ✓.

**17. `peek-copy` · Peek & Copy · 👀 — [W] visual memory, reveal (C) + toggle (B).**
Quick-peek meets copy-grid: a 🧢 cap covers a 2-3-cell model pattern; tap the
cap to peek as long/often as he likes (self-paced, no timer — the qp law);
recreate the pattern on the play grid (toggle wiring B; flags live from round
start so the harness blind-solves). ROUNDS=3, 2 cells → 3 ramped.
*Logic:* reuses `makeCopyGrid` with a `cells: 2|3` option.
*Layout:* covered model box + 9-cell grid ✓.

**18. `dress-order` · What Goes First? · 🧦 — [W] practical-life sequencing.**
Two clothing items; "Which goes on FIRST?" (sock vs shoe → sock). On correct a
friend visibly puts them on in order (two-frame dress-up). ROUNDS=4 from
curated pairs. *Logic:* new `makeDressOrder(pairs, rng, last)` → `{ pair,
firstIdx }`. *Content:* `DRESS_ORDER_PAIRS` — only physically-forced orders
(truth test restates): sock→shoe · shirt→coat · pants→boots · undershirt→
sweater. NO judgment-call pairs (hat/scarf order is preference — banned in the
content comment). *Layout:* 2 buttons ✓.

### 🔍 Find It (+6 → games-find.js)

**19. `curtain-peek` · Who's Behind the Curtain? · 🎭 — [W] partial-info
inference, reveal (C).** A theater curtain hides a friend/hero/animal; each
tap of the curtain button opens it another slice (3 steps: feet → half →
almost). Guess ANY time from 3 chips (flagged from start; early right answers
celebrated extra: "You knew from just the feet!"). ROUNDS=3.
*Logic:* new `makeCurtainPeek(pool, rng, last)` → `{ answer, choices }` —
distractors visually DISSIMILAR (different silhouette class: never two
four-legged animals together; pool entries carry a `silhouette` tag and the
picker enforces distinct tags — the shadow-match ambiguity lesson).
*Layout:* curtain stage + 3 chips ✓.

**20. `smallest-hunt` · Find the Tiniest · 🔎 — [M] size discrimination hunt.**
A sky of 7 stars at clearly distinct sizes (spans… no — they're tappable:
buttons at ≥75px HIT AREA with the star GLYPH varying 20-60px inside — hit
box ≠ glyph size, state this explicitly); "Tap the TINIEST star!"
(alternating BIGGEST). ROUNDS=4. *Logic:* new `makeSizePick(rng, last)` →
`{ sizes×7 distinct, ask, answerIdx }` (min gap 6px between adjacent sizes).
*Layout:* 7 buttons in 3-col grid; uniform button boxes, varying glyphs ✓.

**21. `match-all` · Match Them All · 🧤 — [M] visible pair clearing (A).**
Six FACE-UP cards = 3 pairs (mittens, socks, cups — matching by identical
emoji). Two-tap pick-and-place pairing (mechanic A): tap one, its twin becomes
the single flagged target; matched pairs slide off together. No memory load —
pure matching [M] confidence, younger-sibling-friendly. ROUNDS=3.
*Logic:* inline deck from a pool (twins by equality); pick/flag wiring per A.
*Layout:* 6 cards 3-col ✓.

**22. `treasure-map` · Treasure Hunt! · 🗺️ — [P] position words + listening.**
A drawn scene (tree, rock, bench, doghouse as 4 big zone buttons). Spoken clue:
"Look UNDER the tree!" (icon strip: ⬇️🌳). Tap the right zone → a dig animation
finds a clue-shard; 3 clues (under/behind/next-to across different zones) →
the chest assembles from the shards → win. Position words: under · on ·
behind · next to. ROUNDS=1 arc of 3 clues (like certificate's single arc).
*Logic:* new `makeTreasureClue(spots, rng, used)` → `{ spot, preposition,
correctIdx }` — each clue's answer zone is unique and unused this round.
*Content:* `TREASURE_SPOTS` + `PREPOSITIONS` (each preposition's icon:
⬇️/⬆️/↩️/↔️). *Tests:* unit — no zone reuse in an arc; content — icons map
1:1. *Layout:* 4 zone buttons 2×2 ✓.

**23. `category-count` · Count the Animals · 🐾 — [W] categorize-then-count.**
A mixed scene (animals + vehicles + food as spans); "How many ANIMALS?" — the
child must first FILTER by category, then count (find-count counts one exact
emoji; this counts a category). 3 numeral chips; on correct the category
members pulse-count. Uses the disjoint `FIND_CATEGORIES` (already
truth-tested).
*Logic:* new `makeCategoryCount(cats, rng, last)` → `{ cat, k, cells,
choices }` (k members 2-5 + fillers from OTHER categories only).
*Layout:* scene spans + 3 chips ✓.

**24. `sandwich-shop` · Sandwich Shop · 🥪 — [M] functional category + giggles.**
"Let's make a sandwich! Find everything that goes IN it." 9-cell grid: K=4
foods (🍞🧀🍅🥬) among absurd non-foods (🧦 🧸 🖍️ ⚽ 🪥) — tapping a sock gets
a giggly "A SOCK? Not in a sandwich!" `tryAgain` (the no-fail bump made
funny). All 4 found → sandwich assembles layer-by-layer → win. ROUNDS=3
(rotating food sets: sandwich / fruit salad / pizza toppings — each set's
foods truth-tested as edible, non-foods as never-edible).
*Logic:* inline find-K (star-search precedent). *Content:* `MEAL_SETS`
`{name, foods[], sillies[]}`. *Layout:* 9 cells 3-col ✓.

### 🔬 Science (+5 → games-science.js)

**25. `five-senses` · See, Hear, Smell! · 👂 — [M/W] the five senses.**
A thing appears (🌸 flower / 🎵 music / 🌈 rainbow / 🔔 bell / 🍋 lemon /
🧸 teddy); "Which part of you SMELLS the flower?" Tap among 3 body chips
(👃 👂 👁️ 👅 🖐️). *The truth trap:* many things touch several senses (you can
SEE the flower too) — so the question names the SENSE and the answer is the
BODY PART (unique 1:1), never thing→sense.
*Logic:* reuses `makePairPick` `{q: "smell", a: "👃 nose"}` with the 5 fixed
pairs (see→eye, hear→ear, smell→nose, taste→tongue, touch→hand); the "thing"
is round flavor text chosen to fit the sense.
*Content:* `SENSES` + `SENSE_THINGS` (each thing tagged with its featured
sense). *Tests:* truth — the 5 pairs restated; every thing's tag ∈ senses.
*Layout:* 3 chips ✓.

**26. `helper-tools` · Who Uses This? · 👩‍🚒 — [M] community helpers.**
Show a work tool; "Who uses the HOSE at work?" 3 helper chips. **Exclusion
lists mandatory** (the who-eats pattern): each tool lists every helper who
plausibly uses it, distractors drawn outside that list. Curated uniquely-
iconic pairs: hose→firefighter · stethoscope→doctor · chalkboard→teacher ·
tractor→farmer · letter-stack→mail carrier · whistle→coach(⚽ referee? use
coach). *Logic:* new `makeHelperTool(items, rng, last)` (who-eats shape).
*Content:* `HELPER_TOOLS {tool, emoji, helper, helperEmoji, users[]}` + truth
test (primary ∈ users; distractor exclusion unit-tested).
*Layout:* 3 chips ✓.

**27. `plant-care` · Grow a Flower · 🌱 — [M] plant needs, ordered ritual (A).**
A pot with a seed; two supply buttons: 💧 watering can, ☀️ sun. Each growth
stage needs water THEN sun (flag alternates); each completed cycle the plant
visibly advances (seed → sprout → bud → FLOWER, 3 cycles → win). Teaches
"plants need water and sunlight" through pure ritual + transformation.
*Logic:* none (fixed alternation, flagNext). *Layout:* pot display + 2 big
supply buttons ✓. Reduced-motion: growth stages swap instantly.

**28. `weather-clues` · What Made This? · 🌦️ — [W] cause inference.**
Show an effect scene; "What made the puddle?" 3 weather chips. Curated
unambiguous causes (truth test restates): puddle→🌧️ rain · snowman→❄️ snow ·
flying kite→💨 wind · rainbow→🌦️ sun-and-rain (say the "why" on win:
"Sunshine THROUGH rain makes a rainbow!") · shadow→☀️ sun.
*Logic:* reuses `makePairPick`. *Content:* `WEATHER_CLUES` (effect emoji
self-naming; causes unique across the set so distractors are auto-safe).
*Layout:* 3 chips ✓.

**29. `who-lives-here` · Whose Home Is This? · 🪺 — [M] animal habitats.**
Show a home; "Who lives in the NEST?" 3 animal chips. nest→🐦 bird ·
web→🕷️ spider · hive→🐝 bee · den→🐻 bear · pond→🐸 frog · doghouse→🐶 dog.
Homes unique, animals unique (truth test) — and distinct from continent-home
(geography) & the 华丽 games: this is STRUCTURE→dweller.
*Logic:* reuses `makePairPick`. *Layout:* 3 chips ✓.

### 🎉 Fun & Play (+4 → games-fun.js)

**30. `hatch-egg` · Hatch the Egg! · 🥚 — toy, surprise transformation.**
A big egg (`[data-toy]`); each tap cracks it further (3 visible crack stages +
wobble) → 4th tap HATCHES a random baby animal (🐣🐢🐍🦖 pool) with confetti.
One-time `api.win()` on the FIRST hatch ("Hello, little one!"); then a new egg
rolls in — endless surprise-collecting. Counts taps aloud.
*Layout:* one giant egg button ✓. Reduced-motion: crack stages as static
frames.

**31. `paint-splat` · Splat Studio · 🎨 — toy, creative cause→effect.**
A canvas button; each tap splats a random-color blob at a random spot (CSS
burst; color spoken: "Blue!"). Win once at 6 splats ("A masterpiece!") and
keep painting; a small 🧽 button wipes the canvas fresh (also `[data-toy]`).
Color-word exposure for free. *Layout:* canvas + sponge ✓.

**32. `car-wash` · The Car Wash · 🚗 — [M] ordered stations, transformation.**
A muddy car (drawn with a dirt overlay) rolls in; 4 station buttons in fixed
order carry the flag one at a time: 🫧 soap → 🧽 scrub → 💦 rinse → 💨 dry.
Each station visibly changes the car (suds → streaks → shine). Sparkling car
honks thanks → win. ROUNDS=2 (second car is a friend's, different color).
*Logic:* none (flagNext over 4 stations). *Layout:* car display + 4 station
buttons in `.choices--4` (2×2) ✓.

**33. `set-table` · Set the Table · 🍽️ — [M] practical life, pick-and-place (A).**
A table with 3 ghosted outlines (plate, cup, fork); a tray holds the 3 items.
Mechanic A: tap an item (held), tap its matching outline (it settles in with a
satisfying clink via `A.tone`). Any pick order; wrong outline → gentle bump.
All 3 placed → "Dinner is ready!" + win. ROUNDS=2 (second setting adds napkin
+ spoon = 5 outlines, still 3-col max).
*Logic:* inline (pick/place flag per mechanic A). *Layout:* outlines row +
tray row, each ≤3-col ✓.

### 🤝 Calm & Friends (+7 → games-calm.js)

**34. `team-puzzle` · Team Puzzle (2 players) · 🧩 — [M] co-op + his puzzle love, (A).**
A 4-piece picture puzzle (2×2 of a drawn scene — split one of `JoshArt`'s
scenes/hero into quadrant SVGs); players ALTERNATE placing pieces via
pick-and-place (mechanic A: active player's next piece flagged, then its
board slot). Completed picture animates alive → shared win.
*Logic:* inline; piece↔slot by quadrant key. *Layout:* 4 tray pieces (2×2) +
4 board slots (2×2) ✓.

**35. `team-song` · Team Song (2 players) · 🎶 — [W] co-op music, (D-lite).**
A 5-note path of colored note-buttons plays "Twinkle Twinkle" opening
(C-C-G-G-A) — pre-lit one at a time as a demo (≤4s), then players alternate
tapping the NEXT note in the sequence (flag advances; each tap sounds its
`A.tone` pitch). Sequence done → the tune plays back whole + win.
*Content:* `TEAM_SONG` note/freq array (truth test: 5 notes, freqs from the
existing tone-safe range). *Layout:* 5 note buttons 3-col (3+2) ✓.

**36. `team-balance` · Team Balance (2 players) · ⚖️ — [W] co-op equality.**
A balance scale; the LEFT pan holds n blocks (2-5, dealt by the game). The
players' shared job: alternate taps of the block button to add blocks to the
RIGHT pan one at a time — the scale visibly levels as counts approach, and
BALANCES exactly at n ("n and n — the same — BALANCED!") → win. Overshoot
impossible: the add-button's flag clears at n (piggy-bank law: the display
updates on the COMPLETING action). ROUNDS=3.
*Logic:* new `makeBalance(rng, last)` → `{ n }` (trivial, tested for range/
no-repeat). *Layout:* scale display + 1 big shared add-button + turn banner ✓.

**37. `team-copy` · Copy Me! (2 players) · 🪞 — [W] leader/follower co-op (D).**
Round structure: the game auto-plays "P1 shows" — one of 3 color pads
highlights (scripted, ≤2s); then P2 must tap the SAME pad (flagged). Next
round the roles swap (banner + face make the leader explicit: "River shows…
Josh copies!"). 4 echoes → win. It's copy-beat's social sibling — one-item
echo, zero memory strain, all about the turn ritual.
*Logic:* reuses `makeBeat(rng, 1)`-style single picks (or inline randInt).
*Layout:* 3 pads + banner ✓.

**38. `worry-box` · The Worry Box · 📦 — [W] SEL, gentle metaphor.**
Calm beat: 4 little worry-clouds ☁️ hover (each `[data-toy]`); tap one → it
shrinks and floats INTO the box (lid tips open, tucks it in, closes; soft
`bumpCue`-adjacent tone via `A.tone`); the spoken line names the ritual
("Put the worry in the box. It can wait there."). All 4 tucked → a long
exhale line + one-time win ("All packed away. You're safe and calm.") then
new clouds drift in for endless practice. Pairs with `breathe` as the SEL
duo. *Layout:* 4 cloud buttons 2×2 + box display ✓. Reduced-motion: clouds
disappear-into-box instantly.

**39. `month-train` · Month Train · 🚂 — [M] months of the year.**
Day Train's big sibling: a 4-month window of the year-train with one blank
(Jan…Dec, `makeOrderTrain` over `MONTHS`); each month car carries its season
tint + icon (Dec❄️, Jul☀️). Tap the missing month from 3 chips; win line
chants the full year. ROUNDS=4.
*Logic:* **reuses `makeOrderTrain`** (strings). *Content:* `MONTHS` `{name,
abbr, icon, tint}` ×12 in canonical order + truth test (order + the
Feb→💘 car gets his birthday heart — the profile's Valentine hook, noted in
content). *Layout:* train spans + 3 chips ✓.

**40. `thank-you` · Thank-You Hearts · 💌 — [M/W] gratitude ritual, toy.**
The four friends + a grown-up card (👵🏻 grandma included — second bridge
cameo); "Who helped YOU today? Give them a thank-you heart!" Every card is
`[data-toy]` — ANY choice is right (gratitude has no wrong answer); each tap
sends a heart 💗 that lands on that person (their card glows, says "Thank
you, {name}!"). Win once at 4 hearts ("So many thank-yous — that feels
good!") and keep giving. *Layout:* 5 cards (3+2) ✓.

---

## 3) New shared code — consolidated (Set 2)

**`scripts/logic.js` — ~15 new functions** (seeded unit tests each):
`makeCoinMix` · `makeOrdinal` · `makeAboutFive` · `makeGraphPick` ·
`makeGlassPick` · `makePartnerUp` · `makeRhymePairsDeck` · `makeNameHunt` ·
`makeCopyGrid` · `makeMirrorHalf` (with `axis`) · `makeFitsInside` ·
`makeWhichPath` · `makeDressOrder` · `makeCurtainPeek` · `makeSizePick` ·
`makeTreasureClue` · `makeCategoryCount` · `makeHelperTool` · `makeBalance`
(the trivial pickers still get range/no-repeat tests).
**Reused zero-change:** makeOrderTrain (month-train), makePairPick (×3),
makeSort shape (blend-sort), makeNameSpell (build-word-4), syncFlags pattern
(×2 decks), makeBeat-style pick (team-copy), coopTurn, find-K inline pattern,
flagNext ordered pattern (car-wash, plant-care, set-table, team-puzzle).

**`scripts/content.js` — new blocks** (each truth-tested): `PATHS_LOWER`
(+geometry test), `WORD_PAIR_POOL`, `BLEND_SETS`+`BLEND_WORDS`, `CVC4_WORDS`,
`GRID_PATTERNS`, `PATH_TRIOS`, `DRESS_ORDER_PAIRS`, `CURTAIN_POOL`
(+silhouette tags), `TREASURE_SPOTS`+`PREPOSITIONS`, `MEAL_SETS`, `SENSES`+
`SENSE_THINGS`, `HELPER_TOOLS` (+users exclusion lists), `WEATHER_CLUES`,
`ANIMAL_HOMES2`, `TEAM_SONG`, `MONTHS`, plus small pools (eggs, splat colors,
ducks). **`main.js`:** all 40 ids into `CATEGORY_OF`.

**CSS:** held-item state (`.held` lift+glow, shared across all mechanic-A
games — centralize it, RULE 7), toggle-cell states, scale/balance, curtain
steps, path strokes — all in the reduced-motion block with visible end-states.

---

## 4) Build waves (W5–W8, same mandatory gate as Set 1 §4)

| Wave | Games (10) | Character |
|---|---|---|
| **W5 — reuse spine + mechanic A debut** | month-train, build-word-4, five-senses, weather-clues, who-lives-here, helper-tools, blend-sort, set-table, match-all, hatch-egg | pairPick/orderTrain/sort reuse + the FIRST pick-and-place games (centralize the `.held` machinery here) |
| **W6 — numbers & representations** | coin-mix, ordinal-line, about-five, fruit-graph, full-glass, partner-up, category-count, smallest-hunt, sandwich-shop, paint-splat | mechanic E cluster + parity pairing |
| **W7 — toggle & reveal thinkers** | copy-grid, mirror-half, peek-copy, fits-inside, which-path, dress-order, curtain-peek, treasure-map, little-letters, word-pairs | mechanics B/C/F debut — the most novel wave; worked-example onboarding on every first round |
| **W8 — co-op finale + docs** | rhyme-pairs, name-hunt, car-wash, team-puzzle, team-song, team-balance, team-copy, worry-box, thank-you, + CLAUDE.md/docs update (counts 180/220, categories, learnings) | the co-op quartet + SEL closers; final full audit-style diff review before push |

Per-wave gate identical to Set 1: truth/unit tests first → build →
`node --check` → unit suite → **full `npm test`** (190/200/210/220 games by
wave) → one commit → push `main` → CI green incl. **verify-live** → next.

## 5) Set-2-specific risks

| Risk | Defense |
|---|---|
| Pick-and-place flag races (two flags at once) | mechanic-A wiring is normative: pick flag → place flag, never both; wave-W5 centralizes it once and every later A-game copies it |
| Toggle games un-winnable by harness | mechanic-B spec: flags on all differing cells from round start; matching cells never toggle (progress can't be broken) |
| Suite runtime at 220 games | measure at each wave; if CI e2e exceeds ~8 min, split the every-game test into two serial `test()` blocks (Josh/华丽) — a structural split, never a weakened assertion |
| Mirror/rotation ambiguity | mirror axis unit-tested both ways; curtain distractors silhouette-tagged distinct |
| "All answers valid" games breaking the one-flag contract | partner-up/thank-you are TOY-contract games (`[data-toy]`, win at N interactions) — the contract explicitly allows it; never mix flagged-wrong chips into an all-valid game |
| Subjective orders (dress/tools/senses) | curated-only content with truth tests; judgment-call pairs are named and banned in content comments |
| New CSS animation load on iOS | every new animation ≤600ms, transform/opacity only, reduced-motion end-states verified in the e2e computed-display checks if flagged |

## 6) Definition of Done (Set 2)

180 Josh games (220 total) registered & category-mapped · every game driven to
a win by the harness · 320px mobile audit green across all screens · every new
fact truth-tested · Josh's book 180 slots (fills 180/180), 华丽's untouched at
40 · full suite + CI + verify-live green on the final push · CLAUDE.md counts
and learnings updated · zero weakened assertions anywhere.
