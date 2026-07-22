// Fort Josh TD — browser tests (Chromium): the gate, the guards, real build
// taps, a scripted victory via the shipped __TD hooks (the real-time test
// contract), defeat, pause/speed, kid-world isolation, and mobile-size sanity.
// Works against JOSH_BASE_URL too (verify-live) — it sets its own td-ok flag.

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

test("the 🏰 door exists in the top bar beside the other doors", async () => {
  assert.equal(await page.locator(".topbar #td-door").count(), 1, "td-door in the topbar");
  assert.equal(await page.locator(".topbar #hl-door").count(), 1, "华丽's door still there");
  const box = await page.locator("#td-door").boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44, "door is comfortably tappable");
});

test("the gate rejects every name except exactly 'Jon' (trimmed)", async () => {
  await page.locator("#td-door").click();
  await page.locator(".td-gate").waitFor({ state: "visible" });
  assert.ok(await page.locator('.td-gate__box[data-adult]').count() === 1, "the gate is an adult space");
  for (const wrong of ["Josh", "jon", "JON", "Jon!", "华丽", "dad"]) {
    await page.locator(".td-gate__input").fill(wrong);
    await page.locator(".td-gate__ok").click();
    assert.ok(await page.locator(".td-gate__err").isVisible(), `"${wrong}" must be rejected`);
    assert.equal(await page.evaluate(() => sessionStorage.getItem("td-ok")), null, `"${wrong}" must NOT unlock`);
  }
  await page.locator(".td-gate__input").fill("  Jon  "); // whitespace is forgiven; the name is exact
  await page.locator(".td-gate__ok").click();
  await page.locator("#screen-td-home").waitFor({ state: "visible", timeout: 8000 });
  assert.equal(await page.evaluate(() => sessionStorage.getItem("td-ok")), "1", "Jon unlocks");
  assert.ok(await page.evaluate(() => document.body.classList.contains("td-mode")), "fort theme on");
});

test("fort home shows L1 open and every later level locked on a fresh save", async () => {
  await page.evaluate(() => { window.__TD.resetSave(); location.hash = "#__renav"; });
  await page.waitForTimeout(50);
  await page.evaluate(() => { location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible" });
  assert.equal(await page.locator(".td-level").count(), 12, "12 level cards");
  // fresh save: only L1 is playable; L2..L12 all locked (progression gate)
  assert.equal(await page.locator(".td-level--locked").count(), 11, "11 locked on a fresh save");
  assert.ok(!(await page.evaluate(() => document.querySelectorAll(".td-level")[0].classList.contains("td-level--locked"))), "L1 is open");
  // L2 EXISTS in data but is locked pending an L1 win — it shows a 'win 1 ⭐' hint
  assert.ok(await page.evaluate(() => document.querySelectorAll(".td-level")[1].classList.contains("td-level--locked")), "L2 starts locked");
  assert.ok(await page.evaluate(() => !!document.querySelector(".td-level__need")), "a locked-but-built level explains how to unlock it");
  const box = await page.locator(".td-level").first().boundingBox();
  assert.ok(box && box.height >= 56, "level card is adult-tappable");
});

test("guards: without the session flag every td-* route bounces to Josh's home", async () => {
  // (hash-hop: we're already ON #td-home, and re-setting the same hash fires no
  // hashchange — the openGame-renav lesson. Leave, drop the flag, come back.)
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(100);
  await page.evaluate(() => { sessionStorage.removeItem("td-ok"); location.hash = "#td-home"; });
  await page.waitForFunction(() => location.hash === "", null, { timeout: 8000 });
  await page.locator("#screen-home").waitFor({ state: "visible" });
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("td-mode"))), "theme off when locked out");
  await page.evaluate(() => { sessionStorage.setItem("td-ok", "1"); }); // re-unlock for the rest
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
  assert.ok(save && save.stars && save.stars["1"] >= 1, "the win persisted to jon-td-save-v1");
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
  assert.equal(await speedBtn.textContent(), "2×", "speed toggles to 2×");
  await speedBtn.click();
  assert.equal(await speedBtn.textContent(), "1×");
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

  // leaving the fort restores Josh's topbar and pauses the battle
  await page.evaluate(() => { location.hash = ""; });
  await page.locator("#screen-home").waitFor({ state: "visible" });
  assert.ok(await page.locator(".topbar").isVisible(), "Josh's topbar returns when the fort is left");
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
  const starsBefore = await page.evaluate(() => (JSON.parse(localStorage.getItem("jon-td-save-v1") || "{}").stars || {})["1"] || 0);
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { sessionStorage.setItem("td-ok", "1"); location.hash = "#td-home"; });
  await page.locator("#screen-td-home").waitFor({ state: "visible", timeout: 8000 });
  const starsAfter = await page.evaluate(() => (JSON.parse(localStorage.getItem("jon-td-save-v1") || "{}").stars || {})["1"] || 0);
  assert.equal(starsAfter, starsBefore, "jon-td-save-v1 survives a reload intact");
});

test("AUDIT UI: difficulty selection wires to the engine; panel stats, build roles & wave preview render", async () => {
  // Difficulty selector on the fort home — the engine supports casual/normal/
  // heroic; the choice must actually reach createEngine.
  await page.evaluate(() => { sessionStorage.setItem("td-ok", "1"); location.hash = "#__renav"; });
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
  await page.evaluate(() => { sessionStorage.setItem("td-ok", "1"); location.hash = "#td-play"; });
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
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem("jon-td-save-v1")).stars["1"] >= 1), "the L1 star persisted (real, not cheated)");

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
  await page.evaluate(() => { location.hash = ""; });
  await page.locator("#screen-home").waitFor({ state: "visible" });
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("td-mode"))), "Josh's home is never fort-themed");
});

test("mobile sanity: fort screens fit EVERY device — no horizontal overflow, no vertical scroll on the field", async () => {
  await page.evaluate(() => { sessionStorage.setItem("td-ok", "1"); });
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

test("no uncaught page errors in the fort run", () => {
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
});
