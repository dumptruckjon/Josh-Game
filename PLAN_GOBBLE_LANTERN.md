# 🏮 Gobble Hole — Lantern Land: six Chinese places

**Status: DESIGNED, NOT BUILT.** Planned 2026-10-15. The owner asked for a new
Gobble Hole world of six places, "all varying Chinese themed", and asked for the
plan only, because there were not yet enough tokens to build it. This doc is meant
to be built from as it stands. Every claim it makes about the engine, the laws and
the emoji was checked against the code on 2026-10-15 (see §8). When it ships, flip
this Status line to BUILT; the plan-status law in `site.test.js` fails a plan doc
that still says NOT BUILT once it has shipped.

Read with `PLAN_GOBBLE.md`. Its §14 (shape, plan and challenge), §17 (lands),
§19 (Hero Night, the last land of six) and §20 (stuck spots and echo taps) are the
precedents this builds on.

---

## 1. The idea in one paragraph

A sixth land, **🏮 Lantern Land**, holds six places. Each shows a different side of
China: two festivals, a meal, a canal town, a mountain forest and a landmark.
Each place has its own ground shape, plan and challenge, never a reskin. The
signature that runs through all six is that **Gobble speaks a little Chinese**:
- the finale's name in Chinese;
- one "word of the place" the first time he eats it;
- counting lanterns 一 to 十 in the Moon Garden;
- three **character signs** per place.

Every sign is a character from Josh's own cards (the 120 中文 and the 96 新字),
so the game and his reading practice reinforce each other. None of it needs
reading: everything is spoken (and silent when muted), and the pictures carry the
play.

## 2. The six places

| # | Place (id) | Door | Shape | Challenge (`twistsOf`) | Finale |
|---|---|---|---|---|---|
| 1 | 🧨 New Year Street (newyear) | 🧨 | a FISHBONE: one long street, three alleys, a plaza at the top | at · block:stall · chain · pop · shake | 🧧 the giant red envelope, 大红包 |
| 2 | 🥟 Dumpling House (dumplings) | 🥟 | the floor IS a dumpling: a half-oval with a pleated top edge | block:screen · pop · ride · spin · track:loop | 🫖 the giant teapot, 大茶壶 |
| 3 | 🌕 Moon Garden (moonfest) | 🥮 | a full-moon circle with a round pond and four courts | block:water · bridges · count · dark · portals | 🌕 the big round moon, 月亮 |
| 4 | 🛶 Water Town (watertown) | 🛶 | a town cut into islands by a ⊞ of canals, inside a moat | block:water · bridges · flow:river · ride · track:loop | 🛶 the dragon boat, 龙舟 |
| 5 | 🎋 Panda Forest (pandas) | 🎋 | an S-shaped mountain valley that widens into glades | bands · block:bamboo · shake · sprout | 🎋 the giant bamboo, 竹子 |
| 6 | 🧱 The Great Wall (greatwall) | 🧱 | a ZIGZAG wall climbing the world, a tower at every bend | at · button · flow:slide · keys · lock · run | 🥁 the giant drum, 大鼓 |

Each challenge set is new among all 60 places. That was checked by printing
`twistsOf` for the 54 that exist (§8). The nearest neighbours: Party
{hits, pop, shake}, Toy Room {ride, spin, track:train}, Camp
{block:water, dark, ride, track:loop}, Train Land {…, portals, track:train},
Forest {block:logs, bounce, sprout} and Maze {at, bands, block:hedge, button,
lock}. Every one differs from the new set nearest it by at least two
mechanics.

Order on the land page (▶ walks it): gentle to tricky, as above. The Great Wall is
last because it is the only quest (three buttons open a gate).

### 2.1 🧨 New Year Street (春节)

The **street** runs bottom to top, with red market stalls along both sides (new
block look `stall`). Three **alleys** (hutong) branch off left and right, and the
**temple-fair plaza** at the top holds the finale.

