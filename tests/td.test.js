// Fort Josh TD — browser tests (Chromium): the front-door entry (no gate —
// removed by request 2026-07), real build taps, a scripted victory via the
// shipped __TD hooks (the real-time test contract), defeat, pause/speed,
// kid-world isolation, and mobile-size sanity. Works against JOSH_BASE_URL
// too (verify-live).

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { startServer, launchBrowser } = require("./helpers");

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

test("the front door's 🏰 tile opens the fort DIRECTLY (the name gate is gone)", async () => {
  // By request (2026-07): no more "Jon" gate — the start page's castle tile
  // navigates straight to the fort home.
  await page.evaluate(() => { location.hash = ""; });
  await page.locator("#screen-start").waitFor({ state: "visible" });
  const tile = page.locator("#start-td");
  const box = await tile.boundingBox();
  assert.ok(box && box.width >= 75 && box.height >= 75, "the castle tile is a giant tap target");
  await tile.click();
  await page.locator("#screen-td-home").waitFor({ state: "visible", timeout: 8000 });
  assert.equal(await page.locator(".td-gate").count(), 0, "no name gate exists any more");
  assert.ok(await page.evaluate(() => document.body.classList.contains("td-mode")), "fort theme on");
});

test("QoL: the Endless picker names its unit and reads as English", async () => {
  // Two player-facing copy defects on one surface. A best score rendered as a
  // bare "🏆 12" — twelve of WHAT — which is the same class as ⚙️ Toy Energy
  // shipping as an unnamed numeral; and the locked hint read "🔒 3⭐ the 4
  // levels", which has no verb. The unit was already written in this very
  // function, in a variable it computed (" · best wave ") and never used — that
  // dead line is what named the fix.
  await page.evaluate(() => {
    const st = {}; for (let i = 1; i <= 8; i++) st[i] = 3;       // two worlds unlocked
    localStorage.setItem("jon-td-save-v1", JSON.stringify({
      v: 1, stars: { casual: {}, normal: st, heroic: {} }, difficulty: "normal",
      endlessBest: { bedroom: 27 } }));                          // one with a score, one without
  });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.locator("#screen-td-home .td-endless-open").click();
  await page.waitForTimeout(250);

  const rows = await page.evaluate(() => {
    const out = [];
    for (const b of document.querySelectorAll(".td-endless")) {
      const bb = b.getBoundingClientRect();
      const s = b.querySelector(".td-endless__best");
      const sb = s.getBoundingClientRect();
      out.push({ world: b.dataset.world, txt: s.textContent.trim(),
        locked: b.classList.contains("td-endless--locked"),
        overflows: sb.right > bb.right + 1 || sb.left < bb.left - 1 });
    }
    return out;
  });
  assert.ok(rows.length >= 6, `fixture: the picker must list the worlds (saw ${rows.length})`);

  const scored = rows.find((r) => r.world === "bedroom");
  assert.ok(scored && !scored.locked, "fixture: bedroom must be unlocked with a best");
  assert.match(scored.txt, /wave\s*27/,
    `a best score must name its UNIT, not read as a bare number (saw ${JSON.stringify(scored.txt)})`);

  const fresh = rows.find((r) => !r.locked && !/wave/.test(r.txt));
  assert.ok(fresh && /new/i.test(fresh.txt),
    `an unlocked arena with no score yet says so (saw ${JSON.stringify(fresh && fresh.txt)})`);

  const locked = rows.filter((r) => r.locked);
  assert.ok(locked.length >= 1, "fixture: at least one arena must still be locked");
  for (const r of locked) {
    // DERIVED: the count is the world's real level count, not a literal that
    // happened to be right when every world had four.
    // NOTE: the COUNT half of this clause is vacuous on shipped data — every one
    // of the ten worlds has exactly four levels, so hard-coding "4" passes it
    // (measured, not assumed). What it really pins is the WORDING. The
    // derivation is held by a structural check in site.test.js, which can fail.
    const n = await page.evaluate((w) => window.TDData.LEVELS.filter((l) => l.world === w).length, r.world);
    assert.ok(r.txt.includes("all " + n + " levels"),
      `a locked arena must read as an instruction naming its real level count ` +
      `(${r.world}: saw ${JSON.stringify(r.txt)}, expected "all ${n} levels")`);
  }
  assert.ok(!rows.some((r) => r.overflows), "no row's status may spill outside its button");
});

test("QoL: the pause menu says WHICH level you are in, endless included", async () => {
  // Nothing in a live battle said where you were — not the HUD, not the pause
  // menu — so a resumed run, or one you came back to, had no answer short of
  // quitting to the fort. The pause menu is where you look when you stop to
  // think, and unlike the HUD it has room (the HUD is the documented
  // reflow-sensitive surface).
  const openPause = async () => {
    await page.locator("#screen-td-play .td-pause").click();
    await page.locator(".td-overlay--pause").waitFor({ state: "visible" });
    await page.waitForTimeout(120);
    return page.evaluate(() => {
      const box = document.querySelector(".td-overlay--pause .td-overlay__box");
      const w = box.querySelector(".td-pause__where");
      const btns = [...box.querySelectorAll("button")];
      const last = btns[btns.length - 1].getBoundingClientRect();
      const b = box.getBoundingClientRect();
      // NOT `scrollHeight > clientHeight`: that is content OVERFLOW, not
      // scrollability, and a box that clips reports it identically — measured,
      // the mutation that deletes `overflow-y: auto` passed against it. Scroll
      // the box for real and see whether the button arrives. Note this half is
      // currently VACUOUS at this test's own 390x844 viewport, where the menu
      // fits outright and `fits` short-circuits it; the clip mutation is caught
      // by the sibling test that runs the SHORT sizes. It is corrected here
      // anyway so the predicate cannot mislead a future reader — or quietly
      // become the only check after a layout change.
      const fits = last.bottom <= window.innerHeight + 1;
      box.scrollTop = box.scrollHeight;
      const after = btns[btns.length - 1].getBoundingClientRect();
      const scrolledTo = box.scrollTop > 0 && after.top >= -1 && after.bottom <= window.innerHeight + 1;
      box.scrollTop = 0;
      return { where: w ? w.textContent.trim() : null,
        boxInView: b.top >= -1 && b.bottom <= window.innerHeight + 1,
        lastReachable: fits || scrolledTo };
    });
  };
  const enter = async (fn) => {
    await page.evaluate(() => { location.hash = "#td-play"; });
    await page.locator("#screen-td-play").waitFor({ state: "visible" });
    await page.evaluate(fn);
    await page.evaluate(() => { location.hash = "#__renav"; });
    await page.waitForTimeout(50);
    await page.evaluate(() => { location.hash = "#td-play"; });
    await page.waitForTimeout(300);
  };

  // 1. A campaign level names itself.
  await enter(() => window.__TD.newGame(5, { seed: 3 }));
  let r = await openPause();
  const lvl5 = await page.evaluate(() => window.TDData.LEVELS.find((l) => l.id === 5).name);
  assert.ok(r.where && r.where.includes("Level 5") && r.where.includes(lvl5),
    `the pause menu must name the level (saw ${JSON.stringify(r.where)}, expected "Level 5 · ${lvl5}")`);
  // …and the extra line must not push the menu past the fold. This dialog has
  // form: six buttons once overflowed a 390-tall landscape viewport with no
  // scroll, which is why the box carries max-height + overflow-y.
  assert.ok(r.boxInView && r.lastReachable, "the pause menu must still fit, or scroll, with the line added");
  await page.evaluate(() => { document.querySelector('.td-overlay--pause [data-act="resume"]').click(); });
  await page.waitForTimeout(120);

  // 2. An ENDLESS run must name itself too, and must not throw doing it: its
  //    levelId is a STRING like "endless-bedroom" that is NOT in DATA.LEVELS —
  //    the documented trap that had UI.hud throwing every frame.
  await enter(() => window.__TD.startEndless("bedroom"));
  r = await openPause();
  assert.ok(r.where && /Endless/.test(r.where),
    `an endless run must name itself (saw ${JSON.stringify(r.where)})`);
  const arena = await page.evaluate(() => window.TDData.ENDLESS.worlds.bedroom.label);
  assert.ok(r.where.includes(arena),
    `…and say WHICH arena (saw ${JSON.stringify(r.where)}, expected it to contain ${JSON.stringify(arena)})`);
  await page.evaluate(() => { document.querySelector('.td-overlay--pause [data-act="resume"]').click(); });
  await page.waitForTimeout(120);

  // 3. ONE owner. The resume banner built this same sentence inline before, and
  //    two copies of "what is this run called" is exactly how they drift.
  const banner = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1") || "{}");
    raw.midRun = { levelId: 5, waveIdx: 2, towers: [], gold: 200, lives: 15, difficulty: "normal" };
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
    return true;
  });
  assert.ok(banner, "fixture: seeded a parked run");
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const txt = await page.locator(".td-resume__txt").textContent();
  assert.ok(txt.includes("Level 5") && txt.includes(lvl5),
    `the resume banner must use the same owner, so it names the level the same way (saw ${JSON.stringify(txt)})`);
  // …and HOW FAR IN, with a total and the lives it is parked on. The banner
  // said a bare "wave 3": you could not tell a run two waves from its finale
  // from one barely started, and nothing said whether it was parked on 3 hearts
  // or 20 — which is the fact that decides whether to resume it or restart.
  // The total is DERIVED from the level's own wave table, so a re-authored L5
  // cannot leave this asserting a stale number.
  const l5waves = await page.evaluate(() => window.TDData.LEVELS.find((l) => l.id === 5).waves.length);
  assert.ok(txt.includes("wave 3/" + l5waves),
    `the banner must say how far in AND out of how many (saw ${JSON.stringify(txt)}, expected "wave 3/${l5waves}")`);
  assert.ok(/❤️\s*15/.test(txt),
    `…and the lives it is parked on, which is what decides resume-or-restart (saw ${JSON.stringify(txt)})`);

  // An ENDLESS checkpoint has no wave TABLE, so the same owner must take the
  // ♾️ branch instead of dividing by a total of 0 — the documented trap that
  // had UI.hud throwing every frame on a levelId that is not in DATA.LEVELS.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1") || "{}");
    raw.midRun = { levelId: "endless-bedroom", endless: true, world: "bedroom", waveIdx: 6, towers: [], gold: 200, lives: 9, difficulty: "normal" };
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const endTxt = await page.locator(".td-resume__txt").textContent();
  assert.ok(endTxt.includes("wave 7 ♾️"),
    `an endless parked run counts waves with no total (saw ${JSON.stringify(endTxt)})`);
  assert.ok(!/wave 7\//.test(endTxt),
    `…and never divides by a table it does not have (saw ${JSON.stringify(endTxt)})`);
  assert.ok(/❤️\s*9/.test(endTxt), `…and still states its lives (saw ${JSON.stringify(endTxt)})`);

  // CLEAN UP THE PARKED RUN. A stale checkpoint with no live run bounces
  // #td-play straight back to the fort home, so leaving one behind makes the
  // NEXT test time out waiting for a screen that will never show — the exact
  // symptom this file records from the resetSave-without-dropRun bug, and how
  // this test was caught leaking in the first place.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1") || "{}");
    delete raw.midRun;
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  assert.equal(await page.locator(".td-resume:not([hidden])").count(), 0,
    "fixture: the parked run must be gone, or the next test cannot reach #td-play");
});

test("QoL: a wave starting closes the tower panel — it sits ON the battlefield", async () => {
  // The panel/build menu is a bubble absolutely positioned over the field with
  // pointer-events: auto, so left open when the fight starts it both HIDES and
  // BLOCKS TAPS on a measured 21% of the battlefield — exactly the ground an
  // aimed power needs. The CALL button already cleared it; the countdown simply
  // RUNNING OUT did not, so the two routes into the same state disagreed. This
  // drives the route a CALL tap never covers.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => window.__TD.newGame(5, { seed: 3 }));
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(50);
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const L = window.TDData.LEVELS.find((l) => l.id === 5);
    window.__TD.script(L.pads.slice(0, 3).map((p) => ["place", "dart", p.id]));
  });
  const rect = await page.locator("#screen-td-play .td-canvas").boundingBox();
  const tapTower = async () => {
    const sp = await page.evaluate(() => {
      const t = window.__TD.state().towers[0];
      return window.__TD.w2s(t.cx + 0.5, t.cy + 0.5);
    });
    await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
    await page.waitForTimeout(250);
  };
  const look = () => page.evaluate(() => {
    const b = document.querySelector("#screen-td-play .td-bubble");
    const c = document.querySelector("#screen-td-play .td-canvas");
    const bb = b && b.getBoundingClientRect(), cb = c.getBoundingClientRect();
    const oh = bb ? Math.max(0, Math.min(bb.bottom, cb.bottom) - Math.max(bb.top, cb.top)) : 0;
    const ow = bb ? Math.max(0, Math.min(bb.right, cb.right) - Math.max(bb.left, cb.left)) : 0;
    return { shown: !!(b && !b.hidden), phase: window.__TD.state().phase,
      coversPct: bb && !b.hidden ? +(100 * oh * ow / (cb.width * cb.height)).toFixed(1) : 0 };
  });

  await tapTower();
  let r = await look();
  assert.equal(r.phase, "build", "fixture: still in the build phase");
  assert.ok(r.shown, "fixture: tapping a tower opens its panel");
  // Non-vacuity: it must genuinely be a big occluder, or closing it buys nothing.
  assert.ok(r.coversPct > 15,
    `fixture: the panel must really cover a lot of the field, or this test proves nothing (${r.coversPct}%)`);

  // Let the countdown EXPIRE — the route a CALL tap never takes. Driven by the
  // REAL frame loop: script(["tick"]) runs with the renderer paused and skips
  // phaseWatch entirely, so it cannot answer this.
  await page.evaluate(() => { window.__TD.state().countdown = 20; });
  await page.waitForFunction(() => window.__TD.state().phase === "wave", null, { timeout: 8000 });
  await page.waitForTimeout(250);
  r = await look();
  assert.equal(r.phase, "wave", "fixture: the wave really started");
  assert.ok(!r.shown && r.coversPct === 0,
    `the panel must close when the wave starts (still covering ${r.coversPct}% of the field)`);

  // CONTROL: building and inspecting MID-WAVE is legal, so a panel opened during
  // the wave must STAY. The rule is scoped to the build→wave transition, not to
  // "the phase is wave".
  await tapTower();
  await page.waitForTimeout(400);
  r = await look();
  assert.equal(r.phase, "wave", "fixture: still mid-wave");
  assert.ok(r.shown,
    "a panel opened DURING a wave must stay open — inspecting and building mid-wave is legal");
});

test("QoL: the fort home says how many stars are waiting to be spent", async () => {
  // All seven meta buttons showed no numbers at all, so "you have stars to
  // spend" was invisible until you opened the tree — and in a 40-node, 140⭐
  // tree unspent stars are literally unused power. The count is DERIVED from
  // starTotals(), the same owner the tree's own header reads.
  const openHome = async () => {
    await page.evaluate(() => { location.hash = "#__renav"; });   // a same-hash set is a no-op: route() would never fire
    await page.waitForTimeout(40);
    await page.evaluate(() => { location.hash = "#td-home"; });
    await page.locator("#screen-td-home").waitFor({ state: "visible" });
    await page.waitForTimeout(60);
  };
  const read = () => page.evaluate(() => {
    const b = document.querySelector("#screen-td-home .td-tree-open");
    const n = b.querySelector(".td-metabtn__n");
    const bb = b.getBoundingClientRect(), nb = n && n.getBoundingClientRect();
    return {
      text: n ? n.textContent.trim() : null,
      aria: b.getAttribute("aria-label"),
      inside: !!(nb && nb.top >= bb.top && nb.right <= bb.right && nb.bottom <= bb.bottom && nb.left >= bb.left),
      btnH: Math.round(bb.height),
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  const seedStars = async (levels) => {
    await page.evaluate((n) => {
      const stars = {}; for (let i = 1; i <= n; i++) stars[i] = 3;
      localStorage.setItem("jon-td-save-v1", JSON.stringify({
        v: 1, stars: { casual: {}, normal: stars, heroic: {} }, difficulty: "normal" }));
    }, levels);
    await page.reload({ waitUntil: "load" });
    await openHome();
  };

  // 1. The count is there, correct, and inside its button.
  await seedStars(4);                                  // 4 levels x 3 stars, none spent
  let r = await read();
  assert.equal(r.text, "12", `the button must state the unspent stars (saw ${r.text})`);
  assert.ok(r.inside, "the badge must sit inside the button it annotates");
  assert.match(r.aria || "", /12 stars to spend/,
    "…and the accessible name must carry the number — a title attribute is hover-only on a phone");
  assert.ok(!r.pageOverflow, "the badge must not push the home wider than the screen");

  // 2. THREE digits must still fit: the ceiling is LEVELS.length * 3.
  await seedStars(40);
  r = await read();
  assert.equal(r.text, "120", `the whole campaign's stars must fit (saw ${r.text})`);
  assert.ok(r.inside && !r.pageOverflow, "a three-digit count must stay inside the button and on screen");

  // 3. Spending must UPDATE it. The tree's Done only closes the overlay — the
  //    home is never re-rendered — so without a refresh inside showStarTree the
  //    button would still claim the stars you just spent, which is the single
  //    worst moment for it to be wrong.
  const before = (await read()).text;
  await page.locator("#screen-td-home .td-tree-open").click();
  await page.locator(".td-overlay .td-node").first().waitFor({ state: "visible" });
  const cost = await page.evaluate(() => {
    const n = document.querySelector(".td-overlay .td-node:not([disabled])");
    n.click();
    return true;
  });
  assert.ok(cost, "fixture: a buyable node must exist with 120 stars available");
  await page.waitForTimeout(120);
  const after = (await read()).text;
  assert.ok(Number(after) < Number(before),
    `spending a star must drop the count behind the dialog (${before} -> ${after})`);

  // 4. …and with nothing to spend there must be NO badge. A badge that is always
  //    present is decoration; one that appears when there is something to act on
  //    is a signal.
  await page.evaluate(() => { localStorage.setItem("jon-td-save-v1", JSON.stringify({ v: 1, stars: { casual: {}, normal: {}, heroic: {} }, difficulty: "normal" })); });
  await page.reload({ waitUntil: "load" });
  await openHome();
  r = await read();
  assert.equal(r.text, null, `a fresh save has nothing to spend, so there must be no badge (saw ${r.text})`);
});

test("QoL: the fort home brings the NEXT level to play into view", async () => {
  // The fort home is ~2100px tall and its route ends with scrollTo(0, 0), so
  // from level 13 onward the level you actually came here to play sits below
  // the fold — 1668px down by level 37 — and you return to this screen after
  // EVERY level, so the player who has invested the most scrolls the furthest,
  // every single time. Measured before the fix at 390x844: in view at 0 and 4
  // beaten, out of view at 12, 20, 28 and 36.
  // scrollIntoView with behavior:"smooth" is ASYNC — measuring straight after
  // catches it mid-animation and reports a PARTIAL scroll, which reads exactly
  // like a half-working fix (it reported 2px of a 958px scroll). Every clause
  // below waits for scrollY to stop moving before it measures.
  // The scroll is INSTANT by design (see UI.focusNextLevel), so one frame is
  // enough. This used to poll for a smooth animation to settle and could
  // conclude before it even started — reporting 2px of what was really a 1051px
  // scroll, which made a load-bearing guard look worth two pixels.
  const settle = () => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
  const seed = async (beaten) => {
    await page.evaluate((n) => {
      const stars = {}; for (let i = 1; i <= n; i++) stars[i] = 3;
      localStorage.setItem("jon-td-save-v1", JSON.stringify({
        v: 1, stars: { casual: {}, normal: stars, heroic: {} }, difficulty: "normal" }));
    }, beaten);
    await page.reload({ waitUntil: "load" });          // a hash hop is SAME-document: the module would keep its old save
    // …and pin the scroll. Browsers RESTORE scroll position across a reload, so
    // running the deep case first left the next one starting part-way down the
    // page and reporting a scroll this feature never performed. Each case must
    // model ARRIVING at the fort, not reloading mid-scroll.
    await page.evaluate(() => { history.scrollRestoration = "manual"; window.scrollTo(0, 0); });
    // HOP AWAY FIRST. Setting location.hash to the value it already has is a
    // no-op: no hashchange, no route(), so the feature under test never runs and
    // the clause passes VACUOUSLY. After the first case the hash is already
    // #td-home, which is exactly how the parked-run mutation came back green.
    await page.evaluate(() => { location.hash = "#__renav"; });
    await page.waitForTimeout(40);
    await page.evaluate(() => { location.hash = "#td-home"; });
    await page.locator("#screen-td-home").waitFor({ state: "visible" });
    await settle();
    return page.evaluate((n) => {
      const cards = [...document.querySelectorAll("#screen-td-home .td-level")];
      const next = cards[n];                            // 0-indexed → the first unbeaten level
      const b = next.getBoundingClientRect();
      return {
        total: cards.length,
        tagged: document.querySelector("#screen-td-home .td-level[data-next]") === next,
        top: b.top, inView: b.top >= 0 && b.bottom <= window.innerHeight,
        scrollY: window.scrollY, docTop: b.top + window.scrollY, vh: window.innerHeight,
        // Ask the function itself, AFTER reading scrollY. It returns the card it
        // scrolled to, or null when it declined because the card was already
        // visible — a crisp contract, unlike a pixel delta that happened to be
        // 2px here and could round to 0 and flake.
        declinesWhenVisible: window.TDUI.focusNextLevel() === null,
      };
    }, beaten);
  };

  // 1. DEEP progress: the next level must be on screen without the player scrolling.
  const deep = await seed(28);
  assert.equal(deep.total, 40, "fixture: the grid renders every shipped level");
  assert.ok(deep.tagged, "the next level to play carries data-next (the grid is the ONE owner of 'which is next')");
  // Non-vacuity: it must genuinely have been below the fold, or clause 1 is free.
  assert.ok(deep.docTop > deep.vh,
    `fixture: L29 must actually start below the first screenful, or this proves nothing (docTop ${deep.docTop} vs viewport ${deep.vh})`);
  assert.ok(deep.inView,
    `the next level to play must be brought into view (top ${Math.round(deep.top)}, viewport ${deep.vh}, scrollY ${deep.scrollY})`);

  // 2. …and it must NOT be over-eager: a level already on screen must not move
  //    the page at all. Deliberately measured at FOUR beaten, not zero — at zero
  //    L1 sits ABOVE the centre line, so centring it would scroll negative and
  //    clamp to 0, and the mutation that deletes the already-visible guard is
  //    unobservable. At four, L5 is in view at ~473px and centring WOULD scroll
  //    ~98px, so this clause can actually fail.
  const shallow = await seed(4);
  assert.ok(shallow.inView, "fixture: L5 is visible at four beaten without help");
  assert.ok(shallow.docTop > 400 && shallow.docTop + 94 < shallow.vh,
    `fixture: L5 must sit fully in view but BELOW the centre line, or the guard is unobservable (docTop ${shallow.docTop}, viewport ${shallow.vh})`);
  // The crisp clause FIRST: a pixel delta happened to be 2px here and could
  // round to 0 and flake, and if it fired first it would mask this one — the
  // "a mutation that fires an EARLIER clause has not proven the later one" trap.
  assert.ok(shallow.declinesWhenVisible,
    "focusNextLevel must DECLINE (return null) for a card that is already visible, not scroll it");
  assert.equal(shallow.scrollY, 0,
    `…and the page must not have moved at all (scrollY ${shallow.scrollY})`);

  // 3. A PARKED RUN outranks the next level. The Resume banner renders above the
  //    grid, so scrolling down would push it off the top — burying the control
  //    the player almost certainly came back for.
  //    The save must be DEEP here, not the shallow one above: with 4 beaten the
  //    next level is visible anyway, so the already-visible guard would decline
  //    and this clause could not tell whether the parked-run guard exists at all.
  await page.evaluate(() => {
    const stars = {}; for (let i = 1; i <= 28; i++) stars[i] = 3;
    localStorage.setItem("jon-td-save-v1", JSON.stringify({
      v: 1, stars: { casual: {}, normal: stars, heroic: {} }, difficulty: "normal",
      midRun: { levelId: 29, waveIdx: 4, towers: [], gold: 300, lives: 18, difficulty: "normal" },
    }));
  });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { history.scrollRestoration = "manual"; window.scrollTo(0, 0); });
  await page.evaluate(() => { location.hash = "#__renav"; });   // a same-hash set is a no-op: hop away or route() never fires
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await settle();
  const parked = await page.evaluate(() => {
    const r = document.querySelector("#screen-td-home .td-resume");
    const b = r && r.getBoundingClientRect();
    return { shown: !!(r && !r.hidden), top: b ? b.top : null,
      visible: !!(b && b.top >= 0 && b.bottom <= window.innerHeight), scrollY: window.scrollY };
  });
  assert.ok(parked.shown, "fixture: a parked run must actually render the Resume banner");
  // The PROPERTY first, and it fails hard: without the guard the page scrolls
  // 1051px and the banner lands at top -924, not marginally off.
  assert.ok(parked.visible,
    `the Resume banner must stay on screen — it is the control a returning player wants (top ${parked.top}, scrollY ${parked.scrollY})`);
  assert.equal(parked.scrollY, 0,
    `…and the page must not have moved at all (scrollY ${parked.scrollY})`);
});

test("fort home shows L1 open and every later level locked on a fresh save", async () => {
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = "#__renav"; });
  await page.waitForTimeout(50);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  // DERIVED, never a literal — a hard-coded 12 here is what let the fort ship
  // World 4 with no cards for it (the grid itself was capped at 12).
  const shippedLevels = await page.evaluate(() => window.TDData.LEVELS.length);
  assert.equal(await page.locator(".td-level").count(), shippedLevels, `${shippedLevels} level cards`);
  // fresh save: only L1 is playable; every later level is locked (progression gate)
  assert.equal(await page.locator(".td-level--locked").count(), shippedLevels - 1, "all but L1 locked on a fresh save");
  assert.ok(!(await page.evaluate(() => document.querySelectorAll(".td-level")[0].classList.contains("td-level--locked"))), "L1 is open");
  // L2 EXISTS in data but is locked pending an L1 win — it shows a 'win 1 ⭐' hint
  assert.ok(await page.evaluate(() => document.querySelectorAll(".td-level")[1].classList.contains("td-level--locked")), "L2 starts locked");
  assert.ok(await page.evaluate(() => !!document.querySelector(".td-level__need")), "a locked-but-built level explains how to unlock it");
  const box = await page.locator(".td-level").first().boundingBox();
  assert.ok(box && box.height >= 56, "level card is adult-tappable");
});

test("routes: #td-home deep-links directly; an unknown td-* hash falls back to the front door", async () => {
  // (hash-hop: we're already ON #td-home, and re-setting the same hash fires no
  // hashchange — the openGame-renav lesson. Leave, then deep-link back.)
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(100);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  assert.ok(await page.evaluate(() => document.body.classList.contains("td-mode")), "a plain deep link opens the fort");
  // An unknown td-* hash must clear to the front door with the theme dropped.
  await page.evaluate(() => { location.hash = "#td-nonsense"; });
  await page.waitForFunction(() => location.hash === "", null, { timeout: 8000 });
  await page.locator("#screen-start").waitFor({ state: "visible" });
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("td-mode"))), "theme off on the front door");
});

test("play flow: enter L1, tap a pad, build a Dart with a real tap", async () => {
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.locator(".td-level").first().click();
  await page.locator("#screen-td-play").waitFor({ state: "visible", timeout: 8000 });
  const canvas = page.locator(".td-canvas");
  const cbox = await canvas.boundingBox();
  assert.ok(cbox && cbox.width > 200, "canvas rendered");

  // deterministic session for the tap test
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 42 }); });
  const goldBefore = await page.evaluate(() => window.__TD.state().gold);
  // tap pad p3 (world cell 9,5) through the ONE world→screen mapping, so this
  // test is orientation-proof (portrait draws the world rotated 90°).
  const rect = await canvas.boundingBox();
  const sp = await page.evaluate(() => window.__TD.w2s(9.5, 5.5));
  await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  await page.locator('.td-bubble .td-buy[data-line="dart"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('.td-bubble .td-buy[data-line="dart"]').click();
  const st = await page.evaluate(() => window.__TD.state());
  assert.equal(st.towers.length, 1, "the dart was placed by real taps");
  assert.equal(st.gold, goldBefore - 70, "gold paid");
});

test("orientation: portrait FILLS the screen (rotated world) and landscape stays native", async () => {
  // Real-device feedback: portrait left most of the page empty. The renderer
  // now draws the 24×14 world rotated 90° in portrait — the battlefield must
  // occupy the tall screen, and taps must keep landing (proven above via w2s).
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 42 }); });
  assert.ok(await page.evaluate(() => window.__TD.isRotated()), "390×844 portrait uses the rotated world");
  let cbox = await page.locator(".td-canvas").boundingBox();
  assert.ok(cbox.height >= 844 * 0.55, `portrait canvas must fill ≥55% of the screen height, got ${Math.round(cbox.height)}px`);
  assert.ok(cbox.height > cbox.width, "portrait canvas is taller than wide");
  // EVERYTHING fits one screen — no scrolling to see gold or call a wave
  // (real-device feedback): the page must not scroll vertically, and the gold
  // HUD + the floating CALL button must BOTH sit inside the viewport at once.
  const scroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  assert.ok(scroll <= 1, `#td-play must not scroll vertically in portrait (overflows by ${scroll}px)`);
  const gold = await page.locator("#screen-td-play .td-hud__gold").boundingBox();
  const call = await page.locator("#screen-td-play .td-call").boundingBox();
  assert.ok(gold && gold.y >= 0 && gold.y + gold.height <= 844, "the gold HUD is on-screen");
  assert.ok(call && call.y >= 0 && call.y + call.height <= 844, "the CALL button is on-screen (floats over the field)");
  // landscape: unrotated, still fits entirely on screen
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(250);
  assert.ok(!(await page.evaluate(() => window.__TD.isRotated())), "landscape draws unrotated");
  cbox = await page.locator(".td-canvas").boundingBox();
  assert.ok(cbox.width > cbox.height, "landscape canvas is wider than tall");
  assert.ok(cbox.height <= 390, "landscape canvas fits the short screen");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
});

test("dialog UX: tapping outside dismisses; the dialog ALWAYS fits fully on screen (every pad, 390+320)", async () => {
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 42 }); });

  // outside-tap dismiss: open on p3, then tap the HUD area (not the dialog)
  let rect = await page.locator(".td-canvas").boundingBox();
  let sp = await page.evaluate(() => window.__TD.w2s(9.5, 5.5));
  await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  await page.locator(".td-bubble").waitFor({ state: "visible" });
  await page.locator("#screen-td-play .td-hud").click();
  assert.ok(await page.locator(".td-bubble").isHidden(), "an outside tap dismisses the dialog");

  // fit-on-screen: open the dialog on EVERY pad at both widths; the bubble's
  // box must sit fully inside the viewport (edge pads used to hang half off).
  // We check the WIDEST rendered edge — the box AND any child — so an iOS-wide
  // emoji in the stats line can't spill past the right even if the box "fits".
  const widestEdges = () => page.evaluate(() => {
    const b = window.TDUI.bubble; const r = b.getBoundingClientRect();
    let left = r.left, right = r.right;
    b.querySelectorAll("*").forEach((el) => { const c = el.getBoundingClientRect(); if (c.width && c.height) { if (c.left < left) left = c.left; if (c.right > right) right = c.right; } });
    return { left, right };
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(250);
    const pads = await page.evaluate(() => window.__TD.engine().levelDef.pads.map((p) => ({ id: p.id, cx: p.cx, cy: p.cy })));
    for (const pad of pads) {
      rect = await page.locator(".td-canvas").boundingBox();
      sp = await page.evaluate((p) => window.__TD.w2s(p.cx + 0.5, p.cy + 0.5), pad);
      await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
      await page.locator(".td-bubble").waitFor({ state: "visible", timeout: 4000 });
      const e = await widestEdges();
      assert.ok(e.left >= -1 && e.right <= width + 1,
        `pad ${pad.id} BUILD dialog must fit at ${width}w (left=${Math.round(e.left)} right=${Math.round(e.right)})`);
      await page.locator("#screen-td-play .td-hud").click(); // dismiss for the next pad
    }
    // The WIDEST dialog is a tier-3 tower PANEL (branch cards + a stats line).
    // Build one on each edge pad and prove it (box AND ink) stays on screen —
    // this is the real portrait "off the right side" case.
    for (const line of ["fan", "mortar", "camp"]) {
      for (const padId of ["p1", "p8"]) { // top-right & right pads
        await page.evaluate((a) => { window.__TD.newGame(1, { seed: 7 }); window.__TD.grantGold(5000); window.__TD.script([["place", a.line, a.padId], ["upgrade", 0], ["upgrade", 0]]); }, { line, padId });
        const pad = pads.find((p) => p.id === padId);
        rect = await page.locator(".td-canvas").boundingBox();
        sp = await page.evaluate((p) => window.__TD.w2s(p.cx + 0.5, p.cy + 0.5), pad);
        await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
        await page.locator(".td-panel").waitFor({ state: "visible", timeout: 4000 });
        const e = await widestEdges();
        assert.ok(e.left >= -1 && e.right <= width + 1,
          `${line} tier-3 PANEL on ${padId} must fit at ${width}w (left=${Math.round(e.left)} right=${Math.round(e.right)})`);
        await page.locator("#screen-td-play .td-hud").click();
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
});

test("the level card says what the level DOES to you, and costs the grid nothing", async () => {
  // The loadout, the powers and the chips are all chosen on the fort home,
  // BEFORE you enter a level — so "this one is a night level" is exactly the cue
  // that says pack 🦉 Night Owl. TDLogic.levelGimmicks already derived it for the
  // Toybox Guide; it just was not where the decision is made.
  //
  // DERIVED, so a sixth mechanic appears here the moment it exists and a retired
  // one drops out. The comparison is computed IN THE PAGE, against the very
  // modules the page loaded, rather than against a second copy required here.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1") || '{"v":1}');
    raw.stars = { casual: {}, normal: {}, heroic: {} };
    for (const l of window.TDData.LEVELS) raw.stars.normal[String(l.id)] = 3;
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  // Seed -> RELOAD -> hop the hash: page.goto(url + "#hash") is a SAME-DOCUMENT
  // navigation, so it would never re-run module init and the seed above would be
  // invisible. And the hash has to be hopped explicitly — with a name pattern
  // this test does not inherit whatever screen a previous one left showing.
  await page.reload();
  await page.waitForFunction(() => !!window.__TD, null, { timeout: 8000 });
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home .td-level").first().waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(150);

  const got = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#screen-td-home .td-level")];
    if (!cards.length) return { cards: 0, levels: window.TDData.LEVELS.length, bad: ["no level cards rendered"], clash: [], withStrip: 0, gridH: 0, gridHidden: 0 };
    const bad = [], clash = [];
    let withStrip = 0;
    window.TDData.LEVELS.forEach((lv, i) => {
      const gs = window.TDLogic.levelGimmicks(lv);
      const t = cards[i] && cards[i].querySelector(".td-level__tricks");
      const n = cards[i] && cards[i].querySelector(".td-level__n");
      const icons = t ? t.textContent : null;
      const want = gs.length ? gs.map((g) => g.icon).join("") : null;
      if (icons !== want) bad.push(`L${lv.id}: want ${want} got ${icons}`);
      if (gs.length) {
        withStrip += 1;
        const wantLabel = gs.map((g) => g.name).join(", ");
        if (!t || t.getAttribute("aria-label") !== wantLabel) bad.push(`L${lv.id}: label ${t && t.getAttribute("aria-label")}`);
        if (t && n) {
          const a = t.getBoundingClientRect(), b = n.getBoundingClientRect();
          if (!(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)) clash.push(lv.id);
        }
      }
    });
    const grid = cards[0].parentElement;
    const gridH = Math.round(grid.getBoundingClientRect().height);
    // …and the A/B for layout cost, in the SAME state — the obvious baseline (a
    // fresh save) is mostly LOCKED cards and is not comparable, and that mistake
    // is exactly what hid the collision the clash check below now guards.
    const st = document.createElement("style");
    st.textContent = ".td-level__tricks{display:none!important}";
    document.head.appendChild(st);
    const gridHidden = Math.round(grid.getBoundingClientRect().height);
    st.remove();
    return { cards: cards.length, levels: window.TDData.LEVELS.length, bad, clash, withStrip, gridH, gridHidden };
  });

  assert.equal(got.cards, got.levels, "every shipped level has a card");
  assert.ok(got.withStrip >= 20,
    `fixture precondition: most levels carry a gimmick (${got.withStrip}) or this test proves little`);
  assert.deepEqual(got.bad, [], `a card disagrees with levelGimmicks: ${got.bad.join(" ; ")}`);
  // A first cut used an absolutely positioned corner badge; it measured free and
  // then COLLIDED with the level number at 320px on exactly the two 3-gimmick
  // levels. Sharing the number's flex row makes non-overlap structural.
  assert.deepEqual(got.clash, [], `a trick strip overlaps its level number on: ${got.clash.join(", ")}`);

  // …and the width that can actually FAIL. The corner-badge cut collided only at
  // 320px, so checking at 390 alone let its mutation pass — a viewport list IS
  // the test, and a clause that cannot fail is worse than no clause. The card is
  // narrowest here, which is exactly where a wide strip runs into the number.
  await page.setViewportSize({ width: 320, height: 800 });
  await page.waitForTimeout(150);
  const narrow = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#screen-td-home .td-level")];
    const clash = [], seen = [];
    window.TDData.LEVELS.forEach((lv, i) => {
      const t = cards[i] && cards[i].querySelector(".td-level__tricks");
      const n = cards[i] && cards[i].querySelector(".td-level__n");
      if (!t || !n) return;
      seen.push(lv.id);
      const a = t.getBoundingClientRect(), b = n.getBoundingClientRect();
      if (!(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)) clash.push(lv.id);
      const cb = cards[i].getBoundingClientRect();
      if (a.right > cb.right + 0.5 || a.left < cb.left - 0.5) clash.push(lv.id + "(escapes)");
    });
    return { clash, seen: seen.length };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(narrow.seen >= 20, `fixture precondition: the strips are still rendered at 320px (saw ${narrow.seen})`);
  assert.deepEqual(narrow.clash, [],
    `at 320px a trick strip overlaps or escapes its card on: ${narrow.clash.join(", ")}`);
  assert.equal(got.gridH, got.gridHidden,
    `the trick strip must add NO height to the 40-card grid (with ${got.gridH}px, without ${got.gridHidden}px)`);
  await page.evaluate(() => window.__TD.resetSave());
});

test("AUDIT badges: 🏃 Marathoner — the endless shape, awarded on the way OUT", async () => {
  // The last of the six earnAch wirings, and the fourth of four badges I had
  // filed as "expensive" that turned out cheap. An honest mixed board reaches
  // endless wave 20 comfortably — measured across 8 seeds in two arenas, every
  // one ran to the probe's own 26-wave cap rather than dying — which matters
  // because startLevel seeds an ordinary run from Date.now(), so this test gets
  // a RANDOM seed and would be a coin flip if survival were marginal.
  //
  // Its wiring is unlike every other badge: it is awarded when the run ENDS or
  // when you LEAVE (leavingPlay), never on a win — so the test has to walk out
  // of the arena to collect it.
  // THE SEED IS PINNED, and the reason is measured. It used to come from
  // Date.now() — the one non-deterministic input in an otherwise deterministic
  // suite — and this test duly failed in CI with "reached 3". Swept over 1200
  // seeds, this board DIES BEFORE WAVE 20 on 6 of them (0.50%), the worst at
  // wave 3, which is CI's signature exactly; another 1.2% survive on ≤3 lives.
  // So it was a genuine 1-in-200 coin flip. The comment this replaces claimed it
  // was "safe by measurement rather than by luck" on the strength of 8 seeds —
  // and 8 seeds cannot see a 0.5% rate. A sample has to be sized to the rate you
  // care about, or "measured" means nothing.
  // Seed 1066 finishes wave 21 with 20 of 20 lives, the most headroom in the
  // range scanned. The loop also breaks the moment a wave does not return to
  // build, because calling again while one is still walking STACKS waves
  // (TD-15 ⏩ RUSH) and that is the one path that could bury this board early.
  const out = await page.evaluate(() => {
    window.__TD.resetSave();
    window.__TD.startEndless("bedroom", { seed: 1066 });
    const pads = window.TDData.ENDLESS.arenas.bedroom.pads;
    const LINES = ["dart", "mortar", "fan", "dart"];
    let stalled = "";
    for (let w = 0; w < 24; w++) {
      const st = window.__TD.state();
      if (!st || st.phase === "lost" || st.waveIdx >= 21) break;
      window.__TD.script(pads.map((p, i) => ["place", LINES[i % LINES.length], p.id]));
      const ups = [];
      for (let i = 0; i < window.__TD.state().towers.length; i++) ups.push(["upgrade", i], ["upgrade", i]);
      window.__TD.script(ups);
      window.__TD.script([["call"], ["untilPhase", "build", 400000]]);
      const after = window.__TD.state();
      if (after.phase !== "build" && after.phase !== "lost") { stalled = "wave " + w + " never returned to build (phase " + after.phase + ")"; break; }
    }
    const st = window.__TD.state();
    const info = { reached: st.waveIdx, sent: st.sentIdx, phase: st.phase, lives: st.lives,
      towers: st.towers.length, seed: st.seed, difficulty: st.difficulty, cheated: !!st.cheated, stalled };
    window.__TD.leaveToHome();            // the real chokepoint that records it
    info.ach = window.__TD.ach();
    return info;
  });

  assert.equal(out.cheated, false, "fixture precondition: an honest run, or every award is suppressed");
  assert.equal(out.stalled, "", `fixture precondition: every wave must finish (${out.stalled})`);
  assert.ok(out.reached >= 20,
    "fixture precondition: the board must actually survive to wave 20 — " +
    `reached ${out.reached} (sent ${out.sent}, phase ${out.phase}, ${out.lives} lives, ` +
    `${out.towers} towers, seed ${out.seed}, ${out.difficulty})`);
  assert.ok(out.ach.includes("marathoner"),
    `reaching endless wave 20 must earn 🏃 Marathoner on the way out — got ${JSON.stringify(out.ach)}`);
});

test("AUDIT badges: 🧊 Ice Age and 🎯 Pea Purist — the two the HOOK was hiding", async () => {
  // Both were filed as "expensive" and both are cheap; measuring overturned my
  // own verdict twice. Neither was blocked by the game — each was blocked by
  // __TD.script skipping a side effect the real UI performs.
  //
  // 🧊 Ice Age is the one badge sampled PER FRAME rather than at an outcome, so
  // it needs NO win — only 20 bodies slowed at once on an honest run. A fan on
  // every pad, funded by the level's OWN start gold (place() refuses what you
  // cannot afford, so this is not a cheat — and cheating would suppress every
  // award), peaks at 23 slowed on L32 by wave 4, measured headlessly. Its
  // sampler used to live inline in loop(), which script() never runs.
  const ice = await page.evaluate(() => {
    window.__TD.resetSave();
    window.__TD.newGame(32);
    const L = window.TDData.LEVELS.find((l) => l.id === 32);
    for (let w = 0; w < 4; w++) {
      window.__TD.script(L.pads.map((p) => ["place", "fan", p.id]));
      const ups = [];
      // NOTE: script's upgrade op takes an INDEX into state.towers, never an id.
      for (let i = 0; i < window.__TD.state().towers.length; i++) ups.push(["upgrade", i], ["upgrade", i]);
      window.__TD.script(ups);
      window.__TD.script([["call"], ["untilPhase", "build", 200000]]);
    }
    const st = window.__TD.state();
    return { towers: st.towers.length, cheated: !!st.cheated, ach: window.__TD.ach() };
  });
  assert.ok(ice.towers >= 8, `fixture precondition: the level's own gold must fund a real fan board (built ${ice.towers})`);
  assert.equal(ice.cheated, false, "fixture precondition: an honest run, or every award is suppressed");
  assert.ok(ice.ach.includes("iceage"),
    `20 bodies slowed at once must earn 🧊 Ice Age — got ${JSON.stringify(ice.ach)}`);
  await page.evaluate(() => window.__TD.leaveToHome());

  // 🎯 Pea Purist reads cur.lines, which the UI's build handler writes and
  // e.place() does not — so a scripted dart-only win left it EMPTY and the badge
  // could never earn. L2 dart-only wins legitimately at 16 lives (measured).
  const pea = await page.evaluate(() => {
    window.__TD.resetSave();
    window.__TD.newGame(2);
    const L = window.TDData.LEVELS.find((l) => l.id === 2);
    for (let w = 0; w < 12 && window.__TD.state().phase !== "won" && window.__TD.state().phase !== "lost"; w++) {
      window.__TD.script(L.pads.map((p) => ["place", "dart", p.id]));
      const ups = [];
      for (let i = 0; i < window.__TD.state().towers.length; i++) ups.push(["upgrade", i], ["upgrade", i]);
      window.__TD.script(ups);
      window.__TD.script([["call"], ["untilPhase", "build", 200000]]);
    }
    const st = window.__TD.state();
    return { phase: st.phase, lines: window.__TD.ctx().lines, ach: window.__TD.ach() };
  });
  assert.equal(pea.phase, "won", "fixture precondition: a dart-only board must actually win L2");
  assert.deepEqual(pea.lines, ["dart"],
    `the hook must record the LINE it built, as the UI does — got ${JSON.stringify(pea.lines)}`);
  assert.ok(pea.ach.includes("peapurist"),
    `a darts-only L2 win must earn 🎯 Pea Purist — got ${JSON.stringify(pea.ach)}`);
  await page.evaluate(() => window.__TD.leaveToHome());
});

test("AUDIT badges: the three cheap UNDRIVEN wiring shapes actually award", async () => {
  // Enumerating ACHIEVEMENTS against the test sources found 14 of 19 named in no
  // test. They are not one shape: there are SIX wiring shapes and only two were
  // driven (a level-id badge via doorman, an event badge via firstblood), so a
  // passing suite said nothing about the other four.
  //
  // Scope is decided by a measured constraint rather than by taste: A BADGE TEST
  // CANNOT CHEAT. awardWinAchievements is skipped on a cheated run and
  // __TD.grantGold sets cheated, so the cost of driving a badge is the cost of
  // LEGITIMATELY winning the level it needs. That makes four of them genuinely
  // expensive (peapurist needs a darts-only L2, dysondenied an L8 win losing ≤3
  // soldiers, iceage 20 bodies slowed at once, marathoner endless wave 20) and
  // these three cheap — measured headlessly first, so the fixtures are known to
  // reach the states they claim rather than hoped to.
  const ach = () => page.evaluate(() => window.__TD.ach());

  // 1. RUN-CONTEXT (!cur.leaked). The CI plan on CASUAL finishes L1 at 20 of 20
  //    — zero leaks — while on normal it finishes at 16 and must NOT earn it.
  await page.evaluate(() => { window.__TD.resetSave(); return window.__TD.winL1(7, { difficulty: "casual" }); });
  const ctx = await page.evaluate(() => window.__TD.ctx());
  assert.equal(ctx && ctx.leaked, false, "fixture precondition: the casual run really leaked nothing");
  assert.ok((await ach()).includes("noleaks"), "a flawless win must earn 🛡️ No Leaks");
  await page.evaluate(() => window.__TD.leaveToHome());

  await page.evaluate(() => { window.__TD.resetSave(); return window.__TD.winL1(7); });
  assert.equal((await page.evaluate(() => window.__TD.ctx())).leaked, true,
    "fixture precondition: the same plan on normal DOES leak, so the negative below is real");
  assert.ok(!(await ach()).includes("noleaks"), "…and a win that leaked must NOT earn it");
  await page.evaluate(() => window.__TD.leaveToHome());

  // 2. RUN-CONTEXT (st.difficulty). Its own read, in its own clause.
  await page.evaluate(() => { window.__TD.resetSave(); return window.__TD.winL1(7, { difficulty: "heroic" }); });
  assert.ok((await ach()).includes("heroicheart"), "winning on heroic must earn 💀 Heroic Heart");
  await page.evaluate(() => window.__TD.leaveToHome());

  // 3. STAR TOTALS, the shape that matters most: the cap is LEVELS.length * 3,
  //    and CLAUDE.md records that a literal 36 would fire Full Fort a whole world
  //    early. Nothing proved that derivation was LIVE. Seeding one level short is
  //    what makes this falsifiable — with 40 levels a stale literal makes 119
  //    stars clear its cap and award wrongly.
  const seedStars = async (short) => {
    await page.evaluate((isShort) => {
      window.__TD.resetSave();
      const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
      raw.stars = { casual: {}, normal: {}, heroic: {} };
      const ids = window.TDData.LEVELS.map((l) => l.id);
      for (const id of ids) raw.stars.normal[String(id)] = 3;
      if (isShort) raw.stars.normal[String(ids[ids.length - 1])] = 2;
      localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
    }, short);
    await page.reload();
    await page.waitForFunction(() => !!window.__TD, null, { timeout: 8000 });
    const seeded = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
      return Object.values(raw.stars.normal).reduce((a, b) => a + b, 0);
    });
    await page.evaluate(() => window.__TD.winL1(7));
    const got = await page.evaluate(() => window.__TD.ach());
    await page.evaluate(() => window.__TD.leaveToHome());
    return { seeded, got };
  };

  const cap = await page.evaluate(() => window.TDData.LEVELS.length * 3);
  const full = await seedStars(false);
  assert.equal(full.seeded, cap, `fixture precondition: the seed must reach the ceiling (${full.seeded} vs ${cap})`);
  assert.ok(full.got.includes("starcollector"), "half the stars must earn ⭐ Star Collector");
  assert.ok(full.got.includes("fullfort"), "every star must earn 👑 Full Fort");

  const short = await seedStars(true);
  assert.equal(short.seeded, cap - 1, "fixture precondition: one star short of the ceiling");
  assert.ok(short.got.includes("starcollector"), "…still well past half");
  assert.ok(!short.got.includes("fullfort"),
    `one star short must NOT earn Full Fort — if it does, the ceiling is a stale literal rather than LEVELS.length * 3 (seeded ${short.seeded}, cap ${cap})`);
});

test("the victory screen says what the NEXT star would have taken", async () => {
  // Nothing in the fort has ever named RULES.stars, so a 2-star finish left you
  // guessing what the bar was — the same gap the ⬆ preview closed for upgrades,
  // where a decision was shown a price and not what it buys.
  //
  // Both branches are driven by REAL wins through the shipped hook rather than
  // by calling showVictory with a constructed argument, which cannot see its
  // producer break: the CI plan finishes L1 at 16 lives (2★, so the hint shows)
  // and the SAME plan on casual finishes at 19-20 (3★, where there is nothing
  // left to say). Measured headlessly first — an earlier reading of "19 lives"
  // was a different build entirely, and would have made this test exercise only
  // the absent branch while looking thorough.
  const read = async (opts) => {
    const phase = await page.evaluate((o) => {
      window.__TD.resetSave();
      return window.__TD.winL1(7, o || undefined);
    }, opts || null);
    assert.equal(phase, "won", `the plan must actually win (opts ${JSON.stringify(opts)})`);
    await page.locator(".td-overlay--win").waitFor({ state: "visible", timeout: 5000 });
    const out = await page.evaluate(() => {
      const st = window.__TD.state();
      const el = document.querySelector(".td-overlay__goal");
      return {
        stars: st.stars, lives: st.lives,
        goal: window.__TD.engine().starGoal(),
        text: el ? el.textContent : null,
      };
    });
    await page.evaluate(() => window.__TD.leaveToHome());
    return out;
  };

  const two = await read();
  assert.equal(two.stars, 2,
    `fixture precondition: the CI plan must finish L1 BELOW 3 stars or the hint never renders (got ${two.stars}★ at ${two.lives} lives)`);
  assert.ok(two.goal, "…so the engine must offer a next-star goal");
  assert.equal(two.text, (two.goal.need - two.lives) + " more for " + "⭐".repeat(two.goal.stars),
    `the hint must state the ENGINE's own numbers — got ${JSON.stringify(two.text)}`);

  const three = await read({ difficulty: "casual" });
  assert.equal(three.stars, 3,
    `fixture precondition: casual must reach 3 stars, or the absent branch is untested (got ${three.stars}★)`);
  assert.equal(three.goal, null, "…so there is no next star to name");
  assert.equal(three.text, null, "and the hint must be ABSENT at 3 stars, not an empty line");
});

test("a corrupt checkpoint meta cannot break Resume — it is guarded like its two neighbours", async () => {
  // `metaMods` opens with `new Set(meta || [])`, so an object/number/boolean
  // throws "is not iterable" inside createEngine, and a restored 💾 Backup is a
  // PASTE validated only as "parses, is an object, v === 1, stars is an object".
  // powers and chips on the same startLevel line were both Array.isArray-guarded
  // and meta was not — two siblings with a policy and one without, the same
  // smell that had meta reading the save while they read the run.
  //
  // THE FIXTURE IS THE HARD PART, and its first cut passed four clauses
  // VACUOUSLY. Hand-editing localStorage while a run is still parked does not
  // stick: the live module holds its own `save` and rewrites it, so every
  // corrupt value was replaced by the real one before the reload and Resume ran
  // against a perfectly healthy checkpoint. It only surfaced because the fifth
  // clause (an empty loadout) expected a value the clobber could contradict.
  // So the run is dropped by a reload FIRST, and the seed is then read back
  // after a second reload and asserted — a precondition that verifies itself
  // rather than one that is hoped for.
  const seed = async (m) => {
    await page.evaluate(() => {
      window.__TD.resetSave();
      window.__TD.newGame(1, { meta: ["lives"] });
      window.__TD.leaveToHome();            // a real checkpoint, written by the real chokepoint
    });
    await page.reload();                     // drop the live run, so nothing can rewrite the save
    await page.waitForFunction(() => !!window.__TD, null, { timeout: 8000 });
    await page.evaluate((mm) => {
      const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
      raw.midRun.meta = mm;
      localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
    }, m);
    await page.reload();
    await page.waitForFunction(() => !!window.__TD, null, { timeout: 8000 });
    return await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem("jon-td-save-v1") || "null");
      return raw && raw.midRun ? raw.midRun.meta : null;
    });
  };

  for (const bad of [{}, 7, true, "lives"]) {
    const landed = await seed(bad);
    assert.deepEqual(landed, bad,
      `fixture precondition: the corrupt meta ${JSON.stringify(bad)} must survive to the save, not be rewritten by the live run (found ${JSON.stringify(landed)})`);
    const out = await page.evaluate(() => {
      try { window.__TD.resume(); return { ok: true }; }
      catch (e) { return { ok: false, err: String(e && e.message) }; }
    });
    assert.ok(out.ok, `a checkpoint whose meta is ${JSON.stringify(bad)} must not throw on Resume — got ${out.err}`);
  }

  // …and an EMPTY loadout resumes as EMPTY, not as whatever is equipped now:
  // guarding this with powers' `&& .length` would fall back to activeLoadout()
  // and reintroduce the bug fixed one function up.
  const landedEmpty = await seed([]);
  assert.deepEqual(landedEmpty, [], "fixture precondition: the empty loadout reached the save");
  const empty = await page.evaluate(() => {
    window.__TD.resume();
    const st = window.__TD.state();
    return (st && st.meta) || null;
  });
  assert.deepEqual(empty, [], "an empty loadout must survive the resume as empty");
  await page.evaluate(() => window.__TD.resetSave());
});

test("the resume checkpoint carries the RUN's loadout, not whatever is equipped NOW", async () => {
  // writeMidRun's own comments say powers and chips must be read off the RUN
  // "so a loadout edited while a run is parked cannot retroactively rewrite the
  // run that is being restored" — and `meta` called activeLoadout(), which reads
  // the SAVE. Reachable in ordinary play: park a run, respec on the fort home,
  // resume, clear one wave, and phaseWatch rewrites the checkpoint with the NEW
  // loadout while the live engine is still running the old one. The next resume
  // then comes back a different run. Two of three siblings had the right policy.
  //
  // The fixture needs no seeding: a fresh save owns nothing, so activeLoadout()
  // is [] while this run is handed two nodes — the pre-fix value and the correct
  // one could not be further apart.
  const got = await page.evaluate(() => {
    window.__TD.resetSave();
    window.__TD.newGame(1, { meta: ["lives", "lives2"] });
    const live = (window.__TD.state().meta || []).slice();
    window.__TD.leaveToHome();          // the real chokepoint: leavingPlay -> writeMidRun
    const mr = window.__TD.midRun();
    return { live, saved: mr && mr.meta, lives: mr && mr.lives };
  });
  assert.deepEqual(got.live, ["lives", "lives2"],
    "fixture precondition: the run really was handed the two nodes");
  assert.deepEqual(got.saved, ["lives", "lives2"],
    `the checkpoint must carry the RUN's loadout — got ${JSON.stringify(got.saved)}, which is what the SAVE holds, not the run`);
  assert.equal(got.lives, 24,
    "…and the lives it restores are that loadout's total, so a resumed run cannot read '24 of 20'");
});

test("the victory screen counts stickers out of the run's OWN total, not a literal 20", async () => {
  // Shipped: `lives + " of 20 stickers kept safe"`. ❤️ Extra Hearts II starts a
  // run at 24, so a flawless win rendered "24 of 20 stickers kept safe" — a
  // number the meta layer had moved, printed literally, which is the same
  // defect as the panel showing 110 while the engine charged 99 and the hint
  // quoting RULES.chargePerWave to a 🔋 Spare Battery run.
  //
  // Two runs, because a single one is satisfied by any constant: the total must
  // MOVE with the loadout. That is the clause a literal cannot pass.
  const read = async (meta) => {
    await page.evaluate((m) => {
      window.__TD.resetSave();
      return window.__TD.winL1(7, { meta: m });
    }, meta);
    await page.locator(".td-overlay--win").waitFor({ state: "visible", timeout: 5000 });
    const txt = await page.locator(".td-overlay--win").textContent();
    const m = txt.match(/(\d+) of (\d+) stickers kept safe/);
    assert.ok(m, `the victory screen must state stickers kept — got ${JSON.stringify(txt.slice(0, 120))}`);
    await page.evaluate(() => window.__TD.leaveToHome());
    return { kept: +m[1], total: +m[2] };
  };
  const plain = await read([]);
  const hearts = await read(["lives", "lives2"]);

  assert.equal(plain.total, 20, "a vanilla run is still out of 20");
  assert.equal(hearts.total, 24, "…and an Extra Hearts II run is out of 24, not 20");
  assert.ok(hearts.kept <= hearts.total,
    `a run can never keep MORE stickers than it started with — read "${hearts.kept} of ${hearts.total}"`);
  assert.ok(plain.kept <= plain.total, `same for a vanilla run — read "${plain.kept} of ${plain.total}"`);
});

test("scripted victory via the shipped __TD hooks: the CI plan wins in-browser too", async () => {
  const before = await page.evaluate(() => {
    let josh = 0;
    for (let i = 0; i < localStorage.length; i++) if ((localStorage.key(i) || "").indexOf("josh-won-") === 0) josh++;
    return josh;
  });
  const phase = await page.evaluate(() => window.__TD.winL1(7));
  assert.equal(phase, "won", "the scripted L1 plan must win in the real browser");
  await page.locator(".td-overlay--win").waitFor({ state: "visible", timeout: 5000 });
  const starsText = await page.locator(".td-overlay__stars").textContent();
  assert.ok((starsText.match(/⭐/g) || []).length >= 1, "stars shown");
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1") || "null"));
  assert.ok(save && save.stars && save.stars.normal && save.stars.normal["1"] >= 1, "the win persisted to the run's difficulty ladder (normal)");
  const after2 = await page.evaluate(() => {
    let josh = 0;
    for (let i = 0; i < localStorage.length; i++) if ((localStorage.key(i) || "").indexOf("josh-won-") === 0) josh++;
    return josh;
  });
  assert.equal(after2, before, "a fort win must add ZERO kid star flags (isolation)");
  await page.evaluate(() => { document.querySelector('.td-overlay [data-act="continue"]').click(); });
  await page.locator("#screen-td-home").waitFor({ state: "visible", timeout: 8000 });
  const l1stars = await page.locator(".td-level").first().locator(".td-level__stars").textContent();
  assert.ok(l1stars.indexOf("⭐") === 0, "the fort map shows the earned stars");
});

test("defeat: neglect loses and the overlay offers a retry that restarts", async () => {
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const phase = await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 1 });
    return window.__TD.script([["call"], ["untilPhase", "lost", 400000]]);
  });
  assert.equal(phase, "lost", "a do-nothing run loses (fail states are real here)");
  await page.locator(".td-overlay--lose").waitFor({ state: "visible", timeout: 5000 });
  await page.evaluate(() => { document.querySelector('.td-overlay [data-act="retry"]').click(); });
  await page.waitForFunction(() => {
    const s = window.__TD.state();
    return s && s.phase === "build" && s.lives === 20;
  }, null, { timeout: 5000 });
});

test("pause freezes the sim; the speed toggle steps 1× → 2× → 3× → 1×", async () => {
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 3 }); });
  // resume the loop (newGame pauses for determinism; same-hash set is a no-op,
  // so hop away and back to re-fire the route → unpause)
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(100);
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.script([["call"]]); });
  const eng = () => page.evaluate(() => window.__TD.state().tick);
  await page.locator("#screen-td-play .td-pause").click();
  await page.locator(".td-overlay--pause").waitFor({ state: "visible" });
  const t1 = await eng();
  await page.waitForTimeout(350);
  const t2 = await eng();
  assert.equal(t1, t2, "paused = frozen ticks");
  await page.evaluate(() => { document.querySelector('.td-overlay [data-act="resume"]').click(); });
  await page.waitForFunction((t) => window.__TD.state().tick > t, t2, { timeout: 5000 });
  const speedBtn = page.locator("#screen-td-play .td-speed");
  await speedBtn.click();
  assert.equal(await speedBtn.textContent(), "2×", "speed steps to 2×");
  await speedBtn.click();
  assert.equal(await speedBtn.textContent(), "3×", "…and to 3× (TD-14 added the third step)");
  await speedBtn.click();
  assert.equal(await speedBtn.textContent(), "1×", "…then wraps back to 1×");
});

test("TD2 build menu: all four toy lines offered with prices; unaffordable options dim", async () => {
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 42 }); });
  const rect = await page.locator(".td-canvas").boundingBox();
  const sp = await page.evaluate(() => window.__TD.w2s(9.5, 5.5));
  await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  await page.locator(".td-buildmenu").waitFor({ state: "visible" });
  // DERIVED, like the level grid and the star ceiling: the menu must offer one
  // button per shipped tower line, with that line's real first-tier price. The
  // list used to be a literal `["dart","mortar","fan","camp"]` in td-main —
  // the same shape as the `TOTAL_PLANNED = 12` that left World 4 unreachable.
  const menu = await page.evaluate(() => ({
    shown: [...document.querySelectorAll(".td-buildmenu .td-buy")].map((b) => ({
      line: b.dataset.line, cost: Number(b.dataset.cost),
    })),
    lines: Object.keys(window.TDData.TOWERS).map((id) => ({
      line: id, cost: window.TDData.TOWERS[id].tiers[0].cost,
    })),
  }));
  assert.deepEqual(menu.shown, menu.lines,
    "the build menu offers one button per DATA.TOWERS line, at that line's real tier-1 price — " +
    "add a 5th line and it must become buyable without a code hunt");
  // …and the proof it is really DERIVED, baked in rather than left to an
  // external mutation: inject a fixture line and the menu must grow. On the old
  // literal it does not, which is precisely how a shipped 5th line would have
  // been unbuyable — the `TOTAL_PLANNED = 12` failure wearing a different hat.
  const grew = await page.evaluate(() => {
    const T = window.TDData.TOWERS;
    T.__fixture = { name: "Fixture", icon: "🧪", kind: "dart", role: "test only", hitsFliers: true,
      projectileSpeed: 9, tiers: [{ name: "Fixture", cost: 999, dmg: 1, dmgType: "bonk", rate: 2, range: 3 }] };
    return Object.keys(T).length;
  });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 42 }); });
  await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  await page.locator(".td-buildmenu").waitFor({ state: "visible" });
  const after = await page.locator(".td-buildmenu .td-buy").count();
  await page.evaluate(() => { delete window.TDData.TOWERS.__fixture; });
  assert.equal(after, grew,
    `a 5th tower line must appear in the build menu without touching td-main (saw ${after} of ${grew})`);
  // put the board back the way the rest of this test expects
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 42 }); });
  await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  await page.locator(".td-buildmenu").waitFor({ state: "visible" });
  const disabled = await page.locator('.td-buildmenu .td-buy[disabled]').count();
  assert.equal(disabled, 0, "everything is affordable at 220 start gold");
  // buy the camp — soldiers deploy
  await page.locator('.td-buildmenu .td-buy[data-line="camp"]').click();
  const st = await page.evaluate(() => window.__TD.state());
  assert.equal(st.towers[0].lineId, "camp", "the camp was placed from the menu");
  assert.equal(st.soldiers.filter((s) => s.alive).length, 3, "3 army guys deployed");
});

test("TD2 tower panel: upgrades lead to two branch cards; picking one becomes tier 4", async () => {
  await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 42 });
    window.__TD.script([["place", "dart", "p3"]]);
    window.__TD.grantGold(2000); // UI test: cheated-flag path is fine here
  });
  const rect = await page.locator(".td-canvas").boundingBox();
  const sp = await page.evaluate(() => window.__TD.w2s(9.5, 5.5));
  const openPanel = async () => {
    await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
    await page.locator(".td-panel").waitFor({ state: "visible" });
  };
  await openPanel();
  await page.locator(".td-up").click();      // t2
  await openPanel();
  await page.locator(".td-up").click();      // t3
  await openPanel();
  // DERIVED — the Dart offers three ultimates now, and a literal 2 is exactly
  // how a shipped branch becomes unreachable.
  const dartKeys = await page.evaluate(() => Object.keys(window.TDData.TOWERS.dart.branches));
  assert.equal(await page.locator(".td-branch").count(), dartKeys.length,
    `tier 3 must offer EVERY branch the line declares (${dartKeys.join("/")})`);
  for (const k of dartKeys) {
    assert.equal(await page.locator('.td-branch[data-b="' + k + '"]').count(), 1,
      `the ${k} branch needs a card of its own`);
  }
  await page.locator('.td-branch[data-b="a"]').click(); // Sniper Scope
  const t = await page.evaluate(() => window.__TD.state().towers[0]);
  assert.equal(t.tier, 4, "branched to tier 4");
  assert.equal(t.branch, "a");
  assert.equal(t.targeting, "strong", "the Sniper switches itself to Strong");
  await openPanel();
  const name = await page.locator(".td-panel__name").textContent();
  assert.ok(name.indexOf("Sniper") >= 0, "the panel shows the branch identity");
});

test("TD2 rally flow: 🚩 Rally arms the next field tap and moves the flag", async () => {
  await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 42 });
    window.__TD.script([["place", "camp", "p3"]]);
  });
  const rect = await page.locator(".td-canvas").boundingBox();
  const sp = await page.evaluate(() => window.__TD.w2s(9.5, 5.5));
  await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  await page.locator(".td-rally").waitFor({ state: "visible" });
  await page.locator(".td-rally").click();
  const before = await page.evaluate(() => {
    const t = window.__TD.state().towers[0];
    return { x: t.rallyX, y: t.rallyY };
  });
  // Plant the flag ~1.5 cells away. The reach is read from the DATA rather than
  // retyped here: the comment used to say "inside the 2.5 rally range" and went
  // stale the moment that value moved, which is the retyped-number class.
  const reach = await page.evaluate(() => window.TDData.TOWERS.camp.rallyRange);
  assert.ok(reach >= 1.6, `the fixture taps ~1.5 cells out, which must be inside the reach (${reach})`);
  const target = await page.evaluate(() => window.__TD.w2s(8, 4.2));
  await page.mouse.click(rect.x + target.x, rect.y + target.y);
  const after2 = await page.evaluate(() => {
    const t = window.__TD.state().towers[0];
    return { x: t.rallyX, y: t.rallyY };
  });
  assert.ok(Math.abs(after2.x - 8) < 0.3 && Math.abs(after2.y - 4.2) < 0.3,
    `the flag moved to the tapped spot (got ${after2.x.toFixed(2)},${after2.y.toFixed(2)})`);
  assert.ok(after2.x !== before.x || after2.y !== before.y, "the rally point actually changed");
});

test("fort daily-drive guardrails: topbar restore, pause-while-away, chaos taps, save-reload", async () => {
  // Promoted from the real-tap full audit — the regressions a daily player
  // would actually hit.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 9 }); window.__TD.script([["call"], ["tick", 100]]); });
  const midTick = await page.evaluate(() => window.__TD.state().tick);

  // leaving the fort restores the kid topbar and pauses the battle
  await page.evaluate(() => { location.hash = ""; });
  await page.locator("#screen-start").waitFor({ state: "visible" });
  assert.ok(await page.locator(".topbar").isVisible(), "the kid topbar returns when the fort is left");
  assert.ok(await page.evaluate(() => !document.body.classList.contains("td-mode")), "td-mode clears on exit");
  await page.waitForTimeout(350);
  const away = await page.evaluate(() => window.__TD.state().tick);
  assert.ok(away - midTick <= 2, `the battle pauses while away (tick ${midTick} → ${away})`);

  // returning resumes the same battle, topbar hides again
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.waitForFunction((t) => window.__TD.state().tick > t, away, { timeout: 5000 });
  assert.ok(await page.locator(".topbar").isHidden(), "topbar hidden inside the fort");

  // toddler chaos on Jon's controls: doubled CALL = ONE bonus; doubled buy = ONE charge.
  // CALL relabels itself to ⏩ RUSH the instant the wave starts, so a fumbled
  // double-tap MUST NOT dump a second wave — the engine's rushSettle window.
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 77 }); });
  const g0 = await page.evaluate(() => window.__TD.state().gold);
  await page.locator(".td-call").click();
  await page.locator(".td-call").click({ force: true }).catch(() => {});
  let s = await page.evaluate(() => window.__TD.state());
  assert.ok(s.phase === "wave" && s.gold - g0 <= 135, `doubled CALL grants one bonus (+${s.gold - g0})`);
  assert.equal(s.sentIdx - s.waveIdx, 1, "a fumbled double-tap must NOT rush a second wave onto the field");
  const rect = await page.locator(".td-canvas").boundingBox();
  const sp = await page.evaluate(() => window.__TD.w2s(5.5, 6.5));
  await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  await page.locator('.td-buildmenu .td-buy[data-line="dart"]').waitFor({ state: "visible" });
  const g1 = s.gold;
  await page.locator('.td-buildmenu .td-buy[data-line="dart"]').evaluate((el) => { el.click(); el.click(); });
  s = await page.evaluate(() => window.__TD.state());
  assert.equal(s.towers.filter((t) => t.lineId === "dart").length, 1, "doubled buy places ONE dart");
  assert.equal(g1 - s.gold, 70, "doubled buy charges ONCE");

  // the save survives a full reload
  const starsBefore = await page.evaluate(() => ((JSON.parse(localStorage.getItem("jon-td-save-v1") || "{}").stars || {}).normal || {})["1"] || 0);
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible", timeout: 8000 });
  const starsAfter = await page.evaluate(() => ((JSON.parse(localStorage.getItem("jon-td-save-v1") || "{}").stars || {}).normal || {})["1"] || 0);
  assert.equal(starsAfter, starsBefore, "jon-td-save-v1 survives a reload intact");
});

test("AUDIT UI: difficulty selection wires to the engine; panel stats, build roles & wave preview render", async () => {
  // Difficulty selector on the fort home — the engine supports casual/normal/
  // heroic; the choice must actually reach createEngine.
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(80);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  assert.equal(await page.locator(".td-diff .td-diffbtn").count(), 3, "three difficulty chips");
  assert.equal(await page.locator(".td-diff .td-diffbtn--on").count(), 1, "exactly one chip is active");
  // pick Hard, start L1, assert the engine got heroic
  await page.locator('.td-diffbtn[data-diff="heroic"]').click();
  assert.equal(await page.locator('.td-diffbtn[data-diff="heroic"]').getAttribute("aria-pressed"), "true", "Hard is now selected");
  await page.locator(".td-level").first().click();
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => window.__TD.state().difficulty), "heroic", "starting a level uses the chosen difficulty");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).difficulty), "heroic", "difficulty persisted to the save");

  // Premium-feel UI on a fresh normal game: build-menu roles, panel stats, wave preview.
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 42, difficulty: "normal" }); });
  const rect = await page.locator(".td-canvas").boundingBox();
  const sp = await page.evaluate(() => window.__TD.w2s(9.5, 5.5));
  await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  await page.locator(".td-buildmenu").waitFor({ state: "visible" });
  assert.equal(await page.locator(".td-buildmenu .td-buy__role").count(), 4, "each build option shows a ROLE label");
  const dartRole = await page.locator('.td-buy[data-line="dart"] .td-buy__role').textContent();
  assert.ok(dartRole && dartRole.trim().length > 0, "the dart role label has text (got '" + dartRole + "')");
  // buy a dart, open its panel, assert a stats line renders
  await page.locator('.td-buildmenu .td-buy[data-line="dart"]').click();
  await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  await page.locator(".td-panel").waitFor({ state: "visible" });
  const stats = await page.locator(".td-panel__stats").textContent();
  assert.ok(stats && /dps/.test(stats), "the tower panel shows a stats line with dps (got '" + stats + "')");
  await page.locator("#screen-td-play .td-hud").click(); // dismiss

  // next-wave preview visible during the build phase, with an enemy count
  const nw = page.locator(".td-nextwave");
  assert.ok(await nw.isVisible(), "the next-wave preview shows during build");
  const nwText = await nw.textContent();
  assert.ok(/\d/.test(nwText || ""), "the preview lists an enemy count (got '" + nwText + "')");

  // reset difficulty back to Normal so later runs use the shipped default
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(60);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.locator('.td-diffbtn[data-diff="normal"]').click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).difficulty), "normal", "difficulty reset to normal");
});

test("AUDIT UX: 🏠 mid-level asks before leaving — Keep playing stays, Leave quits (no lost progress by accident)", async () => {
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 7 }); window.__TD.script([["call"]]); }); // into a live wave
  await page.waitForTimeout(60);
  // tap Home → a confirm appears (no immediate navigation)
  await page.locator(".td-quit").click();
  await page.locator(".td-overlay--confirm").waitFor({ state: "visible", timeout: 4000 });
  assert.equal(await page.evaluate(() => location.hash), "#td-play", "tapping 🏠 does NOT leave immediately");
  assert.ok(await page.evaluate(() => window.__TD.state() && window.__TD.state().phase === "wave"), "the level is still live behind the confirm");
  // Keep playing → dismiss, stay on the level
  await page.locator('.td-overlay--confirm [data-act="no"]').click();
  await page.waitForTimeout(60);
  assert.equal(await page.locator(".td-overlay--confirm").count(), 0, "Keep playing closes the confirm");
  assert.equal(await page.evaluate(() => location.hash), "#td-play", "Keep playing keeps you in the level");
  // tap Home again → Leave → now it navigates to the fort
  await page.locator(".td-quit").click();
  await page.locator(".td-overlay--confirm").waitFor({ state: "visible", timeout: 4000 });
  await page.locator('.td-overlay--confirm [data-act="yes"]').click();
  await page.locator("#screen-td-home").waitFor({ state: "visible", timeout: 4000 });
  assert.equal(await page.evaluate(() => location.hash), "#td-home", "Leave returns to the fort");
});

test("QoL: the fort-home blurb DERIVES its roster claim instead of listing it", async () => {
  // It used to enumerate the roster in prose — "(splitters, armor, chargers,
  // ghosts, moles, shielded bots, fliers, soakers, jammers, greased runners,
  // spawners, padding, blaring stereos)" — while claiming to describe "the whole
  // toybox roster". Measured, that named 13 of 25 trick shapes: every enemy
  // shipped since went unmentioned. A prose list of 25 is unmaintainable, so it
  // is two derived numbers plus a pointer at the surface that DOES enumerate.
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible", timeout: 8000 });
  const before = await page.evaluate(() => {
    const E = window.TDData.ENEMIES, L = window.TDLogic;
    const ids = Object.keys(E);
    // Which keys COUNT as tricks is a product decision (it decides a number the
    // player reads), so it is read from its owner rather than copied here — the
    // copy went stale the moment a new presentational line was classified
    // correctly in the product, and turned this test red for being right.
    const tricks = L.rosterTricks();
    return { text: document.querySelector("#screen-td-home .td-note").textContent,
      bodies: ids.filter((k) => !E[k].skinOf).length, names: ids.length, tricks: tricks.size,
      lines: Object.keys(window.TDData.TOWERS).length };
  });
  assert.ok(before.bodies > 10 && before.tricks > 10, `fixture: a real roster (${before.bodies}/${before.tricks})`);
  assert.ok(before.text.includes(String(before.bodies)) && before.text.includes(String(before.names)),
    `the blurb must state the derived body and name counts (${before.bodies}/${before.names}) — saw ${JSON.stringify(before.text)}`);
  assert.ok(before.text.includes(before.tricks + " tricks"),
    `…and the derived trick count (${before.tricks}) — saw ${JSON.stringify(before.text)}`);
  assert.ok(before.text.includes(before.lines + " tower lines"),
    `…and the derived tower-line count (${before.lines})`);
  // The old prose list must be GONE, or a stale enumeration sits beside the
  // derived numbers contradicting them.
  assert.ok(!/blaring stereos|greased runners|shielded bots/.test(before.text),
    "the hand-written roster enumeration must not survive beside the derived counts");
  assert.match(before.text, /Guide/, "…and it points at the surface that DOES enumerate, derived from the same data");

  // The rendered note must literally CONTAIN what the owner produces, which is
  // what ties the shell to `UI.rosterBlurb` — the clauses above would be equally
  // happy with the same numbers hard-coded into the shell.
  const tied = await page.evaluate(() =>
    document.querySelector("#screen-td-home .td-note").textContent.includes(window.TDUI.rosterBlurb()));
  assert.ok(tied, "the blurb the home renders must be the one UI.rosterBlurb() builds");

  // SELF-PROVING, in BOTH directions, because a literal equal to today's count
  // satisfies every clause above. (The note lives in the screen SHELL, built
  // once and not re-rendered by renderLevelGrid, so the injections are checked
  // against the OWNER; that the shell reads the owner is pinned structurally in
  // site.test.js, which is the half a browser cannot see.)
  const moved = await page.evaluate(() => {
    const E = window.TDData.ENEMIES, L = window.TDLogic;
    const NOT = new Set(["plain", "home", "skin", "costumes", "boss"]);
    // ADD a body: the body and name counts must rise.
    E.__probe = { name: "Probe", icon: "🧪", hp: 10, speed: 1, bounty: 1, lives: 1 };
    const grown = window.TDUI.rosterBlurb();
    delete E.__probe;
    // REMOVE the sole carrier of some trick: the trick count must fall. Derived,
    // so it needs no enemy named here — and it is the only way to falsify the
    // trick number, since every trick the engine knows already has a carrier.
    const carriers = {};
    for (const k of Object.keys(E)) for (const t of L.enemyTraits(E[k])) {
      if (!NOT.has(t.key)) (carriers[t.key] = carriers[t.key] || []).push(k);
    }
    const solo = Object.entries(carriers).find(([, v]) => v.length === 1);
    const keep = solo ? E[solo[1][0]] : null;
    if (solo) delete E[solo[1][0]];
    const shrunk = solo ? window.TDUI.rosterBlurb() : null;
    if (solo) E[solo[1][0]] = keep;
    return { grown, shrunk, soloTrick: solo && solo[0], soloId: solo && solo[1][0] };
  });
  assert.ok(moved.grown.includes(String(before.bodies + 1)) && moved.grown.includes(String(before.names + 1)),
    `a new body must move the derived counts (${before.bodies} -> ${before.bodies + 1}) — saw ${JSON.stringify(moved.grown)}`);
  assert.ok(moved.soloTrick, "fixture: some trick must have exactly one carrier, or the trick count cannot be falsified");
  assert.ok(moved.shrunk.includes((before.tricks - 1) + " tricks"),
    `dropping "${moved.soloId}", the only carrier of "${moved.soloTrick}", must take the trick count to ` +
    `${before.tricks - 1} — saw ${JSON.stringify(moved.shrunk)}`);
});

test("QoL: an unearned badge is a GHOST of itself, not one of 16 identical padlocks", async () => {
  // 16 of the 19 cells wore the same 🔒, so the grid gave no hint of what any
  // badge IS until you had it — the defect Josh's Sticker Book already fixed
  // ("170 of 200 slots were the identical ❓") and never carried across.
  await page.evaluate(() => {
    const st = {}; for (let i = 1; i <= 16; i++) st[i] = 3;
    localStorage.setItem("jon-td-save-v1", JSON.stringify({ v: 1,
      stars: { normal: st, casual: {}, heroic: {} }, settings: {}, difficulty: "normal",
      meta: [], ach: ["doorman", "firstblood"], endlessBest: {}, midRun: null }));
  });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible", timeout: 8000 });
  await page.evaluate(() => window.TDUI.showAchievements(JSON.parse(localStorage.getItem("jon-td-save-v1"))));
  await page.waitForSelector(".td-achs", { timeout: 5000 });
  const m = await page.evaluate(() => {
    const names = {};
    for (const a of window.TDData.ACHIEVEMENTS) names[a.name] = a;
    const cells = [...document.querySelectorAll(".td-ach")].map((c) => {
      const ic = c.querySelector(".td-ach__icon");
      const def = names[c.querySelector(".td-ach__name").textContent];
      return { id: def && def.id, icon: def && def.icon, shown: ic.textContent,
        ghost: ic.classList.contains("td-ach__icon--ghost"),
        on: c.classList.contains("td-ach--on"),
        opacity: parseFloat(getComputedStyle(ic).opacity),
        filter: getComputedStyle(ic).filter,
        aria: c.getAttribute("aria-label") };
    });
    return { cells, locks: [...document.querySelectorAll(".td-achs")].map((g) => g.textContent).join("").split("🔒").length - 1 };
  });
  assert.ok(m.cells.length >= 12, `fixture: the whole grid rendered (${m.cells.length})`);
  const on = m.cells.filter((c) => c.on), off = m.cells.filter((c) => !c.on);
  assert.ok(on.length >= 1 && off.length >= 5, `fixture: a MIX of earned and locked (${on.length}/${off.length})`);
  assert.equal(m.locks, 0, "no badge cell may fall back to a padlock — every one shows its own icon");
  for (const c of m.cells) {
    assert.equal(c.shown, c.icon, `"${c.id}" must show its OWN icon, earned or not (saw ${JSON.stringify(c.shown)})`);
    // A `filter` on art rendered in bulk is this project's documented WebKit
    // rasterization cliff — the Sticker Book's 200 grayscale()d slots stalled CI
    // for over an hour. Opacity does the dimming.
    assert.ok(!c.filter || c.filter === "none",
      `"${c.id}"'s icon must not use a CSS filter (saw ${c.filter}) — that is the WebKit rasterization cliff`);
    // …and dropping the padlock dropped the only thing SAYING "locked", so the
    // state has to be in the accessible name instead.
    assert.ok(c.aria && new RegExp(c.on ? "earned" : "locked").test(c.aria),
      `"${c.id}" must say it is ${c.on ? "earned" : "locked"} (saw ${JSON.stringify(c.aria)})`);
  }
  // A separation, not a pinned constant: a ghost is clearly dimmer than an
  // earned icon and still visible.
  const ghostOp = off[0].opacity, onOp = on[0].opacity;
  assert.ok(off.every((c) => c.ghost) && on.every((c) => !c.ghost),
    "exactly the unearned icons are ghosted");
  assert.ok(ghostOp > 0.1, `a ghost must still be visible (opacity ${ghostOp})`);
  assert.ok(ghostOp < onOp * 0.6,
    `…and clearly secondary to an earned icon (${ghostOp} vs ${onOp})`);
  await page.evaluate(() => { window.TDUI.closeOverlay(); window.__TD.resetSave(); });
  await page.waitForTimeout(60);
});

test("QoL: a countable badge says how CLOSE you are, and its bar is the award site's", async () => {
  // Three of the 19 badges have a countable target, and the grid showed a
  // player at 58 of 60 stars exactly what it showed one at 3. Same law as the
  // victory screen's star goal: a number you are being scored on should be
  // visible rather than inferred. The DENOMINATORS have to be the award site's
  // own thresholds, derived from the shipped level count — a literal 60/120
  // went stale the moment World 4 raised the ceiling.
  const open = async (beat, best, ach) => {
    await page.evaluate((arg) => {
      const stars = {};
      for (let i = 1; i <= arg.beat; i++) stars[i] = 3;
      localStorage.setItem("jon-td-save-v1", JSON.stringify({ v: 1,
        stars: { normal: stars, casual: {}, heroic: {} }, settings: {}, difficulty: "normal",
        meta: [], ach: arg.ach, endlessBest: arg.best, midRun: null }));
    }, { beat, best, ach: ach || ["doorman"] });
    await page.reload({ waitUntil: "load" });
    await page.evaluate(() => { location.hash = "#__renav"; });
    await page.waitForTimeout(40);
    await page.evaluate(() => { location.hash = "#td-home"; });
    await page.locator("#screen-td-home").waitFor({ state: "visible", timeout: 8000 });
    await page.evaluate(() => window.TDUI.showAchievements(JSON.parse(localStorage.getItem("jon-td-save-v1"))));
    await page.waitForSelector(".td-achs", { timeout: 5000 });
    const out = await page.evaluate(() => {
      const by = {};
      const names = {};
      for (const a of window.TDData.ACHIEVEMENTS) names[a.name] = a.id;
      for (const c of document.querySelectorAll(".td-ach")) {
        const id = names[c.querySelector(".td-ach__name").textContent];
        const prog = c.querySelector(".td-ach__prog");
        by[id] = { prog: prog ? prog.textContent : null, on: c.classList.contains("td-ach--on") };
      }
      return { by, cap: window.TDData.LEVELS.length * 3 };
    });
    await page.evaluate(() => window.TDUI.closeOverlay());
    return out;
  };

  const a = await open(16, { bedroom: 14 });
  const half = Math.round(a.cap / 2);
  assert.equal(a.by.starcollector.prog, 16 * 3 + "/" + half,
    `Star Collector must count the stars you actually have against the award's own bar (saw ${a.by.starcollector.prog})`);
  assert.equal(a.by.fullfort.prog, 16 * 3 + "/" + a.cap,
    `Full Fort's bar is the derived ceiling, never a literal (saw ${a.by.fullfort.prog})`);
  assert.equal(a.by.marathoner.prog, "14/20",
    `Marathoner counts your best endless wave (saw ${a.by.marathoner.prog})`);
  // A SECOND seed, because a hard-coded "48/60" satisfies every clause above.
  // It also seeds a COUNTABLE badge as earned, which is the only way to test
  // that an earned one drops its count: the first version of this clause used
  // Doorman, which is not countable at all, so `progress[id]` was undefined
  // whether or not the earned check existed and the mutation sailed through.
  const b = await open(7, {}, ["doorman", "fullfort"]);
  assert.ok(b.by.fullfort.on, "fixture: a COUNTABLE badge is seeded as earned");
  assert.equal(b.by.fullfort.prog, null,
    "an earned badge must not wear a progress count — once you have it the number is noise");
  assert.equal(b.by.starcollector.prog, 7 * 3 + "/" + half,
    `the count must MOVE with the save (saw ${b.by.starcollector.prog})`);
  assert.notEqual(b.by.starcollector.prog, a.by.starcollector.prog, "…and the two seeds must differ");
  // No endless run at all: "0 of 20" before you have opened an arena is a bar,
  // not progress.
  assert.equal(b.by.marathoner.prog, null,
    `with no endless run recorded, Marathoner shows no progress (saw ${b.by.marathoner.prog})`);
  await page.evaluate(() => { window.__TD.resetSave(); });
  await page.waitForTimeout(60);
});

test("QoL: a level card SAYS what it is — and its star count is the save's, not the glyphs'", async () => {
  // A button with no aria-label is announced as its concatenated textContent,
  // and here that was "1🕳️Under the Bed●●●⭐⭐⭐🥵" for all 40 cards. That is not
  // merely unhelpful: the unearned stars and pips are DIM, not absent, so a
  // 2-of-3 level announced "star star star" — the label was WRONG, the same
  // defect the difficulty chips had when their two lines concatenated to
  // "⚔️ Normal24/40".
  await page.evaluate(() => {
    localStorage.setItem("jon-td-save-v1", JSON.stringify({ v: 1,
      // deliberately MIXED: a 3, a 2, a 1 and a 0. A save that is 3★ everywhere
      // cannot separate "counts the glyphs" from "counts the save" — the whole
      // defect is invisible at a full house.
      stars: { normal: { 1: 3, 2: 3, 3: 2, 4: 3, 5: 1, 6: 3, 7: 2 }, casual: {}, heroic: {} },
      settings: {}, difficulty: "normal", meta: [], ach: [], endlessBest: {},
      chipsWon: { 1: ["nofan"] }, midRun: null }));
  });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home .td-level").first().waitFor({ state: "visible", timeout: 8000 });
  const cards = await page.evaluate(() => {
    const D = window.TDData, L = window.TDLogic;
    const saved = (JSON.parse(localStorage.getItem("jon-td-save-v1")).stars || {}).normal || {};
    return [...document.querySelectorAll("#screen-td-home .td-level")].map((c, i) => {
      const n = i + 1, def = D.LEVELS.find((l) => l.id === n);
      return { n, aria: c.getAttribute("aria-label"), locked: !!c.disabled,
        stars: saved[String(n)] | 0, name: def ? def.name : "",
        boss: !!(def && def.waves.some((w) => w.boss)),
        tricks: def ? L.levelGimmicks(def).map((g) => g.name) : [] };
    });
  });
  assert.equal(cards.length, await page.evaluate(() => window.TDData.LEVELS.length), "fixture: the whole grid rendered");
  const mixed = cards.filter((c) => !c.locked).map((c) => c.stars);
  assert.ok(new Set(mixed).size >= 3,
    `fixture: the seed must give DIFFERENT star counts, or "counts the glyphs" and "counts the save" agree (saw ${JSON.stringify(mixed)})`);
  for (const c of cards) {
    assert.ok(c.aria, `level ${c.n}'s card must carry an accessible name — its textContent is a run-on of glyphs`);
    assert.ok(c.aria.includes("Level " + c.n), `level ${c.n}'s label must name the level (saw ${JSON.stringify(c.aria)})`);
    if (c.locked) {
      assert.match(c.aria, /locked/i, `a locked card must say so (level ${c.n}: ${JSON.stringify(c.aria)})`);
      continue;
    }
    assert.ok(c.aria.includes(c.name), `level ${c.n} must be named "${c.name}" (saw ${JSON.stringify(c.aria)})`);
    // THE CLAIM: the number announced is the SAVE's, not the three glyphs drawn.
    assert.ok(c.aria.includes(c.stars + " of 3 stars"),
      `level ${c.n} has ${c.stars} stars on this ladder and its label must say so — ${JSON.stringify(c.aria)}`);
    for (const t of c.tricks) {
      assert.ok(c.aria.includes(t), `level ${c.n}'s label must name its "${t}" trick in words, not only as an icon`);
    }
    if (c.boss) assert.match(c.aria, /boss/i, `level ${c.n} is a boss finale and its label must say so`);
  }
  // …and a locked card names the level it is waiting on, rather than "win 8 star".
  const firstLocked = cards.find((c) => c.locked && c.n > 1);
  assert.ok(firstLocked, "fixture: the seed must leave something locked");
  assert.ok(firstLocked.aria.includes("Win level " + (firstLocked.n - 1)),
    `a locked card must state the rule (saw ${JSON.stringify(firstLocked.aria)})`);
  await page.evaluate(() => { window.__TD.resetSave(); });
  await page.waitForTimeout(60);
});

test("AUDIT progression: beating a level UNLOCKS the next (the 'level 2 never unlocked' bug)", async () => {
  // fresh fort → L2 locked and NOT tappable
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = "#__renav"; });
  await page.waitForTimeout(50);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  assert.ok(await page.evaluate(() => document.querySelectorAll(".td-level")[1].classList.contains("td-level--locked")), "L2 locked before L1 is beaten");
  assert.equal(await page.evaluate(() => document.querySelectorAll(".td-level")[1].disabled), true, "L2 not tappable yet");

  // beat L1 with the shipped, un-cheated winning plan
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const res = await page.evaluate(() => window.__TD.winL1(7));
  assert.equal(res, "won", "the CI plan beats L1");
  await page.locator(".td-overlay--win").waitFor({ state: "visible", timeout: 4000 });
  assert.equal(await page.locator('.td-overlay--win [data-act="next"]').count(), 1, "victory offers a Next-level button");
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).stars.normal["1"] >= 1), "the L1 star persisted (real, not cheated)");

  // back to the fort → L2 is now unlocked AND tappable, and starts level 2
  await page.locator('.td-overlay--win [data-act="continue"]').click();
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  assert.ok(!(await page.evaluate(() => document.querySelectorAll(".td-level")[1].classList.contains("td-level--locked"))), "beating L1 UNLOCKS L2");
  await page.locator(".td-level").nth(1).click();
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => window.__TD.state().levelId), 2, "tapping the unlocked L2 starts level 2");
  // tidy: reset so later tests start clean
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("QoL: ▶ Next names where it goes, and only claims an unlock that just happened", async () => {
  // ▶ Next is the ONE entry into a level that skips the fort home — where the
  // ⭐ loadout, 🎒 powers and 🎖️ chips are chosen and where the card says what
  // the level DOES to you — and it said only "Next level". And the
  // "🔓 unlocked!" line was gated on "does a next level exist", so replaying a
  // level you beat hours ago announced its unlock all over again.
  const next2 = await page.evaluate(() => window.TDData.LEVELS.find((l) => l.id === 2).name);
  const win = async () => {
    await page.evaluate(() => { location.hash = "#td-play"; });
    await page.locator("#screen-td-play").waitFor({ state: "visible", timeout: 8000 });
    const r = await page.evaluate(() => window.__TD.winL1(7));
    assert.equal(r, "won", "fixture: the shipped plan beats L1");
    await page.locator(".td-overlay--win").waitFor({ state: "visible", timeout: 6000 });
    return page.evaluate(() => {
      const b = document.querySelector('.td-overlay--win [data-act="next"]');
      const w = document.querySelector(".td-overlay--win .td-overlay__warn");
      return { label: b ? b.textContent : null, aria: b ? b.getAttribute("aria-label") : null,
        unlock: w ? w.textContent : "" };
    });
  };
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = "#__renav"; });
  await page.waitForTimeout(50);

  const first = await win();
  assert.ok(first.label && first.label.includes("2") && first.label.includes(next2),
    `▶ Next must name the level it goes to (saw ${JSON.stringify(first.label)}, expected "${next2}")`);
  assert.ok(first.aria && first.aria.includes(next2),
    `…and say it in WORDS for a screen reader, not only in icons (saw ${JSON.stringify(first.aria)})`);
  assert.match(first.unlock, /unlocked/,
    "a FIRST win really does unlock the next level, so it says so");

  // …and the same win, replayed. Nothing new is unlocked this time.
  await page.locator('.td-overlay--win [data-act="continue"]').click();
  await page.locator("#screen-td-home").waitFor({ state: "visible", timeout: 8000 });
  const again = await win();
  assert.ok(again.label && again.label.includes(next2),
    "…the button still names where it goes on a replay");
  assert.ok(!/unlocked/.test(again.unlock),
    `replaying a level you already beat must NOT announce its unlock again (saw ${JSON.stringify(again.unlock)})`);
  await page.locator('.td-overlay--win [data-act="continue"]').click();
  await page.locator("#screen-td-home").waitFor({ state: "visible", timeout: 8000 });

  // The trick strip is DERIVED, so it must appear for a level that HAS one.
  // Rendered directly, because legitimately winning the level BEFORE a
  // gimmick level costs a bespoke winning plan for one string.
  const tricky = await page.evaluate(() => {
    const lv = window.TDData.LEVELS.find((l) => window.TDLogic.levelGimmicks(l).length);
    if (!lv) return null;
    window.TDUI.showVictory(3, 20, 20, null, { nextLevel: lv.id, nextIsNew: false, continueOn: () => {}, onNext: () => {} }, null, []);
    const b = document.querySelector('.td-overlay--win [data-act="next"]');
    const g = window.TDLogic.levelGimmicks(lv);
    const out = { label: b ? b.textContent : null, aria: b ? b.getAttribute("aria-label") : null,
      icons: g.map((x) => x.icon), names: g.map((x) => x.name), name: lv.name };
    window.TDUI.closeOverlay();
    return out;
  });
  assert.ok(tricky, "fixture: some level carries a gimmick");
  for (const ic of tricky.icons) {
    assert.ok(tricky.label.includes(ic),
      `▶ Next must carry the same derived trick strip the level card does (missing ${ic} for "${tricky.name}")`);
  }
  for (const nm of tricky.names) {
    assert.ok(tricky.aria.includes(nm), `…and name it in words (missing "${nm}")`);
  }

  // THE FOLD. This overlay is the one a third tier-4 branch row was rejected
  // for (+111px, past the fold at 320x480), and the label just grew: measured,
  // the longest possible ▶ Next wraps the button 56 -> 66px and the box
  // 439 -> 449, leaving 15px of a 480-tall screen. Worst case is DERIVED — the
  // level with the longest label, a 2-star finish so the star-goal line is
  // present, a full run summary and a badge — so a new gimmick or a long level
  // name in world 11 turns this red instead of quietly pushing a button off.
  await page.setViewportSize({ width: 320, height: 480 });
  await page.waitForTimeout(60);
  const fold = await page.evaluate(() => {
    const L = window.TDData.LEVELS, G = window.TDLogic.levelGimmicks;
    let best = null, bl = -1;
    for (const lv of L) {
      const n = ("" + lv.id + lv.name).length + (lv.waves.some((x) => x.boss) ? 2 : 0) + G(lv).length * 2;
      if (n > bl) { bl = n; best = lv; }
    }
    window.TDUI.showVictory(2, 14, 20, { need: 18, stars: 3 },
      { nextLevel: best.id, nextIsNew: true, continueOn: () => {}, onNext: () => {} },
      { rows: [{ label: "🎯 Dart", pct: 62 }, { label: "💥 Mortar", pct: 38 }], kills: 431, gold: 2210, towers: 11, spent: 1980, best: 17 },
      [{ icon: "🏅", html: "<b>Badge earned!</b><br>Doorman" }]);
    const box = document.querySelector(".td-overlay--win .td-overlay__box");
    const r = box.getBoundingClientRect();
    const out = { scrollH: box.scrollHeight, clientH: box.clientHeight,
      scrolls: box.scrollHeight > box.clientHeight,
      level: best.name };
    window.TDUI.closeOverlay();
    return out;
  });
  // Measure the CONTENT against the box, not the box against the screen. The
  // box is centred and capped at `calc(100dvh - 24px)`, so its BOTTOM can never
  // pass the viewport however tall the content gets — it just recentres and then
  // scrolls. A `bottom <= innerHeight` clause is therefore a quantity the CSS
  // guarantees rather than the property, and it survived a 60px mutation
  // (455 -> 468 of 480, still passing). The real claim is that the whole thing
  // is VISIBLE at once here: content 425 of a 456 cap, 31px of headroom.
  assert.ok(!fold.scrolls,
    `the worst-case victory screen must fit 320x480 without scrolling — "${fold.level}" needs ` +
    `${fold.scrollH}px in a ${fold.clientH}px box`);
  // NOT asserted here: that the wrapped button keeps its siblings' width. It is
  // a DIRECT child of a column flex box, so `align-items: stretch` guarantees it
  // — a `width: fit-content` mutation changes nothing — and an unfalsifiable
  // clause is worse than none. The real risk (a NESTED button escaping the
  // column) is owned by "every stacked button in an overlay shares a width".
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("kid-world isolation: the registry, home grid and 华丽 are untouched by the fort", async () => {
  const reg = await page.evaluate(() => ({
    total: (window.JoshGames || []).length,
    tdLeaks: (window.JoshGames || []).filter((g) => /td/.test(g.id)).length,
  }));
  assert.equal(reg.total, 240, "registry still exactly 240 (200 Josh + 40 华丽)");
  assert.equal(reg.tdLeaks, 0, "no fort entries leak into the kid registry");
  await page.evaluate(() => { location.hash = "#home"; });
  await page.locator("#screen-home").waitFor({ state: "visible" });
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("td-mode"))), "Josh's home is never fort-themed");
});

test("mobile sanity: fort screens fit EVERY device — no horizontal overflow, no vertical scroll on the field", async () => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const hash of ["#td-home", "#td-play"]) {
      await page.evaluate((h) => { location.hash = h; }, hash);
      await page.waitForTimeout(300);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 1, `${hash} overflows by ${over}px at ${width}w`);
    }
  }
  // the play field must fit WITHOUT vertical scrolling on real device sizes
  // (SE, iPhone, Pro Max, landscape) — the whole game on one screen.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  for (const vp of [[375, 667], [390, 844], [430, 932], [844, 390]]) {
    await page.setViewportSize({ width: vp[0], height: vp[1] });
    await page.waitForTimeout(300);
    const vScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    assert.ok(vScroll <= 1, `#td-play scrolls vertically by ${vScroll}px at ${vp[0]}×${vp[1]}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
});

test("a fresh level never inherits the previous level's boss banner", async () => {
  // Found by a screenshot: switching from a boss level (banner up) to a new
  // level left the stale klaxon showing. startLevel() must clear it.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => {
    window.__TD.newGame(8, { seed: 7 });
    const el = document.querySelector("#screen-td-play .td-banner");
    el.hidden = false; el.textContent = "⚠ Vacuum King incoming!"; // simulate a live boss klaxon
  });
  await page.evaluate(() => { window.__TD.newGame(6, { seed: 7 }); }); // start a DIFFERENT level
  const cleared = await page.evaluate(() => {
    const el = document.querySelector("#screen-td-play .td-banner");
    return el.hidden === true;
  });
  assert.ok(cleared, "starting a fresh level must hide any lingering boss banner");
});

test("TD5 star tree: buying a node persists to save.meta and feeds the next run; respec clears it", async () => {
  // grant plenty of stars so nodes are affordable, then open the tree from home
  await page.evaluate(() => {
    window.__TD.resetSave();
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    // seed a LEGACY flat map on purpose — the reload below must migrate it into
    // the normal ladder (36 ⭐ best-across), proving the boot migration path
    raw.stars = {}; for (let i = 1; i <= 12; i++) raw.stars[i] = 3;
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
    location.hash = "#__renav";
  });
  await page.waitForTimeout(50);
  await page.reload({ waitUntil: "load" }); // reload so the fort re-reads the seeded save
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.locator(".td-tree-open").click();
  await page.locator(".td-tree").waitFor({ state: "visible" });
  // DERIVED, not a literal: this said "23" and went stale the moment the tree
  // grew by breadth — the same counting law that caught the level grid.
  const nodeCount = await page.evaluate(() => window.TDData.META_NODES.length);
  assert.equal(await page.locator(".td-node").count(), nodeCount, `${nodeCount} star-tree nodes`);
  assert.equal(await page.locator(".td-tree__branch").count(), 3, "3 branch headers");
  // rank gating: Sharp Darts II is locked until Sharp Darts I is owned
  assert.ok(await page.locator('.td-node[data-node="dartdmg2"]').isDisabled(), "rank II starts locked");
  await page.locator('.td-node[data-node="dartdmg"]').click();
  assert.ok(!(await page.locator('.td-node[data-node="dartdmg2"]').isDisabled()), "owning rank I unlocks rank II");
  await page.locator('.td-node[data-node="dartdmg2"]').click();
  // capstone gating: Boss Bonker needs ⭐8 spent INSIDE Firepower (6 so far)
  assert.ok(await page.locator('.td-node[data-node="bossdmg"]').isDisabled(), "capstone locked below ⭐8 branch spend");
  await page.locator('.td-node[data-node="mortarsplash"]').click(); // fire spend 9 ≥ 8
  assert.ok(!(await page.locator('.td-node[data-node="bossdmg"]').isDisabled()), "capstone opens at ⭐8 branch spend");
  await page.locator('.td-node[data-node="bossdmg"]').click();
  let meta = await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).meta);
  assert.ok(meta.includes("bossdmg"), "the capstone persisted to save.meta");
  // cascade refund: refunding rank I also drops rank II AND the capstone whose
  // branch spend fell below its requirement
  await page.locator('.td-node[data-node="dartdmg"]').click();
  meta = await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).meta);
  assert.ok(!meta.includes("dartdmg") && !meta.includes("dartdmg2"), "refunding rank I cascades to rank II");
  assert.ok(!meta.includes("bossdmg"), "the capstone falls with its branch spend");
  // buy Piggy Bank → it flows into a fresh run as +40 start gold
  await page.locator('.td-node[data-node="startgold"]').click();
  meta = await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).meta);
  assert.ok(meta.indexOf("startgold") >= 0, "buying a node writes it to save.meta");
  const gold = await page.evaluate(() => { window.__TD.newGame(1, { seed: 7 }); return window.__TD.state().gold; });
  assert.equal(gold, 260, "Piggy Bank gives L1 220+40 start gold");
  // respec clears the whole tree
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator(".td-tree-open").click();
  await page.locator(".td-tree-respec").click();
  meta = await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).meta);
  assert.equal(meta.length, 0, "respec refunds every node (free)");
  await page.locator(".td-tree-done").click();
});

test("TD5 badges + endless: every badge, and every WORLD gets an endless row", async () => {
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.locator(".td-ach-open").click();
  await page.locator(".td-achgrid").waitFor({ state: "visible" });
  const badgeCount = await page.evaluate(() => window.TDData.ACHIEVEMENTS.length);
  assert.equal(await page.locator(".td-ach").count(), badgeCount, `one cell per shipped badge (${badgeCount})`);
  await page.locator(".td-ach-done").click();
  // Seed 3⭐ on EVERY shipped level so every world's row is unlocked — the
  // point of this half is that each world has a row and each row runs its own
  // map, which needs the newest world open too.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1")) || { v: 1 };
    raw.stars = raw.stars || {};
    const ladder = raw.stars.normal = raw.stars.normal || {};
    window.TDData.LEVELS.forEach((l) => { ladder[l.id] = 3; });
    raw.difficulty = "normal";
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.locator(".td-endless-open").click();
  await page.locator(".td-endlesspick").waitFor({ state: "visible" });
  const openCount = await page.locator(".td-endless:not(.td-endless--locked)").count();
  assert.ok(openCount >= 1, "at least one endless world is unlocked at 3⭐");
  // DERIVED, not a literal: the attic arena existed in the data and was
  // unreachable because this picker named three worlds by hand.
  const worlds = await page.evaluate(() => Object.keys(window.TDData.ENDLESS.worlds));
  assert.equal(await page.locator(".td-endless").count(), worlds.length,
    `one row per endless world (${worlds.join(", ")})`);
  for (const w of worlds) {
    assert.equal(await page.locator(`.td-endless[data-world="${w}"]`).count(), 1, `${w} has a row`);
  }
  // and the newest one really runs, on ITS OWN map (it used to silently fall
  // back to the bedroom arena, which has a different lane)
  const last = worlds[worlds.length - 1];
  await page.locator(`.td-endless[data-world="${last}"]`).click();
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const st = await page.evaluate(() => ({ endless: window.__TD.state().endless, path: window.__TD.engine().levelDef.path }));
  assert.ok(st.endless === true, "an endless run is live");
  const want = await page.evaluate((w) => window.TDData.ENDLESS.arenas[w].path, last);
  assert.deepEqual(st.path, want, `${last} endless runs on its OWN arena`);
});

test("QoL: the backup dialog can actually COPY the thing it tells you to copy", async () => {
  // Its own first instruction is "Copy this text somewhere safe" and there was
  // no way to copy it — hand-selecting a scrolling textarea on a phone is
  // exactly the fiddle this removes. And on THIS dialog "did that work?" is the
  // difference between having a backup and believing you have one, so the copy
  // has to confirm.
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.click("#screen-td-home .td-backup-open");
  await page.locator(".td-overlay--backup").waitFor({ state: "visible" });
  try {
    // 1. the Clipboard API path: the SAVE text reaches it, verbatim
    const api = await page.evaluate(async () => {
      const seen = [];
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: (t) => { seen.push(t); return Promise.resolve(); } },
      });
      const box = document.querySelector(".td-backup__box");
      document.querySelector(".td-backup-copy").click();
      await new Promise((r) => setTimeout(r, 30));
      const msg = document.querySelector(".td-backup__msg");
      return { wrote: seen, want: box.value, msg: msg.hidden ? null : msg.textContent.trim(),
        cls: msg.className };
    });
    assert.equal(api.wrote.length, 1, "one copy per tap");
    assert.ok(api.want.length > 20 && api.want.startsWith("{"), `fixture: the box holds a real save (${api.want.slice(0, 30)}…)`);
    assert.equal(api.wrote[0], api.want, "what is copied is exactly what the box shows");
    assert.ok(api.msg && /copied/i.test(api.msg), `…and it says so (saw ${JSON.stringify(api.msg)})`);
    assert.match(api.cls, /--ok/, "…as a success, not a warning");

    // 2. the FALLBACK path, for an older WebKit or a non-secure context where
    //    navigator.clipboard simply is not there. Josh's iPad floor is exactly
    //    the sort of place that matters.
    const fb = await page.evaluate(async () => {
      // NOT `delete`: that removes the own property and reveals
      // Navigator.prototype.clipboard, which is the real one — so the API path
      // runs again and this reads exactly like a missing fallback.
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
      const calls = [];
      const real = document.execCommand;
      document.execCommand = function (c) { calls.push(c); return true; };
      const msgEl = document.querySelector(".td-backup__msg");
      msgEl.hidden = true; msgEl.textContent = "";
      document.querySelector(".td-backup-copy").click();
      await new Promise((r) => setTimeout(r, 30));
      const out = { calls, msg: msgEl.hidden ? null : msgEl.textContent.trim(),
        sel: [document.querySelector(".td-backup__box").selectionStart,
              document.querySelector(".td-backup__box").selectionEnd] };
      document.execCommand = real;
      return out;
    });
    assert.deepEqual(fb.calls, ["copy"], "with no Clipboard API it falls back to the selection copy");
    assert.ok(fb.sel[1] > fb.sel[0], `…having selected the whole box first (${fb.sel.join("..")})`);
    assert.ok(fb.msg && /copied/i.test(fb.msg), `…and it still confirms (saw ${JSON.stringify(fb.msg)})`);
  } finally {
    await page.evaluate(() => { try { window.TDUI.closeOverlay(); } catch (e) { /* nothing open */ } });
  }

  // 3. three buttons in that row must still clear the fort's ADULT floor on the
  //    narrowest phone, and the dialog must stay on screen.
  for (const [w, h] of [[320, 568], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(60);
    await page.click("#screen-td-home .td-backup-open");
    await page.locator(".td-overlay--backup").waitFor({ state: "visible" });
    const m = await page.evaluate(() => {
      const box = document.querySelector(".td-overlay--backup .td-overlay__box").getBoundingClientRect();
      const bs = [...document.querySelectorAll(".td-overlay--backup .td-overlay__row .td-btn")]
        .map((b) => ({ t: b.textContent.trim(), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }));
      return { bs, onScreen: box.top >= 0 && box.bottom <= window.innerHeight + 1,
        ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert.equal(m.bs.length, 3, `all three actions are offered at ${w}px`);
    for (const b of m.bs) {
      assert.ok(b.w >= 44 && b.h >= 44, `"${b.t}" clears the adult 44px floor at ${w}px (${b.w}x${b.h})`);
    }
    assert.ok(m.onScreen, `the backup dialog lands on screen at ${w}px`);
    assert.equal(m.ovf, 0, `…and the page does not scroll sideways at ${w}px`);
    await page.evaluate(() => { try { window.TDUI.closeOverlay(); } catch (e) { /* nothing open */ } });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { location.hash = ""; });
});

test("QoL: the two ways to play a level again say which is which", async () => {
  // A defeat offers 🔁 Try again and 🎲 New shuffle, and nothing said what
  // differed: one replays the SAME seed — the identical wave order you just
  // lost to, so you can answer the puzzle you actually met — and the other
  // rolls a fresh one. A real choice presented as two buttons that look like
  // the same button. A `title` would be hover-only on a phone, so it is ink.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const lose = () => page.evaluate(() => {
    window.__TD.resetSave(); window.__TD.newGame(7, { seed: 5 });
    const L = window.TDData.LEVELS.find((l) => l.id === 7);
    window.__TD.script(L.pads.slice(0, 4).map((p) => ["place", "mortar", p.id]));
    for (let i = 0; i < 20 && window.__TD.state().phase !== "lost"; i++) {
      window.__TD.script([["call"], ["untilPhase", "build", 200000]]);
    }
    const box = document.querySelector(".td-overlay--lose");
    const btn = (act) => box && box.querySelector('[data-act="' + act + '"]');
    const sub = (act) => { const b = btn(act); const x = b && b.querySelector(".td-btn__sub"); return x ? x.textContent.trim() : null; };
    return { phase: window.__TD.state().phase, seed: window.__TD.state().seed,
      hasNew: !!btn("retrynew"), retrySub: sub("retry"), newSub: sub("retrynew") };
  });
  const d = await lose();
  assert.equal(d.phase, "lost", "fixture: the board must actually lose");
  assert.ok(d.hasNew, "a campaign defeat offers both ways back in");
  assert.ok(d.retrySub && d.newSub, `both buttons say which they are (${JSON.stringify([d.retrySub, d.newSub])})`);
  assert.notEqual(d.retrySub, d.newSub, "…and they must say DIFFERENT things — the difference is the whole point");

  // …and the words are TRUE: Try again really replays the same seed.
  const again = await page.evaluate(() => {
    document.querySelector('.td-overlay--lose [data-act="retry"]').click();
    return { seed: window.__TD.state().seed, level: window.__TD.state().levelId };
  });
  assert.equal(again.seed, d.seed, `🔁 Try again replays the SAME waves (seed ${again.seed} vs ${d.seed})`);
  assert.equal(again.level, 7, "…on the same level");

  // (That New shuffle must NOT reuse the seed is pinned structurally in
  // site.test.js — comparing two clock-derived seeds here would be a
  // 1-in-100000 flake, and this suite has already paid for one of those.)

  // ENDLESS has one way back in — its run is generated fresh either way — so it
  // must NOT grow a sub-line explaining a distinction that does not exist there.
  const endless = await page.evaluate(() => {
    window.__TD.resetSave();
    window.__TD.startEndless("bedroom", { seed: 1066 });
    for (let i = 0; i < 40 && window.__TD.state().phase !== "lost"; i++) {
      window.__TD.script([["call"], ["untilPhase", "build", 200000]]);   // neglect: no towers
    }
    const box = document.querySelector(".td-overlay--lose");
    const b = box && box.querySelector('[data-act="retry"]');
    return { phase: window.__TD.state().phase, hasNew: !!(box && box.querySelector('[data-act="retrynew"]')),
      sub: b ? !!b.querySelector(".td-btn__sub") : null, label: b ? b.textContent.trim() : null };
  });
  assert.equal(endless.phase, "lost", "fixture: neglecting endless must lose it");
  assert.equal(endless.hasNew, false, "endless offers no 'New shuffle' — every run is a fresh roll");
  assert.equal(endless.sub, false, `…so its Again button explains no distinction (saw ${JSON.stringify(endless.label)})`);
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = ""; });
});

test("QoL: a tower line looks and reads the SAME on every screen", async () => {
  // One player-facing thing — what a line looks like and what it is called —
  // had THREE owners, and they disagreed on two of the four lines. The build
  // menu paints DATA.TOWERS[id].icon (🧱 mortar, 🧊 fan); the 📖 Guide kept its
  // own `{ dart: "🎯", mortar: "💥", fan: "❄️", camp: "🪖" }`, teaching two
  // glyphs that appear NOWHERE else in the game; and the run summary kept a
  // third map with the same wrong icons and its own short names. Look a line up
  // in the manual, then fail to find it on the menu.
  const lines = await page.evaluate(() => Object.entries(window.TDData.TOWERS)
    .map(([id, t]) => ({ id, icon: t.icon, name: t.name, short: t.short })));
  assert.ok(lines.length >= 4, `every shipped line (${lines.length})`);
  for (const l of lines) {
    assert.ok(l.icon && l.name && l.short, `${l.id} declares an icon, a name and a short name`);
  }

  // 1. the GUIDE shows each line's own icon beside its own name
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.locator("#screen-td-home .td-guide-open").click();
  await page.locator(".td-overlay--guide").waitFor({ state: "visible" });
  try {
    const guide = await page.textContent(".td-overlay--guide .td-overlay__box");
    for (const l of lines) {
      assert.ok(guide.includes(l.icon + l.name) || guide.includes(l.icon + " " + l.name),
        `the guide pairs ${l.id}'s own icon with its name (wanted "${l.icon}${l.name}")`);
    }
  } finally {
    await page.evaluate(() => { try { window.TDUI.closeOverlay(); } catch (e) { /* nothing open */ } });
  }

  // 2. the BUILD MENU paints the same glyph on the button you are sent to press
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const menuIcons = await page.evaluate(() => {
    window.__TD.resetSave(); window.__TD.newGame(7, { seed: 11 });
    const L = window.TDData.LEVELS.find((l) => l.id === 7), p = L.pads[0];
    const s = window.__TD.w2s(p.cx + 0.5, p.cy + 0.5);
    const cv = document.querySelector("#screen-td-play canvas");
    const c = cv.getBoundingClientRect();
    for (const t of ["pointerdown", "pointerup", "click"]) {
      cv.dispatchEvent(new MouseEvent(t, { clientX: c.left + s.x, clientY: c.top + s.y, bubbles: true }));
    }
    const out = {};
    for (const b of document.querySelectorAll(".td-buy")) {
      const ic = b.querySelector(".td-buy__icon");
      if (b.dataset.line && ic) out[b.dataset.line] = ic.textContent.trim();
    }
    return out;
  });
  for (const l of lines) {
    assert.equal(menuIcons[l.id], l.icon, `the build menu paints ${l.id}'s own icon`);
  }

  // 3. …and a DEFEAT names the lines it sends you to, with those same glyphs —
  //    it used to print the engine's own keys ("Try: dart or fan"), which is an
  //    identifier shipped as player copy for something no screen ever shows.
  const lost = await page.evaluate(() => {
    window.__TD.resetSave(); window.__TD.newGame(7, { seed: 5 });
    const L = window.TDData.LEVELS.find((l) => l.id === 7);
    window.__TD.script(L.pads.slice(0, 4).map((p) => ["place", "mortar", p.id]));   // no answer to air
    for (let i = 0; i < 20 && window.__TD.state().phase !== "lost"; i++) {
      window.__TD.script([["call"], ["untilPhase", "build", 200000]]);
    }
    const box = document.querySelector(".td-overlay:not([hidden]) .td-overlay__box");
    return { phase: window.__TD.state().phase, txt: box ? box.textContent : "" };
  });
  assert.equal(lost.phase, "lost", "fixture: a mortar-only board must lose to the air wave");
  assert.match(lost.txt, /could even reach/, `fixture: the counter-matrix advice must fire (saw ${JSON.stringify(lost.txt.slice(0, 120))})`);
  const air = lines.filter((l) => ["dart", "fan"].includes(l.id));
  for (const l of air) {
    assert.ok(lost.txt.includes(l.icon + " " + l.name),
      `the advice names ${l.id} as "${l.icon} ${l.name}" (saw ${JSON.stringify(lost.txt.slice(0, 200))})`);
  }
  for (const l of lines) {
    assert.ok(!new RegExp("Try:[^.]*\\b" + l.id + "\\b").test(lost.txt),
      `…and never as the bare engine key "${l.id}"`);
  }
  // 4. the run summary's bars use the same glyph, in the compact form
  const sum = await page.evaluate(() => {
    // the per-LINE bars, not the stats line beside them
    return [...document.querySelectorAll(".td-sum__label")].map((r) => r.textContent.trim()).join(" | ");
  });
  const mortar = lines.find((l) => l.id === "mortar");
  assert.ok(sum.length > 0, `fixture: the summary must have per-line bars (saw ${JSON.stringify(sum)})`);
  assert.ok(sum.includes(mortar.icon + " " + mortar.short),
    `the run summary uses ${mortar.id}'s own icon, in the compact form (saw ${JSON.stringify(sum.slice(0, 160))})`);
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = ""; });
});

test("QoL: a badge toast sits ABOVE the controls, never on them", async () => {
  // The toast is fixed 24px from the bottom, which in portrait is exactly where
  // the power strip and ▶ CALL live. Measured before the fix: at 320px a mid-run
  // badge covered TWO power tiles COMPLETELY plus 1368px² of CALL, and 74/74/60%
  // at 390. 🩸 First Blood fires on your first kill — wave 1 of every level — so
  // it happened at the start of every run. It cannot steal the tap
  // (pointer-events: none) but it hides the thing you are reaching for.
  const earn = async () => page.evaluate(() => {
    // Clear first, and read the LAST toast: they are APPENDED, so querySelector
    // returns the OLDEST one — which at the next viewport is still carrying the
    // previous layout's absolute position, and reads exactly like the product
    // failing to lift. (The buddy test records this same trap for `.win-hero`.)
    window.TDUI.clearToasts();
    window.__TD.resetSave();
    window.__TD.newGame(7, { seed: 11 });
    const L = window.TDData.LEVELS.find((l) => l.id === 7);
    window.__TD.script(L.pads.slice(0, 6).map((p, i) => ["place", ["dart", "mortar", "fan", "dart"][i % 4], p.id]));
    window.__TD.script([["call"], ["tick", 260]]);          // First Blood, mid-wave
    const all = document.querySelectorAll(".td-toast");
    const t = all[all.length - 1];
    if (!t) return { none: true };
    const tr = t.getBoundingClientRect();
    const over = (r) => Math.max(0, Math.min(tr.right, r.right) - Math.max(tr.left, r.left)) *
                        Math.max(0, Math.min(tr.bottom, r.bottom) - Math.max(tr.top, r.top));
    const ctrls = [...document.querySelectorAll(".td-abil, .td-call")].filter((c) => c.offsetParent);
    return { top: Math.round(tr.top), bottom: Math.round(tr.bottom), ctrls: ctrls.length, toasts: all.length,
      worst: Math.round(Math.max(0, ...ctrls.map((c) => over(c.getBoundingClientRect())))) };
  });

  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  let landscapeTop = 0;
  for (const [w, h] of [[320, 568], [390, 844], [768, 1024], [834, 1112], [844, 390]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(80);
    const m = await earn();
    assert.ok(!m.none, `fixture: a badge must actually toast at ${w}x${h}`);
    assert.ok(m.ctrls >= 4, `fixture: the controls must be on screen at ${w}x${h} (${m.ctrls})`);
    assert.equal(m.toasts, 1, `fixture: exactly one toast, so this measures a FRESH one at ${w}x${h} (${m.toasts})`);
    assert.equal(m.worst, 0, `no control may be covered by a toast at ${w}x${h} (worst ${m.worst}px²)`);
    assert.ok(m.top >= 0, `…and the toast must stay on screen at ${w}x${h} (top ${m.top})`);
    if (w === 844) landscapeTop = m.top;
  }
  // The lift is CONDITIONAL — derived from where the controls actually are — so
  // landscape, where the strip is a side gutter and nothing overlaps, keeps the
  // low position. An unconditional lift would push it into the field instead.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(80);
  const low = await page.evaluate(() => (window.innerHeight - 24 - 80));
  assert.ok(landscapeTop > low,
    `in landscape the toast must stay low, since nothing overlaps there (top ${landscapeTop}, floor ${low})`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = ""; });
});

test("QoL: the difficulty chips say what the ladder DOES to a run", async () => {
  // The three chips said "😌 Easy / ⚔️ Normal / 💀 Hard" and their per-ladder
  // progress, and nothing anywhere — not the chips, not the guide, not one line
  // of copy — said what changes. The numbers are large and one is
  // counter-intuitive: Hard hands you MORE starting gold, because heroic was
  // deliberately re-shaped into a pure hp/economy challenge rather than a speed
  // one. Same law as the ⬆ upgrade preview and the % road figure.
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const tiers = await page.evaluate(() => {
    const D = window.TDData.DIFFICULTIES;
    return Object.keys(D).map((id) => ({ id, hp: D[id].hp, bounty: D[id].bounty, gold: D[id].startGold }));
  });
  assert.ok(tiers.length >= 3, `every declared tier (${tiers.length})`);

  for (const [w, h] of [[320, 568], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(60);
    const seen = [];
    const tops = [];
    for (const t of tiers) {
      await page.click(`#screen-td-home .td-diffbtn[data-diff="${t.id}"]`);
      await page.waitForTimeout(60);
      const m = await page.evaluate(() => ({
        txt: document.querySelector("#screen-td-home .td-diffwhat").textContent.trim(),
        top: Math.round(document.querySelector("#screen-td-home .td-levels").getBoundingClientRect().top),
      }));
      assert.ok(m.txt.length > 10, `${t.id} says what it does at ${w}px (saw "${m.txt}")`);
      // the NUMBERS come from that tier's own fields
      if (t.hp !== 1) assert.ok(m.txt.includes(Math.round(Math.abs(t.hp - 1) * 100) + "% toy health"),
        `${t.id} states its own health scaling (saw "${m.txt}")`);
      if (t.bounty !== 1) assert.ok(m.txt.includes(Math.round(Math.abs(t.bounty - 1) * 100) + "% gold per toy"),
        `${t.id} states its own bounty scaling (saw "${m.txt}")`);
      if (t.gold) assert.ok(m.txt.includes(Math.abs(t.gold) + " starting gold"),
        `${t.id} states its own starting gold (saw "${m.txt}")`);
      seen.push(m.txt); tops.push(m.top);
    }
    // …and it is not one sentence for all three: the whole point is the contrast.
    assert.equal(new Set(seen).size, tiers.length,
      `each tier must say something DIFFERENT at ${w}px (saw ${new Set(seen).size} distinct of ${tiers.length})`);
    // Tapping a chip must not move the grid under the thumb — the documented HUD
    // reflow defect, on the control you tap most on this screen. Asserted rather
    // than armoured with a reserved height, because a min-height whose removal
    // changes nothing today would be an unfalsifiable line.
    //   The axis it guards is per-tier LENGTH, not styling: bumping the line's
    // font-size scales all three sentences equally and correctly does NOT fire
    // this (measured — that mutation passes), while making ONE tier's sentence
    // wrap to an extra line does (tops 530 vs 560 at 320px). So the thing to
    // keep true is that every tier's line is about the same length.
    assert.equal(new Set(tops).size, 1,
      `the level grid must not shift when a chip is tapped at ${w}px (tops ${[...new Set(tops)].join(", ")})`);
    assert.ok(tops[0] > 0, `fixture: the grid is really on screen at ${w}px (${tops[0]})`);
  }

  // Self-proving: a FOURTH tier must explain itself with no code change here.
  const injected = await page.evaluate(() => {
    const D = window.TDData.DIFFICULTIES;
    D.__probe = { label: "🧪 Probe", hp: 1.75, speed: 1, bounty: 1, startGold: 0 };
    // The grid reads the SELECTED tier off the save, so the probe has to be
    // selected there — clicking its chip with a no-op handler re-renders on the
    // old tier and the line never moves, which reads exactly like a hard-coded
    // map surviving the injection.
    const save = JSON.parse(localStorage.getItem("jon-td-save-v1")) || { v: 1, stars: {} };
    save.difficulty = "__probe";
    window.TDUI.renderLevelGrid(save, () => {}, () => {});
    const b = document.querySelector('#screen-td-home .td-diffbtn[data-diff="__probe"]');
    const txt = document.querySelector("#screen-td-home .td-diffwhat").textContent.trim();
    delete D.__probe;
    return { hadChip: !!b, txt };
  });
  assert.ok(injected.hadChip, "fixture: the injected tier really got a chip");
  assert.ok(injected.txt.includes("75% toy health"),
    `a fourth tier explains itself from its own fields (saw "${injected.txt}")`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = ""; });
});

test("QoL: the Endless picker says what makes each arena different", async () => {
  // TD-18 gave every arena its OWN every-5th-wave spike so ten runs ask ten
  // different questions — and `miniBoss` was read by the wave generator and by
  // NOTHING else, so ten identical-looking rows differed by a fact you could
  // only learn by playing one to wave 5. A structural derivation proves the
  // trait line EXISTS (td-logic.test.js); only opening these two surfaces
  // proves anything renders it.
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const arenas = await page.evaluate(() => {
    const W = window.TDData.ENDLESS.worlds, E = window.TDData.ENEMIES;
    return Object.keys(W).map((w) => ({ w, label: W[w].label, mb: E[W[w].miniBoss].name, icon: E[W[w].miniBoss].icon }));
  });
  assert.ok(arenas.length >= 10, `every world has an arena (${arenas.length})`);
  await page.locator("#screen-td-home .td-endless-open").click();
  await page.locator(".td-endlesspick").waitFor({ state: "visible" });
  try {
    const seen = [];
    for (const a of arenas) {
      const spike = page.locator(`.td-endless[data-world="${a.w}"] .td-endless__spike`);
      assert.equal(await spike.count(), 1, `${a.w}'s row names its spike`);
      const txt = (await spike.textContent()).trim();
      assert.ok(txt.includes(a.mb), `${a.w} names ITS OWN spike (wanted ${a.mb}, saw "${txt}")`);
      seen.push(txt);
      // The row's parts CONCATENATE into its accessible name — this row already
      // announced "🔧 Garagenew!", the defect the difficulty chips and the level
      // cards were both fixed for, and a second line makes it worse.
      const aria = await page.getAttribute(`.td-endless[data-world="${a.w}"]`, "aria-label");
      assert.ok(aria && aria.includes(a.label) && aria.includes(a.mb),
        `${a.w} has an explicit accessible name naming its arena and spike (saw ${JSON.stringify(aria)})`);
    }
    // …and it is not one constant on ten rows: the SPIKE is what differs.
    assert.ok(new Set(seen).size >= 8,
      `the arenas must name DIFFERENT spikes (saw ${new Set(seen).size} distinct of ${seen.length})`);
    // The cadence is the same 5 everywhere, so it is stated ONCE in the blurb
    // rather than ten times in the list, where it would carry no information.
    const sub = await page.textContent(".td-endlesspick .td-overlay__sub");
    const every = await page.evaluate(() => window.TDData.ENDLESS.miniBossEvery);
    assert.match(sub, new RegExp(String(every) + "th wave"), `the blurb states the cadence once (saw "${sub}")`);
    for (const txt of seen) assert.ok(!/th wave/.test(txt), `a row must not repeat the cadence (saw "${txt}")`);
  } finally {
    await page.evaluate(() => { try { window.TDUI.closeOverlay(); } catch (e) { /* nothing open */ } });
  }

  // …and the body's own guide card says which arena it headlines — the lookup
  // direction, the same both-ways reasoning as the costume lines.
  await page.locator("#screen-td-home .td-guide-open").click();
  await page.locator(".td-overlay--guide").waitFor({ state: "visible" });
  try {
    const txt = await page.textContent(".td-overlay--guide .td-overlay__box");
    for (const a of arenas) {
      assert.ok(txt.includes("Headlines the " + a.label),
        `${a.mb}'s card must say it headlines the ${a.w} arena`);
    }
  } finally {
    await page.evaluate(() => { try { window.TDUI.closeOverlay(); } catch (e) { /* nothing open */ } });
  }
  await page.evaluate(() => { location.hash = ""; });
});

test("TD5 endless: the picker lists the worlds in CAMPAIGN order", async () => {
  // The rows used to come out in the order somebody typed the keys of a second
  // literal, and that literal had drifted from the campaign: 📦 Moving Day
  // (world 6) rendered above 🔧 Garage (world 5). On a save partway through the
  // campaign that puts an UNLOCKED arena BELOW a locked one — on the one screen
  // whose whole job is showing you what is open.
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const readRows = async () => {
    await page.locator(".td-endless-open").click();
    await page.locator(".td-endlesspick").waitFor({ state: "visible" });
    const got = await page.$$eval(".td-endless", (bs) => bs.map((b) => b.dataset.world));
    await page.locator(".td-endless-done").click();
    return got;
  };
  const campaign = await page.evaluate(() => window.TDLogic.worldOrder());
  assert.ok(campaign.length >= 10, `the campaign must name its worlds (${campaign.length})`);
  const shipped = await readRows();
  assert.deepEqual(shipped, campaign, "the shipped picker lists the worlds in campaign order");

  // …and it must SORT rather than inherit, or the next author who adds a world
  // to the wrong line of ENDLESS.worlds re-creates the defect with the suite
  // green. Hand it the reverse (a self-proving injection — this is the only
  // falsifier, because the shipped literal is now correctly ordered, so a
  // picker that simply reads the keys passes the clause above).
  const injected = await page.evaluate(() => {
    const W = window.TDData.ENDLESS.worlds;
    const keys = Object.keys(W).reverse();
    const before = Object.keys(W).join(",");
    const copy = {}; for (const k of keys) copy[k] = W[k];
    window.TDData.ENDLESS.worlds = copy;
    return { before, now: Object.keys(window.TDData.ENDLESS.worlds).join(",") };
  });
  assert.notEqual(injected.now, injected.before, "fixture: the injection really reordered the literal");
  const afterInject = await readRows();
  await page.evaluate((order) => {
    const W = window.TDData.ENDLESS.worlds;
    const copy = {}; for (const k of order) copy[k] = W[k];
    window.TDData.ENDLESS.worlds = copy;
  }, campaign);
  assert.deepEqual(afterInject, campaign,
    "a shuffled ENDLESS.worlds must still render in campaign order — the picker sorts, it does not inherit");
});

test("TD5 resume: a mid-run checkpoint offers Resume on the home and restores the build", async () => {
  // craft a mid-run save directly, then confirm the home shows a Resume banner
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1")) || { v: 1, stars: {}, settings: { sfx: true }, difficulty: "normal", meta: [], ach: [], endlessBest: {} };
    raw.midRun = { levelId: 3, endless: false, world: "bedroom", difficulty: "normal", seed: 7, waveIdx: 2, gold: 500, lives: 18, meta: [], towers: [{ lineId: "dart", tier: 2, branch: "", padId: "p1", targeting: "first", rallyX: 0, rallyY: 0 }] };
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload({ waitUntil: "load" }); // reload so the fort re-reads the seeded midRun
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  assert.ok(await page.locator(".td-resume:not([hidden])").count() === 1, "the resume banner shows when a checkpoint exists");
  await page.locator(".td-resume__go").click();
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const st = await page.evaluate(() => window.__TD.state());
  assert.equal(st.levelId, 3, "resumed the checkpointed level");
  assert.equal(st.waveIdx, 2, "resumed at the saved wave boundary");
  assert.ok(st.towers.length === 1 && st.towers[0].tier === 2, "the saved tower was rebuilt at its tier");
  assert.equal(st.gold, 500, "the saved economy was restored (not a cheated bump)");
  assert.ok(!st.cheated, "a restored run is honest (earns stars/badges)");
  await page.evaluate(() => { window.__TD.resetSave(); }); // clean up for later tests
});

test("AUDIT: a restored save naming a retired difficulty is coerced, not obeyed", async () => {
  // Originally: `kid` was a per-RUN mode, never a saved chip, but a backup
  // carrying difficulty:"kid" passed the boot check because it WAS a real
  // difficulty — every level from the grid became an unlosable run that could
  // never score a star, with no control to switch back.
  //   The mode is retired now, which makes this case MORE likely rather than
  // less: any save written before the removal still names it. The boot coercion
  // is what has to hold, so the test is kept and re-pointed at that claim.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1")) || { v: 1, stars: {} };
    raw.difficulty = "kid";
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).difficulty), "normal",
    "a saved kid chip is coerced back to a real difficulty at boot");
  await page.evaluate(() => { location.hash = "#td-play"; window.__TD.newGame(1, {}); });
  await page.waitForTimeout(80);
  const st = await page.evaluate(() => ({ diff: window.__TD.state().difficulty, cheated: window.__TD.state().cheated, kidSkin: document.body.classList.contains("td-kid") }));
  assert.notEqual(st.diff, "kid", "a level started from the grid is a real run");
  assert.ok(!st.cheated, "…which can actually earn its star");
  assert.ok(!st.kidSkin, "…and no retired skin is painted");
  // …and the run it DOES start is genuinely losable, which is the whole point
  // of refusing the retired chip rather than quietly honouring it.
  assert.ok(await page.evaluate(() => {
    const d = window.TDData.DIFFICULTIES[window.__TD.state().difficulty];
    return !!d && !d.noLose;
  }), "the coerced run is on a real, losable difficulty");
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("AUDIT resume: the checkpoint carries the countdown, the tally, and survives junk", async () => {
  // Three checkpoint-fidelity defects in one place.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.resetSave(); window.__TD.newGame(1, { seed: 4 }); });
  await page.waitForTimeout(80);

  // (1) A build phase you have SPENT most of must not come back full. The
  // early-call bonus is computed from the countdown, so quitting with a second
  // left and resuming turned "gold traded for build time" into free gold —
  // repeatable once per wave, for as many waves as you cared to cycle.
  // Two script() calls on purpose: the __TD harness runs phaseWatch after each
  // one, so the FIRST lays the wave-boundary checkpoint and the second (same
  // wave) lays none. That leaves a genuinely stale checkpoint to leave on —
  // one script() call would write a fresh one and mask the whole defect.
  const stale = await page.evaluate(() => {
    window.__TD.script([["tick", 600]]);
    const m = window.__TD.midRun();
    return { countdown: m && m.countdown, towers: m && m.towers.length };
  });
  const left = await page.evaluate(() => {
    // burn more of the build phase, buy a tower, then leave through the real
    // chokepoint (the same one the 🏠 button uses)
    window.__TD.script([["tick", 300], ["place", "dart", "p3"]]);
    const st = window.__TD.state();
    const out = { countdown: st.countdown, towers: st.towers.length, gold: st.gold };
    window.__TD.leaveToHome();
    return out;
  });
  assert.ok(left.countdown < 30 * 40, `the build phase really was spent (${left.countdown} ticks left)`);
  assert.ok(stale.countdown > left.countdown && stale.towers < left.towers,
    `the wave-boundary checkpoint really is stale by the time you leave (${JSON.stringify(stale)} vs ${JSON.stringify(left)})`);
  const mr = await page.evaluate(() => window.__TD.midRun());
  assert.ok(mr, "leaving during build wrote a checkpoint");
  assert.equal(mr.countdown, left.countdown, "the checkpoint holds the countdown you left on");
  assert.equal(mr.towers.length, left.towers,
    "…and the tower bought during that build phase (the checkpoint used to hold only the wave boundary)");
  const resumed = await page.evaluate(() => { window.__TD.resume(); const st = window.__TD.state(); return { countdown: st.countdown, towers: st.towers.length }; });
  assert.equal(resumed.countdown, left.countdown, "resume gives back the countdown you left, not a fresh one");
  assert.equal(resumed.towers, left.towers, "…and the build you left");

  // (2) The run tally must survive too, or a resumed run reports only its
  // post-resume damage and calls it the whole run (the towers are rebuilt via
  // engine.place(), which re-earns nothing).
  await page.evaluate(() => {
    window.__TD.script([["call"], ["untilPhase", "build", 200000]]);
    window.__TD.leaveToHome();
  });
  const tally = await page.evaluate(() => window.__TD.midRun());
  assert.ok(tally && tally.kills > 0, `the checkpoint carries the kill count (${tally && tally.kills})`);
  assert.ok(Object.keys(tally.dmgBy || {}).length > 0, "…and the damage-by-line tally");
  const back = await page.evaluate(() => { window.__TD.resume(); const st = window.__TD.state(); return { kills: st.kills, dmgBy: st.dmgBy }; });
  assert.equal(back.kills, tally.kills, "a resumed run keeps the kills it already earned");
  assert.deepEqual(back.dmgBy, tally.dmgBy, "…and the damage each line already did");

  // (3) A restored BACKUP can carry anything. A midRun whose `towers` is not an
  // array threw "mr.towers is not iterable" and killed the resume outright.
  const survived = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    // an OBJECT, not an array: `for (const t of ...)` throws outright on it
    // (a string would have quietly iterated its characters)
    raw.midRun = { levelId: 1, endless: false, world: "bedroom", difficulty: "normal", seed: 7, waveIdx: 1, gold: 300, lives: 15, meta: [], towers: { p1: "dart" } };
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
    return true;
  });
  assert.ok(survived);
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.locator(".td-resume__go").click();
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const junk = await page.evaluate(() => { const st = window.__TD.state(); return { phase: st.phase, waveIdx: st.waveIdx, towers: st.towers.length }; });
  assert.equal(junk.phase, "build", "a malformed checkpoint still resumes into a playable build phase");
  assert.equal(junk.waveIdx, 1, "…at the saved wave");
  assert.equal(junk.towers, 0, "…with no towers, rather than an exception");

  // (4) …and the SCALARS beside `towers` needed the opposite treatment, which
  // is the line worth drawing: COERCE what has a sane default, DISCARD what
  // does not. `towers → []` is sane — you lost your board and the run plays.
  // `waveIdx` has no sane default: resuming at wave 0 with wave-12 gold is a
  // different, wrong run, so a silently-corrected wave is a worse lie than
  // "that checkpoint could not be read". Left unguarded it did not even fail
  // politely — the board came back looking correct and the FIRST ▶ CALL threw
  // "Cannot read properties of null (reading 'groups')" inside the click
  // handler, freezing the run in build with nothing said.
  for (const bad of [{ waveIdx: 999 }, { waveIdx: -3 }, { waveIdx: "x" }, { waveIdx: 1.5 },
                     { gold: "lots" }, { lives: null }, { lives: undefined }]) {
    // Seed, then RELOAD — writing localStorage without one leaves the fort
    // module holding its in-memory copy, so the seed is invisible and the
    // resume succeeds against the old checkpoint. (It did: this clause passed
    // a working guard until the reload went in. Clause (3) above reloads for
    // exactly the same reason.)
    await page.evaluate((patch) => {
      const raw = JSON.parse(localStorage.getItem("jon-td-save-v1")) || { v: 1, stars: {} };
      raw.midRun = Object.assign({ levelId: 1, endless: false, world: "bedroom", difficulty: "normal",
        seed: 7, waveIdx: 1, gold: 300, lives: 15, meta: [], towers: [] }, patch);
      localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
    }, bad);
    await page.reload({ waitUntil: "load" });
    const cleared = await page.evaluate(async () => {
      location.hash = "#td-home";
      await new Promise((r) => setTimeout(r, 80));
      window.__TD.resume();
      await new Promise((r) => setTimeout(r, 150));
      return {
        hash: location.hash,
        midRun: (JSON.parse(localStorage.getItem("jon-td-save-v1")) || {}).midRun || null,
      };
    });
    assert.equal(cleared.hash, "#td-home",
      `a checkpoint with ${JSON.stringify(bad)} must be refused, not resumed into a run that dies on CALL`);
    assert.equal(cleared.midRun, null,
      `…and the unreadable checkpoint must be cleared, or the fort offers Resume for ever (${JSON.stringify(bad)})`);
  }

  // (5) ENDLESS has no wave TABLE — its waves are generated — so the bound
  // above needs its own branch or every endless resume would be thrown away.
  // This clause exists because the obvious implementation does exactly that.
  const endless = await page.evaluate(async () => {
    window.__TD.resetSave();
    window.__TD.startEndless("bedroom");
    window.__TD.script([["tick", 400]]);
    const m = window.__TD.midRun();
    if (!m) return { wrote: false };
    location.hash = "#td-home";
    await new Promise((r) => setTimeout(r, 60));
    window.__TD.resume();
    await new Promise((r) => setTimeout(r, 120));
    return { wrote: true, hash: location.hash, phase: (window.__TD.state() || {}).phase };
  });
  assert.ok(endless.wrote, "an endless run must write a checkpoint, or clause (5) proves nothing");
  assert.notEqual(endless.hash, "#td-home", "a HEALTHY endless checkpoint must still resume");
  assert.ok(endless.phase, "…into a live run");

  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("TD8 audit: a SPENT Sticker Shield stays spent across a resume (no re-granted free leak)", async () => {
  // The checkpoint-fidelity class: writeMidRun must carry state.shieldUsed, or a
  // Sticker-Shield owner who spent the free leak, quit, and resumed would get it
  // AGAIN (one free leak per resume segment instead of per run).
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1")) || { v: 1, stars: {}, settings: { sfx: true }, difficulty: "normal", meta: [], ach: [], endlessBest: {} };
    raw.meta = ["stickershield"];
    raw.midRun = { levelId: 3, endless: false, world: "bedroom", difficulty: "normal", seed: 7, waveIdx: 2, gold: 500, lives: 18, meta: ["stickershield"], shieldUsed: true, towers: [{ lineId: "dart", tier: 2, branch: "", padId: "p1", targeting: "first", rallyX: 0, rallyY: 0 }] };
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.locator(".td-resume__go").click();
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const shieldUsed = await page.evaluate(() => window.__TD.state().shieldUsed);
  assert.equal(shieldUsed, true, "the spent shield is restored as spent — the free leak is NOT re-granted on resume");
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("TD8 audit: EVERY star-tree node is reachable + scroll-stable on a SHORT viewport", async () => {
  // The tree grew from 10 to 23 nodes across 3 branches — much taller than its
  // 86dvh box. On a short viewport the whole tree + the Done button must stay
  // reachable (the box scrolls), and buying a node must NOT reset scroll to top.
  await page.evaluate(() => {
    const raw = { v: 1, stars: {}, settings: { sfx: true }, difficulty: "normal", meta: [], ach: [], endlessBest: {}, midRun: null };
    for (let i = 1; i <= 12; i++) raw.stars[i] = 3; // 36⭐ to spend (legacy flat → migrates to normal)
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload({ waitUntil: "load" });
  for (const vp of [{ width: 320, height: 480 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(vp);
    await page.evaluate(() => { location.hash = "#__renav"; });
    await page.waitForTimeout(40);
    await page.evaluate(() => { location.hash = "#td-home"; });
    await page.locator("#screen-td-home").waitFor({ state: "visible" });
    await page.locator(".td-tree-open").click();
    await page.locator(".td-tree").waitFor({ state: "visible" });
    // no horizontal overflow of the overlay box
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(over <= 1, `[${vp.width}x${vp.height}] star tree overflows horizontally by ${over}px`);
    // the LAST node (Sticker Shield, bottom of Fortification) and the Done button
    // must be reachable — scroll the box and confirm both can be clicked
    const box = page.locator("#screen-td-home .td-overlay__box");
    await box.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const done = page.locator(".td-tree-done");
    assert.ok(await done.isVisible(), `[${vp.width}x${vp.height}] Done button is reachable after scrolling`);
    // scroll stability: buy a Fortification node near the bottom, assert scroll didn't jump to 0
    await page.locator('.td-node[data-node="lives"]').scrollIntoViewIfNeeded();
    const before = await box.evaluate((el) => el.scrollTop);
    assert.ok(before > 0, `[${vp.width}x${vp.height}] the tree is actually scrolled before the buy`);
    await page.locator('.td-node[data-node="lives"]').click();
    const after = await box.evaluate((el) => el.scrollTop);
    assert.ok(after > 0 && Math.abs(after - before) < 60, `[${vp.width}x${vp.height}] buying keeps scroll position (was ${before}, now ${after}) — no jump to top`);
    await page.locator(".td-tree-done").click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("QoL: the tree's PACK budget is sticky, and a full rack says why", async () => {
  // Two halves of one gap, both already fixed once next door and not here.
  // (a) 🎒 N/6 lived in a paragraph at the very top of a 2900px dialog, so it
  //     scrolled away — the identical argument that moved the ⭐ budget onto the
  //     sticky strip a release earlier, and sharper, because at 6/6 every
  //     un-equipped ＋ goes `disabled` and this count is the explanation.
  // (b) that ＋ refused SILENTLY. The 🎒 Powers picker was fixed for exactly
  //     this ("a control that cannot be used says why"); the tree was not.
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.resetSave(); });
  try {
    // Own enough to overfill the rack. Seeded through the save + a reload, since
    // the module holds its own copy and a bare write is invisible to it.
    const need = await page.evaluate(() => window.TDData.RULES.metaSlots);
    assert.ok(need >= 2, "fixture: the rack must have more than one slot");
    const ids = await page.evaluate((n) => window.TDData.META_NODES
      .filter((x) => !x.req && !x.reqSpend).slice(0, n + 2).map((x) => x.id), need);
    assert.ok(ids.length > need, `fixture: need more owned nodes (${ids.length}) than slots (${need}) or nothing can be refused`);
    await page.evaluate((o) => {
      const s2 = JSON.parse(localStorage.getItem("jon-td-save-v1"));
      s2.meta = o.ids; s2.loadout = o.ids.slice(0, o.need); s2.midRun = null;
      localStorage.setItem("jon-td-save-v1", JSON.stringify(s2));
    }, { ids, need });
    await page.reload({ waitUntil: "load" });
    await page.evaluate(() => { location.hash = "#td-home"; });
    await page.locator("#screen-td-home").waitFor({ state: "visible" });
    await page.locator(".td-tree-open").click();
    await page.locator(".td-tree").waitFor({ state: "visible" });

    // ---- (a) the count is on screen AFTER scrolling to the bottom of the tree.
    // Asserting the PROPERTY (still visible once you are deep in the list), not
    // a `position: sticky` declaration that correlates with it.
    const box = page.locator("#screen-td-home .td-overlay__box");
    await box.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const m = await page.evaluate(() => {
      const box2 = document.querySelector("#screen-td-home .td-overlay__box");
      const b = box2.getBoundingClientRect();
      // ALL matches, not querySelector's first: a second copy elsewhere would
      // let this read the good one and pass — which is exactly how the "put it
      // back in the scrolling header" mutation first came back green.
      const all = [...document.querySelectorAll(".td-tree__packed")];
      if (all.length !== 1) return { count: all.length };
      const r = all[0].getBoundingClientRect();
      return { count: 1, text: all[0].textContent, scrolled: box2.scrollTop,
               inBox: r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && r.height > 0,
               inView: r.top >= 0 && r.bottom <= window.innerHeight };
    });
    assert.equal(m.count, 1, `the tree must state how many slots are packed, exactly once (saw ${m.count})`);
    assert.ok(m.scrolled > 0, "fixture: the tree must really be scrolled, or 'still visible' proves nothing");
    assert.ok(m.inBox && m.inView,
      `the packed count must survive scrolling to the bottom of the tree (scrolled ${m.scrolled}px, count at ${JSON.stringify(m.text)})`);
    assert.ok(m.text.indexOf("/" + need) >= 0, `…and it must state the real cap (saw ${JSON.stringify(m.text)})`);

    // ---- (b) a full rack refuses the ＋, and SAYS SO. The refused node is one
    // the fixture owns but did not pack, so the state is reachable by construction.
    const spare = ids[need];
    const ref = await page.evaluate((id) => {
      const b = document.querySelector('.td-node__equip[data-equip="' + id + '"]');
      if (!b) return { missing: true };
      return { disabled: b.disabled, title: b.getAttribute("title") || "",
               aria: b.getAttribute("aria-label") || "" };
    }, spare);
    assert.ok(!ref.missing, `fixture: the spare node (${spare}) must render an equip button`);
    assert.ok(ref.disabled, "a full rack must refuse an un-packed node's ＋");
    assert.ok(/full/i.test(ref.title), `…and say why on hover (title: ${JSON.stringify(ref.title)})`);
    assert.ok(/full/i.test(ref.aria),
      `…and to a screen reader, where a bare "Equip X" on a dead button is worse than useless (aria: ${JSON.stringify(ref.aria)})`);

    // ---- (c) both racks say the SAME thing. The two spellings had already come
    // apart inside one expression (a comma against a dash), which is why the
    // wording has one owner; compare the rendered strings rather than the source.
    await page.locator(".td-tree-done").click();
    await page.locator(".td-powers-open").click();
    await page.locator(".td-powers").waitFor({ state: "visible" });
    const pw = await page.evaluate(() => {
      const b = [...document.querySelectorAll(".td-node__equip[data-equippow]")].find((x) => x.disabled);
      return b ? { title: b.getAttribute("title") || "", aria: b.getAttribute("aria-label") || "" } : null;
    });
    assert.ok(pw, "fixture: a default pack is full, so some power's ＋ must be refused");
    assert.equal(pw.title, ref.title, "both racks refuse in the same words");
    assert.ok(pw.aria.indexOf(pw.title) === 0 && ref.aria.indexOf(ref.title) === 0,
      `…and the spoken label leads with those same words (powers: ${JSON.stringify(pw.aria)}, tree: ${JSON.stringify(ref.aria)})`);
  } finally {
    await page.evaluate(() => { if (window.TDUI && window.TDUI.closeOverlay) window.TDUI.closeOverlay(); });
    await page.evaluate(() => { window.__TD.resetSave(); });
  }
});

test("QoL: the 📖 guide is reachable MID-RUN, and reading it costs you nothing", async () => {
  // The guide is where the counter matrix lives — only two lines reach air,
  // armour halves a dart's bonk, a shield eats the Fan's zap — and it was
  // reachable only from the fort home. The DEFEAT screen already links to it,
  // so the game already believed "when you are stuck, read this"; it just
  // offered it one wave too late. Same law as the ⬆ upgrade preview and the
  // % road figure: the information belongs where the decision is made.
  // newGame leaves the run PAUSED, so the first ⏸ RESUMES rather than opening
  // the menu — the documented trap. Re-entering the screen is how this file's
  // other pause tests get a live run.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.resetSave(); window.__TD.newGame(1, { seed: 7 }); });
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(50);
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.waitForTimeout(300);
  try {
    await page.locator("#screen-td-play .td-pause").click();
    await page.locator(".td-overlay--pause").waitFor({ state: "visible" });

    // ---- 1. the guide opens from the pause menu at all
    const btn = page.locator('.td-overlay--pause [data-act="guide"]');
    assert.equal(await btn.count(), 1, "the pause menu must offer the guide");
    await btn.click();
    await page.locator(".td-overlay--guide").waitFor({ state: "visible" });
    const hasRoster = await page.evaluate(() =>
      document.querySelectorAll(".td-overlay--guide .td-guide__sec").length);
    assert.ok(hasRoster >= 6, `…and it renders its real sections (saw ${hasRoster})`);

    // ---- 2. the run is STILL PAUSED while you read. Asserted on the ENGINE's
    // own tick, not on a flag: a guide that quietly let the wave walk while you
    // looked something up would be worse than no guide at all.
    const t0 = await page.evaluate(() => window.__TD.state().tick);
    await page.waitForTimeout(400);
    const t1 = await page.evaluate(() => window.__TD.state().tick);
    assert.equal(t1, t0, `the battle must not advance while the guide is open (tick ${t0} → ${t1})`);

    // ---- 3. closing the guide RETURNS to the pause menu. Without this you are
    // stranded on a paused battlefield whose only obvious control (⏸) RESUMES,
    // so the way out of the guide would be to lose your pause.
    await page.locator(".td-guide-done").click();
    await page.locator(".td-overlay--pause").waitFor({ state: "visible", timeout: 3000 });
    assert.equal(await page.locator('.td-overlay--pause [data-act="resume"]').count(), 1,
      "closing the guide must come back to the pause menu, not to a bare paused screen");

    // ---- 4. …and the ✕ does the same, because it is the other exit and a
    // player will use whichever is nearer.
    await page.locator('.td-overlay--pause [data-act="guide"]').click();
    await page.locator(".td-overlay--guide").waitFor({ state: "visible" });
    await page.locator(".td-overlay--guide .td-overlay__x").click();
    await page.locator(".td-overlay--pause").waitFor({ state: "visible", timeout: 3000 });

    // ---- 5. Resume still resumes, so the added button did not break the menu.
    await page.locator('.td-overlay--pause [data-act="resume"]').click();
    await page.waitForTimeout(300);
    const t2 = await page.evaluate(() => window.__TD.state().tick);
    await page.waitForTimeout(300);
    const t3 = await page.evaluate(() => window.__TD.state().tick);
    assert.ok(t3 > t2, `resuming must actually restart the battle (tick ${t2} → ${t3})`);
  } finally {
    await page.evaluate(() => { if (window.TDUI && window.TDUI.closeOverlay) window.TDUI.closeOverlay(); });
    await page.evaluate(() => { location.hash = "#td-home"; });
    await page.evaluate(() => { window.__TD.resetSave(); });
  }
});

test("QoL: a 7-button pause menu still fits", async () => {
  // This dialog is the documented one that once overflowed a 390-tall landscape
  // viewport with NO scroll (title clipped above, quit below), which is why the
  // base box carries max-height + overflow-y. It has since gained a run label
  // and now a 📖 button, so the cost is MEASURED rather than assumed — and the
  // measurement is written down because only one of these sizes can separate a
  // 6-button menu from a 7-button one: at 320x568 the extra row takes it from
  // all-visible to needs-a-scroll (box 524 -> 544 against a 544 cap), while
  // 320x480, 844x390 and 667x375 already scrolled at SIX and 390x844 has slack
  // at both. That cost is accepted rather than designed away: this dialog's own
  // answer to not fitting has always been to scroll, every button stays at the
  // fort's adult floor, and the alternative (tightening the gap between two
  // DESTRUCTIVE buttons, or turning three labelled toggles into icons) trades
  // away more than it buys. The other sizes stay because they pin the
  // short-viewport behaviour this dialog has a history of breaking, which the
  // shipped 390-only pause test cannot see. FRESH CONTEXTS, never
  // setViewportSize — a resize does not reproduce this class.
  for (const [w, h] of [[320, 480], [320, 568], [390, 844], [844, 390]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const p2 = await ctx.newPage();
    try {
      await p2.goto(baseURL, { waitUntil: "load" });
      await p2.evaluate(() => { location.hash = "#td-play"; });
      await p2.locator("#screen-td-play").waitFor({ state: "visible" });
      await p2.evaluate(() => { window.__TD.resetSave(); window.__TD.newGame(1, { seed: 7 }); });
      await p2.evaluate(() => { location.hash = "#__renav"; });
      await p2.waitForTimeout(50);
      await p2.evaluate(() => { location.hash = "#td-play"; });
      await p2.waitForTimeout(300);
      await p2.locator("#screen-td-play .td-pause").click();
      await p2.locator(".td-overlay--pause").waitFor({ state: "visible" });
      const m = await p2.evaluate(() => {
        const box = document.querySelector(".td-overlay--pause .td-overlay__box");
        const r = box.getBoundingClientRect();
        const btns = [...box.querySelectorAll(".td-btn")];
        const lastEl = btns[btns.length - 1];
        const last = lastEl.getBoundingClientRect();
        // `scrollHeight > clientHeight` is NOT scrollability — it is content
        // overflow, and a box that CLIPS (or spills visibly) reports exactly the
        // same. Measured: deleting `overflow-y: auto` left that predicate true
        // and the mutation passed. The honest test is to actually scroll and see
        // whether the button arrives.
        box.scrollTop = box.scrollHeight;
        const scrolled = box.scrollTop > 0;
        const afterScroll = lastEl.getBoundingClientRect();
        box.scrollTop = 0;
        return { n: btns.length, top: Math.round(r.top), bottom: Math.round(r.bottom),
                 vh: window.innerHeight, scrolls: scrolled,
                 lastAfterScrollIn: afterScroll.top >= -1 && afterScroll.bottom <= window.innerHeight + 1,
                 lastBottom: Math.round(last.bottom), lastTop: Math.round(last.top),
                 minH: Math.min(...btns.map((b) => Math.round(b.getBoundingClientRect().height))),
                 wide: document.documentElement.scrollWidth > document.documentElement.clientWidth };
      });
      assert.ok(m.n >= 7, `fixture: the menu must carry the new button at ${w}x${h} (saw ${m.n})`);
      assert.ok(m.top >= 0 && m.bottom <= m.vh + 1,
        `the pause box must land ON SCREEN at ${w}x${h} (${m.top}..${m.bottom} of ${m.vh})`);
      assert.ok(!m.wide, `…and the page must not scroll sideways at ${w}x${h}`);
      assert.ok(m.minH >= 44, `…and every button stays at the fort's adult floor at ${w}x${h} (${m.minH}px)`);
      // The last button must be REACHABLE: on screen already, or inside a box
      // that scrolls to it. Both are acceptable — the pause menu's answer for a
      // short viewport has always been to scroll — but "off screen with no
      // scroll" is the defect this dialog was fixed for.
      const fitsAlready = m.lastTop >= 0 && m.lastBottom <= m.vh + 1;
      assert.ok(fitsAlready || (m.scrolls && m.lastAfterScrollIn),
        `the last pause button must be reachable at ${w}x${h} — it sits at ${m.lastTop}..${m.lastBottom} ` +
        `in a ${m.vh}px viewport, and scrolling the box ${m.scrolls ? "did not bring it into view" : "is not possible"}`);
    } finally {
      await ctx.close();
    }
  }
});

test("QoL: 📥 Restore confirms, and the confirm NAMES what you are trading", async () => {
  // Restore replaces every star ladder, the tree, the badges and the endless
  // bests, with no undo, and the save it overwrites may be the only copy — and
  // it shipped as ONE TAP, while ⚙️ Reset fort (strictly less damage, and a
  // backup can undo it) sits behind a type-the-word gate. Two destructive
  // buttons in one admin row with opposite policies, which is the pause menu's
  // 🔁 Restart defect again.
  const THIN = JSON.stringify({ v: 1, stars: { casual: {}, normal: { "1": 3 }, heroic: {} }, ach: ["doorman"] });
  const seedFat = async () => {
    await page.evaluate(() => {
      const s2 = JSON.parse(localStorage.getItem("jon-td-save-v1") || '{"v":1}');
      s2.v = 1; s2.stars = { casual: {}, normal: {}, heroic: {} };
      for (let i = 1; i <= 9; i++) s2.stars.normal[i] = 3;
      s2.ach = ["doorman", "firstblood", "noleaks"]; s2.midRun = null;
      localStorage.setItem("jon-td-save-v1", JSON.stringify(s2));
    });
    await page.reload({ waitUntil: "load" });
    await page.evaluate(() => { location.hash = "#td-home"; });
    await page.locator("#screen-td-home").waitFor({ state: "visible" });
  };
  const openWith = async (text) => {
    await page.locator(".td-backup-open").click();
    await page.locator(".td-backup__box").waitFor({ state: "visible" });
    await page.evaluate((t) => { document.querySelector(".td-backup__box").value = t; }, text);
    await page.locator(".td-backup-load").click();
    await page.waitForTimeout(150);
  };

  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.resetSave(); });
  const pageErrors = [];
  const onErr = (e) => pageErrors.push(String(e));
  page.on("pageerror", onErr);
  try {
    await seedFat();
    const before = await page.evaluate(() => localStorage.getItem("jon-td-save-v1"));
    await openWith(THIN);

    // ---- 1. it does NOT write on the tap; it asks.
    assert.equal(await page.locator(".td-overlay--confirm").count(), 1,
      "📥 Restore must confirm before replacing the fort");
    assert.equal(await page.evaluate(() => localStorage.getItem("jon-td-save-v1")), before,
      "…and must not have written anything yet");

    // ---- 2. the confirm names BOTH sides, and they differ. A speed bump would
    // not help here: the danger is not a mis-tap (restoring your own save is a
    // no-op) but pasting an OLDER backup over newer progress, which is invisible
    // until it is gone. Seeing 27 stars become 3 is what catches that.
    const c = await page.evaluate(() => document.querySelector(".td-overlay--confirm").innerText);
    const want = await page.evaluate((t) => ({
      now: window.TDUI.saveSummary(JSON.parse(localStorage.getItem("jon-td-save-v1"))),
      inc: window.TDUI.saveSummary(JSON.parse(t)),
    }), THIN);
    assert.notEqual(want.now, want.inc,
      `fixture: the two saves must summarise differently or clause 2 proves nothing (${want.now} vs ${want.inc})`);
    assert.ok(c.indexOf(want.now) >= 0, `the confirm must state what you have now (${want.now}) — saw ${JSON.stringify(c)}`);
    assert.ok(c.indexOf(want.inc) >= 0, `…and what the backup holds (${want.inc}) — saw ${JSON.stringify(c)}`);

    // ---- 3. cancelling keeps the fort AND the paste. Re-opening with the
    // CURRENT save would silently discard the very text you were weighing up.
    await page.locator('.td-overlay--confirm [data-act="no"]').click();
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => localStorage.getItem("jon-td-save-v1")), before,
      "keeping your fort must change nothing");
    assert.equal(await page.evaluate(() => (document.querySelector(".td-backup__box") || {}).value), THIN,
      "…and must not throw away what you pasted");

    // ---- 4. a paste that is NOT a fort save is refused with no confirm at all,
    // so the dialog can never promise a restore the write would then reject.
    await page.evaluate(() => { window.TDUI.closeOverlay(); });
    await openWith("not a save");
    assert.equal(await page.locator(".td-overlay--confirm").count(), 0,
      "a junk paste must be refused outright, never confirmed");
    assert.ok(await page.evaluate(() => {
      const m = document.querySelector(".td-backup__msg");
      return m && !m.hidden && /doesn.t look like/i.test(m.textContent);
    }), "…and must say so");
    assert.equal(await page.evaluate(() => localStorage.getItem("jon-td-save-v1")), before,
      "…and must not have touched the save");

    // ---- 5. Replace really does replace. importSave reloads, so wait it out.
    await page.evaluate(() => { window.TDUI.closeOverlay(); });
    await openWith(THIN);
    await page.locator('.td-overlay--confirm [data-act="yes"]').click();
    await page.waitForLoadState("load");
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")));
    assert.deepEqual(after.stars.normal, { "1": 3 },
      `Replace must actually restore the pasted save (stars ${JSON.stringify(after.stars.normal)})`);
    // ---- 6. …and restoring a MINIMAL backup must not throw on the way out.
    // A reload is not synchronous — the page keeps running until the navigation
    // commits — so a partially-shaped blob installed as the live save is read by
    // whatever fires in that window. THIN carries no `settings`, and on the
    // pre-fix build that threw "Cannot read properties of undefined (reading
    // 'music')" out of the music predicate, which is the defect this clause
    // exists for. The blob is written and the page reloaded; the live save is
    // never replaced, because the boot loader is the only place a restored save
    // should be met.
    assert.deepEqual(pageErrors, [],
      `restoring a minimal backup must not throw before the reload (${pageErrors.join(" | ")})`);
  } finally {
    page.off("pageerror", onErr);
    await page.evaluate(() => { if (window.TDUI && window.TDUI.closeOverlay) window.TDUI.closeOverlay(); });
    await page.evaluate(() => { location.hash = "#td-home"; });
    await page.evaluate(() => { window.__TD.resetSave(); });
  }
});

test("QoL: the level grid uses a WIDE screen instead of stretching two cards", async () => {
  // Two columns is right on a phone and a waste above it: measured, the cards
  // went 177px -> 342px (a nearly 4:1 letterbox) while the grid stayed 2452px
  // tall, so a tablet scrolled exactly as far as a phone to reach world 10.
  // FRESH CONTEXTS per size — a resize does not reproduce this class — and every
  // level UNLOCKED, because a locked card renders no NAME and the wrap count
  // that decides the column choice would measure ~1 card instead of 40. That
  // vacuous zero is what the first version of this measurement reported.
  const seed = () => {
    const s2 = JSON.parse(localStorage.getItem("jon-td-save-v1") || '{"v":1}');
    s2.v = 1; s2.stars = { casual: {}, normal: {}, heroic: {} };
    for (let i = 1; i <= 40; i++) s2.stars.normal[i] = 3;
    s2.midRun = null; localStorage.setItem("jon-td-save-v1", JSON.stringify(s2));
  };
  const measure = async (w, h) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const p2 = await ctx.newPage();
    try {
      await p2.goto(baseURL, { waitUntil: "load" });
      await p2.evaluate(() => { location.hash = "#td-home"; });
      await p2.locator("#screen-td-home").waitFor({ state: "visible" });
      await p2.evaluate(seed);
      await p2.reload({ waitUntil: "load" });
      await p2.evaluate(() => { location.hash = "#td-home"; });
      await p2.locator("#screen-td-home").waitFor({ state: "visible" });
      return await p2.evaluate(() => {
        const g = document.querySelector("#screen-td-home .td-levels");
        const cards = Array.prototype.slice.call(document.querySelectorAll("#screen-td-home .td-level"));
        let named = 0, wrapped = 0, minW = 1e9;
        for (const c of cards) {
          minW = Math.min(minW, c.getBoundingClientRect().width);
          const n = c.querySelector(".td-level__name");
          if (!n) continue;
          named++;
          const cs = getComputedStyle(n);
          const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
          if (n.getBoundingClientRect().height > lh * 1.6) wrapped++;
        }
        const heads = Array.prototype.slice.call(document.querySelectorAll("#screen-td-home .td-worldhead"));
        return {
          cols: getComputedStyle(g).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
          meta: (function () {
            const bs = Array.prototype.slice.call(document.querySelectorAll("#screen-td-home .td-metabtn"));
            return bs.length ? Math.round(Math.min.apply(null, bs.map(function (b) { return b.getBoundingClientRect().width; }))) : 0;
          }()),
          gridH: Math.round(g.getBoundingClientRect().height),
          gridW: Math.round(g.getBoundingClientRect().width),
          headW: heads.length ? Math.round(heads[0].getBoundingClientRect().width) : 0,
          heads: heads.length, cards: cards.length, named, wrapped, cardW: Math.round(minW),
          sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
    } finally { await ctx.close(); }
  };
  const perWorld = await page.evaluate(() => {
    const n = {}; for (const l of window.TDData.LEVELS) n[l.world] = (n[l.world] || 0) + 1;
    return Object.values(n);
  });
  const phone = await measure(390, 844);
  const tablet = await measure(834, 1112);

  // ---- fixture: every card must actually carry a name, or `wrapped` is a
  // vacuous zero and the column choice rests on nothing.
  for (const [what, m] of [["phone", phone], ["tablet", tablet]]) {
    assert.equal(m.named, m.cards, `fixture: every ${what} card must render a name (${m.named} of ${m.cards})`);
    assert.ok(m.cards >= 40, `fixture: the whole campaign must be on screen (${m.cards} cards)`);
    assert.ok(!m.sideways, `the fort home must not scroll sideways on ${what}`);
  }

  // ---- 1. a wide screen gets MORE columns, not wider cards.
  assert.ok(tablet.cols > phone.cols,
    `a tablet must use its width for more columns (phone ${phone.cols}, tablet ${tablet.cols})`);
  assert.ok(tablet.gridH < phone.gridH * 0.75,
    `…which must actually shorten the grid (phone ${phone.gridH}px, tablet ${tablet.gridH}px)`);

  // ---- 2. the column count must still divide a world evenly, or every world
  // ends on a ragged half-row — the shipped orphan law, derived from the data
  // so an eleventh world of a different size inherits it.
  assert.ok(perWorld.length >= 2 && new Set(perWorld).size === 1,
    `fixture: this law assumes worlds of equal size (saw ${JSON.stringify(perWorld)})`);
  for (const [what, m] of [["phone", phone], ["tablet", tablet]]) {
    assert.equal(perWorld[0] % m.cols, 0,
      `${what}: ${m.cols} columns orphans a card in every world of ${perWorld[0]}`);
  }

  // ---- 3. the extra columns must not squeeze the NAME. This is part of why the
  // breakpoint sits where it does: at four columns a 600px screen gives a 135px
  // card and 15 of 40 names wrap.
  assert.ok(tablet.wrapped <= 2,
    `narrowing the cards must not start wrapping level names (${tablet.wrapped} of ${tablet.named} wrap at ${tablet.cardW}px)`);

  // ---- 3b. …and the card must never end up NARROWER than the phone's, which
  // is the fort's own shipped law and is what the first cut of this change
  // broke. The breakpoint is arithmetic, not taste: four columns need
  // 4*177 + 3*12 = 744px of grid, so 768 is the smallest viewport that can
  // carry them. The sibling law asserts this for every fort control; it is
  // repeated here so THIS test fails on its own terms when the breakpoint moves
  // rather than pointing at a test three hundred lines away.
  assert.ok(tablet.cardW >= phone.cardW,
    `a tablet card must not be narrower than a phone's (${tablet.cardW}px vs ${phone.cardW}px) — ` +
    "four columns need 744px of grid, so the breakpoint cannot go below 768");
  // The SMALLEST four-column width is the one that can fail; above it the card
  // only grows (194px at 834, 210px at 1024), so a roomier size proves nothing.
  const narrowest = await measure(768, 1024);
  assert.equal(narrowest.cols, tablet.cols,
    `768px must already be a ${tablet.cols}-column screen (saw ${narrowest.cols})`);
  assert.ok(narrowest.cardW >= phone.cardW,
    `at the narrowest four-column width the card is ${narrowest.cardW}px against the phone's ${phone.cardW}px`);
  // JUST BELOW it is the input that separates a correct breakpoint from a
  // too-eager one, and nothing else here can: every size at or above 768 stays
  // wide enough whichever value the media query carries, so moving it to 720
  // passed every other clause. At 740 a four-column grid would be 165px — the
  // defect — so this asserts the PROPERTY (never stingier than a phone) at the
  // one width that can still exhibit it, rather than pinning the number.
  const belowBreak = await measure(740, 1000);
  assert.ok(belowBreak.cardW >= phone.cardW,
    `at 740px the card is ${belowBreak.cardW}px against the phone's ${phone.cardW}px — four columns ` +
    "do not fit until 768, so the breakpoint must not reach down here");

  // ---- 5. the META ROW must not step BACKWARDS as the screen widens. Giving
  // this screen its 900px container is what exposed it: `auto-fit` then finds
  // room for five tracks for seven buttons, so it laid them out 5+2 — three
  // empty cells, a stranded pair, and buttons that went 180px at 768 -> 156 at
  // 834 -> 169 at 1024. The shipped sibling law deliberately allows a wrapping
  // grid to step, so it cannot see this; above the breakpoint the column count
  // is FIXED, which makes monotonicity true and therefore assertable.
  const metaAt = {};
  for (const w of [768, 834, 1024]) metaAt[w] = (await measure(w, 1024)).meta;
  assert.ok(metaAt[834] >= metaAt[768] && metaAt[1024] >= metaAt[834],
    `a wider screen must not shrink the meta buttons (768:${metaAt[768]}px, 834:${metaAt[834]}px, 1024:${metaAt[1024]}px)`);

  // ---- 4. the world headings follow the column count. They span `1 / -1`, so
  // this is structural — but a heading that stopped spanning would read as a
  // card and silently break the section rhythm on exactly one viewport.
  assert.ok(tablet.heads >= 2, `fixture: the grid must carry world headings (${tablet.heads})`);
  assert.ok(tablet.headW > tablet.gridW - 12,
    `a world heading must span the whole grid (${tablet.headW}px of ${tablet.gridW}px)`);
});

test("QoL: the control row sits under the FIELD, not beside it", async () => {
  // In portrait the board is HEIGHT-limited on anything bigger than a phone, so
  // the canvas narrows while the control row is laid out against the SCREEN.
  // Measured at 834: the row ran x 69..765 against a field of 144..690, which
  // put ▶ CALL — the button the build phase is about — entirely outside the
  // battlefield, with the power strip overhanging 75px the other way. 768 was
  // worse (CALL 36..128, field starting at 132).
  //
  // Fresh contexts per size, and the sizes are the ones that can SEPARATE: a
  // phone's field already fills its screen, so 390 is the control that must not
  // move, and landscape is a different layout entirely (an absolutely
  // positioned side gutter) which the cap deliberately does not touch.
  const read = async (w, h) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const p2 = await ctx.newPage();
    try {
      await p2.goto(baseURL, { waitUntil: "load" });
      await p2.evaluate(() => { location.hash = "#td-play"; });
      await p2.locator("#screen-td-play").waitFor({ state: "visible" });
      await p2.evaluate(() => { window.__TD.resetSave(); window.__TD.newGame(7, { seed: 3 }); });
      await p2.evaluate(() => { location.hash = "#__renav"; });
      await p2.waitForTimeout(50);
      await p2.evaluate(() => { location.hash = "#td-play"; });
      await p2.waitForTimeout(300);
      return await p2.evaluate(() => {
        const box = (sel) => {
          const e = document.querySelector("#screen-td-play " + sel);
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) };
        };
        return { canvas: box(".td-canvas"), controls: box(".td-controls"), call: box(".td-call"),
                 portrait: window.innerHeight > window.innerWidth };
      });
    } finally { await ctx.close(); }
  };

  for (const [w, h] of [[768, 1024], [834, 1112]]) {
    const m = await read(w, h);
    assert.ok(m.canvas && m.controls && m.call, `fixture: the play screen must render its field and controls at ${w}x${h}`);
    assert.ok(m.portrait, `fixture: ${w}x${h} must be portrait`);
    // The field must actually be NARROWER than the screen here, or there is
    // nothing for the cap to do and the clause below is vacuous.
    assert.ok(m.canvas.w < w - 40,
      `fixture: at ${w}x${h} the board must be height-limited (canvas ${m.canvas.w}px of ${w}px), or this proves nothing`);
    assert.ok(m.controls.l >= m.canvas.l - 1 && m.controls.r <= m.canvas.r + 1,
      `the control row must sit within the battlefield at ${w}x${h} — row ${m.controls.l}..${m.controls.r}, ` +
      `field ${m.canvas.l}..${m.canvas.r}`);
    assert.ok(m.call.l >= m.canvas.l - 1 && m.call.r <= m.canvas.r + 1,
      `…and ▶ CALL especially, since it is what the build phase is about (button ${m.call.l}..${m.call.r}, ` +
      `field ${m.canvas.l}..${m.canvas.r})`);
  }

  // ---- the PHONE is the control: there the field already fills the screen, so
  // the cap must change nothing. A `max-width` cannot force growth, and this
  // pins that.
  const phone = await read(390, 844);
  assert.ok(phone.controls.w >= 360,
    `a phone's control row must keep its full width (${phone.controls.w}px)`);
  assert.ok(phone.controls.l >= phone.canvas.l - 1 && phone.controls.r <= phone.canvas.r + 1,
    `…and still sit within the field (row ${phone.controls.l}..${phone.controls.r}, field ${phone.canvas.l}..${phone.canvas.r})`);

  // ---- LANDSCAPE is a different layout — the row is an absolutely positioned
  // side gutter beside the board, which is correct and must not be dragged
  // under it.
  const land = await read(844, 390);
  assert.ok(!land.portrait, "fixture: 844x390 must be landscape");
  assert.ok(land.controls.l >= land.canvas.r,
    `landscape keeps its side gutter (row ${land.controls.l}..${land.controls.r}, field ${land.canvas.l}..${land.canvas.r})`);
});

test("QoL: a field dialog is clamped to the BOARD, not to its wrapper", async () => {
  // The bubble's anchor was already right (`canvas.offsetLeft +
  // worldToScreen(...)`), but its CLAMP used the wrapper. Those coincide on a
  // phone and stop coinciding above it: in portrait the board is height-limited,
  // so at 768 the canvas is 504px inside a 720px wrap and sits 108px in.
  // Measured, a tier-3 tower panel on the rightmost pad overhung the field's
  // right edge by 80px at 768 and 73px at 834 — out over the bare background.
  // `wrapW` is a quantity that CORRELATES with the field width on a phone and
  // stops tracking it on a tablet, which is the proxy trap this file keeps
  // recording.
  const open = async (w, h) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const p2 = await ctx.newPage();
    try {
      await p2.goto(baseURL, { waitUntil: "load" });
      await p2.evaluate(() => { location.hash = "#td-play"; });
      await p2.locator("#screen-td-play").waitFor({ state: "visible" });
      await p2.evaluate(() => { window.__TD.resetSave(); window.__TD.newGame(7, { seed: 3 }); window.__TD.grantGold(9000); });
      await p2.evaluate(() => { location.hash = "#__renav"; });
      await p2.waitForTimeout(50);
      await p2.evaluate(() => { location.hash = "#td-play"; });
      await p2.waitForTimeout(300);
      // A TIER-3 panel on the pad furthest RIGHT on screen: the widest dialog at
      // the position that can actually overhang.
      await p2.evaluate(() => {
        const e = window.__TD.engine();
        let best = null;
        for (const p of e.levelDef.pads) {
          const sp = window.__TD.w2s(p.cx + 0.5, p.cy + 0.5);
          if (!best || sp.x > best.s.x) best = { p: p, s: sp };
        }
        window.__TD.script([["place", "dart", best.p.id]]);
        const i = e.state.towers.length - 1;
        window.__TD.script([["upgrade", i], ["upgrade", i]]);
        const cv = document.querySelector("#screen-td-play .td-canvas");
        const r = cv.getBoundingClientRect();
        cv.dispatchEvent(new MouseEvent("click", { clientX: r.left + best.s.x, clientY: r.top + best.s.y, bubbles: true }));
      });
      await p2.waitForTimeout(300);
      return await p2.evaluate(() => {
        const b = window.TDUI.bubble, cv = document.querySelector("#screen-td-play .td-canvas");
        if (!b || b.hidden) return null;
        const br = b.getBoundingClientRect(), cr = cv.getBoundingClientRect();
        return { w: Math.round(br.width),
                 outR: Math.round(Math.max(0, br.right - cr.right)),
                 outL: Math.round(Math.max(0, cr.left - br.left)),
                 fieldW: Math.round(cr.width), inset: cv.offsetLeft,
                 onScreen: br.left >= -1 && br.right <= window.innerWidth + 1 };
      });
    } finally { await ctx.close(); }
  };

  for (const [w, h] of [[768, 1024], [834, 1112]]) {
    const m = await open(w, h);
    assert.ok(m, `fixture: the tower panel must open at ${w}x${h}`);
    // Both fixture clauses matter: without an INSET canvas there is no gap for a
    // dialog to escape into, and if the panel were wider than the field the code
    // deliberately falls back to the wrap and clause 1 would be wrong to assert.
    assert.ok(m.inset > 0, `fixture: at ${w}x${h} the canvas must be inset in its wrap (offsetLeft ${m.inset})`);
    assert.ok(m.w + 16 <= m.fieldW,
      `fixture: the panel (${m.w}px) must fit the field (${m.fieldW}px) here, or the wrap fallback applies`);
    assert.equal(m.outR, 0, `the panel must not overhang the board's right edge at ${w}x${h} (${m.outR}px out)`);
    assert.equal(m.outL, 0, `…nor its left (${m.outL}px out)`);
  }

  // ---- the SMALL phone is the control, and it is the reason the clamp falls
  // back rather than always preferring the field. At 320x568 the board is only
  // 224px wide and the panel needs ~304px; forcing it inside was tried and
  // REVERTED, because it squeezed the three branch cards into one-word columns.
  // Here the panel must keep its full width and stay on screen — which is
  // exactly the shipped behaviour, unchanged.
  const small = await open(320, 568);
  assert.ok(small, "fixture: the tower panel must open at 320x568");
  assert.ok(small.w > small.fieldW,
    `fixture: at 320x568 the panel (${small.w}px) must be wider than the board (${small.fieldW}px), or this proves nothing`);
  assert.ok(small.w >= 290, `a small phone must not have its panel squeezed to fit the board (${small.w}px)`);
  assert.ok(small.onScreen, "…and it must still sit fully on screen");
});

test("TD6 fx juice: a Mortar splash shakes the screen, and prefers-reduced-motion disables it", async () => {
  await page.evaluate(() => { window.__TD.resetSave(); });
  // motion ALLOWED → a splash triggers a (small, ≤4px) shake at some point
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => { location.hash = "#td-play"; window.__TD.newGame(1, { seed: 7 }); window.__TD.grantGold(9000); });
  const maxShake = await page.evaluate(() => {
    window.__TD.script([["place", "mortar", "p3"], ["upgrade", 0], ["call"]]);
    let mx = 0;
    for (let s = 0; s < 40; s++) { window.__TD.script([["tick", 12]]); const info = window.__TD.render().shakeInfo(); mx = Math.max(mx, info.ttl); }
    return mx;
  });
  assert.ok(maxShake > 0, "a Mortar splash triggers a screen-shake when motion is allowed");
  // motion REDUCED → the renderer reports reduced and never shakes
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 7 }); window.__TD.grantGold(9000);
    window.__TD.script([["place", "mortar", "p3"], ["upgrade", 0], ["call"]]);
    let mx = 0, info = window.__TD.render().shakeInfo();
    for (let s = 0; s < 40; s++) { window.__TD.script([["tick", 12]]); info = window.__TD.render().shakeInfo(); mx = Math.max(mx, info.ttl); }
    return { reducedFlag: info.reduced, mx };
  });
  assert.equal(reduced.reducedFlag, true, "the renderer honors prefers-reduced-motion");
  assert.equal(reduced.mx, 0, "reduced-motion means NO screen-shake ever");
  await page.emulateMedia({ reducedMotion: "no-preference" });
});

test("TD6 pause options: Music and Damage-number toggles flip + persist", async () => {
  await page.evaluate(() => { location.hash = "#td-play"; window.__TD.newGame(1, { seed: 7 }); });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  // newGame leaves the run PAUSED (test hook) — the first tap unpauses; the second opens the menu.
  await page.locator("#screen-td-play .td-pause").click();
  await page.locator("#screen-td-play .td-pause").click();
  await page.locator('.td-overlay--pause').waitFor({ state: "visible" });
  // toggle music ON
  await page.locator('.td-overlay--pause [data-act="music"]').click();
  let music = await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).settings.music);
  assert.equal(music, true, "Music toggle persists");
  // toggle damage numbers ON (the menu re-renders each toggle, stays open)
  await page.locator('.td-overlay--pause [data-act="dmg"]').click();
  const dmg = await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).settings.dmgNumbers);
  assert.equal(dmg, true, "Damage-number toggle persists");
  await page.locator('.td-overlay--pause [data-act="resume"]').click();
  await page.evaluate(() => { window.__TD.resetSave(); });
});

// ===================== Deep-audit browser guardrails (RULE 7) =====================

test("AUDIT: a legacy/corrupt save with no `stars` field survives the first win (no crash, star saved)", async () => {
  // A stored v:1 save missing `stars` used to throw `undefined['1']` in phaseWatch
  // on the first victory — the win was lost and the frame died. Boot now coerces it.
  await page.evaluate(() => {
    localStorage.setItem("jon-td-save-v1", JSON.stringify({ v: 1, settings: { sfx: true } })); // NO stars key
  });
  await page.reload({ waitUntil: "load" });                 // force td-main to re-read the bad save
  await page.waitForFunction(() => !!window.__TD, null, { timeout: 8000 });
  const errsBefore = pageErrors.length;
  const phase = await page.evaluate(() => { location.hash = "#td-play"; return window.__TD.winL1(7); });
  assert.equal(phase, "won", "the level still wins on a stars-less save");
  const stars = await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).stars);
  assert.ok(stars && stars.normal && stars.normal["1"] >= 1, "the earned star was persisted (the crash used to drop it)");
  assert.equal(pageErrors.length, errsBefore, "no page error was thrown during the win");
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("AUDIT: resume carries the achievement context (no false No Leaks; Pea Purist lines restored)", async () => {
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  // Flow A: a leaked run, checkpointed at the wave-2 boundary, then resumed.
  const a = await page.evaluate(() => {
    window.__TD.resetSave();
    window.__TD.newGame(1, { seed: 7 });                    // no towers → wave-1 socks leak
    window.__TD.script([["call"], ["untilPhase", "build", 200000]]);
    const mr = window.__TD.midRun();
    window.__TD.resume();
    return { mrLeaked: mr && mr.leaked, ctxLeaked: window.__TD.ctx().leaked };
  });
  assert.equal(a.mrLeaked, true, "the checkpoint records the pre-quit leak");
  assert.equal(a.ctxLeaked, true, "resume restores the leak flag → No Leaks can't false-fire on a resumed win");
  // Flow B: a dart-only run — the resume must repopulate cur.lines from the rebuilt towers.
  const b = await page.evaluate(() => {
    window.__TD.resetSave();
    window.__TD.newGame(1, { seed: 7 });
    window.__TD.script([["place", "dart", "p3"], ["call"], ["untilPhase", "build", 200000]]);
    const mr = window.__TD.midRun();
    window.__TD.resume();
    return { towers: mr ? mr.towers.map((t) => t.lineId) : [], lines: window.__TD.ctx().lines };
  });
  assert.deepEqual(b.towers, ["dart"], "the dart tower is in the checkpoint");
  assert.deepEqual(b.lines.slice().sort(), ["dart"], "resume repopulates tower lines → Pea Purist is judged against the real field");
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("AUDIT: quitting an endless run records its best score (not only on defeat)", async () => {
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const best = await page.evaluate(() => {
    window.__TD.resetSave();
    window.__TD.startEndless("bedroom");
    // a 4-dart build clears endless wave 1 → reach the wave-2 build phase alive
    window.__TD.script([["place", "dart", "p1"], ["place", "dart", "p2"], ["place", "dart", "p3"], ["place", "dart", "p4"], ["call"], ["untilPhase", "build", 200000]]);
    const wave = window.__TD.state().waveIdx;
    window.__TD.leaveToHome();                              // QUIT (not a defeat)
    return { wave, best: window.__TD.endlessBest().bedroom || 0, cheated: window.__TD.state() ? window.__TD.state().cheated : true };
  });
  assert.ok(best.wave >= 1, "the endless run cleared at least one wave before quitting");
  assert.ok(!best.cheated, "the run was legit (no grantGold)");
  assert.ok(best.best >= best.wave, `quitting recorded the endless best (best ${best.best} ≥ reached ${best.wave})`);
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("AUDIT: the pause menu scrolls (never clips) in short landscape viewports", async () => {
  // route through the real fort home first so the subsequent #td-play ALWAYS
  // fires a hashchange (a prior test may have left the hash at #td-play)
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.evaluate(() => { location.hash = "#td-play"; window.__TD.newGame(1, { seed: 7 }); });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(200);
  // open the pause menu robustly: depending on route timing the run may be paused
  // or running, so click once, and if the overlay didn't open, click once more.
  const boxSel = ".td-overlay--pause .td-overlay__box";
  const pauseBtn = page.locator("#screen-td-play .td-pause");
  await pauseBtn.click();
  if (!(await page.locator(boxSel).isVisible().catch(() => false))) await pauseBtn.click();
  await page.locator(boxSel).waitFor({ state: "visible" });
  const fit = await page.evaluate((sel) => {
    const box = document.querySelector(sel);
    const r = box.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, vh: window.innerHeight, scrollable: box.scrollHeight > box.clientHeight + 1, canScroll: getComputedStyle(box).overflowY };
  }, boxSel);
  // the box itself must sit within the viewport (title not clipped above, base not lost below)…
  assert.ok(fit.top >= -1, `pause box top must not be clipped above the viewport (top ${Math.round(fit.top)})`);
  assert.ok(fit.bottom <= fit.vh + 1, `pause box bottom must not spill below the viewport (bottom ${Math.round(fit.bottom)}, vh ${fit.vh})`);
  // …and when its content is taller than the viewport, it must be scrollable to reach every control
  assert.ok(fit.canScroll === "auto" || fit.canScroll === "scroll", "the box allows scrolling when content overflows");
  // every pause button is reachable (each within, or scrollable into, the box)
  const quit = await page.locator('.td-overlay--pause [data-act="quit"]').boundingBox();
  assert.ok(quit && quit.height >= 24, "the last button (Back to the fort) exists and is a real control");
  await page.evaluate(() => { window.__TD.resetSave(); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
});

test("TD7 lever: EVERY fork level renders its lanes, and a real tap throws the track", async () => {
  // DERIVED over every fork, not pinned to L10. It was `newGame(10)` while the
  // lever spread to one level in each of ten worlds — so a world's new fork had
  // its VALUE measured by the node sim and its RENDER + real tap covered by
  // nothing. That matters because a fork's lanes are new geometry every time,
  // and the recorded TD-7 bug was exactly a rendering one: enemies drawn on the
  // wrong track because the renderer positioned them on lane 0 instead of their
  // own. A number sim cannot feel that.
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const errsBefore = pageErrors.length;
  const forkIds = await page.evaluate(() => window.TDData.LEVELS.filter((l) => l.fork && l.lever).map((l) => l.id));
  assert.ok(forkIds.length >= 8, `every world ships a fork (${forkIds.length} found)`);
  for (const lid of forkIds) {
  await page.evaluate((n) => { location.hash = "#td-play"; window.__TD.newGame(n, { seed: 7 }); }, lid);
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  // the multi-lane fork level (two ribbons + the lever glyph) renders with no error
  await page.evaluate(() => { const r = window.__TD.render(); r.resize(); r.draw(0); });
  // start a wave and let a few enemies march onto the default (short) lane
  const before = await page.evaluate(() => { window.__TD.script([["call"], ["tick", 45]]); return window.__TD.state().leverRoute; });
  assert.equal(before, 0, `L${lid}: the track starts on the short (default) lane`);
  // a REAL tap on the lever's world position (via the shared world→screen map) throws it
  const canvas = page.locator("#screen-td-play .td-canvas");
  const rect = await canvas.boundingBox();
  const sp = await page.evaluate(() => { const lv = window.__TD.engine().levelDef.lever; return window.__TD.w2s(lv.cx + 0.5, lv.cy + 0.5); });
  // Before the throw, a draw must light the SHORT (default) route on the field.
  const litBefore = await page.evaluate(() => { const r = window.__TD.render(); r.draw(0); return r.leverInfo(); });
  assert.ok(litBefore.hasSeg, `L${lid}: the lever level precomputes its divergent branch segments`);
  assert.equal(litBefore.lit, 0, `L${lid}: the route overlay lights the SHORT lane before the throw`);
  await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  const after = await page.evaluate(() => ({ route: window.__TD.state().leverRoute, long: window.__TD.state().enemies.some((e) => e.alive && e.pathIdx === 1) }));
  assert.equal(after.route, 1, `L${lid}: the tap threw the lever to the long lane`);
  assert.ok(after.long, `L${lid}: enemies on the shared prefix were rerouted the long way`);
  // The field overlay must follow the throw: the LONG route lights up now
  // (the persistent-toggle state is readable on the TRACK, not just the button).
  const litAfter = await page.evaluate(() => { const r = window.__TD.render(); r.draw(0); return r.leverInfo().lit; });
  assert.equal(litAfter, 1, `L${lid}: the route overlay lights the LONG lane after the throw`);
  }
  assert.equal(pageErrors.length, errsBefore, "no fork level or lever produced a page error");
  await page.evaluate(() => { window.__TD.resetSave(); });
});


test("TD17 AUDIT: a TIMED diversion is deliberately NOT checkpointed", async () => {
  // This replaces "the thrown lever survives a resume", which was correct while
  // the switch was a permanent toggle and is now wrong. Persisting leverRoute:1
  // without its expiry tick would restore a diversion that never ends —
  // reintroducing the exact free-upgrade this phase removed — and an absolute
  // expiry from the old run is meaningless in a fresh engine (the same reason
  // leverCd was already excluded). A checkpoint is a wave boundary and the
  // diversion lasts seconds, so coming back armed on the short route is the
  // honest restore, not a silent loss.
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const st = await page.evaluate(() => {
    window.__TD.resetSave();
    window.__TD.newGame(10, { seed: 7 });
    window.__TD.script([["place", "dart", "p1"], ["place", "dart", "p5"], ["call"]]);
    window.__TD.engine().pullLever();            // wave-only, so throw it after the call
    const during = window.__TD.state().leverRoute;
    window.__TD.script([["untilPhase", "build", 300000]]);
    const mr = window.__TD.midRun();
    window.__TD.leaveToHome();
    const phase = window.__TD.resume();
    const e = window.__TD.engine();
    return { during: during, saved: mr ? (mr.leverRoute === undefined ? "absent" : mr.leverRoute) : -1,
             route: e.state.leverRoute, lever: e.leverState(), phase: phase };
  });
  assert.equal(st.during, 1, "the lever really was thrown mid-wave");
  assert.equal(st.saved, "absent", "the checkpoint does NOT carry the diversion — a timed effect cannot be frozen into a save");
  assert.equal(st.route, 0, "a resumed run comes back on the short route");
  assert.equal(st.lever.phase, "ready", "…with the lever armed, so nothing is owed to the player");
  await page.evaluate(() => { window.__TD.resetSave(); });
});


test("AUDIT: a second fort tab can no longer clobber stars/achievements (monotonic merge on persist)", async () => {
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const merged = await page.evaluate(() => {
    window.__TD.resetSave();
    // simulate ANOTHER TAB having won L2 and earned a badge AFTER this tab loaded
    localStorage.setItem("jon-td-save-v1", JSON.stringify({ v: 1, stars: { "2": 3 }, settings: { sfx: true }, difficulty: "normal", meta: [], ach: ["bossbonker"], endlessBest: { backyard: 9 }, midRun: null }));
    // this tab now wins L1 → its persist() must FOLD the other tab's stars in
    window.__TD.winL1(7);
    return JSON.parse(localStorage.getItem("jon-td-save-v1"));
  });
  assert.ok(merged.stars.normal["1"] >= 1, "this tab's L1 win is stored on its ladder");
  assert.equal(merged.stars.normal["2"], 3, "the other (legacy-flat) tab's L2 stars fold into the normal ladder (no clobber)");
  assert.ok(merged.ach.includes("bossbonker"), "the other tab's achievement survives");
  assert.equal(merged.endlessBest.backyard, 9, "the other tab's endless best survives");
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("stars are PER-DIFFICULTY: a normal win never lights the other ladders (independent progressions)", async () => {
  // User request 2026-07: stars earned on one difficulty show only for that
  // difficulty — each chip is its own ladder (stars AND unlocks).
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const shape = await page.evaluate(() => {
    window.__TD.resetSave(); // fresh save, difficulty = normal
    location.hash = "#td-play";
    window.__TD.winL1(7); // a real (uncheated) scripted win on NORMAL
    return JSON.parse(localStorage.getItem("jon-td-save-v1")).stars;
  });
  assert.ok(shape.normal && shape.normal["1"] >= 1, "the win lands on the normal ladder");
  assert.equal(Object.keys(shape.heroic || {}).length, 0, "the heroic ladder stays empty");
  assert.equal(Object.keys(shape.casual || {}).length, 0, "the casual ladder stays empty");

  // the fort home on the NORMAL chip shows the star and L2 open…
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(60);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const litStars = () => page.evaluate(() => {
    const el = document.querySelectorAll(".td-level")[0].querySelector(".td-level__stars");
    const total = (el.textContent.match(/⭐/g) || []).length;
    const dimEl = el.querySelector(".td-level__dim");
    return total - (dimEl ? (dimEl.textContent.match(/⭐/g) || []).length : 0);
  });
  const l2Locked = () => page.evaluate(() => document.querySelectorAll(".td-level")[1].classList.contains("td-level--locked"));
  assert.ok((await litStars()) >= 1, "the normal ladder shows the earned L1 star");
  assert.equal(await l2Locked(), false, "L2 is open on the normal ladder");

  // …switching the chip to Hard shows an UNTOUCHED ladder: no stars, L2 locked…
  await page.locator('.td-diffbtn[data-diff="heroic"]').click();
  await page.waitForTimeout(30);
  assert.equal(await litStars(), 0, "the heroic ladder shows NO stars for the normal win");
  assert.equal(await l2Locked(), true, "L2 stays locked on the heroic ladder");

  // …and switching back restores the normal ladder intact.
  await page.locator('.td-diffbtn[data-diff="normal"]').click();
  await page.waitForTimeout(30);
  assert.ok((await litStars()) >= 1, "switching back restores the normal ladder's star");
  assert.equal(await l2Locked(), false, "L2 is open again on the normal ladder");
  await page.evaluate(() => { window.__TD.resetSave(); });
});


test("AUDIT: no pad hides under ANY floating field control (every map, both orientations)", async () => {
  // An HTML button floating over the canvas EATS the tap, so a pad whose centre
  // sits under it is UNBUILDABLE (L4's two end pads + endless backyard's corner
  // pad were, in portrait; L7's corner pad in landscape; L15's p2 in landscape).
  // Generalised from CALL alone to EVERY floating control, because building is
  // legal during a wave (`place` only refuses when the run is over) — so the
  // wave-phase POWER STRIP can bury a pad exactly the same way. Each control is
  // measured in the phase where it is actually on screen.
  // EVERY control is off the field now, so the answer is ZERO at every size —
  // which means the viewport list is the whole test. It used to be just
  // 390×844 and 844×390: the only two sizes where the FLOATING CALL button
  // happened to miss everything. One size down and it buried pads during
  // BUILD (3 at 375×667, 12 at 320×568, 36 and a LEVER at 320×480, 14 at
  // 667×375) — permanently unbuildable, and the suite was green throughout.
  const waveBuried = [];
  for (const vp of [
    { width: 390, height: 844 }, { width: 375, height: 667 }, { width: 360, height: 640 },
    { width: 320, height: 568 }, { width: 320, height: 480 },
    { width: 844, height: 390 }, { width: 667, height: 375 }, { width: 1024, height: 768 },
    // …and the iPad in PORTRAIT, which this list never had. The board's cell
    // size is derived from the viewport, so every pad's screen position moves
    // with the aspect — a control that misses every pad at eight phone sizes
    // says nothing about a ninth shape. The comment above is literal: the
    // viewport list IS the test.
    { width: 768, height: 1024 }, { width: 834, height: 1112 },
  ]) {
    await page.setViewportSize(vp);
    await page.evaluate(() => { location.hash = "#td-play"; });
    await page.locator("#screen-td-play").waitFor({ state: "visible" });
    await page.waitForTimeout(150);
    // DERIVED from the shipped data, never a hard-coded 12 + 3 — World 4's maps
    // were silently skipped by the literal, which is exactly the "re-run every
    // per-map law when you add content" lesson.
    const maps = await page.evaluate(() => [
      ...window.TDData.LEVELS.map((l) => ({ id: l.id })),
      ...Object.keys(window.TDData.ENDLESS.worlds).map((w) => ({ endless: w })),
    ]);
    for (const m of maps) {
      const res = await page.evaluate((mm) => {
        if (mm.endless) window.__TD.startEndless(mm.endless); else window.__TD.newGame(mm.id, { seed: 7 });
        const r = window.__TD.render(); r.resize(); r.draw(0);
        const name = window.__TD.engine().levelDef.name;
        const hits = (label) => {
          const out = [];
          const canvas = document.querySelector("#screen-td-play .td-canvas").getBoundingClientRect();
          const ctrls = document.querySelectorAll("#screen-td-play .td-call, #screen-td-play .td-abil");
          const targets = window.__TD.engine().levelDef.pads.map((p) => ({ id: p.id, cx: p.cx, cy: p.cy }));
          const lv = window.__TD.engine().levelDef.lever;
          if (lv) targets.push({ id: "the LEVER", cx: lv.cx, cy: lv.cy });
          for (const c of ctrls) {
            if (c.hidden || c.offsetParent === null) continue;
            const b = c.getBoundingClientRect();
            if (!b.width || !b.height) continue;
            for (const p of targets) {
              const sp = window.__TD.w2s(p.cx + 0.5, p.cy + 0.5);
              const x = canvas.x + sp.x, y = canvas.y + sp.y;
              if (x >= b.x - 4 && x <= b.x + b.width + 4 && y >= b.y - 4 && y <= b.y + b.height + 4) {
                out.push(name + " " + p.id + " under " + label);
              }
            }
          }
          return out;
        };
        const build = hits("a BUILD-phase control");
        // Mid-wave, with the powers live AND the wave button offering a RUSH —
        // both are on screen at once now, so both get measured.
        window.__TD.script([["call"], ["tick", 90]]);
        window.TDUI.hud(window.__TD.state());
        return { build, wave: hits("a WAVE-phase control") };
      }, m);
      // HARD LAW: nothing may hide a pad (or the lever) during BUILD. That is the
      // phase towers are placed in, so a pad buried here is permanently
      // unbuildable — the original defect class.
      assert.deepEqual(res.build, [], `${vp.width}x${vp.height}: buried during BUILD: ${res.build.join(", ")}`);
      // The lever is thrown mid-WAVE, so it must be clear in that phase too.
      const lever = res.wave.filter((s) => s.indexOf("the LEVER") >= 0);
      assert.deepEqual(lever, [], `${vp.width}x${vp.height}: the lever is buried mid-wave: ${lever.join(", ")}`);
      waveBuried.push(...res.wave);
    }
  }
  // No budget any more. The old fence allowed 12 buried-mid-wave pads because
  // the strip floated and no anchor could reach zero; every control is off the
  // battlefield now, in BOTH phases, so the honest number is 0 — and building
  // is legal mid-wave, so anything above 0 is a tap the player can't make.
  assert.deepEqual(waveBuried, [],
    `nothing may bury a pad mid-wave either: ${waveBuried.join(", ")}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("the POWER strip lives OFF the battlefield, and never fights the CALL button", async () => {
  // "The summon next wave yellow button is now placed poorly behind the power up
  // buttons" — both floated bottom-left, and the strip (z-index 7) sat on top of
  // CALL (z-index 6). The strip is now a layout row under the field (a column in
  // the landscape gutter), so it cannot overlap CALL — or anything on the field.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 3 }); });
  await page.waitForTimeout(80);
  const geom = () => page.evaluate(() => {
    const r = (s) => { const el = document.querySelector("#screen-td-play " + s); if (!el || el.hidden) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    return {
      phase: window.__TD.state().phase,
      call: r(".td-call"), abils: r(".td-abils"), canvas: r(".td-canvas"),
      idle: document.querySelector("#screen-td-play .td-abils").classList.contains("td-abils--idle"),
    };
  });
  const hit = (a, b) => !!a && !!b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 700 }]) {
    await page.setViewportSize(vp);
    await page.evaluate(() => { const r = window.__TD.render(); r.resize(); r.draw(0); });
    await page.waitForTimeout(60);
    const g = await geom();
    assert.ok(!hit(g.abils, g.canvas), `${vp.width}x${vp.height}: the power strip never overlaps the battlefield`);
    assert.ok(!hit(g.abils, g.call), `${vp.width}x${vp.height}: …and never overlaps the CALL button`);
    assert.ok(g.abils.x >= -1 && g.abils.x + g.abils.w <= vp.width + 1, `${vp.width}x${vp.height}: the strip is fully on screen`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { const r = window.__TD.render(); r.resize(); r.draw(0); });
  // Build phase: powers are INERT (dimmed, untappable) — not hidden, so the
  // field cannot resize at a phase boundary.
  const build = await geom();
  assert.equal(build.phase, "build");
  assert.ok(build.idle, "build phase: the power strip is inert");
  assert.ok(build.call, "…and CALL is up");
  const fieldInBuild = build.canvas.h;
  await page.evaluate(() => { window.__TD.script([["call"], ["tick", 20]]); window.TDUI.hud(window.__TD.state()); });
  const wave = await geom();
  assert.equal(wave.phase, "wave");
  assert.ok(!wave.idle, "wave phase: the power strip is live");
  // CALL does not vanish mid-wave any more — it becomes ⏩ RUSH once the wave
  // has settled. It still cannot overlap the strip, which is off the field.
  assert.ok(!hit(wave.abils, wave.call), "…and RUSH still never overlaps the strip");
  assert.equal(wave.canvas.h, fieldInBuild, "the battlefield does NOT resize when the strip wakes up");

  // …and a power armed mid-wave must DISARM when the wave ends, or it eats the
  // first pad tap of the next build phase (the stale-rally-arm class).
  await page.evaluate(() => {
    window.__TD.grantGold(3000);
    window.TDUI.hud(window.__TD.state());
  });
  await page.locator('.td-abil[data-abil="sticky"]').click();
  assert.ok(await page.evaluate(() => document.querySelector('.td-abil[data-abil="sticky"]').classList.contains("td-abil--armed")),
    "the power really is armed");
  await page.evaluate(() => { window.__TD.script([["untilPhase", "build", 200000]]); window.TDUI.hud(window.__TD.state()); });
  await page.waitForTimeout(60);
  assert.ok(await page.evaluate(() => !document.querySelector('.td-abil[data-abil="sticky"]').classList.contains("td-abil--armed")),
    "the wave ending disarmed it");
});

test("TD-14 backup: the fort save exports as text and a BAD paste changes nothing", async () => {
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  // Seed something worth losing, then reload so the fort boots from it.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("jon-td-save-v1") || "{}");
    s.v = 1; s.stars = { casual: {}, normal: { 1: 3, 2: 2 }, heroic: {} }; s.ach = ["firstblood"];
    localStorage.setItem("jon-td-save-v1", JSON.stringify(s));
  });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });

  await page.locator(".td-backup-open").click();
  await page.locator(".td-overlay--backup").waitFor({ state: "visible" });
  const exported = await page.locator(".td-backup__box").inputValue();
  const parsed = JSON.parse(exported);
  assert.equal(parsed.stars.normal["1"], 3, "the export carries the real progress");

  // A bad paste must be REFUSED — never destroy a good save.
  await page.locator(".td-backup__box").fill("not a save at all");
  await page.locator(".td-backup-load").click();
  await page.waitForTimeout(60);
  assert.ok(await page.locator(".td-backup__msg--bad").isVisible(), "a bad paste is refused, out loud");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).stars.normal["1"]), 3,
    "…and the stored save is untouched");
  // Wrong-shape JSON is refused too (parses fine, but is not a fort save).
  await page.locator(".td-backup__box").fill('{"hello":true}');
  await page.locator(".td-backup-load").click();
  await page.waitForTimeout(60);
  assert.ok(await page.locator(".td-backup__msg--bad").isVisible(), "valid JSON of the wrong shape is refused too");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).stars.normal["1"]), 3,
    "…still untouched");
  await page.evaluate(() => { window.TDUI.closeOverlay(); window.__TD.resetSave(); });
});

test("prices go RED→GREEN live as gold arrives, without reopening the dialog", async () => {
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  // Open a build menu while too poor for everything.
  const pad = await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 42 });
    window.__TD.state().gold = 0;
    return window.__TD.engine().levelDef.pads[0];
  });
  const rect = await page.locator("#screen-td-play .td-canvas").boundingBox();
  const sp = await page.evaluate((p) => window.__TD.w2s(p.cx + 0.5, p.cy + 0.5), pad);
  await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  await page.locator(".td-buildmenu").waitFor({ state: "visible" });
  const poor = await page.evaluate(() => Array.from(document.querySelectorAll(".td-buy")).map((b) => b.className));
  assert.ok(poor.every((c) => c.includes("td-afford--no")), `broke → every price reads unaffordable: ${poor.join(" | ")}`);

  // Gold arrives while the dialog STAYS OPEN — it must recolour itself.
  await page.evaluate(() => { window.__TD.grantGold(5000); window.TDUI.hud(window.__TD.state()); });
  await page.waitForTimeout(50);
  const rich = await page.evaluate(() => ({
    open: !document.querySelector(".td-bubble").hidden,
    cls: Array.from(document.querySelectorAll(".td-buy")).map((b) => b.className),
    enabled: Array.from(document.querySelectorAll(".td-buy")).every((b) => !b.disabled),
  }));
  assert.ok(rich.open, "the dialog was never closed and reopened");
  assert.ok(rich.cls.every((c) => c.includes("td-afford") && !c.includes("td-afford--no")),
    `gold arrived → prices flip to affordable in place: ${rich.cls.join(" | ")}`);
  assert.ok(rich.enabled, "…and the buttons become usable");
  await page.evaluate(() => window.TDUI.hideBubble());
});

test("TD-14 speed: the field speed cycles 1× → 2× → 3× → 1×", async () => {
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 7 }); });
  const btn = page.locator("#screen-td-play .td-speed");
  const seen = [];
  for (let i = 0; i < 4; i++) { seen.push((await btn.textContent()).trim()); await btn.click(); }
  assert.deepEqual(seen, ["1×", "2×", "3×", "1×"], `speed cycles through three steps, got ${seen.join(" ")}`);
});

test("TD-13 run summary: a win shows damage BY LINE and records a personal best", async () => {
  await page.evaluate(() => { window.__TD.resetSave(); });
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  // The shipped scripted-victory hook — the same recipe the CI plan uses, so the
  // board is real and the damage is genuinely attributed to the line that dealt it.
  const phase = await page.evaluate(() => window.__TD.winL1(7));
  assert.equal(phase, "won", "the scripted L1 plan wins");
  await page.locator(".td-overlay--win").waitFor({ state: "visible", timeout: 10000 });
  const sum = page.locator(".td-sum");
  assert.equal(await sum.count(), 1, "the victory screen carries a run summary");
  const txt = await sum.textContent();
  assert.match(txt, /Dart/, "damage is attributed to the line that dealt it");
  assert.match(txt, /defeated/, "kills are counted");
  assert.match(txt, /earned/, "gold earned is counted");
  const pcts = await page.evaluate(() => Array.from(document.querySelectorAll(".td-sum__pct")).map((e) => parseInt(e.textContent, 10)));
  assert.ok(pcts.length >= 1 && pcts.every((p) => p >= 0 && p <= 100), `share percentages are sane: ${pcts.join(",")}`);
  // The best is persisted PER LEVEL + DIFFICULTY (independent ladders).
  const best = await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).bests);
  assert.ok(best && best["1:normal"], "a best is stored under level:difficulty");
  assert.ok(best["1:normal"].lives > 0, "…with the lives kept");
  assert.ok(!best["1:heroic"], "a normal win must NOT write the heroic ladder's best");
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("TD-12 guide: 📖 opens a card for every enemy, naming what can hit it", async () => {
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.locator(".td-guide-open").click();
  await page.locator(".td-overlay--guide").waitFor({ state: "visible" });
  const cards = await page.locator(".td-guide__card").count();
  const enemies = await page.evaluate(() => Object.keys(window.TDData.ENEMIES).length);
  assert.equal(cards, enemies, `every enemy has a guide card (${cards}/${enemies})`);
  // The counter matrix — the thing the game never told you — is on screen.
  const hawk = await page.evaluate(() => {
    const c = document.querySelector('.td-guide__card[data-enemy="hawk"]');
    return c ? c.textContent : "";
  });
  assert.match(hawk, /Flies/, "a flier says it flies");
  assert.match(hawk, /Dart and Fan/, "…and names the only two lines that can reach it");
  const plane = await page.evaluate(() => document.querySelector('.td-guide__card[data-enemy="tinplane"]').textContent);
  assert.match(plane, /Armored/, "the Tin Plane's armor is explained");
  assert.match(plane, /zap ignores armor/, "…including the counter-play that answers it");
  // A COSTUME must say so on the rendered page, both ways round. A structural
  // scan proves enemyTraits emits the line; only opening the guide proves the
  // card's own render loop puts it there — and 21 of the 56 cards are costumes,
  // so this is the roster's single biggest source of apparent duplication.
  // DERIVED, so a world 11's new skins are covered without editing this.
  const costume = await page.evaluate(() => {
    const E = window.TDData.ENEMIES;
    const id = Object.keys(E).find((k) => E[k].skinOf);
    const anc = E[id].skinOf;
    const txt = (k) => {
      const c = document.querySelector('.td-guide__card[data-enemy="' + k + '"]');
      return c ? c.textContent.replace(/\s+/g, " ") : "";
    };
    return { id, anc, ancName: E[anc].name, ancIcon: E[anc].icon,
      skinIcons: Object.keys(E).filter((k) => E[k].skinOf === anc).map((k) => E[k].icon),
      skin: txt(id), ancestor: txt(anc) };
  });
  assert.ok(costume.id && costume.anc, "the roster ships skins to check");
  assert.ok(costume.skin.includes(costume.ancIcon + " " + costume.ancName),
    `the "${costume.id}" card must name the ${costume.ancName} it is a costume on, saw "${costume.skin}"`);
  assert.ok(/anything can hit it|Flies|Armored/.test(costume.skin),
    "…without losing the counters the defeat screen sends you here for");
  for (const ic of costume.skinIcons) {
    assert.ok(costume.ancestor.includes(ic),
      `the "${costume.anc}" card must list every costume it is worn as (missing ${ic})`);
  }
  // Every STAR-TREE node must appear too. The tree grew to 30 nodes across three
  // branches and was documented NOWHERE outside its own buy screen — the same
  // condition that made TD-12 write this guide for the enemies, and that TD-16's
  // gimmicks hit again. Derived from DATA.META_NODES, so a 31st node cannot ship
  // invisible and the branch totals can never drift from the data.
  const tree = await page.evaluate(() => {
    const ul = document.querySelector(".td-guide__tree");
    return { text: ul ? ul.textContent : "", nodes: window.TDData.META_NODES.map((n) => n.name), total: window.TDData.META_NODES.reduce((s, n) => s + n.cost, 0) };
  });
  for (const name of tree.nodes) {
    assert.ok(tree.text.indexOf(name) >= 0, `the guide explains the star-tree skill "${name}" — a power nothing describes is invisible`);
  }
  const branchTotals = await page.evaluate(() => {
    const by = {};
    for (const n of window.TDData.META_NODES) by[n.branch] = (by[n.branch] || 0) + n.cost;
    return by;
  });
  for (const [b, sum] of Object.entries(branchTotals)) {
    assert.ok(tree.text.indexOf(sum + "⭐") >= 0, `the ${b} branch states its real total (${sum}⭐) rather than a hand-typed one`);
  }
  // …and so must PLACEMENT. The build buttons and tower panels now carry a
  // "% road" figure, and a number the player cannot interpret is the ⚙️ Toy
  // Energy mistake repeated: that symbol shipped on the HUD, on four ability
  // buttons and in this guide's cost lines with nothing anywhere naming it.
  const guideText = await page.evaluate(() => document.querySelector(".td-overlay--guide .td-overlay__box").textContent);
  assert.match(guideText, /% road/, "the guide must explain the % road figure the build menu and tower panel show");
  assert.match(guideText, /camp shows none|blocks the lane/i,
    "…including why a Camp shows none — an absent figure needs explaining as much as a present one");
  // It must fit the narrowest device, and scroll rather than clip.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(60);
  const fit = await page.evaluate(() => {
    const b = document.querySelector(".td-overlay--guide .td-overlay__box");
    const r = b.getBoundingClientRect();
    return { left: r.left, right: r.right, w: window.innerWidth, scrolls: b.scrollHeight > b.clientHeight, oy: getComputedStyle(b).overflowY };
  });
  assert.ok(fit.left >= -1 && fit.right <= fit.w + 1, `the guide fits at 320px (${fit.left}..${fit.right} of ${fit.w})`);
  assert.ok(!fit.scrolls || fit.oy === "auto" || fit.oy === "scroll", "a tall guide scrolls instead of clipping");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".td-guide-done").click();
  assert.equal(await page.locator(".td-overlay--guide").count(), 0, "Done closes it");
});

test("TD-12 post-mortem: losing tells you WHAT got through, and links to the guide", async () => {
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  // Neglect a level to a real defeat — no towers, just call every wave.
  await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 5 });
    for (let i = 0; i < 40 && window.__TD.state().phase !== "lost"; i++) {
      window.__TD.script([["call"], ["untilPhase", "build", 60000]]);
    }
  });
  await page.locator(".td-overlay--lose").waitFor({ state: "visible", timeout: 10000 });
  const pm = page.locator(".td-pm");
  assert.equal(await pm.count(), 1, "the defeat screen carries a post-mortem, not just flavour text");
  const txt = await pm.textContent();
  assert.match(txt, /Wave \d+/, "it names the wave you died on");
  assert.match(txt, /got past you/, "it counts what got through");
  assert.ok((await page.locator(".td-pm__list li").count()) >= 1, "it lists the toys that leaked, by name");
  // The 📖 link opens the guide focused on the enemy it blamed.
  await page.locator(".td-pm__guide").click();
  await page.locator(".td-overlay--guide").waitFor({ state: "visible", timeout: 5000 });
  assert.equal(await page.locator(".td-guide__card--focus").count(), 1,
    "the guide opens focused on the enemy the post-mortem blamed");
  await page.locator(".td-guide-done").click();
});

test("TD-9 abilities: the in-wave strip arms on tap and a real field tap fires it", async () => {
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 42 }); });
  await page.waitForTimeout(80);

  const strip = page.locator("#screen-td-play .td-abils .td-abil");
  // P6: the strip is the PACK, not the pool. This read `ABILITIES.length` and
  // was only correct while the two happened to be equal — the counting law.
  const n = await page.evaluate(() => window.TDData.RULES.abilitySlots);
  assert.equal(await strip.count(), n, `the field carries the packed ${n} ability buttons`);

  // Powers are wave-only, so the strip only exists once the wave is walking —
  // in build phase the corner belongs to CALL.
  await page.evaluate(() => { window.__TD.script([["call"], ["tick", 150]]); window.TDUI.hud(window.__TD.state()); });

  // Adult-sized (the fort is Jon's space) and inside the field, not off-screen.
  const box = await strip.first().boundingBox();
  const cbox = await page.locator("#screen-td-play .td-canvas").boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44, `ability buttons are adult-tappable (${box.width}×${box.height})`);
  assert.ok(box.x >= cbox.x - 2 && box.x + box.width <= cbox.x + cbox.width + 2, "the strip sits inside the field");

  // Broke → the button reads unaffordable and a tap is refused (no arming).
  await page.evaluate(() => { window.__TD.state().gold = 0; window.TDUI.abilities(window.__TD.state(), null); });
  assert.ok(await page.evaluate(() => document.querySelector('.td-abil[data-abil="drop"]').classList.contains("td-abil--poor")),
    "an unaffordable ability reads as unaffordable");
  await page.locator('.td-abil[data-abil="drop"]').click();
  assert.ok(!(await page.evaluate(() => document.querySelector('.td-abil[data-abil="drop"]').classList.contains("td-abil--armed"))),
    "tapping an unaffordable ability must NOT arm it");

  // Rich, in a REAL wave with enemies on the field (a blast that would hit
  // nothing is now refused outright rather than quietly charging you).
  await page.evaluate(() => {
    window.__TD.grantGold(2000);
    window.TDUI.abilities(window.__TD.state(), null);
  });
  const aim = await page.evaluate(() => {
    const st = window.__TD.state();
    const en = st.enemies.find((x) => x.alive);
    return en ? window.__TD.engine().posOn(en.pathIdx || 0, en.dist) : null;
  });
  assert.ok(aim, "enemies really are on the field to aim at");
  await page.locator('.td-abil[data-abil="drop"]').click();
  assert.ok(await page.evaluate(() => document.querySelector('.td-abil[data-abil="drop"]').classList.contains("td-abil--armed")),
    "a point ability ARMS and waits for the field tap (the rally-flag precedent)");
  // re-tapping disarms (toddler-proof toggle), then arm again for real
  await page.locator('.td-abil[data-abil="drop"]').click();
  assert.ok(!(await page.evaluate(() => document.querySelector('.td-abil[data-abil="drop"]').classList.contains("td-abil--armed"))),
    "re-tapping an armed ability disarms it");
  await page.locator('.td-abil[data-abil="drop"]').click();
  const rect = await page.locator("#screen-td-play .td-canvas").boundingBox();
  // +0.5 = the enemy's DRAWN centre. posOn returns cell-index space; every
  // sprite is painted at the cell's middle, so that is where a finger goes.
  const sp = await page.evaluate((a) => window.__TD.w2s(a.x + 0.5, a.y + 0.5), aim);
  await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  await page.waitForTimeout(60);
  assert.ok(await page.evaluate(() => (window.__TD.state().abilityCd || {}).drop > window.__TD.state().tick),
    "the field tap actually SPENT the ability (its cooldown is now running)");
  assert.ok(await page.evaluate(() => document.querySelector('.td-abil[data-abil="drop"]').classList.contains("td-abil--cool")),
    "…and the button is flagged as cooling");
  // The class above is a HANDLE — `td-abil--cool` is styled by nothing at all.
  // What the player actually sees is `.td-abil__cd`, a full-tile scrim with the
  // seconds on it, and asserting the flag while the message claimed "the button
  // shows the cooldown" is this repo's standing trap: a scan proves a call site
  // exists, only driving the feature proves it does anything. Hide that element
  // and the strip's whole refusal model goes silent with the suite green.
  const cd = await page.evaluate(() => {
    const el = document.querySelector('.td-abil[data-abil="drop"] .td-abil__cd');
    if (!el) return null;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return { text: el.textContent.trim(), w: r.width, h: r.height,
      shown: !el.hidden && cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0.1 };
  });
  assert.ok(cd && cd.shown && cd.w > 20 && cd.h > 20,
    `the cooldown must be VISIBLE on the tile, not just flagged on it (${JSON.stringify(cd)})`);
  assert.match(cd.text, /^\d+s$/,
    `…and it must read the seconds remaining, so the refusal explains itself (got ${JSON.stringify(cd.text)})`);

  // An "instant" ability needs no field tap at all.
  // An "instant" ability needs no field tap — but the Rally Horn now REFUSES
  // when there is nobody to rally (it used to take 80 gold and do nothing).
  await page.evaluate(() => { window.__TD.grantGold(2000); window.TDUI.abilities(window.__TD.state(), null); });
  const goldBeforeHorn = await page.evaluate(() => window.__TD.state().gold);
  await page.locator('.td-abil[data-abil="horn"]').click();
  await page.waitForTimeout(40);
  const hornState = await page.evaluate(() => ({
    camps: window.__TD.state().towers.filter((t) => t.lineId === "camp").length,
    cd: (window.__TD.state().abilityCd || {}).horn || 0,
    tick: window.__TD.state().tick,
    gold: window.__TD.state().gold,
    hint: (document.querySelector(".td-abilhint") || {}).textContent || "",
  }));
  assert.equal(hornState.camps, 0, "this board has no camps");
  assert.ok(hornState.cd <= hornState.tick, "the horn did NOT start a cooldown when it could do nothing");
  assert.equal(hornState.gold, goldBeforeHorn, "…and did NOT take gold for nothing");
  assert.match(hornState.hint, /No soldiers to rally/, "…and says why, in plain English");
  assert.doesNotMatch(hornState.hint, /already up/, "with no camp it must not say the squad is fine");

  // A live Sticky Floor puddle paints on the field and expires on its own.
  await page.evaluate(() => { window.__TD.grantGold(2000); window.TDUI.abilities(window.__TD.state(), null); });
  await page.locator('.td-abil[data-abil="sticky"]').click();
  await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  await page.waitForTimeout(60);
  assert.equal(await page.evaluate(() => window.__TD.state().puddles.length), 1, "the puddle is live in state");
  await page.evaluate(() => { window.__TD.script([["tick", 300]]); });
  assert.equal(await page.evaluate(() => window.__TD.state().puddles.length), 0, "and it expires by itself");
});

// The fort has TWO coordinate spaces and they are one `+ 0.5` apart:
//   • CELL-INDEX space — what the engine stores (path points, pads, enemies,
//     soldier posts, puddles). Cell (10,5) is the integer pair (10,5).
//   • WORLD space — what screenToWorld returns and what the canvas paints in.
//     The MIDDLE of cell (10,5) is (10.5, 5.5).
// Every sprite is drawn at `worldToScreen(coord + 0.5)`, so a coordinate that
// forgets the shift lands 0.707 cells up-left of the thing it belongs to. This
// is not visible to any "does it win?" test — the engine is right, the picture
// is wrong — so it gets a test that measures actual INK against actual state.
test("GEOMETRY: the engine's coordinates and the picture agree (no half-cell drift)", async () => {
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 9 }); });
  await page.waitForTimeout(80);

  const cell = await page.evaluate(() => {
    const a = window.__TD.w2s(0, 0), b = window.__TD.w2s(1, 0);
    return Math.hypot(b.x - a.x, b.y - a.y);
  });
  assert.ok(cell > 4, "the field really has a cell size to measure against");

  // ---- 1. A tap round-trips. Where the finger lands is where the power goes.
  // Pre-fix the tap was handed to the engine in WORLD units while the engine
  // measured in cell-index space, so the puddle sat 0.7 cells down-right of
  // the tap: an enemy visibly inside the amber circle was not slowed.
  await page.evaluate(() => {
    window.__TD.script([["call"], ["tick", 150]]);
    window.__TD.grantGold(2000);
    window.TDUI.hud(window.__TD.state());
    window.TDUI.abilities(window.__TD.state(), null);
  });
  const enemyAt = await page.evaluate(() => {
    const st = window.__TD.state();
    const en = st.enemies.find((x) => x.alive);
    return en ? window.__TD.engine().posOn(en.pathIdx || 0, en.dist) : null;
  });
  assert.ok(enemyAt, "an enemy is walking, to aim at");
  const rect = await page.locator("#screen-td-play .td-canvas").boundingBox();
  const tap = await page.evaluate((a) => window.__TD.w2s(a.x + 0.5, a.y + 0.5), enemyAt);
  await page.locator('.td-abil[data-abil="sticky"]').click();
  await page.mouse.click(rect.x + tap.x, rect.y + tap.y);
  await page.waitForTimeout(60);
  const puddle = await page.evaluate(() => {
    const z = window.__TD.state().puddles[0];
    return z ? { z, at: window.__TD.w2s(z.x + 0.5, z.y + 0.5) } : null;
  });
  assert.ok(puddle, "the tap really laid a puddle");
  const drift = Math.hypot(puddle.at.x - tap.x, puddle.at.y - tap.y);
  assert.ok(drift <= 2, `the puddle lands where the finger did (drifted ${drift.toFixed(1)}px, tolerance 2)`);
  // …and the enemy you were aiming at is genuinely inside it, not just visually.
  const inside = await page.evaluate((e) => {
    const z = window.__TD.state().puddles[0];
    return (e.x - z.x) ** 2 + (e.y - z.y) ** 2 <= z.r * z.r;
  }, enemyAt);
  assert.ok(inside, "the enemy under the finger is actually in the slow zone");

  // ---- 2. Soldier INK sits on the soldier's coordinates.
  // Frame-diff: draw with the squad, draw without it, and the pixels that
  // changed ARE the squad. Their centroid must match where the engine says
  // they stand. Pre-fix they drew a half-cell diagonal off the lane.
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 9 }); window.__TD.grantGold(3000); });
  await page.waitForTimeout(60);
  const squad = await page.evaluate(() => {
    const e = window.__TD.engine(), st = window.__TD.state();
    const pad = e.levelDef.pads[0];
    e.place("camp", pad.id);
    for (let i = 0; i < 120; i++) e.tick(); // let them march to their posts
    const cv = document.querySelector("#screen-td-play .td-canvas");
    const r = window.__TD.render(), c = cv.getContext("2d");
    const snap = () => { r.draw(1); return c.getImageData(0, 0, cv.width, cv.height).data; };
    const withThem = snap();
    const kept = st.soldiers.splice(0, st.soldiers.length);
    const without = snap();
    kept.forEach((s) => st.soldiers.push(s));
    r.draw(1);
    const dpr = window.devicePixelRatio || 1;
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < withThem.length; i += 4) {
      const d = Math.abs(withThem[i] - without[i]) + Math.abs(withThem[i + 1] - without[i + 1]) + Math.abs(withThem[i + 2] - without[i + 2]);
      if (d < 40) continue;
      const px = (i / 4) % cv.width, py = Math.floor((i / 4) / cv.width);
      sx += px; sy += py; n++;
    }
    if (!n) return { n: 0 };
    const live = kept.filter((s) => s.alive);
    let ex = 0, ey = 0;
    for (const s of live) { const p = window.__TD.w2s(s.x + 0.5, s.y + 0.5); ex += p.x; ey += p.y; }
    return { n, soldiers: live.length, ink: { x: sx / n / dpr, y: sy / n / dpr }, expect: { x: ex / live.length, y: ey / live.length } };
  });
  assert.ok(squad.n > 50, `the squad actually paints something (${squad.n} changed px)`);
  assert.ok(squad.soldiers >= 1, "the camp fielded soldiers");
  const soldierDrift = Math.hypot(squad.ink.x - squad.expect.x, squad.ink.y - squad.expect.y);
  assert.ok(soldierDrift < cell * 0.35,
    `soldier ink is centred on the soldier (${soldierDrift.toFixed(1)}px off, cell=${cell.toFixed(1)}, a half-cell miss would be ${(cell * 0.707).toFixed(1)})`);

  // ---- 3. The rally FLAG marks the spot the squad actually rallies to.
  // Same frame-diff, but only the rally point moves between the two frames —
  // the tower, its range ring and the squad are identical in both, so the
  // changed pixels near the rally point are the flag and nothing else.
  const flag = await page.evaluate(() => {
    const st = window.__TD.state(), r = window.__TD.render();
    const t = st.towers.find((x) => x.lineId === "camp");
    const cv = document.querySelector("#screen-td-play .td-canvas");
    const c = cv.getContext("2d");
    r.setSelection({ tower: t.id });
    const home = { x: t.rallyX, y: t.rallyY };
    const snap = () => { r.draw(1); return c.getImageData(0, 0, cv.width, cv.height).data; };
    const here = snap();
    t.rallyX = 1; t.rallyY = 1; // park the flag far away — everything else identical
    const away = snap();
    t.rallyX = home.x; t.rallyY = home.y;
    r.setSelection(null); r.draw(1);
    const dpr = window.devicePixelRatio || 1;
    const centred = window.__TD.w2s(home.x + 0.5, home.y + 0.5);
    const shifted = window.__TD.w2s(home.x, home.y);      // the old, wrong anchor
    const mid = { x: (centred.x + shifted.x) / 2, y: (centred.y + shifted.y) / 2 };
    const a0 = window.__TD.w2s(0, 0), b0 = window.__TD.w2s(1, 0);
    const cellPx = Math.hypot(b0.x - a0.x, b0.y - a0.y);
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < here.length; i += 4) {
      const d = Math.abs(here[i] - away[i]) + Math.abs(here[i + 1] - away[i + 1]) + Math.abs(here[i + 2] - away[i + 2]);
      if (d < 40) continue;
      const px = (i / 4) % cv.width / dpr, py = Math.floor((i / 4) / cv.width) / dpr;
      if (Math.hypot(px - mid.x, py - mid.y) > cellPx * 1.5) continue; // ignore the far-away frame's flag
      sx += px; sy += py; n++;
    }
    return n ? { n, ink: { x: sx / n, y: sy / n }, centred, shifted } : { n: 0 };
  });
  assert.ok(flag.n > 20, `the rally flag paints (${flag.n} px near the rally point)`);
  const dCentred = Math.hypot(flag.ink.x - flag.centred.x, flag.ink.y - flag.centred.y);
  const dShifted = Math.hypot(flag.ink.x - flag.shifted.x, flag.ink.y - flag.shifted.y);
  assert.ok(dCentred < dShifted,
    `the flag is planted on the rally point, not a half-cell up-left of it (centred ${dCentred.toFixed(1)}px vs shifted ${dShifted.toFixed(1)}px)`);
});

test("grown-ups ⚙️ reset: the word gate wipes ALL fort progress — and NOTHING else does", async () => {
  // Seed a fully-populated save, then boot the fort from it, so the test proves
  // the PERSISTED state is really cleared (not just the in-memory copy).
  const SEEDED = {
    v: 1,
    stars: { casual: { 1: 3 }, normal: { 1: 3, 2: 3, 3: 2 }, heroic: { 1: 1 } },
    settings: { sfx: false, music: true, dmgNumbers: true },
    difficulty: "heroic",
    meta: ["dartdmg"],
    ach: ["firstblood"],
    endlessBest: { bedroom: 12 },
    midRun: { levelId: 2, waveIdx: 3, endless: false, gold: 100, lives: 18, towers: [], difficulty: "normal" },
  };
  // Seed Josh's + 华丽's progress too: the fort reset must be INDEPENDENT and
  // leave the kid worlds completely alone (mirror of the assertion in
  // e2e.test.js that Josh's ⭐ reset leaves the fort save untouched).
  const KID_KEYS = { "josh-won-count-feed": "1", "josh-won-bubbles": "1", "josh-won-hl-mahjong-pair": "1", "josh-buddy": "hero-spidey", "josh-muted": "0" };
  await page.evaluate((k) => { for (const key in k) localStorage.setItem(key, k[key]); }, KID_KEYS);
  await page.evaluate((s) => { localStorage.setItem("jon-td-save-v1", JSON.stringify(s)); }, SEEDED);
  // A real RELOAD — goto(url + "#hash") is a same-document navigation, so the
  // fort module would never re-read storage and the seed would be invisible.
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  // sanity: the seeded save really is in effect (unlocks + the Resume banner)
  assert.ok(await page.locator(".td-resume").isVisible(), "the seeded mid-run shows a Resume banner");
  const lockedBefore = await page.locator(".td-level--locked").count();
  const shipped = await page.evaluate(() => window.TDData.LEVELS.length);
  assert.ok(lockedBefore < shipped - 1, `seeded save unlocks levels (locked ${lockedBefore} of ${shipped})`);

  const btn = page.locator(".td-reset-open");
  assert.equal(await btn.count(), 1, "the fort home carries a grown-ups reset control");
  assert.ok(await page.evaluate(() => document.querySelector(".td-reset-open").dataset.adult === "1"),
    "the reset control is data-adult (deliberately small — exempt from the kid ≥75px audit, gated by the word)");
  await btn.click();
  await page.locator(".td-overlay--reset").waitFor({ state: "visible" });

  // The dialog must FIT at the narrowest device width (the documented class:
  // a box that fits in headless Chromium still spilled on a real narrow phone).
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(60);
  const fit = await page.evaluate(() => {
    const b = document.querySelector(".td-overlay--reset .td-overlay__box").getBoundingClientRect();
    let right = b.right, left = b.left;
    for (const c of document.querySelectorAll(".td-overlay--reset .td-overlay__box *")) {
      const r = c.getBoundingClientRect();
      if (r.width) { right = Math.max(right, r.right); left = Math.min(left, r.left); }
    }
    return { left, right, w: window.innerWidth };
  });
  assert.ok(fit.left >= -1 && fit.right <= fit.w + 1, `reset dialog spills at 320px: ${fit.left}..${fit.right} of ${fit.w}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(60);

  // A WRONG word must clear nothing and keep the dialog open.
  await page.locator(".td-reset__input").fill("yes");
  await page.locator(".td-reset-ok").click();
  assert.equal(await page.locator(".td-overlay--reset").count(), 1, "a wrong word leaves the dialog open");
  assert.ok(await page.locator(".td-reset__err").isVisible(), "a wrong word explains itself");
  assert.deepEqual(
    await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).stars),
    SEEDED.stars, "a wrong word clears NOTHING");

  // The exact word wipes progress but KEEPS preferences.
  await page.locator(".td-reset__input").fill("Reset"); // case-insensitive, like Josh's gate
  await page.locator(".td-reset-ok").click();
  await page.waitForTimeout(80);
  assert.equal(await page.locator(".td-overlay--reset").count(), 0, "the dialog closes on a real reset");
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")));
  assert.deepEqual(after.stars, { casual: {}, normal: {}, heroic: {} }, "every difficulty ladder is cleared");
  assert.deepEqual(after.meta, [], "the star tree is refunded to nothing");
  assert.deepEqual(after.ach, [], "badges are cleared");
  assert.deepEqual(after.endlessBest, {}, "endless bests are cleared");
  assert.equal(after.midRun, null, "the saved run is discarded");
  // preferences are NOT progress — they survive (the Josh-reset-keeps-mute rule)
  // Every preference you HAD survives — asserted per key rather than as a
  // whole-object deepEqual, which fails the moment a new setting is added even
  // though nothing about the reset changed. (It did: ⏩ speed joined settings
  // and this went red naming a field the test had never heard of.) The claim
  // is "the reset loses no preference", so assert exactly that; a reset that
  // ADDS a defaulted key is not a preference-loss bug.
  for (const [k, v] of Object.entries(SEEDED.settings)) {
    assert.equal(after.settings[k], v, `the ${k} preference survives the reset (the Josh-reset-keeps-mute rule)`);
  }
  assert.equal(after.difficulty, "heroic", "the chosen difficulty chip survives the reset");
  // …and the home re-renders immediately: re-locked grid, no Resume banner.
  assert.equal(await page.locator(".td-level--locked").count(), shipped - 1, "the level grid re-locks at once");
  assert.ok(!(await page.locator(".td-resume").isVisible()), "the Resume banner is gone at once");
  // a reset save must be COMPLETE — the next win reads these and must not crash
  for (const k of ["v", "stars", "settings", "difficulty", "meta", "ach", "endlessBest", "midRun"]) {
    assert.ok(k in after, `the reset save keeps the full shape (missing ${k})`);
  }
  // …and it touched NOTHING outside jon-td-*: Josh's ⭐, 华丽's ⭐, his buddy and
  // his sound setting are all exactly as they were. Resetting the fort to replay
  // it must never cost Josh a single sticker.
  const kidAfter = await page.evaluate((k) => {
    const out = {};
    for (const key in k) out[key] = localStorage.getItem(key);
    return out;
  }, KID_KEYS);
  assert.deepEqual(kidAfter, KID_KEYS, "the fort reset must leave every josh-* key untouched (independent worlds)");
  await page.evaluate((k) => { for (const key in k) localStorage.removeItem(key); }, KID_KEYS);
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("the fort home shows a card for EVERY shipped level — World 4 was unreachable", async () => {
  // `TOTAL_PLANNED = 12` was hard-coded back when World 4 was still a plan, so
  // when the attic actually shipped, L13-L16 (and the Tickmaster) had no slot on
  // the grid at all — built, tested, and completely unreachable by the player.
  // The mirror of the documented "locked slots must have levels behind them".
  await page.evaluate(() => {
    const all = {};
    for (const l of window.TDData.LEVELS) all[l.id] = 3;
    localStorage.setItem("jon-td-save-v1", JSON.stringify({ v: 1, difficulty: "normal", stars: { casual: {}, normal: all, heroic: {} } }));
  });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.waitForTimeout(120);
  const shipped = await page.evaluate(() => window.TDData.LEVELS.length);
  const cards = await page.locator("#screen-td-home .td-level").count();
  assert.equal(cards, shipped, `the grid must have one card per shipped level (${cards} cards vs ${shipped} levels)`);
  const locked = await page.locator("#screen-td-home .td-level--locked").count();
  assert.equal(locked, 0, "with every level 3⭐ on this ladder, nothing is locked");
  const names = await page.locator("#screen-td-home .td-level__name").allTextContents();
  // EVERY world's levels, not just the attic's — naming one world is how the
  // attic got missed in the first place, and a sixth world would repeat it.
  for (const l of await page.evaluate(() => window.TDData.LEVELS.map((x) => ({ n: x.name, w: x.world })))) {
    assert.ok(names.some((n) => n.indexOf(l.n.split(" ")[0]) >= 0), `${l.w}'s "${l.n}" has a card`);
  }
  // and every world is visually distinguishable on the grid (its own tint hook)
  const worlds = await page.evaluate(() => [...new Set(window.TDData.LEVELS.map((l) => l.world))]);
  for (const w of worlds) {
    assert.ok(await page.locator(`#screen-td-home .td-level[data-world="${w}"]`).count() > 0,
      `world "${w}" tags its cards with data-world so its tint applies`);
  }
  await page.evaluate(() => { window.__TD.resetSave(); });
});

// The 🧸 Kid Fort button test lived here. The mode is RETIRED (owner, 2026-08)
// — button, `kid` difficulty, `noLose` and the body.td-kid skin were removed
// together, so there is no button left to press. `site.test.js` now guards the
// removal itself (no layer may carry half of it back), and the engine suite
// asserts every shipped difficulty is losable with no exemption.
test("screen wake lock: held only while a battle is LIVE, visible and unpaused", async () => {
  // The first cut acquired the lock in startLevel and released it only in
  // stopLoop, so pausing — or quitting to the fort mid-run — left the screen
  // pinned awake indefinitely while you browsed the star tree. The engine's own
  // visibilitychange handler already tested `!cur.paused`, so the code
  // disagreed with itself. Now ONE predicate owns it; this drives the real API
  // through a spy, because a lock you never observe is a lock you never tested.
  await page.evaluate(() => {
    window.__wl = { requests: 0, releases: 0, held: 0 };
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: () => {
          window.__wl.requests++;
          const listeners = [];
          const sentinel = {
            addEventListener: (t, fn) => { if (t === "release") listeners.push(fn); },
            release: () => { window.__wl.releases++; window.__wl.held--; listeners.forEach((f) => f()); return Promise.resolve(); },
          };
          window.__wl.held++;
          return Promise.resolve(sentinel);
        },
      },
    });
  });
  const held = () => page.evaluate(() => window.__wl.held);

  const pause = page.locator("#screen-td-play .td-pause");
  await page.evaluate(() => { if (window.TDUI.closeOverlay) window.TDUI.closeOverlay(); location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  // __TD.newGame deliberately leaves the run PAUSED for scripted tests — which
  // is itself a state that must not hold the lock.
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 9 }); });
  await page.waitForTimeout(80);
  assert.equal(await held(), 0, "a paused run does not hold the screen awake");

  await pause.click(); // resume → a LIVE battle
  await page.waitForTimeout(60);
  assert.equal(await held(), 1, "a live battle holds the screen awake");

  await pause.click(); // ⏸ → released (and the pause MENU now covers the field)
  await page.waitForTimeout(60);
  assert.equal(await held(), 0, "a PAUSED battle must not hold the screen awake");
  await page.locator('.td-overlay--pause [data-act="resume"]').click();
  await page.waitForTimeout(60);
  assert.equal(await held(), 1, "…and ▶ Resume takes it back");

  // quitting to the fort mid-run → released (this was the leak).
  await page.evaluate(() => { window.__TD.leaveToHome(); });
  await page.waitForTimeout(80);
  assert.equal(await held(), 0, "browsing the fort must not hold the screen awake");

  // a finished run → released.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 9 }); });
  await page.waitForTimeout(60);
  await pause.click();
  await page.waitForTimeout(60);
  assert.equal(await held(), 1, "a fresh battle holds it again");
  await page.evaluate(() => { window.__TD.winL1(9); });
  await page.waitForTimeout(80);
  assert.equal(await held(), 0, "a won run releases the lock");
  await page.evaluate(() => { window.TDUI.closeOverlay(); });
  assert.ok(await page.evaluate(() => window.__wl.requests >= 3), "the real API was actually exercised");

  await page.evaluate(() => { delete navigator.wakeLock; window.__TD.resetSave(); });
});

test("🔔 Sounds and 🎵 Music are INDEPENDENT switches under the global 🔇", async () => {
  // Reported from real play: "Sound on/off in the menu for TD also turned off
  // music." Both startMusic() and its per-note step() early-returned on
  // `!save.settings.sfx`, and the Sounds toggle itself called stopMusic() — so
  // one button silenced two things the menu offers separately.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 5 }); });
  await page.waitForTimeout(100);
  const out = await page.evaluate(async () => {
    // Count notes at the ONE shared primitive, so this measures what is
    // actually audible rather than what a flag says.
    const A = window.JoshAudio;
    const realTone = A.tone;
    let notes = 0;
    A.tone = function () { notes++; return realTone.apply(this, arguments); };
    A.setMuted(false);
    // Drive the REAL pause-menu buttons — the label says the current state, so
    // clicking until it reads what we want is exactly what a player does. A test
    // that flips the save flags would not have caught the Sounds handler calling
    // stopMusic(), which is half of this bug.
    const btn = (act) => document.querySelector('.td-overlay--pause [data-act="' + act + '"]');
    const openPause = () => { if (!btn("sfx")) document.querySelector("#screen-td-play .td-pause").click(); };
    const setTo = async (act, wantOn) => {
      for (let i = 0; i < 3; i++) {
        openPause();
        await new Promise((r) => setTimeout(r, 30));
        const b = btn(act);
        if (!b) return false;
        const on = /\bon\b/.test(b.textContent);
        if (on === wantOn) return true;
        b.click();
        await new Promise((r) => setTimeout(r, 30));
      }
      return false;
    };
    const set = async (sfx, music) => { await setTo("sfx", sfx); await setTo("music", music); };
    const sample = async (ms) => { notes = 0; await new Promise((r) => setTimeout(r, ms)); return notes; };
    const res = {};
    // music ON, sounds ON → music plays
    await set(true, true); res.bothOn = await sample(700);
    // music ON, sounds OFF → music MUST still play (this is the bug)
    await set(false, true); res.soundsOff = await sample(700);
    // …and it must also START from cold while Sounds is off. Toggling music off
    // and on again re-enters startMusic(), which is a SEPARATE gate from the
    // per-note one — reverting only that gate left the already-running loop
    // alive, so without this step the mutation passes and the test is half a
    // test. This is the real user path: sounds already off, then wanting music.
    await setTo("music", false); await setTo("music", true);
    res.startedWithSoundsOff = await sample(700);
    // music OFF, sounds ON → silence from the loop
    await set(true, false); res.musicOff = await sample(700);
    // music ON but globally muted → silent, and it must RESUME on unmute
    // rather than needing the toggle cycled (the loop is kept alive on purpose)
    await set(true, true); A.setMuted(true); res.muted = await sample(700);
    A.setMuted(false); res.unmuted = await sample(700);
    A.tone = realTone;
    return res;
  });
  assert.ok(out.bothOn > 0, `music with both on should play notes (got ${out.bothOn})`);
  assert.ok(out.soundsOff > 0,
    `MUSIC MUST SURVIVE SOUNDS OFF — they are two buttons in the menu, so one may not silence the other (got ${out.soundsOff} notes)`);
  assert.ok(out.startedWithSoundsOff > 0,
    `music must also START while Sounds is off — startMusic() is a second, separate gate (got ${out.startedWithSoundsOff} notes)`);
  assert.equal(out.musicOff, 0, `music off must be silent (got ${out.musicOff} notes)`);
  assert.equal(out.muted, 0, `the global 🔇 silences the music too (got ${out.muted} notes)`);
  assert.ok(out.unmuted > 0,
    `unmuting must RESUME the music without cycling the toggle — the loop is deliberately kept alive while muted (got ${out.unmuted} notes)`);
});

test("HUD: the ⚙️ never changes row as the numbers change", async () => {
  // Reported from real play: "the gear symbol in header kept jumping between top
  // line and line below so it was hard to press since it kept moving." The HUD
  // is a wrapping flex row, so a widening readout could push the button onto the
  // next line under the player's thumb. Measured before the fix: at 390x844 it
  // sat at y=8 with 0 gold and y=37 once gold grew, and at 375x667 the bar went
  // to three rows mid-run.
  //   The fix is that the layout now depends only on the VIEWPORT: the bar may
  // still wrap on a narrow phone, but it wraps the same way all run. So the
  // assertion is "the y never changes", NOT "it never wraps".
  const SIZES = [[430, 932], [414, 896], [390, 844], [375, 667], [360, 640], [320, 568], [844, 390]];
  const bad = [];
  // The play screen must be VISIBLE or every rect reads 0 and four zeros look
  // exactly like four identical positions — this test passed a mutation that
  // way before the navigation was added, which is why the degenerate reading is
  // now an explicit failure below rather than something to notice by eye.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => { window.__TD.newGame(12, { seed: 5 }); });
    // a resize has to actually reflow before anything is measured — a short
    // wait here silently made this test unable to see the very bug it is for
    await page.waitForTimeout(220);
    const ys = await page.evaluate(async () => {
      const st = window.__TD.state();
      const out = [];
      // the states a real run passes through: gold growing by orders of
      // magnitude, lives falling, the wave label widening to "wave 14-15/15"
      for (const s of [{ g: 0, l: 20, w: 0 }, { g: 950, l: 20, w: 3 }, { g: 12500, l: 9, w: 8 }, { g: 99999, l: 3, w: 13 }]) {
        st.gold = s.g; st.lives = s.l; st.waveIdx = s.w; st.sentIdx = s.w + 1;
        window.__TD.script([["tick", 1]]);
        await new Promise((r) => setTimeout(r, 60));
        out.push(Math.round(document.querySelector("#screen-td-play .td-hud__charge").getBoundingClientRect().top));
      }
      return out;
    });
    if (process.env.HUD_DEBUG) console.log("   DEBUG", w + "x" + h, ys.join(","));
    if (ys.some((y) => y <= 0)) bad.push(`${w}x${h}: measured y=${ys.join(",")} — the screen was hidden, so this measured nothing`);
    else if (new Set(ys).size !== 1) bad.push(`${w}x${h}: ⚙️ moved to y=${ys.join(",")}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.deepEqual(bad, [],
    `the ⚙️ changes row as the game state changes, so it moves out from under the player's thumb mid-run:\n  ${bad.join("\n  ")}`);
});

test("⚙️ exchange: the BUTTON buys energy, and says why when it won't", async () => {
  // The engine test drives buyCharge() directly, which proves the mechanic and
  // nothing about the feature — this repo has already paid for that once, when
  // three powers "didn't seem to work at all" while every test called useAbility
  // straight. So press the actual control and read the actual screen.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 5 }); });
  await page.waitForTimeout(120);
  const chip = page.locator("#screen-td-play .td-hud__charge");

  // BUILD phase: it must refuse, and the refusal must be readable — not a
  // silent no-op, which is what a broken button looks like.
  const build = await page.evaluate(() => {
    const b = document.querySelector("#screen-td-play .td-hud__charge");
    // A DOM click, not a Playwright one: aria-disabled makes Playwright's
    // actionability check refuse, while a real finger is unaffected — and a DOM
    // click is this suite's documented way to drive a tap anyway.
    b.click();
    const hint = document.querySelector("#screen-td-play .td-abilhint");
    return { refused: b.getAttribute("aria-disabled") === "true",
             title: b.title, label: b.getAttribute("aria-label"),
             hint: hint && !hint.hidden ? hint.textContent : "" };
  });
  assert.ok(build.refused, "during build the exchange is refused (it is wave-only, like every timed effect)");
  assert.match(build.title + " " + build.label, /wave/i, "…and it SAYS the wave is why");
  // READABLE means readable ON THE SCREEN. This used to assert only title and
  // aria-label — a hover affordance and an AT one — on a game played with a
  // thumb, while the control was `disabled` so its click never fired and the
  // handler's four hint strings were unreachable dead code.
  assert.match(build.hint, /wave/i,
    `tapping the refused chip must SAY why on the field, not only on hover (saw "${build.hint}")`);

  // WAVE phase with gold: one purchase works, the second is refused BY THE CAP.
  const out = await page.evaluate(async () => {
    const st = window.__TD.state();
    st.gold = 99999;
    // __TD.script repaints the HUD as part of its contract; the rAF loop does
    // NOT run in the harness (gold after a bare callWave rises only by the
    // early-call bonus, which is how this was diagnosed), so driving the engine
    // directly would leave the chip painted from the build phase for ever.
    window.__TD.script([["call"], ["tick", 1]]);
    await new Promise((r) => setTimeout(r, 40));
    const b = document.querySelector("#screen-td-play .td-hud__charge");
    const refused = () => b.getAttribute("aria-disabled") === "true";
    const before = { charge: st.charge, gold: st.gold, refused: refused(), buyable: b.classList.contains("is-buyable") };
    b.click();
    await new Promise((r) => setTimeout(r, 60));
    const hintAfterBuy = document.querySelector("#screen-td-play .td-abilhint");
    const after = { charge: st.charge, gold: st.gold, refused: refused(), title: b.title,
                    hint: hintAfterBuy && !hintAfterBuy.hidden ? hintAfterBuy.textContent : "" };
    b.click();                                  // the capped second tap
    await new Promise((r) => setTimeout(r, 60));
    const cappedHint = document.querySelector("#screen-td-play .td-abilhint");
    return { before, after, capped: { charge: st.charge, gold: st.gold,
               hint: cappedHint && !cappedHint.hidden ? cappedHint.textContent : "" },
             price: window.TDData.RULES.chargeBuyBase };
  });
  assert.ok(!out.before.refused && out.before.buyable,
    "mid-wave with gold the chip is live and looks it");
  assert.equal(out.after.charge, out.before.charge + 1, "the tap actually grants the energy");
  assert.equal(out.after.gold, out.before.gold - out.price, "…and charges exactly the quoted price");
  assert.ok(out.after.refused, "a second tap in the same wave is refused — the cap is the safety property");
  assert.match(out.after.title, /wave/i, "…and the chip says the per-wave limit is why");
  assert.equal(out.after.hint, "",
    "a SUCCESSFUL buy clears the hint — a stale refusal left on screen is its own lie");
  assert.match(out.capped.hint, /wave/i,
    `…and the capped tap says the per-wave limit on the field (saw "${out.capped.hint}")`);
  assert.equal(out.capped.charge, out.after.charge, "the capped tap grants nothing");
  assert.equal(out.capped.gold, out.after.gold, "…and, crucially, takes NO gold for it");
});

test("PORTRAIT: the battlefield gets every pixel — full-bleed width, ONE control row", async () => {
  // Portrait is the only mode this game is played in (owner, 2026-07), so the
  // field is optimised for it and the two things that were costing it are
  // pinned here. Landscape still works and is still tested; it is just no
  // longer a design target.
  //   1. The screen's 12px side padding is for text and dialogs — the field
  //      spans the whole viewport. That was 24-36px of lost width on a
  //      width-limited phone (+8-15% field area at 390-430).
  //   2. ONE control row at EVERY width. A 320-wide phone is HEIGHT-limited,
  //      so the two-row block was costing it a third of the battlefield.
  const sizes = [
    { width: 430, height: 932 }, { width: 414, height: 896 }, { width: 390, height: 844 },
    { width: 375, height: 667 }, { width: 360, height: 640 },
    { width: 320, height: 568 }, { width: 320, height: 480 },
    // The iPad, in portrait. This list was seven PHONE widths, and the fort
    // rotates its floor 90 degrees in portrait, so a 0.75 aspect exercises a
    // different branch of resize() than a phone's 0.46 — "a viewport list IS
    // the test", now for the sixth time in this repo.
    { width: 768, height: 1024 }, { width: 834, height: 1112 },
  ];
  const bad = [];
  for (const vp of sizes) {
    await page.setViewportSize(vp);
    await page.evaluate(() => { location.hash = "#td-play"; });
    await page.locator("#screen-td-play").waitFor({ state: "visible" });
    await page.evaluate(() => { window.__TD.newGame(1, {}); });
    await page.waitForTimeout(140);
    const g = await page.evaluate(() => {
      const q = (s) => document.querySelector("#screen-td-play " + s);
      const wrap = q(".td-canvas-wrap"), cv = q(".td-canvas"), ctl = q(".td-controls");
      const small = [];
      document.querySelectorAll("#screen-td-play .td-controls button, #screen-td-play .td-bar--play button").forEach((el) => {
        const b = el.getBoundingClientRect();
        if (b.width && (b.width < 44 || b.height < 44)) small.push(el.className.split(" ")[0] + " " + Math.round(b.width) + "x" + Math.round(b.height));
      });
      return {
        wrapW: Math.round(wrap.getBoundingClientRect().width),
        canvasW: Math.round(cv.getBoundingClientRect().width),
        ctlH: Math.round(ctl.getBoundingClientRect().height),
        scrollW: document.documentElement.scrollWidth,
        scrollH: document.documentElement.scrollHeight,
        small,
      };
    });
    const tag = `${vp.width}x${vp.height}`;
    // The field must be limited by the VIEWPORT, never by a container cap.
    //
    // This clause used to be `wrapW >= vp.width` outright, which is the right
    // law on a phone — the board is WIDTH-limited there, so every pixel of
    // side padding comes straight off the battlefield. On a tablet it is a
    // PROXY that has stopped tracking the property: the board is
    // HEIGHT-limited (canvas 546px inside an 834px screen), so the 720px
    // game-screen cap cannot bind. Measured rather than argued — excluding the
    // fort from that cap moves the canvas by exactly 0px at 768, 834 AND 1024
    // wide, so "fixing" it would be a redundant change whose own guardrail
    // could never fail. Assert the property itself instead: whatever the box
    // is, it is not the thing squeezing the field.
    // The bar is a MEASURED separation, not a slack: a canvas does not grow to
    // exactly its box (it sits ~8px inside), so the first cut used `> wrapW - 2`
    // and a 400px cap that really does squeeze the field 546 -> 392px sailed
    // straight through it. Healthy tablet reads 546/720 = 0.76; a binding cap
    // reads 392/400 = 0.98. 0.90 sits between the two.
    const capBinding = g.wrapW < vp.width - 1 && g.canvasW / g.wrapW > 0.90;
    if (capBinding) bad.push(`${tag}: the field box is ${g.wrapW}px inside a ${vp.width}px screen AND the canvas has grown to meet it (${g.canvasW}px) — the container is taxing the battlefield`);
    // ONE row of controls, never two (a second row comes straight off the field)
    if (g.ctlH > 70) bad.push(`${tag}: the control block is ${g.ctlH}px — that is two rows`);
    // …and none of that may cost a scroll or an undersized adult control
    if (g.scrollW > vp.width) bad.push(`${tag}: page scrolls horizontally (${g.scrollW} > ${vp.width})`);
    if (g.scrollH > vp.height + 1) bad.push(`${tag}: page scrolls vertically (${g.scrollH} > ${vp.height})`);
    if (g.small.length) bad.push(`${tag}: controls under the adult 44px floor: ${g.small.join(", ")}`);
  }
  assert.deepEqual(bad, [], "portrait layout problems:\n" + bad.join("\n"));
  await page.setViewportSize({ width: 390, height: 844 });
});

test("the play screen never makes the PAGE scroll (the in-flow power strip)", async () => {
  // The strip moved OFF the canvas into the layout, which buys a clean field but
  // risks the opposite bug: field + strip + topbar taller than the viewport, so
  // the page scrolls. On iOS that shifts the battlefield under your thumb.
  const bad = [];
  for (const kid of [false, true]) {
    for (const vp of [{ width: 320, height: 480 }, { width: 320, height: 568 },
                      { width: 390, height: 844 }, { width: 810, height: 1080 },
                      { width: 844, height: 390 }]) {
      await page.setViewportSize(vp);
      await page.evaluate(() => { location.hash = "#td-play"; });
      await page.locator("#screen-td-play").waitFor({ state: "visible" });
      await page.evaluate((k) => { window.__TD.newGame(1, { seed: 2, difficulty: k ? "kid" : "normal" }); }, kid);
      await page.waitForTimeout(90);
      await page.evaluate(() => {
        window.__TD.script([["call"], ["tick", 90]]);
        window.TDUI.hud(window.__TD.state());
        const r = window.__TD.render(); r.resize(); r.draw(0);
      });
      const m = await page.evaluate(() => ({
        sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight,
        sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        w: Math.round(document.querySelector("#screen-td-play .td-canvas").getBoundingClientRect().width),
        stripBottom: (() => { const s = document.querySelector("#screen-td-play .td-abils");
          return s && !s.hidden ? Math.round(s.getBoundingClientRect().bottom) : null; })(),
      }));
      const tag = `${kid ? "kid " : ""}${vp.width}x${vp.height}`;
      if (m.sh > m.ch + 1) bad.push(`${tag}: page scrolls vertically (${m.sh} > ${m.ch})`);
      if (m.sw > m.cw + 1) bad.push(`${tag}: page scrolls horizontally (${m.sw} > ${m.cw})`);
      if (m.stripBottom != null && m.stripBottom > vp.height + 1) bad.push(`${tag}: the strip hangs below the viewport (${m.stripBottom})`);
      if (m.w < 140) bad.push(`${tag}: the field collapsed to ${m.w}px wide`);
    }
  }
  assert.deepEqual(bad, [], `play-screen layout problems:\n${bad.join("\n")}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("⏩ RUSH: the CALL button really sends a second wave onto a live field", async () => {
  // Requested: summon a wave while the previous one is still on screen. Driven
  // through the BUTTON, not the API — a feature whose tests all call the engine
  // directly is untested as a feature.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 21 }); });
  await page.waitForTimeout(100);
  const call = page.locator("#screen-td-play .td-call");
  assert.match(await call.textContent(), /CALL/, "build phase: the button offers a CALL");
  await call.click();
  await page.waitForTimeout(60);
  // Inside the settle window a RUSH is refused, so the button goes INERT — a
  // fumbled double-tap has nothing to hit. It stays laid out (it is part of the
  // page now, and vanishing would resize the field under the player's thumb)
  // and says why, rather than silently disappearing.
  assert.equal(await page.evaluate(() => window.__TD.engine().callInfo().reason), "too-soon",
    "immediately after a CALL, a RUSH is refused");
  assert.ok(await page.evaluate(() => {
    const b = document.querySelector("#screen-td-play .td-call");
    return !b.hidden && b.disabled && b.classList.contains("td-call--off");
  }), "…and the button is inert, not offering one");
  assert.match(await call.textContent(), /steady/, "…and says why it can't be used yet");

  // Let the wave settle and walk, then RUSH the next one on top of it.
  await page.evaluate(() => { window.__TD.script([["tick", 90]]); window.TDUI.hud(window.__TD.state()); });
  const before = await page.evaluate(() => ({
    alive: window.__TD.state().enemies.filter((e) => e.alive).length,
    gold: window.__TD.state().gold,
    inFlight: window.__TD.state().sentIdx - window.__TD.state().waveIdx,
  }));
  assert.equal(before.inFlight, 1, "one wave is walking");
  assert.match(await call.textContent(), /RUSH/, "mid-wave the button becomes ⏩ RUSH");
  await call.click();
  await page.evaluate(() => { window.__TD.script([["tick", 60]]); window.TDUI.hud(window.__TD.state()); });
  const after = await page.evaluate(() => ({
    alive: window.__TD.state().enemies.filter((e) => e.alive).length,
    gold: window.__TD.state().gold,
    inFlight: window.__TD.state().sentIdx - window.__TD.state().waveIdx,
    hud: document.querySelector("#screen-td-play .td-hud__wave").textContent,
  }));
  assert.equal(after.inFlight, 2, "the RUSH put a SECOND wave on the field");
  assert.ok(after.gold > before.gold, "…and paid the early-call bonus");
  assert.ok(after.alive > before.alive, "…and there are visibly more bad guys");
  assert.match(after.hud, /wave 1-2\//, "the HUD names BOTH waves that are walking");
  assert.ok(await page.evaluate(() => {
    const b = document.querySelector("#screen-td-play .td-call");
    return !b.hidden && b.disabled && b.classList.contains("td-call--off");
  }), "at the cap the button stops offering (inert, never a live dead control)");
  assert.match(await call.textContent(), /2 waves out/, "…and names the cap it has hit");

  // Clear the field: both waves count, so the run does not replay wave 2.
  await page.evaluate(() => { window.__TD.script([["untilPhase", "build", 200000]]); window.TDUI.hud(window.__TD.state()); });
  assert.equal(await page.evaluate(() => window.__TD.state().waveIdx), 2,
    "clearing an overlapped field advances by BOTH waves");
});

test("AUDIT: every fort overlay lands ON SCREEN, at every viewport", async () => {
  // The scrim was `position: absolute`, so it centred the dialog in its HOST
  // SCREEN — and the fort home is as tall as its level grid. Four worlds of
  // cards made the home ~1250px, so tapping ⭐ Star Tree from the top opened the
  // dialog hundreds of pixels below the fold: it looked like the button was
  // dead. One-pass: every dialog, every viewport, at once.
  await page.evaluate(() => {
    const all = {}; for (const l of window.TDData.LEVELS) all[l.id] = 3;
    localStorage.setItem("jon-td-save-v1", JSON.stringify({ v: 1, difficulty: "normal",
      stars: { casual: {}, normal: all, heroic: {} }, ach: ["firstblood"], endlessBest: { bedroom: 12 } }));
  });
  await page.reload({ waitUntil: "load" });
  // DERIVED from the fort home's own controls, not a hand-written list. It WAS
  // a literal of six, and the 🎒 Powers picker — the newest dialog in the fort —
  // was simply not in it, so the one test written to catch "a dialog opens below
  // the fold and the button looks dead" could not see the newest button. That is
  // this repo's most-repeated defect ("a scan's own list is part of the scan":
  // the flex-gap law guarded only main.css, the live-verify probe hit only
  // index.html, the VS16 scan hand-listed nine files, FIELD_TRAIT hand-listed
  // twelve fields). A new fort button must now either open an auditable dialog
  // or consciously join NOT_A_DIALOG below.
  // Every fort-home button currently opens an auditable dialog. The one former
  // exemption (.td-kid-open) went with the retired Kid Fort mode; a new
  // navigating button must consciously re-open this list.
  const NOT_A_DIALOG = {};
  const OPENERS = await page.evaluate((skip) => {
    const out = {};
    const btns = document.querySelectorAll("#screen-td-home .td-metabtn, #screen-td-home .td-adminrow button");
    for (const b of btns) {
      const sel = "." + [...b.classList].find((c) => /-open$/.test(c));
      if (sel === ".undefined" || skip[sel]) continue;
      out[(b.textContent || sel).trim()] = sel;
    }
    return out;
  }, NOT_A_DIALOG);
  assert.ok(Object.keys(OPENERS).length >= 7,
    `the fort's dialog openers are derived from its buttons (found ${Object.keys(OPENERS).length}: ${Object.values(OPENERS).join(" ")})`);
  const bad = [];
  for (const vp of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(vp);
    for (const name of Object.keys(OPENERS)) {
      await page.evaluate(() => { location.hash = "#__renav"; });
      await page.waitForTimeout(30);
      await page.evaluate(() => { location.hash = "#td-home"; });
      await page.locator("#screen-td-home").waitFor({ state: "visible" });
      await page.waitForTimeout(60);
      await page.evaluate((sel) => { const b = document.querySelector(sel); if (b) b.click(); }, OPENERS[name]);
      await page.waitForTimeout(120);
      const r = await page.evaluate(() => {
        const box = document.querySelector(".td-overlay__box");
        if (!box) return null;
        const b = box.getBoundingClientRect();
        return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right),
          vw: window.innerWidth, vh: window.innerHeight,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
      });
      const tag = `${vp.width}x${vp.height} ${name}`;
      if (!r) { bad.push(`${tag}: no overlay opened`); continue; }
      if (r.top < -1) bad.push(`${tag}: top ${r.top} above the viewport`);
      if (r.bottom > r.vh + 1) bad.push(`${tag}: bottom ${r.bottom} below the ${r.vh}px viewport`);
      if (r.left < -1 || r.right > r.vw + 1) bad.push(`${tag}: ${r.left}..${r.right} outside the ${r.vw}px viewport`);
      if (r.overflow) bad.push(`${tag}: the page overflows horizontally`);
      await page.evaluate(() => { const c = document.querySelector(".td-overlay"); if (c) c.click(); });
    }
  }
  assert.deepEqual(bad, [], `overlays off screen:\n${bad.join("\n")}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("🚪 losing to a flank says so — the one defeat whose fix is POSITIONAL", async () => {
  // The post-mortem reads the counter matrix: what got past you, and what could
  // not even reach it. That is the right diagnosis for every defeat EXCEPT this
  // one. If part of the wave walked in behind your guns, no change of tower
  // line helps — the fix is where you built, not what — and the counter advice
  // on its own would send you off to rebuild for the wrong reason.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const out = await page.evaluate(() => {
    window.__TD.newGame(2, { seed: 7 });          // L2's only door is on wave 6
    window.__TD.grantGold(5000);
    const e = window.__TD.engine();
    window.__TD.script(e.levelDef.pads.map((p) => ["place", "dart", p.id]));
    const ups = [];
    e.state.towers.forEach((t, i) => { ups.push(["upgrade", i]); ups.push(["upgrade", i]); });
    window.__TD.script(ups);
    // play up to the door wave with a real board…
    let guard = 0;
    while (e.state.sentIdx < 5 && e.state.phase !== "lost" && guard++ < 40) {
      window.__TD.script([["call"], ["untilPhase", "build", 400000]]);
    }
    const reached = e.state.sentIdx;
    // …then strip it, so the flank is what actually lands. `sell` takes an
    // INDEX and the array compacts, so index 0 repeatedly empties the board.
    window.__TD.script(e.state.towers.map(() => ["sell", 0]));
    guard = 0;
    while (e.state.phase !== "lost" && e.state.phase !== "won" && guard++ < 40) {
      window.__TD.script([["call"], ["untilPhase", "build", 400000]]);
    }
    return { reached, phase: e.state.phase, wave: e.state.waveIdx + 1 };
  });
  assert.equal(out.reached, 5, `the probe must reach the door wave, got sentIdx ${out.reached}`);
  assert.equal(out.phase, "lost", `the probe must actually lose, ended ${out.phase}`);
  assert.equal(out.wave, 6, `…on the door wave, lost on ${out.wave}`);

  await page.locator(".td-overlay--lose").waitFor({ state: "visible", timeout: 5000 });
  const txt = await page.locator(".td-overlay--lose").textContent();
  assert.match(txt, /side door/i,
    `the defeat screen must name the flank, said: ${txt.replace(/\s+/g, " ").slice(0, 240)}`);
  assert.match(txt, /🚪/, "…and mark it with the door glyph the field uses");

  // …and it must NOT say that on an ordinary defeat, or the line is noise that
  // appears on every loss and tells you nothing.
  const plain = await page.evaluate(() => {
    window.__TD.newGame(2, { seed: 7 });
    const e = window.__TD.engine();
    let guard = 0;
    while (e.state.phase !== "lost" && e.state.phase !== "won" && guard++ < 40) {
      window.__TD.script([["call"], ["untilPhase", "build", 400000]]);
    }
    return { phase: e.state.phase, wave: e.state.waveIdx + 1 };
  });
  assert.equal(plain.phase, "lost", "the control must also lose");
  assert.ok(plain.wave < 6, `…on an ordinary wave, not the door one (was ${plain.wave})`);
  await page.locator(".td-overlay--lose").waitFor({ state: "visible", timeout: 5000 });
  const txt2 = await page.locator(".td-overlay--lose").textContent();
  assert.ok(!/side door/i.test(txt2),
    `an ordinary defeat must NOT blame a flank: ${txt2.replace(/\s+/g, " ").slice(0, 200)}`);
});

test("⏸ backgrounding the app pauses the battle, and coming back says so", async () => {
  // This has shipped for a while with NO test, which is a real gap for a feature
  // whose whole job is to protect a run: a phone call mid-wave must not cost you
  // the level, and returning must not drop you straight back into a fight you
  // cannot see. Measured by whether the ENGINE actually advances rather than by
  // an internal flag — there is no paused() hook, and the effect is the claim.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 4 });
    window.__TD.script([["call"], ["tick", 30]]);   // a LIVE wave, which is when it matters
  });
  // __TD.newGame leaves the run PAUSED, so the battle has to be handed back
  // before any of this means anything.
  await page.locator("#screen-td-play .td-pause").click();
  await page.waitForTimeout(400);
  const ticks = () => page.evaluate(() => window.__TD.engine().state.tick);
  const t0 = await ticks();
  await page.waitForTimeout(400);
  const t1 = await ticks();
  assert.ok(t1 > t0, `the probe must start from a RUNNING battle (tick ${t0} -> ${t1})`);

  // go away
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(120);
  const h0 = await ticks();
  await page.waitForTimeout(500);
  const h1 = await ticks();
  assert.equal(h1, h0, `backgrounding must stop the battle (tick ran ${h0} -> ${h1})`);

  // …and come back
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(250);
  const r0 = await ticks();
  await page.waitForTimeout(400);
  assert.equal(await ticks(), r0,
    "returning must NOT silently resume — that drops you into a wave you never saw start");
  assert.ok(await page.locator('.td-overlay [data-act="music"]').count(),
    "…it must open the pause menu, so the state is visible and escapable");

  // and the menu hands the battle back
  await page.locator('.td-overlay [data-act="resume"]').click();
  await page.waitForTimeout(400);
  assert.ok((await ticks()) > r0, "Resume must return control");
});

test("↩ the panel OFFERS undo, and taking it restores the gold", async () => {
  // The engine test proves the rule; this proves the player can reach it. Undo
  // deliberately takes the SELL slot rather than adding a fourth control, so
  // the two claims here are that the slot changes when the offer is live and
  // that the same button does the right one of the two things.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const pad = await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 5 });
    const p = window.__TD.engine().levelDef.pads[0];
    return { id: p.id, cx: p.cx, cy: p.cy };
  });
  const before = await page.evaluate(() => window.__TD.engine().state.gold);
  await page.evaluate((p) => { window.__TD.script([["place", "dart", p.id]]); }, pad);
  const spent = before - (await page.evaluate(() => window.__TD.engine().state.gold));
  assert.ok(spent > 0, "the probe must actually have bought something");

  const rect = await page.locator(".td-canvas").boundingBox();
  const sp = await page.evaluate((p) => window.__TD.w2s(p.cx + 0.5, p.cy + 0.5), pad);
  await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  await page.locator(".td-panel").waitFor({ state: "visible" });

  const label = await page.locator(".td-sell").textContent();
  assert.match(label, /undo/i, `the slot must offer undo on a just-placed tower, saw "${label}"`);
  assert.ok(await page.locator(".td-sell--undo").count(), "…and must be styled as the undo variant, not the sell one");

  await page.locator(".td-sell").click();
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => ({
    gold: window.__TD.engine().state.gold, towers: window.__TD.engine().state.towers.length,
  }));
  assert.equal(after.towers, 0, "undo must remove the tower");
  assert.equal(after.gold, before, `undo must restore the full ${spent} gold, gold is ${after.gold} of ${before}`);

  // …and once the offer has lapsed the SAME slot is an ordinary sell again, at
  // the ordinary rate. Without this the test would pass on a button that says
  // "undo" for ever and quietly refunds everything.
  await page.evaluate((p) => {
    window.__TD.newGame(1, { seed: 5 });
    window.__TD.script([["place", "dart", p.id], ["call"], ["tick", 40]]);
  }, pad);
  const mid = await page.evaluate(() => window.__TD.engine().state.gold);
  const sp2 = await page.evaluate((p) => window.__TD.w2s(p.cx + 0.5, p.cy + 0.5), pad);
  await page.mouse.click(rect.x + sp2.x, rect.y + sp2.y);
  await page.locator(".td-panel").waitFor({ state: "visible" });
  const label2 = await page.locator(".td-sell").textContent();
  assert.match(label2, /sell/i, `mid-wave the slot must be an ordinary sell, saw "${label2}"`);
  await page.locator(".td-sell").click();
  await page.waitForTimeout(120);
  const back = (await page.evaluate(() => window.__TD.engine().state.gold)) - mid;
  assert.ok(back > 0 && back < spent,
    `a mid-wave sell must pay the ordinary rate, not the full price (got ${back} of ${spent})`);
});

test("🎵 the music actually PLAYS, and follows the run", async () => {
  // The score's own test is pure, which is what makes it cheap — and is exactly
  // why it cannot see the PLAYER: the toggle, the clock, the mute gate and the
  // call into JoshAudio.tone(). This drives all of it through the real ⏸ menu.
  //
  // Worth recording, because I nearly wrote the opposite here: the tempting
  // story was that calling `TDLogic.musicStep` from td-main (whose alias is
  // `TD`) had left the music silently dead behind the composer's try/catch.
  // Mutation says otherwise — re-introducing that exact line keeps this test
  // GREEN, because TDLogic and TDData are globals and resolve fine from inside
  // the IIFE. Using the module's own aliases is a consistency fix, not a bug
  // fix, and claiming otherwise would have sent the next reader hunting a
  // failure that never happened. What this test DOES catch, both proven: a
  // composer that sounds nothing, and a toggle that no longer starts the loop.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 3 });
    // the fort's audio is muted by default and music is off by default — both
    // are the shipped state, so both have to be turned on to hear anything.
    window.JoshAudio.setMuted(false);
    window.__heard = [];
    const real = window.JoshAudio.tone;
    window.JoshAudio.tone = function (hz, opts) { window.__heard.push({ hz, o: opts || {} }); return real.call(this, hz, opts); };
  });
  // drive the REAL control: ⏸ opens the pause menu, then 🎵 Music toggles it.
  // __TD.newGame leaves the run paused, so the first ⏸ can be a resume — click
  // until the menu is actually up rather than assuming.
  for (let i = 0; i < 3; i++) {
    if (await page.locator('.td-overlay [data-act="music"]').count()) break;
    await page.locator("#screen-td-play .td-pause").click();
    await page.waitForTimeout(150);
  }
  assert.ok(await page.locator('.td-overlay [data-act="music"]').count(), "the pause menu must offer the music toggle");
  await page.evaluate(() => { window.__heard.length = 0; });
  await page.locator('.td-overlay [data-act="music"]').click();
  // 2.6s is ~13 steps at 190ms. It has to be that long because this runs in the
  // BUILD phase, where the arrangement is deliberately stripped to the strong
  // beats — about 0.6 voices per step, so a 7-step window legitimately hears
  // only 4 notes. The first cut of this assertion failed on working code for
  // exactly that reason.
  await page.waitForTimeout(2600);

  const heard = await page.evaluate(() => window.__heard.slice());
  assert.ok(heard.length >= 6,
    `turning the music on must actually sound notes, heard ${heard.length}`);

  // …and they must be THIS world's notes, not some other tune. Bedroom is G,
  // so every pitch has to appear in the pure score for bedroom.
  const legal = await page.evaluate(() => {
    const set = new Set();
    for (const ph of ["build", "wave"]) {
      for (let i = 0; i < 64; i++) {
        for (const v of window.TDLogic.musicStep(i, { world: "bedroom", phase: ph })) set.add(v.hz.toFixed(2));
      }
    }
    return [...set];
  });
  const stray = heard.map((h) => h.hz.toFixed(2)).filter((h) => legal.indexOf(h) < 0);
  assert.deepEqual(stray.slice(0, 5), [],
    `every note must come from THIS world's score, stray pitches: ${stray.slice(0, 5).join(", ")}`);

  // …and the RUN has to reach the score. The ctx is computed in td-main from
  // live state, which no pure test can see: with lives low the same world must
  // start producing the tense voice, identified by the drone (the only voice
  // over a second long).
  await page.evaluate(() => {
    window.__TD.engine().state.lives = 2;
    window.__heard.length = 0;
  });
  await page.waitForTimeout(2600);
  const scared = await page.evaluate(() => window.__heard.some((h) => (h.o.duration || 0) >= 1));
  assert.equal(scared, true, "with the door nearly down, the score must turn tense (the drone)");

  // turning it back off must stop the loop, not just mute a note
  await page.locator('.td-overlay [data-act="music"]').click();
  await page.waitForTimeout(260);
  await page.evaluate(() => { window.__heard.length = 0; });
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => window.__heard.length);
  assert.equal(after, 0, `music off must END the loop, still heard ${after} notes`);
});

test("🚪 a side door warns you a WAVE ahead, not as it opens", async () => {
  // Reported: you cannot prepare for a flank you are only told about once your
  // gold is committed. The marker existed but only for waves IN FLIGHT plus the
  // one queued during build — i.e. it appears at the moment it is too late to
  // move guns. A door changes WHERE the board needs to be, so it needs a wave
  // of notice. L2 carries exactly one door, on wave index 5.
  //
  // The build phase is set DIRECTLY rather than played forward, deliberately:
  // the claim under test is which waves the marker looks at, and playing there
  // would instead be a test of whether 300 gold survives five waves (it does
  // not — that buys four tier-1 darts). Nothing is ticked, only drawn.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const seen = await page.evaluate(() => {
    window.__TD.newGame(2, { seed: 7 });
    const e = window.__TD.engine(), r = window.__TD.render();
    const out = [];
    for (let n = 0; n < 7; n++) {
      const st = e.state;
      st.phase = "build"; st.waveIdx = n; st.sentIdx = n;
      const d = r.doorInfo();
      out.push({ sent: n, doors: d.doors.slice(), soon: d.soon.slice() });
    }
    return out;
  });
  const at = (n) => seen[n] || {};
  assert.equal(seen.length, 7, `the probe must reach every build it claims to: ${JSON.stringify(seen)}`);

  // THE CLAIM: one wave out it is WARNED, and it is not yet active.
  assert.ok(at(4).soon.length > 0,
    `at the build before wave 5 the door must be warned, saw ${JSON.stringify(at(4))}`);
  assert.equal(at(4).doors.length, 0,
    `…and must NOT yet be drawn as an open door, saw ${JSON.stringify(at(4))}`);
  // …and when the wave is actually queued it flips to active, exactly once.
  assert.ok(at(5).doors.length > 0,
    `at the build for wave 5 the door must be ACTIVE, saw ${JSON.stringify(at(5))}`);
  assert.equal(at(5).soon.length, 0,
    `…and must not also be warned, or both styles paint the same spot: ${JSON.stringify(at(5))}`);
  // That last clause is VACUOUS on L2, where wave 6 has no door at all — it is
  // empty for the wrong reason. L26 is the level that can actually test it:
  // waves 12 and 13 both open a door at the SAME point, so without the
  // exclusion the active gate and the warning ring would paint on top of each
  // other and the player could not tell "open now" from "one wave out".
  const both = await page.evaluate(() => {
    window.__TD.newGame(26, { seed: 7 });
    const e = window.__TD.engine(), r = window.__TD.render();
    const st = e.state;
    st.phase = "build"; st.waveIdx = 12; st.sentIdx = 12;
    const d = r.doorInfo();
    return { doors: d.doors.slice(), soon: d.soon.slice() };
  });
  assert.deepEqual(both.doors, [36], `L26 wave 12 opens its door at 36, saw ${JSON.stringify(both)}`);
  assert.deepEqual(both.soon, [],
    `wave 13 opens the SAME door, so it must not ALSO be warned: ${JSON.stringify(both)}`);
  // two waves out is too early — otherwise the marker is permanent decoration
  assert.equal(at(3).soon.length + at(3).doors.length, 0,
    `two waves out is too early to warn, saw ${JSON.stringify(at(3))}`);

  // AND IT ACTUALLY PAINTS. Without this the test proves a data flag, not a
  // warning — the class this repo hit when the Fan's beam and the muzzle flash
  // each turned out to draw nothing at all. During build the field is static
  // and the door sits on the lane, so between two builds the only thing that
  // can differ in a tight box around it is the warning itself.
  const ink = await page.evaluate(() => {
    window.__TD.newGame(2, { seed: 7 });   // back to L2 — the clause above left L26 loaded
    const e = window.__TD.engine(), r = window.__TD.render();
    const doorAt = e.levelDef.waves[5].groups.find((g) => g.at > 0).at;
    const sample = () => {
      const p = e.posAt(doorAt);
      const sc = r.worldToScreen(p.x + 0.5, p.y + 0.5);
      const cv = document.querySelector("#screen-td-play .td-canvas");
      const g = cv.getContext("2d");
      const dpr = cv.width / cv.getBoundingClientRect().width;
      const R = Math.max(6, Math.round(r.cellSize() * 0.75 * dpr));
      const d = g.getImageData(Math.round(sc.x * dpr) - R, Math.round(sc.y * dpr) - R, R * 2, R * 2).data;
      let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      return sum;
    };
    const st = e.state;
    st.phase = "build"; st.waveIdx = 3; st.sentIdx = 3;
    r.draw(0); const quiet = sample();
    st.waveIdx = 4; st.sentIdx = 4;
    r.draw(0); const warned = sample();
    return { quiet, warned, soon: r.doorInfo().soon.length };
  });
  assert.equal(ink.soon, 1, "the ink probe must be taken in the warned state");
  assert.notEqual(ink.warned, ink.quiet,
    `the warning must actually paint on the field (ink ${ink.quiet} -> ${ink.warned})`);
});

test("a resize while the field is HIDDEN must not collapse the battlefield", async () => {
  // A hidden screen measures 0 wide, and resize() clamped the cell to its
  // minimum — so any code path that starts a level while the play screen is
  // hidden (or an iOS resize event during a tab switch) rebuilt the field at
  // 10px cells and left it that way until something resized again. Found by the
  // World-4 tap test failing only when it ran AFTER the Kid Fort test.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 6 }); });
  await page.waitForTimeout(120);
  const good = await page.evaluate(() => {
    const c = document.querySelector("#screen-td-play .td-canvas");
    return { w: c.clientWidth, h: c.clientHeight };
  });
  assert.ok(good.w > 200, `the visible field is a real size (${good.w}×${good.h})`);
  await page.evaluate(() => {
    document.querySelector("#screen-td-play").hidden = true;
    window.__TD.render().resize();          // the dangerous call
    document.querySelector("#screen-td-play").hidden = false;
  });
  const after = await page.evaluate(() => {
    const c = document.querySelector("#screen-td-play .td-canvas");
    return { w: c.clientWidth, h: c.clientHeight };
  });
  assert.deepEqual(after, good, "resizing while hidden keeps the last good field size");
});

test("the NEWEST world opens, builds, and plays in a real browser", async () => {
  // No browser test had ever entered World 4 — the whole attic was engine-only,
  // and that is how it shipped with the bedroom's spawn marker and a boss that
  // rendered as a sock. Pinned to the LAST world in the data so the newest one
  // is always the one under test, instead of naming a world that stops being new.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const world = await page.evaluate(() => window.TDData.LEVELS[window.TDData.LEVELS.length - 1].world);
  const attic = await page.evaluate((w) => window.TDData.LEVELS.filter((l) => l.world === w).map((l) => l.id), world);
  assert.equal(attic.length, 4, `the newest world ("${world}") ships four levels`);
  // it must also carry its own presentation data — the attic fell through the
  // renderer's if/else chain and painted a 🛏️ at its spawn for a whole release
  const wd = await page.evaluate((w) => window.TDData.WORLDS[w], world);
  assert.ok(wd && wd.spawnGlyph && wd.label, `world "${world}" has its own label + spawn glyph`);
  for (const id of attic) {
    const ok = await page.evaluate((lid) => {
      window.__TD.newGame(lid, { seed: 11 });
      const r = window.__TD.render(); r.resize(); r.draw(0);
      const st = window.__TD.state();
      window.__TD.script([["place", "dart", window.__TD.engine().levelDef.pads[0].id]]);
      window.__TD.script([["call"], ["tick", 200]]);
      return { built: st.towers.length, phase: st.phase, seen: st.enemies.length, world: window.__TD.engine().levelDef.world };
    }, id);
    assert.equal(ok.world, world, `L${id} belongs to the newest world`);
    assert.equal(ok.built, 1, `L${id}: a real tower was placed`);
    assert.ok(ok.seen > 0 || ok.phase !== "wave", `L${id}: the wave actually ran`);
  }

  // …and a real field TAP builds on an attic pad (not just the scripted API).
  await page.evaluate((lid) => { window.__TD.newGame(lid, { seed: 4 }); }, attic[0]);
  await page.waitForTimeout(150);
  const rect = await page.locator("#screen-td-play .td-canvas").boundingBox();
  const pad = await page.evaluate(() => {
    const p = window.__TD.engine().levelDef.pads[0];
    return window.__TD.w2s(p.cx + 0.5, p.cy + 0.5);
  });
  await page.mouse.click(rect.x + pad.x, rect.y + pad.y);
  await page.locator('.td-bubble .td-buy[data-line="dart"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('.td-bubble .td-buy[data-line="dart"]').click();
  assert.equal(await page.evaluate(() => window.__TD.state().towers.length), 1,
    "tapping a pad in the newest world opens the build menu and really places the tower");
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("ART: every tower TIER draws differently, and each tier-4 branch is its own machine", async () => {
  // "I want towers to look visibly different each level up they get." Before this
  // pass only the Dart changed at all (barrel count); mortar/fan/camp drew the
  // IDENTICAL sprite at every tier, and a tier-4 branch was indistinguishable
  // from the tier-3 it cost 300 gold to become. This is the generic guardrail: it
  // renders each variant alone on the field and hashes the pixels around it, so
  // any line that ships without per-tier art fails — including future ones.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 5 }); });
  await page.waitForTimeout(80);
  const sigs = await page.evaluate(() => {
    const st = window.__TD.state(), r = window.__TD.render();
    r.resize();
    const canvas = document.querySelector("#screen-td-play .td-canvas");
    const ctx = canvas.getContext("2d");
    const dpr = canvas.width / canvas.clientWidth;
    const out = {};
    for (const line of Object.keys(window.TDData.TOWERS)) {
      // DERIVED from the line's own branches. This was the literal
      // [1, 2, 3, "a", "b"], so when the Dart and the Fan each gained a THIRD
      // ultimate their sprites would have shipped completely unchecked — the
      // "a scan's own list is part of the scan" class, inside the guardrail
      // whose whole job is to stop a tier shipping without art.
      for (const v of [1, 2, 3].concat(Object.keys(window.TDData.TOWERS[line].branches || {}))) {
        st.towers.length = 0; st.soldiers.length = 0; st.enemies.length = 0;
        st.towers.push({
          id: 1, lineId: line, tier: typeof v === "number" ? v : 4,
          branch: typeof v === "number" ? "" : v, padId: "art", cx: 6, cy: 6,
          cooldown: 0, targetId: 0, zapAcc: 0, heat: 0, targeting: "first",
          spent: 0, rallyX: 0, rallyY: 0, disabledUntil: 0,
        });
        r.draw(0); // tick is frozen (the run is paused), so spinning art is stable
        const p = window.__TD.w2s(6.5, 6.5);
        const half = 44;
        const d = ctx.getImageData(
          Math.max(0, Math.round((p.x - half) * dpr)), Math.max(0, Math.round((p.y - half) * dpr)),
          Math.round(half * 2 * dpr), Math.round(half * 2 * dpr)
        ).data;
        let h = 5381;
        for (let i = 0; i < d.length; i += 4) h = ((h * 33) ^ (d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 11)) >>> 0;
        out[line + ":" + v] = h;
      }
    }
    st.towers.length = 0;
    return out;
  });
  const lines = await page.evaluate(() => Object.keys(window.TDData.TOWERS));
  const BRANCH_KEYS = await page.evaluate(() => {
    const o = {};
    for (const [k, T] of Object.entries(window.TDData.TOWERS)) o[k] = Object.keys(T.branches || {});
    return o;
  });
  for (const line of lines) {
    const s = (v) => sigs[line + ":" + v];
    assert.notEqual(s(1), s(2), `${line}: tier 2 must look different from tier 1`);
    assert.notEqual(s(2), s(3), `${line}: tier 3 must look different from tier 2`);
    assert.notEqual(s(1), s(3), `${line}: tier 3 must look different from tier 1`);
    // every branch differs from the tier it replaces AND from each sibling —
    // pairwise and derived, so a third (or fourth) inherits the check
    const keys = BRANCH_KEYS[line];
    assert.ok(keys.length >= 2, `${line} must offer a real tier-4 choice (saw ${keys.length})`);
    for (const k of keys) {
      assert.notEqual(s(3), s(k), `${line}: the ${k} branch must look different from tier 3`);
    }
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        assert.notEqual(s(keys[i]), s(keys[j]),
          `${line}: tier-4 branches ${keys[i]} and ${keys[j]} must not look alike`);
      }
    }
  }

  // …and the SQUAD a camp fields must show its rank too: every soldier drew as
  // the same tier-1 grunt, so upgrading a camp — and especially taking Dino
  // Squad or RC Racers — changed nothing you could see on the field.
  const sol = await page.evaluate(() => {
    const st = window.__TD.state(), r = window.__TD.render();
    const canvas = document.querySelector("#screen-td-play .td-canvas");
    const ctx = canvas.getContext("2d");
    const dpr = canvas.width / canvas.clientWidth;
    const out = {};
    for (const v of [1, 2, 3, "a", "b"]) {
      st.towers.length = 0; st.soldiers.length = 0; st.enemies.length = 0;
      st.towers.push({
        id: 7, lineId: "camp", tier: typeof v === "number" ? v : 4,
        branch: typeof v === "number" ? "" : v, padId: "art", cx: 2, cy: 2,
        cooldown: 0, targetId: 0, zapAcc: 0, heat: 0, targeting: "first",
        spent: 0, rallyX: 0, rallyY: 0, disabledUntil: 0,
      });
      st.soldiers.push({ id: 1, campId: 7, alive: true, hp: 100, maxHp: 100, x: 9, y: 9, postX: 9, postY: 9, engagedId: 0, respawnAt: 0 });
      r.draw(0);
      const p = window.__TD.w2s(9, 9);
      const half = 26;
      const d = ctx.getImageData(
        Math.max(0, Math.round((p.x - half) * dpr)), Math.max(0, Math.round((p.y - half) * dpr)),
        Math.round(half * 2 * dpr), Math.round(half * 2 * dpr)
      ).data;
      let h = 5381;
      for (let i = 0; i < d.length; i += 4) h = ((h * 33) ^ (d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 11)) >>> 0;
      out[v] = h;
    }
    st.towers.length = 0; st.soldiers.length = 0;
    return out;
  });
  const seen = {};
  for (const v of Object.keys(sol)) (seen[sol[v]] = seen[sol[v]] || []).push(v);
  const same = Object.keys(seen).filter((h) => seen[h].length > 1).map((h) => seen[h].join(" = "));
  assert.deepEqual(same, [], `camp tiers whose SOLDIERS draw identically: ${same.join("; ")}`);
});

// A helper both tower-art tests below share: park one tower alone on the field,
// draw, and return the ink MASK (which pixels the tower changed) plus a coarse
// occupancy grid of it. Shape, not colour — a repaint must not be able to pass
// a distinctness check that a player reads as "two green balls".
const TOWER_SHAPE_PROBE = `(lines, tiers, pens, boost) => {
  const st = window.__TD.state(), r = window.__TD.render();
  r.resize();
  if (pens) r.setTowerPens(pens);
  const canvas = document.querySelector("#screen-td-play .td-canvas");
  const ctx = canvas.getContext("2d");
  const dpr = canvas.width / canvas.clientWidth;
  const HALF = 44, p = window.__TD.w2s(6.5, 6.5);
  const grab = () => {
    const d = ctx.getImageData(Math.round((p.x - HALF) * dpr), Math.round((p.y - HALF) * dpr),
      Math.round(HALF * 2 * dpr), Math.round(HALF * 2 * dpr));
    return { d: d.data, w: d.width, h: d.height };
  };
  st.towers.length = 0; st.soldiers.length = 0; st.enemies.length = 0;
  r.draw(0);
  const B = grab();
  const out = {};
  for (const line of lines) for (const v of tiers) {
    st.towers.length = 0; st.soldiers.length = 0;
    st.towers.push({
      id: 1, lineId: line, tier: typeof v === "number" ? v : 4,
      branch: typeof v === "number" ? "" : v, padId: "art", cx: 6, cy: 6,
      cooldown: 0, targetId: 0, zapAcc: 0, heat: 0, targeting: "first",
      spent: 0, rallyX: 0, rallyY: 0, disabledUntil: 0,
      boostUntil: boost ? 1e9 : 0, crashUntil: 0,
    });
    r.draw(0);
    const A = grab();
    const ink = new Uint8Array(A.w * A.h);
    for (let q = 0, i = 0; q < ink.length; q++, i += 4) {
      const dd = Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i+1] - B.d[i+1]) + Math.abs(A.d[i+2] - B.d[i+2]);
      ink[q] = dd > 30 ? 1 : 0;
    }
    const G = 10, occ = [];
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
      let n = 0, t = 0;
      const xa = Math.round(gx*A.w/G), xb = Math.round((gx+1)*A.w/G);
      const ya = Math.round(gy*A.h/G), yb = Math.round((gy+1)*A.h/G);
      for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) { n += ink[y*A.w+x]; t++; }
      occ.push(t ? n/t : 0);
    }
    out[line + ":" + v] = occ;
  }
  st.towers.length = 0;
  r.setTowerPens(9);
  return out;
}`;

test("ART: the four tower LINES do not draw the same shape", async () => {
  // Measured on the art this replaced, at the 27px cell a phone actually
  // renders: the three SHOOTING lines were all discs — circularity 0.669 (dart),
  // 0.687 (mortar), 0.698 (fan) against camp's 0.395 triangle — and dart-vs-fan
  // at tier 1 scored 0.301 on this grid, the tightest cross-line pair in the
  // game. So at the moment you place a tower, which is exactly when you most
  // need to know what you bought, three of four lines were the same ball in a
  // different colour and only the hue told them apart. This is the enemy
  // near-twin law applied to towers, and the threshold sits ABOVE that measured
  // 0.301 and below the rebuilt minimum, so it fails on the art it replaced.
  //   Tier 1 only would be the weak version: a line must stay itself as it
  // upgrades, so every tier is checked. Derived from DATA.TOWERS, so a fifth
  // line inherits it.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 5 }); });
  await page.waitForTimeout(80);
  const lines = await page.evaluate(() => Object.keys(window.TDData.TOWERS));
  const occ = await page.evaluate(
    ([probe, ls]) => eval(probe)(ls, [1, 2, 3], 0), [TOWER_SHAPE_PROBE, lines]);
  const worst = [];
  for (const t of [1, 2, 3]) {
    for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
      const a = occ[lines[i] + ":" + t], b = occ[lines[j] + ":" + t];
      let s = 0; for (let q = 0; q < a.length; q++) s += (a[q] - b[q]) ** 2;
      worst.push([`T${t} ${lines[i]}/${lines[j]}`, Math.sqrt(s)]);
    }
  }
  worst.sort((p, q) => p[1] - q[1]);
  const tooAlike = worst.filter(([, d]) => d < 0.33);
  assert.deepEqual(tooAlike.map(([k]) => k), [],
    `these tower LINES draw nearly the same silhouette, so a player cannot tell what they built without reading the colour: ${
      tooAlike.map(([k, d]) => k + "=" + d.toFixed(3)).join(", ")} (closest overall ${worst[0][0]}=${worst[0][1].toFixed(3)})`);
});

test("ART: the shipped ink budget covers a whole tower, with nothing starving it", async () => {
  // The per-sprite ink budget is consumed in DRAW ORDER, so decoration drawn
  // before the body silently steals the body's contour — and it had. The
  // plinth's six 0.028u skirt bolts (0.75px at a 27px cell, so inking them buys
  // literally nothing) plus its fill and ring spent all four pens BEFORE the
  // tower was drawn, which is the whole of the measured slide from edgeMed 23 at
  // tier 1, where there is no plinth at all, to 68 at tier 3.
  //   A fixed threshold cannot catch that — 68 is still a perfectly dark edge in
  // absolute terms. The falsifiable property is SATURATION: if the shipped
  // budget really does cover the body, handing out more pens changes nothing. It
  // is mutation-proven both ways — un-noInk the skirt bolts, or draw any new
  // decoration before the body, and the extra pens start changing pixels.
  const lines = await page.evaluate(() => Object.keys(window.TDData.TOWERS));
  //   Driven BOOSTED as well as plain, because ⚡ Overclock strokes a ring
  // round the tower before its body and that ring is wide enough to take a pen
  // — so a buffed tower could have had its own silhouette starved by the buff,
  // the plinth-bolt trap one ring further out. A status overlay never inks.
  const starved = [];
  for (const boost of [false, true]) {
    const [ship, rich] = await page.evaluate(
      ([probe, ls, b]) => [eval(probe)(ls, [1, 2, 3, "a", "b"], 9, b), eval(probe)(ls, [1, 2, 3, "a", "b"], 40, b)],
      [TOWER_SHAPE_PROBE, lines, boost]);
    for (const k of Object.keys(ship)) {
      let s = 0;
      for (let q = 0; q < ship[k].length; q++) s += (ship[k][q] - rich[k][q]) ** 2;
      if (Math.sqrt(s) > 0.02) starved.push((boost ? "boosted " : "") + k + "=" + Math.sqrt(s).toFixed(3));
    }
  }
  assert.deepEqual(starved, [],
    `these tower variants draw DIFFERENTLY with a bigger ink budget, so the shipped budget is being spent on decoration before the body and their silhouette is starved: ${starved.join(", ")}`);
});

test("ART: every BOSS wears the crown, and there is exactly one crown", async () => {
  // 4 of 8 bosses drew NO boss mark at all — including the Bed Monster, the
  // first boss you ever meet, and the Big Magnet, the campaign's finale — while
  // the other four each hand-rolled their own 7-point polygon. The fort home
  // puts a 👑 on a boss finale and the guide gives every boss an "its kit
  // escalates" line, so the one place a player could NOT tell a boss from a big
  // enemy was the battlefield. Derived from DATA.ENEMIES, so a ninth boss
  // inherits the check; mutation: delete a `bossCrown(` call → red.
  // The renderer is not introspectable from the page, so read the source the
  // same way the site does — over HTTP, from the very file the browser ran.
  const src = await page.evaluate(async () => {
    const tag = [...document.querySelectorAll("script")].find((s) => /td-render\.js/.test(s.src));
    return tag ? (await fetch(tag.src)).text() : null;
  });
  assert.ok(src && src.length > 1000, "td-render.js was fetched from the running page");
  assert.ok(/function bossCrown\(/.test(src), "there is ONE shared boss crown");
  const chain = src.slice(src.indexOf("function drawEnemy("));
  const blocks = {};
  // truncate each branch at the next `} else` — without this the LAST branch
  // runs to the end of the file and picks up the tower/projectile drawing,
  // which is how a "boss paints its own crown" check reported the Toolbox Titan
  // for a tier-4 tower RING 300 lines below it
  for (const part of chain.split('} else if (e.type === "').slice(1)) {
    blocks[part.slice(0, part.indexOf('"'))] = part.split(/\n {6}\} else/)[0];
  }
  const firstBranch = chain.split('if (e.type === "balloon") {')[1];
  if (firstBranch) blocks.balloon = firstBranch.split(/\n {6}\} else/)[0];
  const bosses = await page.evaluate(() => Object.entries(window.TDData.ENEMIES).filter(([, v]) => v.boss).map(([k]) => k));
  assert.ok(bosses.length >= 8, `every boss is checked (${bosses.length})`);
  const missing = bosses.filter((b) => !blocks[b] || !/bossCrown\(/.test(blocks[b]));
  assert.deepEqual(missing, [], "these bosses draw no boss mark: " + missing.join(", "));
  // …and there is exactly ONE crown implementation. A colour-literal ban would
  // be a false-failure machine — the same gold legitimately paints the
  // Tickmaster's clock pivot, a tier-4 tower ring and a dart in flight — so the
  // one-owner claim is checked directly instead: the helper is defined once.
  assert.equal((src.match(/function bossCrown\(/g) || []).length, 1,
    "the boss crown has exactly one implementation");
});

test("TD2 the THIRD ultimates are buyable by TAP, and each one WORKS and SHOWS on a real board", async () => {
  // A feature whose tests all call the API is untested AS A FEATURE. This one
  // taps the actual card and then draws the actual board — and it earns its
  // keep: the support-link renderer shipped its first cut calling `w2s`, which
  // is not in scope inside draw(), so building a Tail Wind threw on EVERY frame.
  // The whole fort browser suite was green, because nothing built one and drew.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const buyThird = async (line) => {
    await page.evaluate((ln) => {
      window.__TD.newGame(1, { seed: 42 });
      window.__TD.grantGold(9000);
      // upgrades through the ENGINE: the panel stays open and re-renders after a
      // purchase, so a third `.td-up` click would land on a branch card.
      window.__TD.script([["place", ln, "p3"], ["upgrade", 0], ["upgrade", 0]]);
    }, line);
    const rect = await page.locator(".td-canvas").boundingBox();
    const sp = await page.evaluate(() => window.__TD.w2s(9.5, 5.5));
    await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
    await page.locator(".td-panel").waitFor({ state: "visible", timeout: 5000 });
    const card = page.locator('.td-branch[data-b="c"]');
    assert.equal(await card.count(), 1, `${line}'s third ultimate must have a card to tap`);
    const label = await card.textContent();
    await card.click();
    return { label, t: await page.evaluate(() => window.__TD.state().towers[0]) };
  };

  const rust = await buyThird("dart");
  assert.equal(rust.t.tier, 4, "Rust Ray purchased by tap");
  assert.equal(rust.t.branch, "c");
  assert.match(rust.label, /ARMOUR|armour/, "…and its card says what it does, not just what it costs");

  // it must strip on the field, EMIT so the renderer and sfx have a hook, and
  // the board must keep drawing without throwing
  const live = await page.evaluate(() => {
    const e = window.__TD.engine(), r = window.__TD.render();
    let sawStrip = false, sawEvent = false;
    e.callWave();
    for (let i = 0; i < 3000 && e.state.phase === "wave"; i++) {
      e.tick();
      if (e.events.some((v) => v.type === "strip")) sawEvent = true;
      if (e.state.enemies.some((x) => x.alive && x.stripped)) sawStrip = true;
      if (sawStrip && sawEvent) break;
    }
    r.draw(0);
    return { sawStrip, sawEvent };
  });
  assert.ok(live.sawStrip, "a Rust Ray on a real board must actually strip something");
  assert.ok(live.sawEvent, "…and emit, or nothing can draw or sound it");

  const wind = await buyThird("fan");
  assert.equal(wind.t.tier, 4, "Tail Wind purchased by tap");
  assert.equal(wind.t.branch, "c");
  assert.match(wind.label, /OWN towers|neighbours/, "…and its card says who it helps");

  // a neighbour must actually feel it, AND the field must still draw
  const helped = await page.evaluate(() => {
    const e = window.__TD.engine(), st = window.__TD.state(), r = window.__TD.render();
    const R = window.TDData.TOWERS.fan.branches.c.support.radius;
    const fan = st.towers[0];
    const pad = (e.levelDef.pads || []).find((p) => p.id !== "p3" &&
      (p.cx - fan.cx) ** 2 + (p.cy - fan.cy) ** 2 <= R * R);
    if (!pad) return { skipped: true };
    e.state.gold = 9000;
    e.place("dart", pad.id);
    const d = st.towers[st.towers.length - 1];
    e.upgrade(d.id); e.upgrade(d.id);
    e.tick();
    r.draw(0); // the frame that used to throw
    return { supRate: d.supRate, supRange: d.supRange };
  });
  assert.ok(!helped.skipped, "the fixture needs a pad within the support radius, or it proves nothing");
  const SUP = await page.evaluate(() => window.TDData.TOWERS.fan.branches.c.support);
  assert.equal(helped.supRate, SUP.rate, "a neighbouring gun must actually be sped up");
  assert.equal(helped.supRange, SUP.range, "…and given the extra reach");
});

test("PLACEMENT: the build menu SHOWS how much road a pad reaches, and it differs by pad", async () => {
  // The branch audit measured up to 5 lives from WHICH pad you convert, and a
  // pad's worth was unknowable until after the gold was spent. A number that
  // exists in the engine but never reaches the screen fixes nothing — the same
  // gap as the abilities whose names lived only in an aria-label, and ⚙️ Toy
  // Energy shipping as a bare numeral nothing explained.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(20, { seed: 7 }); });
  const rect = await page.locator(".td-canvas").boundingBox();
  // Ask the ENGINE which pads are best and worst for a dart — the prices lesson
  // applied to coverage: the UI must never re-derive a number the engine owns,
  // and the test must not re-derive it either.
  const picks = await page.evaluate(() => {
    const e = window.__TD.engine();
    const scored = e.levelDef.pads
      .map((p) => ({ cx: p.cx, cy: p.cy, c: e.coverageOf("dart", 1, p.cx, p.cy) }))
      .sort((a, b) => b.c - a.c);
    return { best: scored[0], worst: scored[scored.length - 1] };
  });
  const read = async (pad) => {
    await page.evaluate(() => { window.__TD.newGame(20, { seed: 7 }); });
    const sp = await page.evaluate((p) => window.__TD.w2s(p.cx + 0.5, p.cy + 0.5), pad);
    await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
    await page.locator(".td-buildmenu").waitFor({ state: "visible" });
    return page.evaluate(() => {
      const q = (sel) => document.querySelector(sel);
      const cov = (line) => {
        const c = q('.td-buildmenu .td-buy[data-line="' + line + '"] .td-buy__cov');
        return c ? c.textContent : null;
      };
      return { dart: cov("dart"), mortar: cov("mortar"), camp: cov("camp") };
    });
  };
  const best = await read(picks.best), worst = await read(picks.worst);
  assert.ok(best.dart && /%/.test(best.dart),
    `the build menu must SHOW a road figure, got ${JSON.stringify(best.dart)}`);
  assert.equal(best.dart, Math.round(picks.best.c * 100) + "% road",
    "…and it must be the ENGINE's number, not one the UI recomputed — the prices bug, where the " +
    "panel showed 110 while the engine charged 99");
  assert.notEqual(best.dart, worst.dart,
    `the figure must DIFFER between the best and worst pad (${best.dart} vs ${worst.dart}) — ` +
    "a number that reads the same everywhere tells the player the choice does not matter, " +
    "which is the opposite of what the branch audit measured");
  assert.ok(Math.round(picks.best.c * 100) > Math.round(picks.worst.c * 100),
    "the best pad must read higher than the worst");
  // Per LINE, not per pad: a mortar out-reaches a dart, so the same pad is worth
  // a different amount to each — which is the other half of the placement choice.
  assert.ok(best.mortar && best.mortar !== best.dart,
    `the same pad must read differently for a longer-reaching line (dart ${best.dart} vs mortar ${best.mortar})`);
  // A Camp does not shoot, so it has no road figure to give. Showing 0% there
  // would be a lie about a line whose whole job is blocking.
  assert.equal(best.camp, null, "a Camp blocks rather than shoots — it must show no road figure at all");
});

test("PLACEMENT: the range ring on the field is the reach the engine USES", async () => {
  // The engine half of this lives in td-logic.test.js; this is the half that
  // matters to a player — the renderer had its own copy of the arithmetic, so
  // proving `towerReach` is right says nothing about what gets PAINTED. Read the
  // radius actually handed to ctx.arc, the "go and read what was drawn" rule
  // that replaced a confounded pixel hash on the lever countdown.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const got = await page.evaluate(() => {
    // L3 carries a ⚡ power pad, so one board proves the Fan's zap AND the pad
    // boost — the two the old ring was short by.
    window.__TD.newGame(3, { seed: 7 });
    const e = window.__TD.engine();
    const lv = e.levelDef;
    const boosted = lv.pads.find((p) => p.boost && p.boost.range);
    const plain = lv.pads.find((p) => !(p.boost && p.boost.range));
    e.state.gold = 99999;
    window.__TD.script([["place", "fan", plain.id], ["place", "dart", boosted.id]]);
    const a = window.__TD.w2s(0, 0), b = window.__TD.w2s(1, 0);
    const cell = Math.hypot(b.x - a.x, b.y - a.y);
    const r = window.__TD.render();
    const read = (tower) => {
      const arcs = [];
      const orig = CanvasRenderingContext2D.prototype.arc;
      CanvasRenderingContext2D.prototype.arc = function (x, y, rad) {
        arcs.push({ x, y, rad }); return orig.apply(this, arguments);
      };
      try {
        r.setSelection({ tower: tower.id });
        r.draw(0);                            // MAKE it happen before reading it
      } finally { CanvasRenderingContext2D.prototype.arc = orig; }
      // the ring is centred on the tower's own cell, in the floor pass's coords
      const cx = (tower.cx + 0.5) * cell, cy = (tower.cy + 0.5) * cell;
      const hit = arcs.filter((q) => Math.hypot(q.x - cx, q.y - cy) < 1);
      return hit.length ? Math.max(...hit.map((q) => q.rad)) / cell : null;
    };
    const [fan, dart] = e.state.towers;
    const out = {
      fanDrawn: read(fan), fanEngine: e.towerReach(fan.id),
      fanAura: window.TDData.TOWERS.fan.tiers[0].auraRange,
      dartDrawn: read(dart), dartEngine: e.towerReach(dart.id),
      dartBase: window.TDData.TOWERS.dart.tiers[0].range,
    };
    out.pads = { boosted: { cx: boosted.cx, cy: boosted.cy }, plain: { cx: plain.cx, cy: plain.cy } };
    return out;
  });
  assert.ok(got.fanDrawn, "a selected tower paints a range ring at all");
  assert.ok(Math.abs(got.fanDrawn - got.fanEngine) < 0.02,
    `the Fan's ring must be the reach the engine uses (drew ${got.fanDrawn}, engine ${got.fanEngine})`);
  assert.ok(got.fanDrawn > got.fanAura + 0.01,
    `…which is its ZAP, not its slow aura — drawing ${got.fanAura} understates a tier-1 Fan by ` +
    `${(100 * (got.fanEngine / got.fanAura - 1)).toFixed(0)}%`);
  assert.ok(Math.abs(got.dartDrawn - got.dartEngine) < 0.02,
    `a ⚡ power pad's boost must show in the ring (drew ${got.dartDrawn}, engine ${got.dartEngine})`);
  assert.ok(got.dartDrawn > got.dartBase + 0.01,
    `…and it must be BIGGER than the same dart on an ordinary pad (${got.dartDrawn} vs ${got.dartBase})`);
  // …and the GHOST ring shown while the build menu is open, on a pad with
  // nothing on it yet. It is a different code path (td-main's own setSelection),
  // and it shipped as a hard-coded literal — the same circle on a ⚡ pad as on an
  // ordinary one. This half must be driven by a REAL TAP: reading it through a
  // setSelection call of the test's own would prove the renderer draws what it
  // is handed and notice nothing when td-main stops handing it the right value.
  const rect = await page.locator(".td-canvas").boundingBox();
  const ghost = async (pad) => {
    await page.evaluate(() => { window.__TD.newGame(3, { seed: 7 }); });
    const sp = await page.evaluate((p) => window.__TD.w2s(p.cx + 0.5, p.cy + 0.5), pad);
    await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
    await page.locator(".td-buildmenu").waitFor({ state: "visible", timeout: 4000 });
    return page.evaluate((p) => {
      const a = window.__TD.w2s(0, 0), b = window.__TD.w2s(1, 0);
      const cell = Math.hypot(b.x - a.x, b.y - a.y);
      const arcs = [];
      const orig = CanvasRenderingContext2D.prototype.arc;
      CanvasRenderingContext2D.prototype.arc = function (x, y, rad) { arcs.push({ x, y, rad }); return orig.apply(this, arguments); };
      try { window.__TD.render().draw(0); } finally { CanvasRenderingContext2D.prototype.arc = orig; }
      const cx = (p.cx + 0.5) * cell, cy = (p.cy + 0.5) * cell;
      const hit = arcs.filter((q) => Math.hypot(q.x - cx, q.y - cy) < 1);
      return hit.length ? Math.max(...hit.map((q) => q.rad)) / cell : null;
    }, pad);
  };
  const gBoost = await ghost(got.pads.boosted), gPlain = await ghost(got.pads.plain);
  assert.ok(gBoost && gPlain, "tapping an empty pad shows a ghost ring while you choose");
  assert.ok(gBoost > gPlain + 0.01,
    `the ghost ring must differ between a ⚡ power pad and an ordinary one ` +
    `(${gBoost} vs ${gPlain}) — it shipped as a hard-coded literal, the same circle everywhere`);
});

test("ART: every WORLD tints its level cards, and no two worlds share a colour", async () => {
  // This was two hand-written CSS rules — backyard and toystore — whose comment
  // still read "World 1 bedroom (default navy), 2 backyard, 3 toystore" after the
  // campaign reached ten worlds. So SEVEN of ten rendered as the same navy while
  // CLAUDE.md claimed the fort home "shows world tints": the counting law, this
  // time living in a stylesheet. The tint is DERIVED from each world's own floor
  // now, so an 11th world inherits it; this test derives its expectations the
  // same way, which is what makes it able to fail on a world that ships without
  // one rather than on a list someone forgot to extend.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("jon-td-save-v1") || "{}");
    s.v = 1; s.stars = { casual: {}, normal: {}, heroic: {} };
    for (let i = 1; i <= window.TDData.LEVELS.length; i++) s.stars.normal[i] = 3;
    localStorage.setItem("jon-td-save-v1", JSON.stringify(s));
  });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const seen = await page.evaluate(() => {
    const out = {};
    for (const card of document.querySelectorAll("#screen-td-home .td-level[data-world]")) {
      const cs = getComputedStyle(card);
      out[card.dataset.world] = { bg: cs.backgroundColor, border: cs.borderTopColor };
    }
    return out;
  });
  const worlds = await page.evaluate(() => [...new Set(window.TDData.LEVELS.map((l) => l.world))]);
  const missing = worlds.filter((w) => !seen[w]);
  assert.deepEqual(missing, [], `worlds with no level card rendered: ${missing.join(", ")}`);
  const byBg = {};
  for (const w of worlds) (byBg[seen[w].bg] = byBg[seen[w].bg] || []).push(w);
  const shared = Object.values(byBg).filter((a) => a.length > 1).map((a) => a.join(" = "));
  assert.deepEqual(shared, [],
    `these worlds' level cards render the same colour, so the grid cannot say which room a level is in: ${shared.join("; ")}`);
  // …and the tint must stay dark enough for the card's OWN text. #9db4dd needs a
  // background under ~0.061 relative luminance, and a floor like the party's plum
  // carpet is far lighter than that — the cap is what makes this safe to derive.
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  for (const w of worlds) {
    const c = (seen[w].bg.match(/\d+/g) || []).slice(0, 3).map(Number);
    const L = 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    assert.ok(L <= 0.061, `${w}'s card tint is luminance ${L.toFixed(3)} — its own #9db4dd label would drop below AA`);
  }
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("CONTRAST: every ACTIVE text run on every fort surface clears AA", async () => {
  // The fort HAD a contrast pass. It reported 0 failures across 10 surfaces and
  // had never opened the BUILD MENU, where measuring found two shipped AA
  // failures — the role label at 3.52:1 and the price, the biggest text on the
  // button, at 3.00:1. Its surface list was hand-written, which is the class
  // this repo keeps paying for (the flex-gap law guarded only main.css, the
  // VS16 scan hand-listed nine files, FIELD_TRAIT hand-listed twelve fields,
  // the overlay audit hand-listed six dialogs). So this DERIVES its surfaces
  // from the fort home's own buttons and walks the play screen's real states.
  //
  // Widening it immediately found two more instances of the very law the build
  // menu taught: `.td-branch__role` dimmed to 4.40:1 and `.td-target` at
  // 4.45:1, both on the same #2fa562 fill whose ink is 4.96:1 at full strength
  // — i.e. a fill with no headroom to dim on.
  //
  // WCAG 1.4.3 exempts text that is part of an INACTIVE component, so a
  // disabled/locked run is recorded and skipped rather than quietly "passing":
  // the fort's locked star-tree nodes, locked endless arenas, the disabled
  // equip button and the unearned difficulty pips are all deliberately dim, and
  // dimming IS the signal there. The exempt COUNT is asserted below so that
  // exemption can never silently grow to swallow the audit.
  const AUDIT = (label) => page.evaluate((lbl) => {
    const px = (t) => (t.match(/-?[\d.]+/g) || []).slice(0, 4).map(Number);
    const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };
    const mix = (fg, bg, a) => [0, 1, 2].map((i) => Math.round(fg[i] * a + bg[i] * (1 - a)));
    // The fort body is a dark navy gradient (#0b1526 -> #142440 -> #1b2c4d). For
    // light ink the WORST case is the lightest stop, so use it: that is a bound,
    // not a guess, and it needs no screenshot decoding (which is why this costs
    // ~9s and can live in CI at all).
    const BODY = [27, 44, 77];
    const bgOf = (el) => {
      let n = el, over = null;
      while (n && n !== document.documentElement) {
        const cs = getComputedStyle(n);
        const c = px(cs.backgroundColor);
        const a = c[3] === undefined ? 1 : c[3];
        if (a > 0) {
          if (a === 1) return over ? mix(over.layer, c.slice(0, 3), over.a) : c.slice(0, 3);
          if (!over) over = { layer: c.slice(0, 3), a };
        }
        if (/gradient/.test(cs.backgroundImage)) return over ? mix(over.layer, BODY, over.a) : BODY;
        n = n.parentElement;
      }
      return over ? mix(over.layer, BODY, over.a) : BODY;
    };
    // A run is ART only if it carries no LETTER and no DIGIT. The obvious
    // spelling — an emoji character class — is a trap: `\p{Emoji_Component}`
    // MATCHES THE ASCII DIGITS (they are keycap bases), so "70🪙" tested as
    // emoji-only and this audit silently skipped every number in the fort:
    // prices, gold, lives, wave counts, star costs. Caught by a mutation the
    // narrower test it replaced did catch and this one did not.
    const isArt = (t) => !/[\p{L}\p{Nd}]/u.test(t);
    const out = { runs: 0, overlay: 0, fails: [], exempt: 0 };
    const seen = new Set();
    for (const el of document.querySelectorAll("*")) {
      if (!el.offsetParent && getComputedStyle(el).position !== "fixed") continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
      if (!txt) continue;
      out.runs += 1;
      if (el.closest(".td-overlay")) out.overlay += 1;   // the DIRECT did-it-open measure
      if (isArt(txt)) continue;                          // an icon is ART, not text
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
      // occluded, or scrolled out of its own box? skip — both are false positives
      const cx = Math.min(innerWidth - 1, Math.max(1, r.left + Math.min(6, r.width / 2)));
      const cy = Math.min(innerHeight - 1, Math.max(1, r.top + r.height / 2));
      const top = document.elementFromPoint(cx, cy);
      if (top && top !== el && !el.contains(top) && !top.contains(el)) continue;
      if (el.closest("[disabled]") || el.closest('[aria-disabled="true"]') ||
          el.closest('[class*="--locked"], [class*="__dim"]')) { out.exempt += 1; continue; }
      const c = px(cs.color);
      const bg = bgOf(el);
      const ink = mix(c.slice(0, 3), bg, (c[3] === undefined ? 1 : c[3]) * Number(cs.opacity));
      const size = parseFloat(cs.fontSize), weight = Number(cs.fontWeight);
      const bar = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5;
      const rr = ratio(ink, bg);
      const key = el.className + "|" + txt.slice(0, 24);
      if (seen.has(key)) continue;
      seen.add(key);
      if (rr < bar) out.fails.push(`${lbl}: .${String(el.className).slice(0, 40)} "${txt.slice(0, 28)}" ` +
        `is ${rr.toFixed(2)}:1 at ${size}px/w${weight}, below AA's ${bar}:1`);
    }
    return out;
  }, label);

  const fails = [], surfaces = [];
  const add = async (label, minRuns, minOverlay) => {
    const o = await AUDIT(label);
    // CALIBRATION, baked in: a surface that never opened audits the runs of the
    // one behind it and reports a clean sweep. Two of these (the pause menu and
    // the victory overlay) silently did exactly that while this was a scratch
    // probe, so opening is asserted rather than trusted.
    assert.ok(o.runs >= minRuns,
      `${label}: only ${o.runs} text runs visible (expected >= ${minRuns}) — the surface did not open, ` +
      "so a clean result here would be a false negative");
    // For an OVERLAY surface, count the runs that came from inside the overlay
    // itself. The first cut compared the TOTAL against the bare home's count,
    // and that is a proxy, not the claim: 💾 Backup and ⚙️ Reset fort sit at the
    // bottom of the fort home, so clicking them SCROLLS the page, the home's own
    // visible runs drop, and the total fell below a bar derived from the
    // unscrolled home — a false failure on two dialogs that had plainly opened
    // (5 and 8 runs inside the overlay). It passed only while the home happened
    // to be short enough, and World 10's four extra level cards ended that. The
    // direct measure cannot drift with the home's size or the scroll position.
    if (minOverlay) assert.ok(o.overlay >= minOverlay,
      `${label}: ${o.overlay} text runs inside .td-overlay (expected >= ${minOverlay}) — the dialog did not open`);
    surfaces.push(label); fails.push(...o.fails);
    return o;
  };

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  // A SANITY floor only. The first cut asserted >= 60 runs, calibrated against a
  // fresh page (124) — and the full suite runs this after tests that change the
  // save, where the same healthy screen renders 58. An absolute count here is a
  // fence around one observed state; what actually catches "the surface never
  // opened" is the OVERLAY-run check on everything opened, below.
  await add("fort home", 20);

  // DERIVED, not listed: every dialog the fort home can open.
  const openers = await page.evaluate(() => [...document.querySelectorAll("#screen-td-home .td-metabtn, #screen-td-home .td-adminrow button")]
    .map((b) => ({ cls: [...b.classList].find((c) => /-open$|reset|backup/.test(c)) || b.className.split(" ").pop(), txt: b.textContent.trim().slice(0, 14) })));
  assert.ok(openers.length >= 6, `expected the fort home to offer several dialogs, saw ${openers.length}`);
  for (const o of openers) {
    await page.locator("#screen-td-home ." + o.cls).first().click();
    await page.waitForTimeout(220);
    // it must have painted its own text INSIDE the overlay, or it did not open
    await add("dialog " + o.txt, 20, 3);
    await page.evaluate(() => { if (window.TDUI && TDUI.closeOverlay) TDUI.closeOverlay(); });
    await page.waitForTimeout(140);
  }

  // ---- play screen: the states a player actually decides in ----
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => window.__TD.newGame(3, { seed: 7 }));
  await page.waitForTimeout(150);
  await add("play (build phase)", 5);
  const rect = await page.locator(".td-canvas").boundingBox();
  const pad = await page.evaluate(() => { const p = window.__TD.engine().levelDef.pads[0]; return { cx: p.cx, cy: p.cy }; });
  const tapPad = async () => {
    const sp = await page.evaluate((p) => window.__TD.w2s(p.cx + 0.5, p.cy + 0.5), pad);
    await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  };
  const dismiss = () => page.evaluate(() => document.querySelector("#screen-td-play .td-hud").click());

  await tapPad();
  await page.locator(".td-buildmenu").waitFor({ state: "visible", timeout: 4000 });
  await add("build menu (affordable)", 5);   // opened-proof is its own selector, waited for above
  await dismiss();
  await page.evaluate(() => { window.__TD.engine().state.gold = 0; });
  await tapPad();
  await page.locator(".td-buildmenu").waitFor({ state: "visible", timeout: 4000 });
  await add("build menu (unaffordable)", 5);   // opened-proof is its own selector, waited for above
  await dismiss();

  await page.evaluate(() => {
    window.__TD.newGame(3, { seed: 7 }); window.__TD.grantGold(9000);
    window.__TD.script([["place", "dart", "p1"], ["upgrade", 0], ["upgrade", 0]]);
  });
  await tapPad();
  await page.locator(".td-panel").waitFor({ state: "visible", timeout: 4000 });
  await add("tower panel (tier 3)", 5);   // opened-proof is its own selector, waited for above
  await dismiss();

  // __TD.newGame leaves the run PAUSED, so the first tap RESUMES rather than
  // opening the menu — drive it until the overlay is really there.
  await page.evaluate(() => document.querySelector("#screen-td-play .td-pause").click());
  await page.waitForTimeout(180);
  if (!(await page.locator(".td-overlay").count())) {
    await page.evaluate(() => document.querySelector("#screen-td-play .td-pause").click());
    await page.waitForTimeout(220);
  }
  assert.equal(await page.locator(".td-overlay").count(), 1, "the pause menu opened");
  await add("pause menu", 5, 3);   // …and its own overlay runs are counted
  await page.evaluate(() => { if (window.TDUI && TDUI.closeOverlay) TDUI.closeOverlay(); });

  await page.evaluate(() => window.__TD.winL1(7));
  await page.locator(".td-overlay--win").waitFor({ state: "visible", timeout: 8000 });
  await add("victory overlay", 5, 3);   // a finished run REMOVES controls, so its TOTAL is legitimately lower than the play screen's — the overlay count is what proves it opened

  assert.ok(surfaces.length >= 13, `expected to audit every fort surface, saw ${surfaces.length}`);
  assert.deepEqual(fails, [],
    `${fails.length} ACTIVE text run(s) below WCAG AA on the fort:\n  ` + fails.join("\n  "));
});

test("PLACEMENT: a built tower states its road, and a branch that MOVES it says so", async () => {
  // The other half of the same finding: the branch audit measured up to 5 lives
  // from WHICH tower you convert, and a branch can move the reach in EITHER
  // direction — Sniper Scope takes the dart 3 → 5.5 while Minigun DROPS it to
  // 2.2. A 300-gold purchase that silently shrinks what a tower covers is the
  // same class as the dps line that reads 47.3 for a branch which loses levels.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const rect = await page.locator(".td-canvas").boundingBox();
  const openTier3 = async (line) => {
    await page.evaluate((a) => {
      window.__TD.newGame(1, { seed: 7 });
      window.__TD.grantGold(9000);
      window.__TD.script([["place", a, "p1"], ["upgrade", 0], ["upgrade", 0]]);
    }, line);
    const pad = await page.evaluate(() => {
      const p = window.__TD.engine().levelDef.pads.find((q) => q.id === "p1");
      return { cx: p.cx, cy: p.cy };
    });
    const sp = await page.evaluate((p) => window.__TD.w2s(p.cx + 0.5, p.cy + 0.5), pad);
    await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
    await page.locator(".td-panel").waitFor({ state: "visible", timeout: 4000 });
    return page.evaluate(() => {
      const e = window.__TD.engine(), t = e.state.towers[0];
      const cards = {};
      document.querySelectorAll(".td-branch").forEach((b) => {
        cards[b.dataset.b] = b.querySelector(".td-branch__role").textContent;
      });
      return {
        stats: document.querySelector(".td-panel__stats").textContent,
        now: Math.round(e.coverageOf(t.lineId, t.tier, t.cx, t.cy) * 100),
        cards,
      };
    });
  };
  const dart = await openTier3("dart");
  assert.ok(dart.stats.endsWith(dart.now + "% road"),
    `a built tower's panel must state what it covers from THIS pad — got ${JSON.stringify(dart.stats)}`);
  // Sniper RISES, Minigun FALLS. Both arrows must be there, and pointing the
  // right way: showing only the upgrade would be the same half-truth as the dps
  // line, and the shrink is the one a player most needs told.
  const arrow = (txt) => {
    const m = /road (\d+)%→(\d+)%/.exec(txt || "");
    return m ? { from: Number(m[1]), to: Number(m[2]) } : null;
  };
  const sniper = arrow(dart.cards.a), minigun = arrow(dart.cards.b);
  assert.ok(sniper && sniper.to > sniper.from,
    `Sniper Scope must show its reach GROWING — got ${JSON.stringify(dart.cards.a)}`);
  assert.ok(minigun && minigun.to < minigun.from,
    `Minigun must show its reach SHRINKING — a 300-gold purchase that quietly covers less ` +
    `road is exactly what this exists to surface — got ${JSON.stringify(dart.cards.b)}`);
  assert.equal(sniper.from, dart.now, "…and the arrow starts from what the tower covers today");
  // A branch that does NOT move the figure must show no arrow, or the cue means
  // nothing: Sticky Bomb keeps the mortar's 4-cell reach exactly.
  const mortar = await openTier3("mortar");
  assert.equal(arrow(mortar.cards.b), null,
    `a branch that leaves the reach alone must show no arrow — got ${JSON.stringify(mortar.cards.b)}`);
  assert.ok(arrow(mortar.cards.a), "…while Big Bertha, which does extend it, still shows one");
  const camp = await openTier3("camp");
  assert.ok(!/road/.test(camp.stats), `a Camp blocks rather than shoots — got ${JSON.stringify(camp.stats)}`);
});

test("ART: EVERY tier-4 branch survives a real draw on a live board", async () => {
  // This is the guardrail the w2s bug should have hit and did not. A new branch
  // shipped a renderer block that threw on EVERY frame, and the whole fort suite
  // was green — because the tier-art guardrail renders each variant in
  // ISOLATION (it cannot see a throw in draw()'s own composition), and the only
  // test that put one on a real board was written in the SAME commit as the fix.
  //
  // So the eight ORIGINAL branches had never been placed on a live board and
  // drawn through a real frame either. Derived from DATA.TOWERS, so a ninth
  // branch inherits it the moment it exists rather than when someone remembers.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const errsBefore = pageErrors.length;
  const out = await page.evaluate(() => {
    const bad = [], seen = [];
    for (const line of Object.keys(window.TDData.TOWERS)) {
      for (const key of Object.keys(window.TDData.TOWERS[line].branches || {})) {
        seen.push(line + ":" + key);
        try {
          window.__TD.newGame(1, { seed: 11 });
          window.__TD.grantGold(99999);
          const e = window.__TD.engine(), st = e.state, r = window.__TD.render();
          r.resize();
          // The two CLOSEST pads, not the first two. This test's first cut took
          // pads.slice(0, 2) and was VACUOUS: on L1 those are 5.0 cells apart
          // against the 4.5 support radius, so neither tower buffed the other,
          // every tower failed the `supRate > 1` check and the link loop
          // `continue`d before it ever reached the line that used to throw.
          // Proven by re-introducing the historical w2s bug: the test passed.
          // Exactly the defect it exists to catch — a fixture that never
          // creates the condition — so the pads are chosen by distance.
          const ps = e.levelDef.pads;
          let pair = [ps[0], ps[1]], best = Infinity;
          for (const a of ps) for (const b of ps) {
            if (a.id === b.id) continue;
            const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
            if (d < best) { best = d; pair = [a, b]; }
          }
          for (const pad of pair) {
            e.place(line, pad.id);
            const t = st.towers[st.towers.length - 1];
            e.upgrade(t.id); e.upgrade(t.id); e.branch(t.id, key);
          }
          e.callWave();
          // draw across a spread of ticks: dashes, spin-up and pulses are all
          // tick-derived, so one frame can miss a branch of the draw.
          for (let i = 0; i < 240; i++) {
            e.tick();
            if (i % 30 === 0) r.draw(0);
          }
          r.draw(0.5);
          const tiers = st.towers.map((t) => t.tier + (t.branch || ""));
          if (!tiers.every((x) => x === "4" + key)) bad.push(line + ":" + key + " never reached tier 4 (" + tiers.join(",") + ")");
          // no `? :` fallback: a MISSING hook must fail loudly, not silently
          // skip the check — that is how a guard goes quietly vacuous.
          const decor = r.decorInfo();
          if (decor.length) bad.push(line + ":" + key + " decorative layer threw: " + decor[0]);
        } catch (err) {
          bad.push(line + ":" + key + " threw during draw: " + String(err));
        }
      }
    }
    return { bad, seen };
  });
  // self-verifying: if the derivation found nothing, the test is vacuous
  assert.ok(out.seen.length >= 8,
    `every tier-4 branch must be exercised — only found ${out.seen.length} (${out.seen.join(", ")})`);
  assert.deepEqual(out.bad, [],
    "a tier-4 branch must survive a REAL draw on a live board: " + out.bad.join(" | "));
  assert.equal(pageErrors.length, errsBefore,
    `building every tier-4 branch and drawing must raise no page error: ${pageErrors.slice(errsBefore).join("; ")}`);
});

test("ART: a frame never LEAKS canvas state, and a decoration cannot cost the board", async () => {
  // Reported from real play as "Tail Wind wipes the board and things went
  // crazy": no towers, orange circles down the lane, a big cyan cone, HUD still
  // counting. The cause was a ReferenceError in the support-link block (it
  // called `w2s`, out of scope inside draw()), which aborted the frame at that
  // exact line — the draw order predicts the screenshot precisely, since floor,
  // puddles and zap beams all come before it and every character after it.
  // The typo is fixed; this test guards the two SYSTEMIC defects the same block
  // had — it mutated shared canvas state without save/restore, and draw() had
  // no guard at all, so any throw in a purely decorative layer costs the board.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const out = await page.evaluate(() => {
    window.__TD.newGame(8, { seed: 3 });
    const e = window.__TD.engine(), st = window.__TD.state(), r = window.__TD.render();
    r.resize();
    e.state.gold = 999999;
    const R = window.TDData.TOWERS.fan.branches.c.support.radius;
    const pads = e.levelDef.pads;
    const fanPad = pads.find((p) => pads.filter((q) => q.id !== p.id &&
      Math.hypot(p.cx - q.cx, p.cy - q.cy) <= R).length >= 2) || pads[0];
    e.place("fan", fanPad.id);
    const f = st.towers[0];
    e.upgrade(f.id); e.upgrade(f.id); e.branch(f.id, "c");
    for (const p of pads) {
      if (p.id === fanPad.id) continue;
      e.place("dart", p.id);
      const d = st.towers[st.towers.length - 1];
      e.upgrade(d.id); e.upgrade(d.id);
    }
    const canvas = document.querySelector("#screen-td-play .td-canvas");
    const c = canvas.getContext("2d");
    e.callWave();
    for (let i = 0; i < 4000 && e.state.phase === "wave"; i++) {
      e.tick();
      if (st.enemies.filter((x) => x.alive).length >= 3) break;
    }
    // 1. a frame must leave the shared context exactly as it found it
    c.setLineDash([]); c.lineDashOffset = 0;
    r.draw(0);
    const leaked = { dash: c.getLineDash().length, offset: c.lineDashOffset };

    // 2. and a THROW inside the decorative layer must not cost the tower pass.
    //    `hadSupport` is the gate on that whole block, so a getter that throws
    //    when it is read reproduces exactly the failure mode reported.
    const before = c.getImageData(0, 0, canvas.width, canvas.height).data;
    let towerPixels = 0;
    Object.defineProperty(st, "hadSupport", { get() { throw new Error("boom"); }, configurable: true });
    let threw = false;
    try { r.draw(0); } catch (err) { threw = true; }
    delete st.hadSupport;
    st.hadSupport = true;
    const after = c.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < before.length; i += 4) {
      if (before[i] !== after[i] || before[i + 1] !== after[i + 1] || before[i + 2] !== after[i + 2]) towerPixels++;
    }
    return { leaked, threw, diffWhenDecorationFails: towerPixels, towers: st.towers.length };
  });
  assert.equal(out.leaked.dash, 0, "a frame must not leave a line DASH set on the shared context");
  assert.equal(out.leaked.offset, 0, "…nor a lineDashOffset — the tower pass is drawn after this and inherits it");
  // This is asserted BEFORE `threw` deliberately: both fire on the same
  // mutation (delete the catch), and this is the stronger claim — it measures
  // the CONSEQUENCE (the board is gone) rather than the mechanism (something
  // was thrown). Ordering it first is what makes the bound below directly
  // mutation-proven instead of merely argued.
  //
  // The bound is MEASURED, not invented. On this fixture the decoration failing
  // costs 351 px (just the missing links) while the tower pass genuinely not
  // running costs 10,958 — a factor of 31, so 3000 sits cleanly between them
  // with 8x headroom above the real number and 3.6x margin below the defect.
  // The first cut of this line said `< 20000`, which is ABOVE 10,958: it could
  // not have caught the very thing it claims to, i.e. a test that cannot fail.
  assert.ok(out.diffWhenDecorationFails < 3000,
    `with the decoration failing the board must still paint essentially the same (${out.diffWhenDecorationFails} px differ) — ` +
    "a decoration that can abort the frame costs the player every tower while the HUD keeps updating");
  assert.ok(!out.threw, "a failure inside the decorative layer must not escape draw()");
});

test("ART: both new mechanics actually PAINT — 'does it work' and 'can you see it' are different questions", async () => {
  // The first cut of this feature had ZERO references to either mechanic in the
  // renderer and emitted no events, so a 270-gold gun and a 300-gold support
  // tower changed nothing a player could perceive. That is the same defect as
  // "three of the four Fan variants fired with no visual at all".
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });

  const strip = await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 7 });
    const st = window.__TD.state(), r = window.__TD.render();
    r.resize();
    const canvas = document.querySelector("#screen-td-play .td-canvas");
    const c = canvas.getContext("2d");
    const put = (stripped) => {
      st.towers.length = 0; st.soldiers.length = 0; st.enemies.length = 0;
      st.enemies.push({ id: 1, type: "knight", alive: true, hp: 90, maxHp: 90, shield: 0,
        dist: 6, pathIdx: 0, slowUntil: 0, slowPct: 0, speedMult: 1,
        stripUntil: stripped ? st.tick + 90 : 0, stripAmt: 0.6, stripped: !!stripped,
        brittleUntil: 0, blockedBy: 0, stunnedUntil: 0 });
      r.draw(0);
      return c.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const a = put(false), b = put(true);
    let diff = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) diff++;
    }
    return diff;
  });
  assert.ok(strip > 120,
    `a STRIPPED body must look different from an unstripped one (only ${strip} px changed) — ` +
    "which bodies are currently soft is the entire reason to own a Rust Ray");

  const linkPx = await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 7 });
    const e = window.__TD.engine(), st = window.__TD.state(), r = window.__TD.render();
    r.resize();
    const R = window.TDData.TOWERS.fan.branches.c.support.radius;
    const pads = e.levelDef.pads;
    let A = null, B = null;
    for (const p of pads) { for (const q of pads) {
      if (p.id !== q.id && Math.hypot(p.cx - q.cx, p.cy - q.cy) <= R) { A = p; B = q; break; }
    } if (A) break; }
    if (!A) return -1;
    st.enemies.length = 0;
    e.state.gold = 99999;
    e.place("dart", B.id);
    const d = st.towers[st.towers.length - 1];
    e.upgrade(d.id); e.upgrade(d.id);
    e.place("fan", A.id);
    const f = st.towers[st.towers.length - 1];
    e.upgrade(f.id); e.upgrade(f.id); e.branch(f.id, "c");
    e.tick();
    const canvas = document.querySelector("#screen-td-play .td-canvas");
    const c = canvas.getContext("2d");
    // The whole link pass is gated on `hadSupport`, so drawing the SAME board
    // with it off is a control in which the fan's own sprite, the pads and the
    // floor are identical and ONLY the wiring differs. Without this the diff
    // would be dominated by the fan sprite itself and would prove nothing.
    r.draw(0);
    const withL = c.getImageData(0, 0, canvas.width, canvas.height).data;
    st.hadSupport = false;
    r.draw(0);
    const noL = c.getImageData(0, 0, canvas.width, canvas.height).data;
    st.hadSupport = true;
    let n = 0;
    for (let i = 0; i < withL.length; i += 4) {
      if (withL[i] !== noL[i] || withL[i + 1] !== noL[i + 1] || withL[i + 2] !== noL[i + 2]) n++;
    }
    return n;
  });
  assert.ok(linkPx > 0, "L1 must have a pad pair inside the support radius for this to mean anything");
  assert.ok(linkPx > 200,
    `a Tail Wind must DRAW the guns it is helping (only ${linkPx} px) — WHERE you place it is the ` +
    "whole decision the branch exists to create, and an invisible buff cannot be placed well");
});

test("ART: every enemy draws as ITSELF — none falls through to the Sock Goblin", async () => {
  // The enemy draw is a long if/else chain ending in a default sock. Two shipped
  // enemies never got a branch: the Tin Plane, and — worse — **the Tickmaster**,
  // the entire World-4 finale, which marched in as a 3200hp sock. Nothing caught
  // it because a sock renders perfectly well. Same pixel-hash technique as the
  // tower-tier guardrail: every type must be visually distinct from every other.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 8 }); });
  await page.waitForTimeout(120);
  const sigs = await page.evaluate(() => {
    const st = window.__TD.state(), r = window.__TD.render();
    r.resize();
    const canvas = document.querySelector("#screen-td-play .td-canvas");
    const ctx = canvas.getContext("2d");
    const dpr = canvas.width / canvas.clientWidth;
    const path = window.__TD.engine().levelDef.path;
    const out = {};
    for (const type of Object.keys(window.TDData.ENEMIES)) {
      const def = window.TDData.ENEMIES[type];
      st.towers.length = 0; st.soldiers.length = 0;
      st.enemies.length = 0;
      st.enemies.push({
        id: 1, type, alive: true, hp: def.hp, maxHp: def.hp, shield: def.shield || 0,
        dist: 3, pathIdx: 0, slowUntil: 0, slowAmt: 0, speedMult: 1, flier: !!def.flier,
        engagedBy: 0, lastPhase: 0, charge: 0, brittleUntil: 0,
      });
      r.draw(0);
      const w = window.__TD.engine().posOn(0, 3);
      const p = window.__TD.w2s(w.x, w.y);
      const half = 40;
      const d = ctx.getImageData(
        Math.max(0, Math.round((p.x - half) * dpr)), Math.max(0, Math.round((p.y - half) * dpr)),
        Math.round(half * 2 * dpr), Math.round(half * 2 * dpr)
      ).data;
      let h = 5381;
      for (let i = 0; i < d.length; i += 4) h = ((h * 33) ^ (d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 11)) >>> 0;
      out[type] = h;
    }
    st.enemies.length = 0;
    void path;
    return out;
  });
  const byHash = {};
  for (const type of Object.keys(sigs)) {
    const h = sigs[type];
    (byHash[h] = byHash[h] || []).push(type);
  }
  const clashes = Object.keys(byHash).filter((h) => byHash[h].length > 1).map((h) => byHash[h].join(" = "));
  assert.deepEqual(clashes, [], `enemies that draw identically (a missing art branch): ${clashes.join("; ")}`);
});

test("ART: every enemy has a SILHOUETTE against the lane it walks on, and no two are near-twins", async () => {
  // TWO defects in one measurement pass, both invisible to the exact-hash test
  // above — which only ever caught a MISSING branch, so two enemies could be 98%
  // alike and sail through (measured: screw/tinplane were RGB distance 0).
  //
  // (1) THE SILHOUETTE LAW. Measured WCAG contrast of each enemy's dominant body
  //     colour against its own lane: acorn 1.05:1, housekey 1.06:1, yoyo 1.14:1,
  //     chair 1.27:1, marble 1.43:1, sock 1.58:1. Every lane in every world is a
  //     light tan, so a pale body is structurally invisible. Rendered on the
  //     LIGHTEST lane in the game (the New House, luminance 0.661) — the worst
  //     case, so passing here passes everywhere — each type's own ink boundary
  //     must be DARK, which is what the centralized ink line in `withInk()`
  //     provides. Exempts the Glitter Ghost, whose outline is deliberately
  //     alpha'd so a phased ghost keeps looking untargetable.
  // (2) NEAR-TWINS. A coarse 10x10 mean-RGB signature per type; the closest pair
  //     must differ by more than a floor. This is the honest version of "no two
  //     enemies render the same".
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const lightest = await page.evaluate(() => {
    // The New House lane is the palest surface an enemy ever stands on.
    const L = window.TDData.LEVELS.find((l) => l.world === "newhouse");
    return L ? L.id : 1;
  });
  await page.evaluate((id) => { window.__TD.newGame(id, { seed: 8 }); }, lightest);
  await page.waitForTimeout(140);
  const out = await page.evaluate(() => {
    const st = window.__TD.state(), r = window.__TD.render();
    r.resize();
    const canvas = document.querySelector("#screen-td-play .td-canvas");
    const ctx = canvas.getContext("2d");
    const dpr = canvas.width / canvas.clientWidth;
    const HALF = 44;
    // A MID-LANE distance. At dist 3 the sample box clamps against the canvas
    // edge, so its centre stops being the enemy and the "lane" it measured was
    // whatever floor happened to be there (it reported 78 for a ribbon at ~215).
    const eng = window.__TD.engine();
    const lane = eng.levelDef.paths ? eng.levelDef.paths[0] : eng.levelDef.path;
    let total = 0;
    for (let i = 1; i < lane.length; i++) total += Math.hypot(lane[i][0] - lane[i - 1][0], lane[i][1] - lane[i - 1][1]);
    // The sample distance is CHOSEN BY CONSTRAINT, not a fixed fraction — two
    // fractions were tried and each failed for a different reason that had
    // nothing to do with the art. It must be (a) far enough from every canvas
    // edge that the sample box is fully in bounds, because getImageData returns
    // transparent black outside and those zeros dragged the measured lane luma
    // from ~211 down to 92; and (b) OUTSIDE the mole tunnel (the middle third,
    // where `isHidden` is true and the Digger Mole is correctly drawn as almost
    // nothing — which made it read as a near-twin of every small dark sprite).
    const margin = HALF + 8;
    let D = 0;
    for (let f = 0.10; f <= 0.90; f += 0.01) {
      if (f > 0.30 && f < 0.70) continue;                    // the tunnel third
      const w = eng.posOn(0, total * f), p = window.__TD.w2s(w.x, w.y);
      if (p.x > margin && p.y > margin && p.x < canvas.clientWidth - margin && p.y < canvas.clientHeight - margin) { D = total * f; break; }
    }
    if (!D) throw new Error("no in-bounds off-tunnel sample point on this lane");
    const grab = () => {
      const w = eng.posOn(0, D);
      const p = window.__TD.w2s(w.x, w.y);
      const x0 = Math.round((p.x - HALF) * dpr), y0 = Math.round((p.y - HALF) * dpr);
      const wpx = Math.round(HALF * 2 * dpr), hpx = Math.round(HALF * 2 * dpr);
      return { d: ctx.getImageData(x0, y0, wpx, hpx).data, w: wpx, h: hpx };
    };
    const mk = (type) => {
      const def = window.TDData.ENEMIES[type];
      return {
        id: 1, type, alive: true, hp: def.hp, maxHp: def.hp, shield: def.shield || 0,
        dist: D, pathIdx: 0, slowUntil: 0, slowAmt: 0, speedMult: 1, flier: !!def.flier,
        engagedBy: 0, lastPhase: 0, charge: 0, brittleUntil: 0,
      };
    };
    st.towers.length = 0; st.soldiers.length = 0;
    // B = the EMPTY lane, drawn once: the reference every enemy is diffed against.
    st.enemies.length = 0; r.draw(0);
    const B = grab();
    const luma = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const res = {};
    // The lane luma must be measured where the enemy actually STANDS, not over
    // the whole sample box — the New House floor is a dark grey and its road is
    // the pale surface, so averaging the box reported 78 (the floor) for a
    // ribbon at ~215 and the separation check was meaningless.
    let laneSum = 0, laneN = 0;
    {
      const cx = Math.round(HALF * dpr), cy = Math.round(HALF * dpr);
      const rad = Math.round(6 * dpr);
      for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
        const i = (y * B.w + x) * 4;
        if (i >= 0 && i < B.d.length) { laneSum += luma(B.d, i); laneN++; }
      }
    }
    const laneLuma = laneN ? laneSum / laneN : 128;
    for (const type of Object.keys(window.TDData.ENEMIES)) {
      st.enemies.length = 0; st.enemies.push(mk(type));
      r.draw(0);
      const A = grab();
      // ink mask: pixels the enemy actually changed
      const ink = new Uint8Array(A.w * A.h);
      for (let p = 0, i = 0; p < ink.length; p++, i += 4) {
        const dd = Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2]);
        ink[p] = dd > 30 ? 1 : 0;
      }
      // Boundary = ink pixels with a non-ink 4-neighbour, scored by the DARKEST
      // luma in their 3x3 neighbourhood. The raw boundary pixel is antialiased
      // against the lane, so it reads bright even on a properly rimmed sprite;
      // the neighbourhood minimum asks the real question — "is there a dark line
      // here at all". Measured separation is emphatic: a rimmed roster sits at
      // 24-68 and the two un-rimmed sprites sat at 186 and 191.
      const edge = [];
      for (let y = 1; y < A.h - 1; y++) for (let x = 1; x < A.w - 1; x++) {
        const p = y * A.w + x;
        if (!ink[p]) continue;
        if (ink[p - 1] && ink[p + 1] && ink[p - A.w] && ink[p + A.w]) continue;
        let m = 999;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) m = Math.min(m, luma(A.d, ((y + dy) * A.w + (x + dx)) * 4));
        edge.push(m);
      }
      edge.sort((a, b) => a - b);
      // Coarse mean-RGB signature for the near-twin check, taken over a TIGHT
      // box around the sprite. Over the full 88px sample box, 96 of 100 grid
      // cells are identical background and diluted every real difference by ~25x,
      // so the numbers were unreadable (two clearly different sprites scored
      // 0.33). An enemy is ~17-24px across, so a 32px box is the sprite.
      const G = 8, sig = [];
      const cx0 = A.w / 2, cy0 = A.h / 2, span = 16 * dpr;
      for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
        let sr = 0, sg = 0, sb = 0, n = 0;
        const xa = Math.round(cx0 - span + gx * 2 * span / G), xb = Math.round(cx0 - span + (gx + 1) * 2 * span / G);
        const ya = Math.round(cy0 - span + gy * 2 * span / G), yb = Math.round(cy0 - span + (gy + 1) * 2 * span / G);
        for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) {
          const i = (y * A.w + x) * 4; sr += A.d[i]; sg += A.d[i + 1]; sb += A.d[i + 2]; n++;
        }
        if (n) sig.push(sr / n, sg / n, sb / n); else sig.push(0, 0, 0);
      }
      res[type] = { edgeMed: edge.length ? edge[Math.floor(edge.length / 2)] : 255, edgeN: edge.length, sig };
    }
    st.enemies.length = 0;
    return { laneLuma, res };
  });
  const GHOST_EXEMPT = new Set(["ghost"]); // its rim is alpha'd on purpose (phased = faint)
  const dark = [];
  for (const [type, v] of Object.entries(out.res)) {
    assert.ok(v.edgeN > 20, `${type} barely paints anything (${v.edgeN} boundary px) — it has no readable body`);
    if (GHOST_EXEMPT.has(type)) continue;
    dark.push([type, Math.round(v.edgeMed)]);
  }
  // 110 sits well above the measured rimmed roster (24-68) and well below the
  // two sprites that shipped without one (186, 191), so it cannot flake either way.
  const pale = dark.filter(([, m]) => m > 110);
  assert.deepEqual(pale, [],
    `these enemies have NO dark contour on the palest lane in the game (lane luma ${Math.round(out.laneLuma)}), so on the field they are a shape-shaped smudge — measured body-vs-lane contrast runs as low as 1.05:1: ${pale.map(([t, m]) => t + "=" + m).join(", ")}`);
  // …and it must be meaningfully DARKER than the lane, not merely different.
  // Measured on the New House at lane luma 133: the darkest contours sit at
  // 24-30 and the palest shipped one is the white die at 93 (margin 40), so a
  // 30 floor holds every sprite with headroom while an un-rimmed one (186, 191)
  // lands on the wrong side by a mile.
  const sep = dark.filter(([, m]) => out.laneLuma - m < 30);
  assert.deepEqual(sep, [], `these enemies' contours do not read as darker than the lane they walk on (lane luma ${Math.round(out.laneLuma)}): ${sep.map(([t, m]) => t + "=" + m).join(", ")}`);
  // near-twins: closest pair by mean |dRGB| over the coarse signature
  const types = Object.keys(out.res);
  let worst = { d: Infinity, a: "", b: "" };
  for (let i = 0; i < types.length; i++) for (let j = i + 1; j < types.length; j++) {
    const a = out.res[types[i]].sig, b = out.res[types[j]].sig;
    let s = 0; for (let k = 0; k < a.length; k++) s += Math.abs(a[k] - b[k]);
    const d = s / a.length;
    if (d < worst.d) worst = { d, a: types[i], b: types[j] };
  }
  // Measured closest pairs over the shipped roster: bubblewrap/rag 1.52,
  // chair/carton 1.53, sock/chair 1.61, mole/rag 1.67 — so 1.2 sits below every
  // real pair with headroom while a genuine collision (two branches drawing the
  // same thing) scores near 0. Before the ink line landed, four pairs measured a
  // dominant-body RGB distance of exactly 0 and the exact-hash test passed them.
  assert.ok(worst.d > 1.2,
    `${worst.a} and ${worst.b} render as near-twins (mean channel difference ${worst.d.toFixed(2)}). The exact-hash test only catches a MISSING branch — two enemies 98% alike pass it.`);
});

test("ART: the frame still fits its budget at the crowded-board peak", async () => {
  // The ink line adds a stroke per fill inside the enemy pass, so it has a real
  // per-frame cost — and CLAUDE.md's TD-6 lesson is that perf worry here is
  // usually unfounded but must be MEASURED, not guessed. A/B at L24's documented
  // 100+ concurrent-enemy peak with every pad built: 2.15 ms without the ink,
  // 3.51 ms with, against a 16.7 ms 60fps budget. Pinned generously (headless
  // timing is noisy and CI is slower than this sandbox) so it catches a change
  // that costs MULTIPLES, which is the only kind worth failing a build over.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const last = await page.evaluate(() => window.TDData.LEVELS[window.TDData.LEVELS.length - 1].id);
  await page.evaluate((id) => window.__TD.newGame(id, { seed: 7 }), last);
  await page.waitForTimeout(140);
  const out = await page.evaluate(() => {
    const eng = window.__TD.engine(), st = window.__TD.state(), r = window.__TD.render();
    st.gold = 999999;
    // A MIX at tier 3, not tier-1 darts. The towers are real objects now — a
    // crate with grain and brackets, a fan with a spoked cage, a tent with a
    // sentry — and the busiest art is tier 3, so building one line at its
    // cheapest tier would leave a cost living in the fan or the camp entirely
    // invisible to the only test that watches the frame budget.
    const LINES = Object.keys(window.TDData.TOWERS);
    eng.levelDef.pads.forEach((p, i) => {
      eng.place(LINES[i % LINES.length], p.id);
      const t = st.towers[st.towers.length - 1];
      if (t) { eng.upgrade(t.id); eng.upgrade(t.id); }
    });
    st.waveIdx = eng.levelDef.waves.length - 2; st.sentIdx = st.waveIdx;
    eng.callWave();
    // Sized to be MEANINGFUL but not a CI tax: enough ticks to crowd the board,
    // enough draws to average out noise. The first cut ran 2600 ticks and 160
    // draws, which is real work in a software-rasterized CI browser for a test
    // whose only job is catching a MULTIPLE-cost regression.
    for (let i = 0; i < 900; i++) eng.tick();
    const alive = st.enemies.filter((e) => e.alive).length;
    // A RATIO against a control, not a wall-clock number. `npm test` is bare
    // `node --test`, which runs the test FILES concurrently, and this box also
    // runs balance sims — so an absolute millisecond budget measures the machine
    // as much as the renderer. A mean failed first (one descheduled slice drags
    // it), then a median failed too, because under real starvation EVERY draw is
    // slow and the median rises with them. What this test actually guards is the
    // PER-ENEMY cost of the ink line, so measure exactly that: the same draw with
    // the crowd, and with the crowd removed, interleaved in one window. Both are
    // slowed equally by contention, so their ratio is not.
    const N = 30, crowded = [], empty = [];
    const all = st.enemies;
    for (let i = 0; i < N; i++) {
      st.enemies = all;
      let t = performance.now(); r.draw(i / N); crowded.push(performance.now() - t);
      st.enemies = [];
      t = performance.now(); r.draw(i / N); empty.push(performance.now() - t);
    }
    st.enemies = all;
    const mid = (a) => { const q = a.slice().sort((x, y) => x - y); return q[Math.floor(q.length / 2)]; };
    return { alive, n: N, ms: mid(crowded), base: mid(empty), ratio: mid(crowded) / Math.max(0.01, mid(empty)) };
  });
  assert.ok(out.alive >= 20, `the board is genuinely crowded for this measurement (${out.alive} alive)`);
  assert.ok(out.ratio < 6,
    `drawing ${out.alive} enemies costs ${out.ratio.toFixed(2)}x an empty-board draw ` +
    `(${out.ms.toFixed(2)} ms vs ${out.base.toFixed(2)} ms) — the crowd costs 2.48x on a clean measurement, ` +
    "so this is a MULTIPLE-cost regression in the per-enemy path, not a slow machine");
  // Absolute sanity, deliberately loose: this can only fail if a draw is
  // catastrophically slow in a way the ratio would miss (e.g. the floor itself).
  assert.ok(out.ms < 60, `a crowded draw took ${out.ms.toFixed(2)} ms, which is broken on any machine`);
});

test("no uncaught page errors in the fort run", () => {
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
});

test("ART: firing PAINTS something — a gun that only makes a sound is half a gun", async () => {
  // The engine has always emitted `shoot` and td-main has always played a tick
  // for it, but nothing was ever DRAWN: on a full board every gun fired
  // continuously and the muzzle showed nothing, so a projectile appeared out of
  // the air. This asserts the ink, not the event — the shipped lesson is that a
  // feature whose test only calls the API is untested as a feature.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => window.__TD.newGame(1, { seed: 5 }));
  await page.waitForTimeout(160);
  const out = await page.evaluate(() => {
    const eng = window.__TD.engine(), st = window.__TD.state(), r = window.__TD.render();
    st.gold = 999999;
    const pad = eng.levelDef.pads[0];
    eng.place("dart", pad.id);
    eng.callWave();
    for (let i = 0; i < 400; i++) eng.tick();
    const canvas = document.querySelector("#screen-td-play .td-canvas");
    const c2 = canvas.getContext("2d");
    const dpr = canvas.width / canvas.clientWidth;
    const s = window.__TD.w2s(pad.cx + 0.5, pad.cy + 0.5);
    const R = Math.round(22 * dpr);
    const cx = Math.round(s.x * dpr), cy = Math.round(s.y * dpr);
    const grab = () => Array.from(c2.getImageData(cx - R, cy - R, R * 2, R * 2).data);
    // the SAME state drawn twice: once with a fresh muzzle flash queued, once
    // without. Anything else on the board is identical, so a difference is the
    // flash and nothing else.
    r.afterTick(); r.draw(0);
    const without = grab();
    r.pushFx({ type: "shoot", x: pad.cx, y: pad.cy, tower: "dart" });
    r.draw(0);
    const withFlash = grab();
    let diff = 0;
    for (let i = 0; i < without.length; i += 4) {
      if (Math.abs(without[i] - withFlash[i]) + Math.abs(without[i + 1] - withFlash[i + 1])
        + Math.abs(without[i + 2] - withFlash[i + 2]) > 12) diff++;
    }
    return { diff, hasPushFx: typeof r.pushFx === "function" };
  });
  assert.ok(out.hasPushFx, "the renderer must expose pushFx for this to be drivable");
  assert.ok(out.diff > 60,
    `firing changed only ${out.diff} pixels at the muzzle — a shot must be visible, not just audible`);
});

test("ART: the field is lit from ONE direction, in BOTH orientations", async () => {
  // The fort had shading but no LIGHT: every shadow was a centred blob, so
  // nothing agreed about where it was lit from and objects read as stickers on a
  // plane. One shared vector now drives every cast shadow and lit edge — and it
  // needs a guardrail precisely because it CANNOT be eyeballed.
  //
  // Two reasons. (1) The baked floor plate is WORLD-oriented and drawn through a
  // 90° rotation in portrait, so a shadow baked "down-right" comes out pointing
  // down-LEFT on a phone; the bake has to use the inverse of `w2s`'s rotation and
  // getting that backwards looks completely normal in a screenshot. (2) The
  // bedroom's `stain` props look exactly like cast shadows, which is how a wrong
  // answer gets believed — I nearly "corrected" a correct rotation because of one.
  //
  // Method: sample a ring around every prop and compare mean luma on the lit side
  // against the shadow side. Shadow side must be measurably darker, in BOTH
  // orientations. The ring scales with the CELL — its first version used a fixed
  // 16px, about one cell in landscape but well past the prop in portrait where
  // the cell is less than half the size, and duly reported a meaningless -0.19.
  for (const [w, h, name] of [[390, 844, "portrait"], [844, 390, "landscape"]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => { location.hash = "#td-play"; });
    await page.locator("#screen-td-play").waitFor({ state: "visible" });
    await page.evaluate(() => window.__TD.newGame(1, { seed: 3 }));
    await page.waitForTimeout(160);
    const out = await page.evaluate(() => {
      const r = window.__TD.render();
      r.resize(); r.draw(0);
      const canvas = document.querySelector("#screen-td-play .td-canvas");
      const c2 = canvas.getContext("2d");
      const dpr = canvas.width / canvas.clientWidth;
      const LIGHT = { x: -0.55, y: -0.84 };                 // must match td-render.js
      const cells = window.TDLogic.propCells(window.TDData.LEVELS[0], { w: 24, h: 14 });
      const o0 = window.__TD.w2s(0, 0), o1 = window.__TD.w2s(1, 0);
      const cellPx = Math.hypot(o1.x - o0.x, o1.y - o0.y);
      const luma = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      let lit = 0, shad = 0, n = 0;
      for (const p of cells) {
        const s = window.__TD.w2s(p.x + 0.5, p.y + 0.5);
        const R = Math.round(cellPx * 0.95 * dpr);
        const cx = Math.round(s.x * dpr), cy = Math.round(s.y * dpr);
        if (cx - R < 0 || cy - R < 0 || cx + R > canvas.width || cy + R > canvas.height) continue;
        const A = c2.getImageData(cx - R, cy - R, R * 2, R * 2);
        for (let y = 0; y < A.height; y++) for (let x = 0; x < A.width; x++) {
          const dx = x - R, dy = y - R, d = Math.hypot(dx, dy);
          if (d < R * 0.55 || d > R) continue;              // a ring OUTSIDE the body
          const dot = (dx * LIGHT.x + dy * LIGHT.y) / (d || 1);
          const i = (y * A.width + x) * 4;
          if (dot > 0.5) { lit += luma(A.data, i); n++; }
          else if (dot < -0.5) { shad += luma(A.data, i); }
        }
      }
      return { lit: lit / n, shad: shad / n, props: cells.length, n };
    });
    assert.ok(out.n > 200, `${name}: too few samples (${out.n}) for this to mean anything`);
    assert.ok(out.lit - out.shad > 2,
      `${name}: the shadow side of a prop measured ${out.shad.toFixed(1)} luma against a lit side of ${out.lit.toFixed(1)} ` +
      "— the field is not lit from LIGHT. In portrait this usually means the bake forgot that its plate is rotated 90°.");
  }
  await page.setViewportSize({ width: 390, height: 844 });
});

test("ART: a boss really is BIGGER, and its leak flashes deeper than a sock's", async () => {
  // TD-15 made both of these DATA fields (`size`, `lives`) read by one helper
  // each, and neither was ever rendered in a test — a boss could have shipped
  // at sock scale, or a 10-life leak could have blinked like a 1-life one, and
  // every number test would still have passed.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 8 }); });
  await page.waitForTimeout(120);

  // 1. INK AREA: paint one enemy at a time and count the pixels it covers.
  const ink = await page.evaluate(() => {
    const st = window.__TD.state(), r = window.__TD.render();
    r.resize();
    const cv = document.querySelector("#screen-td-play .td-canvas");
    const ctx = cv.getContext("2d");
    const dpr = cv.width / cv.clientWidth;
    const out = {};
    const measure = (type) => {
      const def = window.TDData.ENEMIES[type];
      st.towers.length = 0; st.soldiers.length = 0; st.enemies.length = 0;
      st.enemies.push({ id: 1, type, alive: true, hp: def.hp, maxHp: def.hp, shield: def.shield || 0,
        dist: 3, pathIdx: 0, slowUntil: 0, slowAmt: 0, speedMult: 1, flier: !!def.flier,
        engagedBy: 0, lastPhase: 0, charge: 0, brittleUntil: 0 });
      r.draw(0);
      const w = window.__TD.engine().posOn(0, 3);
      const p = window.__TD.w2s(w.x + 0.5, w.y + 0.5);
      const half = 90;
      const x0 = Math.max(0, Math.round((p.x - half) * dpr)), y0 = Math.max(0, Math.round((p.y - half) * dpr));
      const w0 = Math.min(cv.width - x0, Math.round(half * 2 * dpr)), h0 = Math.min(cv.height - y0, Math.round(half * 2 * dpr));
      const a = ctx.getImageData(x0, y0, w0, h0).data;
      st.enemies.length = 0; r.draw(0);
      const b = ctx.getImageData(x0, y0, w0, h0).data;
      let n = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++;
      }
      return n;
    };
    for (const type of Object.keys(window.TDData.ENEMIES)) out[type] = measure(type);
    return out;
  });
  const sizes = await page.evaluate(() => {
    const o = {};
    for (const [k, d] of Object.entries(window.TDData.ENEMIES)) o[k] = { boss: !!d.boss, size: d.size || 1, lives: d.lives || 1 };
    return o;
  });
  const bosses = Object.keys(sizes).filter((k) => sizes[k].boss);
  const grunts = Object.keys(sizes).filter((k) => !sizes[k].boss);
  assert.ok(bosses.length >= 3, `there are bosses to check (${bosses.join(", ")})`);
  const biggestGrunt = Math.max(...grunts.map((k) => ink[k]));
  for (const b of bosses) {
    assert.ok(sizes[b].size > 1, `${b} declares a boss size (${sizes[b].size})`);
    assert.ok(ink[b] > biggestGrunt * 1.5,
      `${b} really PAINTS bigger than any ordinary toy (${ink[b]}px vs the biggest grunt's ${biggestGrunt}px)`);
  }

  // 2. The leak flash: a multi-life leak must read heavier than a 1-life one.
  const flash = await page.evaluate(() => {
    const r = window.__TD.render();
    const read = (ev) => {
      r.pushFx(ev);
      const f = (r.fxInfo ? r.fxInfo() : null) || null;
      return f;
    };
    // no fxInfo hook: measure the PAINT instead, on a cleared field
    const st = window.__TD.state();
    st.enemies.length = 0; st.towers.length = 0; st.soldiers.length = 0;
    const cv = document.querySelector("#screen-td-play .td-canvas");
    const ctx = cv.getContext("2d");
    const sample = (ev) => {
      r.draw(0);
      const base = ctx.getImageData(0, 0, cv.width, cv.height).data;
      r.pushFx(ev);
      r.draw(0);
      const lit = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let diff = 0;
      for (let i = 0; i < base.length; i += 4) diff += Math.abs(lit[i] - base[i]);
      // drain the fx so the next sample starts clean
      for (let i = 0; i < 60; i++) r.draw(0);
      return diff;
    };
    const sock = sample({ type: "leak", enemy: "sock", lives: 1, boss: false });
    for (let i = 0; i < 60; i++) r.draw(0);
    const boss = sample({ type: "leak", enemy: "bedmonster", lives: 6, boss: true });
    return { sock, boss };
  });
  assert.ok(flash.sock > 0, `an ordinary leak flashes at all (${flash.sock})`);
  assert.ok(flash.boss > flash.sock * 1.4,
    `a boss leak flashes deeper than a sock's (${flash.boss} vs ${flash.sock}) — a 6-sticker hit must not blink like a 1`);
});

test("the Resume banner's ✕ dismisses a run that is STILL LIVE", async () => {
  // Reported from real play: "I couldn't dismiss the resume button at top of
  // home page for a game in progress I wanted to hit x on."
  //
  // The ✕ cleared the checkpoint and then re-routed to the fort — and
  // route("td-home") opens with leavingPlay(), which re-checkpoints a live run
  // parked in its BUILD phase. So the clear was undone within the same call and
  // the banner never went away. It only misbehaved for a game IN PROGRESS
  // (quitting mid-WAVE writes no checkpoint, so the ✕ looked fine), which is
  // what made it read as intermittent rather than broken.
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => {
    window.__TD.newGame(2, { seed: 5 });
    const lvl = window.__TD.engine().levelDef;
    window.__TD.script([["place", "dart", lvl.pads[0].id]]);   // stay in BUILD
  });
  assert.equal(await page.evaluate(() => window.__TD.state().phase), "build",
    "the run is parked in the build phase — the state that reproduced it");
  await page.evaluate(() => { window.__TD.leaveToHome(); });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.waitForTimeout(150);
  assert.ok(await page.locator("#screen-td-home .td-resume").isVisible(),
    "leaving a live build-phase run offers to resume it");
  await page.locator("#screen-td-home .td-resume__x").click();
  await page.waitForTimeout(250);
  assert.ok(!(await page.locator("#screen-td-home .td-resume").isVisible()),
    "✕ really dismisses the banner");
  const saved = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1") || "{}");
    return { midRun: !!raw.midRun };
  });
  assert.equal(saved.midRun, false, "…and the checkpoint is gone from storage, not just from the DOM");
  // …and it STAYS gone: re-entering the fort must not resurrect it, which is
  // the half the original bug actually failed.
  await page.evaluate(() => { window.JonTD.route("td-home"); });
  await page.waitForTimeout(200);
  assert.ok(!(await page.locator("#screen-td-home .td-resume").isVisible()),
    "re-routing to the fort does not bring the discarded run back");
  assert.equal(await page.evaluate(() => !!JSON.parse(localStorage.getItem("jon-td-save-v1") || "{}").midRun),
    false, "…and nothing re-checkpointed it");
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("GIMMICK 🚪 side door: visible, distinct from the exit, and announced BEFORE you spend", async () => {
  // Reported from real play: "the gimmick where they spawn part way down path
  // (door) is malfunctioning as user cannot see the door or anticipate it."
  // Three defects, all invisible to the engine sims (the enemies DID enter at
  // the marker — the audit measured that; what it never checked was whether a
  // player could SEE or ANTICIPATE it):
  //   1. the marker wore 🚪 — the EXIT's own glyph, so "they come in here" and
  //      "they escape here and cost you lives" were the same picture
  //   2. it was drawn during BUILD only, so it vanished exactly when the flank
  //      arrived (and they arrive BEHIND your guns)
  //   3. the next-wave preview never mentioned it, so gold was committed blind
  const DOOR_LEVEL = 18, DOOR_WAVE = 5; // L18 w6 sends 45 marbles in at dist 31
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });

  const build = await page.evaluate(({ n, w }) => {
    window.__TD.newGame(n, { seed: 7 });
    const st = window.__TD.state();
    st.waveIdx = w; st.sentIdx = w; st.phase = "build";
    window.TDUI.hud(st);
    const r = window.__TD.render(); r.resize(); r.draw(0);
    return { info: r.doorInfo(), preview: document.querySelector("#screen-td-play .td-nextwave").textContent };
  }, { n: DOOR_LEVEL, w: DOOR_WAVE });

  assert.ok(build.info.doors.length >= 1, "the door is marked on the field during build — you must see it before you commit gold");
  assert.notEqual(build.info.glyph, build.info.exitGlyph,
    "the side door must NOT wear the exit's glyph — one is where enemies come IN, the other is where they escape");
  assert.match(build.preview, /🚪\d+/,
    "the next-wave preview must say a flank is coming (count + 🚪), or the door can only be DISCOVERED, never anticipated");

  // …and it must SURVIVE into the wave: the flank walks in behind your towers,
  // so a marker that disappears on CALL is gone exactly when it is needed.
  const during = await page.evaluate(() => {
    const st = window.__TD.state();
    st.phase = "wave"; st.sentIdx = st.waveIdx + 1;
    const r = window.__TD.render(); r.draw(0);
    return r.doorInfo().doors.length;
  });
  assert.ok(during >= 1, "the door stays marked while a wave using it is in flight");

  // A level with no door on the next wave must show NO marker and NO warning —
  // a permanent marker on an unused lane would be a lie.
  const plain = await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 7 });          // L1 has no side door at all
    const st = window.__TD.state();
    window.TDUI.hud(st);
    const r = window.__TD.render(); r.resize(); r.draw(0);
    return { doors: r.doorInfo().doors.length, preview: document.querySelector("#screen-td-play .td-nextwave").textContent };
  });
  assert.equal(plain.doors, 0, "a level with no side door marks none");
  assert.doesNotMatch(plain.preview, /🚪/, "…and its preview must not cry door");
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("TD17 lever: the diversion is TIMED, and the countdown is VISIBLE on the switch", async () => {
  // Reported: "nobody would ever NOT choose the long path and just leave it… it
  // should only last for temporary then auto switch back… make timer visible on
  // the path switch." The engine side (snap-back, cooldown, game-time ticks) is
  // pinned in td-logic.test.js; this asserts the PLAYER can see the clock, which
  // no number test can — the lever is painted on the canvas, not in the DOM.
  //
  // It reads the actual fillText calls rather than hashing pixels. Two mutation
  // rounds killed the pixel version: a sample wide enough to include the
  // draining ARC changed even with the numeral deleted, and the lever sits ON
  // the lane, so marching enemies changed the pixels under it regardless. Text
  // calls are unconfounded — this proves the RIGHT NUMBER is drawn AT the lever.
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });

  const drawAndRead = () => page.evaluate(() => {
    const proto = CanvasRenderingContext2D.prototype;
    const real = proto.fillText;
    const calls = [];
    proto.fillText = function (t, x, y) { calls.push({ t: String(t), x: x, y: y }); return real.apply(this, arguments); };
    try { window.__TD.render().draw(0); } finally { proto.fillText = real; }
    const lv = window.__TD.engine().levelDef.lever;
    const p = window.__TD.w2s(lv.cx + 0.5, lv.cy + 0.5);
    const near = calls.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) < 22).map((c) => c.t);
    return { near: near, state: window.__TD.engine().leverState() };
  });

  await page.evaluate(() => {
    window.__TD.newGame(10, { seed: 7 });
    const e = window.__TD.engine();
    e.callWave(); for (let i = 0; i < 60; i++) e.tick();
  });
  const ready = await drawAndRead();
  assert.equal(ready.state.phase, "ready", "the lever starts armed");
  assert.ok(ready.near.includes("TAP: LONG WAY"), `an armed lever INVITES the tap (drew ${JSON.stringify(ready.near)})`);

  const started = await page.evaluate(() => { const e = window.__TD.engine(); return { r: e.pullLever(), s: e.leverState() }; });
  assert.ok(started.r.ok && started.s.phase === "running", "tapping it starts a timed diversion");
  const runA = await drawAndRead();
  assert.ok(runA.near.includes("LONG WAY"), "the field says the long route is live");
  assert.ok(runA.near.includes(String(Math.ceil(runA.state.secs))),
    `the SECONDS REMAINING are drawn on the switch (expected "${Math.ceil(runA.state.secs)}", drew ${JSON.stringify(runA.near)})`);

  // …and the clock actually moves: 4 seconds later a different number is drawn.
  await page.evaluate(() => { const e = window.__TD.engine(); for (let i = 0; i < 4 * 30; i++) e.tick(); });
  const runB = await drawAndRead();
  assert.ok(runB.state.secs < runA.state.secs - 3, `the countdown is running (${runA.state.secs}s → ${runB.state.secs}s)`);
  assert.ok(runB.near.includes(String(Math.ceil(runB.state.secs))), "…and the drawn number FOLLOWS it down");
  assert.ok(!runB.near.includes(String(Math.ceil(runA.state.secs))), "a stale number is not left on screen");

  // it ends by itself, which is the whole point of the change
  const done = await page.evaluate(() => {
    const e = window.__TD.engine();
    for (let i = 0; i < 8 * 30; i++) e.tick();
    return { route: e.state.leverRoute, s: e.leverState(), refuse: e.pullLever().reason };
  });
  assert.equal(done.route, 0, "the diversion snaps back to the short route with no input");
  assert.equal(done.s.phase, "cooldown", "…and goes on cooldown rather than re-arming instantly");
  assert.equal(done.refuse, "cooldown", "it cannot be re-thrown during the cooldown — otherwise it is permanent again");
  const cool = await drawAndRead();
  assert.ok(cool.near.includes("SHORT WAY"), "the field shows the short route again");
  assert.ok(cool.near.includes(String(Math.ceil(cool.state.secs))), "the re-arm countdown is drawn too, so you can time the next one");
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("TD9 control strip: adjacent power tiles must never OVERLAP (the strip is full at four)", async () => {
  // `.td-abil { min-width: 44px }` masks track starvation: when a 5th power is
  // added the grid cannot shrink the tiles, so instead of overflowing they
  // physically overlap — and `scrollWidth === clientWidth` throughout, which is
  // why every shipped overflow guardrail stays green. Reproduced by cloning
  // tiles: at 320px a 5th tile overlaps its neighbour by 6px and a 6th by 19px;
  // at 360px a 6th by 9px; at 390px by 1.5px. That is the audit hole that makes
  // "the ability strip has room for exactly four" an enforceable fact rather
  // than a comment, and it is the gate any 5th power has to pass.
  //
  // Grouped BY ROW: in landscape the strip is a vertical column in the gutter,
  // where tiles share an x-range by design — comparing left/right there would
  // be a false failure.
  const probe = async (w, h, clones) => {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => { window.__TD.resetSave(); location.hash = "#td-play"; });
    await page.locator("#screen-td-play").waitFor({ state: "visible" });
    await page.evaluate(() => { window.__TD.newGame(1, { seed: 7 }); });
    await page.waitForTimeout(120);
    return page.evaluate((n) => {
      const strip = document.querySelector("#screen-td-play .td-abils") || document.querySelector("#screen-td-play .td-controls");
      if (!strip) return { worst: 0, tiles: 0 };
      const proto = strip.querySelector(".td-abil");
      const added = [];
      for (let i = 0; i < n; i++) { const c = proto.cloneNode(true); strip.appendChild(c); added.push(c); }
      const rects = [...strip.querySelectorAll(".td-abil")].map((e) => e.getBoundingClientRect());
      // same ROW = same top (within a few px); only then is left/right meaningful
      let worst = 0;
      const rows = {};
      for (const r of rects) { const k = Math.round(r.top / 4); (rows[k] = rows[k] || []).push(r); }
      for (const k of Object.keys(rows)) {
        const row = rows[k].sort((a, b) => a.left - b.left);
        for (let i = 1; i < row.length; i++) worst = Math.min(worst, row[i].left - row[i - 1].right);
      }
      added.forEach((a) => a.remove());
      return { worst: Math.round(worst * 10) / 10, tiles: rects.length };
    }, clones);
  };

  // DERIVED from RULES.abilitySlots, never the number we happen to ship with —
  // P6 grew the POOL past the strip, so a literal 4 here would have quietly
  // become a coincidence. Raising abilitySlots without widening the strip now
  // turns this test red, which is exactly its job.
  const SLOTS = await page.evaluate(() => window.TDData.RULES.abilitySlots);
  for (const [w, h] of [[320, 568], [360, 640], [390, 844]]) {
    const now = await probe(w, h, 0);
    assert.equal(now.tiles, SLOTS, `the shipped strip is RULES.abilitySlots (${SLOTS}) powers at ${w}px`);
    assert.ok(now.worst >= 0, `the SHIPPED ${SLOTS} tiles must not overlap at ${w}px (worst gap ${now.worst}px)`);
  }
  // …and a 5th would. This is the assertion that makes the limit real: it fails
  // on the pre-fix code only in the sense that nothing checked it — add a power
  // without widening the strip and this is what catches it.
  const five = await probe(320, 568, 1);
  assert.ok(five.worst < 0,
    `a ${SLOTS + 1}th power is expected to overlap at 320px today (measured ${five.worst}px) — if this no longer holds the strip was widened, ` +
    "which is good news: re-measure and update this test rather than deleting it");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("P6 loadout: the strip IS the pack — a power you left behind is not on it and cannot fire", async () => {
  // The strip used to be built ONCE from the whole of TDData.ABILITIES, which
  // was only ever correct while the pool happened to be exactly the strip's
  // width. Reverting UI.abilityStrip to read the pool renders every power and
  // this test goes red — that is the mutation it exists to catch.
  const packed = await page.evaluate(() => {
    window.__TD.resetSave();
    const pool = window.TDData.ABILITIES.map((a) => a.id);
    // a legal, deliberately NON-default pack: drop the horn, bring the newest
    const pack = pool.filter((id) => id !== "horn").slice(0, window.TDData.RULES.abilitySlots);
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    raw.powers = pack;
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
    return pack;
  });
  // A hash-only "reload" is a SAME-DOCUMENT navigation, so module init never
  // re-runs and the seeded save is silently ignored (a documented footgun that
  // cost a red run once). Reload, THEN hop the hash.
  await page.reload();
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 7 }); });
  await page.waitForTimeout(150);

  const shown = await page.evaluate(() => [...document.querySelectorAll("#screen-td-play .td-abil")].map((b) => b.dataset.abil));
  assert.deepEqual(shown, packed, "the strip renders exactly the packed powers, in order");
  const run = await page.evaluate(() => window.__TD.engine().state.powers);
  assert.deepEqual(run, packed, "…and the RUN was handed the same list (not everything owned)");
  const refused = await page.evaluate(() => window.__TD.engine().abilityReady("horn"));
  assert.equal(refused.reason, "not-equipped", "the power left behind is refused by the engine, not merely hidden");

  await page.evaluate(() => { window.__TD.resetSave(); });
  await page.reload();
  // leave a NEUTRAL hash: a following test that sets the hash to the value it
  // already holds fires no hashchange, so route() never runs and its screen
  // never appears (this stranded the next test on a hidden #screen-td-play)
  await page.evaluate(() => { location.hash = ""; });
});

test("QoL: the enemy cards' numbers are NAMED", async () => {
  // 56 cards print `❤️ 34 · 🏃 0.8 · 🪙 5` and nothing anywhere said what any of
  // it was. ❤️ and 🪙 are guessable; 🏃 is not — it is cells a second, which no
  // surface states, and a bare 0.8 has no anchor at all until you have read
  // several cards. Same class as ⚙️ Toy Energy shipping as a bare numeral, on
  // the biggest reference surface in the game.
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.click("#screen-td-home .td-guide-open");
  await page.locator(".td-overlay--guide").waitFor({ state: "visible" });
  try {
    const out = await page.evaluate(() => {
      const box = document.querySelector(".td-overlay--guide .td-overlay__box");
      const head = [...box.querySelectorAll("[data-sec]")].find((h) => /Enemies/.test(h.dataset.sec));
      const intro = head && head.nextElementSibling ? (head.nextElementSibling.textContent || "") : "";
      // the UNION over every card, not the first one: the first card has no
      // armour and no shield, so sampling it alone silently exempts exactly the
      // two conditional figures — the mutation that drops them from the legend
      // passed until this walked all 56 rows.
      const rows = [...box.querySelectorAll(".td-guide__stats")].map((el) => (el.textContent || "").trim());
      return { intro, rows, speeds: window.TDLogic.rosterSpeeds() };
    });
    assert.ok(out.rows.length > 30, `every card renders a stat row (${out.rows.length})`);
    // DERIVED: every glyph any row can print must be named where the section
    // introduces the cards, so a sixth stat cannot ship unexplained.
    const glyphs = [...new Set(out.rows.join(" ").match(/\p{Extended_Pictographic}\uFE0F?/gu) || [])];
    assert.ok(glyphs.length >= 5, `the rows must print the full stat set (${glyphs.join(" ")})`);
    for (const g of glyphs) {
      assert.ok(out.intro.includes(g), `the legend names ${g}, which a card's stat row prints`);
    }
    assert.match(out.intro, /cells a second/, "…and says what the speed figure IS, since nothing else does");
    assert.ok(out.intro.includes(String(out.speeds.min)) && out.intro.includes(String(out.speeds.max)),
      `the stated range must be the roster's own (${out.speeds.min}–${out.speeds.max}, saw "${out.intro}")`);
    // …and that clause alone is satisfied by a typed "0.45–2", because it
    // compares the text against the very values the owner returns. Only a
    // roster the literal cannot know falsifies it.
    const grown = await page.evaluate(() => {
      window.TDUI.closeOverlay();
      window.TDData.ENEMIES.__fast = { name: "Test Sprinter", icon: "⚡", hp: 1, speed: 99, bounty: 1 };
      window.TDUI.showGuide();
      const box = document.querySelector(".td-overlay--guide .td-overlay__box");
      const head = [...box.querySelectorAll("[data-sec]")].find((h) => /Enemies/.test(h.dataset.sec));
      const txt = head && head.nextElementSibling ? (head.nextElementSibling.textContent || "") : "";
      delete window.TDData.ENEMIES.__fast;
      return txt;
    });
    assert.ok(grown.includes("99"),
      `a faster body must move the stated range (saw "${grown}") — otherwise it is a typed literal`);

    // The guide is a REFERENCE, so what it states about a node must match what
    // the ⭐ Star Tree dialog states — they list the same forty. The gate shipped
    // to the dialog alone at first, which is the sibling-surface shape this
    // project keeps recording, so both are checked from the one owner.
    const both = await page.evaluate(() => {
      window.TDUI.closeOverlay();
      window.TDUI.showGuide();
      const box = document.querySelector(".td-overlay--guide .td-overlay__box");
      const tree = box.querySelector(".td-guide__tree");
      const txt = tree ? (tree.textContent || "") : "";
      const gated = (window.TDData.META_NODES || [])
        .map((n) => ({ name: n.name, gate: window.TDLogic.nodeGate(n.id) })).filter((x) => x.gate);
      // …and every tower LINE states its own price, as its branches already do
      const lines = [...box.querySelectorAll(".td-guide__towers > li")].map((li) => (li.textContent || "").trim());
      const towers = Object.entries(window.TDData.TOWERS).map(([k, t]) => ({ name: t.name, cost: t.tiers[0].cost }));
      return { txt, gated, lines, towers };
    });
    assert.ok(both.gated.length >= 3, `the gated nodes must be found (${both.gated.length})`);
    for (const g of both.gated) {
      assert.ok(both.txt.includes(g.gate),
        `the guide's tree list states "${g.name}"'s gate too, not just the ⭐ dialog (missing "${g.gate}")`);
    }
    for (const t of both.towers) {
      const li = both.lines.find((x) => x.includes(t.name));
      assert.ok(li, `the guide lists ${t.name}`);
      assert.ok(li.includes(String(t.cost) + "🪙"),
        `${t.name} states what it costs (${t.cost}🪙) — every branch under it already does (saw "${li}")`);
    }
  } finally {
    await page.evaluate(() => { try { window.TDUI.closeOverlay(); } catch (e) { /* nothing open */ } });
  }
  await page.evaluate(() => { location.hash = ""; });
});

test("QoL: the guide's sections LOOK like sections", async () => {
  // The guide is 17,000px — two dozen screenfuls over nine topics — and its
  // section headings were the section's own prose wearing the dialog-subtitle
  // class: measured at 14.72px / weight 400 / #cfe2ff with margin 0 against a
  // 16px body, i.e. SMALLER and quieter than the paragraphs they introduced,
  // with zero separation. The contents row could jump to them; a reader
  // scrolling had no landmark at all. Derived over every [data-sec], so a tenth
  // section inherits this rather than needing the test edited.
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.click("#screen-td-home .td-guide-open");
  await page.locator(".td-overlay--guide").waitFor({ state: "visible" });
  try {
    const out = await page.evaluate(() => {
      const box = document.querySelector(".td-overlay--guide .td-overlay__box");
      const secs = [...box.querySelectorAll("[data-sec]")];
      const num = (v) => parseFloat(v) || 0;
      return {
        height: box.scrollHeight,
        rows: secs.map((el, i) => {
          const c = getComputedStyle(el);
          let p = el.previousElementSibling;
          while (p && !(p.textContent || "").trim()) p = p.previousElementSibling;
          const pc = p ? getComputedStyle(p) : null;
          return {
            label: el.dataset.sec, text: (el.textContent || "").trim(), first: i === 0,
            fs: num(c.fontSize), fw: num(c.fontWeight), col: c.color,
            bodyFs: pc ? num(pc.fontSize) : 0, bodyFw: pc ? num(pc.fontWeight) : 0, bodyCol: pc ? pc.color : "",
            gap: p ? Math.round(el.getBoundingClientRect().top - p.getBoundingClientRect().bottom) : 0,
          };
        }),
      };
    });
    assert.ok(out.rows.length >= 6, `the guide must have real sections (saw ${out.rows.length})`);
    assert.ok(out.height > 5000, `…in a document long enough to need them (${out.height}px)`);
    for (const r of out.rows) {
      // ONE owner: the heading you land on says the same thing as the button
      // that took you there, because both read the same attribute.
      assert.equal(r.text, r.label, `the "${r.label}" heading shows the label the contents row jumps by`);
      assert.ok(r.fs > r.bodyFs,
        `"${r.label}" must be BIGGER than the body it introduces (${r.fs}px vs ${r.bodyFs}px)`);
      assert.ok(r.fw >= 700 && r.fw > r.bodyFw,
        `"${r.label}" must be bolder than the body (${r.fw} vs ${r.bodyFw})`);
      assert.notEqual(r.col, r.bodyCol, `"${r.label}" must not be the body's own colour (${r.col})`);
      // …and it needs AIR, or a bigger word is still a wall of text. The first
      // follows the dialog title and needs no rule to separate it.
      if (!r.first) assert.ok(r.gap >= 12, `"${r.label}" needs real separation above it (${r.gap}px)`);
    }
    // …and the guide is the one dialog that is a DOCUMENT rather than a row of
    // controls, so its column reads left. Its lists and enemy cards already did;
    // the prose around them was missed, and measured centred the Powers
    // paragraph runs 14 lines at 320px ragged on BOTH edges. The dialog title
    // and the contents row are chrome and stay centred, so this asks only about
    // the body.
    const prose = await page.evaluate(() => {
      const box = document.querySelector(".td-overlay--guide .td-overlay__box");
      const els = [...box.querySelectorAll("[data-sec], p.td-overlay__sub, .td-guide__towers, .td-guide__card")];
      return els.map((el) => ({ align: getComputedStyle(el).textAlign, len: (el.textContent || "").trim().length }));
    });
    assert.ok(prose.length >= 15, `the guide's body must be a real population (${prose.length})`);
    assert.ok(prose.some((x) => x.len > 200), "…and it must actually contain long-form prose, or alignment is moot");
    const centred = prose.filter((x) => x.align !== "left" && x.align !== "start");
    assert.equal(centred.length, 0,
      `every run in the guide's body reads left — ${centred.length} of ${prose.length} do not`);
  } finally {
    await page.evaluate(() => { try { window.TDUI.closeOverlay(); } catch (e) { /* nothing open */ } });
  }
  await page.evaluate(() => { location.hash = ""; });
});

test("QoL: the star tree says when a node is GATED on something you may not have", async () => {
  // A scan proves the owner emits the line; only opening the dialog proves the
  // render loop puts it on the page — the standing pairing.
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.click("#screen-td-home .td-tree-open");
  await page.locator(".td-tree").waitFor({ state: "visible" });
  try {
    const want = await page.evaluate(() => (window.TDData.META_NODES || [])
      .map((n) => ({ id: n.id, gate: window.TDLogic.nodeGate(n.id) })).filter((x) => x.gate));
    assert.ok(want.length >= 3, `the gated nodes must be found (saw ${want.length})`);
    for (const w of want) {
      const line = page.locator(`.td-tree .td-node[data-node="${w.id}"] .td-node__gate`);
      assert.equal(await line.count(), 1, `${w.id} renders its gate line`);
      assert.equal((await line.textContent()).trim(), w.gate, `${w.id} renders the OWNER's text`);
    }
    // …and it stays a SIGNAL: a node with no gate must not grow an empty line,
    // which is the fort's own rule for the meta-row badges (a mark that is
    // always there is decoration).
    const bare = await page.evaluate((ids) => {
      const rows = [...document.querySelectorAll(".td-tree .td-node")].filter((n) => ids.indexOf(n.dataset.node) < 0);
      return { total: rows.length, withLine: rows.filter((n) => n.querySelector(".td-node__gate")).map((n) => n.dataset.node) };
    }, want.map((w) => w.id));
    assert.ok(bare.total > 20, `the ungated rows must be a real population (${bare.total})`);
    assert.deepEqual(bare.withLine, [], "an ungated node must carry NO gate line");
    // A LOCKED row already spends this line on its requirement, so it keeps that
    // rather than showing both.
    const locked = await page.evaluate(() => {
      const n = document.querySelector(".td-tree .td-node--locked");
      return n ? { id: n.dataset.node, desc: (n.querySelector(".td-node__desc") || {}).textContent || "",
                   gate: !!n.querySelector(".td-node__gate") } : null;
    });
    assert.ok(locked, "the fresh save must show at least one locked node");
    assert.match(locked.desc, /🔒/, "a locked row states its requirement");
  } finally {
    await page.evaluate(() => { try { window.TDUI.closeOverlay(); } catch (e) { /* nothing open */ } });
  }
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = ""; });
});

test("QoL: the Powers Pack says how OFTEN a power comes back", async () => {
  // The pack is a trade of 4 for 5, and the cooldown is most of what separates
  // them — 20s to 30s across the pool. It was stated in the 📖 Guide and NOT on
  // the screen where the choice is made, which is the same law that shipped the
  // ⬆ upgrade preview, the % road figure and the ⭐ star goal: the information
  // belongs at the moment of the decision.
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.click("#screen-td-home .td-powers-open");
  await page.locator(".td-powers").waitFor({ state: "visible" });
  // DERIVED over the pool, so a sixth power inherits this rather than needing
  // the test edited.
  const pool = await page.evaluate(() => (window.TDData.ABILITIES || []).map((a) => ({ id: a.id, cd: a.cooldown })));
  assert.ok(pool.length >= 5, `the pool must be real (${pool.length} powers)`);
  // A test that opens a dialog owns closing it EVEN WHEN IT FAILS: an assertion
  // thrown mid-loop leaves the picker over the fort home and strands whatever
  // runs next on a dialog it did not open — the "presented as an unrelated test
  // timing out" trap. Proven while mutation-testing this: two of three mutations
  // took the following test down with them until this finally was added.
  const shown = [];
  try {
  for (const a of pool) {
    const row = page.locator(`.td-powers .td-node[data-power="${a.id}"]`);
    assert.equal(await row.count(), 1, `${a.id} has a row`);
    const cd = row.locator(".td-node__cd");
    assert.equal(await cd.count(), 1, `${a.id}'s row states how often it comes back`);
    const txt = (await cd.textContent()).trim();
    assert.equal(txt, "every " + a.cd + "s", `${a.id} states ITS OWN cooldown (saw "${txt}")`);
    shown.push(txt);
  }
  // …and the number is not a constant wearing the shape of a derivation: the
  // clause above compares against the same field the UI reads, so a hard-coded
  // "every 25s" on every row would satisfy it only if every cooldown matched.
  assert.ok(new Set(shown).size >= 2,
    `the rendered cooldowns must differ between powers (saw ${[...new Set(shown)].join(", ")})`);
  // The line takes its own ROW inside the cost cell, so it cannot widen the
  // nowrap cost run — the documented iOS-wider-emoji spill that already bit the
  // tower panel, the next-wave line and the ability tile.
  const geom = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".td-powers .td-node")];
    return rows.map((n) => {
      const c = n.querySelector(".td-node__cost").getBoundingClientRect();
      const r = n.getBoundingClientRect();
      return Math.round(c.right - r.right);
    });
  });
  for (const spill of geom) assert.ok(spill <= 0, `no cost cell may spill past its row (${spill}px)`);
  } finally {
    await page.evaluate(() => { try { window.TDUI.closeOverlay(); } catch (e) { /* nothing open */ } });
  }

  // The in-battle tile's accessible NAME states it too — the ⚙️ badge is
  // aria-hidden and the tile has no room for the number, so a screen reader
  // otherwise never learns it at all.
  // Route FIRST, then start the run — __TD.newGame does not navigate, so calling
  // it on the fort home leaves #screen-td-play hidden for ever.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1); });
  const labels = await page.evaluate(() => [...document.querySelectorAll(".td-abil")]
    .map((b) => ({ id: b.dataset.abil, label: b.getAttribute("aria-label") || "" })));
  assert.ok(labels.length >= 1, "the strip has tiles");
  for (const t of labels) {
    const a = pool.find((x) => x.id === t.id);
    assert.match(t.label, new RegExp("every " + a.cd + " seconds"),
      `${t.id}'s accessible name states its cooldown (saw "${t.label}")`);
  }
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = ""; });
});

test("P6 loadout: the fort's 🎒 Powers picker writes the pack, and the guide marks it", async () => {
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.click("#screen-td-home .td-powers-open");
  await page.locator(".td-powers").waitFor({ state: "visible" });
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).powers);
  // un-pack one, pack the one that was left out
  const swap = await page.evaluate(() => {
    const on = [...document.querySelectorAll(".td-powers [data-equippow]")].filter((b) => b.classList.contains("td-node__equip--on"));
    const off = [...document.querySelectorAll(".td-powers [data-equippow]")].filter((b) => !b.classList.contains("td-node__equip--on"));
    return { drop: on[on.length - 1].dataset.equippow, add: off[0] ? off[0].dataset.equippow : null };
  });
  assert.ok(swap.add, "the pool is larger than the strip, so there is always something to swap in");
  await page.click(`.td-powers [data-equippow="${swap.drop}"]`);
  await page.click(`.td-powers [data-equippow="${swap.add}"]`);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).powers);
  assert.ok(!after.includes(swap.drop), `${swap.drop} was left behind`);
  assert.ok(after.includes(swap.add), `${swap.add} was packed`);
  assert.equal(after.length, before.length, "the pack is always exactly the strip's width");

  // the guide must agree with the strip — a 🎒 there means "this is on the bar"
  await page.locator(".td-powers-done").click();
  await page.click("#screen-td-home .td-guide-open");
  await page.locator(".td-overlay--guide").waitFor({ state: "visible" });
  const marks = await page.evaluate(() => [...document.querySelectorAll(".td-guide__abils li")].map((li) => li.textContent.includes("🎒")));
  const pool = await page.evaluate(() => window.TDData.ABILITIES.map((a) => a.id));
  assert.deepEqual(marks, pool.map((id) => after.includes(id)),
    "the guide's 🎒 marks exactly the packed powers");
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("P3 energy: the ⚙️ budget is on the HUD, spends on use, and rides the checkpoint", async () => {
  // The plan's own warning, and a defect this project shipped once already
  // (🌟 Sticker Shield was absent from writeMidRun): a per-RUN resource that is
  // not checkpointed is re-granted on every resume. And a resource the player
  // cannot SEE is a resource they cannot plan around — the whole point of
  // replacing "gold you have thousands of" with a small visible budget.
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => {
    // NOT grantGold: it marks the run `cheated`, and a cheated run is never
    // checkpointed — which is exactly what this test is here to check.
    window.__TD.newGame(1, { seed: 7 });
    window.__TD.script([["place", "dart", "p1"], ["call"], ["tick", 120]]);
  });
  await page.waitForTimeout(120);
  const shown = await page.evaluate(() => {
    const el = document.querySelector("#screen-td-play .td-hud__charge");
    // Read the COUNT node, not the whole button. The button gained a second
    // line — the gold price, which used to live only in a `title` and was
    // therefore invisible on a touch device — so its textContent is now the
    // count and the price run together ("⚙️ 2" + "450🪙"). The assertion below
    // is unchanged in strength: it still demands the readout equal the engine
    // EXACTLY, it just reads the node that holds it. (Re-pointing a test at a
    // field that changed shape, rather than loosening it.)
    const n = el && el.querySelector(".td-hud__chargeN");
    return { text: n && n.textContent, state: window.__TD.state().charge };
  });
  assert.ok(shown.state > 0, `a wave granted energy (${shown.state})`);
  assert.equal(shown.text, "⚙️ " + shown.state, "…and the HUD shows exactly what the engine holds");

  // spending one decrements BOTH
  const after = await page.evaluate(() => {
    const st = window.__TD.state();
    const live = st.enemies.filter((e) => e.alive)[0];
    const p = window.__TD.engine().posOn(live.pathIdx || 0, live.dist);
    const r = window.__TD.engine().useAbility("drop", { x: p.x, y: p.y });
    window.__TD.script([["tick", 1]]);
    // …the COUNT node again, for the same reason as above: the button now also
    // carries the gold price, so its whole textContent is two values run
    // together. Strength unchanged — still an exact match against the engine.
    const nEl = document.querySelector("#screen-td-play .td-hud__chargeN");
    return { ok: r.ok, state: window.__TD.state().charge, text: nEl && nEl.textContent };
  });
  assert.equal(after.ok, true, "the power fired");
  assert.equal(after.state, shown.state - 1, "…and it cost exactly one charge");
  assert.equal(after.text, "⚙️ " + after.state, "…and the HUD followed");

  // …and the remaining energy survives a quit-and-resume. Quitting mid-WAVE
  // writes no checkpoint by design, so run out to the build boundary first.
  const resumed = await page.evaluate(async () => {
    window.__TD.script([["untilPhase", "build", 400000]]);
    const before = window.__TD.state().charge;
    location.hash = "#td-home";
    await new Promise((r) => setTimeout(r, 60));
    const saved = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    return { before, saved: saved.midRun ? saved.midRun.charge : null, has: !!saved.midRun };
  });
  assert.ok(resumed.has, "a checkpoint was written at the build boundary");
  assert.equal(resumed.saved, resumed.before,
    "the checkpoint carries the run's remaining energy — otherwise every resume re-grants it");
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("P6 loadout: the PACK rides the checkpoint, so a resume plays the run you left", async () => {
  // The checkpoint-fidelity class again (leaked / soldiersLost / lines /
  // leverRoute / shieldUsed / charge / countdown / tallies — this is the ninth).
  // Without it, editing the pack while a run is parked retroactively rewrites
  // the run you are about to restore.
  const pack = await page.evaluate(() => {
    window.__TD.resetSave();
    const pool = window.TDData.ABILITIES.map((a) => a.id);
    const p = pool.filter((id) => id !== "horn").slice(0, window.TDData.RULES.abilitySlots);
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    raw.powers = p;
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
    return p;
  });
  await page.reload();
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const saved = await page.evaluate(async () => {
    window.__TD.newGame(1, { seed: 7 });
    window.__TD.script([["place", "dart", "p1"], ["call"], ["untilPhase", "build", 400000]]);
    location.hash = "#td-home";
    await new Promise((r) => setTimeout(r, 60));
    const s = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    return s.midRun ? s.midRun.powers : null;
  });
  assert.deepEqual(saved, pack, "the checkpoint carries the run's pack");

  // Now change the pack while the run is parked; the RESUME must honour the
  // checkpoint, not the edit.
  const resumed = await page.evaluate(async () => {
    const s = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    s.powers = window.TDData.ABILITIES.map((a) => a.id).slice(0, window.TDData.RULES.abilitySlots);
    localStorage.setItem("jon-td-save-v1", JSON.stringify(s));
    return s.powers;
  });
  await page.reload();
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.locator(".td-resume button").first().click();
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const live = await page.evaluate(() => window.__TD.engine().state.powers);
  assert.deepEqual(live, pack, "the resumed run kept its own pack, not the newer edit");
  assert.notDeepEqual(live, resumed, "…and the edit really was different (so this can fail)");
  await page.evaluate(() => { window.__TD.resetSave(); });
  await page.reload();
  await page.evaluate(() => { location.hash = ""; });   // neutral hash — see above
});

test("P4 loadout: a run brings the EQUIPPED nodes, not everything owned", async () => {
  // The checkpoint-fidelity class, on its seventh instance. writeMidRun used to
  // snapshot `save.meta.slice()`, so an unthreaded loadout would hand a resumed
  // run every node the player has ever bought.
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const slots = await page.evaluate(() => window.TDData.RULES.metaSlots);
  const owned = await page.evaluate((n) => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1")) || { v: 1 };
    raw.stars = { casual: {}, normal: {}, heroic: {} };
    for (const l of window.TDData.LEVELS) raw.stars.normal[l.id] = 3;   // everything earned
    raw.meta = window.TDData.META_NODES.map((x) => x.id);               // everything owned
    // deliberately OVER-full: a hand-edited save, a shrunken RULES.metaSlots or a
    // stale pack must all be clamped by the engine's own rule, not trusted
    raw.loadout = raw.meta.slice();
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
    return { meta: raw.meta.length, loadout: raw.meta.slice(0, n) };
  }, slots);
  assert.ok(owned.meta > slots, "the fixture owns — and packs — more than the rules allow");
  // seed → reload → hop the hash: `goto(url + "#hash")` is a SAME-DOCUMENT
  // navigation and would never re-run module init against the new save.
  await page.reload();
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const live = await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 7 });
    return window.__TD.engine().state.meta;
  });
  assert.deepEqual(live, owned.loadout,
    "the LIVE run is handed exactly the equipped, capped loadout — not everything owned, and not an over-full pack");
  const usedCount = await page.evaluate(() => {
    // the engine keeps meta as pure input; read what startLevel actually handed it
    window.__TD.script([["call"], ["untilPhase", "build", 400000]]);
    location.hash = "#td-home";
    return new Promise((r) => setTimeout(() => {
      const s = JSON.parse(localStorage.getItem("jon-td-save-v1"));
      r(s.midRun ? s.midRun.meta : null);
    }, 80));
  });
  assert.ok(Array.isArray(usedCount), "a checkpoint was written");
  assert.deepEqual(usedCount, owned.loadout,
    "the checkpoint carries the EQUIPPED loadout — handing a resumed run everything owned is the bug this exists to catch");
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("P4 loadout: the star tree can pack and unpack, and never past the cap", async () => {
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const slots = await page.evaluate(() => window.TDData.RULES.metaSlots);
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1")) || { v: 1 };
    raw.stars = { casual: {}, normal: {}, heroic: {} };
    for (const l of window.TDData.LEVELS) raw.stars.normal[l.id] = 3;
    raw.meta = window.TDData.META_NODES.map((x) => x.id);
    raw.loadout = [];
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload();
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.locator("#screen-td-home .td-tree-open").click();
  await page.locator(".td-node__equip").first().waitFor({ state: "visible" });

  // pack more than the cap allows, one tap at a time
  for (let i = 0; i < slots + 3; i++) {
    const free = page.locator(".td-node__equip:not([disabled]):not(.td-node__equip--on)");
    if (!(await free.count())) break;
    await free.first().click();
  }
  const packed = await page.evaluate(() => (JSON.parse(localStorage.getItem("jon-td-save-v1")).loadout || []).length);
  assert.equal(packed, slots, `the pack fills to exactly ${slots} and refuses the rest (got ${packed})`);
  // …and un-packing is always allowed, or the last slot would be a trap
  await page.locator(".td-node__equip--on").first().click();
  const after = await page.evaluate(() => (JSON.parse(localStorage.getItem("jon-td-save-v1")).loadout || []).length);
  assert.equal(after, slots - 1, "a full pack can still be emptied");
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("ART: every world's FLOOR is its own room — no two render the same", async () => {
  // The floor is the biggest pixel area on screen and shipped as ONE hard-coded
  // blue grid on all 24 levels, so the Toy Store and the Garage looked like the
  // same room. It is a data field now (WORLDS[w].floor), and this is the generic
  // forcing function: a seventh world cannot inherit a copy-pasted floor,
  // exactly as the enemy-art hash stops a missing draw branch.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const sigs = await page.evaluate(() => {
    const out = {};
    const worlds = Object.keys(window.TDData.WORLDS);
    // ONE level, re-skinned with each world in turn. Comparing each world's own
    // level would compare their PATHS too, and the hash would differ even if
    // every floor were identical — the first cut of this test did exactly that
    // and survived a mutation that gave two worlds the same floor.
    const base = window.TDData.LEVELS.find((l) => !l.night && !l.paths);
    window.__TD.newGame(base.id, { seed: 3 });
    const eng = window.__TD.engine();
    const realWorld = eng.levelDef.world;
    // …and hold spawnGlyph CONSTANT. It is also per-world and it is painted on
    // the field, so it alone made every world hash differently — the second cut
    // of this test still survived a mutation that gave two worlds one floor.
    const glyphs = {};
    for (const w of worlds) { glyphs[w] = window.TDData.WORLDS[w].spawnGlyph; window.TDData.WORLDS[w].spawnGlyph = "⬛"; }
    for (const w of worlds) {
      eng.levelDef.world = w;
      const r = window.__TD.render();
      r.resize(); r.draw(0);
      const cv = document.querySelector("#screen-td-play .td-canvas");
      const ctx = cv.getContext("2d");
      const d = ctx.getImageData(0, 0, cv.width, Math.min(cv.height, Math.round(cv.height * 0.5))).data;
      let h = 5381;
      for (let i = 0; i < d.length; i += 40) h = ((h * 33) ^ (d[i] + d[i + 1] * 3 + d[i + 2] * 7)) >>> 0;
      // A SECOND hash over the lane corridor only. The lane is 19.4% of the
      // canvas and shipped as four flat strokes with no per-world texture, so
      // three worlds had literally the same road — and the whole-canvas hash
      // above would happily pass that on the carpet-vs-tile difference alone.
      const lane = eng.levelDef.paths ? eng.levelDef.paths[0] : eng.levelDef.path;
      let rh = 5381;
      for (const [lx, ly] of lane) {
        const p = window.__TD.w2s(lx + 0.5, ly + 0.5);
        const dp = cv.width / cv.clientWidth;
        const x0 = Math.max(0, Math.round((p.x - 14) * dp)), y0 = Math.max(0, Math.round((p.y - 14) * dp));
        const wpx = Math.min(Math.round(28 * dp), cv.width - x0), hpx = Math.min(Math.round(28 * dp), cv.height - y0);
        if (wpx <= 0 || hpx <= 0) continue;
        const rd = ctx.getImageData(x0, y0, wpx, hpx).data;
        for (let i = 0; i < rd.length; i += 8) rh = ((rh * 33) ^ (rd[i] + rd[i + 1] * 3 + rd[i + 2] * 7)) >>> 0;
      }
      out[w] = h;
      out["road:" + w] = rh;
    }
    eng.levelDef.world = realWorld;
    for (const w of worlds) window.TDData.WORLDS[w].spawnGlyph = glyphs[w];
    return out;
  });
  const byHash = {};
  for (const w of Object.keys(sigs)) {
    if (w.indexOf("road:") === 0) continue;
    (byHash[sigs[w]] = byHash[sigs[w]] || []).push(w);
  }
  const clash = Object.keys(byHash).filter((h) => byHash[h].length > 1).map((h) => byHash[h].join(" = "));
  assert.deepEqual(clash, [], `worlds whose floors render identically: ${clash.join("; ")}`);
  const byRoad = {};
  for (const w of Object.keys(sigs)) {
    if (w.indexOf("road:") !== 0) continue;
    (byRoad[sigs[w]] = byRoad[sigs[w]] || []).push(w.slice(5));
  }
  const rclash = Object.keys(byRoad).filter((h) => byRoad[h].length > 1).map((h) => byRoad[h].join(" = "));
  assert.deepEqual(rclash, [], `worlds whose LANE renders identically: ${rclash.join("; ")}. The lane is a fifth of the canvas and the surface the eye tracks all run — bedroom, toystore and garage shipped literally the same road.`);
  // …and every world must actually DECLARE both, so the fallback is never load-bearing
  const declared = await page.evaluate(() =>
    Object.entries(window.TDData.WORLDS).filter(([, w]) => !w.floor || !w.floor.pattern).map(([k]) => k));
  assert.deepEqual(declared, [], `worlds with no floor declared: ${declared.join(", ")}`);
  const roads = await page.evaluate(() =>
    Object.entries(window.TDData.WORLDS).filter(([, w]) => !w.floor || !w.floor.road || !w.floor.road.style).map(([k]) => k));
  assert.deepEqual(roads, [], `worlds with no road style declared: ${roads.join(", ")}`);
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("ART: a body REACTS when it is shot — the flash lands on the enemy, not the air", async () => {
  // Shots landed with a poof in the AIR and no reaction from the body they hit,
  // so on a 14-tower board you saw sparks near things rather than things being
  // shot. `hit` now carries the enemy id and the renderer whitens that sprite.
  // Asserts the INK, on the same same-state-drawn-twice pattern the muzzle
  // guardrail uses: everything else on the board is identical, so a difference
  // is the flash and nothing else.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => window.__TD.newGame(1, { seed: 5 }));
  await page.waitForTimeout(160);
  const out = await page.evaluate(() => {
    const eng = window.__TD.engine(), st = window.__TD.state(), r = window.__TD.render();
    st.gold = 999999;
    eng.callWave();
    for (let i = 0; i < 200 && !st.enemies.some((e) => e.alive); i++) eng.tick();
    const foe = st.enemies.find((e) => e.alive);
    if (!foe) return { err: "no live enemy" };
    const p = eng.posOn(foe.pathIdx || 0, foe.dist);
    const canvas = document.querySelector("#screen-td-play .td-canvas");
    const c2 = canvas.getContext("2d");
    const dpr = canvas.width / canvas.clientWidth;
    // +0.5: posOn() is CORNER-based and the enemy pass draws at
    // worldToScreen(pos + 0.5) — the two coordinate spaces this repo has been
    // caught by four times. Sampling the corner put the box half a cell up-left
    // of the sprite and read 22 changed pixels on a flash that works.
    const s = window.__TD.w2s(p.x + 0.5, p.y + 0.5);
    const R = Math.round(20 * dpr);
    const cx = Math.round(s.x * dpr), cy = Math.round(s.y * dpr);
    const grab = () => Array.from(c2.getImageData(cx - R, cy - R, R * 2, R * 2).data);
    r.afterTick(); r.draw(0);
    // ISOLATION. A `hit` also pushes a poof AT the hit point, so pushing both
    // events on the body measures the poof, not the flash — the first cut did
    // exactly that and survived both mutations (delete the whitening, delete the
    // engine's id) because the poof alone moved hundreds of pixels.
    //   The flash is keyed on the ID, not the position, so the fix is to fire
    // the hits six cells away: the poof lands well outside the sample box while
    // the flash still lands on the sprite. Everything else in the box is
    // byte-identical between the two frames.
    const far = { x: p.x + 6, y: p.y + 6 };   // the engine emits corner coords
    r.pushFx({ type: "hit", x: far.x, y: far.y, dmg: 4 });
    r.draw(0);
    const anon = grab();
    r.pushFx({ type: "hit", x: far.x, y: far.y, dmg: 4, id: foe.id });
    r.draw(0);
    const lit = grab();
    const diff = (a, b) => {
      let n = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) n++;
      }
      return n;
    };
    return { flash: diff(anon, lit), type: foe.type };
  });
  assert.ok(!out.err, out.err || "");
  assert.ok(out.flash > 60,
    `a hit changed only ${out.flash} pixels ON the ${out.type} it struck — the body must react, ` +
    "not just the air around it");

  // The flash is TWO cues, and this is the only thing that guards the quieter
  // one. The scale pop alone clears the threshold above, so deleting the tint
  // left that assertion green — but the tint is the ENTIRE cue for a player who
  // asked for less motion, exactly as the shake is disabled and nothing replaces
  // it. So measure with motion reduced: the pop must be gone (a strictly smaller
  // change) and the tint must still mark the body (a change at all).
  // The renderer samples matchMedia ONCE at create, so the level has to be
  // restarted after switching — the same shape the shipped screen-shake
  // guardrail uses. Without it `reduced` stays false and this reads as a bug in
  // the gate rather than in the fixture.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => window.__TD.newGame(1, { seed: 5 }));
  await page.waitForTimeout(160);
  const calm = await page.evaluate(() => {
    const eng = window.__TD.engine(), st = window.__TD.state(), r = window.__TD.render();
    st.gold = 999999;
    eng.callWave();
    for (let i = 0; i < 200 && !st.enemies.some((e) => e.alive); i++) eng.tick();
    const foe = st.enemies.find((e) => e.alive);
    if (!foe) return { err: "no live enemy" };
    const p = eng.posOn(foe.pathIdx || 0, foe.dist);
    const canvas = document.querySelector("#screen-td-play .td-canvas");
    const c2 = canvas.getContext("2d");
    const dpr = canvas.width / canvas.clientWidth;
    const s = window.__TD.w2s(p.x + 0.5, p.y + 0.5);
    const R = Math.round(20 * dpr);
    const cx = Math.round(s.x * dpr), cy = Math.round(s.y * dpr);
    const grab = () => Array.from(c2.getImageData(cx - R, cy - R, R * 2, R * 2).data);
    const far = { x: p.x + 6, y: p.y + 6 };
    r.afterTick(); r.draw(0);
    r.pushFx({ type: "hit", x: far.x, y: far.y, dmg: 4 });
    r.draw(0);
    const anon = grab();
    r.pushFx({ type: "hit", x: far.x, y: far.y, dmg: 4, id: foe.id });
    r.draw(0);
    const lit = grab();
    let n = 0;
    for (let i = 0; i < anon.length; i += 4) {
      if (Math.abs(anon[i] - lit[i]) + Math.abs(anon[i + 1] - lit[i + 1])
        + Math.abs(anon[i + 2] - lit[i + 2]) > 24) n++;
    }
    return { flash: n, reduced: r.shakeInfo().reduced };
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  assert.ok(!calm.err, calm.err || "");
  assert.equal(calm.reduced, true, "the renderer sees prefers-reduced-motion");
  assert.ok(calm.flash > 10,
    `with motion reduced the hit changed only ${calm.flash} pixels — the tint is the whole cue ` +
    "there, so it cannot be the pop doing all the work");
  assert.ok(calm.flash < out.flash,
    `the scale pop must be OFF under reduced motion (${calm.flash} changed vs ${out.flash} with ` +
    "motion allowed — no smaller means the pop still fired)");
});

test("ART: a killed body POPS instead of blinking out of existence", async () => {
  // An enemy is only ever FLAGGED dead (it is never spliced), and the draw loop
  // skips `!alive` — so a hundred bodies a wave vanished mid-stride while the
  // stars and the gold number played over empty floor.
  //
  // The control is the same `die` event WITHOUT its `enemy` field: the pop is
  // the only thing gated on it, so stars and gold are identical in both frames
  // and the difference is exactly the corpse. Diffing against a no-die frame
  // would have credited the pop with the stars the game already had.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => window.__TD.newGame(1, { seed: 5 }));
  await page.waitForTimeout(160);
  const out = await page.evaluate(() => {
    const eng = window.__TD.engine(), r = window.__TD.render();
    const p = eng.posOn(0, 6);
    const canvas = document.querySelector("#screen-td-play .td-canvas");
    const c2 = canvas.getContext("2d");
    const dpr = canvas.width / canvas.clientWidth;
    const s = window.__TD.w2s(p.x + 0.5, p.y + 0.5);   // sprite centre, not cell corner
    const R = Math.round(24 * dpr);
    const cx = Math.round(s.x * dpr), cy = Math.round(s.y * dpr);
    const grab = () => Array.from(c2.getImageData(cx - R, cy - R, R * 2, R * 2).data);
    r.afterTick(); r.draw(0);
    const base = grab();
    r.pushFx({ type: "die", x: p.x, y: p.y, bounty: 3 });   // stars + gold only
    r.draw(0);
    const noBody = grab();
    // ISOLATION: draw() ages every fx by one and prunes the expired, so 40 draws
    // clear the board. Without this the second push would ADD a second set of
    // stars and gold on top of the first, and the "corpse" would be measuring
    // doubled sparkles as well as the body.
    for (let i = 0; i < 40; i++) r.draw(0);
    const aged = grab();
    r.pushFx({ type: "die", x: p.x, y: p.y, bounty: 3, enemy: "sock" });
    r.draw(0);
    const withBody = grab();
    const diff = (a, b) => {
      let n = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) n++;
      }
      return n;
    };
    // both frames now carry stars+gold at the SAME age; only one carries a body
    return { corpse: diff(noBody, withBody), residue: diff(base, aged) };
  });
  assert.ok(out.residue < 20,
    `ageing the fx out left ${out.residue} changed pixels — the two frames are not comparable, ` +
    "so the corpse measurement below would be confounded by leftover sparkles");
  assert.ok(out.corpse > 150,
    `the death drew only ${out.corpse} pixels of body — a killed enemy must leave a corpse to ` +
    "squash away, not blink out while its stars play over bare floor");
});

test("ART: a corpse EXPIRES — every fx must age, including the ones that draw and continue", async () => {
  // Reported from real play: "some of the bad guys after being killed are stuck
  // on the map — 0 health sprites just persisting there wave after wave."
  //
  // Exactly right, and it was a one-word regression. The ageing step `f.ttl -= 1`
  // sat at the BOTTOM of the screen-fx draw loop, and the corpse branch draws in
  // the character pass and then `continue`s — so a `pop` was never aged, never
  // faded and was never spliced. It renders from a synthetic carrying `hp: 0`,
  // which is literally the 0-health sprite that was reported, and MAX_POPS of
  // them accumulated on the field permanently. Once that cap filled, the corpse
  // cue silently stopped working altogether.
  //
  // The test above could not catch it, and that is the lesson: its first push
  // deliberately omits `enemy` (stars + gold only, no pop) so that its ageing
  // window is clean, and it reads the corpse on the very next frame. It proves a
  // corpse is DRAWN. Nothing proved it goes AWAY.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const out = await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 3 });
    const r = window.__TD.render(); r.resize(); r.afterTick();
    const eng = window.__TD.engine();
    const p = eng.posAt(6);
    const c = document.querySelector("#screen-td-play .td-canvas");
    const c2 = c.getContext("2d");
    const dpr = c.width / c.clientWidth;
    const s = window.__TD.w2s(p.x + 0.5, p.y + 0.5);
    const R = Math.round(r.markerInfo().cell * dpr * 1.6);
    const cx = Math.round(s.x * dpr), cy = Math.round(s.y * dpr);
    const grab = () => Array.from(c2.getImageData(cx - R, cy - R, R * 2, R * 2).data);
    const diff = (a, b) => {
      let n = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) n++;
      }
      return n;
    };
    r.draw(0);
    const before = grab();
    r.pushFx({ type: "die", x: p.x, y: p.y, bounty: 3, enemy: "sock" });
    r.draw(0);
    const withBody = grab();
    // Well past every ttl a `die` pushes (pop 9, stars 16, gold 26).
    for (let i = 0; i < 60; i++) r.draw(0);
    const after = grab();
    return { drawn: diff(before, withBody), left: diff(before, after) };
  });
  assert.ok(out.drawn > 150, `the corpse must actually draw (got ${out.drawn} px)`);
  assert.ok(out.left < 20,
    `${out.left} pixels of the dead body are STILL on the field 60 frames after it died — a corpse must ` +
    "age out and be spliced, not stand there for the rest of the run");
});

test("ART: a prop casts a FLAT ground shadow, offset toward SHADOW, in both orientations", async () => {
  // Reported from real play as "some of the shadows are just circles after
  // circles", and the source read innocent — so this measures INK. Suppressing
  // the props and diffing isolates exactly their contribution; the shading is
  // then the darker-but-not-more-colourful part of that difference.
  //
  // Pre-fix this measured 44x45px at aspect 0.98 CENTRED on the prop: a dark
  // disc the prop sat on, because a leftover call-site ellipse was drawn in
  // BAKE space (so the 90° portrait rotation stood it on end) on top of
  // drawProp's own cast and contact.
  for (const vp of [{ w: 390, h: 844, n: "portrait" }, { w: 844, h: 390, n: "landscape" }]) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.evaluate(() => { location.hash = "#td-play"; });
    await page.locator("#screen-td-play").waitFor({ state: "visible" });
    const m = await page.evaluate(() => {
      const shot = (noProps) => {
        const orig = window.TDLogic.propCells;
        if (noProps) window.TDLogic.propCells = () => [];
        window.__TD.newGame(1, { seed: 3 });
        const r = window.__TD.render(); r.resize(); r.afterTick(); r.draw(0);
        const c = document.querySelector("#screen-td-play .td-canvas");
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height);
        window.TDLogic.propCells = orig;
        return { d, w: c.width, h: c.height, dpr: c.width / c.clientWidth };
      };
      const off = shot(true), on = shot(false);
      const cells = window.TDLogic.propCells(window.TDData.LEVELS[0], { w: 24, h: 14 });
      const o0 = window.__TD.w2s(0, 0), o1 = window.__TD.w2s(1, 0);
      const cellPx = Math.hypot(o1.x - o0.x, o1.y - o0.y) * on.dpr;
      const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      const sat = (d, i) => Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
      const out = [];
      for (const p of cells) {
        const s = window.__TD.w2s(p.x + 0.5, p.y + 0.5);
        const cx = Math.round(s.x * on.dpr), cy = Math.round(s.y * on.dpr);
        const R = Math.round(cellPx * 1.4);
        if (cx - R < 0 || cy - R < 0 || cx + R > on.w || cy + R > on.h) continue;
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0;
        for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
          const i = (y * on.w + x) * 4;
          if (lum(off.d.data, i) - lum(on.d.data, i) > 6 && sat(on.d.data, i) - sat(off.d.data, i) < 10) {
            n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
          }
        }
        if (n < 20) continue;
        out.push({ aspect: (x1 - x0 + 1) / (y1 - y0 + 1), dx: (x0 + x1) / 2 - cx, dy: (y0 + y1) / 2 - cy,
          wCells: (x1 - x0 + 1) / cellPx });
      }
      return out;
    });
    assert.ok(m.length >= 3, `${vp.n}: found ${m.length} props to measure`);
    const avg = (f) => m.reduce((s, r) => s + f(r), 0) / m.length;
    // A ground shadow lies FLAT on the floor — in screen space, always wider
    // than tall, whichever way the world-oriented plate happens to be rotated.
    assert.ok(avg((r) => r.aspect) > 1.35,
      `${vp.n}: prop shading averages aspect ${avg((r) => r.aspect).toFixed(2)} — a ground shadow must ` +
      "be flat (wider than tall) on screen, not a disc");
    // …and it falls AWAY from the light, which is upper-left.
    assert.ok(avg((r) => r.dx) > 0 && avg((r) => r.dy) > 0,
      `${vp.n}: shading sits at (${avg((r) => r.dx).toFixed(1)}, ${avg((r) => r.dy).toFixed(1)})px from the ` +
      "prop — it must fall down-and-right, away from the light");
    // …and it belongs to the prop rather than dwarfing it.
    assert.ok(avg((r) => r.wCells) < 1.3,
      `${vp.n}: shading is ${avg((r) => r.wCells).toFixed(2)} cells wide — a shadow bigger than the thing ` +
      "casting it stops reading as a shadow");
  }
  await page.setViewportSize({ width: 390, height: 844 });
});

test("ART: the spawn and exit markers sit ON the road, not on its end cap", async () => {
  // "The entrance bed isn't on the path." A lane's first and last waypoints are
  // at the board EDGE, so both markers were centred half a cell in and straddled
  // the lane's rounded end cap, with the cap poking out past them. They are
  // stepped along the first/last segment now.
  //
  // Read from render.markerInfo() — the renderer's OWN numbers. Recomputing the
  // position from the level data here would be tautological: the first version
  // of this measurement derived the point from lane[0] and then measured its
  // distance to the lane, which is 0.00 by construction on every level.
  for (const vp of [{ w: 390, h: 844, n: "portrait" }, { w: 844, h: 390, n: "landscape" }]) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    for (const id of [1, 9, 21, 33]) {
      await page.evaluate(() => { location.hash = "#td-play"; });
      await page.locator("#screen-td-play").waitFor({ state: "visible" });
      const m = await page.evaluate((lid) => {
        window.__TD.newGame(lid, { seed: 3 });
        const r = window.__TD.render(); r.resize(); r.afterTick(); r.draw(0);
        const mk = r.markerInfo();
        const lv = window.TDData.LEVELS.find((l) => l.id === lid);
        const lane = (lv.paths || [lv.path])[0];
        const near = (pt) => {   // distance from the marker to the lane centre-line
          let best = 1e9;
          for (let i = 0; i + 1 < lane.length; i++) {
            const a = lane[i], b = lane[i + 1];
            const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
            let t = ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L2;
            t = Math.max(0, Math.min(1, t));
            best = Math.min(best, Math.hypot(pt[0] - (a[0] + t * dx), pt[1] - (a[1] + t * dy)));
          }
          return best;
        };
        // How far the marker is stepped in ALONG the lane from its endpoint.
        // NOT "distance from the board edge": L21's lane runs out along the
        // bottom row, so a marker correctly inset along it stays at y=13 and
        // that metric reads 0.00 forever.
        const D = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
        return { spawnIn: D(mk.spawn, lane[0]), exitIn: D(mk.exit, lane[lane.length - 1]),
          spawnOff: near(mk.spawn), exitOff: near(mk.exit),
          spawnW: mk.spawnW / mk.cell, exitW: mk.exitW / mk.cell };
      }, id);
      // still ON the lane…
      assert.ok(m.spawnOff < 0.05 && m.exitOff < 0.05,
        `${vp.n} L${id}: markers drifted off the lane (spawn ${m.spawnOff.toFixed(2)}, exit ${m.exitOff.toFixed(2)} cells)`);
      // …and stepped IN from the endpoint, so each sits on the road rather than
      // straddling the lane's rounded end cap. Un-inset markers measure 0.00.
      assert.ok(m.spawnIn > 0.7,
        `${vp.n} L${id}: the spawn marker is only ${m.spawnIn.toFixed(2)} cells along the lane from its ` +
        "start — it must stand on the road, not on the lane's end cap");
      assert.ok(m.exitIn > 0.7,
        `${vp.n} L${id}: the exit marker is only ${m.exitIn.toFixed(2)} cells along the lane from its end`);
      // …and NARROW ENOUGH TO BE ON IT. The painted road measures exactly 1.00
      // cells and the bed measured 1.11, so it overhung both kerbs and read as
      // lying across the lane rather than standing in it — which is what "the
      // entrance bed isn't in the lane" actually was. The size is fitted by
      // MEASURING the glyph at draw time, so iOS rendering emoji wider than
      // desktop cannot re-open it.
      assert.ok(m.spawnW < 0.92 && m.exitW < 0.92,
        `${vp.n} L${id}: markers draw ${m.spawnW.toFixed(2)}/${m.exitW.toFixed(2)} cells wide against a ` +
        "1.00-cell road — a marker wider than the road hangs over both kerbs");
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
});

test("ART: every ground band is one continuous sheet, not a string of beads", async () => {
  // GENERALIZED from the L2-cover-only version below, because fixing the cover
  // band did NOT fix the mud patch — they are drawn by different code, and the
  // mud kept stamping an ellipse every 0.6 cells. That shipped as a row of beads
  // with visible gaps on L1, THE FIRST LEVEL ANYBODY PLAYS, which is where the
  // original "some of the shadows are just circles after circles" was still true
  // after two rounds of fixing it elsewhere. So the law is now stated once over
  // every band the data declares, and a new band inherits it.
  //
  // A ground band (mud / cover) is a continuous condition and must paint as one
  // body. A CONVEYOR is excluded on purpose and by a derived predicate, not a
  // level list: its chevrons are a deliberate directional motif, the way lane
  // markings are, so periodicity is the point.
  //
  // The metric took three tries and each wrong one is recorded, because each
  // looked like a defect in the drawing:
  //   1. raw luma along the centre-line — sd 9.4 on a band that is genuinely
  //      continuous, because the road is drawn with rungs across it;
  //   2. the DIFFERENCE against a zone-less render — still varies, because alpha
  //      compositing removes luma in proportion to what is underneath;
  //   3. that difference as a RATIO — right for a dark overlay on a light road,
  //      but it goes NEGATIVE on the sort line, whose belt is darker than the mud
  //      so the mud LIGHTENS it. Reported -1.28 on a perfect band.
  // The quantity that is actually invariant is the overlay's own ALPHA, which is
  // recoverable because the overlay colour is known: got = base(1-a) + C·a, so
  // a = (base-got)/(base-C). It is sign-safe, and it comes back as the literal
  // 0.55 / 0.40 the renderer declares — which is what makes it a measurement
  // rather than a threshold someone tuned until it passed.
  //
  // And the assertion is against that DECLARED alpha, not against the band's own
  // spread, because measuring the stamped version showed the defect is not what
  // it looks like: the stamps were 0.84 cells long at 0.6 spacing, so they never
  // actually GAPPED on the centre-line — they double-covered, and 1-(1-0.55)^2 =
  // 0.80 against a single 0.55. What reads as a row of discs is periodic
  // OVER-darkening. A spread test scored that 0.602 against a 0.6 floor, i.e. it
  // passed by 0.002 — luck, not a guardrail. Overlap is the signature of
  // stamping and it can only ever push alpha ABOVE the declared value, which a
  // single fill cannot do, so the honest bound is two-sided around the number
  // the renderer states.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const BANDS = await page.evaluate(() => {
    const lumc = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // the two ground-band overlay colours, restated from the renderer
    const C = { mud: lumc(96, 74, 44), cover: lumc(28, 34, 66) };
    const ALPHA = { mud: 0.55, cover: 0.40 };   // restated from the renderer
    const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const shot = (id) => {
      window.__TD.newGame(id, { seed: 3 });
      const r = window.__TD.render(); r.resize(); r.afterTick(); r.draw(0);
      const c = document.querySelector("#screen-td-play .td-canvas");
      return { d: c.getContext("2d").getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height,
        dpr: c.width / c.clientWidth, cell: r.markerInfo().cell };
    };
    const out = [];
    for (const lv of window.TDData.LEVELS) {
      const zones = lv.zones || [];
      if (!zones.length) continue;
      // A LEVER level paints a route indicator ALONG the lane — a continuous
      // glow plus 90%-opaque running dashes — so the lane's own pixels are not
      // the band's pixels there and no offset clears both. Excluded by what the
      // level IS, not by id, and covered instead by the structural test below.
      if ((lv.paths || [lv.path]).length > 1) continue;
      for (const z of zones) {
        const kind = (z.dmg != null && z.dmg < 1) ? "cover" : (z.mult < 1 ? "mud" : null);
        if (!kind) continue;
        const withZ = shot(lv.id);
        lv.zones = [];                    // ZONES is read at renderer creation
        const noZ = shot(lv.id);
        lv.zones = zones;
        const eng = window.__TD.engine();
        const a = [];
        for (let k = 0; k <= 60; k++) {
          const dist = z.from + 0.9 + (k / 60) * ((z.to - z.from) - 1.8);
          const q0 = eng.posAt(dist);
          const s0 = window.__TD.w2s(q0.x + 0.5, q0.y + 0.5);
          // ON the centre-line, one sample. An earlier draft took the median of
          // five samples ACROSS the band, to see past a lever level's centre
          // dashes — and that smoothing made the test PASS on the very defect it
          // exists to catch (restoring the 0.6-cell stamps left it green, because
          // averaging across the width hides a seam that runs along it). Lever
          // levels are excluded above for exactly that reason, so the smoothing
          // bought nothing and cost the test its ability to fail.
          const x = Math.round(s0.x * withZ.dpr), y = Math.round(s0.y * withZ.dpr);
          if (x < 0 || y < 0 || x >= withZ.w || y >= withZ.h) continue;
          const i = (y * withZ.w + x) * 4;
          const base = lum(noZ.d, i);
          if (Math.abs(base - C[kind]) < 12) continue;   // unmeasurable there
          a.push((base - lum(withZ.d, i)) / (base - C[kind]));
        }
        if (a.length) out.push({ id: lv.id, kind, want: ALPHA[kind], n: a.length,
          lo: Math.min(...a), hi: Math.max(...a) });
      }
    }
    return out;
  });
  // The population is part of the test: a derived scan that silently covers
  // nothing is the failure mode this repo keeps re-learning.
  assert.ok(BANDS.length >= 8, `only ${BANDS.length} ground bands measured — the scan must cover the shipped bands`);
  assert.ok(BANDS.some((b) => b.kind === "mud") && BANDS.some((b) => b.kind === "cover"),
    "both ground-band kinds must be measured");
  for (const b of BANDS) {
    assert.ok(b.n >= 40, `L${b.id} ${b.kind}: sampled ${b.n} points`);
    assert.ok(b.hi <= b.want * 1.2,
      `L${b.id} ${b.kind}: alpha peaks at ${b.hi.toFixed(3)} against a declared ${b.want} — a single fill ` +
      "cannot exceed its own alpha, so this band is being STAMPED and the overlaps are double-darkening it");
    assert.ok(b.lo >= b.want * 0.8,
      `L${b.id} ${b.kind}: alpha drops to ${b.lo.toFixed(3)} against a declared ${b.want} — the band must lay ` +
      "the same shade for its whole length, with no thin or missing stretch");
  }
});

test("ART: a ground band is drawn as ONE shape, never as repeated stamps", async () => {
  // The pixel law above cannot see a lever level, whose lane carries a route
  // indicator. This states the same law structurally, so it covers EVERY level
  // including those — and it cannot be confounded by anything painted on top.
  //
  // Counting is by DIFFERENCE against the same level with its zones removed, so
  // the shadows and props that legitimately use ellipses cancel out and what is
  // left is the zone pass alone.
  const m = await page.evaluate(() => {
    const proto = CanvasRenderingContext2D.prototype;
    const real = proto.ellipse;
    let n = 0;
    proto.ellipse = function (...args) { n += 1; return real.apply(this, args); };
    const count = (id) => {
      window.__TD.newGame(id, { seed: 3 });
      const r = window.__TD.render(); r.resize(); r.afterTick();
      n = 0; r.draw(0); return n;
    };
    const rows = [];
    try {
      for (const lv of window.TDData.LEVELS) {
        const zones = lv.zones || [];
        const band = zones.find((z) => (z.dmg != null && z.dmg < 1) || z.mult < 1);
        if (!band) continue;
        const withZ = count(lv.id);
        lv.zones = [];
        const noZ = count(lv.id);
        lv.zones = zones;
        rows.push({ id: lv.id, extra: withZ - noZ });
      }
    } finally { proto.ellipse = real; }
    return rows;
  });
  assert.ok(m.length >= 8, `only ${m.length} banded levels scanned`);
  for (const r of m) {
    assert.ok(r.extra === 0,
      `L${r.id}: its ground band adds ${r.extra} ellipse stamps to the frame — a band must be filled as one ` +
      "shape along the lane, not stamped every few tenths of a cell (that is what read as circles-after-circles)");
  }
});

test("ART: a cover band is one continuous sheet, not a string of beads", async () => {
  // Reported from real play on L2 as "weird shadows": the ⛱️ Blanket Cover
  // stamped an ellipse every 0.6 cells while each was a full cell wide, so a
  // 15-cell band rendered as ~26 overlapping discs down the lane with ~40 hem
  // circles beside them — the literal circles-after-circles the prop fix had
  // just removed elsewhere, in the one place L1 could never show it (L1 has no
  // zones, so the level I vetted could not see this).
  //
  // A sheet is UNIFORM along its length; beads are periodic. Measuring the raw
  // canvas does NOT show that: the bedroom road is drawn with tie rungs across
  // it, which vary the luma along the centre-line by themselves and gave sd 9.4
  // on a band that is genuinely continuous. So the band is ISOLATED first, by
  // diffing against the same level rendered with its zones removed — the same
  // suppress-and-diff that identified the prop shadows.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const m = await page.evaluate(() => {
    const lv = window.TDData.LEVELS.find((l) => l.id === 2);
    const zones = lv.zones || [];
    const z = zones.find((q) => q.dmg != null && q.dmg < 1);
    if (!z) return { err: "L2 no longer carries a cover band" };
    const shot = () => {
      const r = window.__TD.render(); r.resize(); r.afterTick(); r.draw(0);
      const c = document.querySelector("#screen-td-play .td-canvas");
      return { d: c.getContext("2d").getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height,
        dpr: c.width / c.clientWidth };
    };
    window.__TD.newGame(2, { seed: 3 });
    const withZ = shot();
    lv.zones = [];                       // ZONES is read at renderer creation
    window.__TD.newGame(2, { seed: 3 });
    const noZ = shot();
    lv.zones = zones;
    const eng = window.__TD.engine();
    const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const vals = [];
    for (let k = 0; k <= 60; k++) {
      const dist = z.from + 0.9 + (k / 60) * ((z.to - z.from) - 1.8);
      const p = eng.posAt(dist);
      const s = window.__TD.w2s(p.x + 0.5, p.y + 0.5);
      const x = Math.round(s.x * withZ.dpr), y = Math.round(s.y * withZ.dpr);
      if (x < 0 || y < 0 || x >= withZ.w || y >= withZ.h) continue;
      const i = (y * withZ.w + x) * 4;
      // the RATIO, not the difference. Alpha compositing removes luma in
      // proportion to what is underneath, and the bedroom road is drawn with tie
      // rungs across it — so a perfectly uniform sheet still shows a varying
      // DIFFERENCE (measured sd 6.3, range 19) purely from the road's texture.
      // diff/base is the alpha itself, which a sheet holds constant.
      const base = lum(noZ.d, i);
      if (base > 8) vals.push((base - lum(withZ.d, i)) / base);
    }
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return { n: vals.length, mean, lo, hi };
  });
  assert.ok(!m.err, m.err || "");
  assert.ok(m.n >= 40, `sampled ${m.n} points along the band`);
  assert.ok(m.mean > 0.05, `the cover dims the lane by only ${(m.mean * 100).toFixed(1)}% — it must be visible`);
  // A beaded band has GAPS: between two discs the alpha drops toward zero, so
  // the thinnest point is a fraction of the thickest. A sheet lays the same
  // shade the whole way.
  assert.ok(m.lo > m.hi * 0.6,
    `the cover's thinnest point is ${(m.lo * 100).toFixed(1)}% against a thickest of ` +
    `${(m.hi * 100).toFixed(1)}% — it must be one continuous sheet, not a row of overlapping discs`);
});

test("ART: the spawn marker's INK lands on the lane, not just its anchor", async () => {
  // Three attempts at "the bed is on the lane" passed while a photo of the real
  // iPad showed it hanging over the kerb, because each measured the wrong thing:
  //   1. the anchor's distance to the lane — derived from lane[0], so 0.00 by
  //      construction on all 36 levels;
  //   2. the glyph's ADVANCE width — which is not the picture;
  //   3. a correction from measureText's actualBoundingBox* — right in Chromium,
  //      still wrong on WebKit.
  // This measures the INK: the same level rendered with the marker blanked, and
  // the pixels that differ ARE the marker. That is what the eye sees, and it
  // cannot be fooled by a font metric.
  for (const vp of [{ w: 402, h: 874, n: "portrait" }, { w: 874, h: 402, n: "landscape" }]) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.evaluate(() => { location.hash = "#td-play"; });
    await page.locator("#screen-td-play").waitFor({ state: "visible" });
    const rows = await page.evaluate(() => {
      const out = [];
      for (const id of [1, 9, 21, 33]) {
        const lv = window.TDData.LEVELS.find((l) => l.id === id);
        const W = window.TDData.WORLDS[lv.world];
        const real = W.spawnGlyph;
        const shot = () => {
          window.__TD.newGame(id, { seed: 3 });
          const r = window.__TD.render(); r.resize(); r.afterTick(); r.draw(0);
          const c = document.querySelector("#screen-td-play .td-canvas");
          return { d: c.getContext("2d").getImageData(0, 0, c.width, c.height).data,
            w: c.width, h: c.height, dpr: c.width / c.clientWidth, mk: r.markerInfo() };
        };
        const on = shot();
        W.spawnGlyph = " ";                 // blank ONLY the marker
        const off = shot();
        W.spawnGlyph = real;
        let sx = 0, sy = 0, n = 0, x0 = 1e9, x1 = -1e9;
        for (let y = 0; y < on.h; y++) {
          for (let x = 0; x < on.w; x++) {
            const i = (y * on.w + x) * 4;
            const dd = Math.abs(on.d[i] - off.d[i]) + Math.abs(on.d[i + 1] - off.d[i + 1])
              + Math.abs(on.d[i + 2] - off.d[i + 2]);
            if (dd > 24) { sx += x; sy += y; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; }
          }
        }
        const a = window.__TD.w2s(on.mk.spawn[0] + 0.5, on.mk.spawn[1] + 0.5);
        const cellPx = on.mk.cell * on.dpr;
        out.push({ id, n, cellPx,
          offX: n ? ((sx / n) - a.x * on.dpr) / cellPx : 99,
          offY: n ? ((sy / n) - a.y * on.dpr) / cellPx : 99,
          wCells: n ? (x1 - x0 + 1) / cellPx : 99 });
      }
      return out;
    });
    for (const r of rows) {
      // As a FRACTION of the cell, not a pixel count: the suite runs at dpr 1
      // and the standalone probe at dpr 2, so a fixed count is four times
      // stricter in one of them.
      assert.ok(r.n > r.cellPx * r.cellPx * 0.12,
        `${vp.n} L${r.id}: only ${r.n} px of marker ink on a ${r.cellPx.toFixed(0)}px cell — it must actually draw`);
      const off = Math.hypot(r.offX, r.offY);
      assert.ok(off < 0.16,
        `${vp.n} L${r.id}: the marker's INK centre sits ${off.toFixed(2)} cells off the lane centre-line ` +
        `(${r.offX.toFixed(2)}, ${r.offY.toFixed(2)}) — the picture must sit on the road, not merely its anchor`);
      assert.ok(r.wCells < 0.95,
        `${vp.n} L${r.id}: the marker's ink is ${r.wCells.toFixed(2)} cells wide against a 1.00-cell road`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
});

test("ART: the marker is centred by its INK, proven with a deliberately off-centre glyph", async () => {
  // The check above cannot prove the CENTRING in this sandbox, and that is worth
  // stating: Chromium's bed emoji is already nearly centred in its box, so
  // deleting the correction moves it by ~0.04 cells and the assertion still
  // passes. That is exactly why the earlier metric-based fix measured right here
  // and a photo of the real iPad still showed the bed over the kerb — Apple's
  // emoji sits differently in its box.
  //
  // So prove the MECHANISM instead, with a glyph whose ink is off-centre in
  // EVERY font: a descender letter sits low in its box. If inkBox() re-centres
  // that, it will re-centre a bed on any engine.
  await page.setViewportSize({ width: 402, height: 874 });
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const m = await page.evaluate(() => {
    const lv = window.TDData.LEVELS[0];
    const W = window.TDData.WORLDS[lv.world];
    const real = W.spawnGlyph;
    const shot = () => {
      window.__TD.newGame(1, { seed: 3 });
      const r = window.__TD.render(); r.resize(); r.afterTick(); r.draw(0);
      const c = document.querySelector("#screen-td-play .td-canvas");
      return { d: c.getContext("2d").getImageData(0, 0, c.width, c.height).data,
        w: c.width, h: c.height, dpr: c.width / c.clientWidth, mk: r.markerInfo() };
    };
    W.spawnGlyph = "g";
    const on = shot();
    W.spawnGlyph = " ";
    const off = shot();
    W.spawnGlyph = real;
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < on.h; y++) {
      for (let x = 0; x < on.w; x++) {
        const i = (y * on.w + x) * 4;
        const dd = Math.abs(on.d[i] - off.d[i]) + Math.abs(on.d[i + 1] - off.d[i + 1])
          + Math.abs(on.d[i + 2] - off.d[i + 2]);
        if (dd > 24) { sx += x; sy += y; n++; }
      }
    }
    const a = window.__TD.w2s(on.mk.spawn[0] + 0.5, on.mk.spawn[1] + 0.5);
    const cellPx = on.mk.cell * on.dpr;
    return { n, offX: n ? ((sx / n) - a.x * on.dpr) / cellPx : 99,
      offY: n ? ((sy / n) - a.y * on.dpr) / cellPx : 99 };
  });
  assert.ok(m.n > 40, `the test glyph must draw (got ${m.n} px)`);
  const off = Math.hypot(m.offX, m.offY);
  assert.ok(off < 0.05,
    `the test glyph's ink landed ${off.toFixed(2)} cells off the anchor (${m.offX.toFixed(2)}, ${m.offY.toFixed(2)}) ` +
    "— glyphs must be placed by their INK, or an emoji whose ink sits off-centre in its box hangs off the lane");
  await page.setViewportSize({ width: 390, height: 844 });
});
test("UX: every meta dialog has a ✕ that is reachable WITHOUT scrolling, and closes it", async () => {
  // Reported from real play: "for menus like star tree and guide, don't make me
  // scroll all the way to bottom to close. Also give an x in top."
  //
  // The star tree is 30 nodes — far taller than its 86dvh box — so the only exit
  // was a "Done" at the very end of it. The ✕ is injected by metaOverlay, so the
  // openers are DERIVED here rather than listed: a new dialog inherits both the
  // button and this check. (The same "a scan's own list is part of the scan"
  // lesson that left the 🎒 Powers picker invisible to the overlay audit.)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const openers = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#screen-td-home .td-metabtn, #screen-td-home .td-adminrow button"))
      .map((b) => b.className.split(" ").find((c) => c.endsWith("-open"))).filter(Boolean));
  assert.ok(openers.length >= 5, `expected the fort's meta buttons, saw ${openers.join(",")}`);
  for (const cls of openers) {
    await page.evaluate((c) => document.querySelector("." + c).click(), cls);
    await page.waitForTimeout(90);
    const m = await page.evaluate(() => {
      const box = document.querySelector(".td-overlay__box");
      if (!box) return null;
      const x = box.querySelector(".td-overlay__x");
      if (!x) return { noX: true };
      const bb = box.getBoundingClientRect(), xb = x.getBoundingClientRect();
      return {
        // "without scrolling" = the ✕ is inside the box's VISIBLE band while the
        // box sits at its initial scrollTop of 0.
        scrollTop: box.scrollTop,
        aboveFold: xb.top >= bb.top - 1 && xb.bottom <= bb.bottom + 1,
        onScreen: xb.top >= 0 && xb.bottom <= window.innerHeight,
        w: Math.round(xb.width), h: Math.round(xb.height),
        scrollable: box.scrollHeight - box.clientHeight,
      };
    });
    assert.ok(m, `${cls} opened no dialog`);
    assert.ok(!m.noX, `${cls}'s dialog has no ✕ — metaOverlay must give every dialog one`);
    assert.equal(m.scrollTop, 0, `${cls} opens already scrolled`);
    assert.ok(m.aboveFold, `${cls}'s ✕ is not in the box's visible band at scrollTop 0`);
    assert.ok(m.onScreen, `${cls}'s ✕ is off-screen`);
    assert.ok(m.w >= 44 && m.h >= 44, `${cls}'s ✕ is ${m.w}×${m.h} — below the fort's 44px adult floor`);
    // …and it actually closes.
    await page.evaluate(() => document.querySelector(".td-overlay__x").click());
    await page.waitForTimeout(60);
    assert.equal(await page.locator(".td-overlay").count(), 0, `${cls}'s ✕ did not close the dialog`);
  }
  // The tree is the one that MOTIVATED this: prove it really is taller than its
  // box, or the test above passes for a dialog that never needed scrolling.
  await page.evaluate(() => document.querySelector(".td-tree-open").click());
  await page.waitForTimeout(90);
  const over = await page.evaluate(() => {
    const box = document.querySelector(".td-overlay__box");
    return box.scrollHeight - box.clientHeight;
  });
  assert.ok(over > 80, `the star tree should overflow its box (only ${over}px) — otherwise this test proves nothing`);
  await page.evaluate(() => document.querySelector(".td-overlay__x").click());
  await page.setViewportSize({ width: 390, height: 844 });
});

test("UX: a power tile's cost fits INSIDE its box, with headroom for iOS-wide emoji", async () => {
  // From a photo of the real strip: the cost shipped as ONE string,
  // "130🪙 ·1⚙️", which measured ~48px inside a 40px content box — so it wrapped
  // mid-string and the second line spilled over the rounded border. iOS renders
  // emoji WIDER than headless Chromium, so the margin has to be real, not
  // marginal (the trap that already spilled the tower panel and the next-wave
  // line). Gold stays on the line; the ⚙️ charge is a corner badge.
  for (const vp of [{ w: 320, h: 568 }, { w: 360, h: 640 }, { w: 390, h: 844 }, { w: 414, h: 896 }]) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.evaluate(() => { location.hash = "#td-play"; });
    await page.locator("#screen-td-play").waitFor({ state: "visible" });
    await page.evaluate(() => { window.__TD.newGame(1, { seed: 3 }); window.__TD.script([["call"], ["tick", 40]]); });
    await page.waitForTimeout(120);
    const rows = await page.evaluate(() => {
      // measure the TEXT's ink, not the block span's width — a block span is as
      // wide as its parent whatever it contains, so span width proves nothing.
      const ink = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().width; };
      return Array.from(document.querySelectorAll(".td-abil")).map((el) => {
        const tb = el.getBoundingClientRect();
        const cost = el.querySelector(".td-abil__cost"), gear = el.querySelector(".td-abil__gear");
        const gb = gear.getBoundingClientRect();
        return {
          id: el.dataset.abil, inner: el.clientWidth,
          costInk: +ink(cost).toFixed(1),
          costLines: cost.scrollWidth - cost.clientWidth,
          gearInside: gb.left >= tb.left - 0.5 && gb.right <= tb.right + 0.5 && gb.top >= tb.top - 0.5,
          gearInk: +ink(gear).toFixed(1),
        };
      });
    });
    assert.equal(rows.length, 4, `${vp.w}px: the strip must show its four powers`);
    for (const r of rows) {
      assert.ok(r.costInk <= r.inner - 6,
        `${vp.w}px ${r.id}: cost ink ${r.costInk}px in a ${r.inner}px box — needs ≥6px spare for iOS's wider emoji`);
      assert.ok(r.costLines <= 0, `${vp.w}px ${r.id}: the cost overflows its line (${r.costLines}px)`);
      assert.ok(r.gearInside, `${vp.w}px ${r.id}: the ⚙️ badge is not inside the tile`);
      assert.ok(r.gearInk > 4, `${vp.w}px ${r.id}: the ⚙️ badge must actually draw`);
    }
    // The old single-string layout is what this exists to prevent, so prove the
    // split is still load-bearing — but for the WIDEST cost, not every tile: a
    // two-digit power (90🪙) genuinely would still fit combined at 320px, and
    // asserting it wouldn't is claiming more than the measurement supports.
    const worst = rows.reduce((a, r) => (r.costInk + r.gearInk > a.costInk + a.gearInk ? r : a));
    assert.ok(worst.costInk + worst.gearInk > worst.inner,
      `${vp.w}px: the widest tile (${worst.id}) would be ${(worst.costInk + worst.gearInk).toFixed(1)}px with gold and ` +
      `energy on one line — if that now fits ${worst.inner}px, the corner badge is no longer doing anything and this ` +
      "test has stopped measuring the thing it was written for");
  }
  await page.setViewportSize({ width: 390, height: 844 });
});

test("UX: the tower panel STAYS OPEN and re-renders, so one opening can upgrade repeatedly", async () => {
  // Reported from real play: "Upgrade menu can stay up until dismissed so user
  // can upgrade a single tower easily multiple times in one opening."
  // It used to hideBubble() on every purchase, so taking a tower 1→2→3 meant
  // re-tapping it twice. Buying now re-renders the panel from the tower's
  // CURRENT state — the tier, price, stat line and sell refund all move — and
  // only SELLING closes it, because then the subject no longer exists.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const out = await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 3 });
    const eng = window.__TD.engine();
    const pad = eng.levelDef.pads[0];
    const tapPad = () => {
      const s = window.__TD.w2s(pad.cx + 0.5, pad.cy + 0.5);
      const c = document.querySelector("#screen-td-play .td-canvas");
      const r = c.getBoundingClientRect();
      c.dispatchEvent(new MouseEvent("click", { clientX: r.left + s.x, clientY: r.top + s.y, bubbles: true }));
    };
    tapPad();
    document.querySelector(".td-buy[data-line=dart]").click();
    eng.state.gold = 5000; window.TDUI.hud(eng.state);
    tapPad();                                     // ONE opening from here on
    const bubble = document.querySelector(".td-bubble");
    const steps = [];
    for (let i = 0; i < 2; i++) {
      const btn = document.querySelector(".td-up");
      if (!btn) break;
      const labelBefore = btn.textContent.trim();
      btn.click();
      steps.push({
        tier: eng.state.towers[0].tier,
        stillOpen: !bubble.hidden,
        labelBefore,
        labelAfter: (document.querySelector(".td-up") || {}).textContent || null,
        branchesShown: document.querySelectorAll(".td-branch").length,
      });
    }
    // …and selling DOES close it, since the tower is gone.
    const sell = document.querySelector(".td-sell");
    if (sell) sell.click();
    return { steps, closedAfterSell: bubble.hidden, towersLeft: eng.state.towers.length };
  });
  assert.equal(out.steps.length, 2, "two upgrades must be reachable without re-opening the panel");
  assert.deepEqual(out.steps.map((s) => s.tier), [2, 3], "the tower really climbs 1→2→3");
  for (const s of out.steps) assert.ok(s.stillOpen, `the panel closed after upgrading to tier ${s.tier}`);
  assert.notEqual(out.steps[0].labelBefore, out.steps[1].labelBefore,
    "the price must RE-RENDER between tiers — an unchanged label means a stale panel");
  const nBranches = await page.evaluate(() => Object.keys(window.TDData.TOWERS.dart.branches).length);
  assert.equal(out.steps[1].branchesShown, nBranches,
    `at tier 3 the panel re-renders into ALL ${nBranches} branch cards`);
  assert.ok(out.closedAfterSell, "selling must still close the panel — its subject is gone");
  assert.equal(out.towersLeft, 0, "…and the tower really was sold");
});

test("UX: a price is the ENGINE's, and its colour is right on the FIRST paint", async () => {
  // Two defects in one place.
  //   (a) "When I first open the dialog the color will flash purple even if I
  // cannot afford upgrade." UI.prices ran only from UI.hud(), i.e. a frame after
  // the bubble was revealed, so every price showed its BASE colour first (the
  // branch cards are purple) and only then went red.
  //   (b) The panel re-derived prices from DATA while the engine charges
  // `× mods.upgradeCost` (🔧 Handyman) and `× mods.branchCost` (💰 Bulk Deal) —
  // so an owning run was shown 110 while being charged 99, and the button sat
  // red-and-disabled at 100-109 gold, which it could actually afford.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const out = await page.evaluate(() => {
    const probe = (meta) => {
      window.__TD.newGame(1, { seed: 3, meta });
      const eng = window.__TD.engine();
      const pad = eng.levelDef.pads[0];
      const tapPad = () => {
        const s = window.__TD.w2s(pad.cx + 0.5, pad.cy + 0.5);
        const c = document.querySelector("#screen-td-play .td-canvas");
        const r = c.getBoundingClientRect();
        c.dispatchEvent(new MouseEvent("click", { clientX: r.left + s.x, clientY: r.top + s.y, bubbles: true }));
      };
      eng.state.gold = 9000; window.TDUI.hud(eng.state);
      tapPad();
      document.querySelector(".td-buy[data-line=dart]").click();
      const id = eng.state.towers[0].id;
      const price = eng.priceOf("upgrade", id);
      const read = (gold) => {
        eng.state.gold = gold; window.TDUI.hud(eng.state);
        document.querySelector(".td-bubble").hidden = true;   // force a fresh OPEN
        tapPad();
        const up = document.querySelector(".td-up");
        return { cost: +up.dataset.cost, label: up.textContent.trim(),
                 afford: up.classList.contains("td-afford"),
                 no: up.classList.contains("td-afford--no"), disabled: up.disabled };
      };
      return { price, poor: read(price - 1), exact: read(price) };
    };
    return { plain: probe([]), disc: probe(["handyman"]) };
  });
  for (const [name, r] of Object.entries(out)) {
    // (b) the number the button SHOWS is the number the engine charges
    assert.equal(r.poor.cost, r.price, `${name}: data-cost must be the engine's price`);
    assert.ok(r.poor.label.indexOf(String(r.price)) >= 0,
      `${name}: the label "${r.poor.label}" must print the engine's price ${r.price}`);
    // (a) correct on the FIRST paint, with no window of the base colour
    assert.ok(r.poor.no && !r.poor.afford, `${name}: one gold short must open RED, never flash affordable`);
    assert.ok(r.poor.disabled, `${name}: …and be untappable`);
    assert.ok(r.exact.afford && !r.exact.no, `${name}: exactly affording must open GREEN`);
    assert.ok(!r.exact.disabled, `${name}: …and be tappable`);
  }
  // The discount must actually BITE, or the plain/disc pair proves nothing.
  assert.ok(out.disc.price < out.plain.price,
    `🔧 Handyman must lower the upgrade price (plain ${out.plain.price}, discounted ${out.disc.price}) — ` +
    "otherwise this test cannot tell a DATA-derived price from an engine-derived one");
});

test("TD-12 guide: every DERIVED section actually reaches the page", async () => {
  // The guide builds six sections from data. Two are asserted on the rendered
  // page (enemy cards, star tree) and four were only ever tested as
  // DERIVATIONS: every levelGimmicks test lives in td-logic.test.js and checks
  // the function, so the render loop could drop a section — or the whole
  // section could stop being appended — with those guardrails green. That is
  // the same structural-vs-driven split that let `earnAch` go undriven: a scan
  // proves the data exists, only the page proves the player can read it.
  //
  // Derived from the data, so a sixth gimmick, a fifth line, a ninth branch or
  // a sixth power inherits the check instead of needing someone to remember.
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.locator(".td-guide-open").click();
  await page.locator(".td-overlay--guide").waitFor({ state: "visible" });
  const g = await page.evaluate(() => {
    const D = window.TDData, L = window.TDLogic;
    const gimmicks = new Set();
    for (const lv of D.LEVELS) for (const x of L.levelGimmicks(lv)) gimmicks.add(x.name);
    const branches = [];
    for (const t of Object.values(D.TOWERS)) for (const b of Object.values(t.branches || {})) branches.push(b.name);
    return {
      text: document.querySelector(".td-overlay--guide .td-overlay__box").textContent,
      gimmicks: [...gimmicks],
      powers: (D.ABILITIES || []).map((a) => a.name),
      branches,
      lines: Object.values(D.TOWERS).map((t) => t.name),
      chips: (D.CHIPS || []).map((c) => c.name),
    };
  });
  // None of the five may be vacuously empty, or the loops below assert nothing.
  assert.ok(g.gimmicks.length >= 4, `the campaign really has gimmicks (${g.gimmicks.length})`);
  assert.ok(g.powers.length >= 4, `…and powers (${g.powers.length})`);
  assert.ok(g.branches.length >= 8, `…and tier-4 branches (${g.branches.length})`);
  assert.ok(g.lines.length >= 4, `…and tower lines (${g.lines.length})`);
  assert.ok(g.chips.length >= 4, `…and challenge chips (${g.chips.length})`);
  for (const [what, names] of Object.entries({ gimmick: g.gimmicks, power: g.powers, branch: g.branches, line: g.lines, chip: g.chips })) {
    for (const n of names) {
      assert.ok(g.text.indexOf(n) >= 0,
        `the guide's rendered page never mentions the ${what} "${n}" — it is derived from the data, ` +
        "so a section that stops being appended leaves the mechanic undocumented while the derivation test stays green");
    }
  }
  await page.locator(".td-guide-done").click();
});

test("TD-18 daily: the same day is the same puzzle, scored on ITS OWN ladder", async () => {
  // The daily's whole promise is determinism-by-date: every attempt at today's
  // board is the same board, so a best is a fair best. The engine is already
  // deterministic by seed; what this drives is the SHELL's half — the date →
  // (arena, chip, seed) pick, the run actually carrying it, and the score
  // landing on the daily ladder and nowhere else.
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.resetSave(); });
  const picks = await page.evaluate(() => {
    const D = window.TDData;
    const a = window.__TD.dailyInfo("2026-08-14");
    const b = window.__TD.dailyInfo("2026-08-14");
    const worlds = Object.keys(D.ENDLESS.arenas);
    const chips = new Set((D.CHIPS || []).map((c) => c.id));
    // 60 days of picks: every field stays legal, and the rotation actually
    // rotates (a stuck pick would be one board forever — a dead feature).
    const seen = { worlds: new Set(), chips: new Set(), seeds: new Set() };
    for (let i = 1; i <= 60; i++) {
      const p = window.__TD.dailyInfo("2026-09-" + String((i % 28) + 1).padStart(2, "0") + (i > 28 ? "x" + i : ""));
      if (!worlds.includes(p.world)) return { bad: "world " + p.world };
      if (p.chip !== null && !chips.has(p.chip)) return { bad: "chip " + p.chip };
      seen.worlds.add(p.world); seen.chips.add(String(p.chip)); seen.seeds.add(p.seed);
    }
    return { same: JSON.stringify(a) === JSON.stringify(b), pick: a,
             worlds: seen.worlds.size, chips: seen.chips.size, seeds: seen.seeds.size };
  });
  assert.ok(!picks.bad, `every pick must be legal (${picks.bad})`);
  assert.ok(picks.same, "the same day string must produce the identical pick");
  assert.ok(picks.worlds >= 5, `the arena rotation must actually rotate (${picks.worlds} of 10 seen in 60 days)`);
  assert.ok(picks.chips >= 3, `…and the modifier draw too (${picks.chips} distinct)`);
  assert.ok(picks.seeds >= 40, `…and the seeds must not collapse (${picks.seeds} distinct)`);
  // ---- the date → ARENA map is pinned, because ENDLESS.arenas' KEY ORDER is
  // load-bearing and looks like it is not: dailyPick indexes Object.keys(arenas)
  // by the date hash, so tidying those keys into campaign order (which the
  // sibling ENDLESS.worlds literal has just been sorted into, so the temptation
  // is right there) silently re-points EVERY past and future day at a different
  // board, and a stored daily best then refers to a board nobody can replay.
  // One date per arena INDEX, so any re-ordering at all turns at least one row
  // red — a shorter list would tolerate a swap of the keys it does not cover.
  const DAILY_PIN = [
    ["2026-01-19", "bedroom"], ["2026-01-04", "backyard"], ["2026-01-01", "toystore"],
    ["2026-01-07", "attic"], ["2026-01-16", "moving"], ["2026-01-08", "party"],
    ["2026-01-03", "toyworks"], ["2026-01-02", "sortline"], ["2026-01-05", "newhouse"],
    ["2026-01-23", "garage"],
  ];
  const pinned = await page.evaluate((days) => days.map((d) => window.__TD.dailyInfo(d).world), DAILY_PIN.map((p) => p[0]));
  assert.deepEqual(pinned, DAILY_PIN.map((p) => p[1]),
    "each pinned date must still map to its own arena — ENDLESS.arenas' key order decides this");
  assert.equal(new Set(pinned).size, await page.evaluate(() => Object.keys(window.TDData.ENDLESS.arenas).length),
    "the pin must cover every arena INDEX or a swap of the keys it misses slips past — and note that ADDING " +
    "an arena legitimately re-points every date (the hash is % n), so a new world means regenerating this table");
  // ---- play the pinned day: the run carries the pick
  const run = await page.evaluate(() => {
    window.__TD.playDaily("2026-08-14");
    const st = window.__TD.state();
    const eng = window.__TD.engine();
    return { world: eng.levelDef.world, chips: st.chips, endless: !!st.endless,
             difficulty: st.difficulty, midRunAfterBuildLeave: null };
  });
  const expect = picks.pick;
  assert.equal(run.world, expect.world, "the run is on the day's arena");
  assert.deepEqual(run.chips, expect.chip ? [expect.chip] : [], "…with the day's chip");
  assert.ok(run.endless, "…as an endless run");
  assert.equal(run.difficulty, "normal", "…pinned to normal, so the board is one shared puzzle");
  // ---- a daily never checkpoints (single sitting, by design)
  await page.evaluate(() => { location.hash = "#td-home"; }); // leavingPlay fires on the route
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const mid = await page.evaluate(() =>
    ({ midRun: window.__TD.midRun(), daily: JSON.parse(localStorage.getItem("jon-td-save-v1")).daily }));
  assert.equal(mid.midRun, null, "a daily leaves no resume checkpoint");
  // …and the QUIT still recorded the (zero-wave) attempt on the daily ladder
  assert.equal(mid.daily.day, "2026-08-14", "the quit records under the run's own day");
  // ---- lose a real daily: score lands on the daily ladder and ONLY there
  const out = await page.evaluate(() => {
    location.hash = "#td-play";
    window.__TD.playDaily("2026-08-14");
    for (let i = 0; i < 40 && window.__TD.state().phase !== "lost"; i++) {
      window.__TD.script([["call"], ["untilPhase", "build", 60000]]);
    }
    const s = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    return { phase: window.__TD.state().phase, daily: s.daily, endlessBest: s.endlessBest };
  });
  assert.equal(out.phase, "lost", "neglecting the daily loses it");
  assert.ok((out.daily.best | 0) >= 1, `the daily best recorded (wave ${out.daily.best})`);
  assert.equal(out.daily.allTime | 0, out.daily.best | 0, "…and the all-time daily best tracks it");
  assert.deepEqual(out.endlessBest, {},
    "a daily score must NEVER write the endless grid — separate ladders, and the daily can visit arenas endless has not unlocked");
});

test("QoL: the 📅 Daily card states the day's RULES before you commit", async () => {
  // The card's own comment enumerates what it exists to say — "which arena,
  // which chip (if any), and both bests" — and a daily is ALSO pinned to one
  // ladder, which it never mentioned. So a player sitting on the 💀 Hard chip
  // pressed Play and got Normal with nothing said: a rule of the run, stated
  // nowhere, on the screen whose whole job is stating the run's rules. Same law
  // as the ⬆ upgrade preview and the % road figure — the information belongs
  // where the decision is made.
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.resetSave(); });
  try {
    // Put the fort on HARD. Without this the "card must not follow the chip"
    // clause is vacuous, because Normal is the pinned answer anyway.
    await page.locator('#screen-td-home .td-diffbtn[data-diff="heroic"]').click();
    const chip = await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).difficulty);
    assert.equal(chip, "heroic", "fixture: the fort chip must really be on Hard, or the next clause proves nothing");

    await page.locator(".td-daily-open").click();
    await page.locator(".td-daily__card").waitFor({ state: "visible" });
    const card = await page.evaluate(() => {
      const box = document.querySelector(".td-daily__card").closest(".td-overlay");
      return { text: box.innerText, spike: (document.querySelector(".td-daily__spike") || {}).textContent || "",
               rules: (document.querySelector(".td-daily__rules") || {}).textContent || "" };
    });
    const pick = await page.evaluate(() => window.__TD.dailyInfo());
    const hardLabel = await page.evaluate(() => window.TDUI.difficultyLabel("heroic"));

    // ---- 1. an unplayed board does not report "wave 0" — a bar, not progress.
    assert.ok(/unplayed/i.test(card.text),
      `a board nobody has played must say so, not score it (card said: ${JSON.stringify(card.text)})`);
    // All-time BEFORE the zero-score clause: the mutation that makes the
    // all-time line unconditional prints "All-time daily best: wave 0", which
    // trips the zero-score clause first and leaves this one unproven — the
    // earlier-clause trap. Ordered this way each mutation fires its own.
    assert.ok(card.text.indexOf("All-time") < 0, "…nor an all-time best before there is one");
    assert.ok(card.text.indexOf("wave 0") < 0, "…and must never print a zero score");

    // ---- 2. the card must NOT follow the fort-home chip, which is the defect
    // the rules line exists to prevent being invisible.
    assert.ok(card.rules, `the card must carry a rules line at all (text: ${JSON.stringify(card.text)})`);
    assert.ok(card.rules.indexOf(hardLabel) < 0,
      `the fort chip is on ${hardLabel} and the daily is pinned, so the card must not advertise it (rules line: "${card.rules}")`);

    // ---- 3. the arena's SPIKE, compared against the ENDLESS PICKER'S OWN ROW
    // for the same arena rather than against the shared helper. Both surfaces
    // describe one fact, so the claim worth pinning is that they AGREE — reading
    // the helper at both ends would flatten the moment somebody re-inlines the
    // phrase at one site and drifts it.
    await page.evaluate(() => window.TDUI.closeOverlay());
    await page.locator(".td-endless-open").click();
    await page.locator(".td-endlessrows").waitFor({ state: "visible" });
    const rowSpike = await page.evaluate((w) => {
      const row = document.querySelector('.td-endless[data-world="' + w + '"]');
      return row ? ((row.querySelector(".td-endless__spike") || {}).textContent || "") : null;
    }, pick.world);
    await page.evaluate(() => window.TDUI.closeOverlay());
    assert.ok(rowSpike, `fixture: today's arena (${pick.world}) must have a picker row naming a spike, or clause 3 is vacuous`);
    assert.equal(card.spike, rowSpike,
      "the daily card and the endless picker describe the same arena, so they must name the same spike");

    // ---- 4. the ladder the card NAMES is the ladder the run actually gets.
    // Behavioural on purpose: reading it off `pick` at both ends would flatten
    // (both would move together), so the run is DRIVEN and the card compared
    // against what the engine really did. Point startDaily at the save and the
    // run comes out Hard while the card still says Normal. Last, because it
    // navigates away from the fort home.
    const ran = await page.evaluate(() => {
      const d = window.__TD.dailyInfo().day;
      window.__TD.playDaily(d);
      return window.__TD.state().difficulty;
    });
    const ranLabel = await page.evaluate((d) => window.TDUI.difficultyLabel(d), ran);
    assert.ok(card.rules.indexOf(ranLabel) >= 0,
      `the daily card must name the ladder the run is actually on — the run came out ${ran} ` +
      `("${ranLabel}") and the card's rules line reads "${card.rules}"`);
  } finally {
    await page.evaluate(() => { if (window.TDUI && window.TDUI.closeOverlay) window.TDUI.closeOverlay(); });
  }

  // ---- 5. once there IS a best, the card reports it. Seeded + RELOADED,
  // because the module holds its own `save` object and a bare localStorage
  // write is invisible to it (the documented same-document trap); midRun is
  // cleared with it, or a parked run bounces #td-play back to the fort home.
  const day = await page.evaluate(() => window.__TD.dailyInfo().day);
  await page.evaluate((d) => {
    const s = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    s.daily = { day: d, best: 7, allTime: 9 };
    s.midRun = null;
    localStorage.setItem("jon-td-save-v1", JSON.stringify(s));
  }, day);
  await page.reload();
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  try {
    const seeded = await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).daily);
    assert.equal(seeded.best, 7, "fixture: the seed must survive the reload, or clause 5 measures the old state");
    await page.locator(".td-daily-open").click();
    await page.locator(".td-daily__card").waitFor({ state: "visible" });
    const txt = await page.evaluate(() => document.querySelector(".td-daily__card").innerText);
    assert.ok(txt.indexOf("wave 7") >= 0, `a played board reports today's best (card said: ${JSON.stringify(txt)})`);
    assert.ok(txt.indexOf("wave 9") >= 0, "…and the all-time line appears once there is an all-time");
  } finally {
    await page.evaluate(() => { if (window.TDUI && window.TDUI.closeOverlay) window.TDUI.closeOverlay(); });
    await page.evaluate(() => { window.__TD.resetSave(); });
  }
});

test("QoL: the 📅 Daily card keeps ▶ Play above the fold", async () => {
  // Adding the ladder and the spike to this card is exactly the shape that has
  // pushed a fort control past the fold before, so the cost is measured rather
  // than assumed. FRESH CONTEXTS, never setViewportSize: a resize does not
  // reproduce this class (the 834 comparison-game defect survived its own
  // mutation for precisely that reason) — a real device loads the page at its
  // size. The two sizes here are the SEPARATING ones, measured: at 844x390 the
  // first cut cost +38px and took ▶ Play from in-view to out, and 320x480 is
  // the shortest portrait phone, where this box is already at its cap. 390x844
  // has slack at both states and is carried only as the ordinary case.
  const SIZES = [[844, 390], [320, 480], [390, 844]];
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const p2 = await ctx.newPage();
    try {
      await p2.goto(baseURL, { waitUntil: "load" });
      await p2.evaluate(() => { location.hash = "#td-home"; });
      await p2.locator("#screen-td-home").waitFor({ state: "visible" });
      await p2.evaluate(() => { window.__TD.resetSave(); });
      await p2.locator(".td-daily-open").click();
      await p2.locator(".td-daily__card").waitFor({ state: "visible" });
      const m = await p2.evaluate(() => {
        const b = document.querySelector(".td-daily-play").getBoundingClientRect();
        const box = document.querySelector(".td-overlay__box").getBoundingClientRect();
        return { top: Math.round(b.top), bottom: Math.round(b.bottom), vh: window.innerHeight,
                 boxW: Math.round(box.width), h: Math.round(b.height),
                 wide: document.documentElement.scrollWidth > document.documentElement.clientWidth };
      });
      assert.ok(m.h >= 44, `fixture: the play button must have real size at ${w}x${h} (${m.h}px)`);
      assert.ok(m.top >= 0 && m.bottom <= m.vh,
        `▶ Play must be reachable without scrolling the dialog at ${w}x${h} — it sits at ` +
        `${m.top}..${m.bottom} in a ${m.vh}px viewport (box ${m.boxW}px wide)`);
      assert.ok(!m.wide, `…and the page must not scroll sideways at ${w}x${h}`);
      // Short LANDSCAPE is height-constrained with width to spare, which is why
      // the wide overlay takes the spare axis there. Assert the HEADROOM, not
      // the width that buys it: a box-width clause would be a quantity that
      // merely correlates with the property, and this file has already been
      // caught doing that. The bar is a MEASURED separation — 38px of clearance
      // with the landscape width, 1px without it (which is luck, not headroom) —
      // so it sits between the two states rather than beside either.
      if (w > h) assert.ok(m.vh - m.bottom >= 15,
        `▶ Play must clear a short landscape viewport with real room, not by a pixel — ` +
        `${m.vh - m.bottom}px of clearance at ${w}x${h} (box ${m.boxW}px wide)`);
    } finally {
      await ctx.close();
    }
  }
});

test("TD-18 chips: armed in the picker, locked on the menu, stamped by the WIN", async () => {
  // The engine tests prove the ban binds; this drives the FEATURE — picker to
  // build menu to win to level card — because a structural proof that a call
  // site exists says nothing about the player being able to reach it (the
  // earnAch lesson, same session).
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.resetSave(); });
  // ---- arm 🥵 Heat Wave through the real picker
  await page.locator(".td-chips-open").click();
  await page.locator(".td-overlay--td-chips, .td-chips").first().waitFor({ state: "visible" });
  await page.locator('[data-armchip="nofan"]').click();
  const armed = await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).chipsArmed);
  assert.deepEqual(armed, ["nofan"], "arming through the picker persists");
  await page.locator(".td-chips-done").click();
  // ---- the run carries it: the fan button is LOCKED in the build menu
  await page.evaluate(() => { location.hash = "#td-play"; window.__TD.newGame(1, { seed: 7, chips: ["nofan"] }); });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const menu = await page.evaluate(() => {
    const eng = window.__TD.engine();
    const pad = eng.levelDef.pads[0];
    const s = window.__TD.w2s(pad.cx + 0.5, pad.cy + 0.5);
    const c = document.querySelector("#screen-td-play .td-canvas");
    const r = c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent("click", { clientX: r.left + s.x, clientY: r.top + s.y, bubbles: true }));
    const fan = document.querySelector('.td-buy[data-line="fan"]');
    const dart = document.querySelector('.td-buy[data-line="dart"]');
    return { fanDisabled: fan.disabled, fanText: fan.textContent, fanHasCost: fan.hasAttribute("data-cost"),
             dartDisabled: dart.disabled, refuse: eng.place("fan", pad.id).reason };
  });
  assert.ok(menu.fanDisabled, "the banned line's button is disabled");
  assert.match(menu.fanText, /challenge/i, "…and says WHY, instead of reading as broken");
  assert.ok(!menu.fanHasCost, "…and carries no data-cost, or paintPrices would re-enable it on the next repaint");
  assert.ok(!menu.dartDisabled, "an allowed line stays buyable");
  assert.equal(menu.refuse, "chip", "the engine refuses the same thing the button shows");
  // ---- the checkpoint carries the chips (a resumed challenge is still the challenge)
  const mr = await page.evaluate(() => { window.__TD.script([["place", "dart", "p3"]]); location.hash = "#td-home"; return window.__TD.midRun(); });
  assert.deepEqual(mr && mr.chips, ["nofan"], "writeMidRun snapshots the run's chips");
  // ---- win honestly with the chip on → the level card is stamped
  await page.evaluate(() => { location.hash = "#td-play"; });
  const won = await page.evaluate(() => {
    window.__TD.winL1(7, { chips: ["nofan"] });
    const s = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    return { phase: window.__TD.state().phase, chipsWon: s.chipsWon, ranWith: window.__TD.state().chips };
  });
  assert.equal(won.phase, "won", "the fixture really wins");
  assert.deepEqual(won.ranWith, ["nofan"], "…with the chip actually ON the run (winL1 must not drop opts)");
  assert.deepEqual(won.chipsWon && won.chipsWon["1"], ["nofan"], "the win stamps the chip on L1");
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const card = await page.evaluate(() => {
    const c = document.querySelector(".td-levels .td-level:not(.td-level--locked)");
    const chips = c.querySelector(".td-level__chips");
    return chips ? chips.textContent : "";
  });
  assert.ok(card.indexOf("🥵") >= 0, `L1's card shows the earned chip (saw "${card}")`);
  // ---- and the reset clears it, or the wipe leaves ghost trophies
  await page.evaluate(() => { window.__TD.resetSave(); });
  const wiped = await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")));
  assert.deepEqual(wiped.chipsWon, {}, "reset clears the stamps");
  assert.deepEqual(wiped.chipsArmed, [], "…and the armed set");
});

test("AUDIT badges: WINNING actually earns one, end to end", async () => {
  // The engine-side guardrail that every declared badge is awarded is a TEXT
  // scan of td-main.js — it proves an `earnAch("doorman")` line EXISTS, not that
  // beating a level runs it. And every other badge test SEEDS save.ach to
  // exercise the merge/reset/persist paths, so nothing had ever driven the award
  // chain itself. It is exactly the path this file records crashing twice
  // (`save.ach.indexOf` on a legacy save, then `save.stars`), and a win that
  // silently earns nothing would look identical to a win.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const out = await page.evaluate(async () => {
    window.__TD.resetSave();                       // a pre-earned badge would pass trivially
    const before = window.__TD.ach();
    window.__TD.winL1(7);
    const st = window.__TD.state();
    return { before, after: window.__TD.ach(), phase: st.phase, cheated: !!st.cheated };
  });
  assert.deepEqual(out.before, [], "the reset must actually clear the badges, or this proves nothing");
  assert.equal(out.phase, "won", "the fixture must really win the level");
  assert.ok(!out.cheated, "…honestly — a cheated run is skipped by awardWinAchievements by design");
  assert.ok(out.after.includes("doorman"),
    `beating L1 must award its badge (saw ${JSON.stringify(out.after)}) — the level-id branch of the chain`);
  assert.ok(out.after.includes("firstblood"),
    `…and a kill must award First Blood (saw ${JSON.stringify(out.after)}) — the event branch, ` +
    "which is wired somewhere else entirely and would not be covered by the level-id case alone");
});

test("UX: the damage-numbers toggle actually draws the damage", async () => {
  // `setDamageNumbers` is wired end to end — pause-menu toggle → save →
  // renderer — and td-main's own comment calls it a hook "for tests", but no
  // test drove it. That is the shape in which the Fan's beam and the muzzle
  // flash both turned out to draw nothing at all: an opt-in fx nobody looks at.
  //
  // Read what is DRAWN rather than diffing pixels. A number is text, so wrapping
  // fillText answers the question exactly — including the TD-6 claim that the
  // value is THREADED through the event rather than recomputed — where a pixel
  // diff would only say "something changed" and could be satisfied by anything.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const out = await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 5 });
    const eng = window.__TD.engine(), r = window.__TD.render();
    const cv = document.querySelector("#screen-td-play .td-canvas");
    const ctx = cv.getContext("2d");
    const real = ctx.fillText.bind(ctx);
    let drawn = [];
    ctx.fillText = (t, x, y) => { drawn.push(String(t)); return real(t, x, y); };
    const p = eng.posOn(0, 3);
    const run = (on, dmg, crit) => {
      r.setDamageNumbers(on);
      for (let k = 0; k < 40; k++) r.draw(0);       // age any earlier fx out
      r.pushFx({ type: "hit", x: p.x, y: p.y, dmg, crit });
      drawn = [];
      r.draw(0);
      return drawn.slice();
    };
    const off = run(false, 37, false);
    const on = run(true, 37, false);
    const critOn = run(true, 58, true);
    ctx.fillText = real;
    return { off, on, critOn, hasHook: typeof r.setDamageNumbers === "function" };
  });
  assert.ok(out.hasHook, "the renderer must expose setDamageNumbers for the pause toggle to reach it");
  assert.ok(out.on.includes("37"),
    `with the toggle ON the hit's damage must be drawn (saw ${JSON.stringify(out.on)})`);
  assert.ok(!out.off.includes("37"),
    `with the toggle OFF it must not be (saw ${JSON.stringify(out.off)}) — otherwise the option does nothing`);
  // THREADED, not recomputed: a different hit must draw its own number.
  assert.ok(out.critOn.includes("58"),
    `the number must come from the event, not a constant (saw ${JSON.stringify(out.critOn)})`);
});

test("UX: a hider flushed out by 🧨 LOOKS catchable", async () => {
  // `engine.isRevealed` exists for exactly one reason — the renderer paints a
  // flushed-out hider with a pulsing halo, and that halo is the player's ONLY
  // confirmation that a 130-gold blast did anything to a body it cannot
  // normally touch. It was the one engine export no test drove: the ENGINE side
  // is covered (the P3 reveal tests prove a revealed hider becomes targetable
  // through the one isHidden gate) while the PICTURE was not, so the halo could
  // have stopped painting and the whole suite would have stayed green.
  //
  // A tunnelling Digger Mole is the tractable hider: it is hidden for the whole
  // middle third of its lane, deterministically, where a Glitter Ghost phases on
  // its own clock.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const out = await page.evaluate(() => {
    const lvl = window.TDData.LEVELS.find((l) => l.waves.some((w) => w.groups.some((g) => g.type === "mole")));
    window.__TD.newGame(lvl.id, { seed: 5 });
    const eng = window.__TD.engine(), r = window.__TD.render();
    // Hand-spawn is not available, so walk the waves until the one carrying the
    // mole. A tower-less board LOSES before wave 3 and then callWave is a no-op,
    // which is why the first cut of this fixture never found a mole at all — so
    // make the run unloseable for the walk. This is a RENDER test; lives are not
    // the thing under measurement (the same licence as gold in the pad sweeps).
    const wi = lvl.waves.findIndex((w) => w.groups.some((g) => g.type === "mole"));
    for (let i = 0; i <= wi; i++) {
      eng.state.lives = 9999;
      eng.callWave();
      for (let k = 0; k < 1200 && eng.state.phase === "wave"; k++) eng.tick();
    }
    eng.state.lives = 9999;
    // ISOLATION, and it took a failed mutation to get right. The obvious probe
    // — a HIDDEN mole, draw, reveal, draw — measures the body becoming
    // un-hidden, not the halo: `isHidden` returns false the moment `revealedAt`
    // is true, so the sprite itself changes and deleting the halo entirely left
    // that version GREEN. `revealedAt` does not care whether a body is a hider,
    // so the clean control is a body that is ALREADY visible in both frames:
    // then the reveal changes the halo and nothing else.
    // Both bodies must come from the SAME frame: latching them across ticks let
    // the visible one walk into the tunnel before the draw, and the control's
    // own precondition then failed.
    let mole = null, hidden = null;
    for (let k = 0; k < 6000; k++) {
      eng.tick();
      const live = eng.state.enemies.filter((e) => e.alive && e.type === "mole");
      mole = live.find((e) => !eng.isHidden(e));
      hidden = live.find((e) => eng.isHidden(e));
      if (mole && hidden) break;
    }
    if (!mole || !hidden) return { found: false };
    const p = eng.posOn(mole.pathIdx || 0, mole.dist);
    const s = window.__TD.w2s(p.x + 0.5, p.y + 0.5);   // the +0.5 draw convention
    const cv = document.querySelector("#screen-td-play .td-canvas");
    const c = cv.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const R = Math.round(26 * dpr);
    const gx = Math.round(s.x * dpr), gy = Math.round(s.y * dpr);
    const grab = () => Array.from(c.getImageData(gx - R, gy - R, R * 2, R * 2).data);
    // FREEZE the tick: the halo's alpha pulses off state.tick, and every other
    // body on the field moves with it, so both frames must be the same tick or
    // the diff is measuring the wave walking past.
    const tick = eng.state.tick;
    // …and `draw()` AGES every screen fx by one, so two consecutive draws are
    // not the same picture while a poof or a damage number is still alive near
    // the body. Age the board empty first, then prove it: two draws with nothing
    // changed must differ by ~0, which makes the isolation self-verifying rather
    // than assumed. Without this the diff below was dominated by expiring fx and
    // deleting the halo entirely left the test GREEN.
    for (let k = 0; k < 90; k++) r.draw(0);
    const plain = grab();
    r.draw(0);
    const again = grab();
    let residue = 0;
    for (let i = 0; i < plain.length; i += 4) {
      if (Math.abs(plain[i] - again[i]) + Math.abs(plain[i + 1] - again[i + 1]) + Math.abs(plain[i + 2] - again[i + 2]) > 16) residue++;
    }
    // The export exists for the RENDERER alone (the renderer guards on
    // `engine.isRevealed &&`, so losing it makes the halo stop silently). It was
    // the one engine export no test drove; name it, so its loss reads as itself.
    if (typeof eng.isRevealed !== "function") return { found: true, noExport: true };
    const wasHidden = eng.isHidden(mole), wasRevealed = eng.isRevealed(mole);
    // A blast-sized reveal covers the NEIGHBOURS too, and an un-hidden body
    // appearing in the box is worth ~212 px of its own — more than a naive
    // threshold, which is precisely how the first cut survived deleting the
    // halo. So the zone is drawn tight enough to contain ONLY the sampled body,
    // and that is asserted rather than hoped: `solo` counts everything inside it.
    const RR = 0.3;
    const solo = eng.state.enemies.filter((e) => {
      const q = eng.posOn(e.pathIdx || 0, e.dist);
      return e.alive && (q.x - p.x) ** 2 + (q.y - p.y) ** 2 <= RR * RR;
    }).length;
    eng.state.reveals.push({ x: p.x, y: p.y, r: RR, until: tick + 300 });
    r.draw(0);
    const lit = grab();
    const nowRevealed = eng.isRevealed(mole), stillVisible = !eng.isHidden(mole);
    // …and the SEMANTIC half, on the body that really is tunnelling: a reveal
    // must both flag it and make it targetable through the one isHidden gate.
    const hp = eng.posOn(hidden.pathIdx || 0, hidden.dist);
    eng.state.reveals.push({ x: hp.x, y: hp.y, r: 0.3, until: tick + 300 });
    const hiddenFlagged = eng.isRevealed(hidden), hiddenNowTargetable = !eng.isHidden(hidden);
    let changed = 0;
    for (let i = 0; i < again.length; i += 4) {
      if (Math.abs(again[i] - lit[i]) + Math.abs(again[i + 1] - lit[i + 1]) + Math.abs(again[i + 2] - lit[i + 2]) > 16) changed++;
    }
    return { found: true, changed, residue, solo, wasHidden, wasRevealed, nowRevealed, stillVisible,
             hiddenFlagged, hiddenNowTargetable, tickHeld: eng.state.tick === tick, box: R * R * 4 };
  });
  assert.ok(out.found, "the fixture needs a mole in its visible stretch AND one tunnelling");
  assert.ok(!out.noExport,
    "the engine must expose isRevealed — the renderer guards on it, so dropping it stops the halo silently");
  // The control must really be a control: the body is visible in BOTH frames, so
  // the only thing the reveal can change in the sample box is the halo.
  assert.ok(!out.wasHidden && !out.wasRevealed, "the sampled body starts VISIBLE and unrevealed");
  assert.ok(out.nowRevealed && out.stillVisible,
    "…and after the reveal it is flagged while STILL visible — otherwise this measures the sprite, not the halo");
  assert.ok(out.tickHeld, "both frames must be drawn at the same tick, or the diff is the wave walking");
  assert.ok(out.residue <= 4,
    `two draws with nothing changed must be the same picture (${out.residue} px drifted) — ` +
    "otherwise the diff below is expiring fx, which is exactly how the first cut of this test " +
    "survived deleting the halo it claims to measure");
  assert.equal(out.solo, 1,
    `the reveal zone must contain ONLY the sampled body (saw ${out.solo}) — a neighbour un-hiding ` +
    "inside the sample box is worth ~212 px on its own, which would swamp the halo");
  assert.ok(out.changed > 400,
    `a revealed body must LOOK different (only ${out.changed} px of ${out.box} changed) — ` +
    "the halo is the whole feedback that the blast reached something you cannot normally hit");
  // The semantics, on a body that really is tunnelling.
  assert.ok(out.hiddenFlagged && out.hiddenNowTargetable,
    "a reveal over a tunnelling mole must flag it AND make it targetable through the one isHidden gate");
});

test("UX: the tower panel's stat line reads the ENGINE, and reads cleanly", async () => {
  // Two claims the engine test cannot make. (1) The rendered line uses the
  // engine's numbers — on a NIGHT level it printed the tier's range while the
  // ring beside it drew ×0.85 of it. (2) Those numbers are floats (2.4 aura +
  // 0.3 Cold Front is 2.7000000000000002), so the line has to FORMAT them; a
  // panel reading "2.7000000000000002 aura" would be a worse bug than the stale
  // number it replaced, and only reading the DOM can catch it.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const out = await page.evaluate(() => {
    const night = window.TDData.LEVELS.find((l) => l.night);
    const read = (levelId, line, meta) => {
      window.__TD.newGame(levelId, { seed: 3, meta });
      const eng = window.__TD.engine();
      const pad = eng.levelDef.pads[0];
      const tapPad = () => {
        const s = window.__TD.w2s(pad.cx + 0.5, pad.cy + 0.5);
        const c = document.querySelector("#screen-td-play .td-canvas");
        const r = c.getBoundingClientRect();
        c.dispatchEvent(new MouseEvent("click", { clientX: r.left + s.x, clientY: r.top + s.y, bubbles: true }));
      };
      eng.state.gold = 9000; window.TDUI.hud(eng.state);
      tapPad();
      document.querySelector(".td-buy[data-line=" + line + "]").click();
      const id = eng.state.towers[0].id;
      window.__TD.script([["upgrade", 0], ["upgrade", 0]]);
      document.querySelector(".td-bubble").hidden = true;
      tapPad();
      return {
        text: document.querySelector(".td-panel__stats").textContent,
        reach: eng.towerReach(id), tier: eng.state.towers[0].tier,
      };
    };
    return {
      nightId: night.id,
      rawDartRange: window.TDData.TOWERS.dart.tiers[2].range,
      dartNight: read(night.id, "dart", []),
      fanCold: read(1, "fan", ["fanrange"]),
    };
  });
  // (2) no float spew anywhere on the line — the thing a human would see first
  for (const [name, r] of Object.entries(out)) {
    if (typeof r !== "object") continue;
    assert.equal(r.tier, 3, `${name}: the probe must reach tier 3 (saw ${r.tier})`);
    assert.ok(!/\d\.\d{3,}/.test(r.text),
      `${name}: the stat line must format its numbers, saw "${r.text}"`);
  }
  // (1) the printed range IS the engine's reach, on the level where they differ
  const shown = +(out.dartNight.text.match(/([\d.]+) rng/) || [])[1];
  assert.ok(Math.abs(shown - out.dartNight.reach) < 0.011,
    `on night L${out.nightId} the panel printed "${out.dartNight.text}" but the engine's reach is ` +
    `${out.dartNight.reach.toFixed(2)} — the range RING already draws the engine's number, and the ` +
    "two must not disagree in front of the player");
  assert.ok(shown < out.rawDartRange,
    `night must visibly shrink the printed range (saw ${shown} of a raw ${out.rawDartRange}) — ` +
    "otherwise this test passes on a panel that is still printing the tier's number");
});

test("UX: the SELL button's number is what selling actually pays", async () => {
  // The same defect as the price flash, on the money moving the other way, and
  // it survived that fix by one line: the panel labelled its button
  // `Math.floor(t.spent * DATA.RULES.sellRefund)` — the RAW rule — while sell()
  // pays `× mods.sellRefund`. ♻️ Trade-In lifts that 80% → 90%, so an owning run
  // was shown 272 on a tier-3 dart and handed 306. Understating income is the
  // quieter half of the class (you do not notice being given MORE), which is
  // exactly why it needs a test rather than a player.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const out = await page.evaluate(() => {
    const probe = (meta) => {
      window.__TD.newGame(1, { seed: 3, meta });
      const eng = window.__TD.engine();
      const pad = eng.levelDef.pads[0];
      const tapPad = () => {
        const s = window.__TD.w2s(pad.cx + 0.5, pad.cy + 0.5);
        const c = document.querySelector("#screen-td-play .td-canvas");
        const r = c.getBoundingClientRect();
        c.dispatchEvent(new MouseEvent("click", { clientX: r.left + s.x, clientY: r.top + s.y, bubbles: true }));
      };
      eng.state.gold = 9000; window.TDUI.hud(eng.state);
      tapPad();
      document.querySelector(".td-buy[data-line=dart]").click();
      const id = eng.state.towers[0].id;
      // Upgrade through the engine, never by clicking: the panel re-renders in
      // place after a purchase, so a third click would land on a branch card.
      // NOTE `script`'s upgrade op takes an INDEX into state.towers, not an id —
      // passing the id here made both ops silently no-op and left the probe
      // measuring a tier-1 tower while claiming tier 3, so `spent` is returned
      // and asserted below rather than trusted.
      window.__TD.script([["upgrade", 0], ["upgrade", 0]]);
      document.querySelector(".td-bubble").hidden = true;   // force a fresh OPEN
      tapPad();
      const btn = document.querySelector(".td-sell");
      const shown = +(btn.textContent.match(/(\d+)/) || [])[1];
      const tw = eng.state.towers.find((x) => x.id === id);
      const goldBefore = eng.state.gold;
      const paid = eng.sell(id).refund;
      return { shown, paid, delta: eng.state.gold - goldBefore, spent: tw.spent, tier: tw.tier };
    };
    return { plain: probe([]), tradein: probe(["sellrefund"]) };
  });
  for (const [name, r] of Object.entries(out)) {
    // The fixture must have built the tower it claims: a silently no-opped
    // upgrade would leave a 70-gold tier-1, where the gap is smaller and the
    // test would still pass while measuring something else entirely.
    assert.equal(r.tier, 3, `${name}: the probe must reach tier 3 (saw tier ${r.tier}, spent ${r.spent})`);
    assert.equal(r.shown, r.paid,
      `${name}: the sell button printed ${r.shown} and selling paid ${r.paid} — the label must be the ENGINE's refund`);
    assert.equal(r.delta, r.paid, `${name}: …and that refund is what actually reaches your gold`);
  }
  // The node must actually BITE, or the pair proves nothing — the plain/discount
  // lesson from the price test, which is the only thing that separates a
  // DATA-derived label from an engine-derived one.
  assert.ok(out.tradein.paid > out.plain.paid,
    `♻️ Trade-In must raise the refund (plain ${out.plain.paid}, Trade-In ${out.tradein.paid}) — ` +
    "with them equal this test cannot tell the two sources apart");
});

test("the ⚙️ exchange shows its GOLD PRICE on the button, not only in a title", async () => {
  // Reported from real play: "buying extra gear doesn't specify cost". A title
  // is a hover affordance and this game is played on a phone, so the price has
  // to be rendered ink. Structural checks live in site.test.js; this one drives
  // the real HUD and READS THE BUTTON, because "the code exists" and "the
  // player can see it" are different claims — the lesson from the powers, whose
  // names were present in aria-labels and invisible on screen.
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 42 }); });
  // In-wave is when the exchange is live, so send one and let the HUD tick.
  await page.evaluate(() => { window.__TD.script([["call"]]); });
  await page.waitForTimeout(120);
  const seen = await page.evaluate(() => {
    const b = document.querySelector("#screen-td-play .td-hud__charge");
    if (!b) return { found: false };
    const buy = b.querySelector(".td-hud__chargeBuy");
    return {
      found: true,
      text: (b.textContent || "").trim(),
      priceShown: !!(buy && !buy.hidden && /\d/.test(buy.textContent || "")),
      priceText: buy ? (buy.textContent || "") : "",
    };
  });
  assert.ok(seen.found, "the ⚙️ exchange button must exist on the play screen");
  assert.ok(seen.priceShown,
    `the ⚙️ button must render its gold price as text (saw "${seen.text}") — a title is invisible on a touch device`);
  assert.ok(/🪙/.test(seen.priceText),
    `the price must name its currency (saw "${seen.priceText}")`);
});

test("ART: a body you must SINGLE OUT is not the faintest thing on the field", async () => {
  // 🎇 the Sparkler's entire mechanic is that YOU choose where it dies, so the
  // player has to pick it out of a crowd early. Its first cut did the opposite:
  // rendered on a real board it painted 442 ink pixels against the party
  // backbone Popper's 547 — the faintest body out there — because the ink line
  // that gives every sprite its dark contour was swallowing a small cyan head.
  //
  // The assertion is deliberately a COMPARISON, not a pixel constant. An
  // absolute floor would be an invented threshold (this repo's own swarm bodies
  // are deliberately tiny, so no global minimum is honest); "must out-ink the
  // ordinary crowd body it hides among" is a real property, and it fails on the
  // pre-fix sprite. Same shape as the frame-budget guardrail, which compares
  // against a control measured in the same conditions rather than a constant.
  //
  // Measured by DIFFERENCE against the identical frame with no body, so the
  // floor, the lane, the props and the conveyor all cancel out.
  // A DEDICATED high-DPR page, because the measurement's RESOLUTION is part of
  // the test: the shared context runs at deviceScaleFactor 1, where the whole
  // sprite is ~150 device pixels and the honest margin quantizes down to 13 px —
  // the mutation even read 147 vs 147, two identical numbers, which is what a
  // collapsed measurement looks like. At dpr 3 the same claim has real room.
  const hiCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const hiPage = await hiCtx.newPage();
  await hiPage.goto(baseURL, { waitUntil: "load" });
  await hiPage.evaluate(() => { location.hash = "#td-play"; });
  await hiPage.locator("#screen-td-play").waitFor({ state: "visible" });
  await hiPage.evaluate(() => { window.__TD.newGame(39, { seed: 7 }); });   // the Sparkler's home level
  await hiPage.waitForTimeout(200);
  const out = await hiPage.evaluate(() => {
    const e = window.__TD.engine(), r = window.__TD.render();
    r.resize();
    const cv = document.querySelector("#screen-td-play .td-canvas");
    const g = cv.getContext("2d");
    const ink = (type, dist) => {
      e.state.enemies.length = 0;
      e.state.tick = 300;                       // pin it: sparks + scroll are tick-derived
      r.draw(0);
      const empty = g.getImageData(0, 0, cv.width, cv.height);
      e.state.enemies.push({ id: 7777, type, alive: true, dist, pathIdx: 0, speed: 0.75,
        hp: 120, maxHp: 120, shield: 0, blockedBy: 0, slowUntil: 0, chargeCd: 0, sapCd: 0 });
      e.state.tick = 300;
      r.draw(0);
      const withIt = g.getImageData(0, 0, cv.width, cv.height);
      let n = 0;
      for (let i = 0; i < empty.data.length; i += 4) {
        const d = Math.abs(empty.data[i] - withIt.data[i]) +
                  Math.abs(empty.data[i + 1] - withIt.data[i + 1]) +
                  Math.abs(empty.data[i + 2] - withIt.data[i + 2]);
        if (d > 12) n++;
      }
      return n;
    };
    const D = e.path.total * 0.35;
    return { spark: ink("sparkler", D), popper: ink("popper", D), screw: ink("screw", D) };
  });
  await hiCtx.close();
  // the controls must be non-trivial, or the comparison is vacuous
  assert.ok(out.popper > 100 && out.screw > 100,
    `the control bodies must actually paint (popper ${out.popper}, screw ${out.screw}) or this proves nothing`);
  assert.ok(out.spark > out.popper,
    `🎇 must out-ink the ordinary crowd body it hides among — you have to pick it out to use it ` +
    `(sparkler ${out.spark} px vs popper ${out.popper} px)`);
});

test("🎵 the soundtrack follows the battle you are LOOKING at", async () => {
  // The wake lock has one predicate BECAUSE it once stayed held while you
  // browsed the star tree. The music shipped with none: startMusic() in
  // startLevel, stopMusic() only in stopLoop. So backgrounding the tab —
  // which auto-pauses the battle — left the loop scheduling, throttled by the
  // browser to ~1Hz, i.e. the 190ms march degrades to an arrhythmic drone
  // while you are in another app; and quitting to the fort mid-run played
  // battle music over the menu, with musicCtx() reading a parked run for its
  // build/wave/boss/danger arrangement.
  //
  // PAUSE is deliberately NOT in the predicate: a pause menu sits over a
  // visible battlefield and keeps its music, which is what games do. What
  // stops it is leaving — the tab, or the screen.
  await page.evaluate(() => {
    localStorage.setItem("jon-td-save-v1", JSON.stringify({
      v: 1, stars: {}, difficulty: "normal",
      settings: { sfx: true, music: true, dmgNumbers: false },
    }));
  });
  await page.reload();
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 5 }); });
  await page.waitForTimeout(100);

  const out = await page.evaluate(async () => {
    // Count at the ONE shared primitive, so this measures what is audible
    // rather than what a flag says.
    const A = window.JoshAudio;
    const realTone = A.tone;
    let notes = 0;
    A.tone = function () { notes++; return realTone.apply(this, arguments); };
    A.setMuted(false);
    let hiddenVal = false;
    Object.defineProperty(document, "hidden", { get: () => hiddenVal, configurable: true });
    const setHidden = async (v) => {
      hiddenVal = v;
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((r) => setTimeout(r, 60));
    };
    const sample = async (ms) => { notes = 0; await new Promise((r) => setTimeout(r, ms)); return notes; };

    const res = {};
    res.playing = await sample(900);                 // a live, visible battle plays
    await setHidden(true);
    res.backgrounded = await sample(900);            // …you switched apps: silence
    await setHidden(false);
    res.returned = await sample(900);                // …and back
    location.hash = "#td-home";
    await new Promise((r) => setTimeout(r, 120));
    res.atFort = await sample(900);                  // battle music must not play over the fort
    delete document.hidden;
    A.tone = realTone;
    return res;
  });

  assert.ok(out.playing > 0,
    `a live battle with 🎵 on must play notes (got ${out.playing}) — the rest of this test is vacuous otherwise`);
  assert.equal(out.backgrounded, 0,
    `backgrounding the tab must stop the loop, not throttle it to a drone (got ${out.backgrounded} notes)`);
  assert.ok(out.returned > 0,
    `coming back must resume the march (got ${out.returned} notes)`);
  assert.equal(out.atFort, 0,
    `leaving the battlefield must stop the battle's music (got ${out.atFort} notes over the fort home)`);

  await page.evaluate(() => { window.__TD.resetSave(); });
  await page.reload();
});

test("⏩ fast-forward is remembered between levels, and a junk value cannot freeze the game", async () => {
  // Retapping ⏩ on all 40 levels — and on every restart, and every ▶ Next —
  // is pure friction for a player who likes 2x. Unlike "remember the last
  // tower line" (dropped, because the build menu is already one tap per line)
  // this actually saves taps. It is a PREFERENCE, so it lives in
  // save.settings and the grown-ups reset keeps it.
  await page.evaluate(() => { localStorage.removeItem("jon-td-save-v1"); });
  await page.reload();
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 5 }); });
  await page.locator("#screen-td-play .td-speed").click();

  const after = await page.evaluate(() => ({
    label: document.querySelector("#screen-td-play .td-speed").textContent,
    // read defensively: with the persist removed, NOTHING writes a save at all
    // in this flow, and a raw JSON.parse(null) fails as "cannot read 'settings'"
    // — which sends the next reader hunting a missing save instead of a
    // missing write. The assertion should name the defect.
    saved: (() => {
      const raw = localStorage.getItem("jon-td-save-v1");
      if (!raw) return "no save was written at all";
      return (JSON.parse(raw).settings || {}).speed;
    })(),
  }));
  assert.equal(after.label, "2×", "tapping ⏩ steps the speed");
  assert.equal(after.saved, 2, "…and the choice is persisted, or nothing can restore it");

  // The half that matters: a DIFFERENT level must come up already at 2x. The
  // label is rendered FROM cur.speed at level start, so reading it proves the
  // engine's own value, not just the caption.
  await page.evaluate(() => { window.__TD.newGame(2, { seed: 5 }); });
  assert.equal(await page.locator("#screen-td-play .td-speed").textContent(), "2×",
    "a new level must come up at the speed you chose");

  // CLAMPED, because it is a number and the frame loop multiplies by it. 99x
  // is unplayable and 0 would freeze the battle for ever; a restored backup or
  // a hand-edited save must degrade to 1x, never disable the game.
  for (const junk of [0, 99, -3, "fast", null]) {
    await page.evaluate((v) => {
      const s = JSON.parse(localStorage.getItem("jon-td-save-v1"));
      s.settings.speed = v;
      localStorage.setItem("jon-td-save-v1", JSON.stringify(s));
    }, junk);
    await page.reload();
    await page.evaluate(() => { location.hash = "#td-play"; });
    await page.locator("#screen-td-play").waitFor({ state: "visible" });
    await page.evaluate(() => { window.__TD.newGame(1, { seed: 5 }); });
    assert.equal(await page.locator("#screen-td-play .td-speed").textContent(), "1×",
      `a saved speed of ${JSON.stringify(junk)} must degrade to 1× — the frame loop multiplies by this`);
  }

  await page.evaluate(() => { window.__TD.resetSave(); });
  await page.reload();
});

test("the ⬆ button says what it BUYS, not just what it costs", async () => {
  // Upgrading is the most frequent decision in the game after placement, and
  // the panel showed a price and nothing else — while the tier-3 branch cards
  // beside it have always stated their move (road 12%→28%). Same information
  // problem the % road figure fixed for placement, one decision over.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const pad = await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 42 });
    window.__TD.grantGold(5000);
    const p = window.__TD.engine().levelDef.pads[0];
    window.__TD.engine().place("dart", p.id);
    return p;
  });
  const rect = await page.locator("#screen-td-play .td-canvas").boundingBox();
  const sp = await page.evaluate((p) => window.__TD.w2s(p.cx + 0.5, p.cy + 0.5), pad);
  await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  await page.locator(".td-panel").waitFor({ state: "visible" });

  const read = await page.evaluate(() => {
    const e = window.__TD.engine();
    const t = e.state.towers[0];
    const now = e.towerStats(t.id);
    const next = e.towerStats(t.id, t.tier + 1);
    return {
      tier: t.tier,
      cur: (document.querySelector(".td-panel__stats") || {}).textContent || "",
      nxt: (document.querySelector(".td-panel__next") || {}).textContent || "",
      curDps: (now.dmg / now.rate).toFixed(0),
      nextDps: (next.dmg / next.rate).toFixed(0),
    };
  });
  assert.equal(read.tier, 1, "the fixture must open a tier-1 tower, or there is nothing to preview");
  assert.ok(read.nxt, "a tier-1 tower must preview what its ⬆ buys");

  // It must be the ENGINE's next-tier number, not a re-derivation from DATA —
  // the defect that made this panel print 110 while the engine charged 99.
  assert.ok(read.nxt.includes(read.nextDps + " dps"),
    `the preview must state the engine's tier-2 dps (${read.nextDps}), saw "${read.nxt}"`);
  // …and the partner clause, or the one above is satisfied by simply repeating
  // the current line: the number has to MOVE.
  assert.notEqual(read.nextDps, read.curDps,
    "tier 2 must differ from tier 1, or this test cannot tell a preview from a copy");
  assert.ok(!read.cur.includes(read.nextDps + " dps"),
    `the CURRENT line must still read tier 1 (${read.curDps} dps), saw "${read.cur}"`);

  // The extra line must not push the panel past the fold — this panel is the
  // one a third branch row was measured against and rejected for (+111px, past
  // the fold at 320x480, 320x568 AND landscape).
  const spill = [];
  for (const vp of [{ width: 320, height: 480 }, { width: 320, height: 568 },
                    { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(vp);
    await page.evaluate(() => { window.__TD.newGame(1, { seed: 42 }); window.__TD.grantGold(5000); });
    await page.evaluate((p) => { window.__TD.engine().place("dart", p.id); }, pad);
    const r2 = await page.locator("#screen-td-play .td-canvas").boundingBox();
    const s2 = await page.evaluate((p) => window.__TD.w2s(p.cx + 0.5, p.cy + 0.5), pad);
    await page.mouse.click(r2.x + s2.x, r2.y + s2.y);
    await page.waitForTimeout(60);
    const box = await page.evaluate(() => {
      const b = document.querySelector(".td-bubble");
      if (!b || b.hidden) return null;
      const r = b.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
    });
    if (!box) { spill.push(`${vp.width}x${vp.height}: the panel never opened`); continue; }
    if (box.top < 0 || box.bottom > vp.height + 1) spill.push(`${vp.width}x${vp.height}: ${box.top}..${box.bottom} vs ${vp.height} tall`);
    if (box.left < 0 || box.right > vp.width + 1) spill.push(`${vp.width}x${vp.height}: ${box.left}..${box.right} vs ${vp.width} wide`);
  }
  assert.deepEqual(spill, [], "the upgrade preview must not push the panel off screen:\n" + spill.join("\n"));
  // A tier-3 tower has branches instead, and must NOT offer an upgrade preview.
  // Back to a known viewport first: the fold loop above left the last one, and
  // the pad's screen position moves with it.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 42 }); });
  await page.waitForTimeout(60);
  const rect3 = await page.locator("#screen-td-play .td-canvas").boundingBox();
  const sp3 = await page.evaluate((p) => window.__TD.w2s(p.cx + 0.5, p.cy + 0.5), pad);
  await page.evaluate((p) => {
    const e = window.__TD.engine();
    window.__TD.grantGold(5000);
    if (!e.state.towers.length) e.place("dart", p.id);
    const t = e.state.towers[0];
    e.upgrade(t.id); e.upgrade(t.id);
  }, pad);
  await page.mouse.click(rect3.x + sp3.x, rect3.y + sp3.y);
  await page.locator(".td-panel").waitFor({ state: "visible" });
  const atThree = await page.evaluate(() => ({
    tier: window.__TD.engine().state.towers[0].tier,
    nxt: document.querySelector(".td-panel__next"),
  }));
  assert.equal(atThree.tier, 3, "the fixture must have reached tier 3");
  assert.equal(atThree.nxt, null, "a tier-3 panel offers branches, not an upgrade preview");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.TDUI.hideBubble());
});

test("the guide RENDERS every aiming mode, not just declares them", async () => {
  // A structural scan proves the table exists; only opening the guide proves
  // the render loop puts it on the page. This repo has shipped that gap three
  // times (the gimmick list, the powers row, the branch roles).
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.locator("#screen-td-home .td-guide-open").click();
  await page.waitForTimeout(120);
  const seen = await page.evaluate(() => {
    const box = document.querySelector(".td-overlay");
    const T = window.TDData.TARGETING || {};
    const names = {}; for (const k of Object.keys(T)) names[k] = T[k].name || k;
    return { text: box ? box.textContent : "", modes: Object.keys(T), names };
  });
  assert.ok(seen.modes.length >= 4, `expected the mode table, saw ${seen.modes.length}`);
  assert.match(seen.text, /Aiming/, "the guide must carry an Aiming section");
  for (const m of seen.modes) {
    assert.ok(seen.text.includes(seen.names[m]), `the guide never renders the "${m}" aiming mode`);
  }
  const missing = await page.evaluate(() => {
    const t = document.querySelector(".td-overlay").textContent;
    return Object.entries(window.TDData.TARGETING).filter(([, d]) => !t.includes(d.desc.slice(0, 30))).map(([m]) => m);
  });
  assert.deepEqual(missing, [], `the guide renders these modes' NAMES but not their descriptions: ${missing.join(", ")}`);

  // An AIMED power must also say how big it is. The rows already stated cost,
  // ⚙️, cooldown and where to tap, and left out the number that decides WHERE —
  // aiming a 130🪙 blast by eye is a guess. Derived, so a sixth power with a
  // radius inherits the requirement.
  const sized = await page.evaluate(() => {
    const t = document.querySelector(".td-overlay").textContent;
    const withR = (window.TDData.ABILITIES || []).filter((a) => a.radius);
    return { n: withR.length, silent: withR.filter((a) => !t.includes(a.radius + " cells wide")).map((a) => a.id) };
  });
  assert.ok(sized.n >= 2, `expected several aimed powers to have a radius, saw ${sized.n}`);
  assert.deepEqual(sized.silent, [], `these powers never state their blast size: ${sized.silent.join(", ")}`);
  await page.evaluate(() => window.TDUI.closeOverlay());
});

test("no dialog line is HALF-covered by the ✕", async () => {
  // The sticky ✕ shipped as a bare circle riding the box's right edge, so every
  // line that scrolled past it lost its right end. Measured across the nine
  // fort dialogs it covered real content in FIVE — including a star-tree node's
  // ⭐ cost, which is the number you decide with, and the reset dialog's own
  // title. It lives in a full-width opaque strip now, which turns that into
  // ordinary scrolling: a line is either visible or fully behind the header,
  // never eaten from one side.
  //
  // The property is exactly that, and it is measured by OCCLUSION rather than
  // geometry: a text rect always reports its box whether or not something is
  // painted over it, so the test asks elementFromPoint along each line. Some
  // points reaching the text and others reaching the close control means the
  // line is half-covered — the defect. All points reaching the header is fine.
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const openers = await page.evaluate(() =>
    document.querySelectorAll("#screen-td-home .td-metabtn, #screen-td-home .td-adminrow button").length);
  assert.ok(openers >= 7, `expected the fort's dialogs, found ${openers} openers`);

  const bad = [];
  let scrolled = 0;
  for (let i = 0; i < openers; i++) {
    const label = await page.evaluate((k) => {
      const b = [...document.querySelectorAll("#screen-td-home .td-metabtn, #screen-td-home .td-adminrow button")][k];
      b.click(); return b.textContent.trim().slice(0, 16);
    }, i);
    await page.waitForTimeout(140);
    const r = await page.evaluate(() => {
      const box = document.querySelector(".td-overlay__box");
      const strip = document.querySelector(".td-overlay__top");
      const x = document.querySelector(".td-overlay__x") || (strip && strip.querySelector("button"));
      if (!box || !x) return { noX: true };
      if (!strip || !strip.contains(x)) return { noStrip: true };
      // the strip must span the box's CONTENT width, or "fully hidden" is not
      // the only possible outcome and a line can still be eaten from one side
      const br = box.getBoundingClientRect(), sr = strip.getBoundingClientRect();
      const bw = parseFloat(getComputedStyle(box).borderLeftWidth) || 0;
      const spans = sr.left <= br.left + bw + 1 && sr.right >= br.right - bw - 1;
      const max = Math.max(0, box.scrollHeight - box.clientHeight);
      let half = null;
      for (let s = 0; s <= 10; s++) {
        box.scrollTop = (max * s) / 10;
        const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
        let t;
        while ((t = w.nextNode())) {
          if (!t.textContent.trim() || strip.contains(t.parentNode)) continue;
          const rg = document.createRange(); rg.selectNodeContents(t);
          for (const q of rg.getClientRects()) {
            if (q.height < 6 || q.width < 12) continue;
            if (q.bottom < br.top || q.top > br.bottom) continue;
            const y = q.top + q.height / 2;
            let onText = 0, onChrome = 0;
            for (let k = 0; k <= 10; k++) {
              const el = document.elementFromPoint(q.left + (q.width * k) / 10, y);
              if (!el) continue;
              if (el === x || strip.contains(el)) onChrome++;
              else if (el.contains(t) || el === t.parentNode) onText++;
            }
            if (onText > 0 && onChrome > 0) half = { text: t.textContent.trim().slice(0, 34), onText, onChrome };
          }
        }
      }
      box.scrollTop = 0;
      return { spans, half, scrollable: max > 0 };
    });
    if (r.noX) bad.push(`${label}: no ✕ at all`);
    else if (r.noStrip) bad.push(`${label}: the ✕ is not in a strip — a bare circle eats the end of every line it passes`);
    else {
      if (!r.spans) bad.push(`${label}: the strip does not span the box, so a line can still be half-covered`);
      if (r.half) bad.push(`${label}: "${r.half.text}" is HALF-covered (${r.half.onText} pts visible, ${r.half.onChrome} under the ✕)`);
      if (r.scrollable) scrolled++;
    }
    await page.evaluate(() => { const c = document.querySelector(".td-overlay__top button"); if (c) c.click(); else window.TDUI.closeOverlay(); });
    await page.waitForTimeout(70);
  }
  // the defect FIRST: a missing strip also zeroes `scrolled` (the probe returns
  // early), and the count clause would then fire with a message about scrolling
  // that sends the reader somewhere else entirely.
  assert.deepEqual(bad, [], "the ✕ must never eat part of a line:\n" + bad.join("\n"));
  assert.ok(scrolled >= 3, `at least a few fort dialogs must actually scroll, or this proves nothing (${scrolled})`);
});

test("QoL: a new tower opens on the aim you LAST chose for that line", async () => {
  // Every remembered preference in the fort persists — ⏩ speed, sounds, music,
  // damage numbers, the difficulty chip, the 🎒 pack, the ⭐ loadout, the 🎖️
  // chips — except the one lever `AUDIT targeting is a LIVE lever` measures at
  // 4-9 lives on a boss finale, which reset to the line default on every tower
  // of every level. That is the ⏩ speed defect's exact shape ("a 2× player
  // retapped on all 40 levels"), multiplied by 10-14 towers.
  //
  // Both halves MUST go through real taps: __TD.script(["place", …]) calls the
  // engine directly and so skips the UI handler that applies this, which is the
  // documented "a hook that stands in for the main loop does not reproduce its
  // side effects" trap — here the correct behaviour, since the claim is about
  // the build BUTTON.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => window.__TD.resetSave());
  const start = async () => {
    await page.evaluate(() => window.__TD.newGame(5, { seed: 3 }));
    await page.evaluate(() => { location.hash = "#__renav"; });
    await page.waitForTimeout(40);
    await page.evaluate(() => { location.hash = "#td-play"; });
    await page.waitForTimeout(300);
    // Gold enough for several towers, WITHOUT __TD.grantGold — that marks the
    // run cheated, and a cheated run is a different code path.
    await page.evaluate(() => { window.__TD.state().gold = 4000; });
  };
  await start();
  const rect = await page.locator("#screen-td-play .td-canvas").boundingBox();
  const tapPad = async (i) => {
    const sp = await page.evaluate((n) => {
      const p = window.TDData.LEVELS.find((l) => l.id === 5).pads[n];
      return window.__TD.w2s(p.cx + 0.5, p.cy + 0.5);
    }, i);
    await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
    await page.waitForTimeout(220);
  };
  const build = async (i, line) => {
    await tapPad(i);
    await page.locator('#screen-td-play .td-bubble .td-buy[data-line="' + line + '"]').click();
    await page.waitForTimeout(220);
  };
  const aimOf = (padId) => page.evaluate((pid) => {
    const t = window.__TD.state().towers.find((x) => x.padId === pid);
    return t ? t.targeting : null;
  }, padId);
  const padIds = await page.evaluate(() =>
    window.TDData.LEVELS.find((l) => l.id === 5).pads.slice(0, 4).map((p) => p.id));

  // 1. First dart: the line's own default, because nothing is remembered yet.
  await build(0, "dart");
  assert.equal(await aimOf(padIds[0]), "first",
    "fixture: a dart opens on its declared default when nothing has been chosen");

  // 2. Choose a different mode by hand — two taps of 🎯 walks first → last → strong.
  await tapPad(0);
  const target = page.locator("#screen-td-play .td-bubble .td-target");
  await target.click();
  await page.waitForTimeout(120);
  await target.click();
  await page.waitForTimeout(160);
  assert.equal(await aimOf(padIds[0]), "strong", "fixture: two 🎯 taps reach `strong`");
  // …and it must reach STORAGE, or it is forgotten between sessions. Read it HERE,
  // immediately after the choice: `save` is one shared object, so by the end of a
  // run any other persist() has flushed it and a late read passes with the write
  // at this site deleted — a clause that cannot fail. Nothing else persists during
  // a build phase, so this is the one moment that isolates it.
  const stored = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem("jon-td-save-v1")); } catch (e) { return null; }
  });
  assert.equal(stored && stored.settings && stored.settings.aim && stored.settings.aim.dart, "strong",
    "choosing an aim must be PERSISTED at once, not left in memory for something else to flush");
  await page.evaluate(() => { location.hash = "#__renav"; });   // dismiss the panel without another field tap
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.waitForTimeout(120);

  // 3. THE CLAIM: the next dart opens already aimed.
  await build(1, "dart");
  assert.equal(await aimOf(padIds[1]), "strong",
    "a new tower must open on the aim you last chose for that line");

  // 4. CONTROL: the memory is PER LINE. The Mortar declares `strong` itself, so
  //    a control against it would be indistinguishable — set the dart to `last`
  //    first, then a mortar must still open on its OWN default.
  await tapPad(1);
  await page.locator("#screen-td-play .td-bubble .td-target").click();  // strong → close
  await page.waitForTimeout(120);
  await page.locator("#screen-td-play .td-bubble .td-target").click();  // close → first
  await page.waitForTimeout(120);
  await page.locator("#screen-td-play .td-bubble .td-target").click();  // first → last
  await page.waitForTimeout(160);
  assert.equal(await aimOf(padIds[1]), "last", "fixture: three more 🎯 taps reach `last`");
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.waitForTimeout(120);
  await build(2, "mortar");
  assert.equal(await aimOf(padIds[2]), "strong",
    "the memory is PER LINE — a mortar must keep its own declared default, not the dart's");

  // 5. It is a PREFERENCE, so it survives starting the level again — the whole
  //    point (the ⏩ speed lesson: "and on every restart").
  await start();
  await build(0, "dart");
  assert.equal(await aimOf(padIds[0]), "last",
    "the remembered aim must survive a restart, or it is re-set every level anyway");

  // 6. DEGRADE, NOT DISABLE. `cheap` is unlocked by the 🔻 Weak Spot node, so a
  //    mode remembered before a respec is one this run is not allowed. It must be
  //    refused and the line's own default must stand — which holds only because
  //    the memory is applied through the engine's setTargeting rather than by
  //    assigning t.targeting, and that is the single reason this clause exists.
  // Seeded through STORAGE + a reload, which is also the only honest way to make
  // this state: `cheap` needs the node owned, and reaching it any other way would
  // be a hand-built fixture. Reload, never goto(url + "#hash") — that is a
  // same-document navigation and would never re-run module init, so the seed
  // would be invisible (the documented footgun).
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    raw.settings.aim = { dart: "cheap" };
    raw.midRun = null;   // a parked run bounces #td-play straight back to the fort home
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__TD, null, { timeout: 8000 });
  const reseeded = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    return raw.settings && raw.settings.aim && raw.settings.aim.dart;
  });
  assert.equal(reseeded, "cheap", "fixture: the seeded aim must survive the reload, or this clause is vacuous");
  // The reload keeps the hash, so re-setting it to #td-play is a SAME-HASH no-op:
  // no hashchange, no route(), and the screen stays hidden. Hop first.
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible", timeout: 8000 });
  await start();
  await build(0, "dart");
  assert.equal(await aimOf(padIds[0]), "first",
    "an aim this run has not unlocked must be refused, leaving the line's own default");
});

test("QoL: the level grid names its worlds and says where stars are left", async () => {
  // 40 cards in a flat 3-wide run, told apart only by a background tint — so the
  // ten worlds this game gives their own floor, road, crowd and boss are unnamed
  // on the one screen where a level is chosen, and finding a world to farm stars
  // in is a scroll-and-squint. Everything here is DERIVED (the boundary from the
  // levels' own `world`, the name from DATA.WORLDS, the count from the SELECTED
  // ladder), so an eleventh world needs no code and no test edit.
  const openHome = async () => {
    await page.evaluate(() => { location.hash = "#__renav"; });  // a same-hash set is a no-op: route() would never fire
    await page.waitForTimeout(40);
    await page.evaluate(() => { location.hash = "#td-home"; });
    await page.locator("#screen-td-home .td-level").first().waitFor({ state: "visible", timeout: 8000 });
    await page.waitForTimeout(80);
  };
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => window.__TD.resetSave());
  await openHome();

  const read = () => page.evaluate(() => {
    const grid = document.querySelector("#screen-td-home .td-levels");
    return [...grid.children].map((el) => ({
      head: el.classList.contains("td-worldhead"),
      world: el.dataset.world || "",
      text: (el.textContent || "").trim(),
      tag: el.tagName,
      focusable: el.tagName === "BUTTON" || el.hasAttribute("tabindex"),
      pe: getComputedStyle(el).pointerEvents,
      w: Math.round(el.getBoundingClientRect().width),
    }));
  });
  const expected = await page.evaluate(() => {
    const L = window.TDData.LEVELS, out = [];
    let last = null;
    for (const l of L) { if (l.world !== last) { last = l.world; out.push(l.world); } }
    return { order: out, labels: Object.fromEntries(out.map((w) => [w, window.TDData.WORLDS[w].label])),
      sizes: Object.fromEntries(out.map((w) => [w, L.filter((x) => x.world === w).length])) };
  });

  let rows = await read();
  const heads = rows.filter((r) => r.head);
  assert.ok(expected.order.length >= 8, `fixture: the campaign must really have several worlds (${expected.order.length})`);
  assert.deepEqual(heads.map((h) => h.world), expected.order,
    "every world gets exactly one heading, in campaign order");
  // Each heading must sit immediately BEFORE its world's first card — a heading
  // in the right order but the wrong place is still a mislabelled section.
  for (const w of expected.order) {
    // Assert the POSITION, not "the next thing is also this world": a heading
    // appended AFTER its world's first card still has a same-world card next to
    // it, so the weaker form passed that mutation. It must sit one slot before
    // the world's FIRST card, which is the only place that labels all of them.
    const i = rows.findIndex((r) => r.head && r.world === w);
    const firstCard = rows.findIndex((r) => !r.head && r.world === w);
    assert.equal(i, firstCard - 1,
      `the ${w} heading must sit immediately before that world's FIRST card (head ${i}, first card ${firstCard})`);
    assert.ok(heads.find((h) => h.world === w).text.includes(expected.labels[w].replace(/^\S+\s*/, "")),
      `the ${w} heading must carry the world's own declared name`);
  }
  // Not a control: no tap target, nothing to focus, and the ≥44px adult law has
  // nothing to say about it.
  for (const h of heads) {
    assert.equal(h.tag, "DIV", "a world heading is not a button");
    assert.ok(!h.focusable, "a world heading must not be focusable");
    assert.equal(h.pe, "none", "a world heading must not eat taps meant for the grid");
  }
  // Full-width: it is a section break, not another card in the row. Asserted
  // against the GRID's own width rather than a multiple of a card, so it stays
  // true whatever the column count is (it was a card multiple, and went red the
  // day the grid became two columns — a proxy that tracked the property only at
  // the column count it was written under).
  const gridW = await page.evaluate(() =>
    Math.round(document.querySelector("#screen-td-home .td-levels").getBoundingClientRect().width));
  const cardW = rows.find((r) => !r.head).w;
  assert.ok(heads[0].w >= gridW - 4 && heads[0].w > cardW + 8,
    `a world heading must span the whole grid, not sit in one column (${heads[0].w}px of a ${gridW}px grid, card ${cardW}px)`);

  // The ⭐ count is the actionable half, and it reads the SELECTED ladder.
  const first = expected.order[0];
  const perWorld = expected.sizes[first] * 3;
  assert.match(heads[0].text, new RegExp("⭐\\s*0/" + perWorld),
    `a fresh save must show no stars earned in the first world (saw "${heads[0].text}")`);
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    raw.stars = { casual: {}, normal: { "1": 3, "2": 2 }, heroic: {} };
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__TD, null, { timeout: 8000 });
  await openHome();
  rows = await read();
  assert.match(rows.find((r) => r.head).text, new RegExp("⭐\\s*5/" + perWorld),
    "the heading counts the stars actually earned in that world");
  // …on the ladder the chips select. The seed above is on NORMAL only, so
  // switching to Hard must read zero — a count that ignored the ladder would
  // still say 5 and would be lying on two of the three ladders.
  await page.locator('#screen-td-home .td-diffbtn[data-diff="heroic"]').click();
  await page.waitForTimeout(120);
  rows = await read();
  assert.match(rows.find((r) => r.head).text, new RegExp("⭐\\s*0/" + perWorld),
    "the heading must count the SELECTED difficulty's ladder, not always normal");
  await page.locator('#screen-td-home .td-diffbtn[data-diff="normal"]').click();
  await page.waitForTimeout(120);

  // Adding content to this grid has broken a layout twice before, so measure it
  // rather than assume: no page overflow at the narrowest phone or at 390.
  for (const w of [320, 390]) {
    await page.setViewportSize({ width: w, height: 640 });
    await page.waitForTimeout(120);
    const over = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      vw: document.documentElement.clientWidth,
    }));
    assert.ok(over.doc <= over.vw + 1,
      `the fort home must not scroll sideways at ${w}px (${over.doc} > ${over.vw})`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(80);
});

test("QoL: Restart level asks first — it throws a live board away, exactly like leaving", async () => {
  // The pause menu's two destructive buttons shipped with opposite policies:
  // 🏰 Back to the fort routed through UI.confirm, while 🔁 Restart level — the
  // row DIRECTLY BELOW ▶ Resume, the button you press most — tore the board
  // down on a single tap with no undo. Restarting is if anything the worse of
  // the two: leaving at least keeps the last wave-boundary checkpoint.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 3 });
    const L = window.TDData.LEVELS.find((l) => l.id === 1);
    window.__TD.script(L.pads.slice(0, 3).map((p) => ["place", "dart", p.id]).concat([["call"], ["tick", 60]]));
  });
  await page.evaluate(() => { location.hash = "#__renav"; });   // same-hash set is a no-op — hop to re-fire route() and unpause
  await page.waitForTimeout(60);
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.waitForTimeout(200);

  const look = () => page.evaluate(() => {
    const s = window.__TD.state();
    return { towers: s.towers.length, phase: s.phase, tick: s.tick, wave: s.waveIdx };
  });
  const before = await look();
  assert.equal(before.towers, 3, "fixture: a real board exists");
  assert.equal(before.phase, "wave", "fixture: a wave is walking, so the run is genuinely live");

  const openPauseAndRestart = async () => {
    await page.locator("#screen-td-play .td-pause").click();
    await page.locator('.td-overlay [data-act="restart"]').waitFor({ state: "visible", timeout: 5000 });
    await page.locator('.td-overlay [data-act="restart"]').click();
    await page.waitForTimeout(200);
  };

  // 1. It must ASK, and say what it is about to do — the copy is restart's own,
  //    not the leave dialog's, or the player is told the wrong thing.
  await openPauseAndRestart();
  const dlg = await page.evaluate(() => {
    const el = document.querySelector(".td-overlay--confirm");
    if (!el) return null;
    return { title: (el.querySelector("h3") || {}).textContent || "",
      yes: (el.querySelector('[data-act="yes"]') || {}).textContent || "",
      no: (el.querySelector('[data-act="no"]') || {}).textContent || "" };
  });
  assert.ok(dlg, "restarting a live level must confirm first, like leaving does");
  assert.match(dlg.title, /over\?/i, `the dialog must say it is a RESTART, not a leave (saw "${dlg.title}")`);
  assert.match(dlg.yes, /restart/i, "the destructive button names the action");
  assert.match(dlg.no, /keep playing/i, "and the safe choice is the prominent one");
  const mid = await look();
  assert.equal(mid.towers, 3, "the board must still be there while you decide");

  // 2. Keep playing keeps the SAME board — and un-pauses, exactly as the leave
  //    dialog does (they share one owner, so this pins that behaviour too).
  await page.locator('.td-overlay--confirm [data-act="no"]').click();
  await page.waitForTimeout(120);
  const kept = await look();
  assert.equal(kept.towers, 3, "keep-playing must not touch the board");
  assert.equal(kept.wave, before.wave, "keep-playing must not rewind the run");
  await page.waitForTimeout(350);
  const moved = await look();
  assert.ok(moved.tick > kept.tick,
    `keep-playing must resume the battle, not leave it frozen (tick ${kept.tick} → ${moved.tick})`);

  // 3. …and confirming really does restart.
  await openPauseAndRestart();
  await page.locator('.td-overlay--confirm [data-act="yes"]').click();
  await page.waitForTimeout(300);
  const after = await look();
  assert.equal(after.towers, 0, "confirming restarts: a fresh, empty board");
  assert.equal(after.phase, "build", "…back in the build phase");
});

test("QoL: a run's label says which RULES it is under, and keeps them while parked", async () => {
  // The pause menu and the resume banner share one label, and it named only the
  // level — so picking a parked run back up without knowing which ladder it is
  // on, or that you armed ⛺ Camp's Closed, was a decision made blind.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => {
    window.__TD.resetSave();
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    raw.difficulty = "heroic";
    raw.chipsArmed = ["nocamp"];
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__TD, null, { timeout: 8000 });
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home .td-level").first().waitFor({ state: "visible", timeout: 8000 });

  // Start L1 through the real card, so the run picks up the armed chip and the
  // selected ladder exactly as a player's tap would.
  await page.locator("#screen-td-home .td-level").first().click();
  await page.locator("#screen-td-play").waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(250);
  const runRules = await page.evaluate(() => {
    const s = window.__TD.state();
    return { difficulty: s.difficulty, chips: (s.chips || []).slice() };
  });
  assert.equal(runRules.difficulty, "heroic", "fixture: the run really is on the hard ladder");
  assert.deepEqual(runRules.chips, ["nocamp"], "fixture: the run really carries the armed chip");

  // 1. The pause menu names them.
  await page.locator("#screen-td-play .td-pause").click();
  await page.locator(".td-overlay--pause").waitFor({ state: "visible", timeout: 5000 });
  const pauseLabel = await page.evaluate(() =>
    (document.querySelector(".td-overlay--pause .td-pause__where") || {}).textContent || "");
  assert.match(pauseLabel, /💀/, `the pause label must name the ladder (saw "${pauseLabel}")`);
  assert.match(pauseLabel, /⛺/, `…and any armed challenge (saw "${pauseLabel}")`);
  assert.match(pauseLabel, /Level 1/, "…without losing which level it is");

  // 2. Park it, and the resume banner says the same thing — it is the one place
  //    the decision "do I pick this up?" is actually made.
  await page.locator('.td-overlay--pause [data-act="quit"]').click();
  await page.locator(".td-overlay--confirm").waitFor({ state: "visible", timeout: 5000 });
  await page.locator('.td-overlay--confirm [data-act="yes"]').click();
  await page.locator("#screen-td-home").waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(200);
  const bannerOf = () => page.evaluate(() => {
    const el = document.querySelector("#screen-td-home .td-resume");
    return el && !el.hidden ? (el.querySelector(".td-resume__txt") || {}).textContent || "" : null;
  });
  const banner = await bannerOf();
  assert.ok(banner, "fixture: leaving a build-phase run parks a checkpoint");
  assert.match(banner, /💀/, `the resume banner must name the parked run's ladder (saw "${banner}")`);
  assert.match(banner, /⛺/, `…and its challenge (saw "${banner}")`);

  // 3. THE CHECKPOINT-FIDELITY CLAUSE: changing the chips and the ladder while a
  //    run is parked must NOT relabel it. The label reads the RUN's own copies,
  //    never the save — the same law that keeps a respec from rewriting a parked
  //    run's rules.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    raw.difficulty = "casual"; raw.chipsArmed = [];
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__TD, null, { timeout: 8000 });
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home .td-level").first().waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(150);
  const parked = await bannerOf();
  assert.match(parked, /💀/,
    `a ladder switched while a run is parked must not relabel that run (saw "${parked}")`);
  assert.match(parked, /⛺/, "…nor may disarming its challenge");

  // 4. The difficulty CHIPS derive from the data, so a fourth tier needs no code
  //    here. Self-proving: inject one and the row must grow.
  const before = await page.locator("#screen-td-home .td-diffbtn").count();
  await page.evaluate(() => {
    window.TDData.DIFFICULTIES.__probe = { label: "🔥 Probe", hp: 1, speed: 1, bounty: 1, startGold: 0 };
    location.hash = "#__renav";
  });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.waitForTimeout(200);
  const after = await page.locator("#screen-td-home .td-diffbtn").count();
  // Read the LABEL text node, not the whole button: the chip now carries a
  // second line with that ladder's progress, and this clause's claim is about
  // the NAME the tier declares, not about everything printed on the control.
  const probeTxt = await page.evaluate(() => {
    const b = document.querySelector('#screen-td-home .td-diffbtn[data-diff="__probe"]');
    return b && b.firstChild ? b.firstChild.textContent : "";
  });
  await page.evaluate(() => { delete window.TDData.DIFFICULTIES.__probe; });
  assert.equal(after, before + 1, `the difficulty row must DERIVE from the data (${before} → ${after})`);
  assert.equal(probeTxt, "🔥 Probe", "…and take each tier's own declared name");

  // 5. The label grew, and this fort has spilled a dialog off a real phone twice
  //    because iOS renders emoji wider than headless Chromium. It must WRAP.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(150);
  const fits = await page.evaluate(() => {
    const el = document.querySelector("#screen-td-home .td-resume__txt");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { right: Math.round(r.right), vw: document.documentElement.clientWidth,
      wrap: getComputedStyle(el).whiteSpace };
  });
  assert.ok(fits && fits.right <= fits.vw + 1,
    `the resume label must stay on screen at 320px (${fits && fits.right} > ${fits && fits.vw})`);
  assert.ok(fits.wrap !== "nowrap", "…and it must be allowed to wrap rather than spill");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.__TD.resetSave());
  await page.waitForTimeout(80);
});

test("QoL: the fort's meta row marks what is ARMED and what is WAITING", async () => {
  // ⭐ already badged unspent stars. Two of the other six buttons carry state a
  // player acts on and said nothing: a challenge chip armed BEFORE a run changes
  // that run's rules (arming one and forgetting is a real confusion), and the
  // Daily is one puzzle per calendar day, so "today's is unplayed" is the whole
  // reason to open it. The other four stay bare on purpose.
  const openHome = async () => {
    await page.evaluate(() => { location.hash = "#__renav"; });
    await page.waitForTimeout(40);
    await page.evaluate(() => { location.hash = "#td-home"; });
    await page.locator("#screen-td-home .td-level").first().waitFor({ state: "visible", timeout: 8000 });
    await page.waitForTimeout(80);
  };
  const badges = () => page.evaluate(() => {
    const out = {};
    for (const sel of ["tree", "chips", "daily", "powers", "ach", "endless", "guide"]) {
      const b = document.querySelector("#screen-td-home .td-" + sel + "-open");
      const n = b && b.querySelector(".td-metabtn__n");
      out[sel] = n ? { n: n.textContent, aria: b.getAttribute("aria-label") || "" } : null;
    }
    return out;
  });

  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => window.__TD.resetSave());
  await openHome();

  // 1. A fresh save: nothing to spend, nothing armed, today untouched.
  let b = await badges();
  assert.equal(b.tree, null, "a fresh save has no stars to spend, so no ⭐ badge");
  assert.equal(b.chips, null, "nothing armed, so no 🎖️ badge");
  assert.ok(b.daily, "today's Daily is unplayed on a fresh save, so it is marked");
  assert.match(b.daily.aria, /unplayed/i, "…and the accessible name says so (a title is hover-only on a phone)");
  // Deliberately bare — recorded so nobody completes the set with decoration.
  for (const k of ["powers", "ach", "endless", "guide"]) {
    assert.equal(b[k], null, `${k} carries nothing a player can act on, so it must stay bare`);
  }

  // 2. Arm a chip: the badge appears, counts, and drops a retired id.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    raw.chipsArmed = ["nocamp", "nofan", "__retired"];
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__TD, null, { timeout: 8000 });
  await openHome();
  b = await badges();
  assert.ok(b.chips, "an armed challenge must be visible from the fort home");
  assert.equal(b.chips.n, "2",
    "the count resolves ids through the data, so a retired chip simply drops out");
  assert.match(b.chips.aria, /armed/i, "…and the accessible name carries the count");

  // 3. Play today's Daily and the badge goes away rather than nagging.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    const d = new Date();
    raw.daily = { day: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0"), best: 4, allTime: 4 };
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__TD, null, { timeout: 8000 });
  await openHome();
  b = await badges();
  assert.equal(b.daily, null, "once today's Daily is recorded the badge clears");
  assert.ok(b.chips, "…and clearing one badge must not clear another");

  // 4. Stars still work — the owner grew, it did not move.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    raw.stars = { casual: {}, normal: { "1": 3, "2": 3 }, heroic: {} };
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__TD, null, { timeout: 8000 });
  await openHome();
  b = await badges();
  assert.equal(b.tree && b.tree.n, "6", "six unspent stars, still badged on ⭐");
  await page.evaluate(() => window.__TD.resetSave());
  await page.waitForTimeout(60);
});

test("QoL: the next-wave preview stays up while ⏩ RUSH is on offer", async () => {
  // The preview was build-phase only. TD-15 then made CALL work mid-wave as
  // RUSH — it drops the NEXT wave on top of the one already walking, for the
  // same early-call gold — so the one decision whose entire cost/benefit is
  // "what is in the next wave" was made with the thing that says so switched
  // off. Same law as the ⬆ upgrade preview and the % road figure: the
  // information belongs at the moment of the decision.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.newGame(9, { seed: 3 }); });
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(50);
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.waitForTimeout(250);

  const look = () => page.evaluate(() => {
    const nw = document.querySelector("#screen-td-play .td-nextwave");
    const call = document.querySelector("#screen-td-play .td-call");
    const s = window.__TD.state();
    return { shown: !!(nw && !nw.hidden), text: nw ? nw.textContent : "",
      callOff: !!(call && call.disabled), phase: s.phase,
      wave: s.waveIdx, sent: s.sentIdx == null ? s.waveIdx : s.sentIdx };
  });

  // 1. Build phase: unchanged.
  let r = await look();
  assert.equal(r.phase, "build", "fixture: a fresh level opens in the build phase");
  assert.ok(r.shown && /Next/.test(r.text), `the build-phase preview must still be there (saw "${r.text}")`);
  const buildText = r.text;

  // 2. The wave starts. RUSH is refused for the first rushSettle seconds — a
  //    doubled CALL tap must not send a wave you have not seen — so the preview
  //    must be DOWN, not permanent furniture over the spawn end of the field.
  await page.locator("#screen-td-play .td-call").click();
  await page.waitForFunction(() => window.__TD.state().phase === "wave", null, { timeout: 8000 });
  await page.waitForTimeout(120);
  r = await look();
  assert.equal(r.phase, "wave", "fixture: the wave really started");
  assert.ok(r.callOff, "fixture: RUSH is refused during the settle window");
  assert.ok(!r.shown, "while RUSH is refused there is no decision, so no preview");

  // 3. Once RUSH is on offer the preview comes back, naming the wave a tap would
  //    send — and it is the NEXT unsent one, not the one already walking.
  await page.waitForFunction(() => {
    const c = document.querySelector("#screen-td-play .td-call");
    return c && !c.disabled && window.__TD.state().phase === "wave";
  }, null, { timeout: 8000 });
  await page.waitForTimeout(120);
  r = await look();
  assert.ok(r.shown, "the preview must be up exactly when ⏩ RUSH is on offer");
  assert.ok(/Next/.test(r.text), `…and it must name what a RUSH would send (saw "${r.text}")`);
  const expected = await page.evaluate(() => {
    const s = window.__TD.state();
    const L = window.TDData.LEVELS.find((l) => l.id === s.levelId);
    const idx = s.sentIdx == null ? s.waveIdx : s.sentIdx;
    const counts = {};
    for (const g of L.waves[idx].groups) counts[g.type] = (counts[g.type] || 0) + g.count;
    return Object.keys(counts).map((t) => window.TDData.ENEMIES[t].icon + counts[t]);
  });
  assert.ok(expected.length, "fixture: the next unsent wave must actually have groups");
  for (const part of expected) {
    assert.ok(r.text.includes(part),
      `the preview must describe the NEXT UNSENT wave, not the one walking (missing "${part}" in "${r.text}")`);
  }
  assert.notEqual(r.text, buildText,
    "fixture: it must have moved on from the wave that is already out, or this proves nothing");
});

test("QoL: continuing a run keeps THAT run's rules — Retry must not change the difficulty", async () => {
  // REPRODUCED before it was fixed: park a heroic run, switch the fort-home chip
  // to Easy, resume (the checkpoint correctly restores heroic), lose — and the
  // shipped Retry handed back a CASUAL run, so a win there wrote a casual star
  // for what the screen had just called Hard. `startLevel` resolves
  // `opts.difficulty || save.difficulty`, and retry passed only a seed. Three
  // siblings had two policies (restart and ▶ Next carried it, retry did not) and
  // none of them carried the CHIPS, so a resumed challenge run silently stopped
  // being a challenge on every one of those paths.
  const openHome = async () => {
    await page.evaluate(() => { location.hash = "#__renav"; });
    await page.waitForTimeout(40);
    await page.evaluate(() => { location.hash = "#td-home"; });
    await page.locator("#screen-td-home .td-level").first().waitFor({ state: "visible", timeout: 8000 });
    await page.waitForTimeout(80);
  };
  const seed = async (difficulty, chips) => {
    await page.evaluate((v) => {
      const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
      raw.difficulty = v.difficulty; raw.chipsArmed = v.chips;
      localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
    }, { difficulty, chips });
    await page.reload();
    await page.waitForFunction(() => !!window.__TD, null, { timeout: 8000 });
    await openHome();
  };
  const rules = () => page.evaluate(() => {
    const s = window.__TD.state();
    return s ? { difficulty: s.difficulty, chips: (s.chips || []).slice() } : null;
  });

  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => window.__TD.resetSave());
  await seed("heroic", ["nocamp"]);

  await page.locator("#screen-td-home .td-level").first().click();
  await page.locator("#screen-td-play").waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(250);
  assert.deepEqual(await rules(), { difficulty: "heroic", chips: ["nocamp"] },
    "fixture: the run really starts on Hard, with the chip armed");

  // Park it, then change BOTH on the fort home while it sits there.
  await page.locator("#screen-td-play .td-pause").click();
  await page.locator('.td-overlay [data-act="quit"]').click();
  await page.locator(".td-overlay--confirm").waitFor({ state: "visible", timeout: 5000 });
  await page.locator('.td-overlay--confirm [data-act="yes"]').click();
  await page.locator("#screen-td-home").waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(150);
  await seed("casual", []);

  await page.locator("#screen-td-home .td-resume__go").click();
  await page.locator("#screen-td-play").waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(250);
  assert.deepEqual(await rules(), { difficulty: "heroic", chips: ["nocamp"] },
    "fixture: the checkpoint restores the RUN's rules, not the home's — this is what makes them disagree");

  // Lose it, then Retry.
  await page.evaluate(() => window.__TD.script([["call"], ["untilPhase", "lost", 400000]]));
  await page.locator(".td-overlay--lose").waitFor({ state: "visible", timeout: 8000 });
  await page.evaluate(() => { document.querySelector('.td-overlay [data-act="retry"]').click(); });
  await page.waitForTimeout(400);
  const after = await rules();
  assert.equal(after.difficulty, "heroic",
    `Retry must replay the run you LOST, not the ladder the fort home is set to (got ${after.difficulty})`);
  assert.deepEqual(after.chips, ["nocamp"],
    "…and a challenge run must still be a challenge when you retry it");

  // The other shuffle button is the same decision with a different seed.
  await page.evaluate(() => window.__TD.script([["call"], ["untilPhase", "lost", 400000]]));
  await page.locator(".td-overlay--lose").waitFor({ state: "visible", timeout: 8000 });
  await page.evaluate(() => { document.querySelector('.td-overlay [data-act="retrynew"]').click(); });
  await page.waitForTimeout(400);
  const shuffled = await rules();
  assert.equal(shuffled.difficulty, "heroic", "the new-shuffle retry keeps the run's ladder too");
  assert.deepEqual(shuffled.chips, ["nocamp"], "…and its challenge");

  await page.evaluate(() => window.__TD.resetSave());
  await page.waitForTimeout(60);
});

test("QoL: the next-wave pill dodges the lanes instead of sitting on the incoming bodies", async () => {
  // Keeping the preview up through a wave (so ⏩ RUSH can be read) put it over
  // the road: measured across all 40 maps at 390px, the fixed top-CENTRE anchor
  // lands on a lane's first cells on 10 of them. Harmless while it only showed
  // during BUILD — an empty road — and a real cost with bodies walking under it.
  // It now picks whichever of left / centre / right keeps the most distance from
  // every lane point in its own horizontal band.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });

  // The anchor must re-key on the LEVEL, not only on the text. L39 and L40 have
  // byte-identical wave-1 previews and want OPPOSITE corners, so a text-only key
  // leaves L40 wearing L39's anchor — a real staleness bug, found by a probe
  // disagreeing with its own prediction.
  const anchorOf = (id) => page.evaluate((lv) => {
    window.__TD.newGame(lv, { seed: 3 });
    const nw = document.querySelector("#screen-td-play .td-nextwave");
    return { cls: [...nw.classList].filter((c) => c.startsWith("td-nextwave--")).join(",") || "center",
      text: nw.textContent };
  }, id);
  const a = await anchorOf(39);
  const b = await anchorOf(40);
  assert.equal(a.text, b.text,
    "fixture: these two levels must share a preview text, or this proves nothing about the key");
  assert.notEqual(a.cls, b.cls,
    `the anchor must be re-derived when the LEVEL changes, not only when the text does (both ${a.cls})`);

  const measure = async () => page.evaluate(() => {
    const ids = window.TDData.LEVELS.map((l) => l.id);
    const out = [];
    for (const id of ids) {
      window.__TD.newGame(id, { seed: 3 });
      const nw = document.querySelector("#screen-td-play .td-nextwave");
      const cv = document.querySelector("#screen-td-play .td-canvas");
      if (!nw || nw.hidden) continue;
      const p = nw.getBoundingClientRect(), c = cv.getBoundingClientRect();
      const L = window.TDData.LEVELS.find((l) => l.id === id);
      let covered = 0, pts = 0;
      for (const path of (L.paths || [L.path])) {
        for (let i = 0; i < Math.min(6, path.length); i++) {
          const s = window.__TD.w2s(path[i][0] + 0.5, path[i][1] + 0.5);
          const x = c.left + s.x, y = c.top + s.y;
          pts++;
          if (x >= p.left && x <= p.right && y >= p.top && y <= p.bottom) covered++;
        }
      }
      out.push({ id, covered, pts });
    }
    return out;
  });

  // 390: the size this is played at. The residual is L7, whose lane spans the
  // whole band at this height so no anchor clears it — it keeps the centre and
  // is therefore never WORSE than the fixed anchor this replaced.
  let rows = await measure();
  assert.ok(rows.length >= 40, `fixture: every level must show a wave-1 preview (saw ${rows.length})`);
  let hit = rows.filter((r) => r.covered > 0).map((r) => r.id);
  assert.ok(hit.length <= 1,
    `at 390px the pill must dodge the lanes on all but the one map that cannot (covered on L${hit.join(", L")})`);

  // 320: the pill is ~47% of the canvas here, so there is far less room to move
  // — measured 12 of 40 before the narrow-width shrink and 7 after. Pinned at
  // the measured value so a wider pill, or a new map, cannot quietly regress it.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(150);
  rows = await measure();
  hit = rows.filter((r) => r.covered > 0).map((r) => r.id);
  assert.ok(hit.length <= 7,
    `at 320px the pill covers a lane on ${hit.length} maps, over the measured budget of 7 (L${hit.join(", L")})`);

  // LANDSCAPE, and the SIZE is the test. The renderer rotates the floor 90° for
  // portrait, so every lane moves on screen and the anchor is re-derived from
  // that geometry — but only a landscape NARROW enough for the pill to be a real
  // fraction of the canvas can separate the two states. Measured, fixed-centre
  // vs anchored: 844×390 is 0 vs 0 and 1024×768 is 0 vs 0, i.e. clauses there
  // could not fail and are not written; 667×375 is 5 vs 1, which is a genuine
  // separation, so that is the size this pins.
  await page.setViewportSize({ width: 667, height: 375 });
  await page.waitForTimeout(150);
  rows = await measure();
  hit = rows.filter((r) => r.covered > 0).map((r) => r.id);
  assert.ok(hit.length <= 1,
    `in a narrow landscape the pill covers a lane on ${hit.length} maps, over the measured budget of 1 (L${hit.join(", L")})`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);

});

test("QoL: a corner badge never sits on its own label, and the grid never orphans a card", async () => {
  // Both were found by SCREENSHOTTING changes that all their own tests passed.
  // The ⭐ count badge measured "free" (button heights byte-identical, no page
  // overflow) and then sat ON its own word at every width — 53px² at 390 and
  // 79px² on a tablet, where the label wraps to two lines. The level cards had
  // already taught this exact lesson once: an absolutely positioned corner
  // measures free and then collides, so the guarantee has to be STRUCTURAL.
  const openHome = async () => {
    await page.evaluate(() => { location.hash = "#__renav"; });
    await page.waitForTimeout(40);
    await page.evaluate(() => { location.hash = "#td-home"; });
    await page.locator("#screen-td-home .td-level").first().waitFor({ state: "visible", timeout: 8000 });
    await page.waitForTimeout(90);
  };
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => {
    window.__TD.resetSave();
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    raw.stars = { casual: {}, normal: { "1": 3, "2": 3, "3": 3, "4": 3 }, heroic: {} };
    raw.chipsArmed = ["nocamp", "nofan"];
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__TD, null, { timeout: 8000 });

  const look = () => page.evaluate(() => {
    const badges = [];
    for (const b of document.querySelectorAll("#screen-td-home .td-metabtn")) {
      const n = b.querySelector(".td-metabtn__n");
      if (!n) continue;
      const nb = n.getBoundingClientRect();
      // the LABEL's real ink, via a Range over the button's own text nodes — a
      // span's box is as wide as its parent and would prove nothing.
      const rng = document.createRange();
      let worst = 0;
      for (const node of b.childNodes) {
        if (node.nodeType !== 3 || !node.textContent.trim()) continue;
        rng.selectNodeContents(node);
        for (const t of rng.getClientRects()) {
          const ox = Math.max(0, Math.min(nb.right, t.right) - Math.max(nb.left, t.left));
          const oy = Math.max(0, Math.min(nb.bottom, t.bottom) - Math.max(nb.top, t.top));
          worst = Math.max(worst, Math.round(ox * oy));
        }
      }
      badges.push({ cls: [...b.classList].find((c) => c.endsWith("-open")), overlap: worst,
        inside: nb.right <= b.getBoundingClientRect().right + 1 });
    }
    const grid = document.querySelector("#screen-td-home .td-levels");
    const cols = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length;
    const wrapped = [...grid.querySelectorAll(".td-level__name")]
      .filter((n) => n.getBoundingClientRect().height > 26).length;
    return { badges, cols, wrapped, cards: grid.querySelectorAll(".td-level").length,
      ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });

  const sizes = [[320, 568], [390, 844], [768, 1024], [834, 1112]];
  let seen = 0;
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await openHome();
    const r = await look();
    assert.ok(r.badges.length >= 2,
      `fixture: the seed must actually produce badges at ${w}px (saw ${r.badges.length})`);
    seen += r.badges.length;
    for (const b of r.badges) {
      assert.equal(b.overlap, 0,
        `at ${w}px the ${b.cls} badge overlaps its own label by ${b.overlap}px² — reserve its corner`);
      assert.ok(b.inside, `at ${w}px the ${b.cls} badge escapes its button`);
    }
    // Every world is four levels, so an odd column count orphans exactly one
    // card per world — ten ragged half-rows, for the SAME number of rows.
    const per = await page.evaluate(() => {
      const c = {};
      for (const l of window.TDData.LEVELS) c[l.world] = (c[l.world] || 0) + 1;
      return c;
    });
    for (const world in per) {
      assert.equal(per[world] % r.cols, 0,
        `world "${world}" has ${per[world]} levels in a ${r.cols}-column grid, so its last row is ragged`);
    }
    assert.ok(r.ovf <= 1, `the fort home must not scroll sideways at ${w}px (${r.ovf}px)`);
  }
  assert.ok(seen >= 8, `fixture: badges must have been measured at every size (saw ${seen})`);

  // The payoff the wider card buys: at the size this is played at, a level's
  // NAME fits on one line. It was 32 of 40 wrapping in the 3-wide grid.
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome();
  const r = await look();
  assert.equal(r.cards, 40, "fixture: every level still has a card");
  assert.ok(r.wrapped === 0,
    `at 390px no level name should wrap — the card is wide enough now (${r.wrapped} of ${r.cards} wrapped)`);
  await page.evaluate(() => window.__TD.resetSave());
  await page.waitForTimeout(60);
});

test("QoL: a stacked overlay button is never a different width from its siblings", async () => {
  // The overlay box is a column flex, so its DIRECT children stretch to its
  // width. The post-mortem's 📖 button is nested one level down, inside the
  // post-mortem block, so it escaped that and rendered 171px wide and hard left
  // in a column of 272px siblings — it read as a button that failed to size.
  // A flex-item rule is escaped by nesting, and this is the generic form: any
  // future nested button inherits the check.
  const stacked = () => page.evaluate(() => {
    const box = document.querySelector(".td-overlay .td-overlay__box") ||
      (document.querySelector(".td-overlay") || {}).firstElementChild;
    if (!box) return null;
    // buttons deliberately laid out SIDE BY SIDE live in .td-overlay__row and
    // are excluded — they are a row, not a column.
    const btns = [...box.querySelectorAll(".td-btn")].filter((b) => !b.closest(".td-overlay__row"));
    return btns.map((b) => ({ cls: b.className, w: Math.round(b.getBoundingClientRect().width),
      x: Math.round(b.getBoundingClientRect().left) }));
  });

  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => {
    window.__TD.resetSave();
    window.__TD.newGame(1, { seed: 1 });
    return window.__TD.script([["call"], ["untilPhase", "lost", 400000]]);
  });
  await page.locator(".td-overlay--lose").waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(150);
  let btns = await stacked();
  assert.ok(btns && btns.length >= 4,
    `fixture: the defeat screen must offer several stacked buttons (saw ${btns && btns.length})`);
  let widths = [...new Set(btns.map((b) => b.w))];
  assert.equal(widths.length, 1,
    `every stacked button must be the same width — ${btns.map((b) => b.cls.split(" ").pop() + ":" + b.w).join(", ")}`);
  assert.equal([...new Set(btns.map((b) => b.x))].length, 1, "…and start at the same edge");

  // The pause menu is the other column of stacked buttons; it has always been
  // uniform, so this is the control that shows the check is not defeat-specific.
  await page.evaluate(() => { document.querySelector('.td-overlay [data-act="quit"]').click(); });
  await page.locator("#screen-td-home").waitFor({ state: "visible", timeout: 8000 });
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 3 }); });
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.waitForTimeout(250);
  await page.locator("#screen-td-play .td-pause").click();
  await page.locator(".td-overlay--pause").waitFor({ state: "visible", timeout: 5000 });
  btns = await stacked();
  assert.ok(btns.length >= 5, `fixture: the pause menu must be a real column (saw ${btns.length})`);
  widths = [...new Set(btns.map((b) => b.w))];
  assert.equal(widths.length, 1, `the pause menu's buttons must all be one width (${widths.join(", ")})`);
  await page.evaluate(() => { document.querySelector('.td-overlay [data-act="resume"]').click(); });
  await page.waitForTimeout(100);
});

test("QoL: the resume banner's label stays readable on the narrowest phone", async () => {
  // The label names the run's RULES now, and at 320 the two buttons leave it
  // ~140px of a 296px row — measured, SIX lines of two or three words each, on
  // the very text you read to decide whether to pick the run back up. Wrapping
  // it onto its own full-width row gives it 268px and three lines, while the
  // buttons keep their 44px floor.
  const read = async (w, h) => {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => { location.hash = "#__renav"; });
    await page.waitForTimeout(40);
    await page.evaluate(() => { location.hash = "#td-home"; });
    await page.locator("#screen-td-home").waitFor({ state: "visible", timeout: 8000 });
    await page.waitForTimeout(150);
    return page.evaluate(() => {
      const b = document.querySelector("#screen-td-home .td-resume");
      if (!b || b.hidden) return null;
      const t = b.querySelector(".td-resume__txt");
      const rng = document.createRange(); rng.selectNodeContents(t);
      return { lines: rng.getClientRects().length,
        goH: Math.round(b.querySelector(".td-resume__go").getBoundingClientRect().height),
        xW: Math.round(b.querySelector(".td-resume__x").getBoundingClientRect().width),
        ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
  };
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => {
    window.__TD.resetSave();
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    raw.chipsArmed = ["nocamp"];      // the longest realistic label: level, name, ladder, chip, wave
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__TD, null, { timeout: 8000 });
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home .td-level").first().waitFor({ state: "visible", timeout: 8000 });
  await page.locator("#screen-td-home .td-level").first().click();
  await page.locator("#screen-td-play").waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.__TD.leaveToHome(); });
  await page.waitForTimeout(200);

  // The parked run above is the SHORTEST label this banner can show, and a bound
  // measured against it is a bound about the fixture. Re-point the checkpoint at
  // the worst realistic run — the longest level name, the hard ladder, two chips,
  // and the wave/lives the banner now states — because that is what this rule
  // exists to survive. (The banner only READS the checkpoint, so a level id that
  // is not unlocked is fine here; nothing resumes it.)
  const WORST = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1") || "{}");
    const longest = window.TDData.LEVELS.slice().sort((a, b) => b.name.length - a.name.length)[0];
    raw.midRun = Object.assign({}, raw.midRun, {
      levelId: longest.id, endless: false, difficulty: "heroic",
      chips: (window.TDData.CHIPS || []).slice(0, 2).map((c) => c.id),
      waveIdx: longest.waves.length - 3, lives: 15,
    });
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
    return longest.name;
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__TD, null, { timeout: 8000 });

  // 360 is the one that matters and the one nobody measured: this rule shipped at
  // `max-width: 359px`, so at 360 — the commonest Android width — the worst label
  // was SIX lines, the exact defect the 320 rule was written for, still live one
  // pixel above its own breakpoint.
  for (const [w, h] of [[320, 568], [360, 640], [390, 844], [414, 896]]) {
    const m = await read(w, h);
    assert.ok(m, `fixture: a parked checkpoint must show a banner at ${w}px`);
    assert.ok(m.lines <= 3,
      `at ${w}px the resume label must not fragment — it is the text you decide on ` +
      `(${m.lines} lines for "${WORST}" on the hard ladder with two chips)`);
    assert.ok(m.goH >= 44 && m.xW >= 44,
      `…and the buttons keep their adult floor at ${w}px (${m.goH}px tall, ✕ ${m.xW}px wide)`);
    assert.ok(m.ovf <= 1, `…with no sideways scroll at ${w}px (${m.ovf}px)`);
  }
  await page.evaluate(() => window.__TD.resetSave());
  await page.waitForTimeout(60);
});

test("QoL: a badge earned at a WIN is announced inside the victory box, not behind it", async () => {
  // The toast is deliberately z-15 so it can never cover the outcome screen's
  // buttons in landscape — an earlier audit's call, and the right one. But most
  // badges are earned at the moment of a win, when that screen is up, so the
  // announcement was arriving dimmed behind its 70% scrim and clipped off the
  // bottom. Flipping the z-index trades this defect for the one already fixed;
  // a badge earned at an outcome belongs INSIDE that outcome.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => window.__TD.resetSave());
  await page.evaluate(() => { window.__TD.winL1(7); });
  await page.locator(".td-overlay--win").waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(250);

  const r = await page.evaluate(() => {
    const box = document.querySelector(".td-overlay--win .td-overlay__box") ||
      document.querySelector(".td-overlay--win").firstElementChild;
    const lines = [...box.querySelectorAll(".td-earned__line")].map((p) => p.textContent.trim());
    const boxRect = box.getBoundingClientRect();
    const toasts = [...document.querySelectorAll(".td-toast")].map((t) => t.textContent.trim());
    // measure the real ink gap between the bold lead-in and the name after it
    let gap = -1;
    const line = box.querySelector(".td-earned__line");
    if (line) {
      const b = line.querySelector("b");
      const txt = line.querySelector(".td-earned__txt") || line;
      const after = [...txt.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (b && after) {
        // Start the range AFTER the leading whitespace — selecting the whole
        // node includes the space, so its left edge is flush with </b> whether
        // or not the space actually renders, and the metric reads 0 either way.
        const first = after.textContent.search(/\S/);
        const rng = document.createRange();
        rng.setStart(after, first); rng.setEnd(after, after.textContent.length);
        const rb = b.getBoundingClientRect(), ra = rng.getBoundingClientRect();
        gap = Math.round(ra.left - rb.right);
      }
    }
    return { lines, toasts, gap, ach: window.__TD.ach(),
      // everything the box says must actually be ON the box, not clipped away
      inside: lines.length === 0 || [...box.querySelectorAll(".td-earned__line")].every((p) => {
        const q = p.getBoundingClientRect();
        return q.top >= boxRect.top - 1 && q.bottom <= boxRect.bottom + 1 && q.width > 40;
      }) };
  });

  assert.ok(r.ach.indexOf("doorman") >= 0,
    `fixture: winning L1 must actually earn a badge (got ${JSON.stringify(r.ach)})`);
  assert.ok(r.lines.length >= 1,
    `a badge earned at the win must be named in the victory box (box lines: ${JSON.stringify(r.lines)})`);
  assert.ok(r.lines.join(" ").indexOf("Doorman") >= 0,
    `…by name (saw ${JSON.stringify(r.lines)})`);
  assert.ok(r.inside, "…and the line must be laid out inside the box, not clipped");
  // The space between "Badge earned!" and the name must actually RENDER. This
  // line is a flex container, which turns each child into an item and trims the
  // whitespace at their boundaries — so a bare text node beside the <b> lost its
  // leading space while textContent still reported one. A text assertion cannot
  // see that; only the geometry can.
  assert.ok(r.gap >= 2,
    `"Badge earned!" and the badge's name must be separated when RENDERED — a flex ` +
    `container trims the space between its items (measured ${r.gap}px)`);
  // …and NOT as a toast, which is painted under the scrim.
  assert.ok(!r.toasts.some((t) => t.indexOf("Doorman") >= 0),
    `a win-time badge must not also be a toast behind the scrim (toasts: ${JSON.stringify(r.toasts)})`);

  // The list must be DRAINED, or the next outcome box repeats badges you earned
  // in a run that is already over. A neglect loss earns nothing (no kills, no
  // win), so its box must name NOTHING — which is only true if the win's entries
  // were taken away with it.
  await page.evaluate(() => { document.querySelector('.td-overlay [data-act="continue"]').click(); });
  await page.waitForTimeout(150);
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 1 });
    return window.__TD.script([["call"], ["untilPhase", "lost", 400000]]);
  });
  await page.locator(".td-overlay--lose").waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => {
    const box = document.querySelector(".td-overlay--lose .td-overlay__box") ||
      document.querySelector(".td-overlay--lose").firstElementChild;
    return [...box.querySelectorAll(".td-earned__line")].map((p) => p.textContent.trim());
  });
  assert.deepEqual(after, [],
    `an outcome box must name only what THIS outcome earned (saw ${JSON.stringify(after)})`);

  // CONTROL: a badge earned MID-RUN still toasts — nothing is covering it then,
  // and the toast is the only thing that can announce it at all.
  await page.evaluate(() => { document.querySelector('.td-overlay [data-act="quit"]').click(); });
  await page.waitForTimeout(150);
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.waitForTimeout(150);
  const mid = await page.evaluate(() => {
    // A FRESH save: earnAch returns early for a badge already owned, so without
    // this the control measures nothing — First Blood was earned by the win
    // above and could never fire again. (Suspect the fixture.)
    window.__TD.resetSave();
    for (const t of document.querySelectorAll(".td-toast")) t.remove();
    window.__TD.newGame(1, { seed: 3 });
    const before = document.querySelectorAll(".td-toast").length;
    // …and a BOARD, or nothing dies and First Blood can never fire. phase is
    // "build"/"wave" throughout — the honest mid-run case.
    const L = window.TDData.LEVELS.find((l) => l.id === 1);
    window.__TD.script(L.pads.slice(0, 3).map((p) => ["place", "dart", p.id])
      .concat([["call"], ["tick", 600]]));
    return { phase: window.__TD.state().phase,
      grew: document.querySelectorAll(".td-toast").length > before,
      ach: window.__TD.ach() };
  });
  assert.notEqual(mid.phase, "won", "fixture: the control must be a LIVE run, not an outcome");
  assert.ok(mid.ach.indexOf("firstblood") >= 0,
    `fixture: a mid-run badge must actually be earned (got ${JSON.stringify(mid.ach)})`);
  assert.ok(mid.grew,
    "a badge earned mid-run must still toast — the outcome box is not on screen to hold it");

  // …and that toast must be taken away when a dialog opens over it. The toast
  // paints UNDER the scrim by design, so leaving it there turns something the
  // player has already seen into a dimmed ghost at the bottom of the picture.
  // __TD.newGame leaves the run PAUSED, so a first ⏸ tap would RESUME rather
  // than open the menu (documented). Route to unpause first — route() does not
  // touch toasts, so the one just earned is still there, which is asserted.
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.waitForTimeout(150);
  const alive = await page.evaluate(() => document.querySelectorAll(".td-toast").length);
  assert.ok(alive > 0, "fixture: the toast must survive to the dialog, or this clause is vacuous");
  await page.locator("#screen-td-play .td-pause").click();
  await page.locator(".td-overlay--pause").waitFor({ state: "visible", timeout: 5000 });
  await page.waitForTimeout(120);
  const ghosts = await page.evaluate(() => document.querySelectorAll(".td-toast").length);
  assert.equal(ghosts, 0,
    `a toast alive when a dialog opens must be cleared, not left dimmed under the scrim (${ghosts} left)`);
  await page.evaluate(() => { document.querySelector('.td-overlay [data-act="resume"]').click(); });
  await page.waitForTimeout(100);
});

test("QoL: the star tree's budget rides the sticky strip, so it survives scrolling", async () => {
  // The number you decide against — how many stars you have to spend — was a
  // display-size two-line block at the very top of a dialog that scrolls 2900px.
  // So it was gone the moment you started browsing the 40 nodes it applies to,
  // and it cost 68px of a box that is only 488px tall at 320, where measured
  // HALF the dialog was header and 3 of 40 nodes were visible.
  const openTree = async (w, h) => {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => { location.hash = "#__renav"; });
    await page.waitForTimeout(40);
    await page.evaluate(() => { location.hash = "#td-home"; });
    await page.locator("#screen-td-home .td-level").first().waitFor({ state: "visible", timeout: 8000 });
    await page.locator("#screen-td-home .td-tree-open").click();
    await page.waitForTimeout(200);
  };
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => {
    window.__TD.resetSave();
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    raw.stars = { casual: {}, normal: { "1": 3, "2": 3, "3": 3, "4": 3, "5": 2 }, heroic: {} };
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__TD, null, { timeout: 8000 });

  for (const [w, h] of [[390, 844], [320, 568]]) {
    await openTree(w, h);
    const r = await page.evaluate(() => {
      const box = document.querySelector(".td-overlay__box");
      const b = box.getBoundingClientRect();
      const note = box.querySelector(".td-overlay__note");
      const x = box.querySelector(".td-overlay__x");
      const before = { text: note.textContent.trim(), scrollable: box.scrollHeight > box.clientHeight + 1 };
      box.scrollTop = box.scrollHeight;                 // all the way past the 40 nodes
      const nr = note.getBoundingClientRect(), xr = x.getBoundingClientRect();
      return Object.assign(before, {
        scrolled: Math.round(box.scrollTop),
        visible: nr.top >= b.top - 1 && nr.bottom <= b.bottom + 1 && nr.width > 20 && nr.height > 8,
        overlapsX: nr.right > xr.left + 1,
        xOnRight: Math.round(b.right - xr.right) <= 30,
        noteLeft: Math.round(nr.left - b.left - 22),   // minus the box's own padding
        // the header must not eat the dialog: some nodes have to be visible
        nodesVisible: [...box.querySelectorAll(".td-node")].filter((n) => {
          const q = n.getBoundingClientRect();
          return q.top >= b.top && q.bottom <= b.bottom; }).length,
      });
    });
    assert.ok(r.scrollable && r.scrolled > 500,
      `fixture: at ${w}px the tree must really scroll, or nothing can scroll away (${r.scrolled}px)`);
    assert.match(r.text, /⭐\s*\d+\s*to spend/,
      `at ${w}px the sticky strip must carry the budget (saw "${r.text}")`);
    assert.ok(r.visible,
      `at ${w}px the budget must still be on screen after scrolling the whole tree`);
    assert.ok(!r.overlapsX, `at ${w}px the note must not run under the ✕`);
    assert.ok(r.xOnRight, `at ${w}px the ✕ must keep its right edge`);
    // …and the budget reads as a HEADER on the left, not crowded against the ✕.
    // (The ✕ stays right either way, because the note element is always
    // rendered — so this is the clause that actually pins the layout.)
    assert.ok(r.noteLeft <= 8,
      `at ${w}px the budget must sit at the box's left edge (${r.noteLeft}px in)`);
    assert.ok(r.nodesVisible >= 4,
      `at ${w}px the header must leave room for real nodes (${r.nodesVisible} visible)`);
  }

  // CONTROL: every OTHER meta dialog leaves the note empty, so the ✕ must still
  // sit hard right — with one child, a flex-end strip would put it on the left.
  await page.evaluate(() => { document.querySelector(".td-overlay__x").click(); });
  await page.waitForTimeout(120);
  await page.locator("#screen-td-home .td-ach-open").click();
  await page.waitForTimeout(200);
  const plain = await page.evaluate(() => {
    const box = document.querySelector(".td-overlay__box");
    const b = box.getBoundingClientRect();
    const note = box.querySelector(".td-overlay__note");
    const xr = box.querySelector(".td-overlay__x").getBoundingClientRect();
    return { note: note ? note.textContent.trim() : null, fromRight: Math.round(b.right - xr.right) };
  });
  assert.equal(plain.note, "", "a dialog with nothing to pin leaves the note empty");
  assert.ok(plain.fromRight <= 30,
    `…and the ✕ still sits on the right (${plain.fromRight}px from the edge)`);
  await page.evaluate(() => { document.querySelector(".td-overlay__x").click(); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.__TD.resetSave());
  await page.waitForTimeout(60);
});

test("QoL: the 21-screen Toybox Guide has contents you can jump with", async () => {
  // Measured, the guide is 15,490px tall — 21 screens — and had no navigation at
  // all: reaching the star-tree section meant scrolling 3,342px, and the
  // 56-enemy roster (77% of the dialog) ran to the end with no heading of its
  // own. The row is DERIVED from the sections' own labels, so a ninth section
  // appears the moment it is written.
  const openGuide = async (w, h) => {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => { location.hash = "#__renav"; });
    await page.waitForTimeout(40);
    await page.evaluate(() => { location.hash = "#td-home"; });
    await page.locator("#screen-td-home .td-level").first().waitFor({ state: "visible", timeout: 8000 });
    await page.locator("#screen-td-home .td-guide-open").click();
    await page.waitForTimeout(250);
  };
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => window.__TD.resetSave());

  for (const [w, h] of [[390, 844], [320, 568]]) {
    await openGuide(w, h);
    const r = await page.evaluate(() => {
      const box = document.querySelector(".td-overlay__box");
      const b = box.getBoundingClientRect();
      const btns = [...box.querySelectorAll(".td-guide__tocbtn")];
      const secs = [...box.querySelectorAll("[data-sec]")];
      const jumps = [];
      for (const btn of btns) {
        box.scrollTop = 0;
        btn.click();
        const sec = box.querySelector("#td-sec-" + btn.dataset.go);
        jumps.push({ label: btn.textContent.trim(),
          scrolled: Math.round(box.scrollTop),
          offset: Math.round(sec.getBoundingClientRect().top - b.top) });
      }
      box.scrollTop = 0;
      return { n: btns.length, secs: secs.length,
        boxH: Math.round(b.height), scrollH: box.scrollHeight,
        stripH: Math.round(box.querySelector(".td-overlay__top").getBoundingClientRect().height),
        small: btns.filter((x) => x.getBoundingClientRect().height < 44).length,
        blank: btns.filter((x) => !x.textContent.trim()).length,
        navH: Math.round(box.querySelector(".td-guide__toc").getBoundingClientRect().height),
        cols: getComputedStyle(box.querySelector(".td-guide__toc")).gridTemplateColumns.trim().split(/\s+/).length,
        jumps, ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        rosterHasSection: (() => {
          const list = box.querySelector(".td-guide__list");
          if (!list) return false;
          let p = list.previousElementSibling;
          while (p && !p.hasAttribute("data-sec")) {
            // Nothing from ANOTHER section may sit between the roster and the
            // heading that introduces it: a list of any kind is another
            // section's content, so hitting one means the nearest heading
            // belongs to that section and not to this one. (Before the roster
            // had a heading of its own, the walk-back met the ⭐ Tree section's
            // own <ul> on the way — which is exactly the defect this catches.)
            if (p.tagName === "UL" || p.classList.contains("td-guide__list")) return false;
            p = p.previousElementSibling;
          }
          // …and the section's OWN intro prose may sit there, which is why this
          // no longer demands the heading be the immediately-previous sibling:
          // that was a proxy for "introduced by its own section" and stopped
          // tracking it the moment a section became a heading plus a paragraph
          // rather than one element doing both jobs.
          return !!p;
        })() };
    });

    // Non-vacuity: navigation only matters because this thing is enormous.
    assert.ok(r.scrollH > r.boxH * 8,
      `fixture: at ${w}px the guide must really be many screens (${r.scrollH} vs a ${r.boxH} box)`);
    assert.ok(r.n >= 6, `at ${w}px the guide must offer contents (${r.n} entries)`);
    assert.equal(r.n, r.secs, "one entry per section — the row is derived, not written out");
    assert.equal(r.blank, 0, "every entry must be labelled");
    assert.equal(r.small, 0, `every entry must clear the fort's 44px adult floor at ${w}px`);
    assert.ok(r.navH <= 200, `the row must stay compact (${r.navH}px of a ${r.boxH}px box)`);
    // …and it fills its rows EVENLY. The entry count is fixed and small, so an
    // auto-fit grid leaves a ragged last row for the same number of rows an even
    // one fills — the level grid's orphan lesson, one dialog over.
    assert.equal(r.n % r.cols, 0,
      `at ${w}px the contents must fill evenly — ${r.n} entries in ${r.cols} columns leaves an orphan`);
    assert.ok(r.ovf <= 1, `no sideways scroll at ${w}px (${r.ovf}px)`);

    for (const j of r.jumps) {
      // Landing UNDER the sticky strip is the same as not landing at all, so the
      // heading has to clear it — that offset is the whole reason the jump does
      // its own arithmetic instead of calling scrollIntoView.
      assert.ok(j.offset >= r.stripH - 6 && j.offset <= r.stripH + 60,
        `"${j.label}" must land just below the sticky strip at ${w}px ` +
        `(heading at ${j.offset}px, strip is ${r.stripH}px)`);
    }
    const moved = r.jumps.filter((j) => j.scrolled > 0).length;
    assert.ok(moved >= r.n - 1,
      `every entry but the first must actually scroll somewhere (${moved} of ${r.n} did)`);
    // The 56-enemy roster is 77% of this dialog and shipped with no heading of
    // its own, so the guide's longest stretch was its least reachable. It must
    // have an entry — asserted as "the roster list is introduced by a section",
    // which is the property, not a count that a shorter guide also satisfies.
    assert.ok(r.rosterHasSection,
      `at ${w}px the enemy roster must have its own contents entry — it is most of the guide`);
    const deepest = Math.max(...r.jumps.map((j) => j.scrolled));
    assert.ok(deepest > 2000,
      `…and the last section is a long way down, which is the point (${deepest}px)`);
    await page.evaluate(() => { document.querySelector(".td-overlay__x").click(); });
    await page.waitForTimeout(120);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(60);
});

test("QoL: a bigger screen gives the fort BIGGER controls, never more cramped ones", async () => {
  // Measured before the fix, the meta row's buttons went 117px at 390 → 109 at
  // 600 → 93 at 768, 834 and 1024: a WIDER screen handed you a NARROWER control,
  // with every label wrapped to two lines, because `auto-fit` at a 92px minimum
  // simply packed all seven across. That is the same defect Josh's launcher had
  // ("more tiles, not bigger"), and it had never been fixed on this screen.
  //
  // The law is deliberately NOT strict monotonicity: a wrapping grid steps when
  // it gains a column (the meta row really does go 187px at 600 → 168 at 768),
  // and that is inherent rather than a defect. The property that matters, and
  // the one that was false, is that a TABLET must never be stingier than a
  // PHONE.
  const read = async (w, h) => {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => { location.hash = "#__renav"; });
    await page.waitForTimeout(40);
    await page.evaluate(() => { location.hash = "#td-home"; });
    await page.locator("#screen-td-home .td-level").first().waitFor({ state: "visible", timeout: 8000 });
    await page.waitForTimeout(120);
    return page.evaluate(() => {
      const out = { widths: {}, wrapped: 0 };
      for (const sel of [".td-metabtn", ".td-level", ".td-diffbtn"]) {
        const e = document.querySelector("#screen-td-home " + sel);
        out.widths[sel] = e ? Math.round(e.getBoundingClientRect().width) : null;
      }
      const rng = document.createRange();
      for (const b of document.querySelectorAll("#screen-td-home .td-metabtn")) {
        for (const n of b.childNodes) {
          if (n.nodeType !== 3 || !n.textContent.trim()) continue;
          rng.selectNodeContents(n);
          if (rng.getClientRects().length > 1) out.wrapped++;
        }
      }
      out.ovf = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      return out;
    });
  };
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => window.__TD.resetSave());

  const phone = await read(390, 844);
  for (const sel of Object.keys(phone.widths)) {
    assert.ok(phone.widths[sel] > 0, `fixture: ${sel} must be on the fort home to compare`);
  }
  for (const [w, h] of [[768, 1024], [834, 1112], [1024, 1366]]) {
    const big = await read(w, h);
    for (const sel of Object.keys(phone.widths)) {
      assert.ok(big.widths[sel] >= phone.widths[sel],
        `at ${w}px ${sel} is ${big.widths[sel]}px — NARROWER than the ${phone.widths[sel]}px it gets on a ` +
        "390px phone. A bigger screen must grow the controls, not fit more of them");
    }
    // …and the room actually buys readability: the labels stop wrapping. This is
    // the PAYOFF clause, not a tight pin — a 120px track also clears it (five
    // columns of 137px) — so the clause above is the one that catches the
    // defect, and this one says the extra room was worth taking.
    assert.equal(big.wrapped, 0,
      `at ${w}px no meta-row label should wrap — there is room now (${big.wrapped} wrapped)`);
    assert.ok(big.ovf <= 1, `no sideways scroll at ${w}px (${big.ovf}px)`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(60);
});

test("QoL: each difficulty chip says how far that LADDER has got", async () => {
  // Stars, locks and unlocks are PER-DIFFICULTY (user request 2026-07) and
  // NOTHING on the screen said so. Measured on a save with 24 levels beaten on
  // Normal, tapping 💀 Hard takes the grid from 25 playable cards to 1 — which
  // reads as "my save is gone" far more readily than "this is a separate
  // ladder", and the fort home mentioned neither. Each chip now carries its own
  // ladder's progress, so the collapse explains itself: Normal still says 24/40
  // while you are standing on Hard's 0/40.
  await page.evaluate(() => {
    const st = {};                                  // contiguous, or the grid identity below is false
    for (let i = 1; i <= 24; i++) st[String(i)] = i <= 14 ? 3 : 1;
    localStorage.setItem("jon-td-save-v1", JSON.stringify({
      v: 1, difficulty: "normal",
      // 14 of the 24 are three-starred, so a count that measured STARS rather
      // than "beaten" reads 14 and this test can tell the difference.
      stars: { casual: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2 }, normal: st, heroic: {} },
    }));
  });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.waitForTimeout(150);

  const snap = () => page.evaluate(() => {
    const cards = [...document.querySelectorAll("#screen-td-home .td-levels .td-level")];
    return {
      total: cards.length,
      playable: cards.filter((c) => !c.classList.contains("td-level--locked")).length,
      counts: [...document.querySelectorAll("#screen-td-home .td-diffbtn")].map((b) => ({
        diff: b.dataset.diff,
        n: (b.querySelector(".td-diffbtn__n") || {}).textContent || "",
        aria: b.getAttribute("aria-label") || "",
        h: +b.getBoundingClientRect().height.toFixed(1),
        inside: (() => {
          const c = b.querySelector(".td-diffbtn__n");
          if (!c) return false;
          const r = b.getBoundingClientRect(), q = c.getBoundingClientRect();
          return q.left >= r.left - 0.5 && q.right <= r.right + 0.5 && q.bottom <= r.bottom + 0.5;
        })(),
      })),
      ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  let s = await snap();
  assert.equal(s.total, 40, "fixture: the whole grid must render");

  // Each chip reads its OWN ladder — three different numbers, so a count that
  // read the SELECTED difficulty for all three cannot pass.
  const by = Object.fromEntries(s.counts.map((c) => [c.diff, c.n]));
  assert.equal(by.normal, "24/40", "the Normal chip counts levels BEATEN on Normal (not the 14 three-starred)");
  assert.equal(by.casual, "5/40", "the Easy chip counts Easy's own ladder");
  assert.equal(by.heroic, "0/40", "…and an untouched ladder honestly says 0 rather than hiding");
  assert.ok(s.counts.every((c) => /levels beaten/.test(c.aria)),
    "the chip's accessible name spells the count out — a two-line button reads as one run otherwise");

  // The number and the grid are the same claim, so they are pinned together: on
  // a CONTIGUOUS ladder the cards a grid opens are the beaten ones plus L1. This
  // is the ONLY assertion on the playable count, deliberately — a fixture clause
  // checking the same number would swallow every mutation aimed at this one.
  assert.equal(s.playable, 24 + 1,
    "the count a chip advertises must agree with how many cards the grid actually opens");

  // The explanation has to survive the moment it is needed — the collapse.
  await page.evaluate(() => {
    document.querySelector('#screen-td-home .td-diffbtn[data-diff="heroic"]').click();
  });
  await page.waitForTimeout(150);
  s = await snap();
  assert.equal(s.playable, 1, "fixture: an untouched Hard ladder opens only L1 — this is the confusing moment");
  const after = Object.fromEntries(s.counts.map((c) => [c.diff, c.n]));
  assert.deepEqual(after, { casual: "5/40", normal: "24/40", heroic: "0/40" },
    "…and at that moment the other ladders' progress must still be on screen, or the collapse reads as data loss");

  // Layout: the second line must not push a control under the adult floor, spill
  // out of its own chip, or scroll the page sideways — at the narrowest width.
  for (const [w, h] of [[320, 568], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(120);
    const m = await snap();
    assert.ok(m.counts.every((c) => c.h >= 44),
      `at ${w}px a difficulty chip fell to ${Math.min(...m.counts.map((c) => c.h))}px, under the adult 44px floor`);
    assert.ok(m.counts.every((c) => c.inside),
      `at ${w}px the ladder count escaped its own chip`);
    assert.ok(m.ovf <= 1, `at ${w}px the chip row scrolls the page sideways by ${m.ovf}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.__TD.resetSave());
  await page.waitForTimeout(60);
});

test("QoL: during a wave the button says how much of it is LEFT", async () => {
  // The build phase has a countdown; the wave phase had no progress readout at
  // all — so "am I nearly through this, or do I hold my gold?", the most-asked
  // in-wave question and the exact bet ⏩ RUSH is against, was unanswerable. The
  // count is the engine's OWN wave-end quantity (bodies walking + bodies still
  // queued), so a button reading "0 left" during a wave that is still going is
  // not a state the engine can be in.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => window.__TD.newGame(1, { seed: 3 }));
  await page.waitForTimeout(120);

  const meta = () => page.evaluate(() =>
    (document.querySelector("#screen-td-play .td-call__meta") || {}).textContent || "");
  const phase = () => page.evaluate(() => window.__TD.state().phase);

  // BUILD: the countdown is the relevant number, and a body count would be a lie
  // (there are none) — so the wave readout must not appear here.
  assert.equal(await phase(), "build", "fixture: a fresh level opens in the build phase");
  const inBuild = await meta();
  assert.ok(/\d+s/.test(inBuild), `the build phase still shows its countdown (saw "${inBuild}")`);
  assert.ok(!/left/.test(inBuild), `…and no body count before any body exists (saw "${inBuild}")`);

  // The moment the wave is CALLED, almost all of it is still queued rather than
  // on screen — which is the half a player cannot see, and the half a readout
  // built from `state.enemies` alone would silently drop.
  const at = await page.evaluate(() => {
    window.__TD.script([["call"]]);
    return { onScreen: window.__TD.state().enemies.filter((e) => e.alive).length,
      left: window.__TD.engine().bodiesLeft() };
  });
  await page.waitForTimeout(120);
  // Not a fixture assumption — the property. This reads the ENGINE's own count on
  // purpose, so an engine that forgot the queue fails HERE with an honest message
  // rather than somewhere downstream: at the instant of the call almost nothing
  // has spawned, so a count built from the field alone reports 0.
  assert.ok(at.left > 0,
    "a just-called wave must owe the player bodies — a count built from the field alone reads 0 here");
  assert.ok(at.onScreen < at.left,
    `at the instant of the call ${at.left} bodies are owed and only ${at.onScreen} have spawned — ` +
    "the readout must count the QUEUE too, or it understates every fresh wave");
  const started = await meta();
  assert.ok(new RegExp("\\b" + at.left + " left\\b").test(started),
    `the button must show the wave's remaining bodies (saw "${started}", expected ${at.left})`);

  // …and it must DRAIN. Run the wave out and read the count on the way.
  // Wave 1 of L1 runs ~1560 ticks with nothing built, and the whole drain happens
  // in its last ~100 — measured. A budget short of that samples a flat 6,6,6 and
  // reads exactly like a broken readout, which is what the first cut did.
  let seen = [];
  for (let i = 0; i < 90 && (await phase()) === "wave"; i++) {
    await page.evaluate(() => window.__TD.script([["tick", 20]]));
    const m = await meta();
    const n = /(\d+) left/.exec(m);
    if (n) seen.push(+n[1]);
  }
  assert.ok(seen.length >= 3, `fixture: the wave must run long enough to sample (saw ${seen.length} reads)`);
  assert.ok(seen[seen.length - 1] < seen[0],
    `the count must fall as the wave is cleared (${seen[0]} → ${seen[seen.length - 1]})`);
  assert.ok(seen.every((n, i) => i === 0 || n <= seen[i - 1]),
    `the count must never go UP within one wave (${seen.join(",")})`);

  // The strongest clause: the readout and the rule that ENDS the wave are one
  // owner, so the engine must be back in the build phase exactly when it hits 0.
  const end = await page.evaluate(() => ({
    phase: window.__TD.state().phase, left: window.__TD.engine().bodiesLeft() }));
  if (end.phase === "build") {
    assert.equal(end.left, 0,
      "the wave ended, so the count it is derived from must be 0 — these are the same quantity");
  } else {
    assert.ok(end.left > 0, "still in the wave, so bodies must still be owed");
  }
  await page.evaluate(() => window.__TD.resetSave());
  await page.waitForTimeout(60);
});

test("QoL: the CALL button reserves its tallest line, so the field never moves under a thumb", async () => {
  // The meta line carries two facts joined by "·" — during build the early-call
  // bonus and the clock, during a wave the bonus and how many bodies are left —
  // and the longest of those wraps to a second line. The button is IN the
  // portrait layout, so a button that grows is a battlefield that shrinks under
  // the player's thumb mid-wave. It also fixes a jump that ALREADY shipped:
  // "last wave" is one line and "2 waves out" is two.
//   The list below is NOT the test — its last two entries are the UPPER BOUND
  // built from the widest each half can be (the longest refusal the UI has,
  // "N waves out" with the cap at RULES.maxWavesInFlight, and the largest body
  // count a deep endless run could reach), so a reservation that survives them
  // survives every real string and a new wording is covered without editing this.
  // The bound is deliberately derived rather than an arbitrary monster: a string
  // nothing can emit would demand a reservation nothing needs. (Where each string
  // comes from is proven by the sibling test that drives a real wave; this one is
  // purely about the box.)
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => window.__TD.newGame(1, { seed: 3 }));
  await page.waitForTimeout(120);

  const STRINGS = ["+135🪙 · 45s", "2 waves out", "last wave", "steady…",
    "+60🪙 · 6 left", "steady… · 6 left", "2 waves out · 148 left",
    "+9999🪙 · 9999 left", "2 waves out · 9999 left"];
  for (const [w, h] of [[320, 568], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    const r = await page.evaluate((S) => {
      const c = document.querySelector("#screen-td-play .td-call");
      const meta = c.querySelector(".td-call__meta");
      const keep = meta.textContent;
      const hs = [], lines = [];
      for (const s of S) {
        meta.textContent = s;
        hs.push(Math.round(c.getBoundingClientRect().height));
        const rng = document.createRange(); rng.selectNodeContents(meta.firstChild);
        lines.push(rng.getClientRects().length);
      }
      meta.textContent = keep;
      return { hs, lines, ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    }, STRINGS);
    assert.ok(r.lines.some((n) => n > 1),
      `fixture: at ${w}px something in this list must actually wrap, or the reservation is untested`);
    assert.equal(new Set(r.hs).size, 1,
      `at ${w}px the CALL button changes height with what it says (${r.hs.join(", ")}) — ` +
      "in portrait that resizes the battlefield under the player's thumb, and in " +
      "landscape it makes the gutter column jump");
    assert.ok(r.hs[0] >= 44, `at ${w}px the CALL button is under the adult 44px floor (${r.hs[0]}px)`);
    assert.ok(r.ovf <= 1, `at ${w}px the CALL button scrolls the page sideways (${r.ovf}px)`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(60);
});

test("QoL: a shielded leak reads as a SAVE, not as a loss", async () => {
  // 🌟 Sticker Shield is a 6⭐ capstone behind an 8⭐ in-branch spend whose whole
  // effect is one moment: the first leak each run costs 0 lives. That moment was
  // presented exactly like losing stickers — the same descending cue and the
  // same full-screen red wash — while the lives counter did not move, which
  // reads as a bug rather than as a rescue. Measured headless before the fix:
  // 20 → 15 with the node against 20 → 14 without it, and the event carries
  // `shielded: true` with no `lives` at all. The tell was two adjacent lines
  // disagreeing: the toll label already checked `shielded` and nothing else did.
  //   The CONTROL is a second RUN with the node absent, not a second leak in the
  // same run: the 🌟 label lives 34 draws and every body reaches the door within
  // ~9, so a same-run control measures a label that is merely still floating.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });

  const firstLeak = async (meta) => {
    await page.evaluate((m) => {
      window.__TD.newGame(1, { seed: 3, meta: m });
      // A label is TEXT, so read what was DRAWN rather than hunting it in pixels
      // (the lever-countdown lesson). Wrapped once; the flag survives re-entry.
      const cx = document.querySelector("#screen-td-play .td-canvas").getContext("2d");
      if (!cx.__wrapText) {
        const real = cx.fillText.bind(cx);
        cx.fillText = function (t, x, y) { window.__drawn.push(String(t)); return real(t, x, y); };
        cx.__wrapText = true;
      }
      // The SOUND is the other half of the grammar, and the fort is muted by
      // default — the shipped state — so it has to be turned on to hear anything.
      window.JoshAudio.setMuted(false);
      if (!window.JoshAudio.__wrapTone) {
        const realTone = window.JoshAudio.tone;
        window.JoshAudio.tone = function (hz, opts) { window.__heard.push(hz); return realTone.call(this, hz, opts); };
        window.JoshAudio.__wrapTone = true;
      }
      window.__drawn = []; window.__heard = [];
      window.__TD.script([["call"]]);
    }, meta);
    const before = await page.evaluate(() => window.__TD.state().lives);
    // Nothing is built, so every body walks to the door. Step in SMALL batches:
    // `script` draws once per batch and each draw ages the flash, so a big batch
    // would sample a leak that has already faded. `__drawn` is cleared per frame
    // so it holds exactly the frame the leak was seen in.
    for (let i = 0; i < 250; i++) {
      const now = await page.evaluate(() => {
        window.__drawn = []; window.__heard = [];
        window.__TD.script([["tick", 10]]);
        const s = window.__TD.state();
        const d = document.querySelector("#screen-td-play .td-canvas")
          .getContext("2d").getImageData(2, 2, 1, 1).data;
        return { lives: s.lives, shield: !!s.shieldUsed, phase: s.phase,
          warm: d[0] - d[1], drew: window.__drawn.join(" | "), heard: window.__heard.slice() };
      });
      if (now.lives < before || now.shield) return { before, ...now };
      if (now.phase !== "wave") break;
    }
    return null;
  };

  const saved = await firstLeak(["stickershield"]);
  assert.ok(saved, "fixture: the shielded run must reach its first leak");
  assert.ok(saved.shield, "fixture: the run must actually be carrying 🌟 Sticker Shield");
  assert.equal(saved.lives, saved.before,
    "the shield absorbs the first leak, so lives must not move — that IS the node");
  assert.match(saved.drew, /SAVED/,
    "the door must say what happened — a save with no label is indistinguishable " +
    `from a bug (drew: ${saved.drew.slice(0, 140)})`);

  const lost = await firstLeak([]);
  assert.ok(lost, "fixture: the control run must reach its first leak");
  assert.ok(lost.lives < lost.before, "fixture: with no shield the first leak must cost lives");
  assert.ok(!/SAVED/.test(lost.drew),
    `an unshielded leak must not claim a save (drew: ${lost.drew.slice(0, 140)})`);
  // A MEASURED separation, not a slack: the corner reads warmth 10 on the bare
  // floor and 49 under the leak wash, and the mutation that re-adds the wash to
  // a save collapses it to 49 vs 49. 20 sits between the two.
  assert.ok(lost.warm > saved.warm + 20,
    "a real leak must wash the board redder than a saved one — a save costs nothing, so " +
    `painting the "you lost stickers" wash is the wrong grammar (lost ${lost.warm} vs saved ${saved.warm})`);

  // The cue must be the opposite SHAPE, not merely present: the leak cue opens
  // at 330Hz and falls, the save opens at 784Hz and rises. The first tone alone
  // separates them, and it is what a `sfx("leak")` for both cannot satisfy.
  assert.ok(saved.heard.length && lost.heard.length,
    `fixture: both leaks must be audible (saved ${saved.heard.length}, lost ${lost.heard.length} tones)`);
  assert.ok(saved.heard[0] > lost.heard[0] + 200,
    "a save must be announced by a HIGHER, rising cue than a loss — the ear is the " +
    `channel you have while looking at the field (saved ${saved.heard[0]}Hz vs lost ${lost.heard[0]}Hz)`);

  await page.evaluate(() => window.JoshAudio.setMuted(true));   // shipped state, restored
  await page.evaluate(() => window.__TD.resetSave());
  await page.waitForTimeout(60);
});

test("QoL: endless announces the moment you pass your own record", async () => {
  // Endless has ONE number that matters — the wave you reached — and it was
  // revealed only on the defeat screen, after the run was already over. The
  // engine has always emitted `endless-wave` on every cleared wave and NOTHING
  // listened: it was one of exactly two event types with no consumer in either
  // dispatcher. Passing your own record is the moment the mode exists for.
  const seed = async (best) => page.evaluate((b) => {
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1") || "{}");
    raw.v = 1; raw.endlessBest = b;
    delete raw.midRun;   // a parked checkpoint bounces #td-play back to the fort home
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
  }, best);

  const runTo = async (best, waves) => {
    await seed(best);
    await page.reload({ waitUntil: "load" });
    await page.evaluate(() => { location.hash = "#__renav"; });
    await page.waitForTimeout(40);
    await page.evaluate(() => { location.hash = "#td-home"; });
    await page.locator("#screen-td-home").waitFor({ state: "visible" });
    // Wrap the banner rather than racing its 2.6s auto-hide: what matters is
    // that it was SHOWN, and how many times. `startEndless` routes to the play
    // screen itself — navigating there first would bounce, since no run is live.
    const out = await page.evaluate((n) => {
      // Installed unconditionally: each call reloads first, which destroys any
      // previous wrapper — a `__wrapBanner` guard would skip re-installing and
      // silently record nothing.
      window.__banners = [];
      const realBanner = window.TDUI.showBanner;
      window.TDUI.showBanner = function (t) { window.__banners.push(String(t)); return realBanner.call(this, t); };
      window.__TD.startEndless("bedroom");
      // A 4-dart board clears these waves comfortably — measured headless. place()
      // simply refuses what the arena's start gold cannot afford.
      const pads = window.TDData.ENDLESS.arenas.bedroom.pads.map((p) => p.id);
      const per = [];
      for (let w = 0; w < n; w++) {
        for (const id of pads) window.__TD.script([["place", "dart", id]]);
        window.__TD.script([["call"], ["untilPhase", "build", 400000]]);
        per.push({ wave: window.__TD.state().waveIdx, banners: window.__banners.slice() });
      }
      return { per, phase: window.__TD.state().phase };
    }, waves);
    return out;
  };

  // A record of 1: clearing wave 2 passes it.
  const beat = await runTo({ bedroom: 1 }, 3);
  assert.equal(beat.per[0].wave, 1, "fixture: the board must actually clear endless waves");
  assert.deepEqual(beat.per[0].banners, [],
    "clearing wave 1 only MATCHES the record of 1 — a tie is not a new best");
  const after2 = beat.per[1].banners.filter((b) => /New best/.test(b));
  assert.equal(after2.length, 1,
    `passing the record must announce it exactly once (saw ${JSON.stringify(beat.per[1].banners)})`);
  assert.match(after2[0], /wave 2/, "…and name the wave you reached");
  const after3 = beat.per[2].banners.filter((b) => /New best/.test(b));
  assert.equal(after3.length, 1,
    "…and only once per RUN — every wave after the record is furniture, not a signal");

  // The record is captured ON THE RUN at start, not read from the save each
  // time — and those genuinely diverge. `persist()` folds `endlessBest` in as a
  // MONOTONIC max, so a second tab finishing a better run on the same world
  // raises this tab's in-memory save mid-run. Reading it live would then silently
  // SUPPRESS the announcement for a record you really did pass. Simulated here by
  // writing the other tab's score to storage before a wave boundary merges it.
  await seed({ bedroom: 1 });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const raced = await page.evaluate(() => {
    // Re-install the spy: a reload destroys it, and a spy that is quietly gone
    // reads exactly like a feature that quietly stopped firing.
    window.__banners = [];
    const real = window.TDUI.showBanner;
    window.TDUI.showBanner = function (t) { window.__banners.push(String(t)); return real.call(this, t); };
    window.__TD.startEndless("bedroom");
    const pads = window.TDData.ENDLESS.arenas.bedroom.pads.map((p) => p.id);
    for (const id of pads) window.__TD.script([["place", "dart", id]]);
    // another tab finishes a monster run on this world
    const raw = JSON.parse(localStorage.getItem("jon-td-save-v1") || "{}");
    raw.endlessBest = { bedroom: 99 };
    localStorage.setItem("jon-td-save-v1", JSON.stringify(raw));
    // wave 1 clears -> the checkpoint persists -> the merge pulls 99 in
    window.__TD.script([["call"], ["untilPhase", "build", 400000]]);
    const merged = window.__TD.endlessBest().bedroom;
    for (const id of pads) window.__TD.script([["place", "dart", id]]);
    window.__TD.script([["call"], ["untilPhase", "build", 400000]]);
    return { merged, banners: window.__banners.slice(), wave: window.__TD.state().waveIdx };
  });
  assert.equal(raced.merged, 99,
    "fixture: the wave boundary must actually merge the other tab's score, or this proves nothing");
  assert.equal(raced.banners.filter((b) => /New best/.test(b)).length, 1,
    "the record to beat is the one this run STARTED against — a better score arriving " +
    "from another tab must not retroactively cancel a record you passed");

  // No record to beat: a first visit has nothing to say.
  const fresh = await runTo({}, 3);
  assert.equal(fresh.per[2].banners.filter((b) => /New best/.test(b)).length, 0,
    "a world with no record must not announce a 'best' — there is nothing to have beaten");

  await page.evaluate(() => window.__TD.resetSave());
  await page.waitForTimeout(60);
});

test("QoL: buying ⚙️ Toy Energy makes a sound, like every other purchase", async () => {
  // `buycharge` was one of two event types with no consumer in either dispatcher
  // — 450 gold spent in silence while build, upgrade, sell and a tier-4 branch
  // all ring. This is driven rather than scanned because the structural check
  // cannot see the other half: `sfx("buycharge")` with no matching entry in the
  // cue table falls straight through the if/else chain and plays nothing.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const heard = await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 3 });
    window.JoshAudio.setMuted(false);
    window.__heard = [];
    const real = window.JoshAudio.tone;
    window.JoshAudio.tone = function (hz, o) { window.__heard.push(hz); return real.call(this, hz, o); };
    window.__TD.grantGold(5000);            // the exchange is gold-gated, not the point here
    window.__TD.script([["call"], ["tick", 10]]);   // ⚙️ can only be bought mid-wave
    const btn = document.querySelector("#screen-td-play .td-hud__charge");
    const before = window.__TD.state().charge;
    // Read the offer BEFORE the tap: buying fills the bank and spends this
    // wave's one purchase, so the button is correctly disabled afterwards.
    const offered = !btn.disabled;
    window.__heard = [];
    btn.click();
    // The cue rides the EVENT, so it plays when the events are drained — the
    // frame loop does that within a frame in real play, and `newGame` leaves the
    // run paused, so the harness has to do it here.
    window.__TD.script([["tick", 1]]);
    return { before, offered, after: window.__TD.state().charge, tones: window.__heard.slice() };
  });
  assert.ok(heard.offered, "fixture: the ⚙️ exchange must be offered mid-wave with gold in hand");
  assert.ok(heard.after > heard.before,
    `fixture: the purchase must actually land (${heard.before} → ${heard.after} ⚙️)`);
  assert.ok(heard.tones.length > 0,
    "spending 450 gold must be audible — every other purchase in the fort rings");
  await page.evaluate(() => window.JoshAudio.setMuted(true));
  await page.evaluate(() => window.__TD.resetSave());
  await page.waitForTimeout(60);
});

test("QoL: a refused rally says why, and keeps your aim", async () => {
  // Arming ⛺ Rally and tapping a spot beyond the camp's reach used to be
  // COMPLETELY silent: no cue, no reason, the arm consumed — and, worst of all,
  // `setSelection(null)`, which erases the camp's rallyRange RING, i.e. the one
  // guide you would have aimed by. So a tap a few pixels out evaporated the whole
  // interaction and you had to reopen the panel to try again. Abilities got
  // exactly this treatment twenty lines up in the same file (a deny cue plus a
  // reason on the shared hint line) and the other armed, aimed control never did.
  //   Observables are all real: the engine's own `rallyX/rallyY`, the hint's text,
  // and the ring as INK — no test-only hook, because the ring is a picture and
  // a hook would prove the state while the picture stopped being drawn.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const cam = await page.evaluate(() => {
    window.__TD.newGame(1, { seed: 3 });
    window.__TD.grantGold(3000);
    window.__TD.script([["place", "camp", window.TDData.LEVELS[0].pads[0].id]]);
    const t = window.__TD.state().towers[0];
    return { id: t.id, cx: t.cx, cy: t.cy, range: window.TDData.TOWERS.camp.rallyRange };
  });
  assert.equal(cam.id > 0, true, "fixture: a camp must be on the board to rally from");

  // Drive the REAL controls: tap the camp, press 🚩, then tap the canvas at a
  // computed world point. A test that called engine.rally() directly could not
  // see the UI drop the arm or the ring.
  const tapAt = async (wx, wy) => {
    await page.evaluate(([x, y]) => {
      const cv = document.querySelector("#screen-td-play .td-canvas");
      const s = window.__TD.w2s(x, y), r = cv.getBoundingClientRect();
      cv.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: r.left + s.x, clientY: r.top + s.y }));
    }, [wx, wy]);
    await page.waitForTimeout(80);
  };
  // Sample INSIDE the ring's translucent disc, offset off the lane. The stroke is
  // 1.5px and would be a coin flip to hit; the fill is the whole area.
  const ringInk = () => page.evaluate(([cx, cy, r]) => {
    window.__TD.script([["tick", 1]]);          // force a fresh frame
    const cv = document.querySelector("#screen-td-play .td-canvas");
    const s = window.__TD.w2s(cx + 0.5, cy + 0.5 + r * 0.6);
    const d = cv.getContext("2d").getImageData(Math.round(s.x), Math.round(s.y), 1, 1).data;
    return d[2] - d[0];                          // the ring is blue: blue-minus-red
  }, [cam.cx, cam.cy, cam.range]);
  const state = () => page.evaluate(() => {
    const t = window.__TD.state().towers[0];
    return { rx: t.rallyX, ry: t.rallyY,
      hint: (document.querySelector("#screen-td-play .td-abilhint") || {}).textContent || "" };
  });

  const bare = await ringInk();
  await tapAt(cam.cx + 0.5, cam.cy + 0.5);                     // select the camp
  const selected = await ringInk();
  assert.ok(selected > bare + 4,
    `fixture: selecting a camp must draw its reach ring (ink ${bare} → ${selected})`);
  const btn = page.locator("#screen-td-play .td-rally");
  assert.ok(await btn.count(), "fixture: a camp's panel must offer 🚩 Rally");
  await btn.click();
  await page.waitForTimeout(80);

  // FAR: well outside the camp's 3.05-cell reach.
  const before = await state();
  await tapAt(cam.cx + 0.5 + cam.range + 2, cam.cy + 0.5);
  const refused = await state();
  assert.match(refused.hint, /too far/i,
    `a refused rally must say WHY (hint was "${refused.hint}")`);
  assert.equal(refused.rx, before.rx, "fixture: a refused rally must not move the flag");
  assert.ok((await ringInk()) > bare + 4,
    "…and must KEEP the camp's reach ring on screen — erasing it deletes the one thing you aim by");

  // NEAR: the corrected tap, with NO re-arming, must land. That is what proves
  // the refusal did not eat the arm.
  await tapAt(cam.cx + 0.5 + 1, cam.cy + 0.5);
  const landed = await state();
  assert.notEqual(landed.rx, before.rx,
    "a corrected tap must land without re-opening the panel — a near miss should be " +
    "correctable, not a restart");
  assert.equal(landed.hint, "", "…and a successful rally clears the refusal message");
  await page.evaluate(() => window.__TD.resetSave());
  await page.waitForTimeout(60);
});

test("QoL: the fort's 🏠 is the same size on both its screens", async () => {
  // The fort home's exit carried `btn-round` alone, which is JOSH'S kid chrome
  // sized by the 76px `--tap` token, while the play screen's identical 🏠 also
  // carries `.td-mini` — whose own comment says "adult-sized (>=44) — the fort
  // is Jon's space" — and so renders at 54. Same icon, same job, two sizes; and
  // on a dark-navy screen the near-white 76px disc was the largest, brightest
  // thing on it, above the title. The control that LEAVES should not out-shout
  // everything you came to do.
  const sizeOf = async (hash, sel) => {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.waitForTimeout(150);
    return page.evaluate((s) => {
      const e = document.querySelector(s);
      const r = e.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    }, sel);
  };
  for (const [w, h] of [[390, 844], [320, 568]]) {
    await page.setViewportSize({ width: w, height: h });
    const home = await sizeOf("#td-home", "#screen-td-home .td-exit");
    const play = await sizeOf("#td-play", "#screen-td-play .td-quit");
    assert.deepEqual(home, play,
      `at ${w}px the same 🏠 renders ${home.w}x${home.h} on the fort home and ` +
      `${play.w}x${play.h} in a battle — one button, one job, one size`);
    assert.ok(home.h >= 44,
      `at ${w}px the exit fell to ${home.h}px, under the adult 44px floor`);

    // A "the exit is not the loudest control" clause was written here and then
    // DELETED: measured against every button on the fort home it is unfalsifiable,
    // because the 40 level CARDS are buttons too and are legitimately ~90px tall,
    // so the kid-sized 76px disc sailed under the bar. Narrowing it to a named
    // list of chrome selectors would fire on the very same mutation as the size
    // clause above, which is a near-duplicate rather than coverage. The size
    // claim IS the property; the hierarchy was only its motivation.
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(60);
});

test("QoL: the 🎯 button always shows a mode's NAME, before and after you cycle it", async () => {
  // Exactly one targeting mode's player-facing name differs from its engine id —
  // `cheap` is shown as "weakest", because the mode finishes the almost-dead and
  // "cheap" reads as something about gold — and that is precisely the one this
  // got wrong. The panel's initial render read `.name`; the cycle handler eighty
  // lines below printed the RAW ID. So the mode you pay 6⭐ for was labelled
  // "weakest" until you tapped to select it, and then became "cheap".
  //   Derived from DATA.TARGETING, so a sixth mode is covered without editing
  // this, and the id/name divergence is asserted rather than assumed: if every
  // name equalled its id this test could not fail.
  const modes = await page.evaluate(() => window.TDData.TARGETING);
  const names = Object.values(modes).map((m) => m.name);
  const ids = Object.keys(modes);
  assert.ok(ids.some((id) => modes[id].name !== id),
    "fixture: at least one mode must be NAMED differently from its id, or this proves nothing");

  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  // 🔻 Weak Spot is what unlocks the mode whose name diverges, so the run has to
  // own it or the cycle never reaches the interesting label.
  const cam = await page.evaluate(() => {
    window.__TD.newGame(9, { seed: 3, meta: ["cheaptarget"] });
    window.__TD.grantGold(6000);
    const pad = window.TDData.LEVELS.find((l) => l.id === 9).pads[7];
    window.__TD.script([["place", "dart", pad.id]]);
    return { cx: pad.cx, cy: pad.cy };
  });
  const tapPad = async () => {
    await page.evaluate(([x, y]) => {
      const cv = document.querySelector("#screen-td-play .td-canvas");
      const s = window.__TD.w2s(x + 0.5, y + 0.5), r = cv.getBoundingClientRect();
      cv.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: r.left + s.x, clientY: r.top + s.y }));
    }, [cam.cx, cam.cy]);
    await page.waitForTimeout(120);
  };

  // The panel's INITIAL render is a separate site from the cycle, and a tower
  // opens on `first` — whose name equals its id — so rendering the id there
  // looks identical and cannot be caught. Put the tower ON the diverging mode
  // first, then open the panel.
  await page.evaluate(() => window.__TD.script([["target", 0, "cheap"]]));
  await tapPad();
  const btn = page.locator("#screen-td-play .td-target");
  assert.ok(await btn.count(), "fixture: a tower's panel must offer the 🎯 targeting button");
  assert.equal((await btn.textContent()).replace("🎯", "").trim(), "weakest",
    "the panel must OPEN on the mode's name too — the initial render is its own site");

  // The accessor's fallback exists for a mode that declares no name. Nothing in
  // shipped data does, so it is proven by removing one at runtime: without it
  // the button renders the string "undefined" at the player.
  const stripped = await page.evaluate(() => {
    const keep = window.TDData.TARGETING.close.name;
    delete window.TDData.TARGETING.close.name;
    const b = document.querySelector("#screen-td-play .td-target");
    // BOUNDED. An unbounded cycle-until-you-see-it does not fail when the label
    // stops containing the id, it HANGS — which is exactly what happened when the
    // fallback was mutated away and the button started rendering "undefined".
    let guard = 0, sawUndefined = false;
    while (!/close/.test(b.textContent) && guard++ < 12) {
      if (/undefined/.test(b.textContent)) sawUndefined = true;
      b.click();
    }
    const txt = b.textContent.replace("🎯", "").trim();
    window.TDData.TARGETING.close.name = keep;
    return { txt, gaveUp: guard >= 12, sawUndefined };
  });
  assert.ok(!stripped.sawUndefined,
    'a mode with no declared name rendered the string "undefined" at the player');
  assert.ok(!stripped.gaveUp,
    "the cycle never reached the name-less mode by its id — the fallback is gone");
  assert.equal(stripped.txt, "close",
    `a mode with no declared name must fall back to its id, not render "${stripped.txt}"`);
  await tapPad(); await tapPad();   // reopen cleanly for the cycle walk below

  // Cycle through every mode the run can reach and read the label each time.
  const seen = [];
  for (let i = 0; i < ids.length + 1; i++) {
    const txt = (await btn.textContent()).replace("🎯", "").trim();
    seen.push(txt);
    await btn.click();
    await page.waitForTimeout(90);
  }
  for (const label of seen) {
    assert.ok(names.includes(label),
      `the 🎯 button showed "${label}", which is not a mode's declared NAME ` +
      `(${names.join(", ")}) — the engine's id must never reach the player`);
  }
  assert.ok(new Set(seen).size >= 3,
    `fixture: the button must actually cycle (saw ${JSON.stringify(seen)})`);
  assert.ok(seen.includes("weakest"),
    `the cycle must reach the mode whose name diverges from its id (saw ${JSON.stringify(seen)})`);
  await page.evaluate(() => window.__TD.resetSave());
  await page.waitForTimeout(60);
});

test("QoL: a full Powers pack refuses the CARD you tap, not just the ＋ beside it", async () => {
  // The pack holds RULES.abilitySlots and the pool is larger, so an un-packed
  // power at capacity has to be refused. It was — on the 48px ＋ button only.
  // The whole ROW is the real target at 255px, and it stayed enabled, so tapping
  // the obvious thing did nothing at all and said nothing about why: the fort's
  // own "a control that can't be used says why" law inverted, with the tiny
  // control showing the refusal and the big one swallowing it.
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.locator("#screen-td-home .td-powers-open").click();
  await page.waitForTimeout(300);

  const read = () => page.evaluate(() => {
    const rows = [...document.querySelectorAll(".td-overlay [data-power]")];
    const un = rows.find((r) => !r.classList.contains("td-node--on"));
    const on = rows.find((r) => r.classList.contains("td-node--on"));
    const plus = un ? document.querySelector('[data-equippow="' + un.dataset.power + '"]') : null;
    return {
      pool: rows.length,
      packed: rows.filter((r) => r.classList.contains("td-node--on")).length,
      rowW: un ? Math.round(un.getBoundingClientRect().width) : 0,
      plusW: plus ? Math.round(plus.getBoundingClientRect().width) : 0,
      rowRefused: un ? un.disabled : null,
      rowWhy: un ? (un.title || "") : "",
      rowDim: un ? +getComputedStyle(un).opacity : 1,
      packedStillTappable: on ? !on.disabled : null,
    };
  });
  const slots = await page.evaluate(() => window.TDData.RULES.abilitySlots);
  let s = await read();
  assert.ok(s.pool > slots,
    `fixture: the pool (${s.pool}) must be larger than the pack (${slots}), or nothing is ever refused`);
  assert.equal(s.packed, slots, "fixture: the pack starts full, which is the state under test");
  assert.ok(s.rowW > s.plusW * 2,
    `fixture: the row (${s.rowW}px) must be the bigger target than the ＋ (${s.plusW}px) — ` +
    "that is why the refusal has to reach it");

  assert.equal(s.rowRefused, true,
    "at capacity the un-packed power's whole CARD must be refused, not only its ＋");
  assert.ok(s.rowWhy.length > 0,
    "…and the refusal must say why — a dead tap with no reason reads as a broken button");
  assert.ok(s.rowDim < 0.8,
    `a refused card must LOOK refused (opacity ${s.rowDim}) — one that looks tappable and is not is worse than none`);

  // Un-packing must never be trapped: the way to make room has to stay live.
  assert.equal(s.packedStillTappable, true,
    "a PACKED power must stay tappable at capacity, or the last slot is a one-way door");
  await page.evaluate(() => {
    [...document.querySelectorAll(".td-overlay [data-power]")]
      .find((r) => r.classList.contains("td-node--on")).click();
  });
  await page.waitForTimeout(250);
  s = await read();
  assert.equal(s.packed, slots - 1, "un-packing must actually free a slot");
  assert.equal(s.rowRefused, false, "…and the refused card must come back to life once there is room");

  await page.evaluate(() => window.TDUI.closeOverlay());
  await page.evaluate(() => window.__TD.resetSave());
  await page.waitForTimeout(60);
});

test("QoL: an endless run's LAST screen says what beat you — and names the badge it just earned", async () => {
  // showDefeat rendered the post-mortem, the run summary and the earned-badge
  // line ONLY inside the campaign arm of its head ternary. Endless and daily
  // passed `null, null` and wired no guide hook, so the ONE outcome screen
  // those modes ever show carried a score and nothing else. That is backwards:
  // an endless run ends ONLY in defeat, and with no next level and no
  // same-seed retry, building differently is the only way to do better — which
  // is exactly what the post-mortem and the "which towers carried?" summary
  // are for.
  //
  // The badge half was a real defect rather than a coverage gap. announce()
  // DEFERS while the phase is won/lost, drainEarned() hands the list to
  // showDefeat, and the endless arm dropped it on the floor — so 🏃 Marathoner,
  // the one badge whose only award path is an endless run, was earned in total
  // silence: no toast (deferred) and no line (discarded). The two paths
  // disagreed, which is the tell: QUITTING at wave 20+ announces it, because
  // leavingPlay awards it while the phase is NOT an outcome and announce then
  // toasts, while playing on until you die announced nothing.
  //
  // Seed 1066 is the pinned board from the Marathoner fixture — a clock-seeded
  // endless run is the one non-deterministic input in this suite and shipped a
  // 1-in-200 cliff once. Reaching wave 20 needs a real board; DYING then needs
  // that board gone, because a maxed one survives past 400k ticks.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const out = await page.evaluate(() => {
    window.__TD.resetSave();
    window.__TD.startEndless("bedroom", { seed: 1066 });
    const pads = window.TDData.ENDLESS.arenas.bedroom.pads;
    const LINES = ["dart", "mortar", "fan", "dart"];
    let stalled = "";
    for (let w = 0; w < 24; w++) {
      const st = window.__TD.state();
      if (!st || st.phase === "lost" || st.waveIdx >= 21) break;
      window.__TD.script(pads.map((p, i) => ["place", LINES[i % LINES.length], p.id]));
      const ups = [];
      for (let i = 0; i < window.__TD.state().towers.length; i++) ups.push(["upgrade", i], ["upgrade", i]);
      window.__TD.script(ups);
      window.__TD.script([["call"], ["untilPhase", "build", 400000]]);
      const after = window.__TD.state();
      if (after.phase !== "build" && after.phase !== "lost") { stalled = "wave " + w + " never returned to build (phase " + after.phase + ")"; break; }
    }
    const reached = window.__TD.state().waveIdx;
    // Read BEFORE the run ends: the badge must still be unearned here, or the
    // announcement clause below proves nothing about the defeat screen.
    const hadAch = window.__TD.ach().indexOf("marathoner") >= 0;
    // Tear the board down so the run can actually END. `sell` takes an INDEX,
    // and selling compacts the list, so this sells index 0 N times.
    const sold = window.__TD.state().towers.length;
    window.__TD.script(new Array(sold).fill(0).map(() => ["sell", 0]));
    for (let i = 0; i < 40 && window.__TD.state().phase !== "lost"; i++) {
      window.__TD.script([["call"], ["untilPhase", "build", 60000]]);
    }
    const st = window.__TD.state();
    return { reached, hadAch, sold, phase: st.phase, lives: st.lives, stalled, cheated: !!st.cheated };
  });

  assert.equal(out.cheated, false, "fixture precondition: an honest run, or every award is suppressed");
  assert.equal(out.stalled, "", `fixture precondition: every wave must finish (${out.stalled})`);
  assert.ok(out.reached >= 20,
    `fixture precondition: the board must survive to wave 20 to earn Marathoner (reached ${out.reached})`);
  assert.equal(out.hadAch, false,
    "fixture precondition: 🏃 Marathoner must still be unearned here — it is earned AT the defeat");
  assert.ok(out.sold > 0, `fixture precondition: there was a board to tear down (sold ${out.sold})`);
  assert.equal(out.phase, "lost",
    `fixture precondition: the run must actually END (phase ${out.phase}, ${out.lives} lives)`);
  await page.locator(".td-overlay--lose").waitFor({ state: "visible", timeout: 10000 });

  const pm = page.locator(".td-overlay--lose .td-pm");
  assert.equal(await pm.count(), 1,
    "an endless defeat carries the post-mortem, not just a score — it is the mode's only feedback");
  assert.ok((await page.locator(".td-overlay--lose .td-pm__list li").count()) >= 1,
    "…and names the toys that got past you");
  // A SEPARATE clause: the summary and the post-mortem are two blocks, and a
  // mutation can drop either one alone.
  assert.equal(await page.locator(".td-overlay--lose .td-sum").count(), 1,
    "…and the run summary, which in endless is the only 'which towers carried?' there is");
  const earnedLines = await page.locator(".td-overlay--lose .td-earned__line").allTextContents();
  assert.ok(earnedLines.some((t) => /Marathoner/.test(t)),
    "🏃 Marathoner is earned by THIS run's defeat, so it must be announced on THIS screen — " +
    `saw ${JSON.stringify(earnedLines)}`);

  // The box grew by three panels, so prove the way OUT is still reachable. Two
  // proxies had to be discarded to get here. `scrollHeight > clientHeight` is
  // content OVERFLOW, which a box that CLIPS reports identically to one that
  // scrolls. And setting scrollTop is a proxy too — `overflow-y: hidden` is
  // still PROGRAMMATICALLY scrollable, so a box the player cannot move at all
  // happily hands the button over to a test. Measured: the box really does
  // overflow at 320x480 (530 into 452) and in short landscape (503 into 362),
  // so this is a live check, not a formality. The honest property is that a
  // PERSON can reach it: either it is already in view, or the box is
  // user-scrollable AND scrolling brings it in.
  for (const size of [[320, 480], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width: size[0], height: size[1] });
    await page.waitForTimeout(60);
    const reach = await page.evaluate(() => {
      const box = document.querySelector(".td-overlay--lose .td-overlay__box");
      const oy = getComputedStyle(box).overflowY;
      const inView = () => {
        const r = box.querySelector('[data-act="quit"]').getBoundingClientRect();
        return { ok: r.top >= -1 && r.bottom <= window.innerHeight + 1, top: r.top, bottom: r.bottom };
      };
      box.scrollTop = 0;
      const unscrolled = inView();
      box.scrollTop = box.scrollHeight;
      const scrolled = inView();
      return { userScrollable: oy === "auto" || oy === "scroll", unscrolled, scrolled, vh: window.innerHeight };
    });
    assert.ok(reach.unscrolled.ok || (reach.userScrollable && reach.scrolled.ok),
      `🏰 Back to the fort stays reachable at ${size[0]}x${size[1]} — it sits ` +
      `${Math.round(reach.unscrolled.top)}..${Math.round(reach.unscrolled.bottom)} of ${reach.vh} unscrolled, ` +
      `${Math.round(reach.scrolled.top)}..${Math.round(reach.scrolled.bottom)} scrolled, ` +
      `and the box is ${reach.userScrollable ? "" : "NOT "}user-scrollable`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(60);

  // LAST, because the guide hook closes the defeat overlay to open the guide:
  // without the hook the click handler early-returns on a missing key and the
  // button is simply DEAD, which is worse than not offering one.
  await page.locator(".td-overlay--lose .td-pm__guide").click();
  await page.locator(".td-overlay--guide").waitFor({ state: "visible", timeout: 5000 });
  await page.locator(".td-guide-done").click();
});

test("QoL: a locked level says WHICH LEVEL opens it, not a number of stars", async () => {
  // The visible label read "win 8 ⭐" while the rule one line above it is
  // `beatenOn(save, selDiff, n - 1)` — beat the PREVIOUS LEVEL. Those are not
  // the same claim and they genuinely diverge: 3★ + 3★ + 2★ is eight stars from
  // three levels, and level 9 stays shut. The aria-label beside it had ALREADY
  // been corrected to "Win level 8 to open it" — its own comment says why — so
  // the ink and the spoken name were making different claims about the same
  // card. The fix had been applied where it was found and not where the same
  // fact also appears.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => window.__TD.resetSave());
  // A reload keeps the hash, and setting it to what it already is is a no-op —
  // hop away first or route() never runs.
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const cards = await page.evaluate(() => {
    return [...document.querySelectorAll(".td-level__need")].map((el) => {
      const card = el.closest(".td-level");
      const n = parseInt(card.querySelector(".td-level__n").textContent, 10);
      const rng = document.createRange(); rng.selectNodeContents(el);
      return { n, text: el.textContent, aria: card.getAttribute("aria-label") || "",
               inkW: rng.getBoundingClientRect().width,
               cardW: card.getBoundingClientRect().width };
    });
  });
  assert.ok(cards.length >= 10,
    `fixture precondition: a fresh save leaves most levels locked (saw ${cards.length})`);
  for (const c of cards) {
    assert.ok(!/⭐/.test(c.text),
      `level ${c.n}'s locked label must not price the unlock in stars — it is not the rule (saw "${c.text}")`);
    // It must name the LEVEL that opens it, and name the same one the
    // accessible name does: one number, one unit, two surfaces.
    const m = /win level (\d+)/i.exec(c.text);
    assert.ok(m, `level ${c.n}'s locked label names the level that opens it (saw "${c.text}")`);
    assert.equal(Number(m[1]), c.n - 1,
      `level ${c.n} opens by winning level ${c.n - 1} (label says ${m[1]})`);
    const a = /Win level (\d+) to open it/i.exec(c.aria);
    assert.ok(a && Number(a[1]) === Number(m[1]),
      `the ink and the spoken name must name the SAME level (ink "${c.text}" vs aria "${c.aria}")`);
  }
  // The longest label is a two-digit one ("win level 10"); digits are tabular,
  // so every two-digit card ties. It must still fit the narrowest card.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(60);
  const fit = await page.evaluate(() => {
    let worst = null;
    for (const el of document.querySelectorAll(".td-level__need")) {
      const rng = document.createRange(); rng.selectNodeContents(el);
      const w = rng.getBoundingClientRect().width;
      const cw = el.closest(".td-level").getBoundingClientRect().width;
      if (!worst || w > worst.w) worst = { w, cw, text: el.textContent };
    }
    return worst;
  });
  assert.ok(fit.w <= fit.cw - 8,
    `the widest locked label fits a 320px card ("${fit.text}" is ${Math.round(fit.w)}px of ${Math.round(fit.cw)}px)`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(60);
});

test("QoL: a first win shows no 'best', because there isn't one yet", async () => {
  // The victory path WRITES the new best a few lines before the summary was
  // built, and the summary read the save — so a first-ever win rendered
  // "Best here: 16 stickers kept" directly beneath its own "16 of 20 stickers
  // kept safe": a record restated from the run you are looking at, when no
  // record existed. Same class as the endless picker's bare "🏆 12" and
  // Marathoner's "0 of 20" — a number shown before there is anything to show —
  // and it fired on every first clear, which is 40 levels x 3 ladders.
  //
  // `wasBeaten` three lines above it already carried the fix's own comment:
  // captured BEFORE the write, "the only moment the question is answerable".
  const read = () => page.evaluate(() => {
    const box = document.querySelector(".td-overlay--win .td-overlay__box");
    const pb = box.querySelector(".td-sum__pb");
    const lines = [...box.querySelectorAll(".td-sum__line")].map((e) => e.textContent.trim());
    return { pb: pb ? pb.textContent.trim() : null,
             best: lines.find((t) => /Best here/.test(t)) || null,
             lives: Number((box.textContent.match(/(\d+) of \d+ stickers/) || [])[1]) };
  });
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });

  await page.evaluate(() => { window.__TD.resetSave(); window.__TD.winL1(); });
  await page.locator(".td-overlay--win").waitFor({ state: "visible", timeout: 25000 });
  const first = await read();
  assert.ok(first.lives > 0, `fixture precondition: the run finished with lives (${first.lives})`);
  assert.equal(first.best, null,
    `a first-ever win has no record to report (saw "${first.best}")`);

  // A record that is HIGHER than this run: the line must quote the RECORD, not
  // the run — which is what catches a summary that reports the current score.
  await page.evaluate(() => window.TDUI.closeOverlay());
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("jon-td-save-v1"));
    s.bests["1:normal"] = { lives: 19, stars: 3 };
    localStorage.setItem("jon-td-save-v1", JSON.stringify(s));
  });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.evaluate(() => { window.__TD.winL1(); });
  await page.locator(".td-overlay--win").waitFor({ state: "visible", timeout: 25000 });
  const worse = await read();
  assert.ok(worse.lives < 19, `fixture precondition: this run is worse than the seeded record (${worse.lives})`);
  assert.ok(worse.best && /19/.test(worse.best),
    `the line quotes the RECORD that stood before this run, not this run (saw "${worse.best}")`);
  assert.equal(worse.pb, null, "…and a worse run is not a personal best");
  await page.evaluate(() => window.TDUI.closeOverlay());
});

test("a hostile save still boots and plays — every persisted field, wrong-typed", async () => {
  // The boot loader's coercions have a DERIVED structural law already: every
  // field it coerces must also appear in freshSave(). That proves the coercion
  // exists; it cannot prove the coercion WORKS. This is the standing pairing —
  // a scan proves a call site exists, only driving it proves the call does
  // anything — on the highest-recidivism defect class in this codebase: a
  // persisted field read without a default has crashed the fort three times
  // (save.ach on a legacy save, then save.stars on the first win, then
  // settings.music inside the restore window).
  //
  // The POPULATION is derived from the loader itself, with the same patterns
  // the structural law uses, so a new persisted field inherits a hostile case
  // the moment it is coerced. Measured clean when written — this is coverage,
  // not a fix.
  const fs = require("node:fs"), path = require("node:path");
  const tdm = fs.readFileSync(path.join(__dirname, "..", "scripts", "td-main.js"), "utf8");
  const fields = new Set();
  for (const line of tdm.split("\n")) {
    let m = /^\s*if \(.*\bsave\.([A-Za-z]+)\b.*\)\s*save\.\1 =/.exec(line);
    if (!m) m = /^\s*if \(!\("([A-Za-z]+)" in save\)\)\s*save\.\1 =/.exec(line);
    if (m) fields.add(m[1]);
  }
  assert.ok(fields.size >= 8,
    `the loader's coercions must be findable (found ${fields.size}: ${[...fields].join(", ")})`);

  // Wrong-typed per derived field, plus NESTED shapes the top-level derivation
  // structurally cannot reach — settings.music is exactly the one that threw
  // "Cannot read properties of undefined (reading 'music')".
  const cases = [];
  for (const f of fields) cases.push([`${f} = 7`, { v: 1, stars: {}, [f]: 7 }]);
  for (const f of fields) cases.push([`${f} = "x"`, { v: 1, stars: {}, [f]: "x" }]);
  cases.push(["settings has no keys", { v: 1, stars: {}, settings: {} }]);
  cases.push(["settings wrong types", { v: 1, stars: {}, settings: { sfx: "yes", music: 7, speed: "fast" } }]);
  cases.push(["a star ladder is null", { v: 1, stars: { normal: null, casual: 3 } }]);
  cases.push(["arrays full of null", { v: 1, stars: {}, ach: [null], meta: [null], powers: [null], chipsArmed: [null] }]);
  cases.push(["difficulty is unknown", { v: 1, stars: {}, difficulty: "impossible" }]);

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  let errs = [];
  p.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
  const bad = [];
  try {
    await p.goto(baseURL, { waitUntil: "load" });
    for (const [name, blob] of cases) {
      errs = [];
      await p.evaluate((b) => localStorage.setItem("jon-td-save-v1", JSON.stringify(b)), blob);
      await p.reload({ waitUntil: "load" });
      await p.evaluate(() => { location.hash = "#td-home"; });
      let cards = -1, played = "";
      try {
        await p.locator("#screen-td-home").waitFor({ state: "visible", timeout: 5000 });
        cards = await p.locator(".td-level").count();
        // Nothing corrupt may reach the player as NaN. `midRun: 7` — or even
        // `{}` — used to render "▶ Resume: ♾️ Endless · wave NaN ♾️": a run that
        // does not exist, mislabelled Endless because an absent levelId falls
        // through to runLabel's endless branch.
        const nan = await p.evaluate(() => {
          const el = document.querySelector("#screen-td-home");
          return /NaN|undefined/.test(el ? el.textContent : "");
        });
        if (nan) { bad.push(`${name}: the fort home shows NaN/undefined to the player`); }
        await p.evaluate(() => { location.hash = "#td-play"; });
        await p.locator("#screen-td-play").waitFor({ state: "visible", timeout: 5000 });
        // Play for real: place, call, tick. A save that boots and then throws on
        // the first wave is the shape that actually shipped.
        played = await p.evaluate(() => {
          window.__TD.newGame(1, { seed: 5 });
          window.__TD.script([["place", "dart", "p1"], ["call"], ["tick", 120]]);
          const st = window.__TD.state();
          return st ? "wave " + st.waveIdx + " lives " + st.lives : "NO STATE";
        });
      } catch (e) { played = "THREW " + String(e).split("\n")[0].slice(0, 60); }
      if (errs.length || cards <= 0 || !/^wave /.test(played)) {
        bad.push(`${name}: cards=${cards} play=${played}${errs.length ? " ERR=" + errs[0] : ""}`);
      }
    }
  } finally {
    await ctx.close();
  }
  assert.deepEqual(bad, [],
    `a corrupt or hand-edited save must degrade, never crash — the fort has to boot AND play:\n  ${bad.join("\n  ")}`);
});
