# 🎨 Color Book — a color-by-number world for Josh

**Status: BUILT** (the owner, 2026-11-25: "a new game … a color by number.
Has to be of the highest quality. Deeply research art and game dynamics and
plan things out before building. At least 10 levels. Super high quality. Super
fun and exciting and worthy of a 4 year old boy who loves coloring.")

A seventh world on the front door. Josh already has a small "Color by Number"
game in his 200 (a 5x5 grid of squares); this is the real thing: a coloring
BOOK of twelve hand-drawn pages that he paints by number, each page coming
alive when it is done, and then his to recolor any way he likes.

---

## 1. Research: what makes color-by-number great (and what makes it cheap)

Read across the genre — the big phone apps (Happy Color, Color by Number
"Paint" apps), kids' paint-by-number books, and preschool color-by-code
worksheets — and against Josh's profile.

**What the best ones share**
1. **Vector regions with thick black outlines, not pixel grids.** The pixel
   apps (one square per cell) look like a spreadsheet; the coloring-book look —
   smooth shapes, a strong dark outline, white until painted — is what reads as
   a *picture* while you work. The existing `color-number` game is the pixel
   kind; this world is the book kind.
2. **The number lives IN the region, at its widest point**, and disappears
   when painted. You never hunt for which number belongs to which shape.
3. **The selected color's regions are highlighted** (Happy Color shades them).
   It turns "find all the 3s" from a scan into a satisfying sweep.
4. **The palette shows progress** — a finished color gets a ✓ and you move on.
   The next color is selected FOR you, so the flow never stalls.
5. **The fill is juicy.** The color spreads from where you touched, with a
   tiny sound. Hundreds of small rewards before the big one.
6. **The finished picture is the payoff, and it is shown off**: full screen,
   with a flourish, saved to a gallery you can revisit.
7. **Nothing to lose.** A wrong tap does nothing bad.

**What a 4-year-old changes**
- **Fat fingers.** A region the size of a truck window is smaller than his
  fingertip. So a tap is not judged by the pixel: if the finger lands *near*
  a region of the chosen color (within ~28px), that region fills. Tiny
  details are pre-colored (eyes, tyres' hubs), never numbered.
- **Every numbered region must be big enough to hold a readable digit** — a
  law the tests enforce on every page, computed from the geometry, not eyed.
- **No reading.** The paint pots carry the color AND the number; the page's
  name is spoken; the icon strip says 🎨 → 👆.
- **His numbers are 1-10 (mastered), simple addition is his edge** — so the
  ladder runs from 3 colors to 8, and the last three pages are *color by
  math*: some regions show "1+2" instead of 3 (big regions only).
- **He loves coloring itself** (it is "mastered" and calming in his profile),
  so the finished page is not the end: it becomes a **free-paint page** with a
  box of crayons where he can recolor anything, and his version is what goes
  on the fridge.
- **Transformation over decoration** (his #1 engagement principle): every
  finished page COMES ALIVE — the rocket blasts off, the dump truck tips its
  load, the fish swims, the dinosaur stomps, the wheels spin.
- **His interests**: trucks and diggers (Dump Truck!, his namesake game),
  rockets and space, dinosaurs, heroes, pirates, dragons.

**What was considered and NOT done**
- *Pinch-zoom on big pictures*: a 4-year-old cannot pinch reliably and the
  zoom state confuses. Instead every page is designed to be played unzoomed on
  a 320px phone (the size law).
- *Free brush strokes ("color inside the lines")*: lovely but a different game,
  and it makes "done" ambiguous. Free paint is region-tap, which never goes
  over the lines — the feeling of a perfect coloring page.
- *Padlocks on later pages*: kid laws say no locks. Every page is open; the
  next unpainted page glows so the ladder is suggested, never enforced.
- *A timer or score*: no.

## 2. The twelve pages (the difficulty ladder)

Numbered regions grow 5 → ~40, colors 3 → 8; the last three are color-by-math.

| # | Page | Colors | Comes alive | New idea it teaches |
|---|---|---|---|---|
| 1 | ☀️ Happy Sun | 3 | rays spin | tap a number, it fills |
| 2 | 🐟 Silly Fish | 3 | swims | many regions of one color |
| 3 | 🍦 Ice Cream | 4 | wobble | stacked shapes |
| 4 | 🚀 Rocket | 4 | blasts off | windows and flames |
| 5 | 🦕 Dinosaur | 5 | stomps | spots on a body |
| 6 | 🚛 Dump Truck | 5 | tips its load | wheels |
| 7 | 🚒 Fire Truck | 6 | siren flashes | ladders |
| 8 | 🏰 Castle | 6 | flags wave | a whole scene |
| 9 | 🏴‍☠️ Pirate Ship | 7 | rocks on the waves | sky, sea, sails |
| 10 | 🤖 Robot | 7 | waves hello | color by MATH (1+1) |
| 11 | 🐉 Dragon | 8 | flaps | color by MATH |
| 12 | 🛻 Monster Truck | 8 | bounces | color by MATH, the big one |

## 3. The page, step by step

1. Opening: the page appears as a white coloring page, its name is said
   ("Let's color the rocket!"), and pot **1** is already chosen. Nothing marks
   its regions: finding the numbers IS the game (the owner, 2026-11-25 — the
   first build made them shimmer on every pick, which was far too easy).
2. Tap a region with that number (or near one): paint spreads from the finger, a
   note plays (each fill a step up a pentatonic scale), the number vanishes.
3. When a color is all done its pot gets a ✓, a chime plays, and the next
   unfinished pot is chosen for him.
4. Tap a region with a DIFFERENT number: it does not fill; its number grows
   and the right pot wiggles ("That's a 3!"). No buzz, no loss.
5. First time ever: a ghost finger shows tap-the-pot, tap-the-shape. 👂 replays.
6. Done: the page gets shading, comes alive, confetti, the buddy cheers, a ⭐
   lands on its book page. Then a crayon box opens: free paint. 🔁 starts over.

## 4. Architecture (the Seek & Find / Gobble shape)

- `scripts/color-logic.js` — PURE, dual export, unit-tested in node: shape
  helpers (circle, ellipse, rounded rect, star, polygon, an SVG path sampler
  for M/L/H/V/C/Q/Z) that turn every shape into a polygon; a scanline
  rasterizer that paints the regions in order into an owner grid (so what is
  hidden under a later shape is not part of the earlier one); a distance
  transform that finds each region's widest point (where its number goes) and
  how wide it is; the forgiving tap judge; and the math labels.
- `scripts/color-data.js` — ALL content: the twelve pages as original vector
  drawings built from those helpers, their palettes, alive parts, and lines.
- `scripts/color-main.js` — `window.ColorBook`: #color-home (the book), #color-play
  (the page, the pots, free paint), routing from main.js, the
  `josh-color-v1` save, sound via JoshAudio only, an echo guard, timers that
  die with the screen, and `window.__COLOR` test hooks.
- Never registered in JoshFramework: Josh's Sticker Book stays 200+.

## 5. Laws (each a test)

- Every page: colors numbered 1..k with no gaps; every color used; every
  numbered region's widest point holds a readable digit at 320px (r ≥ 7 of
  200 units); a math label only on a region wide enough for it, and its sum
  is right; the palette's colors are distinct from each other (ΔE) and every
  pot's number reads on its color (contrast ≥ 3); regions grow down the ladder.
- Every region's label point is INSIDE that region's visible area.
- The tap judge: a tap on or near a matching region fills it; a tap clearly
  inside a wrong region does not; a finished region is never refilled.
- Kid laws: ≥75px pots 16px apart, no overflow at 320/390/834, iPhone 17 Pro.
- Save: coerced field by field, done ⭐ fold across tabs, free-paint colors kept.

## 6. The upgrade: compared with the color-by-number apps (2026-11-25)

The owner: "Compare to other color by number games and sites and look for ways
to improve ours … amazing and awesome and fun … deep audit and deep testing."

**What the others do, and what we took**

| What the best apps do | Theirs | Ours now |
|---|---|---|
| Help you find the last shapes | Happy Color's light bulb highlights the areas you missed, but costs an ad | 🔍 **Find it**: after a LONG quiet while (25s, restarted by every pick and every paint) ONE shape waiting for his color rings, and the ghost finger points at it. Free, silent, comes back only after another quiet while |
| Show off the finished picture | Save and share | 🎬 **Watch it paint**: the page paints itself again from white, in the order HE painted it, a note per shape, then comes alive again with his own colors |
| Special paints | Kids' coloring apps sell glitter and pattern packs | ✨ **Magic crayons**, free and first in the box: 🌈 rainbow (replaces the color), glitter, stripes and polka dots (lie over any color, so red with dots stays red) |
| A reward per picture | A badge or coins | Each page **sounds** like itself when it comes alive: the rocket whooshes up the scale, the dump truck honks, the dinosaur and the dragon roar, the fire truck's siren, the castle's fanfare, the robot beeps, the monster truck vrooms |
| Juicy taps | A soft fill | A **burst of sparkles** in the paint's color where it lands (not under reduced motion) |
| — | — | **His Chinese**: a finished color is cheered in English, then in Chinese (红色, 天蓝色…) in a Chinese voice. Cream, tan, teal and mint have no everyday word a four-year-old hears, so they stay English |

**What the comparison did NOT take**: ads, paid hints, hint counters (he never
runs out of help), timelapse export, sharing, pinch-zoom (§1), a percentage
meter (he cannot read it; the pots' ✓ are the progress).

**What the audit found**
- On the three pages with a BLACK color (fire truck, pirate ship, monster
  truck) the shimmer on a waiting shape was a mid gray, and the gray number on
  it measured 2.77:1. (The shimmer itself was then REMOVED, 2026-11-25: it
  gave away where every shape of the chosen color was. §7.)
- On a phone the crayon box became one strip of sixteen, and exactly four fit:
  the twelve colors were hidden with nothing saying so. The strip now runs edge
  to edge with a fade at the right, takes two rows on a tall phone, and glides
  to its end and back the first time it opens.

**How it is built**: a paint is `"#rrggbb"` or `"#rrggbb fx"`
(`ColorLogic.isPaint/paintOf`), saved as it is; the rainbow gradient and the
three patterns are declared once in index.html (ids resolve document-wide, so
the book's thumbnails share them, as JoshArt's light does). The painting order
of a finished page is kept in `save.order` for the replay.

**Tests added** (each proven by a mutation that puts the defect back): every
page painted to the end by real taps (each tap paints exactly one shape; every
finished color cheered, and in Chinese where it has a word); the rocket's
whoosh rises and a muted page is silent; magic crayons keep the color under
them, a plain crayon takes the magic off, they survive a reload and show in the
book; the replay starts white, paints in his order, ignores taps, ends with his
colors, and a replay cut short leaves the page whole; the hint comes by itself
after a real quiet while, rings exactly the waiting shapes, says nothing, and
goes with a tap; a broken save keeps only real stars, paints and orders;
reduced motion; label contrast on the shimmer; the patterns declared once;
every page's sound known to the player; the Chinese restated.

## 7. Harder, and a grown-ups reset (the owner, 2026-11-25)

"Don't pulse them (give the clue) the second he selects a number every time.
That's way too easy." The shimmer on every shape waiting for the chosen color
is gone: picking a pot marks nothing, and a law fails any mark a pick adds.
The 🔍 hint stays as a rescue only: after 25s with no pick and no paint, ONE
shape rings and the ghost finger points at it (it used to ring every shape of
the color after 14s).

A grown-ups ⚙️ under the last page clears every ⭐, half-painted page, his
colors and replays, through the app's ONE type-the-word gate (`JoshGate`).
Seek & Find has the same. Both stamp a reset `gen` (a time), so a second open
tab takes the reset at its next write, or on the storage event, instead of
folding its old ⭐ back in — Gobble Hole's §22 lesson, built in from the start.


## 8. Six new ways to color (the owner, 2026-11-25: "items 1-6. All. Go")

The book is now SHELVES (`ColorData.SHELVES`), each with a heading for the
grown-up, and 27 pages:

| Shelf | Pages | What is new |
|---|---|---|
| 🖍️ Color by number | the twelve | the ladder, unchanged |
| 🎲 Count the dots | 🐞 Ladybug, 🐛 Caterpillar, 🌼 Flower Pot | a shape shows a die's DOTS; he counts them and finds the pot with that number |
| 🏮 一 二 三 in Chinese | 🐼 Panda, 🏮 Lantern, 🛶 Dragon Boat | the numbers are written 一 二 三, in a Simplified Chinese face asked for by name; a pot and a wrong shape say the Chinese |
| ➖ Take away | ⛄ Snowman, 🎈 Hot Air Balloon, ⛵ Sailboat | a shape shows a−b (a real minus sign), inside ten |
| ❓ Mystery pictures | a cat, a duck, a car | a 10x10 grid of squares; the picture appears as he paints, and it is named only once it is done |
| 🌟 Big pictures | 🚂 Train, 🐠 Under the Sea, 🦋 Butterfly Garden | nine colors and 21-22 shapes: the hardest pages |
| ✏️ Draw your own | My Drawing | a blank page: a finger draws in any crayon; ↩️ takes back a stroke and 🧽 gives a clean page that ↩️ can bring back, so one tap never loses a drawing; kept in the save and shown in the book |

**How it is built**: a page's `label` ("dots" or "zh") says how its numbers
are written, and a region may carry `diff: [a, b]` as it carries `sum`. Every
label kind has its own size floor (`needR`: a digit 7, a sum or take-away
11.5, a Chinese numeral 8, dots 12), so the size law covers all of them. The
dots sit in the widest circle the shape holds, by construction. A mystery page
is built by `ColorLogic.mosaic` (a run along a row is one shape; a run under
the same run joins it) and marked `mosaic`: a painted square is outlined in
its own color, so the finished picture is seamless pixel art, and it is never
shaded square by square.

**Tests**: every new page goes through every law above (size, label inside
its shape, distinct pots, the tap judge, a child's order finishes it, it
comes alive, a sound); plus: the shelves run in order with three pages each;
every dot inside its shape and none touching; every Chinese numeral restated
and marked `lang="zh-CN"` with no digit on the page; every take-away makes its
number inside ten; a mystery grid is rectangles on the 10x10 grid and a
finished one has no grid line; the big pictures have nine colors and twenty
shapes. In the browser: the book's shelves, each label kind said and drawn,
a mystery named only when done, and the drawing page by real pointer drags
(the opening tap draws nothing; undo, clean page, undo again; kept across a
reload; cleared by the grown-ups reset).
