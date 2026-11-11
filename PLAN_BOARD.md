# 🎲 Game Night — board games for Josh (and a friend)

**Status: BATCHES 1-6 BUILT, audited five times (§17 is the fifth); §18 is the improvement programme, in progress (part A built)** (batches 1-2
audited twice; §11 is batch 3: 💯 Hundred Hop, 🐔 Hen House, 🧺 Picnic Lotto,
and 👀 Twin Spot, the owner's Spot It ask; §12 is batch 4, games of SKILL:
🧠 Peek-a-Pair, 🚪 Shut the Doors, 🌰 Acorn Pots, 🁢 Dot Dominoes and
🏴‍☠️ Treasure Dig, all built; §13 is batch 5, games of STRATEGY: 🍪 Cookie
Jar, 🔴 Line Up, 🃏 Top Card, 🎨 Colour Grab and 🎲 Pick a Die, all built;
§14 is batch 6, ten more of varied types, all built: 🎯 Dice Match,
🐭 Mouse Maze, 🕵️ Who's Hiding, 🌈 Colour Match, 🔢 Number Bingo, ⛄ Snowman
Build, 🐟 Go Fish, 🍯 Honey Ten, 🔼 Higher or Lower and 🚂 Pattern Train) — the door, the shelf, the shared turn
routine, the engine, 🚀 Moon Race (with ☄️ Comet Moon), 🌈 Rainbow Trail, and
🍎 Apple Spin (the owner's go, 2026-10-28, with "deeply audit the first 2
games … to make them even more high quality and fun and exciting": §8).

The owner's pick (2026-10-28): "another new game, below Gobble Hole as its own
tile … a board game, or set of board games … for 2 players (but also 1 player vs
computer), works great in portrait, suitable for a 4 year old — games of luck,
with dice, such as Candyland or Chutes and Ladders". The owner then approved
every recommendation of the ranked plan (below) with "proceed and be careful".

## 1. How the options were chosen

Five independent brainstorms (the classic canon, preschool-designed games, the
learning value, digital-native portrait ideas, and a child-development skeptic)
produced 60 ideas; merged, 23 distinct games and 10 dropped. Three independent
judges (a Montessori child-development specialist, a kids' game designer and a
web engineer) scored all 23 on ten weighted criteria:

| # | Criterion | Weight |
|---|---|---|
| 1 | Learnable from one demo, no reading, no choices he cannot judge | ×3 |
| 2 | Frustration-safe without killing the drama | ×3 |
| 3 | Fun 2-player AND vs-computer on one shared device | ×3 |
| 4 | Learning: he DOES the skill | ×2 |
| 5 | Portrait / touch fit at 320px | ×2 |
| 6 | Delight | ×2 |
| 7 | Familiar to a grown-up | ×1 |
| 8 | 5-10 minute game | ×1 |
| 9 | Build cost and risk (a tie-breaker) | ×1 |
| 10 | Variety and replay | ×1 |

Top three, in the same order under the shipped weights, a fun-first weighting
and equal weights: **Moon Race** (Snakes & Ladders, 93%), **Apple Spin**
(Hi-Ho Cherry-O, 89%), **Rainbow Trail** (Candy Land, 87%). Dropped: Connect
Four (44px columns, a skill game), Ludo/Sorry (being sent home), Go Fish and
Uno (hidden hands cannot stay hidden on one screen), Monopoly Jr (reading,
money, bankruptcy), full Shut the Box / Mancala / Chinese checkers (skill, too
complex), Pig (losing your turn IS the game). "Candy Land", "Chutes and
Ladders" and "Hi-Ho Cherry-O" are trademarks: only the mechanics are borrowed,
under our own names and art.

## 2. The decisions (all approved)

1. Batch 1 = Moon Race + Rainbow Trail (one engine), then Apple Spin.
2. The front door goes two columns with Game Night as a wide door across the
   bottom — a fifth door in the old single column ran 42-134px off every phone,
   and shrunk to fit it was 69px tall on a 320x568 phone, under the 75px floor.
3. Named **Game Night 🎲**.
4. The computer is River, Raegar or Viraj, drawn inside a little tablet frame.
5. He taps each hop (a grown-up toggle makes hops automatic).
6. Comets (gentle slides) only from his third Moon game: the shelf shows
   ☄️ Comet Moon once two Moon Race games are finished.
7. Two kids race, and the first one home becomes the HELPER.
8. Josh starts against the computer; two kids take turns starting.
9. A game in progress stays on its box until the next day (24h).
10. Game Night is the current pick; Lantern Land batch B keeps waiting.

## 3. The shared turn routine (every box)

- Each player owns a big **pad** at the bottom (face, then the die or the card
  pile). Only the active pad acts; the other is dimmed and wiggles if tapped
  ("It's River's turn. You're next!"). Whose turn shows three ways at once:
  the bright, ringed pad, the dimmed other one, and the active token's halo.
- **Moon Race:** tap the pad → the die tumbles and lands showing DOTS → tap
  once per hop; each tap moves the rocket one square, a dot goes dark, the
  square's number pops up and is said ("12, 13, 14!" — counting on from the
  square, the research-backed form). Landing on a 🚀 booster blasts up; on a
  ☄️ comet slides down one row and earns a ⭐.
- **Rainbow Trail:** tap the pad → a colour card flips (a colour AND a shape,
  so it reads in any colour vision) → the next square of that colour pulses
  and the token glides there. Double cards go to the second one; a picture
  card zooms to its landmark — or, if the landmark is BEHIND you, slides you
  back to it, as in Candy Land (§10).
- The turn passes by itself. A computer turn is played visibly at a counting
  pace, so every computer turn is a worked example.

