# 🕳️ Gobble Hole — a hole-eating game for Josh

**Status: ✅ BUILT** (2026-09-30; owner's pick the same day: "a hole eating game like
hole.io, Donut County or Hole em All … a scene of really interesting stuff and
you have to eat more and more of it to get progressively larger … super fun for
a 4 year old").
Phase 2 (big worlds you move around in, §9), phase 3 (bigger worlds and
twelve places, §11), the polish pass (§12), a quality check (§13), phase 4
(twenty-four places, each with its own shape and challenge, §14) and the pass
that makes every place come alive (§15) are built too, and so is a grown-ups
reset (§16).

A fourth world on the front door, right after 🏰 Fort Josh. Josh drags a
friendly hole-monster, **Gobble**, around a toy-box diorama. Small things fall
in, Gobble grows, bigger things fit, and at the end Gobble swallows the biggest
thing in the scene (a castle, a ferris wheel, the SUN), burps, and slurps up
everything that is left.

---

## 1. Who it is for, and what that rules out

Josh is four, reads almost nothing, plays on an iPad (iOS 14.2 floor), in
portrait. From `JOSH_PROFILE.md` and RULE 5:

- **No failure.** No timer, no rivals, nothing can eat Gobble, nothing is lost.
- **No reading.** Pictures carry everything: the growth meter ends in a PICTURE
  of the next thing Gobble can eat; the scene doors are pictures.
- **One gesture.** Drag with one finger (or tap somewhere and Gobble glides
  there). Extra fingers are ignored. No precision, no timing.
- **Show, don't tell.** The first time, a ghost hand drags Gobble onto a sweet
  and it gets eaten. 👂 replays that demo (and the spoken line, when sound is on).
- **The activity IS the reward.** Eating visibly transforms the scene and
  Gobble; growing is the celebration.
- **Nothing alive gets eaten.** Toys, food, vehicles, plants, buildings,
  planets — never animals or people, and never his favourite characters.
  Guardrail-locked by Unicode range, not by a list.

## 2. The character

Gobble lives underground; only its round dark mouth and two big googly eyes
poke out. The eyes sit on the back rim and **react**: they look where Gobble is
going (or at the nearest thing it can eat), squint happily (^ ^) after every
gulp, go wide and sparkly when it grows, and look up at a thing that is too big.
They blink. The rim chomps on each bite. A face turns physics into a story a
four-year-old can read.

## 3. Controls

- **Grab** Gobble and drag it (the grab offset is kept, so it never jumps), or
  **touch anywhere** and Gobble glides there. Let go and it finishes the trip.
- Movement is a critically-damped glide (gain 9/s, top speed ~1 scene-width per
  second): fast enough to sweep, slow enough to watch.
- Gobble can overhang the scene edge a little, so nothing is out of reach.
- Arrow keys move it too (desktop, and a keyboard-only player).

## 4. The physics (a pure, deterministic engine)

`scripts/hole-logic.js`, 60Hz fixed step, seeded RNG only, zero DOM — the fort
engine's test strategy (node sims drive whole scenes headless).

- The ground is seen in **3/4 view**: every ground distance uses one metric,
  `hypot(dx, dy / SQ)` with `SQ = 0.72`, so the hole is drawn as an ellipse and
  an object falls in exactly when it LOOKS inside it.
- An object **fits** when `r <= hole.r * FIT` (0.92).
  - fits and mostly over the hole → it tips and **falls** (clipped by the hole,
    shrinking and spinning into the dark), then it is **eaten**.
  - fits and near the rim → it is **pulled** in (a forgiving magnet that grows
    with Gobble).
  - too big and touching → it **wobbles** and Gobble's eyes look up at it (a
    soft boing, never a buzzer).
- Growth is **tiered**. Each scene has 5 size tiers + a finale. Level L eats
  tiers ≤ L+1. The level radii and the grow thresholds are DERIVED from the
  scene's own objects, never hand-tuned:
  - `R[L] = biggest radius in tier L+1 / FIT × HEAD` — and a law requires that
    tier L+2 does NOT fit yet, so every tier has its "too big — grow first!"
    moment;
  - `C[L] = ALPHA[L] × xp of every tier ≤ L` (xp ∝ area): a level-up needs
    about half-to-60% of what is edible, so it is always reachable, never needs
    the last hidden sweet, and the first one comes fast (ALPHA starts at 0.45).
- Eating the **finale** wins. Then a **vortex** slurps up everything left, so a
  win never ends with a hunt for the last crumb.
- A **hint**: if nothing has been eaten for 6 seconds, a sparkle trail points
  from Gobble to the nearest thing it can eat, and a ring pulses around it.

## 5. Scenes — six dioramas

> Phase 1's six. Phase 2 (§9) made each one a big world; phase 3 (§11) made
> the worlds bigger again and added six more places.

A diorama "island" floating on a themed backdrop, like Donut County. The island
keeps a fixed AREA and adapts its ASPECT to the screen (clamped to 0.6..1.7),
so a phone gets a tall scene, an iPad a squarer one and a phone on its side a
wide one — every aspect in that range is laid out and bot-finished in the tests. The aspect is fixed
for a run (a save restores the same layout).

| Door | Scene | Ground | Finale |
|---|---|---|---|
| 🧸 | Toy Room | wooden floor + a big round rug | 🏰 toy castle |
| 🧺 | Picnic Park | grass, a path, a checked blanket, a pond | 🎡 ferris wheel |
| 🚧 | Building Site | dirt, tyre tracks, gravel, hazard border | 🏢 tower |
| 🚦 | Busy Town | grass blocks and roads | 🏫 the school |
| 🎂 | Party Time | pastel tiles, confetti, a heart rug | 🎂 giant cake |
| 🚀 | Outer Space | stars and a nebula; Gobble is a BLACK HOLE | ☀️ the Sun |

~41 things per scene: 16 tiny (3 "starters" right beside Gobble, so the first
gulp is instant), 11 small, 7 medium, 4 large, 2 huge, 1 finale. Every emoji is
≤ Emoji 13.0 (the iPad floor) and carries VS16 where it needs it — both are
existing site-wide laws. All six doors are open from the start; a ⭐ marks a
finished scene.

## 6. Feel — the "super fun" checklist

- First gulp within 3 seconds; first "BIGGER!" within ~15.
- Every gulp: a pitch that matches the size (tiny = high blip, huge = low GLUG),
  crumbs in the thing's own colour, happy eyes. Gulps in quick succession climb
  in pitch like popping bubble wrap.
- Five grow moments per scene: a bouncy expansion, a shockwave ring, sparkles,
  a jingle, and the newly edible things hop ("now you can eat us!").
- The finale: a deep GLUG, a gentle screen shake (off under reduced motion), a
  BURP with a puff, the vortex, confetti, Josh's own buddy (`JoshBuddy`) cheers,
  and a wall of everything Gobble ate with the count.
- Sound is OFF by default (RULE 5); every sound goes through `JoshAudio`
  (mute-gated), and the game is fully playable muted.

## 7. Architecture

A world inside `index.html`, wired like the fort (so every SCRIPTS-derived law
— emoji, VS16, canvas floor, precache, syntax, speech ownership — covers it
automatically), but with Josh's kid laws fully ON (≥75px taps, 16px spacing, no
fail):

- `scripts/hole-data.js` — scenes and RULES (dual export).
- `scripts/hole-logic.js` — the pure engine (dual export).
- `scripts/hole-render.js` — canvas renderer: baked ground per scene, emoji
  sprites rendered once and cropped to their real ink, the hole, falling clip,
  particles. Reads state, never mutates it.
- `scripts/hole-main.js` — `window.GobbleHole`: screens (`#hole-home` scene
  doors, `#hole-play` the game), routing (main.js delegates `hole-*`), input,
  loop, sound, save (`josh-gobble-v1`), onboarding, test hooks `window.__HOLE`.
- `styles/main.css` — a "Gobble Hole" section.
- The loop runs only while the play screen is visible; leaving pauses it.
- A double-tap echo cannot walk Josh out: a screen that just appeared ignores a
  finger tap for 350ms (nobody can aim at a thing that appeared 50ms ago).
- Mid-scene progress is saved and restored; the whole save is coerced on load.

## 8. Tests

- **Engine (node):** deterministic layout; everything inside the island, no
  overlaps, a clear start; the tier law (each tier edible exactly at its level
  and not before); thresholds reachable and increasing; fit / fall / pull /
  wobble physics; the finale wins and the vortex empties the scene; a greedy
  bot finishes EVERY scene, with the first grow fast and no level dragging;
  save → restore is identical; nothing alive is edible.
