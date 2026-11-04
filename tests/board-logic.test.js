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
    else if (board.game === "lotto") assert.equal(board.size, board.spots, `${board.id}: a seat is done when its blanket's ${board.spots} spots are full`);
    else if (board.game === "spot") assert.equal(board.size, board.deck.length - 1, `${board.id}: every card but the first is found`);
    else if (board.game === "pairs") assert.equal(board.size, board.pairsPer * 2 + 1, `${board.id}: a board is its pairs and one star`);
    else if (board.game === "doors") assert.equal(board.size, 6, `${board.id}: six doors a player`);
    else assert.equal(board.size, board.cols * board.rows, `${board.id} fills its grid exactly`);
    assert.ok(["dice", "cards", "spin", "hen", "lotto", "spot", "pairs", "doors"].indexOf(board.game) >= 0, `${board.id} is a dice, card, spinner, farm, lotto, spot, pairs or doors game`);
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
    const turns = [], secs = [];
    for (let seed = 1; seed <= 3000; seed++) {
      const g = play(board.id, seed);
      assert.equal(g.st.phase, "done", `${board.id} seed ${seed} never ended`);
      // (👀 Twin Spot's seats share the twelve twins between their piles)
      if (board.game === "pairs") assert.ok(g.st.seats.every((s) => s.home) && g.st.seats[0].pos + g.st.seats[1].pos === board.boards * board.pairsPer, `${board.id} seed ${seed}: every pair found`);
      else if (board.game === "spot") assert.ok(g.st.seats.every((s) => s.home) && g.st.seats[0].pos + g.st.seats[1].pos === board.size, `${board.id} seed ${seed}: every twin found`);
      else assert.ok(g.st.seats.every((s) => s.home && s.pos === board.size), `${board.id} seed ${seed}: everyone is home`);
      assert.equal(g.ev.filter((e) => e.type === "end").length, 1, "one ending");
      assert.equal(g.st.order.length, 2, "both arrivals are recorded");
      turns.push(g.turns);
      // the time it plays for, at the shell's own pace: a turn's tumble, the
      // computer's thinking and the hand-over (~2.3s), each tap (~0.5s) and
      // each ride or star (~1s). TURNS alone measured the wrong thing once a
      // board's turns got short: 💯 Hundred Hop takes twice Moon Race's turns
      // and has FEWER taps, because a ten is one tap.
      // (a lotto turn is two taps: the basket, then whose it is)
      const taps = g.ev.filter((e) => e.type === "hop" || e.type === "pick" || e.type === "card" || e.type === "draw" || e.type === "give" || e.type === "flip" || e.type === "found" || e.type === "peek" || (e.type === "roll" && board.game === "doors") || e.type === "shut").length;
      // (🧠 a pair or a star glows a moment; a miss stays up to be LOOKED at)
      const extras = g.ev.filter((e) => e.type === "ride" || e.type === "tens" || e.type === "pair" || e.type === "star").length +
        1.5 * g.ev.filter((e) => e.type === "nopair" || e.type === "stuck").length;
      secs.push(g.turns * 2.3 + taps * 0.5 + extras);
    }
    turns.sort((a, b) => a - b);
    secs.sort((a, b) => a - b);
    const q = (a, f) => a[Math.min(a.length - 1, Math.floor(a.length * f))];
    // A minute or two of play (a few minutes at a child's pace), and never a
    // slog: the long tail is short too.
    assert.ok(q(secs, 0.5) >= 30 && q(secs, 0.5) <= 120, `${board.id}: a median game plays ${Math.round(q(secs, 0.5))}s`);
    assert.ok(q(secs, 0.95) <= 140, `${board.id}: p95 ${Math.round(q(secs, 0.95))}s — a game can drag`);
    assert.ok(secs[secs.length - 1] <= 160, `${board.id}: the longest game plays ${Math.round(secs[secs.length - 1])}s`);
    // and a track board is still a handful of turns each, not a marathon
    // (🧠 a memory turn can find pair after pair, so it has fewer, longer turns)
    // (🚪 every turn shuts a door or two, so six doors each is a short race)
    assert.ok(q(turns, 0.5) >= (board.game === "pairs" ? 5 : board.game === "spin" || board.game === "doors" ? 8 : 12), `${board.id}: median ${q(turns, 0.5)} turns in all`);
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
          if (e.type === "hop") { assert.equal(e.to, Math.min(board.size, pos[e.seat] + (e.ten ? L.TEN : 1))); pos[e.seat] = e.to; }
          // 💯 a turn ending on a tens square earns a star (never the hundred)
          if (e.type === "tens") { assert.ok(e.at % 10 === 0 && e.at < board.size && e.at === pos[e.seat]); stars[e.seat] += 1; }
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
      assert.deepEqual(st.seats.map((s) => s.stars), stars, "every ride, up or down, and every tens square earns exactly one star");
    }
  }
  assert.ok(comets > 1000, `fixture: comets really happen (${comets})`);
  assert.ok(overshoots > 500, `fixture: overshoot really happens (${overshoots}) — and every one of those games still ended`);
});

