// 🔍 Seek & Find — the world's screens: #seek-home (a door per place) and
// #seek-play (the big picture he scrolls, the list of things to find along the
// bottom, and the party when the list is done). main.js routes every seek-*
// hash here (try/catch-isolated, like the other worlds), and the world is
// never registered in JoshFramework, so Josh's Sticker Book stays his 200+.
//
// The picture is DOM, not a canvas: a tall scene in a native scroller (the
// momentum scroll iOS gives for free), every thing an <img> of its Noto
// picture placed by percentages, so the same layout fills any width with no
// resize code. A tap is judged by GEOMETRY (SeekLogic.hitTest over the
// things' round bodies, topmost first), never by which box the browser hit —
// a picture's transparent corner must not steal a tap from what it overlaps.
//
// Kid laws, all on: no failure (a wrong tap names what he tapped — a word
// learned, never a buzz), no timer (a hint waits quietly until he has looked
// for a while, and only comes when he asks), one finger, sound off by default
// and playable muted (every find is marked on the picture AND on the list).

(function (global) {
  "use strict";
  const doc = global.document;
  const D = global.SeekData, L = global.SeekLogic, ART = global.SeekArt;
  if (!doc || !D || !L || !ART) return;
  const PLACES = D.PLACES;
  const $ = (id) => doc.getElementById(id);
  const now = () => (global.performance && global.performance.now ? global.performance.now() : Date.now());

  const KEY = "josh-seek-v1";
  // A run carries the layout version it was laid out under: change how the
  // engine places things and an old half-found picture would mark the wrong
  // things, so it is dropped (its ⭐ stay).
  const LAYOUT = 1;
  const ECHO_MS = 350;       // the second tap of a double tap
  const HINT_AFTER_MS = 20000; // a list card shows WHERE only after he has looked this long
  const TOL_PX = 22;         // a finger just beside a small picture still gets it

  // ---- The save ---------------------------------------------------------------
  // stars: places finished (and how often) · plays: pictures started (the
  // seed of the next one) · runs: a half-found picture per place · last.
  function freshSave() { return { v: 1, stars: {}, plays: {}, runs: {}, seen: {}, last: PLACES[0].id }; }
  const isPlace = (id) => PLACES.some((p) => p.id === id);
  const nat = (n) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
  function coerce(text) {
    const s = freshSave();
    let raw = null;
    try { raw = JSON.parse(text); } catch (e) { raw = null; }
    if (!raw || typeof raw !== "object") return s;
    for (const k of ["stars", "plays"]) {
      if (raw[k] && typeof raw[k] === "object") for (const id of Object.keys(raw[k])) if (isPlace(id)) s[k][id] = nat(raw[k][id]);
    }
    if (raw.runs && typeof raw.runs === "object") {
      for (const id of Object.keys(raw.runs)) {
        const r = raw.runs[id];
        if (!isPlace(id) || !r || typeof r !== "object" || r.v !== LAYOUT) continue;
        if (!Array.isArray(r.found)) continue;
        s.runs[id] = { v: LAYOUT, seed: nat(r.seed), level: Math.min(D.LEVELS.length - 1, nat(r.level)), found: r.found.filter((n) => Number.isInteger(n) && n >= 0) };
      }
    }
    // seen: every kind he has found, ever (the album) — a kind this build
    // does not know is dropped, never shown as a blank sticker
    if (raw.seen && typeof raw.seen === "object") for (const k of Object.keys(raw.seen)) if (D.KINDS[k] && !D.KINDS[k].prop) s.seen[k] = nat(raw.seen[k]);
    if (isPlace(raw.last)) s.last = raw.last;
    return s;
  }
  function readStored() { try { return global.localStorage.getItem(KEY); } catch (e) { return null; } }
  let save = coerce(readStored());
  // Two tabs: stars and plays only grow, so a write folds in what the other
  // tab stored; a half-found picture belongs to the tab that is playing it.
  function persist() {
    const disk = coerce(readStored());
    for (const k of ["stars", "plays", "seen"]) for (const id of Object.keys(disk[k])) save[k][id] = Math.max(save[k][id] || 0, disk[k][id]);
    try { global.localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* private mode: play on */ }
  }

  // ---- Pictures ------------------------------------------------------------------
  const URL_CACHE = {};
  function picUrl(name) {
    if (!URL_CACHE[name]) URL_CACHE[name] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(ART[name] || "");
    return URL_CACHE[name];
  }
  function img(name, cls) {
    const i = doc.createElement("img");
    i.className = cls || "";
    i.src = picUrl(name);
    i.alt = "";
    i.draggable = false;
    return i;
  }
  function buddyArt() {
    try { return global.JoshBuddy ? global.JoshBuddy.art() : ""; } catch (e) { return ""; }
  }
  function buddyName() {
    try { const b = global.JoshBuddy && global.JoshBuddy.current(); return (b && b.label) || "your buddy"; } catch (e) { return "your buddy"; }
  }

  // ---- Sound: through JoshAudio only, and only while the picture is up ---------
  function audioOK() { const a = global.JoshAudio; return !!a && !a.isMuted(); }
  function say(text) { if (audioOK() && text) global.JoshAudio.say(text); }
  function cue(name) { const a = global.JoshAudio; if (a && a[name] && playVisible()) a[name](); }
  function tone(f, o) { if (audioOK() && playVisible()) global.JoshAudio.tone(f, o); }

  const timers = new Set();
  function later(fn, ms) {
    const id = global.setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  }
  // Clearing the timers also clears what they were going to take away: a find
  // still flying to its card when he leaves must not hang over the next screen.
  function clearLater() {
    for (const id of timers) global.clearTimeout(id);
    timers.clear();
    for (const f of doc.querySelectorAll(".seek-fly")) f.parentNode.removeChild(f);
  }

  // ---- Screens -------------------------------------------------------------------
  let home = null, album = null, play = null, view = null, scene = null, tray = null, win = null, titleEl = null;
  let run = null, pending = null, surpriseN = 0;

  function build() {
    const screens = $("screens");
    if (!screens || $("screen-seek-home")) return;

    home = doc.createElement("section");
    home.id = "screen-seek-home";
    home.className = "screen seek-screen seek-home";
    home.hidden = true;
    home.innerHTML =
      '<div class="game__bar seek-bar">' +
        '<button class="btn-round game__home seek-exit" type="button" aria-label="Back to the front door">🚪</button>' +
        '<h1 class="game__title seek-title">Seek &amp; Find</h1>' +
        '<button class="btn-round game__hear seek-homehear" type="button" aria-label="Hear it again">👂</button>' +
      "</div>" +
      '<div class="seek-extras">' +
        '<button class="seek-extra seek-surprise tap" type="button" aria-label="Surprise! A place picked for you"><span class="seek-extra__pic" aria-hidden="true">🎲</span><span class="seek-extra__label">Surprise!</span></button>' +
        '<button class="seek-extra seek-albumbtn tap" type="button"><span class="seek-extra__pic" aria-hidden="true">📒</span><span class="seek-extra__label">My Finds <span class="seek-albumcount"></span></span></button>' +
      "</div>" +
      '<div class="seek-doors" role="list" aria-label="Pick a place"></div>';
    screens.appendChild(home);
    home.querySelector(".seek-surprise").addEventListener("click", () => openPlace(surprisePlace()));
    home.querySelector(".seek-albumbtn").addEventListener("click", () => { location.hash = "#seek-album"; });
    home.querySelector(".seek-exit").addEventListener("click", () => { location.hash = ""; });
    home.querySelector(".seek-homehear").addEventListener("click", () => say(D.SAY.pick));
    const doors = home.querySelector(".seek-doors");
    for (const p of PLACES) {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "seek-door tap";
      b.dataset.place = p.id;
      b.setAttribute("role", "listitem");
      b.appendChild(img(D.KINDS[p.door].art, "seek-door__pic"));
      const lab = doc.createElement("span");
      lab.className = "seek-door__label";
      lab.textContent = p.name;
      b.appendChild(lab);
      const st = doc.createElement("span");
      st.className = "seek-door__stars";
      st.setAttribute("aria-hidden", "true");
      b.appendChild(st);
      b.addEventListener("click", () => openPlace(p.id));
      doors.appendChild(b);
    }
    guardEcho(home);

    play = doc.createElement("section");
    play.id = "screen-seek-play";
    play.className = "screen seek-screen seek-play";
    play.hidden = true;
    play.innerHTML =
      '<div class="game__bar seek-bar">' +
        '<button class="btn-round game__home seek-back" type="button" aria-label="Back to the places">🏠</button>' +
        '<h1 class="game__title seek-placename"></h1>' +
        '<button class="btn-round game__hear seek-hear" type="button" aria-label="Hear what to find">👂</button>' +
      "</div>" +
      '<div class="seek-field">' +
        '<div class="seek-view">' +
          '<div class="seek-scene" role="img" aria-label="A busy picture. Find the things on the list."></div>' +
        "</div>" +
        '<div class="seek-win" role="dialog" aria-label="You found everything!" hidden>' +
          '<div class="seek-win__box">' +
            '<div class="seek-win__cheer" aria-hidden="true"><span class="seek-win__buddy art-fill"></span><span class="seek-win__star">⭐</span></div>' +
            '<p class="seek-win__line">You found everything!</p>' +
            '<div class="seek-win__row">' +
              '<button class="btn-big seek-again" type="button" aria-label="A new picture of this place">🔁</button>' +
              '<button class="btn-big seek-next" type="button" aria-label="Next place">▶</button>' +
            "</div>" +
            '<div class="seek-win__found" aria-hidden="true"></div>' +
          "</div>" +
        "</div>" +
      "</div>" +
      '<div class="seek-tray" role="list" aria-label="Things to find"></div>';
    screens.appendChild(play);
    view = play.querySelector(".seek-view");
    scene = play.querySelector(".seek-scene");
    tray = play.querySelector(".seek-tray");
    win = play.querySelector(".seek-win");
    titleEl = play.querySelector(".seek-placename");
    play.querySelector(".seek-back").addEventListener("click", () => { location.hash = "#seek-home"; });
    play.querySelector(".seek-hear").addEventListener("click", () => { if (run) say(listLine()); });
    win.querySelector(".seek-again").addEventListener("click", () => { if (run) startPlace(run.place.id, { fresh: true }); });
    win.querySelector(".seek-next").addEventListener("click", () => { if (run) startPlace(nextPlace(run.place.id), { resume: true }); });
    scene.addEventListener("click", onSceneTap);
    guardEcho(play);
    play.__onHide = () => { leavePlay(); };

    // 📒 My Finds: a sticker for every thing a place can ask for — a faint
    // ghost until he has found one, anywhere. Collecting them all is the
    // long game that brings him back to every place.
    album = doc.createElement("section");
    album.id = "screen-seek-album";
    album.className = "screen seek-screen seek-album";
    album.hidden = true;
    album.innerHTML =
      '<div class="game__bar seek-bar">' +
        '<button class="btn-round game__home seek-albumback" type="button" aria-label="Back to the places">🏠</button>' +
        '<h1 class="game__title seek-albumtitle">My Finds</h1>' +
        '<button class="btn-round game__hear seek-albumhear" type="button" aria-label="Hear it again">👂</button>' +
      "</div>" +
      '<div class="seek-albumbody"></div>';
    screens.appendChild(album);
    album.querySelector(".seek-albumback").addEventListener("click", () => { location.hash = "#seek-home"; });
    album.querySelector(".seek-albumhear").addEventListener("click", () => say(albumLine()));
    guardEcho(album);
  }

  // Every kind a place's list can ask for, in the place's order (the album).
  function albumKinds(place) { return Object.keys(place.finds); }
  function allAlbumKinds() {
    const s = new Set();
    for (const p of PLACES) for (const k of albumKinds(p)) s.add(k);
    return [...s];
  }
  function albumCount() {
    const all = allAlbumKinds();
    return { got: all.filter((k) => save.seen[k] > 0).length, total: all.length };
  }
  function albumLine() {
    const c = albumCount();
    return c.got ? D.SAY.album(c.got, c.total) : D.SAY.albumEmpty;
  }
  function albumArt(kind) {
    const k = D.KINDS[kind];
    return k.tone ? k.art + "-medium-skin-tone" : k.art;
  }
  function paintAlbum() {
    const body = album.querySelector(".seek-albumbody");
    body.textContent = "";
    const c = albumCount();
    album.querySelector(".seek-albumtitle").textContent = "My Finds " + c.got + "/" + c.total;
    for (const p of PLACES) {
      const sec = doc.createElement("section");
      sec.className = "seek-albumsec";
      const h = doc.createElement("h2");
      h.className = "seek-albumsec__head";
      h.appendChild(img(D.KINDS[p.door].art, "seek-albumsec__pic"));
      const t = doc.createElement("span");
      t.textContent = p.name;
      h.appendChild(t);
      sec.appendChild(h);
      const grid = doc.createElement("div");
      grid.className = "seek-albumgrid";
      for (const kind of albumKinds(p)) {
        const got = save.seen[kind] > 0;
        const b = doc.createElement("button");
        b.type = "button";
        b.className = "seek-sticker tap" + (got ? " seek-sticker--got" : "");
        b.dataset.kind = kind;
        b.dataset.place = p.id;
        b.appendChild(img(albumArt(kind), "seek-sticker__pic"));
        b.setAttribute("aria-label", got ? D.KINDS[kind].say : "Not found yet. Look in " + p.name);
        b.addEventListener("click", () => {
          if (save.seen[kind] > 0) { bounce(b, "seek-sticker--pop"); say(D.SAY.sticker(D.KINDS[kind].say)); }
          else say(D.SAY.ghost(p.name));
        });
        grid.appendChild(b);
      }
      sec.appendChild(grid);
      body.appendChild(sec);
    }
  }

  // 🎲 Surprise: a place he has not finished yet if there is one, else any.
  function surprisePlace() {
    const open = PLACES.filter((p) => !save.stars[p.id]);
    const pool = open.length ? open : PLACES;
    surpriseN += 1;
    const i = Math.floor(now() * 7919 + surpriseN * 104729) % pool.length;
    return pool[i].id;
  }

  // The echo of a double tap: a door, ▶ or 🔁 opens the picture under the
  // finger, and the second tap of a double tap must not land on it unaimed.
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

  function playVisible() { return !!play && !play.hidden && !doc.hidden; }

  // ▶ after a win: the next place without a ⭐, else simply the next one.
  function nextPlace(id) {
    const i = PLACES.findIndex((p) => p.id === id);
    for (let k = 1; k <= PLACES.length; k++) {
      const p = PLACES[(i + k) % PLACES.length];
      if (!save.stars[p.id]) return p.id;
    }
    return PLACES[(i + 1) % PLACES.length].id;
  }

  function paintDoors() {
    const c = albumCount();
    home.querySelector(".seek-albumcount").textContent = c.got + "/" + c.total;
    home.querySelector(".seek-albumbtn").setAttribute("aria-label", "My Finds: " + c.got + " of " + c.total + " found");
    for (const b of home.querySelectorAll(".seek-door")) {
      const n = save.stars[b.dataset.place] || 0;
      const p = L.placeOf(b.dataset.place);
      b.querySelector(".seek-door__stars").textContent = n ? "⭐ " + n : "";
      b.setAttribute("aria-label", p.name + (n ? ", found " + n + (n === 1 ? " time" : " times") : ""));
      b.classList.toggle("seek-door--done", n > 0);
    }
  }

  // ---- A picture -------------------------------------------------------------------
  function openPlace(id) { pending = { id, resume: true }; location.hash = "#seek-play"; }

  function nameOf(entry) {
    if (entry.kind === "buddy") return buddyName();
    const k = D.KINDS[entry.kind];
    return entry.n > 1 ? entry.n + " " + k.many : "the " + k.say;
  }
  function listLine() {
    const names = run.list.filter((e) => !e.done).map(nameOf);
    if (!names.length) return D.SAY.win;
    const joined = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0];
    return D.SAY.find(joined);
  }

  function startPlace(id, opts) {
    const place = L.placeOf(id) || PLACES[0];
    clearLater();
    hideWin();
    const level = Math.min(D.LEVELS.length - 1, save.stars[place.id] || 0);
    const parked = opts && opts.resume ? save.runs[place.id] : null;
    let seed, found = [];
    if (parked && parked.v === LAYOUT && parked.level === level) {
      seed = parked.seed;
      found = parked.found;
    } else {
      save.plays[place.id] = (save.plays[place.id] || 0) + 1;
      seed = (L.hash(place.id) + save.plays[place.id] * 7919) >>> 0;
    }
    const lay = L.layout(place.id, { seed, level });
    run = {
      place, level, seed, items: lay.items, H: lay.H,
      list: lay.list.map((e) => ({ kind: e.kind, n: e.n, art: e.art, got: 0, done: false })),
      found: new Set(), els: [], cards: [], openedAt: now(), lastFindAt: now(), lastTap: null,
      shadow: !!D.LEVELS[level].shadow,
    };
    save.last = place.id;
    titleEl.textContent = place.name;
    drawScene();
    drawTray();
    for (const i of found) if (run.items[i] && (run.items[i].role === "find" || run.items[i].role === "buddy")) mark(i, true);
    saveRun();
    view.scrollTop = 0;
    const firstShadows = run.shadow && !found.length;
    if (!run.list.every((e) => e.done)) later(() => { if (playVisible()) { if (firstShadows) say(D.SAY.shadows); say(listLine()); } }, 400);
    else showWin(true);
  }

  function drawScene() {
    scene.textContent = "";
    scene.style.paddingBottom = (run.H / D.W) * 100 + "%";
    scene.classList.toggle("seek-scene--dark", !!run.place.dark);
    const g = doc.createElement("div");
    g.className = "seek-ground";
    g.innerHTML = L.groundSvg(run.place.id, run.seed);
    scene.appendChild(g);
    const pct = (v, of) => (v / of) * 100 + "%";
    run.items.forEach((it, i) => {
      const el = doc.createElement("div");
      const k = D.KINDS[it.kind] || {};
      // a living picture: what flies floats, what swims sways — gently, out
      // of step with each other, and never under reduced motion (CSS)
      const live = k.sky && !k.prop ? " seek-it--float" : k.swim ? " seek-it--swim" : "";
      el.className = "seek-it" + (k.sky ? " seek-it--sky" : "") + live + (it.role === "buddy" ? " seek-it--buddy" : "");
      if (live) el.style.animationDelay = -((i * 0.37) % 3).toFixed(2) + "s";
      el.dataset.i = String(i);
      el.dataset.kind = it.kind;
      el.style.left = pct(it.x, D.W);
      el.style.top = pct(it.y, run.H);
      el.style.width = pct(it.size, D.W);
      el.style.marginLeft = pct(-it.size / 2, D.W);
      el.style.marginTop = pct(-it.size / 2, D.W);
      if (it.role === "buddy") {
        const b = doc.createElement("span");
        b.className = "seek-it__pic seek-it__buddy art-fill";
        b.innerHTML = buddyArt() || "";
        el.appendChild(b);
      } else {
        const pic = img(it.art, "seek-it__pic");
        if (it.rot || it.flip) pic.style.transform = (it.rot ? "rotate(" + it.rot + "deg)" : "") + (it.flip ? " scaleX(-1)" : "");
        el.appendChild(pic);
      }
      scene.appendChild(el);
      run.els[i] = el;
    });
  }

  function drawTray() {
    tray.textContent = "";
    tray.dataset.n = String(run.list.length);
    run.list.forEach((e, li) => {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "seek-card tap";
      b.setAttribute("role", "listitem");
      b.dataset.li = String(li);
      if (e.kind === "buddy") {
        const s = doc.createElement("span");
        s.className = "seek-card__pic seek-card__buddy art-fill";
        s.innerHTML = buddyArt() || "";
        b.appendChild(s);
      } else {
        b.appendChild(img(e.art, "seek-card__pic"));
      }
      if (e.n > 1) {
        const c = doc.createElement("span");
        c.className = "seek-card__count";
        b.appendChild(c);
      }
      const t = doc.createElement("span");
      t.className = "seek-card__tick";
      t.setAttribute("aria-hidden", "true");
      t.textContent = "✓";
      b.appendChild(t);
      b.addEventListener("click", () => onCard(li));
      tray.appendChild(b);
      run.cards[li] = b;
      paintCard(li);
    });
  }
  function paintCard(li) {
    const e = run.list[li], b = run.cards[li];
    const c = b.querySelector(".seek-card__count");
    if (c) c.textContent = e.got + "/" + e.n;
    b.classList.toggle("seek-card--done", e.done);
    // a tricky picture's list shows SHADOWS until each thing is found
    b.classList.toggle("seek-card--shadow", !!run.shadow && e.kind !== "buddy" && !e.done);
    const nm = nameOf(e);
    b.setAttribute("aria-label", (e.done ? "Found " : "Find ") + nm + (e.n > 1 ? ", " + e.got + " of " + e.n + " found" : ""));
  }

  // ---- A tap on the picture ------------------------------------------------------
  function onSceneTap(e) {
    if (!run || !win.hidden) return;
    const rect = scene.getBoundingClientRect();
    if (!rect.width) return;
    const k = D.W / rect.width;
    const x = (e.clientX - rect.left) * k, y = (e.clientY - rect.top) * k;
    const finger = e.isTrusted && e.detail !== 0;
    const t = now();
    const i = L.hitTest(run.items, x, y, TOL_PX * k);
    // the second tap of a double tap on the same thing is the echo
    if (finger && run.lastTap && t - run.lastTap.t < ECHO_MS && run.lastTap.i === i) return;
    run.lastTap = { t, i };
    if (i < 0) return;
    judge(i);
  }

  function entryFor(it) {
    if (it.role === "buddy") return run.list.findIndex((e) => e.kind === "buddy");
    if (it.role !== "find") return -1;
    return run.list.findIndex((e) => e.kind === it.kind);
  }

  function judge(i) {
    const it = run.items[i];
    const li = entryFor(it);
    if (li >= 0 && !run.found.has(i)) { mark(i, false); return; }
    if (li >= 0) {                              // found already: a happy bounce
      bounce(run.els[i], "seek-it--again");
      return;
    }
    // anything else: no fail — it names itself (a word learned) and wiggles
    bounce(run.els[i], "seek-it--wig");
    if (it.kind !== "buddy") {
      const s = D.KINDS[it.kind].say;
      const art = global.JoshLogic && global.JoshLogic.article ? global.JoshLogic.article(s) : "a";
      say(D.SAY.that(art + " " + s));
    }
  }
  function bounce(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    later(() => el.classList.remove(cls), 600);
  }

  // Mark item i found (quiet: restoring a parked picture says nothing).
  const NUM = ["", "One!", "Two!", "Three!", "Four!", "Five!", "Six!"];
  function mark(i, quiet) {
    const it = run.items[i];
    const li = entryFor(it);
    if (li < 0 || run.found.has(i)) return;
    const e = run.list[li];
    run.found.add(i);
    e.got += 1;
    e.done = e.got >= e.n;
    const el = run.els[i];
    el.classList.add("seek-it--found");
    if (e.n > 1) {
      const badge = doc.createElement("span");
      badge.className = "seek-it__num";
      badge.textContent = String(e.got);
      el.appendChild(badge);
    }
    paintCard(li);
    run.lastFindAt = now();
    if (it.role !== "buddy") save.seen[it.kind] = Math.max(1, (save.seen[it.kind] || 0) + (quiet ? 0 : 1));
    if (!quiet) {
      bounce(el, it.role === "buddy" ? "seek-it--peekaboo" : "seek-it--pop");
      flyToCard(el, run.cards[li]);
      bounce(run.cards[li], "seek-card--pop");
      cue("goodCue");
      if (it.role === "buddy") say(D.SAY.buddy(buddyName()));
      else if (e.n > 1) say(e.done ? D.SAY.foundAll(e.n, D.KINDS[e.kind].many) : NUM[e.got] || "");
      else say(D.SAY.found(D.KINDS[e.kind].say));
      saveRun();
      if (run.list.every((x) => x.done)) later(() => showWin(false), 900);
    }
  }

  // A find FLIES to its card on the list: the picture of it lifts off the
  // picture and lands where it is ticked, so finding and the list are one
  // thing he can see. Skipped under reduced motion (the tick still shows).
  function flyToCard(el, card) {
    try {
      const reduce = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce || !el || !card) return;
      const src = el.querySelector(".seek-it__pic");
      const a = el.getBoundingClientRect(), b = card.getBoundingClientRect();
      if (!a.width || !b.width) return;
      let f;
      if (src && src.tagName === "IMG") { f = doc.createElement("img"); f.src = src.src; f.alt = ""; f.className = "seek-fly"; }
      else { f = doc.createElement("span"); f.className = "seek-fly art-fill"; f.innerHTML = buddyArt(); }
      f.setAttribute("aria-hidden", "true");
      const size = Math.min(a.width, 120);
      f.style.left = a.left + (a.width - size) / 2 + "px";
      f.style.top = a.top + (a.height - size) / 2 + "px";
      f.style.width = size + "px";
      f.style.height = size + "px";
      doc.body.appendChild(f);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      void f.offsetWidth;
      f.style.transform = "translate(" + dx + "px," + dy + "px) scale(0.45)";
      f.style.opacity = "0.2";
      later(() => { if (f.parentNode) f.parentNode.removeChild(f); }, 750);
    } catch (e) { /* a flourish only */ }
  }

  // A list card: says what to find. After he has looked a while with no find,
  // it also SHOWS where one is — a gentle hidden timer, never a countdown.
  function onCard(li) {
    if (!run) return;
    const e = run.list[li];
    if (e.done) { say(e.kind === "buddy" ? D.SAY.buddy(buddyName()) : D.SAY.found(D.KINDS[e.kind].say)); return; }
    say(D.SAY.find(nameOf(e)));
    if (now() - run.lastFindAt >= HINT_AFTER_MS) showWhere(li);
  }
  function showWhere(li) {
    const e = run.list[li];
    let at = -1;
    run.items.forEach((it, i) => {
      if (at < 0 && !run.found.has(i) && ((e.kind === "buddy" && it.role === "buddy") || (it.role === "find" && it.kind === e.kind))) at = i;
    });
    if (at < 0) return;
    const el = run.els[at];
    const vr = view.getBoundingClientRect(), er = el.getBoundingClientRect();
    const top = view.scrollTop + (er.top - vr.top) - (vr.height - er.height) / 2;
    const reduce = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try { view.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" }); } catch (x) { view.scrollTop = Math.max(0, top); }
    el.classList.add("seek-it--hint");
    later(() => el.classList.remove("seek-it--hint"), 3000);
    run.lastFindAt = now();                     // the next hint waits again
  }

  // ---- The party ---------------------------------------------------------------------
  function showWin(restored) {
    if (!run || !win) return;
    if (!restored) {
      save.stars[run.place.id] = (save.stars[run.place.id] || 0) + 1;
      delete save.runs[run.place.id];
      persist();
      cue("winCue");
      say(D.SAY.win);
      // the next picture of this place is a new level: say so
      if (run.level < D.LEVELS.length - 1) say(D.SAY.trickier);
      try { if (playVisible() && global.JoshEffects) global.JoshEffects.confetti(); } catch (e) { /* ignore */ }
    }
    const box = win.querySelector(".seek-win__box");
    const b = box.querySelector(".seek-win__buddy");
    const art = buddyArt();
    if (art) b.innerHTML = art; else b.textContent = "🎉";
    const f = box.querySelector(".seek-win__found");
    f.textContent = "";
    for (const e of run.list) {
      if (e.kind === "buddy") continue;
      f.appendChild(img(e.art, "seek-win__pic"));
    }
    const nx = L.placeOf(nextPlace(run.place.id));
    const next = win.querySelector(".seek-next");
    next.textContent = "";
    next.appendChild(doc.createTextNode("▶ "));
    next.appendChild(img(D.KINDS[nx.door].art, "seek-next__pic"));
    next.setAttribute("aria-label", "Next place: " + nx.name);
    win.hidden = false;
    win.__shownAt = now();
  }
  function hideWin() { if (win) win.hidden = true; }

  function saveRun() {
    if (!run) return;
    if (run.list.every((e) => e.done)) delete save.runs[run.place.id];
    else save.runs[run.place.id] = { v: LAYOUT, seed: run.seed, level: run.level, found: [...run.found] };
    persist();
  }
  function leavePlay() {
    if (run && win && win.hidden) saveRun();
    clearLater();
  }

  // ---- Routing (main.js delegates every seek-* hash) ---------------------------------
  const SeekFind = {
    route(id) {
      if (!home || !play || !album) return false;
      if (id === "seek-home") {
        if (!play.hidden) leavePlay();
        play.hidden = true;
        album.hidden = true;
        doc.body.classList.add("seek-mode");
        doc.body.classList.remove("in-game");
        paintDoors();
        home.hidden = false;
        home.__shownAt = now();
        global.scrollTo(0, 0);
        later(() => { if (!home.hidden) say(D.SAY.pick); }, 300);
        return true;
      }
      if (id === "seek-album") {
        if (!play.hidden) leavePlay();
        play.hidden = true;
        home.hidden = true;
        doc.body.classList.add("seek-mode");
        doc.body.classList.remove("in-game");
        paintAlbum();
        album.hidden = false;
        album.__shownAt = now();
        global.scrollTo(0, 0);
        later(() => { if (!album.hidden) say(albumLine()); }, 300);
        return true;
      }
      if (id === "seek-play") {
        album.hidden = true;
        home.hidden = true;
        doc.body.classList.add("seek-mode");
        doc.body.classList.add("in-game");
        play.hidden = false;
        play.__shownAt = now();
        global.scrollTo(0, 0);
        const p = pending;
        pending = null;
        if (p) startPlace(p.id, { resume: p.resume });
        else if (!run) startPlace(save.last, { resume: true });
        return true;
      }
      return false;
    },
    onLeave() {
      if (play && !play.hidden) leavePlay();
      else clearLater();
      if (doc.body) doc.body.classList.remove("seek-mode");
    },
  };
  global.SeekFind = SeekFind;

  // ---- Test hooks (the __HOLE / __BOARD precedent) -------------------------------------
  global.__SEEK = {
    run: () => (run && play && !play.hidden ? { place: run.place.id, level: run.level, seed: run.seed, list: run.list.map((e) => ({ ...e })), found: [...run.found] } : null),
    items: () => (run ? run.items.map((it) => ({ ...it })) : []),
    save: () => JSON.parse(JSON.stringify(save)),
    reset() { save = freshSave(); try { global.localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } },
    // a place already finished n times (its next picture is level n, capped)
    setStars(id, n) { if (isPlace(id)) { save.stars[id] = nat(n); delete save.runs[id]; persist(); } },
    start(id, opts) { startPlace(id, opts || {}); return !!run; },
    // where item i's centre is on the page (to tap it like a finger)
    pointOf(i) {
      const el = run && run.els[i];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    reveal(i) { const el = run && run.els[i]; if (el) el.scrollIntoView({ block: "center" }); },
    ageHint() { if (run) run.lastFindAt = now() - HINT_AFTER_MS - 1; },
    // find item i exactly as a tap on it would (judge, not a shortcut past it)
    markForTest(i) { if (run && run.items[i]) judge(i); },
    timers: () => timers.size,
    flying: () => doc.querySelectorAll(".seek-fly").length,
    surprise: () => surprisePlace(),
    albumKinds: () => allAlbumKinds(),
  };

  try { build(); } catch (e) { console.error("Seek & Find: build failed:", e); }
  // The front door's tile wears the world's magnifying glass.
  try {
    const mark = doc.querySelector("#start-seek .start-tile__art");
    if (mark) { mark.textContent = ""; mark.appendChild(img(D.LOGO, "seek-logo")); }
  } catch (e) { /* the emoji fallback stays */ }
})(typeof window !== "undefined" ? window : globalThis);
