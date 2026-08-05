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
    // The stub must model iOS Safari FAITHFULLY, and that includes the parts of
    // the API it has had since 2013. The first version gave GainNode only
    // setValueAtTime + exponentialRampToValueAtTime, so the moment the shared
    // envelope used linearRampToValueAtTime for a click-free tail, every note
    // in the app threw inside tone()'s try/catch and went SILENT — two shipped
    // tests timed out and it read exactly like a product bug. Suspect the
    // fixture: a stub less capable than every real browser invents failures.
    //   It also records the GRAPH (what each node connects to), so a test can
    // prove voices route through the master bus instead of the speaker.
    window.__graph = { toDestination: 0, comp: 0, filters: 0 };
    function param() {
      return {
        value: 0,
        setValueAtTime() { return this; },
        exponentialRampToValueAtTime() { return this; },
        linearRampToValueAtTime() { return this; },
        setTargetAtTime() { return this; },
        cancelScheduledValues() { return this; },
      };
    }
    function node(self, extra) {
      return Object.assign({
        context: self,
        connect(dest) { if (dest === self.destination) window.__graph.toDestination++; return dest; },
        disconnect() {},
      }, extra || {});
    }
    Stub.prototype.createOscillator = function () {
      const self = this;
      return node(self, {
        frequency: param(), detune: param(), type: "", onended: null,
        stop() {},
        start() { if (self.state !== "running") window.__startedWhileSuspended++; window.__notes++; },
      });
    };
    Stub.prototype.createGain = function () { return node(this, { gain: param() }); };
    Stub.prototype.createBiquadFilter = function () {
      window.__graph.filters++;
      return node(this, { type: "lowpass", frequency: param(), Q: param(), gain: param() });
    };
    Stub.prototype.createDynamicsCompressor = function () {
      window.__graph.comp++;
      return node(this, { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() });
    };
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
  // RESILIENT to a dropped hashchange: walking 200+ games in one context, the
  // browser can coalesce/drop a hashchange under load so the router never
  // switches and the screen stays hidden. Re-firing the hash (dummy → target)
  // forces a fresh event. Never weakens the assertion — the screen still MUST
  // appear; this just makes the trigger reliable so load can't redden CI.
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.evaluate((i) => { if (location.hash === "#" + i) location.hash = "#__renav"; location.hash = "#" + i; }, id);
    try { await page.locator(`#screen-${id}`).waitFor({ state: "visible", timeout: 5000 }); return; }
    catch (e) { /* dropped/slow under load — re-fire and retry */ }
  }
  await page.locator(`#screen-${id}`).waitFor({ state: "visible", timeout: 8000 });
}

test("the front door: boot lands on 3 world tiles; each opens its world DIRECTLY (no gates)", async () => {
  // By request (2026-07): the app opens on a start page — Josh's portrait tile,
  // 华丽's 👵🏻 tile, and the 🏰 fort tile — and the old name gates are GONE.
  await page.evaluate(() => { location.hash = ""; });
  await page.locator("#screen-start").waitFor({ state: "visible" });
  assert.equal(await page.locator("#start-josh .start-tile__art svg").count(), 1, "the Josh tile wears his JoshArt portrait");
  assert.equal(await page.locator(".hl-gate, .td-gate").count(), 0, "no name-gate overlay exists anywhere");
  // 👵🏻 → her world directly (red-gold theme on), and her 🏠 returns to the door.
  await page.locator("#start-hl").click();
  await page.locator("#screen-hl-home").waitFor({ state: "visible", timeout: 15000 });
  assert.ok(await page.evaluate(() => document.body.classList.contains("hl-mode")), "her world turns red-gold");
  await page.locator("#screen-hl-home .game__home").click();
  await page.locator("#screen-start").waitFor({ state: "visible", timeout: 15000 });
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("hl-mode"))), "leaving her world drops the theme");
  // 🏰 → the fort directly, and the fort's exit returns to the door.
  await page.locator("#start-td").click();
  await page.locator("#screen-td-home").waitFor({ state: "visible", timeout: 15000 });
  assert.ok(await page.evaluate(() => document.body.classList.contains("td-mode")), "the fort theme turns on");
  await page.locator("#screen-td-home .td-exit").click();
  await page.locator("#screen-start").waitFor({ state: "visible", timeout: 15000 });
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("td-mode"))), "leaving the fort drops the theme");
  // Josh's portrait → his launcher, and his 🚪 returns to the door.
  await page.locator("#start-josh").click();
  await page.locator("#screen-home").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#home-door").click();
  await page.locator("#screen-start").waitFor({ state: "visible", timeout: 15000 });
});

test("the registry has several games and every one has a home tile", async () => {
  const ids = await gameIds();
  assert.ok(ids.length >= 4, `expected several games, got ${ids.length}`);
  for (const id of ids) {
    assert.equal(await page.locator(`.tile[data-go="${id}"]`).count(), 1, `no tile for ${id}`);
  }
});

test("home → category → game navigation works", async () => {
  await page.evaluate(() => { location.hash = "#home"; });
  await page.locator("#screen-home").waitFor({ state: "visible" });
  const catTile = page.locator(".tile--cat").first();
  const catId = await catTile.getAttribute("data-cat");
  await catTile.click();
  await page.locator(`#screen-cat-${catId}`).waitFor({ state: "visible", timeout: 15000 });
  const tile = page.locator(`#screen-cat-${catId} .tile[data-go]`).first();
  const gid = await tile.getAttribute("data-go");
  await tile.click();
  await page.locator(`#screen-${gid}`).waitFor({ state: "visible", timeout: 15000 });
  assert.ok(await page.locator(`#screen-${gid}`).isVisible());
});

test("the in-game Home button returns to the game's category", async () => {
  const ids = await gameIds();
  await openGame(ids[0]);
  await page.locator(`#screen-${ids[0]} .game__home`).click();
  await page.waitForFunction((id) => document.getElementById("screen-" + id).hidden, ids[0], { timeout: 15000 });
  assert.ok((await page.locator(".screen.category:not([hidden])").count()) >= 1, "a category screen should show after Home");
});

test("the category back button returns to the home menu", async () => {
  await page.evaluate(() => { location.hash = "#cat-numbers"; });
  await page.locator("#screen-cat-numbers").waitFor({ state: "visible" });
  await page.locator("#screen-cat-numbers .game__home").click();
  await page.locator("#screen-home").waitFor({ state: "visible", timeout: 15000 });
  assert.ok(await page.locator("#screen-home").isVisible());
});

test("the Surprise tile jumps to a game", async () => {
  await page.evaluate(() => { location.hash = "#home"; });
  await page.locator("#screen-home").waitFor({ state: "visible" });
  // (scoped to Josh's home — 华丽's hidden home has its own Surprise tile)
  await page.locator("#screen-home .tile--surprise").click();
  await page.waitForFunction(() => location.hash.length > 1, null, { timeout: 15000 });
  assert.ok((await page.evaluate(() => location.hash)).length > 1, "should navigate to some game");
});

