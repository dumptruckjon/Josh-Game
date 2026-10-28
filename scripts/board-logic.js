// 🎲 Game Night — the PURE engine (PLAN_BOARD.md §5). No DOM, no Math.random,
// no clock: a game is a plain-JSON state that only these functions change, so
// a node test plays whole games headless and a saved game restores exactly.
// Dual export (window.BoardLogic / module.exports).
//
// One engine, two games. A DICE game (Moon Race) is roll → hop, hop, hop → the
// landing; a CARD game (Rainbow Trail) is draw → glide to the next square of
// the card's colour. Both share the seats, the fair bags, the turn order and
// the no-lose ending, which is the point: the turn routine is learned once.

(function (global) {
  "use strict";
  const DATA = global.BoardData || (typeof require === "function" ? require("./board-data.js") : null);

  // ---- A seeded generator whose whole state is ONE integer ----------------
  // (mulberry32). Kept in the game state, so a snapshot carries the dice too.
  function next(seat) {
    let t = (seat.rng = (seat.rng + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function shuffle(seat, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(next(seat) * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // ---- FAIR BAGS: each player's luck comes from their own shuffled bag ------
  // A die is a bag of 1..6, refilled once all six are used, so nobody rolls
  // three 1s in a row and both players see the same spread. A card bag holds
  // one card of each colour, one double and one picture card. Nobody's bag —
  // the computer's included — is ever weighted toward anyone.
  function dieBag(seat) { return shuffle(seat, [1, 2, 3, 4, 5, 6]); }
  function cardBag(seat, board) {
    const cs = DATA.COLOURS.map((c) => c.id);
    const bag = cs.map((c) => ({ kind: "one", c }));
    bag.push({ kind: "two", c: cs[Math.floor(next(seat) * cs.length)] });
    const lm = board.landmarks || [];
    if (lm.length) bag.push({ kind: "pic", at: lm[Math.floor(next(seat) * lm.length)].at });
    return shuffle(seat, bag);
  }
  function draw(seat, make) {
    if (!seat.bag.length) seat.bag = make();
    return seat.bag.shift();
  }

  // ---- Board geometry -------------------------------------------------------
  // Square n (1-based) → its column and row (0-based, row 0 at the BOTTOM),
  // snaking: even rows run left to right, odd rows right to left.
  function cellOf(board, n) {
    const i = n - 1, row = Math.floor(i / board.cols);
    const k = i % board.cols;
    return { col: row % 2 === 0 ? k : board.cols - 1 - k, row };
  }
  function jumpAt(board, n) { return (board.jumps || []).find((j) => j.from === n) || null; }
  // Rainbow Trail: the colour of square n (null on the start and the cake)
  function colourAt(board, n) {
    if (!board.colours || n < 2 || n >= board.size) return null;
    return board.colours.charAt(n - 2) || null;
  }
  function landmarkAt(board, n) { return (board.landmarks || []).find((l) => l.at === n) || null; }
  // The next square AFTER `from` of colour c, or the cake if none is left: the
  // end of the road is never a trap and never needs an exact count.
  function nextOf(board, from, c) {
    for (let n = from + 1; n < board.size; n++) if (colourAt(board, n) === c) return n;
    return board.size;
  }

  // Once anyone is home there are no more comets (the end is gentle), and a
  // long game switches them off too, so every game ends in minutes.
  const COMET_CAP = 40;   // rolls in total

  // ---- A new game -----------------------------------------------------------
  // opts: { board, seats: [{ who, cpu }], seed, first }
  function create(opts) {
    const board = DATA.board(opts.board);
    if (!board) throw new Error("no such board: " + opts.board);
    const seed = (opts.seed >>> 0) || 1;
    const seats = (opts.seats || []).slice(0, 2).map((s, i) => ({
      who: s.who, cpu: !!s.cpu, pos: 1, home: false, stars: 0, bag: [],
      rng: (seed * (i + 7) + 0x9E3779B9 * (i + 1)) | 0,
    }));
    if (seats.length !== 2) throw new Error("a game needs two seats");
    const first = opts.first === 1 ? 1 : 0;
    return {
      v: 1, board: board.id, game: board.game, seed,
      seats, turn: first, mover: first,
      phase: board.game === "cards" ? "draw" : "roll",
      die: 0, left: 0, card: null, rolls: 0, order: [],
    };
  }

  const anyHome = (st) => st.seats.some((s) => s.home);
  const other = (i) => (i === 0 ? 1 : 0);
  // Who a turn MOVES: your own token, or — once you are home — your friend's.
  function moverFor(st, seatIdx) { return st.seats[seatIdx].home ? other(seatIdx) : seatIdx; }

  function arrive(st, i, ev) {
    const s = st.seats[i];
    if (s.home) return;
    s.home = true;
    st.order.push(i);
    ev.push({ type: "home", seat: i, by: st.turn });
    if (!st.seats[other(i)].home) ev.push({ type: "helper", seat: i, helps: other(i) });
  }

  function endTurn(st, ev) {
    st.left = 0;
    if (st.seats.every((s) => s.home)) {
      st.phase = "done";
      ev.push({ type: "end" });
      return;
    }
    st.turn = other(st.turn);
    st.mover = moverFor(st, st.turn);
    st.phase = st.game === "cards" ? "draw" : "roll";
    ev.push({ type: "turn", seat: st.turn, mover: st.mover });
  }

  // ---- 🚀 Moon Race: roll, then one hop per tap ----------------------------
  function roll(st) {
    if (st.game !== "dice" || st.phase !== "roll") return [];
    const seat = st.seats[st.turn];
    const die = draw(seat, () => dieBag(seat));
    st.die = die; st.left = die; st.rolls += 1;
    st.mover = moverFor(st, st.turn);
    st.phase = "hop";
    return [{ type: "roll", seat: st.turn, mover: st.mover, die }];
  }

  function hop(st) {
    if (st.game !== "dice" || st.phase !== "hop" || st.left <= 0) return [];
    const board = DATA.board(st.board);
    const i = st.mover, s = st.seats[i];
    const ev = [];
    s.pos = Math.min(board.size, s.pos + 1);
    st.left -= 1;
    ev.push({ type: "hop", seat: i, to: s.pos, left: st.left });
    if (s.pos >= board.size) {
      // overshoot is home: the dots still to hop simply go dark
      arrive(st, i, ev);
      endTurn(st, ev);
      return ev;
    }
    if (st.left > 0) return ev;
    const j = jumpAt(board, s.pos);
    const cometsOn = !anyHome(st) && st.rolls <= COMET_CAP;
    if (j && (j.kind === "boost" || cometsOn)) {
      const from = s.pos;
      s.pos = j.to;
      s.stars += 1;              // every ride earns a star, up or down
      ev.push({ type: "ride", seat: i, kind: j.kind, from, to: j.to });
    }
    endTurn(st, ev);
    return ev;
  }

  // ---- 🌈 Rainbow Trail: draw a card, glide to the next square of its colour
  function drawCard(st) {
    if (st.game !== "cards" || st.phase !== "draw") return [];
    const board = DATA.board(st.board);
    const seat = st.seats[st.turn];
    const card = draw(seat, () => cardBag(seat, board));
    st.mover = moverFor(st, st.turn);
    const i = st.mover, s = st.seats[i];
    const from = s.pos;
    let to;
    if (card.kind === "pic" && card.at > from) to = card.at;
    else if (card.kind === "pic") to = nextOf(board, from, colourAt(board, card.at));
    else if (card.kind === "two") to = nextOf(board, nextOf(board, from, card.c), card.c);
    else to = nextOf(board, from, card.c);
    to = Math.min(board.size, to);
    // A move never goes backwards, under any card (a guardrail plays every
    // card from every square to prove it).
    if (to < from) to = from;
    s.pos = to;
    st.card = card;
    const path = [];
    for (let n = from + 1; n <= to; n++) path.push(n);
    const ev = [{ type: "card", seat: st.turn, mover: i, card, from, to, path }];
    if (to >= board.size) arrive(st, i, ev);
    endTurn(st, ev);
    return ev;
  }

  // One whole turn for the computer (and the tests' bot)
  function autoTurn(st) {
    if (st.phase === "done") return [];
    if (st.game === "cards") return drawCard(st);
    const ev = roll(st);
    let guard = 0;
    while (st.phase === "hop" && guard++ < 20) ev.push(...hop(st));
    return ev;
  }

  // ---- Save / restore -------------------------------------------------------
  function snapshot(st) { return JSON.parse(JSON.stringify(st)); }
  const int = (v) => typeof v === "number" && Number.isInteger(v);
  // A card this engine could have dealt on this board
  function okCard(board, c) {
    if (!c || typeof c !== "object") return false;
    if (c.kind === "pic") return !!landmarkAt(board, c.at);
    return (c.kind === "one" || c.kind === "two") && !!DATA.colour(c.c);
  }
  // What is left of a bag: a die bag is distinct faces 1..6, a card bag at
  // most one full deal of cards this board can deal
  function okBag(board, bag) {
    if (board.game === "dice") {
      return bag.length <= 6 && bag.every((n) => int(n) && n >= 1 && n <= 6) && new Set(bag).size === bag.length;
    }
    return bag.length <= DATA.COLOURS.length + 2 && bag.every((c) => okCard(board, c));
  }
  // A saved game comes back only if every field is one this engine could have
  // written — a hand-edited or truncated save is dropped, never half-played.
  function restore(snap) {
    try {
      if (!snap || typeof snap !== "object" || snap.v !== 1) return null;
      const board = DATA.board(snap.board);
      if (!board || snap.game !== board.game) return null;
      if (!Array.isArray(snap.seats) || snap.seats.length !== 2) return null;
      const okPhase = board.game === "cards" ? ["draw", "done"] : ["roll", "hop", "done"];
      if (okPhase.indexOf(snap.phase) < 0) return null;
      if (!int(snap.turn) || snap.turn < 0 || snap.turn > 1) return null;
      if (!int(snap.mover) || snap.mover < 0 || snap.mover > 1) return null;
      if (!int(snap.left) || snap.left < 0 || snap.left > 6) return null;
      if (!int(snap.die) || snap.die < 0 || snap.die > 6) return null;
      // hops are left exactly while hopping: a "hop" turn with none left
      // would be stuck for good (hop() refuses, nothing ends the turn)
      if ((snap.phase === "hop") !== (snap.left > 0)) return null;
      if (snap.phase === "hop" && snap.left > snap.die) return null;
      if (!int(snap.rolls) || snap.rolls < 0) return null;
      if (snap.card !== null && !okCard(board, snap.card)) return null;
      for (const s of snap.seats) {
        if (!s || typeof s.who !== "string" || !DATA.person(s.who)) return null;
        if (!int(s.pos) || s.pos < 1 || s.pos > board.size) return null;
        if (typeof s.home !== "boolean" || typeof s.cpu !== "boolean") return null;
        if (!int(s.stars) || s.stars < 0 || !int(s.rng)) return null;
        // home is exactly standing on the last square
        if (s.home !== (s.pos === board.size)) return null;
        if (!Array.isArray(s.bag) || !okBag(board, s.bag)) return null;
      }
      // the order they got home in names exactly the seats that are home
      const homeAt = [0, 1].filter((i) => snap.seats[i].home);
      if (!Array.isArray(snap.order) || snap.order.length !== homeAt.length) return null;
      if (snap.order.some((i) => homeAt.indexOf(i) < 0) || new Set(snap.order).size !== snap.order.length) return null;
      // the game is over exactly when both are home; until then the mover is
      // the one moverFor names (your own token, or your friend's once home)
      if ((snap.phase === "done") !== (homeAt.length === 2)) return null;
      if (snap.phase !== "done" && snap.mover !== moverFor(snap, snap.turn)) return null;
      return snapshot(snap);
    } catch (e) { return null; }
  }

  const BoardLogic = {
    create, roll, hop, drawCard, autoTurn, snapshot, restore,
    cellOf, jumpAt, colourAt, landmarkAt, nextOf, moverFor, COMET_CAP,
  };
  global.BoardLogic = BoardLogic;
  if (typeof module !== "undefined" && module.exports) module.exports = BoardLogic;
})(typeof window !== "undefined" ? window : globalThis);
