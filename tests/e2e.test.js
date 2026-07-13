// End-to-end tests (Chromium): a GENERIC harness that actually plays EVERY
// registered game via the shared test contract, so adding a game automatically
// gets it exercised. A win game is driven by tapping whatever carries
// data-correct="1" until screen.dataset.won==="1"; a toy is tapped and asserted
// to respond. The final test asserts there were no uncaught page errors.
//
// Set JOSH_BASE_URL to run against the LIVE deployed site (CI verify-live).

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { startServer, launchBrowser } = require("./helpers");

let server, browser, context, page, baseURL;
const pageErrors = [];

before(async () => {
  ({ server, baseURL } = await startServer());
  browser = await launchBrowser();
  context = await browser.newContext();
  // Stub WebAudio to model iOS Safari FAITHFULLY: the context starts "suspended",
  // resume() is ASYNC, and currentTime only advances once running. This is what
  // makes the real iPhone/iPad bug reproducible — a note scheduled before resume
  // resolves is played in the past and is silent. We record any note that starts
  // while still suspended so the test below can fail on that exact regression.
  await context.addInitScript(() => {
    window.__notes = 0;
    window.__startedWhileSuspended = 0;
    let now = 0;
    function Stub() {
      this.state = "suspended";
      this.destination = {};
      Object.defineProperty(this, "currentTime", { get: () => (this.state === "running" ? now : 0) });
    }
    Stub.prototype.resume = function () {
      const self = this;
      return new Promise((res) => setTimeout(() => { self.state = "running"; now = 5; res(); }, 5));
    };
    Stub.prototype.createOscillator = function () {
      const self = this;
      return { frequency: { value: 0 }, type: "", connect() {}, stop() {}, start() { if (self.state !== "running") window.__startedWhileSuspended++; window.__notes++; } };
    };
    Stub.prototype.createGain = function () { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; };
    window.AudioContext = Stub;
    window.webkitAudioContext = Stub;
  });
  page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(baseURL, { waitUntil: "load" });
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((r) => server.close(r));
});

async function gameIds() {
  return page.evaluate(() => (window.JoshGames || []).map((g) => g.id));
}

async function openGame(id) {
  await page.evaluate((i) => { location.hash = "#" + i; }, id);
  await page.locator(`#screen-${id}`).waitFor({ state: "visible", timeout: 4000 });
}

test("the registry has several games and every one has a home tile", async () => {
  const ids = await gameIds();
  assert.ok(ids.length >= 4, `expected several games, got ${ids.length}`);
  for (const id of ids) {
    assert.equal(await page.locator(`.tile[data-go="${id}"]`).count(), 1, `no tile for ${id}`);
  }
});

test("home → category → game navigation works", async () => {
  await page.evaluate(() => { location.hash = ""; });
  await page.locator("#screen-home").waitFor({ state: "visible" });
  const catTile = page.locator(".tile--cat").first();
  const catId = await catTile.getAttribute("data-cat");
  await catTile.click();
  await page.locator(`#screen-cat-${catId}`).waitFor({ state: "visible", timeout: 4000 });
  const tile = page.locator(`#screen-cat-${catId} .tile[data-go]`).first();
  const gid = await tile.getAttribute("data-go");
  await tile.click();
  await page.locator(`#screen-${gid}`).waitFor({ state: "visible", timeout: 4000 });
  assert.ok(await page.locator(`#screen-${gid}`).isVisible());
});

test("the in-game Home button returns to the game's category", async () => {
  const ids = await gameIds();
  await openGame(ids[0]);
  await page.locator(`#screen-${ids[0]} .game__home`).click();
  await page.waitForFunction((id) => document.getElementById("screen-" + id).hidden, ids[0], { timeout: 4000 });
  assert.ok((await page.locator(".screen.category:not([hidden])").count()) >= 1, "a category screen should show after Home");
});

test("the category back button returns to the home menu", async () => {
  await page.evaluate(() => { location.hash = "#cat-numbers"; });
  await page.locator("#screen-cat-numbers").waitFor({ state: "visible" });
  await page.locator("#screen-cat-numbers .game__home").click();
  await page.locator("#screen-home").waitFor({ state: "visible", timeout: 4000 });
  assert.ok(await page.locator("#screen-home").isVisible());
});

