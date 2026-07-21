// Fort Josh: Toybox Defense — ALL balance/content data (TD-1 slice).
// Dual-export: window.TDData in the browser + module.exports in node, so the
// unit tests assert the exact truth the game ships (the content.js law).
// Coordinates are 24×14 GRID CELLS (1 cell = 1 distance unit; speeds in
// cells/sec). See PLAN_TOWER_DEFENSE.md for the full design this implements.

(function (global) {
  const GRID = { w: 24, h: 14 };
  const TICK_RATE = 30; // fixed-timestep logic Hz (determinism law)

  // ---- Difficulties (§5.5) — TD-1 ships normal; the table is the contract. ----
  const DIFFICULTIES = {
    casual: { hp: 0.8, speed: 1.0, bounty: 1.1, startGold: 50 },
    normal: { hp: 1.0, speed: 1.0, bounty: 1.0, startGold: 0 },
    heroic: { hp: 1.25, speed: 1.08, bounty: 0.9, startGold: -30 },
  };

  // ---- Global rules ----
  const RULES = {
    lives: 20,
    buildCountdownFirst: 45, // seconds before wave 1
    buildCountdown: 20,      // seconds between waves
    earlyCallRate: 3,        // bonus gold per remaining second on CALL
    sellRefund: 0.8,         // casual 0.9 (applied via difficulty at engine level in TD-4)
    stars: [[18, 3], [10, 2], [1, 1]], // livesKept >= n → stars
  };

  // ---- Towers (TD-1: the Dart Blaster line, tiers 1-3; branches land in TD-2) ----
  // dmgType: "bonk" is reduced by armor; "zap" (TD-2 Fan) ignores armor, shields absorb it.
  const TOWERS = {
    dart: {
      name: "Dart Blaster",
      icon: "🎯",
      hitsFliers: true,
      tiers: [
        { name: "Pea Shooter", cost: 70, dmg: 6, dmgType: "bonk", rate: 0.8, range: 2.6 },
        { name: "Double Dart", cost: 110, dmg: 13, dmgType: "bonk", rate: 0.75, range: 2.8 },
        { name: "Foam Gatling", cost: 160, dmg: 24, dmgType: "bonk", rate: 0.7, range: 3.0 },
      ],
      projectileSpeed: 9, // cells/sec, homing
    },
  };

  // ---- Enemies (TD-1 slice: the two baseline walkers) ----
  const ENEMIES = {
    sock: { name: "Sock Goblin", hp: 34, speed: 0.8, armor: 0, shield: 0, shieldRegen: 0, bounty: 5, lives: 1, flier: false },
    marble: { name: "Speedy Marble", hp: 16, speed: 1.7, armor: 0, shield: 0, shieldRegen: 0, bounty: 4, lives: 1, flier: false },
  };

  // ---- Levels ----
  // L1 "Under the Bed" — TD-1 ROUGH CUT: 6 waves of Sock/Marble only, authored
  // against the §5.3 budget curve (B=170, wave N ≈ B×1.18^N ±25% — unit-tested).
  // The full 8-wave §7.1 table (knights/balloons/piñata) replaces this in TD-3.
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
        { groups: [{ type: "sock", count: 6, gap: 1.2, delay: 0 }] },
        { groups: [{ type: "sock", count: 7, gap: 1.0, delay: 0 }] },
        { groups: [
          { type: "sock", count: 6, gap: 1.0, delay: 0 },
          { type: "marble", count: 4, gap: 0.8, delay: 3 },
        ] },
        { groups: [
          { type: "sock", count: 8, gap: 0.9, delay: 0 },
          { type: "marble", count: 5, gap: 0.7, delay: 2 },
        ] },
        { groups: [
          { type: "sock", count: 9, gap: 0.9, delay: 0 },
          { type: "marble", count: 8, gap: 0.6, delay: 4 },
        ] },
        { groups: [
          { type: "sock", count: 12, gap: 0.8, delay: 0 },
          { type: "marble", count: 10, gap: 0.55, delay: 3 },
        ] },
      ],
    },
  ];

  const DATA = { GRID, TICK_RATE, DIFFICULTIES, RULES, TOWERS, ENEMIES, LEVELS };

  if (typeof module !== "undefined" && module.exports) module.exports = DATA;
  if (global && typeof global === "object") global.TDData = DATA;
})(typeof window !== "undefined" ? window : globalThis);