## 4. The no-lose rules (engine-enforced, test-pinned)

- Everyone finishes. No exact roll; overshoot is home. Nothing sends anyone
  back to start, and nobody is ever knocked home.
- A comet drops at most one row, never sits in the first row or the top row,
  never chains into another jump, and every ride earns a ⭐.
- Fair dice: each player draws from their own shuffled bag of 1-6. Fair cards:
  each player draws from their own balanced bag. No rubber-banding for anyone,
  the computer included.
- The first one home becomes the HELPER: they keep taking turns, and their
  moves bring the friend home. No comets once anyone is home.
- One identical party for both; no crown, no 1st/2nd. The words lose / lost /
  beat / winner / loser never appear in a line (a guardrail greps them).

## 5. Architecture (the Gobble pattern)

- `scripts/board-data.js` — boxes, boards (squares, jumps, colours) and every
  spoken line. Dual export.
- `scripts/board-logic.js` — the PURE seeded engine (no DOM, no Math.random):
  create / roll / hop / draw / snapshot / restore, fair bags, the helper rule.
  A node bot plays whole games.
- `scripts/board-render.js` — the board as one SVG (no ids, no defs) plus DOM
  tokens positioned over it.
- `scripts/board-main.js` — window.GameNight: the screens (#board-home shelf,
  #board-who, #board-play), the turn kit, the computer friend, onboarding,
  sound through JoshAudio, the josh-board-v1 save, window.__BOARD test hooks.
- Never registered in JoshFramework: Josh's Sticker Book stays 200.

## 6. Batch 2 — 🍎 Apple Spin (BUILT)

Spin, then tap once per apple into your own ten-frame basket; from game 3 a
silly bird carries one apple back (never two turns running, never from an
empty basket). Overshoot goes into a shared pie; the first full basket's
owner takes HELPER turns into the friend's basket; both baskets tip into one pie
that counts by tens. It is a collect game, not a race, and practises ten-frames
and take-away.

As built, the details the design left open:
- **The tap is on the pad**, as in Moon Race ("one tap, one apple"): the same
  routine learned once, and a 75px+ target. The tree is a picture, not a
  control.
- **The tree is big and never bare** — apples drop from it into the basket.
  So a spare apple has somewhere to come from, and the counting lives in the
  ten-frame, filled along the top row first, the way a ten-frame is counted.
- **The spinner is each player's own fair bag of 1, 1, 2, 2, 3, 4** (small
  numbers he sees at a glance; about five spins each). From his third Apple
  game a 🐦 joins the bag. The bird keeps the comets' rules: never on a
  player's two spins running, never from an empty basket, never once anyone's
  basket is full, never in a long game. A bird that may not come waits at the
  back of the bag, so the bag stays fair. A bird is the whole turn.
- **A full basket's spare apples go into the pie by themselves.** Ten is the
  climax ("Ten apples!"), so counting stops there.
- **The end:** "Ten, twenty! N apples in the pie! Yum!", and N pops over the
  pie.

## 7. Later (not planned yet)

