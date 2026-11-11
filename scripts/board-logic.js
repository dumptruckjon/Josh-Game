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

  // ---- How SHARPLY a computer friend plays ----------------------------------
  // Every thinking game's computer sees the good move only some of the time
  // (that game's own `*_SHARP`). A seat may carry its own `sharp` (0..1, where
  // 0.5 is "this game's own level"): a friend who plays a little better or
  // worse than that. No `sharp` on the seat = the game's own level exactly, so
  // every seeded game without one replays as it always did. Only SKILL moves:
  // the dice, cards and bags stay fair for everyone.
  const SHARP_MIN = 0.1, SHARP_MAX = 0.9;
  function sharpOf(st, base) {
    const v = st.seats[st.turn].sharp;
    return typeof v === "number" ? Math.min(SHARP_MAX, Math.max(SHARP_MIN, base + (v - 0.5))) : base;
  }
  // The games whose computer makes a choice a level can sharpen (the shell
  // gives a friend a level only there, and a test holds this to what the
  // games really do, both ways).
  const LEVEL_GAMES = ["pairs", "doors", "acorns", "dig", "nim", "lines", "top", "grab", "match3", "maze", "hide", "fish", "ten", "hilo", "train"];
  function levelled(boardId) {
    const b = DATA.board(boardId);
    return !!b && (LEVEL_GAMES.indexOf(b.game) >= 0 || (b.game === "dice" && !!b.two));
  }
  // A CLEVER move is named (`smart`), and a missed one too (`oops`) — only
  // when there was BOTH a clever move and a plain one to choose from, so the
  // word is never said for a move anyone would have made. These are events
  // only: nothing in the state changes.
  function judged(seat, why, clever, could, extra) {
    return could ? Object.assign({ type: clever ? "smart" : "oops", seat, why }, extra || {}) : null;
  }

  // ---- FAIR BAGS: each player's luck comes from their own shuffled bag ------
  // A die is a bag of 1..6, refilled once all six are used, so nobody rolls
  // three 1s in a row and both players see the same spread. A card bag holds
  // one card of each colour, one double and one picture card. Nobody's bag —
  // the computer's included — is ever weighted toward anyone.
  // (a board may give its die other FACES: 💯 Hundred Hop's has ten-bars)
  const facesOf = (board) => board.faces || [1, 2, 3, 4, 5, 6];
  function dieBag(seat, board) { return shuffle(seat, facesOf(board).slice()); }
  function cardBag(seat, board) {
    const cs = DATA.COLOURS.map((c) => c.id);
    const bag = cs.map((c) => ({ kind: "one", c }));
    bag.push({ kind: "two", c: cs[Math.floor(next(seat) * cs.length)] });
    const lm = board.landmarks || [];
    if (lm.length) bag.push({ kind: "pic", at: lm[Math.floor(next(seat) * lm.length)].at });
    return shuffle(seat, bag);
  }
  // 🍎 a spinner bag: the board's faces, plus a 🐦 (face 0) once birds are on
  function spinBag(seat, board, birds) {
    const bag = board.spinner.slice();
    if (birds) bag.push(0);
    return shuffle(seat, bag);
  }
  // 🐔 a spinner bag of the farm's animals, plus a 🦊 ("F") once the fox is on
  function henBag(seat, fox) {
    const bag = DATA.ANIMALS.map((a) => a.id);
    if (fox) bag.push(FOX);
    return shuffle(seat, bag);
  }
  const FOX = "F";
  function draw(seat, make) {
    if (!seat.bag.length) seat.bag = make();
    return seat.bag.shift();
  }

  // ---- Board geometry -------------------------------------------------------
  // Square n (1-based) → its column and row (0-based, row 0 at the BOTTOM),
  // snaking: even rows run left to right, odd rows right to left.
  // 💯 a "chart" board reads like a hundred chart instead: left to right on
  // every row, 1 at the TOP left, so the square straight below is ten more.
  function cellOf(board, n) {
    const i = n - 1, row = Math.floor(i / board.cols);
    if (board.layout === "chart") return { col: i % board.cols, row: board.rows - 1 - row };
    const k = i % board.cols;
    return { col: row % 2 === 0 ? k : board.cols - 1 - k, row };
  }
  function jumpAt(board, n) { return (board.jumps || []).find((j) => j.from === n) || null; }
  // Rainbow Trail: the colour of square n (null on the start and the cake)
  function colourAt(board, n) {
    if (!board.colours || n < 2 || n >= board.size) return null;
    return board.colours.charAt(n - 2) || null;
  }
  // 🐔 the animal on square n (null on the field and the hen house), and the
  // next square after `from` with animal a — or the hen house if none is left
  function animalAt(board, n) {
    if (!board.animals || n < 2 || n >= board.size) return null;
    return board.animals.charAt(n - 2) || null;
  }
  function nextAnimal(board, from, a) {
    for (let n = from + 1; n < board.size; n++) if (animalAt(board, n) === a) return n;
    return board.size;
  }
  function landmarkAt(board, n) { return (board.landmarks || []).find((l) => l.at === n) || null; }
  // The next square AFTER `from` of colour c, or the cake if none is left: the
  // end of the road is never a trap and never needs an exact count.
  function nextOf(board, from, c) {
    for (let n = from + 1; n < board.size; n++) if (colourAt(board, n) === c) return n;
    return board.size;
  }

  // Once anyone is home there are no more comets (the end is gentle), and a
  // long game switches them off too, so every game ends in minutes. The 🐦 in
  // Apple Spin keeps the same rules.
  const COMET_CAP = 40;   // rolls (or spins) in total
  // 🌈 a picture card BEHIND sends you back only in a game's first BACK_CAP
  // cards (both players'). Measured over 3000 games: at 40 the longest game
  // ran 52 turns; at 24 it is 42 with the median unchanged (18) and nearly
  // every slide kept (0.72 a game against 0.76).
  const BACK_CAP = 24;
  // Where a token STARTS: square 1 of a track, or an EMPTY basket
  const startOf = (board) => (board.game === "spin" || board.game === "lotto" || board.game === "spot" || board.game === "pairs" || board.game === "doors" || board.game === "acorns" || board.game === "dominoes" || board.game === "dig" || board.game === "nim" || board.game === "lines" || board.game === "top" || board.game === "grab" || board.game === "match3" || board.game === "maze" || board.game === "hide" || board.game === "cmatch" || board.game === "bingo" || board.game === "fish" || board.game === "ten" || board.game === "hilo" || board.game === "train" ? 0 : 1);

  // ---- A new game -----------------------------------------------------------
  // opts: { board, seats: [{ who, cpu }], seed, first }
  function create(opts) {
    const board = DATA.board(opts.board);
    if (!board) throw new Error("no such board: " + opts.board);
    const seed = (opts.seed >>> 0) || 1;
    const spin = board.game === "spin";
    const seats = (opts.seats || []).slice(0, 2).map((s, i) => {
      const seat = {
        who: s.who, cpu: !!s.cpu, pos: startOf(board), home: false, stars: 0, bag: [],
        rng: (seed * (i + 7) + 0x9E3779B9 * (i + 1)) | 0,
      };
      if (spin) seat.bird = false;   // did the 🐦 visit this player's last spin?
      if (board.game === "hen") seat.fox = false;   // was this player's last spin the 🦊?
      if (board.game === "doors") seat.shut = [];   // the doors this player has shut
      // a friend's own level (see sharpOf); absent = the game's own
      if (typeof s.sharp === "number" && s.sharp >= 0 && s.sharp <= 1) seat.sharp = s.sharp;
      return seat;
    });
    if (seats.length !== 2) throw new Error("a game needs two seats");
    const first = opts.first === 1 ? 1 : 0;
    const st = {
      v: 1, board: board.id, game: board.game, seed,
      seats, turn: first, mover: first,
      phase: firstPhase(board.game),
      die: 0, left: 0, card: null, rolls: 0, order: [],
    };
    if (spin) { st.pie = 0; st.birds = !!opts.birds; }
    // 🎲 a two-dice board: the two dice rolled, while he picks one
    if (board.two) st.dice = [];
    // 🐔 co-op: ONE hen for both (both seats stand where she stands), the
    // chicks she has brought home, and the chicks out playing with the fox
    if (board.game === "hen") { st.coop = 0; st.out = 0; st.fox = !!opts.fox; }
    // 🚪 the door held while he looks for the one that makes the rest, and
    // the misses this roll (so the screen can help after two)
    if (board.game === "doors") { st.held = null; st.misses = 0; }
    // 🌰 the ring of pots: seat i's three pots are i*4+0..2 and its nest is
    // i*4+3; acorns go round 0 → 7 and back to 0. A seat's `pos` is its nest.
    // 🁢 the line (its tiles oriented, so the dots at each open end are
    // `ends`), the two hands (face up) and the pile; one tile starts the line
    // and is never a double. A seat's `pos` is the tiles it has laid.
    if (board.game === "dominoes") {
      const deck = shuffle(seats[0], domSet(board));
      const k = deck.findIndex((id) => { const t = tileOf(id); return t[0] !== t[1]; });
      const start = tileOf(deck.splice(k, 1)[0]);
      st.line = [start];
      st.ends = [start[0], start[1]];
      st.hands = [deck.splice(0, board.hand), deck.splice(0, board.hand)];
      st.pile = deck;
      st.misses = 0;
      st.held = null;
      // (if every tile that fits is in the friend's hand, the friend starts)
      if (!domCanMove(st, first)) st.turn = st.mover = other(first);
      st.phase = domCanLay(st, st.turn) ? "lay" : "draw";
    }
    // 🏴‍☠️ the treasure's square (dealt from seat 0's generator, so it is
    // part of the seed) and the squares dug this round
    if (board.game === "dig") {
      st.dug = new Array(board.cols * board.rows).fill(false);
      st.spot = Math.floor(next(seats[0]) * st.dug.length);
      st.found = 0;
    }
    // 🍪 the jar open now (0..3) and the cookies still in it
    if (board.game === "nim") { st.jar = 0; st.cookies = board.jars[0]; }
    // 🔴 the grid (row 0 is the BOTTOM; -1 empty, else the seat whose counter
    // it is) and which board of the game this is
    // (and who dropped first: drops alternate over the whole game, so whose
    // turn it is and every seat's count follow from it)
    // 🃏 each player's own ten cards: the pile (face down), the hand (face
    // up), the card on the table this trick, and the cards of the tricks
    // played (`gone`, in trick order, so trick t is gone[0][t] v gone[1][t]).
    // `lead` leads this trick; `first` led the first, and the lead alternates.
    if (board.game === "top") {
      st.piles = [0, 1].map((i) => shuffle(seats[i], Array.from({ length: board.deck }, (x, k) => k + 1)));
      st.hands = st.piles.map((p) => p.splice(0, board.hand));
      st.table = [null, null];
      st.gone = [[], []];
      st.lead = first; st.first = first;
    }
    // 🎨 the grid of colours (row 0 at the BOTTOM), who owns each square (-1
    // nobody), and each seat's patch starting in its corner: seat 0 the
    // bottom left, seat 1 the top right — two different colours
    if (board.game === "grab") {
      const n = board.cols * board.rows, ids = DATA.COLOURS.map((c) => c.id);
      st.paint = Array.from({ length: n }, () => ids[Math.floor(next(seats[0]) * ids.length)]);
      const a = 0, b = n - 1;
      if (st.paint[b] === st.paint[a]) st.paint[b] = ids[(ids.indexOf(st.paint[a]) + 1 + Math.floor(next(seats[0]) * (ids.length - 1))) % ids.length];
      st.owner = new Array(n).fill(-1);
      st.owner[a] = 0; st.owner[b] = 1;
      // each patch swallows what already touches it in its own colour
      for (const j of [0, 1]) for (const k of grabCells(board, st.paint, st.owner, j, st.paint[j === 0 ? a : b])) st.owner[k] = j;
      seats[0].pos = st.owner.filter((o) => o === 0).length;
      seats[1].pos = st.owner.filter((o) => o === 1).length;
    }
    // 🎯 three dice, which are kept, the re-rolls left this turn, and the
    // turns each player has played (`pos`)
    if (board.game === "maze") mazeSetup(st, board);
    if (board.game === "cmatch") { cmDeal(st, seats[0]); st.round = 0; }
    if (board.game === "snow") st.parts = [[1], [1]];
    if (board.game === "fish") fishDeal(st, seats[0], board);
    if (board.game === "train") { st.round = 0; trainDeal(st, seats[0]); }
    if (board.game === "hilo") {
      st.deck = shuffle(seats[0], Array.from({ length: 20 }, (x, k) => (k % 10) + 1));
      st.top = st.deck.pop(); st.flips = 0;
    }
    if (board.game === "ten") {
      st.deck = shuffle(seats[0], Array.from({ length: 18 }, (x, k) => (k % 9) + 1));
      st.flowers = st.deck.splice(0, board.cols * board.rows);
      st.held = null; st.made = [];
      tenFill(st, seats[0]);
    }
    if (board.game === "bingo") { st.cardsB = seats.map((s) => bingoCard(s)); st.covered = [0, 1].map(() => new Array(9).fill(false)); st.misses = 0; }
    if (board.game === "hide") { hideRound(st, seats[0]); st.found = 0; st.asks = []; hideDeal(st); }
    if (board.game === "match3") { st.dice = [0, 0, 0]; st.held = [false, false, false]; st.left = 0; }
    if (board.game === "lines") { st.grid = new Array(board.cols * board.rows).fill(-1); st.boardNo = 0; st.first = first; }
    if (board.game === "acorns") {
      st.pots = [];
      for (let i = 0; i < 2; i++) { for (let k = 0; k < board.pots; k++) st.pots.push(board.start); st.pots.push(0); }
    }
    // 🧺 two blankets of six foods (never sharing one), one basket of all
    // twelve in a shuffled order, nothing on a blanket yet. Dealt from seat
    // 0's generator, so the deal is part of the seed. A seat's `pos` is how
    // many foods its blanket holds, and it is "home" once its blanket is full.
    // 👀 the thirteen cards shuffled, one turned up in the middle, nothing in
    // hand; a seat's `pos` is the twins it has found (its pile)
    if (board.game === "spot") {
      st.deck = shuffle(seats[0], board.deck.map((c, k) => k));
      st.centre = st.deck.shift();
      st.hand = null;
      st.misses = 0;
    }
    // 🧠 the pictures for every board of the game (four pairs a board, never
    // a picture twice in one game), the first board dealt face down
    if (board.game === "pairs") {
      st.pics = shuffle(seats[0], DATA.PAIRS.map((p) => p.id)).slice(0, board.boards * board.pairsPer);
      st.boardNo = 0;
      st.open = [];
      dealPairs(st, board);
    }
    if (board.game === "lotto") {
      const ids = shuffle(seats[0], DATA.FOODS.map((f) => f.id)).slice(0, board.spots * 2);
      st.blankets = [ids.slice(0, board.spots), ids.slice(board.spots)];
      st.placed = [[], []];
      st.basket = shuffle(seats[0], ids.slice());
      st.food = null;
      st.misses = 0;
    }
    return st;
  }
  function firstPhase(game) { return game === "spot" || game === "pairs" ? "flip" : game === "cards" || game === "lotto" ? "draw" : game === "spin" || game === "hen" ? "spin" : game === "acorns" ? "choose" : game === "dig" ? "dig" : game === "nim" ? "take" : game === "lines" ? "drop" : game === "top" ? "lead" : game === "grab" ? "pick" : game === "maze" ? "move" : game === "hide" ? "ask" : game === "cmatch" ? "play" : game === "fish" ? "ask" : game === "ten" ? "pick" : game === "hilo" ? "guess" : game === "train" ? "pick" : "roll"; }

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
    st.phase = firstPhase(st.game);
    ev.push({ type: "turn", seat: st.turn, mover: st.mover });
  }

  // ---- 🚪 Shut the Doors -------------------------------------------------------
  // The ways to make `d` from the mover's open doors: the door itself, or two
  // different doors that add up to it
  function doorWays(st) {
    const shut = st.seats[st.mover].shut, d = st.die, open = (n) => n >= 1 && n <= 6 && shut.indexOf(n) < 0;
    const ways = [];
    if (open(d)) ways.push([d]);
    for (let a = 1; a < d - a; a++) if (open(a) && open(d - a)) ways.push([a, d - a]);
    return ways;
  }
  function rollDoors(st) {
    const seat = st.seats[st.turn];
    st.die = draw(seat, () => dieBag(seat, DATA.board(st.board)));
    st.rolls += 1;
    st.mover = moverFor(st, st.turn);
    st.held = null;
    st.misses = 0;
    const ev = [{ type: "roll", seat: st.turn, die: st.die, mover: st.mover }];
    if (!doorWays(st).length) {
      // nothing fits: never a lost turn — roll again (the fair bag brings
      // every number within six rolls), so every turn shuts a door
      ev.push({ type: "stuck", seat: st.turn, mover: st.mover, die: st.die });
      return ev;
    }
    st.phase = "shut";
    return ev;
  }
  // Tap door `n`. The door that IS the roll shuts it; a smaller one with its
  // partner still open is HELD (then tap the partner); anything else is a
  // kind miss (the doors stay as they are).
  function shutDoor(st, n) {
    if (st.game !== "doors" || st.phase !== "shut") return [];
    const m = st.mover, s = st.seats[m], d = st.die;
    if (!int(n) || n < 1 || n > 6 || s.shut.indexOf(n) >= 0) return [];
    if (st.held === n) return [];   // the door already held (the hammer's echo)
    const open = (x) => x >= 1 && x <= 6 && s.shut.indexOf(x) < 0;
    let doors = null;
    if (n === d) doors = [n];
    else if (st.held != null && st.held + n === d) doors = [st.held, n];
    else if (n < d && n * 2 !== d && open(d - n)) { st.held = n; return [{ type: "hold", seat: st.turn, mover: m, door: n, die: d }]; }
    if (!doors) { st.misses += 1; return [{ type: "miss", seat: st.turn, mover: m, door: n, die: d, misses: st.misses }]; }
    for (const x of doors) s.shut.push(x);
    s.pos = s.shut.length;
    if (doors.length === 2) s.stars += 1;
    st.held = null;
    st.misses = 0;
    const ev = [{ type: "shut", seat: st.turn, mover: m, doors, die: d, count: s.pos }];
    if (s.pos === 6) arrive(st, m, ev);
    endTurn(st, ev);
    return ev;
  }
  // The computer's choice: it makes its number, but it is not clever about
  // WHICH way — a fair, seeded pick among the ways (so planning is his edge)
  function doorChoice(st) {
    const ways = doorWays(st);
    if (!ways.length) return null;
    // a friend with its own level looks for TWO doors (the ⭐) that often;
    // with none, any way — exactly as before
    const s = st.seats[st.turn];
    if (typeof s.sharp === "number") {
      const two = ways.filter((w) => w.length === 2);
      if (two.length && two.length < ways.length && next(s) < s.sharp) return two[Math.floor(next(s) * two.length)];
    }
    return ways[Math.floor(next(s) * ways.length)];
  }

  // ---- 🏴‍☠️ Treasure Dig ------------------------------------------------------
  // The arrow from square k toward square j: one of eight, by row and column
  const DIRS = ["up-left", "up", "up-right", "left", "", "right", "down-left", "down", "down-right"];
  function digDir(board, k, j) {
    const c = board.cols, dc = Math.sign((j % c) - (k % c)), dr = Math.sign(Math.floor(j / c) - Math.floor(k / c));
    return DIRS[(dr + 1) * 3 + (dc + 1)];
  }
  // the squares the arrows dug so far still allow
  function digMaybe(st) {
    const board = DATA.board(st.board);
    return st.dug.map((d, j) => j).filter((j) => !st.dug[j] && st.dug.every((d, k) => !d || digDir(board, k, j) === digDir(board, k, st.spot)));
  }
  // Dig square k: the treasure (a ⭐; a new one is buried, or after the last
  // one the party), or an arrow toward it. Either way the turn passes.
  function digAt(st, k) {
    if (st.game !== "dig" || st.phase !== "dig") return [];
    const board = DATA.board(st.board);
    if (!int(k) || k < 0 || k >= st.dug.length || st.dug[k]) return [];
    const i = st.turn, s = st.seats[i];
    // clever: a square every arrow still points at (once an arrow rules any out)
    const maybe = digMaybe(st);
    const sm = judged(i, "arrows", maybe.indexOf(k) >= 0, maybe.length < st.dug.filter((d) => !d).length);
    st.dug[k] = true;
    st.rolls += 1;
    const ev = [];
    if (k === st.spot) {
      s.pos += 1; s.stars += 1; st.found += 1;
      ev.push({ type: "treasure", seat: i, k, n: st.found });
      if (st.found >= board.treasures) {
        for (const x of st.seats) x.home = true;
        st.order = [0, 1];
        st.phase = "done";
        ev.push({ type: "end" });
        return ev;
      }
      st.dug = st.dug.map(() => false);
      st.spot = Math.floor(next(st.seats[0]) * st.dug.length);
      ev.push({ type: "bury" });
    } else {
      ev.push({ type: "hole", seat: i, k, dir: digDir(board, k, st.spot) });
      if (sm) ev.push(sm);
    }
    endTurn(st, ev);
    return ev;
  }
  // The computer reads the arrows only `DIG_SHARP` of the time (its own
  // seeded luck), else digs anywhere — so reasoning is his edge
  const DIG_SHARP = 0.5;
  function digChoice(st) {
    const s = st.seats[st.turn];
    const open = st.dug.map((d, j) => j).filter((j) => !st.dug[j]);
    const maybe = digMaybe(st);
    const from = next(s) < sharpOf(st, DIG_SHARP) ? maybe : open;
    return from[Math.floor(next(s) * from.length)];
  }

  // ---- 🍪 Cookie Jar ------------------------------------------------------------
  // The takes the mover may make: one, two or three, never more than are left
  function nimTakes(st) {
    const board = DATA.board(st.board), t = [];
    for (let k = 1; k <= Math.min(board.take, st.cookies); k++) t.push(k);
    return t;
  }
  // Take k cookies (they go on the mover's plate, `pos`). The last one in the
  // jar is the golden ⭐: the next jar is opened, or after the last jar it is
  // the party. The turn always passes, so who starts a jar alternates.
  function takeCookies(st, k) {
    if (st.game !== "nim" || st.phase !== "take") return [];
    const board = DATA.board(st.board);
    if (!int(k) || k < 1 || k > board.take || k > st.cookies) return [];
    const i = st.turn, s = st.seats[i];
    // clever: the take that leaves the friend a multiple of four
    const best = nimBest(st);
    const sm = judged(i, "four", k === best, best > 0 && nimTakes(st).length > 1 && st.cookies - best > 0, { left: st.cookies - k });
    st.cookies -= k; s.pos += k; st.rolls += 1;
    const ev = [{ type: "nibble", seat: i, n: k, left: st.cookies }];
    if (sm) ev.push(sm);
    if (st.cookies === 0) {
      s.stars += 1;
      ev.push({ type: "golden", seat: i, jar: st.jar });
      if (st.jar === board.jars.length - 1) {
        for (const x of st.seats) x.home = true;
        st.order = [0, 1];
        st.phase = "done";
        ev.push({ type: "end" });
        return ev;
      }
      st.jar += 1;
      st.cookies = board.jars[st.jar];
      ev.push({ type: "jar", jar: st.jar, n: st.cookies });
    }
    endTurn(st, ev);
    return ev;
  }
  // The take that leaves a multiple of four (take+1): then whatever the friend
  // takes, the golden one is yours. 0 when there is none (a multiple of four
  // is in the jar already — any take, and hope).
  function nimBest(st) {
    const board = DATA.board(st.board), k = st.cookies % (board.take + 1);
    return k >= 1 && k <= Math.min(board.take, st.cookies) ? k : 0;
  }
  // The computer leaves a multiple of four only `NIM_SHARP` of the time (its
  // own seeded luck), else takes any — so planning is his edge
  const NIM_SHARP = 0.5;
  function nimChoice(st) {
    const s = st.seats[st.turn], best = nimBest(st);
    if (best && next(s) < sharpOf(st, NIM_SHARP)) return best;
    const t = nimTakes(st);
    return t[Math.floor(next(s) * t.length)];
  }

  // ---- 🐭 Mouse Maze -----------------------------------------------------------------
  // An arrow card is a number 0-7: its direction is id >> 1 (up, down, left,
  // right) and its steps (id & 1) + 1. Each player has a fair bag of all eight.
  const MAZE_DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const MAZE_WORDS = ["up", "down", "left", "right"];
  const arrowBag = (seat) => shuffle(seat, [0, 1, 2, 3, 4, 5, 6, 7]);
  const mazeFree = (st, board, k) => k >= 0 && k < board.cols * board.rows && st.pots.indexOf(k) < 0;
  // the squares the mouse steps on for card `id`, from `from`: it stops at
  // the garden's edge, a plant pot, or the cheese (it eats it on the way)
  function mazePath(st, id, from) {
    const board = DATA.board(st.board), d = MAZE_DIRS[id >> 1];
    let c = from % board.cols, r = Math.floor(from / board.cols);
    const path = [];
    for (let s = 0; s < (id & 1) + 1; s++) {
      const nc = c + d[0], nr = r + d[1];
      if (nc < 0 || nc >= board.cols || nr < 0 || nr >= board.rows || !mazeFree(st, board, nr * board.cols + nc)) break;
      c = nc; r = nr;
      path.push(r * board.cols + c);
      if (r * board.cols + c === st.cheese) break;
    }
    return path;
  }
  // steps between two squares round the pots (Infinity if walled in)
  function mazeDist(st, a, b) {
    const board = DATA.board(st.board), n = board.cols * board.rows;
    const dist = new Array(n).fill(Infinity);
    dist[a] = 0;
    const q = [a];
    while (q.length) {
      const k = q.shift();
      if (k === b) return dist[k];
      const c = k % board.cols, r = Math.floor(k / board.cols);
      for (const d of MAZE_DIRS) {
        const nc = c + d[0], nr = r + d[1], j = nr * board.cols + nc;
        if (nc < 0 || nc >= board.cols || nr < 0 || nr >= board.rows || !mazeFree(st, board, j) || dist[j] !== Infinity) continue;
        dist[j] = dist[k] + 1; q.push(j);
      }
    }
    return Infinity;
  }
  // the free squares beside square k
  function mazeWays(st, board, k) {
    const c = k % board.cols, r = Math.floor(k / board.cols);
    return MAZE_DIRS.filter((d) => { const nc = c + d[0], nr = r + d[1]; return nc >= 0 && nc < board.cols && nr >= 0 && nr < board.rows && mazeFree(st, board, nr * board.cols + nc); }).length;
  }
  // a new cheese: on a free square two to four steps from BOTH mice (about
  // as far from each), and
  // never in a pocket with one way in (the mouse could circle it for ever,
  // waiting for that one arrow)
  function placeCheese(st, seat) {
    const board = DATA.board(st.board), n = board.cols * board.rows;
    const far = [];
    for (let k = 0; k < n; k++) {
      if (!mazeFree(st, board, k) || st.mice.indexOf(k) >= 0 || mazeWays(st, board, k) < 2) continue;
      const a = mazeDist(st, st.mice[0], k), b = mazeDist(st, st.mice[1], k);
      if (a >= 2 && b >= 2 && a <= 4 && b <= 4 && Math.abs(a - b) <= 1) far.push(k);
    }
    if (!far.length) for (let k = 0; k < n; k++) if (mazeFree(st, board, k) && st.mice.indexOf(k) < 0 && mazeDist(st, st.mice[0], k) < Infinity) far.push(k);
    st.cheese = far[Math.floor(next(seat) * far.length)];
  }
  function mazeSetup(st, board) {
    const s0 = st.seats[0], n = board.cols * board.rows;
    // each player's own mouse: his in the bottom left, his friend's top right
    st.mice = [(board.rows - 1) * board.cols, board.cols - 1];
    // the pots: never on a mouse, never walling a square in
    for (let guard = 0; guard < 200; guard++) {
      const pots = [];
      while (pots.length < board.pots) {
        const k = Math.floor(next(s0) * n);
        if (st.mice.indexOf(k) < 0 && pots.indexOf(k) < 0) pots.push(k);
      }
      st.pots = pots.sort((a, b) => a - b);
      let ok = true;
      for (let k = 0; k < n && ok; k++) if (mazeFree(st, board, k) && mazeDist(st, st.mice[0], k) === Infinity) ok = false;
      if (ok) break;
    }
    st.cheese = -1;
    placeCheese(st, s0);
    st.found = 0;
    st.hands = st.seats.map((s) => { const h = []; while (h.length < board.hand) h.push(draw(s, () => arrowBag(s))); return h; });
    mazeRedeal(st, st.turn);
  }
  // does card `id` take mouse i nearer the cheese (or onto it)?
  function mazeNearer(st, i, id) {
    const p = mazePath(st, id, st.mice[i]);
    if (!p.length) return false;
    const at = p[p.length - 1];
    return at === st.cheese || mazeDist(st, at, st.cheese) < mazeDist(st, st.mice[i], st.cheese);
  }
  // a hand with no arrow that takes his mouse nearer the cheese is dealt
  // again: there is always a good move to find (and never a lost turn)
  function mazeRedeal(st, i) {
    const s = st.seats[i];
    let changed = false;
    for (let guard = 0; guard < 24 && (st.cheese < 0 ? !st.hands[i].some((id) => mazePath(st, id, st.mice[i]).length) : !st.hands[i].some((id) => mazeNearer(st, i, id))); guard++) {
      st.hands[i][guard % st.hands[i].length] = draw(s, () => arrowBag(s));
      changed = true;
    }
    return changed;
  }
  // play card k of the mover's hand: the mouse scurries; the cheese is a ⭐
  function moveMouse(st, k) {
    if (st.game !== "maze" || st.phase !== "move") return [];
    const board = DATA.board(st.board), i = st.turn, s = st.seats[i];
    const id = st.hands[i][k];
    if (id == null) return [];
    const path = mazePath(st, id, st.mice[i]);
    if (!path.length) return [];
    // clever: the arrow that ends nearest the cheese
    const near = mazeBest(st), ways = st.hands[i].filter((c) => mazePath(st, c, st.mice[i]).length).length;
    const sm = judged(i, "near", near.indexOf(k) >= 0, near.length < ways);
    st.mice[i] = path[path.length - 1];
    st.hands[i][k] = draw(s, () => arrowBag(s));
    const ev = [{ type: "scurry", seat: i, card: id, path, dir: id >> 1 }];
    if (sm) ev.push(sm);
    if (st.mice[i] === st.cheese) {
      s.stars += 1; s.pos += 1; st.found += 1;
      ev.push({ type: "cheese", seat: i, found: st.found });
      if (st.found >= board.cheese) {
        for (const x of st.seats) x.home = true;
        st.order = [0, 1];
        st.phase = "done";
        st.cheese = -1;
        ev.push({ type: "end" });
        return ev;
      }
      placeCheese(st, s);
      ev.push({ type: "newcheese", at: st.cheese });
      mazeRedeal(st, i);
    }
    endTurn(st, ev);
    if (mazeRedeal(st, st.turn)) ev.push({ type: "redeal", seat: st.turn });
    return ev;
  }
  // the cards that move the mouse closest to the cheese (onto it, best of all)
  function mazeBest(st) {
    const h = st.hands[st.turn];
    let best = Infinity, out = [];
    h.forEach((id, k) => {
      const p = mazePath(st, id, st.mice[st.turn]);
      if (!p.length) return;
      const at = p[p.length - 1], d = at === st.cheese ? -1 : mazeDist(st, at, st.cheese);
      if (d < best) { best = d; out = [k]; } else if (d === best) out.push(k);
    });
    return out;
  }
  // the computer sees the best arrow only `MAZE_SHARP` of the time
  const MAZE_SHARP = 0.5;
  function mazeChoice(st) {
    const s = st.seats[st.turn];
    const moves = st.hands[st.turn].map((id, k) => k).filter((k) => mazePath(st, st.hands[st.turn][k], st.mice[st.turn]).length);
    const best = mazeBest(st);
    return next(s) < sharpOf(st, MAZE_SHARP) ? best[0] : moves[Math.floor(next(s) * moves.length)];
  }

  // ---- 🕵️ Who's Hiding ---------------------------------------------------------------
  // Eighteen hiders: three animals × three shirt colours × a hat or none. A
  // hider's id is animal*6 + colour*2 + hat. Nine are on the board each round
  // and one of them is hiding. A QUESTION is 0-2 (that animal), 3-5 (that
  // colour) or 6 (a hat). Asked, it is answered for the hider, and everyone
  // the answer rules out goes down. Whoever leaves just one standing found
  // them: a ⭐, and somebody new hides.
  const hideTraits = (id) => ({ a: Math.floor(id / 6), c: Math.floor(id / 2) % 3, h: id % 2 });
  function hideYes(q, id) {
    const t = hideTraits(id);
    return q < 3 ? t.a === q : q < 6 ? t.c === q - 3 : t.h === 1;
  }
  const hideUp = (st) => st.cards.filter((id, k) => st.up[k]);
  // How many a question would put down at worst (0: it rules nobody out)
  function hideSplit(st, q) {
    const up = hideUp(st), y = up.filter((id) => hideYes(q, id)).length;
    return Math.min(y, up.length - y);
  }
  // The questions the mover may ask: the one that splits the board most
  // evenly, and two others — and an other may rule nobody out (no cats are
  // left, so "is it a cat?" puts nobody down: noticing that is the game)
  function hideDeal(st) {
    const s = st.seats[st.turn], board = DATA.board(st.board);
    const qs = [0, 1, 2, 3, 4, 5, 6];
    const best = Math.max(...qs.map((q) => hideSplit(st, q)));
    const tops = qs.filter((q) => hideSplit(st, q) === best);
    const top = tops[Math.floor(next(s) * tops.length)];
    const rest = shuffle(s, qs.filter((q) => q !== top)).slice(0, board.ask - 1);
    st.asks = shuffle(s, [top].concat(rest));
  }
  function hideRound(st, s) {
    const board = DATA.board(st.board);
    st.cards = shuffle(s, Array.from({ length: 18 }, (x, k) => k)).slice(0, board.cols * board.rows).sort((a, b) => a - b);
    st.up = st.cards.map(() => true);
    st.hidden = Math.floor(next(s) * st.cards.length);
  }
  // Ask question k of the mover's three
  function askHide(st, k) {
    if (st.game !== "hide" || st.phase !== "ask") return [];
    const q = st.asks[k];
    if (q == null) return [];
    const board = DATA.board(st.board), i = st.turn, s = st.seats[i];
    // clever: the question that turns down the most, whatever the answer
    const bestQ = hideBest(st);
    const sm = judged(i, "ask", bestQ.indexOf(k) >= 0, bestQ.length < st.asks.length);
    const yes = hideYes(q, st.cards[st.hidden]);
    const down = [];
    st.cards.forEach((id, j) => { if (st.up[j] && hideYes(q, id) !== yes) { st.up[j] = false; down.push(j); } });
    st.rolls += 1;
    const ev = [{ type: "ask", seat: i, q, yes, down }];
    if (sm) ev.push(sm);
    if (st.up.filter(Boolean).length === 1) {
      s.stars += 1; s.pos += 1; st.found += 1;
      ev.push({ type: "hideFound", seat: i, card: st.cards[st.hidden], found: st.found });
      if (st.found >= board.rounds) {
        for (const x of st.seats) x.home = true;
        st.order = [0, 1];
        st.phase = "done";
        st.asks = [];
        ev.push({ type: "end" });
        return ev;
      }
      hideRound(st, s);
      ev.push({ type: "hideNew" });
    }
    endTurn(st, ev);
    hideDeal(st);
    return ev;
  }
  // The questions that put down the most at worst
  function hideBest(st) {
    const sp = st.asks.map((q) => hideSplit(st, q)), best = Math.max(...sp);
    return st.asks.map((q, k) => k).filter((k) => sp[k] === best);
  }
  // The computer picks the best question only `HIDE_SHARP` of the time
  const HIDE_SHARP = 0.5;
  function hideChoice(st) {
    const s = st.seats[st.turn];
    return next(s) < sharpOf(st, HIDE_SHARP) ? hideBest(st)[0] : Math.floor(next(s) * st.asks.length);
  }

  // ---- 🚂 Pattern Train ---------------------------------------------------------------
  // A train of five cars in a colour PATTERN (each colour with its shape, so it
  // reads in any colour vision), and a sixth car missing. Three cars wait: tap
  // the one that carries the pattern on — a ⭐, it joins the train, and a new
  // train pulls in. Another car: "that one breaks the pattern", and the turn
  // passes with the same train (so a friend can find it). Eight trains, the
  // patterns growing (AB, then AAB and ABB, then ABC and AABB): one party.
  const TRAIN_PATTERNS = ["AB", "AB", "AAB", "ABB", "ABC", "AABB", "ABC", "AAB"];
  const TRAIN_SHOWN = 5;
  function trainDeal(st, s) {
    const ids = shuffle(s, DATA.COLOURS.map((c) => c.id));
    const pat = TRAIN_PATTERNS[st.round % TRAIN_PATTERNS.length];
    const col = (ch) => ids["ABC".indexOf(ch)];
    st.cars = Array.from({ length: TRAIN_SHOWN }, (x, k) => col(pat[k % pat.length]));
    st.answer = col(pat[TRAIN_SHOWN % pat.length]);
    // the answer and two others: a colour of the pattern that is not next
    // (when there is one), and one the pattern never uses
    const inPat = [...new Set(pat.split("").map(col))].filter((c) => c !== st.answer);
    const outPat = ids.filter((c) => pat.split("").map(col).indexOf(c) < 0);
    const others = inPat.slice(0, 1).concat(outPat).slice(0, 2);
    st.options = shuffle(s, [st.answer].concat(others));
    st.misses = 0;
  }
  function pickCar(st, k) {
    if (st.game !== "train" || st.phase !== "pick") return [];
    const c = st.options[k];
    if (c == null) return [];
    const board = DATA.board(st.board), i = st.turn, s = st.seats[i];
    st.rolls += 1;
    if (c !== st.answer) {
      st.misses += 1;
      const ev = [{ type: "carMiss", seat: i, k, c }];
      endTurn(st, ev);
      return ev;
    }
    s.stars += 1; s.pos += 1; st.round += 1;
    const ev = [{ type: "carRight", seat: i, k, c, cars: st.cars.concat([c]) }];
    if (st.round >= board.trains) {
      for (const x of st.seats) x.home = true;
      st.order = [0, 1];
      st.phase = "done";
      ev.push({ type: "end" });
      return ev;
    }
    trainDeal(st, s);
    ev.push({ type: "carNew", cars: st.cars.slice() });
    endTurn(st, ev);
    return ev;
  }
  // the computer sees the pattern only `TRAIN_SHARP` of the time
  const TRAIN_SHARP = 0.5;
  function trainChoice(st) {
    const s = st.seats[st.turn];
    return next(s) < sharpOf(st, TRAIN_SHARP) ? st.options.indexOf(st.answer) : Math.floor(next(s) * st.options.length);
  }

  // ---- 🔼 Higher or Lower --------------------------------------------------------------
  // Twenty cards, 1 to 10 twice. One is turned up. On your turn guess: will
  // the next card be BIGGER or SMALLER? Turn it over — right is a ⭐ (the same
  // number: "the same!", no ⭐ and no loss). Then it is the card to beat for
  // your friend. Twelve cards turned, one party. The skill: a small card
  // means guess bigger, a big card guess smaller. (Measured: 54% of the ⭐s
  // guessing that way against 43% guessing anyhow.)
  function hiloGuess(st, up) {
    if (st.game !== "hilo" || st.phase !== "guess" || typeof up !== "boolean") return [];
    const board = DATA.board(st.board), i = st.turn, s = st.seats[i];
    // clever: the guess more of the cards still in the deck agree with — said
    // whether or not the card then obliges (the THINKING is what is named)
    const hi = st.deck.filter((x) => x > st.top).length, lo = st.deck.filter((x) => x < st.top).length;
    const sm = judged(i, "odds", up === (hi > lo), hi !== lo, { was: st.top, up });
    const was = st.top, c = st.deck.pop();
    st.top = c; st.flips += 1; st.rolls += 1;
    const right = up ? c > was : c < was;
    if (right) { s.stars += 1; s.pos += 1; }
    const ev = [{ type: "hilo", seat: i, up, was, card: c, right, same: c === was }];
    if (sm) ev.push(sm);
    if (st.flips >= board.flips) {
      for (const x of st.seats) x.home = true;
      st.order = [0, 1];
      st.phase = "done";
      ev.push({ type: "end" });
      return ev;
    }
    endTurn(st, ev);
    return ev;
  }
  // the better guess: more cards left bigger than the top one, or smaller
  function hiloBest(st) {
    const hi = st.deck.filter((x) => x > st.top).length, lo = st.deck.filter((x) => x < st.top).length;
    return hi >= lo;
  }
  const HILO_SHARP = 0.5;
  function hiloChoice(st) {
    const s = st.seats[st.turn];
    return next(s) < sharpOf(st, HILO_SHARP) ? hiloBest(st) : next(s) < 0.5;
  }

  // ---- 🍯 Honey Ten ----------------------------------------------------------------
  // Eighteen flower cards: 1 to 9, twice (so they make exactly nine tens: 1+9,
  // 2+8, 3+7, 4+6 twice each and 5+5 once). Nine are in the meadow, drawn as
  // ten-frames. Tap one, then one that makes TEN with it: a jar of honey, a
  // ⭐, and two new flowers. Not ten: "7 and 2 make 9", and the turn passes.
  // The meadow always holds a ten to find. Every ten made, one party. The
  // skill: knowing what makes ten (a held card's ten-frame shows how many
  // more it needs).
  function tenHasPair(v) {
    const live = v.filter((x) => x > 0);
    return live.some((x, k) => live.some((y, j) => j !== k && x + y === 10));
  }
  // fill the empty places from the deck, then make sure there is a ten to find
  function tenFill(st, s) {
    for (let k = 0; k < st.flowers.length; k++) if (!st.flowers[k] && st.deck.length) st.flowers[k] = st.deck.pop();
    let g = 0;
    while (!tenHasPair(st.flowers) && st.deck.length && g++ < 40) {
      // swap a flower for a deck card that makes ten with another flower
      const live = st.flowers.map((x, k) => k).filter((k) => st.flowers[k] > 0);
      const want = st.deck.map((x, j) => j).filter((j) => live.some((k) => st.flowers[k] + st.deck[j] === 10));
      if (!want.length) break;
      const j = want[Math.floor(next(s) * want.length)];
      const partner = live.filter((k) => st.flowers[k] + st.deck[j] === 10);
      const out = live.filter((k) => partner.indexOf(k) < 0 || partner.length > 1);
      const k = out[Math.floor(next(s) * out.length)];
      const was = st.flowers[k];
      st.flowers[k] = st.deck[j];
      st.deck[j] = was;
    }
  }
  function tenPick(st, k) {
    if (st.game !== "ten" || st.phase !== "pick") return [];
    const i = st.turn, s = st.seats[i], v = st.flowers;
    if (!int(k) || k < 0 || k >= v.length || !v[k] || k === st.held) return [];
    if (st.held == null) { st.held = k; return [{ type: "tenHold", seat: i, k, n: v[k] }]; }
    const a = st.held, ev = [];
    st.held = null; st.rolls += 1;
    if (v[a] + v[k] !== 10) {
      ev.push({ type: "tenMiss", seat: i, a, b: k, sum: v[a] + v[k], na: v[a], nb: v[k] });
      endTurn(st, ev);
      return ev;
    }
    st.made.push([v[a], v[k]]);
    s.stars += 1; s.pos += 1;
    ev.push({ type: "tenPair", seat: i, a, b: k, na: v[a], nb: v[k] });
    v[a] = 0; v[k] = 0;
    tenFill(st, s);
    if (!tenHasPair(v)) {
      for (const x of st.seats) x.home = true;
      st.order = [0, 1];
      st.phase = "done";
      ev.push({ type: "end" });
      return ev;
    }
    ev.push({ type: "tenFresh", flowers: v.slice() });
    endTurn(st, ev);
    return ev;
  }
  // the tens in the meadow, as pairs of places
  function tenPairs(st) {
    const v = st.flowers, out = [];
    for (let a = 0; a < v.length; a++) for (let b = a + 1; b < v.length; b++) if (v[a] && v[b] && v[a] + v[b] === 10) out.push([a, b]);
    return out;
  }
  // the computer finds a ten only `TEN_SHARP` of the time (else it tries two
  // flowers that are not)
  const TEN_SHARP = 0.5;
  function tenChoice(st) {
    const s = st.seats[st.turn], tens = tenPairs(st);
    if (next(s) < sharpOf(st, TEN_SHARP)) return tens[Math.floor(next(s) * tens.length)];
    const live = st.flowers.map((x, k) => k).filter((k) => st.flowers[k] > 0);
    const a = live[Math.floor(next(s) * live.length)], rest = live.filter((k) => k !== a);
    return [a, rest[Math.floor(next(s) * rest.length)]];
  }

  // ---- 🐟 Go Fish -------------------------------------------------------------------
  // Ten pictures, two of each. Both hands are face UP (a four-year-old's Go
  // Fish: no secrets). Ask for a picture in your hand: if your friend has it
  // they give it, it makes a pair (a ⭐) and you go again; if not, "Go fish!" —
  // take one from the pond (a pair if it matches one you hold) and the turn
  // passes. The skill: SEE a picture you both have, and ask for that one.
  // (Measured: asking for a picture you both hold makes 61% of the pairs,
  // asking for any 44%.) Every pair made: one party.
  const FISH_N = 10;
  // a hand with no pair in it (the deal is redone until neither has one)
  const fishHasPair = (h) => new Set(h).size !== h.length;
  function fishDeal(st, s, board) {
    let deck;
    for (let g = 0; g < 50; g++) {
      deck = shuffle(s, Array.from({ length: FISH_N * 2 }, (x, k) => k % FISH_N));
      if (!fishHasPair(deck.slice(0, board.hand)) && !fishHasPair(deck.slice(board.hand, 2 * board.hand))) break;
    }
    st.hands = [deck.splice(0, board.hand), deck.splice(0, board.hand)];
    st.pond = deck;
    st.pairs = [[], []];
    st.want = -1;
    st.misses = 0;
  }
  const fishPairs = (st) => st.pairs[0].length + st.pairs[1].length;
  // a pair made: both cards off the hand onto the pile, a ⭐
  function fishPair(st, i, q) {
    st.hands[i] = st.hands[i].filter((x) => x !== q);
    st.pairs[i].push(q);
    st.seats[i].stars += 1; st.seats[i].pos += 1;
  }
  function fishOver(st, ev) {
    if (fishPairs(st) < FISH_N) return false;
    for (const x of st.seats) x.home = true;
    st.order = [0, 1];
    st.phase = "done";
    ev.push({ type: "end" });
    return true;
  }
  // an empty hand takes a card from the pond (if there is one)
  function fishRefill(st, i, ev) {
    if (st.hands[i].length || !st.pond.length) return;
    st.hands[i].push(st.pond.pop());
    ev.push({ type: "fishRefill", seat: i, card: st.hands[i][0] });
  }
  function fishNext(st, ev) {
    endTurn(st, ev);
    if (st.phase !== "done") fishRefill(st, st.turn, ev);
  }
  // Ask for the picture on card k of the mover's hand
  function askFish(st, k) {
    if (st.game !== "fish" || st.phase !== "ask") return [];
    const q = st.hands[st.turn][k];
    if (q == null) return [];
    // clever: asking for a picture the friend can be SEEN to hold
    const both = fishBest(st);
    const sm = judged(st.turn, "see", both.indexOf(k) >= 0, both.length > 0 && both.length < st.hands[st.turn].length);
    st.want = q; st.misses = 0; st.rolls += 1;
    st.phase = "answer";
    const ev = [{ type: "fishAsk", seat: st.turn, q }];
    if (sm) ev.push(sm);
    return ev;
  }
  // The friend answers: card k of THEIR hand if they have the picture, or -1
  // for "Go fish!" when they do not. Anything else is a kind miss (no fibs:
  // a friend who has it gives it).
  function answerFish(st, k) {
    if (st.game !== "fish" || st.phase !== "answer") return [];
    const i = st.turn, o = other(i), q = st.want, has = st.hands[o].indexOf(q) >= 0;
    if (has ? st.hands[o][k] !== q : k !== -1) { st.misses += 1; return [{ type: "fishMiss", seat: o, k, misses: st.misses }]; }
    const ev = [];
    st.want = -1; st.misses = 0;
    if (has) {
      st.hands[o].splice(st.hands[o].indexOf(q), 1);
      fishPair(st, i, q);
      ev.push({ type: "fishGive", seat: i, from: o, q });
      if (fishOver(st, ev)) return ev;
      fishRefill(st, o, ev);
      fishRefill(st, i, ev);
      if (st.hands[i].length) { st.phase = "ask"; return ev; }
      fishNext(st, ev);
      return ev;
    }
    // go fish
    if (st.pond.length) {
      const c = st.pond.pop();
      const pair = st.hands[i].indexOf(c) >= 0;
      st.hands[i].push(c);
      ev.push({ type: "fishGo", seat: i, card: c, pair });
      if (pair) {
        fishPair(st, i, c);
        if (fishOver(st, ev)) return ev;
      }
    } else ev.push({ type: "fishGo", seat: i, card: -1, pair: false });
    fishNext(st, ev);
    return ev;
  }
  // the cards the mover could ask for that the friend has
  function fishBest(st) { const o = other(st.turn); return st.hands[st.turn].map((x, k) => k).filter((k) => st.hands[o].indexOf(st.hands[st.turn][k]) >= 0); }
  // the computer sees a picture they both have only `FISH_SHARP` of the time
  const FISH_SHARP = 0.5;
  function fishChoice(st) {
    const s = st.seats[st.turn], best = fishBest(st);
    return best.length && next(s) < sharpOf(st, FISH_SHARP) ? best[0] : Math.floor(next(s) * st.hands[st.turn].length);
  }
  // the right answer to the question asked
  const fishAnswer = (st) => st.hands[other(st.turn)].indexOf(st.want);

  // ---- ⛄ Snowman Build --------------------------------------------------------------
  // Each snowman starts as its big ball (part 1) in the snow. A picture die:
  // ❄️ magic snow (any part: the next one that can go on), 2 the tummy, 3
  // the head, 4 the hat, 5 the carrot nose, 6 the scarf. A part goes on only
  // in order: the head needs the tummy, and the hat, nose and scarf the head.
  // Roll it: a part that can go on now is built with a tap on the snowman;
  // one it has, or not yet ("first the tummy!"), and the turn passes. Six
  // parts is a whole snowman: a ⭐, home, and its builder's rolls then help
  // build the friend's (the helper rule), so the game ends with two snowmen
  // and one party. (Building the big ball too was measured: a median game of
  // 100s and the longest 140; starting with it, 77 and 105.)
  const SNOW_MAGIC = 1;
  const SNOW_NEEDS = [0, 0, 1, 2, 3, 3, 3];   // part p needs part SNOW_NEEDS[p]
  const snowPart = (have, p) => have.indexOf(p) < 0 && have.indexOf(SNOW_NEEDS[p]) >= 0;
  // the part a roll puts on: the part itself, or for ❄️ the next that can go on
  const snowWhich = (have, die) => (die === SNOW_MAGIC ? [2, 3, 4, 5, 6].find((p) => snowPart(have, p)) || 0 : snowPart(have, die) ? die : 0);
  const snowCan = (have, die) => snowWhich(have, die) > 0;
  function rollSnow(st) {
    const i = st.turn, seat = st.seats[i];
    st.mover = moverFor(st, i);
    st.die = draw(seat, () => dieBag(seat, DATA.board(st.board)));
    st.rolls += 1;
    const have = st.parts[st.mover];
    const ev = [{ type: "roll", seat: i, die: st.die, mover: st.mover }];
    if (!snowCan(have, st.die)) {
      ev.push({ type: "snowNot", seat: i, mover: st.mover, part: st.die, need: have.indexOf(st.die) >= 0 ? 0 : SNOW_NEEDS[st.die] });
      st.die = 0;
      endTurn(st, ev);
      return ev;
    }
    st.phase = "build";
    return ev;
  }
  // The tap on the snowman: the part rolled goes on
  function buildSnow(st) {
    if (st.game !== "snow" || st.phase !== "build") return [];
    const m = st.mover, i = st.turn, p = snowWhich(st.parts[m], st.die), owner = st.seats[m];
    st.parts[m].push(p);
    owner.pos += 1;
    const ev = [{ type: "build", seat: i, mover: m, part: p, magic: st.die === SNOW_MAGIC }];
    st.die = 0;
    if (owner.pos === 6 && !owner.home) {
      owner.home = true; owner.stars += 1;
      st.order.push(m);
      ev.push({ type: "snowDone", seat: m });
    }
    endTurn(st, ev);
    return ev;
  }

  // ---- 🔢 Number Bingo --------------------------------------------------------------
  // Each player's own card: nine squares, three by three, holding the numbers
  // 1 to 6 (every number at least once, three of them twice). Roll the die:
  // the number on your card — tap it to cover it (twice on the card: either).
  // Not on your card: "not this time", and the turn passes. A row, a column
  // or a corner-to-corner line covered is a ⭐ for the card's owner. A full
  // card is home, and its owner's rolls then help cover the friend's card (the
  // helper rule), so the game ends when both cards are full, with one party.
  const BINGO_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  function bingoCard(s) {
    const extra = shuffle(s, [1, 2, 3, 4, 5, 6]).slice(0, 3);
    return shuffle(s, [1, 2, 3, 4, 5, 6].concat(extra));
  }
  const bingoLinesOf = (cov) => BINGO_LINES.filter((l) => l.every((k) => cov[k])).length;
  // the squares the mover may cover with the die
  function bingoSpots(st) { const m = st.mover; return st.cardsB[m].map((n, k) => k).filter((k) => st.cardsB[m][k] === st.die && !st.covered[m][k]); }
  function rollBingo(st) {
    const i = st.turn, seat = st.seats[i];
    st.mover = moverFor(st, i);
    st.die = draw(seat, () => dieBag(seat, DATA.board(st.board)));
    st.rolls += 1;
    st.misses = 0;
    const ev = [{ type: "roll", seat: i, die: st.die, mover: st.mover }];
    if (!bingoSpots(st).length) {
      ev.push({ type: "bingoNone", seat: i, mover: st.mover, die: st.die });
      st.die = 0;
      endTurn(st, ev);
      return ev;
    }
    st.phase = "cover";
    return ev;
  }
  // Tap square k of the mover's card: the die's number covers it; any other
  // square is a kind miss
  function coverBingo(st, k) {
    if (st.game !== "bingo" || st.phase !== "cover") return [];
    const m = st.mover, i = st.turn;
    if (bingoSpots(st).indexOf(k) < 0) {
      if (!int(k) || k < 0 || k > 8 || st.covered[m][k]) return [];
      st.misses += 1;
      return [{ type: "bingoMiss", seat: i, mover: m, k, misses: st.misses }];
    }
    const before = bingoLinesOf(st.covered[m]);
    st.covered[m][k] = true;
    const owner = st.seats[m];
    owner.pos += 1;
    const lines = BINGO_LINES.filter((l) => l.indexOf(k) >= 0 && l.every((j) => st.covered[m][j]));
    owner.stars += bingoLinesOf(st.covered[m]) - before;
    const ev = [{ type: "cover", seat: i, mover: m, k, n: st.die, lines }];
    st.die = 0; st.misses = 0;
    if (owner.pos === 9 && !owner.home) {
      owner.home = true;
      st.order.push(m);
      ev.push({ type: "bingoFull", seat: m });
    }
    endTurn(st, ev);
    return ev;
  }
  // The squares worth covering most: the ones that make (or come nearest to
  // making) a line
  function bingoBest(st) {
    const m = st.mover, cov = st.covered[m], spots = bingoSpots(st);
    const score = (k) => Math.max(...BINGO_LINES.filter((l) => l.indexOf(k) >= 0).map((l) => l.filter((j) => cov[j]).length));
    const best = Math.max(...spots.map(score));
    return spots.filter((k) => score(k) === best);
  }

  // ---- 🌈 Colour Match -------------------------------------------------------------
  // Forty cards: four colours (each with its shape) × the numbers 1 to 5,
  // twice. A card id k is the face k % 20: colour floor(face / 5), number
  // face % 5 + 1. A card is drawn as that many of its colour's shape.
  const cmFace = (id) => id % 20;
  const cmColour = (id) => Math.floor(cmFace(id) / 5);
  const cmNumber = (id) => (cmFace(id) % 5) + 1;
  const cmFits = (id, top) => cmColour(id) === cmColour(top) || cmNumber(id) === cmNumber(top);
  // a new round: the deck shuffled from the round-starter's luck, a hand of
  // `hand` each, one card turned up
  function cmDeal(st, s) {
    const board = DATA.board(st.board);
    const deck = shuffle(s, Array.from({ length: 40 }, (x, k) => k));
    st.hands = [deck.splice(0, board.hand), deck.splice(0, board.hand)];
    st.top = deck.pop();
    st.deck = deck;
    st.pile = [];
    st.misses = 0;
  }
  // the cards in the mover's hand that fit the card on top
  function cmPlayable(st) { return st.hands[st.turn].map((id, k) => k).filter((k) => cmFits(st.hands[st.turn][k], st.top)); }
  // Play card k of the mover's hand: it must match the colour OR the number.
  // A card that does not only wiggles (and after two, the ones that fit glow).
  function playMatch(st, k) {
    if (st.game !== "cmatch" || st.phase !== "play") return [];
    const board = DATA.board(st.board), i = st.turn, s = st.seats[i];
    const id = st.hands[i][k];
    if (id == null) return [];
    if (!cmFits(id, st.top)) { st.misses += 1; return [{ type: "cmMiss", seat: i, k, misses: st.misses }]; }
    st.hands[i].splice(k, 1);
    st.pile.push(st.top);
    st.top = id;
    st.misses = 0;
    st.rolls += 1;
    const ev = [{ type: "cmPlay", seat: i, card: id, left: st.hands[i].length }];
    if (!st.hands[i].length) {
      s.stars += 1; s.pos += 1; st.round += 1;
      ev.push({ type: "cmOut", seat: i, round: st.round });
      if (st.round >= board.rounds) {
        for (const x of st.seats) x.home = true;
        st.order = [0, 1];
        st.phase = "done";
        ev.push({ type: "end" });
        return ev;
      }
      cmDeal(st, s);
      ev.push({ type: "cmDeal", top: st.top });
    }
    endTurn(st, ev);
    return ev;
  }
  // Nothing fits: turn a new card over from the deck onto the pile, and the
  // turn passes. A hand never GROWS: drawing into the hand was built first and
  // measured — a drought could run a game to five minutes (the longest of
  // 3000 ran 302s); turning one over keeps every game under two (101s), and
  // who plays first still empties first only 53% of the time. (An empty
  // deck takes the pile back, shuffled.)
  function flipMatch(st) {
    if (st.game !== "cmatch" || st.phase !== "play" || cmPlayable(st).length) return [];
    const i = st.turn, s = st.seats[i];
    if (!st.deck.length) { st.deck = shuffle(s, st.pile); st.pile = []; }
    st.misses = 0;
    st.pile.push(st.top);
    st.top = st.deck.pop();
    st.rolls += 1;
    const ev = [{ type: "cmFlip", seat: i, card: st.top }];
    endTurn(st, ev);
    return ev;
  }
  // The computer plays a card that fits (any), else turns one over
  function cmChoice(st) {
    const ok = cmPlayable(st);
    return ok.length ? ok[Math.floor(next(st.seats[st.turn]) * ok.length)] : -1;
  }

  // ---- 🎯 Dice Match -----------------------------------------------------------------
  // A die's face, from the mover's own seeded luck. NOT a fair bag: a bag of
  // 1-6 deals three DIFFERENT faces every time, so three dice could never
  // match — the whole game. Three independent dice are the honest ones.
  const m3Die = (st) => 1 + Math.floor(next(st.seats[st.turn]) * 6);
  // How the three dice score: three the same 3, two the same 1, else 0
  function m3Score(dice) {
    const a = dice[0], b = dice[1], c = dice[2];
    return a === b && b === c ? 3 : a === b || b === c || a === c ? 1 : 0;
  }
  // The roll: the first of a turn rolls all three; after that, the dice not
  // kept. When the re-rolls are used up (or every die is kept) the turn
  // scores: two the same a ⭐, three the same three ⭐s.
  function rollMatch(st) {
    if (st.game !== "match3" || (st.phase !== "roll" && st.phase !== "keep")) return [];
    const board = DATA.board(st.board), i = st.turn, s = st.seats[i];
    const ev = [];
    if (st.phase === "roll") {
      st.dice = [m3Die(st), m3Die(st), m3Die(st)];
      st.held = [false, false, false];
      st.left = board.rerolls;
      st.rolls += 1;
      ev.push({ type: "roll3", seat: i, dice: st.dice.slice(), all: true });
      if (m3Score(st.dice) === 3) return scoreMatch(st, ev);
      st.phase = "keep";
      return ev;
    }
    if (st.held.every(Boolean)) return scoreMatch(st, ev);
    // clever: rolling again with the matching dice KEPT (and only those)
    const keep = m3Keep(st.dice), some = keep.some(Boolean);
    const sm = judged(i, "keep", keep.every((x, k) => x === st.held[k]), some);
    st.dice = st.dice.map((d, k) => (st.held[k] ? d : m3Die(st)));
    st.left -= 1;
    ev.push({ type: "roll3", seat: i, dice: st.dice.slice(), all: false });
    if (sm) ev.push(sm);
    if (st.left <= 0 || m3Score(st.dice) === 3) return scoreMatch(st, ev);
    return ev;
  }
  function scoreMatch(st, ev) {
    const board = DATA.board(st.board), i = st.turn, s = st.seats[i];
    const got = m3Score(st.dice);
    s.stars += got; s.pos += 1;
    ev.push({ type: "match", seat: i, stars: got, dice: st.dice.slice() });
    st.held = [false, false, false]; st.left = 0;
    if (st.seats.every((x) => x.pos >= board.rounds)) {
      for (const x of st.seats) x.home = true;
      st.order = [0, 1];
      st.phase = "done";
      ev.push({ type: "end" });
      return ev;
    }
    endTurn(st, ev);
    return ev;
  }
  // Keep (or let go of) die k, between rolls
  function holdDie(st, k) {
    if (st.game !== "match3" || st.phase !== "keep" || (k !== 0 && k !== 1 && k !== 2)) return [];
    st.held[k] = !st.held[k];
    return [{ type: "keepDie", seat: st.turn, k, held: st.held[k] }];
  }
  // The dice worth keeping: the ones that match another (or, with no match,
  // none — roll all three again)
  function m3Keep(dice) {
    return dice.map((d, k) => dice.some((e, j) => j !== k && e === d));
  }
  // The computer keeps the matching dice only `M3_SHARP` of the time (its own
  // seeded luck), else keeps any — so matching is his edge
  const M3_SHARP = 0.5;
  function m3Choice(st) {
    const s = st.seats[st.turn];
    if (next(s) < sharpOf(st, M3_SHARP)) return m3Keep(st.dice);
    return st.dice.map(() => next(s) < 0.5);
  }

  // ---- 🎨 Colour Grab --------------------------------------------------------------
  // The squares seat j's patch would grab by turning colour c: every square
  // nobody owns, of colour c, joined to the patch through squares of c
  function grabCells(board, paint, owner, j, c) {
    const C = board.cols, n = paint.length, got = [], seen = new Set();
    const near = (k) => { const out = [], x = k % C; if (x > 0) out.push(k - 1); if (x < C - 1) out.push(k + 1); if (k >= C) out.push(k - C); if (k + C < n) out.push(k + C); return out; };
    const stack = [];
    for (let k = 0; k < n; k++) if (owner[k] === j) for (const m of near(k)) if (owner[m] < 0 && paint[m] === c && !seen.has(m)) { seen.add(m); stack.push(m); }
    while (stack.length) {
      const k = stack.pop();
      got.push(k);
      for (const m of near(k)) if (owner[m] < 0 && paint[m] === c && !seen.has(m)) { seen.add(m); stack.push(m); }
    }
    return got;
  }
  // a seat's colour: the colour of its patch
  const grabColourOf = (st, j) => st.paint[st.owner.indexOf(j)];
  // The three colours the mover may pick: never its own, never its friend's
  function grabOptions(st) {
    const mine = grabColourOf(st, st.turn), theirs = grabColourOf(st, other(st.turn));
    return DATA.COLOURS.map((c) => c.id).filter((c) => c !== mine && c !== theirs);
  }
  // How many squares picking colour c grabs
  function grabGain(st, c) { return grabCells(DATA.board(st.board), st.paint, st.owner, st.turn, c).length; }
  // Pick colour c: the mover's patch turns c and swallows every touching
  // square of it. A grab of `big` or more is a ⭐. Every square owned: the
  // party. The turn always passes.
  function grabColour(st, c) {
    if (st.game !== "grab" || st.phase !== "pick") return [];
    if (grabOptions(st).indexOf(c) < 0) return [];
    const board = DATA.board(st.board), i = st.turn, s = st.seats[i];
    // clever: the colour that grabs the most
    const most = grabBest(st);
    const sm = judged(i, "most", most.indexOf(c) >= 0, most.length < grabOptions(st).length);
    const got = grabCells(board, st.paint, st.owner, i, c);
    for (let k = 0; k < st.paint.length; k++) if (st.owner[k] === i) st.paint[k] = c;
    for (const k of got) { st.owner[k] = i; st.paint[k] = c; }
    s.pos += got.length; st.rolls += 1;
    const ev = [{ type: "grab", seat: i, c, cells: got }];
    if (got.length >= board.big) { s.stars += 1; ev.push({ type: "bigGrab", seat: i, n: got.length }); }
    if (sm) ev.push(Object.assign(sm, { n: got.length }));
    if (st.owner.every((o) => o >= 0)) {
      for (const x of st.seats) x.home = true;
      st.order = [0, 1];
      st.phase = "done";
      ev.push({ type: "end" });
      return ev;
    }
    endTurn(st, ev);
    return ev;
  }
  // The colours that grab the most
  function grabBest(st) {
    const opts = grabOptions(st), g = opts.map((c) => grabGain(st, c)), top = Math.max(...g);
    return opts.filter((c, k) => g[k] === top);
  }
  // The computer picks the biggest grab only `GRAB_SHARP` of the time (its own
  // seeded luck), else any of the three — so looking is his edge
  const GRAB_SHARP = 0.5;
  function grabChoice(st) {
    const s = st.seats[st.turn], best = grabBest(st), from = next(s) < sharpOf(st, GRAB_SHARP) ? best : grabOptions(st);
    return from[Math.floor(next(s) * from.length)];
  }

  // ---- 🃏 Top Card ----------------------------------------------------------------
  // Play card v from the mover's hand: the lead, or the answer (then the
  // bigger card wins the trick and a ⭐, both refill to three, and the lead
  // goes to the other player — or, after the last trick, the party).
  function playCard(st, v) {
    if (st.game !== "top" || (st.phase !== "lead" && st.phase !== "follow")) return [];
    const board = DATA.board(st.board), i = st.turn, hand = st.hands[i];
    if (!int(v) || hand.indexOf(v) < 0) return [];
    // clever (the answer only): the smallest card that is bigger, or — when
    // none is — the smallest of all, saving the big ones
    let sm = null;
    if (st.phase === "follow") {
      const best = topBest(st);
      sm = judged(i, best > st.table[st.lead] ? "enough" : "save", v === best, hand.some((x) => x !== best), { v });
    }
    hand.splice(hand.indexOf(v), 1);
    st.table[i] = v; st.rolls += 1;
    if (st.phase === "lead") {
      st.phase = "follow";
      st.turn = st.mover = other(i);
      return [{ type: "lead", seat: i, v }, { type: "turn", seat: st.turn, mover: st.mover }];
    }
    const a = st.table[st.lead], b = st.table[other(st.lead)];
    const win = a === b ? -1 : a > b ? st.lead : other(st.lead);
    const ev = [{ type: "answer", seat: i, v }, { type: "trick", win, lead: st.lead, cards: st.table.slice() }];
    if (sm) ev.push(sm);
    if (win >= 0) { st.seats[win].stars += 1; st.seats[win].pos += 1; }
    for (const j of [0, 1]) {
      st.gone[j].push(st.table[j]);
      while (st.hands[j].length < board.hand && st.piles[j].length) st.hands[j].push(st.piles[j].shift());
    }
    st.table = [null, null];
    // (the lead goes on even after the last trick, so lead is always
    // first + tricks played — a rule restore can check in every state)
    st.lead = other(st.lead);
    if (!st.hands[0].length && !st.hands[1].length) {
      for (const x of st.seats) x.home = true;
      st.order = [0, 1];
      st.phase = "done";
      ev.push({ type: "end" });
      return ev;
    }
    st.phase = "lead";
    st.turn = st.mover = st.lead;
    ev.push({ type: "turn", seat: st.turn, mover: st.mover });
    return ev;
  }
  // The answer that wins the trick with the least: the smallest card that
  // beats the lead — or, when none does, the smallest card (save the big
  // ones). Leading: the smallest card too, so a big one is never wasted.
  function topBest(st) {
    const hand = st.hands[st.turn].slice().sort((x, y) => x - y);
    if (st.phase !== "follow") return hand[0];
    const lead = st.table[st.lead], beat = hand.filter((v) => v > lead);
    return beat.length ? beat[0] : hand[0];
  }
  // The computer plays the saving card only `TOP_SHARP` of the time (its own
  // seeded luck), else any card — so saving is his edge
  const TOP_SHARP = 0.5;
  function topChoice(st) {
    const s = st.seats[st.turn], hand = st.hands[st.turn];
    if (next(s) < sharpOf(st, TOP_SHARP)) return topBest(st);
    return hand[Math.floor(next(s) * hand.length)];
  }

  // ---- 🔴 Line Up -----------------------------------------------------------------
  // Every line of three on the board: across, up, and both slants. A cell is
  // row * cols + col, row 0 at the bottom.
  function linesOf(board) {
    const out = [], c = board.cols, r = board.rows;
    for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
      for (let row = 0; row < r; row++) {
        for (let col = 0; col < c; col++) {
          const cells = [0, 1, 2].map((k) => [col + k * dc, row + k * dr]);
          if (cells.every(([x, y]) => x >= 0 && x < c && y >= 0 && y < r)) out.push(cells.map(([x, y]) => y * c + x));
        }
      }
    }
    return out;
  }
  // The row a counter dropped into column `col` lands on (-1: the column is full)
  function dropRow(st, col) {
    const board = DATA.board(st.board);
    for (let row = 0; row < board.rows; row++) if (st.grid[row * board.cols + col] < 0) return row;
    return -1;
  }
  // the columns with room
  function linesOpen(st) {
    const board = DATA.board(st.board), out = [];
    for (let col = 0; col < board.cols; col++) if (dropRow(st, col) >= 0) out.push(col);
    return out;
  }
  // the lines seat `i` would make by dropping into `col`
  function linesMade(st, col, i) {
    const board = DATA.board(st.board), row = dropRow(st, col);
    if (row < 0) return [];
    const cell = row * board.cols + col;
    return linesOf(board).filter((ln) => ln.indexOf(cell) >= 0 && ln.every((k) => k === cell || st.grid[k] === i));
  }
  // Drop the mover's counter into `col`. Every new line of three is a ⭐. A
  // full board is set up fresh (or, after the last, the party). The turn
  // always passes.
  function dropLine(st, col) {
    if (st.game !== "lines" || st.phase !== "drop") return [];
    const board = DATA.board(st.board);
    if (!int(col) || col < 0 || col >= board.cols) return [];
    const row = dropRow(st, col);
    if (row < 0) return [];
    const i = st.turn, s = st.seats[i], cell = row * board.cols + col;
    const made = linesMade(st, col, i);
    // clever: with no line of your own to make, the column that stops the
    // friend's (making a line is its own ⭐ and needs no word)
    const open = linesOpen(st), mine = open.some((c) => linesMade(st, c, i).length);
    const stop = mine ? [] : open.filter((c) => linesMade(st, c, other(i)).length);
    const sm = judged(i, "block", stop.indexOf(col) >= 0, stop.length > 0 && stop.length < open.length);
    st.grid[cell] = i;
    s.pos += 1; st.rolls += 1;
    const ev = [{ type: "drop", seat: i, col, row, cell }];
    if (sm) ev.push(sm);
    for (const ln of made) { s.stars += 1; ev.push({ type: "line", seat: i, cells: ln }); }
    if (st.grid.every((g) => g >= 0)) {
      if (st.boardNo === board.boards - 1) {
        for (const x of st.seats) x.home = true;
        st.order = [0, 1];
        st.phase = "done";
        ev.push({ type: "end" });
        return ev;
      }
      st.boardNo += 1;
      st.grid = st.grid.map(() => -1);
      ev.push({ type: "fresh", boardNo: st.boardNo });
    }
    endTurn(st, ev);
    return ev;
  }
  // The column that makes a line (or, failing that, stops the friend's)
  function linesBest(st) {
    const open = linesOpen(st), i = st.turn;
    const win = open.filter((c) => linesMade(st, c, i).length);
    if (win.length) return win;
    return open.filter((c) => linesMade(st, c, other(i)).length);
  }
  // The computer sees a line (or a block) only `LINES_SHARP` of the time
  // (its own seeded luck), else drops anywhere — so looking is his edge
  const LINES_SHARP = 0.5;
  function linesChoice(st) {
    const s = st.seats[st.turn], best = linesBest(st);
    const from = best.length && next(s) < sharpOf(st, LINES_SHARP) ? best : linesOpen(st);
    return from[Math.floor(next(s) * from.length)];
  }

  // ---- 🁢 Dot Dominoes ------------------------------------------------------
  // A tile is "a-b" (a <= b); every pair of 1..max dots once
  function domSet(board) {
    const all = [];
    for (let a = 1; a <= board.max; a++) for (let b = a; b <= board.max; b++) all.push(a + "-" + b);
    return all;
  }
  const tileOf = (id) => String(id).split("-").map(Number);
  // the ends a tile can go on: "right" and/or "left"
  function domSides(st, id) {
    const t = tileOf(id), out = [];
    if (t[0] === st.ends[1] || t[1] === st.ends[1]) out.push("right");
    if (t[0] === st.ends[0] || t[1] === st.ends[0]) out.push("left");
    return out;
  }
  const domCanLay = (st, i) => st.hands[i].some((id) => domSides(st, id).length > 0);
  // a pile tile that would fit: fishing for it is worth it
  const domPileFits = (st) => st.pile.some((id) => domSides(st, id).length > 0);
  // a seat can MOVE: lay a tile, or fish one that fits from the pile
  const domCanMove = (st, i) => st.hands[i].length > 0 && (domCanLay(st, i) || domPileFits(st));
  // after a tile (or a pass): the line is finished when every tile is laid
  // or nobody can lay one with the pile empty; else the friend goes (or, out
  // of tiles, the one who still has some keeps going), laying or drawing
  function domNext(st, ev, from) {
    const done = () => {
      for (const s of st.seats) s.home = true;
      st.order = [0, 1];
      st.phase = "done";
      st.misses = 0;
      st.held = null;
      ev.push({ type: "end" });
    };
    if (!st.hands[0].length && !st.hands[1].length) return done();
    if (!domCanMove(st, 0) && !domCanMove(st, 1)) return done();
    let t = other(from);
    if (!st.hands[t].length) t = from;
    if (!domCanMove(st, t)) { ev.push({ type: "pass", seat: t }); t = other(t); }
    st.turn = st.mover = t;
    st.phase = domCanLay(st, t) ? "lay" : "draw";
    st.misses = 0;
    st.held = null;
    ev.push({ type: "turn", seat: t, mover: t });
  }
  // The open ends a tile would leave, laid on `side`
  function domEndsAfter(st, id, side) {
    const t = tileOf(id), e = st.ends.slice();
    if (side === "right") e[1] = t[0] === e[1] ? t[1] : t[0];
    else e[0] = t[1] === e[0] ? t[0] : t[1];
    return e;
  }
  // Does it matter which end? Only when the tile fits both and leaves
  // different dots open — then HE chooses (that is the skill)
  function domChoosy(st, id) {
    const sides = domSides(st, id);
    if (sides.length < 2) return false;
    const a = domEndsAfter(st, id, "right"), b = domEndsAfter(st, id, "left");
    return a[0] !== b[0] || a[1] !== b[1];
  }
  // Tap tile `id` in your hand: it goes on the end it matches; one that fits
  // either end (leaving different dots) is HELD until he taps an end
  // (`want`). A double is a ⭐, and so is laying your last tile. One that
  // matches no end is a kind miss.
  function layTile(st, id, want) {
    if (st.game !== "dominoes" || st.phase !== "lay") return [];
    const i = st.turn, hand = st.hands[i], k = hand.indexOf(id);
    if (k < 0) return [];
    const sides = domSides(st, id);
    if (!sides.length) { st.held = null; st.misses += 1; return [{ type: "miss", seat: i, id, misses: st.misses }]; }
    if (domChoosy(st, id) && sides.indexOf(want) < 0) {
      if (st.held === id) return [];   // already held (the hammer's echo)
      st.held = id;
      return [{ type: "hold", seat: i, id }];
    }
    st.held = null;
    const t = tileOf(id), side = sides.indexOf(want) >= 0 ? want : sides[0];
    let laid;
    if (side === "right") { laid = t[0] === st.ends[1] ? t : [t[1], t[0]]; st.line.push(laid); st.ends[1] = laid[1]; }
    else { laid = t[1] === st.ends[0] ? t : [t[1], t[0]]; st.line.unshift(laid); st.ends[0] = laid[0]; }
    hand.splice(k, 1);
    const s = st.seats[i];
    s.pos += 1;
    const double = t[0] === t[1];
    if (double) s.stars += 1;
    const out = !hand.length;
    if (out) s.stars += 1;
    st.rolls += 1;
    const ev = [{ type: "lay", seat: i, id, side, tile: laid, double, out, ends: st.ends.slice(), count: st.line.length }];
    domNext(st, ev, i);
    return ev;
  }
  // Nothing in his hand matches: FISH. Turn over the pile's top tile; one
  // that matches joins his hand (then he lays it), one that does not goes
  // back under the pile. He fishes only while some pile tile WILL match, so
  // fishing always ends — and his hand never grows past four.
  function drawTile(st) {
    if (st.game !== "dominoes" || st.phase !== "draw" || !st.pile.length) return [];
    const i = st.turn, id = st.pile.shift();
    st.held = null;
    const fits = domSides(st, id).length > 0;
    if (fits) { st.hands[i].push(id); st.phase = "lay"; }
    else st.pile.push(id);
    return [{ type: "take", seat: i, id, fits, left: st.pile.length }];
  }
  // The computer lays any tile that matches (a fair, seeded pick): which one
  // is his edge
  function domChoice(st) {
    const opts = [];
    for (const id of st.hands[st.turn]) for (const side of domSides(st, id)) opts.push([id, side]);
    return opts.length ? opts[Math.floor(next(st.seats[st.turn]) * opts.length)] : null;
  }

  // ---- 🌰 Acorn Pots ---------------------------------------------------------
  const RING = 8, NEST = 3;
  const nestOf = (i) => i * 4 + NEST;
  const potsOf = (st, i) => [0, 1, 2].map((k) => i * 4 + k);
  const sideEmpty = (st, i) => potsOf(st, i).every((k) => st.pots[k] === 0);
  // Tap pot `k` (a ring index): its acorns go one by one round the ring,
  // skipping the friend's nest. The last one in your own nest is a ⭐ and you
  // go again; once a side is empty, every acorn left goes to its own nest.
  function sowPot(st, k) {
    if (st.game !== "acorns" || st.phase !== "choose") return [];
    const i = st.turn, s = st.seats[i];
    if (!int(k) || potsOf(st, i).indexOf(k) < 0 || st.pots[k] === 0) return [];
    const n = st.pots[k];
    st.pots[k] = 0;
    const ev = [{ type: "scoop", seat: i, from: k, n }];
    let at = k;
    for (let c = 1; c <= n; c++) {
      at = (at + 1) % RING;
      if (at === nestOf(other(i))) at = (at + 1) % RING;
      st.pots[at] += 1;
      ev.push({ type: "sow", seat: i, to: at, c, left: n - c });
    }
    st.rolls += 1;
    for (const j of [0, 1]) st.seats[j].pos = st.pots[nestOf(j)];
    const again = at === nestOf(i);
    if (again) { s.stars += 1; ev.push({ type: "again", seat: i, n: st.pots[at] }); }
    else ev.push({ type: "landed", seat: i, at });
    if (sideEmpty(st, 0) || sideEmpty(st, 1)) {
      // a side is empty: the acorns still in pots go home to their own nests
      for (const j of [0, 1]) {
        const left = potsOf(st, j).reduce((t, p) => t + st.pots[p], 0);
        for (const p of potsOf(st, j)) st.pots[p] = 0;
        st.pots[nestOf(j)] += left;
        st.seats[j].pos = st.pots[nestOf(j)];
        if (left) ev.push({ type: "sweep", seat: j, n: left });
      }
      for (const j of [0, 1]) st.seats[j].home = true;
      st.order = [0, 1];
      st.phase = "done";
      ev.push({ type: "end" });
      return ev;
    }
    if (!again) endTurn(st, ev);
    return ev;
  }
  // The pots that put the last acorn in the mover's own nest
  function acornAgains(st) {
    const i = st.turn;
    return potsOf(st, i).filter((k) => st.pots[k] > 0 && st.pots[k] === nestOf(i) - k);
  }
  // The computer's pick: it SEES a go-again only `ACORN_SHARP` of the time
  // (its own seeded luck), else any pot with acorns in it — so counting is
  // his edge
  const ACORN_SHARP = 0.5;
  function acornChoice(st) {
    const s = st.seats[st.turn];
    const full = potsOf(st, st.turn).filter((k) => st.pots[k] > 0);
    if (!full.length) return -1;
    const again = acornAgains(st);
    if (again.length && next(s) < sharpOf(st, ACORN_SHARP)) return again[again.length - 1];
    return full[Math.floor(next(s) * full.length)];
  }

  // ---- 🚀 Moon Race: roll, then one hop per tap ----------------------------
  function roll(st) {
    if (st.game === "doors" && st.phase === "roll") return rollDoors(st);
    if (st.game === "bingo" && st.phase === "roll") return rollBingo(st);
    if (st.game === "snow" && st.phase === "roll") return rollSnow(st);
    if (st.game !== "dice" || st.phase !== "roll") return [];
    const seat = st.seats[st.turn];
    const board = DATA.board(st.board);
    const die = draw(seat, () => dieBag(seat, board));
    st.mover = moverFor(st, st.turn);
    st.rolls += 1;
    // 🎲 two dice: both from his own fair bag, and he picks one
    if (board.two) {
      st.dice = [die, draw(seat, () => dieBag(seat, board))];
      st.die = 0; st.left = 0;
      st.phase = "choose";
      return [{ type: "roll", seat: st.turn, mover: st.mover, die: 0, dice: st.dice.slice() }];
    }
    // a ten-bar is ONE tap: ten more, straight down a row
    st.die = die; st.left = tapsOf(die);
    st.phase = "hop";
    return [{ type: "roll", seat: st.turn, mover: st.mover, die }];
  }

  // 🎲 Pick one of the two dice: it is the roll, hopped one tap a hop
  function chooseDie(st, k) {
    if (st.game !== "dice" || st.phase !== "choose" || (k !== 0 && k !== 1)) return [];
    const die = st.dice[k];
    // clever: the die that lands on a rocket, when only one of them does
    const board = DATA.board(st.board);
    const rocket = [0, 1].filter((j) => { const jp = jumpAt(board, dieTarget(st, j)); return jp && jp.kind === "boost"; });
    const sm = judged(st.turn, "rocket", rocket.indexOf(k) >= 0, rocket.length === 1 && st.dice[0] !== st.dice[1]);
    st.die = die; st.left = tapsOf(die); st.dice = [];
    st.phase = "hop";
    const ev = [{ type: "choose", seat: st.turn, mover: st.mover, k, die }];
    if (sm) ev.push(sm);
    return ev;
  }
  // Where die k would take the mover (overshoot is the Moon)
  function dieTarget(st, k) {
    const board = DATA.board(st.board);
    return Math.min(board.size, st.seats[st.mover].pos + st.dice[k]);
  }
  // The dice that land on a rocket — or, failing that, the bigger one (the
  // nearer the Moon). Two the same are one choice.
  function dieBest(st) {
    const board = DATA.board(st.board), ks = [0, 1];
    const rocket = ks.filter((k) => { const j = jumpAt(board, dieTarget(st, k)); return j && j.kind === "boost"; });
    if (rocket.length) return rocket;
    const top = Math.max(st.dice[0], st.dice[1]);
    return ks.filter((k) => st.dice[k] === top);
  }
  // The computer sees the rocket only `DIE_SHARP` of the time (its own seeded
  // luck), else picks either — so looking ahead is his edge
  const DIE_SHARP = 0.5;
  function dieChoice(st) {
    const s = st.seats[st.turn], best = dieBest(st);
    const from = next(s) < sharpOf(st, DIE_SHARP) ? best : [0, 1];
    return from[Math.floor(next(s) * from.length)];
  }

  // How many taps a face is: one per hop, and one for a ten-bar
  const TEN = 10;
  const tapsOf = (die) => (die === TEN ? 1 : die);
  function hop(st) {
    if (st.game === "hen") return henHop(st);    // one chick per tap
    if (st.game !== "dice" || st.phase !== "hop" || st.left <= 0) return [];
    const board = DATA.board(st.board);
    const i = st.mover, s = st.seats[i];
    const ev = [];
    const ten = st.die === TEN;
    s.pos = Math.min(board.size, s.pos + (ten ? TEN : 1));
    st.left -= 1;
    ev.push(ten ? { type: "hop", seat: i, to: s.pos, left: st.left, ten: true } : { type: "hop", seat: i, to: s.pos, left: st.left });
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
    // 💯 a turn that ENDS on a tens square (10, 20, … 90) earns a ⭐: he
    // counts by tens. Never the hundred itself, which is home.
    if (board.tens && s.pos % TEN === 0 && s.pos < board.size) {
      s.stars += 1;
      ev.push({ type: "tens", seat: i, at: s.pos });
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
    st.rolls += 1;
    // a picture card AHEAD of you is a ZOOM: one swoop to its landmark, and —
    // like every booster ride — a ⭐ for the ride. A picture card BEHIND you
    // sends you BACK to it, as in Candy Land (the owner's call, 2026-11: "too
    // forgiving"). Only while slides are on, exactly as the comets are: never
    // once anyone is home (the helper rule — nobody loses) and never after
    // BACK_CAP cards, so every game still ends in minutes. Outside that, and
    // on the picture's own square, it is a plain move to the next square of
    // the landmark's colour.
    const zoom = card.kind === "pic" && card.at > from;
    const back = card.kind === "pic" && card.at < from && !anyHome(st) && st.rolls <= BACK_CAP;
    if (zoom || back) to = card.at;
    else if (card.kind === "pic") to = nextOf(board, from, colourAt(board, card.at));
    else if (card.kind === "two") to = nextOf(board, nextOf(board, from, card.c), card.c);
    else to = nextOf(board, from, card.c);
    to = Math.min(board.size, to);
    // Only a picture card behind you goes backwards (a guardrail plays every
    // card from every square to prove it).
    if (to < from && !back) to = from;
    s.pos = to;
    if (zoom) s.stars += 1;
    st.card = card;
    const path = [];
    if (back) for (let n = from - 1; n >= to; n--) path.push(n);
    else for (let n = from + 1; n <= to; n++) path.push(n);
    const ev = [{ type: "card", seat: st.turn, mover: i, card, from, to, path, zoom, back }];
    if (to >= board.size) arrive(st, i, ev);
    endTurn(st, ev);
    return ev;
  }

  // ---- 🍎 Apple Spin: spin, then one apple per tap ---------------------------
  // The 🐦 is gentle: never from an empty basket, never on a player's two
  // spins running, never once anyone's basket is full, never in a long game.
  function birdOK(st, seat) {
    return st.birds && !anyHome(st) && st.rolls <= COMET_CAP && !seat.bird && st.seats[st.mover].pos > 0;
  }
  function spin(st) {
    if (st.game === "hen") return spinHen(st);   // the farm's spinner
    if (st.game !== "spin" || st.phase !== "spin") return [];
    const board = DATA.board(st.board);
    const seat = st.seats[st.turn];
    st.mover = moverFor(st, st.turn);
    st.rolls += 1;
    const make = () => spinBag(seat, board, st.birds);
    let face = draw(seat, make), guard = 0;
    // a 🐦 that may not come now goes to the BACK of the bag, never away:
    // the bag stays fair, it only waits
    // (a bird that was the LAST in its bag needs no carrying: the fresh bag
    // has its own, and carrying it too would put two in one bag)
    while (face === 0 && !birdOK(st, seat) && guard++ < 20) {
      if (!seat.bag.length) seat.bag = make();
      else seat.bag.push(0);
      face = draw(seat, make);
    }
    const ev = [{ type: "spin", seat: st.turn, mover: st.mover, face }];
    seat.bird = face === 0;
    st.die = face;
    if (face === 0) {
      const s = st.seats[st.mover];
      s.pos -= 1;
      ev.push({ type: "bird", seat: st.mover, to: s.pos });
      endTurn(st, ev);
      return ev;
    }
    st.left = face;
    st.phase = "pick";
    return ev;
  }
  function pick(st) {
    if (st.game !== "spin" || st.phase !== "pick" || st.left <= 0) return [];
    const board = DATA.board(st.board);
    const i = st.mover, s = st.seats[i];
    const ev = [];
    s.pos += 1;
    st.left -= 1;
    ev.push({ type: "pick", seat: i, to: s.pos, left: st.left });
    if (s.pos >= board.size) {
      arrive(st, i, ev);
      // the apples still to pick go into the shared pie — a full basket is
      // never a wasted spin
      if (st.left > 0) {
        st.pie += st.left;
        ev.push({ type: "pie", seat: i, n: st.left, pie: st.pie });
      }
      endTurn(st, ev);
      return ev;
    }
    if (st.left === 0) endTurn(st, ev);
    return ev;
  }

  // ---- 🐔 Hen House: spin an animal, walk to it, one chick per tap -----------
  // The 🦊 is gentle, with the bird's rules: never when no chick is home yet,
  // never on a player's two spins running, never in the last row, never in a
  // long game. A fox that may not come waits at the back of the bag.
  function foxOK(st, seat) {
    const board = DATA.board(st.board);
    return st.fox && st.coop > 0 && !seat.fox && st.rolls <= COMET_CAP && st.seats[0].pos <= board.size - board.cols;
  }
  function spinHen(st) {
    if (st.game !== "hen" || st.phase !== "spin") return [];
    const board = DATA.board(st.board);
    const seat = st.seats[st.turn];
    st.rolls += 1;
    st.mover = st.turn;
    const make = () => henBag(seat, st.fox);
    let face = draw(seat, make), guard = 0;
    while (face === FOX && !foxOK(st, seat) && guard++ < 20) {
      if (!seat.bag.length) seat.bag = make();
      else seat.bag.push(FOX);
      face = draw(seat, make);
    }
    seat.fox = face === FOX;
    st.card = face;
    if (face === FOX) {
      st.coop -= 1;
      st.out += 1;
      const ev = [{ type: "spin", seat: st.turn, face }, { type: "fox", seat: st.turn, coop: st.coop, out: st.out }];
      endTurn(st, ev);
      return ev;
    }
    const from = st.seats[0].pos, to = nextAnimal(board, from, face);
    st.die = to - from;
    st.left = st.die;
    st.phase = "hop";
    return [{ type: "spin", seat: st.turn, face, from, to }];
  }
  function henHop(st) {
    if (st.game !== "hen" || st.phase !== "hop" || st.left <= 0) return [];
    const board = DATA.board(st.board);
    for (const s of st.seats) s.pos += 1;
    st.left -= 1;
    st.coop += 1;
    const pos = st.seats[0].pos;
    const ev = [{ type: "hop", seat: st.turn, to: pos, left: st.left, coop: st.coop }];
    if (pos >= board.size) {
      // the hen is home: every chick out playing comes home too, and the
      // game ends with ONE party for both — the count is always size - 1
      const came = st.out;
      st.coop += st.out;
      st.out = 0;
      for (const s of st.seats) s.home = true;
      st.order = [0, 1];
      ev.push({ type: "henhome", came, coop: st.coop });
      endTurn(st, ev);
      return ev;
    }
    if (st.left === 0) endTurn(st, ev);
    return ev;
  }

  // ---- 🧺 Picnic Lotto: take a food from the basket, then give it --------------
  // Whose blanket has this food (0 or 1)
  function ownerOf(st, food) { return st.blankets[0].indexOf(food) >= 0 ? 0 : st.blankets[1].indexOf(food) >= 0 ? 1 : -1; }
  function takeFood(st) {
    if (st.game !== "lotto" || st.phase !== "draw" || !st.basket.length) return [];
    st.rolls += 1;
    st.food = st.basket.shift();
    st.misses = 0;
    st.phase = "give";
    return [{ type: "draw", seat: st.turn, food: st.food, owner: ownerOf(st, st.food) }];
  }
  // Give the food in hand to seat `to`. The wrong friend only wiggles (the food
  // stays in hand, and the count of misses lets the screen help after two);
  // the right one puts it on its spot. When both blankets are full, the game
  // is over: one picnic.
  function giveFood(st, to) {
    if (st.game !== "lotto" || st.phase !== "give" || (to !== 0 && to !== 1)) return [];
    const owner = ownerOf(st, st.food);
    if (to !== owner) { st.misses += 1; return [{ type: "miss", seat: st.turn, to, misses: st.misses, owner }]; }
    const food = st.food, s = st.seats[owner];
    st.placed[owner].push(food);
    s.pos = st.placed[owner].length;
    st.food = null;
    st.misses = 0;
    const ev = [{ type: "give", seat: st.turn, owner, food, slot: st.blankets[owner].indexOf(food), count: s.pos }];
    const board = DATA.board(st.board);
    if (s.pos >= board.spots && !s.home) { s.home = true; st.order.push(owner); ev.push({ type: "full", seat: owner }); }
    endTurn(st, ev);
    return ev;
  }

  // ---- 👀 Twin Spot: flip a card, find the ONE picture on both --------------
  // The one picture two cards share (any two share exactly one)
  function twinOf(board, a, b) {
    const A = board.deck[a], B = board.deck[b];
    return A.find((p) => B.indexOf(p) >= 0);
  }
  function flipSpot(st) {
    if (st.game !== "spot" || st.phase !== "flip" || !st.deck.length) return [];
    st.rolls += 1;
    st.hand = st.deck.shift();
    st.misses = 0;
    st.phase = "find";
    return [{ type: "flip", seat: st.turn, card: st.hand, twin: twinOf(DATA.board(st.board), st.centre, st.hand) }];
  }
  // Pick picture `p` on the flipped card: not the twin is a kind wiggle (and a
  // count of misses, so the screen can help after two); the twin puts the card
  // on your pile and in the middle. The last card ends the game: one party.
  function findSpot(st, p) {
    if (st.game !== "spot" || st.phase !== "find") return [];
    const board = DATA.board(st.board), twin = twinOf(board, st.centre, st.hand);
    if (p !== twin) { st.misses += 1; return [{ type: "miss", seat: st.turn, pick: p, misses: st.misses }]; }
    const s = st.seats[st.turn];
    s.pos += 1;
    s.stars += 1;
    const ev = [{ type: "found", seat: st.turn, twin, card: st.hand, count: s.pos }];
    st.centre = st.hand;
    st.hand = null;
    st.misses = 0;
    if (!st.deck.length) {
      for (const x of st.seats) x.home = true;
      st.order = [0, 1];
    }
    endTurn(st, ev);
    return ev;
  }

  // ---- 🧠 Peek-a-Pair: flip two; a pair is yours and you go again ----------
  // A board: its four pictures twice and one ⭐, shuffled; nothing gone,
  // nothing open, nothing seen yet (`seen` is what the computer may remember)
  const STAR = "star";
  function dealPairs(st, board) {
    const ids = st.pics.slice(st.boardNo * board.pairsPer, (st.boardNo + 1) * board.pairsPer);
    st.cards = shuffle(st.seats[0], ids.concat(ids, [STAR]));
    st.gone = st.cards.map(() => false);
    st.seen = st.cards.map(() => false);
    st.open = [];
  }
  // Flip card `k` (face down, not already up). The first card of a turn
  // stays up; the second is a pair (both yours, go again) or not (both turn
  // back over, and it is your friend's turn). The ⭐ is a free star and the
  // turn goes on, whichever card it was. The last card of a board deals the
  // next; the last card of the last board ends the game: one party.
  function peekPair(st, k) {
    if (st.game !== "pairs" || (st.phase !== "flip" && st.phase !== "second")) return [];
    if (!int(k) || k < 0 || k >= st.cards.length || st.gone[k] || st.open.indexOf(k) >= 0) return [];
    const board = DATA.board(st.board), s = st.seats[st.turn], pic = st.cards[k];
    // clever (the second card): its partner had been SEEN, and he went to it
    let sm = null;
    if (st.phase === "second") {
      const a0 = st.open[0];
      const mate = st.cards.findIndex((c, j) => j !== a0 && !st.gone[j] && c === st.cards[a0] && st.seen[j]);
      sm = judged(st.turn, "recall", k === mate, mate >= 0);
    }
    st.rolls += 1;
    st.seen[k] = true;
    const ev = [{ type: "peek", seat: st.turn, k, pic }];
    if (pic === STAR) {
      st.gone[k] = true;
      s.stars += 1;
      ev.push({ type: "star", seat: st.turn, k });
    } else if (st.phase === "flip") {
      st.open = [k];
      st.phase = "second";
      return ev;
    } else {
      const a = st.open[0];
      st.open = [];
      st.phase = "flip";
      if (st.cards[a] !== pic) {
        ev.push({ type: "nopair", seat: st.turn, a, b: k });
        if (sm) ev.push(sm);
        endTurn(st, ev);
        return ev;
      }
      st.gone[a] = st.gone[k] = true;
      s.pos += 1;
      s.stars += 1;
      ev.push({ type: "pair", seat: st.turn, a, b: k, pic, count: s.pos });
      if (sm) ev.push(sm);
    }
    if (st.gone.every(Boolean)) {
      if (st.boardNo + 1 < board.boards) {
        st.boardNo += 1;
        dealPairs(st, board);
        ev.push({ type: "deal", seat: st.turn, board: st.boardNo });
      } else {
        for (const x of st.seats) x.home = true;
        st.order = [0, 1];
        endTurn(st, ev);
      }
    }
    return ev;
  }
  // Which card the computer turns: it REMEMBERS a card it has seen only
  // `PAIR_RECALL` of the time (its own seeded luck), so a sharp four-year-old
  // can beat it — and it always prefers a card nobody has looked at yet.
  const PAIR_RECALL = 0.6;
  function pairChoice(st) {
    const s = st.seats[st.turn];
    const down = st.cards.map((c, k) => k).filter((k) => !st.gone[k] && st.open.indexOf(k) < 0);
    if (!down.length) return -1;
    const known = (k) => st.seen[k] && next(s) < sharpOf(st, PAIR_RECALL);
    if (st.phase === "second") {
      const want = st.cards[st.open[0]];
      const mate = down.find((k) => st.cards[k] === want && st.seen[k]);
      if (mate != null && known(mate)) return mate;
    } else {
      for (const k of down) {
        const c = st.cards[k];
        if (c === STAR || !st.seen[k]) continue;
        const mate = down.find((j) => j !== k && st.cards[j] === c && st.seen[j]);
        if (mate != null && known(k)) return k;
      }
    }
    const fresh = down.filter((k) => !st.seen[k]);
    const from = fresh.length ? fresh : down;
    return from[Math.floor(next(s) * from.length)];
  }

  // One whole turn for the computer (and the tests' bot)
  function autoTurn(st) {
    if (st.phase === "done") return [];
    if (st.game === "cards") return drawCard(st);
    if (st.game === "doors") {
      const ev = [];
      let g = 0;
      while (st.phase === "roll" && g++ < 20) ev.push(...roll(st));
      if (st.phase === "shut") for (const n of doorChoice(st)) ev.push(...shutDoor(st, n));
      return ev;
    }
    if (st.game === "dig") return digAt(st, digChoice(st));
    if (st.game === "nim") return takeCookies(st, nimChoice(st));
    if (st.game === "lines") return dropLine(st, linesChoice(st));
    if (st.game === "top") return playCard(st, topChoice(st));
    if (st.game === "grab") return grabColour(st, grabChoice(st));
    if (st.game === "maze") return moveMouse(st, mazeChoice(st));
    if (st.game === "hide") return askHide(st, hideChoice(st));
    if (st.game === "cmatch") { const k = cmChoice(st); return k < 0 ? flipMatch(st) : playMatch(st, k); }
    if (st.game === "hilo") return hiloGuess(st, hiloChoice(st));
    if (st.game === "train") return pickCar(st, trainChoice(st));
    if (st.game === "ten") { const c = tenChoice(st); const ev = tenPick(st, c[0]); ev.push(...tenPick(st, c[1])); return ev; }
    if (st.game === "fish") { const ev = st.phase === "ask" ? askFish(st, fishChoice(st)) : []; if (st.phase === "answer") ev.push(...answerFish(st, fishAnswer(st))); return ev; }
    if (st.game === "snow") { const ev = roll(st); if (st.phase === "build") ev.push(...buildSnow(st)); return ev; }
    if (st.game === "bingo") {
      const ev = roll(st);
      if (st.phase === "cover") { const b = bingoBest(st); ev.push(...coverBingo(st, b[Math.floor(next(st.seats[st.turn]) * b.length)])); }
      return ev;
    }
    if (st.game === "match3") {
      const ev = rollMatch(st), who = st.turn;
      let guard = 0;
      while (st.phase === "keep" && st.turn === who && guard++ < 10) {
        const want = m3Choice(st);
        for (let k = 0; k < 3; k++) if (st.held[k] !== want[k]) ev.push(...holdDie(st, k));
        ev.push(...rollMatch(st));
      }
      return ev;
    }
    if (st.game === "dominoes") {
      const ev = [], who = st.turn;
      let guard = 0;
      while (st.phase === "draw" && st.turn === who && guard++ < 20) ev.push(...drawTile(st));
      if (st.phase === "lay" && st.turn === who) { const c = domChoice(st); ev.push(...layTile(st, c[0], c[1])); }
      return ev;
    }
    if (st.game === "acorns") {
      // the whole turn: pot after pot while the last acorn lands in the nest
      const ev = [], who = st.turn;
      let guard = 0;
      while (st.phase === "choose" && st.turn === who && guard++ < 30) ev.push(...sowPot(st, acornChoice(st)));
      return ev;
    }
    if (st.game === "pairs") {
      // the whole turn: card after card until the turn passes (a pair, or the
      // star, goes again) or the game is over
      const ev = [], who = st.turn;
      let guard = 0;
      while (st.phase !== "done" && st.turn === who && guard++ < 60) {
        const more = peekPair(st, pairChoice(st));
        if (!more.length) break;
        ev.push(...more);
        if (more.some((e) => e.type === "turn")) break;
      }
      return ev;
    }
    if (st.game === "spot") {
      const ev = flipSpot(st);
      if (st.phase === "find") ev.push(...findSpot(st, twinOf(DATA.board(st.board), st.centre, st.hand)));
      return ev;
    }
    if (st.game === "lotto") {
      // the computer (and the bot) always knows whose it is: a worked example
      const ev = takeFood(st);
      if (st.phase === "give") ev.push(...giveFood(st, ownerOf(st, st.food)));
      return ev;
    }
    let guard = 0;
    if (st.game === "hen") {
      const ev = spinHen(st);
      while (st.phase === "hop" && guard++ < 40) ev.push(...henHop(st));
      return ev;
    }
    if (st.game === "spin") {
      const ev = spin(st);
      while (st.phase === "pick" && guard++ < 20) ev.push(...pick(st));
      return ev;
    }
    const ev = roll(st);
    if (st.phase === "choose") ev.push(...chooseDie(st, dieChoice(st)));
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
  function okBag(board, bag, birds) {
    if (board.game === "lotto" || board.game === "spot" || board.game === "pairs" || board.game === "acorns" || board.game === "dominoes" || board.game === "dig" || board.game === "nim" || board.game === "lines" || board.game === "top" || board.game === "grab") return bag.length === 0;
    if (board.game === "match3" || board.game === "hide" || board.game === "cmatch" || board.game === "fish" || board.game === "ten" || board.game === "hilo" || board.game === "train") return bag.length === 0;
    if (board.game === "snow") { const left = [1, 2, 3, 4, 5, 6]; for (const n of bag) { const k = left.indexOf(n); if (!int(n) || k < 0) return false; left.splice(k, 1); } return true; }
    if (board.game === "bingo") { const left = [1, 2, 3, 4, 5, 6]; for (const n of bag) { const k = left.indexOf(n); if (!int(n) || k < 0) return false; left.splice(k, 1); } return true; }
    if (board.game === "maze") return bag.length <= 8 && new Set(bag).size === bag.length && bag.every((n) => int(n) && n >= 0 && n <= 7);
    if (board.game === "doors") {
      const left = [1, 2, 3, 4, 5, 6];
      for (const n of bag) { const k = left.indexOf(n); if (!int(n) || k < 0) return false; left.splice(k, 1); }
      return true;
    }   // the basket / deck is shared, not a seat's
    if (board.game === "hen") {
      // what is left of ONE bag: each animal at most once, a 🦊 only when the
      // fox is on (here `birds` carries the fox flag)
      const faces = DATA.ANIMALS.map((a) => a.id).concat(birds ? [FOX] : []);
      return bag.every((f) => faces.indexOf(f) >= 0) && new Set(bag).size === bag.length;
    }
    if (board.game === "dice") {
      // what is left of ONE bag of this board's faces: no face more often
      // than the die has it
      const left = facesOf(board).slice();
      for (const n of bag) { const k = left.indexOf(n); if (!int(n) || k < 0) return false; left.splice(k, 1); }
      return true;
    }
    if (board.game === "spin") {
      // faces the spinner has, at most one bag's worth, and a 🐦 (face 0)
      // only when birds are on — at most one. A bag of birds with birds off
      // would hand out a bird the rules refuse.
      const faces = board.spinner.concat([0]);
      const birdsIn = bag.filter((n) => n === 0).length;
      return bag.length <= board.spinner.length + 1 && birdsIn <= (birds ? 1 : 0) && bag.every((n) => int(n) && faces.indexOf(n) >= 0);
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
      const spinning = board.game === "spin";
      const hen = board.game === "hen";
      const lotto = board.game === "lotto", spotting = board.game === "spot", pairing = board.game === "pairs", acorning = board.game === "acorns", domino = board.game === "dominoes", digging = board.game === "dig", nimming = board.game === "nim", lining = board.game === "lines", topping = board.game === "top", grabbing = board.game === "grab", matching3 = board.game === "match3", mazing = board.game === "maze", hiding = board.game === "hide", cmatching = board.game === "cmatch", bingoing = board.game === "bingo", snowing = board.game === "snow", fishing = board.game === "fish", tenning = board.game === "ten", hiloing = board.game === "hilo", training = board.game === "train";
      const okPhase = board.game === "cards" ? ["draw", "done"] : matching3 ? ["roll", "keep", "done"] : mazing ? ["move", "done"] : hiding ? ["ask", "done"] : cmatching ? ["play", "done"] : bingoing ? ["roll", "cover", "done"] : snowing ? ["roll", "build", "done"] : fishing ? ["ask", "answer", "done"] : tenning ? ["pick", "done"] : hiloing ? ["guess", "done"] : training ? ["pick", "done"] : grabbing ? ["pick", "done"] : nimming ? ["take", "done"] : lining ? ["drop", "done"] : topping ? ["lead", "follow", "done"] : pairing ? ["flip", "second", "done"] : acorning ? ["choose", "done"] : domino ? ["lay", "draw", "done"] : digging ? ["dig", "done"] : lotto ? ["draw", "give", "done"] : board.game === "doors" ? ["roll", "shut", "done"] : spotting ? ["flip", "find", "done"] : spinning ? ["spin", "pick", "done"] : hen ? ["spin", "hop", "done"] : board.two ? ["roll", "choose", "hop", "done"] : ["roll", "hop", "done"];
      if (okPhase.indexOf(snap.phase) < 0) return null;
      const moving = spinning ? "pick" : "hop";
      if (spinning) {
        if (!int(snap.pie) || snap.pie < 0 || typeof snap.birds !== "boolean") return null;
        if (!int(snap.die) || snap.die < 0 || snap.die > Math.max(...board.spinner)) return null;
      }
      if (!int(snap.turn) || snap.turn < 0 || snap.turn > 1) return null;
      if (!int(snap.mover) || snap.mover < 0 || snap.mover > 1) return null;
      if (!int(snap.left) || snap.left < 0 || snap.left > 6) return null;
      if (!int(snap.die) || snap.die < 0) return null;
      if (board.game === "dice" || board.game === "doors" || bingoing || snowing ? snap.die !== 0 && facesOf(board).indexOf(snap.die) < 0 : snap.die > 6) return null;
      // hops (or apples) are left exactly while hopping (picking): a "hop"
      // turn with none left would be stuck for good (hop() refuses, nothing
      // ends the turn)
      if (!matching3 && (snap.phase === moving) !== (snap.left > 0)) return null;
      // 🎲 two dice wait exactly while he picks one, both faces of his die
      if (board.two) {
        if (!Array.isArray(snap.dice) || snap.dice.length !== (snap.phase === "choose" ? 2 : 0)) return null;
        if (snap.dice.some((d) => facesOf(board).indexOf(d) < 0)) return null;
        if (snap.phase === "choose" && snap.die !== 0) return null;
      } else if (snap.dice !== undefined && !matching3) return null;
      if (snap.phase === moving && snap.left > (spinning ? snap.die : tapsOf(snap.die))) return null;
      if (!int(snap.rolls) || snap.rolls < 0) return null;
      if (hen) {
        // one hen: both seats stand where she stands, and every square she
        // has walked brought one chick home (or out to play with the fox)
        if (typeof snap.fox !== "boolean" || !int(snap.coop) || !int(snap.out) || snap.coop < 0 || snap.out < 0) return null;
        if (snap.seats[0].pos !== snap.seats[1].pos || snap.coop + snap.out !== snap.seats[0].pos - 1) return null;
        if (snap.out > 0 && !snap.fox) return null;
        if (snap.card !== null && !DATA.animal(snap.card) && !(snap.card === FOX && snap.fox)) return null;
        if (snap.seats.some((s) => typeof s.fox !== "boolean")) return null;
      } else if (board.game === "doors") {
        // each player's shut doors are real doors, each once; a held door is
        // open, smaller than the roll, with its partner open too; and a shut
        // turn always has a way to make the roll (else it would be stuck)
        for (const s of snap.seats) {
          if (!Array.isArray(s.shut) || s.shut.some((n) => !int(n) || n < 1 || n > 6) || new Set(s.shut).size !== s.shut.length || s.pos !== s.shut.length) return null;
        }
        if (!int(snap.misses) || snap.misses < 0 || (snap.phase !== "shut" && snap.misses !== 0)) return null;
        if (snap.card !== null) return null;
        if (snap.phase === "shut") {
          if (!int(snap.die) || snap.die < 1) return null;
          if (!doorWays(snap).length) return null;
          const sh = snap.seats[snap.mover].shut;
          if (snap.held !== null && (!int(snap.held) || snap.held >= snap.die || snap.held * 2 === snap.die || sh.indexOf(snap.held) >= 0 || sh.indexOf(snap.die - snap.held) >= 0)) return null;
        } else if (snap.held !== null) return null;
      } else if (digging) {
        // nine squares, the treasure under one not yet dug; the treasures
        // found are the players' piles and their ⭐s; over after the last
        const D = snap.dug, n = board.cols * board.rows;
        if (!Array.isArray(D) || D.length !== n || D.some((d) => typeof d !== "boolean")) return null;
        if (!int(snap.spot) || snap.spot < 0 || snap.spot >= n) return null;
        if (!int(snap.found) || snap.found < 0 || snap.found > board.treasures) return null;
        if (snap.seats[0].pos + snap.seats[1].pos !== snap.found) return null;
        if (snap.seats.some((s) => s.stars !== s.pos)) return null;
        if ((snap.phase === "done") !== (snap.found === board.treasures)) return null;
        if (snap.phase === "dig" && (D[snap.spot] || D.every(Boolean))) return null;
        if (snap.die !== 0 || snap.left !== 0 || snap.card !== null) return null;
      } else if (mazing) {
        // the pots (distinct, never walling a square in), the mouse on a free
        // square, the cheese on another free square (none once done), three
        // arrows a hand, and the cheeses found are the ⭐s
        const n = board.cols * board.rows, sq = (k) => int(k) && k >= 0 && k < n;
        if (!Array.isArray(snap.pots) || snap.pots.length !== board.pots || !snap.pots.every(sq) || new Set(snap.pots).size !== board.pots) return null;
        if (!Array.isArray(snap.mice) || snap.mice.length !== 2 || snap.mice.some((m) => !sq(m) || snap.pots.indexOf(m) >= 0)) return null;
        if (snap.phase === "done" ? snap.cheese !== -1 : !sq(snap.cheese) || snap.mice.indexOf(snap.cheese) >= 0 || snap.pots.indexOf(snap.cheese) >= 0) return null;
        if (!Array.isArray(snap.hands) || snap.hands.length !== 2 || snap.hands.some((h) => !Array.isArray(h) || h.length !== board.hand || !h.every((id) => int(id) && id >= 0 && id <= 7))) return null;
        if (!int(snap.found) || snap.found !== snap.seats[0].stars + snap.seats[1].stars || snap.found > board.cheese) return null;
        if (snap.seats.some((x) => x.pos !== x.stars)) return null;
        if ((snap.phase === "done") !== (snap.found === board.cheese)) return null;
        if (snap.die !== 0 || snap.card !== null || snap.left !== 0) return null;
        const t = { board: board.id, pots: snap.pots, cheese: snap.cheese };
        for (let k = 0; k < n; k++) if (snap.pots.indexOf(k) < 0 && mazeDist(t, snap.mice[0], k) === Infinity) return null;
        if (snap.phase === "move" && !snap.hands[snap.turn].some((id) => mazePath(t, id, snap.mice[snap.turn]).length)) return null;
      } else if (training) {
        // the train is its round's pattern in real colours (each letter its
        // own colour), the answer is the car that comes next, and the three
        // cars offered are different, the answer among them; the trains done
        // are the ⭐s; over exactly after the last train
        const ids = DATA.COLOURS.map((c) => c.id);
        if (!int(snap.round) || snap.round < 0 || snap.round > board.trains) return null;
        if (snap.round !== snap.seats[0].stars + snap.seats[1].stars || snap.seats.some((x) => x.pos !== x.stars)) return null;
        if ((snap.phase === "done") !== (snap.round === board.trains)) return null;
        if (snap.phase === "pick") {
          const pat = TRAIN_PATTERNS[snap.round % TRAIN_PATTERNS.length], Cr = snap.cars, Op = snap.options;
          if (!Array.isArray(Cr) || Cr.length !== TRAIN_SHOWN || Cr.some((c) => ids.indexOf(c) < 0)) return null;
          const map = {};
          for (let k = 0; k < TRAIN_SHOWN; k++) { const ch = pat[k % pat.length]; if (map[ch] == null) map[ch] = Cr[k]; else if (map[ch] !== Cr[k]) return null; }
          if (new Set(Object.values(map)).size !== Object.keys(map).length) return null;
          if (snap.answer !== map[pat[TRAIN_SHOWN % pat.length]]) return null;
          if (!Array.isArray(Op) || Op.length !== 3 || new Set(Op).size !== 3 || Op.some((c) => ids.indexOf(c) < 0) || Op.indexOf(snap.answer) < 0) return null;
        }
        if (!int(snap.misses) || snap.misses < 0) return null;
        if (snap.die !== 0 || snap.card !== null || snap.left !== 0) return null;
      } else if (hiloing) {
        // twenty cards, 1 to 10 twice: the deck, the top card and the cards
        // turned before it (not kept, so only the counts can be checked); the
        // cards turned are flips; the ⭐s are no more than the guesses each
        // player made; over exactly at the last flip
        const Dk = snap.deck;
        if (!Array.isArray(Dk) || Dk.some((x) => !int(x) || x < 1 || x > 10) || !int(snap.top) || snap.top < 1 || snap.top > 10) return null;
        const count = new Array(11).fill(0);
        for (const x of Dk.concat([snap.top])) count[x] += 1;
        if (count.some((c) => c > 2)) return null;
        if (!int(snap.flips) || snap.flips < 0 || snap.flips > board.flips || Dk.length !== 19 - snap.flips) return null;
        if (snap.seats.some((x) => x.pos !== x.stars || x.stars > Math.ceil(snap.flips / 2))) return null;
        if ((snap.phase === "done") !== (snap.flips === board.flips)) return null;
        if (snap.die !== 0 || snap.card !== null || snap.left !== 0) return null;
      } else if (tenning) {
        // every flower 1-9 exactly twice in all: in the meadow, the deck, or a
        // ten made (each ten adds to 10); the tens made are the ⭐s; the meadow
        // always holds a ten until the game is over; a held flower is a real one
        const F = snap.flowers, Dk = snap.deck, Md = snap.made, n = board.cols * board.rows;
        if (!Array.isArray(F) || F.length !== n || !Array.isArray(Dk) || !Array.isArray(Md)) return null;
        const count = new Array(10).fill(0);
        for (const x of F) { if (!int(x) || x < 0 || x > 9) return null; if (x) count[x] += 1; }
        for (const x of Dk) { if (!int(x) || x < 1 || x > 9) return null; count[x] += 1; }
        for (const p of Md) { if (!Array.isArray(p) || p.length !== 2 || p.some((x) => !int(x) || x < 1 || x > 9) || p[0] + p[1] !== 10) return null; count[p[0]] += 1; count[p[1]] += 1; }
        if (count.slice(1).some((c) => c !== 2)) return null;
        if (Md.length !== snap.seats[0].stars + snap.seats[1].stars || snap.seats.some((x) => x.pos !== x.stars)) return null;
        if (F.some((x) => !x) && Dk.length) return null;
        if ((snap.phase === "done") !== !tenHasPair(F)) return null;
        if (snap.held !== null && (!int(snap.held) || snap.held < 0 || snap.held >= n || !F[snap.held] || snap.phase !== "pick")) return null;
        if (snap.die !== 0 || snap.card !== null || snap.left !== 0) return null;
      } else if (fishing) {
        // every picture twice in all: in the pond, a hand, or a pair made
        // (a pair counts both); no hand holds a pair; the pairs made are the
        // ⭐s; a hand is empty mid-game only with the pond empty too; while
        // answering, the picture asked for is in the asker's hand
        const Hd = snap.hands, Pr = snap.pairs, Pd = snap.pond;
        if (!Array.isArray(Hd) || Hd.length !== 2 || !Hd.every(Array.isArray) || !Array.isArray(Pr) || Pr.length !== 2 || !Pr.every(Array.isArray) || !Array.isArray(Pd)) return null;
        const count = new Array(FISH_N).fill(0), pic = (x) => int(x) && x >= 0 && x < FISH_N;
        for (const x of Pd.concat(Hd[0], Hd[1])) { if (!pic(x)) return null; count[x] += 1; }
        for (const x of Pr[0].concat(Pr[1])) { if (!pic(x)) return null; count[x] += 2; }
        if (count.some((c) => c !== 2)) return null;
        for (const j of [0, 1]) {
          if (fishHasPair(Hd[j])) return null;
          if (snap.seats[j].stars !== Pr[j].length || snap.seats[j].pos !== Pr[j].length) return null;
        }
        if ((snap.phase === "done") !== (Pr[0].length + Pr[1].length === FISH_N)) return null;
        if (snap.phase === "ask" && (!Hd[snap.turn].length || snap.want !== -1)) return null;
        if (snap.phase === "answer" && Hd[snap.turn].indexOf(snap.want) < 0) return null;
        if (!int(snap.misses) || snap.misses < 0) return null;
        if (snap.die !== 0 || snap.card !== null || snap.left !== 0) return null;
      } else if (snowing) {
        // each snowman starts with its big ball, then real parts, once each,
        // every one built after the part it needs; a seat's count is its
        // parts and a whole snowman (six) is home and a ⭐; while building,
        // the roll can go on the mover's snowman now
        const Pt = snap.parts;
        if (!Array.isArray(Pt) || Pt.length !== 2 || !Pt.every(Array.isArray)) return null;
        for (const j of [0, 1]) {
          const h = Pt[j], x = snap.seats[j];
          if (h[0] !== 1 || h.some((p) => !int(p) || p < 1 || p > 6) || new Set(h).size !== h.length) return null;
          if (h.some((p, k) => k > 0 && h.slice(0, k).indexOf(SNOW_NEEDS[p]) < 0)) return null;
          if (x.pos !== h.length || x.home !== (h.length === 6) || x.stars !== (h.length === 6 ? 1 : 0)) return null;
        }
        if (snap.phase !== "done" && snap.mover !== moverFor(snap, snap.turn)) return null;
        if (snap.phase === "build") { if (!snowCan(Pt[snap.mover], snap.die)) return null; }
        else if (snap.die !== 0) return null;
        if (snap.card !== null || snap.left !== 0) return null;
      } else if (bingoing) {
        // each card holds 1 to 6 (each at least once) in nine squares; a
        // seat's count is its squares covered and its ⭐s its lines; a full
        // card is home (the order who filled first); while covering, the die is
        // on the mover's card and not yet covered, and the mover is the one
        // the helper rule says; between turns no die is showing
        const Cd = snap.cardsB, Cv = snap.covered;
        if (!Array.isArray(Cd) || Cd.length !== 2 || !Array.isArray(Cv) || Cv.length !== 2) return null;
        for (const j of [0, 1]) {
          if (!Array.isArray(Cd[j]) || Cd[j].length !== 9 || Cd[j].some((n) => !int(n) || n < 1 || n > 6)) return null;
          if ([1, 2, 3, 4, 5, 6].some((n) => Cd[j].indexOf(n) < 0)) return null;
          if (!Array.isArray(Cv[j]) || Cv[j].length !== 9 || Cv[j].some((c) => typeof c !== "boolean")) return null;
          const x = snap.seats[j], n = Cv[j].filter(Boolean).length;
          if (x.pos !== n || x.stars !== bingoLinesOf(Cv[j]) || x.home !== (n === 9)) return null;
        }
        if (snap.phase !== "done" && snap.mover !== moverFor(snap, snap.turn)) return null;
        if (!int(snap.misses) || snap.misses < 0 || (snap.phase !== "cover" && snap.misses !== 0)) return null;
        if (snap.phase === "cover") {
          if (!int(snap.die) || snap.die < 1) return null;
          if (!bingoSpots(snap).length) return null;
        } else if (snap.die !== 0) return null;
        if (snap.card !== null || snap.left !== 0) return null;
      } else if (cmatching) {
        // all forty cards, each in exactly one place (the deck, the pile, the
        // top, a hand); a hand is never empty mid-game (an empty hand ends the
        // round); the rounds won are the ⭐s
        const Hn = snap.hands;
        if (!Array.isArray(snap.deck) || !Array.isArray(snap.pile) || !Array.isArray(Hn) || Hn.length !== 2 || !Hn.every(Array.isArray)) return null;
        const all = snap.deck.concat(snap.pile, Hn[0], Hn[1], [snap.top]);
        if (all.length !== 40 || new Set(all).size !== 40 || all.some((id) => !int(id) || id < 0 || id > 39)) return null;
        if (!int(snap.round) || snap.round !== snap.seats[0].stars + snap.seats[1].stars || snap.round > board.rounds) return null;
        if (snap.seats.some((x) => x.pos !== x.stars)) return null;
        if ((snap.phase === "done") !== (snap.round === board.rounds)) return null;
        if (snap.phase === "play" && Hn.some((h) => !h.length)) return null;
        if (!int(snap.misses) || snap.misses < 0) return null;
        if (snap.die !== 0 || snap.card !== null || snap.left !== 0) return null;
      } else if (hiding) {
        // nine different hiders a round (ids 0-17), the one hiding among them
        // and still standing, and at least two standing mid-game (one left
        // would already have been found). (Nobody down can match the hider
        // every way: different ids always differ in a trait.) Three
        // different questions, 0-6, while asking. The hiders found are the ⭐s.
        const C = snap.cards, U = snap.up, n = board.cols * board.rows;
        if (!Array.isArray(C) || C.length !== n || C.some((id) => !int(id) || id < 0 || id > 17) || new Set(C).size !== n) return null;
        if (!Array.isArray(U) || U.length !== n || U.some((u) => typeof u !== "boolean")) return null;
        if (!int(snap.hidden) || snap.hidden < 0 || snap.hidden >= n) return null;
        if (!int(snap.found) || snap.found !== snap.seats[0].stars + snap.seats[1].stars || snap.found > board.rounds) return null;
        if (snap.seats.some((x) => x.pos !== x.stars)) return null;
        if ((snap.phase === "done") !== (snap.found === board.rounds)) return null;
        if (!Array.isArray(snap.asks) || snap.asks.some((q) => !int(q) || q < 0 || q > 6) || new Set(snap.asks).size !== snap.asks.length) return null;
        if (snap.phase === "ask") {
          if (!U[snap.hidden] || U.filter(Boolean).length < 2 || snap.asks.length !== board.ask) return null;
        } else if (snap.asks.length) return null;
        if (snap.die !== 0 || snap.card !== null || snap.left !== 0) return null;
      } else if (matching3) {
        // three dice of 1-6 while keeping (and nothing kept or left between
        // turns); the re-rolls left while keeping are 1 or 2; turns played
        // alternate, so the counts differ by at most one; a turn never ends
        // on three the same still to keep (three the same scores at once)
        const D = snap.dice, Hd = snap.held;
        if (!Array.isArray(D) || D.length !== 3 || !Array.isArray(Hd) || Hd.length !== 3 || Hd.some((h) => typeof h !== "boolean")) return null;
        if (snap.phase === "keep") {
          if (D.some((d) => !int(d) || d < 1 || d > 6)) return null;
          if (!int(snap.left) || snap.left < 1 || snap.left > board.rerolls) return null;
          if (m3Score(D) === 3) return null;
        } else if (snap.left !== 0 || Hd.some(Boolean)) return null;
        if (snap.seats.some((x) => !int(x.pos) || x.pos > board.rounds)) return null;
        if (Math.abs(snap.seats[0].pos - snap.seats[1].pos) > 1) return null;
        if (snap.seats.some((x) => x.stars > x.pos * 3)) return null;
        if ((snap.phase === "done") !== snap.seats.every((x) => x.pos >= board.rounds)) return null;
        if (snap.die !== 0 || snap.card !== null) return null;
      } else if (grabbing) {
        // every square a real colour, owned by nobody or a seat; each patch is
        // ONE colour, holds its corner and is joined up; a seat's count is its
        // patch; the corners' patches already swallowed what touched them;
        // the game is over exactly when every square is owned
        const Pt = snap.paint, Ow = snap.owner, n = board.cols * board.rows, ids = DATA.COLOURS.map((c) => c.id);
        if (!Array.isArray(Pt) || Pt.length !== n || Pt.some((c) => ids.indexOf(c) < 0)) return null;
        if (!Array.isArray(Ow) || Ow.length !== n || Ow.some((o) => o !== -1 && o !== 0 && o !== 1)) return null;
        if (Ow[0] !== 0 || Ow[n - 1] !== 1) return null;
        for (const j of [0, 1]) {
          const mine = Ow.map((o, k) => k).filter((k) => Ow[k] === j);
          if (snap.seats[j].pos !== mine.length) return null;
          if (mine.some((k) => Pt[k] !== Pt[mine[0]])) return null;
          // joined up: a flood from the corner reaches every one of its squares
          const C = board.cols, seen = new Set([j === 0 ? 0 : n - 1]), stack = [j === 0 ? 0 : n - 1];
          while (stack.length) { const k = stack.pop(), x = k % C; for (const m of [x > 0 ? k - 1 : -1, x < C - 1 ? k + 1 : -1, k - C, k + C]) if (m >= 0 && m < n && Ow[m] === j && !seen.has(m)) { seen.add(m); stack.push(m); } }
          if (seen.size !== mine.length) return null;
          // a patch next to a free square of its own colour would have grabbed it
          if (grabCells(board, Pt, Ow, j, Pt[mine[0]]).length) return null;
        }
        if (Pt[0] === Pt[n - 1]) return null;
        if ((snap.phase === "done") !== Ow.every((o) => o >= 0)) return null;
        if (snap.die !== 0 || snap.left !== 0 || snap.card !== null) return null;
      } else if (topping) {
        // each player's own ten cards, each in exactly one place (pile, hand,
        // table, or a trick played); tricks are played in pairs; a hand is
        // full again after every trick (three, or what the pile has left);
        // the lead alternates from `first`, and only the leader's card is on
        // the table while the other answers; every ⭐ is a trick its card won
        const P = snap.piles, H = snap.hands, Tb = snap.table, Gn = snap.gone;
        if (![P, H, Tb, Gn].every((a) => Array.isArray(a) && a.length === 2)) return null;
        if (![P[0], P[1], H[0], H[1], Gn[0], Gn[1]].every(Array.isArray)) return null;
        if (snap.first !== 0 && snap.first !== 1) return null;
        const T = Gn[0].length;
        if (Gn[1].length !== T || T > board.deck) return null;
        for (const j of [0, 1]) {
          const here = P[j].concat(H[j], Gn[j], Tb[j] == null ? [] : [Tb[j]]);
          if (here.length !== board.deck || new Set(here).size !== board.deck || here.some((v) => !int(v) || v < 1 || v > board.deck)) return null;
          if (H[j].length + (Tb[j] == null ? 0 : 1) !== Math.min(board.hand, board.deck - T)) return null;
          const won = Gn[j].filter((v, t) => v > Gn[1 - j][t]).length;
          if (snap.seats[j].stars !== won || snap.seats[j].pos !== won) return null;
        }
        if (snap.lead !== (snap.first + T) % 2) return null;
        if ((snap.phase === "done") !== (T === board.deck)) return null;
        if (snap.phase === "lead" && (Tb[0] !== null || Tb[1] !== null || snap.turn !== snap.lead)) return null;
        if (snap.phase === "follow" && (Tb[snap.lead] == null || Tb[1 - snap.lead] !== null || snap.turn !== 1 - snap.lead)) return null;
        if (snap.phase === "done" && (Tb[0] !== null || Tb[1] !== null)) return null;
        if (snap.die !== 0 || snap.left !== 0 || snap.card !== null) return null;
      } else if (lining) {
        // the board's cells are empty or a seat's; nothing floats (a counter
        // sits on the bottom or on another); drops alternate over the whole
        // game from `first`, so after T drops in all the first player has
        // made ceil(T/2) of them, it is (first + T)'s turn, and the counters
        // on this board are its own share of the last drops; the lines on the
        // board now are ⭐s already won; a board is never full mid-game
        const G = snap.grid, n = board.cols * board.rows;
        if (!Array.isArray(G) || G.length !== n || G.some((g) => g !== -1 && g !== 0 && g !== 1)) return null;
        if (!int(snap.boardNo) || snap.boardNo < 0 || snap.boardNo >= board.boards) return null;
        if (snap.first !== 0 && snap.first !== 1) return null;
        for (let k = board.cols; k < n; k++) if (G[k] >= 0 && G[k - board.cols] < 0) return null;
        const on = [0, 1].map((j) => G.filter((g) => g === j).length), before = snap.boardNo * n, T = before + on[0] + on[1];
        const share = (t, j) => (j === snap.first ? Math.ceil(t / 2) : Math.floor(t / 2));
        for (const j of [0, 1]) {
          if (snap.seats[j].pos !== share(T, j)) return null;
          if (on[j] !== share(T, j) - share(before, j)) return null;
        }
        if ((snap.phase === "done") !== (snap.boardNo === board.boards - 1 && G.every((g) => g >= 0))) return null;
        if (snap.phase === "drop" && (G.every((g) => g >= 0) || snap.turn !== (snap.first + T) % 2)) return null;
        for (const j of [0, 1]) if (snap.seats[j].stars < linesOf(board).filter((ln) => ln.every((k) => G[k] === j)).length) return null;
        if (snap.die !== 0 || snap.left !== 0 || snap.card !== null) return null;
      } else if (nimming) {
        // the jar open now, the cookies still in it (none only once the last
        // jar is empty); every cookie eaten is on a plate, and every jar
        // emptied gave someone its golden ⭐
        const J = board.jars;
        if (!int(snap.jar) || snap.jar < 0 || snap.jar >= J.length) return null;
        if (!int(snap.cookies) || snap.cookies < 0 || snap.cookies > J[snap.jar]) return null;
        if ((snap.phase === "done") !== (snap.jar === J.length - 1 && snap.cookies === 0)) return null;
        if (snap.phase === "take" && snap.cookies === 0) return null;
        const eaten = J.slice(0, snap.jar).reduce((t, n) => t + n, 0) + J[snap.jar] - snap.cookies;
        if (snap.seats[0].pos + snap.seats[1].pos !== eaten) return null;
        if (snap.seats[0].stars + snap.seats[1].stars !== snap.jar + (snap.phase === "done" ? 1 : 0)) return null;
        if (snap.die !== 0 || snap.left !== 0 || snap.card !== null) return null;
      } else if (domino) {
        // every tile exactly once — in the line, a hand or the pile; the line
        // joins up dot to dot and its open ends are `ends`; the tiles laid are
        // the players' counts; the turn is one that can lay ("lay") or draw
        // ("draw"), and it is over exactly when no tile can be laid any more
        const H = snap.hands, Ln = snap.line, Pi = snap.pile;
        if (!Array.isArray(H) || H.length !== 2 || !H.every(Array.isArray) || !Array.isArray(Ln) || !Ln.length || !Array.isArray(Pi)) return null;
        if (Ln.some((t) => !Array.isArray(t) || t.length !== 2 || !int(t[0]) || !int(t[1]))) return null;
        for (let k = 0; k + 1 < Ln.length; k++) if (Ln[k][1] !== Ln[k + 1][0]) return null;
        if (!Array.isArray(snap.ends) || snap.ends[0] !== Ln[0][0] || snap.ends[1] !== Ln[Ln.length - 1][1]) return null;
        const ids = Ln.map((t) => Math.min(t[0], t[1]) + "-" + Math.max(t[0], t[1])).concat(H[0], H[1], Pi);
        const set = domSet(board);
        if (ids.length !== set.length || new Set(ids).size !== ids.length || ids.some((id) => set.indexOf(id) < 0)) return null;
        if (snap.seats[0].pos + snap.seats[1].pos !== Ln.length - 1) return null;
        if (snap.seats.some((s, j) => !int(s.stars) || s.stars < 0 || s.stars > s.pos + (H[j].length ? 0 : 1))) return null;
        if (snap.held !== null && (snap.phase !== "lay" || H[snap.turn].indexOf(snap.held) < 0 || !domChoosy(snap, snap.held))) return null;
        const over = !domCanMove(snap, 0) && !domCanMove(snap, 1);
        if ((snap.phase === "done") !== over) return null;
        if (snap.phase === "lay" && !domCanLay(snap, snap.turn)) return null;
        if (snap.phase === "draw" && (domCanLay(snap, snap.turn) || !domPileFits(snap))) return null;
        if (snap.phase !== "done" && !H[snap.turn].length) return null;
        if (!int(snap.misses) || snap.misses < 0 || (snap.phase !== "lay" && snap.misses !== 0)) return null;
        if (snap.die !== 0 || snap.left !== 0 || snap.card !== null) return null;
      } else if (acorning) {
        // eight places round the ring, every acorn in one of them; each nest
        // is its seat's count; the game is over exactly when every pot is
        // empty, and until then neither side is (an empty side ends it)
        const P = snap.pots;
        if (!Array.isArray(P) || P.length !== RING || P.some((n) => !int(n) || n < 0)) return null;
        if (P.reduce((t, n) => t + n, 0) !== board.size) return null;
        for (const j of [0, 1]) if (snap.seats[j].pos !== P[nestOf(j)]) return null;
        const potsLeft = P.some((n, k) => k % 4 !== NEST && n > 0);
        if ((snap.phase === "done") === potsLeft) return null;
        if (snap.phase === "choose" && (sideEmpty(snap, 0) || sideEmpty(snap, 1))) return null;
        if (snap.die !== 0 || snap.left !== 0 || snap.card !== null) return null;
        if (snap.seats.some((s) => !int(s.stars) || s.stars < 0)) return null;
      } else if (pairing) {
        // the game's pictures (distinct, real); this board holds its own four
        // twice and one ⭐; cards go in twos (a pair), the ⭐ alone; at most
        // the one card of an unfinished turn is up; and the piles are exactly
        // the pairs and stars found
        const per = board.pairsPer, P = snap.pics;
        if (!Array.isArray(P) || P.length !== board.boards * per || new Set(P).size !== P.length || P.some((id) => !DATA.pairPic(id))) return null;
        if (!int(snap.boardNo) || snap.boardNo < 0 || snap.boardNo >= board.boards) return null;
        const C = snap.cards, G = snap.gone, S = snap.seen, O = snap.open;
        if (!Array.isArray(C) || C.length !== per * 2 + 1 || !Array.isArray(G) || G.length !== C.length || !Array.isArray(S) || S.length !== C.length || !Array.isArray(O)) return null;
        if (G.some((g) => typeof g !== "boolean") || S.some((g) => typeof g !== "boolean")) return null;
        const mine = P.slice(snap.boardNo * per, (snap.boardNo + 1) * per);
        const want = mine.concat(mine, [STAR]).sort(), got = C.slice().sort();
        if (want.some((id, k) => got[k] !== id)) return null;
        let pairsGone = 0;
        for (const id of mine) {
          const ks = C.map((c, k) => k).filter((k) => C[k] === id);
          if (G[ks[0]] !== G[ks[1]]) return null;
          if (G[ks[0]]) pairsGone += 1;
        }
        const starGone = G[C.indexOf(STAR)];
        if (O.length !== (snap.phase === "second" ? 1 : 0)) return null;
        if (O.some((k) => !int(k) || k < 0 || k >= C.length || G[k] || C[k] === STAR || !S[k])) return null;
        if (G.some((g, k) => g && !S[k])) return null;
        const found = snap.seats[0].pos + snap.seats[1].pos, starred = snap.seats[0].stars + snap.seats[1].stars - found;
        if (found !== snap.boardNo * per + pairsGone) return null;
        if (starred !== snap.boardNo + (starGone ? 1 : 0)) return null;
        if (snap.seats.some((s) => !int(s.stars) || s.stars < s.pos)) return null;
        if ((snap.phase === "done") !== (snap.boardNo === board.boards - 1 && G.every(Boolean))) return null;
        if (snap.phase !== "done" && G.every(Boolean)) return null;
        if (snap.card !== null) return null;
      } else if (spotting) {
        // every card is in exactly one place: the deck, the middle, in hand
        // (while finding), or on a pile — and the piles are what was found
        if (!Array.isArray(snap.deck) || !int(snap.centre)) return null;
        const here = snap.deck.concat([snap.centre], snap.phase === "find" ? [snap.hand] : []);
        if (snap.phase !== "find" && snap.hand !== null) return null;
        if (here.some((k) => !int(k) || k < 0 || k >= board.deck.length) || new Set(here).size !== here.length) return null;
        if (snap.seats[0].pos + snap.seats[1].pos !== board.deck.length - here.length) return null;
        if (snap.seats.some((s) => s.stars !== s.pos)) return null;
        if (!int(snap.misses) || snap.misses < 0 || (snap.phase !== "find" && snap.misses !== 0)) return null;
        if (snap.card !== null) return null;
        if (snap.phase === "done" ? snap.deck.length !== 0 : snap.deck.length === 0 && snap.phase === "flip") return null;
      } else if (lotto) {
        // two blankets of `spots` different foods that share none; what is on
        // each is from that blanket; every food is in exactly one place — on
        // its blanket, in the basket, or in hand while it is being given
        const B = snap.blankets, P = snap.placed;
        if (!Array.isArray(B) || B.length !== 2 || !Array.isArray(P) || P.length !== 2 || !Array.isArray(snap.basket)) return null;
        const all = [];
        for (let i = 0; i < 2; i++) {
          if (!Array.isArray(B[i]) || B[i].length !== board.spots || !Array.isArray(P[i])) return null;
          if (B[i].some((f) => !DATA.food(f)) || P[i].some((f) => B[i].indexOf(f) < 0)) return null;
          if (snap.seats[i].pos !== P[i].length) return null;
          all.push(...B[i]);
        }
        if (new Set(all).size !== all.length) return null;
        const inHand = snap.phase === "give" ? [snap.food] : [];
        if (snap.phase === "give" ? all.indexOf(snap.food) < 0 : snap.food !== null) return null;
        const everywhere = P[0].concat(P[1], snap.basket, inHand);
        if (everywhere.length !== all.length || new Set(everywhere).size !== all.length || everywhere.some((f) => all.indexOf(f) < 0)) return null;
        if (!int(snap.misses) || snap.misses < 0 || (snap.phase !== "give" && snap.misses !== 0)) return null;
        if (snap.card !== null) return null;
      } else if (snap.card !== null && !okCard(board, snap.card)) return null;
      for (const s of snap.seats) {
        if (!s || typeof s.who !== "string" || !DATA.person(s.who)) return null;
        if (!int(s.pos) || s.pos < startOf(board) || s.pos > board.size) return null;
        if (spinning && typeof s.bird !== "boolean") return null;
        if (typeof s.home !== "boolean" || typeof s.cpu !== "boolean") return null;
        if (!int(s.stars) || s.stars < 0 || !int(s.rng)) return null;
        if (s.sharp !== undefined && !(typeof s.sharp === "number" && s.sharp >= 0 && s.sharp <= 1)) return null;
        // home is exactly standing on the last square
        // home is exactly standing on the last square (👀 everyone is home
        // together, once the deck is used up)
        if (spotting || pairing || acorning || domino || digging || nimming || lining || topping || grabbing || matching3 || mazing || hiding || cmatching || fishing || tenning || hiloing || training ? s.home !== (snap.phase === "done") : s.home !== (s.pos === board.size)) return null;
        if (!Array.isArray(s.bag) || !okBag(board, s.bag, hen ? snap.fox : snap.birds)) return null;
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
    create, roll, hop, drawCard, spin, pick, spinHen, henHop, takeFood, giveFood, ownerOf, flipSpot, findSpot, twinOf, peekPair, pairChoice, PAIR_RECALL, STAR, shutDoor, doorWays, doorChoice, digAt, digChoice, digMaybe, digDir, DIG_SHARP, takeCookies, nimTakes, nimBest, nimChoice, NIM_SHARP, dropLine, dropRow, linesOf, linesOpen, linesMade, linesBest, linesChoice, LINES_SHARP, playCard, topBest, topChoice, TOP_SHARP, grabColour, grabCells, grabOptions, grabGain, grabBest, grabChoice, GRAB_SHARP, chooseDie, dieTarget, dieBest, dieChoice, DIE_SHARP, moveMouse, mazePath, mazeDist, mazeBest, mazeChoice, MAZE_SHARP, MAZE_WORDS, askHide, hideYes, hideSplit, hideBest, hideChoice, hideTraits, HIDE_SHARP, pickCar, trainChoice, TRAIN_SHARP, TRAIN_PATTERNS, hiloGuess, hiloBest, hiloChoice, HILO_SHARP, tenPick, tenPairs, tenChoice, TEN_SHARP, askFish, answerFish, fishBest, fishChoice, fishAnswer, FISH_SHARP, FISH_N, buildSnow, SNOW_NEEDS, SNOW_MAGIC, snowWhich, coverBingo, bingoSpots, bingoBest, BINGO_LINES, playMatch, flipMatch, cmFits, cmColour, cmNumber, cmPlayable, cmChoice, rollMatch, holdDie, m3Score, m3Keep, m3Choice, M3_SHARP, layTile, drawTile, domSides, domChoice, domSet, domChoosy, domEndsAfter, sowPot, acornAgains, acornChoice, ACORN_SHARP, ACORN_NEST: nestOf, autoTurn, snapshot, restore, animalAt, nextAnimal, FOX,
    cellOf, jumpAt, colourAt, landmarkAt, nextOf, moverFor, startOf, facesOf, tapsOf, COMET_CAP, BACK_CAP, TEN, sharpOf, SHARP_MIN, SHARP_MAX, levelled,
  };
  global.BoardLogic = BoardLogic;
  if (typeof module !== "undefined" && module.exports) module.exports = BoardLogic;
})(typeof window !== "undefined" ? window : globalThis);