test("EVERY game plays end-to-end to a WIN — every game is collectible", async () => {
  // The systemic guardrail behind "every tile can earn its sticker": drive EVERY
  // registered game to screen.dataset.won === "1". Win-games are tapped via their
  // [data-correct] target; endless cause→effect toys (Hi Animals, Peekaboo, Music
  // Pad, Thwip the Villains) are tapped via [data-toy] and MUST reach a gentle
  // one-time win too, so the Sticker Book can hit 100% with no permanently-empty
  // slot. A future game that can never be won fails here — forcing either a win
  // state or a deliberate exclusion from the board.
  // …and while we are driving all of them, listen. Sound is the PRIMARY
  // instruction channel (a non-reader for Josh, a 70-year-old for 华丽), so a
  // spoken line built out of emoji is silence: "🌷 belongs in Spring!" is read
  // aloud as " belongs in Spring!", and 华丽's spot-the-difference games said
  // "对！变成了！" — the whole sentence was two pictures. Wrapping JoshAudio.say
  // catches the STRINGS whatever the mute state (the framework calls say()
  // unconditionally; say() itself no-ops when muted). Generic on purpose: this
  // found one game in each world, and it is how the class stops coming back.
  const SPOKEN_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
  await page.evaluate(() => {
    const A = window.JoshAudio, real = A.say.bind(A);
    window.__SAID = [];
    A.say = (t, o) => { window.__SAID.push(String(t)); return real(t, o); };
  });

  const ids = await gameIds();
  for (const id of ids) {
    await page.evaluate(() => { window.__SAID = []; });
    await openGame(id);
    const screen = page.locator(`#screen-${id}`);

    // Drive the contract with a DOM-level el.click() rather than a coordinate
    // (force) click: on a slow runner a growing/rebuilding field reflows or
    // scrolls between box-computation and dispatch, so a coordinate click can
    // repeatedly miss and the game gets "stuck" (observed on big-red-one's 16
    // inline-SVG cells under CPU load). A DOM click always hits the intended
    // element regardless of layout/scroll/overlay. Real touch realism (sizes, no
    // overlap, tappable) is covered separately by mobile.test.js's actual .tap().
    // Each iteration: tap the currently-correct target if there is one, else tap a
    // live toy control — so the SAME loop wins both win-games and endless toys.
    // 800 iterations ≈ taps + idle 20ms polls — headroom for games with
    // presentation beats (a demo to watch, a cloud that drifts in, a splash
    // between rounds; the echo games spend ~8s just demonstrating). Fast games
    // exit the loop the moment they win, so the cap only bounds the SLOWEST game.
    let won = false;
    for (let i = 0; i < 800 && !won; i++) {
      won = await screen.evaluate((el) => el.dataset.won === "1");
      if (won) break;
      let target = screen.locator('[data-correct="1"]').first();
      if ((await target.count()) === 0) target = screen.locator("[data-toy]").first();
      if ((await target.count()) === 0) { await page.waitForTimeout(20); continue; }
      try { await target.evaluate((el) => el.click()); }
      catch (e) { await page.waitForTimeout(20); } // element detached mid-rebuild — re-query next loop
    }
    won = await screen.evaluate((el) => el.dataset.won === "1");
    assert.ok(won, `game "${id}" never reached a win — every game must be collectible (winnable)`);

    // Nothing this game SAID may be a picture (see the note above the loop).
    const said = await page.evaluate(() => window.__SAID);
    const mute = said.filter((line) => SPOKEN_EMOJI.test(line));
    assert.deepEqual(mute, [],
      `game "${id}" SPEAKS an emoji — a picture is silence on the audio channel. Give it a name (SEASON_ITEM_NAMES / SPOT_NAMES are the precedent): ${mute.join(" | ")}`);

    // Winning reveals a working "Again" button that resets the won state.
    const again = screen.locator(".game__again");
    assert.ok(await again.isVisible(), `game "${id}" should show Again after winning`);
    await again.click();
    assert.equal(await screen.evaluate((el) => el.dataset.won || ""), "", `Again should reset "${id}"`);
  }
});

test("beating games marks them with a ⭐ on the launcher", async () => {
  // The previous test won every win-game; each should now carry a badge.
  await page.evaluate(() => { location.hash = "#home"; });
  await page.locator("#screen-home").waitFor({ state: "visible" });
  const badges = await page.locator(".tile__badge").count();
  assert.ok(badges >= 3, `expected several beaten-game star badges, got ${badges}`);
  // …and the trophy must not sit ON the picture. The tile's emoji is the only
  // cue a non-reader has, and the badge was overlapping it by 4x11px (the star
  // landing on 🧱's bricks, on ⚖️'s beam). The tile reserves a badge corner
  // now. It cannot reach zero on a 109px card with a centred 42px glyph — 6px
  // is a corner nick — so the bar is where the geometry actually lands.
  const worst = await page.evaluate(() => {
    let ox = 0, oy = 0;
    for (const b of document.querySelectorAll("#screen-home .tile__badge")) {
      const icon = b.parentElement.querySelector(".tile__icon");
      if (!icon) continue;
      const r = b.getBoundingClientRect(), i = icon.getBoundingClientRect();
      ox = Math.max(ox, Math.min(r.right, i.right) - Math.max(r.left, i.left));
      oy = Math.max(oy, Math.min(r.bottom, i.bottom) - Math.max(r.top, i.top));
    }
    return { ox: Math.round(ox), oy: Math.round(oy) };
  });
  assert.ok(worst.ox <= 6 || worst.oy <= 6,
    `the ⭐ badge must not cover the tile's picture — it overlaps the icon box by ${worst.ox}x${worst.oy}px`);
});

test("no two games on the SAME category screen wear the same picture", async () => {
  // RULE 5's first law is "zero reading required — icons carry the play". On
  // #cat-numbers a four-year-old saw THREE identical 🔟 tiles (Build the
  // Number, Ten & Some More, Make Ten); the only thing separating them was a
  // 12.8px English label he cannot read, so he could tell them apart solely by
  // remembering grid position. Measured on the shipped registry: 21 groups,
  // 45 of 240 tiles. This is the same defect the fort's pixel-hash guardrail
  // exists to catch ("no two enemy types may render identically") — never
  // applied to the ONE surface every game is reached through.
  //
  // Deliberately PER-CATEGORY, not global: cross-category reuse is fine
  // (a child never sees #cat-science and #cat-find side by side), and this
  // must read the live registry, because a Node require only loads part of it.
  const dupes = await page.evaluate(() => {
    const by = {};
    for (const g of (window.JoshGames || [])) {
      const cat = g.hl ? "华丽/" + (g.hlCat || "?") : (g.cat || "?");
      ((by[cat] = by[cat] || {})[g.icon] = by[cat][g.icon] || []).push(g.id);
    }
    const out = [];
    for (const [cat, icons] of Object.entries(by)) {
      for (const [icon, ids] of Object.entries(icons)) if (ids.length > 1) out.push(`${cat}: ${icon} on ${ids.join(", ")}`);
    }
    return out;
  });
  assert.equal(dupes.length, 0,
    `every tile on a category screen must be a DIFFERENT picture — ${dupes.join(" | ")}`);
});

