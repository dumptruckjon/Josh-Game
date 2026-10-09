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
