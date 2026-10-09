    {
      // A LOST TEMPLE in the jungle, ringed by a moat, and THE TWIST: the
      // golden door of the inner temple needs ALL THREE stone buttons pressed
      // — one hidden on each side of the moat and one in the courtyard ("one
      // of three!"). Stone bridges cross the moat. The golden vase is inside.
      id: "temple", name: "Lost Temple", door: "🏛️", color: "#c9a24a",
      ground: "temple", hole: "gobble",
      wear: ["explorer", "#c9a24a"], air: ["leaves", "#7cc95a"],
      backdrop: ["#eef7df", "#cfe6b0"],
      world: [440, 620],
      start: [0.5, 0.93], starters: 3,
      tune: [293.66, 392, 440, 523.25, 440, 293.66],
      land: [{ rect: [0.02, 0.02, 0.98, 0.98], round: 36 }],
      blocks: [
        { ring: [0.5, 0.44, 0.34, 0.4], look: "water" },
        // the inner temple, shut but for its golden door
        { path: [[0.485, 0.38], [0.26, 0.38], [0.26, 0.22]], w: 5, look: "wall" },
        { path: [[0.515, 0.38], [0.74, 0.38], [0.74, 0.22]], w: 5, look: "wall" },
      ],
      bridges: [
        { path: [[0.5, 0.67], [0.5, 0.59]], w: 16, look: "stone" },
        { path: [[0.05, 0.44], [0.2, 0.44]], w: 14, look: "stone" },
        { path: [[0.95, 0.44], [0.8, 0.44]], w: 14, look: "stone" },
      ],
      zones: {
        court: [[0.32, 0.44, 0.68, 0.58]],
        jungle: [[0.04, 0.62, 0.3, 0.86], [0.7, 0.62, 0.96, 0.86]],
        ruins: [[0.04, 0.04, 0.2, 0.2], [0.8, 0.04, 0.96, 0.2]],
      },
      trails: [{ e: "🪙", to: [0.3, 0.9] }, { e: "🪙", to: [0.7, 0.9] }],
      decals: [
        { k: "slab", x0: 0.34, y0: 0.42, x1: 0.66, y1: 0.58 },
        { k: "stones", pts: [[0.5, 0.96], [0.5, 0.8], [0.5, 0.66]] },
        { k: "shade", x: 0.15, y: 0.74, r: 0.12 },
        { k: "shade", x: 0.85, y: 0.74, r: 0.12 },
        { k: "gravel", x: 0.12, y: 0.12, r: 0.07 },
      ],
      tiers: [
        { r: T1, items: [["🪙", 48], ["💍", 14], ["🍃", 18, null, 4], ["🍌", 14, null, 2], ["⭐", 14], ["🍬", 14], ["🌰", 16]] },
        { r: T2, items: [["🗝️", 10], ["🧭", 10], ["🔦", 10], ["📜", 12], ["👑", 8, "court"], ["🍍", 10, "jungle"], ["🥥", 10, "jungle"], ["💎", 10, "court"]] },
        { r: T3, items: [["⚱️", 10, "ruins"], ["🗺️", 8], ["🪵", 8, null, 2], ["🏮", 8], ["🧳", 6], ["🪨", 8], ["🚪", 1, { at: { pts: [[0.5, 0.38]] }, lock: "door" }]] },
        { r: T4, items: [["🌴", 12, "jungle"], ["🗿", 6], ["🛶", 4], ["⛩️", 4], ["🌳", 4], ["🔴", 3, { press: "door", at: { pts: [[0.08, 0.74], [0.92, 0.74], [0.5, 0.52]] } }]] },
        { r: T5, items: [["🏯", 3], ["🛕", 3], ["🗻", 3], ["🌋", 2], ["⛲", 3, "court"], ["⛰️", 3]] },
      ],
      finale: { e: "🏺", r: 20, at: [0.5, 0.33], say: "the golden vase" },
    },
