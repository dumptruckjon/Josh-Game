// Mobile / iOS Safari checks. Real WebKit (Safari's engine) in CI, Chromium
// iPhone-emulation locally. Validates responsive layout AND the kid tap rules on
// the home launcher AND every game screen: no horizontal overflow at 390 & 320,
// every visible tap target >= 75px, and no overlapping/too-close targets.
//
// Set JOSH_BASE_URL to run against the LIVE deployed site (CI verify-live).

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { startServer, launchMobileBrowser } = require("./helpers");

const MIN_TAP = 75;
const MIN_GAP = 14; // design target is 16px; 2px slack absorbs sub-pixel measurement

const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
    "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

let server, browser, context, page, engine, baseURL;
const pageErrors = [];

before(async () => {
  ({ server, baseURL } = await startServer());
  ({ browser, engine } = await launchMobileBrowser());
  const opts = engine === "webkit"
    ? { viewport: IPHONE.viewport, hasTouch: true, isMobile: true }
    : IPHONE;
  context = await browser.newContext(opts);
  page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(baseURL, { waitUntil: "load" });
  // eslint-disable-next-line no-console
  console.log(`[mobile] engine=${engine} url=${baseURL}`);
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((r) => server.close(r));
});

async function gameIds() {
  return page.evaluate(() => (window.JoshGames || []).map((g) => g.id));
}

// Navigate to a screen by hash, RESILIENT to a dropped hashchange event. Walking
// ~200 screens in one long-lived WebKit context, the browser can coalesce/drop a
// hashchange under load, so the router never switches and the target stays
// `hidden` (observed as "N× resolved to hidden" until timeout — the screen is
// fine, the event was lost). Re-firing the hash (dummy → target) forces a fresh
// hashchange. This never weakens the audit — the screen still MUST become
// visible; it just makes the trigger reliable so load can't redden CI.
async function showScreen(p, hash, sel) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await p.evaluate((h) => { if (location.hash === h) location.hash = "#__renav"; location.hash = h; }, hash);
    try { await p.locator(sel).waitFor({ state: "visible", timeout: 5000 }); return; }
    catch (e) { /* dropped/slow under load — re-fire and retry */ }
  }
  await p.locator(sel).waitFor({ state: "visible", timeout: 8000 });
}

// Audit the currently-visible screen: size of ALL visible tap targets, and the
// spacing/overlap of tap targets WITHIN the active play surface.
async function auditActiveScreen(p, label) {
  const tooSmall = await p.evaluate((min) => {
    const out = [];
    for (const el of document.querySelectorAll("button, a[href], [role='button']")) {
      // [data-adult] controls (the grown-ups reset gate) are intentionally small
      // so a preschooler ignores them — the ≥75px rule is a KID-tap requirement.
      if (el.hidden || el.closest("[hidden]") || el.closest("[data-adult]") || el.offsetParent === null) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.width < min || r.height < min) out.push((el.id || el.className) + ":" + Math.round(r.width) + "x" + Math.round(r.height));
    }
    return out;
  }, MIN_TAP);
  assert.deepEqual(tooSmall, [], `[${label}] tap targets under ${MIN_TAP}px: ${tooSmall.join(", ")}`);

  const boxes = await p.evaluate(() => {
    const scr = [...document.querySelectorAll(".screen")].find((s) => !s.hidden);
    const els = scr ? scr.querySelectorAll("button, a[href], [role='button']") : [];
    const out = [];
    for (const el of els) {
      // [data-adult] controls (the grown-ups reset gate) are intentionally small
      // so a preschooler ignores them — the ≥75px rule is a KID-tap requirement.
      if (el.hidden || el.closest("[hidden]") || el.closest("[data-adult]") || el.offsetParent === null) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      out.push({ x: r.x, y: r.y, r: r.right, b: r.bottom });
    }
    return out;
  });
  let overlaps = 0, worstGap = Infinity;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], c = boxes[j];
      const ox = Math.min(a.r, c.r) - Math.max(a.x, c.x);
      const oy = Math.min(a.b, c.b) - Math.max(a.y, c.y);
      if (ox > 1 && oy > 1) { overlaps++; continue; }
      if (ox > 4) worstGap = Math.min(worstGap, Math.max(a.y, c.y) - Math.min(a.b, c.b));
      else if (oy > 4) worstGap = Math.min(worstGap, Math.max(a.x, c.x) - Math.min(a.r, c.r));
    }
  }
  assert.equal(overlaps, 0, `[${label}] ${overlaps} pairs of tap targets overlap`);
  assert.ok(worstGap >= MIN_GAP, `[${label}] targets too close: tightest ${isFinite(worstGap) ? worstGap.toFixed(1) : "n/a"}px (< ${MIN_GAP})`);
}

