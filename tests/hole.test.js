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

test("TWENTY-FOUR places, one door each in an even grid — on a phone the home scrolls to the doors below the fold (never sideways), and the last door opens", async () => {
  // The owner doubled the places again (2026-10-06). Twenty-four doors big
  // enough for a small finger (75px+, 16px apart) cannot fit one phone
  // screen — eight rows three across — so on a phone the home scrolls, as
  // Josh's own launcher does, and the row cut by the fold shows there is
  // more. On an iPad all twenty-four fit, six across (mobile.test.js measures
  // that on the real engine, with the real insets).
  await page.evaluate(() => window.__HOLE.reset({ demoSeen: true }));
  await go("#hole-home", "#screen-hole-home");
  await page.evaluate(() => scrollTo(0, 0));
  const m = await page.evaluate(() => {
    const doors = [...document.querySelectorAll(".hole-door")].map((b) => b.getBoundingClientRect());
    return {
      n: doors.length, places: window.HoleData.SCENES.length,
      cols: new Set(doors.map((r) => Math.round(r.left))).size,
      firstScreen: doors.filter((r) => r.bottom <= innerHeight).length,
      minW: Math.min(...doors.map((r) => r.width)), minH: Math.min(...doors.map((r) => r.height)),
      sw: document.documentElement.scrollWidth, vw: innerWidth,
    };
  });
  assert.equal(m.places, 24, "twenty-four places");
  assert.equal(m.n, m.places, "one door per place");
  assert.equal(m.n % m.cols, 0, "the grid fills evenly: " + m.n + " doors in " + m.cols + " columns leaves no door on its own");
  assert.ok(m.minW >= 75 && m.minH >= 75, "every door is a kid-sized target (" + Math.round(m.minW) + "x" + Math.round(m.minH) + ")");
  assert.ok(m.firstScreen >= 9 && m.firstScreen < m.n, "a phone's first screen shows at least three full rows, and the rest wait below (" + m.firstScreen + " of " + m.n + ")");
  assert.ok(m.sw <= m.vw, "the home never scrolls sideways (" + m.sw + " > " + m.vw + ")");
  // the last door: the page scrolls to it, and a tap there opens its place
  const last = page.locator(".hole-door").last();
  await last.scrollIntoViewIfNeeded();
  const r = await last.boundingBox();
  assert.ok(r && r.y >= 0 && r.y + r.height <= 844, "scrolled to, the last door is all on screen (" + (r && Math.round(r.y)) + ")");
  await page.waitForTimeout(400);
  const id = await page.evaluate(() => window.HoleData.SCENES[window.HoleData.SCENES.length - 1].id);
  await last.click();
  await page.waitForFunction((sid) => window.__HOLE.scene() === sid, id, { timeout: 8000 });
  await page.evaluate(() => scrollTo(0, 0));
});

test("EVERY place opens and draws: its floor, ALL its ground features in the opening look, and its things", async () => {
  // The engine tests prove each feature a place declares HAS a drawing; this
  // draws them, on the real canvas. The opening look shows the whole island,
  // so every feature must be in view and drawn — a feature that throws, or
  // whose box lands OFF the island (so the cull drops it), shows up here.
  // A NaN box does NOT: every cull comparison against NaN is false, so it is
  // never culled and still draws. The engine test's `b.every(Number.isFinite)`
  // carries that case, and is the one that goes red on it.
  const errs = pageErrors.length;
  const ids = await page.evaluate(() => window.HoleData.SCENES.map((d) => d.id));
  for (const id of ids) {
    await page.evaluate(() => window.__HOLE.reset({ demoSeen: true }));
    await go("#hole-home", "#screen-hole-home");
    await page.waitForTimeout(400);
    const r = await page.evaluate(async (sid) => {
      document.querySelector('.hole-door[data-scene="' + sid + '"]').click();
      for (let i = 0; i < 50 && window.__HOLE.scene() !== sid; i++) await new Promise((res) => setTimeout(res, 20));
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const i = window.__HOLE.info(), c = window.__HOLE.camera();
      const def = window.HoleData.SCENES.find((d) => d.id === sid);
      const st = window.__HOLE.state();
      return { scene: window.__HOLE.scene(), intro: c.intro, drawn: i.drawn, decals: def.decals.length, inkless: i.inkless,
        standing: st.objects.filter((o) => o.st === window.HoleLogic.IDLE).length, air: i.air, wantAir: def.air[0] };
    }, id);
    assert.equal(r.scene, id, "fixture: " + id + " opened");
    assert.ok(r.intro, id + ": a fresh place opens with the look at the whole island");
    assert.ok(r.drawn.ok && r.drawn.ground, id + ": the island and its floor are drawn");
    assert.equal(r.drawn.decals, r.decals, id + ": every ground feature is drawn in the look at the whole island (" + r.drawn.decals + " of " + r.decals + ")");
    // everything standing is in that look (a surprise still in its box is not)
    assert.ok(r.standing >= 250, "fixture: " + id + " is a big place (" + r.standing + " things standing)");
    assert.equal(r.drawn.objects, r.standing, id + ": the whole place is drawn in that look (" + r.drawn.objects + " of " + r.standing + " things)");
    assert.equal(r.inkless, 0, id + ": every picture has ink (none fell back to a coloured ball)");
    // its weather is in the air from the first frame (§15.4)
    assert.equal(r.air.kind, r.wantAir, id + ": its air is its own (" + r.wantAir + ")");
    assert.ok(r.air.drawn >= 2, id + ": its " + r.wantAir + " is drawn (" + r.air.drawn + " specks)");
    // …and it PAINTS: the same frame drawn with its air and without it differ
    // (a counter proves the loop ran, not that a speck reached the screen).
    // Measured against a CONTROL, because a frame is not steady for a draw or
    // two after the picture changes: in the toy room two identical draws in a
    // row differed by 2919 px, then 1746, then 18, then 0, and the first frame
    // without the air after one with it differed by 21. Every canvas call,
    // with its whole state and its coordinates, was identical each time, so
    // it is the browser's rasteriser warming up on the thin plank seams — and
    // an unsteady frame passed this check with the air drawing nothing at all.
    // So each picture is drawn until two frames in a row agree: without the
    // air, then with it, then without it again. The two without it must be the
    // same, and the one with it must not.
    const painted = await page.evaluate(() => {
      const def = window.HoleData.SCENES.find((d) => d.id === window.__HOLE.scene());
      const cv = document.querySelector("#screen-hole-play .hole-canvas"), c = cv.getContext("2d");
      const grab = () => c.getImageData(0, 0, cv.width, cv.height).data;
      const diff = (a, b) => {
        let n = 0;
        for (let k = 0; k < a.length; k += 4) if (a[k] !== b[k] || a[k + 1] !== b[k + 1] || a[k + 2] !== b[k + 2]) n++;
        return n;
      };
      const keep = def.air;
      const settle = (air) => {
        def.air = air ? keep : null;
        let prev = null;
        for (let i = 0; i < 12; i++) { window.__HOLE.snap(); const g = grab(); if (prev && diff(prev, g) === 0) return g; prev = g; }
        return null;
      };
      const without = settle(false), withAir = settle(true), again = settle(false);
      def.air = keep; window.__HOLE.snap();
      if (!without || !withAir || !again) return { settled: false };
      return { settled: true, control: diff(without, again), n: diff(withAir, without) };
    });
    assert.ok(painted.settled, id + ": fixture: each picture comes out the same twice in a row within 12 draws");
    assert.equal(painted.control, 0, id + ": fixture: the frame without its air is the same before and after the one with it");
    assert.ok(painted.n >= 30, id + ": its " + r.wantAir + " paints the screen (" + painted.n + " px change with it)");
    // …and it plays: a few bites through the real event path
    const p = await page.evaluate(() => window.__HOLE.autoplay(60 * 3));
    assert.ok(p.eaten >= 3, id + ": Gobble eats in it (" + p.eaten + " in 3s)");
  }
  assert.deepEqual(pageErrors.slice(errs), [], "no page errors drawing any place");
});

