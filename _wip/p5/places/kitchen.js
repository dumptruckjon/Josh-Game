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
