    {
      // CAMPING NIGHT, and THE TWIST: it is NIGHT — only the ground round
      // Gobble is lit, and the lanterns, torches and stars glow so he can find
      // his way. Canoes paddle round the lake in the middle. The campsite and
      // its big fire wait at the top.
      id: "camp", name: "Camping Night", door: "⛺", color: "#5a7a3a",
      ground: "grass", hole: "gobble",
      wear: ["explorer", "#5a7a3a"], air: ["fireflies"],
      backdrop: ["#10182b", "#1d2b44"],
      dark: true,
      start: [0.5, 0.92], starters: 3,
      tune: [392, 329.63, 392, 440, 392, 329.63],
      land: [{ rect: [0.02, 0.02, 0.98, 0.98], round: 40 }],
      blocks: [
        { oval: [0.5, 0.47, 0.25, 0.11], look: "water" },
        { circle: [0.16, 0.72, 0.05], look: "water" },
      ],
      tracks: { lake: { pts: ovalPts(0.5, 0.47, 0.2, 0.075, 28), loop: true, speed: 7, look: "none" } },
      zones: {
        tents: [[0.06, 0.08, 0.3, 0.26], [0.7, 0.08, 0.94, 0.26]],
        woods: [[0.04, 0.3, 0.2, 0.62], [0.8, 0.3, 0.96, 0.62]],
        fire: [[0.36, 0.62, 0.64, 0.74]],
        cars: [[0.66, 0.78, 0.94, 0.92]],
      },
      trails: [{ e: "🌰", to: [0.3, 0.9] }, { e: "🌰", to: [0.7, 0.9] }],
      decals: [
        { k: "patch", x: 0.5, y: 0.68, r: 0.1, c: "#6b4a2a" },
        { k: "path", w: 9, pts: [[0.5, 1.02], [0.5, 0.8], [0.5, 0.66]] },
        { k: "path", w: 8, pts: [[0.24, 0.3], [0.24, 0.62], [0.5, 0.82]] },
        { k: "lot", x0: 0.65, y0: 0.77, x1: 0.95, y1: 0.93 },
        { k: "flowers", x: 0.12, y: 0.88, r: 0.07 },
      ],
      tiers: [
        { r: T1, items: [["🌰", 46], ["⭐", 22, { glow: true }], ["🍫", 18, null, 3], ["🍪", 16, null, 2], ["🍄", 20, "woods", 4], ["🫐", 16, null, 4], ["🍂", 14]] },
        { r: T2, items: [["🔦", 12, { glow: true }], ["🥾", 12, null, 2], ["🧭", 10], ["🎒", 12, "tents"], ["🥫", 12, "fire"], ["🧢", 10], ["🍢", 10, "fire"], ["🎣", 8]] },
        { r: T3, items: [["🏮", 12, { glow: true }], ["🪵", 12, "fire", 2], ["🪣", 8], ["🧺", 8], ["🎸", 6, "fire"], ["🪑", 8, "fire"]] },
        { r: T4, items: [["🛶", 3, { ride: "lake" }], ["⛺", 10, "tents"], ["🌲", 12, "woods"], ["🚙", 4, "cars"]] },
        { r: T5, items: [["🌳", 6], ["🚐", 4, "cars"], ["🛖", 4], ["🚌", 3]] },
      ],
      finale: { e: "🏕️", r: 20, at: [0.5, 0.12], say: "the campsite" },
    },
