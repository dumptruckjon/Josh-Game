// 🎲 Game Night — browser tests (Chromium). They drive the REAL screens: the
// front door's fifth door, the shelf (and Comet Moon arriving only after two
// Moon games), who's playing (a friend in the iPad or a person here), a whole
// game against the computer played by tapping his pad, the hop-per-tap rule,
// the booster, the wrong pad's kind wiggle, the double-tap, two people taking
// turns (and taking turns STARTING), a game kept on its box and carried on,
// the 24-hour limit, the first-time hand, the grown-up auto-hop switch, what
// the voice says, and leaving mid-turn. The engine itself is proven headless
// in board-logic.test.js; the shipped window.__BOARD hooks (the __HOLE / __TD
// precedent) start a game on a known seed so a test knows the dice.

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { startServer, launchBrowser, BOARD_MIDTURN } = require("./helpers");
const L = require("../scripts/board-logic.js");

let server, browser, context, page, baseURL;
const pageErrors = [];

before(async () => {
  ({ server, baseURL } = await startServer());
  browser = await launchBrowser();
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(baseURL, { waitUntil: "load" });
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((r) => server.close(r));
});

// Hop away first: setting the hash to the value it already has is a no-op.
async function go(hash, sel) {
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.locator(sel).waitFor({ state: "visible", timeout: 8000 });
  // a screen that has just appeared ignores a finger for 350ms (the echo
  // guard), so a test that taps waits the way a child who looked would
  await page.waitForTimeout(400);
}
// The pace of the turn routine, made quick: the timings are presentation,
// never rules, and a whole game at full pace takes minutes.
async function quick() {
  await page.evaluate(() => Object.assign(window.__BOARD.T, { tumble: 60, hop: 30, autoHop: 40, cpuThink: 40, cpuHop: 30, ride: 40, card: 30, glide: 20, handoff: 40, cheer: 60, tip: 40, look: 40 }));
}
async function slow() {
  await page.evaluate(() => Object.assign(window.__BOARD.T, { tumble: 700, hop: 240, autoHop: 480, cpuThink: 900, cpuHop: 560, ride: 900, card: 520, glide: 300, handoff: 700, cheer: 1400, tip: 1000, look: 1500 }));
}
const st = () => page.evaluate(() => window.__BOARD.state());
// Wait until it is a person's move (his pad waits for a tap), or the game is over.
async function untilTap(seat) {
  await page.waitForFunction((s) => {
    const x = window.__BOARD.state();
    if (!x) return false;
    if (x.phase === "done") return true;
    return x.turn === s && !window.__BOARD.busy();
  }, seat == null ? 0 : seat, { timeout: 20000 });
}
// Start a game on a known seed, as the who screen would.
async function startGame(box, friend, cpu, seed, first) {
  await page.evaluate((a) => window.__BOARD.start(a[0], a[1], a[2], a[3], a[4]), [box, friend, cpu, seed, first || 0]);
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
}

test("the front door's FIFTH door opens Game Night, and 🚪 comes back", async () => {
  await page.evaluate(() => { location.hash = ""; });
  await page.locator("#screen-start").waitFor({ state: "visible" });
  assert.equal(await page.locator(".start-tile").count(), 5, "five world doors");
  const order = await page.evaluate(() => [...document.querySelectorAll(".start-tile")].map((t) => t.id));
  assert.equal(order.indexOf("start-board"), order.indexOf("start-hole") + 1, "Game Night comes right after Gobble Hole");
  assert.equal(order[order.length - 1], "start-board", "…and is the last door");
  const box = await page.locator("#start-board").boundingBox();
  assert.ok(box.width >= 75 && box.height >= 75, "a giant tap target");
  await page.waitForTimeout(400);
  await page.locator("#start-board").click();
  await page.locator("#screen-board-home").waitFor({ state: "visible", timeout: 8000 });
  assert.ok(await page.evaluate(() => document.body.classList.contains("board-mode")), "Game Night's theme is on");
  await page.waitForTimeout(400);
  await page.locator("#screen-board-home .bn-exit").click();
  await page.locator("#screen-start").waitFor({ state: "visible", timeout: 8000 });
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("board-mode"))), "leaving drops the theme");
});

test("EVERY game: the instant his move hands the turn over, nothing on the board is still his to tap (the first moment of an animation is on a timer — Line Up's columns stayed buttons into the computer's turn)", async () => {
  const boxes = await page.evaluate(() => window.BoardData.BOXES.map((b) => b.id));
  let passed = 0;
  const bad = [];
  for (const box of boxes) {
    await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
    await startGame(box, "river", true, 3, 0);
    await page.waitForFunction(() => { const st = window.__BOARD.state(); return st && st.turn === 0 && !window.__BOARD.busy(); }, null, { timeout: 8000 });
    // his first tap on the board itself (never a pad or the bar), and the
    // board read in the same moment
    const r = await page.evaluate(() => {
      const play = document.querySelector("#screen-board-play");
      const boardButtons = () => [...play.querySelectorAll("button.tap")].filter((b) => !b.closest(".bn-pad") && !b.closest(".bn-bar") && !b.closest(".bn-party") && b.offsetParent && !b.disabled);
      const first = boardButtons()[0];
      if (!first) return { none: true };
      first.click();
      const st = window.__BOARD.state();
      return { passed: st.phase === "done" || st.turn !== 0, left: boardButtons().map((b) => b.className) };
    });
    if (r.none || !r.passed) continue;
    passed++;
    if (r.left.length) bad.push(box + ": " + r.left.join(" | "));
  }
  assert.deepEqual(bad, [], "a board still his to tap after his move handed the turn over");
  assert.ok(passed >= 8, `fixture: the first tap hands the turn over in many games (${passed})`);
});

test("the shelf: two shelves (🎲 lucky, 🧠 thinking); Moon Race and Rainbow Trail first; Comet Moon arrives after TWO finished Moon games, never as a padlock", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await go("#board-home", "#screen-board-home");
  const boxes = () => page.evaluate(() => [...document.querySelectorAll("#screen-board-home .bn-box")].map((b) => b.dataset.box));
  const kinds = () => page.evaluate(() => [...document.querySelectorAll("#screen-board-home .bn-boxes")].map((l) => [l.dataset.kind, [...l.querySelectorAll(".bn-box")].map((b) => b.dataset.box)]));
  // what the shelf should hold, from the data: the lucky boxes, then the
  // thinking ones, each in its data order, an unlocking box (Comet Moon,
  // Moon Call, Hop by Fives, Sum Bingo) only once its own box has been
  // finished enough times
  const want = (moonDone) => page.evaluate((m) => {
    const done = { moon: m ? 2 : 0 };
    const ok = window.BoardData.BOXES.filter((b) => !b.unlockAfter || (done[b.unlockAfter.box] || 0) >= b.unlockAfter.games);
    return ok.filter((b) => (b.kind || "luck") === "luck").concat(ok.filter((b) => b.kind === "think")).map((b) => b.id);
  }, moonDone);
  assert.deepEqual(await boxes(), await want(false), "a fresh shelf: every box but Comet Moon, nothing locked");
  assert.deepEqual((await boxes()).slice(0, 2), ["moon", "rainbow"], "Moon Race and Rainbow Trail first");
  // every box is on the shelf its data names, and a thinking game is never
  // on the lucky shelf (derived, so a new box is checked the day it lands)
  for (const [kind, ids] of await kinds()) {
    for (const id of ids) assert.equal(await page.evaluate((b) => window.BoardData.box(b).kind || "luck", id), kind, `${id} stands on the ${kind} shelf`);
  }
  assert.deepEqual((await kinds()).map((k) => k[0]), ["luck", "think"], "the lucky games first, then the thinking games");
  const heads = await page.evaluate(() => [...document.querySelectorAll("#screen-board-home .bn-shelves__head")].map((h) => h.textContent));
  assert.equal(heads.length, 2, "each shelf has its heading");
  assert.ok(await page.evaluate(() => [...document.querySelectorAll(".bn-boxes")].every((l) => l.dataset.cols === "2")), "each shelf stands two by two");
  assert.equal(await page.locator("#screen-board-home [aria-disabled], #screen-board-home .bn-box[disabled]").count(), 0, "nothing on the shelf is locked or greyed");
  // no row is ragged: an ODD shelf's last box spans both columns, an even
  // one's is a box like the rest (checked on every shelf this test sees)
  const shelfEven = async () => {
    const rs = await page.evaluate(() => [...document.querySelectorAll("#screen-board-home .bn-boxes")].map((list) => {
      const bs = [...list.querySelectorAll(".bn-box")].map((b) => b.getBoundingClientRect());
      const last = bs[bs.length - 1];
      return { kind: list.dataset.kind, n: bs.length, lastW: last.width, listW: list.getBoundingClientRect().width, otherW: bs[0].width };
    }));
    for (const r of rs) {
      if (r.n % 2) assert.ok(Math.abs(r.lastW - r.listW) < 2 && r.lastW > r.otherW * 1.8, `an odd shelf's last box spans the row (${JSON.stringify(r)})`);
      else assert.ok(Math.abs(r.lastW - r.otherW) < 2, `an even shelf's last box is a box like the rest (${JSON.stringify(r)})`);
    }
  };
  await shelfEven();
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true, done: { moon: 1 } }));
  await go("#board-home", "#screen-board-home");
  assert.deepEqual(await boxes(), await want(false), "one Moon game is not enough");
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true, done: { moon: 2 } }));
  await go("#board-home", "#screen-board-home");
  assert.deepEqual(await boxes(), await want(true), "after two, Comet Moon is on the lucky shelf…");
  assert.deepEqual((await boxes()).slice(0, 2), ["moon", "comet"], "…beside Moon Race");
  await shelfEven();
  // a deep link to a box that is not on the shelf yet goes nowhere
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await page.evaluate(() => { location.hash = "#board-who-comet"; });
  await page.locator("#screen-start").waitFor({ state: "visible", timeout: 8000 });
});

test("who's playing: a friend in the iPad is one of the three friends, in a tablet; a person here is any of six", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await go("#board-home", "#screen-board-home");
  await page.locator('.bn-box[data-box="moon"]').click();
  await page.locator("#screen-board-who").waitFor({ state: "visible" });
  assert.equal(await page.locator("#screen-board-who .bn-keep").isHidden(), true, "no game waiting: no carry-on card");
  await page.waitForTimeout(400);
  await page.locator(".bn-mode--cpu").click();
  await page.locator("#screen-board-pick").waitFor({ state: "visible" });
  const cpuPeople = await page.evaluate(() => [...document.querySelectorAll(".bn-person")].map((b) => [b.dataset.who, !!b.querySelector(".bn-tablet")]));
  assert.deepEqual(cpuPeople, [["river", true], ["raegar", true], ["viraj", true]], "the computer is River, Raegar or Viraj, each in a tablet");
  await go("#board-pick-moon-here", "#screen-board-pick");
  const here = await page.evaluate(() => [...document.querySelectorAll(".bn-person")].map((b) => [b.dataset.who, !!b.querySelector(".bn-tablet")]));
  assert.equal(here.length, 6, "six people can sit beside him");
  assert.ok(here.every((p) => !p[1]), "a person here is never drawn in a tablet");
  await page.locator('.bn-person[data-who="dad"]').click();
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  const s = await st();
  assert.deepEqual(s.seats.map((x) => [x.who, x.cpu]), [["josh", false], ["dad", false]], "Josh and Dad, both real");
  assert.equal(s.board, "moon");
});

test("a whole Moon Race against the computer: every tap is ONE hop, the computer plays itself, and it ends in one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("moon", "river", true, 7, 0);
  assert.equal((await st()).turn, 0, "against the computer, Josh starts");
  let rolls = 0, hops = 0;
  for (let guard = 0; guard < 400; guard++) {
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    const before = await page.evaluate(() => window.__BOARD.shown());
    const mover = s.mover;
    await page.locator(".bn-pad--0").click();
    if (s.phase === "roll") {
      rolls++;
      await page.waitForFunction(() => window.__BOARD.state().phase !== "roll" || window.__BOARD.state().turn !== 0);
      continue;
    }
    // a hop: exactly one square further for the token that moves this turn
    hops++;
    await page.waitForTimeout(60);
    const after = await page.evaluate(() => window.__BOARD.shown());
    const moved = after[mover] - before[mover];
    // the last hop can ride a booster, which moves further — that is the ride, not the tap
    const rode = (await st()).seats[mover].stars > s.seats[mover].stars;
    if (!rode) assert.equal(moved, 1, `one tap, one hop (from ${before[mover]} went to ${after[mover]})`);
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.ok(end.seats.every((x) => x.home), "both players get home — nobody loses");
  assert.ok(rolls > 2 && hops >= rolls, `he rolled (${rolls}) and hopped (${hops})`);
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal(await page.locator(".bn-party .bn-party__face").count(), 2, "one party, both faces");
  const sv = await page.evaluate(() => window.__BOARD.save());
  assert.equal(sv.done.moon, 1, "a finished game counts once");
  assert.equal(sv.games.moon, undefined, "and leaves nothing waiting on the box");
  } finally { await slow(); }   // a failure must not leave the next test at the quick pace
});

test("the booster: a roll that ends at a rocket's foot rides to its top and earns a ⭐", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  // seed 20: his first roll is 3, so 1 → 2 → 3 → 4, and the rocket at 4 goes to 15
  const s0 = L.create({ board: "moon", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed: 20, first: 0 });
  assert.equal(L.roll(s0)[0].die, 3, "fixture: seed 20 rolls a 3 first");
  await startGame("moon", "river", true, 20, 0);
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => window.__BOARD.state().phase === "hop" && !window.__BOARD.busy());
  for (let k = 0; k < 3; k++) {
    await page.locator(".bn-pad--0").click();
    await page.waitForTimeout(320);
  }
  await page.waitForFunction(() => window.__BOARD.shown()[0] === 15, null, { timeout: 8000 });
  const s = await st();
  assert.equal(s.seats[0].pos, 15, "the rocket carried him to 15");
  assert.equal(s.seats[0].stars, 1, "and gave him a star");
  assert.equal(await page.locator(".bn-token--0").getAttribute("data-pos"), "15", "his token stands on 15");
});

test("a token never hides its square's number: he counts his hops by it", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  const s = L.create({ board: "moon", seats: [{ who: "josh" }, { who: "dad" }], seed: 3, first: 0 });
  s.seats[0].pos = 8; s.seats[1].pos = 27;
  assert.ok(await page.evaluate((x) => window.__BOARD.load("moon", x), s), "fixture: the game loads");
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const out = [];
    for (const t of document.querySelectorAll(".bn-token")) {
      const n = t.dataset.pos;
      const disc = [...document.querySelectorAll(".bn-svg circle")].find((c) => {
        const cell = document.querySelector('.bn-cell[data-n="' + n + '"]').getBoundingClientRect();
        const b = c.getBoundingClientRect();
        return b.left >= cell.left - 1 && b.top >= cell.top - 1 && b.right <= cell.left + cell.width * 0.5 && b.bottom <= cell.top + cell.height * 0.5;
      });
      const d = disc.getBoundingClientRect(), k = t.getBoundingClientRect();
      // the token's whole drawn size: its box plus the 7px halo it may wear
      const tr = k.width / 2 + 7, dx = (d.left + d.width / 2) - (k.left + k.width / 2), dy = (d.top + d.height / 2) - (k.top + k.height / 2);
      out.push({ n, gap: Math.hypot(dx, dy) - tr });
    }
    return out;
  });
  for (const x of r) assert.ok(x.gap > 0, `the token on ${x.n} covers the middle of its number (${x.gap.toFixed(1)}px)`);
});

test("a tap on the pad whose turn it isn't is a kind wiggle, and changes nothing", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await startGame("moon", "dad", false, 3, 0);
  const before = await st();
  await page.locator(".bn-pad--1").click();
  assert.ok(await page.locator(".bn-pad--1").evaluate((p) => p.classList.contains("bn-wiggle")), "Dad's pad wiggles");
  assert.deepEqual(await st(), before, "nothing in the game moved");
  // The waiting pad says "not your turn" by dimming its PICTURES only. Its ⭐
  // count is text, and opacity on the whole pad would take that text under AA
  // (the contrast audit reads an element's own opacity, never a parent's, so
  // it could not see a whole-pad dim — this clause does).
  const dim = await page.locator(".bn-pad--1").evaluate((p) => {
    const eff = (el) => { let o = 1; for (let q = el; q; q = q.parentElement) o *= parseFloat(getComputedStyle(q).opacity || "1"); return o; };
    return { wait: p.classList.contains("bn-pad--wait"), face: eff(p.querySelector(".bn-pad__face")), stars: eff(p.querySelector(".bn-pad__stars")) };
  });
  assert.ok(dim.wait, "fixture: Dad's pad is the waiting one");
  assert.ok(dim.face < 0.7, `the waiting pad's picture is dimmed (${dim.face})`);
  assert.equal(dim.stars, 1, "the waiting pad's ⭐ count is never dimmed");
});

test("a double-tap is never two hops: a tap while the last hop is still moving is the echo", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await startGame("moon", "dad", false, 3, 0);   // seed 3: his first roll is 5
  const pad = await page.locator(".bn-pad--0").boundingBox();
  const x = pad.x + pad.width / 2, y = pad.y + pad.height / 2;
  await page.mouse.click(x, y);
  await page.waitForFunction(() => window.__BOARD.state().phase === "hop" && !window.__BOARD.busy());
  assert.equal((await st()).left, 5, "fixture: five hops to go");
  // two real taps 100ms apart, the way a four-year-old hammers
  await page.mouse.click(x, y);
  await page.waitForTimeout(100);
  await page.mouse.click(x, y);
  await page.waitForTimeout(400);
  assert.equal((await st()).left, 4, "two taps inside one hop are ONE hop");
  // …while a deliberate tap after the hop has landed is the next hop
  await page.mouse.click(x, y);
  await page.waitForTimeout(400);
  assert.equal((await st()).left, 3, "a tap after the hop lands is the next hop");
});

test("two people take turns: the pads hand over only once the move has finished, and the card stays on the pad that drew it", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await startGame("rainbow", "mom", false, 7, 0);
  const on = () => page.evaluate(() => [...document.querySelectorAll(".bn-pad")].map((p) => p.classList.contains("bn-pad--on")));
  assert.deepEqual(await on(), [true, false], "Josh's pad is lit");
  await page.locator(".bn-pad--0").click();
  // the engine has already handed the turn to Mom; the SCREEN must not have yet
  await page.waitForTimeout(150);
  assert.equal((await st()).turn, 1, "fixture: the engine's turn moved on at once");
  assert.deepEqual(await on(), [true, false], "while his card glides, his pad is still the lit one");
  const acts = await page.evaluate(() => [...document.querySelectorAll(".bn-pad__act")].map((a) => a.querySelector(".bn-card--back") ? "back" : a.querySelector(".bn-card") ? "card" : "?"));
  assert.deepEqual(acts, ["card", "back"], "the card he drew shows on HIS pad, not Mom's");
  await untilTap(1);
  assert.deepEqual(await on(), [false, true], "then Mom's pad lights");
});

test("two people take turns STARTING; against the computer Josh always starts", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  const firsts = [];
  for (let k = 0; k < 3; k++) {
    await go("#board-pick-rainbow-here", "#screen-board-pick");
    await page.locator('.bn-person[data-who="mom"]').click();
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    firsts.push((await st()).turn);
  }
  assert.deepEqual(firsts, [0, 1, 0], "Josh, then Mom, then Josh");
  for (let k = 0; k < 2; k++) {
    await go("#board-pick-rainbow-cpu", "#screen-board-pick");
    await page.locator('.bn-person[data-who="viraj"]').click();
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    assert.equal((await st()).turn, 0, "against the computer, Josh starts");
  }
});

test("a game in progress waits on its box: the shelf shows who is playing, and carry-on restores it exactly", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("moon", "raegar", true, 11, 0);
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => window.__BOARD.state().phase === "hop" && !window.__BOARD.busy());
  await page.locator(".bn-pad--0").click();
  await page.waitForTimeout(200);
  const kept = await st();
  await go("#board-home", "#screen-board-home");
  assert.equal(await page.locator('.bn-box[data-box="moon"] .bn-box__peek').count(), 2, "both players peek out of the Moon box");
  await page.locator('.bn-box[data-box="moon"]').click();
  await page.locator("#screen-board-who").waitFor({ state: "visible" });
  assert.equal(await page.locator("#screen-board-who .bn-keep").isVisible(), true, "a carry-on card");
  // a reload: the save is all that is left
  await page.reload({ waitUntil: "load" });
  await go("#board-who-moon", "#screen-board-who");
  await page.locator("#screen-board-who .bn-keep").click();
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(200);
  const back = await st();
  assert.deepEqual(back.seats.map((x) => [x.who, x.pos, x.cpu]), kept.seats.map((x) => [x.who, x.pos, x.cpu]), "the same players on the same squares");
  assert.equal(back.left, kept.left, "and the same hops still to go");
  } finally { await slow(); }
});

test("a game left for more than a day is gone from its box (decision 9); a game from the future too", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  const make = (at) => page.evaluate((t) => {
    const s = window.BoardLogic.create({ board: "moon", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed: 5, first: 0 });
    const save = { v: 1, games: { moon: { st: s, at: Date.now() + t } }, done: {}, intro: { dice: true, cards: true }, auto: false, next: {}, last: null };
    localStorage.setItem("josh-board-v1", JSON.stringify(save));
  }, at);
  await make(-23 * 3600 * 1000);
  await page.reload({ waitUntil: "load" });
  await go("#board-home", "#screen-board-home");
  assert.equal(await page.locator('.bn-box[data-box="moon"] .bn-box__peek').count(), 2, "23 hours on: still waiting");
  await make(-25 * 3600 * 1000);
  await page.reload({ waitUntil: "load" });
  await go("#board-home", "#screen-board-home");
  assert.equal(await page.locator('.bn-box[data-box="moon"] .bn-box__peek').count(), 0, "25 hours on: gone");
  await make(5 * 3600 * 1000);
  await page.reload({ waitUntil: "load" });
  await go("#board-home", "#screen-board-home");
  assert.equal(await page.locator('.bn-box[data-box="moon"] .bn-box__peek').count(), 0, "a game stamped in the future is not trusted");
});

test("a hand-edited or broken save never breaks Game Night", async () => {
  for (const bad of ['{"v":1,"games":{"moon":{"st":{"v":1,"board":"moon"},"at":1}}}', "{}", "[]", "nonsense", '{"v":1,"done":{"moon":"lots"},"next":{"moon":7},"last":{"box":"x"}}']) {
    await page.evaluate((b) => localStorage.setItem("josh-board-v1", b), bad);
    await page.reload({ waitUntil: "load" });
    await go("#board-home", "#screen-board-home");
    assert.ok(await page.locator(".bn-box").count() >= 2, `the shelf still shows its boxes for ${bad}`);
  }
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
});

test("the first time ever, a hand shows how; it goes once he has done it, and 👂 brings it back", async () => {
  await page.evaluate(() => window.__BOARD.reset());
  await startGame("moon", "river", true, 3, 0);
  assert.equal(await page.locator(".bn-hand").isVisible(), true, "the hand points at his pad");
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => window.__BOARD.state().phase === "hop" && !window.__BOARD.busy());
  await page.locator(".bn-pad--0").click();
  await page.waitForTimeout(300);
  assert.equal((await page.evaluate(() => window.__BOARD.save())).intro.dice, true, "he has hopped: the dice are learned");
  assert.equal(await page.locator(".bn-hand").isHidden(), true, "and the hand has gone");
  await page.locator("#screen-board-play .bn-hear").click();
  assert.equal(await page.locator(".bn-hand").isVisible(), true, "👂 shows the hand again");
});

test("the grown-up switch: hops by themselves after a roll, and it is remembered", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await go("#board-home", "#screen-board-home");
  const auto = page.locator("#screen-board-home .bn-auto");
  assert.equal(await auto.getAttribute("aria-pressed"), "false", "by tap is the default");
  await auto.click();
  assert.equal(await auto.getAttribute("aria-pressed"), "true");
  assert.equal((await page.evaluate(() => window.__BOARD.save())).auto, true, "remembered");
  await startGame("moon", "dad", false, 3, 0);   // a 5
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => window.__BOARD.state().turn === 1, null, { timeout: 15000 });
  assert.equal((await st()).seats[0].pos, 6, "five hops with no more taps: 1 → 6");
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
});

test("the voice: every line is words (never a picture, never a {placeholder}) and the cards name a colour AND a shape", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await page.evaluate(() => {
    window.__said = [];
    window.__realAudio = { isMuted: window.JoshAudio.isMuted, say: window.JoshAudio.say, tone: window.JoshAudio.tone };
    window.JoshAudio.isMuted = () => false;
    window.JoshAudio.say = (t) => { window.__said.push(String(t)); };
    window.JoshAudio.tone = () => {};
  });
  try {
    await quick();
    await startGame("rainbow", "viraj", true, 9, 0);
    for (let k = 0; k < 6; k++) {
      await untilTap(0);
      if ((await st()).phase === "done") break;
      await page.locator(".bn-pad--0").click();
      await page.waitForTimeout(100);
    }
    await startGame("moon", "viraj", true, 20, 0);
    for (let k = 0; k < 8; k++) {
      await untilTap(0);
      await page.locator(".bn-pad--0").click();
      await page.waitForTimeout(80);
    }
    const said = await page.evaluate(() => window.__said);
    assert.ok(said.length > 10, `it spoke (${said.length} lines)`);
    const bad = said.filter((t) => /\{\w+\}/.test(t) || /\p{Extended_Pictographic}/u.test(t) || /undefined|null/.test(t));
    assert.deepEqual(bad, [], "no line carries a placeholder, a picture or a missing name");
    const colours = ["red", "blue", "yellow", "green", "purple"], shapes = ["heart", "circle", "star", "triangle", "diamond"];
    const cards = said.filter((t) => colours.some((c) => t.toLowerCase().includes(c)));
    assert.ok(cards.length >= 3, "the cards were said");
    assert.ok(cards.every((t) => shapes.some((sh) => t.toLowerCase().includes(sh))), "every colour card names its shape too");
    assert.ok(said.some((t) => /Blast off! Up to 15/.test(t)), "the booster is said with where it goes");
    assert.ok(said.some((t) => /^Whoa, Josh!$/.test(t)), "the computer friend cheers HIM on");
    assert.ok(!said.some((t) => /\b(lose|lost|loser|last|beat|won|winner|first place)\b/i.test(t)), "never the words of a race for the one behind");
  } finally {
    await page.evaluate(() => Object.assign(window.JoshAudio, window.__realAudio));
    await slow();
  }
});

// ---- His working edges (PLAN_BOARD.md §18, part B) ----------------------------
test("🐸 🦘 Hop by Twos and Hop by Fives: the pads wear the COUNT (0, 2, 4 … 40; 0, 5 … 100), each tap is one pad and the next number is popped and said, a turn ending on a star number is a ⭐, Fives is on the shelf only after two finished Twos games, and a whole game ends in one party", async () => {
  const DATA = require("../scripts/board-data.js");
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await page.evaluate(() => {
    window.__said = [];
    window.__realAudio = { isMuted: window.JoshAudio.isMuted, say: window.JoshAudio.say, tone: window.JoshAudio.tone };
    window.JoshAudio.isMuted = () => false;
    window.JoshAudio.say = (t) => { window.__said.push(String(t)); };
    window.JoshAudio.tone = () => {};
  });
  try {
    await quick();
    // the shelf: Twos is there, Fives not yet — and never as a padlock
    await go("#board-home", "#screen-board-home");
    const boxes = () => page.evaluate(() => [...document.querySelectorAll("#screen-board-home .bn-box")].filter((b) => b.getClientRects().length).map((b) => b.dataset.box));
    assert.ok((await boxes()).indexOf("twos") >= 0, "Hop by Twos is on the shelf");
    assert.equal((await boxes()).indexOf("fives"), -1, "Hop by Fives is not there yet");
    for (const [id, step, last] of [["twos", 2, 40], ["fives", 5, 100]]) {
      await page.evaluate(() => { window.__said = []; });
      await startGame(id, "dad", false, 5, 0);
      const drawn = await page.evaluate(() => ({
        nums: [...document.querySelectorAll(".bn-svg .bn-num")].map((t) => [Number(t.dataset.n), Number(t.textContent), t.getBoundingClientRect().width, t.getBoundingClientRect().height]),
        pads: [...document.querySelectorAll(".bn-svg .bn-cell")].map((c) => { const r = c.getBoundingClientRect(); return [r.width, r.height]; }),
      }));
      assert.equal(drawn.nums.length, 21, `${id}: twenty pads and the start`);
      assert.deepEqual(drawn.nums.map((n) => n[1]), Array.from({ length: 21 }, (x, k) => k * step), `${id}: the pads wear 0, ${step}, ${2 * step} … ${last}`);
      // a number he can read: it fits inside its pad with room, and is not tiny
      const pad = drawn.pads[0][0];
      for (const [n, lab, w, h] of drawn.nums) {
        assert.ok(w <= pad * 0.5 && h >= 13, `${id}: "${lab}" is ${Math.round(w)}x${Math.round(h)} on a ${Math.round(pad)}px pad`);
      }
      assert.ok(pad >= 44, `${id}: a pad is ${Math.round(pad)}px on a phone`);
      // one roll: every tap is ONE pad, popped and said as the count
      await untilTap(0);
      await page.locator(".bn-pad--0").click();
      await page.waitForFunction(() => window.__BOARD.state().phase === "hop" && !window.__BOARD.busy(), null, { timeout: 5000 });
      // 👂 says what a hop is worth here
      await page.locator("#screen-board-play .bn-hear").click();
      await page.waitForTimeout(60);
      const die = (await st()).die;
      assert.ok([1, 2, 3].indexOf(die) >= 0, `${id}: the die is one, two or three hops`);
      const want = [];
      for (let k = 1; k <= die; k++) {
        await page.locator(".bn-pad--0").click();
        await page.waitForFunction((n) => document.querySelector(".bn-token--0").dataset.pos === String(n), k + 1, { timeout: 5000 });
        want.push(String(k * step));
        assert.equal(await page.evaluate(() => document.querySelector(".bn-pop").textContent), String(k * step), `${id}: hop ${k} pops ${k * step}`);
        await page.waitForTimeout(80);
      }
      const said = await page.evaluate(() => window.__said);
      assert.deepEqual(said.filter((t) => /^\d+$/.test(t)).slice(-die), want, `${id}: the count is said: ${want.join(", ")}`);
      assert.ok(said.some((t) => t === DATA.board(id).lines.hop), `${id}: it says what a hop is worth ("${said.join(" | ")}")`);
      assert.equal(await page.locator("#screen-board-play .bn-board").getAttribute("aria-label").then((l) => new RegExp("Josh is on " + die * step + "\\b").test(l)), true, `${id}: the board's name says the NUMBER he is on`);
    }
    // a turn ending on a star number is a ⭐ (popped on the pad, counted on his pad)
    {
      const s = L.create({ board: "twos", seats: [{ who: "josh" }, { who: "dad" }], seed: 5, first: 0 });
      s.seats[0].pos = 4; s.seats[0].bag = [2];     // on 6: two hops end on 10
      assert.ok(L.restore(s), "fixture: a real game");
      assert.ok(await page.evaluate((x) => window.__BOARD.load("twos", x), s), "fixture: the game loads");
      await page.locator("#screen-board-play").waitFor({ state: "visible" });
      await page.waitForTimeout(450);
      await page.evaluate(() => { window.__said = []; });
      await page.locator(".bn-pad--0").click();
      await page.waitForFunction(() => window.__BOARD.state().phase === "hop" && !window.__BOARD.busy(), null, { timeout: 5000 });
      await page.locator(".bn-pad--0").click();
      await page.waitForFunction(() => document.querySelector(".bn-token--0").dataset.pos === "5", null, { timeout: 5000 });
      await page.locator(".bn-pad--0").click();
      await page.waitForFunction(() => window.__BOARD.state().seats[0].stars === 1 && window.__BOARD.state().turn === 1 && !window.__BOARD.busy(), null, { timeout: 8000 });
      const said = await page.evaluate(() => window.__said);
      assert.ok(said.indexOf("10! A star!") >= 0, `ending on ten is a star, said with its NUMBER ("${said.join(" | ")}")`);
      assert.equal(await page.evaluate(() => (document.querySelector(".bn-pad--0 .bn-pad__stars").textContent.match(/\d+/) || [""])[0]), "1", "…and counted on his pad");
    }
    // a whole game against the computer, to the party
    await page.evaluate(() => { window.__said = []; });
    await startGame("twos", "river", true, 7, 0);
    for (let g = 0; g < 200; g++) {
      await untilTap(0);
      if ((await st()).phase === "done") break;
      await page.locator(".bn-pad--0").click();
      await page.waitForTimeout(40);
    }
    assert.equal((await st()).phase, "done", "the game ends");
    await page.locator(".bn-party").waitFor({ state: "visible", timeout: 8000 });
    const end = await page.evaluate(() => window.__said);
    assert.ok(end.some((t) => /hopped all the way to forty/.test(t)), "home is said as forty");
    assert.ok(end.indexOf(DATA.board("twos").lines.end) >= 0, "one party for both, by name of the count");
    assert.ok(!end.some((t) => /\{\w+\}|undefined/.test(t)), "every line is whole");
    // two finished Twos games bring Hop by Fives to the shelf
    await page.evaluate(() => window.__BOARD.reset({ introSeen: true, done: { twos: 2 } }));
    await go("#board-home", "#screen-board-home");
    assert.ok((await boxes()).indexOf("fives") >= 0, "after two Twos games, Hop by Fives is on the shelf");
  } finally {
    await page.evaluate(() => { Object.assign(window.JoshAudio, window.__realAudio); window.__BOARD.reset({ introSeen: true }); });
    await slow();
  }
});

