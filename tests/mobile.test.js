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

test("home launcher: no overflow + big well-spaced tiles at 390 and 320", async () => {
  for (const w of [390, 320]) {
    await page.setViewportSize({ width: w, height: 780 });
    await page.evaluate(() => { location.hash = ""; });
    await page.locator("#screen-home").waitFor({ state: "visible" });
    await noOverflow(page, `home@${w}`);
    await auditActiveScreen(page, `home@${w}`);
  }
});

test("EVERY category screen: no overflow + big well-spaced tiles at 320px", async () => {
  // Josh's categories route as #cat-<id>; 华丽's (#hl-cat-…) are audited in
  // their own test below, so enumerate only the tiles on HIS home grid.
  const cats = await page.evaluate(() => [...document.querySelectorAll("#screen-home .tile--cat")].map((t) => t.dataset.cat));
  assert.ok(cats.length >= 3, "expected several categories");
  await page.setViewportSize({ width: 320, height: 780 });
  for (const c of cats) {
    await page.evaluate((id) => { location.hash = "#cat-" + id; }, c);
    await page.locator(`#screen-cat-${c}`).waitFor({ state: "visible", timeout: 15000 });
    await noOverflow(page, "cat-" + c);
    await auditActiveScreen(page, "cat-" + c);
  }
});

test("EVERY game screen: no overflow + >=75px well-spaced targets at 320px", async () => {
  const ids = await gameIds();
  await page.setViewportSize({ width: 320, height: 780 });
  for (const id of ids) {
    await page.evaluate((i) => { location.hash = "#" + i; }, id);
    await page.locator(`#screen-${id}`).waitFor({ state: "visible", timeout: 15000 });
    await noOverflow(page, id);
    await auditActiveScreen(page, id);
  }
});

test("the Sticker Book: no overflow + >=75px well-spaced slots at 390 and 320", async () => {
  for (const w of [390, 320]) {
    await page.setViewportSize({ width: w, height: 780 });
    await page.evaluate(() => { location.hash = "#stickers"; });
    await page.locator("#screen-stickers").waitFor({ state: "visible", timeout: 15000 });
    await noOverflow(page, `stickers@${w}`);
    await auditActiveScreen(page, `stickers@${w}`);
  }
});

test("the Buddy picker: no overflow + >=75px options at 390 and 320", async () => {
  for (const w of [390, 320]) {
    await page.setViewportSize({ width: w, height: 780 });
    await page.evaluate(() => { location.hash = ""; });
    await page.locator("#screen-home").waitFor({ state: "visible" });
    await page.locator(".buddy__pick").click();
    await page.locator(".buddyc").waitFor({ state: "visible" });
    await noOverflow(page, `buddyc@${w}`);
    await auditActiveScreen(page, `buddyc@${w}`); // the size audit covers the visible picker options
    await page.locator(".buddyc").evaluate((el) => { el.hidden = true; }); // close before the next screen
  }
});

test("华丽's screens: home, all 7 categories and her sticker book pass the audit at 390 & 320", async () => {
  // Her nav shells are session-gated; set the flag the way the gate would.
  await page.evaluate(() => { sessionStorage.setItem("hl-ok", "1"); });
  const cats = await page.evaluate(() =>
    (window.HualiContent ? window.HualiContent.CATEGORIES : []).map((c) => c.id));
  assert.equal(cats.length, 7, "expected her 7 categories");
  for (const w of [390, 320]) {
    await page.setViewportSize({ width: w, height: 780 });
    await page.evaluate(() => { location.hash = "#hl-home"; });
    await page.locator("#screen-hl-home").waitFor({ state: "visible", timeout: 15000 });
    await noOverflow(page, `hl-home@${w}`);
    await auditActiveScreen(page, `hl-home@${w}`);
    for (const c of cats) {
      await page.evaluate((id) => { location.hash = "#hl-cat-" + id; }, c);
      await page.locator(`#screen-hl-cat-${c}`).waitFor({ state: "visible", timeout: 15000 });
      await noOverflow(page, `hl-cat-${c}@${w}`);
      await auditActiveScreen(page, `hl-cat-${c}@${w}`);
    }
    await page.evaluate(() => { location.hash = "#hl-stickers"; });
    await page.locator("#screen-hl-stickers").waitFor({ state: "visible", timeout: 15000 });
    await noOverflow(page, `hl-stickers@${w}`);
    await auditActiveScreen(page, `hl-stickers@${w}`);
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

test("no uncaught page errors on mobile", () => {
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
});