async function noOverflow(p, label) {
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `[${label}] overflows horizontally by ${overflow}px`);
}

test("the viewport meta opts into safe areas", async () => {
  const content = await page.getAttribute('meta[name="viewport"]', "content");
  assert.match(content, /width=device-width/);
  assert.match(content, /viewport-fit=cover/);
});

test("the front door: three giant world tiles, all ABOVE THE FOLD, marks equally weighted", async () => {
  // This test ran at a fixed 780px height, which is exactly why it never saw
  // the defect: measured on the shipped build, the THIRD door was 152px below
  // the fold at 320x568, 42px at 360x640, 15px at 375x667 and 63px in
  // landscape at 844x390 — with nothing on screen hinting the 🏰 world exists.
  // A world you have to scroll to find is a world a four-year-old does not
  // know about, on the ONLY screen that leads anywhere.
  for (const [w, h] of [[390, 780], [320, 780], [320, 568], [375, 667], [844, 390], [810, 1080]]) {
    await page.setViewportSize({ width: w, height: h });
    await showScreen(page, "#start", "#screen-start");
    assert.equal(await page.locator(".start-tile").count(), 3, "three world tiles");
    await noOverflow(page, `start@${w}x${h}`);
    await auditActiveScreen(page, `start@${w}x${h}`);
    const m = await page.evaluate(() => {
      const ts = [...document.querySelectorAll(".start-tile")];
      return {
        last: Math.max(...ts.map((t) => t.getBoundingClientRect().bottom)),
        // Where each label sits INSIDE its own tile: the three mark boxes used
        // to differ (Josh's SVG portrait inks 56x77 where 👵🏻 inks 58x63 and
        // 🏰 inks 72x70), so the doors did not read as peers.
        offsets: ts.map((t) => Math.round(t.querySelector(".start-tile__label").getBoundingClientRect().top - t.getBoundingClientRect().top)),
        vh: innerHeight,
      };
    });
    assert.ok(m.last <= m.vh,
      `all three doors must be reachable without scrolling at ${w}x${h} — the last one ends ${Math.round(m.last - m.vh)}px past the fold`);
    assert.ok(Math.max(...m.offsets) - Math.min(...m.offsets) <= 4,
      `the three doors must carry equally-weighted marks at ${w}x${h} — label offsets ${m.offsets.join("/")}`);
  }
});

test("home launcher: no overflow + big well-spaced tiles at phone AND tablet sizes", async () => {
  // 768x1024 and 1024x768 are here because a viewport list IS the test — the
  // lesson this repo has now learned three times (the pad-under-CALL audit ran
  // at the only two sizes where the button happens to miss; the flex-gap law
  // guarded only main.css; the VS16 scan named its files by hand). Josh's real
  // device is an iPad and NOTHING measured it: the launcher grew in COLUMN
  // COUNT, so at 768, 810 and 834 wide it served SEVEN columns of 85x120px —
  // the same tile as a 320px phone, at maximum density, with 45-57px of dead
  // gutter each side.
  for (const [w, h] of [[390, 780], [320, 780], [768, 1024], [1024, 768]]) {
    await page.setViewportSize({ width: w, height: h });
    await showScreen(page, "#home", "#screen-home");
    await noOverflow(page, `home@${w}x${h}`);
    await auditActiveScreen(page, `home@${w}x${h}`);
  }
  // …and the tiles must actually get BIGGER, not just more numerous.
  const widthAt = async (w) => {
    await page.setViewportSize({ width: w, height: 1024 });
    await showScreen(page, "#home", "#screen-home");
    return page.evaluate(() => document.querySelector("#screen-home .tile").getBoundingClientRect().width);
  };
  const small = await widthAt(320), big = await widthAt(810);
  assert.ok(big >= small * 1.4,
    `on a tablet the tiles must SCALE, not just multiply — 320px gives ${Math.round(small)}px tiles and 810px gives ${Math.round(big)}px`);
});

