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
