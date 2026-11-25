// 🎨 Color Book — browser tests (Chromium; mobile.test.js runs the layout on
// the iPhone 17 Pro geometry and on real WebKit in CI). They paint with REAL
// taps at screen coordinates, because a tap is judged by the engine's owner
// grid (ColorLogic.judge) — a test that called a function could not see the
// screen-to-page mapping break. window.__COLOR only says WHERE a number is.

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { startServer, launchBrowser } = require("./helpers");

let server, browser, context, page, baseURL;
const pageErrors = [];

before(async () => {
  ({ server, baseURL } = await startServer());
  browser = await launchBrowser();
  context = await browser.newContext({ viewport: { width: 402, height: 874 }, hasTouch: true, isMobile: true });
  page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.addInitScript(() => {
    window.__said = [];
    try { localStorage.setItem("josh-muted", "0"); } catch (e) { /* ignore */ }
  });
  await page.goto(baseURL, { waitUntil: "load" });
});
after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((r) => server.close(r));
});

async function spy() {
  await page.evaluate(() => {
    const A = window.JoshAudio;
    if (A.__spied) return;
    const say = A.say;
    A.say = function (t, o) { window.__said.push(String(t)); return say.call(this, t, o); };
    A.__spied = true;
  });
}
async function go(hash, sel) {
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.locator(sel).waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(400); // the echo guard: a child looks first
}
const state = () => page.evaluate(() => window.__COLOR.state());
async function openPage(id) {
  await spy();
  await go("#color-home", "#screen-color-home");
  await page.locator('.color-page[data-page="' + id + '"]').click();
  await page.locator("#screen-color-play").waitFor({ state: "visible" });
  await page.waitForFunction((p) => { const s = window.__COLOR.state(); return s && s.page === p; }, id);
  await page.waitForTimeout(450);
}
// Tap shape i where its number is, like a finger.
async function tapShape(i, dx, dy) {
  const p = await page.evaluate((k) => window.__COLOR.pointOf(k), i);
  await page.mouse.click(p.x + (dx || 0), p.y + (dy || 0));
  await page.waitForTimeout(420); // past the echo window
}
const fillOf = (i) => page.evaluate((k) => document.querySelector('.color-holder path[data-i="' + k + '"]').getAttribute("fill"), i);

test("the front door's SEVENTH door opens the Color Book: a page per picture, white until painted, the next one glowing", async () => {
  await page.evaluate(() => { window.__COLOR.reset(); location.hash = ""; });
  await page.locator("#screen-start").waitFor({ state: "visible" });
  const order = await page.evaluate(() => [...document.querySelectorAll(".start-tile")].map((t) => t.id));
  assert.equal(order[order.length - 1], "start-color", "Color Book is the last door");
  assert.equal(await page.locator("#start-color .start-tile__art svg").count(), 1, "the door wears a colored-in page");
  await page.waitForTimeout(400);
  await page.locator("#start-color").click();
  await page.locator("#screen-color-home").waitFor({ state: "visible" });
  assert.ok(await page.evaluate(() => document.body.classList.contains("color-mode")), "the world's theme is on");
  const n = await page.evaluate(() => window.ColorData.PAGES.length);
  assert.ok(n >= 10);
  assert.equal(await page.locator(".color-page").count(), n, "one page per picture");
  assert.equal(await page.locator(".color-page--next").count(), 1, "one page glows: the next to color");
  assert.equal(await page.locator('.color-page--next[data-page="sun"]').count(), 1, "on a fresh book it is page 1");
  // an unpainted page is a white coloring page: no shape filled with a color
  const filled = await page.evaluate(() => [...document.querySelectorAll('.color-page[data-page="sun"] path')].filter((p) => /^#/.test(p.getAttribute("fill") || "") && p.getAttribute("fill") !== "#ffffff").length);
  const fixed = await page.evaluate(() => window.ColorData.PAGES[0].regions.filter((r) => !r.n && r.fill !== "#ffffff").length);
  assert.equal(filled, fixed, "only the shapes that come colored (eyes, cheeks) are colored on a fresh page");
  for (const b of await page.locator(".color-page").all()) {
    const r = await b.boundingBox();
    assert.ok(r.width >= 75 && r.height >= 75, "every page is a big tap");
  }
  await page.waitForTimeout(400); // past the echo window: a child who looked
  await page.locator("#screen-color-home .color-exit").click();
  await page.locator("#screen-start").waitFor({ state: "visible" });
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("color-mode"))), "leaving drops the theme");
});

