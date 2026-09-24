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

// Every element that carries [hidden] and still has a box — the whole document,
// because an element under a hidden ancestor has none, so this only ever names
// a class whose `display` beat [hidden] (see site.test.js's [hidden] guardrail).
async function shownHidden(pg) {
  return (pg || page).evaluate(() => [...document.querySelectorAll("[hidden]")]
    .filter((n) => n.getClientRects().length)
    .map((n) => n.tagName.toLowerCase() + (n.getAttribute("class") ? "." + n.getAttribute("class").trim().split(/\s+/).join(".") : "")));
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
  // …and HEAR it. A string handed to say() is not a line the child heard: say()
  // used to cancel before every line, so 594 lines in 192 games were killed in
  // the very turn that spoke them (a sorter's "why", "The opposite of happy is
  // sad!", every restatement before newRound()) while this capture recorded all
  // of them and stayed green. So for this walk sound is ON and the engine is a
  // stub that knows which TURN each line came from: a line cancelled in its own
  // turn was never heard, and every line a game says must reach the engine (or
  // be the same words as one it already said that turn — JoshAudio.lineKey is
  // the one owner of "same words"). A turn is one synchronous burst (a
  // microtask checkpoint ends it), which is what makes this deterministic
  // however fast the loop taps.
  await page.evaluate(() => {
    const A = window.JoshAudio, real = A.say.bind(A);
    window.__SAID = [];
    A.say = (t, o) => { window.__SAID.push(String(t)); return real(t, o); };
    window.__speechWas = { desc: Object.getOwnPropertyDescriptor(window, "speechSynthesis"), muted: A.isMuted(), key: localStorage.getItem("josh-muted") };
    let turn = 0, open = false, q = [];
    const turnOf = () => { if (!open) { open = true; turn++; queueMicrotask(() => { open = false; }); } return turn; };
    window.__SPOKEN = []; window.__LOST = []; window.__TURNS = {};
    const synth = {
      get speaking() { return q.length > 0; }, get pending() { return q.length > 1; }, paused: false,
      getVoices() { return []; }, pause() {}, resume() {}, addEventListener() {}, removeEventListener() {},
      speak(u) {
        const t = turnOf(), text = String(u.text);
        q.push({ text, turn: t }); window.__SPOKEN.push(text);
        (window.__TURNS[t] = window.__TURNS[t] || []).push(text);
      },
      cancel() { const t = turnOf(); for (const u of q) if (u.turn === t) window.__LOST.push(u.text); q = []; },
    };
    Object.defineProperty(window, "speechSynthesis", { configurable: true, get: () => synth });
    A.setMuted(false);
  });

  const ids = await gameIds();
  try {
    for (const id of ids) {
      await page.evaluate(() => { window.__SAID = []; window.__SPOKEN = []; window.__LOST = []; window.__TURNS = {}; });
      await openGame(id);
      const screen = page.locator(`#screen-${id}`);
      // [hidden] must HIDE (see site.test.js): at open, and again at the win.
      assert.deepEqual(await shownHidden(), [], `game "${id}" at open: an element with [hidden] still has a box — a class set \`display\` and beat [hidden]`);

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
      // A flag on something with no BOX is a lie the harness will happily
      // click and a child never can — measured: Mix It! kept last round's
      // chips, the old answer still flagged, hidden behind the next round.
      const ghosts = new Set();
      for (let i = 0; i < 800 && !won; i++) {
        const st = await screen.evaluate((el) => ({
          won: el.dataset.won === "1",
          ghosts: [...el.querySelectorAll('[data-correct="1"]')].filter((n) => !n.getClientRects().length)
            .map((n) => (n.getAttribute("aria-label") || n.textContent || n.className || n.tagName).toString().trim().slice(0, 24)),
        }));
        won = st.won;
        st.ghosts.forEach((g) => ghosts.add(g));
        if (won) break;
        let target = screen.locator('[data-correct="1"]').first();
        if ((await target.count()) === 0) target = screen.locator("[data-toy]").first();
        if ((await target.count()) === 0) { await page.waitForTimeout(20); continue; }
        try { await target.evaluate((el) => el.click()); }
        catch (e) { await page.waitForTimeout(20); } // element detached mid-rebuild — re-query next loop
      }
      won = await screen.evaluate((el) => el.dataset.won === "1");
      assert.ok(won, `game "${id}" never reached a win — every game must be collectible (winnable)`);
      assert.deepEqual(await shownHidden(), [], `game "${id}" at its win: an element with [hidden] still has a box — a class set \`display\` and beat [hidden]`);
      assert.deepEqual([...ghosts], [],
        `game "${id}" flags an element a child cannot see (no box) — [data-correct] must mark a tap he can actually make: ${[...ghosts].join(" | ")}`);

      // Nothing this game SAID may be a picture (see the note above the loop).
      const said = await page.evaluate(() => window.__SAID);
      const mute = said.filter((line) => SPOKEN_EMOJI.test(line));
      assert.deepEqual(mute, [],
        `game "${id}" SPEAKS an emoji — a picture is silence on the audio channel. Give it a name (SEASON_ITEM_NAMES / SPOT_NAMES are the precedent): ${mute.join(" | ")}`);

      // …and everything it said must have been HEARD (see the note above the loop).
      // `missing` compares through JoshAudio.lineKey on purpose, so it cannot see
      // lineKey itself merging too much — that is the unit guardrail's job (it
      // fails the moment two different sentences are merged).
      const heard = await page.evaluate(() => {
        const key = window.JoshAudio.lineKey, spoken = new Set(window.__SPOKEN.map(key));
        return {
          lost: window.__LOST.slice(),
          missing: [...new Set(window.__SAID.filter(Boolean))].filter((t) => !spoken.has(key(t))),
          spoken: window.__SPOKEN.length,
          // A turn that ASKS twice is the old setPrompt + speak + say idiom coming
          // back in a shape the structural scan cannot see (a non-adjacent say).
          twoQ: Object.values(window.__TURNS)
            .filter((ls) => ls.filter((l) => /[?？]\s*$/.test(l)).length > 1)
            .map((ls) => ls.join(" / ")),
        };
      });
      assert.deepEqual(heard.lost, [],
        `game "${id}" said a line and CANCELLED it in the same turn, so it was never heard — speak through JoshAudio.say, which queues a turn's lines: ${heard.lost.join(" | ")}`);
      assert.deepEqual(heard.missing, [],
        `game "${id}" said a line that never reached the speech engine: ${heard.missing.join(" | ")}`);
      assert.ok(heard.spoken >= 1, `game "${id}" spoke nothing at all with sound ON — the stub or the unmute is not taking effect`);
      assert.deepEqual(heard.twoQ, [],
        `game "${id}" asks TWO questions in one turn — a round says ONE line: put it in setPrompt's 3rd argument (spoken), not a say() after speak(): ${heard.twoQ.join(" | ")}`);

      // Winning reveals a working "Again" button that resets the won state. It
      // is pressed like a person would: not inside the 350ms after the win, when
      // framework.js treats a real tap on the board as the ECHO of the winning
      // one (a win's echo must not throw the celebration away).
      const again = screen.locator(".game__again");
      assert.ok(await again.isVisible(), `game "${id}" should show Again after winning`);
      await page.waitForTimeout(400);
      await again.click();
      assert.equal(await screen.evaluate((el) => el.dataset.won || ""), "", `Again should reset "${id}"`);
    }
  } finally {
    // Leave the page as the rest of the file expects it: muted, on the real engine.
    await page.evaluate(() => {
      const w = window.__speechWas, A = window.JoshAudio;
      if (!w) return;
      if (w.desc) Object.defineProperty(window, "speechSynthesis", w.desc); else delete window.speechSynthesis;
      A.setMuted(w.muted);
      try { if (w.key === null) localStorage.removeItem("josh-muted"); else localStorage.setItem("josh-muted", w.key); } catch (e) { /* ignore */ }
    });
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

  // …and the same law on the NAVIGATION tiles, which this check could not see.
  // It reads the REGISTRY, and a home screen's category / 随便玩 / sticker-book
  // tiles are built directly by main.js and hl-main.js — they are not registered
  // games. So 华丽's home shipped 🏮 on BOTH 贴纸 and 民俗文化: two identical red
  // lanterns side by side on the one screen a 70-year-old navigates by picture.
  // Read off the rendered DOM rather than the data, because that is what she
  // actually sees, and per SCREEN, because cross-screen reuse is fine.
  for (const [hash, sel] of [["#home", "#screen-home"], ["#hl-home", "#screen-hl-home"]]) {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.locator(sel).waitFor({ state: "visible" });
    const nav = await page.evaluate((s) => {
      const seen = {};
      for (const t of document.querySelectorAll(s + " .tile")) {
        const ic = t.querySelector(".tile__icon"), lb = t.querySelector(".tile__label");
        const k = ic && ic.textContent.trim();
        if (k) (seen[k] = seen[k] || []).push((lb ? lb.textContent : "").trim());
      }
      return { total: Object.values(seen).reduce((a, b) => a + b.length, 0),
               dup: Object.entries(seen).filter(([, a]) => a.length > 1).map(([i, a]) => i + " on " + a.join(" & ")) };
    }, sel);
    assert.ok(nav.total >= 8, `${sel} rendered ${nav.total} nav tiles — too few to be auditing the real home`);
    assert.deepEqual(nav.dup, [],
      `${sel}: two navigation tiles wear the same picture — ${nav.dup.join("; ")}`);
  }
});

test("华丽's world is READABLE — no game shows her text below 16px", async () => {
  // Her world is the only one on this site whose user actually reads: Josh is a
  // non-reader by design (RULE 5's first law) and the fort is Jon's. The nav pass
  // already raised her home and category titles off 12.8/15.2px for exactly this
  // reason — and nobody had ever measured her GAME screens.
  //
  // Measured across all 40: the floor was 15.2px on two of them, 找不同's
  // "▲ 上图 · 下图哪里不同？ ▼" (the instruction itself) and 古筝's sound hint.
  // Both had already been through the CONTRAST pass, which measured colour and
  // never type — two passes over the same runs, each blind to the other's axis.
  //
  // Emoji runs are excluded: a picture is not type. 16px is the floor the other
  // 38 already held, so this is a ratchet on shipped behaviour, not an invention.
  const FLOOR = 16;
  const ids = await page.evaluate(() => (window.JoshGames || []).filter((g) => g.hl).map((g) => g.id));
  assert.ok(ids.length >= 40, `her world registers its games (${ids.length})`);
  const small = [];
  let checked = 0;
  for (const id of ids) {
    await page.evaluate((h) => { location.hash = h; }, id);
    await page.locator("#screen-" + id).waitFor({ state: "visible" });
    const found = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const out = [];
      let runs = 0;
      for (const n of el.querySelectorAll("*")) {
        if (!n.offsetParent) continue;
        const t = [...n.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join("").trim();
        if (!t || !/[\p{L}\p{Nd}]/u.test(t)) continue;   // an emoji run is a PICTURE, not type
        runs++;
        const px = parseFloat(getComputedStyle(n).fontSize);
        if (px < 16) out.push(px.toFixed(1) + "px \"" + t.slice(0, 20) + "\"");
      }
      return { out, runs };
    }, "#screen-" + id);
    checked += found.runs;
    for (const f of found.out) small.push(id + ": " + f);
  }
  assert.ok(checked >= 80, `audited her real text (${checked} runs across ${ids.length} games)`);
  assert.deepEqual(small, [],
    `she reads this world — these runs are under ${FLOOR}px: ${small.join(" | ")}`);
});

