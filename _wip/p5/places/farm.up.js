    {
      // Paddocks of FENCES, and THE TWIST: the giant pumpkin's patch is shut
      // by a locked gate — find the glowing key to open it.
      id: "farm", name: "Sunny Farm", door: "🚜", color: "#ffd166",
      ground: "farm", hole: "gobble",
      wear: ["straw", "#e63946"], air: ["fluff"],
      backdrop: ["#e8f7ff", "#c6e9ff"],
      start: [0.5, 0.92], starters: 3,
      tune: [392, 493.88, 587.33, 783.99],
      blocks: [
        // the long fence across the farm, with two gaps
        { path: [[-0.02, 0.48], [0.2, 0.48]], w: 3.5, look: "fence" },
        { path: [[0.29, 0.48], [0.71, 0.48]], w: 3.5, look: "fence" },
        { path: [[0.8, 0.48], [1.02, 0.48]], w: 3.5, look: "fence" },
        // the pumpkin patch, shut but for its gate. The gap must be narrower
        // than the locked log's core (only Gobble's CENTRE meets a wall): at
        // 0.476-0.524 it was 16.7 units of ground against a 13.4 core, and he
        // could walk past the gate without the key (a test now seals every gate)
        { path: [[0.484, 0.3], [0.3, 0.3], [0.3, -0.02]], w: 3.5, look: "fence" },
        { path: [[0.516, 0.3], [0.7, 0.3], [0.7, -0.02]], w: 3.5, look: "fence" },
        // a little paddock round the barn
        { path: [[0.62, 0.98], [0.62, 0.74], [0.8, 0.74]], w: 3.5, look: "fence" },
      ],
      zones: {
        field: [[0.04, 0.06, 0.27, 0.43], [0.73, 0.06, 0.96, 0.43]],
        patch: [[0.33, 0.04, 0.67, 0.27]],
        veg: [[0.06, 0.54, 0.36, 0.7]],
        orchard: [[0.4, 0.54, 0.94, 0.68]],
        barn: [[0.66, 0.78, 0.95, 0.95]],
      },
      trails: [{ e: "🥕", to: [0.22, 0.66] }, { e: "🥕", to: [0.5, 0.6] }],
      decals: [
        { k: "patch", x: 0.5, y: 0.15, r: 0.15, c: "#c79a5b" },
        { k: "crops", x0: 0.03, y0: 0.05, x1: 0.28, y1: 0.44, c: "#e9c46a" },
        { k: "crops", x0: 0.72, y0: 0.05, x1: 0.97, y1: 0.44, c: "#7cc95a" },
        { k: "soil", x0: 0.05, y0: 0.53, x1: 0.37, y1: 0.71 },
        { k: "shade", x: 0.68, y: 0.61, r: 0.16 },
        { k: "patch", x: 0.81, y: 0.87, r: 0.13, c: "#d6b07a" },
        { k: "tracks", pts: [[0.5, 1.02], [0.47, 0.76], [0.5, 0.6], [0.5, 0.33]] },
        { k: "pond", x: 0.16, y: 0.86, r: 0.06 },
      ],
      tiers: [
        { r: T1, items: [["🥕", 56], ["🌽", 24, "field", 3], ["🍅", 20, "veg", 4], ["🥔", 20, "veg", 4], ["🥚", 18, "barn", 3], ["🫑", 16, null, 2], ["🌱", 8, { sprout: [["🥕", 3, 1]], zone: "veg" }], ["🗝️", 1, { key: "gate", zone: "barn", glow: true }]] },
        { r: T2, items: [["🍎", 20, "orchard", 2], ["🥦", 14, "veg", 2], ["🥬", 14, "patch", 2], ["🍐", 12, "orchard", 2], ["🌻", 16, "field", 4], ["🪣", 10], ["🥛", 10, "barn"]] },
        { r: T3, items: [["🍉", 12], ["🌾", 18, "field", 2], ["🧺", 10], ["🍯", 8, "barn"], ["🪵", 10, null, 2], ["🪵", 1, { at: { pts: [[0.5, 0.3]] }, lock: "gate" }]] },
        { r: T4, items: [["🚜", 10], ["🌳", 10, "orchard"], ["🛻", 8], ["🛖", 6]] },
        { r: T5, items: [["🏡", 8], ["🚛", 8]] },
      ],
      finale: { e: "🎃", r: 20, at: [0.5, 0.13], say: "the giant pumpkin" },
    },