test("a whole page painted by real taps: paint spreads, pots tick off and move on by themselves, the page comes alive, a ⭐ lands", async () => {
  await page.evaluate(() => window.__COLOR.reset());
  await openPage("sun");
  await page.evaluate(() => { window.__said = []; });
  let s = await state();
  assert.equal(s.sel, 1, "pot 1 is chosen for him");
  assert.ok(await page.evaluate(() => window.__COLOR.ghost()), "the first time, a ghost finger shows how");
  for (const b of await page.locator(".color-pot").all()) {
    const r = await b.boundingBox();
    assert.ok(r.width >= 75 && r.height >= 75, "every pot is a big tap");
  }
  // the shapes waiting for pot 1 shimmer, and only they
  const want = await page.evaluate(() => [...document.querySelectorAll(".cb-want")].map((p) => +p.dataset.n));
  assert.ok(want.length && want.every((n) => n === 1), "the shapes waiting for the chosen color shimmer");
  const pots = new Set();
  for (let guard = 0; guard < 40; guard++) {
    s = await state();
    if (!s || s.free) break;
    const todo = await page.evaluate(() => window.__COLOR.todo());
    const t = todo.find((x) => x.n === s.sel);
    assert.ok(t, "the chosen pot always has a shape left (it moves on by itself): pot " + s.sel);
    pots.add(s.sel);
    await tapShape(t.i);
    assert.notEqual(await fillOf(t.i), "#ffffff", "a tap on a number paints its shape");
    assert.equal(await page.locator('.color-holder text[data-for="' + t.i + '"]').count(), 0, "and its number goes");
    if (guard === 0) assert.ok(!(await page.evaluate(() => window.__COLOR.ghost())), "the ghost finger goes once he paints");
  }
  await page.waitForTimeout(700);
  s = await state();
  assert.ok(s.free, "a finished page becomes his to recolor");
  assert.deepEqual([...pots].sort(), [1, 2, 3], "every pot was used without him choosing one");
  assert.ok(await page.locator(".color-holder .cb-anim").count() > 0, "the finished page comes alive");
  assert.ok(await page.locator(".color-box").isVisible(), "the crayon box opens");
  assert.ok(!(await page.locator(".color-pots").isVisible()), "…in place of the pots");
  const saved = await page.evaluate(() => window.__COLOR.save());
  assert.equal(saved.stars.sun, 1, "a ⭐ is saved");
  assert.ok(!saved.runs.sun, "the half-painted page is gone from the save");
  const said = await page.evaluate(() => window.__said.join(" | "));
  assert.match(said, /All the .* is done!/, "a finished color is cheered");
  assert.match(said, /You colored the happy sun!/, "the page is named when it is done");
  await go("#color-home", "#screen-color-home");
  assert.equal(await page.locator('.color-page[data-page="sun"] .color-page__star').textContent(), "⭐", "the page wears a ⭐ in the book");
  assert.equal(await page.locator('.color-page--next[data-page="fish"]').count(), 1, "and the next page glows");
});

test("a wrong shape does not paint: its number grows and its pot wiggles; a finger just beside a shape still paints it", async () => {
  await page.evaluate(() => window.__COLOR.reset());
  await openPage("rocket");
  await page.evaluate(() => { window.__said = []; });
  const s = await state();
  const todo = await page.evaluate(() => window.__COLOR.todo());
  const other = todo.find((x) => x.n !== s.sel && x.i !== 0 && x.n === 2);
  await tapShape(other.i);
  assert.equal(await fillOf(other.i), "#ffffff", "a shape of another number stays white");
  assert.ok((await state()).done.indexOf(other.i) < 0);
  assert.match(await page.evaluate(() => window.__said.join(" | ")), /That one is number 2!/, "it says which number it is");
  // forgiving: pot 2, a finger a few pixels outside the nose cone's edge
  await page.locator('.color-pot[data-n="2"]').click();
  await page.waitForTimeout(420);
  assert.equal((await state()).sel, 2, "a pot tap chooses it");
  const nose = await page.evaluate(() => {
    const regs = window.ColorData.PAGES.find((p) => p.id === "rocket").regions;
    // the nose: the region of number 2 whose shape reaches highest
    let best = -1, top = 999;
    regs.forEach((r, i) => { if (r.n === 2) { const y = Math.min(...r.pts.map((q) => q[1])); if (y < top) { top = y; best = i; } } });
    return { i: best, top };
  });
  const svgBox = await page.locator(".color-holder svg").boundingBox();
  const px = svgBox.x + (100 / 200) * svgBox.width, py = svgBox.y + ((nose.top - 4) / 200) * svgBox.height;
  await page.mouse.click(px, py);
  await page.waitForTimeout(420);
  assert.notEqual(await fillOf(nose.i), "#ffffff", "a tap just above the tip of the nose cone still paints it");
});

