# 🎲 Game Night — board games for Josh (and a friend)

**Status: BATCH 1 AND BATCH 2 BUILT, AUDITED TWICE** — the door, the shelf, the shared turn
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
  card zooms to its landmark.
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