test("华丽's world names itself in the top bar, and Josh's names his", async () => {
  // The sticky bar is the one element on screen 100% of the time, and it said
  // "Josh's Games" in every world — English, in Josh's blue, inside her
  // red-gold world, for the only person here who reads. route() owns the name
  // (a per-world init goes stale on the junk-hash path, the documented
  // #hl-* theme bug), so it must also flip BACK on the way out.
  const brand = page.locator(".brand");
  await page.evaluate(() => { location.hash = "#home"; });
  await page.locator("#screen-home").waitFor({ state: "visible" });
  assert.equal((await brand.textContent()).trim(), "Josh's Games", "his world keeps his name");
  await page.evaluate(() => { location.hash = "#hl-home"; });
  await page.locator("#screen-hl-home").waitFor({ state: "visible" });
  const zh = await page.evaluate(() => window.HualiContent.BRAND);
  assert.equal((await brand.textContent()).trim(), zh, "her world says her name");
  await page.evaluate(() => { location.hash = "#hl-poem"; });
  await page.locator("#screen-hl-poem").waitFor({ state: "visible" });
  assert.equal((await brand.textContent()).trim(), zh, "…on her game screens too");
  await page.evaluate(() => { location.hash = "#home"; });
  await page.locator("#screen-home").waitFor({ state: "visible" });
  assert.equal((await brand.textContent()).trim(), "Josh's Games", "and it flips back on the way out");
  // Her home EXITS to the front door (🚪); a category returns to her home (🏠).
  await page.evaluate(() => { location.hash = "#hl-home"; });
  await page.locator("#screen-hl-home").waitFor({ state: "visible" });
  assert.equal(await page.locator("#screen-hl-home .game__home").textContent(), "🚪", "her home's button is the exit");
  await page.locator("#screen-hl-home .game__home").click();
  await page.locator("#screen-start").waitFor({ state: "visible" });
  await page.evaluate(() => { location.hash = "#hl-cat-hlc-words"; });
  await page.locator("#screen-hl-cat-hlc-words").waitFor({ state: "visible" });
  assert.equal(await page.locator("#screen-hl-cat-hlc-words .game__home").textContent(), "🏠", "a category's button goes home");
  await page.locator("#screen-hl-cat-hlc-words .game__home").click();
  await page.locator("#screen-hl-home").waitFor({ state: "visible" });
});

test("the Sticker Book has one slot per game and fills the ones Josh has won", async () => {
  // The every-game test above won every win-game, so the book should be full.
  await page.evaluate(() => { location.hash = "#home"; });
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

  // A home tile opens the book. (Scoped: 华丽's home has her own 🏮 tile.)
  await page.locator("#screen-home .tile--stickers").click();
  await page.locator("#screen-stickers").waitFor({ state: "visible", timeout: 15000 });

  // Josh's book holds one slot per JOSH game; 华丽's hidden games (def.hl)
  // live in her own 🏮 book (tested separately) and must NOT leak into his.
  const slots = await page.locator("#screen-stickers .sticker-slot").count();
  const games = await page.evaluate(() => (window.JoshGames || []).filter((g) => !g.hl).length);
  assert.equal(slots, games, "the Sticker Book must have exactly one slot per Josh game");

  const filled = await page.locator("#screen-stickers .sticker-slot.is-won").count();
  assert.ok(filled >= 3, `won games should fill sticker slots, got ${filled}`);
  const meter = await page.locator("#screen-stickers .sticker-meter__text").textContent();
  assert.match(meter || "", /\d+\s*\/\s*\d+/, "the star meter should show a filled / total count");

  // Tapping a FILLED sticker replays that game (navigates to its screen).
  const wonSlot = page.locator("#screen-stickers .sticker-slot.is-won").first();
  const gid = await wonSlot.getAttribute("data-sticker");
  await wonSlot.click();
  await page.locator(`#screen-${gid}`).waitFor({ state: "visible", timeout: 15000 });
  assert.ok(await page.locator(`#screen-${gid}`).isVisible(), "a won sticker should replay its game on tap");
});

