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
    window.__saidLang = [];
    window.__tones = [];
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
    A.say = function (t, o) { window.__said.push(String(t)); window.__saidLang.push((o && o.lang) || "en"); return say.call(this, t, o); };
    const tone = A.tone;
    A.tone = function (f, o) { window.__tones.push(f); return tone.call(this, f, o); };
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
  // choosing a color gives no clue (the owner, 2026-11-25): every shape
  // waiting for it stays plain white with nothing marking it
  const marked = await page.evaluate(() => [...document.querySelectorAll(".color-holder path.cb-num")].filter((p) => p.getAttribute("fill") !== "#ffffff" || [...p.classList].some((c) => c !== "cb-r" && c !== "cb-num")).length);
  assert.equal(marked, 0, "no shape is tinted or marked when a color is chosen");
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

// Paint the open page to the end by real taps (each tap must paint exactly one
// shape), and return what was said and played along the way.
async function paintAll() {
  for (let g = 0; g < 200; g++) {
    const s = await state();
    if (s.free) break;
    const todo = await page.evaluate(() => window.__COLOR.todo());
    if (!todo.length) { await page.waitForTimeout(150); continue; } // the beat before it comes alive
    const t = todo.find((x) => x.n === s.sel);
    assert.ok(t, "the chosen pot always has a shape waiting (sel " + s.sel + ")");
    const before = s.done.length;
    const p = await page.evaluate((k) => window.__COLOR.pointOf(k), t.i);
    await page.mouse.click(p.x, p.y);
    const after = await state();
    if (after && !after.free) assert.equal(after.done.length, before + 1, "a tap on number " + t.n + " (shape " + t.i + ") paints it");
    await page.waitForTimeout(after && !after.free && after.sel !== s.sel ? 420 : 60);
  }
  await page.waitForTimeout(700);
}

test("EVERY page paints to the end by real taps: each number tapped paints its shape, the page comes alive with its OWN sound, and each finished color is said in Chinese too", async () => {
  await page.evaluate(() => window.__COLOR.reset());
  const pages = await page.evaluate(() => window.ColorData.PAGES.map((p) => ({ id: p.id, colors: p.colors.map((c) => c.name) })));
  const zh = await page.evaluate(() => window.ColorData.COLOR_ZH);
  for (const pg of pages) {
    await openPage(pg.id);
    await page.evaluate(() => { window.__said.length = 0; window.__saidLang.length = 0; window.__tones.length = 0; });
    await paintAll();
    const s = await state();
    assert.ok(s && s.free, pg.id + ": the page is finished and open for free paint");
    assert.equal((await page.evaluate(() => window.__COLOR.save())).stars[pg.id], 1, pg.id + ": a ⭐");
    const said = await page.evaluate(() => window.__said.map((t, k) => window.__saidLang[k] + ":" + t));
    // every color but the last is cheered (the last one is the page's own cheer),
    // in English and then, where it has one, in Chinese
    const cheered = pg.colors.filter((n) => said.some((x) => x === "en:All the " + n + " is done!"));
    assert.ok(cheered.length >= pg.colors.length - 1, pg.id + ": every finished color is cheered (" + cheered.join(", ") + ")");
    for (const n of cheered) if (zh[n]) assert.ok(said.includes("zh-CN:" + zh[n]), pg.id + ": " + n + " is said in Chinese too (" + zh[n] + ")");
    assert.ok(said.some((x) => /^en:You colored /.test(x)), pg.id + ": the finish is said");
  }
});

