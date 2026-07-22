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
      name: "Under the Rug",
      world: "bedroom",
      startGold: 250,
      budgetBase: 500,
      path: [ [0, 6], [13, 6], [13, 2], [20, 2], [20, 11], [5, 11] ],
      pads: [
        { id: "p1", cx: 3, cy: 8 },
        { id: "p2", cx: 5, cy: 4 },
        { id: "p3", cx: 8, cy: 8 },
        { id: "p4", cx: 10, cy: 4 },
        { id: "p5", cx: 13, cy: 8 },
        { id: "p6", cx: 15, cy: 4 },
        { id: "p7", cx: 22, cy: 3 },
        { id: "p8", cx: 18, cy: 6 },
        { id: "p9", cx: 22, cy: 8 },
      ],
      waves: [
        { groups: [ { type: "sock", count: 15, gap: 1.12, delay: 0 } ] },
        { groups: [ { type: "sock", count: 18, gap: 1.09, delay: 0 } ] },
        { groups: [ { type: "sock", count: 14, gap: 1.06, delay: 0 }, { type: "marble", count: 14, gap: 0.65, delay: 2.5 } ] },
        { groups: [ { type: "sock", count: 17, gap: 1.03, delay: 0 }, { type: "marble", count: 17, gap: 0.65, delay: 2.5 } ] },
        { groups: [ { type: "sock", count: 20, gap: 1, delay: 0 }, { type: "marble", count: 20, gap: 0.65, delay: 2.5 }, { type: "balloon", count: 1, gap: 1.2, delay: 5 } ] },
        { groups: [ { type: "sock", count: 24, gap: 0.97, delay: 0 }, { type: "marble", count: 24, gap: 0.65, delay: 2.5 }, { type: "balloon", count: 2, gap: 1.2, delay: 5 } ] },
        { groups: [ { type: "sock", count: 28, gap: 0.94, delay: 0 }, { type: "marble", count: 28, gap: 0.65, delay: 2.5 }, { type: "balloon", count: 3, gap: 1.2, delay: 5 } ] },
        { groups: [ { type: "sock", count: 33, gap: 0.91, delay: 0 }, { type: "marble", count: 33, gap: 0.65, delay: 2.5 }, { type: "balloon", count: 4, gap: 1.2, delay: 5 } ] },
        { groups: [ { type: "sock", count: 39, gap: 0.88, delay: 0 }, { type: "marble", count: 39, gap: 0.65, delay: 2.5 }, { type: "balloon", count: 4, gap: 1.2, delay: 5 } ] },
        { groups: [ { type: "sock", count: 46, gap: 0.85, delay: 0 }, { type: "marble", count: 46, gap: 0.65, delay: 2.5 }, { type: "balloon", count: 4, gap: 1.2, delay: 5 } ] },
      ],
    },
  ];

  const DATA = { GRID, TICK_RATE, DIFFICULTIES, RULES, TOWERS, ENEMIES, LEVELS };

  if (typeof module !== "undefined" && module.exports) module.exports = DATA;
  if (global && typeof global === "object") global.TDData = DATA;
})(typeof window !== "undefined" ? window : globalThis);
