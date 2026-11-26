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
    window.__zh = [];
    A.say = function (t, o) { window.__said.push(String(t)); if (o && o.lang === "zh-CN") window.__zh.push(String(t)); return say.call(this, t, o); };
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
        // a data-free control (a track tile) is a move in any order, never wrong
        const all = [...document.querySelectorAll("#screen-town-play .town-stage button")].filter((b) => b.getClientRects().length && !b.disabled && !b.dataset.free);
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

test("🍳 Little Kitchen: every recipe is cooked exactly as its CARD says, served to its friend, and Grandma's dumplings count in Chinese", async () => {
  await spy();
  const recipes = (await worlds()).find((w) => w.id === "kitchen").levels;
  assert.ok(recipes.length >= 4, "four recipes to start");
  for (const id of recipes) {
    for (const seed of [2, 11]) {
      await page.evaluate(([l, sd]) => window.__TOWN.start("kitchen", l, { seed: sd }), [id, seed]);
      await page.waitForFunction((l) => { const s = window.__TOWN.state(); return s && s.level === l && !s.done; }, id);
      await page.evaluate(() => { window.__said.length = 0; window.__zh.length = 0; });
      // the card: a picture and a count per step, read off the screen
      const card = await page.evaluate(() => [...document.querySelectorAll("#screen-town-play .kit-step")].map((c) => {
        const n = c.querySelector(".kit-step__n");
        return { pic: c.querySelector(".kit-step__pic").textContent, n: n ? +n.textContent.replace(/\D/g, "") : 1 };
      }));
      // play by the contract, recording which tool each tap was
      const taps = [];
      for (let i = 0; i < 40 && !(await done()); i++) {
        const t = await page.evaluate(() => {
          const e = document.querySelector("#screen-town-play [data-correct]");
          if (!e) return null;
          e.click();
          return e.textContent.trim();
        });
        if (t) taps.push(t);
        await page.waitForTimeout(t ? 30 : 120);
      }
      assert.ok(await done(), `${id}@${seed}: cooked to the end`);
      const runs = [];
      for (const t of taps) { if (runs.length && runs[runs.length - 1].pic === t) runs[runs.length - 1].n += 1; else runs.push({ pic: t, n: 1 }); }
      assert.deepEqual(runs, card, `${id}@${seed}: the taps follow the card, step by step and count by count`);
      const r = await page.evaluate(() => ({
        happy: document.querySelector("#screen-town-play .kit-eater").classList.contains("kit-eater--happy"),
        yum: getComputedStyle(document.querySelector("#screen-town-play .kit-eater__yum")).display !== "none",
        plate: document.querySelector("#screen-town-play .kit-eater__plate").textContent,
        dish: document.querySelector("#screen-town-play .town-prompt").textContent.trim().split(/\s+/).pop(),
        face: !!document.querySelector("#screen-town-play .kit-eater__face svg"),
        ticks: document.querySelectorAll("#screen-town-play .kit-step--done").length,
      }));
      assert.ok(r.happy && r.yum, `${id}: the friend is served and says yum`);
      assert.equal(r.plate, r.dish, `${id}: the dish on the plate is the dish the recipe makes`);
      assert.equal(r.ticks, card.length, `${id}: every step on the card is ticked`);
      const said = await page.evaluate(() => window.__said.slice());
      const zh = await page.evaluate(() => window.__zh.slice());
      if (id === "dumplings") {
        const n = card[1].n;
        assert.deepEqual(zh.slice(0, n), ["一", "二", "三", "四", "五", "六"].slice(0, n), "the dumplings are counted in Chinese");
        assert.ok(zh.includes("好吃！"), "Grandma says hao chi in a Chinese voice");
        assert.ok(said.some((x) => /Grandma says hao chi/.test(x)), "and what it means, in English");
      } else {
        assert.ok(r.face, `${id}: the friend is drawn as the app draws them (JoshArt.friend), not an emoji`);
        assert.equal(zh.length, 0, `${id}: no Chinese in an English recipe`);
        assert.ok(said.some((x) => /says yum/.test(x)), `${id}: the friend says yum`);
      }
      // every counted step is counted aloud (one! two! …), in order
      const counts = said.filter((x) => /^(One|Two|Three|Four|Five|Six)!$/.test(x));
      const want = card.filter((c) => c.n > 1 && !(id === "dumplings" && c.pic === "🥬")).flatMap((c) => ["One!", "Two!", "Three!", "Four!", "Five!", "Six!"].slice(0, c.n));
      assert.deepEqual(counts, want, `${id}@${seed}: every count is said aloud`);
    }
  }
  assert.deepEqual(pageErrors, []);
});

