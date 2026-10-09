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
  const SCENES = DATA.SCENES, SAY = DATA.SAY, LANDS = DATA.LANDS;
  const KEY = "josh-gobble-v1";
  // A double-tap is a PLACE and a TIME (the framework's echo guard): the second
  // tap lands on whatever appeared under the finger. Nobody can aim at a thing
  // that appeared 50ms ago, so a screen or a dialog that has just appeared
  // ignores a finger tap for this long.
  const ECHO_MS = 350;
  const MAX_STEPS = 6;         // at most 6 engine steps per frame (a slow frame never spirals)
  const BIG_SAY_GAP = 9;       // seconds between two "too big!" lines
  const TASTE_QUIET_MS = 2500; // a first-taste word waits until nothing has been said for this long
  const SLURP_SAY_GAP = 20;    // "Super slurp!" at most once in this many seconds of play
  const COUNT_GAP_MS = 700;    // count mode: a number is said once the last line has had this long
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
  // gold: the most TREASURES he has found in each place (0..3, the best ever:
  // the door shows them); seen: the places he has opened (a door he has never
  // opened sparkles, so a new place is easy to find among 48)
  function freshSave() { return { v: 1, done: {}, runs: {}, gold: {}, seen: {}, demo: false, last: SCENES[0].id }; }
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
      const g = isObj(raw.gold) ? raw.gold[sc.id] : 0;
      if (Number.isInteger(g) && g > 0) s.gold[sc.id] = Math.min(g, L.GOLD_BANDS.length);
      // a save from before `seen` existed: a place he finished or left
      // half-eaten is one he has opened
      if ((isObj(raw.seen) && raw.seen[sc.id] === true) || (!isObj(raw.seen) && (s.done[sc.id] || s.runs[sc.id]))) s.seen[sc.id] = true;
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
  let home = null, land = null, play = null, field = null, canvas = null, render = null, hand = null;
  let landNow = null;       // the land whose page is showing (or was last)
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
      // every ⭐ he has won, of all of them (for the grown-up; the lands show
      // their own)
      '<p class="hole-total"><span aria-hidden="true">⭐</span> <b class="hole-total__n">0</b> / <span class="hole-total__of">0</span></p>' +
      // §17: four big LAND doors; each opens its own page of places
      '<div class="hole-lands" role="list" aria-label="Pick a land"></div>' +
      // Grown-ups only: start Gobble Hole over. Small and quiet on purpose,
      // AFTER the last door (never between doors), and behind the app's ONE
      // type-the-word gate (JoshGate, main.js) — a tap alone clears nothing.
      // data-adult: exempt from the kid tap audit, like Josh's own ⚙️.
      '<button class="reset-stars hole-reset" id="hole-reset" type="button" data-adult="1" ' +
        'aria-label="Grown-ups: start Gobble Hole over">⚙️ Grown-ups</button>';
    screens.appendChild(home);
    home.querySelector(".hole-hero").innerHTML = art();
    home.querySelector(".hole-exit").addEventListener("click", () => { location.hash = ""; });
    home.querySelector(".hole-homehear").addEventListener("click", () => sayNow(SAY.pickLand));
    home.querySelector(".hole-reset").addEventListener("click", () => {
      const G = global.JoshGate;
      if (!G) return;
      G.ask({
        label: "Start Gobble Hole over",
        msg: "Grown-ups: type <b>reset</b> to clear every place’s&nbsp;⭐ and start Gobble Hole over",
        confirm: () => (resetProgress({ keepDemo: true }) ? "Gobble Hole starts over! ✨" : "Nothing to clear yet."),
      });
    });
    const lands = home.querySelector(".hole-lands");
    LANDS.forEach((ld) => {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "hole-land tap";
      b.dataset.land = ld.id;
      b.setAttribute("role", "listitem");
      b.style.background = "linear-gradient(160deg, " + ld.backdrop[0] + ", " + ld.backdrop[1] + ")";
      b.style.borderBottomColor = ld.color;
      if (HR.darkHex(ld.backdrop[1])) b.classList.add("hole-land--dark");
      b.innerHTML =
        '<span class="hole-land__pic" aria-hidden="true"></span>' +
        '<span class="hole-land__label"></span>' +
        '<span class="hole-land__stars" aria-hidden="true"></span>';
      b.querySelector(".hole-land__pic").textContent = ld.pic;
      b.querySelector(".hole-land__label").textContent = ld.name;
      b.addEventListener("click", () => { location.hash = "#hole-land-" + ld.id; });
      lands.appendChild(b);
    });
    guardEcho(home);

    // A LAND's page: its places, one door each (every door is built once,
    // here; a land shows its own and hides the rest)
    land = doc.createElement("section");
    land.id = "screen-hole-land";
    land.className = "screen hole-screen hole-landpage";
    land.hidden = true;
    land.innerHTML =
      '<div class="game__bar hole-bar">' +
        '<button class="btn-round game__home hole-landback" type="button" aria-label="Back to the lands">🏠</button>' +
        '<h1 class="game__title hole-title hole-landtitle"></h1>' +
        '<button class="btn-round game__hear hole-landhear" type="button" aria-label="Hear it again">👂</button>' +
      "</div>" +
      '<div class="hole-scenes" role="list" aria-label="Pick a place to eat"></div>';
    screens.appendChild(land);
    land.querySelector(".hole-landback").addEventListener("click", () => { location.hash = "#hole-home"; });
    land.querySelector(".hole-landhear").addEventListener("click", () => sayNow(SAY.pick));
    const grid = land.querySelector(".hole-scenes");
    // in the lands' order (the order ▶ walks)
    LANDS.flatMap((ld) => ld.places.map((id) => L.sceneById(id))).forEach((sc) => {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "hole-door tap";
      b.dataset.scene = sc.id;
      b.dataset.land = DATA.landOf(sc.id).id;
      b.setAttribute("role", "listitem");
      b.style.background = "linear-gradient(160deg, " + sc.backdrop[0] + ", " + sc.backdrop[1] + ")";
      b.style.borderBottomColor = sc.color;
      if (HR.darkHex(sc.backdrop[1])) b.classList.add("hole-door--dark");
      b.innerHTML =
        '<span class="hole-door__icon" aria-hidden="true"></span>' +
        '<span class="hole-door__label"></span>' +
        '<span class="hole-door__prog" aria-hidden="true" hidden></span>' +
        '<span class="hole-door__star" aria-hidden="true" hidden>⭐</span>' +
        // a place he has never opened sparkles (in the ⭐'s corner: a new
        // place has no ⭐ yet)
        '<span class="hole-door__new" aria-hidden="true" hidden>✨</span>' +
        // the treasures he has found here, best ever — only what he FOUND,
        // never an empty slot for one he missed
        '<span class="hole-door__gold" aria-hidden="true" hidden></span>';
      b.querySelector(".hole-door__icon").textContent = sc.door;
      b.querySelector(".hole-door__label").textContent = sc.name;
      b.addEventListener("click", () => openScene(sc.id));
      grid.appendChild(b);
    });
    guardEcho(land);

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
            // the score: how much he ate, then the treasures he FOUND (eaten
            // before the finale, not by the slurp): only what he found, never
            // a missed one — nothing here can read as a failure. One element,
            // so a short screen can set the two side by side (main.css)
            '<div class="hole-win__score">' +
              '<p class="hole-win__count"><span aria-hidden="true">😋</span> <b class="hole-win__n">0</b></p>' +
              '<div class="hole-win__gold" role="img" hidden></div>' +
            "</div>" +
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
    play.querySelector(".hole-back").addEventListener("click", () => {
      const ld = (run && DATA.landOf(run.def.id)) || landNow || LANDS[0];
      location.hash = "#hole-land-" + ld.id;
    });
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

  // ▶ after a win: the next place in the lands' order that has no ⭐ yet (he
  // came to eat, not to replay), else simply the next one
  const ORDER = LANDS.flatMap((ld) => ld.places);
  function nextScene(id) {
    const i = ORDER.indexOf(id);
    for (let k = 1; k <= ORDER.length; k++) {
      const nx = ORDER[(i + k) % ORDER.length];
      if (!save.done[nx]) return L.sceneById(nx);
    }
    return L.sceneById(ORDER[(i + 1) % ORDER.length]);
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
    if (!home || !land) return;
    for (const b of land.querySelectorAll(".hole-door")) {
      const sc = L.sceneById(b.dataset.scene);
      const done = !!save.done[sc.id];
      const frac = eatenFrac(sc), pct = frac > 0 ? Math.max(1, Math.round(frac * 100)) : 0;
      const fresh = !save.seen[sc.id] && !done && !pct;
      const gold = save.gold[sc.id] || 0;
      b.querySelector(".hole-door__star").hidden = !done;
      b.querySelector(".hole-door__new").hidden = !fresh;
      b.classList.toggle("hole-door--new", fresh);
      const g = b.querySelector(".hole-door__gold");
      g.textContent = "🪙".repeat(gold);
      g.hidden = !gold;
      const prog = b.querySelector(".hole-door__prog");
      prog.hidden = !pct;
      prog.style.setProperty("--p", pct + "%");
      b.setAttribute("aria-label", sc.name + (fresh ? ", new" : "") + (done ? ", all eaten" : "") + (pct ? ", " + pct + " percent eaten" : "") +
        (gold ? ", " + gold + (gold === 1 ? " treasure" : " treasures") + " found" : ""));
    }
    let all = 0;
    for (const b of home.querySelectorAll(".hole-land")) {
      const ld = LANDS.find((x) => x.id === b.dataset.land);
      const n = ld.places.filter((id) => save.done[id]).length;
      all += n;
      b.querySelector(".hole-land__stars").textContent = "⭐ " + n + " / " + ld.places.length;
      b.setAttribute("aria-label", ld.name + ", " + n + " of " + ld.places.length + " places eaten");
    }
    home.querySelector(".hole-total__n").textContent = String(all);
    home.querySelector(".hole-total__of").textContent = String(ORDER.length);
  }

  // ---- Starting over: the ONE wipe ------------------------------------------
  // The grown-ups ⚙️ and the __HOLE.reset test hook both go through here, so
  // the two can never disagree on what a fresh start clears (the fort's reset
  // once had two copies, and the field one of them missed crashed the next
  // win). It clears every ⭐ and every half-eaten place — and DROPS the run
  // parked in memory: ▶, a door or a deep link carries that run on, and
  // leaving the play screen saves it, so a wipe that left it alive would put
  // the old progress straight back (the fort's ✕-discard bug, in this world).
  // keepDemo: a grown-up's reset keeps "he has seen how to play" (👂 shows it
  // again any time); the tests' reset starts truly fresh. Returns whether
  // there was anything to clear (a ⭐ or a ring on a door).
  function resetProgress(opts) {
    const had = Object.keys(save.done).length > 0 || SCENES.some((sc) => eatenFrac(sc) > 0);
    const keepDemo = !!(opts && opts.keepDemo) && save.demo;
    save = freshSave();
    if (keepDemo) save.demo = true;
    persist();
    run = null; stopLoop(); endDemo(); paintDoors();
    return had;
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
    if (a && text && !a.isMuted()) { a.say(text); if (run) run.lastSaid = now(); }
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
    // Music Land: every gulp plays the NEXT note of the place's tune (a
    // scale up and round again) — a bell, not a gulp
    if (run && run.def.notes && run.def.tune) {
      const tn = run.def.tune, f = tn[run.noteI++ % tn.length];
      notes([[f, 0, { type: "sine", duration: 0.32, gain: 0.2 }]]);
      return;
    }
    const f = (GULP[ev.tier] || 392) * Math.pow(2, Math.min(ev.combo || 0, 8) / 12);
    // a thing with a TASTE sounds like itself (§15.3) — instead of the gulp,
    // never on top of it — and still climbs with a run of gulps
    const fam = ev.vortex ? null : DATA.tasteOf(ev.e);
    if (fam && TASTE_SFX[fam]) { TASTE_SFX[fam](f / (GULP[ev.tier] || 392)); return; }
    notes([[f, 0, { duration: 0.07, gain: 0.2 }], [f * 0.74, 55, { duration: 0.1, gain: 0.2 }]]);
  }
  // Each family's sound, at a pitch climb `k` (1 for a single gulp). Square
  // and sawtooth are `plain` (no filter): a horn or a beep wants its edge.
  const sq = (d, g) => ({ type: "square", duration: d, gain: g || 0.07, plain: true });
  const sn = (d, g) => ({ type: "sine", duration: d, gain: g || 0.14 });
  const tr = (d, g) => ({ type: "triangle", duration: d, gain: g || 0.15 });
  const TASTE_SFX = {
    sweet: (k) => notes([[659.25 * k, 0, sn(0.12, 0.15)], [830.61 * k, 110, sn(0.24, 0.15)]]),            // "mmm-MM"
    cold: (k) => notes([[1567.98 * k, 0, sn(0.08, 0.11)], [1975.53 * k, 60, sn(0.08, 0.11)], [2349.32 * k, 120, sn(0.2, 0.1)]]),
    honk: (k) => notes([[466.16 * k, 0, sq(0.08)], [466.16 * k, 140, sq(0.13)]]),                         // beep beep
    siren: (k) => notes([[880 * k, 0, sn(0.14, 0.12)], [659.25 * k, 160, sn(0.14, 0.12)], [880 * k, 320, sn(0.14, 0.12)], [659.25 * k, 480, sn(0.18, 0.12)]]),
    choo: (k) => notes([[987.77 * k, 0, sn(0.12, 0.13)], [783.99 * k, 150, sn(0.22, 0.13)]]),              // toot-toot of a little train
    horn: (k) => notes([[196 * k, 0, { type: "sawtooth", duration: 0.28, gain: 0.07, plain: true }], [196 * k, 360, { type: "sawtooth", duration: 0.4, gain: 0.07, plain: true }]]),
    zoom: (k) => notes([[392 * k, 0, sn(0.06, 0.12)], [587.33 * k, 40, sn(0.06, 0.12)], [880 * k, 80, sn(0.06, 0.12)], [1318.5 * k, 120, sn(0.16, 0.12)]]),
    boing: (k) => notes([[392 * k, 0, tr(0.06)], [783.99 * k, 50, tr(0.1)], [523.25 * k, 120, tr(0.12, 0.12)]]),
    ding: (k) => notes([[1318.5 * k, 0, sn(0.5, 0.14)], [1975.53 * k, 0, sn(0.32, 0.05)]]),
    ching: (k) => notes([[2093 * k, 0, sq(0.04, 0.06)], [2637 * k, 60, sn(0.32, 0.12)]]),
    clank: (k) => notes([[523.25 * k, 0, sq(0.05, 0.08)], [415.3 * k, 45, sq(0.07, 0.08)]]),
    beep: (k) => notes([[1046.5 * k, 0, sq(0.05, 0.06)], [783.99 * k, 70, sq(0.05, 0.06)], [1318.5 * k, 140, sq(0.07, 0.06)]]),
    squeak: (k) => notes([[1760 * k, 0, sn(0.06, 0.12)], [2093 * k, 50, sn(0.09, 0.12)]]),
    music: (k) => notes([[523.25 * k, 0, tr(0.09, 0.14)], [659.25 * k, 70, tr(0.09, 0.14)], [783.99 * k, 140, tr(0.09, 0.14)], [1046.5 * k, 210, tr(0.2, 0.14)]]),
    pop: (k) => notes([[1046.5 * k, 0, sq(0.03, 0.1)], [1479.98 * k, 30, sn(0.1, 0.12)]]),
  };
  // Every place has a TUNE of its own (PLAN §14.4): it plays as the place
  // opens, so two places never sound alike either.
  function playTune(def) {
    const tn = def.tune || [];
    notes(tn.map((f, i) => [f, i * 150, { type: "sine", duration: i === tn.length - 1 ? 0.4 : 0.16, gain: 0.16 }]));
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
    // a wall of things too big to eat: a soft, low thud (no buzzer — RULE 5)
    wall: () => notes([[196, 0, { type: "sine", duration: 0.12, gain: 0.16 }], [147, 70, { type: "sine", duration: 0.18, gain: 0.14 }]]),
    // a locked gate: its latch rattles
    locked: () => notes([[392, 0, { type: "square", duration: 0.04, gain: 0.07, plain: true }],
      [349.23, 70, { type: "square", duration: 0.04, gain: 0.07, plain: true }], [392, 140, { type: "square", duration: 0.05, gain: 0.07, plain: true }]]),
    // the key turns — click — and the way opens
    unlock: () => notes([[1318.5, 0, { type: "square", duration: 0.03, gain: 0.07, plain: true }],
      [987.77, 50, { type: "square", duration: 0.03, gain: 0.07, plain: true }], [523.25, 160, { gain: 0.2, duration: 0.12 }],
      [659.25, 250, { gain: 0.2, duration: 0.12 }], [783.99, 340, { gain: 0.22, duration: 0.35 }]]),
    // a box bursts and its surprises tumble out
    pop: () => notes([[880, 0, { type: "square", duration: 0.05, gain: 0.09, plain: true }],
      [1174.66, 60, { gain: 0.16, duration: 0.08 }], [1567.98, 120, { gain: 0.16, duration: 0.16 }]]),
    // a tree shakes its fruit down: a rustle
    shake: () => notes([[740, 0, { duration: 0.06, gain: 0.1 }], [622.25, 60, { duration: 0.06, gain: 0.1 }],
      [740, 120, { duration: 0.06, gain: 0.1 }], [622.25, 180, { duration: 0.1, gain: 0.1 }]]),
    // a portal: whoosh, up and out
    warp: () => notes([[392, 0, { type: "sine", duration: 0.07, gain: 0.14 }], [587.33, 45, { type: "sine", duration: 0.07, gain: 0.14 }],
      [880, 90, { type: "sine", duration: 0.07, gain: 0.14 }], [1318.5, 135, { type: "sine", duration: 0.22, gain: 0.14 }]]),
    // into a current (a river, a belt, a slide): wheee
    flow: () => notes([[523.25, 0, { type: "sine", duration: 0.08, gain: 0.12 }], [659.25, 60, { type: "sine", duration: 0.08, gain: 0.12 }],
      [783.99, 120, { type: "sine", duration: 0.2, gain: 0.12 }]]),
    // onto the ice: a glassy shimmer
    ice: () => notes([[1567.98, 0, { duration: 0.1, gain: 0.1 }], [2093, 60, { duration: 0.1, gain: 0.1 }], [1760, 120, { duration: 0.22, gain: 0.1 }]]),
    // five gulps in a row: a little sparkle (ten is the super slurp's)
    combo: () => notes([[1046.5, 0, { gain: 0.14, duration: 0.07 }], [1318.5, 50, { gain: 0.14, duration: 0.07 }],
      [1567.98, 100, { gain: 0.14, duration: 0.14 }]]),
    // ten in a row, the SUPER SLURP (§15.6): a power-up run all the way up,
    // and a sparkle on top
    slurp: () => notes([[196, 0, tr(0.05, 0.16)], [261.63, 35, tr(0.05, 0.16)], [329.63, 70, tr(0.05, 0.16)],
      [392, 105, tr(0.05, 0.16)], [523.25, 140, tr(0.05, 0.16)], [659.25, 175, tr(0.05, 0.16)],
      [783.99, 210, tr(0.05, 0.16)], [1046.5, 245, tr(0.3, 0.16)], [2093, 300, sn(0.25, 0.08)]]),
    // a firework bursting over the island (§15.5): a soft pop and a crackle
    firework: () => notes([[1661.22, 0, { type: "square", duration: 0.04, gain: 0.05, plain: true }],
      [2489.02, 40, { gain: 0.06, duration: 0.18 }], [3135.96, 110, { gain: 0.04, duration: 0.22 }]]),
    // §17. A key or a button counted toward its gate: a latch click, then a
    // note that climbs with how far the gate has got (1 of 3 low, 3 of 3 high)
    clink: (n) => {
      const f = 659.25 * Math.pow(2, Math.min(Math.max(1, n) - 1, 6) * 4 / 12);
      notes([[1567.98, 0, sq(0.03, 0.06)], [f, 60, sn(0.18, 0.16)]]);
    },
    // a big button pressed into the floor: a deep clunk
    clunk: () => notes([[147, 0, { type: "sine", duration: 0.14, gain: 0.2 }], [110, 90, { type: "sine", duration: 0.22, gain: 0.18 }],
      [880, 180, sq(0.03, 0.05)]]),
    // a bumper too big to eat knocks him back: a big rubbery boing (not the
    // "too big" bump, so it never sounds like a mistake)
    boing: () => notes([[261.63, 0, tr(0.06, 0.18)], [523.25, 50, tr(0.08, 0.18)], [392, 120, tr(0.1, 0.16)], [659.25, 200, tr(0.14, 0.14)]]),
    // a piñata bumped: a hollow bonk, and on the last bump a pop of prizes
    bonk: (last) => notes(last
      ? [[220, 0, sn(0.1, 0.18)], [880, 80, sq(0.05, 0.09)], [1174.66, 140, sn(0.1, 0.15)], [1567.98, 200, sn(0.2, 0.15)]]
      : [[220, 0, sn(0.1, 0.18)], [174.61, 70, sn(0.14, 0.16)]]),
    // a cannon: a low boom and a whoosh up into the sky
    boom: () => notes([[82.41, 0, { type: "sawtooth", duration: 0.22, gain: 0.12, plain: true }],
      [261.63, 120, sn(0.06, 0.12)], [392, 170, sn(0.06, 0.12)], [587.33, 220, sn(0.06, 0.12)], [880, 270, sn(0.2, 0.12)]]),
    // …and down again: a soft thump
    land: () => notes([[196, 0, sn(0.08, 0.18)], [130.81, 60, sn(0.18, 0.16)]]),
    // a runaway darts off: a quick giggle of notes (it is a game of tag)
    giggle: () => notes([[1318.5, 0, sn(0.05, 0.11)], [1567.98, 55, sn(0.05, 0.11)], [1318.5, 110, sn(0.05, 0.11)],
      [1760, 165, sn(0.1, 0.11)]]),
    // a power-up: a bright run up
    powerup: () => notes([[523.25, 0, sq(0.05, 0.06)], [659.25, 50, sq(0.05, 0.06)], [783.99, 100, sq(0.05, 0.06)],
      [1046.5, 150, sq(0.05, 0.06)], [1318.5, 200, sn(0.3, 0.14)]]),
    // a seedling sprouting: a bloop that grows
    sprout: () => notes([[392, 0, sn(0.08, 0.14)], [523.25, 70, sn(0.08, 0.14)], [783.99, 140, sn(0.2, 0.14)]]),
    // the first time he meets a new thing: a curious "ooh"
    ooh: () => notes([[587.33, 0, sn(0.16, 0.13)], [880, 140, sn(0.3, 0.13)]]),
    // count mode: a woodblock tock that climbs with the count
    count: (k, last) => notes([[783.99 * Math.pow(2, Math.min(Math.max(0, k - 1), 12) / 12), 0, tr(0.06, 0.16)]]
      .concat(last ? [[1567.98, 120, sn(0.3, 0.12)]] : [])),
  };
  // "Two of three!" — a number as the word it is said as
  const numWord = (n) => (SAY.num[n] !== undefined ? SAY.num[n] : String(n));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // A line said at most once in `gap` seconds (Infinity: once a run) — a pop,
  // a portal or a current can happen a hundred times; the words must not.
  function sayEvery(key, gap, text, t) {
    const last = run.said[key];
    if (last !== undefined && t - last <= gap) return;
    run.said[key] = t;
    sayPlay(text);
  }
  // The line for the grow that makes him big enough for the finale, naming it
  // ("Wow, so big! Now eat the castle!") — a picture is never spoken.
  // While the finale is still shut away behind a gate the goal is its KEY
  // (§15.1), so the line says so — it must never send him at a locked gate.
  function readyLine(def, st) {
    const g = st && L.goalOf(st);
    const line = g && g.press ? SAY.readyButton : g && g.key ? SAY.readyKey : SAY.ready;
    return line.replace("{finale}", (def.finale && def.finale.say) || "the biggest thing");
  }

  // A locked gate asks for what it wants next: a button if that is what is
  // left, its key otherwise (it must never ask for a key it does not have).
  function lockedLine(st, id) {
    const o = st.objects[id], next = o && o.lock ? L.nextOpener(st, o.lock) : null;
    return next && next.press ? SAY.lockedButton : SAY.locked;
  }

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
      noteI: 0, said: {}, combo: 0, tasted: {}, lastSaid: -1e9,
      ate: st.objects.filter((o) => o.st === L.GONE).map((o) => o.e),
      // treasures he has found (a resumed run found the ones already gone)
      found: new Set(st.gold.filter((id) => st.objects[id].st === L.GONE)),
    };
    // a fresh place opens with a look at the whole island and then flies in
    // to Gobble (skipped under reduced motion); a resumed one starts on him
    render.setState(st, { intro: !resumed });
    save.last = def.id;
    save.seen[def.id] = true;
    persist();
    meterKey = "";
    paintMeter();
    if (!resumed) { later(() => playTune(def), 120); later(() => sayPlay(SAY.start), 400); }
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
    saveRun();
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
      const shown = render.event(ev);
      if (ev.type === "eat") {
        gulp(ev);
        // a run of gulps sparkles at five in a row (at ten comes the super
        // slurp, with its own sound)
        if (!ev.vortex && ev.combo === 5 && run.combo !== 5) SFX.combo();
        run.combo = ev.combo || 0;
        run.ate.push(ev.e);
        if (ev.gold && !ev.vortex) {
          run.found.add(ev.id); SFX.treasure(); sayPlay(SAY.treasure);
          // the best ever, kept for the door (written with this frame's save)
          if (run.found.size > (save.gold[run.def.id] || 0)) { save.gold[run.def.id] = run.found.size; run.dirty = true; }
        }
        // the FIRST taste of a family is said once a run — and only when
        // nothing has been said for a moment (a word never talks over another)
        const fam = !ev.vortex && !ev.finale && DATA.tasteOf(ev.e);
        if (fam && !run.tasted[fam] && now() - run.lastSaid > TASTE_QUIET_MS) {
          run.tasted[fam] = true;
          sayPlay(SAY.taste[fam]);
        }
        if (!st.won) run.dirty = true;
      } else if (ev.type === "grow") {
        bounceMeter();
        // the grow that makes him big enough for the finale names it: from
        // here on it is the goal (the edge arrow and a golden beacon show it)
        if (ev.ready) { SFX.ready(); sayPlay(readyLine(run.def, run.st)); }
        else { SFX.grow(); sayPlay(SAY.grow[(ev.level - 1) % SAY.grow.length]); }
      } else if (ev.type === "bump") {
        // a locked gate rattles and asks for what it wants (its key, or its
        // button); a bumper boings; a wall of things too big thuds; anything
        // else too big is the old "too big" bump
        if (ev.bounce) SFX.boing(); else if (ev.locked) SFX.locked(); else if (ev.solid) SFX.wall(); else SFX.bump();
        if (t - run.bigSaid > BIG_SAY_GAP) { run.bigSaid = t; sayPlay(ev.bounce ? SAY.boing : ev.locked ? lockedLine(st, ev.id) : SAY.big); }
      } else if (ev.type === "opener") {
        // one more key or button for a gate that wants several: a click and
        // how far it has got ("Two of three!"); the last one is the unlock's
        if (ev.how === "press") SFX.clunk();
        SFX.clink(ev.n);
        run.lastOpener = ev.how;
        if (ev.n < ev.of) sayPlay(cap(SAY.opener.replace("{n}", numWord(ev.n)).replace("{of}", numWord(ev.of))));
      } else if (ev.type === "unlock") {
        SFX.unlock(); sayPlay(run.lastOpener === "press" ? SAY.unlockPress : SAY.unlock);
        run.lastOpener = null;
      } else if (ev.type === "hit") {
        // a piñata: every bump counts out loud, and the last one bursts
        SFX.bonk(ev.last);
        sayPlay(ev.last ? SAY.hitLast : SAY.hit[Math.min(ev.n, SAY.hit.length) - 1]);
      } else if (ev.type === "launch") {
        SFX.boom(); sayEvery("launch", 12, SAY.launch, t);
      } else if (ev.type === "land") {
        SFX.land();
      } else if (ev.type === "flee") {
        SFX.giggle(); sayEvery("flee", 10, SAY.flee, t);
      } else if (ev.type === "power") {
        SFX.powerup(); sayPlay(SAY.power[ev.kind] || SAY.slurp);
      } else if (ev.type === "sprout") {
        SFX.sprout(); sayEvery("sprout", 10, SAY.sprout, t);
      } else if (ev.type === "count") {
        // count mode: every one of the counted things says the next number.
        // The tally on screen shows every number; the VOICE says one when the
        // last line has had time to finish (a slurp can gulp three at once,
        // and a queue of numbers would fall behind), and always says the last.
        SFX.count(ev.k, ev.last);
        const what = (run.def.count && run.def.count.say) || "things";
        if (ev.last) sayPlay(SAY.countLast.replace("{n}", String(ev.n)).replace("{what}", what));
        else if (now() - run.lastSaid > COUNT_GAP_MS) sayPlay(String(ev.n));
      } else if (ev.type === "meet") {
        // the first time he comes near a new thing: what it is, once a run
        SFX.ooh();
        const line = SAY.meet[ev.kind];
        if (line) sayPlay(line.replace("{n}", numWord(ev.n)).replace("{what}", (run.def.count && run.def.count.say) || "things"));
      } else if (ev.type === "pop") {
        SFX.pop(); sayEvery("pop", 8, SAY.pop, t);
      } else if (ev.type === "shake") {
        SFX.shake();
      } else if (ev.type === "warp") {
        SFX.warp(); sayEvery("warp", Infinity, SAY.warp, t);
      } else if (ev.type === "flow") {
        SFX.flow(); sayEvery("flow", Infinity, SAY.flow, t);
      } else if (ev.type === "ice") {
        SFX.ice(); sayEvery("ice", Infinity, SAY.ice, t);
      } else if (ev.type === "slurp") {
        // ten in a row (§15.6): a few seconds of super pull. Said now and
        // then, not every time: a sweep through a big clump earns several.
        SFX.slurp(); sayEvery("slurp", SLURP_SAY_GAP, SAY.slurp, t);
      } else if (ev.type === "win") {
        // The win is EARNED the moment the finale goes down, so the ⭐ is
        // recorded now — leaving during the slurp can never lose it.
        save.done[run.def.id] = true;
        delete save.runs[run.def.id];
        persist();
        later(() => { SFX.burp(); sayPlay(SAY.win); }, 450);
        // a pop for each firework, the moment it bursts (the renderer owns the
        // timing; none under reduced motion, when it draws none)
        for (const at of (shown && shown.fireworks) || []) later(() => { if (playVisible()) SFX.firework(); }, at * 1000);
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

  // A run is saved at the end of the frame in which he ate — once a FRAME,
  // never once a gulp: the whole save is re-serialised on each write, and a
  // super slurp is up to six gulps in one 1/60s step (measured before this:
  // 29 writes a second, six in a single frame). The win and leaving the
  // screen still write at once.
  function saveRun() {
    if (!run || !run.dirty) return;
    run.dirty = false;
    if (!run.st.won) { save.runs[run.def.id] = L.snapshot(run.st); persist(); }
  }
  function leavePlay() {
    if (run) run.dirty = false;
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
        land.hidden = true;
        doc.body.classList.add("hole-mode");
        doc.body.classList.remove("in-game");
        paintDoors();
        home.hidden = false;
        home.__shownAt = now();
        global.scrollTo(0, 0);
        later(() => { if (!home.hidden) sayNow(SAY.pickLand); }, 300);
        return true;
      }
      const lm = /^hole-land-([a-z0-9]+)$/.exec(id);
      if (lm) {
        const ld = LANDS.find((x) => x.id === lm[1]);
        if (!ld) return false;
        if (!play.hidden) leavePlay();
        play.hidden = true;
        home.hidden = true;
        doc.body.classList.add("hole-mode");
        doc.body.classList.remove("in-game");
        landNow = ld;
        land.querySelector(".hole-landtitle").textContent = ld.name;
        for (const b of land.querySelectorAll(".hole-door")) b.hidden = b.dataset.land !== ld.id;
        paintDoors();
        land.hidden = false;
        land.__shownAt = now();
        global.scrollTo(0, 0);
        // back from a place: its door is on screen (a phone shows 9 of 12)
        const last = land.querySelector('.hole-door[data-scene="' + save.last + '"]');
        if (last && !last.hidden && last.scrollIntoView) last.scrollIntoView({ block: "nearest" });
        later(() => { if (!land.hidden) sayNow(SAY.pick); }, 300);
        return true;
      }
      if (id === "hole-play") {
        home.hidden = true;
        land.hidden = true;
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
    // The place he is PLAYING — null while the play screen is hidden. The run
    // he left stays parked (▶ and a deep link carry it on), and a door starts
    // its place on the NEXT task (the router runs on hashchange), so a test
    // that waited for scene() === id after a door click passed on the PARKED
    // run before the door had done anything — and once played that parked run
    // to a win the screen never showed. The play screen turns visible in the
    // same task that starts the new run, so this cannot be fooled.
    scene: () => (run && play && !play.hidden ? run.def.id : null),
    save: () => JSON.parse(JSON.stringify(save)),
    reset(opts) {
      resetProgress();
      if (opts && opts.demoSeen) { save.demo = true; persist(); }
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
        if (until === "slurp" && st.slurpT > 0) break;
        if (until && typeof until === "object" && until.level != null && st.hole.level >= until.level) break;
        if (bot && !st.won) { const tg = L.botTarget(st); if (tg) L.setTarget(st, tg.x, tg.y); }
        L.step(st, L.DT);
        drain(lastT || 0);
      }
      saveRun();
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
