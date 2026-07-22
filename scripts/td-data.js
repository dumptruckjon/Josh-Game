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
    heroic: { hp: 1.25, speed: 1.08, bounty: 0.9, startGold: -30 },
  };

  // ---- Global rules ----
  const RULES = {
    lives: 20,
    buildCountdownFirst: 45,
    buildCountdown: 20,
    earlyCallRate: 3,
    sellRefund: 0.8,
    stars: [[18, 3], [10, 2], [1, 1]],
    slowCap: 0.6,        // slows never stack — strongest wins, capped (§5.1)
    flierSlowFactor: 0.5, // fliers take half slow
    brittleBonus: 1.2,   // brittle enemies take +20% of ALL damage
    soldierWalkSpeed: 2, // cells/sec to the rally point
    nightRangeMult: 0.85, // TD-4 night levels: −15% tower reach (Fan exempt)
  };

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
    knight: { name: "Plastic Knight", icon: "🛡", hp: 90, speed: 0.6, armor: 0.5, shield: 0, shieldRegen: 0, bounty: 12, lives: 1, flier: false, meleeDmg: 6, meleeRate: 0.9 }, // 50% armor → Fan zap (armor-ignoring) is the answer
    bull: { name: "Wind-up Bull", icon: "🐂", hp: 120, speed: 0.55, armor: 0.25, shield: 0, shieldRegen: 0, bounty: 14, lives: 1, flier: false, meleeDmg: 7, meleeRate: 0.9, charge: { speed: 1.6, seconds: 1.5, cooldown: 5 } }, // gets hit → charges
    healer: { name: "Junk Healer", icon: "🔧", hp: 85, speed: 0.65, armor: 0, shield: 0, shieldRegen: 0, bounty: 15, lives: 1, flier: false, meleeDmg: 4, meleeRate: 1.0, heal: { hps: 15, radius: 1.2 } }, // mends nearby allies — kill it first
    pinata: { name: "Piñata", icon: "🪅", hp: 400, speed: 0.45, armor: 0.25, shield: 0, shieldRegen: 0, bounty: 60, lives: 2, flier: false, meleeDmg: 8, meleeRate: 1.0, goldBurst: 20 }, // the economy release valve
    brick: { name: "Brick", icon: "🧱", hp: 28, speed: 0.9, armor: 0, shield: 0, shieldRegen: 0, bounty: 4, lives: 1, flier: false, meleeDmg: 3, meleeRate: 0.9 }, // authored in tight 8-squads → splash bait
    // ---- TD-3: World-1 boss ----
    bedmonster: { name: "Bed Monster", icon: "🛏", hp: 2400, speed: 0.28, armor: 0.25, shield: 0, shieldRegen: 0, bounty: 200, lives: 5, flier: false, boss: true, meleeDmg: 0, meleeRate: 1, stomp: { dmg: 60, radius: 1.5, seconds: 6 } }, // hp 3200→2400: tuned to THIS L4's 10-pad geometry (plan's 3200 assumed its own boss arena) so a wave-9 build kills it with margin; unblockable; stomps soldiers
    // ---- TD-4: Worlds 2-3 roster. Each ability is a data field the engine reads
    //      (phase/tunnel via isHidden, shieldRegen, flier) + guardrail-tested. ----
    ghost: { name: "Glitter Ghost", icon: "👻", hp: 55, speed: 0.9, armor: 0, shield: 0, shieldRegen: 0, bounty: 11, lives: 1, flier: false, meleeDmg: 4, meleeRate: 1.0, phase: { every: 4, on: 1.5 } }, // untargetable 1.5s every 4s (keeps walking) — burst it in the gaps
    battery: { name: "Battery Bot", icon: "🤖", hp: 70, speed: 0.75, armor: 0, shield: 40, shieldRegen: 8, bounty: 13, lives: 1, flier: false, meleeDmg: 5, meleeRate: 0.9 }, // a regenerating shield EATS Zap — bonk it down
    mole: { name: "Digger Mole", icon: "🦫", hp: 65, speed: 0.8, armor: 0, shield: 0, shieldRegen: 0, bounty: 12, lives: 1, flier: false, meleeDmg: 5, meleeRate: 0.9, tunnel: true }, // untargetable + unblockable under the middle third — guard the ends
    hawk: { name: "Kite Hawk", icon: "🪁", hp: 30, speed: 2.0, armor: 0, shield: 0, shieldRegen: 0, bounty: 7, lives: 1, flier: true, meleeDmg: 0, meleeRate: 1 }, // fast flier — Dart/Fan only
    // ---- TD-4: World-2 & finale bosses ----
    vacuumking: { name: "Vacuum King", icon: "🌪", hp: 5200, speed: 0.3, armor: 0.25, shield: 60, shieldRegen: 10, bounty: 300, lives: 5, flier: false, boss: true, meleeDmg: 0, meleeRate: 1, suck: { every: 8 }, enrage: { hpPct: 0.5, mult: 1.2 } }, // inhales the nearest soldier every 8s (instant KO); brief 1.2× hustle under half hp
    thestatic: { name: "The Static", icon: "⚡", hp: 8000, speed: 0.32, armor: 0.5, shield: 0, shieldRegen: 0, bounty: 500, lives: 5, flier: false, boss: true, meleeDmg: 0, meleeRate: 1, phases: [ { upTo: 1.0 }, { upTo: 0.66, disable: { every: 7, seconds: 4 } }, { upTo: 0.33, speedMult: 1.9, spawn: { type: "battery", count: 2, every: 10 } } ] }, // P1 armored wall; P2 jams a random gun; P3 dashes (~0.6) + summons Battery Bots — punishes a single-carry build
  };

  // ---- Levels 1-5: a sock/marble/balloon slice with real progression (beat N →
  //      N+1). Distinct paths/pads; a rising difficulty curve tuned by sim
  //      (tests/td-logic.test.js proves each winnable by an auto-solver + losable
  //      by neglect, and every wave within ±25% of budgetBase·1.18^n). The full
  //      14-enemy roster + bosses (L6-12) land in TD-3 (PLAN_TOWER_DEFENSE.md §7). ----
  const LEVELS = [
    {
      id: 1,
      name: "Under the Bed",
      badge: 1,
      world: "bedroom",
      startGold: 220,
      budgetBase: 170,
      path: [ [0, 3], [7, 3], [7, 10], [16, 10], [16, 4], [23, 4] ],
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
        { groups: [ { type: "brick", count: 13, gap: 0.55, delay: 0 }, { type: "blob", count: 4, gap: 0.85, delay: 3 }, { type: "sock", count: 3, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 2, gap: 1, delay: 0 }, { type: "blob", count: 4, gap: 0.85, delay: 3 }, { type: "marble", count: 16, gap: 0.55, delay: 4 }, { type: "sock", count: 4, gap: 0.85, delay: 5 } ] },
        { groups: [ { type: "knight", count: 3, gap: 1, delay: 0 }, { type: "blob", count: 5, gap: 0.85, delay: 3 }, { type: "marble", count: 18, gap: 0.55, delay: 4 }, { type: "sock", count: 4, gap: 0.85, delay: 5 } ] },
      ],
    },
    {
      id: 3,
      name: "Toy Shelf Run",
      badge: 2,
      world: "bedroom",
      startGold: 330,
      budgetBase: 330,
      path: [ [0, 12], [4, 12], [4, 3], [11, 3], [11, 10], [18, 10], [18, 3], [23, 3] ],
      pads: [
        { id: "p1", cx: 2, cy: 10 },
        { id: "p2", cx: 6, cy: 12 },
        { id: "p3", cx: 6, cy: 9 },
        { id: "p4", cx: 2, cy: 7 },
        { id: "p5", cx: 6, cy: 5 },
        { id: "p6", cx: 4, cy: 1 },
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
        { id: "p9", cx: 22, cy: 6 },
        { id: "p10", cx: 22, cy: 8 },
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
        { id: "p1", cx: 1, cy: 9 }, { id: "p2", cx: 4, cy: 5 }, { id: "p3", cx: 7, cy: 8 }, { id: "p4", cx: 8, cy: 3 }, { id: "p5", cx: 8, cy: 0 }, { id: "p6", cx: 11, cy: 4 }, { id: "p7", cx: 14, cy: 1 }, { id: "p8", cx: 15, cy: 7 }, { id: "p9", cx: 11, cy: 9 }, { id: "p10", cx: 13, cy: 9 }, { id: "p11", cx: 16, cy: 13 }, { id: "p12", cx: 18, cy: 9 },
      ],
      waves: [
        { groups: [ { type: "sock", count: 8, gap: 0.85, delay: 0 }, { type: "marble", count: 5, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "sock", count: 7, gap: 0.85, delay: 0 }, { type: "marble", count: 11, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "mole", count: 3, gap: 0.9, delay: 0 }, { type: "sock", count: 6, gap: 0.85, delay: 3 }, { type: "marble", count: 6, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "mole", count: 4, gap: 0.9, delay: 0 }, { type: "sock", count: 6, gap: 0.85, delay: 3 }, { type: "marble", count: 7, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "knight", count: 3, gap: 1, delay: 0 }, { type: "mole", count: 3, gap: 0.9, delay: 3 }, { type: "sock", count: 6, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 4, gap: 1, delay: 0 }, { type: "mole", count: 4, gap: 0.9, delay: 3 }, { type: "marble", count: 12, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "blob", count: 6, gap: 0.85, delay: 0 }, { type: "mole", count: 5, gap: 0.9, delay: 3 }, { type: "sock", count: 8, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 6, gap: 1, delay: 0 }, { type: "mole", count: 5, gap: 0.9, delay: 3 }, { type: "marble", count: 16, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "blob", count: 8, gap: 0.85, delay: 0 }, { type: "knight", count: 5, gap: 1, delay: 3 }, { type: "mole", count: 6, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 8, gap: 1, delay: 0 }, { type: "mole", count: 6, gap: 0.9, delay: 3 }, { type: "blob", count: 7, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 9, gap: 1, delay: 0 }, { type: "blob", count: 9, gap: 0.85, delay: 3 }, { type: "mole", count: 7, gap: 0.9, delay: 4 }, { type: "sock", count: 2, gap: 0.85, delay: 5 } ] },
      ],
    },
    {
      id: 6,
      name: "Firefly Night",
      world: "backyard",
      badge: 2,
      night: true,
      startGold: 320,
      budgetBase: 340,
      path: [ [0, 2], [15, 2], [15, 6], [5, 6], [5, 10], [21, 10] ],
      pads: [
        { id: "p1", cx: 1, cy: 4 }, { id: "p2", cx: 4, cy: 0 }, { id: "p3", cx: 7, cy: 4 }, { id: "p4", cx: 10, cy: 0 }, { id: "p5", cx: 13, cy: 4 }, { id: "p6", cx: 17, cy: 3 }, { id: "p7", cx: 14, cy: 4 }, { id: "p8", cx: 12, cy: 8 }, { id: "p9", cx: 9, cy: 4 }, { id: "p10", cx: 6, cy: 8 }, { id: "p11", cx: 3, cy: 8 },
      ],
      waves: [
        { groups: [ { type: "sock", count: 9, gap: 0.85, delay: 0 }, { type: "marble", count: 6, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 5, gap: 0.9, delay: 0 }, { type: "sock", count: 5, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 5, gap: 0.9, delay: 0 }, { type: "sock", count: 6, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 6, gap: 0.9, delay: 0 }, { type: "marble", count: 14, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 7, gap: 0.9, delay: 0 }, { type: "sock", count: 7, gap: 0.85, delay: 3 }, { type: "marble", count: 8, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "ghost", count: 8, gap: 0.9, delay: 0 }, { type: "sock", count: 10, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "knight", count: 4, gap: 1, delay: 0 }, { type: "ghost", count: 6, gap: 0.9, delay: 3 }, { type: "marble", count: 12, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "knight", count: 6, gap: 1, delay: 0 }, { type: "ghost", count: 7, gap: 0.9, delay: 3 }, { type: "sock", count: 4, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "blob", count: 8, gap: 0.85, delay: 0 }, { type: "ghost", count: 8, gap: 0.9, delay: 3 }, { type: "marble", count: 14, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "blob", count: 9, gap: 0.85, delay: 0 }, { type: "ghost", count: 9, gap: 0.9, delay: 3 }, { type: "knight", count: 4, gap: 1, delay: 4 } ] },
        { groups: [ { type: "knight", count: 9, gap: 1, delay: 0 }, { type: "ghost", count: 10, gap: 0.9, delay: 3 }, { type: "blob", count: 6, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 11, gap: 1, delay: 0 }, { type: "ghost", count: 11, gap: 0.9, delay: 3 }, { type: "blob", count: 7, gap: 0.85, delay: 4 }, { type: "sock", count: 4, gap: 0.85, delay: 5 } ] },
      ],
    },
    {
      id: 7,
      name: "The Slip'n'Slide",
      world: "backyard",
      badge: 3,
      startGold: 380,
      budgetBase: 390,
      zones: [ { from: 8, to: 13, mult: 1.6 }, { from: 20, to: 25, mult: 1.6 }, { from: 33, to: 38, mult: 1.6 } ],
      path: [ [0, 11], [6, 11], [6, 4], [14, 4], [14, 11], [20, 11], [20, 3], [23, 3] ],
      pads: [
        { id: "p1", cx: 1, cy: 13 }, { id: "p2", cx: 4, cy: 9 }, { id: "p3", cx: 8, cy: 11 }, { id: "p4", cx: 4, cy: 8 }, { id: "p5", cx: 8, cy: 6 }, { id: "p6", cx: 7, cy: 2 }, { id: "p7", cx: 9, cy: 6 }, { id: "p8", cx: 12, cy: 2 }, { id: "p9", cx: 12, cy: 5 }, { id: "p10", cx: 16, cy: 7 }, { id: "p11", cx: 12, cy: 9 }, { id: "p12", cx: 15, cy: 9 },
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
        { groups: [ { type: "knight", count: 8, gap: 1, delay: 0 }, { type: "hawk", count: 14, gap: 0.5, delay: 3 }, { type: "blob", count: 8, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 10, gap: 1, delay: 0 }, { type: "hawk", count: 16, gap: 0.5, delay: 3 }, { type: "balloon", count: 10, gap: 1.1, delay: 4 } ] },
        { groups: [ { type: "knight", count: 12, gap: 1, delay: 0 }, { type: "hawk", count: 18, gap: 0.5, delay: 3 }, { type: "blob", count: 10, gap: 0.85, delay: 4 }, { type: "sock", count: 6, gap: 0.85, delay: 5 } ] },
        { groups: [ { type: "knight", count: 14, gap: 1, delay: 0 }, { type: "hawk", count: 22, gap: 0.5, delay: 3 }, { type: "blob", count: 12, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 16, gap: 1, delay: 0 }, { type: "hawk", count: 26, gap: 0.5, delay: 3 }, { type: "blob", count: 14, gap: 0.85, delay: 4 }, { type: "sock", count: 8, gap: 0.85, delay: 5 } ] },
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
        { id: "p1", cx: 1, cy: 8 }, { id: "p2", cx: 4, cy: 4 }, { id: "p3", cx: 7, cy: 8 }, { id: "p4", cx: 10, cy: 4 }, { id: "p5", cx: 12, cy: 8 }, { id: "p6", cx: 15, cy: 4 }, { id: "p7", cx: 14, cy: 8 }, { id: "p8", cx: 16, cy: 12 }, { id: "p9", cx: 13, cy: 8 }, { id: "p10", cx: 10, cy: 12 }, { id: "p11", cx: 4, cy: 9 }, { id: "p12", cx: 8, cy: 6 }, { id: "p13", cx: 4, cy: 3 },
      ],
      waves: [
        { groups: [ { type: "sock", count: 9, gap: 0.85, delay: 0 }, { type: "knight", count: 3, gap: 1, delay: 3 } ] },
        { groups: [ { type: "battery", count: 6, gap: 0.9, delay: 0 }, { type: "sock", count: 6, gap: 0.85, delay: 3 } ] },
        { groups: [ { type: "battery", count: 6, gap: 0.9, delay: 0 }, { type: "marble", count: 20, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "knight", count: 5, gap: 1, delay: 0 }, { type: "battery", count: 5, gap: 0.9, delay: 3 }, { type: "sock", count: 4, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 6, gap: 1, delay: 0 }, { type: "battery", count: 6, gap: 0.9, delay: 3 }, { type: "marble", count: 10, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.85, delay: 0 }, { type: "battery", count: 8, gap: 0.9, delay: 3 }, { type: "sock", count: 8, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 8, gap: 1, delay: 0 }, { type: "battery", count: 8, gap: 0.9, delay: 3 }, { type: "marble", count: 18, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "knight", count: 9, gap: 1, delay: 0 }, { type: "battery", count: 9, gap: 0.9, delay: 3 }, { type: "blob", count: 6, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 10, gap: 1, delay: 0 }, { type: "battery", count: 10, gap: 0.9, delay: 3 }, { type: "balloon", count: 8, gap: 1.1, delay: 4 } ] },
        { groups: [ { type: "knight", count: 12, gap: 1, delay: 0 }, { type: "battery", count: 11, gap: 0.9, delay: 3 }, { type: "blob", count: 8, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 14, gap: 1, delay: 0 }, { type: "battery", count: 13, gap: 0.9, delay: 3 }, { type: "blob", count: 9, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 16, gap: 1, delay: 0 }, { type: "battery", count: 15, gap: 0.9, delay: 3 }, { type: "blob", count: 11, gap: 0.85, delay: 4 }, { type: "sock", count: 6, gap: 0.85, delay: 5 } ] },
        { boss: true, groups: [ { type: "vacuumking", count: 1, gap: 1, delay: 0 }, { type: "knight", count: 4, gap: 1, delay: 10 }, { type: "battery", count: 6, gap: 0.9, delay: 20 }, { type: "sock", count: 8, gap: 0.85, delay: 32 } ] },
      ],
    },
    {
      id: 9,
      name: "Aisle Nine",
      world: "toystore",
      badge: 3,
      startGold: 440,
      budgetBase: 500,
      path: [ [0, 3], [16, 3], [16, 8], [6, 8], [6, 12], [22, 12] ],
      pads: [
        { id: "p1", cx: 1, cy: 5 }, { id: "p2", cx: 4, cy: 1 }, { id: "p3", cx: 7, cy: 5 }, { id: "p4", cx: 9, cy: 1 }, { id: "p5", cx: 12, cy: 5 }, { id: "p6", cx: 14, cy: 1 }, { id: "p7", cx: 14, cy: 4 }, { id: "p8", cx: 18, cy: 7 }, { id: "p9", cx: 15, cy: 6 }, { id: "p10", cx: 12, cy: 10 }, { id: "p11", cx: 10, cy: 6 }, { id: "p12", cx: 7, cy: 10 }, { id: "p13", cx: 4, cy: 10 },
      ],
      waves: [
        { groups: [ { type: "sock", count: 10, gap: 0.85, delay: 0 }, { type: "knight", count: 3, gap: 1, delay: 3 } ] },
        { groups: [ { type: "battery", count: 6, gap: 0.9, delay: 0 }, { type: "marble", count: 16, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "ghost", count: 8, gap: 0.9, delay: 0 }, { type: "knight", count: 4, gap: 1, delay: 3 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.85, delay: 0 }, { type: "ghost", count: 6, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "knight", count: 7, gap: 1, delay: 0 }, { type: "battery", count: 7, gap: 0.9, delay: 3 }, { type: "marble", count: 4, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "knight", count: 9, gap: 1, delay: 0 }, { type: "ghost", count: 8, gap: 0.9, delay: 3 }, { type: "sock", count: 4, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "blob", count: 14, gap: 0.85, delay: 0 }, { type: "battery", count: 9, gap: 0.9, delay: 3 }, { type: "marble", count: 8, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "knight", count: 11, gap: 1, delay: 0 }, { type: "ghost", count: 10, gap: 0.9, delay: 3 }, { type: "battery", count: 6, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 13, gap: 1, delay: 0 }, { type: "blob", count: 10, gap: 0.85, delay: 3 }, { type: "ghost", count: 8, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 15, gap: 1, delay: 0 }, { type: "battery", count: 12, gap: 0.9, delay: 3 }, { type: "ghost", count: 8, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 18, gap: 1, delay: 0 }, { type: "blob", count: 12, gap: 0.85, delay: 3 }, { type: "battery", count: 10, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 20, gap: 1, delay: 0 }, { type: "ghost", count: 14, gap: 0.9, delay: 3 }, { type: "blob", count: 12, gap: 0.85, delay: 4 }, { type: "battery", count: 8, gap: 0.9, delay: 5 } ] },
        { groups: [ { type: "knight", count: 24, gap: 1, delay: 0 }, { type: "blob", count: 16, gap: 0.85, delay: 3 }, { type: "battery", count: 12, gap: 0.9, delay: 4 }, { type: "ghost", count: 10, gap: 0.9, delay: 5 } ] },
      ],
    },
    {
      id: 10,
      name: "The Train Set",
      world: "toystore",
      badge: 3,
      startGold: 380,
      budgetBase: 560,
      path: [ [0, 6], [6, 6], [6, 2], [17, 2], [17, 11], [7, 11], [7, 8], [23, 8] ],
      pads: [
        { id: "p1", cx: 2, cy: 8 }, { id: "p2", cx: 5, cy: 4 }, { id: "p3", cx: 8, cy: 4 }, { id: "p4", cx: 7, cy: 0 }, { id: "p5", cx: 11, cy: 4 }, { id: "p6", cx: 14, cy: 0 }, { id: "p7", cx: 15, cy: 3 }, { id: "p8", cx: 19, cy: 6 }, { id: "p9", cx: 15, cy: 9 }, { id: "p10", cx: 16, cy: 13 }, { id: "p11", cx: 13, cy: 9 }, { id: "p12", cx: 9, cy: 13 },
      ],
      waves: [
        { groups: [ { type: "sock", count: 12, gap: 0.85, delay: 0 }, { type: "knight", count: 3, gap: 1, delay: 3 } ] },
        { groups: [ { type: "mole", count: 8, gap: 0.9, delay: 0 }, { type: "marble", count: 12, gap: 0.55, delay: 3 } ] },
        { groups: [ { type: "mole", count: 7, gap: 0.9, delay: 0 }, { type: "knight", count: 5, gap: 1, delay: 3 } ] },
        { groups: [ { type: "blob", count: 10, gap: 0.85, delay: 0 }, { type: "mole", count: 7, gap: 0.9, delay: 3 } ] },
        { groups: [ { type: "knight", count: 8, gap: 1, delay: 0 }, { type: "mole", count: 7, gap: 0.9, delay: 3 }, { type: "battery", count: 2, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 10, gap: 1, delay: 0 }, { type: "mole", count: 8, gap: 0.9, delay: 3 }, { type: "marble", count: 6, gap: 0.55, delay: 4 } ] },
        { groups: [ { type: "blob", count: 16, gap: 0.85, delay: 0 }, { type: "mole", count: 9, gap: 0.9, delay: 3 }, { type: "ghost", count: 4, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 13, gap: 1, delay: 0 }, { type: "mole", count: 10, gap: 0.9, delay: 3 }, { type: "battery", count: 6, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 16, gap: 1, delay: 0 }, { type: "mole", count: 10, gap: 0.9, delay: 3 }, { type: "blob", count: 8, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 18, gap: 1, delay: 0 }, { type: "mole", count: 12, gap: 0.9, delay: 3 }, { type: "ghost", count: 8, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 22, gap: 1, delay: 0 }, { type: "mole", count: 12, gap: 0.9, delay: 3 }, { type: "blob", count: 12, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 26, gap: 1, delay: 0 }, { type: "mole", count: 14, gap: 0.9, delay: 3 }, { type: "battery", count: 12, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 30, gap: 1, delay: 0 }, { type: "mole", count: 16, gap: 0.9, delay: 3 }, { type: "blob", count: 14, gap: 0.85, delay: 4 }, { type: "ghost", count: 6, gap: 0.9, delay: 5 } ] },
        { groups: [ { type: "knight", count: 36, gap: 1, delay: 0 }, { type: "mole", count: 18, gap: 0.9, delay: 3 }, { type: "blob", count: 16, gap: 0.85, delay: 4 }, { type: "battery", count: 8, gap: 0.9, delay: 5 } ] },
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
        { groups: [ { type: "pinata", count: 1, gap: 1, delay: 0 }, { type: "knight", count: 12, gap: 1, delay: 3 }, { type: "battery", count: 7, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 16, gap: 1, delay: 0 }, { type: "ghost", count: 10, gap: 0.9, delay: 3 }, { type: "mole", count: 6, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "knight", count: 12, gap: 1, delay: 3 }, { type: "battery", count: 8, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 22, gap: 1, delay: 0 }, { type: "mole", count: 12, gap: 0.9, delay: 3 }, { type: "ghost", count: 8, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "pinata", count: 2, gap: 1, delay: 0 }, { type: "knight", count: 20, gap: 1, delay: 3 }, { type: "battery", count: 12, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 28, gap: 1, delay: 0 }, { type: "mole", count: 14, gap: 0.9, delay: 3 }, { type: "blob", count: 14, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "pinata", count: 3, gap: 1, delay: 0 }, { type: "knight", count: 24, gap: 1, delay: 3 }, { type: "battery", count: 14, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 38, gap: 1, delay: 0 }, { type: "mole", count: 18, gap: 0.9, delay: 3 }, { type: "blob", count: 16, gap: 0.85, delay: 4 }, { type: "ghost", count: 8, gap: 0.9, delay: 5 } ] },
        { groups: [ { type: "knight", count: 44, gap: 1, delay: 0 }, { type: "mole", count: 22, gap: 0.9, delay: 3 }, { type: "blob", count: 18, gap: 0.85, delay: 4 }, { type: "battery", count: 12, gap: 0.9, delay: 5 } ] },
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
        { groups: [ { type: "knight", count: 14, gap: 1, delay: 0 }, { type: "ghost", count: 12, gap: 0.9, delay: 3 }, { type: "mole", count: 6, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 16, gap: 1, delay: 0 }, { type: "battery", count: 12, gap: 0.9, delay: 3 }, { type: "ghost", count: 8, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 20, gap: 1, delay: 0 }, { type: "mole", count: 12, gap: 0.9, delay: 3 }, { type: "blob", count: 10, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 24, gap: 1, delay: 0 }, { type: "battery", count: 14, gap: 0.9, delay: 3 }, { type: "ghost", count: 10, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 28, gap: 1, delay: 0 }, { type: "mole", count: 16, gap: 0.9, delay: 3 }, { type: "blob", count: 12, gap: 0.85, delay: 4 } ] },
        { groups: [ { type: "knight", count: 32, gap: 1, delay: 0 }, { type: "battery", count: 18, gap: 0.9, delay: 3 }, { type: "ghost", count: 14, gap: 0.9, delay: 4 } ] },
        { groups: [ { type: "knight", count: 40, gap: 1, delay: 0 }, { type: "mole", count: 20, gap: 0.9, delay: 3 }, { type: "blob", count: 16, gap: 0.85, delay: 4 }, { type: "battery", count: 10, gap: 0.9, delay: 5 } ] },
        { boss: true, groups: [ { type: "thestatic", count: 1, gap: 1, delay: 0 }, { type: "knight", count: 6, gap: 1, delay: 10 }, { type: "battery", count: 8, gap: 0.9, delay: 20 }, { type: "ghost", count: 8, gap: 0.9, delay: 32 } ] },
      ],
    },
  ];

  const DATA = { GRID, TICK_RATE, DIFFICULTIES, RULES, TOWERS, ENEMIES, LEVELS };

  if (typeof module !== "undefined" && module.exports) module.exports = DATA;
  if (global && typeof global === "object") global.TDData = DATA;
})(typeof window !== "undefined" ? window : globalThis);
