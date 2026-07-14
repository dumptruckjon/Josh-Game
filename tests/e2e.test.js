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
    // Drive the contract with a DOM-level el.click() rather than a coordinate
    // (force) click: on a slow runner a growing/rebuilding field reflows or
    // scrolls between box-computation and dispatch, so a coordinate click can
    // repeatedly miss and the game gets "stuck" (observed on big-red-one's 16
    // inline-SVG cells under CPU load). A DOM click always hits the intended
    // element regardless of layout/scroll/overlay, so this exercises the state
    // machine deterministically. Real touch realism (sizes, no overlap, tappable)
    // is covered separately by mobile.test.js's actual .tap(). A genuinely broken
    // game still never sets won and fails here.
    let won = false;
    for (let i = 0; i < 200 && !won; i++) {
      won = await screen.evaluate((el) => el.dataset.won === "1");
      if (won) break;
      const correct = screen.locator('[data-correct="1"]').first();
      if ((await correct.count()) === 0) { await page.waitForTimeout(20); continue; }
      try { await correct.evaluate((el) => el.click()); }
      catch (e) { await page.waitForTimeout(20); } // element detached mid-rebuild — re-query next loop
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

test("the Sticker Book has one slot per game and fills the ones Josh has won", async () => {
  // The every-game test above won every win-game, so the book should be full.
  await page.evaluate(() => { location.hash = ""; });
  await page.locator("#screen-home").waitFor({ state: "visible" });

  // artFor must be deterministic and produce a real <svg> sticker.
  const det = await page.evaluate(() => {
    const g = (window.JoshGames || [])[0];
    const a = window.JoshStickers.artFor(g);
    const b = window.JoshStickers.artFor(g);
    return { same: a === b, svg: /^<svg/.test(a || "") };
  });
  assert.ok(det.same, "JoshStickers.artFor must be deterministic for a given game");
  assert.ok(det.svg, "JoshStickers.artFor must return an <svg> sticker");

  // A home tile opens the book.
  await page.locator(".tile--stickers").click();
  await page.locator("#screen-stickers").waitFor({ state: "visible", timeout: 4000 });

  const slots = await page.locator("#screen-stickers .sticker-slot").count();
  const games = await page.evaluate(() => (window.JoshGames || []).length);
  assert.equal(slots, games, "the Sticker Book must have exactly one slot per registered game");

  const filled = await page.locator("#screen-stickers .sticker-slot.is-won").count();
  assert.ok(filled >= 3, `won games should fill sticker slots, got ${filled}`);
  const meter = await page.locator("#screen-stickers .sticker-meter__text").textContent();
  assert.match(meter || "", /\d+\s*\/\s*\d+/, "the star meter should show a filled / total count");

  // Tapping a FILLED sticker replays that game (navigates to its screen).
  const wonSlot = page.locator("#screen-stickers .sticker-slot.is-won").first();
  const gid = await wonSlot.getAttribute("data-sticker");
  await wonSlot.click();
  await page.locator(`#screen-${gid}`).waitFor({ state: "visible", timeout: 4000 });
  assert.ok(await page.locator(`#screen-${gid}`).isVisible(), "a won sticker should replay its game on tap");
});

test("grown-ups gate: only the word 'reset' clears the ⭐ badges", async () => {
  // The previous test won games, so badges exist now. The gate must reject
  // everything except the word "reset" (any case) and clear the badges + flags.
  await page.evaluate(() => { location.hash = ""; });
  await page.locator("#screen-home").waitFor({ state: "visible" });
  const before = await page.locator(".tile__badge").count();
  assert.ok(before >= 1, `expected badges to reset, got ${before}`);

  await page.locator("#reset-stars").click();
  await page.locator(".gate").waitFor({ state: "visible" });

  // A wrong word clears NOTHING and shows a gentle error.
  await page.locator(".gate__input").fill("banana");
  await page.locator(".gate__ok").click();
  assert.equal(await page.locator(".tile__badge").count(), before, "a wrong word must not clear badges");
  assert.ok(await page.locator(".gate__err").isVisible(), "wrong word shows the error");

  // The correct word — case-insensitive — clears the badges and the won-flags.
  await page.locator(".gate__input").fill("Reset");
  await page.locator(".gate__ok").click();
  await page.waitForFunction(() => document.querySelectorAll(".tile__badge").length === 0, null, { timeout: 4000 });
  assert.equal(await page.locator(".tile__badge").count(), 0, "‘Reset’ clears every badge");
  const flags = await page.evaluate(() => {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) if ((localStorage.key(i) || "").indexOf("josh-won-") === 0) n++;
    return n;
  });
  assert.equal(flags, 0, "the josh-won-* flags are cleared too");

  // The reset must also EMPTY the Sticker Book (slots + star meter), not just tiles.
  await page.evaluate(() => { location.hash = "#stickers"; });
  await page.locator("#screen-stickers").waitFor({ state: "visible", timeout: 4000 });
  assert.equal(await page.locator("#screen-stickers .sticker-slot.is-won").count(), 0, "reset must clear every filled sticker slot");
  assert.equal(await page.locator("#screen-stickers").evaluate((el) => el.dataset.won || ""), "0", "reset resets the book's filled count to 0");

  // With the book empty, tapping an UNWON slot must NOT navigate (it just nudges).
  const emptySlot = page.locator("#screen-stickers .sticker-slot:not(.is-won)").first();
  await emptySlot.click();
  assert.equal(await page.evaluate(() => location.hash), "#stickers", "tapping an unwon sticker must not leave the book");
  assert.ok(await emptySlot.evaluate((el) => el.classList.contains("bump")), "an unwon sticker tap gives a gentle bump");
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

test("with sound OFF (the default), winning a game plays NO notes at all", async () => {
  // The single most important audio property: sound is OFF by default, so the
  // win jingle / round tone / try-again bump must be completely silent until a
  // grown-up turns sound on. Guards against a cue escaping the mute gate.
  await page.evaluate(() => { try { localStorage.setItem("josh-muted", "1"); } catch (e) {} });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { window.__notes = 0; window.__startedWhileSuspended = 0; });

  await page.evaluate(() => { location.hash = "#odd-one-out"; });
  const screen = page.locator("#screen-odd-one-out");
  await screen.waitFor({ state: "visible", timeout: 4000 });
  let won = false;
  for (let i = 0; i < 80 && !won; i++) {
    won = await screen.evaluate((el) => el.dataset.won === "1");
    if (won) break;
    const correct = screen.locator('[data-correct="1"]').first();
    if ((await correct.count()) === 0) { await page.waitForTimeout(20); continue; }
    try { await correct.evaluate((el) => el.click()); } catch (e) { await page.waitForTimeout(20); }
  }
  assert.ok(won, "odd-one-out should reach a win");
  // Give any (buggy) async note a chance to fire, then assert total silence.
  await page.waitForTimeout(150);
  const notes = await page.evaluate(() => window.__notes || 0);
  assert.equal(notes, 0, `with sound off, a win must play ZERO notes; got ${notes}`);
});

test("with sound ON, winning a game plays a jingle (iOS-safe: never while suspended)", async () => {
  // Wins are celebrated with a rising jingle via JoshAudio — but only when sound
  // is on (off by default). Turn it on, win a game, and assert notes fired and
  // none started while the context was still suspended (that is silent on iOS).
  await page.evaluate(() => { try { localStorage.setItem("josh-muted", "0"); } catch (e) {} });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { window.__notes = 0; window.__startedWhileSuspended = 0; });

  await page.evaluate(() => { location.hash = "#odd-one-out"; });
  const screen = page.locator("#screen-odd-one-out");
  await screen.waitFor({ state: "visible", timeout: 4000 });
  let won = false;
  for (let i = 0; i < 80 && !won; i++) {
    won = await screen.evaluate((el) => el.dataset.won === "1");
    if (won) break;
    const correct = screen.locator('[data-correct="1"]').first();
    if ((await correct.count()) === 0) { await page.waitForTimeout(20); continue; }
    try { await correct.evaluate((el) => el.click()); } catch (e) { await page.waitForTimeout(20); }
  }
  assert.ok(won, "odd-one-out should reach a win");
  await page.waitForFunction(() => (window.__notes || 0) >= 1, null, { timeout: 4000 });
  const notes = await page.evaluate(() => window.__notes || 0);
  const bad = await page.evaluate(() => window.__startedWhileSuspended || 0);
  assert.ok(notes >= 1, `a win should play at least one jingle note; got ${notes}`);
  assert.equal(bad, 0, `jingle notes must never start while suspended (got ${bad}; silent on iOS)`);

  // Restore the default (muted) so later tests match the shipped default.
  await page.evaluate(() => { try { localStorage.setItem("josh-muted", "1"); } catch (e) {} });
});

