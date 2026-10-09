    {
      // A HOLIDAY HOTEL, and THE TWIST: a wall runs right across the middle,
      // and only the two LIFTS go up a floor (step in at the bottom, step out
      // at the top — and back). Upstairs, the pool deck and the giant bell
      // sit behind a gate that only the big BUTTON in the lobby opens.
      id: "hotel", name: "Holiday Hotel", door: "🏨", color: "#c0392b",
      ground: "carpet", hole: "gobble",
      wear: ["tophat", "#c0392b", "#ffd24d"], air: ["sparkles", "#ffe9a8"],
      backdrop: ["#fff3e6", "#f7d9c0"],
      start: [0.5, 0.93], starters: 3,
      tune: [523.25, 659.25, 783.99, 659.25, 523.25, 392],
      blocks: [
        // the floor between the lobby and the rooms upstairs (the lifts are the only way up)
        { path: [[-0.02, 0.56], [1.02, 0.56]], w: 5, look: "wall" },
        // the pool deck upstairs, shut but for its gate
        { path: [[0.485, 0.24], [0.16, 0.24], [0.16, -0.02]], w: 5, look: "wall" },
        { path: [[0.515, 0.24], [0.84, 0.24], [0.84, -0.02]], w: 5, look: "wall" },
        // the rooms off the corridor
        { path: [[0.02, 0.38], [0.26, 0.38]], w: 4, look: "wall" },
        { path: [[0.74, 0.38], [0.98, 0.38]], w: 4, look: "wall" },
        // the reception desk in the lobby
        { rect: [0.4, 0.7, 0.6, 0.73], round: 2, look: "wall" },
        // the pool
        { oval: [0.66, 0.11, 0.1, 0.05], look: "water" },
      ],
      portals: [
        { a: [0.09, 0.88], b: [0.91, 0.49], look: "lift" },
        { a: [0.91, 0.88], b: [0.09, 0.49], look: "lift" },
      ],
      zones: {
        lobby: [[0.06, 0.62, 0.34, 0.8], [0.66, 0.62, 0.94, 0.8]],
        rooms: [[0.04, 0.27, 0.24, 0.36], [0.76, 0.27, 0.96, 0.36], [0.04, 0.4, 0.22, 0.53], [0.78, 0.4, 0.96, 0.53]],
        deck: [[0.2, 0.04, 0.5, 0.2]],
      },
      trails: [{ e: "🍬", to: [0.28, 0.9] }, { e: "🍬", to: [0.72, 0.9] }],
      decals: [
        { k: "rug", x: 0.5, y: 0.85, r: 0.14, pal: 2 },
        { k: "mat", x0: 0.3, y0: 0.4, x1: 0.7, y1: 0.53, c: "#c0392b" },
        { k: "towel", x0: 0.22, y0: 0.06, x1: 0.32, y1: 0.12, c: "#5ec8ff" },
        { k: "towel", x0: 0.36, y0: 0.06, x1: 0.46, y1: 0.12, c: "#ffd24d" },
      ],
      tiers: [
        { r: T1, items: [["🍬", 48], ["🍫", 20, null, 3], ["🧼", 16, null, 2], ["🪙", 18], ["🍪", 16], ["🔔", 14], ["🧦", 14, null, 2], ["🖊️", 12]] },
        { r: T2, items: [["🧸", 12], ["🪥", 12, null, 2], ["🕶️", 12, "deck"], ["🎀", 10], ["🧴", 12, "deck"], ["🥐", 14, "lobby"], ["👟", 10, null, 2]] },
        { r: T3, items: [["🧳", 12, "lobby"], ["🪴", 10], ["📺", 8, "rooms"], ["🖼️", 8, "rooms"], ["🧯", 6], ["🪑", 8], ["🚪", 1, { at: { pts: [[0.5, 0.24]] }, lock: "pool" }]] },
        { r: T4, items: [["🛏️", 8, "rooms"], ["🛋️", 7], ["🛒", 6, "lobby"], ["🎹", 3], ["⛱️", 4, "deck"], ["🔴", 1, { press: "pool", at: { pts: [[0.24, 0.66]] } }]] },
        { r: T5, items: [["🚕", 5], ["⛲", 3], ["🚌", 3], ["🎄", 3], ["🗿", 2]] },
      ],
      finale: { e: "🛎️", r: 20, at: [0.5, 0.1], say: "the giant hotel bell" },
    },