test("grown-ups gate: only the word 'reset' clears the ⭐ badges", async () => {
  // The previous test won games, so badges exist now. The gate must reject
  // everything except the word "reset" (any case) and clear the badges + flags.
  await page.evaluate(() => { location.hash = "#home"; });
  await page.locator("#screen-home").waitFor({ state: "visible" });
  const before = await page.locator(".tile__badge").count();
  assert.ok(before >= 1, `expected badges to reset, got ${before}`);
  // The two worlds' resets are INDEPENDENT: seed a fort save and prove Josh's
  // reset leaves it byte-identical (the fort's own ⚙️ reset is the only thing
  // that clears it — see the mirror assertion in tests/td.test.js).
  const FORT_SAVE = JSON.stringify({
    v: 1, stars: { casual: {}, normal: { 1: 3, 2: 2 }, heroic: {} },
    settings: { sfx: true, music: false, dmgNumbers: false }, difficulty: "normal",
    meta: ["dartdmg"], ach: ["firstblood"], endlessBest: { bedroom: 9 }, midRun: null,
  });
  await page.evaluate((s) => { localStorage.setItem("jon-td-save-v1", s); }, FORT_SAVE);

  await page.locator("#reset-stars").click();
  await page.locator(".gate").waitFor({ state: "visible" });

  // A wrong word clears NOTHING and shows a gentle error.
  await page.locator(".gate__input").fill("banana");
  await page.locator(".gate__ok").click();
  assert.equal(await page.locator(".tile__badge").count(), before, "a wrong word must not clear badges");
  assert.ok(await page.locator(".gate__err").isVisible(), "wrong word shows the error");

  // The correct word — case-insensitive — clears JOSH's badges and won-flags.
  // 华丽's hidden world keeps hers: her stars are not part of Josh's reset.
  await page.locator(".gate__input").fill("Reset");
  await page.locator(".gate__ok").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".screen:not(.hl-screen) .tile__badge, #home-grid .tile__badge").length === 0,
    null, { timeout: 15000 }
  );
  assert.equal(
    await page.locator(".screen:not(.hl-screen) .tile__badge, #home-grid .tile__badge").count(), 0,
    "‘Reset’ clears every Josh badge"
  );
  const flags = await page.evaluate(() => {
    let josh = 0, hl = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      if (k.indexOf("josh-won-hl-") === 0) hl++;
      else if (k.indexOf("josh-won-") === 0) josh++;
    }
    return { josh, hl };
  });
  assert.equal(flags.josh, 0, "the josh-won-* flags are cleared too");
  assert.ok(flags.hl >= 1, "华丽's josh-won-hl-* flags must SURVIVE Josh's reset");
  assert.ok(
    (await page.locator(".hl-screen .tile__badge").count()) >= 1,
    "华丽's tile badges must survive Josh's reset"
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("jon-td-save-v1")), FORT_SAVE,
    "🏰 Fort Josh's save must survive Josh's reset UNTOUCHED — the two resets are independent"
  );

  // The reset must also EMPTY the Sticker Book (slots + star meter), not just tiles.
  await page.evaluate(() => { location.hash = "#stickers"; });
  await page.locator("#screen-stickers").waitFor({ state: "visible", timeout: 15000 });
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
  await screen.waitFor({ state: "visible", timeout: 15000 });
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
  await screen.waitFor({ state: "visible", timeout: 15000 });
  let won = false;
  for (let i = 0; i < 80 && !won; i++) {
    won = await screen.evaluate((el) => el.dataset.won === "1");
    if (won) break;
    const correct = screen.locator('[data-correct="1"]').first();
    if ((await correct.count()) === 0) { await page.waitForTimeout(20); continue; }
    try { await correct.evaluate((el) => el.click()); } catch (e) { await page.waitForTimeout(20); }
  }
  assert.ok(won, "odd-one-out should reach a win");
  await page.waitForFunction(() => (window.__notes || 0) >= 1, null, { timeout: 15000 });
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
  await page.waitForFunction(() => document.getElementById("screen-number-muncher").dataset.streak === "1", null, { timeout: 15000 });

  // Round B — miss once (wrong card = a gentle try-again), THEN win → streak resets to 0.
  await screen.locator('.muncher__card:not([data-correct="1"])').first().evaluate((el) => el.click());
  assert.equal(await screen.evaluate((el) => el.dataset.won || ""), "", "a wrong tap must never win");
  await screen.locator('.muncher__card[data-correct="1"]').first().evaluate((el) => el.click());
  await page.waitForFunction(() => document.getElementById("screen-number-muncher").dataset.streak === "0", null, { timeout: 15000 });
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
  await page.evaluate(() => { location.hash = "#home"; });
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
  // The .win-hero pop is removed 1700ms after the win, so read the won flag AND
  // capture the pop's HTML in the SAME evaluate — atomically, the instant the win
  // is detected (the element was just appended synchronously) — never racing the
  // removal timer under slow CI. Read the LAST pop: a prior win on this screen can
  // leave a stale pop (with the DEFAULT buddy) briefly present, and the fresh pop
  // is appended after it — querySelector(first) could grab the stale one.
  let won = false, popHtml = "";
  for (let i = 0; i < 100 && !won; i++) {
    const st = await screen.evaluate((el) => {
      const pops = el.querySelectorAll(".win-hero");
      const wh = pops.length ? pops[pops.length - 1] : null;
      return { won: el.dataset.won === "1", pop: wh ? wh.innerHTML : "" };
    });
    won = st.won;
    if (won) { popHtml = st.pop; break; } // capture the pop atomically with the win
    const correct = screen.locator('[data-correct="1"]').first();
    if ((await correct.count()) === 0) { await page.waitForTimeout(20); continue; }
    try { await correct.evaluate((el) => el.click()); } catch (e) { await page.waitForTimeout(20); }
  }
  assert.ok(won, "odd-one-out should reach a win");
  // Normalise the expected buddy art through the DOM (innerHTML re-serialises SVG).
  const expected = await page.evaluate(() => { const t = document.createElement("div"); t.innerHTML = window.JoshBuddy.art(); return t.innerHTML; });
  assert.ok(popHtml && popHtml === expected, "the win celebration must pop the chosen buddy's art");
});

test("winning brings the Again button INTO VIEW, and the buddy pop never covers it", async () => {
  // MEASURED 2026-07 on the shipped build, driving real wins at five viewports:
  // the just-revealed Again button landed BELOW THE FOLD on a 320x568 phone in
  // odd-one-out (37px past the bottom) and music-pad (35px), on a 360x640 in
  // count-feed (64px), and 156-220px down in EVERY game sampled in landscape.
  // Josh wins and the one button he wants is off the screen. Nothing tested it,
  // because the win tests only ever read screen.dataset.won.
  // The pop is the other half: it is position:fixed, so at some heights its
  // bottom edge sat exactly where the Again button's top is.
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 } });
  const p = await ctx.newPage();
  try {
    for (const id of ["odd-one-out", "music-pad"]) {
      await p.goto(baseURL + "#" + id, { waitUntil: "load" });
      const screen = p.locator("#screen-" + id);
      await screen.waitFor({ state: "visible" });
      let won = false;
      for (let i = 0; i < 300 && !won; i++) {
        won = await screen.evaluate((el) => el.dataset.won === "1");
        if (won) break;
        const hit = await screen.evaluate((el) => {
          const t = el.querySelector('[data-correct="1"]') || el.querySelector("[data-toy]");
          if (!t) return false; t.click(); return true;
        });
        if (!hit) await p.waitForTimeout(20);
      }
      assert.ok(won, `${id} should reach a win`);
      await p.waitForTimeout(500); // let the scroll settle
      const m = await p.evaluate((gid) => {
        const s = document.getElementById("screen-" + gid);
        const ag = s.querySelector(".game__again");
        const hero = document.querySelector(".win-hero");
        const R = (e) => { const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom) }; };
        return { again: ag && !ag.hidden ? R(ag) : null, hero: hero ? R(hero) : null, vh: innerHeight };
      }, id);
      assert.ok(m.again, `${id}: the Again button is shown after a win`);
      assert.ok(m.again.t >= 0 && m.again.b <= m.vh,
        `${id}: Again must be ON SCREEN after a win (top ${m.again.t}, bottom ${m.again.b}, viewport ${m.vh})`);
      if (m.hero) {
        assert.ok(m.hero.b <= m.again.t,
          `${id}: the buddy pop must sit clear ABOVE the Again button (pop bottom ${m.hero.b}, button top ${m.again.t})`);
        assert.ok(m.hero.t >= 0 && m.hero.b <= m.vh,
          `${id}: the buddy pop stays in view (top ${m.hero.t}, bottom ${m.hero.b}, viewport ${m.vh})`);
      }
    }
    // The pop is position:FIXED, so whether it lands on the button depends only
    // on its `bottom` offset versus the space the Again button reserves at the
    // foot of a page whose content FITS. Measure that reserve from the app (a
    // tall viewport where nothing scrolls) rather than hard-coding it, then
    // check the pop clears it at every short height — a plain percentage does
    // not (14% of 640 is 90px against a 92px reserve, which is the 2px overlap
    // that was measured on the shipped build).
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(120);
    const reserve = await p.evaluate(() => {
      const ag = document.querySelector(".screen:not([hidden]) .game__again");
      return ag && !ag.hidden ? Math.round(innerHeight - ag.getBoundingClientRect().top) : null;
    });
    assert.ok(reserve && reserve > 0, "measured the space the Again button reserves at the foot of a page that fits");
    for (const vh of [568, 640, 700, 844]) {
      await p.setViewportSize({ width: 390, height: vh });
      await p.waitForTimeout(60);
      const bottom = await p.evaluate(() => {
        const d = document.createElement("div");
        d.className = "win-hero";
        document.body.appendChild(d);
        const v = parseFloat(getComputedStyle(d).bottom);
        d.remove();
        return v;
      });
      assert.ok(bottom >= reserve,
        `at ${vh}px tall the buddy pop sits ${bottom}px up, but the Again button reserves ${reserve}px — the pop would land on the button`);
    }
  } finally { await ctx.close(); }
});

