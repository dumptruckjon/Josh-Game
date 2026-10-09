    {
      // TRAIN TOWN, a model railway town, and THE TWIST: trains everywhere —
      // a goods train to gobble car by car from the back, little trams going
      // round and round the town, a river with railway bridges, and TUNNELS
      // that pop Gobble out on the other side. The big steam train is in the
      // station at the top.
      id: "trainland", name: "Train Town", door: "🚂", color: "#1d3557",
      ground: "felt", hole: "gobble",
      wear: ["cap", "#1d3557", "#e63946"], air: ["clouds"],
      backdrop: ["#e8f4ff", "#c8e0f5"],
      world: [480, 640],
      start: [0.5, 0.94], starters: 3,
      tune: [392, 392, 523.25, 523.25, 659.25, 783.99],
      land: [{ rect: [0.02, 0.02, 0.98, 0.98], round: 30 }],
      blocks: [{ rect: [-0.02, 0.48, 1.02, 0.54], look: "water" }],
      bridges: [
        { path: [[0.3, 0.45], [0.3, 0.57]], w: 16, look: "planks" },
        { path: [[0.7, 0.45], [0.7, 0.57]], w: 16, look: "planks" },
      ],
      portals: [
        { a: [0.07, 0.62], b: [0.07, 0.4], look: "tunnel" },
        { a: [0.93, 0.62], b: [0.93, 0.4], look: "tunnel" },
      ],
      tracks: {
        goods: { pts: ovalPts(0.5, 0.75, 0.36, 0.11, 32), loop: true, speed: 10, look: "rails", train: true },
        tram: { pts: ovalPts(0.5, 0.29, 0.32, 0.1, 30), loop: true, speed: 8, look: "rails" },
      },
      zones: {
        town: [[0.08, 0.06, 0.3, 0.18], [0.7, 0.06, 0.92, 0.18]],
        yard: [[0.38, 0.69, 0.62, 0.81]],
        park: [[0.4, 0.24, 0.6, 0.34]],
        farm: [[0.08, 0.84, 0.3, 0.95], [0.7, 0.84, 0.92, 0.95]],
      },
      trails: [{ e: "🎫", to: [0.3, 0.92] }, { e: "🎫", to: [0.7, 0.92] }],
      decals: [
        { k: "road", x0: 0.46, y0: 0.56, x1: 0.54, y1: 0.98 },
        { k: "park", x: 0.5, y: 0.29, r: 0.07 },
        { k: "lot", x0: 0.37, y0: 0.68, x1: 0.63, y1: 0.82 },
        { k: "slab", x0: 0.3, y0: 0.03, x1: 0.7, y1: 0.17 },
        { k: "crops", x0: 0.07, y0: 0.83, x1: 0.31, y1: 0.96, c: "#e9c46a" },
      ],
      tiers: [
        { r: T1, items: [["🎫", 50], ["🪙", 18, null, 3], ["🍬", 18], ["⭐", 14], ["🧃", 14], ["🍪", 14, null, 2], ["🔩", 14, "yard"], ["🥨", 14]] },
        { r: T2, items: [["🚃", 5, { ride: "goods" }], ["🧳", 12], ["🎒", 10], ["🗞️", 10], ["🧸", 10], ["⏰", 10], ["🎈", 10, "park"], ["🧢", 10]] },
        { r: T3, items: [["🚆", 1, { ride: "goods" }], ["🚦", 10], ["🚏", 8], ["🛤️", 8, "yard"], ["🧺", 6, "farm"], ["🚲", 8], ["🛴", 8], ["🪵", 8, "farm", 2]] },
        { r: T4, items: [["🚋", 4, { ride: "tram" }], ["🚗", 8], ["🚌", 5, "town"], ["🚕", 6], ["🌳", 6, "park"]] },
        { r: T5, items: [["🏠", 5, "farm"], ["🏢", 3, "town"], ["🏭", 3], ["🏪", 3, "town"], ["🚉", 3]] },
      ],
      finale: { e: "🚂", r: 20, at: [0.5, 0.1], say: "the big steam train" },
    },