test("➕ ➖ the sums are SAID: Pick a Die says where he stands, how many more and where that lands ('12 and 3 more is 15!'); Apple Spin's bird is a take-away ('4 take away one is 3'); and the hen house is counted by TENS at the end (10, 20, 30, 35), popped over it", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await page.evaluate(() => {
    window.__said = [];
    window.__realAudio = { isMuted: window.JoshAudio.isMuted, say: window.JoshAudio.say, tone: window.JoshAudio.tone };
    window.JoshAudio.isMuted = () => false;
    window.JoshAudio.say = (t) => { window.__said.push(String(t)); };
    window.JoshAudio.tone = () => {};
    // every number the board pops, in order
    window.__pops = [];
    window.__popWatch = new MutationObserver(() => { const p = document.querySelector(".bn-pop"); if (p && !p.hidden && window.__pops[window.__pops.length - 1] !== p.textContent) window.__pops.push(p.textContent); });
    window.__popWatch.observe(document.querySelector(".bn-pop"), { childList: true, characterData: true, subtree: true });
  });
  try {
    await quick();
    // 🎲 Pick a Die: the pick is a sum
    await startGame("pickdie", "dad", false, 4, 0);
    let sums = 0;
    for (let g = 0; g < 12 && sums < 3; g++) {
      const x = await st();
      if (x.phase === "done") break;
      await untilTap(x.turn);
      await page.locator(".bn-pad--" + x.turn).click();
      await page.locator(".bn-choose").waitFor({ state: "visible", timeout: 5000 });
      const before = await st();
      const from = before.seats[before.mover].pos;
      await page.evaluate(() => { window.__said = []; });
      await page.locator(".bn-choose button.bn-pickd").first().click();
      await page.waitForFunction(() => window.__BOARD.state().phase === "hop" && !window.__BOARD.busy(), null, { timeout: 5000 });
      const die = (await st()).die;
      const said = await page.evaluate(() => window.__said);
      if (from + die < 36) {
        assert.ok(said.indexOf(`${from} and ${die} more is ${from + die}!`) >= 0, `from ${from}, a ${die} is said as a sum ("${said.join(" | ")}")`);
        sums++;
      }
      for (let k = 0; k < die && (await st()).phase === "hop"; k++) { await page.locator(".bn-pad--" + before.turn).click(); await page.waitForTimeout(120); }
      await page.waitForFunction(() => !window.__BOARD.busy(), null, { timeout: 8000 });
    }
    assert.ok(sums >= 3, `fixture: three picks were heard as sums (${sums})`);
    // 🍎 the bird: a take-away
    const a = L.create({ board: "apple", seats: [{ who: "josh" }, { who: "dad" }], seed: 3, first: 0, birds: true });
    a.seats[0].pos = 4; a.seats[0].bag = [0];
    assert.ok(await page.evaluate((x) => window.__BOARD.load("apple", x), a), "fixture: the game loads");
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    await page.waitForTimeout(450);
    await page.evaluate(() => { window.__said = []; });
    await page.locator(".bn-pad--0").click();
    await page.waitForFunction(() => window.__BOARD.state().seats[0].pos === 3 && !window.__BOARD.busy(), null, { timeout: 8000 });
    const birdSaid = await page.evaluate(() => window.__said);
    assert.ok(birdSaid.some((t) => /4 take away one is 3\./.test(t)), `the bird is a take-away, with both numbers ("${birdSaid.join(" | ")}")`);
    // 🐔 the hen house, counted by tens
    const h = L.create({ board: "hen", seats: [{ who: "josh" }, { who: "dad" }], seed: 3, first: 0 });
    h.seats[0].pos = h.seats[1].pos = 33; h.coop = 32;
    assert.ok(L.restore(h), "fixture: a real game, near its end");
    assert.ok(await page.evaluate((x) => window.__BOARD.load("hen", x), h), "fixture: the game loads");
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    await page.waitForTimeout(450);
    await page.evaluate(() => { window.__said = []; window.__pops = []; });
    for (let g = 0; g < 40; g++) {
      const x = await st();
      if (x.phase === "done") break;
      await untilTap(x.turn);
      if ((await st()).phase === "done") break;
      await page.locator(".bn-pad--" + (await st()).turn).click();
      await page.waitForTimeout(60);
    }
    await page.locator(".bn-party").waitFor({ state: "visible", timeout: 15000 });
    const pops = await page.evaluate(() => window.__pops), henSaid = await page.evaluate(() => window.__said);
    assert.deepEqual(pops.slice(-4), ["10", "20", "30", "35"], `the hen house is counted by tens, popped (${pops.join(" ")})`);
    const k = henSaid.lastIndexOf("10");
    assert.deepEqual(henSaid.slice(k, k + 4), ["10", "20", "30", "35"], `…and said ("${henSaid.join(" | ")}")`);
    const home = henSaid.indexOf(require("../scripts/board-data.js").SAY.henHome);
    assert.ok(home >= 0 && home < k, `…right after "all home", which it counts out ("${henSaid.join(" | ")}")`);
  } finally {
    await page.evaluate(() => { Object.assign(window.JoshAudio, window.__realAudio); if (window.__popWatch) window.__popWatch.disconnect(); window.__BOARD.reset({ introSeen: true }); });
    await slow();
  }
});

test("🔭 Moon Call: after two Moon games it is on the shelf; roll, then CALL where the hops end from three big numbers (the real one and two near it, nothing on the board giving it away); right is a ⭐, the sum said and the hops play themselves; a miss costs nothing and he hops it out; a whole game ends in one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await go("#board-home", "#screen-board-home");
  const boxes = () => page.evaluate(() => [...document.querySelectorAll("#screen-board-home .bn-box")].filter((b) => b.getClientRects().length).map((b) => b.dataset.box));
  assert.equal((await boxes()).indexOf("call"), -1, "Moon Call waits for two finished Moon games");
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true, done: { moon: 2 } }));
  await go("#board-home", "#screen-board-home");
  assert.ok((await boxes()).indexOf("call") >= 0, "…then it is on the shelf");
  await page.evaluate(() => {
    window.__said = [];
    window.__realAudio = { isMuted: window.JoshAudio.isMuted, say: window.JoshAudio.say, tone: window.JoshAudio.tone };
    window.JoshAudio.isMuted = () => false;
    window.JoshAudio.say = (t) => { window.__said.push(String(t)); };
    window.JoshAudio.tone = () => {};
  });
  const callNow = () => page.evaluate(() => ({
    phase: window.__BOARD.state().phase,
    btns: [...document.querySelectorAll(".bn-choose button.bn-callnum")].map((b) => { const r = b.getBoundingClientRect(); return { n: Number(b.dataset.call), w: r.width, h: r.height, l: r.left, r: r.right, hint: b.classList.contains("bn-pickd--hint") }; }),
    targets: [...document.querySelectorAll(".bn-target")].filter((t) => !t.hidden).map((t) => ({ n: Number(t.dataset.n), from: t.classList.contains("bn-target--from"), dots: t.querySelectorAll(".bn-dot:not(.bn-dot--none)").length, seen: (() => { const d = t.querySelector(".bn-die"), r = d.getBoundingClientRect(); t.style.pointerEvents = "auto"; const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); t.style.pointerEvents = ""; return !!(e && t.contains(e)); })() })),
  }));
  try {
    await quick();
    // 1) his FIRST Moon Call game lights the right number: a worked example
    await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
    await page.evaluate(() => { window.__BOARD.reset({ introSeen: true, done: { moon: 2 } }); });
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("josh-board-v1")); s.intro.call = false; localStorage.setItem("josh-board-v1", JSON.stringify(s)); });
    await page.reload();
    await page.evaluate(() => {
      window.__said = [];
      window.__realAudio = { isMuted: window.JoshAudio.isMuted, say: window.JoshAudio.say, tone: window.JoshAudio.tone };
      window.JoshAudio.isMuted = () => false;
      window.JoshAudio.say = (t) => { window.__said.push(String(t)); };
      window.JoshAudio.tone = () => {};
    });
    await quick();
    assert.equal((await page.evaluate(() => window.__BOARD.save())).intro.call, false, "fixture: Moon Call has never been shown");
    await startGame("call", "dad", false, 9, 0);
    let rights = 0, misses = 0;
    for (let g = 0; g < 30 && (rights < 1 || misses < 1); g++) {
      const x = await st();
      if (x.phase === "done") break;
      await untilTap(x.turn);
      const y = await st();
      if (y.phase === "done") break;
      await page.locator(".bn-pad--" + y.turn).click();
      await page.waitForFunction(() => { const s = window.__BOARD.state(); return (s.phase === "call" || s.phase === "hop" || s.phase === "done") && !window.__BOARD.busy(); }, null, { timeout: 5000 });
      const z = await st();
      if (z.phase !== "call") { // a roll that reaches the Moon is hopped as ever
        for (let k = 0; k < 8 && (await st()).phase === "hop"; k++) { await page.locator(".bn-pad--" + z.turn).click(); await page.waitForTimeout(80); }
        continue;
      }
      const c = await callNow();
      const from = z.seats[z.mover].pos, to = from + z.die;
      assert.equal(c.btns.length, 3, "three numbers to call");
      assert.deepEqual(c.btns.map((b) => b.n), z.calls, "the buttons are the engine's three, in counting order");
      assert.ok(c.btns.some((b) => b.n === to), "one of them is where the hops really end");
      assert.ok(c.btns.every((b) => Math.abs(b.n - to) <= 2), "the others are NEAR misses (one or two off)");
      for (const b of c.btns) assert.ok(b.w >= 75 && b.h >= 75, `a number is ${Math.round(b.w)}x${Math.round(b.h)}`);
      for (let k = 1; k < 3; k++) assert.ok(c.btns[k].l - c.btns[k - 1].r >= 16, "16px apart");
      // the numbers cover the pads, so the QUESTION is on the board: his die,
      // over the square he hops from — and nothing on the answer's square
      assert.equal(c.targets.length, 1, "one thing on the board: the die he hops by");
      assert.deepEqual(c.targets.map((t) => [t.n, t.from, t.dots, t.seen]), [[from, true, z.die, true]], "his die, all its dots, in sight over the square he hops FROM");
      assert.deepEqual(c.btns.filter((b) => b.hint).map((b) => b.n), [to], "the first Moon Call game lights the right number");
      // alternate: right, then a miss
      const pick = rights === 0 ? to : c.btns.find((b) => b.n !== to).n;
      const stars0 = z.seats[z.turn].stars;
      await page.evaluate(() => { window.__said = []; });
      await page.locator('.bn-choose button.bn-callnum[data-call="' + pick + '"]').click();
      if (pick === to) {
        rights++;
        // the hops play THEMSELVES: no tap, and the token lands on the call
        await page.waitForFunction((a) => { const s = window.__BOARD.state(); return s.seats[a.m].pos !== a.from && !window.__BOARD.busy() && s.phase !== "hop"; }, { m: z.mover, from }, { timeout: 8000 });
        const after = await st();
        assert.equal(after.seats[z.turn].stars, stars0 + 1 + (after.seats[z.mover].pos !== to ? 1 : 0), "a right call is a ⭐ (and a rocket its own)");
        const said = await page.evaluate(() => window.__said);
        assert.ok(said.indexOf(`Yes! ${from} and ${z.die} more is ${to}! A star!`) >= 0, `the sum is said ("${said.join(" | ")}")`);
      } else {
        misses++;
        await page.waitForFunction(() => window.__BOARD.state().phase === "hop" && !window.__BOARD.busy(), null, { timeout: 5000 });
        const after = await st();
        assert.equal(after.seats[z.turn].stars, stars0, "a miss costs nothing and gives nothing");
        assert.equal(after.seats[z.mover].pos, from, "…and the hops are HIS to tap");
        const said = await page.evaluate(() => window.__said);
        assert.ok(said.indexOf("Let's hop and count to see!") >= 0, `a miss says nothing against him ("${said.join(" | ")}")`);
        assert.ok(!said.some((t) => /wrong|no!|oops/i.test(t)), "never a scold");
        for (let k = 0; k < z.die; k++) { await page.locator(".bn-pad--" + z.turn).click(); await page.waitForTimeout(90); }
        await page.waitForFunction((a) => window.__BOARD.state().seats[a.m].pos >= a.to, { m: z.mover, to }, { timeout: 5000 });
      }
    }
    assert.ok(rights >= 1 && misses >= 1, `fixture: a right call and a miss were both played (${rights}, ${misses})`);
    // 2) a whole game against the computer, to one party (its calls are its own)
    await page.evaluate(() => { window.__said = []; });
    await startGame("call", "river", true, 11, 0);
    let unlit = 0;
    for (let g = 0; g < 200; g++) {
      await untilTap(0);
      const x = await st();
      if (x.phase === "done") break;
      if (x.phase === "call") {
        const c = await callNow();
        assert.equal(c.btns.filter((b) => b.hint).length, 0, "after his first game nothing glows: the count is his");
        unlit++;
        await page.locator('.bn-choose button.bn-callnum[data-call="' + (x.seats[x.mover].pos + x.die) + '"]').click();
      } else await page.locator(".bn-pad--0").click();
      await page.waitForTimeout(40);
    }
    assert.equal((await st()).phase, "done", "the game ends");
    assert.ok(unlit >= 2, `fixture: he called in the second game (${unlit})`);
    await page.locator(".bn-party").waitFor({ state: "visible", timeout: 8000 });
    const end = await page.evaluate(() => window.__said);
    assert.ok(!end.some((t) => /\{\w+\}|undefined|NaN/.test(t)), "every line is whole");
  } finally {
    await page.evaluate(() => { Object.assign(window.JoshAudio, window.__realAudio); window.__BOARD.reset({ introSeen: true }); });
    await slow();
  }
});

test("➕ Sum Bingo: after two Number Bingo games it is on the shelf; his roll is TWO little dice (on his pad and over the card), the number to find is never shown or said first, the card holds 2 to 6 with their dots, a cover says the sum, and a whole game ends in one party", async () => {
  const D = require("../scripts/board-data.js");
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true, done: { bingo: 1 } }));
  await go("#board-home", "#screen-board-home");
  const boxes = () => page.evaluate(() => [...document.querySelectorAll("#screen-board-home .bn-box")].map((b) => b.dataset.box));
  assert.equal((await boxes()).indexOf("sums"), -1, "one Number Bingo is not enough");
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true, done: { bingo: 2 } }));
  await go("#board-home", "#screen-board-home");
  assert.ok((await boxes()).indexOf("sums") >= 0, "after two, Sum Bingo is on the shelf");
  await page.evaluate(() => {
    window.__said = [];
    window.__realAudio = { isMuted: window.JoshAudio.isMuted, say: window.JoshAudio.say, tone: window.JoshAudio.tone };
    window.JoshAudio.isMuted = () => false;
    window.JoshAudio.say = (t) => { window.__said.push(String(t)); };
    window.JoshAudio.tone = () => {};
  });
  try {
    await quick();
    await startGame("sums", "river", true, 5, 0);
    const card = await page.evaluate(() => [...document.querySelectorAll(".bn-bingo__grid .bn-bsq")].map((b) => [Number(b.querySelector(".bn-bsq__n").textContent), b.querySelectorAll(".bn-pip:not(.bn-pip--none)").length]));
    assert.deepEqual(card.map((c) => c[0]).sort(), [2, 3, 3, 4, 4, 4, 5, 5, 6], "the card holds 2 to 6, in the shares two dice fall");
    assert.ok(card.every((c) => c[0] === c[1]), "each number wears its dots, so counting all is enough");
    let covered = 0, saw = 0;
    for (let guard = 0; guard < 160; guard++) {
      await untilTap(0);
      const s = await st();
      if (s.phase === "done") break;
      if (s.phase === "roll") {
        await page.evaluate(() => { window.__said = []; });
        await page.locator(".bn-pad--0").click();
        await page.waitForFunction((r) => { const x = window.__BOARD.state(); return x.rolls > r && (x.phase !== "cover" || !window.__BOARD.busy()); }, s.rolls, { timeout: 6000 });
        const x = await st();
        if (x.phase !== "cover") continue;
        // two dice to add, on his pad and over the card — and no number
        const view = await page.evaluate(() => ({
          pad: [...document.querySelectorAll(".bn-pad--0 .bn-dice2 .bn-die")].map((d) => d.querySelectorAll(".bn-dot:not(.bn-dot--none)").length),
          top: [...document.querySelectorAll(".bn-bingo__top .bn-goal__die")].map((d) => d.querySelectorAll(".bn-pip:not(.bn-pip--none)").length),
          num: document.querySelector(".bn-bingo__top .bn-goal__n"),
          said: window.__said.slice(),
        }));
        assert.deepEqual(view.pad, x.dice, "his pad shows the two dice");
        assert.deepEqual(view.top, x.dice, "the card's top shows the two dice to add");
        assert.equal(view.num, null, "the sum itself is not shown: counting all the dots is his");
        const find = D.SAY.bingoSumFind.replace("{a}", x.dice[0]).replace("{b}", x.dice[1]);
        assert.ok(view.said.indexOf(find) >= 0, `the dice are said, not the sum ("${view.said.join(" | ")}")`);
        assert.ok(!view.said.some((t) => t === String(x.die) || t.indexOf("make " + x.die) >= 0), "the sum is not said before he finds it");
        saw++;
        const k = (await page.evaluate(() => window.BoardLogic.bingoSpots(window.__BOARD.state())))[0];
        await page.evaluate(() => { window.__said = []; });
        await page.locator('.bn-bingo__grid button.bn-bsq[data-k="' + k + '"]').click();
        await page.waitForFunction((kk) => window.__BOARD.state().covered[0][kk], k, { timeout: 5000 });
        await page.waitForTimeout(80);
        const said = await page.evaluate(() => window.__said);
        if (!said.some((t) => /A line!/.test(t))) assert.ok(said.indexOf(`${x.dice[0]} and ${x.dice[1]} make ${x.die}!`) >= 0, `a cover says the sum ("${said.join(" | ")}")`);
        covered++;
        continue;
      }
      // (covering a friend's card as the helper)
      const k = (await page.evaluate(() => window.BoardLogic.bingoSpots(window.__BOARD.state())))[0];
      await page.locator('.bn-bingo__grid button.bn-bsq[data-k="' + k + '"]').click();
      await page.waitForTimeout(80);
    }
    assert.equal((await st()).phase, "done", "the game ends");
    assert.ok(saw >= 3 && covered >= 3, `fixture: he added and covered (${saw}, ${covered})`);
    await page.locator(".bn-party").waitFor({ state: "visible", timeout: 8000 });
  } finally {
    await page.evaluate(() => { Object.assign(window.JoshAudio, window.__realAudio); window.__BOARD.reset({ introSeen: true }); });
    await slow();
  }
});

test("🎁 the Snowman's GIFT: a part his snowman cannot take and the friend's can is given — the friend's snowman becomes the button, the line says who needs it, one tap puts it on, and a ⭐ for being kind; a part neither can take still just passes", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await page.evaluate(() => {
    window.__said = [];
    window.__realAudio = { isMuted: window.JoshAudio.isMuted, say: window.JoshAudio.say, tone: window.JoshAudio.tone };
    window.JoshAudio.isMuted = () => false;
    window.JoshAudio.say = (t) => { window.__said.push(String(t)); };
    window.JoshAudio.tone = () => {};
  });
  try {
    await quick();
    // he has the tummy, River does not: he rolls a tummy
    const s = L.create({ board: "snowman", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed: 4, first: 0 });
    s.parts = [[1, 2], [1]]; s.seats[0].pos = 2; s.seats[0].bag = [2];
    assert.ok(L.restore(s), "fixture: a real state");
    assert.ok(await page.evaluate((x) => window.__BOARD.load("snowman", x), s), "fixture: it loads");
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    await page.waitForTimeout(450);
    await page.locator(".bn-pad--0").click();
    await page.waitForFunction(() => window.__BOARD.state().phase === "build" && !window.__BOARD.busy(), null, { timeout: 6000 });
    assert.equal((await st()).gift, 1, "a gift for River");
    const btn = await page.evaluate(() => [...document.querySelectorAll(".bn-snow .bn-snowman")].map((b) => [b.tagName === "BUTTON", b.getAttribute("aria-label")]));
    assert.deepEqual(btn.map((b) => b[0]), [false, true], "River's snowman is the one to tap");
    assert.match(btn[1][1], /tap|Tap/, "and it says so");
    const said = await page.evaluate(() => window.__said);
    assert.ok(said.indexOf("River needs the tummy! Tap River's snowman to give it!") >= 0, `the line says who needs it ("${said.join(" | ")}")`);
    await page.evaluate(() => { window.__said = []; });
    await page.locator(".bn-snow button.bn-snowman").click();
    await page.waitForFunction(() => window.__BOARD.state().parts[1].length === 2, null, { timeout: 5000 });
    const after = await st();
    assert.deepEqual(after.parts, [[1, 2], [1, 2]], "the tummy went on River's snowman");
    assert.equal(after.seats[0].stars, 1, "a ⭐ for being kind");
    await page.waitForTimeout(200);
    assert.ok((await page.evaluate(() => window.__said)).indexOf("A present for River! So kind! A star!") >= 0, "and it is said");
  } finally {
    await page.evaluate(() => { Object.assign(window.JoshAudio, window.__realAudio); window.__BOARD.reset({ introSeen: true }); });
    await slow();
  }
});

test("🌈 Rainbow Pick: after two Rainbow Trail games it is on the shelf; a tap flips TWO cards over the pads and lights the square each would reach, wearing the card; his pick moves him exactly there and the other card is gone; his first game lights the card that goes further; a whole game ends in one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true, done: { rainbow: 1 } }));
  await go("#board-home", "#screen-board-home");
  const boxes = () => page.evaluate(() => [...document.querySelectorAll("#screen-board-home .bn-box")].map((b) => b.dataset.box));
  assert.equal((await boxes()).indexOf("rainbow2"), -1, "one Rainbow Trail is not enough");
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true, done: { rainbow: 2 } }));
  await go("#board-home", "#screen-board-home");
  assert.ok((await boxes()).indexOf("rainbow2") >= 0, "after two, Rainbow Pick is on the shelf");
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("josh-board-v1")); s.intro.rainbow2 = false; localStorage.setItem("josh-board-v1", JSON.stringify(s)); });
  await page.reload();
  try {
    await quick();
    await startGame("rainbow2", "river", true, 6, 0);
    let picks = 0, lit = 0;
    for (let g = 0; g < 200; g++) {
      await untilTap(0);
      const x = await st();
      if (x.phase === "done") break;
      if (x.phase === "draw") {
        await page.locator(".bn-pad--0").click();
        await page.waitForFunction(() => { const s = window.__BOARD.state(); return (s.phase === "twocards" && !window.__BOARD.busy()) || s.turn !== 0 || s.phase === "done"; }, null, { timeout: 6000 });
        continue;
      }
      if (x.phase !== "twocards") continue;
      const to = await page.evaluate(() => { const s = window.__BOARD.state(); return s.offer.map((c) => window.BoardLogic.cardMove(s, c).to); });
      const v = await page.evaluate(() => ({
        btns: [...document.querySelectorAll(".bn-choose button.bn-pickc")].map((b) => { const r = b.getBoundingClientRect(); return { k: Number(b.dataset.card), w: r.width, h: r.height, hint: b.classList.contains("bn-pickd--hint"), to: Number(b.querySelector(".bn-pickd__to").textContent) }; }),
        targets: [...document.querySelectorAll(".bn-target")].filter((t) => !t.hidden).map((t) => Number(t.dataset.n)),
      }));
      assert.equal(v.btns.length, 2, "two cards to pick from");
      assert.ok(v.btns.every((b) => b.w >= 75 && b.h >= 75), "big cards");
      assert.deepEqual(v.btns.map((b) => b.to), to, "each card says where it would take him");
      assert.deepEqual(v.targets.sort(), [...new Set(to)].sort(), "the squares they reach light up");
      if (to[0] !== to[1]) { assert.deepEqual(v.btns.filter((b) => b.hint).map((b) => b.k), [to[0] > to[1] ? 0 : 1], "his first game lights the card that goes further"); lit++; }
      const k = picks % 2, mover = x.mover;
      await page.locator('.bn-choose button.bn-pickc[data-card="' + k + '"]').click();
      await page.waitForFunction(([m, t]) => window.__BOARD.state().seats[m].pos === t || window.__BOARD.state().phase === "done", [mover, to[k]], { timeout: 8000 });
      assert.equal(await page.locator(".bn-choose button").count(), 0, "the choice is gone");
      picks++;
    }
    assert.equal((await st()).phase, "done", "the game ends");
    assert.ok(picks >= 4 && lit >= 2, `fixture: he picked (${picks}) and saw the lit card (${lit})`);
    await page.locator(".bn-party").waitFor({ state: "visible", timeout: 8000 });
  } finally {
    await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
    await slow();
  }
});

test("🁢 Six-Dot Dominoes: after two Dot Dominoes games it is on the shelf, and every tile shows ALL its dots — a six too (the domino drawing knew only one to five)", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true, done: { dominoes: 2 } }));
  await go("#board-home", "#screen-board-home");
  assert.ok(await page.locator('.bn-box[data-box="dominoes6"]').count(), "after two, Six-Dot Dominoes is on the shelf");
  const s = L.create({ board: "dominoes6", seats: [{ who: "josh" }, { who: "dad" }], seed: 5, first: 0 });
  for (let g = 0; g < 30 && !s.line.some((t) => t[0] === 6 || t[1] === 6); g++) L.autoTurn(s);
  assert.ok(s.line.some((t) => t[0] === 6 || t[1] === 6), "fixture: a six on the line");
  assert.ok(await page.evaluate((x) => window.__BOARD.load("dominoes6", x), s), "fixture: it loads");
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  const drawn = await page.evaluate(() => [...document.querySelectorAll("#screen-board-play .bn-dom__bit svg")].map((v) => v.querySelectorAll("circle").length));
  const want = s.line.map((t) => t[0] + t[1]);
  assert.deepEqual(drawn, want, "each tile on the line wears exactly its dots");
});

// ---- Friends who think (PLAN_BOARD.md §18) ------------------------------------
test("🧠 the friends in the iPad each play their OWN way (a word under each face), a thinking box's friend LEARNS from how its games go (a step sharper when he takes most of the stars, a step duller the other way, never past the ends), a luck game and a person here have no level, and a broken save's levels are dropped", async () => {
  const DATA = require("../scripts/board-data.js");
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
    // the picker: a word for the grown-up under each friend in the iPad
    await go("#board-pick-cookies-cpu", "#screen-board-pick");
    const people = await page.evaluate(() => [...document.querySelectorAll("#screen-board-pick .bn-person")].map((b) => ({ who: b.dataset.who, tag: (b.querySelector(".bn-person__tag") || {}).textContent || "", label: b.getAttribute("aria-label") })));
    assert.deepEqual(people.map((p) => [p.who, p.tag]), DATA.FRIENDS.map((f) => [f.id, f.tag]), "each friend's own word");
    assert.equal(new Set(DATA.FRIENDS.map((f) => f.sharp)).size, 3, "fixture: three friends, three ways of playing");
    for (const p of people) assert.ok(p.label.indexOf(", " + p.tag) > 0, `…and it is in the button's name ("${p.label}")`);
    await go("#board-pick-cookies-here", "#screen-board-pick");
    assert.equal(await page.locator("#screen-board-pick .bn-person__tag").count(), 0, "a person here has no such word");
    // picking a friend starts the game at THEIR level
    for (const f of DATA.FRIENDS) {
      await go("#board-pick-cookies-cpu", "#screen-board-pick");
      await page.locator(`#screen-board-pick .bn-person[data-who="${f.id}"]`).click();
      await page.locator("#screen-board-play").waitFor({ state: "visible" });
      assert.equal((await st()).seats[1].sharp, f.sharp, `${f.id} plays Cookie Jar at ${f.sharp}`);
      assert.equal((await st()).seats[0].sharp, undefined, "he has no level: he is himself");
    }
    await go("#board-pick-moon-cpu", "#screen-board-pick");
    await page.locator('#screen-board-pick .bn-person[data-who="river"]').click();
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    assert.equal((await st()).seats[1].sharp, undefined, "a luck game has no level: the dice are the same for everyone");
    // (River sitting beside him is a person, not the friend in the iPad)
    for (const who of ["dad", "river"]) {
      await go("#board-pick-cookies-here", "#screen-board-pick");
      await page.locator(`#screen-board-pick .bn-person[data-who="${who}"]`).click();
      await page.locator("#screen-board-play").waitFor({ state: "visible" });
      assert.equal((await st()).seats[1].sharp, undefined, `a person here has no level (${who})`);
    }

    // LEARNING: the last jar's last two cookies are his to take
    const nearEnd = (mine, theirs, cpu) => {
      const s = L.create({ board: "cookies", seats: [{ who: "josh" }, cpu ? { who: "river", cpu: true } : { who: "dad" }], seed: 3, first: 0 });
      s.jar = 3; s.cookies = 2; s.seats[0].pos = 15; s.seats[1].pos = 15; s.seats[0].stars = mine; s.seats[1].stars = theirs; s.rolls = 20;
      assert.ok(L.restore(s), "fixture: a real game, two cookies from its end");
      return s;
    };
    const finish = async (mine, theirs, cpu) => {
      assert.ok(await page.evaluate((x) => window.__BOARD.load("cookies", x), nearEnd(mine, theirs, cpu !== false)), "fixture: the game loads");
      await page.locator("#screen-board-play").waitFor({ state: "visible" });
      await page.waitForTimeout(450);
      await page.locator('.bn-take button.bn-takeb[data-n="2"]').click();
      await page.waitForFunction(() => window.__BOARD.state().phase === "done", null, { timeout: 5000 });
    };
    const level = () => page.evaluate(() => window.__BOARD.level("cookies"));
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("josh-board-v1")).skill);
    await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
    assert.equal((await level()).steps, 0, "a fresh box: every friend at their own level");
    await finish(3, 0);   // he ends with all four golden cookies
    assert.equal((await level()).steps, 1, "he took most of the stars: the friend is a step sharper on THIS box");
    assert.deepEqual(await stored(), { cookies: 1 }, "…and it is saved, for this box only");
    const SK = await page.evaluate(() => window.__BOARD.SKILL);
    assert.deepEqual((await level()).sharp, DATA.FRIENDS.map((f) => f.sharp + SK.step), "every friend moves a step, so they still differ");
    assert.deepEqual((await page.evaluate(() => window.__BOARD.level("grab"))).sharp, DATA.FRIENDS.map((f) => f.sharp), "another box is untouched");
    // …and the next game on the box is played at the new level
    await go("#board-pick-cookies-cpu", "#screen-board-pick");
    await page.locator('#screen-board-pick .bn-person[data-who="viraj"]').click();
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    assert.equal((await st()).seats[1].sharp, DATA.person("viraj").sharp + SK.step, "Viraj plays the next Cookie Jar a step sharper");
    await finish(0, 3);   // the friend ends with three of the four
    assert.equal((await level()).steps, 0, "the friend took most: a step duller again");
    assert.deepEqual(await stored(), {}, "…and a box back at its own level stores nothing");
    await finish(1, 2);   // two each: level
    assert.equal((await level()).steps, 0, "an even game moves nothing");
    await finish(3, 0, false);   // against Dad
    assert.equal((await level()).steps, 0, "a game against a person here teaches the iPad's friends nothing");
    // never past the ends
    await page.evaluate((mx) => { const s = JSON.parse(localStorage.getItem("josh-board-v1")); s.skill = { cookies: mx }; localStorage.setItem("josh-board-v1", JSON.stringify(s)); }, SK.max);
    await page.reload({ waitUntil: "load" });
    await quick();
    assert.equal((await level()).steps, SK.max, "fixture: the top step is loaded");
    await finish(3, 0);
    assert.equal((await level()).steps, SK.max, "never past the top step");
    const top = (await level()).sharp;
    assert.ok(top.every((x) => x <= SK.hi && x >= SK.lo), `every friend stays inside the ends (${top})`);
    assert.ok(top[0] < 1 && SK.hi < 1, "the sharpest friend still misses sometimes: a careful child can always do better");
    // a broken save's levels are dropped, one by one
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("josh-board-v1")); s.skill = { cookies: 99, grab: "2", dig: 1.5, nope: 1, pairs: -2, hilo: 0 }; localStorage.setItem("josh-board-v1", JSON.stringify(s)); });
    await page.reload({ waitUntil: "load" });
    assert.deepEqual(await page.evaluate(() => ["cookies", "grab", "dig", "pairs", "hilo"].map((b) => window.__BOARD.level(b).steps)), [0, 0, 0, -2, 0], "only a whole step inside the ends is taken");
  } finally {
    await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
    await slow();
  }
});

test("💡 a CLEVER move is named: a bulb over the MOVER's own face every time (sound off), WHY said the first time each player does it in a game and not again, nothing at all for a person's missed one, a friend in the iPad saying 'oops' of its own slip once — and a bulb never outlives its game", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await page.evaluate(() => {
    window.__said = [];
    window.__realAudio = { isMuted: window.JoshAudio.isMuted, say: window.JoshAudio.say, tone: window.JoshAudio.tone };
    window.JoshAudio.isMuted = () => false;
    // (what was on screen when the line was said: each pad's bulb)
    window.JoshAudio.say = (t) => { window.__said.push([String(t), [0, 1].map((i) => !document.querySelector(".bn-pad--" + i + " .bn-pad__idea").hidden)]); };
    window.JoshAudio.tone = () => {};
    // every time a bulb LIGHTS, per pad
    window.__bulbs = [0, 0];
    window.__bulbWatch = new MutationObserver((recs) => { for (const r of recs) if (!r.target.hidden) window.__bulbs[r.target.closest(".bn-pad").classList.contains("bn-pad--1") ? 1 : 0]++; });
    for (const b of document.querySelectorAll(".bn-pad__idea")) window.__bulbWatch.observe(b, { attributes: true, attributeFilter: ["hidden"] });
  });
  const said = () => page.evaluate(() => window.__said.map((x) => x[0]));
  const bulbs = () => page.evaluate(() => window.__bulbs.slice());
  const take = async (n, seat) => {
    await untilTap(seat);
    const before = (await st()).rolls;
    await page.locator(`.bn-take button.bn-takeb[data-n="${n}"]`).click();
    await page.waitForFunction((r) => { const x = window.__BOARD.state(); return x.phase === "done" || (x.rolls > r && !window.__BOARD.busy()); }, before, { timeout: 5000 });
    await page.waitForTimeout(150);   // (a quick bulb goes out again)
  };
  try {
    await quick();
    // two people, seven cookies: taking three leaves FOUR
    await startGame("cookies", "dad", false, 3, 0);
    assert.equal(await page.locator(".bn-pad__idea").count(), 2, "a bulb on each pad");
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".bn-pad__idea")].map((b) => b.hidden)), [true, true], "…and neither lit");
    await take(3, 0);
    assert.deepEqual(await bulbs(), [1, 0], "his clever take lights the bulb over HIS face");
    assert.deepEqual((await said()).filter((t) => /Clever/.test(t)), ["Josh left 4. Clever!"], "…and says why");
    await take(1, 1);    // four in the jar: nothing clever to do
    await take(3, 0);    // the last three: the golden cookie is its own ⭐
    assert.deepEqual(await bulbs(), [1, 0], "no bulb where there was nothing to choose, nor for the golden cookie");
    // the next jar has nine: Dad starts it; one leaves eight
    assert.deepEqual([(await st()).cookies, (await st()).turn], [9, 1], "fixture: the second jar, Dad's go");
    await take(1, 1);
    assert.deepEqual(await bulbs(), [1, 1], "Dad's clever take lights the bulb over HIS face");
    await take(1, 0);    // eight in the jar: nothing clever
    await take(3, 1);    // seven → four: Dad's second clever take
    assert.deepEqual(await bulbs(), [1, 2], "the bulb every time…");
    assert.deepEqual((await said()).filter((t) => /Clever/.test(t)), ["Josh left 4. Clever!", "Dad left 8. Clever!"], "…but WHY only the first time each player does it");
    // a person's MISSED clever move is never pointed out
    await page.evaluate(() => { window.__said = []; window.__bulbs = [0, 0]; });
    await startGame("cookies", "dad", false, 3, 0);
    await take(1, 0);    // (three would have left four)
    assert.deepEqual(await bulbs(), [0, 0], "no bulb for a plain take");
    assert.deepEqual((await said()).filter((t) => /Clever|Oops|missed|Next time/i.test(t)), [], "…and not a word about what he could have done");
    // a friend in the iPad says "oops" of ITS OWN slip — once, with no bulb
    await page.evaluate(() => { window.__said = []; window.__bulbs = [0, 0]; });
    {
      const s = L.create({ board: "cookies", seats: [{ who: "josh" }, { who: "river", cpu: true, sharp: 0 }], seed: 1, first: 0 });
      L.takeCookies(s, 1);
      assert.notEqual(L.nimChoice(L.snapshot(s)), L.nimBest(s), "fixture: on this seed the dull friend misses the clever take");
    }
    await page.evaluate(() => window.__BOARD.start("cookies", "river", true, 1, 0, false, 0));
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    await page.waitForTimeout(400);
    const oops = require("../scripts/board-data.js").person("river").oops;
    await take(1, 0);
    await untilTap(0);
    assert.ok((await said()).indexOf(oops) >= 0, `River says so of her own slip ("${(await said()).join(" | ")}")`);
    for (let g = 0; g < 60 && (await st()).phase !== "done"; g++) { await untilTap(0); if ((await st()).phase === "done") break; await take(1, 0); }
    const all = await page.evaluate(() => window.__said);
    assert.equal(all.filter((x) => x[0] === oops).length, 1, "…once a game, however many she makes");
    assert.deepEqual(all.filter((x) => x[0] === oops).map((x) => x[1][1]), [false], "…and a slip lights no bulb");
    // a bulb never outlives its game
    await page.evaluate(() => { window.__BOARD.T.cheer = 60000; });
    await startGame("cookies", "dad", false, 3, 0);
    await page.locator('.bn-take button.bn-takeb[data-n="3"]').click();
    await page.waitForFunction(() => !document.querySelector(".bn-pad--0 .bn-pad__idea").hidden, null, { timeout: 5000 });
    await page.evaluate(() => window.__BOARD.start("cookies", "dad", false, 3, 0));
    await page.waitForTimeout(200);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".bn-pad__idea")].map((b) => b.hidden)), [true, true], "a new game starts with no bulb lit");
  } finally {
    await page.evaluate(() => {
      Object.assign(window.JoshAudio, window.__realAudio);
      if (window.__bulbWatch) window.__bulbWatch.disconnect();
      window.__BOARD.reset({ introSeen: true });
    });
    await slow();
  }
});

