// 🕳️ Gobble Hole — browser tests (Chromium). They drive the REAL screen: the
// front door's fourth door, a real pointer drag that eats, tap-to-glide, the
// too-big bump, a grow and the meter's next picture, the win screen, the save
// and resume, sound gating, the loop pausing off-screen, and the double-tap
// echo guard — and, since the places became BIG worlds (PLAN_GOBBLE.md §9),
// the camera: it follows Gobble and stays on the island, the world is far
// bigger than the screen, a finger held to one side keeps him going, a grow
// zooms out, only what is on screen is drawn, the edge arrow finds the next
// bite, a fresh place opens with a look at the whole island, and the win pulls
// back to show all of it. The engine itself is proven headless in
// hole-logic.test.js; the shipped window.__HOLE hooks (the fort's __TD
// precedent) steer a greedy bot through the same engine and event path a
// finger uses.

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
// so a test that TAPS waits the way a child who looked would. A fresh place
// opens with a 1.6s look at the whole island; a test that works out where
// things are ON SCREEN first ends that look (snap), exactly as a finger would.
async function openScene(id, opts) {
  await page.evaluate((o) => window.__HOLE.reset(o), opts || { demoSeen: true });
  await go("#hole-home", "#screen-hole-home");
  await page.waitForTimeout(400);
  await page.locator(`.hole-door[data-scene="${id}"]`).click();
  await page.locator("#screen-hole-play").waitFor({ state: "visible" });
  await page.waitForFunction((sid) => window.__HOLE.scene() === sid, id);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__HOLE.snap());
}
const state = () => page.evaluate(() => {
  const s = window.__HOLE.state();
  return { eaten: s.eaten, total: s.total, level: s.hole.level, x: s.hole.x, y: s.hole.y, r: s.hole.r, tx: s.hole.tx, ty: s.hole.ty,
    won: s.won, done: s.done, tick: s.tick, W: s.W, H: s.H };
});
const cam = () => page.evaluate(() => window.__HOLE.camera());
// the canvas's box and its middle, in page coordinates
async function field() {
  const b = await page.locator(".hole-canvas").boundingBox();
  return { ...b, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
}

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

test("a REAL drag: put a finger on Gobble and drag him onto a bite — it is eaten", async () => {
  await openScene("picnic");
  const s0 = await state();
  // a finger resting on his middle sends him nowhere: he heads for the spot
  // under the finger, and that spot is where he already is
  const grab = await page.evaluate(() => {
    const h = window.__HOLE.state().hole;
    return window.__HOLE.toScreen(h.x, h.y);
  });
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.waitForTimeout(250);
  const held = await state();
  assert.ok(Math.hypot(held.x - s0.x, held.y - s0.y) < 0.5, "a finger resting on Gobble keeps him where he is (" + Math.hypot(held.x - s0.x, held.y - s0.y).toFixed(2) + ")");
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
  // a spot he can SEE: up and to the left of him, on screen
  const f = await field();
  const spot = { screen: { x: f.cx - f.width * 0.3, y: f.cy - f.height * 0.3 } };
  spot.world = await page.evaluate((p) => window.__HOLE.worldAt(p.x, p.y), spot.screen);
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
  // the NEAREST big thing: a place is several screens across now
  const big = await page.evaluate(() => {
    const st = window.__HOLE.state(), h = st.hole;
    const o = st.objects.filter((ob) => ob.tier === 3).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    window.__HOLE.moveTo(o.x, o.y);
    return o.id;
  });
  const before = await state();
  await page.waitForFunction(() => (window.__HOLE.counts().bump || 0) >= 1, null, { timeout: 8000 });
  const o = await page.evaluate((id) => window.__HOLE.state().objects[id].st, big);
  assert.equal(o, 0, "the big thing is still standing");
  const after = await state();
  assert.ok(after.level >= before.level && after.eaten >= before.eaten && after.r >= before.r,
    "a bump costs nothing — Gobble keeps his size and everything he ate");
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

test("▶ after a win CARRIES ON a place he left half-eaten — winning one place never wipes another", async () => {
  // Half-eat the picnic and leave it: it is the place ▶ leads to after the
  // toy room. (openScene resets the save, so the toy room is opened by its
  // door directly — a second openScene would wipe the picnic.)
  await openScene("picnic");
  await page.evaluate(() => window.__HOLE.autoplay(150));
  // stop him where he is and let anything falling finish falling
  await page.evaluate(() => { const h = window.__HOLE.state().hole; window.__HOLE.moveTo(h.x, h.y); });
  await page.waitForTimeout(1500);
  await page.locator(".hole-back").click();
  await page.locator("#screen-hole-home").waitFor({ state: "visible" });
  const saved = (await page.evaluate(() => window.__HOLE.save())).runs.picnic;
  assert.ok(saved && saved.eaten.length >= 3, "fixture: the picnic was left half-eaten (" + (saved && saved.eaten.length) + " eaten)");
  await page.waitForTimeout(400);
  await page.locator('.hole-door[data-scene="toyroom"]').click();
  await page.waitForFunction(() => window.__HOLE.scene() === "toyroom");
  await page.evaluate(() => window.__HOLE.autoplay(60 * 120));
  await page.locator(".hole-win").waitFor({ state: "visible", timeout: 4000 });
  assert.match(await page.locator(".hole-next").textContent(), /🧺/, "fixture: ▶ leads to the picnic (its door is 🧺)");
  await page.waitForTimeout(400);
  await page.locator(".hole-next").click();
  await page.waitForFunction(() => window.__HOLE.scene() === "picnic");
  const gone = await page.evaluate(() => window.__HOLE.state().objects.filter((o) => o.st !== 0).map((o) => o.id).sort((a, b) => a - b));
  assert.deepEqual(gone, [...saved.eaten].sort((a, b) => a - b),
    "▶ must carry on the half-eaten picnic, not wipe it (" + gone.length + " gone, " + saved.eaten.length + " were eaten)");
  assert.ok((await page.evaluate(() => window.__HOLE.save())).done.toyroom, "…and the toy room still wears its ⭐");
});

test("progress is KEPT: leaving and coming back — even a reload — resumes the half-eaten place", async () => {
  await openScene("party");
  await page.evaluate(() => window.__HOLE.autoplay(150));
  // stop him and let everything settle, so nothing is still on its way in
  // when he leaves
  await page.evaluate(() => { const h = window.__HOLE.state().hole; window.__HOLE.moveTo(h.x, h.y); });
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
    runs: { toyroom: { v: window.HoleData.RULES.LAYOUT, scene: "toyroom", aspect: "wide", eaten: [1, 1, "x", -3, 1.5] },
      space: "junk", party: { scene: "town" }, build: { v: "2", scene: "build", eaten: [1] } },
  })));
  const errs = pageErrors.length;
  await page.reload({ waitUntil: "load" });
  await go("#hole-home", "#screen-hole-home");
  const sv = await page.evaluate(() => window.__HOLE.save());
  assert.deepEqual(sv.done, { picnic: true }, "only a real `true` for a real place counts");
  assert.equal(sv.demo, false, "a non-boolean demo flag is not trusted");
  assert.equal(sv.last, "toyroom", "an unknown place falls back to the first");
  assert.deepEqual(Object.keys(sv.runs), ["toyroom"], "only a run whose scene matches its slot AND this layout survives");
  assert.ok(await page.locator('.hole-door[data-scene="picnic"] .hole-door__star').isVisible(), "the real ⭐ shows");
  await page.waitForTimeout(400);
  await page.locator('.hole-door[data-scene="toyroom"]').click();
  await page.waitForFunction(() => window.__HOLE.scene() === "toyroom");
  assert.equal((await state()).eaten, 1, "the junk run resumes with only its one real bite");
  assert.equal(pageErrors.length, errs, "no page errors: " + pageErrors.slice(errs).join(" | "));
});

