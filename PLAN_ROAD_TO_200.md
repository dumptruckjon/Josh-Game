# 🚀 Road to 200 — Set 3 build plan (20 games: 180 → 200)

**Status: APPROVED — execute when asked.** Companion to `PLAN_ROAD_TO_140.md` (✅ built)
and `PLAN_ROAD_TO_180.md` (✅ built). Same per-wave gate, same test contract, same bar.

> **⚠️ HANDOFF BRIEF (read this first, builder).** This plan will be executed by a
> different model/session than the one that wrote it. Before writing ANY code:
> 1. Read **`CLAUDE.md`** end-to-end — the 7 PROJECT RULES are non-negotiable, and the
>    self-healing learnings list is the distilled cost of every bug this repo has ever
>    shipped. Every law in it applies to every game below.
> 2. Read **`JOSH_PROFILE.md`** — the skill tags ([M]/[W]/[P]/[NA]) in each spec come
>    from it; the non-reader law and no-fail law govern every design choice.
> 3. Know the **per-file idioms**: `games-math.js` and `games-calm.js` take
>    `const L = window.JoshLogic;` **per-game inside `start()`** (module scope has no L —
>    forgetting throws and the game never wins; e2e catches it late and expensively).
>    `games-literacy/logic/science/find.js` have module-scope `const L`. Content is
>    dual-export (`window.JoshContent` + `module.exports`) — edit `content.js` only.
> 4. Honor the **TEST CONTRACT** (`framework.js`): the correct next tap carries
>    `data-correct="1"` (removed once consumed); `api.win()` ends the game;
>    `api.tryAgain(el)` for wrong taps; pure toys mark `[data-toy]` + `api.tickPlay()`
>    and reach a **one-time win by click-count, never a timer**; a **consumed control
>    drops its `data-toy`/`data-correct`** (disabled-but-flagged strands the harness);
>    **clear flags before any `setTimeout`-deferred round rebuild** (the Partner-Up law).
> 5. CSS laws that have each caught a real bug: **≥16px gaps** between tappable tiles;
>    glyph-size-varying rows use **`repeat(n, minmax(0,1fr))`**; "lit/selected" =
>    **box-shadow ring, never `transform: scale()`**; every `aspect-ratio` square
>    pairs a **real `min-height`** (Safari-14 fallback — guardrail-enforced);
>    **≤3 button columns at 320px**; `.choices--4` is 2×2.
> 6. **Emoji ≤ Unicode/Emoji 13.0** (guardrail-enforced). Floor-edge glyphs used in
>    this plan and verified allowed: 🪶 U+1FAB6, 🪨 U+1FAA8, 🦣 U+1F9A3 (all 13.0).
>    NEVER 🫧 🪺 🪹 🛝 (14.0+).
> 7. Per-wave gate (mandatory, in order): truth/unit tests first → build →
>    `node --check` each file → emoji scan → unit suites → **full `npm test`**
>    (backgrounded; ~15 min at this size) → ONE commit → push `main` → CI green
>    including **verify-live** → only then the next wave. A red anywhere is
>    stop-the-line.
> 8. When a fix teaches something, **append it to CLAUDE.md's learnings** (RULE 7).

---

## What makes Set 3 different (the depth mandate)

Set 1 built breadth across the skill map; Set 2 added six new interaction shapes.
Set 3 fills the **last real skill gaps** a 180-game sweep left open — each game below
is keyed to a skill with **zero existing coverage** (verified against the full
registry): numeral writing, syllables, oral blending, compound words, picture
analogies, visual closure, unit measurement, life cycles, animal coverings,
food origins, embedded-shape geometry — plus three long-owed delights (the
namesake **dump truck**, a pet-care toy, and the first game where Josh's **chosen
buddy** is the star of play, not just the win pop).

New interaction shapes debuting (each gets ONE normative implementation, RULE 7):
- **G — acted-story math**: the scene *performs* a spoken story (3 ducks swim in,
  2 more arrive); the answer is provable by re-counting what's on screen. This is
  the profile-legal form of a "word problem" (spoken + concrete, never read).
- **H — pulse-count**: a word drums itself in visible/audible beats (self-paced
  replay, reveal-C style unflagged control); Josh counts the beats.
- **I — stretch-and-blend**: a robot voice says a word in stretched phonemes;
  with sound OFF the letter tiles light in sequence instead (dual channel).