test("the voice on EVERY box: every game, each played a while by tapping whatever is live, and every line said is words — no picture, no {placeholder}, no missing name, never a race's word for the one behind", async () => {
  // The voice test above plays Moon Race and Rainbow Trail; the shelf has
  // since grown to twenty-eight boxes, each with its own lines filled from its own
  // names (a fish, a hider, a snowman's part, a carriage's colour). The
  // population is DERIVED from the shelf, and each game is driven by tapping
  // the first live button on the board or his pad — a wrong tap too, which
  // is what speaks the "look again" lines.
  await page.evaluate(() => {
    window.__said = [];
    window.__realAudio = { isMuted: window.JoshAudio.isMuted, say: window.JoshAudio.say, tone: window.JoshAudio.tone };
    window.JoshAudio.isMuted = () => false;
    window.JoshAudio.say = (t) => { window.__said.push([window.__BOARD.state() ? window.__BOARD.state().board : "?", String(t)]); };
    window.JoshAudio.tone = () => {};
  });
  try {
    await quick();
    const boxes = await page.evaluate(() => window.BoardData.BOXES.map((b) => b.id));
    assert.ok(boxes.length >= 28, `fixture: only ${boxes.length} boxes`);
    for (const box of boxes) {
      await page.evaluate(() => window.__BOARD.reset({ introSeen: true, done: { moon: 2, apple: 2, hen: 2 } }));
      await startGame(box, "viraj", true, 7, 0);
      for (let k = 0; k < 24; k++) {
        // a DIFFERENT live button each time (the same card twice is the echo,
        // and says nothing): the board's own buttons, else his pad
        const tapped = await page.evaluate((n) => {
          const st = window.__BOARD.state();
          if (!st || st.phase === "done" || window.__BOARD.busy()) return "wait";
          const live = [...document.querySelectorAll("#screen-board-play .bn-field button:not([disabled]), #screen-board-play .bn-choose button")].filter((x) => x.offsetParent);
          const b = live.length && st.phase !== "roll" ? live[(n * 7) % live.length] : document.querySelector("#screen-board-play .bn-pad--0");
          if (!b) return "none";
          b.click();
          return "tap";
        }, k);
        await page.waitForTimeout(tapped === "tap" ? 120 : 200);
        if ((await st()).phase === "done") break;
      }
    }
    const said = await page.evaluate(() => window.__said);
    // every game must have said more than its opening line, or it was not
    // really played (measured 4 to 45 lines a game)
    const count = {};
    for (const [b] of said) count[b] = (count[b] || 0) + 1;
    const quiet = boxes.map((b) => [b, require("../scripts/board-data.js").box(b).board]).filter(([, b]) => (count[b] || 0) < 4);
    assert.deepEqual(quiet.map((q) => q[0]), [], "fixture: these games said too little to have been played: " + JSON.stringify(count));
    const bad = said.filter(([, t]) => /\{\w+\}/.test(t) || /\p{Extended_Pictographic}/u.test(t) || /\b(undefined|null|NaN)\b/.test(t) || /\b(lose|lost|loser|losing|beat|beats|winner|second place|last place|1st|2nd)\b/i.test(t));
    assert.deepEqual(bad, [], "a line carries a placeholder, a picture, a missing name or a race's word");
    // …and never ANOTHER game's line. Phase names are shared between games
    // ("pick", "draw", "choose"), and a line chosen by the phase alone told a
    // Rainbow Trail player "Nothing matches. Take one from the pile!" (a
    // domino's), a Colour Grab, Pattern Train or Honey Ten player "One tap,
    // one apple", and an Acorn Pots player "Pick a die!". Each line below
    // belongs to its game(s) only (board ids).
    const D = require("../scripts/board-data.js"), S = D.SAY;
    const OWN = [
      [S.pickFirst, ["apple"]], [S.domDraw, ["dominoes"]], [S.domFirst, ["dominoes"]],
      [S.pickDieAgain, ["pickdie"]], [S.pickFirstDie, ["pickdie"]], [S.pairsFirst, ["pairs"]],
      [S.findTwin, ["spot"]], [S.whoseFirst, ["lotto"]], [S.basketFirst, ["lotto"]], [S.acornsFirst, ["acorns"]],
      [S.callFirst, ["call"]], [S.callAgain, ["call"]], [S.callMiss, ["call"]],
      [S.bingoSumFind.slice(S.bingoSumFind.indexOf("Count")), ["sums"]],
      [D.board("twos").lines.hop, ["twos"]], [D.board("fives").lines.hop, ["fives"]],
    ];
    const stray = said.filter(([b, t]) => OWN.some(([line, owners]) => t.indexOf(line) >= 0 && owners.indexOf(b) < 0));
    assert.deepEqual(stray, [], "a game said ANOTHER game's line");
    // (the owners must still say them, or the table guards nothing)
    for (const [line, owners] of OWN) assert.ok(D.BOARDS.some((b) => owners.indexOf(b.id) >= 0), "fixture: " + owners + " is a board");
  } finally {
    await page.evaluate(() => Object.assign(window.JoshAudio, window.__realAudio));
    await slow();
  }
});

test("leaving mid-turn stops the computer: nothing plays on a hidden screen, and the game is kept", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await startGame("moon", "river", true, 3, 1);   // River starts (the hook allows it)
  await page.waitForTimeout(100);
  const before = await st();
  await go("#board-home", "#screen-board-home");
  // Read at ONCE: a pending timer also asks whether the screen is up before it
  // acts, so after a wait it is gone either way and this clause could not fail.
  assert.equal(await page.evaluate(() => window.__BOARD.timers()), 0, "leaving clears every pending timer at once");
  await page.waitForTimeout(2500);
  assert.equal(await page.evaluate(() => window.__BOARD.timers()), 0, "no timer outlives the screen");
  const sv = await page.evaluate(() => window.__BOARD.save());
  assert.deepEqual(sv.games.moon.st.seats.map((x) => x.pos), before.seats.map((x) => x.pos), "the computer did not play on alone");
  // …and coming back carries on: River takes her turn
  await page.locator('.bn-box[data-box="moon"]').click();
  await page.locator("#screen-board-who").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  await page.locator("#screen-board-who .bn-keep").click();
  await page.waitForFunction(() => window.__BOARD.state().turn === 0, null, { timeout: 15000 });
});

// A Moon Race one hop from the end: the friend is already home, Josh's turn,
// one hop left on the die. Built from a real game and checked by restore(),
// so it is a state the engine can reach.
function lastHop(friend, cpu) {
  const D = require("../scripts/board-data.js");
  const size = D.board("moon").size;
  const x = L.create({ board: "moon", seats: [{ who: "josh" }, { who: friend, cpu }], seed: 5 });
  x.seats[1].pos = size; x.seats[1].home = true; x.order = [1];
  x.seats[0].pos = size - 1;
  x.turn = 0; x.mover = 0; x.phase = "hop"; x.die = 1; x.left = 1; x.rolls = 9;
  assert.ok(L.restore(JSON.parse(JSON.stringify(x))), "fixture: the near-end state is one the engine can reach");
  return x;
}

test("a game finished and left inside the hand-over still COUNTS (Comet Moon's unlock depends on it)", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await slow();
  try {
    await page.evaluate((snap) => window.__BOARD.load("moon", snap), lastHop("river", true));
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    await page.waitForTimeout(400);
    await page.locator(".bn-pad--0").click();
    await page.waitForFunction(() => window.__BOARD.state().phase === "done");
    // The app is closed AT ONCE: the party is still a timer away (the
    // hand-over). A reload, not a navigation — leaving through the router
    // also counts it (persistGame sees a finished game), so only a page that
    // goes away without routing shows whether the count waited for the party.
    assert.ok(await page.locator(".bn-party").evaluate((p) => p.hidden), "fixture: the party has not appeared yet");
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("josh-board-v1")));
    assert.equal(stored.done.moon, 1, "the finished game is counted and STORED the moment it ends, though the party never showed");
    assert.ok(!stored.games.moon, "and it is no longer waiting on its box");
    await page.reload({ waitUntil: "load" });
    await go("#board-home", "#screen-board-home");
    assert.equal((await page.evaluate(() => window.__BOARD.save())).done.moon, 1, "…and it is still counted after the app comes back");
  } finally { await quick(); }
});

test("a computer turn due while the iPad slept WAITS, and plays when the screen is back", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await slow();
  try {
    await page.evaluate(() => {
      window.__fakeHidden = false;
      Object.defineProperty(document, "hidden", { configurable: true, get: () => !!window.__fakeHidden });
    });
    await startGame("moon", "river", true, 3, 1);   // River starts
    // the screen goes away before her turn is due (slow: ~1.3s of thinking)
    await page.evaluate(() => { window.__fakeHidden = true; document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(2500);
    assert.equal((await st()).rolls, 0, "fixture: nothing played while the screen was away");
    await page.evaluate(() => { window.__fakeHidden = false; document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForFunction(() => window.__BOARD.state().rolls > 0, null, { timeout: 8000 })
      .catch(() => { throw new Error("River's turn never came: a turn due while the screen was away was dropped, so his taps would only ever wiggle"); });
  } finally {
    await page.evaluate(() => { delete document.hidden; delete window.__fakeHidden; });
    await quick();
  }
});

test("through the hand-over the pads follow the turn ON SCREEN: his own lit pad does not say it is the friend's turn", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await slow();
  try {
    await page.evaluate((snap) => window.__BOARD.load("moon", snap), (() => {
      // two people, Josh's last hop of a turn: one hop left, NOT the end
      const x = L.create({ board: "moon", seats: [{ who: "josh" }, { who: "mom", cpu: false }], seed: 5 });
      x.phase = "hop"; x.die = 1; x.left = 1; x.rolls = 1; x.seats[0].pos = 1;
      assert.equal(L.jumpAt(require("../scripts/board-data.js").board("moon"), 2), null, "fixture: square 2 has no jump");
      return x;
    })());
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    await page.waitForTimeout(400);
    await page.locator(".bn-pad--0").click();
    await page.waitForFunction(() => window.__BOARD.state().turn === 1);
    // the engine has handed over; the screen has not (the hand-over is a timer away)
    const r = await page.evaluate(() => {
      const p = document.querySelectorAll(".bn-pad");
      p[0].classList.remove("bn-wiggle"); p[1].classList.remove("bn-wiggle");
      const lit = !p[0].classList.contains("bn-pad--wait");
      p[0].click();
      const w0 = p[0].classList.contains("bn-wiggle");
      p[1].click();
      const w1 = p[1].classList.contains("bn-wiggle");
      return { lit, w0, w1, turn: window.__BOARD.state().turn };
    });
    assert.ok(r.lit, "fixture: his pad is still the lit one");
    assert.ok(!r.w0, "his own lit pad does not wiggle 'it's Mom's turn' while the hand-over plays");
    assert.ok(r.w1, "control: Mom's pad, still waiting on screen, wiggles");
    assert.equal(r.turn, 1, "and nothing moved");
  } finally { await quick(); }
});

test("two tabs keep each other's games, and two games finished in two tabs count as TWO", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  const other = await context.newPage();
  other.on("pageerror", (e) => pageErrors.push("(tab B) " + String(e)));
  // Tab B can be made DEAF to the storage event (an init script, so its
  // listener runs before the page's own): a tab that hears every write
  // re-reads it, so only a deaf tab shows whether a WRITE keeps the other's.
  await other.addInitScript(() => {
    window.addEventListener("storage", (e) => { if (window.__deaf) e.stopImmediatePropagation(); });
  });
  try {
    await other.goto(baseURL + "#board-home", { waitUntil: "load" });
    await other.locator("#screen-board-home").waitFor({ state: "visible" });
    // tab A starts a Moon Race, then tab B (opened before it) starts a Rainbow Trail
    await startGame("moon", "dad", false, 3, 0);
    await other.evaluate(() => window.__BOARD.start("rainbow", "mom", false, 4, 0));
    await other.locator("#screen-board-play").waitFor({ state: "visible" });
    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem("josh-board-v1")));
    assert.ok(stored.games.moon && stored.games.rainbow, `both games are kept (stored: ${Object.keys(stored.games)})`);
    // each tab finishes a Moon Race, B without hearing A's: two finished
    await other.evaluate(() => { window.__deaf = true; });
    await quick();
    await other.evaluate(() => Object.assign(window.__BOARD.T, { tumble: 60, hop: 30, autoHop: 40, cpuThink: 40, cpuHop: 30, ride: 40, card: 30, glide: 20, handoff: 40 }));
    // both tabs are mid-game at once (loading a game routes, and the router
    // re-reads the save, so the finishes must come after both loads)
    const snap = lastHop("river", true);
    for (const tab of [page, other]) {
      await tab.evaluate((s) => window.__BOARD.load("moon", s), snap);
      await tab.locator("#screen-board-play").waitFor({ state: "visible" });
    }
    await page.waitForTimeout(450);
    for (const tab of [page, other]) {
      await tab.locator(".bn-pad--0").click();
      await tab.waitForFunction(() => window.__BOARD.state().phase === "done");
    }
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem("josh-board-v1")));
    assert.equal(stored.done.moon, 2, "a game finished in each tab is two finished games, not one");
  } finally { await other.close(); }
});

// ---- 🍎 Apple Spin -------------------------------------------------------------
test("🍎 a whole Apple Spin against the computer: spin, ONE tap ONE apple into his ten-frame, spare apples into the pie, one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
    await startGame("apple", "river", true, 5, 0);
    assert.equal(await page.locator(".bn-board .bn-svg").count(), 1, "the orchard is drawn");
    const basket = (seat) => page.evaluate((i) => document.querySelectorAll('.bn-apple[data-seat="' + i + '"]').length, seat);
    let spins = 0, picks = 0;
    for (let guard = 0; guard < 300; guard++) {
      await untilTap(0);
      const s = await st();
      if (s.phase === "done") break;
      const mover = s.mover;
      if (s.phase === "spin") {
        spins++;
        await page.locator(".bn-pad--0").click();
        await page.waitForFunction(() => window.__BOARD.state().phase !== "spin" || window.__BOARD.state().turn !== 0);
        continue;
      }
      picks++;
      const before = await basket(mover);
      assert.equal(before, s.seats[mover].pos, "the ten-frame shows exactly the apples in the basket");
      await page.locator(".bn-pad--0").click();
      await page.waitForTimeout(60);
      const after = await st();
      assert.equal(after.seats[mover].pos, s.seats[mover].pos + 1, "one tap, one apple");
      assert.equal(await basket(mover), after.seats[mover].pos, "and the apple is in its slot");
    }
    const end = await st();
    assert.equal(end.phase, "done", "the game ends");
    assert.ok(end.seats.every((x) => x.pos === 10 && x.home), "both baskets are full — nobody loses");
    assert.ok(spins > 2 && picks >= spins, `he spun (${spins}) and picked (${picks})`);
    await page.locator(".bn-party").waitFor({ state: "visible" });
    // the finale tips both baskets (20 apples) into the pie on top of its spares
    await page.waitForFunction((n) => document.querySelectorAll(".bn-apple--pie").length === n, Math.min(20 + end.pie, 14));
    assert.equal(await page.locator(".bn-apple--pie").count(), Math.min(20 + end.pie, 14), "the pie holds both baskets and the spares");
    assert.equal(await page.locator(".bn-pop").textContent(), String(20 + end.pie), "the party counts the pie: ten, twenty, and the spares");
    const sv = await page.evaluate(() => window.__BOARD.save());
    assert.equal(sv.done.apple, 1, "a finished game counts once");
  } finally { await slow(); }
});

test("🍎 the bird joins from his THIRD Apple game, and it carries one apple back to the tree", async () => {
  for (const [done, birds] of [[1, false], [2, true]]) {
    await page.evaluate((d) => window.__BOARD.reset({ introSeen: true, done: { apple: d } }), done);
    await go("#board-pick-apple-cpu", "#screen-board-pick");
    await page.locator('.bn-person[data-who="raegar"]').click();
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    assert.equal((await st()).birds, birds, `after ${done} Apple game(s) the bird is ${birds ? "on" : "off"}`);
  }
  // a bird turn, driven: Josh has 3 apples and his spinner bag holds only the bird
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  const s = L.create({ board: "apple", seats: [{ who: "josh" }, { who: "dad" }], seed: 3, first: 0, birds: true });
  s.seats[0].pos = 3; s.seats[0].bag = [0];
  assert.ok(await page.evaluate((x) => window.__BOARD.load("apple", x), s), "fixture: the game loads");
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.bn-apple[data-seat="0"]').count(), 3, "three apples in his basket");
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => window.__BOARD.state().seats[0].pos === 2, null, { timeout: 8000 });
  await page.locator(".bn-pad--0 .bn-spin--bird").waitFor({ state: "visible", timeout: 4000 });
  await page.waitForFunction(() => document.querySelectorAll('.bn-apple[data-seat="0"]').length === 2, null, { timeout: 8000 });
  assert.equal((await st()).turn, 1, "a bird is the whole turn");
});

test("🍎 the first-time hand goes once he has picked, even when that one pick ENDS his turn", async () => {
  // the pick that ends a turn has already handed st.turn to the computer, so
  // the shell must ask whose tap it WAS, not whose turn it is now
  await page.evaluate(() => window.__BOARD.reset());
  const s = L.create({ board: "apple", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed: 3, first: 0 });
  s.seats[0].bag = [1, 2, 3, 4, 1, 2];      // his spin is a 1: one apple, then the turn passes
  assert.ok(await page.evaluate((x) => window.__BOARD.load("apple", x), s), "fixture: the game loads");
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  assert.equal((await page.evaluate(() => window.__BOARD.save())).intro.spin, false, "fixture: he has never spun");
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => window.__BOARD.state().phase === "pick" && !window.__BOARD.busy(), null, { timeout: 8000 });
  assert.equal((await st()).left, 1, "fixture: one apple to pick");
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => window.__BOARD.state().turn === 1, null, { timeout: 8000 });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).intro.spin, true, "he has picked: the spinner is learned");
});

test("🍎 leaving in the middle of a spin never comes back still spinning", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await slow();
  await startGame("apple", "raegar", false, 6, 0);
  await page.locator(".bn-pad--0").click();
  await page.locator(".bn-pad--0 .bn-spinner--go").waitFor({ state: "visible", timeout: 4000 });
  await page.evaluate(() => { location.hash = "#board-home"; });     // mid-tumble: its timer dies
  await page.locator("#screen-board-home").waitFor({ state: "visible" });
  await page.evaluate(() => { location.hash = "#board-play"; });
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(900);                                     // longer than a whole tumble
  assert.equal(await page.locator(".bn-spinner--go").count(), 0, "no pad is still spinning");
  const x = await st();
  assert.equal(x.phase, "pick", "fixture: the spin had already happened in the engine");
  assert.equal(await page.locator(".bn-pad--0 .bn-spin--bird").count(), 0, "and no phantom 🐦 sits on his pad");
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction((p) => window.__BOARD.state().seats[0].pos === p + 1, x.seats[0].pos, { timeout: 4000 });
});

// ---- The batch-1 audit -----------------------------------------------------------
test("with the sound OFF he can still count: each hop pops the square's number, each apple the basket's count", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await startGame("moon", "river", true, 20, 0);   // his first roll is a 3
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => window.__BOARD.state().phase === "hop" && !window.__BOARD.busy());
  assert.equal(await page.locator(".bn-pop").isHidden(), true, "nothing pops before a hop");
  for (const n of ["2", "3"]) {
    await page.locator(".bn-pad--0").click();
    await page.locator(".bn-pop").waitFor({ state: "visible" });
    assert.equal(await page.locator(".bn-pop").textContent(), n, `the hop to ${n} pops ${n}`);
    // it pops ABOVE the square it names, not somewhere else on the board
    const r = await page.evaluate((k) => {
      const p = document.querySelector(".bn-pop").getBoundingClientRect(), c = document.querySelector('.bn-cell[data-n="' + k + '"]').getBoundingClientRect();
      return { px: p.left + p.width / 2, cl: c.left, cr: c.right, pb: p.bottom, ct: c.top, cb: c.bottom };
    }, n);
    assert.ok(r.px > r.cl && r.px < r.cr, `the ${n} pops over its own column`);
    assert.ok(r.pb > r.ct - 40 && r.pb < r.cb, `the ${n} pops at its own square`);
    await page.waitForTimeout(320);
  }
  await page.waitForFunction(() => document.querySelector(".bn-pop").hidden, null, { timeout: 4000 });
  // an apple pops the basket's count
  const a = L.create({ board: "apple", seats: [{ who: "josh" }, { who: "dad" }], seed: 3, first: 0 });
  a.seats[0].pos = 4; a.seats[0].bag = [2];
  await page.evaluate((x) => window.__BOARD.load("apple", x), a);
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => window.__BOARD.state().phase === "pick" && !window.__BOARD.busy());
  await page.locator(".bn-pad--0").click();
  await page.locator(".bn-pop").waitFor({ state: "visible" });
  assert.equal(await page.locator(".bn-pop").textContent(), "5", "the fifth apple pops 5 (counting ON from the basket)");
});

test("🌈 a card lights the square it sends him to BEFORE the token sets off, and the light goes when he arrives", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await startGame("rainbow", "dad", false, 3, 0);
  assert.equal(await page.locator(".bn-mark").isHidden(), true, "nothing is lit before a card");
  await page.locator(".bn-pad--0").click();
  await page.locator(".bn-mark").waitFor({ state: "visible", timeout: 2000 });
  const s = await st();
  const to = s.seats[0].pos;
  assert.equal(await page.locator(".bn-mark").getAttribute("data-n"), String(to), "the lit square is where the card sends him");
  assert.notEqual(await page.locator(".bn-token--0").getAttribute("data-pos"), String(to), "…and it is lit before he gets there");
  const r = await page.evaluate((n) => {
    const m = document.querySelector(".bn-mark").getBoundingClientRect(), c = document.querySelector('.bn-cell[data-n="' + n + '"]').getBoundingClientRect();
    return Math.abs((m.left + m.width / 2) - (c.left + c.width / 2)) + Math.abs((m.top + m.height / 2) - (c.top + c.height / 2));
  }, to);
  assert.ok(r < 4, `the light sits on its square (off by ${r.toFixed(1)}px)`);
  await page.waitForFunction((n) => document.querySelector(".bn-token--0").dataset.pos === String(n), to, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector(".bn-mark").hidden, null, { timeout: 4000 });
});

test("a booster ride is a RIDE: the token grows and glows on the way and lands with its ⭐", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await startGame("moon", "river", true, 20, 0);   // 3 hops to the rocket at 4
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => window.__BOARD.state().phase === "hop" && !window.__BOARD.busy());
  for (let k = 0; k < 3; k++) { await page.locator(".bn-pad--0").click(); await page.waitForTimeout(320); }
  await page.waitForFunction(() => document.querySelector(".bn-token--0").classList.contains("bn-token--ride"), null, { timeout: 4000 });
  await page.waitForFunction(() => { const p = document.querySelector(".bn-pop"); return !p.hidden && p.textContent === "⭐"; }, null, { timeout: 6000 });
  assert.equal(await page.locator(".bn-token--0").getAttribute("class").then((c) => c.includes("bn-token--ride")), false, "the glow ends when he lands");
  // …and a ride cut short (a new game, or leaving, mid-ride) never carries its
  // glow on: the timer that takes it off is one clearLater() cancels
  await startGame("moon", "river", true, 20, 0);
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => window.__BOARD.state().phase === "hop" && !window.__BOARD.busy());
  for (let k = 0; k < 3; k++) { await page.locator(".bn-pad--0").click(); await page.waitForTimeout(320); }
  await page.waitForFunction(() => document.querySelector(".bn-token--0").classList.contains("bn-token--ride"), null, { timeout: 4000 });
  await startGame("moon", "river", true, 3, 0);
  assert.equal(await page.locator(".bn-token--ride").count(), 0, "a new game opens with no token still riding");
});

test("home first, now HELPING: the friend's face sits on the helper's pad (only while helping)", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  const s = L.create({ board: "moon", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed: 3, first: 0 });
  assert.ok(await page.evaluate((x) => window.__BOARD.load("moon", x), s), "fixture: loads");
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".bn-pad--0 .bn-pad__help").isHidden(), true, "nobody is home: no helper badge");
  const h = L.create({ board: "moon", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed: 3, first: 0 });
  h.seats[0].pos = 36; h.seats[0].home = true; h.order = [0]; h.mover = 1;
  assert.ok(await page.evaluate((x) => window.__BOARD.load("moon", x), h), "fixture: Josh home, his turn");
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".bn-pad--0 .bn-pad__help").isVisible(), true, "Josh is home: his pad wears River's face");
  assert.equal(await page.locator(".bn-pad--0 .bn-pad__help").getAttribute("data-who"), "river");
  assert.equal(await page.locator(".bn-pad--1 .bn-pad__help").isHidden(), true, "River is not home: no badge on hers");
  assert.match(await page.locator(".bn-pad--0").getAttribute("aria-label"), /helping River/, "and the pad says so");
});

test("a TOP-ROW square's number pops below it, on the board, never up over the bar (it sat on the 🏠 on an iPad)", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  const sizes = [[834, 1112], [390, 844]];
  try {
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      // Josh on 30 with one hop to go: the hop lands on 31, the top row
      const s = L.create({ board: "moon", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed: 3, first: 0 });
      s.seats[0].pos = 30; s.phase = "hop"; s.die = 1; s.left = 1; s.rolls = 6;
      assert.ok(await page.evaluate((x) => window.__BOARD.load("moon", x), s), "fixture: a hop to the top row loads");
      await page.locator("#screen-board-play").waitFor({ state: "visible" });
      await page.waitForTimeout(400);
      await page.locator(".bn-pad--0").click();
      await page.locator(".bn-pop").waitFor({ state: "visible" });
      await page.waitForTimeout(250);   // the pop's own animation has settled
      const r = await page.evaluate(() => {
        const p = document.querySelector(".bn-pop").getBoundingClientRect(), b = document.querySelector(".bn-board").getBoundingClientRect();
        const c = document.querySelector('.bn-cell[data-n="31"]').getBoundingClientRect();
        const home = document.querySelector("#screen-board-play .bn-playback").getBoundingClientRect();
        return { text: document.querySelector(".bn-pop").textContent, pt: p.top, pb: p.bottom, pl: p.left, pr: p.right, bt: b.top, ct: c.top, cb: c.bottom, cl: c.left, cr: c.right,
          overHome: p.left < home.right && p.right > home.left && p.top < home.bottom && p.bottom > home.top };
      });
      assert.equal(r.text, "31", `[${w}x${h}] the hop pops 31`);
      assert.ok(r.pt >= r.bt - 1, `[${w}x${h}] the top-row pop starts at ${Math.round(r.pt)}, above the board (${Math.round(r.bt)})`);
      assert.ok(!r.overHome, `[${w}x${h}] the top-row pop covers the 🏠 button`);
      const mid = (r.pl + r.pr) / 2;
      assert.ok(mid > r.cl && mid < r.cr && r.pt > r.ct && r.pt < r.cb + 4, `[${w}x${h}] it pops at square 31, not somewhere else`);
    }
  } finally {
    await page.setViewportSize({ width: 390, height: 844 });
  }
});

test("🌈 a picture card AHEAD is a ZOOM: one swoop that grows and glows, lands with its ⭐ — and the friend cheers", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  // Josh on 2, his next card the rocket at 19: seventeen squares away. Square
  // by square at a glide each it crawled for five seconds; a zoom is one ride.
  const s = L.create({ board: "rainbow", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed: 3, first: 0 });
  s.seats[0].pos = 2; s.seats[0].bag = [{ kind: "pic", at: 19 }];
  assert.ok(await page.evaluate((x) => window.__BOARD.load("rainbow", x), s), "fixture: loads");
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  const t0 = Date.now();
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => document.querySelector(".bn-token--0").classList.contains("bn-token--ride"), null, { timeout: 3000 });
  // the friend cheers on HER pad (seen: the sound is off by default)
  const cheers = await page.evaluate(() => [0, 1].map((i) => {
    const p = document.querySelector(".bn-pad--" + i), b = p.querySelector(".bn-pad__cheer");
    return p.classList.contains("bn-pad--cheer") && !b.hidden && b.offsetWidth > 20;   // offsetWidth: the bubble pops in from scale 0.4
  }));
  assert.deepEqual(cheers, [false, true], "River's pad cheers him on, and his own pad does not cheer for himself");
  // it goes STRAIGHT to the landmark: never set down on a square in between
  const seen = await page.evaluate(() => new Promise((res) => {
    const t = document.querySelector(".bn-token--0"), got = new Set([t.dataset.pos]);
    const mo = new MutationObserver(() => got.add(t.dataset.pos));
    mo.observe(t, { attributes: true, attributeFilter: ["data-pos"] });
    setTimeout(() => { mo.disconnect(); res([...got]); }, 1500);
  }));
  assert.deepEqual(seen.filter((p) => p !== "2" && p !== "19"), [], `the zoom set the token down on ${seen}`);
  assert.equal(await page.locator(".bn-token--0").getAttribute("data-pos"), "19", "it zooms to the rocket");
  await page.waitForFunction(() => { const p = document.querySelector(".bn-pop"); return !p.hidden && p.textContent === "⭐"; }, null, { timeout: 4000 });
  assert.ok(Date.now() - t0 < 4000, "a zoom is quick, not a crawl");
  await page.waitForFunction(() => !document.querySelector(".bn-token--0").classList.contains("bn-token--ride"), null, { timeout: 4000 });
  assert.equal((await st()).seats[0].stars, 1, "the zoom earned a star");
  assert.match(await page.locator(".bn-pad--0 .bn-pad__stars").textContent(), /⭐ 1/, "and his pad counts it");
});

test("🌈 a picture card BEHIND sends him back to it, as in Candy Land: one swoop, no star, and a kind word", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  // Josh on 25, his next card the dinosaur at 9: sixteen squares BACK
  const s = L.create({ board: "rainbow", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed: 3, first: 0 });
  s.seats[0].pos = 25; s.seats[0].bag = [{ kind: "pic", at: 9 }];
  assert.ok(await page.evaluate((x) => window.__BOARD.load("rainbow", x), s), "fixture: loads");
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.__said = [];
    window.__realAudio = { isMuted: window.JoshAudio.isMuted, say: window.JoshAudio.say, tone: window.JoshAudio.tone };
    window.JoshAudio.isMuted = () => false;
    window.JoshAudio.say = (t) => { window.__said.push(String(t)); };
    window.JoshAudio.tone = () => {};
  });
  try {
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => document.querySelector(".bn-token--0").classList.contains("bn-token--ride"), null, { timeout: 3000 });
  // straight back to the picture: never set down on a square in between
  const seen = await page.evaluate(() => new Promise((res) => {
    const t = document.querySelector(".bn-token--0"), got = new Set([t.dataset.pos]);
    const mo = new MutationObserver(() => got.add(t.dataset.pos));
    mo.observe(t, { attributes: true, attributeFilter: ["data-pos"] });
    setTimeout(() => { mo.disconnect(); res([...got]); }, 1500);
  }));
  assert.deepEqual(seen.filter((p) => p !== "25" && p !== "9"), [], `the slide set the token down on ${seen}`);
  assert.equal(await page.locator(".bn-token--0").getAttribute("data-pos"), "9", "all the way back to the dinosaur");
  const after = await st();
  assert.equal(after.seats[0].pos, 9, "the engine agrees");
  assert.equal(after.seats[0].stars, 0, "a slide back is not a ride: no star");
  await page.waitForFunction(() => !document.querySelector(".bn-token--0").classList.contains("bn-token--ride"), null, { timeout: 4000 });
  const said = await page.evaluate(() => window.__said);
  assert.ok(said.some((t) => /back to Dino land/.test(t)), `it says where he goes back to (${said.join(" | ")})`);
  assert.ok(!said.some((t) => /zoom/i.test(t)), `it never says "Zoom" for a slide back (${said.join(" | ")})`);
  } finally {
    await page.evaluate(() => { if (window.__realAudio) Object.assign(window.JoshAudio, window.__realAudio); delete window.__realAudio; });
  }
});