// ---- BIG worlds (PLAN_GOBBLE.md §9): the camera --------------------------------

test("the world is BIGGER than the screen: the camera shows a small part of it, follows Gobble, and never looks past the island", async () => {
  await openScene("town");
  const s0 = await state(), c0 = await cam();
  const MARGIN = await page.evaluate(() => window.HoleRender.MARGIN);
  const RULES = await page.evaluate(() => window.HoleData.RULES);
  const vw = (c) => c.view.x1 - c.view.x0, vh = (c) => c.view.y1 - c.view.y0;
  assert.ok(vw(c0) < s0.W / 3 && vh(c0) < s0.H / 3,
    "a phone shows a small part of the place (" + vw(c0).toFixed(0) + "x" + vh(c0).toFixed(0) + " of " + s0.W + "x" + s0.H + ")");
  const inView = (c, x, y) => x >= c.view.x0 && x <= c.view.x1 && y >= c.view.y0 && y <= c.view.y1;
  assert.ok(inView(c0, s0.x, s0.y), "Gobble is on screen");
  // send him to the island's left edge and watch the camera all the way
  await page.evaluate(() => { const h = window.__HOLE.state().hole; window.__HOLE.moveTo(0, h.y); });
  const EPS = 0.01;
  let far = 0;
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(250);
    const s = await state(), c = await cam();
    assert.ok(inView(c, s.x, s.y), "the camera keeps Gobble on screen (step " + i + ")");
    assert.ok(c.view.x0 >= -MARGIN - EPS && c.view.x1 <= s.W + MARGIN + EPS &&
      c.view.y0 >= -RULES.TOP_SLACK - MARGIN - EPS && c.view.y1 <= s.H + 6 + MARGIN + EPS,
      "the camera never looks more than a rim past the island (" + JSON.stringify(c.view) + ")");
    far = Math.max(far, Math.abs(c.x - c0.x));
  }
  assert.ok(far > vw(c0) * 0.8, "the camera travelled with him (" + far.toFixed(1) + " units)");
  // at the edge the camera stops and HE carries on to the rim: the island's
  // edge is on screen, which says "this is the end" without words
  const end = await state(), ce = await cam();
  assert.ok(end.x < 12, "fixture: he reached the left edge (x " + end.x.toFixed(1) + ")");
  assert.ok(Math.abs(ce.view.x0 + MARGIN) < 0.5, "the view is pinned to the island's edge (x0 " + ce.view.x0.toFixed(2) + ")");
});