- **J — multi-junction traversal**: sequential forks; the vehicle advances after
  each choice (extends Set 2's one-shot path-choice into planning).
- **K — scene-zone tap**: geometry-tested tappable regions INSIDE one drawn SVG
  scene (generalizes the Simon-Says `BODY_FIGURE_BOX` precedent into a shared
  helper + content-box tests; used by shape-spy AND hide-seek).
- **L — excavate-then-identify**: clear-to-reveal (consumed-toy patches) followed
  by a silhouette-distinct ID (the curtain-peek distractor discipline).
- **M — align-and-count measurement**: stack unit blocks against a target with a
  visible alignment line; the flag clears on the completing unit (piggy-bank law).

---

## 1) Category distribution (Set 3 → running totals)

| Category | after Set 2 | Set 3 | after Set 3 |
|---|---|---|---|
| 🔢 Numbers | 31 | +3 | 34 |
| 🔤 Letters | 28 | +3 | 31 |
| 🧠 Thinking | 27 | +3 | 30 |
| 🔍 Find It | 20 | +4 | 24 |
| 🔬 Science | 26 | +3 | 29 |
| 🎉 Fun & Play | 17 | +3 | 20 |
| 🤝 Calm & Friends | 31 | +1 | 32 |
| **Josh total** | **180** | **+20** | **200** |

(+40 华丽 = **240 total**. Find and Play — the two lightest shelves — get the
biggest slices. Friends is already the largest at 31 and gets one precision add.)

Difficulty mix: ~60% [W] challenge / ~30% [M] confidence / gentle [P] scaffolds —
inside the profile's 70/30 target band.

All 20 ids pre-checked unique against the live 220-id registry:
`number-maker · how-tall · duck-add · drum-parts · robot-talk · word-glue ·
goes-with · whats-missing · drive-home · shape-spy · dino-dig · fix-toys ·
hide-seek · life-cycle · animal-coats · food-from · dump-truck · puppy-love ·
buddy-bounce · tidy-up`

---

## 2) The 20 games — specs

Format matches Set 2. Mechanics letter-tagged where a new shape applies.

### 🔢 Numbers (+3 → games-math.js)

**1. `number-maker` · Number Maker · ✍️ — [M] numeral formation.**
Letter Maker's numeral sibling — the missing third of the tracing family
(letters ✓, lowercase ✓, digits ✗). Trace-dot paths for **1 · 2 · 3 · 4 · 5**
(single-stroke digit shapes; 4 uses the open one-stroke form). Same dot-order
machinery + CSS as letter-maker; new `PATHS_DIGITS` coordinates.
*Logic:* none new. *Content:* `PATHS_DIGITS` — **geometry-test every path like
FU_PATH/PATHS_LOWER** (76px dots on the 292×430 box, no both-axis overlap, ≥14px
axis gaps). *Layout:* trace stage ✓ (existing pattern).
*Why:* "writes numbers independently" is [M] — a confidence/reward game, and the
trace family teaches formation the finger-first Montessori way.

**2. `how-tall` · How Tall? · 📏 — [P→W] measurement with units (M-mech).**
A tall friend appears beside an empty measuring column (giraffe 🦒 / tree 🌳 /
rocket via `JoshArt.rocket()` — drawn at a per-round height). Tap the big
**➕ block** button to stack unit blocks; a dashed **alignment line** at the
target's head shows exactly when the stack is even (the control of error is
visual, not numeric). On the completing block the flag clears (piggy-bank law),
the stack flashes level, and the game counts the blocks aloud: "The giraffe is
FOUR blocks tall!" ROUNDS=3, heights 3–6, no repeat.
*Logic:* new `makeHowTall(rng, last)` → `{ height, thing }` (range + no-repeat
unit-tested). *Layout:* target display + one big add button ✓. Reduced-motion:
blocks appear without bounce. *Why:* long-short compares; nothing yet MEASURES —
nonstandard units are the canonical next Montessori step.