- **Browser:** the front door's 4th door opens the world and returns; a real
  drag eats things; grow, too-big, win overlay, ⭐, next scene; progress kept
  across leaving; sound only when unmuted; the loop pauses when hidden; no page
  errors.
- **Mobile (real WebKit in CI):** all four doors above the fold; no overflow;
  every tap ≥75px and 16px apart on both new screens; a touch drag moves Gobble.

## 9. Phase 2 — BIG worlds (owner, 2026-09-30, the same evening)

> "Game works but how can we really expand the game. It's weird to have it on
> one single screen with no scroll. Most of these games are way larger levels
> where you actually have to move around."

Right: in hole.io, Donut County and Hole em All the world is much bigger than
the screen, the camera follows the hole, and it pulls back as the hole grows.
Phase 2 replaces the one-screen island with that.

### 9.1 The world and the camera

- **A fixed world per place**, about 300 × 420 units (the old island was 12,600
  units² — this is ten times that). It no longer changes shape with the
  screen: the SCREEN is a camera onto it, so a save never depends on the device.
- **The camera follows Gobble** (smoothly, a short lag) and never shows much
  past the island's edge: at an edge you see the diorama's rim and the backdrop
  beyond, which says "this is the end" without words.
- **It zooms out as Gobble grows.** The width of world shown on the screen's
  short side is `VIEW0 × (short px / 400)^0.5 × (R[level] / R[0])^0.72`. So:
  - at the start a phone shows ~48 units and an iPad ~66;
  - Gobble fills ~17% of the short side at the start and ~28% at the top size
    — he visibly grows on screen AND the world opens up around him;
  - a bigger screen shows more world rather than blowing everything up.
  After the finale the camera pulls all the way back to show the whole island
  while the vortex slurps everything in — the "look how much you ate" moment.
- **A fresh place opens with a look at the whole island** (1.6s, the castle or
  the Sun on its stage at the top), then flies in to Gobble. A finger or a key
  during it ends it at once, so the spot under the finger is always a spot he
  can see. A place he comes back to starts right on Gobble, and under
  `prefers-reduced-motion` there is no flight at all.
- **Gobble's speed scales with the zoom** (the same exponent), so he always
  crosses about a screen a second, small or huge.

### 9.2 Steering: Gobble goes where your finger is

Hold anywhere and Gobble heads for the spot under your finger. Because the
camera follows him, the spot under a finger held still keeps moving ahead, so
**holding to one side keeps him going that way** — hole.io's steering, with no
joystick to learn. A tap sends him to the tapped spot. Letting go lets him
finish the trip. (There is no look-ahead in the camera: with a finger held at
the centre, a look-ahead would make him drift forever.) One finger only, as
before; arrow keys step a quarter of the view.

### 9.3 A world worth moving around in

About **200 things per place** (≈ 82 tiny, 52 small, 33 medium, 20 large, 9
huge, 1 finale), arranged so that there is always somewhere to go:

- **Districts** (zones) give each place its geography, and the ground carries
  matching features ("decals"), so things sit where they belong:
  - Toy Room: a block corner on a play mat, an art corner with paint splats, a
    music corner on a striped rug, a bed corner, the big rainbow rug.
  - Picnic Park: three checked blankets of food, ponds, flower beds, the woods.
  - Building Site: a brick yard, gravel piles, a cement lot for the trucks.
  - Busy Town: a grid of roads (every car, bus and scooter ON a road), a park,
    a parking lot, the schoolyard.
  - Party Time: two party tables of food, a dance floor, heart rugs, the cake stage.
  - Outer Space: an asteroid belt, a space station, nebulae.