test("only what is ON SCREEN is drawn — the rest of a big place costs nothing", async () => {
  await openScene("space");
  const r = await page.evaluate(() => {
    const H = window.__HOLE, st = H.state(), c = H.camera(), i = H.info();
    const v = c.view;
    const onScreen = st.objects.filter((o) => o.st === 0 && o.x >= v.x0 && o.x <= v.x1 && o.y >= v.y0 && o.y <= v.y1).length;
    const decals = window.HoleData.SCENES.find((d) => d.id === "space").decals.length;
    return { drawn: i.drawn.objects, standing: i.drawn.standing, onScreen, decalsDrawn: i.drawn.decals, decals };
  });
  assert.ok(r.drawn >= r.onScreen, "nothing on screen is skipped (" + r.drawn + " drawn, " + r.onScreen + " on screen)");
  assert.ok(r.onScreen >= 3, "fixture: there are things on screen to draw (" + r.onScreen + ")");
  assert.ok(r.drawn < r.standing / 3, "only a fraction of the place is drawn (" + r.drawn + " of " + r.standing + ")");
  assert.ok(r.decalsDrawn < r.decals, "…and only the ground features in view (" + r.decalsDrawn + " of " + r.decals + ")");
});

test("hold a finger to one side and Gobble KEEPS GOING that way; let go and he stops", async () => {
  await openScene("picnic");
  const s0 = await state(), f = await field();
  const px = f.cx + 110, py = f.cy;
  const w0 = await page.evaluate((p) => window.__HOLE.worldAt(p.x, p.y), { x: px, y: py });
  const offset = w0.x - s0.x;
  assert.ok(offset > 5, "fixture: the finger is to his right (" + offset.toFixed(1) + " units)");
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.waitForTimeout(2000);
  const held = await state();
  await page.mouse.up();
  const went = held.x - s0.x;
  // the finger never moved: the spot under it kept moving AHEAD of him,
  // because the camera follows him — so he kept going
  assert.ok(went > offset * 4, "a still finger kept him going right (" + went.toFixed(1) + " units, the finger started " + offset.toFixed(1) + " ahead)");
  assert.ok(Math.abs(held.y - s0.y) < went * 0.2, "…in the finger's direction (dx " + went.toFixed(1) + ", dy " + (held.y - s0.y).toFixed(1) + ")");
  await page.waitForTimeout(700);
  const a = await state();
  await page.waitForTimeout(500);
  const b = await state();
  assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 0.5, "letting go lets him finish the trip and stop (" + Math.hypot(b.x - a.x, b.y - a.y).toFixed(2) + ")");
});

