// ✨ New Worlds (PLAN_TOWN.md) — the hub of small worlds on trial, and the ONE
// shell every one of them plays in.
//
// A world registers itself (Town.register) with its levels and a play(api,
// level) that builds the level into api.stage. The shell owns everything a
// world must never re-invent: the hub and each world's home of level doors,
// the play screen and its bar, the ⭐ save (josh-town-v1), the spoken prompt
// and 👂, the hint ring, the hammer's echo, the party at the end of a level,
// and timers that die with the screen. Routes: #town-home (the hub),
// #town-<world> (its levels) and #town-play (a level). main.js delegates every
// town-* hash here (try/catch-isolated like the other worlds); never
// registered in JoshFramework, so his Sticker Book is unchanged.
//
// THE TEST CONTRACT (the framework's, so one harness plays every level of
// every world): the next thing to tap carries data-correct (api.next sets it,
// and it is the ONE writer); the screen's data-done is "1" once the level is
// finished. Kid laws, all on: no failure (a wrong tap wiggles and says what to
// do), no timer, big taps, sound off by default and playable muted (the
// prompt strip and the hint ring carry the play). A control a world marks
// data-free (a track tile that turns, a square of a song) is a MOVE in any
// order, never a wrong tap: data-correct only marks the suggested one.

(function (global) {
  "use strict";
  const doc = global.document;
  if (!doc) return;
  const $ = (id) => doc.getElementById(id);
  const A = () => global.JoshAudio;
  const now = () => (global.performance && global.performance.now ? global.performance.now() : Date.now());
  const reduce = () => { try { return global.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

  const KEY = "josh-town-v1";
  const ECHO_MS = 350;
  const HINT_MS = 7000;
  const WORLDS = [];

  const worldOf = (id) => WORLDS.find((w) => w.id === id) || null;
  const levelOf = (w, id) => (w && w.levels.find((l) => l.id === id)) || null;
  const keyOf = (w, l) => w.id + "/" + l.id;

  // ---- The save ---------------------------------------------------------------
  // stars["dig/fill"] = how many times that level was finished. Nothing else is
  // kept: a level is a minute or two, so leaving one starts it over.
  function freshSave() { return { v: 1, stars: {}, gen: 0 }; }
  const nat = (n) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
  function genOf(g) { return typeof g === "number" && Number.isFinite(g) && g > 0 && g <= Date.now() + 864e5 ? Math.floor(g) : 0; }
  function coerce(text) {
    const s = freshSave();
    let raw = null;
    try { raw = JSON.parse(text); } catch (e) { raw = null; }
    if (!raw || typeof raw !== "object") return s;
    if (raw.stars && typeof raw.stars === "object") {
      for (const k of Object.keys(raw.stars)) {
        const [w, l] = k.split("/");
        if (levelOf(worldOf(w), l) && nat(raw.stars[k]) > 0) s.stars[k] = nat(raw.stars[k]);
      }
    }
    s.gen = genOf(raw.gen);
    return s;
  }
  function readStored() { try { return global.localStorage.getItem(KEY); } catch (e) { return null; } }
  let save = null; // read once every world has registered
  const S = () => save || (save = coerce(readStored()));
  // Two tabs: ⭐ only grow, so a write folds in the other tab's — unless a
  // grown-up reset the worlds there since (a newer gen): then this tab takes
  // the reset, keeping only the levels it finished since its last write.
  const own = new Set();
  function syncSave() {
    const disk = coerce(readStored());
    if (disk.gen > S().gen) {
      for (const k of own) if (save.stars[k]) disk.stars[k] = save.stars[k];
      save = disk;
      return true;
    }
    return false;
  }
  function persist() {
    const disk = coerce(readStored());
    if (disk.gen > S().gen) syncSave();
    else for (const k of Object.keys(disk.stars)) save.stars[k] = Math.max(save.stars[k] || 0, disk.stars[k]);
    own.clear();
    try { global.localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* private mode: play on */ }
  }
  // Grown-ups only (the ⚙️ on the hub, through the ONE gate, JoshGate): every
  // ⭐ in every new world goes. The ONE wipe: the button and the hook call it.
  function resetProgress() {
    const disk = coerce(readStored());
    const had = Object.keys(S().stars).length || Object.keys(disk.stars).length;
    save = freshSave();
    save.gen = Math.max(Date.now(), disk.gen + 1, S().gen + 1);
    own.clear();
    try { global.localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
    return had;
  }
  const starsOf = (w, l) => S().stars[keyOf(w, l)] || 0;

  // ---- Timers that die with the screen ----------------------------------------
  const timers = new Set();
  function later(fn, ms) {
    const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
    timers.add(t);
    return t;
  }
  function clearLater() { for (const t of timers) clearTimeout(t); timers.clear(); }

  // ---- Screens -----------------------------------------------------------------
  let hub = null, play = null, built = false;
  const homes = {}; // world id -> its screen
  let spoken = "";  // what 👂 says again on the screen that is up
  const visible = (el) => !!(el && !el.hidden);
  function sayLive(text, opts) {
    const a = A();
    if (!a || !text) return;
    if (!visible(hub) && !visible(play) && !Object.values(homes).some(visible)) return;
    a.say(text, opts);
  }
  function bar(back, backLabel, title) {
    return '<div class="game__bar town-bar">' +
      '<button class="btn-round game__home town-back" type="button" aria-label="' + backLabel + '">' + back + "</button>" +
      '<h1 class="game__title town-title">' + title + "</h1>" +
      '<button class="btn-round game__hear town-hear" type="button" aria-label="Hear it again">👂</button>' +
      "</div>";
  }
  function screen(id, cls, html) {
    const s = doc.createElement("section");
    s.id = id;
    s.className = "screen town-screen " + cls;
    s.hidden = true;
    s.innerHTML = html;
    $("screens").appendChild(s);
    s.querySelector(".town-hear").addEventListener("click", () => sayLive(spoken));
    return s;
  }
  function build() {
    if (built || !$("screens")) return;
    built = true;
    hub = screen("screen-town-home", "town-hub",
      bar("🚪", "Back to the front door", "New Worlds") +
      '<div class="town-doors" role="list"></div>' +
      '<button class="reset-stars town-reset" type="button" data-adult="1" aria-label="Grown-ups: start the new worlds over">⚙️ Grown-ups</button>');
    hub.querySelector(".town-back").addEventListener("click", () => { location.hash = ""; });
    hub.querySelector(".town-reset").addEventListener("click", () => {
      if (!global.JoshGate) return;
      global.JoshGate.ask({
        label: "Grown-ups: start the new worlds over",
        msg: "This clears every ⭐ in the new worlds.<br>Type <b>reset</b> to confirm.",
        confirm: () => { resetProgress(); paintHub(); return "The new worlds are fresh again."; },
      });
    });
    for (const w of WORLDS) {
      const h = screen("screen-town-" + w.id, "town-world town-world--" + w.id,
        bar("🏠", "Back to the new worlds", w.name) + '<div class="town-levels" role="list"></div>');
      h.querySelector(".town-back").addEventListener("click", () => { location.hash = "#town-home"; });
      homes[w.id] = h;
    }
    play = screen("screen-town-play", "game town-play",
      bar("🏠", "Back to the levels", "") +
      '<div class="town-prompt" aria-live="polite"></div>' +
      '<div class="town-stage"></div>' +
      '<div class="town-party" hidden>' +
        '<span class="town-party__star" aria-hidden="true">⭐</span>' +
        '<button class="btn-big town-again" type="button" aria-label="Play it again">🔁</button>' +
        '<button class="btn-big town-next" type="button" aria-label="Next">▶</button>' +
      "</div>");
    play.querySelector(".town-back").addEventListener("click", () => { const w = cur ? cur.w : lastWorld; location.hash = "#town-" + (w ? w.id : "home"); });
    play.querySelector(".town-again").addEventListener("click", () => { if (cur) start(cur.w, cur.l); });
    play.querySelector(".town-next").addEventListener("click", () => {
      if (!cur) return;
      const i = cur.w.levels.indexOf(cur.l);
      if (i + 1 < cur.w.levels.length) start(cur.w, cur.w.levels[i + 1]);
      else location.hash = "#town-" + cur.w.id;
    });
  }
  function door(cls, icon, name, aria, sub) {
    const b = doc.createElement("button");
    b.type = "button";
    b.className = cls + " tap";
    b.setAttribute("role", "listitem");
    b.setAttribute("aria-label", aria);
    b.innerHTML = '<span class="town-door__pic" aria-hidden="true">' + icon + "</span>" +
      '<span class="town-door__name">' + name + "</span>" +
      (sub ? '<span class="town-door__sub" aria-hidden="true">' + sub + "</span>" : "");
    return b;
  }
  function paintHub() {
    const g = hub.querySelector(".town-doors");
    g.innerHTML = "";
    for (const w of WORLDS) {
      const done = w.levels.filter((l) => starsOf(w, l) > 0).length;
      const b = door("town-door town-door--world", w.icon, w.name, w.name + ", " + done + " of " + w.levels.length + " done", "⭐ " + done + " / " + w.levels.length);
      b.style.setProperty("--town-color", w.color || "#fff3c4");
      b.dataset.world = w.id;
      b.addEventListener("click", () => { location.hash = "#town-" + w.id; });
      g.appendChild(b);
    }
  }
  function paintWorld(w) {
    const g = homes[w.id].querySelector(".town-levels");
    g.innerHTML = "";
    const next = w.levels.find((l) => !starsOf(w, l));
    w.levels.forEach((l, i) => {
      const n = starsOf(w, l);
      const pic = n && l.doneIcon ? l.doneIcon : l.icon;
      const b = door("town-door town-door--level" + (n ? " town-door--done" : "") + (l === next ? " town-door--next" : ""),
        pic, l.name, l.name + (n ? ", done" : ""), (i + 1) + (n ? " ⭐" : ""));
      b.style.setProperty("--town-color", w.color || "#fff3c4");
      b.dataset.level = l.id;
      b.addEventListener("click", () => { pending = { w, l }; location.hash = "#town-play"; });
      g.appendChild(b);
    });
  }

  // ---- A level ---------------------------------------------------------------------
  let cur = null;     // { w, l, run }
  let pending = null; // the level a door asked for
  let lastWorld = null;
  let run = 0;        // which start() a timer belongs to
  let closed = false; // the level is finished: its board answers nothing
  let hintT = null;
  const stageEl = () => play.querySelector(".town-stage");
  // A small seeded rng per level start (no Math.random: a test can pin it).
  function rngFrom(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  let seedNext = null;
  function armHint() {
    if (hintT) clearTimeout(hintT);
    timers.delete(hintT);
    const st = stageEl();
    st.querySelectorAll(".town-hint").forEach((e) => e.classList.remove("town-hint"));
    hintT = later(() => {
      if (closed || !visible(play)) return;
      st.querySelectorAll("[data-correct]").forEach((e) => e.classList.add("town-hint"));
    }, HINT_MS);
  }
  function start(w, l) {
    clearLater();
    run += 1;
    closed = false;
    cur = { w, l, run };
    lastWorld = w;
    const me = run;
    play.dataset.done = "0";
    play.querySelector(".town-title").textContent = l.name;
    play.querySelector(".town-party").hidden = true;
    play.className = "screen town-screen game town-play town-play--" + w.id;
    const st = stageEl();
    st.innerHTML = "";
    const prompt = play.querySelector(".town-prompt");
    prompt.textContent = "";
    spoken = "";
    const seed = seedNext != null ? seedNext : Math.floor(Date.now() % 2147483647);
    seedNext = null;
    const api = {
      stage: st,
      rng: rngFrom(seed),
      reduce,
      live: () => me === run && visible(play),
      later(fn, ms) { return later(() => { if (me === run && visible(play)) fn(); }, ms); },
      prompt(icons, line) { prompt.textContent = icons || ""; spoken = line || ""; sayLive(spoken); },
      say: (t, o) => { if (me === run) sayLive(t, o); },
      sayZh: (t) => { if (me === run) sayLive(t, { lang: "zh-CN" }); },
      tone(freq, opts) { const a = A(); if (a && me === run && visible(play)) a.tone(freq, opts); },
      // The ONE writer of data-correct: these are what to tap next.
      next(els) {
        st.querySelectorAll("[data-correct]").forEach((e) => { delete e.dataset.correct; e.classList.remove("town-hint"); });
        for (const e of [].concat(els || [])) if (e) e.dataset.correct = "1";
        armHint();
      },
      good(el, line) {
        const a = A();
        if (a && me === run) a.goodCue();
        if (el) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
        if (line) this.say(line);
      },
      bump(el, line) {
        const a = A();
        if (a && me === run) a.bumpCue();
        if (el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
        if (line) this.say(line);
        armHint();
      },
      // Move a thing (a wrapper, never the button: .bump and .pop own the
      // button's transform) by dx/dy px; instant under reduced motion.
      move(el, dx, dy, ms) {
        el.style.transition = reduce() ? "none" : "transform " + (ms || 500) + "ms ease-in-out";
        el.style.transform = dx || dy ? "translate(" + Math.round(dx) + "px, " + Math.round(dy) + "px)" : "";
      },
      // How far a's centre is from b's, in px (to send a truck to a hole).
      gap(a, b) {
        const r = a.getBoundingClientRect(), s = b.getBoundingClientRect();
        return { dx: (s.left + s.width / 2) - (r.left + r.width / 2), dy: (s.top + s.height / 2) - (r.top + r.height / 2) };
      },
      // The level is finished: the board closes (nothing on it answers), the
      // ⭐ is recorded at once, and the party comes after a beat.
      done(cheer) {
        if (me !== run || closed) return;
        closed = true;
        st.querySelectorAll("[data-correct]").forEach((e) => { delete e.dataset.correct; e.classList.remove("town-hint"); });
        S().stars[keyOf(w, l)] = starsOf(w, l) + 1;
        own.add(keyOf(w, l));
        persist();
        play.dataset.done = "1";
        const a = A();
        if (a) a.winCue();
        try { if (global.JoshEffects && !reduce()) global.JoshEffects.confetti(); } catch (e) { /* ignore */ }
        sayLive(cheer || "You did it!");
        spoken = cheer || "You did it!";
        later(() => {
          if (me !== run) return;
          const p = play.querySelector(".town-party");
          p.hidden = false;
          const last = w.levels.indexOf(l) === w.levels.length - 1;
          play.querySelector(".town-next").textContent = last ? "🏠" : "▶";
          play.querySelector(".town-next").setAttribute("aria-label", last ? "Back to the levels" : "Next");
          try { p.scrollIntoView({ block: "nearest", behavior: reduce() ? "auto" : "smooth" }); } catch (e) { /* ignore */ }
        }, 900);
      },
    };
    try { w.play(api, l); } catch (e) { console.error("New Worlds: " + w.id + "/" + l.id + " failed:", e); }
  }

  // ---- The hammer's echo (the framework's rules, for these screens) --------------
  // A finished board answers nothing, whoever taps. A FINGER's second tap
  // inside 350ms on the same control, or on a control that was not on screen
  // when the first tap began (a door it opened, a step that just appeared), is
  // the echo of one tap he meant. Keyboard and synthetic clicks are never an
  // echo (detail 0 / untrusted): a harness or a demo is not a finger.
  let lastTap = null;
  function onScreenControls(scr) {
    const set = new Set();
    for (const b of scr.querySelectorAll("button")) if (b.getClientRects().length) set.add(b);
    return set;
  }
  doc.addEventListener("click", (e) => {
    const scr = e.target && e.target.closest ? e.target.closest(".town-screen") : null;
    if (!scr) return;
    const ctl = e.target.closest("button");
    const swallow = () => { e.stopImmediatePropagation(); e.preventDefault(); };
    if (closed && scr === play && stageEl().contains(e.target)) { swallow(); return; }
    if (!e.isTrusted || !e.detail) return;
    const t = now();
    if (lastTap && t - lastTap.t < ECHO_MS && (ctl === lastTap.el || (ctl && !lastTap.seen.has(ctl)))) {
      lastTap.t = t; // a hammer streak ends only when the hand pauses
      swallow();
      return;
    }
    lastTap = { t, el: ctl, seen: onScreenControls(doc.body) };
  }, true);

  // ---- Routing (main.js delegates every town-* hash) --------------------------------
  function show(s) {
    for (const x of [hub, play, ...Object.values(homes)]) if (x) x.hidden = x !== s;
    doc.body.classList.add("town-mode");
    s.__shownAt = now();
    global.scrollTo(0, 0);
  }
  const Town = {
    register(def) {
      if (!def || !def.id || worldOf(def.id) || built) return;
      WORLDS.push(def);
    },
    route(id) {
      build();
      if (!hub) return false;
      syncSave();
      if (id === "town-home") {
        if (visible(play)) leavePlay();
        doc.body.classList.remove("in-game");
        paintHub();
        show(hub);
        spoken = "Pick a world!";
        later(() => { if (visible(hub)) sayLive(spoken); }, 300);
        return true;
      }
      if (id === "town-play") {
        // A level is a minute or two, so a level he left starts over; a bare
        // #town-play opens the first unfinished level of the last world.
        let p = pending;
        pending = null;
        if (!p) { const w = lastWorld || WORLDS[0]; if (!w) return false; p = { w, l: w.levels.find((l) => !starsOf(w, l)) || w.levels[0] }; }
        doc.body.classList.add("in-game");
        show(play);
        start(p.w, p.l);
        return true;
      }
      const w = worldOf(id.replace(/^town-/, ""));
      if (w) {
        if (visible(play)) leavePlay();
        doc.body.classList.remove("in-game");
        paintWorld(w);
        show(homes[w.id]);
        spoken = w.say || ("Welcome to the " + w.name + "!");
        later(() => { if (visible(homes[w.id])) sayLive(spoken); }, 300);
        return true;
      }
      return false;
    },
    onLeave() {
      if (visible(play)) leavePlay();
      clearLater();
      for (const x of [hub, play, ...Object.values(homes)]) if (x) x.hidden = true;
      if (doc.body) doc.body.classList.remove("town-mode");
    },
  };
  function leavePlay() { clearLater(); if (cur) lastWorld = cur.w; cur = null; }
  global.Town = Town;
  global.addEventListener("storage", (e) => {
    if (e.key !== KEY || !syncSave()) return;
    if (visible(hub)) paintHub();
    for (const w of WORLDS) if (visible(homes[w.id])) paintWorld(w);
  });

  // The front door's ✨ wears the worlds inside it.
  doc.addEventListener("DOMContentLoaded", () => {
    try {
      const mark = doc.querySelector("#start-town .start-tile__art");
      if (mark && WORLDS.length) {
        mark.innerHTML = '<span class="town-mark">' + WORLDS.slice(0, 4).map((w) => "<span>" + w.icon + "</span>").join("") + "</span>";
        mark.classList.add("town-mark--n" + Math.min(4, WORLDS.length));
      }
    } catch (e) { /* the ✨ stays */ }
  });

  // ---- Test hooks (the __COLOR / __SEEK precedent) ----------------------------------
  global.__TOWN = {
    worlds: () => WORLDS.map((w) => ({ id: w.id, levels: w.levels.map((l) => l.id) })),
    start(wid, lid, opts) {
      const w = worldOf(wid), l = levelOf(w, lid);
      if (!w || !l) return false;
      if (opts && opts.seed != null) seedNext = opts.seed;
      pending = { w, l };
      if (location.hash === "#town-play") { pending = null; start(w, l); } else location.hash = "#town-play";
      return true;
    },
    state: () => (cur ? { world: cur.w.id, level: cur.l.id, done: play.dataset.done === "1", closed } : null),
    save: () => JSON.parse(JSON.stringify(S())),
    reset: () => resetProgress(),
    timers: () => timers.size,
    hintMs: HINT_MS,
  };
})(typeof window !== "undefined" ? window : globalThis);
