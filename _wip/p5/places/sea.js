    {
      // UNDER THE SEA, and THE TWIST: CURRENTS sweep Gobble along the sea
      // floor, coral reefs stand in the way, and old treasure pots crack open
      // after three bumps, spilling coins and jewels. A sunken ship waits at
      // the top.
      id: "sea", name: "Under the Sea", door: "🔱", color: "#2b8a8a",
      ground: "seabed", hole: "gobble",
      world: [420, 640],
      wear: ["bubble", "#9fe3ff"], air: ["bubbles"],
      backdrop: ["#bfe9ff", "#5fb6e8"],
      start: [0.5, 0.93], starters: 3,
      tune: [392, 440, 523.25, 440, 392, 329.63],
      land: [{ circle: [0.5, 0.71, 0.47] }, { circle: [0.5, 0.31, 0.43] }, { oval: [0.5, 0.52, 0.45, 0.16] }],
      blocks: [
        { circle: [0.22, 0.52, 0.06], look: "coral" },
        { circle: [0.78, 0.55, 0.065], look: "coral" },
        { oval: [0.5, 0.4, 0.13, 0.035], look: "coral" },
        { circle: [0.3, 0.2, 0.045], look: "coral" },
        { circle: [0.7, 0.2, 0.045], look: "coral" },
      ],
      flows: [
        { pts: [[0.12, 0.82], [0.5, 0.7], [0.88, 0.82]], w: 24, v: 18, look: "current" },
        { pts: [[0.86, 0.46], [0.7, 0.3], [0.5, 0.25]], w: 22, v: 20, look: "current" },
      ],
      zones: {
        wreck: [[0.36, 0.04, 0.64, 0.16]],
        reef: [[0.08, 0.42, 0.34, 0.62], [0.66, 0.44, 0.92, 0.64]],
        deep: [[0.2, 0.26, 0.8, 0.36]],
      },
      trails: [{ e: "🪙", to: [0.26, 0.86] }, { e: "🪙", to: [0.74, 0.86] }],
      decals: [
        { k: "rockpool", x: 0.16, y: 0.72, r: 0.05 },
        { k: "rockpool", x: 0.84, y: 0.7, r: 0.05 },
        { k: "shade", x: 0.5, y: 0.31, r: 0.16 },
        { k: "stones", pts: [[0.5, 0.97], [0.47, 0.88], [0.53, 0.8], [0.5, 0.72]] },
      ],
      tiers: [
        { r: T1, items: [["🪙", 46], ["⭐", 22], ["💍", 16], ["🌿", 28, null, 4], ["🔑", 14], ["🧿", 16], ["🍬", 18]] },
        { r: T2, items: [["💎", 14], ["🧭", 12], ["🗝️", 12], ["⚓", 8], ["🪝", 10, "deep"], ["🥫", 10], ["🧴", 10], ["👑", 6, "wreck"]] },
        { r: T3, items: [["🗿", 6], ["🪨", 10, "reef"], ["🏮", 8], ["🎺", 8], ["🧳", 8], ["🪵", 10]] },
        { r: T4, items: [["🏺", 4, { shake: [["🪙", 4, 1], ["💎", 2, 2]], hits: 3 }], ["🛶", 8], ["🚤", 6], ["⛵", 8]] },
        { r: T5, items: [["🛥️", 5], ["⛴️", 4], ["🚢", 4], ["🏛️", 4]] },
      ],
      finale: { e: "🛳️", r: 20, at: [0.5, 0.15], say: "the sunken ship" },
    },
