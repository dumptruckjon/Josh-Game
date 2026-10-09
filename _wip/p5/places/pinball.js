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
