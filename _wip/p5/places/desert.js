    {
      // DESERT DUNES, a WIDE desert, and THE TWIST: QUICKSAND pools he must
      // walk round, the dunes get bigger the further he goes (the things
      // along the way grow with him), and tumbling rocks ROLL AWAY across
      // the sand. The giant cactus stands at the far end.
      id: "desert", name: "Desert Dunes", door: "🏜️", color: "#e0a24a",
      ground: "desert", hole: "gobble",
      wear: ["explorer", "#c98a3a"], air: ["dust"],
      backdrop: ["#fff3d6", "#f7d9a0"],
      world: [560, 460],
      start: [0.07, 0.8], starters: 3,
      tune: [440, 523.25, 587.33, 659.25, 587.33, 440],
      land: [{ rect: [0.02, 0.03, 0.98, 0.97], round: 40 }],
      blocks: [
        { oval: [0.22, 0.42, 0.07, 0.12], look: "quicksand" },
        { oval: [0.4, 0.72, 0.08, 0.1], look: "quicksand" },
        { oval: [0.56, 0.32, 0.07, 0.14], look: "quicksand" },
        { oval: [0.74, 0.68, 0.06, 0.11], look: "quicksand" },
      ],
      zones: {
        near: [{ band: [0, 0.3] }],
        mid: [{ band: [0.3, 0.65] }],
        far: [{ band: [0.65, 1] }],
        oasis: [[0.04, 0.1, 0.16, 0.34]],
        camp: [[0.3, 0.08, 0.46, 0.24]],
        rocks: [[0.6, 0.78, 0.84, 0.94]],
      },
      trails: [{ e: "🌰", to: [0.24, 0.84] }, { e: "🌰", to: [0.16, 0.6] }],
      decals: [
        { k: "drift", x: 0.32, y: 0.3, r: 0.07, c: "#f2c98a" },
        { k: "drift", x: 0.66, y: 0.5, r: 0.08, c: "#f2c98a" },
        { k: "pond", x: 0.1, y: 0.22, r: 0.05 },
        { k: "footprints", pts: [[0.05, 0.86], [0.2, 0.9], [0.34, 0.86], [0.5, 0.88]] },
        { k: "stones", pts: [[0.62, 0.86], [0.7, 0.88], [0.8, 0.86]] },
      ],
      tiers: [
        { r: T1, items: [["🌰", 46], ["🪙", 22, "near"], ["🍬", 16], ["💎", 14, null, 2], ["🥜", 18, null, 3], ["🧃", 14], ["🍪", 16]] },
        { r: T2, items: [["🧭", 12, "near"], ["🍉", 12, "oasis"], ["🥥", 10, "oasis"], ["🗝️", 10], ["🎒", 12], ["🕶️", 12], ["🧢", 10], ["🍯", 10]] },
        { r: T3, items: [["🪨", 6, { run: true, zone: "rocks" }], ["🛢️", 8, "mid"], ["🏺", 10, "mid"], ["🪣", 8], ["⚱️", 8], ["🗿", 6, "mid"], ["🌿", 10, "oasis", 2]] },
        { r: T4, items: [["⛺", 8, "camp"], ["🛻", 6, "far"], ["🚙", 6, "far"], ["🌳", 6, "oasis"], ["🌴", 4, "oasis"]] },
        { r: T5, items: [["🏰", 3, "far"], ["🛖", 6, "far"], ["🚚", 4, "far"], ["🚌", 4]] },
      ],
      finale: { e: "🌵", r: 20, at: [0.9, 0.2], say: "the giant cactus" },
    },
