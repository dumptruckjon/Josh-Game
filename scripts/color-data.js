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

  const PAGES = [sun(), fish(), iceCream(), rocket(), dino(), dumpTruck(), fireTruck(), castle(), pirateShip(), robot(), dragon(), monsterTruck()];
  PAGES.forEach((p, i) => { p.level = i + 1; });

  // Free paint: the crayon box that opens when a page is done.
  const CRAYONS = ["#f03e3e", "#ff922b", "#ffd43b", "#82c91e", "#37b24d", "#22b8cf", "#1c7ed6", "#7950f2", "#e64980", "#a9744f", "#343a40", "#f8f9fa"];

  const SAY = {
    open: (p) => "Let's color " + p.say + "!",
    how: "Pick a color, then tap its number!",
    pick: (c) => "Number " + c.n + ". " + c.name + "!",
    colorDone: (c) => "All the " + c.name + " is done!",
    wrong: (n) => "That one is number " + n + "!",
    wrongSum: (a, b, n) => a + " plus " + b + " makes " + n + "!",
    done: (p) => "You colored " + p.say + "!",
    paint: "Now paint it any way you like!",
    again: "Let's color it again!",
  };

  const data = { PAGES, CRAYONS, SAY };
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  else global.ColorData = data;
})(typeof window !== "undefined" ? window : globalThis);
