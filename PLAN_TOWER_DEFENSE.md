# PLAN_TOWER_DEFENSE.md — "Fort Josh: Toybox Defense" (Jon's hidden world)

**A full tower-defense game for Jon (the dad), behind a name gate, living beside
Josh's 200 games and 华丽's 40.** This is the complete build-ready design: entry,
engine, towers, enemies, combat math, economy, all 12 levels, waves, bosses,
meta-progression, UI, audio, save format, test strategy, and phased build plan.
Written so a coding session can execute it phase by phase with no guessing.

---

## 0. Vision, quality bar, and HONEST scope

**Target feel:** the crisp, decision-rich core loop of premium mobile TD
(Kingdom Rush / Bloons class): handcrafted levels with distinct gimmicks,
rock-paper-scissors tower/enemy chemistry, branch upgrades that change play,
bosses with mechanics, 3 difficulties, stars → a meta upgrade tree, achievements,
and an endless mode. Playable offline, saved locally, 60fps on Josh's family
iPhone 17 Pro.

**Honest scope limits (what "rivaling" does and does not mean here):**
- Vanilla JS + one `<canvas>` + DOM HUD. No framework, no build step, no asset
  files — all art is programmatic (canvas shapes + the existing emoji/SVG
  vocabulary). This matches the repo's laws and keeps the PWA offline-complete.
- 12 handcrafted levels + endless, 4 tower lines × (3 tiers + 2 exclusive
  branches), ~14 enemy types + 3 bosses. That is a *tight, polished* TD, not a
  90-level content mill. Depth over bulk.
- No IAP, no ads, no cloud sync, no multiplayer, no WebGL. Single player, one
  device, localStorage.
- Balance numbers below are a **credible first pass** engineered around explicit
  DPS/cost curves; phase TD-6 is a dedicated tuning pass with the sim harness
  (auto-play thousands of runs) — expect ±20% adjustments there, that's normal.

**Relationship to the PROJECT RULES:** all six still bind (ship to `main`, full
suite green, tests for everything, live link in every reply, verify live).
RULE 5's *kid* design laws (no fail states, no timers, ≥75px) are **Josh-space
laws** and explicitly do not bind inside this gated adult world — precedent:
华丽's `data-adult` gate. Fort Josh has real difficulty, real defeat screens,
and real timers; the "Jon" gate is what keeps that away from Josh. Everything in
Josh's and 华丽's worlds is untouched (guardrail-locked: his book stays 200/200,
hers 40/40, resets unchanged).

---

## 1. Entry, gate, and shell

### 1.1 The door
- A third round top-bar button `#td-door`, icon **🏰**, `aria-label="Fort"`,
  sitting beside `#hl-door` (👵🏻) and the sound toggle. Same `.btn-round` chrome.
- Tapping it opens a name gate modal (same pattern/markup class family as
  `.hl-gate`, new class `.td-gate`, marked **`data-adult`** so the kid tap-size
  audit exempts it): prompt text **"Who goes there?"** with a text input and OK.
- **Only the exact answer `Jon` unlocks** — `input.trim().normalize("NFC") ===
  "Jon"`, case-sensitive (an adult types his own name; stricter = better gate).
  Everything else gets the same gentle shake/error as 华丽's gate, no hints.
- Success sets `sessionStorage["td-ok"] = "1"` (session-scoped like `hl-ok`)
  and navigates to `#td-home`.

### 1.2 Routes and guards
- Hash routes: `#td-home` (fort menu) and `#td-play` (the one game screen; the
  selected level/difficulty live in JS state + save, **not** in the hash).
- **Every** `td-*` route is guarded: without `td-ok`, `route()` bounces to
  Josh's home (stricter than 华丽, whose *game* screens stay deep-linkable for
  the harness — the TD e2e tests set `td-ok` themselves, so no unguarded
  screens are needed).
- `body.td-mode` class themes the shell (dark navy/star-field "night fort"
  palette; Josh's screens keep their gradients — the class flips on entry,
  off on exit, mirroring `hl-mode`).
- The in-fort Home button (🏠) returns to `#td-home`; from `#td-home` it exits
  to Josh's home (and removes `td-mode`).