- **Chain:** two **firecracker strings** (🧨 in line formations, `chain`) hang
  across the alleys. Gulp one end and the rest roll in after it, pop-pop-pop,
  faster and faster. That is exactly how a string of firecrackers goes off.
- **Pop:** red **gift boxes** (🎁) burst into 🪙 coins and 🍬 when eaten.
- **Shake:** **tangerine trees** (🌳) drop 🍊 when he bumps them. 桔 jú sounds
  like 吉 jí, "luck", which is why tangerines are a New Year thing.

**On arrival:** "Happy New Year!" then 新年快乐 in a Chinese voice.
**Word of the place:** 🧨, "Firecrackers!" then 鞭炮.
**Signs:** 红 red · 开 open · 家 home.
**Decor:**
- couplets (春联) and upside-down 福 diamonds by the doors;
- strings of lanterns across the street;
- a red carpet in the plaza.

**Wear:** a **tiger-head hat** (虎头帽), the traditional red-and-gold hat for
Chinese toddlers. **Air:** red-and-gold confetti (the existing `confetti`).

**Things (counts to be tuned with `tools/hole-check.js`):**
- T1: 🪙 50 (clumps of 3), 🍊 24, 🍬 20, 🥜 14, 🌰 14
- T2: 🧨 12 (two strings, chain), 🏮 14, 🥟 12, 🎁 10 (pop: 🪙 ×3, 🍬 ×2), 🌸 12
- T3: 🥁 8 (lion-dance drums), 🪁 8, 🔔 8, 🧺 10, 🪑 10, 🛍️ 8
- T4: 🌳 10 (shake: 🍊), 🚲 6, 🛵 6, 🪴 8 (kumquat pots)
- T5: 🏠 5, 🏪 4, 🏡 3, 🚌 2

Finale 🧧 r≈20 in the plaza: "the giant red envelope". It is never also an item,
because a picture may sit in one tier only.

### 2.2 🥟 Dumpling House (饺子馆)

The restaurant floor is **shaped like a dumpling**: a wide half-oval with a row of
small circles along its top edge for the pleats. Inside are four **round tables**
whose lazy Susans **turn** (`spin` flows) and carry Gobble round. **Dim sum carts**
(🛒, riding a loop track round the hall) can be eaten car by car once he is big
enough. **Folding screens** (new block look `screen`) split off the booths, and the
kitchen at the back holds the finale.

- **Pop:** 🍲 pots burst into 🥟 when eaten (boiled dumplings, 水饺).
- **Keep-out note:** the engine keeps things OFF flows, so the turning tables are
  bare discs. The food clusters round each table in ring zones. (The decal of a
  tablecloth sits under each disc.)

**Word of the place:** 🥟, "Dumplings!" then 饺子.
**Signs:** 吃 eat · 米 rice · 多 many.
**Wear:** `chef` (existing).
**Air:** **steam** (new: soft rising wisps).
**Taste:** a new **slurp** family for 🍜 🍵 🥣, with its own slurp sound and the
first-time word "Slurp!".

**Things:**
- T1: 🥟 56 (clumps of 3), 🥚 16, 🧄 14, 🌶️ 14, 🥜 12
- T2: 🥢 16, 🍵 16, 🥣 14, 🥬 12, 🍜 12, 🍚 12
- T3: 🍲 10 (pop: 🥟), 🫓 10 (scallion pancakes, 葱油饼), 🧺 10, 🏮 8
- T4: 🪑 12, 🛒 6 (ride: carts), 🪴 6
- T5: 🚪 4, 🛵 3 (delivery scooters by the door)

Finale 🫖 r≈20 in the kitchen: "the giant teapot".

### 2.3 🌕 Moon Garden (中秋)

The island is a **full-moon circle**. A round **pond** sits in the middle (block
water). Four **courts** surround it, joined by **moon gates**: round doorways that
work as portals, with a new portal look `moongate`. A **zigzag bridge** (九曲桥,
`bridges`) crosses the pond to a round terrace in its middle, where the **moon
itself** is the finale. That is a nod to the fable 猴子捞月, where the monkeys try
to fish the moon out of the water; Gobble manages it.

