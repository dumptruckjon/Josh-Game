// Gobble Hole — ALL scene content + tuning (PLAN_GOBBLE.md). Dual export:
// window.HoleData in the browser, module.exports under node, so the engine
// tests read the very data the game ships.
//
// Every number the engine DERIVES from (level radii, grow thresholds) comes
// from these objects' own sizes — see hole-logic.js levelsOf(). What is tuned
// here is the SHAPE of a scene: its tiers, how many of each, and its finale.
//
// Emoji law: every picture is <= Emoji 13.0 (Josh's iPad is iOS 14.2) and a
// text-default one carries VS16 — both are site-wide guardrails. And Gobble
// never eats anything ALIVE: no animals, no people, no favourite characters
// (hole-logic.test.js scans the Unicode ranges, so it is not a list).

(function (global) {
  const RULES = {
    // The scene keeps a fixed AREA and adapts its ASPECT (W/H) to the screen,
    // clamped, so a phone gets a tall scene and an iPad a squarer one. The
    // aspect is quantized to 0.01 so a saved run rebuilds the same layout.
    AREA: 12600,
    ASPECT: [0.6, 1.7],
    // The ground is seen in 3/4 view: ONE metric for every ground distance,
    // hypot(dx, dy / SQ). The renderer draws the hole with ry = rx * SQ, so an
    // object falls in exactly when it LOOKS inside the hole.
    SQ: 0.72,
    FIT: 0.92,        // an object fits when r <= hole.r * FIT
    HEAD: 1.05,       // a level's radius clears its tier's biggest thing by 5%
    // Share of everything edible so far that one grow needs (C[1..5]). The
    // first is low so the first "BIGGER!" comes fast.
    ALPHA: [0.45, 0.55, 0.6, 0.6, 0.62],
    GAIN: 9,          // glide: speed = distance * GAIN (1/s) …
    VMAX: 95,         // … capped at this (units/s): about a scene-width a second
    PULL: [1.5, 0.15],        // magnet reach past the rim: a + b * hole.r
    PULL_SPEED: [30, 1.5],    // magnet speed: a + b * hole.r (units/s)
    START_Y: 11,      // Gobble starts this far above the bottom edge, centred
    START_CLEAR: 13,  // …and nothing but the three starters is placed this close
    SEP: 0.95,        // footprints keep SEP * (r1 + r2) apart (ground metric)
    EDGE: 1.5,        // footprints keep this far from the scene edge
    SPRITE_H: 2.25,   // a sprite stands SPRITE_H * r tall above its base
    TOP_SLACK: 7,     // sprites may overhang the scene's back edge by this much
    HINT_AFTER: 6,    // seconds without a gulp before the sparkle trail shows
  };

  // A scene: 5 tiers (tiny → huge) + one FINALE. items: [emoji, count, zone?].
  // The first `starters` tier-1 items are placed right beside Gobble so the
  // first gulp is instant. zones: named rects in normalized [x0, y0, x1, y1].
  const SCENES = [
    {
      id: "toyroom", name: "Toy Room", door: "🧸", color: "#ffb86b",
      ground: "wood", hole: "gobble",
      backdrop: ["#fff1dc", "#f6d9b0"],
      starters: 3,
      tiers: [
        { r: [3.1, 3.6], items: [["🍬", 4], ["🎲", 3], ["🧩", 3], ["🖍️", 2], ["🪀", 2], ["🎀", 2]] },
        { r: [4.8, 5.4], items: [["⚽", 2], ["🏀", 1], ["🧸", 2], ["📚", 1], ["🚗", 2], ["🎈", 1], ["🪁", 1], ["🎨", 1]] },
        { r: [7.0, 7.8], items: [["🤖", 2], ["🥁", 1], ["🎸", 1], ["🛴", 1], ["🚂", 1], ["🎁", 1]] },
        { r: [10.0, 11.0], items: [["🪑", 1], ["🧺", 1], ["🚲", 1], ["🎹", 1]] },
        { r: [14.0, 15.0], items: [["🛏️", 1], ["📺", 1]] },
      ],
      finale: { e: "🏰", r: 20 },
    },
    {
      id: "picnic", name: "Picnic Park", door: "🧺", color: "#8fd16a",
      ground: "grass", hole: "gobble",
      backdrop: ["#dff4ff", "#bfe6ff"],
      starters: 3,
      zones: { blanket: [[0.06, 0.46, 0.48, 0.74]] },
      tiers: [
        { r: [3.1, 3.6], items: [["🍓", 4], ["🍒", 3], ["🍇", 2], ["🌸", 3], ["🍄", 2], ["🌼", 2]] },
        { r: [4.8, 5.4], items: [["🧁", 2, "blanket"], ["🍩", 2, "blanket"], ["🥪", 2, "blanket"], ["🍎", 2], ["🍌", 1], ["🍪", 1], ["🧃", 1]] },
        { r: [7.0, 7.8], items: [["🍉", 2], ["🍍", 2], ["🥧", 1], ["🌻", 2]] },
        { r: [10.0, 11.0], items: [["⛺", 1], ["🌲", 1], ["🪴", 1], ["🧺", 1]] },
        { r: [14.0, 15.0], items: [["🌳", 1], ["⛲", 1]] },
      ],
      finale: { e: "🎡", r: 20 },
    },
    {
      id: "build", name: "Building Site", door: "🚧", color: "#ffc93c",
      ground: "dirt", hole: "gobble",
      backdrop: ["#e9f4ff", "#cfe3f7"],
      starters: 3,
      tiers: [
        { r: [3.1, 3.6], items: [["🔩", 4], ["🪨", 3], ["🧱", 3], ["🔨", 2], ["🔧", 2], ["🪛", 2]] },
        { r: [4.8, 5.4], items: [["⛑️", 2], ["🪣", 2], ["🧰", 2], ["🚧", 2], ["🪜", 1], ["🦺", 2]] },
        { r: [7.0, 7.8], items: [["🛢️", 2], ["🪵", 2], ["🚦", 1], ["🧯", 2]] },
        { r: [10.0, 11.0], items: [["🚜", 2], ["🛻", 1], ["🚚", 1]] },
        { r: [14.0, 15.0], items: [["🚛", 1], ["🏗️", 1]] },
      ],
      finale: { e: "🏢", r: 20 },
    },
    {
      id: "town", name: "Busy Town", door: "🚦", color: "#5ec8ff",
      ground: "town", hole: "gobble",
      backdrop: ["#e3f6ff", "#bde7ff"],
      starters: 3,
      // The main road runs across the middle; a side road runs down the right.
      zones: { road: [[0, 0.5, 1, 0.66], [0.72, 0.34, 0.86, 1]] },
      tiers: [
        { r: [3.1, 3.6], items: [["🪙", 4], ["🌷", 3], ["🍦", 3], ["🔑", 2], ["🥤", 2], ["🧃", 2]] },
        { r: [4.8, 5.4], items: [["🚦", 2], ["🛑", 2], ["🗑️", 2], ["📮", 2], ["🛵", 2], ["🚲", 1]] },
        { r: [7.0, 7.8], items: [["🚗", 2, "road"], ["🚕", 2, "road"], ["🚙", 1, "road"], ["🚓", 1, "road"], ["🏍️", 1, "road"]] },
        { r: [10.0, 11.0], items: [["🚌", 1], ["🚒", 1], ["🚑", 1], ["🚐", 1]] },
        { r: [14.0, 15.0], items: [["🏠", 1], ["🏪", 1]] },
      ],
      finale: { e: "🏫", r: 20 },   // the whole school! (🏙️ drew as a framed square picture, not a building)
    },
    {
      id: "party", name: "Party Time", door: "🎂", color: "#ff7ac0",
      ground: "party", hole: "gobble",
      backdrop: ["#fff0f7", "#ffd6ea"],
      starters: 3,
      tiers: [
        { r: [3.1, 3.6], items: [["🍬", 4], ["🍭", 3], ["🍫", 3], ["💝", 2], ["🍓", 2], ["🎀", 2]] },
        { r: [4.8, 5.4], items: [["🧁", 2], ["🍩", 2], ["🍪", 2], ["🎈", 2], ["🎉", 2], ["🎊", 1]] },
        { r: [7.0, 7.8], items: [["🍰", 2], ["🍕", 2], ["🍿", 1], ["🧸", 2]] },
        { r: [10.0, 11.0], items: [["🪅", 1], ["🎁", 1], ["🪑", 1], ["🪆", 1]] },
        { r: [14.0, 15.0], items: [["🎪", 1], ["🎠", 1]] },
      ],
      finale: { e: "🎂", r: 20 },
    },
    {
      id: "space", name: "Outer Space", door: "🚀", color: "#8a7bff",
      ground: "space", hole: "blackhole",
      backdrop: ["#0a0d26", "#151a45"],
      starters: 3,
      tiers: [
        { r: [3.1, 3.6], items: [["⭐", 5], ["💎", 3], ["🪨", 3], ["🔋", 2], ["🌟", 3]] },
        { r: [4.8, 5.4], items: [["🌙", 2], ["☄️", 3], ["🔭", 2], ["🛰️", 2], ["📡", 2]] },
        { r: [7.0, 7.8], items: [["🛸", 2], ["🚀", 3], ["🤖", 2]] },
        { r: [10.0, 11.0], items: [["🌕", 2], ["🌍", 1], ["🌎", 1]] },
        { r: [14.0, 15.0], items: [["🪐", 2]] },
      ],
      finale: { e: "☀️", r: 20 },
    },
  ];

  // What Gobble says (when sound is on — it is OFF by default, and the game
  // is fully playable without it).
  const SAY = {
    start: "I'm hungry! Drag me to eat!",
    grow: ["Bigger!", "Yum! Bigger!", "Wow, so big!", "Gobble gobble!"],
    big: "Too big! Eat more first!",
    win: "Burp! You ate it all!",
    pick: "Pick a place to eat!",
  };

  const HoleData = { RULES, SCENES, SAY };
  global.HoleData = HoleData;
  if (typeof module !== "undefined" && module.exports) module.exports = HoleData;
})(typeof window !== "undefined" ? window : globalThis);
