// 🕳️ Gobble Hole — browser tests (Chromium). They drive the REAL screen: the
// front door's fourth door, a real pointer drag that eats, tap-to-glide, the
// too-big bump, a grow and the meter's next picture, the win screen, the save
// and resume, sound gating, the loop pausing off-screen, and the double-tap
// echo guard. The engine itself is proven headless in hole-logic.test.js; the
// shipped window.__HOLE hooks (the fort's __TD precedent) steer a greedy bot
// through the same engine and event path a finger uses.

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

// Hop away first: setting the hash to the value it already has is a no-op, so
// the router would never run (a recorded fixture trap).
async function go(hash, sel) {
  await page.evaluate(() => { location.hash = "#__renav"; });
  await page.waitForTimeout(40);
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.locator(sel).waitFor({ state: "visible", timeout: 8000 });
}
// A screen that has just appeared ignores a finger for 350ms (the echo guard),
// so a test that TAPS waits the way a child who looked would.
async function openScene(id, opts) {
  await page.evaluate((o) => window.__HOLE.reset(o), opts || { demoSeen: true });
  await go("#hole-home", "#screen-hole-home");
  await page.waitForTimeout(400);
  await page.locator(`.hole-door[data-scene="${id}"]`).click();
  await page.locator("#screen-hole-play").waitFor({ state: "visible" });
  await page.waitForFunction((sid) => window.__HOLE.scene() === sid, id);
  await page.waitForTimeout(400);
}
const state = () => page.evaluate(() => {
  const s = window.__HOLE.state();
  return { eaten: s.eaten, total: s.total, level: s.hole.level, x: s.hole.x, y: s.hole.y, r: s.hole.r, won: s.won, done: s.done, tick: s.tick };
});

test("the front door's FOURTH door opens Gobble Hole, and 🚪 comes back", async () => {
  await page.evaluate(() => { location.hash = ""; });
  await page.locator("#screen-start").waitFor({ state: "visible" });
  assert.equal(await page.locator(".start-tile").count(), 4, "four world doors");
  const order = await page.evaluate(() => [...document.querySelectorAll(".start-tile")].map((t) => t.id));
  assert.equal(order.indexOf("start-hole"), order.indexOf("start-td") + 1, "the new door comes right after the fort's");
  const tile = page.locator("#start-hole");
  const box = await tile.boundingBox();
  assert.ok(box && box.width >= 75 && box.height >= 75, "a giant tap target");
  assert.equal(await page.locator("#start-hole .start-tile__art svg").count(), 1, "the door wears Gobble's drawing");
  await page.waitForTimeout(400);
  await tile.click();
  await page.locator("#screen-hole-home").waitFor({ state: "visible", timeout: 8000 });
  assert.ok(await page.evaluate(() => document.body.classList.contains("hole-mode")), "the Gobble theme is on");
  const doors = await page.locator(".hole-door").count();
  assert.equal(doors, await page.evaluate(() => window.HoleData.SCENES.length), "one door per place");
  await page.waitForTimeout(400);
  await page.locator("#screen-hole-home .hole-exit").click();
  await page.locator("#screen-start").waitFor({ state: "visible", timeout: 8000 });
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("hole-mode"))), "leaving drops the theme");
});

test("the first time, a ghost hand SHOWS him how — Gobble eats a bite with no input at all", async () => {
  await openScene("toyroom", {});                       // a fresh save: demo not yet seen
  await page.locator(".hole-hand").waitFor({ state: "visible", timeout: 4000 });
  await page.waitForFunction(() => window.__HOLE.state().eaten >= 1, null, { timeout: 6000 });
  await page.waitForFunction(() => !window.__HOLE.demo(), null, { timeout: 4000 });
  assert.ok(await page.locator(".hole-hand").isHidden(), "the hand goes away once the bite is eaten");
  assert.equal((await page.evaluate(() => window.__HOLE.save())).demo, true, "…and it is remembered");
  // 👂 shows it again whenever he asks
  await page.locator(".hole-hear").click();
  assert.ok(await page.evaluate(() => window.__HOLE.demo()), "👂 replays the demo");
});

