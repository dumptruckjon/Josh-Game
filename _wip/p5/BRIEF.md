# Gobble Hole — Phase 5 design brief

## The owner's request (2026-10-08, verbatim)
"1) think deeply and creatively on how to make gobble hole overall even higher quality, more fun, more
interesting, and even more challenging on some levels 2) double the amount of levels again. We need more
fun and crazy levels and they can even be bigger when necessary. Be smart re: your plan before you start."

So: 24 places -> 48. The new 24 must be "fun and crazy", each its own shape, plan and challenge (the
owner said on 2026-10-06 "i dont want each level to just a copy with a different skin. the layout and
shape of the level and challenge should feel different"). Some places (new or old) should be MORE
CHALLENGING. Worlds may be bigger where it helps.

## Who plays
Josh, age 4, iPad (iOS 14.2), portrait, non-reader. RULE 5 (CLAUDE.md): no failure states, no timers (or
hidden gentle ones), no precision or rapid-tap mechanics, one finger, sound off by default and the game
fully playable muted, pictures carry everything, celebrate everything. From his profile: "~70% challenge
/ 30% confidence"; "ease him into anything new — new mechanics need a slow, worked walkthrough the first
time"; loves puzzles, space/stars, vehicles, animals (but NOTHING ALIVE is ever eaten), Spidey and
Numberblocks (characters can never be eaten either), his Feb-14 birthday. Numbers/counting are his math
edge.

"Challenge" for a 4-year-old here means: a bigger journey, finding things (keys, buttons), a route to
work out (round water, through a maze), a chase, an order to do things in — never failing, never a
timer, never a precision test. A stuck child must always have the hint, the edge arrow and the goal
beacon (they exist), and anything new must announce itself (a voice line + a visual cue) the first time.

## Hard laws every place must keep (tests enforce them)
- Data: 5 tiers (shared sizes T1..T5) + a finale (r 20, unique emoji, spoken `say` name); unique door
  emoji, name and finale across ALL places; a tune (4-8 notes, real Hz); `wear` and `air` kinds the
  renderer has; backdrop of two colours; `ground` the renderer has.
- Emoji <= 13.0 (Josh's iPad is iOS 14.2) and VS16 on text-default ones. NOTHING ALIVE is eaten (no
  animals, people, characters — a Unicode-range law). Plants, food, toys, vehicles, buildings OK.
- Layout must fill cleanly: nothing squeezed, every thing in its district, >= 280 things per place
  (typical 286-432), START_CLEAR around the start, starters and trails of tier-1 bites.
- The TIER LAW (each tier edible at exactly its level) and the derived GROW law (a grow = GROW_BITES
  bites of the newest tier).
- The BOT LAW: a greedy bot finishes every place, first gulp < 1.5s, first grow < 3s, win >= 20s, mean
  over all places >= 30s (today 32.8s; a seed alone moves a place 10-20s).
- The PROGRESS LAW: at every size, at least 2x the next grow's worth reachable round every wall still
  too big / behind every door still locked; the finale reachable. (Today's tightest margin 2.07.)
- Every GATE seals its gap (only Gobble's CENTRE meets a wall: a gap must be narrower than the wall
  thing's core = 0.9 * r).
- Every outline a closed ring on the island.
- NO PLACE IS A RESKIN: every place's challenge SET (keys: block:<look>, bridges, portals, flow:<look>,
  ice, dark, notes, bands, track:<orbit|train|loop|line>, ride, at, solid, lock, key, pop, shake, chain —
  plus any new mechanic's key) must be UNIQUE among all 48; and any two places must differ in ground shape
  (32x32 walk mask IoU < 0.9, or aspect ratio >= 1.15x) OR in challenge by >= 2 mechanics. At least 15
  distinct ground shapes today (aim for many more).
- Every engine event must be heard by the page (a sound) or have a stated reason; no dead data field
  either way (a field a place declares must be read; a field the code reads must be used by a place).
- Opening look readability: a world beyond ~2x today's area makes tier-1 things unreadable (4.6 css px
  at 2x on a phone) — so "bigger" means up to roughly 1.4-2x area, not more.
- Perf: no bitmap patterns, no big gradients, floor marks per 64-unit tile, iOS 14.2 canvas floor.

## Today's 24 places (id, ground, world, challenge set)
toyroom wood | ride track:train
picnic grass | block:water bridges shake
farm farm | at block:fence key lock
build dirt | at block:wall solid
town town | ride track:line track:loop
sports pitch | at chain ride track:loop
party party | pop
beach sand | bridges ride track:loop
volcano jungle | at block:lava bridges solid
snow snow | block:rock ice
airport tarmac (600x440) | flow:walkway ride track:loop
space space | portals ride track:orbit
market tiles | block:shelf ride track:line
maze grass | bands block:hedge
cave cave | dark
castle stone | at block:wall block:water bridges key lock
factory metal | block:wall flow:belt pop
circus ring | bridges portals ride track:orbit
jungle jungle (380x760) | bands block:hedge flow:river
cloud cloud | bridges flow:slide ride track:loop
pirate sand | block:rock bridges pop ride track:loop
themepark party | block:water ride track:loop track:orbit track:train
candy candy (520x728) | bands
music stage (480x672) | at chain notes
Mechanic usage: ride 11, track:loop 7, bridges 7, at 6, block:water 3, pop 3, bands 3, block:wall 3,
track:orbit 3, chain 2, key/lock 2, solid 2, portals 2, block:hedge 2, block:rock 2, and once each:
shake, ice, dark, notes, block:fence, block:lava, block:shelf, flow:belt/river/slide/walkway.
Finales used: 🧸 🎡 🎃 🏢 🏫 🏟️ 🎂 🚢 🌋 ⛄ ✈️ ☀️ 🏬 ⛲ 🔮 🏰 🤖 🎪 🛕 🌈 💰 🎢 🍭 🎹.
Doors used: 🧸 🧺 🚜 🚧 🚦 ⚽ 🎂 🏖️ 🌋 ⛄ 🛫 🚀 🛒 🌿 🔦 🏰 🏭 🎪 🌴 ☁️ 🏝️ 🎢 🍭 🎵.
Grounds (20): wood grass dirt town party space farm pitch sand jungle snow tarmac tiles cave stone metal
ring cloud candy stage. Cheap new grounds: a solid base + blobs/dots/tufts (mud, moon, seabed, desert,
autumn, chocolate, bricks-as-rows...). Block looks: water lava hedge fence shelf wall rock (cheap new flat
liquids: slime, chocolate, tar; cheap new raised looks reusing a deco: coral, crates, logs, snow-wall).
Bridge looks: planks rope stones sandbar rainbow (stone is DEAD). Flow looks: belt walkway river slide.
Track looks: rails coaster road lane taxi orbit none (wire is DEAD). Portal looks: spring, wormhole.
WEAR (18): cap straw hardhat party propeller bobble bubble chef wizard knight tophat explorer pirate halo
flower bow headphones balloon. AIR (15): motes petals fluff dust leaves confetti sparkles embers snow
clouds stars fireflies bubbles sprinkles notes. 40 decal kinds exist (rug mat splat stripes path blanket
flowers shade patch crops soil tracks pond gravel pallet slab puddle park nebula footprints rockpool
towel heart dance cloth zebra yard road lot hedge station pitch court podium runway terminal drift ice
helipad stones).
Taste families (each with a sound/look/word): sweet cold honk siren choo horn zoom boing ding ching
clank beep squeak music pop.

## Engine extension menu (from a code study; S/M/L effort)
(a) BUMPERS that bounce Gobble away (pinball): S — a knock velocity added like a flow, through moveBy so
    he can never be knocked into water. (b) BUTTONS / pressure plates (step on one, a gate opens): M.
(c) SEVERAL KEYS for one gate (collect all 3): M — also fixes a latent defect (two keys of one name: only
    one is seen today). (d) WIND fans: S (a flow with a wind look; pulsing is more). (e) TURNTABLE /
    a spinning floor that carries him round: S. (f) MOVING WALLS (a solid thing sliding on a track): M
    (prototype works). (g) TIDE: L (skip). (h) RUNAWAY things that flee and must be cornered (a rolling
    ball, a kite, a runaway cart — never alive): M. (i) MULTI-BUMP PINATA (bump it N times, treats burst
    out): S-M. (j) GROWING things (a beanstalk that sprouts as he passes): S. (k) TELEPORT rings in a
    sequence (one-way portals): S data only. (l) ONE-WAY doors: M with a stranding risk (needs a law).
    (m) FOG / clouds that clear as he explores: S engine, M-L renderer. (n) POWER-UPS (eat a magnet ->
    a super-slurp-like pull; speed boots): S. (o) SLOPES / hills he rolls down: S. Also: a cycling
    drawbridge (S, but a timer); a per-place grow-bites override or a SIXTH TIER with a bigger finale (S:
    a longer, bigger adventure — the camera pulls out further; tests pin 5 tiers today). A COUNT mode
    like Music Land's notes (every gulp says the next number aloud) costs almost nothing and hits Josh's
    numbers edge.
Engine-ready but unused: one-way portals, flows that carry things, whole-place ice.
