    {
      // A WATER PARK, and THE TWIST: rainbow water SLIDES whoosh Gobble down
      // over the pools, and water CANNONS blast him from one side of the park
      // to the other. The giant wave waits at the top.
      id: "waterpark", name: "Water Park", door: "💦", color: "#2fa3d9",
      ground: "pool", hole: "gobble",
      wear: ["straw", "#2fa3d9"], air: ["sparkles", "#d8f4ff"],
      backdrop: ["#e6f7ff", "#b9e6ff"],
      start: [0.5, 0.93], starters: 3,
      tune: [783.99, 659.25, 523.25, 659.25, 783.99, 1046.5],
      blocks: [
        { rect: [0.06, 0.34, 0.42, 0.5], round: 12, look: "water" },
        { rect: [0.58, 0.34, 0.94, 0.5], round: 12, look: "water" },
        { oval: [0.5, 0.22, 0.26, 0.05], look: "water" },
      ],
      bridges: [
        { path: [[0.24, 0.28], [0.24, 0.56]], w: 14, look: "rainbow" },
        { path: [[0.76, 0.28], [0.76, 0.56]], w: 14, look: "rainbow" },
      ],
      flows: [
        { pts: [[0.24, 0.28], [0.24, 0.56]], w: 14, v: 34, look: "slide" },
        { pts: [[0.76, 0.28], [0.76, 0.56]], w: 14, v: 34, look: "slide" },
      ],
      portals: [
        { a: [0.12, 0.7], b: [0.86, 0.12], oneway: true, fly: true },
        { a: [0.88, 0.7], b: [0.14, 0.12], oneway: true, fly: true },
      ],
      zones: {
        snacks: [[0.36, 0.56, 0.64, 0.68]],
        loungers: [[0.04, 0.76, 0.3, 0.9], [0.7, 0.76, 0.96, 0.9]],
        top: [[0.04, 0.03, 0.3, 0.16], [0.7, 0.03, 0.96, 0.16]],
      },
      trails: [{ e: "🍦", to: [0.3, 0.86] }, { e: "🍦", to: [0.7, 0.86] }],
      decals: [
        { k: "towel", x0: 0.05, y0: 0.8, x1: 0.15, y1: 0.86, c: "#ff6b6b" },
        { k: "towel", x0: 0.85, y0: 0.8, x1: 0.95, y1: 0.86, c: "#ffd24d" },
        { k: "puddle", x: 0.5, y: 0.78, r: 0.06 },
        { k: "mat", x0: 0.35, y0: 0.55, x1: 0.65, y1: 0.69, c: "#2fa3d9" },
      ],
      tiers: [
        { r: T1, items: [["🍦", 46], ["🍬", 22], ["🪙", 18], ["⭐", 18], ["🧃", 16], ["🍭", 16], ["🩱", 12], ["🕶️", 12]] },
        { r: T2, items: [["🩳", 12, null, 2], ["🩴", 12, null, 2], ["🧴", 12, "loungers"], ["🏐", 10], ["🥤", 10, "snacks"], ["🍔", 10, "snacks"], ["🍟", 10, "snacks"]] },
        { r: T3, items: [["🛶", 8], ["⛱️", 8, "loungers"], ["🍉", 10], ["🧺", 8], ["🚿", 6], ["🪣", 8]] },
        { r: T4, items: [["🚤", 5], ["🪑", 7, "loungers"], ["🌴", 9], ["⛵", 6]] },
        { r: T5, items: [["🏖️", 5], ["🎡", 2], ["🏨", 4], ["🛖", 5], ["🎢", 2]] },
      ],
      finale: { e: "🌊", r: 20, at: [0.5, 0.08], say: "the giant wave" },
    },
