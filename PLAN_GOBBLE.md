# 🕳️ Gobble Hole — a hole-eating game for Josh

**Status: ✅ BUILT** (2026-09-30; owner's pick the same day: "a hole eating game like
hole.io, Donut County or Hole em All … a scene of really interesting stuff and
you have to eat more and more of it to get progressively larger … super fun for
a 4 year old").
Phase 2 (big worlds you move around in, §9), phase 3 (bigger worlds and
twelve places, §11), the polish pass (§12) and a quality check (§13) are built
too.

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