test("华丽's 🏮 book gives every one of HER 40 games its own prize too", async () => {
  // The uniqueness guardrail next door is titled "Josh's 200 games" and is
  // scoped to his registry, so her book was never checked — the fourth instance
  // this session of a scan whose own scope was the defect (the flex-gap law
  // guarded only main.css, the VS16 scan hand-listed nine files, the nav tiles
  // above were invisible to the registry check).
  //
  // Measured through the SHIPPED hash, her 25-motif pool over 40 games gave **22
  // unique prizes, 28 of 40 games sharing one**, largest group 🐲 x4 — exactly
  // the defect Josh's book was fixed for and hers was not. Read off the RENDERED
  // slots rather than the data, because the prize is what she actually sees — and
  // because a probe that RETYPES the hash measures its own typo: the first pass
  // here used h*31 against a shipped FNV and confidently reported 19/33.
  await page.evaluate(() => { location.hash = "#hl-stickers"; });
  await page.locator("#screen-hl-stickers").waitFor({ state: "visible" });
  const seen = await page.evaluate(() => {
    const out = {};
    for (const slot of document.querySelectorAll("#screen-hl-stickers .sticker-slot")) {
      const seal = slot.querySelector(".hl-seal");
      // the prize IS motif + shape + colour; any one of the three alone repeats
      const key = seal
        ? [seal.textContent.trim(), [...seal.classList].filter((c) => /--s\d/.test(c)).join(""), seal.style.background].join("|")
        : slot.querySelector(".sticker-slot__art").textContent.trim();
      (out[key] = out[key] || []).push(slot.dataset.sticker);
    }
    return out;
  });
  const total = Object.values(seen).reduce((a, b) => a + b.length, 0);
  assert.ok(total >= 40, `her book rendered ${total} slots — too few to be auditing the real book`);
  const dup = Object.entries(seen).filter(([, a]) => a.length > 1).map(([k, a]) => k + " on " + a.join(", "));
  assert.deepEqual(dup, [],
    `${total - Object.keys(seen).length} of her ${total} games share a prize with another: ${dup.join(" | ")}`);
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

test("one class, two games: What Comes Next, Coin Mix-Up and Piggy Bank each draw their OWN design", async () => {
  // `.pattern__cell` and `.coin` were each declared twice, for two different
  // games, so the later rule won every property they shared and each earlier
  // game drew the other game's design. The CSS law in site.test.js stops a
  // declaration being dead; this proves what the three games actually RENDER,
  // because a stylesheet cannot see a leak — Piggy Bank's `min-width` was ALIVE,
  // it was just alive in the wrong game.
  //
  // 1. What Comes Next: the ❓ slot is marked out. Its rule sat ABOVE
  //    `.pattern__cell`, both one class on the same element, so it lost on
  //    source order and never painted once.
  await openGame("what-next");
  const wn = await page.evaluate(() => {
    const st = document.querySelector("#screen-what-next");
    const q = st.querySelector(".pattern__q"), c = st.querySelector(".pattern__cell:not(.pattern__q)");
    return { q: q && getComputedStyle(q).backgroundColor, c: c && getComputedStyle(c).backgroundColor };
  });
  assert.ok(wn.q && wn.c, `fixture: What Comes Next must show a ❓ slot and an ordinary cell (${JSON.stringify(wn)})`);
  assert.notEqual(wn.q, wn.c, `the ❓ slot must stand out from the cells around it — both painted ${wn.c}`);

  // 2. Coin Mix-Up: a nickel is drawn BIGGER than a penny — true of real coins,
  //    and erased while Piggy Bank's `min-width` leaked in and drew them alike.
  await openGame("coin-mix");
  const cm = await page.evaluate(() => {
    const st = document.querySelector("#screen-coin-mix");
    const w = (sel) => { const el = st.querySelector(sel); return el ? el.getBoundingClientRect().width : 0; };
    return { penny: w('.coinmix__pile [class*="--penny"]'), nickel: w('.coinmix__pile [class*="--nickel"]') };
  });
  assert.ok(cm.penny > 0 && cm.nickel > 0, `fixture: the pile must show a nickel and a penny (${JSON.stringify(cm)})`);
  assert.ok(cm.nickel >= cm.penny * 1.2,
    `a nickel must be drawn bigger than a penny — saw nickel ${Math.round(cm.nickel)}px, penny ${Math.round(cm.penny)}px`);

  // 3. Piggy Bank: each coin BUTTON fills its half of the grid with a label a
  //    four-year-old can read — not a 76px circle stranded at the left of its
  //    track wearing Coin Mix-Up's 15px label.
  await openGame("piggy-bank");
  const pb = await page.evaluate(() => {
    const grid = document.querySelector("#screen-piggy-bank .piggy__coins");
    if (!grid) return null;
    const g = grid.getBoundingClientRect(), gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
    return {
      track: (g.width - gap) / 2,
      coins: [...grid.querySelectorAll(".coin")].map((c) => ({
        w: c.getBoundingClientRect().width, font: parseFloat(getComputedStyle(c).fontSize),
      })),
    };
  });
  assert.ok(pb && pb.coins.length === 2, `fixture: Piggy Bank offers a penny and a nickel (${JSON.stringify(pb)})`);
  for (const c of pb.coins) {
    assert.ok(c.w >= pb.track - 2,
      `a Piggy Bank coin must fill its ${Math.round(pb.track)}px grid track — saw ${Math.round(c.w)}px`);
    assert.ok(c.font >= 24, `a Piggy Bank coin's label must be big enough to read — saw ${c.font}px`);
  }
});

test("colour law, browser half: a state carried by a TRANSLUCENT fill is judged on the pixels it PAINTS", async () => {
  // The colour law in site.test.js weighs a state pair from the stylesheet,
  // and one kind of pair is out of its reach: a side whose fill is TRANSLUCENT
  // has no lightness of its own — rgba(122,92,214,0.18) is whatever is behind
  // it, tinted — so when nothing structural separates the two states, the
  // stylesheet cannot say whether they can be told apart. tests/state-cues.js
  // is the ONE owner of how each such pair is classified (site.test.js requires
  // it to EQUAL what it derives), and every entry it marks `composite` is
  // measured here, where a player sees it: the pixel the browser actually
  // paints, off and on, on the backdrop the element really sits on, at the
  // sizes a phone, a small phone, an iPad and a landscape phone give it.
  //
  // PIXELS, not a compositor, and the first cut is why. It composited the
  // computed styles up the ancestor chain, and the stage behind Drum the Word
  // is a GRADIENT, which has no single colour: scored against its best stop the
  // dots read 3.68:1, against its worst 2.87:1 — so the metric straddled the
  // very bar it exists to judge, and would have passed or failed on which stop
  // it happened to prefer. The painted pixel is 3.66-3.69:1 at every size
  // measured. When a computed metric disagrees with the pixels, the pixels are
  // right; and a test that asserts X should measure X.
  //
  // The bar is WCAG 1.4.11's 3:1 for a graphical object that carries state —
  // Drum the Word's lit dots ARE its sound-off channel, so a child with the
  // sound off counts them.
  const CUES = require("./state-cues.js");
  const { decodePng } = require("./helpers.js");
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = (p) => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const rgba = (css) => { const m = String(css).match(/[\d.]+/g) || []; return { c: m.slice(0, 3).map(Number), a: m.length > 3 ? Number(m[3]) : 1 }; };

  const composites = Object.entries(CUES).filter(([, c]) => c.cue === "composite");
  // A derivation fails OPEN: with no entry this test would pass on nothing. If
  // the last such pair is ever resolved structurally, delete this test as a
  // conscious act rather than letting it go quietly vacuous.
  assert.ok(composites.length >= 1, "state-cues.js lists no `composite` pair, so this test measures nothing");

  const SIZES = [[390, 844], [320, 568], [834, 1112], [844, 390]];
  const bad = [], rows = [];
  let checked = 0;
  for (const [pair, c] of composites) {
    for (const k of ["game", "base", "state"]) {
      assert.ok(c[k], `${pair}: a composite cue must name its ${k}, or there is nothing to open and measure`);
    }
    for (const [w, h] of SIZES) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce", deviceScaleFactor: 1 });
      const pg = await ctx.newPage();
      try {
        await pg.goto(baseURL + "#" + c.game);
        await pg.waitForSelector(`#screen-${c.game}:not([hidden])`);
        const els = pg.locator(`#screen-${c.game} ${c.base}`);
        const n = await els.count();
        assert.ok(n >= 1, `${pair} at ${w}x${h}: #screen-${c.game} has no ${c.base} to measure`);
        for (let i = 0; i < n; i++) {
          const el = els.nth(i);
          const set = (on) => el.evaluate((e, [cls, v]) => e.classList.toggle(cls, v), [c.state, on]);
          await set(false);
          await el.scrollIntoViewIfNeeded();
          const bb = await el.boundingBox();
          const x = Math.round(bb.x + bb.width / 2), y = Math.round(bb.y + bb.height / 2);
          // The sample must BE the element: a point that lands on a neighbour,
          // or on something painted over it, would score that thing instead.
          const hit = await el.evaluate((e, [px, py]) => document.elementFromPoint(px, py) === e, [x, y]);
          assert.ok(hit, `${pair} at ${w}x${h}: ${c.base} #${i}'s centre (${x},${y}) is not the element itself`);
          const shot = async () => decodePng(await pg.screenshot({
            clip: { x: x - 1, y: y - 1, width: 3, height: 3 }, animations: "disabled",
          })).px(1, 1);
          const fill = () => el.evaluate((e) => getComputedStyle(e).backgroundColor).then(rgba);
          const off = await shot(), offStyle = await fill();
          await set(true);
          const on = await shot(), onStyle = await fill();
          await set(false);
          // Self-check, so the numbers mean something: wherever a side is
          // OPAQUE its painted pixel must equal its declared colour. That proves
          // the decoder reads the screenshot correctly and that the state class
          // really took — without it a broken decoder or a no-op toggle would
          // hand this test two arbitrary colours to compare.
          for (const [side, px, st] of [["off", off, offStyle], ["on", on, onStyle]]) {
            if (st.a !== 1) continue;
            const drift = Math.max(...px.map((v, k) => Math.abs(v - st.c[k])));
            assert.ok(drift <= 3, `${pair} at ${w}x${h}: the ${side} side painted rgb(${px}) but declares ` +
              `rgb(${st.c}) — the screenshot is not being read correctly, or the state class did not apply`);
            checked++;
          }
          const r = ratio(off, on);
          rows.push({ pair, size: `${w}x${h}`, i, r });
          if (r < 3) bad.push(`${pair} at ${w}x${h}, ${c.base} #${i}: off rgb(${off}) vs on rgb(${on}) = ${r.toFixed(2)}:1`);
        }
      } finally {
        await ctx.close();
      }
    }
  }
  assert.ok(checked >= 1, "no sample could be checked against a declared opaque colour, so nothing proves the pixels were read correctly");
  assert.ok(rows.length >= composites.length * SIZES.length, `only ${rows.length} samples were measured`);
  assert.deepEqual(bad, [], "a state carried only by a translucent fill must still clear WCAG 1.4.11's 3:1 where it is PAINTED:\n  " + bad.join("\n  "));
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

test("the hammer's ECHO: each rule catches the case only it can see, and a deliberate tap always gets through", async () => {
  // framework.js swallows a finger's ECHO — the second tap a four-year-old
  // makes for every tap he means — with four rules (see the note beside
  // ECHO_MS). Each rule gets a tiny fixture game built so that ONLY that rule
  // can catch its case, and each exemption gets one that must get THROUGH, so
  // deleting any one clause turns exactly one check red.
  //
  // The gaps are the claim, so they must be exact: a paused fake clock
  // (performance.now is faked too) makes "150ms later" mean 150ms in the page,
  // where a real clock on a loaded CI runner can stretch a 150ms echo past the
  // 350ms window and pass for the wrong reason. The taps are REAL (page.mouse),
  // because only a trusted tap can be an echo.
  const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  try {
    await p.clock.install({ time: new Date("2026-01-01T08:00:00") });
    await p.goto(baseURL, { waitUntil: "load" });
    await p.clock.pauseAt(new Date("2026-01-01T09:00:00"));
    await p.evaluate(() => {
      const F = window.JoshFramework, A = window.JoshAudio;
      window.__log = [];
      for (const k of ["goodCue", "winCue", "bumpCue", "say"]) {
        const real = A[k];
        A[k] = function () { window.__log.push(k); return real && real.apply(this, arguments); };
      }
      const mk = (id, start) => document.getElementById("screens")
        .appendChild(F.buildGameScreen({ id, icon: "🧪", title: id, skill: "echo fixture", start }));
      const btn = (api, label, dataset) => {
        const b = api.el("button", { class: "choice tap", type: "button", text: label, aria: { label }, dataset: dataset || {} });
        api.stage.appendChild(b);
        return b;
      };
      // RULE 1 — the SAME button is the answer round after round and the next
      // prompt is set at once: rule 2 is already cleared, rule 3 knows the
      // button, rule 4 exempts it (it IS the correct next tap). Only the
      // round-over window stands between the echo and a second round.
      mk("echo-r1", (api) => {
        const a = btn(api, "A", { correct: "1" });
        a.addEventListener("click", () => { window.__log.push("answer"); api.roundWin(); api.setPrompt("again", []); });
        api.setPrompt("tap A", []);
      });
      // RULE 2 — a round that shows its answer for a beat: the flag stays on the
      // finished button (the stale-flag shape) and the next round is presented
      // 800ms later. A re-tap at 500ms is no echo (past the window) — only the
      // finished-round rule can hold it.
      mk("echo-r2", (api) => {
        const a = btn(api, "A", { correct: "1" });
        a.addEventListener("click", () => {
          window.__log.push("answer");
          api.roundWin();
          api.later(() => api.setPrompt("next", []), 800);
        });
        api.setPrompt("tap A", []);
      });
      // RULE 2 is only the ANSWER that won — a control the win REVEALS (Number
      // Builder's "Next ▶") is the next thing to press. The first cut closed the
      // whole stage and made Next deaf for 1.5s; the real-game probe caught it.
      mk("echo-next", (api) => {
        const a = btn(api, "A", { correct: "1" });
        const next = api.el("button", { class: "btn-big echo-next__go", type: "button", text: "Next", hidden: "" });
        api.stage.appendChild(next);
        a.addEventListener("click", () => { window.__log.push("answer"); api.roundWin(); next.hidden = false; next.dataset.correct = "1"; });
        next.addEventListener("click", () => { window.__log.push("next"); api.setPrompt("round 2", []); });
        api.setPrompt("tap A", []);
      });
      // RULE 2 needs a RECENT tap to blame: a round won by a timer long after any
      // tap (a demo, a toy's auto-finish) must not deafen whatever was tapped last.
      mk("echo-timer", (api) => {
        const a = btn(api, "A", { correct: "1" });
        a.addEventListener("click", () => window.__log.push("tap"));
        api.later(() => api.roundWin(), 2000);
        api.setPrompt("wait", []);
      });
      // RULE 2's CAP — a game that never sets its next prompt: the finished
      // round must not stay deaf for ever.
      mk("echo-cap", (api) => {
        const a = btn(api, "A", { correct: "1" });
        a.addEventListener("click", () => { window.__log.push("answer"); api.roundWin(); });
        api.setPrompt("tap A", []);
      });
      // RULE 3 — a turn that rebuilds WITHOUT a roundWin (the Team Sound Hunt
      // shape): a brand-new button lands under the finger. No window is open,
      // and it is a different element, so only "an echo cannot land on
      // something new" can catch it.
      mk("echo-r3", (api) => {
        const a = btn(api, "A", { correct: "1" });
        a.addEventListener("click", () => {
          window.__log.push("step");
          a.remove();
          const b = btn(api, "B");
          b.addEventListener("click", () => api.tryAgain(b));
        });
        api.setPrompt("tap A", []);
      });
      // RULE 3 sees what was ON SCREEN, not merely in the DOM — a step that
      // hides its button and REVEALS one that was waiting hidden, with no
      // roundWin (the "I Did It!" shape: the last sticker reveals "I did it!"
      // under the finger). The revealed button EXISTED when the first tap
      // began, so a DOM-presence snapshot calls it known and the echo finishes
      // the game. B is hidden through its WRAPPER, so "has no box" is what is
      // tested, not "carries the hidden attribute" (and .choice sets display,
      // so [hidden] on a .choice would not hide it at all).
      mk("echo-reveal", (api) => {
        const a = btn(api, "A", { correct: "1" });
        const b = api.el("button", { class: "btn-big echo-reveal__b", type: "button", text: "B" });
        const wrap = api.el("div", { class: "echo-reveal__wrap", hidden: "" }, [b]);
        api.stage.appendChild(wrap);
        a.addEventListener("click", () => {
          window.__log.push("step");
          a.style.display = "none"; delete a.dataset.correct;
          wrap.hidden = false; b.dataset.correct = "1";
        });
        b.addEventListener("click", () => { window.__log.push("b"); api.win(); });
        api.setPrompt("tap A", []);
      });
      // RULE 4 — a step that leaves its button in place, no longer correct, with
      // a naive wrong branch (the Little Letter Maker shape: a re-tapped done
      // dot said "try again").
      mk("echo-r4", (api) => {
        const a = btn(api, "A", { correct: "1" }), b = btn(api, "B");
        let done = false;
        a.addEventListener("click", () => {
          if (done) { api.tryAgain(a); return; }
          done = true; delete a.dataset.correct; b.dataset.correct = "1";
          window.__log.push("step");
        });
        b.addEventListener("click", () => window.__log.push("b"));
        api.setPrompt("tap A then B", []);
      });
      // EXEMPTION — a pump: the same button stays the correct next tap, so a
      // fast second tap is a real second pump.
      mk("echo-pump", (api) => {
        const a = btn(api, "A", { correct: "1" });
        a.addEventListener("click", () => window.__log.push("pump"));
        api.setPrompt("pump", []);
      });
      // EXEMPTION — a toy: its play IS rapid tapping, even the instant it wins.
      mk("echo-toy", (api) => {
        const t = btn(api, "T", { toy: "1" });
        let n = 0;
        t.addEventListener("click", () => { n += 1; window.__log.push("toy"); if (n === 1) api.win(); });
        api.setPrompt("play", []);
      });
      // WIN — the answer that wins the GAME keeps its flag (the stale-flag
      // shape), so rule 4 exempts its echo and only the window win() opens can
      // stop the handler running again. AGAIN — the one foot control: a win's
      // echo must not restart the game.
      mk("echo-win", (api) => {
        const a = btn(api, "A", { correct: "1" });
        a.addEventListener("click", () => { window.__log.push("answer"); api.win(); });
        api.setPrompt("tap A", []);
      });
    });

    const open = async (id) => {
      await p.evaluate((i) => { location.hash = "#" + i; }, id);
      await p.locator("#screen-" + id).waitFor({ state: "visible" });
      await p.evaluate(() => window.__log.splice(0)); // opening speaks the prompt
    };
    const at = (sel) => p.evaluate((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    }, sel);
    const tap = ([x, y]) => p.mouse.click(x, y);
    const wait = (ms) => p.clock.runFor(ms);
    const log = () => p.evaluate(() => window.__log.splice(0));
    // the answer, then its echo 150ms later
    const echo = async (xy) => { await tap(xy); const first = await log(); await wait(150); await tap(xy); return { first, echo: await log() }; };

    // RULE 1
    await open("echo-r1");
    let A = await at("#screen-echo-r1 .choice");
    let r = await echo(A);
    assert.deepEqual(r.first, ["answer", "goodCue"], "fixture: the first tap answers the round");
    assert.deepEqual(r.echo, [],
      "rule 1: an echo 150ms after a round is WON must be swallowed — here the same button is the next round's answer, so only the round-over window can stop it being answered twice");
    await wait(250); await tap(A); // 400ms after the answer: past its window, 250 after the swallowed echo
    assert.deepEqual(await log(), [],
      "rule 1: a swallowed echo RE-ARMS the window, so a hammer streak ends only when the hand pauses");
    await wait(500); await tap(A);
    assert.deepEqual(await log(), ["answer", "goodCue"], "a deliberate tap after the pause must get through");
    // a synthetic click is code, never a finger
    await wait(10);
    await p.evaluate(() => document.querySelector("#screen-echo-r1 .choice").click());
    assert.deepEqual(await log(), ["answer", "goodCue"],
      "a SYNTHETIC click must never be swallowed (isTrusted) — it is a demo or a test harness, not an echo");
    // …and neither is a keyboard activation (click detail 0): deliberate, never a finger's echo
    await wait(400);
    await p.focus("#screen-echo-r1 .choice");
    await p.keyboard.press("Enter");
    assert.deepEqual(await log(), ["answer", "goodCue"], "fixture: Enter answers the round");
    await wait(150); await p.keyboard.press("Enter");
    assert.deepEqual(await log(), ["answer", "goodCue"],
      "a KEYBOARD activation 150ms after a won round must still land (detail 0) — a keyboard user is deliberate, and the guard is for a finger");
    // the bar is never swallowed: 🏠 and 👂 always answer
    await wait(400); await tap(A); await log(); await wait(100);
    await tap(await at("#screen-echo-r1 .game__hear"));
    assert.deepEqual(await log(), ["say"], "👂 must answer even inside the window — only the board can echo");

    // RULE 2 (+ setPrompt reopens it)
    await open("echo-r2");
    A = await at("#screen-echo-r2 .choice");
    await tap(A); assert.deepEqual(await log(), ["answer", "goodCue"], "fixture: the first tap answers the round");
    await wait(500); await tap(A);
    assert.deepEqual(await log(), [],
      "rule 2: a re-tap of the FINISHED round (500ms: past the echo window, before the next prompt) must be swallowed, or a round that shows its answer for a beat is answered twice");
    await wait(500); await tap(A); // 1000ms: the next round was presented at 800
    assert.deepEqual(await log(), ["answer", "goodCue"],
      "rule 2 ends when the next round's prompt is set — the reused button must answer again");

    // RULE 2 does not close what the win reveals
    await open("echo-next");
    await tap(await at("#screen-echo-next .choice"));
    assert.deepEqual(await log(), ["answer", "goodCue"], "fixture: the first tap answers the round");
    await wait(500);
    await tap(await at("#screen-echo-next .echo-next__go"));
    assert.deepEqual(await log(), ["next"],
      "rule 2 closes only the ANSWER that won: the Next button the win revealed must take a deliberate tap at once, not after FINISHED_MS");

    // RULE 2 blames only a recent tap
    await open("echo-timer");
    A = await at("#screen-echo-timer .choice");
    await tap(A); await log();
    await wait(2000); // the timer wins the round, 2000ms after the last tap
    assert.deepEqual(await log(), ["goodCue"], "fixture: the timer won the round");
    await wait(400); await tap(A);
    assert.deepEqual(await log(), ["tap"],
      "rule 2 must not blame a tap made long before a TIMER won the round — that button was not the answer");

    // RULE 2's cap
    await open("echo-cap");
    A = await at("#screen-echo-cap .choice");
    await tap(A); await log();
    await wait(700); await tap(A);
    assert.deepEqual(await log(), [], "rule 2 holds a finished round with no next prompt (700ms)");
    await wait(900); await tap(A); // 1600ms
    assert.deepEqual(await log(), ["answer", "goodCue"],
      "rule 2 is CAPPED (FINISHED_MS): a game that never sets its next prompt must not stay deaf for ever");

    // RULE 3
    await open("echo-r3");
    A = await at("#screen-echo-r3 .choice");
    await tap(A);
    assert.deepEqual(await log(), ["step"], "fixture: the first tap is a step that rebuilds under the finger");
    await wait(150);
    assert.equal(await p.evaluate(([x, y]) => (document.elementFromPoint(x, y).closest(".choice") || {}).textContent, A), "B",
      "fixture: the NEW button must be under the finger, or the echo lands on nothing and this passes vacuously");
    await tap(A);
    assert.deepEqual(await log(), [],
      "rule 3: an echo landing on a button that did not EXIST when the first tap began must be swallowed — nobody can aim at it (here it would say 'try again' on a turn nobody saw)");

    // RULE 3 — hidden then is as new as built since
    await open("echo-reveal");
    A = await at("#screen-echo-reveal .choice");
    await tap(A);
    assert.deepEqual(await log(), ["step"], "fixture: the first tap is a step that reveals a hidden button");
    await wait(150);
    assert.equal(await p.evaluate(([x, y]) => (document.elementFromPoint(x, y).closest("button") || {}).textContent, A), "B",
      "fixture: the REVEALED button must be under the finger, or the echo lands on nothing and this passes vacuously");
    assert.equal(await p.evaluate(() => document.querySelector("#screen-echo-reveal .echo-reveal__b").isConnected), true,
      "fixture: the revealed button must have EXISTED all along — that is the case a DOM-presence snapshot calls known");
    await tap(A);
    assert.deepEqual(await log(), [],
      "rule 3: an echo landing on a button that was HIDDEN when the first tap began must be swallowed — it was not on screen, so nobody aimed at it (here it would finish the game unseen)");
    await wait(500); await tap(A);
    assert.deepEqual((await log()).filter((x) => x === "b"), ["b"], "a deliberate tap on the revealed button after the pause must get through");

    // RULE 4
    await open("echo-r4");
    r = await echo(await at("#screen-echo-r4 .choice"));
    assert.deepEqual(r.first, ["step"], "fixture: the first tap is an accepted step");
    assert.deepEqual(r.echo, [],
      "rule 4: an echo of the SAME button that is no longer the correct tap must be swallowed — a hammered correct answer is not a wrong one");
    await wait(250); await tap(await at("#screen-echo-r4 .choice"));
    assert.deepEqual(await log(), [],
      "rule 4: a hammer STREAK stays swallowed — each swallowed echo refreshes the last tap, so 400ms after the answer (250 after its echo) is still the same hand");

    // EXEMPTION: the pump
    await open("echo-pump");
    r = await echo(await at("#screen-echo-pump .choice"));
    assert.deepEqual([...r.first, ...r.echo], ["pump", "pump"],
      "a button that is STILL the correct next tap ([data-correct]) must take a fast second tap — two pumps are two pumps");

    // EXEMPTION: the toy, even the instant it wins
    await open("echo-toy");
    r = await echo(await at("#screen-echo-toy .choice"));
    assert.deepEqual(r.first.filter((x) => x === "toy"), ["toy"], "fixture: the toy plays");
    assert.deepEqual(r.echo.filter((x) => x === "toy"), ["toy"],
      "a TOY ([data-toy]) is never deafened — its play is rapid tapping, even the instant it wins");

    // WIN: the echo of the answer that won the game
    await open("echo-win");
    const W = await at("#screen-echo-win .choice");
    await tap(W);
    assert.equal(await p.evaluate(() => document.getElementById("screen-echo-win").dataset.won), "1", "fixture: the game is won");
    await log();
    await wait(150);
    assert.deepEqual(await p.evaluate(([x, y]) => {
      const c = document.elementFromPoint(x, y).closest(".choice");
      return [!!c, !!(c && c.dataset.correct)];
    }, W), [true, true],
      "fixture: the winning answer must still be under the finger AND still flagged, or rule 4 would catch the echo and this would not test win()'s window");
    await tap(W);
    assert.deepEqual((await log()).filter((x) => x === "answer"), [],
      "a win's ECHO on the very answer that won must be swallowed — it is still flagged, so rule 4 exempts it and only the window win() opens can stop the game's handler running again");
    // AGAIN: nor may it land on the Again button the win revealed
    const again = await at("#screen-echo-win .game__again");
    await wait(150); await tap(again);
    assert.equal(await p.evaluate(() => document.getElementById("screen-echo-win").dataset.won), "1",
      "a win's ECHO must not press the Again button it just revealed — that throws the celebration away");
    await wait(500); await tap(again);
    assert.equal(await p.evaluate(() => document.getElementById("screen-echo-win").dataset.won || ""), "",
      "a deliberate tap on Again after the pause must restart the game");

    assert.deepEqual(errs, [], "no page errors while echoing");
  } finally {
    await ctx.close();
  }
});

test("EVERY game ignores the hammer's echo, and still takes a deliberate tap", async () => {
  // The fixture test above proves each rule on a game built for it; this proves
  // them on the REAL ones, derived from the registry so a new game is checked the
  // day it lands. MEASURED 2026-09 before the guard: a second tap 150ms after a
  // correct one misbehaved in 173 of 240 games. Per game:
  //   • the first round WON by a tap is echoed 150ms later, exactly where the
  //     finger was (page.mouse — only a trusted tap can be an echo). The echo
  //     must be swallowed and do NOTHING: no second round, no "try again", no
  //     restart;
  //   • the first accepted STEP that does not win a round gets the same echo and
  //     must not be called wrong (a repeat that is still the correct next tap —
  //     a pump, a coin — may count, because two taps there are two answers);
  //   • after the echo, the next round's answer, tapped after a pause like a
  //     child who looked at it, must get THROUGH — the guard must never leave a
  //     game deaf.
  // A paused fake clock keeps every gap exact on a loaded runner (see the
  // fixture test); the game is driven through the [data-correct] contract.
  const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  try {
    await p.clock.install({ time: new Date("2026-01-01T08:00:00") });
    await p.goto(baseURL, { waitUntil: "load" });
    await p.clock.pauseAt(new Date("2026-01-01T09:00:00"));
    await p.evaluate(() => {
      const A = window.JoshAudio;
      window.__n = { good: 0, win: 0, bump: 0, reach: 0 };
      for (const [k, c] of [["goodCue", "good"], ["winCue", "win"], ["bumpCue", "bump"]]) {
        const real = A[k];
        A[k] = function () { window.__n[c]++; return real && real.apply(this, arguments); };
      }
    });
    const ids = await p.evaluate(() => (window.JoshGames || []).map((g) => g.id));
    assert.ok(ids.length >= 200, `the registry must be walked (saw ${ids.length})`);
    const counts = () => p.evaluate(() => Object.assign({}, window.__n));
    const bad = [];
    let echoed = 0, stepped = 0, deliberate = 0;
    for (const id of ids) {
      await p.evaluate((i) => { location.hash = "#" + i; }, id);
      const screen = p.locator(`#screen-${id}`);
      await screen.waitFor({ state: "visible" });
      await screen.evaluate((el) => {
        window.__done = null;
        if (el.__reachHook) return;
        el.__reachHook = true;
        // a capture listener INSIDE the screen runs after the screen's own
        // capture guard, so it counts only a tap the guard let through
        for (const s of [".game__stage", ".game__foot"]) {
          el.querySelector(s).addEventListener("click", () => { window.__n.reach++; }, true);
        }
      });
      await p.clock.runFor(500); // nothing below is an echo of the opening
      let echo = false, step = false, delib = false, waited = 0;
      for (let i = 0; i < 300 && !(echo && step && delib); i++) {
        if (echo && !delib) {
          // the NEXT round's answer, after a pause: never the answer that just won
          await p.clock.runFor(450);
          const t = await screen.evaluate((el) => {
            if (el.dataset.won === "1") return { won: true };
            const d = window.__done;
            const n = [...el.querySelectorAll('[data-correct="1"]')]
              .find((x) => !(d && (x === d || x.contains(d) || d.contains(x))));
            if (!n) return { none: true };
            n.scrollIntoView({ block: "center" });
            const r = n.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
            const u = document.elementFromPoint(x, y);
            return { x, y, ok: !!u && (u === n || n.contains(u)), label: String(n.getAttribute("aria-label") || n.textContent || "").trim().slice(0, 30) };
          });
          if (t.won) { delib = true; continue; } // the echoed round was the last one
          if (t.none) {
            waited += 450;
            // a reused answer: the next round has had every chance to begin
            if (waited > 1600) await screen.evaluate(() => { window.__done = null; });
            continue;
          }
          delib = true;
          if (!t.ok) continue;
          const before = await counts();
          await p.mouse.click(t.x, t.y);
          const after = await counts();
          deliberate += 1;
          if (after.reach === before.reach) bad.push(`${id}: a deliberate tap on the next round's answer ("${t.label}") was SWALLOWED — the guard made the game deaf`);
          await p.clock.runFor(450);
          continue;
        }
        const r = await screen.evaluate((el) => {
          if (el.dataset.won === "1") return { won: true };
          let t = el.querySelector('[data-correct="1"]');
          const toy = !t;
          if (!t) t = el.querySelector("[data-toy]");
          if (!t) return { none: true };
          if (toy) { t.click(); return { toy: true }; }
          t.scrollIntoView({ block: "center" });
          const rc = t.getBoundingClientRect(), x = rc.left + rc.width / 2, y = rc.top + rc.height / 2;
          const u = document.elementFromPoint(x, y);
          const n = window.__n, before = n.good + n.win;
          t.click();
          const won1 = n.good + n.win > before;
          if (won1) window.__done = t;
          return { x, y, won1, ok: !!u && (u === t || t.contains(u)), label: String(t.getAttribute("aria-label") || t.textContent || "").trim().slice(0, 30) };
        });
        if (r.won) break;
        if (r.none || r.toy) { await p.clock.runFor(50); continue; }
        if (!r.ok || (r.won1 ? echo : step)) { await p.clock.runFor(r.won1 ? 450 : 50); continue; }
        await p.clock.runFor(150);
        const pre = await screen.evaluate((el, [x, y]) => {
          const h = document.elementFromPoint(x, y);
          const onBoard = !!h && el.contains(h) && !el.querySelector(".game__bar").contains(h) && !h.closest("[data-toy]");
          return { onBoard, flagged: !!(h && h.closest('[data-correct="1"]')), n: Object.assign({}, window.__n) };
        }, [r.x, r.y]);
        if (!pre.onBoard) { await p.clock.runFor(450); continue; }
        await p.mouse.click(r.x, r.y);
        const post = await counts(), b = pre.n;
        const through = post.reach > b.reach, again = post.good + post.win > b.good + b.win, called = post.bump > b.bump;
        if (r.won1) {
          echo = true; echoed += 1;
          if (through || again || called) {
            bad.push(`${id}: the echo of the tap that WON a round ("${r.label}") ${[through && "got through the guard", again && "answered again", called && "was called wrong"].filter(Boolean).join(", ")}`);
          }
        } else {
          step = true; stepped += 1;
          if (called || (again && !pre.flagged)) {
            bad.push(`${id}: the echo of an accepted step ("${r.label}") ${called ? "was called wrong" : "answered something that was not the next tap"}`);
          }
        }
        await p.clock.runFor(450);
      }
    }
    assert.deepEqual(bad, [], "the hammer's echo must be harmless in every game, and a deliberate tap must always get through:\n" + bad.join("\n"));
    // A walk that echoed nothing proves nothing: the floors sit well under what
    // the shipped 240 measure, and fail if the driving stops reaching the board.
    assert.ok(echoed >= 150, `only ${echoed} games had the echo of a WINNING tap checked — the walk is not reaching the board`);
    assert.ok(deliberate >= 100, `only ${deliberate} deliberate taps were checked`);
    assert.ok(stepped >= 20, `only ${stepped} games had the echo of an accepted STEP checked`);
    assert.deepEqual(errs, [], "no page errors while echoing");
  } finally {
    await ctx.close();
  }
});

test("a celebration never fires on a screen the player has already left", async () => {
  // MEASURED 2026-08. framework.js gated winCue/goodCue/bumpCue and every spoken
  // line on `!screen.hidden` — and left the two lines BETWEEN them, FX.confetti()
  // and FX.stars(), ungated. Four games defer their win behind a raw setTimeout
  // (300-650ms) whose `isConnected` guard can never be false, because route()
  // only HIDES a screen. So: tap the last answer, press 🏠 inside the delay, and
  // full-screen confetti + stars rain over the launcher. All four leaked; the
  // fix is ONE `live()` predicate that every cue goes through.
  //
  // Two earlier versions of this measurement found NOTHING, both for fixture
  // reasons worth remembering: one navigated home only after dataset.won had
  // flipped (after the deferred win had fired), and one guessed at "the last
  // tap" with a heuristic that fires in round 1 of a 4-round game. Don't guess —
  // leave after EVERY tap, wait out the longest deferral, and come back.
  const DEFERRED_WIN = ["color-number", "drive-home", "how-tall", "sink-float"];
  for (const id of DEFERRED_WIN) {
    await openGame(id);
    await page.evaluate(() => {
      const FX = window.JoshEffects;
      window.__LEAK = [];
      if (FX.__wrapped) return;
      FX.__wrapped = true;
      for (const name of ["confetti", "stars"]) {
        const real = FX[name];
        if (!real) continue;
        FX[name] = function (...a) {
          const vis = Array.from(document.querySelectorAll(".screen")).filter((s) => !s.hidden)
            .map((s) => s.id).join("+") || "(none)";
          window.__LEAK.push(name + " on " + vis);
          return real.apply(this, a);
        };
      }
    });
    const leaks = [];
    let won = false;
    for (let i = 0; i < 90 && !won; i++) {
      // Tap and leave in ONE evaluate — a round trip would eat most of a 300ms
      // deferral and the window under test would close before we got there.
      const acted = await page.evaluate((g) => {
        const el = document.querySelector("#screen-" + g);
        if (!el || el.dataset.won === "1") return "won";
        const t = el.querySelector('[data-correct="1"]') || el.querySelector("[data-toy]");
        if (!t) return "none";
        window.__LEAK = [];
        t.click();
        location.hash = "#home";
        return "tapped";
      }, id);
      if (acted === "won") break;
      if (acted === "none") { await page.waitForTimeout(30); continue; }
      await page.waitForTimeout(750); // outlasts the longest deferral (650ms)
      for (const s of await page.evaluate((g) =>
        (window.__LEAK || []).filter((x) => x.indexOf("screen-" + g) === -1), id)) {
        if (leaks.indexOf(s) === -1) leaks.push(s);
      }
      await page.evaluate((g) => { location.hash = "#" + g; }, id);
      await page.waitForTimeout(60);
      won = await page.evaluate((g) => document.querySelector("#screen-" + g).dataset.won === "1", id);
    }
    assert.ok(won, `"${id}" must still finish when the player keeps stepping out`);
    assert.deepEqual(leaks, [], `"${id}" celebrated on a screen the player had left: ${leaks.join(", ")}`);
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

test("华丽: a quiz SAYS its own answer, and an ordinal is a word not a digit", async () => {
  // BEHAVIOURAL PASS 2026-08 — the tap-harness proves a game is winnable, never
  // that its instruction makes sense, so all 40 of her games were driven with
  // JoshAudio.say captured and every line READ. Two games were speaking less
  // than they should: 月亮圆缺 was the one quiz that never restated its answer
  // (its siblings all say "对！是兔！" / "西瓜是夏天的"), so the game about
  // moon phases never once named a phase; and 描福字 spoke the bare numeral it
  // prints in the dot — the digit-shaped cousin of speaking a picture.
  const said = async (id, taps) => {
    await openGame(id);
    await page.evaluate(() => {
      const A = window.JoshAudio;
      if (!A.__cap) { A.__cap = A.say.bind(A); }
      window.__SAID = [];
      A.say = (t, o) => { window.__SAID.push(String(t)); return A.__cap(t, o); };
    });
    const screen = page.locator(`#screen-${id}`);
    for (let i = 0; i < taps; i++) {
      const ok = await page.evaluate((g) => {
        const t = document.querySelector("#screen-" + g + ' [data-correct="1"]');
        if (!t) return false;
        t.click(); return true;
      }, id);
      if (!ok) break;
      await page.waitForTimeout(60);
    }
    await screen.waitFor({ state: "visible" });
    return page.evaluate(() => window.__SAID.slice());
  };

  const NAMES = ["新月", "蛾眉月", "上弦月", "盈凸月", "满月"];
  const moon = await said("hl-moon", 1);
  assert.ok(moon.some((s) => NAMES.some((n) => s.includes(n))),
    `月亮圆缺 must NAME the phase it just filled in; heard: ${JSON.stringify(moon)}`);

  const fu = await said("hl-fu-trace", 2);
  assert.ok(fu.some((s) => /^第[一二三四五六七八九十]笔$/.test(s)),
    `描福字 must speak "第一笔", not a bare digit; heard: ${JSON.stringify(fu)}`);
  assert.ok(!fu.some((s) => /^\d+$/.test(s)),
    `描福字 must never speak a bare numeral; heard: ${JSON.stringify(fu)}`);
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
  // …then the lever tips it. It APPEARS with the last rock, so it is pressed the
  // way a child who looked would press it: a thing that appeared 60ms ago can
  // only be the hammer's echo (framework.js rule 3), never an aim.
  await page.waitForTimeout(400);
  await page.locator(".truck__lever").click();
  await page.waitForTimeout(80);
  assert.ok(await tipOf() < -20, "pulling DUMP tips the bed right up");
});

test("[hidden] HIDES on every navigation screen and on the fort's", async () => {
  // The game screens are checked at open and at their win by the every-game
  // walk; this covers the rest of the app — the front door, Josh's home and
  // categories, the Sticker Book, 华丽's screens, and the fort's home and play
  // screens (which carried eleven per-class [hidden] patches of their own).
  // The list is DERIVED from the DOM's non-game screens, so a new screen is
  // walked the day it exists.
  const ids = await page.evaluate(() => [...document.querySelectorAll(".screen:not(.game)")].map((s) => s.id.replace(/^screen-/, "")));
  assert.ok(ids.length >= 15, `derived the navigation screens (saw ${ids.length}) — a broken query would make this vacuous`);
  const bad = [], seen = new Set();
  const visit = async () => {
    const vis = await page.evaluate(() => [...document.querySelectorAll(".screen")].filter((s) => !s.hidden).map((s) => s.id));
    vis.forEach((v) => seen.add(v));
    for (const x of await shownHidden()) bad.push(vis.join("+") + ": " + x);
  };
  for (const id of ids) {
    await page.evaluate((i) => { location.hash = "#__renav"; location.hash = i === "start" ? "" : "#" + i; }, id);
    await page.waitForTimeout(80);
    await visit();
  }
  // the fort's play screen, with a live run on it
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => window.__TD.newGame(1, { seed: 3 }));
  await page.evaluate(() => { location.hash = "#__renav"; location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.waitForTimeout(200);
  await visit();
  assert.ok(seen.size >= 15, `actually SHOWED the screens it walked (saw ${seen.size}) — a route that bounced everywhere would check nothing`);
  assert.ok(seen.has("screen-td-play"), "the fort's play screen was visited with a run on it");
  assert.deepEqual(bad, [], "an element with [hidden] still has a box on screen — a class set `display` and beat [hidden]");
  // leave no parked fort run behind for the tests after this one
  await page.evaluate(() => { location.hash = "#__renav"; location.hash = "#home"; });
  await page.evaluate(() => window.__TD && window.__TD.resetSave && window.__TD.resetSave());
});

test("last round's chips do not linger behind the next one (Who Hid?, Mix It!)", async () => {
  // Both games HIDE their answer chips while the next round is set up — the
  // line-up beat, the pouring — and `.choices` sets `display: grid`, so before
  // [hidden] had one owner the previous round's chips stayed ON SCREEN, the old
  // answer still flagged: a real tap on it during Who Hid?'s line-up counted a
  // round nobody had asked (measured). The every-game walk cannot reach that
  // window — its clicks win the next rounds through the still-visible chip
  // before the line-up starts — so this drives each game to it.
  const chipsAt = (sel) => page.evaluate((s) => {
    const n = document.querySelector(s);
    return { boxes: n.getClientRects().length, kids: n.children.length, flagged: n.querySelectorAll('[data-correct="1"]').length };
  }, sel);
  await openGame("who-hid");
  const again = page.locator("#screen-who-hid .game__again");
  if (await again.isVisible().catch(() => false)) { await page.waitForTimeout(400); await again.click(); }
  await page.waitForFunction(() => document.querySelector('#screen-who-hid .choices [data-correct="1"]'), null, { timeout: 5000 });
  await page.evaluate(() => document.querySelector('#screen-who-hid .choices [data-correct="1"]').click());
  await page.waitForTimeout(1100); // past the 900ms deferred round: round 2's line-up
  assert.ok(await page.evaluate(() => document.querySelector("#screen-who-hid .choices").hidden === true),
    "fixture: this must be round 2's line-up (only newRound hides the chips), before the cloud drifts in");
  assert.deepEqual(await chipsAt("#screen-who-hid .choices"), { boxes: 0, kids: 0, flagged: 0 },
    "Who Hid?: during the next round's line-up, last round's chips must be GONE — not on screen, and not lingering flagged");
  await openGame("color-mix");
  for (let k = 0; k < 2; k++) {
    await page.evaluate(() => document.querySelector('#screen-color-mix .mix__pot[data-correct="1"]').click());
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => document.querySelector('#screen-color-mix .mix__choices [data-correct="1"]').click());
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => !!document.querySelector('#screen-color-mix .mix__pot[data-correct="1"]')),
    "fixture: this must be the next round's pouring");
  assert.deepEqual(await chipsAt("#screen-color-mix .mix__choices"), { boxes: 0, kids: 0, flagged: 0 },
    "Mix It!: while the next round pours, last round's chips must be GONE — not on screen, and not lingering flagged");
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

test("a script that never arrives is NOTICED, not left to five downstream failures", async () => {
  // The half a fake page cannot prove. A live run went red on five assertions
  // about 华丽's world — all of them saying she had 20 games instead of 40 —
  // because exactly one of her two game files never arrived from the CDN edge.
  // Not one of the five named a script, and the deploy's own pre-flight had
  // fetched every versioned asset and got 200 for each seconds earlier, from a
  // different connection. `goto` resolves on `load`, and a `<script defer>`
  // whose fetch failed fires no error anybody is listening for.
  //
  // The RETRY POLICY is driven with a fake page in site.test.js; this is the
  // DETECTION: does a real DOM actually notice.
  const { missingScripts } = require("./helpers.js");

  // 1. The control, and the reason this is not a false-positive machine. It
  //    must be silent on the very page every other test in this file uses.
  const clean = await missingScripts(page);
  const total = await page.evaluate(() => document.querySelectorAll("script[src]").length);
  assert.ok(total >= 20, `fixture: the page must carry its real script set (saw ${total})`);
  assert.deepEqual(clean, [], `a healthy page must report nothing missing (got ${clean.join(", ")})`);

  // 2. The real failure, reproduced by blocking exactly the file that vanished.
  //    Its own context, so nothing else in this file inherits the route.
  const ctx = await browser.newContext();
  try {
    await ctx.route("**/games-hl-a.js*", (r) => r.abort());
    const p2 = await ctx.newPage();
    let threw = "";
    const warn = console.warn; console.warn = () => {};
    try { await p2.goto(baseURL, { waitUntil: "load" }); } catch (e) { threw = String(e.message); }
    finally { console.warn = warn; }
    assert.match(threw, /games-hl-a\.js/,
      `a script that never arrived must be named, not inferred (threw: ${threw || "nothing"})`);
    // …and the fixture is self-verifying: this really does produce the live
    // symptom, so the clause above is aimed at the defect rather than beside it.
    const hl = await p2.evaluate(() => (window.JoshGames || []).filter((g) => g.hl).length);
    assert.ok(hl > 0 && hl < 40,
      `fixture: blocking one of her two files must reproduce the live symptom (saw ${hl} of 40)`);
  } finally { await ctx.close(); }

  // 3. THE FAILURE DIRECTION, which decides whether this is safe to ship at all.
  //    Resource Timing body sizes are an engine feature and WebKit is not
  //    installed in the dev sandbox, so "it works in Chromium" proves nothing
  //    about the browser CI actually runs this against. An engine that reports
  //    no body for ANYTHING must make the check a no-op — never a machine that
  //    flags all 26 scripts and fails the run three retries later.
  const blind = await browser.newContext();
  try {
    await blind.addInitScript(() => {
      const real = performance.getEntriesByType.bind(performance);
      performance.getEntriesByType = (t) => real(t).map((e) => (t !== "resource" ? e
        : { name: e.name, initiatorType: e.initiatorType, decodedBodySize: 0 }));
    });
    const p3 = await blind.newPage();
    await p3.goto(baseURL, { waitUntil: "load" });
    const none = await missingScripts(p3);
    const n3 = await p3.evaluate(() => document.querySelectorAll("script[src]").length);
    assert.ok(n3 >= 20, `fixture: the blind page still carries its scripts (saw ${n3})`);
    assert.deepEqual(none, [],
      `an engine with no Resource Timing sizes must silence this check, not fail every script (flagged ${none.length} of ${n3})`);
  } finally { await blind.close(); }
});

test("Two Words Make One GLUES — and not with a flex gap (Safari 14 has none)", async () => {
  // The two halves sliding together IS this game's payoff, and it was animated
  // with flex `gap: 12px -> 0`. Safari 14 has no flex gap, so on Josh's actual
  // iPad the halves never parted and nothing ever moved: the whole point of the
  // game was invisible on the one device it is played on. It hid behind the
  // flex-gap law's DECORATIVE allowlist, exactly the way `.td-hud`'s "readouts,
  // not tappable" entry hid a gap that had become a button's spacing.
  //
  // A Chromium test cannot see that by playing normally, because Chromium HAS
  // flex gap — so the drop is SIMULATED: forcing `gap: normal` is precisely what
  // Safari 14 does with the declaration. That is what makes this test able to
  // FAIL on the shipped defect rather than merely describe the fix.
  //
  // Reduced motion is emulated so the join lands instantly: the game rebuilds
  // the round 850ms after a correct tap, and racing that timer is how this test
  // would go flaky.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const drop = await page.addStyleTag({ content: ".glue__parts { gap: normal !important; }" });
  try {
    await page.evaluate(() => { location.hash = "#word-glue"; });
    await page.waitForTimeout(220);
    const split = () => page.evaluate(() => {
      const w = document.querySelectorAll(".glue__parts .glue__word");
      return Math.round(w[1].getBoundingClientRect().left - w[0].getBoundingClientRect().right);
    });
    const apart = await split();
    assert.ok(apart > 20,
      `the halves must start APART even with flex gap dropped — got ${apart}px, so nothing can slide`);
    await page.locator(".choices [data-correct]").first().click();
    await page.waitForTimeout(80);
    const joined = await split();
    assert.ok(apart - joined >= 20,
      `tapping the answer must GLUE the halves together — measured ${apart}px -> ${joined}px`);
  } finally {
    // A style tag and a media emulation both outlive the test on a shared page,
    // and this suite has already been bitten by a fixture that left the viewport
    // rotated and took the NEXT test down with it.
    await drop.evaluate((n) => n.remove());
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
});

test("two games' MECHANIC is a clip-path, and it must actually clip", async () => {
  // `.curtain__who`'s graded 100/68/42/0 reveal IS the puzzle of Who's Behind
  // the Curtain?, and `.fix__glyph` shows each card's clipped HALF of a toy in
  // Fix the Toys. Both were shipped as UNPREFIXED `clip-path` while this app
  // prefixes nine other properties (styles/main.css now carries the twin, and
  // site.test.js keeps every prefixed property consistent). This is the other
  // half: proof that the property is load-bearing, so the twin is insurance for
  // a real mechanic and a future refactor cannot quietly drop the clip.
  //
  // NO IMAGE DECODING IS NEEDED, because clip-path affects HIT TESTING: a point
  // inside the element's BOX but outside its clip does not hit the element.
  // That is crisper than a pixel diff and needs no PNG decoder.
  const hits = (sel) => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const at = (fx, fy) => {
      const h = document.elementFromPoint(Math.round(r.left + r.width * fx), Math.round(r.top + r.height * fy));
      return h === el || (h ? el.contains(h) : false);
    };
    return { clip: getComputedStyle(el).clipPath, centre: at(0.5, 0.5), tl: at(0.25, 0.25), br: at(0.75, 0.75) };
  }, sel);

  // The curtain opens CLOSED: inset(100%) clips everything away, so nothing in
  // the box is hittable. Without the clip the whole character is simply there —
  // which is the game giving its own answer away.
  await openGame("curtain-peek");
  const shut = await hits(".curtain__who");
  assert.ok(shut, "the curtain stage must render its hidden character");
  assert.match(shut.clip, /inset\(\s*100%/, `the closed curtain must clip everything away — got "${shut.clip}"`);
  assert.deepEqual([shut.centre, shut.tl, shut.br], [false, false, false],
    `no point of the closed curtain may be hittable, or the answer is on screen from the first frame: ${JSON.stringify(shut)}`);

  // Fix the Toys shows the LEFT or the RIGHT half — one quarter hits, the
  // opposite one must not, which is the half-toy geometry itself.
  await openGame("fix-toys");
  const half = await page.evaluate(() => {
    const el = document.querySelector(".fix__card--l .fix__glyph, .fix__card--r .fix__glyph");
    return el ? el.parentElement.className : null;
  });
  assert.ok(half, "Fix the Toys must render a clipped half-card");
  const cut = await hits(".fix__card--l .fix__glyph, .fix__card--r .fix__glyph");
  assert.match(cut.clip, /inset\(.*50%/, `a half-card must clip half its glyph away — got "${cut.clip}"`);
  assert.notEqual(cut.tl, cut.br,
    `a half-card must be hittable on ONE side only, or both cards show the whole toy: ${JSON.stringify(cut)} on ${half}`);

  // CONTROL: both readings are caused by the clip, not by the layout. With
  // clip-path forced off, every point hits — which is exactly what an engine
  // without clip-path would render.
  await page.addStyleTag({ content: "* { -webkit-clip-path: none !important; clip-path: none !important; }" });
  const open = await hits(".fix__card--l .fix__glyph, .fix__card--r .fix__glyph");
  assert.deepEqual([open.centre, open.tl, open.br], [true, true, true],
    `with clip-path off the whole glyph must be hittable, or this test is measuring something else: ${JSON.stringify(open)}`);
  await page.evaluate(() => { const t = [...document.querySelectorAll("style")].pop(); if (t) t.remove(); });
});

test("no uncaught page errors during the whole run", () => {
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
});

test("Word Cards: the home button opens it, it plays, and it comes back", async () => {
  // A structural scan proves the link and the precache EXIST; only following it
  // proves the button is not a dead end. Driven at 320 as well as 390 because
  // the deck bar is the tightest row and 320 is the narrowest audited width.
  for (const [w, h] of [[390, 844], [320, 568]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const pg = await ctx.newPage();
    const errs = [];
    pg.on("pageerror", (e) => errs.push(String(e)));
    try {
      await pg.goto(baseURL, { waitUntil: "load" });
      await pg.evaluate(() => { location.hash = "#home"; });
      await pg.locator("#screen-home").waitFor({ state: "visible" });

      const btn = await pg.evaluate(() => {
        const a = document.getElementById("home-cards");
        if (!a) return null;
        const r = a.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      });
      assert.ok(btn, `${w}px: no Word Cards button on Josh's home`);
      assert.ok(btn.w >= 75 && btn.h >= 75,
        `${w}px: the Word Cards button is ${btn.w}x${btn.h} — RULE 5 wants >= 75px for little hands`);
      // …and the glyph must sit IN the circle. A <button> centres its content by
      // UA default and an <a> does not, so this shipped with 🃏 jammed in the
      // top-left (offsets L0/T-3, 43px empty to the right) beside a 🚪 door that
      // looked identical in every box measurement. Centring now lives on
      // .btn-round itself, so the door is the control: both must agree.
      const ink = await pg.evaluate(() => {
        const off = (sel) => {
          const el = document.querySelector(sel), b = el.getBoundingClientRect();
          const r = document.createRange(); r.selectNodeContents(el);
          const t = r.getBoundingClientRect();
          return { lr: Math.round((t.left - b.left) - (b.right - t.right)),
                   tb: Math.round((t.top - b.top) - (b.bottom - t.bottom)) };
        };
        return { cards: off("#home-cards"), door: off("#home-door") };
      });
      for (const [who, o] of Object.entries(ink)) {
        assert.ok(Math.abs(o.lr) <= 4 && Math.abs(o.tb) <= 4,
          `${w}px: the ${who} glyph is off-centre in its circle (h ${o.lr}px, v ${o.tb}px) — ` +
          "a round button with its picture in the corner reads as broken");
      }

      await pg.locator("#home-cards").click();          // FOLLOW the real link
      await pg.waitForLoadState("load");
      const menu = await pg.evaluate(() => ({
        path: location.pathname,
        total: document.querySelector("#allBtn small").textContent.trim(),
        chips: [...document.querySelectorAll("#grid .chip")].map((c) => c.querySelector(".ct").textContent.trim()),
        reading: [...document.querySelectorAll("#readGrid .chip")].map((c) => c.querySelector(".nm").textContent.trim()),
        home: !!document.querySelector(".home"),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      assert.match(menu.path, /wordcards\.html$/, `${w}px: the button did not open the game (${menu.path})`);
      assert.ok(menu.home, `${w}px: no way back to Josh's home from the game`);
      assert.ok(menu.chips.length >= 10, `${w}px: only ${menu.chips.length} picture decks rendered`);
      // The reading decks are the point of the thing: he is learning to read,
      // and the deck already held the whole phonics spine without exposing it.
      assert.deepEqual(menu.reading, ["First Words", "Word Families", "Sound Teams", "Sight Words"],
        `${w}px: the reading decks are missing from the menu`);
      assert.ok(menu.overflow <= 0, `${w}px: the menu scrolls sideways by ${menu.overflow}px`);
      // …and the MENU's taps are audited too. Only the deck's were, which is how
      // "Every word" shipped at 354x70 against the 75px floor.
      const menuTaps = await pg.evaluate(() => [...document.querySelectorAll("#menu .chip, #menu .all, #menu .home")]
        .map((el) => { const b = el.getBoundingClientRect();
          return { n: (el.querySelector(".nm") || el).textContent.trim().slice(0, 20),
                   s: Math.round(Math.min(b.width, b.height)) }; })
        .filter((t) => t.s < 75));
      assert.deepEqual(menuTaps, [], `${w}px: menu controls below the 75px floor`);

      // The counts must be COUNTED, not stored: every rendered figure has to
      // equal what the page's own data holds. A stale literal fails here.
      const truth = await pg.evaluate(() => {
        const by = {};
        for (const c of CATS) by[c.label] = WORDS.filter((x) => x[2] === c.key).length;
        return { total: WORDS.length, by, labels: CATS.map((c) => c.label) };
      });
      assert.equal(menu.total, truth.total + " cards",
        `${w}px: the deck says "${menu.total}" but holds ${truth.total} cards`);
      menu.chips.forEach((txt, i) => {
        assert.equal(txt, truth.by[truth.labels[i]] + " cards",
          `${w}px: "${truth.labels[i]}" says "${txt}" but holds ${truth.by[truth.labels[i]]}`);
      });

      // …and it PLAYS: open a deck, flip a card, step on.
      await pg.locator(".chip").first().click();
      await pg.locator("#deck").waitFor({ state: "visible" });
      const play = await pg.evaluate(() => {
        const g = (s) => document.querySelector(s);
        const first = g("#word").textContent;
        g("#card").click();
        const flipped = g("#card").classList.contains("flipped");
        const pic = g("#pic").textContent.trim();
        g("#next").click();
        return {
          first, flipped, pic, second: g("#word").textContent, count: g("#count").textContent,
          taps: [...document.querySelectorAll("#deck button")].map((b) => {
            const r = b.getBoundingClientRect();
            return Math.round(Math.min(r.width, r.height));
          }),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      assert.ok(play.flipped, `${w}px: tapping the card did not turn it over`);
      assert.ok(play.pic.length > 0, `${w}px: the card's back is empty — the picture IS the answer`);
      assert.notEqual(play.second, play.first, `${w}px: Next did not move on (still "${play.first}")`);
      assert.match(play.count, /^2 \/ \d+$/, `${w}px: the counter reads "${play.count}" after one step`);
      const small = play.taps.filter((t) => t < 75);
      assert.deepEqual(small, [], `${w}px: deck controls below the 75px floor: ${small.join(", ")}`);
      assert.ok(play.overflow <= 0, `${w}px: the deck scrolls sideways by ${play.overflow}px`);

      // …and the way OUT works, or the button is a trap on a kid's tablet.
      await pg.locator("#back").click();
      // the menu's home button sits in the corner ‹ back just left, so it is
      // pressed like a child who LOOKED would — a double-tap on back must not
      // walk him out of Word Cards (see the page's echo guard)
      await pg.waitForTimeout(400);
      await pg.locator(".home").click();
      await pg.waitForLoadState("load");
      const back = await pg.evaluate(() => ({
        hash: location.hash,
        homeVisible: !document.getElementById("screen-home").hidden,
      }));
      assert.equal(back.hash, "#home", `${w}px: the game's home button landed on "${back.hash}"`);
      assert.ok(back.homeVisible, `${w}px: Josh's launcher is not showing after coming back`);
      assert.deepEqual(errs, [], `${w}px: uncaught page errors: ${errs.join(" | ")}`);
    } finally {
      await ctx.close();      // a test that opens a context owns closing it, even on failure
    }
  }
});

test("Word Cards: a double-tap cannot flip the card back, skip a card, or reach through a screen change", async () => {
  // MEASURED before the guard: the card flip is a TOGGLE, so a four-year-old's
  // double-tap flipped the card and flipped it straight back — he never saw the
  // answer; Next ran twice and skipped a card nobody saw; and a double-tap on a
  // deck chip opened the deck and landed its echo on the card beneath the
  // finger. The page loads no framework, so it carries its own two-rule guard
  // (see ECHO_MS in wordcards.html), and its screen rule is a COORDINATE rule:
  // the echo lands where the first tap did. Real taps (page.mouse) on a paused clock,
  // so "150ms later" means exactly that however loaded the runner is.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  try {
    await pg.clock.install({ time: new Date("2026-01-01T08:00:00") });
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
    await pg.clock.pauseAt(new Date("2026-01-01T09:00:00"));
    const center = (sel) => pg.evaluate((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    }, sel);
    const tap = ([x, y]) => pg.mouse.click(x, y);
    const wait = (ms) => pg.clock.runFor(ms);
    const state = () => pg.evaluate(() => ({
      deck: !document.getElementById("deck").classList.contains("hidden"),
      menu: !document.getElementById("menu").classList.contains("hidden"),
      flipped: document.getElementById("card").classList.contains("flipped"),
      count: document.getElementById("count").textContent,
    }));

    // Find a deck chip whose spot, once the deck is open, is the CARD — so the
    // chip's echo has something live to land on (or this would check nothing).
    // Open and close a deck with SYNTHETIC clicks to measure it: code is never
    // an echo, so the guard lets them straight through.
    const card = await pg.evaluate(() => {
      document.querySelector("#readGrid .chip").click();
      const r = document.getElementById("card").getBoundingClientRect();
      document.getElementById("back").click();
      return { l: r.left, t: r.top, r: r.right, b: r.bottom };
    });
    const chipSel = await pg.evaluate((c) => {
      const chips = [...document.querySelectorAll("#readGrid .chip")];
      const i = chips.findIndex((b) => {
        const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        return x > c.l + 10 && x < c.r - 10 && y > c.t + 10 && y < c.b - 10;
      });
      return i < 0 ? null : `#readGrid .chip:nth-child(${i + 1})`;
    }, card);
    assert.ok(chipSel, "fixture: some deck chip must sit where the card will be");
    const chip = await center(chipSel);

    // 1. the chip's echo lands on the card of the deck it opened — and does nothing
    await tap(chip);
    let s = await state();
    assert.ok(s.deck && !s.flipped, "fixture: the chip opens its deck, card face up");
    await wait(150); await tap(chip);
    s = await state();
    assert.ok(s.deck && !s.flipped,
      "a double-tap on a deck chip must not flip the card that appears under the finger — the echo cannot have been aimed at a screen that did not exist");

    // 2. the card's echo does not flip it back
    const cardXY = await center("#card");
    await wait(400); await tap(cardXY);
    assert.ok((await state()).flipped, "fixture: a deliberate tap flips the card");
    await wait(150); await tap(cardXY);
    assert.ok((await state()).flipped,
      "a double-tap on the card must leave it FLIPPED — the flip is a toggle, and the echo undid it");
    await wait(250); await tap(cardXY); // 400ms after the first tap — past its window — but 250 after the swallowed echo
    assert.ok((await state()).flipped, "a hammer STREAK stays swallowed until the hand pauses — each swallowed echo re-arms the window");
    await wait(400); await tap(cardXY);
    assert.ok(!(await state()).flipped, "a deliberate tap after the pause flips it back");

    // 3. Next's echo does not skip a card
    const next = await center("#next");
    const c0 = (await state()).count;
    await wait(400); await tap(next);
    const c1 = (await state()).count;
    assert.notEqual(c1, c0, "fixture: Next moves on");
    await wait(150); await tap(next);
    assert.equal((await state()).count, c1, "a double-tap on Next must move ONE card — the echo skipped a card nobody saw");
    await wait(400); await tap(next);
    assert.notEqual((await state()).count, c1, "a deliberate Next after the pause moves on");

    // 3b. an echo is a COORDINATE: a fast tap somewhere ELSE on a new screen
    // was aimed, however fast, and must get through
    await wait(400); await tap(await center("#back"));
    assert.ok((await state()).menu, "fixture: back to the menu");
    await wait(400); await tap(chip);
    const k0 = (await state()).count;
    await wait(120); await tap(next); // 120ms after the chip, on the new screen, far from it
    assert.notEqual((await state()).count, k0,
      "a fast tap somewhere ELSE on the new screen is aimed, not an echo — the screen rule is a coordinate rule");

    // 3c. a keyboard activation is never an echo (click detail 0)
    await wait(400);
    const f0 = (await state()).flipped;
    await pg.focus("#card");
    await pg.keyboard.press("Enter"); await wait(100); await pg.keyboard.press("Enter");
    assert.equal((await state()).flipped, f0,
      "two quick keyboard activations must BOTH land — nobody hammers Enter by accident");

    // 4. code is never an echo
    await wait(400);
    const flips = await pg.evaluate(() => {
      const c = document.getElementById("card"), was = c.classList.contains("flipped");
      c.click(); c.click();
      // el.click() carries detail 0, which the keyboard exemption also lets
      // through — so a synthetic click WITH a detail is what proves isTrusted
      const mk = () => new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 });
      const was2 = c.classList.contains("flipped");
      c.dispatchEvent(mk()); c.dispatchEvent(mk());
      return was === was2 && was2 === c.classList.contains("flipped");
    });
    assert.ok(flips, "two SYNTHETIC clicks must both land (isTrusted) — a demo or a test is not a finger");

    // 5. back to the menu: the echo must not open another deck
    const back = await center("#back");
    await wait(400); await tap(back);
    assert.ok((await state()).menu, "fixture: back returns to the menu");
    await wait(150); await tap(back);
    assert.ok((await state()).menu, "a double-tap on back must stay on the menu — its echo lands on whatever chip is under the finger");
    assert.deepEqual(errs, [], "no page errors");
  } finally {
    await ctx.close();
  }
});

test("Word Cards: he cannot guess the next card, and the sounds are right", async () => {
  // The owner's report, measured on the deck as supplied: 12 of 14 categories
  // were sorted short -> long (animals ran 3 to 8 letters), numbers ran
  // zero..ten in counting order, and opposites sat back to back — wet/dry,
  // old/new, fast/slow, cold/warm, dirty/clean, mom/dad, grandma/grandpa.
  // All three let him predict the next card instead of READING it.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });

    const r = await pg.evaluate(() => {
      const NUM = ["zero","one","two","three","four","five","six","seven","eight","nine","ten"];
      const decks = [];
      const look = (name, list) => {
        const len = list.map((c) => c[0].length);
        let clashes = 0, sorted = true;
        for (let k = 1; k < list.length; k++) {
          if (clash(list[k - 1], list[k])) clashes += 1;
          if (len[k] < len[k - 1]) sorted = false;
        }
        // a deck whose words are ALL one length (First Words is 3-letter CVC)
        // is trivially "sorted"; only a real spread can be sorted by length.
        const spread = new Set(len).size > 1;
        decks.push({ name, n: list.length, clashes, rampedByLength: sorted && spread });
      };
      for (const c of CATS) look(c.label, teachingOrder(WORDS.filter((x) => x[2] === c.key), c.label));
      // Every whole-library deck, CHECKED against the page's own buttons
      // rather than merely listed: this page's `.all` walk has already been
      // narrowed once by a second deck arriving (mobile.test.js clicked both
      // buttons and walked whichever was last), so a list here is how the
      // Chinese deck's dealt order goes unguarded. The seed must be the one
      // the BUTTON passes, or this measures a deal no player is ever dealt.
      const whole = [["All words", WORDS.slice()], ["Chinese", HANZI.slice()]];
      for (const [name, list] of whole) look(name, teachingOrder(list, name));
      look("First Words", teachingOrder(firstWords(), "First Words"));
      const nums = teachingOrder(WORDS.filter((x) => x[2] === "numbers"), "Numbers").map((x) => x[0]);
      let counting = 0;
      for (let k = 1; k < nums.length; k++) {
        const a = NUM.indexOf(nums[k - 1]);
        if (a >= 0 && NUM.indexOf(nums[k]) === a + 1) counting += 1;
      }
      // Two cards in one PICTURE deck can be linked by GRAMMAR rather than by
      // meaning — a cardinal and its ordinal, a singular and its plural — and
      // those give the next card away exactly as an opposite does. The counting
      // chain and the ordinal chain were each in PAIRS and the links BETWEEN
      // them were not, which is how "first one" and "second two" came to sit
      // side by side in the numbers deck. Derived rather than listed, so a
      // sixth link is covered when the deck grows. Sight cards are excluded on
      // purpose: they carry no picture, so there is nothing to give away, and
      // telling two similar sight words apart (a / as) IS the skill.
      const ORD = { one: "first", two: "second", three: "third" };
      const IRREG = [["foot", "feet"], ["tooth", "teeth"], ["mouse", "mice"]];
      const byW = {}; for (const x of WORDS) byW[x[0]] = x;
      const morphGaps = [], morphSeen = [];
      for (const c of [...new Set(WORDS.map((x) => x[2]))]) {
        if (c === "sight") continue;
        const words = WORDS.filter((x) => x[2] === c).map((x) => x[0]);
        const S = new Set(words), link = [];
        for (const a of words) {
          for (const suf of ["s", "es"]) if (S.has(a + suf)) link.push([a, a + suf]);
          if (ORD[a] && S.has(ORD[a])) link.push([a, ORD[a]]);
          for (const ir of IRREG) if (a === ir[0] && S.has(ir[1])) link.push(ir);
        }
        for (const q of link) {
          morphSeen.push(c + ": " + q.join("/"));
          if (!clash(byW[q[0]], byW[q[1]])) morphGaps.push(c + ": " + q.join("/"));
        }
      }

      // the same seed must give the same order every time, or a grown-up
      // cannot tell where he got to
      const twice = teachingOrder(WORDS.filter((x) => x[2] === "animals"), "Animals").map((x) => x[0]);
      const again = teachingOrder(WORDS.filter((x) => x[2] === "animals"), "Animals").map((x) => x[0]);
      return {
        decks, counting, nums, morphGaps, morphSeen,
        whole: whole.map((w) => w[0]),
        allButtons: [...document.querySelectorAll("#menu .all")].length,
        stable: twice.join() === again.join(),
        joinFails: WORDS.filter((x) => sounds(x[0]).join("") !== x[0]).map((x) => x[0]),
        firsts: firstWords().map((c) => c[0]), teams: teamDeck().map((c) => c[0]),
        ship: sounds("ship"), duck: sounds("duck"), sing: sounds("sing"),
        penguin: sounds("penguin"), koala: sounds("koala"), cat: sounds("cat"),
      };
    });

    for (const d of r.decks) {
      assert.equal(d.clashes, 0,
        `"${d.name}": ${d.clashes} places where the next card gives itself away ` +
        "(same picture, or an opposite he can guess from the one before)");
      assert.ok(!d.rampedByLength, `"${d.name}" is still sorted short -> long, so the deck is predictable`);
      assert.ok(d.n > 0, `"${d.name}" is empty`);
    }
    assert.equal(r.whole.length, r.allButtons,
      `${r.allButtons} whole-library deck button(s) on the page but ${r.whole.length} walked ` +
      `(${r.whole.join(", ")}) — a deck nobody deals-tests is a deck that can give itself away`);
    assert.equal(r.counting, 0, `the numbers still run in counting order: ${r.nums.join(" ")}`);
    assert.ok(r.stable, "the same deck must come out in the same order every time");

    // The clause above (clashes === 0) is satisfied trivially if a pair is
    // DELETED from the avoid list, so it cannot protect the list's contents.
    // This one asserts the relation itself: every grammatical link inside a
    // picture deck must be something clash() refuses to place side by side.
    assert.deepEqual(r.morphGaps, [],
      "a cardinal beside its own ordinal, or a singular beside its plural, gives the next card " +
      "away as surely as an opposite does — but clash() would allow it");
    assert.ok(r.morphSeen.length >= 5,
      `only ${r.morphSeen.length} grammatical links were derived — the scan found nothing to check, ` +
      "so the clause above passed on an empty set");

    // A deck's LABEL is a claim: First Words promises you can blend it, so a
    // final w/y/r is disqualifying (k-e-y blends to nothing), and Sound Teams
    // must not hand him the two words where ch is NOT the sound it teaches.
    assert.ok(r.firsts.length >= 40, `only ${r.firsts.length} First Words`);
    const unblendable = r.firsts.filter((w) => /[wyr]$/.test(w));
    assert.deepEqual(unblendable, [], "First Words holds words he cannot sound out");
    assert.ok(r.teams.length >= 30, `only ${r.teams.length} Sound Teams words`);
    for (const w of ["anchor", "parachute"])
      assert.ok(!r.teams.includes(w), `"${w}" is in Sound Teams but its ch is a different sound`);

    // …and the sound strip splits by SOUND. "ship" is three sounds, not four.
    assert.deepEqual(r.joinFails, [], "a sound split that does not spell its own word");
    assert.deepEqual(r.ship, ["sh", "i", "p"], "ship is sh-i-p, not s-h-i-p");
    assert.deepEqual(r.duck, ["d", "u", "ck"], "duck is d-u-ck, not d-u-c-k");
    assert.deepEqual(r.sing, ["s", "i", "ng"], "sing is s-i-ng");
    assert.deepEqual(r.cat, ["c", "a", "t"], "a word with no letter team is still one tile per letter");
    // the exceptions are the whole reason this is data and not a regex
    assert.deepEqual(r.penguin, ["p","e","n","g","u","i","n"], "penguin's n and g are SEPARATE sounds");
    assert.deepEqual(r.koala, ["k","o","a","l","a"], "koala's o and a are separate sounds");

    // the tiles must SHOW a letter team as one tile, or the split is invisible
    await pg.evaluate(() => document.querySelectorAll("#readGrid .chip")[2].click());
    const tiles = await pg.evaluate(() => {
      document.getElementById("card").click();
      return [...document.querySelectorAll("#letters span")]
        .map((el) => ({ t: el.textContent, team: el.classList.contains("team") }));
    });
    const teams = tiles.filter((t) => t.team);
    assert.ok(teams.length >= 1 && teams.every((t) => t.t.length > 1),
      `a Sound Teams card drew no multi-letter tile: ${JSON.stringify(tiles)}`);

    // …and it can SAY the word: control of error with no grown-up in the room.
    const audio = await pg.evaluate(() => {
      const said = [];
      // `window.speechSynthesis` is a read-only accessor, so a plain assignment
      // silently does nothing and the real (silent) engine answers instead —
      // which is a stub that never installed, not a feature that never fired.
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true, value: { speak: (u) => said.push(u.text), cancel() {} },
      });
      window.SpeechSynthesisUtterance = function (t) { this.text = t; };
      // self-verifying, or the clause below cannot tell "the stub never
      // installed" from "the feature never fired" — which is the bug it
      // just caught. `!said.push` was dead: said is always an array.
      window.speechSynthesis.speak({ text: "__probe__" });
      if (said.join() !== "__probe__") throw new Error("the speech stub did not install");
      said.length = 0;
      const btn = document.getElementById("sound");
      const before = btn.getAttribute("aria-pressed");
      document.getElementById("card").click();          // flip back, muted
      const whileOff = said.length;
      btn.click();                                       // turn sound on
      document.getElementById("card").click();           // flip to the picture
      return { before, on: btn.getAttribute("aria-pressed"), whileOff, said,
               stored: localStorage.getItem("wc-sound") };
    });
    assert.equal(audio.before, "false", "sound must start OFF (RULE 5)");
    assert.equal(audio.whileOff, 0, "nothing may be spoken while sound is off");
    assert.equal(audio.on, "true", "the sound button did not turn on");
    assert.equal(audio.stored, "1", "the sound choice is not remembered");
    assert.ok(audio.said.length >= 1, "with sound on, turning a card over must say the word");

    // …and it remembers where he got to. The seeded order is only worth having
    // if you can carry on: a five-minute session is about twenty cards, so
    // without this the back of a 503-card deck is never reached.
    const place = await pg.evaluate(() => {
      const cats = [...document.querySelectorAll("#grid .chip")];
      document.getElementById("back").click();
      cats[0].click();
      for (let k = 0; k < 3; k++) document.getElementById("next").click();
      const at = document.getElementById("count").textContent;
      const word = document.getElementById("word").textContent;
      document.getElementById("back").click();
      cats[0].click();                                   // come back to it
      const resumed = document.getElementById("count").textContent;
      const resumedWord = document.getElementById("word").textContent;
      document.getElementById("back").click();
      cats[1].click();                                   // a DIFFERENT deck
      return { at, word, resumed, resumedWord, other: document.getElementById("count").textContent };
    });
    assert.equal(place.resumed, place.at, "coming back to a deck must not start it over");
    assert.equal(place.resumedWord, place.word, `resumed on "${place.resumedWord}", left on "${place.word}"`);
    assert.match(place.at, /^4 \//, `stepping three times landed on "${place.at}"`);
    assert.match(place.other, /^1 \//, "each deck keeps its OWN place, not a shared one");

    assert.deepEqual(errs, [], `uncaught page errors: ${errs.join(" | ")}`);
  } finally {
    await ctx.close();      // a test that opens a context owns closing it, even on failure
  }
});

test("Word Cards: the sound-out strip scales with the card", async () => {
  // wordcards.html is a standalone PAGE with its own inline CSS — it never
  // loads main.css, so none of the tablet work done for Josh's launcher reaches
  // it, and nothing had ever measured it at the size he actually reads on.
  //
  // Measured there: the word derives from the card's HEIGHT and the picture
  // from its WIDTH — a constant 24.8 / 24.2 / 24.1 / 24.4 % of the card at 320,
  // 390, 414 and every tablet — so the picture is NOT shortchanged, which a
  // screenshot made me believe until that ratio refuted it. The strip was the
  // one thing on the card that never scaled at all: a flat 30px whether the
  // card was 284 wide or 524, on the phonics content his June 2026 report lists
  // as his working edge. 30 is the FLOOR now, so a phone renders exactly as it
  // always did and only a bigger card gains.
  //
  // Fresh CONTEXT per size, never setViewportSize — the documented reason a
  // tablet check once survived its own mutation.
  const read = async (w, h) => {
    const c = await browser.newContext({ viewport: { width: w, height: h } });
    const pg = await c.newPage();
    const errs = [];
    pg.on("pageerror", (e) => errs.push(e.message));
    try {
      await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
      await pg.click("#grid .chip");
      await pg.waitForSelector(".card");
      // Walk the WHOLE deck: fit() shrinks per word, so the widest split is
      // what actually has to stay inside the card.
      const r = await pg.evaluate(() => {
        const card = document.querySelector(".card");
        const L = document.querySelector(".letters");
        const face = L.parentElement;
        const next = document.getElementById("next");
        const first = parseFloat(getComputedStyle(L).fontSize);
        let over = 0, n = 0;
        while (next && !next.disabled && n++ < 600) {
          // layout-only, so the back face's 3D transform cannot skew it
          if (L.scrollWidth > card.clientWidth - 44) over += 1;
          if (face.scrollHeight > face.clientHeight) over += 1;
          next.click();
        }
        return { first, cardW: card.clientWidth, over, cards: n };
      });
      assert.deepEqual(errs, [], `${w}px: uncaught page errors: ${errs.join(" | ")}`);
      return r;
    } finally {
      await c.close();
    }
  };

  const narrow = await read(320, 568);
  const phone = await read(390, 844);
  const tablet = await read(834, 1112);

  assert.ok(phone.cards > 40, `fixture: the walk must cover a real deck (saw ${phone.cards})`);
  assert.ok(tablet.cardW > phone.cardW * 1.4,
    `fixture: the tablet card must really be wider (${phone.cardW} -> ${tablet.cardW})`);

  // 30 is the floor, so every phone width renders exactly as it shipped.
  assert.equal(phone.first, 30, `a phone's strip must stay at its shipped 30px, saw ${phone.first}`);

  // A card half again as wide must carry a bigger strip. The bar is a MEASURED
  // separation rather than a slack: the flat version is x1.00 and this is x1.40.
  const grew = tablet.first / phone.first;
  assert.ok(grew >= 1.3,
    `the strip must scale with the card: ${phone.first}px on a ${phone.cardW}px card vs ` +
    `${tablet.first}px on a ${tablet.cardW}px one (x${grew.toFixed(2)}, need x1.3)`);

  // ... and it must still fit, on every word in the deck, at every width. 320 is
  // the clause that can actually FAIL: measured, fit()'s shrink only ever
  // engages there (strawberry and helicopter drop 30 -> 24 against a ~32px
  // ceiling), so at 390 and 834 the start already fits every word and those two
  // are defence-in-depth rather than load-bearing. Say which is which.
  assert.equal(narrow.over, 0, `the strip left the card at 320px (${narrow.over} of ${narrow.cards} cards)`);
  assert.equal(phone.over, 0, `the strip left the card on a phone (${phone.over} of ${phone.cards} cards)`);
  assert.equal(tablet.over, 0, `the strip left the card on a tablet (${tablet.over} of ${tablet.cards} cards)`);
  assert.equal(narrow.first, 30, `320px must also sit on the floor, saw ${narrow.first}`);
});

// Page-side auditor. The population is DERIVED — every text node actually on
// screen — never a list of selectors, because a list is what the next author
// forgets to join, and because the runs this found that I had NOT enumerated
// are the whole reason it exists.
function auditContrast() {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = (p) => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
  const ratio = (a, b) => {
    const x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const parse = (v) => {
    const m = String(v).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const q = m[1].split(",").map(parseFloat);
    return { rgb: [q[0], q[1], q[2]], a: q.length > 3 ? q[3] : 1 };
  };
  const over = (fg, a, bg) => [0, 1, 2].map((i) => a * fg[i] + (1 - a) * bg[i]);

  // Composite the REAL backdrop: every translucent background layer from the
  // element up to the first opaque one. That is the cascade rather than a guess
  // about which rule won — the digraph tile is a translucent plate sitting on
  // the card, and getting that one wrong is the entire finding this pins.
  const backdrop = (el) => {
    const stack = [];
    for (let n = el; n; n = n.parentElement) {
      const bg = parse(getComputedStyle(n).backgroundColor);
      if (!bg || !bg.a) continue;
      stack.push(bg);
      if (bg.a >= 1) break;
    }
    if (!stack.length || stack[stack.length - 1].a < 1) stack.push({ rgb: [255, 255, 255], a: 1 });
    let base = stack[stack.length - 1].rgb;
    for (let k = stack.length - 2; k >= 0; k--) base = over(stack[k].rgb, stack[k].a, base);
    return base;
  };

  const name = (el) => el.tagName.toLowerCase() +
    (el.id ? "#" + el.id : "") +
    (typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).join(".") : "");

  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const txt = (n.nodeValue || "").trim();
    if (!txt) continue;
    // ART, not text — a picture has no contrast requirement. Deliberately "has
    // a letter or a digit" and NOT an emoji property: \p{Emoji_Component}
    // MATCHES THE ASCII DIGITS (they are keycap bases), so an emoji test would
    // silently exempt every number on the page, which is how the fort's own
    // audit once skipped its prices, gold and lives.
    if (!/[\p{L}\p{Nd}]/u.test(txt)) continue;
    const el = n.parentElement;
    if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;

    // Occlusion — the audit must score what is PAINTED. Measured, removing this
    // changes no verdict today and the comment says so rather than implying a
    // protection: the card's two faces share one backdrop, so the unpainted one
    // scores identically, and the menu-behind-a-deck case is already handled by
    // `.hidden{display:none}`. It earns its place the moment a covered run sits
    // on a DIFFERENT backdrop, which is exactly how the fort's own audit once
    // scored the screen behind a dialog.
    const cx = Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 1);
    const cy = Math.min(Math.max(r.top + r.height / 2, 1), window.innerHeight - 1);
    const top = document.elementFromPoint(cx, cy);
    if (!top || !(el === top || el.contains(top) || top.contains(el))) continue;

    // This model folds `opacity` into the TEXT, which is exact for a run that
    // dims itself and WRONG for one dimmed by a parent (a parent dims its own
    // background too). Report that rather than compute a wrong number — and it
    // doubles as the mid-animation guard, since .pop ramps opacity .3 -> 1.
    let ancestorOpacity = 1;
    for (let q = el.parentElement; q; q = q.parentElement) {
      ancestorOpacity *= parseFloat(getComputedStyle(q).opacity || "1");
    }

    const col = parse(cs.color) || { rgb: [0, 0, 0], a: 1 };
    const bg = backdrop(el);
    const fg = over(col.rgb, col.a * parseFloat(cs.opacity || "1"), bg);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    // WCAG AA: large text is >= 24px, or >= 18.66px when bold.
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    out.push({
      sel: name(el), text: txt.slice(0, 22), size, weight,
      onCard: !!el.closest(".face"),
      bar: large ? 3.0 : 4.5,
      ratio: ratio(fg, bg),
      bg: bg.map(Math.round).join(","),
      ancestorOpacity,
    });
  }
  return out;
}

test("CONTRAST: every ACTIVE text run in Josh's and 华丽's worlds clears AA", async () => {
  // Both worlds had a ONE-OFF contrast pass and neither left a guardrail: the
  // fort's audit is scoped to fort surfaces and Word Cards' to its own page, so
  // 240 + 40 game screens had nothing checking them and a new game inherits no
  // protection at all. The recorded objection was cost — the 华丽 pass decoded
  // screenshots and took 77s — and it is obsolete: compositing COMPUTED styles
  // measures the same thing in ~13s for 245 surfaces, which is why this can be
  // a test rather than a memory.
  //
  // It found 80 real sub-AA runs across NINE css rules, led by `color: #2b5`
  // on the white answer card — the big tappable numeral in 50+ games, at
  // 2.29:1 — and .truck__lever, which replaced .btn-big's audited pink
  // gradient with YELLOW while inheriting its white ink (1.44:1), i.e. it
  // inherited the parent's promise without the property.
  //
  // THREE THINGS IT DELIBERATELY DOES NOT JUDGE, each because the metric
  // cannot model them, and each measured rather than assumed:
  //
  //  positional — a run over a GRADIENT is scored at every stop. If they all
  //    fail, position cannot save it and it is a finding ("tight"); if any
  //    passes, where the run sits decides. That is not hypothetical: 华丽's
  //    poem line is cream on a body gradient running #8E1414 -> #E0A339 and
  //    scores 1.92 against the gold END, while the line sits at 41% of the
  //    screen over the dark red. Scoring the worst stop alone contradicted her
  //    painted (screenshot) pass, which reported zero, on 9 runs.
  //  shadowed — a text-shadow is a real legibility device that a ratio cannot
  //    see. 44 runs carry one (white 900-weight numerals on saturated cards:
  //    .dt__car, .song__note, .cbn__swatch, .mt__abbr).
  //  inactive — WCAG 1.4.3 exempts an inactive component, and dimming IS the
  //    signal for .coin--off (a coin that would overshoot) exactly as it is
  //    for the fort's locked star-tree nodes.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  try {
    await pg.goto(baseURL, { waitUntil: "load" });

    const AUDIT = (lbl) => {
      const px = (t) => (t.match(/-?[\d.]+/g) || []).slice(0, 4).map(Number);
      const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };
      const mix = (fg, bg, a) => [0, 1, 2].map((i) => Math.round(fg[i] * a + bg[i] * (1 - a)));
      // Composite the PAINTED backdrop from the bottom up. The first cut treated
      // a gradient as opaque and reported 200 false failures on .game__promptText:
      // .screen.game carries a TRANSLUCENT rgba(120,214,140,..) "floor" over the
      // body gradient, so the raw green stop is a colour never actually painted.
      const bgOf = (el) => {
        const layers = []; let n = el;
        while (n && n !== document.documentElement) {
          const cs = getComputedStyle(n);
          if (/gradient/.test(cs.backgroundImage)) {
            const st = (cs.backgroundImage.match(/rgba?\([^)]*\)/g) || []).map(px).filter((c) => c.length >= 3);
            if (st.length) layers.push({ grad: st });
          }
          const c = px(cs.backgroundColor);
          const al = c[3] === undefined ? 1 : c[3];
          if (al > 0) layers.push({ c: c.slice(0, 3), a: al });
          if (al === 1) { n = null; break; }   // opaque: nothing beneath is painted
          n = n.parentElement;
        }
        layers.push({ c: [255, 255, 255], a: 1 });
        let out = [[255, 255, 255]];
        for (let i = layers.length - 1; i >= 0; i--) {
          const L = layers[i];
          if (L.grad) {
            const next = [];
            for (const base of out) for (const st of L.grad)
              next.push(mix(st.slice(0, 3), base, st[3] === undefined ? 1 : st[3]));
            out = next.slice(0, 24);
          } else out = out.map((base) => mix(L.c, base, L.a));
        }
        return { bgs: out, grad: layers.some((L) => L.grad) };
      };
      // ART is "no letter and no digit". The obvious spelling is a trap:
      // \p{Emoji_Component} MATCHES THE ASCII DIGITS, which once made the fort's
      // own audit skip every price and score in the game.
      const isArt = (t) => !/[\p{L}\p{Nd}]/u.test(t);
      const out = { runs: 0, judged: 0, shadowed: 0, exempt: 0, positional: 0, fails: [] };
      const seen = new Set();
      for (const el of document.querySelectorAll("*")) {
        if (!el.offsetParent && getComputedStyle(el).position !== "fixed") continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
        const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
        if (!txt) continue;
        out.runs += 1;
        if (isArt(txt)) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
        const cx = Math.min(innerWidth - 1, Math.max(1, r.left + Math.min(6, r.width / 2)));
        const cy = Math.min(innerHeight - 1, Math.max(1, r.top + r.height / 2));
        const top = document.elementFromPoint(cx, cy);
        if (top && top !== el && !el.contains(top) && !top.contains(el)) continue;   // occluded
        if (el.closest('[disabled], [aria-disabled="true"], [class*="--locked"], [class*="__dim"], [class*="--dim"], [class*="--off"]')) { out.exempt += 1; continue; }
        if (cs.textShadow && cs.textShadow !== "none") { out.shadowed += 1; continue; }
        const c = px(cs.color);
        const { bgs, grad } = bgOf(el);
        const size = parseFloat(cs.fontSize), weight = Number(cs.fontWeight);
        const bar = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5;
        let worst = Infinity, best = -Infinity, worstBg = null;
        for (const bg of bgs) {
          const ink = mix(c.slice(0, 3), bg, (c[3] === undefined ? 1 : c[3]) * Number(cs.opacity));
          const rr = ratio(ink, bg);
          if (rr < worst) { worst = rr; worstBg = bg; }
          if (rr > best) best = rr;
        }
        out.judged += 1;
        if (worst >= bar) continue;
        if (grad && best >= bar) { out.positional += 1; continue; }   // position decides — not a finding
        const key = String(el.className) + "|" + txt.slice(0, 24);
        if (seen.has(key)) continue;
        seen.add(key);
        out.fails.push(`${lbl}: .${String(el.className).slice(0, 40)} "${txt.slice(0, 24)}" is ` +
          `${worst.toFixed(2)}:1 on rgb(${worstBg}) at ${size}px/w${weight}, below AA's ${bar}:1`);
      }
      return out;
    };

    const fails = [];
    let surfaces = 0, runs = 0, judged = 0;
    const look = async (hash, sel, lbl) => {
      await pg.evaluate((h) => { location.hash = "#__x"; location.hash = h; }, hash);
      try { await pg.locator(sel).waitFor({ state: "visible", timeout: 5000 }); }
      catch { assert.fail(`${lbl}: ${sel} never became visible`); }
      const o = await pg.evaluate(AUDIT, lbl);   // IN THE PAGE, not in node
      surfaces += 1; runs += o.runs; judged += o.judged; fails.push(...o.fails);
    };

    await look("#home", "#screen-home", "josh home");
    await look("", "#screen-start", "front door");
    await look("#stickers", "#screen-stickers", "sticker book");
    await look("#hl-home", "#screen-hl-home", "hl home");
    await look("#hl-stickers", "#screen-hl-stickers", "hl book");
    // DERIVED from the live registry, so a 241st game is audited the day it lands
    const ids = await pg.evaluate(() => (window.JoshGames || []).map((g) => g.id));
    assert.ok(ids.length >= 200, `only ${ids.length} games registered — the walk would be near-vacuous`);
    for (const id of ids) await look("#" + id, "#screen-" + id, id);

    assert.deepEqual(fails.slice(0, 8), [],
      `${fails.length} text run(s) below WCAG AA (first 8 shown; grouped by CSS rule they are usually far fewer)`);
    // A derivation fails OPEN: a broken walk, a blinded text scan or a bgOf that
    // returns nothing all pass on an empty set, so the population is asserted.
    assert.ok(surfaces >= 240, `only ${surfaces} surfaces audited`);
    assert.ok(runs >= 2000, `only ${runs} text runs seen — the scan went blind`);
    assert.ok(judged >= 500, `only ${judged} runs were actually SCORED — the exemptions swallowed the audit`);
  } finally { await ctx.close(); }
});

test("Word Cards: every text run clears WCAG AA on all eight card colours", async () => {
  // wordcards.html is the one standalone PAGE in this app — its own inline CSS,
  // it never loads main.css — so no contrast pass had ever reached it. Measured
  // from the shipped literals, four runs were below AA and every one of them was
  // on a LIGHT fill, which is the mechanism: dark ink on this card's eight hues
  // is only 5.01:1 at its WORST, so there is no headroom to dim on and even
  // opacity .90 breaches (4.39). On the dark ground the same trick is fine —
  // white at .50 there is 5.22 — which is why the failures cluster.
  //
  //   .all small       16px/700 ink .50   3.35:1 on white   (the 503-card count)
  //   .chip .ct        14px/700 ink .55   2.46..3.51        (each deck's count)
  //   .hint            15px/700 ink .42   1.95..2.49        ("tap me")
  //   .letters .team   on a .14 INK plate 2.78 on purple    (sh / ch / th)
  //
  // The last is the sharpest and is a different defect from the other three: a
  // dark plate under already-dark ink DARKENS the background it sits on, so the
  // highlighted tile rendered fainter than its plain siblings (3.18..5.33) —
  // below even the 3.0 large-text bar — on the digraph skill his June 2026
  // report lists as his working edge. A highlight has to be the clearest mark
  // on the strip, not the faintest.
  //
  // reducedMotion is LOAD-BEARING, not precautionary: `.face` carries
  // `transition: background .35s ease`, so sampling after a Next click would
  // read a card colour still BLENDING between two hues rather than either of
  // them — and `.pop` ramps the word's opacity from .3. Both are gated under
  // reduce, which is the fix a red verify-live already taught this repo.
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, reducedMotion: "reduce",
  });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  try {
    const runs = [];
    const cardHues = new Set();
    const boardFills = new Set();
    const sweep = async () => {
      for (const r of await pg.evaluate(auditContrast)) runs.push(r);
    };
    // The card's OWN fill, read off `.face`. Counting distinct backgrounds
    // across all runs looked like the same thing and is not: the menu shows
    // eight chips in the eight hues, so that count sits at 8 even if the card
    // never advances past its first colour. Assert the property.
    const noteHue = async () => cardHues.add(
      await pg.evaluate(() => getComputedStyle(document.querySelector(".face")).backgroundColor));
    const openDeck = async (label) => {
      await pg.evaluate((l) => {
        const b = [...document.querySelectorAll(".chip")].find((x) => x.textContent.includes(l));
        if (b) b.click();
      }, label);
      await pg.waitForSelector(".card");
    };

    // THE MENU IS AN INNER SCROLLER AND THE AUDIT ONLY SCORES WHAT IS PAINTED,
    // so a single sweep saw one screenful of it and silently dropped the rest.
    // It passed for as long as `.all` happened to sit above the fold; adding a
    // section pushed it below and the fixture floor caught it. Walk the whole
    // scroller instead, which also means every deck chip is audited rather than
    // the first four.
    const sweepMenu = async () => {
      await sweep();
      let more = true;
      while (more) {
        more = await pg.evaluate(() => {
          const m = document.querySelector("#menu");
          const at = m.scrollTop;
          m.scrollTop = Math.min(at + m.clientHeight * 0.85, m.scrollHeight);
          return m.scrollTop > at + 1;
        });
        if (more) await sweep();
      }
      await pg.evaluate(() => { document.querySelector("#menu").scrollTop = 0; });
    };

    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
    await sweepMenu();                               // the MENU: chips, counts, headings

    // Eight cards, because `--card` cycles COLORS[i % 8] — so a walk of eight
    // is what scores every hue the card can take. Both FACES of each: the front
    // carries the word and the hint, the back the picture and the sound strip.
    await openDeck("Sound Teams");                   // the deck that has team tiles
    for (let k = 0; k < 8; k++) {
      await noteHue();
      await sweep();
      await pg.click(".card");                       // flip
      await sweep();
      await pg.click("#next");
    }
    await pg.click("#back");
    await pg.waitForSelector("#grid .chip");
    // A letter-team deck marks the team on the FRONT of the card too, on the
    // same .55 white plate the strip gives a team tile — and the front word is
    // FULL ink where the strip is .7, so it is the lighter case of a pair this
    // test already scores. Walked anyway rather than argued: a new text run on
    // a new plate is exactly what an audit scoped to known surfaces misses.
    await openDeck("like duck");                     // the ck deck
    for (let k = 0; k < 4; k++) {
      await sweep();
      await pg.click(".card");
      await sweep();
      await pg.click("#next");
    }
    await pg.click("#back");
    await pg.waitForSelector("#grid .chip");
    await openDeck("Sight Words");                   // the deck that renders .pic.sentence
    for (let k = 0; k < 4; k++) {
      await sweep();
      await pg.click(".card");
      await sweep();
      await pg.click("#next");
    }
    await pg.click("#back");
    await pg.waitForSelector("#grid .chip");
    // …and the Chinese deck, whose back is THREE runs where every other card's
    // is one picture or one sentence. Those runs take the 4.5 bar rather than
    // the strip's 3.0 — they are not large text — and on a light fill there is
    // no headroom to dim, which is the mechanism behind every finding this test
    // was written for. A brand-new set of runs is exactly what an audit scoped
    // to the surfaces it was written against misses.
    await pg.click("#hanziBtn");
    await pg.waitForSelector(".card");
    for (let k = 0; k < 4; k++) {
      await sweep();
      await pg.click(".card");
      await sweep();
      await pg.click("#next");
    }
    // …AND THE MATCHING BOARD, whose character tile takes THREE different fills
    // — white while it waits, the card yellow while it is held, green once it
    // is matched — so one run is scored against three backgrounds that exist
    // nowhere else on this page. That is exactly the case this audit's own
    // comment above says it misses: a brand-new set of runs on new fills.
    await pg.click("#back");
    await pg.waitForSelector("#grid .chip");
    await pg.click("#matchBtn");
    await pg.waitForSelector("#match:not(.hidden)");
    const noteTile = async () => boardFills.add(await pg.evaluate(() =>
      getComputedStyle(document.querySelector("#mchars .mtile")).backgroundColor));
    await noteTile();
    await sweep();                                   // plain
    await pg.evaluate(() => document.querySelector("#mchars .mtile").click());
    await noteTile();
    await sweep();                                   // held
    await pg.evaluate(() => {
      const ch = document.querySelector("#mchars .mtile").dataset.ch;
      document.querySelector('#mpics [data-ch="' + ch + '"]').click();
    });
    await noteTile();
    await sweep();                                   // matched

    assert.deepEqual(errs, [], `uncaught page errors: ${errs.join(" | ")}`);

    // FIXTURE FLOOR. A derived population fails OPEN — a walker that stopped
    // matching would audit nothing and report a clean sweep, which is exactly
    // how a contrast pass can pass while measuring the screen behind it.
    assert.ok(runs.length >= 120, `the audit must find real text (saw ${runs.length} runs)`);
    assert.equal(cardHues.size, 8,
      `the card cycles eight hues and each must be scored (saw ${cardHues.size}: ` +
      `${[...cardHues].join(" ")})`);
    assert.ok(runs.some((r) => r.onCard), "fixture: no run was scored on a card at all");
    const saw = (s) => runs.some((r) => r.sel.includes(s));
    assert.ok(saw(".team"), "fixture: no digraph tile was audited — it is the point of this test");
    // The front-of-card mark shares the .team class with the strip's tile (that
    // is the point — one mark, two surfaces), so `sel` cannot tell them apart.
    // A SPLIT word can: `duck` yields the text run "du" beside a marked "ck"
    // only when the front is marked at all, so this is the front one.
    assert.ok(runs.some((r) => r.sel.includes("word") && r.text === "du"),
      "fixture: the front of the card never showed a split word, so its team mark went unaudited");
    assert.ok(saw(".hint"), "fixture: the front-of-card hint was never audited");
    assert.ok(saw(".ct"), "fixture: the deck chips' card counts were never audited");
    assert.ok(saw("small"), "fixture: the Every-word card count was never audited");
    for (const run of ["hz__key", "hz__zh", "hz__en"])
      assert.ok(saw(run), `fixture: the Chinese card's ${run} run was never audited`);
    assert.ok(saw("mchar"), "fixture: the matching board's character tile was never audited");
    assert.equal(boardFills.size, 3,
      "a board tile takes three fills — waiting, held and matched — and each is a " +
      `different background the same run has to clear (saw ${boardFills.size}: ` +
      `${[...boardFills].join(" ")})`);

    // The compositing model's own precondition, asserted rather than assumed.
    const dimmed = [...new Set(runs.filter((r) => r.ancestorOpacity < 0.999).map((r) => r.sel))];
    assert.deepEqual(dimmed, [],
      `an ancestor dims its whole subtree, so this model would score these wrong: ${dimmed.join(", ")}`);

    const fails = runs.filter((r) => r.ratio < r.bar);
    const worst = [...new Map(fails.map((f) =>
      [f.sel + f.bg, `${f.sel} "${f.text}" ${f.ratio.toFixed(2)}:1 on rgb(${f.bg}) (bar ${f.bar})`],
    )).values()];
    assert.equal(fails.length, 0,
      `${fails.length} text run(s) below WCAG AA: ${worst.slice(0, 8).join(" | ")}`);
  } finally {
    await ctx.close();
  }
});

test("Word Cards: the strip stays LARGE text, so its .7 ink keeps the 3.0 bar", async () => {
  // The strip is the one run whose WCAG bar can move under it. `fit()` shrinks
  // per word down to a floor of 13px, and at 26px/800 the strip is LARGE text
  // (bar 3.0), where ink at .7 measures 3.18..5.33 and passes on every card.
  // Below 18.66px bold it becomes NORMAL text, bar 4.5, and that same ink fails
  // on six of the eight hues — a contrast failure caused by a LENGTH, with no
  // colour changed anywhere.
  //
  // 320 is the viewport that can separate those two states and the only one:
  // measured, the shrink loop engages ONLY there (helicopter takes it to 24px)
  // while 390 and 834 never leave their start size. So this is a real second
  // size rather than a fence — the bar is a property of the rendered font size,
  // and 320 is where that size is smallest.
  const ctx = await browser.newContext({
    viewport: { width: 320, height: 568 }, reducedMotion: "reduce",
  });
  const pg = await ctx.newPage();
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
    await pg.click("#allBtn");
    await pg.waitForSelector(".card");
    const r = await pg.evaluate(() => {
      const L = document.querySelector(".letters");
      const next = document.getElementById("next");
      let min = Infinity, worst = "", n = 0;
      while (next && !next.disabled && n++ < 700) {
        const s = parseFloat(getComputedStyle(L).fontSize);
        if (s < min) { min = s; worst = document.getElementById("word").textContent; }
        next.click();
      }
      return { min, worst, n, weight: parseInt(getComputedStyle(L).fontWeight, 10) };
    });
    assert.ok(r.n > 400, `fixture: the walk must cover the whole deck (saw ${r.n})`);
    assert.ok(r.weight >= 700, `fixture: the large-text threshold assumes bold (saw ${r.weight})`);
    assert.ok(r.min >= 18.66,
      `the sound strip shrank to ${r.min}px on "${r.worst}", which is NORMAL text — ` +
      `its .7 ink is 3.18:1 at worst and needs 4.5 there, so a long word would ` +
      `become a contrast failure with no colour changed`);
  } finally {
    await ctx.close();
  }
});

test("Word Cards: the card grows with the screen, and the MENU deliberately does not", async () => {
  // The strip test one above proved the SOUND STRIP scales. It did not ask
  // whether the CARD does, and measured, it did not: `.wrap` capped at 560px,
  // so from 600px up the card froze at 524 while the viewport grew to 1024 —
  // 89-91% of the width on every phone, then 68 / 63 / 51%. Its contents froze
  // with it: the picture pinned to its 8rem cap and the word to a literal 132,
  // so THE WORD HE READS WAS EXACTLY THE SAME SIZE on a 390px phone and an
  // 834px iPad. That is "a tablet must never be stingier than a phone" on the
  // one page no audit reaches.
  //
  // Note why the earlier pass missed it, because the shape recurs: it measured
  // picture / card WIDTH, found a constant 24% at every size, and concluded the
  // picture was not shortchanged. True — and useless, because BOTH terms capped
  // at the same 600px breakpoint. A ratio that holds while both of its terms
  // are frozen tells you nothing about either.
  const read = async (w, h) => {
    const c = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    const pg = await c.newPage();
    try {
      await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
      const menu = await pg.evaluate(() => document.getElementById("menu").clientWidth);
      await pg.click("#allBtn");
      await pg.waitForSelector(".card");
      await pg.click(".card");                       // the picture lives on the back
      const r = await pg.evaluate(() => {
        const card = document.querySelector(".card");
        const px = (el) => parseFloat(getComputedStyle(el).fontSize);
        return {
          card: card.clientWidth,
          word: px(document.querySelector(".word")),
          pic: px(document.querySelector(".back-face .pic")),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      return { ...r, menu };
    } finally {
      await c.close();
    }
  };

  const sizes = [[320, 568], [390, 844], [414, 896], [768, 1024], [834, 1112], [1024, 1366]];
  const got = [];
  for (const [w, h] of sizes) got.push({ w, ...(await read(w, h)) });
  const at = (w) => got.find((g) => g.w === w);
  const phone = at(390), tablet = at(834);

  // Nothing may spill sideways at any of them — a wider card is only an
  // improvement if it still fits.
  for (const g of got) assert.equal(g.overflow, 0, `${g.w}px overflows by ${g.overflow}px`);

  // THE PHONE IS UNCHANGED BY CONSTRUCTION, and pinned so it stays a conscious
  // decision. Not by a breakpoint — the deck's cap is UNCONDITIONAL, because a
  // `max-width` on a `width: 100%` box can only cap and never expand, so it is
  // inert at every phone width on its own. The picture's clamp never reaches
  // either cap on a phone (22vmin is 70-91px), and the word's vw track crosses
  // 132 only at 471px, above every phone.
  assert.deepEqual(
    { card: at(320).card, word: at(320).word, pic: Math.round(at(320).pic) },
    { card: 284, word: 123, pic: 70 }, "320px must render exactly as it shipped");
  assert.deepEqual(
    { card: phone.card, word: phone.word, pic: Math.round(phone.pic) },
    { card: 354, word: 132, pic: 86 }, "390px must render exactly as it shipped");
  assert.equal(at(414).word, 132, "414px is still a phone and must not gain");

  // ...and a tablet must genuinely GAIN. The bars are measured separations
  // between the two states, not slacks: on the shipped-before code these read
  // card x1.48, word x1.00 and picture x1.49, and they now read x2.21, x1.77
  // and x2.13. The WORD is the sharpest — it was literally the same number.
  const grew = (k) => tablet[k] / phone[k];
  assert.ok(grew("word") >= 1.4,
    `the word he READS must be bigger on a tablet: ${phone.word}px at 390 vs ` +
    `${tablet.word}px at 834 (x${grew("word").toFixed(2)}, need x1.4)`);
  assert.ok(grew("card") >= 1.8,
    `the card must grow with the screen: ${phone.card}px vs ${tablet.card}px ` +
    `(x${grew("card").toFixed(2)}, need x1.8)`);
  assert.ok(grew("pic") >= 1.8,
    `the picture must grow with the screen: ${Math.round(phone.pic)}px vs ` +
    `${Math.round(tablet.pic)}px (x${grew("pic").toFixed(2)}, need x1.8)`);

  // No width may hand back LESS than a narrower one. This cannot catch the
  // defect above (the old values were flat, never decreasing) — it is here for
  // the opposite regression, a cap that starts binding too early.
  for (let k = 1; k < got.length; k++) {
    for (const f of ["card", "word", "pic"]) {
      assert.ok(got[k][f] >= got[k - 1][f] - 0.01,
        `${f} shrinks from ${got[k - 1].w}px to ${got[k].w}px ` +
        `(${Math.round(got[k - 1][f])} -> ${Math.round(got[k][f])})`);
    }
  }

  // THE SIGHT DECK'S SENTENCE IS THE SIBLING CAP, and it is checked here rather
  // than in a test of its own because it is the same claim: `.pic.sentence` had
  // the identical 2.6rem ceiling and went the WRONG way against the card — 60%
  // of its width on a phone and 41% on an 834 tablet. Raising one cap and
  // leaving its neighbour one CSS line below is the fix-it-where-you-found-it
  // class this project keeps paying for.
  const sentence = async (w, h) => {
    const c = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    const pg = await c.newPage();
    try {
      await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
      await pg.evaluate(() => {
        const b = [...document.querySelectorAll(".chip")].find((x) => x.textContent.includes("Sight Words"));
        if (b) b.click();
      });
      await pg.waitForSelector(".card");
      await pg.click(".card");
      return await pg.evaluate(() => ({
        px: parseFloat(getComputedStyle(document.querySelector(".back-face .pic")).fontSize),
        card: document.querySelector(".card").clientWidth,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
    } finally {
      await c.close();
    }
  };
  const sPhone = await sentence(390, 844), sTablet = await sentence(834, 1112);
  assert.equal(sPhone.overflow, 0, "the sight deck overflows on a phone");
  assert.equal(sTablet.overflow, 0, "the sight deck overflows on a tablet");
  assert.equal(Math.round(sPhone.px), 27, `the phone's sentence must stay 27px (saw ${sPhone.px})`);
  const sGrew = sTablet.px / sPhone.px;
  assert.ok(sGrew >= 1.7,
    `the sight sentence must grow with the card too: ${Math.round(sPhone.px)}px at 390 vs ` +
    `${Math.round(sTablet.px)}px at 834 (x${sGrew.toFixed(2)}, need x1.7 — it was x1.52 while capped)`);

  // AND THE MENU IS A DELIBERATE NON-CHANGE, pinned so nobody "finishes the
  // job" by widening it too. Its chips already measure 255px at 834, and 14
  // categories fill EVENLY only at two columns — 3 and 4 both orphan a card,
  // which is the same even-fill law the fort's contents row is held to. So the
  // menu keeps the 560 cap while the deck leaves it.
  assert.equal(tablet.menu, at(390).menu > 560 ? tablet.menu : 560,
    `the menu must keep its 560px cap (saw ${tablet.menu})`);
  assert.ok(tablet.card > tablet.menu,
    `the deck must be the one that grew: card ${tablet.card} vs menu ${tablet.menu}`);
});

test("Word Cards: every control SAYS what it is, and the answer stays off the tree", async () => {
  // The axis this page had never been measured on. Josh's world, 华丽's world
  // and the fort have all had an accessible-name pass; the one standalone PAGE
  // in the app had not — the same scope hole its contrast pass turned out to
  // have. Measured on the shipped page, three defects, all the recorded class:
  //
  //   18 of 18 menu chips carried NO aria-label, so each announced its icon,
  //     its name and its count run together — "First Words46 cards" — exactly
  //     as the fort's difficulty chips read "Normal24/40" before their fix;
  //   the card's name was a STATIC "Flip the card", byte-identical before and
  //     after the flip, so the one control this page exists for never said
  //     which card it was nor what had just happened; and
  //   `backface-visibility` hides a face from the EYE and not from assistive
  //     tech, so both faces sat in the tree at once and the card read
  //     "elephanttap me [picture]elephant" — the ANSWER, before it was turned.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
    await pg.waitForSelector(".chip");

    // ── the menu ────────────────────────────────────────────────────────────
    const menu = await pg.evaluate(() => {
      const out = [];
      for (const b of document.querySelectorAll("#menu .chip")) {
        out.push({
          label: b.getAttribute("aria-label"),
          nm: b.querySelector(".nm").textContent.trim(),
          // DERIVED from what the chip actually PRINTS, never a literal here:
          // a hard-coded count in the label is then caught on the first deck
          // whose size differs from it.
          ct: b.querySelector(".ct").textContent.trim(),
          raw: b.textContent.replace(/\s+/g, " ").trim(),
        });
      }
      // DERIVED over every deck button. This read `getElementById("allBtn")`,
      // and the moment a SECOND one landed (the 中文 deck) the law quietly
      // narrowed to the one button it was written against.
      const alls = [...document.querySelectorAll("#menu .all")].map((b) => {
        const small = b.querySelector("small");
        const ct = small.textContent.trim();
        return {
          id: b.id,
          // the name half is whatever the button says BESIDES its count
          lbl: b.textContent.replace(small.textContent, "").replace(/\s+/g, " ").trim(),
          ct,
          name: (b.getAttribute("aria-label") || b.textContent).replace(/\s+/g, " ").trim(),
        };
      });
      const title = document.querySelector(".title");
      const tcs = getComputedStyle(title);
      return {
        chips: out,
        alls,
        outline: [...document.querySelectorAll("h1,h2,h3,h4")].map((h) => h.tagName + ":" + h.textContent.trim()),
        titleTag: title.tagName,
        titleMargin: tcs.marginTop + " " + tcs.marginBottom,
      };
    });

    // FIXTURE, and it is what makes the count clause falsifiable: the decks are
    // genuinely different sizes, so a label that prints one fixed number is
    // wrong on all but one of them. A suite where every deck held the same
    // count could not tell a derived label from a typed one.
    assert.ok(menu.chips.length >= 15, `expected the full deck menu, saw ${menu.chips.length} chips`);
    const sizes = new Set(menu.chips.map((c) => c.ct));
    assert.ok(sizes.size >= 3,
      `fixture: the decks must differ in size or a hard-coded count would pass (saw ${sizes.size} distinct)`);

    for (const c of menu.chips) {
      assert.ok(c.label, `the "${c.nm}" chip has no aria-label, so it announces ${JSON.stringify(c.raw)}`);
      assert.ok(c.label.includes(c.nm), `the "${c.nm}" chip must be announced by NAME (saw ${JSON.stringify(c.label)})`);
      const n = c.ct.match(/\d+/)[0];
      assert.ok(new RegExp("(^|\\D)" + n + "(\\D|$)").test(c.label),
        `the "${c.nm}" chip prints ${c.ct} and announces ${JSON.stringify(c.label)} — the two must agree`);
      // the defect itself: name and number colliding into one spoken word
      assert.ok(!c.label.includes(c.nm + n),
        `the "${c.nm}" chip runs its name into its count: ${JSON.stringify(c.label)}`);
    }

    // A RECORDED NON-CHANGE: a deck button needs no aria-label, because its two
    // parts are already separate text nodes and it announces "Every word 503
    // cards". Pinned as the property (both parts, not run together) rather than
    // as an absence, so it stays true whichever way a future edit takes it.
    //
    // THE CLAIM IS ABOUT THE DOM TEXT, NOT THE ACCESSIBLE NAME, and that is the
    // whole point of this clause. The 中文 button shipped as `</span><small>`
    // with no whitespace between them, i.e. "…Characters120 cards" in the DOM —
    // and Chromium's accname algorithm inserts a space at the grid-item
    // boundary, so it read back perfectly here with the defect present. An
    // accname assertion could not have failed on it. A literal space in the
    // markup makes the separation true on every engine, which matters because
    // the engine Josh's iPad speaks with is WebKit and this sandbox has none.
    //
    // Floor first: this is exactly how the law was lost. Narrow the walk back
    // to one button and the second deck is checked by nothing.
    assert.ok(menu.alls.length >= 2,
      `expected every deck button, saw ${menu.alls.length} — a narrowed walk checks nothing`);
    for (const a of menu.alls) {
      assert.ok(a.lbl, `a deck button announces no name at all (${a.id})`);
      assert.ok(/\d/.test(a.ct), `the "${a.lbl}" deck button prints no count (saw ${JSON.stringify(a.ct)})`);
      const n = a.ct.match(/\d+/)[0];
      assert.ok(a.name.includes(a.lbl),
        `the "${a.lbl}" deck button must be announced by NAME (saw ${JSON.stringify(a.name)})`);
      assert.ok(new RegExp("(^|\\D)" + n + "(\\D|$)").test(a.name),
        `the "${a.lbl}" deck button prints ${a.ct} and announces ${JSON.stringify(a.name)} — the two must agree`);
      // the defect itself: the deck's name and its size colliding into one word
      assert.ok(!a.name.includes(a.lbl + n),
        `the "${a.lbl}" deck button runs its name into its count: ${JSON.stringify(a.name)}`);
    }

    // ── the document's own outline ─────────────────────────────────────────
    // It began at h2 with no h1, so the page's NAME was in no heading at all
    // and a reader navigating by heading landed straight in "Learning to read".
    // The swap is free ONLY because `.title` overrides all three properties an
    // h1 differs by — measured byte-identical at 320, 390 and 834 (same box,
    // same first chip, same document height) — so the margin is pinned here:
    // drop it from `.title` and the UA's own 0.67em would move the whole menu.
    assert.equal(menu.titleTag, "H1", `the page's name must be its top-level heading (saw <${menu.titleTag}>)`);
    assert.equal(menu.titleMargin, "6px 2px",
      `.title must keep declaring its own margin, or an h1 takes the UA's (saw ${menu.titleMargin})`);
    // The claim is "never skips a level", and this was a LITERAL ["H1","H2","H2"]
    // — which cannot express that and breaks the moment a section is added, as
    // the Letter teams section did. Asserted as the property instead, so a
    // fourth section inherits it, with a floor because a walk that stopped
    // matching would pass on an empty outline.
    const levels = menu.outline.map((h) => parseInt(h.split(":")[0].slice(1), 10));
    assert.ok(levels.length >= 3, `the menu's outline is missing (saw ${levels.length} headings)`);
    assert.equal(levels[0], 1, `the outline must open at h1 (saw h${levels[0]})`);
    for (let k = 1; k < levels.length; k++)
      assert.ok(levels[k] <= levels[k - 1] + 1,
        `the outline skips a level: ${JSON.stringify(menu.outline)}`);

    // ── the card ────────────────────────────────────────────────────────────
    const openDeck = async (host, name) => {
      await pg.evaluate(({ host, name }) => {
        for (const b of document.querySelectorAll(host + " .chip"))
          if (b.querySelector(".nm").textContent.trim() === name) b.click();
      }, { host, name });
      await pg.waitForTimeout(250);
    };
    const readCard = () => pg.evaluate(() => {
      const card = document.getElementById("card");
      return {
        flipped: card.classList.contains("flipped"),
        label: card.getAttribute("aria-label"),
        word: document.getElementById("word").textContent,
        // the sound tiles as the STRIP renders them — the label must read the
        // same split, or the two have drifted
        parts: [...document.querySelectorAll("#letters span")].map((s) => s.textContent),
        back: document.getElementById("pic").textContent,
        frontHidden: document.getElementById("frontFace").getAttribute("aria-hidden"),
        backHidden: document.getElementById("backFace").getAttribute("aria-hidden"),
        backLabel: document.getElementById("back").getAttribute("aria-label"),
      };
    });

    await openDeck("#grid", "Animals");
    let c = await readCard();

    assert.notEqual(c.label, "Flip the card",
      "the card's name must say WHICH card it is, not a fixed instruction");
    assert.ok(c.label.includes(c.word), `the card must be announced by its word (saw ${JSON.stringify(c.label)})`);
    assert.match(c.label, /picture/i, `an unflipped picture card must say what tapping shows (saw ${JSON.stringify(c.label)})`);
    assert.equal(c.frontHidden, "false", "the face you can SEE must be in the accessibility tree");
    assert.equal(c.backHidden, "true",
      `the turned-away face must NOT be — it holds the answer (${JSON.stringify(c.back)})`);

    // and the deck's own back button: "Animals" does not say it LEAVES Animals
    assert.ok(c.backLabel && /back/i.test(c.backLabel),
      `the deck's back button must name where it goes (saw ${JSON.stringify(c.backLabel)})`);

    const before = c.label;
    await pg.click("#card");
    await pg.waitForTimeout(650);
    c = await readCard();

    assert.ok(c.flipped, "fixture: the tap must have flipped the card");
    assert.notEqual(c.label, before, "the name must change when the card turns over — it is a different side");
    assert.ok(c.label.includes(c.word), `the flipped card must still name its word (saw ${JSON.stringify(c.label)})`);
    // The tiles are separate boxes on screen and run together as text, so the
    // split has to be spoken one sound at a time or the strip's whole point is
    // lost on the channel it matters most for.
    assert.ok(c.parts.length >= 2, `fixture: "${c.word}" must split into tiles (saw ${c.parts.length})`);
    assert.ok(c.label.includes(c.parts.join(", ")),
      `the label must read the SAME split the strip renders (${c.parts.join("-")} vs ${JSON.stringify(c.label)})`);
    assert.equal(c.frontHidden, "true", "the turned-away front must leave the tree in its turn");
    assert.equal(c.backHidden, "false", "the face you can now SEE must be in the tree");

    // ── moving on resets it ────────────────────────────────────────────────
    await pg.click("#next");
    await pg.waitForTimeout(250);
    const d = await readCard();
    assert.notEqual(d.word, c.word, "fixture: Next must reach a different card");
    assert.ok(d.label.includes(d.word), `the name must follow the NEW word (saw ${JSON.stringify(d.label)})`);
    assert.match(d.label, /picture/i, "a fresh card is unflipped, so its name must offer the picture again");
    assert.equal(d.backHidden, "true", "a fresh card hides its answer again");

    // ── the sight deck asks a different question ───────────────────────────
    await pg.click("#back");
    await pg.waitForTimeout(200);
    await openDeck("#readGrid", "Sight Words");
    let s = await readCard();
    assert.match(s.label, /sentence/i,
      `a sight card shows a SENTENCE, not a picture (saw ${JSON.stringify(s.label)})`);
    assert.doesNotMatch(s.label, /picture/i, "a sight card must not promise a picture it does not have");
    await pg.click("#card");
    await pg.waitForTimeout(650);
    s = await readCard();
    assert.ok(s.label.includes(s.back),
      `a flipped sight card must read its sentence (${JSON.stringify(s.back)} vs ${JSON.stringify(s.label)})`);

    assert.deepEqual(errs, [], "no page errors");
  } finally {
    await ctx.close();
  }
});

test("Word Cards: every letter team he is learning has its own deck", async () => {
  // Josh's profile puts phonograms / digraphs on the WORKING list — his
  // challenge edge, the thing to practise. The splitter already knew fourteen
  // letter teams and exactly THREE of them (sh, ch, th) had a deck: measured on
  // the deck as supplied, ck carried 15 words, oo 18, ow 14, ee 12 and not one
  // was reachable as a lesson. A phonogram also generalises where a rime does
  // not — -ock only ever helps with rock and sock, while ck helps with bucket,
  // ticket and backpack too, which is exactly the step from decoding a 3-letter
  // word (his MASTERED) to reading a two-syllable one.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });

    const r = await pg.evaluate(() => {
      // The chips live in TWO grids now — Letter teams and Bossy R — so the
      // population claim below has to read both. This test caught the split
      // itself when bossy r shipped, which is the right failure: its claim is
      // "every team that clears the bar has a deck", and reading one CONTAINER
      // quietly narrowed that to "...and is in this grid". Which grid a team
      // lands in is the bossy-r test's business, not this one's.
      const grab = (id) => [...document.querySelectorAll("#" + id + " .chip")].map((b) => ({
        pg: b.querySelector(".ic").textContent,
        nm: b.querySelector(".nm").textContent,
        ct: b.querySelector(".ct").textContent,
        say: b.getAttribute("aria-label"),
      }));
      const teamChips = grab("teamGrid"), chips = [...teamChips, ...grab("bossyGrid")];
      // What the DATA says a chip should exist for, computed the same way the
      // page does but read back out, so the two can be compared.
      const eligible = SOUND_RULES.map((x) => x[0]).filter((p) => teamWords(p).length >= TEAM_MIN);
      const decks = {};
      for (const p of eligible) decks[p] = teamWords(p).map((w) => w[0]);
      // Is every card in a team's deck a card the SPLITTER puts that team in?
      const strays = [];
      for (const p of eligible)
        for (const w of decks[p])
          if (!sounds(w).some((t) => t.toLowerCase() === p)) strays.push(p + ":" + w);
      return { chips, teamChips, eligible, decks, strays, min: TEAM_MIN, like: TEAM_LIKE,
               plain: eligible.filter((p) => !BOSSY.test(p)),
               count: Object.fromEntries(SOUND_RULES.map((x) => [x[0], teamWords(x[0]).length])),
               sh: decks.sh, ck: decks.ck };
    });

    // 1. THE POPULATION IS DERIVED. A chip exists for exactly the teams that
    //    clear the bar — so a team that reaches it when a card is added gets a
    //    deck with no code change, and a thin one (tch, wh, ay, igh, oi, oy) is
    //    excluded by the count rather than by being left off a list.
    //    That deepEqual is a WIRING check and it FLATTENS: both sides read
    //    TEAM_MIN, so moving the bar moves both and it stays green. It proves
    //    the chips FOLLOW the data and nothing about how many there are — the
    //    two clauses under it are what cannot flatten, and what a hard-coded
    //    list of three fires on.
    assert.deepEqual([...r.chips.map((c) => c.pg)].sort(), [...r.eligible].sort(),
      "a team that clears the bar has no chip in either grid");
    assert.deepEqual(r.teamChips.map((c) => c.pg), r.plain,
      "the Letter teams grid is not the non-bossy teams the data says clear the bar");
    assert.ok(r.eligible.length >= 10,
      `only ${r.eligible.length} letter teams have a deck — the section is barely a section`);
    for (const p of ["sh", "ch", "th", "ck", "ng", "ee", "oo", "ow"])
      assert.ok(r.eligible.includes(p), `${p} has no deck of its own`);

    // 2. EVERY DECK IS DERIVED FROM THE SPLITTER, which is what stops a chip
    //    promising a team the card then splits some other way. anchor and
    //    parachute leave the ch deck by the splitter excepting them, not by a
    //    second list remembering to.
    assert.deepEqual(r.strays, [],
      `a team deck holds a card whose own sound strip does not show that team: ${r.strays.join(", ")}`);
    for (const w of ["anchor", "parachute"])
      assert.ok(!r.decks.ch.includes(w), `"${w}" is in the ch deck but its ch is a different sound`);

    // 3. THE COUNT IS COUNTED. Falsifiable only because the decks differ in
    //    size: a typed "15 cards" is caught on whichever chip is not 15.
    for (const c of r.chips)
      assert.equal(c.ct, r.decks[c.pg].length + " cards",
        `the ${c.pg} chip prints ${c.ct} for a deck of ${r.decks[c.pg].length}`);

    // 4. THE CHIP SAYS ITS TEAM. The team is printed in the icon slot and an
    //    icon slot is aria-hidden, so without an explicit label the one thing
    //    the chip is about is the one thing it never announces.
    for (const c of r.chips)
      assert.equal(c.say, c.pg + ", " + c.nm + ", " + c.ct,
        `the ${c.pg} chip announces ${JSON.stringify(c.say)}`);

    // 5. THE EXEMPLAR LEADS ITS OWN DECK AND IS A REAL MEMBER OF IT. Picked by
    //    length alone the oo deck led with "hook", which teaches one of oo's
    //    two sounds while the name everybody knows is "oo like MOON".
    for (const p of r.eligible) {
      assert.ok(r.like[p], `the ${p} deck has no declared exemplar`);
      assert.equal(r.decks[p][0], r.like[p],
        `the ${p} deck opens on ${r.decks[p][0]}, not on its own exemplar ${r.like[p]}`);
    }
    assert.equal(r.like.oo, "moon", "oo is taught as moon, not as one of its other sound's words");
    //    ...and the MIRROR of that, which is the half that was missing. Every
    //    DECLARED exemplar must still HAVE a deck. Clause 1's deepEqual
    //    FLATTENS (chips and eligible both read TEAM_MIN and teamWords), so a
    //    deck falling below the bar removes the chip from the page AND from
    //    the expectation and stays green; the floor beside it tolerates losing
    //    EIGHT decks. Measured, three decks sit at EXACTLY the bar (oa, ph, qu
    //    at 4 cards), so one card leaving any of them — re-split by a new
    //    splitter exception, say — silently deletes a lesson from the section.
    //    This needs no count of its own: TEAM_LIKE declares which teams are
    //    LESSONS, the bar is the MECHANISM, and the two must agree. The upward
    //    direction is already the clause above (a 19th deck is red until its
    //    exemplar is declared), so the two halves together are two-sided.
    const orphan = Object.keys(r.like).filter((p) => !r.eligible.includes(p));
    assert.deepEqual(orphan, [],
      "a team is taught in TEAM_LIKE but no longer clears the " + r.min + "-card bar, so its "
      + "chip silently vanished from the page: "
      + orphan.map((p) => p + " (" + r.count[p] + " cards)").join(", "));

    // 6. SCAFFOLDED SHORT WORD FIRST — after the exemplar a deck never steps
    //    back down in length, so it opens on the 3- and 4-letter words he
    //    already decodes and walks out to the two-syllable ones.
    for (const p of r.eligible) {
      const len = r.decks[p].slice(1).map((w) => w.length);
      for (let k = 1; k < len.length; k++)
        assert.ok(len[k] >= len[k - 1],
          `the ${p} deck steps back down in length at ${r.decks[p][k + 1]}`);
    }
    assert.equal(r.ck[r.ck.length - 1], "backpack", "the ck deck should end on its longest word");

    // 7. THE TEAM IS MARKED ON THE FRONT OF THE CARD, on exactly the tiles the
    //    strip will show a moment later — never on a substring that merely
    //    looks like the team. backpack is what makes that falsifiable: it
    //    carries TWO ck tiles, so a mark built with indexOf finds one.
    const mark = await pg.evaluate(() => {
      [...document.querySelectorAll("#teamGrid .chip")]
        .find((b) => b.querySelector(".ic").textContent === "ck").click();
      const out = [];
      const word = document.querySelector(".word");
      for (let k = 0; k < teamWords("ck").length; k++) {
        out.push({
          text: word.textContent,
          marked: [...word.querySelectorAll(".team")].map((s) => s.textContent),
          tiles: sounds(word.textContent).filter((t) => t.toLowerCase() === "ck").length,
        });
        document.querySelector("#next").click();
      }
      return out;
    });
    for (const m of mark) {
      assert.ok(m.marked.length > 0, `"${m.text}" is in the ck deck with no ck marked on it`);
      assert.equal(m.marked.length, m.tiles,
        `"${m.text}" has ${m.tiles} ck tiles but ${m.marked.length} marked`);
      for (const t of m.marked)
        assert.equal(t.toLowerCase(), "ck", `the ck deck marked ${JSON.stringify(t)}`);
    }
    assert.ok(mark.some((m) => m.text === "backpack" && m.marked.length === 2),
      "backpack carries two ck tiles and both must be marked");

    assert.deepEqual(errs, [], `page errors: ${errs.join(" | ")}`);
  } finally {
    await ctx.close();
  }
});

test("Word Cards: bossy r is its own lesson, and not a substring match", async () => {
  // The letter-teams pass measured bossy r as the single biggest win left for
  // two-syllable words — er alone carries 42 substring hits, ar 27, or 16, ir
  // 13, ur 8 — and deliberately scoped it OUT, because "substring matching is
  // about half wrong". That is the whole difficulty and it is a content
  // problem, not a code one: bear, hare and pear carry "ar" and say /air/;
  // earth says /er/; heart says /ar/ but is SPELLED ear; parrot and carrot are
  // a short a; lizard and wizard end in /erd/; worm says "werm"; and doctor,
  // tractor and anchor end in the /er/ sound while being spelled -or.
  //
  // So the deck is derived from the SPLITTER, exactly like every other team,
  // and the judgement lives in the splitter's own exception lists. The clauses
  // that matter here are the ones that drive those exclusions, because a
  // substring implementation passes everything else in this test.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });

    const r = await pg.evaluate(() => {
      const grab = (id) => [...document.querySelectorAll("#" + id + " .chip")].map((b) => ({
        pg: b.querySelector(".ic").textContent,
        nm: b.querySelector(".nm").textContent,
        ct: b.querySelector(".ct").textContent,
        say: b.getAttribute("aria-label"),
      }));
      const eligible = SOUND_RULES.map((x) => x[0]).filter((p) => teamWords(p).length >= TEAM_MIN);
      const decks = {};
      for (const p of eligible) decks[p] = teamWords(p).map((w) => w[0]);
      return {
        bossy: grab("bossyGrid"), team: grab("teamGrid"), eligible, decks, like: TEAM_LIKE,
        // The predicate itself, read back so it can be held to the DEFINITION
        // rather than to today's five answers.
        isPattern: typeof BOSSY === "object" && BOSSY instanceof RegExp,
        vowelR: ["ar", "er", "ir", "or", "ur"].filter((x) => BOSSY.test(x)),
        teamR: ["air", "oar", "ear"].filter((x) => BOSSY.test(x)),
        notR: ["sh", "ow", "ee", "oo"].filter((x) => BOSSY.test(x)),
        splits: { chair: sounds("chair").join("-"), skateboard: sounds("skateboard").join("-"),
                  squirrel: sounds("squirrel").join("-"), bear: sounds("bear").join("-"),
                  four: sounds("four").join("-"), door: sounds("door").join("-"),
                  watch: sounds("watch").join("-") },
      };
    });

    // 1. THE PARTITION IS DERIVED, AND IT IS THE PHONICS DEFINITION. A vowel
    //    with an r after it stops saying its own name; air/oar/ear are vowel
    //    TEAMS with an r and are a different lesson, which is why the pattern
    //    is a single vowel rather than one-or-more.
    assert.ok(r.isPattern, "the Bossy R partition is no longer a pattern");
    assert.deepEqual(r.vowelR, ["ar", "er", "ir", "or", "ur"],
      "a single vowel followed by r must be bossy r — that is the definition");
    assert.deepEqual(r.teamR, [], `${r.teamR.join(", ")} is a vowel TEAM with an r, not bossy r`);
    assert.deepEqual(r.notR, [], `${r.notR.join(", ")} has no r in it at all`);

    // 2. THE TWO GRIDS SPLIT THE SAME POPULATION AND LOSE NOTHING. This is a
    //    wiring check and it FLATTENS — both sides read BOSSY — so it proves
    //    the grids FOLLOW the pattern and nothing about which teams are in it.
    //    Clause 1 is what cannot flatten; the structural half (no hand-written
    //    list of the five) lives in site.test.js.
    const bossyPgs = r.bossy.map((c) => c.pg), teamPgs = r.team.map((c) => c.pg);
    assert.deepEqual([...teamPgs, ...bossyPgs].sort(), [...r.eligible].sort(),
      "a team that clears the bar landed in neither grid, or in both");
    assert.deepEqual(bossyPgs, r.eligible.filter((p) => /^[aeiou]r$/.test(p)),
      "the Bossy R grid is not the vowel+r teams that clear the bar");
    assert.equal(bossyPgs.length, 5, `Bossy R shows ${bossyPgs.length} chips, not the five`);
    assert.ok(teamPgs.every((p) => !/^[aeiou]r$/.test(p)),
      "a bossy r team is still sitting in the Letter teams grid");

    // 3. THE EXCLUSIONS — the whole reason this took a content pass. Every word
    //    below carries its team's letters and does NOT say that team, and a
    //    substring implementation puts every one of them in the deck.
    const OUT = {
      ar: ["bear", "pear", "hare", "heart", "earth", "beard", "scared",
           "parrot", "carrot", "parachute", "lizard", "wizard", "kangaroo"],
      er: ["berry", "cherry", "ferry", "strawberry", "zero", "deer"],
      ir: ["fire", "firefighter", "giraffe", "siren", "mirror", "chair", "fairy"],
      or: ["worm", "doctor", "tractor", "anchor", "scissors", "mirror", "motorbike", "door"],
      ur: ["four", "dinosaur", "burrito"],
    };
    for (const p of Object.keys(OUT))
      for (const w of OUT[p])
        assert.ok(!r.decks[p].includes(w),
          `"${w}" is in the ${p} deck — its letters do not say that team, so the deck teaches a lie`);

    // 4. AND THE POSITIVES ARE REALLY THERE, or clause 3 is satisfied by an
    //    empty deck. These are the words the lesson is built on.
    const IN = {
      ar: ["car", "star", "shark", "farmer", "guitar"],
      er: ["tiger", "water", "butter", "mermaid", "helicopter"],
      ir: ["bird", "girl", "shirt", "squirrel", "third"],
      or: ["corn", "fork", "storm", "horse", "unicorn"],
      ur: ["turtle", "purple", "surf", "burger"],
    };
    for (const p of Object.keys(IN))
      for (const w of IN[p])
        assert.ok(r.decks[p].includes(w), `"${w}" is missing from the ${p} deck`);

    // 5. THE SPLITTER'S PRECEDENCE, driven rather than read. air has to beat ai
    //    and oar has to beat oa, or chair and skateboard split through the
    //    middle of the sound. squirrel is the one that shows the split is
    //    syllable-honest: squir|rel, so ir takes the first r and the second
    //    starts the next syllable rather than the pair collapsing to "rr".
    assert.equal(r.splits.chair, "ch-air", "chair must split ch-air — air out-ranks ai");
    assert.equal(r.splits.skateboard, "s-k-a-t-e-b-oar-d",
      "skateboard must split with an oar tile — oar out-ranks oa");
    assert.equal(r.splits.squirrel, "s-qu-ir-r-e-l", "squirrel splits squir|rel");
    assert.equal(r.splits.bear, "b-e-a-r", "bear must not take an ar tile — it says /air/");
    assert.equal(r.splits.four, "f-o-u-r", "four must not take a ur tile — it says /or/");
    assert.equal(r.splits.door, "d-o-o-r", "door must not take an or tile — its /or/ is spelled oor");
    //    tch is in this clause because its guarantee is PRESENCE and not order:
    //    ch cannot match a string starting "tch", so the two can never compete,
    //    and the "tch before ch" pin that used to stand in site.test.js could
    //    not fail. This one can — delete the rule and watch splits w-a-t-ch.
    assert.equal(r.splits.watch, "w-a-tch", "watch must take a tch tile, or the tch rule is gone");

    // 6. EACH DECK OPENS ON THE NAME EVERYBODY USES FOR IT, and that name is a
    //    real member of the deck it names. ar/er/ir/or/ur are traditionally
    //    taught as car / her / bird / corn / hurt, and three of those five have
    //    no picture at Emoji <= 13.0 — so the exemplars are the picture words
    //    closest to them, which is a judgement and therefore declared.
    for (const p of bossyPgs) {
      assert.ok(r.like[p], `the ${p} deck has no declared exemplar`);
      assert.ok(r.decks[p].includes(r.like[p]),
        `the ${p} deck is taught as "${r.like[p]}", which is not one of its own cards`);
      assert.equal(r.decks[p][0], r.like[p],
        `the ${p} deck opens on ${r.decks[p][0]}, not on its own exemplar ${r.like[p]}`);
    }
    assert.equal(r.like.ar, "car", "ar is taught as car");
    assert.equal(r.like.ir, "bird", "ir is taught as bird");

    // 7. THE CHIP SAYS ITS TEAM AND COUNTS ITS OWN CARDS. Falsifiable only
    //    because the five decks differ in size: a typed count is caught on
    //    whichever chip is not that number.
    for (const c of r.bossy) {
      assert.equal(c.ct, r.decks[c.pg].length + " cards",
        `the ${c.pg} chip prints ${c.ct} for a deck of ${r.decks[c.pg].length}`);
      assert.equal(c.say, c.pg + ", " + c.nm + ", " + c.ct,
        `the ${c.pg} chip announces ${JSON.stringify(c.say)}`);
    }
    assert.ok(new Set(r.bossy.map((c) => c.ct)).size >= 4,
      "the bossy decks are all the same size, so a typed count could not be caught");

    assert.deepEqual(errs, [], `page errors: ${errs.join(" | ")}`);
  } finally {
    await ctx.close();
  }
});



test("Word Cards: the families deck underlines the ending it is teaching", async () => {
  // The families deck's whole lesson is the MARK. Seeing -at in cat, bat, rat
  // and hat IS the pattern, which is why that deck is grouped rather than
  // shuffled, and the render's own comment says so. Its sibling — the letter
  // team's mark — is driven and mutation-proven in the test above; this one was
  // named by no test at all, so the underline could have stopped painting with
  // the suite green and Word Families would have quietly become a plain list of
  // words. Measured before writing: 74 cards, 28 rimes, exactly one correct
  // mark on every one. So this is COVERAGE, not a fix.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });

    // Walks a whole reading deck card by card, reporting what the word says,
    // what is underlined on it, and which family the DATA declares it in.
    const walk = (name) => pg.evaluate((want) => {
      const chip = [...document.querySelectorAll("#readGrid .chip")]
        .find((b) => b.querySelector(".nm").textContent.indexOf(want) >= 0);
      if (!chip) return { err: `no "${want}" chip on the reading row` };
      chip.click();
      const declared = {};
      for (const [rime, list] of FAMILIES) for (const w of list) declared[w] = rime;
      const wordEl = document.getElementById("word");
      const out = [];
      for (let n = 0; n < deck.length; n++) {
        const marks = [...wordEl.querySelectorAll(".rime")];
        const text = wordEl.textContent;
        out.push({
          text,
          marks: marks.map((s) => s.textContent),
          declared: declared[text] || null,
        });
        document.getElementById("next").click();
      }
      return { out, members: Object.keys(declared).length, taught: FAMILIES.map((f) => f[0]) };
    }, name);

    const fam = await walk("Families");
    assert.ok(!fam.err, fam.err);

    // 1. NON-VACUITY. A walk that visited nothing, or a deck that lost most of
    //    its rimes, must not read as a pass.
    assert.ok(fam.out.length >= 50, `only ${fam.out.length} family cards walked`);
    assert.equal(fam.out.length, fam.members,
      `the deck deals ${fam.out.length} cards for ${fam.members} declared family words`);
    const rimes = new Set(fam.out.map((c) => c.declared));
    assert.ok(rimes.size >= 20, `only ${rimes.size} distinct rimes across the deck`);

    for (const c of fam.out) {
      assert.ok(c.declared, `"${c.text}" is in the families deck but in no family`);
      // 2. EVERY card carries exactly one mark — the failure mode is silence.
      assert.equal(c.marks.length, 1,
        `"${c.text}" shows ${c.marks.length} underlined endings, not 1`);
      // 3. And it is the family the word is DECLARED in, which is what
      //    separates a membership lookup from a suffix match: FAMILIES lists
      //    -at before -oat and -ar before -ear, so a suffix-first rimeOf marks
      //    goat as -at and bear as -ar. (The expectation is read from FAMILIES,
      //    as rimeOf is — that half cannot fail. What it pins is the RENDER,
      //    and those two words are what make it falsifiable.)
      assert.equal(c.marks[0], c.declared,
        `"${c.text}" underlines -${c.marks[0]}, but it is taught in -${c.declared}`);
    }
    // (A fourth clause — that the mark is the word's last node — was written
    // and DELETED: on this data it cannot fail on its own. The card's text is
    // checked, the mark's text is checked, and a site.test.js clause already
    // proves every family word ends with its rime, so any mutation that moves
    // the mark trips one of the three above first. Every mutation tried fired
    // an earlier clause, which is the definition of decoration here.)

    // 4. GROUPED, not shuffled. The other half of the same lesson: cat-bat-rat
    //    -hat sitting together is what makes the underline mean anything, and
    //    start() branches on exactly that. Each family must be ONE unbroken run.
    const runs = {};
    let prev = null, order = [];
    for (const c of fam.out) {
      if (c.declared !== prev) { order.push(c.declared); prev = c.declared; }
      runs[c.declared] = (runs[c.declared] || 0) + 1;
    }
    const split = [...new Set(order.filter((r, n) => order.indexOf(r) !== n))];
    assert.deepEqual(split, [],
      `the families deck is not grouped: -${split.slice(0, 5).join(", -")}` +
      `${split.length > 5 ? ` and ${split.length - 5} more` : ""} dealt in more than one run`);
    // ("one run per family" is implied by the clause above — order cannot repeat
    //  and hold a duplicate — so instead pin the SEQUENCE, which grouping alone
    //  does not: the families are taught short-a first and a reversed deal
    //  passes every clause above it.)
    assert.deepEqual(order, fam.taught,
      "the families are not dealt in the order they are taught");
    for (const w of ["goat", "bear"])
      assert.ok(fam.out.some((c) => c.text === w),
        `${w} is what makes clause 3 falsifiable and it is no longer in the deck`);

    // 5. CONTROL. First Words is full of the same three-letter words, and must
    //    show no underline at all — otherwise "mark the last two letters of
    //    everything" would satisfy every clause above.
    const first = await walk("First Words");
    assert.ok(!first.err, first.err);
    const shared = first.out.filter((c) => c.declared).length;
    assert.ok(shared >= 3,
      `only ${shared} First Words cards are family members, so this control proves nothing`);
    const stray = first.out.filter((c) => c.marks.length);
    assert.deepEqual(stray.map((c) => c.text), [],
      "First Words is not a families deck and must underline nothing");

    assert.deepEqual(errs, [], `page errors: ${errs.join(" | ")}`);
  } finally {
    await ctx.close();
  }
});

test("Word Cards: the Chinese deck teaches a CHARACTER, and says so in Chinese", async () => {
  // The owner asked for the 120 characters of the 第2級總字表 as their own
  // button, working "just like the English game": flip it, hear it, see a
  // picture and a sentence. Everything below is that promise, driven.
  //
  // The card's shape is genuinely different from every other deck here, which
  // is why it needs its own test: the front is ONE character rather than a
  // word, and the back answers three questions (how do I say it, what does it
  // mean, what does it look like in use) where every other back is one picture
  // or one sentence.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
    const SC = /PingFang|Hiragino Sans GB|Heiti|Source Han Sans SC|Noto Sans CJK SC|Microsoft YaHei/;

    const r = await pg.evaluate(() => {
      const btn = document.getElementById("hanziBtn");
      const label = btn.getAttribute("aria-label") || btn.textContent;
      const count = btn.querySelector("small").textContent;
      btn.click();
      const cd = document.getElementById("card"), wd = document.getElementById("word"),
            pic = document.getElementById("pic"), L = document.getElementById("letters");
      const fam = (el) => getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim();
      const read = () => {
        const c = deck[i];
        const front = cd.getAttribute("aria-label");
        cd.click();                                   // flip
        const back = cd.getAttribute("aria-label");
        const out = {
          card: c, front, back,
          ch: wd.textContent, chLang: wd.getAttribute("lang"), chFam: fam(wd),
          chPx: parseFloat(getComputedStyle(wd).fontSize),
          pic: pic.textContent, picCls: pic.className,
          frontHidden: document.getElementById("frontFace").getAttribute("aria-hidden"),
          backHidden: document.getElementById("backFace").getAttribute("aria-hidden"),
          teamTiles: L.querySelectorAll("span.team").length,
          kids: [...L.children].map((el) => ({
            cls: el.className, text: el.textContent,
            lang: el.getAttribute("lang"), fam: fam(el),
          })),
        };
        cd.click();                                   // and back to the front
        return out;
      };
      const first = read();
      i = 7; unflipInstantly(); render(false);
      const later = read();
      return { label, count, n: deck.length, first, later,
               kind: (function(){ try { return atKey(); } catch (e) { return null; } })() };
    });
    assert.deepEqual(errs, [], `page errors: ${errs.join(" | ")}`);

    // (1) The button. Its printed count and the deck it actually opens are two
    //     independent quantities, so a typed label cannot satisfy this.
    assert.equal(r.n, 120, `the Chinese deck holds ${r.n} cards, not the 120 of the printed table`);
    assert.equal(r.count, r.n + " cards",
      `the button says "${r.count}" and opens ${r.n} cards`);
    assert.match(r.label, /Chinese/i, "the button never says what it opens");
    assert.equal(r.kind, "wc-at-hanzi",
      "the Chinese deck shares its saved place with another deck, so finishing one moves the other");

    for (const [when, c] of [["first card", r.first], ["card 8", r.later]]) {
      const [ch, picture, , py, gloss, sentence, translation] = c.card;

      // (2) The FRONT is the character, in a Simplified Chinese face and marked
      //     as Chinese — this page's own family opens with a JAPANESE font, so
      //     inheriting it would have drawn Japanese forms and dropped the
      //     simplified-only characters entirely.
      assert.equal(c.ch, ch, `${when}: the front shows "${c.ch}" and the card is ${ch}`);
      assert.equal(c.chLang, "zh-CN", `${when}: the character is not marked as Chinese`);
      assert.match(c.chFam, SC, `${when}: the character renders in "${c.chFam}", not a Simplified Chinese face`);
      assert.ok(c.chPx >= 90, `${when}: the character is only ${c.chPx}px — a han glyph carries far more stroke detail than a word`);

      // (3) The BACK: the picture, then how to SAY it, what it MEANS, and the
      //     sentence with its translation.
      assert.equal(c.pic, picture, `${when}: the back shows the wrong picture`);
      assert.match(c.picCls, /\bhz\b/, `${when}: the picture is not sized for a card that also carries three lines of text`);
      assert.deepEqual(c.kids.map((k) => k.cls), ["hz__key", "hz__zh", "hz__en"],
        `${when}: the back is not [how to say it, the sentence, the translation]`);
      assert.equal(c.kids[0].text, py + " · " + gloss, `${when}: the reading and the meaning are wrong`);
      assert.equal(c.kids[1].text, sentence, `${when}: the sentence is wrong`);
      assert.equal(c.kids[2].text, translation, `${when}: the translation is wrong`);
      assert.equal(c.kids[1].lang, "zh-CN", `${when}: the sentence is not marked as Chinese`);
      assert.match(c.kids[1].fam, SC, `${when}: the sentence renders in "${c.kids[1].fam}", not a Simplified Chinese face`);
      assert.equal(c.kids[0].lang, null, `${when}: the pinyin line is marked Chinese, so it would be read as han`);

      // (4) sounds() splits ENGLISH letters. Run on a character it returns one
      //     tile of noise, and a strip of noise under the answer is worse than
      //     no strip, so a hanzi card has none.
      assert.equal(c.teamTiles, 0, `${when}: a sound-out tile appeared on a Chinese card`);

      // (5) The card's own name. The front must not give the answer away — the
      //     character IS the question — so it names the CARD and nothing else;
      //     the back carries the reading, the meaning and the translation,
      //     because that IS the answer.
      assert.ok(!c.front.includes(sentence) && !c.front.includes(translation),
        `${when}: the front of the card announces the answer: "${c.front}"`);
      for (const part of [py, gloss, translation])
        assert.ok(c.back.includes(part), `${when}: the back never says "${part}": "${c.back}"`);
      // …and the face that is turned away stays off the tree, or both are read.
      assert.equal(c.frontHidden, "true", `${when}: the front is still readable once flipped`);
      assert.equal(c.backHidden, "false", `${when}: the back is hidden while it is showing`);
    }
    // The two cards must genuinely differ, or every clause above could be
    // satisfied by one hard-coded card.
    assert.notEqual(r.first.card[0], r.later.card[0], "fixture: both reads landed on the same card");
    assert.equal(r.first.front.replace(/\d+/g, "#"), r.later.front.replace(/\d+/g, "#"),
      "the front label differs between cards, so something about the answer is leaking into it");
  } finally {
    await ctx.close();
  }
});

test("Word Cards: a Chinese card is SPOKEN in Chinese, character and sentence", async () => {
  // A character is one syllable and its tone is most of what makes it a word,
  // so the card says the SENTENCE too — which is also the only thing on the
  // card a grown-up who reads no Chinese can use. And the language has to
  // travel with the text: left on the page's en-US voice, 我有五个手指 is read
  // as letter noise, which sounds exactly like a broken feature.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
    // speechSynthesis is a READ-ONLY accessor, so a plain assignment silently
    // no-ops and the real (silent, headless) engine answers — which reads as a
    // feature that never fired rather than a stub that never installed. Same
    // trap as localStorage in the private-mode test, so the stub verifies
    // itself before anything is measured.
    const ok = await pg.evaluate(() => {
      window.__said = [];
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: {
          __stub: true, cancel() {}, getVoices() { return []; },
          speak(u) { window.__said.push({ text: u.text, lang: u.lang }); },
        },
      });
      return !!window.speechSynthesis.__stub;
    });
    assert.ok(ok, "fixture: the speech stub never installed, so nothing below measures anything");

    // The sound toggle lives on the DECK screen, not the menu, so a deck has to
    // be open before it can be turned on — and it is remembered from there.
    await pg.click("#hanziBtn");
    await pg.waitForSelector(".card");
    await pg.click("#sound");                            // RULE 5: off by default
    const say = async (open) => pg.evaluate((sel) => {
      window.__said.length = 0;
      if (sel) document.querySelector(sel).click();
      document.getElementById("card").click();          // flip -> speak
      const c = deck[i];
      return { said: window.__said.slice(), card: c };
    }, open);

    const zh = await say(null);
    assert.equal(zh.said.length, 1, `a flip must speak exactly once (spoke ${zh.said.length} times)`);
    assert.equal(zh.said[0].lang, "zh-CN",
      `a Chinese card is spoken as "${zh.said[0].lang}", so an English voice reads the characters as letters`);
    assert.ok(zh.said[0].text.includes(zh.card[0]),
      `the spoken line "${zh.said[0].text}" does not contain the character ${zh.card[0]}`);
    assert.ok(zh.said[0].text.includes(zh.card[5]),
      `the spoken line "${zh.said[0].text}" does not contain the card's sentence, which is the only place its tone lives in a word`);

    // THE CONTROL, and the clause that makes the one above mean anything: a
    // page that always said zh-CN would pass every assertion so far.
    await pg.click("#back");
    await pg.waitForSelector("#grid .chip");
    const en = await say("#allBtn");
    assert.equal(en.said[0].lang, "en-US", `an English card is now spoken as "${en.said[0].lang}"`);
    assert.equal(en.said[0].text, en.card[0],
      `an English card speaks "${en.said[0].text}" rather than just its word`);
    assert.deepEqual(errs, [], `page errors: ${errs.join(" | ")}`);
  } finally {
    await ctx.close();
  }
});

test("Word Cards: the writing pad teaches stroke ORDER, and cannot be got wrong", async () => {
  // Writing a Chinese character IS its stroke order — taught from the first day
  // of school, and a habit that has to be untaught if it is learned wrong. So
  // the three refusals below are the feature, not a detail of it: a pad that
  // accepted any stroke drawn anywhere would be finger-painting with extra
  // steps. And the fourth clause is the other half of RULE 5: it must be
  // impossible to get STUCK, so three tries and the pad writes it for him.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(String(e)));
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
    // The pad remembers where he got to, so a stale key from another test would
    // open it on a different character and every clause below would measure
    // something else.
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await pg.reload();
    await pg.click("#writeBtn");
    await pg.waitForSelector("#write:not(.hidden)");

    // Read everything off the real screen — the character from the pad's own
    // accessible name, the stroke being asked for from the hint it is drawing.
    const state = () => pg.evaluate(() => {
      const pad = document.getElementById("wpad");
      const lab = pad.getAttribute("aria-label") || "";
      return {
        ch: lab.split(",")[0],
        lab,
        inked: document.getElementById("wdone").children.length,
        ghost: document.getElementById("wghost").children.length,
        done: pad.classList.contains("done"),
      };
    });
    // The median of the stroke the pad is currently hinting, in SCREEN pixels.
    const hintPath = () => pg.evaluate(() => {
      const pl = document.querySelector("#whint polyline");
      if (!pl) return null;
      const m = document.getElementById("wglyph").getScreenCTM();
      return pl.getAttribute("points").split(" ").map((s) => {
        const [x, y] = s.split(",").map(Number);
        const p = new DOMPoint(x, y).matrixTransform(m);
        return [p.x, p.y];
      });
    });
    const drag = async (pts) => {
      await pg.mouse.move(pts[0][0], pts[0][1]);
      await pg.mouse.down();
      for (const [x, y] of pts.slice(1)) await pg.mouse.move(x, y, { steps: 4 });
      await pg.mouse.up();
      await pg.waitForTimeout(40);
    };

    // 一 is one stroke, so the ladder has to be past it before there is a
    // SECOND stroke to trace out of turn. 二 is the first character that can
    // separate "it accepted a stroke" from "it accepted the RIGHT stroke".
    await pg.click("#wnext");
    const start = await state();
    assert.equal(start.ch, "二", `fixture: the ladder's second card should be 二, got ${start.ch}`);
    assert.equal(start.inked, 0, "a fresh character starts with nothing written");

    // 1. WRONG ORDER, the easy case. 二 is two horizontal strokes and the top
    //    one is written first; tracing the bottom one neatly must still be
    //    refused, or stroke order is decoration. NOTE which half of the judge
    //    carries this: 二's strokes are 439 units apart against a tolerance of
    //    210, so the ABSOLUTE gate alone refuses it and the "is this really the
    //    stroke I asked for" comparison is never reached. That comparison has
    //    its own clause below, on a character where it is the only thing
    //    standing between him and the wrong stroke — measured, it is what
    //    refuses 82 stroke pairs across 28 characters, and a first draft that
    //    tested only 二 passed with the comparison deleted.
    const second = await pg.evaluate(() => {
      const d = window.HANZI_STROKES["二"];
      const m = document.getElementById("wglyph").getScreenCTM();
      return d.m[1].map(([x, y]) => {
        const p = new DOMPoint(x, y).matrixTransform(m);
        return [p.x, p.y];
      });
    });
    await drag(second);
    assert.equal((await state()).inked, 0,
      "tracing stroke 2 while stroke 1 is being asked for must be refused — that refusal IS the lesson");

    // 2. BACKWARDS. Direction is the other half of stroke order: a Chinese
    //    horizontal is written left to right, and right-to-left is a different
    //    (wrong) stroke however neatly it lands on the same ink.
    const first = await hintPath();
    assert.ok(first && first.length >= 2, "the pad must hint the stroke it wants");
    await drag(first.slice().reverse());
    assert.equal((await state()).inked, 0, "a stroke drawn backwards must be refused");

    // 3. …and the right stroke, the right way, is accepted.
    await drag(first);
    const afterOne = await state();
    assert.equal(afterOne.inked, 1, "tracing the hinted stroke correctly must ink it");
    assert.match(afterOne.lab, /stroke 2 of 2/, "and the pad must move on to the next stroke");

    // 4. NO-FAIL (RULE 5). Three scribbles nowhere near it, and the pad simply
    //    writes the stroke for him. There is no score and no way to be stuck.
    const box = await pg.$eval("#wpad", (el) => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width * 0.12, r.top + r.height * 0.12, r.width * 0.2];
    });
    for (let k = 0; k < 3; k++) {
      await drag([[box[0], box[1]], [box[0] + box[2], box[1] + box[2] * 0.4], [box[0] + box[2] * 0.4, box[1] + box[2]]]);
    }
    await pg.waitForTimeout(600);
    const end = await state();
    assert.equal(end.inked, 2, "after three tries the pad writes the stroke for him — nothing here may get stuck");
    assert.ok(end.done, "and the character is finished");

    // 5. The finished character has to LOOK finished, and this is the one
    //    clause a behaviour test would have missed: the cue first greened the
    //    GHOST, which on a finished character is covered pixel-for-pixel by the
    //    ink drawn over it — so 一 finished looked exactly like 一 unfinished.
    //    Only a screenshot found it. It greens the INK now, and the second
    //    clause is what says WHY the ghost was the wrong element.
    const fin = await pg.evaluate(() => getComputedStyle(document.getElementById("wdone")).fill);
    const idle = await pg.evaluate(() => {
      const pad = document.getElementById("wpad");
      pad.classList.remove("done");
      const f = getComputedStyle(document.getElementById("wdone")).fill;
      pad.classList.add("done");
      return f;
    });
    assert.notEqual(fin, idle,
      `a finished character must not be painted the same as an unfinished one (both ${fin}) — the cue has to land on something the player can see`);
    const cover = await state();
    assert.equal(cover.inked, cover.ghost,
      "the finished ink covers every ghost stroke exactly, which is why greening the GHOST could never show");

    // 6. WRONG ORDER, the case only the COMPARISON can refuse. 鸟's third
    //    stroke sits inside its second — every point of it is within 77 units
    //    of the second, against a 210 tolerance — so re-drawing the stroke he
    //    has just finished scores 112 and the absolute gate waves it through.
    //    Only "is this a better match for some OTHER stroke?" catches it.
    const near = await pg.evaluate(() => {
      const el = document.getElementById("wnext");
      for (let k = 0; k < 200; k++) {
        if (document.getElementById("wpad").getAttribute("aria-label").split(",")[0] === "鸟") break;
        el.click();
      }
      const d = window.HANZI_STROKES["鸟"];
      // Self-verifying precondition: the wrong stroke has to be near enough
      // that the absolute gate would accept it, or this clause is vacuous and
      // would silently stop separating the two states.
      let worst = 0;
      for (const p of d.m[1]) {
        let best = Infinity;
        for (const q of d.m[2]) { const dx = p[0] - q[0], dy = p[1] - q[1]; best = Math.min(best, dx * dx + dy * dy); }
        worst = Math.max(worst, Math.sqrt(best));
      }
      return { ch: document.getElementById("wpad").getAttribute("aria-label").split(",")[0], strokes: d.s.length, worst: Math.round(worst) };
    });
    assert.equal(near.ch, "鸟", `fixture: could not reach 鸟 in the ladder (stopped on ${near.ch})`);
    assert.ok(near.worst <= 260,
      `fixture: 鸟's strokes 2 and 3 are ${near.worst} units apart — too far for the absolute gate to accept the wrong one, so this clause no longer separates the two states`);

    // write the first two strokes with ✍, then offer stroke 2 again
    await pg.click("#wshow");
    await pg.waitForTimeout(520);
    await pg.click("#wshow");
    await pg.waitForTimeout(520);
    const atThree = await state();
    assert.match(atThree.lab, /stroke 3 of 5/, `fixture: expected to be on 鸟's third stroke, saw "${atThree.lab}"`);
    const redo = await pg.evaluate(() => {
      const m = document.getElementById("wglyph").getScreenCTM();
      return window.HANZI_STROKES["鸟"].m[1].map(([x, y]) => {
        const p = new DOMPoint(x, y).matrixTransform(m);
        return [p.x, p.y];
      });
    });
    await drag(redo);
    assert.equal((await state()).inked, 2,
      "re-drawing the stroke he has just finished must be refused even though it lands inside the tolerance — that is the whole job of the better-match comparison");

    assert.deepEqual(errs, [], "the writing pad must raise no page errors");
  } finally {
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} }).catch(() => {});
    await ctx.close();
  }
});

