// ✨ New Worlds — browser tests (Chromium; mobile.test.js measures the layout
// on the iPhone 17 Pro geometry and on real WebKit in CI). The shell's TEST
// CONTRACT is the framework's: the next thing to tap carries data-correct, so
// ONE walk plays every level of every world, DERIVED from the registry — a
// ninth world is covered the day it registers.

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { startServer, launchBrowser } = require("./helpers");

let server, browser, context, page, baseURL;
const pageErrors = [];

before(async () => {
  ({ server, baseURL } = await startServer());
  browser = await launchBrowser();
  context = await browser.newContext({ viewport: { width: 402, height: 874 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
  page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.addInitScript(() => {
    window.__said = [];
    try { localStorage.setItem("josh-muted", "0"); } catch (e) { /* ignore */ }
  });
  await page.goto(baseURL, { waitUntil: "load" });
});
after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((r) => server.close(r));
});

async function spy() {
  await page.evaluate(() => {
    const A = window.JoshAudio;
    if (A.__spied) return;
    const say = A.say;
    A.say = function (t, o) { window.__said.push(String(t)); return say.call(this, t, o); };
    A.__spied = true;
  });
}
async function go(hash, sel) {
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.locator(sel).waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(400); // the echo guard: a child looks first
}
const worlds = () => page.evaluate(() => window.__TOWN.worlds());
const done = () => page.evaluate(() => document.querySelector("#screen-town-play").dataset.done === "1");
// Play the level on screen to its end by the contract: tap what is marked.
async function playOut(label) {
  for (let i = 0; i < 80; i++) {
    if (await done()) return i;
    const tapped = await page.evaluate(() => {
      const e = [...document.querySelectorAll("#screen-town-play [data-correct]")].find((x) => x.getClientRects().length);
      if (!e) return false;
      e.click();
      return true;
    });
    await page.waitForTimeout(tapped ? 120 : 150);
  }
  assert.fail(label + ": never finished in 80 taps");
}

test("the front door's EIGHTH door opens New Worlds: a door per world, each with its levels, and 🚪 comes back", async () => {
  await go("", "#screen-start");
  assert.equal(await page.locator(".start-tile").count(), 8, "eight world doors");
  assert.equal(await page.locator(".start-tile").last().getAttribute("id"), "start-town", "New Worlds is the last door");
  assert.ok(await page.locator("#start-town .town-mark").count(), "the door wears the worlds inside it");
  await page.locator("#start-town").click();
  await page.locator("#screen-town-home").waitFor({ state: "visible" });
  const ws = await worlds();
  assert.ok(ws.length >= 1, "at least one world is registered");
  assert.equal(await page.locator("#screen-town-home .town-door--world").count(), ws.length, "a door per registered world");
  for (const w of ws) {
    assert.ok(w.levels.length >= 3, w.id + ": a world starts with a few levels");
    await go("#town-" + w.id, "#screen-town-" + w.id);
    assert.equal(await page.locator("#screen-town-" + w.id + " .town-door--level").count(), w.levels.length, w.id + ": a door per level");
  }
  await go("#town-home", "#screen-town-home");
  await page.locator("#screen-town-home .town-back").click();
  await page.locator("#screen-start").waitFor({ state: "visible" });
  assert.deepEqual(pageErrors, []);
});

test("EVERY level of EVERY world plays to its end by the contract, records a ⭐, and ▶ walks on to the next level", async () => {
  await page.evaluate(() => window.__TOWN.reset());
  for (const w of await worlds()) {
    for (let k = 0; k < w.levels.length; k++) {
      const l = w.levels[k];
      for (const seed of [1, 7]) {
        await page.evaluate(([a, b, s]) => window.__TOWN.start(a, b, { seed: s }), [w.id, l, seed]);
        await page.locator("#screen-town-play").waitFor({ state: "visible" });
        await page.waitForFunction(([a, b]) => { const s = window.__TOWN.state(); return s && s.world === a && s.level === b && !s.done; }, [w.id, l]);
        const taps = await playOut(w.id + "/" + l + " seed " + seed);
        assert.ok(taps >= 3, `${w.id}/${l}: a level is more than a tap or two (${taps})`);
      }
      const st = await page.evaluate(() => window.__TOWN.save().stars);
      assert.equal(st[w.id + "/" + l], 2, `${w.id}/${l}: each finish records a ⭐`);
      // the party: 🔁 and ▶ appear, ▶ goes on (or home after the last)
      await page.locator("#screen-town-play .town-party").waitFor({ state: "visible", timeout: 3000 });
      await page.waitForTimeout(400);
      await page.locator("#screen-town-play .town-next").click();
      if (k + 1 < w.levels.length) {
        await page.waitForFunction((b) => { const s = window.__TOWN.state(); return s && s.level === b && !s.done; }, w.levels[k + 1]);
      } else {
        await page.locator("#screen-town-" + w.id).waitFor({ state: "visible" });
        assert.equal(await page.locator("#screen-town-" + w.id + " .town-door--done").count(), w.levels.length, w.id + ": every level door wears its ⭐");
      }
    }
  }
  assert.deepEqual(pageErrors, []);
});

test("no failure: a wrong tap wiggles and SAYS what to do; the level carries on", async () => {
  await spy();
  for (const w of await worlds()) {
    for (const l of w.levels) {
      await page.evaluate(([a, b]) => window.__TOWN.start(a, b, { seed: 3 }), [w.id, l]);
      await page.waitForFunction(([a, b]) => { const s = window.__TOWN.state(); return s && s.level === b && s.world === a; }, [w.id, l]);
      await page.waitForTimeout(100);
      const r = await page.evaluate(() => {
        window.__said.length = 0;
        const all = [...document.querySelectorAll("#screen-town-play .town-stage button")].filter((b) => b.getClientRects().length && !b.disabled);
        const wrong = all.find((b) => !b.dataset.correct);
        if (!wrong) return { none: true };
        wrong.click();
        return { said: window.__said.slice(), bumped: wrong.classList.contains("bump"), still: !!document.querySelector("#screen-town-play [data-correct]") };
      });
      if (r.none) continue;
      assert.ok(r.bumped, `${w.id}/${l}: a wrong tap wiggles`);
      assert.ok(r.said.length >= 1, `${w.id}/${l}: a wrong tap says what to do`);
      assert.ok(r.still, `${w.id}/${l}: the next step is still there to tap`);
      assert.ok(!(await done()), `${w.id}/${l}: a wrong tap never ends the level`);
    }
  }
});

test("the hammer's echo: a real double tap is ONE tap — on a step, and on a level door (it never answers the level underneath)", async () => {
  await page.evaluate(() => window.__TOWN.reset());
  await go("#town-dig", "#screen-town-dig");
  // A double tap on the level door: the second tap lands where the digger is
  // about to be, and must not dig.
  const d = await page.locator('#screen-town-dig [data-level="hole"]').boundingBox();
  await page.mouse.click(d.x + d.width / 2, d.y + d.height / 2);
  await page.waitForTimeout(150);
  await page.mouse.click(d.x + d.width / 2, d.y + d.height / 2);
  await page.locator("#screen-town-play").waitFor({ state: "visible" });
  await page.waitForTimeout(300);
  const rocks = () => page.evaluate(() => document.querySelectorAll('#screen-town-play .dig-truck path[fill="#8d8b86"]').length);
  assert.equal(await rocks(), 0, "the echo of the door never dug");
  await page.waitForTimeout(500);
  // A double tap on the digger digs ONE scoop.
  const g = await page.locator("#screen-town-play .dig-digger .dig-thing").boundingBox();
  await page.mouse.click(g.x + g.width / 2, g.y + g.height / 2);
  await page.waitForTimeout(150);
  await page.mouse.click(g.x + g.width / 2, g.y + g.height / 2);
  await page.waitForTimeout(500);
  assert.equal(await rocks(), 1, "a double tap on the digger is one scoop");
  // …and after a pause, the next tap is his.
  await page.mouse.click(g.x + g.width / 2, g.y + g.height / 2);
  await page.waitForTimeout(500);
  assert.equal(await rocks(), 2, "a deliberate tap after a pause digs");
});

test("a finished board answers nothing, and leaving a level leaves no timer running", async () => {
  // EVERY level: a world's own handler need not know the level is over (the
  // shell closes the board), so one level that would answer is enough to fail.
  for (const w of await worlds()) {
    for (const l of w.levels) {
      await page.evaluate(([a, b]) => window.__TOWN.start(a, b, { seed: 2 }), [w.id, l]);
      await page.waitForFunction(([a, b]) => { const s = window.__TOWN.state(); return s && s.world === a && s.level === b; }, [w.id, l]);
      await playOut(w.id + "/" + l);
      await page.waitForTimeout(300);
      const before = await page.evaluate(() => document.querySelector("#screen-town-play .town-stage").innerHTML);
      await page.evaluate(() => { for (const b of document.querySelectorAll("#screen-town-play .town-stage button")) b.click(); });
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => document.querySelector("#screen-town-play .town-stage").innerHTML), before, w.id + "/" + l + ": taps on a finished board change nothing");
    }
  }
  assert.deepEqual(pageErrors, [], "and throw nothing");
  // leave mid-level
  await page.evaluate(() => window.__TOWN.start("dig", "hole", { seed: 2 }));
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector("#screen-town-play [data-correct]").click());
  await go("", "#screen-start");
  assert.equal(await page.evaluate(() => window.__TOWN.timers()), 0, "no New Worlds timer outlives the screen");
});