test("the page's own sound plays when it comes alive (and the mute silences it)", async () => {
  await page.evaluate(() => window.__COLOR.reset());
  const sfx = await page.evaluate(() => window.ColorData.PAGES.map((p) => [p.id, p.sound]));
  // the rocket's whoosh climbs: its notes rise
  await openPage("rocket");
  await page.evaluate(() => { window.__tones.length = 0; });
  await paintAll();
  const tones = await page.evaluate(() => window.__tones.slice());
  const tail = tones.slice(-11);
  assert.ok(tail.length === 11 && tail.every((f, k) => k === 0 || f > tail[k - 1]), "the rocket goes WHOOSH: eleven rising notes (" + tail.join(" ") + ")");
  assert.equal(sfx.find((x) => x[0] === "rocket")[1], "whoosh");
  // muted: nothing plays at all
  await page.evaluate(() => { window.JoshAudio.setMuted(true); window.__tones.length = 0; window.__COLOR.reset(); });
  await openPage("sun");
  await paintAll();
  assert.equal(await page.evaluate(() => window.__tones.filter((f) => f > 0).length), 0, "with sound off, the page makes no sound");
  await page.evaluate(() => window.JoshAudio.setMuted(false));
});

test("magic crayons: rainbow, glitter, stripes and dots — on any color, saved, back after a reload, and in the book", async () => {
  await page.evaluate(() => { localStorage.setItem("josh-color-v1", JSON.stringify({ v: 1, stars: { monster: 1 } })); });
  await page.reload({ waitUntil: "load" });
  await spy();
  await openPage("monster");
  assert.ok((await state()).free, "a finished page opens in free paint");
  const keys = await page.locator(".color-crayon").evaluateAll((els) => els.map((e) => e.dataset.crayon));
  assert.deepEqual(keys.slice(0, 4), ["fx:rainbow", "fx:glitter", "fx:stripes", "fx:dots"], "the magic crayons come first");
  assert.equal(keys.length, 16, "four magic crayons and twelve colors");
  const shapes = await page.evaluate(() => window.__COLOR.todo().length ? [] : window.ColorData.PAGES.find((p) => p.id === "monster").regions.map((r, i) => (r.n ? i : -1)).filter((i) => i >= 0));
  const want = {};
  const fxs = ["rainbow", "glitter", "stripes", "dots"];
  for (let k = 0; k < 4; k++) {
    await page.locator('.color-crayon[data-crayon="fx:' + fxs[k] + '"]').click();
    await page.waitForTimeout(420);
    assert.equal((await state()).crayon, "fx:" + fxs[k]);
    const i = shapes[k * 3];
    const was = (await state()).fills[i];
    await tapShape(i);
    want[i] = was.split(" ")[0] + " " + fxs[k];
  }
  await page.waitForTimeout(500);
  const s = await state();
  for (const i of Object.keys(want)) assert.equal(s.fills[i], want[i], "shape " + i + " wears " + want[i] + " (the magic keeps the color under it)");
  // what the page shows: the rainbow fill, and a pattern lying over the others
  const drawn = await page.evaluate((w) => Object.keys(w).map((i) => {
    const el = document.querySelector('.color-holder path[data-i="' + i + '"]');
    const nx = el.nextElementSibling;
    return { fill: el.getAttribute("fill"), over: nx && nx.classList.contains("cb-fx") ? nx.getAttribute("fill") : null };
  }), want);
  assert.match(drawn[0].fill, /^url\(#cb-fx-rainbow\) #/, "rainbow paints the shape");
  assert.deepEqual(drawn.slice(1).map((d) => d.over), ["url(#cb-fx-glitter) none", "url(#cb-fx-stripes) none", "url(#cb-fx-dots) none"], "glitter, stripes and dots lie over the color");
  // a plain crayon takes the magic off
  await page.locator('.color-crayon[data-crayon="#f03e3e"]').click();
  await page.waitForTimeout(420);
  const dotted = Object.keys(want)[3];
  await tapShape(+dotted);
  await page.waitForTimeout(450);
  assert.equal((await state()).fills[dotted], "#f03e3e", "a plain crayon paints over the magic");
  assert.equal(await page.evaluate((i) => { const n = document.querySelector('.color-holder path[data-i="' + i + '"]').nextElementSibling; return !!(n && n.classList.contains("cb-fx")); }, dotted), false, "and the dots are gone");
  // saved: back after a reload, and the book's thumbnail wears it too
  await page.reload({ waitUntil: "load" });
  await spy();
  await go("#color-home", "#screen-color-home");
  const thumb = await page.evaluate(() => {
    const ps = [...document.querySelectorAll('.color-page[data-page="monster"] path')];
    return { rainbow: ps.some((p) => /cb-fx-rainbow/.test(p.getAttribute("fill") || "")), over: ps.filter((p) => p.classList.contains("cb-fx")).length };
  });
  assert.ok(thumb.rainbow && thumb.over >= 2, "the book shows the rainbow and the patterns (" + JSON.stringify(thumb) + ")");
  // the patterns really resolve (index.html declares them): the browser finds each id
  assert.equal(await page.evaluate(() => ["rainbow", "glitter", "stripes", "dots"].filter((f) => document.getElementById("cb-fx-" + f)).length), 4);
});

test("🎬 watch it paint: the page paints itself again from white in the order he painted it, taps wait, then it comes alive with his colors", async () => {
  await page.evaluate(() => window.__COLOR.reset());
  await openPage("fish");
  const order = [];
  for (let g = 0; g < 60; g++) {
    const s = await state();
    if (s.free) break;
    const t = (await page.evaluate(() => window.__COLOR.todo())).find((x) => x.n === s.sel);
    order.push(t.i);
    await tapShape(t.i);
  }
  await page.waitForTimeout(700);
  assert.deepEqual((await page.evaluate(() => window.__COLOR.save())).order.fish, order, "the order he painted in is kept");
  // his own color on one shape, to see it come back after the replay
  await page.locator('.color-crayon[data-crayon="#7950f2"]').click();
  await page.waitForTimeout(420);
  await tapShape(order[0]);
  await page.waitForTimeout(450);
  // watch: the fills as the replay runs
  await page.evaluate((ord) => {
    window.__seen = [];
    const holder = document.querySelector(".color-holder");
    const look = () => {
      const svg = holder.querySelector("svg");
      if (svg) window.__seen.push(ord.map((i) => { const el = svg.querySelector('path[data-i="' + i + '"]'); return el && el.getAttribute("fill") !== "#ffffff"; }));
      if (window.__COLOR.state() && window.__COLOR.state().replaying) requestAnimationFrame(look);
    };
    window.__look = look;
  }, order);
  await page.locator(".color-replay").click();
  await page.evaluate(() => requestAnimationFrame(window.__look));
  await page.waitForTimeout(120);
  assert.ok((await state()).replaying, "🎬 starts the replay");
  assert.ok((await page.evaluate(() => window.__said)).includes("Watch it paint!"));
  // a tap on the page during the replay paints nothing
  await tapShape(order[1]);
  assert.equal((await page.evaluate(() => window.__COLOR.save())).art.fish[order[1]], undefined, "taps wait while it paints itself");
  await page.waitForFunction(() => !window.__COLOR.state().replaying, null, { timeout: 15000 });
  const seen = await page.evaluate(() => window.__seen);
  assert.ok(seen.length > 5, "the replay was watched (" + seen.length + " frames)");
  assert.ok(seen[0].every((x) => !x), "it starts from a white page");
  // shapes come in IN HIS ORDER: once a shape is painted, every earlier one is too
  for (const f of seen) {
    const last = f.lastIndexOf(true);
    assert.ok(f.slice(0, last + 1).every(Boolean), "the replay paints in the order he did (" + f.map((x) => (x ? 1 : 0)).join("") + ")");
  }
  await page.waitForTimeout(300);
  const s = await state();
  assert.ok(s.free && !s.replaying, "back to free paint");
  assert.equal(s.fills[order[0]], "#7950f2", "and the page wears his colors again");
  assert.equal(await fillOf(order[0]), "#7950f2");
  // leaving mid-replay: the page comes back whole, nothing left running
  await page.locator(".color-replay").click();
  await page.waitForTimeout(400);
  await go("#color-home", "#screen-color-home");
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__COLOR.timers()), 0, "no replay step outlives the page");
  // back WITHOUT the book (the browser's forward button): nothing restarts
  // the page, so only the cut-short replay itself can have put it back whole
  await page.evaluate(() => { location.hash = "#color-play"; });
  await page.locator("#screen-color-play").waitFor({ state: "visible" });
  await page.waitForTimeout(450);
  const back = await state();
  assert.ok(back.free && !back.replaying, "a replay cut short is over when he comes back");
  assert.equal(await fillOf(order[0]), "#7950f2", "and his page is whole, not half white");
});

