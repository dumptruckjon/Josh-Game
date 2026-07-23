// PWA offline guardrail (Chromium): the site advertises "works offline (great
// for car rides)", so prove it — load once online, drop the network, and assert
// the FULL app boots from the service-worker cache (home visible AND the game
// registry present AND no "Unexpected token '<'" from a script that fell back to
// index.html). Locks the fix for the ?v=<sha> version-query cache miss: the SW
// precaches unversioned paths while the page requests versioned ones, so the
// offline fallback must be { ignoreSearch: true } (see sw.js + site.test.js).
//
// Skipped against a live URL (JOSH_BASE_URL) — we must not poke a real SW/cache.

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { startServer, launchBrowser } = require("./helpers");

const LIVE = !!process.env.JOSH_BASE_URL;

let server, browser, context, page, baseURL, pause, resume, setHijack;
const pageErrors = [];

before(async () => {
  if (LIVE) return;
  ({ server, baseURL, pause, resume, setHijack } = await startServer());
  browser = await launchBrowser();
  context = await browser.newContext();
  page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(baseURL, { waitUntil: "load" });
  // Wait for the service worker to be active and its precache to settle.
  await page.evaluate(async () => { try { await navigator.serviceWorker.ready; } catch (e) {} });
  await page.waitForFunction(async () => {
    try { const k = await caches.keys(); if (!k.length) return false; const c = await caches.open(k[0]); return (await c.keys()).length >= 10; }
    catch (e) { return false; }
  }, null, { timeout: 15000 }).catch(() => {});
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((r) => server.close(r));
});

async function reloadOfflineAndAssertBoot(label) {
  pageErrors.length = 0;
  // HARD offline (audit): context.setOffline() does NOT gate service-worker
  // fetches — the SW happily reached the local server during an "offline"
  // reload, so this guardrail could pass while offline was actually broken.
  // Pausing the server (close + destroy sockets) makes SW fetches really fail;
  // setOffline stays on as belt-and-suspenders for the navigation request.
  await context.setOffline(true);
  await pause();
  try {
    await page.reload({ waitUntil: "load", timeout: 20000 });
    const visible = await page.locator("#screen-home").waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false);
    const booted = await page.evaluate(() => Array.isArray(window.JoshGames) && window.JoshGames.length > 0).catch(() => false);
    const syntax = pageErrors.filter((e) => /Unexpected token '<'|SyntaxError/.test(e));
    assert.ok(visible, `${label}: the home screen must be visible offline`);
    assert.ok(booted, `${label}: the game registry (window.JoshGames) must load offline — a broken shell means scripts 404'd to the HTML fallback`);
    assert.equal(syntax.length, 0, `${label}: no script may parse as HTML offline (got: ${syntax.join("; ")})`);
  } finally {
    await resume();
    await context.setOffline(false);
  }
}

test("offline: the app fully boots from the SW cache after one online visit", async () => {
  if (LIVE) return;
  await reloadOfflineAndAssertBoot("as-cached");
});

test("offline: boots even PRECACHE-ONLY — the ?v= versioned requests resolve via ignoreSearch", async () => {
  if (LIVE) return;
  // Delete every runtime-cached versioned entry, leaving only the unversioned
  // CORE precache. This reproduces a true first-offline-open where the SW never
  // runtime-cached the ?v=<sha> assets; only the ignoreSearch fallback can serve
  // them. Without the fix the app is a dead shell here.
  const deleted = await page.evaluate(async () => {
    const k = await caches.keys(); const c = await caches.open(k[0]); const rs = await c.keys();
    let d = 0; for (const r of rs) { if (/\?v=/.test(r.url)) { await c.delete(r); d++; } }
    return d;
  });
  // (deleted may be 0 if the SW didn't runtime-cache versioned URLs — the point is
  // that only unversioned precache remains, which is the exact scenario we harden.)
  assert.ok(deleted >= 0);
  await reloadOfflineAndAssertBoot("precache-only");
});

test("offline: a captive portal cannot poison the runtime cache (audit guardrail)", async () => {
  if (LIVE) return;
  // A hotel/plane captive portal answers 200 text/html for EVERY URL. Without
  // the res.ok/content-type gate in sw.js, that HTML body would be runtime-cached
  // over a script entry and — offline — the exact-match poisoned entry beats the
  // healthy precache: the app boots as a dead shell ("Unexpected token '<'").
  const PORTAL = "<html><body>Please sign in to Sky-Fi</body></html>";
  setHijack((req) => (/scripts\/effects\.js/.test(req.url) ? { status: 200, type: "text/html", body: PORTAL } : null));
  await page.reload({ waitUntil: "load", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(400); // let the SW's runtime cache.put settle
  setHijack(null);
  pageErrors.length = 0;
  await reloadOfflineAndAssertBoot("post-portal");
  const effectsAlive = await page.evaluate(() => !!(window.JoshEffects && window.JoshEffects.confetti)).catch(() => false);
  assert.ok(effectsAlive, "post-portal: effects.js must load from the healthy cache, not the portal HTML");
});