test("the save: ⭐ fold across tabs, a hostile save is coerced, and only the grown-ups gate resets", async () => {
  await page.evaluate(() => window.__TOWN.reset());
  await page.evaluate(() => localStorage.setItem("josh-town-v1", JSON.stringify({ v: 1, stars: { "dig/hole": 3, "dig/nope": 9, "zzz/hole": 2, "dig/road": -4, "dig/tower": "x" }, gen: 1e18 })));
  await page.reload({ waitUntil: "load" });
  await go("#town-home", "#screen-town-home");
  assert.deepEqual(await page.evaluate(() => window.__TOWN.save()), { v: 1, stars: { "dig/hole": 3 }, gen: 0 }, "unknown levels, bad counts and a gen from the future are dropped");
  // another tab finished a level: this tab's next write keeps it
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("josh-town-v1")); s.stars["dig/road"] = 2; localStorage.setItem("josh-town-v1", JSON.stringify(s)); });
  await page.evaluate(() => window.__TOWN.start("dig", "tower", { seed: 4 }));
  await page.waitForFunction(() => { const s = window.__TOWN.state(); return s && s.level === "tower"; });
  await playOut("dig/tower");
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("josh-town-v1")).stars);
  assert.equal(s["dig/road"], 2, "the other tab's ⭐ is kept");
  assert.equal(s["dig/tower"], 1, "this tab's ⭐ is written");
  // the gate: a wrong word does nothing, "reset" clears every ⭐
  await go("#town-home", "#screen-town-home");
  await page.locator("#screen-town-home .town-reset").click();
  await page.locator(".gate__input").fill("nope");
  await page.locator(".gate__ok").click();
  assert.ok(Object.keys(await page.evaluate(() => window.__TOWN.save().stars)).length > 0, "a wrong word resets nothing");
  await page.locator(".gate__input").fill("reset");
  await page.locator(".gate__ok").click();
  await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(() => window.__TOWN.save().stars), {}, "reset clears every ⭐");
  assert.equal(await page.locator("#screen-town-home .town-door--world .town-door__sub").first().textContent(), "⭐ 0 / " + (await worlds())[0].levels.length);
  assert.deepEqual(pageErrors, []);
});