test("find it: only after a LONG quiet while does ONE shape waiting for his color ring, with a finger on it; picking a color shows nothing; a tap paints and the hint goes", async () => {
  await page.evaluate(() => window.__COLOR.reset());
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("josh-color-v1")); s.demo = true; localStorage.setItem("josh-color-v1", JSON.stringify(s)); });
  await page.reload({ waitUntil: "load" });
  await spy();
  await openPage("icecream");
  const ms = await page.evaluate(() => window.__COLOR.hintMs);
  assert.ok(ms >= 20000 && ms <= 40000, "a long quiet while, never the moment he picks (" + ms + "ms)");
  assert.equal(await page.locator(".color-holder .cb-find").count(), 0, "no hint at first");
  // hint a color with at least two shapes waiting, so a tap on ONE must take
  // the rings off the others too
  const many = await page.evaluate(() => { const c = {}; for (const t of window.__COLOR.todo()) c[t.n] = (c[t.n] || 0) + 1; return +Object.keys(c).find((n) => c[n] >= 2); });
  await page.locator('.color-pot[data-n="' + many + '"]').click();
  await page.waitForTimeout(1200);
  assert.equal(await page.locator(".color-holder .cb-find").count(), 0, "picking a color shows no shape");
  assert.ok(!(await page.evaluate(() => window.__COLOR.ghost())), "…and no finger points (he has been shown how)");
  // really wait the quiet while: the hint comes by itself
  const said = (await page.evaluate(() => window.__said.length));
  await page.waitForTimeout(ms + 600);
  const n = await page.locator(".color-holder .cb-find").count();
  const s = await state();
  const waiting = (await page.evaluate(() => window.__COLOR.todo())).filter((x) => x.n === s.sel).length;
  assert.equal(n, 1, "ONE shape rings, not every one (" + n + " of " + waiting + " waiting)");
  const ringed = await page.evaluate(() => +document.querySelector(".color-holder .cb-find").dataset.n);
  assert.equal(ringed, s.sel, "the ringed shape is one waiting for his color");
  assert.ok(await page.evaluate(() => window.__COLOR.ghost()), "and the ghost finger points at it");
  assert.equal(await page.evaluate(() => window.__said.length), said, "a hint says nothing (no pressure)");
  // tap a DIFFERENT shape of his color: any paint takes the hint away
  const ringI = await page.evaluate(() => +document.querySelector(".color-holder .cb-find").dataset.i);
  const t = (await page.evaluate(() => window.__COLOR.todo())).find((x) => x.n === s.sel && x.i !== ringI);
  await tapShape(t.i);
  assert.ok(waiting >= 2, "the hinted color had more than one shape waiting");
  assert.equal(await page.locator(".color-holder .cb-find").count(), 0, "a tap that paints takes the hint away");
  await go("#color-home", "#screen-color-home");
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__COLOR.timers()), 0, "the hint's timer goes with the page");
  assert.equal(await page.locator(".cb-burst, .cb-ghost").count(), 0, "…and a sparkle whose timer was cancelled goes too (it is not left on the page)");
});

