// 🔍 Seek & Find — browser tests (Chromium; mobile.test.js runs it on the
// iPhone 17 Pro geometry and on real WebKit in CI). They drive the REAL
// screens with REAL taps at screen coordinates, because a tap here is judged by
// GEOMETRY over the things' round bodies (SeekLogic.hitTest) — a test that
// called a function could not see that judgement break. The layout's fairness
// is proven headless in seek-logic.test.js; window.__SEEK (the __HOLE /
// __BOARD precedent) only tells a test WHERE a thing is, so it can tap it.

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { startServer, launchBrowser } = require("./helpers");

let server, browser, context, page, baseURL;
const pageErrors = [];
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

before(async () => {
  ({ server, baseURL } = await startServer());
  browser = await launchBrowser();
  context = await browser.newContext({ viewport: { width: 402, height: 874 }, hasTouch: true, isMobile: true });
  page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  // every line the voice is handed, with sound on
  await page.addInitScript(() => {
    window.__said = [];
    try { localStorage.setItem("josh-muted", "0"); } catch (e) { /* ignore */ }
  });
  await page.goto(baseURL, { waitUntil: "load" });
});

// The voice spy: installed on the live JoshAudio, and again after a reload
// (a reload builds a new JoshAudio, and a spy that is quietly gone reads
// exactly like a feature that stopped speaking).
async function spy() {
  await page.evaluate(() => {
    const A = window.JoshAudio;
    if (A.__spied) return;
    const say = A.say;
    A.say = function (t, o) { window.__said.push(String(t)); return say.call(this, t, o); };
    A.__spied = true;
  });
}

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((r) => server.close(r));
});

async function go(hash, sel) {
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.locator(sel).waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(400);           // the echo guard: a child looks first
}
const run = () => page.evaluate(() => window.__SEEK.run());
const items = () => page.evaluate(() => window.__SEEK.items());

// Tap item i like a finger: bring it into view, then click on a point of its
// body that shows (for a peeking buddy, its top — the part out from behind).
async function tapItem(i, where) {
  await page.evaluate((k) => window.__SEEK.reveal(k), i);
  await page.waitForTimeout(80);
  const p = await page.evaluate((k) => {
    const el = document.querySelector('.seek-it[data-i="' + k + '"]');
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height };
  }, i);
  const y = where === "top" ? p.y - p.h * 0.28 : p.y;
  await page.mouse.click(p.x, y);
  await page.waitForTimeout(400);           // past the echo window: a new tap
}

async function freshPlace(id) {
  await spy();
  await page.evaluate(() => window.__SEEK.reset());
  await go("#seek-home", "#screen-seek-home");
  await page.locator('.seek-door[data-place="' + id + '"]').click();
  await page.locator("#screen-seek-play").waitFor({ state: "visible" });
  await page.waitForFunction((p) => { const r = window.__SEEK.run(); return r && r.place === p; }, id);
  await page.waitForTimeout(400);
}

test("the front door's SIXTH door opens Seek & Find, with a door per place, and 🚪 comes back", async () => {
  await page.evaluate(() => { location.hash = ""; });
  await page.locator("#screen-start").waitFor({ state: "visible" });
  const order = await page.evaluate(() => [...document.querySelectorAll(".start-tile")].map((t) => t.id));
  assert.equal(order.indexOf("start-seek"), order.indexOf("start-board") + 1, "Seek & Find comes right after Game Night");
  assert.equal(await page.locator("#start-seek .start-tile__art img").count(), 1, "the door wears the world's Noto magnifying glass");
  await page.waitForTimeout(400);
  await page.locator("#start-seek").click();
  await page.locator("#screen-seek-home").waitFor({ state: "visible" });
  assert.ok(await page.evaluate(() => document.body.classList.contains("seek-mode")), "the world's theme is on");
  const places = await page.evaluate(() => window.SeekData.PLACES.map((p) => p.id));
  assert.equal(await page.locator(".seek-door").count(), places.length, "one door per place");
  const imgs = await page.evaluate(() => [...document.querySelectorAll(".seek-door img")].map((i) => i.complete && i.naturalWidth > 0));
  assert.ok(imgs.length === places.length && imgs.every(Boolean), "every door's picture loads");
  await page.waitForTimeout(400);
  await page.locator(".seek-exit").click();
  await page.locator("#screen-start").waitFor({ state: "visible" });
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("seek-mode"))), "leaving drops the theme");
});

