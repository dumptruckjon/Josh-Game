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