test("the Surprise tile jumps to a game", async () => {
  await page.evaluate(() => { location.hash = ""; });
  await page.locator("#screen-home").waitFor({ state: "visible" });
  await page.locator(".tile--surprise").click();
  await page.waitForFunction(() => location.hash.length > 1, null, { timeout: 4000 });
  assert.ok((await page.evaluate(() => location.hash)).length > 1, "should navigate to some game");
});

test("EVERY game plays end-to-end (win reached, or toy responds)", async () => {
  const ids = await gameIds();
  for (const id of ids) {
    await openGame(id);
    const screen = page.locator(`#screen-${id}`);

    const isToy = (await screen.locator("[data-toy]").count()) > 0;
    if (isToy) {
      await screen.locator("[data-toy]").first().click();
      await page.waitForFunction(
        (i) => Number((document.getElementById("screen-" + i).dataset.plays) || 0) >= 1,
        id, { timeout: 4000 }
      );
      // a couple more taps never error
      await screen.locator("[data-toy]").first().click();
      continue;
    }

    // Win game: keep tapping the currently-correct target until the game is won.
    // On the LIVE site (verify-live) a round rebuild can detach the element
    // between the query and the click, and pages render slower under CDN load —
    // so treat a detached/slow click as a retry (not a failure) and give a
    // generous cap. A genuinely broken game still never wins and fails here.
    let won = false;
    for (let i = 0; i < 200 && !won; i++) {
      won = await screen.evaluate((el) => el.dataset.won === "1");
      if (won) break;
      const correct = screen.locator('[data-correct="1"]').first();
      if ((await correct.count()) === 0) { await page.waitForTimeout(20); continue; }
      try { await correct.click({ force: true, timeout: 3000 }); }
      catch (e) { await page.waitForTimeout(20); } // rebuild race on a slow live page — retry
    }
    won = await screen.evaluate((el) => el.dataset.won === "1");
    assert.ok(won, `game "${id}" never reached a win`);

    // Winning reveals a working "Again" button that resets the won state.
    const again = screen.locator(".game__again");
    assert.ok(await again.isVisible(), `game "${id}" should show Again after winning`);
    await again.click();
    assert.equal(await screen.evaluate((el) => el.dataset.won || ""), "", `Again should reset "${id}"`);
  }
});

test("beating games marks them with a ⭐ on the launcher", async () => {
  // The previous test won every win-game; each should now carry a badge.
  await page.evaluate(() => { location.hash = ""; });
  await page.locator("#screen-home").waitFor({ state: "visible" });
  const badges = await page.locator(".tile__badge").count();
  assert.ok(badges >= 3, `expected several beaten-game star badges, got ${badges}`);
});

test("a wrong tap is forgiving — no score loss, target stays in play", async () => {
  // Drive Odd-One-Out: tap a NON-correct tile, assert it did not advance/win.
  await openGame("odd-one-out");
  const screen = page.locator("#screen-odd-one-out");
  const wrong = screen.locator('.choice:not([data-correct="1"])').first();
  await wrong.click({ force: true });
  assert.equal(await screen.evaluate((el) => el.dataset.won || ""), "", "a wrong tap must never win");
  // the correct tile is still present and playable
  assert.ok((await screen.locator('[data-correct="1"]').count()) >= 1, "correct choice stays in play");
});

test("the Music Pad actually plays notes on iOS (audio fires only once the context is RUNNING)", async () => {
  await page.evaluate(() => { window.__notes = 0; window.__startedWhileSuspended = 0; });
  await openGame("music-pad");
  const pads = page.locator("#screen-music-pad .music__pad");
  await pads.nth(0).click();
  await pads.nth(2).click();
  await pads.nth(4).click();
  // Notes fire only after the async resume() resolves — wait for them.
  await page.waitForFunction(() => (window.__notes || 0) >= 2, null, { timeout: 4000 });
  const notes = await page.evaluate(() => window.__notes || 0);
  const bad = await page.evaluate(() => window.__startedWhileSuspended || 0);
  assert.ok(notes >= 2, `tapping pads should start notes; got ${notes}`);
  // The iOS regression: scheduling a note while suspended plays it in the past → silent.
  assert.equal(bad, 0, `notes must never start while the context is suspended (got ${bad}; that is silent on iOS)`);
});

test("no uncaught page errors during the whole run", () => {
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
});
