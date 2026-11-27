# ✨ New Worlds — eight small worlds on trial

**Status: BUILDING** — the shell, 🚧 Dig Site, 🍳 Little Kitchen, 🚂 Train Yard, 📮 Delivery Day, 🌱 Josh's Garden and 🧩 Shape Builder are built; the other two
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
| 2 | 🍳 Little Kitchen | Fruit Salad · Pancakes · Pizza · Grandma's Dumplings — BUILT |
| 3 | 🚂 Train Yard | First Track · Round the Bend · Zig Zag · Animal Train — BUILT |
| 4 | 📮 Delivery Day | Pets · Letters · Words · Numbers — BUILT |
| 5 | 🌱 Josh's Garden | Plant Flowers · Pull Carrots · Pick Apples · Butterflies — BUILT |
| 6 | 🧩 Shape Builder | House · Car · Rocket · Robot — BUILT |
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

### 🍳 Little Kitchen (scripts/town-kitchen.js)

He cooks from a PICTURE recipe card: each step is a picture and a count
(🍓 ×3), the step he is on has a ring, and a finished step is ticked. He taps
the right thing on the counter that many times, counted aloud, and the bowl
changes with every tap (fruit in the bowl, the batter turns yellow, the pan
fills with pancakes, the pizza gets its toppings). The dish goes to a friend
(River, Raegar, Viraj, drawn as the rest of the app draws them), who says yum.

- **Fruit Salad** for River: strawberries, bananas, grapes, a stir.
- **Pancakes** for Raegar: eggs, milk, flour, a stir, cook in the pan.
- **Pizza** for Viraj: sauce, cheese, mushrooms, olives, the oven.
- **Grandma's Dumplings:** skins, then each dumpling filled is counted in
  CHINESE (一 二 三 …), into the pot, and Grandma says 好吃 (and what it means).

The counts are seeded per play (strawberries 2-4, dumplings 3-5), so a level
replays differently. A wrong thing on the counter wiggles and says what the card
asks for next. Counting, following a sequence, and the practical-life feel of
cooking, which is his Montessori school's.

### 🚂 Train Yard (scripts/town-train.js)

A track puzzle: the station is at the top, the end (a house, a castle, the
fair, the farm) at the bottom, and between them a grid of track tiles, each
turned the wrong way. A tap turns a tile a quarter; the track lights up from the
station as far as it joins, so he SEES how far it reaches, and when it reaches
the end the train chugs the whole way and stops on it. Any tile may be turned in
any order (`data-free`: a move, never a wrong tap); the hint ring only suggests
the first one that does not join yet.

- **First Track:** three straight tiles, one tap each.
- **Round the Bend / Zig Zag:** curves, five and six tiles.
- **Animal Train:** load two to four cows first, counted, then turn the track
  to the farm. A track tapped before they are on says so.

A level is DATA (the path's cells); each tile's kind and right turns are
DERIVED from its neighbours, and `TrainLogic.check` proves in node that every
level can be solved. Every tile starts turned wrong (`data-fits`), so there is
always a puzzle.

### 📮 Delivery Day (scripts/town-mail.js)

A mail truck, a street of six houses and four parcels. The parcel shows who it
is for and each house wears its address; the street climbs the reading ladder:

- **Pets:** the same animal on the parcel and on the house (match).
- **Letters:** a letter on each (no I/L, O/Q or U/V, which look alike on iOS).
- **Words:** a PICTURE on the parcel, WORDS on the houses — he reads them
  (cat / bat / hat share a rime, so the word must be read, not guessed).
- **Numbers:** dots on the parcel, set as a DICE face so he can see how many
  as well as count them; numerals on the houses.

A wrong house wiggles and says what it is ("That house says dog"), which
teaches; the right one takes its parcel and someone waves thank you, and the
pile in the truck empties to 📭. `MailLogic.street` deals six different
addresses and four parcels among them, proven in node over 1,200 streets to
give every parcel exactly one house.

Found on the way: the parcel count in the truck was one short after the first
delivery (it updated before the count moved on), and the first test of "a
word's parcel shows its own picture" played two seeds, which never dealt "cat"
— a cat parcel drawn as a dog passed. It now deals until every word has been on
a parcel.

### 🌱 Josh's Garden (scripts/town-garden.js)

A garden that GROWS with everything he does: its home shows one flower for
every game of his he has beaten and every New Worlds level he has finished,
read through their owners (`JoshProgress`, filtered to his registered games —
never 华丽's and never a stale id — and the shell's new `Town.starCount()`).
The shell gained `banner` for this: a world may show something above its level
doors, rebuilt on every visit.

- **Plant Flowers:** dig, drop a seed, two splashes of water (counted), the
  sun — in that order (a tool out of turn wiggles and says what comes first);
  three beds bloom.
- **Pull Carrots:** pull exactly as many as the sign says (three to five).
- **Pick Apples:** only the red ones. A green apple wears a leaf a red one
  does not, so the two differ by more than colour.
- **Butterflies:** each butterfly lands on the flower of its own colour; the
  colours are also different flowers, and the butterfly carries its flower.

Nine mutations, each red. On the way the empty and dug beds changed from 🟩/🟫
boxes (a brown box on brown soil drew nothing) to plain soil and a 🕳️.

### 🧩 Shape Builder (scripts/town-shapes.js)

A picture's outline waits in dashed lines; one part glows, and he picks the
shape that fits it from three in the tray (circle, square, triangle,
rectangle). The piece places itself — no dragging, no turning — and when the
picture is whole it comes alive: the house lights up, the car drives, the
rocket blasts off, the robot waves. Every tray piece wears the part's own
colour, so only the SHAPE tells them apart, and a rectangle piece stands the
way its slot does (a door is tall, a car body is wide), so "which fits" never
needs a turn in his head.

A picture is DATA (its parts, each a kind of shape in a box on a 200-unit
page). `ShapeLogic.tray` always holds the right kind once and two OTHER kinds.
A law holds every part to LOOK like what it is called — a square or circle
even, a rectangle at least 1.4 times longer one way — because the first robot
body was a "rectangle" 80 by 76, which reads as a square, and the square in the
tray would then have been a right answer marked wrong. Seven mutations, each
red.