test("a REAL drag: grab Gobble (he never jumps under the finger) and drag him onto a bite — it is eaten", async () => {
  await openScene("picnic");
  const s0 = await state();
  // grab him a little off-centre: the grab offset is kept, so he must not jump
  const grab = await page.evaluate(() => {
    const h = window.__HOLE.state().hole;
    return window.__HOLE.toScreen(h.x + h.r * 0.5, h.y);
  });
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.waitForTimeout(250);
  const held = await state();
  assert.ok(Math.hypot(held.x - s0.x, held.y - s0.y) < 0.5, "grabbing Gobble never makes him jump (" + Math.hypot(held.x - s0.x, held.y - s0.y).toFixed(2) + ")");
  // drag toward the nearest bite, slowly, like a finger
  const to = await page.evaluate(() => {
    const st = window.__HOLE.state(), h = st.hole;
    const bite = st.objects.find((o) => o.starter && o.st === 0);
    return window.__HOLE.toScreen(bite.x + h.r * 0.5, bite.y);
  });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.waitForTimeout(900);
  await page.mouse.up();
  const s1 = await state();
  assert.ok(s1.eaten > s0.eaten, "the drag ate something (" + s0.eaten + " -> " + s1.eaten + ")");
  assert.ok(Math.hypot(s1.x - s0.x, s1.y - s0.y) > 3, "Gobble moved with the finger");
});