test("🚂 Train Yard: every level is SOLVABLE (proven in node), a track turns in any order, the lit line follows the joins, and the train arrives AT the end", async () => {
  // node: the level data cannot ask for a track that cannot join
  const TL = require("../scripts/town-train.js");
  for (const lv of TL.LEVELS) {
    assert.equal(TL.check(lv), "", lv.id + ": " + TL.check(lv));
    for (const pair of TL.needs(lv)) assert.ok(TL.goodTurns(pair).length >= 1 && TL.goodTurns(pair).length <= 2, lv.id + ": every tile has a turn that fits");
  }
  assert.ok(TL.check({ rows: 2, cols: 2, path: [[0, 0], [1, 1]] }), "a diagonal step is refused");
  assert.ok(TL.check({ rows: 2, cols: 2, path: [[0, 0], [0, 1]] }), "a path that never reaches the end is refused");
  await spy();
  for (const id of TL.LEVELS.map((l) => l.id)) {
    for (const seed of [4, 9]) {
      await page.evaluate(([l, sd]) => window.__TOWN.start("train", l, { seed: sd }), [id, seed]);
      await page.waitForFunction((l) => { const s = window.__TOWN.state(); return s && s.level === l && !s.done; }, id);
      // no track starts joined: there is always a puzzle
      const fit0 = await page.evaluate(() => [...document.querySelectorAll("#screen-town-play .trn-tile")].map((t) => t.dataset.fits));
      assert.ok(fit0.length >= 3 && fit0.every((f) => f === "0"), `${id}@${seed}: every track starts turned wrong (${fit0.join("")}), so there is always a puzzle`);
      const cargo = await page.locator("#screen-town-play .trn-pen").count();
      if (cargo) {
        const n = await page.evaluate(() => document.querySelectorAll("#screen-town-play .trn-car").length);
        await page.evaluate(() => { window.__said.length = 0; });
        // a track tapped before the animals are on says so, and turns nothing
        const before = await page.evaluate(() => document.querySelector("#screen-town-play .trn-tile .trn-tile__in").style.transform);
        await page.evaluate(() => document.querySelector("#screen-town-play .trn-tile").click());
        assert.equal(await page.evaluate(() => document.querySelector("#screen-town-play .trn-tile .trn-tile__in").style.transform), before, `${id}: the track waits for the animals`);
        for (let i = 0; i < n; i++) { await page.evaluate(() => document.querySelector("#screen-town-play .trn-pen").click()); await page.waitForTimeout(400); }
        const said = await page.evaluate(() => window.__said.slice());
        assert.deepEqual(said.filter((x) => /^(One|Two|Three|Four|Five)!$/.test(x)), ["One!", "Two!", "Three!", "Four!", "Five!"].slice(0, n), `${id}: every animal counted onto the train`);
        assert.equal(await page.evaluate(() => [...document.querySelectorAll("#screen-town-play .trn-car")].filter((c) => c.textContent !== "🚃").length), n, `${id}: every car holds an animal`);
      }
      // turn the LAST track first (out of order): a move, never a wiggle, and the lit line does not jump past an unjoined track
      const last = await page.evaluate(() => { const t = [...document.querySelectorAll("#screen-town-play .trn-tile")]; const b = t[t.length - 1]; b.click(); return { bump: b.classList.contains("bump"), lit: document.querySelectorAll("#screen-town-play .trn-tile--lit").length, total: t.length }; });
      assert.ok(!last.bump, `${id}: turning a track out of order is a move, not a wrong tap`);
      // no track starts joined, so the lit line (counted from the station) is still empty
      assert.equal(last.lit, 0, `${id}@${seed}: the line is lit only from the station on, never past a track that does not join`);
      await playOut("train/" + id);
      const r = await page.evaluate(() => {
        const tr = document.querySelector("#screen-town-play .trn-train").getBoundingClientRect();
        const to = document.querySelector("#screen-town-play .trn-end--to span").getBoundingClientRect();
        const cx = tr.left + tr.width / 2, cy = tr.top + tr.height / 2;
        return { lit: document.querySelectorAll("#screen-town-play .trn-tile--lit").length, total: document.querySelectorAll("#screen-town-play .trn-tile").length,
          at: cx >= to.left && cx <= to.right && cy >= to.top - 8 && cy <= to.bottom + 8, end: document.querySelector("#screen-town-play .trn-end--to").classList.contains("trn-end--lit") };
      });
      assert.equal(r.lit, r.total, `${id}@${seed}: the whole line is lit`);
      assert.ok(r.end, `${id}: the end lights up`);
      assert.ok(r.at, `${id}@${seed}: the train stops ON the end, not beside it`);
    }
  }
  assert.deepEqual(pageErrors, []);
});