test("What Time? draws both clock hands (half-past tier ready)", async () => {
  await openGame("clock");
  const lines = await page.locator("#screen-clock .clock svg line").count();
  assert.ok(lines >= 2, `the clock must draw an hour AND a minute hand, got ${lines}`);
});

test("Picture Squares ramps to a 4×4 grid after a clean streak (adaptive tier)", async () => {
  await openGame("picture-squares");
  const screen = page.locator("#screen-picture-squares");
  const again = screen.locator(".game__again");
  if (await again.isVisible().catch(() => false)) await again.click();
  // Two clean wins → api.shouldRamp(2) engages → the next round is the 4×4 tier.
  for (let r = 0; r < 2; r++) {
    await screen.locator('.choice[data-correct="1"]').first().evaluate((el) => el.click());
    await page.waitForTimeout(40);
  }
  await page.waitForFunction(
    () => { const g = document.querySelector("#screen-picture-squares .sudoku__grid"); return g && g.classList.contains("sudoku__grid--4"); },
    null, { timeout: 15000 }
  );
  assert.equal(await screen.locator(".sudoku__cell").count(), 16, "the 4×4 tier has 16 cells");
  assert.equal(await screen.locator(".choices .choice").count(), 4, "the 4×4 tier offers 4 picture choices");
});

test("Thwip the Villains: tapping a baddie webs it (no-fail cause→effect toy)", async () => {
  await openGame("thwip-villains");
  const screen = page.locator("#screen-thwip-villains");
  const count = await screen.locator(".villain").count();
  assert.ok(count >= 4, `expected a batch of baddies, got ${count}`);
  const first = screen.locator(".villain").first();
  assert.ok(!(await first.evaluate((el) => el.classList.contains("villain--webbed"))), "a baddie starts un-webbed");
  await first.evaluate((el) => el.click());
  assert.ok(await first.evaluate((el) => el.classList.contains("villain--webbed")), "tapping a baddie wraps it in a web");
  // Webbing consumes it (no data-toy) so play moves on — and there is no fail state.
  assert.equal(await first.evaluate((el) => el.dataset.toy || ""), "", "a webbed baddie is consumed");
  // A single web is NOT yet a win — only clearing the whole batch earns the sticker
  // (so the endless toy is still collectible without a win firing on every tap).
  assert.equal(await screen.evaluate((el) => el.dataset.won || ""), "", "one web must not win — no fail/early-win state");
});

test("the Music Pad actually plays notes on iOS (audio fires only once the context is RUNNING)", async () => {
  await page.evaluate(() => { window.__notes = 0; window.__startedWhileSuspended = 0; });
  await openGame("music-pad");
  const pads = page.locator("#screen-music-pad .music__pad");
  await pads.nth(0).click();
  await pads.nth(2).click();
  await pads.nth(4).click();
  // Notes fire only after the async resume() resolves — wait for them.
  await page.waitForFunction(() => (window.__notes || 0) >= 2, null, { timeout: 15000 });
  const notes = await page.evaluate(() => window.__notes || 0);
  const bad = await page.evaluate(() => window.__startedWhileSuspended || 0);
  assert.ok(notes >= 2, `tapping pads should start notes; got ${notes}`);
  // The iOS regression: scheduling a note while suspended plays it in the past → silent.
  assert.equal(bad, 0, `notes must never start while the context is suspended (got ${bad}; that is silent on iOS)`);
});

test("the 4 endless toys are each collectible — they reach a gentle one-time win", async () => {
  // Hi Animals, Peekaboo, Music Pad and Thwip the Villains have no quiz answer;
  // each now earns its sticker after a little play (then keeps playing forever),
  // so no Sticker Book slot is permanently empty and the star meter can reach 100%.
  for (const id of ["animals", "peekaboo", "music-pad", "thwip-villains"]) {
    await openGame(id);
    const screen = page.locator(`#screen-${id}`);
    const again = screen.locator(".game__again");
    if (await again.isVisible().catch(() => false)) await again.click(); // fresh, un-won round
    assert.equal(await screen.evaluate((el) => el.dataset.won || ""), "", `${id} should start un-won`);

    let won = false;
    for (let i = 0; i < 80 && !won; i++) {
      won = await screen.evaluate((el) => el.dataset.won === "1");
      if (won) break;
      const toy = screen.locator("[data-toy]").first();
      if ((await toy.count()) === 0) { await page.waitForTimeout(20); continue; }
      try { await toy.evaluate((el) => el.click()); } catch (e) { await page.waitForTimeout(20); }
    }
    assert.ok(won, `endless toy "${id}" must reach a gentle win so its sticker is earnable`);
    // The win is recorded like every other game's (JoshProgress owns josh-won-<id>),
    // which is exactly what fills the tile badge and the Sticker Book slot.
    const flagged = await page.evaluate((i) => !!(window.JoshProgress && window.JoshProgress.isWon(i)), id);
    assert.ok(flagged, `${id}'s win must record its josh-won flag (fills the Sticker Book slot)`);
  }
});

test("Make an Island: tap the MIDDLE to place the feature, surrounded on all sides", async () => {
  await openGame("landform-maker");
  const screen = page.locator("#screen-landform-maker");
  const cells = screen.locator(".lf__cell");
  await cells.first().waitFor({ state: "visible" });
  assert.equal(await cells.count(), 9, "a 3×3 landform grid");

  // The ONLY correct tap is the centre (index 4) — so "Tap the middle" is now true.
  assert.equal(await screen.locator('.lf__cell[data-correct="1"]').count(), 1, "exactly one target");
  const targetIndex = await screen.evaluate(() =>
    [...document.querySelectorAll("#screen-landform-maker .lf__cell")].findIndex((c) => c.dataset.correct === "1")
  );
  assert.equal(targetIndex, 4, "the target is the CENTRE of the 3×3");

  // The grid starts as one surround everywhere (all ocean / all field).
  const before = await cells.evaluateAll((els) => els.map((e) => e.textContent));
  const base = before[0];
  assert.ok(before.every((t) => t === base), "the grid starts as a single surround (the water/land 'all around')");

  // Tapping AROUND the middle is a gentle nudge — never a win, and it changes nothing.
  await cells.nth(0).evaluate((el) => el.click());
  assert.equal(await screen.evaluate((el) => el.dataset.won || ""), "", "tapping the surround never wins");
  assert.equal(await cells.nth(0).textContent(), base, "a surround tap leaves the surround unchanged");

  // Tap the MIDDLE → it becomes the feature, with the base on ALL 8 sides. Snapshot
  // atomically (the round auto-advances ~1s later) so we read THIS landform.
  await cells.nth(4).evaluate((el) => el.click());
  const snap = await screen.evaluate(() => {
    const el = document.getElementById("screen-landform-maker");
    const texts = [...el.querySelectorAll(".lf__cell")].map((c) => c.textContent);
    const rev = el.querySelector(".lf__reveal");
    return { texts, reveal: rev ? rev.textContent : "" };
  });
  assert.notEqual(snap.texts[4], base, "the middle becomes the landform feature");
  assert.ok(snap.texts.filter((_, i) => i !== 4).every((t) => t === base),
    "the feature is surrounded by the base on ALL sides (matches 'X with Y all around')");
  assert.ok(snap.reveal.length > 0, "a reveal picture pops on the landform it celebrates");

  // Finish the same way — tap the middle each round — to a win.
  let won = false;
  for (let i = 0; i < 160 && !won; i++) {
    won = await screen.evaluate((el) => el.dataset.won === "1");
    if (won) break;
    const c = screen.locator('.lf__cell[data-correct="1"]').first();
    if ((await c.count()) === 0) { await page.waitForTimeout(20); continue; }
    try { await c.evaluate((el) => el.click()); } catch (e) { await page.waitForTimeout(20); }
  }
  assert.ok(won, "Make an Island reaches a win by tapping the middle each round");
});