test("a ride's ⭐ lands on the pad when the token LANDS, not the moment the dice decide it", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await slow();
  try {
    await startGame("moon", "river", true, 20, 0);   // 3 hops to the rocket at 4
    await page.locator(".bn-pad--0").click();
    await page.waitForFunction(() => window.__BOARD.state().phase === "hop" && !window.__BOARD.busy(), null, { timeout: 6000 });
    for (let k = 0; k < 3; k++) { await page.locator(".bn-pad--0").click(); await page.waitForTimeout(320); }
    await page.waitForFunction(() => document.querySelector(".bn-token--0").classList.contains("bn-token--ride"), null, { timeout: 4000 });
    assert.equal((await st()).seats[0].stars, 1, "fixture: the engine has already counted the star");
    assert.equal(await page.locator(".bn-pad--0 .bn-pad__stars").textContent(), "", "mid-ride, the pad has no star yet");
    await page.waitForFunction(() => document.querySelector(".bn-pad--0 .bn-pad__stars").textContent === "⭐ 1", null, { timeout: 4000 });
  } finally { await quick(); }
});

test("🍎 the finale: both baskets TIP into the pie, counting by tens — 10, 20 — then the spare apples, then the party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  // Josh's basket full (he is the helper), River's at 8 with a 3 to spin: two
  // apples fill it and one goes in the pie — the game ends on 20 + 1
  const s = L.create({ board: "apple", seats: [{ who: "josh" }, { who: "river" }], seed: 3, first: 0 });
  s.seats[0].pos = 10; s.seats[0].home = true; s.order = [0]; s.mover = 1;
  s.seats[1].pos = 8; s.seats[0].bag = [3];
  assert.ok(await page.evaluate((x) => window.__BOARD.load("apple", x), s), "fixture: loads");
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  // record every number the pie pops, and how full the baskets look at each
  await page.evaluate(() => {
    window.__pops = [];
    const p = document.querySelector(".bn-pop");
    new MutationObserver(() => { if (!p.hidden) window.__pops.push([p.textContent, document.querySelectorAll(".bn-apple[data-seat]").length]); })
      .observe(p, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  });
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => window.__BOARD.state().phase === "pick" && !window.__BOARD.busy(), null, { timeout: 6000 });
  for (let k = 0; k < 3; k++) {
    if ((await st()).phase !== "pick") break;
    await page.locator(".bn-pad--0").click(); await page.waitForTimeout(320);
  }
  await page.locator(".bn-party").waitFor({ state: "visible", timeout: 10000 });
  const rec = await page.evaluate(() => window.__pops);
  const pops = rec.map((x) => x[0]);
  const at10 = pops.indexOf("10", pops.lastIndexOf("+1")), at20 = pops.indexOf("20", at10), at21 = pops.indexOf("21", at20);
  assert.ok(at10 >= 0 && at20 > at10 && at21 > at20, `the pie counts 10, then 20, then 21 (popped: ${pops.join(" ")})`);
  // a tipping basket is EMPTY while its apples fly: never ten in the basket
  // and ten more in the air (it showed twenty apples where ten should be)
  assert.equal(rec[at10][1], 10, `as the pie says 10, only the other basket still holds apples (saw ${rec[at10][1]} in baskets)`);
  assert.equal(rec[at20][1], 0, `as the pie says 20, both baskets are empty (saw ${rec[at20][1]})`);
  // the baskets really tip: once the pie has counted, no apple is left in a basket
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".bn-apple[data-seat]").count(), 0, "both baskets are empty: their apples are in the pie");
  assert.ok(await page.locator(".bn-apple[data-pie]").count() >= 10, "and the pie is full of apples");
  assert.match(await page.locator(".bn-board").getAttribute("aria-label"), /21 in the pie/, "the board says what is in the pie");
});

test("🍎 the spinner's WHEEL spins and 🌈 a drawn card FLIPS over — and neither moves under reduced motion", async () => {
  for (const motion of ["no-preference", "reduce"]) {
    await page.emulateMedia({ reducedMotion: motion });
    try {
      await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
      await slow();
      await startGame("apple", "raegar", false, 6, 0);
      await page.locator(".bn-pad--0").click();
      await page.locator(".bn-pad--0 .bn-spinner--go").waitFor({ state: "visible", timeout: 3000 });
      const spin = await page.evaluate(() => {
        const svg = document.querySelector(".bn-pad--0 .bn-spinner--go svg");
        return { anims: svg.getAnimations().map((a) => a.animationName), wheel: !!svg.querySelector("path") };
      });
      assert.ok(spin.wheel, `[${motion}] it is the wheel that spins`);
      assert.deepEqual(spin.anims, motion === "reduce" ? [] : ["bnSpin"], `[${motion}] the wheel's animation`);
      // it lands on a face: the spinning wheel goes and the apples it says show
      await page.waitForFunction(() => !document.querySelector(".bn-spinner--go") && document.querySelector(".bn-pad--0 .bn-spin"), null, { timeout: 3000 });
      await startGame("rainbow", "dad", false, 3, 0);
      await page.locator(".bn-pad--0").click();
      await page.locator(".bn-pad--0 .bn-card--flip").waitFor({ state: "attached", timeout: 3000 });
      const flip = await page.evaluate(() => document.querySelector(".bn-pad--0 .bn-card--flip").getAnimations().map((a) => a.animationName));
      assert.deepEqual(flip, motion === "reduce" ? [] : ["bnFlip"], `[${motion}] the card's flip`);
    } finally {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await quick();
    }
  }
});

test("the party shows each player's ⭐ haul; Apple Spin (whose haul is the pie) and a starless game show none", async () => {
  const party = async (box, stars) => {
    const b = { moon: "moon", comet: "comet", rainbow: "rainbow", apple: "apple" }[box];
    const s = L.create({ board: b, seats: [{ who: "josh" }, { who: "river", cpu: true }], seed: 3, first: 0 });
    const size = b === "apple" ? 10 : 36;
    s.seats.forEach((x, i) => { x.pos = size; x.home = true; x.stars = stars[i]; }); s.phase = "done"; s.order = [0, 1];
    assert.ok(await page.evaluate((a) => window.__BOARD.load(a[0], a[1]), [box, s]), `fixture: a finished ${box} loads`);
    await page.locator(".bn-party").waitFor({ state: "visible" });
    return page.evaluate(() => ({
      hauls: [...document.querySelectorAll(".bn-party__haul")].map((h) => (h.hidden ? null : h.textContent)),
      label: document.querySelector(".bn-party").getAttribute("aria-label"),
    }));
  };
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true, done: { moon: 2 } }));
  let r = await party("comet", [5, 2]);
  assert.deepEqual(r.hauls, ["⭐ 5", "⭐ 2"], "Comet Moon: each dances over their stars");
  assert.match(r.label, /Josh has 5 stars, River has 2 stars/, "and the party says it in words");
  r = await party("rainbow", [1, 0]);
  assert.deepEqual(r.hauls, ["⭐ 1", "⭐ 0"], "one player's zoom: both show their count");
  r = await party("moon", [0, 0]);
  assert.deepEqual(r.hauls, [null, null], "no stars at all: no ⭐ 0 to count");
  r = await party("apple", [0, 0]);
  assert.deepEqual(r.hauls, [null, null], "Apple Spin: the pie is the haul");
});

test("every finished game earns its box a 🏆 on the shelf, counted — and a fresh box has none", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true, done: { moon: 3 } }));
  await go("#board-home", "#screen-board-home");
  const won = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".bn-box")].map((b) => {
    const w = b.querySelector(".bn-box__won");
    return [b.dataset.box, w ? w.textContent : null];
  })));
  // (every box on the shelf, derived: a hand-typed list went stale the day a
  // fourteenth box landed)
  // (and only the boxes on it: one waiting for another box is not there yet)
  const want = await page.evaluate(() => Object.fromEntries(window.BoardData.BOXES.filter((b) => !b.unlockAfter || b.unlockAfter.box === "moon").map((b) => [b.id, b.id === "moon" ? "🏆 3" : null])));
  assert.ok(Object.keys(want).length >= 14, "fixture: the whole shelf");
  assert.deepEqual(await won(), want, "three Moon games: 🏆 3; the rest none yet");
  assert.match(await page.locator('.bn-box[data-box="moon"]').getAttribute("aria-label"), /played 3 times/);
  // the trophy pill sits in the corner, never on the box's name
  const clear = await page.evaluate(() => {
    const b = document.querySelector('.bn-box[data-box="moon"]'), w = b.querySelector(".bn-box__won").getBoundingClientRect(), l = b.querySelector(".bn-box__label").getBoundingClientRect(), r = b.getBoundingClientRect();
    return { overLabel: w.bottom > l.top && w.top < l.bottom && w.right > l.left && w.left < l.right, inside: w.left >= r.left && w.right <= r.right && w.top >= r.top };
  });
  assert.ok(!clear.overLabel && clear.inside, "the 🏆 sits inside its box and clear of the name");
  // finishing a game here, for real, puts one more on the pile
  const s = L.create({ board: "rainbow", seats: [{ who: "josh" }, { who: "dad" }], seed: 3, first: 0 });
  s.seats[1].pos = 36; s.seats[1].home = true; s.order = [1]; s.seats[0].pos = 35; s.mover = 0;
  assert.ok(await page.evaluate((x) => window.__BOARD.load("rainbow", x), s), "fixture: one card from home");
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  await page.locator(".bn-pad--0").click();
  await page.locator(".bn-party").waitFor({ state: "visible", timeout: 8000 });
  await go("#board-home", "#screen-board-home");
  assert.equal((await won()).rainbow, "🏆 1", "his first Rainbow Trail game: 🏆 1");
});

test("🌈 a whole Rainbow Trail against the computer: one tap, one card, every move forward to its colour, one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
    await startGame("rainbow", "raegar", true, 5, 0);
    const b = await page.evaluate(() => window.BoardData.board("rainbow"));
    let cards = 0;
    for (let guard = 0; guard < 200; guard++) {
      await untilTap(0);
      const s = await st();
      if (s.phase === "done") break;
      const mover = s.mover, from = s.seats[mover].pos;
      await page.locator(".bn-pad--0").click();
      await page.waitForFunction((c) => window.__BOARD.state().seats[c.m].pos !== c.f || window.__BOARD.state().phase === "done", { m: mover, f: from }, { timeout: 8000 });
      const x = await st();
      cards++;
      const to = x.seats[mover].pos, card = x.card;
      assert.ok(to > from, `a card never moves him back (${from} → ${to})`);
      if (card.kind === "one" && to < b.size) {
        assert.equal(b.colours.charAt(to - 2), card.c, `a ${card.c} card lands on a ${card.c} square`);
        assert.ok(!b.colours.slice(from - 1, to - 2).includes(card.c), "…the NEXT one of that colour, never one further");
      }
    }
    const end = await st();
    assert.equal(end.phase, "done", "the game ends");
    assert.ok(end.seats.every((x) => x.home), "both get to the party — nobody loses");
    assert.ok(cards >= 4, `he drew cards (${cards})`);
    await page.locator(".bn-party").waitFor({ state: "visible" });
    const sv = await page.evaluate(() => window.__BOARD.save());
    assert.equal(sv.done.rainbow, 1, "a finished Rainbow Trail counts once");
    assert.equal(sv.games.rainbow, undefined, "and leaves nothing waiting on the box");
  } finally { await slow(); }
});

test("☄️ a comet on Comet Moon: he slides DOWN one row, glowing, lands with a ⭐, and the friend cheers", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true, done: { moon: 2 } }));
  // Josh on 19, a 2 to roll: he lands on 21, a comet's head (21 → 16)
  const s = L.create({ board: "comet", seats: [{ who: "josh" }, { who: "viraj", cpu: true }], seed: 3, first: 0 });
  s.seats[0].pos = 19; s.seats[0].bag = [2];
  assert.equal(L.jumpAt(require("../scripts/board-data.js").board("comet"), 21).kind, "comet", "fixture: 21 is a comet's head");
  assert.ok(await page.evaluate((x) => window.__BOARD.load("comet", x), s), "fixture: loads");
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => window.__BOARD.state().phase === "hop" && !window.__BOARD.busy(), null, { timeout: 6000 });
  for (let k = 0; k < 2; k++) { await page.locator(".bn-pad--0").click(); await page.waitForTimeout(320); }
  await page.waitForFunction(() => document.querySelector(".bn-token--0").classList.contains("bn-token--ride"), null, { timeout: 4000 });
  assert.equal(await page.evaluate(() => document.querySelector(".bn-pad--1").classList.contains("bn-pad--cheer")), true, "Viraj cheers him on");
  await page.waitForFunction(() => document.querySelector(".bn-token--0").dataset.pos === "16", null, { timeout: 4000 });
  await page.waitForFunction(() => { const p = document.querySelector(".bn-pop"); return !p.hidden && p.textContent === "⭐"; }, null, { timeout: 4000 });
  const x = await st();
  assert.equal(x.seats[0].pos, 16, "the comet slid him down to 16 — one row, no further");
  assert.equal(x.seats[0].stars, 1, "and gave him a star for the ride");
  await page.waitForFunction(() => document.querySelector(".bn-pad--0 .bn-pad__stars").textContent === "⭐ 1", null, { timeout: 4000 });
});

test("💯 a whole Hundred Hop against the computer: a real hundred chart, a TEN is one tap straight DOWN a row, a ⭐ on a tens square, one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("hundred", "raegar", true, 5, 0);
  // the chart reads like the Montessori board: 1 top left, 100 bottom right,
  // the tens column gold; and every number is big enough to read
  const chart = await page.evaluate(() => {
    const r = (n) => document.querySelector('.bn-cell[data-n="' + n + '"]').getBoundingClientRect();
    const num = document.querySelector('.bn-num[data-n="47"]');
    return { one: r(1), ten: r(10), eleven: r(11), hundred: r(100), font: num.getBoundingClientRect().height, cells: document.querySelectorAll(".bn-cell").length,
      tensFill: document.querySelector('.bn-cell[data-n="30"]').getAttribute("fill"), plainFill: document.querySelector('.bn-cell[data-n="31"]').getAttribute("fill") };
  });
  assert.equal(chart.cells, 100, "a hundred squares");
  assert.ok(chart.one.left < chart.ten.left && Math.abs(chart.one.top - chart.ten.top) < 1, "1 and 10 share the top row, 1 at the left");
  assert.ok(Math.abs(chart.eleven.left - chart.one.left) < 1 && chart.eleven.top > chart.one.top, "11 sits straight below 1");
  assert.ok(chart.hundred.left > chart.one.left && chart.hundred.top > chart.one.top, "100 is at the bottom right");
  assert.ok(chart.font >= 10, `the numbers are readable (${chart.font.toFixed(1)}px tall)`);
  assert.notEqual(chart.tensFill, chart.plainFill, "the tens column stands out");
  let tens = 0, small = 0, starSeen = false, tenBarSeen = false;
  for (let guard = 0; guard < 400; guard++) {
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    if (s.phase === "roll") {
      await page.locator(".bn-pad--0").click();
      await page.waitForFunction(() => window.__BOARD.state().phase !== "roll" || window.__BOARD.state().turn !== 0);
      continue;
    }
    const mover = s.mover, from = (await page.evaluate(() => window.__BOARD.shown()))[mover];
    const tenRoll = s.die === 10;
    if (tenRoll) tenBarSeen = tenBarSeen || await page.locator(".bn-pad--0 .bn-die--ten .bn-bead").count() === 10;
    const box0 = await page.locator(".bn-token--" + mover).boundingBox();
    const stars0 = s.seats[mover].stars;
    await page.locator(".bn-pad--0").click();
    await page.waitForFunction((a) => window.__BOARD.shown()[a[0]] !== a[1], [mover, from]);
    await page.waitForTimeout(80);
    const to = (await page.evaluate(() => window.__BOARD.shown()))[mover];
    if (tenRoll) {
      tens++;
      assert.equal(to, Math.min(100, from + 10), `one tap of a ten-bar is ten more (${from} → ${to})`);
      if (to < 100) {
        const box1 = await page.locator(".bn-token--" + mover).boundingBox();
        assert.ok(Math.abs(box1.x - box0.x) < 2 && box1.y > box0.y, `ten more is straight DOWN the chart (${JSON.stringify([box0, box1])})`);
      }
    } else { small++; assert.equal(to, from + 1, "a small number hops one square a tap"); }
    const after = await st();
    if (after.seats[mover].stars > stars0) starSeen = true;
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.ok(end.seats.every((x) => x.home && x.pos === 100), "both reach one hundred");
  assert.ok(tens > 2 && small > 2, `he slid tens (${tens}) and hopped small numbers (${small})`);
  assert.ok(tenBarSeen, "a ten shows on his pad as a bar of ten golden beads");
  assert.ok(starSeen || end.seats.some((x) => x.stars > 0), "a tens square gave a star");
  await page.locator(".bn-party").waitFor({ state: "visible" });
  const sv = await page.evaluate(() => window.__BOARD.save());
  assert.equal(sv.done.hundred, 1, "a finished Hundred Hop counts once");
  } finally { await slow(); }
});

test("💯 on the hundred chart a token never covers its square's number, and a tens square's ⭐ is SEEN (popped, and counted on the pad)", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  const s = L.create({ board: "hundred", seats: [{ who: "josh" }, { who: "dad" }], seed: 3, first: 0 });
  s.seats[0].pos = 18; s.seats[1].pos = 57; s.seats[0].bag = [2];
  assert.ok(await page.evaluate((x) => window.__BOARD.load("hundred", x), s), "fixture: the game loads");
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(450);
  // a square is too small for a token BESIDE its number: the token is a ring
  // round its own square (the number shows inside, so the ring is see-through)
  // and its face sits in the square's bottom right quarter, clear of every
  // number — its own and its neighbours'
  const gap = async () => page.evaluate(() => [...document.querySelectorAll(".bn-token")].map((t) => {
    const n = t.dataset.pos, k = t.getBoundingClientRect(), cell = document.querySelector('.bn-cell[data-n="' + n + '"]').getBoundingClientRect();
    const f = t.querySelector(".bn-token__face").getBoundingClientRect();
    const hit = (a) => f.left < a.right && f.right > a.left && f.top < a.bottom && f.bottom > a.top;
    const covered = [...document.querySelectorAll(".bn-num")].filter((m) => hit(m.getBoundingClientRect())).map((m) => m.dataset.n);
    const ringOnSquare = Math.abs((k.left + k.right) / 2 - (cell.left + cell.right) / 2) < 2 && Math.abs((k.top + k.bottom) / 2 - (cell.top + cell.bottom) / 2) < 2;
    const seeThrough = getComputedStyle(t).backgroundColor === "rgba(0, 0, 0, 0)";
    return { n, ov: covered.length > 0 || !ringOnSquare || !seeThrough, covered, ringOnSquare, seeThrough, face: f.width };
  }));
  for (const x of await gap()) assert.ok(!x.ov, `the token on ${x.n}: ${JSON.stringify(x)}`);
  // 18 + 2 = 20: a tens square, and its star is popped and lands on his pad
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => window.__BOARD.state().phase === "hop" && !window.__BOARD.busy());
  await page.locator(".bn-pad--0").click();
  await page.waitForTimeout(320);
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => document.querySelector(".bn-pop") && !document.querySelector(".bn-pop").hidden && document.querySelector(".bn-pop").textContent === "⭐", null, { timeout: 5000 });
  await page.waitForFunction(() => /⭐ 1/.test(document.querySelector(".bn-pad--0 .bn-pad__stars").textContent), null, { timeout: 5000 });
  for (const x of await gap()) assert.ok(!x.ov, `the token on ${x.n}: ${JSON.stringify(x)}`);
});

test("🐔 a whole Hen House against the computer: ONE hen, spin an animal and its square lights up, every tap one chick home, all 35 home in one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("hen", "viraj", true, 4, 0);
  const visible = await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden && t.getBoundingClientRect().width > 0).length);
  assert.equal(visible, 1, "co-op: one token on the farm, the hen");
  assert.ok(await page.evaluate(() => /🐔/.test(document.querySelector(".bn-token--0").textContent)), "and it is a hen");
  let spins = 0, chicks = 0, marked = 0;
  for (let guard = 0; guard < 300; guard++) {
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    if (s.phase === "spin") {
      spins++;
      await page.locator(".bn-pad--0").click();
      await page.waitForFunction(() => window.__BOARD.state().phase !== "spin" || window.__BOARD.state().turn !== 0);
      const t = await st();
      if (t.phase === "hop" && t.turn === 0) {
        // the square she walks to lights up, and wears the animal spun
        await page.waitForFunction(() => { const m = document.querySelector(".bn-mark"); return m && !m.hidden; }, null, { timeout: 4000 });
        const m = await page.evaluate(() => { const mk = document.querySelector(".bn-mark"); const n = mk.dataset.n; const a = document.querySelector('.bn-farm[data-n="' + n + '"]'); return { n: Number(n), a: a ? a.dataset.a : null }; });
        const target = t.seats[0].pos + t.left;
        assert.equal(m.n, target, "the lit square is where she walks to");
        if (target < 36) assert.equal(m.a, t.card, "and it has the animal he spun");
        assert.ok(await page.evaluate(() => !!document.querySelector(".bn-pad--0 .bn-spin--farm")), "his pad shows the animal spun");
        marked++;
      }
      continue;
    }
    // a step: the hen walks one square and ONE more chick is home
    const before = await page.evaluate(() => Number(document.querySelector(".bn-coop").dataset.n));
    await page.locator(".bn-pad--0").click();
    await page.waitForFunction((b) => Number(document.querySelector(".bn-coop").dataset.n) !== b, before, { timeout: 4000 });
    const after = await page.evaluate(() => Number(document.querySelector(".bn-coop").dataset.n));
    if (after !== 35) assert.equal(after, before + 1, `one tap, one chick home (${before} → ${after})`);
    chicks++;
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.equal(end.coop, 35, "all 35 chicks are home");
  assert.ok(spins > 2 && chicks > 5 && marked > 2, `he spun (${spins}), walked (${chicks}) and saw where to go (${marked})`);
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => document.querySelector(".bn-coop").textContent), "🐥 35", "the hen house shows all 35");
  assert.equal(await page.locator(".bn-party__haul:not([hidden])").count(), 0, "co-op: no star haul, one shared party");
  const sv = await page.evaluate(() => window.__BOARD.save());
  assert.equal(sv.done.hen, 1, "a finished Hen House counts once");
  } finally { await slow(); }
});

test("🐔 the fox joins from his THIRD Hen House game, and it only ever sends one chick out to PLAY — said kindly, shown with the sound off", async () => {
  // the fox comes with the third game, through the real who-screens
  for (const [done, fox] of [[1, false], [2, true]]) {
    await page.evaluate((d) => window.__BOARD.reset({ introSeen: true, done: { hen: d } }), done);
    await go("#board-pick-hen-cpu", "#screen-board-pick");
    await page.locator('.bn-person[data-who="river"]').click();
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    assert.equal((await st()).fox, fox, `after ${done} games the fox is ${fox ? "on" : "off"}`);
  }
  // a fox spun with chicks home: one runs OUT to play
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  const s = L.create({ board: "hen", seats: [{ who: "josh" }, { who: "dad" }], seed: 3, first: 0, fox: true });
  s.seats[0].pos = s.seats[1].pos = 4; s.coop = 3; s.seats[0].bag = [L.FOX];
  await page.evaluate(() => {
    window.__said = [];
    window.__realSay = window.JoshAudio.say; window.__realMuted = window.JoshAudio.isMuted;
    window.JoshAudio.say = (t) => window.__said.push(t); window.JoshAudio.isMuted = () => false;
  });
  try {
    assert.ok(await page.evaluate((x) => window.__BOARD.load("hen", x), s), "fixture: the game loads");
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    await page.waitForTimeout(450);
    assert.equal(await page.evaluate(() => document.querySelector(".bn-coop").textContent), "🐥 3");
    await page.locator(".bn-pad--0").click();
    await page.waitForFunction(() => document.querySelector(".bn-coop").textContent === "🐥 2", null, { timeout: 5000 });
    assert.ok(await page.evaluate(() => !!document.querySelector(".bn-pad--0 .bn-spin--fox")), "his pad shows the 🦊");
    await page.waitForFunction(() => window.__said.some((t) => /fox wants to play/.test(t)), null, { timeout: 5000 });
    const said = await page.evaluate(() => window.__said);
    assert.ok(!said.some((t) => /\b(lose|lost|gone|eat|ate|bad)\b/i.test(t)), `the fox is never scary (${said.join(" | ")})`);
    const t = await st();
    assert.equal(t.out, 1, "one chick is out playing");
    assert.equal(t.seats[0].pos, 4, "and the hen did not move");
  } finally {
    await page.evaluate(() => { window.JoshAudio.say = window.__realSay; window.JoshAudio.isMuted = window.__realMuted; });
  }
});

test("🧺 a whole Picnic Lotto against the computer: tap the basket, find WHOSE blanket the food is on, a wrong friend only wiggles, both blankets fill, one picnic", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("lotto", "river", true, 6, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "a picnic has no tokens: the foods are the pieces");
  // two blankets of six, each food a faint picture of what to look for
  const start = await page.evaluate(() => ({ ghosts: document.querySelectorAll(".bn-food--ghost").length, on: document.querySelectorAll(".bn-food--on").length }));
  assert.deepEqual(start, { ghosts: 12, on: 0 }, "twelve spots to fill, none filled");
  let mine = 0, theirs = 0, missed = 0;
  for (let guard = 0; guard < 200; guard++) {
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    if (s.phase === "draw") {
      await page.locator(".bn-pad--0").click();
      await page.waitForFunction(() => window.__BOARD.state().phase === "give" && !window.__BOARD.busy(), null, { timeout: 4000 });
      continue;
    }
    // a food in his hand: it shows on his pad, and BOTH pads are answers
    const food = s.food, owner = s.blankets[0].indexOf(food) >= 0 ? 0 : 1;
    const pad = await page.evaluate(() => document.querySelector(".bn-pad--0 .bn-card--food").textContent);
    assert.ok(pad.length > 0, "the food in hand is on his pad");
    // …and the friend's pad is the friend's BLANKET, never the basket (a
    // basket there read as "tap the basket again", round 5)
    const other = await page.evaluate(() => { const p = document.querySelector(".bn-pad--1"); return { blanket: !!p.querySelector(".bn-card--blanket"), basket: p.textContent.indexOf("🧺") >= 0 }; });
    assert.deepEqual(other, { blanket: true, basket: false }, "while he asks whose it is, River's pad shows River's blanket");
    assert.ok(await page.evaluate(() => [...document.querySelectorAll(".bn-pad")].every((p) => p.classList.contains("bn-pad--ask"))), "both pads stand ready: whose is it?");
    if (missed < 2) {
      // the wrong friend first: a wiggle, nothing moves, still his food
      await page.locator(".bn-pad--" + (1 - owner)).click();
      await page.waitForTimeout(80);
      const after = await st();
      assert.equal(after.phase, "give", "a wrong friend changes nothing");
      assert.equal(after.food, food, "the food is still in his hand");
      missed++;
      if (missed === 2) {
        await page.waitForFunction((f) => { const e = document.querySelector('.bn-food[data-food="' + f + '"]'); return e && e.classList.contains("bn-food--hint"); }, food, { timeout: 4000 });
      }
      continue;
    }
    await page.locator(".bn-pad--" + owner).click();
    await page.waitForFunction((f) => { const e = document.querySelector('.bn-food[data-food="' + f + '"]'); return e && e.classList.contains("bn-food--on"); }, food, { timeout: 4000 });
    if (owner === 0) mine++; else theirs++;
  }
  const end = await st();
  assert.equal(end.phase, "done", "the picnic ends");
  assert.ok(end.placed.every((p) => p.length === 6), "both blankets are full");
  assert.ok(mine > 0 && theirs > 0, `he put food on his own blanket (${mine}) AND gave some to his friend (${theirs})`);
  assert.equal(missed, 2, "fixture: the wrong friend was tapped twice, and the spot then glowed");
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => document.querySelectorAll(".bn-food--on").length), 12, "all twelve foods are on the blankets");
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.lotto, 1, "a finished Picnic Lotto counts once");
  } finally { await slow(); }
});

test("🧺 his friend's turn shows the worked example: the computer takes a food and gives it to the right blanket by itself; and a game left mid-give comes back with the food still in hand", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("lotto", "raegar", true, 9, 1);
  assert.equal((await st()).turn, 1, "fixture: the friend starts");
  await page.waitForFunction(() => { const s = window.__BOARD.state(); return s.placed[0].length + s.placed[1].length === 1; }, null, { timeout: 8000 });
  const s = await st();
  const placed = s.placed[0].concat(s.placed[1])[0];
  const owner = s.blankets[0].indexOf(placed) >= 0 ? 0 : 1;
  assert.ok(s.placed[owner].indexOf(placed) >= 0, "the computer put it on the blanket that has it");
  } finally { await slow(); }
  // carry on mid-give: the food is still in his hand when he comes back
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  const g = L.create({ board: "lotto", seats: [{ who: "josh" }, { who: "mom" }], seed: 5, first: 0 });
  L.takeFood(g);
  assert.ok(await page.evaluate((x) => window.__BOARD.load("lotto", x), g), "fixture: a game mid-give loads");
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(450);
  const back = await st();
  assert.equal(back.food, g.food, "the food is still in hand");
  assert.ok(await page.evaluate(() => !!document.querySelector(".bn-pad--0 .bn-card--food")), "and on his pad");
  const owner2 = L.ownerOf(g, g.food);
  await page.locator(".bn-pad--" + owner2).click();
  await page.waitForFunction((f) => { const e = document.querySelector('.bn-food[data-food="' + f + '"]'); return e && e.classList.contains("bn-food--on"); }, g.food, { timeout: 4000 });
});

test("👀 a whole Twin Spot against the computer: flip a card, find the ONE picture on both, a wrong one only wiggles, the twin glows after two, all twelve found, one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("spot", "river", true, 8, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "no tokens: the cards are the pieces");
  const deck = await page.evaluate(() => window.BoardData.board("spot").deck);
  let found = 0, missed = 0;
  for (let guard = 0; guard < 200; guard++) {
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    if (s.phase === "flip") {
      await page.locator(".bn-pad--0").click();
      await page.waitForFunction(() => window.__BOARD.state().phase === "find" && !window.__BOARD.busy(), null, { timeout: 4000 });
      continue;
    }
    // the middle card and the flipped card are on screen, and share ONE picture
    // (the screen follows a moment behind the engine: a loaded machine can
    // still be painting the card that just moved to the middle)
    await page.waitForFunction((want) => {
      const mid = [...document.querySelectorAll(".bn-spotcard--mid .bn-twin")].map((x) => Number(x.dataset.p)).sort((a, b) => a - b);
      return JSON.stringify(mid) === JSON.stringify(want);
    }, deck[s.centre].slice().sort((a, b) => a - b), { timeout: 5000 }).catch(() => {});
    const shown = await page.evaluate(() => ({
      mid: [...document.querySelectorAll(".bn-spotcard--mid .bn-twin")].map((x) => Number(x.dataset.p)),
      hand: [...document.querySelectorAll(".bn-spotcard--hand .bn-twin")].map((x) => Number(x.dataset.p)),
      // (offsetWidth: the card may still be mid-flip, and a flip's transform
      // is not the tap box)
      sizes: [...document.querySelectorAll(".bn-spotcard--hand button.bn-twin")].map((x) => x.offsetWidth),
    }));
    assert.deepEqual(shown.mid.slice().sort(), deck[s.centre].slice().sort(), "the middle card is the middle card");
    assert.deepEqual(shown.hand.slice().sort(), deck[s.hand].slice().sort(), "his flipped card is his card");
    assert.ok(shown.sizes.length === 4 && shown.sizes.every((w) => w >= 75), `four big pictures to tap (${shown.sizes})`);
    const twin = deck[s.centre].find((p) => deck[s.hand].indexOf(p) >= 0);
    if (missed < 2) {
      const wrong = deck[s.hand].find((p) => p !== twin);
      await page.locator('.bn-spotcard--hand button.bn-twin[data-p="' + wrong + '"]').click();
      await page.waitForTimeout(80);
      const after = await st();
      assert.equal(after.phase, "find", "a wrong picture changes nothing");
      assert.equal(after.hand, s.hand, "the card is still his to look at");
      missed++;
      if (missed === 2) {
        const glow = await page.evaluate((t) => [...document.querySelectorAll('.bn-twin[data-p="' + t + '"]')].filter((x) => x.classList.contains("bn-twin--hint")).length, twin);
        assert.equal(glow, 2, "after two, the twin glows on BOTH cards");
      }
      continue;
    }
    await page.locator('.bn-spotcard--hand button.bn-twin[data-p="' + twin + '"]').click();
    await page.waitForFunction((c) => window.__BOARD.state().centre === c, s.hand, { timeout: 4000 });
    found++;
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.equal(end.seats[0].pos + end.seats[1].pos, 12, "all twelve twins found");
  assert.ok(found >= 5, `he found his twins (${found})`);
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.spot, 1, "a finished Twin Spot counts once");
  } finally { await slow(); }
});

test("👀 on the computer's turn its card cannot be tapped, it finds the twin itself (a worked example), and the twin glows on both cards before the card moves", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await startGame("spot", "viraj", true, 3, 1);
  const s0 = await st();
  assert.equal(s0.turn, 1, "fixture: the friend starts");
  await page.waitForFunction(() => window.__BOARD.state().phase === "find", null, { timeout: 8000 });
  const s1 = await st();
  // a tap on the computer's card does nothing
  const deck = await page.evaluate(() => window.BoardData.board("spot").deck);
  const twin = deck[s1.centre].find((p) => deck[s1.hand].indexOf(p) >= 0);
  await page.locator('.bn-spotcard--hand .bn-twin[data-p="' + twin + '"]').click({ force: true }).catch(() => {});
  assert.equal((await st()).seats[0].pos, 0, "his tap on the computer's card found nothing for him");
  // the twin glows on BOTH cards as the computer finds it
  await page.waitForFunction((t) => [...document.querySelectorAll('.bn-twin[data-p="' + t + '"]')].filter((x) => x.classList.contains("bn-twin--yes")).length === 2, twin, { timeout: 8000 });
  await page.waitForFunction(() => window.__BOARD.state().seats[1].pos === 1, null, { timeout: 8000 });
});