test("EVERY category screen: no overflow + big well-spaced tiles at 320px", async () => {
  // Josh's categories route as #cat-<id>; 华丽's (#hl-cat-…) are audited in
  // their own test below, so enumerate only the tiles on HIS home grid.
  const cats = await page.evaluate(() => [...document.querySelectorAll("#screen-home .tile--cat")].map((t) => t.dataset.cat));
  assert.ok(cats.length >= 3, "expected several categories");
  for (const [w, h] of [[320, 780], [768, 1024]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const c of cats) {
      await showScreen(page, "#cat-" + c, `#screen-cat-${c}`);
      await noOverflow(page, `cat-${c}@${w}`);
      await auditActiveScreen(page, `cat-${c}@${w}`);
    }
  }
});

test("EVERY game screen: no overflow + >=75px well-spaced targets at 320px", async () => {
  const ids = await gameIds();
  await page.setViewportSize({ width: 320, height: 780 });
  for (const id of ids) {
    await showScreen(page, "#" + id, `#screen-${id}`);
    await noOverflow(page, id);
    await auditActiveScreen(page, id);
  }
});

test("the Sticker Book: no overflow + >=75px well-spaced slots at phone AND tablet sizes", async () => {
  for (const w of [390, 320, 768, 1024]) {
    await page.setViewportSize({ width: w, height: 780 });
    await showScreen(page, "#stickers", "#screen-stickers");
    await noOverflow(page, `stickers@${w}`);
    await auditActiveScreen(page, `stickers@${w}`);
  }
});

test("the Buddy picker: no overflow + >=75px options at 390 and 320", async () => {
  for (const w of [390, 320]) {
    await page.setViewportSize({ width: w, height: 780 });
    await showScreen(page, "#home", "#screen-home");
    await page.locator(".buddy__pick").click();
    await page.locator(".buddyc").waitFor({ state: "visible" });
    await noOverflow(page, `buddyc@${w}`);
    await auditActiveScreen(page, `buddyc@${w}`); // the size audit covers the visible picker options
    await page.locator(".buddyc").evaluate((el) => { el.hidden = true; }); // close before the next screen
  }
});

test("华丽's screens: home, all 7 categories and her sticker book pass the audit at 390 & 320", async () => {
  // Her nav shells open directly now (the name gate was removed by request).
  const cats = await page.evaluate(() =>
    (window.HualiContent ? window.HualiContent.CATEGORIES : []).map((c) => c.id));
  assert.equal(cats.length, 7, "expected her 7 categories");
  for (const w of [390, 320, 768, 1024]) {
    await page.setViewportSize({ width: w, height: 780 });
    await showScreen(page, "#hl-home", "#screen-hl-home");
    await noOverflow(page, `hl-home@${w}`);
    await auditActiveScreen(page, `hl-home@${w}`);
    for (const c of cats) {
      await showScreen(page, "#hl-cat-" + c, `#screen-hl-cat-${c}`);
      await noOverflow(page, `hl-cat-${c}@${w}`);
      await auditActiveScreen(page, `hl-cat-${c}@${w}`);
    }
    await showScreen(page, "#hl-stickers", "#screen-hl-stickers");
    await noOverflow(page, `hl-stickers@${w}`);
    await auditActiveScreen(page, `hl-stickers@${w}`);
  }
  // Her navigation is READ, unlike Josh's. It shipped as the smallest text on
  // the whole site — 12.8px game titles and 15.2px category titles — for the
  // only person here who reads, while her in-game prompt was already sized up
  // to 18.4px. Chinese needs the size: stroke density, not cap height, is the
  // legibility limit. And a title that wraps mid-word ("麻将牌 / 艺") is worse
  // than a small one, which is what three columns produced at 390px.
  for (const w of [390, 320]) {
    await page.setViewportSize({ width: w, height: 780 });
    for (const id of ["#hl-home", "#hl-cat-" + cats[0]]) {
      await showScreen(page, id, "#screen-" + id.slice(1));
      const bad = await page.evaluate((sid) => {
        const out = [];
        for (const l of document.querySelectorAll("#screen-" + sid + " .tile__label")) {
          const fs = parseFloat(getComputedStyle(l).fontSize);
          const rng = document.createRange();
          rng.selectNodeContents(l);
          const lines = rng.getClientRects().length;
          if (fs < 16 || lines > 1) out.push(`${l.textContent} (${fs}px, ${lines} line${lines === 1 ? "" : "s"})`);
        }
        return out;
      }, id.slice(1));
      assert.equal(bad.length, 0,
        `${id}@${w}: every one of her tile labels must be >= 16px and fit on ONE line — ${bad.join("; ")}`);
    }
  }
});