test("toddler chaos guardrail: hammer double-taps can't double-celebrate, soft-lock, or crash", async () => {
  // The chaos audit found three real bug classes under DOUBLE-clicked taps (a
  // 4-year-old hammer-taps everything): (1) framework win() ran twice off the
  // doubled final tap (two buddy pops) — now guarded in ONE place; (2) the
  // pick-and-place games toggled the held item back OUT on the second tap
  // (pick→unpick = net nothing, soft-lock); (3) set-clock's mover advanced 2
  // hours per gesture (odd distance + wrap = never lands), the echo games wiped
  // the whole echo on the doubled re-hit, and team-bridge/pattern-fix indexed
  // past their arrays (TypeError). Drive each representative to a win clicking
  // EVERY target twice; assert it wins, with at most ONE celebration pop.
  const CHAOS_IDS = [
    "odd-one-out",                                            // win()-guard representative
    "set-table", "team-puzzle", "tidy-up", "match-all", "fix-toys", "partner-up", // pick-and-place
    "set-clock", "copy-beat", "hl-echo",                      // parity trap + echo forgiveness
    "team-bridge", "pattern-fix",                             // double-advance crashes
  ];
  for (const id of CHAOS_IDS) {
    await openGame(id);
    const screen = page.locator(`#screen-${id}`);
    const again = screen.locator(".game__again");
    if (await again.isVisible().catch(() => false)) await again.click(); // fresh run
    let won = false, pops = 0;
    for (let i = 0; i < 800 && !won; i++) {
      const st = await screen.evaluate((el) => ({
        won: el.dataset.won === "1", pops: el.querySelectorAll(".win-hero").length,
      }));
      if (st.won) { won = true; pops = st.pops; break; } // pops read atomically with the win
      let target = screen.locator('[data-correct="1"]').first();
      if ((await target.count()) === 0) target = screen.locator("[data-toy]").first();
      if ((await target.count()) === 0) { await page.waitForTimeout(20); continue; }
      try { await target.evaluate((el) => { el.click(); el.click(); }); } // the toddler hammer-tap
      catch (e) { await page.waitForTimeout(20); }
    }
    assert.ok(won, `game "${id}" must still be winnable when every tap is a double-tap`);
    assert.ok(pops <= 1, `game "${id}" must celebrate ONCE on a doubled final tap, got ${pops} pops`);
  }
});

// ================= 华丽的世界 (grandma's world) =================

test("华丽 entry: her world opens directly from the front door — no gate, greeted by name", async () => {
  // The old Chinese name gate was removed by request (2026-07): the 👵🏻 tile
  // (and a plain #hl-home deep link) opens her red-gold world immediately.
  await page.evaluate(() => { location.hash = ""; });
  await page.locator("#screen-start").waitFor({ state: "visible" });
  await page.locator("#start-hl").click();
  await page.locator("#screen-hl-home").waitFor({ state: "visible", timeout: 15000 });
  assert.equal(await page.locator(".hl-gate").count(), 0, "no name gate exists any more");
  assert.ok(await page.evaluate(() => document.body.classList.contains("hl-mode")), "her world turns on the red-gold theme");
  const hello = await page.locator(".hl-hello").textContent();
  assert.ok(hello.includes("华丽"), "the home screen greets her by name");
});

test("华丽 home: 7 categories + surprise + sticker tiles; a category lists her games", async () => {
  const catTiles = await page.locator("#screen-hl-home .tile--cat").count();
  assert.equal(catTiles, 7, "all 7 of her categories have tiles");
  assert.equal(await page.locator("#screen-hl-home .tile--surprise").count(), 1);
  assert.equal(await page.locator("#screen-hl-home .tile--stickers").count(), 1);

  const firstCat = page.locator("#screen-hl-home .tile--cat").first();
  const catId = await firstCat.getAttribute("data-cat");
  await firstCat.click();
  await page.locator(`#screen-hl-cat-${catId}`).waitFor({ state: "visible", timeout: 15000 });
  const gameTiles = await page.locator(`#screen-hl-cat-${catId} .tile[data-go]`).count();
  assert.ok(gameTiles >= 4, `her ${catId} category should list several games, got ${gameTiles}`);
  // Every tile in her world routes to an hl- game.
  const gos = await page.evaluate((id) =>
    [...document.querySelectorAll(`#screen-hl-cat-${id} .tile[data-go]`)].map((t) => t.dataset.go), catId);
  for (const g of gos) assert.match(g, /^hl-/, `tile ${g} in her category must be an hl- game`);
});

test("华丽 world spans 40 games across her 7 categories, all Chinese-titled", async () => {
  const info = await page.evaluate(() => {
    const hl = (window.JoshGames || []).filter((g) => g.hl);
    const byCat = {};
    hl.forEach((g) => { byCat[g.hlCat] = (byCat[g.hlCat] || 0) + 1; });
    return {
      count: hl.length,
      byCat,
      allZh: hl.every((g) => g.lang === "zh"),
      allPrefixed: hl.every((g) => g.id.indexOf("hl-") === 0),
      allTitled: hl.every((g) => /[一-鿿]/.test(g.title)),
    };
  });
  assert.equal(info.count, 40, "her world must hold 40 games");
  assert.ok(info.allZh, "every hl game speaks Chinese (lang zh)");
  assert.ok(info.allPrefixed, "every hl game id is hl- prefixed");
  assert.ok(info.allTitled, "every hl game title is Chinese");
  for (const [cat, n] of Object.entries(info.byCat)) {
    assert.ok(n >= 4, `category ${cat} should hold >= 4 games, got ${n}`);
  }
});

