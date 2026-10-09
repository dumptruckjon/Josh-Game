    {
      // A RACE TRACK, wide, and THE TWIST: race cars zoom round and round,
      // lightning ⚡ power-ups make Gobble ZOOM too, and the oil drums and
      // petrol pumps by the pits are bumpers that go BOING until he is big
      // enough. The trophy waits on the winners' podium.
      id: "racetrack", name: "Race Track", door: "🏎️", color: "#e63946",
      ground: "tarmac", hole: "gobble",
      world: [560, 460],
      wear: ["cap", "#e63946"], air: ["confetti"],
      backdrop: ["#eef3f8", "#d6e0ea"],
      start: [0.5, 0.94], starters: 3,
      tune: [523.25, 659.25, 783.99, 1046.5, 783.99],
      tracks: { race: { pts: ovalPts(0.5, 0.56, 0.38, 0.27, 32), loop: true, speed: 16, look: "road" } },
      zones: {
        infield: [{ oval: [0.5, 0.56, 0.24, 0.13] }],
        pits: [[0.02, 0.3, 0.1, 0.82], [0.9, 0.3, 0.98, 0.82]],
        stands: [[0.12, 0.04, 0.38, 0.2], [0.62, 0.04, 0.88, 0.2]],
      },
      trails: [{ e: "🏁", to: [0.3, 0.9] }, { e: "🏁", to: [0.7, 0.9] }],
      decals: [
        { k: "podium", x0: 0.43, y0: 0.08, x1: 0.57, y1: 0.18 },
        { k: "zebra", x0: 0.47, y0: 0.78, x1: 0.53, y1: 0.88 },
        { k: "lot", x0: 0.01, y0: 0.3, x1: 0.11, y1: 0.82 },
        { k: "lot", x0: 0.89, y0: 0.3, x1: 0.99, y1: 0.82 },
        { k: "pitch", x0: 0.3, y0: 0.47, x1: 0.7, y1: 0.65 },
      ],
      tiers: [
        { r: T1, items: [["🏁", 34], ["⚡", 4, { power: "zoom" }], ["🪙", 28], ["⭐", 20], ["🔩", 20, "pits"], ["🍬", 16], ["🔑", 14], ["🧃", 14]] },
        { r: T2, items: [["🧢", 12, "stands"], ["🔧", 12, "pits"], ["🪛", 10, "pits"], ["🥤", 12], ["🎟️", 10, "stands"], ["🔋", 12], ["🧤", 10, null, 2]] },
        { r: T3, items: [["🛢️", 6, { bounce: true, zone: "pits" }], ["🚧", 10], ["🛴", 8], ["🚲", 8], ["🎈", 8, "infield"]] },
        { r: T4, items: [["🏎️", 5, { ride: "race" }], ["🚗", 7], ["🚙", 7], ["⛽", 4, { bounce: true }]] },
        { r: T5, items: [["🚚", 5], ["🚛", 4], ["🚌", 4], ["🏢", 3], ["🏟️", 2]] },
      ],
      finale: { e: "🏆", r: 20, at: [0.5, 0.12], say: "the giant trophy" },
    },