test("a game is playable by touch (Odd-One-Out to a win)", async () => {
  await page.setViewportSize(IPHONE.viewport);
  await page.evaluate(() => { location.hash = "#odd-one-out"; });
  const screen = page.locator("#screen-odd-one-out");
  await screen.waitFor({ state: "visible" });
  let won = false;
  for (let i = 0; i < 60 && !won; i++) {
    won = await screen.evaluate((el) => el.dataset.won === "1");
    if (won) break;
    const correct = screen.locator('[data-correct="1"]').first();
    if ((await correct.count()) === 0) { await page.waitForTimeout(20); continue; }
    await correct.tap({ force: true });
  }
  assert.ok(won, "should be winnable by touch");
});

test("iOS touch hygiene: no accidental double-tap zoom, no long-press text selection", async () => {
  // Reported from real play: "sometimes when double tapping the screen will zoom
  // in and it's often hard to zoom back out", and "touch and hold will highlight
  // element as if it were text". Both came from the same gap — touch-action and
  // user-select were set on TAPPABLE elements only, so every gap between tiles,
  // every label and all the screen padding kept the iOS defaults, and that is
  // exactly where a stray double-tap lands.
  await page.goto(baseURL, { waitUntil: "load" });
  await page.waitForTimeout(200);
  const root = await page.evaluate(() => {
    const cs = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
    const b = cs("body"), h = cs("html");
    return { bodyTouch: b.touchAction, htmlTouch: h.touchAction, bodySel: b.webkitUserSelect || b.userSelect };
  });
  assert.equal(root.bodyTouch, "manipulation", "body must disable double-tap zoom page-wide");
  assert.equal(root.htmlTouch, "manipulation", "…and html, so the ancestor intersection cannot leave a gap");
  assert.equal(root.bodySel, "none", "a long-press on the page must not start a text selection");

  // The exemptions are the RISKY half of this fix: kill selection everywhere and
  // you silently break the only two flows that need a caret and the iOS paste
  // menu — the fort's 💾 Backup box (copy a save out, paste one back) and the
  // type-the-word "reset" gates. Losing paste there is worse than the bug fixed.
  const gate = await page.evaluate(() => {
    const el = document.createElement("input"); document.body.appendChild(el);
    const t = document.createElement("textarea"); document.body.appendChild(t);
    const r = { input: getComputedStyle(el).webkitUserSelect || getComputedStyle(el).userSelect,
                textarea: getComputedStyle(t).webkitUserSelect || getComputedStyle(t).userSelect };
    el.remove(); t.remove(); return r;
  });
  assert.equal(gate.input, "text", "text inputs keep selection — the reset gates must stay typeable");
  assert.equal(gate.textarea, "text", "textareas keep selection — the fort's Backup box must stay copy/pasteable");

  // …and the fort's canvas must KEEP the stricter value: it owns its own
  // gestures, and `none ∩ manipulation` is still `none`. A blanket `*` rule
  // would have loosened it, which is why this fix is scoped, not universal.
  await page.goto(baseURL + "#td-play", { waitUntil: "load" });
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__TD.resetSave(); window.__TD.newGame(1, { seed: 7 }); });
  await page.waitForTimeout(200);
  const canvas = await page.evaluate(() => getComputedStyle(document.querySelector(".td-canvas")).touchAction);
  assert.equal(canvas, "none", "the battlefield canvas still owns its gestures");
  await page.evaluate(() => { window.__TD.resetSave(); });
});

test("no uncaught page errors on mobile", () => {
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
});

