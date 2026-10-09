    {
      // A tall SKI MOUNTAIN, wide at the foot and narrow at the peak, and THE
      // TWIST: two ski SLOPES whoosh Gobble back down the mountain, a frozen
      // pond is slippery, and cable cars ride their wire up and down the side.
      // The snowman waits at the very top.
      id: "mountain", name: "Ski Mountain", door: "🏔️", color: "#2fa3d9",
      ground: "snow", hole: "gobble",
      wear: ["bobble", "#2fa3d9", "#ffffff"], air: ["snow"],
      backdrop: ["#eaf5ff", "#c6e0f7"],
      world: [420, 700],
      start: [0.5, 0.95], starters: 3,
      tune: [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25],
      land: [{ poly: [[0.02, 0.985], [0.98, 0.985], [0.94, 0.62], [0.78, 0.24], [0.66, 0.02], [0.34, 0.02], [0.22, 0.24], [0.06, 0.62]] }],
      blocks: [
        { circle: [0.38, 0.17, 0.035], look: "rock" },
        { circle: [0.64, 0.33, 0.04], look: "rock" },
        { circle: [0.3, 0.72, 0.035], look: "rock" },
      ],
      flows: [
        { pts: [[0.36, 0.2], [0.27, 0.36], [0.2, 0.56]], w: 22, v: 30, look: "ski" },
        { pts: [[0.7, 0.42], [0.8, 0.6], [0.84, 0.78]], w: 22, v: 30, look: "ski" },
      ],
      tracks: { cable: { pts: [[0.6, 0.78], [0.56, 0.12]], speed: 7, look: "wire" } },
      slide: ["pond"],
      zones: {
        pond: [{ circle: [0.48, 0.62, 0.13] }],
        lodge: [[0.08, 0.84, 0.36, 0.95], [0.64, 0.84, 0.92, 0.95]],
        forest: [[0.12, 0.42, 0.24, 0.6], [0.74, 0.22, 0.86, 0.4]],
        peak: [[0.36, 0.06, 0.64, 0.13]],
      },
      trails: [{ e: "❄️", to: [0.3, 0.88] }, { e: "❄️", to: [0.7, 0.88] }],
      decals: [
        { k: "ice", x: 0.48, y: 0.62, r: 0.13 },
        { k: "drift", x: 0.42, y: 0.4, r: 0.07 },
        { k: "drift", x: 0.2, y: 0.8, r: 0.07 },
        { k: "drift", x: 0.8, y: 0.12, r: 0.05 },
        { k: "tracks", c: "rgba(110,140,190,0.45)", pts: [[0.5, 0.94], [0.44, 0.8], [0.42, 0.5], [0.48, 0.3]] },
      ],
      tiers: [
        { r: T1, items: [["❄️", 50], ["🍪", 20, null, 3], ["☕", 16, null, 2], ["🧦", 16, null, 2], ["🔔", 14], ["🧊", 20, "pond", 4], ["🍫", 18], ["🥕", 12]] },
        { r: T2, items: [["🧤", 16, null, 2], ["🧣", 14], ["⛸️", 12, "pond"], ["🥌", 10, "pond"], ["🎒", 12], ["🥾", 12, null, 2], ["🧢", 10]] },
        { r: T3, items: [["🛷", 12], ["🎿", 12], ["🎄", 12, "forest"], ["🪵", 10, null, 2], ["🔦", 8], ["🏒", 8, "pond"]] },
        { r: T4, items: [["🚡", 3, { ride: "cable" }], ["🌲", 14, "forest"], ["🛖", 7, "lodge"], ["🚙", 6], ["⛺", 6]] },
        { r: T5, items: [["🏠", 6, "lodge"], ["🏡", 4], ["🏨", 3], ["🚌", 3], ["🚠", 3]] },
      ],
      finale: { e: "☃️", r: 20, at: [0.5, 0.09], say: "the snowman on the top" },
    },