test("Piggy Bank: the worth display reaches the full price when a round is filled (not stuck a coin short)", async () => {
  // Regression: the total only refreshed while the piggy was NOT yet full, so the
  // coin that filled it left the display one coin short (e.g. "4¢ / 5¢").
  await openGame("piggy-bank");
  const screen = page.locator("#screen-piggy-bank");
  const price = await screen.evaluate(() => {
    const t = (document.querySelector("#screen-piggy-bank .piggy__tag") || {}).textContent || "";
    const m = t.match(/(\d+)/);
    return m ? Number(m[1]) : 0;
  });
  assert.ok(price >= 3, `should have a target price, got ${price}`);
  // Fill the piggy by tapping affordable coins (they carry data-correct until full).
  for (let i = 0; i < 20; i++) {
    const coin = screen.locator('.coin[data-correct="1"]').first();
    if ((await coin.count()) === 0) break; // full → coins drop data-correct, Next appears
    await coin.evaluate((el) => el.click());
  }
  const worthText = (await screen.locator(".piggy__worth").textContent()) || "";
  assert.match(
    worthText,
    new RegExp("^\\s*" + price + "¢\\s*/\\s*" + price + "¢"),
    `filled piggy should read "${price}¢ / ${price}¢", got "${worthText}"`
  );
  // Both coins dim once the piggy is full (no more coins are needed).
  assert.ok(await screen.locator(".coin--penny").evaluate((el) => el.classList.contains("coin--off")), "the penny dims when the piggy is full");
  assert.ok(await screen.locator(".coin--nickel").evaluate((el) => el.classList.contains("coin--off")), "the nickel dims when the piggy is full");
});

