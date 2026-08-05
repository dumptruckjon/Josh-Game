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
    return { disabled: b.disabled, title: b.title, label: b.getAttribute("aria-label") };
  });
  assert.ok(build.disabled, "during build the exchange is refused (it is wave-only, like every timed effect)");
  assert.match(build.title + " " + build.label, /wave/i, "…and it SAYS the wave is why");

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
    const before = { charge: st.charge, gold: st.gold, disabled: b.disabled, buyable: b.classList.contains("is-buyable") };
    b.click();
    await new Promise((r) => setTimeout(r, 60));
    const after = { charge: st.charge, gold: st.gold, disabled: b.disabled, title: b.title };
    b.click();                                  // the capped second tap
    await new Promise((r) => setTimeout(r, 60));
    return { before, after, capped: { charge: st.charge, gold: st.gold }, price: window.TDData.RULES.chargeBuyBase };
  });
  assert.ok(!out.before.disabled && out.before.buyable,
    "mid-wave with gold the chip is live and looks it");
  assert.equal(out.after.charge, out.before.charge + 1, "the tap actually grants the energy");
  assert.equal(out.after.gold, out.before.gold - out.price, "…and charges exactly the quoted price");
  assert.ok(out.after.disabled, "a second tap in the same wave is refused — the cap is the safety property");
  assert.match(out.after.title, /wave/i, "…and the chip says the per-wave limit is why");
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
    // the field's box spans the screen — not the padded content box
    if (g.wrapW < vp.width - 1) bad.push(`${tag}: the field box is ${g.wrapW}px inside a ${vp.width}px screen (side padding is taxing the battlefield)`);
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
    const N = 50, t0 = performance.now();
    for (let i = 0; i < N; i++) r.draw(i / N);
    return { alive, ms: (performance.now() - t0) / N };
  });
  assert.ok(out.alive >= 20, `the board is genuinely crowded for this measurement (${out.alive} alive)`);
  assert.ok(out.ms < 12, `a draw at the crowded peak took ${out.ms.toFixed(2)} ms with ${out.alive} enemies alive — the 60fps budget is 16.7 ms and the measured baseline is ~3.5`);
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
    return { text: el && el.textContent, state: window.__TD.state().charge };
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
    return { ok: r.ok, state: window.__TD.state().charge, text: document.querySelector("#screen-td-play .td-hud__charge").textContent };
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
  assert.equal(out.steps[1].branchesShown, 2, "at tier 3 the panel re-renders into the two branch cards");
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
