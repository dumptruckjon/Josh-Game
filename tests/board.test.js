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
  await page.evaluate(() => Object.assign(window.__BOARD.T, { tumble: 60, hop: 30, autoHop: 40, cpuThink: 40, cpuHop: 30, ride: 40, card: 30, glide: 20, handoff: 40 }));
}
async function slow() {
  await page.evaluate(() => Object.assign(window.__BOARD.T, { tumble: 700, hop: 240, autoHop: 480, cpuThink: 900, cpuHop: 560, ride: 900, card: 520, glide: 300, handoff: 700 }));
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

test("the shelf: Moon Race and Rainbow Trail first; Comet Moon arrives after TWO finished Moon games, never as a padlock", async () => {
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true }));
  await go("#board-home", "#screen-board-home");
  const boxes = () => page.evaluate(() => [...document.querySelectorAll("#screen-board-home .bn-box")].map((b) => b.dataset.box));
  assert.deepEqual(await boxes(), ["moon", "rainbow"], "a fresh shelf: two boxes, no locked third");
  assert.equal(await page.locator("#screen-board-home [aria-disabled], #screen-board-home .bn-box[disabled]").count(), 0, "nothing on the shelf is locked or greyed");
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true, done: { moon: 1 } }));
  await go("#board-home", "#screen-board-home");
  assert.deepEqual(await boxes(), ["moon", "rainbow"], "one Moon game is not enough");
  await page.evaluate(() => window.__BOARD.reset({ introSeen: true, done: { moon: 2 } }));
  await go("#board-home", "#screen-board-home");
  assert.deepEqual(await boxes(), ["moon", "comet", "rainbow"], "after two, Comet Moon is on the shelf, beside Moon Race");
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

test("no uncaught page errors in Game Night", () => {
  assert.deepEqual(pageErrors, []);
});