test("Word Cards: the writing ladder climbs from one stroke to fifteen", async () => {
  // A four-year-old meeting the deck in its printed table order would hit 蝴
  // (15 strokes) on card ten. The ladder is derived from the stroke data, so
  // this walks what the pad actually deals rather than what a list says — and
  // the layout audit rides along, because the pad is a new screen and RULE 5's
  // floors apply to it like any other.
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: "reduce" });
  const pg = await ctx.newPage();
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await pg.reload();
    // The two Chinese buttons are a PAIR — read them, write them — so they must
    // read as one. The first label was "Write the Characters", which wraps to a
    // third line at 320 and 390 while its sibling takes two, and only the
    // screenshot showed it: every box measurement passed. Asserting the EQUALITY
    // rather than a pixel bound is what keeps this honest if the type changes.
    const pair = await pg.evaluate(() => [
      Math.round(document.getElementById("hanziBtn").getBoundingClientRect().height),
      Math.round(document.getElementById("writeBtn").getBoundingClientRect().height),
    ]);
    assert.equal(pair[1], pair[0],
      `the writing button is ${pair[1]}px against the reading button's ${pair[0]}px — a label that wraps one line further makes the pair read as two unrelated things`);

    // …and the writing button must NOT wear `.all`. That class means "opens a
    // whole-library card DECK" to two derived walks — the deal-order test and
    // the mobile clipping walk both take their population from `#menu .all` —
    // so a full-width button that opens something else gets clicked by both,
    // leaves two .wrap screens visible at once, and body's flex halves the
    // width. It shipped that way for one gate: the failures read "3 deck
    // buttons but 2 walked" and "the deck's back button is 36px", which are
    // both true and neither of which names the cause. This clause does.
    const meaning = await pg.evaluate(() => {
      const out = [];
      for (const b of document.querySelectorAll("#menu .all")) {
        b.click();
        out.push({ id: b.id, opensDeck: !document.getElementById("deck").classList.contains("hidden") });
        document.getElementById("back").click();
      }
      return out;
    });
    assert.ok(meaning.length >= 2, `only ${meaning.length} .all buttons — this clause would be vacuous`);
    const notDecks = meaning.filter((m) => !m.opensDeck).map((m) => m.id);
    assert.deepEqual(notDecks, [],
      `#${notDecks.join(", #")} wears .all but does not open the card deck — .all is the population two derived walks use, so give a non-deck button .mode instead`);

    await pg.click("#writeBtn");
    await pg.waitForSelector("#write:not(.hidden)");

    const walk = await pg.evaluate(() => {
      const out = [];
      const total = Object.keys(window.HANZI_STROKES).length;
      for (let k = 0; k < total; k++) {
        const ch = document.getElementById("wpad").getAttribute("aria-label").split(",")[0];
        out.push([ch, window.HANZI_STROKES[ch].s.length]);
        document.getElementById("wnext").click();
      }
      return out;
    });
    assert.ok(walk.length >= 100, `only ${walk.length} cards dealt — this walk would be vacuous`);
    assert.equal(new Set(walk.map((w) => w[0])).size, walk.length,
      "every character appears exactly once in the writing deck");
    const back = walk.findIndex((w, k) => k && w[1] < walk[k - 1][1]);
    assert.equal(back, -1, back < 0 ? "" :
      `the ladder goes backwards at card ${back + 1}: ${walk[back - 1][0]} has ${walk[back - 1][1]} strokes and ${walk[back][0]} has ${walk[back][1]}`);
    assert.equal(walk[0][1], 1, `the ladder must open on the one-stroke character, got ${walk[0][0]}`);
    assert.ok(walk[walk.length - 1][1] >= 12,
      `the ladder must END on the hard ones, got ${walk[walk.length - 1][0]} at ${walk[walk.length - 1][1]} strokes`);

    // RULE 5 on the narrowest phone: nothing under the 75px kid floor, and the
    // page must not scroll sideways.
    const lay = await pg.evaluate(() => ({
      small: [...document.querySelectorAll("#write button")]
        .map((b) => { const r = b.getBoundingClientRect(); return [b.id, Math.round(r.width), Math.round(r.height)]; })
        .filter((t) => t[1] < 75 || t[2] < 75),
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    assert.deepEqual(lay.small, [], `every control on the writing pad must clear 75px: ${JSON.stringify(lay.small)}`);
    assert.equal(lay.sideways, 0, "the writing pad must not make the page scroll sideways at 320px");
  } finally {
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} }).catch(() => {});
    await ctx.close();
  }
});

