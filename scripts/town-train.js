// 🚂 Train Yard — the third New World (PLAN_TOWN.md §3): track puzzles. The
// station is at the top, the destination at the bottom, and between them a
// grid of track tiles, some turned the wrong way. Each tap turns a tile a
// quarter; the track lights up from the station as far as it joins, so he can
// SEE how far it reaches. When it reaches the end, the train chugs the whole
// way. No failure: a tile turns round and round, nothing is ever wrong.
// The last level loads animals first, counted, so the train has a job.
//
// A level is DATA: the cells of the path from the station to the end. The
// tile each cell needs (straight or curve) and its right turns are DERIVED
// from its neighbours, so a level cannot ask for a track that cannot join —
// TrainLogic.check proves every level solvable in node.

(function (global) {
  "use strict";
  // sides: 0 north, 1 east, 2 south, 3 west
  const STEP = [[-1, 0], [0, 1], [1, 0], [0, -1]];
  const opp = (s) => (s + 2) % 4;
  function sideTo(a, b) { for (let s = 0; s < 4; s++) if (a[0] + STEP[s][0] === b[0] && a[1] + STEP[s][1] === b[1]) return s; return -1; }
  // What each path cell needs: the two sides it must join.
  function needs(level) {
    const p = level.path, out = [];
    for (let i = 0; i < p.length; i++) {
      const a = i === 0 ? 0 : sideTo(p[i], p[i - 1]);          // the station is to the north of the first cell
      const b = i === p.length - 1 ? 2 : sideTo(p[i], p[i + 1]); // the end is to the south of the last
      out.push([a, b].sort());
    }
    return out;
  }
  // A tile is a straight (base sides 0,2) or a curve (base 0,1), turned r quarters.
  const kindOf = (pair) => (pair[1] - pair[0] === 2 ? "straight" : "curve");
  function sidesOf(kind, r) { const base = kind === "straight" ? [0, 2] : [0, 1]; return base.map((s) => (s + r) % 4).sort(); }
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  function goodTurns(pair) { const k = kindOf(pair); return [0, 1, 2, 3].filter((r) => same(sidesOf(k, r), pair)); }
  // The proof a level is fair: every cell on the grid, never twice, each step
  // to a neighbour, and every needed tile reachable by turning.
  function check(level) {
    const p = level.path, seen = new Set();
    if (!p.length) return "no path";
    for (let i = 0; i < p.length; i++) {
      const [r, c] = p[i];
      if (r < 0 || c < 0 || r >= level.rows || c >= level.cols) return "cell off the grid";
      if (seen.has(r + "," + c)) return "a cell twice";
      seen.add(r + "," + c);
      if (i && sideTo(p[i - 1], p[i]) < 0) return "a step that is not to a neighbour";
    }
    if (p[0][0] !== 0) return "the first cell must touch the station (top row)";
    if (p[p.length - 1][0] !== level.rows - 1) return "the last cell must touch the end (bottom row)";
    for (const pair of needs(level)) if (pair[0] === pair[1] || !goodTurns(pair).length) return "a tile no turn can fit";
    return "";
  }
  const LEVELS = [
    { id: "first", name: "First Track", icon: "🛤️", doneIcon: "🚂", rows: 3, cols: 3, path: [[0, 1], [1, 1], [2, 1]], to: "🏡", toName: "house" },
    { id: "bend", name: "Round the Bend", icon: "↪️", doneIcon: "🚂", rows: 3, cols: 3, path: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]], to: "🏰", toName: "castle" },
    { id: "zigzag", name: "Zig Zag", icon: "〰️", doneIcon: "🚂", rows: 4, cols: 3, path: [[0, 2], [1, 2], [1, 1], [2, 1], [2, 0], [3, 0]], to: "🎡", toName: "fair" },
    { id: "animals", name: "Animal Train", icon: "🐄", doneIcon: "🚃", rows: 3, cols: 3, path: [[0, 1], [1, 1], [1, 0], [2, 0]], to: "🏡", toName: "farm",
      cargo: { pic: "🐄", one: "cow", many: "cows", n: [2, 4] } },
  ];
  const TrainLogic = { needs, kindOf, sidesOf, goodTurns, check, sideTo, LEVELS };
  if (typeof module !== "undefined" && module.exports) module.exports = TrainLogic;
  global.TrainLogic = TrainLogic;

  const T = global.Town;
  const doc = global.document;
  if (!T || !doc) return;
  const el = (tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
  const COUNT = ["", "One", "Two", "Three", "Four", "Five"];

  // One track tile, drawn with its base sides (0,2 or 0,1); the button turns it.
  function tileSvg(kind) {
    const d = kind === "straight" ? "M50 0 L50 100" : "M50 0 Q50 50 100 50";
    return '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<path class="trn-ties" d="' + d + '" fill="none" stroke-width="34" stroke-dasharray="6 9"/>' +
      '<path class="trn-rail" d="' + d + '" fill="none" stroke-width="24"/>' +
      '<path class="trn-gap" d="' + d + '" fill="none" stroke-width="14"/>' +
      "</svg>";
  }
  const SCENERY = ["🌳", "🌲", "🌼", "🐑", "🌳", "🪨", "🌷", "🐄"];


  function play(api, lv) {
    const rng = api.rng;
    const need = needs(lv);
    const onPath = new Map(lv.path.map((p, i) => [p[0] + "," + p[1], i]));
    const scene = el("div", "trn-scene");
    const top = el("div", "trn-end trn-end--from", '<span aria-hidden="true">🚉</span>');
    top.setAttribute("role", "img");
    top.setAttribute("aria-label", "The station");
    const grid = el("div", "trn-grid");
    grid.style.setProperty("--cols", lv.cols);
    const bottom = el("div", "trn-end trn-end--to", '<span aria-hidden="true">' + lv.to + "</span>");
    bottom.setAttribute("role", "img");
    bottom.setAttribute("aria-label", "The " + lv.toName);
    // the station sits over the first cell's column, the end under the last's
    top.style.setProperty("--cols", lv.cols);
    bottom.style.setProperty("--cols", lv.cols);
    top.firstChild.style.gridColumn = String(lv.path[0][1] + 1);
    bottom.firstChild.style.gridColumn = String(lv.path[lv.path.length - 1][1] + 1);
    const tiles = [];
    let si = Math.floor(rng() * SCENERY.length);
    for (let r = 0; r < lv.rows; r++) {
      for (let c = 0; c < lv.cols; c++) {
        const i = onPath.get(r + "," + c);
        if (i == null) { grid.appendChild(el("div", "trn-cell trn-cell--scene", '<span aria-hidden="true">' + SCENERY[si++ % SCENERY.length] + "</span>")); continue; }
        const kind = kindOf(need[i]);
        const good = goodTurns(need[i]);
        // scrambled: never already right
        const wrong = [0, 1, 2, 3].filter((x) => !good.includes(x));
        const t = { i, kind, good, r: wrong[Math.floor(rng() * wrong.length)], turns: 0 };
        t.b = el("button", "trn-cell trn-tile tap", '<span class="trn-tile__in">' + tileSvg(kind) + "</span>");
        t.b.type = "button";
        t.b.setAttribute("aria-label", "Track " + (i + 1));
        // A turn is a move, never a wrong tap: any track may be turned in any
        // order (data-free tells the shell's tests so); data-correct only
        // marks the first track that does not join yet.
        t.b.dataset.free = "1";
        grid.appendChild(t.b);
        tiles[i] = t;
      }
    }
    const train = el("span", "trn-train", "🚂");
    train.setAttribute("aria-hidden", "true");
    const gridWrap = el("div", "trn-gridwrap");
    gridWrap.append(grid, train);
    // cargo (the last level): the animals wait by the station to be loaded
    let cargo = null;
    if (lv.cargo) {
      const n = lv.cargo.n[0] + Math.floor(rng() * (lv.cargo.n[1] - lv.cargo.n[0] + 1));
      cargo = { n, loaded: 0 };
      cargo.wrap = el("div", "trn-cargo");
      cargo.pen = el("button", "trn-pen tap", '<span aria-hidden="true">' + lv.cargo.pic.repeat(n) + "</span>");
      cargo.pen.type = "button";
      cargo.pen.setAttribute("aria-label", n + " " + lv.cargo.many + " to load");
      cargo.cars = el("div", "trn-cars", '<span aria-hidden="true">🚂</span>' + Array.from({ length: n }, () => '<span class="trn-car" aria-hidden="true">🚃</span>').join(""));
      cargo.cars.setAttribute("role", "img");
      cargo.cars.setAttribute("aria-label", "The train");
      cargo.wrap.append(cargo.pen, cargo.cars);
      scene.append(cargo.wrap);
    }
    scene.append(top, gridWrap, bottom);
    api.stage.appendChild(scene);

    // data-fits: does this track's own turn fit its place (whether or not the
    // line reaches it yet) — what a test reads to prove a level never starts solved.
    const paint = (t) => { t.b.querySelector(".trn-tile__in").style.transform = "rotate(" + (t.r * 90 + t.turns * 360) + "deg)"; t.b.dataset.fits = t.good.includes(t.r) ? "1" : "0"; };
    tiles.forEach(paint);
    // how far the track joins from the station
    const reach = () => { let k = 0; while (k < tiles.length && tiles[k].good.includes(tiles[k].r)) k++; return k; };
    let lit = -1, rolling = false;
    function light() {
      const k = reach();
      tiles.forEach((t, j) => { t.b.classList.toggle("trn-tile--lit", j < k); t.b.setAttribute("aria-label", "Track " + (j + 1) + (j < k ? ", joined" : "")); });
      top.classList.toggle("trn-end--lit", true);
      bottom.classList.toggle("trn-end--lit", k === tiles.length);
      if (k > lit && lit >= 0) api.tone(NOTES[Math.min(NOTES.length - 1, k)], { duration: 0.2 });
      lit = k;
      return k;
    }
    function ask() {
      const k = light();
      if (k === tiles.length) { roll(); return; }
      api.next(tiles[k].b);
    }
    function roll() {
      rolling = true;
      api.next([]);
      api.say("The track is done! All aboard!");
      bottom.classList.add("trn-end--lit");
      // the train runs cell by cell, then into the end
      const stops = tiles.map((t) => t.b).concat(bottom.firstChild); // the end itself, not its whole row
      train.classList.add("trn-train--on");
      let j = 0;
      const hop = () => {
        const g = api.gap(train, stops[j]);
        const cur = (train.dataset.dx ? [+train.dataset.dx, +train.dataset.dy] : [0, 0]);
        const dx = cur[0] + g.dx, dy = cur[1] + g.dy;
        train.dataset.dx = dx; train.dataset.dy = dy;
        api.move(train, dx, dy, 380);
        api.tone(NOTES[j % NOTES.length], { duration: 0.12, gain: 0.12 });
        j += 1;
        if (j < stops.length) api.later(hop, api.reduce() ? 0 : 400);
        else api.later(() => api.done(lv.cargo ? COUNT[cargo.n] + " " + lv.cargo.many + " got to the " + lv.toName + "! Choo choo!" : "Choo choo! The train got to the " + lv.toName + "!"), api.reduce() ? 0 : 500);
      };
      hop();
    }
    tiles.forEach((t) => t.b.addEventListener("click", () => {
      if (rolling) return;
      if (cargo && cargo.loaded < cargo.n) { api.bump(t.b, "Load the " + lv.cargo.many + " first! Tap them."); return; }
      t.r = (t.r + 1) % 4;
      if (t.r === 0) t.turns += 1; // keep turning the same way round
      paint(t);
      const before = lit;
      const k = light();
      if (k > before) api.good(t.b);
      else api.tone(392, { duration: 0.08, gain: 0.1 });
      if (k === tiles.length) roll();
      else api.next(tiles[k].b);
    }));
    if (cargo) {
      api.prompt(lv.cargo.pic + " ➡️ 🚃 ➡️ " + lv.to, "Take " + COUNT[cargo.n].toLowerCase() + " " + lv.cargo.many + " to the " + lv.toName + "! Load them on the train.");
      api.next(cargo.pen);
      cargo.pen.addEventListener("click", () => {
        if (cargo.loaded >= cargo.n) { api.bump(cargo.pen, "They are all on! Now turn the track."); return; }
        cargo.loaded += 1;
        cargo.pen.querySelector("span").textContent = cargo.loaded < cargo.n ? lv.cargo.pic.repeat(cargo.n - cargo.loaded) : "🌾"; // an empty field
        cargo.cars.querySelectorAll(".trn-car")[cargo.loaded - 1].textContent = lv.cargo.pic;
        api.tone(NOTES[cargo.loaded - 1], { duration: 0.2 });
        api.good(cargo.cars, COUNT[cargo.loaded] + "!");
        if (cargo.loaded === cargo.n) {
          cargo.pen.setAttribute("aria-label", "All loaded");
          api.prompt("🚉 ➡️ " + lv.to, "All aboard! Now turn the track to the " + lv.toName + ".");
          ask();
        } else api.next(cargo.pen);
      });
    } else {
      api.prompt("🚉 ➡️ " + lv.to, "Turn the track so the train can get to the " + lv.toName + "! Tap a track to turn it.");
      ask();
    }
    light();
  }

  T.register({
    id: "train",
    name: "Train Yard",
    icon: "🚂",
    color: "#cfe8ff",
    say: "Welcome to the Train Yard! Pick a track.",
    levels: LEVELS.map((l) => Object.assign({}, l)),
    play(api, level) { play(api, level); },
    logic: TrainLogic,
  });
})(typeof window !== "undefined" ? window : globalThis);
