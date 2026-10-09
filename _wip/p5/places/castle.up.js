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