test("Word Cards: the writing pad can SAY the character on demand", async () => {
  // Everything else on this screen speaks only when the character CHANGES or is
  // FINISHED, so mid-character there was no way to hear it again — and the only
  // repeat available was to navigate away, which throws the strokes away. The
  // flash deck has no such gap (flipping the card back and forth re-speaks it),
  // which is why this is scoped to the pad rather than to both.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await pg.reload();
    // speechSynthesis is a READ-ONLY accessor, so a plain assignment silently
    // no-ops and the real (silent, headless) engine answers — which reads as a
    // feature that never fired rather than a stub that never installed. The
    // stub verifies itself before anything below is measured.
    const ok = await pg.evaluate(() => {
      window.__said = [];
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: {
          __stub: true, cancel() {}, getVoices() { return []; },
          speak(u) { window.__said.push({ text: u.text, lang: u.lang }); },
        },
      });
      return !!window.speechSynthesis.__stub;
    });
    assert.ok(ok, "fixture: the speech stub never installed, so nothing below measures anything");

    await pg.click("#writeBtn");
    await pg.waitForSelector("#write:not(.hidden)");
    const muted = await pg.evaluate(() => document.getElementById("wsound").classList.contains("on"));
    assert.equal(muted, false,
      "fixture: sound must start OFF (RULE 5), or the while-muted clause below proves nothing");

    // 1. It speaks, WHILE MUTED. Sound off means "do not speak at me
    //    automatically" and a tap on the word is not automatic — it is the one
    //    unambiguous request for audio on the screen. So it turns sound on
    //    rather than refusing: a control that silently does nothing is
    //    indistinguishable from a broken one to a four-year-old, and this way
    //    the toggle in the bar always matches what the device is doing.
    const first = await pg.evaluate(() => {
      window.__said.length = 0;
      document.getElementById("wsaybtn").click();
      return {
        said: window.__said.slice(),
        on: document.getElementById("wsound").classList.contains("on"),
        want: (() => { const c = wDeck[wi]; return { text: c[0] + "。" + c[5], ch: c[0] }; })(),
      };
    });
    assert.equal(first.said.length, 1,
      `the say-it button must speak exactly once, spoke ${first.said.length} times`);
    assert.equal(first.on, true,
      "a say-it tap while muted must turn sound ON, or the toggle claims silence while the device speaks");

    // 2. It goes through the ONE owner (wSpeak -> cardSpeech), so the LANGUAGE
    //    travels with the text and it says exactly what the flash card says. A
    //    Chinese line left on the page's own en-US voice is read as letter
    //    noise, which sounds precisely like a broken feature.
    assert.equal(first.said[0].lang, "zh-CN",
      `the character must be spoken in zh-CN, got ${first.said[0].lang}`);
    assert.equal(first.said[0].text, first.want.text,
      "the say-it button must say what the flash card says — the character AND its sentence, because one syllable's tone is most of what makes it a word");

    // 3. It REPEATS mid-character without disturbing the round. This is the
    //    whole point: the repeat that existed was to navigate away and back,
    //    which resets every stroke he has written.
    await pg.click("#wshow");
    await pg.waitForFunction(() => document.querySelectorAll("#wdone path").length > 0, null, { timeout: 4000 });
    const mid = await pg.evaluate(() => {
      const state = () => ({
        inked: document.querySelectorAll("#wdone path").length,
        card: document.getElementById("wcount").textContent.trim(),
        ch: wDeck[wi][0],
      });
      const was = state();
      window.__said.length = 0;
      document.getElementById("wsaybtn").click();
      return { was, now: state(), said: window.__said.slice() };
    });
    assert.ok(mid.was.inked > 0, "fixture: a stroke must be written first, or this clause proves nothing");
    assert.equal(mid.said.length, 1, `a mid-character tap must speak again, spoke ${mid.said.length} times`);
    assert.deepEqual(mid.now, mid.was,
      `saying the word must not disturb the round — it went from ${JSON.stringify(mid.was)} to ${JSON.stringify(mid.now)}`);

    // 4. It names the character it will say. An explicit label REPLACES the
    //    content for assistive tech, and the picture beside it is aria-hidden,
    //    so the character has to be IN the label or it is announced by pinyin
    //    alone. Two different cards, because a hard-coded string passes on one.
    const labels = await pg.evaluate(() => {
      const out = [];
      for (let k = 0; k < 2; k++) {
        out.push({ label: document.getElementById("wsaybtn").getAttribute("aria-label"), ch: wDeck[wi][0] });
        document.getElementById("wnext").click();
      }
      return out;
    });
    // The two-card LOOP is what makes this falsifiable: a label hard-coded to
    // one character passes on that card and fails on the next. A separate
    // "the two labels must differ" clause was written and DELETED as dominated
    // — if each label names its own card's character and the characters differ,
    // the labels differ too, so it could never fail on its own.
    for (const l of labels)
      assert.ok(l.label && l.label.includes(l.ch),
        `the say-it button must name the character it will say — ${l.ch} is not in ${JSON.stringify(l.label)}`);

    assert.deepEqual(errs, [], "no uncaught page errors while saying a character");
  } finally {
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} }).catch(() => {});
    await ctx.close();
  }
});

