    {
      // A CIRCUS high up under the tent: a ring, a centre stage and little
      // platforms, and THE TWIST: tightropes join them, and springs BOUNCE
      // Gobble from the bottom platforms right up to the top ones.
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
        { r: T3, items: [["🛴", 3, { ride: "ring" }], ["🎭", 10], ["🪅", 8], ["🎁", 8], ["🛹", 8], ["🧸", 10]] },
        { r: T4, items: [["🎠", 6, "top"], ["🚲", 8], ["🪑", 8], ["🚐", 6, "low"]] },
        { r: T5, items: [["🚂", 4], ["🚃", 9], ["🚌", 4]] },
      ],
      finale: { e: "🎪", r: 20, at: [0.5, 0.5], say: "the big top" },
    },