test("arrow keys step a QUARTER of what the screen shows — the same feel on a phone and an iPad, small or huge", async () => {
  await openScene("party");
  const s0 = await state(), c0 = await cam();
  await page.keyboard.press("ArrowRight");
  const s1 = await state();
  assert.ok(Math.abs(s1.tx - (s0.x + c0.span / 4)) < 0.01 && Math.abs(s1.ty - s0.y) < 0.01,
    "→ aims a quarter of the view to his right (" + (s1.tx - s0.x).toFixed(2) + " vs " + (c0.span / 4).toFixed(2) + ")");
  // bigger Gobble, wider view, bigger step
  await page.evaluate(() => window.__HOLE.autoplay(60 * 30, { until: { level: 2 } }));
  // the bot's last aim is still pulling him: stop him first, so the key is
  // measured from where he actually stands when it is pressed
  await page.evaluate(() => { const h = window.__HOLE.state().hole; window.__HOLE.moveTo(h.x, h.y); });
  await page.waitForFunction(() => { const h = window.__HOLE.state().hole; return Math.hypot(h.tx - h.x, h.ty - h.y) < 0.01; }, null, { timeout: 3000 });
  const c2 = await cam(), s2 = await state();
  await page.keyboard.press("ArrowUp");
  const s3 = await state();
  assert.ok(Math.abs(s3.ty - (s2.y - c2.span / 4)) < 0.01, "↑ aims a quarter of the (wider) view up");
  assert.ok(c2.span > c0.span * 1.5, "fixture: the view widened with him (" + c0.span.toFixed(1) + " -> " + c2.span.toFixed(1) + ")");
});

test("a grow ZOOMS OUT: the camera shows more of the world, and Gobble never looks smaller on the way", async () => {
  await openScene("picnic");
  const c0 = await cam(), s0 = await state();
  const before = s0.r * c0.s;
  // eat up to the grow in one go, then let the REAL frames carry it: the
  // world pulls back while he swells, and at no frame may he look smaller
  // than he did before it (a camera that zoomed out faster than he grew would
  // shrink him on screen at the very moment the game shouts "BIGGER!")
  await page.evaluate(() => window.__HOLE.autoplay(60 * 30, { until: { level: 1 }, snap: false }));
  assert.equal((await state()).level, 1, "fixture: Gobble grew");
  const samples = await page.evaluate(async () => {
    const out = [], t0 = performance.now();
    while (performance.now() - t0 < 1500) {
      await new Promise((r) => requestAnimationFrame(r));
      const st = window.__HOLE.state(), c = window.__HOLE.camera();
      out.push({ px: st.hole.r * c.s, span: c.span, follow: c.follow });
    }
    return out;
  });
  assert.ok(samples.length >= 20, "fixture: real frames ran (" + samples.length + ")");
  const low = Math.min(...samples.map((x) => x.px)), last = samples[samples.length - 1];
  assert.ok(low >= before * 0.98, "he never looks smaller through the grow (" + before.toFixed(1) + " px before, " + low.toFixed(1) + " at the lowest)");
  assert.ok(last.px > before * 1.05, "…and ends up bigger on screen (" + before.toFixed(1) + " -> " + last.px.toFixed(1) + " px)");
  assert.ok(last.span > c0.span * 1.2, "the view widened (" + c0.span.toFixed(1) + " -> " + last.span.toFixed(1) + " units)");
  assert.ok(Math.abs(last.span - last.follow) < 0.3, "…to the engine's view span for his new size (" + last.span.toFixed(2) + " vs " + last.follow.toFixed(2) + ")");
});