test("a broken save is read safely: bad paints, bad orders and junk are dropped, good ones kept", async () => {
  const sun = await page.evaluate(() => window.ColorData.PAGES[0].regions.map((r, i) => (r.n ? i : -1)).filter((i) => i >= 0));
  await page.evaluate((sun) => localStorage.setItem("josh-color-v1", JSON.stringify({
    v: 1, stars: { sun: 2, nope: 5, fish: -3 }, runs: { fish: [999, "x", 1.5] },
    art: { sun: { [sun[0]]: "#123456 dots", [sun[1]]: "#123456 lasers", [sun[2]]: "red", 0.5: "#000000", 9999: "#000000" }, mars: { 1: "#000000" } },
    order: { sun: [sun[1], sun[1], sun[0], 9999, "a"], fish: "no" }, demo: "yes", glided: 1, last: "nowhere",
  })), sun);
  await page.reload({ waitUntil: "load" });
  const s = await page.evaluate(() => window.__COLOR.save());
  assert.deepEqual(s.stars, { sun: 2, fish: 0 }, "stars: only real pages, never negative");
  assert.deepEqual(s.runs, {}, "a run of nothing real is dropped");
  assert.deepEqual(s.art.sun, { [sun[0]]: "#123456 dots" }, "only real paints on real shapes");
  assert.equal(s.art.mars, undefined);
  assert.deepEqual(s.order, { sun: [sun[1], sun[0]] }, "an order keeps real shapes, once each, in order");
  assert.equal(s.demo, false);
  assert.equal(s.glided, false);
  assert.equal(s.last, "sun");
  // and it plays: the sun opens in free paint wearing the dots
  await spy();
  await openPage("sun");
  assert.equal((await state()).fills[sun[0]], "#123456 dots");
});

