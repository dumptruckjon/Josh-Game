# Authoring new Gobble Hole places (phase 5) — the brief every author follows

You are writing DATA for new places in Gobble Hole, a hole.io-style game for Josh, age 4, on an iPad
(iOS 14.2, portrait, a non-reader). He drags a hole ("Gobble") round a big world; small things fall
in, he grows, bigger things fit; at the top size he eats the place's FINALE, burps, and a vortex
slurps the rest. No fail states, no timers. Everything must be playable by a 4-year-old.

SP=/tmp/claude-0/-home-user-Josh-Game/881f4676-c717-5343-8764-48b71519bc4b/scratchpad/p5

## Do NOT edit any file in /home/user/Josh-Game. Write ONLY your own files:
`$SP/places/<id>.js` — one place per file: a single scene object literal followed by a comma, exactly
like one entry of the `SCENES` array in /home/user/Josh-Game/scripts/hole-data.js (indented 4
spaces, so it can be pasted straight in). It may use the helpers in scope there: T1..T6 (tier
sizes), ovalPts, capsulePts, spiralPts, arcPts, spokePts, r3. See `$SP/places/bath.keep.js` for a
finished, passing example (Bath Time).

## Check your places (as often as you like; it never touches the real tree)
    bash $SP/try.sh <your-author-name> $SP/places/<id1>.js $SP/places/<id2>.js ...
It splices your drafts into a private copy and prints:
1. `tools/hole-check.js` per place: things per tier, the bot's win time, the progress margins
   (x2.0 is the minimum allowed at every grow), the twists (challenge set) and any FAIL line.
2. The whole node engine suite. Failures that are EXPECTED while other authors' places are not yet
   in (ignore exactly these, and only while they name no id of yours):
   - "every field a place DECLARES is read … `def.count` …" (dead field) — unless one of YOUR
     places uses `count`, in which case that clause must stop naming `count`.
   - "every ITEM OPTION … `<option>` but no place uses it" — same rule for your options.
   - "every LOOK … no place has one — dead drawing code" — same rule for your looks.
   Any failure that names one of YOUR ids is yours to fix. Re-run until clean.
   Before you finish, run try.sh with ALL your files together once more.

## Read (economically — grep/sed the parts you need; the files are big)
- `$SP/BUILT.md` — the new mechanics and their exact data shapes (buttons, several keys, bumpers,
  piñatas `hits`, cannons `fly`, runaways `run`, turntables `spin`, power-ups, `sprout`, `count`,
  GIANT sixth tier). `$SP/DESIGN.md` — the table of all 24 new places (yours are named below).
- /home/user/Josh-Game/scripts/hole-data.js lines 160-215 (the format doc) and several existing
  scenes as models: `farm` (key/lock behind a fence gap), `castle` (key/lock, walls, water, bridges),
  `jungle` (tall world, bands, river flow), `pirate` (land with a `not` cut-out, bay track), `cloud`
  (slides on bridges), `themepark`, `music` (`at` formations, `chain`), `snow` (ice zones),
  `airport` (wide world). Their CROWD sizes are your guide.
- Tests in /home/user/Josh-Game/tests/hole-logic.test.js: the lab places near the end (search
  `withLab(lab(`) show working data for every new mechanic.
- Renderer tables in /home/user/Josh-Game/scripts/hole-render.js: `const DECALS` (decal kinds and
  their parameters — use ONLY existing kinds), `const WEAR`, `const AIR`, `const GROUNDS` (+ the
  phase-5 grounds), `const BLOCK_LOOKS`, `const BRIDGE_LOOKS`, SPIN_COLS, drawFlows/drawTracks/
  drawPortals look branches.

## The laws (the suite enforces every one)
- 5 tiers using T1..T5 (`{ r: T1, items: [...] }`), or 6 for a GIANT place (6th tier r: T6, finale
  r >= 26 — try 28; a giant world is bigger, e.g. world: [504, 706]). Finale `{ e, r: 20, at, say }`;
  `say` is its spoken name ("the bathtub") — never an emoji in a spoken line.
- World area >= 420x588 (246,960). start: [x, y] fractions; finale.at fractions inside the world.
- Your door emoji, name and finale emoji must be the ones in DESIGN.md (unique across all 48).
- Emoji must be Emoji 13.0 or older (Josh's iPad): NO 🫧 🪸 🛝 🛞 🛟 🫘 🪺 🫙 🪷 🫗 🩵 etc. A
  text-default emoji needs U+FE0F (write 🗝️ 🏔️ 🛳️ ☃️ 🏗️ 🛎️ 🕹️ 🏛️ ⛏️ 🏜️ 🏕️ 🗑️ 🗄️ ✏️ …).
- NOTHING ALIVE is eaten: no animals (🐟🐚🦆🐄…), no people/faces/hands/ghosts (👻), no spider web
  🕸️. Food, plants, toys, vehicles, buildings, objects are fine.
- Each picture belongs to ONE tier in a place (the surprises inside a pop/shake/hits too).
- Every zone an item names exists and is used; every track carries something; clumps are 2-5 and
  counts are whole clumps; trails are made of a PLAIN tier-1 bite (no zone/options); there must be
  plain tier-1 bites; at least one decal; a tune of 4-8 real notes (Hz 100-2000).
- TIER/PROGRESS/BOT laws: hole-check prints them. Keep every progress margin >= x2.0 and the bot's
  win between ~28s and ~55s (the suite needs >= 20s each and >= 30s mean over all places).
  Things: ~290-430 for a normal place (a giant ~420-560). Reference crowd: about
  140-160 / 70-95 / 45-65 / 22-34 / 14-18 (and ~8-12 in a giant's T6).
- GATES: a `lock` thing must SEAL its gap (only Gobble's centre meets a wall: the gap must be
  narrower than the lock thing's core, 0.9 * its r). Copy the farm/castle pattern. A lock needs
  its opener(s): `key: "<name>"` things and/or `press: "<name>"` buttons.
- NEVER STRANDED: a one-way cannon (`oneway: true, fly: true`) needs a way back (another cannon,
  a bridge, or walkable ground). hole-check FAILs "stranded" otherwise.
- NO RESKIN: your twists (printed by hole-check) must EQUAL the set in DESIGN.md for that place —
  the 48 sets were designed to be unique. If a law forces a change, keep it unique and say so.
- Portal ends must stand on ground. Riders need a `tracks` entry. `count.e` must be one of the
  place's tier items.

## Quality bar (this is a game a 4-year-old must love)
- It must READ as its theme at a glance: the right things, a clear SHAPE (use `land` shapes —
  not a plain rectangle unless the design says so), landmarks (decals), the finale on its own stage
  far from the start. Each place in DESIGN.md has a big idea — make that idea the heart of it.
- The new mechanic should be met early and be easy to understand (the game introduces it
  automatically the first time he comes near). Put buttons/keys/cannons where a child will find
  them; never hide an opener behind the thing it opens.
- Variety: different item counts, zones (districts), clumps, trails; not a uniform scatter.
- Keep the opening comfortable: the first gulp and grow are quick (starters: 3, trails out).

## Report back (your final answer)
For each place: id, file path, things per tier, bot time, the twists line, and a 1-line note of
anything odd. Plus any law you could not satisfy and why (do NOT silently weaken a design).