test("华丽 game screens speak her language: zh chrome + Again label", async () => {
  await page.evaluate(() => { location.hash = "#hl-anton"; });
  const screen = page.locator("#screen-hl-anton");
  await screen.waitFor({ state: "visible", timeout: 15000 });
  assert.ok(await screen.evaluate((el) => el.classList.contains("game--hl")), "her screens carry the hl theme class");
  const again = await screen.locator(".game__again").evaluate((el) => el.textContent);
  assert.ok(again.includes("再来"), "the Again button reads 再来");
});

test("华丽 sticker book: one slot per hl game, filled by the wins, meter at 40", async () => {
  // The every-game harness earlier won ALL games (hers included).
  await page.evaluate(() => { location.hash = "#hl-stickers"; });
  await page.locator("#screen-hl-stickers").waitFor({ state: "visible", timeout: 15000 });
  const slots = await page.locator("#screen-hl-stickers .sticker-slot").count();
  assert.equal(slots, 40, "her book must hold exactly one slot per hl game");
  const won = await page.locator("#screen-hl-stickers .sticker-slot.is-won").count();
  assert.equal(won, 40, "after winning every game her book is full");
  const meter = await page.locator("#screen-hl-stickers .sticker-meter__text").textContent();
  assert.match(meter || "", /40\s*\/\s*40/, "her star meter reads 40 / 40");
  // A filled slot replays its game.
  const slot = page.locator("#screen-hl-stickers .sticker-slot.is-won").first();
  const gid = await slot.getAttribute("data-sticker");
  await slot.click();
  await page.locator(`#screen-${gid}`).waitFor({ state: "visible", timeout: 15000 });
});

test("华丽 nav: her home is openly deep-linkable, and a junk hash lands on the front door", async () => {
  // No gate: a plain #hl-home deep link opens her world (grandma can bookmark
  // it). A junk #hl-* hash must still clear to the front door WITHOUT painting
  // the red-gold theme over it (the junk-hash theme lesson).
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(50);
  await page.evaluate(() => { location.hash = "#hl-home"; });
  await page.locator("#screen-hl-home").waitFor({ state: "visible", timeout: 15000 });
  assert.ok(await page.evaluate(() => document.body.classList.contains("hl-mode")), "deep-linked hl-home paints her theme");
  await page.evaluate(() => { location.hash = "#hl-nonexistent"; });
  await page.waitForFunction(() => location.hash === "", null, { timeout: 15000 });
  await page.locator("#screen-start").waitFor({ state: "visible", timeout: 15000 });
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("hl-mode"))), "a junk hl-* hash never leaves the theme painted");
});


test("AUDIT: hammer-tapping a toy never stacks confetti canvases (ONE shared canvas, capped pool)", async () => {
  // A toddler taps 40 times in a burst; each old burst() made a NEW full-screen
  // canvas + rAF loop (66 concurrent canvases, 59→14fps). The singleton keeps it
  // to at most one canvas total.
  await page.evaluate(() => { location.hash = "#bubbles"; });
  await page.locator("#screen-bubbles").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(300);
  const counts = await page.evaluate(async () => {
    let maxCanvases = 0;
    for (let i = 0; i < 40; i++) {
      window.JoshEffects.confetti({ count: 30 });
      if (i % 5 === 0) await new Promise((r) => setTimeout(r, 16));
      maxCanvases = Math.max(maxCanvases, document.querySelectorAll("body > canvas").length);
    }
    return maxCanvases;
  });
  assert.ok(counts <= 1, `at most ONE shared confetti canvas may exist (saw ${counts})`);
});

test("AUDIT: a navigated-away game falls SILENT and stops advancing (api.later + speech gate)", async () => {
  // duck-add defers its next round ~900ms after a correct answer. Hop away
  // inside that window: the hidden screen's timer must be cleared (prompt does
  // not change) and no utterance may be in flight after the route's cancel.
  await page.evaluate(() => { location.hash = "#duck-add"; });
  await page.locator("#screen-duck-add").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => document.querySelector("#screen-duck-add .game__prompt-text, #screen-duck-add .game__prompt")?.textContent || "");
  await page.locator('#screen-duck-add [data-correct]').first().click();
  await page.evaluate(() => { location.hash = "#home"; }); // hop home mid-defer
  await page.locator("#screen-home").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(1300); // past the 900ms deferred newRound
  const after = await page.evaluate(() => document.querySelector("#screen-duck-add .game__prompt-text, #screen-duck-add .game__prompt")?.textContent || "");
  assert.equal(after, before, "the hidden game must not advance its round after navigation (timer cleared)");
  const speaking = await page.evaluate(() => !!(window.speechSynthesis && window.speechSynthesis.speaking));
  assert.ok(!speaking, "no utterance may still be speaking after the route cancelled speech");
});

