# 🕳️ Gobble Hole — a hole-eating game for Josh

**Status: ✅ BUILT** (2026-09-30; owner's pick the same day: "a hole eating game like
hole.io, Donut County or Hole em All … a scene of really interesting stuff and
you have to eat more and more of it to get progressively larger … super fun for
a 4 year old").

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

- the ground's TEXTURE (planks, grass tufts, stars…) is one small repeating
  pattern tile, re-rendered whenever the zoom changes enough to matter;
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
