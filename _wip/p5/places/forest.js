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