test("🧠 a whole Peek-a-Pair against the computer: nine cards face down, a turned card shows its picture, a pair glows and is his (go again), a miss turns back over, a second board, one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("pairs", "river", true, 5, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "no tokens: the cards are the pieces");
  const pic = (id) => (id === "star" ? "⭐" : window.BoardData.pairPic(id).pic);
  const dom = () => page.evaluate(() => [...document.querySelectorAll(".bn-pairs .bn-pc")].map((b) => ({
    button: b.tagName === "BUTTON", up: b.classList.contains("bn-pc--up"), gone: b.classList.contains("bn-pc--gone"),
    yes: b.classList.contains("bn-pc--yes"), pic: (b.querySelector(".bn-pc__pic") || {}).textContent || "", w: b.offsetWidth, h: b.offsetHeight })));
  const d0 = await dom();
  assert.equal(d0.length, 9, "nine cards");
  assert.ok(d0.every((c) => c.button && !c.up && c.pic === "" && c.w >= 75 && c.h >= 75), `nine big cards, all face down, no picture showing (${JSON.stringify(d0.map((c) => c.w))})`);
  // a sharp memory: a pair he has SEEN, else a card nobody has looked at
  const choose = (s) => {
    const down = s.cards.map((c, k) => k).filter((k) => !s.gone[k] && s.open.indexOf(k) < 0);
    if (s.phase === "second") { const m = down.find((k) => s.cards[k] === s.cards[s.open[0]] && s.seen[k]); if (m != null) return m; }
    else for (const k of down) if (s.cards[k] !== "star" && s.seen[k] && down.some((j) => j !== k && s.cards[j] === s.cards[k] && s.seen[j])) return k;
    const fresh = down.filter((k) => !s.seen[k]);
    return (fresh.length ? fresh : down)[0];
  };
  let pairs = 0, missesSeen = 0, echoed = false, resumed = false, cpuTried = false, boards = new Set([0]);
  for (let guard = 0; guard < 120; guard++) {
    // the computer's turn: its cards are not his to tap
    const x = await st();
    if (x.phase !== "done" && x.turn === 1 && !cpuTried) {
      cpuTried = true;
      const before = x.seats[0].pos;
      await page.locator(".bn-pairs .bn-pc").first().click({ force: true }).catch(() => {});
      assert.equal((await st()).seats[0].pos, before, "his tap on the computer's turn finds nothing for him");
    }
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    boards.add(s.boardNo);
    const k = choose(s), was = s.phase;
    await page.locator('.bn-pairs button.bn-pc[data-k="' + k + '"]').click();
    await page.waitForFunction((n) => window.__BOARD.state().rolls === n, s.rolls + 1, { timeout: 4000 });
    const a = await st();
    if (was === "flip" && a.phase === "second") {
      // (a first card stays up, so its picture can be read; a second one is
      // gone again at the quick test pace — the glow test below reads that)
      // (the engine has turned it; the picture is painted on the next task)
      await page.waitForFunction((kk) => { const b = document.querySelector('.bn-pairs .bn-pc[data-k="' + kk + '"]'); return b && b.classList.contains("bn-pc--up"); }, k, { timeout: 3000 });
      const shown = await page.evaluate((kk) => { const b = document.querySelector('.bn-pairs .bn-pc[data-k="' + kk + '"]'); return b ? (b.querySelector(".bn-pc__pic") || {}).textContent : null; }, k);
      assert.equal(shown, await page.evaluate(pic, s.cards[k]), "a turned card shows ITS picture");
      if (!echoed) {
        // the hammer's echo: tapping the card already up does nothing
        echoed = true;
        await page.waitForTimeout(80);
        await page.locator('.bn-pairs button.bn-pc[data-k="' + k + '"]').click();
        await page.waitForTimeout(80);
        assert.equal((await st()).rolls, a.rolls, "the card already up cannot be turned again");
      }
      if (!resumed) {
        // leave mid-turn and come back: the card he turned is still up
        resumed = true;
        await go("#board-home", "#screen-board-home");
        await go("#board-play", "#screen-board-play");
        await page.waitForTimeout(100);
        assert.ok(await page.evaluate((kk) => document.querySelector('.bn-pairs .bn-pc[data-k="' + kk + '"]').classList.contains("bn-pc--up"), k), "the card he turned is still up after he comes back");
      }
      continue;
    }
    if (was === "second") {
      const mate = s.open[0];
      if (s.cards[mate] === s.cards[k]) {
        pairs++;
        assert.equal(a.seats[0].pos, s.seats[0].pos + 1, "a pair is his");
        if (a.phase !== "done") assert.equal(a.turn, 0, "a pair goes again");
      } else {
        missesSeen++;
        assert.ok(!a.gone[k] && !a.gone[mate] && a.open.length === 0, "a miss: both still on the board");
        // both stay up a moment, then turn back over
        await page.waitForFunction((m) => [...document.querySelectorAll(".bn-pairs .bn-pc")].filter((b) => m.indexOf(Number(b.dataset.k)) >= 0).every((b) => !b.classList.contains("bn-pc--up")), [k, mate], { timeout: 4000 });
      }
    }
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.equal(end.seats[0].pos + end.seats[1].pos, 8, "all eight pairs found");
  assert.ok(pairs >= 3, `he found pairs of his own (${pairs})`);
  assert.ok(boards.has(1), "a second board was dealt");
  assert.ok(echoed && resumed && cpuTried, "fixture: every check really ran");
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.pairs, 1, "a finished Peek-a-Pair counts once");
  } finally { await slow(); }
});

test("🧠 a pair GLOWS before it leaves (the cards he matched are seen, sound off), and leaves an empty place; his ⭐ lands on his pad", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await startGame("pairs", "river", true, 5, 0);
  const s = await st();
  const k0 = s.cards.findIndex((c) => c !== "star"), k1 = s.cards.findIndex((c, k) => k !== k0 && c === s.cards[k0]);
  await page.locator('.bn-pairs button.bn-pc[data-k="' + k0 + '"]').click();
  await page.waitForFunction(() => window.__BOARD.state().phase === "second", null, { timeout: 4000 });
  await page.waitForTimeout(400);
  await page.locator('.bn-pairs button.bn-pc[data-k="' + k1 + '"]').click();
  await page.waitForFunction((m) => m.every((kk) => document.querySelector('.bn-pairs .bn-pc[data-k="' + kk + '"]').classList.contains("bn-pc--yes")), [k0, k1], { timeout: 3000 });
  await page.waitForFunction((m) => m.every((kk) => document.querySelectorAll(".bn-pairs .bn-pc")[kk].classList.contains("bn-pc--gone")), [k0, k1], { timeout: 4000 });
  assert.equal(await page.locator(".bn-pairs .bn-pc").count(), 9, "the board keeps its shape: an empty place where the pair was");
  await page.waitForFunction(() => /⭐ 1/.test(document.querySelector(".bn-pad--0 .bn-pad__stars").textContent), null, { timeout: 3000 });
  assert.equal((await st()).turn, 0, "and it is still his turn");
});

test("🚪 a whole Shut the Doors against the computer: roll, tap the door that makes it or TWO that do (a ⭐), a wrong door only wiggles and a way glows after two, nothing fits means roll again, every door shut, one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("doors", "river", true, 6, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "no tokens: the doors are the pieces");
  const doors = () => page.evaluate(() => [...document.querySelectorAll(".bn-doors__grid .bn-door")].map((b) => ({ n: Number(b.textContent), button: b.tagName === "BUTTON", held: b.classList.contains("bn-door--held"), hint: b.classList.contains("bn-door--hint"), w: b.offsetWidth, h: b.offsetHeight })));
  const d0 = await doors();
  assert.deepEqual(d0.map((d) => d.n), [1, 2, 3, 4, 5, 6], "his six doors, 1 to 6");
  assert.ok(d0.every((d) => d.button && d.w >= 75 && d.h >= 75), `six big doors (${d0.map((d) => d.w)})`);
  // an OPEN door is a lit doorway showing its number AND its dots (the die's
  // pattern), so the roll can be matched by counting, not only by reading
  const pips = () => page.evaluate(() => [...document.querySelectorAll(".bn-doors__grid .bn-door")].map((b) => b.querySelectorAll(".bn-pip:not(.bn-pip--none)").length));
  assert.deepEqual(await pips(), [1, 2, 3, 4, 5, 6], "every open door wears its own number of dots");
  // the row above the doors says WHOSE doors they are, and (only once rolled)
  // what to make
  const goal = () => page.evaluate(() => {
    const r = document.querySelector(".bn-doors__other");
    return { face: !!r.querySelector(".bn-doors__face svg"), n: (r.querySelector(".bn-goal__n") || {}).textContent || null, dice: [...r.querySelectorAll(".bn-goal__die")].map((d) => d.querySelectorAll(".bn-pip:not(.bn-pip--none)").length), q: !!r.querySelector(".bn-goal__q"), label: r.getAttribute("aria-label") };
  });
  const g0 = await goal();
  assert.ok(g0.face && g0.n === null && g0.dice.length === 0, `before the roll: just whose doors (${JSON.stringify(g0)})`);
  let twos = 0, missed = 0, echoed = false, hinted = false, goaled = false, shutSeen = false;
  for (let guard = 0; guard < 80; guard++) {
    await untilTap(0);
    let s = await st();
    if (s.phase === "done") break;
    if (s.phase === "roll") {
      await page.locator(".bn-pad--0").click();
      await page.waitForFunction((r) => window.__BOARD.state().rolls > r && !window.__BOARD.busy(), s.rolls, { timeout: 4000 });
      continue;
    }
    // shut: which doors make the roll? (his own six, or his friend's once he helps)
    const ways = await page.evaluate(() => window.BoardLogic.doorWays(window.__BOARD.state()));
    if (!goaled) {
      goaled = true;
      const g = await goal();
      assert.ok(g.n === String(s.die) && g.dice.length === 1 && g.dice[0] === s.die && !g.q, `rolled ${s.die}: the goal beside the doors shows its dots and its number (${JSON.stringify(g)})`);
      assert.equal(g.label, "Make " + s.die, "and says so to a screen reader");
      assert.equal((await doors()).filter((d) => d.hint).length, 0, "after the first game, no way glows before he has tried");
    }
    if (!shutSeen && s.seats[s.mover].shut.length) {
      shutSeen = true;
      const sh = await page.evaluate(() => [...document.querySelectorAll(".bn-doors__grid .bn-door--shut")].map((b) => ({ tag: b.tagName, pips: b.querySelectorAll(".bn-pip").length, bg: getComputedStyle(b).backgroundImage })));
      assert.ok(sh.length && sh.every((d) => d.tag === "SPAN" && d.pips === 0 && /linear-gradient/.test(d.bg)), `a shut door is a closed WOODEN door, not a button, no dots (${JSON.stringify(sh)})`);
    }
    const open = [1, 2, 3, 4, 5, 6].filter((n) => s.seats[s.mover].shut.indexOf(n) < 0);
    const wrong = open.find((n) => !ways.some((w) => w.indexOf(n) >= 0));
    if (wrong != null && missed < 2) {
      await page.locator('.bn-doors__grid button.bn-door[data-n="' + wrong + '"]').click();
      await page.waitForTimeout(60);
      const a = await st();
      assert.deepEqual(a.seats[s.mover].shut, s.seats[s.mover].shut, "a wrong door shuts nothing");
      assert.equal(a.phase, "shut", "the roll still waits");
      missed++;
      if (missed === 2) {
        const hint = (await doors()).filter((d) => d.hint).map((d) => d.n);
        assert.ok(hint.length && ways.some((w) => w.every((n) => hint.indexOf(n) >= 0)), `after two, a way that makes ${s.die} glows (${hint})`);
        hinted = true;
      }
      continue;
    }
    const w = ways.find((x) => x.length === 2) || ways[0];
    await page.locator('.bn-doors__grid button.bn-door[data-n="' + w[0] + '"]').click();
    if (w.length === 2) {
      await page.waitForFunction((n) => window.__BOARD.state().held === n, w[0], { timeout: 3000 });
      if (!echoed) {
        echoed = true;
        await page.waitForTimeout(80);
        await page.locator('.bn-doors__grid button.bn-door[data-n="' + w[0] + '"]').click();
        await page.waitForTimeout(60);
        assert.equal((await st()).held, w[0], "the door already held stays held (the hammer's echo)");
      }
      assert.ok((await doors()).find((d) => d.n === w[0]).held, "a held door wears its ring");
      const gh = await goal();
      assert.ok(gh.q && gh.dice[0] === w[0] && gh.dice[1] === s.die && gh.n === String(s.die), `holding ${w[0]}: the goal reads ${w[0]} + ? = ${s.die} (${JSON.stringify(gh)})`);
      await page.locator('.bn-doors__grid button.bn-door[data-n="' + w[1] + '"]').click();
      twos++;
    }
    await page.waitForFunction((n) => window.__BOARD.state().rolls === n && window.__BOARD.state().phase !== "shut", s.rolls, { timeout: 4000 });
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.ok(end.seats.every((x) => x.shut.length === 6), "every door of both players shut");
  assert.ok(twos >= 1 && hinted && echoed && goaled && shutSeen, `fixture: two-door shuts, the hint, the echo, the goal and a shut door all ran (${twos})`);
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.doors, 1, "a finished Shut the Doors counts once");
  } finally { await slow(); }
});

test("🚪 the FIRST Shut the Doors teaches: a way to make the roll glows from the very first roll, before any miss", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: false }));
  await startGame("doors", "river", true, 11, 0);
  await page.waitForTimeout(400);
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => window.__BOARD.state().phase === "shut" && !window.__BOARD.busy(), null, { timeout: 5000 });
  const s = await st();
  assert.equal(s.misses, 0, "fixture: no miss yet");
  const ways = await page.evaluate(() => window.BoardLogic.doorWays(window.__BOARD.state()));
  const hint = await page.evaluate(() => [...document.querySelectorAll(".bn-doors__grid .bn-door--hint")].map((b) => Number(b.dataset.n)));
  assert.ok(hint.length && ways.some((w) => w.every((n) => hint.indexOf(n) >= 0)), `rolled ${s.die}: a way glows at once (${hint})`);
});

test("🎲 the FIRST Pick a Die teaches: the die that reaches a rocket glows — and in a later game it does not (its board is Moon Race's dice game, so its lesson has a key of its own)", async () => {
  // Found by the audit: the shell drew this glow from `game.teach`, and TEACH
  // is keyed by the board's game, which for Pick a Die is "dice" — Moon
  // Race's — so the glow its own comment promises had never once been shown.
  for (const seen of [false, true]) {
    await page.evaluate((x) => window.__BOARD.reset(x ? { introSeen: true } : {}), seen);
    const ok = await page.evaluate(() => {
      const L = window.BoardLogic;
      // a seed whose first roll gives two different dice and ONE best die
      for (let seed = 1; seed < 400; seed++) {
        const g = L.create({ board: "pickdie", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed, first: 0 });
        L.roll(g);
        if (g.phase === "choose" && g.dice[0] !== g.dice[1] && L.dieBest(g).length === 1) return window.__BOARD.load("pickdie", g);
      }
      return false;
    });
    assert.ok(ok, "fixture: a first roll with one best die loads");
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelectorAll("button.bn-pickd").length === 2, null, { timeout: 5000 });
    const d = await page.evaluate(() => ({
      best: window.BoardLogic.dieBest(window.__BOARD.state()),
      hint: [...document.querySelectorAll("button.bn-pickd.bn-pickd--hint")].map((b) => Number(b.dataset.k)),
    }));
    if (!seen) assert.deepEqual(d.hint, d.best, "his first Pick a Die: the die that lands on a rocket glows");
    else assert.deepEqual(d.hint, [], "a later Pick a Die: nothing glows — picking is the skill");
  }
});

test("🁢 🌰 🍪 🔴 🃏 🎨 the FIRST Dot Dominoes, Acorn Pots, Cookie Jar, Line Up, Top Card and Colour Grab teach too: what fits glows on his turn before any miss — and in a later game it does not", async () => {
  for (const seen of [false, true]) {
    // 🁢 the tiles in his hand that match an open end
    await page.evaluate((s) => window.__BOARD.reset({ introSeen: s }), seen);
    await startGame("dominoes", "river", true, 11, 0);
    await page.waitForFunction(() => window.__BOARD.state().phase === "lay" && window.__BOARD.state().turn === 0 && !window.__BOARD.busy(), null, { timeout: 5000 });
    const d = await page.evaluate(() => {
      const st = window.__BOARD.state();
      return {
        misses: st.misses || 0,
        fits: st.hands[st.turn].filter((x) => window.BoardLogic.domSides(st, x).length).sort(),
        glow: [...document.querySelectorAll("button.bn-domt.bn-domt--hint")].map((b) => b.dataset.id).sort(),
        tiles: document.querySelectorAll("button.bn-domt").length,
      };
    });
    assert.equal(d.misses, 0, "fixture: no miss yet");
    assert.ok(d.fits.length && d.fits.length < d.tiles, `fixture: some of his tiles fit and some do not (${d.fits} of ${d.tiles})`);
    if (!seen) assert.deepEqual(d.glow, d.fits, "his first Dot Dominoes: exactly the tiles that match an end glow");
    else assert.deepEqual(d.glow, [], "a later Dot Dominoes: nothing glows before two misses");
    // 🌰 the pot whose last acorn lands in his own nest (a ⭐ and a go-again)
    await page.evaluate((s) => window.__BOARD.reset({ introSeen: s }), seen);
    await startGame("acorns", "river", true, 11, 0);
    await page.waitForFunction(() => window.__BOARD.state().phase === "choose" && window.__BOARD.state().turn === 0 && !window.__BOARD.busy(), null, { timeout: 5000 });
    const a = await page.evaluate(() => ({
      again: window.BoardLogic.acornAgains(window.__BOARD.state()).sort(),
      yes: [...document.querySelectorAll("button.bn-pot.bn-pot--yes")].map((b) => Number(b.dataset.k)).sort(),
      pots: document.querySelectorAll("button.bn-pot").length,
    }));
    assert.ok(a.again.length && a.again.length < a.pots, `fixture: a pot reaches his nest and another does not (${a.again} of ${a.pots})`);
    if (!seen) assert.deepEqual(a.yes, a.again, "his first Acorn Pots: exactly the pots that reach his nest glow");
    else assert.deepEqual(a.yes, [], "a later Acorn Pots: no pot glows — counting is the skill");
    // 🍪 the take that leaves his friend a multiple of four
    await page.evaluate((s) => window.__BOARD.reset({ introSeen: s }), seen);
    await startGame("cookies", "river", true, 3, 0);
    await page.waitForFunction(() => window.__BOARD.state().phase === "take" && window.__BOARD.state().turn === 0 && !window.__BOARD.busy(), null, { timeout: 5000 });
    const c = await page.evaluate(() => ({
      best: window.BoardLogic.nimBest(window.__BOARD.state()),
      hint: [...document.querySelectorAll("button.bn-takeb.bn-takeb--hint")].map((b) => Number(b.dataset.n)),
    }));
    assert.ok(c.best >= 1, "fixture: a take leaves four");
    if (!seen) assert.deepEqual(c.hint, [c.best], "his first Cookie Jar: the take that leaves four glows");
    else assert.deepEqual(c.hint, [], "a later Cookie Jar: nothing glows — planning is the skill");
    // 🔴 the column that makes his line (a board where his two counters on
    // the bottom row leave column 2 to finish it)
    await page.evaluate((s) => window.__BOARD.reset({ introSeen: s }), seen);
    await page.evaluate(() => window.__BOARD.load("lineup", (() => {
      const g = window.BoardLogic.create({ board: "lineup", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed: 3, first: 0 });
      for (const c of [0, 0, 1, 1]) window.BoardLogic.dropLine(g, c);
      return g;
    })()));
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    await page.waitForFunction(() => window.__BOARD.state().phase === "drop" && window.__BOARD.state().turn === 0 && !window.__BOARD.busy(), null, { timeout: 5000 });
    const ln = await page.evaluate(() => ({
      best: window.BoardLogic.linesBest(window.__BOARD.state()),
      hint: [...document.querySelectorAll("button.bn-col.bn-col--hint")].map((b) => Number(b.dataset.c)),
    }));
    assert.deepEqual(ln.best, [2], "fixture: column 2 finishes his bottom row");
    if (!seen) assert.deepEqual(ln.hint, [2], "his first Line Up: the column that makes his line glows");
    else assert.deepEqual(ln.hint, [], "a later Line Up: nothing glows — looking is the skill");
    // 🃏 the saving card: the smallest that is bigger than the lead (the
    // computer leads, so he answers)
    await page.evaluate((s) => window.__BOARD.reset({ introSeen: s }), seen);
    await startGame("topcard", "river", true, 3, 1);
    await page.waitForFunction(() => window.__BOARD.state().phase === "follow" && window.__BOARD.state().turn === 0 && !window.__BOARD.busy(), null, { timeout: 8000 });
    const tc = await page.evaluate(() => ({
      best: window.BoardLogic.topBest(window.__BOARD.state()),
      hint: [...document.querySelectorAll("button.bn-tc.bn-tc--hint")].map((b) => Number(b.dataset.v)),
    }));
    if (!seen) assert.deepEqual(tc.hint, [tc.best], "his first Top Card: the saving card glows");
    else assert.deepEqual(tc.hint, [], "a later Top Card: nothing glows — saving is the skill");
    // 🎨 the colour that grabs the most
    await page.evaluate((s) => window.__BOARD.reset({ introSeen: s }), seen);
    await startGame("grab", "river", true, 3, 0);
    await page.waitForFunction(() => window.__BOARD.state().phase === "pick" && window.__BOARD.state().turn === 0 && !window.__BOARD.busy(), null, { timeout: 5000 });
    const gb = await page.evaluate(() => ({
      best: window.BoardLogic.grabBest(window.__BOARD.state()).slice().sort(),
      hint: [...document.querySelectorAll("button.bn-swatch.bn-swatch--hint")].map((b) => b.dataset.c).sort(),
    }));
    assert.ok(gb.best.length && gb.best.length < 3, `fixture: some colour grabs more than another (${gb.best})`);
    if (!seen) assert.deepEqual(gb.hint, gb.best, "his first Colour Grab: the colour that grabs the most glows");
    else assert.deepEqual(gb.hint, [], "a later Colour Grab: nothing glows — looking is the skill");
    // 🐭 the arrow that takes his mouse nearest the cheese
    await page.evaluate((s) => window.__BOARD.reset({ introSeen: s }), seen);
    await startGame("maze", "river", true, 1, 0);
    await page.waitForFunction(() => window.__BOARD.state().phase === "move" && window.__BOARD.state().turn === 0 && !window.__BOARD.busy(), null, { timeout: 5000 });
    const mz = await page.evaluate(() => ({
      best: window.BoardLogic.mazeBest(window.__BOARD.state()).slice().sort(),
      moves: document.querySelectorAll(".bn-maze__hand button.bn-arrow").length,
      hint: [...document.querySelectorAll("button.bn-arrow.bn-arrow--hint")].map((b) => Number(b.dataset.k)).sort(),
    }));
    assert.ok(mz.best.length && mz.best.length < mz.moves, `fixture: one arrow is better than another (${mz.best} of ${mz.moves})`);
    if (!seen) assert.deepEqual(mz.hint, mz.best, "his first Mouse Maze: the nearest arrow glows");
    else assert.deepEqual(mz.hint, [], "a later Mouse Maze: nothing glows — finding the way is the skill");
    // 🎯 the dice that match, once rolled
    await page.evaluate((s) => window.__BOARD.reset({ introSeen: s }), seen);
    await startGame("dicematch", "river", true, 3, 0);
    await page.locator(".bn-m3__roll button.bn-m3roll").click();
    await page.waitForFunction(() => window.__BOARD.state().phase === "keep" && !window.__BOARD.busy(), null, { timeout: 5000 });
    const dm = await page.evaluate(() => ({
      keep: window.BoardLogic.m3Keep(window.__BOARD.state().dice),
      hint: [...document.querySelectorAll(".bn-m3__dice .bn-m3d")].map((b) => b.classList.contains("bn-m3d--hint")),
    }));
    assert.ok(dm.keep.some(Boolean) && !dm.keep.every(Boolean), `fixture: a pair to keep (${dm.keep})`);
    if (!seen) assert.deepEqual(dm.hint, dm.keep, "his first Dice Match: the dice that match glow");
    else assert.deepEqual(dm.hint, [false, false, false], "a later Dice Match: nothing glows — matching is the skill");
    // 🕵️ the question that puts the most friends down
    await page.evaluate((s) => window.__BOARD.reset({ introSeen: s }), seen);
    let hs = 1;
    for (; hs < 60; hs++) if (await page.evaluate((sd) => { const st = window.BoardLogic.create({ board: "hide", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed: sd, first: 0 }); return window.BoardLogic.hideBest(st).length < 3; }, hs)) break;
    await startGame("hide", "river", true, hs, 0);
    await page.waitForFunction(() => window.__BOARD.state().phase === "ask" && window.__BOARD.state().turn === 0 && !window.__BOARD.busy(), null, { timeout: 5000 });
    const hd = await page.evaluate(() => ({
      best: window.BoardLogic.hideBest(window.__BOARD.state()).slice().sort(),
      hint: [...document.querySelectorAll("button.bn-ask.bn-ask--hint")].map((b) => Number(b.dataset.k)).sort(),
    }));
    assert.ok(hd.best.length && hd.best.length < 3, `fixture: one question is better than another (${hd.best})`);
    if (!seen) assert.deepEqual(hd.hint, hd.best, "his first Who's Hiding: the best question glows");
    else assert.deepEqual(hd.hint, [], "a later Who's Hiding: nothing glows — asking well is the skill");
    // 🌈 the cards that match the top card (find a seed where some do and some do not)
    await page.evaluate((s) => window.__BOARD.reset({ introSeen: s }), seen);
    let cmSeed = 1;
    for (; cmSeed < 60; cmSeed++) {
      const ok = await page.evaluate((sd) => { const st = window.BoardLogic.create({ board: "colourmatch", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed: sd, first: 0 }); const n = window.BoardLogic.cmPlayable(st).length; return n > 0 && n < st.hands[0].length; }, cmSeed);
      if (ok) break;
    }
    await startGame("colourmatch", "river", true, cmSeed, 0);
    await page.waitForFunction(() => window.__BOARD.state().phase === "play" && window.__BOARD.state().turn === 0 && !window.__BOARD.busy(), null, { timeout: 5000 });
    const cm = await page.evaluate(() => ({
      fits: window.BoardLogic.cmPlayable(window.__BOARD.state()),
      hint: [...document.querySelectorAll("button.bn-cmc.bn-cmc--hint")].map((b) => Number(b.dataset.k)).sort(),
    }));
    if (!seen) assert.deepEqual(cm.hint, cm.fits, "his first Colour Match: the cards that match glow");
    else assert.deepEqual(cm.hint, [], "a later Colour Match: nothing glows — seeing the match is the skill");
    // 🔢 the rolled number on his card (roll until it is on his card)
    await page.evaluate((s) => window.__BOARD.reset({ introSeen: s }), seen);
    await startGame("bingo", "river", true, 3, 0);
    for (let g = 0; g < 12; g++) {
      await page.waitForFunction(() => { const st = window.__BOARD.state(); return (st.phase === "roll" || st.phase === "cover") && st.turn === 0 && !window.__BOARD.busy(); }, null, { timeout: 8000 });
      if ((await page.evaluate(() => window.__BOARD.state().phase)) === "cover") break;
      await page.locator(".bn-pad--0").click();
      await page.waitForFunction(() => !window.__BOARD.busy(), null, { timeout: 5000 });
    }
    const bg = await page.evaluate(() => ({
      phase: window.__BOARD.state().phase,
      spots: window.BoardLogic.bingoSpots(window.__BOARD.state()).slice().sort(),
      hint: [...document.querySelectorAll("button.bn-bsq.bn-bsq--hint")].map((b) => Number(b.dataset.k)).sort(),
    }));
    assert.equal(bg.phase, "cover", "fixture: his number came up");
    if (!seen) assert.deepEqual(bg.hint, bg.spots, "his first Number Bingo: the rolled number glows on his card");
    else assert.deepEqual(bg.hint, [], "a later Number Bingo: nothing glows — knowing the number is the skill");
    // 🍯 the tens in the meadow
    await page.evaluate((s) => window.__BOARD.reset({ introSeen: s }), seen);
    await startGame("honeyten", "river", true, 3, 0);
    await page.waitForFunction(() => window.__BOARD.state().phase === "pick" && window.__BOARD.state().turn === 0 && !window.__BOARD.busy(), null, { timeout: 5000 });
    const tn = await page.evaluate(() => ({
      tens: [...new Set([].concat(...window.BoardLogic.tenPairs(window.__BOARD.state())))].sort(),
      hint: [...document.querySelectorAll("button.bn-flower.bn-flower--hint")].map((b) => Number(b.dataset.k)).sort(),
    }));
    if (!seen) assert.deepEqual(tn.hint, tn.tens, "his first Honey Ten: the flowers that make a ten glow");
    else assert.deepEqual(tn.hint, [], "a later Honey Ten: nothing glows — knowing ten is the skill");
    // 🐟 the pictures both hands hold
    await page.evaluate((s) => window.__BOARD.reset({ introSeen: s }), seen);
    let fs = 1;
    for (; fs < 60; fs++) if (await page.evaluate((sd) => window.BoardLogic.fishBest(window.BoardLogic.create({ board: "gofish", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed: sd, first: 0 })).length, fs)) break;
    await startGame("gofish", "river", true, fs, 0);
    await page.waitForFunction(() => window.__BOARD.state().phase === "ask" && window.__BOARD.state().turn === 0 && !window.__BOARD.busy(), null, { timeout: 5000 });
    const fb = await page.evaluate(() => ({
      best: window.BoardLogic.fishBest(window.__BOARD.state()).slice().sort(),
      hint: [...document.querySelectorAll(".bn-fish__hand button.bn-fishc.bn-fishc--hint")].map((b) => Number(b.dataset.k)).sort(),
    }));
    if (!seen) assert.deepEqual(fb.hint, fb.best, "his first Go Fish: the pictures you both hold glow");
    else assert.deepEqual(fb.hint, [], "a later Go Fish: nothing glows — spotting the pair is the skill");
    // 🔼 the better guess
    await page.evaluate((s) => window.__BOARD.reset({ introSeen: s }), seen);
    await startGame("hilo", "river", true, 3, 0);
    await page.waitForFunction(() => window.__BOARD.state().phase === "guess" && window.__BOARD.state().turn === 0 && !window.__BOARD.busy(), null, { timeout: 5000 });
    const hl = await page.evaluate(() => ({
      best: window.BoardLogic.hiloBest(window.__BOARD.state()) ? "1" : "0",
      hint: [...document.querySelectorAll("button.bn-hlg.bn-hlg--hint")].map((b) => b.dataset.up),
    }));
    if (!seen) assert.deepEqual(hl.hint, [hl.best], "his first Higher or Lower: the better guess glows");
    else assert.deepEqual(hl.hint, [], "a later Higher or Lower: nothing glows — guessing well is the skill");
    // 🚂 the car that keeps the pattern
    await page.evaluate((s) => window.__BOARD.reset({ introSeen: s }), seen);
    await startGame("train", "river", true, 3, 0);
    await page.waitForFunction(() => window.__BOARD.state().phase === "pick" && window.__BOARD.state().turn === 0 && !window.__BOARD.busy(), null, { timeout: 5000 });
    const tr = await page.evaluate(() => ({
      best: [window.__BOARD.state().options.indexOf(window.__BOARD.state().answer)],
      hint: [...document.querySelectorAll("button.bn-carb.bn-carb--hint")].map((b) => Number(b.dataset.k)),
    }));
    if (!seen) assert.deepEqual(tr.hint, tr.best, "his first Pattern Train: the car that comes next glows");
    else assert.deepEqual(tr.hint, [], "a later Pattern Train: nothing glows — seeing the pattern is the skill");
  }
});

test("🌰 a whole Acorn Pots against the computer: his three pots are the buttons, the acorns drop in one by one counting (sound off), a last acorn in his nest glows and is a ⭐ (go again), an empty pot does nothing, every acorn ends in a nest, one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  try {
  await startGame("acorns", "river", true, 3, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "no tokens: the acorns are the pieces");
  const dom = () => page.evaluate(() => [...document.querySelectorAll(".bn-acorns > *")].map((b) => ({
    nest: b.classList.contains("bn-nest"), button: b.tagName === "BUTTON", k: b.dataset.k == null ? null : Number(b.dataset.k),
    n: Number((b.querySelector(".bn-pot__n, .bn-nest__n") || {}).textContent.replace(/\D/g, "")), yes: b.classList.contains("bn-pot--yes"),
    pop: (b.querySelector(".bn-pot__pop") || {}).textContent || "", w: b.offsetWidth, h: b.offsetHeight })));
  const d0 = await dom();
  assert.equal(d0.length, 8, "six pots and two nests");
  assert.equal(d0.filter((d) => d.nest).length, 2, "two nests");
  const mine = d0.filter((d) => d.button);
  assert.deepEqual(mine.map((d) => d.k).sort(), [0, 1, 2], "his three pots are the buttons (his friend's are not)");
  assert.ok(mine.every((d) => d.w >= 75 && d.h >= 75), `his pots are big (${mine.map((d) => d.w + "x" + d.h)})`);
  assert.ok(d0.filter((d) => !d.nest).every((d) => d.n === 3) && d0.filter((d) => d.nest).every((d) => d.n === 0), "three acorns in every pot, the nests empty");
  // at the real pace: pot 0 is three from his nest, so its three acorns drop
  // in counting 1, 2, 3, the last in his nest — which glows: a ⭐, go again
  const pops = [];
  await page.locator('.bn-acorns button.bn-pot[data-k="0"]').click();
  let glowed = false;
  for (let i = 0; i < 40; i++) {
    const d = await dom();
    for (const x of d) if (x.pop && pops[pops.length - 1] !== x.pop) pops.push(x.pop);
    if (d.find((x) => x.k == null && x.nest && x.yes)) glowed = true;
    if (glowed && pops.length >= 3) break;
    await page.waitForTimeout(80);
  }
  assert.deepEqual(pops.slice(0, 3), ["1", "2", "3"], "each acorn drops in with its count showing");
  assert.ok(glowed, "his nest glows when the last acorn lands in it");
  await untilTap(0);
  let s = await st();
  assert.equal(s.turn, 0, "the last acorn in his nest: he goes again");
  assert.equal(s.seats[0].stars, 1, "and that is a ⭐");
  assert.equal(await page.locator(".bn-pad--0 .bn-pad__stars").textContent(), "⭐ 1", "his ⭐ lands on his pad");
  // an empty pot is no button: tapping it does nothing
  await page.locator(".bn-acorns .bn-pot--0").first().click({ force: true });
  assert.deepEqual((await st()).pots, s.pots, "his empty pot does nothing");
  await quick();
  let cpuTried = false, againSeen = 1;
  for (let guard = 0; guard < 80; guard++) {
    const x = await st();
    if (x.phase !== "done" && x.turn === 1 && !cpuTried) {
      cpuTried = true;
      await page.locator(".bn-acorns .bn-pot--1").first().click({ force: true }).catch(() => {});
      assert.equal((await st()).rolls, x.rolls, "his tap on the computer's pots does nothing");
    }
    await untilTap(0);
    s = await st();
    if (s.phase === "done") break;
    const again = await page.evaluate(() => window.BoardLogic.acornAgains(window.__BOARD.state()));
    const k = again.length ? again[again.length - 1] : [0, 1, 2].find((j) => s.pots[j] > 0);
    const before = s.seats[0].stars;
    await page.locator('.bn-acorns button.bn-pot[data-k="' + k + '"]').click();
    // (the engine sows the whole pot the moment he taps)
    if (again.length) { againSeen += 1; assert.equal((await st()).seats[0].stars, before + 1, "a go-again pot is a ⭐"); }
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.equal(end.pots[3] + end.pots[7], 18, "every acorn is in a nest");
  assert.ok(cpuTried && againSeen >= 2, `fixture: the computer's turn and two go-agains ran (${againSeen})`);
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.acorns, 1, "a finished Acorn Pots counts once");
  } finally { await slow(); }
});

