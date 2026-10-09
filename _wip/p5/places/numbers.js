    {
      // NUMBER LAND, shaped like a giant number 8, and THE TWIST: COUNTING —
      // every sock Gobble gulps counts on by TWOS ("two, four, six!"), the
      // socks and the chairs stand in neat rows, and big dice crack open after
      // three bumps. The giant abacus waits at the top of the 8.
      id: "numbers", name: "Number Land", door: "🔢", color: "#5ec8ff",
      ground: "grid", hole: "gobble",
      wear: ["propeller", "#5ec8ff"], air: ["stars"],
      backdrop: ["#eaf6ff", "#c4e4fb"],
      start: [0.5, 0.9], starters: 3,
      tune: [523.25, 587.33, 659.25, 698.46, 783.99, 880],
      count: { e: "🧦", by: 2, say: "socks" },
      land: [
        { ring: [0.5, 0.7, 0.12, 0.44] },
        { ring: [0.5, 0.29, 0.1, 0.38] },
        { oval: [0.5, 0.48, 0.22, 0.05] },
      ],
      zones: {
        toys: [[0.08, 0.6, 0.26, 0.78], [0.74, 0.6, 0.92, 0.78]],
        desk: [[0.12, 0.22, 0.3, 0.38], [0.7, 0.22, 0.88, 0.38]],
        town: [[0.2, 0.46, 0.36, 0.52], [0.64, 0.46, 0.8, 0.52]],
      },
      trails: [{ e: "⭐", to: [0.28, 0.86] }, { e: "⭐", to: [0.72, 0.86] }],
      decals: [
        { k: "mat", x0: 0.28, y0: 0.79, x1: 0.72, y1: 0.87, c: "#5ec8ff" },
        { k: "stripes", x0: 0.3, y0: 0.18, x1: 0.7, y1: 0.26 },
        { k: "splat", x: 0.16, y: 0.7, r: 0.04, c: "#ffd24d" },
        { k: "splat", x: 0.84, y: 0.68, r: 0.04, c: "#ff6b6b" },
      ],
      tiers: [
        { r: T1, items: [["🧦", 20, { at: { grid: [0.3, 0.8, 0.7, 0.86], cols: 10 } }], ["🧦", 14], ["⭐", 18], ["🍪", 16, null, 2], ["🍬", 16], ["🪙", 18, null, 3], ["🟢", 16], ["🧩", 14, "toys"]] },
        { r: T2, items: [["✏️", 12, "desk"], ["📏", 10, "desk"], ["🖍️", 12, null, 2], ["📐", 10], ["🧸", 10, "toys"], ["🎈", 10], ["⏰", 10], ["🧃", 10]] },
        { r: T3, items: [["🎲", 8, { shake: [["⭐", 3, 1], ["🍬", 2, 1]], hits: 3 }], ["📚", 10, "desk"], ["🎨", 8], ["🪁", 8], ["🥁", 6, "toys"], ["🧱", 8]] },
        { r: T4, items: [["🪑", 8, { at: { grid: [0.32, 0.2, 0.68, 0.24], cols: 4 } }], ["🎹", 4], ["📺", 6], ["🚲", 6], ["🧺", 6]] },
        { r: T5, items: [["🏫", 3], ["🏠", 5], ["🚌", 4, "town"], ["🎪", 3], ["🏢", 3, "town"]] },
      ],
      finale: { e: "🧮", r: 20, at: [0.5, 0.13], say: "the giant abacus" },
    },
