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

  global.BoardRender = { boardSVG, shapeSVG, faceHTML, spot, centre, CELL };
})(typeof window !== "undefined" ? window : globalThis);