test("a game that asks you to COMPARE keeps the two things close, at every size", async () => {
  // 华丽 plays on an iPad, and 两幅找不同's whole task is comparing a top row with
  // a bottom row. The game stage is a grid whose auto rows STRETCH to fill a tall
  // screen — deliberate, and what stops a game stranding its play in the top
  // third — but it was three stage rows, so on 834x1112 the free space split
  // three ways and handed the one-line "▲ above · below ▼" label a 209px row:
  // measured 245x45 on a phone and 245x205 there, with the two pictures ~800px
  // apart and a big empty plate between them. The phone was fine, which is
  // exactly why 390/320 could not see it — a viewport list IS the test.
  //
  // Scoped on purpose. 127 of 240 games have a stretched stage row and for nearly
  // all of them that is the feature working; it is only a defect when the stretch
  // separates the things being COMPARED. So this pins the comparison game rather
  // than changing the stage rule under 240 games.
  // Each size gets a FRESH context, which is how a real device loads the page.
  // Resizing the existing page instead does NOT reproduce the defect: with the
  // fix reverted, setViewportSize(834) still measured 40px while a fresh 834
  // context measured 220px — so the first cut of this test survived its own
  // mutation and was proving nothing.
  const sizes = [{ w: 320, h: 568 }, { w: 390, h: 844 }, { w: 834, h: 1112 }];
  const seen = [];
  for (const s of sizes) {
    const ctx2 = await browser.newContext({ viewport: { width: s.w, height: s.h }, hasTouch: true, isMobile: true });
    const p2 = await ctx2.newPage();
    await p2.goto(baseURL, { waitUntil: "load" });
    await p2.evaluate(() => { location.hash = "#hl-diff"; });
    await p2.locator("#screen-hl-diff").waitFor({ state: "visible" });
    await p2.waitForTimeout(320);
    const m = await p2.evaluate(() => {
      const q = (sel) => document.querySelector("#screen-hl-diff " + sel).getBoundingClientRect();
      const top = q(".hl-diffrow--ref"), bot = q(".hl-diffrow:not(.hl-diffrow--ref)"), vs = q(".hl-diffvs");
      return { gap: Math.round(bot.top - top.bottom), vsH: Math.round(vs.height), rows: Math.round(top.height) };
    });
    await ctx2.close();
    seen.push({ ...s, ...m });
    // the fixture must be real, or the comparison below is vacuous
    assert.ok(m.rows > 20, `${s.w}x${s.h}: the picture rows must actually render (got ${m.rows}px)`);
    assert.ok(m.gap <= 90,
      `${s.w}x${s.h}: the two pictures she must compare are ${m.gap}px apart — the stage stretch is separating them`);
    assert.ok(m.vsH <= 90,
      `${s.w}x${s.h}: the one-line label between them inflated to ${m.vsH}px, so it reads as an empty panel`);
  }
  // …and the layout must not DEPEND on the height: a tablet must get the same
  // spacing as a phone, which is the property that actually broke.
  const gaps = seen.map((x) => x.gap);
  assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 24,
    "the comparison spacing must not grow with the screen: " + JSON.stringify(seen));
});