- **Clumps**: many tiny and small things come in groups of 2–5, so one pass
  hoovers up a whole bunch (hole.io's best feeling).
- **Trails**: three trails of tiny bites lead out from the start toward the
  districts — "follow the sweets".
- **The finale** stands top-centre on its own stage, the landmark to head for.

### 9.4 Growing (still derived, never tuned)

The level radii are unchanged (`R[L]` from the tiers, and the tier law). The
thresholds change, because "a fraction of everything edible" makes no sense
when there are 80 sweets spread over six screens: a grow now needs
`GROW_BITES[L]` bites' worth of the newest edible tier's xp —
`[6, 8, 8, 8, 8]`. So the first "BIGGER!" comes after about six sweets, and
every grow is reachable with most of the place still standing. The finale is
still the win; the vortex still finishes the rest.

### 9.5 Never lost

When nothing Gobble can eat has been on screen for a moment (1.2s), or the
hint (after six quiet seconds) points at something off screen, a round
**arrow bubble** appears at the screen edge, holding a picture of the nearest
thing he can eat and pointing at it. **Tapping it sends him there**, all the
way, however short the tap (92px across with a finger's slack). On screen, the
existing sparkle trail does the job.

### 9.6 Drawing a world bigger than any canvas

A baked picture of the whole world at play zoom would be ~67 MP on an iPad —
impossible. So the ground is drawn every frame, cheaply and crisply:

- the ground's TEXTURE (planks, grass tufts, stars…) is vector marks drawn
  straight onto the canvas in 64-unit squares, each kind of mark from its own
  seeded stream, with fewer marks as the camera pulls back. A repeating bitmap
  PATTERN was tried first and measured: scaled or sub-pixel, a software
  rasteriser (Josh's iPad; CI's WebKit) filters it per pixel, 70-115ms for one
  iPad screen, where a flat fill plus small marks costs a few ms;
- the lighting is 24 flat diagonal bands rather than a gradient, and a space
  nebula is 18 stepped rings, so each pixel is filled once instead of shaded;
- a finished place whose picture has stopped moving is not redrawn at all
  (it is drawn once more whenever the screen is shown again);
- the ground's FEATURES (rugs, blankets, roads, ponds…) are vector decals in
  world units, drawn only when on screen;
- things are drawn only when on screen, and each emoji's ink box is measured
  ONCE (a pixel scan) and reused at every size, with sprites in half-octave
  size steps (always rounded UP, so a sprite is only ever drawn smaller), so a
  zoom never mints a new canvas per frame; the sprite cache is capped, because
  iOS caps canvas memory.
- the backdrop past the island's edge (a wall, sky or stars) is drawn in SCREEN
  space: it is far away, so it never scrolls. When the view is entirely inside
  the island it is not drawn at all.

### 9.7 Saves

A save now carries a layout version. A half-eaten place from the one-screen
version is dropped (its ids point at a different layout); finished ⭐s are kept.

### 9.8 Tests

- **Engine:** every place lays out with nothing overlapping, everything inside,
  zoned things in their zones, trails leading out, clumps together, a clear
  start; the tier law; thresholds from GROW_BITES, reachable with most of the
  place standing; speed scales with the zoom; the bot finishes every place
  with a fast first gulp and grow; the vortex empties even a big world; save v2.
- **Browser:** the camera follows Gobble and stays on the island; the world is
  bigger than the screen; holding a finger to one side keeps him going; arrow
  keys step a quarter of the view; a grow zooms out and he never looks smaller
  on the way (sampled over real frames); only on-screen things are drawn; the
  edge arrow appears when nothing edible is in view and tapping it sends him
  there; a fresh place opens with the whole-island look (not on a resume, not
  under reduced motion) and a finger ends it; the win pulls back to the whole
  island; a half-eaten run from the one-screen version is dropped, its ⭐
  kept. Every ground feature a place declares has a drawing and a real box
  (node).
- **Mobile (real WebKit in CI):** the play screen fits and a touch drag steers him.

## 10. Not in this pick (recorded, not built)

- A 2-player mode (two holes). Josh's profile names co-op as his top lever, but
  RULE 5 says to ignore extra fingers — it needs its own design.
- Stickers in his Sticker Book (that book is exactly 200 games by law).

## 11. Phase 3 — bigger worlds, twelve places (owner, 2026-10-01)

> "Expand Gobble hole. Make each level even larger so they take more time and
> also double the amount of playable levels."

### 11.1 Bigger, and longer to finish

- **The world is 420 × 588 units**, twice phase 2's area (300 × 420). The
  districts and the finale's stage are written as fractions of the world, so
  they grew with it.
- **About 390 things per place** (381–407): roughly 164 tiny, 101 small, 65
  medium, 39 large, 17 huge and the finale. The first six places had every
  tier count doubled; the six new ones were written at the same size.
- **Growing asks for more, derived as before**: `GROW_BITES` is
  `[6, 10, 12, 14, 16]` (it was `[6, 8, 8, 8, 8]`). The first "BIGGER!" still
  comes after about six sweets; each later grow asks for more of the newest
  tier, and is still reachable with most of the place standing. Trails carry
  up to 12 bites.
- **Measured, not guessed**: the greedy bot the tests use (it always heads for
  the nearest thing it can eat) now takes about 37s on average to win a place
  (25-45s), against about 21s in phase 2 (14-25s); the top size arrives at 22-27s
  instead of 13-17s. A four-year-old wanders, so his times are several times
  the bot's. Pinned as a law: every place takes the bot at least 20s, and the
  mean is at least 30s.

### 11.2 Twelve places

Six new places join the first six. The doors run in this order, and ▶ on the
win screen walks it; Outer Space stays last, so ▶ from it wraps to the Toy Room.

| Door | Place | Ground and districts | Finale |
|---|---|---|---|
| 🧸 | Toy Room | (phase 2) | 🏰 toy castle |
| 🧺 | Picnic Park | (phase 2) | 🎡 ferris wheel |
| 🚜 | Sunny Farm | crop fields, a veg patch, an orchard, a tractor yard, fences, ponds | 🎃 a giant pumpkin |
| 🚧 | Building Site | (phase 2) | 🏢 tower |
| 🚦 | Busy Town | (phase 2) | 🏫 the school |
| ⚽ | Sports Day | a striped pitch inside a running track, three courts, a podium | 🏟️ the stadium |
| 🎂 | Party Time | (phase 2) | 🎂 giant cake |
| 🏖️ | Beach Day | sand, the SEA along the top, towels, rockpools, footprints | 🚢 the ship |
| 🌋 | Volcano Island | jungle, two lava streams, a village, a lagoon, a cave | 🌋 the volcano |
| ⛄ | Snow Day | snow drifts, two frozen ponds, two forests, a village, ski tracks | 🏔️ the mountain |
| 🛫 | Airport | tarmac, two runways, taxiways, a helipad, the terminal, a car park | ✈️ the jumbo jet |
| 🚀 | Outer Space | (phase 2) | ☀️ the Sun |

Every new place has its own ground texture (vector marks, §9.6), its own
features, and its own backdrop past the island's edge: the SEA, with waves,
around the beach and the volcano; falling SNOW around the snow island; the sky
around the farm, the sports ground and the airport. Every new thing is ≤ Emoji
13.0 and nothing alive is eaten — the same site-wide laws as before.

### 11.3 Things stand where they belong

Two new rules for where a thing may stand, both judged by its centre:

- **A private district** holds only its own things. The beach's sea takes only
  what belongs on the water — the boats and the little islands, so no bucket
  floats on it — and the airport's runways take only the planes.
- **An avoid rect** holds nothing at all: the volcano's two lava streams.
  (Phase 4 made lava a BLOCK — ground that is not ground at all — so `avoid`
  is gone; §14.2, §14.8.)

### 11.4 Laying out twice as many things

Layout tries candidate spots for each thing and keeps the one with the most
room around it. With ~390 things, checking every candidate against every
placed thing got slow, so placed things now go into a grid of 24-unit cells
and a check only looks at the cells near the candidate. Overlap checks stay
exact. "Room around it" is capped at 90 units (past that, more room changes
nothing about where a thing should go), which keeps the search small. Measured,
a place now lays out in about 34ms against phase 2's 48ms, with twice the
things.

### 11.5 The doors

Twelve doors in an even grid: 3 across on a phone (four rows, all on the
first screen of a 390 × 844 phone) and 4 across on a tablet or a phone on its
side. On a shorter phone the page scrolls; every door stays ≥ 75px and 16px
apart.

### 11.6 Cost

Following Gobble, a frame costs what it did, because only what is on screen is
drawn (390 × 844: 3.4-6.0ms; 834 × 1112: 7.6-12.3ms). The look at the whole
island, which only plays at the start and at the win, costs up to about 20%
more for twice the things (390 × 844: up to 24ms; 834 × 1112: up to 40ms).

### 11.7 Saves

The layout version goes to 3. A half-eaten place from phase 2 is dropped (its
ids now point at different things); finished ⭐s are kept.

### 11.8 Tests

- **Engine:** twelve places, each with its own door and name; at least 360
  things each in a world of at least twice phase 2's area; private districts
  and avoid rects obeyed (with a check that the keep-outs exist at all); the
  bot finishes every place, each in at least 20s and 30s on average; layout v3
  (a v2 run is refused).
- **Browser:** every place opens, draws its floor, every ground feature in the
  opening look and at least 300 things, with no picture falling back to a
  coloured ball, and Gobble eats in it; twelve doors fit a phone's first screen
  in an even grid.
- **Mobile (real WebKit in CI):** the twelve-door home fits with no sideways
  scroll, and every door is ≥ 75px and 16px apart, at 390 × 844, 320 × 568 and
  834 × 1112.

## 12. Polish — playability, fun and quality (owner, 2026-10-01)

> "Improve gobble hole in any way you can for playability and fun and quality"

### 12.1 Measured first: where a child gets stuck

The greedy bot the tests use always heads for the nearest thing it can eat, so
it finds the finale at once and cannot show where a child gets stuck. So a
**wandering-child model** was played instead: it goes for what it SEES (big
shiny things too, which bump), pauses, wanders, and follows the hint or the
edge arrow only half the time. It is a model, not a measurement of a real
child; its numbers are for comparing designs. 12 places × 6 seeds (re-run
with `node tools/hole-child.js`; `--newest` re-runs §12.6):

- **Once he was big enough for the finale, nothing pointed at it.** The edge
  arrow only came when nothing edible was in view, and with ~390 things
  something small almost always is. From the moment he could eat the finale to
  the win took a median of **16-93s** by place, and up to **122s**. A whole
  place took **149-221s**.
- With the finale's arrow (§12.2) that wait is **2-9s** (up to 22s), and a
  whole place **109-153s**.
- A hint that pointed at the NEWEST tier (the things that make him grow) made
  no difference, so it was not built.

### 12.2 The finale calls him

When he reaches the top size, the finale becomes his GOAL
(`HoleLogic.goalOf`), and five things say so:

- **The arrow points at it from anywhere**, even with plenty to eat in view:
  a gold-rimmed bubble holding the finale's picture, 72px across against the
  usual arrow's 60px, and tappable anywhere within 104px. Tap it and he goes
  there. Once the finale is on screen the arrow
  steps aside.
- **On screen, the finale is ringed and hops.** Two rings pulse out round its
  foot, drawn dark under white so they show on every floor (a gold ring
  vanished on the toy room's gold rug), and it hops every 1.6s, except under
  reduced motion.
- **Gobble wears a 👑.**
- **The grow that makes him big enough plays a fanfare and names the
  finale**: "Wow, so big! Now eat the castle!" Every finale has a spoken name
  (`finale.say`), because a line never reads a picture aloud.
- **The idle hint points at the finale** too.

### 12.3 Treasures

Three things in each place glitter: one tiny thing in the front part of the
island (near where he starts), one small thing in the middle, one medium thing
at the back (near the finale). Within its band each is as far as possible from
where he starts and from the other treasures (measured: at least 259 units
from the start and 297 from each other). They are picked FROM the layout, so
nothing moves, the layout version stays 3 and no save changes.

- A treasure has a gold glow under it and three twinkles (gold, with a white
  core and a dark rim, so they show on snow and in space).
- Eating one is a burst of gold stars, star eyes for a moment, a chime and
  "Ooh, a treasure!".
- The win screen shows the treasures he FOUND, as gold coins. There is never
  an empty slot for one he missed, because nothing here fails. A treasure the
  win's slurp swallowed was not found by him, so if he found none the row is
  not there at all.

### 12.4 The doors show how far he got

A half-eaten place's door has a small ring in its top corner that fills as the
place empties (the ⭐ in the other corner still means finished), and its label
says "N percent eaten". It reads the saved run only, and counts only whole
numbers in range, so a hand-edited save cannot draw a ring past full.

### 12.5 His face stays on screen

At the back edge of the island a big Gobble's eyes stood above the world's
top, and the camera stopped at the island, so at the two biggest sizes his
eyes were cut off by up to 19px. The camera now looks up just far enough for
his eyes, and for the crown. The drawing and the camera read one shared eye
measurement, so they cannot disagree.

### 12.6 Measured and not built

- A hint pointing at the newest tier: no difference in the model (§12.1).
- Clipping the look at the whole island to the island's frame: about 10%
  faster, in a look that plays only at the start and the win, and only in a
  headless browser that is not an iPad. Not worth a renderer change with no
  guardrail.

### 12.7 Tests

- **Engine:**
  - The goal: none below the top size; the finale at the top; none once it is
    eaten; the hint points at it.
  - The grow that makes him big enough says so (`ready`), exactly once, and it
    is the last grow.
  - Treasures: three per place, one per tier, each in its band; never a
    starter, a trail bite or the finale; far from the start and from each
    other; the layout unchanged; the same every time and after a restore.
  - Eating a treasure says so; the win's slurp eating one does not.
  - `countOf` matches what the layout places.
  - Every finale has a spoken name, and no line Gobble says reads a picture.
- **Browser:**
  - The goal arrow from far away (with plenty to eat in view), its tap, the
    crown, and the beacon round the finale's foot.
  - With sound on, the ready line names the castle, and a treasure is cheered.
  - Treasures glitter; eating one bursts gold and gives star eyes; the win
    shows only the treasures he found.
  - The door ring and its percent; a finished place shows its ⭐ instead.
  - His face is on screen at the top edge at sizes 0, 3 and 5.
- **The test hook `__HOLE.scene()` now names only the place on screen.** It
  used to name the run he LEFT, which stays parked so ▶ can carry it on. A
  door starts its place on the next task, so a test that clicked a door and
  waited for `scene()` could pass at once, on the parked run. The door test
  once played that parked run to a win and then waited for a win screen that
  never came. The play screen turns visible in the same task that starts the
  new run, so the hook cannot be fooled now. Two older tests had the same
  race; when it hit, their checks ran on the parked run, which passes them
  without testing anything.

## 13. Quality check (owner, 2026-10-01)

> "everything done, completed, tested, high quality? … ci green and clear? …
> make sure EVERYTHING is pushed … am i ok to restart claude without losing
> any important memory or context here for this project?"

Measured, not assumed: every Gobble screen and state (the home fresh and
half-eaten, the opening look, the demo hand, mid-play, the finale's call, the
win) at 17 sizes from 320x480 to 1366x1024, for tap size, the spacing between
EVERY pair of controls, overflow, controls on screen, accessible names and
contrast; all twelve places played to a win at a phone, an iPad, landscape,
320 wide and under reduced motion; offline with the server switched off.
Clean on all of that except three things, all now fixed:

- **The win box hid 🔁 and ▶ on a short screen.** It sits over the FIELD (so 🏠
  and 👂 stay usable), so it only gets the field's height, and the full layout
  is ~330px tall. In every phone landscape, at 320x480, and on a 320x568 phone
  opened from its home screen (its status bar takes 20px), the buttons were
  below the box's fold; at 568x320 the treasures were too. The shipped test ran
  at the three sizes where it fits. Below 600px tall the box is now compact: a
  64px cheer, the count beside the treasures, and in landscape a two-row banner
  (the cheer and the score, then the buttons). Taller screens are
  pixel-identical to before.
- **The home lost its last row of doors on a real phone.** At 390x844 the
  doors ended exactly at the fold — zero slack — and a notched iPhone opened
  from its home screen adds a 47px status-bar inset above the topbar, so most
  of the last row was below the fold; 375x667 and 360x640 hid the whole row.
  The picture of Gobble above the doors is decoration, so it now shows only
  where it fits WITH every door (an iPad in portrait), and a short phone's
  doors are a little shorter (still 75px+, still 16px apart). Every portrait
  phone from 360x640 up now shows all twelve, notch included. A 320-wide phone
  keeps its last row below the fold: four rows of 75px doors 16px apart cannot
  fit 568px. A phone on its side still scrolls the home (landscape is not a
  design target). Hiding the picture then put the bar's 🚪 and 👂 straight on
  the first row of doors, 12px away. The shipped spacing audit caught it in the
  full test run, so the home's bar now keeps the doors' own 16px.
- **The growth meter's bar was 14px wide at 320.** It is the flexible track
  between fixed neighbours, so it shrinks instead of overflowing and no
  overflow check can see it. Below 369px the meter's own Gobble face steps
  aside and the bar gets 64px (104px at 360); 375 and up are unchanged.

Tests (mobile.test.js, so CI runs them on real WebKit): the win box shows the
cheer, the count, the treasures and both buttons with no scrolling at nine
sizes, with real device insets added (no browser can emulate a notch), and the
meter's bar is at least 48px; the home shows all twelve doors at seven phones
and two iPads with their insets, with every tap big and 16px apart at each of
those sizes (the shipped audit measured three), and keeps the picture on an
iPad in portrait (a rule that hid it everywhere would pass every other clause).
Ten mutations, each red for its own reason.

**The wandering-child model is now `tools/hole-child.js`** (it was a scratch
script, and a restart would have lost the instrument behind §12.1 and §12.6).
Its `before` arm has to use the OLD hint, because the engine's hint now points
at the finale once he is big enough; with that, it reproduces §12.1 exactly
(16-93s, up to 122s, before; 2-9s with the call). The tools smoke test runs
both of its arms.

## 14. Phase 4 — twenty-four places, each its own shape and challenge (owner, 2026-10-06)

> "double the levels on gobble hole again. make sure the new ones are
> interesting and unique and fun. add more sound effects too if possible.
> also make sure the setup of objects varies per level significantly. i dont
> want each level to just a copy with a different skin. the layout and shape
> of the level and challenge should feel different. think smart"

Before this, every place was the same rectangle of scattered things; only the
pictures and the districts changed. Now there are twenty-four places, and
every one of them — the first twelve too — has its own SHAPE of ground, its
own PLAN (what Gobble walks round, what crosses it, where things stand) and
its own CHALLENGE (a mechanic of its own). All of it is DATA in
`hole-data.js`; the engine is the one place it becomes rules.

### 14.1 The twenty-four

| Door | Place | Shape | Challenge | Finale |
|---|---|---|---|---|
| 🧸 | Toy Room | a room | a toy train runs round the rugs: eat its cars | 🧸 the giant teddy |
| 🧺 | Picnic Park | an oval park round a pond | round the pond, or over its bridge; bump a tree and its fruit falls | 🎡 the big wheel |
| 🚜 | Sunny Farm | fenced fields | the log gate is locked: find the 🗝️ | 🎃 the giant pumpkin |
| 🚧 | Building Site | an L-shaped site behind walls | a wall of barrels and a row of trucks block two gaps until he is big enough to eat through | 🏢 the tower |
| 🚦 | Busy Town | a cross of four streets | cars, taxis and buses drive the streets and the roundabout | 🏫 the school |
| ⚽ | Sports Day | a stadium | eat one ball of a row, or one skittle, and the rest roll in after it; a ball runs the track | 🏟️ the stadium |
| 🎂 | Party Time | a heart | presents and piñatas burst with surprises | 🎂 the giant cake |
| 🏖️ | Beach Day | four sandy islands, bridged | boats sail round two bays | 🚢 the ship |
| 🌋 | Volcano Island | an island cut by lava | round the lava or over its bridges; stone heads stand on two of the bridges until he is big enough to eat them | 🌋 the volcano |
| ⛄ | Snow Day | a snowman | the frozen lake is ICE: on it he slides | ⛄ the giant snowman |
| 🛫 | Airport | a wide strip | moving walkways carry him; small planes taxi | ✈️ the jumbo jet |
| 🚀 | Outer Space | six planets | wormholes jump him between them; moons, satellites and UFOs orbit | ☀️ the Sun |
| 🛒 | Shopping Day | a shop of aisles | the shelves make aisles; trolleys roll up and down them | 🏬 the whole shop |
| 🌿 | Hedge Maze | rings of hedges | find the gap in each ring, in to the middle | ⛲ the fountain |
| 🔦 | Crystal Cave | chambers joined by tunnels | it is DARK: only the ground round Gobble is lit, and some things glow | 🔮 the crystal ball |
| 🏰 | Castle | a keep in a moat | over the moat by its bridge; the castle door is locked: find the 🗝️ | 🏰 the castle |
| 🏭 | Toy Factory | a factory floor | conveyor belts carry him; boxes pop open | 🤖 the giant robot |
| 🎪 | Circus | rings joined by bridges | two springboards bounce him across; scooters ride round the ring | 🎪 the big top |
| 🌴 | River Jungle | a tall jungle | the river carries him downstream, past round thickets | 🛕 the temple |
| ☁️ | Cloud Land | clouds joined by bridges | two rainbow slides; balloons drift on the breeze | 🌈 the big rainbow |
| 🏝️ | Treasure Island | a crescent round a bay | X marks the spot: eat an ❌ and treasure pops up; a ship sails the bay | 💰 the treasure |
| 🎢 | Theme Park | a park round a lake | a roller coaster, teacups, a carousel and boats on the lake all ride | 🎢 the roller coaster |
| 🍭 | Candy Land | a spiral road | the road winds in: small sweets first, the big ones at the end | 🍭 the giant lollipop |
| 🎵 | Music Land | a music note | every gulp plays the next note of a tune; rows of notes topple | 🎹 the giant piano |

The doors run in this order and ▶ on the win screen walks it; Music Land is
last, so ▶ from it wraps to the Toy Room. Two finales changed so that every
place builds to its own: the Toy Room's toy castle became the giant teddy (the
Castle is a place now), and Snow Day's mountain became the giant snowman.

### 14.2 The challenges (one rule each)

- **Shapes.** An island is any union of shapes — a rect, circle, oval, ring,
  a path (a road of a given width) or a polygon — each with an optional cut-out
  (`not`: the crescent's bay). They are signed distance fields, sampled once
  per place on a 2-unit grid, so a step or a placement is a lookup.
- **Blocks** are shapes he walks ROUND: water and lava (they lie below the
  ground) and hedges, fences, shelves, walls and rock (they stand up out of
  it). Ground nothing may stand on is a block, so it needs no rule of its own.
- **Bridges** cross a block or the gap between two islands.
- **Tracks:** a loop, a there-and-back line, a train (its cars keep their row)
  or an orbit. A rider the magnet catches leaves its track and is eaten.
- **Solid** things are a wall while they are too big to eat; once he is big
  enough he eats his way through.
- **Lock and key:** a locked thing is a wall and cannot be eaten until its key
  is. Bumping it says "It's locked! Find the key!" and the hint points at the
  key at once.
- **Pop and shake:** a box's surprises spill out when it is eaten; a tree's
  fruit falls the first time he bumps it.
- **Chain:** eat one of a row and the rest roll in after it, one by one, faster
  and faster.
- **Currents:** a river, a conveyor belt, a moving walkway or a rainbow slide
  carries him; let go and he floats along.
- **Ice:** on it his speed follows the finger slowly (over 0.6s), so he slides.
- **Portals:** step on one and out of its partner you come; it sleeps until he
  has walked away, so he is not bounced straight back.
- **Dark:** only the ground round Gobble is lit; glowing things show from afar.
- **Notes:** every gulp plays the next note of the place's tune.
- **Bands:** a district measured along the WAY from the start (0 at the start,
  1 at the far end), so on a spiral or a river the small things come first and
  the big ones at the end of the journey.

### 14.3 Where he can go

- Gobble's centre stands on walkable ground, outside the core (0.9 × radius)
  of every wall thing (a solid thing too big for him, a locked thing).
- A finger across water or a wall sends him ROUND it, or over a bridge: a path
  on a 5-unit walking grid, re-planned only when the finger moves to another
  cell or a wall comes down, heading for the farthest point along it he can
  see.
- He plans from his OWN side of a hedge: the nearest cell he can walk to in a
  straight line, not the nearest open cell, which can be across the hedge.
- Steered at a wall he cannot pass, he leans on it, so it bumps and says why
  (too big, or locked) instead of stopping short of it in silence.
- He moves in 1.5-unit steps and slides along a wall; when both slides are
  blocked (a notch where two cloud islands meet), he tries turning a little
  either way before he stops.
- Every gate shuts: with a wall of too-big things or a locked door standing,
  the ground it guards is a different piece from the ground he comes from; with
  it eaten or opened, one piece (tested on a 0.25-unit grid).

### 14.4 Sounds

- **Every place has its own tune** (4-8 notes), played as it opens, so no two
  places sound alike either. In Music Land every gulp plays the next note.
- **Every challenge has its own sound**, all through `JoshAudio.tone` and the
  global mute: a soft low thud for a wall too big to eat (never a buzzer —
  RULE 5), a rattle for a locked gate, a click and a rising chime when the key
  opens it, a pop when a box bursts, a rustle when a tree shakes, a whoosh
  through a portal, a "wheee" into a current, a glassy shimmer onto ice, and a
  sparkle at five and at ten gulps in a row.
- **The words are rationed:** "Surprise!" at most once in 8 seconds; "Whoosh!",
  "Wheee!" and "Whoa, slippy!" once a visit; "It's locked! Find the key!" keeps
  the "too big" line's spacing.
- **A law** (hole-logic.test.js) derives every event the engine emits and every
  event the page listens for: an event nothing plays is a challenge that
  happens in silence, so it fails. The one stated exception is the fall (the
  gulp sounds when the thing lands).

### 14.5 The doors

Twenty-four doors in an even grid: 6 across on a tablet, either way up (four
rows, all on the first screen, notch included), and 3 across on a phone
(eight rows). A phone cannot fit eight rows of doors big enough for a small
finger (75px+, 16px apart), so the home scrolls there, as Josh's own launcher
does: never sideways, the first screen shows at least three full rows with the
rest waiting below, and the last door scrolls fully into view. Gobble's
picture above the doors shows only on a tall iPad in portrait, where it fits
with every door. "Supermarket" was one word too long for a door on every
phone and on a 768 iPad, so that place is Shopping Day, and a test now fails
any name that spills out of its door.

### 14.6 The opening look rests first

A fresh place opens on a look at the whole island and then flies in to
Gobble. It used to start flying on the very first frame, so the whole island —
now the first thing that tells one place from another — was never seen still.
It rests 0.6s first.

### 14.7 Measured

- **Every place lays out cleanly** (nothing squeezed, every thing in its
  district) and holds 286-432 things (336 on average). The floor is 280 (it was
  360): a heart or a spiral has less ground than a full rectangle. "Takes a
  while" is guarded by the bot law, which still holds: every place takes the
  greedy bot at least 20s (the quickest is Beach Day at 22.1s; the longest
  Shopping Day at 49.8s), and 33.2s on average, against phase 3's 37s.
- **The progress law** holds at every size: at least twice the next grow's
  worth he can reach and eat — round every wall still too big, behind no door
  still locked — and the finale reachable. The tightest margin is 2.07 (Beach
  Day's last grow).
- **No place is a reskin:** no two share a set of challenges, and the ground
  comes in 20 different shapes. The five places on a plain room rectangle (Toy
  Room, Sunny Farm, Shopping Day, Toy Factory, Theme Park) each have a
  different plan inside it: rugs and a train, fences and a gate, shelves and
  trolleys, walls and belts, a lake and its rides.

### 14.8 What broke on the way, and is now a law

- **An outline traced from its middle split into scraps.** A lava river that
  runs off the grid's edge left an open chain, and the volcano drew its lava as
  a row of little bits. The tracer pads its grid with a ring of outside points,
  so every outline closes; a test requires every edge the renderer draws to be
  a closed ring on the island.
- **A hedge maze took most of a second to build**, measuring every hedge
  segment from every point. A segment index answers "how far to the nearest
  line" exactly within reach and cheaply beyond it; a test checks it against
  the slow answer.
- **Pressed against a hedge, Gobble never moved:** he planned from the nearest
  open cell, which could be on the far side of the hedge. He plans from his own
  side now.
- **In a notch where two cloud islands meet he stuck fast:** both slides were
  blocked. He tries turning before he stops.
- **A wall too big to eat sometimes never bumped:** steered beyond it, his path
  ended short of the wall and he stood still in silence. He leans on the wall
  now, so it bumps and says why.
- **A toppling row took ages to finish.** The chain speeds up as it goes.
- **Dead data, both ways.** Six ground features (the belt, fence, track, sea,
  lava and taxiway decals) had drawings no place used once those became blocks,
  currents and tracks; and the engine read two fields no place declared
  (`avoid`, the volcano's old lava rects, and `holes`). All are gone, and a law
  now fails a field a place declares that nothing reads (a typo) and a field
  the code reads that no place declares (a feature nothing can reach).
- **A test counted a thing as eaten whenever it was not standing** — but a
  surprise still inside its box (HIDDEN) is not eaten. It counts GONE now.
- **The sound test drives the page's REAL drain:** it pushes events into the
  running game and lets the page play them, so it tests the dispatcher a child
  hears, not a copy of it.

### 14.9 Tests

- **Engine (hole-logic.test.js):** twenty-four places, each with its own door,
  name, finale and a tune of real notes; no place a reskin, with at least 15
  different ground shapes; the progress law; every gate shuts; every outline a
  closed ring on the island; the segment index exact within reach; riders,
  solid walls, locks and keys, boxes and trees, chains, currents, ice, portals,
  routes round water and a hedge pressed against, each played headless; every
  event heard by the page; no dead field either way; and the bot law above.
- **Browser (hole.test.js):** every place opens and draws its floor, every
  ground feature and its things; twenty-four doors in an even grid, the last
  reachable; each challenge makes its own sound, the lines are rationed, each
  place opens with its own tune and Music Land's gulps play it note by note;
  the opening look rests on the whole island before it flies in.
- **Mobile (real WebKit in CI):** the 24-door home at eight phones and six
  tablets with their real insets — doors 75px+ and 16px apart, no sideways
  scroll, every name inside its door, all of it on one screen on an iPad
  either way up, and on a phone at least three full rows with the last door
  reachable.

Each new law was mutation-checked: red on the defect it names, and its control
green.

## 15. Making every place come alive (owner, 2026-10-07)

> "Improve existing gobble hole levels as much as you can. Think creatively.
> Make the game even more awesome to play"

The twenty-four places already differ in shape, plan and challenge (§14).
What they did not have was LIFE: away from a gulp, each one was a still
diorama, Gobble wore the same face everywhere, a chocolate cake and a fire
engine went down with the same blip, and the finale's moment was the same in
every place. This pass changes nothing about where anything stands (no layout
version bump, so no half-eaten place is lost); it is about what a place
feels like to play.

### 15.1 Measured first: a finale behind a gate pointed at the wrong thing

The wandering-child model (`tools/hole-child.js`) was run on all 24 places.
Everywhere but two, "big enough for the finale" to the win took a median of
3-12s. On **Sunny Farm it took 200s** (the run 353s), and on the Castle one
seed took 117s. Both finales stand behind a locked gate, and once Gobble was
big enough the goal (the arrow, the gold beacon, the crown's "now eat it!")
pointed at the finale through the gate while the key was somewhere else.

Fix: the goal is the KEY while the gate in front of the finale is shut. Which
gates guard a finale is worked out from the walking grid (no gate is named in
the data): with every gate shut there is no way to the finale, with one open
there is. The "big enough" line says "Find the key to the giant pumpkin!" in
that case. Measured after: farm 200s → 9s, castle's worst 117s → 12s.

### 15.2 Gobble dresses up for every place

Each place gives Gobble something to wear (`wear: [kind, colour]`): a cap in
the Toy Room, a hard hat on the Building Site, a party hat at the party, a
woolly bobble hat in the snow, a space helmet in space, a wizard's hat in the
crystal cave, a pirate hat on Treasure Island, headphones in Music Land… 18
kinds, drawn on the canvas in Gobble's own outline style (not emoji, so a hat
is never mistaken for something to eat). Hats sit on top of his eyes; a
flower, a bow, headphones or a balloon sit at his side. When he is big enough
for the finale his hat becomes the CROWN (the side things stay). Every kind
declares how far above his eyes it reaches, and the camera keeps that much
headroom, so a tall wizard's hat is never cut off at the island's top edge.

### 15.3 Gobble tastes what he eats

One table (`HoleData.TASTES`) sorts things into families, and each family has
its own sound, look and (the first time in a run) word:

- **sweet** (cakes, sweets, doughnuts): heart eyes. "Mmm, sweet!"
- **cold** (ice cream, ice, snowflakes): he shivers, eyes frosty. "Brrr!"
- **honk** (cars, buses, tractors): "beep beep", little sound waves.
- **siren** (police car, fire engine, ambulance): "wee-woo".
- **choo** (trains, cable cars): "choo choo" and puffs of steam.
- **horn** (boats): a low "toot toot".
- **zoom** (planes, rockets, UFOs): a rising whoosh and speed lines.
- **boing** (balls): "boing", and Gobble bounces.
- **ding** (bells, a wind chime): a bell.
- **ching** (coins, jewels, medals): "cha-ching" and gold sparkles.
- **clank** (tools, cogs, magnets, anchors): a clank.
- **squeak** (teddies and soft toys): a squeak.
- **music** (instruments): a little tune and notes floating up.
- **beep** (robots, TVs, radios, batteries): "beep boop".
- **pop** (balloons, popcorn, party poppers): a pop and confetti.

A family's sound replaces the plain gulp (never on top of it), still climbs
with a run of gulps, and Music Land's gulps still play its tune. Words are
rationed: once per family per run, and never on top of another line.

### 15.4 Every place has weather

`air: kind` per place: snow falling on Snow Day, embers rising from the
volcano, bubbles in the factory and at sea, petals in the park and the hedge
maze, leaves in town, at the castle and in the jungle, confetti at the party,
the stadium, the circus and the theme park, fireflies glowing in the dark of
the crystal cave, stars twinkling in space, sprinkles in Candy Land, notes
rising in Music Land, motes of dust in the sunbeams of the Toy Room… 15 kinds.
It is drawn in screen space with a little parallax (so it reads as "in the
air", in front of the ground), a fixed number of specks whatever the zoom (so
it costs the same at every size), and not at all under reduced motion.

### 15.5 A finale to remember

When the finale goes down, fireworks burst over the island in the place's own
colours, and a burst of the place's own weather blows out of Gobble (snow in
the snow, confetti at the party, notes in Music Land), before the vortex.

### 15.6 Super slurp

Ten gulps in a row (a run through a clump, or a toppling row) and Gobble
glows: for a few seconds his pull reaches much further and much faster, and
everything nearby he can eat zooms in. It is a reward for the way a child
already plays (sweeping through a clump), never a timer to beat. The pull
only reaches through open air: nothing is slurped through a hedge, a wall or
a locked gate. It must keep the bot law (§11.1): every place at least 20s,
30s on average.

As built (`RULES.SLURP`): the run is counted as the sparkle has always
counted it, from the second gulp, so the super slurp goes off on the gulp
whose combo reaches **10**, and the sparkle stays at five (it used to play at
ten too). For **2s** his pull reaches **12 units + 1.2 × his size** further
than the magnet's own and pulls **2.4×** as fast; a thing pulled from past the
magnet's own reach is drawn streaking in. A run that tops out at ten does not
set it off again — the run has to break (a pause of 0.6s) and build again. The
pull goes only along a straight line through open air: no water, no edge of
the world, no wall of things, no locked gate, no portal. It never takes the
finale (he goes and eats that himself), eating the finale never sets one off,
and the win ends one at once. On screen: a swirl of four arms, as wide as the
pull now reaches, spinning round him (still, under reduced motion), and his
eyes go wide; a whoosh runs up the scale; "Super slurp!" is said at most once
in 20s of play.

Measured:

| | before §15.6 | with it |
|---|---|---|
| greedy bot, quickest place | 22.1s | 23.0s |
| greedy bot, mean of 24 | 33.2s | 32.8s |
| super slurps the bot sets off | — | 62 (every place 1-4) |
| gulps during one slurp | — | median 19 (6-70) |
| wandering child, slurps per play | — | median 1-4 in 23 places; 0 in the jungle |

The first cut went off at nine (the combo's ninth step) and lasted 2.5s; the
quickest place then took the bot 20.3s, 0.3s above the law. Ten and 2s keep it
at 23.0s. The jungle gets none from the wandering child (the bot gets two):
its things stand apart along long trails, so a run of ten is rare there. The
slurp is a reward, not a promise, so that is left as it is.

### 15.7 What broke on the way, and is now a law

1. **The straight-line check SAMPLED the line every 2 units.** Sweeping the
   slurp's settings changed the bot's paths, and two of them found spots where
   it stood still for good: a cave wall that juts out by half a unit and a
   beach shore that juts out by a tenth of one, each between two samples. The
   check called the way straight, he pressed into the bulge and never moved.
   It now TRACES the line: from each point it steps on by the room it has
   (the ground's own distance to its edge, to a wall of things, to a portal).
   Random lines that graze a wall do not reproduce it — 26 measured, and the
   old check got there on every one by sliding — so the two spots the bot
   found are the test's fixtures, each asserting the geometry that makes it
   one.
2. **The portal end he has just come out of sleeps until he walks away, and a
   way that went back through it stood him on it for ever** (in space, once a
   slurp sent the bot back for a crumb). He now walks off far enough for it to
   wake, then back through. Tested on every live end of every place with
   portals, at two sizes: before the fix all 32 cases stood still.
3. **A teleported fixture is not a reachable place.** A search for walls the
   old check missed reported the Building Site stuck twice as often under the
   old engine — but those spots were pockets the fixture teleported him into,
   which no walk can reach. Check that a fixture is reachable by walking.
4. **A slurp could still be "running" when a place was done**: the finale can
   be the last thing left, and then the place is done in the same step it is
   won. The win ends a slurp at once; the renderer no longer checks the win
   itself (one owner).
5. **A frame was partly a picture of the frame before.** Several strokes leave
   round caps or joins behind (the cave ends every frame on a round join), and
   a frame drawn after round ones came out 200-1800 px different from one
   drawn after square ones. Every frame now starts from the same canvas state,
   and a test leaves the canvas messy and checks the picture does not change.
6. **The rasteriser warms up.** Two identical draws in a row can differ for
   the first draw or two after the picture changes (2919, 1746, 18, then 0 px
   in the toy room), so a "with it vs without it" pixel check passed with the
   weather drawing nothing at all. Each picture is now drawn until two frames
   agree, with a control; after a big swirl a few pixels (1-12, along a thin
   plank seam) settle differently, two orders of magnitude below the swirl.
7. **"The swirl paints" passed with the swirl's arms invisible**, because the
   faint ring at its edge and the streaks alone cleared the bar. Measured
   separately (arms ~10,200 px, ring ~2,200), the check now measures the arms
   with nothing streaking in, and the bar sits between.

### 15.8 Tests

`tests/hole-logic.test.js`: a finale behind a gate makes its key the goal;
every place's wear, air and tastes drawn both ways; the super slurp goes off
once a run, on the gulp that makes ten, for exactly 2s (a run that breaks and
builds sets it off again); its reach and its speed (an exact 2.4×) in open
air in 20+ places; never across water (6+ places), never the finale (20+
places), never as the finale's gulp; the bot sets it off in real play (24+
across the places; measured 62) and never after the win, and none is still running when a place is done; a line
that grazes a wall; a sleeping portal end. `tests/hole.test.js`: the swirl and
the streaks drawn and painted (with reduced motion too), the whoosh up the
scale and the sparkle at five only, its words once, and a frame that does not
depend on what the frame before left behind. Every new clause was
mutation-checked: 12 engine mutations and 8 page mutations, each red on its own
clause.

## 16. A grown-ups reset (owner, 2026-10-08)

> "Make sure gobble hole also has a way to reset progress to clear the stars
> from all levels. Usable by parent only"

A small, quiet **⚙️ Grown-ups** button sits under the last door of Gobble
Hole's home — after the doors, never between them. It opens the same
type-the-word gate as the ⚙️ on Josh's home: only the word **reset** (any
case) clears anything, and a tap, OK with no word, a wrong word or Cancel does
nothing. The word clears **every ⭐ and every half-eaten place** (every door's
star and ring go) and says so in a toast. It keeps "he has seen how to play"
(👂 shows the ghost hand again any time). It touches nothing outside Gobble
Hole, and Josh's own ⭐ reset never touches Gobble Hole.

- **One gate.** The gate moved out of Josh's launcher into one owner,
  `JoshGate.ask` in `main.js`, which both buttons call, so the two can never
  disagree on the word, a wrong guess or the confirmation. (The fort's reset
  stays an adult dialog in its own overlay system.)
- **One wipe.** `resetProgress()` in `hole-main.js` is called by the button
  and by the `__HOLE.reset` test hook alike, and it drops the run parked in
  memory: ▶, a door or a deep link carries that run on, and leaving the play
  screen saves it, so a wipe that left it alive would put the old progress
  straight back.

**Tests.** `tests/hole.test.js` drives the real button and gate: nothing is
cleared without the word; the word clears every ⭐ and ring; the half-eaten
place cannot come back by a deep link, a reload or its door; Josh's ⭐ and the
fort's save survive it, and Gobble Hole's save survives Josh's reset.
`tests/site.test.js` holds both worlds to the one gate and Gobble Hole to the
one wipe. `tests/mobile.test.js` checks the button is under the last door and
reachable, clear of the home indicator, at all fourteen phone and iPad sizes.
Nine product mutations, each red on at least one test, and one layout
mutation.

## 17. Phase 5 — forty-eight places in four lands (owner, 2026-10-08)

> "1) think deeply and creatively on how to make gobble hole overall even
> higher quality, more fun, more interesting, and even more challenging on
> some levels 2) double the amount of levels again. We need more fun and
> crazy levels and they can even be bigger when necessary."

Twenty-four new places, ten new kinds of thing to meet, a sixth size for the
biggest places, a new challenge for thirteen of the first twenty-four, and a
home that is four big LAND doors instead of forty-eight small ones. The
owner's rule of 2026-10-06 still decides everything: no place is a copy of
another with a different skin — a law now, over all forty-eight.

### 17.1 The lands

The home is four big doors, one per land, each showing how many of its
places are finished. A land opens a page of its twelve places (three across
on a phone, six on a tablet), the way Josh's own launcher opens a category of
games. A land is ONE picture for a non-reader, and the lands run from the
gentlest places to the craziest. `HoleData.LANDS` is the one owner of which
place is in which land and of the order ▶ walks: every place is in exactly
one land, every land holds twelve, and in each land the six older places
come first, then its six new ones (familiar before new).

| Land | Picture | Places |
|---|---|---|
| Home Town | 🏡 | Toy Room · Picnic Park · Sunny Farm · Building Site · Busy Town · Sports Day · **Bath Time · Giant Kitchen · Fire Station · Veggie Patch · Playground · Race Track** |
| Sunny Shore | ⛱️ | Party Time · Beach Day · Volcano Island · Snow Day · Airport · Shopping Day · **Under the Sea · Water Park · Harbour · Ski Mountain · Holiday Hotel · Island Hop** |
| Wild Places | 🗺️ | Hedge Maze · Crystal Cave · Castle · Toy Factory · River Jungle · Treasure Island · **Desert Dunes · Camping Night · Dino Dig · Gold Mine · Magic Forest · Lost Temple** |
| Crazy Land | 🤪 | Outer Space · Circus · Cloud Land · Theme Park · Candy Land · Music Land · **Pinball Party · Moon Base · Train Town · Number Land · Chocolate River · Giant Beanstalk** |

### 17.2 Ten new kinds of thing (one rule each)

Every one is DATA (an item option or a place field), read by the engine and
drawn by the renderer, and every one is INTRODUCED the first time he comes
near it in a visit: a voice line, a pointing finger and a ring (`meet`).

- **Buttons** (`press`): a big floor button he rolls ONTO (never eats) opens
  its gate; a gold dashed wire runs from the button to the gate.
- **Several openers for one gate** (`keys`): a gate may need three keys or
  three buttons; each says how far it has got ("two of three!"), the last
  opens it, once. This also fixed a latent defect: two keys of one name used
  to count as one.
- **Bumpers** (`bounce`): too big to eat, a bumper knocks him back — boing —
  never into water; big enough, it is food.
- **Piñatas** (`hits`): bonk one and a share of its treats tumbles out, once
  a bump; the last bonk bursts it.
- **Cannons** (`fly` portals): roll in and BOOM — he flies over walls and
  water to the far end. A one-way cannon must leave him a way home (a law).
- **Runaways** (`run`): once he can eat it, a ball or a doughnut scoots away,
  tires, rests and stays inside its patch; he corners it.
- **Turntables** (`spin` flows): a spinning floor carries him round (a
  plughole, a record, a pizza); he can always walk off it.
- **Power-ups** (`power`): a 🧲 magnet starts the super pull for 4s; a ⚡ bolt
  makes him zoom 1.6 times as fast for 5s.
- **Seedlings** (`sprout`): roll near one and its flowers pop up.
- **Counting** (`count`): every counted thing says the next number — by
  ones, twos, fives or tens — and a tally shows on screen. Number Land counts
  socks by twos; the Giant Kitchen counts cookies; Shopping Day counts apples.

And a **GIANT place** has a SIXTH size and a bigger finale (radius 28): the
Giant Kitchen, Moon Base and Giant Beanstalk. Its world is bigger (up to
504 x 706), and the tier law and the derived grows hold for six sizes.

### 17.3 The twenty-four new places

Each has its own shape of ground, its own plan and its own set of challenges
(no two of the forty-eight share a set):

| Door | Place | The big idea | Finale |
|---|---|---|---|
| 🛁 | Bath Time | the plughole spins him round; the wet floor is slippery | the bathtub |
| 🍳 | Giant Kitchen | GIANT; counters to walk round; count the cookies; a pizza turntable | the giant pizza |
| 🚒 | Fire Station | press the big red button, the garage opens, the fire engine is inside | the fire engine |
| 🥕 | Veggie Patch | seeds sprout veggies; tomatoes roll away; stepping stones over the stream | the giant sunflower |
| 🪁 | Playground | bouncy balls go boing; the roundabout spins; runaway balls | the merry-go-round |
| 🏎️ | Race Track | a wide figure-8; race cars; ⚡ zoom power-ups; tyre bumpers | the giant trophy |
| 🔱 | Under the Sea | currents carry him; coral to swim round; treasure pots crack after bumps | the sunken ship |
| 💦 | Water Park | rainbow slides; water cannons fly him pool to pool | the giant wave |
| ⚓ | Harbour | three keys open the crane yard; boats sail the bay | the big crane |
| 🏔️ | Ski Mountain | a tall mountain; ski slopes slide him down; the cable car carries him up | the snowman on the top |
| 🏨 | Holiday Hotel | lifts whisk him floor to floor; a button opens the pool deck | the giant hotel bell |
| 🌅 | Island Hop | little islands; cannons blast him across the sea; runaway beach balls | the giant palm tree |
| 🏜️ | Desert Dunes | a wide desert; quicksand to walk round; rolling rocks; bigger dunes further out | the giant cactus |
| ⛺ | Camping Night | it is NIGHT: his light shows the way; canoes on the lake | the campsite |
| 🦴 | Dino Dig | tar pits; rocks crack open into bones; a boulder wall he eats through | the giant dinosaur egg |
| ⛏️ | Gold Mine | a mine train to eat car by car; rock tunnels; 🧲 magnets | the giant diamond |
| 🍄 | Magic Forest | giant mushrooms go boing; magic seeds sprout flowers; fallen logs | the giant tree |
| 🏛️ | Lost Temple | three stone buttons open the golden door; the way in goes round the moat | the golden vase |
| 🕹️ | Pinball Party | bumpers everywhere; the plunger cannon shoots him up; a spinner | the giant pinball |
| 🌙 | Moon Base | GIANT; craters to walk round; cannons jump the big ones; ⚡ moon boots | the flying saucer |
| 🚂 | Train Town | two trains to eat car by car, a loop line, tunnels and bridges | the big steam train |
| 🔢 | Number Land | count the socks by twos; dice crack open; things in rows | the giant abacus |
| 🍫 | Chocolate River | a chocolate river carries him; lollipop seeds sprout | the giant doughnut |
| 🌱 | Giant Beanstalk | GIANT and tall; climb the stalk to the giant's castle in the clouds | the giant's boot |

Nineteen new grounds (bath, biscuit, brick, carpet, desert, dig, dock, felt,
forest, grid, kitchen, lawn, mine, moon, pinball, pool, rubber, seabed,
temple — 39 in all),
eight new block looks (counter, crates, coral, logs raised; quicksand, tar,
crater, choc flat), three new current looks (current, ski, choc), four
turntable looks (turntable, record, pizza, the plughole's whirl) and two
portal looks (lift, tunnel) besides the cannon. Two looks that existed
with nothing using them now have a place (the temple's `stone` bridges and
the mountain's `wire`), and a law fails any look nothing uses.

### 17.4 Thirteen older places got a new challenge

| Place | What is new |
|---|---|
| Castle | the castle door needs THREE keys, hidden round the grounds |
| Hedge Maze | the fountain sits behind a gate; a big button in the maze opens it |
| Volcano Island | cannons blast him over the lava river, and back |
| Party Time | piñatas take three bonks and burst into sweets |
| Toy Room | a record player: a spinning record carries him round |
| Circus | bouncy balls go boing until he is big enough |
| Candy Land | gumball bumpers go boing |
| Crystal Cave | big crystals crack after bumps and drop gems |
| Snow Day | the curling stones slide away from him on the lake |
| Shopping Day | count the apples |
| Sports Day | ⚡ zoom power-ups on the running track |
| Picnic Park | a runaway football rolls away across the park |
| Sunny Farm | seeds in the veggie patch sprout carrots |

Twelve of the thirteen were laid out again by the change (Snow Day's stones
only learned to run). A run saved on the old layout names ids that mean
different things now, so it must be dropped — but only for that place.

### 17.5 A run carries its place's fingerprint

Before this, a run only carried the layout VERSION, and bumping it drops the
half-eaten runs of EVERY place. Now each run also carries its place's layout
fingerprint (every thing's picture, spot and size), so editing one place
drops only that place's runs, and the version need never move again. A run
saved before fingerprints carries none: it is trusted, except on a place
listed in `RULES.RELAID` (the twelve above). A test holds every place's old
fingerprint and fails if a place's layout changes without being listed — and
if a listed place turns out unchanged, since that would throw his runs away
for nothing.

The loader asks the same question restore does (`runCouldRestore`, every
check except comparing the print, which needs the place laid out), so a
door never wears a ring for progress that opening it would throw away. It did
before: on every device, a twelve-place-wide promise the game then broke.

### 17.6 Measured

- 48 places; every bot win 20s or more, mean ~36s (the law: ≥ 20s each,
  ≥ 30s on average). Every progress margin at least 2.0 at every grow.
- No two places share a set of challenges, and no pair shares both its ground
  and nearly its challenge.
- 4 lands x 12 places, all on one tablet screen either way up, three across
  on a phone.

### 17.7 What broke on the way, and is now a law

- **A loop that stops at the first failure hid nine more.** The engine suite
  walks the places in order and asserts, so a failing place hides every one
  after it; it reported one problem at a time over five runs. A one-pass
  health scan (every place: squeezed, missed zones, broken formations and
  clumps, unused zones, uneven clumps, the finale's place on the journey)
  found all of them at once. Run it after any data change.
- **A lock door has a WINDOW, not a limit.** The door stands in its gap as a
  formation, so its spot must be clear ground (the gap half-width at least
  0.6 of its radius), and it must SEAL the gap (under 0.9). The first fix for
  a leaking hotel gate narrowed the gap below the window and broke the
  other law; the gap now sits in the middle of it.
- **Tests written before buttons assumed keys.** The goal, progress and
  gated-finale tests all asked for `o.key`; a finale behind a button made
  them fail on correct code. They ask for an OPENER now (a key or a button).
  A cannon says `launch`, not `warp`, for the same reason.
- **A test fixture that needs a thing to stay put must not pick a runaway**:
  the across-water slurp test picked the picnic's football, which ran.
- **A zone nothing uses is dead data**, and five places shipped one (a tray,
  a pool top, a mountain peak, a pinball drain); a clump must be whole (21
  cookies in threes, not 20).
- **A start on the island's very edge** put a starter bite off the ground
  (Under the Sea): the start moved in.
- **A short cut can make the finale the NEAR end**: the temple's south bridge
  led straight to the door, so the vase sat at 58% of the journey; with only
  the two side bridges the way in goes round the moat (82%).
- **Unreachable clouds**: the beanstalk's clouds first floated off the stalk;
  they sit at its bends now, and the progress law is what found it.
- **A tally shows every counted thing**: Number Land's first draft counted 34
  socks, too many boxes for the tally; it counts 12.

### 17.8 Tests

`tests/hole-logic.test.js`: the 48-place data law; a bot finishes every place
through every grow (six in a giant place); the fingerprint and RELAID laws
and the cheap restore check; one test per new kind of thing (openers and
their save, bumpers, counting, piñatas, cannons, runaways, never stranded,
turntables, power-ups, sprouts, first-time introductions, giant places); every
item option and every look used both ways; every door label meets AA.
`tests/hole.test.js`: the lands home and its pages; the land door's echo
never opens the place under it; a finale behind a real button; every new
thing drawn where he can see it; floor marks seeded by the place; a dropped
run shows no ring. `tests/mobile.test.js`: every land door on the first
screen at every phone and tablet size, notch included, and every land page an
even grid of kid-sized doors.
