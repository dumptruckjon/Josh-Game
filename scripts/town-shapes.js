// 🧩 Shape Builder — the sixth New World (PLAN_TOWN.md §3): a picture's
// outline waits in dashed lines; one part of it glows, and he picks the shape
// that fits it from three in the tray. The piece flies in, the picture fills
// up, and when it is whole it comes alive (the rocket blasts off, the car
// drives, the house lights up, the robot waves). Shapes and their names
// (circle, square, triangle, rectangle), and part-whole thinking. No
// rotation and no dragging: a tap picks, the piece places itself.
//
// A picture is DATA: its parts, each a kind of shape with a box on a 200-unit
// page. The tray always holds the right kind and two OTHER kinds, so exactly
// one piece fits (ShapeLogic.tray proves it in node).

(function (global) {
  "use strict";
  const KINDS = ["circle", "square", "triangle", "rectangle"];
  const PICS = [
    { id: "house", name: "House", icon: "🏠", alive: "lights", cheer: "A house! The lights are on!",
      parts: [{ k: "square", x: 50, y: 92, w: 100, h: 92, fill: "#ffb703" }, { k: "triangle", x: 38, y: 24, w: 124, h: 70, fill: "#e63946" }, { k: "rectangle", x: 88, y: 130, w: 28, h: 54, fill: "#8b5a2b" }] },
    { id: "car", name: "Car", icon: "🚗", alive: "drive", cheer: "A car! Vroom vroom!",
      parts: [{ k: "rectangle", x: 22, y: 92, w: 156, h: 52, fill: "#2f6fe0" }, { k: "square", x: 64, y: 50, w: 46, h: 44, fill: "#7fb3ff" }, { k: "circle", x: 38, y: 128, w: 44, h: 44, fill: "#2b2b3a" }, { k: "circle", x: 118, y: 128, w: 44, h: 44, fill: "#2b2b3a" }] },
    { id: "rocket", name: "Rocket", icon: "🚀", alive: "launch", cheer: "Three, two, one, blast off!",
      parts: [{ k: "rectangle", x: 74, y: 60, w: 52, h: 100, fill: "#e9eef5" }, { k: "triangle", x: 74, y: 14, w: 52, h: 48, fill: "#e63946" }, { k: "circle", x: 86, y: 80, w: 28, h: 28, fill: "#5ec8ff" }, { k: "triangle", x: 46, y: 124, w: 30, h: 40, fill: "#e63946" }, { k: "triangle", x: 124, y: 124, w: 30, h: 40, fill: "#e63946" }] },
    { id: "robot", name: "Robot", icon: "🤖", alive: "wave", cheer: "Beep boop! Your robot says hello!",
      parts: [{ k: "rectangle", x: 66, y: 86, w: 68, h: 104, fill: "#9aa0a8" }, { k: "square", x: 70, y: 22, w: 60, h: 60, fill: "#c8ccd2" }, { k: "circle", x: 80, y: 36, w: 16, h: 16, fill: "#2b2b3a" }, { k: "circle", x: 104, y: 36, w: 16, h: 16, fill: "#2b2b3a" }, { k: "rectangle", x: 40, y: 92, w: 26, h: 56, fill: "#ffb703" }, { k: "rectangle", x: 134, y: 92, w: 26, h: 56, fill: "#ffb703" }] },
  ];
  // The tray for a part: its kind and two other kinds, in a seeded order.
  function tray(kind, rng) {
    const others = KINDS.filter((k) => k !== kind);
    for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
    const t = [kind, others[0], others[1]];
    for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
    return t;
  }
  // A shape in its box, as SVG.
  function shape(k, x, y, w, h, attrs) {
    if (k === "circle") return '<ellipse cx="' + (x + w / 2) + '" cy="' + (y + h / 2) + '" rx="' + w / 2 + '" ry="' + h / 2 + '" ' + attrs + "/>";
    if (k === "triangle") return '<polygon points="' + (x + w / 2) + "," + y + " " + (x + w) + "," + (y + h) + " " + x + "," + (y + h) + '" ' + attrs + "/>";
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" ' + attrs + "/>";
  }
  const ShapeLogic = { KINDS, PICS, tray, shape };
  if (typeof module !== "undefined" && module.exports) module.exports = ShapeLogic;
  global.ShapeLogic = ShapeLogic;

  const T = global.Town;
  const doc = global.document;
  if (!T || !doc) return;
  const el = (tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  const INK = "#2b2b3a";
  // a tray piece's own picture: the kind at a standard size
  const BOX = { circle: [10, 10, 80, 80], square: [12, 12, 76, 76], triangle: [8, 12, 84, 74], rectangle: [6, 28, 88, 44] };
  // A rectangle in the tray stands the way its slot does (a door is tall, a
  // car body is wide), so "which fits" never needs a turn in his head.
  const boxFor = (k, part) => (k === "rectangle" && part.h > part.w ? [28, 6, 44, 88] : BOX[k]);
  const pieceSvg = (k, fill, part) => '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' + shape(k, ...boxFor(k, part), 'fill="' + fill + '" stroke="' + INK + '" stroke-width="3"') + "</svg>";

  function play(api, pic) {
    const scene = el("div", "shp-scene");
    const board = el("div", "shp-board shp-board--" + pic.id);
    board.setAttribute("role", "img");
    board.setAttribute("aria-label", "A " + pic.name.toLowerCase() + " to build");
    const draw = (placed, now) => {
      let s = '<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">';
      pic.parts.forEach((p, i) => {
        if (placed[i]) s += shape(p.k, p.x, p.y, p.w, p.h, 'fill="' + p.fill + '" stroke="' + INK + '" stroke-width="2.5"');
        else s += shape(p.k, p.x, p.y, p.w, p.h, 'fill="' + (i === now ? "#fff3c4" : "#ffffff") + '" stroke="' + (i === now ? "#ff7a00" : "#8a8a96") + '" stroke-width="' + (i === now ? 4 : 2.5) + '" stroke-dasharray="7 5"' + (i === now ? ' class="shp-now"' : ""));
      });
      board.innerHTML = s + "</svg>";
    };
    const row = el("div", "shp-tray");
    const btns = [0, 1, 2].map(() => { const b = el("button", "shp-piece tap"); b.type = "button"; row.appendChild(b); return b; });
    scene.append(board, row);
    api.stage.appendChild(scene);
    const placed = pic.parts.map(() => false);
    let k = 0, busy = false;
    const part = () => pic.parts[k];
    function show() {
      draw(placed, k);
      const t = tray(part().k, api.rng);
      btns.forEach((b, i) => {
        b.dataset.kind = t[i];
        // every piece wears the part's own colour: only the SHAPE tells them apart
        b.innerHTML = pieceSvg(t[i], part().fill, part());
        b.setAttribute("aria-label", "A " + t[i]);
      });
      api.next(btns.find((b) => b.dataset.kind === part().k));
    }
    api.prompt("🧩 ➡️ " + pic.icon, "Let's build a " + pic.name.toLowerCase() + "! Which shape fits the glowing part?");
    show();
    btns.forEach((b) => b.addEventListener("click", () => {
      if (busy || k >= pic.parts.length) return;
      if (b.dataset.kind !== part().k) { api.bump(b, "That's a " + b.dataset.kind + ". It doesn't fit there. Which shape fits?"); return; }
      busy = true;
      api.next([]);
      placed[k] = true;
      k += 1;
      api.tone(NOTES[Math.min(NOTES.length - 1, k - 1)], { duration: 0.2 });
      api.good(board, "A " + pic.parts[k - 1].k + "! It fits!");
      if (k === pic.parts.length) {
        draw(placed, -1);
        btns.forEach((x) => { x.disabled = true; x.classList.add("shp-piece--away"); });
        api.later(() => {
          board.classList.add("shp-board--alive", "shp-alive--" + pic.alive);
          api.done(pic.cheer);
        }, api.reduce() ? 0 : 400);
        return;
      }
      api.later(() => { busy = false; show(); }, api.reduce() ? 0 : 300);
    }));
  }

  T.register({
    id: "shapes",
    name: "Shape Builder",
    icon: "🧩",
    color: "#e2d6ff",
    say: "Welcome to Shape Builder! What shall we build?",
    levels: PICS.map((p) => ({ id: p.id, name: p.name, icon: p.icon, doneIcon: p.icon, pic: p })),
    play(api, level) { play(api, level.pic); },
    logic: ShapeLogic,
  });
})(typeof window !== "undefined" ? window : globalThis);
