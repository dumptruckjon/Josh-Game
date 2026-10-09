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