- **Dark:** only the ground round Gobble is lit. 🏮 lanterns and 🕯️ candles glow
  (`glow`).
- **Count, in Chinese:** exactly **ten** 🏮 lanterns. Each gulp says the next
  number in a Chinese voice, 一, 二, 三 … 十, which are the first ten of his
  中文 cards. At ten he says "十!", then "Ten lanterns!" in English. There is no
  measure word, so no 个/盏 question can contradict 华丽's 量词 game.

**Word of the place:** 🥮, "Mooncakes!" then 月饼.
**Signs:** 月 moon · 花 flower · 鱼 fish (by the pond). In the dark they show
only when lit, so finding one is a small discovery.
**Wear:** **rabbit ears** (the Jade Rabbit, 玉兔).
**Air:** **sky lanterns** (new: small glowing lanterns drifting up). They GLOW,
which the dark-weather law requires.

**Things:**
- T1: 🌼 40 (osmanthus, 桂花), 🍇 20, 🍃 20, 🌰 14
- T2: 🥮 24, 🏮 10 (count, glow), 🍐 14, 🍎 12, 🍵 12
- T3: 🕯️ 10 (glow), 🧺 10, 📜 8, 🌂 8
- T4: 🪨 10 (rockery stones), 🌳 10, 🪴 8
- T5: 🌲 4, 🏠 3 (a pavilion stand-in)

Finale 🌕 r≈20 on the terrace: "the big round moon".

### 2.4 🛶 Water Town (水乡, with the Dragon Boat Festival, 端午)

The town is a rectangle, cut into islands by a **⊞ of canals**. The canals are
**currents** (`flow:river`) that he RIDES, like a boat. An outer **moat** (block
water) is crossed by three arched **bridges**, and **sailboats** (⛵) circle the
moat on a loop track (`ride`). The **dragon boat** waits at the pier.

**Word of the place:** ⛵, "A boat!" then 船.
**Signs:** 水 water · 上 up · 下 down (on the two ends of a bridge).
**Wear:** a **conical straw hat** (斗笠).
**Air:** pink `petals` (existing). A new soft drizzle (江南 plum rain) is optional.

**Things:**
- T1: 🍃 40 (willow), 🌸 24, 🌰 16, 🥚 14 (tea eggs)
- T2: 🌂 14, 🧶 14 (silk), 🍵 12, 🧺 12, 🍑 10
- T3: 🏮 10, ☂️ 8 (open oil-paper umbrellas; a different picture from the closed
  🌂), 🪑 10, 🪴 8
- T4: ⛵ 6 (ride: the moat), 🌳 10 (willows), 🚲 6, 🪨 6
- T5: 🏠 6, 🏡 4, 🛖 2

Finale 🛶 r≈20 at the pier: "the dragon boat", 龙舟. **Optional art** (cut first if
short): a drawn dragon head at the bow and a tail at the stern, so the canoe reads
as a dragon boat. If it is cut, the spoken name becomes "the big boat", because a
line must never name what the picture is not.

### 2.5 🎋 Panda Forest (熊猫)

An **S-shaped mountain valley** widens into three glades (bands: low · mid · high).
**Bamboo groves** (new block look `bamboo`) are thickets he walks round. **Pandas
sit inside them, munching**: they are scenery, drawn in the block pass, and never
things to eat. The alive law forbids eating them, and a new law (§6) keeps them
where he can never walk.

- **Sprout:** 🌱 bamboo shoots spring up as 🌿 when he rolls near.
- **Shake:** 🌳 trees drop 🍑 peaches.

**Word of the place:** 🍃, "Bamboo leaves!" then 竹叶. Pandas eat them, and
Gobble eats them too.
**Signs:** 山 mountain · 大 big · 云 cloud.
**Wear:** **panda ears**, so Gobble dresses up as a panda.
**Air:** green `leaves` (existing). A new `mist` is optional.
**Ground:** a new `bamboo` floor (dappled leaf litter).