test("a question stays with its answers when the screen gets TALLER", async () => {
  // The property that actually broke: the visible distance between a question
  // and the answers it belongs to must not GROW with the screen. The stage is a
  // grid whose auto rows used to stretch, so free space was injected BETWEEN the
  // question and the choices — on a tablet that reached 466px on the worst game.
  //
  // Measured ink-to-ink, not box-to-box. A box metric structurally cannot see
  // this defect: the question's own box IS the stretched row, so it reported a
  // 24px gap on a game whose visible emptiness was ~340px. A Range hugs the
  // glyphs; an element box does not.
  const inkBottomAbove = (limitName) => limitName; // (documentation only)
  const sample = ["place-value", "build-word", "end-sound", "fair-share", "hl-mw", "hl-idiom", "hl-riddle"];
  const measure = async (w, h) => {
    const ctx2 = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const p2 = await ctx2.newPage();
    await p2.goto(baseURL, { waitUntil: "load" });
    const out = {};
    for (const id of sample) {
      await p2.evaluate((x) => { location.hash = "#" + x; }, id);
      try { await p2.locator("#screen-" + id).waitFor({ state: "visible", timeout: 3000 }); } catch { continue; }
      await p2.waitForTimeout(220);
      out[id] = await p2.evaluate((x) => {
        const st = document.querySelector("#screen-" + x + " .game__stage");
        if (!st) return null;
        const ans = [...st.querySelectorAll(".choice, .sort__bin, .tap")].filter((n) => n.getBoundingClientRect().height > 8);
        if (!ans.length) return null;
        const top = Math.min(...ans.map((n) => n.getBoundingClientRect().top));
        let ink = -1e9;
        const walk = (node) => {
          if (node.nodeType === 3) {
            if (!node.nodeValue.trim()) return;
            const r = document.createRange(); r.selectNodeContents(node);
            for (const rect of r.getClientRects()) {
              if (rect.height >= 1 && rect.bottom <= top + 1) ink = Math.max(ink, rect.bottom);
            }
            return;
          }
          if (node.nodeType !== 1) return;
          const cs = getComputedStyle(node);
          if (cs.visibility === "hidden" || cs.display === "none") return;
          for (const kid of node.childNodes) walk(kid);
        };
        walk(st);
        return ink < -1e8 ? null : Math.round(top - ink);
      }, id);
    }
    await ctx2.close();
    return out;
  };
  const phone = await measure(390, 844);
  const tablet = await measure(834, 1112);   // 华丽's actual device
  const checked = Object.keys(phone).filter((k) => phone[k] != null && tablet[k] != null);
  assert.ok(checked.length >= 5,
    `the fixture must actually measure games (got ${checked.length}) — a vacuous pass is not a pass`);
  for (const id of checked) {
    assert.ok(tablet[id] <= 160,
      `${id}: ${tablet[id]}px of empty space between the question and its answers on a tablet`);
    assert.ok(tablet[id] - phone[id] <= 80,
      `${id}: the question drifts ${tablet[id] - phone[id]}px further from its answers on a taller screen ` +
      `(phone ${phone[id]}, tablet ${tablet[id]}) — free space is being injected between them`);
  }
});

test("a picture she must COUNT or TELL APART grows with the screen", async () => {
  // 华丽 plays on an iPad. Her find-and-count games doubled their CELLS on a
  // tablet (79 -> 169px) while the glyph inside stayed a phone-sized 32-35px, so
  // 池塘数数 asked a 70-year-old to count turtles among fish and ducks at 32px on
  // a ten-inch screen and 找一找 hid a 35px orange in twelve 230x90px cards, about
  // 5% ink. Josh's world already fixed exactly this for .choice and
  // .sort__binIcon; hers never inherited it.
  //
  // The assertion is a RATIO between two real renders, not a pixel constant —
  // the same shape as the frame-budget guardrail. And the phone value is pinned
  // separately, because the fix is only safe if it changes nothing at 390.
  const glyph = async (w, h) => {
    const ctx2 = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const p2 = await ctx2.newPage();
    await p2.goto(baseURL, { waitUntil: "load" });
    const out = {};
    for (const id of ["hl-koi", "hl-panda", "hl-lantern", "hl-sudoku", "hl-char-odd", "hl-changed", "hl-who-hid"]) {
      await p2.evaluate((x) => { location.hash = "#" + x; }, id);
      try { await p2.locator("#screen-" + id).waitFor({ state: "visible", timeout: 3000 }); } catch { continue; }
      await p2.waitForTimeout(250);
      out[id] = await p2.evaluate((x) => {
        const st = document.querySelector("#screen-" + x + " .game__stage");
        const leaves = [...st.querySelectorAll(".hl-pondcell, .hl-spot, .hl-sudoku .sudoku__cell, .hl-charchip, .hl-row, .hl-lineup")];
        if (!leaves.length) return null;
        return Math.round(Math.min(...leaves.map((n) => parseFloat(getComputedStyle(n).fontSize))));
      }, id);
    }
    await ctx2.close();
    return out;
  };
  const phone = await glyph(390, 844);
  const tablet = await glyph(834, 1112);
  const ids = Object.keys(phone).filter((k) => phone[k] && tablet[k]);
  assert.ok(ids.length >= 7, `the fixture must measure every listed game (got ${ids.length})`);
  for (const id of ids) {
    assert.ok(tablet[id] >= phone[id] * 1.4,
      `${id}: the thing she must tell apart is ${tablet[id]}px on a tablet vs ${phone[id]}px on a phone — ` +
      `the screen grew and the picture did not`);
    // the phone must be untouched: this fix may only ADD room on a big screen
    assert.ok(phone[id] >= 30 && phone[id] <= 46,
      `${id}: the phone glyph moved to ${phone[id]}px — the clamp floor must keep small screens exactly as they were`);
  }
});

