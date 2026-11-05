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
    // (a picture, or drawn art: no domino emoji is a picture on every phone)
    assert.ok(b.name && (b.pic || b.art === "domino") && b.colour, `${b.id} has a name, a picture and a colour`);
    if (b.unlockAfter) assert.ok(DATA.box(b.unlockAfter.box), `${b.id} unlocks after a real box`);
  }
  // the PICTURE is how a non-reader picks a box, so no two on the shelf share
  // one (🌈 Colour Match once stood beside 🌈 Rainbow Trail) — compared
  // without the VS16 that only decides how an emoji is drawn
  const pics = DATA.BOXES.filter((b) => b.pic).map((b) => b.pic.replace(/\uFE0F/g, ""));
  const twice = pics.filter((p, k) => pics.indexOf(p) !== k);
  assert.deepEqual(twice, [], "two boxes wear the same picture: " + twice.join(" "));
  for (const board of DATA.BOARDS) {
    // a track fills its grid exactly; Apple Spin's grid is only the shape of
    // its picture, and its size is the TEN-FRAME basket
    if (board.game === "spin") assert.equal(board.size, 10, `${board.id}: a basket is a ten-frame`);
    else if (board.game === "lotto") assert.equal(board.size, board.spots, `${board.id}: a seat is done when its blanket's ${board.spots} spots are full`);
    else if (board.game === "spot") assert.equal(board.size, board.deck.length - 1, `${board.id}: every card but the first is found`);
    else if (board.game === "pairs") assert.equal(board.size, board.pairsPer * 2 + 1, `${board.id}: a board is its pairs and one star`);
    else if (board.game === "doors") assert.equal(board.size, 6, `${board.id}: six doors a player`);
    else if (board.game === "acorns") assert.equal(board.size, 2 * board.pots * board.start, `${board.id}: every acorn of both sides`);
    else if (board.game === "dominoes") assert.equal(board.size, L.domSet(board).length, `${board.id}: every tile of the set`);
    else if (board.game === "dig") assert.equal(board.size, board.treasures, `${board.id}: a pile is the treasures found`);
    else if (board.game === "nim") assert.equal(board.size, board.jars.reduce((t, n) => t + n, 0), `${board.id}: every cookie of every jar`);
    else if (board.game === "top") assert.equal(board.size, board.deck, `${board.id}: at most every trick`);
    else if (board.game === "lines") assert.equal(board.size, board.boards * board.cols * board.rows / 2, `${board.id}: each player drops half of every board`);
    else if (board.game === "cmatch") assert.equal(board.size, board.rounds, `${board.id}: a ⭐ a round at most`);
    else if (board.game === "snow") assert.equal(board.size, L.SNOW_NEEDS.length - 1, `${board.id}: a snowman is its six parts`);
    else if (board.game === "fish") assert.equal(board.size, L.FISH_N, `${board.id}: every pair of pictures`);
    else if (board.game === "hilo") assert.equal(board.size, board.flips, `${board.id}: a ⭐ a card at most`);
    else if (board.game === "train") assert.equal(board.size, board.trains, `${board.id}: a ⭐ a train`);
    else assert.equal(board.size, board.cols * board.rows, `${board.id} fills its grid exactly`);
    assert.ok(["dice", "cards", "spin", "hen", "lotto", "spot", "pairs", "doors", "acorns", "dominoes", "dig", "nim", "lines", "top", "grab", "match3", "maze", "hide", "cmatch", "bingo", "snow", "fish", "ten", "hilo", "train"].indexOf(board.game) >= 0, `${board.id} is a dice, card, spinner, farm, lotto, spot, pairs, doors, acorns, dominoes, dig, nim, lines, top, grab, match3, maze, hide, cmatch, bingo, snow, fish, ten, hilo or train game`);
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
      else if (board.game === "dominoes") assert.ok(g.st.seats.every((s) => s.home) && g.st.seats[0].pos + g.st.seats[1].pos === g.st.line.length - 1 && [0, 1].every((i) => !g.st.hands[i].length || !g.st.hands[i].some((id) => L.domSides(g.st, id).length) && !g.st.pile.some((id) => L.domSides(g.st, id).length)), `${board.id} seed ${seed}: every tile laid, or none that can be`);
      else if (board.game === "dig") assert.ok(g.st.seats.every((s) => s.home) && g.st.found === board.treasures && g.st.seats[0].pos + g.st.seats[1].pos === board.treasures, `${board.id} seed ${seed}: every treasure found`);
      else if (board.game === "acorns") assert.ok(g.st.seats.every((s) => s.home) && g.st.seats[0].pos + g.st.seats[1].pos === board.size && g.st.pots.every((n, k) => k % 4 === 3 || n === 0), `${board.id} seed ${seed}: every acorn in a nest`);
      else if (board.game === "maze") assert.ok(g.st.seats.every((s) => s.home) && g.st.found === board.cheese && g.st.seats[0].stars + g.st.seats[1].stars === board.cheese, `${board.id} seed ${seed}: every cheese found`);
      else if (board.game === "train") assert.ok(g.st.seats.every((s) => s.home) && g.st.round === board.trains && g.st.seats[0].stars + g.st.seats[1].stars === board.trains, `${board.id} seed ${seed}: every train finished`);
      else if (board.game === "hilo") assert.ok(g.st.seats.every((s) => s.home) && g.st.flips === board.flips, `${board.id} seed ${seed}: every card turned`);
      else if (board.game === "ten") assert.ok(g.st.seats.every((s) => s.home) && g.st.made.length === 9 && g.st.flowers.every((x) => !x) && !g.st.deck.length, `${board.id} seed ${seed}: all nine tens made`);
      else if (board.game === "fish") assert.ok(g.st.seats.every((s) => s.home) && g.st.pairs[0].length + g.st.pairs[1].length === L.FISH_N && g.st.hands.every((h) => !h.length), `${board.id} seed ${seed}: every pair made`);
      else if (board.game === "snow") assert.ok(g.st.seats.every((s) => s.home && s.pos === board.size && s.stars === 1) && g.st.parts.every((p) => p.length === 6), `${board.id} seed ${seed}: two whole snowmen`);
      else if (board.game === "bingo") assert.ok(g.st.seats.every((s) => s.home && s.pos === board.size && s.stars === 8) && g.st.covered.every((c) => c.every(Boolean)), `${board.id} seed ${seed}: both cards full`);
      else if (board.game === "cmatch") assert.ok(g.st.seats.every((s) => s.home) && g.st.round === board.rounds && g.st.seats[0].stars + g.st.seats[1].stars === board.rounds, `${board.id} seed ${seed}: every round played out`);
      else if (board.game === "hide") assert.ok(g.st.seats.every((s) => s.home) && g.st.found === board.rounds && g.st.seats[0].stars + g.st.seats[1].stars === board.rounds, `${board.id} seed ${seed}: everybody found`);
      else if (board.game === "match3") assert.ok(g.st.seats.every((s) => s.home && s.pos === board.rounds && s.stars <= board.rounds * 3), `${board.id} seed ${seed}: every turn rolled`);
      else if (board.game === "grab") assert.ok(g.st.seats.every((s) => s.home) && g.st.owner.every((o) => o >= 0) && g.st.seats[0].pos + g.st.seats[1].pos === board.size, `${board.id} seed ${seed}: every square grabbed`);
      else if (board.game === "top") assert.ok(g.st.seats.every((s) => s.home) && g.st.gone.every((x) => x.length === board.deck) && g.st.seats[0].stars + g.st.seats[1].stars <= board.deck, `${board.id} seed ${seed}: every card played`);
      else if (board.game === "lines") assert.ok(g.st.seats.every((s) => s.home && s.pos === board.size) && g.st.grid.every((c) => c >= 0) && g.st.boardNo === board.boards - 1, `${board.id} seed ${seed}: both boards full`);
      else if (board.game === "nim") assert.ok(g.st.seats.every((s) => s.home) && g.st.seats[0].pos + g.st.seats[1].pos === board.size && g.st.seats[0].stars + g.st.seats[1].stars === board.jars.length, `${board.id} seed ${seed}: every cookie eaten, every golden one won`);
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
      const taps = g.ev.filter((e) => e.type === "hop" || e.type === "pick" || e.type === "card" || e.type === "draw" || e.type === "give" || e.type === "flip" || e.type === "found" || e.type === "peek" || (e.type === "roll" && board.game === "doors") || e.type === "shut" || e.type === "scoop" || e.type === "lay" || e.type === "take" || e.type === "hole" || e.type === "treasure" || e.type === "nibble" || e.type === "drop" || e.type === "lead" || e.type === "answer" || e.type === "grab" || e.type === "choose" || e.type === "roll3" || e.type === "keepDie" || e.type === "scurry" || e.type === "ask" || e.type === "cmPlay" || e.type === "cmFlip" || (e.type === "roll" && (board.game === "bingo" || board.game === "snow")) || e.type === "cover" || e.type === "build" || e.type === "fishAsk" || e.type === "fishGive" || e.type === "fishGo" || e.type === "tenHold" || e.type === "tenPair" || e.type === "tenMiss" || e.type === "hilo" || e.type === "carRight" || e.type === "carMiss").length;
      // (🧠 a pair or a star glows a moment; a miss stays up to be LOOKED at)
      const extras = g.ev.filter((e) => e.type === "ride" || e.type === "tens" || e.type === "pair" || e.type === "star" || e.type === "golden" || e.type === "line" || e.type === "trick" || e.type === "bigGrab" || e.type === "cheese" || e.type === "hideFound" || e.type === "cmOut" || e.type === "snowDone" || e.type === "fishGive" || (e.type === "fishGo" && e.pair) || e.type === "tenPair" || (e.type === "hilo" && e.right) || e.type === "carRight").length + g.ev.filter((e) => e.type === "cover").reduce((n, e) => n + e.lines.length, 0) + g.ev.filter((e) => e.type === "match").reduce((n, e) => n + e.stars, 0) +
        1.5 * g.ev.filter((e) => e.type === "nopair" || e.type === "stuck").length +
        0.4 * g.ev.filter((e) => e.type === "sow").length + g.ev.filter((e) => e.type === "again" || e.type === "sweep").length;
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
    assert.ok(q(turns, 0.5) >= (board.game === "pairs" ? 5 : board.game === "spin" || board.game === "doors" || board.game === "dominoes" || board.game === "dig" || board.game === "match3" ? 8 : 12), `${board.id}: median ${q(turns, 0.5)} turns in all`);
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
        else if (st.game === "acorns") L.sowPot(st, L.acornChoice(st));
        else if (st.game === "dig") L.digAt(st, L.digChoice(st));
        else if (st.game === "nim") L.takeCookies(st, L.nimChoice(st));
        else if (st.game === "lines") L.dropLine(st, L.linesChoice(st));
        else if (st.game === "top") L.playCard(st, L.topChoice(st));
        else if (st.game === "grab") L.grabColour(st, L.grabChoice(st));
        else if (st.game === "maze") L.moveMouse(st, L.mazeChoice(st));
        else if (st.game === "hide") L.askHide(st, L.hideChoice(st));
        else if (st.game === "snow" && st.phase === "build") L.buildSnow(st);
        else if (st.game === "hilo") L.hiloGuess(st, L.hiloChoice(st));
        else if (st.game === "train") L.pickCar(st, L.trainChoice(st));
        else if (st.game === "ten") { const c = L.tenChoice(st); L.tenPick(st, c[0]); check(); L.tenPick(st, c[1]); }
        else if (st.game === "fish") { if (st.phase === "ask") L.askFish(st, L.fishChoice(st)); else { if ((seed + guard) % 3 === 0) { L.answerFish(st, L.fishAnswer(st) < 0 ? 0 : -1); check(); } L.answerFish(st, L.fishAnswer(st)); } }
        else if (st.game === "bingo" && st.phase === "cover") { const sp = L.bingoSpots(st); const wrong = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((k) => sp.indexOf(k) < 0 && !st.covered[st.mover][k]); if (wrong != null && (seed + guard) % 3 === 0) { L.coverBingo(st, wrong); check(); } L.coverBingo(st, sp[0]); }
        else if (st.game === "cmatch") { const k = L.cmChoice(st); if (k < 0) L.flipMatch(st); else { const wrong = st.hands[st.turn].findIndex((id) => !L.cmFits(id, st.top)); if (wrong >= 0 && (seed + guard) % 4 === 0) { L.playMatch(st, wrong); check(); } L.playMatch(st, k); } }
        else if (st.game === "match3") {
          if (st.phase === "keep") { const w = L.m3Choice(st); for (let k = 0; k < 3; k++) if (st.held[k] !== w[k]) { L.holdDie(st, k); check(); } }
          L.rollMatch(st);
        }
        else if (st.phase === "choose") L.chooseDie(st, L.dieChoice(st));
        else if (st.game === "dominoes") { if (st.phase === "draw") L.drawTile(st); else { const c = L.domChoice(st); L.layTile(st, c[0], c[1]); } }
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

test("the WORDS have one owner each: no line in the table is written twice (a later key silently REPLACES an earlier one), and every line the shell says exists", () => {
  // 🍯 Honey Ten first named its opening line "tenFirst" — 💯 Hundred Hop's
  // line for a ten-bar — and the second key quietly took over the first:
  // Hundred Hop would have told him to "tap two flowers that make ten".
  const src = fs.readFileSync(path.join(__dirname, "../scripts/board-data.js"), "utf8");
  const body = src.slice(src.indexOf("const SAY = {"), src.indexOf("\n  };", src.indexOf("const SAY = {")));
  const keys = [...body.matchAll(/^ {4}(\w+):/gm)].map((m) => m[1]);
  assert.ok(keys.length >= 50, `fixture: the table's keys are read (${keys.length})`);
  const twice = keys.filter((k, i) => keys.indexOf(k) !== i);
  assert.deepEqual(twice, [], `a line written twice: ${twice.join(", ")}`);
  assert.equal(keys.length, Object.keys(DATA.SAY).length, "every key in the source is one line in the table");
  const main = fs.readFileSync(path.join(__dirname, "../scripts/board-main.js"), "utf8");
  const used = [...new Set([...main.matchAll(/\bSAY\.(\w+)/g)].map((m) => m[1]))];
  assert.ok(used.length >= 50, `fixture: the shell's lines are read (${used.length})`);
  const missing = used.filter((k) => !(k in DATA.SAY));
  assert.deepEqual(missing, [], `the shell says a line that does not exist (it would say "undefined"): ${missing.join(", ")}`);
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

test("🌰 ACORN POTS: a pot's acorns go one by one round the ring and never into the friend's nest, the last in your own nest is a ⭐ and goes again, an empty side sends the rest home, every acorn ends in a nest, counting how far a pot is from the nest wins the ⭐s, and broken saves are refused", () => {
  const b = DATA.board("acorns");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  // the very first move: pot 0 is three from his nest, so its three acorns
  // go 1, 2, nest — a ⭐ and his turn again
  let st = L.create({ board: "acorns", seats: SEATS, seed: 3 });
  assert.deepEqual(st.pots, [3, 3, 3, 0, 3, 3, 3, 0], "three in every pot, the nests empty");
  assert.deepEqual(L.acornAgains(st), [0], "only pot 0 is exactly three from his nest");
  let ev = L.sowPot(st, 0);
  assert.deepEqual(ev.filter((e) => e.type === "sow").map((e) => [e.to, e.c]), [[1, 1], [2, 2], [3, 3]], "one by one, counting");
  assert.ok(ev.some((e) => e.type === "again") && st.turn === 0 && st.seats[0].stars === 1 && st.seats[0].pos === 1, "the last in his nest: a ⭐, go again");
  // pot 2 now holds 4: nest, then the friend's three pots
  ev = L.sowPot(st, 2);
  assert.deepEqual(ev.filter((e) => e.type === "sow").map((e) => e.to), [3, 4, 5, 6], "into his nest and on round his friend's pots");
  assert.equal(st.turn, 1, "the last one elsewhere passes the turn");
  // never into the friend's nest: a big pot skips it
  st = L.create({ board: "acorns", seats: SEATS, seed: 3 });
  st.pots = [0, 0, 9, 0, 3, 3, 3, 0];
  ev = L.sowPot(st, 2);
  const to = ev.filter((e) => e.type === "sow").map((e) => e.to);
  assert.ok(to.indexOf(7) < 0, `his acorns never go in his friend's nest (${to})`);
  assert.deepEqual(to, [3, 4, 5, 6, 0, 1, 2, 3, 4], "round the ring, skipping 7");
  // an empty side ends it: the rest go home to their own nests
  st = L.create({ board: "acorns", seats: SEATS, seed: 3 });
  st.pots = [0, 0, 1, 5, 4, 4, 4, 0];
  for (const j of [0, 1]) st.seats[j].pos = st.pots[j * 4 + 3];
  ev = L.sowPot(st, 2);
  assert.equal(st.phase, "done", "his side is empty: the game is over");
  assert.deepEqual(st.pots, [0, 0, 0, 6, 0, 0, 0, 12], "his friend's twelve go to her own nest");
  assert.ok(ev.some((e) => e.type === "sweep" && e.seat === 1 && e.n === 12) && st.seats.every((x) => x.home), "said, and both are home");
  // taps that are not moves do nothing
  st = L.create({ board: "acorns", seats: SEATS, seed: 3 });
  assert.deepEqual(L.sowPot(st, 4), [], "not his pot");
  assert.deepEqual(L.sowPot(st, 3), [], "a nest is not a pot");
  L.sowPot(st, 0);
  assert.deepEqual(L.sowPot(st, 0), [], "an empty pot (the hammer's echo) does nothing");
  assert.deepEqual(L.sowPot(st, 1.5), [], "no such pot");
  // every game: all eighteen acorns end in the nests, and the ⭐s are the
  // go-agains; a player who COUNTS (always the pot that reaches the nest)
  // takes most of them against the computer, which sees one only half the time
  let mine = 0, theirs = 0, more = 0, evenMine = 0, evenTheirs = 0;
  const N = 1500;
  for (let seed = 1; seed <= N; seed++) {
    for (const sharp of [true, false]) {
      const g = L.create({ board: "acorns", seats: SEATS, seed, first: seed % 2 });
      let guard = 0, againCount = [0, 0];
      while (g.phase !== "done" && guard++ < 300) {
        if (g.turn === 0) {
          const a = L.acornAgains(g), full = [0, 1, 2].filter((k) => g.pots[k] > 0);
          const k = sharp && a.length ? a[a.length - 1] : full[(seed * 7 + guard) % full.length];
          const e = L.sowPot(g, k);
          if (e.some((x) => x.type === "again")) againCount[0]++;
        } else for (const e of L.autoTurn(g)) if (e.type === "again") againCount[1]++;
      }
      assert.equal(g.phase, "done", `seed ${seed} ends`);
      assert.equal(g.pots[3] + g.pots[7], 18, "every acorn in a nest");
      assert.deepEqual(g.seats.map((x) => x.stars), againCount, "a ⭐ is exactly a last acorn in your own nest");
      if (sharp) { mine += g.seats[0].stars; theirs += g.seats[1].stars; if (g.seats[0].stars > g.seats[1].stars) more++; }
      else { evenMine += g.seats[0].stars; evenTheirs += g.seats[1].stars; }
    }
  }
  const sh = mine / (mine + theirs), ev2 = evenMine / (evenMine + evenTheirs);
  // (measured: 62% of the ⭐s counting, 36% without, more ⭐s than the
  // computer in 64% of games — whoever goes first gets the opening ⭐)
  assert.ok(sh > 0.56 && sh < 0.9, `counting wins the ⭐s: ${(100 * sh).toFixed(0)}% of them`);
  assert.ok(ev2 < 0.45 && sh - ev2 > 0.18, `counting is the edge: ${(100 * sh).toFixed(0)}% counting against ${(100 * ev2).toFixed(0)}% without`);
  assert.ok(more / N > 0.56, `and more ⭐s than the computer ${(100 * more / N).toFixed(0)}% of the time`);
  // states no game reaches
  st = L.create({ board: "acorns", seats: SEATS, seed: 5 });
  L.sowPot(st, 0); L.sowPot(st, 1);
  const g = L.snapshot(st);
  const bad = [
    ["an acorn too many", { ...g, pots: g.pots.map((n, k) => (k === 0 ? n + 1 : n)) }],
    ["a pot with minus acorns", { ...g, pots: g.pots.map((n, k) => (k === 0 ? -1 : k === 1 ? n + 1 : n)) }],
    ["a nest count that is not the nest", { ...g, seats: [{ ...g.seats[0], pos: g.seats[0].pos + 1 }, g.seats[1]] }],
    ["a side empty but the game going on", { ...g, pots: [0, 0, 0, g.pots[3] + g.pots[0] + g.pots[1] + g.pots[2], ...g.pots.slice(4)], seats: [{ ...g.seats[0], pos: g.pots[3] + g.pots[0] + g.pots[1] + g.pots[2] }, g.seats[1]] }],
    ["done with acorns still in pots", { ...g, phase: "done", seats: g.seats.map((x) => ({ ...x, home: true })), order: [0, 1] }],
    ["seven places", { ...g, pots: g.pots.slice(0, 7) }],
    ["a die rolled", { ...g, die: 3 }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🁢 DOT DOMINOES: fifteen tiles once each, a tile goes on the end its dots match (he chooses when it fits both), a double and the last tile are ⭐s, fishing finds a match or puts it back, every game ends with nothing left that can be laid, choosing the end is the skill, and broken saves are refused", () => {
  const b = DATA.board("dominoes");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  const T = (id) => id.split("-").map(Number);
  assert.equal(L.domSet(b).length, 15, "every pair of 1 to 5 dots once");
  let starts = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const st = L.create({ board: "dominoes", seats: SEATS, seed, first: seed % 2 });
    assert.equal(st.line.length, 1, "one tile starts the line");
    assert.notEqual(st.line[0][0], st.line[0][1], "never a double");
    assert.ok(st.hands.every((h) => h.length === b.hand) && st.pile.length === 15 - 1 - 2 * b.hand, "four each, six in the pile");
    if (st.turn !== seed % 2) starts++;
  }
  assert.ok(starts < 40, "only when every match is in the friend's hand does the friend start");
  // a tile that fits both ends (leaving different dots) waits for him to
  // choose; then it goes on that end, turned to match
  let found = false;
  for (let seed = 1; seed <= 400 && !found; seed++) {
    // (never on the first move: the ends are the start tile's two numbers)
    const st = L.create({ board: "dominoes", seats: SEATS, seed, first: 0 });
    let id = null, guard = 0;
    while (st.phase !== "done" && guard++ < 40) {
      if (st.phase === "lay") id = st.hands[st.turn].find((x) => L.domChoosy(st, x));
      if (id) break;
      L.autoTurn(st);
    }
    if (!id) continue;
    found = true;
    const ev = L.layTile(st, id);
    assert.deepEqual(ev.map((e) => e.type), ["hold"], "held: which end?");
    assert.deepEqual(L.layTile(st, id), [], "the held tile again (the hammer's echo) does nothing");
    const was = st.ends.slice(), lay = L.layTile(st, id, "left");
    assert.equal(lay[0].type, "lay");
    assert.equal(st.line[0][1], was[0], "it went on the LEFT end, its matching dots against the end");
    assert.equal(st.ends[1], was[1], "the right end is unchanged");
  }
  assert.ok(found, "fixture: a tile that fits both ends was found");
  // a tile that matches nothing is a kind miss; fishing a tile that does not
  // match puts it back under the pile
  {
    const st = L.create({ board: "dominoes", seats: SEATS, seed: 9, first: 0 });
    st.ends = [1, 1]; st.line = [[1, 1]];
    st.hands = [["2-3", "4-5", "2-2", "3-3"], st.hands[1]];
    const miss = L.layTile(st, "2-3");
    assert.equal(miss[0].type, "miss", "2 and 3 do not match a 1");
    assert.deepEqual(L.layTile(st, "9-9"), [], "no such tile in his hand");
  }
  // every game, and the ⭐s: a double is one, laying your last tile is one
  let outSharp = 0, outPlain = 0, firstSharp = 0, firstPlain = 0, fishes = 0, backs = 0, passes = 0;
  const N = 1500;
  for (let seed = 1; seed <= N; seed++) {
    for (const sharp of [true, false]) {
      const st = L.create({ board: "dominoes", seats: SEATS, seed, first: seed % 2 });
      let guard = 0, firstOut = -1, stars = [0, 0];
      while (st.phase !== "done" && guard++ < 300) {
        const ev = [];
        if (st.turn === 0) {
          if (st.phase === "draw") ev.push(...L.drawTile(st));
          else {
            const opts = [];
            for (const id of st.hands[0]) for (const side of L.domSides(st, id)) opts.push([id, side]);
            let pick = opts[(seed * 7 + guard) % opts.length];
            if (sharp) {
              // keep the tiles that match each other: choose the tile AND the
              // end that leaves the most of his other tiles a place to go
              let best = -1;
              for (const [id, side] of opts) {
                const e = L.domEndsAfter(st, id, side), t = T(id);
                const sc = 2 * st.hands[0].filter((x) => x !== id && T(x).some((v) => e.indexOf(v) >= 0)).length + (t[0] === t[1] ? 3 : 0);
                if (sc > best) { best = sc; pick = [id, side]; }
              }
            }
            ev.push(...L.layTile(st, pick[0], pick[1]));
          }
        } else ev.push(...L.autoTurn(st));
        for (const e of ev) {
          if (e.type === "lay") stars[e.seat] += (e.double ? 1 : 0) + (e.out ? 1 : 0);
          if (e.type === "take") { fishes++; if (!e.fits) backs++; }
          if (e.type === "pass") passes++;
        }
        assert.ok(st.hands.every((h) => h.length <= b.hand + 1), "fishing never grows a hand past four (and one to lay)");
        if (firstOut < 0) { if (!st.hands[0].length) firstOut = 0; else if (!st.hands[1].length) firstOut = 1; }
      }
      assert.equal(st.phase, "done", `seed ${seed} ends`);
      assert.deepEqual(st.seats.map((x) => x.stars), stars, "a ⭐ is a double or the last tile");
      const out = !st.hands[0].length;
      if (sharp) { outSharp += out; firstSharp += firstOut === 0; } else { outPlain += out; firstPlain += firstOut === 0; }
    }
  }
  assert.ok(fishes > 1000 && backs > 200 && passes > 10, `fixture: fishing, putting back and passing all happen (${fishes}, ${backs}, ${passes})`);
  // (measured: he lays every tile in 86% of games choosing tile and end well,
  // 75% laying any tile that fits; out first 53% against 42%)
  assert.ok(outSharp / N > 0.8 && outSharp / N - outPlain / N > 0.07, `choosing well lays every tile: ${(100 * outSharp / N).toFixed(0)}% against ${(100 * outPlain / N).toFixed(0)}%`);
  assert.ok(firstSharp / N - firstPlain / N > 0.07, `and is out first more often: ${(100 * firstSharp / N).toFixed(0)}% against ${(100 * firstPlain / N).toFixed(0)}%`);
  // states no game reaches
  const st = L.create({ board: "dominoes", seats: SEATS, seed: 5, first: 0 });
  const g = L.snapshot(st);
  const bad = [
    ["a tile twice", { ...g, pile: g.pile.concat([g.hands[0][0]]) }],
    ["a tile missing", { ...g, pile: g.pile.slice(1) }],
    ["a line that does not join", { ...g, line: [[1, 2], [3, 4]], ends: [1, 4] }],
    ["ends that are not the line's", { ...g, ends: [g.ends[1], g.ends[0]].map((n) => n % 5 + 1) }],
    ["tiles laid that are not in the line", { ...g, seats: [{ ...g.seats[0], pos: 2 }, g.seats[1]] }],
    ["a held tile that fits one end only", { ...g, phase: "lay", held: g.hands[g.turn].find((x) => L.domSides(g, x).length === 1) || "9-9" }],
    ["a die rolled", { ...g, die: 2 }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🏴‍☠️ TREASURE DIG: a dug square shows the arrow toward the treasure (one of eight), the finder gets the ⭐ and a new one is buried, four treasures and one party, reading the arrows is the skill, and broken saves are refused", () => {
  const b = DATA.board("dig");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  // the arrows on a three-by-three: from the middle, every way
  const names = [0, 1, 2, 3, 5, 6, 7, 8].map((j) => L.digDir(b, 4, j));
  assert.deepEqual(names, ["up-left", "up", "up-right", "left", "right", "down-left", "down", "down-right"], "from the middle, all eight arrows");
  assert.equal(L.digDir(b, 0, 8), "down-right", "from a corner, across");
  assert.equal(L.digDir(b, 2, 5), "down", "straight down a column");
  // a dig: an arrow and the turn passes; the treasure: a ⭐, a new treasure
  let st = L.create({ board: "dig", seats: SEATS, seed: 7, first: 0 });
  const miss = st.dug.findIndex((d, j) => j !== st.spot);
  let ev = L.digAt(st, miss);
  assert.equal(ev[0].type, "hole");
  assert.equal(ev[0].dir, L.digDir(b, miss, st.spot), "the arrow points at the treasure");
  assert.equal(st.turn, 1, "the turn passes");
  assert.deepEqual(L.digAt(st, miss), [], "a square already dug (the hammer's echo) does nothing");
  assert.deepEqual(L.digAt(st, 9), [], "no such square");
  ev = L.digAt(st, st.spot);
  assert.deepEqual(ev.map((e) => e.type), ["treasure", "bury", "turn"], "found it: a new treasure is buried");
  assert.equal(st.seats[1].stars, 1, "the finder gets the ⭐");
  assert.ok(st.dug.every((d) => !d), "fresh sand");
  // every game, and the skill: digging only where every arrow still points
  // finds most of the treasures against a computer that reads them half the
  // time; digging anywhere finds far fewer
  let mine = 0, plain = 0, digsSharp = 0;
  const N = 1500;
  for (let seed = 1; seed <= N; seed++) {
    for (const sharp of [true, false]) {
      const g = L.create({ board: "dig", seats: SEATS, seed, first: seed % 2 });
      let guard = 0;
      while (g.phase !== "done" && guard++ < 200) {
        if (g.turn === 0) {
          const maybe = L.digMaybe(g), open = g.dug.map((d, j) => j).filter((j) => !g.dug[j]);
          assert.ok(maybe.indexOf(g.spot) >= 0, "the arrows never rule out the treasure");
          const from = sharp ? maybe : open;
          L.digAt(g, from[(seed * 5 + guard) % from.length]);
          if (sharp) digsSharp++;
        } else L.autoTurn(g);
      }
      assert.equal(g.phase, "done", `seed ${seed} ends`);
      assert.equal(g.found, b.treasures, "every treasure found");
      if (sharp) mine += g.seats[0].pos; else plain += g.seats[0].pos;
    }
  }
  // (measured: 66% of the treasures reading the arrows, 26% digging anywhere)
  assert.ok(mine / (N * b.treasures) > 0.58, `reading the arrows finds ${(100 * mine / (N * b.treasures)).toFixed(0)}% of the treasures`);
  assert.ok(mine / (N * b.treasures) - plain / (N * b.treasures) > 0.25, `the arrows are the edge: ${(100 * mine / (N * b.treasures)).toFixed(0)}% against ${(100 * plain / (N * b.treasures)).toFixed(0)}%`);
  // states no game reaches
  st = L.create({ board: "dig", seats: SEATS, seed: 5, first: 0 });
  L.digAt(st, st.dug.findIndex((d, j) => j !== st.spot));
  const g = L.snapshot(st);
  const bad = [
    ["the treasure's square already dug", { ...g, dug: g.dug.map((d, j) => d || j === g.spot) }],
    ["no treasure square", { ...g, spot: 9 }],
    ["a treasure found by nobody", { ...g, found: 1 }],
    ["a ⭐ for nothing", { ...g, seats: [{ ...g.seats[0], stars: 1 }, g.seats[1]] }],
    ["over with treasures left", { ...g, phase: "done", seats: g.seats.map((x) => ({ ...x, home: true })), order: [0, 1] }],
    ["eight squares", { ...g, dug: g.dug.slice(1) }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🍪 COOKIE JAR: take one, two or three, the LAST cookie is the golden ⭐ and opens the next jar, four jars and one party, leaving a multiple of four is the skill, and broken saves are refused", () => {
  const b = DATA.board("cookies");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  let st = L.create({ board: "cookies", seats: SEATS, seed: 3, first: 0 });
  assert.equal(st.cookies, b.jars[0], "the first jar is full");
  assert.deepEqual(L.nimTakes(st), [1, 2, 3], "one, two or three");
  assert.deepEqual(L.takeCookies(st, 4), [], "never four");
  assert.deepEqual(L.takeCookies(st, 0), [], "never none");
  // leaving four: whatever the friend takes, the golden one is his
  assert.equal(L.nimBest(st), b.jars[0] % 4, "the take that leaves a multiple of four");
  let ev = L.takeCookies(st, L.nimBest(st));
  assert.deepEqual(ev.map((e) => e.type), ["nibble", "turn"], "a take, and the turn passes");
  assert.equal(st.cookies % 4, 0, "four (or eight) left for the friend");
  assert.equal(L.nimBest(st), 0, "the friend has no take that leaves four");
  L.takeCookies(st, 1);
  ev = L.takeCookies(st, L.nimBest(st));
  assert.equal(ev[1].type, "golden", "the friend took one of the four, so he takes the golden one");
  assert.equal(ev[1].seat, 0, "and it is his");
  // (a fresh jar: the golden one, then the next jar opens and the turn passes)
  st = L.create({ board: "cookies", seats: SEATS, seed: 3, first: 0 });
  while (st.cookies > 3) L.takeCookies(st, 3);
  const taker = st.turn, rest = st.cookies;
  ev = L.takeCookies(st, rest);
  assert.deepEqual(ev.map((e) => e.type), ["nibble", "golden", "jar", "turn"], "the last cookie is golden and the next jar opens");
  assert.equal(st.seats[taker].stars, 1, "the golden cookie is a ⭐");
  assert.equal(st.jar, 1, "the next jar");
  assert.equal(st.cookies, b.jars[1], "full again");
  assert.notEqual(st.turn, taker, "the other player starts the next jar");
  // the cookies eaten are on the plates; the last jar's golden one ends it
  for (let seed = 1; seed <= 200; seed++) {
    const g = L.create({ board: "cookies", seats: SEATS, seed, first: seed % 2 });
    let guard = 0;
    while (g.phase !== "done" && guard++ < 200) {
      const before = g.cookies, ev2 = L.autoTurn(g);
      assert.equal(ev2[0].type, "nibble");
      assert.ok(ev2[0].n >= 1 && ev2[0].n <= b.take && ev2[0].n <= before, "a legal take");
      assert.ok(L.restore(L.snapshot(g)), "every state restores");
    }
    assert.equal(g.phase, "done");
    assert.equal(g.seats[0].pos + g.seats[1].pos, b.size, "every cookie on a plate");
  }
  // the skill: always leaving a multiple of four wins most golden cookies
  // against a computer that plans half the time; taking at random wins few
  let mine = 0, plain = 0;
  const N = 1500;
  for (let seed = 1; seed <= N; seed++) {
    for (const sharp of [true, false]) {
      const g = L.create({ board: "cookies", seats: SEATS, seed, first: seed % 2 });
      let guard = 0;
      while (g.phase !== "done" && guard++ < 200) {
        if (g.turn === 0) { const best = L.nimBest(g), t = L.nimTakes(g); L.takeCookies(g, sharp && best ? best : t[(seed * 7 + guard) % t.length]); } else L.autoTurn(g);
      }
      assert.equal(g.phase, "done", `seed ${seed} ends`);
      if (sharp) mine += g.seats[0].stars; else plain += g.seats[0].stars;
    }
  }
  const jars = N * b.jars.length;
  // (measured: 72% of the golden cookies leaving four, 38% taking any)
  assert.ok(mine / jars > 0.64, `leaving four wins ${(100 * mine / jars).toFixed(0)}% of the golden cookies`);
  assert.ok(mine / jars - plain / jars > 0.25, `planning is the edge: ${(100 * mine / jars).toFixed(0)}% against ${(100 * plain / jars).toFixed(0)}%`);
  // states no game reaches
  st = L.create({ board: "cookies", seats: SEATS, seed: 5, first: 0 });
  L.takeCookies(st, 2);
  const g = L.snapshot(st);
  const bad = [
    ["more cookies than the jar holds", { ...g, cookies: b.jars[0] + 1 }],
    ["an empty jar still being played", { ...g, cookies: 0, seats: [{ ...g.seats[0], pos: b.jars[0] }, g.seats[1]] }],
    ["cookies eaten from nowhere", { ...g, seats: [{ ...g.seats[0], pos: 5 }, g.seats[1]] }],
    ["a golden ⭐ with no jar emptied", { ...g, seats: [{ ...g.seats[0], stars: 1 }, g.seats[1]] }],
    ["no such jar", { ...g, jar: b.jars.length }],
    ["over with jars left", { ...g, phase: "done", seats: g.seats.map((x) => ({ ...x, home: true })), order: [0, 1] }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🔴 LINE UP: a counter drops to the bottom of its column, every NEW three in a row (across, up or slanting) is a ⭐, a full column takes nothing, two boards and one party, making and stopping lines is the skill, and broken saves are refused", () => {
  const b = DATA.board("lineup");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  const lines = L.linesOf(b);
  // a 3-wide, 5-high board: 5 across, 3 x 3 up, and 3 + 3 slanting
  assert.equal(lines.length, 5 + 9 + 6, "every line of three on the board");
  assert.ok(lines.every((ln) => ln.length === 3 && new Set(ln).size === 3), "each is three different cells");
  let st = L.create({ board: "lineup", seats: SEATS, seed: 3, first: 0 });
  // gravity: the first counter lands on the bottom, the next on top of it
  let ev = L.dropLine(st, 1);
  assert.deepEqual([ev[0].type, ev[0].row, ev[0].cell], ["drop", 0, 1], "to the bottom");
  ev = L.dropLine(st, 1);
  assert.equal(ev[0].row, 1, "on top of the last");
  assert.equal(st.grid[4], 1, "the friend's counter");
  // a line across the bottom: ⭐ for exactly that line
  st = L.create({ board: "lineup", seats: SEATS, seed: 3, first: 0 });
  for (const c of [0, 0, 1, 1]) L.dropLine(st, c);
  assert.deepEqual(L.linesBest(st), [2], "the column that makes his line");
  ev = L.dropLine(st, 2);
  assert.deepEqual(ev.map((e) => e.type), ["drop", "line", "turn"], "three across: a ⭐");
  assert.deepEqual(ev[1].cells.slice().sort((x, y) => x - y), [0, 1, 2], "the bottom row");
  assert.equal(st.seats[0].stars, 1, "his ⭐");
  // a counter that makes TWO lines is two ⭐s: his 0, 2, 4, 5 and the
  // friend's 1, 3, 6, 7 — his next counter in column 2 lands on cell 8,
  // finishing 2-5-8 up the column AND 0-4-8 slanting
  st = L.create({ board: "lineup", seats: SEATS, seed: 3, first: 0 });
  st.grid = [0, 1, 0, 1, 0, 0, 1, 1, -1, -1, -1, -1, -1, -1, -1];
  st.seats[0].pos = 4; st.seats[1].pos = 4;
  assert.ok(L.restore(L.snapshot(st)), "fixture: a real board, and his turn");
  ev = L.dropLine(st, 2);
  assert.deepEqual(ev.map((e) => e.type), ["drop", "line", "line", "turn"], "one counter, two lines");
  assert.deepEqual(ev.filter((e) => e.type === "line").map((e) => e.cells.slice().sort((x, y) => x - y)).sort(), [[0, 4, 8], [2, 5, 8]], "up the column and slanting");
  assert.equal(st.seats[0].stars, 2, "two ⭐s");
  // a full column takes nothing
  st = L.create({ board: "lineup", seats: SEATS, seed: 3, first: 0 });
  for (let k = 0; k < b.rows; k++) L.dropLine(st, 0);
  assert.equal(L.dropRow(st, 0), -1, "fixture: column 0 is full");
  assert.deepEqual(L.dropLine(st, 0), [], "a full column takes nothing");
  assert.deepEqual(L.linesOpen(st), [1, 2], "only the columns with room");
  assert.deepEqual(L.dropLine(st, 3), [], "no such column");
  // every game: both boards fill, a fresh board between them
  for (let seed = 1; seed <= 300; seed++) {
    const g = L.create({ board: "lineup", seats: SEATS, seed, first: seed % 2 });
    let guard = 0, fresh = 0;
    while (g.phase !== "done" && guard++ < 200) {
      const e = L.autoTurn(g);
      if (e.some((x) => x.type === "fresh")) { fresh++; assert.ok(g.grid.every((c) => c < 0), "a fresh board is empty"); }
      assert.ok(L.restore(L.snapshot(g)), `seed ${seed}: every state restores`);
    }
    assert.equal(g.phase, "done");
    assert.equal(fresh, b.boards - 1, "one fresh board between the two");
    assert.equal(g.seats[0].pos + g.seats[1].pos, b.boards * b.cols * b.rows, "every cell of both boards");
  }
  // the skill: dropping where a line is made (or stopped) wins the ⭐ share
  // against a computer that looks half the time; dropping anywhere does not
  let mine = 0, theirs = 0, plainMine = 0, plainTheirs = 0;
  const N = 1500;
  for (let seed = 1; seed <= N; seed++) {
    for (const sharp of [true, false]) {
      const g = L.create({ board: "lineup", seats: SEATS, seed, first: seed % 2 });
      let guard = 0;
      while (g.phase !== "done" && guard++ < 200) {
        if (g.turn === 0) { const best = L.linesBest(g), open = L.linesOpen(g), from = sharp && best.length ? best : open; L.dropLine(g, from[(seed * 7 + guard) % from.length]); } else L.autoTurn(g);
      }
      if (sharp) { mine += g.seats[0].stars; theirs += g.seats[1].stars; } else { plainMine += g.seats[0].stars; plainTheirs += g.seats[1].stars; }
    }
  }
  const share = mine / (mine + theirs), plain = plainMine / (plainMine + plainTheirs);
  // (measured: 58% of the ⭐s looking for lines, 42% dropping anywhere)
  assert.ok(share > 0.54, `looking for lines wins ${(100 * share).toFixed(0)}% of the ⭐s`);
  assert.ok(share - plain > 0.1, `looking is the edge: ${(100 * share).toFixed(0)}% against ${(100 * plain).toFixed(0)}%`);
  assert.ok((mine + theirs) / N > 4, `a game has plenty of ⭐s (${((mine + theirs) / N).toFixed(1)})`);
  // states no game reaches
  st = L.create({ board: "lineup", seats: SEATS, seed: 5, first: 0 });
  for (const c of [0, 1, 2]) L.dropLine(st, c);
  const g = L.snapshot(st);
  const bad = [
    ["a counter floating over an empty cell", { ...g, grid: g.grid.map((c, k) => (k === 0 ? -1 : k === 3 ? 0 : c)) }],
    ["a cell that is no seat's", { ...g, grid: g.grid.map((c, k) => (k === 0 ? 2 : c)) }],
    ["the wrong player's turn", { ...g, turn: 1 - g.turn, mover: 1 - g.mover }],
    ["a counter dropped by nobody", { ...g, seats: [{ ...g.seats[0], pos: g.seats[0].pos + 1 }, g.seats[1]] }],
    ["a line on the board nobody got a ⭐ for", { ...g, grid: [0, 0, 0, 1, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], seats: [{ ...g.seats[0], pos: 3 }, { ...g.seats[1], pos: 2 }], turn: 1, mover: 1 }],
    ["no such board", { ...g, boardNo: b.boards }],
    ["over with a board to play", { ...g, phase: "done", seats: g.seats.map((x) => ({ ...x, home: true })), order: [0, 1] }],
    ["no first player", { ...g, first: 2 }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🃏 TOP CARD: each player's own ten cards, three in hand; the leader plays one, the other answers; the bigger card wins the trick and a ⭐ (the same: nobody's); hands refill; the lead alternates; ten tricks and one party; saving is the skill; broken saves are refused", () => {
  const b = DATA.board("topcard");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  let st = L.create({ board: "topcard", seats: SEATS, seed: 3, first: 0 });
  for (const j of [0, 1]) {
    assert.equal(st.hands[j].length, 3, "three in hand");
    assert.deepEqual(st.piles[j].concat(st.hands[j]).sort((x, y) => x - y), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "his own ten cards");
  }
  assert.equal(st.phase, "lead");
  assert.equal(st.turn, 0, "the first player leads");
  const notMine = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((v) => st.hands[0].indexOf(v) < 0);
  assert.deepEqual(L.playCard(st, notMine), [], "only a card in his hand");
  // the lead, then the answer
  const lead = st.hands[0][0];
  let ev = L.playCard(st, lead);
  assert.deepEqual(ev.map((e) => e.type), ["lead", "turn"], "the lead: now the friend answers");
  assert.equal(st.phase, "follow");
  assert.equal(st.turn, 1);
  const notTheirs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find((v) => st.hands[1].indexOf(v) < 0);
  assert.deepEqual(L.playCard(st, notTheirs), [], "only a card in the hand of the one answering");
  // the saving answer: the smallest that beats it, or else the smallest
  const hand = st.hands[1].slice().sort((x, y) => x - y), beat = hand.filter((v) => v > lead);
  assert.equal(L.topBest(st), beat.length ? beat[0] : hand[0], "the saving card");
  const ans = L.topBest(st);
  ev = L.playCard(st, ans);
  assert.deepEqual(ev.map((e) => e.type), ["answer", "trick", "turn"], "the answer, the trick, and the next lead");
  const win = ans === lead ? -1 : ans > lead ? 1 : 0;
  assert.equal(ev[1].win, win, "the bigger card wins");
  if (win >= 0) assert.equal(st.seats[win].stars, 1, "a ⭐ for the trick");
  assert.deepEqual(st.hands.map((h) => h.length), [3, 3], "both hands refill");
  assert.equal(st.lead, 1, "the lead goes to the other player");
  assert.equal(st.turn, 1, "and it is theirs to lead");
  // a tie is nobody's
  st = L.create({ board: "topcard", seats: SEATS, seed: 3, first: 0 });
  st.hands = [[5, 1, 2], [5, 3, 4]]; st.piles = [[3, 4, 6, 7, 8, 9, 10], [1, 2, 6, 7, 8, 9, 10]];
  L.playCard(st, 5);
  ev = L.playCard(st, 5);
  assert.equal(ev[1].win, -1, "the same number: nobody's");
  assert.deepEqual(st.seats.map((x) => x.stars), [0, 0], "no ⭐");
  // every game: ten tricks, every card played, the ⭐s are the tricks won
  for (let seed = 1; seed <= 300; seed++) {
    const g = L.create({ board: "topcard", seats: SEATS, seed, first: seed % 2 });
    let guard = 0;
    while (g.phase !== "done" && guard++ < 100) { L.autoTurn(g); assert.ok(L.restore(L.snapshot(g)), `seed ${seed}: every state restores`); }
    assert.equal(g.phase, "done");
    const won = [0, 1].map((j) => g.gone[j].filter((v, t) => v > g.gone[1 - j][t]).length);
    assert.deepEqual(g.seats.map((x) => x.stars), won, "the ⭐s are exactly the tricks won");
  }
  // the skill: the saving card wins more tricks than any card
  let mine = 0, theirs = 0, pMine = 0, pTheirs = 0;
  const N = 1500;
  for (let seed = 1; seed <= N; seed++) {
    for (const sharp of [true, false]) {
      const g = L.create({ board: "topcard", seats: SEATS, seed, first: seed % 2 });
      let guard = 0;
      while (g.phase !== "done" && guard++ < 100) {
        if (g.turn === 0) { const h = g.hands[0]; L.playCard(g, sharp ? L.topBest(g) : h[(seed * 7 + guard) % h.length]); } else L.autoTurn(g);
      }
      if (sharp) { mine += g.seats[0].stars; theirs += g.seats[1].stars; } else { pMine += g.seats[0].stars; pTheirs += g.seats[1].stars; }
    }
  }
  const share = mine / (mine + theirs), plain = pMine / (pMine + pTheirs);
  // (measured: 55% of the tricks saving, 44% playing any card)
  assert.ok(share > 0.52, `saving wins ${(100 * share).toFixed(0)}% of the tricks`);
  assert.ok(share - plain > 0.08, `saving is the edge: ${(100 * share).toFixed(0)}% against ${(100 * plain).toFixed(0)}%`);
  // states no game reaches
  st = L.create({ board: "topcard", seats: SEATS, seed: 5, first: 0 });
  L.playCard(st, st.hands[0][0]);
  L.playCard(st, st.hands[1][0]);
  L.playCard(st, st.hands[1][0]);
  const g = L.snapshot(st);
  const bad = [
    ["a card twice", { ...g, hands: [g.hands[0], g.hands[1].slice(0, -1).concat([g.hands[1][0]])] }],
    ["a card of no number", { ...g, hands: [g.hands[0].slice(0, -1).concat([11]), g.hands[1]] }],
    ["a ⭐ for a trick not won", { ...g, seats: g.seats.map((x) => ({ ...x, stars: x.stars + 1, pos: x.pos + 1 })) }],
    ["the wrong player leading", { ...g, lead: 1 - g.lead }],
    ["the answer with no lead on the table", { ...g, table: [null, null] }],
    ["a short hand", { ...g, hands: [g.hands[0].slice(1), g.hands[1]], piles: [g.piles[0].concat([g.hands[0][0]]), g.piles[1]] }],
    ["over with cards to play", { ...g, phase: "done", table: [null, null], seats: g.seats.map((x) => ({ ...x, home: true })), order: [0, 1] }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🐭 MOUSE MAZE: a mouse each and one cheese in a garden of pots; an arrow card moves your mouse one or two steps (stopping at a pot, the edge or the cheese); every hand has an arrow that goes nearer the cheese; the cheese is a ⭐ and new cheese appears about as far from both; five cheeses, one party; picking the nearest arrow is the skill; broken saves are refused", () => {
  const b = DATA.board("maze");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  const n = b.cols * b.rows;
  for (let seed = 1; seed <= 300; seed++) {
    const st = L.create({ board: "maze", seats: SEATS, seed, first: seed % 2 });
    assert.deepEqual(st.mice, [(b.rows - 1) * b.cols, b.cols - 1], "his mouse bottom left, his friend's top right");
    assert.equal(st.pots.length, b.pots);
    // no pot walls a square in
    for (let k = 0; k < n; k++) if (st.pots.indexOf(k) < 0) assert.ok(L.mazeDist(st, st.mice[0], k) < Infinity, `seed ${seed}: square ${k} can be reached`);
    const a = L.mazeDist(st, st.mice[0], st.cheese), c = L.mazeDist(st, st.mice[1], st.cheese);
    assert.ok(a >= 2 && c >= 2 && Math.abs(a - c) <= 1, `seed ${seed}: the cheese is about as far from both (${a}, ${c})`);
    // there is always an arrow that goes nearer
    const i = st.turn, here = L.mazeDist(st, st.mice[i], st.cheese);
    assert.ok(st.hands[i].some((id) => { const p = L.mazePath(st, id, st.mice[i]); return p.length && (p[p.length - 1] === st.cheese || L.mazeDist(st, p[p.length - 1], st.cheese) < here); }), `seed ${seed}: a good arrow in hand`);
  }
  // a path stops at a pot, the edge and the cheese
  const st = L.create({ board: "maze", seats: SEATS, seed: 7, first: 0 });
  const t = { board: "maze", pots: [5], cheese: 2 };
  assert.deepEqual(L.mazePath(t, 7, 0), [1, 2], "two steps right, onto the cheese");
  assert.deepEqual(L.mazePath(t, 6, 3), [], "no step right off the edge");
  assert.deepEqual(L.mazePath(t, 3, 1), [], "no step down into a pot");
  assert.deepEqual(L.mazePath({ board: "maze", pots: [], cheese: 1 }, 7, 0), [1], "the mouse stops at the cheese to eat it");
  assert.equal(L.MAZE_WORDS.join(), "up,down,left,right");
  // a move: the card is replaced, the turn passes
  const ev = L.moveMouse(st, L.mazeBest(st)[0]);
  assert.equal(ev[0].type, "scurry");
  assert.equal(st.hands[0].length, b.hand, "the card played is replaced");
  // the skill
  const share = (sharp) => {
    let me = 0, them = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const g = L.create({ board: "maze", seats: SEATS, seed, first: seed % 2 });
      let guard = 0;
      while (g.phase !== "done" && guard++ < 300) {
        if (g.turn !== 0) { L.autoTurn(g); continue; }
        const mv = g.hands[0].map((id, k) => k).filter((k) => L.mazePath(g, g.hands[0][k], g.mice[0]).length);
        L.moveMouse(g, sharp ? L.mazeBest(g)[0] : mv[(seed + guard) % mv.length]);
      }
      me += g.seats[0].stars; them += g.seats[1].stars;
    }
    return me / (me + them);
  };
  const sharp = share(true), plain = share(false);
  assert.ok(sharp >= 0.6, `the nearest arrow wins ${(sharp * 100).toFixed(0)}% of the cheese`);
  assert.ok(plain <= 0.4, `any arrow wins ${(plain * 100).toFixed(0)}%`);
  // broken saves
  const g = L.snapshot(L.create({ board: "maze", seats: SEATS, seed: 9, first: 0 }));
  const free = [...Array(n).keys()].filter((k) => g.pots.indexOf(k) < 0 && g.mice.indexOf(k) < 0 && k !== g.cheese);
  const bad = [
    ["a mouse in a pot", { ...g, mice: [g.pots[0], g.mice[1]] }],
    ["the cheese under a mouse", { ...g, cheese: g.mice[0] }],
    ["the cheese in a pot", { ...g, cheese: g.pots[0] }],
    ["two pots on one square", { ...g, pots: [g.pots[0], g.pots[0], g.pots[1]] }],
    ["a square walled in", { ...g, pots: [1, 4, 5].concat([]).slice(0, b.pots), mice: [0, g.mice[1]], cheese: free.find((k) => [0, 1, 4, 5].indexOf(k) < 0) }],
    ["a ninth arrow", { ...g, hands: [[8, 0, 1], g.hands[1]] }],
    ["a cheese found with no ⭐", { ...g, found: 1 }],
    ["a hand of two", { ...g, hands: [g.hands[0].slice(0, 2), g.hands[1]] }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🚂 PATTERN TRAIN: five cars in a colour pattern and the next one missing; three different cars offered, the right one among them; the right car is a ⭐ and a new train, another passes the turn with the same train; eight trains, the patterns growing; seeing the pattern is the skill; broken saves are refused", () => {
  const b = DATA.board("train");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  assert.equal(L.TRAIN_PATTERNS.length, b.trains, "a pattern for every train");
  assert.ok(L.TRAIN_PATTERNS[0].length <= L.TRAIN_PATTERNS[L.TRAIN_PATTERNS.length - 2].length, "the patterns grow");
  for (let seed = 1; seed <= 300; seed++) {
    const st = L.create({ board: "train", seats: SEATS, seed, first: seed % 2 });
    let guard = 0;
    while (st.phase !== "done" && guard++ < 80) {
      const pat = L.TRAIN_PATTERNS[st.round], map = {};
      st.cars.forEach((c, k) => { const ch = pat[k % pat.length]; if (map[ch] != null) assert.equal(map[ch], c, `seed ${seed}: the train repeats its pattern`); map[ch] = c; });
      assert.equal(new Set(Object.values(map)).size, Object.keys(map).length, "each letter its own colour");
      assert.equal(st.answer, map[pat[5 % pat.length]], "the answer is the car that comes next");
      assert.equal(new Set(st.options).size, 3, "three different cars");
      assert.ok(st.options.indexOf(st.answer) >= 0, "the right car is offered");
      const i = st.turn, round = st.round, cars = st.cars.slice();
      const wrong = st.options.findIndex((c) => c !== st.answer);
      if (guard % 3 === 0) {
        const ev = L.pickCar(st, wrong);
        assert.equal(ev[0].type, "carMiss");
        assert.equal(st.round, round, "a wrong car makes no train");
        assert.deepEqual(st.cars, cars, "the same train waits");
        assert.equal(st.turn, 1 - i, "the turn passes");
      } else {
        const before = st.seats[i].stars;
        const ev = L.pickCar(st, st.options.indexOf(st.answer));
        assert.equal(ev[0].type, "carRight");
        assert.equal(st.seats[i].stars, before + 1, "a ⭐");
      }
    }
    assert.equal(st.phase, "done");
  }
  // the skill
  const share = (sharp) => {
    let me = 0, them = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      const g = L.create({ board: "train", seats: SEATS, seed, first: seed % 2 });
      let guard = 0;
      while (g.phase !== "done" && guard++ < 200) {
        if (g.turn !== 0) { L.autoTurn(g); continue; }
        L.pickCar(g, sharp ? g.options.indexOf(g.answer) : (seed + guard) % 3);
      }
      me += g.seats[0].stars; them += g.seats[1].stars;
    }
    return me / (me + them);
  };
  const sharp = share(true), plain = share(false);
  assert.ok(sharp >= 0.6, `seeing the pattern finishes ${(sharp * 100).toFixed(0)}% of the trains`);
  assert.ok(plain <= 0.45, `any car finishes ${(plain * 100).toFixed(0)}%`);
  // broken saves
  const g = L.snapshot(L.create({ board: "train", seats: SEATS, seed: 9, first: 0 }));
  const bad = [
    ["a train that breaks its pattern", { ...g, cars: g.cars.map((c, k) => (k === 2 ? g.cars[1] : c)) }],
    ["the wrong answer", { ...g, answer: g.cars[4] }],
    ["the answer not offered", { ...g, options: DATA.COLOURS.map((c) => c.id).filter((c) => c !== g.answer).slice(0, 3) }],
    ["the same car twice", { ...g, options: [g.answer, g.answer, g.options.find((c) => c !== g.answer)] }],
    ["a train with no ⭐", { ...g, round: 1 }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🔼 HIGHER OR LOWER: twenty cards, 1 to 10 twice, one turned up; guess bigger or smaller and the next is turned (right a ⭐, the same no ⭐ and no loss), then it is the friend's card to beat; twelve cards, one party; guessing toward the far side is the skill; broken saves are refused", () => {
  const b = DATA.board("hilo");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  for (let seed = 1; seed <= 300; seed++) {
    const st = L.create({ board: "hilo", seats: SEATS, seed, first: seed % 2 });
    let guard = 0;
    while (st.phase !== "done" && guard++ < 40) {
      const i = st.turn, was = st.top, before = st.seats[i].stars, up = (seed + guard) % 2 === 0;
      assert.deepEqual(L.hiloGuess(st, "up"), [], "a guess is bigger or smaller, nothing else");
      const ev = L.hiloGuess(st, up);
      const e = ev[0];
      assert.equal(e.was, was);
      assert.equal(st.top, e.card, "the card turned is the next to beat");
      assert.equal(e.right, up ? e.card > was : e.card < was);
      assert.equal(st.seats[i].stars, before + (e.right ? 1 : 0), "a ⭐ for a right guess, and nothing taken for a wrong one");
      if (st.phase !== "done") assert.equal(st.turn, 1 - i, "the turn passes");
    }
    assert.equal(st.phase, "done");
    assert.equal(st.flips, b.flips, "twelve cards");
  }
  assert.equal(L.hiloBest({ top: 2, deck: [1, 3, 4, 9] }), true, "a small card: bigger");
  assert.equal(L.hiloBest({ top: 9, deck: [1, 3, 4, 10] }), false, "a big card: smaller");
  // the skill
  const share = (sharp) => {
    let me = 0, them = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      const g = L.create({ board: "hilo", seats: SEATS, seed, first: seed % 2 });
      let guard = 0;
      while (g.phase !== "done" && guard++ < 40) {
        if (g.turn !== 0) { L.autoTurn(g); continue; }
        L.hiloGuess(g, sharp ? L.hiloBest(g) : (seed + guard) % 2 === 0);
      }
      me += g.seats[0].stars; them += g.seats[1].stars;
    }
    return me / (me + them);
  };
  const sharp = share(true), plain = share(false);
  assert.ok(sharp >= 0.53, `guessing toward the far side gets ${(sharp * 100).toFixed(0)}% of the ⭐s`);
  assert.ok(plain <= 0.46, `guessing anyhow gets ${(plain * 100).toFixed(0)}%`);
  // broken saves
  const g = L.snapshot(L.create({ board: "hilo", seats: SEATS, seed: 9, first: 0 }));
  const bad = [
    ["an eleven", { ...g, top: 11 }],
    ["a card three times", { ...g, deck: g.deck.slice(1).concat([g.top, g.top]).slice(0, g.deck.length) }],
    ["flips that do not match the deck", { ...g, flips: 3 }],
    ["more ⭐s than guesses", { ...g, seats: [{ ...g.seats[0], stars: 2, pos: 2 }, g.seats[1]] }],
    ["over too soon", { ...g, phase: "done", seats: g.seats.map((x) => ({ ...x, home: true })), order: [0, 1] }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🍯 HONEY TEN: eighteen flowers, 1 to 9 twice (nine tens in all); nine in the meadow, always with a ten to find; tap one then one that makes ten (a ⭐ and new flowers), else the two are said and the turn passes; all nine tens made, one party; knowing tens is the skill; broken saves are refused", () => {
  const b = DATA.board("honeyten");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  for (let seed = 1; seed <= 300; seed++) {
    const st = L.create({ board: "honeyten", seats: SEATS, seed, first: seed % 2 });
    assert.equal(st.flowers.length, b.cols * b.rows, "nine flowers");
    let guard = 0;
    while (st.phase !== "done" && guard++ < 200) {
      assert.ok(L.tenPairs(st).length >= 1, `seed ${seed}: always a ten to find`);
      const i = st.turn, live = st.flowers.map((x, k) => k).filter((k) => st.flowers[k] > 0);
      const a = live[(seed + guard) % live.length];
      assert.equal(L.tenPick(st, a)[0].type, "tenHold");
      assert.deepEqual(L.tenPick(st, a), [], "the same flower again is the echo");
      const partner = live.find((k) => k !== a && st.flowers[k] + st.flowers[a] === 10);
      const wrong = live.find((k) => k !== a && st.flowers[k] + st.flowers[a] !== 10);
      const tryRight = partner != null && (guard % 3 !== 0 || wrong == null);
      const before = st.seats[i].stars, va = st.flowers[a];
      const ev = L.tenPick(st, tryRight ? partner : wrong);
      if (tryRight) {
        assert.equal(ev[0].type, "tenPair");
        assert.equal(ev[0].na + ev[0].nb, 10, "a ten");
        assert.equal(st.seats[i].stars, before + 1, "a ⭐ for a ten");
      } else {
        assert.equal(ev[0].type, "tenMiss");
        assert.equal(ev[0].sum, va + ev[0].nb, "the sum is said");
        assert.equal(st.seats[i].stars, before, "no ⭐, no loss");
        assert.equal(st.turn, 1 - i, "the turn passes");
      }
      assert.equal(st.held, null, "nothing held after the second flower");
    }
    assert.equal(st.phase, "done", `seed ${seed} ends`);
    assert.equal(st.made.length, 9, "all nine tens");
  }
  // the skill
  const share = (sharp) => {
    let me = 0, them = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      const g = L.create({ board: "honeyten", seats: SEATS, seed, first: seed % 2 });
      let guard = 0;
      while (g.phase !== "done" && guard++ < 300) {
        if (g.turn !== 0) { L.autoTurn(g); continue; }
        let c;
        if (sharp) c = L.tenPairs(g)[0];
        else { const live = g.flowers.map((x, k) => k).filter((k) => g.flowers[k]); const a = live[(seed + guard) % live.length], r = live.filter((k) => k !== a); c = [a, r[(seed * 3 + guard) % r.length]]; }
        L.tenPick(g, c[0]); L.tenPick(g, c[1]);
      }
      me += g.seats[0].stars; them += g.seats[1].stars;
    }
    return me / (me + them);
  };
  const sharp = share(true), plain = share(false);
  assert.ok(sharp >= 0.58, `knowing tens makes ${(sharp * 100).toFixed(0)}% of them`);
  assert.ok(plain <= 0.35, `any two make ${(plain * 100).toFixed(0)}%`);
  // broken saves
  const g = L.snapshot(L.create({ board: "honeyten", seats: SEATS, seed: 9, first: 0 }));
  const bad = [
    ["a flower three times", { ...g, deck: g.deck.slice(1).concat([g.flowers[0]]) }],
    ["a flower missing", { ...g, deck: g.deck.slice(1) }],
    ["a ten with no ⭐", { ...g, made: [[g.deck[0], 10 - g.deck[0]]], deck: g.deck.slice(1) }],
    ["a ten that is not ten", { ...g, made: [[3, 3]] }],
    ["an empty place with flowers to come", { ...g, flowers: g.flowers.map((x, k) => (k === 0 ? 0 : x)), deck: g.deck.concat([g.flowers[0]]) }],
    ["holding nothing real", { ...g, held: 12 }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🐟 GO FISH: ten pictures twice; five cards each, never a pair in a hand; ask for a picture in your hand: the friend who has it must give it (a pair, a ⭐, ask again), else Go fish (the pond's top card; a pair if it matches); no fibs — a wrong answer only counts a miss; every pair made, one party; asking for one you both have is the skill; broken saves are refused", () => {
  const b = DATA.board("gofish");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  assert.equal(DATA.FISH.length, L.FISH_N);
  assert.equal(new Set(DATA.FISH.map((f) => f.pic)).size, L.FISH_N, "ten different pictures");
  for (let seed = 1; seed <= 300; seed++) {
    const st = L.create({ board: "gofish", seats: SEATS, seed, first: seed % 2 });
    assert.ok(st.hands.every((h) => h.length === b.hand && new Set(h).size === h.length), `seed ${seed}: five cards each, no pair`);
    let guard = 0;
    while (st.phase !== "done" && guard++ < 200) {
      const i = st.turn, o = 1 - i;
      const k = (seed + guard) % st.hands[i].length, q = st.hands[i][k];
      assert.equal(L.askFish(st, k)[0].type, "fishAsk");
      assert.deepEqual(L.askFish(st, 0), [], "one question at a time");
      const has = st.hands[o].indexOf(q) >= 0, before = st.seats[i].stars, pond = st.pond.length;
      // no fibs: "go fish" while holding it, or the wrong card, is a miss
      const wrong = has ? -1 : 0;
      if (has || st.hands[o].length) assert.equal(L.answerFish(st, wrong)[0].type, "fishMiss");
      const ev = L.answerFish(st, L.fishAnswer(st));
      if (has) {
        assert.equal(ev[0].type, "fishGive");
        assert.equal(st.seats[i].stars, before + 1, "a pair is a ⭐");
        if (st.phase === "ask") assert.equal(st.turn, i, "a pair asks again");
      } else {
        assert.equal(ev[0].type, "fishGo");
        if (pond) assert.equal(st.pond.length, pond - 1 - ev.filter((e) => e.type === "fishRefill").length, "one from the pond (and one more for an empty hand)");
        if (ev[0].pair) assert.equal(st.seats[i].stars, before + 1, "a catch that matches is a pair");
        if (st.phase !== "done") assert.equal(st.turn, o, "the turn passes");
      }
      for (const h of st.hands) assert.equal(new Set(h).size, h.length, "never a pair left in a hand");
    }
    assert.equal(st.phase, "done", `seed ${seed} ends`);
  }
  // the skill
  const share = (sharp) => {
    let me = 0, them = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      const g = L.create({ board: "gofish", seats: SEATS, seed, first: seed % 2 });
      let guard = 0;
      while (g.phase !== "done" && guard++ < 300) {
        if (g.turn !== 0) { L.autoTurn(g); continue; }
        if (g.phase === "ask") { const best = L.fishBest(g); L.askFish(g, sharp && best.length ? best[0] : (seed * 7 + guard) % g.hands[0].length); }
        if (g.phase === "answer") L.answerFish(g, L.fishAnswer(g));
      }
      me += g.seats[0].stars; them += g.seats[1].stars;
    }
    return me / (me + them);
  };
  const sharp = share(true), plain = share(false);
  assert.ok(sharp >= 0.58, `asking for one you both have makes ${(sharp * 100).toFixed(0)}% of the pairs`);
  assert.ok(plain <= 0.47, `asking for any makes ${(plain * 100).toFixed(0)}%`);
  // broken saves
  const g = L.snapshot(L.create({ board: "gofish", seats: SEATS, seed: 9, first: 0 }));
  const bad = [
    ["a picture three times", { ...g, pond: g.pond.slice(1).concat([g.hands[0][0]]) }],
    ["a card missing", { ...g, pond: g.pond.slice(1) }],
    ["a pair left in a hand", { ...g, hands: [g.hands[0].concat([g.hands[0][0]]), g.hands[1]], pond: g.pond.filter((x, k) => k !== g.pond.indexOf(g.hands[0][0])) }],
    ["a pair with no ⭐", { ...g, pairs: [[g.pond[0]], []], pond: g.pond.filter((x) => x !== g.pond[0]) }],
    ["asking for a picture he does not hold", { ...g, phase: "answer", want: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find((x) => g.hands[0].indexOf(x) < 0) }],
    ["over too soon", { ...g, phase: "done", seats: g.seats.map((x) => ({ ...x, home: true })), order: [0, 1] }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("⛄ SNOWMAN BUILD: each snowman starts as its big ball; a picture die of five parts and ❄️ magic snow (the next part that can go on); a part goes on only after the part it needs (the head after the tummy; the hat, nose and scarf after the head); a part it has, or not yet, and the turn passes; a whole snowman is a ⭐ and its builder then helps; broken saves are refused", () => {
  const b = DATA.board("snowman");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  assert.equal(DATA.SNOW_PARTS.length, 7, "six parts (index 0 unused)");
  assert.equal(L.snowWhich([1], 2), 2, "the tummy goes on the big ball");
  assert.equal(L.snowWhich([1], 3), 0, "no head before the tummy");
  assert.equal(L.snowWhich([1, 2], 4), 0, "no hat before the head");
  assert.equal(L.snowWhich([1, 2, 3], 4), 4, "a hat on the head");
  assert.equal(L.snowWhich([1, 2], 2), 0, "not a second tummy");
  assert.equal(L.snowWhich([1], L.SNOW_MAGIC), 2, "magic snow puts on the next part");
  assert.equal(L.snowWhich([1, 2, 3, 5], L.SNOW_MAGIC), 4, "…the first that can go on");
  assert.equal(L.snowWhich([1, 2, 3, 4, 5, 6], L.SNOW_MAGIC), 0, "nothing on a whole snowman");
  for (let seed = 1; seed <= 300; seed++) {
    const st = L.create({ board: "snowman", seats: SEATS, seed, first: seed % 2 });
    assert.deepEqual(st.parts, [[1], [1]], "two big snowballs to begin with");
    let guard = 0;
    while (st.phase !== "done" && guard++ < 200) {
      const i = st.turn, m = L.moverFor(st, i), have = st.parts[m].slice();
      const ev = L.roll(st);
      if (ev.some((e) => e.type === "snowNot")) {
        assert.equal(L.snowWhich(have, ev[0].die), 0, "a part that cannot go on");
        assert.deepEqual(st.parts[m], have, "nothing built");
        continue;
      }
      assert.equal(st.phase, "build");
      const out = L.buildSnow(st);
      const p = out[0].part;
      assert.ok(have.indexOf(p) < 0 && have.indexOf(L.SNOW_NEEDS[p]) >= 0, "a new part, on the part it needs");
      assert.equal(out[0].mover, m, "on the mover's snowman (a whole one's builder helps the friend)");
      assert.deepEqual(L.buildSnow(st), [], "one tap, one part");
    }
    assert.equal(st.phase, "done", `seed ${seed} ends`);
  }
  // broken saves
  const g = L.snapshot(L.create({ board: "snowman", seats: SEATS, seed: 9, first: 0 }));
  const bad = [
    ["no big ball", { ...g, parts: [[], [1]], seats: [{ ...g.seats[0], pos: 0 }, g.seats[1]] }],
    ["a head with no tummy", { ...g, parts: [[1, 3], [1]], seats: [{ ...g.seats[0], pos: 2 }, g.seats[1]] }],
    ["two tummies", { ...g, parts: [[1, 2, 2], [1]], seats: [{ ...g.seats[0], pos: 3 }, g.seats[1]] }],
    ["a part with no count", { ...g, parts: [[1, 2], [1]] }],
    ["building a hat on a bare ball", { ...g, phase: "build", die: 4 }],
    ["a die showing between turns", { ...g, die: 2 }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🔢 NUMBER BINGO: each player's own card of nine squares holding 1 to 6 (every number at least once); roll, and the die's number on the mover's card is covered (any other square only counts a miss; not on the card, the turn passes); a line covered is a ⭐ for the card's owner; a full card is home and its owner's rolls help fill the friend's; broken saves are refused", () => {
  const b = DATA.board("bingo");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  assert.equal(L.BINGO_LINES.length, 8, "three rows, three columns, two corner lines");
  for (let seed = 1; seed <= 300; seed++) {
    const st = L.create({ board: "bingo", seats: SEATS, seed, first: seed % 2 });
    for (const c of st.cardsB) {
      assert.equal(c.length, 9);
      assert.ok([1, 2, 3, 4, 5, 6].every((n) => c.indexOf(n) >= 0), `seed ${seed}: every number on the card`);
      assert.ok([1, 2, 3, 4, 5, 6].every((n) => c.filter((x) => x === n).length <= 2), "no number three times");
    }
    let guard = 0;
    while (st.phase !== "done" && guard++ < 200) {
      const i = st.turn, m = L.moverFor(st, i), cov = st.covered[m].slice(), stars = st.seats.map((x) => x.stars);
      const ev = L.roll(st);
      assert.equal(ev[0].type, "roll");
      if (ev.some((e) => e.type === "bingoNone")) {
        assert.ok(!st.cardsB[m].some((n, k) => n === ev[0].die && !cov[k]), "not on the card means not on the card");
        assert.deepEqual(st.covered[m], cov, "nothing covered");
        if (st.phase !== "done") assert.equal(st.turn, 1 - i, "the turn passes");
        continue;
      }
      assert.equal(st.phase, "cover");
      assert.equal(st.mover, m, "a full card's owner covers the friend's card");
      const spots = L.bingoSpots(st);
      const wrong = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((k) => spots.indexOf(k) < 0 && !cov[k]);
      if (wrong != null) {
        assert.deepEqual(L.coverBingo(st, wrong).map((e) => e.type), ["bingoMiss"], "a wrong square only counts a miss");
        assert.deepEqual(st.covered[m], cov);
      }
      const k = spots[(seed + guard) % spots.length];
      const out = L.coverBingo(st, k);
      assert.equal(out[0].type, "cover");
      assert.ok(st.covered[m][k], "the square is covered");
      const made = L.BINGO_LINES.filter((l) => l.indexOf(k) >= 0 && l.every((j) => st.covered[m][j])).length;
      assert.equal(st.seats[m].stars - stars[m], made, "a ⭐ for each line it makes, to the card's owner");
      assert.equal(out[0].lines.length, made);
    }
    assert.equal(st.phase, "done", `seed ${seed} ends`);
  }
  // broken saves
  const g = L.snapshot(L.create({ board: "bingo", seats: SEATS, seed: 9, first: 0 }));
  const bad = [
    ["a seven on the card", { ...g, cardsB: [g.cardsB[0].map((n, k) => (k === 0 ? 7 : n)), g.cardsB[1]] }],
    ["a number missing from a card", { ...g, cardsB: [[1, 1, 2, 2, 3, 3, 4, 4, 5], g.cardsB[1]] }],
    ["a square covered with no count", { ...g, covered: [g.covered[0].map((c, k) => k === 0), g.covered[1]] }],
    ["a line with no ⭐", { ...g, covered: [[true, true, true, false, false, false, false, false, false], g.covered[1]], seats: [{ ...g.seats[0], pos: 3 }, g.seats[1]] }],
    ["covering with no die", { ...g, phase: "cover", die: 0 }],
    ["a die showing between turns", { ...g, die: 3 }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🌈 COLOUR MATCH: forty cards (four colours with their shapes × 1 to 5, twice); play a card with the top card's colour OR number — any other only counts a miss; nothing fits: turn a new card over and the turn passes (a hand never grows); the one who empties their hand gets the ⭐ and new cards are dealt; three rounds; it is fair; broken saves are refused", () => {
  const b = DATA.board("colourmatch");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  // the faces
  const faces = new Set();
  for (let id = 0; id < 40; id++) faces.add(L.cmColour(id) + ":" + L.cmNumber(id));
  assert.equal(faces.size, 20, "twenty faces, each twice");
  assert.ok([...Array(40).keys()].every((id) => L.cmNumber(id) >= 1 && L.cmNumber(id) <= 5 && L.cmColour(id) >= 0 && L.cmColour(id) < 4));
  assert.ok(L.cmFits(0, 20) && L.cmFits(0, 5) && L.cmFits(0, 1) && !L.cmFits(0, 6), "same colour or same number, never neither");
  for (let seed = 1; seed <= 300; seed++) {
    const st = L.create({ board: "colourmatch", seats: SEATS, seed, first: seed % 2 });
    assert.ok(st.hands.every((h) => h.length === b.hand), "a hand each");
    let guard = 0;
    while (st.phase !== "done" && guard++ < 400) {
      const i = st.turn, top = st.top, hand = st.hands[i].slice(), n = hand.length;
      // a card that does not fit changes nothing but the misses
      const wrong = hand.findIndex((id) => !L.cmFits(id, top));
      if (wrong >= 0) {
        const ev = L.playMatch(st, wrong);
        assert.deepEqual(ev.map((e) => e.type), ["cmMiss"]);
        assert.equal(st.top, top); assert.equal(st.turn, i); assert.deepEqual(st.hands[i], hand);
      }
      const ok = L.cmPlayable(st);
      if (!ok.length) {
        const ev = L.flipMatch(st);
        assert.equal(ev[0].type, "cmFlip");
        assert.equal(st.hands[i].length, n, "turning one over never grows the hand");
        if (st.phase !== "done") assert.equal(st.turn, 1 - i, "the turn passes");
      } else {
        assert.deepEqual(L.flipMatch(st), [], "no turning over while a card fits");
        const ev = L.playMatch(st, ok[0]);
        assert.equal(ev[0].type, "cmPlay");
        if (ev.some((e) => e.type === "cmOut")) assert.equal(n, 1, "the ⭐ is for the last card");
        else assert.equal(st.hands[i].length, n - 1);
      }
    }
    assert.equal(st.phase, "done", `seed ${seed} ends`);
  }
  // fair: who empties first is not who starts
  let starts = 0, rounds = 0;
  for (let seed = 1; seed <= 2000; seed++) {
    const g = L.create({ board: "colourmatch", seats: SEATS, seed, first: seed % 2 });
    let lead = g.turn, r0 = 0, guard = 0;
    while (g.phase !== "done" && guard++ < 500) {
      for (const e of L.autoTurn(g)) if (e.type === "cmOut") { rounds++; if (e.seat === lead) starts++; }
      // a new round is started by whoever's turn it is after the deal
      if (g.round !== r0) { r0 = g.round; lead = g.turn; }
    }
  }
  const share = starts / rounds;
  assert.ok(share > 0.4 && share < 0.66, `the round's starter empties first ${(share * 100).toFixed(0)}% of the time`);
  // broken saves
  const g = L.snapshot(L.create({ board: "colourmatch", seats: SEATS, seed: 9, first: 0 }));
  const bad = [
    ["a card twice", { ...g, deck: g.deck.slice(1).concat([g.hands[0][0]]) }],
    ["a card missing", { ...g, deck: g.deck.slice(1) }],
    ["a forty-first card", { ...g, deck: g.deck.slice(1).concat([40]) }],
    ["an empty hand mid-game", { ...g, hands: [[], g.hands[1]], deck: g.deck.concat(g.hands[0]) }],
    ["a round won with no ⭐", { ...g, round: 1 }],
    ["over too soon", { ...g, phase: "done", seats: g.seats.map((x) => ({ ...x, home: true })), order: [0, 1] }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🕵️ WHO'S HIDING: nine different friends (a dog, cat or bunny; a red, blue or yellow shirt; a hat or none), one hiding; each turn three questions, one of them the best split; the answer puts down everyone it rules out, and the one who leaves a single friend standing found them (a ⭐); four friends, one party; asking the best question is the skill; broken saves are refused", () => {
  const b = DATA.board("hide");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  assert.equal(DATA.HIDERS.animals.length * DATA.HIDERS.colours.length * 2, 18, "eighteen hiders in all");
  for (const c of DATA.HIDERS.colours) assert.ok(DATA.COLOURS.some((x) => x.id === c), `${c} is a real colour (with its shape)`);
  // the traits read straight off an id
  assert.deepEqual(L.hideTraits(0), { a: 0, c: 0, h: 0 });
  assert.deepEqual(L.hideTraits(17), { a: 2, c: 2, h: 1 });
  assert.ok(L.hideYes(1, 7) && !L.hideYes(0, 7), "id 7 is a cat");
  assert.ok(L.hideYes(3, 6) && L.hideYes(6, 7) && !L.hideYes(6, 6), "id 6 is a red cat without a hat, 7 in one");
  for (let seed = 1; seed <= 400; seed++) {
    const st = L.create({ board: "hide", seats: SEATS, seed, first: seed % 2 });
    assert.equal(st.cards.length, b.cols * b.rows);
    assert.equal(new Set(st.cards).size, st.cards.length, `seed ${seed}: nine different friends`);
    assert.ok(st.hidden >= 0 && st.hidden < st.cards.length);
    // three different questions, one of them the best split there is
    assert.equal(st.asks.length, b.ask);
    assert.equal(new Set(st.asks).size, b.ask);
    const best = Math.max(...[0, 1, 2, 3, 4, 5, 6].map((q) => L.hideSplit(st, q)));
    assert.ok(best > 0 && st.asks.some((q) => L.hideSplit(st, q) === best), `seed ${seed}: the best question is offered`);
  }
  // an answer never puts the hider down, and puts down exactly who it rules out
  for (let seed = 1; seed <= 300; seed++) {
    const st = L.create({ board: "hide", seats: SEATS, seed, first: 0 });
    let guard = 0;
    while (st.phase !== "done" && guard++ < 80) {
      const k = (seed + guard) % st.asks.length, q = st.asks[k];
      const h = st.cards[st.hidden], before = st.cards.slice(), upBefore = st.up.slice();
      const ev = L.askHide(st, k);
      const a = ev[0];
      assert.equal(a.type, "ask");
      assert.equal(a.yes, L.hideYes(q, h), "the answer is the hider's");
      for (const j of a.down) assert.ok(upBefore[j] && L.hideYes(q, before[j]) !== a.yes, "only the ruled-out go down");
      assert.equal(a.down.length, upBefore.filter((u, j) => u && L.hideYes(q, before[j]) !== a.yes).length, "everyone ruled out goes down");
      const f = ev.find((e) => e.type === "hideFound");
      if (f) assert.equal(f.card, h, "the one found is the hider");
      else if (st.phase !== "done") assert.ok(st.up[st.hidden], "the hider stays up");
    }
    assert.equal(st.phase, "done");
  }
  // a question that rules nobody out puts nobody down (and the turn passes)
  const st = L.create({ board: "hide", seats: SEATS, seed: 3, first: 0 });
  const useless = [0, 1, 2, 3, 4, 5, 6].find((q) => L.hideSplit(st, q) === 0 && st.asks.indexOf(q) >= 0);
  if (useless != null) {
    const ev = L.askHide(st, st.asks.indexOf(useless));
    assert.equal(ev[0].down.length, 0);
    assert.equal(st.turn, 1, "the turn passes");
  }
  // the skill: asking the best question finds more of the friends
  const share = (sharp) => {
    let me = 0, them = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      const g = L.create({ board: "hide", seats: SEATS, seed, first: seed % 2 });
      let guard = 0;
      while (g.phase !== "done" && guard++ < 200) {
        if (g.turn !== 0) { L.autoTurn(g); continue; }
        L.askHide(g, sharp ? L.hideBest(g)[0] : (seed * 7 + guard) % g.asks.length);
      }
      me += g.seats[0].stars; them += g.seats[1].stars;
    }
    return me / (me + them);
  };
  const sharp = share(true), plain = share(false);
  assert.ok(sharp >= 0.56, `the best question finds ${(sharp * 100).toFixed(0)}% of the friends`);
  assert.ok(plain <= 0.47, `any question finds ${(plain * 100).toFixed(0)}%`);
  assert.ok(sharp - plain >= 0.1, `asking well is worth ${((sharp - plain) * 100).toFixed(0)} points`);
  // broken saves
  const g = L.snapshot(L.create({ board: "hide", seats: SEATS, seed: 9, first: 0 }));
  const bad = [
    ["the hider down", { ...g, up: g.up.map((u, k) => k !== g.hidden) }],
    ["only one standing mid-game", { ...g, up: g.up.map((u, k) => k === g.hidden) }],
    ["two of the same friend", { ...g, cards: [g.cards[0]].concat(g.cards.slice(0, -1)) }],
    ["a nineteenth friend", { ...g, cards: g.cards.slice(0, -1).concat([18]) }],
    ["a question that does not exist", { ...g, asks: [7, 0, 1] }],
    ["the same question twice", { ...g, asks: [0, 0, 1] }],
    ["a friend found with no ⭐", { ...g, found: 1 }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🎯 DICE MATCH: roll three dice, keep some (twice), two the same a ⭐ and three the same three; each die is its own luck (a fair bag of 1-6 could never deal a match); five turns each, one party; keeping the matching dice is the skill; broken saves are refused", () => {
  const b = DATA.board("dicematch");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  assert.equal(L.m3Score([4, 4, 4]), 3);
  assert.equal(L.m3Score([2, 5, 2]), 1);
  assert.equal(L.m3Score([1, 3, 6]), 0);
  assert.deepEqual(L.m3Keep([2, 5, 2]), [true, false, true], "keep the two that match");
  assert.deepEqual(L.m3Keep([1, 3, 6]), [false, false, false], "no match: roll them all again");
  // a turn: roll, keep, roll again; nothing to hold before the first roll
  let st = L.create({ board: "dicematch", seats: SEATS, seed: 4, first: 0 });
  assert.equal(st.phase, "roll");
  assert.deepEqual(L.holdDie(st, 0), [], "nothing to keep before a roll");
  let ev = L.rollMatch(st);
  assert.equal(ev[0].type, "roll3");
  assert.ok(ev[0].dice.every((d) => d >= 1 && d <= 6) && ev[0].all);
  if (st.phase === "keep") {
    assert.equal(st.left, b.rerolls, "two more rolls");
    L.holdDie(st, 1);
    const kept = st.dice[1];
    assert.deepEqual(L.holdDie(st, 3), [], "no fourth die");
    ev = L.rollMatch(st);
    assert.equal(ev[0].dice[1], kept, "a kept die stays");
  }
  // first rolls match far more than a bag could ever deal (one in four have a pair or better)
  let matched = 0;
  for (let seed = 1; seed <= 2000; seed++) {
    const g = L.create({ board: "dicematch", seats: SEATS, seed, first: 0 });
    if (L.m3Score(L.rollMatch(g)[0].dice) > 0) matched++;
  }
  assert.ok(matched > 800 && matched < 1100, `a first roll has a pair or better about 44% of the time (${matched}/2000)`);
  // the skill: keeping the matching dice wins most of the stars against a
  // computer that keeps them only half the time; keeping any is behind
  const share = (sharp) => {
    let me = 0, them = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const g = L.create({ board: "dicematch", seats: SEATS, seed, first: seed % 2 });
      let guard = 0;
      while (g.phase !== "done" && guard++ < 300) {
        if (g.turn !== 0) { L.autoTurn(g); continue; }
        L.rollMatch(g);
        let q = 0;
        while (g.phase === "keep" && g.turn === 0 && q++ < 5) {
          const w = sharp ? L.m3Keep(g.dice) : g.dice.map((d, k) => (seed + guard + k + q) % 3 === 0);
          for (let k = 0; k < 3; k++) if (g.held[k] !== w[k]) L.holdDie(g, k);
          L.rollMatch(g);
        }
      }
      me += g.seats[0].stars; them += g.seats[1].stars;
    }
    return me / (me + them);
  };
  const sharp = share(true), plain = share(false);
  assert.ok(sharp >= 0.54, `keeping the matches wins ${(sharp * 100).toFixed(0)}% of the stars`);
  assert.ok(plain <= 0.46, `keeping any wins ${(plain * 100).toFixed(0)}%`);
  // broken saves
  st = L.create({ board: "dicematch", seats: SEATS, seed: 9, first: 0 });
  L.rollMatch(st);
  if (st.phase !== "keep") { st = L.create({ board: "dicematch", seats: SEATS, seed: 11, first: 0 }); L.rollMatch(st); }
  assert.equal(st.phase, "keep", "fixture: a roll that waits to be kept");
  const g = L.snapshot(st);
  const bad = [
    ["a seventh face", { ...g, dice: [7, g.dice[1], g.dice[2]] }],
    ["four dice", { ...g, dice: g.dice.concat([1]) }],
    ["no rolls left while keeping", { ...g, left: 0 }],
    ["three the same still to keep", { ...g, dice: [5, 5, 5] }],
    ["a kept die that is not a yes or no", { ...g, held: [1, false, false] }],
    ["a bag of dice", { ...g, seats: g.seats.map((x, i) => (i === 0 ? { ...x, bag: [3] } : x)) }],
    ["more stars than turns allow", { ...g, seats: g.seats.map((x, i) => (i === 0 ? { ...x, stars: 4 } : x)) }],
    ["one seat two turns ahead", { ...g, seats: g.seats.map((x, i) => (i === 1 ? { ...x, pos: 2 } : x)) }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🎨 COLOUR GRAB: two patches grow from opposite corners; picking a colour (never your own, never your friend's) turns your patch that colour and swallows every touching square of it; a big grab is a ⭐; every square grabbed, one party; grabbing the most is the skill; broken saves are refused", () => {
  const b = DATA.board("grab");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  const n = b.cols * b.rows;
  for (let seed = 1; seed <= 200; seed++) {
    const st = L.create({ board: "grab", seats: SEATS, seed, first: seed % 2 });
    assert.equal(st.owner[0], 0, "Josh's patch starts in the bottom left");
    assert.equal(st.owner[n - 1], 1, "his friend's in the top right");
    assert.notEqual(st.paint[0], st.paint[n - 1], "two different colours");
    const opts = L.grabOptions(st);
    assert.equal(opts.length, 3, "a choice of three");
    assert.ok(opts.indexOf(st.paint[0]) < 0 && opts.indexOf(st.paint[n - 1]) < 0, "never his own colour, never his friend's");
  }
  // a grab: the patch turns the colour and swallows the touching squares
  let st = L.create({ board: "grab", seats: SEATS, seed: 3, first: 0 });
  const mine = st.paint[st.owner.indexOf(0)];
  assert.deepEqual(L.grabColour(st, mine), [], "not his own colour");
  assert.deepEqual(L.grabColour(st, st.paint[n - 1]), [], "not his friend's");
  const c = L.grabBest(st)[0], gain = L.grabGain(st, c), before = st.seats[0].pos;
  const ev = L.grabColour(st, c);
  assert.equal(ev[0].type, "grab");
  assert.equal(ev[0].cells.length, gain, "it grabs what grabGain said");
  assert.equal(st.seats[0].pos, before + gain, "his patch grew");
  assert.ok(st.owner.every((o, k) => o !== 0 || st.paint[k] === c), "his whole patch is the new colour");
  assert.equal(st.turn, 1, "the turn passes");
  // a big grab is a ⭐; every game ends with every square grabbed
  let bigs = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const g = L.create({ board: "grab", seats: SEATS, seed, first: seed % 2 });
    let guard = 0;
    while (g.phase !== "done" && guard++ < 200) {
      for (const e of L.autoTurn(g)) if (e.type === "grab" && e.cells.length >= b.big) bigs++;
      assert.ok(L.restore(L.snapshot(g)), `seed ${seed}: every state restores`);
    }
    assert.equal(g.phase, "done", `seed ${seed} ends`);
    assert.equal(g.seats[0].pos + g.seats[1].pos, n, "every square grabbed");
  }
  assert.ok(bigs > 300, "big grabs happen (each a ⭐)");
  // the skill: grabbing the most wins the squares against a computer that
  // looks half the time; picking any colour does not
  let me = 0, them = 0, pMe = 0, pThem = 0;
  const N = 1500;
  for (let seed = 1; seed <= N; seed++) {
    for (const sharp of [true, false]) {
      const g = L.create({ board: "grab", seats: SEATS, seed, first: seed % 2 });
      let guard = 0;
      while (g.phase !== "done" && guard++ < 200) {
        if (g.turn === 0) { const best = L.grabBest(g), o = L.grabOptions(g), from = sharp ? best : o; L.grabColour(g, from[(seed * 7 + guard) % from.length]); } else L.autoTurn(g);
      }
      if (sharp) { me += g.seats[0].pos; them += g.seats[1].pos; } else { pMe += g.seats[0].pos; pThem += g.seats[1].pos; }
    }
  }
  const share = me / (me + them), plain = pMe / (pMe + pThem);
  // (measured: 60% of the squares grabbing the most, 36% picking any)
  assert.ok(share > 0.55, `grabbing the most wins ${(100 * share).toFixed(0)}% of the squares`);
  assert.ok(share - plain > 0.15, `looking is the edge: ${(100 * share).toFixed(0)}% against ${(100 * plain).toFixed(0)}%`);
  // states no game reaches
  st = L.create({ board: "grab", seats: SEATS, seed: 5, first: 0 });
  L.grabColour(st, L.grabOptions(st)[0]);
  const g = L.snapshot(st);
  const far = g.owner.findIndex((o, k) => o < 0 && k > b.cols * 3);
  const bad = [
    ["a patch of two colours", { ...g, paint: g.paint.map((p, k) => (k === 0 ? (p === "R" ? "B" : "R") : p)), owner: g.owner }],
    ["a square of no colour", { ...g, paint: g.paint.map((p, k) => (k === 5 ? "Z" : p)) }],
    ["a patch in two pieces", { ...g, owner: g.owner.map((o, k) => (k === far ? 0 : o)), paint: g.paint.map((p, k) => (k === far ? g.paint[0] : p)), seats: [{ ...g.seats[0], pos: g.seats[0].pos + 1 }, g.seats[1]] }],
    ["a count that is not the patch", { ...g, seats: [{ ...g.seats[0], pos: g.seats[0].pos + 1 }, g.seats[1]] }],
    ["his corner lost", { ...g, owner: g.owner.map((o, k) => (k === 0 ? -1 : o)) }],
    ["over with squares to grab", { ...g, phase: "done", seats: g.seats.map((x) => ({ ...x, home: true })), order: [0, 1] }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
});

test("🎲 PICK A DIE: a roll is TWO dice from his own fair bag, he picks one (then hops it), each die's square is where it would take him, the rocket die is the pick, picking well gets home first, and broken saves are refused", () => {
  const b = DATA.board("pickdie");
  const SEATS = [{ who: "josh" }, { who: "river", cpu: true }];
  let st = L.create({ board: "pickdie", seats: SEATS, seed: 3, first: 0 });
  let ev = L.roll(st);
  assert.equal(st.phase, "choose", "two dice wait to be picked");
  assert.equal(ev[0].dice.length, 2, "two dice");
  assert.deepEqual(L.hop(st), [], "no hop before a die is picked");
  assert.deepEqual(L.roll(st), [], "no second roll");
  assert.deepEqual(L.chooseDie(st, 2), [], "no third die");
  const [a] = st.dice;
  assert.equal(L.dieTarget(st, 0), Math.min(b.size, st.seats[0].pos + a), "a die's square is where it takes him");
  ev = L.chooseDie(st, 0);
  assert.deepEqual([ev[0].type, ev[0].die], ["choose", a], "his pick is the roll");
  assert.equal(st.phase, "hop");
  assert.equal(st.left, a, "one tap a hop");
  // the rocket die: from square 1, a 2 lands on the rocket at 3
  st = L.create({ board: "pickdie", seats: SEATS, seed: 3, first: 0 });
  L.roll(st);
  st.dice = [2, 5];
  assert.deepEqual(L.dieBest(st), [0], "the die that lands on the rocket");
  st.dice = [4, 5];
  assert.deepEqual(L.dieBest(st), [1], "no rocket: the bigger die");
  // fair: each player's dice come from their own bag of 1-6, two a roll
  for (let seed = 1; seed <= 200; seed++) {
    const g = L.create({ board: "pickdie", seats: SEATS, seed, first: seed % 2 });
    const rolls = [[], []];
    let guard = 0;
    while (g.phase !== "done" && guard++ < 300) {
      for (const e of L.autoTurn(g)) if (e.type === "roll") rolls[e.seat].push(...e.dice);
      assert.ok(L.restore(L.snapshot(g)), `seed ${seed}: every state restores`);
    }
    assert.equal(g.phase, "done", `seed ${seed} ends`);
    for (const r of rolls) for (let k = 0; k + 6 <= r.length; k += 6) assert.deepEqual(r.slice(k, k + 6).sort(), [1, 2, 3, 4, 5, 6], `seed ${seed}: a bag of six is 1-6 once each`);
  }
  // the skill: picking the rocket die (or the bigger) gets him home first
  // far more often than picking either
  const firsts = { true: 0, false: 0 };
  const N = 1500;
  for (let seed = 1; seed <= N; seed++) {
    for (const sharp of [true, false]) {
      const g = L.create({ board: "pickdie", seats: SEATS, seed, first: seed % 2 });
      let guard = 0;
      while (g.phase !== "done" && guard++ < 300) {
        if (g.turn === 0) {
          L.roll(g);
          if (g.phase === "choose") L.chooseDie(g, sharp ? L.dieBest(g)[0] : (seed + guard) % 2);
          let k = 0;
          while (g.phase === "hop" && k++ < 20) L.hop(g);
        } else L.autoTurn(g);
      }
      if (g.order[0] === 0) firsts[sharp]++;
    }
  }
  // (measured: home first 70% picking well, 29% picking either)
  assert.ok(firsts.true / N > 0.62, `picking well gets home first ${(100 * firsts.true / N).toFixed(0)}% of the time`);
  assert.ok((firsts.true - firsts.false) / N > 0.3, `looking ahead is the edge: ${(100 * firsts.true / N).toFixed(0)}% against ${(100 * firsts.false / N).toFixed(0)}%`);
  // states no game reaches
  st = L.create({ board: "pickdie", seats: SEATS, seed: 5, first: 0 });
  L.roll(st);
  const g = L.snapshot(st);
  const bad = [
    ["one die to pick from", { ...g, dice: g.dice.slice(0, 1) }],
    ["a die of seven", { ...g, dice: [g.dice[0], 7] }],
    ["a die already rolled while picking", { ...g, die: 3, left: 0 }],
    ["dice left over while hopping", { ...g, phase: "hop", die: 3, left: 3 }],
  ];
  for (const [what, snap] of bad) assert.equal(L.restore(snap), null, `refused: ${what}`);
  assert.ok(L.restore(g), "the real state restores (or the refusals prove nothing)");
  const moon = L.snapshot(L.create({ board: "moon", seats: SEATS, seed: 5, first: 0 }));
  assert.equal(L.restore({ ...moon, dice: [1, 2] }), null, "a one-die board never carries two dice");
});

test("an event NAME belongs to one game unless it is on the shared list (the shell dispatches every game's events through ONE switch, so a new game reusing a name steals another's moment)", () => {
  // 🏴‍☠️ Treasure Dig first named its find "found" — Twin Spot's event — and
  // its branch, placed earlier in the shell's switch, swallowed every Twin
  // Spot find: the middle card never moved and the game stuck.
  const SHARED = {
    turn: "the turn routine", end: "the turn routine", home: "the race games' arrival", helper: "the race games' helper rule",
    roll: "Shut the Doors, Number Bingo and Snowman Build roll the dice's own die (the shell's rollDice branches by game)", hop: "the shell branches the hen's hop by game", spin: "the shell branches the farm's spinner by game",
  };
  const by = {};
  for (const b of DATA.BOARDS) {
    for (let seed = 1; seed <= 120; seed++) {
      const st = L.create({ board: b.id, seats: SEATS, seed, first: seed % 2, birds: true, fox: true });
      let g = 0;
      while (st.phase !== "done" && g++ < 400) for (const e of L.autoTurn(st)) (by[e.type] = by[e.type] || new Set()).add(b.game);
    }
  }
  const shared = Object.keys(by).filter((t) => by[t].size > 1);
  assert.ok(shared.length >= 4, "fixture: the turn routine's events are shared");
  for (const t of shared) assert.ok(SHARED[t], `"${t}" is emitted by ${[...by[t]].join(" and ")} — give one of them its own name, or put it on the shared list with the reason the shell can tell them apart`);
});
