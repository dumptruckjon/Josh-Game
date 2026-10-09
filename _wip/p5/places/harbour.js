    {
      // A HARBOUR round a bay, and THE TWIST: the giant crane stands in the
      // crane yard behind a gate that needs THREE keys — one hidden on each
      // side of the harbour ("one of three!"). Boats sail round the bay and
      // stacks of shipping containers stand on the quay.
      id: "harbour", name: "Harbour", door: "⚓", color: "#1d3557",
      ground: "dock", hole: "gobble",
      wear: ["cap", "#1d3557", "#ffd24d"], air: ["clouds"],
      backdrop: ["#dff3ff", "#9fd3f0"],
      start: [0.5, 0.93], starters: 3,
      tune: [392, 523.25, 659.25, 587.33, 523.25],
      land: [{ rect: [0.02, 0.02, 0.98, 0.98], round: 30, not: { oval: [0.5, 0.46, 0.28, 0.17] } }],
      blocks: [
        // the crane yard, shut but for its gate
        { path: [[0.48, 0.22], [0.3, 0.22], [0.3, -0.02]], w: 5, look: "crates" },
        { path: [[0.52, 0.22], [0.7, 0.22], [0.7, -0.02]], w: 5, look: "crates" },
        // container stacks on the quay
        { rect: [0.06, 0.78, 0.2, 0.84], round: 2, look: "crates" },
        { rect: [0.8, 0.78, 0.94, 0.84], round: 2, look: "crates" },
        { rect: [0.06, 0.3, 0.14, 0.42], round: 2, look: "crates" },
        { rect: [0.86, 0.5, 0.94, 0.62], round: 2, look: "crates" },
      ],
      tracks: { bay: { pts: ovalPts(0.5, 0.46, 0.245, 0.14, 24), loop: true, speed: 7, look: "none" } },
      zones: {
        west: [[0.04, 0.46, 0.18, 0.7]],
        east: [[0.82, 0.24, 0.96, 0.46]],
        south: [[0.3, 0.8, 0.7, 0.88]],
        yard: [[0.33, 0.04, 0.67, 0.2]],
        quay: [[0.04, 0.04, 0.27, 0.22], [0.73, 0.04, 0.96, 0.22]],
      },
      trails: [{ e: "🪙", to: [0.24, 0.9] }, { e: "🪙", to: [0.76, 0.9] }],
      decals: [
        { k: "slab", x0: 0.31, y0: 0.02, x1: 0.69, y1: 0.21 },
        { k: "pallet", x0: 0.38, y0: 0.66, x1: 0.62, y1: 0.74 },
        { k: "lot", x0: 0.03, y0: 0.03, x1: 0.28, y1: 0.23 },
        { k: "lot", x0: 0.72, y0: 0.03, x1: 0.97, y1: 0.23 },
      ],
      tiers: [
        { r: T1, items: [["🪙", 44], ["⭐", 18], ["🍬", 16], ["🍦", 16], ["🥨", 14], ["🪝", 16], ["🔩", 14],
          ["🔑", 1, { key: "yard", zone: "west", glow: true }], ["🔑", 1, { key: "yard", zone: "east", glow: true }], ["🔑", 1, { key: "yard", zone: "south", glow: true }]] },
        { r: T2, items: [["🧭", 10], ["🪢", 12], ["🪣", 12], ["🧤", 10, null, 2], ["📦", 12, "quay"], ["🥫", 10], ["🗞️", 10]] },
        { r: T3, items: [["🛢️", 10, "quay"], ["🛶", 8], ["🧳", 8], ["🪵", 10, null, 2], ["🚲", 6], ["🚧", 1, { at: { pts: [[0.5, 0.22]] }, lock: "yard" }]] },
        { r: T4, items: [["⛵", 3, { ride: "bay" }], ["🚤", 3, { ride: "bay" }], ["🚗", 7], ["🏮", 7], ["🚐", 7]] },
        { r: T5, items: [["🚛", 5], ["🏭", 2, "yard"], ["🏠", 5], ["⛴️", 3], ["🛳️", 3]] },
      ],
      finale: { e: "🏗️", r: 20, at: [0.5, 0.1], say: "the big crane" },
    },