test("Word Cards: the writing pad keeps its place, INCLUDING the last character", async () => {
  // `wc-write-at` was named by NO test in the whole suite while both of its
  // siblings were driven, and the gap hid a real defect. The three place
  // memories restore with TWO different bounds and BOTH are correct, which is
  // exactly why the third had to be read rather than copied:
  //
  //   flash deck   go() is CLAMPED  -> the last card is terminal (a dead Next
  //                                   button), so `< n - 1` is a deliberate
  //                                   wrap-to-the-start
  //   配对        mGo() is MODULAR -> every index is playable, so `< len`
  //   写字        wGo() is MODULAR -> every index is playable... and it
  //                                   shipped with the DECK's bound, so
  //                                   parking on the last character and coming
  //                                   back silently started him over at 一
  //
  // That is the defect the 配对 audit identified and refused to introduce
  // ("harmonising the board onto its siblings makes round 30 silently
  // unreachable"), live in the one sibling that audit never read. The LAST
  // clause is the one that pins the difference — the first two pass on either
  // bound, so a test that only drove the middle of the ladder would have
  // shipped proving nothing about the end of it.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await pg.reload({ waitUntil: "load" });

    // Put a place in the ENGLISH deck first, so the separate-key clause has
    // something it could actually collide with. A shared key looks exactly
    // like this feature working, right up until it loses one of the two.
    await pg.click("#allBtn");
    await pg.waitForSelector(".card");
    for (let k = 0; k < 2; k++) { await pg.waitForTimeout(400); await pg.click("#next"); } // a step at a time, not a burst
    await pg.click("#back");

    await pg.click("#writeBtn");
    await pg.waitForSelector("#write:not(.hidden)");
    const opened = await pg.evaluate(() => ({ at: wi, n: wDeck.length }));
    assert.equal(opened.n, 120, `fixture: the writing ladder is ${opened.n} characters, not the deck's 120`);
    assert.equal(opened.at, 0,
      `the pad opened at character ${opened.at + 1} of a ladder he has never seen — it is reading another screen's saved place`);

    // one character at a time, the way a child steps — five presses in a burst
    // are the hammer, and the page's echo guard rightly takes them as one
    for (let k = 0; k < 5; k++) { await pg.waitForTimeout(400); await pg.click("#wnext"); }
    const walked = await pg.evaluate(() => ({
      at: wi,
      saved: localStorage.getItem("wc-write-at"),
      deckKeys: Object.keys(localStorage).filter((k) => k.startsWith("wc-at-")).sort(),
    }));
    assert.equal(walked.at, 5, "fixture: the walk did not advance five characters");
    assert.equal(walked.saved, "5",
      `the pad must save where he stopped — wc-write-at reads ${JSON.stringify(walked.saved)}`);
    assert.deepEqual(walked.deckKeys, ["wc-at-all"],
      `writing must not move his place in a flash deck: ${walked.deckKeys.join(", ")}`);

    await pg.reload({ waitUntil: "load" });
    const back = await pg.evaluate(() => {
      document.getElementById("writeBtn").click();
      const at = wi;
      document.getElementById("wback").click();
      document.getElementById("allBtn").click();
      return { at, en: i };
    });
    assert.equal(back.at, 5, `the pad reopened at character ${back.at + 1}, not where he stopped`);
    assert.equal(back.en, 2, `working through 写字 moved his place in the English deck to ${back.en}`);

    // THE CLAUSE THAT PINS THE BOUND. wGo() is modular, so ◀ from the first
    // character is a real tap that parks him on the LAST one — and with the
    // flash deck's `< len - 1` that is the one character in 120 he can never
    // come back to.
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await pg.reload({ waitUntil: "load" });
    await pg.click("#writeBtn");
    await pg.waitForSelector("#write:not(.hidden)");
    const fresh = await pg.evaluate(() => wi);
    assert.equal(fresh, 0, `fixture: a cleared pad must open at the first character, not ${fresh}`);
    await pg.click("#wprev");
    const parked = await pg.evaluate(() => ({ at: wi, n: wDeck.length, saved: localStorage.getItem("wc-write-at") }));
    assert.equal(parked.at, parked.n - 1,
      `fixture: the ladder must wrap, so one tap back from the first character is the last one — landed on ${parked.at}`);
    assert.equal(parked.saved, String(parked.n - 1), "fixture: parking on the last character must have been saved");

    await pg.reload({ waitUntil: "load" });
    const reopened = await pg.evaluate(() => {
      document.getElementById("writeBtn").click();
      return { at: wi, n: wDeck.length };
    });
    assert.equal(reopened.at, reopened.n - 1,
      `every index in a MODULAR ladder is a playable index, so parking on the last character must reopen there — it reopened at ${reopened.at + 1} of ${reopened.n}`);

    assert.deepEqual(errs, [], "no uncaught page errors while keeping the pad's place");
  } finally {
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} }).catch(() => {});
    await ctx.close();
  }
});

