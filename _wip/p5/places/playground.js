    {
      // A PLAYGROUND, and THE TWIST: bouncy balls go BOING and knock Gobble
      // back until he is big enough to gulp them, footballs ROLL AWAY from
      // him, and the roundabout in the middle spins him round and round.
      id: "playground", name: "Playground", door: "🪁", color: "#ff7a59",
      ground: "rubber", hole: "gobble",
      wear: ["cap", "#ff9f1c"], air: ["leaves", "#f2a03d"],
      backdrop: ["#fff7e0", "#ffe2a8"],
      start: [0.5, 0.9], starters: 3,
      tune: [659.25, 783.99, 659.25, 523.25, 587.33, 659.25],
      land: [{ oval: [0.5, 0.5, 0.48, 0.47] }],
      flows: [{ spin: [0.5, 0.52, 0.1], v: 24, look: "turntable" }],
      zones: {
        field: [[0.1, 0.62, 0.42, 0.8]],
        court: [[0.58, 0.62, 0.9, 0.8]],
        sandpit: [[0.14, 0.24, 0.4, 0.4]],
        swings: [[0.6, 0.24, 0.86, 0.4]],
      },
      trails: [{ e: "🍭", to: [0.26, 0.84] }, { e: "🍭", to: [0.74, 0.84] }],
      decals: [
        { k: "court", x0: 0.57, y0: 0.61, x1: 0.91, y1: 0.81 },
        { k: "pitch", x0: 0.09, y0: 0.61, x1: 0.43, y1: 0.81 },
        { k: "patch", x: 0.27, y: 0.32, r: 0.13, c: "#f2d28a" },
        { k: "path", w: 9, pts: [[0.5, 0.98], [0.5, 0.66]] },
      ],
      tiers: [
        { r: T1, items: [["🍭", 44], ["🪙", 20], ["🍬", 22], ["⭐", 16], ["🧃", 14], ["🪀", 14, "swings"], ["🍪", 14, null, 2]] },
        { r: T2, items: [["⚽", 6, { run: true, zone: "field" }], ["🧸", 10], ["🪁", 10, "swings"], ["🎈", 12], ["🧢", 10], ["🥤", 10], ["🍿", 10], ["🛼", 8]] },
        { r: T3, items: [["🏀", 8, { bounce: true, zone: "court" }], ["🛴", 8], ["🛹", 8], ["🪣", 8, "sandpit"], ["🧺", 6], ["🏖️", 4, "sandpit"]] },
        { r: T4, items: [["🏐", 4, { bounce: true }], ["🚲", 6], ["🪑", 6], ["🌲", 8]] },
        { r: T5, items: [["🌳", 9], ["🛖", 5], ["🎪", 2], ["🎡", 2]] },
      ],
      finale: { e: "🎠", r: 20, at: [0.5, 0.15], say: "the merry-go-round" },
    },
