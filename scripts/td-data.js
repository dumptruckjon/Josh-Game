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
    // 🧸 KID: Josh's mode. Not a difficulty tier — a different contract. RULE 5
    // forbids failure states for him, so `noLose` is honoured by the engine: a
    // leak still costs a sticker, but the fort door never actually falls. Weak
    // toys and heaps of gold mean building anything at all works.
    kid: { hp: 0.35, speed: 0.8, bounty: 2.5, startGold: 900, noLose: true },
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
    sellRefund: 0.8,
    stars: [[18, 3], [10, 2], [1, 1]],
    slowCap: 0.6,        // slows never stack — strongest wins, capped (§5.1)
    flierSlowFactor: 0.5, // fliers take half slow
    brittleBonus: 1.2,   // brittle enemies take +20% of ALL damage
    soldierWalkSpeed: 2, // cells/sec to the rally point
    nightRangeMult: 0.85, // TD-4 night levels: −15% tower reach (Fan exempt)
    leverCooldown: 8, // TD-7: seconds between L10 track-switch pulls
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
  const ABILITIES = [
    { id: "drop", short: "Blast", icon: "🧨", name: "Toy Box Drop", role: "big splash where you tap",
      gold: 130, cooldown: 25, kind: "point", radius: 2.4, dmg: 300, dmgType: "bonk" },
    { id: "sticky", short: "Sticky", icon: "🍯", name: "Sticky Floor", role: "slows everything in the puddle",
      gold: 90, cooldown: 20, kind: "point", radius: 2.0, slow: 0.5, seconds: 8 },
    { id: "overclock", short: "Boost", icon: "⚡", name: "Overclock", role: "one tower fires twice as fast",
      gold: 100, cooldown: 22, kind: "tower", mult: 2, seconds: 8 },
    { id: "horn", short: "Rally", icon: "📣", name: "Rally Horn", role: "every soldier back on their feet",
      gold: 80, cooldown: 30, kind: "instant" },
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
        a: { name: "Sniper Scope", cost: 260, dmg: 85, dmgType: "bonk", rate: 2.2, range: 5.5, crit: 0.15, critMult: 2.5, defaultTargeting: "strong" },
        b: { name: "Minigun", cost: 280, dmg: 9, dmgType: "bonk", rate: 0.12, range: 2.2, spinUp: 1.2, heatFloor: 0.3 },
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
        a: { name: "Big Bertha", cost: 320, dmg: 105, dmgType: "bonk", rate: 4.0, rangeMin: 1.5, range: 4.4, splash: 2.2 },
        b: { name: "Sticky Bomb", cost: 300, dmg: 60, dmgType: "bonk", rate: 2.8, rangeMin: 1.5, range: 4.0, splash: 1.7, goo: { slow: 0.4, seconds: 2.5 } }, // dmg 46→60: was a straight DPS DOWNGRADE from Crate Cannon (58); now it matches + adds goo
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
        a: { name: "Blizzard Cone", cost: 300, slow: 0.6, auraRange: 2.6, zapDps: 16, zapRange: 2.6, brittle: 3 }, // zap 12→16: keeps it ABOVE tier-3 Freezer Blast (14) after the tier zap re-tune, so the upgrade never reads as a zap downgrade; brittle linger seconds
        b: { name: "Static Zap", cost: 320, slow: 0.4, auraRange: 2.4, chain: { dmg: 30, targets: 4, decay: 0.75, jump: 1.5, rate: 1.1 }, zapRange: 2.6 },
      },
    },
    camp: {
      name: "Army Guys Camp", icon: "🪖", kind: "camp", role: "blocks path", hitsFliers: false,
      rallyRange: 2.5,
      tiers: [
        { name: "Army Guys", cost: 90, soldiers: 3, hp: 55, dmg: 4, rate: 0.9, armor: 0, respawn: 8 },
        { name: "Sarge Squad", cost: 150, soldiers: 3, hp: 85, dmg: 8, rate: 0.9, armor: 0.25, respawn: 8 },
        { name: "Elite Platoon", cost: 210, soldiers: 3, hp: 120, dmg: 13, rate: 0.85, armor: 0.25, respawn: 8 },
      ],
      branches: {
        a: { name: "Dino Squad", cost: 300, soldiers: 2, hp: 260, dmg: 22, rate: 1.0, armor: 0.25, respawn: 8, blocks: 2 },
        b: { name: "RC Racers", cost: 280, soldiers: 4, hp: 70, dmg: 9, rate: 0.7, armor: 0, respawn: 4, stun: 0.5 }, // dmg 7→9: squad DPS 40→51.4 > Elite Platoon 45.88, so 4 fast stunning blockers is no longer a hold DOWNGRADE
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
    vacuumking: { name: "Vacuum King", icon: "🌪️", hp: 8000, speed: 0.3, armor: 0.25, shield: 60, shieldRegen: 10, bounty: 300, lives: 8, size: 3.2, flier: false, boss: true, meleeDmg: 0, meleeRate: 1, suck: { every: 8 }, enrage: { hpPct: 0.5, mult: 1.2 }, phases: [{ upTo: 1.0 }, { upTo: 0.5, disable: { every: 6, seconds: 3 } }] }, // inhales the nearest soldier every 8s (instant KO); under half hp it also jams a random gun + a 1.2× hustle
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
  const WORLDS = {
    bedroom:  { label: "🛏️ Bedroom",  spawnGlyph: "🛏️" },
    backyard: { label: "🌳 Backyard", spawnGlyph: "🌳" },
    toystore: { label: "🧸 Toy Store", spawnGlyph: "🧸" },
    attic:    { label: "🧳 Attic",    spawnGlyph: "🧳" },
    garage:   { label: "🔧 Garage",   spawnGlyph: "🔧" },
    moving:   { label: "📦 Moving Day", spawnGlyph: "📦" },
  };

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
      // set isn't the first time you meet one. Default (short) route unchanged.
      paths: [
        [ [0, 12], [4, 12], [4, 3], [11, 3], [11, 10], [18, 10], [18, 3], [23, 3] ],
        [ [0, 12], [4, 12], [4, 3], [11, 3], [11, 10], [18, 10], [18, 9], [10, 9], [10, 3], [18, 3], [23, 3] ],
      ],
      fork: { at: 35 },   // shared-prefix length — where the tracks split
      lever: { cx: 18, cy: 9 }, // tap it to send the traffic the long way
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
        { boss: true, groups: [ { type: "bedmonster", count: 1, gap: 1, delay: 0 }, { type: "knight", count: 2, gap: 1.5, delay: 10 }, { type: "sock", count: 6, gap: 0.8, delay: 18 } ] },
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
        { groups: [ { type: "sock", count: 8, gap: 0.85, delay: 0 }, { type: "marble", count: 5, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "sock", count: 7, gap: 0.85, delay: 0 }, { type: "marble", count: 11, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "mole", count: 3, gap: 0.9, delay: 0 }, { type: "sock", count: 6, gap: 0.85, delay: 3 }, { type: "marble", count: 6, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "mole", count: 4, gap: 0.9, delay: 0 }, { type: "sock", count: 6, gap: 0.85, delay: 3 }, { type: "marble", count: 7, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "knight", count: 3, gap: 1, delay: 0 }, { type: "mole", count: 3, gap: 0.9, delay: 3 }, { type: "sock", count: 6, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 3, gap: 1, delay: 0 }, { type: "mole", count: 3, gap: 0.9, delay: 3 }, { type: "marble", count: 10, gap: 0.55, delay: 4 }, { type: "slime", count: 1, gap: 0.9, delay: 3, at: 22 } ] },
        { groups: [ { type: "blob", count: 5, gap: 0.85, delay: 0 }, { type: "mole", count: 4, gap: 0.9, delay: 3 }, { type: "sock", count: 7, gap: 0.85, delay: 4 }, { type: "slime", count: 1, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "knight", count: 4, gap: 1, delay: 0 }, { type: "mole", count: 3, gap: 0.9, delay: 3 }, { type: "marble", count: 11, gap: 0.55, delay: 4 }, { type: "hawk", count: 3, gap: 0.3, delay: 2 }, { type: "slime", count: 2, gap: 0.9, delay: 3 }, { type: "tinplane", count: 2, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "blob", count: 5, gap: 0.85, delay: 0 }, { type: "knight", count: 3, gap: 1, delay: 3 }, { type: "mole", count: 4, gap: 0.9, delay: 4 }, { type: "hawk", count: 4, gap: 0.3, delay: 2 }, { type: "slime", count: 2, gap: 0.9, delay: 3 }, { type: "tinplane", count: 2, gap: 0.45, delay: 5, at: 22 } ] },
        { groups: [ { type: "knight", count: 5, gap: 1, delay: 0 }, { type: "mole", count: 4, gap: 0.9, delay: 3 }, { type: "blob", count: 5, gap: 0.85, delay: 4 }, { type: "hawk", count: 5, gap: 0.3, delay: 2 }, { type: "slime", count: 2, gap: 0.9, delay: 3 }, { type: "tinplane", count: 2, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 6, gap: 1, delay: 0 }, { type: "blob", count: 6, gap: 0.85, delay: 3 }, { type: "mole", count: 5, gap: 0.9, delay: 4 }, { type: "sock", count: 2, gap: 0.85, delay: 5 }, { type: "hawk", count: 5, gap: 0.3, delay: 2 }, { type: "slime", count: 3, gap: 0.9, delay: 3 }, { type: "tinplane", count: 3, gap: 0.45, delay: 5 } ] },
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
        { groups: [ { type: "sock", count: 9, gap: 0.85, delay: 0 }, { type: "marble", count: 6, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 5, gap: 0.9, delay: 0 }, { type: "sock", count: 5, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 5, gap: 0.9, delay: 0 }, { type: "sock", count: 6, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 6, gap: 0.9, delay: 0 }, { type: "marble", count: 14, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 7, gap: 0.9, delay: 0 }, { type: "sock", count: 7, gap: 0.85, delay: 3 }, { type: "marble", count: 8, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "ghost", count: 7, gap: 0.9, delay: 0 }, { type: "sock", count: 9, gap: 0.85, delay: 3 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "knight", count: 3, gap: 1, delay: 0 }, { type: "ghost", count: 5, gap: 0.9, delay: 3 }, { type: "marble", count: 10, gap: 0.55, delay: 4 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "knight", count: 4, gap: 1, delay: 0 }, { type: "ghost", count: 5, gap: 0.9, delay: 3 }, { type: "sock", count: 3, gap: 0.85, delay: 4 }, { type: "hawk", count: 3, gap: 0.3, delay: 2 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 }, { type: "tinplane", count: 2, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "blob", count: 5, gap: 0.85, delay: 0 }, { type: "ghost", count: 5, gap: 0.9, delay: 3 }, { type: "marble", count: 9, gap: 0.55, delay: 4 }, { type: "hawk", count: 6, gap: 0.3, delay: 2 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 }, { type: "tinplane", count: 2, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "blob", count: 6, gap: 0.85, delay: 0 }, { type: "ghost", count: 6, gap: 0.9, delay: 3 }, { type: "knight", count: 3, gap: 1, delay: 4 }, { type: "hawk", count: 4, gap: 0.3, delay: 2 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 }, { type: "tinplane", count: 2, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 6, gap: 1, delay: 0 }, { type: "ghost", count: 7, gap: 0.9, delay: 3 }, { type: "blob", count: 4, gap: 0.85, delay: 4 }, { type: "hawk", count: 5, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "tinplane", count: 2, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 8, gap: 1, delay: 0 }, { type: "ghost", count: 8, gap: 0.9, delay: 3 }, { type: "blob", count: 5, gap: 0.85, delay: 4 }, { type: "sock", count: 3, gap: 0.85, delay: 5 }, { type: "hawk", count: 7, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "tinplane", count: 3, gap: 0.45, delay: 5 } ] },
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
        { groups: [ { type: "sock", count: 8, gap: 0.85, delay: 0 }, { type: "marble", count: 12, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "hawk", count: 7, gap: 0.5, delay: 0 }, { type: "sock", count: 9, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "hawk", count: 8, gap: 0.5, delay: 0 }, { type: "marble", count: 13, gap: 0.55, delay: 3 }, { type: "sock", count: 4, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "hawk", count: 9, gap: 0.5, delay: 0 }, { type: "sock", count: 13, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "balloon", count: 6, gap: 1.1, delay: 0 }, { type: "hawk", count: 8, gap: 0.5, delay: 3 }, { type: "marble", count: 25, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "knight", count: 4, gap: 1, delay: 0 }, { type: "hawk", count: 10, gap: 0.5, delay: 3 }, { type: "sock", count: 10, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 6, gap: 1, delay: 0 }, { type: "hawk", count: 11, gap: 0.5, delay: 3 }, { type: "marble", count: 22, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "blob", count: 9, gap: 0.85, delay: 0 }, { type: "hawk", count: 12, gap: 0.5, delay: 3 }, { type: "sock", count: 12, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 6, gap: 1, delay: 0 }, { type: "hawk", count: 11, gap: 0.5, delay: 3 }, { type: "blob", count: 6, gap: 0.85, delay: 4 }, { type: "hawk", count: 11, gap: 0.3, delay: 2 } ] },
        { groups: [ { type: "knight", count: 8, gap: 1, delay: 0 }, { type: "hawk", count: 13, gap: 0.5, delay: 3 }, { type: "balloon", count: 8, gap: 1.1, delay: 4 }, { type: "hawk", count: 12, gap: 0.3, delay: 2 } ] },
        { groups: [ { type: "knight", count: 10, gap: 1, delay: 0 }, { type: "hawk", count: 14, gap: 0.5, delay: 3 }, { type: "blob", count: 8, gap: 0.85, delay: 4 }, { type: "sock", count: 5, gap: 0.85, delay: 5 }, { type: "hawk", count: 16, gap: 0.3, delay: 2 } ] },
        { groups: [ { type: "knight", count: 11, gap: 1, delay: 0 }, { type: "hawk", count: 18, gap: 0.5, delay: 3 }, { type: "blob", count: 10, gap: 0.85, delay: 4 }, { type: "hawk", count: 18, gap: 0.3, delay: 2 } ] },
        { groups: [ { type: "knight", count: 13, gap: 1, delay: 0 }, { type: "hawk", count: 21, gap: 0.5, delay: 3 }, { type: "blob", count: 11, gap: 0.85, delay: 4 }, { type: "sock", count: 6, gap: 0.85, delay: 5 }, { type: "hawk", count: 22, gap: 0.3, delay: 2 } ] },
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
        { groups: [ { type: "sock", count: 9, gap: 0.85, delay: 0 }, { type: "knight", count: 3, gap: 1, delay: 3 } ] },
        { groups: [ { type: "battery", count: 6, gap: 0.9, delay: 0 }, { type: "sock", count: 6, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "battery", count: 6, gap: 0.9, delay: 0 }, { type: "marble", count: 20, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "knight", count: 5, gap: 1, delay: 0 }, { type: "battery", count: 5, gap: 0.9, delay: 3 }, { type: "sock", count: 4, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 6, gap: 1, delay: 0 }, { type: "battery", count: 6, gap: 0.9, delay: 3 }, { type: "marble", count: 10, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.85, delay: 0 }, { type: "battery", count: 8, gap: 0.9, delay: 3 }, { type: "sock", count: 8, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 7, gap: 1, delay: 0 }, { type: "battery", count: 7, gap: 0.9, delay: 3 }, { type: "marble", count: 15, gap: 0.55, delay: 4 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "knight", count: 8, gap: 1, delay: 0 }, { type: "battery", count: 8, gap: 0.9, delay: 3 }, { type: "blob", count: 5, gap: 0.85, delay: 4 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "knight", count: 7, gap: 1, delay: 0 }, { type: "battery", count: 7, gap: 0.9, delay: 3 }, { type: "balloon", count: 5, gap: 1.1, delay: 4 }, { type: "hawk", count: 6, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "tinplane", count: 3, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 9, gap: 1, delay: 0 }, { type: "battery", count: 8, gap: 0.9, delay: 3 }, { type: "blob", count: 5, gap: 0.85, delay: 4 }, { type: "hawk", count: 8, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "tinplane", count: 3, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 9, gap: 1, delay: 0 }, { type: "battery", count: 9, gap: 0.9, delay: 3 }, { type: "blob", count: 6, gap: 0.85, delay: 4 }, { type: "hawk", count: 8, gap: 0.3, delay: 2 }, { type: "cushion", count: 3, gap: 0.9, delay: 3 }, { type: "tinplane", count: 4, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 11, gap: 1, delay: 0 }, { type: "battery", count: 10, gap: 0.9, delay: 3 }, { type: "blob", count: 8, gap: 0.85, delay: 4 }, { type: "sock", count: 4, gap: 0.85, delay: 5 }, { type: "hawk", count: 10, gap: 0.3, delay: 2 }, { type: "cushion", count: 3, gap: 0.9, delay: 3 }, { type: "tinplane", count: 5, gap: 0.45, delay: 5 } ] },
        { boss: true, groups: [ { type: "vacuumking", count: 1, gap: 1, delay: 0 }, { type: "knight", count: 4, gap: 1, delay: 10 }, { type: "battery", count: 6, gap: 0.9, delay: 20 }, { type: "sock", count: 8, gap: 0.85, delay: 32 } ] },
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
        { groups: [ { type: "sock", count: 10, gap: 0.85, delay: 0 }, { type: "knight", count: 3, gap: 1, delay: 3 } ] },
        { groups: [ { type: "battery", count: 6, gap: 0.9, delay: 0 }, { type: "marble", count: 16, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 8, gap: 0.9, delay: 0 }, { type: "knight", count: 4, gap: 1, delay: 3 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.85, delay: 0 }, { type: "ghost", count: 6, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "knight", count: 7, gap: 1, delay: 0 }, { type: "battery", count: 7, gap: 0.9, delay: 3 }, { type: "marble", count: 4, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "knight", count: 9, gap: 1, delay: 0 }, { type: "ghost", count: 8, gap: 0.9, delay: 3 }, { type: "sock", count: 4, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "blob", count: 12, gap: 0.85, delay: 0 }, { type: "battery", count: 8, gap: 0.9, delay: 3 }, { type: "marble", count: 7, gap: 0.55, delay: 4 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 }, { type: "screw", count: 1, gap: 0.9, delay: 4 } ] },
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
        { groups: [ { type: "sock", count: 12, gap: 0.85, delay: 0 }, { type: "knight", count: 3, gap: 1, delay: 3 } ] },
        { groups: [ { type: "mole", count: 7, gap: 0.9, delay: 0 }, { type: "marble", count: 10, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "mole", count: 6, gap: 0.9, delay: 0 }, { type: "knight", count: 5, gap: 1, delay: 3 } ] },
        { groups: [ { type: "blob", count: 9, gap: 0.85, delay: 0 }, { type: "mole", count: 6, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "knight", count: 8, gap: 1, delay: 0 }, { type: "mole", count: 6, gap: 0.9, delay: 3 }, { type: "battery", count: 2, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 10, gap: 1, delay: 0 }, { type: "mole", count: 7, gap: 0.9, delay: 3 }, { type: "marble", count: 6, gap: 0.55, delay: 4 } ] },
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
        { groups: [ { type: "sock", count: 14, gap: 0.85, delay: 0 }, { type: "knight", count: 3, gap: 1, delay: 3 } ] },
        { groups: [ { type: "marble", count: 20, gap: 0.55, delay: 0 }, { type: "knight", count: 6, gap: 1, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "sock", count: 12, gap: 0.85, delay: 3 }, { type: "marble", count: 12, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "knight", count: 8, gap: 1, delay: 0 }, { type: "battery", count: 7, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "knight", count: 8, gap: 1, delay: 3 }, { type: "ghost", count: 5, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 12, gap: 1, delay: 0 }, { type: "mole", count: 8, gap: 0.9, delay: 3 }, { type: "marble", count: 4, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "knight", count: 10, gap: 1, delay: 3 }, { type: "battery", count: 6, gap: 0.9, delay: 4 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 14, gap: 1, delay: 0 }, { type: "ghost", count: 9, gap: 0.9, delay: 3 }, { type: "mole", count: 5, gap: 0.9, delay: 4 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "knight", count: 10, gap: 1, delay: 3 }, { type: "battery", count: 7, gap: 0.9, delay: 4 }, { type: "cushion", count: 1, gap: 0.9, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 13, gap: 1, delay: 0 }, { type: "mole", count: 7, gap: 0.9, delay: 3 }, { type: "ghost", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 15, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "tinplane", count: 7, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "knight", count: 12, gap: 1, delay: 3 }, { type: "battery", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 16, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "tinplane", count: 7, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 17, gap: 1, delay: 0 }, { type: "mole", count: 9, gap: 0.9, delay: 3 }, { type: "blob", count: 9, gap: 0.85, delay: 4 }, { type: "hawk", count: 20, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "tinplane", count: 9, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "knight", count: 14, gap: 1, delay: 3 }, { type: "battery", count: 9, gap: 0.9, delay: 4 }, { type: "hawk", count: 20, gap: 0.3, delay: 2 }, { type: "cushion", count: 2, gap: 0.9, delay: 3 }, { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "tinplane", count: 9, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 23, gap: 1, delay: 0 }, { type: "mole", count: 11, gap: 0.9, delay: 3 }, { type: "blob", count: 9, gap: 0.85, delay: 4 }, { type: "ghost", count: 5, gap: 0.9, delay: 5 }, { type: "hawk", count: 28, gap: 0.3, delay: 2 }, { type: "cushion", count: 3, gap: 0.9, delay: 3 }, { type: "screw", count: 5, gap: 0.9, delay: 4 }, { type: "tinplane", count: 13, gap: 0.45, delay: 5 } ] },
        { groups: [ { type: "knight", count: 26, gap: 1, delay: 0 }, { type: "mole", count: 13, gap: 0.9, delay: 3 }, { type: "blob", count: 11, gap: 0.85, delay: 4 }, { type: "battery", count: 7, gap: 0.9, delay: 5 }, { type: "hawk", count: 34, gap: 0.3, delay: 2 }, { type: "cushion", count: 4, gap: 0.9, delay: 3 }, { type: "screw", count: 6, gap: 0.9, delay: 4 }, { type: "tinplane", count: 15, gap: 0.45, delay: 5, at: 42 } ] },
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
        { groups: [ { type: "ghost", count: 10, gap: 0.9, delay: 0 }, { type: "sock", count: 8, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "battery", count: 8, gap: 0.9, delay: 0 }, { type: "sock", count: 12, gap: 0.85, delay: 3 } ] },
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
        { boss: true, groups: [ { type: "thestatic", count: 1, gap: 1, delay: 0 }, { type: "knight", count: 6, gap: 1, delay: 10 }, { type: "battery", count: 8, gap: 0.9, delay: 20 }, { type: "ghost", count: 8, gap: 0.9, delay: 32 } ] },
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
        { groups: [ { type: "sock", count: 13, gap: 0.6, delay: 0 }, { type: "knight", count: 4, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "marble", count: 34, gap: 0.6, delay: 0 }, { type: "blob", count: 7, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "knight", count: 7, gap: 0.6, delay: 0 }, { type: "sock", count: 15, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "blob", count: 12, gap: 0.6, delay: 0 }, { type: "marble", count: 40, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "sock", count: 21, gap: 0.6, delay: 0 }, { type: "knight", count: 7, gap: 0.75, delay: 3 }, { type: "screw", count: 3, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "marble", count: 53, gap: 0.6, delay: 0 }, { type: "blob", count: 12, gap: 0.75, delay: 3 }, { type: "mole", count: 5, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 8, gap: 0.6, delay: 0 }, { type: "sock", count: 19, gap: 0.75, delay: 3 }, { type: "ghost", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 15, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "blob", count: 15, gap: 0.6, delay: 0 }, { type: "marble", count: 46, gap: 0.75, delay: 3 }, { type: "battery", count: 7, gap: 0.9, delay: 4 }, { type: "tinplane", count: 10, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "sock", count: 28, gap: 0.6, delay: 0 }, { type: "knight", count: 8, gap: 0.75, delay: 3 }, { type: "cushion", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 21, gap: 0.35, delay: 2, at: 30 } ] },
        { groups: [ { type: "marble", count: 69, gap: 0.6, delay: 0 }, { type: "blob", count: 15, gap: 0.75, delay: 3 }, { type: "slime", count: 8, gap: 0.9, delay: 4 }, { type: "tinplane", count: 13, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "knight", count: 15, gap: 0.6, delay: 0 }, { type: "sock", count: 30, gap: 0.75, delay: 3 }, { type: "screw", count: 11, gap: 0.9, delay: 4 }, { type: "hawk", count: 29, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "blob", count: 26, gap: 0.6, delay: 0 }, { type: "marble", count: 78, gap: 0.75, delay: 3 }, { type: "mole", count: 20, gap: 0.9, delay: 4 }, { type: "tinplane", count: 19, gap: 0.35, delay: 2, at: 30 } ] },
        { groups: [ { type: "sock", count: 54, gap: 0.6, delay: 0 }, { type: "knight", count: 16, gap: 0.75, delay: 3 }, { type: "ghost", count: 27, gap: 0.9, delay: 4 }, { type: "hawk", count: 40, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "marble", count: 134, gap: 0.6, delay: 0 }, { type: "blob", count: 29, gap: 0.75, delay: 3 }, { type: "battery", count: 25, gap: 0.9, delay: 4 }, { type: "tinplane", count: 26, gap: 0.35, delay: 2 } ] },
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
      pads: [ { id: "p1", cx: 0, cy: 4 }, { id: "p2", cx: 3, cy: 5 }, { id: "p3", cx: 9, cy: 6 }, { id: "p4", cx: 5, cy: 1 }, { id: "p5", cx: 14, cy: 2 }, { id: "p6", cx: 11, cy: 6 }, { id: "p7", cx: 15, cy: 9 }, { id: "p8", cx: 6, cy: 11 }, { id: "p9", cx: 17, cy: 11 }, { id: "p10", cx: 17, cy: 9 }, { id: "p11", cx: 18, cy: 6 }, { id: "p12", cx: 18, cy: 2 } ],
      waves: [
        { groups: [ { type: "sock", count: 9, gap: 0.6, delay: 0 }, { type: "knight", count: 3, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "marble", count: 22, gap: 0.6, delay: 0 }, { type: "blob", count: 5, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "knight", count: 5, gap: 0.6, delay: 0 }, { type: "sock", count: 9, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "blob", count: 8, gap: 0.6, delay: 0 }, { type: "marble", count: 26, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "sock", count: 14, gap: 0.6, delay: 0 }, { type: "knight", count: 4, gap: 0.75, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "marble", count: 35, gap: 0.6, delay: 0 }, { type: "blob", count: 8, gap: 0.75, delay: 3 }, { type: "mole", count: 3, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 6, gap: 0.6, delay: 0 }, { type: "sock", count: 11, gap: 0.75, delay: 3 }, { type: "ghost", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 10, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.6, delay: 0 }, { type: "marble", count: 30, gap: 0.75, delay: 3 }, { type: "battery", count: 4, gap: 0.9, delay: 4 }, { type: "tinplane", count: 6, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "sock", count: 18, gap: 0.6, delay: 0 }, { type: "knight", count: 6, gap: 0.75, delay: 3 }, { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 14, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "marble", count: 46, gap: 0.6, delay: 0 }, { type: "blob", count: 10, gap: 0.75, delay: 3 }, { type: "slime", count: 5, gap: 0.9, delay: 4 }, { type: "tinplane", count: 9, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "knight", count: 10, gap: 0.6, delay: 0 }, { type: "sock", count: 19, gap: 0.75, delay: 3 }, { type: "screw", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 19, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "blob", count: 17, gap: 0.6, delay: 0 }, { type: "marble", count: 51, gap: 0.75, delay: 3 }, { type: "mole", count: 13, gap: 0.9, delay: 4 }, { type: "tinplane", count: 12, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "sock", count: 35, gap: 0.6, delay: 0 }, { type: "knight", count: 11, gap: 0.75, delay: 3 }, { type: "ghost", count: 18, gap: 0.9, delay: 4 }, { type: "hawk", count: 26, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "marble", count: 88, gap: 0.6, delay: 0 }, { type: "blob", count: 19, gap: 0.75, delay: 3 }, { type: "battery", count: 17, gap: 0.9, delay: 4 }, { type: "tinplane", count: 17, gap: 0.35, delay: 2 } ] },
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
        { groups: [ { type: "sock", count: 10, gap: 0.6, delay: 0 }, { type: "knight", count: 3, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "marble", count: 25, gap: 0.6, delay: 0 }, { type: "blob", count: 5, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "knight", count: 5, gap: 0.6, delay: 0 }, { type: "sock", count: 12, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "blob", count: 9, gap: 0.6, delay: 0 }, { type: "marble", count: 29, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "sock", count: 16, gap: 0.6, delay: 0 }, { type: "knight", count: 5, gap: 0.75, delay: 3 }, { type: "screw", count: 2, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "marble", count: 40, gap: 0.6, delay: 0 }, { type: "blob", count: 9, gap: 0.75, delay: 3 }, { type: "mole", count: 4, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 6, gap: 0.6, delay: 0 }, { type: "sock", count: 14, gap: 0.75, delay: 3 }, { type: "ghost", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 11, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "blob", count: 11, gap: 0.6, delay: 0 }, { type: "marble", count: 34, gap: 0.75, delay: 3 }, { type: "battery", count: 5, gap: 0.9, delay: 4 }, { type: "tinplane", count: 7, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "sock", count: 23, gap: 0.6, delay: 0 }, { type: "knight", count: 7, gap: 0.75, delay: 3 }, { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 15, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "marble", count: 51, gap: 0.6, delay: 0 }, { type: "blob", count: 11, gap: 0.75, delay: 3 }, { type: "slime", count: 6, gap: 0.9, delay: 4 }, { type: "tinplane", count: 10, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "knight", count: 11, gap: 0.6, delay: 0 }, { type: "sock", count: 23, gap: 0.75, delay: 3 }, { type: "screw", count: 8, gap: 0.9, delay: 4 }, { type: "hawk", count: 21, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "blob", count: 19, gap: 0.6, delay: 0 }, { type: "marble", count: 59, gap: 0.75, delay: 3 }, { type: "mole", count: 15, gap: 0.9, delay: 4 }, { type: "tinplane", count: 14, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "sock", count: 40, gap: 0.6, delay: 0 }, { type: "knight", count: 12, gap: 0.75, delay: 3 }, { type: "ghost", count: 20, gap: 0.9, delay: 4 }, { type: "hawk", count: 30, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "marble", count: 100, gap: 0.6, delay: 0 }, { type: "blob", count: 22, gap: 0.75, delay: 3 }, { type: "battery", count: 19, gap: 0.9, delay: 4 }, { type: "tinplane", count: 19, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "knight", count: 21, gap: 0.6, delay: 0 }, { type: "sock", count: 45, gap: 0.75, delay: 3 }, { type: "cushion", count: 10, gap: 0.9, delay: 4 }, { type: "hawk", count: 42, gap: 0.35, delay: 2 } ] },
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
        { groups: [ { type: "sock", count: 11, gap: 0.6, delay: 0 }, { type: "knight", count: 4, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "marble", count: 29, gap: 0.6, delay: 0 }, { type: "blob", count: 6, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "knight", count: 6, gap: 0.6, delay: 0 }, { type: "sock", count: 13, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "blob", count: 11, gap: 0.6, delay: 0 }, { type: "marble", count: 31, gap: 0.75, delay: 3 } ] },
        { groups: [ { type: "sock", count: 18, gap: 0.6, delay: 0 }, { type: "knight", count: 6, gap: 0.75, delay: 3 }, { type: "screw", count: 3, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "marble", count: 46, gap: 0.6, delay: 0 }, { type: "blob", count: 10, gap: 0.75, delay: 3 }, { type: "mole", count: 4, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 7, gap: 0.6, delay: 0 }, { type: "sock", count: 16, gap: 0.75, delay: 3 }, { type: "ghost", count: 6, gap: 0.9, delay: 4 }, { type: "hawk", count: 13, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "blob", count: 13, gap: 0.6, delay: 0 }, { type: "marble", count: 39, gap: 0.75, delay: 3 }, { type: "battery", count: 6, gap: 0.9, delay: 4 }, { type: "tinplane", count: 8, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "sock", count: 27, gap: 0.6, delay: 0 }, { type: "knight", count: 8, gap: 0.75, delay: 3 }, { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 18, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "marble", count: 59, gap: 0.6, delay: 0 }, { type: "blob", count: 13, gap: 0.75, delay: 3 }, { type: "slime", count: 7, gap: 0.9, delay: 4 }, { type: "tinplane", count: 11, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "knight", count: 12, gap: 0.6, delay: 0 }, { type: "sock", count: 28, gap: 0.75, delay: 3 }, { type: "screw", count: 10, gap: 0.9, delay: 4 }, { type: "hawk", count: 25, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "blob", count: 22, gap: 0.6, delay: 0 }, { type: "marble", count: 68, gap: 0.75, delay: 3 }, { type: "mole", count: 17, gap: 0.9, delay: 4 }, { type: "tinplane", count: 16, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "sock", count: 46, gap: 0.6, delay: 0 }, { type: "knight", count: 14, gap: 0.75, delay: 3 }, { type: "ghost", count: 23, gap: 0.9, delay: 4 }, { type: "hawk", count: 34, gap: 0.35, delay: 2 } ] },
        { groups: [ { type: "marble", count: 115, gap: 0.6, delay: 0 }, { type: "blob", count: 25, gap: 0.75, delay: 3 }, { type: "battery", count: 22, gap: 0.9, delay: 4 }, { type: "tinplane", count: 22, gap: 0.35, delay: 2 } ] },
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
        { groups: [ { type: "sock", count: 14, gap: 0.65, delay: 0 }, { type: "knight", count: 4, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.65, delay: 0 }, { type: "marble", count: 24, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "sock", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 12, gap: 0.65, delay: 0 }, { type: "marble", count: 30, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 3, gap: 0.9, delay: 4 }, { type: "sock", count: 25, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "blob", count: 16, gap: 0.65, delay: 0 }, { type: "marble", count: 40, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 8, gap: 0.3, delay: 2 }, { type: "sock", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 11, gap: 0.3, delay: 2 }, { type: "blob", count: 19, gap: 0.65, delay: 0 }, { type: "marble", count: 46, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 8, gap: 0.9, delay: 4 }, { type: "hawk", count: 13, gap: 0.3, delay: 2 }, { type: "sock", count: 37, gap: 0.65, delay: 0 }, { type: "knight", count: 10, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 12, gap: 0.9, delay: 4 }, { type: "hawk", count: 17, gap: 0.3, delay: 2 }, { type: "blob", count: 25, gap: 0.65, delay: 0 }, { type: "marble", count: 62, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 12, gap: 0.9, delay: 4 }, { type: "hawk", count: 22, gap: 0.3, delay: 2 }, { type: "sock", count: 49, gap: 0.65, delay: 0 }, { type: "knight", count: 13, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 10, gap: 0.9, delay: 4 }, { type: "hawk", count: 27, gap: 0.3, delay: 2 }, { type: "blob", count: 32, gap: 0.65, delay: 0 }, { type: "marble", count: 80, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 25, gap: 0.9, delay: 4 }, { type: "hawk", count: 34, gap: 0.3, delay: 2 }, { type: "sock", count: 64, gap: 0.65, delay: 0 }, { type: "knight", count: 16, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "racer", count: 24, gap: 0.9, delay: 4 }, { type: "hawk", count: 43, gap: 0.3, delay: 2 }, { type: "blob", count: 37, gap: 0.65, delay: 0 }, { type: "marble", count: 93, gap: 0.8, delay: 3 } ] },
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
      pads: [ { id: "p1", cx: 3, cy: 7 }, { id: "p2", cx: 23, cy: 2 }, { id: "p3", cx: 18, cy: 13 }, { id: "p4", cx: 12, cy: 2 }, { id: "p5", cx: 10, cy: 10 }, { id: "p6", cx: 18, cy: 5 }, { id: "p7", cx: 2, cy: 0 , boost: { range: 1.18, rate: 1.15 } }, { id: "p8", cx: 6, cy: 3 }, { id: "p9", cx: 15, cy: 9 }, { id: "p10", cx: 0, cy: 10 }, { id: "p11", cx: 6, cy: 10 }, { id: "p12", cx: 19, cy: 9 } ],
      waves: [
        { groups: [ { type: "sock", count: 16, gap: 0.65, delay: 0 }, { type: "knight", count: 4, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 11, gap: 0.65, delay: 0 }, { type: "marble", count: 26, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "sock", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 13, gap: 0.65, delay: 0 }, { type: "marble", count: 32, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 4, gap: 0.9, delay: 4 }, { type: "sock", count: 26, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bucket", count: 1, gap: 0.9, delay: 4 }, { type: "blob", count: 18, gap: 0.65, delay: 0 }, { type: "marble", count: 45, gap: 0.8, delay: 3, at: 31 } ] },
        { groups: [ { type: "battery", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 9, gap: 0.3, delay: 2 }, { type: "sock", count: 32, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 11, gap: 0.3, delay: 2 }, { type: "blob", count: 21, gap: 0.65, delay: 0 }, { type: "marble", count: 52, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "mole", count: 9, gap: 0.9, delay: 4 }, { type: "hawk", count: 15, gap: 0.3, delay: 2 }, { type: "sock", count: 42, gap: 0.65, delay: 0 }, { type: "knight", count: 10, gap: 0.8, delay: 3, at: 31 } ] },
        { groups: [ { type: "bucket", count: 2, gap: 0.9, delay: 4 }, { type: "hawk", count: 19, gap: 0.3, delay: 2 }, { type: "blob", count: 29, gap: 0.65, delay: 0 }, { type: "marble", count: 72, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 13, gap: 0.9, delay: 4 }, { type: "hawk", count: 23, gap: 0.3, delay: 2 }, { type: "sock", count: 54, gap: 0.65, delay: 0 }, { type: "knight", count: 14, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 11, gap: 0.9, delay: 4 }, { type: "hawk", count: 30, gap: 0.3, delay: 2 }, { type: "blob", count: 34, gap: 0.65, delay: 0 }, { type: "marble", count: 86, gap: 0.8, delay: 3, at: 31 } ] },
        { groups: [ { type: "tinplane", count: 27, gap: 0.9, delay: 4 }, { type: "hawk", count: 37, gap: 0.3, delay: 2 }, { type: "sock", count: 68, gap: 0.65, delay: 0 }, { type: "knight", count: 18, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "bucket", count: 4, gap: 0.9, delay: 4 }, { type: "hawk", count: 46, gap: 0.3, delay: 2 }, { type: "blob", count: 49, gap: 0.65, delay: 0 }, { type: "marble", count: 122, gap: 0.8, delay: 3 } ] },
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
        { groups: [ { type: "sock", count: 16, gap: 0.65, delay: 0 }, { type: "knight", count: 4, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 11, gap: 0.65, delay: 0 }, { type: "marble", count: 26, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "sock", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 3, gap: 0.9, delay: 4 }, { type: "blob", count: 13, gap: 0.65, delay: 0 }, { type: "marble", count: 33, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 3, gap: 0.9, delay: 4 }, { type: "sock", count: 26, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 7, gap: 0.3, delay: 2 }, { type: "blob", count: 16, gap: 0.65, delay: 0 }, { type: "marble", count: 39, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bucket", count: 1, gap: 0.9, delay: 4 }, { type: "hawk", count: 9, gap: 0.3, delay: 2 }, { type: "sock", count: 34, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 6, gap: 0.9, delay: 4 }, { type: "hawk", count: 11, gap: 0.3, delay: 2 }, { type: "blob", count: 21, gap: 0.65, delay: 0 }, { type: "marble", count: 53, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 8, gap: 0.9, delay: 4 }, { type: "hawk", count: 14, gap: 0.3, delay: 2 }, { type: "sock", count: 41, gap: 0.65, delay: 0 }, { type: "knight", count: 11, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 18, gap: 0.3, delay: 2 }, { type: "blob", count: 27, gap: 0.65, delay: 0 }, { type: "marble", count: 67, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "mole", count: 14, gap: 0.9, delay: 4 }, { type: "hawk", count: 23, gap: 0.3, delay: 2 }, { type: "sock", count: 54, gap: 0.65, delay: 0 }, { type: "knight", count: 14, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bucket", count: 2, gap: 0.9, delay: 4 }, { type: "hawk", count: 28, gap: 0.3, delay: 2 }, { type: "blob", count: 42, gap: 0.65, delay: 0 }, { type: "marble", count: 104, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "slime", count: 13, gap: 0.9, delay: 4 }, { type: "hawk", count: 35, gap: 0.3, delay: 2 }, { type: "sock", count: 65, gap: 0.65, delay: 0 }, { type: "knight", count: 16, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 25, gap: 0.9, delay: 4 }, { type: "hawk", count: 44, gap: 0.3, delay: 2 }, { type: "blob", count: 46, gap: 0.65, delay: 0 }, { type: "marble", count: 116, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 40, gap: 0.9, delay: 4 }, { type: "hawk", count: 55, gap: 0.3, delay: 2 }, { type: "sock", count: 94, gap: 0.65, delay: 0 }, { type: "knight", count: 23, gap: 0.8, delay: 3 } ] },
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
        { groups: [ { type: "sock", count: 14, gap: 0.65, delay: 0 }, { type: "knight", count: 4, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.65, delay: 0 }, { type: "marble", count: 24, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "sock", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 12, gap: 0.65, delay: 0 }, { type: "marble", count: 30, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "sock", count: 26, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 4, gap: 0.9, delay: 4 }, { type: "hawk", count: 6, gap: 0.3, delay: 2 }, { type: "blob", count: 15, gap: 0.65, delay: 0 }, { type: "marble", count: 37, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bucket", count: 1, gap: 0.9, delay: 4 }, { type: "hawk", count: 8, gap: 0.3, delay: 2 }, { type: "sock", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 10, gap: 0.3, delay: 2 }, { type: "blob", count: 19, gap: 0.65, delay: 0 }, { type: "marble", count: 47, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 13, gap: 0.3, delay: 2 }, { type: "sock", count: 39, gap: 0.65, delay: 0 }, { type: "knight", count: 10, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 9, gap: 0.9, delay: 4 }, { type: "hawk", count: 17, gap: 0.3, delay: 2 }, { type: "blob", count: 25, gap: 0.65, delay: 0 }, { type: "marble", count: 63, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "mole", count: 13, gap: 0.9, delay: 4 }, { type: "hawk", count: 21, gap: 0.3, delay: 2 }, { type: "sock", count: 49, gap: 0.65, delay: 0 }, { type: "knight", count: 13, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 9, gap: 0.9, delay: 4 }, { type: "hawk", count: 26, gap: 0.3, delay: 2 }, { type: "blob", count: 33, gap: 0.65, delay: 0 }, { type: "marble", count: 83, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "bucket", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 33, gap: 0.3, delay: 2 }, { type: "sock", count: 68, gap: 0.65, delay: 0 }, { type: "knight", count: 17, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 29, gap: 0.9, delay: 4 }, { type: "hawk", count: 41, gap: 0.3, delay: 2 }, { type: "blob", count: 43, gap: 0.65, delay: 0 }, { type: "marble", count: 107, gap: 0.8, delay: 3 } ] },
        { boss: true, groups: [ { type: "titan", count: 1, gap: 2, delay: 0 }, { type: "knight", count: 14, gap: 0.8, delay: 5 }, { type: "racer", count: 12, gap: 0.5, delay: 9 }, { type: "hawk", count: 16, gap: 0.35, delay: 14 } ] },
      ],
    },
    {
      id: 21,
      name: "Boxes by the Door",
      world: "moving",
      badge: 3,
      startGold: 1200,
      budgetBase: 720,
      // The world opens gently: a long lane with rows 6 apart, so exposure comes
      // from the walk rather than from one tower covering two runs.
      path: [[0, 1], [18, 1], [18, 7], [4, 7], [4, 13], [23, 13]],
      pads: [ { id: "p1", cx: 3, cy: 6 }, { id: "p2", cx: 23, cy: 11 }, { id: "p3", cx: 19, cy: 0 }, { id: "p4", cx: 12, cy: 11 }, { id: "p5", cx: 11, cy: 3 }, { id: "p6", cx: 2, cy: 13 }, { id: "p7", cx: 19, cy: 8 }, { id: "p8", cx: 6, cy: 10 }, { id: "p9", cx: 16, cy: 4 }, { id: "p10", cx: 0, cy: 3 }, { id: "p11", cx: 6, cy: 3 }, { id: "p12", cx: 16, cy: 11 } ],
      waves: [
        { groups: [ { type: "sock", count: 14, gap: 0.65, delay: 0 }, { type: "knight", count: 4, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.65, delay: 0 }, { type: "marble", count: 25, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "sock", count: 22, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 1, gap: 0.9, delay: 4 }, { type: "blob", count: 13, gap: 0.65, delay: 0 }, { type: "marble", count: 32, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "sock", count: 27, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 3, gap: 0.9, delay: 4 }, { type: "blob", count: 17, gap: 0.65, delay: 0 }, { type: "marble", count: 42, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 8, gap: 0.3, delay: 2 }, { type: "sock", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 11, gap: 0.3, delay: 2 }, { type: "blob", count: 19, gap: 0.65, delay: 0 }, { type: "marble", count: 48, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 6, gap: 0.9, delay: 4 }, { type: "hawk", count: 14, gap: 0.3, delay: 2 }, { type: "sock", count: 39, gap: 0.65, delay: 0 }, { type: "knight", count: 10, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 13, gap: 0.9, delay: 4 }, { type: "hawk", count: 18, gap: 0.3, delay: 2 }, { type: "blob", count: 25, gap: 0.65, delay: 0 }, { type: "marble", count: 63, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 22, gap: 0.3, delay: 2 }, { type: "sock", count: 50, gap: 0.65, delay: 0 }, { type: "knight", count: 13, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 10, gap: 0.9, delay: 4 }, { type: "hawk", count: 28, gap: 0.3, delay: 2 }, { type: "blob", count: 33, gap: 0.65, delay: 0 }, { type: "marble", count: 83, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 16, gap: 0.9, delay: 4 }, { type: "hawk", count: 35, gap: 0.3, delay: 2 }, { type: "sock", count: 67, gap: 0.65, delay: 0 }, { type: "knight", count: 16, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "bubblewrap", count: 13, gap: 0.9, delay: 4 }, { type: "hawk", count: 44, gap: 0.3, delay: 2 }, { type: "blob", count: 39, gap: 0.65, delay: 0 }, { type: "marble", count: 97, gap: 0.8, delay: 3 } ] },
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
        { groups: [ { type: "sock", count: 15, gap: 0.65, delay: 0 }, { type: "knight", count: 4, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.65, delay: 0 }, { type: "marble", count: 26, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "sock", count: 23, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 2, gap: 0.9, delay: 4 }, { type: "blob", count: 13, gap: 0.65, delay: 0 }, { type: "marble", count: 31, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 4, gap: 0.9, delay: 4 }, { type: "sock", count: 25, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 3, gap: 0.9, delay: 4 }, { type: "blob", count: 17, gap: 0.65, delay: 0 }, { type: "marble", count: 43, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 9, gap: 0.3, delay: 2 }, { type: "sock", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 11, gap: 0.3, delay: 2 }, { type: "blob", count: 20, gap: 0.65, delay: 0 }, { type: "marble", count: 52, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 6, gap: 0.9, delay: 4 }, { type: "hawk", count: 14, gap: 0.3, delay: 2 }, { type: "sock", count: 42, gap: 0.65, delay: 0 }, { type: "knight", count: 10, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "mole", count: 11, gap: 0.9, delay: 4 }, { type: "hawk", count: 18, gap: 0.3, delay: 2 }, { type: "blob", count: 26, gap: 0.65, delay: 0 }, { type: "marble", count: 65, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 13, gap: 0.9, delay: 4 }, { type: "hawk", count: 23, gap: 0.3, delay: 2 }, { type: "sock", count: 53, gap: 0.65, delay: 0 }, { type: "knight", count: 13, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 13, gap: 0.9, delay: 4 }, { type: "hawk", count: 29, gap: 0.3, delay: 2 }, { type: "blob", count: 33, gap: 0.65, delay: 0 }, { type: "marble", count: 84, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 26, gap: 0.9, delay: 4 }, { type: "hawk", count: 36, gap: 0.3, delay: 2 }, { type: "sock", count: 68, gap: 0.65, delay: 0 }, { type: "knight", count: 17, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "boombox", count: 20, gap: 0.9, delay: 4 }, { type: "hawk", count: 45, gap: 0.3, delay: 2 }, { type: "blob", count: 40, gap: 0.65, delay: 0 }, { type: "marble", count: 99, gap: 0.8, delay: 3 } ] },
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
        { groups: [ { type: "sock", count: 14, gap: 0.65, delay: 0 }, { type: "knight", count: 4, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.65, delay: 0 }, { type: "marble", count: 24, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "sock", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 5, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 1, gap: 0.9, delay: 4 }, { type: "blob", count: 12, gap: 0.65, delay: 0 }, { type: "marble", count: 31, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "screw", count: 2, gap: 0.9, delay: 4 }, { type: "sock", count: 26, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 2, gap: 0.9, delay: 4 }, { type: "hawk", count: 6, gap: 0.3, delay: 2 }, { type: "blob", count: 15, gap: 0.65, delay: 0 }, { type: "marble", count: 36, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bucket", count: 1, gap: 0.9, delay: 4 }, { type: "hawk", count: 8, gap: 0.3, delay: 2 }, { type: "sock", count: 30, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 10, gap: 0.3, delay: 2 }, { type: "blob", count: 19, gap: 0.65, delay: 0 }, { type: "marble", count: 49, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "battery", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 13, gap: 0.3, delay: 2 }, { type: "sock", count: 39, gap: 0.65, delay: 0 }, { type: "knight", count: 10, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 17, gap: 0.3, delay: 2 }, { type: "blob", count: 25, gap: 0.65, delay: 0 }, { type: "marble", count: 63, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 9, gap: 0.9, delay: 4 }, { type: "hawk", count: 21, gap: 0.3, delay: 2 }, { type: "sock", count: 50, gap: 0.65, delay: 0 }, { type: "knight", count: 13, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 8, gap: 0.9, delay: 4 }, { type: "hawk", count: 26, gap: 0.3, delay: 2 }, { type: "blob", count: 33, gap: 0.65, delay: 0 }, { type: "marble", count: 82, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "slime", count: 12, gap: 0.9, delay: 4 }, { type: "hawk", count: 33, gap: 0.3, delay: 2 }, { type: "sock", count: 58, gap: 0.65, delay: 0 }, { type: "knight", count: 15, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 12, gap: 0.9, delay: 4 }, { type: "hawk", count: 41, gap: 0.3, delay: 2 }, { type: "blob", count: 43, gap: 0.65, delay: 0 }, { type: "marble", count: 108, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 37, gap: 0.9, delay: 4 }, { type: "hawk", count: 50, gap: 0.3, delay: 2 }, { type: "sock", count: 84, gap: 0.65, delay: 0 }, { type: "knight", count: 22, gap: 0.8, delay: 3 } ] },
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
        { groups: [ { type: "sock", count: 16, gap: 0.65, delay: 0 }, { type: "knight", count: 4, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "blob", count: 11, gap: 0.65, delay: 0 }, { type: "marble", count: 26, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "sock", count: 21, gap: 0.65, delay: 0 }, { type: "knight", count: 6, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 1, gap: 0.9, delay: 4 }, { type: "blob", count: 13, gap: 0.65, delay: 0 }, { type: "marble", count: 34, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 2, gap: 0.9, delay: 4 }, { type: "sock", count: 27, gap: 0.65, delay: 0 }, { type: "knight", count: 7, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 5, gap: 0.9, delay: 4 }, { type: "hawk", count: 7, gap: 0.3, delay: 2 }, { type: "blob", count: 16, gap: 0.65, delay: 0 }, { type: "marble", count: 39, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bucket", count: 1, gap: 0.9, delay: 4 }, { type: "hawk", count: 9, gap: 0.3, delay: 2 }, { type: "sock", count: 34, gap: 0.65, delay: 0 }, { type: "knight", count: 8, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "cushion", count: 3, gap: 0.9, delay: 4 }, { type: "hawk", count: 11, gap: 0.3, delay: 2 }, { type: "blob", count: 21, gap: 0.65, delay: 0 }, { type: "marble", count: 52, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "boombox", count: 6, gap: 0.9, delay: 4 }, { type: "hawk", count: 14, gap: 0.3, delay: 2 }, { type: "sock", count: 42, gap: 0.65, delay: 0 }, { type: "knight", count: 11, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "racer", count: 10, gap: 0.9, delay: 4 }, { type: "hawk", count: 18, gap: 0.3, delay: 2 }, { type: "blob", count: 27, gap: 0.65, delay: 0 }, { type: "marble", count: 68, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "bubblewrap", count: 7, gap: 0.9, delay: 4 }, { type: "hawk", count: 23, gap: 0.3, delay: 2 }, { type: "sock", count: 54, gap: 0.65, delay: 0 }, { type: "knight", count: 14, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "slime", count: 10, gap: 0.9, delay: 4 }, { type: "hawk", count: 28, gap: 0.3, delay: 2 }, { type: "blob", count: 36, gap: 0.65, delay: 0 }, { type: "marble", count: 90, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "boombox", count: 16, gap: 0.9, delay: 4 }, { type: "hawk", count: 35, gap: 0.3, delay: 2 }, { type: "sock", count: 65, gap: 0.65, delay: 0 }, { type: "knight", count: 16, gap: 0.8, delay: 3 } ] },
        { groups: [ { type: "tinplane", count: 32, gap: 0.9, delay: 4 }, { type: "hawk", count: 44, gap: 0.3, delay: 2 }, { type: "blob", count: 46, gap: 0.65, delay: 0 }, { type: "marble", count: 116, gap: 0.8, delay: 3 } ] },
        { boss: true, groups: [ { type: "movingvan", count: 1, gap: 2, delay: 0 }, { type: "knight", count: 14, gap: 0.8, delay: 5 }, { type: "bubblewrap", count: 10, gap: 0.6, delay: 9 }, { type: "hawk", count: 16, gap: 0.35, delay: 14 } ] },
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
      garage: { path: [ [0, 3], [21, 3], [21, 8], [3, 8], [3, 13], [23, 13] ], startGold: 480,
        pads: [ { id: "p1", cx: 0, cy: 1 }, { id: "p2", cx: 23, cy: 11 }, { id: "p3", cx: 9, cy: 11 }, { id: "p4", cx: 16, cy: 1 }, { id: "p5", cx: 1, cy: 9 }, { id: "p6", cx: 8, cy: 1 }, { id: "p7", cx: 16, cy: 9 }, { id: "p8", cx: 22, cy: 4 }, { id: "p9", cx: 6, cy: 6 }, { id: "p10", cx: 11, cy: 6 }, { id: "p11", cx: 4, cy: 1 }, { id: "p12", cx: 5, cy: 11 }, { id: "p13", cx: 12, cy: 1 }, { id: "p14", cx: 1, cy: 13 } ] },
    },
  };

  const DATA = { GRID, TICK_RATE, DIFFICULTIES, RULES, ABILITIES, TOWERS, ENEMIES, WORLDS, LEVELS, META_BRANCHES, META_NODES, ACHIEVEMENTS, ENDLESS };

  if (typeof module !== "undefined" && module.exports) module.exports = DATA;
  if (global && typeof global === "object") global.TDData = DATA;
})(typeof window !== "undefined" ? window : globalThis);