test("tap anywhere and Gobble GLIDES there; a second finger is ignored", async () => {
  await openScene("build");
  const s0 = await state();
  const spot = await page.evaluate(() => {
    const st = window.__HOLE.state();
    return { world: { x: st.W * 0.2, y: st.H * 0.7 }, screen: window.__HOLE.toScreen(st.W * 0.2, st.H * 0.7) };
  });
  await page.mouse.click(spot.screen.x, spot.screen.y);
  await page.waitForTimeout(1600);
  const s1 = await state();
  const d0 = Math.hypot(s0.x - spot.world.x, s0.y - spot.world.y);
  const d1 = Math.hypot(s1.x - spot.world.x, s1.y - spot.world.y);
  assert.ok(d1 < d0 * 0.25, "Gobble glided to the tapped spot (" + d0.toFixed(1) + " -> " + d1.toFixed(1) + ")");
  // a secondary pointer (a second finger) must not steer him
  const before2 = await state();
  await page.evaluate(() => {
    const cv = document.querySelector(".hole-canvas"), r = cv.getBoundingClientRect();
    cv.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 7, isPrimary: false, pointerType: "touch", clientX: r.left + 10, clientY: r.top + 10, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(700);
  const after2 = await state();
  assert.ok(Math.hypot(after2.x - before2.x, after2.y - before2.y) < 1, "a second finger is ignored");
});

test("a thing that is TOO BIG wobbles and bumps — it is never eaten, and nothing fails", async () => {
  await openScene("toyroom");
  const big = await page.evaluate(() => {
    const st = window.__HOLE.state();
    const o = st.objects.find((ob) => ob.tier === 3);
    window.__HOLE.moveTo(o.x, o.y);
    return o.id;
  });
  await page.waitForFunction(() => (window.__HOLE.counts().bump || 0) >= 1, null, { timeout: 6000 });
  const o = await page.evaluate((id) => window.__HOLE.state().objects[id].st, big);
  assert.equal(o, 0, "the big thing is still standing");
  assert.equal((await state()).level, 0, "Gobble is unchanged — a bump costs nothing");
});

test("growing: the meter ends in a PICTURE of the next thing he can eat, and it changes on a grow", async () => {
  await openScene("picnic");
  const icon = () => page.locator(".hole-meter__next").textContent();
  const tier = (t) => page.evaluate((k) => window.HoleData.SCENES.find((d) => d.id === "picnic").tiers[k - 1].items[0][0], t);
  assert.equal(await icon(), await tier(2), "at the start it shows a tier-2 thing");
  await page.evaluate(() => window.__HOLE.autoplay(60 * 30, { until: { level: 1 } }));
  assert.equal((await state()).level, 1, "Gobble grew");
  assert.equal(await icon(), await tier(3), "after the grow it shows a tier-3 thing");
  assert.match(await page.locator(".hole-meter").getAttribute("aria-label"), /percent/, "the meter says what it means");
  await page.evaluate(() => window.__HOLE.autoplay(60 * 60, { until: { level: 5 } }));
  const fin = await page.evaluate(() => window.HoleData.SCENES.find((d) => d.id === "picnic").finale.e);
  assert.equal(await icon(), fin, "at the top size it shows the finale — go and eat it!");
  assert.ok(await page.evaluate(() => document.querySelector(".hole-meter").classList.contains("hole-meter--ready")), "…and it pulses");
});

test("the WIN: the vortex slurps everything, Josh's buddy cheers, ⭐ is saved, ▶ goes on and 🔁 replays", async () => {
  await openScene("space");
  const total = (await state()).total;
  await page.evaluate(() => window.__HOLE.autoplay(60 * 120));
  const s = await state();
  assert.ok(s.won && s.done, "the scene was finished");
  assert.equal((await page.evaluate(() => window.__HOLE.save())).done.space, true, "the ⭐ is recorded");
  await page.locator(".hole-win").waitFor({ state: "visible", timeout: 4000 });
  assert.equal(await page.locator(".hole-win__n").textContent(), String(total), "the count says how much Gobble ate");
  assert.equal(await page.locator(".hole-win__wall span").count(), total, "a wall of everything he ate");
  const btns = await page.evaluate(() => [...document.querySelectorAll(".hole-win__row .btn-big")].map((b) => {
    const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, x: r.x, r: r.right };
  }));
  assert.equal(btns.length, 2);
  for (const b of btns) assert.ok(b.w >= 75 && b.h >= 75, "the win buttons are big (" + Math.round(b.w) + "x" + Math.round(b.h) + ")");
  assert.ok(btns[1].x - btns[0].r >= 14, "…and apart");
  assert.match(await page.locator(".hole-next").textContent(), /🧸/, "▶ shows the next place's door (space wraps round to the toy room)");
  await page.waitForTimeout(400);
  await page.locator(".hole-next").click();
  await page.waitForFunction(() => window.__HOLE.scene() === "toyroom");
  assert.ok(await page.locator(".hole-win").isHidden(), "the win screen goes away");
  assert.equal((await state()).eaten, 0, "a fresh place");
  // 🔁 plays the same place again from the start
  await page.evaluate(() => window.__HOLE.autoplay(60 * 120));
  await page.locator(".hole-win").waitFor({ state: "visible", timeout: 4000 });
  await page.waitForTimeout(400);
  await page.locator(".hole-again").click();
  await page.waitForFunction(() => window.__HOLE.scene() === "toyroom" && window.__HOLE.state().eaten === 0);
  // back home, both finished places wear a ⭐
  await page.locator(".hole-back").click();
  await page.locator("#screen-hole-home").waitFor({ state: "visible" });
  for (const id of ["space", "toyroom"]) {
    assert.ok(await page.locator(`.hole-door[data-scene="${id}"] .hole-door__star`).isVisible(), id + " wears its ⭐");
  }
  assert.ok(await page.locator('.hole-door[data-scene="picnic"] .hole-door__star').isHidden(), "an unfinished place does not");
});

test("progress is KEPT: leaving and coming back — even a reload — resumes the half-eaten place", async () => {
  await openScene("party");
  await page.evaluate(() => window.__HOLE.autoplay(150));
  // park him somewhere else and let everything settle, so nothing is still on
  // its way in when he leaves
  await page.evaluate(() => { const st = window.__HOLE.state(); window.__HOLE.moveTo(st.W * 0.5, st.H * 0.6); });
  await page.waitForTimeout(1500);
  const at = await state();
  await page.locator(".hole-back").click();
  await page.locator("#screen-hole-home").waitFor({ state: "visible" });
  const saved = (await page.evaluate(() => window.__HOLE.save())).runs.party;
  assert.ok(saved && saved.eaten.length >= 3, "leaving saved the half-eaten place (" + (saved && saved.eaten.length) + " eaten)");
  const gone = () => page.evaluate(() => window.__HOLE.state().objects.filter((o) => o.st !== 0).map((o) => o.id).sort((a, b) => a - b));
  const want = [...saved.eaten].sort((a, b) => a - b);
  await page.waitForTimeout(400);
  await page.locator('.hole-door[data-scene="party"]').click();
  await page.waitForFunction(() => window.__HOLE.scene() === "party");
  assert.deepEqual(await gone(), want, "exactly the same things are gone");
  // Where he STOOD comes back too. This is the one thing only the leave hook
  // does — the loop, the sounds and the timers each ALSO check that the screen
  // is visible, so stopping them is guarded twice (a mutation removing the
  // hook stays green on those), but nothing else saves his position.
  const back = await state();
  assert.ok(Math.hypot(back.x - at.x, back.y - at.y) < 0.5,
    "Gobble is back where he was left (" + back.x.toFixed(1) + "," + back.y.toFixed(1) + " vs " + at.x.toFixed(1) + "," + at.y.toFixed(1) + ")");
  // a reload straight into the game carries on where he was
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { location.hash = "#hole-play"; });
  await page.waitForFunction(() => window.__HOLE && window.__HOLE.scene() === "party", null, { timeout: 8000 });
  assert.deepEqual(await gone(), want, "a reload resumes too");
});

test("the loop only runs while he is PLAYING — leaving pauses it completely", async () => {
  await openScene("town");
  assert.ok(await page.evaluate(() => window.__HOLE.running()), "the loop runs on the play screen");
  await page.locator(".hole-back").click();
  await page.locator("#screen-hole-home").waitFor({ state: "visible" });
  assert.ok(!(await page.evaluate(() => window.__HOLE.running())), "…and stops on the home screen");
  const t0 = (await state()).tick;
  await page.waitForTimeout(400);
  assert.equal((await state()).tick, t0, "no hidden simulation keeps ticking");
  assert.equal(await page.evaluate(() => window.__HOLE.timers()), 0, "and no timer outlives the screen");
});

