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
    // one-screen islands of phase 1 (no version), the smaller worlds of
    // phase 2 (2), or phase 3's worlds before every place had its own shape
    // (3) — names ids that mean different things here, so it is dropped; a
    // finished place's ⭐ lives elsewhere in the save and is kept.
    LAYOUT: 4,
    // ...and each run also carries its place's layout FINGERPRINT (every
    // thing's picture, spot and size, in id order: hole-logic.js printOf), so
    // editing ONE place drops only that place's half-eaten run — the version
    // above need never move again. A run saved before fingerprints (it has no
    // `f`) is trusted for every place except these, which have been laid out
    // again since (hole-logic.test.js holds the old fingerprints, and fails if
    // a place's layout changes without being listed here).
    // §17 gave twelve of the first twenty-four places a new challenge, and
    // that laid them out again (the Snow Day's curling stones only learned to
    // run, so its layout, and its half-eaten runs, stand).
    RELAID: ["toyroom", "picnic", "farm", "sports", "party", "volcano", "market", "maze", "cave", "castle", "circus", "candy"],
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
    // (C[1..5], and C[6] for a GIANT place's sixth size, §17). Six sweets for the first "BIGGER!" (that one stays quick:
    // it is how a new player learns what eating DOES), then more of whatever
    // just became edible at each size — a bigger world to roam before the
    // next grow, and still never a hunt (a law: at most half of what is
    // edible so far, so a whole district he never visits cannot block one).
    GROW_BITES: [6, 10, 12, 14, 16, 8],
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
    // SUPER SLURP (§15.6): AT in a row (each gulp within 0.6s of the last;
    // counted as the run's sparkle counts them, from the second gulp) makes
    // him glow for SECS: his pull reaches REACH further (a + b * hole.r past
    // the magnet's own) and pulls SPEED times as fast. Through open air only,
    // and never the finale (that one he goes to eat himself).
    SLURP: { at: 10, secs: 2, reach: [12, 1.2], speed: 2.4 },
    START_CLEAR: 13,  // nothing but the three starters stands this close to the start
    SEP: 0.95,        // footprints keep SEP * (r1 + r2) apart (ground metric)
    EDGE: 1.5,        // footprints keep this far from the world's edge
    SPRITE_H: 2.25,   // a sprite stands SPRITE_H * r tall above its base
    TOP_SLACK: 7,     // sprites may overhang the world's back edge by this much
    TRAIL_STEP: 11,   // bites on a trail stand this far apart
    TRAIL_MAX: 12,    // …and a trail is at most this many bites long
    HINT_AFTER: 6,    // seconds without a gulp before the sparkle trail shows
    // ---- phase 4 (§14): a place's SHAPE and its CHALLENGE ----
    CORNER: 12,       // a place with no shape of its own is a rectangle with these round corners
    FIELD: 2,         // the island's distance fields are sampled this finely (world units)
    NAV: 5,           // the walking grid's cells (world units)
    WALK_IN: 1,       // a cell is standing room when its centre is this far inside the ground
    CORE: 0.9,        // a wall thing stops Gobble's centre this far out (x its radius)
    KEEP_LANE: 1.5,   // nothing stands within the biggest rider's radius + this of a track
    PORTAL_R: 7,      // step this close to a portal's centre and through it you go
    PORTAL_COST: 6,   // what going through a portal costs a planned route…
    PORTAL_PEN: 30,   // …and what walking PAST one costs it (so a route goes round a portal unless it is the way)
    ICE_TAU: 0.6,     // on ice his speed takes this long to follow the finger (seconds): he slides
    // ---- phase 5 (§17): new things a place can do ----
    // BUMPERS: a bouncy thing still too big to eat knocks him back this fast
    // (units/s, scaled with the zoom), the knock fading over TAU seconds.
    KNOCK: { v: 70, tau: 0.25 },
    // BUTTONS: his centre within max(button r * a, his r * b) of a button's
    // centre presses it.
    PRESS: [0.9, 0.6],
    // RUNAWAYS: a thing he can eat scoots away once he is within FLEE of it
    // (past both rims, scaled with the zoom), at SPEED times his top speed;
    // after TIRE seconds of running it rests REST, and it never strays LEASH
    // from where it stood. With nowhere to go it is cornered and caught.
    RUN: { flee: 26, speed: 0.85, tire: 2.2, rest: 1.6, leash: 70 },
    // POWER-UPS: a magnet's pull lasts MAGNET seconds (the super slurp's own
    // rules); a lightning bolt makes him ZOOM_MUL times as fast for ZOOM seconds.
    POWER: { magnet: 4, zoom: 5, zoomMul: 1.6 },
    // CANNONS: he flies to the other end at SPEED (units/s), each flight
    // lasting between MIN and MAX seconds.
    FLY: { speed: 220, min: 0.7, max: 1.3 },
    // SPROUTS: rolling within this of a seedling (past both rims) pops up
    // what grows from it.
    SPROUT_R: 10,
    // THE FIRST TIME something new is near (within MEET_R, scaled with the
    // zoom) it is introduced; a place-wide thing (counting) after MEET_T
    // seconds, once the opening look is done.
    MEET_R: 60,
    MEET_T: 2.4,
  };

  // ---- Shape helpers (positions normalized to the world, [0,1] across and down)
  const r3 = (v) => Math.round(v * 1000) / 1000;
  // Points round an ellipse AS SEEN: rx of the width, ry of the height.
  function ovalPts(cx, cy, rx, ry, n, a0) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (a0 || 0) + (i / n) * Math.PI * 2;
      out.push([r3(cx + Math.cos(a) * rx), r3(cy + Math.sin(a) * ry)]);
    }
    return out;
  }
  // A running track's loop: two straights joined by half-ovals (as seen).
  function capsulePts(cx, y0, y1, rx, ry, n) {
    const out = [];
    for (let i = 0; i <= n; i++) { const a = Math.PI + (i / n) * Math.PI; out.push([r3(cx + Math.cos(a) * rx), r3(y0 + Math.sin(a) * ry)]); }
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; out.push([r3(cx + Math.cos(a) * rx), r3(y1 + Math.sin(a) * ry)]); }
    return out;
  }
  // A spiral (as seen) from the OUTSIDE in: a0 is the start angle, `turns`
  // how far round it winds, the radii shrinking from (rx0, ry0) to (rx1, ry1).
  function spiralPts(cx, cy, rx0, ry0, rx1, ry1, turns, n, a0) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = a0 + t * turns * Math.PI * 2;
      out.push([r3(cx + Math.cos(a) * (rx0 + (rx1 - rx0) * t)), r3(cy + Math.sin(a) * (ry0 + (ry1 - ry0) * t))]);
    }
    return out;
  }
  // An ARC of an ellipse (as seen), from angle a0 to a1 in degrees (0 points
  // right, 90 down the screen): a hedge ring with a gap is an arc.
  function arcPts(cx, cy, rx, ry, a0, a1, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
      out.push([r3(cx + Math.cos(a) * rx), r3(cy + Math.sin(a) * ry)]);
    }
    return out;
  }
  // A SPOKE: a straight line out from (cx, cy) at angle a (degrees, as
  // arcPts), from radius r0 to r1 — a hedge across a maze's corridor.
  function spokePts(cx, cy, r0, r1, a) {
    const t = (a * Math.PI) / 180;
    return [[r3(cx + Math.cos(t) * r0), r3(cy + Math.sin(t) * r0)], [r3(cx + Math.cos(t) * r1), r3(cy + Math.sin(t) * r1)]];
  }
  // The tier sizes every place shares (the derived ladder: tier L+2 is always
  // too big at level L — the tier law, tested).
  const T1 = [3.1, 3.6], T2 = [4.8, 5.4], T3 = [7.0, 7.8], T4 = [10.0, 11.0], T5 = [14.0, 15.0];
  // a GIANT place's sixth size (§17): only a place with six tiers uses it,
  // and its finale is bigger still
  const T6 = [19.5, 21.0];

  // A place: 5 tiers (tiny → huge) — 6 in a GIANT place (§17: its sixth tier
  // is T6 and its finale bigger still) — plus one FINALE, and — phase 4
  // (§14) — its own SHAPE and CHALLENGE. Everything below is optional but
  // `tiers` and `finale`:
  //   world: [W, H] in world units (default RULES.WORLD); start: [x, y].
  //   land: the island's shapes (default: the whole world, round corners);
  //   a void inside one is that shape's own `not` (the crescent bay).
  //   A SHAPE is {rect: [x0, y0, x1, y1], round}, {circle: [x, y, r]} (r a
  //   fraction of the width, a circle on the ground), {oval: [x, y, rx, ry]}
  //   (as seen), {ring: [x, y, r0, r1]}, {path: [[x, y]…], w} or {poly:
  //   [[x, y]…]}, each with an optional {not: shape} cut out of it. A path's w
  //   and a rect's round are world units on the ground.
  //   blocks: shapes he walks ROUND, each with a look — lying in the ground
  //          (water, lava, quicksand, tar, crater, choc) or standing up out
  //          of it (hedge, fence, shelf, wall, rock, counter, crates, coral,
  //          logs). The looks are hole-render.js's BLOCK_LOOKS.
  //   bridges: [{path, w, look}] over water, lava or the void (planks, rope,
  //          stones, sandbar, rainbow, stone).
  //   tracks: {id: {pts | orbit: [x, y, r], loop, speed, look, train}} —
  //          lines things RIDE (an item with {ride: id}).
  //   flows: [{pts, w, v, look}] — a river, a belt, a walkway, a sea current,
  //          a ski slope or a chocolate river that carries him; or {spin: [x,
  //          y, r], v, look} — a TURNTABLE that carries him round (§17).
  //   portals: [{a: [x, y], b: [x, y], look}] — step on one end, out of the
  //          other; {oneway: true, fly: true} — a CANNON that flies him over
  //          walls and water to its far end (§17; never one that strands him).
  //   count: {e, by, say} — COUNT MODE (§17): each gulp of e says the next
  //          number, by 1s, 2s, 5s or 10s ("Let's count the socks!").
  //   slide: true | [zone…] — ice: he slides.   dark: true — a cave, lit round him.
  //   items: [emoji, count, zone?, clump?] — or [emoji, count, {options}]:
  //          zone, clump, ride, at (a formation: line/grid/ring/arc/tri/pts),
  //          solid (a wall while too big), lock / key, pop / shake
  //          ([[emoji, n, tier]…] — surprises inside), chain (a toppling
  //          line), glow (it glows in the dark); and (§17) press (a floor
  //          BUTTON that opens its lock — never food), bounce (a bumper: too
  //          big, it knocks him back), hits (a piñata that takes that many
  //          bumps, dropping its shake surprises), run (it rolls away from
  //          him), power ("magnet" or "zoom"), sprout ([[emoji, n, tier]…] —
  //          a seedling that grows them as he comes near).
  //   zones: named lists of rects [x0, y0, x1, y1], shapes, or {band: [f0, f1]}
  //          (a stretch of the WAY from the start: 0 at the start, 1 at the end).
  //   private: zones that hold ONLY their own things. (Ground nothing may
  //          stand on — lava, the sea, a pond — is a BLOCK: it is not ground.)
  //   trails: lines of one tier-1 bite leading out from the start.
  //   decals: the ground's features (drawn only; nothing stands "on" them).
  //   finale: { e, r, at, say } — the biggest thing, on its stage at `at`;
  //          `say` is its spoken name ("the castle").
  //   tune: the notes of its opening tune (Hz).   notes: gulps play a scale.
  //   wear: [kind, colour, colour2?] — what Gobble wears there (§15.2): a hat
  //          on his head (the crown takes its place once he is big enough for
  //          the finale) or a thing at his side. The kinds are hole-render.js's
  //          WEAR (a test keeps the two in step, both ways).
  //   air: [kind, colour?] — its weather (§15.4): snow, embers, petals,
  //          bubbles… — hole-render.js's AIR, kept in step the same way.
  // The first `starters` tier-1 bites are placed right beside Gobble so the
  // first gulp is instant. The ORDER of the places is the order ▶ walks them
  // in after a win (the last wraps round to the first).
  const SCENES = [
    {
      // THE TWIST: a toy train goes round and round the rug — chase it, and
      // gobble its carriages from the back once Gobble is big enough — and a
      // big RECORD on the record player by the door spins him round and round.
      id: "toyroom", name: "Toy Room", door: "🧸", color: "#ffb86b",
      ground: "wood", hole: "gobble",
      wear: ["propeller", "#ff5e7e"], air: ["motes"],
      backdrop: ["#fff1dc", "#f6d9b0"],
      start: [0.5, 0.92], starters: 3,
      tune: [523.25, 659.25, 783.99, 1046.5],
      flows: [{ spin: [0.5, 0.78, 0.08], v: 24, look: "record" }],
      tracks: { train: { pts: ovalPts(0.5, 0.52, 0.34, 0.13, 36), loop: true, speed: 11, look: "rails", train: true } },
      zones: {
        rug: [{ oval: [0.5, 0.52, 0.2, 0.075] }],
        blocks: [[0.05, 0.71, 0.36, 0.86]],
        art: [[0.64, 0.71, 0.95, 0.86]],
        music: [[0.05, 0.2, 0.36, 0.34]],
        bed: [[0.64, 0.2, 0.95, 0.34]],
      },
      trails: [{ e: "🍬", to: [0.2, 0.78] }, { e: "🍬", to: [0.8, 0.78] }],
      decals: [
        { k: "rug", x: 0.5, y: 0.52, r: 0.22, pal: 0 },
        { k: "rug", x: 0.5, y: 0.14, r: 0.16, pal: 1 },
        { k: "mat", x0: 0.04, y0: 0.7, x1: 0.37, y1: 0.87 },
        { k: "splat", x: 0.72, y: 0.74, r: 0.05, c: "#ff6b6b" },
        { k: "splat", x: 0.87, y: 0.82, r: 0.045, c: "#58c7ff" },
        { k: "splat", x: 0.7, y: 0.84, r: 0.04, c: "#ffd93d" },
        { k: "splat", x: 0.88, y: 0.72, r: 0.035, c: "#7be08a" },
        { k: "stripes", x0: 0.04, y0: 0.19, x1: 0.37, y1: 0.35 },
        { k: "rug", x: 0.79, y: 0.27, r: 0.13, pal: 2 },
      ],
      tiers: [
        { r: T1, items: [["🍬", 56], ["🎲", 24, "blocks", 3], ["🧩", 24, "blocks", 3], ["🖍️", 20, "art", 2], ["🪀", 16], ["🎀", 20, null, 2]] },
        { r: T2, items: [["⚽", 14], ["🏀", 10], ["🪆", 16, "bed", 2], ["📚", 16, "music", 2], ["🚗", 14, "rug", 2], ["🎈", 12], ["🪁", 8], ["🎨", 12, "art"], ["🚃", 5, { ride: "train" }]] },
        { r: T3, items: [["🤖", 10, "rug"], ["🥁", 10, "music"], ["🎸", 10, "music"], ["🛴", 10], ["🎁", 12], ["🚂", 1, { ride: "train" }]] },
        { r: T4, items: [["🪑", 12], ["🧺", 10], ["🚲", 8], ["🛋️", 8]] },
        { r: T5, items: [["🛏️", 8], ["📺", 8]] },
      ],
      finale: { e: "🧸", r: 20, at: [0.5, 0.15], say: "the giant teddy" },
    },
    {
      // A ROUND park with a pond in the middle (stepping stones across it), and
      // THE TWIST: the big trees are full of fruit — bump one and it rains
      // apples and cherries.
      id: "picnic", name: "Picnic Park", door: "🧺", color: "#8fd16a",
      ground: "grass", hole: "gobble",
      wear: ["flower", "#ffffff"], air: ["petals", "#ffc2d9"],
      backdrop: ["#dff4ff", "#bfe6ff"],
      start: [0.5, 0.92], starters: 3,
      tune: [587.33, 739.99, 880, 739.99, 987.77],
      land: [{ oval: [0.5, 0.5, 0.49, 0.49] }],
      blocks: [{ oval: [0.5, 0.5, 0.2, 0.09], look: "water" }],
      bridges: [{ path: [[0.5, 0.385], [0.5, 0.615]], w: 20, look: "stones" }],
      zones: {
        blanket: [[0.13, 0.63, 0.34, 0.72], [0.66, 0.66, 0.87, 0.75], [0.14, 0.27, 0.35, 0.35]],
        flowers: [{ circle: [0.28, 0.84, 0.1] }, { circle: [0.72, 0.3, 0.09] }, { circle: [0.74, 0.84, 0.085] }],
        woods: [{ oval: [0.17, 0.47, 0.11, 0.12] }, { oval: [0.84, 0.48, 0.1, 0.12] }],
      },
      trails: [{ e: "🌼", to: [0.22, 0.7] }, { e: "🌼", to: [0.78, 0.74] }],
      decals: [
        { k: "shade", x: 0.17, y: 0.47, r: 0.15 },
        { k: "shade", x: 0.84, y: 0.48, r: 0.13 },
        { k: "path", w: 10, pts: [[0.5, 1.02], [0.5, 0.84], [0.42, 0.7], [0.5, 0.6]] },
        { k: "path", w: 8, pts: [[0.5, 0.4], [0.58, 0.3], [0.5, 0.2]] },
        { k: "blanket", x0: 0.12, y0: 0.62, x1: 0.35, y1: 0.73, c: "#ef4b5c" },
        { k: "blanket", x0: 0.65, y0: 0.65, x1: 0.88, y1: 0.76, c: "#4b8def" },
        { k: "blanket", x0: 0.13, y0: 0.26, x1: 0.36, y1: 0.36, c: "#f2a93b" },
        { k: "flowers", x: 0.28, y: 0.84, r: 0.11 },
        { k: "flowers", x: 0.72, y: 0.3, r: 0.1 },
        { k: "flowers", x: 0.74, y: 0.84, r: 0.095 },
      ],
      tiers: [
        { r: T1, items: [["🍓", 30, "blanket", 3], ["🍒", 16, null, 2], ["🍇", 12, "blanket", 2], ["🌸", 30, "flowers", 3], ["🍄", 21, "woods", 3], ["🌼", 50]] },
        { r: T2, items: [["🧁", 12, "blanket"], ["🍩", 12, "blanket"], ["🥪", 12, "blanket"], ["🍐", 12, null, 2], ["🍌", 12], ["🍪", 12], ["🧃", 12], ["⚽", 3, { run: true }]] },
        { r: T3, items: [["🍉", 14], ["🍍", 14], ["🥧", 12, "blanket"], ["🌻", 21, "flowers", 3]] },
        { r: T4, items: [["⛺", 10], ["🌲", 14, "woods"], ["🪴", 8], ["🧺", 6]] },
        { r: T5, items: [["🌳", 10, { shake: [["🍎", 2, 2], ["🍒", 2, 1]] }], ["🚐", 5]] },
      ],
      finale: { e: "🎡", r: 20, at: [0.5, 0.13], say: "the big wheel" },
    },
    {
      // Paddocks of FENCES, and THE TWIST: the giant pumpkin's patch is shut
      // by a locked gate — find the glowing key to open it.
      id: "farm", name: "Sunny Farm", door: "🚜", color: "#ffd166",
      ground: "farm", hole: "gobble",
      wear: ["straw", "#e63946"], air: ["fluff"],
      backdrop: ["#e8f7ff", "#c6e9ff"],
      start: [0.5, 0.92], starters: 3,
      tune: [392, 493.88, 587.33, 783.99],
      blocks: [
        // the long fence across the farm, with two gaps
        { path: [[-0.02, 0.48], [0.2, 0.48]], w: 3.5, look: "fence" },
        { path: [[0.29, 0.48], [0.71, 0.48]], w: 3.5, look: "fence" },
        { path: [[0.8, 0.48], [1.02, 0.48]], w: 3.5, look: "fence" },
        // the pumpkin patch, shut but for its gate. The gap must be narrower
        // than the locked log's core (only Gobble's CENTRE meets a wall): at
        // 0.476-0.524 it was 16.7 units of ground against a 13.4 core, and he
        // could walk past the gate without the key (a test now seals every gate)
        { path: [[0.484, 0.3], [0.3, 0.3], [0.3, -0.02]], w: 3.5, look: "fence" },
        { path: [[0.516, 0.3], [0.7, 0.3], [0.7, -0.02]], w: 3.5, look: "fence" },
        // a little paddock round the barn
        { path: [[0.62, 0.98], [0.62, 0.74], [0.8, 0.74]], w: 3.5, look: "fence" },
      ],
      zones: {
        field: [[0.04, 0.06, 0.27, 0.43], [0.73, 0.06, 0.96, 0.43]],
        patch: [[0.33, 0.04, 0.67, 0.27]],
        veg: [[0.06, 0.54, 0.36, 0.7]],
        orchard: [[0.4, 0.54, 0.94, 0.68]],
        barn: [[0.66, 0.78, 0.95, 0.95]],
      },
      trails: [{ e: "🥕", to: [0.22, 0.66] }, { e: "🥕", to: [0.5, 0.6] }],
      decals: [
        { k: "patch", x: 0.5, y: 0.15, r: 0.15, c: "#c79a5b" },
        { k: "crops", x0: 0.03, y0: 0.05, x1: 0.28, y1: 0.44, c: "#e9c46a" },
        { k: "crops", x0: 0.72, y0: 0.05, x1: 0.97, y1: 0.44, c: "#7cc95a" },
        { k: "soil", x0: 0.05, y0: 0.53, x1: 0.37, y1: 0.71 },
        { k: "shade", x: 0.68, y: 0.61, r: 0.16 },
        { k: "patch", x: 0.81, y: 0.87, r: 0.13, c: "#d6b07a" },
        { k: "tracks", pts: [[0.5, 1.02], [0.47, 0.76], [0.5, 0.6], [0.5, 0.33]] },
        { k: "pond", x: 0.16, y: 0.86, r: 0.06 },
      ],
      tiers: [
        { r: T1, items: [["🥕", 56], ["🌽", 24, "field", 3], ["🍅", 20, "veg", 4], ["🥔", 20, "veg", 4], ["🥚", 18, "barn", 3], ["🫑", 16, null, 2], ["🌱", 8, { sprout: [["🥕", 3, 1]], zone: "veg" }], ["🗝️", 1, { key: "gate", zone: "barn", glow: true }]] },
        { r: T2, items: [["🍎", 20, "orchard", 2], ["🥦", 14, "veg", 2], ["🥬", 14, "patch", 2], ["🍐", 12, "orchard", 2], ["🌻", 16, "field", 4], ["🪣", 10], ["🥛", 10, "barn"]] },
        { r: T3, items: [["🍉", 12], ["🌾", 18, "field", 2], ["🧺", 10], ["🍯", 8, "barn"], ["🪵", 10, null, 2], ["🪵", 1, { at: { pts: [[0.5, 0.3]] }, lock: "gate" }]] },
        { r: T4, items: [["🚜", 10], ["🌳", 10, "orchard"], ["🛻", 8], ["🛖", 6]] },
        { r: T5, items: [["🏡", 8], ["🚛", 8]] },
      ],
      finale: { e: "🎃", r: 20, at: [0.5, 0.13], say: "the giant pumpkin" },
    },
    {
      // An L-shaped site in three yards, and THE TWIST: walls of barrels and
      // lorries block the way between them — grow big enough to eat through.
      id: "build", name: "Building Site", door: "🚧", color: "#ffc93c",
      ground: "dirt", hole: "gobble",
      wear: ["hardhat", "#ffc93c"], air: ["dust"],
      backdrop: ["#e9f4ff", "#cfe3f7"],
      start: [0.8, 0.9], starters: 3,
      tune: [329.63, 392, 329.63, 523.25],
      land: [{ rect: [0, 0.55, 1, 1], round: 12 }, { rect: [0, 0, 0.5, 0.66], round: 12 }],
      blocks: [
        { rect: [0.49, 0.53, 0.51, 0.765], look: "wall" },
        { rect: [0.49, 0.795, 0.51, 1.02], look: "wall" },
        { rect: [-0.02, 0.6, 0.2, 0.62], look: "wall" },
        { rect: [0.3, 0.6, 0.52, 0.62], look: "wall" },
      ],
      zones: {
        a: [[0.53, 0.58, 0.98, 0.98]],
        b: [[0.02, 0.64, 0.47, 0.98]],
        c: [[0.02, 0.02, 0.48, 0.58]],
        gravel: [[0.6, 0.62, 0.78, 0.72]],
        bricks: [[0.06, 0.68, 0.3, 0.84]],
        lot: [[0.06, 0.3, 0.44, 0.5]],
      },
      trails: [{ e: "🔩", to: [0.6, 0.75] }, { e: "🔩", to: [0.9, 0.66] }],
      decals: [
        { k: "tracks", pts: [[1.02, 0.86], [0.7, 0.8], [0.55, 0.78], [0.3, 0.86], [0.05, 0.8]] },
        { k: "tracks", pts: [[0.25, 0.98], [0.25, 0.62], [0.2, 0.3], [0.26, 0.05]] },
        { k: "gravel", x: 0.69, y: 0.67, r: 0.09 },
        { k: "pallet", x0: 0.05, y0: 0.67, x1: 0.31, y1: 0.85 },
        { k: "slab", x0: 0.05, y0: 0.29, x1: 0.45, y1: 0.51 },
        { k: "puddle", x: 0.9, y: 0.92, r: 0.04 },
        { k: "puddle", x: 0.38, y: 0.9, r: 0.05 },
        { k: "puddle", x: 0.12, y: 0.12, r: 0.035 },
      ],
      tiers: [
        { r: T1, items: [["🔩", 44], ["🪨", 24, "gravel", 4], ["🧱", 24, "bricks", 4], ["🔨", 10, "a"], ["🔧", 10, "b"], ["🪛", 12, "a"]] },
        { r: T2, items: [["⛑️", 14, "a"], ["🪣", 14, "a"], ["🧰", 12, "b"], ["🚧", 18, "b", 3], ["🪜", 10, "c"], ["🦺", 14, "a"]] },
        { r: T3, items: [["🛢️", 2, { at: { line: [[0.5, 0.772], [0.5, 0.788]] }, solid: true }], ["🛢️", 16, "b", 2], ["🪵", 18, "b", 2], ["🚦", 10, "c"], ["🧯", 14, "c"]] },
        { r: T4, items: [["🚚", 3, { at: { line: [[0.217, 0.61], [0.283, 0.61]] }, solid: true }], ["🚜", 10, "lot"], ["🛻", 10, "lot"], ["🚚", 10, "c"]] },
        { r: T5, items: [["🚛", 8, "c"], ["🏗️", 8, "c"]] },
      ],
      finale: { e: "🏢", r: 20, at: [0.25, 0.12], say: "the tower" },
    },
    {
      // A PLUS-shaped town, and THE TWIST: cars and buses drive up and down
      // its streets — eat them as they come past.
      id: "town", name: "Busy Town", door: "🚦", color: "#5ec8ff",
      ground: "town", hole: "gobble",
      wear: ["cap", "#e63946"], air: ["leaves", "#f2a03d"],
      backdrop: ["#e3f6ff", "#bde7ff"],
      start: [0.37, 0.93], starters: 3,
      tune: [523.25, 523.25, 783.99, 659.25],
      land: [{ rect: [0.28, 0, 0.72, 1], round: 12 }, { rect: [0, 0.33, 1, 0.67], round: 12 }],
      tracks: {
        south: { pts: [[0.5, 0.62], [0.5, 0.82]], speed: 13, look: "none" },
        north: { pts: [[0.5, 0.38], [0.5, 0.2]], speed: 12, look: "none" },
        west: { pts: [[0.36, 0.5], [0.03, 0.5]], speed: 11, look: "none" },
        east: { pts: [[0.64, 0.5], [0.97, 0.5]], speed: 11, look: "none" },
        ring: { pts: [[0.36, 0.42], [0.64, 0.42], [0.64, 0.58], [0.36, 0.58]], loop: true, speed: 10, look: "road" },
      },
      zones: {
        se: [[0.73, 0.55, 0.98, 0.65], [0.55, 0.67, 0.7, 0.98]],
        beds: [[0.3, 0.17, 0.44, 0.32], [0.56, 0.17, 0.7, 0.32]],
      },
      // the south street's cars turn back above the bottom, so the second
      // trail crosses the road where nothing drives
      trails: [{ e: "🪙", to: [0.37, 0.75] }, { e: "🪙", to: [0.65, 0.84] }],
      decals: [
        { k: "road", x0: 0.455, y0: 0, x1: 0.545, y1: 1 },
        { k: "road", x0: 0, y0: 0.47, x1: 1, y1: 0.53 },
        { k: "zebra", x0: 0.455, y0: 0.62, x1: 0.545, y1: 0.66 },
        { k: "zebra", x0: 0.2, y0: 0.47, x1: 0.25, y1: 0.53 },
        { k: "zebra", x0: 0.75, y0: 0.47, x1: 0.8, y1: 0.53 },
        { k: "park", x: 0.5, y: 0.5, r: 0.06 },
        { k: "yard", x0: 0.32, y0: 0.02, x1: 0.68, y1: 0.16 },
        { k: "lot", x0: 0.56, y0: 0.8, x1: 0.7, y1: 0.97 },
        { k: "hedge", x0: 0.3, y0: 0.3, x1: 0.44, y1: 0.315 },
        { k: "hedge", x0: 0.56, y0: 0.3, x1: 0.7, y1: 0.315 },
      ],
      tiers: [
        { r: T1, items: [["🪙", 52], ["🌷", 24, "beds", 4], ["🍦", 18], ["🔑", 14], ["🥤", 18, null, 2], ["🧃", 18, null, 2]] },
        { r: T2, items: [["🚦", 12], ["🛑", 12], ["🗑️", 16, null, 2], ["📮", 14], ["🛵", 14], ["🚲", 14]] },
        { r: T3, items: [["🚕", 1, { ride: "south" }], ["🚓", 1, { ride: "south" }], ["🚕", 1, { ride: "north" }], ["🚗", 4, { ride: "ring" }], ["🚙", 2, { ride: "ring" }], ["🚗", 10], ["🚕", 8], ["🏍️", 10]] },
        { r: T4, items: [["🚌", 1, { ride: "west" }], ["🚌", 1, { ride: "east" }], ["🚒", 6], ["🚑", 6], ["🚐", 8, "se"], ["🌳", 8]] },
        { r: T5, items: [["🏠", 10], ["🏪", 6]] },
      ],
      finale: { e: "🏫", r: 20, at: [0.5, 0.09], say: "the school" },
    },
    {
      // A STADIUM (two long sides and round ends), and THE TWIST: things in
      // rows and triangles that topple — eat one bowling pin and the whole
      // triangle rolls in after it; balls roll round the running track.
      id: "sports", name: "Sports Day", door: "⚽", color: "#4cc76a",
      ground: "pitch", hole: "gobble",
      wear: ["cap", "#2f6fdb"], air: ["confetti"],
      backdrop: ["#e6f6ff", "#c3e4ff"],
      start: [0.5, 0.92], starters: 3,
      tune: [392, 523.25, 659.25, 783.99, 659.25, 783.99],
      land: [{ path: [[0.5, 0.26], [0.5, 0.74]], w: 390 }],
      tracks: { lane: { pts: capsulePts(0.5, 0.3, 0.7, 0.42, 0.215, 14), loop: true, speed: 15, look: "lane", w: 12 } },
      zones: {
        court: [[0.14, 0.66, 0.4, 0.78]],
        podium: [[0.62, 0.68, 0.86, 0.78]],
        top: [[0.2, 0.18, 0.8, 0.34]],
      },
      trails: [{ e: "🎾", to: [0.3, 0.8] }, { e: "🎾", to: [0.7, 0.8] }],
      decals: [
        { k: "pitch", x0: 0.22, y0: 0.4, x1: 0.78, y1: 0.64 },
        { k: "court", x0: 0.13, y0: 0.65, x1: 0.41, y1: 0.79, c: "#4f8de8" },
        { k: "podium", x0: 0.62, y0: 0.7, x1: 0.86, y1: 0.8 },
        { k: "court", x0: 0.22, y0: 0.2, x1: 0.46, y1: 0.33, c: "#e8874f" },
        { k: "court", x0: 0.54, y0: 0.2, x1: 0.78, y1: 0.33, c: "#7b6be8" },
      ],
      tiers: [
        { r: T1, items: [["🎾", 48], ["⚾", 21, null, 3], ["🥇", 15, "podium", 3], ["🏸", 14, "court", 2], ["🏓", 14, "top", 2], ["🥤", 24, null, 4], ["⚡", 4, { power: "zoom" }], ["⚽", 8, { at: { line: [[0.3, 0.52], [0.7, 0.52]] }, chain: true }]] },
        { r: T2, items: [["🏐", 3, { ride: "lane" }], ["🏀", 14, "court"], ["🏈", 12], ["🥏", 12], ["🧢", 14, null, 2], ["👟", 12, null, 2], ["🎳", 10, { at: { tri: [0.5, 0.86, 7.5] }, chain: true }], ["🥅", 2, { at: { pts: [[0.25, 0.52], [0.75, 0.52]] } }]] },
        { r: T3, items: [["🛹", 12], ["🛼", 10], ["🏆", 4, { at: { line: [[0.64, 0.74], [0.84, 0.74]] } }], ["🏆", 6], ["🏏", 8], ["🏒", 8], ["🎯", 8, "top"]] },
        { r: T4, items: [["🚲", 12], ["🛴", 10], ["⛳", 8], ["🏁", 6]] },
        { r: T5, items: [["🚌", 8], ["🎪", 8]] },
      ],
      finale: { e: "🏟️", r: 20, at: [0.5, 0.11], say: "the stadium" },
    },
    {
      // A HEART, and THE TWIST: presents POP — eat one and out spill sweets —
      // and the PIÑATAS take three good bumps before they burst into treats.
      id: "party", name: "Party Time", door: "🎂", color: "#ff7ac0",
      ground: "party", hole: "gobble",
      wear: ["party", "#ff5e7e"], air: ["confetti"],
      backdrop: ["#fff0f7", "#ffd6ea"],
      start: [0.5, 0.8], starters: 3,
      tune: [523.25, 523.25, 587.33, 523.25, 698.46, 659.25],
      // two ROUND lobes (ovals as seen, so they look round on screen, set far
      // enough apart to leave a real dip between them) and a point, its sides
      // running from the bottom tip to touch each lobe
      land: [
        { oval: [0.29, 0.3, 0.25, 0.18] },
        { oval: [0.71, 0.3, 0.25, 0.18] },
        { poly: [[0.0675, 0.381], [0.5, 0.25], [0.9325, 0.381], [0.5, 0.985]] },
      ],
      zones: {
        table: [[0.1, 0.22, 0.4, 0.36], [0.6, 0.22, 0.9, 0.36]],
        gifts: [[0.2, 0.45, 0.38, 0.56], [0.62, 0.45, 0.8, 0.56]],
        dance: [[0.38, 0.62, 0.62, 0.74]],
      },
      trails: [{ e: "🍬", to: [0.3, 0.6] }, { e: "🍬", to: [0.7, 0.6] }],
      decals: [
        { k: "rug", x: 0.5, y: 0.34, r: 0.13, pal: 3 },
        { k: "heart", x: 0.3, y: 0.52, r: 0.1 },
        { k: "heart", x: 0.7, y: 0.52, r: 0.1 },
        { k: "cloth", x0: 0.09, y0: 0.21, x1: 0.41, y1: 0.37 },
        { k: "cloth", x0: 0.59, y0: 0.21, x1: 0.91, y1: 0.37 },
        { k: "dance", x0: 0.37, y0: 0.61, x1: 0.63, y1: 0.75 },
      ],
      tiers: [
        { r: T1, items: [["🍬", 44], ["🍭", 12], ["🍫", 20, "table", 2], ["💝", 10], ["🍓", 21, "table", 3], ["🎀", 22, null, 2]] },
        { r: T2, items: [["🧁", 14, "table", 2], ["🍩", 12, "table"], ["🍪", 12, "table"], ["🎈", 21, null, 3], ["🎉", 12, "dance"], ["🎊", 10, "dance"]] },
        { r: T3, items: [["🎁", 14, { zone: "gifts", pop: [["🍬", 3, 1], ["🧁", 1, 2]] }], ["🍰", 12, "table"], ["🍕", 12], ["🍿", 10], ["🧸", 10]] },
        { r: T4, items: [["🪅", 9, { shake: [["🍬", 4, 1], ["🍫", 2, 1], ["🧁", 1, 2]], hits: 3 }], ["🪑", 12], ["🪆", 9]] },
        { r: T5, items: [["🎪", 7], ["🎠", 7]] },
      ],
      finale: { e: "🎂", r: 20, at: [0.5, 0.33], say: "the giant cake" },
    },
    {
      // A string of ISLANDS on the sea, joined by sandbars, and THE TWIST:
      // boats sail round between them — wait on the beach and gobble them.
      id: "beach", name: "Beach Day", door: "🏖️", color: "#ffd27a",
      ground: "sand", hole: "gobble",
      wear: ["straw", "#2fa3d9"], air: ["sparkles", "#fff6c8"],
      backdrop: ["#7fd0f2", "#3fa8e0"],
      start: [0.5, 0.89], starters: 3,
      tune: [659.25, 783.99, 880, 783.99, 659.25],
      land: [
        { oval: [0.5, 0.86, 0.3, 0.11] },
        { oval: [0.2, 0.55, 0.18, 0.12] },
        { oval: [0.8, 0.58, 0.18, 0.12] },
        { oval: [0.5, 0.2, 0.32, 0.15] },
      ],
      bridges: [
        { path: [[0.33, 0.8], [0.25, 0.65]], w: 24, look: "sandbar" },
        { path: [[0.67, 0.8], [0.74, 0.68]], w: 24, look: "sandbar" },
        { path: [[0.24, 0.45], [0.33, 0.31]], w: 24, look: "sandbar" },
        { path: [[0.76, 0.48], [0.67, 0.31]], w: 24, look: "sandbar" },
      ],
      tracks: {
        bay: { pts: ovalPts(0.5, 0.55, 0.1, 0.11, 24), loop: true, speed: 9, look: "none" },
        cove: { pts: ovalPts(0.5, 0.2, 0.42, 0.21, 32, Math.PI * 0.25), loop: true, speed: 8, look: "none" },
      },
      zones: {
        towel: [[0.4, 0.8, 0.6, 0.9], [0.12, 0.5, 0.28, 0.6], [0.72, 0.53, 0.88, 0.63]],
      },
      trails: [{ e: "🍦", to: [0.35, 0.82] }, { e: "🍦", to: [0.65, 0.82] }],
      decals: [
        { k: "towel", x0: 0.39, y0: 0.79, x1: 0.61, y1: 0.91, c: "#ff6b6b" },
        { k: "towel", x0: 0.11, y0: 0.49, x1: 0.29, y1: 0.61, c: "#58c7ff" },
        { k: "towel", x0: 0.71, y0: 0.52, x1: 0.89, y1: 0.64, c: "#ffd24d" },
        { k: "rockpool", x: 0.68, y: 0.85, r: 0.05 },
        { k: "rockpool", x: 0.17, y: 0.6, r: 0.04 },
        { k: "footprints", pts: [[0.5, 0.96], [0.42, 0.86], [0.34, 0.8]] },
      ],
      tiers: [
        { r: T1, items: [["🍦", 44], ["⭐", 21, null, 3], ["💎", 15, null, 3], ["🪨", 20, null, 4], ["🧃", 14, null, 2], ["🪙", 15, null, 3]] },
        { r: T2, items: [["🩴", 14, "towel", 2], ["🕶️", 10, "towel"], ["🧴", 10, "towel"], ["🏐", 12], ["🪣", 14], ["🥥", 14, null, 2], ["👑", 10]] },
        { r: T3, items: [["🚤", 3, { ride: "bay" }], ["⛱️", 12], ["🪁", 10], ["🍉", 12], ["🧺", 10], ["🗺️", 8]] },
        { r: T4, items: [["⛵", 3, { ride: "cove" }], ["🌴", 18], ["🛶", 8]] },
        { r: T5, items: [["🛥️", 6], ["⛴️", 5]] },
      ],
      finale: { e: "🚢", r: 20, at: [0.5, 0.17], say: "the ship" },
    },
    {
      // An island cut by RIVERS OF LAVA, and THE TWIST: the only ways over
      // are plank bridges with big stone heads standing on them — grow big
      // enough to eat through — and the volcano sits in a ring of lava that
      // only the far-side bridges cross. And CANNONS: two blast Gobble from
      // the beach over the lava to the far sides, and one blasts him home.
      id: "volcano", name: "Volcano Island", door: "🌋", color: "#ff8a4c",
      ground: "jungle", hole: "gobble",
      wear: ["hardhat", "#e63946"], air: ["embers"],
      backdrop: ["#d9f3ff", "#8fd3ee"],
      start: [0.5, 0.9], starters: 3,
      tune: [392, 466.16, 523.25, 622.25, 698.46],
      land: [{ oval: [0.5, 0.53, 0.48, 0.46] }],
      blocks: [
        { ring: [0.5, 0.17, 0.115, 0.165], look: "lava" },
        { path: [[0.41, 0.23], [0.3, 0.4], [0.13, 0.6], [-0.08, 0.72]], w: 14, look: "lava" },
        { path: [[0.59, 0.23], [0.7, 0.4], [0.87, 0.6], [1.08, 0.72]], w: 14, look: "lava" },
      ],
      bridges: [
        { path: [[0.176, 0.491], [0.254, 0.509]], w: 16, look: "planks" },
        { path: [[0.824, 0.491], [0.746, 0.509]], w: 16, look: "planks" },
        { path: [[0.305, 0.17], [0.405, 0.17]], w: 16, look: "planks" },
        { path: [[0.695, 0.17], [0.595, 0.17]], w: 16, look: "planks" },
      ],
      portals: [
        { a: [0.3, 0.62], b: [0.2, 0.3], oneway: true, fly: true },
        { a: [0.7, 0.62], b: [0.8, 0.3], oneway: true, fly: true },
        { a: [0.75, 0.25], b: [0.5, 0.75], oneway: true, fly: true },
      ],
      zones: {
        crater: [{ circle: [0.5, 0.17, 0.1] }],
        wedge: [{ poly: [[0.05, 0.6], [0.3, 0.36], [0.38, 0.22], [0.33, 0.08], [0.2, 0.08], [0.04, 0.4]] },
          { poly: [[0.95, 0.6], [0.7, 0.36], [0.62, 0.22], [0.67, 0.08], [0.8, 0.08], [0.96, 0.4]] }],
        village: [[0.6, 0.72, 0.88, 0.88]],
        lagoon: [[0.12, 0.72, 0.38, 0.88]],
        flowers: [[0.36, 0.52, 0.64, 0.66]],
      },
      trails: [{ e: "🍌", to: [0.27, 0.74] }, { e: "🍌", to: [0.73, 0.74] }],
      decals: [
        { k: "patch", x: 0.5, y: 0.17, r: 0.1, c: "#6b5446" },
        { k: "shade", x: 0.2, y: 0.3, r: 0.13 },
        { k: "shade", x: 0.8, y: 0.3, r: 0.13 },
        { k: "pond", x: 0.24, y: 0.8, r: 0.09 },
        { k: "patch", x: 0.74, y: 0.8, r: 0.12, c: "#c9a46a" },
        { k: "stones", pts: [[0.5, 0.99], [0.5, 0.84], [0.45, 0.72], [0.5, 0.6]] },
        { k: "flowers", x: 0.5, y: 0.59, r: 0.1 },
      ],
      tiers: [
        { r: T1, items: [["🍌", 56], ["🥭", 16, null, 2], ["🫐", 18, null, 3], ["🌺", 24, "flowers", 4], ["🍄", 20, "wedge", 4], ["💎", 10, "crater"]] },
        { r: T2, items: [["🥥", 16, null, 2], ["🍍", 14], ["🥝", 12, null, 2], ["🌿", 16, "wedge", 4], ["🪨", 14, null, 2], ["🏺", 12, "village"], ["🔦", 10]] },
        { r: T3, items: [["🛶", 10, "lagoon"], ["🪵", 12, null, 2], ["🥁", 10, "village"], ["🎋", 12], ["⛺", 10], ["🗺️", 10]] },
        { r: T4, items: [["🗿", 2, { at: { pts: [[0.215, 0.5], [0.785, 0.5]] }, solid: true }], ["🌴", 16, "wedge"], ["🛖", 10, "village"], ["🗿", 6], ["⛵", 6, "lagoon"]] },
        { r: T5, items: [["🌳", 6], ["🗻", 6], ["⛰️", 6]] },
      ],
      finale: { e: "🌋", r: 20, at: [0.5, 0.17], say: "the volcano" },
    },
    {
      // A SNOWMAN of an island (a round tummy, a round head, coal eyes), and
      // THE TWIST: a frozen lake on its tummy — on the ice Gobble SLIDES.
      id: "snow", name: "Snow Day", door: "⛄", color: "#9fd7ff",
      ground: "snow", hole: "gobble",
      wear: ["bobble", "#e63946"], air: ["snow"],
      backdrop: ["#eef6ff", "#cfe0f5"],
      start: [0.5, 0.86], starters: 3,
      tune: [659.25, 587.33, 523.25, 587.33, 659.25, 659.25, 659.25],
      land: [{ circle: [0.5, 0.665, 0.46] }, { circle: [0.5, 0.285, 0.34] }],
      blocks: [
        { circle: [0.38, 0.25, 0.04], look: "rock" },
        { circle: [0.62, 0.25, 0.04], look: "rock" },
      ],
      slide: ["lake"],
      zones: {
        lake: [{ circle: [0.5, 0.68, 0.2] }],
        forest: [[0.2, 0.17, 0.33, 0.4], [0.67, 0.17, 0.8, 0.4]],
        village: [[0.08, 0.6, 0.28, 0.76]],
        sledge: [[0.72, 0.6, 0.92, 0.76]],
      },
      trails: [{ e: "❄️", to: [0.22, 0.8] }, { e: "❄️", to: [0.78, 0.8] }],
      decals: [
        { k: "ice", x: 0.5, y: 0.68, r: 0.2 },
        { k: "drift", x: 0.26, y: 0.33, r: 0.08 },
        { k: "drift", x: 0.74, y: 0.33, r: 0.08 },
        { k: "drift", x: 0.17, y: 0.83, r: 0.07 },
        { k: "drift", x: 0.83, y: 0.83, r: 0.07 },
        { k: "tracks", c: "rgba(110,140,190,0.45)", pts: [[0.3, 0.89], [0.2, 0.7], [0.32, 0.52], [0.44, 0.42]] },
        { k: "tracks", c: "rgba(110,140,190,0.45)", pts: [[0.7, 0.89], [0.8, 0.7], [0.68, 0.52], [0.56, 0.42]] },
      ],
      tiers: [
        { r: T1, items: [["❄️", 56], ["🍪", 18, null, 3], ["☕", 14, null, 2], ["🧦", 16, null, 2], ["🔔", 12], ["🧊", 20, "lake", 4], ["🍭", 14]] },
        { r: T2, items: [["🧤", 16, null, 2], ["🧣", 14], ["⛸️", 12, "lake"], ["🥌", 10, { run: true, zone: "lake" }], ["🏒", 8, "lake"], ["🎒", 12], ["🎁", 14]] },
        { r: T3, items: [["🛷", 12], ["🎿", 10, "sledge"], ["🎄", 12, "forest"], ["🪵", 10, null, 2], ["🧸", 10], ["🔦", 8]] },
        { r: T4, items: [["🌲", 16, "forest"], ["🛖", 8, "village"], ["🚡", 6], ["🚠", 6], ["🚙", 6]] },
        { r: T5, items: [["🏠", 8], ["🏡", 4], ["🚂", 4]] },
      ],
      finale: { e: "⛄", r: 20, at: [0.5, 0.16], say: "the giant snowman" },
    },
    {
      // A WIDE airport (wider than it is tall), and THE TWIST: little planes
      // taxi round the apron, and in the terminal moving walkways carry
      // Gobble along — let go and he rides.
      id: "airport", name: "Airport", door: "🛫", color: "#7aa7ff",
      ground: "tarmac", hole: "gobble",
      wear: ["cap", "#1d3557", "#ffd24d"], air: ["clouds"],
      backdrop: ["#e5f3ff", "#b9dcff"],
      world: [600, 440],
      start: [0.5, 0.8], starters: 3,
      tune: [523.25, 659.25, 783.99, 1046.5, 783.99],
      tracks: {
        taxi: { pts: [[0.08, 0.44], [0.92, 0.44], [0.92, 0.58], [0.08, 0.58]], loop: true, speed: 12, look: "taxi" },
      },
      flows: [
        { pts: [[0.06, 0.69], [0.94, 0.69]], w: 20, v: 26, look: "walkway" },
        { pts: [[0.94, 0.91], [0.06, 0.91]], w: 20, v: 26, look: "walkway" },
      ],
      zones: {
        runway: [[0.04, 0.07, 0.96, 0.19], [0.04, 0.27, 0.96, 0.37]],
        heli: [[0.11, 0.47, 0.3, 0.55]],
        apron: [[0.33, 0.47, 0.67, 0.55]],
        lot: [[0.7, 0.47, 0.89, 0.55]],
        terminal: [[0.04, 0.74, 0.4, 0.86], [0.6, 0.74, 0.96, 0.86]],
      },
      private: ["runway"],
      trails: [{ e: "🎫", to: [0.25, 0.8] }, { e: "🎫", to: [0.75, 0.8] }],
      decals: [
        { k: "runway", x0: 0.03, y0: 0.06, x1: 0.97, y1: 0.2 },
        { k: "runway", x0: 0.03, y0: 0.26, x1: 0.97, y1: 0.38 },
        { k: "helipad", x: 0.2, y: 0.51, r: 0.04 },
        { k: "lot", x0: 0.69, y0: 0.46, x1: 0.9, y1: 0.56 },
        { k: "terminal", x0: 0.03, y0: 0.73, x1: 0.97, y1: 0.87 },
      ],
      tiers: [
        { r: T1, items: [["🎫", 56], ["🥨", 18, null, 3], ["🧃", 16, null, 2], ["🪙", 18, null, 3], ["🍬", 16, null, 2], ["☕", 14], ["🍫", 18, null, 3]] },
        { r: T2, items: [["🧳", 20, "terminal", 2], ["🎒", 14, "terminal"], ["💺", 16, "terminal", 4], ["🕶️", 12], ["🧸", 12], ["🧯", 10], ["🦺", 10]] },
        { r: T3, items: [["🚗", 10, "lot"], ["🚕", 8, "lot"], ["🚙", 8], ["🛺", 8], ["🛻", 10], ["🚜", 8, "apron"]] },
        { r: T4, items: [["🛩️", 3, { ride: "taxi" }], ["🚁", 6, "heli"], ["🛩️", 6, "runway"], ["🚌", 8], ["🚒", 6], ["🚚", 8, "apron"]] },
        { r: T5, items: [["🛫", 6, "runway"], ["🛬", 6, "runway"], ["🚟", 4]] },
      ],
      finale: { e: "✈️", r: 20, at: [0.5, 0.13], say: "the jumbo jet" },
    },
    {
      // Little PLANETS floating in space, and THE TWIST: no bridges at all —
      // swirly wormholes jump Gobble from one planet to the next, and moons
      // and satellites go round and round.
      id: "space", name: "Outer Space", door: "🚀", color: "#8a7bff",
      ground: "space", hole: "blackhole",
      wear: ["bubble", "#c0c8d8"], air: ["stars"],
      backdrop: ["#0a0d26", "#151a45"],
      start: [0.5, 0.86], starters: 3,
      tune: [261.63, 392, 523.25, 783.99, 1046.5],
      land: [
        { circle: [0.5, 0.8, 0.28] },
        { circle: [0.22, 0.515, 0.21] },
        { circle: [0.78, 0.515, 0.21] },
        { circle: [0.24, 0.235, 0.2] },
        { circle: [0.76, 0.235, 0.2] },
        { circle: [0.5, 0.1, 0.14] },
      ],
      portals: [
        { a: [0.33, 0.73], b: [0.3, 0.58] },
        { a: [0.67, 0.73], b: [0.7, 0.58] },
        { a: [0.17, 0.44], b: [0.22, 0.3] },
        { a: [0.83, 0.44], b: [0.78, 0.3] },
        { a: [0.36, 0.2], b: [0.42, 0.12] },
        { a: [0.64, 0.2], b: [0.58, 0.12] },
      ],
      tracks: {
        moon: { orbit: [0.22, 0.515, 0.11], speed: 10, look: "orbit" },
        sat: { orbit: [0.78, 0.515, 0.11], speed: -11, look: "orbit" },
        ufo: { orbit: [0.5, 0.8, 0.17], speed: 9, look: "orbit" },
      },
      zones: {
        station: [{ circle: [0.76, 0.235, 0.12] }],
        rocks: [{ circle: [0.24, 0.235, 0.14] }],
      },
      trails: [{ e: "⭐", to: [0.36, 0.76] }, { e: "⭐", to: [0.64, 0.76] }],
      decals: [
        { k: "nebula", x: 0.25, y: 0.3, r: 0.35, c: "rgba(255,122,192,0.22)" },
        { k: "nebula", x: 0.78, y: 0.62, r: 0.4, c: "rgba(94,200,255,0.16)" },
        { k: "nebula", x: 0.45, y: 0.9, r: 0.32, c: "rgba(199,125,255,0.22)" },
        { k: "station", x0: 0.68, y0: 0.19, x1: 0.84, y1: 0.28 },
      ],
      tiers: [
        { r: T1, items: [["⭐", 56], ["💎", 27, null, 3], ["🪨", 20, "rocks", 4], ["🔋", 12], ["🌟", 28, null, 4]] },
        { r: T2, items: [["🌙", 2, { ride: "moon" }], ["🛰️", 3, { ride: "sat" }], ["☄️", 16], ["🔭", 10, "station"], ["🛰️", 10], ["📡", 10, "station"]] },
        { r: T3, items: [["🛸", 2, { ride: "ufo" }], ["🛸", 12], ["🚀", 16, null, 2], ["🤖", 10, "station"]] },
        { r: T4, items: [["🌕", 12], ["🌍", 10], ["🌎", 10]] },
        { r: T5, items: [["🪐", 20]] },
      ],
      finale: { e: "☀️", r: 20, at: [0.5, 0.1], say: "the Sun" },
    },
    {
      // AISLES of tall shelves, and THE TWIST: shopping trolleys trundle up
      // and down the aisles and along the tills — gobble the shopping, then
      // the trolleys, then the whole shop.
      id: "market", name: "Shopping Day", door: "🛒", color: "#4fd1c5",
      ground: "tiles", hole: "gobble",
      wear: ["chef", "#ffffff"], air: ["motes"],
      backdrop: ["#f4f7fb", "#dde6f0"],
      start: [0.5, 0.92], starters: 3,
      tune: [523.25, 587.33, 659.25, 523.25, 783.99],
      blocks: [
        { rect: [0.17, 0.3, 0.21, 0.66], round: 3, look: "shelf" },
        { rect: [0.38, 0.3, 0.42, 0.66], round: 3, look: "shelf" },
        { rect: [0.58, 0.3, 0.62, 0.66], round: 3, look: "shelf" },
        { rect: [0.79, 0.3, 0.83, 0.66], round: 3, look: "shelf" },
      ],
      tracks: {
        left: { pts: [[0.295, 0.33], [0.295, 0.64]], speed: 9, look: "none" },
        right: { pts: [[0.705, 0.64], [0.705, 0.33]], speed: 9, look: "none" },
        tills: { pts: [[0.08, 0.76], [0.92, 0.76]], speed: 11, look: "none" },
      },
      zones: {
        fruit: [[0.04, 0.05, 0.4, 0.26]],
        bakery: [[0.6, 0.05, 0.96, 0.26]],
        drinks: [[0.03, 0.3, 0.16, 0.66]],
        sweets: [[0.43, 0.3, 0.57, 0.66]],
        toys: [[0.84, 0.3, 0.97, 0.66]],
      },
      trails: [{ e: "🍬", to: [0.2, 0.84] }, { e: "🍬", to: [0.8, 0.84] }],
      decals: [
        { k: "mat", x0: 0.03, y0: 0.04, x1: 0.41, y1: 0.27 },
        { k: "mat", x0: 0.59, y0: 0.04, x1: 0.97, y1: 0.27 },
        { k: "stripes", x0: 0.03, y0: 0.79, x1: 0.97, y1: 0.87 },
        { k: "zebra", x0: 0.43, y0: 0.68, x1: 0.57, y1: 0.72 },
      ],
      count: { e: "🍎", by: 1, say: "apples" },
      tiers: [
        { r: T1, items: [["🍬", 40], ["🍎", 20, "fruit", 2], ["🍌", 12, "fruit", 2], ["🍓", 16, "fruit", 4], ["🍪", 16, "sweets", 2], ["🍭", 12, "sweets"], ["🧃", 16, "drinks", 2], ["🥕", 12, "fruit", 3], ["🍇", 10, "fruit", 2]] },
        { r: T2, items: [["🥐", 12, "bakery", 2], ["🥖", 10, "bakery"], ["🍞", 12, "bakery", 2], ["🧁", 10, "bakery"], ["🍩", 10], ["🥤", 10, "drinks"], ["🧸", 8, "toys"], ["🎈", 8, "toys"], ["🍫", 10, "sweets"]] },
        { r: T3, items: [["🛒", 2, { ride: "left" }], ["🛒", 2, { ride: "right" }], ["🛒", 2, { ride: "tills" }], ["🛒", 6], ["🧺", 10], ["🍉", 10, "fruit"], ["🎂", 6, "bakery"], ["🍍", 10], ["🧀", 10], ["🥫", 10]] },
        { r: T4, items: [["📦", 12], ["🛍️", 12], ["🗑️", 8], ["🪜", 6]] },
        { r: T5, items: [["🚚", 6], ["🚛", 4], ["🏧", 6]] },
      ],
      finale: { e: "🏬", r: 20, at: [0.5, 0.12], say: "the whole shop" },
    },
    {
      // A round HEDGE MAZE, and THE TWIST: the way in winds round and round —
      // in at the bottom, round to the top, round to the bottom again — the
      // little things on the outside, the big ones deeper in, and the
      // fountain at the very middle — behind a GATE that only the big BUTTON
      // on the far side of the maze opens (a gold wire runs from one to the
      // other).
      id: "maze", name: "Hedge Maze", door: "🌿", color: "#5bbf6a",
      ground: "grass", hole: "gobble",
      wear: ["flower", "#ff7ac0"], air: ["petals", "#ffffff"],
      backdrop: ["#e6f7e9", "#c3ebc9"],
      start: [0.5, 0.94], starters: 3,
      tune: [392, 440, 493.88, 523.25, 587.33, 523.25],
      land: [{ oval: [0.5, 0.5, 0.49, 0.49] }],
      blocks: [
        { path: arcPts(0.5, 0.5, 0.39, 0.39, 98, 442, 48), w: 6, look: "hedge" },
        { path: arcPts(0.5, 0.5, 0.27, 0.27, 278, 622, 40), w: 6, look: "hedge" },
        { path: arcPts(0.5, 0.5, 0.15, 0.15, 98, 442, 30), w: 6, look: "hedge" },
        // spurs: the first lap goes round to the LEFT, the second to the RIGHT
        { path: spokePts(0.5, 0.5, 0.4, 0.26, 72), w: 6, look: "hedge" },
        { path: spokePts(0.5, 0.5, 0.28, 0.14, 252), w: 6, look: "hedge" },
      ],
      zones: {
        outside: { band: [0, 0.3] },
        lap1: { band: [0.2, 0.62] },
        lap2: { band: [0.55, 1] },
      },
      trails: [{ e: "🌼", to: [0.18, 0.75] }, { e: "🌼", to: [0.82, 0.75] }],
      decals: [
        { k: "park", x: 0.5, y: 0.5, r: 0.12 },
        { k: "flowers", x: 0.12, y: 0.3, r: 0.06 },
        { k: "flowers", x: 0.88, y: 0.3, r: 0.06 },
        { k: "flowers", x: 0.14, y: 0.74, r: 0.06 },
        { k: "flowers", x: 0.86, y: 0.74, r: 0.06 },
      ],
      tiers: [
        { r: T1, items: [["🌼", 50], ["🍓", 16, null, 2], ["🌸", 20, "outside", 4], ["🍄", 15, null, 3], ["🔔", 12], ["🫐", 15, null, 3], ["🎀", 12]] },
        { r: T2, items: [["🌷", 16, "lap1", 4], ["🍎", 12], ["🪀", 10], ["🎈", 12, "lap1"], ["🧁", 10], ["🍐", 10], ["🪁", 10, "lap1"]] },
        { r: T3, items: [["🌻", 15, "lap1", 3], ["🪴", 12, "lap2"], ["🧺", 10], ["🎁", 10, "lap2"], ["🏮", 8, "lap2"], ["🚪", 1, { at: { pts: [[0.5, 0.65]] }, lock: "fountain" }]] },
        { r: T4, items: [["🌳", 12, "lap2"], ["🌲", 10, "lap2"], ["⛺", 8, "lap1"], ["🔴", 1, { press: "fountain", at: { pts: [[0.5, 0.29]] } }]] },
        { r: T5, items: [["🏛️", 8, "lap2"], ["🎠", 8, "lap2"]] },
      ],
      finale: { e: "⛲", r: 20, at: [0.5, 0.5], say: "the fountain" },
    },
    {
      // Round CAVES joined by tunnels, and THE TWIST: it is DARK — Gobble
      // lights the way round him, and the gems, candles and torches glow.
      id: "cave", name: "Crystal Cave", door: "🔦", color: "#7b61ff",
      ground: "cave", hole: "gobble",
      wear: ["wizard", "#7b4bd6"], air: ["fireflies"],
      backdrop: ["#1a1426", "#2a2138"],
      dark: true,
      start: [0.5, 0.88], starters: 3,
      tune: [329.63, 392, 493.88, 659.25, 493.88],
      land: [
        { circle: [0.5, 0.83, 0.23] },
        { circle: [0.2, 0.6, 0.19] },
        { circle: [0.79, 0.59, 0.19] },
        { circle: [0.46, 0.41, 0.2] },
        { circle: [0.2, 0.2, 0.18] },
        { circle: [0.72, 0.19, 0.22] },
        { path: [[0.5, 0.83], [0.2, 0.6]], w: 34 },
        { path: [[0.5, 0.83], [0.79, 0.59]], w: 34 },
        { path: [[0.2, 0.6], [0.46, 0.41]], w: 30 },
        { path: [[0.79, 0.59], [0.46, 0.41]], w: 30 },
        { path: [[0.46, 0.41], [0.2, 0.2]], w: 30 },
        { path: [[0.2, 0.2], [0.72, 0.19]], w: 30 },
      ],
      zones: {
        grotto: [{ circle: [0.72, 0.19, 0.2] }],
        mine: [{ circle: [0.79, 0.59, 0.15] }],
        pool: [{ circle: [0.2, 0.6, 0.15] }],
      },
      trails: [{ e: "💎", to: [0.33, 0.72] }, { e: "💎", to: [0.67, 0.71] }],
      decals: [
        { k: "pond", x: 0.2, y: 0.6, r: 0.07 },
        { k: "gravel", x: 0.79, y: 0.59, r: 0.08 },
        { k: "gravel", x: 0.2, y: 0.2, r: 0.07 },
        { k: "puddle", x: 0.46, y: 0.41, r: 0.05 },
      ],
      tiers: [
        { r: T1, items: [["💎", 44, { glow: true }], ["🪙", 30, null, 3], ["🍄", 24, null, 4], ["🪨", 20, null, 4], ["🔑", 10], ["⭐", 16, null, 2]] },
        { r: T2, items: [["🔦", 12, { glow: true }], ["🪔", 10, { glow: true }], ["🏺", 12], ["🧪", 10], ["🪣", 10, "mine"], ["⛏️", 12, "mine"], ["🗝️", 8]] },
        { r: T3, items: [["🕯️", 14, { glow: true }], ["🪵", 12, null, 2], ["🧰", 10, "mine"], ["🗺️", 10], ["💰", 10, "grotto"]] },
        { r: T4, items: [["🗿", 10], ["⚱️", 10], ["🛶", 6, "pool"], ["⛺", 6], ["💠", 4, { shake: [["💎", 2, 1], ["🪙", 1, 1]], hits: 3, glow: true }]] },
        { r: T5, items: [["🚂", 6], ["⛰️", 6], ["🗻", 4]] },
      ],
      finale: { e: "🔮", r: 20, at: [0.72, 0.17], say: "the crystal ball" },
    },
    {
      // A CASTLE behind a moat, and THE TWIST: cross on the drawbridge, then
      // find all THREE glowing keys — one in each village and one down by the
      // moat ("one of three!") — to open the castle door.
      id: "castle", name: "Castle", door: "🏰", color: "#a0a8c0",
      ground: "stone", hole: "gobble",
      wear: ["knight", "#e63946"], air: ["leaves", "#7cc95a"],
      backdrop: ["#e4efff", "#bcd2f2"],
      start: [0.5, 0.92], starters: 3,
      tune: [392, 392, 523.25, 659.25, 783.99, 659.25],
      blocks: [
        { oval: [0.5, 0.27, 0.39, 0.25], not: { oval: [0.5, 0.27, 0.32, 0.2] }, look: "water" },
        { path: [[0.48, 0.38], [0.3, 0.38], [0.3, 0.13], [0.7, 0.13], [0.7, 0.38], [0.52, 0.38]], w: 5, look: "wall" },
      ],
      bridges: [{ path: [[0.5, 0.44], [0.5, 0.55]], w: 14, look: "planks" }],
      zones: {
        court: [[0.33, 0.16, 0.67, 0.35]],
        village: [[0.04, 0.56, 0.3, 0.8], [0.7, 0.56, 0.96, 0.8]],
        west: [[0.05, 0.6, 0.28, 0.78]],
        east: [[0.72, 0.6, 0.95, 0.78]],
        moat: [[0.04, 0.4, 0.14, 0.52]],
        market: [[0.38, 0.6, 0.62, 0.72]],
        fair: [[0.04, 0.82, 0.3, 0.96], [0.7, 0.82, 0.96, 0.96]],
      },
      trails: [{ e: "🪙", to: [0.25, 0.86] }, { e: "🪙", to: [0.75, 0.86] }],
      decals: [
        { k: "slab", x0: 0.31, y0: 0.14, x1: 0.69, y1: 0.37 },
        { k: "path", w: 12, pts: [[0.5, 1.02], [0.5, 0.75], [0.5, 0.54]] },
        { k: "cloth", x0: 0.37, y0: 0.59, x1: 0.63, y1: 0.73 },
        { k: "patch", x: 0.19, y: 0.73, r: 0.12, c: "#b9a27a" },
        { k: "patch", x: 0.81, y: 0.73, r: 0.12, c: "#b9a27a" },
      ],
      tiers: [
        { r: T1, items: [["🪙", 50], ["💍", 10, "court"], ["🍎", 16, null, 2], ["🌼", 20, null, 4], ["🔔", 12], ["🍇", 16, null, 2], ["🗝️", 1, { key: "door", zone: "west", glow: true }], ["🗝️", 1, { key: "door", zone: "east", glow: true }], ["🗝️", 1, { key: "door", zone: "moat", glow: true }]] },
        { r: T2, items: [["👑", 10, "court"], ["🥖", 12, "market"], ["🍞", 12, "market"], ["🏺", 10], ["🪣", 10], ["🎈", 10], ["🧀", 10, "market"]] },
        { r: T3, items: [["🛡️", 8, "court"], ["💰", 8, "court"], ["🛢️", 10], ["🪵", 12, null, 2], ["🧺", 10, "market"], ["🥁", 8], ["🚪", 1, { at: { pts: [[0.5, 0.38]] }, lock: "door" }]] },
        { r: T4, items: [["🎪", 6, "fair"], ["🛖", 10, "village"], ["🌳", 12], ["⛺", 6, "fair"]] },
        { r: T5, items: [["🏠", 8, "village"], ["🏡", 4], ["🎠", 4]] },
      ],
      finale: { e: "🏰", r: 20, at: [0.5, 0.21], say: "the castle" },
    },
    {
      // A TOY FACTORY, and THE TWIST: conveyor belts carry Gobble along (let
      // go and he rides), and the brown boxes burst open with toys inside.
      id: "factory", name: "Toy Factory", door: "🏭", color: "#ffb347",
      ground: "metal", hole: "gobble",
      wear: ["hardhat", "#ff9f1c"], air: ["bubbles"],
      backdrop: ["#eef1f6", "#d4dbe6"],
      start: [0.5, 0.91], starters: 3,
      tune: [523.25, 392, 523.25, 659.25, 783.99, 659.25],
      blocks: [
        { rect: [0.02, 0.75, 0.11, 0.81], round: 3, look: "wall" },
        { rect: [0.89, 0.53, 0.98, 0.59], round: 3, look: "wall" },
        { rect: [0.02, 0.31, 0.11, 0.37], round: 3, look: "wall" },
      ],
      flows: [
        { pts: [[0.11, 0.78], [0.9, 0.78]], w: 26, v: 24, look: "belt" },
        { pts: [[0.89, 0.56], [0.1, 0.56]], w: 26, v: 24, look: "belt" },
        { pts: [[0.11, 0.34], [0.9, 0.34]], w: 26, v: 24, look: "belt" },
      ],
      zones: {
      },
      trails: [{ e: "🔩", to: [0.2, 0.9] }, { e: "🔩", to: [0.8, 0.9] }],
      decals: [
        { k: "slab", x0: 0.03, y0: 0.6, x1: 0.97, y1: 0.74 },
        { k: "slab", x0: 0.03, y0: 0.38, x1: 0.97, y1: 0.52 },
        { k: "stripes", x0: 0.36, y0: 0.03, x1: 0.64, y1: 0.08 },
        { k: "puddle", x: 0.86, y: 0.9, r: 0.04 },
      ],
      tiers: [
        { r: T1, items: [["🔩", 50], ["⚙️", 24, null, 3], ["🧩", 16, null, 2], ["🎲", 16, null, 2], ["🪀", 12], ["🔋", 14], ["🧲", 12]] },
        { r: T2, items: [["🔧", 12], ["🔨", 12], ["🪛", 12], ["🧸", 12], ["🪁", 10], ["🎨", 10], ["🪆", 10]] },
        { r: T3, items: [["📦", 14, { pop: [["🪀", 2, 1], ["🧩", 1, 1], ["🎲", 1, 1]] }], ["🛢️", 10], ["🧰", 10], ["🚗", 10], ["🎸", 8]] },
        { r: T4, items: [["🎁", 6, { pop: [["🧸", 1, 2], ["🚗", 1, 3]] }], ["🚜", 8], ["🛻", 8], ["🪑", 8]] },
        { r: T5, items: [["🚚", 6], ["🚛", 6], ["🏗️", 4]] },
      ],
      finale: { e: "🤖", r: 20, at: [0.5, 0.14], say: "the giant robot" },
    },
    {
      // A CIRCUS high up under the tent: a ring, a centre stage and little
      // platforms, and THE TWIST: tightropes join them, and springs BOUNCE
      // Gobble from the bottom platforms right up to the top ones. Big circus
      // balls go BOING and bounce him back until he is big enough to gulp.
      id: "circus", name: "Circus", door: "🎪", color: "#ff5e7e",
      ground: "ring", hole: "gobble",
      wear: ["tophat", "#e63946"], air: ["confetti"],
      backdrop: ["#7a1f3d", "#4a1028"],
      start: [0.5, 0.87], starters: 3,
      tune: [392, 523.25, 392, 523.25, 659.25, 587.33, 523.25],
      land: [
        { ring: [0.5, 0.5, 0.21, 0.36] },
        { circle: [0.5, 0.5, 0.1] },
        { circle: [0.5, 0.87, 0.18] },
        { circle: [0.18, 0.15, 0.16] },
        { circle: [0.82, 0.15, 0.16] },
        { circle: [0.15, 0.8, 0.14] },
        { circle: [0.85, 0.8, 0.14] },
      ],
      bridges: [
        { path: [[0.5, 0.8], [0.5, 0.67]], w: 12, look: "rope" },
        { path: [[0.345, 0.839], [0.268, 0.824]], w: 12, look: "rope" },
        { path: [[0.655, 0.839], [0.732, 0.824]], w: 12, look: "rope" },
        { path: [[0.352, 0.338], [0.243, 0.219]], w: 12, look: "rope" },
        { path: [[0.648, 0.338], [0.757, 0.219]], w: 12, look: "rope" },
        { path: [[0.5, 0.385], [0.5, 0.46]], w: 10, look: "rope" },
        { path: [[0.5, 0.615], [0.5, 0.54]], w: 10, look: "rope" },
      ],
      portals: [
        { a: [0.12, 0.8], b: [0.17, 0.12], look: "spring" },
        { a: [0.88, 0.8], b: [0.83, 0.12], look: "spring" },
      ],
      tracks: { ring: { orbit: [0.5, 0.5, 0.285], speed: 13, look: "lane" } },
      zones: {
        top: [{ circle: [0.18, 0.15, 0.14] }, { circle: [0.82, 0.15, 0.14] }],
        low: [{ circle: [0.15, 0.8, 0.12] }, { circle: [0.85, 0.8, 0.12] }],
      },
      trails: [{ e: "🍿", to: [0.36, 0.86] }, { e: "🍿", to: [0.64, 0.86] }],
      decals: [
        { k: "dance", x0: 0.42, y0: 0.47, x1: 0.58, y1: 0.53 },
        { k: "rug", x: 0.5, y: 0.87, r: 0.12, pal: 3 },
        { k: "rug", x: 0.18, y: 0.15, r: 0.1, pal: 1 },
        { k: "rug", x: 0.82, y: 0.15, r: 0.1, pal: 2 },
      ],
      tiers: [
        { r: T1, items: [["🍿", 50], ["🎟️", 20, null, 2], ["🍭", 16], ["🍬", 16, null, 2], ["🥜", 14, null, 2], ["🪀", 12]] },
        { r: T2, items: [["🎈", 16, null, 2], ["🎩", 10], ["🪄", 10], ["🥁", 10], ["🎺", 10], ["🧁", 10]] },
        { r: T3, items: [["🛴", 3, { ride: "ring" }], ["🎭", 10], ["🪅", 8], ["🎁", 8], ["🛹", 8], ["🧸", 10], ["🏀", 6, { bounce: true }]] },
        { r: T4, items: [["🎠", 6, "top"], ["🚲", 8], ["🪑", 8], ["🚐", 6, "low"]] },
        { r: T5, items: [["🚂", 4], ["🚃", 9], ["🚌", 4]] },
      ],
      finale: { e: "🎪", r: 20, at: [0.5, 0.5], say: "the big top" },
    },
    {
      // A TALL jungle (much taller than it is wide), and THE TWIST: a river
      // winds all the way down it — hop in and the river carries Gobble
      // downstream toward the old temple at the bottom.
      id: "jungle", name: "River Jungle", door: "🌴", color: "#3fbf7f",
      ground: "jungle", hole: "gobble",
      wear: ["explorer", "#d9c08c"], air: ["leaves", "#5aa84a"],
      backdrop: ["#d4f5e2", "#a8e6c4"],
      world: [380, 760],
      start: [0.66, 0.05], starters: 3,
      tune: [440, 523.25, 587.33, 659.25, 783.99, 659.25],
      flows: [
        { pts: [[0.5, -0.02], [0.25, 0.12], [0.72, 0.28], [0.28, 0.45], [0.72, 0.62], [0.3, 0.78], [0.12, 0.9], [-0.04, 1.02]], w: 40, v: 22 },
      ],
      blocks: [
        { circle: [0.12, 0.3, 0.07], look: "hedge" },
        { circle: [0.88, 0.48, 0.07], look: "hedge" },
        { circle: [0.13, 0.62, 0.06], look: "hedge" },
        { circle: [0.86, 0.78, 0.06], look: "hedge" },
        { circle: [0.9, 0.16, 0.06], look: "hedge" },
      ],
      zones: {
        early: { band: [0, 0.4] },
        middle: { band: [0.3, 0.8] },
        late: { band: [0.5, 1] },
      },
      trails: [{ e: "🍌", to: [0.85, 0.24] }, { e: "🍌", to: [0.5, 0.18] }],
      decals: [
        { k: "shade", x: 0.2, y: 0.22, r: 0.2 },
        { k: "shade", x: 0.8, y: 0.55, r: 0.2 },
        { k: "shade", x: 0.25, y: 0.86, r: 0.2 },
        { k: "flowers", x: 0.85, y: 0.36, r: 0.08 },
        { k: "flowers", x: 0.15, y: 0.5, r: 0.08 },
        { k: "patch", x: 0.66, y: 0.93, r: 0.16, c: "#9c8a6a" },
      ],
      tiers: [
        { r: T1, items: [["🍌", 56], ["🥭", 16, null, 2], ["🌺", 20, "early", 4], ["🍄", 18, null, 3], ["🫐", 15, null, 3], ["🪶", 12]] },
        { r: T2, items: [["🥥", 16, null, 2], ["🍍", 12], ["🌿", 16, null, 4], ["🪨", 12, null, 2], ["🏺", 10, "middle"], ["🔦", 10], ["🧭", 10]] },
        { r: T3, items: [["🛶", 8, "middle"], ["🪵", 12, null, 2], ["🎋", 10], ["⛺", 8, "middle"], ["🗺️", 8], ["🥁", 8]] },
        { r: T4, items: [["🌴", 14, "late"], ["🌳", 10, "late"], ["🛖", 8, "late"]] },
        { r: T5, items: [["🗿", 6, "late"], ["⛰️", 6, "late"], ["🗻", 4, "late"]] },
      ],
      finale: { e: "🛕", r: 20, at: [0.66, 0.93], say: "the temple" },
    },
    {
      // Puffy CLOUDS in the sky, and THE TWIST: rainbow slides WHOOSH Gobble
      // up from the side clouds to the top one, and balloons drift round on
      // the breeze.
      id: "cloud", name: "Cloud Land", door: "☁️", color: "#9ec5ff",
      ground: "cloud", hole: "gobble",
      wear: ["halo", "#ffd24d"], air: ["sparkles", "#ffd6f2"],
      backdrop: ["#bfe3ff", "#8ccaff"],
      start: [0.5, 0.88], starters: 3,
      tune: [783.99, 880, 987.77, 1174.66, 987.77, 880],
      land: [
        { circle: [0.36, 0.86, 0.13] }, { circle: [0.5, 0.83, 0.17] }, { circle: [0.64, 0.86, 0.13] },
        { circle: [0.13, 0.6, 0.11] }, { circle: [0.24, 0.57, 0.14] }, { circle: [0.3, 0.63, 0.1] },
        { circle: [0.87, 0.6, 0.11] }, { circle: [0.76, 0.57, 0.14] }, { circle: [0.7, 0.63, 0.1] },
        { circle: [0.5, 0.4, 0.15] }, { circle: [0.4, 0.43, 0.09] }, { circle: [0.6, 0.43, 0.09] },
        { circle: [0.33, 0.17, 0.13] }, { circle: [0.5, 0.14, 0.16] }, { circle: [0.67, 0.17, 0.13] },
      ],
      bridges: [
        { path: [[0.36, 0.8], [0.29, 0.66]], w: 20, look: "rainbow" },
        { path: [[0.64, 0.8], [0.71, 0.66]], w: 20, look: "rainbow" },
        { path: [[0.31, 0.58], [0.42, 0.45]], w: 20, look: "rainbow" },
        { path: [[0.69, 0.58], [0.58, 0.45]], w: 20, look: "rainbow" },
        { path: [[0.5, 0.33], [0.5, 0.22]], w: 20, look: "rainbow" },
        { path: [[0.21, 0.52], [0.33, 0.2]], w: 22, look: "rainbow" },
        { path: [[0.79, 0.52], [0.67, 0.2]], w: 22, look: "rainbow" },
      ],
      flows: [
        { pts: [[0.21, 0.52], [0.33, 0.2]], w: 22, v: 40, look: "slide" },
        { pts: [[0.79, 0.52], [0.67, 0.2]], w: 22, v: 40, look: "slide" },
      ],
      tracks: { breeze: { pts: ovalPts(0.5, 0.5, 0.36, 0.2, 28), loop: true, speed: 9, look: "none" } },
      zones: {
        top: [{ circle: [0.5, 0.14, 0.15] }, { circle: [0.33, 0.17, 0.11] }, { circle: [0.67, 0.17, 0.11] }],
        sides: [{ circle: [0.24, 0.57, 0.13] }, { circle: [0.76, 0.57, 0.13] }],
      },
      trails: [{ e: "⭐", to: [0.37, 0.84] }, { e: "⭐", to: [0.63, 0.84] }],
      decals: [
        { k: "nebula", x: 0.5, y: 0.5, r: 0.5, c: "rgba(255,255,255,0.18)" },
      ],
      tiers: [
        { r: T1, items: [["⭐", 56], ["🌟", 21, null, 3], ["💧", 16, null, 2], ["🍬", 16, null, 2], ["❄️", 14], ["🍭", 14]] },
        { r: T2, items: [["🎈", 6, { ride: "breeze" }], ["🎈", 14, null, 2], ["🪁", 12], ["☂️", 10], ["🌙", 10], ["🧁", 10]] },
        { r: T3, items: [["🎐", 8], ["⛅", 10], ["🪂", 8], ["🛸", 8], ["🎁", 10], ["🌤️", 8]] },
        { r: T4, items: [["🛩️", 8], ["🚁", 6], ["🌥️", 8, "sides"], ["🌦️", 6]] },
        { r: T5, items: [["🌩️", 4, "top"], ["🌧️", 7], ["🛰️", 4]] },
      ],
      finale: { e: "🌈", r: 20, at: [0.5, 0.13], say: "the big rainbow" },
    },
    {
      // A crescent-shaped TREASURE ISLAND round a bay, and THE TWIST: the X's
      // mark the spots (eat one and out comes buried treasure), and the big
      // treasure is on the far point — across the rope bridge over the bay.
      id: "pirate", name: "Treasure Island", door: "🏝️", color: "#e6b85c",
      ground: "sand", hole: "gobble",
      wear: ["pirate", "#2b2b3a"], air: ["bubbles"],
      backdrop: ["#7fd0f2", "#3fa8e0"],
      start: [0.5, 0.9], starters: 3,
      tune: [293.66, 349.23, 440, 349.23, 293.66, 440],
      land: [{ oval: [0.5, 0.55, 0.48, 0.44], not: { oval: [0.5, 0.25, 0.2, 0.24] } }],
      blocks: [{ rect: [-0.02, 0.385, 0.37, 0.415], round: 4, look: "rock" }],
      bridges: [{ path: [[0.28, 0.27], [0.72, 0.27]], w: 12, look: "rope" }],
      tracks: { bay: { pts: ovalPts(0.5, 0.37, 0.13, 0.06, 24), loop: true, speed: 8, look: "none" } },
      zones: {
        palms: [[0.05, 0.48, 0.25, 0.7], [0.75, 0.48, 0.95, 0.7]],
      },
      trails: [{ e: "🪙", to: [0.25, 0.8] }, { e: "🪙", to: [0.75, 0.8] }],
      decals: [
        { k: "footprints", pts: [[0.5, 0.97], [0.62, 0.8], [0.8, 0.6], [0.78, 0.4], [0.72, 0.28]] },
        { k: "rockpool", x: 0.18, y: 0.86, r: 0.05 },
        { k: "towel", x0: 0.42, y0: 0.82, x1: 0.58, y1: 0.9, c: "#ff6b6b" },
        { k: "shade", x: 0.15, y: 0.6, r: 0.14 },
        { k: "shade", x: 0.85, y: 0.6, r: 0.14 },
      ],
      tiers: [
        { r: T1, items: [["🪙", 56], ["💎", 16, null, 2], ["🍌", 16, null, 2], ["🍬", 14], ["🔑", 12], ["🍒", 14, null, 2], ["⭐", 14]] },
        { r: T2, items: [["🥥", 16, null, 2], ["🧭", 10], ["🗝️", 10], ["🏴", 8], ["🪝", 10], ["🍍", 12], ["🔭", 10]] },
        { r: T3, items: [["❌", 12, { pop: [["🪙", 3, 1], ["🗝️", 1, 2]] }], ["🗺️", 10], ["🪵", 12, null, 2], ["🛢️", 10], ["🍉", 8]] },
        { r: T4, items: [["⛵", 3, { ride: "bay" }], ["🌴", 14, "palms"], ["🛶", 8], ["⚓", 6]] },
        { r: T5, items: [["🏚️", 4], ["🗿", 6], ["⛰️", 6]] },
      ],
      finale: { e: "💰", r: 20, at: [0.2, 0.28], say: "the treasure" },
    },
    {
      // A THEME PARK round a lake, and THE TWIST: everything is a ride — a
      // roller-coaster train whizzes round the whole park, boats go round
      // the lake, the teacups spin and the carousel goes round and round.
      id: "themepark", name: "Theme Park", door: "🎢", color: "#ff6fb5",
      ground: "party", hole: "gobble",
      wear: ["balloon", "#ff5e7e"], air: ["confetti"],
      backdrop: ["#fff0f7", "#ffd6ea"],
      start: [0.5, 0.94], starters: 3,
      tune: [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 523.25],
      blocks: [{ oval: [0.5, 0.52, 0.2, 0.09], look: "water" }],
      tracks: {
        coaster: { pts: ovalPts(0.5, 0.52, 0.43, 0.32, 40), loop: true, speed: 18, look: "coaster", train: true },
        lake: { pts: ovalPts(0.5, 0.52, 0.17, 0.07, 20), loop: true, speed: 7, look: "none" },
        cups: { orbit: [0.8, 0.88, 0.06], speed: 14, look: "orbit" },
        carousel: { orbit: [0.2, 0.88, 0.07], speed: -9, look: "orbit" },
      },
      zones: {
        inner: [{ oval: [0.5, 0.52, 0.38, 0.27], not: { oval: [0.5, 0.52, 0.24, 0.12] } }],
        corners: [[0.03, 0.03, 0.3, 0.18], [0.7, 0.03, 0.97, 0.18]],
      },
      trails: [{ e: "🍬", to: [0.36, 0.9] }, { e: "🍬", to: [0.64, 0.9] }],
      decals: [
        { k: "heart", x: 0.5, y: 0.3, r: 0.08 },
        { k: "dance", x0: 0.38, y0: 0.66, x1: 0.62, y1: 0.76 },
        { k: "cloth", x0: 0.04, y0: 0.04, x1: 0.29, y1: 0.17 },
        { k: "cloth", x0: 0.71, y0: 0.04, x1: 0.96, y1: 0.17 },
      ],
      tiers: [
        { r: T1, items: [["🍬", 50], ["🍭", 16], ["🍿", 16, null, 2], ["🎟️", 16, null, 2], ["🍦", 14], ["🍫", 14, null, 2], ["🪙", 14]] },
        { r: T2, items: [["🚃", 5, { ride: "coaster" }], ["☕", 4, { ride: "cups" }], ["🎈", 16, null, 2], ["🧸", 10], ["🍩", 10], ["🌭", 10], ["🥤", 10]] },
        { r: T3, items: [["🎠", 3, { ride: "carousel" }], ["🛶", 3, { ride: "lake" }], ["🎯", 8], ["🪅", 8], ["🛴", 8], ["🎁", 10], ["🛹", 8]] },
        { r: T4, items: [["🎡", 4], ["🚲", 8], ["🛺", 6], ["🪑", 8], ["🌳", 6, "inner"]] },
        { r: T5, items: [["🎪", 6, "corners"], ["🏯", 4], ["🏟️", 4], ["🚂", 4]] },
      ],
      finale: { e: "🎢", r: 20, at: [0.5, 0.1], say: "the roller coaster" },
    },
    {
      // A SPIRAL of a land, and THE TWIST: the only way in is round and round
      // the spiral path — small sweets on the outside, cakes further in, and
      // the giant lollipop right in the middle — and giant GUMBALLS on the
      // path go BOING until he is big enough to gulp them.
      id: "candy", name: "Candy Land", door: "🍭", color: "#ff8ad8",
      ground: "candy", hole: "gobble",
      wear: ["bow", "#ff7ac0"], air: ["sprinkles"],
      backdrop: ["#ffe9f6", "#ffcfee"],
      world: [520, 728],
      start: [0.5, 0.93], starters: 3,
      tune: [659.25, 783.99, 880, 783.99, 659.25, 523.25],
      land: [
        { path: spiralPts(0.5, 0.5, 0.42, 0.42, 0.06, 0.06, 1.5, 72, Math.PI / 2), w: 70 },
        { circle: [0.5, 0.5, 0.12] },
      ],
      zones: {
        outer: { band: [0, 0.4] },
        mid: { band: [0.25, 0.75] },
        inner: { band: [0.5, 1] },
      },
      // a spiral has ONE way in, so ONE trail, leading round it
      trails: [{ e: "🍬", to: [0.1, 0.55] }],
      decals: [
        { k: "heart", x: 0.5, y: 0.5, r: 0.08 },
      ],
      tiers: [
        { r: T1, items: [["🍬", 60], ["🍓", 20, "outer", 2], ["🍫", 16, null, 2], ["🍪", 16, null, 2], ["🍒", 14], ["🍡", 12]] },
        { r: T2, items: [["🧁", 14], ["🍩", 14], ["🍰", 12, "mid"], ["🥧", 10], ["🍮", 10], ["🍦", 10]] },
        { r: T3, items: [["🎂", 10, "mid"], ["🍯", 10], ["🍉", 8], ["🥞", 10], ["🧇", 10], ["🍨", 8], ["🟣", 5, { bounce: true, zone: "mid" }]] },
        { r: T4, items: [["🎁", 10, "inner"], ["🧸", 10, "inner"], ["🪅", 8, "inner"], ["🍄", 6, "inner"], ["🔵", 4, { bounce: true, zone: "inner" }]] },
        { r: T5, items: [["🏰", 4, "inner"], ["🎪", 4, "inner"], ["🏠", 6, "inner"]] },
      ],
      finale: { e: "🍭", r: 20, at: [0.5, 0.5], say: "the giant lollipop" },
    },
    {
      // A MUSIC NOTE of a land (a round head, a tall stem, a flag), and THE
      // TWIST: rows of notes topple in one after another, and in Music Land
      // every gulp plays the next note of a tune.
      id: "music", name: "Music Land", door: "🎵", color: "#b48cff",
      ground: "stage", hole: "gobble",
      wear: ["headphones", "#7b4bd6"], air: ["notes"],
      backdrop: ["#efe6ff", "#d8c6ff"],
      world: [480, 672],
      start: [0.3, 0.86], starters: 3,
      tune: [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5],
      notes: true,
      land: [
        { oval: [0.35, 0.79, 0.33, 0.18] },
        { rect: [0.53, 0.13, 0.66, 0.8], round: 8 },
        { oval: [0.76, 0.24, 0.22, 0.12] },
        { oval: [0.82, 0.37, 0.14, 0.1] },
      ],
      zones: {
        flag: [{ oval: [0.76, 0.24, 0.2, 0.1] }, { oval: [0.82, 0.37, 0.12, 0.08] }],
      },
      trails: [{ e: "🎵", to: [0.15, 0.8] }, { e: "🎵", to: [0.45, 0.72] }],
      decals: [
        { k: "stripes", x0: 0.54, y0: 0.15, x1: 0.65, y1: 0.79 },
        { k: "rug", x: 0.35, y: 0.79, r: 0.18, pal: 1 },
      ],
      tiers: [
        { r: T1, items: [["🎵", 48], ["🎵", 10, { at: { line: [[0.595, 0.72], [0.595, 0.22]] }, chain: true }], ["🔔", 14], ["🍬", 16, null, 2], ["🎤", 12], ["🎼", 12], ["⭐", 14, null, 2]] },
        { r: T2, items: [["🎶", 8, { at: { arc: [0.35, 0.79, 0.2, 195, 345] }, chain: true }], ["🎶", 10], ["🥁", 12], ["🪘", 10], ["🎧", 10], ["📻", 10], ["🎙️", 8]] },
        { r: T3, items: [["🎸", 10], ["🎺", 10], ["🎷", 10], ["🪕", 8], ["🎻", 8]] },
        { r: T4, items: [["🛋️", 6], ["🪑", 12], ["📺", 6], ["🎠", 4, "flag"]] },
        { r: T5, items: [["🎪", 7], ["🏟️", 5], ["🚌", 5]] },
      ],
      finale: { e: "🎹", r: 20, at: [0.76, 0.22], say: "the giant piano" },
    },
    {
      // BATH TIME: the bath overflowed. Puddles all over the bathroom floor
      // to walk round, wet tiles he SLIDES on, and the plughole in the middle
      // is a WHIRLPOOL that spins him round and round.
      id: "bath", name: "Bath Time", door: "🛁", color: "#6cc6f0",
      ground: "bath", hole: "gobble",
      wear: ["bobble", "#5ec8ff"], air: ["bubbles"],
      backdrop: ["#eaf7ff", "#c5e7fa"],
      start: [0.5, 0.92], starters: 3,
      tune: [523.25, 659.25, 783.99, 659.25, 1046.5],
      land: [{ rect: [0.02, 0.02, 0.98, 0.98], round: 40 }],
      blocks: [
        { oval: [0.24, 0.42, 0.13, 0.05], look: "water" },
        { oval: [0.76, 0.42, 0.13, 0.05], look: "water" },
        { oval: [0.3, 0.72, 0.1, 0.04], look: "water" },
        { oval: [0.7, 0.72, 0.1, 0.04], look: "water" },
      ],
      flows: [{ spin: [0.5, 0.56, 0.11], v: 22, look: "whirl" }],
      slide: ["wet"],
      zones: {
        wet: [[0.08, 0.5, 0.3, 0.62], [0.7, 0.5, 0.92, 0.62]],
        sink: [[0.05, 0.05, 0.3, 0.2]],
        shelf: [[0.7, 0.05, 0.95, 0.2]],
      },
      trails: [{ e: "🧼", to: [0.2, 0.84] }, { e: "🧼", to: [0.8, 0.84] }],
      decals: [
        { k: "mat", x0: 0.37, y0: 0.79, x1: 0.63, y1: 0.89, c: "#7fd0f5" },
        { k: "puddle", x: 0.16, y: 0.56, r: 0.07 },
        { k: "puddle", x: 0.84, y: 0.56, r: 0.07 },
        { k: "towel", x0: 0.06, y0: 0.24, x1: 0.18, y1: 0.3, c: "#ff8fb1" },
        { k: "towel", x0: 0.82, y0: 0.24, x1: 0.94, y1: 0.3, c: "#ffd24d" },
      ],
      tiers: [
        { r: T1, items: [["🧼", 54], ["🪥", 20, null, 2], ["🧽", 18], ["💧", 22, "wet", 2], ["🍬", 14], ["⭐", 14]] },
        { r: T2, items: [["🧻", 14], ["🪣", 10], ["🩴", 12, null, 2], ["🧦", 14, null, 2], ["👕", 10], ["🧴", 12, "shelf"]] },
        { r: T3, items: [["🧺", 10], ["🪴", 8], ["🪞", 6, "sink"], ["🚿", 6], ["⛵", 10], ["🧸", 8]] },
        { r: T4, items: [["🚽", 6], ["🗑️", 6], ["🪑", 6], ["🪜", 6]] },
        { r: T5, items: [["🗄️", 5], ["🚪", 5], ["🪟", 5]] },
      ],
      finale: { e: "🛁", r: 20, at: [0.5, 0.14], say: "the bathtub" },
    },
    {
      // A GIANT KITCHEN (§17 giant: six sizes, a giant finale): Gobble is
      // mouse-sized under the counters, and THE TWIST is counting — every
      // cookie he gulps says the next number — round a kitchen island, with a
      // spinning pizza plate on the floor that carries him round.
      id: "kitchen", name: "Giant Kitchen", door: "🍳", color: "#ff9f43",
      ground: "kitchen", hole: "gobble",
      world: [504, 706],
      wear: ["chef", "#ffffff"], air: ["motes"],
      backdrop: ["#fff6e8", "#ffe2bf"],
      start: [0.5, 0.94], starters: 3,
      tune: [392, 523.25, 659.25, 783.99, 659.25, 523.25],
      count: { e: "🍪", by: 1, say: "cookies" },
      blocks: [
        { rect: [0.03, 0.3, 0.09, 0.64], round: 2, look: "counter" },
        { rect: [0.91, 0.3, 0.97, 0.64], round: 2, look: "counter" },
        { rect: [0.3, 0.45, 0.7, 0.52], round: 3, look: "counter" },
      ],
      flows: [{ spin: [0.5, 0.75, 0.08], v: 20, look: "pizza" }],
      zones: {
        tray: [[0.13, 0.62, 0.33, 0.74]],
        table: [[0.64, 0.6, 0.94, 0.86]],
        pantry: [[0.12, 0.3, 0.27, 0.62], [0.73, 0.3, 0.88, 0.62]],
      },
      trails: [{ e: "🍓", to: [0.24, 0.86] }, { e: "🍓", to: [0.76, 0.86] }],
      decals: [
        { k: "rug", x: 0.79, y: 0.73, r: 0.13 },
        { k: "mat", x0: 0.4, y0: 0.9, x1: 0.6, y1: 0.97, c: "#ff9f43" },
        { k: "splat", x: 0.2, y: 0.36, r: 0.03 },
        { k: "slab", x0: 0.12, y0: 0.61, x1: 0.34, y1: 0.75 },
      ],
      tiers: [
        { r: T1, items: [["🍓", 52], ["🍪", 12, { at: { grid: [0.15, 0.64, 0.31, 0.72], cols: 4 } }], ["🍪", 8], ["🫐", 28, null, 4], ["🍒", 18, null, 2], ["🧂", 14], ["🥄", 16, "pantry"], ["🧈", 14]] },
        { r: T2, items: [["🥚", 14, null, 2], ["🍋", 14], ["🥕", 14], ["🧀", 14, "pantry"], ["🍌", 14], ["🥐", 12], ["🍅", 14, null, 2]] },
        { r: T3, items: [["🥛", 12, "pantry"], ["🍞", 12], ["🧁", 12], ["☕", 10], ["🥗", 8], ["🍯", 10, "pantry"], ["🫖", 8]] },
        { r: T4, items: [["🍉", 8], ["🎂", 6, "table"], ["🥘", 8], ["🍲", 8], ["🧺", 8]] },
        { r: T5, items: [["🪑", 10, "table"], ["🗑️", 6], ["🛒", 4]] },
        { r: T6, items: [["🗄️", 4], ["🚪", 3], ["🪟", 3]] },
      ],
      finale: { e: "🍕", r: 28, at: [0.5, 0.2], say: "the giant pizza" },
    },
    {
      // A FIRE STATION, and THE TWIST: the fire engine waits behind the
      // garage door, and only the big red BUTTON out in the yard opens it (a
      // gold wire runs from the button to the door). Ambulances and police
      // cars drive round the yard.
      id: "firestation", name: "Fire Station", door: "🚒", color: "#e63946",
      ground: "brick", hole: "gobble",
      wear: ["hardhat", "#e63946"], air: ["dust"],
      backdrop: ["#fff0ea", "#ffd5c8"],
      start: [0.5, 0.92], starters: 3,
      tune: [659.25, 523.25, 659.25, 523.25, 783.99],
      blocks: [
        // the garage: walls round the top middle, shut but for its door
        { path: [[0.48, 0.32], [0.26, 0.32], [0.26, -0.02]], w: 5, look: "wall" },
        { path: [[0.52, 0.32], [0.74, 0.32], [0.74, -0.02]], w: 5, look: "wall" },
      ],
      tracks: { yard: { pts: ovalPts(0.5, 0.65, 0.38, 0.18, 28), loop: true, speed: 9, look: "road" } },
      zones: {
        garage: [[0.3, 0.04, 0.7, 0.28]],
        lot: [[0.04, 0.04, 0.22, 0.4], [0.78, 0.04, 0.96, 0.4]],
        street: [[0.3, 0.86, 0.7, 0.96]],
      },
      trails: [{ e: "🍩", to: [0.22, 0.86] }, { e: "🍩", to: [0.78, 0.86] }],
      decals: [
        { k: "slab", x0: 0.27, y0: 0.02, x1: 0.73, y1: 0.31 },
        { k: "lot", x0: 0.03, y0: 0.04, x1: 0.23, y1: 0.4 },
        { k: "lot", x0: 0.77, y0: 0.04, x1: 0.97, y1: 0.4 },
        { k: "zebra", x0: 0.42, y0: 0.4, x1: 0.58, y1: 0.46 },
      ],
      tiers: [
        { r: T1, items: [["🍩", 48], ["⭐", 20], ["🔔", 16], ["🧤", 18, null, 2], ["🔑", 14], ["🍬", 16], ["🪙", 16]] },
        { r: T2, items: [["🧯", 14], ["⛑️", 12, "garage"], ["🥾", 12, null, 2], ["🔦", 10], ["🪣", 12], ["🧢", 10], ["📻", 8]] },
        { r: T3, items: [["🚨", 10], ["🪜", 8, "garage"], ["🛢️", 8, "lot"], ["🚧", 10], ["🚲", 6], ["🧺", 6], ["🚪", 1, { at: { pts: [[0.5, 0.32]] }, lock: "garage" }]] },
        { r: T4, items: [["🚓", 3, { ride: "yard" }], ["🚑", 3, { ride: "yard" }], ["🚗", 8, "lot"], ["🛵", 6], ["🚐", 6], ["🔴", 1, { press: "garage", at: { pts: [[0.13, 0.66]] } }]] },
        { r: T5, items: [["🏠", 4, "street"], ["🏪", 4], ["🚌", 4], ["🌳", 4]] },
      ],
      finale: { e: "🚒", r: 20, at: [0.5, 0.15], say: "the fire engine" },
    },
    {
      // A VEGGIE PATCH, and THE TWIST: little seedlings SPROUT carrots as
      // Gobble comes near, and the ripe tomatoes ROLL AWAY from him — corner
      // them! A stream runs across the garden; stepping stones cross it.
      id: "garden", name: "Veggie Patch", door: "🥕", color: "#ff9f1c",
      ground: "lawn", hole: "gobble",
      wear: ["straw", "#7cc95a"], air: ["petals"],
      backdrop: ["#eefde8", "#cdf1c2"],
      start: [0.5, 0.93], starters: 3,
      tune: [523.25, 587.33, 659.25, 783.99, 880],
      blocks: [
        { path: [[-0.02, 0.5], [0.18, 0.46], [0.38, 0.53], [0.6, 0.46], [0.82, 0.53], [1.02, 0.49]], w: 20, look: "water" },
      ],
      bridges: [
        { path: [[0.27, 0.6], [0.27, 0.4]], w: 13, look: "stones" },
        { path: [[0.72, 0.6], [0.72, 0.39]], w: 13, look: "stones" },
      ],
      zones: {
        veg: [[0.06, 0.6, 0.44, 0.76]],
        tomatoes: [[0.56, 0.6, 0.94, 0.78]],
        beds: [[0.06, 0.22, 0.36, 0.38], [0.64, 0.22, 0.94, 0.38]],
        shed: [[0.04, 0.03, 0.26, 0.18], [0.74, 0.03, 0.96, 0.18]],
      },
      trails: [{ e: "🍓", to: [0.2, 0.86] }, { e: "🍓", to: [0.8, 0.86] }],
      decals: [
        { k: "soil", x0: 0.05, y0: 0.59, x1: 0.45, y1: 0.77 },
        { k: "soil", x0: 0.55, y0: 0.59, x1: 0.95, y1: 0.79 },
        { k: "crops", x0: 0.05, y0: 0.21, x1: 0.37, y1: 0.39, c: "#7cc95a" },
        { k: "crops", x0: 0.63, y0: 0.21, x1: 0.95, y1: 0.39, c: "#e9c46a" },
        { k: "flowers", x: 0.5, y: 0.15, r: 0.1 },
        { k: "path", w: 10, pts: [[0.5, 1.02], [0.5, 0.82], [0.27, 0.66]] },
      ],
      tiers: [
        { r: T1, items: [["🍓", 46], ["🫐", 24, null, 4], ["🌼", 20, null, 4], ["🍒", 16, null, 2], ["🌰", 14], ["🍀", 12], ["🌱", 8, { sprout: [["🥕", 3, 2]], zone: "veg" }]] },
        { r: T2, items: [["🍅", 8, { run: true, zone: "tomatoes" }], ["🥒", 14, "beds"], ["🌶️", 10, "beds"], ["🧄", 12], ["🧅", 12], ["🥬", 12], ["🍋", 10]] },
        { r: T3, items: [["🥦", 10, "beds"], ["🌽", 10, "beds"], ["🍆", 8], ["🪴", 8], ["🪣", 8, "shed"], ["🧺", 6]] },
        { r: T4, items: [["🍉", 6], ["🎃", 4], ["🪑", 6], ["🌲", 8]] },
        { r: T5, items: [["🌳", 6], ["🛖", 4, "shed"], ["🏡", 3]] },
      ],
      finale: { e: "🌻", r: 20, at: [0.5, 0.17], say: "the giant sunflower" },
    },
    {
      // A PLAYGROUND, and THE TWIST: bouncy balls go BOING and knock Gobble
      // back until he is big enough to gulp them, footballs ROLL AWAY from
      // him, and the roundabout in the middle spins him round and round.
      id: "playground", name: "Playground", door: "🪁", color: "#ff7a59",
      ground: "rubber", hole: "gobble",
      wear: ["cap", "#ff9f1c"], air: ["leaves", "#f2a03d"],
      backdrop: ["#fff7e0", "#ffe2a8"],
      start: [0.5, 0.9], starters: 3,
      tune: [659.25, 783.99, 659.25, 523.25, 587.33, 659.25],
      land: [{ oval: [0.5, 0.5, 0.48, 0.47] }],
      flows: [{ spin: [0.5, 0.52, 0.1], v: 24, look: "turntable" }],
      zones: {
        field: [[0.1, 0.62, 0.42, 0.8]],
        court: [[0.58, 0.62, 0.9, 0.8]],
        sandpit: [[0.14, 0.24, 0.4, 0.4]],
        swings: [[0.6, 0.24, 0.86, 0.4]],
      },
      trails: [{ e: "🍭", to: [0.26, 0.84] }, { e: "🍭", to: [0.74, 0.84] }],
      decals: [
        { k: "court", x0: 0.57, y0: 0.61, x1: 0.91, y1: 0.81 },
        { k: "pitch", x0: 0.09, y0: 0.61, x1: 0.43, y1: 0.81 },
        { k: "patch", x: 0.27, y: 0.32, r: 0.13, c: "#f2d28a" },
        { k: "path", w: 9, pts: [[0.5, 0.98], [0.5, 0.66]] },
      ],
      tiers: [
        { r: T1, items: [["🍭", 44], ["🪙", 20], ["🍬", 22], ["⭐", 16], ["🧃", 14], ["🪀", 14, "swings"], ["🍪", 14, null, 2]] },
        { r: T2, items: [["⚽", 6, { run: true, zone: "field" }], ["🧸", 10], ["🪁", 10, "swings"], ["🎈", 12], ["🧢", 10], ["🥤", 10], ["🍿", 10], ["🛼", 8]] },
        { r: T3, items: [["🏀", 8, { bounce: true, zone: "court" }], ["🛴", 8], ["🛹", 8], ["🪣", 8, "sandpit"], ["🧺", 6], ["🏖️", 4, "sandpit"]] },
        { r: T4, items: [["🏐", 4, { bounce: true }], ["🚲", 6], ["🪑", 6], ["🌲", 8]] },
        { r: T5, items: [["🌳", 9], ["🛖", 5], ["🎪", 2], ["🎡", 2]] },
      ],
      finale: { e: "🎠", r: 20, at: [0.5, 0.15], say: "the merry-go-round" },
    },
    {
      // A RACE TRACK, wide, and THE TWIST: race cars zoom round and round,
      // lightning ⚡ power-ups make Gobble ZOOM too, and the oil drums and
      // petrol pumps by the pits are bumpers that go BOING until he is big
      // enough. The trophy waits on the winners' podium.
      id: "racetrack", name: "Race Track", door: "🏎️", color: "#e63946",
      ground: "tarmac", hole: "gobble",
      world: [560, 460],
      wear: ["cap", "#e63946"], air: ["confetti"],
      backdrop: ["#eef3f8", "#d6e0ea"],
      start: [0.5, 0.94], starters: 3,
      tune: [523.25, 659.25, 783.99, 1046.5, 783.99],
      tracks: { race: { pts: ovalPts(0.5, 0.56, 0.38, 0.27, 32), loop: true, speed: 16, look: "road" } },
      zones: {
        infield: [{ oval: [0.5, 0.56, 0.24, 0.13] }],
        pits: [[0.02, 0.3, 0.1, 0.82], [0.9, 0.3, 0.98, 0.82]],
        stands: [[0.12, 0.04, 0.38, 0.2], [0.62, 0.04, 0.88, 0.2]],
      },
      trails: [{ e: "🏁", to: [0.3, 0.9] }, { e: "🏁", to: [0.7, 0.9] }],
      decals: [
        { k: "podium", x0: 0.43, y0: 0.08, x1: 0.57, y1: 0.18 },
        { k: "zebra", x0: 0.47, y0: 0.78, x1: 0.53, y1: 0.88 },
        { k: "lot", x0: 0.01, y0: 0.3, x1: 0.11, y1: 0.82 },
        { k: "lot", x0: 0.89, y0: 0.3, x1: 0.99, y1: 0.82 },
        { k: "pitch", x0: 0.3, y0: 0.47, x1: 0.7, y1: 0.65 },
      ],
      tiers: [
        { r: T1, items: [["🏁", 34], ["⚡", 4, { power: "zoom" }], ["🪙", 28], ["⭐", 20], ["🔩", 20, "pits"], ["🍬", 16], ["🔑", 14], ["🧃", 14]] },
        { r: T2, items: [["🧢", 12, "stands"], ["🔧", 12, "pits"], ["🪛", 10, "pits"], ["🥤", 12], ["🎟️", 10, "stands"], ["🔋", 12], ["🧤", 10, null, 2]] },
        { r: T3, items: [["🛢️", 6, { bounce: true, zone: "pits" }], ["🚧", 10], ["🛴", 8], ["🚲", 8], ["🎈", 8, "infield"]] },
        { r: T4, items: [["🏎️", 5, { ride: "race" }], ["🚗", 7], ["🚙", 7], ["⛽", 4, { bounce: true }]] },
        { r: T5, items: [["🚚", 5], ["🚛", 4], ["🚌", 4], ["🏢", 3], ["🏟️", 2]] },
      ],
      finale: { e: "🏆", r: 20, at: [0.5, 0.12], say: "the giant trophy" },
    },
    {
      // UNDER THE SEA, and THE TWIST: CURRENTS sweep Gobble along the sea
      // floor, coral reefs stand in the way, and old treasure pots crack open
      // after three bumps, spilling coins and jewels. A sunken ship waits at
      // the top.
      id: "sea", name: "Under the Sea", door: "🔱", color: "#2b8a8a",
      ground: "seabed", hole: "gobble",
      world: [420, 640],
      wear: ["bubble", "#9fe3ff"], air: ["bubbles"],
      backdrop: ["#bfe9ff", "#5fb6e8"],
      start: [0.5, 0.93], starters: 3,
      tune: [392, 440, 523.25, 440, 392, 329.63],
      land: [{ circle: [0.5, 0.71, 0.47] }, { circle: [0.5, 0.31, 0.43] }, { oval: [0.5, 0.52, 0.45, 0.16] }],
      blocks: [
        { circle: [0.22, 0.52, 0.06], look: "coral" },
        { circle: [0.78, 0.55, 0.065], look: "coral" },
        { oval: [0.5, 0.4, 0.13, 0.035], look: "coral" },
        { circle: [0.3, 0.2, 0.045], look: "coral" },
        { circle: [0.7, 0.2, 0.045], look: "coral" },
      ],
      flows: [
        { pts: [[0.12, 0.82], [0.5, 0.7], [0.88, 0.82]], w: 24, v: 18, look: "current" },
        { pts: [[0.86, 0.46], [0.7, 0.3], [0.5, 0.25]], w: 22, v: 20, look: "current" },
      ],
      zones: {
        wreck: [[0.36, 0.04, 0.64, 0.16]],
        reef: [[0.08, 0.42, 0.34, 0.62], [0.66, 0.44, 0.92, 0.64]],
        deep: [[0.2, 0.26, 0.8, 0.36]],
      },
      trails: [{ e: "🪙", to: [0.26, 0.86] }, { e: "🪙", to: [0.74, 0.86] }],
      decals: [
        { k: "rockpool", x: 0.16, y: 0.72, r: 0.05 },
        { k: "rockpool", x: 0.84, y: 0.7, r: 0.05 },
        { k: "shade", x: 0.5, y: 0.31, r: 0.16 },
        { k: "stones", pts: [[0.5, 0.97], [0.47, 0.88], [0.53, 0.8], [0.5, 0.72]] },
      ],
      tiers: [
        { r: T1, items: [["🪙", 46], ["⭐", 22], ["💍", 16], ["🌿", 28, null, 4], ["🔑", 14], ["🧿", 16], ["🍬", 18]] },
        { r: T2, items: [["💎", 14], ["🧭", 12], ["🗝️", 12], ["⚓", 8], ["🪝", 10, "deep"], ["🥫", 10], ["🧴", 10], ["👑", 6, "wreck"]] },
        { r: T3, items: [["🗿", 6], ["🪨", 10, "reef"], ["🏮", 8], ["🎺", 8], ["🧳", 8], ["🪵", 10]] },
        { r: T4, items: [["🏺", 4, { shake: [["🪙", 4, 1], ["💎", 2, 2]], hits: 3 }], ["🛶", 8], ["🚤", 6], ["⛵", 8]] },
        { r: T5, items: [["🛥️", 5], ["⛴️", 4], ["🚢", 4], ["🏛️", 4]] },
      ],
      finale: { e: "🛳️", r: 20, at: [0.5, 0.15], say: "the sunken ship" },
    },
    {
      // A WATER PARK, and THE TWIST: rainbow water SLIDES whoosh Gobble down
      // over the pools, and water CANNONS blast him from one side of the park
      // to the other. The giant wave waits at the top.
      id: "waterpark", name: "Water Park", door: "💦", color: "#2fa3d9",
      ground: "pool", hole: "gobble",
      wear: ["straw", "#2fa3d9"], air: ["sparkles", "#d8f4ff"],
      backdrop: ["#e6f7ff", "#b9e6ff"],
      start: [0.5, 0.93], starters: 3,
      tune: [783.99, 659.25, 523.25, 659.25, 783.99, 1046.5],
      blocks: [
        { rect: [0.06, 0.34, 0.42, 0.5], round: 12, look: "water" },
        { rect: [0.58, 0.34, 0.94, 0.5], round: 12, look: "water" },
        { oval: [0.5, 0.22, 0.26, 0.05], look: "water" },
      ],
      bridges: [
        { path: [[0.24, 0.28], [0.24, 0.56]], w: 14, look: "rainbow" },
        { path: [[0.76, 0.28], [0.76, 0.56]], w: 14, look: "rainbow" },
      ],
      flows: [
        { pts: [[0.24, 0.28], [0.24, 0.56]], w: 14, v: 34, look: "slide" },
        { pts: [[0.76, 0.28], [0.76, 0.56]], w: 14, v: 34, look: "slide" },
      ],
      portals: [
        { a: [0.12, 0.7], b: [0.86, 0.12], oneway: true, fly: true },
        { a: [0.88, 0.7], b: [0.14, 0.12], oneway: true, fly: true },
      ],
      zones: {
        snacks: [[0.36, 0.56, 0.64, 0.68]],
        loungers: [[0.04, 0.76, 0.3, 0.9], [0.7, 0.76, 0.96, 0.9]],
        top: [[0.04, 0.03, 0.3, 0.16], [0.7, 0.03, 0.96, 0.16]],
      },
      trails: [{ e: "🍦", to: [0.3, 0.86] }, { e: "🍦", to: [0.7, 0.86] }],
      decals: [
        { k: "towel", x0: 0.05, y0: 0.8, x1: 0.15, y1: 0.86, c: "#ff6b6b" },
        { k: "towel", x0: 0.85, y0: 0.8, x1: 0.95, y1: 0.86, c: "#ffd24d" },
        { k: "puddle", x: 0.5, y: 0.78, r: 0.06 },
        { k: "mat", x0: 0.35, y0: 0.55, x1: 0.65, y1: 0.69, c: "#2fa3d9" },
      ],
      tiers: [
        { r: T1, items: [["🍦", 46], ["🍬", 22], ["🪙", 18], ["⭐", 18], ["🧃", 16], ["🍭", 16], ["🩱", 12], ["🕶️", 12]] },
        { r: T2, items: [["🩳", 12, null, 2], ["🩴", 12, null, 2], ["🧴", 12, "loungers"], ["🏐", 10], ["🥤", 10, "snacks"], ["🍔", 10, "snacks"], ["🍟", 10, "snacks"]] },
        { r: T3, items: [["🛶", 8], ["⛱️", 8, "loungers"], ["🍉", 10], ["🧺", 8], ["🚿", 6], ["🪣", 8]] },
        { r: T4, items: [["🚤", 5], ["🪑", 7, "loungers"], ["🌴", 9], ["⛵", 6]] },
        { r: T5, items: [["🏖️", 5], ["🎡", 2], ["🏨", 4], ["🛖", 5], ["🎢", 2]] },
      ],
      finale: { e: "🌊", r: 20, at: [0.5, 0.08], say: "the giant wave" },
    },
    {
      // A HARBOUR round a bay, and THE TWIST: the giant crane stands in the
      // crane yard behind a gate that needs THREE keys — one hidden on each
      // side of the harbour ("one of three!"). Boats sail round the bay and
      // stacks of shipping containers stand on the quay.
      id: "harbour", name: "Harbour", door: "⚓", color: "#1d3557",
      ground: "dock", hole: "gobble",
      wear: ["cap", "#1d3557", "#ffd24d"], air: ["clouds"],
      backdrop: ["#dff3ff", "#9fd3f0"],
      start: [0.5, 0.93], starters: 3,
      tune: [392, 523.25, 659.25, 587.33, 523.25],
      land: [{ rect: [0.02, 0.02, 0.98, 0.98], round: 30, not: { oval: [0.5, 0.46, 0.28, 0.17] } }],
      blocks: [
        // the crane yard, shut but for its gate
        { path: [[0.48, 0.22], [0.3, 0.22], [0.3, -0.02]], w: 5, look: "crates" },
        { path: [[0.52, 0.22], [0.7, 0.22], [0.7, -0.02]], w: 5, look: "crates" },
        // container stacks on the quay
        { rect: [0.06, 0.78, 0.2, 0.84], round: 2, look: "crates" },
        { rect: [0.8, 0.78, 0.94, 0.84], round: 2, look: "crates" },
        { rect: [0.06, 0.3, 0.14, 0.42], round: 2, look: "crates" },
        { rect: [0.86, 0.5, 0.94, 0.62], round: 2, look: "crates" },
      ],
      tracks: { bay: { pts: ovalPts(0.5, 0.46, 0.245, 0.14, 24), loop: true, speed: 7, look: "none" } },
      zones: {
        west: [[0.04, 0.46, 0.18, 0.7]],
        east: [[0.82, 0.24, 0.96, 0.46]],
        south: [[0.3, 0.8, 0.7, 0.88]],
        yard: [[0.33, 0.04, 0.67, 0.2]],
        quay: [[0.04, 0.04, 0.27, 0.22], [0.73, 0.04, 0.96, 0.22]],
      },
      trails: [{ e: "🪙", to: [0.24, 0.9] }, { e: "🪙", to: [0.76, 0.9] }],
      decals: [
        { k: "slab", x0: 0.31, y0: 0.02, x1: 0.69, y1: 0.21 },
        { k: "pallet", x0: 0.38, y0: 0.66, x1: 0.62, y1: 0.74 },
        { k: "lot", x0: 0.03, y0: 0.03, x1: 0.28, y1: 0.23 },
        { k: "lot", x0: 0.72, y0: 0.03, x1: 0.97, y1: 0.23 },
      ],
      tiers: [
        { r: T1, items: [["🪙", 44], ["⭐", 18], ["🍬", 16], ["🍦", 16], ["🥨", 14], ["🪝", 16], ["🔩", 14],
          ["🔑", 1, { key: "yard", zone: "west", glow: true }], ["🔑", 1, { key: "yard", zone: "east", glow: true }], ["🔑", 1, { key: "yard", zone: "south", glow: true }]] },
        { r: T2, items: [["🧭", 10], ["🪢", 12], ["🪣", 12], ["🧤", 10, null, 2], ["📦", 12, "quay"], ["🥫", 10], ["🗞️", 10]] },
        { r: T3, items: [["🛢️", 10, "quay"], ["🛶", 8], ["🧳", 8], ["🪵", 10, null, 2], ["🚲", 6], ["🚧", 1, { at: { pts: [[0.5, 0.22]] }, lock: "yard" }]] },
        { r: T4, items: [["⛵", 3, { ride: "bay" }], ["🚤", 3, { ride: "bay" }], ["🚗", 7], ["🏮", 7], ["🚐", 7]] },
        { r: T5, items: [["🚛", 5], ["🏭", 2, "yard"], ["🏠", 5], ["⛴️", 3], ["🛳️", 3]] },
      ],
      finale: { e: "🏗️", r: 20, at: [0.5, 0.1], say: "the big crane" },
    },
    {
      // A tall SKI MOUNTAIN, wide at the foot and narrow at the peak, and THE
      // TWIST: two ski SLOPES whoosh Gobble back down the mountain, a frozen
      // pond is slippery, and cable cars ride their wire up and down the side.
      // The snowman waits at the very top.
      id: "mountain", name: "Ski Mountain", door: "🏔️", color: "#2fa3d9",
      ground: "snow", hole: "gobble",
      wear: ["bobble", "#2fa3d9", "#ffffff"], air: ["snow"],
      backdrop: ["#eaf5ff", "#c6e0f7"],
      world: [420, 700],
      start: [0.5, 0.95], starters: 3,
      tune: [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25],
      land: [{ poly: [[0.02, 0.985], [0.98, 0.985], [0.94, 0.62], [0.78, 0.24], [0.66, 0.02], [0.34, 0.02], [0.22, 0.24], [0.06, 0.62]] }],
      blocks: [
        { circle: [0.38, 0.17, 0.035], look: "rock" },
        { circle: [0.64, 0.33, 0.04], look: "rock" },
        { circle: [0.3, 0.72, 0.035], look: "rock" },
      ],
      flows: [
        { pts: [[0.36, 0.2], [0.27, 0.36], [0.2, 0.56]], w: 22, v: 30, look: "ski" },
        { pts: [[0.7, 0.42], [0.8, 0.6], [0.84, 0.78]], w: 22, v: 30, look: "ski" },
      ],
      tracks: { cable: { pts: [[0.6, 0.78], [0.56, 0.12]], speed: 7, look: "wire" } },
      slide: ["pond"],
      zones: {
        pond: [{ circle: [0.48, 0.62, 0.13] }],
        lodge: [[0.08, 0.84, 0.36, 0.95], [0.64, 0.84, 0.92, 0.95]],
        forest: [[0.12, 0.42, 0.24, 0.6], [0.74, 0.22, 0.86, 0.4]],
        peak: [[0.36, 0.06, 0.64, 0.13]],
      },
      trails: [{ e: "❄️", to: [0.3, 0.88] }, { e: "❄️", to: [0.7, 0.88] }],
      decals: [
        { k: "ice", x: 0.48, y: 0.62, r: 0.13 },
        { k: "drift", x: 0.42, y: 0.4, r: 0.07 },
        { k: "drift", x: 0.2, y: 0.8, r: 0.07 },
        { k: "drift", x: 0.8, y: 0.12, r: 0.05 },
        { k: "tracks", c: "rgba(110,140,190,0.45)", pts: [[0.5, 0.94], [0.44, 0.8], [0.42, 0.5], [0.48, 0.3]] },
      ],
      tiers: [
        { r: T1, items: [["❄️", 50], ["🍪", 20, null, 3], ["☕", 16, null, 2], ["🧦", 16, null, 2], ["🔔", 14], ["🧊", 20, "pond", 4], ["🍫", 18], ["🥕", 12]] },
        { r: T2, items: [["🧤", 16, null, 2], ["🧣", 14], ["⛸️", 12, "pond"], ["🥌", 10, "pond"], ["🎒", 12], ["🥾", 12, null, 2], ["🧢", 10]] },
        { r: T3, items: [["🛷", 12], ["🎿", 12], ["🎄", 12, "forest"], ["🪵", 10, null, 2], ["🔦", 8], ["🏒", 8, "pond"]] },
        { r: T4, items: [["🚡", 3, { ride: "cable" }], ["🌲", 14, "forest"], ["🛖", 7, "lodge"], ["🚙", 6], ["⛺", 6]] },
        { r: T5, items: [["🏠", 6, "lodge"], ["🏡", 4], ["🏨", 3], ["🚌", 3], ["🚠", 3]] },
      ],
      finale: { e: "☃️", r: 20, at: [0.5, 0.09], say: "the snowman on the top" },
    },
    {
      // A HOLIDAY HOTEL, and THE TWIST: a wall runs right across the middle,
      // and only the two LIFTS go up a floor (step in at the bottom, step out
      // at the top — and back). Upstairs, the pool deck and the giant bell
      // sit behind a gate that only the big BUTTON in the lobby opens.
      id: "hotel", name: "Holiday Hotel", door: "🏨", color: "#c0392b",
      ground: "carpet", hole: "gobble",
      wear: ["tophat", "#c0392b", "#ffd24d"], air: ["sparkles", "#ffe9a8"],
      backdrop: ["#fff3e6", "#f7d9c0"],
      start: [0.5, 0.93], starters: 3,
      tune: [523.25, 659.25, 783.99, 659.25, 523.25, 392],
      blocks: [
        // the floor between the lobby and the rooms upstairs (the lifts are the only way up)
        { path: [[-0.02, 0.56], [1.02, 0.56]], w: 5, look: "wall" },
        // the pool deck upstairs, shut but for its gate
        { path: [[0.485, 0.24], [0.16, 0.24], [0.16, -0.02]], w: 5, look: "wall" },
        { path: [[0.515, 0.24], [0.84, 0.24], [0.84, -0.02]], w: 5, look: "wall" },
        // the rooms off the corridor
        { path: [[0.02, 0.38], [0.26, 0.38]], w: 4, look: "wall" },
        { path: [[0.74, 0.38], [0.98, 0.38]], w: 4, look: "wall" },
        // the reception desk in the lobby
        { rect: [0.4, 0.7, 0.6, 0.73], round: 2, look: "wall" },
        // the pool
        { oval: [0.66, 0.11, 0.1, 0.05], look: "water" },
      ],
      portals: [
        { a: [0.09, 0.88], b: [0.91, 0.49], look: "lift" },
        { a: [0.91, 0.88], b: [0.09, 0.49], look: "lift" },
      ],
      zones: {
        lobby: [[0.06, 0.62, 0.34, 0.8], [0.66, 0.62, 0.94, 0.8]],
        rooms: [[0.04, 0.27, 0.24, 0.36], [0.76, 0.27, 0.96, 0.36], [0.04, 0.4, 0.22, 0.53], [0.78, 0.4, 0.96, 0.53]],
        deck: [[0.2, 0.04, 0.5, 0.2]],
      },
      trails: [{ e: "🍬", to: [0.28, 0.9] }, { e: "🍬", to: [0.72, 0.9] }],
      decals: [
        { k: "rug", x: 0.5, y: 0.85, r: 0.14, pal: 2 },
        { k: "mat", x0: 0.3, y0: 0.4, x1: 0.7, y1: 0.53, c: "#c0392b" },
        { k: "towel", x0: 0.22, y0: 0.06, x1: 0.32, y1: 0.12, c: "#5ec8ff" },
        { k: "towel", x0: 0.36, y0: 0.06, x1: 0.46, y1: 0.12, c: "#ffd24d" },
      ],
      tiers: [
        { r: T1, items: [["🍬", 48], ["🍫", 21, null, 3], ["🧼", 16, null, 2], ["🪙", 18], ["🍪", 16], ["🔔", 14], ["🧦", 14, null, 2], ["🖊️", 12]] },
        { r: T2, items: [["🧸", 12], ["🪥", 12, null, 2], ["🕶️", 12, "deck"], ["🎀", 10], ["🧴", 12, "deck"], ["🥐", 14, "lobby"], ["👟", 10, null, 2]] },
        { r: T3, items: [["🧳", 12, "lobby"], ["🪴", 10], ["📺", 8, "rooms"], ["🖼️", 8, "rooms"], ["🧯", 6], ["🪑", 8], ["🚪", 1, { at: { pts: [[0.5, 0.24]] }, lock: "pool" }]] },
        { r: T4, items: [["🛏️", 8, "rooms"], ["🛋️", 7], ["🛒", 6, "lobby"], ["🎹", 3], ["⛱️", 4, "deck"], ["🔴", 1, { press: "pool", at: { pts: [[0.24, 0.66]] } }]] },
        { r: T5, items: [["🚕", 5], ["⛲", 3], ["🚌", 3], ["🎄", 3], ["🗿", 2]] },
      ],
      finale: { e: "🛎️", r: 20, at: [0.5, 0.1], say: "the giant hotel bell" },
    },
    {
      // ISLAND HOP: seven little islands in a bright sea, and THE TWIST:
      // CANNONS on the beaches blast Gobble over the water to the far
      // islands, rope bridges link the near ones, and beach balls ROLL AWAY
      // across the sand. A cannon on the palm-tree island blasts him home.
      id: "islands", name: "Island Hop", door: "🌅", color: "#ff9f1c",
      ground: "sand", hole: "gobble",
      wear: ["straw", "#ff9f1c"], air: ["sparkles", "#fff4c2"],
      backdrop: ["#c9f0ff", "#7fd0f5"],
      world: [504, 600],
      start: [0.5, 0.9], starters: 3,
      tune: [523.25, 587.33, 659.25, 783.99, 659.25, 523.25],
      land: [
        { circle: [0.5, 0.83, 0.26] },
        { circle: [0.14, 0.58, 0.13] },
        { circle: [0.86, 0.58, 0.13] },
        { circle: [0.5, 0.5, 0.14] },
        { circle: [0.2, 0.27, 0.19] },
        { circle: [0.8, 0.27, 0.19] },
        { circle: [0.5, 0.11, 0.16] },
      ],
      bridges: [
        { path: [[0.36, 0.74], [0.2, 0.62]], w: 12, look: "rope" },
        { path: [[0.64, 0.74], [0.8, 0.62]], w: 12, look: "rope" },
        { path: [[0.5, 0.7], [0.5, 0.55]], w: 12, look: "rope" },
        { path: [[0.27, 0.24], [0.4, 0.15]], w: 12, look: "rope" },
        { path: [[0.73, 0.24], [0.6, 0.15]], w: 12, look: "rope" },
      ],
      portals: [
        { a: [0.12, 0.56], b: [0.2, 0.3], oneway: true, fly: true },
        { a: [0.88, 0.56], b: [0.8, 0.3], oneway: true, fly: true },
        { a: [0.4, 0.06], b: [0.42, 0.84], oneway: true, fly: true },
      ],
      zones: {
        beach: [{ circle: [0.5, 0.83, 0.2] }],
        grove: [{ circle: [0.2, 0.27, 0.13] }, { circle: [0.8, 0.27, 0.13] }],
        huts: [{ circle: [0.5, 0.5, 0.1] }],
      },
      trails: [{ e: "🍦", to: [0.36, 0.86] }, { e: "🍦", to: [0.64, 0.86] }],
      decals: [
        { k: "towel", x0: 0.36, y0: 0.88, x1: 0.44, y1: 0.93, c: "#ff6b6b" },
        { k: "towel", x0: 0.56, y0: 0.88, x1: 0.64, y1: 0.93, c: "#5ec8ff" },
        { k: "rockpool", x: 0.14, y: 0.6, r: 0.04 },
        { k: "rockpool", x: 0.86, y: 0.6, r: 0.04 },
        { k: "footprints", pts: [[0.5, 0.96], [0.46, 0.86], [0.5, 0.76]] },
      ],
      tiers: [
        { r: T1, items: [["🍦", 44], ["⭐", 20], ["🍬", 18, null, 2], ["🪙", 18, null, 3], ["🧃", 14], ["🍓", 14, null, 2], ["🥥", 14]] },
        { r: T2, items: [["🏐", 6, { run: true, zone: "beach" }], ["🩴", 12, null, 2], ["🕶️", 12], ["🧴", 10], ["🍍", 12], ["🥭", 10], ["🪁", 10], ["🍹", 10]] },
        { r: T3, items: [["⛱️", 10, "beach"], ["🪣", 8], ["🛶", 8], ["🧺", 8], ["🪵", 10, null, 2], ["🗿", 6]] },
        { r: T4, items: [["🌳", 10, "grove"], ["⛵", 5], ["🚤", 5], ["🏰", 4, "beach"]] },
        { r: T5, items: [["🛖", 7, "huts"], ["🏖️", 5], ["🏝️", 3], ["⛴️", 3]] },
      ],
      finale: { e: "🌴", r: 20, at: [0.5, 0.1], say: "the giant palm tree" },
    },
    {
      // DESERT DUNES, a WIDE desert, and THE TWIST: QUICKSAND pools he must
      // walk round, the dunes get bigger the further he goes (the things
      // along the way grow with him), and tumbling rocks ROLL AWAY across
      // the sand. The giant cactus stands at the far end.
      id: "desert", name: "Desert Dunes", door: "🏜️", color: "#e0a24a",
      ground: "desert", hole: "gobble",
      wear: ["explorer", "#c98a3a"], air: ["dust"],
      backdrop: ["#fff3d6", "#f7d9a0"],
      world: [560, 460],
      start: [0.07, 0.8], starters: 3,
      tune: [440, 523.25, 587.33, 659.25, 587.33, 440],
      land: [{ rect: [0.02, 0.03, 0.98, 0.97], round: 40 }],
      blocks: [
        { oval: [0.22, 0.42, 0.07, 0.12], look: "quicksand" },
        { oval: [0.4, 0.72, 0.08, 0.1], look: "quicksand" },
        { oval: [0.56, 0.32, 0.07, 0.14], look: "quicksand" },
        { oval: [0.74, 0.68, 0.06, 0.11], look: "quicksand" },
      ],
      zones: {
        near: [{ band: [0, 0.3] }],
        mid: [{ band: [0.3, 0.65] }],
        far: [{ band: [0.65, 1] }],
        oasis: [[0.04, 0.1, 0.16, 0.34]],
        camp: [[0.3, 0.08, 0.46, 0.24]],
        rocks: [[0.6, 0.78, 0.84, 0.94]],
      },
      trails: [{ e: "🌰", to: [0.24, 0.84] }, { e: "🌰", to: [0.16, 0.6] }],
      decals: [
        { k: "drift", x: 0.32, y: 0.3, r: 0.07, c: "#f2c98a" },
        { k: "drift", x: 0.66, y: 0.5, r: 0.08, c: "#f2c98a" },
        { k: "pond", x: 0.1, y: 0.22, r: 0.05 },
        { k: "footprints", pts: [[0.05, 0.86], [0.2, 0.9], [0.34, 0.86], [0.5, 0.88]] },
        { k: "stones", pts: [[0.62, 0.86], [0.7, 0.88], [0.8, 0.86]] },
      ],
      tiers: [
        { r: T1, items: [["🌰", 46], ["🪙", 22, "near"], ["🍬", 16], ["💎", 14, null, 2], ["🥜", 18, null, 3], ["🧃", 14], ["🍪", 16]] },
        { r: T2, items: [["🧭", 12, "near"], ["🍉", 12, "oasis"], ["🥥", 10, "oasis"], ["🗝️", 10], ["🎒", 12], ["🕶️", 12], ["🧢", 10], ["🍯", 10]] },
        { r: T3, items: [["🪨", 6, { run: true, zone: "rocks" }], ["🛢️", 8, "mid"], ["🏺", 10, "mid"], ["🪣", 8], ["⚱️", 8], ["🗿", 6, "mid"], ["🌿", 10, "oasis", 2]] },
        { r: T4, items: [["⛺", 8, "camp"], ["🛻", 6, "far"], ["🚙", 6, "far"], ["🌳", 6, "oasis"], ["🌴", 4, "oasis"]] },
        { r: T5, items: [["🏰", 3, "far"], ["🛖", 6, "far"], ["🚚", 4, "far"], ["🚌", 4]] },
      ],
      finale: { e: "🌵", r: 20, at: [0.9, 0.2], say: "the giant cactus" },
    },
    {
      // CAMPING NIGHT, and THE TWIST: it is NIGHT — only the ground round
      // Gobble is lit, and the lanterns, torches and stars glow so he can find
      // his way. Canoes paddle round the lake in the middle. The campsite and
      // its big fire wait at the top.
      id: "camp", name: "Camping Night", door: "⛺", color: "#5a7a3a",
      ground: "grass", hole: "gobble",
      wear: ["explorer", "#5a7a3a"], air: ["fireflies"],
      backdrop: ["#10182b", "#1d2b44"],
      dark: true,
      start: [0.5, 0.92], starters: 3,
      tune: [392, 329.63, 392, 440, 392, 329.63],
      land: [{ rect: [0.02, 0.02, 0.98, 0.98], round: 40 }],
      blocks: [
        { oval: [0.5, 0.47, 0.25, 0.11], look: "water" },
        { circle: [0.16, 0.72, 0.05], look: "water" },
      ],
      tracks: { lake: { pts: ovalPts(0.5, 0.47, 0.2, 0.075, 28), loop: true, speed: 7, look: "none" } },
      zones: {
        tents: [[0.06, 0.08, 0.3, 0.26], [0.7, 0.08, 0.94, 0.26]],
        woods: [[0.04, 0.3, 0.2, 0.62], [0.8, 0.3, 0.96, 0.62]],
        fire: [[0.36, 0.62, 0.64, 0.74]],
        cars: [[0.66, 0.78, 0.94, 0.92]],
      },
      trails: [{ e: "🌰", to: [0.3, 0.9] }, { e: "🌰", to: [0.7, 0.9] }],
      decals: [
        { k: "patch", x: 0.5, y: 0.68, r: 0.1, c: "#6b4a2a" },
        { k: "path", w: 9, pts: [[0.5, 1.02], [0.5, 0.8], [0.5, 0.66]] },
        { k: "path", w: 8, pts: [[0.24, 0.3], [0.24, 0.62], [0.5, 0.82]] },
        { k: "lot", x0: 0.65, y0: 0.77, x1: 0.95, y1: 0.93 },
        { k: "flowers", x: 0.12, y: 0.88, r: 0.07 },
      ],
      tiers: [
        { r: T1, items: [["🌰", 46], ["⭐", 22, { glow: true }], ["🍫", 18, null, 3], ["🍪", 16, null, 2], ["🍄", 20, "woods", 4], ["🫐", 16, null, 4], ["🍂", 14]] },
        { r: T2, items: [["🔦", 12, { glow: true }], ["🥾", 12, null, 2], ["🧭", 10], ["🎒", 12, "tents"], ["🥫", 12], ["🧢", 10], ["🍢", 10], ["🎣", 8]] },
        { r: T3, items: [["🏮", 12, { glow: true }], ["🪵", 12, "fire", 2], ["🪣", 8], ["🧺", 8], ["🎸", 6, "fire"], ["🪑", 8, "fire"]] },
        { r: T4, items: [["🛶", 3, { ride: "lake" }], ["⛺", 10, "tents"], ["🌲", 12, "woods"], ["🚙", 4, "cars"]] },
        { r: T5, items: [["🌳", 6], ["🚐", 4, "cars"], ["🛖", 4], ["🚌", 3]] },
      ],
      finale: { e: "🏕️", r: 20, at: [0.5, 0.12], say: "the campsite" },
    },
    {
      // DINO DIG, and THE TWIST: sticky TAR pits to walk round, big rocks
      // that CRACK OPEN after three bumps and spill old bones and gems, and a
      // wall of boulders round the nest that Gobble can only eat through once
      // he is big enough. The giant dinosaur egg sits in the nest at the top.
      id: "dino", name: "Dino Dig", door: "🦴", color: "#ff9f1c",
      ground: "dig", hole: "gobble",
      wear: ["hardhat", "#ff9f1c"], air: ["dust"],
      backdrop: ["#fff0d6", "#f5d2a0"],
      start: [0.5, 0.92], starters: 3,
      tune: [196, 261.63, 196, 293.66, 261.63, 196],
      land: [{ rect: [0.02, 0.02, 0.98, 0.98], round: 30 }],
      blocks: [
        { oval: [0.24, 0.58, 0.1, 0.06], look: "tar" },
        { oval: [0.76, 0.5, 0.11, 0.06], look: "tar" },
        { oval: [0.5, 0.72, 0.08, 0.04], look: "tar" },
        // the nest: a ring of rock with one gap, shut by boulders he eats through
        { path: [[0.42, 0.28], [0.22, 0.28], [0.22, -0.02]], w: 6, look: "rock" },
        { path: [[0.58, 0.28], [0.78, 0.28], [0.78, -0.02]], w: 6, look: "rock" },
      ],
      zones: {
        pit: [[0.06, 0.32, 0.4, 0.48], [0.6, 0.6, 0.94, 0.76]],
        camp: [[0.06, 0.8, 0.3, 0.94]],
        nest: [[0.26, 0.04, 0.74, 0.24]],
        trees: [[0.82, 0.06, 0.96, 0.4], [0.04, 0.06, 0.18, 0.28]],
      },
      trails: [{ e: "🦴", to: [0.3, 0.88] }, { e: "🦴", to: [0.7, 0.88] }],
      decals: [
        { k: "soil", x0: 0.06, y0: 0.32, x1: 0.4, y1: 0.48 },
        { k: "soil", x0: 0.6, y0: 0.6, x1: 0.94, y1: 0.76 },
        { k: "footprints", pts: [[0.5, 0.96], [0.56, 0.82], [0.5, 0.66], [0.56, 0.46], [0.5, 0.32]] },
        { k: "gravel", x: 0.5, y: 0.14, r: 0.12 },
        { k: "lot", x0: 0.05, y0: 0.79, x1: 0.31, y1: 0.95 },
      ],
      tiers: [
        { r: T1, items: [["🦴", 44], ["🍃", 20, null, 4], ["🌰", 18], ["🪙", 18, null, 3], ["⭐", 14], ["🍬", 14], ["🥜", 14, null, 2]] },
        { r: T2, items: [["🖌️", 12, "pit"], ["🧭", 10], ["🪣", 12, "pit"], ["⛏️", 12, "pit"], ["🔦", 10], ["🧢", 10], ["💎", 12], ["🥤", 10, "camp"]] },
        { r: T3, items: [["🪨", 9, { shake: [["🦴", 3, 1], ["💎", 1, 2]], hits: 3 }], ["🗺️", 8], ["🧳", 8, "camp"], ["🪵", 10, null, 2], ["🏺", 8, "nest"], ["🌿", 10, "trees", 2]] },
        { r: T4, items: [["⛰️", 5, { at: { line: [[0.43, 0.28], [0.57, 0.28]] }, solid: true }], ["🌴", 9, "trees"], ["⛺", 6, "camp"], ["🚜", 5], ["🛻", 5], ["🌳", 6]] },
        { r: T5, items: [["🌋", 3], ["🚛", 4], ["🚚", 4], ["🛖", 6]] },
      ],
      finale: { e: "🥚", r: 20, at: [0.5, 0.12], say: "the giant dinosaur egg" },
    },
    {
      // A GOLD MINE, and THE TWIST: mine carts rattle round a railway through
      // the rock tunnels — eat the train car by car from the back — and red
      // MAGNETS give Gobble a super slurp that pulls the gold in. The giant
      // diamond glitters in the deepest cave at the top.
      id: "mine", name: "Gold Mine", door: "⛏️", color: "#ffc93c",
      ground: "mine", hole: "gobble",
      wear: ["hardhat", "#ffc93c"], air: ["sparkles", "#ffe9a8"],
      backdrop: ["#2a2118", "#3d3022"],
      world: [420, 620],
      start: [0.5, 0.93], starters: 3,
      tune: [293.66, 349.23, 440, 349.23, 293.66, 220],
      land: [{ rect: [0.02, 0.02, 0.98, 0.98], round: 30 }],
      blocks: [
        { rect: [0.28, 0.42, 0.72, 0.58], round: 10, look: "rock" },
        { rect: [0.02, 0.2, 0.14, 0.34], round: 6, look: "rock" },
        { rect: [0.86, 0.62, 0.98, 0.76], round: 6, look: "rock" },
        { circle: [0.2, 0.8, 0.05], look: "rock" },
        { circle: [0.8, 0.22, 0.05], look: "rock" },
        // the deep cave at the top, open at both sides
        { path: [[0.18, 0.2], [0.42, 0.2]], w: 6, look: "rock" },
        { path: [[0.58, 0.2], [0.82, 0.2]], w: 6, look: "rock" },
      ],
      tracks: { rail: { pts: [[0.2, 0.34], [0.8, 0.34], [0.8, 0.68], [0.2, 0.68]], loop: true, speed: 10, look: "rails", train: true } },
      zones: {
        gold: [[0.36, 0.62, 0.64, 0.66], [0.06, 0.38, 0.22, 0.6]],
        tools: [[0.06, 0.74, 0.3, 0.9]],
        shed: [[0.7, 0.8, 0.94, 0.94]],
        cave: [[0.22, 0.04, 0.78, 0.17]],
      },
      trails: [{ e: "🪙", to: [0.3, 0.9] }, { e: "🪙", to: [0.7, 0.9] }],
      decals: [
        { k: "gravel", x: 0.18, y: 0.5, r: 0.08 },
        { k: "gravel", x: 0.84, y: 0.44, r: 0.07 },
        { k: "puddle", x: 0.5, y: 0.78, r: 0.04 },
        { k: "slab", x0: 0.69, y0: 0.79, x1: 0.95, y1: 0.95 },
        { k: "patch", x: 0.5, y: 0.1, r: 0.12, c: "#5b4a3a" },
      ],
      tiers: [
        { r: T1, items: [["🪙", 50], ["🧲", 3, { power: "magnet" }], ["💍", 14], ["🪨", 20, null, 4], ["⭐", 16, "gold", 2], ["🔩", 16, "tools", 2], ["🍪", 12], ["🔑", 10]] },
        { r: T2, items: [["🚃", 5, { ride: "rail" }], ["⛏️", 12, "tools"], ["🔦", 10], ["🪣", 12], ["🥫", 10], ["🧭", 10], ["🗝️", 10], ["👑", 6, "cave"], ["🧤", 10, null, 2]] },
        { r: T3, items: [["🚂", 1, { ride: "rail" }], ["🧰", 10, "tools"], ["💰", 10, "gold"], ["🛢️", 8, "shed"], ["🪵", 10, null, 2], ["🏮", 8], ["⚱️", 8]] },
        { r: T4, items: [["⛰️", 8], ["🛖", 6, "shed"], ["🚜", 4], ["🛻", 5], ["🚙", 5], ["🗿", 4]] },
        { r: T5, items: [["🚛", 4], ["🏭", 3], ["🗻", 3], ["🏚️", 4], ["🚚", 3]] },
      ],
      finale: { e: "💎", r: 20, at: [0.5, 0.1], say: "the giant diamond" },
    },
    {
      // A MAGIC FOREST, and THE TWIST: giant spotty MUSHROOMS go BOING and
      // bounce Gobble back until he is big enough to gulp them, magic seeds
      // SPROUT flowers as he passes, and fallen LOGS lie across the paths.
      // The giant tree waits in the glade at the top.
      id: "forest", name: "Magic Forest", door: "🍄", color: "#2fae6b",
      ground: "forest", hole: "gobble",
      wear: ["wizard", "#2fae6b"], air: ["fireflies"],
      backdrop: ["#e3f7e6", "#b5e3bf"],
      start: [0.5, 0.92], starters: 3,
      tune: [659.25, 783.99, 880, 783.99, 659.25, 587.33],
      land: [{ oval: [0.5, 0.5, 0.48, 0.48] }],
      blocks: [
        { path: [[0.12, 0.62], [0.36, 0.56]], w: 7, look: "logs" },
        { path: [[0.64, 0.42], [0.88, 0.36]], w: 7, look: "logs" },
        { path: [[0.3, 0.3], [0.46, 0.36]], w: 6, look: "logs" },
        { path: [[0.58, 0.72], [0.76, 0.78]], w: 6, look: "logs" },
      ],
      zones: {
        glade: [{ circle: [0.5, 0.52, 0.14] }],
        rings: [[0.14, 0.7, 0.4, 0.84], [0.6, 0.2, 0.86, 0.32]],
        woods: [[0.08, 0.32, 0.26, 0.5], [0.74, 0.5, 0.92, 0.68]],
        cottage: [[0.62, 0.84, 0.82, 0.94]],
      },
      trails: [{ e: "🍓", to: [0.3, 0.88] }, { e: "🍓", to: [0.7, 0.88] }],
      decals: [
        { k: "flowers", x: 0.5, y: 0.52, r: 0.12 },
        { k: "flowers", x: 0.22, y: 0.2, r: 0.07 },
        { k: "path", w: 9, pts: [[0.5, 0.99], [0.44, 0.8], [0.52, 0.64], [0.46, 0.4], [0.5, 0.2]] },
        { k: "shade", x: 0.17, y: 0.42, r: 0.12 },
        { k: "shade", x: 0.83, y: 0.6, r: 0.12 },
      ],
      tiers: [
        { r: T1, items: [["🍓", 44], ["🫐", 20, null, 4], ["🌰", 18], ["🍀", 14, null, 2], ["⭐", 16], ["🍯", 12], ["🌱", 8, { sprout: [["🌷", 3, 1]], zone: "glade" }]] },
        { r: T2, items: [["🪄", 10], ["🎀", 10], ["🧺", 10], ["🍎", 12, null, 2], ["🍐", 10], ["🌿", 12, null, 2], ["🔔", 10], ["🗝️", 10]] },
        { r: T3, items: [["🍄", 8, { bounce: true, zone: "rings" }], ["🪵", 10, null, 2], ["🪨", 8], ["🏺", 6], ["🧸", 8], ["🪑", 8]] },
        { r: T4, items: [["🌲", 14, "woods"], ["🛖", 6], ["⛲", 4], ["🗿", 4]] },
        { r: T5, items: [["🏰", 3], ["🏡", 5, "cottage"], ["🗻", 3], ["🏯", 3], ["🚂", 3]] },
      ],
      finale: { e: "🌳", r: 20, at: [0.5, 0.12], say: "the giant tree" },
    },
    {
      // A LOST TEMPLE in the jungle, ringed by a moat, and THE TWIST: the
      // golden door of the inner temple needs ALL THREE stone buttons pressed
      // — one hidden on each side of the moat and one in the courtyard ("one
      // of three!"). Stone bridges cross the moat. The golden vase is inside.
      id: "temple", name: "Lost Temple", door: "🏛️", color: "#c9a24a",
      ground: "temple", hole: "gobble",
      wear: ["explorer", "#c9a24a"], air: ["leaves", "#7cc95a"],
      backdrop: ["#eef7df", "#cfe6b0"],
      world: [440, 620],
      start: [0.5, 0.93], starters: 3,
      tune: [293.66, 392, 440, 523.25, 440, 293.66],
      land: [{ rect: [0.02, 0.02, 0.98, 0.98], round: 36 }],
      blocks: [
        { ring: [0.5, 0.44, 0.34, 0.4], look: "water" },
        // the inner temple, shut but for its golden door
        { path: [[0.485, 0.38], [0.26, 0.38], [0.26, 0.22]], w: 5, look: "wall" },
        { path: [[0.515, 0.38], [0.74, 0.38], [0.74, 0.22]], w: 5, look: "wall" },
      ],
      bridges: [
        { path: [[0.5, 0.67], [0.5, 0.59]], w: 16, look: "stone" },
        { path: [[0.05, 0.44], [0.2, 0.44]], w: 14, look: "stone" },
        { path: [[0.95, 0.44], [0.8, 0.44]], w: 14, look: "stone" },
      ],
      zones: {
        court: [[0.32, 0.44, 0.68, 0.58]],
        jungle: [[0.04, 0.62, 0.3, 0.86], [0.7, 0.62, 0.96, 0.86]],
        ruins: [[0.04, 0.04, 0.2, 0.2], [0.8, 0.04, 0.96, 0.2]],
      },
      trails: [{ e: "🪙", to: [0.3, 0.9] }, { e: "🪙", to: [0.7, 0.9] }],
      decals: [
        { k: "slab", x0: 0.34, y0: 0.42, x1: 0.66, y1: 0.58 },
        { k: "stones", pts: [[0.5, 0.96], [0.5, 0.8], [0.5, 0.66]] },
        { k: "shade", x: 0.15, y: 0.74, r: 0.12 },
        { k: "shade", x: 0.85, y: 0.74, r: 0.12 },
        { k: "gravel", x: 0.12, y: 0.12, r: 0.07 },
      ],
      tiers: [
        { r: T1, items: [["🪙", 48], ["💍", 14], ["🍃", 18, null, 4], ["🍌", 14, null, 2], ["⭐", 14], ["🍬", 14], ["🌰", 16]] },
        { r: T2, items: [["🗝️", 10], ["🧭", 10], ["🔦", 10], ["📜", 12], ["👑", 8, "court"], ["🍍", 10, "jungle"], ["🥥", 10, "jungle"], ["💎", 10, "court"]] },
        { r: T3, items: [["⚱️", 10, "ruins"], ["🗺️", 8], ["🪵", 8, null, 2], ["🏮", 8], ["🧳", 6], ["🪨", 8], ["🚪", 1, { at: { pts: [[0.5, 0.38]] }, lock: "door" }]] },
        { r: T4, items: [["🌴", 12, "jungle"], ["🗿", 6], ["🛶", 4], ["⛩️", 4], ["🌳", 4], ["🔴", 3, { press: "door", at: { pts: [[0.08, 0.74], [0.92, 0.74], [0.5, 0.52]] } }]] },
        { r: T5, items: [["🏯", 3], ["🛕", 3], ["🗻", 3], ["🌋", 2], ["⛲", 3, "court"], ["⛰️", 3]] },
      ],
      finale: { e: "🏺", r: 20, at: [0.5, 0.33], say: "the golden vase" },
    },
    {
      // PINBALL PARTY: Gobble is the ball in a giant pinball table, and THE
      // TWIST: BUMPERS everywhere go BOING and knock him back until he is big
      // enough to gulp them, the PLUNGER cannon in the corner shoots him to
      // the top of the table, and a spinner disc whirls him round.
      id: "pinball", name: "Pinball Party", door: "🕹️", color: "#ff3fa4",
      ground: "pinball", hole: "gobble",
      wear: ["propeller", "#ff3fa4"], air: ["stars"],
      backdrop: ["#1b1035", "#2e1a55"],
      world: [420, 620],
      start: [0.4, 0.92], starters: 3,
      tune: [523.25, 783.99, 659.25, 1046.5, 783.99, 1318.51],
      land: [{ poly: [[0.04, 0.98], [0.96, 0.98], [0.96, 0.2], [0.8, 0.03], [0.2, 0.03], [0.04, 0.2]] }],
      blocks: [
        // the two flipper lanes at the bottom
        { path: [[0.06, 0.74], [0.3, 0.84]], w: 6, look: "wall" },
        { path: [[0.82, 0.74], [0.58, 0.84]], w: 6, look: "wall" },
        // the plunger lane up the right side
        { path: [[0.86, 0.98], [0.86, 0.36]], w: 5, look: "wall" },
      ],
      portals: [{ a: [0.92, 0.92], b: [0.5, 0.2], oneway: true, fly: true }],
      flows: [{ spin: [0.42, 0.58, 0.09], v: 26, look: "record" }],
      zones: {
        bumpers: [[0.12, 0.26, 0.76, 0.42]],
        lanes: [[0.08, 0.46, 0.2, 0.7], [0.66, 0.46, 0.8, 0.7]],
        drain: [[0.34, 0.86, 0.5, 0.95]],
        lane: [[0.88, 0.4, 0.96, 0.88]],
      },
      trails: [{ e: "🪙", to: [0.2, 0.92] }, { e: "🪙", to: [0.66, 0.92] }],
      decals: [
        { k: "stripes", x0: 0.08, y0: 0.46, x1: 0.2, y1: 0.7 },
        { k: "stripes", x0: 0.66, y0: 0.46, x1: 0.8, y1: 0.7 },
        { k: "splat", x: 0.3, y: 0.66, r: 0.04, c: "#ffd24d" },
        { k: "splat", x: 0.6, y: 0.3, r: 0.04, c: "#5ec8ff" },
        { k: "heart", x: 0.42, y: 0.12, r: 0.06 },
      ],
      tiers: [
        { r: T1, items: [["🪙", 48], ["⭐", 20, null, 2], ["🍬", 18], ["🍭", 14], ["🎟️", 16, null, 2], ["🔔", 12], ["🧩", 14, null, 2]] },
        { r: T2, items: [["🎲", 12, null, 2], ["🍿", 12], ["🎈", 12], ["🪀", 10, "lane"], ["🎮", 10], ["🎳", 10], ["🧸", 10], ["🥤", 8]] },
        { r: T3, items: [["🔵", 8, { bounce: true, zone: "bumpers" }], ["🎯", 8], ["🎰", 6, "lanes"], ["🥁", 6], ["🎸", 6], ["🛴", 8], ["🪁", 8]] },
        { r: T4, items: [["🟡", 4, { bounce: true, zone: "bumpers" }], ["🚀", 6], ["🤖", 6], ["🎪", 4], ["🚗", 6, "lanes"], ["🛸", 4]] },
        { r: T5, items: [["🎡", 3], ["🎢", 3], ["🏟️", 3], ["🚌", 4], ["🚂", 4]] },
      ],
      finale: { e: "🎱", r: 20, at: [0.5, 0.12], say: "the giant pinball" },
    },
    {
      // A GIANT MOON BASE (§17 giant: six sizes, a giant finale), and THE
      // TWIST: great CRATERS to walk round — a huge one cuts the moon nearly
      // in half — and CANNONS that blast Gobble right over them in a low-
      // gravity jump. Moon boots make him ZOOM. The flying saucer waits on the
      // far side.
      id: "moon", name: "Moon Base", door: "🌙", color: "#8a8fa8",
      ground: "moon", hole: "gobble",
      world: [504, 706],
      wear: ["bubble", "#ffffff"], air: ["stars"],
      backdrop: ["#05061a", "#161a3a"],
      start: [0.5, 0.92], starters: 3,
      tune: [261.63, 392, 523.25, 392, 659.25, 523.25],
      land: [{ oval: [0.5, 0.5, 0.48, 0.48] }],
      blocks: [
        { oval: [0.5, 0.36, 0.34, 0.06], look: "crater" },
        { circle: [0.24, 0.66, 0.08], look: "crater" },
        { circle: [0.76, 0.62, 0.09], look: "crater" },
        { circle: [0.5, 0.78, 0.05], look: "crater" },
        { circle: [0.3, 0.16, 0.05], look: "crater" },
      ],
      portals: [
        { a: [0.5, 0.48], b: [0.5, 0.24], oneway: true, fly: true },
        { a: [0.22, 0.48], b: [0.3, 0.26], oneway: true, fly: true },
        { a: [0.78, 0.48], b: [0.7, 0.26], oneway: true, fly: true },
      ],
      zones: {
        base: [[0.34, 0.84, 0.66, 0.94]],
        dome: [[0.06, 0.4, 0.2, 0.56], [0.8, 0.4, 0.94, 0.56]],
        far: [[0.2, 0.06, 0.8, 0.22]],
        rocks: [{ circle: [0.24, 0.66, 0.13] }, { circle: [0.76, 0.62, 0.14] }],
      },
      trails: [{ e: "⭐", to: [0.32, 0.88] }, { e: "⭐", to: [0.68, 0.88] }],
      decals: [
        { k: "nebula", x: 0.2, y: 0.25, r: 0.3, c: "rgba(94,200,255,0.12)" },
        { k: "footprints", pts: [[0.5, 0.96], [0.44, 0.86], [0.5, 0.74], [0.44, 0.6], [0.5, 0.5]] },
        { k: "helipad", x: 0.5, y: 0.48, r: 0.04 },
        { k: "station", x0: 0.36, y0: 0.84, x1: 0.64, y1: 0.93 },
        { k: "gravel", x: 0.8, y: 0.84, r: 0.06 },
      ],
      tiers: [
        { r: T1, items: [["⭐", 52], ["🪨", 24, "rocks", 4], ["🧀", 18, null, 3], ["🔩", 16], ["🔋", 14], ["💎", 16, null, 2], ["🍬", 14], ["🪙", 14]] },
        { r: T2, items: [["🥾", 3, { power: "zoom" }], ["📡", 12, "dome"], ["🔭", 10], ["🧪", 12, "base"], ["🔦", 10], ["🛰️", 12], ["🎒", 10], ["☄️", 14, null, 2], ["🧃", 10]] },
        { r: T3, items: [["🚀", 8], ["🤖", 10, "base"], ["🧰", 8], ["🛢️", 8], ["📦", 10, null, 2], ["🔬", 8]] },
        { r: T4, items: [["🚙", 8], ["🚁", 6], ["⛺", 6, "dome"], ["🚜", 4], ["🛻", 4]] },
        { r: T5, items: [["🏭", 4], ["🛖", 5], ["🚛", 4], ["🚌", 3], ["🏗️", 3]] },
        { r: T6, items: [["🪐", 4, "far"], ["🌍", 2], ["🗻", 3], ["🌋", 3]] },
      ],
      finale: { e: "🛸", r: 28, at: [0.5, 0.12], say: "the flying saucer" },
    },
    {
      // TRAIN TOWN, a model railway town, and THE TWIST: trains everywhere —
      // a goods train to gobble car by car from the back, little trams going
      // round and round the town, a river with railway bridges, and TUNNELS
      // that pop Gobble out on the other side. The big steam train is in the
      // station at the top.
      id: "trainland", name: "Train Town", door: "🚂", color: "#1d3557",
      ground: "felt", hole: "gobble",
      wear: ["cap", "#1d3557", "#e63946"], air: ["clouds"],
      backdrop: ["#e8f4ff", "#c8e0f5"],
      world: [480, 640],
      start: [0.5, 0.94], starters: 3,
      tune: [392, 392, 523.25, 523.25, 659.25, 783.99],
      land: [{ rect: [0.02, 0.02, 0.98, 0.98], round: 30 }],
      blocks: [{ rect: [-0.02, 0.48, 1.02, 0.54], look: "water" }],
      bridges: [
        { path: [[0.3, 0.45], [0.3, 0.57]], w: 16, look: "planks" },
        { path: [[0.7, 0.45], [0.7, 0.57]], w: 16, look: "planks" },
      ],
      portals: [
        { a: [0.07, 0.62], b: [0.07, 0.4], look: "tunnel" },
        { a: [0.93, 0.62], b: [0.93, 0.4], look: "tunnel" },
      ],
      tracks: {
        goods: { pts: ovalPts(0.5, 0.75, 0.36, 0.11, 32), loop: true, speed: 10, look: "rails", train: true },
        tram: { pts: ovalPts(0.5, 0.29, 0.32, 0.1, 30), loop: true, speed: 8, look: "rails" },
      },
      zones: {
        town: [[0.08, 0.06, 0.3, 0.18], [0.7, 0.06, 0.92, 0.18]],
        yard: [[0.38, 0.69, 0.62, 0.81]],
        park: [[0.4, 0.24, 0.6, 0.34]],
        farm: [[0.08, 0.84, 0.3, 0.95], [0.7, 0.84, 0.92, 0.95]],
      },
      trails: [{ e: "🎫", to: [0.3, 0.92] }, { e: "🎫", to: [0.7, 0.92] }],
      decals: [
        { k: "road", x0: 0.46, y0: 0.56, x1: 0.54, y1: 0.98 },
        { k: "park", x: 0.5, y: 0.29, r: 0.07 },
        { k: "lot", x0: 0.37, y0: 0.68, x1: 0.63, y1: 0.82 },
        { k: "slab", x0: 0.3, y0: 0.03, x1: 0.7, y1: 0.17 },
        { k: "crops", x0: 0.07, y0: 0.83, x1: 0.31, y1: 0.96, c: "#e9c46a" },
      ],
      tiers: [
        { r: T1, items: [["🎫", 50], ["🪙", 18, null, 3], ["🍬", 18], ["⭐", 14], ["🧃", 14], ["🍪", 14, null, 2], ["🔩", 14, "yard"], ["🥨", 14]] },
        { r: T2, items: [["🚃", 5, { ride: "goods" }], ["🧳", 12], ["🎒", 10], ["🗞️", 10], ["🧸", 10], ["⏰", 10], ["🎈", 10, "park"], ["🧢", 10]] },
        { r: T3, items: [["🚆", 1, { ride: "goods" }], ["🚦", 10], ["🚏", 8], ["🛤️", 8, "yard"], ["🧺", 6, "farm"], ["🚲", 8], ["🛴", 8], ["🪵", 8, "farm", 2]] },
        { r: T4, items: [["🚋", 4, { ride: "tram" }], ["🚗", 8], ["🚌", 5, "town"], ["🚕", 6], ["🌳", 6, "park"]] },
        { r: T5, items: [["🏠", 5, "farm"], ["🏢", 3, "town"], ["🏭", 3], ["🏪", 3, "town"], ["🚉", 3]] },
      ],
      finale: { e: "🚂", r: 20, at: [0.5, 0.1], say: "the big steam train" },
    },
    {
      // NUMBER LAND, shaped like a giant number 8, and THE TWIST: COUNTING —
      // every sock Gobble gulps counts on by TWOS ("two, four, six!"), the
      // socks and the chairs stand in neat rows, and big dice crack open after
      // three bumps. The giant abacus waits at the top of the 8.
      id: "numbers", name: "Number Land", door: "🔢", color: "#5ec8ff",
      ground: "grid", hole: "gobble",
      wear: ["propeller", "#5ec8ff"], air: ["stars"],
      backdrop: ["#eaf6ff", "#c4e4fb"],
      start: [0.5, 0.9], starters: 3,
      tune: [523.25, 587.33, 659.25, 698.46, 783.99, 880],
      count: { e: "🧦", by: 2, say: "socks" },
      land: [
        { ring: [0.5, 0.7, 0.12, 0.44] },
        { ring: [0.5, 0.29, 0.1, 0.38] },
        { oval: [0.5, 0.48, 0.22, 0.05] },
      ],
      zones: {
        toys: [[0.08, 0.6, 0.26, 0.78], [0.74, 0.6, 0.92, 0.78]],
        desk: [[0.12, 0.22, 0.3, 0.38], [0.7, 0.22, 0.88, 0.38]],
        town: [[0.2, 0.46, 0.36, 0.52], [0.64, 0.46, 0.8, 0.52]],
      },
      trails: [{ e: "⭐", to: [0.28, 0.86] }, { e: "⭐", to: [0.72, 0.86] }],
      decals: [
        { k: "mat", x0: 0.28, y0: 0.79, x1: 0.72, y1: 0.87, c: "#5ec8ff" },
        { k: "stripes", x0: 0.3, y0: 0.18, x1: 0.7, y1: 0.26 },
        { k: "splat", x: 0.16, y: 0.7, r: 0.04, c: "#ffd24d" },
        { k: "splat", x: 0.84, y: 0.68, r: 0.04, c: "#ff6b6b" },
      ],
      tiers: [
        { r: T1, items: [["🧦", 20, { at: { grid: [0.3, 0.8, 0.7, 0.86], cols: 10 } }], ["🧦", 14], ["⭐", 18], ["🍪", 16, null, 2], ["🍬", 16], ["🪙", 18, null, 3], ["🟢", 16], ["🧩", 14, "toys"]] },
        { r: T2, items: [["✏️", 12, "desk"], ["📏", 10, "desk"], ["🖍️", 12, null, 2], ["📐", 10], ["🧸", 10, "toys"], ["🎈", 10], ["⏰", 10], ["🧃", 10]] },
        { r: T3, items: [["🎲", 8, { shake: [["⭐", 3, 1], ["🍬", 2, 1]], hits: 3 }], ["📚", 10, "desk"], ["🎨", 8], ["🪁", 8], ["🥁", 6, "toys"], ["🧱", 8]] },
        { r: T4, items: [["🪑", 8, { at: { grid: [0.32, 0.2, 0.68, 0.24], cols: 4 } }], ["🎹", 4], ["📺", 6], ["🚲", 6], ["🧺", 6]] },
        { r: T5, items: [["🏫", 3], ["🏠", 5], ["🚌", 4, "town"], ["🎪", 3], ["🏢", 3, "town"]] },
      ],
      finale: { e: "🧮", r: 20, at: [0.5, 0.13], say: "the giant abacus" },
    },
    {
      // CHOCOLATE RIVER, and THE TWIST: a chocolate river winds right across
      // the land and carries Gobble along, gooey chocolate puddles and a
      // chocolate lake to walk round (a bridge crosses the lake), and magic
      // seeds SPROUT lollipops as he passes. The giant doughnut is on the far
      // side of the lake.
      id: "chocolate", name: "Chocolate River", door: "🍫", color: "#7a4424",
      ground: "biscuit", hole: "gobble",
      wear: ["chef", "#ffffff"], air: ["sprinkles"],
      backdrop: ["#fff0e0", "#f5d2a8"],
      world: [420, 620],
      start: [0.5, 0.93], starters: 3,
      tune: [523.25, 659.25, 587.33, 698.46, 659.25, 783.99],
      land: [{ rect: [0.02, 0.02, 0.98, 0.98], round: 36 }],
      blocks: [
        { oval: [0.5, 0.25, 0.24, 0.05], look: "choc" },
        { circle: [0.2, 0.78, 0.05], look: "choc" },
        { circle: [0.82, 0.36, 0.05], look: "choc" },
      ],
      bridges: [{ path: [[0.5, 0.19], [0.5, 0.31]], w: 16, look: "planks" }],
      flows: [{ pts: [[0.04, 0.38], [0.34, 0.46], [0.6, 0.58], [0.96, 0.66]], w: 24, v: 22, look: "choc" }],
      zones: {
        garden: [[0.06, 0.6, 0.34, 0.72], [0.64, 0.76, 0.92, 0.9]],
        shop: [[0.62, 0.42, 0.94, 0.52]],
        top: [[0.06, 0.04, 0.3, 0.18], [0.7, 0.04, 0.94, 0.18]],
      },
      trails: [{ e: "🍬", to: [0.3, 0.9] }, { e: "🍬", to: [0.7, 0.9] }],
      decals: [
        { k: "splat", x: 0.36, y: 0.82, r: 0.04, c: "#7a4424" },
        { k: "splat", x: 0.7, y: 0.28, r: 0.035, c: "#ff7ac0" },
        { k: "stripes", x0: 0.62, y0: 0.41, x1: 0.94, y1: 0.53 },
        { k: "flowers", x: 0.2, y: 0.66, r: 0.08 },
        { k: "path", w: 9, pts: [[0.5, 0.99], [0.46, 0.8], [0.5, 0.66]] },
      ],
      tiers: [
        { r: T1, items: [["🍬", 46], ["🍫", 21, null, 3], ["🍪", 18], ["🍭", 14], ["🍒", 16, null, 2], ["🌰", 14], ["⭐", 14], ["🌱", 8, { sprout: [["🍭", 3, 1]], zone: "garden" }]] },
        { r: T2, items: [["🧁", 14], ["🍦", 12], ["🥤", 10], ["🍯", 10], ["🍮", 10], ["🥨", 10], ["🍿", 10, "shop"], ["🎀", 10]] },
        { r: T3, items: [["🍰", 10], ["☕", 8, "shop"], ["🥧", 8], ["🍧", 8], ["🍨", 8], ["🎁", 8]] },
        { r: T4, items: [["🎂", 6], ["🛶", 4], ["🧸", 6], ["🎪", 4], ["🍉", 8]] },
        { r: T5, items: [["🏰", 3, "top"], ["🏠", 5], ["🏭", 3], ["🎡", 3], ["🚂", 3]] },
      ],
      finale: { e: "🍩", r: 20, at: [0.5, 0.1], say: "the giant doughnut" },
    },
    {
      // THE GIANT BEANSTALK (§17 giant: six sizes, a giant finale), a very
      // TALL world: a garden at the bottom, a beanstalk winding up past
      // clouds, and the giant's castle in the clouds at the top. THE TWIST:
      // everything gets BIGGER the higher he climbs, and magic seeds SPROUT
      // leaves and clover as he passes. The giant's boot waits at the top.
      id: "beanstalk", name: "Giant Beanstalk", door: "🌱", color: "#3fbf5f",
      ground: "cloud", hole: "gobble",
      world: [420, 840],
      wear: ["propeller", "#3fbf5f"], air: ["clouds"],
      backdrop: ["#e9f6ff", "#bfe1ff"],
      start: [0.5, 0.93], starters: 3,
      tune: [392, 440, 493.88, 523.25, 587.33, 659.25, 783.99],
      land: [
        { rect: [0.02, 0.8, 0.98, 0.99], round: 30 },
        { path: [[0.5, 0.84], [0.32, 0.72], [0.62, 0.6], [0.38, 0.48], [0.6, 0.36], [0.5, 0.22]], w: 84 },
        { oval: [0.2, 0.72, 0.18, 0.055] },
        { oval: [0.78, 0.6, 0.18, 0.055] },
        { oval: [0.22, 0.48, 0.18, 0.055] },
        { oval: [0.78, 0.36, 0.18, 0.05] },
        { oval: [0.5, 0.13, 0.48, 0.11] },
      ],
      zones: {
        low: [{ band: [0, 0.3] }],
        mid: [{ band: [0.3, 0.65] }],
        high: [{ band: [0.65, 1] }],
        garden: [[0.06, 0.82, 0.34, 0.96], [0.66, 0.82, 0.94, 0.96]],
        castle: [[0.1, 0.06, 0.32, 0.2], [0.68, 0.06, 0.9, 0.2]],
      },
      trails: [{ e: "🍃", to: [0.28, 0.92] }, { e: "🍃", to: [0.72, 0.92] }],
      decals: [
        { k: "crops", x0: 0.05, y0: 0.82, x1: 0.33, y1: 0.97, c: "#7cc95a" },
        { k: "path", w: 10, pts: [[0.5, 0.99], [0.5, 0.86]] },
        { k: "flowers", x: 0.8, y: 0.89, r: 0.07 },
        { k: "rug", x: 0.5, y: 0.13, r: 0.16, pal: 1 },
      ],
      tiers: [
        { r: T1, items: [["🍃", 44], ["🪙", 24, null, 3], ["⭐", 20], ["🍬", 16], ["🌼", 16, "garden", 4], ["🔔", 14], ["🍀", 12], ["🌱", 10, { sprout: [["🍀", 2, 1], ["🌿", 2, 2]], zone: "low" }]] },
        { r: T2, items: [["🌿", 12], ["🥚", 10, "mid"], ["🎻", 8], ["🧺", 10, "garden"], ["🥕", 12, "garden"], ["🍎", 12], ["🔑", 10], ["🧦", 10]] },
        { r: T3, items: [["🍄", 10, "mid"], ["🪣", 8], ["🌻", 8, "garden"], ["🥁", 6], ["🎺", 6], ["🧸", 8], ["🍞", 8, "mid"]] },
        { r: T4, items: [["🌲", 10, "high"], ["🛖", 5], ["🥄", 6, "high"], ["☕", 6, "high"], ["🧀", 6]] },
        { r: T5, items: [["🛏️", 3, "high"], ["🪑", 4, "high"], ["🕰️", 3, "high"], ["🫖", 4, "high"], ["👑", 3, "castle"]] },
        { r: T6, items: [["🏰", 3, "castle"], ["🌳", 3, "high"], ["🏡", 3, "high"], ["🗻", 2, "high"]] },
      ],
      finale: { e: "👢", r: 28, at: [0.5, 0.08], say: "the giant's boot" },
    },
  ];

  // What Gobble says (when sound is on — it is OFF by default, and the game
  // is fully playable without it).
  // A line never names a PICTURE (speech must not read an emoji aloud — the
  // app-wide law): each finale carries a spoken name of its own (`say`).
  const SAY = {
    start: "I'm hungry! Drag me to eat!",
    grow: ["Bigger!", "Yum! Bigger!", "Wow, so big!", "Gobble gobble!"],
    // the grow that makes Gobble big enough for the finale ({finale} is its
    // spoken name): from here on, it is what he is here for
    ready: "Wow, so big! Now eat {finale}!",
    // …and when that finale is still shut away behind a gate, the KEY comes
    // first (§15.1): the arrow and the beacon point at it
    readyKey: "Wow, so big! Find the key to {finale}!",
    big: "Too big! Eat more first!",
    treasure: "Ooh, a treasure!",
    win: "Burp! You ate it all!",
    pick: "Pick a place to eat!",
    // the home (§17): four lands, each with its own places
    pickLand: "Pick a land to visit!",
    // the challenges (PLAN §14): a gate that wants its key, the key, a box
    // that pops, a portal, a current, the ice — each said once in a while,
    // never every time
    locked: "It's locked! Find the key!",
    unlock: "The key! The way is open!",
    pop: "Surprise!",
    warp: "Whoosh!",
    flow: "Wheee!",
    ice: "Whoa, slippy!",
    // ten gulps in a row (§15.6)
    slurp: "Super slurp!",
    // §17: what the new things say. A gate that wants a BUTTON asks for the
    // button, never for a key it does not have; a gate that wants several
    // counts them as they are found ("Two of three!").
    readyButton: "Wow, so big! Find the button for {finale}!",
    lockedButton: "It's locked! Find the button!",
    unlockPress: "Click! The way is open!",
    opener: "{n} of {of}!",
    boing: "Boing! Too bouncy! Eat more first!",
    hit: ["One!", "Two!", "Three!", "Four!", "Five!"],
    hitLast: "Surprise!",
    launch: "Blast off!",
    flee: "Catch it!",
    power: { magnet: "Magnet! Super slurp!", zoom: "Zoom zoom!" },
    sprout: "It grew!",
    countLast: "{n}! That's all the {what}!",
    // the FIRST time he comes near each new thing, Gobble says what it is
    // (§17, the gentle walkthrough a new mechanic needs); a finger points at it
    meet: {
      keys: "This gate needs {n} things to open it! Find them all!",
      button: "A big button! Roll onto it!",
      bounce: "A bouncy one! Boing!",
      hits: "Bump it! Bump it again!",
      power: "Ooh, a power-up! Eat it!",
      sprout: "A little seed! Go near it!",
      launch: "A cannon! Roll in!",
      spin: "A spinning floor! Wheee!",
      count: "Let's count the {what}!",
    },
    // number words for the counting lines (a voice reads "2" fine, but the
    // words keep every line written the way it is said)
    num: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"],
    // what Gobble says the FIRST time he tastes each family (§15.3) — once a
    // run, and never on top of another line
    taste: {
      sweet: "Mmm, sweet!", cold: "Brrr, cold!", honk: "Beep beep!", siren: "Wee-woo!",
      choo: "Choo choo!", horn: "Toot toot!", zoom: "Zoom!", boing: "Boing!", ding: "Ding!",
      ching: "Shiny!", clank: "Clank!", beep: "Beep boop!", squeak: "Squeak!", music: "La la la!", pop: "Pop!",
    },
  };

  // WHAT GOBBLE TASTES (PLAN_GOBBLE.md §15.3): things sorted into families,
  // and each family has its own sound (hole-main.js), look (hole-render.js)
  // and first-time word (SAY.taste). A family's sound REPLACES the plain gulp,
  // never plays on top of it. Every picture listed here must be something a
  // place really holds (a test fails a dead entry), and no picture is in two.
  // A finale is never here: it has its own gulp.
  const TASTES = {
    sweet: ["🍬", "🧁", "🍩", "🍪", "🥧", "🍯", "🍭", "🍫", "💝", "🍰", "🎂", "🍡", "🍮", "🥞", "🧇"],
    cold: ["🍦", "🍨", "🧊", "❄️", "🥤"],
    honk: ["🚗", "🚕", "🚙", "🚌", "🚐", "🛻", "🚛", "🚚", "🚜", "🛵", "🏍️", "🛺"],
    siren: ["🚓", "🚒", "🚑"],
    choo: ["🚃", "🚂", "🚟", "🚡", "🚠"],
    horn: ["🚤", "⛵", "🛶", "🛥️", "⛴️"],
    zoom: ["🛩️", "🛫", "🛬", "🚁", "🚀", "🛸", "🛰️", "☄️"],
    boing: ["⚽", "🏀", "🎾", "⚾", "🏐", "🏈", "🥏", "🏓", "🏸", "🪀", "🎳"],
    ding: ["🔔", "🎐", "🚲"],
    ching: ["🪙", "💎", "💍", "🥇", "🏆", "⭐", "🌟", "👑"],
    clank: ["🔩", "🔨", "🔧", "🪛", "⚙️", "🧲", "🪝", "⚓", "🛢️", "🪣", "🧰", "⛏️", "🛡️"],
    beep: ["🤖", "📺", "📻", "🔋", "📡", "🏧"],
    squeak: ["🧸", "🪆", "🩴", "👟"],
    music: ["🥁", "🎸", "🎺", "🎷", "🪕", "🎻", "🪘", "🎤", "🎵", "🎶", "🎼", "🎧", "🎙️"],
    pop: ["🎈", "🍿", "🎉", "🎊", "🪅"],
  };
  // a picture -> its family
  const TASTE_OF = {};
  for (const [fam, list] of Object.entries(TASTES)) for (const e of list) TASTE_OF[e] = fam;
  const tasteOf = (e) => TASTE_OF[e] || null;

  // THE LANDS (PLAN_GOBBLE.md §17): the home is four big land doors, and
  // each land holds its own places — the model Josh already knows from his
  // launcher (a category, then its games). A land is one picture for a
  // non-reader, and the lands run from the gentlest places to the craziest.
  // This table is the ONE owner of which place is in which land and of the
  // order ▶ walks through them: every place is in exactly one land, and every
  // land holds the same number (a law).
  const LANDS = [
    { id: "town", name: "Home Town", pic: "🏡", backdrop: ["#ffe9b8", "#ffc56b"], color: "#e8963a",
      places: ["toyroom", "picnic", "farm", "build", "town", "sports", "bath", "kitchen", "firestation", "garden", "playground", "racetrack"] },
    { id: "shore", name: "Sunny Shore", pic: "⛱️", backdrop: ["#c9f0ff", "#7fd0f5"], color: "#2e94c8",
      places: ["party", "beach", "volcano", "snow", "airport", "market", "sea", "waterpark", "harbour", "mountain", "hotel", "islands"] },
    { id: "wild", name: "Wild Places", pic: "🗺️", backdrop: ["#d6f5c6", "#8fd47a"], color: "#4f9a3a",
      places: ["maze", "cave", "castle", "factory", "jungle", "pirate", "desert", "camp", "dino", "mine", "forest", "temple"] },
    { id: "crazy", name: "Crazy Land", pic: "🤪", backdrop: ["#f3d7ff", "#c79bff"], color: "#8a52d6",
      places: ["space", "circus", "cloud", "themepark", "candy", "music", "pinball", "moon", "trainland", "numbers", "chocolate", "beanstalk"] },
  ];
  // a place's land
  const landOf = (id) => LANDS.find((l) => l.places.includes(id)) || null;

  const HoleData = { RULES, SCENES, SAY, TASTES, tasteOf, LANDS, landOf };
  global.HoleData = HoleData;
  if (typeof module !== "undefined" && module.exports) module.exports = HoleData;
})(typeof window !== "undefined" ? window : globalThis);
