# ✨ New Worlds — eight small worlds on trial

**Status: BUILDING** — the shell and 🚧 Dig Site are built; the other seven
follow one at a time (§3). Each starts SMALL (three or four levels) so the
owner can trial it with Josh; a world he likes grows later.

## 1. Why a hub

The owner's pick (2026-11-26): "all of them … design and build and test and
refine and improve them, one by one … start fairly small so I can trial them
with him". Eight more doors on the front door would not fit above the fold on
a phone (seven already needed a short wide door), so the eighth door is ✨ New
Worlds, a hub with a door per world. Color Book and New Worlds share a short
fourth row in portrait; a phone on its side shows the eight as two rows of
four. A world Josh loves can later graduate to its own front door.

## 2. The shell (scripts/town-main.js)

One owner of everything a world must never re-invent:

- **Routes:** `#town-home` (the hub), `#town-<world>` (its level doors), and
  `#town-play` (a level). main.js delegates every `town-*` hash, isolated in a
  try/catch like every other world.
- **A world** registers `{ id, name, icon, color, say, levels, play(api, level) }`
  and draws its level into `api.stage`.
- **The contract** is the framework's: `api.next(els)` is the ONE writer of
  `data-correct`, and `api.done(cheer)` ends a level (`data-done="1"`). So ONE
  test walk plays every level of every world, derived from the registry.
- **No failure:** `api.bump(el, line)` wiggles and says what to do. A hint ring
  appears on the next tap after 7s with no step.
- **The hammer's echo:** a finger's second tap inside 350ms, on the same control
  or on one that was not on screen when the first tap began, is swallowed. A
  finished board answers nothing.
- **Save:** `josh-town-v1` keeps only ⭐ per level. ⭐ fold across two tabs, and
  a grown-ups reset (through `JoshGate`) stamps a `gen`. A level is a minute or
  two, so a level he left starts over.
- **Timers** die with the screen (`api.later`); motion goes through `api.move`
  on a wrapper (the shared `.bump`/`.pop` own the button's transform).

## 3. The worlds (ranked 2026-11-26; built in this order)

| # | World | First levels |
|---|---|---|
| 1 | 🚧 Dig Site | Fill the Hole · Clear the Road · Crane Tower · Mix the Cement — BUILT |
| 2 | 🍳 Little Kitchen | picture recipes, Grandma's dumplings in Chinese |
| 3 | 🚂 Train Yard | turn track tiles to join the line; cargo by number |
| 4 | 📮 Delivery Day | parcels to houses by picture, letter, word, number |
| 5 | 🌱 Josh's Garden | ⭐ earned anywhere become seeds to plant and grow |
| 6 | 🧩 Shape Builder | fill a picture's outline with shapes |
| 7 | 🎸 Band Room | an animal band plays the song he lays out |
| 8 | ⚙️ Marble Run | pick the piece for each gap; the marble rolls |

### 🚧 Dig Site (scripts/town-dig.js)

Each job ends with the thing he built being USED:

- **Fill the Hole:** three scoops fill the truck (counted aloud), and the truck
  tips into the hole. Three loads fill it, and it becomes a garden.
- **Clear the Road:** the bulldozer pushes four rocks off, then the roller
  smooths the road 1-2-3-4 in order. Cars drive it.
- **Crane Tower:** stack blocks bottom to top as the plan shows. Every colour
  also wears its own shape, so it reads in any colour vision. A flag goes on top.
- **Mix the Cement:** add the sand and water the card shows (2-4 sand and 1-2
  water, seeded), mix, and pour a path. Footprints walk it.