test("sound is OFF by default and every note is mute-gated; with sound on, a gulp sounds", async () => {
  await openScene("toyroom");
  await page.evaluate(() => {
    const A = window.JoshAudio;
    window.__tones = 0; window.__said = [];
    A.__tone = A.__tone || A.tone; A.__say = A.__say || A.say;
    A.tone = () => { window.__tones++; };
    A.say = (t) => { if (!A.isMuted()) window.__said.push(t); };
    A.setMuted(true);
  });
  try {
    await page.evaluate(() => window.__HOLE.autoplay(90));
    await page.waitForTimeout(300);
    assert.ok((await state()).eaten >= 1, "something was eaten");
    assert.equal(await page.evaluate(() => window.__tones), 0, "muted: not a single note");
    await page.evaluate(() => window.JoshAudio.setMuted(false));
    await page.evaluate(() => window.__HOLE.autoplay(90));
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => window.__tones) > 0, "with sound on, the gulps sound");
  } finally {
    await page.evaluate(() => {
      const A = window.JoshAudio;
      A.tone = A.__tone; A.say = A.__say; A.setMuted(true);
    });
  }
});

test("a DOUBLE-TAP cannot walk him somewhere he did not aim: a just-shown screen ignores a finger for 350ms", async () => {
  await page.evaluate(() => window.__HOLE.reset({ demoSeen: true }));
  await go("#hole-home", "#screen-hole-home");
  await page.waitForTimeout(400);
  const door = await page.locator('.hole-door[data-scene="picnic"]').boundingBox();
  // leave, come back, and tap the SAME spot at once — the echo of a tap
  await go("#start", "#screen-start");
  await page.evaluate(() => { location.hash = "#hole-home"; });
  await page.locator("#screen-hole-home").waitFor({ state: "visible" });
  await page.mouse.click(door.x + door.width / 2, door.y + door.height / 2);
  await page.waitForTimeout(200);
  assert.ok(await page.locator("#screen-hole-home").isVisible(), "the echo was swallowed — still on the home screen");
  await page.waitForTimeout(300);
  await page.mouse.click(door.x + door.width / 2, door.y + door.height / 2);
  await page.locator("#screen-hole-play").waitFor({ state: "visible", timeout: 4000 });
  await page.waitForFunction(() => window.__HOLE.scene() === "picnic");
});

test("a HOSTILE save is coerced field by field and never breaks the boot", async () => {
  await page.evaluate(() => localStorage.setItem("josh-gobble-v1", JSON.stringify({
    v: 9, done: { toyroom: "yes", picnic: true, nowhere: true }, demo: 1, last: "nowhere",
    runs: { toyroom: { scene: "toyroom", aspect: "wide", eaten: [1, 1, "x", -3, 1.5] }, space: "junk", party: { scene: "town" } },
  })));
  const errs = pageErrors.length;
  await page.reload({ waitUntil: "load" });
  await go("#hole-home", "#screen-hole-home");
  const sv = await page.evaluate(() => window.__HOLE.save());
  assert.deepEqual(sv.done, { picnic: true }, "only a real `true` for a real place counts");
  assert.equal(sv.demo, false, "a non-boolean demo flag is not trusted");
  assert.equal(sv.last, "toyroom", "an unknown place falls back to the first");
  assert.deepEqual(Object.keys(sv.runs), ["toyroom"], "only a run whose scene matches its slot survives");
  assert.ok(await page.locator('.hole-door[data-scene="picnic"] .hole-door__star').isVisible(), "the real ⭐ shows");
  await page.waitForTimeout(400);
  await page.locator('.hole-door[data-scene="toyroom"]').click();
  await page.waitForFunction(() => window.__HOLE.scene() === "toyroom");
  assert.equal((await state()).eaten, 1, "the junk run resumes with only its one real bite");
  assert.equal(pageErrors.length, errs, "no page errors: " + pageErrors.slice(errs).join(" | "));
});

test("Gobble Hole never touches Josh's games: no registry entry, no sticker, its own storage", async () => {
  const r = await page.evaluate(() => ({
    reg: (window.JoshGames || []).some((g) => /hole|gobble/i.test(g.id)),
    keys: Object.keys(localStorage).filter((k) => /gobble|hole/i.test(k)),
  }));
  assert.equal(r.reg, false, "it is a world, not a registered game (Josh's book stays at 200)");
  assert.deepEqual(r.keys, ["josh-gobble-v1"], "one storage key");
});

test("no uncaught page errors anywhere in the Gobble run", () => {
  assert.deepEqual(pageErrors, [], "page errors: " + pageErrors.join(" | "));
});
