# Upgrades to EXISTING places (phase 5, §17.4) — "more fun, more interesting, more challenging"

Each upgrade gives an existing place ONE new thing to do, chosen to fit the place's own story. The
place keeps its id, name, door, finale, tune, ground, shape and character — this is an upgrade, not
a rewrite. Change the minimum needed (add items/options/blocks/portals), keep its crowd size, and
keep every law (see AUTHOR.md). Its twists must become EXACTLY the set below (each set is unique
among all 48 places).

How: copy the place's scene object out of /home/user/Josh-Game/scripts/hole-data.js into
`$SP/places/<id>.up.js` (the whole `{ … },` with its comment, 4-space indent), edit it there, and
check with `bash $SP/try.sh <author> $SP/places/<id>.up.js …` — a draft whose id already exists
REPLACES that place in the private copy (try.sh prints "replaced <id>"). Never edit the real file.

| id | the upgrade (what Josh gets) | twists after |
|---|---|---|
| castle | the castle door now needs THREE keys, hidden round the grounds ("1 of 3!") — a real quest | at block:wall block:water bridges key keys lock |
| maze | the fountain in the middle sits behind a gate; a big BUTTON somewhere in the maze opens it | bands block:hedge button lock |
| volcano | two CANNONS blast him over the lava river (and one back) — "Blast off!" | at block:lava bridges launch solid |
| party | PIÑATAS 🪅 that take three bumps and burst into sweets | hits pop |
| toyroom | a record player: a spinning RECORD turntable in the corner carries him round | ride spin track:train |
| circus | TRAMPOLINES / bouncy balls that go boing until he is big enough | bounce bridges portals ride track:orbit |
| candy | giant gumball BUMPERS that go boing | bands bounce |
| cave | big CRYSTALS that crack after bumps and drop gems | dark hits |
| snow | the curling stones 🥌 on the frozen lake slide AWAY from him — catch them | block:rock ice run |
| market | COUNT MODE: every apple he gulps says the next number ("Let's count the apples!") | block:shelf count ride track:line |
| sports | ⚡ ZOOM power-ups on the running track: "Zoom zoom!" | at chain power ride track:loop |
| picnic | a runaway football ⚽ that rolls away across the park | block:water bridges run shake |
| farm | SEEDS in the veggie patch sprout carrots as he passes | at block:fence key lock sprout |

Notes
- A changed layout drops a half-eaten run of THAT place only (the per-place layout fingerprint);
  its ⭐ is kept. That is fine.
- Put new mechanics where a child meets them early-ish and cannot miss them (the game introduces
  each the first time he comes near).
- castle: the existing key stays; add two more keys of the SAME name (e.g. glowing 🗝️) in different
  corners, never behind the door they open.
- volcano: a one-way cannon must have a way back (a second cannon, or the existing bridges).
- maze: the button must be reachable without passing the gate it opens; the gate must SEAL.
- market: `count: { e: "🍎", by: 1, say: "apples" }` — the counted emoji must be one of its items
  (add 🍎 if needed, plain, ~16-24 of them in one tier, maybe a trail of them).
- snow: give the 🥌 `{ run: true, zone: "lake" }`.
- Keep bot time ~28-55s and every progress margin >= x2.0.
