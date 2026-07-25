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

test("pause freezes the sim; the speed toggle doubles it", async () => {
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
  const opts = await page.locator(".td-buildmenu .td-buy").count();
  assert.equal(opts, 4, "dart + mortar + fan + camp are all offered");
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
  assert.equal(await page.locator(".td-branch").count(), 2, "tier 3 offers BOTH branch cards");
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
  // plant the flag ~1.5 cells away (inside the 2.5 rally range)
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

  // toddler chaos on Jon's controls: doubled CALL = ONE bonus; doubled buy = ONE charge
  await page.evaluate(() => { window.__TD.newGame(1, { seed: 77 }); });
  const g0 = await page.evaluate(() => window.__TD.state().gold);
  await page.locator(".td-call").click();
  await page.locator(".td-call").click({ force: true }).catch(() => {});
  let s = await page.evaluate(() => window.__TD.state());
  assert.ok(s.phase === "wave" && s.gold - g0 <= 135, `doubled CALL grants one bonus (+${s.gold - g0})`);
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
  // TD-8: 23 nodes across 3 labeled branches
  assert.equal(await page.locator(".td-node").count(), 23, "23 star-tree nodes");
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

test("TD5 badges + endless: the grid shows 12, and a 3⭐-world unlocks its endless run", async () => {
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  await page.locator(".td-ach-open").click();
  await page.locator(".td-achgrid").waitFor({ state: "visible" });
  assert.equal(await page.locator(".td-ach").count(), 12, "12 badge cells");
  await page.locator(".td-ach-done").click();
  // endless: with all levels 3⭐ (seeded above), every world is unlocked
  await page.locator(".td-endless-open").click();
  await page.locator(".td-endlesspick").waitFor({ state: "visible" });
  const openCount = await page.locator(".td-endless:not(.td-endless--locked)").count();
  assert.ok(openCount >= 1, "at least one endless world is unlocked at 3⭐");
  await page.locator('.td-endless[data-world="bedroom"]').click();
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const st = await page.evaluate(() => window.__TD.state());
  assert.ok(st.endless === true, "an endless run is live");
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

test("TD8 audit: the 23-node star tree is fully reachable + scroll-stable on a SHORT viewport", async () => {
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

test("TD7 L10 lever: the fork level renders, and a real tap on the lever throws the track", async () => {
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const errsBefore = pageErrors.length;
  await page.evaluate(() => { location.hash = "#td-play"; window.__TD.newGame(10, { seed: 7 }); });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  // the multi-lane fork level (two ribbons + the lever glyph) renders with no error
  await page.evaluate(() => { const r = window.__TD.render(); r.resize(); r.draw(0); });
  // start a wave and let a few enemies march onto the default (short) lane
  const before = await page.evaluate(() => { window.__TD.script([["call"], ["tick", 45]]); return window.__TD.state().leverRoute; });
  assert.equal(before, 0, "the track starts on the short (default) lane");
  // a REAL tap on the lever's world position (via the shared world→screen map) throws it
  const canvas = page.locator("#screen-td-play .td-canvas");
  const rect = await canvas.boundingBox();
  const sp = await page.evaluate(() => { const lv = window.__TD.engine().levelDef.lever; return window.__TD.w2s(lv.cx + 0.5, lv.cy + 0.5); });
  // Before the throw, a draw must light the SHORT (default) route on the field.
  const litBefore = await page.evaluate(() => { const r = window.__TD.render(); r.draw(0); return r.leverInfo(); });
  assert.ok(litBefore.hasSeg, "the lever level precomputes its divergent branch segments");
  assert.equal(litBefore.lit, 0, "the route overlay lights the SHORT lane before the throw");
  await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  const after = await page.evaluate(() => ({ route: window.__TD.state().leverRoute, long: window.__TD.state().enemies.some((e) => e.alive && e.pathIdx === 1) }));
  assert.equal(after.route, 1, "the tap threw the lever to the long lane");
  assert.ok(after.long, "enemies on the shared prefix were rerouted the long way");
  // The field overlay must follow the throw: the LONG route lights up now
  // (the persistent-toggle state is readable on the TRACK, not just the button).
  const litAfter = await page.evaluate(() => { const r = window.__TD.render(); r.draw(0); return r.leverInfo().lit; });
  assert.equal(litAfter, 1, "the route overlay lights the LONG lane after the throw");
  assert.equal(pageErrors.length, errsBefore, "the fork level + lever produced no page error");
  await page.evaluate(() => { window.__TD.resetSave(); });
});


test("AUDIT: the thrown L10 lever survives a quit + resume (leverRoute rides the checkpoint)", async () => {
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const st = await page.evaluate(() => {
    window.__TD.resetSave();
    window.__TD.newGame(10, { seed: 7 });
    window.__TD.engine().pullLever(); // send the train the LONG way
    // reach the next wave-boundary checkpoint with a real (thin) build
    window.__TD.script([["place", "dart", "p1"], ["place", "dart", "p5"], ["call"], ["untilPhase", "build", 300000]]);
    const mr = window.__TD.midRun();
    window.__TD.leaveToHome();
    const resumedPhase = window.__TD.resume();
    return { saved: mr ? mr.leverRoute : -1, resumed: window.__TD.state().leverRoute, phase: resumedPhase };
  });
  assert.equal(st.saved, 1, "the checkpoint records the thrown lever (leverRoute 1)");
  assert.equal(st.resumed, 1, "resume restores the LONG route — the player's thrown track is not silently reset");
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
  const waveBuried = [];
  for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
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
        const build = hits("a BUILD-phase control");    // build phase: CALL is up, the strip is not
        window.__TD.script([["call"], ["tick", 20]]);   // wave phase: the strip is up, CALL is not
        window.TDUI.hud(window.__TD.state());
        return { build, wave: hits("a power button") };
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
  // REGRESSION FENCE, stated honestly: building is legal mid-wave, and pads hug
  // the lanes across the whole board, so NO anchor × layout for a 4-button strip
  // buries zero pads (searched all 24 combinations: the best, this bottom-right
  // row, buries 12; the old left column buried 27). Every one of these pads is
  // still fully buildable during the build phase — the loss is only that this
  // handful can't be tapped WHILE the strip is up. The fence stops that number
  // creeping back up.
  assert.ok(waveBuried.length <= 12,
    `the power strip buries ${waveBuried.length} pad centres mid-wave (budget 12): ${waveBuried.join(", ")}`);
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
  assert.equal(wave.call, null, "…and CALL is gone");
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
  const n = await page.evaluate(() => window.TDData.ABILITIES.length);
  assert.equal(await strip.count(), n, `the field carries all ${n} ability buttons`);

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
  const sp = await page.evaluate((a) => window.__TD.w2s(a.x, a.y), aim);
  await page.mouse.click(rect.x + sp.x, rect.y + sp.y);
  await page.waitForTimeout(60);
  assert.ok(await page.evaluate(() => (window.__TD.state().abilityCd || {}).drop > window.__TD.state().tick),
    "the field tap actually SPENT the ability (its cooldown is now running)");
  assert.ok(await page.evaluate(() => document.querySelector('.td-abil[data-abil="drop"]').classList.contains("td-abil--cool")),
    "…and the button shows the cooldown");

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
  assert.deepEqual(after.settings, SEEDED.settings, "sound/graphics settings survive the reset");
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
  for (const l of await page.evaluate(() => window.TDData.LEVELS.filter((x) => x.world === "attic").map((x) => x.name))) {
    assert.ok(names.some((n) => n.indexOf(l.split(" ")[0]) >= 0), `World 4's "${l}" has a card`);
  }
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("🧸 Kid Fort: the button really opens a kid run — big controls, no losing, no stars", async () => {
  // World 4 and Kid Fort shipped with engine coverage only; the BUTTON had never
  // been pressed in a browser. The "a feature whose tests all call the API
  // directly is untested as a FEATURE" lesson, applied to the fort's kid mode.
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  const kidBtn = page.locator(".td-kid-open");
  assert.equal(await kidBtn.count(), 1, "the fort home carries a 🧸 Kid Fort button");
  await kidBtn.click();
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  await page.waitForTimeout(150);
  const st = await page.evaluate(() => ({
    difficulty: window.__TD.state().difficulty,
    cheated: !!window.__TD.state().cheated,
    body: document.body.classList.contains("td-kid"),
    level: window.__TD.state().levelId,
  }));
  assert.equal(st.difficulty, "kid", "the run really is on the kid ladder");
  assert.equal(st.body, true, "…and the kid control skin is painted");
  assert.equal(st.cheated, true, "…and it is marked cheated, so it can never write a star");
  assert.equal(st.level, 1, "…and it opens the first level");

  // RULE 5 is back ON inside body.td-kid: every VISIBLE control is ≥75px.
  const small = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll("#screen-td-play button")) {
      if (el.hidden || el.offsetParent === null) continue;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (b.width < 75 || b.height < 75) bad.push((el.className || "") + " " + Math.round(b.width) + "×" + Math.round(b.height));
    }
    return bad;
  });
  assert.deepEqual(small, [], `kid fort controls under 75px: ${small.join(", ")}`);

  // Leak the whole wave past an empty board: Josh must NEVER see a defeat.
  await page.evaluate(() => { window.__TD.script([["call"], ["tick", 6000]]); });
  const after = await page.evaluate(() => ({ phase: window.__TD.state().phase, lives: window.__TD.state().lives }));
  assert.notEqual(after.phase, "lost", "kid fort never loses, however much gets through");
  assert.ok(after.lives >= 1, `…and hearts never hit zero (${after.lives})`);
  assert.equal(await page.locator(".td-overlay").count(), 0, "no defeat overlay ever appears");

  // …and back out cleanly, with the kid skin removed for the adult fort.
  await page.evaluate(() => { window.__TD.leaveToHome(); });
  await page.waitForTimeout(80);
  await page.evaluate(() => { location.hash = "#td-play"; window.__TD.newGame(1, { seed: 1 }); });
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => document.body.classList.contains("td-kid")), false,
    "starting an adult run takes the kid skin back off");
  await page.evaluate(() => { window.__TD.resetSave(); });
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

test("World 4: an attic level opens, builds, and plays in a real browser", async () => {
  // No browser test had ever entered World 4 — the whole attic was engine-only.
  await page.evaluate(() => { location.hash = "#td-play"; });
  await page.locator("#screen-td-play").waitFor({ state: "visible" });
  const attic = await page.evaluate(() => window.TDData.LEVELS.filter((l) => l.world === "attic").map((l) => l.id));
  assert.equal(attic.length, 4, "World 4 ships four levels");
  for (const id of attic) {
    const ok = await page.evaluate((lid) => {
      window.__TD.newGame(lid, { seed: 11 });
      const r = window.__TD.render(); r.resize(); r.draw(0);
      const st = window.__TD.state();
      window.__TD.script([["place", "dart", window.__TD.engine().levelDef.pads[0].id]]);
      window.__TD.script([["call"], ["tick", 200]]);
      return { built: st.towers.length, phase: st.phase, seen: st.enemies.length, world: window.__TD.engine().levelDef.world };
    }, id);
    assert.equal(ok.world, "attic", `L${id} is an attic level`);
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
    "tapping an attic pad opens the build menu and really places the tower");
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
      for (const v of [1, 2, 3, "a", "b"]) {
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
  for (const line of lines) {
    const s = (v) => sigs[line + ":" + v];
    assert.notEqual(s(1), s(2), `${line}: tier 2 must look different from tier 1`);
    assert.notEqual(s(2), s(3), `${line}: tier 3 must look different from tier 2`);
    assert.notEqual(s(1), s(3), `${line}: tier 3 must look different from tier 1`);
    assert.notEqual(s(3), s("a"), `${line}: the A branch must look different from tier 3`);
    assert.notEqual(s(3), s("b"), `${line}: the B branch must look different from tier 3`);
    assert.notEqual(s("a"), s("b"), `${line}: the two tier-4 branches must not look alike`);
  }
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

test("no uncaught page errors in the fort run", () => {
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
});