test("NEVER LOST: with nothing to eat in view, an arrow bubble points at a bite — tap it and he goes there", async () => {
  await openScene("picnic");
  // Fixture: leave exactly ONE thing he can eat, well off screen, and clear
  // every other edible thing — the moment the arrow exists for.
  const far = await page.evaluate(() => {
    const st = window.__HOLE.state(), h = st.hole, v = window.__HOLE.camera().view;
    const FIT = window.HoleData.RULES.FIT;
    const edible = st.objects.filter((o) => o.st === 0 && o.r <= h.r * FIT);
    const off = edible.filter((o) => o.x < v.x0 - 10 || o.x > v.x1 + 10 || o.y < v.y0 - 10 || o.y > v.y1 + 10);
    off.sort((a, b) => Math.abs(Math.hypot(a.x - h.x, a.y - h.y) - 110) - Math.abs(Math.hypot(b.x - h.x, b.y - h.y) - 110));
    const keep = off[0];
    for (const o of edible) if (o !== keep) o.st = 2;
    return { id: keep.id, e: keep.e, d: Math.hypot(keep.x - h.x, keep.y - h.y) };
  });
  await page.waitForFunction(() => window.__HOLE.arrow(), null, { timeout: 4000 });
  const a = await page.evaluate(() => window.__HOLE.arrow());
  const f = await field();
  assert.equal(a.id, far.id, "the arrow points at the one bite left");
  assert.equal(a.e, far.e, "…and holds its picture");
  assert.ok(a.x - a.r >= -1 && a.x + a.r <= f.width + 1 && a.y - a.r >= -1 && a.y + a.r <= f.height + 1,
    "the bubble is on screen (" + a.x.toFixed(0) + "," + a.y.toFixed(0) + " in " + f.width.toFixed(0) + "x" + f.height.toFixed(0) + ")");
  assert.ok(a.hit * 2 >= 75, "a kid-sized tap target (" + a.hit * 2 + "px across)");
  await page.mouse.click(f.x + a.x, f.y + a.y);
  const t = await state(), o = await page.evaluate((id) => { const ob = window.__HOLE.state().objects[id]; return { x: ob.x, y: ob.y }; }, far.id);
  assert.ok(Math.hypot(t.tx - o.x, t.ty - o.y) < 0.5, "a tap on the bubble sends him to the thing itself, however short the tap");
  await page.waitForFunction(() => !window.__HOLE.arrow(), null, { timeout: 6000 });
  await page.waitForFunction((id) => window.__HOLE.state().objects[id].st !== 0, far.id, { timeout: 8000 });
});

