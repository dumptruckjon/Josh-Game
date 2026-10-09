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