test("THE HELPER RULE: once a player is home, their turns move their friend, turns still alternate, and the game ends only when both are home", () => {
  let helped = 0;
  // (a co-op board has no race to help in: both players walk ONE hen home)
  for (const board of DATA.BOARDS.filter((b) => !b.coop).map((b) => b.id)) {
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
  for (const board of DATA.BOARDS.filter((b) => !b.coop).map((b) => b.id)) {
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

test("RAINBOW: only a picture card BEHIND you moves a token back — straight to its picture, early in the game, never once anyone is home", () => {
  const b = DATA.board("rainbow");
  const cards = [
    ...DATA.COLOURS.map((c) => ({ kind: "one", c: c.id })),
    ...DATA.COLOURS.map((c) => ({ kind: "two", c: c.id })),
    ...b.landmarks.map((l) => ({ kind: "pic", at: l.at })),
  ];
  // the three moments a picture card can come: a fresh game (slides on), late
  // in the game (past BACK_CAP cards), and once the friend is home (helper)
  const moments = [
    ["early", () => {}, true],
    ["late", (st) => { st.rolls = L.BACK_CAP; }, false],
    ["friend home", (st) => { st.seats[1].pos = b.size; st.seats[1].home = true; st.order = [1]; }, false],
  ];
  let backs = 0;
  for (const [when, set, slidesOn] of moments) {
    for (let from = 1; from < b.size; from++) {
      for (const card of cards) {
        const st = L.create({ board: "rainbow", seats: SEATS, seed: 3 });
        set(st);
        st.seats[0].pos = from;
        st.seats[0].bag = [card];
        const ev = L.drawCard(st);
        const mv = ev.find((e) => e.type === "card");
        const tag = `${when}: card ${JSON.stringify(card)} from ${from}`;
        const back = slidesOn && card.kind === "pic" && card.at < from;
        assert.equal(!!mv.back, back, `${tag}: back flag`);
        if (back) {
          backs++;
          // Candy Land: ALL the way back to the picture, however far
          assert.equal(mv.to, card.at, `${tag}: a picture behind sends him back to it`);
          assert.deepEqual(mv.path, Array.from({ length: from - mv.to }, (_, k) => from - 1 - k), `${tag}: the path is every square passed, going back`);
        } else {
          assert.ok(mv.to > from, `${tag}: moved to ${mv.to}`);
          assert.deepEqual(mv.path, Array.from({ length: mv.to - from }, (_, k) => from + 1 + k), `${tag}: the path is every square passed`);
        }
        if (card.kind === "one" && mv.to < b.size) assert.equal(L.colourAt(b, mv.to), card.c, "a colour card lands on its colour");
        if (card.kind === "pic" && card.at > from) assert.equal(mv.to, card.at, "a picture ahead zooms to it");
        // a zoom is a RIDE: it says so, and it earns a star (a booster's rule);
        // a slide back is not a ride, and every other card is a plain move
        const zoom = card.kind === "pic" && card.at > from;
        assert.equal(mv.zoom, zoom, `${tag}: zoom flag`);
        assert.equal(st.seats[0].stars, zoom ? 1 : 0, `${tag}: a star exactly for a zoom`);
      }
    }
  }
  // not vacuous: the slide back really happens, from the whole back half
  assert.ok(backs > 40, `only ${backs} slides back were played`);
  // and it happens in real play, not only from a fixture
  let real = 0;
  for (let seed = 1; seed <= 300; seed++) real += play("rainbow", seed).ev.filter((e) => e.type === "card" && e.back).length;
  assert.ok(real / 300 > 0.4, `a picture behind sends him back ${(real / 300).toFixed(2)} times a game`);
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
        else if (st.game === "lotto") { if (st.phase === "draw") L.takeFood(st); else L.giveFood(st, L.ownerOf(st, st.food)); }
        else if (st.game === "spot") { if (st.phase === "flip") L.flipSpot(st); else L.findSpot(st, L.twinOf(DATA.board("spot"), st.centre, st.hand)); }
        else if (st.game === "pairs") L.peekPair(st, L.pairChoice(st));
        else if (st.game === "doors") {
          if (st.phase === "roll") L.roll(st);
          else { const w = L.doorWays(st).find((x) => st.held == null || x[0] === st.held); L.shutDoor(st, st.held == null ? w[0] : w[1]); }
        }
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

test("💯 HUNDRED HOP: a real hundred chart (the square below is TEN MORE), a ten is ONE tap straight down, a ⭐ on every tens square, a fair die of 1, 2, 3 and three tens", () => {
  const b = DATA.board("hundred");
  assert.equal(b.size, 100);
  assert.equal(b.layout, "chart");
  // the chart reads like a book: 1 at the top left, 10 at the top right, 11
  // under 1, 100 at the bottom right — and every square below is ten more
  const top = b.rows - 1;
  assert.deepEqual(L.cellOf(b, 1), { col: 0, row: top });
  assert.deepEqual(L.cellOf(b, 10), { col: 9, row: top });
  assert.deepEqual(L.cellOf(b, 11), { col: 0, row: top - 1 });
  assert.deepEqual(L.cellOf(b, 100), { col: 9, row: 0 });
  for (let n = 1; n <= 90; n++) {
    const a = L.cellOf(b, n), c = L.cellOf(b, n + 10);
    assert.ok(c.col === a.col && c.row === a.row - 1, `${n + 10} sits straight below ${n}`);
  }
  // the die: three small numbers to count and three tens to slide
  assert.deepEqual(L.facesOf(b).slice().sort((x, y) => x - y), [1, 2, 3, 10, 10, 10]);
  let tens = 0, stars = 0;
  for (let seed = 1; seed <= 600; seed++) {
    const st = L.create({ board: "hundred", seats: SEATS, seed });
    const rolls = [[], []];
    const pos = [1, 1];
    let guard = 0;
    while (st.phase !== "done" && guard++ < 400) {
      const ev = L.roll(st);
      if (!ev.length) break;
      rolls[ev[0].seat].push(ev[0].die);
      const die = ev[0].die, mover = ev[0].mover, from = st.seats[mover].pos;
      // a ten is ONE tap: one hop event, ten squares, straight down
      assert.equal(st.left, die === 10 ? 1 : die, "a face is its count of taps (a ten is one)");
      const hops = [];
      while (st.phase === "hop") {
        const h = L.hop(st);
        hops.push(...h.filter((e) => e.type === "hop"));
        for (const e of h) if (e.type === "tens") { stars++; assert.ok(e.at % 10 === 0 && e.at < 100); }
      }
      if (die === 10) {
        tens++;
        assert.equal(hops.length, 1, "a ten is one hop");
        assert.ok(hops[0].ten && hops[0].to === Math.min(100, from + 10), "ten more");
      } else assert.ok(hops.every((h) => !h.ten), "a small number hops one at a time");
      pos[mover] = st.seats[mover].pos;
    }
    assert.equal(st.phase, "done", `seed ${seed} ended`);
    // every six rolls of a player are the die's six faces
    for (const r of rolls) for (let k = 0; k + 6 <= r.length; k += 6) assert.deepEqual(r.slice(k, k + 6).sort((x, y) => x - y), [1, 2, 3, 10, 10, 10]);
    // the stars on the seats are exactly the tens squares they ended on
  }
  assert.ok(tens > 5000 && stars > 1000, `fixture: tens and tens-stars really happen (${tens}, ${stars})`);
  // a turn ending ON a tens square earns a star; passing one does not
  const st = L.create({ board: "hundred", seats: SEATS, seed: 3 });
  st.seats[0].pos = 18; st.seats[0].bag = [2];
  L.roll(st); L.hop(st); const ev = L.hop(st);
  assert.ok(ev.some((e) => e.type === "tens" && e.at === 20) && st.seats[0].stars === 1, "18 + 2 = 20: a star");
  const st2 = L.create({ board: "hundred", seats: SEATS, seed: 3 });
  st2.seats[0].pos = 19; st2.seats[0].bag = [2];
  L.roll(st2); L.hop(st2); const ev2 = L.hop(st2);
  assert.ok(!ev2.some((e) => e.type === "tens") && st2.seats[0].stars === 0, "19 + 2 = 21 passes 20: no star");
  // ten more from 95 is home (overshoot is home), with no star for 100
  const st3 = L.create({ board: "hundred", seats: SEATS, seed: 3 });
  st3.seats[0].pos = 95; st3.seats[0].bag = [10];
  L.roll(st3); const ev3 = L.hop(st3);
  assert.ok(st3.seats[0].home && st3.seats[0].pos === 100 && !ev3.some((e) => e.type === "tens"), "95 + 10 is home, and home is no tens star");
  // a restored save must be a die this board has
  const g = L.snapshot(L.create({ board: "hundred", seats: SEATS, seed: 4 }));
  assert.ok(L.restore(g), "the real state restores");
  const mid = L.create({ board: "hundred", seats: SEATS, seed: 4 }); mid.seats[0].bag = [10]; L.roll(mid);
  assert.ok(L.restore(L.snapshot(mid)), "mid-ten restores (one tap left)");
  assert.equal(L.restore({ ...L.snapshot(mid), left: 10 }), null, "a ten never has ten taps left");
  assert.equal(L.restore({ ...g, phase: "hop", die: 4, left: 4 }), null, "a 4 is not on this die");
  assert.equal(L.restore({ ...g, seats: g.seats.map((s, i) => (i ? s : { ...s, bag: [10, 10, 10, 10] })) }), null, "a bag with four tens is not one bag of this die");
  assert.ok(L.restore({ ...g, seats: g.seats.map((s, i) => (i ? s : { ...s, bag: [10, 3, 10] })) }), "what is left of a real bag restores");
});

test("🐔 HEN HOUSE: the farm's laws, one hen for both, every square walked is ONE chick home, the fox only ever sends a chick out to PLAY, and every game ends with all 35 home", () => {
  const b = DATA.board("hen");
  assert.ok(b.coop, "Hen House is a co-op board");
  assert.equal(b.animals.length, b.size - 2, "one animal on every square between the field and the hen house");
  const ids = DATA.ANIMALS.map((a) => a.id);
  for (let i = 0; i < b.animals.length; i++) {
    assert.ok(ids.indexOf(b.animals[i]) >= 0, `square ${i + 2} has a real animal`);
    if (i) assert.notEqual(b.animals[i], b.animals[i - 1], `squares ${i + 1} and ${i + 2} are not the same animal`);
    if (i > 2) assert.ok(!(b.animals[i] === b.animals[i - 2] && b.animals[i - 1] === b.animals[i - 3]), `no ABAB at square ${i + 2}`);
  }
  for (const a of ids) {
    const n = b.animals.split(a).length - 1;
    assert.ok(n >= 8 && n <= 9, `${a} appears ${n} times`);
    // every animal is close ahead of every square, so no spin is a long walk
    // (near the end, an animal with none left walks to the hen house)
    for (let from = 1; from < b.size; from++) assert.ok(L.nextAnimal(b, from, a) - from <= 6, `from ${from} the next ${a} is ${L.nextAnimal(b, from, a) - from} away`);
  }
  for (const a of DATA.ANIMALS) assert.ok(a.pic && /^[a-z]+$/.test(a.say), `${a.id} has a picture and a spoken name`);
  assert.equal(DATA.box("hen").foxAfter, 2, "the fox joins from his THIRD Hen House game");
  let foxes = 0, refused = 0, snaps = 0;
  const turns = [];
  for (const fox of [false, true]) {
    for (let seed = 1; seed <= 1200; seed++) {
      const st = L.create({ board: "hen", seats: SEATS, seed, first: seed % 2, fox });
      let guard = 0, last = null;
      const spins = [[], []];
      assert.equal(st.turn, seed % 2, "either seat can start");
      while (st.phase !== "done" && guard++ < 200) {
        const t = st.turn;
        if (last !== null) assert.notEqual(t, last, "turns alternate");
        last = t;
        const pos0 = st.seats[0].pos, coop0 = st.coop;
        const ev = L.spin(st);
        const face = ev[0].face;
        spins[t].push(face);
        if (face === L.FOX) {
          foxes++;
          assert.ok(fox, "no fox unless the fox is on");
          assert.ok(coop0 > 0, "the fox never comes before a chick is home");
          assert.equal(st.coop, coop0 - 1, "one chick runs out to play");
          assert.ok(spins[t].length < 2 || spins[t][spins[t].length - 2] !== L.FOX, "never the fox on a player's two spins running");
          assert.ok(pos0 <= b.size - b.cols, "never in the last row");
        } else {
          // the hen walks to the next square of that animal, one chick a tap
          assert.equal(ev[0].to, L.nextAnimal(b, pos0, face));
          let k = 0;
          while (st.phase === "hop") {
            const h = L.hop(st).filter((e) => e.type === "hop");
            k++;
            assert.equal(h.length, 1, "one tap, one step");
            assert.equal(h[0].to, pos0 + k, "one square a tap");
          }
          assert.equal(st.seats[0].pos, ev[0].to, "she stops on that animal");
          assert.ok(st.coop >= coop0 + k || st.phase === "done", "every square walked is one chick home");
        }
        assert.equal(st.seats[0].pos, st.seats[1].pos, "ONE hen for both");
        snaps++;
        assert.deepEqual(L.restore(JSON.parse(JSON.stringify(L.snapshot(st)))), st, "every state restores exactly");
      }
      assert.equal(st.phase, "done", `seed ${seed} ends`);
      assert.equal(st.coop, b.size - 1, "every game ends with all 35 chicks home — the fox's playmates too");
      assert.equal(st.out, 0, "nobody is left out playing");
      assert.ok(st.seats.every((s) => s.home), "both home together");
      turns.push(guard);
    }
  }
  assert.ok(foxes > 1000, `fixture: the fox really comes (${foxes})`);
  assert.ok(snaps > 10000, `fixture: the sweep saw ${snaps} states`);
  turns.sort((x, y) => x - y);
  assert.ok(turns[turns.length >> 1] >= 10 && turns[turns.length - 1] <= 30, `a game is a handful of spins (median ${turns[turns.length >> 1]}, longest ${turns[turns.length - 1]})`);
  // the computer's bag is the same as Josh's: every spin bag is the four
  // animals once each (and the fox, when on)
  const st = L.create({ board: "hen", seats: SEATS, seed: 7 });
  const faces = [];
  for (let k = 0; k < 8; k++) { faces.push(L.spin(st)[0].face); while (st.phase === "hop") L.hop(st); }
  assert.deepEqual(faces.filter((f, i) => i % 2 === 0).slice(0, 4).sort(), ids.slice().sort(), "Josh's four spins are the four animals once each");
  assert.deepEqual(faces.filter((f, i) => i % 2 === 1).slice(0, 4).sort(), ids.slice().sort(), "and so are the friend's");
  // a fox that may not come waits: directly, no chick home yet
  const f = L.create({ board: "hen", seats: SEATS, seed: 2, fox: true });
  f.seats[0].bag = [L.FOX, "C"];
  const ev = L.spin(f);
  assert.equal(ev[0].face, "C", "no fox before a chick is home: the cow comes instead");
  assert.ok(f.seats[0].bag.indexOf(L.FOX) >= 0, "and the fox waits in the bag");
  // states no game reaches
  const g = L.snapshot(L.create({ board: "hen", seats: SEATS, seed: 4, fox: true }));
  const bad = [
    ["two hens", { ...g, seats: [{ ...g.seats[0], pos: 3 }, g.seats[1]] }],
    ["a chick count that is not the squares walked", { ...g, coop: 4 }],
    ["chicks out playing with the fox off", { ...g, fox: false, out: 1, coop: -1 }],
    ["a fox in a fox-off bag", { ...g, fox: false, seats: [{ ...g.seats[0], bag: [L.FOX] }, g.seats[1]] }],
    ["a cow twice in one bag", { ...g, seats: [{ ...g.seats[0], bag: ["C", "C"] }, g.seats[1]] }],
    ["a face that is not an animal", { ...g, card: "Z" }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🧺 PICNIC LOTTO: two blankets of six foods that share none, every food in exactly one place, a wrong friend only wiggles, and every game ends with both blankets full", () => {
  const b = DATA.board("lotto");
  assert.ok(b.coop, "Picnic Lotto ends in one picnic for both");
  assert.equal(new Set(DATA.FOODS.map((f) => f.pic)).size, DATA.FOODS.length, "every food is a different picture");
  assert.ok(DATA.FOODS.length >= b.spots * 2, "enough foods for two blankets");
  for (const f of DATA.FOODS) assert.match(f.say, /^(a|an|some) [a-z ]+$/, `${f.id} is said as words`);
  let games = 0, firstFull = [0, 0], misses = 0;
  for (let seed = 1; seed <= 2000; seed++) {
    const st = L.create({ board: "lotto", seats: SEATS, seed, first: seed % 2 });
    const all = st.blankets[0].concat(st.blankets[1]);
    assert.equal(new Set(all).size, b.spots * 2, "the blankets share no food");
    assert.ok(all.every((f) => DATA.food(f)), "every spot is a real food");
    assert.deepEqual(st.basket.slice().sort(), all.slice().sort(), "the basket holds exactly the twelve foods");
    let guard = 0, last = null;
    while (st.phase !== "done" && guard++ < 100) {
      const t = st.turn;
      if (last !== null) assert.notEqual(t, last, "turns alternate");
      last = t;
      const left = st.basket.length;
      const d = L.takeFood(st);
      assert.equal(d[0].type, "draw");
      assert.equal(st.basket.length, left - 1, "one food comes out of the basket");
      const owner = L.ownerOf(st, st.food);
      // the wrong friend first, sometimes: it only wiggles
      if (seed % 3 === 0) {
        const m = L.giveFood(st, 1 - owner);
        assert.equal(m[0].type, "miss");
        misses++;
        assert.equal(st.phase, "give", "a wrong friend changes nothing: the food is still in hand");
        assert.equal(st.turn, t, "and it is still his turn");
        assert.equal(st.placed[1 - owner].indexOf(d[0].food), -1, "nothing is put on the wrong blanket");
      }
      const before = st.placed[owner].length;
      const g = L.giveFood(st, owner);
      assert.equal(g[0].type, "give");
      assert.equal(st.placed[owner].length, before + 1, "the right friend's blanket gets it");
      assert.equal(g[0].slot, st.blankets[owner].indexOf(d[0].food), "on its own spot");
      assert.deepEqual(L.restore(JSON.parse(JSON.stringify(L.snapshot(st)))), st, "every state restores exactly");
    }
    assert.equal(st.phase, "done", `seed ${seed} ends`);
    assert.equal(guard, b.spots * 2, "twelve foods, twelve turns");
    assert.ok(st.seats.every((s) => s.home && s.pos === b.spots), "both blankets are full");
    firstFull[st.order[0]]++;
    games++;
  }
  assert.ok(misses > 1000, `fixture: wrong friends really happen (${misses})`);
  // whose blanket fills first is luck, never a seat's edge
  for (const n of firstFull) assert.ok(n / games > 0.4 && n / games < 0.6, `a seat fills first ${(100 * n / games).toFixed(0)}% of the time`);
  // states no game reaches
  const st = L.create({ board: "lotto", seats: SEATS, seed: 4 });
  L.takeFood(st);
  const g = L.snapshot(st);
  const other = g.blankets[0].concat(g.blankets[1]).find((f) => f !== g.food);
  const bad = [
    ["a food on the wrong blanket", { ...g, placed: [[g.blankets[1][0]], []], seats: [{ ...g.seats[0], pos: 1 }, g.seats[1]] }],
    ["a food in two places", { ...g, basket: g.basket.concat([g.food]) }],
    ["a food lost", { ...g, basket: g.basket.slice(1) }],
    ["the blankets sharing a food", { ...g, blankets: [g.blankets[0], [g.blankets[0][0]].concat(g.blankets[1].slice(1))] }],
    ["a blanket count that is not its foods", { ...g, seats: [{ ...g.seats[0], pos: 2 }, g.seats[1]] }],
    ["no food in hand while giving", { ...g, food: null }],
    ["a food in hand while drawing", { ...g, phase: "draw", food: other }],
    ["a food that is not on the menu", { ...g, blankets: [["rock"].concat(g.blankets[0].slice(1)), g.blankets[1]] }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("👀 TWIN SPOT: any two cards share EXACTLY one picture, no picture twice on a card, a wrong picture only wiggles, after two the twin is known, and every game finds all twelve twins", () => {
  const b = DATA.board("spot");
  assert.equal(b.deck.length, 13, "thirteen cards");
  assert.equal(DATA.SPOTS.length, 13, "thirteen pictures");
  assert.equal(new Set(DATA.SPOTS.map((x) => x.pic)).size, 13, "every picture is different");
  for (const x of DATA.SPOTS) assert.match(x.say, /^the [a-z]+$/, `${x.id} is said as words`);
  for (let i = 0; i < 13; i++) {
    assert.equal(b.deck[i].length, 4, "four pictures a card");
    assert.equal(new Set(b.deck[i]).size, 4, `card ${i} shows no picture twice`);
    assert.ok(b.deck[i].every((p) => p >= 0 && p < 13), "every picture is real");
    for (let j = i + 1; j < 13; j++) {
      const both = b.deck[i].filter((p) => b.deck[j].indexOf(p) >= 0);
      assert.equal(both.length, 1, `cards ${i} and ${j} share exactly ONE picture (they share ${both.length})`);
      assert.equal(L.twinOf(b, i, j), both[0]);
    }
  }
  // every picture is on four cards (so no picture is the answer far more than another)
  for (let p = 0; p < 13; p++) assert.equal(b.deck.filter((c) => c.indexOf(p) >= 0).length, 4, `picture ${p} is on four cards`);
  let misses = 0;
  for (let seed = 1; seed <= 1500; seed++) {
    const st = L.create({ board: "spot", seats: SEATS, seed, first: seed % 2 });
    let guard = 0, last = null;
    while (st.phase !== "done" && guard++ < 40) {
      const t = st.turn;
      if (last !== null) assert.notEqual(t, last, "turns alternate");
      last = t;
      const f = L.flipSpot(st);
      assert.equal(f[0].type, "flip");
      const twin = L.twinOf(b, st.centre, st.hand), hand = st.hand;
      if (seed % 2) {
        const wrong = b.deck[hand].find((p) => p !== twin);
        const m = L.findSpot(st, wrong);
        assert.equal(m[0].type, "miss");
        misses++;
        assert.equal(st.phase, "find", "a wrong picture changes nothing");
        assert.equal(st.hand, hand, "the card is still in hand");
      }
      const g = L.findSpot(st, twin);
      assert.equal(g[0].type, "found");
      assert.equal(st.centre, hand, "the found card becomes the middle one");
      assert.deepEqual(L.restore(JSON.parse(JSON.stringify(L.snapshot(st)))), st, "every state restores exactly");
    }
    assert.equal(st.phase, "done", `seed ${seed} ends`);
    assert.equal(guard, 12, "twelve flips");
    assert.equal(st.seats[0].pos + st.seats[1].pos, 12, "all twelve twins found");
    assert.ok(st.seats.every((s) => s.home && s.stars === s.pos), "both home together, a star for every twin");
  }
  assert.ok(misses > 5000, `fixture: wrong pictures really happen (${misses})`);
  // states no game reaches
  const st = L.create({ board: "spot", seats: SEATS, seed: 4 });
  L.flipSpot(st);
  const g = L.snapshot(st);
  const bad = [
    ["a card in two places", { ...g, deck: g.deck.concat([g.centre]) }],
    ["a card lost", { ...g, deck: g.deck.slice(1) }],
    ["no card in hand while finding", { ...g, hand: null }],
    ["a pile that is not what was found", { ...g, seats: [{ ...g.seats[0], pos: 1, stars: 1 }, g.seats[1]] }],
    ["a card that does not exist", { ...g, hand: 13 }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🧠 PEEK-A-PAIR: each board is four pairs and a ⭐, a pair (or the star) goes again, a miss turns back and passes the turn, every state restores, and every game finds all eight pairs", () => {
  const b = DATA.board("pairs");
  assert.ok(DATA.PAIRS.length >= b.boards * b.pairsPer, "enough pictures for a whole game without a repeat");
  assert.equal(new Set(DATA.PAIRS.map((p) => p.pic)).size, DATA.PAIRS.length, "every picture is different");
  assert.equal(new Set(DATA.PAIRS.map((p) => p.id)).size, DATA.PAIRS.length, "every id is different");
  for (const p of DATA.PAIRS) assert.ok(/^[a-z ]+$/.test(p.say) && /^[a-z ]+$/.test(p.two), `${p.id} is said as words, one and two`);
  let misses = 0, goAgain = 0, stars = 0;
  for (let seed = 1; seed <= 1500; seed++) {
    const st = L.create({ board: "pairs", seats: SEATS, seed, first: seed % 2 });
    assert.equal(new Set(st.pics).size, b.boards * b.pairsPer, "a game never shows a picture on two boards");
    assert.equal(st.cards.filter((c) => c === L.STAR).length, 1, "one star a board");
    let guard = 0;
    while (st.phase !== "done" && guard++ < 400) {
      const t = st.turn, before = st.boardNo, k = L.pairChoice(st);
      assert.ok(k >= 0 && !st.gone[k] && st.open.indexOf(k) < 0, "the computer only ever turns a card that is face down");
      const firstUp = st.phase === "second" ? st.open[0] : -1;
      const ev = L.peekPair(st, k);
      assert.equal(ev[0].type, "peek");
      const pair = ev.find((e) => e.type === "pair"), miss = ev.find((e) => e.type === "nopair"), star = ev.find((e) => e.type === "star");
      if (miss) {
        misses++;
        assert.notEqual(st.cards[miss.a], st.cards[miss.b], "a miss is two DIFFERENT pictures");
        assert.ok(!st.gone[miss.a] && !st.gone[miss.b] && st.open.length === 0, "a miss turns both back over");
        assert.notEqual(st.turn, t, "a miss passes the turn");
      }
      if (pair) {
        goAgain++;
        assert.equal(pair.a, firstUp, "a pair is the card already up and this one");
        if (st.phase !== "done") assert.equal(st.turn, t, "a pair goes again");
        if (st.boardNo === before) assert.ok(st.gone[pair.a] && st.gone[pair.b], "a pair leaves the board");
      }
      if (star) { stars++; if (st.phase !== "done") assert.equal(st.turn, t, "the star goes again"); }
      if (!miss && !pair && !star) assert.deepEqual(st.open, [k], "a first card stays up");
      assert.deepEqual(L.restore(JSON.parse(JSON.stringify(L.snapshot(st)))), st, "every state restores exactly");
    }
    assert.equal(st.phase, "done", `seed ${seed} ends`);
    assert.equal(st.seats[0].pos + st.seats[1].pos, b.boards * b.pairsPer, "all eight pairs found");
    assert.equal(st.seats[0].stars + st.seats[1].stars, b.boards * (b.pairsPer + 1), "a star for every pair, and each board's ⭐");
    assert.ok(st.seats.every((s) => s.home), "both home together: one party");
  }
  assert.ok(misses > 5000 && goAgain > 5000 && stars === 3000, `fixture: misses, pairs and stars all happen (${misses}, ${goAgain}, ${stars})`);

  // A game of SKILL: a sharp memory finds more than the computer, which
  // forgets — and the computer is no pushover either
  const sharp = (st) => {
    const down = st.cards.map((c, k) => k).filter((k) => !st.gone[k] && st.open.indexOf(k) < 0);
    if (st.phase === "second") { const m = down.find((k) => st.cards[k] === st.cards[st.open[0]] && st.seen[k]); if (m != null) return m; }
    else for (const k of down) { if (st.cards[k] !== L.STAR && st.seen[k] && down.some((j) => j !== k && st.cards[j] === st.cards[k] && st.seen[j])) return k; }
    const fresh = down.filter((k) => !st.seen[k]);
    return (fresh.length ? fresh : down)[0];
  };
  const share = (josh) => {
    let a = 0, c = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const st = L.create({ board: "pairs", seats: SEATS, seed, first: seed % 2 });
      let g = 0;
      while (st.phase !== "done" && g++ < 400) L.peekPair(st, st.turn === 0 ? josh(st) : L.pairChoice(st));
      a += st.seats[0].pos; c += st.seats[1].pos;
    }
    return a / (a + c);
  };
  const even = share((st) => L.pairChoice(st)), sh = share(sharp);
  assert.ok(even > 0.42 && even < 0.58, `the same memory finds about half (${even.toFixed(3)})`);
  assert.ok(sh > 0.62, `remembering wins pairs: a sharp memory finds ${(100 * sh).toFixed(0)}% against the computer`);
  assert.ok(sh < 0.9, `but the computer still finds some (${(100 * sh).toFixed(0)}%)`);

  // a tap that is not a move does nothing
  const st = L.create({ board: "pairs", seats: SEATS, seed: 4 });
  const k0 = st.cards.findIndex((c) => c !== L.STAR);
  L.peekPair(st, k0);
  assert.deepEqual(L.peekPair(st, k0), [], "the card already up (the hammer's echo) does nothing");
  assert.deepEqual(L.peekPair(st, 99), [], "no such card");
  assert.deepEqual(L.flipSpot(st), [], "no other game's move");
  // states no game reaches
  const g = L.snapshot(st);
  const twin = g.cards.findIndex((c, k) => k !== k0 && c === g.cards[k0]);
  const other = g.cards.findIndex((c) => c !== g.cards[k0] && c !== L.STAR);
  const bad = [
    ["a picture three times", { ...g, cards: g.cards.map((c, k) => (k === other ? g.cards[k0] : c)) }],
    // (seen, so only the half-a-pair rule can refuse it)
    ["half a pair taken", { ...g, gone: g.gone.map((x, k) => k === twin), seen: g.seen.map((x, k) => x || k === twin) }],
    ["no card up while turning the second", { ...g, open: [] }],
    ["the star up as a first card", { ...g, open: [g.cards.indexOf(L.STAR)] }],
    ["a pile that was not found", { ...g, seats: [{ ...g.seats[0], pos: 1, stars: 1 }, g.seats[1]] }],
    ["a picture that does not exist", { ...g, pics: g.pics.map((p, k) => (k === 7 ? "unicorn" : p)) }],
    ["a board past the last", { ...g, boardNo: b.boards }],
    ["a card gone that was never seen", { ...g, open: [], phase: "flip", gone: g.gone.map((x, k) => k === twin || k === k0), seen: g.seen.map(() => false), seats: [{ ...g.seats[0], pos: 1, stars: 1 }, g.seats[1]] }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🚪 SHUT THE DOORS: a roll shuts its door or TWO that make it (a ⭐), a wrong door only wiggles, nothing fits means roll again, every turn shuts a door, and making two at once is the skill", () => {
  let twos = 0, misses = 0, stuck = 0;
  for (let seed = 1; seed <= 1500; seed++) {
    const st = L.create({ board: "doors", seats: SEATS, seed, first: seed % 2 });
    let guard = 0, last = null;
    while (st.phase !== "done" && guard++ < 60) {
      const t = st.turn;
      if (last !== null) assert.notEqual(t, last, "turns alternate");
      last = t;
      let r = 0;
      while (st.phase === "roll" && r++ < 20) {
        const ev = L.roll(st);
        if (ev.some((e) => e.type === "stuck")) {
          stuck++;
          assert.equal(L.doorWays(st).length, 0, "stuck only when no way makes the roll");
          assert.equal(st.turn, t, "nothing fits: the SAME player rolls again (never a lost turn)");
        }
      }
      assert.equal(st.phase, "shut", "a roll that fits comes within the bag");
      const m = st.mover, d = st.die, ways = L.doorWays(st), before = st.seats[m].shut.slice();
      for (const w of ways) assert.equal(w.reduce((a, b) => a + b, 0), d, "every way makes the roll");
      for (const w of ways) assert.ok(w.every((n) => before.indexOf(n) < 0), "every way uses open doors");
      // a door that cannot be part of a way only wiggles
      const wrong = [1, 2, 3, 4, 5, 6].find((n) => before.indexOf(n) < 0 && !ways.some((w) => w.indexOf(n) >= 0));
      if (wrong != null && seed % 2) {
        const e = L.shutDoor(st, wrong);
        assert.equal(e[0].type, "miss");
        misses++;
        assert.deepEqual(st.seats[m].shut, before, "a miss shuts nothing");
        assert.equal(st.phase, "shut", "and the roll still waits");
      }
      // the sharp play: two doors when it can
      const w = ways.find((x) => x.length === 2) || ways[0];
      const ev = [];
      for (const n of w) ev.push(...L.shutDoor(st, n));
      if (w.length === 2) { assert.equal(ev[0].type, "hold", "the first of two is held"); twos++; }
      const sh = ev.find((e) => e.type === "shut");
      assert.ok(sh && sh.doors.length === w.length, "the doors shut");
      assert.deepEqual(st.seats[m].shut.slice().sort(), before.concat(w).sort(), "exactly those doors are shut");
      assert.deepEqual(L.restore(JSON.parse(JSON.stringify(L.snapshot(st)))), st, "every state restores exactly");
    }
    assert.equal(st.phase, "done", `seed ${seed} ends`);
    assert.ok(st.seats.every((s) => s.home && s.shut.length === 6), "every door of both players shut: one party");
  }
  assert.ok(twos > 3000 && misses > 1000 && stuck > 1000, `fixture: two-door shuts, misses and roll-agains all happen (${twos}, ${misses}, ${stuck})`);
  // the SKILL: a player who makes two at once when he can beats the computer
  // (which picks any way) to all six doors more often than not
  const sharp = (st) => { const w = L.doorWays(st); return w.find((x) => x.length === 2) || w[0]; };
  let first = 0;
  const N = 2000;
  for (let seed = 1; seed <= N; seed++) {
    const st = L.create({ board: "doors", seats: SEATS, seed, first: seed % 2 });
    let g = 0;
    while (st.phase !== "done" && g++ < 60) {
      if (st.turn === 0 && !st.seats[0].home) {
        let r = 0;
        while (st.phase === "roll" && r++ < 20) L.roll(st);
        for (const n of sharp(st)) L.shutDoor(st, n);
      } else L.autoTurn(st);
    }
    if (st.order[0] === 0) first++;
  }
  assert.ok(first / N > 0.58, `making two doors at once wins: he shuts all six first ${(100 * first / N).toFixed(0)}% of the time`);
  // a tap that is not a move does nothing
  const st = L.create({ board: "doors", seats: SEATS, seed: 3 });
  assert.deepEqual(L.shutDoor(st, 1), [], "no door before the roll");
  let r = 0;
  while (st.phase === "roll" && r++ < 20) L.roll(st);
  const way = L.doorWays(st).find((x) => x.length === 2);
  if (way) {
    L.shutDoor(st, way[0]);
    assert.deepEqual(L.shutDoor(st, way[0]), [], "the door already held (the hammer's echo) does nothing");
  }
  assert.deepEqual(L.shutDoor(st, 9), [], "no such door");
  // states no game reaches
  const g = L.snapshot(st);
  const bad = [
    ["a door shut twice", { ...g, seats: [{ ...g.seats[0], shut: [1, 1], pos: 2 }, g.seats[1]] }],
    ["a door that does not exist", { ...g, seats: [{ ...g.seats[0], shut: [7], pos: 1 }, g.seats[1]] }],
    ["a count that is not the doors shut", { ...g, seats: [{ ...g.seats[0], pos: 3 }, g.seats[1]] }],
    ["a held door as big as the roll", { ...g, held: g.die }],
    ["a held door while rolling", { ...g, phase: "roll", held: 1 }],
    ["a shut turn with no way to make it", { ...g, held: null, seats: [{ ...g.seats[0], shut: [1, 2, 3, 4, 5], pos: 5 }, g.seats[1]].map((x, i) => (i === g.mover ? x : g.seats[i])), die: 2 }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});