test("a half-painted page waits in the book and carries on after a reload", async () => {
  await page.evaluate(() => window.__COLOR.reset());
  await openPage("fish");
  const todo = await page.evaluate(() => window.__COLOR.todo());
  await tapShape(todo.find((x) => x.n === 1).i);
  const s = await state();
  assert.equal(s.done.length, 1);
  await page.reload({ waitUntil: "load" });
  await openPage("fish");
  const t = await state();
  assert.deepEqual(t.done, s.done, "the painted shape is still painted");
  assert.ok(!t.free);
  assert.equal(await fillOf(s.done[0]), await page.evaluate(() => window.ColorData.PAGES[1].colors[0].hex), "in its color");
  await go("#color-home", "#screen-color-home");
  assert.match(await page.locator('.color-page[data-page="fish"]').getAttribute("aria-label"), /started/, "the book says the page is started");
});

test("free paint: a crayon recolors any shape; his colors are saved and shown in the book; 🔁 starts the page over", async () => {
  await page.evaluate(() => window.__COLOR.reset());
  await openPage("sun");
  for (let g = 0; g < 30; g++) {
    const s = await state();
    if (s.free) break;
    const t = (await page.evaluate(() => window.__COLOR.todo())).find((x) => x.n === s.sel);
    await tapShape(t.i);
  }
  await page.waitForTimeout(700);
  assert.ok((await state()).free);
  for (const c of await page.locator(".color-crayon").all()) {
    const r = await c.boundingBox();
    assert.ok(r.width >= 75 && r.height >= 75, "every crayon is a big tap");
  }
  await page.locator('.color-crayon[data-crayon="#7950f2"]').click();
  await page.waitForTimeout(420);
  assert.equal((await state()).crayon, "#7950f2");
  // the sun's face (the disc): recolor it purple
  const disc = await page.evaluate(() => window.ColorData.PAGES[0].regions.findIndex((r) => r.part === "face" && r.n === 2));
  await tapShape(disc, 0, 34);
  await page.waitForTimeout(500);
  assert.equal(await fillOf(disc), "#7950f2", "a crayon recolors a shape");
  assert.equal((await page.evaluate(() => window.__COLOR.save())).art.sun[disc], "#7950f2", "and it is saved");
  await go("#color-home", "#screen-color-home");
  assert.ok(await page.evaluate((i) => [...document.querySelectorAll('.color-page[data-page="sun"] path')].some((p) => p.getAttribute("fill") === "#7950f2"), disc), "the book shows his colors");
  await page.locator('.color-page[data-page="sun"]').click();
  await page.locator("#screen-color-play").waitFor({ state: "visible" });
  await page.waitForTimeout(450);
  assert.ok((await state()).free, "a finished page opens straight into free paint");
  await page.locator(".color-again").click();
  await page.waitForTimeout(450);
  const s = await state();
  assert.ok(!s.free && s.done.length === 0, "🔁 starts the page over");
  assert.ok(!(await page.evaluate(() => window.__COLOR.save())).art.sun, "and forgets the old colors");
});

test("leaving mid-paint leaves nothing running, and every number is big enough to read", async () => {
  await page.evaluate(() => window.__COLOR.reset());
  await openPage("monster");
  // the numbers: font at least 14px on this phone
  const small = await page.evaluate(() => [...document.querySelectorAll(".color-holder .cb-label")].map((t) => t.getBoundingClientRect().height).filter((h) => h < 14).length);
  assert.equal(small, 0, "every number on the page is at least 14px tall");
  await go("#color-home", "#screen-color-home");
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.querySelectorAll(".cb-ghost").length), 0, "the ghost finger goes with the page");
  assert.deepEqual(pageErrors, [], "no page errors");
});
