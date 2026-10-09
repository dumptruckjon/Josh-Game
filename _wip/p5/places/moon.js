    {
      // A GIANT MOON BASE (§17 giant: six sizes, a giant finale), and THE
      // TWIST: great CRATERS to walk round — a huge one cuts the moon nearly
      // in half — and CANNONS that blast Gobble right over them in a low-
      // gravity jump. Moon boots make him ZOOM. The flying saucer waits on the
      // far side.
      id: "moon", name: "Moon Base", door: "🌙", color: "#8a8fa8",
      ground: "moon", hole: "gobble",
      world: [504, 706],
      wear: ["bubble", "#ffffff"], air: ["stars"],
      backdrop: ["#05061a", "#161a3a"],
      start: [0.5, 0.92], starters: 3,
      tune: [261.63, 392, 523.25, 392, 659.25, 523.25],
      land: [{ oval: [0.5, 0.5, 0.48, 0.48] }],
      blocks: [
        { oval: [0.5, 0.36, 0.34, 0.06], look: "crater" },
        { circle: [0.24, 0.66, 0.08], look: "crater" },
        { circle: [0.76, 0.62, 0.09], look: "crater" },
        { circle: [0.5, 0.78, 0.05], look: "crater" },
        { circle: [0.3, 0.16, 0.05], look: "crater" },
      ],
      portals: [
        { a: [0.5, 0.48], b: [0.5, 0.24], oneway: true, fly: true },
        { a: [0.22, 0.48], b: [0.3, 0.26], oneway: true, fly: true },
        { a: [0.78, 0.48], b: [0.7, 0.26], oneway: true, fly: true },
      ],
      zones: {
        base: [[0.34, 0.84, 0.66, 0.94]],
        dome: [[0.06, 0.4, 0.2, 0.56], [0.8, 0.4, 0.94, 0.56]],
        far: [[0.2, 0.06, 0.8, 0.22]],
        rocks: [{ circle: [0.24, 0.66, 0.13] }, { circle: [0.76, 0.62, 0.14] }],
      },
      trails: [{ e: "⭐", to: [0.32, 0.88] }, { e: "⭐", to: [0.68, 0.88] }],
      decals: [
        { k: "nebula", x: 0.2, y: 0.25, r: 0.3, c: "rgba(94,200,255,0.12)" },
        { k: "footprints", pts: [[0.5, 0.96], [0.44, 0.86], [0.5, 0.74], [0.44, 0.6], [0.5, 0.5]] },
        { k: "helipad", x: 0.5, y: 0.48, r: 0.04 },
        { k: "station", x0: 0.36, y0: 0.84, x1: 0.64, y1: 0.93 },
        { k: "gravel", x: 0.8, y: 0.84, r: 0.06 },
      ],
      tiers: [
        { r: T1, items: [["⭐", 52], ["🪨", 24, "rocks", 4], ["🧀", 18, null, 3], ["🔩", 16], ["🔋", 14], ["💎", 16, null, 2], ["🍬", 14], ["🪙", 14]] },
        { r: T2, items: [["🥾", 3, { power: "zoom" }], ["📡", 12, "dome"], ["🔭", 10], ["🧪", 12, "base"], ["🔦", 10], ["🛰️", 12], ["🎒", 10], ["☄️", 14, null, 2], ["🧃", 10]] },
        { r: T3, items: [["🚀", 8], ["🤖", 10, "base"], ["🧰", 8], ["🛢️", 8], ["📦", 10, null, 2], ["🔬", 8]] },
        { r: T4, items: [["🚙", 8], ["🚁", 6], ["⛺", 6, "dome"], ["🚜", 4], ["🛻", 4]] },
        { r: T5, items: [["🏭", 4], ["🛖", 5], ["🚛", 4], ["🚌", 3], ["🏗️", 3]] },
        { r: T6, items: [["🪐", 4, "far"], ["🌍", 2], ["🗻", 3], ["🌋", 3]] },
      ],
      finale: { e: "🛸", r: 28, at: [0.5, 0.12], say: "the flying saucer" },
    },
