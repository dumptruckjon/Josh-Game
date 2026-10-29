// 🎲 Game Night — engine tests (node, no browser). The engine is pure and
// seeded, so whole games are PLAYED here headless, thousands of them, and the
// no-lose rules (PLAN_BOARD.md §4) are proven on every board rather than read
// off the data.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const DATA = require("../scripts/board-data.js");
const L = require("../scripts/board-logic.js");

const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
const play = (board, seed, first) => {
  const st = L.create({ board, seats: SEATS, seed, first });
  const ev = [];
  let turns = 0;
  while (st.phase !== "done" && turns < 400) { ev.push(...L.autoTurn(st)); turns++; }
  return { st, ev, turns };
};

test("data: every box opens a real board, every board is a real grid, every person has a colour", () => {
  assert.ok(DATA.BOXES.length >= 3, "the shelf holds the batch-1 boxes");
  for (const b of DATA.BOXES) {
    const board = DATA.board(b.board);
    assert.ok(board, `${b.id} opens a real board`);
    assert.equal(board.box, b.id, `${board.id} names the box that opens it`);
    assert.ok(b.name && b.pic && b.colour, `${b.id} has a name, a picture and a colour`);
    if (b.unlockAfter) assert.ok(DATA.box(b.unlockAfter.box), `${b.id} unlocks after a real box`);
  }
  for (const board of DATA.BOARDS) {
    // a track fills its grid exactly; Apple Spin's grid is only the shape of
    // its picture, and its size is the TEN-FRAME basket
    if (board.game === "spin") assert.equal(board.size, 10, `${board.id}: a basket is a ten-frame`);
    else assert.equal(board.size, board.cols * board.rows, `${board.id} fills its grid exactly`);
    assert.ok(["dice", "cards", "spin"].indexOf(board.game) >= 0, `${board.id} is a dice, card or spinner game`);
    assert.ok(DATA.BOXES.some((b) => b.board === board.id), `${board.id} is on the shelf (no dead board)`);
  }
  for (const p of [DATA.JOSH, ...DATA.PEOPLE]) {
    assert.match(p.colour, /^#[0-9a-f]{6}$/i, `${p.id} has a token colour`);
    assert.ok(p.say && (p.face || p.emoji), `${p.id} has a spoken name and a face`);
  }
  assert.equal(new Set(DATA.PEOPLE.map((p) => p.id)).size, DATA.PEOPLE.length, "people ids are unique");
  assert.equal(new Set([DATA.JOSH, ...DATA.PEOPLE].map((p) => p.colour)).size, DATA.PEOPLE.length + 1,
    "every token colour is different, so two tokens are never the same");
  assert.equal(DATA.PEOPLE.length % 3, 0, "the people picker fills its 3-across grid evenly");
  for (const f of DATA.FRIENDS) assert.ok(DATA.PEOPLE.some((p) => p.id === f.id), `${f.id} can also sit beside him`);
});

test("THE JUMP LAWS: boosters go up, a comet drops at most one row and never from the first or top row, and no jump lands on another jump", () => {
  let comets = 0, boosts = 0;
  for (const board of DATA.BOARDS.filter((b) => b.game === "dice")) {
    const starts = new Set();
    for (const j of board.jumps) {
      assert.ok(j.from > 1 && j.from < board.size, `${board.id}: a jump never starts on the start or the Moon`);
      assert.ok(j.to > 1 && j.to < board.size, `${board.id}: a jump never ends on the start or the Moon`);
      assert.ok(!starts.has(j.from), `${board.id}: one jump per square`);
      starts.add(j.from);
      if (j.kind === "boost") { boosts++; assert.ok(j.to > j.from, `${board.id}: a booster goes UP (${j.from}->${j.to})`); }
      else {
        assert.equal(j.kind, "comet", `${board.id}: a jump is a boost or a comet`);
        comets++;
        assert.ok(j.to < j.from, `${board.id}: a comet goes down`);
        assert.ok(j.from - j.to <= board.cols, `${board.id}: comet ${j.from}->${j.to} drops more than one row`);
        assert.ok(j.from > board.cols, `${board.id}: no comet in the first row (${j.from})`);
        assert.ok(j.from <= board.size - board.cols, `${board.id}: no comet in the top row (${j.from})`);
      }
    }
    for (const j of board.jumps) assert.ok(!starts.has(j.to), `${board.id}: ${j.from}->${j.to} lands on another jump (no chains)`);
  }
  assert.ok(boosts >= 7 && comets >= 3, "fixture: the boards carry real jumps");
  // decision 6: the FIRST board has no comets at all
  assert.ok(DATA.board("moon").jumps.every((j) => j.kind === "boost"), "Moon Race (his first board) has boosters only");
  assert.ok(DATA.board("comet").jumps.some((j) => j.kind === "comet"), "Comet Moon is where the slides live");
  assert.deepEqual(DATA.box("comet").unlockAfter, { box: "moon", games: 2 }, "comets arrive from his THIRD Moon game");
});

test("RAINBOW LAWS: a colour and a shape on every square, no two neighbours alike, every colour never more than 7 ahead", () => {
  const b = DATA.board("rainbow");
  assert.equal(b.colours.length, b.size - 2, "one colour per square between the start and the cake");
  const ids = DATA.COLOURS.map((c) => c.id);
  assert.equal(new Set(DATA.COLOURS.map((c) => c.shape)).size, ids.length, "every colour has its OWN shape (any colour vision)");
  const count = {};
  for (let n = 2; n < b.size; n++) {
    const c = L.colourAt(b, n);
    assert.ok(ids.indexOf(c) >= 0, `square ${n} has a real colour`);
    count[c] = (count[c] || 0) + 1;
    if (n > 2) assert.notEqual(c, L.colourAt(b, n - 1), `squares ${n - 1} and ${n} share a colour`);
  }
  assert.equal(L.colourAt(b, 1), null, "the start has no colour");
  assert.equal(L.colourAt(b, b.size), null, "the cake has no colour");
  for (const c of ids) assert.ok(count[c] >= 6 && count[c] <= 7, `${c} appears ${count[c]} times`);
  for (let n = 1; n < b.size; n++) for (const c of ids) {
    const to = L.nextOf(b, n, c);
    assert.ok(to > n && to - n <= 7, `from ${n}, ${c} is ${to - n} squares ahead — a long wait for one card`);
  }
  const at = b.landmarks.map((l) => l.at);
  assert.deepEqual(at, at.slice().sort((x, y) => x - y), "landmarks run in order");
  for (const l of b.landmarks) {
    assert.ok(l.at > 1 && l.at < b.size && L.colourAt(b, l.at), `landmark ${l.say} sits on a coloured square`);
    assert.ok(l.say && !/\p{Extended_Pictographic}/u.test(l.say), `landmark ${l.at} has a spoken name, not a picture`);
  }
});

test("the engine is PURE: no Math.random, no DOM, dual export, and the same seed plays the same game", () => {
  const src = fs.readFileSync(path.join(__dirname, "../scripts/board-logic.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/Math\.random/.test(src), "board-logic.js must use its seeded rng, never Math.random");
  assert.ok(!/\bdocument\b|localStorage|setTimeout|Date\.now|performance/.test(src), "board-logic.js touches no DOM, clock or storage");
  for (const board of DATA.BOARDS.map((b) => b.id)) {
    const a = play(board, 77), c = play(board, 77), d = play(board, 78);
    assert.deepEqual(a.ev, c.ev, `${board}: the same seed replays identically`);
    assert.notDeepEqual(a.ev, d.ev, `${board}: a different seed is a different game`);
  }
});

test("EVERY GAME ENDS, everyone gets home, and a game is a few minutes long (thousands of seeds on every board)", () => {
  for (const board of DATA.BOARDS) {
    const turns = [];
    for (let seed = 1; seed <= 3000; seed++) {
      const g = play(board.id, seed);
      assert.equal(g.st.phase, "done", `${board.id} seed ${seed} never ended`);
      assert.ok(g.st.seats.every((s) => s.home && s.pos === board.size), `${board.id} seed ${seed}: everyone is home`);
      assert.equal(g.ev.filter((e) => e.type === "end").length, 1, "one ending");
      assert.equal(g.st.order.length, 2, "both arrivals are recorded");
      turns.push(g.turns);
    }
    turns.sort((a, b) => a - b);
    const med = turns[turns.length >> 1], p95 = turns[Math.floor(turns.length * 0.95)];
    // About 8-9 turns each (a minute and a half to three at a child's pace),
    // and never a slog: the long tail is short too. Apple Spin is shorter in
    // turns (about five spins each) because every spin is up to four TAPS.
    const lo = board.game === "spin" ? 8 : 12;
    assert.ok(med >= lo && med <= 22, `${board.id}: median ${med} turns in all`);
    assert.ok(p95 <= 30, `${board.id}: p95 ${p95} turns — a game can drag`);
    assert.ok(turns[turns.length - 1] <= 45, `${board.id}: the longest game took ${turns[turns.length - 1]} turns`);
  }
});

test("FAIR DICE: every six rolls of each player are 1-6 once each, and the computer's dice are the same as Josh's", () => {
  const hist = [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]];
  for (let seed = 1; seed <= 400; seed++) {
    const st = L.create({ board: "comet", seats: SEATS, seed });
    const rolls = [[], []];
    let guard = 0;
    while (st.phase !== "done" && guard++ < 400) {
      for (const e of L.autoTurn(st)) if (e.type === "roll") { rolls[e.seat].push(e.die); hist[e.seat][e.die]++; }
    }
    for (const r of rolls) for (let k = 0; k + 6 <= r.length; k += 6) {
      assert.deepEqual(r.slice(k, k + 6).sort(), [1, 2, 3, 4, 5, 6], `seed ${seed}: a bag of six is 1-6 once each`);
    }
  }
  for (let f = 1; f <= 6; f++) {
    const a = hist[0][f] / hist[0].reduce((x, y) => x + y), b = hist[1][f] / hist[1].reduce((x, y) => x + y);
    assert.ok(Math.abs(a - b) < 0.02, `face ${f}: Josh ${a.toFixed(3)} vs the computer ${b.toFixed(3)} — the dice are not the same for both`);
  }
});

test("NO-LOSE: a token only ever goes back on a comet, a comet drops at most one row and earns a star, overshoot is home, and no comets once anyone is home", () => {
  let comets = 0, overshoots = 0;
  for (const board of DATA.BOARDS.filter((b) => b.game === "dice")) {
    for (let seed = 1; seed <= 1500; seed++) {
      const st = L.create({ board: board.id, seats: SEATS, seed });
      const pos = [1, 1], stars = [0, 0];
      let guard = 0;
      while (st.phase !== "done" && guard++ < 400) {
        const homeBefore = st.seats.some((s) => s.home);
        for (const e of L.autoTurn(st)) {
          if (e.type === "roll" && pos[e.mover] + e.die > board.size) overshoots++;
          if (e.type === "hop") { assert.equal(e.to, Math.min(board.size, pos[e.seat] + 1)); pos[e.seat] = e.to; }
          if (e.type === "ride") {
            assert.equal(e.from, pos[e.seat], "a ride starts where the token is");
            if (e.kind === "comet") {
              comets++;
              assert.ok(!homeBefore, `${board.id} seed ${seed}: a comet after someone got home`);
              assert.ok(e.from - e.to <= board.cols, "a comet drops at most one row");
            } else assert.ok(e.to > e.from, "a booster goes up");
            pos[e.seat] = e.to;
            stars[e.seat] += 1;
            assert.equal(st.seats[e.seat].stars >= stars[e.seat], true);
          }
        }
      }
      assert.deepEqual(st.seats.map((s) => s.stars), stars, "every ride, up or down, earns exactly one star");
    }
  }
  assert.ok(comets > 1000, `fixture: comets really happen (${comets})`);
  assert.ok(overshoots > 500, `fixture: overshoot really happens (${overshoots}) — and every one of those games still ended`);
});

test("THE HELPER RULE: once a player is home, their turns move their friend, turns still alternate, and the game ends only when both are home", () => {
  let helped = 0;
  for (const board of DATA.BOARDS.map((b) => b.id)) {
    for (let seed = 1; seed <= 800; seed++) {
      const st = L.create({ board, seats: SEATS, seed });
      let last = null, guard = 0;
      while (st.phase !== "done" && guard++ < 400) {
        const t = st.turn;
        if (last !== null) assert.notEqual(t, last, "turns always alternate, even after someone is home");
        last = t;
        const ev = L.autoTurn(st);
        const moved = ev.filter((e) => e.type === "hop" || e.type === "card" || e.type === "pick").map((e) => (e.type === "card" ? e.mover : e.seat));
        const wasHome = st.seats[t].home && !ev.some((e) => e.type === "home" && e.seat === t);
        for (const m of moved) {
          // a player already home never moves their own token: their turn is their friend's
          if (wasHome) { assert.notEqual(m, t, "a home player's turn moved their own token"); helped++; }
        }
        const homeEv = ev.find((e) => e.type === "home");
        if (homeEv && st.phase !== "done") {
          assert.ok(ev.some((e) => e.type === "helper" && e.seat === homeEv.seat && e.helps !== homeEv.seat), "arriving first announces the helper");
        }
      }
      assert.equal(st.phase, "done");
    }
  }
  assert.ok(helped > 1000, `fixture: helper turns really happen (${helped})`);
  // directly: a home seat's turn moves the other token
  const st = L.create({ board: "moon", seats: SEATS, seed: 5 });
  st.seats[0].home = true; st.seats[0].pos = 36; st.turn = 0;
  const ev = L.autoTurn(st);
  assert.ok(ev.length && ev.filter((e) => e.type === "hop").every((e) => e.seat === 1), "Josh home: his roll hops River's rocket");
});

test("FIRST PLAYER: Josh starts (seat 0 by default), the other seat can start, and starting is an edge, never a lock-out", () => {
  for (const board of DATA.BOARDS.map((b) => b.id)) {
    let first0 = 0, firstOther = 0;
    const N = 2000;
    for (let seed = 1; seed <= N; seed++) {
      const a = play(board, seed);
      const firstMove = (g) => g.ev.find((e) => e.type === "roll" || e.type === "card" || e.type === "spin").seat;
      assert.equal(firstMove(a), 0, "seat 0 goes first by default");
      if (a.st.order[0] === 0) first0++;
      const b = play(board, seed, 1);
      assert.equal(firstMove(b), 1, "first: 1 starts the other seat");
      if (b.st.order[0] === 1) firstOther++;
    }
    for (const [k, n] of [["seat 0 starting", first0], ["seat 1 starting", firstOther]]) {
      assert.ok(n / N > 0.45 && n / N < 0.75, `${board}: the starter gets home first ${(100 * n / N).toFixed(0)}% of the time when ${k}`);
    }
  }
});

test("RAINBOW: no card, from any square, ever moves a token backwards, and a picture card behind you is still a move", () => {
  const b = DATA.board("rainbow");
  const cards = [
    ...DATA.COLOURS.map((c) => ({ kind: "one", c: c.id })),
    ...DATA.COLOURS.map((c) => ({ kind: "two", c: c.id })),
    ...b.landmarks.map((l) => ({ kind: "pic", at: l.at })),
  ];
  for (let from = 1; from < b.size; from++) {
    for (const card of cards) {
      const st = L.create({ board: "rainbow", seats: SEATS, seed: 3 });
      st.seats[0].pos = from;
      st.seats[0].bag = [card];
      const ev = L.drawCard(st);
      const mv = ev.find((e) => e.type === "card");
      assert.ok(mv.to > from, `card ${JSON.stringify(card)} from ${from} moved to ${mv.to}`);
      assert.deepEqual(mv.path, Array.from({ length: mv.to - from }, (_, k) => from + 1 + k), "the path is every square passed");
      if (card.kind === "one" && mv.to < b.size) assert.equal(L.colourAt(b, mv.to), card.c, "a colour card lands on its colour");
      if (card.kind === "pic" && card.at > from) assert.equal(mv.to, card.at, "a picture ahead zooms to it");
      // a zoom is a RIDE: it says so, and it earns a star (a booster's rule);
      // every other card is a plain move and earns nothing
      const zoom = card.kind === "pic" && card.at > from;
      assert.equal(mv.zoom, zoom, `card ${JSON.stringify(card)} from ${from}: zoom flag`);
      assert.equal(st.seats[0].stars, zoom ? 1 : 0, `card ${JSON.stringify(card)} from ${from}: a star exactly for a zoom`);
    }
  }
});

test("RESTORE: a saved game comes back exactly, and a broken one is dropped, never half-played", () => {
  for (const board of DATA.BOARDS.map((b) => b.id)) {
    const st = L.create({ board, seats: SEATS, seed: 11 });
    for (let k = 0; k < 5; k++) L.autoTurn(st);
    if (st.game === "dice") L.roll(st);
    if (st.game === "spin") L.spin(st);
    const snap = JSON.parse(JSON.stringify(L.snapshot(st)));
    const back = L.restore(snap);
    assert.deepEqual(back, st, `${board}: the round trip is exact`);
    // and it plays on identically
    const a = L.snapshot(st), b = L.restore(snap);
    let guard = 0;
    while (a.phase !== "done" && guard++ < 400) assert.deepEqual(L.autoTurn(a), L.autoTurn(b));
  }
  const good = L.snapshot(L.create({ board: "moon", seats: SEATS, seed: 2 }));
  const hostile = [
    null, 7, "x", {}, { ...good, v: 2 }, { ...good, board: "nope" }, { ...good, game: "cards" },
    { ...good, phase: "draw" }, { ...good, turn: 2 }, { ...good, mover: -1 }, { ...good, left: 9 },
    { ...good, rolls: -1 }, { ...good, order: "x" }, { ...good, seats: [good.seats[0]] },
    { ...good, seats: [{ ...good.seats[0], pos: 0 }, good.seats[1]] },
    { ...good, seats: [{ ...good.seats[0], pos: 37 }, good.seats[1]] },
    { ...good, seats: [{ ...good.seats[0], who: "nobody" }, good.seats[1]] },
    { ...good, seats: [{ ...good.seats[0], home: "yes" }, good.seats[1]] },
    { ...good, seats: [{ ...good.seats[0], bag: null }, good.seats[1]] },
    { ...good, seats: [{ ...good.seats[0], rng: 1.5 }, good.seats[1]] },
  ];
  for (const h of hostile) assert.equal(L.restore(h), null, `restore must refuse ${JSON.stringify(h).slice(0, 80)}`);
});

// The other half of "only a state this engine could write": EVERY state it
// does write must come back. restore() checks how the fields fit together
// (hops are left exactly while hopping; home is exactly the last square; the
// order names exactly the seats home; the game is over exactly when both
// are; the mover is the one moverFor names), so a law that is too strict
// would silently throw away a real game mid-play. Every board, many seeds,
// a snapshot after every single engine call.
test("RESTORE takes back EVERY state a real game passes through, and refuses each state no game can reach", () => {
  let snaps = 0;
  for (const board of DATA.BOARDS.map((b) => b.id)) {
    for (let seed = 1; seed <= 60; seed++) {
      const st = L.create({ board, seats: SEATS, seed, first: seed % 2, birds: seed % 3 === 0 });
      const check = () => {
        snaps++;
        const back = L.restore(JSON.parse(JSON.stringify(L.snapshot(st))));
        assert.ok(back, `${board} seed ${seed}: a real state was refused (phase ${st.phase}, left ${st.left}, order ${st.order})`);
        assert.deepEqual(back, st);
      };
      check();
      let guard = 0;
      while (st.phase !== "done" && guard++ < 500) {
        if (st.game === "cards") L.drawCard(st);
        else if (st.phase === "roll") L.roll(st);
        else if (st.phase === "spin") L.spin(st);
        else if (st.phase === "pick") L.pick(st);
        else L.hop(st);
        check();
      }
      assert.equal(st.phase, "done", `${board} seed ${seed} ends`);
    }
  }
  assert.ok(snaps > 5000, `the sweep must see thousands of states (saw ${snaps})`);

  // ...and each state no game reaches, one field at a time, from a REAL state
  const dice = L.create({ board: "moon", seats: SEATS, seed: 3 });
  L.roll(dice);                         // mid-hop, with hops left
  const card = L.create({ board: "rainbow", seats: SEATS, seed: 3 });
  for (let k = 0; k < 3; k++) L.drawCard(card);
  const g = (st) => JSON.parse(JSON.stringify(st));
  const seat = (st, i, o) => { const c = g(st); Object.assign(c.seats[i], o); return c; };
  const bad = [
    ["a hop turn with no hops left (stuck for good)", { ...g(dice), left: 0 }],
    ["a roll turn with hops left", { ...g(dice), phase: "roll" }],
    ["more hops left than the die", { ...g(dice), die: 1, left: 2 }],
    ["a die that is no face", { ...g(dice), die: 7 }],
    ["a die bag with a 7", seat(dice, 0, { bag: [7] })],
    ["a die bag with a face twice", seat(dice, 0, { bag: [2, 2] })],
    ["a die bag that is not numbers", seat(dice, 0, { bag: ["x"] })],
    ["a card bag with junk", seat(card, 0, { bag: [null] })],
    ["a card of no colour", seat(card, 0, { bag: [{ kind: "one", c: "plaid" }] })],
    ["a picture card of no landmark", seat(card, 0, { bag: [{ kind: "pic", at: 1 }] })],
    ["a shown card that is junk", { ...g(card), card: { kind: "zap" } }],
    ["home without standing on the last square", seat(card, 0, { home: true })],
    ["on the last square but not home", seat(card, 0, { pos: DATA.board("rainbow").size })],
    ["an order naming a seat not home", { ...g(card), order: [0] }],
    ["over with nobody home", { ...g(card), phase: "done" }],
    ["a mover moverFor would not name", { ...g(card), mover: 1 - g(card).mover }],
    ["a cpu flag that is not a boolean", seat(card, 1, { cpu: "yes" })],
    ["a track token below square 1", seat(card, 0, { pos: 0 })],
  ];
  const apple = L.create({ board: "apple", seats: SEATS, seed: 3, birds: true });
  L.spin(apple);                        // mid-pick, with apples left
  bad.push(
    ["a pick turn with no apples left", { ...g(apple), left: 0 }],
    ["a spin turn with apples left", { ...g(apple), phase: "spin" }],
    ["a pie that is not a count", { ...g(apple), pie: -1 }],
    ["a birds flag that is not a boolean", { ...g(apple), birds: "yes" }],
    ["a basket with eleven apples", seat(apple, 0, { pos: 11 })],
    ["a spin face the spinner does not have", { ...g(apple), die: 6, left: 1 }],
    ["a spinner bag with a 5", seat(apple, 0, { bag: [5] })],
    ["a bird flag that is not a boolean", seat(apple, 0, { bird: 1 })],
    // birds off, so a bird in the bag is one the rules refuse — and a bag of
    // nothing else would let spin() hand it out after its guard ran out
    ["a bird in the bag when birds are off", { ...seat(apple, 0, { bag: [0] }), birds: false }],
    ["two birds in one bag", { ...seat(apple, 0, { bag: [0, 1, 0] }), birds: true }],
  );
  assert.ok(L.restore(g(dice)) && L.restore(g(card)) && L.restore(g(apple)), "the real states restore (or the refusals prove nothing)");
  // the control: ONE bird in a bag is a real state when birds are on
  assert.ok(L.restore({ ...seat(apple, 0, { bag: [3, 0, 1] }), birds: true }), "one 🐦 in a bag, birds on, restores");
  for (const [why, h] of bad) assert.equal(L.restore(h), null, `restore must refuse ${why}`);
});

test("a tap that is not a move does nothing: no hop before a roll, no second roll, no hop past the dice, no draw in a dice game", () => {
  const st = L.create({ board: "moon", seats: SEATS, seed: 9 });
  assert.deepEqual(L.hop(st), [], "no hop before the roll");
  assert.deepEqual(L.drawCard(st), [], "no card in a dice game");
  const r = L.roll(st);
  assert.equal(r.length, 1);
  assert.deepEqual(L.roll(st), [], "no second roll while hopping");
  const die = st.die;
  let hops = 0;
  for (let k = 0; k < 10; k++) hops += L.hop(st).filter((e) => e.type === "hop").length;
  assert.ok(hops <= die, `${hops} hops on a ${die}`);
  const c = L.create({ board: "rainbow", seats: SEATS, seed: 9 });
  assert.deepEqual(L.roll(c), [], "no dice in a card game");
  assert.deepEqual(L.hop(c), [], "no hop in a card game");
});

test("the WORDS: every line has a speaker's words (no picture), and none of them is a race's word for the one behind", () => {
  for (const [k, line] of Object.entries(DATA.SAY)) {
    assert.ok(typeof line === "string" && line.length > 1, `${k} has a line`);
    assert.ok(!/\p{Extended_Pictographic}/u.test(line), `${k}: a voice reads a picture as silence ("${line}")`);
    assert.ok(!/\b(lose|lost|loser|losing|beat|beats|winner|second place|last place|1st|2nd)\b/i.test(line),
      `${k}: "${line}" is a word a four-year-old hears as losing`);
  }
  for (const p of [DATA.JOSH, ...DATA.PEOPLE]) assert.ok(!/\p{Extended_Pictographic}/u.test(p.say), `${p.id}'s spoken name is words`);
  for (const c of DATA.COLOURS) assert.ok(/^[a-z]+$/.test(c.name) && /^[a-z]+$/.test(c.shape), `${c.id} is said as words`);
});

// ---- 🍎 Apple Spin -----------------------------------------------------------
const playApple = (seed, birds, first) => {
  const st = L.create({ board: "apple", seats: SEATS, seed, birds, first });
  const ev = [];
  let turns = 0;
  while (st.phase !== "done" && turns < 400) { ev.push(...L.autoTurn(st)); turns++; }
  return { st, ev, turns };
};

test("🍎 FAIR SPINNER: each player's spins come from their own bag of the spinner's faces, the computer's too", () => {
  const faces = DATA.board("apple").spinner.slice().sort();
  for (let seed = 1; seed <= 300; seed++) {
    const { ev } = playApple(seed, false);
    for (const seat of [0, 1]) {
      const mine = ev.filter((e) => e.type === "spin" && e.seat === seat).map((e) => e.face);
      for (let k = 0; k + faces.length <= mine.length; k += faces.length) {
        assert.deepEqual(mine.slice(k, k + faces.length).sort(), faces, `seed ${seed} seat ${seat}: a bag is every face once`);
      }
    }
    assert.ok(ev.every((e) => e.type !== "spin" || e.face > 0), "no 🐦 until the birds are on");
  }
});

test("🍎 THE BASKET: one tap, one apple; a basket holds exactly ten; a full basket's spare apples go into the PIE", () => {
  let pies = 0;
  for (let seed = 1; seed <= 2000; seed++) {
    const { st, ev } = playApple(seed, seed % 2 === 0);
    assert.equal(st.phase, "done");
    assert.ok(st.seats.every((s) => s.pos === 10 && s.home), `seed ${seed}: both baskets are full`);
    // every pick adds ONE apple, and a basket never passes ten
    const count = [0, 0];
    let pie = 0;
    for (const e of ev) {
      if (e.type === "pick") { assert.equal(e.to, count[e.seat] + 1, "one tap, one apple"); count[e.seat] = e.to; assert.ok(e.to <= 10); }
      if (e.type === "bird") { assert.equal(e.to, count[e.seat] - 1, "a bird puts back ONE"); count[e.seat] = e.to; }
      if (e.type === "pie") { assert.ok(e.n > 0 && e.n <= 3, "a pie gets the spare apples of one spin"); pie += e.n; pies++; }
    }
    assert.equal(st.pie, pie, "the pie holds exactly the spare apples");
    // nothing is lost: every apple spun is in a basket or the pie, less the birds
    const spun = ev.filter((e) => e.type === "spin").reduce((a, e) => a + e.face, 0);
    const birds = ev.filter((e) => e.type === "bird").length;
    assert.equal(spun, 20 + st.pie + birds, `seed ${seed}: every apple spun is in a basket or the pie`);
  }
  assert.ok(pies > 500, `fixture: spare apples really reach the pie (${pies})`);
});

test("🍎 THE BIRD is gentle: never on a player's two spins running, never from an empty basket, never once a basket is full", () => {
  let birds = 0;
  for (let seed = 1; seed <= 2000; seed++) {
    const st = L.create({ board: "apple", seats: SEATS, seed, birds: true });
    const last = [false, false];
    let guard = 0;
    while (st.phase !== "done" && guard++ < 400) {
      const t = st.turn, mover = L.moverFor(st, t);
      const before = st.seats[mover].pos, anyFull = st.seats.some((s) => s.home);
      const ev = L.autoTurn(st);
      const spin = ev.find((e) => e.type === "spin");
      const bird = spin.face === 0;
      if (bird) {
        birds++;
        assert.ok(!last[t], `seed ${seed}: the bird came on two spins running`);
        assert.ok(before > 0, `seed ${seed}: the bird took from an empty basket`);
        assert.ok(!anyFull, `seed ${seed}: the bird came after a basket was full`);
      }
      last[t] = bird;
    }
    assert.equal(st.phase, "done", `seed ${seed} ends with the birds on`);
  }
  assert.ok(birds > 1000, `fixture: the bird really comes (${birds})`);
  // The bag holds ONE bird, so in play a bird twice running needs it last in
  // one bag and first in the next — rare enough that the sweep above cannot
  // feel the rule. Driven directly: a bird that may not come waits at the
  // BACK of the bag (it is never thrown away), and the next face comes now.
  const d = L.create({ board: "apple", seats: SEATS, seed: 2, birds: true });
  d.seats[0].pos = 5; d.seats[0].bird = true; d.seats[0].bag = [0, 3];
  const ev = L.spin(d);
  assert.equal(ev[0].face, 3, "the bird never comes on a player's two spins running");
  assert.deepEqual(d.seats[0].bag, [0], "…it waits at the back of the bag instead");
  // a refused bird that was the LAST in its bag is not carried: the fresh bag
  // has its own, and carrying it too would put two birds in one bag
  for (let seed = 1; seed <= 40; seed++) {
    const f = L.create({ board: "apple", seats: SEATS, seed, birds: true });
    f.seats[0].pos = 5; f.seats[0].bird = true; f.seats[0].bag = [0];
    assert.ok(L.spin(f)[0].face > 0, `seed ${seed}: the refused bird does not come`);
    assert.ok(f.seats[0].bag.filter((n) => n === 0).length <= 1, `seed ${seed}: never two birds in one bag (${f.seats[0].bag})`);
  }
  const e = L.create({ board: "apple", seats: SEATS, seed: 2, birds: true });
  e.seats[0].bag = [0, 2];
  assert.equal(L.spin(e)[0].face, 2, "the bird never comes to an empty basket");
  // the box turns the birds on from his THIRD Apple game, exactly as comets
  assert.equal(DATA.box("apple").birdsAfter, 2, "the 🐦 joins from his third Apple game");
});

test("🍎 a tap that is not a move does nothing: no pick before a spin, no second spin, no pick past the spin", () => {
  const st = L.create({ board: "apple", seats: SEATS, seed: 4 });
  assert.deepEqual(L.pick(st), [], "no pick before the spin");
  assert.deepEqual(L.roll(st), [], "no dice in Apple Spin");
  assert.deepEqual(L.drawCard(st), [], "no cards in Apple Spin");
  assert.equal(L.spin(st).length, 1);
  assert.deepEqual(L.spin(st), [], "no second spin while picking");
  const face = st.die;
  let picks = 0;
  for (let k = 0; k < 10; k++) picks += L.pick(st).filter((e) => e.type === "pick").length;
  assert.equal(picks, face, `${picks} picks on a ${face}`);
  const m = L.create({ board: "moon", seats: SEATS, seed: 4 });
  assert.deepEqual(L.spin(m), [], "no spinner in a dice game");
});