test("🁢 a whole Dot Dominoes against the computer: his four tiles are big buttons, a tile goes on the end it matches, one that fits both ends waits for him to tap an end, one that matches nothing only wiggles, nothing matches means fishing from the pile on his pad, every tile that can be laid is laid, one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("dominoes", "river", true, 3, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "no tokens: the tiles are the pieces");
  const dom = () => page.evaluate(() => ({
    hand: [...document.querySelectorAll(".bn-dom__hand .bn-domt")].map((b) => ({ id: b.dataset.id || null, button: b.tagName === "BUTTON", held: b.classList.contains("bn-domt--held"), w: b.offsetWidth, h: b.offsetHeight })),
    ends: [...document.querySelectorAll(".bn-dom__end")].map((b) => ({ side: b.dataset.side, button: b.tagName === "BUTTON", w: b.offsetWidth })),
    line: document.querySelectorAll(".bn-dom__line .bn-dom__bit").length,
  }));
  const d0 = await dom();
  assert.equal(d0.hand.length, 4, "his four tiles");
  assert.ok(d0.hand.every((t) => t.button && t.w >= 75 && t.h >= 75), `four big tiles (${d0.hand.map((t) => t.w + "x" + t.h)})`);
  assert.deepEqual(d0.ends.map((e) => e.side), ["left", "right"], "the line's two ends");
  assert.ok(d0.ends.every((e) => !e.button && e.w >= 75), "the ends are big, and not buttons until a tile waits for one");
  assert.equal(d0.line, 1, "one tile starts the line");
  let fished = 0, held = 0, missed = 0;
  for (let guard = 0; guard < 120; guard++) {
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    if (s.phase === "draw") {
      // nothing matches: his pad fishes from the pile
      await page.locator(".bn-pad--0").click();
      fished++;
      await page.waitForFunction(() => !window.__BOARD.busy(), null, { timeout: 20000 }).catch(() => {});
      continue;
    }
    const fits = await page.evaluate(() => { const x = window.__BOARD.state(); return x.hands[0].map((id) => [id, window.BoardLogic.domSides(x, id).length, window.BoardLogic.domChoosy(x, id)]); });
    const wrong = fits.find((f) => !f[1]);
    if (wrong && !missed) {
      await page.locator('.bn-dom__hand button.bn-domt[data-id="' + wrong[0] + '"]').click();
      missed++;
      const after = await st();
      assert.equal(after.line.length, s.line.length, "a tile that matches no end is not laid");
      assert.equal(after.misses, 1, "only a kind miss");
    }
    const pick = fits.find((f) => f[1]);
    await page.locator('.bn-dom__hand button.bn-domt[data-id="' + pick[0] + '"]').click();
    if (pick[2]) {
      // it fits both ends: it waits (a gold ring) and both ends light up
      held++;
      const d = await dom();
      assert.ok(d.hand.find((t) => t.id === pick[0]).held, "the tile waits, ringed");
      assert.deepEqual(d.ends.filter((e) => e.button).map((e) => e.side), ["left", "right"], "both ends are buttons now");
      await page.locator('.bn-dom__hand button.bn-domt[data-id="' + pick[0] + '"]').click();
      assert.equal((await st()).held, pick[0], "the held tile again (the echo) changes nothing");
      const was = (await st()).ends;
      await page.locator('button.bn-dom__end[data-side="left"]').click();
      const after = await st();
      assert.equal(after.line[0][1], was[0], "it goes on the end he tapped");
    }
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.ok(fished >= 1 && held >= 1 && missed >= 1, `fixture: fishing, a held tile and a miss all ran (${fished}, ${held}, ${missed})`);
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.dominoes, 1, "a finished Dot Dominoes counts once");
  } finally { await slow(); }
});

test("🏴‍☠️ a whole Treasure Dig against the computer: nine big sand squares, a dug one shows the arrow toward the treasure (sound off), a dug square is no button, the computer's turn cannot be dug, four treasures and one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("dig", "river", true, 7, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "no tokens: the sand is the board");
  const dom = () => page.evaluate(() => [...document.querySelectorAll(".bn-dig .bn-sand")].map((b) => ({ k: b.dataset.k == null ? null : Number(b.dataset.k), button: b.tagName === "BUTTON", dug: b.classList.contains("bn-sand--dug"), gem: b.classList.contains("bn-sand--gem"), pic: (b.querySelector(".bn-sand__pic") || {}).textContent || "", w: b.offsetWidth, h: b.offsetHeight })));
  const d0 = await dom();
  assert.equal(d0.length, 9, "nine squares");
  assert.ok(d0.every((d) => d.button && d.w >= 75 && d.h >= 75), `nine big sand squares to dig (${d0.map((d) => d.w)})`);
  const ARROW = { "up-left": "↖️", up: "⬆️", "up-right": "↗️", left: "⬅️", right: "➡️", "down-left": "↙️", down: "⬇️", "down-right": "↘️" };
  let arrows = 0, cpuTried = false, gems = 0;
  for (let guard = 0; guard < 80; guard++) {
    const x = await st();
    if (x.phase !== "done" && x.turn === 1 && !cpuTried) {
      cpuTried = true;
      assert.equal(await page.locator(".bn-dig button.bn-sand").count(), 0, "on the computer's turn the sand is not his to dig");
    }
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    // he reads the arrows: a square every arrow still points to
    const k = await page.evaluate(() => window.BoardLogic.digMaybe(window.__BOARD.state())[0]);
    const findIt = k === s.spot;
    await page.locator('.bn-dig button.bn-sand[data-k="' + k + '"]').click();
    if (findIt) { gems++; continue; }
    // (the hole is painted a moment after the engine digs it)
    await page.waitForFunction((j) => { const e = document.querySelectorAll(".bn-dig .bn-sand")[j]; return e && e.classList.contains("bn-sand--dug"); }, k, { timeout: 5000 });
    const d = (await dom())[k];
    const want = ARROW[await page.evaluate((a) => window.BoardLogic.digDir(window.BoardData.board("dig"), a[0], a[1]), [k, s.spot])];
    assert.ok(d.dug && !d.button && d.pic === want, `the dug square shows the arrow toward the treasure (${d.pic} for ${want})`);
    arrows++;
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.equal(end.found, 4, "four treasures");
  assert.ok(arrows >= 1 && gems >= 1 && cpuTried, `fixture: arrows, a find and the computer's turn all ran (${arrows}, ${gems})`);
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.dig, 1, "a finished Treasure Dig counts once");
  } finally { await slow(); }
});

test("🐭 a whole Mouse Maze against the computer: the garden shows the engine's pots, cheese and both mice; three big arrow cards (a blocked one is no button); his arrow moves HIS mouse that many steps; a doubled tap moves once; the computer's cards are not his; five cheeses and one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("maze", "river", true, 3, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "no tokens: the garden is the board");
  const dom = () => page.evaluate(() => {
    const sq = [...document.querySelectorAll(".bn-maze__grid .bn-maze__sq")];
    return {
      squares: sq.length,
      pots: sq.map((q, k) => (q.querySelector(".bn-maze__pot") ? k : -1)).filter((k) => k >= 0),
      cheese: sq.findIndex((q) => q.querySelector(".bn-maze__cheese:not(.bn-maze__cheese--eaten)")),
      mice: [0, 1].map((i) => sq.findIndex((q) => q.querySelector(".bn-mouse--" + i))),
      cards: [...document.querySelectorAll(".bn-maze__hand .bn-arrow")].map((c) => { const r = c.getBoundingClientRect(); return { k: Number(c.dataset.k), button: c.tagName === "BUTTON", l: r.left, r: r.right, w: r.width, h: r.height }; }),
    };
  });
  const d0 = await dom(), s0 = await st();
  assert.equal(d0.squares, 20, "a 4 by 5 garden");
  assert.deepEqual(d0.pots, s0.pots, "the pots are the engine's");
  assert.equal(d0.cheese, s0.cheese, "…and the cheese");
  assert.deepEqual(d0.mice, s0.mice, "…and a mouse each");
  assert.equal(d0.cards.length, 3, "three arrow cards");
  assert.ok(d0.cards.every((c) => c.w >= 75 && c.h >= 75), `big cards (${d0.cards.map((c) => Math.round(c.w) + "x" + Math.round(c.h))})`);
  assert.ok(d0.cards[1].l - d0.cards[0].r >= 16 && d0.cards[2].l - d0.cards[1].r >= 16, "16px apart");
  const goes = await page.evaluate(() => { const st = window.__BOARD.state(); return st.hands[0].map((id) => window.BoardLogic.mazePath(st, id, st.mice[0]).length > 0); });
  assert.deepEqual(d0.cards.map((c) => c.button), goes, "an arrow that cannot move his mouse is no button");
  // a doubled tap is ONE move (the hammer's echo)
  const k0 = await page.evaluate(() => window.BoardLogic.mazeBest(window.__BOARD.state())[0]);
  const path0 = await page.evaluate((k) => { const st = window.__BOARD.state(); return window.BoardLogic.mazePath(st, st.hands[0][k], st.mice[0]); }, k0);
  await page.locator('.bn-maze__hand button.bn-arrow[data-k="' + k0 + '"]').dblclick();
  await page.waitForFunction(() => window.__BOARD.state().turn === 1 || window.__BOARD.state().phase === "done", null, { timeout: 5000 });
  assert.equal((await st()).mice[0], path0[path0.length - 1], "one move, along the arrow");
  let cpuTried = false, cheese = 0;
  for (let guard = 0; guard < 80; guard++) {
    const x = await st();
    if (x.phase !== "done" && x.turn === 1 && !cpuTried) {
      cpuTried = true;
      assert.equal(await page.locator(".bn-maze__hand button.bn-arrow").count(), 0, "on the computer's turn the cards are not his");
    }
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    const d = await dom();
    assert.deepEqual(d.mice, s.mice, "the mice stand where the engine says");
    assert.equal(d.cheese, s.cheese, "the cheese is where the engine says");
    const k = await page.evaluate(() => window.BoardLogic.mazeBest(window.__BOARD.state())[0]);
    const path = await page.evaluate((kk) => { const st = window.__BOARD.state(); return window.BoardLogic.mazePath(st, st.hands[0][kk], st.mice[0]); }, k);
    if (path[path.length - 1] === s.cheese) cheese++;
    await page.locator('.bn-maze__hand button.bn-arrow[data-k="' + k + '"]').click();
    await page.waitForFunction((m) => window.__BOARD.state().mice[0] === m, path[path.length - 1], { timeout: 5000 });
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.equal(end.seats[0].stars + end.seats[1].stars, 5, "five cheeses, five stars");
  assert.ok(cpuTried && cheese >= 1, `fixture: the computer's turn and his cheese both ran (${cheese})`);
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.maze, 1, "a finished Mouse Maze counts once");
  } finally { await slow(); }
});

test("🚂 a whole Pattern Train against the computer: the engine and five cars in the engine's pattern, then a ?; three big cars at the station; a car that breaks the pattern wiggles and the turn passes with the same train; the right car joins the train (a ⭐); a doubled tap picks once; the computer's cars are not his; eight trains and one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("train", "river", true, 3, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "no tokens: the train is the board");
  const dom = () => page.evaluate(() => ({
    cars: [...document.querySelectorAll(".bn-train__row .bn-car:not(.bn-car--engine):not(.bn-car--q)")].length,
    q: !!document.querySelector(".bn-train__row .bn-car--q"),
    pick: [...document.querySelectorAll(".bn-train__pick .bn-carb")].map((b) => { const r = b.getBoundingClientRect(); return { k: b.dataset.k == null ? null : Number(b.dataset.k), button: b.tagName === "BUTTON", w: r.width, h: r.height, l: r.left, r: r.right }; }),
  }));
  const s0 = await st(), d0 = await dom();
  assert.equal(d0.cars, 5, "five cars");
  assert.ok(d0.q, "…and the one missing");
  assert.equal(d0.pick.length, 3, "three cars at the station");
  assert.ok(d0.pick.every((b) => b.button && b.w >= 75 && b.h >= 75), `big cars (${d0.pick.map((b) => Math.round(b.w))})`);
  assert.ok(d0.pick[1].l - d0.pick[0].r >= 16, "16px apart");
  // a car that breaks the pattern: the turn passes, the train stays
  const wrong = s0.options.findIndex((c) => c !== s0.answer);
  await page.locator('.bn-train__pick button.bn-carb[data-k="' + wrong + '"]').click();
  await page.waitForFunction(() => window.__BOARD.state().turn === 1, null, { timeout: 5000 });
  assert.deepEqual((await st()).cars, s0.cars, "the same train waits");
  assert.equal((await st()).round, 0, "no train finished");
  let doubled = false, cpuTried = false;
  for (let guard = 0; guard < 60; guard++) {
    const x = await st();
    if (x.phase !== "done" && x.turn === 1 && !cpuTried) {
      cpuTried = true;
      assert.equal(await page.locator(".bn-train__pick button.bn-carb").count(), 0, "on the computer's turn the cars are not his");
    }
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    const k = s.options.indexOf(s.answer);
    if (!doubled) { doubled = true; await page.locator('.bn-train__pick button.bn-carb[data-k="' + k + '"]').dblclick(); }
    else await page.locator('.bn-train__pick button.bn-carb[data-k="' + k + '"]').click();
    await page.waitForFunction((r) => window.__BOARD.state().round > r, s.round, { timeout: 5000 });
    assert.equal((await st()).round, s.round + 1, "one train, even for a doubled tap");
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.equal(end.seats[0].stars + end.seats[1].stars, 8, "eight trains, eight stars");
  assert.ok(cpuTried, "fixture: the computer's turn ran");
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.train, 1, "a finished Pattern Train counts once");
  } finally { await slow(); }
});

test("🚃 a whole Long Train (§18 D, Pattern Train's level two): the engine and SEVEN cars, then a ?; the whole train fits the field on a 320px phone and on an iPad; the right car is a ⭐; eight trains and one party, counted as a Long Train", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  const size = page.viewportSize();
  try {
    await startGame("train2", "river", true, 3, 0);
    const row = () => page.evaluate(() => {
      const r = document.querySelector(".bn-train__row"), f = document.querySelector(".bn-board").getBoundingClientRect();
      const cars = [...r.querySelectorAll(".bn-car")].map((c) => c.getBoundingClientRect());
      return { cars: r.querySelectorAll(".bn-car:not(.bn-car--engine):not(.bn-car--q)").length, q: !!r.querySelector(".bn-car--q"), left: Math.min(...cars.map((c) => c.left)), right: Math.max(...cars.map((c) => c.right)), fl: f.left, fr: f.right, w: Math.min(...cars.map((c) => c.width)), page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    const r0 = await row();
    assert.equal(r0.cars, 7, "seven cars");
    assert.ok(r0.q, "…and the one missing");
    for (const [w, h] of [[320, 568], [834, 1112]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(150);
      const r = await row();
      assert.ok(r.left >= r.fl - 1 && r.right <= r.fr + 1, `at ${w}x${h} the whole train is on the field (${Math.round(r.left)}..${Math.round(r.right)} in ${Math.round(r.fl)}..${Math.round(r.fr)})`);
      assert.ok(r.w >= 26, `at ${w}x${h} a car is still a picture you can see (${Math.round(r.w)}px)`);
      assert.ok(r.page <= 0, `at ${w}x${h} the page does not scroll sideways`);
    }
    await page.setViewportSize(size);
    for (let guard = 0; guard < 60; guard++) {
      await untilTap(0);
      const s = await st();
      if (s.phase === "done") break;
      await page.locator('.bn-train__pick button.bn-carb[data-k="' + s.options.indexOf(s.answer) + '"]').click();
      await page.waitForFunction((r) => window.__BOARD.state().round > r || window.__BOARD.state().phase === "done", s.round, { timeout: 5000 });
    }
    const end = await st();
    assert.equal(end.phase, "done", "the game ends");
    assert.equal(end.seats[0].stars + end.seats[1].stars, 8, "eight trains, eight stars");
    await page.locator(".bn-party").waitFor({ state: "visible" });
    const done = (await page.evaluate(() => window.__BOARD.save())).done;
    assert.equal(done.train2, 1, "a finished Long Train counts as a Long Train");
    assert.ok(!done.train, "…and not as a Pattern Train");
  } finally { await page.setViewportSize(size); await slow(); }
});

test("🪜 a whole Dice Run (§18 D, Dice Match's level two): his first game lights the BEST keep for the rolls left (worked out, so half a run can glow), a run scores two ⭐s and glows whole, and the game counts as a Dice Run", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: false }));
  await quick();
  try {
    await startGame("dicerun", "river", true, 3, 0);
    let checked = 0, ran = false;
    for (let guard = 0; guard < 80; guard++) {
      await untilTap(0);
      const s = await st();
      if (s.phase === "done") break;
      if (s.phase === "keep") {
        const g = await page.evaluate(() => ({
          want: window.BoardLogic.m3Keep(window.__BOARD.state().dice, true, window.__BOARD.state().left),
          hint: [...document.querySelectorAll(".bn-m3__dice .bn-m3d")].map((d) => d.classList.contains("bn-m3d--hint")),
        }));
        // (a die already kept wears its ring instead of the glow)
        assert.deepEqual(g.hint, g.want.map((x, k) => x && !s.held[k]), "his first Dice Run: the best keep glows");
        checked++;
        for (let k = 0; k < 3; k++) if (g.want[k] !== s.held[k]) await page.locator('.bn-m3__dice button.bn-m3d[data-k="' + k + '"]').click();
      }
      // (a re-roll does not count as a roll of the turn: wait for the dice,
      // the rolls left, the phase or the turn to move)
      const was = JSON.stringify([s.dice, s.left, s.phase, s.turn, s.rolls]);
      await page.locator(".bn-m3__roll button.bn-m3roll").click();
      await page.waitForFunction((w) => { const x = window.__BOARD.state(); return JSON.stringify([x.dice, x.left, x.phase, x.turn, x.rolls]) !== w; }, was, { timeout: 8000 });
      if (!ran) ran = await page.evaluate(() => { const v = window.__BOARD.state(); return v.seats.some((x) => x.stars >= 2); });
    }
    assert.ok(checked >= 3, "fixture: he chose what to keep (" + checked + ")");
    assert.equal((await st()).phase, "done", "the game ends");
    await page.locator(".bn-party").waitFor({ state: "visible" });
    const done = (await page.evaluate(() => window.__BOARD.save())).done;
    assert.equal(done.dicerun, 1, "a finished Dice Run counts as a Dice Run");
    assert.equal((await page.evaluate(() => window.__BOARD.save())).intro.dicerun, true, "his first Dice Run taught it: the next one does not glow");
    assert.ok(!done.dicematch, "…and not as a Dice Match");
    // the keep that only Dice Run can teach: two in a row and no pair (Dice
    // Match would keep nothing) — half a run glows
    await page.evaluate(() => window.__BOARD.reset({ introSeen: false }));
    const half = await page.evaluate(() => {
      const L = window.BoardLogic;
      for (let seed = 1; seed < 600; seed++) {
        const g = L.create({ board: "dicerun", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed, first: 0 });
        L.rollMatch(g);
        const d = g.dice, keep = L.m3Keep(d, true, g.left);
        if (g.phase === "keep" && L.m3Score(d, true) === 0 && keep.filter(Boolean).length === 2) return window.__BOARD.load("dicerun", L.snapshot(g)) && keep;
      }
      return null;
    });
    assert.ok(half, "fixture: a roll with half a run and no pair");
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    await page.waitForFunction(() => !window.__BOARD.busy(), null, { timeout: 5000 });
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".bn-m3__dice .bn-m3d")].map((d) => d.classList.contains("bn-m3d--hint"))), half, "half a run glows");
    // a run glows WHOLE when it scores (the dice that made it)
    const glow = await page.evaluate(() => {
      const L = window.BoardLogic;
      for (let seed = 1; seed < 400; seed++) {
        const g = L.create({ board: "dicerun", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed, first: 0 });
        L.rollMatch(g);
        if (g.phase === "keep" && L.m3Score(g.dice, true) === 2) { g.held = [true, true, true]; return window.__BOARD.load("dicerun", L.snapshot(g)); }
      }
      return false;
    });
    assert.ok(glow, "fixture: a first roll that is a run");
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    await page.waitForFunction(() => !window.__BOARD.busy(), null, { timeout: 5000 });
    await page.waitForTimeout(400);
    await page.locator(".bn-m3__roll button.bn-m3roll").click();
    await page.waitForFunction(() => document.querySelectorAll(".bn-m3__dice .bn-m3d--win").length === 3, null, { timeout: 5000 }).catch(() => {});
    assert.equal(await page.locator(".bn-m3__dice .bn-m3d--win").count(), 3, "a run glows whole");
    assert.equal((await st()).seats[0].stars, 2, "a run is two stars");
  } finally { await slow(); }
});

test("🚪 a whole Doors to Nine (§18 D, Shut the Doors' level two): nine big doors three by three, 16px apart; two dice rolled and shown with the number they make; a roll past nine is made with two doors; two doors at once is a ⭐ and HE rolls again; every door shut and one party, counted as a Doors to Nine", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
    await startGame("doors9", "river", true, 3, 0);
    const doors = () => page.evaluate(() => [...document.querySelectorAll(".bn-doors__grid .bn-door")].map((d) => { const r = d.getBoundingClientRect(); return { n: Number(d.querySelector(".bn-door__n").textContent), button: d.tagName === "BUTTON", l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; }));
    const d0 = await doors();
    assert.deepEqual(d0.map((d) => d.n), [1, 2, 3, 4, 5, 6, 7, 8, 9], "nine doors, 1 to 9");
    assert.ok(d0.every((d) => d.w >= 75 && d.h >= 75), `big doors (${d0.map((d) => Math.round(d.w) + "x" + Math.round(d.h))})`);
    assert.equal(new Set(d0.map((d) => Math.round(d.t))).size, 3, "three rows");
    assert.ok(d0[1].l - d0[0].r >= 16 && d0[3].t - d0[0].b >= 16, "16px apart");
    let rolledTwo = false, again = 0, guard = 0;
    while (guard++ < 120) {
      await untilTap(0);
      const s = await st();
      if (s.phase === "done") break;
      if (s.phase === "roll") {
        await page.locator("#screen-board-play .bn-pad--0").click();
        await page.waitForFunction(() => window.__BOARD.state().phase !== "roll", null, { timeout: 8000 });
        continue;
      }
      // a roll: the dice are shown with the number they make
      if (s.dice.length === 2 && !rolledTwo) {
        rolledTwo = true;
        const goal = await page.evaluate(() => ({ dice: document.querySelectorAll(".bn-doors__other .bn-goal__die").length, n: document.querySelector(".bn-doors__other .bn-goal__n").textContent }));
        assert.equal(goal.dice, 2, "both dice are shown beside the doors");
        assert.equal(Number(goal.n), s.die, "…with the number they make");
      }
      const ways = await page.evaluate(() => window.BoardLogic.doorWays(window.__BOARD.state()));
      assert.ok(ways.length, "a roll he sees always fits");
      const w = ways.find((x) => x.length === 2) || ways[0];
      if (s.die > 9) assert.equal(w.length, 2, "past nine: two doors");
      const before = s.turn;
      for (const n of w) await page.locator('.bn-doors__grid button.bn-door[data-n="' + n + '"]').click();
      await page.waitForFunction((r) => window.__BOARD.state().phase !== "shut" || window.__BOARD.state().rolls > r, s.rolls, { timeout: 8000 });
      const after = await st();
      if (w.length === 2 && after.phase === "roll" && after.turn === before && after.seats[s.mover].pos < 9) again++;
    }
    assert.ok(rolledTwo, "fixture: two dice were rolled");
    assert.ok(again >= 1, "two doors at once: he rolled again (" + again + ")");
    assert.equal((await st()).phase, "done", "the game ends");
    await page.locator(".bn-party").waitFor({ state: "visible" });
    const done = (await page.evaluate(() => window.__BOARD.save())).done;
    assert.equal(done.doors9, 1, "a finished Doors to Nine counts as one");
    assert.ok(!done.doors, "…and not as a Shut the Doors");
  } finally { await slow(); }
});

test("🐝 a whole Honey Twenty (§18 D, Honey Ten's level two): every flower is TWO ten-frames (13 is a full ten and three), the goal says 20, a held flower lights how many more make twenty, his first game glows a twenty, and it counts as a Honey Twenty", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: false }));
  await quick();
  try {
    await startGame("honey20", "river", true, 3, 0);
    let looked = false;
    for (let guard = 0; guard < 60; guard++) {
      await untilTap(0);
      const s = await st();
      if (s.phase === "done") break;
      const pair = await page.evaluate(() => window.BoardLogic.tenPairs(window.__BOARD.state())[0]);
      if (!looked) {
        looked = true;
        const m = await page.evaluate(() => ({
          flowers: [...document.querySelectorAll(".bn-ten__grid .bn-flower:not(.bn-flower--gone)")].map((f) => ({ n: Number(f.querySelector(".bn-flower__n").textContent), dots: f.querySelectorAll("svg circle").length, slots: f.querySelectorAll("svg rect").length })),
          goal: document.querySelector(".bn-ten__goal").textContent,
          hint: document.querySelectorAll(".bn-ten__grid .bn-flower--hint").length,
        }));
        assert.ok(m.flowers.length >= 2 && m.flowers.every((f) => f.slots === 20 && f.dots === f.n), "every flower is two ten-frames with its dots");
        assert.ok(m.goal.indexOf("20") >= 0, "the goal is twenty (" + m.goal + ")");
        assert.ok(m.hint >= 2, "his first Honey Twenty: a twenty glows");
        await page.locator('.bn-ten__grid button.bn-flower[data-k="' + pair[0] + '"]').click();
        const held = await page.evaluate(() => ({ lit: [...document.querySelectorAll(".bn-flower--held svg rect")].filter((r) => r.getAttribute("fill") === "#fff3b0").length, n: Number(document.querySelector(".bn-flower--held .bn-flower__n").textContent) }));
        assert.equal(held.lit, 20 - held.n, "the lit places are how many more make twenty");
        await page.locator('.bn-ten__grid button.bn-flower[data-k="' + pair[1] + '"]').click();
      } else {
        await page.locator('.bn-ten__grid button.bn-flower[data-k="' + pair[0] + '"]').click();
        await page.locator('.bn-ten__grid button.bn-flower[data-k="' + pair[1] + '"]').click();
      }
      await page.waitForFunction((r) => window.__BOARD.state().rolls > r || window.__BOARD.state().phase === "done", s.rolls, { timeout: 8000 });
    }
    const end = await st();
    assert.equal(end.phase, "done", "the game ends");
    assert.equal(end.made.length, 9, "nine twenties");
    await page.locator(".bn-party").waitFor({ state: "visible" });
    const done = (await page.evaluate(() => window.__BOARD.save())).done;
    assert.equal(done.honey20, 1, "a finished Honey Twenty counts as one");
    assert.equal((await page.evaluate(() => window.__BOARD.save())).intro.honey20, true, "his first Honey Twenty taught it: the next one does not glow");
    assert.ok(!done.honeyten, "…and not as a Honey Ten");
  } finally { await slow(); }
});

test("🔟 a whole Teen Top Card (§18 D, Top Card's level two): his cards are 11 to 20, each a FULL ten-frame and a second with its ones, so a card shows what makes it bigger; ten tricks and one party, counted as a Teen Top Card", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
    await startGame("topteen", "river", true, 3, 0);
    let looked = 0;
    for (let guard = 0; guard < 60; guard++) {
      await untilTap(0);
      const s = await st();
      if (s.phase === "done") break;
      const cards = await page.evaluate(() => [...document.querySelectorAll(".bn-top button.bn-tc, .bn-top .bn-tc--table")].map((c) => ({
        n: Number(c.querySelector(".bn-tc__n").textContent),
        frames: [...c.querySelectorAll(".bn-tc__dots")].map((f) => f.querySelectorAll(".bn-tc__dot:not(.bn-tc__dot--none)").length),
      })));
      for (const c of cards) {
        assert.ok(c.n >= 11 && c.n <= 20, "a teen card (" + c.n + ")");
        assert.deepEqual(c.frames, [10, c.n - 10], c.n + " is a full ten and " + (c.n - 10) + " more");
        looked++;
      }
      const best = await page.evaluate(() => window.BoardLogic.topBest(window.__BOARD.state()));
      await page.locator('.bn-top button.bn-tc[data-v="' + best + '"]').click();
      await page.waitForFunction((g) => window.__BOARD.state().gone[0].length + (window.__BOARD.state().table[0] == null ? 0 : 1) > g || window.__BOARD.state().phase === "done", s.gone[0].length + (s.table[0] == null ? 0 : 1), { timeout: 8000 });
    }
    assert.ok(looked >= 20, "fixture: he saw his cards (" + looked + ")");
    assert.equal((await st()).phase, "done", "the game ends");
    await page.locator(".bn-party").waitFor({ state: "visible" });
    const done = (await page.evaluate(() => window.__BOARD.save())).done;
    assert.equal(done.topteen, 1, "a finished Teen Top Card counts as one");
    assert.ok(!done.topcard, "…and not as a Top Card");
  } finally { await slow(); }
});

test("🔼 a whole Higher or Lower against the computer: the card to beat shows its number and that many dots; two big guesses (⬆️ bigger, ⬇️ smaller); a guess turns the next card over and shows ✅ or 😮 (sound off; never a red ❌); a doubled tap guesses once; the computer's guesses are not his; twelve cards and one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("hilo", "river", true, 3, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "no tokens: the cards are the pieces");
  const dom = () => page.evaluate(() => ({
    n: Number(document.querySelector(".bn-hilo__top .bn-hlc__n").textContent),
    dots: document.querySelectorAll(".bn-hilo__top svg circle").length,
    ans: (document.querySelector(".bn-hilo__ans") || {}).textContent || "",
    g: [...document.querySelectorAll(".bn-hilo__guess .bn-hlg")].map((b) => { const r = b.getBoundingClientRect(); return { up: b.dataset.up, button: b.tagName === "BUTTON", w: r.width, h: r.height, l: r.left, r: r.right }; }),
  }));
  const s0 = await st(), d0 = await dom();
  assert.equal(d0.n, s0.top, "the card to beat is the engine's");
  assert.equal(d0.dots, s0.top, "…with that many dots");
  assert.equal(d0.g.length, 2, "two guesses");
  assert.ok(d0.g.every((b) => b.button && b.w >= 75 && b.h >= 75), `big guesses (${d0.g.map((b) => Math.round(b.w) + "x" + Math.round(b.h))})`);
  assert.ok(d0.g[1].l - d0.g[0].r >= 16, "16px apart");
  // a doubled tap is ONE guess, and its answer is SEEN
  const up = await page.evaluate(() => window.BoardLogic.hiloBest(window.__BOARD.state()));
  await page.locator('.bn-hilo__guess button.bn-hlg[data-up="' + (up ? 1 : 0) + '"]').dblclick();
  await page.waitForFunction(() => { const a = document.querySelector(".bn-hilo__ans"); return a && a.textContent; }, null, { timeout: 5000 });
  const s1 = await st(), d1 = await dom();
  assert.equal(s1.flips, 1, "one guess, one card turned");
  assert.equal(d1.n, s1.top, "the turned card is the next to beat");
  const right = up ? s1.top > s0.top : s1.top < s0.top;
  assert.equal(d1.ans, right ? "✅" : s1.top === s0.top ? "=" : "😮", "the answer shows (a miss is 😮 oh!, never a scolding red ❌)");
  let cpuTried = false;
  for (let guard = 0; guard < 40; guard++) {
    const x = await st();
    if (x.phase !== "done" && x.turn === 1 && !cpuTried) {
      cpuTried = true;
      assert.equal(await page.locator(".bn-hilo__guess button.bn-hlg").count(), 0, "on the computer's turn the guesses are not his");
    }
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    const u = await page.evaluate(() => window.BoardLogic.hiloBest(window.__BOARD.state()));
    await page.locator('.bn-hilo__guess button.bn-hlg[data-up="' + (u ? 1 : 0) + '"]').click();
    await page.waitForFunction((f) => window.__BOARD.state().flips > f, s.flips, { timeout: 5000 });
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.equal(end.flips, 12, "twelve cards");
  assert.ok(cpuTried, "fixture: the computer's turn ran");
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.hilo, 1, "a finished Higher or Lower counts once");
  } finally { await slow(); }
});

test("🍯 a whole Honey Ten against the computer: nine big flowers, each its number and a ten-frame of that many dots; tapping one holds it (a ring, its empty places lit, the goal says 7 + ? = 10); a doubled tap holds once; the one that makes ten is a ⭐; two that do not are said and the turn passes; the computer's flowers are not his; all nine tens and one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("honeyten", "river", true, 3, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "no tokens: the flowers are the board");
  const dom = () => page.evaluate(() => ({
    f: [...document.querySelectorAll(".bn-ten__grid > *")].map((b) => { const r = b.getBoundingClientRect(); return { button: b.tagName === "BUTTON", n: Number((b.querySelector(".bn-flower__n") || {}).textContent || 0), dots: b.querySelectorAll("svg circle").length, held: b.classList.contains("bn-flower--held"), lit: [...b.querySelectorAll("svg rect")].filter((x) => x.getAttribute("fill") === "#fff3b0").length, w: r.width, h: r.height, l: r.left, r: r.right, t: r.top }; }),
    goal: document.querySelector(".bn-ten__goal").textContent,
  }));
  const s0 = await st(), d0 = await dom();
  assert.equal(d0.f.length, 9, "nine flowers");
  assert.deepEqual(d0.f.map((x) => x.n), s0.flowers, "the engine's flowers");
  assert.ok(d0.f.every((x) => x.dots === x.n), "each a ten-frame of that many dots");
  assert.ok(d0.f.every((x) => x.button && x.w >= 75 && x.h >= 75), `big flowers (${d0.f.map((x) => Math.round(x.w))})`);
  assert.ok(d0.f[1].l - d0.f[0].r >= 16, "16px apart");
  // hold one (a doubled tap holds once)
  const pair = await page.evaluate(() => window.BoardLogic.tenPairs(window.__BOARD.state())[0]);
  await page.locator('.bn-ten__grid button.bn-flower[data-k="' + pair[0] + '"]').dblclick();
  await page.waitForFunction((k) => window.__BOARD.state().held === k, pair[0], { timeout: 4000 });
  const d1 = await dom();
  const hn = s0.flowers[pair[0]];
  assert.ok(d1.f[pair[0]].held, "the held flower wears its ring");
  assert.equal(d1.f[pair[0]].lit, 10 - hn, "its empty places light up: how many more make ten");
  assert.equal(d1.goal.replace(/\s/g, ""), "🍯" + hn + "+?=10", "the goal says what is missing");
  await page.locator('.bn-ten__grid button.bn-flower[data-k="' + pair[1] + '"]').click();
  await page.waitForFunction(() => window.__BOARD.state().made.length === 1, null, { timeout: 5000 });
  assert.equal((await st()).seats[0].stars, 1, "a ten is a ⭐");
  let missed = false, cpuTried = false;
  for (let guard = 0; guard < 120; guard++) {
    const x = await st();
    if (x.phase !== "done" && x.turn === 1 && !cpuTried) {
      cpuTried = true;
      assert.equal(await page.locator(".bn-ten__grid button.bn-flower").count(), 0, "on the computer's turn the flowers are not his");
    }
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    const tens = await page.evaluate(() => window.BoardLogic.tenPairs(window.__BOARD.state()));
    let a = tens[0][0], b = tens[0][1];
    if (!missed) {
      // two that do not make ten: said, and the turn passes
      const live = s.flowers.map((n, k) => k).filter((k) => s.flowers[k]);
      const w = live.flatMap((p) => live.filter((q) => q !== p && s.flowers[p] + s.flowers[q] !== 10).map((q) => [p, q]))[0];
      if (w) { a = w[0]; b = w[1]; missed = true; }
    }
    const made = s.made.length;
    await page.locator('.bn-ten__grid button.bn-flower[data-k="' + a + '"]').click();
    await page.waitForFunction((k) => window.__BOARD.state().held === k, a, { timeout: 4000 });
    await page.locator('.bn-ten__grid button.bn-flower[data-k="' + b + '"]').click();
    await page.waitForFunction((r) => window.__BOARD.state().rolls > r, s.rolls, { timeout: 5000 });
    const after = await st();
    if (s.flowers[a] + s.flowers[b] !== 10) {
      assert.equal(after.made.length, made, "not ten: no honey");
      if (after.phase !== "done") assert.equal(after.turn, 1, "…and the turn passes");
    }
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.equal(end.made.length, 9, "all nine tens");
  assert.ok(missed && cpuTried, "fixture: a miss and the computer's turn both ran");
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.honeyten, 1, "a finished Honey Ten counts once");
  } finally { await slow(); }
});