test("a fresh place OPENS with a look at the whole island, then flies in to Gobble; a finger during it goes straight to him", async () => {
  await page.evaluate(() => window.__HOLE.reset({ demoSeen: true }));
  await go("#hole-home", "#screen-hole-home");
  await page.waitForTimeout(400);
  await page.locator('.hole-door[data-scene="party"]').click();
  await page.waitForFunction(() => window.__HOLE.scene() === "party");
  await page.waitForTimeout(80);
  const c0 = await cam();
  assert.ok(c0.intro, "a fresh place starts with the opening look");
  assert.ok(c0.span > c0.follow * 3, "…of (nearly) the whole island (" + c0.span.toFixed(0) + " vs " + c0.follow.toFixed(0) + " units)");
  await page.waitForFunction(() => !window.__HOLE.camera().intro, null, { timeout: 4000 });
  await page.waitForFunction(() => { const c = window.__HOLE.camera(); return Math.abs(c.span - c.follow) < 0.5; }, null, { timeout: 3000 });
  // again, and this time a finger lands during the opening look
  await page.locator(".hole-back").click();
  await page.locator("#screen-hole-home").waitFor({ state: "visible" });
  await page.evaluate(() => window.__HOLE.reset({ demoSeen: true }));
  await go("#hole-home", "#screen-hole-home");
  await page.waitForTimeout(400);
  await page.locator('.hole-door[data-scene="party"]').click();
  await page.waitForFunction(() => window.__HOLE.scene() === "party");
  await page.waitForTimeout(80);
  assert.ok((await cam()).intro, "fixture: the opening look is running");
  const f = await field();
  await page.mouse.move(f.cx + 60, f.cy - 60);
  await page.mouse.down();
  const c1 = await cam(), s1 = await state();
  await page.mouse.up();
  assert.ok(!c1.intro && Math.abs(c1.span - c1.follow) < 0.01, "a finger ends the look at once and the camera is on Gobble");
  assert.ok(s1.tx >= c1.view.x0 && s1.tx <= c1.view.x1 && s1.ty >= c1.view.y0 && s1.ty <= c1.view.y1,
    "…so the spot under the finger is a spot he can see");
});

test("a place he comes back to does NOT replay the opening look, and reduced motion never plays it", async () => {
  await openScene("build");
  await page.evaluate(() => window.__HOLE.autoplay(120));
  await page.evaluate(() => { const h = window.__HOLE.state().hole; window.__HOLE.moveTo(h.x, h.y); });
  await page.waitForTimeout(800);
  await page.locator(".hole-back").click();
  await page.locator("#screen-hole-home").waitFor({ state: "visible" });
  assert.ok((await page.evaluate(() => window.__HOLE.save())).runs.build, "fixture: the place was left half-eaten");
  await page.waitForTimeout(400);
  await page.locator('.hole-door[data-scene="build"]').click();
  await page.waitForFunction(() => window.__HOLE.scene() === "build");
  await page.waitForTimeout(80);
  assert.ok(!(await cam()).intro, "coming back starts right on Gobble");
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    await page.evaluate(() => window.__HOLE.reset({ demoSeen: true }));
    await go("#hole-home", "#screen-hole-home");
    await page.waitForTimeout(400);
    await page.locator('.hole-door[data-scene="town"]').click();
    await page.waitForFunction(() => window.__HOLE.scene() === "town");
    await page.waitForTimeout(80);
    assert.ok(!(await cam()).intro, "under reduced motion a fresh place starts on Gobble too");
  } finally {
    await page.emulateMedia({ reducedMotion: null });
  }
});

test("the WIN pulls the camera all the way back: the whole island, and how much he ate", async () => {
  await openScene("toyroom");
  const c0 = await cam();
  assert.equal(c0.mode, "follow", "fixture: the camera follows him while he plays");
  await page.evaluate(() => window.__HOLE.autoplay(60 * 120, { until: "win" }));
  const s = await state(), c = await cam();
  assert.ok(s.won, "fixture: the place was won");
  assert.equal(c.mode, "whole", "the win switches the camera to the whole island");
  assert.ok(c.view.x0 <= 0 && c.view.x1 >= s.W && c.view.y0 <= 0 && c.view.y1 >= s.H,
    "…and every part of the island is in view (" + JSON.stringify(c.view) + ")");
  await page.locator(".hole-win").waitFor({ state: "visible", timeout: 5000 });
});

