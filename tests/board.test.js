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
const { startServer, launchBrowser } = require("./helpers");
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

test("the shelf: two shelves (🎲 lucky, 🧠 thinking); Moon Race and Rainbow Trail first; Comet Moon arrives after TWO finished Moon games, never as a padlock", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await go("#board-home", "#screen-board-home");
  const boxes = () => page.evaluate(() => [...document.querySelectorAll("#screen-board-home .bn-box")].map((b) => b.dataset.box));
  const kinds = () => page.evaluate(() => [...document.querySelectorAll("#screen-board-home .bn-boxes")].map((l) => [l.dataset.kind, [...l.querySelectorAll(".bn-box")].map((b) => b.dataset.box)]));
  // what the shelf should hold, from the data: the lucky boxes, then the
  // thinking ones, each in its data order, Comet Moon only once unlocked
  const want = (comet) => page.evaluate((c) => {
    const ok = window.BoardData.BOXES.filter((b) => !b.unlockAfter || c);
    return ok.filter((b) => (b.kind || "luck") === "luck").concat(ok.filter((b) => b.kind === "think")).map((b) => b.id);
  }, comet);
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
  assert.deepEqual(await won(), { moon: "🏆 3", comet: null, rainbow: null, apple: null, hundred: null, hen: null, lotto: null, spot: null, pairs: null, doors: null, acorns: null, dominoes: null, dig: null }, "three Moon games: 🏆 3; the rest none yet");
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
  // Josh on 15, a 2 to roll: he lands on 17, a comet's head (17 → 12)
  const s = L.create({ board: "comet", seats: [{ who: "josh" }, { who: "viraj", cpu: true }], seed: 3, first: 0 });
  s.seats[0].pos = 15; s.seats[0].bag = [2];
  assert.equal(L.jumpAt(require("../scripts/board-data.js").board("comet"), 17).kind, "comet", "fixture: 17 is a comet's head");
  assert.ok(await page.evaluate((x) => window.__BOARD.load("comet", x), s), "fixture: loads");
  await page.locator("#screen-board-play").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  await page.locator(".bn-pad--0").click();
  await page.waitForFunction(() => window.__BOARD.state().phase === "hop" && !window.__BOARD.busy(), null, { timeout: 6000 });
  for (let k = 0; k < 2; k++) { await page.locator(".bn-pad--0").click(); await page.waitForTimeout(320); }
  await page.waitForFunction(() => document.querySelector(".bn-token--0").classList.contains("bn-token--ride"), null, { timeout: 4000 });
  assert.equal(await page.evaluate(() => document.querySelector(".bn-pad--1").classList.contains("bn-pad--cheer")), true, "Viraj cheers him on");
  await page.waitForFunction(() => document.querySelector(".bn-token--0").dataset.pos === "12", null, { timeout: 4000 });
  await page.waitForFunction(() => { const p = document.querySelector(".bn-pop"); return !p.hidden && p.textContent === "⭐"; }, null, { timeout: 4000 });
  const x = await st();
  assert.equal(x.seats[0].pos, 12, "the comet slid him down to 12 — one row, no further");
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
  assert.equal(await page.locator(".bn-doors__other .bn-mini").count(), 6, "his friend's six doors, small, above");
  let twos = 0, missed = 0, echoed = false, hinted = false;
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
      await page.locator('.bn-doors__grid button.bn-door[data-n="' + w[1] + '"]').click();
      twos++;
    }
    await page.waitForFunction((n) => window.__BOARD.state().rolls === n && window.__BOARD.state().phase !== "shut", s.rolls, { timeout: 4000 });
  }
  const end = await st();
  assert.equal(end.phase, "done", "the game ends");
  assert.ok(end.seats.every((x) => x.shut.length === 6), "every door of both players shut");
  assert.ok(twos >= 1 && hinted && echoed, `fixture: two-door shuts, the hint and the echo all ran (${twos})`);
  await page.locator(".bn-party").waitFor({ state: "visible" });
  assert.equal((await page.evaluate(() => window.__BOARD.save())).done.doors, 1, "a finished Shut the Doors counts once");
  } finally { await slow(); }
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

test("no uncaught page errors in Game Night", () => {
  assert.deepEqual(pageErrors, []);
});
