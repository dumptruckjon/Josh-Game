    {
      // A round HEDGE MAZE, and THE TWIST: the way in winds round and round —
      // in at the bottom, round to the top, round to the bottom again — the
      // little things on the outside, the big ones deeper in, and the
      // fountain at the very middle — behind a GATE that only the big BUTTON
      // on the far side of the maze opens (a gold wire runs from one to the
      // other).
      id: "maze", name: "Hedge Maze", door: "🌿", color: "#5bbf6a",
      ground: "grass", hole: "gobble",
      wear: ["flower", "#ff7ac0"], air: ["petals", "#ffffff"],
      backdrop: ["#e6f7e9", "#c3ebc9"],
      start: [0.5, 0.94], starters: 3,
      tune: [392, 440, 493.88, 523.25, 587.33, 523.25],
      land: [{ oval: [0.5, 0.5, 0.49, 0.49] }],
      blocks: [
        { path: arcPts(0.5, 0.5, 0.39, 0.39, 98, 442, 48), w: 6, look: "hedge" },
        { path: arcPts(0.5, 0.5, 0.27, 0.27, 278, 622, 40), w: 6, look: "hedge" },
        { path: arcPts(0.5, 0.5, 0.15, 0.15, 98, 442, 30), w: 6, look: "hedge" },
        // spurs: the first lap goes round to the LEFT, the second to the RIGHT
        { path: spokePts(0.5, 0.5, 0.4, 0.26, 72), w: 6, look: "hedge" },
        { path: spokePts(0.5, 0.5, 0.28, 0.14, 252), w: 6, look: "hedge" },
      ],
      zones: {
        outside: { band: [0, 0.3] },
        lap1: { band: [0.2, 0.62] },
        lap2: { band: [0.55, 1] },
      },
      trails: [{ e: "🌼", to: [0.18, 0.75] }, { e: "🌼", to: [0.82, 0.75] }],
      decals: [
        { k: "park", x: 0.5, y: 0.5, r: 0.12 },
        { k: "flowers", x: 0.12, y: 0.3, r: 0.06 },
        { k: "flowers", x: 0.88, y: 0.3, r: 0.06 },
        { k: "flowers", x: 0.14, y: 0.74, r: 0.06 },
        { k: "flowers", x: 0.86, y: 0.74, r: 0.06 },
      ],
      tiers: [
        { r: T1, items: [["🌼", 50], ["🍓", 16, null, 2], ["🌸", 20, "outside", 4], ["🍄", 15, null, 3], ["🔔", 12], ["🫐", 15, null, 3], ["🎀", 12]] },
        { r: T2, items: [["🌷", 16, "lap1", 4], ["🍎", 12], ["🪀", 10], ["🎈", 12, "lap1"], ["🧁", 10], ["🍐", 10], ["🪁", 10, "lap1"]] },
        { r: T3, items: [["🌻", 15, "lap1", 3], ["🪴", 12, "lap2"], ["🧺", 10], ["🎁", 10, "lap2"], ["🏮", 8, "lap2"], ["🚪", 1, { at: { pts: [[0.5, 0.65]] }, lock: "fountain" }]] },
        { r: T4, items: [["🌳", 12, "lap2"], ["🌲", 10, "lap2"], ["⛺", 8, "lap1"], ["🔴", 1, { press: "fountain", at: { pts: [[0.5, 0.29]] } }]] },
        { r: T5, items: [["🏛️", 8, "lap2"], ["🎠", 8, "lap2"]] },
      ],
      finale: { e: "⛲", r: 20, at: [0.5, 0.5], say: "the fountain" },
    },
