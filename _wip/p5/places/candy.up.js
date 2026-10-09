    {
      // A SPIRAL of a land, and THE TWIST: the only way in is round and round
      // the spiral path — small sweets on the outside, cakes further in, and
      // the giant lollipop right in the middle — and giant GUMBALLS on the
      // path go BOING until he is big enough to gulp them.
      id: "candy", name: "Candy Land", door: "🍭", color: "#ff8ad8",
      ground: "candy", hole: "gobble",
      wear: ["bow", "#ff7ac0"], air: ["sprinkles"],
      backdrop: ["#ffe9f6", "#ffcfee"],
      world: [520, 728],
      start: [0.5, 0.93], starters: 3,
      tune: [659.25, 783.99, 880, 783.99, 659.25, 523.25],
      land: [
        { path: spiralPts(0.5, 0.5, 0.42, 0.42, 0.06, 0.06, 1.5, 72, Math.PI / 2), w: 70 },
        { circle: [0.5, 0.5, 0.12] },
      ],
      zones: {
        outer: { band: [0, 0.4] },
        mid: { band: [0.25, 0.75] },
        inner: { band: [0.5, 1] },
      },
      // a spiral has ONE way in, so ONE trail, leading round it
      trails: [{ e: "🍬", to: [0.1, 0.55] }],
      decals: [
        { k: "heart", x: 0.5, y: 0.5, r: 0.08 },
      ],
      tiers: [
        { r: T1, items: [["🍬", 60], ["🍓", 20, "outer", 2], ["🍫", 16, null, 2], ["🍪", 16, null, 2], ["🍒", 14], ["🍡", 12]] },
        { r: T2, items: [["🧁", 14], ["🍩", 14], ["🍰", 12, "mid"], ["🥧", 10], ["🍮", 10], ["🍦", 10]] },
        { r: T3, items: [["🎂", 10, "mid"], ["🍯", 10], ["🍉", 8], ["🥞", 10], ["🧇", 10], ["🍨", 8], ["🟣", 5, { bounce: true, zone: "mid" }]] },
        { r: T4, items: [["🎁", 10, "inner"], ["🧸", 10, "inner"], ["🪅", 8, "inner"], ["🍄", 6, "inner"], ["🔵", 4, { bounce: true, zone: "inner" }]] },
        { r: T5, items: [["🏰", 4, "inner"], ["🎪", 4, "inner"], ["🏠", 6, "inner"]] },
      ],
      finale: { e: "🍭", r: 20, at: [0.5, 0.5], say: "the giant lollipop" },
    },
