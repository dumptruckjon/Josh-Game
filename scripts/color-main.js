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
  // demo: the ghost finger has been shown · last.
  function freshSave() { return { v: 1, stars: {}, runs: {}, art: {}, demo: false, last: PAGES[0].id }; }
  const pageOf = (id) => PAGES.find((p) => p.id === id) || null;
  const nat = (n) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
  const isHex = (h) => typeof h === "string" && /^#[0-9a-f]{6}$/i.test(h);
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
      for (const k of Object.keys(a)) { const i = +k; if (Number.isInteger(i) && p.regions[i] && p.regions[i].n && isHex(a[k])) out[i] = a[k]; }
      s.art[id] = out;
    }
    s.demo = raw.demo === true;
    if (pageOf(raw.last)) s.last = raw.last;
    return s;
  }
  function readStored() { try { return global.localStorage.getItem(KEY); } catch (e) { return null; } }
  let save = coerce(readStored());
  // Two tabs: ⭐ only grow, so a write folds in what the other tab stored.
  function persist() {
    const disk = coerce(readStored());
    for (const id of Object.keys(disk.stars)) save.stars[id] = Math.max(save.stars[id] || 0, disk.stars[id]);
    save.demo = save.demo || disk.demo;
    try { global.localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* private mode: play on */ }
  }

  // ---- Sound: through JoshAudio only, and only while a screen of ours is up ---
  function audioOK() { const a = global.JoshAudio; return !!a && !a.isMuted(); }
  function visible() { return (!!play && !play.hidden && !doc.hidden) || (!!home && !home.hidden && !doc.hidden); }
  function say(text) { if (audioOK() && text && visible()) global.JoshAudio.say(text); }
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
    for (const f of doc.querySelectorAll(".cb-ghost")) f.parentNode.removeChild(f);
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
      '<div class="color-pages" role="list" aria-label="Pick a page to color"></div>';
    screens.appendChild(home);
    home.querySelector(".color-exit").addEventListener("click", () => { location.hash = ""; });
    home.querySelector(".color-homehear").addEventListener("click", () => say("Pick a page to color!"));
    const grid = home.querySelector(".color-pages");
    for (const p of PAGES) {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "color-page tap";
      b.dataset.page = p.id;
      b.setAttribute("role", "listitem");
      b.innerHTML = '<span class="color-page__pic" aria-hidden="true"></span><span class="color-page__num" aria-hidden="true">' + p.level + '</span><span class="color-page__star" aria-hidden="true"></span>';
      b.addEventListener("click", () => openPage(p.id));
      grid.appendChild(b);
    }
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
          '<button class="btn-big color-next" type="button" aria-label="Next page">▶</button>' +
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
      if (st.free) { say(D.SAY.paint); return; }
      say(D.SAY.open(st.page) + " " + D.SAY.how);
      showGhost();
    });
    box.querySelector(".color-again").addEventListener("click", () => { if (st) startPage(st.page.id, { fresh: true }); });
    box.querySelector(".color-next").addEventListener("click", () => { if (st) startPage(nextPage(st.page.id), {}); });
    holder.addEventListener("click", onTap);
    const crayons = box.querySelector(".color-crayons");
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

  function paintBook() {
    const sug = suggested();
    for (const b of home.querySelectorAll(".color-page")) {
      const p = pageOf(b.dataset.page);
      const n = save.stars[p.id] || 0, painting = !!save.runs[p.id];
      b.querySelector(".color-page__pic").innerHTML = L.pageSvg(p, { fills: fillsFor(p), thumb: true, shade: n > 0 && !painting, cls: "cb-thumb" });
      b.querySelector(".color-page__star").textContent = n ? "⭐" : "";
      b.classList.toggle("color-page--done", n > 0);
      b.classList.toggle("color-page--next", p.id === sug);
      b.setAttribute("aria-label", "Page " + p.level + ": " + p.name + (n ? ", colored" : painting ? ", started" : ""));
    }
  }

  // ---- A page -----------------------------------------------------------------------
  function openPage(id) { pending = id; location.hash = "#color-play"; }

  function startPage(id, opts) {
    const page = pageOf(id) || PAGES[0];
    clearLater();
    if (opts && opts.fresh) { delete save.runs[page.id]; delete save.art[page.id]; }
    const g = geo(page);
    const finished = save.stars[page.id] > 0 && !save.runs[page.id] && !(opts && opts.fresh);
    st = { page, g, done: new Set(finished ? L.numbered(page) : save.runs[page.id] || []), sel: null, free: false, crayon: null, fills: {} };
    for (const i of st.done) st.fills[i] = colorOf(page, page.regions[i].n).hex;
    save.last = page.id;
    persist();
    titleEl.textContent = page.name;
    holder.setAttribute("aria-label", "A coloring page: " + page.name);
    if (finished) { enterFree(true); return; }
    st.sel = L.nextColor(page, st.done, page.colors[page.colors.length - 1].n);
    draw();
    drawPots();
    box.hidden = true;
    pots.hidden = false;
    fit();
    later(() => {
      if (!play || play.hidden) return;
      say(st.done.size ? D.SAY.pick(colorOf(page, st.sel)) : D.SAY.open(page) + " " + D.SAY.how);
      if (!save.demo) showGhost();
    }, 380);
  }

  function draw() {
    const opts = { fills: st.fills, labels: st.free ? null : st.g.labels };
    if (st.free) opts.shade = true;
    holder.innerHTML = L.pageSvg(st.page, opts);
    const svg = holder.querySelector("svg");
    svg.insertAdjacentHTML("afterbegin", "<defs></defs>");
    fit();
    markWanted();
  }
  // The page is as big a square as the field allows.
  function fit() {
    const svg = holder && holder.querySelector("svg");
    if (!svg || !field || play.hidden) return;
    const side = Math.max(0, Math.floor(Math.min(field.clientWidth, field.clientHeight)));
    svg.style.width = side + "px";
    svg.style.height = side + "px";
  }
  // The shapes waiting for the chosen color shimmer with a light tint of it.
  function markWanted() {
    const svg = holder.querySelector("svg");
    if (!svg) return;
    const c = !st.free && st.sel ? colorOf(st.page, st.sel) : null;
    if (c) svg.style.setProperty("--want", L.tint(c.hex, 0.62));
    for (const el of svg.querySelectorAll("path.cb-num")) {
      const i = +el.dataset.i;
      el.classList.toggle("cb-want", !!c && !st.done.has(i) && +el.dataset.n === st.sel);
    }
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
  function pickColor(n, spoken) {
    if (!st || st.free) return;
    const c = colorOf(st.page, n);
    st.sel = n;
    paintPots();
    markWanted();
    const pot = pots.querySelector('.color-pot[data-n="' + n + '"]');
    if (pot) { bounce(pot, "color-pot--pop"); showInRow(pots, pot); }
    if (spoken) say(D.SAY.pick(c));
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
    if (!st) return;
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
    const lab = holder.querySelector('text[data-for="' + i + '"]');
    if (lab) lab.parentNode.removeChild(lab);
    hideGhost();
    if (!save.demo) { save.demo = true; }
    tone(SCALE[(st.done.size - 1) % SCALE.length], { duration: 0.16, type: "triangle", gain: 0.14 });
    save.runs[page.id] = [...st.done];
    persist();
    markWanted();
    const left = L.remaining(page, st.done);
    if (L.finished(page, st.done)) { paintPots(left); finish(); return; }
    if (left[n] === 0) {
      paintPots(left);
      const pot = pots.querySelector('.color-pot[data-n="' + n + '"]');
      if (pot) bounce(pot, "color-pot--cheer");
      cue("goodCue");
      say(D.SAY.colorDone(c));
      // the next pot is chosen at once (a quick tap on a shape of the next color
      // must work), and said a beat after the cheer
      const nx = L.nextColor(page, st.done, n);
      play.__changedAt = now();
      if (nx) { pickColor(nx, false); later(() => { if (st && !st.free && st.sel === nx) say(D.SAY.pick(colorOf(page, nx))); }, 900); }
    } else paintPots(left);
  }

  // The paint spreads out from the finger: a circle growing inside the shape.
  function spread(i, hex, p) {
    const svg = holder.querySelector("svg");
    const path = svg && svg.querySelector('path[data-i="' + i + '"]');
    if (!path) return;
    if (reduce()) { path.setAttribute("fill", hex); path.classList.remove("cb-want"); return; }
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
    circ.setAttribute("fill", hex);
    circ.setAttribute("clip-path", "url(#" + id + ")");
    circ.setAttribute("pointer-events", "none");
    path.parentNode.insertBefore(circ, path.nextSibling);
    let far = 0;
    for (const q of st.page.regions[i].pts) far = Math.max(far, Math.hypot(q[0] - p.x, q[1] - p.y));
    const t0 = now(), DUR = 320;
    const end = () => {
      path.setAttribute("fill", hex);
      path.classList.remove("cb-want");
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

  function wrong(i) {
    const reg = st.page.regions[i];
    const lab = holder.querySelector('text[data-for="' + i + '"]');
    if (lab) bounceSvg(lab, "cb-label--nudge");
    const pot = pots.querySelector('.color-pot[data-n="' + reg.n + '"]');
    if (pot) bounce(pot, "color-pot--wiggle");
    say(reg.sum ? D.SAY.wrongSum(reg.sum[0], reg.sum[1], reg.n) : D.SAY.wrong(reg.n));
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
    delete save.runs[page.id];
    delete save.art[page.id];
    persist();
    cue("winCue");
    say(D.SAY.done(page));
    say(page.cheer);
    try { if (global.JoshEffects && play && !play.hidden) global.JoshEffects.confetti(); } catch (e) { /* ignore */ }
    later(() => { if (st && st.page === page) enterFree(false); }, reduce() ? 0 : 420);
  }

  function enterFree(restored) {
    st.free = true;
    st.crayon = null;
    const art = save.art[st.page.id] || {};
    for (const i of L.numbered(st.page)) st.fills[i] = art[i] || colorOf(st.page, st.page.regions[i].n).hex;
    draw();
    comeAlive();
    pots.hidden = true;
    box.hidden = false;
    fit();
    play.__changedAt = now();
    for (const c of box.querySelectorAll(".color-crayon")) c.classList.remove("color-crayon--sel");
    const nx = pageOf(nextPage(st.page.id));
    const next = box.querySelector(".color-next");
    next.innerHTML = "▶ " + '<span class="color-next__pic" aria-hidden="true">' + L.pageSvg(nx, { thumb: true, cls: "cb-thumb" }) + "</span>";
    next.setAttribute("aria-label", "Next page: " + nx.name);
    if (restored) later(() => { if (play && !play.hidden) say(D.SAY.paint); }, 380);
    else later(() => { if (st && st.free) say(D.SAY.paint); }, 1800);
  }

  function comeAlive() {
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

  function pickCrayon(hex) {
    if (!st || !st.free) return;
    st.crayon = hex;
    for (const c of box.querySelectorAll(".color-crayon")) {
      const on = c.dataset.crayon === hex;
      c.classList.toggle("color-crayon--sel", on);
      c.setAttribute("aria-pressed", on ? "true" : "false");
    }
    tone(660, { duration: 0.1, type: "sine", gain: 0.1 });
  }
  function freeTap(p) {
    if (!st.crayon) { const first = box.querySelector(".color-crayon"); if (first) bounce(first, "color-pot--wiggle"); return; }
    const page = st.page;
    // any shape with a number can be recolored (the fixed eyes and hubs stay)
    const i = L.ownerAt(st.g.r, p.x, p.y);
    if (i < 0 || !page.regions[i].n) return;
    st.fills[i] = st.crayon;
    if (!save.art[page.id]) save.art[page.id] = {};
    save.art[page.id][i] = st.crayon;
    persist();
    spread(i, st.crayon, p);
    tone(SCALE[i % SCALE.length], { duration: 0.14, type: "triangle", gain: 0.12 });
  }

  // ---- The first time: a ghost finger shows pot, then shape ---------------------
  let ghost = null;
  function showGhost() {
    hideGhost();
    if (!st || st.free || reduce()) return;
    const pot = pots.querySelector('.color-pot[data-n="' + st.sel + '"]');
    const i = [...L.numbered(st.page)].find((k) => !st.done.has(k) && st.page.regions[k].n === st.sel);
    if (!pot || i == null) return;
    const svg = holder.querySelector("svg"), r = svg.getBoundingClientRect(), pr = pot.getBoundingClientRect(), fr = play.getBoundingClientRect();
    const lab = st.g.labels[i];
    ghost = doc.createElement("div");
    ghost.className = "cb-ghost";
    ghost.setAttribute("aria-hidden", "true");
    ghost.textContent = "👆";
    ghost.style.setProperty("--x0", pr.left + pr.width / 2 - fr.left + "px");
    ghost.style.setProperty("--y0", pr.top + pr.height / 2 - fr.top + "px");
    ghost.style.setProperty("--x1", r.left + (lab.x / L.W) * r.width - fr.left + "px");
    ghost.style.setProperty("--y1", r.top + (lab.y / L.H) * r.height - fr.top + "px");
    play.appendChild(ghost);
    later(hideGhost, 4200);
  }
  function hideGhost() { if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost); ghost = null; }

  function leavePlay() { clearLater(); hideGhost(); }

  // ---- Routing (main.js delegates #color-home and #color-play) ---------------------------
  const ColorBook = {
    route(id) {
      if (!home || !play) return false;
      if (id === "color-home") {
        if (!play.hidden) leavePlay();
        play.hidden = true;
        doc.body.classList.add("color-mode");
        doc.body.classList.remove("in-game");
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
        if (p) startPage(p, {});
        else if (!st) startPage(save.last, {});
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

  // ---- Test hooks (the __SEEK / __HOLE precedent) ----------------------------------
  global.__COLOR = {
    state: () => (st && play && !play.hidden ? { page: st.page.id, sel: st.sel, done: [...st.done], free: st.free, crayon: st.crayon } : null),
    save: () => JSON.parse(JSON.stringify(save)),
    reset() { save = freshSave(); st = null; try { global.localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } },
    start(id, opts) { startPage(id, opts || {}); return !!st; },
    // where on the screen region i's number sits (to tap it like a finger)
    pointOf(i) {
      const svg = holder && holder.querySelector("svg");
      if (!svg || !st) return null;
      const r = svg.getBoundingClientRect(), lab = st.g.labels[i];
      return { x: r.left + (lab.x / L.W) * r.width, y: r.top + (lab.y / L.H) * r.height };
    },
    // the numbered regions still to paint, in the order a child would
    todo: () => (st ? L.numbered(st.page).filter((i) => !st.done.has(i)).map((i) => ({ i, n: st.page.regions[i].n })) : []),
    timers: () => timers.size,
    ghost: () => !!(ghost && ghost.parentNode),
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
