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
  const startOf = (board) => (board.game === "spin" || board.game === "lotto" || board.game === "spot" || board.game === "pairs" || board.game === "doors" ? 0 : 1);

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
    // 🐔 co-op: ONE hen for both (both seats stand where she stands), the
    // chicks she has brought home, and the chicks out playing with the fox
    if (board.game === "hen") { st.coop = 0; st.out = 0; st.fox = !!opts.fox; }
    // 🚪 the door held while he looks for the one that makes the rest, and
    // the misses this roll (so the screen can help after two)
    if (board.game === "doors") { st.held = null; st.misses = 0; }
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
  function firstPhase(game) { return game === "spot" || game === "pairs" ? "flip" : game === "cards" || game === "lotto" ? "draw" : game === "spin" || game === "hen" ? "spin" : "roll"; }

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
    return ways[Math.floor(next(st.seats[st.turn]) * ways.length)];
  }

  // ---- 🚀 Moon Race: roll, then one hop per tap ----------------------------
  function roll(st) {
    if (st.game === "doors" && st.phase === "roll") return rollDoors(st);
    if (st.game !== "dice" || st.phase !== "roll") return [];
    const seat = st.seats[st.turn];
    const board = DATA.board(st.board);
    const die = draw(seat, () => dieBag(seat, board));
    // a ten-bar is ONE tap: ten more, straight down a row
    st.die = die; st.left = tapsOf(die); st.rolls += 1;
    st.mover = moverFor(st, st.turn);
    st.phase = "hop";
    return [{ type: "roll", seat: st.turn, mover: st.mover, die }];
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
        endTurn(st, ev);
        return ev;
      }
      st.gone[a] = st.gone[k] = true;
      s.pos += 1;
      s.stars += 1;
      ev.push({ type: "pair", seat: st.turn, a, b: k, pic, count: s.pos });
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
    const known = (k) => st.seen[k] && next(s) < PAIR_RECALL;
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
    if (board.game === "lotto" || board.game === "spot" || board.game === "pairs") return bag.length === 0;
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
      const lotto = board.game === "lotto", spotting = board.game === "spot", pairing = board.game === "pairs";
      const okPhase = board.game === "cards" ? ["draw", "done"] : pairing ? ["flip", "second", "done"] : lotto ? ["draw", "give", "done"] : board.game === "doors" ? ["roll", "shut", "done"] : spotting ? ["flip", "find", "done"] : spinning ? ["spin", "pick", "done"] : hen ? ["spin", "hop", "done"] : ["roll", "hop", "done"];
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
      if (board.game === "dice" || board.game === "doors" ? snap.die !== 0 && facesOf(board).indexOf(snap.die) < 0 : snap.die > 6) return null;
      // hops (or apples) are left exactly while hopping (picking): a "hop"
      // turn with none left would be stuck for good (hop() refuses, nothing
      // ends the turn)
      if ((snap.phase === moving) !== (snap.left > 0)) return null;
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
        // home is exactly standing on the last square
        // home is exactly standing on the last square (👀 everyone is home
        // together, once the deck is used up)
        if (spotting || pairing ? s.home !== (snap.phase === "done") : s.home !== (s.pos === board.size)) return null;
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
    create, roll, hop, drawCard, spin, pick, spinHen, henHop, takeFood, giveFood, ownerOf, flipSpot, findSpot, twinOf, peekPair, pairChoice, PAIR_RECALL, STAR, shutDoor, doorWays, doorChoice, autoTurn, snapshot, restore, animalAt, nextAnimal, FOX,
    cellOf, jumpAt, colourAt, landmarkAt, nextOf, moverFor, startOf, facesOf, tapsOf, COMET_CAP, BACK_CAP, TEN,
  };
  global.BoardLogic = BoardLogic;
  if (typeof module !== "undefined" && module.exports) module.exports = BoardLogic;
})(typeof window !== "undefined" ? window : globalThis);
