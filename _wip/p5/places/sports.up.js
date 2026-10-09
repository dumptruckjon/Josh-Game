    {
      // A STADIUM (two long sides and round ends), and THE TWIST: things in
      // rows and triangles that topple — eat one bowling pin and the whole
      // triangle rolls in after it; balls roll round the running track.
      id: "sports", name: "Sports Day", door: "⚽", color: "#4cc76a",
      ground: "pitch", hole: "gobble",
      wear: ["cap", "#2f6fdb"], air: ["confetti"],
      backdrop: ["#e6f6ff", "#c3e4ff"],
      start: [0.5, 0.92], starters: 3,
      tune: [392, 523.25, 659.25, 783.99, 659.25, 783.99],
      land: [{ path: [[0.5, 0.26], [0.5, 0.74]], w: 390 }],
      tracks: { lane: { pts: capsulePts(0.5, 0.3, 0.7, 0.42, 0.215, 14), loop: true, speed: 15, look: "lane", w: 12 } },
      zones: {
        court: [[0.14, 0.66, 0.4, 0.78]],
        podium: [[0.62, 0.68, 0.86, 0.78]],
        top: [[0.2, 0.18, 0.8, 0.34]],
      },
      trails: [{ e: "🎾", to: [0.3, 0.8] }, { e: "🎾", to: [0.7, 0.8] }],
      decals: [
        { k: "pitch", x0: 0.22, y0: 0.4, x1: 0.78, y1: 0.64 },
        { k: "court", x0: 0.13, y0: 0.65, x1: 0.41, y1: 0.79, c: "#4f8de8" },
        { k: "podium", x0: 0.62, y0: 0.7, x1: 0.86, y1: 0.8 },
        { k: "court", x0: 0.22, y0: 0.2, x1: 0.46, y1: 0.33, c: "#e8874f" },
        { k: "court", x0: 0.54, y0: 0.2, x1: 0.78, y1: 0.33, c: "#7b6be8" },
      ],
      tiers: [
        { r: T1, items: [["🎾", 48], ["⚾", 21, null, 3], ["🥇", 15, "podium", 3], ["🏸", 14, "court", 2], ["🏓", 14, "top", 2], ["🥤", 24, null, 4], ["⚡", 4, { power: "zoom" }], ["⚽", 8, { at: { line: [[0.3, 0.52], [0.7, 0.52]] }, chain: true }]] },
        { r: T2, items: [["🏐", 3, { ride: "lane" }], ["🏀", 14, "court"], ["🏈", 12], ["🥏", 12], ["🧢", 14, null, 2], ["👟", 12, null, 2], ["🎳", 10, { at: { tri: [0.5, 0.86, 7.5] }, chain: true }], ["🥅", 2, { at: { pts: [[0.25, 0.52], [0.75, 0.52]] } }]] },
        { r: T3, items: [["🛹", 12], ["🛼", 10], ["🏆", 4, { at: { line: [[0.64, 0.74], [0.84, 0.74]] } }], ["🏆", 6], ["🏏", 8], ["🏒", 8], ["🎯", 8, "top"]] },
        { r: T4, items: [["🚲", 12], ["🛴", 10], ["⛳", 8], ["🏁", 6]] },
        { r: T5, items: [["🚌", 8], ["🎪", 8]] },
      ],
      finale: { e: "🏟️", r: 20, at: [0.5, 0.11], say: "the stadium" },
    },