test("🐟 a whole Go Fish against the computer: both hands face up (his big, the computer's small); he taps a card to ask, the computer gives it (a pair, a ⭐, ask again) or says Go fish; when the computer asks HIM he finds the picture in his hand (or taps 🎣) — a fib only wiggles, after two the answer glows; a doubled tap asks once; every pair made and one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("gofish", "river", true, 3, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "no tokens: the cards are the pieces");
  const dom = () => page.evaluate(() => ({
    big: [...document.querySelectorAll(".bn-fish__hand .bn-fishc")].map((b) => { const r = b.getBoundingClientRect(); return { k: b.dataset.k == null ? null : Number(b.dataset.k), button: b.tagName === "BUTTON", pic: b.textContent, glow: b.classList.contains("bn-fishc--hint"), w: r.width, h: r.height, l: r.left, r: r.right, t: r.top }; }),
    small: [...document.querySelectorAll(".bn-fish__other .bn-fishc--small")].map((b) => b.textContent),
    go: !!document.querySelector(".bn-fish__hand button.bn-fishgo"),
    q: (document.querySelector(".bn-fish__q") || {}).textContent || "",
  }));
  const pic = (q) => page.evaluate((x) => window.BoardData.FISH[x].pic, q);
  const s0 = await st(), d0 = await dom();
  assert.deepEqual(d0.big.map((c) => c.pic), await Promise.all(s0.hands[0].map(pic)), "his hand is the engine's");
  assert.deepEqual(d0.small, await Promise.all(s0.hands[1].map(pic)), "the computer's hand, face up");
  assert.ok(d0.big.every((c) => c.button && c.w >= 75 && c.h >= 75), `big cards (${d0.big.map((c) => Math.round(c.w) + "x" + Math.round(c.h))})`);
  const row = d0.big.filter((c) => Math.abs(c.t - d0.big[0].t) < 2);
  for (let k = 1; k < row.length; k++) assert.ok(row[k].l - row[k - 1].r >= 16, "16px apart");
  assert.ok(!d0.go, "Go fish is not a button while he asks");
  // a doubled tap asks ONE question
  const best = await page.evaluate(() => window.BoardLogic.fishBest(window.__BOARD.state()));
  const k0 = best.length ? best[0] : 0;
  await page.locator('.bn-fish__hand button.bn-fishc[data-k="' + k0 + '"]').dblclick();
  await page.waitForFunction((r) => window.__BOARD.state().rolls > r, s0.rolls, { timeout: 5000 });
  assert.equal((await st()).rolls, s0.rolls + 1, "one question");
  let answered = 0, fibbed = false, cpuAsked = false;
  for (let guard = 0; guard < 160; guard++) {
    await page.waitForFunction(() => { const st = window.__BOARD.state(); return st.phase === "done" || (!window.__BOARD.busy() && ((st.phase === "ask" && st.turn === 0) || (st.phase === "answer" && st.turn === 1))); }, null, { timeout: 15000 });
    const s = await st();
    if (s.phase === "done") break;
    if (s.phase === "ask") {
      const b = await page.evaluate(() => window.BoardLogic.fishBest(window.__BOARD.state()));
      await page.locator('.bn-fish__hand button.bn-fishc[data-k="' + (b.length ? b[0] : 0) + '"]').click();
      await page.waitForFunction((r) => window.__BOARD.state().rolls > r, s.rolls, { timeout: 5000 });
      continue;
    }
    // the computer asked HIM: the question shows its picture, and he answers
    cpuAsked = true;
    const d = await dom();
    assert.equal(d.q, await pic(s.want), "the question shows the picture asked for");
    const ans = await page.evaluate(() => window.BoardLogic.fishAnswer(window.__BOARD.state()));
    if (!fibbed) {
      fibbed = true;
      // a fib (Go fish while he has it, or the wrong card) only wiggles; after two the answer glows
      for (let t = 0; t < 2; t++) {
        if (ans >= 0) await page.locator(".bn-fish__hand button.bn-fishgo").click();
        else await page.locator('.bn-fish__hand button.bn-fishc[data-k="0"]').click();
        await page.waitForTimeout(350);
      }
      assert.equal((await st()).phase, "answer", "a fib changes nothing");
      const d2 = await dom();
      if (ans >= 0) assert.deepEqual(d2.big.map((c, k) => (c.glow ? k : -1)).filter((k) => k >= 0), [ans], "after two, the card to give glows");
    }
    if (ans >= 0) await page.locator('.bn-fish__hand button.bn-fishc[data-k="' + ans + '"]').click();
    else await page.locator(".bn-fish__hand button.bn-fishgo").click();
    await page.waitForFunction(() => window.__BOARD.state().phase !== "answer", null, { timeout: 5000 });
    answered++;
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.equal(end.seats[0].stars + end.seats[1].stars, 10, "ten pairs, ten stars");
  assert.ok(cpuAsked && answered >= 1, `fixture: the computer asked him and he answered (${answered})`);
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.gofish, 1, "a finished Go Fish counts once");
  } finally { await slow(); }
});

test("⛄ a whole Snowman Build against the computer: two snowmen side by side, each its big ball to begin with; he rolls the picture die on his pad and taps HIS snowman to put the part on (a doubled tap builds once); a part that cannot go on yet is said and the turn passes; the computer's snowman is not his to tap; two whole snowmen and one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("snowman", "river", true, 4, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "no tokens: the snowmen are the board");
  const dom = () => page.evaluate(() => [...document.querySelectorAll(".bn-snow .bn-snowman")].map((b) => { const r = b.getBoundingClientRect(); return { button: b.tagName === "BUTTON", balls: b.querySelectorAll("svg circle[r]").length, svgG: b.querySelectorAll("svg g").length, w: r.width, h: r.height, l: r.left, r: r.right }; }));
  const d0 = await dom();
  assert.equal(d0.length, 2, "two snowmen");
  assert.ok(d0.every((c) => !c.button && c.svgG === 0), "each just a big ball, and nothing to tap before the roll");
  assert.ok(d0.every((c) => c.w >= 90 && c.h >= 120), `big snowmen (${d0.map((c) => Math.round(c.w) + "x" + Math.round(c.h))})`);
  assert.ok(d0[1].l - d0[0].r >= 16, "16px apart");
  let built = 0, not = 0, doubled = false, cpuTried = false;
  for (let guard = 0; guard < 120; guard++) {
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    if (s.phase === "roll") {
      const r = s.rolls;
      await page.locator(".bn-pad--0").click();
      // the roll lands: a part to put on (his tap next), or not yet (the turn passes)
      await page.waitForFunction((rr) => { const x = window.__BOARD.state(); return x.rolls > rr && (x.phase !== "build" || !window.__BOARD.busy()); }, r, { timeout: 6000 });
      const a = await st();
      if (a.phase !== "build") not++;
      continue;
    }
    // building: his (or, once his is whole, his friend's) snowman is the one
    // button — or, 🎁 a part only the friend's can take, the friend's
    const d = await dom(), to = s.gift != null ? s.gift : s.mover;
    assert.deepEqual(d.map((c) => c.button), [to === 0, to === 1], "only the snowman the part goes on is a button");
    const before = s.parts[to].length;
    if (!doubled) { doubled = true; await page.locator(".bn-snow button.bn-snowman").dblclick(); }
    else await page.locator(".bn-snow button.bn-snowman").click();
    await page.waitForFunction(([m, n]) => window.__BOARD.state().parts[m].length > n, [to, before], { timeout: 5000 });
    assert.equal((await st()).parts[to].length, before + 1, "one part on, even for a doubled tap");
    built++;
    const x = await st();
    if (x.phase !== "done" && x.turn === 1 && !cpuTried) {
      cpuTried = true;
      assert.equal(await page.locator(".bn-snow button.bn-snowman").count(), 0, "on the computer's turn no snowman is his to tap");
    }
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.ok(end.parts.every((p) => p.length === 6), "two whole snowmen");
  assert.ok(built >= 3 && not >= 1 && cpuTried, `fixture: builds, a part that could not go on, and the computer's turn all ran (${built}, ${not}, ${cpuTried})`);
  // a whole snowman shows its hat, nose and scarf
  const parts = await page.evaluate(() => [...document.querySelectorAll(".bn-snow .bn-snowman")].map((b) => b.querySelectorAll("svg g").length));
  assert.deepEqual(parts, [5, 5], "five parts on each big ball");
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.snowman, 1, "a finished Snowman Build counts once");
  } finally { await slow(); }
});

test("🔢 a whole Number Bingo against the computer: the card shows the mover's nine numbers with their dots; he rolls on his pad and taps that number on his card — a wrong square only wiggles (after two the right one glows); a counter with his face covers it; a line is a ⭐; a doubled tap covers once; the computer's card is not his to tap; a full card helps the friend; one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("bingo", "river", true, 5, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "no tokens: the card is the board");
  const dom = () => page.evaluate(() => [...document.querySelectorAll(".bn-bingo__grid .bn-bsq")].map((b) => {
    const r = b.getBoundingClientRect();
    return { n: Number(b.querySelector(".bn-bsq__n").textContent), on: b.classList.contains("bn-bsq--on"), button: b.tagName === "BUTTON", glow: b.classList.contains("bn-bsq--hint"), pips: b.querySelectorAll(".bn-pip:not(.bn-pip--none)").length, w: r.width, h: r.height, l: r.left, r: r.right };
  }));
  const s0 = await st(), d0 = await dom();
  assert.deepEqual(d0.map((c) => c.n), s0.cardsB[0], "his card's numbers are the engine's");
  assert.ok(d0.every((c) => c.pips === c.n), "each number wears its die dots");
  assert.ok(d0.every((c) => !c.button), "before the roll the squares are not buttons");
  assert.ok(d0.every((c) => c.w >= 75 && c.h >= 75), `big squares (${d0.map((c) => Math.round(c.w))})`);
  assert.ok(d0[1].l - d0[0].r >= 16, "16px apart");
  let missed = false, doubled = false, lines = 0, cpuTried = false;
  for (let guard = 0; guard < 120; guard++) {
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    if (s.phase === "roll") {
      if (s.turn === 1) continue;
      await page.locator(".bn-pad--0").click();
      await page.waitForFunction((r) => { const x = window.__BOARD.state(); return x.rolls > r && (x.phase !== "cover" || !window.__BOARD.busy()); }, s.rolls, { timeout: 6000 });
      continue;
    }
    // covering: the squares that are the number are buttons, the rest too (a wrong one wiggles)
    const m = s.mover, spots = await page.evaluate(() => window.BoardLogic.bingoSpots(window.__BOARD.state()));
    const d = await dom();
    assert.deepEqual(d.map((c) => c.n), s.cardsB[m], "the card shown is the mover's");
    if (!missed) {
      const wrong = d.findIndex((c, k) => c.button && spots.indexOf(k) < 0);
      if (wrong >= 0) {
        for (let t = 0; t < 2; t++) { await page.locator('.bn-bingo__grid button.bn-bsq[data-k="' + wrong + '"]').click(); await page.waitForTimeout(350); }
        const d2 = await dom();
        assert.equal((await st()).phase, "cover", "a wrong square covers nothing");
        assert.deepEqual(d2.map((c, k) => (c.glow ? k : -1)).filter((k) => k >= 0), spots, "after two misses the number glows");
        missed = true;
      }
    }
    const k = spots[0], before = (await st()).seats[m].stars;
    if (!doubled) { doubled = true; await page.locator('.bn-bingo__grid button.bn-bsq[data-k="' + k + '"]').dblclick(); }
    else await page.locator('.bn-bingo__grid button.bn-bsq[data-k="' + k + '"]').click();
    await page.waitForFunction(([mm, kk]) => window.__BOARD.state().covered[mm][kk], [m, k], { timeout: 5000 });
    const after = await st();
    assert.equal(after.covered[m].filter(Boolean).length, s.covered[m].filter(Boolean).length + 1, "one square covered, even for a doubled tap");
    if (after.seats[m].stars > before) lines++;
    if (after.phase !== "done" && after.turn === 1 && !cpuTried) {
      cpuTried = true;
      assert.equal(await page.locator(".bn-bingo__grid button.bn-bsq").count(), 0, "on the computer's turn its card is not his to tap");
    }
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.ok(end.covered.every((c) => c.every(Boolean)), "both cards full");
  assert.equal(end.seats[0].stars + end.seats[1].stars, 16, "every line of both cards is a ⭐");
  assert.ok(missed && lines >= 1 && cpuTried, `fixture: a miss, a line and the computer's turn all ran (${missed}, ${lines}, ${cpuTried})`);
  // the covered squares wear a counter with the owner's face. The card SHOWS
  // the game a beat behind the engine (the last counter lands with its
  // animation, just after the engine says done), so this waits for it to
  // land; reading at once failed 4 runs in 5 on a correct game
  const chips = await page.waitForFunction(() => document.querySelectorAll(".bn-bingo__grid .bn-bsq__chip").length === 9, null, { timeout: 3000 }).then(() => 9, async () => page.evaluate(() => document.querySelectorAll(".bn-bingo__grid .bn-bsq__chip").length));
  assert.equal(chips, 9, "a counter on every square");
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.bingo, 1, "a finished Number Bingo counts once");
  } finally { await slow(); }
});

test("🎴 a whole Colour Match against the computer: the top card and his hand show the engine's cards (that many shapes in that colour); a card that matches neither colour nor number only wiggles (after two, the ones that fit glow); nothing fits: the deck is the button and turns one over; a doubled tap plays once; the computer's cards are not his; three rounds, one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  // a deal where he holds a card that fits and one that does not
  let seed = 1;
  for (; seed < 80; seed++) {
    const ok = await page.evaluate((sd) => { const L = window.BoardLogic, st = L.create({ board: "colourmatch", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed: sd, first: 0 }); const n = L.cmPlayable(st).length; return n > 0 && n < st.hands[0].length; }, seed);
    if (ok) break;
  }
  await startGame("colourmatch", "river", true, seed, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "no tokens: the cards are the pieces");
  const dom = () => page.evaluate(() => ({
    top: document.querySelector(".bn-cm__top").getAttribute("aria-label"),
    topShapes: document.querySelectorAll(".bn-cm__top svg g").length,
    hand: [...document.querySelectorAll(".bn-cm__hand .bn-cmc")].map((c) => { const r = c.getBoundingClientRect(); return { k: c.dataset.k == null ? null : Number(c.dataset.k), button: c.tagName === "BUTTON", label: c.getAttribute("aria-label"), shapes: c.querySelectorAll("svg g").length, glow: c.classList.contains("bn-cmc--hint"), l: r.left, r: r.right, w: r.width, h: r.height }; }),
    deckButton: !!document.querySelector(".bn-cm__deck button.bn-cmdeck"),
  }));
  const s0 = await st(), d0 = await dom();
  const L_ = (id) => page.evaluate((x) => ({ n: window.BoardLogic.cmNumber(x) }), id);
  assert.equal(d0.topShapes, (await L_(s0.top)).n, "the top card shows its number of shapes");
  assert.equal(d0.hand.length, 3, "a hand of three");
  for (let k = 0; k < 3; k++) assert.equal(d0.hand[k].shapes, (await L_(s0.hands[0][k])).n, "each card is that many shapes");
  assert.ok(d0.hand.every((c) => c.button && c.w >= 75 && c.h >= 75), `big cards (${d0.hand.map((c) => Math.round(c.w) + "x" + Math.round(c.h))})`);
  assert.ok(d0.hand[1].l - d0.hand[0].r >= 16 && d0.hand[2].l - d0.hand[1].r >= 16, "16px apart");
  assert.ok(!d0.deckButton, "a card fits, so the deck is not a button");
  assert.equal(await page.evaluate(() => { const w = document.querySelector(".bn-cm__hand .bn-handwho"); return w ? w.innerHTML : ""; }), await page.evaluate(() => { const d = document.createElement("span"); d.innerHTML = window.BoardRender.faceHTML(window.BoardData.person("josh")); return d.innerHTML; }), "his hand wears HIS face");
  // a card that does not match only wiggles; after two misses the fitting ones glow
  const fits = await page.evaluate(() => window.BoardLogic.cmPlayable(window.__BOARD.state()));
  const wrong = [0, 1, 2].find((k) => fits.indexOf(k) < 0);
  for (let m = 0; m < 2; m++) {
    await page.locator('.bn-cm__hand button.bn-cmc[data-k="' + wrong + '"]').click();
    await page.waitForTimeout(400);
  }
  const s1 = await st(), d1 = await dom();
  assert.equal(s1.top, s0.top, "a miss plays nothing");
  assert.equal(s1.turn, 0, "…and keeps his turn");
  assert.deepEqual(d1.hand.map((c, k) => (c.glow ? k : -1)).filter((k) => k >= 0), fits, "after two misses the cards that fit glow");
  // (the computer thinks a little longer here, so its turn is on screen
  // long enough for the check below to see whose hand is showing)
  await page.evaluate(() => { window.__BOARD.T.cpuThink = 600; });
  // a doubled tap plays ONE card
  await page.locator('.bn-cm__hand button.bn-cmc[data-k="' + fits[0] + '"]').dblclick();
  await page.waitForFunction(() => window.__BOARD.state().turn === 1 || window.__BOARD.state().phase === "done", null, { timeout: 5000 });
  assert.equal((await st()).hands[0].length, 2, "one card played");
  let cpuTried = false, flipped = false;
  for (let guard = 0; guard < 120; guard++) {
    const x = await st();
    if (x.phase !== "done" && x.turn === 1 && !cpuTried) {
      cpuTried = true;
      assert.equal(await page.locator(".bn-cm__hand button.bn-cmc").count(), 0, "on the computer's turn the cards are not his");
      // …and the row SAYS whose cards they are: River's face on its corner
      // (with none they read as his own, round 5)
      // (the engine hands the turn over before the screen does, so wait for
      // the screen; the hand row stays River's until his turn shows)
      const riverShown = await page.waitForFunction(() => {
        const w = document.querySelector(".bn-cm__hand .bn-handwho"), d = document.createElement("span");
        d.innerHTML = window.BoardRender.faceHTML(window.BoardData.person("river"));
        return !!w && w.innerHTML === d.innerHTML;
      }, null, { timeout: 4000 }).then(() => true, () => false);
      assert.ok(riverShown, "on the computer's turn the hand wears River's face");
    }
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    const d = await dom();
    const ok = await page.evaluate(() => window.BoardLogic.cmPlayable(window.__BOARD.state()));
    assert.equal(d.deckButton, !ok.length, "the deck is a button exactly when nothing fits");
    const r = s.rolls;
    if (!ok.length) { flipped = true; await page.locator(".bn-cm__deck button.bn-cmdeck").click(); }
    else await page.locator('.bn-cm__hand button.bn-cmc[data-k="' + ok[0] + '"]').click();
    await page.waitForFunction((rr) => window.__BOARD.state().rolls > rr, r, { timeout: 5000 });
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.equal(end.seats[0].stars + end.seats[1].stars, 3, "three rounds, three stars");
  assert.ok(cpuTried, "fixture: the computer's turn ran");
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.colourmatch, 1, "a finished Colour Match counts once");
  if (!flipped) console.log("note: this seed never needed the deck");
  } finally { await slow(); }
});

test("🕵️ a whole Who's Hiding against the computer: nine friends showing the engine's animals, shirts and hats; three big question buttons; a question is answered on screen (✅ or ❌, sound off) and everyone it rules out goes down; a doubled tap asks once; the computer's questions are not his; four friends found, one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("hide", "river", true, 3, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "no tokens: the friends are the board");
  const dom = () => page.evaluate(() => {
    const L = window.BoardLogic, D = window.BoardData;
    return {
      cards: [...document.querySelectorAll(".bn-hide__grid .bn-hider")].map((c) => ({
        pic: c.querySelector(".bn-hider__pic").textContent, hat: !!c.querySelector(".bn-hider__hat"),
        shirt: getComputedStyle(c.querySelector(".bn-hider__shirt")).backgroundColor, down: c.classList.contains("bn-hider--down"),
        w: c.offsetWidth, h: c.offsetHeight })),
      asks: [...document.querySelectorAll(".bn-hide__ask .bn-ask")].map((b) => { const r = b.getBoundingClientRect(); return { k: b.dataset.k == null ? null : Number(b.dataset.k), button: b.tagName === "BUTTON", l: r.left, r: r.right, w: r.width, h: r.height, ans: (b.querySelector(".bn-ask__ans") || {}).textContent || "" }; }),
      want: window.__BOARD.state().cards.map((id) => { const t = L.hideTraits(id); return { pic: D.HIDERS.animals[t.a].pic, hat: !!t.h }; }),
    };
  });
  const d0 = await dom(), s0 = await st();
  assert.equal(d0.cards.length, 9, "nine friends");
  assert.deepEqual(d0.cards.map((c) => ({ pic: c.pic, hat: c.hat })), d0.want, "the engine's animals and hats");
  assert.equal(new Set(d0.cards.map((c) => c.shirt)).size >= 2, true, "shirts in colours");
  assert.ok(d0.cards.every((c) => !c.down), "everyone up to begin with");
  assert.ok(d0.cards.every((c) => c.w >= 60), `friends big enough to see (${d0.cards.map((c) => c.w)})`);
  assert.equal(d0.asks.length, 3, "three questions");
  assert.ok(d0.asks.every((a) => a.button && a.w >= 75 && a.h >= 75), `big question buttons (${d0.asks.map((a) => Math.round(a.w) + "x" + Math.round(a.h))})`);
  assert.ok(d0.asks[1].l - d0.asks[0].r >= 16 && d0.asks[2].l - d0.asks[1].r >= 16, "16px apart");
  // a doubled tap asks ONE question (the hammer's echo), and its answer is SEEN
  const k0 = await page.evaluate(() => window.BoardLogic.hideBest(window.__BOARD.state())[0]);
  const exp = await page.evaluate((k) => { const st = window.__BOARD.state(), L = window.BoardLogic; const q = st.asks[k], yes = L.hideYes(q, st.cards[st.hidden]); return { yes, down: st.cards.map((id, j) => st.up[j] && L.hideYes(q, id) !== yes) }; }, k0);
  await page.locator('.bn-hide__ask button.bn-ask[data-k="' + k0 + '"]').dblclick();
  await page.waitForFunction((y) => { const a = document.querySelector(".bn-ask--said .bn-ask__ans"); return a && a.textContent === y; }, exp.yes ? "✅" : "❌", { timeout: 5000 });
  const d1 = await dom();
  assert.deepEqual(d1.cards.map((c) => c.down), exp.down, "exactly the ruled-out friends go down");
  assert.equal((await st()).rolls, s0.rolls + 1, "one question asked");
  let cpuTried = false, found = 0;
  for (let guard = 0; guard < 80; guard++) {
    const x = await st();
    if (x.phase !== "done" && x.turn === 1 && !cpuTried) {
      cpuTried = true;
      assert.equal(await page.locator(".bn-hide__ask button.bn-ask").count(), 0, "on the computer's turn the questions are not his");
    }
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    const d = await dom();
    assert.deepEqual(d.cards.map((c) => c.down), s.up.map((u) => !u), "the friends down are the engine's");
    const k = await page.evaluate(() => window.BoardLogic.hideBest(window.__BOARD.state())[0]);
    const before = s.found;
    await page.locator('.bn-hide__ask button.bn-ask[data-k="' + k + '"]').click();
    await page.waitForFunction((r) => window.__BOARD.state().rolls > r, s.rolls, { timeout: 5000 });
    if ((await st()).found > before) found++;
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.equal(end.seats[0].stars + end.seats[1].stars, 4, "four friends, four stars");
  assert.ok(cpuTried && found >= 1, `fixture: the computer's turn and his find both ran (${found})`);
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.hide, 1, "a finished Who's Hiding counts once");
  } finally { await slow(); }
});

test("🎯 a whole Dice Match against the computer: three big dice and a big roll; a rolled die is tapped to keep it (a ring and a ✋) and a kept die stays put on the next roll; a doubled roll is one roll; the computer's dice are not his; five turns each, stars for matches, one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("dicematch", "river", true, 3, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "no tokens: the dice are the board");
  const dom = () => page.evaluate(() => {
    const box = (b) => { const r = b.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
    const dice = [...document.querySelectorAll(".bn-m3__dice .bn-m3d")];
    const roll = document.querySelector(".bn-m3__roll .bn-m3roll");
    return {
      dice: dice.map((d) => ({ ...box(d), button: d.tagName === "BUTTON", held: d.classList.contains("bn-m3d--held"), pressed: d.getAttribute("aria-pressed"), n: Number((d.querySelector(".bn-die") || {}).dataset ? d.querySelector(".bn-die").dataset.n : 0), hint: d.classList.contains("bn-m3d--hint") })),
      roll: roll ? { ...box(roll), button: roll.tagName === "BUTTON" } : null,
    };
  });
  const d0 = await dom();
  assert.equal(d0.dice.length, 3, "three dice");
  assert.ok(d0.dice.every((d) => d.w >= 75 && d.h >= 75 && !d.button), `three big dice, not yet to keep (${d0.dice.map((d) => Math.round(d.w))})`);
  assert.ok(d0.dice[1].l - d0.dice[0].r >= 16 && d0.dice[2].l - d0.dice[1].r >= 16, "16px apart");
  assert.ok(d0.roll && d0.roll.button && d0.roll.w >= 75 && d0.roll.h >= 75, "a big roll button");
  assert.ok(d0.roll.t - Math.max(...d0.dice.map((d) => d.b)) >= 16, "the roll is 16px below the dice");
  // a doubled roll is ONE roll (the hammer's echo)
  await page.locator(".bn-m3__roll button.bn-m3roll").dblclick();
  await page.waitForFunction(() => window.__BOARD.state().rolls === 1 && !window.__BOARD.busy(), null, { timeout: 8000 });
  const s1 = await st();
  if (s1.turn === 0 && s1.phase === "keep") assert.equal(s1.left, 2, "a doubled roll rolled once: two rolls are left");
  let cpuTried = false, kept = 0, starred = false;
  for (let guard = 0; guard < 60; guard++) {
    const x = await st();
    if (x.phase !== "done" && x.turn === 1 && !cpuTried) {
      cpuTried = true;
      assert.equal(await page.locator(".bn-m3 button").count(), 0, "on the computer's turn the dice and the roll are not his");
    }
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    if (s.seats[0].stars + s.seats[1].stars > 0) starred = true;
    if (s.phase === "keep") {
      const d = await dom();
      assert.deepEqual(d.dice.map((q) => q.n), s.dice, "the dice show the roll");
      assert.ok(d.dice.every((q) => q.button), "a rolled die is a button");
      const want = await page.evaluate(() => window.BoardLogic.m3Keep(window.__BOARD.state().dice));
      for (let k = 0; k < 3; k++) if (want[k] !== s.held[k]) await page.locator('.bn-m3__dice button.bn-m3d[data-k="' + k + '"]').click();
      const d2 = await dom();
      assert.deepEqual(d2.dice.map((q) => q.held), want, "the kept dice wear a ring");
      assert.deepEqual(d2.dice.map((q) => q.pressed), want.map(String), "…and say they are kept");
      const before = s.dice.slice();
      if (want.some(Boolean)) kept++;
      await page.locator(".bn-m3__roll button.bn-m3roll").click();
      await page.waitForFunction(() => !window.__BOARD.busy() || window.__BOARD.state().turn === 1, null, { timeout: 8000 });
      await page.waitForFunction(() => { const x = window.__BOARD.state(); return x.rolls > 0; }, null, { timeout: 8000 });
      const after = await st();
      if (after.turn === 0 && after.phase === "keep") for (let k = 0; k < 3; k++) if (want[k]) assert.equal(after.dice[k], before[k], "a kept die stays put");
      continue;
    }
    await page.locator(".bn-m3__roll button.bn-m3roll").click();
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.ok(end.seats.every((x) => x.pos === 5), "five turns each");
  assert.ok(cpuTried && kept >= 1 && (starred || end.seats[0].stars + end.seats[1].stars > 0), `fixture: the computer's turn, a keep and a star all ran (${kept})`);
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.dicematch, 1, "a finished Dice Match counts once");
  } finally { await slow(); }
});

test("🍪 a whole Cookie Jar against the computer: three big takes (never more than are left), the jar shows how many are left (sound off), the golden cookie waits at the bottom, a doubled tap takes once, the computer's turn is not his to take, four jars and one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("cookies", "river", true, 3, 0);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".bn-token")].filter((t) => !t.hidden).length), 0, "no tokens: the jar is the board");
  const dom = () => page.evaluate(() => {
    const cs = [...document.querySelectorAll(".bn-jar .bn-cookie")];
    const top = (c) => parseFloat(c.style.top);
    const gold = cs.find((c) => c.classList.contains("bn-cookie--gold"));
    return {
      takes: [...document.querySelectorAll(".bn-take .bn-takeb")].map((b) => { const r = b.getBoundingClientRect(); return { n: Number(b.dataset.n || 0), button: b.tagName === "BUTTON", shown: getComputedStyle(b).visibility !== "hidden", hint: b.classList.contains("bn-takeb--hint"), l: r.left, r: r.right, w: r.width, h: r.height }; }),
      count: Number(document.querySelector(".bn-jar__n").textContent),
      cookies: cs.length,
      goldAtBottom: !!gold && cs.every((c) => top(c) <= top(gold)),
    };
  });
  const d0 = await dom();
  assert.equal(d0.takes.length, 3, "three takes: one, two, three");
  assert.ok(d0.takes.every((t) => t.button && t.shown && t.w >= 75 && t.h >= 75), `three big takes (${d0.takes.map((t) => Math.round(t.w) + "x" + Math.round(t.h))})`);
  assert.ok(d0.takes[1].l - d0.takes[0].r >= 16 && d0.takes[2].l - d0.takes[1].r >= 16, "16px apart");
  assert.equal(d0.count, 7, "the jar shows its seven cookies");
  assert.equal(d0.cookies, 7, "…and holds seven");
  assert.ok(d0.goldAtBottom, "the golden cookie is at the bottom: the last one left");
  assert.ok(d0.takes.every((t) => !t.hint), "nothing glows once he has been shown how");
  // a doubled tap is ONE take (the hammer's echo)
  await page.locator('.bn-take button.bn-takeb[data-n="1"]').dblclick();
  await page.waitForFunction(() => window.__BOARD.state().turn === 1 || window.__BOARD.state().cookies !== 7, null, { timeout: 5000 });
  assert.equal((await st()).seats[0].pos, 1, "a doubled tap took one cookie, not two");
  let cpuTried = false, short = false, golden = 0;
  for (let guard = 0; guard < 80; guard++) {
    const x = await st();
    if (x.phase !== "done" && x.turn === 1 && !cpuTried) {
      cpuTried = true;
      assert.equal(await page.locator(".bn-take button.bn-takeb").count(), 0, "on the computer's turn the takes are not his");
    }
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    const d = await dom();
    assert.equal(d.count, s.cookies, `the jar shows how many are left (${d.count} for ${s.cookies})`);
    // never more than are left
    const can = d.takes.filter((t) => t.button && t.shown).map((t) => t.n);
    assert.deepEqual(can, [1, 2, 3].filter((n) => n <= s.cookies), `takes for ${s.cookies} left: ${can}`);
    if (s.cookies < 3) short = true;
    // he plans: leave his friend a multiple of four (or take one)
    const n = (await page.evaluate(() => window.BoardLogic.nimBest(window.__BOARD.state()))) || 1;
    if (n === s.cookies) golden++;
    await page.locator('.bn-take button.bn-takeb[data-n="' + n + '"]').click();
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.equal(end.seats[0].stars + end.seats[1].stars, 4, "four jars, four golden cookies");
  assert.equal(end.seats[0].pos + end.seats[1].pos, 32, "every cookie on a plate");
  assert.ok(cpuTried && short && golden >= 1, `fixture: the computer's turn, a short jar and a golden cookie all ran (${golden})`);
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.cookies, 1, "a finished Cookie Jar counts once");
  } finally { await slow(); }
});

