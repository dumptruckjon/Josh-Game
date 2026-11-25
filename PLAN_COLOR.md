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
   ("Let's color the rocket!"), and pot **1** is already chosen; its regions
   shimmer.
2. Tap a shimmering region (or near one): paint spreads from the finger, a
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