test("the FINALE (§15.5): fireworks burst over the island in the place's own colours, a burst of its own weather blows out of Gobble, and each firework pops — none of it under reduced motion, and no weather either", async () => {
  // Won through the real event path; the renderer owns the fireworks' timing
  // and hands the page the burst times, so the pops are counted against
  // HoleRender.FIREWORKS rather than a second list.
  const FW = await page.evaluate(() => window.HoleRender.FIREWORKS);
  // the firework pop's first note (hole-main.js SFX.firework), matched on
  // its whole signature: 1661.22Hz alone is also a cold thing's sound one
  // gulp into a run (1567.98 a semitone up)
  const POP = { f: 1661.22, type: "square", duration: 0.04 };
  const winAndWatch = (ms) => page.evaluate(async (a) => {
    const A = window.JoshAudio;
    window.__pops = 0; let counting = false;
    A.__tone = A.__tone || A.tone;
    A.tone = (f, o) => { if (counting && Math.abs(f - a.pop.f) < 0.01 && o && o.type === a.pop.type && o.duration === a.pop.duration) window.__pops++; };
    A.setMuted(false);
    window.__HOLE.autoplay(60 * 200, { until: "win" });
    counting = true;
    const seen = { fw: 0, burst: 0, left: 0, air: 0 };
    const t0 = performance.now();
    while (performance.now() - t0 < a.ms) {
      await new Promise((r) => requestAnimationFrame(r));
      const f = window.__HOLE.info().fireworks;
      seen.fw = Math.max(seen.fw, f.drawn); seen.burst = Math.max(seen.burst, f.burst); seen.left = Math.max(seen.left, f.left);
      seen.air = Math.max(seen.air, window.__HOLE.info().air.drawn);
    }
    seen.pops = window.__pops;
    seen.won = window.__HOLE.state().won;
    return seen;
  }, { ms, pop: POP });
  const restore = () => page.evaluate(() => { const A = window.JoshAudio; if (A.__tone) A.tone = A.__tone; A.setMuted(true); });
  const last = Math.max(...FW.at) + FW.rise;
  assert.ok(last <= 2, "fixture: every firework bursts within 2s of the win (" + last + "s)");
  try {
    await openScene("party");
    const r = await winAndWatch((last + 0.4) * 1000);
    assert.ok(r.won, "fixture: the party was won");
    assert.equal(r.left, FW.at.length, "all " + FW.at.length + " fireworks are launched: " + JSON.stringify(r));
    assert.ok(r.fw >= 2, "fireworks are DRAWN, several at once at their height: " + JSON.stringify(r));
    assert.ok(r.burst >= 10, "a burst of the place's own weather blows out of Gobble: " + JSON.stringify(r));
    assert.equal(r.pops, FW.at.length, "one pop for each firework, as it bursts: " + JSON.stringify(r));
  } finally { await restore(); }
  // under reduced motion: no weather, no fireworks, no burst — and so no pops
  await page.emulateMedia({ reducedMotion: "reduce" });
  try {
    await openScene("party");
    await frames(3);
    assert.equal(await page.evaluate(() => window.__HOLE.info().air.drawn), 0, "no drifting weather under reduced motion");
    const r = await winAndWatch((last + 0.4) * 1000);
    assert.ok(r.won, "fixture: the party was won");
    assert.deepEqual([r.left, r.fw, r.burst, r.air, r.pops], [0, 0, 0, 0, 0], "nothing launched, drawn or popped under reduced motion: " + JSON.stringify(r));
  } finally {
    await restore();
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
});

test("SUPER SLURP (§15.6): ten in a row and a SWIRL spins round him, as wide as his pull now reaches, with things streaking in — still drawn under reduced motion — and it has its own whoosh, while the sparkle stays at five", async () => {
  // The picture comes from a REAL run of gulps: the bot plays until one goes
  // off. Each frame is drawn until two in a row agree (the rasteriser warms
  // up for a draw or two after the picture changes), with the slurp and
  // without it, and the two without it must be the same.
  for (const reduce of [false, true]) {
    if (reduce) await page.emulateMedia({ reducedMotion: "reduce" });
    try {
      await openScene("toyroom");
      const r = await page.evaluate(() => {
        const H = window.__HOLE;
        H.autoplay(60 * 90, { until: "slurp" });
        const st = H.state();
        const on = st.slurpT, first = H.info().slurp;
        // a few more steps: things past the magnet's own reach come streaking
        let streaks = 0;
        for (let i = 0; i < 30 && st.slurpT > 0.5 && !streaks; i++) { H.autoplay(1); streaks = H.info().slurp.streaks; }
        const cv = document.querySelector("#screen-hole-play .hole-canvas"), c = cv.getContext("2d");
        const grab = () => c.getImageData(0, 0, cv.width, cv.height).data;
        const diff = (a, b) => {
          let n = 0;
          for (let k = 0; k < a.length; k += 4) if (a[k] !== b[k] || a[k + 1] !== b[k + 1] || a[k + 2] !== b[k + 2]) n++;
          return n;
        };
        const keep = st.slurpT;
        const settle = (t) => {
          st.slurpT = t;
          let prev = null;
          for (let i = 0; i < 12; i++) { H.snap(); const g = grab(); if (prev && diff(prev, g) === 0) return g; prev = g; }
          return null;
        };
        // the SWIRL's own pixels: with no thing streaking in (the streaks and
        // the faint ring at the swirl's edge would clear any bar by themselves)
        const zooming = st.objects.filter((q) => q.zoom);
        for (const q of zooming) q.zoom = 0;
        const off = settle(0), withIt = settle(1), again = settle(0);
        const offInfo = H.info().slurp;
        for (const q of zooming) q.zoom = 1;
        st.slurpT = keep; H.snap();
        const settled = !!(off && withIt && again);
        return { on, first, streaks, offInfo, settled, control: settled ? diff(off, again) : -1, n: settled ? diff(withIt, off) : -1 };
      });
      const tag = reduce ? " (reduced motion)" : "";
      assert.ok(r.on > 0, "fixture: a real run of gulps set off a super slurp" + tag);
      assert.ok(r.first.on, "the frame knows it is on" + tag);
      assert.equal(r.first.arms, 4, "a swirl of four arms spins round him" + tag + ": " + JSON.stringify(r.first));
      assert.ok(r.streaks >= 1, "things past the magnet's own reach come streaking in" + tag + " (" + r.streaks + ")");
      assert.deepEqual([r.offInfo.on, r.offInfo.arms, r.offInfo.streaks], [false, 0, 0], "with it over, no swirl and no streaks" + tag);
      assert.ok(r.settled, "fixture: each picture comes out the same twice in a row within 12 draws" + tag);
      // After a big swirl the rasteriser settles a few pixels differently on
      // the floor's thin plank seams (measured 1-12 px, one row along a seam;
      // a frame-to-frame state leak was ruled out by its own test below).
      assert.ok(r.control <= 40, "fixture: the frame without it is the same before and after, but for seam warm-up" + tag + " (" + r.control + " px)");
      // Measured at this size: the swirl changes ~10,200 px, and with its
      // arms drawn invisible the faint ring at its edge still changes ~2,200.
      // The bar sits between, so only the arms can clear it.
      assert.ok(r.n >= 6000, "the swirl's arms PAINT the screen" + tag + " (" + r.n + " px change with it)");
    } finally {
      if (reduce) await page.emulateMedia({ reducedMotion: "no-preference" });
    }
  }
  // THE SOUND: a run of gulps through the real drain sparkles once, at five
  // (as it always has) — the tenth is the super slurp's, and its whoosh runs
  // all the way up the scale
  await openScene("toyroom");
  try {
    const heard = await page.evaluate(async () => {
      const A = window.JoshAudio, D = window.HoleData, L = window.HoleLogic;
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      const st = window.__HOLE.state();
      const e = st.objects.map((o) => o.e).find((x) => D.tasteOf(x) === null);
      // a QUIET place: nothing left for the magnet to pull in, so the only
      // sounds are the events driven here (a real gulp or grow would sound too)
      for (const o of st.objects) if (o.st === L.IDLE) o.st = L.GONE;
      await sleep(600);
      A.__tone = A.__tone || A.tone;
      window.__tones = [];
      A.tone = (f) => { window.__tones.push(f); };
      A.setMuted(false);
      for (let c = 0; c <= 10; c++) { st.events.push({ type: "eat", id: 90000 + c, e, r: 2, tier: 1, combo: c }); await sleep(40); }
      await sleep(400);
      const gulps = window.__tones.slice();
      window.__tones = [];
      st.events.push({ type: "slurp" });
      await sleep(450);
      return { e, gulps, slurp: window.__tones.slice() };
    });
    assert.ok(heard.e, "fixture: a thing with no taste to gulp");
    const sparkles = heard.gulps.filter((f) => Math.abs(f - 1318.5) < 0.01).length;
    assert.equal(sparkles, 1, "the run sparkles once, at five — not again at ten (" + JSON.stringify(heard.gulps) + ")");
    assert.ok(heard.slurp.length >= 8, "the super slurp's whoosh is a run of notes (" + heard.slurp.length + ")");
    assert.ok(heard.slurp.every((f, i) => i === 0 || f > heard.slurp[i - 1]), "…all the way up the scale: " + JSON.stringify(heard.slurp));
  } finally {
    await page.evaluate(() => { const A = window.JoshAudio; if (A.__tone) A.tone = A.__tone; A.setMuted(true); });
  }
});

test("a frame never depends on what the frame before LEFT BEHIND: whatever caps, joins, alpha or dashes the canvas was left with, the same state draws the same picture", async () => {
  // Several strokes leave round caps or joins set (the cave ends every frame
  // on a round join), so without a reset at the top of each frame a picture
  // was partly a picture of whatever the frame before happened to draw last:
  // measured 1794 px different in the toy room, 718 in the cave.
  for (const id of ["toyroom", "cave", "party"]) {
    await openScene(id);
    const r = await page.evaluate(() => {
      const H = window.__HOLE;
      H.autoplay(60 * 4);
      const cv = document.querySelector("#screen-hole-play .hole-canvas"), c = cv.getContext("2d");
      const grab = () => c.getImageData(0, 0, cv.width, cv.height).data;
      const diff = (a, b) => { let n = 0; for (let k = 0; k < a.length; k += 4) if (a[k] !== b[k] || a[k + 1] !== b[k + 1] || a[k + 2] !== b[k + 2]) n++; return n; };
      const settle = (leave) => { let prev = null; for (let i = 0; i < 12; i++) { leave(); H.snap(); const g = grab(); if (prev && diff(prev, g) === 0) return g; prev = g; } return null; };
      const tidy = () => { c.lineCap = "butt"; c.lineJoin = "miter"; c.globalAlpha = 1; c.setLineDash([]); c.globalCompositeOperation = "source-over"; };
      const messy = () => { c.lineCap = "round"; c.lineJoin = "round"; c.globalAlpha = 0.6; c.setLineDash([5, 4]); c.lineDashOffset = 2; c.globalCompositeOperation = "multiply"; c.textAlign = "center"; c.textBaseline = "top"; };
      const a = settle(tidy), b = settle(messy), a2 = settle(tidy);
      tidy(); H.snap();
      return { ok: !!(a && b && a2), control: a && a2 ? diff(a, a2) : -1, left: a && b ? diff(a, b) : -1 };
    });
    assert.ok(r.ok, id + ": fixture: each picture settles within 12 draws");
    assert.ok(r.control <= 40, id + ": fixture: the same state draws the same picture (" + r.control + " px)");
    assert.ok(r.left <= 40, id + ": a canvas left messy by the frame before draws the same picture (" + r.left + " px different)");
  }
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
  // the LAST place, so ▶ wraps round to the first
  const [lastId, firstId, firstDoor] = await page.evaluate(() => { const S = window.HoleData.SCENES; return [S[S.length - 1].id, S[0].id, S[0].door]; });
  await openScene(lastId);
  const total = (await state()).total;
  await page.evaluate(() => window.__HOLE.autoplay(60 * 120));
  const s = await state();
  assert.ok(s.won && s.done, "the scene was finished");
  assert.equal((await page.evaluate(() => window.__HOLE.save())).done[lastId], true, "the ⭐ is recorded");
  await page.locator(".hole-win").waitFor({ state: "visible", timeout: 4000 });
  assert.equal(await page.locator(".hole-win__n").textContent(), String(total), "the count says how much Gobble ate");
  assert.equal(await page.locator(".hole-win__wall span").count(), total, "a wall of everything he ate");
  const btns = await page.evaluate(() => [...document.querySelectorAll(".hole-win__row .btn-big")].map((b) => {
    const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, x: r.x, r: r.right };
  }));
  assert.equal(btns.length, 2);
  for (const b of btns) assert.ok(b.w >= 75 && b.h >= 75, "the win buttons are big (" + Math.round(b.w) + "x" + Math.round(b.h) + ")");
  assert.ok(btns[1].x - btns[0].r >= 14, "…and apart");
  assert.ok((await page.locator(".hole-next").textContent()).includes(firstDoor), "▶ shows the next place's door (the last place wraps round to the first)");
  await page.waitForTimeout(400);
  await page.locator(".hole-next").click();
  await page.waitForFunction((id) => window.__HOLE.scene() === id, firstId);
  assert.ok(await page.locator(".hole-win").isHidden(), "the win screen goes away");
  assert.equal((await state()).eaten, 0, "a fresh place");
  // 🔁 plays the same place again from the start
  await page.evaluate(() => window.__HOLE.autoplay(60 * 120));
  await page.locator(".hole-win").waitFor({ state: "visible", timeout: 4000 });
  await page.waitForTimeout(400);
  await page.locator(".hole-again").click();
  await page.waitForFunction((id) => window.__HOLE.scene() === id && window.__HOLE.state().eaten === 0, firstId);
  // back home, both finished places wear a ⭐
  await page.locator(".hole-back").click();
  await page.locator("#screen-hole-home").waitFor({ state: "visible" });
  for (const id of [lastId, firstId]) {
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
  // GONE, not "not standing": a surprise still inside its box (a picnic tree's
  // fruit) is HIDDEN, and was never eaten
  const gone = await page.evaluate(() => window.__HOLE.state().objects.filter((o) => o.st === window.HoleLogic.GONE).map((o) => o.id).sort((a, b) => a - b));
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
  // GONE, not "not standing": a sweet still inside its piñata is HIDDEN, and
  // was never eaten
  const gone = () => page.evaluate(() => window.__HOLE.state().objects.filter((o) => o.st === window.HoleLogic.GONE).map((o) => o.id).sort((a, b) => a - b));
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
  // a place where a straight walk from the start reaches the island's left
  // edge — no water, no wall of things on the way (derived, so a reshaped
  // place cannot quietly make the trip impossible: Busy Town became a plus
  // sign, and its start row now ends at the bar's side)
  const id = await page.evaluate(() => {
    const L = window.HoleLogic;
    for (const d of window.HoleData.SCENES) {
      const G = L.geomOf(d), sx = G.start.x, sy = G.start.y;
      let ok = sx > 140;
      for (let x = 4; ok && x <= sx; x += 2) if (G.walk(x, sy) > 0) ok = false;
      if (ok && L.layout(d).objects.some((o) => (o.solid || o.lock) && Math.abs(o.y - sy) < o.r + 4 && o.x < sx)) ok = false;
      if (ok) return d.id;
    }
    return null;
  });
  assert.ok(id, "fixture: some place has a clear walk from its start to the left edge");
  await openScene(id);
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
  // long enough for the trip at his top start speed, plus a second and a half
  // to slow down at the rim (the world, not a constant, sets the distance)
  const steps = Math.ceil((s0.x / RULES.VMAX + 1.5) / 0.25);
  for (let i = 0; i < steps; i++) {
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

// Make Gobble the TOP size with the whole place still standing (what a grow
// to the last level does, without playing there).
const makeTop = () => page.evaluate(() => {
  const st = window.__HOLE.state(), top = st.levels.R.length - 1;
  st.hole.level = top; st.hole.R = st.hole.r = st.levels.R[top]; st.hole.xp = st.levels.C[top];
  return top;
});
// A wait that fails by NAME: a bare waitForFunction timeout reads as a slow
// page, when what it means is a feature that never showed up.
async function until(fn, arg, ms, what) {
  try { await page.waitForFunction(fn, arg, { timeout: ms }); }
  catch (e) { assert.fail(what + " (waited " + ms + "ms)"); }
}
const frames = (n) => page.evaluate((k) => new Promise((res) => {
  const go = (i) => (i <= 0 ? res() : requestAnimationFrame(() => go(i - 1)));
  go(k);
}), n || 2);

test("BIG ENOUGH for the finale: the arrow points at it from anywhere, Gobble wears a crown, and the finale calls him", async () => {
  // A wandering child, with nothing pointing at the finale, took 16-93s
  // (median, by place; up to two minutes) to find it once he was big
  // enough; with the arrow, 2-9s (PLAN_GOBBLE.md §12).
  await openScene("toyroom");
  await frames(2);
  let i = await page.evaluate(() => window.__HOLE.info());
  assert.equal(i.goal, null, "at the start there is no goal");
  assert.ok(i.face && !i.face.crown, "…and no crown");
  assert.ok(!i.arrow || !i.arrow.goal, "…and no goal arrow");
  await makeTop();
  // far from the finale, with plenty he can eat all round him — the arrow
  // used to wait for NOTHING edible to be in view; the goal does not
  const far = await page.evaluate(() => {
    const st = window.__HOLE.state();
    st.hole.x = st.hole.tx = st.W * 0.12; st.hole.y = st.hole.ty = st.H * 0.9;
    window.__HOLE.snap();
    const v = window.__HOLE.camera().view, FIT = window.HoleData.RULES.FIT, h = st.hole;
    const fin = st.objects.find((o) => o.finale);
    return {
      edibleInView: st.objects.filter((o) => o.st === 0 && o.r <= h.r * FIT && o.x > v.x0 && o.x < v.x1 && o.y > v.y0 && o.y < v.y1).length,
      fin: { id: fin.id, x: fin.x, y: fin.y, e: fin.e },
      finInView: fin.x > v.x0 && fin.x < v.x1 && fin.y > v.y0 && fin.y < v.y1,
    };
  });
  assert.ok(far.edibleInView >= 5, "fixture: plenty he can eat is in view (" + far.edibleInView + ")");
  assert.ok(!far.finInView, "fixture: the finale is off screen");
  await until(() => { const a = window.__HOLE.arrow(); return a && a.goal; }, null, 4000, "big enough and far away, the arrow points at the finale");
  const a = await page.evaluate(() => window.__HOLE.arrow());
  const f = await field();
  assert.equal(a.id, far.fin.id, "the arrow points at the finale");
  assert.equal(a.e, far.fin.e, "…and holds its picture");
  assert.ok(a.x - a.r >= -1 && a.x + a.r <= f.width + 1 && a.y - a.r >= -1 && a.y + a.r <= f.height + 1, "the bubble is on screen");
  assert.ok(a.hit * 2 >= 75, "a kid-sized tap target (" + a.hit * 2 + "px across)");
  assert.ok((await page.evaluate(() => window.__HOLE.info().face)).crown, "big enough: Gobble wears his crown");
  await page.waitForTimeout(400);
  await page.mouse.click(f.x + a.x, f.y + a.y);
  const t = await state();
  assert.ok(Math.hypot(t.tx - far.fin.x, t.ty - far.fin.y) < 0.5, "a tap on the bubble sends him to the finale");
  // beside it: the beacon is drawn round its foot, and it hops
  await page.evaluate((p) => { const st = window.__HOLE.state(); st.hole.x = st.hole.tx = p.x + 55; st.hole.y = st.hole.ty = p.y + 60; window.__HOLE.snap(); }, far.fin);
  await frames(3);
  i = await page.evaluate(() => window.__HOLE.info());
  assert.ok(i.goal && i.goal.id === far.fin.id, "on screen, the finale wears its beacon");
  assert.ok(!i.arrow || !i.arrow.goal, "…and the arrow steps aside");
});

test("SOUNDS: every challenge makes its own sound and the lines are said once in a while; every place opens with its OWN tune, and Music Land's gulps play it note by note", async () => {
  // The engine tests prove each mechanic EMITS its event (LOCK/KEY, BOX,
  // TREE, PORTALS, CURRENT, ICE) and a law there proves every event the
  // engine can emit reaches this page's drain. This drives each one through
  // the REAL drain and listens: every one sounds, the ones with a line say
  // it, and a line that could come a hundred times (a portal, a current, the
  // ice) is said once a run — a popping box at most once in 8 seconds.
  await page.evaluate(() => {
    const A = window.JoshAudio;
    window.__tones = []; window.__said = [];
    A.__tone = A.__tone || A.tone; A.__say = A.__say || A.say;
    A.tone = (f) => { window.__tones.push(f); };
    A.say = (t) => { if (!A.isMuted()) window.__said.push(t); };
    A.setMuted(false);
  });
  // the notes of `tune`, in order, among what was played (a starter the
  // magnet pulls in may gulp in between)
  const inOrder = (played, tune) => { let i = 0; for (const f of played) if (f === tune[i]) i++; return i === tune.length; };
  // wait for a place's opening tune — a failure names what was heard, never
  // a bare timeout
  const heardTune = async (id, tune) => {
    try {
      await page.waitForFunction((t) => { let i = 0; for (const f of window.__tones) if (f === t[i]) i++; return i === t.length; }, tune, { timeout: 6000 });
    } catch (e) {
      const heard = await page.evaluate(() => window.__tones.slice(0, 24));
      assert.fail(id + " never played its opening tune " + JSON.stringify(tune) + " — heard " + JSON.stringify(heard));
    }
  };
  try {
    const SAY = await page.evaluate(() => window.HoleData.SAY);
    const tuneOf = (id) => page.evaluate((sid) => window.HoleLogic.sceneById(sid).tune, id);
    // 1. a fresh place opens with its own tune
    await openScene("farm");
    const farmTune = await tuneOf("farm");
    await heardTune("farm", farmTune);
    // 2. every challenge, through the real drain
    const gate = await page.evaluate(() => window.__HOLE.state().objects.find((o) => o.lock).id);
    const fire = async (ev) => {
      await page.evaluate((e) => { window.__tones = []; window.__said = []; window.__HOLE.state().events.push(e); }, ev);
      await page.waitForTimeout(450);
      return page.evaluate(() => ({ tones: window.__tones.length, said: window.__said.slice() }));
    };
    const at = { x: 100, y: 100 };
    const CASES = [
      [{ type: "bump", id: gate, solid: true, locked: true }, SAY.locked],
      [{ type: "unlock", key: "gate", ids: [gate] }, SAY.unlock],
      [{ type: "pop", id: gate, kids: [], x: at.x, y: at.y }, SAY.pop],
      [{ type: "shake", id: gate, kids: [], x: at.x, y: at.y }, null],
      [{ type: "warp", from: [at.x, at.y], to: [at.x + 50, at.y] }, SAY.warp],
      [{ type: "flow", look: "river" }, SAY.flow],
      [{ type: "ice" }, SAY.ice],
      [{ type: "slurp" }, SAY.slurp],
    ];
    for (const [ev, line] of CASES) {
      const r = await fire(ev);
      assert.ok(r.tones > 0, ev.type + (ev.locked ? " (locked)" : "") + " makes a sound");
      if (line) assert.deepEqual(r.said, [line], ev.type + " says its line: " + JSON.stringify(r.said));
      else assert.deepEqual(r.said, [], ev.type + " has a sound and no words");
    }
    // …and again at once: the sound plays, the words do not (a portal, a
    // current, the ice: once a run; a box: once in 8s; "too big": once in 9s)
    for (const [ev] of CASES) {
      const r = await fire(ev);
      assert.ok(r.tones > 0, ev.type + " still sounds the second time");
      if (ev.type !== "unlock") assert.deepEqual(r.said, [], ev.type + " is not said twice in a row: " + JSON.stringify(r.said));
    }
    // a wall of things too big (not locked) thuds, a different sound from
    // the locked gate's rattle
    const thud = await page.evaluate(async () => {
      const out = {};
      for (const [k, e] of [["locked", { type: "bump", id: 0, solid: true, locked: true }], ["solid", { type: "bump", id: 0, solid: true, locked: false }], ["big", { type: "bump", id: 0, solid: false, locked: false }]]) {
        window.__tones = []; window.__HOLE.state().events.push(e);
        await new Promise((r) => setTimeout(r, 450));
        out[k] = window.__tones.join(",");
      }
      return out;
    });
    assert.ok(thud.locked && thud.solid && thud.big, "every bump sounds: " + JSON.stringify(thud));
    assert.equal(new Set([thud.locked, thud.solid, thud.big]).size, 3, "a locked gate, a wall of things and a thing too big each sound different: " + JSON.stringify(thud));
    // 3. Music Land: every gulp plays the NEXT note of its tune
    await openScene("music");
    const tune = await tuneOf("music");
    await heardTune("music", tune);
    await page.waitForTimeout(300);
    const notes = await page.evaluate(async (n) => {
      const st = window.__HOLE.state();
      window.__tones = [];
      for (let i = 0; i < n; i++) { st.events.push({ type: "eat", id: 1 + i, e: "🎵", r: 3, tier: 1, combo: 0 }); await new Promise((r) => setTimeout(r, 60)); }
      await new Promise((r) => setTimeout(r, 300));
      return window.__tones.slice();
    }, tune.length + 2);
    assert.deepEqual(notes, [...tune, tune[0], tune[1]], "each gulp plays the next note of the tune, and round again");
    assert.ok(inOrder(notes, tune), "fixture: the scale is played in order");
  } finally {
    await page.evaluate(() => {
      const A = window.JoshAudio;
      A.tone = A.__tone; A.say = A.__say; A.setMuted(true);
    });
  }
});

test("TASTES (§15.3): a thing with a taste SOUNDS like itself instead of the gulp, SHOWS it on his face (hearts for a sweet, a shiver for a cold thing, a burst for the rest), and its word is said once — never over another line, never lost", async () => {
  // Driven through the REAL drain, one family at a time: the engine tests
  // prove the tables match; this proves what a child hears and sees.
  await openScene("picnic");
  await page.evaluate(() => {
    const A = window.JoshAudio;
    window.__tones = []; window.__said = [];
    A.__tone = A.__tone || A.tone; A.__say = A.__say || A.say;
    A.tone = (f, o) => { window.__tones.push(Math.round(f * 100) / 100 + ":" + ((o && o.type) || "sine")); };
    A.say = (t) => { if (!A.isMuted()) window.__said.push(t); };
    A.setMuted(false);
  });
  try {
    const T = await page.evaluate(() => window.HoleData.TASTES);
    const LOOK = await page.evaluate(() => window.HoleRender.TASTE_LOOK);
    const SAY = await page.evaluate(() => window.HoleData.SAY);
    await page.waitForTimeout(2800);   // the opening tune is over and nothing has been said lately
    // How much of a colour is painted inside his two eyes right now (the
    // canvas, read back): what a child SEES, not what a timer says.
    await page.evaluate(() => {
      window.__eyeInk = (rgb, tol) => {
        const H = window.__HOLE, HR = window.HoleRender, inf = H.info(), h = H.state().hole, dpr = inf.dpr;
        const cv = document.querySelector("#screen-hole-play .hole-canvas"), rc = cv.getBoundingClientRect();
        const p = H.toScreen(h.x, h.y), cx = p.x - rc.left, cy = p.y - rc.top;
        const R = h.r * inf.view.s, eR = HR.eyeR(R), ey = cy - R * window.HoleData.RULES.SQ - eR * 0.25;
        const c = cv.getContext("2d");
        let n = 0;
        for (const side of [-1, 1]) {
          const x0 = Math.round((cx + side * R * 0.42 - eR * 1.3) * dpr), y0 = Math.round((ey - eR * 1.3) * dpr);
          const w = Math.round(eR * 2.6 * dpr), hgt = Math.round(eR * 2.6 * dpr);
          const d = c.getImageData(x0, y0, w, hgt).data;
          for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - rgb[0]) + Math.abs(d[i + 1] - rgb[1]) + Math.abs(d[i + 2] - rgb[2]) <= tol) n++;
        }
        return n;
      };
    });
    // one gulp of `e`: what it sounded like, what was said, and — over the
    // next ~700ms — every face DRAWN, the marks each kind of burst PAINTED,
    // the bursts in flight and whether the rim boinged; plus, for a face, the
    // canvas read back at the moment it was drawn
    const taste = (e, extra, ink) => page.evaluate(async (a) => {
      window.__tones = []; window.__said = [];
      window.__HOLE.state().events.push({ type: "eat", id: 99990, e: a.e, tier: 2, combo: 0, ...(a.extra || {}) });
      const seen = { faces: [], marks: {}, kinds: {}, boing: false, ink: 0 };
      for (let i = 0; i < 28; i++) {
        await new Promise((r) => setTimeout(r, 25));
        const inf = window.__HOLE.info(), f = inf.face && inf.face.taste;
        if (f && !seen.faces.includes(f)) seen.faces.push(f);
        if (a.ink && f === a.ink.face) seen.ink = Math.max(seen.ink, window.__eyeInk(a.ink.rgb, a.ink.tol));
        for (const [k, n] of Object.entries((inf.drawn && inf.drawn.tastes) || {})) seen.marks[k] = Math.max(seen.marks[k] || 0, n);
        for (const [k, n] of Object.entries(inf.fxKinds || {})) seen.kinds[k] = Math.max(seen.kinds[k] || 0, n);
        if (inf.boing) seen.boing = true;
      }
      return { tones: window.__tones.join(" "), said: window.__said.slice(), seen };
    }, { e, extra, ink });
    const HEART = [255, 79, 123], ICY = [216, 241, 255];
    const baseHeart = await page.evaluate((c) => window.__eyeInk(c, 60), HEART);
    // (a tight tolerance: the white frost twinkles round his face are a
    // near colour, and must not count as icy eyes)
    const baseIcy = await page.evaluate((c) => window.__eyeInk(c, 10), ICY);
    // 0. FIRST, while nothing has been said yet: a FINALE that has a taste
    //    (🍭 is Candy Land's) gulps as a finale — no taste look, no taste
    //    word (a sweet's word would be said at once if it were let through)
    assert.ok(T.sweet.includes("🍭"), "fixture: the finale used here is a sweet");
    const fin = await taste("🍭", { finale: true, tier: 6 });
    assert.ok(fin.tones, "fixture: the finale gulps");
    assert.ok(!fin.seen.faces.includes("hearts") && !fin.seen.marks.heart, "no taste look for a finale: " + JSON.stringify(fin.seen));
    assert.deepEqual(fin.said, [], "no taste word for a finale");
    await page.waitForTimeout(1200);   // its sound and shake are over
    // the plain gulp a tier-2 thing makes, for comparison
    const plain = await taste("🧺");
    assert.ok(plain.tones, "fixture: a tasteless thing gulps (" + JSON.stringify(plain) + ")");
    assert.equal(await page.evaluate(() => window.HoleData.tasteOf("🧺")), null, "fixture: the comparison thing has no taste");
    // 1. a sweet: its own sound, heart eyes, little hearts — and its word, at once (all was quiet)
    const sweet = await taste(T.sweet[0], null, { face: "hearts", rgb: HEART, tol: 60 });
    assert.notEqual(sweet.tones, plain.tones, "a sweet does not gulp like anything else");
    assert.ok(sweet.tones, "a sweet makes a sound");
    assert.ok(sweet.seen.faces.includes("hearts"), "a sweet melts his eyes into hearts: " + JSON.stringify(sweet.seen));
    assert.ok(sweet.seen.ink >= 40 && sweet.seen.ink > baseHeart * 4, "…and the hearts are PAINTED in his eyes (" + sweet.seen.ink + " heart-red px, " + baseHeart + " before)");
    assert.deepEqual(sweet.said, [SAY.taste.sweet], "the first sweet is named, once: " + JSON.stringify(sweet.said));
    assert.notEqual(fin.tones, sweet.tones, "the finale's own gulp won over its taste (step 0)");
    // 2. a cold thing straight after: it shivers and sounds, but its word WAITS (a word never talks over another)
    const cold = await taste(T.cold[0], null, { face: "shiver", rgb: ICY, tol: 10 });
    assert.ok(cold.seen.faces.includes("shiver"), "a cold thing makes him shiver: " + JSON.stringify(cold.seen));
    assert.ok(cold.seen.ink >= 40 && cold.seen.ink > baseIcy * 4, "…and his eyes turn icy (" + cold.seen.ink + " icy px, " + baseIcy + " before)");
    assert.deepEqual(cold.said, [], "its word waits for a quiet moment: " + JSON.stringify(cold.said));
    // 3. a second sweet: the sound again, never the word again
    const sweet2 = await taste(T.sweet[1]);
    assert.equal(sweet2.tones, sweet.tones, "every sweet sounds the same (the family's sound)");
    assert.deepEqual(sweet2.said, [], "a family's word is said once a run");
    // 4. a quiet moment later the cold word is said after all — it waited, it was not lost
    await page.waitForTimeout(2700);
    const cold2 = await taste(T.cold[1]);
    assert.deepEqual(cold2.said, [SAY.taste.cold], "the waiting word is said once it is quiet: " + JSON.stringify(cold2.said));
    // 5. every family: its own sound (not the gulp, not another family's) and its own look
    const heard = new Map(), gulpNotes = plain.tones.split(" ");
    for (const [fam, list] of Object.entries(T)) {
      const r = await taste(list[0]);
      assert.ok(r.tones && r.tones !== plain.tones, fam + " (" + list[0] + ") sounds like itself, not the gulp: " + r.tones);
      assert.ok(!gulpNotes.every((n) => r.tones.split(" ").includes(n)), fam + ": its sound plays INSTEAD of the gulp, never on top of it: " + r.tones);
      assert.ok(!heard.has(r.tones), fam + " sounds exactly like " + heard.get(r.tones));
      heard.set(r.tones, fam);
      const L = LOOK[fam];
      if (L.fx) assert.ok(r.seen.marks[L.fx] > 0, fam + " PAINTS its " + L.fx + " burst: " + JSON.stringify(r.seen));
      if (L.face) assert.ok(r.seen.faces.includes(L.face), fam + " shows its " + L.face + " face");
      if (L.boing) assert.ok(r.seen.boing, fam + " boings the rim");
      for (const line of r.said) assert.ok(Object.values(SAY.taste).includes(line), fam + ": nothing but a taste word is said: " + line);
    }
  } finally {
    await page.evaluate(() => {
      const A = window.JoshAudio;
      A.tone = A.__tone; A.say = A.__say; A.setMuted(true);
    });
  }
});

test("with sound on, Gobble NAMES the finale the moment he is big enough, and cheers a treasure", async () => {
  await openScene("toyroom");
  await page.evaluate(() => {
    const A = window.JoshAudio;
    window.__said = [];
    A.__tone = A.__tone || A.tone; A.__say = A.__say || A.say;
    A.tone = () => {};
    A.say = (t) => { if (!A.isMuted()) window.__said.push(t); };
    A.setMuted(false);
  });
  try {
    // a treasure, found by him (the tiny one, on a fresh island)
    const t = await page.evaluate(() => { const st = window.__HOLE.state(); const o = st.objects[st.gold[0]]; return { id: o.id, x: o.x, y: o.y }; });
    await page.evaluate((p) => { const st = window.__HOLE.state(); st.hole.x = st.hole.tx = p.x; st.hole.y = st.hole.ty = p.y; }, t);
    await page.evaluate(() => window.__HOLE.autoplay(90, { bot: false }));
    assert.equal(await page.evaluate((id) => window.__HOLE.state().objects[id].st, t.id), 2, "fixture: the treasure was eaten");
    assert.ok(await page.evaluate(() => window.__said.includes("Ooh, a treasure!")), "a treasure is cheered");
    // the grow that makes him big enough for the finale
    await page.evaluate(() => window.__HOLE.autoplay(60 * 120, { until: { level: 4 } }));
    await page.evaluate(() => { window.__said = []; });
    await page.evaluate(() => window.__HOLE.autoplay(60 * 60, { until: { level: 5 } }));
    assert.equal((await state()).level, 5, "fixture: he reached the top size");
    const said = await page.evaluate(() => window.__said);
    // the toy room's finale, named the way it is spoken (never a picture)
    const want = await page.evaluate(() => window.HoleData.SAY.ready.replace("{finale}", window.HoleLogic.sceneById("toyroom").finale.say));
    assert.ok(/the [a-z]/.test(want) && !want.includes("{"), "fixture: the ready line is filled in (" + want + ")");
    assert.ok(said.includes(want), "the ready line names the finale (" + want + "): " + JSON.stringify(said));
    assert.ok(!said.some((l) => ["Bigger!", "Yum! Bigger!", "Wow, so big!", "Gobble gobble!"].includes(l)), "…instead of an ordinary grow line: " + JSON.stringify(said));
  } finally {
    await page.evaluate(() => {
      const A = window.JoshAudio;
      A.tone = A.__tone; A.say = A.__say; A.setMuted(true);
    });
  }
});

test("TREASURES glitter; eating one is a burst of gold and star eyes; the win shows what he FOUND — never what he missed", async () => {
  await openScene("toyroom");
  const t = await page.evaluate(() => { const st = window.__HOLE.state(); const o = st.objects[st.gold[0]]; return { id: o.id, x: o.x, y: o.y, e: o.e }; });
  await page.evaluate((p) => { const st = window.__HOLE.state(); st.hole.x = st.hole.tx = p.x + 16; st.hole.y = st.hole.ty = p.y + 10; window.__HOLE.snap(); }, t);
  await until(() => window.__HOLE.info().gold >= 1, null, 4000, "a treasure on screen glitters");
  const fx0 = await page.evaluate(() => window.__HOLE.info().fx);
  await page.evaluate((p) => window.__HOLE.moveTo(p.x, p.y), t);
  await until((id) => window.__HOLE.state().objects[id].st === 2, t.id, 6000, "fixture: Gobble eats the treasure he was sent to");
  const i = await page.evaluate(() => window.__HOLE.info());
  assert.ok(i.starEyes, "his eyes turn to stars");
  assert.ok(i.fx >= fx0 + 12, "a burst of gold stars (" + fx0 + " → " + i.fx + " effects)");
  // the win: the row shows the one he found
  await page.evaluate(() => window.__HOLE.autoplay(60 * 150));
  await page.locator(".hole-win").waitFor({ state: "visible", timeout: 6000 });
  const row = await page.evaluate(() => ({
    hidden: document.querySelector(".hole-win__gold").hidden,
    found: [...document.querySelectorAll(".hole-win__treasure")].map((s) => s.textContent),
    label: document.querySelector(".hole-win__gold").getAttribute("aria-label"),
  }));
  assert.ok(!row.hidden && row.found.includes(t.e), "the win shows the treasure he found (" + JSON.stringify(row.found) + ")");
  assert.equal(row.label, "Treasures found: " + row.found.length, "…and says how many");
  // a place won straight away: the slurp eats all three, and that is not
  // FINDING them — so the row is not there (no slot for a missed one)
  await openScene("party");
  await makeTop();
  await page.evaluate(() => { const st = window.__HOLE.state(); const f = st.objects.find((o) => o.finale); st.hole.x = st.hole.tx = f.x; st.hole.y = st.hole.ty = f.y + 30; window.__HOLE.moveTo(f.x, f.y); });
  await page.evaluate(() => window.__HOLE.autoplay(60 * 30, { bot: false }));
  assert.ok((await state()).done, "fixture: the party was won straight away and slurped up");
  await page.locator(".hole-win").waitFor({ state: "visible", timeout: 6000 });
  assert.ok(await page.locator(".hole-win__gold").isHidden(), "no treasures found: no row at all");
});

test("a half-eaten place's DOOR shows how far he got — a ring that fills — and a finished one its ⭐", async () => {
  await openScene("picnic");
  await page.evaluate(() => window.__HOLE.autoplay(60 * 20));
  await page.evaluate(() => { const h = window.__HOLE.state().hole; window.__HOLE.moveTo(h.x, h.y); });
  await page.waitForTimeout(1200);
  const total = (await state()).total;
  await page.locator(".hole-back").click();
  await page.locator("#screen-hole-home").waitFor({ state: "visible" });
  // What he ate is what LEAVING saved — a bite still falling, or one the
  // magnet pulled in on the way out, counts — so read it there, not from the
  // board a moment before (that race once made the two disagree).
  const saved = (await page.evaluate(() => window.__HOLE.save())).runs.picnic;
  const eaten = saved ? new Set(saved.eaten).size : 0;
  assert.equal(await page.evaluate(() => window.__HOLE.scene()), null,
    "on the home screen no place is being PLAYED — the parked run must not answer scene(), or a test waiting for a door reads the wrong run");
  const d = await page.evaluate(() => {
    const door = document.querySelector('.hole-door[data-scene="picnic"]'), ring = door.querySelector(".hole-door__prog");
    const dr = door.getBoundingClientRect(), rr = ring.getBoundingClientRect(), ir = door.querySelector(".hole-door__icon").getBoundingClientRect();
    return {
      hidden: ring.hidden, p: ring.style.getPropertyValue("--p"), label: door.getAttribute("aria-label"),
      inside: rr.left >= dr.left && rr.right <= dr.right && rr.top >= dr.top && rr.bottom <= dr.bottom,
      others: [...document.querySelectorAll(".hole-door")].filter((b) => b !== door && !b.querySelector(".hole-door__prog").hidden).length,
    };
  });
  const pct = Math.max(1, Math.round((eaten / total) * 100));
  assert.ok(eaten >= 10, "fixture: the picnic is half-eaten (" + eaten + " of " + total + ")");
  assert.ok(!d.hidden, "its door shows the ring");
  assert.equal(d.p, pct + "%", "the ring is " + pct + "% full — what he ate of the place");
  assert.match(d.label, new RegExp(pct + " percent eaten"), "…and the door says so");
  assert.ok(d.inside, "the ring sits inside its door");
  assert.equal(d.others, 0, "no other door wears a ring");
  // finish it: the ring goes and the ⭐ comes
  await page.waitForTimeout(400);
  await page.locator('.hole-door[data-scene="picnic"]').click();
  await page.waitForFunction(() => window.__HOLE.scene() === "picnic");
  assert.equal((await state()).eaten, eaten, "fixture: the door carried on the half-eaten picnic");
  await page.evaluate(() => window.__HOLE.autoplay(60 * 150));
  assert.ok((await state()).done, "fixture: he finished it");
  await page.locator(".hole-win").waitFor({ state: "visible", timeout: 6000 });
  await page.locator(".hole-back").click();
  await page.locator("#screen-hole-home").waitFor({ state: "visible" });
  assert.ok(await page.locator('.hole-door[data-scene="picnic"] .hole-door__prog').isHidden(), "finished: no ring");
  assert.ok(await page.locator('.hole-door[data-scene="picnic"] .hole-door__star').isVisible(), "…the ⭐ instead");
});

test("Gobble's FACE stays on screen at the island's top edge — eyes, hat and crown, even at his biggest", async () => {
  // At the back edge a big Gobble's eyes stood above the world's top, and
  // the camera stopped at the island: at the two biggest sizes his eyes were
  // cut off by up to 19px. The camera now looks up just far enough — and
  // since he wears something in every place (§15.2), far enough for THAT too.
  //   This test used to stand him at the BEACH's top edge, and it went
  // VACUOUS when phase 4 made the beach a ring of ovals: told to stand at
  // y=0, the engine put him back on walkable ground at y=37.5, where the
  // camera never needs headroom, and every assertion passed with nothing
  // tested. So the places are now DERIVED (an island that really reaches
  // the world's top edge), and the fixture asserts he really stands there.
  //   Of those places it takes the tallest HAT (it matters at the middle
  // sizes, before the crown takes its place) and the tallest thing at his
  // SIDE (it stays on beside the crown, so it matters at the biggest size).
  const pick = await page.evaluate(() => {
    const W = window.HoleRender.WEAR, L = window.HoleLogic, out = [];
    for (const d of window.HoleData.SCENES) {
      const st = L.createGame(d);
      st.hole.x = st.hole.tx = st.W * 0.3; st.hole.y = st.hole.ty = 0; L.step(st);
      if (st.hole.y < 1) out.push({ id: d.id, slot: W[d.wear[0]].slot, up: W[d.wear[0]].up(20, 30) });
    }
    const best = (slot) => out.filter((o) => o.slot === slot).sort((a, b) => b.up - a.up)[0];
    return { n: out.length, top: best("top"), side: best("side") };
  });
  assert.ok(pick.n >= 3 && pick.top && pick.side, "fixture: places whose island reaches the world's top edge, with a hat and with a thing at his side (" + JSON.stringify(pick) + ")");
  for (const id of [pick.top.id, pick.side.id]) {
    await openScene(id);
    for (const lv of [0, 2, 3, 4, 5]) {
      const y = await page.evaluate((lvl) => {
        const st = window.__HOLE.state();
        st.hole.level = lvl; st.hole.R = st.hole.r = st.levels.R[lvl];
        st.hole.x = st.hole.tx = st.W * 0.3; st.hole.y = st.hole.ty = 0;
        window.__HOLE.snap();
        return st.hole.y;
      }, lv);
      await frames(3);
      const f = await page.evaluate(() => window.__HOLE.info().face);
      const at = await page.evaluate(() => window.__HOLE.state().hole.y);
      assert.ok(y < 1 && at < 1, id + " level " + lv + ": fixture — Gobble really stands at the island's top edge (y " + at.toFixed(1) + ")");
      assert.ok(f.top >= 0, id + " level " + lv + ": his whole face is on screen, " + (f.wear || "crown") + " and all (its top at " + f.top.toFixed(1) + "px)");
      if (lv === 5) assert.ok(f.crown, id + ": at the top size the crown is on, and it is on screen too");
    }
  }
});

test("every thing Gobble WEARS stays inside the headroom it declares — so the camera can never cut off a wizard's hat (ink checked at three sizes, plain and wide-eyed)", async () => {
  // The camera keeps `up` px above his eyes for what he wears (faceUp); a
  // drawing that pokes above its own `up` would be cut off at the island's
  // top edge with every number saying it fits. So each kind is DRAWN, and
  // its highest inked pixel is compared with what it declares.
  const res = await page.evaluate(() => {
    const HR = window.HoleRender, out = [];
    const cv = document.createElement("canvas"); cv.width = 760; cv.height = 680;
    const c = cv.getContext("2d");
    for (const kind of Object.keys(HR.WEAR)) {
      const W = HR.WEAR[kind];
      for (const R of [18, 60, 160]) for (const k of [1, HR.EYE.wide]) for (const now of [0, 0.37, 1.1]) {
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
        const e = HR.eyeR(R) * k, sp = R * 0.42, x = 360, y = 600;
        c.save(); W.draw(c, x, y, e, sp, "#ff5e7e", "#ffd24d", now); c.restore();
        const d = c.getImageData(0, 0, cv.width, cv.height).data;
        let top = -1, n = 0;
        for (let yy = 0; yy < cv.height && top < 0; yy++) {
          for (let xx = 0; xx < cv.width; xx++) if (d[(yy * cv.width + xx) * 4 + 3] > 8) { top = yy; break; }
        }
        for (let i = 3; i < d.length; i += 4 * 3) if (d[i] > 8) n++;
        out.push({ kind, R, k: +k.toFixed(2), now, top, n, limit: y - W.up(e, sp) });
      }
    }
    return out;
  });
  assert.ok(res.length >= 18 * 18, "fixture: every kind was drawn (" + res.length + ")");
  for (const r of res) {
    assert.ok(r.n > 20, r.kind + " R=" + r.R + ": it actually draws something (" + r.n + " px)");
    assert.ok(r.top >= r.limit - 1, r.kind + " R=" + r.R + " eyes x" + r.k + " t=" + r.now + ": its ink reaches " + (r.limit - r.top).toFixed(1) + "px above what it declares");
  }
});

test("a HAT gives way to the crown once he is big enough for the finale; a thing at his SIDE stays on", async () => {
  const kinds = await page.evaluate(() => {
    const W = window.HoleRender.WEAR, S = window.HoleData.SCENES;
    const top = S.find((d) => W[d.wear[0]].slot === "top"), side = S.find((d) => W[d.wear[0]].slot === "side");
    return { top: top.id, topWear: top.wear[0], side: side.id, sideWear: side.wear[0] };
  });
  await openScene(kinds.top);
  await frames(2);
  let f = await page.evaluate(() => window.__HOLE.info().face);
  assert.equal(f.wear, kinds.topWear, kinds.top + ": Gobble wears its " + kinds.topWear);
  assert.ok(!f.crown, "…and no crown yet");
  await makeTop();
  await frames(2);
  f = await page.evaluate(() => window.__HOLE.info().face);
  assert.ok(f.crown && f.wear === null, kinds.top + ": big enough, the " + kinds.topWear + " gives way to the crown (" + JSON.stringify(f) + ")");
  await openScene(kinds.side);
  await makeTop();
  await frames(2);
  f = await page.evaluate(() => window.__HOLE.info().face);
  assert.ok(f.crown && f.wear === kinds.sideWear, kinds.side + ": the " + kinds.sideWear + " stays on beside the crown (" + JSON.stringify(f) + ")");
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
  // it RESTS there first — the moment a child sees the place's shape and
  // where its finale stands — rather than flying in from its first frame
  assert.ok(Math.abs(c0.span - c0.whole) < 0.5, "the look rests on the WHOLE island at first (" + c0.span.toFixed(1) + " of " + c0.whole.toFixed(1) + ")");
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

test("GROWN-UPS ONLY: ⚙️ starts Gobble Hole over — only the word 'reset' does it; every ⭐ and every half-eaten place go, the place he left cannot come back, and nothing outside Gobble Hole is touched", async () => {
  // The fixture: three finished places, seeded and booted from (a reload, or
  // the page keeps its own copy of the save), plus Josh's own ⭐ and a fort
  // save — neither of which this reset may touch.
  const KEY = "josh-gobble-v1";
  const FORT = JSON.stringify({ v: 1, stars: { casual: {}, normal: { 1: 3 }, heroic: {} }, settings: { sfx: true, music: false, dmgNumbers: false },
    difficulty: "normal", meta: [], ach: [], endlessBest: {}, midRun: null });
  await page.evaluate(({ k, fort }) => {
    localStorage.setItem(k, JSON.stringify({ v: 1, done: { toyroom: true, beach: true, space: true }, runs: {}, demo: true, last: "toyroom" }));
    localStorage.setItem("josh-won-count-feed", "1");
    localStorage.setItem("jon-td-save-v1", fort);
  }, { k: KEY, fort: FORT });
  await page.reload({ waitUntil: "load" });
  // …and one place he leaves HALF-eaten: it is saved, and it is also the run
  // parked in memory — the one ▶, a door or a deep link would carry on
  await page.evaluate(() => { location.hash = "#hole-home"; });
  await page.locator("#screen-hole-home").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  await page.locator('.hole-door[data-scene="picnic"]').click();
  await page.waitForFunction(() => window.__HOLE.scene() === "picnic");
  await page.evaluate(() => { window.__HOLE.snap(); window.__HOLE.autoplay(60 * 20); const h = window.__HOLE.state().hole; window.__HOLE.moveTo(h.x, h.y); });
  await page.waitForTimeout(800);
  await page.locator(".hole-back").click();
  await page.locator("#screen-hole-home").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  const doors = () => page.evaluate(() => ({
    stars: [...document.querySelectorAll(".hole-door__star")].filter((s) => !s.hidden).length,
    rings: [...document.querySelectorAll(".hole-door__prog")].filter((r) => !r.hidden).length,
    said: [...document.querySelectorAll(".hole-door")].filter((d) => /all eaten|percent eaten/.test(d.getAttribute("aria-label"))).length,
  }));
  const saved = await page.evaluate(() => window.__HOLE.save());
  assert.deepEqual(Object.keys(saved.done).sort(), ["beach", "space", "toyroom"], "fixture: three finished places");
  assert.ok(saved.runs.picnic && saved.runs.picnic.eaten.length >= 5, "fixture: the picnic is half-eaten and saved");
  assert.deepEqual(await doors(), { stars: 3, rings: 1, said: 4 }, "fixture: the doors show three ⭐ and one ring");

  // The button is a GROWN-UP's: small and quiet, after the LAST door (never
  // between doors), marked data-adult like Josh's own ⚙️
  const btn = await page.evaluate(() => {
    const b = document.getElementById("hole-reset"), r = b.getBoundingClientRect();
    const last = Math.max(...[...document.querySelectorAll(".hole-door")].map((d) => d.getBoundingClientRect().bottom));
    return { adult: b.dataset.adult, below: r.top - last, h: r.height, inHome: !!b.closest("#screen-hole-home") };
  });
  assert.equal(btn.adult, "1", "the button is marked adult-only");
  assert.ok(btn.inHome, "it lives on Gobble Hole's home");
  assert.ok(btn.below >= 16, "it sits after the last door, clear of it (" + btn.below + "px)");
  assert.ok(btn.h < 75, "it is small and quiet, not a kid-sized target (" + btn.h + "px)");

  // A tap alone opens the gate and clears NOTHING; nor does OK with no word,
  // a wrong word, or Cancel
  const open = async () => {
    await page.locator("#hole-reset").scrollIntoViewIfNeeded();
    await page.locator("#hole-reset").click();
    await page.locator(".gate").waitFor({ state: "visible" });
  };
  await open();
  assert.match(await page.locator(".gate__msg").textContent(), /Gobble Hole/, "the gate says what it will clear");
  assert.equal(await page.locator(".gate__box").getAttribute("aria-label"), "Start Gobble Hole over", "…and its dialog is named for it");
  await page.locator(".gate__ok").click();
  assert.ok(await page.locator(".gate__err").isVisible(), "OK with no word only shows the hint");
  await page.locator(".gate__input").fill("banana");
  await page.locator(".gate__ok").click();
  assert.ok(await page.locator(".gate__err").isVisible(), "a wrong word only shows the hint");
  await page.locator(".gate__cancel").click();
  await page.locator(".gate").waitFor({ state: "hidden" });
  assert.deepEqual(await doors(), { stars: 3, rings: 1, said: 4 }, "nothing is cleared without the word");
  assert.deepEqual(await page.evaluate(() => window.__HOLE.save()), saved, "…and the save is untouched");

  // The word — any case — starts Gobble Hole over
  await page.waitForTimeout(400);
  await open();
  await page.locator(".gate__input").fill("Reset");
  await page.locator(".gate__ok").click();
  await page.locator(".gate").waitFor({ state: "hidden" });
  assert.match(await page.locator(".gate__done").last().textContent(), /Gobble Hole starts over/, "the grown-up is told it worked");
  assert.deepEqual(await doors(), { stars: 0, rings: 0, said: 0 }, "every ⭐ and every ring is gone from the doors");
  const after = await page.evaluate(() => window.__HOLE.save());
  assert.deepEqual(after.done, {}, "no place is finished any more");
  assert.deepEqual(after.runs, {}, "no place is half-eaten any more");
  assert.equal(after.demo, true, "how to play is not progress: he is not shown the ghost hand again (👂 still shows it)");

  // The place he left cannot come back. A wipe that left the run PARKED in
  // memory alive would put it straight back: a deep link carries the parked
  // run on, and leaving the play screen saves it. (A freshly opened place may
  // gulp a starter or two on its own — the magnet — so "fresh" means far
  // short of the old progress, not zero.)
  const old = saved.runs.picnic.eaten.length;
  assert.ok(old >= 10, "fixture: enough was eaten to tell old from fresh (" + old + ")");
  assert.equal(await page.evaluate(() => window.__HOLE.state()), null, "the run parked in memory is dropped too");
  await page.evaluate(() => { location.hash = "#hole-play"; });
  await page.waitForFunction(() => window.__HOLE.scene(), null, { timeout: 8000 });
  assert.notEqual(await page.evaluate(() => window.__HOLE.scene()), "picnic", "a deep link does not carry the old picnic on");
  await page.waitForTimeout(400); // a just-shown screen ignores a finger for 350ms (the echo guard)
  await page.locator(".hole-back").click();
  await page.locator("#screen-hole-home").waitFor({ state: "visible" });
  await page.reload({ waitUntil: "load" });
  await go("#hole-home", "#screen-hole-home");
  const kept = await page.evaluate(() => window.__HOLE.save());
  assert.deepEqual(kept.done, {}, "after a reload no place is finished");
  assert.ok(!kept.runs.picnic, "…and the old picnic was never saved back");
  const d2 = await doors();
  assert.equal(d2.stars, 0, "…and no door wears a ⭐");
  assert.ok(await page.locator('.hole-door[data-scene="picnic"] .hole-door__prog').isHidden(), "…nor the picnic its ring");
  await page.waitForTimeout(400);
  await page.locator('.hole-door[data-scene="picnic"]').click();
  await page.waitForFunction(() => window.__HOLE.scene() === "picnic");
  const fresh = (await state()).eaten;
  assert.ok(fresh <= 2, "its door opens the picnic FRESH (" + fresh + " eaten, against " + old + " before)");
  await page.waitForTimeout(400);
  await page.locator(".hole-back").click();
  await page.locator("#screen-hole-home").waitFor({ state: "visible" });

  // Nothing outside Gobble Hole was touched
  const out = await page.evaluate(() => ({ josh: localStorage.getItem("josh-won-count-feed"), fort: localStorage.getItem("jon-td-save-v1") }));
  assert.equal(out.josh, "1", "Josh's own ⭐ survives Gobble Hole's reset");
  assert.equal(out.fort, FORT, "…and so does the fort");

  // …and the other way round: Josh's ⭐ reset never touches Gobble Hole
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, done: { toyroom: true }, runs: {}, demo: true, last: "toyroom" })), KEY);
  await page.reload({ waitUntil: "load" });
  await go("#home", "#screen-home");
  await page.waitForTimeout(400);
  await page.locator("#reset-stars").scrollIntoViewIfNeeded();
  await page.locator("#reset-stars").click();
  await page.locator(".gate").waitFor({ state: "visible" });
  assert.equal(await page.locator(".gate__box").getAttribute("aria-label"), "Reset stars", "Josh's ⚙️ asks for its own reset");
  await page.locator(".gate__input").fill("reset");
  await page.locator(".gate__ok").click();
  await page.locator(".gate").waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => localStorage.getItem("josh-won-count-feed")), null, "Josh's reset cleared his ⭐");
  const gob = await page.evaluate((k) => localStorage.getItem(k), KEY);
  assert.ok(gob, "…and left Gobble Hole's save alone");
  assert.deepEqual(JSON.parse(gob).done, { toyroom: true }, "…its ⭐ and all");
  await page.evaluate(() => { localStorage.removeItem("jon-td-save-v1"); window.__HOLE.reset({ demoSeen: true }); });
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