test("🔴 a whole Line Up against the computer: three big columns, a counter drops to the bottom of its column wearing its player's face, three in a row glows and is a ⭐, a full column is no button, the computer's turn is not his, two boards and one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("lineup", "river", true, 3, 0);
  const dom = () => page.evaluate(() => [...document.querySelectorAll(".bn-lines .bn-col")].map((c) => {
    const r = c.getBoundingClientRect();
    return { button: c.tagName === "BUTTON", c: Number(c.dataset.c), w: r.width, h: r.height, l: r.left, r: r.right,
      // the slots from the BOTTOM up: empty, or whose counter (by colour)
      slots: [...c.querySelectorAll(".bn-slot")].reverse().map((sl) => (sl.classList.contains("bn-slot--on") ? sl.style.borderColor : null)),
      lines: c.querySelectorAll(".bn-slot--line").length };
  }));
  const colour = await page.evaluate(() => [window.BoardData.person("josh").colour, window.BoardData.person("river").colour]);
  const rgb = (hex) => "rgb(" + [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)).join(", ") + ")";
  const d0 = await dom();
  assert.equal(d0.length, 3, "three columns");
  assert.ok(d0.every((c) => c.button && c.w >= 75 && c.h >= 75), `three big columns (${d0.map((c) => Math.round(c.w) + "x" + Math.round(c.h))})`);
  assert.ok(d0[1].l - d0[0].r >= 16 && d0[2].l - d0[1].r >= 16, "16px apart");
  assert.ok(d0.every((c) => c.slots.length === 5 && c.slots.every((x) => x === null)), "five empty slots each");
  let cpuTried = false, lines = 0, full = false, fresh = false;
  for (let guard = 0; guard < 80; guard++) {
    const x = await st();
    if (x.phase !== "done" && x.turn === 1 && !cpuTried) {
      cpuTried = true;
      assert.equal(await page.locator(".bn-lines button.bn-col").count(), 0, "on the computer's turn the columns are not his");
    }
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    if (s.boardNo === 1) fresh = true;
    // the board on screen is the engine's, slot by slot, bottom up
    const d = await dom();
    for (let c = 0; c < 3; c++) {
      const want = [0, 1, 2, 3, 4].map((r) => { const g = s.grid[r * 3 + c]; return g < 0 ? null : rgb(colour[g]); });
      assert.deepEqual(d[c].slots, want, `column ${c} shows the engine's counters, bottom up`);
      const isFull = s.grid[4 * 3 + c] >= 0;
      if (isFull) { full = true; assert.ok(!d[c].button, `a full column is no button`); }
    }
    // he looks: the column that makes his line, or stops his friend's
    const best = await page.evaluate(() => window.BoardLogic.linesBest(window.__BOARD.state()));
    const open = await page.evaluate(() => window.BoardLogic.linesOpen(window.__BOARD.state()));
    const c = best.length ? best[0] : open[0];
    const makes = await page.evaluate((col) => window.BoardLogic.linesMade(window.__BOARD.state(), col, 0).length, c);
    await page.locator('.bn-lines button.bn-col[data-c="' + c + '"]').click();
    if (makes) {
      // the line's three glow gold
      await page.waitForFunction(() => document.querySelectorAll(".bn-lines .bn-slot--line").length >= 3, null, { timeout: 5000 });
      lines++;
    }
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.equal(end.seats[0].pos + end.seats[1].pos, 30, "every slot of both boards");
  assert.ok(cpuTried && lines >= 1 && full && fresh, `fixture: the computer's turn, his line, a full column and the second board all ran (${lines})`);
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.lineup, 1, "a finished Line Up counts once");
  } finally { await slow(); }
});

test("🃏 a whole Top Card against the computer: his three cards are big buttons showing the engine's hand, the friend's lead waits on the table under their face, the bigger card glows and is a ⭐, the computer's turn is not his, ten tricks and one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("topcard", "river", true, 3, 1);
  const dom = () => page.evaluate(() => {
    const spots = [...document.querySelectorAll(".bn-top__spot")];
    return {
      hand: [...document.querySelectorAll(".bn-top__hand .bn-tc")].map((b) => { const r = b.getBoundingClientRect(); return { v: Number(b.querySelector(".bn-tc__n").textContent), dots: b.querySelectorAll(".bn-tc__dot:not(.bn-tc__dot--none)").length, button: b.tagName === "BUTTON", w: r.width, h: r.height, l: r.left, r: r.right }; }),
      table: spots.map((sp) => { const n = sp.querySelector(".bn-tc--table .bn-tc__n"); return n ? Number(n.textContent) : null; }),
      win: spots.map((sp) => sp.classList.contains("bn-top__spot--win")),
    };
  });
  let follows = 0, leads = 0, cpuTried = false, won = 0;
  for (let guard = 0; guard < 60; guard++) {
    const x = await st();
    if (x.phase !== "done" && x.turn === 1 && !cpuTried) {
      cpuTried = true;
      assert.equal(await page.locator(".bn-top__hand button.bn-tc").count(), 0, "on the computer's turn his cards are not to play");
      // …and the row wears HIS face: against the computer it is always his
      // own hand, kept on show so he can plan (round 5's owner badge)
      assert.equal(await page.evaluate(() => { const w = document.querySelector(".bn-top__hand .bn-handwho"), d = document.createElement("span"); d.innerHTML = window.BoardRender.faceHTML(window.BoardData.person("josh")); return !!w && w.innerHTML === d.innerHTML; }), true, "the hand row wears its owner's face");
    }
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    const d = await dom();
    assert.deepEqual(d.hand.map((c) => c.v), s.hands[0].slice().sort((a, b) => a - b), "his hand on screen is the engine's");
    assert.ok(d.hand.every((c) => c.button && c.w >= 75 && c.h >= 75 && c.dots === c.v), `big cards, each with its dots (${d.hand.map((c) => Math.round(c.w) + "x" + Math.round(c.h))})`);
    for (let k = 1; k < d.hand.length; k++) assert.ok(d.hand[k].l - d.hand[k - 1].r >= 16, "16px apart");
    if (s.phase === "follow") {
      follows++;
      assert.deepEqual(d.table, [null, s.table[1]], "the friend's lead waits on the table, under their face");
    } else { leads++; assert.deepEqual(d.table, [null, null], "a fresh trick: the table is clear"); }
    const v = await page.evaluate(() => window.BoardLogic.topBest(window.__BOARD.state()));
    const wins = s.phase === "follow" && v > s.table[1];
    await page.locator('.bn-top__hand button.bn-tc[data-v="' + v + '"]').click();
    if (wins) {
      // the bigger card glows on his side
      await page.waitForFunction(() => { const sp = document.querySelectorAll(".bn-top__spot")[0]; return sp && sp.classList.contains("bn-top__spot--win"); }, null, { timeout: 5000 });
      won++;
    }
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.ok(end.gone.every((g) => g.length === 10), "ten tricks: every card played");
  assert.ok(follows >= 1 && leads >= 1 && cpuTried && won >= 1, `fixture: he answered, he led, the computer played and he won a trick (${follows}, ${leads}, ${won})`);
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.topcard, 1, "a finished Top Card counts once");
  } finally { await slow(); }
});

test("🎨 a whole Colour Grab against the computer: three big colours (never his own, never his friend's), his pick turns his patch that colour and grabs what it touches, each patch outlined in its player's colour with their face on its corner, the computer's turn is not his, every square grabbed and one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("grab", "river", true, 3, 0);
  const dom = () => page.evaluate(() => ({
    swatches: [...document.querySelectorAll(".bn-grab__pick .bn-swatch")].map((b) => { const r = b.getBoundingClientRect(); return { c: b.dataset.c || null, button: b.tagName === "BUTTON", w: r.width, h: r.height, l: r.left, r: r.right }; }),
    // the squares drawn, in the engine's order (row 0 is the BOTTOM row)
    // each square by WHERE it is drawn: row 0 is the BOTTOM row on screen
    fills: (() => { const out = []; for (const r of document.querySelectorAll(".bn-grab__svg > rect:not(.bn-grab__fresh)")) { const x = Math.floor(Number(r.getAttribute("x")) / 100), y = Math.floor(Number(r.getAttribute("y")) / 100); out[(7 - 1 - y) * 6 + x] = r.getAttribute("fill"); } return out; })(),
    edges: [...document.querySelectorAll(".bn-grab__svg line")].map((l) => l.getAttribute("stroke")),
    faces: document.querySelectorAll(".bn-grab__who").length,
  }));
  const colours = await page.evaluate(() => Object.fromEntries(window.BoardData.COLOURS.map((c) => [c.id, c.fill])));
  const people = await page.evaluate(() => [window.BoardData.person("josh").colour, window.BoardData.person("river").colour]);
  let cpuTried = false, picks = 0, grew = 0;
  for (let guard = 0; guard < 60; guard++) {
    const x = await st();
    if (x.phase !== "done" && x.turn === 1 && !cpuTried) {
      cpuTried = true;
      assert.equal(await page.locator(".bn-grab__pick button.bn-swatch").count(), 0, "on the computer's turn the colours are not his");
    }
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    const d = await dom();
    // the three colours: never his own, never his friend's
    const own = s.paint[s.owner.indexOf(0)], theirs = s.paint[s.owner.indexOf(1)];
    assert.deepEqual(d.swatches.map((w) => w.c).sort(), await page.evaluate(() => window.BoardLogic.grabOptions(window.__BOARD.state()).slice().sort()), "the three colours he may pick");
    assert.ok(d.swatches.every((w) => w.c !== own && w.c !== theirs), "never his own or his friend's");
    assert.ok(d.swatches.every((w) => w.button && w.w >= 75 && w.h >= 75), `three big colours (${d.swatches.map((w) => Math.round(w.w) + "x" + Math.round(w.h))})`);
    assert.ok(d.swatches[1].l - d.swatches[0].r >= 16 && d.swatches[2].l - d.swatches[1].r >= 16, "16px apart");
    // the grid on screen is the engine's, square by square
    const want = s.paint.map((p) => colours[p]);
    assert.deepEqual(d.fills, want, "the grid shows the engine's colours (row 0 at the bottom)");
    // both patches outlined in their players' colours, and both faces shown
    assert.ok(d.edges.indexOf(people[0]) >= 0 && d.edges.indexOf(people[1]) >= 0, "each patch is outlined in its player's colour");
    assert.equal(d.faces, 2, "each player's face on their corner");
    // he looks: the colour that grabs the most
    const c = (await page.evaluate(() => window.BoardLogic.grabBest(window.__BOARD.state())))[0];
    const gain = await page.evaluate((col) => window.BoardLogic.grabGain(window.__BOARD.state(), col), c);
    const before = s.seats[0].pos;
    await page.locator('.bn-grab__pick button.bn-swatch[data-c="' + c + '"]').click();
    await page.waitForFunction((b) => window.__BOARD.state().seats[0].pos !== b || window.__BOARD.state().phase === "done", before, { timeout: 5000 }).catch(() => {});
    picks++;
    if (gain > 0) grew++;
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.ok(end.owner.every((o) => o >= 0), "every square grabbed");
  assert.equal(end.seats[0].pos + end.seats[1].pos, 42, "every square on someone's patch");
  assert.ok(cpuTried && picks >= 3 && grew >= 2, `fixture: the computer's turn and his grabs all ran (${picks}, ${grew})`);
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.grab, 1, "a finished Colour Grab counts once");
  } finally { await slow(); }
});

test("🎲 a whole Pick a Die against the computer: his roll is two dice, two big dice to pick from cover the pads, each die's square lights on the board wearing its dots, the picked die is hopped one tap a hop, the computer picks for itself, and it ends in one party", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await quick();
  try {
  await startGame("pickdie", "river", true, 3, 0);
  // the computer's pick is over in a moment at the quick pace, so a poll
  // can miss it: count every pick the shell asks the engine for
  await page.evaluate(() => { const L = window.BoardLogic, o = L.chooseDie; window.__chose = []; L.chooseDie = (st, k) => { window.__chose.push(st.turn); return o(st, k); }; window.__choseUndo = () => { L.chooseDie = o; }; });
  let choices = 0, rocket = false, cpuChose = false, hops = 0;
  for (let guard = 0; guard < 400; guard++) {
    const x = await st();
    if (x.phase === "choose" && x.turn === 1) {
      cpuChose = true;
      assert.equal(await page.locator(".bn-choose button.bn-pickd").count(), 0, "the computer's dice are not his to pick");
    }
    await untilTap(0);
    const s = await st();
    if (s.phase === "done") break;
    if (s.phase === "roll") {
      await page.locator(".bn-pad--0").click();
      await page.waitForFunction(() => window.__BOARD.state().phase !== "roll" && !window.__BOARD.busy(), null, { timeout: 5000 });
      continue;
    }
    if (s.phase === "choose") {
      choices++;
      await page.locator(".bn-choose").waitFor({ state: "visible" });
      const d = await page.evaluate(() => ({
        buttons: [...document.querySelectorAll(".bn-choose button.bn-pickd")].map((b) => { const r = b.getBoundingClientRect(); return { k: Number(b.dataset.k), w: r.width, h: r.height, l: r.left, r: r.right }; }),
        padsHidden: [...document.querySelectorAll(".bn-pad")].every((p) => getComputedStyle(p).visibility === "hidden"),
        targets: [...document.querySelectorAll(".bn-target")].filter((t) => !t.hidden).map((t) => ({ n: Number(t.dataset.n), dots: t.querySelectorAll(".bn-dot:not(.bn-dot--none)").length })),
      }));
      const same = s.dice[0] === s.dice[1];
      assert.equal(d.buttons.length, same ? 1 : 2, "a die to pick for each different face");
      assert.ok(d.buttons.every((b) => b.w >= 75 && b.h >= 75), `big dice (${d.buttons.map((b) => Math.round(b.w) + "x" + Math.round(b.h))})`);
      if (!same) assert.ok(d.buttons[1].l - d.buttons[0].r >= 16, "16px apart");
      assert.ok(d.padsHidden, "the dice cover the pads while he picks");
      const want = (same ? [0] : [0, 1]).map((k) => ({ n: Math.min(36, s.seats[s.mover].pos + s.dice[k]), dots: s.dice[k] }));
      assert.deepEqual(d.targets, want, "each die's square lights, wearing its dots");
      // he looks ahead: the die that lands on a rocket (or the bigger one)
      const k = (await page.evaluate(() => window.BoardLogic.dieBest(window.__BOARD.state())))[0];
      if (await page.evaluate((kk) => { const st = window.__BOARD.state(), j = window.BoardLogic.jumpAt(window.BoardData.board("pickdie"), window.BoardLogic.dieTarget(st, kk)); return !!(j && j.kind === "boost"); }, k)) rocket = true;
      const pick = same ? 0 : k;
      await page.locator('.bn-choose button.bn-pickd[data-k="' + pick + '"]').click();
      await page.waitForFunction(() => window.__BOARD.state().phase !== "choose", null, { timeout: 5000 });
      assert.ok(await page.evaluate(() => document.querySelector(".bn-choose").hidden && [...document.querySelectorAll(".bn-target")].every((t) => t.hidden)), "the choice and its squares go once he has picked");
      continue;
    }
    // a hop
    hops++;
    await page.locator(".bn-pad--0").click();
    await page.waitForTimeout(60);
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.ok(end.seats.every((x) => x.home), "both home — nobody loses");
  cpuChose = cpuChose || (await page.evaluate(() => window.__chose.indexOf(1) >= 0));
  await page.evaluate(() => window.__choseUndo());
  assert.ok(choices >= 2 && hops >= 2 && rocket && cpuChose, `fixture: he picked (${choices}), hopped (${hops}), took a rocket die (${rocket}), and the computer picked (${cpuChose})`);
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.pickdie, 1, "a finished Pick a Die counts once");
  } finally { await slow(); }
});

test("no uncaught page errors in Game Night", () => {
  assert.deepEqual(pageErrors, []);
});

test("🎲 EVERY box's first game shows the ghost hand, and its fingertip rests on a button he can tap (derived from the shelf)", async () => {
  // The hand is how a non-reader learns where to start, and each game points
  // it somewhere of its own (the pad, a card, a pot, a column, a flower…). A
  // new game that forgot its branch would point at nothing, or at the wrong
  // thing, and every whole-game test would still pass.
  const boxes = await page.evaluate(() => window.BoardData.BOXES.map((b) => b.id));
  const off = [];
  for (const box of boxes) {
    await page.evaluate((x) => { window.__BOARD.reset({ done: { moon: 2 } }); window.__BOARD.start(x, "river", true, 3, 0); }, box);
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    await page.waitForFunction(() => { const h = document.querySelector("#screen-board-play .bn-hand"); return h && !h.hidden && h.offsetParent; }, null, { timeout: 5000 }).catch(() => {});
    const under = await page.evaluate(() => {
      const h = document.querySelector("#screen-board-play .bn-hand");
      if (!h || h.hidden || !h.offsetParent) return "no hand";
      const b = h.getBoundingClientRect();
      h.style.visibility = "hidden";
      const e = document.elementFromPoint(b.left + b.width * 0.3, b.top + b.height * 0.2);
      h.style.visibility = "";
      const t = e && e.closest("button");
      return t && !t.disabled && t.offsetParent ? "ok" : "under it: " + (e ? e.className : "nothing");
    });
    if (under !== "ok") off.push(box + " (" + under + ")");
  }
  assert.deepEqual(off, [], "a first-time hand that does not rest on a button");
});

test("🎲 NO DEAD TAP: on EVERY box, the first board button a new player taps at the start DOES something (a move, a wiggle, or the hand pointing at the real move) (derived from the shelf)", async () => {
  // 🚪 Shut the Doors drew its six doors as live buttons from the first
  // frame, and a door tapped BEFORE rolling did nothing at all — no wiggle,
  // no word: a new player's first tap was silence. A tap that does nothing is
  // indistinguishable from a broken game to a four-year-old.
  const boxes = await page.evaluate(() => window.BoardData.BOXES.map((b) => b.id));
  const dead = [];
  let tried = 0;
  for (const box of boxes) {
    await page.evaluate((x) => { window.__BOARD.reset({ introSeen: true, done: { moon: 2 } }); window.__BOARD.start(x, "river", true, 7, 0); }, box);
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    await page.waitForFunction(() => { const x = window.__BOARD.state(); return x && x.turn === 0 && !window.__BOARD.busy(); }, null, { timeout: 8000 });
    const r = await page.evaluate(() => {
      const b = [...document.querySelectorAll("#screen-board-play .bn-board button")].find((e) => e.offsetParent && !e.disabled && !e.closest(".bn-party"));
      if (!b) return null;
      const before = JSON.stringify(window.__BOARD.state());
      b.click();
      const moved = JSON.stringify(window.__BOARD.state()) !== before;
      const h = document.querySelector("#screen-board-play .bn-hand");
      return { what: b.getAttribute("aria-label"), did: moved || !!document.querySelector("#screen-board-play .bn-wiggle") || !!(h && !h.hidden) };
    });
    if (!r) continue;
    tried++;
    if (!r.did) dead.push(box + " (" + r.what + ")");
  }
  assert.ok(tried >= 15, "fixture: most boxes have board buttons at the start (" + tried + ")");
  assert.deepEqual(dead, [], "a board button that does NOTHING when a new player taps it first");
});

test("🎲 the HELP hand never rests on a wrong answer: tapping his own pad in an answer game points at the QUESTION (or an earned glow), never at an un-glowed choice", async () => {
  // A pad tap is a four-year-old asking "what do I do?". In the games whose
  // move is an ANSWER, the hand used to fall back to the FIRST choice, which
  // can be wrong: 🎴 Colour Match pointed at a card that did not match while
  // the deck glowed. A hand on a wrong answer teaches it.
  await quick();
  const bad = [];
  const under = () => page.evaluate(() => {
    const h = document.querySelector("#screen-board-play .bn-hand");
    if (!h || h.hidden) return { none: true };
    const b = h.getBoundingClientRect();
    h.style.visibility = "hidden";
    const e = document.elementFromPoint(b.left + b.width * 0.3, b.top + b.height * 0.2);
    h.style.visibility = "";
    const t = e && e.closest("button");
    return { on: t ? t.className : null };
  });
  const pad = () => page.evaluate(() => document.querySelector("#screen-board-play .bn-pad--0").click());
  const check = async (what) => {
    await pad();
    const u = await under();
    if (u.none) bad.push(what + ": no hand");
    // (the deck to turn when nothing fits, or 🎣 when he has none to give,
    // IS the right move; any other un-glowed choice may be wrong)
    else if (u.on && !/--hint|bn-pad|bn-cmdeck--go|bn-fishgo/.test(u.on)) bad.push(what + ": on " + u.on);
  };
  const begin = async (box, first) => {
    await page.evaluate((a) => { window.__BOARD.reset({ introSeen: true, done: { moon: 2 } }); window.__BOARD.start(a[0], "river", true, 5, a[1]); }, [box, first || 0]);
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
  };
  // 🚂 a train: the cars are the answers
  await begin("train"); await untilTap(0); await check("train");
  // 🎴 every Colour Match opening on a few seeds: a fit or none
  let none = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    await page.evaluate((x) => { window.__BOARD.reset({ introSeen: true }); window.__BOARD.start("colourmatch", "river", true, x, 0); }, seed);
    await untilTap(0);
    if (await page.locator("#screen-board-play button.bn-cmdeck--go").count()) none++;
    await check("colourmatch seed " + seed);
  }
  assert.ok(none >= 1, "fixture: some opening has nothing that fits (the deck is the move)");
  // 🔢 a rolled number to find on the card
  await begin("bingo"); await untilTap(0);
  await pad(); await page.waitForFunction(() => (window.__BOARD.state().phase === "cover" && !window.__BOARD.busy()) || window.__BOARD.state().turn !== 0, null, { timeout: 5000 });
  if ((await st()).phase === "cover") await check("bingo cover");
  // 🍯 a flower held: the second flower is the answer
  await begin("honeyten"); await untilTap(0);
  await page.evaluate(() => document.querySelector("#screen-board-play button.bn-flower").click());
  if ((await st()).held != null) await check("honeyten held");
  // 🐟 the friend asks HIM: the card to give is the answer
  await begin("gofish", 1);
  await page.waitForFunction(() => { const x = window.__BOARD.state(); return x.phase === "answer" && x.turn === 1 && !window.__BOARD.busy(); }, null, { timeout: 15000 });
  await check("gofish answer");
  // …and his pad never says it is the friend's turn while the friend waits
  // for HIS answer
  assert.equal(await page.locator("#screen-board-play .bn-pad--0.bn-wiggle").count(), 0, "a pad tap while he must answer is help, not a 'wait your turn' wiggle");
  // …and it is HIS pad that is lit while he answers, the asker's that waits:
  // River's question once left River's pad lit and his dimmed as "wait",
  // on the one move he makes during her turn (round 5, found by playing)
  const lit = await page.evaluate(() => [...document.querySelectorAll("#screen-board-play .bn-pad")].map((p) => p.classList.contains("bn-pad--on")));
  assert.deepEqual(lit, [true, false], "while the friend waits for his answer, his pad is the lit one");
  await slow();
  assert.deepEqual(bad, [], "the help hand rests on an un-glowed choice (it can be a wrong answer)");
});

test("🎲 a new game never opens with a pad still WIGGLING from the last one (the timer that takes it off is cancelled with the game)", async () => {
  // A wiggle is "not yet" — taken off by a 420ms timer. Starting a new game
  // cancels every timer, so a wiggle caught in that window stayed on the pad
  // for good: the next game opened with his pad saying "not yet".
  await page.evaluate(() => { window.__BOARD.reset({ introSeen: true }); window.__BOARD.start("moon", "river", true, 5, 0); });
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await untilTap(0);
  const stuck = await page.evaluate(() => {
    document.querySelector("#screen-board-play .bn-pad--1").click(); // the friend's pad: a kind wiggle
    const was = document.querySelector("#screen-board-play .bn-pad--1").classList.contains("bn-wiggle");
    window.__BOARD.start("rainbow", "river", true, 6, 0); // a new game inside the wiggle
    return { was, now: document.querySelectorAll("#screen-board-play .bn-pad.bn-wiggle").length };
  });
  assert.equal(stuck.was, true, "fixture: tapping the friend's pad on his turn wiggles it");
  await page.waitForTimeout(700);
  assert.equal(await page.locator("#screen-board-play .bn-pad.bn-wiggle").count(), 0, "no pad is left wiggling into the next game");
});

test("🁢 a tile FISHED from the pile is shown WHOLE, not cut in half by the line's small rows", async () => {
  // The fished tile shows in the line a moment, at 96x48 — but the line's
  // rows are sized for its small tiles, so from the third tile on the fished
  // one was cut to a sliver: he could not see what he had caught.
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  const ok = await page.evaluate(() => {
    const L = window.BoardLogic;
    for (let seed = 1; seed < 400; seed++) {
      const st = L.create({ board: "dominoes", seats: [{ who: "josh" }, { who: "river", cpu: true }], seed, first: 0 });
      let n = 0;
      while (st.phase !== "done" && n++ < 200) {
        if (st.turn === 0 && st.phase === "draw" && st.line.length >= 4) return window.__BOARD.load("dominoes", L.snapshot(st));
        L.autoTurn(st);
      }
    }
    return false;
  });
  assert.ok(ok, "fixture: a game where he must fish with a long line");
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForFunction(() => !window.__BOARD.busy(), null, { timeout: 5000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector("#screen-board-play .bn-pad--0").click());
  await page.waitForFunction(() => document.querySelector("#screen-board-play .bn-dom__fish"), null, { timeout: 4000 });
  const r = await page.evaluate(() => {
    const svg = document.querySelector("#screen-board-play .bn-dom__fish .bn-domsvg"), line = document.querySelector("#screen-board-play .bn-dom__line");
    const a = svg.getBoundingClientRect(), b = line.getBoundingClientRect(), c = svg.parentElement.getBoundingClientRect();
    return { h: a.height, cellH: c.height, inside: a.top >= b.top - 1 && a.bottom <= b.bottom + 1 };
  });
  assert.ok(r.h >= 40, "the fished tile is big (" + r.h + ")");
  assert.ok(r.cellH >= r.h - 1, "its row is as tall as the tile (" + r.cellH + " for a " + r.h + "px tile)");
  assert.ok(r.inside, "the fished tile lies inside the line, not cut off");
});

test("🎲 EVERY box on the shelf OPENS: tapped, it shows who's playing, and both ways to play open (derived from the shelf — a box id with a digit, 🁢 dominoes6, was once refused by the router and its tap did nothing)", async () => {
  const open = await page.evaluate(() => Object.fromEntries(window.BoardData.BOXES.filter((b) => b.unlockAfter).map((b) => [b.unlockAfter.box, b.unlockAfter.games])));
  await page.evaluate((d) => window.__BOARD.reset({ introSeen: true, done: d }), open);
  const boxes = await page.evaluate(() => window.BoardData.BOXES.map((b) => b.id));
  assert.ok(boxes.some((b) => /\d/.test(b)), "fixture: a box id with a digit is on the shelf");
  const dead = [];
  for (const box of boxes) {
    await go("#board-home", "#screen-board-home");
    await page.locator('.bn-box[data-box="' + box + '"]').click();
    try { await page.locator("#screen-board-who").waitFor({ state: "visible", timeout: 3000 }); } catch (e) { dead.push(box + " (its tap did nothing)"); continue; }
    if (!(await page.evaluate((b) => location.hash === "#board-who-" + b, box))) dead.push(box + " (the wrong who screen)");
    for (const way of ["cpu", "here"]) {
      await page.evaluate((h) => { location.hash = h; }, "#board-pick-" + box + "-" + way);
      try { await page.locator("#screen-board-pick").waitFor({ state: "visible", timeout: 3000 }); } catch (e) { dead.push(box + " (no " + way + " pick)"); }
    }
  }
  assert.deepEqual(dead, [], "a box on the shelf that does not open");
});

test("🎲 EVERY box carries on: played a while, the page RELOADED, and ▶ carry on brings back the very same game, still playable (derived from the shelf)", async () => {
  // Moon Race's carry-on is tested above; each newer game keeps its own
  // fields (a hand, a pond, a held flower, covered squares, a train) and the
  // engine's restore refuses any it could not have written — so a field the
  // save forgot would drop his game silently, which only a reload can show.
  await quick();
  const errors = [];
  const onErr = (e) => errors.push(String(e));
  page.on("pageerror", onErr);
  try {
    const boxes = await page.evaluate(() => window.BoardData.BOXES.map((b) => b.id));
    const lost = [];
    // (every box unlocked, derived: a box that waits for another — Comet
    // Moon, Moon Call, Hop by Fives, Sum Bingo — has no who screen until then)
    const open = await page.evaluate(() => Object.fromEntries(window.BoardData.BOXES.filter((b) => b.unlockAfter).map((b) => [b.unlockAfter.box, b.unlockAfter.games])));
    for (const box of boxes) {
      await page.evaluate((d) => window.__BOARD.reset({ introSeen: true, done: d }), open);
      await startGame(box, "raegar", true, 11, 0);
      for (let k = 0; k < 8; k++) {
        await page.evaluate((n) => {
          const st = window.__BOARD.state();
          if (!st || st.phase === "done" || window.__BOARD.busy()) return;
          const live = [...document.querySelectorAll("#screen-board-play .bn-field button:not([disabled]), #screen-board-play .bn-choose button")].filter((x) => x.offsetParent);
          const b = live.length && st.phase !== "roll" ? live[(n * 5) % live.length] : document.querySelector("#screen-board-play .bn-pad--0");
          if (b) b.click();
        }, k);
        await page.waitForTimeout(150);
      }
      await page.waitForFunction(() => !window.__BOARD.busy(), null, { timeout: 10000 });
      if ((await st()).phase === "done") continue;
      const kept = await page.evaluate(() => JSON.stringify(window.BoardLogic.snapshot(window.__BOARD.state())));
      await page.reload({ waitUntil: "load" });
      await go("#board-who-" + box, "#screen-board-who");
      if (!(await page.locator("#screen-board-who .bn-keep").isVisible())) { lost.push(box + " (no carry-on card)"); continue; }
      await page.locator("#screen-board-who .bn-keep").click();
      await page.locator("#screen-board-play").waitFor({ state: "visible" });
      const back = await page.evaluate(() => JSON.stringify(window.BoardLogic.snapshot(window.__BOARD.state())));
      if (back !== kept) lost.push(box + " (a different game came back)");
      const live = await page.evaluate(() => [...document.querySelectorAll("#screen-board-play .bn-field button, #screen-board-play .bn-pad")].filter((x) => x.offsetParent).length);
      if (!live) lost.push(box + " (nothing to tap)");
    }
    assert.deepEqual(lost, [], "a game that does not carry on");
    assert.deepEqual(errors, [], "no page errors");
  } finally { page.off("pageerror", onErr); await slow(); }
});

test("🎲 EVERY board says what it shows: no button and no picture on any box's play screen is nameless, fresh or mid-turn (derived from the shelf)", async () => {
  // The audit found a face inside four boards' strips (🔢 ⛄ 🚪 🐟) read out
  // as a nameless picture beside the name its container already gave, and Go
  // Fish's question bubble read as an emoji and a "?". A picture that repeats
  // a name is hidden; one that carries meaning is named.
  const bad = [];
  const scan = async (label) => {
    await page.waitForTimeout(250);
    const lines = (await page.locator("#screen-board-play").ariaSnapshot()).split("\n").map((l) => l.trim());
    const nameless = lines.filter((l) => /^- (button|img)(:)?$/.test(l) || /^- (button|img) ""/.test(l));
    if (nameless.length) bad.push(label + ": " + nameless.length + " nameless");
  };
  const boxes = await page.evaluate(() => window.BoardData.BOXES.map((b) => b.id));
  for (const box of boxes) {
    await page.evaluate((x) => { window.__BOARD.reset({ introSeen: true, done: { moon: 2 } }); window.__BOARD.start(x, "river", true, 3, 0); }, box);
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    await scan(box);
  }
  for (const [box, drive] of BOARD_MIDTURN) {
    const ok = await page.evaluate((a) => {
      window.__BOARD.reset({ introSeen: true });
      const L = window.BoardLogic;
      const st = L.create({ board: a[0], seats: [{ who: "josh" }, { who: "river", cpu: true }], seed: 5, first: a[0] === "gofish" ? 1 : 0 });
      if (!(0, eval)("(" + a[1] + ")")(L, st)) return false;
      return window.__BOARD.load(a[0], st);
    }, [box, drive.toString()]);
    assert.ok(ok, `fixture: ${box} reached its mid-turn state`);
    await scan(box + " mid-turn");
  }
  assert.deepEqual(bad, [], "a board that shows something it does not name");
});

// A computer turn can come back HALF DONE: the iPad slept, he went 🏠 and
// back, or the page reloaded after the computer took its food (🧺), flipped
// its card (👀) or held its first flower (🍯) but before it answered. Starting
// the turn again did nothing in that phase, so the game waited for ever and
// his taps only wiggled (found by a random-tapping monkey). The states come
// from the ENGINE, every phase a computer turn passes through on every box,
// so a new box (or a new phase) is covered the day it lands.
test("a computer turn that comes back HALF DONE carries on, on EVERY box", async () => {
  const D = require("../scripts/board-data.js");
  // a computer's turn where the NEXT move is his (the friend asked; he answers)
  const HIS = { gofish: ["answer"] };
  const ACTS = ["roll", "hop", "drawCard", "spin", "pick", "spinHen", "henHop", "takeFood", "giveFood", "flipSpot", "findSpot", "peekPair", "shutDoor", "digAt", "takeCookies", "dropLine", "playCard", "grabColour", "chooseDie", "moveMouse", "askHide", "pickCar", "hiloGuess", "tenPick", "askFish", "answerFish", "buildSnow", "coverBingo", "playMatch", "flipMatch", "rollMatch", "holdDie", "layTile", "drawTile", "sowPot"];
  let r = 99;
  const rnd = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648; };
  const states = [], usedHis = new Set();
  for (const b of D.BOXES) {
    const seen = {};
    for (let g = 0; g < 6; g++) {
      const st = L.create({ board: b.board, seats: [{ who: "josh" }, { who: "river", cpu: true }], seed: 40 + g, first: g % 2 });
      for (let s = 0; s < 400 && st.phase !== "done"; s++) {
        // single moves (any argument), so a turn is caught between its steps
        L[ACTS[Math.floor(rnd() * ACTS.length)]](st, Math.floor(rnd() * 12), Math.floor(rnd() * 3));
        if (st.phase === "done" || !st.seats[st.turn].cpu) continue;
        const k = st.phase + (st.held != null && st.held !== -1 ? "/held" : "");
        if ((HIS[b.id] || []).indexOf(st.phase) >= 0) { usedHis.add(b.id + ":" + st.phase); continue; }
        if (!seen[k]) { seen[k] = true; states.push([b.id, k, L.snapshot(st)]); }
      }
    }
  }
  assert.ok(states.length >= 40, `fixture: only ${states.length} half-done computer turns found`);
  const none = D.BOXES.map((b) => b.id).filter((id) => !states.some(([b]) => b === id));
  assert.deepEqual(none, [], "fixture: boxes whose computer turn was never caught");
  assert.deepEqual([...usedHis].sort(), Object.keys(HIS).flatMap((b) => HIS[b].map((p) => b + ":" + p)).sort(), "an exemption no state reaches — drop it");
  for (const [p, k0] of [["lotto", "give"], ["spot", "find"], ["honeyten", "pick/held"]]) assert.ok(states.some(([b, k]) => b === p && k === k0), `fixture: no half-done ${p} turn (${k0}) was found`);
  await quick();
  const stuck = [];
  for (const [box, k, snap] of states) {
    await page.evaluate(() => { location.hash = "#__x"; });
    const ok = await page.evaluate((a) => window.__BOARD.load(a[0], a[1]), [box, snap]);
    assert.ok(ok, `${box} ${k}: a state the engine made must load`);
    await page.locator("#screen-board-play").waitFor({ state: "visible" });
    const j = JSON.stringify(snap);
    const moved = await page.waitForFunction((j0) => { const s = window.__BOARD.state(); return s && JSON.stringify(s) !== j0; }, j, { timeout: 4000 }).then(() => true, () => false);
    if (!moved) stuck.push(box + " " + k);
  }
  assert.deepEqual(stuck, [], "a computer turn that came back half done never moved on:\n" + stuck.join("\n"));
  assert.deepEqual(pageErrors, [], "no page errors");
});
