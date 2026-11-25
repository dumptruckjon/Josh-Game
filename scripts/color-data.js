// 🎨 Color Book — ALL content (PLAN_COLOR.md): the twelve pages, their
// palettes, what comes alive and what is said. Dual export (window.ColorData +
// module.exports) so the tests read the real pages.
//
// Every page is an ORIGINAL drawing on a 200x200 sheet, built from the shape
// helpers in color-logic.js so the same polygons decide what is drawn, where
// each number goes, and what a tap hits. A region is painted in order: a later
// region covers an earlier one.
//
//   N(pts, n, part)   a region he paints with color n
//   F(pts, hex, part) a FIXED region, already colored (eyes, hubcaps, stars):
//                     anything too small to hold a readable number
//   I(pts, w, part)   an ink LINE drawn over the page (a smile, rungs)
//
// Pages 10-12 are color by MATH: a region with `sum: [a, b]` shows "a+b".

(function (global) {
  "use strict";
  const L = global.ColorLogic || (typeof require === "function" ? require("./color-logic.js") : null);
  if (!L) return;
  const { circle, ellipse, rect, star, poly, path, move, mirror, rotate, clipLine } = L;

  const INK = "#232634", WHITE = "#ffffff";
  const N = (pts, n, part, extra) => Object.assign({ pts, n, part: part || null }, extra || {});
  const F = (pts, fill, part) => ({ pts, fill, part: part || null });
  const I = (pts, w, part, color) => ({ pts, w: w || 2, part: part || null, color: color || INK });
  const S = (reg, a, b) => Object.assign(reg, { sum: [a, b] }); // a math label

  // A friendly cartoon eye: white, pupil looking a little forward, a glint.
  function eye(cx, cy, r, part, look) {
    const lx = look || 0.25;
    return [
      F(circle(cx, cy, r), WHITE, part),
      F(circle(cx + r * lx, cy + r * 0.05, r * 0.55), INK, part),
      F(circle(cx + r * lx + r * 0.18, cy - r * 0.2, r * 0.18), WHITE, part),
    ];
  }
  // An arc of a circle as a line (smiles).
  function arc(cx, cy, r, a0, a1, n) {
    const out = [], k = n || 14;
    for (let i = 0; i <= k; i++) { const t = ((a0 + ((a1 - a0) * i) / k) * Math.PI) / 180; out.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); }
    return out;
  }
  const cloud = (x, y, s, part) => F(path(`M${x - 22 * s} ${y + 8 * s} C${x - 30 * s} ${y + 8 * s} ${x - 30 * s} ${y - 6 * s} ${x - 20 * s} ${y - 6 * s} C${x - 18 * s} ${y - 18 * s} ${x - 2 * s} ${y - 20 * s} ${x + 4 * s} ${y - 10 * s} C${x + 10 * s} ${y - 18 * s} ${x + 26 * s} ${y - 14 * s} ${x + 24 * s} ${y - 2 * s} C${x + 32 * s} ${y} ${x + 30 * s} ${y + 8 * s} ${x + 22 * s} ${y + 8 * s} Z`), WHITE, part);
  // A wheel: a tire he paints and a hub that is already there.
  const wheel = (cx, cy, r, n, part, hub) => [N(circle(cx, cy, r), n, part), F(circle(cx, cy, r * 0.32), hub || "#c9ced8", part), F(circle(cx, cy, r * 0.12), INK, part)];

  // ---- 1. ☀️ Happy Sun --------------------------------------------------------
  function sun() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    for (let k = 0; k < 8; k++) {
      const a = k * 45 + 22.5;
      const p = (r, d) => [100 + Math.cos(((a + d) * Math.PI) / 180) * r, 100 + Math.sin(((a + d) * Math.PI) / 180) * r];
      regs.push(N([p(38, -21), p(94, 0), p(38, 21)], 3, "rays"));
    }
    regs.push(N(circle(100, 100, 52), 2, "face"));
    regs.push(F(ellipse(70, 112, 9, 6), "#ff9bb3", "face"), F(ellipse(130, 112, 9, 6), "#ff9bb3", "face"));
    regs.push(...eye(82, 90, 9, "face", 0), ...eye(118, 90, 9, "face", 0));
    return {
      id: "sun", name: "Happy Sun", say: "the happy sun", icon: "☀️",
      colors: [{ n: 1, hex: "#7cc8ff", name: "blue" }, { n: 2, hex: "#ffd43b", name: "yellow" }, { n: 3, hex: "#ff922b", name: "orange" }],
      regions: regs,
      ink: [I(arc(100, 110, 18, 25, 155), 3, "face")],
      alive: [{ part: "rays", anim: "spin" }, { part: "face", anim: "bob" }],
      cheer: "Look, the sun is shining!",
    };
  }

  // ---- 2. 🐟 Silly Fish -----------------------------------------------------
  function fish() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    regs.push(F(path("M0 178 C40 166 80 186 120 174 C150 166 180 176 200 170 L200 200 L0 200 Z"), "#f3d79b"));
    regs.push(F(circle(36, 52, 7), "#e6f6ff"), F(circle(26, 34, 4.5), "#e6f6ff"), F(circle(44, 24, 3.5), "#e6f6ff"));
    regs.push(N(poly([[62, 100], [18, 62], [30, 100], [18, 140]]), 2, "fish"));
    regs.push(N(path("M74 76 C82 46 112 30 140 40 C128 52 126 64 132 76 Z"), 3, "fish"));
    regs.push(N(poly([[84, 124], [104, 164], [128, 124]]), 3, "fish"));
    regs.push(N(ellipse(108, 100, 52, 36), 2, "fish"));
    regs.push(N(ellipse(92, 100, 10, 32), 3, "fish"));
    regs.push(N(ellipse(122, 100, 10, 31), 3, "fish"));
    regs.push(...eye(142, 90, 10, "fish", 0.3));
    return {
      id: "fish", name: "Silly Fish", say: "the silly fish", icon: "🐟",
      colors: [{ n: 1, hex: "#4dabf7", name: "blue" }, { n: 2, hex: "#ff8c42", name: "orange" }, { n: 3, hex: "#ffe066", name: "yellow" }],
      regions: regs,
      ink: [I(arc(150, 108, 7, 20, 120), 2.6, "fish")],
      alive: [{ part: "fish", anim: "swim" }],
      cheer: "The fish is swimming!",
    };
  }

  // ---- 3. 🍦 Ice Cream ------------------------------------------------------
  function iceCream() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    [[28, 40], [168, 36], [24, 150], [174, 146]].forEach(([x, y]) => regs.push(N(circle(x, y, 11), 4)));
    const cone = poly([[62, 118], [138, 118], [100, 192]]);
    const coneAt = regs.length;
    regs.push(N(cone, 2, "treat"));
    regs.push(N(path("M58 114 C58 86 142 86 142 114 C142 126 132 124 130 132 C128 140 120 140 118 130 C116 122 108 124 106 134 C104 144 94 144 92 134 C90 124 82 124 80 132 C78 140 68 140 66 130 C64 122 58 124 58 114 Z"), 3, "treat"));
    regs.push(N(circle(100, 80, 32), 4, "treat"));
    regs.push(N(circle(100, 46, 26), 3, "treat"));
    regs.push(F(circle(100, 18, 8), "#e03131", "treat"));
    const spr = [["#ffd43b", 86, 40, 30], ["#4dabf7", 112, 38, -20], ["#ffffff", 98, 58, 70], ["#845ef7", 118, 54, 10], ["#ffd43b", 84, 60, -40]];
    spr.forEach(([c, x, y, a]) => regs.push(F(rotate(rect(x - 4, y - 1.6, 8, 3.2, 1.6), a, x, y), c, "treat")));
    const ink = [I([[100, 10], [103, 2], [110, 0]], 2.4, "treat")];
    for (let t = 1; t <= 4; t++) {
      const seg1 = clipLine([40 + t * 22, 118], [40 + t * 22 + 60, 198], cone);
      const seg2 = clipLine([160 - t * 22, 118], [160 - t * 22 - 60, 198], cone);
      if (seg1) ink.push(Object.assign(I(seg1, 1.6, "treat"), { after: coneAt }));
      if (seg2) ink.push(Object.assign(I(seg2, 1.6, "treat"), { after: coneAt }));
    }
    return {
      id: "icecream", name: "Ice Cream", say: "the ice cream", icon: "🍦",
      colors: [{ n: 1, hex: "#c9b6ff", name: "purple" }, { n: 2, hex: "#e0a458", name: "tan" }, { n: 3, hex: "#ff8fb1", name: "pink" }, { n: 4, hex: "#63e6be", name: "mint" }],
      regions: regs, ink,
      alive: [{ part: "treat", anim: "wobble" }],
      cheer: "Yum! What a big ice cream!",
    };
  }

  // ---- 4. 🚀 Rocket ---------------------------------------------------------
  function rocket() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    [[22, 26], [176, 40], [160, 170], [30, 120], [64, 176], [150, 100]].forEach(([x, y], i) => regs.push(F(star(x, y, i % 2 ? 5 : 6.5, i % 2 ? 2.2 : 2.8, 5), "#ffe066")));
    regs.push(N(circle(42, 58, 24), 3));
    regs.push(F(circle(34, 50, 5), "#c0e3ff"), F(circle(50, 66, 3.5), "#c0e3ff"));
    regs.push(N(path("M76 146 C76 172 90 188 100 200 C110 188 124 172 124 146 Z"), 4, "rocket"));
    regs.push(F(path("M94 148 C94 158 97 164 100 170 C103 164 106 158 106 148 Z"), "#ffe066", "rocket"));
    regs.push(N(path("M80 108 C64 118 56 138 58 158 L82 146 Z"), 2, "rocket"));
    regs.push(N(path("M120 108 C136 118 144 138 142 158 L118 146 Z"), 2, "rocket"));
    regs.push(N(path("M78 62 C78 50 122 50 122 62 L122 146 C122 152 78 152 78 146 Z"), 3, "rocket"));
    regs.push(N(path("M78 64 C78 40 92 22 100 12 C108 22 122 40 122 64 Z"), 2, "rocket"));
    regs.push(N(rect(78, 118, 44, 16), 2, "rocket"));
    regs.push(F(circle(100, 90, 15), "#c9ced8", "rocket"), F(circle(100, 90, 10.5), "#a5e3ff", "rocket"), F(ellipse(96, 86, 3.6, 2.4, -30), WHITE, "rocket"));
    return {
      id: "rocket", name: "Rocket", say: "the rocket", icon: "🚀",
      colors: [{ n: 1, hex: "#364fc7", name: "dark blue" }, { n: 2, hex: "#f03e3e", name: "red" }, { n: 3, hex: "#74c0fc", name: "light blue" }, { n: 4, hex: "#ff922b", name: "orange" }],
      regions: regs, ink: [],
      alive: [{ part: "rocket", anim: "launch" }],
      cheer: "Three, two, one, blast off!",
    };
  }

  // ---- 5. 🦕 Dinosaur -------------------------------------------------------
  function dino() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    regs.push(N(circle(36, 36, 18), 4));
    regs.push(cloud(140, 30, 0.9));
    regs.push(N(path("M0 160 C40 150 80 158 120 152 C150 148 180 154 200 150 L200 200 L0 200 Z"), 2));
    regs.push(F(rect(184, 112, 9, 44, 3), "#a0703c"));
    regs.push(N(circle(188, 100, 19), 2));
    // the legs at the back, then the body over them
    regs.push(N(rect(68, 140, 18, 42, 7), 3, "dino"), N(rect(124, 140, 18, 42, 7), 3, "dino"));
    regs.push(N(path("M66 132 C46 138 26 132 8 116 C24 142 46 156 72 152 Z"), 3, "dino"));
    regs.push(N(path("M128 114 C138 92 140 72 142 58 L164 60 C164 80 158 110 148 132 Z"), 3, "dino"));
    regs.push(N(ellipse(105, 130, 48, 30), 3, "dino"));
    regs.push(N(ellipse(160, 54, 20, 14, -8), 3, "dino"));
    regs.push(N(ellipse(105, 150, 30, 9), 4, "dino"));
    regs.push(N(ellipse(88, 118, 10, 8), 5, "dino"), N(ellipse(116, 112, 11, 8), 5, "dino"), N(ellipse(128, 132, 9, 7.5), 5, "dino"));
    regs.push(...eye(166, 50, 6, "dino", 0.3));
    regs.push(F(circle(176, 56, 1.5), INK, "dino"));
    return {
      id: "dino", name: "Dinosaur", say: "the dinosaur", icon: "🦕",
      colors: [{ n: 1, hex: "#a5d8ff", name: "sky blue" }, { n: 2, hex: "#69db7c", name: "green" }, { n: 3, hex: "#38b2ac", name: "teal" }, { n: 4, hex: "#ffd43b", name: "yellow" }, { n: 5, hex: "#ff922b", name: "orange" }],
      regions: regs,
      ink: [I(arc(162, 60, 8, 30, 110), 2.2, "dino")],
      alive: [{ part: "dino", anim: "stomp" }],
      cheer: "Stomp, stomp! The dinosaur is walking!",
    };
  }

  // ---- 6. 🚛 Dump Truck -----------------------------------------------------
  function dumpTruck() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    regs.push(N(circle(170, 32, 17), 3));
    regs.push(cloud(60, 32, 0.85));
    regs.push(N(rect(0, 164, 200, 36), 2));
    // the bed and its load tip together (part "bed")
    regs.push(N(path("M30 72 C34 46 58 36 74 46 C84 30 106 34 114 52 C118 58 118 66 116 72 Z"), 2, "bed"));
    regs.push(N(poly([[26, 66], [118, 66], [112, 134], [34, 134]]), 3, "bed"));
    regs.push(N(rect(114, 82, 62, 58, 10), 3, "cab"));
    regs.push(N(rect(124, 90, 40, 26, 6), 5, "cab"));
    regs.push(F(rect(22, 134, 160, 12, 4), "#495057", "cab"));
    regs.push(F(rect(170, 120, 12, 8, 3), "#ffe066", "cab"));
    regs.push(...wheel(58, 160, 22, 4, "cab"), ...wheel(146, 160, 22, 4, "cab"));
    return {
      id: "dumptruck", name: "Dump Truck", say: "the dump truck", icon: "🚛",
      colors: [{ n: 1, hex: "#a5d8ff", name: "sky blue" }, { n: 2, hex: "#a9744f", name: "brown" }, { n: 3, hex: "#ffc31f", name: "yellow" }, { n: 4, hex: "#495057", name: "gray" }, { n: 5, hex: "#3b8fe0", name: "blue" }],
      regions: regs,
      ink: [I([[40, 80], [110, 80]], 1.6, "bed"), I([[38, 100], [108, 100]], 1.6, "bed")],
      alive: [{ part: "bed", anim: "tip", origin: [116, 134] }, { part: "cab", anim: "rumble" }],
      cheer: "Dump it! Look at all that dirt!",
    };
  }

  // ---- 7. 🚒 Fire Truck -----------------------------------------------------
  function fireTruck() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    regs.push(cloud(48, 30, 0.8), cloud(150, 44, 0.7));
    regs.push(N(rect(0, 166, 200, 34), 2));
    [12, 62, 112, 162].forEach((x) => regs.push(F(rect(x, 182, 26, 5, 2), "#f8f9fa")));
    regs.push(N(rect(12, 92, 124, 60, 6), 3, "truck"));
    regs.push(N(rect(128, 70, 62, 82, 12), 3, "truck"));
    regs.push(N(rect(140, 80, 38, 26, 6), 5, "truck"));
    regs.push(N(rect(18, 72, 112, 18, 3), 4, "truck"));
    regs.push(N(rect(12, 124, 178, 15), 4, "truck"));
    regs.push(N(rect(150, 56, 22, 16, 6), 5, "siren"));
    regs.push(F(circle(40, 110, 9), "#ced4da", "truck"), F(circle(40, 110, 4), "#868e96", "truck"));
    regs.push(...wheel(42, 162, 20, 6, "truck"), ...wheel(98, 162, 20, 6, "truck"), ...wheel(158, 162, 20, 6, "truck"));
    const ink = [];
    for (let x = 40; x < 130; x += 24) ink.push(I([[x, 72], [x, 90]], 2, "truck"));
    return {
      id: "firetruck", name: "Fire Truck", say: "the fire truck", icon: "🚒",
      colors: [{ n: 1, hex: "#a5d8ff", name: "sky blue" }, { n: 2, hex: "#868e96", name: "gray" }, { n: 3, hex: "#f03e3e", name: "red" }, { n: 4, hex: "#ffd43b", name: "yellow" }, { n: 5, hex: "#4dabf7", name: "blue" }, { n: 6, hex: "#343a40", name: "black" }],
      regions: regs, ink,
      alive: [{ part: "siren", anim: "flash" }, { part: "truck", anim: "rumble" }],
      cheer: "Wee-woo! The fire truck is on its way!",
    };
  }

  // ---- 8. 🏰 Castle ---------------------------------------------------------
  function castle() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    regs.push(cloud(40, 28, 0.8), cloud(166, 22, 0.7));
    regs.push(N(path("M0 150 C40 128 90 138 120 146 C150 130 180 134 200 140 L200 200 L0 200 Z"), 2));
    // flags and poles first, so the roofs sit over their poles
    for (const x of [44, 156]) {
      regs.push(F(rect(x - 1.5, 14, 3, 30, 1), "#5c5f66", "castle"));
      regs.push(N(path(`M${x + 1} 16 C${x + 12} 12 ${x + 20} 22 ${x + 30} 18 L${x + 30} 36 C${x + 20} 40 ${x + 12} 30 ${x + 1} 34 Z`), 5, "flag"));
    }
    const tower = (x) => path(`M${x} 78 L${x} 70 L${x + 10} 70 L${x + 10} 78 L${x + 17} 78 L${x + 17} 70 L${x + 27} 70 L${x + 27} 78 L${x + 34} 78 L${x + 34} 70 L${x + 44} 70 L${x + 44} 186 L${x} 186 Z`);
    regs.push(N(tower(22), 3, "castle"), N(tower(134), 3, "castle"));
    regs.push(N(path("M60 112 L60 102 L72 102 L72 112 L84 112 L84 102 L96 102 L96 112 L104 112 L104 102 L116 102 L116 112 L128 112 L128 102 L140 102 L140 186 L60 186 Z"), 3, "castle"));
    regs.push(N(poly([[18, 76], [44, 34], [70, 76]]), 4, "castle"), N(poly([[130, 76], [156, 34], [182, 76]]), 4, "castle"));
    regs.push(N(path("M84 186 L84 150 C84 128 116 128 116 150 L116 186 Z"), 6, "castle"));
    for (const [x, y] of [[36, 108], [148, 108], [36, 144], [148, 144]]) regs.push(F(path(`M${x} ${y + 14} L${x} ${y + 4} C${x} ${y - 3} ${x + 16} ${y - 3} ${x + 16} ${y + 4} L${x + 16} ${y + 14} Z`), INK, "castle"));
    regs.push(F(circle(100, 124, 6), "#ffd43b", "castle"));
    return {
      id: "castle", name: "Castle", say: "the castle", icon: "🏰",
      colors: [{ n: 1, hex: "#a5d8ff", name: "sky blue" }, { n: 2, hex: "#69db7c", name: "green" }, { n: 3, hex: "#adb5bd", name: "gray" }, { n: 4, hex: "#9775fa", name: "purple" }, { n: 5, hex: "#f03e3e", name: "red" }, { n: 6, hex: "#a9744f", name: "brown" }],
      regions: regs,
      ink: [I([[100, 140], [100, 186]], 1.6, "castle")],
      alive: [{ part: "flag", anim: "wave" }],
      cheer: "The flags are waving on your castle!",
    };
  }

  // ---- 9. 🏴‍☠️ Pirate Ship ------------------------------------------------------
  function pirateShip() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    regs.push(N(circle(170, 34, 18), 6));
    regs.push(cloud(42, 30, 0.8));
    regs.push(N(path("M0 150 C30 140 60 156 100 146 C140 136 170 152 200 144 L200 200 L0 200 Z"), 2));
    regs.push(F(rect(97, 24, 6, 120, 2), "#7a4b2a", "ship"));
    regs.push(N(path("M103 22 L141 26 L141 50 L103 46 Z"), 7, "ship"));
    regs.push(N(path("M58 52 C78 48 92 48 96 52 L96 98 C88 102 74 102 56 98 C62 84 62 66 58 52 Z"), 4, "ship"));
    regs.push(N(path("M104 52 C118 48 136 48 148 52 C144 66 144 84 150 98 C134 102 116 102 104 98 Z"), 4, "ship"));
    regs.push(N(path("M58 64 C72 62 86 62 96 64 L96 79 C86 77 72 77 60 79 C61 74 61 69 58 64 Z"), 5, "ship"));
    regs.push(N(path("M104 64 C118 62 132 62 146 64 C145 69 145 74 147 79 C132 77 118 77 104 79 Z"), 5, "ship"));
    regs.push(N(path("M26 108 L174 108 C168 132 156 148 140 152 L60 152 C44 148 32 132 26 108 Z"), 3, "ship"));
    for (const x of [62, 92, 122]) regs.push(F(circle(x + 8, 126, 6.5), "#ffe8a3", "ship"), F(circle(x + 8, 126, 4), INK, "ship"));
    regs.push(N(path("M0 166 C24 156 44 170 70 162 C96 154 118 170 144 162 C168 154 186 166 200 160 L200 200 L0 200 Z"), 2));
    return {
      id: "pirate", name: "Pirate Ship", say: "the pirate ship", icon: "🏴‍☠️",
      colors: [{ n: 1, hex: "#a5d8ff", name: "sky blue" }, { n: 2, hex: "#1c7ed6", name: "blue" }, { n: 3, hex: "#a9744f", name: "brown" }, { n: 4, hex: "#ffe8b5", name: "cream" }, { n: 5, hex: "#f03e3e", name: "red" }, { n: 6, hex: "#ffd43b", name: "yellow" }, { n: 7, hex: "#343a40", name: "black" }],
      regions: regs,
      ink: [I([[26, 108], [174, 108]], 2, "ship")],
      alive: [{ part: "ship", anim: "rock", origin: [100, 150] }],
      cheer: "Ahoy! The pirate ship is sailing!",
    };
  }

  // ---- 10. 🤖 Robot (color by math) -------------------------------------------
  function robot() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    for (const [x, y] of [[26, 30], [174, 34], [22, 170], [178, 168]]) regs.push(N(star(x, y, 18, 8.5, 5), 6));
    regs.push(F(rect(98, 18, 4, 18, 2), "#5c5f66", "head"));
    regs.push(N(circle(100, 18, 9), 3, "head"));
    regs.push(N(rect(64, 34, 72, 52, 12), 2, "head"));
    regs.push(...eye(84, 56, 9, "head", 0), ...eye(116, 56, 9, "head", 0));
    regs.push(N(rect(78, 68, 44, 15, 6), 4, "head"));
    regs.push(F(rect(92, 86, 16, 8, 2), "#868e96"));
    regs.push(N(rect(68, 136, 22, 40, 6), 2), N(rect(110, 136, 22, 40, 6), 2));
    regs.push(N(rect(60, 172, 34, 16, 7), 7), N(rect(106, 172, 34, 16, 7), 7));
    regs.push(S(N(rect(26, 96, 26, 50, 12), 2), 1, 1));
    regs.push(S(N(rect(148, 96, 26, 50, 12), 2, "arm"), 1, 1));
    regs.push(N(circle(39, 152, 11), 7), N(circle(161, 152, 11), 7, "arm"));
    regs.push(N(rect(52, 92, 96, 52, 12), 2));
    regs.push(S(N(rect(70, 100, 60, 26, 6), 5), 2, 3));
    regs.push(N(circle(76, 135, 8), 3), N(circle(100, 135, 8), 4), N(circle(124, 135, 8), 6));
    const ink = [];
    return {
      id: "robot", name: "Robot", say: "the robot", icon: "🤖", math: true,
      colors: [{ n: 1, hex: "#d0ebff", name: "light blue" }, { n: 2, hex: "#adb5bd", name: "silver" }, { n: 3, hex: "#f03e3e", name: "red" }, { n: 4, hex: "#ffd43b", name: "yellow" }, { n: 5, hex: "#51cf66", name: "green" }, { n: 6, hex: "#ff922b", name: "orange" }, { n: 7, hex: "#7950f2", name: "purple" }],
      regions: regs, ink,
      alive: [{ part: "arm", anim: "wave", origin: [155, 102] }, { part: "head", anim: "bob" }],
      cheer: "Beep boop! The robot says hello!",
    };
  }

  // ---- 11. 🐉 Dragon (color by math) --------------------------------------------
  function dragon() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    regs.push(N(path("M0 124 L26 76 L46 106 L74 60 L104 116 L0 116 Z"), 8));
    regs.push(F(path("M64 78 L74 60 L84 78 L78 74 L72 80 Z"), WHITE), F(path("M19 88 L26 76 L33 88 L28 85 L24 90 Z"), WHITE));
    regs.push(S(N(path("M0 160 C40 148 90 158 130 152 C160 148 184 154 200 150 L200 200 L0 200 Z"), 2), 1, 1));
    // tail, body, belly, legs, the wing over the back, then neck and head
    regs.push(N(path("M58 150 C36 164 14 154 8 128 C24 142 40 140 62 130 Z"), 3, "dragon"));
    regs.push(N(poly([[0, 112], [28, 102], [22, 148]]), 6, "dragon"));
    regs.push(N(rect(60, 150, 20, 34, 8), 3, "dragon"), N(rect(98, 150, 20, 34, 8), 3, "dragon"));
    regs.push(S(N(ellipse(88, 136, 40, 28), 3, "dragon"), 1, 2));
    regs.push(N(ellipse(94, 148, 24, 11), 4, "dragon"));
    for (const [x, y] of [[66, 108], [84, 104], [102, 108]]) regs.push(F(poly([[x - 7, y + 4], [x, y - 8], [x + 7, y + 4]]), "#ff922b", "dragon"));
    regs.push(S(N(path("M96 118 C94 78 74 40 38 24 Q34 52 16 72 Q30 80 34 96 Q48 98 54 110 Q66 112 74 128 Z"), 5, "wing"), 2, 3));
    regs.push(N(path("M104 126 C114 108 120 94 126 82 L146 88 C140 104 130 122 120 136 Z"), 3, "dragon"));
    regs.push(F(poly([[128, 62], [124, 42], [138, 56]]), "#ff922b", "dragon"), F(poly([[142, 56], [146, 38], [154, 56]]), "#ff922b", "dragon"));
    regs.push(N(path("M124 70 C128 54 152 50 162 60 C176 60 182 70 180 80 C178 90 166 92 156 90 L136 90 C126 86 122 78 124 70 Z"), 3, "dragon"));
    regs.push(N(path("M168 80 C176 76 182 72 186 62 C188 70 192 72 198 68 C194 76 196 80 200 82 C196 88 198 94 200 100 C192 96 186 98 182 104 C180 96 174 92 168 90 Z"), 7, "fire"));
    regs.push(...eye(146, 68, 6.5, "dragon", 0.3));
    regs.push(F(circle(172, 72, 1.6), INK, "dragon"));
    return {
      id: "dragon", name: "Dragon", say: "the dragon", icon: "🐉", math: true,
      colors: [{ n: 1, hex: "#ffe3e3", name: "pink" }, { n: 2, hex: "#8ce99a", name: "green" }, { n: 3, hex: "#37b24d", name: "dark green" }, { n: 4, hex: "#ffd43b", name: "yellow" }, { n: 5, hex: "#9775fa", name: "purple" }, { n: 6, hex: "#ff922b", name: "orange" }, { n: 7, hex: "#f03e3e", name: "red" }, { n: 8, hex: "#868e96", name: "gray" }],
      regions: regs,
      ink: [I(arc(162, 84, 7, 30, 100), 2, "dragon")],
      alive: [{ part: "wing", anim: "flap", origin: [74, 118] }, { part: "fire", anim: "flicker", origin: [170, 84] }],
      cheer: "Roar! The dragon is breathing fire!",
    };
  }

  // ---- 12. 🛻 Monster Truck (color by math) -------------------------------------
  function monsterTruck() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    regs.push(N(circle(32, 30, 18), 8));
    regs.push(cloud(140, 28, 0.85));
    regs.push(N(path("M0 108 C40 92 80 104 110 98 C150 90 180 100 200 94 L200 140 L0 140 Z"), 7));
    regs.push(S(N(path("M0 170 C40 160 90 172 130 164 C160 158 184 166 200 162 L200 200 L0 200 Z"), 2), 1, 1));
    regs.push(F(rect(46, 120, 108, 10, 4), "#495057", "truck"));
    regs.push(S(N(path("M20 104 L72 104 L86 76 L140 76 L152 104 L184 106 C188 108 188 126 184 130 L20 130 C16 126 16 108 20 104 Z"), 3, "truck"), 1, 2));
    regs.push(N(path("M92 84 L118 84 L118 102 L84 102 Z"), 5, "truck"));
    regs.push(N(path("M124 84 L136 84 L144 102 L124 102 Z"), 5, "truck"));
    regs.push(N(path("M26 110 C40 100 50 118 62 104 C70 116 82 106 92 114 L92 128 L26 128 Z"), 6, "truck"));
    regs.push(F(rect(178, 110, 8, 8, 3), "#ffe066", "truck"));
    for (const x of [52, 148]) {
      regs.push(N(circle(x, 156, 33), 4, "wheels"));
      regs.push(N(circle(x, 156, 13), 8, "wheels"));
    }
    const ink = [];
    for (const x of [52, 148]) for (let k = 0; k < 10; k++) {
      const a = (k * 36 * Math.PI) / 180;
      ink.push(I([[x + Math.cos(a) * 29, 156 + Math.sin(a) * 29], [x + Math.cos(a) * 33, 156 + Math.sin(a) * 33]], 2.6, "wheels"));
    }
    return {
      id: "monster", name: "Monster Truck", say: "the monster truck", icon: "🛻", math: true,
      colors: [{ n: 1, hex: "#a5d8ff", name: "sky blue" }, { n: 2, hex: "#a9744f", name: "brown" }, { n: 3, hex: "#1c7ed6", name: "blue" }, { n: 4, hex: "#343a40", name: "black" }, { n: 5, hex: "#66d9e8", name: "light blue" }, { n: 6, hex: "#ff6b00", name: "orange" }, { n: 7, hex: "#82c91e", name: "green" }, { n: 8, hex: "#ffd43b", name: "yellow" }],
      regions: regs, ink,
      alive: [{ part: "truck", anim: "bounce" }, { part: "wheels", anim: "bounce" }],
      cheer: "Vroom! The monster truck jumps!",
    };
  }

  // ===== The other shelves (the owner, 2026-11-25: "all six") ==============
  const D_ = (reg, a, b) => Object.assign(reg, { diff: [a, b] }); // a take-away label

  // A circle cut in half down x = cx (a ladybug's wing case).
  function halfCircle(cx, cy, r, side) {
    const out = [[cx, cy - r]];
    for (let k = 0; k <= 24; k++) { const t = -Math.PI / 2 + (side * Math.PI * k) / 24; out.push([cx + Math.cos(t) * r * side * side, cy + Math.sin(t) * r]); }
    return out.map((q) => [cx + Math.abs(q[0] - cx) * side, q[1]]);
  }

  // ---- 🎲 Count the dots: each shape shows a die's dots; count them, find the pot
  function ladybug() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    regs.push(N(ellipse(100, 140, 96, 54, -8), 2, "bug"));
    regs.push(F(circle(100, 60, 22), INK, "bug"));
    regs.push(...eye(91, 54, 5, "bug", 0), ...eye(109, 54, 5, "bug", 0));
    regs.push(N(halfCircle(100, 112, 50, -1), 3, "bug"), N(halfCircle(100, 112, 50, 1), 3, "bug"));
    for (const [x, y] of [[66, 96], [134, 96], [70, 140], [130, 140]]) regs.push(F(circle(x, y, 7), INK, "bug"));
    return {
      id: "ladybug", name: "Ladybug", say: "the ladybug", icon: "🐞", label: "dots",
      colors: [{ n: 1, hex: "#a5d8ff", name: "sky blue" }, { n: 2, hex: "#69db7c", name: "green" }, { n: 3, hex: "#f03e3e", name: "red" }],
      regions: regs,
      ink: [I([[92, 42], [82, 22]], 2.4, "bug"), I([[108, 42], [118, 22]], 2.4, "bug"), I([[100, 64], [100, 160]], 2.4, "bug")],
      alive: [{ part: "bug", anim: "wobble" }],
      cheer: "The ladybug is ready to fly!",
    };
  }
  function caterpillar() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    regs.push(N(circle(168, 34, 22), 3));
    regs.push(cloud(56, 30, 0.85));
    regs.push(N(path("M0 156 C40 146 80 160 120 150 C150 144 180 152 200 146 L200 200 L0 200 Z"), 2));
    const xs = [30, 62, 94, 126];
    xs.forEach((x, k) => regs.push(N(circle(x, 128, 22), k % 2 ? 4 : 3, "bug")));
    regs.push(F(circle(160, 112, 26), "#9775fa", "bug"));
    regs.push(...eye(152, 104, 6, "bug", 0.3), ...eye(170, 104, 6, "bug", 0.3));
    return {
      id: "caterpillar", name: "Caterpillar", say: "the caterpillar", icon: "🐛", label: "dots",
      colors: [{ n: 1, hex: "#a5d8ff", name: "sky blue" }, { n: 2, hex: "#40c057", name: "green" }, { n: 3, hex: "#ffd43b", name: "yellow" }, { n: 4, hex: "#9775fa", name: "purple" }],
      regions: regs,
      ink: [I(arc(162, 118, 8, 30, 150), 2.2, "bug"), I([[150, 88], [142, 70]], 2.2, "bug"), I([[170, 88], [178, 70]], 2.2, "bug")],
      alive: [{ part: "bug", anim: "swim" }],
      cheer: "Wiggle, wiggle! The caterpillar is crawling!",
    };
  }
  function flowerPot() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    regs.push(F(rect(96, 92, 8, 60, 3), "#2f9e44", "flower"));
    regs.push(N(ellipse(70, 122, 28, 15, -25), 2, "flower"), N(ellipse(130, 122, 28, 15, 25), 2, "flower"));
    for (let k = 0; k < 6; k++) {
      const a = (k * 60 - 90) * Math.PI / 180;
      regs.push(N(ellipse(100 + Math.cos(a) * 36, 64 + Math.sin(a) * 36, 22, 16, k * 60 - 90), 3, "flower"));
    }
    regs.push(N(circle(100, 64, 20), 4, "flower"));
    regs.push(N(poly([[52, 142], [148, 142], [134, 198], [66, 198]]), 5));
    return {
      id: "flowerpot", name: "Flower Pot", say: "the flower pot", icon: "🌼", label: "dots",
      colors: [{ n: 1, hex: "#a5d8ff", name: "sky blue" }, { n: 2, hex: "#69db7c", name: "green" }, { n: 3, hex: "#ff8fb1", name: "pink" }, { n: 4, hex: "#ffd43b", name: "yellow" }, { n: 5, hex: "#a9744f", name: "brown" }],
      regions: regs,
      ink: [],
      alive: [{ part: "flower", anim: "wobble" }],
      cheer: "Your flower is growing!",
    };
  }

  // ---- 🏮 一 二 三: the numbers are written in Chinese
  function panda() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    for (const x of [8, 172]) {
      regs.push(N(rect(x, 0, 22, 200, 4), 2));
      regs.push(N(ellipse(x + (x < 100 ? 30 : -8), 54, 22, 10, x < 100 ? -25 : 25), 2));
    }
    regs.push(N(circle(64, 50, 16), 3, "panda"), N(circle(136, 50, 16), 3, "panda"));
    regs.push(N(ellipse(56, 150, 21, 31, 20), 3, "panda"), N(ellipse(144, 150, 21, 31, -20), 3, "panda"));
    regs.push(F(ellipse(100, 154, 46, 40), WHITE, "panda"));
    regs.push(N(ellipse(74, 186, 22, 13), 3, "panda"), N(ellipse(126, 186, 22, 13), 3, "panda"));
    regs.push(F(circle(100, 84, 46), WHITE, "panda"));
    regs.push(N(ellipse(80, 82, 13, 16, 20), 3, "panda"), N(ellipse(120, 82, 13, 16, -20), 3, "panda"));
    regs.push(F(circle(82, 76, 4.5), WHITE, "panda"), F(circle(118, 76, 4.5), WHITE, "panda"));
    regs.push(F(ellipse(100, 100, 7, 5), INK, "panda"));
    return {
      id: "panda", name: "Panda", say: "the panda", icon: "🐼", label: "zh",
      colors: [{ n: 1, hex: "#d3f9d8", name: "light green" }, { n: 2, hex: "#40c057", name: "green" }, { n: 3, hex: "#343a40", name: "black" }],
      regions: regs,
      ink: [I(arc(100, 104, 9, 30, 150), 2.4, "panda")],
      alive: [{ part: "panda", anim: "bob" }],
      cheer: "The panda says hello!", cheerZh: "你好",
    };
  }
  function lantern() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    regs.push(N(circle(34, 34, 20), 3));
    [[160, 22], [184, 50], [70, 20], [24, 176], [176, 178]].forEach(([x, y]) => regs.push(F(star(x, y, 5, 2.2, 5), "#ffe066")));
    regs.push(F(rect(98, 0, 4, 42, 1), "#ffd43b", "lantern"));
    regs.push(N(rect(70, 28, 60, 22, 5), 3, "lantern"));
    regs.push(N(ellipse(100, 100, 66, 52), 2, "lantern"));
    regs.push(N(ellipse(100, 100, 24, 52), 4, "lantern"));
    regs.push(N(rect(74, 146, 52, 18, 5), 3, "lantern"));
    regs.push(F(rect(97, 164, 6, 30, 2), "#f03e3e", "lantern"));
    return {
      id: "lantern", name: "Lantern", say: "the lantern", icon: "🏮", label: "zh",
      colors: [{ n: 1, hex: "#364fc7", name: "dark blue" }, { n: 2, hex: "#f03e3e", name: "red" }, { n: 3, hex: "#ffd43b", name: "yellow" }, { n: 4, hex: "#ff922b", name: "orange" }],
      regions: regs,
      ink: [I([[52, 64], [52, 136]], 1.6, "lantern"), I([[148, 64], [148, 136]], 1.6, "lantern")],
      alive: [{ part: "lantern", anim: "rock", origin: [100, 0] }],
      cheer: "The lantern is glowing!", cheerZh: "新年快乐",
    };
  }
  function dragonBoat() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    regs.push(N(circle(170, 32, 18), 4));
    regs.push(N(path("M0 110 L40 60 L76 104 L112 50 L160 104 L200 76 L200 130 L0 130 Z"), 5));
    regs.push(N(rect(0, 128, 200, 72), 2));
    for (const x of [52, 82, 112, 142]) regs.push(F(rect(x - 7, 100, 14, 22, 6), "#e8590c", "boat"), F(circle(x, 94, 7.5), "#ffd8a8", "boat"));
    regs.push(N(path("M14 118 L186 118 C176 146 156 156 130 158 L70 158 C44 156 24 146 14 118 Z"), 3, "boat"));
    regs.push(N(path("M160 120 C164 96 176 84 196 86 C200 98 194 108 184 112 L176 120 Z"), 4, "boat"));
    regs.push(N(poly([[0, 78], [38, 118], [0, 118]]), 4, "boat"));
    regs.push(...eye(184, 96, 4, "boat", 0.3));
    regs.push(N(path("M0 172 C30 162 60 178 100 168 C140 158 170 176 200 166 L200 200 L0 200 Z"), 2));
    return {
      id: "dragonboat", name: "Dragon Boat", say: "the dragon boat", icon: "🛶", label: "zh",
      colors: [{ n: 1, hex: "#a5d8ff", name: "sky blue" }, { n: 2, hex: "#1c7ed6", name: "blue" }, { n: 3, hex: "#f03e3e", name: "red" }, { n: 4, hex: "#ffd43b", name: "yellow" }, { n: 5, hex: "#40c057", name: "green" }],
      regions: regs,
      ink: [52, 82, 112, 142].map((x) => I([[x + 6, 108], [x - 16, 170]], 2.6, "boat", "#7a4b2a")),
      alive: [{ part: "boat", anim: "rock", origin: [100, 150] }],
      cheer: "Row, row! The dragon boat is racing!",
    };
  }

  // ---- ➖ Take away: a shape shows a−b; color it with what is left
  function snowman() {
    const regs = [D_(N(rect(0, 0, 200, 200), 1), 3, 2)];
    regs.push(D_(N(circle(162, 36, 22), 5), 7, 2));
    [[30, 30], [70, 50], [120, 20], [24, 96], [186, 96]].forEach(([x, y]) => regs.push(F(star(x, y, 5, 2.2, 5), "#ffe066")));
    regs.push(D_(N(path("M0 150 C40 138 80 148 120 140 C150 134 180 144 200 138 L200 200 L0 200 Z"), 2), 4, 2));
    regs.push(F(circle(100, 150, 40), WHITE, "snowman"), F(circle(100, 92, 30), WHITE, "snowman"));
    regs.push(N(rect(68, 112, 64, 16, 7), 4, "snowman"));
    regs.push(N(rect(70, 66, 60, 18, 4), 3, "snowman"), D_(N(rect(80, 26, 40, 42, 4), 3, "snowman"), 5, 2));
    regs.push(F(circle(90, 90, 3.5), INK, "snowman"), F(circle(110, 90, 3.5), INK, "snowman"));
    regs.push(F(poly([[100, 96], [124, 100], [100, 102]]), "#ff922b", "snowman"));
    for (const y of [140, 154, 168]) regs.push(F(circle(100, y, 3.5), INK, "snowman"));
    return {
      id: "snowman", name: "Snowman", say: "the snowman", icon: "⛄", math: true,
      colors: [{ n: 1, hex: "#364fc7", name: "dark blue" }, { n: 2, hex: "#a5d8ff", name: "light blue" }, { n: 3, hex: "#343a40", name: "black" }, { n: 4, hex: "#f03e3e", name: "red" }, { n: 5, hex: "#ffd43b", name: "yellow" }],
      regions: regs, ink: [],
      alive: [{ part: "snowman", anim: "wobble" }],
      cheer: "Brrr! The snowman says hello!",
    };
  }
  function hotAirBalloon() {
    const regs = [D_(N(rect(0, 0, 200, 200), 1), 2, 1)];
    regs.push(cloud(40, 40, 0.9), cloud(166, 70, 0.75));
    regs.push(D_(N(path("M0 168 C40 150 80 164 120 154 C150 146 180 158 200 150 L200 200 L0 200 Z"), 4), 6, 2));
    regs.push(F(poly([[74, 128], [80, 128], [92, 152], [88, 152]]), "#7a4b2a", "balloon"), F(poly([[126, 128], [120, 128], [108, 152], [112, 152]]), "#7a4b2a", "balloon"));
    regs.push(D_(N(path("M100 14 C150 14 164 54 156 82 C148 108 124 120 114 130 L86 130 C76 120 52 108 44 82 C36 54 50 14 100 14 Z"), 2, "balloon"), 4, 2));
    regs.push(N(ellipse(100, 70, 30, 56), 3, "balloon"));
    regs.push(D_(N(ellipse(100, 70, 13, 56), 6, "balloon"), 9, 3));
    regs.push(D_(N(rect(82, 150, 36, 28, 5), 5, "balloon"), 6, 1));
    return {
      id: "balloon", name: "Hot Air Balloon", say: "the hot air balloon", icon: "🎈", math: true,
      colors: [{ n: 1, hex: "#a5d8ff", name: "sky blue" }, { n: 2, hex: "#f03e3e", name: "red" }, { n: 3, hex: "#ffd43b", name: "yellow" }, { n: 4, hex: "#40c057", name: "green" }, { n: 5, hex: "#a9744f", name: "brown" }, { n: 6, hex: "#9775fa", name: "purple" }],
      regions: regs, ink: [],
      alive: [{ part: "balloon", anim: "bob" }],
      cheer: "Up, up and away!",
    };
  }
  function sailboat() {
    const regs = [D_(N(rect(0, 0, 200, 200), 1), 4, 3)];
    regs.push(D_(N(circle(36, 36, 22), 6), 8, 2));
    regs.push(cloud(150, 30, 0.8));
    regs.push(D_(N(rect(0, 134, 200, 66), 2), 5, 3));
    regs.push(F(rect(97, 22, 6, 112, 2), "#7a4b2a", "boat"));
    regs.push(D_(N(poly([[94, 26], [94, 118], [38, 118]]), 3, "boat"), 7, 4));
    regs.push(D_(N(poly([[106, 34], [106, 118], [156, 118]]), 4, "boat"), 6, 2));
    regs.push(D_(N(path("M28 122 L172 122 C164 140 150 150 134 152 L66 152 C50 150 36 140 28 122 Z"), 5, "boat"), 8, 3));
    regs.push(N(path("M0 172 C30 162 60 178 100 168 C140 158 170 176 200 166 L200 200 L0 200 Z"), 2));
    return {
      id: "sailboat", name: "Sailboat", say: "the sailboat", icon: "⛵", math: true,
      colors: [{ n: 1, hex: "#d0ebff", name: "light blue" }, { n: 2, hex: "#1c7ed6", name: "blue" }, { n: 3, hex: "#ffd43b", name: "yellow" }, { n: 4, hex: "#f03e3e", name: "red" }, { n: 5, hex: "#a9744f", name: "brown" }, { n: 6, hex: "#ff922b", name: "orange" }],
      regions: regs, ink: [],
      alive: [{ part: "boat", anim: "rock", origin: [100, 150] }],
      cheer: "Ahoy! The sailboat is sailing!",
    };
  }

  // ---- ❓ Mystery pictures: a grid of squares; the picture shows as he paints
  // (the book hides its name and picture until it is done)
  function mysteryCat() {
    const regs = L.mosaic([
      "bobbbbbbob",
      "boobbbboob",
      "bopoooopob",
      "boooooooob",
      "bokooookob",
      "boooppooob",
      "boooooooob",
      "bboooooobb",
      "gggggggggg",
      "gggggggggg",
    ], { b: 1, o: 2, p: 3, k: 4, g: 5 }, "pic");
    return {
      id: "mysterycat", name: "Kitty Cat", say: "the kitty cat", icon: "🐱", mystery: true, mosaic: true,
      colors: [{ n: 1, hex: "#a5d8ff", name: "sky blue" }, { n: 2, hex: "#ff922b", name: "orange" }, { n: 3, hex: "#ff8fb1", name: "pink" }, { n: 4, hex: "#343a40", name: "black" }, { n: 5, hex: "#40c057", name: "green" }],
      regions: regs, ink: [],
      alive: [{ part: "pic", anim: "bob" }],
      cheer: "It's a kitty cat! Meow!",
    };
  }
  function mysteryDuck() {
    const regs = L.mosaic([
      "bbbbbbbbbb",
      "bbbbyyybbb",
      "bbbyykyobb",
      "bbbyyyyoob",
      "bbbbyybbbb",
      "byyyyyyybb",
      "yyyyyyyyyb",
      "byyyyyyyyb",
      "wwwwwwwwww",
      "wwwwwwwwww",
    ], { b: 1, y: 2, o: 3, k: 4, w: 5 }, "pic");
    return {
      id: "mysteryduck", name: "Little Duck", say: "the little duck", icon: "🦆", mystery: true, mosaic: true,
      colors: [{ n: 1, hex: "#d0ebff", name: "light blue" }, { n: 2, hex: "#ffd43b", name: "yellow" }, { n: 3, hex: "#ff922b", name: "orange" }, { n: 4, hex: "#343a40", name: "black" }, { n: 5, hex: "#1c7ed6", name: "blue" }],
      regions: regs, ink: [],
      alive: [{ part: "pic", anim: "swim" }],
      cheer: "It's a little duck! Quack, quack!",
    };
  }
  function mysteryCar() {
    const regs = L.mosaic([
      "bbbbbbbbbb",
      "bbbbbbbbbb",
      "bbbrrrrrbb",
      "bbrccrccrb",
      "rrrrrrrrrr",
      "rrrrrrrrry",
      "bbkkbbkkbb",
      "ggkkggkkgg",
      "gggggggggg",
      "gggggggggg",
    ], { b: 1, r: 2, c: 3, k: 4, g: 5, y: 6 }, "pic");
    return {
      id: "mysterycar", name: "Red Car", say: "the red car", icon: "🚗", mystery: true, mosaic: true,
      colors: [{ n: 1, hex: "#a5d8ff", name: "sky blue" }, { n: 2, hex: "#f03e3e", name: "red" }, { n: 3, hex: "#66d9e8", name: "light blue" }, { n: 4, hex: "#343a40", name: "black" }, { n: 5, hex: "#868e96", name: "gray" }, { n: 6, hex: "#ffd43b", name: "yellow" }],
      regions: regs, ink: [],
      alive: [{ part: "pic", anim: "rumble" }],
      cheer: "It's a red car! Beep beep!",
    };
  }

  // ---- 🌟 Big pictures: nine colors and many more shapes
  function train() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    regs.push(N(circle(28, 28, 18), 8));
    regs.push(cloud(110, 22, 0.75));
    regs.push(N(path("M0 96 C30 60 60 60 90 84 C120 58 160 60 200 82 L200 160 L0 160 Z"), 2));
    regs.push(N(rect(0, 154, 200, 20), 9));
    regs.push(F(rect(0, 172, 200, 5, 1), "#5c5f66"));
    regs.push(N(rect(0, 177, 200, 23), 2));
    // smoke, the engine (boiler, cab, chimney), then two cars
    regs.push(N(circle(160, 40, 13), 7, "train"), N(circle(178, 22, 11), 7, "train"));
    regs.push(N(rect(146, 56, 18, 30, 3), 6, "train"));
    regs.push(N(rect(122, 84, 72, 46, 8), 3, "train"));
    regs.push(N(rect(102, 66, 38, 64, 6), 4, "train"));
    regs.push(N(rect(110, 74, 22, 18, 4), 8, "train"));
    regs.push(N(rect(40, 92, 56, 38, 6), 5, "train"));
    regs.push(N(rect(48, 98, 18, 16, 3), 8, "train"), N(rect(70, 98, 18, 16, 3), 8, "train"));
    regs.push(N(rect(4, 92, 32, 38, 6), 3, "train"));
    regs.push(F(rect(36, 116, 6, 6, 2), "#495057", "train"), F(rect(96, 116, 6, 6, 2), "#495057", "train"));
    for (const x of [20, 54, 84, 122, 150, 178]) regs.push(N(circle(x, 141, 13), 6, "train"));
    return {
      id: "train", name: "Train", say: "the train", icon: "🚂",
      colors: [{ n: 1, hex: "#a5d8ff", name: "sky blue" }, { n: 2, hex: "#69db7c", name: "green" }, { n: 3, hex: "#f03e3e", name: "red" }, { n: 4, hex: "#1c7ed6", name: "blue" }, { n: 5, hex: "#ffd43b", name: "yellow" }, { n: 6, hex: "#343a40", name: "black" }, { n: 7, hex: "#adb5bd", name: "gray" }, { n: 8, hex: "#ff922b", name: "orange" }, { n: 9, hex: "#a9744f", name: "brown" }],
      regions: regs, ink: [],
      alive: [{ part: "train", anim: "rumble" }],
      cheer: "Choo choo! All aboard!",
    };
  }
  function sea() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    regs.push(N(path("M0 166 C40 156 80 170 120 160 C150 154 180 162 200 156 L200 200 L0 200 Z"), 2));
    for (const [x, y, r] of [[28, 40, 9], [48, 16, 8], [150, 22, 9]]) regs.push(N(circle(x, y, r), 9));
    // seaweed and coral at the back
    regs.push(N(path("M14 170 C4 140 24 120 14 92 C30 112 30 140 34 170 Z"), 5, "sea"), N(path("M182 168 C172 140 194 118 184 90 C200 112 200 140 198 168 Z"), 5, "sea"));
    regs.push(N(path("M44 170 L48 132 L38 112 L52 122 L58 100 L64 124 L78 112 L70 136 L74 170 Z"), 6, "sea"));
    regs.push(N(path("M134 172 C126 160 140 150 152 156 C164 150 176 160 168 172 Z"), 7, "sea"));
    // a little fish and a starfish
    regs.push(N(poly([[50, 122], [74, 106], [74, 138]]), 7, "fish"), N(ellipse(36, 122, 20, 13), 7, "fish"));
    regs.push(...eye(26, 119, 3.5, "fish", -0.3));
    regs.push(N(star(170, 184, 17, 9, 5, -90), 4, "sea"));
    for (const [x, y] of [[112, 26], [92, 132]]) regs.push(N(circle(x, y, 8), 9));
    // a big fish with stripes
    regs.push(N(poly([[150, 76], [184, 50], [180, 76], [184, 104]]), 3, "fish"));
    regs.push(N(ellipse(110, 76, 46, 28), 3, "fish"));
    regs.push(N(ellipse(98, 76, 10, 26), 4, "fish"), N(ellipse(124, 76, 9, 24), 4, "fish"));
    regs.push(...eye(78, 70, 7, "fish", -0.3));
    // a crab on the sand
    regs.push(N(circle(78, 160, 10.5), 8, "crab"), N(circle(130, 160, 10.5), 8, "crab"));
    regs.push(N(ellipse(104, 174, 22, 13), 8, "crab"));
    regs.push(...eye(98, 160, 3.5, "crab", 0), ...eye(110, 160, 3.5, "crab", 0));
    return {
      id: "sea", name: "Under the Sea", say: "the sea", icon: "🐠",
      colors: [{ n: 1, hex: "#4dabf7", name: "blue" }, { n: 2, hex: "#d4a373", name: "tan" }, { n: 3, hex: "#ff922b", name: "orange" }, { n: 4, hex: "#ffe066", name: "yellow" }, { n: 5, hex: "#2f9e44", name: "dark green" }, { n: 6, hex: "#f783ac", name: "pink" }, { n: 7, hex: "#9775fa", name: "purple" }, { n: 8, hex: "#e03131", name: "red" }, { n: 9, hex: "#d0ebff", name: "light blue" }],
      regions: regs, ink: [],
      alive: [{ part: "fish", anim: "swim" }, { part: "crab", anim: "rumble" }],
      cheer: "Splash! The sea is full of friends!",
    };
  }
  function garden() {
    const regs = [N(rect(0, 0, 200, 200), 1)];
    regs.push(N(circle(172, 30, 20), 5));
    regs.push(cloud(44, 28, 0.8));
    regs.push(N(path("M0 150 C40 140 80 152 120 144 C150 138 180 146 200 140 L200 200 L0 200 Z"), 2));
    // two flowers
    for (const [x, c] of [[34, 6], [168, 7]]) {
      regs.push(F(rect(x - 2.5, 130, 5, 50, 2), "#2f9e44", "flowers"));
      for (let k = 0; k < 5; k++) { const a = (k * 72 - 90) * Math.PI / 180; regs.push(N(circle(x + Math.cos(a) * 15, 120 + Math.sin(a) * 15, 11), c, "flowers")); }
      regs.push(N(circle(x, 120, 9), 5, "flowers"));
    }
    // the butterfly: wings, their spots, then the body
    regs.push(N(path("M98 76 C80 40 34 36 40 72 C44 96 76 98 98 90 Z"), 3, "wings"), N(path("M102 76 C120 40 166 36 160 72 C156 96 124 98 102 90 Z"), 3, "wings"));
    regs.push(N(path("M98 94 C76 96 50 112 62 132 C74 146 92 124 98 104 Z"), 8, "wings"), N(path("M102 94 C124 96 150 112 138 132 C126 146 108 124 102 104 Z"), 8, "wings"));
    regs.push(N(circle(66, 66, 11), 4, "wings"), N(circle(134, 66, 11), 4, "wings"));
    regs.push(N(ellipse(100, 92, 9.5, 30), 9, "wings"));
    regs.push(F(circle(100, 58, 8), INK, "wings"));
    return {
      id: "garden", name: "Butterfly Garden", say: "the butterfly garden", icon: "🦋",
      colors: [{ n: 1, hex: "#d0ebff", name: "light blue" }, { n: 2, hex: "#69db7c", name: "green" }, { n: 3, hex: "#9775fa", name: "purple" }, { n: 4, hex: "#ffe066", name: "yellow" }, { n: 5, hex: "#ff922b", name: "orange" }, { n: 6, hex: "#f783ac", name: "pink" }, { n: 7, hex: "#e03131", name: "red" }, { n: 8, hex: "#1c7ed6", name: "blue" }, { n: 9, hex: "#5c3d2e", name: "brown" }],
      regions: regs,
      ink: [I([[96, 52], [86, 34]], 2, "wings"), I([[104, 52], [114, 34]], 2, "wings")],
      alive: [{ part: "wings", anim: "flap", origin: [100, 90] }],
      cheer: "The butterfly is flying in your garden!",
    };
  }

  // The book's shelves, in order. A page sits on exactly one.
  const SHELVES = [
    { id: "numbers", icon: "🖍️", title: "Color by number", say: "Color by number" },
    { id: "dots", icon: "🎲", title: "Count the dots", say: "Count the dots" },
    { id: "zh", icon: "🏮", title: "一 二 三 in Chinese", say: "Numbers in Chinese" },
    { id: "minus", icon: "➖", title: "Take away", say: "Take away" },
    { id: "mystery", icon: "❓", title: "Mystery pictures", say: "Mystery pictures" },
    { id: "big", icon: "🌟", title: "Big pictures", say: "Big pictures" },
  ];
  const BY_SHELF = {
    numbers: [sun(), fish(), iceCream(), rocket(), dino(), dumpTruck(), fireTruck(), castle(), pirateShip(), robot(), dragon(), monsterTruck()],
    dots: [ladybug(), caterpillar(), flowerPot()],
    zh: [panda(), lantern(), dragonBoat()],
    minus: [snowman(), hotAirBalloon(), sailboat()],
    mystery: [mysteryCat(), mysteryDuck(), mysteryCar()],
    big: [train(), sea(), garden()],
  };
  const PAGES = [];
  for (const sh of SHELVES) for (const p of BY_SHELF[sh.id]) { p.shelf = sh.id; PAGES.push(p); }
  PAGES.forEach((p, i) => { p.level = i + 1; });

  // What each page SOUNDS like when it comes alive (color-main.js plays these
  // through JoshAudio.tone, so the mute silences them).
  const SOUNDS = {
    sun: "chime", fish: "bloop", icecream: "yum", rocket: "whoosh", dino: "roar", dumptruck: "honk",
    firetruck: "siren", castle: "fanfare", pirate: "horn", robot: "beep", dragon: "roar", monster: "vroom",
    ladybug: "chime", caterpillar: "bloop", flowerpot: "chime", panda: "yum", lantern: "chime", dragonboat: "drum",
    snowman: "chime", balloon: "whoosh", sailboat: "horn", mysterycat: "meow", mysteryduck: "quack", mysterycar: "honk",
    train: "choo", sea: "bloop", garden: "chime",
  };
  PAGES.forEach((p) => { p.sound = SOUNDS[p.id] || "chime"; });

  // His Chinese: a finished color is said in English, then in Chinese. Only the
  // names with a plain, everyday Chinese word (cream, tan, teal and mint have
  // none a four-year-old would hear, so they stay English).
  const COLOR_ZH = {
    red: "红色", orange: "橙色", yellow: "黄色", green: "绿色", blue: "蓝色", purple: "紫色",
    pink: "粉色", brown: "棕色", black: "黑色", white: "白色", gray: "灰色", silver: "银色",
    "sky blue": "天蓝色", "light blue": "浅蓝色", "dark blue": "深蓝色", "dark green": "深绿色", "light green": "浅绿色",
  };

  // Free paint: the crayon box that opens when a page is done.
  // Magic crayons come FIRST in the box (they are the surprise): rainbow
  // replaces a shape's color; glitter, stripes and dots go on top of it.
  const MAGIC = [
    { fx: "rainbow", label: "Rainbow crayon", say: "Rainbow!" },
    { fx: "glitter", label: "Glitter crayon", say: "Sparkly!" },
    { fx: "stripes", label: "Stripes crayon", say: "Stripes!" },
    { fx: "dots", label: "Polka dot crayon", say: "Polka dots!" },
  ];
  const CRAYONS = ["#f03e3e", "#ff922b", "#ffd43b", "#82c91e", "#37b24d", "#22b8cf", "#1c7ed6", "#7950f2", "#e64980", "#a9744f", "#343a40", "#f8f9fa"];

  const SAY = {
    open: (p) => "Let's color " + (p.mystery ? "the mystery picture" : p.say) + "!",
    how: (p) => (p.label === "dots" ? "Count the dots, then tap the pot with that number!"
      : p.label === "zh" ? "The numbers are in Chinese! Pick a color, then find its number!"
      : p.shelf === "minus" ? "Take away, then color it with what is left!"
      : "Pick a color, then tap its number!"),
    pick: (c) => "Number " + c.n + ". " + c.name + "!",
    colorDone: (c) => "All the " + c.name + " is done!",
    wrong: (n) => "That one is number " + n + "!",
    wrongDots: (n) => "That one has " + n + (n === 1 ? " dot!" : " dots!"),
    wrongSum: (a, b, n) => a + " plus " + b + " makes " + n + "!",
    wrongDiff: (a, b, n) => a + " take away " + b + " is " + n + "!",
    draw: "Draw anything you like! Pick a crayon.",
    undo: "Oops, undo!",
    clear: "A clean page!",
    done: (p) => "You colored " + p.say + "!",
    paint: "Now paint it any way you like!",
    again: "Let's color it again!",
    replay: "Watch it paint!",
    magic: "Magic crayons! Tap a shape to make it sparkle!",
  };

  const data = { PAGES, SHELVES, CRAYONS, MAGIC, COLOR_ZH, SAY };
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  else global.ColorData = data;
})(typeof window !== "undefined" ? window : globalThis);
