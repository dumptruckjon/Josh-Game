// Fort Josh: Toybox Defense — ALL balance/content data (TD-2: the full arsenal).
// Dual-export: window.TDData in the browser + module.exports in node, so the
// unit tests assert the exact truth the game ships (the content.js law).
// Coordinates are 24×14 GRID CELLS (1 cell = 1 distance unit; speeds in
// cells/sec). See PLAN_TOWER_DEFENSE.md §4-§6 for the design these tables ship.

(function (global) {
  const GRID = { w: 24, h: 14 };
  const TICK_RATE = 30; // fixed-timestep logic Hz (determinism law)

  // ---- Difficulties (§5.5) — TD-1/2 ship normal; the table is the contract. ----
  const DIFFICULTIES = {
    casual: { hp: 0.8, speed: 1.0, bounty: 1.1, startGold: 50 },
    normal: { hp: 1.0, speed: 1.0, bounty: 1.0, startGold: 0 },
    // AUDIT 2026-07: heroic was a scattered CLIFF, not a slope — L7/L9/L10 were
    // unwinnable by a competent build while L8 was comfortable. Two knobs did
    // it: `speed` compounds with conveyor zones + fast fliers and steals tower
    // uptime (the one thing gold can't buy back), and the gold PENALTY amplified
    // the already-decisive opening. Now heroic is a pure hp/economy challenge:
    // tougher enemies that pay less, with a fair opening. Sim: every level
    // winnable (12/12, was 6/12) at avg 11.6 lives vs ~17 on normal.
    heroic: { hp: 1.30, speed: 1.0, bounty: 0.9, startGold: 40 },
    // RETIRED (owner, 2026-08): the 🧸 Kid Fort mode and its `noLose` contract.
    // It was never used, and a mode nothing can select is the dead-feature class
    // this project has already paid for twice (unreachable heroic; unreachable
    // World-4 levels), so the button, the difficulty and the engine's noLose
    // branch were removed together rather than leaving a selector-less tier.
    // EVERY shipped difficulty is now losable, with no exemption.
  };

  // ---- Global rules ----
  const RULES = {
    lives: 20,
    buildCountdownFirst: 45,
    buildCountdown: 20,
    earlyCallRate: 3,
    // How many waves may be walking at once. A CALL during a wave RUSHES the
    // next one on top of it — full early-call gold for real danger. Capped at 2
    // so it stays a tactical choice rather than a way to dump the whole level
    // (including a boss finale) onto wave 1.
    maxWavesInFlight: 2,
    rushSettle: 2,       // seconds a wave must be walking before it can be rushed (anti-fumble)
    // ⚙️ Toy Energy — the powers' real cost. A flat per-wave grant, because a
    // per-kill one cannot work: supply would scale with wave size (1.18^n) while
    // cooldown-limited demand scales only with wave duration, so uses/wave rises
    // monotonically at every rate. Flat is constant by construction.
    chargePerWave: 2,
    chargeMax: 3,        // a small bank, so skipping a wave's powers is worth something
    // ⚙️ THE EXCHANGE — the sink for late-game gold. A maxed board banks 2,770
    // spare on average (8,138 worst) because 21 of 36 levels run out of things
    // to buy ~2 waves before the end, so gold quietly stops being a resource.
    // Trading it for ⚙️ gives the surplus a use AND makes "bank for a branch or
    // buy a power now" a real decision — but the number bought is capped PER
    // WAVE so the per-wave energy budget stays flat, which is the property
    // Phase 3 established and which a per-kill grant provably cannot hold.
    chargeBuyMax: 1,     // extra ⚙️ purchasable per wave — the safety cap
    chargeBuyBase: 450,  // price of the first; doubles for each further one in a wave
    // P4: a run may EQUIP at most this many of the nodes you own, so the star
    // tree is an allocation decision every run instead of a purchase you make
    // once. Chosen by sweep (5 panel loadouts x 6 finales x 4 seeds, measured in
    // lives LOST — the honest metric, since Extra Hearts raises the starting
    // total): the whole 23-node tree drives five of six finales to zero lives
    // lost, while 6 slots of any single branch leaves four of six intact. See
    // the recorded NEGATIVE result in CLAUDE.md — a slot cap alone does NOT
    // rescue L8 and L16, because those two are boss-quantized and three
    // individual Firepower nodes each flip them on their own.
    metaSlots: 6,
    // P6: the ability strip CANNOT grow — the portrait rule is a hard
    // `repeat(4, minmax(0,1fr))` and a cloned 5th tile overlaps at 320px — so a
    // new power is a CHOICE, not a 5th button, exactly like metaSlots made the
    // star tree an allocation. It also gives 📣 Rally Horn (inert on a board
    // with no camp) something to lose to.
    abilitySlots: 4,
    sellRefund: 0.8,
    stars: [[18, 3], [10, 2], [1, 1]],
    slowCap: 0.6,        // slows never stack — strongest wins, capped (§5.1)
    flierSlowFactor: 0.5, // fliers take half slow
    brittleBonus: 1.2,   // brittle enemies take +20% of ALL damage
    soldierWalkSpeed: 2, // cells/sec to the rally point
    nightRangeMult: 0.85, // TD-4 night levels: −15% tower reach (Fan exempt)
    // TD-17: the track switch is a TIMED DIVERSION, not a permanent toggle.
    // Reported: "nobody would ever NOT choose the long path and just leave it" —
    // and that was true, because the long route is strictly better for the player
    // (more time under your guns) with no cost. Thrown once on wave 1, it was a
    // free upgrade you never touched again, which is the opposite of the active
    // decision the mechanic exists to create.
    //
    // Now: it holds the traffic long for `leverHold` seconds, snaps back to the
    // short route on its own, and only re-arms `leverCooldown` seconds after
    // that. Uptime is hold/(hold+cooldown), so the question stops being "is the
    // long way better?" (always yes) and becomes "WHICH part of this wave do I
    // spend it on?" — the fliers, the boss, or the cluster you can't otherwise
    // hold. Both are in GAME-TIME ticks, so 2×/3× fast-forward drains the timer
    // and marches the enemies at exactly the same rate (guardrail-tested).
    leverHold: 10,    // seconds the long route stays thrown before it snaps back
    leverCooldown: 10, // seconds AFTER it snaps back before it can be thrown again
    // 10/10 = 50% uptime, chosen by sweeping the thin-build sim on L23 (the
    // level whose whole strategy is the routing puzzle): a 9-pad board goes
    // 0/4 seeds without the lever to 4/4 with it, an 8-pad board to 3/4, and a
    // 7-pad board still loses. So the diversion is decisively worth using but no
    // longer SUBSTITUTES for building — at 63% uptime it was still near-free,
    // and at 42% the payoff got noisy. The campaign needs no re-tune: the
    // winnability oracle never pulls the lever, so every shipped number stands.
  };

  // ---- TD-9 ACTIVE ABILITIES: the in-WAVE layer ----
  // Every other decision in this game happens in the BUILD phase — once you hit
  // CALL you were a spectator, which is also why difficulty could only ever be
  // tuned at the opening (the front-loading finding). These are the mid-fight
  // lever. Two deliberate design rules:
  //   1. They cost GOLD, not just a cooldown. That makes an ability a real
  //      trade against a tower/upgrade rather than free power, so they can't
  //      quietly inflate the whole difficulty curve — and it lands the agency
  //      where the game had none (late waves, when gold is plentiful).
  //   2. They are fully deterministic: tick-stamped cooldowns, zero rng, so a
  //      headless sim can drive and prove every one of them.
  // Every power costs ⚙️ Toy Energy as well as gold. Gold prices stay where they
  // are on purpose: cutting them would be a 4-5x buff in the wrong direction and
  // would delete the last gold sink. Energy is what bites late, gold early.
  const ABILITIES = [
    // 🧨 also REVEALS: untargetability is the one thing a big blast has no answer
    // to, and a standalone 🔦 button would be dead on most levels (there is no
    // ability loadout, and the strip is full at four). As a rider it inherits a
    // real point-aim decision and needs no new UI.
    { id: "drop", short: "Blast", icon: "🧨", name: "Toy Box Drop", role: "big splash where you tap — and it flushes out hiders",
      gold: 130, cooldown: 25, kind: "point", radius: 2.4, dmg: 300, dmgType: "bonk",
      reveal: { radius: 2.4, seconds: 4 } },
    { id: "sticky", short: "Sticky", icon: "🍯", name: "Sticky Floor", role: "slows everything in the puddle",
      gold: 90, cooldown: 20, kind: "point", radius: 2.0, slow: 0.5, seconds: 8 },
    // ⚡ now has a CRASH. It was 100g for a straight ×2 with no downside, which
    // makes "use it whenever it is off cooldown" the only play. 6s x2.5 then 12s
    // x0.5 is 21 shot-seconds over an 18s window whose baseline is 18 — near
    // neutral in total, so all of the value is in WHEN you spend it.
    { id: "overclock", short: "Boost", icon: "⚡", name: "Overclock", role: "one tower fires 2.5x — then needs a rest",
      gold: 110, cooldown: 24, kind: "tower", mult: 2.5, seconds: 6, crashMult: 0.5, crashSeconds: 12 },
    { id: "horn", short: "Rally", icon: "📣", name: "Rally Horn", role: "every soldier back on their feet",
      gold: 80, cooldown: 30, kind: "instant" },
    // 📌 P6 — the first power that does something on EVERY board, which is the
    // measured hole in the set: neither oracle plan ever builds a camp, so
    // `abilityWouldDo` returns false for 📣 Rally Horn on every run the entire
    // suite makes, including the audit whose job is "spamming the powers must
    // not erase a finale". One of four powers was inert in every test.
    // It costs two ⚙️ — whole-board focus fire is the strongest thing in the
    // set, and energy (not gold) is what bites late.
    { id: "mark", short: "Focus", icon: "📌", name: "Call the Shot", role: "every gun aims at what you tap",
      gold: 70, cooldown: 24, charges: 2, kind: "point", radius: 1.4, mark: { seconds: 5 } },
  ];

  // ---- Towers (§4): 4 lines × tiers 1-3 + two exclusive tier-4 branches ----
  // dmgType "bonk" is reduced by armor; "zap" ignores armor, shields absorb it.
  const TOWERS = {
    dart: {
      name: "Dart Blaster", icon: "🎯", kind: "dart", role: "single-shot", hitsFliers: true,
      projectileSpeed: 9,
      tiers: [
        { name: "Pea Shooter", cost: 70, dmg: 6, dmgType: "bonk", rate: 0.8, range: 2.6 },
        { name: "Double Dart", cost: 110, dmg: 13, dmgType: "bonk", rate: 0.75, range: 2.8 },
        { name: "Foam Gatling", cost: 160, dmg: 24, dmgType: "bonk", rate: 0.7, range: 3.0 },
      ],
      branches: {
        a: { name: "Sniper Scope", role: "one big far shot — most of it is WASTED on small bodies", cost: 260, dmg: 85, dmgType: "bonk", rate: 2.2, range: 5.5, crit: 0.15, critMult: 2.5, defaultTargeting: "strong" },
        b: { name: "Minigun", role: "a fast close stream — shreds crowds, never overkills", cost: 280, dmg: 9, dmgType: "bonk", rate: 0.12, range: 2.2, spinUp: 1.2, heatFloor: 0.3 },
        // The Dart's third axis is SUPPORT, not more damage — the damage axis is
        // full (Sniper already one-shots 71% of the roster and loses levels for
        // it). Armour is the commonest trait in the game (14 of 51 bodies) and
        // nothing could remove it: you either brought the Fan, whose zap ignores
        // armour, or you out-damaged it. `strip` is read at the ONE place armour
        // is applied, so peeling it helps the mortar, the soldiers and the
        // abilities too — this gun's output is the debuff, not the hit.
        c: { name: "Rust Ray", role: "peels ARMOUR off — every other tower then hits harder", cost: 270, dmg: 14, dmgType: "bonk", rate: 0.5, range: 3.2, strip: { amount: 0.6, seconds: 3 } },
      },
    },
    mortar: {
      name: "Block Mortar", icon: "🧱", kind: "mortar", role: "splash", hitsFliers: false,
      shellSpeed: 5, defaultTargeting: "strong",
      tiers: [
        { name: "Block Lobber", cost: 110, dmg: 16, dmgType: "bonk", rate: 3.2, rangeMin: 1.5, range: 3.6, splash: 1.4 },
        { name: "Brick Basher", cost: 175, dmg: 34, dmgType: "bonk", rate: 3.0, rangeMin: 1.5, range: 3.8, splash: 1.5 },
        { name: "Crate Cannon", cost: 240, dmg: 58, dmgType: "bonk", rate: 2.8, rangeMin: 1.5, range: 4.0, splash: 1.6 },
      ],
      branches: {
        a: { name: "Big Bertha", role: "a huge, slow shell with a wider blast", cost: 320, dmg: 105, dmgType: "bonk", rate: 4.0, rangeMin: 1.5, range: 4.4, splash: 2.2 },
        b: { name: "Sticky Bomb", role: "same blast, and the goo it leaves slows whatever walks in", cost: 300, dmg: 60, dmgType: "bonk", rate: 2.8, rangeMin: 1.5, range: 4.0, splash: 1.7, goo: { slow: 0.4, seconds: 2.5 } }, // dmg 46→60: was a straight DPS DOWNGRADE from Crate Cannon (58); now it matches + adds goo
      },
    },
    fan: {
      name: "Freeze-Pop Fan", icon: "🧊", kind: "fan", role: "slows", hitsFliers: true,
      tiers: [
        { name: "Cool Breeze", cost: 100, slow: 0.3, auraRange: 1.8, zapDps: 6, zapRange: 2.2 },
        { name: "Frost Fan", cost: 160, slow: 0.4, auraRange: 2.1, zapDps: 11, zapRange: 2.4 },
        { name: "Freezer Blast", cost: 220, slow: 0.5, auraRange: 2.4, zapDps: 14, zapRange: 2.6 },
      ],
      branches: {
        a: { name: "Blizzard Cone", role: "colder aura, and chilled bodies take extra damage", cost: 300, slow: 0.6, auraRange: 2.6, zapDps: 16, zapRange: 2.6, brittle: 3 }, // zap 12→16: keeps it ABOVE tier-3 Freezer Blast (14) after the tier zap re-tune, so the upgrade never reads as a zap downgrade; brittle linger seconds
        b: { name: "Static Zap", role: "lightning that arcs to 4 nearby bodies (less slow)", cost: 320, slow: 0.4, auraRange: 2.4, chain: { dmg: 30, targets: 4, decay: 0.75, jump: 1.5, rate: 1.1 }, zapRange: 2.6 },
        // The Fan's third axis is the only one no tower has ever had: it points
        // at YOUR towers instead of at the enemy. `support` folds into boostOf
        // and reachOf — the sole readers of fire-rate and range — by
        // MULTIPLICATION, so it composes with ⚡ Overclock and a ⚡ power pad
        // instead of clobbering either. It barely fights; its whole output is
        // the neighbours, which makes it the one branch that rewards WIDE.
        //   `radius` is its OWN number, not the combat `auraRange`, and it is
        // SIZED TO THE MAPS rather than guessed: the median distance from a pad
        // to its nearest neighbour is 4.00 cells across all 36 levels, so at the
        // fan's own 2.4 aura a Tail Wind would have reached NOTHING on 21 of
        // them and been a 300-gold trap. At 4.5 no level is dead, while 25% of
        // pads still buff nobody — which is the point: WHERE you put it is the
        // decision. (5.0 drops that to 12% and makes placement free.)
        c: { name: "Tail Wind", role: "blows on your OWN towers — neighbours fire faster and further", cost: 300, slow: 0.2, auraRange: 2.4, zapDps: 4, zapRange: 2.4, support: { rate: 1.25, range: 1.15, radius: 4.5 } },
      },
    },
    camp: {
      name: "Army Guys Camp", icon: "🪖", kind: "camp", role: "blocks path", hitsFliers: false,
      // 3.05 is MEASURED, not chosen: pad-to-nearest-lane distance across all
      // 501 camp-able pads is p90 2.00 and max 3.000, so this is the smallest
      // value under which EVERY camp-able pad can post its wall on the road.
      // It reads as a widening from 2.5 and is really an alignment — the engine
      // has always posted soldiers up to 3.04 cells out by default (that is the
      // reach every level was tuned with), while the gate refused the player
      // the same reach, so a camp on 16 pads opened on a flag position it would
      // not let you choose again. No sim re-rallies by hand, so the only thing
      // that changes is what a MANUAL rally may reach.
      rallyRange: 3.05,
      tiers: [
        { name: "Army Guys", cost: 90, soldiers: 3, hp: 55, dmg: 4, rate: 0.9, armor: 0, respawn: 8 },
        { name: "Sarge Squad", cost: 150, soldiers: 3, hp: 85, dmg: 8, rate: 0.9, armor: 0.25, respawn: 8 },
        { name: "Elite Platoon", cost: 210, soldiers: 3, hp: 120, dmg: 13, rate: 0.85, armor: 0.25, respawn: 8 },
      ],
      branches: {
        a: { name: "Dino Squad", role: "two tough bodies, and each one blocks TWO", cost: 300, soldiers: 2, hp: 260, dmg: 22, rate: 1.0, armor: 0.25, respawn: 8, blocks: 2 },
        b: { name: "RC Racers", role: "four fragile racers that stun and respawn fast", cost: 280, soldiers: 4, hp: 70, dmg: 9, rate: 0.7, armor: 0, respawn: 4, stun: 0.5 }, // dmg 7→9: squad DPS 40→51.4 > Elite Platoon 45.88, so 4 fast stunning blockers is no longer a hold DOWNGRADE
      },
    },
  };

  // ---- Enemies. TD-2 slice (sock/marble/balloon) + TD-3 World-1 roster: a
  //      splitter (blob→mudlet), an armored knight (Fan/Zap answer), a charging
  //      bull, a healer, a gold-burst piñata, a squad brick, and the Bed Monster
  //      boss (unblockable, stomps soldiers). Each ability is a data field the
  //      engine reads (split/charge/heal/goldBurst/stomp/boss) + guardrail-tested. ----
  const ENEMIES = {
    sock: { name: "Sock Goblin", icon: "🧦", hp: 34, speed: 0.8, armor: 0, shield: 0, shieldRegen: 0, bounty: 5, lives: 1, flier: false, meleeDmg: 5, meleeRate: 0.9 },
    marble: { name: "Speedy Marble", icon: "🔵", hp: 16, speed: 1.7, armor: 0, shield: 0, shieldRegen: 0, bounty: 4, lives: 1, flier: false, meleeDmg: 3, meleeRate: 0.8 },
    balloon: { name: "Balloon Bug", icon: "🎈", hp: 40, speed: 1.1, armor: 0, shield: 0, shieldRegen: 0, bounty: 8, lives: 1, flier: true, meleeDmg: 0, meleeRate: 1 },
    // ---- TD-3: World-1 roster ----
    blob: { name: "Mud Blob", icon: "🟤", hp: 60, speed: 0.7, armor: 0, shield: 0, shieldRegen: 0, bounty: 8, lives: 1, flier: false, meleeDmg: 4, meleeRate: 1.0, split: { into: "mudlet", count: 2 } },
    mudlet: { name: "Mudlet", icon: "🟤", hp: 22, speed: 0.9, armor: 0, shield: 0, shieldRegen: 0, bounty: 3, lives: 1, flier: false, meleeDmg: 2, meleeRate: 0.9 },
    knight: { name: "Plastic Knight", icon: "🛡️", hp: 90, speed: 0.6, armor: 0.5, shield: 0, shieldRegen: 0, bounty: 12, lives: 1, flier: false, meleeDmg: 6, meleeRate: 0.9 }, // 50% armor → Fan zap (armor-ignoring) is the answer
    bull: { name: "Wind-up Bull", icon: "🐂", hp: 120, speed: 0.55, armor: 0.25, shield: 0, shieldRegen: 0, bounty: 14, lives: 1, flier: false, meleeDmg: 7, meleeRate: 0.9, charge: { speed: 1.6, seconds: 1.5, cooldown: 5 } }, // gets hit → charges
    healer: { name: "Junk Healer", icon: "🔧", hp: 85, speed: 0.65, armor: 0, shield: 0, shieldRegen: 0, bounty: 15, lives: 1, flier: false, meleeDmg: 4, meleeRate: 1.0, heal: { hps: 15, radius: 1.2 } }, // mends nearby allies — kill it first
    pinata: { name: "Piñata", icon: "🪅", hp: 400, speed: 0.45, armor: 0.25, shield: 0, shieldRegen: 0, bounty: 60, lives: 2, flier: false, meleeDmg: 8, meleeRate: 1.0, goldBurst: 20 }, // the economy release valve
    brick: { name: "Brick", icon: "🧱", hp: 28, speed: 0.9, armor: 0, shield: 0, shieldRegen: 0, bounty: 4, lives: 1, flier: false, meleeDmg: 3, meleeRate: 0.9 }, // authored in tight 8-squads → splash bait
    // ---- TD-3: World-1 boss ----
    bedmonster: { name: "Bed Monster", icon: "🛏️", hp: 2400, speed: 0.28, armor: 0.25, shield: 0, shieldRegen: 0, bounty: 200, lives: 6, size: 3.0, flier: false, boss: true, meleeDmg: 0, meleeRate: 1, stomp: { dmg: 60, radius: 1.5, seconds: 6 } }, // hp 3200→2400: tuned to THIS L4's 10-pad geometry (plan's 3200 assumed its own boss arena) so a wave-9 build kills it with margin; unblockable; stomps soldiers
    // ---- TD-4: Worlds 2-3 roster. Each ability is a data field the engine reads
    //      (phase/tunnel via isHidden, shieldRegen, flier) + guardrail-tested. ----
    ghost: { name: "Glitter Ghost", icon: "👻", hp: 55, speed: 0.9, armor: 0, shield: 0, shieldRegen: 0, bounty: 11, lives: 1, flier: false, meleeDmg: 4, meleeRate: 1.0, phase: { every: 4, on: 1.5 } }, // untargetable 1.5s every 4s (keeps walking) — burst it in the gaps
    battery: { name: "Battery Bot", icon: "🤖", hp: 70, speed: 0.75, armor: 0, shield: 40, shieldRegen: 8, bounty: 13, lives: 1, flier: false, meleeDmg: 5, meleeRate: 0.9 }, // a regenerating shield EATS Zap — bonk it down
    mole: { name: "Digger Mole", icon: "🦫", hp: 65, speed: 0.8, armor: 0, shield: 0, shieldRegen: 0, bounty: 12, lives: 1, flier: false, meleeDmg: 5, meleeRate: 0.9, tunnel: true }, // untargetable + unblockable under the middle third — guard the ends
    hawk: { name: "Kite Hawk", icon: "🪁", hp: 30, speed: 2.0, armor: 0, shield: 0, shieldRegen: 0, bounty: 7, lives: 1, flier: true, meleeDmg: 0, meleeRate: 1 }, // fast flier — Dart/Fan only
    // ---- World 4 finale: an old wind-up clock in the attic ----
    // Its whole kit is DATA the engine already reads (phases -> speedMult /
    // disable / spawn), so it needed no new engine code (the TD-4 boss lesson).
    tickmaster: { name: "The Tickmaster", icon: "\u23f0", hp: 3200, speed: 0.45, armor: 0.2, shield: 0, shieldRegen: 0,
      // toll 10 → 8, in line with the other two big bosses (Vacuum King and The
      // Static are both 8). Ten lives out of twenty QUANTIZED the whole finale:
      // waves 1-14 of L16 leak nothing on any seed or build, so the level was
      // decided by a single boss leak and could only end at 20, 10 or dead.
      // Measured over 8 seeds, this moves a dart-only finish from 1-2 lives to
      // 3-4 and drops the median from 17 to 16 without flipping any outcome.
      bounty: 220, lives: 8, size: 3.0, flier: false, meleeDmg: 0, meleeRate: 1, boss: true,
      phases: [
        { upTo: 1.0 },
        { upTo: 0.66, speedMult: 1.35 },
        { upTo: 0.33, speedMult: 1.35, disable: { every: 7, seconds: 3 },
          spawn: { every: 9, type: "screw", count: 3 } },
      ] },

    // ---- TD-10: threat shapes that punish a MONO build ----
    // The flier lesson generalized. Fliers already broke mortar-only boards; each
    // of these breaks a different one-line build, so no single tower carries.
    cushion: { name: "Couch Cushion", icon: "🛋️", hp: 150, speed: 0.55, armor: 0, shield: 0, shieldRegen: 0, bounty: 16, lives: 1, flier: false, meleeDmg: 5, meleeRate: 1, splashResist: 0.6 }, // soaks AoE — splash lands at 40%; answer it with single-target
    screw: { name: "Loose Screw", icon: "🔩", hp: 95, speed: 0.8, armor: 0, shield: 0, shieldRegen: 0, bounty: 18, lives: 1, flier: false, meleeDmg: 5, meleeRate: 0.9, sap: { every: 7, seconds: 2.5, radius: 3.5 } }, // jams the NEAREST gun in reach — a real mid-wave emergency
    slime: { name: "Drip Slime", icon: "💧", hp: 110, speed: 0.7, armor: 0, shield: 0, shieldRegen: 0, bounty: 14, lives: 1, flier: false, meleeDmg: 4, meleeRate: 1, slowHeal: { hps: 9 } }, // regrows WHILE slowed — a slow-only board feeds it
    // The anti-DART shape. Measured BEFORE TD-10: a dart-only board won 12/12 —
    // dart is the generalist (cheap, fast, hits air) and nothing in the roster
    // answered it. This does: it FLIES (mortar and camp cannot touch it) and it
    // is ARMORED (armor halves "bonk", i.e. dart) — but zap is NOT bonk, so the
    // Fan's beam cuts straight through. One enemy that makes a dart-mono board
    // bring a Fan, and finally gives the Fan a headline job.
    tinplane: { name: "Tin Plane", icon: "✈️", hp: 55, speed: 1.5, armor: 0.5, shield: 0, shieldRegen: 0, bounty: 12, lives: 1, flier: true, meleeDmg: 0, meleeRate: 1 },
    // ---- TD-4: World-2 & finale bosses ----
    // AUDIT (2026-07): its whole kit (suck = inhale a SOLDIER) only threatened
    // camp builds, so a tower-only board was immune and the World-2 finale cost
    // ZERO lives (19/20 — easier than L3). It now also jams a gun under half hp
    // (a vacuum inhales a turret's crew — the Static's tested `phases`/`disable`
    // path, no new engine code) and hits harder, so it's a real DPS+disruption
    // check like L4/L12. Sim: L8 19.0 → 15.3 lives, boss reaches the exit on a
    // naive build. hp tuned to THIS level's 13-pad geometry.
    // ---- World 5 (Garage): two shapes nothing in the roster covered ----
    // 🛹 Grease Racer — the FIRST enemy that hard-counters the Fan. Slows are
    // the Fan's whole job and they do nothing here, so this must be answered
    // with damage or a body in the way. Fast and fragile to keep it fair.
    racer: { name: "Grease Racer", icon: "🛹", hp: 70, speed: 1.6, armor: 0, shield: 0, shieldRegen: 0, bounty: 10, lives: 1, flier: false, slowImmune: true, meleeDmg: 5, meleeRate: 1 },
    // 🪣 Bolt Bucket — drips Bricks while ALIVE (the Mud Blob splits once, on
    // death; this is the opposite). Punishes slow-drip DPS and rewards killing
    // the source early and far from the door.
    bucket: { name: "Bolt Bucket", icon: "🪣", hp: 260, speed: 0.5, armor: 0.2, shield: 0, shieldRegen: 0, bounty: 30, lives: 1, flier: false, spawner: { type: "brick", every: 3, count: 2, max: 8 }, meleeDmg: 6, meleeRate: 1 },
    // 🧰 The Toolbox Titan (L20) — World 5's finale. Its kit is TOWER-facing
    // from 66% (the Vacuum King lesson: a boss whose whole kit only threatens
    // soldiers costs a tower-only board nothing), and it reuses the already
    // tested `disable` / `spawn` phase paths rather than adding boss code.
    // Toll 8, matching every other big boss — the Tickmaster's 10-of-20
    // quantized its entire finale into "20, 10 or dead".
    // hp/toll chosen by SIM, not by the design doc (the Bed Monster lesson —
    // the plan's 3400/8 finished at a median 18/20 across 8 seeds, i.e. a
    // formality the boss-tension audit rejects). Swept 3400→8200 × toll 6/8:
    // 4600/6 is the only band that is both graded and safe — median 9/20, range
    // 7-11, no seed lost, and comfortably winnable on heroic. Above 5800 the
    // finale QUANTIZES (every seed lands on exactly one boss leak, 12 or 14),
    // the same flat ending the Tickmaster's 10-of-20 toll produced.
    titan: { name: "Toolbox Titan", icon: "🧰", hp: 4600, speed: 0.34, armor: 0.3, shield: 80, shieldRegen: 8,
      bounty: 320, lives: 6, size: 3.1, flier: false, boss: true, meleeDmg: 0, meleeRate: 1,
      phases: [{ upTo: 1.0 }, { upTo: 0.66, disable: { every: 5, seconds: 3 } }, { upTo: 0.33, disable: { every: 4, seconds: 3 }, spawn: { type: "screw", count: 2, every: 6 } }] },
    // ---- World 6 (Moving Day): the last two shapes the roster was missing ----
    // 🧻 Bubble Wrap — the Couch Cushion's MIRROR, and the first enemy that
    // directly answers the DART. Single hits pop one bubble at a time (dart and
    // soldier melee land at 40%); splash, zap and abilities cut straight
    // through. The Cushion says "stop leaning on AoE"; this says "stop leaning
    // on single-target", so together they close the counter matrix.
    bubblewrap: { name: "Bubble Wrap", icon: "🧻", hp: 130, speed: 0.6, armor: 0, shield: 0, shieldRegen: 0, bounty: 15, lives: 1, flier: false, bonkResist: 0.6, meleeDmg: 5, meleeRate: 1 },
    // ---- P6: the last EMPTY cell of the resist matrix ----
    // 🦆 Rubber Duck. Every other line already had an answer aimed at it —
    // `armor` blunts the dart's bonk, `splashResist` soaks the mortar,
    // `bonkResist` pads single hits, `slowImmune` deletes the Fan's SLOW and a
    // `shield` buffers its zap — but nothing reduced the Fan's DAMAGE, so a
    // Fan's zap was the one attack in the game that no enemy was built to shrug
    // off. Rubber does: the zap lands at 40% (the same 0.6 the Cushion and the
    // Bubble Wrap use, so the roster's resists are one strength, not three).
    // Deliberately ONE resist in one body — the ≤1-disruptive-special-per-wave
    // contract counts GROUPS, not traits inside a body, so stacking two resists
    // would slip past exactly the rule that exists to stop "shielded + resistant
    // with no answer". Ground, slow and fat: it is a wall you have to shoot,
    // which is the point.
    duck: { name: "Rubber Duck", icon: "🦆", hp: 140, speed: 0.58, armor: 0, shield: 0, shieldRegen: 0, bounty: 15, lives: 1, flier: false, zapResist: 0.6, meleeDmg: 5, meleeRate: 1 },
    // 🛢️ Oil Drum — the first body whose threat is WHERE you kill it. It carries
    // no resist at all; it SPILLS on death, and the slick hustles everything that
    // crosses it (`spill` → a `state.puddles` entry carrying `hurry`, the Sticky
    // Floor's own array and the Boom Box's own flag — one write in `killEnemy`,
    // zero new read sites).
    //   WHY NOT ANOTHER RESIST. The three shapes before it were resists and two
    // measured at ZERO lives (the Tin Plane, then 🦆). And a fourth was designed
    // here and CUT by measurement: a 🥫 Pantry Can built on a fast-resealing
    // shield, because `computeHit` routes damage into a shield ONLY for
    // `dmgType === "zap"` — a shield is an anti-FAN buffer and nothing else, so
    // "reseals faster than you can break it" is 🦆's already-measured-zero role
    // wearing a tin hat. Drove it: dart/mortar/camp times are IDENTICAL at
    // shieldRegen 0 and 34, while a tier-1 Fan goes 40s → never at regen ≥6.
    // The axis that was actually missing is a DECISION, and this is it.
    drum: { name: "Oil Drum", icon: "🛢️", hp: 200, speed: 0.7, armor: 0, shield: 0, shieldRegen: 0, bounty: 18, lives: 1, flier: false, meleeDmg: 5, meleeRate: 1, spill: { r: 1.7, mult: 1.45, seconds: 5 } },
    // 📻 Boom Box — it does not fight. It makes the wave arrive FASTER than
    // your board expects, which is a threat no amount of damage answers; the
    // answer is to shoot the support first (the Junk Healer's lesson, applied
    // to time instead of hp). Fragile on purpose.
    boombox: { name: "Boom Box", icon: "📻", hp: 90, speed: 0.7, armor: 0, shield: 0, shieldRegen: 0, bounty: 16, lives: 1, flier: false, hurry: { mult: 1.35, radius: 2.2 }, meleeDmg: 3, meleeRate: 1 },
    // 🚚 The Moving Van (L24) — World 6's finale, and the end of the arc: the
    // toys' last stand against the van at the curb. Its kit is entirely paths
    // the engine already runs (the TD-4 boss lesson): it UNLOADS as it drives
    // via the Bolt Bucket's capped `spawner` — used on a boss for the first
    // time and thematically exact — then jams a gun at 66% and calls in the
    // music at 33%. hp/toll sit in the band World 5 proved is graded rather
    // than quantized (above ~5800 every seed lands on exactly one boss leak).
    movingvan: { name: "The Moving Van", icon: "🚚", hp: 5200, speed: 0.3, armor: 0.3, shield: 100, shieldRegen: 10,
      bounty: 340, lives: 6, size: 3.2, flier: false, boss: true, meleeDmg: 0, meleeRate: 1,
      spawner: { type: "bubblewrap", every: 4, count: 2, max: 12 },
      phases: [{ upTo: 1.0 }, { upTo: 0.66, disable: { every: 5, seconds: 3 } },
               { upTo: 0.33, speedMult: 1.3, disable: { every: 4, seconds: 3 }, spawn: { type: "boombox", count: 2, every: 7 } }] },
    // 🐕 The Housedog (L28) — World 7's finale. The family dog that thinks every
    // toy is a chew toy. Its whole kit is paths the engine already runs (the
    // TD-4 lesson: a boss needing new engine code is a re-tuning job): `suck`
    // snatches the nearest soldier, and from 66% it knocks a GUN over, so the
    // kit is tower-facing (the Vacuum King lesson — a soldier-only kit costs a
    // tower board nothing), then it shakes the spare keys off the hall table.
    // hp sits inside the band World 5 proved is graded rather than quantized:
    // above ~5800 every seed lands on exactly one boss leak.
    housedog: { name: "The Housedog", icon: "🐕", hp: 4200, speed: 0.32, armor: 0.25, shield: 0, shieldRegen: 0,
      bounty: 360, lives: 6, size: 3.3, flier: false, boss: true, meleeDmg: 0, meleeRate: 1,
      suck: { every: 9 }, enrage: { hpPct: 0.5, mult: 1.2 },
      phases: [ { upTo: 1.0 }, { upTo: 0.66, disable: { every: 6, seconds: 3 } },
                { upTo: 0.33, speedMult: 1.25, disable: { every: 4, seconds: 3 }, spawn: { type: "housekey", count: 4, every: 8 } } ] },
    // 🧲 The Big Magnet (L32) — the campaign's final boss, hanging over the
    // sorting belt. Every verb is a path the engine already runs (the TD-4 boss
    // law), and the COMBINATION is unused: `stomp` has been dormant since the
    // Bed Monster on L4, so the last boss reuses the first one's signature move
    // as a deliberate arc callback, while `disable` from 66% keeps it
    // tower-facing (the Vacuum King lesson).
    bigmagnet: { name: "The Big Magnet", icon: "🧲", hp: 4800, speed: 0.3, armor: 0.35,
      shield: 140, shieldRegen: 12, bounty: 400, lives: 6, size: 3.4, flier: false, boss: true,
      meleeDmg: 0, meleeRate: 1,
      stomp: { dmg: 70, radius: 1.8, seconds: 5 },
      phases: [ { upTo: 1.0 }, { upTo: 0.66, disable: { every: 5, seconds: 3 } },
                { upTo: 0.33, speedMult: 1.25, disable: { every: 3, seconds: 3 },
                  spawn: { type: "carton", count: 5, every: 6 } } ] },
    // 🗜️ The Stamping Press (L36) — World 9's finale and the campaign's last
    // fight: the machine that flattens what is left of you into the next toy.
    // Every part of its kit is a path the engine already runs (the TD-4 law — a
    // boss that needs new engine code is a re-tuning job, not a boss): `stomp`
    // IS the press coming down, the hp-gated `phases` jam a gun (the Static's
    // path) and then feed rejects onto the line (the Big Magnet's path).
    // hp and the leak toll are NOT guessed — they come from `--boss`, judged on
    // SPREAD rather than median, so the finale can actually end more than one way.
    stamper: { name: "The Stamping Press", icon: "🗜️", hp: 5000, speed: 0.3, armor: 0.3,
      shield: 120, shieldRegen: 12, bounty: 420, lives: 6, size: 3.4, flier: false, boss: true,
      meleeDmg: 0, meleeRate: 1,
      stomp: { dmg: 75, radius: 1.9, seconds: 5 },
      phases: [ { upTo: 1.0 }, { upTo: 0.66, disable: { every: 5, seconds: 3 } },
                { upTo: 0.33, speedMult: 1.25, disable: { every: 3, seconds: 3 },
                  spawn: { type: "reject", count: 5, every: 6 } } ] },
    // 🎁 The Big Present (L40) — World 10's finale and the campaign's new last
    // fight. Its kit is deliberately the ONE combination no other boss uses: a
    // `hurry` aura, so the Present does not hit you at all — it makes the whole
    // party ARRIVE FASTER, which is a threat damage cannot answer and which the
    // engine already runs (the Boom Box's write pass, read in the ONE `effSpeed`).
    // Everything else is a shipped path: the shield IS the wrapping paper, and
    // the hp-gated phases tear it open (poppers spill out at 66%) and then set
    // the room off (a jammed gun + a dash at 33%). hp/toll come from `--boss`,
    // judged on SPREAD rather than median so the finale can end more than one way.
    bigpresent: { name: "The Big Present", icon: "🎁", hp: 5200, speed: 0.3, armor: 0.3,
      shield: 140, shieldRegen: 12, bounty: 440, lives: 6, size: 3.4, flier: false, boss: true,
      meleeDmg: 0, meleeRate: 1,
      hurry: { mult: 1.35, radius: 3.2 },
      phases: [ { upTo: 1.0 }, { upTo: 0.66, spawn: { type: "popper", count: 6, every: 6 } },
                { upTo: 0.33, speedMult: 1.3, disable: { every: 4, seconds: 3 },
                  spawn: { type: "popper", count: 8, every: 5 } } ] },
    // hp 8000 → 7600 DE-QUANTIZES this finale. At 8000 the Vacuum King reached
    // the door on EVERY seed and every build, so L8 ended at exactly 10-11 lives
    // eight times out of eight — the whole level reduced to a guaranteed 8-life
    // tax with no outcome you could influence. The cliff is narrow and was found
    // by sweep (`node tools/td-sim.js 8 --boss`): 7200 → the boss dies on all 8
    // normal seeds (18,18,…, a formality); 7400 → it leaks on 2 of 8; 7600 → 6 of
    // 8, spread 10..18. So 7600 is the only value where BOTH outcomes really
    // happen, and holding the King cleanly becomes possible for the first time.
    // Heroic is unchanged and cannot be moved — at ×1.30 hp it leaks at every
    // value tested down to 4800, so heroic stays a flat 10. See CLAUDE.md.
    vacuumking: { name: "Vacuum King", icon: "🌪️", hp: 7600, speed: 0.3, armor: 0.25, shield: 60, shieldRegen: 10, bounty: 300, lives: 8, size: 3.2, flier: false, boss: true, meleeDmg: 0, meleeRate: 1, suck: { every: 8 }, enrage: { hpPct: 0.5, mult: 1.2 }, phases: [{ upTo: 1.0 }, { upTo: 0.5, disable: { every: 6, seconds: 3 } }] }, // inhales the nearest soldier every 8s (instant KO); under half hp it also jams a random gun + a 1.2× hustle
    thestatic: { name: "The Static", icon: "⚡", hp: 8000, speed: 0.32, armor: 0.5, shield: 0, shieldRegen: 0, bounty: 500, lives: 8, size: 3.2, flier: false, boss: true, meleeDmg: 0, meleeRate: 1, phases: [ { upTo: 1.0 }, { upTo: 0.66, disable: { every: 7, seconds: 4 } }, { upTo: 0.33, speedMult: 1.9, spawn: { type: "battery", count: 2, every: 10 } } ] }, // P1 armored wall; P2 jams a random gun; P3 dashes (~0.6) + summons Battery Bots — punishes a single-carry build
  };

  // ---- Levels 1-5: a sock/marble/balloon slice with real progression (beat N →
  //      N+1). Distinct paths/pads; a rising difficulty curve tuned by sim
  //      (tests/td-logic.test.js proves each winnable by an auto-solver + losable
  //      by neglect, and every wave within ±25% of budgetBase·1.18^n). The full
  //      14-enemy roster + bosses (L6-12) land in TD-3 (PLAN_TOWER_DEFENSE.md §7). ----
  // Per-world presentation truth. Anything that used to be an if/else chain over
  // `level.world` lives here, so adding a world cannot leave a surface behind
  // (the attic shipped with the bedroom's bed as its spawn marker).
  // `backbone.ground` is the four bodies a world's waves are built from, in the
  // wave generator's own slot order — [odd primary, odd secondary, even primary,
  // even secondary] — and `backbone.flier` is its one air shape. Both the
  // generator and the composition audit READ this instead of keeping their own
  // copy of the six, which is what let all 24 levels share 85% of their bodies.
  // `floor` is the world's FLOOR — the biggest pixel area on screen and, until
  // now, the same dark blue grid on all 24 levels, so the Toy Store and the
  // Garage looked identical. It is a data field for the same reason spawnGlyph
  // is: a surface that lives in an if/else chain gets left behind when a world
  // ships (the attic once marched in under the bedroom's bed). `pattern` names
  // the texture the renderer bakes; `top`/`bottom` are the floor gradient;
  // `ink` is the texture's own colour; `road` optionally re-tints the lane.
  const WORLDS = {
    bedroom:  { label: "🛏️ Bedroom",  spawnGlyph: "🛏️", backbone: { ground: ["sock", "knight", "blob", "marble"], flier: "balloon" },
      floor: { pattern: "carpet", props: ["blocks", "box", "case"], top: "#2a2350", bottom: "#3a2f63", ink: "rgba(255,255,255,0.05)",
               road: { edge: "#3c2f22", base: "#caa268", top: "#e0bd83", style: "ties", tie: "rgba(58,40,22,0.30)" } } },
    backyard: { label: "🌳 Backyard", spawnGlyph: "🌳", backbone: { ground: ["acorn", "knight", "blob", "ant"], flier: "hawk" },
      floor: { pattern: "grass", props: ["bush", "stone", "tin"], top: "#1d4526", bottom: "#2c5c31", ink: "rgba(190,255,170,0.16)",
               road: { edge: "#4a3a22", base: "#b98f56", top: "#d9b478", style: "stones", tie: "rgba(72,58,36,0.32)" } } },
    toystore: { label: "🧸 Toy Store", spawnGlyph: "🧸", backbone: { ground: ["yoyo", "knight", "blob", "die"], flier: "hawk" },
      floor: { pattern: "tile", props: ["box", "blocks", "stone"], top: "#123f4a", bottom: "#17505e", ink: "rgba(190,245,255,0.10)",
               road: { edge: "#3a2c1e", base: "#d8b06a", top: "#efd39a", style: "ties", tie: "rgba(52,34,18,0.24)" } } },
    attic:    { label: "🧳 Attic",    spawnGlyph: "🧳", backbone: { ground: ["mitten", "knight", "blob", "yarn"], flier: "hawk" },
      floor: { pattern: "boards", props: ["case", "box", "stain"], top: "#3a2a1c", bottom: "#4a3625", ink: "rgba(20,12,6,0.32)",
               road: { edge: "#2a1f14", base: "#9d7d52", top: "#c3a273", style: "tape", tie: "rgba(28,20,12,0.34)" } } },
    garage:   { label: "🔧 Garage",   spawnGlyph: "🔧", backbone: { ground: ["rag", "knight", "blob", "cog"], flier: "hawk" },
      floor: { pattern: "concrete", props: ["tyre", "tin", "stain"], top: "#2b3038", bottom: "#383e47", ink: "rgba(0,0,0,0.22)",
               road: { edge: "#22262c", base: "#8d949e", top: "#a9b1bb", style: "tape", tie: "rgba(255,214,80,0.55)" } } },
    moving:   { label: "📦 Moving Day", spawnGlyph: "📦", backbone: { ground: ["wad", "knight", "blob", "peanut"], flier: "hawk" },
      floor: { pattern: "cardboard", props: ["box", "case", "tyre"], top: "#7a5326", bottom: "#8d6531", ink: "rgba(60,34,10,0.26)",
               road: { edge: "#33261a", base: "#c9a877", top: "#e3c99c", style: "tape", tie: "rgba(180,150,105,0.55)" } } },
    // World 7 — the van arrived. Bare boards under a pale painter's drop-cloth.
    newhouse: { label: "🏠 The New House", spawnGlyph: "🪜", backbone: { ground: ["chair", "knight", "blob", "housekey"], flier: "hawk" },
      floor: { pattern: "dropcloth", props: ["tin", "box", "stone"], top: "#4a4740", bottom: "#5b574d", ink: "rgba(240,236,225,0.13)",
               road: { edge: "#2e2a22", base: "#b7ad97", top: "#dcd4c0", style: "stones", tie: "rgba(120,112,96,0.26)" } } },
    // World 8 — the box that never got unpacked in the New House went out with
    // the recycling. Deliberately NOT another room in the displacement chain:
    // this is the step AFTER being kept. Steel grating under sodium lamps, and
    // the road is a dark rubber conveyor belt so it can never be confused with
    // the New House's pale drop-cloth. Both ♻️ carry U+FE0F — U+267B is
    // text-default and ships as a monochrome sliver on iOS 14.2 without it.
    sortline: { label: "♻️ The Sort Line", spawnGlyph: "♻️",
      backbone: { ground: ["carton", "knight", "blob", "clip"], flier: "leaflet" },
      floor: { pattern: "grating", props: ["tin", "case", "stain"], top: "#232a2e", bottom: "#2f383d", ink: "rgba(255,196,110,0.09)",
               road: { edge: "#101315", base: "#454b52", top: "#636a73", style: "ties", tie: "rgba(12,14,16,0.55)" } } },
    // World 9 — the factory floor. Its own `pattern` and `road.style` (both new)
    // rather than a re-tinted existing pair: the floor guardrail hashes the lane
    // CORRIDOR as well as the whole canvas, and three worlds once shipped the
    // identical road because they had no `road` field at all. "plates" is
    // deliberately NOT a belt — a moving-belt road would read as the conveyor
    // GIMMICK, and a mechanic you cannot tell apart from a decoration is the
    // side-door defect all over again.
    toyworks: { label: "🏭 The Toy Works", spawnGlyph: "🏭",
      backbone: { ground: ["reject", "knight", "blob", "pellet"], flier: "offcut" },
      floor: { pattern: "mould", props: ["box", "tin", "stain"], top: "#2a2622", bottom: "#3a332c", ink: "rgba(255,158,74,0.10)",
               road: { edge: "#17130f", base: "#5a5148", top: "#7b7064", style: "plates", tie: "rgba(255,190,110,0.30)" } } },
    // World 10 — the toy the factory moulded gets WRAPPED and handed over. Every
    // world so far was somewhere the toybox was pushed further from the bedroom;
    // this is the one place the chain runs the other way, so it is the brightest
    // floor in the game rather than another dim room. Its own `pattern` and
    // `road.style` (both new) for the reason World 9's were new: the floor
    // guardrail hashes the lane CORRIDOR as well as the whole canvas, and three
    // worlds once shipped the identical road because they simply had no `road`.
    party: { label: "🎉 The Party", spawnGlyph: "🎉",
      backbone: { ground: ["popper", "knight", "blob", "sweet"], flier: "streamer" },
      // `stain` is deliberately NOT in this trio, and the reason generalizes: a
      // floor MARK is drawn as a dark ellipse at <=0.62 alpha, which is subtle on
      // the four DARK floors that use it (attic/garage/sortline/toyworks) and reads
      // as a HOLE on a bright one — screenshotted on this plum carpet, three of them
      // in one quadrant, indistinguishable from the duplicate-shadow defect the owner
      // once reported as "circles after circles". A light floor wants props with FORM.
      floor: { pattern: "confetti", props: ["box", "blocks", "tin"], top: "#4a2f52", bottom: "#5d3b63", ink: "rgba(255,236,150,0.12)",
               road: { edge: "#2a1730", base: "#c66aa8", top: "#e894c6", style: "chain", tie: "rgba(255,236,150,0.42)" } } },
  };

  // ---- Phase 2: per-world backbone SKINS ----
  // The six backbone types were ~85% of every body the game ever spawns, and the
  // generator hard-coded the same four ground types for all 24 levels, so the
  // Garage and Moving Day were the SAME wave table wearing different level names
  // (their body-count vectors scored a cosine similarity of ~1.0).
  //
  // A skin is the same body in a different costume: identical hp / speed / armor
  // / shield / bounty / melee, a new id, name, icon and art. Two things make
  // that provably free rather than merely plausible:
  //   · the stats are COPIED, not retyped, so a skin cannot drift from its
  //     ancestor by a typo (and a guardrail re-asserts it against a hand-edit);
  //   · `sortKey` keeps the ancestor's spawn-queue tiebreak, so a reskinned wave
  //     replays BYTE-IDENTICALLY — the id is a name, the key is the behaviour.
  // Verified: all 24 levels × 4 seeds × 2 plans × normal + heroic, zero drift.
  //
  // Bedroom deliberately keeps the originals: the Sock Goblin is the game's
  // first enemy and its mascot, and leaving it there makes sock/marble World 1's
  // exclusives for free.
  const SKINS = [
    // [ancestor, id, name, icon]
    ["sock",   "acorn",  "Acorn Trooper",  "🌰"],
    ["marble", "ant",    "Ant Scout",      "🐜"],
    ["sock",   "yoyo",   "Yo-Yo Bandit",   "🪀"],
    ["marble", "die",    "Runaway Die",    "🎲"],
    ["sock",   "mitten", "Lost Mitten",    "🧤"],
    ["marble", "yarn",   "Yarn Ball",      "🧶"],
    ["sock",   "rag",    "Grease Rag",     "🧽"],
    ["marble", "cog",    "Rogue Cog",      "⚙️"],
    ["sock",   "wad",    "Packing Wad",    "🗞️"],
    ["marble", "peanut", "Packing Peanut", "🥜"],
    // World 7 (The New House) — the van has been unpacked into an empty house
    ["sock",   "chair",    "Flat-Pack Chair", "🪑"],
    ["marble", "housekey", "Spare Key",       "🔑"],
    // World 8 (The Sort Line). The HAWK skin is the new idea: every world since
    // the backyard shared one flier, and it is 11-23% of every world's bodies —
    // measured as the single cheapest differentiation lever left, taking the
    // worst world-pair cosine from 0.688 to 0.428.
    ["sock",   "carton",  "Juice Carton", "🧃"],
    ["marble", "clip",    "Runaway Clip", "📎"],
    ["hawk",   "leaflet", "Loose Leaf",   "📄"],
    // World 9 (The Toy Works) — the loop closes: the step after being sorted is
    // the factory that melts you down and moulds a NEW toy. A reject piece came
    // off the line misshapen; a resin pellet is what the line is fed. It takes a
    // hawk skin too (the World-8 finding: the shared flier is 11-23% of every
    // world's bodies and reskinning it is the cheapest differentiation left).
    ["sock",   "reject",  "Reject Piece",  "🧩"],
    ["marble", "pellet",  "Resin Pellet",  "🟠"],
    ["hawk",   "offcut",  "Flying Offcut", "🥏"],
    // World 10 (The Party) — the new toy is wrapped and given away. All three
    // glyphs are Emoji 0.6/1.0 and emoji-presentation by default, so none needs
    // U+FE0F (the VS16 scan checks that, but picking safe glyphs is cheaper).
    ["sock",   "popper",   "Party Popper",   "🎊"],
    ["marble", "sweet",    "Loose Sweet",    "🍬"],
    ["hawk",   "streamer", "Stray Streamer", "🎏"],
  ];
  for (const [src, id, name, icon] of SKINS) {
    ENEMIES[id] = Object.assign({}, ENEMIES[src], { name, icon, sortKey: src, skinOf: src });
  }

  // The worlds that PREDATE the composition contract, and therefore the ONE owner
  // of which levels `W5 wave composition` (and tools/td-wave-gen --check) rule.
  //
  // This was a hand-written RULED list of the worlds that ARE covered, duplicated
  // in the test AND the tool — and CLAUDE.md records it going stale exactly that
  // way once already ("read l.world === 'garage' and stayed that way through
  // three more worlds"), so three worlds were emitted against the contract and
  // then never checked against it. Inverting it closes the hole for good: the
  // exemption list is CLOSED (the past cannot grow), so an eleventh world is
  // ruled by default instead of needing someone to remember. Behaviour today is
  // byte-identical to the list it replaces.
  //
  // These four predate the World-4 revert that taught the contract; re-authoring
  // their wave tables to satisfy it would be a re-tune of tuned levels, which is
  // why they are exempt rather than fixed.
  const PRE_CONTRACT_WORLDS = ["bedroom", "backyard", "toystore", "attic"];

  // The ONE list of what counts as backbone, derived from the worlds. The
  // generator and the composition audit each carried their own copy of
  // ["sock","marble","blob","knight","brick","hawk"], which is exactly the
  // literal that made every world's waves the same shape.
  const BACKBONE_TYPES = (() => {
    // ONE hand-seeded exception. The comment here used to claim brick was "on
    // every world by design"; measuring it, brick is authored on exactly ONE
    // level (L2) in one world of nine, and otherwise only ever arrives as the
    // Bolt Bucket's spawner drip — which the wave-budget audit cannot see at
    // all. So it is World 1's squad enemy plus a drip, not a campaign regular,
    // and it is unskinned because it is never a world's identity.
    //
    // A hand-seed inside a derivation is the "a scan's own list is part of the
    // scan" shape, so it is guardrailed rather than trusted: anything seeded
    // here takes BACKBONE credit without a world declaring it, which would let
    // a mechanic-carrying enemy slip past the "<=1 special per wave" contract.
    // `AUDIT backbone` therefore requires every seed to be VANILLA.
    const s = new Set(["brick"]);
    for (const w of Object.values(WORLDS)) { w.backbone.ground.forEach((t) => s.add(t)); s.add(w.backbone.flier); }
    return [...s];
  })();

  const LEVELS = [
    {
      id: 1,
      name: "Under the Bed",
      badge: 1,
      world: "bedroom",
      startGold: 220,
      budgetBase: 170,
      path: [ [0, 3], [7, 3], [7, 10], [16, 10], [16, 4], [23, 4] ],
      // TD-16 🕳️ Mud Patch: the conveyor's data field, mirrored — a stretch
      // where they CRAWL, anchored under p2 so a board that covers it is
      // rewarded. The conveyor is a stretch you wish you could cover; this is
      // one you want to build around.
      zones: [ { from: 7, to: 13, mult: 0.75 } ],
      pads: [
        { id: "p1", cx: 5, cy: 1 },
        { id: "p2", cx: 5, cy: 6 },
        { id: "p3", cx: 9, cy: 5 },
        { id: "p4", cx: 12, cy: 8 },
        { id: "p5", cx: 10, cy: 12 },
        { id: "p6", cx: 14, cy: 6 },
        { id: "p7", cx: 18, cy: 6 },
        { id: "p8", cx: 20, cy: 2 },
      ],
      waves: [
        { groups: [ { type: "sock", count: 6, gap: 0.85, delay: 0 } ] },
        { groups: [ { type: "sock", count: 7, gap: 0.85, delay: 0 } ] },
        { groups: [ { type: "marble", count: 6, gap: 0.55, delay: 0 }, { type: "sock", count: 5, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "marble", count: 7, gap: 0.55, delay: 0 }, { type: "sock", count: 6, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "knight", count: 1, gap: 1, delay: 0 }, { type: "marble", count: 7, gap: 0.55, delay: 3 }, { type: "sock", count: 5, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 1, gap: 1, delay: 0 }, { type: "marble", count: 9, gap: 0.55, delay: 3 }, { type: "sock", count: 7, gap: 0.85, delay: 4 } ] },
      ],
    },
    {
      id: 2,
      name: "Closet Door",
      badge: 1,
      world: "bedroom",
      startGold: 300,
      budgetBase: 260,
      path: [ [0, 2], [19, 2], [19, 11], [4, 11], [4, 7], [23, 7] ],
      zones: [ { from: 3, to: 18, mult: 1, dmg: 0.85 } ], // ⛱️ Blanket Cover — shots land soft over the front of the lane
      pads: [
        { id: "p1", cx: 3, cy: 4 },
        { id: "p2", cx: 6, cy: 4 },
        { id: "p3", cx: 9, cy: 4 },
        { id: "p4", cx: 13, cy: 4 },
        { id: "p5", cx: 16, cy: 4 },
        { id: "p6", cx: 21, cy: 5 },
        { id: "p7", cx: 16, cy: 9 },
        { id: "p8", cx: 12, cy: 9 },
        { id: "p9", cx: 9, cy: 9 },
        { id: "p10", cx: 6, cy: 9 },
      ],
      waves: [
        { groups: [ { type: "sock", count: 9, gap: 0.85, delay: 0 } ] },
        { groups: [ { type: "sock", count: 11, gap: 0.85, delay: 0 } ] },
        { groups: [ { type: "blob", count: 3, gap: 0.85, delay: 0 }, { type: "marble", count: 8, gap: 0.55, delay: 3 }, { type: "sock", count: 4, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "blob", count: 3, gap: 0.85, delay: 0 }, { type: "marble", count: 9, gap: 0.55, delay: 3 }, { type: "sock", count: 5, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "brick", count: 11, gap: 0.55, delay: 0 }, { type: "blob", count: 3, gap: 0.85, delay: 3 }, { type: "sock", count: 3, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "brick", count: 13, gap: 0.55, delay: 0 }, { type: "blob", count: 4, gap: 0.85, delay: 3 }, { type: "sock", count: 3, gap: 0.85, delay: 4, at: 33 } ] },
        { groups: [ { type: "knight", count: 2, gap: 1, delay: 0 }, { type: "blob", count: 4, gap: 0.85, delay: 3 }, { type: "marble", count: 16, gap: 0.55, delay: 4 }, { type: "sock", count: 4, gap: 0.85, delay: 5 } ] },
        { groups: [ { type: "knight", count: 3, gap: 1, delay: 0 }, { type: "blob", count: 5, gap: 0.85, delay: 3 }, { type: "marble", count: 18, gap: 0.55, delay: 4 }, { type: "sock", count: 4, gap: 0.85, delay: 5 } ] },
      ],
    },
    {
      id: 3,
      name: "Toy Shelf Run",
      badge: 2,
      world: "bedroom",
      startGold: 400,  // AUDIT 2026-07: raised so the OPENING is fair — the old value lost 4-8 lives in waves 1-3 before a real board existed (the front-loaded-difficulty fix)
      budgetBase: 330,
      // TD-11: the lever is INTRODUCED here, deep in World 1, so L10's train
      // set isn't the first time you meet one. Default (short) route unchanged —
      // lane 0 IS `path`, so a re-fork is a default-noop and needs no re-tune.
      //
      // RE-FORKED 2026-07. The first cut branched at dist 35 of a 46-cell lane —
      // 76% of the way to the door — and the sweep measured its lever at a gain
      // of exactly 0.0 lives at EVERY board size from 4 to 9 pads: there was no
      // board left downstream for the extra exposure to act on. Legality had
      // been checked; VALUE never had, because the shipped lever guardrail was
      // hard-pinned to L10. Re-searched with tools/td-fork-search.js (RESEARCH=1)
      // and re-measured: the new detour splits at dist 14 (30% along) for +2.0
      // lives at the thinnest board and +1.0 at 5 pads. L3 still cannot be made
      // DECISIVE — a 5-pad dart board clears it on every seed, so no diversion
      // can flip a loss — and that is recorded as the tutorial fork's exemption
      // in `TD7 lever advantage` rather than papered over.
      paths: [
        [ [0, 12], [4, 12], [4, 3], [11, 3], [11, 10], [18, 10], [18, 3], [23, 3] ],
        [ [0, 12], [4, 12], [4, 3], [5, 3], [5, 13], [8, 13], [8, 3], [11, 3], [11, 10], [18, 10], [18, 3], [23, 3] ],
      ],
      fork: { at: 14 },   // shared-prefix length — where the tracks split
      lever: { cx: 5, cy: 3 }, // tap it to send the traffic the long way
      path: [ [0, 12], [4, 12], [4, 3], [11, 3], [11, 10], [18, 10], [18, 3], [23, 3] ],
      pads: [
        { id: "p1", cx: 2, cy: 10 },
        { id: "p2", cx: 6, cy: 12 },
        { id: "p3", cx: 6, cy: 9 },
        { id: "p4", cx: 2, cy: 7 },
        { id: "p5", cx: 6, cy: 5 },
        { id: "p6", cx: 4, cy: 1 , boost: { range: 1.18, rate: 1.15 } },
        { id: "p7", cx: 6, cy: 1 },
        { id: "p8", cx: 9, cy: 1 },
        { id: "p9", cx: 11, cy: 1 },
        { id: "p10", cx: 13, cy: 5 },
      ],
      waves: [
        { groups: [ { type: "sock", count: 11, gap: 0.85, delay: 0 } ] },
        { groups: [ { type: "bull", count: 1, gap: 1.4, delay: 0 }, { type: "marble", count: 11, gap: 0.55, delay: 3 }, { type: "sock", count: 5, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "bull", count: 2, gap: 1.4, delay: 0 }, { type: "marble", count: 14, gap: 0.55, delay: 3 }, { type: "sock", count: 2, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "balloon", count: 5, gap: 1.1, delay: 0 }, { type: "knight", count: 2, gap: 1, delay: 3 }, { type: "sock", count: 8, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "balloon", count: 6, gap: 1.1, delay: 0 }, { type: "knight", count: 2, gap: 1, delay: 3 }, { type: "sock", count: 10, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "bull", count: 2, gap: 1.4, delay: 0 }, { type: "blob", count: 4, gap: 0.85, delay: 3 }, { type: "balloon", count: 4, gap: 1.1, delay: 4 }, { type: "sock", count: 7, gap: 0.85, delay: 5 } ] },
        { groups: [ { type: "bull", count: 2, gap: 1.4, delay: 0 }, { type: "blob", count: 5, gap: 0.85, delay: 3 }, { type: "balloon", count: 5, gap: 1.1, delay: 4 }, { type: "sock", count: 9, gap: 0.85, delay: 5 } ] },
        { groups: [ { type: "bull", count: 3, gap: 1.4, delay: 0 }, { type: "blob", count: 6, gap: 0.85, delay: 3 }, { type: "balloon", count: 6, gap: 1.1, delay: 4 }, { type: "sock", count: 8, gap: 0.85, delay: 5 } ] },
        { groups: [ { type: "bull", count: 3, gap: 1.4, delay: 0 }, { type: "blob", count: 7, gap: 0.85, delay: 3 }, { type: "balloon", count: 7, gap: 1.1, delay: 4 }, { type: "sock", count: 12, gap: 0.85, delay: 5 } ] },
      ],
    },
    {
      id: 4,
      name: "Bed Monster",
      badge: 2,
      world: "bedroom",
      startGold: 520,
      budgetBase: 240,
      path: [ [0, 4], [20, 4], [20, 10], [6, 10], [6, 7], [14, 7] ],
      pads: [
        { id: "p1", cx: 2, cy: 6 },
        { id: "p2", cx: 5, cy: 2 },
        { id: "p3", cx: 7, cy: 2 },
        { id: "p4", cx: 10, cy: 2 },
        { id: "p5", cx: 12, cy: 2 },
        { id: "p6", cx: 15, cy: 2 },
        { id: "p7", cx: 17, cy: 6 },
        { id: "p8", cx: 19, cy: 2 },
        { id: "p9", cx: 18, cy: 8 },
        { id: "p10", cx: 22, cy: 2 },
      ],
      waves: [
        { groups: [ { type: "sock", count: 8, gap: 0.85, delay: 0 } ] },
        { groups: [ { type: "knight", count: 1, gap: 1, delay: 0 }, { type: "blob", count: 2, gap: 0.85, delay: 3 }, { type: "sock", count: 4, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 1, gap: 1, delay: 0 }, { type: "blob", count: 2, gap: 0.85, delay: 3 }, { type: "sock", count: 5, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "bull", count: 1, gap: 1.4, delay: 0 }, { type: "balloon", count: 3, gap: 1.1, delay: 3 }, { type: "marble", count: 9, gap: 0.55, delay: 4 }, { type: "sock", count: 2, gap: 0.85, delay: 5 } ] },
        { groups: [ { type: "bull", count: 1, gap: 1.4, delay: 0 }, { type: "balloon", count: 3, gap: 1.1, delay: 3 }, { type: "marble", count: 10, gap: 0.55, delay: 4 }, { type: "sock", count: 4, gap: 0.85, delay: 5 } ] },
        { groups: [ { type: "healer", count: 2, gap: 0.85, delay: 0 }, { type: "knight", count: 2, gap: 1, delay: 3 }, { type: "bull", count: 1, gap: 1.4, delay: 4 }, { type: "sock", count: 5, gap: 0.85, delay: 5 } ] },
        { groups: [ { type: "healer", count: 2, gap: 0.85, delay: 0 }, { type: "knight", count: 3, gap: 1, delay: 3 }, { type: "bull", count: 2, gap: 1.4, delay: 4 }, { type: "sock", count: 2, gap: 0.85, delay: 5 } ] },
        { groups: [ { type: "healer", count: 2, gap: 0.85, delay: 0 }, { type: "knight", count: 3, gap: 1, delay: 3 }, { type: "bull", count: 2, gap: 1.4, delay: 4 }, { type: "sock", count: 7, gap: 0.85, delay: 5 } ] },
        { boss: true, groups: [ { type: "sock", count: 11, gap: 0.55, delay: 0 }, { type: "bedmonster", count: 1, gap: 1, delay: 0 } ] },
      ],
    },
    {
      id: 5,
      name: "Sandbox Siege",
      world: "backyard",
      badge: 2,
      startGold: 340,
      budgetBase: 300,
      path: [ [0, 7], [6, 7], [6, 2], [13, 2], [13, 11], [19, 11], [19, 5], [23, 5] ],
      pads: [
        { id: "p1", cx: 1, cy: 9 }, { id: "p2", cx: 4, cy: 5 }, { id: "p3", cx: 7, cy: 8 }, { id: "p4", cx: 8, cy: 3 }, { id: "p5", cx: 8, cy: 0 }, { id: "p6", cx: 11, cy: 4 }, { id: "p7", cx: 14, cy: 1 }, { id: "p8", cx: 15, cy: 7 }, { id: "p9", cx: 11, cy: 9 }, { id: "p10", cx: 14, cy: 9 }, { id: "p11", cx: 16, cy: 10 }, { id: "p12", cx: 18, cy: 9 },
      ],
      waves: [
        { groups: [ { type: "acorn", count: 8, gap: 0.85, delay: 0 }, { type: "ant", count: 5, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "acorn", count: 7, gap: 0.85, delay: 0 }, { type: "ant", count: 11, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "mole", count: 3, gap: 0.9, delay: 0 }, { type: "acorn", count: 6, gap: 0.85, delay: 3 }, { type: "ant", count: 6, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "mole", count: 4, gap: 0.9, delay: 0 }, { type: "acorn", count: 6, gap: 0.85, delay: 3 }, { type: "ant", count: 7, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "knight", count: 3, gap: 1, delay: 0 }, { type: "mole", count: 3, gap: 0.9, delay: 3 }, { type: "acorn", count: 6, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 3, gap: 1, delay: 0 }, { type: "mole", count: 3, gap: 0.9, delay: 3 }, { type: "ant", count: 10, gap: 0.55, delay: 4 }, { type: "slime", count: 1, gap: 0.9, delay: 3, at: 22 } ] },
        { groups: [ { type: "blob", count: 5, gap: 0.85, delay: 0 }, { type: "mole", count: 4, gap: 0.9, delay: 3 }, { type: "acorn", count: 7, gap: 0.85, delay: 4 }, { type: "slime", count: 1, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "knight", count: 4, gap: 1, delay: 0 }, { type: "mole", count: 3, gap: 0.9, delay: 3 }, { type: "ant", count: 11, gap: 0.55, delay: 4 }, { type: "hawk", count: 3, gap: 0.3, delay: 2 }, { type: "slime", count: 2, gap: 0.9, delay: 3 }, { type: "tinplane", count: 2, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "blob", count: 5, gap: 0.85, delay: 0 }, { type: "knight", count: 3, gap: 1, delay: 3 }, { type: "mole", count: 4, gap: 0.9, delay: 4 }, { type: "hawk", count: 4, gap: 0.3, delay: 2 }, { type: "slime", count: 2, gap: 0.9, delay: 3 }, { type: "tinplane", count: 2, gap: 0.45, delay: 5, at: 22 } ] },
        { groups: [ { type: "knight", count: 5, gap: 1, delay: 0 }, { type: "mole", count: 4, gap: 0.9, delay: 3 }, { type: "blob", count: 5, gap: 0.85, delay: 4 }, { type: "hawk", count: 5, gap: 0.3, delay: 2 }, { type: "slime", count: 2, gap: 0.9, delay: 3 }, { type: "tinplane", count: 2, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 6, gap: 1, delay: 0 }, { type: "blob", count: 6, gap: 0.85, delay: 3 }, { type: "mole", count: 5, gap: 0.9, delay: 4 }, { type: "acorn", count: 2, gap: 0.85, delay: 5 }, { type: "hawk", count: 5, gap: 0.3, delay: 2 }, { type: "slime", count: 3, gap: 0.9, delay: 3 }, { type: "tinplane", count: 3, gap: 0.45, delay: 5 } ] },
      ],
    },
    {
      id: 6,
      name: "Firefly Night",
      world: "backyard",
      badge: 2,
      night: true,
      startGold: 380,  // AUDIT 2026-07: raised so the OPENING is fair — the old value lost 4-5 lives in waves 1-3 before a real board existed (the front-loaded-difficulty fix)
      budgetBase: 340,
      path: [ [0, 2], [15, 2], [15, 6], [5, 6], [5, 10], [21, 10] ],
      pads: [
        { id: "p1", cx: 1, cy: 4 }, { id: "p2", cx: 4, cy: 0 }, { id: "p3", cx: 7, cy: 4 }, { id: "p4", cx: 10, cy: 0 }, { id: "p5", cx: 12, cy: 4 }, { id: "p6", cx: 17, cy: 3 }, { id: "p7", cx: 14, cy: 4 }, { id: "p8", cx: 12, cy: 8 }, { id: "p9", cx: 9, cy: 4 }, { id: "p10", cx: 6, cy: 8 }, { id: "p11", cx: 3, cy: 8 },
      ],
      waves: [
        { groups: [ { type: "acorn", count: 9, gap: 0.85, delay: 0 }, { type: "ant", count: 6, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 5, gap: 0.9, delay: 0 }, { type: "acorn", count: 5, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 5, gap: 0.9, delay: 0 }, { type: "acorn", count: 6, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 6, gap: 0.9, delay: 0 }, { type: "ant", count: 14, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 7, gap: 0.9, delay: 0 }, { type: "acorn", count: 7, gap: 0.85, delay: 3 }, { type: "ant", count: 8, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "ghost", count: 7, gap: 0.9, delay: 0 }, { type: "acorn", count: 9, gap: 0.85, delay: 3 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "knight", count: 3, gap: 1, delay: 0 }, { type: "ghost", count: 5, gap: 0.9, delay: 3 }, { type: "ant", count: 10, gap: 0.55, delay: 4 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "knight", count: 4, gap: 1, delay: 0 }, { type: "ghost", count: 5, gap: 0.9, delay: 3 }, { type: "acorn", count: 3, gap: 0.85, delay: 4 }, { type: "hawk", count: 3, gap: 0.3, delay: 2 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 }, { type: "tinplane", count: 2, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "blob", count: 4, gap: 0.85, delay: 0 }, { type: "ghost", count: 5, gap: 0.9, delay: 3 }, { type: "ant", count: 7, gap: 0.55, delay: 4 }, { type: "hawk", count: 6, gap: 0.3, delay: 2 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 }, { type: "tinplane", count: 2, gap: 0.45, delay: 5 }, { type: "duck", count: 1, gap: 0.7, delay: 2 } ] },
        { groups: [ { type: "blob", count: 6, gap: 0.85, delay: 0 }, { type: "ghost", count: 6, gap: 0.9, delay: 3 }, { type: "knight", count: 3, gap: 1, delay: 4 }, { type: "hawk", count: 4, gap: 0.3, delay: 2 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 }, { type: "tinplane", count: 2, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 5, gap: 1, delay: 0 }, { type: "ghost", count: 7, gap: 0.9, delay: 3 }, { type: "blob", count: 4, gap: 0.85, delay: 4 }, { type: "hawk", count: 5, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "tinplane", count: 2, gap: 0.45, delay: 5 }, { type: "duck", count: 1, gap: 0.7, delay: 2 } ] },
        { groups: [ { type: "knight", count: 7, gap: 1, delay: 0 }, { type: "ghost", count: 8, gap: 0.9, delay: 3 }, { type: "blob", count: 4, gap: 0.85, delay: 4 }, { type: "acorn", count: 3, gap: 0.85, delay: 5 }, { type: "hawk", count: 7, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "tinplane", count: 3, gap: 0.45, delay: 5 }, { type: "duck", count: 1, gap: 0.7, delay: 2 } ] },
      ],
    },
    {
      id: 7,
      name: "The Slip'n'Slide",
      world: "backyard",
      badge: 3,
      // AUDIT 2026-07: raised so the OPENING is fair — the old value lost 7-8
      // lives in waves 1-3 before a real board existed (the front-loaded-
      // difficulty fix). Raised again 450→490: the air-pressure level sat at
      // its heroic ceiling and the shipped best-of-two oracle LOST it on 3 of
      // 12 seeds, breaking the "every level winnable on heroic" contract.
      // Measured over 8 seeds: 450 → 1 loss, avg 2.6 lives; 490 → 0 losses,
      // avg 6.3 (a real but tense margin); 530 → avg 12.3, too comfortable.
      // Normal barely moves (19.3 → 20.0 — it was already a formality there).
      startGold: 490,
      budgetBase: 390,
      zones: [ { from: 26, to: 32, mult: 0.75 }, { from: 8, to: 13, mult: 1.6 }, { from: 20, to: 25, mult: 1.6 }, { from: 33, to: 38, mult: 1.6 } ],
      // TD-11: a mid-game use of the lever. This is the air-pressure level, so
      // routing the ground traffic the long way buys your anti-air real time.
      paths: [
        [ [0, 11], [6, 11], [6, 4], [14, 4], [14, 11], [20, 11], [20, 3], [23, 3] ],
        [ [0, 11], [6, 11], [6, 8], [0, 8], [0, 4], [6, 4], [14, 4], [14, 11], [20, 11], [20, 3], [23, 3] ],
      ],
      fork: { at: 9 },   // shared-prefix length — where the tracks split
      lever: { cx: 6, cy: 8 }, // tap it to send the traffic the long way
      path: [ [0, 11], [6, 11], [6, 4], [14, 4], [14, 11], [20, 11], [20, 3], [23, 3] ],
      pads: [
        { id: "p1", cx: 1, cy: 9 }, { id: "p2", cx: 4, cy: 9 }, { id: "p3", cx: 8, cy: 11 }, { id: "p4", cx: 4, cy: 6 }, { id: "p5", cx: 8, cy: 6 }, { id: "p6", cx: 7, cy: 2 }, { id: "p7", cx: 10, cy: 6 }, { id: "p8", cx: 12, cy: 2 }, { id: "p9", cx: 12, cy: 5 }, { id: "p10", cx: 16, cy: 7 }, { id: "p11", cx: 12, cy: 9 }, { id: "p12", cx: 15, cy: 9 },
      ],
      waves: [
        { groups: [ { type: "acorn", count: 8, gap: 0.85, delay: 0 }, { type: "ant", count: 12, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "hawk", count: 7, gap: 0.5, delay: 0 }, { type: "acorn", count: 9, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "hawk", count: 8, gap: 0.5, delay: 0 }, { type: "ant", count: 13, gap: 0.55, delay: 3 }, { type: "acorn", count: 4, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "hawk", count: 9, gap: 0.5, delay: 0 }, { type: "acorn", count: 13, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "balloon", count: 6, gap: 1.1, delay: 0 }, { type: "hawk", count: 8, gap: 0.5, delay: 3 }, { type: "ant", count: 25, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "knight", count: 4, gap: 1, delay: 0 }, { type: "hawk", count: 10, gap: 0.5, delay: 3 }, { type: "acorn", count: 10, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 6, gap: 1, delay: 0 }, { type: "hawk", count: 11, gap: 0.5, delay: 3 }, { type: "ant", count: 22, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "blob", count: 9, gap: 0.85, delay: 0 }, { type: "hawk", count: 12, gap: 0.5, delay: 3 }, { type: "acorn", count: 12, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 6, gap: 1, delay: 0 }, { type: "hawk", count: 11, gap: 0.5, delay: 3 }, { type: "blob", count: 6, gap: 0.85, delay: 4 }, { type: "hawk", count: 11, gap: 0.3, delay: 2 } ] },
        { groups: [ { type: "knight", count: 8, gap: 1, delay: 0 }, { type: "hawk", count: 13, gap: 0.5, delay: 3 }, { type: "balloon", count: 8, gap: 1.1, delay: 4 }, { type: "hawk", count: 12, gap: 0.3, delay: 2 } ] },
        { groups: [ { type: "knight", count: 10, gap: 1, delay: 0 }, { type: "hawk", count: 14, gap: 0.5, delay: 3 }, { type: "blob", count: 8, gap: 0.85, delay: 4 }, { type: "acorn", count: 5, gap: 0.85, delay: 5 }, { type: "hawk", count: 16, gap: 0.3, delay: 2 } ] },
        { groups: [ { type: "knight", count: 11, gap: 1, delay: 0 }, { type: "hawk", count: 18, gap: 0.5, delay: 3 }, { type: "blob", count: 10, gap: 0.85, delay: 4 }, { type: "hawk", count: 18, gap: 0.3, delay: 2 } ] },
        { groups: [ { type: "knight", count: 13, gap: 1, delay: 0 }, { type: "hawk", count: 21, gap: 0.5, delay: 3 }, { type: "blob", count: 11, gap: 0.85, delay: 4 }, { type: "acorn", count: 6, gap: 0.85, delay: 5 }, { type: "hawk", count: 22, gap: 0.3, delay: 2 } ] },
      ],
    },
    {
      id: 8,
      name: "Vacuum King",
      world: "backyard",
      badge: 3,
      startGold: 400,
      budgetBase: 440,
      path: [ [0, 6], [16, 6], [16, 10], [6, 10], [6, 3], [22, 3] ],
      pads: [
        { id: "p1", cx: 1, cy: 8 }, { id: "p2", cx: 3, cy: 5 }, { id: "p3", cx: 7, cy: 8 }, { id: "p4", cx: 10, cy: 4 }, { id: "p5", cx: 12, cy: 8 }, { id: "p6", cx: 15, cy: 4 }, { id: "p7", cx: 14, cy: 8 }, { id: "p8", cx: 16, cy: 12 }, { id: "p9", cx: 10, cy: 8 }, { id: "p10", cx: 10, cy: 12 }, { id: "p11", cx: 4, cy: 9 }, { id: "p12", cx: 8, cy: 5 }, { id: "p13", cx: 4, cy: 3 },
      ],
      waves: [
        { groups: [ { type: "acorn", count: 9, gap: 0.85, delay: 0 }, { type: "knight", count: 3, gap: 1, delay: 3 } ] },
        { groups: [ { type: "battery", count: 6, gap: 0.9, delay: 0 }, { type: "acorn", count: 6, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "battery", count: 6, gap: 0.9, delay: 0 }, { type: "ant", count: 20, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "knight", count: 5, gap: 1, delay: 0 }, { type: "battery", count: 5, gap: 0.9, delay: 3 }, { type: "acorn", count: 4, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 6, gap: 1, delay: 0 }, { type: "battery", count: 6, gap: 0.9, delay: 3 }, { type: "ant", count: 10, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.85, delay: 0 }, { type: "battery", count: 8, gap: 0.9, delay: 3 }, { type: "acorn", count: 8, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 7, gap: 1, delay: 0 }, { type: "battery", count: 7, gap: 0.9, delay: 3 }, { type: "ant", count: 15, gap: 0.55, delay: 4 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "knight", count: 8, gap: 1, delay: 0 }, { type: "battery", count: 8, gap: 0.9, delay: 3 }, { type: "blob", count: 5, gap: 0.85, delay: 4 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "knight", count: 7, gap: 1, delay: 0 }, { type: "battery", count: 7, gap: 0.9, delay: 3 }, { type: "balloon", count: 5, gap: 1.1, delay: 4 }, { type: "hawk", count: 6, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "tinplane", count: 3, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 9, gap: 1, delay: 0 }, { type: "battery", count: 8, gap: 0.9, delay: 3 }, { type: "blob", count: 5, gap: 0.85, delay: 4 }, { type: "hawk", count: 8, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "tinplane", count: 3, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 9, gap: 1, delay: 0 }, { type: "battery", count: 9, gap: 0.9, delay: 3 }, { type: "blob", count: 6, gap: 0.85, delay: 4 }, { type: "hawk", count: 8, gap: 0.3, delay: 2 }, { type: "cushion", count: 3, gap: 0.9, delay: 3 }, { type: "tinplane", count: 4, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 11, gap: 1, delay: 0 }, { type: "battery", count: 10, gap: 0.9, delay: 3 }, { type: "blob", count: 8, gap: 0.85, delay: 4 }, { type: "acorn", count: 4, gap: 0.85, delay: 5 }, { type: "hawk", count: 10, gap: 0.3, delay: 2 }, { type: "cushion", count: 3, gap: 0.9, delay: 3 }, { type: "tinplane", count: 5, gap: 0.45, delay: 5 } ] },
        { boss: true, groups: [ { type: "battery", count: 11, gap: 0.6, delay: 0 }, { type: "acorn", count: 8, gap: 0.5, delay: 2 }, { type: "vacuumking", count: 1, gap: 1, delay: 0 } ] },
      ],
    },
    {
      id: 9,
      name: "Aisle Nine",
      world: "toystore",
      badge: 3,
      startGold: 520,  // AUDIT 2026-07: raised so the OPENING is fair — the old value lost 5-11 lives in waves 1-3 before a real board existed (the front-loaded-difficulty fix)
      budgetBase: 500,
      path: [ [0, 3], [16, 3], [16, 8], [6, 8], [6, 12], [22, 12] ],
      pads: [
        { id: "p1", cx: 1, cy: 5 }, { id: "p2", cx: 4, cy: 1 }, { id: "p3", cx: 7, cy: 5 }, { id: "p4", cx: 9, cy: 1 , boost: { range: 1.18, rate: 1.15 } }, { id: "p5", cx: 12, cy: 5 }, { id: "p6", cx: 14, cy: 1 }, { id: "p7", cx: 14, cy: 4 }, { id: "p8", cx: 18, cy: 7 }, { id: "p9", cx: 15, cy: 6 }, { id: "p10", cx: 12, cy: 10 }, { id: "p11", cx: 10, cy: 6 }, { id: "p12", cx: 7, cy: 10 }, { id: "p13", cx: 4, cy: 10 },
      ],
      waves: [
        { groups: [ { type: "yoyo", count: 10, gap: 0.85, delay: 0 }, { type: "knight", count: 3, gap: 1, delay: 3 } ] },
        { groups: [ { type: "battery", count: 6, gap: 0.9, delay: 0 }, { type: "die", count: 16, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 8, gap: 0.9, delay: 0 }, { type: "knight", count: 4, gap: 1, delay: 3 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.85, delay: 0 }, { type: "ghost", count: 6, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "knight", count: 7, gap: 1, delay: 0 }, { type: "battery", count: 7, gap: 0.9, delay: 3 }, { type: "die", count: 4, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "knight", count: 9, gap: 1, delay: 0 }, { type: "ghost", count: 8, gap: 0.9, delay: 3 }, { type: "yoyo", count: 4, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "blob", count: 12, gap: 0.85, delay: 0 }, { type: "battery", count: 8, gap: 0.9, delay: 3 }, { type: "die", count: 7, gap: 0.55, delay: 4 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 }, { type: "screw", count: 1, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 9, gap: 1, delay: 0 }, { type: "ghost", count: 9, gap: 0.9, delay: 3 }, { type: "battery", count: 5, gap: 0.9, delay: 4 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 9, gap: 1, delay: 0 }, { type: "blob", count: 7, gap: 0.85, delay: 3 }, { type: "ghost", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 7, gap: 0.3, delay: 2 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "tinplane", count: 3, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 10, gap: 1, delay: 0 }, { type: "battery", count: 9, gap: 0.9, delay: 3 }, { type: "ghost", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 8, gap: 0.3, delay: 2 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "tinplane", count: 4, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 12, gap: 1, delay: 0 }, { type: "blob", count: 9, gap: 0.85, delay: 3 }, { type: "battery", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 9, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "tinplane", count: 4, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 14, gap: 1, delay: 0 }, { type: "ghost", count: 9, gap: 0.9, delay: 3 }, { type: "blob", count: 9, gap: 0.85, delay: 4 }, { type: "battery", count: 5, gap: 0.9, delay: 5 }, { type: "hawk", count: 12, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "tinplane", count: 5, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 16, gap: 1, delay: 0 }, { type: "blob", count: 11, gap: 0.85, delay: 3 }, { type: "battery", count: 9, gap: 0.9, delay: 4 }, { type: "ghost", count: 7, gap: 0.9, delay: 5 }, { type: "hawk", count: 14, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "screw", count: 4, gap: 0.9, delay: 4 }, { type: "tinplane", count: 7, gap: 0.45, delay: 5 } ] },
      ],
    },
    {
      id: 10,
      name: "The Train Set",
      world: "toystore",
      badge: 3,
      startGold: 420,
      budgetBase: 560,
      // TD-7 — the fork+lever level. Two lanes share [0,7]→[10,7] then diverge at
      // the fork [10,7]: the SHORT track (lane 0, the default) goes up and across;
      // the LONG track (lane 1) drops into a loop before rejoining the short tail
      // at [10,2]. Throwing the 🔀 lever (8s cooldown) sends the incoming train
      // the LONG way — the same tail towers hit it for far longer. Winnable on the
      // hard default route by a sensible build; the lever is the active-play edge.
      paths: [
        [ [0, 7], [10, 7], [10, 2], [21, 2], [21, 12], [13, 12], [13, 7], [23, 7] ],
        [ [0, 7], [10, 7], [10, 12], [4, 12], [4, 2], [10, 2], [21, 2], [21, 12], [13, 12], [13, 7], [23, 7] ],
      ],
      fork: { at: 10 },       // length of the shared prefix — where the tracks split
      lever: { cx: 10, cy: 7 }, // the tappable switch, sitting on the fork
      pads: [
        { id: "p1", cx: 8, cy: 5 }, { id: "p2", cx: 13, cy: 0 }, { id: "p3", cx: 17, cy: 0 }, { id: "p4", cx: 19, cy: 4 }, { id: "p5", cx: 19, cy: 8 }, { id: "p6", cx: 23, cy: 5 }, { id: "p7", cx: 15, cy: 9 }, { id: "p8", cx: 11, cy: 9 }, { id: "p9", cx: 16, cy: 13 }, { id: "p10", cx: 19, cy: 10 }, { id: "p11", cx: 6, cy: 4 }, { id: "p12", cx: 2, cy: 5 }, { id: "p13", cx: 6, cy: 10 }, { id: "p14", cx: 2, cy: 9 },
      ],
      waves: [
        { groups: [ { type: "yoyo", count: 12, gap: 0.85, delay: 0 }, { type: "knight", count: 3, gap: 1, delay: 3 } ] },
        { groups: [ { type: "mole", count: 7, gap: 0.9, delay: 0 }, { type: "die", count: 10, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "mole", count: 6, gap: 0.9, delay: 0 }, { type: "knight", count: 5, gap: 1, delay: 3 } ] },
        { groups: [ { type: "blob", count: 9, gap: 0.85, delay: 0 }, { type: "mole", count: 6, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "knight", count: 8, gap: 1, delay: 0 }, { type: "mole", count: 6, gap: 0.9, delay: 3 }, { type: "battery", count: 2, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 10, gap: 1, delay: 0 }, { type: "mole", count: 7, gap: 0.9, delay: 3 }, { type: "die", count: 6, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "blob", count: 12, gap: 0.85, delay: 0 }, { type: "mole", count: 7, gap: 0.9, delay: 3 }, { type: "ghost", count: 3, gap: 0.9, delay: 4 }, { type: "slime", count: 1, gap: 0.9, delay: 3 }, { type: "screw", count: 1, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 10, gap: 1, delay: 0 }, { type: "mole", count: 8, gap: 0.9, delay: 3 }, { type: "battery", count: 4, gap: 0.9, delay: 4 }, { type: "slime", count: 1, gap: 0.9, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 10, gap: 1, delay: 0 }, { type: "mole", count: 6, gap: 0.9, delay: 3 }, { type: "blob", count: 5, gap: 0.85, delay: 4 }, { type: "hawk", count: 8, gap: 0.3, delay: 2 }, { type: "slime", count: 2, gap: 0.9, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "tinplane", count: 3, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 12, gap: 1, delay: 0 }, { type: "mole", count: 8, gap: 0.9, delay: 3 }, { type: "ghost", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 8, gap: 0.3, delay: 2 }, { type: "slime", count: 2, gap: 0.9, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "tinplane", count: 4, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 14, gap: 1, delay: 0 }, { type: "mole", count: 8, gap: 0.9, delay: 3 }, { type: "blob", count: 8, gap: 0.85, delay: 4 }, { type: "hawk", count: 10, gap: 0.3, delay: 2 }, { type: "slime", count: 2, gap: 0.9, delay: 3 }, { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "tinplane", count: 5, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 17, gap: 1, delay: 0 }, { type: "mole", count: 9, gap: 0.9, delay: 3 }, { type: "battery", count: 8, gap: 0.9, delay: 4 }, { type: "hawk", count: 12, gap: 0.3, delay: 2 }, { type: "slime", count: 3, gap: 0.9, delay: 3 }, { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "tinplane", count: 5, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 20, gap: 1, delay: 0 }, { type: "mole", count: 10, gap: 0.9, delay: 3 }, { type: "blob", count: 9, gap: 0.85, delay: 4 }, { type: "ghost", count: 4, gap: 0.9, delay: 5 }, { type: "hawk", count: 14, gap: 0.3, delay: 2 }, { type: "slime", count: 3, gap: 0.9, delay: 3 }, { type: "screw", count: 4, gap: 0.9, delay: 4 }, { type: "tinplane", count: 7, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 23, gap: 1, delay: 0 }, { type: "mole", count: 12, gap: 0.9, delay: 3 }, { type: "blob", count: 10, gap: 0.85, delay: 4 }, { type: "battery", count: 5, gap: 0.9, delay: 5 }, { type: "hawk", count: 18, gap: 0.3, delay: 2 }, { type: "slime", count: 4, gap: 0.9, delay: 3 }, { type: "screw", count: 4, gap: 0.9, delay: 4 }, { type: "tinplane", count: 8, gap: 0.45, delay: 5 } ] },
      ],
    },
    {
      id: 11,
      name: "Checkout Chaos",
      world: "toystore",
      badge: 3,
      startGold: 360,
      budgetBase: 620,
      path: [ [0, 2], [21, 2], [21, 5], [3, 5], [3, 8], [21, 8], [21, 11], [3, 11] ],
      pads: [
        { id: "p1", cx: 2, cy: 4 }, { id: "p2", cx: 6, cy: 0 }, { id: "p3", cx: 10, cy: 4 }, { id: "p4", cx: 14, cy: 0 }, { id: "p5", cx: 18, cy: 4 }, { id: "p6", cx: 23, cy: 3 }, { id: "p7", cx: 19, cy: 3 }, { id: "p8", cx: 15, cy: 7 }, { id: "p9", cx: 11, cy: 3 }, { id: "p10", cx: 7, cy: 7 }, { id: "p11", cx: 4, cy: 6 }, { id: "p12", cx: 8, cy: 10 }, { id: "p13", cx: 12, cy: 6 }, { id: "p14", cx: 16, cy: 10 },
      ],
      waves: [
        { groups: [ { type: "yoyo", count: 14, gap: 0.85, delay: 0 }, { type: "knight", count: 3, gap: 1, delay: 3 } ] },
        { groups: [ { type: "die", count: 20, gap: 0.55, delay: 0 }, { type: "knight", count: 6, gap: 1, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "yoyo", count: 12, gap: 0.85, delay: 3 }, { type: "die", count: 12, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "knight", count: 8, gap: 1, delay: 0 }, { type: "battery", count: 7, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "knight", count: 8, gap: 1, delay: 3 }, { type: "ghost", count: 5, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 12, gap: 1, delay: 0 }, { type: "mole", count: 8, gap: 0.9, delay: 3 }, { type: "die", count: 4, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "knight", count: 10, gap: 1, delay: 3 }, { type: "battery", count: 6, gap: 0.9, delay: 4 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 14, gap: 1, delay: 0 }, { type: "ghost", count: 9, gap: 0.9, delay: 3 }, { type: "mole", count: 5, gap: 0.9, delay: 4 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "knight", count: 10, gap: 1, delay: 3 }, { type: "battery", count: 7, gap: 0.9, delay: 4 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 13, gap: 1, delay: 0 }, { type: "mole", count: 7, gap: 0.9, delay: 3 }, { type: "ghost", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 15, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "tinplane", count: 7, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "knight", count: 12, gap: 1, delay: 3 }, { type: "battery", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 16, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "tinplane", count: 7, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 17, gap: 1, delay: 0 }, { type: "mole", count: 9, gap: 0.9, delay: 3 }, { type: "blob", count: 9, gap: 0.85, delay: 4 }, { type: "hawk", count: 20, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "tinplane", count: 9, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "knight", count: 14, gap: 1, delay: 3 }, { type: "battery", count: 9, gap: 0.9, delay: 4 }, { type: "hawk", count: 20, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "tinplane", count: 9, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 23, gap: 1, delay: 0 }, { type: "mole", count: 11, gap: 0.9, delay: 3 }, { type: "blob", count: 9, gap: 0.85, delay: 4 }, { type: "ghost", count: 5, gap: 0.9, delay: 5 }, { type: "hawk", count: 28, gap: 0.3, delay: 2 }, { type: "cushion", count: 3, gap: 0.9, delay: 3 }, { type: "screw", count: 5, gap: 0.9, delay: 4 }, { type: "tinplane", count: 13, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 26, gap: 1, delay: 0 }, { type: "mole", count: 13, gap: 0.9, delay: 3 }, { type: "blob", count: 11, gap: 0.85, delay: 4 }, { type: "battery", count: 7, gap: 0.9, delay: 5 }, { type: "hawk", count: 34, gap: 0.3, delay: 2 }, { type: "cushion", count: 4, gap: 0.9, delay: 3 }, { type: "screw", count: 6, gap: 0.9, delay: 4 }, { type: "tinplane", count: 15, gap: 0.45, delay: 5, at: 50 } ] },
      ],
    },
    {
      id: 12,
      name: "The Static",
      world: "toystore",
      badge: 3,
      startGold: 760,
      budgetBase: 700,
      path: [ [0, 7], [7, 7], [7, 3], [15, 3], [15, 11], [20, 11], [20, 5], [23, 5] ],
      // TD-16 🕳️ Mud Patch: the conveyor's data field, mirrored — a stretch
      // where they CRAWL, anchored under p12 so a board that covers it is
      // rewarded. The conveyor is a stretch you wish you could cover; this is
      // one you want to build around.
      zones: [ { from: 26, to: 32, mult: 0.75 } ],
      pads: [
        { id: "p1", cx: 1, cy: 9 }, { id: "p2", cx: 3, cy: 5 }, { id: "p3", cx: 5, cy: 9 }, { id: "p4", cx: 6, cy: 6 }, { id: "p5", cx: 9, cy: 5 }, { id: "p6", cx: 5, cy: 3 }, { id: "p7", cx: 11, cy: 1 }, { id: "p8", cx: 13, cy: 5 }, { id: "p9", cx: 15, cy: 1 }, { id: "p10", cx: 17, cy: 6 }, { id: "p11", cx: 13, cy: 8 }, { id: "p12", cx: 17, cy: 10 }, { id: "p13", cx: 16, cy: 13 }, { id: "p14", cx: 18, cy: 9 },
      ],
      waves: [
        { groups: [ { type: "ghost", count: 10, gap: 0.9, delay: 0 }, { type: "yoyo", count: 8, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "battery", count: 8, gap: 0.9, delay: 0 }, { type: "yoyo", count: 12, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 10, gap: 0.9, delay: 0 }, { type: "knight", count: 6, gap: 1, delay: 3 } ] },
        { groups: [ { type: "blob", count: 12, gap: 0.85, delay: 0 }, { type: "battery", count: 8, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "knight", count: 10, gap: 1, delay: 0 }, { type: "ghost", count: 10, gap: 0.9, delay: 3 }, { type: "mole", count: 2, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 12, gap: 1, delay: 0 }, { type: "battery", count: 10, gap: 0.9, delay: 3 }, { type: "blob", count: 4, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 12, gap: 1, delay: 0 }, { type: "ghost", count: 10, gap: 0.9, delay: 3 }, { type: "mole", count: 5, gap: 0.9, delay: 4 }, { type: "slime", count: 2, gap: 0.9, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 14, gap: 1, delay: 0 }, { type: "battery", count: 10, gap: 0.9, delay: 3 }, { type: "ghost", count: 7, gap: 0.9, delay: 4 }, { type: "slime", count: 2, gap: 0.9, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 14, gap: 1, delay: 0 }, { type: "mole", count: 9, gap: 0.9, delay: 3 }, { type: "blob", count: 7, gap: 0.85, delay: 4 }, { type: "hawk", count: 10, gap: 0.3, delay: 2 }, { type: "slime", count: 2, gap: 0.9, delay: 3 }, { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "tinplane", count: 4, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 16, gap: 1, delay: 0 }, { type: "battery", count: 9, gap: 0.9, delay: 3 }, { type: "ghost", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 12, gap: 0.3, delay: 2 }, { type: "slime", count: 3, gap: 0.9, delay: 3 }, { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "tinplane", count: 5, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 19, gap: 1, delay: 0 }, { type: "mole", count: 11, gap: 0.9, delay: 3 }, { type: "blob", count: 9, gap: 0.85, delay: 4 }, { type: "hawk", count: 14, gap: 0.3, delay: 2 }, { type: "slime", count: 3, gap: 0.9, delay: 3 }, { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "tinplane", count: 6, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 22, gap: 1, delay: 0 }, { type: "battery", count: 12, gap: 0.9, delay: 3 }, { type: "ghost", count: 9, gap: 0.9, delay: 4 }, { type: "hawk", count: 15, gap: 0.3, delay: 2 }, { type: "slime", count: 3, gap: 0.9, delay: 3 }, { type: "screw", count: 4, gap: 0.9, delay: 4 }, { type: "tinplane", count: 7, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 27, gap: 1, delay: 0 }, { type: "mole", count: 14, gap: 0.9, delay: 3 }, { type: "blob", count: 11, gap: 0.85, delay: 4 }, { type: "battery", count: 7, gap: 0.9, delay: 5 }, { type: "hawk", count: 20, gap: 0.3, delay: 2 }, { type: "slime", count: 4, gap: 0.9, delay: 3 }, { type: "screw", count: 5, gap: 0.9, delay: 4 }, { type: "tinplane", count: 9, gap: 0.45, delay: 5 } ] },
        { boss: true, groups: [ { type: "ghost", count: 17, gap: 0.6, delay: 0 }, { type: "mole", count: 9, gap: 0.6, delay: 2 }, { type: "thestatic", count: 1, gap: 1, delay: 0 } ] },
      ],
    },
    {
      id: 13,
      name: "Dusty Rafters",
      world: "attic",
      badge: 3,
      startGold: 950,
      budgetBase: 700,
      path: [ [0, 3], [18, 3], [18, 10], [5, 10], [5, 6], [23, 6] ],
      pads: [ { id: "p1", cx: 0, cy: 0 }, { id: "p2", cx: 3, cy: 1 }, { id: "p3", cx: 8, cy: 0 }, { id: "p4", cx: 12, cy: 4 }, { id: "p5", cx: 17, cy: 1 }, { id: "p6", cx: 20, cy: 8 }, { id: "p7", cx: 15, cy: 8 }, { id: "p8", cx: 11, cy: 12 }, { id: "p9", cx: 6, cy: 11 }, { id: "p10", cx: 6, cy: 7 }, { id: "p11", cx: 20, cy: 4 } ],
      waves: [
        { groups: [ { type: "mitten", count: 13, gap: 0.6, delay: 0 }, { type: "knight", count: 4, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "yarn", count: 34, gap: 0.6, delay: 0 }, { type: "blob", count: 7, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "knight", count: 7, gap: 0.6, delay: 0 }, { type: "mitten", count: 15, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "blob", count: 12, gap: 0.6, delay: 0 }, { type: "yarn", count: 40, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "mitten", count: 21, gap: 0.6, delay: 0 }, { type: "knight", count: 7, gap: 0.75, delay: 3 }, { type: "mole", count: 4, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "yarn", count: 53, gap: 0.6, delay: 0 }, { type: "blob", count: 12, gap: 0.75, delay: 3 }, { type: "screw", count: 3, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 8, gap: 0.6, delay: 0 }, { type: "mitten", count: 19, gap: 0.75, delay: 3 }, { type: "ghost", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 15, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "blob", count: 15, gap: 0.6, delay: 0 }, { type: "yarn", count: 46, gap: 0.75, delay: 3 }, { type: "battery", count: 7, gap: 0.9, delay: 4 }, { type: "tinplane", count: 10, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "mitten", count: 28, gap: 0.6, delay: 0 }, { type: "knight", count: 8, gap: 0.75, delay: 3 }, { type: "slime", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 21, gap: 0.35, delay: 2, at: 30 } ] },
        { groups: [ { type: "yarn", count: 69, gap: 0.6, delay: 0 }, { type: "blob", count: 15, gap: 0.75, delay: 3 }, { type: "cushion", count: 6, gap: 0.9, delay: 4 }, { type: "tinplane", count: 13, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "knight", count: 15, gap: 0.6, delay: 0 }, { type: "mitten", count: 30, gap: 0.75, delay: 3 }, { type: "screw", count: 11, gap: 0.9, delay: 4 }, { type: "hawk", count: 29, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "blob", count: 26, gap: 0.6, delay: 0 }, { type: "yarn", count: 78, gap: 0.75, delay: 3 }, { type: "mole", count: 20, gap: 0.9, delay: 4 }, { type: "tinplane", count: 19, gap: 0.35, delay: 2, at: 30 } ] },
        { groups: [ { type: "mitten", count: 54, gap: 0.6, delay: 0 }, { type: "knight", count: 16, gap: 0.75, delay: 3 }, { type: "ghost", count: 27, gap: 0.9, delay: 4 }, { type: "hawk", count: 40, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "yarn", count: 134, gap: 0.6, delay: 0 }, { type: "blob", count: 29, gap: 0.75, delay: 3 }, { type: "battery", count: 25, gap: 0.9, delay: 4 }, { type: "tinplane", count: 26, gap: 0.35, delay: 2 } ] },
      ],
    },
    {
      id: 14,
      name: "Moth Light",
      world: "attic",
      badge: 3,
      startGold: 1100,
      budgetBase: 460,
      path: [ [0, 7], [7, 7], [7, 1], [13, 1], [13, 10], [4, 10], [4, 13], [20, 13], [20, 4], [23, 4] ],
      zones: [ { from: 30, to: 36, mult: 0.75 } ],
      pads: [ { id: "p1", cx: 0, cy: 4 }, { id: "p2", cx: 3, cy: 5 }, { id: "p3", cx: 9, cy: 6 }, { id: "p4", cx: 5, cy: 1 }, { id: "p5", cx: 14, cy: 2 }, { id: "p6", cx: 11, cy: 6 }, { id: "p7", cx: 15, cy: 9 }, { id: "p8", cx: 6, cy: 11 }, { id: "p9", cx: 17, cy: 11 }, { id: "p10", cx: 17, cy: 9 }, { id: "p11", cx: 18, cy: 6 }, { id: "p12", cx: 18, cy: 2 } ],
      waves: [
        { groups: [ { type: "mitten", count: 9, gap: 0.6, delay: 0 }, { type: "knight", count: 3, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "yarn", count: 22, gap: 0.6, delay: 0 }, { type: "blob", count: 5, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "knight", count: 5, gap: 0.6, delay: 0 }, { type: "mitten", count: 9, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "blob", count: 8, gap: 0.6, delay: 0 }, { type: "yarn", count: 26, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "mitten", count: 14, gap: 0.6, delay: 0 }, { type: "knight", count: 4, gap: 0.75, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "yarn", count: 35, gap: 0.6, delay: 0 }, { type: "blob", count: 8, gap: 0.75, delay: 3 }, { type: "mole", count: 3, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 6, gap: 0.6, delay: 0 }, { type: "mitten", count: 11, gap: 0.75, delay: 3 }, { type: "battery", count: 4, gap: 0.9, delay: 4 }, { type: "hawk", count: 10, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.6, delay: 0 }, { type: "yarn", count: 30, gap: 0.75, delay: 3 }, { type: "ghost", count: 5, gap: 0.9, delay: 4 }, { type: "tinplane", count: 6, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "mitten", count: 18, gap: 0.6, delay: 0 }, { type: "knight", count: 6, gap: 0.75, delay: 3 }, { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 14, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "yarn", count: 46, gap: 0.6, delay: 0 }, { type: "blob", count: 10, gap: 0.75, delay: 3 }, { type: "slime", count: 5, gap: 0.9, delay: 4 }, { type: "tinplane", count: 9, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "knight", count: 10, gap: 0.6, delay: 0 }, { type: "mitten", count: 19, gap: 0.75, delay: 3 }, { type: "screw", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 19, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "blob", count: 17, gap: 0.6, delay: 0 }, { type: "yarn", count: 51, gap: 0.75, delay: 3 }, { type: "mole", count: 13, gap: 0.9, delay: 4 }, { type: "tinplane", count: 12, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "mitten", count: 35, gap: 0.6, delay: 0 }, { type: "knight", count: 11, gap: 0.75, delay: 3 }, { type: "battery", count: 14, gap: 0.9, delay: 4 }, { type: "hawk", count: 26, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "yarn", count: 88, gap: 0.6, delay: 0 }, { type: "blob", count: 19, gap: 0.75, delay: 3 }, { type: "ghost", count: 22, gap: 0.9, delay: 4 }, { type: "tinplane", count: 17, gap: 0.35, delay: 2 } ] },
      ],
    },
    {
      id: 15,
      name: "The Old Trunk",
      world: "attic",
      badge: 3,
      startGold: 1000,
      budgetBase: 520,
      // The ATTIC's lever, on slot 3 of 4 — the rhythm World 1 (L3), World 2
      // (L7) and the Garage (L19) already keep. The attic and Moving Day were
      // authored AFTER TD-11's fork search ran and were never swept; re-running
      // it (tools/td-fork-search.js, now in the repo) found both admit one with
      // no pad moved. Default lane 0 is byte-identical to the original `path`,
      // so every winnability sim is untouched — the retrofit is a NOOP until the
      // lever is thrown. Measured payoff: a 9-pad dart build LOSES on the short
      // route on all 4 seeds and WINS on all 4 with the lever thrown.
      paths: [
        [ [0, 11], [4, 11], [4, 2], [10, 2], [10, 9], [16, 9], [16, 2], [21, 2], [21, 12], [23, 12] ],
        [ [0, 11], [4, 11], [4, 2], [10, 2], [10, 9], [12, 9], [12, 0], [15, 0], [15, 9], [16, 9], [16, 2], [21, 2], [21, 12], [23, 12] ],
      ],
      fork: { at: 28 },        // shared-prefix length — where the tracks split
      lever: { cx: 12, cy: 9 }, // send them up and over the trunk instead
      path: [ [0, 11], [4, 11], [4, 2], [10, 2], [10, 9], [16, 9], [16, 2], [21, 2], [21, 12], [23, 12] ],
      pads: [ { id: "p1", cx: 0, cy: 8 }, { id: "p2", cx: 5, cy: 9 }, { id: "p3", cx: 2, cy: 6 }, { id: "p4", cx: 5, cy: 3 }, { id: "p5", cx: 8, cy: 0 }, { id: "p6", cx: 7, cy: 5 }, { id: "p7", cx: 7, cy: 9 }, { id: "p8", cx: 13, cy: 11 }, { id: "p9", cx: 14, cy: 6 , boost: { range: 1.18, rate: 1.15 } }, { id: "p10", cx: 17, cy: 3 }, { id: "p11", cx: 20, cy: 0 }, { id: "p12", cx: 23, cy: 5 }, { id: "p13", cx: 18, cy: 10 } ],
      waves: [
        { groups: [ { type: "mitten", count: 10, gap: 0.6, delay: 0 }, { type: "knight", count: 3, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "yarn", count: 25, gap: 0.6, delay: 0 }, { type: "blob", count: 5, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "knight", count: 5, gap: 0.6, delay: 0 }, { type: "mitten", count: 12, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "blob", count: 9, gap: 0.6, delay: 0 }, { type: "yarn", count: 29, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "mitten", count: 16, gap: 0.6, delay: 0 }, { type: "knight", count: 5, gap: 0.75, delay: 3 }, { type: "mole", count: 3, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "yarn", count: 40, gap: 0.6, delay: 0 }, { type: "blob", count: 9, gap: 0.75, delay: 3 }, { type: "screw", count: 3, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 6, gap: 0.6, delay: 0 }, { type: "mitten", count: 14, gap: 0.75, delay: 3 }, { type: "battery", count: 4, gap: 0.9, delay: 4 }, { type: "hawk", count: 11, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "blob", count: 11, gap: 0.6, delay: 0 }, { type: "yarn", count: 34, gap: 0.75, delay: 3 }, { type: "ghost", count: 6, gap: 0.9, delay: 4 }, { type: "tinplane", count: 7, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "mitten", count: 23, gap: 0.6, delay: 0 }, { type: "knight", count: 7, gap: 0.75, delay: 3 }, { type: "slime", count: 4, gap: 0.9, delay: 4 }, { type: "hawk", count: 15, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "yarn", count: 51, gap: 0.6, delay: 0 }, { type: "blob", count: 11, gap: 0.75, delay: 3 }, { type: "cushion", count: 4, gap: 0.9, delay: 4 }, { type: "tinplane", count: 10, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "knight", count: 11, gap: 0.6, delay: 0 }, { type: "mitten", count: 23, gap: 0.75, delay: 3 }, { type: "screw", count: 8, gap: 0.9, delay: 4 }, { type: "hawk", count: 21, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "blob", count: 19, gap: 0.6, delay: 0 }, { type: "yarn", count: 59, gap: 0.75, delay: 3 }, { type: "mole", count: 15, gap: 0.9, delay: 4 }, { type: "tinplane", count: 14, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "mitten", count: 40, gap: 0.6, delay: 0 }, { type: "knight", count: 12, gap: 0.75, delay: 3 }, { type: "battery", count: 16, gap: 0.9, delay: 4 }, { type: "hawk", count: 30, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "yarn", count: 100, gap: 0.6, delay: 0 }, { type: "blob", count: 22, gap: 0.75, delay: 3 }, { type: "ghost", count: 24, gap: 0.9, delay: 4 }, { type: "tinplane", count: 19, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "knight", count: 21, gap: 0.6, delay: 0 }, { type: "mitten", count: 45, gap: 0.75, delay: 3 }, { type: "cushion", count: 10, gap: 0.9, delay: 4 }, { type: "hawk", count: 42, gap: 0.35, delay: 2 } ] },
      ],
    },
    {
      id: 16,
      name: "Tickmaster",
      world: "attic",
      badge: 3,
      startGold: 1200,
      budgetBase: 600,
      path: [ [0, 2], [20, 2], [20, 7], [4, 7], [4, 12], [23, 12] ],
      pads: [ { id: "p1", cx: 0, cy: 0 }, { id: "p2", cx: 4, cy: 0 }, { id: "p3", cx: 8, cy: 3 }, { id: "p4", cx: 12, cy: 3 }, { id: "p5", cx: 17, cy: 4 }, { id: "p6", cx: 21, cy: 3 }, { id: "p7", cx: 19, cy: 9 }, { id: "p8", cx: 14, cy: 5 }, { id: "p9", cx: 10, cy: 8 }, { id: "p10", cx: 6, cy: 8 }, { id: "p11", cx: 5, cy: 9 }, { id: "p12", cx: 6, cy: 10 }, { id: "p13", cx: 12, cy: 13 }, { id: "p14", cx: 18, cy: 13 } ],
      waves: [
        { groups: [ { type: "mitten", count: 11, gap: 0.6, delay: 0 }, { type: "knight", count: 4, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "yarn", count: 29, gap: 0.6, delay: 0 }, { type: "blob", count: 6, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "knight", count: 6, gap: 0.6, delay: 0 }, { type: "mitten", count: 13, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "blob", count: 11, gap: 0.6, delay: 0 }, { type: "yarn", count: 31, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "mitten", count: 18, gap: 0.6, delay: 0 }, { type: "knight", count: 6, gap: 0.75, delay: 3 }, { type: "screw", count: 3, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "yarn", count: 46, gap: 0.6, delay: 0 }, { type: "blob", count: 10, gap: 0.75, delay: 3 }, { type: "mole", count: 4, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 7, gap: 0.6, delay: 0 }, { type: "mitten", count: 16, gap: 0.75, delay: 3 }, { type: "ghost", count: 6, gap: 0.9, delay: 4 }, { type: "hawk", count: 13, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "blob", count: 13, gap: 0.6, delay: 0 }, { type: "yarn", count: 39, gap: 0.75, delay: 3 }, { type: "battery", count: 6, gap: 0.9, delay: 4 }, { type: "tinplane", count: 8, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "mitten", count: 27, gap: 0.6, delay: 0 }, { type: "knight", count: 8, gap: 0.75, delay: 3 }, { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 18, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "yarn", count: 59, gap: 0.6, delay: 0 }, { type: "blob", count: 13, gap: 0.75, delay: 3 }, { type: "slime", count: 7, gap: 0.9, delay: 4 }, { type: "tinplane", count: 11, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "knight", count: 12, gap: 0.6, delay: 0 }, { type: "mitten", count: 28, gap: 0.75, delay: 3 }, { type: "screw", count: 10, gap: 0.9, delay: 4 }, { type: "hawk", count: 25, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "blob", count: 22, gap: 0.6, delay: 0 }, { type: "yarn", count: 68, gap: 0.75, delay: 3 }, { type: "mole", count: 17, gap: 0.9, delay: 4 }, { type: "tinplane", count: 16, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "mitten", count: 46, gap: 0.6, delay: 0 }, { type: "knight", count: 14, gap: 0.75, delay: 3 }, { type: "ghost", count: 23, gap: 0.9, delay: 4 }, { type: "hawk", count: 34, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "yarn", count: 115, gap: 0.6, delay: 0 }, { type: "blob", count: 25, gap: 0.75, delay: 3 }, { type: "battery", count: 22, gap: 0.9, delay: 4 }, { type: "tinplane", count: 22, gap: 0.35, delay: 2 } ] },
        { boss: true, groups: [ { type: "tickmaster", count: 1, gap: 2, delay: 0 }, { type: "knight", count: 12, gap: 0.8, delay: 4 }, { type: "hawk", count: 14, gap: 0.35, delay: 6 } ] },
      ],
    },
    // ============ WORLD 5 — THE GARAGE (L17-L20) ============
    // The door Josh's toys get carried out of: oil-stained concrete, a workbench
    // strip-light, a lawnmower under a tarp. Colder and harder-edged than the
    // attic's warm brown.
    //
    // Built the way World 4 had to be rebuilt after it was pulled: maps came out
    // of a SEARCH (every pad ≥0.99 cells from EVERY lane, ≥1.4 pairwise, ≥1.9
    // from a lever), waves out of a generator + budget validator (±25% of
    // budgetBase·1.18^n, with a mechanical composition rule — ≥70% of a wave's
    // threat HP is plain backbone and at most ONE disruptive special ≤25%), and
    // every number was tuned against the SHIPPED best-of-two oracle, never a
    // stronger local solver.
    {
      id: 17,
      name: "Oil Slick",
      world: "garage",
      badge: 3,
      startGold: 1150,
      budgetBase: 700,
      // Two spills of dropped oil shove whatever crosses them along — L7's
      // tested speed zone, and it stacks meanly with a slow-immune runner: this
      // is the level that teaches you the Fan cannot hold everything. Kept
      // gentle (1.3, two strips) because a conveyor steals tower UPTIME, which
      // gold cannot buy back — at 1.45 across three strips it held normal fine
      // and made heroic unwinnable on every seed, the same shape as `night`.
      path: [[0, 3], [17, 3], [17, 9], [5, 9], [5, 12], [23, 12]],
      zones: [ { from: 14, to: 19, mult: 1.3 }, { from: 34, to: 39, mult: 1.3 } ],
      pads: [ { id: "p1", cx: 4, cy: 8 }, { id: "p2", cx: 23, cy: 10 }, { id: "p3", cx: 14, cy: 1 }, { id: "p4", cx: 0, cy: 1 }, { id: "p5", cx: 7, cy: 1 }, { id: "p6", cx: 11, cy: 7 }, { id: "p7", cx: 4, cy: 13 }, { id: "p8", cx: 18, cy: 10 }, { id: "p9", cx: 19, cy: 4 }, { id: "p10", cx: 1, cy: 5 }, { id: "p11", cx: 15, cy: 5 }, { id: "p12", cx: 7, cy: 5 } ],
      waves: [
        { groups: [ { type: "rag", count: 14, gap: 0.65, delay: 0 }, { type: "knight", count: 4, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.65, delay: 0 }, { type: "cog", count: 24, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "rag", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 12, gap: 0.65, delay: 0 }, { type: "cog", count: 30, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 3, gap: 0.9, delay: 4 }, { type: "rag", count: 25, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "blob", count: 16, gap: 0.65, delay: 0 }, { type: "cog", count: 40, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "drum", count: 2, gap: 0.9, delay: 4 }, { type: "hawk", count: 8, gap: 0.3, delay: 2 }, { type: "rag", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 11, gap: 0.3, delay: 2 }, { type: "blob", count: 19, gap: 0.65, delay: 0 }, { type: "cog", count: 46, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 8, gap: 0.9, delay: 4 }, { type: "hawk", count: 13, gap: 0.3, delay: 2 }, { type: "rag", count: 37, gap: 0.65, delay: 0 }, { type: "knight", count: 10, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 12, gap: 0.9, delay: 4 }, { type: "hawk", count: 17, gap: 0.3, delay: 2 }, { type: "blob", count: 25, gap: 0.65, delay: 0 }, { type: "cog", count: 62, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "drum", count: 4, gap: 0.9, delay: 4 }, { type: "hawk", count: 22, gap: 0.3, delay: 2 }, { type: "rag", count: 49, gap: 0.65, delay: 0 }, { type: "knight", count: 13, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 10, gap: 0.9, delay: 4 }, { type: "hawk", count: 27, gap: 0.3, delay: 2 }, { type: "blob", count: 32, gap: 0.65, delay: 0 }, { type: "cog", count: 80, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 25, gap: 0.9, delay: 4 }, { type: "hawk", count: 34, gap: 0.3, delay: 2 }, { type: "rag", count: 64, gap: 0.65, delay: 0 }, { type: "knight", count: 16, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "racer", count: 24, gap: 0.9, delay: 4 }, { type: "hawk", count: 43, gap: 0.3, delay: 2 }, { type: "blob", count: 37, gap: 0.65, delay: 0 }, { type: "cog", count: 93, gap: 0.8, delay: 3 } ] },
      ],
    },
    {
      id: 18,
      name: "The Workbench",
      world: "garage",
      badge: 3,
      startGold: 1350,
      budgetBase: 760,
      // No gimmick — a clean board so the spawner mechanic reads. The lane is
      // the world's longest because this level teaches (short paths are HARDER,
      // less tower exposure), but its rows sit 6 apart: the first cut ran four
      // rows 3-4 apart and a tier-3 dart reaches ~4, so ONE tower covered two
      // runs and the level was flawless at 10 pads on heroic.
      path: [[0, 12], [17, 12], [17, 6], [4, 6], [4, 0], [23, 0]],
      zones: [ { from: 3, to: 17, mult: 1, dmg: 0.85 } ], // ⛱️ Blanket Cover — shots land soft over the front of the lane
      pads: [ { id: "p1", cx: 3, cy: 7 }, { id: "p2", cx: 23, cy: 2 }, { id: "p3", cx: 18, cy: 13 }, { id: "p4", cx: 12, cy: 2 }, { id: "p5", cx: 10, cy: 10 }, { id: "p6", cx: 18, cy: 5 }, { id: "p7", cx: 2, cy: 0 , boost: { range: 1.18, rate: 1.15 } }, { id: "p8", cx: 6, cy: 3 }, { id: "p9", cx: 15, cy: 9 }, { id: "p10", cx: 0, cy: 10 }, { id: "p11", cx: 6, cy: 10 }, { id: "p12", cx: 19, cy: 9 } ],
      waves: [
        { groups: [ { type: "rag", count: 16, gap: 0.65, delay: 0 }, { type: "knight", count: 4, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 11, gap: 0.65, delay: 0 }, { type: "cog", count: 26, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "rag", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 13, gap: 0.65, delay: 0 }, { type: "cog", count: 32, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 4, gap: 0.9, delay: 4 }, { type: "rag", count: 26, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bucket", count: 1, gap: 0.9, delay: 4 }, { type: "blob", count: 18, gap: 0.65, delay: 0 }, { type: "cog", count: 45, gap: 0.8, delay: 3, at: 31 } ] },
        { groups: [ { type: "battery", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 9, gap: 0.3, delay: 2 }, { type: "rag", count: 32, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 11, gap: 0.3, delay: 2 }, { type: "blob", count: 21, gap: 0.65, delay: 0 }, { type: "cog", count: 52, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "mole", count: 9, gap: 0.9, delay: 4 }, { type: "hawk", count: 15, gap: 0.3, delay: 2 }, { type: "rag", count: 42, gap: 0.65, delay: 0 }, { type: "knight", count: 10, gap: 0.8, delay: 3, at: 31 } ] },
        { groups: [ { type: "bucket", count: 2, gap: 0.9, delay: 4 }, { type: "hawk", count: 19, gap: 0.3, delay: 2 }, { type: "blob", count: 29, gap: 0.65, delay: 0 }, { type: "cog", count: 72, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 13, gap: 0.9, delay: 4 }, { type: "hawk", count: 23, gap: 0.3, delay: 2 }, { type: "rag", count: 54, gap: 0.65, delay: 0 }, { type: "knight", count: 14, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 11, gap: 0.9, delay: 4 }, { type: "hawk", count: 30, gap: 0.3, delay: 2 }, { type: "blob", count: 34, gap: 0.65, delay: 0 }, { type: "cog", count: 86, gap: 0.8, delay: 3, at: 31 } ] },
        { groups: [ { type: "tinplane", count: 27, gap: 0.9, delay: 4 }, { type: "hawk", count: 37, gap: 0.3, delay: 2 }, { type: "rag", count: 68, gap: 0.65, delay: 0 }, { type: "knight", count: 18, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "bucket", count: 4, gap: 0.9, delay: 4 }, { type: "hawk", count: 46, gap: 0.3, delay: 2 }, { type: "blob", count: 49, gap: 0.65, delay: 0 }, { type: "cog", count: 122, gap: 0.8, delay: 3 } ] },
      ],
    },
    {
      id: 19,
      name: "Two-Car Garage",
      world: "garage",
      badge: 3,
      startGold: 1250,
      budgetBase: 760,
      // The world's routing level. Both lanes share [0,6]→[8,6]; the DEFAULT
      // (lane 0) turns straight up the near bay, the LONG one loops the far bay
      // before rejoining at [8,1]. posAt is identical up to fork.at, so throwing
      // the 🔀 lever reroutes in-flight enemies with no teleport. Every pad was
      // searched against the DEFAULT lane: the first cut spread them over both,
      // so a third of the board only covered the loop nobody was walking (the
      // solver fills in order and lost 11 lives in one wave). The lever's payoff
      // is the tail towers getting far longer on target, exactly as L10's is.
      paths: [
        [[0, 6], [8, 6], [8, 1], [19, 1], [19, 7], [13, 7], [13, 12], [23, 12]],
        [[0, 6], [8, 6], [8, 11], [3, 11], [3, 1], [8, 1], [19, 1], [19, 7], [13, 7], [13, 12], [23, 12]],
      ],
      fork: { at: 8 },
      lever: { cx: 8, cy: 6 },
      pads: [ { id: "p1", cx: 12, cy: 6 }, { id: "p2", cx: 0, cy: 4 }, { id: "p3", cx: 23, cy: 10 }, { id: "p4", cx: 20, cy: 0 }, { id: "p5", cx: 12, cy: 13 }, { id: "p6", cx: 5, cy: 8 }, { id: "p7", cx: 17, cy: 9 }, { id: "p8", cx: 6, cy: 3 }, { id: "p9", cx: 21, cy: 5 }, { id: "p10", cx: 16, cy: 3 }, { id: "p11", cx: 20, cy: 8 }, { id: "p12", cx: 0, cy: 8 }, { id: "p13", cx: 10, cy: 3 } ],
      waves: [
        { groups: [ { type: "rag", count: 16, gap: 0.65, delay: 0 }, { type: "knight", count: 4, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 11, gap: 0.65, delay: 0 }, { type: "cog", count: 26, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "rag", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 3, gap: 0.9, delay: 4 }, { type: "blob", count: 13, gap: 0.65, delay: 0 }, { type: "cog", count: 33, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 3, gap: 0.9, delay: 4 }, { type: "rag", count: 26, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 7, gap: 0.3, delay: 2 }, { type: "blob", count: 16, gap: 0.65, delay: 0 }, { type: "cog", count: 39, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bucket", count: 1, gap: 0.9, delay: 4 }, { type: "hawk", count: 9, gap: 0.3, delay: 2 }, { type: "rag", count: 34, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 6, gap: 0.9, delay: 4 }, { type: "hawk", count: 11, gap: 0.3, delay: 2 }, { type: "blob", count: 21, gap: 0.65, delay: 0 }, { type: "cog", count: 53, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 8, gap: 0.9, delay: 4 }, { type: "hawk", count: 14, gap: 0.3, delay: 2 }, { type: "rag", count: 41, gap: 0.65, delay: 0 }, { type: "knight", count: 11, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 18, gap: 0.3, delay: 2 }, { type: "blob", count: 27, gap: 0.65, delay: 0 }, { type: "cog", count: 67, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "mole", count: 14, gap: 0.9, delay: 4 }, { type: "hawk", count: 23, gap: 0.3, delay: 2 }, { type: "rag", count: 54, gap: 0.65, delay: 0 }, { type: "knight", count: 14, gap: 0.8, delay: 3 } ] },
        // THREAT SHAPE (measured 2026-08). L19 finished 20/20 on all 8 seeds —
        // a formality. `heal` was the one counter shape in the whole roster that
        // appeared on a SINGLE level (L4), and it is a DPS-THRESHOLD shape, not
        // an HP pile, which is why it moves a flat level where gold, budget,
        // lane length and side-door dose are all measured not to. The swap is
        // contract-legal by construction: the wave's ONE special becomes 4
        // healers and the reclaimed HP goes back to the fattest backbone group,
        // so total wave HP, the >=70% backbone share and the <=1-special rule
        // are all preserved. 8 seeds: normal 20x8 -> 20,16,20,20,20,20,20,17;
        // heroic median 15 -> 16 with ZERO losses; dart-mono 19,16,17,18,18,16,
        // 16,19 -> 11,6,9,10,9,11,8,11 (it is the dart swarm this punishes).
        { groups: [ { type: "healer", count: 4, gap: 0.9, delay: 4 }, { type: "hawk", count: 28, gap: 0.3, delay: 2 }, { type: "blob", count: 45, gap: 0.65, delay: 0 }, { type: "cog", count: 104, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "slime", count: 13, gap: 0.9, delay: 4 }, { type: "hawk", count: 35, gap: 0.3, delay: 2 }, { type: "rag", count: 65, gap: 0.65, delay: 0 }, { type: "knight", count: 16, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 25, gap: 0.9, delay: 4 }, { type: "hawk", count: 44, gap: 0.3, delay: 2 }, { type: "blob", count: 46, gap: 0.65, delay: 0 }, { type: "cog", count: 116, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 40, gap: 0.9, delay: 4 }, { type: "hawk", count: 55, gap: 0.3, delay: 2 }, { type: "rag", count: 94, gap: 0.65, delay: 0 }, { type: "knight", count: 23, gap: 0.8, delay: 3 } ] },
      ],
    },
    {
      id: 20,
      name: "The Toolbox Titan",
      world: "garage",
      badge: 3,
      startGold: 1150,
      budgetBase: 700,
      // Everything at once, then the boss.
      path: [[0, 1], [15, 1], [15, 6], [4, 6], [4, 10], [19, 10], [19, 13], [23, 13]],
      // TD-16 🕳️ Mud Patch: the conveyor's data field, mirrored. A stretch
      // where they CRAWL, anchored under p1 so a board that covers it is
      // rewarded — the conveyor is a stretch you wish you could cover, this
      // is one you want to build around.
      zones: [ { from: 28, to: 34, mult: 0.75 } ],
      pads: [ { id: "p1", cx: 3, cy: 5 }, { id: "p2", cx: 23, cy: 11 }, { id: "p3", cx: 16, cy: 0 }, { id: "p4", cx: 12, cy: 12 }, { id: "p5", cx: 16, cy: 7 }, { id: "p6", cx: 3, cy: 11 }, { id: "p7", cx: 10, cy: 3 }, { id: "p8", cx: 8, cy: 8 }, { id: "p9", cx: 20, cy: 9 }, { id: "p10", cx: 17, cy: 13 }, { id: "p11", cx: 7, cy: 12 }, { id: "p12", cx: 12, cy: 8 }, { id: "p13", cx: 0, cy: 3 }, { id: "p14", cx: 6, cy: 3 } ],
      waves: [
        { groups: [ { type: "rag", count: 14, gap: 0.65, delay: 0 }, { type: "knight", count: 4, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.65, delay: 0 }, { type: "cog", count: 24, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "rag", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 12, gap: 0.65, delay: 0 }, { type: "cog", count: 30, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "rag", count: 26, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 4, gap: 0.9, delay: 4 }, { type: "hawk", count: 6, gap: 0.3, delay: 2 }, { type: "blob", count: 15, gap: 0.65, delay: 0 }, { type: "cog", count: 37, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bucket", count: 1, gap: 0.9, delay: 4 }, { type: "hawk", count: 8, gap: 0.3, delay: 2 }, { type: "rag", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 10, gap: 0.3, delay: 2 }, { type: "blob", count: 19, gap: 0.65, delay: 0 }, { type: "cog", count: 47, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 13, gap: 0.3, delay: 2 }, { type: "rag", count: 39, gap: 0.65, delay: 0 }, { type: "knight", count: 10, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 9, gap: 0.9, delay: 4 }, { type: "hawk", count: 17, gap: 0.3, delay: 2 }, { type: "blob", count: 25, gap: 0.65, delay: 0 }, { type: "cog", count: 63, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "mole", count: 13, gap: 0.9, delay: 4 }, { type: "hawk", count: 21, gap: 0.3, delay: 2 }, { type: "rag", count: 49, gap: 0.65, delay: 0 }, { type: "knight", count: 13, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 9, gap: 0.9, delay: 4 }, { type: "hawk", count: 26, gap: 0.3, delay: 2 }, { type: "blob", count: 33, gap: 0.65, delay: 0 }, { type: "cog", count: 83, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "bucket", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 33, gap: 0.3, delay: 2 }, { type: "rag", count: 68, gap: 0.65, delay: 0 }, { type: "knight", count: 17, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 29, gap: 0.9, delay: 4 }, { type: "hawk", count: 41, gap: 0.3, delay: 2 }, { type: "blob", count: 43, gap: 0.65, delay: 0 }, { type: "cog", count: 107, gap: 0.8, delay: 3 } ] },
        { boss: true, groups: [ { type: "knight", count: 14, gap: 0.7, delay: 0 }, { type: "racer", count: 18, gap: 0.5, delay: 2 }, { type: "titan", count: 1, gap: 2, delay: 0 } ] },
      ],
    },
    {
      id: 21,
      name: "Boxes by the Door",
      world: "moving",
      badge: 3,
      startGold: 1275,
      budgetBase: 720,
      // The world opens gently: a long lane with rows 6 apart, so exposure comes
      // from the walk rather than from one tower covering two runs.
      path: [[0, 1], [18, 1], [18, 7], [4, 7], [4, 13], [23, 13]],
      zones: [ { from: 28, to: 34, mult: 0.75 } ],
      pads: [ { id: "p1", cx: 3, cy: 6 }, { id: "p2", cx: 23, cy: 11 }, { id: "p3", cx: 19, cy: 0 }, { id: "p4", cx: 12, cy: 11 }, { id: "p5", cx: 11, cy: 3 }, { id: "p6", cx: 2, cy: 13 }, { id: "p7", cx: 19, cy: 8 }, { id: "p8", cx: 6, cy: 10 }, { id: "p9", cx: 16, cy: 4 }, { id: "p10", cx: 0, cy: 3 }, { id: "p11", cx: 6, cy: 3 }, { id: "p12", cx: 16, cy: 11 } ],
      waves: [
        { groups: [ { type: "wad", count: 14, gap: 0.65, delay: 0 }, { type: "knight", count: 4, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.65, delay: 0 }, { type: "peanut", count: 25, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "wad", count: 22, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 1, gap: 0.9, delay: 4 }, { type: "blob", count: 13, gap: 0.65, delay: 0 }, { type: "peanut", count: 32, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "wad", count: 27, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 3, gap: 0.9, delay: 4 }, { type: "blob", count: 17, gap: 0.65, delay: 0 }, { type: "peanut", count: 42, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 8, gap: 0.3, delay: 2 }, { type: "wad", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 11, gap: 0.3, delay: 2 }, { type: "blob", count: 19, gap: 0.65, delay: 0 }, { type: "peanut", count: 48, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 6, gap: 0.9, delay: 4 }, { type: "hawk", count: 14, gap: 0.3, delay: 2 }, { type: "wad", count: 39, gap: 0.65, delay: 0 }, { type: "knight", count: 10, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 13, gap: 0.9, delay: 4 }, { type: "hawk", count: 18, gap: 0.3, delay: 2 }, { type: "blob", count: 25, gap: 0.65, delay: 0 }, { type: "peanut", count: 63, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 22, gap: 0.3, delay: 2 }, { type: "wad", count: 50, gap: 0.65, delay: 0 }, { type: "knight", count: 13, gap: 0.8, delay: 3 } ] },
        // THREAT-SHAPE dose, and the best one the search found: the slime group
        // is 3 Junk Healers, the reclaimed 845 hp going back to the blob group
        // (33 -> 47), so wave hp moves 0.1% and the >=70% backbone share only
        // rises. L21 was the flattest level in the game — 19 on all EIGHT seeds,
        // spread 0, i.e. a fixed toll no build could change. Now 14-19 (spread
        // 5), 3-star on 4 of 8 rather than 8 of 8, heroic min 3 with no losses
        // (baseline min 7), and it is the one dose that buys real BUILD
        // DIVERSITY: the mixed plan beats a dart-only board on 8 of 8 seeds by
        // 40 lives, where a dart swarm used to be as good as anything.
        { groups: [ { type: "healer", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 28, gap: 0.3, delay: 2 }, { type: "blob", count: 47, gap: 0.65, delay: 0 }, { type: "peanut", count: 83, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 16, gap: 0.9, delay: 4 }, { type: "hawk", count: 35, gap: 0.3, delay: 2 }, { type: "wad", count: 67, gap: 0.65, delay: 0 }, { type: "knight", count: 16, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "bubblewrap", count: 13, gap: 0.9, delay: 4 }, { type: "hawk", count: 44, gap: 0.3, delay: 2 }, { type: "blob", count: 39, gap: 0.65, delay: 0 }, { type: "peanut", count: 97, gap: 0.8, delay: 3 } ] },
      ],
    },
    {
      id: 22,
      name: "Turn It Down",
      world: "moving",
      badge: 3,
      startGold: 1250,
      budgetBase: 740,
      // Teaches the 📻 Boom Box: it never fights, it just makes the wave arrive
      // faster than your board expects. A clean lane so the mechanic reads,
      // and a ⚡ power pad so "which gun answers the music" is a real question.
      path: [[0, 13], [16, 13], [16, 7], [3, 7], [3, 1], [21, 1], [21, 4], [23, 4]],
      pads: [ { id: "p1", cx: 2, cy: 0 }, { id: "p2", cx: 23, cy: 6 }, { id: "p3", cx: 10, cy: 11 }, { id: "p4", cx: 0, cy: 11 }, { id: "p5", cx: 14, cy: 3 }, { id: "p6", cx: 18, cy: 13 }, { id: "p7", cx: 22, cy: 0, boost: { range: 1.18, rate: 1.15 } }, { id: "p8", cx: 7, cy: 5 }, { id: "p9", cx: 17, cy: 6 }, { id: "p10", cx: 2, cy: 8 }, { id: "p11", cx: 20, cy: 5 }, { id: "p12", cx: 5, cy: 11 }, { id: "p13", cx: 14, cy: 9 } ],
      waves: [
        { groups: [ { type: "wad", count: 15, gap: 0.65, delay: 0 }, { type: "knight", count: 4, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.65, delay: 0 }, { type: "peanut", count: 26, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "wad", count: 23, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 13, gap: 0.65, delay: 0 }, { type: "peanut", count: 31, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 4, gap: 0.9, delay: 4 }, { type: "wad", count: 25, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 3, gap: 0.9, delay: 4 }, { type: "blob", count: 17, gap: 0.65, delay: 0 }, { type: "peanut", count: 43, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 9, gap: 0.3, delay: 2 }, { type: "wad", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 11, gap: 0.3, delay: 2 }, { type: "blob", count: 20, gap: 0.65, delay: 0 }, { type: "peanut", count: 52, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 6, gap: 0.9, delay: 4 }, { type: "hawk", count: 14, gap: 0.3, delay: 2 }, { type: "wad", count: 42, gap: 0.65, delay: 0 }, { type: "knight", count: 10, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "mole", count: 11, gap: 0.9, delay: 4 }, { type: "hawk", count: 18, gap: 0.3, delay: 2 }, { type: "blob", count: 26, gap: 0.65, delay: 0 }, { type: "peanut", count: 65, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 13, gap: 0.9, delay: 4 }, { type: "hawk", count: 23, gap: 0.3, delay: 2 }, { type: "wad", count: 53, gap: 0.65, delay: 0 }, { type: "knight", count: 13, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 13, gap: 0.9, delay: 4 }, { type: "hawk", count: 29, gap: 0.3, delay: 2 }, { type: "blob", count: 33, gap: 0.65, delay: 0 }, { type: "peanut", count: 84, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 26, gap: 0.9, delay: 4 }, { type: "hawk", count: 36, gap: 0.3, delay: 2 }, { type: "wad", count: 68, gap: 0.65, delay: 0 }, { type: "knight", count: 17, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "boombox", count: 20, gap: 0.9, delay: 4 }, { type: "hawk", count: 45, gap: 0.3, delay: 2 }, { type: "blob", count: 40, gap: 0.65, delay: 0 }, { type: "peanut", count: 99, gap: 0.8, delay: 3 } ] },
      ],
    },
    {
      id: 23,
      name: "Wrapped Tight",
      world: "moving",
      badge: 3,
      startGold: 1300,
      budgetBase: 700,
      // Teaches the 🧻 Bubble Wrap. The first cut ran a 41-cell lane — by far
      // the shortest in the game — and heroic lost on 3 of 4 seeds and refused
      // to be bought out of it (1300 -> 1600 gold moved nothing, the documented
      // threshold behaviour). Lengthened to 58: short paths are HARDER because
      // exposure is the resource, and padding a dart is bad at needs time to
      // chew through.
      // MOVING DAY's lever, on slot 3 of 4 (the L3/L7/L19 rhythm). This level is
      // also the one §9.1 of PLAN_WORLD_6 records as pinned at 20/20 on normal —
      // it refused every difficulty lever tried, so it is the level in the game
      // that most needed a DECISION rather than a bigger number, and a routing
      // puzzle is exactly that. The detour loops through the empty right-hand
      // quarter. Lane 0 is byte-identical, so the retrofit is a NOOP until the
      // lever is thrown; measured payoff is the widest of any candidate found —
      // a 7-, 8- OR 9-pad build LOSES on the short route on all 4 seeds and WINS
      // on all 4 with the lever thrown.
      paths: [
        [[0, 4], [12, 4], [12, 10], [3, 10], [3, 1], [19, 1]],
        [[0, 4], [12, 4], [12, 5], [23, 5], [23, 9], [12, 9], [12, 10], [3, 10], [3, 1], [19, 1]],
      ],
      fork: { at: 13 },        // shared-prefix length — where the tracks split
      lever: { cx: 12, cy: 5 }, // route them the long way round the boxes
      path: [[0, 4], [12, 4], [12, 10], [3, 10], [3, 1], [19, 1]],
      pads: [ { id: "p1", cx: 2, cy: 0 }, { id: "p2", cx: 20, cy: 2 }, { id: "p3", cx: 10, cy: 12 }, { id: "p4", cx: 2, cy: 11 }, { id: "p5", cx: 13, cy: 3 }, { id: "p6", cx: 7, cy: 6 }, { id: "p7", cx: 0, cy: 6 }, { id: "p8", cx: 14, cy: 8 }, { id: "p9", cx: 13, cy: 11 }, { id: "p10", cx: 6, cy: 12 }, { id: "p11", cx: 20, cy: 0 }, { id: "p12", cx: 10, cy: 8 } ],
      waves: [
        { groups: [ { type: "wad", count: 14, gap: 0.65, delay: 0 }, { type: "knight", count: 4, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.65, delay: 0 }, { type: "peanut", count: 24, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "wad", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 1, gap: 0.9, delay: 4 }, { type: "blob", count: 12, gap: 0.65, delay: 0 }, { type: "peanut", count: 31, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "wad", count: 26, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 2, gap: 0.9, delay: 4 }, { type: "hawk", count: 6, gap: 0.3, delay: 2 }, { type: "blob", count: 15, gap: 0.65, delay: 0 }, { type: "peanut", count: 36, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bucket", count: 1, gap: 0.9, delay: 4 }, { type: "hawk", count: 8, gap: 0.3, delay: 2 }, { type: "wad", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 10, gap: 0.3, delay: 2 }, { type: "blob", count: 19, gap: 0.65, delay: 0 }, { type: "peanut", count: 49, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 13, gap: 0.3, delay: 2 }, { type: "wad", count: 39, gap: 0.65, delay: 0 }, { type: "knight", count: 10, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 17, gap: 0.3, delay: 2 }, { type: "blob", count: 25, gap: 0.65, delay: 0 }, { type: "peanut", count: 63, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 9, gap: 0.9, delay: 4 }, { type: "hawk", count: 21, gap: 0.3, delay: 2 }, { type: "wad", count: 50, gap: 0.65, delay: 0 }, { type: "knight", count: 13, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 8, gap: 0.9, delay: 4 }, { type: "hawk", count: 26, gap: 0.3, delay: 2 }, { type: "blob", count: 33, gap: 0.65, delay: 0 }, { type: "peanut", count: 82, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "slime", count: 12, gap: 0.9, delay: 4 }, { type: "hawk", count: 33, gap: 0.3, delay: 2 }, { type: "wad", count: 58, gap: 0.65, delay: 0 }, { type: "knight", count: 15, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 12, gap: 0.9, delay: 4 }, { type: "hawk", count: 41, gap: 0.3, delay: 2 }, { type: "blob", count: 43, gap: 0.65, delay: 0 }, { type: "peanut", count: 108, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 37, gap: 0.9, delay: 4 }, { type: "hawk", count: 50, gap: 0.3, delay: 2 }, { type: "wad", count: 84, gap: 0.65, delay: 0 }, { type: "knight", count: 22, gap: 0.8, delay: 3 } ] },
      ],
    },
    {
      id: 24,
      name: "The Moving Van",
      world: "moving",
      badge: 3,
      startGold: 1350,
      budgetBase: 760,
      // Everything at once, then the van.
      path: [[0, 2], [14, 2], [14, 8], [3, 8], [3, 13], [20, 13], [20, 9], [23, 9]],
      pads: [ { id: "p1", cx: 2, cy: 7 }, { id: "p2", cx: 23, cy: 11 }, { id: "p3", cx: 15, cy: 1 }, { id: "p4", cx: 12, cy: 11 }, { id: "p5", cx: 6, cy: 0 }, { id: "p6", cx: 19, cy: 8 }, { id: "p7", cx: 1, cy: 13 }, { id: "p8", cx: 8, cy: 6 }, { id: "p9", cx: 0, cy: 0 }, { id: "p10", cx: 6, cy: 11 }, { id: "p11", cx: 15, cy: 9 }, { id: "p12", cx: 12, cy: 4 }, { id: "p13", cx: 11, cy: 0 }, { id: "p14", cx: 16, cy: 5 } ],
      waves: [
        { groups: [ { type: "wad", count: 16, gap: 0.65, delay: 0 }, { type: "knight", count: 4, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 11, gap: 0.65, delay: 0 }, { type: "peanut", count: 26, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "wad", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 1, gap: 0.9, delay: 4 }, { type: "blob", count: 13, gap: 0.65, delay: 0 }, { type: "peanut", count: 34, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 2, gap: 0.9, delay: 4 }, { type: "wad", count: 27, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 7, gap: 0.3, delay: 2 }, { type: "blob", count: 16, gap: 0.65, delay: 0 }, { type: "peanut", count: 39, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bucket", count: 1, gap: 0.9, delay: 4 }, { type: "hawk", count: 9, gap: 0.3, delay: 2 }, { type: "wad", count: 34, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 11, gap: 0.3, delay: 2 }, { type: "blob", count: 21, gap: 0.65, delay: 0 }, { type: "peanut", count: 52, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 6, gap: 0.9, delay: 4 }, { type: "hawk", count: 14, gap: 0.3, delay: 2 }, { type: "wad", count: 42, gap: 0.65, delay: 0 }, { type: "knight", count: 11, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 10, gap: 0.9, delay: 4 }, { type: "hawk", count: 18, gap: 0.3, delay: 2 }, { type: "blob", count: 27, gap: 0.65, delay: 0 }, { type: "peanut", count: 68, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 23, gap: 0.3, delay: 2 }, { type: "wad", count: 54, gap: 0.65, delay: 0 }, { type: "knight", count: 14, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 10, gap: 0.9, delay: 4 }, { type: "hawk", count: 28, gap: 0.3, delay: 2 }, { type: "blob", count: 36, gap: 0.65, delay: 0 }, { type: "peanut", count: 90, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "boombox", count: 16, gap: 0.9, delay: 4 }, { type: "hawk", count: 35, gap: 0.3, delay: 2 }, { type: "wad", count: 65, gap: 0.65, delay: 0 }, { type: "knight", count: 16, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 32, gap: 0.9, delay: 4 }, { type: "hawk", count: 44, gap: 0.3, delay: 2 }, { type: "blob", count: 46, gap: 0.65, delay: 0 }, { type: "peanut", count: 116, gap: 0.8, delay: 3 } ] },
        { boss: true, groups: [ { type: "movingvan", count: 1, gap: 2, delay: 0 }, { type: "knight", count: 14, gap: 0.8, delay: 5 }, { type: "bubblewrap", count: 10, gap: 0.6, delay: 9 }, { type: "hawk", count: 16, gap: 0.35, delay: 14 } ] },
      ],
    },
    // ================= WORLD 7 — 🏠 The New House (L25-L28) =================
    // The van has arrived and the toys are unloaded into a strange, empty,
    // echoey house they now have to make theirs. Deliberately adds ZERO new
    // engine fields: enemyTraits and levelGimmicks already cover everything it
    // ships, so the guide documents it by derivation and the whole risk budget
    // goes into balance. Every lane and pad set was searched against the shipped
    // geometry laws (>=0.99 from EVERY lane, >=1.4 pairwise, >=1.9 from a lever)
    // and every wave table was EMITTED by tools/td-wave-gen.js against both the
    // budget curve and the composition contract.
    {
      id: 25,
      name: "Bare Floorboards",
      world: "newhouse",
      badge: 3,
      startGold: 1075,
      budgetBase: 950,
      // A spiral that winds INWARD before breaking out to the right — a topology
      // no shipped level uses. A freshly-waxed strip of board shoves you along.
      path: [[0, 0], [21, 0], [21, 12], [3, 12], [3, 6], [17, 6], [17, 3], [23, 3]],
      zones: [ { from: 36, to: 42, mult: 1.25 } ],
      pads: [ { id: "p1", cx: 2, cy: 5 }, { id: "p2", cx: 22, cy: 13 }, { id: "p3", cx: 16, cy: 2 }, { id: "p4", cx: 2, cy: 13 }, { id: "p5", cx: 11, cy: 10 }, { id: "p6", cx: 23, cy: 5 }, { id: "p7", cx: 18, cy: 7 }, { id: "p8", cx: 9, cy: 2 }, { id: "p9", cx: 5, cy: 9 }, { id: "p10", cx: 23, cy: 0 }, { id: "p11", cx: 1, cy: 9 }, { id: "p12", cx: 5, cy: 2 } ],
      waves: [
        { groups: [ { type: "chair", count: 20, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 13, gap: 0.65, delay: 0 }, { type: "housekey", count: 33, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "chair", count: 27, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 1, gap: 0.9, delay: 4 }, { type: "blob", count: 17, gap: 0.65, delay: 0 }, { type: "housekey", count: 42, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 3, gap: 0.9, delay: 4 }, { type: "chair", count: 35, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 5, gap: 0.9, delay: 4 }, { type: "blob", count: 22, gap: 0.65, delay: 0 }, { type: "housekey", count: 55, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 11, gap: 0.3, delay: 2 }, { type: "chair", count: 41, gap: 0.65, delay: 0 }, { type: "knight", count: 10, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 6, gap: 0.9, delay: 4 }, { type: "hawk", count: 14, gap: 0.3, delay: 2 }, { type: "blob", count: 26, gap: 0.65, delay: 0 }, { type: "housekey", count: 65, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 18, gap: 0.3, delay: 2 }, { type: "chair", count: 51, gap: 0.65, delay: 0 }, { type: "knight", count: 13, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "ghost", count: 17, gap: 0.9, delay: 4 }, { type: "hawk", count: 23, gap: 0.3, delay: 2 }, { type: "blob", count: 29, gap: 0.65, delay: 0 }, { type: "housekey", count: 74, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bucket", count: 2, gap: 0.9, delay: 4 }, { type: "hawk", count: 29, gap: 0.3, delay: 2 }, { type: "chair", count: 79, gap: 0.65, delay: 0 }, { type: "knight", count: 20, gap: 0.8, delay: 3 } ] },
        // THREAT SHAPE (measured 2026-08), the second of the set, and the one on
        // a NON-FORK level. L19 carries a lever too and kept its dose only
        // because `TD7 lever advantage` was re-run and still passes; L31's
        // identical swap measured beautifully and broke that contract outright
        // (a thin board lost on BOTH routes, so the diversion was worth nothing).
        // A fork level's difficulty IS its lever's value — dose the non-fork ones
        // or re-verify the lever after. 8 seeds: normal 20x8 ->
        // 20,20,16,15,20,20,20,20; heroic median
        // 14 -> 6 with ZERO losses; dart-mono 14,14,14,14,14,13,15,16 ->
        // 8,8,8,8,9,8,11,9. Neglect still loses. It needed x5 where L19 needed
        // x4: the dose is per level, and wave POSITION matters more than either.
        { groups: [ { type: "healer", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 37, gap: 0.3, delay: 2 }, { type: "blob", count: 60, gap: 0.65, delay: 0 }, { type: "housekey", count: 109, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 34, gap: 0.9, delay: 4 }, { type: "hawk", count: 46, gap: 0.3, delay: 2 }, { type: "chair", count: 86, gap: 0.65, delay: 0 }, { type: "knight", count: 22, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "cushion", count: 15, gap: 0.9, delay: 4 }, { type: "hawk", count: 58, gap: 0.3, delay: 2 }, { type: "blob", count: 49, gap: 0.65, delay: 0 }, { type: "housekey", count: 121, gap: 0.8, delay: 3 } ] },
      ],
    },
    {
      id: 26,
      name: "Up the Stairs",
      world: "newhouse",
      badge: 3,
      startGold: 1400,
      budgetBase: 900,
      // Three horizontal runs exactly 6 rows apart, so no tower covers two
      // flights (a tier-3 mortar reaches 4.0). The landing cupboard is a side
      // door at 36 of 61 — 59%, inside the authored 25-62% band.
      path: [[0, 13], [9, 13], [9, 7], [2, 7], [2, 1], [13, 1], [13, 7], [18, 7], [18, 13], [23, 13]],
      zones: [ { from: 3, to: 17, mult: 1, dmg: 0.85 } ], // ⛱️ Blanket Cover — shots land soft over the front of the lane
      pads: [ { id: "p1", cx: 1, cy: 0 }, { id: "p2", cx: 23, cy: 11 }, { id: "p3", cx: 14, cy: 0 }, { id: "p4", cx: 7, cy: 11 }, { id: "p5", cx: 1, cy: 8 }, { id: "p6", cx: 15, cy: 9 }, { id: "p7", cx: 10, cy: 6 }, { id: "p8", cx: 19, cy: 6 }, { id: "p9", cx: 4, cy: 4 }, { id: "p10", cx: 11, cy: 13 }, { id: "p11", cx: 12, cy: 8 }, { id: "p12", cx: 15, cy: 4 }, { id: "p13", cx: 16, cy: 13 } ],
      waves: [
        { groups: [ { type: "chair", count: 18, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 13, gap: 0.65, delay: 0 }, { type: "housekey", count: 31, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "chair", count: 25, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 16, gap: 0.65, delay: 0 }, { type: "housekey", count: 39, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 2, gap: 0.9, delay: 4 }, { type: "chair", count: 32, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 4, gap: 0.9, delay: 4 }, { type: "blob", count: 21, gap: 0.65, delay: 0 }, { type: "housekey", count: 54, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 11, gap: 0.3, delay: 2 }, { type: "chair", count: 38, gap: 0.65, delay: 0 }, { type: "knight", count: 9, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "mole", count: 8, gap: 0.9, delay: 4 }, { type: "hawk", count: 14, gap: 0.3, delay: 2 }, { type: "blob", count: 24, gap: 0.65, delay: 0 }, { type: "housekey", count: 61, gap: 0.8, delay: 3, at: 36 } ] },
        { groups: [ { type: "cushion", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 17, gap: 0.3, delay: 2 }, { type: "chair", count: 49, gap: 0.65, delay: 0 }, { type: "knight", count: 12, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "racer", count: 12, gap: 0.9, delay: 4 }, { type: "hawk", count: 22, gap: 0.3, delay: 2 }, { type: "blob", count: 28, gap: 0.65, delay: 0 }, { type: "housekey", count: 70, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 10, gap: 0.9, delay: 4 }, { type: "hawk", count: 28, gap: 0.3, delay: 2 }, { type: "chair", count: 64, gap: 0.65, delay: 0 }, { type: "knight", count: 16, gap: 0.8, delay: 3, at: 36 } ] },
        { groups: [ { type: "ghost", count: 25, gap: 0.9, delay: 4 }, { type: "hawk", count: 35, gap: 0.3, delay: 2 }, { type: "blob", count: 41, gap: 0.65, delay: 0 }, { type: "housekey", count: 103, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 32, gap: 0.9, delay: 4 }, { type: "hawk", count: 44, gap: 0.3, delay: 2 }, { type: "chair", count: 81, gap: 0.65, delay: 0 }, { type: "knight", count: 21, gap: 0.8, delay: 3, at: 36 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "bucket", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 55, gap: 0.3, delay: 2 }, { type: "blob", count: 54, gap: 0.65, delay: 0 }, { type: "housekey", count: 135, gap: 0.8, delay: 3, at: 36 } ] },
      ],
    },
    {
      id: 27,
      name: "The Swinging Door",
      world: "newhouse",
      badge: 3,
      startGold: 1200,
      budgetBase: 900,
      // The world's one fork + lever (a guardrail requires exactly one per
      // world). Prop the kitchen door open and the traffic goes the long way
      // round the island: 40 cells becomes 52, a 1.30x gain.
      paths: [
        [[0, 1], [6, 1], [6, 6], [16, 6], [16, 1], [21, 1], [21, 8], [23, 8]],
        [[0, 1], [6, 1], [6, 6], [9, 6], [9, 12], [15, 12], [15, 6], [16, 6], [16, 1], [21, 1], [21, 8], [23, 8]],
      ],
      fork: { at: 14 },
      lever: { cx: 9, cy: 6 },
      pads: [ { id: "p1", cx: 5, cy: 7 }, { id: "p2", cx: 22, cy: 0 }, { id: "p3", cx: 20, cy: 9 }, { id: "p4", cx: 7, cy: 0 }, { id: "p5", cx: 15, cy: 0 }, { id: "p6", cx: 12, cy: 8 }, { id: "p7", cx: 0, cy: 3 }, { id: "p8", cx: 17, cy: 7 }, { id: "p9", cx: 23, cy: 5 }, { id: "p10", cx: 9, cy: 4 }, { id: "p11", cx: 19, cy: 3 }, { id: "p12", cx: 14, cy: 4 }, { id: "p13", cx: 4, cy: 3 } ],
      waves: [
        { groups: [ { type: "chair", count: 18, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 13, gap: 0.65, delay: 0 }, { type: "housekey", count: 31, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "chair", count: 25, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 16, gap: 0.65, delay: 0 }, { type: "housekey", count: 40, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 2, gap: 0.9, delay: 4 }, { type: "chair", count: 31, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 22, gap: 0.65, delay: 0 }, { type: "housekey", count: 54, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 10, gap: 0.3, delay: 2 }, { type: "chair", count: 38, gap: 0.65, delay: 0 }, { type: "knight", count: 10, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bucket", count: 1, gap: 0.9, delay: 4 }, { type: "hawk", count: 13, gap: 0.3, delay: 2 }, { type: "blob", count: 27, gap: 0.65, delay: 0 }, { type: "housekey", count: 68, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 17, gap: 0.3, delay: 2 }, { type: "chair", count: 49, gap: 0.65, delay: 0 }, { type: "knight", count: 13, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "screw", count: 9, gap: 0.9, delay: 4 }, { type: "hawk", count: 21, gap: 0.3, delay: 2 }, { type: "blob", count: 28, gap: 0.65, delay: 0 }, { type: "housekey", count: 71, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 15, gap: 0.9, delay: 4 }, { type: "hawk", count: 27, gap: 0.3, delay: 2 }, { type: "chair", count: 66, gap: 0.65, delay: 0 }, { type: "knight", count: 16, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 24, gap: 0.9, delay: 4 }, { type: "hawk", count: 34, gap: 0.3, delay: 2 }, { type: "blob", count: 42, gap: 0.65, delay: 0 }, { type: "housekey", count: 105, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 15, gap: 0.9, delay: 4 }, { type: "hawk", count: 42, gap: 0.3, delay: 2 }, { type: "chair", count: 86, gap: 0.65, delay: 0 }, { type: "knight", count: 21, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "mole", count: 32, gap: 0.9, delay: 4 }, { type: "hawk", count: 52, gap: 0.3, delay: 2 }, { type: "blob", count: 55, gap: 0.65, delay: 0 }, { type: "housekey", count: 137, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "bubblewrap", count: 20, gap: 0.9, delay: 4 }, { type: "hawk", count: 65, gap: 0.3, delay: 2 }, { type: "chair", count: 96, gap: 0.65, delay: 0 }, { type: "knight", count: 24, gap: 0.8, delay: 3 } ] },
      ],
    },
    {
      id: 28,
      name: "The Housedog",
      world: "newhouse",
      badge: 3,
      startGold: 1500,
      budgetBase: 1050,
      // No gimmick: the boss IS the declared hook. Forcing a mechanic onto a
      // finale is measurably destructive (L4+night loses every heroic seed).
      path: [[0, 2], [11, 2], [11, 8], [3, 8], [3, 13], [18, 13], [18, 7], [23, 7]],
      pads: [ { id: "p1", cx: 2, cy: 7 }, { id: "p2", cx: 23, cy: 5 }, { id: "p3", cx: 12, cy: 1 }, { id: "p4", cx: 14, cy: 11 }, { id: "p5", cx: 17, cy: 6 }, { id: "p6", cx: 0, cy: 0 }, { id: "p7", cx: 7, cy: 11 }, { id: "p8", cx: 20, cy: 13 }, { id: "p9", cx: 1, cy: 13 }, { id: "p10", cx: 6, cy: 0 }, { id: "p11", cx: 9, cy: 6 }, { id: "p12", cx: 12, cy: 9 }, { id: "p13", cx: 5, cy: 4 }, { id: "p14", cx: 13, cy: 5 } ],
      waves: [
        { groups: [ { type: "chair", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 15, gap: 0.65, delay: 0 }, { type: "housekey", count: 37, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "chair", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 19, gap: 0.65, delay: 0 }, { type: "housekey", count: 46, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 2, gap: 0.9, delay: 4 }, { type: "chair", count: 37, gap: 0.65, delay: 0 }, { type: "knight", count: 10, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 3, gap: 0.9, delay: 4 }, { type: "blob", count: 25, gap: 0.65, delay: 0 }, { type: "housekey", count: 63, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 12, gap: 0.3, delay: 2 }, { type: "chair", count: 45, gap: 0.65, delay: 0 }, { type: "knight", count: 11, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 6, gap: 0.9, delay: 4 }, { type: "hawk", count: 16, gap: 0.3, delay: 2 }, { type: "blob", count: 29, gap: 0.65, delay: 0 }, { type: "housekey", count: 72, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 11, gap: 0.9, delay: 4 }, { type: "hawk", count: 20, gap: 0.3, delay: 2 }, { type: "chair", count: 57, gap: 0.65, delay: 0 }, { type: "knight", count: 15, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "racer", count: 14, gap: 0.9, delay: 4 }, { type: "hawk", count: 26, gap: 0.3, delay: 2 }, { type: "blob", count: 33, gap: 0.65, delay: 0 }, { type: "housekey", count: 83, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 23, gap: 0.9, delay: 4 }, { type: "hawk", count: 32, gap: 0.3, delay: 2 }, { type: "chair", count: 75, gap: 0.65, delay: 0 }, { type: "knight", count: 19, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bucket", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 41, gap: 0.3, delay: 2 }, { type: "blob", count: 56, gap: 0.65, delay: 0 }, { type: "housekey", count: 141, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 37, gap: 0.9, delay: 4 }, { type: "hawk", count: 51, gap: 0.3, delay: 2 }, { type: "chair", count: 97, gap: 0.65, delay: 0 }, { type: "knight", count: 24, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "boombox", count: 28, gap: 0.9, delay: 4 }, { type: "hawk", count: 64, gap: 0.3, delay: 2 }, { type: "blob", count: 54, gap: 0.65, delay: 0 }, { type: "housekey", count: 135, gap: 0.8, delay: 3 } ] },
        { boss: true, groups: [ { type: "cushion", count: 12, gap: 0.8, delay: 0 }, { type: "boombox", count: 6, gap: 1, delay: 3 }, { type: "hawk", count: 16, gap: 0.35, delay: 6 }, { type: "housedog", count: 1, gap: 1, delay: 2 } ] },
      ],
    },

    // ================= WORLD 8 — ♻️ The Sort Line (L29-L32) =================
    // A recycling-and-salvage sorting plant: the box that never got unpacked in
    // the New House went out with the recycling. The toys' last stand before the
    // crusher. Its crowd is TRASH rather than toys, and it carries the
    // campaign's first EXCLUSIVE flier — measured as the single cheapest
    // differentiation lever left (worst world-pair cosine 0.688 -> 0.428).
    {
      id: 29,
      name: "The Tipping Floor",
      world: "sortline",
      badge: 3,
      startGold: 1350,
      budgetBase: 950,
      // Hook: a burst bag of gunk on the tipping floor (mud patch).
      path: [[0, 1], [19, 1], [19, 7], [4, 7], [4, 13], [23, 13]],
      zones: [ { from: 30, to: 38, mult: 0.75 } ],
      pads: [ { id: "p1", cx: 3, cy: 6 }, { id: "p2", cx: 23, cy: 11 }, { id: "p3", cx: 20, cy: 0 }, { id: "p4", cx: 12, cy: 11 }, { id: "p5", cx: 11, cy: 3 }, { id: "p6", cx: 2, cy: 13 }, { id: "p7", cx: 20, cy: 8 }, { id: "p8", cx: 6, cy: 10 }, { id: "p9", cx: 16, cy: 3 }, { id: "p10", cx: 0, cy: 3 }, { id: "p11", cx: 6, cy: 3 }, { id: "p12", cx: 17, cy: 11 }, { id: "p13", cx: 21, cy: 4 } ],
      waves: [
        { groups: [ { type: "carton", count: 20, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 13, gap: 0.65, delay: 0 }, { type: "clip", count: 33, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "carton", count: 27, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 1, gap: 0.9, delay: 4 }, { type: "blob", count: 17, gap: 0.65, delay: 0 }, { type: "clip", count: 42, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "carton", count: 34, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 6, gap: 0.9, delay: 4 }, { type: "blob", count: 22, gap: 0.65, delay: 0 }, { type: "clip", count: 56, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 3, gap: 0.9, delay: 4 }, { type: "leaflet", count: 11, gap: 0.3, delay: 2 }, { type: "carton", count: 41, gap: 0.65, delay: 0 }, { type: "knight", count: 10, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 8, gap: 0.9, delay: 4 }, { type: "leaflet", count: 14, gap: 0.3, delay: 2 }, { type: "blob", count: 26, gap: 0.65, delay: 0 }, { type: "clip", count: 65, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 7, gap: 0.9, delay: 4 }, { type: "leaflet", count: 18, gap: 0.3, delay: 2 }, { type: "carton", count: 51, gap: 0.65, delay: 0 }, { type: "knight", count: 13, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "ghost", count: 17, gap: 0.9, delay: 4 }, { type: "leaflet", count: 23, gap: 0.3, delay: 2 }, { type: "blob", count: 29, gap: 0.65, delay: 0 }, { type: "clip", count: 74, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 8, gap: 0.9, delay: 4 }, { type: "leaflet", count: 29, gap: 0.3, delay: 2 }, { type: "carton", count: 67, gap: 0.65, delay: 0 }, { type: "knight", count: 17, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 21, gap: 0.9, delay: 4 }, { type: "leaflet", count: 37, gap: 0.3, delay: 2 }, { type: "blob", count: 43, gap: 0.65, delay: 0 }, { type: "clip", count: 109, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 34, gap: 0.9, delay: 4 }, { type: "leaflet", count: 46, gap: 0.3, delay: 2 }, { type: "carton", count: 86, gap: 0.65, delay: 0 }, { type: "knight", count: 22, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "bubblewrap", count: 18, gap: 0.9, delay: 4 }, { type: "leaflet", count: 58, gap: 0.3, delay: 2 }, { type: "blob", count: 48, gap: 0.65, delay: 0 }, { type: "clip", count: 119, gap: 0.8, delay: 3 } ] },
      ],
    },
    {
      id: 30,
      name: "Picking Station",
      world: "sortline",
      badge: 3,
      // 8-SEED SWEEP 2026-07: this shipped at 1450 and LOST on heroic seed 5 —
      // "every level winnable on heroic" is a contract, and `AUDIT heroic is a
      // SLOPE` drives seed 7 only, so it passed green. Swept 1450/1600/1750/1900
      // (all still lose that seed) → 2050 clears every seed with a floor of 6.
      // Normal is unmoved because it is already capped (20 on 7 of 8 seeds); see
      // the formality note on the waves below.
      startGold: 2050,
      budgetBase: 1000,
      // Hook: a live socket on the sorting rig (power pad on p5). Its air
      // pressure starts a wave EARLIER than its siblings — the Loose Leaf is the
      // world's own flier, so this is the level that teaches it.
      path: [[0, 13], [17, 13], [17, 7], [3, 7], [3, 1], [21, 1], [21, 5], [23, 5]],
      pads: [ { id: "p1", cx: 2, cy: 0 }, { id: "p2", cx: 23, cy: 7 }, { id: "p3", cx: 10, cy: 11 }, { id: "p4", cx: 0, cy: 11 }, { id: "p5", cx: 14, cy: 3, boost: { range: 1.18, rate: 1.15 } }, { id: "p6", cx: 22, cy: 0 }, { id: "p7", cx: 19, cy: 13 }, { id: "p8", cx: 7, cy: 5 }, { id: "p9", cx: 18, cy: 6 }, { id: "p10", cx: 2, cy: 8 }, { id: "p11", cx: 15, cy: 10 }, { id: "p12", cx: 5, cy: 11 }, { id: "p13", cx: 1, cy: 4 } ],
      waves: [
        { groups: [ { type: "carton", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 14, gap: 0.65, delay: 0 }, { type: "clip", count: 35, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "carton", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 17, gap: 0.65, delay: 0 }, { type: "clip", count: 44, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 2, gap: 0.9, delay: 4 }, { type: "carton", count: 37, gap: 0.65, delay: 0 }, { type: "knight", count: 9, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 2, gap: 0.9, delay: 4 }, { type: "leaflet", count: 9, gap: 0.3, delay: 2 }, { type: "blob", count: 21, gap: 0.65, delay: 0 }, { type: "clip", count: 53, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 6, gap: 0.9, delay: 4 }, { type: "leaflet", count: 12, gap: 0.3, delay: 2 }, { type: "carton", count: 42, gap: 0.65, delay: 0 }, { type: "knight", count: 11, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 8, gap: 0.9, delay: 4 }, { type: "leaflet", count: 15, gap: 0.3, delay: 2 }, { type: "blob", count: 27, gap: 0.65, delay: 0 }, { type: "clip", count: 69, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "mole", count: 11, gap: 0.9, delay: 4 }, { type: "leaflet", count: 19, gap: 0.3, delay: 2 }, { type: "carton", count: 56, gap: 0.65, delay: 0 }, { type: "knight", count: 14, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "bucket", count: 2, gap: 0.9, delay: 4 }, { type: "leaflet", count: 24, gap: 0.3, delay: 2 }, { type: "blob", count: 36, gap: 0.65, delay: 0 }, { type: "clip", count: 90, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 21, gap: 0.9, delay: 4 }, { type: "leaflet", count: 30, gap: 0.3, delay: 2 }, { type: "carton", count: 74, gap: 0.65, delay: 0 }, { type: "knight", count: 18, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 11, gap: 0.9, delay: 4 }, { type: "leaflet", count: 37, gap: 0.3, delay: 2 }, { type: "blob", count: 47, gap: 0.65, delay: 0 }, { type: "clip", count: 119, gap: 0.8, delay: 3 } ] },
        // THREAT SHAPE (measured 2026-08), the third dose, and the one that only
        // turned up once the search covered every (wave, dose) instead of three
        // sampled waves. L30 was REJECTED earlier at w12 x3 — heroic fell to a
        // minimum of 1, a coin flip rather than difficulty — and w13 x5 is the
        // same level made to bite with a comfortable margin instead. 8 seeds:
        // normal 20x8 -> 19,18,16,20,20,19,20,20; heroic 12,14,5,8,9,6,8,11
        // (minimum 5, ZERO losses); neglect still loses. WAVE POSITION beat dose
        // again, which is now the rule rather than the observation.
        { groups: [ { type: "healer", count: 3, gap: 0.9, delay: 4 }, { type: "leaflet", count: 47, gap: 0.3, delay: 2 }, { type: "carton", count: 141, gap: 0.65, delay: 0 }, { type: "knight", count: 24, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 26, gap: 0.9, delay: 4 }, { type: "leaflet", count: 58, gap: 0.3, delay: 2 }, { type: "blob", count: 61, gap: 0.65, delay: 0 }, { type: "clip", count: 152, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "cushion", count: 19, gap: 0.9, delay: 4 }, { type: "leaflet", count: 72, gap: 0.3, delay: 2 }, { type: "carton", count: 110, gap: 0.65, delay: 0 }, { type: "knight", count: 27, gap: 0.8, delay: 3 } ] },
      ],
    },
    {
      id: 31,
      name: "The Sorter Arm",
      world: "sortline",
      badge: 3,
      // FORMALITY ON NORMAL, and it is DELIBERATE — recorded so the dead end is
      // not re-walked. This finishes 20/20 on normal across 8 seeds (heroic
      // median 13, no losses), which is the class CLAUDE.md broke its own +/-2
      // rule to fix on L13. Gold cannot help (already capped) and the only lever
      // this engine responds to is threat shape — so a 🚪 side door was measured
      // at three doses: normal stayed pinned at 20 at EVERY dose, while the doses
      // large enough to matter took heroic to LOSING 3 of 8 seeds. That is the
      // threshold domination this project has now measured on five levels: a
      // board holds a wave completely or collapses. Its real interest is the
      // lever (proven decisive at a 9-pad board), not its margin.
      startGold: 1400,
      budgetBase: 1000,
      // Hook: the diverter that decides which chute — the world's one fork +
      // lever. 53 cells becomes 67, a 1.26x gain; the lanes coincide to the
      // fork and diverge after it, so throwing it reroutes in-flight traffic
      // with no teleport.
      paths: [
        [[0, 7], [8, 7], [8, 1], [19, 1], [19, 7], [13, 7], [13, 13], [23, 13]],
        [[0, 7], [8, 7], [8, 1], [19, 1], [23, 1], [23, 10], [19, 10], [19, 7], [13, 7], [13, 13], [23, 13]],
      ],
      fork: { at: 25 },
      lever: { cx: 19, cy: 1 },
      pads: [ { id: "p1", cx: 7, cy: 0 }, { id: "p2", cx: 21, cy: 7 }, { id: "p3", cx: 11, cy: 13 }, { id: "p4", cx: 0, cy: 9 }, { id: "p5", cx: 12, cy: 6 }, { id: "p6", cx: 6, cy: 9 }, { id: "p7", cx: 17, cy: 3 }, { id: "p8", cx: 17, cy: 11 }, { id: "p9", cx: 3, cy: 5 }, { id: "p10", cx: 9, cy: 8 }, { id: "p11", cx: 21, cy: 3 }, { id: "p12", cx: 10, cy: 3 } ],
      waves: [
        { groups: [ { type: "carton", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 14, gap: 0.65, delay: 0 }, { type: "clip", count: 35, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "carton", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 4, gap: 0.9, delay: 4 }, { type: "blob", count: 17, gap: 0.65, delay: 0 }, { type: "clip", count: 43, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 2, gap: 0.9, delay: 4 }, { type: "carton", count: 36, gap: 0.65, delay: 0 }, { type: "knight", count: 9, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 24, gap: 0.65, delay: 0 }, { type: "clip", count: 60, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 6, gap: 0.9, delay: 4 }, { type: "leaflet", count: 12, gap: 0.3, delay: 2 }, { type: "carton", count: 42, gap: 0.65, delay: 0 }, { type: "knight", count: 11, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 6, gap: 0.9, delay: 4 }, { type: "leaflet", count: 15, gap: 0.3, delay: 2 }, { type: "blob", count: 28, gap: 0.65, delay: 0 }, { type: "clip", count: 68, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 8, gap: 0.9, delay: 4 }, { type: "leaflet", count: 19, gap: 0.3, delay: 2 }, { type: "carton", count: 55, gap: 0.65, delay: 0 }, { type: "knight", count: 14, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "slime", count: 8, gap: 0.9, delay: 4 }, { type: "leaflet", count: 24, gap: 0.3, delay: 2 }, { type: "blob", count: 32, gap: 0.65, delay: 0 }, { type: "clip", count: 81, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 17, gap: 0.9, delay: 4 }, { type: "leaflet", count: 30, gap: 0.3, delay: 2 }, { type: "carton", count: 73, gap: 0.65, delay: 0 }, { type: "knight", count: 18, gap: 0.8, delay: 3 } ] },
        // REVERTED (2026-08). This wave took the same healer swap as L19 w12 and
        // measured beautifully in isolation — normal 20x8 -> 20,14,17,20,20,20,
        // 15,14, heroic zero losses, dart-mono nearly halved — and it still
        // broke the build, because **L31 CARRIES A LEVER**. `TD7 lever advantage`
        // requires a thin 9-pad board to LOSE on the short route and WIN with the
        // diversion thrown; making the level harder made that board lose on BOTH
        // routes (short 0 -> lever 2, against a >=6 contract), so the lever
        // stopped being worth anything. A difficulty change on a fork level is
        // therefore also a change to that fork's reason to exist. Five of the
        // twelve flat levels are forks (L7, L19, L23, L27, L31) — dose the
        // non-fork ones, or re-verify the lever after.
        { groups: [ { type: "tinplane", count: 27, gap: 0.9, delay: 4 }, { type: "leaflet", count: 37, gap: 0.3, delay: 2 }, { type: "blob", count: 47, gap: 0.65, delay: 0 }, { type: "clip", count: 117, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "mole", count: 28, gap: 0.9, delay: 4 }, { type: "leaflet", count: 47, gap: 0.3, delay: 2 }, { type: "carton", count: 94, gap: 0.65, delay: 0 }, { type: "knight", count: 24, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bucket", count: 5, gap: 0.9, delay: 4 }, { type: "leaflet", count: 58, gap: 0.3, delay: 2 }, { type: "blob", count: 71, gap: 0.65, delay: 0 }, { type: "clip", count: 178, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "ghost", count: 52, gap: 0.9, delay: 4 }, { type: "leaflet", count: 72, gap: 0.3, delay: 2 }, { type: "carton", count: 110, gap: 0.65, delay: 0 }, { type: "knight", count: 27, gap: 0.8, delay: 3 } ] },
      ],
    },
    {
      id: 32,
      name: "The Big Magnet",
      world: "sortline",
      badge: 3,
      startGold: 1800,
      budgetBase: 1050,
      // The campaign's last level. No gimmick — the boss IS the hook.
      path: [[0, 3], [18, 3], [18, 9], [2, 9], [2, 13], [21, 13], [21, 10], [23, 10]],
      pads: [ { id: "p1", cx: 1, cy: 8 }, { id: "p2", cx: 23, cy: 13 }, { id: "p3", cx: 14, cy: 1 }, { id: "p4", cx: 11, cy: 11 }, { id: "p5", cx: 5, cy: 1 }, { id: "p6", cx: 20, cy: 6 }, { id: "p7", cx: 17, cy: 11 }, { id: "p8", cx: 19, cy: 2 }, { id: "p9", cx: 7, cy: 7 }, { id: "p10", cx: 0, cy: 13 }, { id: "p11", cx: 0, cy: 1 }, { id: "p12", cx: 14, cy: 7 }, { id: "p13", cx: 20, cy: 9 }, { id: "p14", cx: 5, cy: 11 } ],
      waves: [
        { groups: [ { type: "carton", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 15, gap: 0.65, delay: 0 }, { type: "clip", count: 37, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "carton", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 18, gap: 0.65, delay: 0 }, { type: "clip", count: 44, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 2, gap: 0.9, delay: 4 }, { type: "carton", count: 38, gap: 0.65, delay: 0 }, { type: "knight", count: 9, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 5, gap: 0.9, delay: 4 }, { type: "blob", count: 25, gap: 0.65, delay: 0 }, { type: "clip", count: 62, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 4, gap: 0.9, delay: 4 }, { type: "leaflet", count: 12, gap: 0.3, delay: 2 }, { type: "carton", count: 46, gap: 0.65, delay: 0 }, { type: "knight", count: 11, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 11, gap: 0.9, delay: 4 }, { type: "leaflet", count: 16, gap: 0.3, delay: 2 }, { type: "blob", count: 28, gap: 0.65, delay: 0 }, { type: "clip", count: 72, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 8, gap: 0.9, delay: 4 }, { type: "leaflet", count: 20, gap: 0.3, delay: 2 }, { type: "carton", count: 57, gap: 0.65, delay: 0 }, { type: "knight", count: 15, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "racer", count: 14, gap: 0.9, delay: 4 }, { type: "leaflet", count: 26, gap: 0.3, delay: 2 }, { type: "blob", count: 33, gap: 0.65, delay: 0 }, { type: "clip", count: 83, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bucket", count: 3, gap: 0.9, delay: 4 }, { type: "leaflet", count: 32, gap: 0.3, delay: 2 }, { type: "carton", count: 84, gap: 0.65, delay: 0 }, { type: "knight", count: 21, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 29, gap: 0.9, delay: 4 }, { type: "leaflet", count: 41, gap: 0.3, delay: 2 }, { type: "blob", count: 48, gap: 0.65, delay: 0 }, { type: "clip", count: 121, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 23, gap: 0.9, delay: 4 }, { type: "leaflet", count: 51, gap: 0.3, delay: 2 }, { type: "carton", count: 96, gap: 0.65, delay: 0 }, { type: "knight", count: 24, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "cushion", count: 17, gap: 0.9, delay: 4 }, { type: "leaflet", count: 64, gap: 0.3, delay: 2 }, { type: "blob", count: 54, gap: 0.65, delay: 0 }, { type: "clip", count: 135, gap: 0.8, delay: 3 } ] },
        { boss: true, groups: [ { type: "bigmagnet", count: 1, gap: 2, delay: 0 }, { type: "cushion", count: 10, gap: 0.7, delay: 5 }, { type: "slime", count: 10, gap: 0.7, delay: 10 }, { type: "leaflet", count: 18, gap: 0.35, delay: 15 } ] },
      ],
    },


    // ================= World 9 — 🏭 The Toy Works (L33-L36) =================
    // The loop closes: the step after being sorted is the factory that melts
    // you down and moulds the NEXT toy. Lanes and pads are OUTPUT from
    // `W9=1 node tools/td-map-search.js` — every one satisfies the four
    // geometry laws (>=0.99 from EVERY lane, >=1.4 pairwise, >=1.9 from a
    // lever, <=BAND from the lane it must cover). Waves are OUTPUT from
    // tools/td-wave-gen.js against both contracts. Nothing here was typed by
    // hand, which is the whole point: authored coordinates and authored waves
    // get the same programmatic truth-check.
    {
      id: 33, name: "The Intake", world: "toyworks", badge: 3,
      // 🚪 the INTAKE hopper: part of each late wave is fed onto the line 30
      // cells down, behind anything built at the entrance. Thematic and the
      // right direction — a door is measured at -1 to -5 lives.
      startGold: 1250, budgetBase: 1000,
      path: [ [0, 2], [19, 2], [19, 8], [4, 8], [4, 12], [23, 12] ],
      pads: [ { id: "p1", cx: 3, cy: 7 }, { id: "p2", cx: 23, cy: 10 }, { id: "p3", cx: 14, cy: 0 }, { id: "p4", cx: 13, cy: 10 }, { id: "p5", cx: 20, cy: 1 }, { id: "p6", cx: 3, cy: 13 }, { id: "p7", cx: 0, cy: 0 }, { id: "p8", cx: 7, cy: 0 }, { id: "p9", cx: 9, cy: 6 }, { id: "p10", cx: 17, cy: 6 }, { id: "p11", cx: 20, cy: 9 }, { id: "p12", cx: 7, cy: 10 } ],
      waves: [
        { groups: [ { type: "reject", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 14, gap: 0.65, delay: 0 }, { type: "pellet", count: 35, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "reject", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 1, gap: 0.9, delay: 4 }, { type: "blob", count: 18, gap: 0.65, delay: 0 }, { type: "pellet", count: 45, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "reject", count: 35, gap: 0.65, delay: 0 }, { type: "knight", count: 9, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 5, gap: 0.9, delay: 4 }, { type: "blob", count: 23, gap: 0.65, delay: 0 }, { type: "pellet", count: 59, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "offcut", count: 12, gap: 0.3, delay: 2 }, { type: "reject", count: 41, gap: 0.65, delay: 0 }, { type: "knight", count: 11, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 11, gap: 0.9, delay: 4 }, { type: "offcut", count: 15, gap: 0.3, delay: 2 }, { type: "blob", count: 27, gap: 0.65, delay: 0 }, { type: "pellet", count: 68, gap: 0.8, delay: 3, at: 30 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "screw", count: 8, gap: 0.9, delay: 4 }, { type: "offcut", count: 19, gap: 0.3, delay: 2 }, { type: "reject", count: 48, gap: 0.65, delay: 0 }, { type: "knight", count: 12, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 7, gap: 0.9, delay: 4 }, { type: "offcut", count: 24, gap: 0.3, delay: 2 }, { type: "blob", count: 36, gap: 0.65, delay: 0 }, { type: "pellet", count: 90, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 17, gap: 0.9, delay: 4 }, { type: "offcut", count: 31, gap: 0.3, delay: 2 }, { type: "reject", count: 72, gap: 0.65, delay: 0 }, { type: "knight", count: 18, gap: 0.8, delay: 3, at: 30 } ] },
        // THREAT-SHAPE dose: the slime group is 3 Junk Healers, and the 1285 hp
        // that reclaims goes back to the blob group (46 -> 67), so the wave's
        // total hp moves 7294 -> 7269 (0.3%, well inside the +/-25% budget
        // contract) and the >=70% backbone share only rises, to 96.5%. L33
        // finished 19-20 on all eight seeds; a healer is a DPS-THRESHOLD shape,
        // so it asks a question a bigger hp pile cannot. -> 16-18, heroic min 2
        // (the shipped L29 floor), dart-mono still clears. tools/td-threat.js
        { groups: [ { type: "healer", count: 3, gap: 0.9, delay: 4 }, { type: "offcut", count: 39, gap: 0.3, delay: 2 }, { type: "blob", count: 67, gap: 0.65, delay: 0 }, { type: "pellet", count: 114, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "tinplane", count: 35, gap: 0.9, delay: 4 }, { type: "offcut", count: 49, gap: 0.3, delay: 2 }, { type: "reject", count: 77, gap: 0.65, delay: 0 }, { type: "knight", count: 20, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 16, gap: 0.9, delay: 4 }, { type: "offcut", count: 61, gap: 0.3, delay: 2 }, { type: "blob", count: 59, gap: 0.65, delay: 0 }, { type: "pellet", count: 148, gap: 0.8, delay: 3, at: 30 } ] },
      ],
    },
    {
      id: 34, name: "The Mould Room", world: "toyworks", badge: 3,
      // ➡️ the line itself: a belt run that shoves everything along, so the
      // guns covering it get LESS time. Capped well under the 1.35 the
      // conveyor-strength guardrail allows (a strong conveyor is a free loss).
      zones: [ { from: 18, to: 30, mult: 1.25 } ],
      startGold: 1250, budgetBase: 1050,
      path: [ [0, 11], [16, 11], [16, 5], [6, 5], [6, 1], [21, 1], [21, 6], [23, 6] ],
      pads: [ { id: "p1", cx: 5, cy: 0 }, { id: "p2", cx: 23, cy: 8 }, { id: "p3", cx: 0, cy: 13 }, { id: "p4", cx: 12, cy: 13 }, { id: "p5", cx: 22, cy: 0 }, { id: "p6", cx: 13, cy: 3 }, { id: "p7", cx: 5, cy: 6 }, { id: "p8", cx: 17, cy: 12 }, { id: "p9", cx: 6, cy: 13 }, { id: "p10", cx: 17, cy: 4 }, { id: "p11", cx: 9, cy: 9 }, { id: "p12", cx: 14, cy: 8 }, { id: "p13", cx: 20, cy: 7 } ],
      waves: [
        { groups: [ { type: "reject", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 15, gap: 0.65, delay: 0 }, { type: "pellet", count: 37, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "reject", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 3, gap: 0.9, delay: 4 }, { type: "blob", count: 18, gap: 0.65, delay: 0 }, { type: "pellet", count: 46, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "duck", count: 2, gap: 0.9, delay: 4 }, { type: "reject", count: 39, gap: 0.65, delay: 0 }, { type: "knight", count: 9, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bucket", count: 1, gap: 0.9, delay: 4 }, { type: "blob", count: 26, gap: 0.65, delay: 0 }, { type: "pellet", count: 64, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 7, gap: 0.9, delay: 4 }, { type: "offcut", count: 12, gap: 0.3, delay: 2 }, { type: "reject", count: 44, gap: 0.65, delay: 0 }, { type: "knight", count: 11, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "drum", count: 3, gap: 0.9, delay: 4 }, { type: "offcut", count: 16, gap: 0.3, delay: 2 }, { type: "blob", count: 29, gap: 0.65, delay: 0 }, { type: "pellet", count: 72, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 11, gap: 0.9, delay: 4 }, { type: "offcut", count: 20, gap: 0.3, delay: 2 }, { type: "reject", count: 57, gap: 0.65, delay: 0 }, { type: "knight", count: 15, gap: 0.8, delay: 3 } ] },
        // THREAT SHAPE (measured 2026-08), the fourth dose and the strongest of
        // the set: 7 of 8 seeds move. L34 was the SOFTEST level in the campaign
        // — it moved on 1 seed and only by a life — and it was nearly missed,
        // because the search tool 8-seed-confirmed only its three most
        // AGGRESSIVE candidates, all of which blow out heroic, and reported L34
        // as having nothing. The gentlest dose that still moves a level is what
        // you actually want; the tool now confirms strongest, middle and
        // weakest. 8 seeds: normal 20,19,20,20,20,20,20,20 ->
        // 17,19,17,20,20,15,19,16; heroic median 11 -> 6, minimum 4, ZERO
        // losses; neglect still loses.
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "healer", count: 3, gap: 0.9, delay: 4 }, { type: "offcut", count: 26, gap: 0.3, delay: 2 }, { type: "blob", count: 42, gap: 0.65, delay: 0 }, { type: "pellet", count: 95, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 14, gap: 0.9, delay: 4 }, { type: "offcut", count: 32, gap: 0.3, delay: 2 }, { type: "reject", count: 75, gap: 0.65, delay: 0 }, { type: "knight", count: 19, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 23, gap: 0.9, delay: 4 }, { type: "offcut", count: 41, gap: 0.3, delay: 2 }, { type: "blob", count: 48, gap: 0.65, delay: 0 }, { type: "pellet", count: 120, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 19, gap: 0.9, delay: 4 }, { type: "offcut", count: 51, gap: 0.3, delay: 2 }, { type: "reject", count: 96, gap: 0.65, delay: 0 }, { type: "knight", count: 24, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "bucket", count: 5, gap: 0.9, delay: 4 }, { type: "offcut", count: 64, gap: 0.3, delay: 2 }, { type: "blob", count: 66, gap: 0.65, delay: 0 }, { type: "pellet", count: 166, gap: 0.8, delay: 3 } ] },
      ],
    },
    {
      id: 35, name: "The Paint Line", world: "toyworks", badge: 3,
      startGold: 1350, budgetBase: 1100,
      path: [ [0, 7], [7, 7], [7, 2], [18, 2], [18, 9], [12, 9], [12, 13], [23, 13] ],
      paths: [ [ [0, 7], [7, 7], [7, 2], [18, 2], [18, 9], [12, 9], [12, 13], [23, 13] ], [ [0, 7], [7, 7], [7, 12], [2, 12], [2, 2], [7, 2], [18, 2], [18, 9], [12, 9], [12, 13], [23, 13] ] ],
      fork: { at: 7 }, lever: { cx: 7, cy: 7 },
      pads: [ { id: "p1", cx: 11, cy: 8 }, { id: "p2", cx: 23, cy: 11 }, { id: "p3", cx: 19, cy: 1 }, { id: "p4", cx: 0, cy: 5 }, { id: "p5", cx: 7, cy: 0 }, { id: "p6", cx: 5, cy: 9 }, { id: "p7", cx: 13, cy: 0 }, { id: "p8", cx: 17, cy: 11 }, { id: "p9", cx: 10, cy: 13 }, { id: "p10", cx: 16, cy: 6 }, { id: "p11", cx: 5, cy: 4 }, { id: "p12", cx: 20, cy: 8 }, { id: "p13", cx: 10, cy: 4 }, { id: "p14", cx: 0, cy: 9 }, { id: "p15", cx: 19, cy: 10 } ],
      waves: [
        { groups: [ { type: "reject", count: 22, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 15, gap: 0.65, delay: 0 }, { type: "pellet", count: 38, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "reject", count: 32, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 4, gap: 0.9, delay: 4 }, { type: "blob", count: 19, gap: 0.65, delay: 0 }, { type: "pellet", count: 48, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "mole", count: 4, gap: 0.9, delay: 4 }, { type: "reject", count: 40, gap: 0.65, delay: 0 }, { type: "knight", count: 10, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 27, gap: 0.65, delay: 0 }, { type: "pellet", count: 67, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 9, gap: 0.9, delay: 4 }, { type: "offcut", count: 13, gap: 0.3, delay: 2 }, { type: "reject", count: 45, gap: 0.65, delay: 0 }, { type: "knight", count: 12, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "screw", count: 7, gap: 0.9, delay: 4 }, { type: "offcut", count: 16, gap: 0.3, delay: 2 }, { type: "blob", count: 26, gap: 0.65, delay: 0 }, { type: "pellet", count: 65, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "mole", count: 12, gap: 0.9, delay: 4 }, { type: "offcut", count: 21, gap: 0.3, delay: 2 }, { type: "reject", count: 62, gap: 0.65, delay: 0 }, { type: "knight", count: 15, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 8, gap: 0.9, delay: 4 }, { type: "offcut", count: 26, gap: 0.3, delay: 2 }, { type: "blob", count: 39, gap: 0.65, delay: 0 }, { type: "pellet", count: 98, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 23, gap: 0.9, delay: 4 }, { type: "offcut", count: 33, gap: 0.3, delay: 2 }, { type: "reject", count: 81, gap: 0.65, delay: 0 }, { type: "knight", count: 20, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "battery", count: 23, gap: 0.9, delay: 4 }, { type: "offcut", count: 41, gap: 0.3, delay: 2 }, { type: "blob", count: 44, gap: 0.65, delay: 0 }, { type: "pellet", count: 109, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "mole", count: 31, gap: 0.9, delay: 4 }, { type: "offcut", count: 51, gap: 0.3, delay: 2 }, { type: "reject", count: 105, gap: 0.65, delay: 0 }, { type: "knight", count: 26, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 23, gap: 0.9, delay: 4 }, { type: "offcut", count: 64, gap: 0.3, delay: 2 }, { type: "blob", count: 67, gap: 0.65, delay: 0 }, { type: "pellet", count: 168, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 57, gap: 0.9, delay: 4 }, { type: "offcut", count: 79, gap: 0.3, delay: 2 }, { type: "reject", count: 135, gap: 0.65, delay: 0 }, { type: "knight", count: 34, gap: 0.8, delay: 3 } ] },
      ],
    },
    {
      id: 36, name: "The Stamping Press", world: "toyworks", badge: 3,
      startGold: 1900, budgetBase: 1050,
      path: [ [0, 13], [14, 13], [14, 7], [3, 7], [3, 2], [20, 2], [20, 10], [23, 10] ],
      pads: [ { id: "p1", cx: 2, cy: 1 }, { id: "p2", cx: 23, cy: 12 }, { id: "p3", cx: 16, cy: 0 }, { id: "p4", cx: 10, cy: 11 }, { id: "p5", cx: 0, cy: 11 }, { id: "p6", cx: 15, cy: 6 }, { id: "p7", cx: 22, cy: 4 }, { id: "p8", cx: 9, cy: 0 }, { id: "p9", cx: 16, cy: 13 }, { id: "p10", cx: 6, cy: 5 }, { id: "p11", cx: 2, cy: 8 }, { id: "p12", cx: 19, cy: 11 }, { id: "p13", cx: 21, cy: 1 }, { id: "p14", cx: 11, cy: 4 } ],
      waves: [
        { groups: [ { type: "reject", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 15, gap: 0.65, delay: 0 }, { type: "pellet", count: 37, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "reject", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 19, gap: 0.65, delay: 0 }, { type: "pellet", count: 46, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 2, gap: 0.9, delay: 4 }, { type: "reject", count: 38, gap: 0.65, delay: 0 }, { type: "knight", count: 9, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "duck", count: 3, gap: 0.9, delay: 4 }, { type: "blob", count: 24, gap: 0.65, delay: 0 }, { type: "pellet", count: 60, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 4, gap: 0.9, delay: 4 }, { type: "offcut", count: 12, gap: 0.3, delay: 2 }, { type: "reject", count: 43, gap: 0.65, delay: 0 }, { type: "knight", count: 11, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 9, gap: 0.9, delay: 4 }, { type: "offcut", count: 15, gap: 0.3, delay: 2 }, { type: "blob", count: 29, gap: 0.65, delay: 0 }, { type: "pellet", count: 72, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "drum", count: 4, gap: 0.9, delay: 4 }, { type: "offcut", count: 20, gap: 0.3, delay: 2 }, { type: "reject", count: 50, gap: 0.65, delay: 0 }, { type: "knight", count: 13, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 6, gap: 0.9, delay: 4 }, { type: "offcut", count: 25, gap: 0.3, delay: 2 }, { type: "blob", count: 38, gap: 0.65, delay: 0 }, { type: "pellet", count: 96, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 13, gap: 0.9, delay: 4 }, { type: "offcut", count: 31, gap: 0.3, delay: 2 }, { type: "reject", count: 77, gap: 0.65, delay: 0 }, { type: "knight", count: 19, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 12, gap: 0.9, delay: 4 }, { type: "offcut", count: 39, gap: 0.3, delay: 2 }, { type: "blob", count: 49, gap: 0.65, delay: 0 }, { type: "pellet", count: 123, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "boombox", count: 22, gap: 0.9, delay: 4 }, { type: "offcut", count: 49, gap: 0.3, delay: 2 }, { type: "reject", count: 85, gap: 0.65, delay: 0 }, { type: "knight", count: 21, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 44, gap: 0.9, delay: 4 }, { type: "offcut", count: 61, gap: 0.3, delay: 2 }, { type: "blob", count: 64, gap: 0.65, delay: 0 }, { type: "pellet", count: 160, gap: 0.8, delay: 3 } ] },
        // The campaign's last question, and deliberately one no other finale
        // asks: air + rubber + a slick. Break the drums in the wrong place and
        // the Press itself speeds up over the spill.
        { boss: true, groups: [ { type: "stamper", count: 1, gap: 1, delay: 0 }, { type: "drum", count: 5, gap: 0.9, delay: 3 }, { type: "duck", count: 6, gap: 0.9, delay: 6 }, { type: "offcut", count: 14, gap: 0.3, delay: 2 }, { type: "reject", count: 16, gap: 0.65, delay: 5 } ] },
      ],
    },
    {
      // ---- WORLD 10: 🎉 The Party (L37-L40) ----
      // The toy the factory moulded gets wrapped and handed over. Its hook is
      // the ⚡ disco socket: the one gimmick that makes a pad BETTER, so the
      // world opens by teaching that where you build is a decision.
      id: 37, name: "Streamers Up", world: "party", badge: 3,
      startGold: 1250, budgetBase: 1000,
      path: [ [0, 3], [18, 3], [18, 9], [5, 9], [5, 13], [23, 13] ],
      pads: [ { id: "p1", cx: 4, cy: 8 }, { id: "p2", cx: 23, cy: 11 }, { id: "p3", cx: 15, cy: 1 }, { id: "p4", cx: 13, cy: 11 }, { id: "p5", cx: 0, cy: 1 }, { id: "p6", cx: 7, cy: 1 }, { id: "p7", cx: 20, cy: 5 }, { id: "p8", cx: 19, cy: 10 }, { id: "p9", cx: 11, cy: 5, boost: { range: 1.18, rate: 1.15 } }, { id: "p10", cx: 3, cy: 13 }, { id: "p11", cx: 8, cy: 11 }, { id: "p12", cx: 19, cy: 2 } ],
      waves: [
        { groups: [ { type: "popper", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 14, gap: 0.65, delay: 0 }, { type: "sweet", count: 35, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "popper", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 1, gap: 0.9, delay: 4 }, { type: "blob", count: 18, gap: 0.65, delay: 0 }, { type: "sweet", count: 45, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 3, gap: 0.9, delay: 4 }, { type: "popper", count: 36, gap: 0.65, delay: 0 }, { type: "knight", count: 9, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "duck", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 24, gap: 0.65, delay: 0 }, { type: "sweet", count: 60, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "streamer", count: 12, gap: 0.3, delay: 2 }, { type: "popper", count: 41, gap: 0.65, delay: 0 }, { type: "knight", count: 11, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 11, gap: 0.9, delay: 4 }, { type: "streamer", count: 15, gap: 0.3, delay: 2 }, { type: "blob", count: 27, gap: 0.65, delay: 0 }, { type: "sweet", count: 68, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 8, gap: 0.9, delay: 4 }, { type: "streamer", count: 19, gap: 0.3, delay: 2 }, { type: "popper", count: 55, gap: 0.65, delay: 0 }, { type: "knight", count: 14, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "bubblewrap", count: 7, gap: 0.9, delay: 4 }, { type: "streamer", count: 24, gap: 0.3, delay: 2 }, { type: "blob", count: 32, gap: 0.65, delay: 0 }, { type: "sweet", count: 80, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 8, gap: 0.9, delay: 4 }, { type: "streamer", count: 31, gap: 0.3, delay: 2 }, { type: "popper", count: 71, gap: 0.65, delay: 0 }, { type: "knight", count: 18, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 14, gap: 0.9, delay: 4 }, { type: "streamer", count: 39, gap: 0.3, delay: 2 }, { type: "blob", count: 46, gap: 0.65, delay: 0 }, { type: "sweet", count: 114, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 22, gap: 0.9, delay: 4 }, { type: "streamer", count: 49, gap: 0.3, delay: 2 }, { type: "popper", count: 91, gap: 0.65, delay: 0 }, { type: "knight", count: 23, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "cushion", count: 16, gap: 0.9, delay: 4 }, { type: "streamer", count: 61, gap: 0.3, delay: 2 }, { type: "blob", count: 51, gap: 0.65, delay: 0 }, { type: "sweet", count: 128, gap: 0.8, delay: 3 } ] },
      ],
    },
    {
      // Pass the Parcel: the two lanes run up the SAME column and only split at
      // the top, so a parcel already walking can be sent round the long way with
      // no teleport (the shared-prefix invariant). fork.at = 13 is where they
      // actually diverge, measured — not where the lever stands.
      id: 38, name: "Pass the Parcel", world: "party", badge: 3,
      startGold: 1700, budgetBase: 800,
      path: [ [0, 12], [5, 12], [5, 4], [14, 4], [14, 10], [20, 10], [20, 3], [23, 3] ],
      paths: [ [ [0, 12], [5, 12], [5, 4], [14, 4], [14, 10], [20, 10], [20, 3], [23, 3] ],
               [ [0, 12], [5, 12], [5, 1], [19, 1], [19, 7], [11, 7], [11, 4], [14, 4], [14, 10], [20, 10], [20, 3], [23, 3] ] ],
      fork: { at: 13 }, lever: { cx: 5, cy: 12 },
      pads: [ { id: "p1", cx: 13, cy: 11 }, { id: "p2", cx: 23, cy: 1 }, { id: "p3", cx: 0, cy: 10 }, { id: "p4", cx: 15, cy: 3 }, { id: "p5", cx: 21, cy: 11 }, { id: "p6", cx: 7, cy: 6 }, { id: "p7", cx: 7, cy: 12 }, { id: "p8", cx: 22, cy: 6 }, { id: "p9", cx: 3, cy: 4 }, { id: "p10", cx: 17, cy: 12 }, { id: "p11", cx: 3, cy: 8 } ],
      waves: [
        { groups: [ { type: "popper", count: 17, gap: 0.65, delay: 0 }, { type: "knight", count: 4, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 11, gap: 0.65, delay: 0 }, { type: "sweet", count: 28, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "popper", count: 23, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 14, gap: 0.65, delay: 0 }, { type: "sweet", count: 34, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "popper", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 19, gap: 0.65, delay: 0 }, { type: "sweet", count: 46, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 7, gap: 0.9, delay: 4 }, { type: "streamer", count: 9, gap: 0.3, delay: 2 }, { type: "popper", count: 35, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 5, gap: 0.9, delay: 4 }, { type: "streamer", count: 12, gap: 0.3, delay: 2 }, { type: "blob", count: 22, gap: 0.65, delay: 0 }, { type: "sweet", count: 55, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 6, gap: 0.9, delay: 4 }, { type: "streamer", count: 16, gap: 0.3, delay: 2 }, { type: "popper", count: 42, gap: 0.65, delay: 0 }, { type: "knight", count: 11, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 12, gap: 0.9, delay: 4 }, { type: "streamer", count: 20, gap: 0.3, delay: 2 }, { type: "blob", count: 27, gap: 0.65, delay: 0 }, { type: "sweet", count: 69, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 11, gap: 0.9, delay: 4 }, { type: "streamer", count: 26, gap: 0.3, delay: 2 }, { type: "popper", count: 56, gap: 0.65, delay: 0 }, { type: "knight", count: 14, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 10, gap: 0.9, delay: 4 }, { type: "streamer", count: 33, gap: 0.3, delay: 2 }, { type: "blob", count: 35, gap: 0.65, delay: 0 }, { type: "sweet", count: 89, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 30, gap: 0.9, delay: 4 }, { type: "streamer", count: 41, gap: 0.3, delay: 2 }, { type: "popper", count: 70, gap: 0.65, delay: 0 }, { type: "knight", count: 18, gap: 0.8, delay: 3 } ] },
      ],
    },
    {
      // Musical Chairs — the conveyor IS the music: while it plays everyone
      // keeps moving, and the strip sits mid-lane so it shoves the crowd
      // through the middle of your board rather than past its edge.
      id: 39, name: "Musical Chairs", world: "party", badge: 3,
      startGold: 1300, budgetBase: 1050,
      path: [ [0, 12], [15, 12], [15, 6], [4, 6], [4, 2], [20, 2], [20, 8], [23, 8] ],
      zones: [ { from: 21, to: 32, mult: 1.28 } ],
      pads: [ { id: "p1", cx: 3, cy: 1 }, { id: "p2", cx: 23, cy: 10 }, { id: "p3", cx: 16, cy: 0 }, { id: "p4", cx: 10, cy: 10 }, { id: "p5", cx: 0, cy: 10 }, { id: "p6", cx: 16, cy: 13 }, { id: "p7", cx: 21, cy: 1 }, { id: "p8", cx: 16, cy: 5 }, { id: "p9", cx: 9, cy: 0 }, { id: "p10", cx: 3, cy: 7 }, { id: "p11", cx: 19, cy: 9 }, { id: "p12", cx: 7, cy: 4 }, { id: "p13", cx: 12, cy: 4 } ],
      waves: [
        { groups: [ { type: "popper", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 15, gap: 0.65, delay: 0 }, { type: "sweet", count: 37, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "popper", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 4, gap: 0.9, delay: 4 }, { type: "blob", count: 18, gap: 0.65, delay: 0 }, { type: "sweet", count: 45, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 2, gap: 0.9, delay: 4 }, { type: "popper", count: 38, gap: 0.65, delay: 0 }, { type: "knight", count: 9, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 4, gap: 0.9, delay: 4 }, { type: "streamer", count: 9, gap: 0.3, delay: 2 }, { type: "blob", count: 22, gap: 0.65, delay: 0 }, { type: "sweet", count: 55, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 4, gap: 0.9, delay: 4 }, { type: "streamer", count: 12, gap: 0.3, delay: 2 }, { type: "popper", count: 46, gap: 0.65, delay: 0 }, { type: "knight", count: 11, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 6, gap: 0.9, delay: 4 }, { type: "streamer", count: 16, gap: 0.3, delay: 2 }, { type: "blob", count: 29, gap: 0.65, delay: 0 }, { type: "sweet", count: 72, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 14, gap: 0.9, delay: 4 }, { type: "streamer", count: 20, gap: 0.3, delay: 2 }, { type: "popper", count: 57, gap: 0.65, delay: 0 }, { type: "knight", count: 15, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "duck", count: 7, gap: 0.9, delay: 4 }, { type: "streamer", count: 26, gap: 0.3, delay: 2 }, { type: "blob", count: 37, gap: 0.65, delay: 0 }, { type: "sweet", count: 93, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 10, gap: 0.9, delay: 4 }, { type: "streamer", count: 32, gap: 0.3, delay: 2 }, { type: "popper", count: 74, gap: 0.65, delay: 0 }, { type: "knight", count: 19, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 18, gap: 0.9, delay: 4 }, { type: "streamer", count: 41, gap: 0.3, delay: 2 }, { type: "blob", count: 48, gap: 0.65, delay: 0 }, { type: "sweet", count: 120, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "ghost", count: 37, gap: 0.9, delay: 4 }, { type: "streamer", count: 51, gap: 0.3, delay: 2 }, { type: "popper", count: 82, gap: 0.65, delay: 0 }, { type: "knight", count: 21, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "drum", count: 13, gap: 0.9, delay: 4 }, { type: "streamer", count: 64, gap: 0.3, delay: 2 }, { type: "blob", count: 61, gap: 0.65, delay: 0 }, { type: "sweet", count: 153, gap: 0.8, delay: 3 } ] },
      ],
    },
    {
      // The campaign's last level. The Big Present never touches you — it makes
      // the whole room ARRIVE FASTER (a `hurry` aura, the one boss kit no other
      // finale uses) while the healers mend its escort.
      id: 40, name: "The Big Present", world: "party", badge: 3,
      startGold: 1950, budgetBase: 1050,
      path: [ [0, 2], [13, 2], [13, 8], [3, 8], [3, 12], [19, 12], [19, 6], [23, 6] ],
      pads: [ { id: "p1", cx: 2, cy: 7 }, { id: "p2", cx: 23, cy: 4 }, { id: "p3", cx: 14, cy: 9 }, { id: "p4", cx: 9, cy: 0 }, { id: "p5", cx: 20, cy: 13 }, { id: "p6", cx: 2, cy: 13 }, { id: "p7", cx: 0, cy: 0 }, { id: "p8", cx: 14, cy: 1 }, { id: "p9", cx: 18, cy: 5 }, { id: "p10", cx: 8, cy: 6 }, { id: "p11", cx: 6, cy: 10 }, { id: "p12", cx: 21, cy: 8 }, { id: "p13", cx: 4, cy: 0 }, { id: "p14", cx: 10, cy: 10 } ],
      waves: [
        { groups: [ { type: "popper", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 15, gap: 0.65, delay: 0 }, { type: "sweet", count: 37, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "popper", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 18, gap: 0.65, delay: 0 }, { type: "sweet", count: 45, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 2, gap: 0.9, delay: 4 }, { type: "popper", count: 38, gap: 0.65, delay: 0 }, { type: "knight", count: 9, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 5, gap: 0.9, delay: 4 }, { type: "blob", count: 25, gap: 0.65, delay: 0 }, { type: "sweet", count: 62, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 5, gap: 0.9, delay: 4 }, { type: "streamer", count: 12, gap: 0.3, delay: 2 }, { type: "popper", count: 45, gap: 0.65, delay: 0 }, { type: "knight", count: 11, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 5, gap: 0.9, delay: 4 }, { type: "streamer", count: 15, gap: 0.3, delay: 2 }, { type: "blob", count: 29, gap: 0.65, delay: 0 }, { type: "sweet", count: 71, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 14, gap: 0.9, delay: 4 }, { type: "streamer", count: 20, gap: 0.3, delay: 2 }, { type: "popper", count: 57, gap: 0.65, delay: 0 }, { type: "knight", count: 15, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "boombox", count: 11, gap: 0.9, delay: 4 }, { type: "streamer", count: 25, gap: 0.3, delay: 2 }, { type: "blob", count: 34, gap: 0.65, delay: 0 }, { type: "sweet", count: 84, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 13, gap: 0.9, delay: 4 }, { type: "streamer", count: 31, gap: 0.3, delay: 2 }, { type: "popper", count: 77, gap: 0.65, delay: 0 }, { type: "knight", count: 19, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 10, gap: 0.9, delay: 4 }, { type: "streamer", count: 39, gap: 0.3, delay: 2 }, { type: "blob", count: 50, gap: 0.65, delay: 0 }, { type: "sweet", count: 125, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 35, gap: 0.9, delay: 4 }, { type: "streamer", count: 49, gap: 0.3, delay: 2 }, { type: "popper", count: 100, gap: 0.65, delay: 0 }, { type: "knight", count: 25, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 27, gap: 0.9, delay: 4 }, { type: "streamer", count: 61, gap: 0.3, delay: 2 }, { type: "blob", count: 64, gap: 0.65, delay: 0 }, { type: "sweet", count: 160, gap: 0.8, delay: 3 } ] },
        { boss: true, groups: [ { type: "bigpresent", count: 1, gap: 1, delay: 0 }, { type: "healer", count: 5, gap: 0.9, delay: 3 }, { type: "pinata", count: 2, gap: 1.2, delay: 7 }, { type: "streamer", count: 16, gap: 0.3, delay: 2 }, { type: "popper", count: 18, gap: 0.65, delay: 5 } ] },
      ],
    },
  ];

  // ---- TD-5 META (§8.1): star tree. Spend earned ⭐ on permanent buffs; free
  //      respec. Every effect is applied at createEngine as PURE INPUT (opts.meta
  //      = array of node ids), so a sim can drive any loadout. Costs from the
  //      plan; total 28 of a possible 36⭐ (3⭐ × 12 levels) — the tree is
  //      fully affordable once the campaign is mastered. ----
  // TD-8 star tree: 3 themed branches × ranked skills + a 👑 capstone each.
  // Deliberately costs MORE than the 36⭐ ceiling (guardrail-tested) so
  // allocation is a real choice forever — the free respec keeps it forgiving.
  // Rank II needs its rank I (req); a capstone needs reqSpend ⭐ already spent
  // INSIDE its own branch. The original 10 node ids/costs/effects are UNCHANGED
  // (an existing save.meta keeps exactly what it owned).
  const META_BRANCHES = [
    { id: "fire", icon: "🎯", name: "Firepower" },
    { id: "econ", icon: "💰", name: "Economy" },
    { id: "fort", icon: "🏰", name: "Fortification" },
  ];
  const META_NODES = [
    // 🎯 Firepower
    { id: "dartdmg",       branch: "fire", icon: "🎯", name: "Sharp Darts",     desc: "Dart +10% damage",             cost: 3 },
    { id: "dartdmg2",      branch: "fire", icon: "🎯", name: "Sharp Darts II",  desc: "Dart +20% damage",             cost: 3, req: "dartdmg" },
    { id: "mortarsplash",  branch: "fire", icon: "🧱", name: "Big Booms",       desc: "Mortar +10% splash",           cost: 3 },
    { id: "mortarsplash2", branch: "fire", icon: "🧱", name: "Big Booms II",    desc: "Mortar +20% splash",           cost: 3, req: "mortarsplash" },
    { id: "fanrange",      branch: "fire", icon: "🧊", name: "Cold Front",      desc: "Fan aura +0.3 range",          cost: 3 },
    { id: "critchance",    branch: "fire", icon: "🍀", name: "Lucky Darts",     desc: "Dart-line shots +3% crit",     cost: 3 },
    { id: "cheaptarget",   branch: "fire", icon: "🔻", name: "Weak Spot",       desc: "Unlock “Weakest” aim",         cost: 2 },
    { id: "bossdmg",       branch: "fire", icon: "👊", name: "Boss Bonker",     desc: "Bosses take +15% damage",      cost: 6, reqSpend: 8 },
    // 💰 Economy
    { id: "startgold",     branch: "econ", icon: "💰", name: "Piggy Bank",      desc: "+40 starting gold",            cost: 2 },
    { id: "startgold2",    branch: "econ", icon: "💰", name: "Piggy Bank II",   desc: "+80 starting gold",            cost: 3, req: "startgold" },
    { id: "earlycall",     branch: "econ", icon: "⏩", name: "Early Bird",      desc: "Early-call bonus ×1.5",        cost: 2 },
    { id: "sellrefund",    branch: "econ", icon: "♻️", name: "Trade-In",        desc: "Sell refund 90%",              cost: 2 },
    { id: "branchcost",    branch: "econ", icon: "🏷️", name: "Bulk Deal",       desc: "Branch prices −10%",           cost: 4 },
    { id: "bounty",        branch: "econ", icon: "🪙", name: "Bounty Hunter",   desc: "Popped toys drop +8% gold",    cost: 3 },
    { id: "allowance",     branch: "econ", icon: "💵", name: "Allowance",       desc: "+12 gold after every wave",    cost: 6, reqSpend: 8 },
    // 🏰 Fortification
    { id: "lives",         branch: "fort", icon: "❤️", name: "Extra Hearts",    desc: "+2 starting lives",            cost: 4 },
    { id: "lives2",        branch: "fort", icon: "❤️", name: "Extra Hearts II", desc: "+4 starting lives",            cost: 4, req: "lives" },
    { id: "soldierhp",     branch: "fort", icon: "🪖", name: "Tough Troops",    desc: "Soldiers +15% HP",             cost: 3 },
    { id: "soldierhp2",    branch: "fort", icon: "🪖", name: "Tough Troops II", desc: "Soldiers +30% HP",             cost: 3, req: "soldierhp" },
    { id: "guarddog",      branch: "fort", icon: "🐕", name: "Guard Dog",       desc: "Soldiers respawn 25% faster",  cost: 3 },
    { id: "nightowl",      branch: "fort", icon: "🦉", name: "Night Owl",       desc: "Night range penalty halved",   cost: 2 },
    { id: "patchkit",      branch: "fort", icon: "🩹", name: "Patch Kit",       desc: "+1 life every 5th wave",       cost: 4 },
    { id: "stickershield", branch: "fort", icon: "🌟", name: "Sticker Shield",  desc: "First leak each run costs 0 lives", cost: 6, reqSpend: 8 },
    // ---- P4.3 BREADTH: seven new KINDS, +28⭐ (77 → 105) ----
    // The star ceiling derives as LEVELS.length * 3, and a shipped guardrail
    // requires the tree to cost MORE than you can ever earn — at 32 levels the
    // ceiling is 96, so the 77⭐ tree was the hard blocker on a seventh world.
    // Grown by BREADTH, never by adding ranks: a rank is a metaMods ternary and
    // adds raw power, and three individual Firepower nodes already erase a boss
    // finale on their own. Under a 6-slot pack, more KINDS is more choice.
    // Every one of these is deliberately SITUATIONAL — dead weight on the wrong
    // level, which is what makes packing it a decision rather than an upgrade.
    { id: "deepfreeze",   branch: "fire", icon: "🧊", name: "Deep Freeze",   desc: "Slows last 40% longer",              cost: 4 },
    { id: "ricochet",     branch: "fire", icon: "🪃", name: "Ricochet",      desc: "The Fan's chain jumps one more",     cost: 5 },
    { id: "widerblast",   branch: "fire", icon: "💣", name: "Wider Blast",   desc: "Tap-anywhere powers cover +25%",     cost: 4 },
    { id: "sparebattery", branch: "econ", icon: "🔋", name: "Spare Battery", desc: "+1 toy energy every wave",           cost: 5 },
    { id: "scoutreport",  branch: "econ", icon: "🧭", name: "Scout Report",  desc: "See two waves ahead, not one",       cost: 3 },
    { id: "fieldrepair",  branch: "fort", icon: "🧰", name: "Field Repair",  desc: "Jammed guns come back twice as fast", cost: 4 },
    { id: "quickmarch",   branch: "fort", icon: "🥾", name: "Quick March",   desc: "Soldiers reach their post sooner",   cost: 3 },
    // ---- W9 unblock: five MORE new KINDS. The star ceiling derives as
    // `LEVELS.length * 3`, so a ninth world (36 levels → 108⭐) needs a tree that
    // still costs more than you can earn. It grows by BREADTH, never by adding
    // ranks: a rank is raw power, a kind is a choice, and under a 6-slot pack
    // only choices make the tree interesting. Each is consumed at exactly ONE
    // engine site and none of them is raw damage.
    { id: "quickhands",   branch: "fire", icon: "⏱️", name: "Fast Hands",    desc: "Powers come back 20% sooner",        cost: 4 },
    { id: "closequarters", branch: "fire", icon: "🎯", name: "Close Quarters", desc: "The Mortar's dead zone shrinks 40%", cost: 3 },
    { id: "handyman",     branch: "econ", icon: "🔧", name: "Handyman",      desc: "Tier 1-3 upgrades cost 10% less",    cost: 4 },
    { id: "warmedup",     branch: "econ", icon: "🔌", name: "Warmed Up",     desc: "Start each level with a full battery", cost: 3 },
    { id: "softlanding",  branch: "fort", icon: "🛬", name: "Soft Landing",  desc: "Big leaks cost 2 fewer stickers",    cost: 4 },
    // ---- W10 unblock: five more KINDS (never ranks). A tenth world takes the
    // earnable ceiling to 120⭐, and at the old 123⭐ the tree would have been
    // 97.6% affordable — TD-8 designed for 47%, so it stops being a choice.
    // Every one is situational: Live Wire and Steady Aim need a specific
    // tier-4 branch or the crit line, Coin Magnet needs piñatas, and both
    // squad nodes are dead weight unless you build a camp.
    { id: "livewire",     branch: "fire", icon: "🔗", name: "Live Wire",     desc: "The Fan's chain keeps more punch each jump", cost: 4 },
    { id: "steadyaim",    branch: "fire", icon: "🎯", name: "Steady Aim",    desc: "Critical hits do 25% more damage",           cost: 3 },
    { id: "coinmagnet",   branch: "econ", icon: "🧲", name: "Coin Magnet",   desc: "Piñatas burst 60% more gold",                cost: 3 },
    { id: "padding",      branch: "fort", icon: "🧱", name: "Padding",       desc: "Soldiers take 25% less melee damage",        cost: 4 },
    { id: "drillsergeant", branch: "fort", icon: "🥁", name: "Drill Sergeant", desc: "Soldiers hit 25% harder",                  cost: 3 },
  ];

  // ---- TD-5 ACHIEVEMENTS (§8.2): unlocked from real play, toast on earn,
  //      stored in the save's `ach` array. Icons ≤ Emoji 13.0. ----
  const ACHIEVEMENTS = [
    { id: "firstblood",    icon: "⚔️", name: "First Blood",   desc: "Pop your first toy" },
    { id: "doorman",       icon: "🚪", name: "Doorman",       desc: "Win Level 1" },
    { id: "noleaks",       icon: "🛡️", name: "No Leaks",      desc: "Win a level with all 20 lives" },
    { id: "peapurist",     icon: "🎯", name: "Pea Purist",    desc: "Win Level 2 with only Darts" },
    { id: "iceage",        icon: "🧊", name: "Ice Age",       desc: "Slow 20 enemies at once" },
    { id: "bossbonker",    icon: "🛏️", name: "Boss Bonker",   desc: "Beat the Bed Monster" },
    { id: "dysondenied",   icon: "🌪️", name: "Dyson Denied",  desc: "Beat the Vacuum King" },
    { id: "unplugged",     icon: "⚡", name: "Unplugged",     desc: "Beat The Static" },
    // World 4's finale shipped with NO badge while the other three bosses each
    // had one — nobody noticed because the badge count was pinned at 12 in two
    // tests. Both now derive from this array (the "content outgrew a literal"
    // class, for the fourth time).
    { id: "windeddown",    icon: "⏰", name: "Wound Down",    desc: "Beat the Tickmaster" },
    { id: "toolsdown",     icon: "🧰", name: "Tools Down",     desc: "Beat the Toolbox Titan" },
    { id: "notleaving",    icon: "🚚", name: "Not Leaving",    desc: "Beat The Moving Van" },
    { id: "gooddog",       icon: "🐕", name: "Good Dog",       desc: "Beat The Housedog" },
    { id: "scrapped",      icon: "🧲", name: "Scrapped",       desc: "Beat The Big Magnet" },
    { id: "pressed",       icon: "🗜️", name: "Pressed",        desc: "Beat The Stamping Press" },
    { id: "unwrapped",     icon: "🎁", name: "Unwrapped",     desc: "Beat The Big Present" },
    // desc is DERIVED at read time (see td-ui) — a literal here went stale the
    // moment World 4 raised the ceiling from 36 to 48.
    { id: "starcollector", icon: "⭐", name: "Star Collector",desc: "Earn half the stars" },
    { id: "fullfort",      icon: "👑", name: "Full Fort",     desc: "Earn every star" },
    { id: "marathoner",    icon: "🏃", name: "Marathoner",    desc: "Reach Endless wave 20" },
    { id: "heroicheart",   icon: "💀", name: "Heroic Heart",  desc: "Win any level on Hard" },
  ];

  // ---- TD-5 ENDLESS (§7.5): infinite generated waves per world, unlocked once
  //      all 4 of a world's levels are 3-starred. wave N budget = base·growth^N;
  //      every 5th wave is a mini-boss. The engine plays these through the SAME
  //      loop (the level just carries an `endless` generator instead of `waves`). ----
  const ENDLESS = {
    base: 300, growth: 1.16, miniBossEvery: 5,
    worlds: {
      bedroom:  { label: "🛏️ Bedroom", pool: ["sock", "marble", "blob", "knight", "balloon", "bull", "brick"], miniBoss: "pinata" },
      backyard: { label: "🌳 Backyard", pool: ["sock", "marble", "knight", "ghost", "mole", "battery", "hawk", "blob"], miniBoss: "pinata" },
      toystore: { label: "🧸 Toy Store", pool: ["knight", "ghost", "mole", "battery", "blob", "hawk", "bull"], miniBoss: "pinata" },
      // miniBoss is the PIÑATA in every world, including this one. The attic
      // shipped with "tickmaster" — the 3200hp, 10-life World-4 campaign boss —
      // as its every-5th-wave punctuation, so a wave-5 board that cannot
      // possibly kill it lost half its lives on the spot and the run ended at
      // wave 5 against 28-46 elsewhere. A mini-boss is a spike, not a wall; the
      // attic earns its difficulty from an all-specials pool instead.
      attic: { label: "🧳 Attic", pool: ["knight", "ghost", "battery", "cushion", "slime", "screw", "tinplane"], miniBoss: "pinata" },
      // World 5: a vanilla backbone plus BOTH garage shapes, so an endless run
      // has to answer the slow-immune runner and the spawner it just learned.
      // World 6: the two Moving Day shapes plus a vanilla backbone, so an
      // endless run has to answer both the padding and the music.
      moving: { label: "📦 Moving Day", pool: ["sock", "knight", "blob", "bubblewrap", "boombox", "hawk", "racer", "cushion"], miniBoss: "pinata" },
      garage: { label: "🔧 Garage", pool: ["sock", "knight", "blob", "racer", "bucket", "hawk", "cushion", "tinplane"], miniBoss: "pinata" },
      // World 7: the house's own crowd plus air plus three disruptors — an
      // endless run here has to answer everything the campaign has taught.
      newhouse: { label: "🏠 The New House", pool: ["chair", "housekey", "knight", "blob", "hawk", "cushion", "boombox", "screw"], miniBoss: "pinata" },
      // World 8: its own crowd plus the two resist shapes, so an endless run
      // here has to answer both the padding and the cushioning.
      sortline: { label: "♻️ The Sort Line", pool: ["carton", "clip", "knight", "blob", "leaflet", "cushion", "bubblewrap", "slime"], miniBoss: "pinata" },
      toyworks: { label: "🏭 The Toy Works", pool: ["reject", "pellet", "knight", "blob", "offcut", "cushion", "battery", "racer"], miniBoss: "pinata" },
      party: { label: "🎉 The Party", pool: ["popper", "sweet", "knight", "blob", "streamer", "healer", "bubblewrap", "boombox"], miniBoss: "pinata" },
    },
    // per-world endless "arena" geometry (a long serpentine + 14 flanking pads)
    arenas: {
      bedroom:  { path: [ [0, 2], [21, 2], [21, 7], [3, 7], [3, 12], [23, 12] ], startGold: 320,
        pads: [ { id: "p1", cx: 2, cy: 0 }, { id: "p2", cx: 6, cy: 4 }, { id: "p3", cx: 10, cy: 0 }, { id: "p4", cx: 14, cy: 4 }, { id: "p5", cx: 18, cy: 0 }, { id: "p6", cx: 19, cy: 4 }, { id: "p7", cx: 20, cy: 9 }, { id: "p8", cx: 16, cy: 5 }, { id: "p9", cx: 12, cy: 9 }, { id: "p10", cx: 8, cy: 5 }, { id: "p11", cx: 4, cy: 9 }, { id: "p12", cx: 1, cy: 10 }, { id: "p13", cx: 5, cy: 10 }, { id: "p14", cx: 9, cy: 13 } ] },
      backyard: { path: [ [0, 12], [21, 12], [21, 7], [3, 7], [3, 2], [23, 2] ], startGold: 360,
        pads: [ { id: "p1", cx: 2, cy: 10 }, { id: "p2", cx: 6, cy: 13 }, { id: "p3", cx: 10, cy: 10 }, { id: "p4", cx: 14, cy: 13 }, { id: "p5", cx: 18, cy: 10 }, { id: "p6", cx: 19, cy: 5 }, { id: "p7", cx: 20, cy: 9 }, { id: "p8", cx: 16, cy: 5 }, { id: "p9", cx: 12, cy: 9 }, { id: "p10", cx: 8, cy: 5 }, { id: "p11", cx: 4, cy: 9 }, { id: "p12", cx: 5, cy: 4 }, { id: "p13", cx: 5, cy: 0 }, { id: "p14", cx: 9, cy: 4 } ] },
      toystore: { path: [ [0, 7], [21, 7], [21, 2], [3, 2], [3, 12], [23, 12] ], startGold: 400,
        pads: [ { id: "p1", cx: 2, cy: 5 }, { id: "p2", cx: 7, cy: 9 }, { id: "p3", cx: 11, cy: 5 }, { id: "p4", cx: 15, cy: 9 }, { id: "p5", cx: 20, cy: 5 }, { id: "p6", cx: 23, cy: 4 }, { id: "p7", cx: 18, cy: 4 }, { id: "p8", cx: 14, cy: 0 }, { id: "p9", cx: 10, cy: 4 }, { id: "p10", cx: 5, cy: 0 }, { id: "p11", cx: 5, cy: 4 }, { id: "p12", cx: 1, cy: 9 }, { id: "p13", cx: 4, cy: 10 }, { id: "p14", cx: 8, cy: 13 } ] },
      // World 4 shipped an attic POOL with no arena, so the run silently fell
      // back to the bedroom map — and the picker hard-coded three worlds, so it
      // was unreachable anyway. Same class as the level grid that said 12 when
      // 16 levels shipped: a literal that content outgrew. Its lane climbs the
      // rafters bottom-to-top (the other three all descend).
      attic: { path: [ [0, 11], [19, 11], [19, 6], [2, 6], [2, 1], [23, 1] ], startGold: 440,
        pads: [ { id: "p1", cx: 2, cy: 13 }, { id: "p2", cx: 6, cy: 13 }, { id: "p3", cx: 10, cy: 13 }, { id: "p4", cx: 14, cy: 13 }, { id: "p5", cx: 18, cy: 13 }, { id: "p6", cx: 5, cy: 8 }, { id: "p7", cx: 9, cy: 8 }, { id: "p8", cx: 13, cy: 8 }, { id: "p9", cx: 17, cy: 9 }, { id: "p10", cx: 5, cy: 3 }, { id: "p11", cx: 9, cy: 3 }, { id: "p12", cx: 13, cy: 3 }, { id: "p13", cx: 17, cy: 3 }, { id: "p14", cx: 21, cy: 4 } ] },
      // World 5's arena — a mirrored serpentine so it reads as its own room.
      // Pads sit CLOSE to the lane (searched at ≤2.2 cells, like the other four).
      // The first cut spread them 3 cells out and the run died at wave 2: an
      // arena starts you poor, so a tier-1 dart's short reach has to touch the
      // lane immediately or nothing you can afford does anything.
      moving: { path: [ [0, 10], [21, 10], [21, 5], [3, 5], [3, 1], [23, 1] ], startGold: 500,
        pads: [ { id: "p1", cx: 0, cy: 12 }, { id: "p2", cx: 4, cy: 12 }, { id: "p3", cx: 8, cy: 12 }, { id: "p4", cx: 12, cy: 12 }, { id: "p5", cx: 16, cy: 12 }, { id: "p6", cx: 20, cy: 12 }, { id: "p7", cx: 23, cy: 8 }, { id: "p8", cx: 19, cy: 7 }, { id: "p9", cx: 15, cy: 7 }, { id: "p10", cx: 11, cy: 7 }, { id: "p11", cx: 7, cy: 7 }, { id: "p12", cx: 1, cy: 7 }, { id: "p13", cx: 6, cy: 3 }, { id: "p14", cx: 14, cy: 3 } ] },
      // World 7's arena CLIMBS to the top row at the end (up to the new room),
      // where the other six descend or mirror. Pads searched at BAND=2.2 like
      // every arena: you start poor, so a tier-1 dart must touch the lane at once.
      // The Toy Works arena — pads searched at BAND=2.2, like every other arena:
      // an arena starts you poor, so a tier-1 dart's short reach has to touch the
      // lane from wave 1 or the run dies at wave 2.
      // The Party arena — pads searched at BAND=2.2 like every other arena: an
      // arena starts you poor, so a tier-1 dart must touch the lane from wave 1.
      party: { path: [ [0, 12], [19, 12], [19, 6], [4, 6], [4, 2], [23, 2] ], startGold: 540,
        pads: [ { id: "p1", cx: 3, cy: 1 }, { id: "p2", cx: 20, cy: 13 }, { id: "p3", cx: 17, cy: 0 }, { id: "p4", cx: 9, cy: 10 }, { id: "p5", cx: 0, cy: 10 }, { id: "p6", cx: 20, cy: 5 }, { id: "p7", cx: 10, cy: 0 }, { id: "p8", cx: 3, cy: 7 }, { id: "p9", cx: 15, cy: 8 }, { id: "p10", cx: 23, cy: 0 }, { id: "p11", cx: 7, cy: 4 }, { id: "p12", cx: 12, cy: 4 }, { id: "p13", cx: 21, cy: 9 }, { id: "p14", cx: 16, cy: 4 } ] },
      toyworks: { path: [ [0, 2], [20, 2], [20, 7], [3, 7], [3, 12], [23, 12] ], startGold: 540,
        pads: [ { id: "p1", cx: 2, cy: 6 }, { id: "p2", cx: 23, cy: 10 }, { id: "p3", cx: 14, cy: 0 }, { id: "p4", cx: 12, cy: 10 }, { id: "p5", cx: 21, cy: 1 }, { id: "p6", cx: 2, cy: 13 }, { id: "p7", cx: 6, cy: 0 }, { id: "p8", cx: 0, cy: 0 }, { id: "p9", cx: 9, cy: 5 }, { id: "p10", cx: 17, cy: 5 }, { id: "p11", cx: 6, cy: 9 }, { id: "p12", cx: 17, cy: 10 }, { id: "p13", cx: 21, cy: 8 }, { id: "p14", cx: 13, cy: 4 } ] },
      sortline: { path: [ [0, 1], [20, 1], [20, 7], [4, 7], [4, 12], [23, 12] ], startGold: 540,
        pads: [ { id: "p1", cx: 3, cy: 6 }, { id: "p2", cx: 21, cy: 0 }, { id: "p3", cx: 14, cy: 10 }, { id: "p4", cx: 23, cy: 10 }, { id: "p5", cx: 3, cy: 13 }, { id: "p6", cx: 10, cy: 3 }, { id: "p7", cx: 8, cy: 9 }, { id: "p8", cx: 16, cy: 3 }, { id: "p9", cx: 22, cy: 5 }, { id: "p10", cx: 21, cy: 8 }, { id: "p11", cx: 0, cy: 3 }, { id: "p12", cx: 6, cy: 3 }, { id: "p13", cx: 13, cy: 5 }, { id: "p14", cx: 18, cy: 10 } ] },
      newhouse: { path: [ [0, 5], [19, 5], [19, 10], [2, 10], [2, 0], [23, 0] ], startGold: 520,
        pads: [ { id: "p1", cx: 1, cy: 11 }, { id: "p2", cx: 23, cy: 2 }, { id: "p3", cx: 14, cy: 12 }, { id: "p4", cx: 8, cy: 2 }, { id: "p5", cx: 0, cy: 0 }, { id: "p6", cx: 20, cy: 11 }, { id: "p7", cx: 15, cy: 3 }, { id: "p8", cx: 7, cy: 8 }, { id: "p9", cx: 20, cy: 4 }, { id: "p10", cx: 12, cy: 7 }, { id: "p11", cx: 9, cy: 12 }, { id: "p12", cx: 17, cy: 7 }, { id: "p13", cx: 0, cy: 7 }, { id: "p14", cx: 4, cy: 3 } ] },
      garage: { path: [ [0, 3], [21, 3], [21, 8], [3, 8], [3, 13], [23, 13] ], startGold: 480,
        pads: [ { id: "p1", cx: 0, cy: 1 }, { id: "p2", cx: 23, cy: 11 }, { id: "p3", cx: 9, cy: 11 }, { id: "p4", cx: 16, cy: 1 }, { id: "p5", cx: 1, cy: 9 }, { id: "p6", cx: 8, cy: 1 }, { id: "p7", cx: 16, cy: 9 }, { id: "p8", cx: 22, cy: 4 }, { id: "p9", cx: 6, cy: 6 }, { id: "p10", cx: 11, cy: 6 }, { id: "p11", cx: 4, cy: 1 }, { id: "p12", cx: 5, cy: 11 }, { id: "p13", cx: 12, cy: 1 }, { id: "p14", cx: 1, cy: 13 } ] },
    },
  };

  const DATA = { GRID, TICK_RATE, DIFFICULTIES, RULES, ABILITIES, TOWERS, ENEMIES, WORLDS, BACKBONE_TYPES, PRE_CONTRACT_WORLDS, LEVELS, META_BRANCHES, META_NODES, ACHIEVEMENTS, ENDLESS };

  if (typeof module !== "undefined" && module.exports) module.exports = DATA;
  if (global && typeof global === "object") global.TDData = DATA;
})(typeof window !== "undefined" ? window : globalThis);