test("Word Cards: the Chinese deck keeps its OWN place in the deck", async () => {
  // A seeded order is only worth having if you can carry on from it, and a
  // 120-card deck is six sittings at a four-year-old's pace. The place is keyed
  // on the deck, so working through the Chinese must not move where he is in
  // the English — driven, because the two decks sharing a key would look
  // exactly like this feature working right up until it lost his place.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const pg = await ctx.newPage();
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
    await pg.click("#allBtn");
    await pg.waitForSelector(".card");
    for (let k = 0; k < 2; k++) { await pg.waitForTimeout(400); await pg.click("#next"); } // a step at a time, not a burst
    await pg.click("#back");
    await pg.click("#hanziBtn");
    await pg.waitForSelector(".card");
    // FIRST, before advancing: a deck he has never opened starts at its first
    // card whatever he has done in another one. This clause comes first because
    // a shared key lands here — it opens at the OTHER deck's place — and would
    // otherwise trip the advance check below with a message about the fixture
    // rather than about the defect.
    const opened = await pg.evaluate(() => i);
    assert.equal(opened, 0,
      `the Chinese deck opened at card ${opened + 1} of a deck he has never seen — it is reading the English deck's saved place`);
    // one card at a time (a burst of five is the hammer — see the echo guard)
    for (let k = 0; k < 5; k++) { await pg.waitForTimeout(400); await pg.click("#next"); }
    const at = await pg.evaluate(() => ({ zh: i, keys: Object.keys(localStorage).filter((k) => k.startsWith("wc-at-")).sort() }));
    assert.equal(at.zh, 5, "fixture: the walk did not advance five cards");
    assert.deepEqual(at.keys, ["wc-at-all", "wc-at-hanzi"],
      `the two decks do not keep separate places: ${at.keys.join(", ")}`);

    await pg.reload({ waitUntil: "load" });
    const back = await pg.evaluate(() => {
      document.getElementById("hanziBtn").click();
      const zh = i;
      document.getElementById("back").click();
      document.getElementById("allBtn").click();
      return { zh, en: i };
    });
    assert.equal(back.zh, 5, `the Chinese deck reopened at card ${back.zh + 1}, not where he stopped`);
    assert.equal(back.en, 2, `working through the Chinese moved his place in the English deck to ${back.en}`);
  } finally {
    await ctx.close();
  }
});


