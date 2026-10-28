// 🎲 Game Night — drawing (PLAN_BOARD.md §5). The board is ONE inline SVG,
// built once per game from the board's data; the tokens are DOM elements laid
// over it, so a hop is a CSS move the tests can read off the page. Nothing here
// decides anything: the engine (board-logic.js) does.
//
// No ids and no <defs> in any SVG here: fragment ids resolve DOCUMENT-WIDE,
// and the Sticker Book once collapsed 200 pictures onto one gradient that way.

(function (global) {
  "use strict";
  const DATA = global.BoardData, L = global.BoardLogic;
  if (!DATA || !L) return;
  const CELL = 100;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // The middle of square n, in board units (y down, row 0 at the bottom)
  function centre(board, n) {
    const c = L.cellOf(board, n);
    return { x: (c.col + 0.5) * CELL, y: (board.rows - 1 - c.row + 0.5) * CELL };
  }

  // ---- 🌈 the five shapes, each centred on (0,0) with radius ~1 -----------
  function shapePath(shape) {
    switch (shape) {
      case "heart": return '<path d="M0 0.95 C-1.3 0.05 -1.05 -0.95 -0.48 -0.95 C-0.18 -0.95 0 -0.7 0 -0.5 C0 -0.7 0.18 -0.95 0.48 -0.95 C1.05 -0.95 1.3 0.05 0 0.95 Z"/>';
      case "circle": return '<circle r="0.9"/>';
      case "star": {
        let d = "";
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 0.42 : 1;
          d += (k ? "L" : "M") + (r * Math.cos(a)).toFixed(3) + " " + (r * Math.sin(a)).toFixed(3) + " ";
        }
        return '<path d="' + d + 'Z"/>';
      }
      case "triangle": return '<path d="M0 -0.95 L0.95 0.75 L-0.95 0.75 Z"/>';
      default: return '<path d="M0 -1 L0.85 0 L0 1 L-0.85 0 Z"/>';   // diamond
    }
  }
  // A shape in a colour, for a card or a pad (its own little SVG)
  function shapeSVG(colourId, opts) {
    const c = DATA.colour(colourId);
    if (!c) return "";
    const two = opts && opts.two;
    const one = (x) => '<g transform="translate(' + x + ' 50) scale(' + (two ? 26 : 38) + ')" fill="' + c.fill + '" stroke="#1d1d2b" stroke-width="0.07">' + shapePath(c.shape) + "</g>";
    return '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      (two ? one(28) + one(72) : one(50)) + "</svg>";
  }

  // ---- The board ----------------------------------------------------------
  function boardSVG(board) {
    const W = board.cols * CELL, H = board.rows * CELL;
    const moon = board.game === "dice";
    let s = '<svg class="bn-svg" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true" focusable="false">';
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="22" fill="' + (moon ? "#1f2b63" : "#fff2f8") + '"/>';
    if (moon) {
      // a few fixed stars in the gaps (the same on every game: no randomness)
      for (let k = 0; k < board.size; k++) {
        const x = ((k * 61) % W) + 12, y = ((k * 37) % H) + 9;
        s += '<circle cx="' + x + '" cy="' + y + '" r="2.4" fill="#ffffff" opacity="0.55"/>';
      }
    }
    // the path, square to square, so "which way next" can be seen at a row's end
    let pts = "";
    for (let n = 1; n <= board.size; n++) { const p = centre(board, n); pts += p.x + "," + p.y + " "; }
    s += '<polyline points="' + pts + '" fill="none" stroke="' + (moon ? "#ffffff" : "#b07ac9") + '" stroke-opacity="0.35" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 18"/>';
    // 1. the squares (a rainbow square also wears its white shape)
    for (let n = 1; n <= board.size; n++) {
      const c = L.cellOf(board, n), x = c.col * CELL, y = (board.rows - 1 - c.row) * CELL;
      let fill;
      if (moon) fill = n === 1 ? "#8fd3ff" : n === board.size ? "#ffe08a" : (c.col + c.row) % 2 ? "#e2e4ff" : "#cfe1ff";
      else fill = n === 1 ? "#ffffff" : n === board.size ? "#ffe3f0" : DATA.colour(L.colourAt(board, n)).fill;
      s += '<rect class="bn-cell" data-n="' + n + '" x="' + (x + 5) + '" y="' + (y + 5) + '" width="90" height="90" rx="16" fill="' + fill + '" stroke="rgba(0,0,0,0.18)" stroke-width="2"/>';
      if (!moon && n > 1 && n < board.size) {
        const col = DATA.colour(L.colourAt(board, n));
        s += '<g transform="translate(' + (x + 56) + " " + (y + 58) + ') scale(25)" fill="#ffffff" fill-opacity="0.92">' + shapePath(col.shape) + "</g>";
      }
    }
    // 2. the boosters and comets ride OVER the squares…
    if (moon) {
      for (const j of board.jumps) {
        const p = centre(board, j.from), q = centre(board, j.to);
        if (j.kind === "boost") {
          s += '<line x1="' + p.x + '" y1="' + p.y + '" x2="' + q.x + '" y2="' + q.y + '" stroke="#ff9f43" stroke-opacity="0.75" stroke-width="22" stroke-linecap="round"/>';
          s += '<line x1="' + p.x + '" y1="' + p.y + '" x2="' + q.x + '" y2="' + q.y + '" stroke="#fff1c4" stroke-width="5" stroke-linecap="round" stroke-dasharray="10 14"/>';
        } else {
          const mx = (p.x + q.x) / 2 + 55, my = (p.y + q.y) / 2;
          s += '<path d="M' + p.x + " " + p.y + " Q" + mx + " " + my + " " + q.x + " " + q.y + '" fill="none" stroke="#6fe0ff" stroke-opacity="0.8" stroke-width="18" stroke-linecap="round"/>';
          s += '<path d="M' + p.x + " " + p.y + " Q" + mx + " " + my + " " + q.x + " " + q.y + '" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-dasharray="6 12"/>';
        }
      }
    }
    // 3. …and every number sits on TOP of them, on a white disc, so a line
    // crossing a square never hides which square it is
    for (let n = 1; n <= board.size; n++) {
      const c = L.cellOf(board, n), x = c.col * CELL, y = (board.rows - 1 - c.row) * CELL;
      s += '<circle cx="' + (x + 24) + '" cy="' + (y + 24) + '" r="17" fill="#ffffff" stroke="rgba(0,0,0,0.25)" stroke-width="1.5"/>';
      s += '<text x="' + (x + 24) + '" y="' + (y + 32) + '" text-anchor="middle" font-size="' + (n > 99 ? 16 : 22) + '" font-weight="800" fill="#1d1d3b">' + n + "</text>";
    }
    // 4. the pictures: the start, the finish, each jump's foot, each landmark
    const a = centre(board, 1), z = centre(board, board.size);
    s += emojiAt(moon ? "🌍" : "🏁", a.x + 10, a.y + 14, 46);
    s += emojiAt(moon ? "🌙" : "🎂", z.x + 8, z.y + 14, 58);
    if (moon) {
      for (const j of board.jumps) { const p = centre(board, j.from); s += emojiAt(j.kind === "boost" ? "🚀" : "☄️", p.x + 6, p.y + 12, j.kind === "boost" ? 44 : 42); }
    } else {
      for (const l of board.landmarks || []) { const p = centre(board, l.at); s += emojiAt(l.pic, p.x + 6, p.y + 14, 50); }
    }
    return s + "</svg>";
  }
  function emojiAt(e, x, y, size) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="' + size + '">' + e + "</text>";
  }

  // ---- Faces --------------------------------------------------------------
  // A person's face: a JoshArt.friend portrait (content.js FRIENDS) or an emoji.
  function faceHTML(person) {
    if (!person) return "";
    if (person.face && global.JoshArt && global.JoshArt.friend) {
      const C = global.JoshContent || {};
      const spec = (C.FRIENDS || []).find((f) => f.name === person.face);
      if (spec) { try { return global.JoshArt.friend(spec.art || {}); } catch (e) { /* the emoji below */ } }
    }
    return '<span class="bn-emoji">' + esc(person.emoji || "🙂") + "</span>";
  }

  // ---- Tokens ---------------------------------------------------------------
  // Where seat i's token sits on square n, as a fraction of the board. Two
  // tokens on one square stand side by side so both faces show.
  function spot(board, n, seat, shared) {
    const c = L.cellOf(board, n);
    // a little toward the bottom right, so the square's number (top left)
    // still shows under the token — he counts his hops by it
    let x = (c.col + 0.58) / board.cols, y = (board.rows - 1 - c.row + 0.6) / board.rows;
    if (shared) { x += (seat ? 0.2 : -0.2) / board.cols; y += (seat ? -0.13 : 0.13) / board.rows; }
    return { x, y };
  }

  // ---- 🍎 Apple Spin: the orchard ------------------------------------------
  // One square picture (600 x 600 units, the boards' own shape, so layout()
  // sizes it exactly as it sizes a board): seat 0's tree and basket on the
  // left, seat 1's on the right, the shared pie between the trees. The apples
  // that MOVE are DOM elements over it (board-main.js), placed by these spots.
  const ORCH = 600;
  const ORCHARD = {
    tree: [{ x: 150, y: 140 }, { x: 450, y: 140 }],
    face: [{ x: 150, y: 368 }, { x: 450, y: 368 }],
    pie: { x: 300, y: 318, r: 66 },
  };
  // slot k (0..9) of seat i's ten-frame: two rows of five, filled left to
  // right along the top row first, the way a ten-frame is counted
  function slotOf(i, k) {
    const x0 = i ? 316 : 16;
    return { x: x0 + 27 + 54 * (k % 5), y: 458 + 56 * Math.floor(k / 5) };
  }
  // where the k-th apple of the pie sits (a ring, then the middle)
  function pieSpot(k) {
    const P = ORCHARD.pie;
    if (k >= 8) return { x: P.x + ((k - 8) % 3 - 1) * 20, y: P.y + (Math.floor((k - 8) / 3) % 2 ? 12 : -10) };
    const a = -Math.PI / 2 + k * Math.PI / 4;
    return { x: P.x + 38 * Math.cos(a), y: P.y + 38 * Math.sin(a) };
  }
  // where the apples on each tree hang (the tree is never bare: it is big)
  const HANG = [[-62, -38], [-8, -72], [52, -46], [-70, 18], [0, -14], [64, 10], [-34, 54], [34, 52]];
  function treeSpot(i, k) {
    const t = ORCHARD.tree[i], h = HANG[((k % HANG.length) + HANG.length) % HANG.length];
    return { x: t.x + h[0], y: t.y + h[1] };
  }
  function orchardSVG() {
    let s = '<svg class="bn-svg" viewBox="0 0 ' + ORCH + " " + ORCH + '" preserveAspectRatio="none" aria-hidden="true" focusable="false">';
    s += '<rect x="0" y="0" width="600" height="600" rx="22" fill="#dff4d2"/>';
    s += '<rect x="0" y="380" width="600" height="220" rx="22" fill="#b9e3a2"/>';
    for (const t of ORCHARD.tree) {
      s += '<rect x="' + (t.x - 18) + '" y="' + (t.y + 70) + '" width="36" height="128" rx="10" fill="#8a5a33" stroke="#5c3a1e" stroke-width="3"/>';
      s += '<circle cx="' + t.x + '" cy="' + t.y + '" r="118" fill="#3fa34d" stroke="#226b2c" stroke-width="5"/>';
      s += '<circle cx="' + (t.x - 40) + '" cy="' + (t.y - 40) + '" r="44" fill="#57b862" opacity="0.8"/>';
      for (let k = 0; k < HANG.length; k++) {
        const a = { x: t.x + HANG[k][0], y: t.y + HANG[k][1] };
        s += '<circle cx="' + a.x + '" cy="' + a.y + '" r="17" fill="#e5394b" stroke="#8f1a26" stroke-width="2.5"/>';
        s += '<path d="M' + a.x + " " + (a.y - 16) + " l4 -9" + '" stroke="#5c3a1e" stroke-width="3" stroke-linecap="round"/>';
      }
    }
    // the pie dish between the trees: crust ring and a filling
    const P = ORCHARD.pie;
    s += '<circle cx="' + P.x + '" cy="' + P.y + '" r="' + P.r + '" fill="#e8b46a" stroke="#9a6224" stroke-width="5"/>';
    s += '<circle cx="' + P.x + '" cy="' + P.y + '" r="' + (P.r - 14) + '" fill="#f7dfb0"/>';
    // each basket: a wicker tray with a handle, holding a TEN-FRAME
    for (let i = 0; i < 2; i++) {
      const x0 = i ? 316 : 16;
      s += '<path d="M' + (x0 + 60) + " 436 Q" + (x0 + 134) + " 384 " + (x0 + 208) + ' 436" fill="none" stroke="#9a6224" stroke-width="9" stroke-linecap="round"/>';
      s += '<rect x="' + x0 + '" y="426" width="268" height="148" rx="22" fill="#d9a35f" stroke="#9a6224" stroke-width="5"/>';
      for (let k = 0; k < 10; k++) {
        const c = slotOf(i, k);
        s += '<rect x="' + (c.x - 23) + '" y="' + (c.y - 24) + '" width="46" height="48" rx="10" fill="#fff6e3" stroke="#9a6224" stroke-width="2.5"/>';
      }
    }
    return s + "</svg>";
  }
  // The spinner on a pad, before a spin: a wheel to tap (four wedges, a pointer)
  function spinnerSVG() {
    const cols = ["#e5394b", "#ffc21a", "#22a352", "#2f7fe0"];
    let s = '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">';
    for (let k = 0; k < 4; k++) {
      const a0 = (k * Math.PI) / 2, a1 = a0 + Math.PI / 2;
      s += '<path d="M50 52 L' + (50 + 42 * Math.cos(a0)).toFixed(1) + " " + (52 + 42 * Math.sin(a0)).toFixed(1) +
        " A42 42 0 0 1 " + (50 + 42 * Math.cos(a1)).toFixed(1) + " " + (52 + 42 * Math.sin(a1)).toFixed(1) + ' Z" fill="' + cols[k] + '" stroke="#1d1d2b" stroke-width="2"/>';
    }
    s += '<circle cx="50" cy="52" r="8" fill="#ffffff" stroke="#1d1d2b" stroke-width="2"/>';
    s += '<path d="M50 52 L50 18" stroke="#1d1d2b" stroke-width="6" stroke-linecap="round"/>';
    return s + "</svg>";
  }

  global.BoardRender = { boardSVG, shapeSVG, faceHTML, spot, centre, CELL, orchardSVG, spinnerSVG, slotOf, pieSpot, treeSpot, ORCHARD, ORCH };
})(typeof window !== "undefined" ? window : globalThis);
