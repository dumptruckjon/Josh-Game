    {
      // A HEART, and THE TWIST: presents POP — eat one and out spill sweets —
      // and the PIÑATAS take three good bumps before they burst into treats.
      id: "party", name: "Party Time", door: "🎂", color: "#ff7ac0",
      ground: "party", hole: "gobble",
      wear: ["party", "#ff5e7e"], air: ["confetti"],
      backdrop: ["#fff0f7", "#ffd6ea"],
      start: [0.5, 0.8], starters: 3,
      tune: [523.25, 523.25, 587.33, 523.25, 698.46, 659.25],
      // two ROUND lobes (ovals as seen, so they look round on screen, set far
      // enough apart to leave a real dip between them) and a point, its sides
      // running from the bottom tip to touch each lobe
      land: [
        { oval: [0.29, 0.3, 0.25, 0.18] },
        { oval: [0.71, 0.3, 0.25, 0.18] },
        { poly: [[0.0675, 0.381], [0.5, 0.25], [0.9325, 0.381], [0.5, 0.985]] },
      ],
      zones: {
        table: [[0.1, 0.22, 0.4, 0.36], [0.6, 0.22, 0.9, 0.36]],
        gifts: [[0.2, 0.45, 0.38, 0.56], [0.62, 0.45, 0.8, 0.56]],
        dance: [[0.38, 0.62, 0.62, 0.74]],
      },
      trails: [{ e: "🍬", to: [0.3, 0.6] }, { e: "🍬", to: [0.7, 0.6] }],
      decals: [
        { k: "rug", x: 0.5, y: 0.34, r: 0.13, pal: 3 },
        { k: "heart", x: 0.3, y: 0.52, r: 0.1 },
        { k: "heart", x: 0.7, y: 0.52, r: 0.1 },
        { k: "cloth", x0: 0.09, y0: 0.21, x1: 0.41, y1: 0.37 },
        { k: "cloth", x0: 0.59, y0: 0.21, x1: 0.91, y1: 0.37 },
        { k: "dance", x0: 0.37, y0: 0.61, x1: 0.63, y1: 0.75 },
      ],
      tiers: [
        { r: T1, items: [["🍬", 44], ["🍭", 12], ["🍫", 20, "table", 2], ["💝", 10], ["🍓", 21, "table", 3], ["🎀", 22, null, 2]] },
        { r: T2, items: [["🧁", 14, "table", 2], ["🍩", 12, "table"], ["🍪", 12, "table"], ["🎈", 21, null, 3], ["🎉", 12, "dance"], ["🎊", 10, "dance"]] },
        { r: T3, items: [["🎁", 14, { zone: "gifts", pop: [["🍬", 3, 1], ["🧁", 1, 2]] }], ["🍰", 12, "table"], ["🍕", 12], ["🍿", 10], ["🧸", 10]] },
        { r: T4, items: [["🪅", 9, { shake: [["🍬", 4, 1], ["🍫", 2, 1], ["🧁", 1, 2]], hits: 3 }], ["🪑", 12], ["🪆", 9]] },
        { r: T5, items: [["🎪", 7], ["🎠", 7]] },
      ],
      finale: { e: "🎂", r: 20, at: [0.5, 0.33], say: "the giant cake" },
    },