test("a whole picture, played by tapping: a wrong thing names itself and marks nothing, every find is marked on the picture AND its card, the counting card counts, the buddy peeking out is found by its top, and the party gives a ⭐", async () => {
  await freshPlace("park");
  await page.evaluate(() => { window.__said.length = 0; });
  const its = await items();
  const r0 = await run();
  assert.equal(r0.list.length, 4, "four things on the list");
  assert.equal(await page.locator(".seek-card").count(), 4, "a card for each");

  // a wrong tap: a filler nobody asked for
  const wrong = its.findIndex((it) => it.role === "fill" && !window_unlisted(r0, it));
  await tapItem(wrong);
  let r = await run();
  assert.equal(r.found.length, 0, "a wrong tap marks nothing");
  const said = await page.evaluate(() => window.__said.slice());
  assert.ok(said.some((s) => /^That's an? /.test(s)), "…and the thing says what it is: " + said.join(" | "));
  assert.ok(await page.locator('.seek-it[data-i="' + wrong + '"].seek-it--wig').count() === 1, "…and wiggles (no buzz, no fail)");

  // every find
  const counted = r0.list.find((e) => e.n > 1);
  for (let i = 0; i < its.length; i++) {
    const it = its[i];
    if (it.role === "find") await tapItem(i);
    if (it.role === "find" && it.kind === counted.kind) {
      const c = await page.evaluate((k) => {
        const li = window.__SEEK.run().list.findIndex((e) => e.kind === k);
        return document.querySelectorAll(".seek-card")[li].querySelector(".seek-card__count").textContent;
      }, counted.kind);
      assert.match(c, /^\d+\/\d+$/, "the counting card shows how many of how many");
    }
  }
  r = await run();
  for (const e of r.list) if (e.kind !== "buddy") assert.ok(e.done, e.kind + " found");
  assert.equal(await page.locator(".seek-it--found").count(), its.filter((it) => it.role === "find").length, "every find wears the found ring");
  assert.equal(await page.locator(".seek-win").isHidden(), true, "no party before the buddy is found");

  const b = its.findIndex((it) => it.role === "buddy");
  await tapItem(b, "top");
  await page.locator(".seek-win").waitFor({ state: "visible", timeout: 4000 });
  r = await run();
  assert.ok(r.list.every((e) => e.done), "the whole list is done");
  assert.equal(await page.locator(".seek-card--done").count(), 4, "every card is ticked");
  const save = await page.evaluate(() => window.__SEEK.save());
  assert.equal(save.stars.park, 1, "a ⭐ for the park");
  assert.ok(!save.runs.park, "a finished picture is not parked");
  const words = await page.evaluate(() => window.__said.slice());
  assert.ok(words.some((s) => /^You found the /.test(s)), "a find is said");
  assert.ok(words.some((s) => s === "You found everything!"), "the party is said");
  assert.ok(words.every((s) => !EMOJI.test(s)), "no line reads a picture: " + words.filter((s) => EMOJI.test(s)).join(" | "));
  // the party's buttons are on screen with no scrolling
  for (const sel of [".seek-again", ".seek-next"]) {
    const box = await page.locator(sel).boundingBox();
    assert.ok(box && box.width >= 75 && box.height >= 75 && box.y + box.height <= 874, sel + " is big and on screen");
  }
  // ▶ goes to the next place without a ⭐
  await page.waitForTimeout(400);
  await page.locator(".seek-next").click();
  await page.waitForFunction(() => { const r = window.__SEEK.run(); return r && r.place !== "park"; });
  assert.equal((await run()).place, "beach", "▶ opens the next place");
  await go("#seek-home", "#screen-seek-home");
  assert.match(await page.locator('.seek-door[data-place="park"] .seek-door__stars').textContent(), /⭐ 1/, "the park's door wears its ⭐");
  assert.equal(pageErrors.length, 0, pageErrors.join(" | "));
});

function window_unlisted(r, it) { return r.list.some((e) => e.kind === it.kind); }

test("a double tap is ONE tap: the echo of a wrong tap does not name the thing twice, and a find is never counted twice", async () => {
  // (A find cannot count twice anyway — each one is marked once, by the found
  // set — so the clause that needs the ECHO guard is the wrong tap: without it
  // the second tap of a double tap says "That's a goat." over the first.)
  await freshPlace("beach");
  await spy();
  const r0 = await run();
  const its = await items();
  const dbl = async (i) => {
    await page.evaluate((k) => window.__SEEK.reveal(k), i);
    await page.waitForTimeout(80);
    const p = await page.evaluate((k) => { const r = document.querySelector('.seek-it[data-i="' + k + '"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(120);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(300);
  };
  const wrong = its.findIndex((it) => it.role === "fill" && !r0.list.some((e) => e.kind === it.kind));
  await page.evaluate(() => { window.__said.length = 0; });
  await dbl(wrong);
  const named = (await page.evaluate(() => window.__said.slice())).filter((s) => /^That's /.test(s));
  assert.equal(named.length, 1, "a double tap names the thing once: " + named.join(" | "));
  const counted = r0.list.find((e) => e.n > 1);
  const i = its.findIndex((it) => it.role === "find" && it.kind === counted.kind);
  await dbl(i);
  const e = (await run()).list.find((x) => x.kind === counted.kind);
  assert.equal(e.got, 1, "one find, one count");
});

test("leaving mid-picture keeps what he found: the same picture comes back with the same finds marked", async () => {
  await freshPlace("farm");
  const its = await items();
  const i = its.findIndex((it) => it.role === "find");
  await tapItem(i);
  const before = await run();
  assert.equal(before.found.length, 1);
  await go("#seek-home", "#screen-seek-home");
  await page.reload({ waitUntil: "load" });
  await go("#seek-home", "#screen-seek-home");
  await page.locator('.seek-door[data-place="farm"]').click();
  await page.waitForFunction(() => { const r = window.__SEEK.run(); return r && r.place === "farm"; });
  const after = await run();
  assert.equal(after.seed, before.seed, "the same picture");
  assert.deepEqual(after.found, before.found, "the same finds");
  assert.equal(await page.locator(".seek-it--found").count(), 1, "…marked on the picture");
});

test("a list card says what to find; only after he has looked a while does it also SHOW where (a quiet hint, never a countdown)", async () => {
  await freshPlace("zoo");
  await page.evaluate(() => { window.__said.length = 0; });
  const view = page.locator(".seek-view");
  await page.locator(".seek-card").first().click();
  await page.waitForTimeout(500);
  assert.equal(await page.locator(".seek-it--hint").count(), 0, "a quick tap on the card does not give the answer away");
  const said = await page.evaluate(() => window.__said.slice());
  assert.ok(said.some((s) => /^Can you find /.test(s)), "…it says what to find: " + said.join(" | "));
  const top0 = await view.evaluate((v) => v.scrollTop);
  await page.evaluate(() => window.__SEEK.ageHint());
  // the last card is the buddy: it hides lowest or highest, so scrolling shows
  await page.locator(".seek-card").nth(3).click();
  await page.waitForTimeout(900);
  assert.equal(await page.locator(".seek-it--hint").count(), 1, "after a long look, the card shows where one is");
  const hinted = await page.evaluate(() => {
    const el = document.querySelector(".seek-it--hint"), v = document.querySelector(".seek-view");
    const a = el.getBoundingClientRect(), b = v.getBoundingClientRect();
    return a.bottom > b.top && a.top < b.bottom;
  });
  assert.ok(hinted, "…and scrolls it into view");
  assert.ok(top0 >= 0);
});

test("every place opens, draws its ground and every picture in it loads", async () => {
  const places = await page.evaluate(() => window.SeekData.PLACES.map((p) => p.id));
  for (const id of places) {
    await page.evaluate((p) => window.__SEEK.start(p, { fresh: true }), id);
    await page.waitForTimeout(200);
    const m = await page.evaluate(() => ({
      ground: !!document.querySelector(".seek-ground svg"),
      n: document.querySelectorAll(".seek-it").length,
      broken: [...document.querySelectorAll(".seek-it img, .seek-card img")].filter((i) => !(i.complete && i.naturalWidth > 0)).length,
      sceneH: document.querySelector(".seek-scene").getBoundingClientRect().height,
      sceneW: document.querySelector(".seek-scene").getBoundingClientRect().width,
    }));
    assert.ok(m.ground, id + ": the ground is drawn");
    assert.ok(m.n > 50, id + ": a busy picture (" + m.n + ")");
    assert.equal(m.broken, 0, id + ": every picture loads");
    const P = await page.evaluate((p) => window.SeekData.PLACES.find((x) => x.id === p).h / window.SeekData.W, id);
    assert.ok(Math.abs(m.sceneH / m.sceneW - P) < 0.01, id + ": the picture keeps its shape (" + (m.sceneH / m.sceneW).toFixed(3) + ")");
  }
  assert.equal(pageErrors.length, 0, pageErrors.join(" | "));
});

test("leaving the world stops it: no timer outlives the screen, and the page never scrolls behind the picture", async () => {
  await freshPlace("space");
  const sc = await page.evaluate(() => ({ doc: document.documentElement.scrollHeight, vh: innerHeight }));
  assert.ok(sc.doc <= sc.vh + 1, "only the picture scrolls, never the page (" + sc.doc + " in " + sc.vh + ")");
  await page.evaluate(() => { location.hash = "#home"; });
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__SEEK.timers()), 0, "no timer left running");
  assert.equal(await page.evaluate(() => window.__SEEK.run()), null, "nothing reports a picture on screen");
});

test("the fun layer: 🎲 Surprise opens a place he has not finished, a find FLIES to its card, the buddy says peekaboo, the picture moves (and is still under reduced motion), and 📒 My Finds collects every thing he has found", async () => {
  await freshPlace("sea");
  // the living picture: what swims sways, what flies floats
  const live = await page.evaluate(() => {
    const sw = document.querySelector(".seek-it--swim"), fl = document.querySelector(".seek-it--float");
    return { swim: !!sw && getComputedStyle(sw).animationName, float: !!fl && getComputedStyle(fl).animationName };
  });
  assert.equal(live.swim, "seekSwim", "a fish sways");
  const its = await items();
  const r0 = await run();
  // a find flies to its card, and the flight is gone after
  const i = its.findIndex((it) => it.role === "find");
  await tapItem(i);
  // tapItem waits 400ms: the flight (650ms) is still up or just gone; check it was made
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.__SEEK.flying()), 0, "the flight lands and is cleared");
  const kind = its[i].kind;
  let sv = await page.evaluate(() => window.__SEEK.save());
  assert.ok(sv.seen[kind] >= 1, "the find goes into the album (" + kind + ")");
  // leaving mid-flight leaves nothing hanging over the next screen
  const j = its.findIndex((it, k) => k !== i && it.role === "find" && it.kind !== kind);
  await page.evaluate((k) => window.__SEEK.reveal(k), j);
  await page.waitForTimeout(80);
  await page.evaluate((k) => window.__SEEK.markForTest(k), j);
  assert.equal(await page.evaluate(() => window.__SEEK.flying()), 1, "a find makes one flight");
  await page.evaluate(() => { location.hash = "#seek-home"; });
  await page.locator("#screen-seek-home").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => window.__SEEK.flying()), 0, "leaving clears a flight still in the air");
  // the buddy: peekaboo
  await page.waitForTimeout(400);           // the echo guard: a child looks first
  await page.locator('.seek-door[data-place="sea"]').click();
  await page.waitForFunction(() => { const r = window.__SEEK.run(); return r && r.place === "sea"; });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__said.length = 0; });
  const b = (await items()).findIndex((it) => it.role === "buddy");
  await tapItem(b, "top");
  const said = await page.evaluate(() => window.__said.slice());
  assert.ok(said.some((x) => /^Peekaboo! You found /.test(x)), "the buddy says peekaboo: " + said.join(" | "));
  // 📒 My Finds: found stickers are full, the rest ghosts that say where to look
  await go("#seek-home", "#screen-seek-home");
  const total = await page.evaluate(() => window.__SEEK.albumKinds().length);
  assert.ok(total >= 150, "a big collection (" + total + ")");
  assert.match(await page.locator(".seek-albumcount").textContent(), new RegExp("^2/" + total + "$"), "the home counts what he has found");
  await page.locator(".seek-albumbtn").click();
  await page.locator("#screen-seek-album").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  assert.equal(await page.locator(".seek-albumsec").count(), await page.evaluate(() => SeekData.PLACES.length), "a section per place");
  sv = await page.evaluate(() => window.__SEEK.save());
  const got = await page.evaluate(() => [...new Set([...document.querySelectorAll(".seek-sticker--got")].map((b) => b.dataset.kind))].sort());
  assert.deepEqual(got, Object.keys(sv.seen).filter((k) => sv.seen[k] > 0).sort(), "a full sticker exactly for each thing found");
  const ghost = page.locator(".seek-sticker:not(.seek-sticker--got)").first();
  assert.ok(Number(await ghost.locator("img").evaluate((im) => getComputedStyle(im).opacity)) < 0.5, "the rest are ghosts");
  await page.evaluate(() => { window.__said.length = 0; });
  await ghost.click();
  await page.waitForTimeout(200);
  assert.ok((await page.evaluate(() => window.__said.slice())).some((x) => /^Not found yet\. Look in /.test(x)), "a ghost says where to look");
  // 🎲 Surprise: a place without a ⭐
  await page.evaluate(() => { const s = window.__SEEK; s.reset(); });
  await go("#seek-home", "#screen-seek-home");
  const picks = new Set();
  for (let k = 0; k < 12; k++) picks.add(await page.evaluate(() => window.__SEEK.surprise()));
  assert.ok(picks.size > 1, "a surprise is not always the same place");
  await page.locator(".seek-surprise").click();
  await page.locator("#screen-seek-play").waitFor({ state: "visible" });
  await page.waitForFunction(() => !!window.__SEEK.run());
  assert.ok((await page.evaluate(() => SeekData.PLACES.map((p) => p.id))).includes((await run()).place), "…and it opens a picture");
  assert.equal(pageErrors.length, 0, pageErrors.join(" | "));
});