Hundred Hop (1-100), Double Dice, skip-count dice, fork paths (a tiny choice),
a real-dice mode (roll a physical die, tap its face), reskins (dump trucks,
jungle, a web-hero city, a Valentine's board), a tablet-flat table mode.

## 8. The batch-1 audit (2026-10-28)

Played both games at phone and iPad sizes, and measured before changing
anything. Shipped:

- **The number pops on every hop**, over the square it names, and the
  basket's count on every apple. §3 promised it ("the square's number pops up
  and is said"), and it had never been built. With the sound OFF — the
  default — the voice says nothing, so the count has to be SEEN.
- **🌈 The square a card sends him to lights up** before the token sets off.
  §3 promised this too ("the next square of that colour pulses"). Now the
  match of card and square is seen.
- **A booster or comet ride is a RIDE.** The token grows and glows on the way
  and lands with its ⭐. Before, it moved like any other step.
- **The helper is visible.** Once a player is home, the friend's face sits on
  their pad, so with the sound off he can see whose token his tap now moves.
- **A tall phone gives the pads the spare room.** The square board is
  width-limited there, with ~140px free; the die, card and spinner grow
  64 → 84px and the board loses nothing.
- **Four boxes on the shelf stand two by two.** Four full-width rows put the
  last box below the fold of a 320x568 phone.

Measured and NOT done: **a taller 6x8 board** (48 squares, a longer game, and
it would fill the portrait space) drops the squares to 30px on a 320x568 phone
and 42px on 375x667, under the 38px floor. A board must be one fixed shape for
everyone, so it stays 6x6.

## 9. The second audit (2026-10-29): more fun, two bugs

The owner: "Audit the 3 games and look for opportunities to make the game more
fun and exciting for 4.5 year old Josh. Also make sure to fix any bugs and
extend test coverage wherever needed." All three games (four boxes) were played
at phone, small-phone, iPad and landscape sizes and screenshotted, and a stress
probe played 64 games with random taps on both pads, auto-hops on and off, and
leaving and coming back mid-move (none stuck, no page errors).

Bugs fixed:
- **A top-row square's number popped up over the bar.** The pop sits ABOVE the
  square it names; on the top row that is off the board, and on an iPad it sat
  on the 🏠 button. It pops below the square there now.
- **A 🌈 picture card crawled.** "Zoom!" walked the token one square per glide,
  so a card from square 2 to the castle took about eight seconds of nothing.

More fun (each one reads with the sound OFF, the default):
- **A picture card is a ZOOM**: one swoop, the token grown and glowing like a
  booster ride, and it earns a ⭐ (the engine's rule: a ride earns a star).
  Rainbow Trail now collects stars too, counted on the pad.
- **The friend cheers you on, visibly.** A ride, a zoom, home or a full basket,
  and the OTHER player's pad throws up a 🎉 and their face bounces. The
  computer's "Whoa, Josh!" was a voice line only.
- **The ⭐ lands when the token lands**: a pad's star count used to change the
  moment the dice decided the ride, giving the ending away.
- **🍎 The finale is built** (§6 promised it): both baskets tip into the pie,
  apple by apple, while it counts 10, 20, then the spares, then the party.
- **The spinner's wheel really spins** (it tilted and flashed apples) and a
  drawn **card flips over**. Both are still under reduced motion.
- **The party shows each player's ⭐ haul** under their dancing face (none for
  Apple Spin, whose haul is the pie, and none for a starless game).
- **Every finished game earns its box a 🏆** on the shelf, counted, in the
  box's corner (out of the flow, so the shelf is no taller).

Coverage added: a whole Rainbow Trail against the computer, a Comet Moon comet
slide, the zoom, the star landing, the cheer, the tip finale, the wheel and the
flip (both motion settings), the party haul, the shelf trophies, the top-row
pop; the mobile audit's party now carries a ⭐ row at every size.

Measured and NOT done: a landmark or rocket picture is covered while a token
stands on its square (the token sits toward the square's bottom right, clear
of the NUMBER, which is what he counts by). Moving every picture would trade
one cover for another, so it stays.

## 10. A picture card behind you sends you BACK (the owner, 2026-11)

"We noticed, at least on Rainbow Road, that you were too forgiving. If we pull
a picture card matching a space much earlier in the board, we expect the
player to actually go backwards, just like in Candyland." Built: a picture card
for a landmark behind you slides you all the way back to it in one swoop (like
a comet, no ⭐: it is not a ride), with "Dino land! Whoosh, back to Dino land!".
Two limits keep the no-lose rules: never once anyone is home (the helper is
moving the friend), and never after the game's first 24 cards, so every game
still ends in minutes. Measured over 3000 games: about 0.7 slides back a game;
median 18 turns (was 17), 95% within 30, the longest 42. At a 40-card cutoff
the longest ran 52, which is why it is 24. Outside those limits, and on the
picture's own square, a picture card is the old gentle move to the next square
of its colour.

## 11. Batch 3 — three more boxes (the owner, 2026-11-03)

"As soon as 100% done with the current work … you can move onto building the
next 3 board games." Chosen from §7's later list and the classics the first
ranking dropped for being hard to do well, each a DIFFERENT shape from the
four already on the shelf, each luck-only, each portrait-first and no-lose:

1. **💯 Hundred Hop (BUILT)** — a race down a real HUNDRED CHART (1 at the top
   left, reading like a book; the Montessori hundred board is MASTERED on his
   June 2026 report, and counting by tens with it). The die is 1, 2, 3 and three
   golden TEN-BARS: a ten is ONE tap that slides the token straight DOWN one
   row ("24 … 34! Ten more!"), the square below being ten more. A turn ending on
   a tens square (10, 20, … 90) earns a ⭐. Each bag of six adds 36, so a game is
   about 17 rolls each (median 35 turns in all, 108s at the shell's pace —
   which is why the game-length law now counts SECONDS: Hundred Hop has twice
   Moon Race's turns and FEWER taps). The starter gets home first 68% of the
   time (the law's band is 45-75%). Measured on the board itself: ten across is
   the phone's width, so a square is 35px on a 390 phone (37 on the owner's 402
   iPhone) with an 11px number, too small for a token BESIDE its number; the
   token is a RING round its whole square instead, the number showing inside
   it, the face in the square's bottom right quarter.
2. **🐔 Hen House (BUILT)** — co-op, the Count Your Chickens shape (a
   trademark; only the mechanic is borrowed): ONE shared hen walks the farm
   from the field to the hen house. Spin a cow, pig, sheep or dog, the square
   of the next one lights up, and every tap walks her one square and brings
   ONE chick home — the count he says is the chicks, shown on the hen house
   ("🐥 12"). From his third game a 🦊 joins the spinner with the bird's
   rules (never before a chick is home, never twice running, never in the
   last row, never in a long game): it sends one chick out to PLAY, never
   away, and every chick comes home with the hen, so every game ends with all
   35 home and one party for both. The animal path (34 squares) is a seeded
   search for no equal neighbours, no ABAB, 8-9 of each and every animal
   never more than 6 squares ahead; a game is about 14 spins (17 with the
   fox), about a minute at the shell's pace. The engine's spin() and hop()
   route a farm game to its own moves, so every generic sweep plays it.
3. **🧺 Picnic Lotto (BUILT)** — picture lotto: each player's picnic blanket
   shows six foods (the two never share one), drawn faintly as what to look
   for. He taps the basket on his pad, a food comes out onto it, and then he
   FINDS whose blanket it is on and taps that player's pad — his own or his
   friend's, the computer's too ("A banana! Whose is it?" … "A banana for
   River!"). That is the skill: a visual search across both blankets. A wrong
   friend only wiggles ("Look again!") and the food stays in hand; after two,
   its spot glows. The computer's turns are worked examples (it always knows).
   Twelve foods, twelve turns, both blankets fill, one picnic. The blankets
   stand side by side over the two pads that own them, in each player's
   colour — so the answer to "whose?" is also a place. The foods are pictures,
   not buttons: the only targets are the two pads, which is what keeps every
   tap ≥75px on a 320x568 phone (two blankets of tappable spots needed four
   rows of 75px there, about 150px more than the field has).

The shelf now stands two by two from four boxes, an ODD shelf's last box
spanning both columns; on a short phone each box is a smaller picture over a
one-line name (76px), so eight boxes still fit the first screen of a 320x568.

4. **👀 Twin Spot (BUILT; the owner, 2026-11-03: "Can we also do a 'spot it'
   style game?")** — the Spot It shape (a trademark; only the mechanic is
   borrowed): thirteen cards of four pictures, and ANY two share exactly ONE
   — the order-3 projective plane (13 points, 13 lines, 4 a line), proven
   pair by pair in the engine test. One card lies in the middle; on your turn
   you flip the next and find the one picture on both. The real game is a
   RACE, which a four-year-old's laws refuse (no timers, no speed), so here
   the players take TURNS: a wrong picture only wiggles ("Look again! Is it
   on both cards?"), after two the twin glows on BOTH cards, and found, it
   glows green on both, the card goes on your pile (a ⭐) and becomes the
   middle one. The computer's turns are worked examples. Twelve flips, one
   party. Measured on the field: a flipped card's four pictures are its
   buttons, so the cards lay out SIDE BY SIDE or STACKED, whichever gives the
   buttons more room — 130px on the owner's iPhone, 76px on a 320x568 (where
   only side by side clears 75), the middle card's pictures at half size.

## 12. Batch 4 — games of SKILL (the owner, 2026-11-04)

The ask: "5 more board games. Try to vary the type. Many of the games now are
too similar. At least some going forward need skill vs pure luck". Eight of
the nine boxes were a roll (or a spin, or a draw) and then the luck carried
the token, so batch 4 is five DIFFERENT shapes, each with a choice in it:
🧠 Peek-a-Pair (memory), 🌰 Acorn Pots (planned as "Seed Pots": a tiny
mancala, counting and planning),
🚪 Shut the Doors (number bonds: which doors make the roll), 🁢 Dot Dominoes
(matching dots, choosing which tile) and 🏴‍☠️ Treasure Dig (co-op: arrows
point toward the treasure, so each dig is reasoned, not guessed).

**The shelf became two shelves**, 🎲 Lucky games and 🧠 Thinking games, each
under its heading (a box's `kind: "think"`; luck is the default). Fourteen
boxes do not fit one phone screen, so the shelf now SCROLLS on a phone — the
law is that the first screen holds at least three full rows and the last box
can be scrolled to (Gobble Hole's land pages are the precedent). Picnic Lotto
and Twin Spot moved to the thinking shelf: finding whose food it is, and the
one picture on both cards, are searches, not luck.

1. **🧠 Peek-a-Pair (BUILT)** — Concentration. Nine cards face down, three
   by three: four PAIRS and one ⭐. Turn two over: a pair is yours (it glows,
   then leaves an empty place) and you GO AGAIN; not a pair, and both stay up
   for a moment ("Remember where they are!") then turn back over, and it is
   your friend's turn. The ⭐ is a free star and another go, whichever card
   it was. A cleared board deals a second, so a game is eight pairs (a minute
   or two). Memory is the one board game a four-year-old routinely beats a
   grown-up at, which is why it is first. **The computer forgets on
   purpose**: it remembers a card it has seen 60% of the time (its own
   seeded luck) and always prefers a card nobody has looked at, so it plays
   like a child. Measured over 1500 games each: the same memory as the
   computer finds about half the pairs, a sharp memory 73% — the skill is
   real, and the computer is no pushover. Nine and not twelve because three
   rows of 75px cards (16px apart) is what a 320x568 phone's field holds: on
   a short phone the pads give way (75px) and a card is a little wider than
   tall (85x75); 112px squares on the owner's iPhone.

2. **🚪 Shut the Doors (BUILT)** — shut-the-box for a four-year-old: a game
   of NUMBER BONDS. Each player has six doors, 1 to 6 (his big, three by two,
   in his colour; his friend's small above). Roll the die, then shut the door
   with that number, or TWO doors that make it (5 is 4 and 1, or 3 and 2):
   tap the first and it is held (a gold ring, "4… and what makes 5?"), tap
   its partner and both swing shut — two at once is a ⭐. A door that is not
   part of a way only wiggles ("That does not make 5. Try another!"), and
   after two a way glows green. When nothing fits, he ROLLS AGAIN: the first
   design passed the turn, and measured, 36-40% of all turns did nothing
   (the end game, one door left, waits for one number), so now every turn
   shuts a door and the fair bag brings every number within six rolls. First
   to shut all six helps the other (the helper rule), so it ends with every
   door shut and one party. The skill is measured: making two at once when
   he can wins the race to six 64% of the time against a computer that picks
   any way (51% at even play).
   **The owner, 2026-11-04: "Shut the Doors is confusing game."** Three
   causes, all fixed: a SHUT door was drawn as an empty grey hole, which reads
   as the door OPENING — now an open door is a lit doorway and a shut one is a
   closed wooden door; the roll was only dots on the pad far below the doors,
   in a different language from the doors' numerals — now every open door
   wears its own dots (the die's pattern) and a goal row right above the doors
   shows the roll's dots and number, or "4 + ? = 5" while a door is held; and
   the face above the doors was the OTHER player's, so his own doors looked
   like his friend's — it is now the face of whoever's doors they are (the
   friend's small strip is gone; their doors show on their own turn). The
   first game also teaches: a way to make the roll glows from the first roll,
   not only after two misses.
   The audit of all thirteen that followed (2026-11-04) found the same gap in
   the other two games with a RULE to learn, and gave them the same first
   game (one `TEACH` list in board-main.js): in his first 🁢 Dot Dominoes the
   tiles that match an open end glow on every turn of his, and in his first
   🌰 Acorn Pots the pot whose last acorn lands in his own nest glows. After
   that, dominoes glows only after two misses and acorns never (counting IS
   the skill). Twin Spot and Picnic Lotto were left alone: a glow from the
   start there would be the answer itself, and both already glow after two
   misses. The other eight run, draw and play cleanly at 402x874.

3. **🌰 Acorn Pots (BUILT)** — mancala for a four-year-old. Planned as "Seed
   Pots", renamed because the bean emoji is Emoji 14.0 and invisible on
   Josh's iPad: the seeds are ACORNS and each store is a squirrel's NEST
   (🐿️, with its owner's face). Each player has three pots of three acorns.
   Tap one of yours: its acorns drop one by one into the next pots round the
   ring — your own, your nest, your friend's pots, never your friend's nest —
   each pot popping its count, 1, 2, 3, so he can count with the sound off.
   The LAST acorn in your own nest is a ⭐ and you go again ("In your nest!
   Go again!"); anywhere else, the turn passes. When a side runs out, the
   acorns still in pots go home to their own nests, so every game ends with
   all eighteen in a nest and one party. No captures: nothing is ever taken
   from a friend. The skill is COUNTING how far each pot is from the nest
   (pot 0 with three acorns is the opening ⭐), measured over 1500 games:
   choosing the pot that reaches the nest takes 62% of the ⭐s against a
   computer that sees one only half the time, against 36% without counting.
   The board stands on its end between the two pads on a phone (his pots down
   the left into his nest at the bottom, his friend's up the right into
   theirs at the top: round the way the acorns go); a short phone puts the
   nests in a middle column, and a phone on its side lays it out as the
   classic board. Only his pots with acorns in them are buttons.

4. **🁢 Dot Dominoes (BUILT)** — fifteen tiles, every pair of 1 to 5 dots
   once (no blanks: he matches DOTS). One tile starts the line (never a
   double); each player holds four, face up, and six wait in the pile. Tap a
   tile whose dots match an open end: it goes on, turned to match. One that
   fits BOTH ends (leaving different dots) waits with a gold ring while both
   ends light up — "Which end?" — and he taps one: that choice is the skill.
   A tile that matches nothing only wiggles (after two, the ones that match
   glow). Nothing in his hand matches: his pad FISHES — the pile's top tile
   turns over; one that matches joins his hand, one that does not goes back
   under ("Not that one. Back it goes!"). He fishes only while a pile tile
   will match, so fishing always ends, and **a hand never grows past four**
   (the classic draw-until-it-fits measured hands of up to nine, which no
   phone could show as 75px tiles). Nothing to lay or fish: the friend goes
   on. A double is a ⭐ and so is laying your last tile; co-op, the line is
   finished when every tile is laid or none can be, one party. Two designs
   were MEASURED and rejected first: choosing the tile alone gave no edge at
   all (48% of the tiles either way), and only choosing the END too did —
   over 1500 games, keeping the tiles that match each other lays every tile
   86% of the time against 75%, and is out first 53% against 42%. No domino
   emoji is a picture on every phone, so the box, the pad and the tiles are
   drawn (SVG, the die's own dot patterns).

5. **🏴‍☠️ Treasure Dig (BUILT)** — co-op, a game of REASONING. A treasure is
   buried under one of nine sand squares (three by three). Take turns digging
   one; a square without it becomes a hole showing an ARROW toward the
   treasure (one of eight: ⬆️ ↗️ ➡️ ↘️ ⬇️ ↙️ ⬅️ ↖️, said aloud too: "Not here!
   The arrow points down and left!"), so the next dig is worked out, not
   guessed — and his friend's arrows count too. Whoever finds it gets the ⭐
   (a 💎, a cheer) and a new treasure is buried in fresh sand; four
   treasures, one party. The computer reads the arrows only half the time.
   Measured over 1500 games: digging only where every arrow still points
   finds 66% of the treasures, digging anywhere 26% — the biggest skill edge
   of the batch. Three by three (not four by four) because three 75px rows
   are what a 320x568 phone's field holds; on a short phone on its side the
   bar gives the sand 6px (the squares sit between its buttons, never under
   one).

**Batch 4 as a whole:** every game has a CHOICE in it and every choice is
measured against a computer that makes it half-well (memory 73% against an
even 50%; two doors at once 64% against 51%; counting acorns 62% of the ⭐s
against 36%; choosing the domino's end 86% laid against 75%; reading the
arrows 66% against 26%) — so a sharp four-year-old genuinely wins more, and
nobody ever loses.

## 13. Batch 5 — games of STRATEGY (the owner, 2026-11-04)

The ask: "More game night games that take skill and strategy". Batch 4 gave
every game a choice; batch 5 is the classic STRATEGY shapes, each one a
different one, each with a computer that plays it half-well and a measured
edge for playing it well, and each teaching its rule in his first game (the
`TEACH` glow: what a good player would do lights up, that game only).

**The constraint that shaped the list: three taps across.** The kid law is
75px targets 16px apart, and a 320px phone has about 288px of row: three
targets fit (3 x 75 + 2 x 16 = 257) and four do not (348). So the two 4x4
designs first drafted — a four-column connect-four and a 4x4 Reversi — were
measured out before a line was written: Line Up became three columns (each
one TALL button, so its height is free), and Reversi was replaced by a card
game whose taps are a hand of three.

1. **🍪 Cookie Jar (BUILT)** — Nim. A jar of cookies; take one, two or three;
   the LAST cookie is the golden one and a ⭐, and the next jar opens (four
   jars: 7, 9, 6, 10). Every cookie taken is on your plate, so both players
   eat plenty, and there is one party. The skill is leaving your friend a
   multiple of four. The jar shows its count on the lid and says what is
   left, the golden cookie sits at the bottom (the last one left). Measured
   over 1500 games: always leaving four takes 72% of the golden cookies
   against 38% taking any.

2. **🔴 Line Up (BUILT)** — connect three. Three columns, five high: tap a
   column and your counter (your own face, on your colour) drops to its
   bottom. Three of yours in a row — across, up or slanting — is a ⭐, every
   new line counts (one counter can make two), and lines glow gold. Two
   boards, one party. Five rows, not four: measured, 5.5 ⭐s a game against
   3.5, the same edge. Taking a line when there is one, and stopping the
   friend's when there is not, wins 58% of the ⭐s against 42% dropping
   anywhere. 3 x 5 is an odd number of cells, so who starts each board flips:
   the engine keeps who started the GAME, and every state's turn and counts
   follow from it (restore checks them exactly).

3. **🃏 Top Card (BUILT)** — a trick game. Each player has their own ten
   cards, 1 to 10, and holds three face up (a card is its numeral over a
   ten-frame of its dots). The leader plays one; the other answers; the
   bigger card wins the trick and a ⭐ (the same number: nobody's). Both fill
   back up to three, the lead goes to the other player, ten tricks, one party.
   The skill is the ANSWER: the smallest card that is bigger, or, when none
   is, the smallest of all — save the big ones. Measured: 55% of the tricks
   against 44%; what he LEADS barely matters (55-56% whatever the lead), so
   the first game lights only the answer. "Beat" is on the guardrail's list
   of words a four-year-old hears as losing, so it says "bigger than".

4. **🎨 Colour Grab (BUILT)** — the Filler shape. Two patches grow from
   opposite corners of a 6 x 7 grid of the five colours (each colour wears
   its shape, so it reads in any colour vision): pick a colour, and your
   patch turns that colour and swallows every touching square of it. Never
   your own colour or your friend's, so it is always a choice of three; a
   grab of four or more squares is a ⭐; every square grabbed, one party.
   Each patch is outlined in its player's colour with their face on its
   corner. Picking the colour that grabs the most wins 60% of the squares
   against 36% picking any.

5. **🎲 Pick a Die (BUILT)** — Moon Race with TWO dice. Roll both; two big
   dice cover the pads, and on the board the square each would reach lights
   up wearing that die's dots, so the button and its square are one picture.
   Pick one and hop it. Its own board has five rockets. Picking the die that
   lands on a rocket (or the bigger one) gets home first 70% of the time
   against 29%. The pick hides in the same tap, so a doubled tap finds
   nothing left to pick.

## 14. Batch 6 — ten more, of varied types (the owner, 2026-11-04)

The ask: "add 10 more games, varying types. High quality. E2E. Can be dice or
card or line or whatever. Then also loop the entire board game suite doing a
deep audit". Ten shapes the shelf does not have yet, each with a choice:

1. **🎯 Dice Match (BUILT)** — keep-or-roll, the Yahtzee shape at four. Three
   big dice and a big roll button: roll, tap the dice to KEEP (a gold ring and
   a ✋), roll the rest, twice. Two the same is a ⭐, three the same three ⭐s;
   five turns each. Each die is its own seeded luck, NOT the fair bag the other
   dice games use — measured, a bag of 1-6 deals three DIFFERENT faces every
   roll, so three dice could never match. Keeping the matching dice wins 59%
   of the stars against 42% keeping any.

2. **🐭 Mouse Maze (BUILT)** — direction cards. A 4 x 5 garden of plant pots,
   a mouse EACH and one cheese; each player holds three arrow cards (up,
   down, left or right, one step or two) and plays one to move their own
   mouse. Reaching the cheese is a ⭐ and new cheese appears about as far from
   both; five cheeses. Every hand holds an arrow that goes nearer the cheese
   (a hand without one is dealt again), and the cheese is never in a pocket
   with one way in. Measured: ONE shared mouse was built first — the friend's
   arrow undid his, a median 39 turns and only 51% for the skill — so it is a
   mouse each; then the cheese sat in one-way pockets for up to 175 turns.
   Now: picking the nearest arrow wins 65% of the cheese against 30%, in a
   median 19 turns.

3. **🕵️ Who's Hiding (BUILT)** — Guess Who at four. Eighteen hiders (dog,
   cat or bunny; red, blue or yellow; a 🎩 or not) and nine of them on the
   board; one is hiding. Each turn deals three question cards (an animal, a
   colour, the hat) and one asked turns down everyone it rules out. The BEST
   question is always among the three, so choosing well is the skill: it
   finds 61% of the hiders against 43% asking anything. Four rounds.
4. **🌈 Colour Match (BUILT)** — an UNO-lite. Forty cards of four colours and
   1-5; a hand of three, play one that matches the pile's colour OR number.
   Nothing fits: flip the deck's top card onto the pile and the turn passes
   (a hand never grows). Three rounds. It is RECOGNITION, not a choice of
   strategy, and is recorded as such.
5. **🔢 Number Bingo (BUILT)** — a 3 x 3 card each, roll the die and cover
   that number (its dots on the square); eight lines, a full card. Luck.
6. **⛄ Snowman Build (BUILT)** — roll the picture die and put that part on
   (a part needs the one below it first; ❄️ puts on the next part). Luck.
7. **🐟 Go Fish (BUILT)** — ten pictures, a hand of five face up. Ask for a
   picture you hold; a match is a pair, a ⭐ and another go, else Go fish from
   the pond. When the friend asks HIM he finds it in his hand, or taps 🎣
   (which joins his hand as one more card while he answers); a fib only
   wiggles. Asking for what the friend holds wins 61% of the pairs against 44%.
8. **🍯 Honey Ten (BUILT)** — nine flowers (1-9, each with its ten-frame); tap
   two that make exactly ten. A held flower lights the empty places of its
   ten-frame (how many more), and a ten is always on the meadow. Seeing the
   bond wins 61% of the tens against 27%.
9. **🔼 Higher or Lower (BUILT)** — a card face up: is the next one bigger or
   smaller? Twelve flips. Knowing the middle (guess "bigger" under 6) wins 54%
   against 43%.
10. **🚂 Pattern Train (BUILT)** — five carriages of a pattern (AB, AAB, ABB,
   ABC, AABB) and three carriages to choose the next from. Eight trains.
   **It REPLACED 🦉 Owl Flight**, planned as co-op colour cards: that is Rainbow
   Trail's mechanic again with no choice in it, while the shelf had no
   pattern game at all, and patterns are on his profile.

Measured lengths (median, at the shell's pace): Colour Match 61s, Bingo 87s,
Snowman 60s, Go Fish 44s, Honey Ten 52s, Higher or Lower 38s, Pattern Train
39s. Two shell lessons came with the batch. **A board drawn by its own game
must be repainted the moment a move hands the turn over** (`paintOwnBoard()`
in `playEvents`): Line Up kept his columns as buttons for a beat after his
drop, so a quick second tap played the FRIEND's counter — a generic browser
test now taps again in that instant in every such game. And **a fresh board is
not the whole layout**: the mobile audit opened every game fresh, which is the
roll or the first ask, so the card he covers, the hand he answers from and a
held flower had never been measured; on a 320x568 phone the bingo squares were
41px and touching and Go Fish overlapped and scrolled (the other hand's small
cards had inherited the 75px card floor). A MID-TURN audit now reaches each
such state through the engine at every size.


## 15. The third audit (the owner, 2026-11-05: "another deep audit. Different angles")

New angles: a random-tapping monkey (real taps and doubles, a phone turned,
🏠 and back, a reload) on every box; every computer turn reloaded between its
steps; junk moves into the engine; pad contents against their cards; a read
of every spoken line; real-pace waits; reduced motion; leaks.

- **Fixed — a game that stopped for good:** 🧺 Picnic Lotto, 👀 Twin Spot and
  🍯 Honey Ten froze if the computer's turn was interrupted between its steps
  (after it took its food, flipped its card, or held its first flower) by the
  iPad sleeping, 🏠 and back, or a reload. The computer now carries on the move
  it was in; a test loads every half-done computer turn of every box.
- **Fixed:** on a short phone, Colour Match's "🃏 3" ran out of its pad card
  and Mouse Maze's 🐭 did not fit it (now a corner badge, and a mouse sized
  from its card).
- **Fixed:** Colour Grab's first line said "every square of it it touches".
- **Measured, no change:** reduced motion hides every fade-out; no leaks (no
  timer outlives the screen, heap 5-6.5MB, slowest task 150ms on a 4x slowed CPU); the computer's
  turn takes 2.5-7s at real pace (Peek-a-Pair's 12-17s is it going again on its
  pairs, which he watches to remember); Colour Match has no strategy edge (50.7%
  careful against 49.9% random) and stays on the Thinking shelf, as Lotto and
  Spot do, because you must recognise what fits.

## 16. The fourth audit (the owner, 2026-11-05: "deep and broad … confusing for new players … quality, fun, playability")

Played as a new player: every box opened fresh (first-time hand and all) at
390x844 with the sound on and every spoken line captured, screenshots after
1, 3 and 6 of his taps, then each box's first tap, a help tap on his own pad,
and every row of cards checked for being centred.

- **Fixed — another game's words:** the line for a move under way was chosen
  by the PHASE alone, and phase names are shared. Rainbow Trail and Picnic
  Lotto opened every turn with Dominoes' "Nothing matches. Take one from the
  pile!", Colour Grab, Pattern Train and Honey Ten said Apple Spin's "Tap to
  pick! One tap, one apple.", and Acorn Pots said "Pick a die!". One
  `phaseLine()`, keyed by the game too, now owns the turn's line and 👂's. The
  same shared phase also ran Apple Spin's grown-up auto-pick (an endless timer)
  in those three games. The voice test now fails a line said in a game it does
  not belong to.
- **Fixed — tangled boards:** Comet Moon's comets swept across whole rows and
  crossed most of its rockets, and two of Moon Race's rockets crossed. Comets
  now drop straight down one row and the rockets climb the sides; no line
  crosses another (a test reads the drawn board), and every line ends on a
  landing pad so its two ends never look alike.
- **Fixed — a dead first tap:** Shut the Doors' doors are buttons from the
  start, and one tapped before rolling did nothing at all. Now the dice pad
  wiggles, the hand points at it, and it says "Roll the dice!". A test taps the
  first board button of every box and requires a response.
- **Fixed — a hand on a wrong answer:** with no glow earned, the help hand
  pointed at the FIRST choice, which can be wrong (Colour Match pointed at a
  card that did not match while the deck glowed). In the answer games it now
  points at the question (the train's "?", the number to find, "4 + ? = 10",
  the card to match, the fish asked for), or at 🎣 when he has none to give.
- **Fixed:** in Go Fish, a tap on his own pad while River asked HIM said "It's
  River's turn. You're next!"; it now says what to do and points.
- **Fixed:** a fished domino was cut in half (it sat in the line's tiny row).
- **Fixed:** Higher or Lower's deck wore 🔼, the "bigger" arrow; it is ❔ now.
- **Fixed:** a 5-card Go Fish hand was 4 cards and then 1 alone at the left,
  and a Colour Match hand of two sat at the left of three columns; both centre.
- **Measured, no change:** Snowman Build wastes about half its rolls (a part
  already on, or not yet), which is the Cootie shape; Apple Spin's trees never
  go bare (on purpose); every other box's first tap does something.

## 17. The fifth audit (the owner, 2026-11-10: "another deep and broad audit … confusing for new players … quality, fun, playability")

Method: every box PLAYED in a real browser by a tapper that taps like a new
player (the glow if there is one, else any live button), from a fresh save
(no "shown how" yet), sound on with every line captured; each box
screenshotted at its opening, after his first tap, on the computer's turn,
mid-game and at the party, laid out as contact sheets and looked at. Plus the
shelf and the who's-playing screens at 390 and 320, and six boxes in
two-person mode. No page error and no stuck game in any of the 28.

- **Fixed — the one move that is his on the other player's turn looked like
  waiting:** in Go Fish, when River asks HIM ("Do you have the turtle?"),
  River's pad was the lit one and his was dimmed and dashed — the picture of
  "wait your turn" — on the only move in any box he makes during the other
  player's turn. The one asked is now the one lit (also in two-person mode).
- **Fixed — "whose is it?" showed a basket:** in Picnic Lotto, while he holds
  a food, the other pad still showed 🧺 — read as "tap the basket again" on
  the very tap that means "it goes on River's blanket". That pad is the
  friend's blanket now (its gingham, in their colour).
- **Fixed — a hand of cards with no owner:** in Colour Match the hand row
  shows River's cards face up during River's turn, and with nothing on it they
  read as his own. The row wears its owner's face (top right: the top left is
  each card's number). Top Card's hand wears it too, for two people at one
  iPad.
- **Fixed — one picture, two meanings on the shelf:** 🚪 Shut the Doors stood
  under the bar's 🚪, which on that very shelf means "back to the front door".
  Its box is drawn now (three of its own doors), and a test fails any box that
  wears a bar control's picture.
- **Improved — the game he picked, as a picture:** the who's-playing and
  pick-a-friend screens named the game only in the bar's TEXT, which he cannot
  read. The box's picture now stands big over the choices.
- **Fixed — a red ❌ for a guess:** Higher or Lower stamped ❌ on a missed
  guess. A guess is luck and an estimate, not a wrong move, and a red cross is
  a scold (RULE 5); it is 😮 now, matching "Oh, not this time!". ❌ stays where
  it is an ANSWER (🕵️ "Is it red?" "No!").
- **Fixed — two lines:** a comet said "A star for you!" on River's ride too
  (it names the player now), and Twin Spot said "Yes! the lion!" (capital now).
- **Measured, no change:** every box's opening shows the first-time hand; the
  hundred chart's squares are small on a phone but the chart is width-limited
  and must stay ten across; a hop that lands on a tens square says its number
  and then "40! A star!", which counts rather than repeats.

## 18. Games that grow with him (the owner, 2026-11-11: "ALL. Go smartly and build and keep going")

After the fifth audit the owner asked for ways to improve all the games "as a
master kids games creator … for my 4.5 year old smart Josh … across many
different angles", and picked every idea on the list. The finding behind the
list: the games were sound, but they did not GROW with him (in every thinking
game the computer played at one fixed level for ever, and the three friends
played identically), no line ever named a clever move, and only about four of
the twenty-eight touched his working edges. The programme, in the order built:

**A. Friends who think (BUILT).**
- **Each friend in the iPad plays their own way.** River is careful (sees the
  clever move a little more often than the game's own level), Viraj steady
  (the game's own level), Raegar playful (a little less often). A word for the
  grown-up stands under each face on the pick-a-friend screen. So he picks his
  challenge by picking a face.
- **A box's friend learns from how its games go.** After a finished game
  against a friend in the iPad on a thinking box: he took most of the ⭐s (over
  60%), and that box's friend is one step sharper next time; the friend took
  most (he had under 45%), one step duller. Four steps each way at most, and
  never past the ends, so the sharpest friend still misses sometimes. All three
  friends move together, so they still differ. Simulated over 80 games a box: a
  weak player settles at 40-50% of the stars, a sharp one at 55-70%.
- **Only SKILL moves.** Every die, card, bag and spinner is the same fair luck
  as before (§4 stands), and the luck games read no level at all: a test plays
  every board at several levels and requires the luck boards to come out
  move-for-move the same. A game with no level set plays exactly as it did.
- **A clever move is NAMED.** In twelve games the engine says when a move was
  the clever one, and only when there was also a plain one to choose: leaving
  four cookies, following the arrows, stopping a line, the just-big-enough
  card (or saving the big ones), the biggest grab, the rocket die, the quick
  way to the cheese, the best question, asking for a fish the friend can be
  seen to hold, keeping the matching dice, remembering where a card was, and
  the guess more of the deck agrees with. A 💡 lights over the mover's own
  face every time (seen with the sound off); WHY is said the first time each
  player does it in a game ("Josh left 4. Clever!"). It names the THINKING,
  not the luck: a good guess in Higher or Lower is clever whether or not the
  card obliges. The friend's clever moves are named the same way, so the
  computer's turns explain themselves.
- **A missed clever move is never pointed out to a person.** Only a friend in
  the iPad says "Oops! Silly me!" of its OWN slip, once a game: how to take a
  mistake lightly, shown rather than told (his profile's frustration edge).

Still to build, in order: **B** his working edges (Skip Hop by 2s and 5s, "call
your landing", Bingo with two dice, take-away and adding said aloud); **C** a
choice in the luck games (Rainbow Trail's two cards, the Snowman's gift); **D**
level-two boxes for the thinking games; **E** the shell (tonight's three games,
pick your token, counting in Chinese, table mode, endings that change the board
and a high-five); **F** the remaining per-game ideas.