**3. `duck-add` · Duck Pond Stories · 🦆 — [W] addition in context (G).**
The pond acts out a SPOKEN story: "Three ducks are swimming…" (3 ducks glide in,
counting themselves) "…two MORE come!" (2 more glide in). "How many ducks now?"
3 numeral chips. On correct every duck pulse-counts as proof. With sound OFF the
acted animation alone carries the task (count what's on screen). ROUNDS=4,
totals ≤ 8, both addends ≥ 1.
*Logic:* new `makeStoryAdd(rng, last)` → `{ a, b, total, actor, choices }`
(distinct numeric choices incl. total; unit-test bounds + uniqueness).
*Content:* `STORY_ACTORS` (duck/frog/bee/fish — each with a verb: swim/hop/buzz).
*Why the profile allows it:* the ban is on word problems **to be read** — this is
spoken + acted + concretely countable, the exact permitted form ("put the
control-of-error in the concrete"). *Layout:* pond scene (spans) + 3 chips ✓.

### 🔤 Letters (+3 → games-literacy.js)

**4. `drum-parts` · Drum the Word · 🥁 — [W] syllables (H).**
A picture appears (butterfly). A big **▶ drum** control (UN-flagged, reveal-C
law) plays the word in parts — "BUT-TER-FLY" — with the drum visibly pulsing
once per syllable and pulse-dots lighting below (the sound-off channel). Replay
as often as he likes; then tap **how many parts** from 3 numeral chips (1–4).
On correct the picture bounces once per syllable while the word claps itself.
ROUNDS=4 from mixed 1/2/3-syllable words.
*Logic:* new `makePartsPick(words, rng, last)` → `{ word, count, choices }`.
*Content:* `SYLLABLE_WORDS` `{emoji, word, parts}` — dog 1 · rabbit 2 · butterfly
3 · banana 3 · apple 2 · star 1 · elephant 3 · robot 2 (pictures self-name;
**truth test restates every count** — syllabification is ground truth, pin it).
*Layout:* picture + drum + 3 chips ✓. First round = worked example (the game
demos count-along once — profile onboarding rule).

**5. `robot-talk` · Robot Talk · 🤖 — [W] oral blending (I).**
THE pre-reading bridge skill with zero coverage: hear sounds, fuse the word. A
friendly robot says a CVC word stretched — "c … a … t" (three tones + spoken
phonemes) — while the word's letter tiles light left-to-right in sync (the
sound-off channel: he decodes 3-letter words [M], so lit-in-order letters carry
it silently). Tap the matching picture of 3. A **▶ robot** replay control stays
un-flagged. ROUNDS=4.
*Logic:* new `makeBlendPick(words, rng, last)` → `{ word, choices }` — the two
distractor pictures come from CVC words with **different beginning sounds**
(truth-tested: all 3 onsets distinct — so a child who catches only the first
phoneme is never trapped between two candidates).
*Content:* reuses `CVC_WORDS` (already picture-true). *Layout:* robot + letter
tiles (spans) + 3 picture chips ✓.

**6. `word-glue` · Two Words Make One · 🧩 — [W] compound words.**
Two pictures slide together — 🌞 sun + 🌻 flower — "Sun… flower… what word do
they make?" Tap the compound of 3 picture chips; on correct the two halves snap
into the result with a satisfying clink and the word is spoken whole.
ROUNDS=4. *Logic:* new `makeCompound(compounds, rng, last)` → `{ a, b, result,
choices }`. *Content:* `COMPOUND_WORDS` — only **semantically transparent**
compounds where the picture-math is honest: cupcake (🧁=🍰+🧢? NO — curate real
ones): sun+flower=🌻 sunflower · rain+bow=🌈 rainbow · star+fish=⭐+🐟→ starfish ·
snow+man=⛄ snowman · dog+house=🐶+🏠→ doghouse · tooth+brush=🪥? (U+1FAA5 =
13.0 ✓) toothbrush · cup+cake=🧁 cupcake. **Distractor law (truth-tested): a
distractor may share NO part with the prompt pair** (offering "sunhat" against
sun+flower would be also-plausible — banned by test). *Layout:* two prompt
pictures (spans) + 3 chips ✓.

### 🧠 Thinking (+3 → games-logic.js)

**7. `goes-with` · This Goes With That · 🔗 — [W] picture analogies.**
Classic A:B :: C:? reasoning, uncovered until now. Top row shows the model pair
linked by a visible band — 🐦 bird ↔ 🪹? NO (banned emoji) — 🐦 bird ↔ nest
(drawn/🏠-free icon, see content note). Bottom row: 🐶 dog ↔ **?** with 3 chips
(doghouse ✓, bone ✗-but-tempting?, NO — see law). On correct the band draws
itself between C and D and the relation is SPOKEN ("A bird lives in a nest — a
dog lives in a doghouse!").
*Logic:* new `makeAnalogy(sets, rng, last)` → `{ pair, promptC, answerD,
choices }`. *Content:* `ANALOGY_SETS`, each entry `{relation, a, b, c, d,
excluded[]}` — relations: lives-in (bird→nest :: dog→doghouse) · baby-of
(cat→kitten :: dog→puppy) · wears (foot→shoe :: hand→mitten) · eats
(rabbit→carrot :: monkey→banana, reusing the who-eats exclusive canon).
**Distractor law (the who-eats discipline, truth-tested): no distractor may
satisfy the round's relation with C** — for dog-lives-in, a bone is excluded
(strong dog association invites a defensible tap under a DIFFERENT relation, so
distractors must be relation-neutral for C: e.g. cloud, cup). Emoji floor note:
no 🪹/🪺 — draw the nest as a small inline SVG or use existing who-lives-here
art. *Layout:* model pair (spans) + prompt + 3 chips ✓.

**8. `whats-missing` · What's Missing? · 🧐 — [W] visual closure.**
A friendly drawn picture is missing exactly ONE part: a face without its nose ·
a car without a wheel · a cat without its tail · a house without its door · a
bike without a wheel. "Oh no — what's missing?" Tap the missing part among 3
part-chips. Control of error is LOOKABLE: **both distractor chips are parts
visibly PRESENT in the picture** (tap one → gentle "The eyes are right there!"
bump). On correct the part flies into place and the picture beams whole.
ROUNDS=4. *Logic:* new `makeMissingPart(scenes, rng, last)` → `{ scene,
missing, choices }` (distractors sampled from the scene's present parts —
unit-tested). *Content/Art:* 5 hand-authored scenes as `JoshArt.fixable(name,
{without})` SVGs — each scene lists `parts[]` with per-part SVG groups so the
game renders "everything except X". Truth test: every scene's `missing`
candidates ⊆ parts; parts ≥ 3. *Layout:* big picture + 3 chips ✓.

**9. `drive-home` · Drive Home · 🚗 — [W] route planning (J).**
Which-path grown into a JOURNEY: the car faces a drawn road that forks; ONE
branch continues (the other visibly dead-ends — a pond 🌊 / boulder 🪨 sits on
it a short way ahead, in view BEFORE choosing, so it's inference not luck). Tap
the good branch (two huge fork buttons); the car drives it; the next fork slides
in. 3 forks → home 🏠 + honk. ROUNDS=2 runs.
*Logic:* new `makeForkRun(layouts, rng)` → `{ forks: [{goodSide}]×3 }`.
*Content:* `FORK_LAYOUTS` — 2 hand-authored fork drawings × mirrored = 4 looks;
truth test: **exactly one continuing branch per fork** and the blocker sits ON
the bad branch's path (restate coordinates). *Layout:* road scene + 2 fork
buttons per junction (full-width halves ≥75px) ✓. Reduced-motion: car jumps to
the fork end instead of sliding.

### 🔍 Find It (+4 → games-find.js)

**10. `shape-spy` · Shape Spy · 🔎 — [W] embedded shapes (K).**
plane-shape taught shapes in isolation; this finds them IN THE WORLD — the real
geometry-cabinet payoff. A drawn SVG scene (a house street: round sun, round
wheel, square window, square gift, triangle roof, triangle flag…). "Find the
CIRCLES — tap all 3!" (round target rotates circle/square/triangle). Each found
shape traces its outline in color and counts; find-all → win the round.
ROUNDS=3 (one per shape).
*Logic:* new `makeShapeSpy(scene, shape)` → `{ zones, need }` (thin picker over
content). *Content:* `SPY_SCENES` — scene(s) with a stated content box and
`zones[] {shape, x%, y%}` tappable regions ≥75px; **geometry truth test per the
BODY_FIGURE_BOX precedent** (all zones inside the box, ≥14px apart, each shape
kind appears 2-3×, ≥3 shape kinds per scene). Shared `sceneZones(api, box,
zones)` helper is the ONE normative scene-region implementation (RULE 7) —
hide-seek reuses it. *Layout:* one scene, absolute zones ✓.

**11. `dino-dig` · Dino Dig · 🦴 — [W] excavate & identify (L).**
A sandy dig site: a 3×3 grid of sand patches (each a consumed `[data-toy]`-style
brushable button — **`delete dataset` on consume, the Worry-Box law**) hides a
buried friend. Brush all patches → the find is revealed → "WHO did we dig up?!"
3 chips, **silhouette-distinct** (curtain-peek discipline): 🦕 long-neck · 🦖
big-teeth · 🦣 mammoth (U+1F9A3, Emoji 13.0 ✓) · 🐢 shell — picker enforces
distinct silhouette tags. Correct → the find shakes off sand + roars gently.
ROUNDS=2 digs. *Logic:* new `makeDigFind(pool, rng, last)` → `{ answer,
choices }` (reuses the makeCurtainPeek shape — consider literally calling it
with a DIG_POOL). *Content:* `DIG_POOL` with silhouette tags. *Layout:* 3×3
patch grid (3-col ✓, patches ≥75px, **`aspect-ratio` cells carry `min-height`**)
+ 3 chips ✓. During the brushing phase every un-brushed patch stays flagged
(find-K precedent) so the harness converges; chips flag only after reveal.

**12. `fix-toys` · Fix the Toys · 🧸 — [M] part-whole halves (mechanic A).**
Six cards = 3 toys each split into left+right halves (teddy, car, ball — drawn
as half-SVGs/split emoji cards). Pick-and-place per mechanic A: tap a half
(held), its matching half becomes the ONE flagged target; joined toys snap whole
with a pop ("You fixed the teddy!"). All 3 fixed → win. ROUNDS=2 sets.
*Logic:* new `makeHalvesDeck(pool, rng)` → `{ cards }` (3 toys × 2 halves,
match key per toy; unit-test pairing completeness). *Content:* `HALF_TOYS` pool
(6 toys, distinct silhouettes so half-shapes never look alike).
*Layout:* 6 cards 3-col ✓. Copy the `.held` machinery **verbatim** from
set-table (the normative mechanic-A implementation — exactly one flag at a
time; held=null flags every un-placed half).

**13. `hide-seek` · Hide & Seek! · 🙈 — [M/W] visual inference hunt (K).**
Four friends are hiding in a drawn backyard scene — but each spot shows a PEEK
clue (shoes under the curtain 👟, a hat above the bush 🧢, a tail behind the
tree). "Find all four friends!" Tap a hiding spot → the friend springs out
giggling (friend portraits via `JoshArt.friend` — warm + personal). Wrong spots
(2 empty decoys with no peek clue) → gentle "nobody here!" bump. All 4 found →
win. ROUNDS=2 (spots reshuffle).
*Logic:* new `makeHideSpots(spots, rng)` → sample 4 hiding + 2 empty from the
pool. *Content:* `HIDE_SCENE` — content box + `spots[] {x%, y%, peek}`;
**geometry truth test** (zones ≥75px, ≥14px apart, inside box) via the shared
`sceneZones` helper. *Layout:* one scene, absolute zones ✓.

### 🔬 Science (+3 → games-science.js)

**14. `life-cycle` · Baby to Big! · 🐛 — [W] life cycles.**
Zero coverage of the classic preschool science arc. Order the life stages
left→right into ghosted slots: egg → caterpillar → butterfly 🦋 · egg → tadpole
→ frog 🐸 · egg → chick → hen 🐔 · seed → sprout → sunflower 🌻. Tap the tiles
in story order (the story-order/ordered-tile machinery **reused verbatim** —
`makeStoryOrder` over new sequences); the completed strip animates the growth
once. ROUNDS=3 cycles. Title law note: every round IS baby→big, so the title
matches every round (the 找福字 lesson).
*Logic:* **reuses `makeStoryOrder`** — zero new logic. *Content:*
`LIFE_CYCLES` (3-stage sequences, each stage `{emoji, say}`) + truth test
restating every canonical order (biology is ground truth; a shuffled author
edit must fail). *Layout:* 3 slots + 3 tiles ✓.

**15. `animal-coats` · Fur, Feathers, Scales · 🪶 — [M] animal coverings.**
A fresh 3-bin science sorter (the sorter factory reused): what is each animal
wearing? **fur**: 🐻 🐰 🐱 🐶 · **feathers**: 🐦 🦆 🐧 🦉 · **scales**: 🐟 🐍
🦎 🐊. Bins carry icon + texture swatch; every sort speaks the why ("A penguin
has FEATHERS!"). ROUNDS to the sorter default. 🪶 = U+1FAB6, Emoji 13.0 ✓.
*Logic:* `makeSort` reuse. *Content:* `COAT_SETS` — truth test: bins mutually
exclusive, every animal's covering is kid-canon unambiguous (note: penguin IS
feathered — a good "tricky but true" edge in the alive-or-not tradition; no
amphibians in scales — a frog is smooth-skinned, EXCLUDE frogs entirely, state
the exclusion in the content comment). *Layout:* sorter CSS ✓.

**16. `food-from` · Where Does It Come From? · 🥛 — [M] food origins.**
Show a food; "Where does MILK come from?" 3 chips. Kid-canon exclusive pairs
(the who-eats/helper-tools discipline, exclusion lists mandatory): milk→🐄 cow ·
egg→🐔 hen · honey→🐝 bee · apple→🌳 tree · wool sweater→🐑 sheep · carrot→
the garden soil 🌱. On correct a short give-animation (the cow moos, the apple
drops from the tree).
*Logic:* new `makeFoodFrom(items, rng, last)` (the makeHelperTool shape —
consider reusing it directly with `{tool→food, helper→source, users→sources[]}`).
*Content:* `FOOD_FROM` `{food, foodEmoji, source, sourceEmoji, sources[]}` +
truth test: primary ∈ sources; **no distractor is a plausible source of the
round's food** (a hen never gives milk; unit-test the exclusion like who-eats).
*Layout:* 3 chips ✓.

### 🎉 Fun & Play (+3 → games-fun.js)

**17. `dump-truck` · Dump Truck! · 🚚 — [M] load, count, DUMP.**
The repo is `dumptruckjon` — this game is owed. A big dump truck backs in
(beep… beep…). N rocks 🪨 (U+1FAA8 ✓) sit on the ground, each flagged: tap to
load (it arcs into the bed with a thunk-tone via `A.tone`, counts aloud). When
all N are loaded the **DUMP** lever flags (ordered-flag, the car-wash family):
tap → the bed tilts, rocks tumble out with bounces, "DUMP! 🎉". ROUNDS=3 loads
(N = 3 → 4 → 5). Win after the last dump.
*Logic:* none (flagNext over rocks→lever). *Content:* small `TRUCK_LOADS`
config. *Layout:* truck display + rock row (≤3-col grid of ≥75px rock buttons)
+ one big lever ✓. Reduced-motion: rocks appear in the bed / pile without arcs.

**18. `puppy-love` · Puppy Love · 🐶 — toy, nurture play.**
A pet-care toy (warmth slice, Paw-Patrol-adjacent): the pup sits center; three
`[data-toy]` care buttons — 🖐️ pat (tail wags + hearts) · 🧴? NO (fine) 🧼 brush
(sparkle coat) · 🦴 treat (munch + happy bounce). Each care speaks a warm line
("The puppy LOVES that!"). One-time `api.win()` at 5 cares ("Best friends!"),
then endless care. Pup drawn via `JoshArt.pup()` (existing art, rotating collar
colors).
*Layout:* pup display + 3 care buttons ✓ (choices--3). All three buttons stay
live `[data-toy]` forever (nothing is consumed — no strand risk).

**19. `buddy-bounce` · Boing! Boing! · ⬆️ — toy, cause→effect intensity.**
The FIRST game starring Josh's **chosen buddy** (`JoshBuddy` — until now the
buddy only greets at home and pops on wins; here he PLAYS with it). The buddy
stands on a trampoline; each tap bounces it **higher** (5 visible height notches
light up a pole — cause→effect intensity made visible); at the top notch a
one-time win ("TO THE MOON!"-style celebration + the buddy does a flip), then
the height resets and he keeps bouncing. Counts each bounce aloud.
*Logic:* none. *Layout:* one giant trampoline button + notch pole (spans) ✓.
Bounce animation is transform-on-a-single-element (no grid-gap risk);
reduced-motion: buddy steps up notch marks without the bounce arc. Uses
`JoshBuddy` read-only (render its art) — **do NOT add a second writer of
`josh-buddy`** (single-owner law).

### 🤝 Calm & Friends (+1 → games-calm.js)

**20. `tidy-up` · Tidy Up Time · 🧺 — [M/W] practical life, pick-and-place (A).**
Toys are scattered (🧱 block, 📕 book, 🖍️ crayon, ⚽ ball); four home bins wait
(block box, bookshelf, art cup, toy basket — icon-labeled). Mechanic A verbatim:
tap a toy (held) → its ONE matching bin flags → place it (clink + "The book goes
on the SHELF!"). All 4 away → the room sparkles clean → win. ROUNDS=2 (second
round adds 🧸+🚗 → 6 items, bins stay 4 with multi-item baskets? NO — keep 1:1:
swap in a different 4-item set; multi-valid bins would break the one-flag law).
*Logic:* inline (set-table's machinery verbatim). *Content:* `TIDY_SETS` — two
4-item sets, each toy's bin unique & kid-obvious (truth test: bin mapping 1:1,
no toy plausibly belongs to two bins — a crayon could arguably live in the toy
basket, so the art cup is ALWAYS present when the crayon is, and the basket's
label is "toys" only in a set without the crayon… simpler: truth-test each
set's items against an exclusion list like who-eats).
*Layout:* bins row + toys row, each ≤3-col… 4 bins = `.choices--4` (2×2) ✓.

---

## 3) New shared code — consolidated (Set 3)

**`scripts/logic.js` — ~10 small new functions** (each seeded-unit-tested):
`makeHowTall` · `makeStoryAdd` · `makePartsPick` · `makeBlendPick` ·
`makeCompound` · `makeAnalogy` · `makeMissingPart` · `makeForkRun` ·
`makeShapeSpy` · `makeHideSpots` · `makeHalvesDeck` · `makeDigFind` (or
curtain-peek reuse) · `makeFoodFrom` (or helper-tool reuse).
**Reused zero-change:** trace machinery (number-maker), `makeStoryOrder`
(life-cycle), `makeSort` (animal-coats), `makeCurtainPeek` shape (dino-dig),
`makeHelperTool` shape (food-from), mechanic-A `.held` machinery (fix-toys,
tidy-up), flagNext ordered pattern (dump-truck), toy contract (puppy-love,
buddy-bounce).

**`scripts/content.js` — new blocks** (every fact truth-tested in
`content.test.js`): `PATHS_DIGITS` (+geometry test) · `STORY_ACTORS` ·
`SYLLABLE_WORDS` (+count truths) · `COMPOUND_WORDS` (+no-shared-part distractor
law) · `ANALOGY_SETS` (+relation exclusion lists) · `FIXABLE_SCENES` parts
lists · `FORK_LAYOUTS` (+exactly-one-continuing truth) · `SPY_SCENES`
(+zone geometry) · `HIDE_SCENE` (+zone geometry) · `HALF_TOYS` · `DIG_POOL`
(+silhouette tags) · `LIFE_CYCLES` (+canonical-order truths) · `COAT_SETS`
(+mutual exclusion) · `FOOD_FROM` (+source exclusion) · `TIDY_SETS` (+1:1 bin
truth) · `TRUCK_LOADS`.

**`scripts/art.js`:** `JoshArt.fixable(name, {without})` (whats-missing scenes)
and the two scene drawings (shape-spy street, hide-seek backyard) if not done as
inline SVG in their games. Keep every new SVG in the existing homage style.

**Shared helper (RULE 7):** `sceneZones(api, box, zones)` — the ONE normative
scene-region-tap implementation (absolute-positioned ≥75px buttons inside a
stated content box), used by shape-spy + hide-seek, geometry-tested per scene
in `content.test.js` (the `BODY_FIGURE_BOX` precedent). Put it beside the other
shared helpers in the games file that uses it first, or `framework.js` if both
files need it (they're different files — find + find, so games-find.js module
scope works for both).

**`scripts/main.js`:** all 20 ids into `CATEGORY_OF` (numbers 3 · letters 3 ·
thinking 3 · find 4 · science 3 · play 3 · friends 1).
**No new script files** — nothing to wire in `index.html`/`sw.js`/`SCRIPTS`.

**CSS:** trace-digit guide class (reuse `lm__guide`) · measuring column +
alignment line · pond scene · drum + pulse dots · robot tiles · fork buttons ·
scene-zone base (shared) · sand patches (**aspect-ratio + min-height law**) ·
half-cards · truck bed/lever · trampoline + notch pole · bins/toys rows — all
new animations ≤600ms, transform/opacity only, every one with a reduced-motion
end-state. Every tile row keeps the 16px gap; any glyph-size-varying row uses
`minmax(0,1fr)`.

---

## 4) Build waves (W9–W10, same mandatory gate as Sets 1–2)

| Wave | Games (10) | Character |
|---|---|---|
| **W9 — reuse spine + new truths** | number-maker, duck-add, word-glue, goes-with, life-cycle, animal-coats, food-from, fix-toys, tidy-up, dump-truck | machinery reuse (trace/story-order/sort/pairPick/mechanic-A/flagNext) carrying heavy NEW content truth — land the truth tables first |
| **W10 — novel shapes + docs + audit** | how-tall, drum-parts, robot-talk, whats-missing, drive-home, shape-spy, hide-seek, dino-dig, puppy-love, buddy-bounce, then CLAUDE.md → 200/240 + the end-of-set adversarial audit | the six new interaction shapes (G/H/I/J/K/L/M-mech) — worked-example onboarding on every first round; scene-zone geometry tests BEFORE building the scenes |
| **Set-3 audit — mandatory closer** | 6-lens adversarial audit of all 20 (distractor-also-correct · ground-truth · mechanic-contract/winnability · no-fail/no-timer · mobile geometry · emoji/self-naming), adversarially verified findings, fixes + new guardrails pushed green | Sets 1 and 2 each surfaced real ship-blockers this way (9 and 3+3); do not skip |

Per-wave gate identical to Sets 1–2 (§ handoff brief, item 7). Full-suite runtime
at 240 games will pass ~16-17 min locally — run it backgrounded; if CI's e2e ever
exceeds ~8 min, split the every-game test into two serial `test()` blocks
(Josh/华丽) — a structural split, never a weakened assertion.

---

## 5) Set-3-specific risks

| Risk | Defense |
|---|---|
| Audio-gated gameplay (drum-parts, robot-talk) | dual-channel by design: visible pulse-dots / letters lighting in sequence carry the task with sound off; replay controls stay UN-flagged (reveal-C law); a game unplayable muted is a spec violation |
| Scene-zone geometry (shape-spy, hide-seek) | ONE shared `sceneZones` helper + per-scene content-box truth tests (≥75px, ≥14px apart, inside box) — write the geometry test BEFORE drawing the scene |
| Trace-digit paths colliding at 320px | `PATHS_DIGITS` geometry-tested exactly like FU_PATH/PATHS_LOWER before the game is built |
| Compound/analogy distractors also-correct | truth-tested laws in §2 (no shared part; relation-neutral distractors with explicit `excluded[]` lists) — the who-eats discipline, now standard |
| Life-cycle / syllable / origin facts wrong | biology & phonology are ground truth: `content.test.js` restates every count, order, and source; an author edit that breaks canon fails CI |
| Consumed-control strands (dino-dig patches) | `delete` the flag/toy marker on consume (Worry-Box law) and keep every un-brushed patch flagged (find-K precedent) so the harness converges |
| Deferred round rebuilds leaving stale flags | clear ALL flags before any `setTimeout(newRound)` (the Partner-Up law) — dump-truck and drive-home both defer between rounds |
| New square cells collapsing on old Safari | every `aspect-ratio` cell ships WITH `min-height` — the generic guardrail fails the build otherwise (already enforced) |
| Emoji above the 13.0 floor sneaking in | the generic scanner guardrail + this plan's pre-verified glyph list (🪶🪨🦣🪥 are 13.0-exact and allowed; 🫧🪺🪹🛝 banned); when in doubt, check the code point BEFORE using it |
| Buddy single-owner regression | buddy-bounce READS `JoshBuddy` only; any write path to `josh-buddy` outside buddy.js fails the ownership guardrail |
| Reskin drift (tidy-up vs set-table, dino-dig vs web-reveal) | each Set-3 game's spec names what's NEW about it (bin categorization / identify-after-reveal); if during build a game collapses into a pure reskin, STOP and flag rather than ship a photocopy (profile's anti-repetition rule) |

---

## 6) Definition of Done (Set 3)

200 Josh games (240 total) registered & category-mapped · every game driven to a
win by the generic harness · 320px mobile audit green across all screens (both
one-pass sweep and the suite) · every new fact truth-tested (syllable counts,
life-cycle orders, food sources, compound parts, analogy exclusions, coat bins,
trace/zone geometry) · Josh's book fills 200/200, 华丽's untouched at 40 · full
suite + CI + **verify-live** green on the final push · the end-of-set
adversarial audit run, findings fixed, learnings appended to CLAUDE.md
(counts → 200/240, category lists extended, new-shape learnings recorded) ·
zero weakened assertions anywhere.