**Things:**
- T1: 🍃 50, 🌱 10 (sprout: 🌿), 🍄 20, 🌰 16, 🫐 14
- T2: 🌿 16, 🌸 14, 🍑 14 (also what the trees shake out), 🍎 10
- T3: 🪵 12, 🧺 10, 🍯 8
- T4: 🌳 12 (shake: 🍑), 🪨 10
- T5: 🌲 5, 🛖 2 (the keeper's hut)

Finale 🎋 r≈20 at the top of the valley: "the giant bamboo". 🎋 is the best bamboo
picture at Emoji ≤13.0; its paper strips come from 七夕, a festival that started
in China.

### 2.6 🧱 The Great Wall (长城)

The island IS the wall: a **zigzag** path about 70 units wide climbs the whole
world, with a square **watchtower** at every bend and the **great gate** at the top.

- **Quest:** a **beacon button** (`press: "gate"`) on each of the first three
  towers. Pressing one lights its beacon fire (a small drawn flame, new decal
  state). When all three are lit, the 🚪 doors across the gate open (`lock:
  "gate"`, the "keys" quest), and the finale is behind them. `goalOf` already
  points the hint and arrow at the next button, not the shut gate (§15.1).
- **Run:** 🪁 kites flutter away once he can eat them, then tire.
- **Slide:** a **toboggan run** (`flow:slide`) races down beside the lower wall.
  This is real: the Mutianyu section has one.

**Word of the place:** 🪁, "A kite!" then 风筝.
**Signs:** 长 long (长城, "the long wall") · 火 fire (at a beacon) · 门 door (at the
gate).
**Wear:** an ancient **general's helmet** with a red tassel.
**Air:** `clouds` (existing).
**Ground:** a new `wallbrick` (grey brick with crenellated edges).

**Things:**
- T1: 🧱 40, 🍂 20, 🌼 20, 🌰 14
- T2: 🪁 10 (run), 🚩 14 (banners), 🏮 10, 🧺 10, 🍎 12
- T3: 🔔 8, 🪵 10, 🎒 8 (visitors' backpacks)
- T4: 🌲 10, 🪨 10
- T5: 🚌 2 (the car park at the foot), 🏠 3, 🌳 4
- Locks: 🚪 ×3 across the gate. Buttons: ×3.

Finale 🥁 r≈20 in the gate tower: "the giant drum".

## 3. The land

**🏮 Lantern Land**:
- backdrop `["#fff0c2", "#ffc94d"]` (gold), border colour `#d62828`;
- labels in the default navy.

It goes last in `LANDS`, with its six places in the order of §2.

**Measured:**
- The navy label is **11.72 : 1 / 8.69 : 1** against the two backdrop ends, so it
  passes AA on both.
- The red 🏮 is **4.41 / 3.27 : 1**, so it stays visible (the 🕸️-vanished-on-its-
  own-door lesson, §19).
- A red backdrop would have put a red lantern on red.

**Home layout:**
- `hole-main.js` always lays the land doors out as TWO rows, so six lands become
  **three over three** with no code change.
- The bottom row narrows from two doors to three. That row needs:
  - the label-fit law re-run ("Lantern" must clear its door's content box in
    DejaVu Sans);
  - the 75px law and the every-door-on-the-first-screen law re-run, at all 8
    phones and 6 iPads with insets.
- The top row is already three across at 320px, so this is expected to pass. But
  measure it; never assume.

**Land page:** the existing `.hole-scenes[data-n="6"]` rule already puts a land of
six three across on a tablet.

Alternative name if the owner prefers: 🐉 **Dragon Land**. A land picture is never
eaten, so the alive law allows it. But no dragon appears inside except the boat's
prow, and a 4-year-old would expect dragons. Recommended: Lantern Land.

## 4. Gobble speaks Chinese (the new plumbing)

All of it goes through `JoshAudio.say(text, { lang: "zh-CN" })`, the same path
华丽's world uses, gated by `playVisible()` like every Gobble line. It follows
the speech-TURN rules in `audio.js`: an English line and its Chinese partner said
in one turn are queued, not cut off.

1. **`finale.zh`**: the ready line adds the Chinese name after the English one:
   "Now eat the giant red envelope!" then 大红包. Of the six finale names, 大红包,
   大茶壶 and 大鼓 begin with 大, a character he knows.
2. **`word: { e, en, zh }`** per place: said the first time he eats that picture
   in a visit, English then Chinese. It counts as a tastes-style first-time line,
   so a taste word for the same gulp gives way to it.
3. **`count.lang: "zh"`**: the count says 一 … 十 instead of English numbers. Law:
   a Chinese count counts at most ten.
4. **`signs: [{ ch, x, y }]`**:
   - **Drawing:** a round red plaque with one character on it, drawn in a
     **Simplified Chinese face named first** (PingFang SC, then Hiragino Sans GB,
     Noto Sans SC, Microsoft YaHei, sans-serif). Word Cards' lesson applies: an
     unnamed stack falls to a JAPANESE face, which draws different forms.
   - **Event:** the engine emits `sign` the first time his centre comes within
     reach. The page says the character (zh), then its English meaning.
   - **Saving:** a sign is said once a visit. It never blocks movement, is never
     eaten, and is not saved.
5. **Rationing:** no more than one Chinese line every ~3s apart from the finale
   pair; a sign never talks over the ready line; muted means silent. The whole
   feature is the decision in §9.3.

The spoken English meaning of a sign is the FIRST sense on its card, so the two
can never say different things. Example: 长 is "long", not "long (also zhǎng)".

## 5. New art (the bill)

Reuse is preferred everywhere. The new pieces:

| Kind | New | Reused |
|---|---|---|
| Grounds | `street` (grey flagstones, red paper bits), `bamboo`, `wallbrick` | `wood`/`oldwood` (Dumpling House), `lawn` (Moon Garden, dark), `stone` (Water Town) |
| Block looks | `stall`, `screen`, `bamboo` (+ sitting pandas) | `water` |
| Portal look | `moongate` | |
| Wear | `tiger` (虎头帽), `rabbit`, `douli` (斗笠), `pandaears`, `general` | `chef` |
| Air | `steam`, `skylanterns` (glows) | `confetti`, `petals`, `leaves`, `clouds` |
| Decals | `tablecloth`, `couplets` (+ 福), `lanternstring`, `sign` (the character plaque), `beacon` (unlit/lit) | `path`, `pond`, `soil`, … |
| Tastes | `slurp` (🍜 🍵 🥣); add 🥮 → sweet, 🧨 → pop | |
| Finale deco | dragon prow + tail on 🛶 (optional, cut first) | |

Every new wear declares its headroom; rabbit ears are tall. The crown replaces a
hat when he is ready for the finale (§12).

## 6. Laws to add (RULE 7), each mutation-proven

1. **Chinese truth table:** every Chinese string Gobble says is restated in a
   test with its pinyin and meaning (the `hl-content.test.js` precedent). Covered:
   - 新年快乐
   - the finale names: 大红包 · 大茶壶 · 月亮 · 龙舟 · 竹子 · 大鼓
   - the words of the place: 鞭炮 · 饺子 · 月饼 · 船 · 竹叶 · 风筝
2. **Signs come from his cards:** every `signs[].ch` is in `wordcards.html`'s
   HANZI or XINZI, and the English Gobble says equals that card's first sense.
   The test reads both files, so two worlds cannot drift (the measure-word law's
   shape).
3. **The Chinese count is his 一..十:** a `count.lang: "zh"` place counts ≤ 10.
   Its numerals equal the first ten HANZI cards in order.
4. **Gobble agrees with 华丽's festival table** (`hl-content.js`):
   - **Same emoji:** each festival place's finale is her festival's own emoji —
     春节 🧧, 中秋 🌕, 端午 🛶.
   - **Same customs:** its Chinese word is one of her items for that festival
     (红包 ✓, 月饼 ✓, 龙舟 ✓).
   - **Scope:** lanterns as DECOR in the Moon Garden are not a claim. Her table
     puts 花灯 under 元宵, which is a quiz-design choice (bins never share a
     custom), not a statement that Mid-Autumn has no lanterns.
5. **The canvas Chinese face names an SC font first** (structural, the Word
   Cards law).
6. **Scenery animals stand where he cannot walk:**
   - every panda point has `walk > 0` (inside its bamboo block);
   - no scenery animal is ever an item. The alive law already scans items, and
     this law makes the scenery half explicit.
7. **The beacon decal follows its button** (pixel test: unlit before the press,
   lit after).
8. **If the dragon prow is built:** a pixel diff shows it present, and the
   finale's fall takes it along (it rides the finale's own transform).

These existing derived laws cover the six automatically. Expect them to fire,
which is what they are for:
- the tier law, the progress law, and bot win times (≥ 20s each, ≥ 30s mean);
- the 280-thing floor;
- one tier per picture;
- unique doors, names, finales and tunes;
- no reskin, and picture overlap ≤ 60% (the likely pressure points: Dumpling
  House against Kitchen, Moon Garden against Garden, Panda Forest against
  Forest and Jungle, Water Town against Harbour);
- ≤ Emoji 13.0 and VS16;
- every event heard; no dead field either way; first-time introductions on the
  smallest screen;
- every outline a closed ring; every gate shuts its gap;
- `HoleData.PRINTS` (six new prints; the test reports each value);
- the land laws.

## 7. Build order (one shippable batch)

The `signs`, `word`, `finale.zh` and `count.lang` fields cannot ship ahead of the
places, because the no-dead-field law fails a field the code reads that no place
declares. And a land must hold six places. So like Hero Night this is **one
commit**. Back up WIP to the session branch after every step; the container can
roll back mid-session (§20, CLAUDE.md).

0. **Save the stuck-spot fuzzer as `tools/hole-fuzz.js`.**
   - **What it does:** a finger held anywhere, held on water and walls, and
     yanked about, plus the bot.
   - **Where it lived:** in §20 it was only in the audit agents' scratch space,
     so it is gone after a restart.
   - **Why first:** the six new places are full of exactly what grew stuck spots
     in §20 — fence ends (stalls, screens, bamboo), narrow passages (the wall)
     and bridges.
1. **Plumbing:** the four fields (§4), the sign event and drawing, the SC font,
   and laws 1-3 and 5. Unit tests run against a fixture place.
2. **Data:** the six places in `hole-data.js` and Lantern Land in `LANDS`. Iterate
   with `node tools/hole-check.js newyear,dumplings,…` until every place passes
   the tier and progress laws, the bot time, the twists and the overlap. Then run
   the fuzzer over all six.
3. **Art:** §5, in the order the places need it. Screenshot every place at 390
   and 834 and in landscape, and look at it. A box measurement is not a picture
   (§19, the 🕸️ door).
4. **Tests:** laws 4, 6 and 7 (and 8). Then the browser tests: a real ride on a
   turntable, a real Chinese count, a sign spoken, the beacon quest opening the
   gate, and the home showing six lands at every size with insets.
5. **The wandering-child model** (`tools/hole-child.js`): check the finale's call
   and the Great Wall's button quest. A gated finale's KEY must come first (§15.1).
6. **Full gate**, ship, watch CI (test, deploy, verify-live), reset the session
   branch, flip this Status to BUILT, and add the learnings to CLAUDE.md and a
   §21 to PLAN_GOBBLE.md.

Size: about one and a half Hero Nights. Hero Night was six places, one land and
new art, shipped in one session; this adds the speech plumbing and the signs. If
it must be split across sessions, split at step 1 → 2 with WIP on the session
branch, never by shipping half a land.

## 8. What was checked while planning (2026-10-15)

- **Emoji:** all 81 candidates were run against `site.test.js`'s Emoji-13.1+ ban
  ranges and its text-default (VS16) set. Every candidate passes. 🌶️ ⛰️ ☂️ 🖌️ must
  carry VS16. 🐼 and 🐉 are in the alive ranges (`hole-logic.test.js`), so they are
  scenery only.
- **Challenge sets:** `twistsOf` printed for all 54 places. The six sets in §2 are
  new and each differs from its nearest neighbour by ≥ 2 mechanics.
- **Uniqueness:** the finales 🧧 🫖 🌕 🛶 🎋 🥁 and the doors 🧨 🥟 🥮 🛶 🎋 🧱 are
  used by no existing place as a finale or a door. Tests require every door, name
  and finale to be unique, and each picture to sit in one tier.
- **His characters:** read from `wordcards.html`. The signs 红 开 家 吃 多 月 花 鱼
  水 上 下 山 大 云 门 are on his 中文 cards; 米 长 火 are on his 新字 cards.
- **华丽's festival table** (`hl-content.js`) pairs 春节 🧧 (饺子 红包 春联),
  端午 🛶 (粽子 龙舟 艾草) and 中秋 🌕 (月饼 赏月 嫦娥). These are the finales chosen
  here, so law 4 holds by construction.
- **Land-door contrast:** computed (§3).
- **Home layout:** confirmed in `hole-main.js` (two rows, columns from the
  row counts).
- **The plan-status law:** a "NOT BUILT" section inside `PLAN_GOBBLE.md` would
  read as the whole doc's verdict, so this plan is its own file.

## 9. Decisions for the owner (each has a default; the build uses the default if not told otherwise)

1. **The land:** 🏮 **Lantern Land** (default) or 🐉 Dragon Land.
2. **Any swap?** Default: the six above. Ready alternates:
   - 🍑 **Peach Mountain**, the Monkey King's mountain from the old story *Journey
     to the West* (public domain), with no character shown: cloud jumps (a `fly`
     look), a cave behind a waterfall (a portal look), peach trees to shake, and
     🍑 the magic peach as finale.
   - 🫖 **Tea Hills**: terraces to climb.
   - 🀄 **Grandma's Courtyard**: a 四合院 home with a mahjong table, a nod to
     华丽's world, with 🀄 the giant mahjong tile as finale.
3. **How much Chinese:** **full** (default: the finale name, a word of the place,
   the Chinese count and the character signs), finale names only, or none.
4. **The dragon prow on the Water Town finale:** build it (default, but the first
   thing cut if the build runs long) or skip it and say "the big boat".

## 10. Deliberately NOT in this plan

- **Eating any animal or person.** No pandas, dragons, zodiac animals, rabbits or
  fish. The alive law forbids it, and pandas and dragons appear only as scenery.
- **Anything from a film or show.** No Kung Fu Panda, no Mulan, no named
  character. A web hero's world had the same rule (§19).
- **Japanese pictures used as Chinese:**
  - 🏯 (a Japanese castle);
  - ⛩️, 🎎, 🎏, 🎐, 🎍;
  - 🍡 🍙 🍢 🍥 🍘 🍱 🍣 (Japanese foods).
  This matters because the emoji's vendor art is part of correctness.
- **Measure words in Gobble's lines.** "十!" then "Ten lanterns!", so nothing can
  contradict 华丽's 量词 game.
- **Tunes that are not public domain:**
  - Dumpling House: 两只老虎 (Frère Jacques);
  - Moon Garden: 茉莉花 (a Qing folk song);
  - the other four: our own short pentatonic phrases (宫商角徵羽, C D E G A).
  Nothing modern (e.g. 恭喜恭喜, 月亮代表我的心).