test("reduced motion: paint lands at once, no sparkles, the replay still plays (still), the hint ring stays still", async () => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    await page.evaluate(() => window.__COLOR.reset());
    await openPage("sun");
    const t = (await page.evaluate(() => window.__COLOR.todo()))[0];
    const s0 = await state();
    const first = (await page.evaluate(() => window.__COLOR.todo())).find((x) => x.n === s0.sel);
    const p = await page.evaluate((k) => window.__COLOR.pointOf(k), first.i);
    await page.mouse.click(p.x, p.y);
    assert.notEqual(await fillOf(first.i), "#ffffff", "the paint is there at once");
    await page.waitForTimeout(420); // a finished color moves the pot: the next tap waits past the echo
    assert.equal(await page.locator(".cb-burst").count(), 0, "no sparkle burst");
    await page.evaluate(() => window.__COLOR.hint());
    const anim = await page.evaluate(() => { const e = document.querySelector(".color-holder .cb-find"); return e ? getComputedStyle(e).animationName : "none"; });
    assert.equal(anim, "none", "the hint ring is still");
    await paintAll();
    await page.locator(".color-replay").click();
    await page.waitForFunction(() => !window.__COLOR.state().replaying, null, { timeout: 15000 });
    assert.ok((await state()).free, "the replay finishes under reduced motion too");
    void t;
  } finally {
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
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

// ---- Grown-ups reset (the owner, 2026-11-25): only a grown-up starts the book over
test("grown-ups reset: the ⚙️ under the book asks the ONE gate; only the word clears every ⭐, half-painted page, his colors and replays; a second open tab cannot fold them back", async () => {
  const pg = await page.evaluate(() => window.ColorData.PAGES.map((p) => ({ id: p.id, i: p.regions.findIndex((r) => r.n) })));
  const seed = { v: 1, stars: { sun: 1, fish: 2 }, runs: { rocket: [pg[3].i] }, art: { sun: { [pg[0].i]: "#ff0000 glitter" } }, order: { sun: [pg[0].i] }, demo: true, glided: true, last: "fish" };
  await page.evaluate((s) => localStorage.setItem("josh-color-v1", JSON.stringify(s)), seed);
  await page.reload({ waitUntil: "load" });
  await spy();
  await go("#color-home", "#screen-color-home");
  const stars = () => page.evaluate(() => [...document.querySelectorAll(".color-page__star")].filter((e) => e.textContent).length);
  assert.equal(await stars(), 2, "fixture: two pages wear a ⭐");
  const saved = await page.evaluate(() => window.__COLOR.save());
  // a second tab, open from before the reset, holding the old ⭐ in memory
  const tab2 = await context.newPage();
  // DEAF to the storage event (an init script, inert in every other page), so
  // the only way it can learn of the reset is at its next WRITE — the path a
  // tab whose event was missed must still get right
  await tab2.addInitScript(() => window.addEventListener("storage", (e) => e.stopImmediatePropagation(), true));
  await tab2.goto(baseURL + "#color-home", { waitUntil: "load" });
  await tab2.locator("#screen-color-home").waitFor({ state: "visible" });
  assert.equal(Object.keys(await tab2.evaluate(() => window.__COLOR.save().stars)).length, 2, "fixture: tab 2 holds the old ⭐");

  const btn = await page.evaluate(() => {
    const b = document.getElementById("color-reset"), r = b.getBoundingClientRect();
    const last = Math.max(...[...document.querySelectorAll(".color-page")].map((d) => d.getBoundingClientRect().bottom));
    return { adult: b.dataset.adult, below: r.top - last, h: r.height, inHome: !!b.closest("#screen-color-home") };
  });
  assert.equal(btn.adult, "1", "the button is marked adult-only");
  assert.ok(btn.inHome, "it lives on the book");
  assert.ok(btn.below >= 16, "it sits after the last page, clear of it (" + btn.below + "px)");
  assert.ok(btn.h < 75, "it is small and quiet (" + btn.h + "px)");
  const open = async () => {
    await page.locator("#color-reset").scrollIntoViewIfNeeded();
    await page.locator("#color-reset").click();
    await page.locator(".gate").waitFor({ state: "visible" });
  };
  await open();
  assert.match(await page.locator(".gate__msg").textContent(), /Color Book/, "the gate says what it will clear");
  await page.locator(".gate__input").fill("banana");
  await page.locator(".gate__ok").click();
  assert.ok(await page.locator(".gate__err").isVisible(), "a wrong word only shows the hint");
  await page.locator(".gate__cancel").click();
  await page.locator(".gate").waitFor({ state: "hidden" });
  assert.deepEqual(await page.evaluate(() => window.__COLOR.save()), saved, "nothing is cleared without the word");
  await page.waitForTimeout(400);
  await open();
  await page.locator(".gate__input").fill("RESET");
  await page.locator(".gate__ok").click();
  await page.locator(".gate").waitFor({ state: "hidden" });
  assert.match(await page.locator(".gate__done").last().textContent(), /Color Book starts over/, "the grown-up is told it worked");
  assert.equal(await stars(), 0, "every ⭐ is gone from the book");
  const after = await page.evaluate(() => window.__COLOR.save());
  for (const k of ["stars", "runs", "art", "order"]) assert.deepEqual(after[k], {}, k + " is cleared");
  assert.equal(after.demo, true, "how to play is not progress: the ghost finger is not shown again");
  assert.ok(after.gen > 0, "the reset is stamped, so another tab can tell");

  // tab 2 still holds the old ⭐: when it next writes (it opens a page), it
  // must take the reset, not fold its old ⭐ back in
  await tab2.waitForFunction(() => JSON.parse(localStorage.getItem("josh-color-v1")).gen > 0);
  await tab2.evaluate(() => window.__COLOR.start("castle", {}));
  await tab2.waitForTimeout(200);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("josh-color-v1")));
  assert.deepEqual(stored.stars, {}, "a tab open from before cannot fold the wiped ⭐ back in");
  assert.deepEqual(stored.art, {}, "…nor his old colors");
  // (tab 2 is already ON #color-home: setting the same hash is no navigation,
  // so hop away first)
  await tab2.evaluate(() => { location.hash = "#__renav"; });
  await tab2.waitForTimeout(60);
  await tab2.evaluate(() => { location.hash = "#color-home"; });
  await tab2.locator("#screen-color-home").waitFor({ state: "visible" });
  assert.equal(await tab2.evaluate(() => [...document.querySelectorAll(".color-page__star")].filter((e) => e.textContent).length), 0, "tab 2's book shows the reset too");
  await tab2.close();
  await page.reload({ waitUntil: "load" });
  assert.deepEqual((await page.evaluate(() => window.__COLOR.save())).stars, {}, "and it holds across a reload");
});