test("Look From Above: the answer map is a diamond whose N/E/W/S cells match the scene orientation", async () => {
  // The fix re-laid the top-down map as a diamond matching the isometric scene
  // (back block = top of the map). Pin the rendered geometry so a CSS swap can't
  // silently reintroduce the 45° misalignment while the suite stays green.
  await openGame("birds-eye");
  const q = await page.evaluate(() => {
    const grid = document.querySelector("#screen-birds-eye .be__grid");
    if (!grid) return null;
    const c = (sel) => { const el = grid.querySelector(sel); const b = el.getBoundingClientRect(); return { cx: b.left + b.width / 2, cy: b.top + b.height / 2 }; };
    return { n: c(".be__cell--n"), e: c(".be__cell--e"), w: c(".be__cell--w"), s: c(".be__cell--s") };
  });
  assert.ok(q, "birds-eye should render a diamond footprint map");
  assert.ok(q.n.cy < q.e.cy && q.n.cy < q.w.cy, "N (the back block) must be the TOP map cell");
  assert.ok(q.s.cy > q.e.cy && q.s.cy > q.w.cy, "S (the front block) must be the BOTTOM map cell");
  assert.ok(q.w.cx < q.n.cx && q.w.cx < q.s.cx, "W must be the LEFT map cell");
  assert.ok(q.e.cx > q.n.cx && q.e.cx > q.s.cx, "E must be the RIGHT map cell");
});

