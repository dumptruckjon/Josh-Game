    {
      // ISLAND HOP: seven little islands in a bright sea, and THE TWIST:
      // CANNONS on the beaches blast Gobble over the water to the far
      // islands, rope bridges link the near ones, and beach balls ROLL AWAY
      // across the sand. A cannon on the palm-tree island blasts him home.
      id: "islands", name: "Island Hop", door: "🌅", color: "#ff9f1c",
      ground: "sand", hole: "gobble",
      wear: ["straw", "#ff9f1c"], air: ["sparkles", "#fff4c2"],
      backdrop: ["#c9f0ff", "#7fd0f5"],
      world: [504, 600],
      start: [0.5, 0.9], starters: 3,
      tune: [523.25, 587.33, 659.25, 783.99, 659.25, 523.25],
      land: [
        { circle: [0.5, 0.83, 0.26] },
        { circle: [0.14, 0.58, 0.13] },
        { circle: [0.86, 0.58, 0.13] },
        { circle: [0.5, 0.5, 0.14] },
        { circle: [0.2, 0.27, 0.19] },
        { circle: [0.8, 0.27, 0.19] },
        { circle: [0.5, 0.11, 0.16] },
      ],
      bridges: [
        { path: [[0.36, 0.74], [0.2, 0.62]], w: 12, look: "rope" },
        { path: [[0.64, 0.74], [0.8, 0.62]], w: 12, look: "rope" },
        { path: [[0.5, 0.7], [0.5, 0.55]], w: 12, look: "rope" },
        { path: [[0.27, 0.24], [0.4, 0.15]], w: 12, look: "rope" },
        { path: [[0.73, 0.24], [0.6, 0.15]], w: 12, look: "rope" },
      ],
      portals: [
        { a: [0.12, 0.56], b: [0.2, 0.3], oneway: true, fly: true },
        { a: [0.88, 0.56], b: [0.8, 0.3], oneway: true, fly: true },
        { a: [0.4, 0.06], b: [0.42, 0.84], oneway: true, fly: true },
      ],
      zones: {
        beach: [{ circle: [0.5, 0.83, 0.2] }],
        grove: [{ circle: [0.2, 0.27, 0.13] }, { circle: [0.8, 0.27, 0.13] }],
        huts: [{ circle: [0.5, 0.5, 0.1] }],
      },
      trails: [{ e: "🍦", to: [0.36, 0.86] }, { e: "🍦", to: [0.64, 0.86] }],
      decals: [
        { k: "towel", x0: 0.36, y0: 0.88, x1: 0.44, y1: 0.93, c: "#ff6b6b" },
        { k: "towel", x0: 0.56, y0: 0.88, x1: 0.64, y1: 0.93, c: "#5ec8ff" },
        { k: "rockpool", x: 0.14, y: 0.6, r: 0.04 },
        { k: "rockpool", x: 0.86, y: 0.6, r: 0.04 },
        { k: "footprints", pts: [[0.5, 0.96], [0.46, 0.86], [0.5, 0.76]] },
      ],
      tiers: [
        { r: T1, items: [["🍦", 44], ["⭐", 20], ["🍬", 18, null, 2], ["🪙", 18, null, 3], ["🧃", 14], ["🍓", 14, null, 2], ["🥥", 14]] },
        { r: T2, items: [["🏐", 6, { run: true, zone: "beach" }], ["🩴", 12, null, 2], ["🕶️", 12], ["🧴", 10], ["🍍", 12], ["🥭", 10], ["🪁", 10], ["🍹", 10]] },
        { r: T3, items: [["⛱️", 10, "beach"], ["🪣", 8], ["🛶", 8], ["🧺", 8], ["🪵", 10, null, 2], ["🗿", 6]] },
        { r: T4, items: [["🌳", 10, "grove"], ["⛵", 5], ["🚤", 5], ["🏰", 4, "beach"]] },
        { r: T5, items: [["🛖", 7, "huts"], ["🏖️", 5], ["🏝️", 3], ["⛴️", 3]] },
      ],
      finale: { e: "🌴", r: 20, at: [0.5, 0.1], say: "the giant palm tree" },
    },
