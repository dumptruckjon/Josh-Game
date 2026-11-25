// 🎨 Color Book — the world's screens (PLAN_COLOR.md): #color-home (the
// coloring book: a page per picture, white until he paints it) and
// #color-play (the page, the paint pots, the crayon box once it is done).
// main.js routes #color-home and #color-play here (try/catch-isolated, like the other
// worlds); never registered in JoshFramework, so his Sticker Book stays 200+.
//
// The page is one inline SVG drawn by ColorLogic.pageSvg; a tap is judged by
// the engine's owner grid (ColorLogic.judge), never by which element the
// browser hit, so a finger NEAR a shape of the chosen color still paints it.
// Kid laws, all on: no failure (a wrong shape shows its number and its pot
// wiggles), no timer, one finger, sound off by default and playable muted
// (the pots carry color and number; the shapes waiting for the chosen color
// shimmer).

(function (global) {
  "use strict";
  const doc = global.document;
  const D = global.ColorData, L = global.ColorLogic;
  if (!doc || !D || !L) return;
  const PAGES = D.PAGES;
  const $ = (id) => doc.getElementById(id);
  const now = () => (global.performance && global.performance.now ? global.performance.now() : Date.now());
  const reduce = () => { try { return global.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

  const KEY = "josh-color-v1";
  const ECHO_MS = 350;
  const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5]; // a pentatonic climb

  // ---- The save ---------------------------------------------------------------
  // stars: pages finished (and how often) · runs: a half-painted page (the
  // indices painted) · art: his own colors on a finished page (free paint) ·
  // demo: the ghost finger has been shown · last · order: the order he
  // painted a finished page in (🎬 replays it).
  function freshSave() { return { v: 1, stars: {}, runs: {}, art: {}, order: {}, draw: [], demo: false, glided: false, last: PAGES[0].id, gen: 0 }; }
  // His own drawing (the ✏️ page): strokes of a crayon color, each a flat list
  // of points [x, y, x, y, …] on the 200-unit page. Capped, so a save stays small.
  const MAX_STROKES = 300, MAX_PTS = 400;
  const isHex = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
  function coerceDraw(a) {
    if (!Array.isArray(a)) return [];
    const out = [];
    for (const st of a) {
      if (out.length >= MAX_STROKES) break;
      if (!st || !isHex(st.c) || !Array.isArray(st.p)) continue;
      const p = st.p.slice(0, MAX_PTS * 2);
      if (p.length < 2 || p.length % 2 || !p.every((v) => typeof v === "number" && Number.isFinite(v) && v >= -10 && v <= 210)) continue;
      out.push({ c: st.c.toLowerCase(), p });
    }
    return out;
  }
  const pageOf = (id) => PAGES.find((p) => p.id === id) || null;
  const nat = (n) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
  function coerce(text) {
    const s = freshSave();
    let raw = null;
    try { raw = JSON.parse(text); } catch (e) { raw = null; }
    if (!raw || typeof raw !== "object") return s;
    if (raw.stars && typeof raw.stars === "object") for (const id of Object.keys(raw.stars)) if (pageOf(id)) s.stars[id] = nat(raw.stars[id]);
    if (raw.runs && typeof raw.runs === "object") for (const id of Object.keys(raw.runs)) {
      const p = pageOf(id), r = raw.runs[id];
      if (!p || !Array.isArray(r)) continue;
      const ok = r.filter((i) => Number.isInteger(i) && i >= 0 && i < p.regions.length && p.regions[i].n);
      if (ok.length) s.runs[id] = [...new Set(ok)];
    }
    if (raw.art && typeof raw.art === "object") for (const id of Object.keys(raw.art)) {
      const p = pageOf(id), a = raw.art[id];
      if (!p || !a || typeof a !== "object") continue;
      const out = {};
      for (const k of Object.keys(a)) { const i = +k; if (Number.isInteger(i) && p.regions[i] && p.regions[i].n && L.isPaint(a[k])) out[i] = a[k]; }
      s.art[id] = out;
    }
    if (raw.order && typeof raw.order === "object") for (const id of Object.keys(raw.order)) {
      const p = pageOf(id), r = raw.order[id];
      if (!p || !Array.isArray(r)) continue;
      const ok = [...new Set(r.filter((i) => Number.isInteger(i) && i >= 0 && i < p.regions.length && p.regions[i].n))];
      if (ok.length) s.order[id] = ok;
    }
    s.draw = coerceDraw(raw.draw);
    s.demo = raw.demo === true;
    s.glided = raw.glided === true;
    if (pageOf(raw.last)) s.last = raw.last;
    s.gen = genOf(raw.gen);
    return s;
  }
  // gen: when a grown-up last reset the book (a time). A gen from the future
  // is not a real one (a hand-edited save), so it reads as never reset.
  function genOf(g) { return typeof g === "number" && Number.isFinite(g) && g > 0 && g <= Date.now() + 864e5 ? Math.floor(g) : 0; }
  function readStored() { try { return global.localStorage.getItem(KEY); } catch (e) { return null; } }
  let save = coerce(readStored());
  // Two tabs: ⭐ only grow, so a write folds in what the other tab stored —
  // unless a grown-up reset the book in that tab since (its gen is newer):
  // then this tab takes the reset, keeping only the pages it changed since its
  // last write (`own`), or its old ⭐ would fold straight back in (Gobble
  // Hole's §22 lesson). The save is re-read before anything decides from it
  // (syncSave: the router and the storage event), not only before a write.
  const own = new Set();
  function adopt(disk) {
    if (own.has("draw")) disk.draw = save.draw;
    for (const id of own) for (const k of ["stars", "runs", "art", "order"]) {
      if (save[k][id] != null) disk[k][id] = save[k][id]; else delete disk[k][id];
    }
    disk.demo = disk.demo || save.demo;
    disk.glided = disk.glided || save.glided;
    if (st && st.page) disk.last = st.page.id;
    save = disk;
  }
  function syncSave() {
    const disk = coerce(readStored());
    if (disk.gen > save.gen) { adopt(disk); return true; }
    return false;
  }
  function persist(pageId) {
    if (pageId) own.add(pageId);
    const disk = coerce(readStored());
    if (disk.gen > save.gen) adopt(disk);
    else {
      for (const id of Object.keys(disk.stars)) save.stars[id] = Math.max(save.stars[id] || 0, disk.stars[id]);
      save.demo = save.demo || disk.demo;
      save.glided = save.glided || disk.glided;
    }
    own.clear();
    try { global.localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* private mode: play on */ }
  }
  // Grown-ups only (the ⚙️ under the book, through the ONE gate, JoshGate):
  // every ⭐, every half-painted page, his own colors and the replays go. It
  // keeps "he has seen how" (the ghost finger and the crayon glide). The ONE
  // wipe: the button and the test hook both call it. It writes without
  // folding, and stamps a gen past this tab's and the stored one, so another
  // open tab takes it rather than folding its old ⭐ back in.
  function resetProgress(opts) {
    const disk = coerce(readStored());
    const had = [save, disk].some((s) => Object.keys(s.stars).length || Object.keys(s.runs).length || Object.keys(s.art).length || s.draw.length);
    const keep = !!(opts && opts.keepDemo);
    const demo = save.demo, glided = save.glided;
    const gen = Math.max(Date.now(), save.gen + 1, disk.gen + 1);
    save = freshSave();
    save.gen = gen;
    if (keep) { save.demo = demo; save.glided = glided; }
    st = null;
    own.clear();
    clearLater();
    try { global.localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
    if (home) paintBook();
    return had;
  }

  // ---- Sound: through JoshAudio only, and only while a screen of ours is up ---
  function audioOK() { const a = global.JoshAudio; return !!a && !a.isMuted(); }
  function visible() { return (!!play && !play.hidden && !doc.hidden) || (!!home && !home.hidden && !doc.hidden); }
  function say(text) { if (audioOK() && text && visible()) global.JoshAudio.say(text); }
  function sayZh(text) { if (audioOK() && text && visible()) global.JoshAudio.say(text, { lang: "zh-CN" }); }
  function cue(name) { const a = global.JoshAudio; if (a && a[name] && visible()) a[name](); }
  function tone(f, o) { if (audioOK() && visible()) global.JoshAudio.tone(f, o); }

  const timers = new Set();
  function later(fn, ms) {
    const id = global.setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  }
  function clearLater() {
    for (const id of timers) global.clearTimeout(id);
    timers.clear();
    // what a cancelled timer would have taken away goes with it: a finger, or
    // a sparkle burst left over the page he comes back to
    for (const f of doc.querySelectorAll(".cb-ghost, .cb-burst")) f.parentNode.removeChild(f);
  }

  // ---- Geometry, once per page ---------------------------------------------------
  const GEO = {};
  function geo(page) {
    if (!GEO[page.id]) { const r = L.raster(page); GEO[page.id] = { r, labels: L.labels(page, r) }; }
    return GEO[page.id];
  }
  const colorOf = (page, n) => page.colors.find((c) => c.n === n);

  // What a page looks like to the book: his own colors where he chose them,
  // the palette's where he painted by number, white where nothing is yet.
  function fillsFor(page) {
    const fills = {};
    const done = save.stars[page.id] > 0;
    const run = save.runs[page.id];
    page.regions.forEach((reg, i) => {
      if (!reg.n) return;
      if (done && !run) fills[i] = (save.art[page.id] && save.art[page.id][i]) || colorOf(page, reg.n).hex;
    });
    if (run) for (const i of run) fills[i] = colorOf(page, page.regions[i].n).hex;
    return fills;
  }

  // ---- Screens -------------------------------------------------------------------
  let home = null, play = null, field = null, holder = null, pots = null, box = null, titleEl = null;
  let st = null, pending = null;

  function build() {
    const screens = $("screens");
    if (!screens || $("screen-color-home")) return;

    home = doc.createElement("section");
    home.id = "screen-color-home";
    home.className = "screen color-screen color-home";
    home.hidden = true;
    home.innerHTML =
      '<div class="game__bar color-bar">' +
        '<button class="btn-round game__home color-exit" type="button" aria-label="Back to the front door">🚪</button>' +
        '<h1 class="game__title color-title">Color Book</h1>' +
        '<button class="btn-round game__hear color-homehear" type="button" aria-label="Hear it again">👂</button>' +
      "</div>" +
      '<div class="color-book"></div>' +
      // Grown-ups only: start the book over. Small and quiet on purpose, after
      // the last page, behind the app's ONE type-the-word gate (JoshGate).
      // data-adult: exempt from the kid tap audit, like Josh's own ⚙️.
      '<button class="reset-stars color-reset" id="color-reset" type="button" data-adult="1" ' +
        'aria-label="Grown-ups: start the Color Book over">⚙️ Grown-ups</button>';
    screens.appendChild(home);
    home.querySelector(".color-reset").addEventListener("click", () => {
      const G = global.JoshGate;
      if (!G) return;
      G.ask({
        label: "Start the Color Book over",
        msg: "Grown-ups: type <b>reset</b> to clear every page’s&nbsp;⭐ and his colors, and start the Color Book over",
        confirm: () => (resetProgress({ keepDemo: true }) ? "The Color Book starts over! ✨" : "Nothing to clear yet."),
      });
    });
    home.querySelector(".color-exit").addEventListener("click", () => { location.hash = ""; });
    home.querySelector(".color-homehear").addEventListener("click", () => say("Pick a page to color!"));
    // The book's shelves (ColorData.SHELVES): a heading for the grown-up, then
    // its pages; the last shelf is his own drawing page.
    const book = home.querySelector(".color-book");
    const shelf = (icon, title) => {
      const h = doc.createElement("h2");
      h.className = "color-shelf";
      h.innerHTML = '<span aria-hidden="true">' + icon + "</span> " + title;
      const g = doc.createElement("div");
      g.className = "color-pages";
      g.setAttribute("role", "list");
      g.setAttribute("aria-label", title);
      book.appendChild(h);
      book.appendChild(g);
      return g;
    };
    for (const sh of D.SHELVES) {
      const grid = shelf(sh.icon, sh.title);
      for (const p of PAGES.filter((x) => x.shelf === sh.id)) {
        const b = doc.createElement("button");
        b.type = "button";
        b.className = "color-page tap" + (p.mystery ? " color-page--mystery" : "");
        b.dataset.page = p.id;
        b.setAttribute("role", "listitem");
        b.innerHTML = '<span class="color-page__pic" aria-hidden="true"></span><span class="color-page__num" aria-hidden="true">' + p.level + '</span><span class="color-page__star" aria-hidden="true"></span>' +
          (p.mystery ? '<span class="color-page__q" aria-hidden="true">❓</span>' : "");
        b.addEventListener("click", () => openPage(p.id));
        grid.appendChild(b);
      }
    }
    const dgrid = shelf("✏️", "Draw your own");
    const db = doc.createElement("button");
    db.type = "button";
    db.className = "color-page color-page--draw tap";
    db.dataset.page = "draw";
    db.setAttribute("role", "listitem");
    db.innerHTML = '<span class="color-page__pic" aria-hidden="true"></span><span class="color-page__pen" aria-hidden="true">✏️</span>';
    db.addEventListener("click", () => openPage("draw"));
    dgrid.appendChild(db);
    guardEcho(home);

    play = doc.createElement("section");
    play.id = "screen-color-play";
    play.className = "screen color-screen color-play";
    play.hidden = true;
    play.innerHTML =
      '<div class="game__bar color-bar">' +
        '<button class="btn-round game__home color-back" type="button" aria-label="Back to the book">🏠</button>' +
        '<h1 class="game__title color-pagename"></h1>' +
        '<button class="btn-round game__hear color-hear" type="button" aria-label="Hear it again">👂</button>' +
      "</div>" +
      '<div class="color-field"><div class="color-holder" role="img"></div></div>' +
      '<div class="color-pots" role="list" aria-label="Paint pots"></div>' +
      '<div class="color-box" hidden>' +
        '<div class="color-crayons" role="list" aria-label="Crayons"></div>' +
        '<div class="color-boxrow">' +
          '<button class="btn-big color-again" type="button" aria-label="Color this page again">🔁</button>' +
          '<button class="btn-big color-replay" type="button" aria-label="Watch it paint">🎬</button>' +
          '<button class="btn-big color-next" type="button" aria-label="Next page">▶</button>' +
          '<button class="btn-big color-undo" type="button" aria-label="Undo" hidden>↩️</button>' +
          '<button class="btn-big color-clear" type="button" aria-label="A clean page" hidden>🧽</button>' +
        "</div>" +
      "</div>";
    screens.appendChild(play);
    field = play.querySelector(".color-field");
    holder = play.querySelector(".color-holder");
    pots = play.querySelector(".color-pots");
    box = play.querySelector(".color-box");
    titleEl = play.querySelector(".color-pagename");
    play.querySelector(".color-back").addEventListener("click", () => { location.hash = "#color-home"; });
    play.querySelector(".color-hear").addEventListener("click", () => {
      if (!st) return;
      if (st.draw) { say(D.SAY.draw); return; }
      if (st.free) { say(D.SAY.paint); return; }
      say(D.SAY.open(st.page) + " " + D.SAY.how(st.page));
      showGhost();
    });
    box.querySelector(".color-again").addEventListener("click", () => { if (st) startPage(st.page.id, { fresh: true }); });
    box.querySelector(".color-next").addEventListener("click", () => { if (st) startPage(nextPage(st.page.id), {}); });
    box.querySelector(".color-replay").addEventListener("click", () => replay());
    box.querySelector(".color-undo").addEventListener("click", () => undoDraw());
    box.querySelector(".color-clear").addEventListener("click", () => clearDraw());
    holder.addEventListener("click", onTap);
    holder.addEventListener("pointerdown", penDown);
    holder.addEventListener("pointermove", penMove);
    holder.addEventListener("pointerup", penUp);
    holder.addEventListener("pointercancel", penUp);
    const crayons = box.querySelector(".color-crayons");
    for (const m of D.MAGIC) {
      const c = doc.createElement("button");
      c.type = "button";
      c.className = "color-crayon color-crayon--magic color-crayon--" + m.fx + " tap";
      c.dataset.crayon = "fx:" + m.fx;
      c.setAttribute("role", "listitem");
      c.setAttribute("aria-label", m.label);
      c.addEventListener("click", () => pickCrayon("fx:" + m.fx));
      crayons.appendChild(c);
    }
    D.CRAYONS.forEach((hex, k) => {
      const c = doc.createElement("button");
      c.type = "button";
      c.className = "color-crayon tap";
      c.dataset.crayon = hex;
      c.setAttribute("role", "listitem");
      c.setAttribute("aria-label", "Crayon " + (k + 1));
      c.style.setProperty("--crayon", hex);
      c.addEventListener("click", () => pickCrayon(hex));
      crayons.appendChild(c);
    });
    guardEcho(play);
    play.__onHide = () => { leavePlay(); };
    global.addEventListener("resize", () => { if (play && !play.hidden) fit(); });
  }

  // The echo of a double tap: a page card, ▶ or 🔁 opens a page under the
  // finger, and the second tap must not paint it unaimed. A pot that changes by
  // itself (a color finished) likewise: the next tap within the echo is eaten.
  function guardEcho(el) {
    el.addEventListener("click", (e) => {
      const finger = e.isTrusted && e.detail !== 0;
      if (!finger) return;
      const since = now() - Math.max(el.__shownAt || -1e9, el.__changedAt || -1e9);
      if (since < ECHO_MS) { e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);
  }

  function nextPage(id) {
    const i = PAGES.findIndex((p) => p.id === id);
    for (let k = 1; k <= PAGES.length; k++) { const p = PAGES[(i + k) % PAGES.length]; if (!save.stars[p.id]) return p.id; }
    return PAGES[(i + 1) % PAGES.length].id;
  }
  // The page the book suggests: the first one not yet colored.
  const suggested = () => (PAGES.find((p) => !save.stars[p.id]) || PAGES[0]).id;

  // A mystery page keeps its name until it is colored.
  const nameOf = (p) => (p.mystery && !(save.stars[p.id] > 0) ? "Mystery picture" : p.name);
  function paintBook() {
    const sug = suggested();
    for (const b of home.querySelectorAll(".color-page:not(.color-page--draw)")) {
      const p = pageOf(b.dataset.page);
      const n = save.stars[p.id] || 0, painting = !!save.runs[p.id];
      b.querySelector(".color-page__pic").innerHTML = L.pageSvg(p, { fills: fillsFor(p), thumb: true, shade: n > 0 && !painting, cls: "cb-thumb" });
      b.querySelector(".color-page__star").textContent = n ? "⭐" : "";
      b.classList.toggle("color-page--done", n > 0);
      b.classList.toggle("color-page--next", p.id === sug);
      b.setAttribute("aria-label", "Page " + p.level + ": " + nameOf(p) + (n ? ", colored" : painting ? ", started" : ""));
    }
    const db = home.querySelector(".color-page--draw");
    if (db) {
      db.querySelector(".color-page__pic").innerHTML = drawSvg(save.draw, true);
      db.classList.toggle("color-page--drawn", save.draw.length > 0);
      db.setAttribute("aria-label", "Draw your own picture" + (save.draw.length ? ", started" : ""));
    }
  }

  // ---- A page -----------------------------------------------------------------------
  function openPage(id) { pending = id; location.hash = "#color-play"; }

  function startPage(id, opts) {
    if (id === "draw") { startDraw(); return; }
    const page = pageOf(id) || PAGES[0];
    clearLater();
    if (play) play.classList.remove("color-play--replay", "color-play--draw");
    setDrawUi(false);
    if (opts && opts.fresh) { delete save.runs[page.id]; delete save.art[page.id]; }
    const g = geo(page);
    const finished = save.stars[page.id] > 0 && !save.runs[page.id] && !(opts && opts.fresh);
    st = { page, g, done: new Set(finished ? L.numbered(page) : save.runs[page.id] || []), sel: null, free: false, crayon: null, fills: {} };
    for (const i of st.done) st.fills[i] = colorOf(page, page.regions[i].n).hex;
    save.last = page.id;
    persist(opts && opts.fresh ? page.id : null);
    titleEl.textContent = nameOf(page);
    holder.setAttribute("aria-label", "A coloring page: " + nameOf(page));
    if (finished) { enterFree(true); return; }
    st.sel = L.nextColor(page, st.done, page.colors[page.colors.length - 1].n);
    draw();
    drawPots();
    box.hidden = true;
    pots.hidden = false;
    fit();
    later(() => {
      if (!play || play.hidden) return;
      if (st.done.size) sayPick(colorOf(page, st.sel)); else say(D.SAY.open(page) + " " + D.SAY.how(page));
      if (!save.demo) showGhost();
    }, 380);
    armHint();
  }

  // ---- Find it: a long quiet while with nothing painted, and ONE shape
  // waiting for his color is shown to him (a ring that pulses, the ghost
  // finger on it). Choosing a color shows nothing (the owner, 2026-11-25:
  // lighting the shapes the moment he picks a number was far too easy) —
  // finding the numbers IS the game. A hint, never a timer: nothing is lost,
  // nothing is said, and it comes back only after another quiet while.
  const HINT_MS = 25000;
  let hintTok = 0;
  function armHint() {
    const tok = ++hintTok;
    later(() => { if (tok === hintTok) hint(); }, HINT_MS);
  }
  function hint() {
    if (!st || st.free || st.draw || st.replaying || !play || play.hidden) return;
    const svg = holder.querySelector("svg");
    if (!svg) return;
    const i = hintTarget();
    if (i == null) return;
    const el = svg.querySelector('path.cb-num[data-i="' + i + '"]');
    if (el) el.classList.add("cb-find");
    showGhost();
    const tok = hintTok;
    later(() => { if (tok === hintTok) clearHint(); }, 4200);
    armHint();
  }
  // the shape a hint shows: the first one still waiting for his color (the
  // ghost finger points at the same one)
  function hintTarget() {
    if (!st || st.sel == null) return null;
    const i = L.numbered(st.page).find((k) => !st.done.has(k) && st.page.regions[k].n === st.sel);
    return i == null ? null : i;
  }
  function clearHint() {
    const svg = holder && holder.querySelector("svg");
    if (svg) for (const el of svg.querySelectorAll(".cb-find")) el.classList.remove("cb-find");
  }

  function draw() {
    const opts = { fills: st.fills, labels: st.free ? null : st.g.labels };
    if (st.free) opts.shade = true;
    holder.innerHTML = L.pageSvg(st.page, opts);
    const svg = holder.querySelector("svg");
    svg.insertAdjacentHTML("afterbegin", "<defs></defs>");
    fit();
  }
  // The page is as big a square as the field allows.
  function fit() {
    const svg = holder && holder.querySelector("svg");
    if (!svg || !field || play.hidden) return;
    const side = Math.max(0, Math.floor(Math.min(field.clientWidth, field.clientHeight)));
    svg.style.width = side + "px";
    svg.style.height = side + "px";
  }
  function drawPots() {
    pots.textContent = "";
    const left = L.remaining(st.page, st.done);
    for (const c of st.page.colors) {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "color-pot tap";
      b.dataset.n = c.n;
      b.setAttribute("role", "listitem");
      b.style.setProperty("--pot", c.hex);
      b.style.setProperty("--ink", L.inkOn(c.hex));
      b.innerHTML = '<span class="color-pot__num">' + c.n + '</span><span class="color-pot__done" aria-hidden="true">✓</span>';
      b.addEventListener("click", () => pickColor(c.n, true));
      pots.appendChild(b);
    }
    paintPots(left);
  }
  function paintPots(left0) {
    const left = left0 || L.remaining(st.page, st.done);
    for (const b of pots.querySelectorAll(".color-pot")) {
      const n = +b.dataset.n, c = colorOf(st.page, n);
      b.classList.toggle("color-pot--sel", n === st.sel);
      b.classList.toggle("color-pot--done", left[n] === 0);
      b.setAttribute("aria-pressed", n === st.sel ? "true" : "false");
      b.setAttribute("aria-label", "Number " + n + ", " + c.name + (left[n] === 0 ? ", all done" : ", " + left[n] + " left"));
    }
  }
  // A pot said: its number and color, and on a Chinese page its number in Chinese.
  function sayPick(c) {
    say(D.SAY.pick(c));
    if (st && st.page && st.page.label === "zh") sayZh(L.ZH_NUM[c.n]);
  }
  function pickColor(n, spoken) {
    if (!st || st.free || st.draw) return;
    const c = colorOf(st.page, n);
    st.sel = n;
    paintPots();
    // a pick is activity: the quiet while starts again (a pick never hints)
    clearHint();
    armHint();
    const pot = pots.querySelector('.color-pot[data-n="' + n + '"]');
    if (pot) { bounce(pot, "color-pot--pop"); showInRow(pots, pot); }
    if (spoken) sayPick(c);
  }
  // On a small phone the pots are one row that scrolls sideways: bring the
  // chosen one into view (only the row scrolls, never the page).
  function showInRow(row, el) {
    if (row.scrollWidth <= row.clientWidth + 1) return;
    const want = el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2;
    row.scrollLeft = Math.max(0, Math.min(row.scrollWidth - row.clientWidth, want));
  }
  function bounce(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    later(() => el.classList.remove(cls), 600);
  }

  // Where a tap lands on the page, in its 200-unit drawing.
  function pageXY(e) {
    const svg = holder.querySelector("svg");
    const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * L.W, y: ((e.clientY - r.top) / r.height) * L.H };
  }

  function onTap(e) {
    if (!st || st.draw) return;
    const p = pageXY(e);
    if (st.free) { freeTap(p); return; }
    const v = L.judge(st.page, st.g.r, p.x, p.y, st.sel, st.done);
    if (v.kind === "fill") fill(v.i, p);
    else if (v.kind === "wrong") wrong(v.i);
  }

  function fill(i, p) {
    const page = st.page, n = page.regions[i].n, c = colorOf(page, n);
    st.done.add(i);
    st.fills[i] = c.hex;
    spread(i, c.hex, p);
    burst(p, c.hex);
    clearHint();
    armHint();
    const lab = holder.querySelector('[data-for="' + i + '"]');
    if (lab) lab.parentNode.removeChild(lab);
    hideGhost();
    if (!save.demo) { save.demo = true; }
    tone(SCALE[(st.done.size - 1) % SCALE.length], { duration: 0.16, type: "triangle", gain: 0.14 });
    save.runs[page.id] = [...st.done];
    persist(page.id);
    const left = L.remaining(page, st.done);
    if (L.finished(page, st.done)) { paintPots(left); finish(); return; }
    if (left[n] === 0) {
      paintPots(left);
      const pot = pots.querySelector('.color-pot[data-n="' + n + '"]');
      if (pot) bounce(pot, "color-pot--cheer");
      cue("goodCue");
      say(D.SAY.colorDone(c));
      if (D.COLOR_ZH[c.name]) sayZh(D.COLOR_ZH[c.name]);
      // the next pot is chosen at once (a quick tap on a shape of the next color
      // must work), and said a beat after the cheer
      const nx = L.nextColor(page, st.done, n);
      play.__changedAt = now();
      if (nx) { pickColor(nx, false); later(() => { if (st && !st.free && st.sel === nx) sayPick(colorOf(page, nx)); }, 900); }
    } else paintPots(left);
  }

  // The paint spreads out from the finger: a circle growing inside the shape.
  // Put a paint on shape i at once: its fill, and the magic lying over it.
  function applyPaint(path, paint) {
    path.setAttribute("fill", L.paintFill(paint));
    path.classList.remove("cb-find");
    const nx = path.nextElementSibling;
    if (nx && nx.classList && nx.classList.contains("cb-fx")) nx.parentNode.removeChild(nx);
    const over = L.paintOver(paint, path.getAttribute("d"));
    if (over) path.insertAdjacentHTML("afterend", over);
  }
  function spread(i, paint, p) {
    const svg = holder.querySelector("svg");
    const path = svg && svg.querySelector('path[data-i="' + i + '"]');
    if (!path) return;
    const pt = L.paintOf(paint);
    if (reduce()) { applyPaint(path, paint); return; }
    const NS = "http://www.w3.org/2000/svg";
    const id = "cbclip-" + st.page.id + "-" + i;
    const defs = svg.querySelector("defs");
    const cp = doc.createElementNS(NS, "clipPath");
    cp.setAttribute("id", id);
    const shape = doc.createElementNS(NS, "path");
    shape.setAttribute("d", path.getAttribute("d"));
    cp.appendChild(shape);
    defs.appendChild(cp);
    const circ = doc.createElementNS(NS, "circle");
    circ.setAttribute("cx", p.x.toFixed(1));
    circ.setAttribute("cy", p.y.toFixed(1));
    circ.setAttribute("r", "0");
    // the paint that spreads: the color, the rainbow, or the magic over it
    circ.setAttribute("fill", pt.fx === "rainbow" ? "url(#cb-fx-rainbow)" : pt.fx ? "url(#cb-fx-" + pt.fx + ")" : pt.hex);
    circ.setAttribute("clip-path", "url(#" + id + ")");
    circ.setAttribute("pointer-events", "none");
    path.parentNode.insertBefore(circ, path.nextSibling);
    let far = 0;
    for (const q of st.page.regions[i].pts) far = Math.max(far, Math.hypot(q[0] - p.x, q[1] - p.y));
    const t0 = now(), DUR = 320;
    const end = () => {
      if (path.isConnected) applyPaint(path, paint);
      if (circ.parentNode) circ.parentNode.removeChild(circ);
      if (cp.parentNode) cp.parentNode.removeChild(cp);
    };
    const step = () => {
      if (!circ.parentNode) return;
      const k = Math.min(1, (now() - t0) / DUR);
      circ.setAttribute("r", (far * (1 - Math.pow(1 - k, 3))).toFixed(1));
      if (k < 1) global.requestAnimationFrame(step); else end();
    };
    global.requestAnimationFrame(step);
    later(end, DUR + 300); // a hidden tab gets no frames: finish anyway
  }

  // A little burst of sparkles where the paint lands (motion only).
  function burst(p, hex) {
    if (reduce() || !play) return;
    const svg = holder.querySelector("svg");
    if (!svg) return;
    const r = svg.getBoundingClientRect(), fr = play.getBoundingClientRect();
    for (const old of [...play.querySelectorAll(".cb-burst")].slice(0, -2)) old.parentNode.removeChild(old);
    const b = doc.createElement("div");
    b.className = "cb-burst";
    b.setAttribute("aria-hidden", "true");
    b.style.left = r.left + (p.x / L.W) * r.width - fr.left + "px";
    b.style.top = r.top + (p.y / L.H) * r.height - fr.top + "px";
    b.style.setProperty("--burst", hex);
    for (let k = 0; k < 6; k++) {
      const sp = doc.createElement("span");
      sp.style.setProperty("--a", k * 60 + "deg");
      b.appendChild(sp);
    }
    play.appendChild(b);
    later(() => { if (b.parentNode) b.parentNode.removeChild(b); }, 700);
  }

  function wrong(i) {
    const reg = st.page.regions[i];
    const lab = holder.querySelector('[data-for="' + i + '"]');
    if (lab) bounceSvg(lab, "cb-label--nudge");
    const pot = pots.querySelector('.color-pot[data-n="' + reg.n + '"]');
    if (pot) bounce(pot, "color-pot--wiggle");
    const label = st.page.label;
    if (reg.sum) say(D.SAY.wrongSum(reg.sum[0], reg.sum[1], reg.n));
    else if (reg.diff) say(D.SAY.wrongDiff(reg.diff[0], reg.diff[1], reg.n));
    else if (label === "dots") say(D.SAY.wrongDots(reg.n));
    else { say(D.SAY.wrong(reg.n)); if (label === "zh") sayZh(L.ZH_NUM[reg.n]); }
  }
  function bounceSvg(el, cls) {
    el.classList.remove(cls);
    void el.getBoundingClientRect();
    el.classList.add(cls);
    later(() => el.classList.remove(cls), 700);
  }

  // ---- Done: it comes alive, then it is his to recolor --------------------------
  function finish() {
    const page = st.page;
    save.stars[page.id] = (save.stars[page.id] || 0) + 1;
    save.order[page.id] = [...st.done]; // the order he painted it in, for 🎬
    delete save.runs[page.id];
    delete save.art[page.id];
    persist(page.id);
    cue("winCue");
    say(D.SAY.done(page));
    say(page.cheer);
    if (page.cheerZh) sayZh(page.cheerZh);
    titleEl.textContent = page.name; // a mystery picture is named once it is done
    try { if (global.JoshEffects && play && !play.hidden) global.JoshEffects.confetti(); } catch (e) { /* ignore */ }
    clearHint();
    hintTok++;
    later(() => { if (st && st.page === page) enterFree(false); }, reduce() ? 0 : 420);
  }

  function enterFree(restored) {
    st.free = true;
    st.crayon = null;
    const art = save.art[st.page.id] || {};
    for (const i of L.numbered(st.page)) st.fills[i] = art[i] || colorOf(st.page, st.page.regions[i].n).hex;
    draw();
    comeAlive(!restored);
    pots.hidden = true;
    box.hidden = false;
    fit();
    play.__changedAt = now();
    for (const c of box.querySelectorAll(".color-crayon")) c.classList.remove("color-crayon--sel");
    const nx = pageOf(nextPage(st.page.id));
    const next = box.querySelector(".color-next");
    next.innerHTML = "▶ " + '<span class="color-next__pic" aria-hidden="true">' + L.pageSvg(nx, { thumb: true, cls: "cb-thumb" }) + "</span>";
    next.setAttribute("aria-label", "Next page: " + nameOf(nx));
    glideStrip();
    if (restored) later(() => { if (play && !play.hidden) say(D.SAY.paint); }, 380);
    else later(() => { if (st && st.free) say(D.SAY.paint); }, 1800);
  }

  // Each page's own sound (D.PAGES[].sound), through the mute-gated tone().
  const SFX = {
    chime: { notes: [784, 988, 1175, 1568], step: 90, o: { duration: 0.3, type: "sine", gain: 0.14 } },
    bloop: { notes: [620, 470, 360], step: 120, o: { duration: 0.18, type: "sine", gain: 0.16 } },
    yum: { notes: [660, 880, 1046], step: 130, o: { duration: 0.22, type: "triangle", gain: 0.14 } },
    whoosh: { notes: [220, 277, 330, 392, 466, 554, 659, 784, 932, 1109, 1319], step: 45, o: { duration: 0.12, type: "triangle", gain: 0.12 } },
    roar: { notes: [130, 116, 98], step: 160, o: { duration: 0.34, type: "sawtooth", gain: 0.16 } },
    honk: { notes: [392, 392], step: 280, o: { duration: 0.24, type: "square", gain: 0.12 } },
    siren: { notes: [880, 660, 880, 660], step: 270, o: { duration: 0.26, type: "triangle", gain: 0.13 } },
    fanfare: { notes: [523, 659, 784, 1047], step: 150, o: { duration: 0.28, type: "triangle", gain: 0.14 } },
    horn: { notes: [196, 247], step: 520, o: { duration: 0.5, type: "sawtooth", gain: 0.13 } },
    beep: { notes: [988, 1319, 988, 1568], step: 120, o: { duration: 0.09, type: "square", gain: 0.1, plain: true } },
    vroom: { notes: [110, 131, 156, 185, 220], step: 90, o: { duration: 0.16, type: "sawtooth", gain: 0.14 } },
    meow: { notes: [740, 932, 830, 622], step: 110, o: { duration: 0.18, type: "sine", gain: 0.14 } },
    quack: { notes: [494, 440], step: 170, o: { duration: 0.14, type: "square", gain: 0.1, plain: true } },
    choo: { notes: [392, 523, 392, 523], step: 230, o: { duration: 0.22, type: "triangle", gain: 0.14 } },
    drum: { notes: [131, 131, 196, 131], step: 210, o: { duration: 0.16, type: "triangle", gain: 0.16 } },
  };
  function pageSound(page) {
    const fx = SFX[page.sound] || SFX.chime;
    fx.notes.forEach((f, k) => { if (k === 0) tone(f, fx.o); else later(() => { if (st && st.page === page) tone(f, fx.o); }, k * fx.step); });
  }
  function comeAlive(withSound) {
    if (withSound) pageSound(st.page);
    if (reduce()) return;
    const svg = holder.querySelector("svg");
    if (!svg) return;
    for (const a of st.page.alive || []) {
      for (const g of svg.querySelectorAll('g[data-part="' + a.part + '"]')) {
        g.classList.add("cb-anim", "cb-anim--" + a.anim);
        if (a.origin) { g.style.transformBox = "view-box"; g.style.transformOrigin = a.origin[0] + "px " + a.origin[1] + "px"; }
      }
    }
  }

  // On a phone the crayons are a strip that scrolls sideways. The first time
  // the box opens it glides to the end and back, so he sees it moves (only the
  // strip scrolls, never the page; not under reduced motion).
  function glideStrip() {
    const row = box.querySelector(".color-crayons");
    row.scrollLeft = 0;
    if (save.glided || reduce()) return;
    later(() => {
      const far = row.scrollWidth - row.clientWidth;
      if (far <= 4 || !play || play.hidden) return;
      save.glided = true;
      persist();
      const t0 = now(), DUR = 2200;
      const step = () => {
        if (!play || play.hidden || !row.isConnected) return;
        const k = Math.min(1, (now() - t0) / DUR);
        row.scrollLeft = far * Math.sin(k * Math.PI); // out to the end, and back
        if (k < 1) global.requestAnimationFrame(step); else row.scrollLeft = 0;
      };
      global.requestAnimationFrame(step);
    }, 900);
  }

  // A crayon is "#rrggbb", or "fx:<magic>" for a magic one.
  function pickCrayon(key) {
    if (!st || !(st.free || st.draw) || st.replaying) return;
    st.crayon = key;
    for (const c of box.querySelectorAll(".color-crayon")) {
      const on = c.dataset.crayon === key;
      c.classList.toggle("color-crayon--sel", on);
      c.setAttribute("aria-pressed", on ? "true" : "false");
    }
    tone(660, { duration: 0.1, type: "sine", gain: 0.1 });
    const m = key.indexOf("fx:") === 0 && D.MAGIC.find((x) => "fx:" + x.fx === key);
    if (m && !st.saidMagic) { st.saidMagic = true; say(D.SAY.magic); } else if (m) say(m.say);
  }
  // What a crayon makes of a shape's paint: a plain crayon replaces it (and
  // takes the magic off); rainbow replaces the color; the others lie over it.
  function paintWith(key, before) {
    if (key.indexOf("fx:") !== 0) return key;
    return L.paintOf(before).hex + " " + key.slice(3);
  }
  function freeTap(p) {
    if (st.replaying) return;
    if (!st.crayon) { const first = box.querySelector(".color-crayon"); if (first) bounce(first, "color-pot--wiggle"); return; }
    const page = st.page;
    // any shape with a number can be recolored (the fixed eyes and hubs stay)
    const i = L.ownerAt(st.g.r, p.x, p.y);
    if (i < 0 || !page.regions[i].n) return;
    const paint = paintWith(st.crayon, st.fills[i]);
    st.fills[i] = paint;
    if (!save.art[page.id]) save.art[page.id] = {};
    save.art[page.id][i] = paint;
    persist(page.id);
    spread(i, paint, p);
    burst(p, L.paintOf(paint).hex);
    const magic = L.paintOf(paint).fx;
    if (magic) [0, 1, 2].forEach((k) => later(() => tone(1319 + k * 330, { duration: 0.12, type: "sine", gain: 0.08 }), k * 70));
    else tone(SCALE[i % SCALE.length], { duration: 0.14, type: "triangle", gain: 0.12 });
  }

  // ---- 🎬 Watch it paint: the page paints itself again, in the order he did --
  const REPLAY_STEP = 150;
  function replay() {
    if (!st || !st.free || st.replaying) return;
    const page = st.page;
    const order = (save.order[page.id] || []).filter((i) => page.regions[i] && page.regions[i].n);
    for (const i of L.numbered(page)) if (!order.includes(i)) order.push(i);
    st.replaying = true;
    play.classList.add("color-play--replay");
    holder.innerHTML = L.pageSvg(page, { fills: {} });
    holder.querySelector("svg").insertAdjacentHTML("afterbegin", "<defs></defs>");
    fit();
    say(D.SAY.replay);
    order.forEach((i, k) => later(() => {
      if (!st || st.page !== page || !st.replaying) return;
      const lab = st.g.labels[i];
      spread(i, colorOf(page, page.regions[i].n).hex, { x: lab.x, y: lab.y });
      tone(SCALE[k % SCALE.length], { duration: 0.12, type: "triangle", gain: 0.1 });
    }, 500 + k * REPLAY_STEP));
    later(() => {
      if (!st || st.page !== page || !st.replaying) return;
      st.replaying = false;
      play.classList.remove("color-play--replay");
      draw();
      comeAlive(true);
    }, 500 + order.length * REPLAY_STEP + 500);
  }

  // ---- ✏️ Draw your own: a blank page, a crayon, a finger ---------------------
  // A stroke follows the finger (one finger: a second one is ignored). ↩️ takes
  // back the last stroke, and 🧽 gives a clean page — which ↩️ can bring back,
  // so nothing he drew is ever lost to one tap. His drawing is kept in the save
  // and shown in the book.
  const PEN_W = 5;
  function drawSvg(strokes, thumb) {
    let out = '<svg class="' + (thumb ? "cb-thumb" : "cb-svg") + ' cb-draw" viewBox="0 0 ' + L.W + " " + L.H + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">';
    out += '<rect width="' + L.W + '" height="' + L.H + '" fill="#ffffff"/>';
    if (!strokes.length && thumb) out += '<text x="100" y="112" font-size="60" text-anchor="middle" dominant-baseline="central">✏️</text>';
    out += '<g class="cb-strokes">' + strokes.map(strokePath).join("") + "</g>";
    return out + "</svg>";
  }
  function strokeD(p) {
    const pts = [];
    for (let k = 0; k + 1 < p.length; k += 2) pts.push([p[k], p[k + 1]]);
    if (pts.length === 1) pts.push([pts[0][0] + 0.01, pts[0][1]]); // a dot
    return L.lineD(pts);
  }
  const strokePath = (s) => '<path d="' + strokeD(s.p) + '" fill="none" stroke="' + s.c + '" stroke-width="' + PEN_W + '" stroke-linecap="round" stroke-linejoin="round"/>';
  function setDrawUi(on) {
    if (!play) return;
    play.classList.toggle("color-play--draw", on);
    for (const c of [".color-again", ".color-replay", ".color-next"]) box.querySelector(c).hidden = on;
    for (const c of [".color-undo", ".color-clear"]) box.querySelector(c).hidden = !on;
  }
  function startDraw() {
    clearLater();
    hintTok++;
    play.classList.remove("color-play--replay");
    st = { draw: true, page: null, strokes: save.draw.map((s) => ({ c: s.c, p: s.p.slice() })), undo: [], crayon: null, free: false };
    titleEl.textContent = "My Drawing";
    holder.setAttribute("aria-label", "A blank page to draw on");
    holder.innerHTML = drawSvg(st.strokes, false);
    pots.hidden = true;
    box.hidden = false;
    setDrawUi(true);
    for (const c of box.querySelectorAll(".color-crayon")) c.classList.remove("color-crayon--sel");
    pickCrayon(D.CRAYONS[6]); // a blue crayon is ready, so a first stroke just works
    paintDrawButtons();
    fit();
    play.__changedAt = now();
    later(() => { if (play && !play.hidden && st && st.draw) say(D.SAY.draw); }, 380);
  }
  function paintDrawButtons() {
    box.querySelector(".color-undo").disabled = !st.undo.length;
    box.querySelector(".color-clear").disabled = !st.strokes.length;
  }
  function saveDraw() {
    save.draw = st.strokes.map((s) => ({ c: s.c, p: s.p.slice() }));
    persist("draw");
    paintDrawButtons();
  }
  let pen = null; // the stroke under the finger: { s, el, id }
  function penDown(e) {
    if (!st || !st.draw || pen || e.isPrimary === false) return;
    if (now() - (play.__shownAt || -1e9) < ECHO_MS) return; // the echo of the tap that opened the page
    if (e.button != null && e.button > 0) return;
    if (st.strokes.length >= MAX_STROKES) return;
    const p = pageXY(e);
    const s = { c: isHex(st.crayon) ? st.crayon : D.CRAYONS[6], p: [r1(p.x), r1(p.y)] };
    const g = holder.querySelector(".cb-strokes");
    if (!g) return;
    g.insertAdjacentHTML("beforeend", strokePath(s));
    pen = { s, el: g.lastElementChild, id: e.pointerId };
    try { holder.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    e.preventDefault();
  }
  function penMove(e) {
    if (!pen || e.pointerId !== pen.id) return;
    const p = pageXY(e), a = pen.s.p, n = a.length;
    if (n >= MAX_PTS * 2) return;
    if (Math.hypot(p.x - a[n - 2], p.y - a[n - 1]) < 1.2) return;
    a.push(r1(p.x), r1(p.y));
    pen.el.setAttribute("d", strokeD(a));
  }
  function penUp(e) {
    if (!pen || (e && e.pointerId !== pen.id)) return;
    const s = pen.s;
    pen = null;
    st.strokes.push(s);
    st.undo.push("s");
    tone(SCALE[(st.strokes.length - 1) % SCALE.length], { duration: 0.12, type: "triangle", gain: 0.1 });
    saveDraw();
  }
  function undoDraw() {
    if (!st || !st.draw || !st.undo.length) return;
    const u = st.undo.pop();
    if (u === "s") st.strokes.pop(); else st.strokes = u.cleared;
    holder.innerHTML = drawSvg(st.strokes, false);
    fit();
    say(D.SAY.undo);
    saveDraw();
  }
  function clearDraw() {
    if (!st || !st.draw || !st.strokes.length) return;
    st.undo.push({ cleared: st.strokes });
    st.strokes = [];
    holder.innerHTML = drawSvg(st.strokes, false);
    fit();
    say(D.SAY.clear);
    saveDraw();
  }
  const r1 = (v) => Math.round(Math.max(-10, Math.min(210, v)) * 10) / 10;

  // ---- The first time: a ghost finger shows pot, then shape ---------------------
  let ghost = null;
  function showGhost() {
    hideGhost();
    if (!st || st.free || reduce()) return;
    const pot = pots.querySelector('.color-pot[data-n="' + st.sel + '"]');
    const i = hintTarget();
    if (!pot || i == null) return;
    const svg = holder.querySelector("svg"), r = svg.getBoundingClientRect(), pr = pot.getBoundingClientRect();
    const lab = st.g.labels[i];
    ghost = doc.createElement("div");
    ghost.className = "cb-ghost";
    ghost.setAttribute("aria-hidden", "true");
    ghost.textContent = "👆";
    // FIXED to the screen, in screen coordinates, with the fingertip (the top
    // middle of the glyph) on the target: an absolute finger on the bottom row
    // of pots hung below the page and made it 5px taller (CI's Safari caught it
    // on an iPad), which scrolls a page that must never scroll.
    const TIP = 24; // half the glyph's width at 3rem
    ghost.style.setProperty("--x0", pr.left + pr.width / 2 - TIP + "px");
    ghost.style.setProperty("--y0", pr.top + pr.height / 2 + "px");
    ghost.style.setProperty("--x1", r.left + (lab.x / L.W) * r.width - TIP + "px");
    ghost.style.setProperty("--y1", r.top + (lab.y / L.H) * r.height + "px");
    play.appendChild(ghost);
    later(hideGhost, 4200);
  }
  function hideGhost() { if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost); ghost = null; }

  function leavePlay() {
    clearLater();
    hideGhost();
    if (pen) penUp();
    // a replay cut short leaves the page half white: put his page back
    if (st && st.replaying) { st.replaying = false; play.classList.remove("color-play--replay"); draw(); }
  }

  // ---- Routing (main.js delegates #color-home and #color-play) ---------------------------
  const ColorBook = {
    route(id) {
      if (!home || !play) return false;
      if (id === "color-home") {
        if (!play.hidden) leavePlay();
        play.hidden = true;
        doc.body.classList.add("color-mode");
        doc.body.classList.remove("in-game");
        if (syncSave()) st = null; // another tab reset the book: nothing parked here survives it
        paintBook();
        home.hidden = false;
        home.__shownAt = now();
        global.scrollTo(0, 0);
        later(() => { if (!home.hidden) say("Pick a page to color!"); }, 300);
        return true;
      }
      if (id === "color-play") {
        home.hidden = true;
        doc.body.classList.add("color-mode");
        doc.body.classList.add("in-game");
        play.hidden = false;
        play.__shownAt = now();
        global.scrollTo(0, 0);
        const p = pending;
        pending = null;
        if (syncSave()) st = null;
        if (p) startPage(p, {});
        else if (!st) startPage(save.last, {});
        else if (!st.free && !st.draw) armHint(); // back on a half-painted page: the hint is armed again
        // A page started while this screen was hidden was never sized (fit()
        // needs the field's real box), so size it now it is on screen.
        fit();
        return true;
      }
      return false;
    },
    onLeave() {
      if (play && !play.hidden) leavePlay();
      else clearLater();
      if (doc.body) doc.body.classList.remove("color-mode");
    },
  };
  global.ColorBook = ColorBook;
  // Another tab reset the book: an open book here loses its ⭐ at once.
  global.addEventListener("storage", (e) => {
    if (e.key !== KEY || !syncSave()) return;
    if (home && !home.hidden) { st = null; paintBook(); }
  });

  // ---- Test hooks (the __SEEK / __HOLE precedent) ----------------------------------
  global.__COLOR = {
    state: () => (st && play && !play.hidden ? (st.draw ? { page: "draw", draw: true, crayon: st.crayon, strokes: st.strokes.length, undo: st.undo.length }
      : { page: st.page.id, sel: st.sel, done: [...st.done], free: st.free, crayon: st.crayon, replaying: !!st.replaying, fills: Object.assign({}, st.fills) }) : null),
    hint: () => hint(),
    hintMs: HINT_MS,
    save: () => JSON.parse(JSON.stringify(save)),
    reset() { resetProgress(); },
    start(id, opts) { startPage(id, opts || {}); return !!st; },
    // where on the screen region i's number sits (to tap it like a finger)
    pointOf(i) {
      const svg = holder && holder.querySelector("svg");
      if (!svg || !st || !st.page) return null;
      const r = svg.getBoundingClientRect(), lab = st.g.labels[i];
      return { x: r.left + (lab.x / L.W) * r.width, y: r.top + (lab.y / L.H) * r.height };
    },
    // the numbered regions still to paint, in the order a child would
    todo: () => (st && st.page ? L.numbered(st.page).filter((i) => !st.done.has(i)).map((i) => ({ i, n: st.page.regions[i].n })) : []),
    timers: () => timers.size,
    ghost: () => !!(ghost && ghost.parentNode),
    // draw a stroke through page points [[x, y], …] (as a finger would)
    stroke(pts) {
      if (!st || !st.draw || !pts.length) return false;
      st.strokes.push({ c: st.crayon || D.CRAYONS[6], p: pts.flatMap((q) => [r1(q[0]), r1(q[1])]) });
      st.undo.push("s");
      holder.innerHTML = drawSvg(st.strokes, false);
      fit();
      saveDraw();
      return true;
    },
  };

  try { build(); } catch (e) { console.error("Color Book: build failed:", e); }
  // The front door's tile wears a finished page: the rocket, colored in.
  try {
    const mark = doc.querySelector("#start-color .start-tile__art");
    const p = pageOf("rocket");
    if (mark && p) {
      const fills = {};
      p.regions.forEach((reg, i) => { if (reg.n) fills[i] = colorOf(p, reg.n).hex; });
      mark.innerHTML = L.pageSvg(p, { fills, thumb: true, shade: true, cls: "cb-thumb cb-logo" });
    }
  } catch (e) { /* the emoji fallback stays */ }
})(typeof window !== "undefined" ? window : globalThis);