test("📮 Delivery Day: every parcel's house is the ONE that matches it (pet, letter, the WORD for a picture, the NUMBER of dots), a wrong house says what it is, and the truck empties", async () => {
  const ML = require("../scripts/town-mail.js");
  // node: a street never has two houses alike, and every parcel has its house
  let x = 1;
  const rng = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
  for (const kind of Object.keys(ML.POOL)) {
    for (let i = 0; i < 300; i++) {
      const st = ML.street(kind, rng);
      assert.equal(new Set(st.addr).size, ML.HOUSES, kind + ": six different houses");
      assert.equal(new Set(st.parcels).size, ML.PARCELS, kind + ": four different parcels");
      assert.ok(st.parcels.every((p) => st.addr.includes(p)), kind + ": every parcel has its house on the street");
    }
  }
  // a word's picture is never the parcel itself, and is a word he can read
  for (const [pic, w] of ML.WORDS) {
    assert.notEqual(pic, "📦", w + ": its picture must not be the parcel");
    assert.match(w, /^[a-z]{3,4}$/, w + ": three or four letters");
  }
  await spy();
  const KIND = { pets: "pet", letters: "letter", words: "word", numbers: "number" };
  for (const id of Object.keys(KIND)) {
    for (const seed of [3, 8]) {
      await page.evaluate(([l, sd]) => window.__TOWN.start("mail", l, { seed: sd }), [id, seed]);
      await page.waitForFunction((l) => { const s = window.__TOWN.state(); return s && s.level === l && !s.done; }, id);
      for (let k = 0; k < 4; k++) {
        const r = await page.evaluate(() => {
          const tag = document.querySelector("#screen-town-play .mail-parcel__tag");
          const pic = tag.querySelector(".mail-pic"), letter = tag.querySelector(".mail-letter"), dots = tag.querySelectorAll(".mail-dots i");
          const right = document.querySelector("#screen-town-play .mail-house[data-correct]");
          const sign = (h) => h.querySelector(".mail-house__sign").textContent.trim();
          return { pic: pic && pic.textContent, letter: letter && letter.textContent, dots: dots.length, right: sign(right),
            rights: document.querySelectorAll("#screen-town-play .mail-house[data-correct]").length,
            pile: document.querySelector("#screen-town-play .mail-pile").textContent.length / 2 };
        });
        assert.equal(r.rights, 1, `${id}@${seed}: exactly one house is right`);
        assert.equal(r.pile, 3 - k, `${id}@${seed}: the truck holds ${3 - k} more after this one`);
        if (id === "pets") assert.equal(r.right, r.pic, "the pet on the parcel is the pet on the house");
        if (id === "letters") assert.equal(r.right, r.letter, "the letter on the parcel is the letter on the house");
        if (id === "words") assert.equal(r.right, ML.WORDS.find((w) => w[0] === r.pic)[1], "the house says the word for the parcel's picture");
        if (id === "numbers") assert.equal(+r.right, r.dots, "the house's number is how many dots the parcel has");
        if (k === 0) {
          // a wrong house first: it wiggles and SAYS what it is
          const w = await page.evaluate(() => {
            window.__said.length = 0;
            const h = [...document.querySelectorAll("#screen-town-play .mail-house")].find((x) => !x.dataset.correct);
            h.click();
            return { said: window.__said.join(" | "), bump: h.classList.contains("bump"), sign: h.querySelector(".mail-house__sign").textContent.trim() };
          });
          assert.ok(w.bump, `${id}: a wrong house wiggles`);
          if (id === "letters" || id === "words") assert.ok(w.said.includes("That house says " + w.sign), `${id}: a wrong house says what it says: ` + w.said);
        }
        await page.evaluate(() => document.querySelector("#screen-town-play .mail-house[data-correct]").click());
        await page.waitForTimeout(120);
      }
      await page.waitForFunction(() => document.querySelector("#screen-town-play").dataset.done === "1", null, { timeout: 4000 });
      const end = await page.evaluate(() => ({ got: document.querySelectorAll("#screen-town-play .mail-house--got").length, box: document.querySelector("#screen-town-play .mail-parcel").textContent.trim() }));
      assert.equal(end.got, 4, `${id}: four houses have their parcels`);
      assert.equal(end.box, "📭", `${id}: the truck is empty at the end`);
    }
  }
  // Two seeds deal only some of the words, so a word drawn with the WRONG picture
  // would hide in the rest. Deal the first parcel on seed after seed until every
  // word has been on a parcel, and check each one's picture against its house.
  const seen = new Map();
  for (let sd = 1; sd <= 80 && seen.size < ML.WORDS.length; sd++) {
    await page.evaluate((x) => window.__TOWN.start("mail", "words", { seed: x }), sd);
    await page.waitForFunction(() => { const s = window.__TOWN.state(); return s && s.level === "words" && !s.done; });
    const r = await page.evaluate(() => {
      const pic = document.querySelector("#screen-town-play .mail-parcel__tag .mail-pic");
      const right = document.querySelector("#screen-town-play .mail-house[data-correct]");
      return { pic: pic && pic.textContent, word: right && right.dataset.addr };
    });
    if (r.word) seen.set(r.word, r.pic);
  }
  assert.equal(seen.size, ML.WORDS.length, "every word must be dealt on a parcel at least once (saw " + [...seen.keys()].join(",") + ")");
  for (const [w, shown] of seen) assert.equal(shown, ML.WORDS.find((x) => x[1] === w)[0], `the parcel for "${w}" must show ${w}'s own picture, not ${shown}`);
  assert.deepEqual(pageErrors, []);
});