test("Dump Truck!: the rig is DRAWN, and it fills then TIPS (the namesake game)", async () => {
  // It shipped as a 🚚 delivery-van emoji beside a flat orange div. The
  // every-game harness proved it winnable the whole time, because a tap harness
  // cannot see that the picture never changed — the same blind spot that let a
  // dead ▶ reveal control and three invisible Fan variants ship green. So drive
  // the real controls and read the drawing.
  await page.evaluate(() => { location.hash = "#dump-truck"; });
  await page.waitForTimeout(200);
  const rocksIn = () => page.evaluate(() =>
    (document.querySelector(".truck__rig").innerHTML.match(/fill="#8d8b86"/g) || []).length);
  const tipOf = () => page.evaluate(() => {
    const m = document.querySelector(".truck__rig").innerHTML.match(/rotate\((-?[\d.]+)/);
    return m ? Number(m[1]) : null;
  });
  assert.ok(await page.evaluate(() => !!document.querySelector(".truck__rig svg")),
    "the rig is an SVG drawing, not an emoji span");
  assert.equal(await rocksIn(), 0, "it starts empty");
  assert.equal(await tipOf(), 0, "…and level");
  // Load every rock this round offers, checking the bed fills as we go.
  const rocks = page.locator(".truck__rock:not([disabled])");
  const n = await rocks.count();
  assert.ok(n >= 3, `the round offers rocks to load (got ${n})`);
  for (let i = 0; i < n; i++) {
    await page.locator(".truck__rock:not([disabled])").first().click();
    await page.waitForTimeout(60);
    assert.equal(await rocksIn(), i + 1, `rock ${i + 1} lands IN the bed`);
  }
  assert.equal(await tipOf(), 0, "the bed stays level while loading");
  // …then the lever tips it.
  await page.locator(".truck__lever").click();
  await page.waitForTimeout(80);
  assert.ok(await tipOf() < -20, "pulling DUMP tips the bed right up");
});

test("ONE LIGHT: the shared gradients paint from the upper left, and stay inside the body", async () => {
  // The string guardrail in site.test.js proves the CONTRACT (one shared block,
  // alpha-only stops, every reference carries the ` none` fallback). Two things
  // it cannot see are pixel questions:
  //   1. is the gradient actually pointed the right way?
  //   2. does the light stay INSIDE the body it belongs to? `lit()` emits the
  //      flat fill and the highlight from ONE template precisely so a highlight
  //      can never drift off its shape — this is what proves that holds.
  //
  // (1) is deliberately measured on a NEUTRAL GREY SWATCH, not on a character:
  // the first attempt sampled "the upper left of the head", landed inside the
  // dark hair, and reported a confident -63 on art that was correct.
  //
  // What is NOT asserted here, on purpose: that a missing shared block degrades
  // to the flat drawing instead of a black blob. It is true, and the ` none`
  // fallback that guarantees it is pinned by the string guardrail — but the
  // mutation that removes the fallback still renders identically in Chromium,
  // which already treats an unresolved paint server as `none`. A pixel
  // assertion for it could not fail on the engine that runs it, and a test that
  // cannot fail is worse than no test.
  const out = await page.evaluate(async () => {
    const defs = document.querySelector(".jart-defs").innerHTML;
    const strip = (s) => String(s).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    const draw = async (inner) => {
      const doc = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">' +
        defs + inner + "</svg>";
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res; img.onerror = () => rej(new Error("svg failed to load"));
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(doc);
      });
      const c = document.createElement("canvas"); c.width = c.height = 200;
      const g = c.getContext("2d");
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, 200, 200);
      g.drawImage(img, 0, 0, 200, 200);
      return g.getImageData(0, 0, 200, 200);
    };
    const at = (A, cx, cy, r) => {
      let s = 0, n = 0;
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
        const i = (y * A.width + x) * 4;
        s += 0.2126 * A.data[i] + 0.7152 * A.data[i + 1] + 0.0722 * A.data[i + 2]; n++;
      }
      return s / n;
    };
    const res = {};
    for (const id of ["jart-lit", "jart-dome"]) {
      const A = await draw('<rect x="12" y="12" width="76" height="76" fill="#808080"/>' +
        '<rect x="12" y="12" width="76" height="76" fill="url(#' + id + ') none"/>');
      // both samples sit on the SAME grey, well inside the swatch, on the light axis
      res[id] = at(A, 68, 56, 14) - at(A, 132, 144, 14);
    }
    // Does the surface light stay inside its body? Compare the shipped art
    // against the SAME art with the surface passes neutralized. `jart-ground`
    // is left in BOTH — a contact shadow is deliberately ink on the floor,
    // outside the body, which is the whole point of it.
    const hero = strip(window.JoshArt.hero("#e23636"));
    const flat = await draw(hero.replace(/url\(#jart-(?:lit|dome)\)/g, "url(#none-here)"));
    const shipped = await draw(hero);
    let outside = 0, inside = 0;
    for (let i = 0; i < flat.data.length; i += 4) {
      const bg = flat.data[i] > 250 && flat.data[i + 1] > 250 && flat.data[i + 2] > 250;
      const changed = Math.abs(flat.data[i] - shipped.data[i]) > 6 ||
        Math.abs(flat.data[i + 1] - shipped.data[i + 1]) > 6 ||
        Math.abs(flat.data[i + 2] - shipped.data[i + 2]) > 6;
      if (changed) { if (bg) outside++; else inside++; }
    }
    res.outside = outside;
    res.inside = inside;
    return res;
  });
  assert.ok(out["jart-lit"] > 8,
    `the shared surface gradient must be brighter up-LEFT than down-right (delta ${out["jart-lit"].toFixed(1)})`);
  assert.ok(out["jart-dome"] > 8,
    `…and so must the dome, or two pictures side by side disagree about where the light is ` +
    `(delta ${out["jart-dome"].toFixed(1)})`);
  assert.ok(out.inside > 400,
    `the light must actually reach the drawing (only ${out.inside} pixels changed inside it)`);
  // A handful of pixels along an antialiased edge is inevitable; a highlight
  // that has drifted off its shape is hundreds.
  assert.ok(out.outside < 60,
    `the surface light must stay INSIDE the body it belongs to — ${out.outside} pixels of it ` +
    "landed on bare background, which is a highlight drawn from geometry that no longer matches " +
    "its body (exactly what lit()'s single template exists to prevent)");
});

test("AUDIO: every voice goes through the limiter, and the voice cap holds AND releases", async () => {
  // Every sound in all three worlds used to connect its oscillator straight to
  // `destination`, so simultaneous cues simply SUM with no headroom — and they
  // really do pile up: `die` fires once per kill with no throttle, so a mortar
  // splash that clears a group asks for a dozen voices in one tick on top of
  // `splash` and `shoot`. On a phone speaker that clips into a crackle.
  //   Two claims, and the SECOND is the one that is easy to get wrong: a cap
  // that never released would make the game go permanently silent, which is a
  // far worse bug than the pile-up it prevents. "It caps" and "it frees" are
  // different tests — the corpse-fx lesson, in the audio layer.
  await page.goto(baseURL);
  await page.waitForSelector("#screen-start", { state: "visible" });
  const out = await page.evaluate(async () => {
    // The suite stubs WebAudio to model iOS; the stub records the graph, so the
    // question "did anything bypass the bus?" is answerable without a real
    // context — and `__notes` already counts every oscillator that started.
    window.__notes = 0;
    window.__graph.toDestination = 0; window.__graph.comp = 0;
    localStorage.setItem("josh-muted", "0");
    const A = window.JoshAudio;
    A.setMuted(false);
    A.unlock();
    await new Promise((r) => setTimeout(r, 60));   // let the async resume land
    window.__notes = 0;
    // A burst far larger than the cap, all in one tick — the splash case.
    const BURST = 50;
    for (let i = 0; i < BURST; i++) A.tone(400 + i * 7, { duration: 0.05, gain: 0.05 });
    await new Promise((r) => setTimeout(r, 150));
    const capped = window.__notes;
    // …then let them finish and fire again: the cap must have RELEASED.
    await new Promise((r) => setTimeout(r, 1500));
    const before = window.__notes;
    for (let i = 0; i < 5; i++) A.tone(500, { duration: 0.05, gain: 0.05 });
    await new Promise((r) => setTimeout(r, 150));
    return {
      burst: BURST, capped, afterRelease: window.__notes - before,
      comp: window.__graph.comp, toDestination: window.__graph.toDestination,
    };
  });
  assert.ok(out.comp >= 1, "the master bus builds a limiter (a compressor) — without it overlapping cues clip");
  assert.equal(out.toDestination, 1,
    `exactly ONE node may reach the speaker (the bus); ${out.toDestination} did, so voices are bypassing the limiter`);
  assert.ok(out.capped > 0, "the burst made some sound at all");
  assert.ok(out.capped < out.burst,
    `a ${out.burst}-voice burst must be capped, not all played (got ${out.capped} notes)`);
  assert.ok(out.afterRelease >= 5,
    `the voice cap must RELEASE — after the burst finished, 5 fresh tones produced only ${out.afterRelease} notes, so the game would go quieter and quieter`);
});

test("no uncaught page errors during the whole run", () => {
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
});