### 1.3 Isolation invariants (guardrail-locked in site.test.js during TD-1)
- TD registers **nothing** in `JoshFramework`/`window.JoshGames` — no launcher
  tile, no Surprise, no sticker slot, invisible to the every-game harness and
  the kid mobile audit. (site.test asserts the Josh book still counts exactly
  200 and 华丽's 40.)
- All persistent TD state lives under `localStorage["jon-td-*"]` keys. The
  grown-ups "reset" (Josh's stars) and 华丽's world must not touch them; TD gets
  its own reset inside its settings screen ("Reset fort progress", long-press).
- Audio routes through the existing iOS-safe `JoshAudio.tone()` (RULE 7 law) and
  respects the global 🔇; the fort adds its own music/sfx toggles on top.

### 1.4 File plan (all flat in `scripts/`, matching repo convention)
| file | contents | est. size |
|---|---|---|
| `scripts/td-data.js` | ALL balance/content data: towers, enemies, waves, levels, meta tree, achievements. Dual-export (`window.TDData` + `module.exports`) so node tests read the same truth. | ~35 KB |
| `scripts/td-logic.js` | The pure, deterministic engine. **Zero DOM access.** Dual-export (`window.TDLogic` + `module.exports`). | ~30 KB |
| `scripts/td-render.js` | Canvas renderer + fx (reads engine state, never mutates). | ~20 KB |
| `scripts/td-ui.js` | Gate, fort menu, HUD, build/upgrade panels, overlays, settings, achievements UI. | ~25 KB |
| `scripts/td-main.js` | Glue: route hooks, save/load, game loop (rAF + fixed timestep), visibility pause, debug hooks. | ~10 KB |
| `styles/td.css` | All fort styling, `td-` prefixed. | ~12 KB |

Wire-up checklist (each is guardrail-checked already or in TD-1): add the five
scripts + css to `index.html` **with `?v=__BUILD__`**, to `sw.js` CORE, and to
`tests/site.test.js` SCRIPTS list.

---

## 2. Engine architecture (td-logic.js)

### 2.1 Determinism is the foundation (it IS the test strategy)
- **Fixed timestep:** logic ticks at exactly **30 Hz** (`DT = 1/30`). The
  renderer interpolates between the last two states for smooth 60fps; game
  speed ×2 just runs 2 ticks per frame. Headless tests run
  `while (!done) engine.tick()` with no rAF at all — thousands of ticks/sec.
- **Seeded RNG:** mulberry32. Seed = `hash(levelId, difficulty, runSeed)`;
  `runSeed` is rolled once per attempt and stored in the save. Every random
  draw (spawn jitter, crit, drift) goes through the engine's rng — **never**
  `Math.random()` — so a (levelDef, seed, input-script) triple replays to an
  identical end state. A unit test replays a scripted run and asserts the
  exact final state hash.
- **Serializable state:** `engine.state` is plain JSON data (no classes, no
  DOM, no functions) — that one object is the save format, the replay format,
  and the test-assertion format.

### 2.2 Public API (exact contract for ui/render/tests)
```js
const engine = TDLogic.createEngine(levelDef, {
  difficulty: "normal"|"casual"|"heroic",
  seed: 12345,
  meta: {…purchased star-tree node ids…},
});
engine.tick();                       // advance exactly 1/30s
engine.state;                        // { tick, gold, lives, waveIdx, phase:"build"|"wave"|"won"|"lost",
                                     //   countdown, enemies[], towers[], soldiers[], projectiles[], levers[] }
engine.events;                       // drained-by-renderer queue: {type:"hit"|"die"|"leak"|"shoot"|"build"|…, x,y,…}
engine.place(lineId, padId);         // → {ok, reason?}  costs gold
engine.upgrade(towerId);             // tier 1→2→3
engine.branch(towerId, "a"|"b");     // tier 3→4 exclusive choice
engine.sell(towerId);                // refunds per §5.4
engine.setTargeting(towerId, "first"|"last"|"strong"|"close");
engine.rally(campId, x, y);          // move soldiers, within rally range
engine.callWave();                   // early-call → bonus gold per §5.3
engine.pullLever(leverId);           // L10 mechanic
TDLogic.hashState(engine.state);     // stable stringify → 32-bit hash (tests)
```

### 2.3 Space, paths, movement
- Logical map = **24 × 14 grid cells**; 1 cell = 1 distance unit; speeds in
  cells/sec. Renderer maps cells → pixels (canvas fits width, letterboxes).
- A path = ordered waypoint list in cell coords; at load, expand to a sampled
  polyline with cumulative distance; an enemy's position is `(pathId, dist)` —
  movement is `dist += speed*DT*slowFactor`, trivially deterministic. Multiple
  paths per level (spawn→exit); fliers use their own straighter paths.
- Build pads are fixed cells (`pads: [{id,cx,cy}]`). Towers occupy pads 1:1.
- **Spatial queries:** enemies bucketed per tick into a coarse grid (2-cell
  buckets) for range lookups — O(1) per query, fine for ≤120 actives.

### 2.4 Entities (state shapes)
```js
enemy:  { id, type, pathId, dist, hp, shield, slowUntil, slowPct, brittleUntil,
          phasedUntil, buffs:{}, blockedBy:soldierId|0, alive }
tower:  { id, lineId, tier, branch:""|"a"|"b", padId, cx, cy, cooldown,
          targeting, spent }                    // spent → sell refund
soldier:{ id, campId, hp, x, y, engagedWith:enemyId|0, respawnAt }
proj:   { id, kind, x, y, tx, ty, targetId, speed, payload }
```
Bosses are enemies with `boss:true` + scripted `abilityAt` timers in their def.

### 2.5 Performance budget (iPhone 17 Pro is overkill, but budget anyway)
- Caps: ≤120 live enemies, ≤80 projectiles, ≤150 fx particles (renderer-side
  pool, oldest-recycled). All entity arrays use swap-remove; ids monotonic.
- One canvas, `dpr = min(devicePixelRatio, 2)`. HUD text (gold/lives/wave) is
  DOM, updated at 4 Hz, not per frame. No shadows/blur filters on hot paths.
- `visibilitychange` → hard pause (engine stops ticking; overlay shown).
- `touch-action: none` **on the canvas only**; page keeps `manipulation`.

---

## 3. Controls & UX (thumb-first, adult-sized: ≥44px targets)

- **Tap an empty pad** → radial build menu around it: 4 tower icons + price
  tags; unaffordable options dimmed. Tap-away cancels. (No drag anywhere.)
- **Tap a tower** → info panel (bottom sheet): stats, range ring shown on the
  field, buttons: Upgrade (price), the two branch cards at tier 3, Sell
  (refund), Targeting cycler `First→Last→Strong→Close`. Camps get a "Rally
  flag" mode: next tap on the field moves the flag (within range).
- **Wave bar** (top): current/total waves; the **NEXT wave's composition icons**
  during build phase; big `▶ CALL` button with the live early-call bonus
  ("+37g"). **Speed toggle 1×/2×** and **⏸ pause** buttons top-right.
- Pause overlay: Resume / Restart level / Settings / Quit to fort. Defeat
  overlay: silly-not-scary ("The toys got sleepy!") + Retry (same seed) /
  Retry (new seed) / Quit. Victory overlay: stars earned (animated), gold
  stats, kills, "perfect!" flag, Continue.
- Damage numbers OFF by default (toggle in settings); floating gold on kill
  always. Colorblind-safe: every enemy type differs in **shape**, not just
  color; slow = ice crystals overlay, brittle = crack overlay, shield = ring.
- Range preview also shown while choosing a build option (ghost ring).
- First-run tutorial = level 1's first two waves narrated with pointer hints
  ("Tap a pad", "Tap CALL early for bonus gold") — dismissible, never repeats
  (`jon-td-tut=1`).

---

## 4. Towers (4 lines × tiers 1-3 + exclusive tier-4 branches)

Damage types: **Bonk** (physical; reduced by armor) and **Zap** (energy;
ignores armor, absorbed by shields first). DPS/cost is the balance spine:
tier-1 ≈ 0.10 dps/gold single-target benchmarks, splash pays a ~35% premium,
utility (slow/block) is priced on effect, branches ≈ sidegrade power spikes.

### 4.1 🎯 Dart Blaster (single-target Bonk; anti-fast, anti-flier)
| tier | cost (total) | dmg | rate | range | DPS | notes |
|---|---|---|---|---|---|---|
| 1 Pea Shooter | 70 (70) | 6 | 0.80s | 2.6 | 7.5 | hits fliers |
| 2 Double Dart | 110 (180) | 13 | 0.75s | 2.8 | 17.3 | |
| 3 Foam Gatling | 160 (340) | 24 | 0.70s | 3.0 | 34.3 | |
| 4a **Sniper Scope** | 260 (600) | 85 | 2.2s | 5.5 | 38.6 | 15% crit ×2.5 (seeded); prioritizes Strong by default |
| 4b **Minigun** | 280 (620) | 9 | 0.12s | 2.2 | 75 | 1.2s spin-up after retarget (dps ramps 30→100%) |

### 4.2 🧱 Block Mortar (splash Bonk; can't target fliers; min range)
| tier | cost (total) | dmg | rate | range | splash | notes |
|---|---|---|---|---|---|---|
| 1 Block Lobber | 110 (110) | 16 | 3.2s | 1.5–3.6 | 1.4 | full dmg ≤0.5c, linear falloff to 25% at edge |
| 2 Brick Basher | 175 (285) | 34 | 3.0s | 1.5–3.8 | 1.5 | |
| 3 Crate Cannon | 240 (525) | 58 | 2.8s | 1.5–4.0 | 1.6 | |
| 4a **Big Bertha** | 320 (845) | 105 | 4.0s | 1.5–4.4 | 2.2 | screen-shake juice; wrecks squads |
| 4b **Sticky Bomb** | 300 (825) | 60 | 2.8s | 1.5–4.0 | 1.7 | dmg 46→60 (audit: was below Crate Cannon's 58 — a tier-3→4 downgrade); + goo: 40% slow 2.5s in splash (stacks-not: strongest slow wins) |

### 4.3 🧊 Freeze-Pop Fan (Zap + slow aura; the anti-armor/anti-shield answer)
| tier | cost (total) | aura slow (radius) | zap dps (range) | notes |
|---|---|---|---|---|
| 1 Cool Breeze | 100 (100) | 30% (1.8) | 6 (2.2) | aura ticks continuously; fliers take half slow |
| 2 Frost Fan | 160 (260) | 40% (2.1) | 11 (2.4) | |
| 3 Freezer Blast | 220 (480) | 50% (2.4) | 14 (2.6) | zap dps 4/8/12 → 6/11/14 (audit: the "anti-armor answer" zap was too weak to matter) |
| 4a **Blizzard Cone** | 300 (780) | 60% (2.6) | 16 (2.6) | zap 12→16 (stays above tier-3 after the re-tune); + **brittle**: enemies in aura take +20% ALL damage (3s linger) |
| 4b **Static Zap** | 320 (800) | 40% (2.4) | chain 30×4 / 1.1s | chain: 4 targets, −25% per jump, 1.5c jump range |

### 4.4 🪖 Army Guys Camp (path blockers; the tactical anchor)
Camps place beside the path; 3 soldiers hold a rally point ON the path.
A soldier engages 1 ground enemy (both stop; they trade melee); fliers and
`boss:true` ignore blocking. Respawn per-soldier 8s at camp, walk to rally.
| tier | cost (total) | soldiers | HP | dmg/rate | notes |
|---|---|---|---|---|---|
| 1 Army Guys | 90 (90) | 3 | 55 | 4 / 0.9s | rally range 2.5 |
| 2 Sarge Squad | 150 (240) | 3 | 85 | 8 / 0.9s | 25% armor |
| 3 Elite Platoon | 210 (450) | 3 | 120 | 13 / 0.85s | 25% armor |
| 4a **Dino Squad** | 300 (750) | 2 | 260 | 22 / 1.0s | big; each blocks 2 enemies |
| 4b **RC Racers** | 280 (730) | 4 | 70 | 9 / 0.7s | dmg 7→9 (audit: squad DPS 40→51.4 now beats Elite Platoon's 45.88 — was a hold downgrade); respawn 4s; 0.5s stun on first engage |

**Targeting default:** First (most-progressed). Mortars default Strong.
`First` stays STICKY — hold the leader until it dies or leaves range (no
thrash). `Strong`/`Last`/`Close` RE-EVALUATE every tick, so a stronger (or
newly-most-progressed / closer) enemy entering range is picked up immediately
(audit: the old code kept ALL modes sticky, which left strong/last/close inert).
Projectiles lead their target's predicted position (dist + speed×flightTime).

---

## 5. Combat math, economy, difficulty (the exact formulas)

### 5.1 Damage resolution (per hit, in order)
```
if Zap:  absorb = min(dmg, shield); shield -= absorb; dmg -= absorb
if Bonk: dmg *= (1 - armor)                    // armor ∈ {0, .25, .50}
if brittleActive: dmg *= 1.20
hp -= dmg  (floor 0; death → bounty, events, split-spawns if any)
```
Shields regen `regen/s` after 3s unhit. Slows: **strongest wins** (never
stack), cap 60%, fliers take half. All values integers after rounding half-up.

### 5.2 Lives & stars
- 20 lives ("stickers on the fort door"). Leak cost: normal 1, big 2, boss 5.
- Stars on victory: **18-20 lives = 3⭐, 10-17 = 2⭐, 1-9 = 1⭐.** Per level,
  best-ever stars count (difficulty doesn't multiply stars; Heroic instead
  awards a per-level 🎖 badge shown on the map). Max 36⭐ + 12🎖.

### 5.3 Waves & early-call
- Build phase countdown 20s between waves (45s before wave 1). `CALL` early →
  bonus gold = `ceil(secondsRemaining × 3)`. Wave N of a level has a data-
  defined composition (§7); spawns follow per-group `{type, count, gap, delay}`.
- Wave HP budget curve (used to author + to sanity-test): total effective HP
  of wave N ≈ `B × 1.18^N` where B is the level's base budget (§7 table). A
  unit test asserts every authored wave is within ±25% of its curve slot —
  typos in wave tables get caught mechanically.

### 5.4 Money
- Start gold per level in §7. Bounties in §6. Sell refund **80%** of total
  spent (Casual 90%). No interest mechanic (keeps decisions about towers, not
  banking). Victory pays nothing extra — stars are the reward.

### 5.5 Difficulty multipliers
| | enemy HP | enemy speed | bounty | start gold |
|---|---|---|---|---|
| Casual | ×0.80 | ×1.00 | ×1.10 | +50 |
| Normal | ×1.00 | ×1.00 | ×1.00 | — |
| Heroic | ×1.25 | ×1.08 | ×0.90 | −30 |

---

## 6. Enemy roster (Normal-difficulty stats)

| enemy | HP | speed | armor | shield(regen) | bounty | lives | ability |
|---|---|---|---|---|---|---|---|
| 🧦 Sock Goblin | 34 | 0.80 | — | — | 5 | 1 | the baseline |
| 🔵 Speedy Marble | 16 | 1.70 | — | — | 4 | 1 | tiny, swarms |
| 🟤 Mud Blob | 60 | 0.70 | — | — | 8 | 1 | splits on death → 2× Mudlet (22hp, 0.9, b3) |
| 🛡 Plastic Knight | 90 | 0.60 | 50% | — | 12 | 1 | armor wall |
| 🎈 Balloon Bug | 40 | 1.10 | — | — | 8 | 1 | **flier** |
| 🐂 Wind-up Bull | 120 | 0.55 | 25% | — | 14 | 1 | first hit → charge 1.6 speed for 1.5s (once per 5s) |
| 👻 Glitter Ghost | 55 | 0.90 | — | — | 11 | 1 | phases untargetable 1.5s every 4s (keeps walking) |
| 🤖 Battery Bot | 70 | 0.75 | — | 40 (8/s) | 13 | 1 | shield eats Zap |
| 🔧 Junk Healer | 85 | 0.65 | — | — | 15 | 1 | heals allies 15 hp/s, radius 1.2 (not self) |
| 🦫 Digger Mole | 65 | 0.80 | — | — | 12 | 1 | tunnels the middle ⅓ of the path (untargetable, unblockable underground) |
| 🪅 Piñata | 400 | 0.45 | 25% | — | 60 | 2 | +20g candy-burst on death |
| 🧱 Brick Legion | 28 ×8 | 0.90 | — | — | 4 ea | 1 | spawns as a tight 8-squad (0.3s gaps) — splash bait |
| 🪁 Kite Hawk | 30 | 2.00 | — | — | 7 | 1 | fast **flier** |
| 🛏 **BED MONSTER** (L4 boss) | 3200 | 0.28 | 25% | — | 200 | 5 | unblockable; every 6s stomp: 60 dmg to soldiers within 1.5c |
| 🌪 **VACUUM KING** (L8 boss) | 5200 | 0.30 | 25% | 60 (10/s) | 300 | 5 | every 8s sucks the nearest soldier (instant KO); brief 1.2× hustle at 50% |
| ⚡ **THE STATIC** (L12 boss) | 8000 | 0.32 | phase | phase | 500 | 5 | P1 (100-66%): 50% armor. P2 (66-33%): disables a random tower 4s every 7s. P3 (<33%): speed 0.60, spawns 2 Battery Bots every 10s |

Enemy art: canvas-drawn silly toys (distinct silhouettes, wobble-walk
animation, squash-and-stretch on hit, poof-of-stars death — nothing scary;
Josh might watch over a shoulder).

---

## 7. The 12 levels (3 worlds × 4) + Endless

> **Status:** ALL **12 levels across 3 worlds SHIPPED** (TD-4 done). Distinct
> paths/pads, a sim-verified rising curve, progressive unlock (beat N → N+1),
> Next-level button, and a fort-home level map with world tints + difficulty pips
> + a 👑 on each boss finale. **Full enemy roster:** World-1 (Mud Blob splits→
> Mudlet, Plastic Knight armor→Fan-zap, Wind-up Bull charges-on-hit, Junk Healer,
> Piñata gold-burst, Brick squads) **+ World-2/3 (Glitter Ghost phases
> untargetable, Battery Bot regenerating shield eats Zap, Digger Mole tunnels the
> middle third, Kite Hawk fast flier)**. **Three bosses:** Bed Monster (L4,
> unblockable stomp), Vacuum King (L8, sucks the nearest soldier + enrages under
> half hp), The Static (L12, hp-gated phases: 50% armor → jams a random gun →
> summons Battery Bots + dashes). **Three gimmicks:** night (−15% Dart/Mortar
> reach, Fan exempt; dark firefly floor), conveyor speed-strips (scrolling
> chevrons), mole tunnel. Every boss HP is sim-tuned to its level's pad geometry
> (The Static 8000, Vacuum King 5200), and L12 is proven winnable on **Heroic**.
> The ±25% budget audit (boss waves exempt) + the best-of-two auto-solver
> winnability test (all 12 levels × 3 seeds, ≥5 lives, losable by neglect) govern
> the shipped set. **DEFERRED (a later pass):** the design's dual/merge/fork
> multi-path layouts + the L10 lever — TD-4 ships each level as a distinct RICH
> SINGLE path instead (all sim-verifiable); true multi-path is its own subsystem.

Format per level: world/name, path shape (waypoints authored in `td-data.js`,
fine-tuned with the debug overlay §9.4), pad count, start gold, waves, base
budget B (§5.3), **signature gimmick**, and unlock. L1-L3 get fully explicit
wave tables here as the authoring exemplar; L4-L12 waves are authored in
`td-data.js` against their budget curve + composition notes below (the ±25%
budget test keeps them honest).

**World 1 — The Bedroom (L1-L4)**: wood-floor night palette.
**World 2 — The Backyard (L5-L8)**: grass/fence/sunset.
**World 3 — The Toy Store (L9-L12)**: shelves/neon.

| # | name | paths/pads | start g | waves | B | gimmick |
|---|---|---|---|---|---|---|
| 1 | Under the Bed | 1 gentle S / 8 pads | 220 | 8 | 170 | tutorial; Socks/Marbles/Knights/first Balloons |
| 2 | Closet Door | 2 spawns merge mid / 10 | 260 | 10 | 200 | split attention; Mud Blobs debut |
| 3 | Toy Shelf Run | 1 long U + flier shortcut over the gap / 10 | 280 | 11 | 230 | fliers cut the corner — Dart/Fan coverage matters; Bulls debut |
| 4 | **BED MONSTER** | 1 wide loop / 11 | 320 | 12 | 260 | boss; stomp punishes camp-stacking; Healers debut W8 |
| 5 | Sandbox Siege | 1 fork → 2 exits / 12 | 300 | 11 | 300 | two exits share pads mid-map; Moles debut (tunnel under the fork) |
| 6 | Firefly Night | 1 winding / 11 | 320 | 12 | 340 | night: all ranges −15% **except Fan**; Ghosts debut |
| 7 | The Slip'n'Slide | 1 with 3 conveyor strips (+60% enemy speed on them) / 12 | 340 | 13 | 390 | placement around conveyors; Kite Hawks debut |
| 8 | **VACUUM KING** | 2 parallel paths / 13 | 380 | 13 | 440 | boss; eats soldiers — RC respawn or tower-heavy answers |
| 9 | Aisle Nine | 2 parallel paths sharing a center pad column / 13 | 380 | 13 | 500 | center pads hit both lanes — premium real estate |
| 10 | The Train Set | 1 loop + **lever** switch track / 12 | 400 | 14 | 560 | tap the lever (8s cooldown) to send enemies the LONG way — active play |
| 11 | Checkout Chaos | 1 marathon zigzag / 14 | 360 | **15** | 620 | low-economy grinder; Piñatas are the economy release valve |
| 12 | **THE STATIC** | 3 spawns → 1 exit / 14 | 420 | 14 | 700 | finale boss + everything; P2 tower-disable punishes single-carry builds |

Unlocks: L1 open; L(n+1) opens on any-difficulty win of Ln. Endless unlocks
per-world after 3⭐ its 4 levels (Endless Bedroom / Backyard / Toy Store).

### 7.1 Level 1 exact waves (the authoring exemplar)
| W | composition (type ×count @gap s, +delay) | intent |
|---|---|---|
| 1 | Sock ×6 @1.2 | learn taps; 1 Dart clears |
| 2 | Sock ×8 @1.0 | afford 2nd tower |
| 3 | Sock ×6 @1.0; +3s Marble ×2 @0.8 | speed intro |
| 4 | Sock ×10 @0.9; +2s Marble ×4 @0.7 | pressure |
| 5 | Knight ×3 @2.0; Sock ×6 @1.0 | armor lesson → Fan or mass |
| 6 | Marble ×8 @0.6; +4s Knight ×4 @1.8 | both lessons |
| 7 | Sock ×12 @0.8; Marble ×6 @0.6; Knight ×2 @2; +6s Balloon ×2 @1.5 | flier reveal (Dart/Fan hit them) |
| 8 | Piñata ×1; +2s Sock ×10 @0.7; Marble ×6 @0.6 | mini-finale + payday |

### 7.2 Level 2 exact waves
| W | composition | notes |
|---|---|---|
| 1 | A: Sock ×5 @1.1 | single spawn first |
| 2 | A: Sock ×6; B: Sock ×4 (delay 3s) | second door opens (banner) |
| 3 | A: Marble ×6 @0.7; B: Sock ×6 | |
| 4 | A: Mud Blob ×3 @2.2; B: Marble ×4 | splitter lesson: splash shines |
| 5 | A: Knight ×3; B: Mud Blob ×2 | |
| 6 | A: Sock ×10 @0.8; B: Marble ×8 @0.6 | |
| 7 | A: Mud Blob ×4; B: Knight ×3; +5s Balloon ×3 | |
| 8 | A: Brick Legion ×1(=8); B: Sock ×8 | squad → mortar payoff |
| 9 | A: Knight ×5 @1.6; B: Mud Blob ×3; Balloon ×3 | |
| 10 | A+B: Piñata ×1 each; Marble ×10 @0.5; Knight ×3 | finale |

### 7.3 Level 3 exact waves
| W | composition | notes |
|---|---|---|
| 1 | Sock ×8 @1.0 | |
| 2 | Marble ×8 @0.6 | |
| 3 | Balloon ×4 @1.2 (flier path) | shortcut shown with dotted arc |
| 4 | Sock ×8; Knight ×3 | |
| 5 | Bull ×2 @3; Sock ×6 | charge telegraph lesson |
| 6 | Balloon ×5; Kite? no — Marble ×8 | air+ground split |
| 7 | Mud Blob ×4; Bull ×2 | |
| 8 | Brick Legion ×2; Balloon ×4 | |
| 9 | Knight ×5; Bull ×3 | armor wall |
| 10 | Balloon ×8 @0.9 | air wave — ground-only builds bleed here |
| 11 | Piñata ×1; Bull ×2; Sock ×12 @0.7; Balloon ×4 | finale |

### 7.4 Boss-wave scripts
Bosses arrive alone on their final wave with fanfare (2s klaxon + name
banner), then escorts spawn per script, e.g. **L4 W12:** Bed Monster; +10s
Sock ×8; +20s Healer ×2 + Knight ×4; +35s Marble ×10. Boss abilities run on
their §6 timers from spawn. Defeat = boss leaks (−5) usually fatal but not
scripted-fatal (a 19-life run survives, honest math).

### 7.5 Endless mode
Infinite generated waves against the world's enemy pool: wave N budget
`= 300 × 1.16^N`, composition drafted by seeded weighted pick (weights shift
armor→shield→swarm as N mod 3 cycles); every 5th wave = mini-boss (Piñata/
scaled Bull) and a **modifier draft**: pick 1 of 3 seeded cards ("+15% Dart
dmg" / "+50g now" / "soldiers +20% hp" …12 cards in data). Lives never refill.
Score = waves cleared; best per world saved/shown. It reuses the same engine —
only the wave-source differs (generator instead of table).

---

## 8. Meta-progression & achievements

> **Status: ✅ SHIPPED (TD-5).** All four systems live from the fort home's meta
> row (⭐ Star Tree · 🏅 Badges · ♾️ Endless) + a Resume banner. Star-tree buffs
> apply as pure `createEngine(opts.meta)` input; achievements toast + persist to
> `save.ach`; endless is a deterministic per-world generator (budget `300·1.16^n`,
> mini-boss every 5th, 3⭐-to-unlock, best-score saved); resume cold-restores a
> wave-boundary checkpoint. Node costs sum to **28⭐** of 36 possible (the doc's
> "30" was an arithmetic slip — the shipped tree uses the exact per-node costs
> below and pins the total in a guardrail).

### 8.1 Star tree (spend ⭐ in the fort; respec-able for free — friendly)
10 nodes, costs 2-4⭐ (total 28 of 36 possible):
`+40 start gold (2)` · `Dart +10% dmg (3)` · `Mortar +10% splash radius (3)` ·
`Fan aura +0.3 range (3)` · `Soldiers +15% hp (3)` · `+2 lives (4)` ·
`early-call bonus ×1.5 (2)` · `sell refund 90% (2)` · `+1 targeting option:
"Cheap" (2)` · `branch prices −10% (4)`.
Meta applies at `createEngine` (pure input — sim tests can cover any loadout).

### 8.2 Achievements (grid in the fort, toast on unlock; `jon-td-ach`)
`First Blood` (first kill) · `Doorman` (win L1) · `No Leaks` (any 20-life win) ·
`Pea Purist` (win L2 Dart-only) · `Ice Age` (freeze 50 at once… honest: cap
tracking at "20 slowed simultaneously") · `Boss Bonker` (L4) · `Dyson Denied`
(L8 losing ≤3 soldiers) · `Unplugged` (L12) · `Star Collector` (18⭐) ·
`Full Fort` (36⭐) · `Marathoner` (Endless wave 20) · `Heroic Heart` (any 🎖).

---

## 9. Renderer, audio, saves, debug

### 9.1 Renderer (td-render.js)
Layers per frame: static bg (offscreen canvas, drawn once per level) → path
ribbon → pads/levers → soldiers/enemies (y-sorted, wobble anim, hp pips when
damaged) → towers (recoil anim) → projectiles → fx pool (poofs, candy, crits)
→ range rings/ghosts. Interpolate positions between the two latest states.
Screen-shake (Bertha/boss) ≤4px, respects `prefers-reduced-motion`.

### 9.2 Audio (through `JoshAudio.tone` — the ONE iOS-safe path, RULE 7)
Event→cue map (all short synth motifs, mute-gated + fort sfx toggle):
build (rising 2-note) · upgrade (3-note) · sell (down-slide) · dart (tick) ·
mortar (thump + descending whistle) · zap (square blip) · freeze (noise-ish
low sine) · leak (soft sad 2-note — never harsh) · wave-call (drum roll of 4
tones) · victory (the existing winCue, it's family canon) · defeat (gentle
descending 3-note). Music: OFF default; a 8-note looping lullaby-march via
scheduled tones (setTimeout composer, celebration-only precedent) behind its
own toggle.

### 9.3 Save format (`jon-td-save-v1`, versioned, try/catch everywhere)
```js
{ v:1, stars:{ "1":3, … }, heroic:{ "4":true, … }, endlessBest:{bedroom:12,…},
  meta:["startgold","dartdmg",…], ach:["firstblood",…],
  settings:{sfx:true,music:false,dmgNumbers:false,speed:1},
  midRun: null | { levelId, difficulty, seed, waveIdx, gold, lives,
                   towers:[{lineId,tier,branch,padId,targeting}], tut:true } }
```
`midRun` writes at each build-phase start (wave boundary — honest checkpoint
granularity; mid-wave state is NOT saved), cleared on win/loss/quit-confirm.
Fort home shows "Resume L7 · wave 9/13" when present. Storage failures degrade
silently to session-only play (Safari private mode precedent).

### 9.4 Debug/test hooks (`window.__TD`) — the real-time test contract
Always present (harmless without calls): `__TD.engine` (live engine),
`__TD.newGame(levelId,{difficulty,seed,meta})`, `__TD.script(cmds)` (array of
`[tick, "place", "dart", padId]`-style commands executed deterministically),
`__TD.fastForward(untilPhase)` (ticks synchronously, renderer skipped),
`__TD.grantGold(n)` (marks state `cheated:true` → no stars/ach, honest),
`__TD.overlay()` (grid/waypoint/pad coordinate overlay for authoring maps).

---

## 10. Testing strategy (a real-time game can't use the tap-harness — here's its honest replacement)

1. **`tests/td-logic.test.js` (node, no browser — the bulk):**
   - determinism: scripted L1 run → exact `hashState` golden; same seed twice
     → identical; different seed → different.
   - combat math: armor/shield/brittle/slow-cap unit truths (§5.1 exact).
   - pathing: dist→(x,y) monotonic, exits fire leak with right life cost.
   - wave audit (generic): EVERY authored wave within ±25% of its budget
     curve; every enemy type referenced exists; every level's pad/waypoint
     coords inside the 24×14 grid; flier waves only on levels with flier paths.
   - **winnability sims:** per level, a scripted build (authored per level in
     the test, `__TD.script` format) beats Normal with ≥10 lives at 1000×
     headless speed. **Losability sim:** a do-nothing run LOSES L1 (fail
     states must actually work — this game is allowed to have them).
   - economy: total Normal bounty + start ≥ 1.15× the scripted build's spend
     (beatable without perfect play); sell-refund math exact.
   - save round-trip: save → load → `hashState` equal.
2. **`tests/td.test.js` (Playwright):** gate (wrong names rejected, `Jon`
   unlocks, guards bounce without `td-ok`); build/upgrade/sell/targeting flows
   by real taps on L1 (using `__TD.fastForward` between waves); pause/resume;
   speed toggle; a full L1 victory via `__TD.script` + fast-forward asserting
   the victory overlay + stars persisted; defeat overlay path; mobile-size
   pass: no horizontal overflow at 390/320, HUD controls ≥44px (`data-adult`
   space — the kid ≥75px audit explicitly does not apply, asserted as such);
   isolation: winning TD levels adds ZERO `josh-won-*` keys, Josh's reset
   leaves `jon-td-*` intact (both directions).
3. **Suite wiring:** both files auto-run under `npm test` (glob `tests/*`);
   site.test.js gains: new scripts in `index.html`+`sw.js`+cache-busted;
   `#td-door` exists `data-adult`; TD absent from `JoshGames`; Josh book still
   exactly 200. CI (incl. verify-live vs the deployed site) needs no changes —
   the TD e2e sets its own sessionStorage and uses `__TD` hooks, which exist
   in prod (that's the contract, like `data-correct` is today).

---

## 11. Build phases (each = full suite green → push → verify-live, per the RULES)

| phase | scope | exit gate |
|---|---|---|
| **TD-1 Shell+Engine ✅ BUILT** | door, gate, guards, td-mode theme, file/SW/site.test wiring, engine core (ticks, paths, spawn, Dart line, Sock/Marble, gold/lives/waves, win/lose), L1 rough, debug hooks, determinism+losability tests | ✅ L1 winnable by script in CI (16-17/20 lives across seeds); gate guardrails green |
| **TD-2 Towers ✅ BUILT** | all 4 lines, tiers, branches, targeting, soldiers/blocking/rally, sell/refund, build UX (menu, panels, ghosts) | ✅ mechanic micro-sims green (slows/splash/chain/blocking/crits/spin-up), L1 all-lines sim wins, branch/rally UI browser-tested |
| **TD-3 Enemies+World 1** | full W1 roster (blob/knight/balloon/bull/healer/piñata/legion), L1-L4 authored, Bed Monster, wave-budget audit test, tutorial | 4 winnability sims green |
| **TD-4 Worlds 2-3 ✅ SHIPPED** | ghosts/bots/moles/hawks, conveyors, night, mole-tunnel, L5-L12 (all 12), both bosses (Vacuum King/The Static), world tints + difficulty badges + boss crowns. *Deferred: dual/merge/fork paths + L10 lever → single rich paths ship now.* | 12 sims (Normal) all winnable/losable + L12 Heroic sim green ✓ |
| **TD-5 Meta ✅ SHIPPED** | 10-node star tree + free respec (pure input at createEngine), 12 achievements (jon-td-ach, toast), endless ×3 per world (deterministic generator, 3⭐-unlock, best-score save), resume/midRun (wave-boundary checkpoint, cold-restore) | engine sims (meta applies, endless escalates/deterministic/losable) + browser tests (buy/respec/persist, badges grid, endless start, resume restore) green |
| **TD-6 Polish (honest tuning pass)** | audio set, fx juice, perf audit on-device profile, difficulty re-tuning from batch sims (auto-play sweeps), CLAUDE.md docs + learnings | full suite + verify-live green; Jon plays L1-L12 on the real phone |

Est. ~130KB of new code across 6 shippable phases. Docs: CLAUDE.md gets a
"🏰 Jon's Fort" section (mirroring 华丽's) updated in TD-1 and finalized TD-6.

---

## 12. Explicit non-goals (so nobody "helpfully" adds them)
No IAP/currency-buying, no ads, no accounts/cloud, no PvP/co-op, no WebGL/
external engines, no asset downloads, no notifications, no difficulty that
deletes progress. And absolutely no leakage into Josh's or 华丽's spaces:
their registries, tests, stickers, resets, and rules stay byte-identical in
behavior — enforced by the isolation guardrails from TD-1 onward.
