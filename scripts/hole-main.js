// Gobble Hole — the world's shell (PLAN_GOBBLE.md §7). main.js delegates every
// hole-* hash here. This file builds the two screens, runs the fixed-step loop
// ONLY while the play screen is visible, turns a finger into Gobble's target,
// plays the sounds, keeps the save and exposes window.__HOLE for the browser
// tests. The engine (hole-logic.js) decides everything; this file never
// computes a size, a fit or a grow itself.
//
// Josh's kid laws are fully ON here (unlike the fort): every control is >= 75px
// and 16px from its neighbour, nothing fails, nothing times out, extra fingers
// are ignored, and the game is fully playable with sound off.

(function (global) {
  "use strict";
  const doc = global.document;
  const DATA = global.HoleData, L = global.HoleLogic, HR = global.HoleRender;
  if (!doc || !DATA || !L || !HR) return;
  const SCENES = DATA.SCENES, SAY = DATA.SAY;
  const KEY = "josh-gobble-v1";
  // A double-tap is a PLACE and a TIME (the framework's echo guard): the second
  // tap lands on whatever appeared under the finger. Nobody can aim at a thing
  // that appeared 50ms ago, so a screen or a dialog that has just appeared
  // ignores a finger tap for this long.
  const ECHO_MS = 350;
  const MAX_STEPS = 6;         // at most 6 engine steps per frame (a slow frame never spirals)
  const BIG_SAY_GAP = 9;       // seconds between two "too big!" lines
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const now = () => (global.performance && global.performance.now ? global.performance.now() : Date.now());
  const $ = (id) => doc.getElementById(id);

  // ---- Gobble himself: ONE drawing for the front door and the hero ----------
  // A round dark mouth in a patch of ground, two big googly eyes on the back
  // rim, and a sweet tipping in. No <defs>, no ids: this SVG is painted more
  // than once in one document (the SVG-id collapse the Sticker Book hit).
  function art() {
    return (
      '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      '<ellipse cx="50" cy="69" rx="47" ry="29" fill="#f3c98f"/>' +
      '<ellipse cx="50" cy="69" rx="47" ry="29" fill="none" stroke="#d9a868" stroke-width="2"/>' +
      '<ellipse cx="50" cy="70" rx="35" ry="22" fill="#3b1d6e"/>' +
      '<ellipse cx="50" cy="75" rx="29" ry="15" fill="#12071f"/>' +
      '<path d="M15 70 A35 22 0 0 1 85 70" fill="none" stroke="#4f28b8" stroke-width="5"/>' +
      '<path d="M15 70 A35 22 0 0 0 85 70" fill="none" stroke="#7c4dff" stroke-width="5.5"/>' +
      '<path d="M26 86 A33 18 0 0 0 74 86" fill="none" stroke="#c2a8ff" stroke-width="2" stroke-linecap="round"/>' +
      '<g transform="rotate(-28 75 60)">' +
        '<path d="M64 60 l-6 -5 v10 z M86 60 l6 -5 v10 z" fill="#ff5e9c"/>' +
        '<rect x="64" y="54.5" width="22" height="11" rx="5.5" fill="#ff7ab0"/>' +
        '<rect x="69" y="55.5" width="3" height="9" fill="#fff" opacity="0.8"/>' +
        '<rect x="77" y="55.5" width="3" height="9" fill="#fff" opacity="0.8"/>' +
      "</g>" +
      '<ellipse cx="36" cy="38" rx="13" ry="14" fill="#fff" stroke="#1d1233" stroke-width="3"/>' +
      '<ellipse cx="62" cy="38" rx="13" ry="14" fill="#fff" stroke="#1d1233" stroke-width="3"/>' +
      '<circle cx="40" cy="42" r="6.5" fill="#1d1233"/><circle cx="66" cy="42" r="6.5" fill="#1d1233"/>' +
      '<circle cx="37.6" cy="39.2" r="2.1" fill="#fff"/><circle cx="63.6" cy="39.2" r="2.1" fill="#fff"/>' +
      "</svg>"
    );
  }

  // ---- The save: `josh-gobble-v1`, COERCED field by field on load -----------
  // A hand-edited, truncated or older save degrades to a fresh one piece by
  // piece and can never crash the boot (the fort crashed three times on a
  // field one short). A saved run stores only WHICH things were eaten; the
  // engine re-derives the size from them, so a save cannot inflate Gobble.
  function freshSave() { return { v: 1, done: {}, runs: {}, demo: false, last: SCENES[0].id }; }
  const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  function loadSave() {
    const s = freshSave();
    let raw = null;
    try { raw = JSON.parse(global.localStorage.getItem(KEY) || "null"); } catch (e) { raw = null; }
    if (!isObj(raw)) return s;
    for (const sc of SCENES) {
      if (isObj(raw.done) && raw.done[sc.id] === true) s.done[sc.id] = true;
      // a run must name its own slot AND this layout: a half-eaten place from
      // the one-screen islands of phase 1 names ids that mean different
      // things in a big world, so it is dropped (its ⭐ above is kept)
      const r = isObj(raw.runs) ? raw.runs[sc.id] : null;
      if (isObj(r) && r.scene === sc.id && r.v === DATA.RULES.LAYOUT) s.runs[sc.id] = r;
    }
    s.demo = raw.demo === true;
    if (typeof raw.last === "string" && L.sceneById(raw.last)) s.last = raw.last;
    return s;
  }
  let save = loadSave();
  function persist() {
    try { global.localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* private mode: play on */ }
  }

  // ---- Timers that die with the screen (the api.later lesson) ---------------
  // route() only HIDES a screen, so a raw setTimeout keeps talking over the
  // next one. Every delayed thing here goes through later(); stop() clears them.
  const timers = new Set();
  function later(fn, ms) {
    const id = global.setTimeout(() => { timers.delete(id); try { fn(); } catch (e) { /* never break the page */ } }, ms);
    timers.add(id);
    return id;
  }
  function clearLater() { for (const id of timers) global.clearTimeout(id); timers.clear(); }

  // ---- Screens --------------------------------------------------------------
  let home = null, play = null, field = null, canvas = null, render = null, hand = null;
  let meter = null, meterFill = null, meterNext = null, win = null;

  function build() {
    const screens = $("screens");
    if (!screens || $("screen-hole-home")) return;

    home = doc.createElement("section");
    home.id = "screen-hole-home";
    home.className = "screen hole-screen hole-home";
    home.hidden = true;
    home.innerHTML =
      '<div class="game__bar hole-bar">' +
        '<button class="btn-round game__home hole-exit" type="button" aria-label="Back to the front door">🚪</button>' +
        '<h1 class="game__title hole-title">Gobble Hole</h1>' +
        '<button class="btn-round game__hear hole-homehear" type="button" aria-label="Hear it again">👂</button>' +
      "</div>" +
      '<div class="hole-hero art-fill" aria-hidden="true"></div>' +
      '<div class="hole-scenes" role="list" aria-label="Pick a place to eat"></div>';
    screens.appendChild(home);
    home.querySelector(".hole-hero").innerHTML = art();
    home.querySelector(".hole-exit").addEventListener("click", () => { location.hash = ""; });
    home.querySelector(".hole-homehear").addEventListener("click", () => sayNow(SAY.pick));
    const grid = home.querySelector(".hole-scenes");
    SCENES.forEach((sc) => {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "hole-door tap";
      b.dataset.scene = sc.id;
      b.setAttribute("role", "listitem");
      b.style.background = "linear-gradient(160deg, " + sc.backdrop[0] + ", " + sc.backdrop[1] + ")";
      b.style.borderBottomColor = sc.color;
      if (dark(sc.backdrop[1])) b.classList.add("hole-door--dark");
      b.innerHTML =
        '<span class="hole-door__icon" aria-hidden="true"></span>' +
        '<span class="hole-door__label"></span>' +
        '<span class="hole-door__prog" aria-hidden="true" hidden></span>' +
        '<span class="hole-door__star" aria-hidden="true" hidden>⭐</span>';
      b.querySelector(".hole-door__icon").textContent = sc.door;
      b.querySelector(".hole-door__label").textContent = sc.name;
      b.addEventListener("click", () => openScene(sc.id));
      grid.appendChild(b);
    });
    guardEcho(home);

    play = doc.createElement("section");
    play.id = "screen-hole-play";
    play.className = "screen hole-screen hole-play";
    play.hidden = true;
    play.innerHTML =
      '<div class="game__bar hole-bar">' +
        '<button class="btn-round game__home hole-back" type="button" aria-label="Back to the places">🏠</button>' +
        '<div class="hole-meter" role="img" aria-label="Gobble is growing">' +
          '<span class="hole-meter__me art-fill" aria-hidden="true"></span>' +
          '<span class="hole-meter__track" aria-hidden="true"><span class="hole-meter__fill"></span></span>' +
          '<span class="hole-meter__next" aria-hidden="true"></span>' +
        "</div>" +
        '<button class="btn-round game__hear hole-hear" type="button" aria-label="Show me how">👂</button>' +
      "</div>" +
      '<div class="hole-field">' +
        '<canvas class="hole-canvas" role="img" aria-label="Gobble\'s playground. Drag Gobble to eat things and grow bigger."></canvas>' +
        '<div class="hole-hand" aria-hidden="true" hidden>👆</div>' +
        '<div class="hole-win" role="dialog" aria-label="You ate everything!" hidden>' +
          '<div class="hole-win__box">' +
            '<div class="hole-win__cheer" aria-hidden="true">' +
              '<span class="hole-win__buddy art-fill"></span><span class="hole-win__gobble art-fill"></span>' +
            "</div>" +
            '<p class="hole-win__count"><span aria-hidden="true">😋</span> <b class="hole-win__n">0</b></p>' +
            // the treasures he FOUND (eaten before the finale, not by the
            // slurp): only what he found, never a missed one — nothing here
            // can read as a failure
            '<div class="hole-win__gold" role="img" hidden></div>' +
            // the buttons come BEFORE the wall of eaten things: on a small
            // phone the wall scrolls, and what he taps next must never be
            // the part that scrolled away
            '<div class="hole-win__row">' +
              '<button class="btn-big hole-again" type="button" aria-label="Play this place again">🔁</button>' +
              '<button class="btn-big hole-next" type="button" aria-label="Next place">▶</button>' +
            "</div>" +
            '<div class="hole-win__wall" aria-hidden="true"></div>' +
          "</div>" +
        "</div>" +
      "</div>";
    screens.appendChild(play);
    field = play.querySelector(".hole-field");
    canvas = play.querySelector(".hole-canvas");
    hand = play.querySelector(".hole-hand");
    meter = play.querySelector(".hole-meter");
    meterFill = play.querySelector(".hole-meter__fill");
    meterNext = play.querySelector(".hole-meter__next");
    win = play.querySelector(".hole-win");
    play.querySelector(".hole-meter__me").innerHTML = art();
    render = HR.create(canvas);
    play.querySelector(".hole-back").addEventListener("click", () => { location.hash = "#hole-home"; });
    play.querySelector(".hole-hear").addEventListener("click", () => {
      render.endIntro();
      sayNow(SAY.start);
      startDemo();
    });
    // 🔁 is an explicit "again": this place from the start. ▶ goes to the
    // NEXT place and CARRIES ON if he left it half-eaten, exactly as its door
    // on the home screen would — the win must never wipe progress somewhere
    // else (RULE 5). startScene reads only `resume`; an option it does not
    // read is a silent no-op, which is how ▶ first shipped wiping it.
    win.querySelector(".hole-again").addEventListener("click", () => { if (run) startScene(run.def.id); });
    win.querySelector(".hole-next").addEventListener("click", () => { if (run) startScene(nextScene(run.def.id).id, { resume: true }); });
    guardEcho(play);
    // main.js calls __onHide on the visible screen before any navigation.
    play.__onHide = () => { leavePlay(); };
    wireInput();
  }

  // Is this backdrop dark? (the space door takes a light label)
  function dark(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return false;
    const n = parseInt(m[1], 16);
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const Y = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return Y < 0.18;
  }

  function guardEcho(el) {
    el.addEventListener("click", (e) => {
      const finger = e.isTrusted && e.detail !== 0;
      if (!finger) return;
      const since = now() - (el.__shownAt || -1e9);
      const winSince = win && !win.hidden ? now() - (win.__shownAt || -1e9) : 1e9;
      if (since < ECHO_MS || (win && win.contains(e.target) && winSince < ECHO_MS)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, true);
  }

  function nextScene(id) {
    const i = SCENES.findIndex((s) => s.id === id);
    return SCENES[(i + 1) % SCENES.length];
  }

  // A half-eaten place shows how far he got: a little ring in the door's top
  // corner fills as the place empties (the ⭐ in the other corner means
  // finished). It reads the saved ids alone — whole numbers in range, the
  // finale (always id 0: it is placed first) never counted — so a hand-edited
  // save cannot draw a ring past full.
  function eatenFrac(sc) {
    const r = save.runs[sc.id];
    if (!r || !Array.isArray(r.eaten)) return 0;
    const total = L.countOf(sc);
    const ids = new Set(r.eaten.filter((i) => Number.isInteger(i) && i > 0 && i < total));
    return Math.min(1, ids.size / total);
  }
  function paintDoors() {
    if (!home) return;
    for (const b of home.querySelectorAll(".hole-door")) {
      const sc = L.sceneById(b.dataset.scene);
      const done = !!save.done[sc.id];
      const frac = eatenFrac(sc), pct = frac > 0 ? Math.max(1, Math.round(frac * 100)) : 0;
      b.querySelector(".hole-door__star").hidden = !done;
      const prog = b.querySelector(".hole-door__prog");
      prog.hidden = !pct;
      prog.style.setProperty("--p", pct + "%");
      b.setAttribute("aria-label", sc.name + (done ? ", all eaten" : "") + (pct ? ", " + pct + " percent eaten" : ""));
    }
  }

  // ---- Sound: every note through JoshAudio (mute-gated, iOS-safe) ------------
  // tone() itself ignores the mute on purpose (it is also the instrument path),
  // so the gate is here. Nothing sounds while the play screen is hidden.
  function audioOK() {
    const a = global.JoshAudio;
    return !!a && !a.isMuted() && playVisible();
  }
  function tone(f, o) { if (audioOK()) global.JoshAudio.tone(f, o); }
  function notes(seq) {
    for (const n of seq) {
      if (!n[1]) tone(n[0], n[2]);
      else later(() => tone(n[0], n[2]), n[1]);
    }
  }
  function sayNow(text) {
    const a = global.JoshAudio;
    if (a && text && !a.isMuted()) a.say(text);
  }
  function sayPlay(text) { if (playVisible()) sayNow(text); }
  // A gulp is pitched by SIZE — a tiny sweet is a high blip, a bus a low gulp —
  // and gulps in quick succession climb like popping bubble wrap.
  const GULP = [0, 988, 784, 622, 494, 392];
  function gulp(ev) {
    if (ev.finale) {
      notes([[196, 0, { type: "sine", duration: 0.26, gain: 0.3 }], [147, 130, { type: "sine", duration: 0.28, gain: 0.3 }],
        [110, 270, { type: "sine", duration: 0.5, gain: 0.32 }]]);
      return;
    }
    const f = (GULP[ev.tier] || 392) * Math.pow(2, Math.min(ev.combo || 0, 8) / 12);
    notes([[f, 0, { duration: 0.07, gain: 0.2 }], [f * 0.74, 55, { duration: 0.1, gain: 0.2 }]]);
  }
  const SFX = {
    grow: () => notes([[523.25, 0, { gain: 0.22, duration: 0.14 }], [659.25, 90, { gain: 0.22, duration: 0.14 }],
      [783.99, 180, { gain: 0.22, duration: 0.14 }], [1046.5, 270, { gain: 0.24, duration: 0.45 }]]),
    bump: () => notes([[330, 0, { type: "sine", duration: 0.12, gain: 0.13 }], [494, 90, { type: "sine", duration: 0.16, gain: 0.12 }]]),
    burp: () => notes([[98, 0, { type: "sawtooth", duration: 0.28, gain: 0.12, plain: true }],
      [78, 140, { type: "sawtooth", duration: 0.36, gain: 0.1, plain: true }]]),
    // big enough for the finale: a longer fanfare than a grow
    ready: () => notes([[523.25, 0, { gain: 0.22, duration: 0.13 }], [659.25, 100, { gain: 0.22, duration: 0.13 }],
      [783.99, 200, { gain: 0.22, duration: 0.13 }], [1046.5, 300, { gain: 0.24, duration: 0.2 }],
      [783.99, 460, { gain: 0.2, duration: 0.12 }], [1046.5, 560, { gain: 0.26, duration: 0.55 }]]),
    // a treasure: a sparkle running up
    treasure: () => notes([[1318.5, 0, { gain: 0.16, duration: 0.09 }], [1568, 70, { gain: 0.16, duration: 0.09 }],
      [2093, 140, { gain: 0.16, duration: 0.1 }], [2637, 210, { gain: 0.15, duration: 0.3 }]]),
  };
  // The line for the grow that makes him big enough for the finale, naming it
  // ("Wow, so big! Now eat the castle!") — a picture is never spoken.
  function readyLine(def) { return SAY.ready.replace("{finale}", (def.finale && def.finale.say) || "the biggest thing"); }

  // ---- A run -----------------------------------------------------------------
  let run = null;           // { st, def, ate: [emoji...], bigSaid }
  const counts = {};        // every engine event seen (the tests read it)
  let raf = 0, lastT = 0, acc = 0, redraw = true;

  function playVisible() { return !!play && !play.hidden && !doc.hidden; }

  // Open a place from its door: a saved half-eaten run resumes; otherwise a
  // fresh one. The run is created once the play screen is VISIBLE, because a
  // hidden field measures 0 wide (the fort's collapsed-canvas lesson).
  let pending = null;
  function openScene(id) { pending = { id, resume: true }; location.hash = "#hole-play"; }

  function startScene(id, opts) {
    opts = opts || {};
    const def = L.sceneById(id) || SCENES[0];
    stopLoop();
    endDemo();
    hideWin();
    render.resize();
    let st = null, resumed = false;
    if (opts.resume && save.runs[def.id]) { st = L.restore(save.runs[def.id]); resumed = !!st; }
    // the world is the same on every screen (PLAN §9.1): the screen is only
    // a camera onto it, so a save never depends on the device
    if (!st) { st = L.createGame(def); delete save.runs[def.id]; }
    run = {
      st, def, bigSaid: -1e9,
      ate: st.objects.filter((o) => o.st === L.GONE).map((o) => o.e),
      // treasures he has found (a resumed run found the ones already gone)
      found: new Set(st.gold.filter((id) => st.objects[id].st === L.GONE)),
    };
    // a fresh place opens with a look at the whole island and then flies in
    // to Gobble (skipped under reduced motion); a resumed one starts on him
    render.setState(st, { intro: !resumed });
    save.last = def.id;
    persist();
    meterKey = "";
    paintMeter();
    if (!resumed) later(() => sayPlay(SAY.start), 400);
    if (!save.demo) later(demoWhenReady, 1000);   // the first time ever: show, don't tell
    startLoop();
  }

  // ---- The loop: a fixed 60Hz step, only while the play screen is visible ----
  function startLoop() {
    if (raf || !run || !playVisible()) return;
    lastT = 0; acc = 0;
    redraw = true;          // coming back: the canvas may have been cleared
    raf = global.requestAnimationFrame(frame);
    // a win whose dialog timer was cleared by leaving still gets its dialog
    if (run.st.done && win.hidden) later(showWin, 300);
  }
  function stopLoop() {
    if (raf) global.cancelAnimationFrame(raf);
    raf = 0;
    clearLater();
    drag.id = null;
  }
  function frame(ts) {
    raf = 0;
    if (!run || !playVisible()) return;
    const t = ts / 1000;
    if (!lastT) lastT = t - L.DT;
    acc += clamp(t - lastT, 0, 0.1);
    lastT = t;
    steer();
    let n = 0;
    while (acc >= L.DT && n < MAX_STEPS) {
      tickDemo(t);
      L.step(run.st, L.DT);
      drain(t);
      acc -= L.DT;
      n++;
    }
    if (n >= MAX_STEPS) acc = 0;
    // a finished place whose picture has come to rest is not redrawn
    if (redraw || !run.st.done || render.busy(t)) { render.draw(t); redraw = false; }
    placeHand();
    paintMeter();
    raf = global.requestAnimationFrame(frame);
  }

  // The engine speaks in events; this is where they turn into sound, speech
  // and the save. The renderer gets every one too (crumbs, rings, eyes).
  function drain(t) {
    const st = run.st;
    if (!st.events.length) return;
    const evs = st.events.splice(0, st.events.length);
    for (const ev of evs) {
      counts[ev.type] = (counts[ev.type] || 0) + 1;
      render.event(ev);
      if (ev.type === "eat") {
        gulp(ev);
        run.ate.push(ev.e);
        if (ev.gold && !ev.vortex) { run.found.add(ev.id); SFX.treasure(); sayPlay(SAY.treasure); }
        if (!st.won) { save.runs[run.def.id] = L.snapshot(st); persist(); }
      } else if (ev.type === "grow") {
        bounceMeter();
        // the grow that makes him big enough for the finale names it: from
        // here on it is the goal (the edge arrow and a golden beacon show it)
        if (ev.ready) { SFX.ready(); sayPlay(readyLine(run.def)); }
        else { SFX.grow(); sayPlay(SAY.grow[(ev.level - 1) % SAY.grow.length]); }
      } else if (ev.type === "bump") {
        SFX.bump();
        if (t - run.bigSaid > BIG_SAY_GAP) { run.bigSaid = t; sayPlay(SAY.big); }
      } else if (ev.type === "win") {
        // The win is EARNED the moment the finale goes down, so the ⭐ is
        // recorded now — leaving during the slurp can never lose it.
        save.done[run.def.id] = true;
        delete save.runs[run.def.id];
        persist();
        later(() => { SFX.burp(); sayPlay(SAY.win); }, 450);
      } else if (ev.type === "allgone") {
        if (playVisible()) {
          try { if (global.JoshAudio && !global.JoshAudio.isMuted()) global.JoshAudio.winCue(); } catch (e) { /* ignore */ }
          try { if (global.JoshEffects) global.JoshEffects.confetti(); } catch (e) { /* ignore */ }
        }
        later(showWin, 700);
      }
    }
  }

  // ---- The growth meter: progress to the next size, ending in a PICTURE of
  // the next thing Gobble will be able to eat (a non-reader's goal) ----------
  let meterKey = "";
  function tierIcon(def, tier) {
    if (tier > def.tiers.length) return def.finale.e;
    const t = def.tiers[tier - 1];
    return t && t.items.length ? t.items[0][0] : def.finale.e;
  }
  function meterInfo() {
    const st = run.st, h = st.hole, C = st.levels.C, top = st.levels.R.length - 1;
    if (st.won || h.level >= top) return { frac: 1, next: run.def.finale.e, ready: !st.won };
    const lo = C[h.level], hi = C[h.level + 1];
    return { frac: clamp((h.xp - lo) / Math.max(1, hi - lo), 0, 1), next: tierIcon(run.def, h.level + 2), ready: false };
  }
  function paintMeter() {
    if (!run || !meter) return;
    const m = meterInfo();
    const key = Math.round(m.frac * 100) + "|" + m.next + "|" + m.ready;
    if (key === meterKey) return;
    meterKey = key;
    meterFill.style.width = (m.frac * 100).toFixed(1) + "%";
    meterNext.textContent = m.next;
    meter.classList.toggle("hole-meter--ready", m.ready);
    meter.setAttribute("aria-label", m.ready
      ? "Gobble is big enough to eat the biggest thing!"
      : "Gobble is growing: " + Math.round(m.frac * 100) + " percent of the way to the next size");
  }
  function bounceMeter() {
    if (!meter) return;
    meter.classList.remove("hole-meter--pop");
    void meter.offsetWidth;          // restart the animation
    meter.classList.add("hole-meter--pop");
    later(() => meter.classList.remove("hole-meter--pop"), 700);
  }

  // ---- Input: one finger steers Gobble (PLAN §9.2) --------------------------
  // Hold anywhere and he heads for the spot under the finger. The camera
  // follows him, so the spot under a finger held STILL keeps moving ahead of
  // him: holding to one side keeps him going that way (hole.io's steering,
  // with no joystick to learn). That only works if the finger is re-read every
  // frame, not only when it moves — a still finger would otherwise stop
  // steering the moment the camera caught up. A tap sends him to the tapped
  // spot; letting go lets him finish the trip. Extra fingers are ignored.
  const drag = { id: null, cx: 0, cy: 0 };
  function canvasPt(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return { x: cx - r.left, y: cy - r.top };
  }
  function steer() {
    if (!run || drag.id === null) return;
    const c = canvasPt(drag.cx, drag.cy), p = render.toWorld(c.x, c.y);
    L.setTarget(run.st, p.x, p.y);
  }
  // A finger (or a key) during the opening look: straight to Gobble, so the
  // spot under the finger is a spot he can see.
  function wake() {
    const c = render.camera();
    if (c && c.intro) render.snap();
  }
  function wireInput() {
    canvas.addEventListener("pointerdown", (e) => {
      if (!run || drag.id !== null || !e.isPrimary) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      endDemo();
      wake();
      try { if (global.JoshAudio && !global.JoshAudio.isMuted()) global.JoshAudio.unlock(); } catch (err) { /* ignore */ }
      // the edge arrow (NEVER LOST, §9.5): a tap on it sends him to the thing
      // it points at, all the way, however short the tap — it is not a
      // steering finger. (id 0 is a real thing, so the test is !== null.)
      const c = canvasPt(e.clientX, e.clientY), hit = render.arrowAt(c.x, c.y);
      if (hit !== null) {
        const o = run.st.objects[hit];
        if (o) L.setTarget(run.st, o.x, o.y);
        return;
      }
      drag.id = e.pointerId;
      drag.cx = e.clientX; drag.cy = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      steer();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerId !== drag.id) return;
      e.preventDefault();
      drag.cx = e.clientX; drag.cy = e.clientY;
      steer();
    });
    const up = (e) => { if (e.pointerId === drag.id) drag.id = null; };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("lostpointercapture", up);
    // Arrow keys too (a keyboard, or a grown-up at a desk).
    doc.addEventListener("keydown", (e) => {
      if (!run || !playVisible() || !win.hidden) return;
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d) return;
      e.preventDefault();
      endDemo();
      wake();
      // a quarter of what the screen shows, so a key press means the same
      // on a phone and an iPad, small or huge
      const cam = render.camera(), q = cam ? cam.span / 4 : 12, h = run.st.hole;
      L.setTarget(run.st, h.x + d[0] * q, h.y + d[1] * q);
    });
    global.addEventListener("resize", () => {
      if (!run || !playVisible()) return;
      if (render.resize()) render.draw(lastT || 0);
    });
    doc.addEventListener("visibilitychange", () => {
      if (doc.hidden) stopLoop();
      else if (playVisible()) startLoop();
    });
  }

  // ---- Show, don't tell: a ghost hand drags Gobble onto the nearest bite ------
  let demo = null;
  function demoWhenReady() {
    const c = render.camera();
    if (c && c.intro) { later(demoWhenReady, 250); return; }
    startDemo();
  }
  function startDemo() {
    if (!run || run.st.won || !playVisible()) return;
    const st = run.st, n = L.nearestEdible(st);
    if (!n) return;
    demo = { t0: -1, from: { x: st.hole.x, y: st.hole.y }, to: { x: n.x, y: n.y }, id: n.id, dur: 1.5, pt: null };
    hand.hidden = false;
  }
  function tickDemo(t) {
    if (!demo) return;
    if (demo.t0 < 0) demo.t0 = t;
    const p = clamp((t - demo.t0) / demo.dur, 0, 1);
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const x = demo.from.x + (demo.to.x - demo.from.x) * e, y = demo.from.y + (demo.to.y - demo.from.y) * e;
    demo.pt = { x, y };
    L.setTarget(run.st, x, y);
    const o = run.st.objects[demo.id];
    if (p >= 1 && (!o || o.st === L.GONE || t - demo.t0 > demo.dur + 1.2)) endDemo();
  }
  function placeHand() {
    if (!demo || !demo.pt || hand.hidden) return;
    const s = render.toScreen(demo.pt.x, demo.pt.y);
    hand.style.transform = "translate(" + Math.round(s.x) + "px," + Math.round(s.y) + "px)";
  }
  function endDemo() {
    if (!demo) return;
    demo = null;
    if (hand) hand.hidden = true;
    if (!save.demo) { save.demo = true; persist(); }
  }

  // ---- The win: Josh's buddy cheers, and a wall of everything Gobble ate ----
  function showWin() {
    if (!run || !win || !playVisible()) return;
    const box = win.querySelector(".hole-win__box");
    let buddy = "";
    try { buddy = global.JoshBuddy ? global.JoshBuddy.art() : ""; } catch (e) { buddy = ""; }
    const bEl = box.querySelector(".hole-win__buddy");
    if (buddy) bEl.innerHTML = buddy; else bEl.textContent = "🎉";
    box.querySelector(".hole-win__gobble").innerHTML = art();
    box.querySelector(".hole-win__n").textContent = String(run.st.eaten);
    const wall = box.querySelector(".hole-win__wall");
    wall.textContent = "";
    for (const e of run.ate) {
      const s = doc.createElement("span");
      s.textContent = e;
      wall.appendChild(s);
    }
    const gold = box.querySelector(".hole-win__gold");
    gold.textContent = "";
    for (const id of run.st.gold) {
      if (!run.found.has(id)) continue;
      const s = doc.createElement("span");
      s.className = "hole-win__treasure";
      s.textContent = run.st.objects[id].e;
      gold.appendChild(s);
    }
    gold.hidden = !run.found.size;
    gold.setAttribute("aria-label", "Treasures found: " + run.found.size);
    const nx = nextScene(run.def.id);
    const next = win.querySelector(".hole-next");
    next.textContent = "▶ " + nx.door;
    next.setAttribute("aria-label", "Next place: " + nx.name);
    win.hidden = false;
    win.__shownAt = now();
  }
  function hideWin() { if (win) win.hidden = true; }

  function leavePlay() {
    if (run && !run.st.won) { save.runs[run.def.id] = L.snapshot(run.st); persist(); }
    stopLoop();
    endDemo();
  }

  // ---- Routing (main.js delegates every hole-* hash) ------------------------
  const GobbleHole = {
    route(id) {
      if (!home || !play) return false;
      if (id === "hole-home") {
        if (!play.hidden) leavePlay();
        play.hidden = true;
        doc.body.classList.add("hole-mode");
        doc.body.classList.remove("in-game");
        paintDoors();
        home.hidden = false;
        home.__shownAt = now();
        global.scrollTo(0, 0);
        later(() => { if (!home.hidden) sayNow(SAY.pick); }, 300);
        return true;
      }
      if (id === "hole-play") {
        home.hidden = true;
        doc.body.classList.add("hole-mode");
        doc.body.classList.add("in-game");
        play.hidden = false;
        play.__shownAt = now();
        global.scrollTo(0, 0);
        if (pending) {
          const p = pending;
          pending = null;
          startScene(p.id, { resume: p.resume });
        } else if (!run) {
          startScene(save.last, { resume: true });       // a deep link: carry on where he was
        } else {
          render.resize();
          startLoop();
        }
        return true;
      }
      return false;
    },
    // Leaving the world: park the run, stop the loop, drop the theme. Called by
    // main.js on EVERY non-hole route, so it must be harmless when idle.
    onLeave() {
      if (play && !play.hidden) leavePlay();
      if (doc.body) doc.body.classList.remove("hole-mode");
    },
    art,
  };
  global.GobbleHole = GobbleHole;

  // ---- Test hooks (the fort's __TD precedent) --------------------------------
  // The browser tests drive the REAL screen through these: a greedy bot plays a
  // scene through the same engine and the same event path a finger does.
  global.__HOLE = {
    state: () => (run ? run.st : null),
    scene: () => (run ? run.def.id : null),
    save: () => JSON.parse(JSON.stringify(save)),
    reset(opts) {
      save = freshSave();
      if (opts && opts.demoSeen) save.demo = true;
      persist(); run = null; stopLoop(); endDemo(); paintDoors();
      for (const k of Object.keys(counts)) delete counts[k];
    },
    counts: () => ({ ...counts }),
    moveTo(x, y) { if (run) L.setTarget(run.st, x, y); },
    start(id, opts) { startScene(id, opts || {}); return !!run; },
    toScreen(x, y) {
      const r = canvas.getBoundingClientRect(), s = render.toScreen(x, y);
      return { x: r.left + s.x, y: r.top + s.y };
    },
    // Run up to n engine steps RIGHT NOW (no frames), steering with the bot.
    autoplay(n, opts) {
      if (!run) return null;
      const bot = !(opts && opts.bot === false);
      const until = opts && opts.until;
      for (let i = 0; i < (n || 1); i++) {
        const st = run.st;
        if (st.done) break;
        if (until === "win" && st.won) break;
        if (until && typeof until === "object" && until.level != null && st.hole.level >= until.level) break;
        if (bot && !st.won) { const tg = L.botTarget(st); if (tg) L.setTarget(st, tg.x, tg.y); }
        L.step(st, L.DT);
        drain(lastT || 0);
      }
      // the camera eases once per FRAME and this ran many steps in one go, so
      // it jumps to where it was heading (else Gobble could be off screen) —
      // unless a test wants the REAL frames to carry what happens next
      if (!(opts && opts.snap === false)) render.snap();
      render.draw(lastT || 0);
      paintMeter();
      return { eaten: run.st.eaten, level: run.st.hole.level, won: run.st.won, done: run.st.done };
    },
    info: () => (render ? render.info() : null),
    camera: () => (render ? render.camera() : null),
    busy: () => (render ? render.busy(lastT || 0) : true),
    arrow: () => (render ? render.info().arrow : null),
    snap() { if (render && run) { render.snap(); render.draw(lastT || 0); } },
    // where a client (page) point lands in the world
    worldAt(x, y) { const c = canvasPt(x, y); return render.toWorld(c.x, c.y); },
    demo: () => !!demo,
    running: () => !!raf,
    timers: () => timers.size,
  };

  try { build(); } catch (e) { console.error("Gobble Hole: build failed:", e); }
  // The front door's 4th tile wears Gobble (the same drawing as the hero).
  try {
    const mark = doc.querySelector("#start-hole .start-tile__art");
    if (mark) mark.innerHTML = art();
  } catch (e) { /* the emoji fallback stays */ }
})(typeof window !== "undefined" ? window : globalThis);