test("Adaptivity: a clean round grows the streak (api.shouldRamp); a miss resets it", async () => {
  // The invisible difficulty engine. Drive Number Muncher: a clean win advances
  // the streak; a wrong tap mid-round breaks it back to 0 (so difficulty eases).
  await openGame("number-muncher");
  const screen = page.locator("#screen-number-muncher");
  const again = screen.locator(".game__again");
  if (await again.isVisible().catch(() => false)) await again.click(); // fresh start

  // Round A — win cleanly → streak becomes 1.
  await screen.locator('.muncher__card[data-correct="1"]').first().evaluate((el) => el.click());
  await page.waitForFunction(() => document.getElementById("screen-number-muncher").dataset.streak === "1", null, { timeout: 4000 });

  // Round B — miss once (wrong card = a gentle try-again), THEN win → streak resets to 0.
  await screen.locator('.muncher__card:not([data-correct="1"])').first().evaluate((el) => el.click());
  assert.equal(await screen.evaluate((el) => el.dataset.won || ""), "", "a wrong tap must never win");
  await screen.locator('.muncher__card[data-correct="1"]').first().evaluate((el) => el.click());
  await page.waitForFunction(() => document.getElementById("screen-number-muncher").dataset.streak === "0", null, { timeout: 4000 });
  assert.equal(await screen.evaluate((el) => el.dataset.streak), "0", "a miss during a round breaks the clean streak");
});

test("Buddy: pick a companion — it persists and stars in the win celebration", async () => {
  // The roster is built from real content/art; every buddy makes a valid <svg>.
  const roster = await page.evaluate(() =>
    (window.JoshBuddy.list() || []).map((b) => ({ id: b.id, ok: /^<svg/.test((b.make && b.make()) || "") }))
  );
  assert.ok(roster.length >= 6, `expected several buddies, got ${roster.length}`);
  assert.ok(roster.every((b) => b.id && b.ok), "every buddy must have an id + a valid <svg>");
  const ids = roster.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length, "buddy ids are unique");

  // The home screen shows a companion; open the picker and choose a NON-default one.
  await page.evaluate(() => { location.hash = ""; });
  await page.locator("#screen-home").waitFor({ state: "visible" });
  await page.locator(".buddy__pick").click();
  await page.locator(".buddyc").waitFor({ state: "visible" });
  const pickId = ids[ids.length - 1]; // the Star — differs from the default (first)
  await page.locator(`.buddyc__opt[data-buddy="${pickId}"]`).click();
  await page.locator(".buddyc").waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => window.JoshBuddy.currentId()), pickId, "the chosen buddy persists");

  // Winning a game must pop THAT buddy (not a random hero) as the celebration.
  await page.evaluate(() => { location.hash = "#odd-one-out"; });
  const screen = page.locator("#screen-odd-one-out");
  await screen.waitFor({ state: "visible" });
  const again = screen.locator(".game__again");
  if (await again.isVisible().catch(() => false)) await again.click(); // reset for a FRESH win
  let won = false;
  for (let i = 0; i < 80 && !won; i++) {
    won = await screen.evaluate((el) => el.dataset.won === "1");
    if (won) break;
    const correct = screen.locator('[data-correct="1"]').first();
    if ((await correct.count()) === 0) { await page.waitForTimeout(20); continue; }
    try { await correct.evaluate((el) => el.click()); } catch (e) { await page.waitForTimeout(20); }
  }
  assert.ok(won, "odd-one-out should reach a win");
  const popsBuddy = await page.evaluate(() => {
    const wh = document.querySelector("#screen-odd-one-out .win-hero");
    if (!wh) return false;
    // Normalise both through the DOM (innerHTML re-serialises SVG) before comparing.
    const tmp = document.createElement("div");
    tmp.innerHTML = window.JoshBuddy.art();
    return wh.innerHTML === tmp.innerHTML;
  });
  assert.ok(popsBuddy, "the win celebration must pop the chosen buddy's art");
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
