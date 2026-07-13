// Mobile / iOS Safari checks. Runs on real WebKit (Safari's engine) when it's
// installed (CI), otherwise Chromium with iPhone emulation (local fallback).
// Validates responsive layout, touch interaction, and — crucially for a
// preschooler — that every tappable element is BIG (>= 75px) and well spaced.
//
// Set JOSH_BASE_URL to run against the LIVE deployed site (used by CI's
// verify-live job).

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { startServer, launchMobileBrowser } = require("./helpers");

// Minimum tap-target size for little fingers (much bigger than the 44px adult
// minimum) and the minimum finger-safe gap between neighbouring targets.
const MIN_TAP = 75;
const MIN_GAP = 16;

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
  // WebKit rejects some emulation knobs; keep only what it accepts.
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

test("no horizontal overflow at iPhone width (390px)", async () => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  assert.ok(overflow <= 1, `page overflows horizontally by ${overflow}px`);
});

test("no horizontal overflow at a narrow 320px screen (iPhone SE)", async () => {
  const small = await context.newPage();
  try {
    await small.setViewportSize({ width: 320, height: 568 });
    await small.goto(page.url(), { waitUntil: "load" });
    const overflow = await small.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    assert.ok(overflow <= 1, `page overflows by ${overflow}px at 320px wide`);
  } finally {
    await small.close();
  }
});

test("the viewport meta opts into safe areas", async () => {
  const content = await page.getAttribute('meta[name="viewport"]', "content");
  assert.match(content, /width=device-width/);
  assert.match(content, /viewport-fit=cover/);
});

test("every tappable element is >= 75px and well-spaced at 320px", async () => {
  const small = await context.newPage();
  try {
    await small.setViewportSize({ width: 320, height: 700 });
    await small.goto(page.url(), { waitUntil: "load" });

    // 1) Size: every visible button/link is at least 75x75.
    const tooSmall = await small.evaluate((min) => {
      const out = [];
      for (const el of document.querySelectorAll("button, a[href], [role='button']")) {
        if (el.hidden || el.closest("[hidden]") || el.offsetParent === null) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.width < min || r.height < min) {
          out.push((el.id || el.className) + ":" + Math.round(r.width) + "x" + Math.round(r.height));
        }
      }
      return out;
    }, MIN_TAP);
    assert.deepEqual(tooSmall, [], `tappable targets under ${MIN_TAP}px: ${tooSmall.join(", ")}`);

    // 2) Spacing: no two tap boxes overlap, and neighbours keep a finger-safe gap.
    const boxes = await small.$$eval("button, a[href], [role='button']", (els) =>
      els
        .filter((e) => !e.hidden && !e.closest("[hidden]") && e.offsetParent !== null)
        .map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom }; })
    );
    let overlaps = 0, worstGap = Infinity;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], c = boxes[j];
        const ox = Math.min(a.r, c.r) - Math.max(a.x, c.x); // box overlap on X
        const oy = Math.min(a.b, c.b) - Math.max(a.y, c.y); // box overlap on Y
        if (ox > 1 && oy > 1) { overlaps++; continue; }
        // projected gap on whichever axis the boxes are separated
        if (ox > 4) worstGap = Math.min(worstGap, Math.max(a.y, c.y) - Math.min(a.b, c.b));
        else if (oy > 4) worstGap = Math.min(worstGap, Math.max(a.x, c.x) - Math.min(a.r, c.r));
      }
    }
    assert.equal(overlaps, 0, `${overlaps} pairs of tap targets overlap`);
    assert.ok(worstGap >= MIN_GAP,
      `tap targets too close: tightest gap ${isFinite(worstGap) ? worstGap.toFixed(1) : "n/a"}px (< ${MIN_GAP})`);
  } finally {
    await small.close();
  }
});

test("tapping the animal works with touch and counts a friend", async () => {
  const before = Number((await page.textContent("#friend-count")).trim());
  const beforeEmoji = await page.textContent("#animal-emoji");
  await page.locator("#animal-card").tap({ force: true });
  await page.waitForFunction(
    (b) => document.getElementById("animal-emoji").textContent !== b,
    beforeEmoji, { timeout: 4000 }
  );
  const after = Number((await page.textContent("#friend-count")).trim());
  assert.equal(after, before + 1, "a touch tap should count a friend");
});

test("the sound toggle works with touch", async () => {
  const before = (await page.textContent("#sound-toggle")).trim();
  await page.locator("#sound-toggle").tap({ force: true });
  await page.waitForFunction(
    (b) => document.getElementById("sound-toggle").textContent.trim() !== b,
    before, { timeout: 4000 }
  );
  assert.notEqual((await page.textContent("#sound-toggle")).trim(), before);
});

test("no uncaught page errors on mobile", () => {
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
});