test("🚧 Dig Site: Fill the Hole counts scoops and loads, and the full hole turns into a garden", async () => {
  await spy();
  await page.evaluate(() => window.__TOWN.start("dig", "hole", { seed: 1 }));
  await page.waitForFunction(() => { const s = window.__TOWN.state(); return s && s.level === "hole" && !s.done; });
  await page.evaluate(() => { window.__said.length = 0; });
  const tap = (sel) => page.evaluate((q) => document.querySelector("#screen-town-play " + q).click(), sel);
  for (let i = 0; i < 3; i++) { await tap(".dig-digger .dig-thing"); await page.waitForTimeout(80); }
  let said = await page.evaluate(() => window.__said.slice());
  assert.ok(["One!", "Two!", "Three!"].every((x) => said.includes(x)), "each scoop is counted aloud: " + said.join(" | "));
  assert.equal(await page.evaluate(() => document.querySelector("#screen-town-play .dig-truck .dig-thing").dataset.correct), "1", "a full truck is the next thing to tap");
  await tap(".dig-truck .dig-thing");
  await page.waitForTimeout(200);
  assert.equal(await page.locator("#screen-town-play .dig-pip--full").count(), 1, "one load is in the hole");
  said = await page.evaluate(() => window.__said.slice());
  assert.ok(said.some((x) => /One load/.test(x)), "the load is counted aloud");
  await playOut("dig/hole");
  assert.equal(await page.locator("#screen-town-play .dig-hole--garden").count(), 1, "the full hole is a garden");
  assert.equal(await page.locator("#screen-town-play .dig-pip--full").count(), 3, "three loads");
});

