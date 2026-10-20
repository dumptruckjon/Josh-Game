# 🏮 Gobble Hole — Lantern Land: twelve Chinese places

**Status: DESIGNED, NOT BUILT.** Planned 2026-10-15 as six places and grown to
twelve on 2026-10-20. The owner asked for a new Gobble Hole world of six places,
"all varying Chinese themed", as a plan only, because there were not yet enough
tokens to build it. They then said it could go beyond six ("perhaps to 10 or
12"), and left the amount of Chinese, the designs and the names to this plan.
So every choice in §9 is made, not left open. This doc is meant to be built from
as it stands. Every claim it makes about the engine, the laws, the emoji and
the names was checked against the code (see §8), and the whole plan was then
reviewed against the code and the culture (§11). When batch A ships this line
becomes PARTLY BUILT, and when batch B ships, BUILT. Today the plan-status law in
`site.test.js` cannot see a Gobble land at all (it only knows the fort's worlds),
so batch A step 6 extends it to read `HoleData.LANDS` (§7).

Read with `PLAN_GOBBLE.md`. Its §14 (shape, plan and challenge), §17 (lands of
twelve), §19 (Hero Night, the last new land) and §20 (stuck spots and echo taps)
are the precedents this builds on.

---

## 1. The idea in one paragraph

A sixth land, **🏮 Lantern Land**, holds twelve places, each a different side of
China:
- three festivals: New Year, Mid-Autumn, the Dragon Boat;
- a meal and a grandmother's courtyard home;
- four landscapes: bamboo forest, tea hills, a canal town, a mountain from an old
  story;
- a writing desk, a winter ice city, a kung fu school and a landmark.

Each place has its own ground shape, plan and challenge, never a reskin. The
signature that runs through all twelve is that **Gobble speaks a little Chinese**:
- the finale's name in Chinese;
- one "word of the place" the first time he eats it;
- counting lanterns 一 to 十 in the Moon Garden;
- three **character signs** per place.

Every sign is a character from Josh's own cards (the 120 中文 and the 96 新字),
and no two places share one. So the land teaches 36 of his characters, and the
game and his reading practice reinforce each other. None of it needs reading:
everything is spoken (and silent when muted), and the pictures carry the play.

**Why twelve, not ten:** a land holds six places or twelve (the land law), so
that every row of doors on the land page is full. Ten would leave a ragged row.

## 2. The twelve places

Listed in land-page order (▶ walks it), gentle to tricky.

| # | Place (id) | Door | Shape | Challenge (`twistsOf`) | Finale |
|---|---|---|---|---|---|
| 1 | New Year Street (newyear) | 🧨 | a FISHBONE: one long street, three alleys, a plaza at the top | at · block:stall · chain · pop · shake | 🧧 the giant red envelope, 大红包 |
| 2 | Dumpling House (dumplings) | 🥟 | the floor IS a dumpling: a half-oval with a pleated top edge | block:screen · pop · ride · spin · track:loop | 🫖 the giant teapot, 茶壶 |
| 3 | Hutong House (courtyard) | 🀄 | a square courtyard house (四合院): four wings round a yard | at · block:wall · run · sprout | 🀄 the giant mahjong tile, 麻将牌 |
| 4 | Panda Forest (pandas) | 🎋 | an S-shaped mountain valley that widens into glades | bands · block:bamboo · shake · sprout | 🎋 the giant bamboo, 竹子 |
| 5 | Tea Hills (teahills) | 🍃 | a broad hill of wavy tea rows on three terraces | bands · block:hedge · ride · sprout · track:line | 🍵 the giant teacup, 大茶杯 |
| 6 | Water Town (watertown) | 🛶 | a town cut into islands by a ⊞ of canals, inside a moat | block:water · bridges · flow:river · ride · track:loop | 🛶 the dragon boat, 龙舟 |
| 7 | Moon Garden (moonfest) | 🥮 | a full-moon circle with a round pond and four courts | block:water · bridges · count · dark · portals | 🌕 the big round moon, 月亮 |
| 8 | Monkey Mountain (monkey) | 🍑 | a tall mountain with a waterfall, two cloud islands off its sides | block:rock · launch · portals · shake | 🍑 the magic peach, 仙桃 |
| 9 | Writing Desk (writing) | 🖌️ | a hanging scroll unrolled down the world, a giant 大 written on it | bands · block:ink · pop · run | 🖌️ the giant brush, 大毛笔 |
| 10 | Ice City (icecity) | 🧊 | a frozen river across the middle, ice castles at the top | at · flow:slide · ice · solid | ❄️ the giant snowflake, 大雪花 |
| 11 | Kung Fu School (kungfu) | 🥋 | a plum blossom: five round training yards round a centre | at · bounce · button · chain · lock | 🔔 the great bell, 大钟 |
| 12 | The Great Wall (greatwall) | 🧱 | a ZIGZAG wall climbing a GIANT world, a tower at every bend | at · button · flow:slide · giant · keys · lock · run | 🥁 the giant drum, 大鼓 |

**Every challenge set is new among all 66 places.** That was checked by computing
`twistsOf` for the 54 that exist and comparing all 66 sets (§8). Each new set
differs from its nearest neighbour by at least two mechanics. The closest pairs:

| New place | Nearest existing place | Mechanics apart |
|---|---|---|
| Water Town | Beach Day | 2 |
| Hutong House | Building Site | 3 |
| Panda Forest | Giant Beanstalk | 3 |
| Writing Desk | Desert Dunes | 3 |
| Ice City | Building Site | 3 |
| every other new place | — | 4 or more |

**No two places share more than 39% of their pictures** (the law's limit is 60%).
The worst pair is New Year Street with Hutong House.

**The Great Wall is the land's only GIANT place.** It gets a sixth size and a
finale of radius ≥ 26, like the Giant Kitchen, Moon Base and Giant Beanstalk. It
is the longest thing people ever built, so the land should end on it.

**It ships in two batches, each a whole land** (§7):
- **Batch A:** places 1-6. Lantern Land is a land of six until batch B lands.
- **Batch B:** places 7-12, appended in order.

Because places 1-6 never move, nothing on Josh's land page shifts under him when
batch B arrives.

### 2.1 🧨 New Year Street (春节)

The **street** runs bottom to top, with red market stalls along both sides (new
block look `stall`). Three **alleys** (hutong) branch off left and right, and the
**temple-fair plaza** at the top holds the finale.

- **Chain:** two **firecracker strings** (🧨 in line formations, `chain`) hang
  across the alleys. Gulp one end and the rest roll in after it, pop-pop-pop,
  faster and faster. That is exactly how a string of firecrackers goes off.
- **Pop:** red **gift boxes** (🎁) burst into 🪙 coins and 🍬 when eaten.
- **Shake:** **tangerine trees** (🌳) drop 🍊 when he bumps them. In Cantonese
  桔 (gat) sounds just like 吉 (gat), "luck", and the character 桔 even has 吉
  inside it, so tangerines and kumquat trees are a New Year thing.

**On arrival:** "Happy New Year!" then 新年快乐 in a Chinese voice.
**Word of the place:** 🧨, "Firecrackers!" then 鞭炮.
**Signs:** 红 red · 春 spring (春节 is the Spring Festival) · 乐 happy (快乐).
**Decor:**
- couplets (春联) and an UPRIGHT 福 diamond on each door (a main door's 福 is
  pasted upright; the upside-down 倒福, "福到", belongs on a water vat, so one vat
  by the plaza wears it);
- strings of lanterns across the street;
- a red carpet in the plaza.

**Wear:** a **tiger-head hat** (虎头帽), the traditional red-and-gold hat for
Chinese toddlers. **Air:** new `paper`: red and gold scraps of firecracker paper
(鞭炮屑). The existing `confetti` draws its own six rainbow colours and takes no
colour (the weather law fails one that is given a colour), so red and gold needs
its own kind.
**Ground:** new `street` (grey flagstones with red paper bits).

**Things** (starting counts: every place's list already sums to at least the
280-thing floor, with its surprises counted the way `countOf` counts them; tune
with `tools/hole-check.js`):
- T1: 🪙 60 (clumps of 3), 🍊 30, 🍬 24, 🥜 18, 🌰 18
- T2: 🧨 14 (two strings, chain), 🏮 16, 🥟 14, 🎁 10 (pop: 🪙 ×3, 🍬 ×2), 🌸 14
- T3: 🥁 8 (lion-dance drums), 🪁 8, 🧺 10, 🪑 10, 🛍️ 8
- T4: 🌳 10 (shake: 🍊), 🚲 6, 🛵 6, 🪴 8 (kumquat pots)
- T5: 🏠 5, 🏪 4, 🏡 3, 🚌 2

Finale 🧧 r≈20 in the plaza: "the giant red envelope". It is never also an item,
because a picture may sit in one tier only.

### 2.2 🥟 Dumpling House (茶楼)

The restaurant floor is **shaped like a dumpling**: a wide half-oval with a row of
small circles along its top edge for the pleats. Inside are four **round tables**
whose lazy Susans **turn** (`spin` flows) and carry Gobble round. **Dim sum carts**
(🛒, riding a loop track round the hall) can be eaten car by car once he is big
enough. **Folding screens** (new block look `screen`) split off the booths, and the
kitchen at the back holds the finale.

- **Pop:** 🍲 steamer pots burst into 🥟 when eaten (steamed dumplings, 虾饺 and
  蒸饺, the dumplings a dim sum house serves).
- **Keep-out note:** the engine keeps things OFF flows, so the turning tables are
  bare discs. The food clusters round each table in ring zones. (The decal of a
  tablecloth sits under each disc.)

**Word of the place:** 🥟, "Dumplings!" then 饺子.
**Signs:** 吃 eat · 饿 hungry (Gobble always is) · 香 smells good.
**Wear:** `chef` (existing). **Air:** **steam** (new: soft rising wisps).
**Ground:** `wood` (existing).
**Taste:** a new **slurp** family for 🍜 🍵 🥣, with its own slurp sound and the
first-time word "Slurp!".

**Things:**
- T1: 🥟 70 (clumps of 3), 🥚 20, 🧄 18, 🌶️ 18, 🥜 16
- T2: 🥢 20, 🍵 18, 🥣 16, 🥬 14, 🍜 14, 🍚 14
- T3: 🍲 10 (pop: 🥟), 🫓 10 (scallion pancakes, 葱油饼), 🧺 10, 🏮 8
- T4: 🪑 12, 🛒 6 (ride: carts), 🪴 6
- T5: 🚪 4, 🛵 3 (delivery scooters by the door)

Finale 🫖 r≈20 in the kitchen: "the giant teapot", said in Chinese as **茶壶**,
never 大茶壶. In old Beijing 大茶壶 was the name for a brothel's tea boy, so it is
on law 10's ban list. A dim sum house is a 茶楼, a tea house, so the teapot is the
right biggest thing. (A northern 饺子馆 is a different restaurant, with boiled
dumplings and no carts, which is why this one is a 茶楼.)

### 2.3 🀄 Hutong House (四合院)

A Beijing **courtyard house**, a grandmother's home. The island is a square:
- **The house:** four low wings (block look `wall`) stand round a central yard,
  with doorways between them. The main hall faces south across the yard (正房,
  the place of honour) and holds the finale.
- **The vegetable bed:** in one corner of the yard.
- **The gate:** a roofed, rectangular red gate with door knockers at the bottom,
  where he arrives (a 四合院's street gate; round 月亮门 are garden gates, and the
  Moon Garden has those).

The challenges:
- **Run:** balls of **yarn** (🧶) roll away from him, tire, and stop, the way a
  ball of knitting wool gets away across a floor.
- **Sprout:** 🌱 in the vegetable bed spring up as 🥬 bok choy (白菜).
- **At:** 🥟 dumplings stand in neat rows on the table in the side room
  (formations), the way they are laid out when a family makes them together.

**On arrival:** "Grandma's house!" It is a nod to 华丽, whose world has a 麻将牌艺
category, but nothing claims to be her house: "Grandma" is any grandmother.
**Word of the place:** 🧶, "Yarn!" then 毛线 (毛 is on his 新字 cards).
**Signs:** 家 home · 奶 grandma · 玩 play.
**Wear:** a red knitted `bobble` hat (existing), as if grandma had knitted it.
**Air:** orange `leaves` (an autumn courtyard). **Ground:** `brick` (existing:
grey brick paving, which is what a 四合院 yard is).

**Things:**
- T1: 🌱 12 (sprout: 🥬), 🌰 40, 🍬 34, 🥜 28
- T2: 🧶 8 (run), 🥬 16, 🍵 18, 🧧 16 (red envelopes from grandma), 🍊 18,
  🥟 20 (at: rows on trays)
- T3: 🪑 10, 🧺 10, 🏮 12, 📻 6 (grandma's radio), 🧸 8
- T4: 🚲 6, 🛵 4, 🪴 8
- T5: 🌳 3 (the courtyard tree), 🚗 2

Finale 🀄 r≈20 in the main hall: "the giant mahjong tile", 麻将牌. Its face is 中,
a character on his cards. **Never 大麻将**: 大麻 means cannabis, so a "big
mahjong" line must not put 大 in front (law 10).

**Its name was measured, not chosen.** "Grandma's House" was the first name. The
door labels are checked in DejaVu Sans, the wider font CI's real WebKit uses, and
the rule is that a name's longest word must leave at least 3px of room in its door.
"Grandma's" has **0.1px** at 320 wide and runs **1px past** its door at 360, so it
fails at once. "Hutong" has 24px. The grandmother is in the arrival line, the
signs and the things instead.

### 2.4 🎋 Panda Forest (熊猫)

An **S-shaped mountain valley** widens into three glades (bands: low · mid · high).
**Bamboo groves** (new block look `bamboo`) are thickets he walks round. **Pandas
sit inside them, munching**: they are scenery, drawn in the block pass, and never
things to eat. The alive law forbids eating them, and law 6 keeps them where he
can never walk.

- **Sprout:** 🌱 bamboo shoots spring up as 🌿 when he rolls near.
- **Shake:** 🌳 trees drop 🍎 apples. They are not peaches, so Monkey Mountain's
  magic peach stays special.

**Word of the place:** 🍃, "Bamboo leaves!" then 竹叶. Pandas eat them, and
Gobble eats them too.
**Signs:** 黑 black · 白 white (by the pandas, which are both) · 叶 leaf (by the
bamboo).
**Wear:** **panda ears**, so Gobble dresses up as a panda.
**Air:** green `leaves` (existing). **Ground:** new `bamboo` (dappled leaf litter).

**Things:**
- T1: 🍃 64, 🌱 14 (sprout: 🌿), 🍄 26, 🌰 22, 🫐 20
- T2: 🌿 20, 🌸 18, 🍎 20 (also what the trees shake out)
- T3: 🪵 14, 🧺 10, 🍯 10
- T4: 🌳 12 (shake: 🍎), 🪨 10
- T5: 🌲 5, 🛖 2 (the keeper's hut)

Finale 🎋 r≈20 at the top of the valley: "the giant bamboo". **🎋 is a named
exception to §10's Japanese-pictures rule.** Its Unicode name is TANABATA TREE and
its paper wish-strips are a Japanese Tanabata custom. It stays because there is
no plain bamboo at Emoji ≤13.0, and 华丽's world already uses 🎋 as bamboo
(`games-hl-b.js`, `content.js`). The door 🎋 and the Kung Fu School's 🎋 bamboo
poles fall under the same exception.

### 2.5 🍃 Tea Hills (茶山)

A broad hill, seen from the front. **Tea grows in long wavy rows** across the
slope (block look `hedge`, which is already green; a look's colours are fixed,
so there is no per-place tint), stepped up three terraces (bands:
low · mid · high). Gaps in the rows make the way up, so climbing the hill is a
gentle zigzag.

A **cable car** line (`track:line`) runs straight up one side, and its 🚡 cars ride
it and can be eaten car by car once he is big enough. That is the "ride", and
plenty of Chinese tea mountains have one. The **tea house** at the top holds the
finale.

- **Sprout:** 🌱 tea shoots spring up as 🌿 tea leaves.

**Word of the place:** 🌿, "Tea leaves!" then 茶叶.
**Signs:** 绿 green · 山 mountain · 喝 drink (at the tea house).
**Wear:** `straw` (existing), a tea-picker's hat. **Air:** `clouds` (existing), the
morning mist on a tea hill. **Ground:** `farm` (existing: rows of soil).

**Things:**
- T1: 🌱 18 (sprout: 🌿), 🌿 66, 🌼 52
- T2: 🧺 22 (tea baskets), 🍐 22, 🍯 14
- T3: 🫖 12, 🪣 10, 🏮 10, 🪑 10
- T4: 🚡 5 (ride: the cable car), 🌲 12, 🪨 10
- T5: 🛖 3, 🏡 3, 🌳 4

Finale 🍵 r≈20 in the tea house: "the giant teacup", 大茶杯. Small teapots (🫖)
on the hill are fine: Dumpling House's 🫖 is its FINALE, and a picture may be one
place's finale and another place's thing.

### 2.6 🛶 Water Town (水乡, with the Dragon Boat Festival, 端午)

The town is a rectangle, cut into islands by a **⊞ of canals**. The canals are
**currents** (`flow:river`) that he RIDES, like a boat. An outer **moat** (block
water) is crossed by three arched **bridges**, and **sailboats** (⛵) circle the
moat on a loop track (`ride`). The **dragon boat** waits at the pier.

**Word of the place:** ⛵, "A boat!" then 船.
**Signs:** 河 river · 上 up (on the crest of a bridge, its highest point) · 下 down
(at the water's edge below that bridge, its lowest point). A sign speaks when he
comes near, whichever way he is going, so the pair is taught by HEIGHT, which does
not depend on direction. At the two ends of a bridge, a child climbing from the
下 end would hear "down" on the way up. (Up and down are the cards' first senses,
which law 2 requires.)
**No arrival greeting:** the Dragon Boat Festival's greeting is 端午安康 ("a safe
and healthy 端午"). 端午 remembers the poet Qu Yuan and was a day for warding
off illness, so many families prefer 端午安康 to 端午快乐, and a breezy "Happy
Dragon Boat Day!" would sit oddly. (Folklorists also say 端午快乐 is fine; the
place simply does not need a greeting.) Silence is the honest choice.
**Wear:** new `douli`, a **conical straw hat** (斗笠). **Air:** pink `petals`
(existing). **Ground:** `stone` (existing).

**Things:**
- T1: 🍃 50 (willow), 🌸 36, 🌰 28, 🥚 20 (tea eggs)
- T2: 🌂 18, 🧵 18 (silk thread), 🍵 16, 🧺 14, 🍑 14
- T3: 🏮 12, ☂️ 10 (open oil-paper umbrellas; a different picture from the closed
  🌂), 🪑 10, 🪴 8
- T4: ⛵ 6 (ride: the moat), 🌳 10 (willows), 🚲 6, 🪨 6
- T5: 🏠 6, 🏡 4, 🛖 2

Finale 🛶 r≈20 at the pier: "the dragon boat", 龙舟. A drawn **dragon head at the
bow and a tail at the stern** make the canoe read as a dragon boat (§5; decided,
§9). The finale's fall takes them along (law 8).

### 2.7 🌕 Moon Garden (中秋)

The island is a **full-moon circle**. A round **pond** sits in the middle (block
water). Four **courts** surround it, joined by **moon gates**: round doorways that
work as portals, with a new portal look `moongate`. A **zigzag bridge** (九曲桥,
`bridges`) enters the pond **from the far (north) side** and crosses to a round
terrace in its middle, where the **moon
itself** is the finale. That is a nod to the fable 猴子捞月, where the monkeys try
to fish the moon out of the water; Gobble manages it.

- **Dark:** only the ground round Gobble is lit. 🏮 lanterns and 🕯️ candles glow
  (`glow`).
- **Count, in Chinese:** exactly **ten** 🏮 lanterns. A gulp says the next
  number in a Chinese voice, 一, 二, 三 … 十, which are the first ten of his
  中文 cards. The rule is the shipped count's: a number per gulp unless the voice
  is still busy (`COUNT_GAP_MS`, 700ms), and always the last one. At ten he says
  "十!", then "Ten lanterns!" in English. There is no measure word, so no 个/盏
  question can contradict 华丽's 量词 game.
- **Why the bridge enters from the far side:** the finale must be at least 0.6 of
  the walking route from the start. Probed with the shape above, a bridge from
  the start side puts the moon at 0.47 of the route, and one from the far side at
  0.77. Re-measure once the moon-gate portals are in, since portals count.

**On arrival:** "Happy Moon Festival!" then 中秋快乐.
**Word of the place:** 🥮, "Mooncakes!" then 月饼.
**Signs:** 月 moon · 星 star · 鱼 fish (by the pond). In the dark they show only
when lit, so finding one is a small discovery.
**Wear:** **rabbit ears** (the Jade Rabbit, 玉兔).
**Air:** **sky lanterns** (new: small glowing lanterns drifting up). They GLOW,
which the dark-weather law requires. **Ground:** `lawn` (existing).

**Things:**
- T1: 🌼 52 (osmanthus, 桂花), 🍇 28, 🍃 28, 🌰 20
- T2: 🥮 30, 🏮 10 (count, glow), 🍐 18, 🍎 16, 🍵 16
- T3: 🕯️ 12 (glow), 🧺 12, 📜 10, 🌂 10
- T4: 🪨 10 (rockery stones), 🌳 10, 🪴 8
- T5: 🌲 4, 🏠 3 (a pavilion stand-in)

Finale 🌕 r≈20 on the terrace: "the big round moon".

### 2.8 🍑 Monkey Mountain (花果山)

**Flower-Fruit Mountain**, the monkeys' home in *Journey to the West* (西游记,
written in the 1500s and long in the public domain). The plan never draws or names
the story's hero, so there is nothing from any film or show. The mountain itself
is what is famous.

**The island:** a tall mountain:
- **Shape:** wide at the foot, narrowing to a peak at the top.
- **Waterfall:** a pool about halfway up.
- **Cloud islands:** two small ones float off its sides.
- **Monkeys:** **scenery monkeys** sit on the rocky crags (block `rock`), drawn in
  the block pass and never eaten (law 6), like the pandas.

The challenges:
- **Launch, as CLOUD JUMPS:** one-way flights (`fly` portals) with a new look
  `cloud`, the story's somersault cloud (筋斗云).
  - **Routes:** a cloud carries him out to each cloud island, and a cloud on each
    island carries him back (the progress law needs a way home).
  - **Wording:** like Hero Night's web swing (§19), a cloud jump is said and
    introduced as a cloud ("Jump on the cloud!"), never as a cannon (law 11).
- **Portals:** the **water-curtain cave** (水帘洞). One end stands behind the
  waterfall, with a new portal look `waterfall`; the other is in a hidden glade
  near the peak.
- **Shake:** 🌳 fruit trees drop 🍐 pears.

**Word of the place:** 🍌, "Bananas!" then 香蕉.
**Signs:** 花 flower · 果 fruit (花果山 is "Flower-Fruit Mountain") · 飞 fly
(beside a cloud jump).
**Wear:** new `circlet`, a thin **gold headband**, the story's most famous object.
**Air:** pink `petals` (existing), peach blossom (桃花). **Ground:** `grass`
(existing).

**Things:**
- T1: 🍒 52, 🍇 40, 🌸 32
- T2: 🍌 36, 🍐 20 (also what the trees shake out), 🍊 20
- T3: 🥭 14, 🍈 12, 🥥 12
- T4: 🌳 10 (shake: 🍐), 🍉 8, 🍍 8
- T5: 🪨 5 (boulders), 🌲 4

Finale 🍑 r≈20 at the peak: "the magic peach", 仙桃. **If the scenery monkeys are
ever cut, the place must be renamed "Peach Mountain"**, because a name must not
promise what is not there.

### 2.9 🖌️ Writing Desk (书桌)

The island is a **hanging scroll** (卷轴), unrolled down the world:
- **The paper:** a tall sheet of rice paper, with a round roller across its top
  and its bottom.
- **The giant character:** **大**, written down the middle in black ink. Its
  three strokes are blocks (`path` shapes, new look `ink`) that he walks round.
  The opening look rests on the whole island before it flies in, so Josh sees the
  giant 大 before he plays inside it.
- **Bands:** three, top to bottom.

The challenges:
- **Pop:** 🎒 school bags burst into ✏️ 📏 📒.
- **Run:** ✏️ pencils roll away from him, the way pencils roll off a desk.

**Word of the place:** 📚, "Books!" then 书 (on his 新字 cards).
**Signs:** 写 write · 字 character · 大 big. The 大 sign stands beside the giant
大, so the sign names the wall he is walking round.
**Wear:** `cap` (existing) in ink-black and red. **Air:** `motes` (existing).
**Ground:** new `ricepaper`: cream, with a faint red 田字格 grid, the practice
squares he writes in on the 写字 pad.

**Things:**
- T1: 📎 46, 🖍️ 36, 📌 28, 🔖 24
- T2: ✏️ 14 (run; also what the bags pop out), 📏 16, 📒 16, 🧽 14
- T3: 📚 14, 🎒 8 (pop: ✏️ ×2, 📏, 📒), 📜 10, 💡 8
- T4: 🖼️ 8, 🗂️ 8, 🏮 8
- T5: 🌏 3 (a globe turned to show China), 🖥️ 3

Finale 🖌️ r≈20 at the foot of the last stroke: "the giant brush", 大毛笔.

### 2.10 🧊 Ice City (冰城)

Harbin, in China's far north, holds a winter festival of buildings carved from
river ice, and its nickname is literally **冰城, "Ice City"**:
- **The river:** a frozen one (the 松花江) runs across the middle of the island
  (`ice`: he slides on it).
- **The banks:** snow on both sides.
- **The castles:** ice castles stand at the top.

The challenges:
- **At + solid:** walls of 🧊 ice blocks stand in formation round the castle yard.
  They are too big to eat at first; once he is big enough he eats straight
  through them.
- **Slide:** long ice slides (`flow:slide`) run down from the castle towers to the
  river. The real festival has exactly these.

**Word of the place:** 🧊, "Ice!" then 冰. 冰 is not on his cards, so it is spoken
only, never a sign.
**Signs:** 雪 snow · 冬 winter · 冷 cold.
**Wear:** new `earflap`, a **fur hat with ear flaps**, what a Harbin child wears.
**Air:** `snow` (existing). **Ground:** `snow` (existing).

**Things:**
- T1: 🌰 58 (roasted chestnuts, 糖炒栗子), 🍬 46, 🥟 34
- T2: 🍐 18 (frozen pears, 冻梨, a Harbin winter treat), 🍦 20, 🧤 14, 🧣 14,
  🏮 14 (red lanterns, which Harbin hangs for the New Year season; 🏮 is a paper
  lantern, not a 冰灯 carved from ice)
- T3: ⛸️ 12, 🛷 12, ☃️ 10, 🎿 10
- T4: 🧊 16 (at, solid: the ice walls), 🌲 8
- T5: 🎡 2 (the festival's big wheel), 🏠 3

Finale ❄️ r≈20 in the castle yard: "the giant snowflake", 大雪花. All three of its
characters are on his cards. Snow Day shares 22% of these pictures, and its
snowman is ⛄; Ice City's is ☃️, a different picture.

### 2.11 🥋 Kung Fu School (武馆)

The island is a **plum blossom** (梅花): five round training yards set round a
round centre. The yards are named for the **plum-blossom stakes** (梅花桩) that
kung fu students balance on. The **bell tower** in the top yard stands behind a
gate, with the finale inside.

The challenges:
- **At:** 🪵 wooden stakes stand in rings in each yard (formations).
- **Bounce:** 🎯 practice pads knock him back, boing, until he is big enough to eat
  them.
- **Chain:** a row of 🧱 bricks topples one after another when he gulps the first,
  like a brick-breaking chop.
- **Button + lock:** a 🔴 button by the gong opens the bell-tower gate (🚪, `lock:
  "tower"`).

Nobody is hit: the bricks topple and the pads boing, and no person is drawn.

**Word of the place:** 🧱, "Bricks!" then 砖. Not 🥋 "Kung fu!": 🥋's vendor art
is a karate gi with a black belt (its keywords are judo, karate and taekwondo), so
saying 功夫 over it would label a Japanese picture as kung fu. 🥋 stays as the door
and as a thing, a named exception like 🎋 (§10), because no other martial-arts
picture exists at Emoji ≤13.0.
**Signs:** 手 hand · 跳 jump · 快 fast.
**Wear:** new `headband`, a red band tied with two tails. **Air:** `dust`
(existing), kicked up in a training yard. **Ground:** `stone` (existing).

**Things:**
- T1: 🥢 54, 🍚 42, 🍵 32, 🥟 32
- T2: 🧱 14 (two rows, chain), 🪵 24 (at: rings of stakes), 🥋 14, 🎋 12 (bamboo
  poles), 🏮 12
- T3: 🎯 10 (bounce), 🥁 10, 🏺 10
- T4: 🌲 10, 🪨 8, 🔴 1 (press: "tower")
- T5: 🏠 4, 🌳 4
- Lock: 🚪 ×1 across the tower gate.

Finale 🔔 r≈20 in the bell tower: "the great bell", 大钟. It rings when he
swallows it.

### 2.12 🧱 The Great Wall (长城) — GIANT

The island IS the wall: a **zigzag** path about 70 units wide climbs the whole
world, with a square **watchtower** at every bend and the **great gate** at the top.
It is the land's giant place (`giant`), with a sixth size. Its world is larger, to
fit the zigzag, and is to be sized with `tools/hole-check.js`.

- **Quest:** a **beacon button** (`press: "gate"`) stands on each of the first
  three towers.
  - Pressing one lights its beacon fire (a small drawn flame, a new decal state).
  - When all three are lit, the 🚪 doors across the gate open (`lock: "gate"`,
    the "keys" quest), and the finale is behind them.
  - `goalOf` already points the hint and arrow at the next button, not the shut
    gate (§15.1).
- **Run:** 🪁 kites flutter away once he can eat them, then tire.
- **Slide:** a **toboggan run** (`flow:slide`) races down beside the lower wall.
  This is real: the Mutianyu section has one.

**Word of the place:** 🪁, "A kite!" then 风筝.
**Signs:** 长 long (长城, "the long wall") · 火 fire (at a beacon) · 门 door (at the
gate).
**Wear:** new `general`, an ancient **general's helmet** with a red tassel.
**Air:** `clouds` (existing). **Ground:** new `wallbrick` (grey brick with
crenellated edges).

**Things:**
- T1: 🧱 100, 🍂 44, 🌼 44, 🌰 30
- T2: 🪁 12 (run), 🚩 26 (banners), 🏮 16, 🧺 14, 🍎 18
- T3: 🛡️ 12 (old shields on the wall), 🪵 14, 🎒 10 (visitors' backpacks)
- T4: 🌲 14, 🪨 14, 🔴 3 (press: "gate")
- T5: 🚌 2 (the car park at the foot), 🏠 4, 🌳 6
- T6: ⛰️ 3 (the hills the wall runs over), 🚠 2 (the cable car up to the wall)
- Locks: 🚪 ×3 across the gate.

Finale 🥁 r ≥ 26 in the gate tower: "the giant drum".

## 3. The land

**🏮 Lantern Land** (land id `lantern`):
- backdrop `["#fff0c2", "#ffc94d"]` (gold), border colour `#d62828`;
- labels in the default navy.

It goes last in `LANDS`, with its places in the order of §2.

**Measured:**
- The navy label is **11.72 : 1 / 8.69 : 1** against the two backdrop ends, so it
  passes AA on both.
- The red 🏮 is **4.41 / 3.27 : 1**, so it stays visible (the 🕸️-vanished-on-its-
  own-door lesson, §19).
- A red backdrop would have put a red lantern on red.

**Home layout:**
- `hole-main.js` always lays the land doors out as TWO rows, so six lands become
  **three over three** with no code change.
- The bottom row narrows from two doors to three, which is the top row's width
  today. So each land label must still fit a three-across door. **It does not
  yet:** measured in a land door (not a place door: the land label is 1.15rem,
  18.4px, on every phone, with no narrow step-down), "Lantern" has **−7.3px** of
  room at 320 wide, 6.0 at 360 and 16.0 at 390. So batch A adds
  `@media (max-width: 359px) { .hole-land__label { font-size: 0.95rem; } }`,
  which leaves "Lantern" about 6.6px at 320; the shipped mobile law (≥ 3px of room
  for every land's longest word, at 320x568) is what proves it.
- Re-run the 75px law and the every-land-door-on-the-first-screen law at all 8
  phones and 6 iPads with insets. Measure; never assume.

**Land page:**
- **Batch A:** six places. The existing `.hole-scenes[data-n="6"]` rule puts a land
  of six three across on a tablet.
- **Batch B:** twelve places. A land of twelve is the standard page: four across
  on a tablet and three on a phone (which scrolls), exactly like the four
  original lands.

**Every place name was measured in its door** (DejaVu Sans, the 320px label size;
the rule is ≥ 3px of room for the longest word). The tightest word is "Dumpling"
at 8.1px, and "Snowflake" is spoken only.

## 4. Gobble speaks Chinese (the new plumbing)

All of it goes through `JoshAudio.say(text, { lang: "zh-CN" })`, the same path
华丽's world uses, gated by `playVisible()` like every Gobble line. It follows
the speech-TURN rules in `audio.js`: an English line and its Chinese partner said
in one turn are queued, not cut off.

1. **`finale.zh`**: the ready line adds the Chinese name after the English one:
   "Now eat the giant red envelope!" then 大红包.
2. **`word: { e, en, zh }`** per place: said the first time he eats that picture
   in a visit, English then Chinese. It counts as a tastes-style first-time line,
   so a taste word for the same gulp gives way to it.
3. **`greet: { en, zh }`** for the two festivals that have a happy greeting (New
   Year, Moon Garden). It is said once on arrival, after the tune.
4. **`count.lang: "zh"`**: the count says 一 … 十 instead of English numbers. Law:
   a Chinese count counts at most ten. (Batch B, with the Moon Garden.)
5. **`signs: [{ ch, word, x, y }]`**, a top-level field drawn in its own pass
   (not a decal: a decal kind no place draws as a decal fails the decals law):
   - **Drawing:** a round red plaque with one character on it, drawn in a
     **Simplified Chinese face named first** (PingFang SC, then Hiragino Sans GB,
     Noto Sans SC, Microsoft YaHei, sans-serif). Word Cards' lesson applies: an
     unnamed stack falls to a JAPANESE face, which draws different forms.
   - **Event:** the engine emits `sign` the first time his centre comes within
     reach. The page says it the way a Chinese speaker names a character,
     "<word>的<ch>" (长城的长, 快乐的乐, 奶奶的奶), then its English meaning. A
     bare syllable is never said: a voice reads a polyphone its commonest way,
     so bare 长 can come out zhǎng and bare 乐 yuè, and bare 奶 is heard as
     "milk". Where Word Cards voices a character through a one-reading stand-in
     (`XIN_SAY_AS` in `wordcards.html`: 长 → 常), the trailing character uses
     the same stand-in, read from that file, so the two worlds cannot disagree.
   - **Saving:** a sign is said once a visit. It never blocks movement, is never
     eaten, and is not saved.
6. **Rationing:** no more than one Chinese line every ~3s, apart from the finale
   pair and the count's numbers (which follow the shipped count rule, §2.7); a
   sign never talks over the ready line; muted means silent. Full Chinese was the
   choice (§9.3).

The spoken English meaning of a sign is the FIRST sense on its card, so the two
can never say different things. Example: 长 is "long", not "long (also zhǎng)",
and 奶 is "grandma", not "milk".

**The naming words** (each contains its sign; the test restates its pinyin):

| Place | Signs, as said |
|---|---|
| New Year Street | 红色的红 · 春天的春 · 快乐的乐 |
| Dumpling House | 吃饭的吃 · 饿了的饿 · 好香的香 |
| Hutong House | 回家的家 · 奶奶的奶 · 玩具的玩 |
| Panda Forest | 黑色的黑 · 白色的白 · 树叶的叶 |
| Tea Hills | 绿色的绿 · 高山的山 · 喝水的喝 |
| Water Town | 小河的河 · 上面的上 · 下面的下 |
| Moon Garden | 月亮的月 · 星星的星 · 金鱼的鱼 |
| Monkey Mountain | 花朵的花 · 水果的果 · 飞机的飞 |
| Writing Desk | 写字的写 · 汉字的字 · 大小的大 |
| Ice City | 下雪的雪 · 冬天的冬 · 好冷的冷 |
| Kung Fu School | 小手的手 · 跳舞的跳 · 快慢的快 |
| The Great Wall | 长城的长 (said 长城的常) · 大火的火 · 大门的门 |

The 新字 words come from the cards' own greeting words where one fits (饿了, 好香,
黑色, 树叶, 水果, 写字, 好冷, 大火); 长 takes 长城 rather than its card's 很长,
because the place IS 长城.

## 5. New art (the bill)

Reuse is preferred everywhere. The new pieces:

| Kind | Batch A (places 1-6) | Batch B (places 7-12) | Reused |
|---|---|---|---|
| Grounds | `street`, `bamboo` | `ricepaper`, `wallbrick` | `wood`, `brick`, `farm`, `stone`, `lawn`, `grass`, `snow` |
| Block looks | `stall`, `screen`, `bamboo` (+ sitting pandas) | `ink`, + monkeys sitting on `rock` | `wall`, `hedge`, `water`, `rock` |
| Portal / fly looks | | `moongate`, `waterfall`, `cloud` (a fly look) | |
| Wear | `tiger` (虎头帽), `pandaears`, `douli` (斗笠) | `rabbit`, `circlet`, `earflap`, `headband`, `general` | `chef`, `bobble`, `straw`, `cap` |
| Air | `paper` (red and gold firecracker scraps), `steam` | `skylanterns` (glows) | `leaves`, `clouds`, `petals`, `motes`, `snow`, `dust` |
| Decals | `tablecloth`, `couplets` (+ an upright 福; one 倒福 on a vat), `lanternstring` | `beacon` (unlit/lit), the scroll's rollers | `path`, `pond`, `soil`, … |
| Signs | the character plaque, its own pass over `def.signs` | | |
| Tastes | `slurp` (🍜 🍵 🥣: a sound, a first-time word AND a `TASTE_LOOK`, all three of which the tastes law requires); 🧨 → pop | 🥮 → sweet (only the Moon Garden serves 🥮, and the tastes law fails a picture no place serves) | |
| Finale deco | dragon prow + tail on 🛶 | | |

Every new wear declares its headroom; rabbit ears are tall. The crown replaces a
hat when he is ready for the finale (§12). **The `general` helmet's headroom must
stay ≤ today's tallest hat (`tophat`, `up(20,30)` 85.1)**, or the wear-headroom
browser test picks the Great Wall and asserts the crown at level 5, which in a
GIANT place is not the top size; either keep it under, or make that test read the
top size from the place's own levels.

## 6. Laws to add (RULE 7), each mutation-proven

1. **Chinese truth table:** every Chinese string Gobble says is restated in a test
   with its pinyin and meaning (the `hl-content.test.js` precedent):
   - **Greetings:** 新年快乐 · 中秋快乐.
   - **Finale names:** 大红包 · 茶壶 · 麻将牌 · 竹子 · 大茶杯 · 龙舟 · 月亮 · 仙桃 ·
     大毛笔 · 大雪花 · 大钟 · 大鼓.
   - **Words of the place:** 鞭炮 · 饺子 · 毛线 · 竹叶 · 茶叶 · 船 · 月饼 · 香蕉 · 书 ·
     冰 · 砖 · 风筝.
   - **Sign naming words:** the 36 in §4.
2. **Signs come from his cards:** every `signs[].ch` is in `wordcards.html`'s
   HANZI or XINZI, and the English Gobble says equals that card's first sense.
   The test reads both files, so two worlds cannot drift (the measure-word law's
   shape). **No sign is ever spoken bare:** every sign line is "<word>的<ch>",
   its `word` contains `ch`, and a `ch` that `XIN_SAY_AS` voices through a
   stand-in is voiced through the same one.
3. **The Chinese count is his 一..十:** a `count.lang: "zh"` place counts ≤ 10.
   Its numerals equal the first ten HANZI cards in order.
4. **Gobble agrees with 华丽's festival table** (`hl-content.js`):
   - **Same emoji:** each festival place's finale is her festival's own emoji —
     春节 🧧, 中秋 🌕, 端午 🛶.
   - **Same customs:** the place's `finale.zh` or its `word.zh` CONTAINS one of
     her items for that festival: 大红包 ⊃ 红包 (春节), 龙舟 = 龙舟 (端午), 月饼 =
     月饼 (中秋, the Moon Garden's word; its finale 月亮 is not one of her items).
   - **Scope:** lanterns as DECOR in the Moon Garden are not a claim. Her table
     puts 花灯 under 元宵, which is a quiz-design choice (bins never share a
     custom), not a statement that Mid-Autumn has no lanterns.
5. **The canvas Chinese face names an SC font first** (structural, the Word
   Cards law).
6. **Scenery animals stand where he cannot walk:**
   - every panda and monkey point has `walk > 0` (inside its block);
   - no scenery animal is ever an item. The alive law already scans items, and
     this law makes the scenery half explicit.
7. **The beacon decal follows its button** (pixel test: unlit before the press,
   lit after).
8. **The dragon prow follows the finale:** a pixel diff shows it present, and the
   finale's fall takes it along (it rides the finale's own transform).
9. **Every sign is its own and is reachable:**
   - no two places share a sign character (36 in all, so the land is 36 of his
     characters);
   - every sign stands on ground he can walk to.
10. **No spoken Chinese line contains a banned string.** A short list, checked
    as substrings over every Chinese string Gobble can say: 大麻 (cannabis, so a
    future "big X" finale cannot put 大 in front of 麻) and 大茶壶 (old Beijing
    slang for a brothel's tea boy, which is why the Dumpling House's finale is
    said 茶壶).
11. **A launch is said as what it looks like:** a `fly` portal with a look (a web,
    a cloud) is introduced and announced in its look's own words, never as a
    cannon. This generalises the §19 web-swing law from one look to every look.

These existing derived laws cover all twelve automatically. Expect them to fire,
which is what they are for:
- the tier law, the progress law, and bot win times (≥ 20s each, ≥ 30s mean);
- the 280-thing floor;
- one tier per picture;
- unique doors, names, finales and tunes;
- no reskin, and picture overlap ≤ 60%;
- ≤ Emoji 13.0 and VS16;
- every event heard; no dead field either way; first-time introductions on the
  smallest screen;
- every outline a closed ring; every gate shuts its gap;
- `HoleData.PRINTS` (twelve new prints; the test reports each value);
- the land laws, and every name inside its door with room to spare;
- the tastes law (every listed picture served by some place; every family with a
  sound, a word and a look).

## 7. Build order: two batches, each a whole land

A land must hold six places or twelve. So Lantern Land ships as **six** (batch A,
places 1-6) and grows to **twelve** (batch B, places 7-12), and every commit is a
complete, legal land. Each batch is **one commit**. A field can only ship with a
place that declares it, because the no-dead-field law fails a field the code reads
that no place declares. So the plumbing is split by which batch first uses it.
Back up WIP to the session branch after every step; the container can roll back
mid-session (§20, CLAUDE.md).

**Batch A: places 1-6, plus the speech plumbing.**

0. **Save the stuck-spot fuzzer as `tools/hole-fuzz.js`.**
   - **What it does:** a finger held anywhere, held on water and walls, and
     yanked about, plus the bot.
   - **Where it lived:** in §20 it was only in the audit agents' scratch space,
     so it is gone after a restart.
   - **Why first:** these places are full of exactly what grew stuck spots in
     §20 — fence ends (stalls, screens, bamboo, tea rows), house walls and
     bridges.
   - **What a new tool needs:** a SMOKE entry in `td-logic.test.js` (small args
     and a `must` regex a no-op cannot satisfy: every tool must have one), a line
     in CLAUDE.md's repo tree, and mode 755 in the git index.
1. **Plumbing:** `finale.zh`, `word`, `greet`, `signs` (the event, the drawing and
   the SC font). Laws 1, 2, 5, 9 and 10. Unit tests run against a fixture place.
2. **Data:** the six places in `hole-data.js` and Lantern Land in `LANDS`. Iterate
   with `node tools/hole-check.js newyear,dumplings,courtyard,…` until every place
   passes the tier and progress laws, the bot time, the twists and the overlap.
   Then run the fuzzer over all six.
3. **Art:** the batch A column of §5. Screenshot every place at 390 and 834 and in
   landscape, and look at it. A box measurement is not a picture (§19, the 🕸️
   door).
4. **Tests:**
   - laws 4 (春节, 端午), 6 (pandas) and 8;
   - browser tests: a real ride on a turntable, a sign spoken, a runaway ball of
     yarn, the dragon prow;
   - the home showing six lands, three over three, at every size with insets.
5. **The wandering-child model** (`tools/hole-child.js`): check the finale's call
   in all six.
6. **The plan-status law learns Gobble lands:** a `PLAN_GOBBLE_*.md` that
   backticks a land id present in `HoleData.LANDS` may not say NOT BUILT. Flip
   this Status line to **PARTLY BUILT (batch A)** in the same commit, or the
   extended law fires.
7. **Full gate**, ship, watch CI (test, deploy, verify-live), reset the session
   branch, add a §21 to PLAN_GOBBLE.md and the learnings to CLAUDE.md.

**Batch B: places 7-12.**

1. **Plumbing:** `count.lang`, the `moongate`, `waterfall` and `cloud` looks, the
   beacon decal, and law 3. Law 11 is generalised from the web swing.
2. **Data:** the six places, appended to Lantern Land in order. The Great Wall is
   GIANT, so size its world first.
3. **Art:** the batch B column of §5, screenshotted the same way.
4. **Tests:**
   - laws 4 (中秋), 6 (monkeys), 7 and 11;
   - browser tests: a real Chinese count, a cloud jump flown and said, the beacon
     quest opening the gate, the ice walls eaten through;
   - the land page at twelve (four across on a tablet), every name inside its
     door.
5. **The wandering-child model:** the Great Wall's button quest (a gated finale's
   KEY must come first, §15.1), the Kung Fu School's gate, and Monkey Mountain's
   cloud islands.
6. **Full gate**, ship, watch CI, reset the session branch, **flip this Status to
   BUILT**, and update §21 and CLAUDE.md. Check the `general` helmet against the
   wear-headroom test (§5).

**Size:** each batch is a bit more than one Hero Night (six places, one land, new
art, shipped in one session). Batch A adds the speech plumbing; batch B adds a
giant place and three new kinds of portal. If a batch must be split across
sessions, split it at step 1 → 2 with WIP on the session branch. Never ship part
of a batch: the land law forbids a land of nine.

## 8. What was checked while planning

Run 2026-10-15 for the first six and 2026-10-20 for all twelve.

- **Emoji:** all 114 pictures (doors, finales and things) were run against
  `site.test.js`'s Emoji-13.1+ ban ranges, its text-default (VS16) set and the
  alive ranges in `hole-logic.test.js`. Every one passes. These carry VS16:
  🌶️ ⛰️ ☂️ 🖌️ ❄️ ☃️ 🛡️ 🕯️ 🗂️ 🖼️ 🖥️ ✏️. 🐼, 🐉 and 🐒 are alive, so pandas,
  dragons and monkeys are scenery only (and the alive law checks doors too, so no
  door wears one).
- **Challenge sets:** `twistsOf` for all 54 existing places, compared with the
  twelve new sets: all 66 are distinct, and each new set is at least two
  mechanics from its nearest (table in §2).
- **Picture overlap:** the same measure as the §18 law (shared pictures over all
  pictures, Jaccard). Worst pair per new place:

  | New place | Worst pair | Shared |
  |---|---|---|
  | New Year Street | Hutong House | 39% |
  | Hutong House | New Year Street | 39% |
  | Panda Forest | Magic Forest | 36% |
  | Water Town | Moon Garden | 36% |
  | Moon Garden | Water Town | 36% |
  | Tea Hills | Panda Forest | 35% |
  | Monkey Mountain | Picnic Park | 31% |
  | The Great Wall | Moon Garden | 31% |
  | Dumpling House | Hutong House | 29% |
  | Kung Fu School | The Great Wall | 28% |
  | Ice City | Snow Day | 22% |
  | Writing Desk | Number Land | 9% |

  Every pair is under the 60% limit.
- **Uniqueness:**
  - **Finales:** 🧧 🫖 🀄 🎋 🍵 🛶 🌕 🍑 🖌️ ❄️ 🔔 🥁 — no existing place builds
    to any of them.
  - **Doors:** 🧨 🥟 🀄 🎋 🍃 🛶 🥮 🍑 🖌️ 🧊 🥋 🧱 — no existing place wears any of
    them.
  - **Names:** all twelve are new.
  - **Tiers:** inside each place, no picture is in two tiers, and no finale is
    also a thing.
- **Names in their doors:** measured in a real browser, in DejaVu Sans at the
  door's own size, at seven widths:

  | Word | Room at 320 wide | At 360 |
  |---|---|---|
  | Grandma's | 0.1px | −1.0px (overflows) |
  | Courtyard | 5.2px | |
  | Mountain | 9.3px | |
  | Dumpling | 8.1px | |
  | Hutong | 24.3px | |

  The rule is ≥ 3px, so "Grandma's" fails and "Hutong" replaces it (§2.3).
  **"Lantern" is a LAND door, which is a different box** (§3): −7.3px at 320
  until batch A steps the land label down below 360px.
- **His characters:** read from `wordcards.html`. All 36 signs are on his cards,
  none twice:
  - **中文 (26):** 红 春 乐 吃 家 奶 玩 白 绿 山 喝 河 上 下 月 星 鱼 花 飞 大 雪 冬
    手 跳 快 门;
  - **新字 (10):** 饿 香 黑 叶 果 写 字 冷 长 火.

  Each spoken English meaning is the card's first sense (e.g. 奶 "grandma",
  长 "long", 香 "smells good").
- **华丽's festival table** (`hl-content.js`) pairs 春节 🧧 (饺子 红包 春联),
  端午 🛶 (粽子 龙舟 艾草) and 中秋 🌕 (月饼 赏月 嫦娥). The finales' emoji are
  hers, and each place's finale name or word contains one of her items (law 4,
  in its "contains" form).
- **Thing counts:** summed the way `countOf` counts (every pop, shake and sprout
  kid included). Starting counts: New Year 377 · Dumplings 338 · Hutong 292 ·
  Pandas 306 · Tea Hills 292 · Water Town 295 · Moon Garden 298 · Monkey 294 ·
  Writing 297 · Ice City 292 · Kung Fu 294 · Great Wall 389 (the giants hold
  373-399). The first draft's lists left nine places short of the 280 floor.
- **Land-door contrast:** computed (§3).
- **Home layout:** confirmed in `hole-main.js` (two rows, columns from the
  row counts).
- **The plan-status law:** a "NOT BUILT" section inside `PLAN_GOBBLE.md` would
  read as the whole doc's verdict, so this plan is its own file.

## 9. Decisions (settled 2026-10-20)

The owner left these to this plan ("I defer to your highest quality
recommendations and judgement"), so each is decided:

1. **The land:** 🏮 **Lantern Land**.
   - **Why not 🐉 Dragon Land:** no dragon appears inside except the boat's prow,
     and a four-year-old would expect dragons.
   - **Why lanterns:** they appear in ten of the twelve places (every place but
     Panda Forest and Monkey Mountain).
2. **How many places:** **twelve**. The six recorded alternates were each
   reconsidered on their merits:
   - **Taken:**
     - Monkey Mountain (it was "Peach Mountain"; it has monkeys now);
     - Tea Hills;
     - the grandmother's courtyard (as Hutong House).
   - **New:** Writing Desk, Ice City and the Kung Fu School.
   - **Not taken:** see §10.
3. **How much Chinese:** **full**: the finale name, a word of the place, the
   festival greetings, the Chinese count and the character signs.
4. **The dragon prow on the Water Town finale:** **built**, so the boat reads as
   a dragon boat and the name "the dragon boat" stays true.
5. **The Great Wall:** **GIANT**, the land's last and biggest place.
6. **Shipping:** two batches of six, each a whole land, with places 1-6 never
   moving (§7).

## 10. Deliberately NOT in this plan

- **Eating any animal or person.** No pandas, monkeys, dragons, zodiac animals,
  rabbits or fish. The alive law forbids it, and pandas and monkeys appear only
  as scenery.
- **Anything from a film or show.** No Kung Fu Panda, no Mulan, no named
  character, and *Journey to the West*'s hero is never drawn or named. A web
  hero's world had the same rule (§19).
- **Japanese pictures used as Chinese:**
  - 🏯 (a Japanese castle);
  - ⛩️, 🎎, 🎏, 🎐, 🎍, 🎑 (moon viewing);
  - 🍡 🍙 🍢 🍥 🍘 🍱 🍣 🍶 (Japanese foods and sake). 🍡 looks like candied
    hawthorn on a stick (糖葫芦), the obvious Ice City treat, but it is dango, so
    it stays out.
  - the squared-ideograph emoji (🈶 🈚 🈷️ …), which carry Japanese sign meanings.

  This matters because the emoji's vendor art is part of correctness. **Two named
  exceptions**, each because nothing else exists at Emoji ≤13.0: 🎋 (a Tanabata
  tree, used as bamboo, as 华丽's world already does) and 🥋 (a karate gi, used as
  the Kung Fu School's door and a thing, but never said as 功夫).
- **Measure words in Gobble's lines.** "十!" then "Ten lanterns!", so nothing can
  contradict 华丽's 量词 game.
- **Tunes that are not public domain:**
  - Dumpling House: 两只老虎 (Frère Jacques);
  - Moon Garden: 茉莉花, the **Qing-era melody** as John Barrow transcribed it in
    1804 (the version Puccini quoted in *Turandot*), not 何仿's 1957 arrangement,
    which is the one most people sing today and is not clearly free;
  - the other ten: our own short pentatonic phrases (宫商角徵羽, C D E G A), each
    distinct, as the unique-tunes law requires.

  Nothing modern (e.g. 恭喜恭喜, 月亮代表我的心).
- **Places considered and not taken:**

  | Place | Why not |
  |---|---|
  | Bullet Train Station (高铁) | Modern China, and its set {flow:walkway, portals, ride, track:train} is legal. But it plays like the Airport and Train Town again. It is the first swap if the owner wants a modern place. |
  | The Forbidden City | Walls, a moat, gates and keys: the Castle again. |
  | A hot pot restaurant | A second meal, sharing Dumpling House's pictures. |
  | The zodiac race | Its twelve animals could only ever be scenery. |
  | A Peking opera stage | No mechanic that Music Land does not already have. |
  | Dunhuang's dunes | Desert Dunes' sand and slides. |
  | The Lantern Festival (元宵) | The Moon Garden's lanterns at night again, and its riddles (灯谜) need reading. |

## 11. The review (2026-10-21)

The twelve-place plan was reviewed by two independent passes, one against the
code and one against the culture. Every finding was checked directly before the
plan was changed, and all of them were fixed above:

- **Engine and layout:**
  - "Lantern" was measured in a place door; in a land door it overflows by 7.3px
    at 320 (§3). This was the only high-severity finding.
  - Nine places summed to less than the 280-thing floor (§8).
  - 🥮's sweet taste belonged to batch B, and `slurp` needs a `TASTE_LOOK` (§5).
  - The existing `confetti` takes no colour, so red-and-gold needs a new air (§2.1).
  - A `sign` decal would fail the decals law; signs get their own pass (§4).
  - The Moon Garden's bridge must enter from the far side for the 0.6 route law
    (§2.7).
  - The count's numbers must be exempt from the Chinese ration (§4).
  - Law 4 was false of the plan's own data as worded (§6).
  - A block look cannot be tinted per place (§2.5).
  - The plan-status law cannot see a Gobble land, so it is extended (§7).
  - A new tool needs a smoke scope, a tree line and mode 755 (§7).
  - The `general` helmet must not out-top today's tallest hat (§5).
- **Chinese and culture:**
  - 大茶壶 is old Beijing slang for a brothel's tea boy: said 茶壶 now, and banned.
  - Signs must never be spoken bare (长 zhǎng, 乐 yuè, 奶 "milk") (§4).
  - 🎋 is a Japanese Tanabata tree and 🥋 a karate gi: named exceptions, with the
    kung fu word moved to 砖 (§10, §2.11).
  - A 饺子馆 is not a 茶楼 (§2.2); the 桔/吉 pun is Cantonese (§2.1); 端午 was not
    "a day of mourning" (§2.6); a 四合院's street gate is not round-topped (§2.3);
    a main door's 福 is upright (§2.1); 🏮 is not a 冰灯 (§2.10); the familiar 茉莉花
    is a 1957 arrangement (§10); lanterns appear in ten places, not nine (§9).
  - 上 and 下 at the two ends of a bridge taught the pair backwards half the time;
    they are placed by height now (§2.6).