test("TRICKY pictures for the child who is good at this: from a place's fourth picture the list shows SHADOWS (each turns to colour when found), and from the fifth LOOK-ALIKES crowd round the finds — a look-alike names itself and marks nothing, and a win says the next picture is trickier", async () => {
  // level 3: shadows
  await spy();
  await page.evaluate(() => window.__SEEK.reset());
  await page.evaluate(() => window.__SEEK.setStars("zoo", 3));
  await go("#seek-home", "#screen-seek-home");
  await page.evaluate(() => { window.__said.length = 0; });
  await page.locator('.seek-door[data-place="zoo"]').click();
  await page.waitForFunction(() => { const r = window.__SEEK.run(); return r && r.place === "zoo"; });
  await page.waitForTimeout(700);
  let r = await run();
  assert.equal(r.level, 3, "three ⭐ make the fourth level");
  const cards = await page.evaluate(() => [...document.querySelectorAll(".seek-card")].map((c, i) => ({
    shadow: c.classList.contains("seek-card--shadow"),
    filter: getComputedStyle(c.querySelector(".seek-card__pic")).filter,
    buddy: !!c.querySelector(".seek-card__buddy"),
  })));
  for (const c of cards) {
    if (c.buddy) assert.ok(!c.shadow, "the buddy is never a shadow: it is his friend");
    else assert.ok(c.shadow && /brightness\(0\)/.test(c.filter), "a thing to find is shown as its shadow (" + c.filter + ")");
  }
  let said = await page.evaluate(() => window.__said.slice());
  const si = said.indexOf("Tricky! Find the shadows!");
  assert.ok(si >= 0 && said.slice(si + 1).some((s) => /^Can you find /.test(s)), "the shadows are announced, then the list: " + said.join(" | "));
  // a find turns its card to colour
  const its = await items();
  const f = its.findIndex((it) => it.role === "find" && r.list.find((e) => e.kind === it.kind && e.n === 1));
  await tapItem(f);
  const li = r.list.findIndex((e) => e.kind === its[f].kind);
  assert.ok(!(await page.evaluate((k) => document.querySelectorAll(".seek-card")[k].classList.contains("seek-card--shadow"), li)), "a found thing's card shows its colours again");
  // finish it: the win says the next one is trickier
  await page.evaluate(() => { window.__said.length = 0; });
  r = await run();
  const all = await items();
  for (let i = 0; i < all.length; i++) {
    if ((all[i].role === "find" || all[i].role === "buddy") && r.found.indexOf(i) < 0) await page.evaluate((k) => window.__SEEK.markForTest(k), i);
  }
  await page.locator(".seek-win").waitFor({ state: "visible", timeout: 4000 });
  said = await page.evaluate(() => window.__said.slice());
  assert.ok(said.indexOf("Next time, a trickier picture!") > said.indexOf("You found everything!"), "the party says the next picture is trickier: " + said.join(" | "));

  // level 4: look-alikes (stars now 4)
  await page.waitForTimeout(400);
  await page.locator(".seek-again").click();
  await page.waitForFunction(() => { const r = window.__SEEK.run(); return r && r.level === 4; });
  await page.waitForTimeout(400);
  r = await run();
  const four = await items();
  const likes = four.map((it, i) => ({ it, i })).filter((x) => x.it.like);
  assert.ok(likes.length >= 2, "look-alikes crowd round the finds (" + likes.length + ")");
  const groups = new Set(r.list.map((e) => window_group(e.kind)));
  for (const x of likes) assert.ok(!groups.has(window_group(x.it.kind)), x.it.kind + " is not of a group the list asks for");
  await page.evaluate(() => { window.__said.length = 0; });
  await tapItem(likes[0].i);
  assert.equal((await run()).found.length, 0, "a look-alike marks nothing");
  said = await page.evaluate(() => window.__said.slice());
  assert.ok(said.some((s) => /^That's an? /.test(s)), "…and says what it is: " + said.join(" | "));
  assert.equal(pageErrors.length, 0, pageErrors.join(" | "));
});
function window_group(k) { const D = require("../scripts/seek-data.js"); return (D.KINDS[k] && D.KINDS[k].group) || k; }

test("reduced motion: the picture holds still and nothing flies", async () => {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  try {
    await p.goto(baseURL + "#seek-home", { waitUntil: "load" });
    await p.evaluate(() => { window.__SEEK.reset(); location.hash = "#seek-play"; window.__SEEK.start("sea", {}); });
    await p.locator("#screen-seek-play").waitFor({ state: "visible" });
    const names = await p.evaluate(() => [...document.querySelectorAll(".seek-it--swim, .seek-it--float")].map((e) => getComputedStyle(e).animationName));
    assert.ok(names.length > 3 && names.every((n) => n === "none"), "nothing sways: " + names.join(","));
    const i = (await p.evaluate(() => window.__SEEK.items())).findIndex((it) => it.role === "find");
    await p.evaluate((k) => window.__SEEK.markForTest(k), i);
    assert.equal(await p.evaluate(() => window.__SEEK.flying()), 0, "nothing flies");
  } finally { await ctx.close(); }
});

// ---- Clues, stories, hiding inside, and the flashlight (the owner's picks,
// 2026-11-25: "1, 2, 3, 4, 6. Go") --------------------------------------------

// A picture of `id` on `level` with what `want` asks for (a clue, something
// hidden inside): new pictures until one has it (each is a new seed).
async function pictureWith(id, level, want) {
  await spy();
  await page.evaluate(() => window.__SEEK.reset());
  await go("#seek-home", "#screen-seek-home");
  await page.evaluate(() => { location.hash = "#seek-play"; });
  await page.locator("#screen-seek-play").waitFor({ state: "visible" });
  for (let k = 0; k < 30; k++) {
    const ok = await page.evaluate(([p, lv, w]) => {
      window.__SEEK.setStars(p, lv);
      window.__SEEK.start(p, { story: false });
      const r = window.__SEEK.run();
      const its = window.__SEEK.items();
      return (!w.clue || r.list.some((e) => e.clue && e.clue.type !== "colour")) && (!w.inside || its.some((it) => it.holds));
    }, [id, level, want]);
    if (ok) { await page.waitForTimeout(500); return; }
  }
  throw new Error("no picture of " + id + " with " + JSON.stringify(want));
}

test("CLUE hunt: the card asks for ONE of three (the dog next to the bench) and shows its clue as a picture; a decoy says 'not that one' and marks nothing; the right one is found", async () => {
  await pictureWith("park", 2, { clue: true });
  const r = await run();
  const li = r.list.findIndex((e) => e.clue);
  const e = r.list[li];
  const its = await items();
  const decoys = its.map((it, i) => ({ it, i })).filter((x) => x.it.role === "decoy");
  const target = its.findIndex((it) => it.role === "find" && it.kind === e.kind);
  assert.ok(decoys.length >= 1 && target >= 0, "the one it asks for and the ones it does not");
  const card = await page.evaluate((k) => {
    const c = document.querySelectorAll(".seek-card")[k];
    const b = c.querySelector(".seek-card__clue");
    return { badge: !!b && b.getBoundingClientRect().width > 20, label: c.getAttribute("aria-label") };
  }, li);
  assert.ok(card.badge, "the clue is on the card as a picture, so it reads with the sound off");
  assert.ok(card.label.indexOf(e.clue.word) >= 0, "the card says the clue: " + card.label);
  await page.evaluate(() => { window.__said.length = 0; });
  await page.locator(".seek-hear").click();
  let said = await page.evaluate(() => window.__said.slice());
  assert.ok(said.some((s) => s.indexOf(e.clue.word) >= 0), "👂 says the clue: " + said.join(" | "));
  await page.evaluate(() => { window.__said.length = 0; });
  await tapItem(decoys[0].i);
  assert.equal((await run()).found.indexOf(decoys[0].i), -1, "a decoy marks nothing");
  said = await page.evaluate(() => window.__said.slice());
  assert.ok(said.some((s) => /^Not that one! Find the .+ (under|on|next to) the /.test(s)), "…and says which one to find: " + said.join(" | "));
  await tapItem(target);
  const after = await run();
  assert.ok(after.found.indexOf(target) >= 0 && after.list[li].done, "the one the clue picks out is found");
  assert.equal(pageErrors.length, 0, pageErrors.join(" | "));
});

test("HIDING INSIDE: scenery with something in it wiggles; the thing cannot be seen or tapped; a tap on the scenery shakes it and out pops the find. Any other scenery just shakes (a tree lets something fly out) and names itself", async () => {
  await pictureWith("park", 2, { inside: true });
  let its = await items();
  const box = its.findIndex((it) => it.holds);
  const hid = its.findIndex((it) => it.hidden);
  assert.ok(box >= 0 && hid >= 0, "a box and what hides in it");
  const st = await page.evaluate(([b, h]) => ({
    rumble: document.querySelector('.seek-it[data-i="' + b + '"]').classList.contains("seek-it--rumble"),
    anim: getComputedStyle(document.querySelector('.seek-it[data-i="' + b + '"] .seek-it__pic')).animationName,
    hidden: getComputedStyle(document.querySelector('.seek-it[data-i="' + h + '"]')).visibility,
  }), [box, hid]);
  assert.ok(st.rumble && st.anim === "seekRumble", "the box wiggles now and then (" + st.anim + ")");
  assert.equal(st.hidden, "hidden", "what is inside does not show");
  await page.evaluate(() => { window.__said.length = 0; });
  await tapItem(box);
  const r = await run();
  assert.ok(r.found.indexOf(hid) >= 0, "a tap on the box finds what was inside");
  const out = await page.evaluate((h) => getComputedStyle(document.querySelector('.seek-it[data-i="' + h + '"]')).visibility, hid);
  assert.equal(out, "visible", "…and it shows now");
  const said = await page.evaluate(() => window.__said.slice());
  assert.ok(said.some((s) => /^Look! The .+ was hiding in the /.test(s)), "…and says where it was: " + said.join(" | "));
  assert.ok(!(await page.evaluate((b) => document.querySelector('.seek-it[data-i="' + b + '"]').classList.contains("seek-it--rumble"), box)), "the box stops wiggling");
  // a tree that holds nothing: it shakes, something flies out, it names itself
  its = await items();
  const tree = its.findIndex((it, i) => it.role === "prop" && ["tree", "pine"].indexOf(it.kind) >= 0 && !it.holds && i !== box);
  await page.evaluate(() => { window.__said.length = 0; });
  await tapItem(tree);
  const shook = await page.evaluate(() => document.querySelectorAll(".seek-flyout").length);
  assert.ok(shook >= 1, "a shaken tree lets something fly out");
  const said2 = await page.evaluate(() => window.__said.slice());
  assert.ok(said2.some((s) => /^That's a (tree|pine tree)\.$/.test(s)), "…and says what it is: " + said2.join(" | "));
  assert.equal((await run()).found.length, 1, "shaking scenery finds nothing else");
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => document.querySelectorAll(".seek-flyout").length), 0, "what flew out is gone");
  assert.equal(pageErrors.length, 0, pageErrors.join(" | "));
});

test("a STORY picture: a friend's bubble shows what they lost, the cards after it stay a ? until it is found (a later thing says 'not yet'), and each find moves the story on", async () => {
  await spy();
  await page.evaluate(() => window.__SEEK.reset());
  await go("#seek-home", "#screen-seek-home");
  await page.evaluate(() => { location.hash = "#seek-play"; window.__said.length = 0; });
  await page.locator("#screen-seek-play").waitFor({ state: "visible" });
  await page.evaluate(() => window.__SEEK.start("park", { story: true }));
  await page.waitForTimeout(700);
  let r = await run();
  assert.ok(r.story && r.step === 0, "a story, on its first step");
  let said = await page.evaluate(() => window.__said.slice());
  assert.ok(said.some((s) => s.indexOf("Oh no! " + r.friend + " lost ") === 0), "the friend's story starts: " + said.join(" | "));
  const ui = await page.evaluate(() => ({
    bubble: !document.querySelector(".seek-bubble").hidden && document.querySelector(".seek-bubble").getBoundingClientRect().height >= 75,
    who: !!document.querySelector(".seek-bubble__who svg"),
    want: !!document.querySelector(".seek-bubble__say img, .seek-bubble__say svg"),
    cards: [...document.querySelectorAll(".seek-card")].map((c) => ({ now: c.classList.contains("seek-card--now"), locked: c.classList.contains("seek-card--locked"), q: getComputedStyle(c.querySelector(".seek-card__q")).display })),
  }));
  assert.ok(ui.bubble && ui.who && ui.want, "the bubble: the friend, and what they want");
  assert.ok(ui.cards[0].now && !ui.cards[0].locked, "the first card is the one asked for");
  for (const c of ui.cards.slice(1)) assert.ok(c.locked && c.q !== "none", "the later cards are a ?");
  // a later thing: not yet
  const its = await items();
  const later = its.findIndex((it) => it.role === "find" && it.kind === r.list[1].kind && !it.hidden);
  await page.evaluate(() => { window.__said.length = 0; });
  await tapItem(later);
  assert.equal((await run()).found.length, 0, "a thing further on in the story waits its turn");
  said = await page.evaluate(() => window.__said.slice());
  assert.ok(said.indexOf("Not yet! Find the one in the bubble first.") >= 0, "…and says so: " + said.join(" | "));
  // the first thing: found, and the story moves on
  const first = its.findIndex((it) => it.role === "find" && it.kind === r.list[0].kind && !it.hidden);
  await page.evaluate(() => { window.__said.length = 0; });
  await tapItem(first);
  await page.waitForTimeout(1300);
  r = await run();
  assert.equal(r.step, 1, "the story is on its second step");
  said = await page.evaluate(() => window.__said.slice());
  assert.ok(said.some((s) => s.indexOf("Thank you! Now " + r.friend + " needs ") === 0), "the friend asks for the next thing: " + said.join(" | "));
  const c1 = await page.evaluate(() => { const c = document.querySelectorAll(".seek-card")[1]; return { now: c.classList.contains("seek-card--now"), locked: c.classList.contains("seek-card--locked") }; });
  assert.ok(c1.now && !c1.locked, "its card is the one asked for now");
  // finish: the friend says thank you, and the bubble goes
  const all = await items();
  for (let k = 0; k < 4; k++) {
    const cur = await run();
    const st = cur.step;
    if (st < 0) break;
    const e = cur.list[st];
    for (let i = 0; i < all.length; i++) {
      const it = all[i];
      if (cur.found.indexOf(i) >= 0) continue;
      if ((e.kind === "buddy" && it.role === "buddy") || (it.role === "find" && it.kind === e.kind)) await page.evaluate((q) => window.__SEEK.markForTest(q), i);
    }
  }
  await page.locator(".seek-win").waitFor({ state: "visible", timeout: 4000 });
  said = await page.evaluate(() => window.__said.slice());
  assert.ok(said.some((s) => s === r.friend + " says thank you! You found everything!"), "the party is the friend's thanks: " + said.join(" | "));
  assert.ok(await page.evaluate(() => document.querySelector(".seek-bubble").hidden), "the bubble goes at the party");
  assert.equal(pageErrors.length, 0, pageErrors.join(" | "));
});

test("🔦 NIGHT HUNT: the home's flashlight opens a dark picture with a beam where the finger is; a tap anywhere is still judged; the party turns the lights on", async () => {
  await spy();
  await page.evaluate(() => window.__SEEK.reset());
  await go("#seek-home", "#screen-seek-home");
  await page.evaluate(() => { window.__said.length = 0; });
  await page.locator(".seek-nightbtn").click();
  await page.waitForFunction(() => { const r = window.__SEEK.run(); return r && r.night; });
  await page.waitForTimeout(700);
  const dark = await page.evaluate(() => {
    const d = document.querySelector(".seek-dark");
    const f = document.querySelector(".seek-field").getBoundingClientRect(), r = d.getBoundingClientRect();
    return { shown: !d.hidden, bg: d.style.background, cover: r.width >= f.width - 1 && r.height >= f.height - 1, pe: getComputedStyle(d).pointerEvents };
  });
  assert.ok(dark.shown && dark.cover && /radial-gradient/.test(dark.bg), "the picture is dark but for a beam");
  assert.equal(dark.pe, "none", "the dark takes no taps");
  let said = await page.evaluate(() => window.__said.slice());
  assert.ok(said.indexOf("It's dark! Move your finger to shine the flashlight!") >= 0, "it says how: " + said.join(" | "));
  // the beam follows a finger on the picture
  const f = await page.evaluate(() => { const r = document.querySelector(".seek-field").getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.touchscreen.tap(f.x + f.w * 0.25, f.y + f.h * 0.7);
  await page.waitForTimeout(200);
  const b = await page.evaluate(() => window.__SEEK.beam());
  assert.ok(Math.abs(b.x - f.w * 0.25) < 4 && Math.abs(b.y - f.h * 0.7) < 4, "the beam is where the finger was (" + JSON.stringify(b) + ")");
  // a find is found in the dark like in the day
  const its = await items();
  const r = await run();
  const one = its.findIndex((it) => it.role === "find" && !it.hidden && r.list.find((e) => e.kind === it.kind && !e.clue));
  await tapItem(one);
  assert.ok((await run()).found.indexOf(one) >= 0, "a tap in the dark finds it");
  // the party: lights on
  await page.evaluate(() => { window.__said.length = 0; });
  const all = await items();
  const cur = await run();
  for (let i = 0; i < all.length; i++) {
    const it = all[i];
    if (cur.found.indexOf(i) < 0 && (it.role === "find" || it.role === "buddy")) await page.evaluate((q) => window.__SEEK.markForTest(q), i);
  }
  // a hidden find comes out through its box
  const box = all.findIndex((it) => it.holds);
  if (box >= 0) await page.evaluate((q) => window.__SEEK.markForTest(q), box);
  await page.locator(".seek-win").waitFor({ state: "visible", timeout: 4000 });
  said = await page.evaluate(() => window.__said.slice());
  assert.ok(said.indexOf("Lights on! You found everything!") >= 0, "the lights come on: " + said.join(" | "));
  assert.ok(await page.evaluate(() => document.querySelector(".seek-dark").hidden), "…and the dark is gone");
  assert.equal(pageErrors.length, 0, pageErrors.join(" | "));
});

// ---- Grown-ups reset (the owner, 2026-11-25): only a grown-up starts it over
test("grown-ups reset: the ⚙️ under the doors asks the ONE gate; only the word clears every ⭐, half-found picture and the sticker album; a second open tab cannot fold them back", async () => {
  await page.evaluate(() => window.__SEEK.reset());
  const seed = { v: 1, stars: { park: 2, beach: 1 }, plays: { park: 3, beach: 1 }, runs: {}, seen: { dog: 2, kite: 1 }, last: "beach" };
  await page.evaluate((s) => localStorage.setItem("josh-seek-v1", JSON.stringify(s)), seed);
  await page.reload({ waitUntil: "load" });
  await spy();
  await go("#seek-home", "#screen-seek-home");
  const stars = () => page.evaluate(() => [...document.querySelectorAll(".seek-door__stars")].filter((e) => e.textContent).length);
  assert.equal(await stars(), 2, "fixture: two doors wear a ⭐");
  const saved = await page.evaluate(() => window.__SEEK.save());
  assert.ok(Object.keys(saved.seen).length >= 1, "fixture: the album has stickers");
  const tab2 = await context.newPage();
  // DEAF to the storage event (an init script, inert in every other page), so
  // the only way it can learn of the reset is at its next WRITE — the path a
  // tab whose event was missed must still get right
  await tab2.addInitScript(() => window.addEventListener("storage", (e) => e.stopImmediatePropagation(), true));
  await tab2.goto(baseURL + "#seek-home", { waitUntil: "load" });
  await tab2.locator("#screen-seek-home").waitFor({ state: "visible" });
  // tab 2 is in the middle of a picture when the grown-up resets
  await tab2.waitForTimeout(400);
  await tab2.locator('.seek-door[data-place="zoo"]').click();
  await tab2.locator("#screen-seek-play").waitFor({ state: "visible" });
  await tab2.waitForFunction(() => { const r = window.__SEEK.run(); return r && r.place === "zoo"; });

  const btn = await page.evaluate(() => {
    const b = document.getElementById("seek-reset"), r = b.getBoundingClientRect();
    const last = Math.max(...[...document.querySelectorAll(".seek-door")].map((d) => d.getBoundingClientRect().bottom));
    return { adult: b.dataset.adult, below: r.top - last, h: r.height };
  });
  assert.equal(btn.adult, "1", "the button is marked adult-only");
  assert.ok(btn.below >= 16, "it sits after the last door, clear of it (" + btn.below + "px)");
  assert.ok(btn.h < 75, "it is small and quiet (" + btn.h + "px)");
  const open = async () => {
    await page.locator("#seek-reset").scrollIntoViewIfNeeded();
    await page.locator("#seek-reset").click();
    await page.locator(".gate").waitFor({ state: "visible" });
  };
  await open();
  assert.match(await page.locator(".gate__msg").textContent(), /Seek &(amp;)? Find/, "the gate says what it will clear");
  await page.locator(".gate__ok").click();
  assert.ok(await page.locator(".gate__err").isVisible(), "OK with no word only shows the hint");
  await page.locator(".gate__cancel").click();
  await page.locator(".gate").waitFor({ state: "hidden" });
  assert.deepEqual(await page.evaluate(() => window.__SEEK.save()), saved, "nothing is cleared without the word");
  await page.waitForTimeout(400);
  await open();
  await page.locator(".gate__input").fill("reset");
  await page.locator(".gate__ok").click();
  await page.locator(".gate").waitFor({ state: "hidden" });
  assert.match(await page.locator(".gate__done").last().textContent(), /Seek & Find starts over/, "the grown-up is told it worked");
  assert.equal(await stars(), 0, "every ⭐ is gone from the doors");
  assert.match(await page.locator(".seek-albumcount").textContent(), /^0\//, "the album is empty");
  const after = await page.evaluate(() => window.__SEEK.save());
  for (const k of ["stars", "plays", "runs", "seen"]) assert.deepEqual(after[k], {}, k + " is cleared");
  assert.ok(after.gen > 0, "the reset is stamped, so another tab can tell");

  // tab 2, open from before and mid-picture, leaves it (leaving saves the
  // picture: a write, before anything else): it must take the reset rather
  // than fold the old ⭐ and stickers back in
  await tab2.waitForFunction(() => JSON.parse(localStorage.getItem("josh-seek-v1")).gen > 0);
  await tab2.evaluate(() => { location.hash = "#seek-home"; });
  await tab2.locator("#screen-seek-home").waitFor({ state: "visible" });
  await tab2.waitForTimeout(200);
  assert.equal(await tab2.evaluate(() => [...document.querySelectorAll(".seek-door__stars")].filter((e) => e.textContent).length), 0, "tab 2's doors show the reset");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("josh-seek-v1")));
  assert.deepEqual(stored.stars, {}, "a tab open from before cannot fold the wiped ⭐ back in");
  assert.deepEqual(stored.seen, {}, "…nor the old stickers");
  await tab2.close();
  await page.reload({ waitUntil: "load" });
  assert.deepEqual((await page.evaluate(() => window.__SEEK.save())).stars, {}, "and it holds across a reload");
});
