    {
      // BATH TIME: the bath overflowed. Puddles all over the bathroom floor
      // to walk round, wet tiles he SLIDES on, and the plughole in the middle
      // is a WHIRLPOOL that spins him round and round.
      id: "bath", name: "Bath Time", door: "🛁", color: "#6cc6f0",
      ground: "bath", hole: "gobble",
      wear: ["bobble", "#5ec8ff"], air: ["bubbles"],
      backdrop: ["#eaf7ff", "#c5e7fa"],
      start: [0.5, 0.92], starters: 3,
      tune: [523.25, 659.25, 783.99, 659.25, 1046.5],
      land: [{ rect: [0.02, 0.02, 0.98, 0.98], round: 40 }],
      blocks: [
        { oval: [0.24, 0.42, 0.13, 0.05], look: "water" },
        { oval: [0.76, 0.42, 0.13, 0.05], look: "water" },
        { oval: [0.3, 0.72, 0.1, 0.04], look: "water" },
        { oval: [0.7, 0.72, 0.1, 0.04], look: "water" },
      ],
      flows: [{ spin: [0.5, 0.56, 0.11], v: 22, look: "whirl" }],
      slide: ["wet"],
      zones: {
        wet: [[0.08, 0.5, 0.3, 0.62], [0.7, 0.5, 0.92, 0.62]],
        sink: [[0.05, 0.05, 0.3, 0.2]],
        shelf: [[0.7, 0.05, 0.95, 0.2]],
      },
      trails: [{ e: "🧼", to: [0.2, 0.84] }, { e: "🧼", to: [0.8, 0.84] }],
      decals: [
        { k: "mat", x0: 0.37, y0: 0.79, x1: 0.63, y1: 0.89, c: "#7fd0f5" },
        { k: "puddle", x: 0.16, y: 0.56, r: 0.07 },
        { k: "puddle", x: 0.84, y: 0.56, r: 0.07 },
        { k: "towel", x0: 0.06, y0: 0.24, x1: 0.18, y1: 0.3, c: "#ff8fb1" },
        { k: "towel", x0: 0.82, y0: 0.24, x1: 0.94, y1: 0.3, c: "#ffd24d" },
      ],
      tiers: [
        { r: T1, items: [["🧼", 54], ["🪥", 20, null, 2], ["🧽", 18], ["💧", 22, "wet", 2], ["🍬", 14], ["⭐", 14]] },
        { r: T2, items: [["🧻", 14], ["🪣", 10], ["🩴", 12, null, 2], ["🧦", 14, null, 2], ["👕", 10], ["🧴", 12, "shelf"]] },
        { r: T3, items: [["🧺", 10], ["🪴", 8], ["🪞", 6, "sink"], ["🚿", 6], ["⛵", 10], ["🧸", 8]] },
        { r: T4, items: [["🚽", 6], ["🗑️", 6], ["🪑", 6], ["🪜", 6]] },
        { r: T5, items: [["🗄️", 5], ["🚪", 5], ["🪟", 5]] },
      ],
      finale: { e: "🛁", r: 20, at: [0.5, 0.14], say: "the bathtub" },
    },