test("Word Cards: the matching board deals all 120, and no round is ambiguous", async () => {
  // The board's whole correctness lives in how a round is CHOSEN. Four
  // characters and their four pictures is only a fair question if no two of
  // them could answer for each other — 蝴 and 蝶 both mean butterfly and
  // literally share 🦋, and 看 "look" beside 找 "look for" is the same defect
  // one step subtler. clash() already owned that question for the deck, so the
  // board reuses it, and this drives the SHIPPED builder rather than a copy.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const pg = await ctx.newPage();
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
    const r = await pg.evaluate(() => {
      const rounds = matchRounds();
      const seen = {};
      for (const c of rounds.flat()) seen[c[0]] = (seen[c[0]] || 0) + 1;
      const bad = [];
      rounds.forEach((rd, n) => {
        for (let a = 0; a < rd.length; a++) for (let b = a + 1; b < rd.length; b++)
          if (clash(rd[a], rd[b])) bad.push(`round ${n + 1}: ${rd[a][0]} + ${rd[b][0]}`);
      });
      return {
        rounds: rounds.length,
        sizes: [...new Set(rounds.map((rd) => rd.length))],
        dealt: rounds.flat().length,
        dupes: Object.keys(seen).filter((k) => seen[k] > 1),
        missing: HANZI.filter((c) => !seen[c[0]]).map((c) => c[0]),
        bad,
        stable: JSON.stringify(matchRounds()) === JSON.stringify(rounds),
        // the picture column is a DERANGEMENT of the character column
        lined: rounds.map((rd, n) => mPicOrder(rd, "pic" + n).filter((c, k) => c === rd[k]).length)
                     .reduce((a, b) => a + b, 0),
      };
    });

    assert.ok(r.rounds >= 25, `fixture: only ${r.rounds} rounds were dealt`);
    assert.deepEqual(r.sizes, [4], `every round is four pairs — saw sizes ${r.sizes.join(", ")}`);
    assert.deepEqual(r.dupes, [], `a character deals twice, so one round is unwinnable: ${r.dupes.join(" ")}`);
    assert.deepEqual(r.missing, [], `never dealt at all: ${r.missing.join(" ")}`);
    assert.equal(r.dealt, 120, `the board must walk all 120 characters, not ${r.dealt}`);
    assert.deepEqual(r.bad, [],
      `a round holds two cards that could answer for each other: ${r.bad.slice(0, 5).join(" | ")}`);
    assert.ok(r.stable, "the same seed must deal the same board, or he cannot carry on from it");
    // Position must never answer the question. A plain shuffle of four leaves a
    // pair on its own row about 37% of the time and lines the whole board up 1
    // time in 24, so the right column is a derangement and not merely shuffled.
    assert.equal(r.lined, 0, `${r.lined} pair(s) sit on the same row, so position gives the answer away`);

    // THE ANSWER MUST STAY OFF THE TREE. A picture tile is labelled with the
    // card's MEANING, because an emoji's announced name is a platform detail
    // while the meaning is what the deck already taught — and 14 of the 120
    // gloss themselves with the word they live in (阳 "sun (太阳)", 什 "what
    // (什么)", 蝶 "butterfly (蝴蝶)"), so the RAW meaning hands a screen-reader
    // user the very character the tile matches. Invisible to a sighted player
    // and invisible to every layout measure, which is exactly how this page's
    // own law gets lost on a new screen. Walked over all 120 rather than the
    // four on screen: a round is a sample, and 14 in 120 hides in one.
    //
    // Read off the RENDERED tile, walking every round. The first cut of this
    // called mMeaning() on the data instead, and pointing the tile back at the
    // raw c[4] left it GREEN: a clause that asks the helper cannot see the CALL
    // SITE change. What a screen reader would actually be handed is the claim.
    await pg.click("#matchBtn");
    await pg.waitForSelector("#match:not(.hidden)");
    const labels = await pg.evaluate(() => {
      const out = { leak: [], mute: [], seen: 0 };
      for (let n = 0; n < mRounds.length; n++) {
        for (const t of document.querySelectorAll("#mpics .mtile")) {
          const l = (t.getAttribute("aria-label") || "").trim();
          out.seen += 1;
          if (!l) out.mute.push(t.dataset.ch);
          else if (l.includes(t.dataset.ch)) out.leak.push(t.dataset.ch + " → " + l);
        }
        mGo(1);                                    // the shipped way on to the next board
      }
      return out;
    });
    assert.equal(labels.seen, 120,
      `fixture: the walk read ${labels.seen} picture tiles, not the whole deck`);
    assert.deepEqual(labels.leak, [],
      `a picture tile's label names the character it matches: ${labels.leak.slice(0, 6).join(", ")}`);
    // …and the strip must never leave a tile with nothing to announce. Three
    // meanings are ENTIRELY parenthetical (只, 了, 个), which is what the
    // fallback is for, so this is the clause that keeps the fix honest.
    assert.deepEqual(labels.mute, [],
      `these picture tiles would announce nothing: ${labels.mute.join(", ")}`);

    // Every screen that can speak carries a toggle, DERIVED — paintSound used
    // to hold a list of two and this screen would simply have been missed.
    const snd = await pg.evaluate(() => [...document.querySelectorAll(".wrap")]
      .map((w) => ({ id: w.id, has: !!w.querySelector(".icon.snd") })));
    const noToggle = snd.filter((w) => w.id !== "menu" && !w.has).map((w) => w.id);
    assert.deepEqual(noToggle, [], `these screens speak with no sound toggle: ${noToggle.join(", ")}`);
    assert.ok(snd.length >= 4, `fixture: only ${snd.length} screens found`);
  } finally {
    await ctx.close();
  }
});

