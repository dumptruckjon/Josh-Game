// End-to-end tests: load the real page in Chromium and TAP the toys for real.
// One shared page for speed. The final test asserts there were no uncaught
// page errors during the whole run.
//
// Set JOSH_BASE_URL to run against the LIVE deployed site (used by CI's
// verify-live job).

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { startServer, launchBrowser } = require("./helpers");

let server, browser, context, page, baseURL;
const pageErrors = [];

before(async () => {
  ({ server, baseURL } = await startServer());
  browser = await launchBrowser();
  context = await browser.newContext();
  page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(baseURL, { waitUntil: "load" });
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((r) => server.close(r));
});

test("the page loads with the title and the animal toy", async () => {
  assert.match(await page.title(), /Josh/i);
  assert.ok(await page.locator("#animal-card").count() === 1, "animal card should render");
  const emoji = (await page.textContent("#animal-emoji")).trim();
  assert.ok(emoji.length > 0, "an animal should be showing on load");
});

test("tapping the animal celebrates, counts a friend, and shows a new animal", async () => {
  const beforeEmoji = await page.textContent("#animal-emoji");
  const beforeCount = Number((await page.textContent("#friend-count")).trim());

  await page.locator("#animal-card").click();

  // The animal swaps synchronously; poll until the emoji actually changes.
  await page.waitForFunction(
    (b) => document.getElementById("animal-emoji").textContent !== b,
    beforeEmoji, { timeout: 4000 }
  );

  const afterCount = Number((await page.textContent("#friend-count")).trim());
  assert.equal(afterCount, beforeCount + 1, "friends-met should go up by one");
  assert.notEqual((await page.textContent("#animal-emoji")).trim(), beforeEmoji.trim(),
    "a new animal should be showing");
  assert.ok((await page.textContent("#animal-cheer")).trim().length > 0, "a cheer should show");
});

test("tapping many times never errors and keeps counting (no fail state)", async () => {
  const before = Number((await page.textContent("#friend-count")).trim());
  for (let i = 0; i < 6; i++) await page.locator("#animal-card").click();
  const after = Number((await page.textContent("#friend-count")).trim());
  assert.equal(after, before + 6, "every tap counts; nothing resets progress");
});

test("the big sound toggle flips on and off", async () => {
  const toggle = page.locator("#sound-toggle");
  const before = (await toggle.textContent()).trim();
  await toggle.click();
  await page.waitForFunction(
    (b) => document.getElementById("sound-toggle").textContent.trim() !== b,
    before, { timeout: 4000 }
  );
  const after = (await toggle.textContent()).trim();
  assert.notEqual(after, before, "the icon should change");
  assert.ok(["🔇", "🔊"].includes(after), `unexpected toggle icon: ${after}`);
});

test("no uncaught page errors during the run", () => {
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
});