test("a card that grows must not keep a phone-sized picture (derived, no lists)", async () => {
  // The sibling of the test above, and the reason both exist: that one names its
  // games and selectors, which is this repo's most-repeated failure mode — a
  // scan's own list is part of the scan. This one names nothing. It walks every
  // one of her games, finds each tappable card whose content is a PICTURE (a
  // leaf with no letters and no digits — the "is this ART" test), and asks
  // whether the picture kept its share of the card when the screen doubled.
  //
  // BE CLEAR ABOUT WHAT IT CANNOT SEE: it catches "the card grew and the picture
  // did not", which was the defect in 找一找, 池塘数数 and 月亮圆缺. It would NOT
  // have caught 两幅找不同, where NEITHER grew and the ratio stayed a perfect 1.0.
  // So the two tests are complementary and neither is sufficient alone.
  //
  // The bar is a RATCHET on shipped behaviour chosen so it can actually FAIL:
  // measured today the eight cards keep 0.73 / 0.78 / 0.78 / 0.83 / 1.0 / 1.0 /
  // 1.29 / 1.42, while pinning 月亮圆缺's moon back to its old fixed 2.6rem
  // computes 0.556. 0.65 sits between the two. An earlier 0.5 passed that
  // mutation, i.e. it could not catch the very defect it was written for.
  const shot = async (w, h) => {
    const ctx2 = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const p2 = await ctx2.newPage();
    await p2.goto(baseURL, { waitUntil: "load" });
    const ids = await p2.evaluate(() => (window.JoshGames || []).filter((g) => g.hl).map((g) => g.id));
    const out = {};
    for (const id of ids) {
      await p2.evaluate((x) => { location.hash = "#" + x; }, id);
      try { await p2.locator("#screen-" + id).waitFor({ state: "visible", timeout: 2500 }); } catch { continue; }
      await p2.waitForTimeout(190);
      const m = await p2.evaluate((x) => {
        const st = document.querySelector("#screen-" + x + " .game__stage");
        if (!st) return null;
        const cards = [...st.querySelectorAll("button, .choice")].filter((n) => {
          const t = (n.textContent || "").trim();
          return t && !/[\p{L}\p{Nd}]/u.test(t);
        });
        if (!cards.length) return null;
        const leafSize = (n) => {
          // The picture is either a leaf CHILD (a card with a face and a back)
          // or the card's own text, which is the common case. Seeding with the
          // card's own font-size measured the CARD rather than the picture;
          // seeding with 0 dropped every card that has no children at all.
          let best = 0;
          let kids = 0;
          for (const k of n.querySelectorAll("*")) {
            if (k.children.length || !(k.textContent || "").trim()) continue;
            if (getComputedStyle(k).display === "none") continue;
            kids++; best = Math.max(best, parseFloat(getComputedStyle(k).fontSize) || 0);
          }
          return kids ? best : (parseFloat(getComputedStyle(n).fontSize) || 0);
        };
        let bw = 0, bf = 0;
        for (const n of cards) {
          const r = n.getBoundingClientRect();
          if (r.width > bw) { bw = r.width; bf = leafSize(n); }
        }
        return bw > 0 && bf > 0 ? { w: bw, f: bf } : null;
      }, id);
      if (m) out[id] = m;
    }
    await ctx2.close();
    return out;
  };
  const phone = await shot(390, 844);
  const tablet = await shot(834, 1112);
  const ids = Object.keys(phone).filter((k) => tablet[k]);
  assert.ok(ids.length >= 6,
    `the scan must actually find her picture cards (got ${ids.length}) — a vacuous pass is not a pass`);
  for (const id of ids) {
    const kept = (tablet[id].f / tablet[id].w) / (phone[id].f / phone[id].w);
    assert.ok(kept >= 0.65,
      `${id}: the card grew ${Math.round(phone[id].w)}->${Math.round(tablet[id].w)}px but its picture only ` +
      `${Math.round(phone[id].f)}->${Math.round(tablet[id].f)}px, keeping ${kept.toFixed(2)} of its share of the card`);
  }
});