test("a finished place STOPS redrawing once its picture is still — and is drawn again when he comes back", async () => {
  // After the win the camera pulls back and the vortex empties the place;
  // once the last puff is gone nothing moves, and redrawing a still picture
  // behind the win dialog only takes time from its confetti.
  await openScene("space");
  await page.evaluate(() => window.__HOLE.autoplay(60 * 120));
  assert.ok((await state()).done, "fixture: the place is finished");
  // the camera is already all the way back (autoplay snaps it), but the
  // win's own moment — Gobble's wide eyes and the burp's puffs — is still to
  // play, so the picture is NOT still yet. (Two guards deliver this: the
  // eyes' timer and the pending puffs. Removing either alone stays green —
  // measured — because the other covers the same moment.)
  assert.ok(await page.evaluate(() => window.__HOLE.busy()), "the win's own moment keeps it busy until it has been drawn out");
  await page.waitForFunction(() => { const i = window.__HOLE.info(); return i && !window.__HOLE.busy(); }, null, { timeout: 8000 });
  const f0 = (await page.evaluate(() => window.__HOLE.info())).frames;
  await page.waitForTimeout(600);
  const f1 = (await page.evaluate(() => window.__HOLE.info())).frames;
  assert.ok(await page.evaluate(() => window.__HOLE.running()), "fixture: the loop is still running");
  assert.equal(f1, f0, "no redraw of a still picture (" + (f1 - f0) + " frames in 600ms)");
  // leave, turn the device (a new size CLEARS the canvas when he comes
  // back), and come back: the still picture must be painted again, or the
  // win dialog would sit on a blank field
  await page.locator(".hole-back").click();
  await page.locator("#screen-hole-home").waitFor({ state: "visible" });
  await page.setViewportSize({ width: 414, height: 800 });
  try {
    await page.evaluate(() => { location.hash = "#hole-play"; });
    await page.locator("#screen-hole-play").waitFor({ state: "visible" });
    const drew = await page.waitForFunction((n) => window.__HOLE.info().frames > n, f1, { timeout: 4000 }).then(() => true, () => false);
    assert.ok(drew, "coming back must paint the still picture again — no frame was drawn");
    await page.waitForTimeout(100);
    const paint = await page.evaluate(() => {
    const cv = document.querySelector(".hole-canvas"), c = cv.getContext("2d");
    const d = c.getImageData(0, 0, cv.width, cv.height).data;
    let lit = 0;
    for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) lit++;
    return lit / Math.ceil(d.length / (4 * 97));
  });
    assert.ok(paint > 0.95, "coming back paints the whole field (" + (paint * 100).toFixed(0) + "% of the canvas)");
  } finally {
    await page.setViewportSize({ width: 390, height: 844 });
  }
});

test("a half-eaten place from the ONE-SCREEN version is dropped, and its ⭐ is kept", async () => {
  // Off the play screen FIRST: a live run rewrites the save (on a gulp, and
  // on leaving), and the reload must boot the seed, not re-open a place.
  await go("", "#screen-start");
  // a phase-1 save: no layout version on its run (its ids name a different,
  // one-screen island)
  await page.evaluate(() => localStorage.setItem("josh-gobble-v1", JSON.stringify({
    v: 1, done: { space: true }, demo: true, last: "picnic",
    runs: { picnic: { scene: "picnic", aspect: 1.2, eaten: [0, 1, 2, 3, 4], x: 60, y: 90 } },
  })));
  await page.reload({ waitUntil: "load" });
  await go("#hole-home", "#screen-hole-home");
  const sv = await page.evaluate(() => window.__HOLE.save());
  assert.ok(!("picnic" in sv.runs), "the old run is dropped (" + JSON.stringify(sv.runs) + ")");
  assert.deepEqual(sv.done, { space: true }, "the finished place is still finished");
  assert.ok(await page.locator('.hole-door[data-scene="space"] .hole-door__star').isVisible(), "…and wears its ⭐");
  await page.waitForTimeout(400);
  await page.locator('.hole-door[data-scene="picnic"]').click();
  await page.waitForFunction(() => window.__HOLE.scene() === "picnic");
  assert.equal((await state()).eaten, 0, "the picnic starts fresh in the big world");
  assert.ok((await cam()).intro, "…as a fresh place, with the opening look");
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
