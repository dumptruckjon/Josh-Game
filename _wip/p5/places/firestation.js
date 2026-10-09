    {
      // A FIRE STATION, and THE TWIST: the fire engine waits behind the
      // garage door, and only the big red BUTTON out in the yard opens it (a
      // gold wire runs from the button to the door). Ambulances and police
      // cars drive round the yard.
      id: "firestation", name: "Fire Station", door: "🚒", color: "#e63946",
      ground: "brick", hole: "gobble",
      wear: ["hardhat", "#e63946"], air: ["dust"],
      backdrop: ["#fff0ea", "#ffd5c8"],
      start: [0.5, 0.92], starters: 3,
      tune: [659.25, 523.25, 659.25, 523.25, 783.99],
      blocks: [
        // the garage: walls round the top middle, shut but for its door
        { path: [[0.48, 0.32], [0.26, 0.32], [0.26, -0.02]], w: 5, look: "wall" },
        { path: [[0.52, 0.32], [0.74, 0.32], [0.74, -0.02]], w: 5, look: "wall" },
      ],
      tracks: { yard: { pts: ovalPts(0.5, 0.65, 0.38, 0.18, 28), loop: true, speed: 9, look: "road" } },
      zones: {
        garage: [[0.3, 0.04, 0.7, 0.28]],
        lot: [[0.04, 0.04, 0.22, 0.4], [0.78, 0.04, 0.96, 0.4]],
        street: [[0.3, 0.86, 0.7, 0.96]],
      },
      trails: [{ e: "🍩", to: [0.22, 0.86] }, { e: "🍩", to: [0.78, 0.86] }],
      decals: [
        { k: "slab", x0: 0.27, y0: 0.02, x1: 0.73, y1: 0.31 },
        { k: "lot", x0: 0.03, y0: 0.04, x1: 0.23, y1: 0.4 },
        { k: "lot", x0: 0.77, y0: 0.04, x1: 0.97, y1: 0.4 },
        { k: "zebra", x0: 0.42, y0: 0.4, x1: 0.58, y1: 0.46 },
      ],
      tiers: [
        { r: T1, items: [["🍩", 48], ["⭐", 20], ["🔔", 16], ["🧤", 18, null, 2], ["🔑", 14], ["🍬", 16], ["🪙", 16]] },
        { r: T2, items: [["🧯", 14], ["⛑️", 12, "garage"], ["🥾", 12, null, 2], ["🔦", 10], ["🪣", 12], ["🧢", 10], ["📻", 8]] },
        { r: T3, items: [["🚨", 10], ["🪜", 8, "garage"], ["🛢️", 8, "lot"], ["🚧", 10], ["🚲", 6], ["🧺", 6], ["🚪", 1, { at: { pts: [[0.5, 0.32]] }, lock: "garage" }]] },
        { r: T4, items: [["🚓", 3, { ride: "yard" }], ["🚑", 3, { ride: "yard" }], ["🚗", 8, "lot"], ["🛵", 6], ["🚐", 6], ["🔴", 1, { press: "garage", at: { pts: [[0.13, 0.66]] } }]] },
        { r: T5, items: [["🏠", 4, "street"], ["🏪", 4], ["🚌", 4], ["🌳", 4]] },
      ],
      finale: { e: "🚒", r: 20, at: [0.5, 0.15], say: "the fire engine" },
    },