test("Word Cards: no two states of a matching tile are told apart by COLOUR alone", async () => {
  // The board has three tile states — plain, held, matched — and it is the
  // first colour-coded state language on this page. Measured, the two that
  // matter most are the SAME LIGHTNESS: held #FFC93C is L=0.634 and done
  // #B7E4C7 is L=0.697, a contrast of 1.09:1, so a viewer who cannot separate
  // gold from green has NOTHING left on the fill. They survive only because
  // the held tile carries a 5px white ring and the matched tile has its drop
  // shadow removed — two structural cues that nothing anywhere declared to be
  // load-bearing, so a tidy-up could delete either and every shipped test
  // would stay green. This is the fort roster's own finding (hue was never
  // doing the separating work; shape was) landing on a UI state machine.
  //
  // The law is deliberately flat and carries NO luminance threshold: for every
  // PAIR of states the box-shadow must differ too. A bar would sit next to the
  // shipped 1.09 and be the invented threshold this project keeps refusing,
  // and the claim it would be approximating is simply "colour is never the
  // only channel" — which is checkable directly.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const pg = await ctx.newPage();
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await pg.reload();
    await pg.click("#matchBtn");
    await pg.waitForSelector("#match:not(.hidden)");

    // Drive the three states into existence on ONE board: match a pair, then
    // hold a second character. Reading them off the live DOM rather than from
    // the stylesheet is what makes this see the cascade a player actually gets.
    const st = await pg.evaluate(() => {
      const chars = [...document.querySelectorAll("#mchars .mtile")];
      const pics = [...document.querySelectorAll("#mpics .mtile")];
      const a = chars[0], b = pics.find((p) => p.dataset.ch === a.dataset.ch);
      a.click(); b.click();
      chars[1].click();
      const read = (el) => {
        const cs = getComputedStyle(el);
        return { fill: cs.backgroundColor, shadow: cs.boxShadow };
      };
      return {
        plain: read(chars[2]),
        held: read(chars[1]),
        done: read(chars[0]),
        cls: { plain: chars[2].className, held: chars[1].className, done: chars[0].className },
      };
    });

    // The fixture has to have produced three DIFFERENT states, or every clause
    // below passes on three readings of the same tile.
    assert.ok(/\bheld\b/.test(st.cls.held), `fixture: the second tap did not hold (${st.cls.held})`);
    assert.ok(/\bdone\b/.test(st.cls.done), `fixture: the pair did not match (${st.cls.done})`);
    assert.ok(!/\b(held|done)\b/.test(st.cls.plain), `fixture: the control tile is not plain (${st.cls.plain})`);

    const pairs = [["plain", "held"], ["plain", "done"], ["held", "done"]];
    const hueOnly = pairs.filter(([x, y]) =>
      st[x].fill !== st[y].fill && st[x].shadow === st[y].shadow);
    assert.deepEqual(hueOnly.map((p) => p.join("/")), [],
      "these tile states differ ONLY in fill colour, so hue is the only thing " +
      "telling them apart: " +
      hueOnly.map(([x, y]) => `${x} vs ${y} (both ${st[x].shadow})`).join(" | "));

    // …and the states must genuinely be three, or "no pair differs by colour
    // alone" is satisfied by a board where nothing changes at all.
    assert.equal(new Set([st.plain.fill, st.held.fill, st.done.fill]).size, 3,
      `the three tile states must LOOK like three states (saw fills ` +
      `${[st.plain.fill, st.held.fill, st.done.fill].join(" ")})`);
  } finally {
    await ctx.close();
  }
});

test("Word Cards: the matching board says the CHARACTER and never the answer", async () => {
  // Four branches, none of them driven until now, and the order below is the
  // whole test: each clause has to be reached by an input that can actually
  // get there. The sharpest is the FIRST — mPick speaks only `if (side ===
  // "char")`, and without that guard tapping a picture would pronounce the
  // character it matches, i.e. the board would read the answer aloud before he
  // has chosen anything. That is this page's "the answer stays off the tree"
  // law in the AUDIO channel.
  //
  // A picture tapped while a CHARACTER is held never reaches mPick at all (it
  // is a guess, so it goes to mBump), so it cannot prove that guard — the
  // input that reaches it is a picture tapped with NOTHING held, which the
  // design explicitly allows as an opening move. Both silences are real and
  // they are different branches, so both are asserted, separately.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await pg.reload();
    // speechSynthesis is a READ-ONLY accessor, so a plain assignment silently
    // no-ops and the real (silent, headless) engine answers — which reads as a
    // feature that never fired rather than a stub that never installed.
    const ok = await pg.evaluate(() => {
      window.__said = [];
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: {
          __stub: true, cancel() {}, getVoices() { return []; },
          speak(u) { window.__said.push({ text: u.text, lang: u.lang }); },
        },
      });
      return !!window.speechSynthesis.__stub;
    });
    assert.ok(ok, "fixture: the speech stub never installed, so nothing below measures anything");

    await pg.click("#matchBtn");
    await pg.waitForSelector("#match:not(.hidden)");
    // Sound is OFF by default (RULE 5), so nothing below can speak until the
    // board's own toggle is used — which also proves the toggle reaches it.
    const wasMuted = await pg.evaluate(() =>
      !document.getElementById("msound").classList.contains("on"));
    assert.ok(wasMuted, "fixture: sound must start OFF, or the toggle proves nothing");
    await pg.click("#msound");

    // 1. PICTURE FIRST, nothing held — must be SILENT. This is the only input
    //    that reaches mPick with a picture, and so the only one that can prove
    //    the guard.
    const first = await pg.evaluate(() => {
      window.__said.length = 0;
      const p = document.querySelector("#mpics .mtile");
      p.click();
      return {
        said: window.__said.slice(),
        held: p.classList.contains("held"),
        ch: p.dataset.ch,
      };
    });
    assert.ok(first.held, "fixture: the picture did not take the hold, so mPick was never reached");
    assert.deepEqual(first.said, [],
      `tapping a picture spoke the character it matches — the board read the answer ` +
      `aloud before he chose: ${first.said.map((s) => s.text).join(", ")}`);

    // 2. Its partner CHARACTER completes the pair, and a match confirms out
    //    loud — the only audio a correct tap earns.
    const pair = await pg.evaluate((ch) => {
      window.__said.length = 0;
      const a = [...document.querySelectorAll("#mchars .mtile")].find((c) => c.dataset.ch === ch);
      a.click();
      return { said: window.__said.slice(), done: a.classList.contains("done") };
    }, first.ch);
    assert.ok(pair.done, "fixture: the partner did not pair");
    assert.equal(pair.said.length, 1,
      `a match must confirm out loud — spoke ${pair.said.length} times`);
    assert.equal(pair.said[0].lang, "zh-CN",
      `the confirmation must keep its language (got ${pair.said[0].lang})`);

    // 3. A CHARACTER tap speaks it — in zh-CN, through the ONE cardSpeech
    //    owner, so the character carries its sentence and its language. The
    //    pair above cleared the hold, so this reaches mPick.
    const one = await pg.evaluate(() => {
      window.__said.length = 0;
      const a = [...document.querySelectorAll("#mchars .mtile")].find((c) => !c.classList.contains("done"));
      a.click();
      const c = mCard(a.dataset.ch);
      return { said: window.__said.slice(), want: cardSpeech(c), ch: a.dataset.ch };
    });
    assert.equal(one.said.length, 1,
      `tapping a character must say it out loud — spoke ${one.said.length} times`);
    assert.equal(one.said[0].lang, "zh-CN",
      `a Chinese character on the page's en-US voice is read as letter noise (got ${one.said[0].lang})`);
    assert.equal(one.said[0].text, one.want[0],
      `the board must speak what cardSpeech says, not a second spelling of it ` +
      `(said "${one.said[0].text}", owner says "${one.want[0]}")`);
    assert.ok(one.said[0].text.startsWith(one.ch),
      `the character itself must lead the line (said "${one.said[0].text}")`);

    // 4. …and a WRONG GUESS — a picture tapped while that character is held —
    //    stays silent too. Different branch (mBump, not mPick), same law.
    const miss = await pg.evaluate((ch) => {
      window.__said.length = 0;
      const wrong = [...document.querySelectorAll("#mpics .mtile")]
        .find((p) => p.dataset.ch !== ch && !p.classList.contains("done"));
      wrong.click();
      return { said: window.__said.slice(), consumed: wrong.classList.contains("done") };
    }, one.ch);
    assert.deepEqual(miss.said, [],
      `a wrong guess spoke — the board answered the guess out loud: ` +
      `${miss.said.map((s) => s.text).join(", ")}`);
    assert.equal(miss.consumed, false, "a wrong tap must not consume the tile (RULE 5: no failure state)");

    assert.deepEqual(errs, [], `uncaught page errors: ${errs.join(" | ")}`);
  } finally {
    await ctx.close();
  }
});

test("Word Cards: matching is no-fail — a wrong tap costs nothing and three misses show him", async () => {
  // RULE 5 does not allow a failure state, and a matching game is where one
  // would naturally creep in. So a wrong tap bumps the tile he touched, keeps
  // his pick, removes nothing and scores nothing; three of them and the board
  // shows him the partner, which is the 写字 rescue one screen over. Driven
  // through the real DOM, because every one of those is a claim about what
  // happens on a tap rather than about what the code says.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
    await pg.click("#matchBtn");
    await pg.waitForSelector("#match:not(.hidden)");

    const look = () => pg.evaluate(() => ({
      chars: [...document.querySelectorAll("#mchars .mtile")].map((t) => t.dataset.ch),
      pics: [...document.querySelectorAll("#mpics .mtile")].map((t) => t.dataset.ch),
      held: [...document.querySelectorAll("#match .held")].map((t) => t.dataset.ch),
      pressed: [...document.querySelectorAll('#match [aria-pressed="true"]')].map((t) => t.dataset.ch),
      done: [...document.querySelectorAll("#match .done")].map((t) => t.dataset.ch),
      round: document.getElementById("mcount").textContent.trim(),
      tiles: document.querySelectorAll("#match .mtile").length,
    }));
    // A DOM click, which is how this suite drives every tap: it reaches the
    // handler whatever the tile's state, so a consumed tile refusing the tap is
    // the product's doing and not the harness's.
    const tap = (sel) => pg.evaluate((s) => document.querySelector(s).click(), sel);

    let s = await look();
    assert.equal(s.tiles, 8, `a board is four pairs — saw ${s.tiles} tiles`);
    assert.equal(s.chars.length, 4, "fixture: the character column did not deal");
    assert.deepEqual([...s.chars].sort(), [...s.pics].sort(),
      "the two columns must hold the same four cards, or a pair has no partner");
    assert.notDeepEqual(s.chars, s.pics, "the picture column must not repeat the character column's order");

    // 1. PICK — either side may be picked first, so this starts on the left.
    await tap(`#mchars [data-ch="${s.chars[0]}"]`);
    s = await look();
    assert.deepEqual(s.held, [s.chars[0]], "tapping a character must pick it up");
    assert.deepEqual(s.pressed, [s.chars[0]], "a picked tile must say so to a screen reader");

    // 2. A DOUBLED tap KEEPS the hold. A four-year-old hammer-taps, and
    //    un-picking on the second tap gives him a dead-feeling hand — the
    //    documented pick-and-place defect, which cost six games a fix once.
    await tap(`#mchars [data-ch="${s.chars[0]}"]`);
    s = await look();
    assert.deepEqual(s.held, [s.chars[0]], "a doubled tap must keep the pick, never cancel it");

    // 3. WRONG — nothing is removed, nothing is scored, the pick survives.
    const held = s.held[0];
    const wrong = s.pics.filter((c) => c !== held);
    await tap(`#mpics [data-ch="${wrong[0]}"]`);
    s = await look();
    assert.deepEqual(s.done, [], "a wrong tap must not consume anything");
    assert.deepEqual(s.held, [held], "a wrong tap must not throw away his pick");
    assert.equal(s.tiles, 8, "a wrong tap must not remove a tile from the board");

    // 4. THREE misses and the board shows him the partner.
    await tap(`#mpics [data-ch="${wrong[1]}"]`);
    await tap(`#mpics [data-ch="${wrong[2]}"]`);
    const hinted = await pg.evaluate(() => [...document.querySelectorAll("#match .hintme")].map((t) => t.dataset.ch));
    assert.deepEqual(hinted, [held],
      `three misses must show him the partner — hinted ${JSON.stringify(hinted)} for ${held}`);

    // 5. RIGHT — both halves lock together and stop answering taps.
    await tap(`#mpics [data-ch="${held}"]`);
    s = await look();
    assert.deepEqual(s.done.sort(), [held, held], "a correct match must consume BOTH halves");
    assert.deepEqual(s.held, [], "a match must release the pick");
    await tap(`#mchars [data-ch="${held}"]`);
    s = await look();
    assert.deepEqual(s.held, [], "a matched tile must not be pickable again");

    // 6. CLEAR the board, and it deals the next round by itself.
    for (const ch of s.chars) {
      if (s.done.includes(ch)) continue;
      await tap(`#mchars [data-ch="${ch}"]`);
      await tap(`#mpics [data-ch="${ch}"]`);
    }
    const first = s.chars.slice();
    await pg.waitForFunction(
      (prev) => {
        const now = [...document.querySelectorAll("#mchars .mtile")].map((t) => t.dataset.ch);
        return now.length === 4 && now.join() !== prev.join();
      }, first, { timeout: 5000 });
    s = await look();
    assert.deepEqual(s.done, [], "a fresh round must start with a clear board");
    assert.equal(s.round, "2 / 30", `a cleared board deals the next round — saw ${JSON.stringify(s.round)}`);

    // 7. …and it remembers where he got to, like the other two modes.
    const at = await pg.evaluate(() => localStorage.getItem("wc-match-at"));
    assert.equal(at, "1", `the board must keep its place — saw ${JSON.stringify(at)}`);
    await pg.reload({ waitUntil: "load" });
    await pg.click("#matchBtn");
    await pg.waitForSelector("#match:not(.hidden)");
    const back = await look();
    assert.equal(back.round, "2 / 30", `it must reopen where he stopped — saw ${JSON.stringify(back.round)}`);
    assert.deepEqual(back.chars, s.chars, "reopening must deal the same board he left");

    assert.deepEqual(errs, [], `uncaught page errors on the matching board: ${errs.join(" | ")}`);
  } finally {
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} }).catch(() => {});
    await ctx.close();
  }
});

test("Word Cards: matching can be sent back to round 1, but only by a grown-up", async () => {
  // REPORTED FROM REAL PLAY: "I just did some testing and now can't get back to
  // page 1." True, and my fault. The two sibling screens each carry a ◀ ▶ nav
  // and this one cannot — four rows at the tap floor already fill a 320x480
  // screen to within 2px, so there is no room for a nav row — which left
  // clearing thirteen more boards as the only way off round 17.
  //
  // The cure needs its own gate or it becomes a second defect: a bar button a
  // four-year-old can reach is a button he WILL press, and on a plain tap he
  // would live on round 1 for ever and the place memory would be pointless. So
  // it takes a HOLD, which is the gate RULE 5 names. The clause that matters
  // here is therefore the NEGATIVE one — a short tap must do nothing — because
  // that is the whole difference between a gate and a button.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  try {
    await pg.goto(baseURL + "wordcards.html", { waitUntil: "load" });
    const park = async (n) => {
      await pg.evaluate((v) => localStorage.setItem("wc-match-at", v), String(n));
      await pg.reload({ waitUntil: "load" });
      await pg.click("#matchBtn");
      await pg.waitForSelector("#match:not(.hidden)");
    };
    const at = () => pg.evaluate(() => ({
      round: document.getElementById("mcount").textContent.trim(),
      stored: localStorage.getItem("wc-match-at"),
      filling: document.getElementById("mreset").classList.contains("holding"),
    }));
    const press = async (ms, slideOff) => {
      const box = await (await pg.$("#mreset")).boundingBox();
      await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await pg.mouse.down();
      await pg.waitForTimeout(ms);
      if (slideOff) {
        await pg.mouse.move(box.x + box.width / 2, box.y + box.height + 140);
        await pg.waitForTimeout(900);
      }
      await pg.mouse.up();
    };

    // FIXTURE: he really is deep in the deck, or every clause below is moot.
    await park(17);
    let s = await at();
    assert.equal(s.round, "18 / 30", `fixture: the board did not reopen where it was parked (${s.round})`);

    // 1. A SHORT TAP DOES NOTHING. This is the gate.
    await press(150);
    s = await at();
    assert.equal(s.round, "18 / 30", "a tap must not send him back — the control is a HOLD");
    assert.equal(s.stored, "17", "a tap must not touch his saved place");

    // …and it still SHOWS that something is happening, or a grown-up pressing
    // it once learns only that the button is broken.
    const box = await (await pg.$("#mreset")).boundingBox();
    await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await pg.mouse.down();
    await pg.waitForTimeout(150);
    const mid = await at();
    await pg.mouse.up();
    assert.equal(mid.filling, true, "the button must fill while held, or the gate is a secret");
    assert.equal((await at()).filling, false, "letting go must reset the fill");

    // 2. SLIDING OFF mid-hold is how a grown-up changes their mind.
    await press(300, true);
    s = await at();
    assert.equal(s.round, "18 / 30", "sliding off the button mid-hold must cancel it");
    assert.equal(s.stored, "17", "a cancelled hold must not touch his saved place");

    // 3. A REAL HOLD sends him back, and forgets the place so a fresh open
    //    starts there too.
    await press(1000);
    s = await at();
    assert.equal(s.round, "1 / 30", `holding must go back to round 1 — saw ${s.round}`);
    assert.equal(s.stored, null, "going back to round 1 must forget the saved place");
    const first = await pg.evaluate(() =>
      [...document.querySelectorAll("#mchars .mtile")].map((t) => t.dataset.ch));
    assert.equal(first.length, 4, "round 1 must deal a full board");
    assert.deepEqual((await at()).round, "1 / 30");

    // …and it really is the FIRST board, not just a relabelled one.
    const dealt = await pg.evaluate(() => mRounds[0].map((c) => c[0]));
    assert.deepEqual(first, dealt, "the board shown must be round 1's own cards");

    // 4. A KEYBOARD is not a four-year-old's finger, so it acts at once — a
    //    hold-only control would be operable by touch and mouse and nothing
    //    else, which is not a gate, it is an exclusion.
    await park(9);
    assert.equal((await at()).round, "10 / 30", "fixture: the second park did not take");
    await pg.evaluate(() => {
      const el = document.getElementById("mreset");
      el.focus();
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    s = await at();
    assert.equal(s.round, "1 / 30", `Enter must work without a hold — saw ${s.round}`);
    assert.equal(s.stored, null, "the keyboard path must forget the place too");

    // 5. …AND THE LAST ROUND MUST STILL BE RESUMABLE. The three place-memory
    //    restores on this page disagree by one: the deck and the writer accept
    //    `v < len - 1` and the board accepts `v < len`. Both are RIGHT for
    //    their own semantics — the deck saves the card he is LOOKING at and its
    //    last card is terminal (a dead Next button), while mGo is modular so a
    //    parked round is always a playable index and finishing the last one
    //    wraps to 0 by itself. Three siblings and two correct rules is exactly
    //    the shape a later author "harmonises", and harmonising this one makes
    //    the final board silently unreachable on resume — the mirror of the
    //    complaint that put the ⏮️ on this bar. The index is DERIVED, so a
    //    31st round inherits the clause.
    const lastIdx = await pg.evaluate(() => mRounds.length - 1);
    await park(lastIdx);
    s = await at();
    assert.equal(s.round, `${lastIdx + 1} / ${lastIdx + 1}`,
      `parking on the LAST round must reopen there, not start over — saw ${s.round}`);

    assert.deepEqual(errs, [], `uncaught page errors: ${errs.join(" | ")}`);
  } finally {
    await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} }).catch(() => {});
    await ctx.close();
  }
});

test("private mode: the app boots and plays with storage BLOCKED", async () => {
  // NOTHING IN THIS SUITE HAS EVER BLOCKED STORAGE. CLAUDE.md records
  // "storage-BLOCKED Safari (private mode) still boots and plays" as an audit
  // finding, and an audit is a measurement taken once — the standing pairing
  // says a scan proves a call site exists and only driving it proves the call
  // does anything, and here the "call site" is a try/catch nobody drives.
  //
  // Measured clean before this was written, so it is COVERAGE and not a fix:
  // all four of Word Cards' storage touches are already guarded, and so is the
  // launcher's. What it protects against is the NEXT unguarded access, whose
  // failure is silent and total — a throw at boot hands Josh a blank page on a
  // car ride, which is the same class the offline dead-shell test exists for.
  // Word Cards has the most to lose: storage carries his place in the deck,
  // and its own design note says a seeded order is only worth having if you
  // can carry on.
  const BLOCK = () => {
    // `localStorage` is a READ-ONLY accessor on window, so a plain assignment
    // silently does nothing and the real store answers — which reads exactly
    // like a feature that never fired rather than a stub that never installed.
    // (The same trap as window.speechSynthesis, recorded when a Word Cards
    // speech test stubbed nothing and passed.)
    const boom = () => { throw new DOMException("The operation is insecure.", "SecurityError"); };
    Object.defineProperty(window, "localStorage", { get: boom, configurable: true });
  };

  for (const who of ["cards", "launcher"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(BLOCK);
    const pg = await ctx.newPage();
    const errs = [];
    pg.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
    // …and the CONSOLE too, because main.js deliberately isolates each feature
    // (`try { init(); } catch (e) { console.error("Josh: init failed:", e) }`),
    // so on the launcher a storage throw never reaches `pageerror` at all — it
    // is swallowed and logged, and a message that guessed "a real hang" would
    // point the next reader at the wrong thing.
    const logged = [];
    pg.on("console", (m) => { if (m.type() === "error") logged.push(m.text().split("\n")[0]); });
    try {
      await pg.goto(baseURL + (who === "cards" ? "wordcards.html" : ""), { waitUntil: "load" });

      // SELF-VERIFYING FIXTURE: if the block did not install, every clause
      // below passes against a perfectly ordinary browser and proves nothing.
      const blocked = await pg.evaluate(() => {
        try { localStorage.getItem("x"); return false; } catch (e) { return true; }
      });
      assert.ok(blocked, `${who}: the storage block did not install — the run would be vacuous`);

      // A boot throw kills the page and every wait below then reports a bare
      // "Timeout 5000ms exceeded", which sends the next reader hunting a slow
      // page instead of an unguarded storage access. Name the cause.
      const appear = async (sel, what) => {
        try { await pg.waitForSelector(sel, { state: "visible", timeout: 5000 }); }
        catch (e) {
          const why = errs.length ? `the page threw at boot: ${errs.join(" | ")}`
            : logged.length ? `something swallowed a throw and logged: ${logged.join(" | ")}`
            : "and nothing threw or logged, so look for a hang rather than a storage guard";
          assert.fail(`private mode: ${what} never appeared — ${why}`);
        }
      };

      if (who === "cards") {
        await appear(".chip", "the deck menu");
        await pg.evaluate(() => { document.querySelector("#grid .chip").click(); });
        await pg.locator("#deck").waitFor({ state: "visible" });
        await pg.click("#card");
        await pg.waitForTimeout(400);
        await pg.click("#next");
        await pg.waitForTimeout(150);
        await pg.click("#sound");                      // the one write it makes on purpose
        const r = await pg.evaluate(() => ({
          word: document.getElementById("word").textContent,
          count: document.getElementById("count").textContent,
          sound: document.getElementById("sound").getAttribute("aria-pressed"),
          flipped: document.getElementById("card").classList.contains("flipped"),
        }));
        assert.ok(r.word.length > 0, "private mode: the card is blank");
        assert.match(r.count, /^2 \/ \d+$/, `private mode: Next did not move on (counter "${r.count}")`);
        assert.equal(r.sound, "true", "private mode: the sound toggle did not take");
        assert.equal(r.flipped, false, "private mode: Next must leave the next card word-side up");
      } else {
        await pg.evaluate(() => { location.hash = "#home"; });
        await appear("#screen-home", "Josh's launcher");
        const r = await pg.evaluate(() => ({
          games: (window.JoshGames || []).length,
          tiles: document.querySelectorAll("#screen-home .tile").length,
        }));
        // the dead-shell signature: the page paints and no script ran
        assert.ok(r.games >= 200, `private mode: only ${r.games} games registered`);
        assert.ok(r.tiles >= 8, `private mode: only ${r.tiles} tiles on the launcher`);
      }
      assert.deepEqual(errs, [], `${who}: uncaught page errors in private mode`);
    } finally {
      await ctx.close();
    }
  }
});
