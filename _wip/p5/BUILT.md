# Phase 5 mechanics — ALREADY BUILT in the engine (use these exact data shapes)

All of these are implemented in scripts/hole-logic.js (uncommitted working tree), drawn in
scripts/hole-render.js, and proven by node tests at the end of tests/hole-logic.test.js
(section "phase 5 (§17)"). A place may use several. Item option = 3rd element of a tier item
`["emoji", count, { ...options }]`. RULES live in scripts/hole-data.js.

| twist atom | what the child sees | data shape |
|---|---|---|
| `keys`   | a gate that needs SEVERAL keys/buttons; each says "2 of 3" | more than one opener with the same name: e.g. `["🗝️", 3, { key: "gate" }]` (3 keys) and/or buttons; the lock: `["🚧", 2, { lock: "gate", at: {...} }]` |
| `button` | a big floor button (🔴 🔘 🟢 …) he ROLLS ONTO (never eats) to open its gate; a gold dashed wire runs from button to gate | `["🔴", 1, { press: "gate", at: { pts: [[x,y]] } }]` (a press thing is never food, never counted, stays in the floor) |
| `bounce` | a bumper (🍄 🎈 🛎️ ⚽ …): too big = a wall that knocks him back "boing"; big enough = food | `["🍄", 1, { bounce: true, at: {...} }]` usually tier 3-4 |
| `hits`   | a piñata (🪅 🎁 📦 …) that takes N bumps; each bump drops a share of its prizes; the last drops all | `["🪅", 1, { shake: [["🍬", 6, 1]], hits: 3 }]` (kids list = [emoji, count, tierIndex]) |
| `launch` | a CANNON: roll in, fly in an arc over walls/water, land on the target (one-way) | place field `portals: [{ a: [x,y], b: [x,y], oneway: true, fly: true }]` (coords are 0..1 fractions of the world) |
| `run`    | a RUNAWAY (🍩 ⚽ 🎈 🏀 🪀 …, never alive) that rolls away from him while he can eat it, tires, rests, stays inside its zone/leash; he corners it | `["⚽", 6, { run: true, zone: "pen" }]` (RULES.RUN: flee 26, speed 0.85, tire 2.2s, rest 1.6s, leash 70) |
| `spin`   | a TURNTABLE: a spinning floor (looks: turntable / record / pizza) that carries him round; he can always walk off; nothing stands on it | place field `flows: [{ spin: [cx, cy, radiusFrac], v: 24, look?: "record"|"pizza"|"turntable", cols?: [..] }]` |
| `power`  | a POWER-UP: 🧲 magnet = a super slurp for 4s; ⚡ zoom = he goes 1.6x faster for 5s | `["🧲", 1, { power: "magnet" }]`, `["⚡", 1, { power: "zoom" }]` |
| `sprout` | a SEEDLING (🌱) that sprouts its plants as he comes near | `["🌱", 2, { sprout: [["🌷", 3, 1]] }]` |
| `count`  | COUNT MODE: every gulp of one kind says the next number (by 1s, 2s, 5s, 10s), a tally shows on screen | place field `count: { e: "🧦", by: 2, say: "socks" }` (the counted emoji must be in the tiers) |
| `giant`  | a SIXTH tier: a bigger world and a mega finale | a 6th tiers entry with r in T6 [19.5, 21.0]; GROW_BITES[5] = 8; e.g. `world: [504, 706]`, finale r 28 |

Every new mechanic is INTRODUCED the first time: the engine emits `meet {kind}` when he first
comes near one (a voice line + a pointing finger 👇 + a ring). Nothing to author for that.

Existing (phase 4, still available): land shapes (rect, circle, oval, ring, path, polygon, `not` cut-outs),
`blocks` (water/lava/hedge/fence/shelf/wall/rock looks), `bridges`, `tracks` (riders/trains), `flows`
(river/belt/slide currents), `portals` (two-way or one-way), `ice`, `dark`, `notes` (Music Land),
bands/zones/clumps/trails/private districts, item options `ride`, `at` (formation: pts/line/ring/grid),
`solid`, `lock`/`key`, `pop` (a box that pops into its kids), `shake` (a tree that drops its kids),
`chain` (a row that topples), `glow`.

Laws every place must pass (tests enforce them): tier law (tier L+2 still too big), progress law
(every grow has twice its worth reachable round every wall still standing; the finale reachable),
bot law (the greedy bot wins every place, >= 20s each, mean >= 30s), NO-RESKIN law (no two places
share a set of challenges; no pair shares both ground mask IoU >= 0.9 and nearly its challenge),
gate seal law (every gate shuts its ground off), closed outlines, nothing alive, emoji <= 13.0,
unique door emoji / names / finales, a spoken finale `say`.