test("🚧 Dig Site: the roller goes 1 2 3 4, a tower matches its plan, and the cement follows its card", async () => {
  // road: a number out of order is a wiggle, never a step
  await page.evaluate(() => window.__TOWN.start("dig", "road", { seed: 1 }));
  await page.waitForFunction(() => { const s = window.__TOWN.state(); return s && s.level === "road" && !s.done; });
  for (let i = 0; i < 4; i++) { await page.evaluate(() => document.querySelector("#screen-town-play [data-correct]").click()); await page.waitForTimeout(150); }
  assert.ok(await page.locator("#screen-town-play .dig-road--numbers").count(), "after the rocks, the road shows its numbers");
  await page.evaluate(() => document.querySelectorAll("#screen-town-play .dig-seg")[2].click());
  await page.waitForTimeout(80);
  assert.equal(await page.locator("#screen-town-play .dig-seg--smooth").count(), 0, "number three before one rolls nothing");
  await playOut("dig/road");
  assert.equal(await page.locator("#screen-town-play .dig-seg--smooth").count(), 4);
  // tower: built bottom to top exactly as the plan says
  await page.evaluate(() => window.__TOWN.start("dig", "tower", { seed: 9 }));
  await page.waitForFunction(() => { const s = window.__TOWN.state(); return s && s.level === "tower" && !s.done; });
  const plan = await page.evaluate(() => [...document.querySelectorAll("#screen-town-play .dig-plan__row")].map((r) => r.dataset.block).reverse());
  await playOut("dig/tower");
  const built = await page.evaluate(() => [...document.querySelectorAll("#screen-town-play .dig-tower__block")].map((b) => b.style.background));
  const hex = await page.evaluate((ids) => ids.map((id) => document.querySelector('#screen-town-play .dig-block[data-block="' + id + '"]').style.background), plan);
  assert.deepEqual(built.slice().reverse(), hex, "the tower matches the plan, bottom to top");
  // cement: the sand count is the card's
  await page.evaluate(() => window.__TOWN.start("dig", "cement", { seed: 5 }));
  await page.waitForFunction(() => { const s = window.__TOWN.state(); return s && s.level === "cement" && !s.done; });
  const want = await page.evaluate(() => +document.querySelector("#screen-town-play .dig-recipe__row b").textContent);
  let sand = 0;
  while (await page.evaluate(() => document.querySelector("#screen-town-play .dig-sand .dig-thing").dataset.correct === "1")) {
    await page.evaluate(() => document.querySelector("#screen-town-play .dig-sand .dig-thing").click());
    sand += 1;
    await page.waitForTimeout(60);
    assert.ok(sand <= 6, "the sand stops");
  }
  assert.equal(sand, want, "exactly the card's sand");
  await playOut("dig/cement");
  assert.deepEqual(pageErrors, []);
});
