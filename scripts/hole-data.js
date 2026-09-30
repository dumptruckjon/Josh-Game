// Gobble Hole — ALL scene content + tuning (PLAN_GOBBLE.md). Dual export:
// window.HoleData in the browser, module.exports under node, so the engine
// tests read the very data the game ships.
//
// Every number the engine DERIVES from (level radii, grow thresholds, the
// zoom) comes from these objects' own sizes — see hole-logic.js levelsOf().
// What is tuned here is the SHAPE of a place: its tiers, how many of each,
// where they cluster, and its finale.
//
// Phase 2 (PLAN_GOBBLE.md §9): a place is a BIG world, far larger than the
// screen, and the screen is a camera that follows Gobble and pulls back as he
// grows. Positions below are NORMALIZED to the world ([0,1] across and down).
//
// Emoji law: every picture is <= Emoji 13.0 (Josh's iPad is iOS 14.2) and a
// text-default one carries VS16 — both are site-wide guardrails. And Gobble
// never eats anything ALIVE: no animals, no people, no favourite characters
// (hole-logic.test.js scans the Unicode ranges, so it is not a list).

(function (global) {
  const RULES = {
    // A save carries this. The one-screen islands of phase 1 laid their
    // things out differently, so a half-eaten run from then is dropped.
    LAYOUT: 2,
    // The world, in world units. It no longer bends to the screen: the
    // screen is a camera onto it (so a saved run never depends on the device).
    WORLD: [300, 420],
    // The ground is seen in 3/4 view: ONE metric for every ground distance,
    // hypot(dx, dy / SQ). The renderer draws the hole with ry = rx * SQ, so an
    // object falls in exactly when it LOOKS inside the hole.
    SQ: 0.72,
    FIT: 0.92,        // an object fits when r <= hole.r * FIT
    HEAD: 1.05,       // a level's radius clears its tier's biggest thing by 5%
    // A grow needs this many bites' worth of the NEWEST edible tier's xp
    // (C[1..5]). Six sweets for the first "BIGGER!", then eight of whatever
    // just became edible — so a grow never needs a hunt across the world.
    GROW_BITES: [6, 8, 8, 8, 8],
    // THE CAMERA. The world shown across the screen's SHORT side is
    // VIEW0 * (short px / 400)^VIEW_SCREEN * (R[level] / R[0])^ZOOM: a bigger
    // screen shows more world (it is not a blow-up), and the view widens as
    // Gobble grows — slower than he does, so he also grows ON screen.
    VIEW0: 48,
    VIEW_SCREEN: 0.5,
    ZOOM: 0.72,
    GAIN: 9,          // glide: speed = distance * GAIN (1/s) …
    VMAX: 52,         // … capped at this (units/s) at the start; it scales with
                      // the zoom, so he always crosses about a screen a second
    PULL: [1.5, 0.15],        // magnet reach past the rim: a + b * hole.r
    PULL_SPEED: [30, 1.5],    // magnet speed: a + b * hole.r (units/s)
    START_CLEAR: 13,  // nothing but the three starters stands this close to the start
    SEP: 0.95,        // footprints keep SEP * (r1 + r2) apart (ground metric)
    EDGE: 1.5,        // footprints keep this far from the world's edge
    SPRITE_H: 2.25,   // a sprite stands SPRITE_H * r tall above its base
    TOP_SLACK: 7,     // sprites may overhang the world's back edge by this much
    TRAIL_STEP: 11,   // bites on a trail stand this far apart
    TRAIL_MAX: 9,     // …and a trail is at most this many bites long
    HINT_AFTER: 6,    // seconds without a gulp before the sparkle trail shows
  };

  // A place: 5 tiers (tiny → huge) + one FINALE.
  //   items: [emoji, count, zone?, clump?] — a clump of k stands together, so
  //          one pass hoovers up the lot.
  //   zones: named rects [x0, y0, x1, y1], normalized — where a zoned thing's
  //          centre stands. They sit on the matching ground decal.
  //   trails: lines of one tier-1 bite leading out from the start.
  //   decals: the ground's features (drawn only; nothing stands "on" them).
  //          Positions are normalized; a width `w` is in world units.
  // The first `starters` tier-1 bites are placed right beside Gobble so the
  // first gulp is instant.
  const SCENES = [
    {
      id: "toyroom", name: "Toy Room", door: "🧸", color: "#ffb86b",
      ground: "wood", hole: "gobble",
      backdrop: ["#fff1dc", "#f6d9b0"],
      start: [0.5, 0.9], starters: 3,
      zones: {
        rug: [[0.34, 0.45, 0.66, 0.63]],
        blocks: [[0.07, 0.67, 0.35, 0.85]],
        art: [[0.65, 0.67, 0.93, 0.85]],
        music: [[0.07, 0.25, 0.35, 0.41]],
        bed: [[0.65, 0.25, 0.93, 0.41]],
      },
      trails: [{ e: "🍬", to: [0.22, 0.72] }, { e: "🍬", to: [0.78, 0.72] }, { e: "🍬", to: [0.5, 0.62] }],
      decals: [
        { k: "rug", x: 0.5, y: 0.54, r: 0.21, pal: 0 },
        { k: "rug", x: 0.5, y: 0.16, r: 0.16, pal: 1 },
        { k: "mat", x0: 0.06, y0: 0.66, x1: 0.36, y1: 0.86 },
        { k: "splat", x: 0.72, y: 0.72, r: 0.05, c: "#ff6b6b" },
        { k: "splat", x: 0.87, y: 0.8, r: 0.045, c: "#58c7ff" },
        { k: "splat", x: 0.7, y: 0.83, r: 0.04, c: "#ffd93d" },
        { k: "splat", x: 0.88, y: 0.69, r: 0.035, c: "#7be08a" },
        { k: "stripes", x0: 0.06, y0: 0.24, x1: 0.36, y1: 0.42 },
        { k: "rug", x: 0.79, y: 0.33, r: 0.13, pal: 2 },
      ],
      tiers: [
        { r: [3.1, 3.6], items: [["🍬", 30], ["🎲", 12, "blocks", 3], ["🧩", 12, "blocks", 3], ["🖍️", 10, "art", 2], ["🪀", 8], ["🎀", 10, null, 2]] },
        { r: [4.8, 5.4], items: [["⚽", 7], ["🏀", 5], ["🧸", 8, "bed", 2], ["📚", 8, "music", 2], ["🚗", 8, "rug", 2], ["🎈", 6], ["🪁", 4], ["🎨", 6, "art"]] },
        { r: [7.0, 7.8], items: [["🤖", 6, "rug"], ["🥁", 5, "music"], ["🎸", 5, "music"], ["🛴", 5], ["🚂", 6, "rug"], ["🎁", 6]] },
        { r: [10.0, 11.0], items: [["🪑", 6], ["🧺", 5], ["🚲", 4], ["🎹", 4]] },
        { r: [14.0, 15.0], items: [["🛏️", 4], ["📺", 4]] },
      ],
      finale: { e: "🏰", r: 20, at: [0.5, 0.16] },
    },
    {
      id: "picnic", name: "Picnic Park", door: "🧺", color: "#8fd16a",
      ground: "grass", hole: "gobble",
      backdrop: ["#dff4ff", "#bfe6ff"],
      start: [0.5, 0.9], starters: 3,
      zones: {
        blanket: [[0.08, 0.55, 0.32, 0.67], [0.63, 0.69, 0.91, 0.81], [0.13, 0.25, 0.35, 0.35]],
        flowers: [[0.21, 0.795, 0.39, 0.885], [0.57, 0.265, 0.75, 0.355], [0.81, 0.875, 0.95, 0.965]],
        woods: [[0.03, 0.03, 0.36, 0.24], [0.68, 0.03, 0.97, 0.24]],
      },
      trails: [{ e: "🌼", to: [0.2, 0.62] }, { e: "🌼", to: [0.78, 0.74] }, { e: "🌼", to: [0.5, 0.5] }],
      decals: [
        { k: "shade", x: 0.19, y: 0.11, r: 0.17 },
        { k: "shade", x: 0.83, y: 0.12, r: 0.15 },
        { k: "path", w: 10, pts: [[0.5, 1.02], [0.5, 0.84], [0.36, 0.66], [0.5, 0.46], [0.5, 0.22]] },
        { k: "path", w: 8, pts: [[0.43, 0.56], [0.7, 0.54], [0.86, 0.36]] },
        { k: "blanket", x0: 0.07, y0: 0.54, x1: 0.33, y1: 0.68, c: "#ef4b5c" },
        { k: "blanket", x0: 0.62, y0: 0.68, x1: 0.92, y1: 0.82, c: "#4b8def" },
        { k: "blanket", x0: 0.12, y0: 0.24, x1: 0.36, y1: 0.36, c: "#f2a93b" },
        { k: "pond", x: 0.8, y: 0.42, r: 0.1 },
        { k: "pond", x: 0.14, y: 0.87, r: 0.065 },
        { k: "flowers", x: 0.3, y: 0.84, r: 0.09 },
        { k: "flowers", x: 0.66, y: 0.31, r: 0.09 },
        { k: "flowers", x: 0.88, y: 0.92, r: 0.07 },
      ],
      tiers: [
        { r: [3.1, 3.6], items: [["🍓", 16, "blanket", 4], ["🍒", 8, null, 2], ["🍇", 6, "blanket", 2], ["🌸", 16, "flowers", 4], ["🍄", 12, "woods", 3], ["🌼", 30]] },
        { r: [4.8, 5.4], items: [["🧁", 6, "blanket"], ["🍩", 6, "blanket"], ["🥪", 6, "blanket"], ["🍎", 10, null, 2], ["🍐", 6, null, 2], ["🍌", 6], ["🍪", 6], ["🧃", 6]] },
        { r: [7.0, 7.8], items: [["🍉", 8], ["🍍", 8], ["🥧", 6, "blanket"], ["🌻", 12, "flowers", 3]] },
        { r: [10.0, 11.0], items: [["⛺", 5], ["🌲", 8, "woods"], ["🪴", 4], ["🧺", 3]] },
        { r: [14.0, 15.0], items: [["🌳", 6, "woods"], ["⛲", 3]] },
      ],
      finale: { e: "🎡", r: 20, at: [0.5, 0.15] },
    },
    {
      id: "build", name: "Building Site", door: "🚧", color: "#ffc93c",
      ground: "dirt", hole: "gobble",
      backdrop: ["#e9f4ff", "#cfe3f7"],
      start: [0.5, 0.9], starters: 3,
      zones: {
        gravel: [[0.72, 0.15, 0.88, 0.25], [0.08, 0.46, 0.2, 0.54]],
        bricks: [[0.07, 0.65, 0.33, 0.83]],
        lot: [[0.56, 0.46, 0.93, 0.64]],
      },
      trails: [{ e: "🔩", to: [0.2, 0.7] }, { e: "🔩", to: [0.78, 0.6] }, { e: "🔩", to: [0.5, 0.55] }],
      decals: [
        { k: "tracks", pts: [[-0.02, 0.3], [0.35, 0.22], [0.55, 0.88], [1.02, 0.78]] },
        { k: "tracks", pts: [[0.1, 1.02], [0.3, 0.6], [0.8, 0.5], [1.02, 0.2]] },
        { k: "gravel", x: 0.8, y: 0.2, r: 0.09 },
        { k: "gravel", x: 0.14, y: 0.5, r: 0.07 },
        { k: "slab", x0: 0.54, y0: 0.44, x1: 0.95, y1: 0.66 },
        { k: "pallet", x0: 0.06, y0: 0.64, x1: 0.34, y1: 0.84 },
        { k: "puddle", x: 0.3, y: 0.76, r: 0.05 },
        { k: "puddle", x: 0.72, y: 0.9, r: 0.04 },
        { k: "puddle", x: 0.4, y: 0.3, r: 0.035 },
      ],
      tiers: [
        { r: [3.1, 3.6], items: [["🔩", 30], ["🪨", 16, "gravel", 4], ["🧱", 16, "bricks", 4], ["🔨", 6], ["🔧", 6], ["🪛", 8]] },
        { r: [4.8, 5.4], items: [["⛑️", 8], ["🪣", 8], ["🧰", 8], ["🚧", 12, null, 3], ["🪜", 6], ["🦺", 8]] },
        { r: [7.0, 7.8], items: [["🛢️", 10, null, 2], ["🪵", 10, "bricks", 2], ["🚦", 6], ["🧯", 8]] },
        { r: [10.0, 11.0], items: [["🚜", 7, "lot"], ["🛻", 6, "lot"], ["🚚", 6]] },
        { r: [14.0, 15.0], items: [["🚛", 5], ["🏗️", 4]] },
      ],
      finale: { e: "🏢", r: 20, at: [0.5, 0.15] },
    },
    {
      id: "town", name: "Busy Town", door: "🚦", color: "#5ec8ff",
      ground: "town", hole: "gobble",
      backdrop: ["#e3f6ff", "#bde7ff"],
      start: [0.5, 0.9], starters: 3,
      // Two streets across and two down: every car, bus and scooter stands ON
      // a road (its centre in the lane — a bus is wider than a lane).
      zones: {
        road: [[0, 0.455, 1, 0.505], [0, 0.745, 1, 0.795], [0.195, 0, 0.235, 1], [0.765, 0, 0.805, 1]],
        park: [[0.42, 0.56, 0.58, 0.69]],
        lot: [[0.845, 0.84, 0.965, 0.975]],
      },
      trails: [{ e: "🪙", to: [0.35, 0.68] }, { e: "🪙", to: [0.65, 0.68] }, { e: "🪙", to: [0.5, 0.58] }],
      decals: [
        { k: "yard", x0: 0.3, y0: 0.04, x1: 0.7, y1: 0.27 },
        { k: "road", x0: 0, y0: 0.44, x1: 1, y1: 0.52 },
        { k: "road", x0: 0, y0: 0.73, x1: 1, y1: 0.81 },
        { k: "road", x0: 0.18, y0: 0, x1: 0.25, y1: 1 },
        { k: "road", x0: 0.75, y0: 0, x1: 0.82, y1: 1 },
        { k: "zebra", x0: 0.4, y0: 0.44, x1: 0.47, y1: 0.52 },
        { k: "zebra", x0: 0.53, y0: 0.73, x1: 0.6, y1: 0.81 },
        { k: "park", x: 0.5, y: 0.625, r: 0.09 },
        { k: "lot", x0: 0.83, y0: 0.83, x1: 0.985, y1: 0.99 },
        { k: "hedge", x0: 0.3, y0: 0.34, x1: 0.7, y1: 0.36 },
        { k: "hedge", x0: 0.3, y0: 0.9, x1: 0.42, y1: 0.915 },
        { k: "hedge", x0: 0.58, y0: 0.9, x1: 0.7, y1: 0.915 },
      ],
      tiers: [
        { r: [3.1, 3.6], items: [["🪙", 30], ["🌷", 16, "park", 4], ["🍦", 10], ["🔑", 8], ["🥤", 10, null, 2], ["🧃", 10, null, 2]] },
        { r: [4.8, 5.4], items: [["🚦", 8], ["🛑", 8], ["🗑️", 10, null, 2], ["📮", 8], ["🛵", 10, "road"], ["🚲", 8]] },
        { r: [7.0, 7.8], items: [["🚗", 8, "road"], ["🚕", 8, "road"], ["🚙", 6, "road"], ["🚓", 5, "road"], ["🏍️", 6, "road"]] },
        { r: [10.0, 11.0], items: [["🚌", 6, "road"], ["🚒", 4, "road"], ["🚑", 4, "road"], ["🚐", 4, "lot"]] },
        { r: [14.0, 15.0], items: [["🏠", 6], ["🏪", 3]] },
      ],
      finale: { e: "🏫", r: 20, at: [0.5, 0.15] },   // the whole school! (🏙️ drew as a framed square picture, not a building)
    },
    {
      id: "party", name: "Party Time", door: "🎂", color: "#ff7ac0",
      ground: "party", hole: "gobble",
      backdrop: ["#fff0f7", "#ffd6ea"],
      start: [0.5, 0.9], starters: 3,
      zones: {
        table: [[0.06, 0.25, 0.41, 0.41], [0.59, 0.25, 0.94, 0.41]],
        gifts: [[0.06, 0.5, 0.28, 0.66], [0.72, 0.5, 0.94, 0.66]],
        dance: [[0.37, 0.75, 0.63, 0.85]],
      },
      trails: [{ e: "🍬", to: [0.2, 0.7] }, { e: "🍬", to: [0.8, 0.7] }, { e: "🍬", to: [0.5, 0.6] }],
      decals: [
        { k: "rug", x: 0.5, y: 0.15, r: 0.15, pal: 3 },
        { k: "heart", x: 0.5, y: 0.56, r: 0.2 },
        { k: "heart", x: 0.2, y: 0.82, r: 0.09 },
        { k: "heart", x: 0.8, y: 0.82, r: 0.09 },
        { k: "cloth", x0: 0.05, y0: 0.24, x1: 0.42, y1: 0.42 },
        { k: "cloth", x0: 0.58, y0: 0.24, x1: 0.95, y1: 0.42 },
        { k: "dance", x0: 0.36, y0: 0.74, x1: 0.64, y1: 0.86 },
      ],
      tiers: [
        { r: [3.1, 3.6], items: [["🍬", 30], ["🍭", 8], ["🍫", 12, "table", 2], ["💝", 6], ["🍓", 12, "table", 3], ["🎀", 14, null, 2]] },
        { r: [4.8, 5.4], items: [["🧁", 8, "table", 2], ["🍩", 8, "table"], ["🍪", 8, "table"], ["🎈", 12, null, 3], ["🎉", 8, "dance"], ["🎊", 6, "dance"]] },
        { r: [7.0, 7.8], items: [["🍰", 8, "table"], ["🍕", 8, "table"], ["🍿", 6], ["🧸", 10]] },
        { r: [10.0, 11.0], items: [["🪅", 6], ["🎁", 8, "gifts"], ["🪑", 6], ["🪆", 4]] },
        { r: [14.0, 15.0], items: [["🎪", 4], ["🎠", 4]] },
      ],
      finale: { e: "🎂", r: 20, at: [0.5, 0.15] },
    },
    {
      id: "space", name: "Outer Space", door: "🚀", color: "#8a7bff",
      ground: "space", hole: "blackhole",
      backdrop: ["#0a0d26", "#151a45"],
      start: [0.5, 0.9], starters: 3,
      zones: {
        belt: [[0, 0.49, 1, 0.59]],
        station: [[0.61, 0.71, 0.91, 0.87]],
      },
      trails: [{ e: "⭐", to: [0.22, 0.72] }, { e: "⭐", to: [0.78, 0.68] }, { e: "⭐", to: [0.5, 0.62] }],
      decals: [
        { k: "nebula", x: 0.25, y: 0.3, r: 0.35, c: "rgba(255,122,192,0.22)" },
        { k: "nebula", x: 0.78, y: 0.62, r: 0.4, c: "rgba(94,200,255,0.16)" },
        { k: "nebula", x: 0.45, y: 0.9, r: 0.32, c: "rgba(199,125,255,0.22)" },
        { k: "belt", w: 46, pts: [[-0.02, 0.56], [0.5, 0.47], [1.02, 0.58]] },
        { k: "station", x0: 0.6, y0: 0.7, x1: 0.92, y1: 0.88 },
      ],
      tiers: [
        { r: [3.1, 3.6], items: [["⭐", 30], ["💎", 15, null, 3], ["🪨", 16, "belt", 4], ["🔋", 6], ["🌟", 16, null, 4]] },
        { r: [4.8, 5.4], items: [["🌙", 8], ["☄️", 12, "belt"], ["🔭", 8, "station"], ["🛰️", 10], ["📡", 10, "station"]] },
        { r: [7.0, 7.8], items: [["🛸", 10], ["🚀", 14, null, 2], ["🤖", 8, "station"]] },
        { r: [10.0, 11.0], items: [["🌕", 8], ["🌍", 6], ["🌎", 6]] },
        { r: [14.0, 15.0], items: [["🪐", 8]] },
      ],
      finale: { e: "☀️", r: 20, at: [0.5, 0.15] },
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