test("🌱 Josh's Garden: the garden GROWS with everything he finishes, a flower takes dig, seed, two waters and the sun in order, the carrots match the sign, only red apples are picked, and each butterfly finds its own flower", async () => {
  await spy();
  // The garden counts what he has finished anywhere: Josh's games (never
  // 华丽's) and the New Worlds levels, read through their owners.
  await page.evaluate(() => {
    window.__TOWN.reset();
    for (const k of Object.keys(localStorage)) if (k.indexOf("josh-won-") === 0) localStorage.removeItem(k);
    window.JoshProgress.markWon("count-feed");
    window.JoshProgress.markWon("number-builder");
    window.JoshProgress.markWon("hl-tile-pair"); // her world: never a flower in his garden
    window.JoshProgress.markWon("zz-a-game-that-is-gone"); // a stale id: not a game of his
  });
  const garden = async () => {
    await go("#town-garden", "#screen-town-garden");
    return page.evaluate(() => {
      const p = document.querySelector("#screen-town-garden .town-banner .gar-plot");
      return p && { label: p.getAttribute("aria-label"), flowers: [...p.textContent].filter((c) => /\p{Extended_Pictographic}/u.test(c) && c !== "🌱").length };
    });
  };
  let g = await garden();
  assert.ok(g, "the garden's home shows his garden above the jobs");
  assert.equal(g.label, "Josh's garden has 2 flowers", "two of his games beaten (her world's, and a stale id, never count)");
  assert.equal(g.flowers, 2, "and it draws two flowers");

  // 1. Plant Flowers: the tools work only in their order, water is counted.
  await page.evaluate(() => window.__TOWN.start("garden", "plant", { seed: 5 }));
  await page.waitForFunction(() => { const s = window.__TOWN.state(); return s && s.level === "plant" && !s.done; });
  const tool = (label) => page.evaluate((l) => { const b = document.querySelector('#screen-town-play .gar-tool[aria-label="' + l + '"]'); window.__said.length = 0; b.classList.remove("bump"); b.click(); return { said: window.__said.slice(), bump: b.classList.contains("bump"), right: !!b.dataset.correct }; }, label);
  const out = await tool("Water");
  assert.ok(out.bump && out.said.join(" ").includes("Not yet!"), "watering before digging wiggles and says what comes first: " + out.said);
  for (const [step, said] of [["Dig", null], ["Seed", null], ["Water", "One!"], ["Water", "Two!"]]) {
    await page.waitForTimeout(150);
    const r = await tool(step);
    assert.ok(!r.bump, step + " is the right tool now");
    if (said) assert.ok(r.said.includes(said), step + " is counted: " + r.said);
  }
  await page.waitForTimeout(150);
  assert.ok(!(await tool("Sun")).bump, "then the sun");
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.querySelectorAll("#screen-town-play .gar-bed--bloom").length), 1, "the sun makes the first bed bloom");
  await playOut("garden/plant");
  assert.equal(await page.evaluate(() => document.querySelectorAll("#screen-town-play .gar-bed--bloom").length), 3, "three flowers bloom");

  // 2. Pull Carrots: exactly as many as the sign says.
  for (const seed of [1, 2, 3, 4]) {
    await page.evaluate((s) => window.__TOWN.start("garden", "carrots", { seed: s }), seed);
    await page.waitForFunction(() => { const s = window.__TOWN.state(); return s && s.level === "carrots" && !s.done; });
    const want = +(await page.evaluate(() => document.querySelector("#screen-town-play .gar-sign b").textContent));
    assert.ok(want >= 3 && want <= 5, "the sign asks for three to five carrots");
    await playOut("garden/carrots");
    const got = await page.evaluate(() => [...document.querySelector("#screen-town-play .gar-basket__in").textContent].filter((c) => c === "🥕").length);
    assert.equal(got, want, `the basket holds exactly the ${want} carrots the sign asked for`);
  }

  // 3. Pick Apples: a green apple wiggles and stays; every red one is picked.
  for (const seed of [1, 2, 3]) {
    await page.evaluate((s) => window.__TOWN.start("garden", "apples", { seed: s }), seed);
    await page.waitForFunction(() => { const s = window.__TOWN.state(); return s && s.level === "apples" && !s.done; });
    const a = await page.evaluate(() => {
      const all = [...document.querySelectorAll("#screen-town-play .gar-apple")];
      const green = all.find((b) => b.dataset.kind === "green");
      window.__said.length = 0;
      green.click();
      return { red: all.filter((b) => b.dataset.kind === "red").length, greenFlag: all.some((b) => b.dataset.kind === "green" && b.dataset.correct), bump: green.classList.contains("bump"), said: window.__said.join(" "), stays: !green.disabled,
        leaf: getComputedStyle(green, "::after").content, redLeaf: getComputedStyle(all.find((b) => b.dataset.kind === "red"), "::after").content };
    });
    assert.ok(!a.greenFlag, "a green apple is never the thing to tap");
    assert.ok(a.bump && a.stays && /green/.test(a.said), "a green apple wiggles, stays on the tree and says it is green: " + a.said);
    assert.ok(a.leaf.includes("🍃") && !a.redLeaf.includes("🍃"), "a green apple wears a leaf a red one does not, so the two differ by more than colour");
    await playOut("garden/apples");
    const got = await page.evaluate(() => [...document.querySelector("#screen-town-play .gar-basket__in").textContent].filter((c) => c === "🍎").length);
    assert.equal(got, a.red, "the basket holds every red apple and no green one");
  }

  // 4. Butterflies: each lands on the flower of its OWN colour.
  for (const seed of [1, 2]) {
    await page.evaluate((s) => window.__TOWN.start("garden", "butterflies", { seed: s }), seed);
    await page.waitForFunction(() => { const s = window.__TOWN.state(); return s && s.level === "butterflies" && !s.done; });
    for (let k = 0; k < 3; k++) {
      const r = await page.evaluate(() => {
        const fly = document.querySelector("#screen-town-play .gar-fly");
        const right = document.querySelector("#screen-town-play .gar-flower[data-correct]");
        const color = (x) => getComputedStyle(x).getPropertyValue(x === fly ? "--fly" : "--flower").trim();
        return { fly: fly.getAttribute("aria-label"), dot: fly.querySelector(".gar-fly__dot").textContent, right: right.getAttribute("aria-label"), pic: right.querySelector("span").textContent, same: color(fly) === color(right) };
      });
      assert.equal(r.fly.replace("butterfly", "flower"), r.right, "the butterfly's colour is its flower's colour");
      assert.ok(r.same && r.dot === r.pic, "and they wear the same colour AND the same flower picture");
      await page.evaluate(() => document.querySelector("#screen-town-play .gar-flower[data-correct]").click());
      await page.waitForTimeout(150);
    }
    await page.waitForFunction(() => document.querySelector("#screen-town-play").dataset.done === "1", null, { timeout: 4000 });
  }

  // The garden grew: each job finished is one more flower.
  g = await garden();
  assert.equal(g.label, "Josh's garden has 6 flowers", "two games and four garden jobs");
  assert.equal(g.flowers, 6);
  assert.deepEqual(pageErrors, []);
});
