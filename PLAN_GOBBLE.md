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

## 9. Not in this pick (recorded, not built)

- A 2-player mode (two holes). Josh's profile names co-op as his top lever, but
  RULE 5 says to ignore extra fingers — it needs its own design.
- Stickers in his Sticker Book (that book is exactly 200 games by law).
