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
// Phase 3 (§11, the owner's pick of 2026-10-01: "make each level even larger
// so they take more time and also double the amount of playable levels"):
// every world is twice the area, holds about twice as many things, a grow
// takes more bites, and there are twelve places instead of six.
//
// Emoji law: every picture is <= Emoji 13.0 (Josh's iPad is iOS 14.2) and a
// text-default one carries VS16 — both are site-wide guardrails. And Gobble
// never eats anything ALIVE: no animals, no people, no favourite characters
// (hole-logic.test.js scans the Unicode ranges, so it is not a list).

(function (global) {
  const RULES = {
    // A save carries this. A half-eaten run from another layout — the
    // one-screen islands of phase 1 (no version), or the smaller worlds of
    // phase 2 (2) — names ids that mean different things here, so it is
    // dropped; a finished place's ⭐ lives elsewhere in the save and is kept.
    LAYOUT: 3,
    // The world, in world units. It no longer bends to the screen: the
    // screen is a camera onto it (so a saved run never depends on the device).
    // Phase 2's worlds were 300 x 420; these are 1.4 times as wide AND as
    // tall, i.e. twice the ground to cover.
    WORLD: [420, 588],
    // The ground is seen in 3/4 view: ONE metric for every ground distance,
    // hypot(dx, dy / SQ). The renderer draws the hole with ry = rx * SQ, so an
    // object falls in exactly when it LOOKS inside the hole.
    SQ: 0.72,
    FIT: 0.92,        // an object fits when r <= hole.r * FIT
    HEAD: 1.05,       // a level's radius clears its tier's biggest thing by 5%
    // A grow needs this many bites' worth of the NEWEST edible tier's xp
    // (C[1..5]). Six sweets for the first "BIGGER!" (that one stays quick:
    // it is how a new player learns what eating DOES), then more of whatever
    // just became edible at each size — a bigger world to roam before the
    // next grow, and still never a hunt (a law: at most half of what is
    // edible so far, so a whole district he never visits cannot block one).
    GROW_BITES: [6, 10, 12, 14, 16],
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
    TRAIL_MAX: 12,    // …and a trail is at most this many bites long
    HINT_AFTER: 6,    // seconds without a gulp before the sparkle trail shows
  };

  // A place: 5 tiers (tiny → huge) + one FINALE.
  //   items: [emoji, count, zone?, clump?] — a clump of k stands together, so
  //          one pass hoovers up the lot.
  //   zones: named rects [x0, y0, x1, y1], normalized — where a zoned thing's
  //          centre stands. They sit on the matching ground decal.
  //   private: zones that hold ONLY their own things (the sea holds the boats,
  //          never an ice cream on the waves).
  //   avoid: rects nothing stands in (the lava).
  //   trails: lines of one tier-1 bite leading out from the start.
  //   decals: the ground's features (drawn only; nothing stands "on" them).
  //          Positions are normalized; a width `w` is in world units.
  // The first `starters` tier-1 bites are placed right beside Gobble so the
  // first gulp is instant. The ORDER of the places is the order ▶ walks them
  // in after a win (the last wraps round to the first).
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
        { r: [3.1, 3.6], items: [["🍬", 60], ["🎲", 24, "blocks", 3], ["🧩", 24, "blocks", 3], ["🖍️", 20, "art", 2], ["🪀", 16], ["🎀", 20, null, 2]] },
        { r: [4.8, 5.4], items: [["⚽", 14], ["🏀", 10], ["🧸", 16, "bed", 2], ["📚", 16, "music", 2], ["🚗", 16, "rug", 2], ["🎈", 12], ["🪁", 8], ["🎨", 12, "art"]] },
        { r: [7.0, 7.8], items: [["🤖", 12, "rug"], ["🥁", 10, "music"], ["🎸", 10, "music"], ["🛴", 10], ["🚂", 12, "rug"], ["🎁", 12]] },
        { r: [10.0, 11.0], items: [["🪑", 12], ["🧺", 10], ["🚲", 8], ["🎹", 8]] },
        { r: [14.0, 15.0], items: [["🛏️", 8], ["📺", 8]] },
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
        { r: [3.1, 3.6], items: [["🍓", 32, "blanket", 4], ["🍒", 16, null, 2], ["🍇", 12, "blanket", 2], ["🌸", 32, "flowers", 4], ["🍄", 24, "woods", 3], ["🌼", 60]] },
        { r: [4.8, 5.4], items: [["🧁", 12, "blanket"], ["🍩", 12, "blanket"], ["🥪", 12, "blanket"], ["🍎", 20, null, 2], ["🍐", 12, null, 2], ["🍌", 12], ["🍪", 12], ["🧃", 12]] },
        { r: [7.0, 7.8], items: [["🍉", 16], ["🍍", 16], ["🥧", 12, "blanket"], ["🌻", 24, "flowers", 3]] },
        { r: [10.0, 11.0], items: [["⛺", 10], ["🌲", 16, "woods"], ["🪴", 8], ["🧺", 6]] },
        { r: [14.0, 15.0], items: [["🌳", 12, "woods"], ["⛲", 6]] },
      ],
      finale: { e: "🎡", r: 20, at: [0.5, 0.15] },
    },
    {
      // A farm with NOTHING alive on it: crops, fruit, tools and tractors —
      // and the biggest thing in the whole place is a prize pumpkin.
      id: "farm", name: "Sunny Farm", door: "🚜", color: "#ffd166",
      ground: "farm", hole: "gobble",
      backdrop: ["#e8f7ff", "#c6e9ff"],
      start: [0.5, 0.9], starters: 3,
      zones: {
        field: [[0.06, 0.25, 0.37, 0.43], [0.63, 0.25, 0.94, 0.43]],
        veg: [[0.07, 0.55, 0.35, 0.69]],
        orchard: [[0.64, 0.5, 0.94, 0.72]],
        yard: [[0.4, 0.5, 0.6, 0.68]],
      },
      trails: [{ e: "🥕", to: [0.2, 0.64] }, { e: "🥕", to: [0.8, 0.64] }, { e: "🥕", to: [0.5, 0.52] }],
      decals: [
        { k: "patch", x: 0.5, y: 0.15, r: 0.13, c: "#c79a5b" },
        { k: "crops", x0: 0.05, y0: 0.24, x1: 0.38, y1: 0.44, c: "#e9c46a" },
        { k: "crops", x0: 0.62, y0: 0.24, x1: 0.95, y1: 0.44, c: "#7cc95a" },
        { k: "fence", pts: [[0.04, 0.475], [0.4, 0.475]] },
        { k: "fence", pts: [[0.6, 0.475], [0.96, 0.475]] },
        { k: "soil", x0: 0.06, y0: 0.54, x1: 0.36, y1: 0.7 },
        { k: "shade", x: 0.79, y: 0.61, r: 0.17 },
        { k: "patch", x: 0.5, y: 0.59, r: 0.13, c: "#d6b07a" },
        { k: "tracks", pts: [[0.5, 1.02], [0.47, 0.76], [0.5, 0.6], [0.44, 0.47], [0.5, 0.3]] },
        { k: "pond", x: 0.85, y: 0.86, r: 0.07 },
        { k: "pond", x: 0.14, y: 0.84, r: 0.05 },
      ],
      tiers: [
        { r: [3.1, 3.6], items: [["🥕", 60], ["🌽", 24, "field", 3], ["🍅", 24, "veg", 4], ["🥔", 20, "veg", 4], ["🥚", 18, null, 3], ["🫑", 16, null, 2]] },
        { r: [4.8, 5.4], items: [["🍎", 20, "orchard", 2], ["🥦", 16, "veg", 2], ["🥬", 16, "veg", 2], ["🍐", 12, "orchard", 2], ["🌻", 16, null, 4], ["🪣", 10], ["🥛", 10]] },
        { r: [7.0, 7.8], items: [["🍉", 14], ["🌾", 20, "field", 2], ["🧺", 12], ["🍯", 8], ["🪵", 10, null, 2]] },
        { r: [10.0, 11.0], items: [["🚜", 12, "yard"], ["🌳", 12, "orchard"], ["🛻", 8], ["🛖", 6]] },
        { r: [14.0, 15.0], items: [["🏡", 8], ["🚛", 8]] },
      ],
      finale: { e: "🎃", r: 20, at: [0.5, 0.15] },
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
        { r: [3.1, 3.6], items: [["🔩", 60], ["🪨", 32, "gravel", 4], ["🧱", 32, "bricks", 4], ["🔨", 12], ["🔧", 12], ["🪛", 16]] },
        { r: [4.8, 5.4], items: [["⛑️", 16], ["🪣", 16], ["🧰", 16], ["🚧", 24, null, 3], ["🪜", 12], ["🦺", 16]] },
        { r: [7.0, 7.8], items: [["🛢️", 20, null, 2], ["🪵", 20, "bricks", 2], ["🚦", 12], ["🧯", 16]] },
        { r: [10.0, 11.0], items: [["🚜", 12, "lot"], ["🛻", 12, "lot"], ["🚚", 14]] },
        { r: [14.0, 15.0], items: [["🚛", 10], ["🏗️", 8]] },
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
        { r: [3.1, 3.6], items: [["🪙", 60], ["🌷", 32, "park", 4], ["🍦", 20], ["🔑", 16], ["🥤", 20, null, 2], ["🧃", 20, null, 2]] },
        { r: [4.8, 5.4], items: [["🚦", 16], ["🛑", 16], ["🗑️", 20, null, 2], ["📮", 16], ["🛵", 20, "road"], ["🚲", 16]] },
        { r: [7.0, 7.8], items: [["🚗", 16, "road"], ["🚕", 16, "road"], ["🚙", 12, "road"], ["🚓", 10, "road"], ["🏍️", 12, "road"]] },
        { r: [10.0, 11.0], items: [["🚌", 12, "road"], ["🚒", 8, "road"], ["🚑", 8, "road"], ["🚐", 6, "lot"]] },
        { r: [14.0, 15.0], items: [["🏠", 12], ["🏪", 6]] },
      ],
      finale: { e: "🏫", r: 20, at: [0.5, 0.15] },   // the whole school! (🏙️ drew as a framed square picture, not a building)
    },
    {
      id: "sports", name: "Sports Day", door: "⚽", color: "#4cc76a",
      ground: "pitch", hole: "gobble",
      backdrop: ["#e6f6ff", "#c3e4ff"],
      start: [0.5, 0.9], starters: 3,
      zones: {
        pitch: [[0.26, 0.47, 0.74, 0.63]],
        court: [[0.06, 0.77, 0.32, 0.91]],
        podium: [[0.69, 0.79, 0.91, 0.87]],
      },
      trails: [{ e: "🎾", to: [0.22, 0.7] }, { e: "🎾", to: [0.78, 0.7] }, { e: "🎾", to: [0.5, 0.58] }],
      decals: [
        { k: "track", x: 0.5, y: 0.55, rx: 0.44, ry: 0.17 },
        { k: "pitch", x0: 0.22, y0: 0.45, x1: 0.78, y1: 0.65 },
        { k: "court", x0: 0.05, y0: 0.76, x1: 0.33, y1: 0.92, c: "#4f8de8" },
        { k: "podium", x0: 0.68, y0: 0.78, x1: 0.92, y1: 0.88 },
        { k: "court", x0: 0.06, y0: 0.2, x1: 0.3, y1: 0.34, c: "#e8874f" },
        { k: "court", x0: 0.7, y0: 0.2, x1: 0.94, y1: 0.34, c: "#7b6be8" },
      ],
      tiers: [
        { r: [3.1, 3.6], items: [["🎾", 60], ["⚾", 24, null, 3], ["🥇", 18, "podium", 3], ["🏸", 16, "court", 2], ["🏓", 16, "court", 2], ["🥤", 28, null, 4]] },
        { r: [4.8, 5.4], items: [["⚽", 20, "pitch"], ["🏀", 16, "court"], ["🏈", 12], ["🏐", 14], ["🥏", 12], ["🧢", 14, null, 2], ["👟", 12, null, 2]] },
        { r: [7.0, 7.8], items: [["🛹", 12], ["🛼", 10], ["🏆", 10, "podium"], ["🥅", 8, "pitch"], ["🏏", 8], ["🎳", 8], ["🏒", 8]] },
        { r: [10.0, 11.0], items: [["🚲", 12], ["🛴", 12], ["⛳", 8], ["🏁", 6]] },
        { r: [14.0, 15.0], items: [["🚌", 8], ["🎪", 8]] },
      ],
      finale: { e: "🏟️", r: 20, at: [0.5, 0.15] },
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
        { r: [3.1, 3.6], items: [["🍬", 60], ["🍭", 16], ["🍫", 24, "table", 2], ["💝", 12], ["🍓", 24, "table", 3], ["🎀", 28, null, 2]] },
        { r: [4.8, 5.4], items: [["🧁", 16, "table", 2], ["🍩", 16, "table"], ["🍪", 16, "table"], ["🎈", 24, null, 3], ["🎉", 16, "dance"], ["🎊", 12, "dance"]] },
        { r: [7.0, 7.8], items: [["🍰", 16, "table"], ["🍕", 16, "table"], ["🍿", 12], ["🧸", 20]] },
        { r: [10.0, 11.0], items: [["🪅", 12], ["🎁", 16, "gifts"], ["🪑", 12], ["🪆", 8]] },
        { r: [14.0, 15.0], items: [["🎪", 8], ["🎠", 8]] },
      ],
      finale: { e: "🎂", r: 20, at: [0.5, 0.15] },
    },
    {
      // The sea runs along the far side: the boats float on it (it is a
      // PRIVATE zone, so no ice cream bobs on the waves) and the biggest
      // thing of all is the ship waiting out there.
      id: "beach", name: "Beach Day", door: "🏖️", color: "#ffd27a",
      ground: "sand", hole: "gobble",
      backdrop: ["#dff6ff", "#9fdcf5"],
      start: [0.5, 0.9], starters: 3,
      zones: {
        sea: [[0.03, 0.04, 0.97, 0.26]],
        towel: [[0.08, 0.5, 0.24, 0.62], [0.74, 0.56, 0.92, 0.68], [0.4, 0.4, 0.56, 0.5]],
        pool: [[0.12, 0.77, 0.24, 0.87], [0.77, 0.82, 0.87, 0.9]],
      },
      private: ["sea"],
      trails: [{ e: "🍦", to: [0.22, 0.66] }, { e: "🍦", to: [0.78, 0.72] }, { e: "🍦", to: [0.5, 0.55] }],
      decals: [
        { k: "sea", y1: 0.3 },
        { k: "towel", x0: 0.07, y0: 0.49, x1: 0.25, y1: 0.63, c: "#ff6b6b" },
        { k: "towel", x0: 0.73, y0: 0.55, x1: 0.93, y1: 0.69, c: "#58c7ff" },
        { k: "towel", x0: 0.39, y0: 0.39, x1: 0.57, y1: 0.51, c: "#ffd24d" },
        { k: "rockpool", x: 0.18, y: 0.82, r: 0.08 },
        { k: "rockpool", x: 0.82, y: 0.86, r: 0.065 },
        { k: "footprints", pts: [[0.5, 0.98], [0.42, 0.78], [0.6, 0.6], [0.48, 0.36]] },
      ],
      tiers: [
        { r: [3.1, 3.6], items: [["🍦", 60], ["⭐", 24, null, 3], ["💎", 18, null, 3], ["🪨", 24, "pool", 4], ["🧃", 18, null, 2], ["🪙", 18, null, 3]] },
        { r: [4.8, 5.4], items: [["🩴", 16, "towel", 2], ["🕶️", 12, "towel"], ["🧴", 12, "towel"], ["🏐", 14], ["🪣", 16], ["🥥", 16, null, 2], ["👑", 14]] },
        { r: [7.0, 7.8], items: [["⛱️", 12], ["🪁", 10], ["🍉", 12], ["🛶", 10, "sea"], ["🧺", 10], ["🗺️", 10]] },
        { r: [10.0, 11.0], items: [["⛵", 14, "sea"], ["🚤", 12, "sea"], ["🌴", 14]] },
        { r: [14.0, 15.0], items: [["🛥️", 8, "sea"], ["⛴️", 6, "sea"], ["🏝️", 4, "sea"]] },
      ],
      finale: { e: "🚢", r: 20, at: [0.5, 0.14] },
    },
    {
      // A jungle island with a friendly volcano at its far end. Its lava
      // runs in two streams nothing stands on (the `avoid` rects).
      id: "volcano", name: "Volcano Island", door: "🌋", color: "#ff8a4c",
      ground: "jungle", hole: "gobble",
      backdrop: ["#d9f3ff", "#8fd3ee"],
      start: [0.5, 0.9], starters: 3,
      zones: {
        village: [[0.66, 0.72, 0.94, 0.9]],
        jungle: [[0.04, 0.4, 0.28, 0.62], [0.74, 0.48, 0.96, 0.68]],
        flowers: [[0.38, 0.58, 0.62, 0.7]],
        lagoon: [[0.08, 0.76, 0.3, 0.9]],
        cave: [[0.38, 0.25, 0.62, 0.35]],
      },
      avoid: [[0.27, 0.18, 0.36, 0.46], [0.64, 0.18, 0.73, 0.46]],
      trails: [{ e: "🍌", to: [0.2, 0.68] }, { e: "🍌", to: [0.8, 0.66] }, { e: "🍌", to: [0.5, 0.52] }],
      decals: [
        { k: "patch", x: 0.5, y: 0.15, r: 0.14, c: "#6b5446" },
        { k: "lava", w: 9, pts: [[0.33, 0.17], [0.31, 0.26], [0.33, 0.35], [0.31, 0.45]] },
        { k: "lava", w: 9, pts: [[0.67, 0.17], [0.69, 0.26], [0.67, 0.35], [0.69, 0.45]] },
        { k: "shade", x: 0.15, y: 0.51, r: 0.17 },
        { k: "shade", x: 0.85, y: 0.58, r: 0.15 },
        { k: "pond", x: 0.19, y: 0.84, r: 0.1 },
        { k: "patch", x: 0.8, y: 0.81, r: 0.13, c: "#c9a46a" },
        { k: "stones", pts: [[0.5, 1.0], [0.5, 0.82], [0.56, 0.68], [0.5, 0.54], [0.5, 0.4]] },
        { k: "flowers", x: 0.5, y: 0.64, r: 0.1 },
      ],
      tiers: [
        { r: [3.1, 3.6], items: [["🍌", 60], ["🥭", 16, null, 2], ["🫐", 18, null, 3], ["🌺", 24, "flowers", 4], ["🍄", 20, "jungle", 4], ["💎", 24, "cave", 3]] },
        { r: [4.8, 5.4], items: [["🥥", 16, null, 2], ["🍍", 14], ["🥝", 12, null, 2], ["🌿", 16, "jungle", 4], ["🪨", 16, null, 4], ["🏺", 12, "village"], ["🔦", 14]] },
        { r: [7.0, 7.8], items: [["🛶", 10, "lagoon"], ["🪵", 12, null, 2], ["🥁", 10, "village"], ["🎋", 12], ["⛺", 10], ["🗺️", 10]] },
        { r: [10.0, 11.0], items: [["🌴", 16, "jungle"], ["🛖", 10, "village"], ["🗿", 8], ["⛵", 6, "lagoon"]] },
        { r: [14.0, 15.0], items: [["🌳", 6], ["🗻", 6], ["⛰️", 6]] },
      ],
      finale: { e: "🌋", r: 20, at: [0.5, 0.15] },
    },
    {
      id: "snow", name: "Snow Day", door: "⛄", color: "#9fd7ff",
      ground: "snow", hole: "gobble",
      backdrop: ["#eef6ff", "#cfe0f5"],
      start: [0.5, 0.9], starters: 3,
      zones: {
        ice: [[0.16, 0.53, 0.4, 0.67], [0.66, 0.73, 0.82, 0.83]],
        forest: [[0.04, 0.24, 0.3, 0.42], [0.72, 0.3, 0.96, 0.5]],
        village: [[0.34, 0.3, 0.66, 0.5]],
      },
      trails: [{ e: "❄️", to: [0.2, 0.74] }, { e: "❄️", to: [0.8, 0.64] }, { e: "❄️", to: [0.5, 0.56] }],
      decals: [
        { k: "drift", x: 0.5, y: 0.15, r: 0.15 },
        { k: "ice", x: 0.28, y: 0.6, r: 0.15 },
        { k: "ice", x: 0.74, y: 0.78, r: 0.1 },
        { k: "drift", x: 0.16, y: 0.33, r: 0.13 },
        { k: "drift", x: 0.84, y: 0.4, r: 0.12 },
        { k: "drift", x: 0.86, y: 0.92, r: 0.07 },
        { k: "tracks", c: "rgba(110,140,190,0.45)", pts: [[0.04, 1.02], [0.12, 0.72], [0.46, 0.62], [0.52, 0.28], [0.9, 0.12]] },
        { k: "tracks", c: "rgba(110,140,190,0.45)", pts: [[1.02, 0.9], [0.6, 0.86], [0.56, 0.7], [0.96, 0.6]] },
      ],
      tiers: [
        { r: [3.1, 3.6], items: [["❄️", 60], ["🍪", 18, null, 3], ["☕", 16, null, 2], ["🧦", 16, null, 2], ["🔔", 12], ["🧊", 24, "ice", 4], ["🍭", 16]] },
        { r: [4.8, 5.4], items: [["🧤", 16, null, 2], ["🧣", 14], ["⛸️", 16, "ice", 2], ["🥌", 12, "ice"], ["🏒", 12, "ice"], ["🎒", 16], ["🎁", 14]] },
        { r: [7.0, 7.8], items: [["☃️", 12], ["🛷", 12], ["🎿", 10], ["🎄", 10, "forest"], ["🪵", 10, null, 2], ["🧸", 10]] },
        { r: [10.0, 11.0], items: [["🌲", 16, "forest"], ["🛖", 8, "village"], ["🚡", 6], ["🚠", 6], ["🚙", 4]] },
        { r: [14.0, 15.0], items: [["🏠", 8, "village"], ["🚂", 8]] },
      ],
      finale: { e: "🏔️", r: 20, at: [0.5, 0.15] },
    },
    {
      // Two runways (PRIVATE: only aeroplanes stand on them), the terminal,
      // a car park and a heliport — and a jumbo jet waiting on the apron.
      id: "airport", name: "Airport", door: "🛫", color: "#7aa7ff",
      ground: "tarmac", hole: "gobble",
      backdrop: ["#e5f3ff", "#b9dcff"],
      start: [0.5, 0.9], starters: 3,
      zones: {
        runway: [[0.06, 0.31, 0.94, 0.39], [0.06, 0.53, 0.94, 0.59]],
        terminal: [[0.06, 0.67, 0.41, 0.85]],
        lot: [[0.59, 0.67, 0.94, 0.85]],
        heli: [[0.7, 0.42, 0.96, 0.5]],
      },
      private: ["runway"],
      trails: [{ e: "🎫", to: [0.22, 0.64] }, { e: "🎫", to: [0.78, 0.64] }, { e: "🎫", to: [0.5, 0.62] }],
      decals: [
        { k: "slab", x0: 0.28, y0: 0.05, x1: 0.72, y1: 0.25 },
        { k: "runway", x0: 0.04, y0: 0.3, x1: 0.96, y1: 0.4 },
        { k: "runway", x0: 0.04, y0: 0.52, x1: 0.96, y1: 0.6 },
        { k: "taxiway", pts: [[0.5, 0.24], [0.5, 0.3]] },
        { k: "taxiway", pts: [[0.2, 0.4], [0.2, 0.52]] },
        { k: "taxiway", pts: [[0.5, 0.6], [0.5, 0.97]] },
        { k: "helipad", x: 0.83, y: 0.46, r: 0.05 },
        { k: "terminal", x0: 0.05, y0: 0.66, x1: 0.42, y1: 0.86 },
        { k: "lot", x0: 0.58, y0: 0.66, x1: 0.95, y1: 0.86 },
      ],
      tiers: [
        { r: [3.1, 3.6], items: [["🎫", 60], ["🥨", 18, null, 3], ["🧃", 16, null, 2], ["🪙", 18, null, 3], ["🍬", 16, null, 2], ["☕", 14], ["🍫", 20, null, 4]] },
        { r: [4.8, 5.4], items: [["🧳", 20, "terminal", 2], ["🎒", 16, "terminal"], ["💺", 16, "terminal", 4], ["🕶️", 12], ["🧸", 12], ["🧯", 12], ["🦺", 12]] },
        { r: [7.0, 7.8], items: [["🚗", 12, "lot"], ["🚕", 12, "lot"], ["🚙", 12, "lot"], ["🛺", 8], ["🛻", 10], ["🚜", 10]] },
        { r: [10.0, 11.0], items: [["🚁", 8, "heli"], ["🛩️", 8, "runway"], ["🚌", 10], ["🚒", 6], ["🚚", 8]] },
        { r: [14.0, 15.0], items: [["🛫", 6, "runway"], ["🛬", 6, "runway"], ["🚟", 6]] },
      ],
      finale: { e: "✈️", r: 20, at: [0.5, 0.15] },
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
        { r: [3.1, 3.6], items: [["⭐", 60], ["💎", 30, null, 3], ["🪨", 32, "belt", 4], ["🔋", 12], ["🌟", 32, null, 4]] },
        { r: [4.8, 5.4], items: [["🌙", 16], ["☄️", 24, "belt"], ["🔭", 16, "station"], ["🛰️", 20], ["📡", 20, "station"]] },
        { r: [7.0, 7.8], items: [["🛸", 20], ["🚀", 28, null, 2], ["🤖", 16, "station"]] },
        { r: [10.0, 11.0], items: [["🌕", 16], ["🌍", 12], ["🌎", 12]] },
        { r: [14.0, 15.0], items: [["🪐", 16]] },
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
