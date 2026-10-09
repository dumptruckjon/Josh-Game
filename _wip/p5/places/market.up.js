    {
      // AISLES of tall shelves, and THE TWIST: shopping trolleys trundle up
      // and down the aisles and along the tills — gobble the shopping, then
      // the trolleys, then the whole shop.
      id: "market", name: "Shopping Day", door: "🛒", color: "#4fd1c5",
      ground: "tiles", hole: "gobble",
      wear: ["chef", "#ffffff"], air: ["motes"],
      backdrop: ["#f4f7fb", "#dde6f0"],
      start: [0.5, 0.92], starters: 3,
      tune: [523.25, 587.33, 659.25, 523.25, 783.99],
      blocks: [
        { rect: [0.17, 0.3, 0.21, 0.66], round: 3, look: "shelf" },
        { rect: [0.38, 0.3, 0.42, 0.66], round: 3, look: "shelf" },
        { rect: [0.58, 0.3, 0.62, 0.66], round: 3, look: "shelf" },
        { rect: [0.79, 0.3, 0.83, 0.66], round: 3, look: "shelf" },
      ],
      tracks: {
        left: { pts: [[0.295, 0.33], [0.295, 0.64]], speed: 9, look: "none" },
        right: { pts: [[0.705, 0.64], [0.705, 0.33]], speed: 9, look: "none" },
        tills: { pts: [[0.08, 0.76], [0.92, 0.76]], speed: 11, look: "none" },
      },
      zones: {
        fruit: [[0.04, 0.05, 0.4, 0.26]],
        bakery: [[0.6, 0.05, 0.96, 0.26]],
        drinks: [[0.03, 0.3, 0.16, 0.66]],
        sweets: [[0.43, 0.3, 0.57, 0.66]],
        toys: [[0.84, 0.3, 0.97, 0.66]],
      },
      trails: [{ e: "🍬", to: [0.2, 0.84] }, { e: "🍬", to: [0.8, 0.84] }],
      decals: [
        { k: "mat", x0: 0.03, y0: 0.04, x1: 0.41, y1: 0.27 },
        { k: "mat", x0: 0.59, y0: 0.04, x1: 0.97, y1: 0.27 },
        { k: "stripes", x0: 0.03, y0: 0.79, x1: 0.97, y1: 0.87 },
        { k: "zebra", x0: 0.43, y0: 0.68, x1: 0.57, y1: 0.72 },
      ],
      count: { e: "🍎", by: 1, say: "apples" },
      tiers: [
        { r: T1, items: [["🍬", 40], ["🍎", 20, "fruit", 2], ["🍌", 12, "fruit", 2], ["🍓", 16, "fruit", 4], ["🍪", 16, "sweets", 2], ["🍭", 12, "sweets"], ["🧃", 16, "drinks", 2], ["🥕", 12, "fruit", 3], ["🍇", 10, "fruit", 2]] },
        { r: T2, items: [["🥐", 12, "bakery", 2], ["🥖", 10, "bakery"], ["🍞", 12, "bakery", 2], ["🧁", 10, "bakery"], ["🍩", 10], ["🥤", 10, "drinks"], ["🧸", 8, "toys"], ["🎈", 8, "toys"], ["🍫", 10, "sweets"]] },
        { r: T3, items: [["🛒", 2, { ride: "left" }], ["🛒", 2, { ride: "right" }], ["🛒", 2, { ride: "tills" }], ["🛒", 6], ["🧺", 10], ["🍉", 10, "fruit"], ["🎂", 6, "bakery"], ["🍍", 10], ["🧀", 10], ["🥫", 10]] },
        { r: T4, items: [["📦", 12], ["🛍️", 12], ["🗑️", 8], ["🪜", 6]] },
        { r: T5, items: [["🚚", 6], ["🚛", 4], ["🏧", 6]] },
      ],
      finale: { e: "🏬", r: 20, at: [0.5, 0.12], say: "the whole shop" },
    },
