    {
      // THE GIANT BEANSTALK (§17 giant: six sizes, a giant finale), a very
      // TALL world: a garden at the bottom, a beanstalk winding up past
      // clouds, and the giant's castle in the clouds at the top. THE TWIST:
      // everything gets BIGGER the higher he climbs, and magic seeds SPROUT
      // leaves and clover as he passes. The giant's boot waits at the top.
      id: "beanstalk", name: "Giant Beanstalk", door: "🌱", color: "#3fbf5f",
      ground: "cloud", hole: "gobble",
      world: [420, 840],
      wear: ["propeller", "#3fbf5f"], air: ["clouds"],
      backdrop: ["#e9f6ff", "#bfe1ff"],
      start: [0.5, 0.93], starters: 3,
      tune: [392, 440, 493.88, 523.25, 587.33, 659.25, 783.99],
      land: [
        { rect: [0.02, 0.8, 0.98, 0.99], round: 30 },
        { path: [[0.5, 0.84], [0.32, 0.72], [0.62, 0.6], [0.38, 0.48], [0.6, 0.36], [0.5, 0.22]], w: 84 },
        { oval: [0.2, 0.72, 0.18, 0.055] },
        { oval: [0.78, 0.6, 0.18, 0.055] },
        { oval: [0.22, 0.48, 0.18, 0.055] },
        { oval: [0.78, 0.36, 0.18, 0.05] },
        { oval: [0.5, 0.13, 0.48, 0.11] },
      ],
      zones: {
        low: [{ band: [0, 0.3] }],
        mid: [{ band: [0.3, 0.65] }],
        high: [{ band: [0.65, 1] }],
        garden: [[0.06, 0.82, 0.34, 0.96], [0.66, 0.82, 0.94, 0.96]],
        castle: [[0.1, 0.06, 0.32, 0.2], [0.68, 0.06, 0.9, 0.2]],
      },
      trails: [{ e: "🍃", to: [0.28, 0.92] }, { e: "🍃", to: [0.72, 0.92] }],
      decals: [
        { k: "crops", x0: 0.05, y0: 0.82, x1: 0.33, y1: 0.97, c: "#7cc95a" },
        { k: "path", w: 10, pts: [[0.5, 0.99], [0.5, 0.86]] },
        { k: "flowers", x: 0.8, y: 0.89, r: 0.07 },
        { k: "rug", x: 0.5, y: 0.13, r: 0.16, pal: 1 },
      ],
      tiers: [
        { r: T1, items: [["🍃", 44], ["🪙", 24, null, 3], ["⭐", 20], ["🍬", 16], ["🌼", 16, "garden", 4], ["🔔", 14], ["🍀", 12], ["🌱", 10, { sprout: [["🍀", 2, 1], ["🌿", 2, 2]], zone: "low" }]] },
        { r: T2, items: [["🌿", 12], ["🥚", 10, "mid"], ["🎻", 8], ["🧺", 10, "garden"], ["🥕", 12, "garden"], ["🍎", 12], ["🔑", 10], ["🧦", 10]] },
        { r: T3, items: [["🍄", 10, "mid"], ["🪣", 8], ["🌻", 8, "garden"], ["🥁", 6], ["🎺", 6], ["🧸", 8], ["🍞", 8, "mid"]] },
        { r: T4, items: [["🌲", 10, "high"], ["🛖", 5], ["🥄", 6, "high"], ["☕", 6, "high"], ["🧀", 6]] },
        { r: T5, items: [["🛏️", 3, "high"], ["🪑", 4, "high"], ["🕰️", 3, "high"], ["🫖", 4, "high"], ["👑", 3, "castle"]] },
        { r: T6, items: [["🏰", 3, "castle"], ["🌳", 3, "high"], ["🏡", 3, "high"], ["🗻", 2, "high"]] },
      ],
      finale: { e: "👢", r: 28, at: [0.5, 0.08], say: "the giant's boot" },
    },
