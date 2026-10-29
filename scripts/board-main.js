// 🎲 Game Night — the world's shell (PLAN_BOARD.md §3, §5). main.js delegates
// every board-* hash here. This file builds the screens (the shelf, who's
// playing, the board), runs the SHARED TURN ROUTINE every box uses, plays the
// computer friend at a counting pace, says the lines, keeps the save and
// exposes window.__BOARD for the browser tests. The engine (board-logic.js)
// decides every move; nothing here computes one.
//
// Josh's kid laws are fully ON: every control is >= 75px and 16px from its
// neighbour, nothing fails, nothing times out on HIM (the computer's pace is
// the only clock), extra fingers are ignored, and every step reads with sound
// off.

(function (global) {
  "use strict";
  const doc = global.document;
  const DATA = global.BoardData, L = global.BoardLogic, R = global.BoardRender;
  if (!doc || !DATA || !L || !R) return;
  const SAY = DATA.SAY;
  const KEY = "josh-board-v1";
  // A double-tap is a PLACE and a TIME (the framework's echo guard): a screen
  // that has just appeared ignores a finger for this long.
  const ECHO_MS = 350;
  // A game in progress waits on its box until the next day (decision 9).
  const KEEP_MS = 24 * 60 * 60 * 1000;
  // The pace of everything that is NOT his finger: the dice tumbling, a hop,
  // a ride, the hand-over, and the computer friend's turn.
  const T = { tumble: 700, hop: 240, autoHop: 480, cpuThink: 900, cpuHop: 560, ride: 900, card: 520, glide: 300, handoff: 700, pop: 700, cheer: 1400, tip: 1000 };
  const now = () => (global.performance && global.performance.now ? global.performance.now() : Date.now());
  const $ = (sel, root) => (root || doc).querySelector(sel);
  const fill = (line, o) => String(line).replace(/\{(\w+)\}/g, (m, k) => (o && o[k] != null ? o[k] : m));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---- The save -------------------------------------------------------------
  // games: the game in progress per box ({ st, at }) · done: games finished per
  // box · intro: whether he has been shown how (dice / cards) · auto: the
  // grown-up "hop by itself" switch · next: who starts the next two-person
  // game per box · last: the last box and its players.
  function freshSave() { return { v: 1, games: {}, done: {}, intro: { dice: false, cards: false, spin: false }, auto: false, next: {}, last: null }; }
  const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  function coerce(text) {
    const s = freshSave();
    let raw = null;
    try { raw = JSON.parse(text); } catch (e) { raw = null; }
    if (!isObj(raw) || raw.v !== 1) return s;
    if (isObj(raw.games)) {
      for (const [box, g] of Object.entries(raw.games)) {
        if (!DATA.box(box) || !isObj(g) || typeof g.at !== "number") continue;
        if (Date.now() - g.at > KEEP_MS || g.at > Date.now() + 60000) continue;  // stale, or from the future
        const st = L.restore(g.st);
        if (st && st.phase !== "done" && st.board === DATA.box(box).board) s.games[box] = { st, at: g.at };
      }
    }
    if (isObj(raw.done)) for (const [box, n] of Object.entries(raw.done)) if (DATA.box(box) && Number.isInteger(n) && n > 0) s.done[box] = n;
    if (isObj(raw.intro)) { s.intro.dice = raw.intro.dice === true; s.intro.cards = raw.intro.cards === true; s.intro.spin = raw.intro.spin === true; }
    s.auto = raw.auto === true;
    if (isObj(raw.next)) for (const [box, n] of Object.entries(raw.next)) if (DATA.box(box) && (n === 0 || n === 1)) s.next[box] = n;
    if (isObj(raw.last) && DATA.box(raw.last.box) && DATA.person(raw.last.who) && typeof raw.last.cpu === "boolean") {
      s.last = { box: raw.last.box, who: raw.last.who, cpu: raw.last.cpu };
    }
    return s;
  }
  function readStored() { try { return global.localStorage.getItem(KEY); } catch (e) { return null; } }
  let save = coerce(readStored());
  // Two tabs share one save, and neither may wipe the other's. A game in
  // progress belongs to the tab that last played that box (`own`); every
  // other box is taken from what is stored, present OR absent, so a game the
  // other tab started is kept and one it finished is not brought back. A
  // finished game counts once in whichever tab finished it: this tab's own
  // finishes since its last write (`added`) are ADDED to what is stored,
  // never folded as a max (two tabs finishing one game each is two).
  // "Has been shown how" only ever grows.
  const own = new Set();
  let added = {};
  function syncSave() {
    const disk = coerce(readStored());
    for (const box of Object.keys(save.games)) if (!own.has(box) && !disk.games[box]) delete save.games[box];
    for (const [box, g] of Object.entries(disk.games)) if (!own.has(box)) save.games[box] = g;
    for (const [box, n] of Object.entries(disk.done)) save.done[box] = Math.max(save.done[box] || 0, n + (added[box] || 0));
    save.intro.dice = save.intro.dice || disk.intro.dice;
    save.intro.cards = save.intro.cards || disk.intro.cards;
    save.intro.spin = save.intro.spin || disk.intro.spin;
  }
  function persist() {
    syncSave();
    added = {};
    try { global.localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* private mode: play on */ }
  }

  // ---- Timers that die with the screen ---------------------------------------
  const timers = new Set();
  function later(fn, ms) {
    const id = global.setTimeout(() => { timers.delete(id); try { fn(); } catch (e) { /* never break the page */ } }, ms);
    timers.add(id);
    return id;
  }
  function clearLater() { for (const id of timers) global.clearTimeout(id); timers.clear(); }
  function cancelLater(id) { if (id != null) { global.clearTimeout(id); timers.delete(id); } }

  // ---- Sound: every note and line through JoshAudio (mute-gated) -------------
  function audioOK() { const a = global.JoshAudio; return !!a && !a.isMuted(); }
  function say(text) { const a = global.JoshAudio; if (a && text && !a.isMuted()) a.say(text); }
  function sayPlay(text) { if (playVisible()) say(text); }
  function tone(f, o) { if (audioOK() && playVisible()) global.JoshAudio.tone(f, o); }
  function notes(seq) { for (const n of seq) { if (!n[1]) tone(n[0], n[2]); else later(() => tone(n[0], n[2]), n[1]); } }
  const SFX = {
    tick: () => tone(1320, { type: "square", duration: 0.03, gain: 0.05, plain: true }),
    thunk: () => tone(330, { type: "triangle", duration: 0.12, gain: 0.16 }),
    hop: (k) => tone(523.25 * Math.pow(2, (k % 8) / 12), { type: "triangle", duration: 0.12, gain: 0.15 }),
    boost: () => notes([[523.25, 0], [659.25, 110], [783.99, 220], [1046.5, 330, { duration: 0.4 }]]),
    comet: () => notes([[880, 0, { type: "sine" }], [740, 90, { type: "sine" }], [622, 180, { type: "sine" }], [523.25, 270, { type: "sine", duration: 0.35 }]]),
    flip: () => notes([[784, 0, { duration: 0.1 }], [1175, 80, { duration: 0.2 }]]),
    glide: () => tone(988, { type: "sine", duration: 0.07, gain: 0.08 }),
    whoosh: () => tone(392, { type: "sine", duration: 0.25, gain: 0.08 }),
    home: () => notes([[523.25, 0], [659.25, 120], [783.99, 240], [1046.5, 360, { duration: 0.6 }]]),
    wiggle: () => tone(246.94, { type: "sine", duration: 0.18, gain: 0.12 }),
    plop: (k) => tone(392 * Math.pow(2, (k % 10) / 12), { type: "sine", duration: 0.14, gain: 0.16 }),
    tweet: () => notes([[1568, 0, { type: "sine", duration: 0.08 }], [1976, 90, { type: "sine", duration: 0.08 }], [1568, 180, { type: "sine", duration: 0.1 }]]),
    pie: () => notes([[659.25, 0], [880, 100, { duration: 0.25 }]]),
  };

  // ---- The screens -----------------------------------------------------------
  let shelf = null, who = null, pick = null, play = null;
  let boardEl = null, svgWrap = null, tokens = [null, null], pads = [null, null], hand = null, party = null;
  let applesEl = null, popEl = null, markEl = null;
  let whoBox = null, pickMode = null;   // which box the who/pick screens are for

  const bar = (cls, backLabel, backIcon, title) =>
    '<div class="game__bar bn-bar">' +
      '<button class="btn-round game__home ' + cls + '" type="button" aria-label="' + backLabel + '">' + backIcon + "</button>" +
      '<h1 class="game__title bn-title">' + title + "</h1>" +
      '<button class="btn-round game__hear bn-hear" type="button" aria-label="Hear it again">👂</button>' +
    "</div>";

  function section(id, cls, html) {
    const s = doc.createElement("section");
    s.id = id;
    s.className = "screen bn-screen " + cls;
    s.hidden = true;
    s.innerHTML = html;
    $("#screens").appendChild(s);
    guardEcho(s);
    return s;
  }

  function build() {
    if (!$("#screens") || $("#screen-board-home")) return;
    shelf = section("screen-board-home", "bn-home",
      bar("bn-exit", "Back to the front door", "🚪", "Game Night") +
      '<div class="bn-boxes" role="list" aria-label="Pick a game"></div>' +
      // Grown-ups only, small and quiet AFTER the last box (never between
      // boxes): hops by tap (the default — every tap is one hop, one number)
      // or by themselves for a tired evening. Not destructive, so no gate.
      '<button class="reset-stars bn-auto" type="button" data-adult="1" aria-pressed="false">Grown-ups: hops by tap</button>');
    shelf.querySelector(".bn-exit").addEventListener("click", () => { location.hash = ""; });
    shelf.querySelector(".bn-hear").addEventListener("click", () => say(SAY.shelf));
    shelf.querySelector(".bn-auto").addEventListener("click", () => {
      save.auto = !save.auto;
      persist();
      paintShelf();
    });

    who = section("screen-board-who", "bn-who",
      bar("bn-whoback", "Back to the games", "🏠", "") +
      '<button class="bn-keep tap" type="button" hidden></button>' +
      '<div class="bn-modes" role="list">' +
        '<button class="bn-mode bn-mode--cpu tap" type="button" role="listitem" data-mode="cpu" aria-label="' + SAY.cpu + '">' +
          '<span class="bn-mode__pic" aria-hidden="true"><span class="bn-tablet">🙂</span></span>' +
          '<span class="bn-mode__label">a friend in the iPad</span></button>' +
        '<button class="bn-mode bn-mode--here tap" type="button" role="listitem" data-mode="here" aria-label="' + SAY.here + '">' +
          '<span class="bn-mode__pic" aria-hidden="true">🙋</span>' +
          '<span class="bn-mode__label">a friend here with me</span></button>' +
      "</div>");
    who.querySelector(".bn-whoback").addEventListener("click", () => { location.hash = "#board-home"; });
    who.querySelector(".bn-hear").addEventListener("click", () => say(SAY.who));
    for (const b of who.querySelectorAll(".bn-mode")) {
      b.addEventListener("click", () => { location.hash = "#board-pick-" + whoBox + "-" + b.dataset.mode; });
    }
    who.querySelector(".bn-keep").addEventListener("click", () => {
      if (save.games[whoBox]) { pending = { box: whoBox, resume: true }; location.hash = "#board-play"; }
    });

    pick = section("screen-board-pick", "bn-pick",
      bar("bn-pickback", "Back", "🏠", "") +
      '<div class="bn-people" role="list" aria-label="Who is playing with you?"></div>');
    pick.querySelector(".bn-pickback").addEventListener("click", () => { location.hash = "#board-who-" + whoBox; });
    pick.querySelector(".bn-hear").addEventListener("click", () => say(SAY.who));

    play = section("screen-board-play", "bn-play",
      bar("bn-playback", "Back to the games", "🏠", "") +
      '<div class="bn-field">' +
        '<div class="bn-board" role="img">' +
          '<div class="bn-svgwrap"></div>' +
          // 🌈 the square a card sends you to, ringed until you get there
          '<div class="bn-mark" aria-hidden="true" hidden></div>' +
          // 🍎 the apples that move (in the baskets, the pie, and flying)
          '<div class="bn-apples" aria-hidden="true"></div>' +
          '<div class="bn-token bn-token--0" aria-hidden="true"><span class="bn-token__face"></span></div>' +
          '<div class="bn-token bn-token--1" aria-hidden="true"><span class="bn-token__face"></span></div>' +
          // the number of the square just reached (or the apples in the
          // basket): he counts with it when the sound is off
          '<div class="bn-pop" aria-hidden="true" hidden></div>' +
        "</div>" +
        '<div class="bn-party" role="dialog" aria-label="Everyone is home!" hidden>' +
          '<div class="bn-party__box">' +
            // each player dances over the ⭐ they collected on the way
            '<div class="bn-party__faces" aria-hidden="true">' +
              '<span class="bn-party__who"><span class="bn-party__face"></span><span class="bn-party__haul"></span></span>' +
              '<span class="bn-party__who"><span class="bn-party__face"></span><span class="bn-party__haul"></span></span>' +
            "</div>" +
            '<div class="bn-party__row">' +
              '<button class="btn-big bn-again" type="button" aria-label="Play again">🔁</button>' +
              '<button class="btn-big bn-shelf" type="button" aria-label="Back to the games">🏠</button>' +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>" +
      '<div class="bn-tray">' +
        '<button class="bn-pad bn-pad--0" type="button" data-seat="0"><span class="bn-pad__face" aria-hidden="true"></span><span class="bn-pad__act" aria-hidden="true"></span><span class="bn-pad__stars" aria-hidden="true"></span><span class="bn-pad__help" aria-hidden="true" hidden></span><span class="bn-pad__cheer" aria-hidden="true" hidden>🎉</span></button>' +
        '<button class="bn-pad bn-pad--1" type="button" data-seat="1"><span class="bn-pad__face" aria-hidden="true"></span><span class="bn-pad__act" aria-hidden="true"></span><span class="bn-pad__stars" aria-hidden="true"></span><span class="bn-pad__help" aria-hidden="true" hidden></span><span class="bn-pad__cheer" aria-hidden="true" hidden>🎉</span></button>' +
      "</div>" +
      '<div class="bn-hand" aria-hidden="true" hidden>👆</div>');
    boardEl = play.querySelector(".bn-board");
    svgWrap = play.querySelector(".bn-svgwrap");
    tokens = [...play.querySelectorAll(".bn-token")];
    pads = [...play.querySelectorAll(".bn-pad")];
    hand = play.querySelector(".bn-hand");
    party = play.querySelector(".bn-party");
    applesEl = play.querySelector(".bn-apples");
    popEl = play.querySelector(".bn-pop");
    markEl = play.querySelector(".bn-mark");
    play.querySelector(".bn-playback").addEventListener("click", () => { location.hash = "#board-home"; });
    play.querySelector(".bn-hear").addEventListener("click", () => { hint(true); });
    party.querySelector(".bn-again").addEventListener("click", () => { if (game) newGame(game.box, game.friend, game.cpu); });
    party.querySelector(".bn-shelf").addEventListener("click", () => { location.hash = "#board-home"; });
    for (const p of pads) {
      p.addEventListener("pointerdown", unlockAudio);
      p.addEventListener("click", () => padTap(Number(p.dataset.seat)));
    }
    play.__onHide = leavePlay;
    global.addEventListener("resize", () => { if (playVisible()) layout(); });
    global.addEventListener("storage", (e) => {
      if (e.key !== KEY) return;
      syncSave();
      if (shelf && !shelf.hidden) paintShelf();
    });
  }
  function unlockAudio() { try { if (global.JoshAudio && !global.JoshAudio.isMuted()) global.JoshAudio.unlock(); } catch (e) { /* ignore */ } }

  function guardEcho(el) {
    el.addEventListener("click", (e) => {
      const finger = e.isTrusted && e.detail !== 0;
      if (!finger) return;
      const since = now() - (el.__shownAt || -1e9);
      const partySince = party && !party.hidden && party.contains(e.target) ? now() - (party.__shownAt || -1e9) : 1e9;
      if (since < ECHO_MS || partySince < ECHO_MS) { e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);
  }

  // ---- The shelf ---------------------------------------------------------------
  // A box appears once its `unlockAfter` is met — never a padlock.
  function boxOpen(b) { return !b.unlockAfter || (save.done[b.unlockAfter.box] || 0) >= b.unlockAfter.games; }
  function paintShelf() {
    const list = shelf.querySelector(".bn-boxes");
    list.innerHTML = "";
    const open = DATA.BOXES.filter(boxOpen);
    // An even shelf of four or more stands in two columns: four full-width
    // rows put the last box below the fold of a 320x568 phone. An odd shelf
    // keeps one column, so no row is ragged.
    list.dataset.cols = open.length >= 4 && open.length % 2 === 0 ? "2" : "1";
    for (const b of open) {
      const btn = doc.createElement("button");
      btn.className = "bn-box tap";
      btn.type = "button";
      btn.setAttribute("role", "listitem");
      btn.dataset.box = b.id;
      btn.style.borderBottomColor = b.colour;
      const g = save.games[b.id], played = save.done[b.id] || 0;
      btn.setAttribute("aria-label", b.name + (played ? ", played " + played + (played === 1 ? " time" : " times") : "") + (g ? ", a game is waiting" : ""));
      btn.innerHTML = '<span class="bn-box__pic" aria-hidden="true">' + b.pic + "</span>" +
        // every game finished here earns the box a 🏆 — he sees the pile grow
        (played ? '<span class="bn-box__won" aria-hidden="true">🏆 ' + played + "</span>" : "") +
        '<span class="bn-box__label">' + b.name + "</span>" +
        // a game waiting on this box shows its two players peeking out
        (g ? '<span class="bn-box__wait" aria-hidden="true">' + g.st.seats.map((s) => '<span class="bn-box__peek">' + R.faceHTML(DATA.person(s.who)) + "</span>").join("") + "</span>" : "");
      btn.addEventListener("click", () => { location.hash = "#board-who-" + b.id; });
      list.appendChild(btn);
    }
    const auto = shelf.querySelector(".bn-auto");
    auto.textContent = save.auto ? "Grown-ups: hops by themselves" : "Grown-ups: hops by tap";
    auto.setAttribute("aria-pressed", save.auto ? "true" : "false");
  }

  // ---- Who's playing -------------------------------------------------------------
  function paintWho() {
    const b = DATA.box(whoBox);
    who.querySelector(".bn-title").textContent = b.name;
    const keep = who.querySelector(".bn-keep");
    const g = save.games[whoBox];
    keep.hidden = !g;
    if (g) {
      keep.innerHTML = '<span class="bn-keep__go" aria-hidden="true">▶</span>' +
        g.st.seats.map((s) => '<span class="bn-keep__face">' + R.faceHTML(DATA.person(s.who)) + "</span>").join("");
      keep.setAttribute("aria-label", SAY.keepGoing + " " + g.st.seats.map((s) => DATA.person(s.who).say).join(" and "));
    }
  }
  function paintPick() {
    const b = DATA.box(whoBox);
    pick.querySelector(".bn-title").textContent = b.name;
    const list = pick.querySelector(".bn-people");
    list.innerHTML = "";
    const cpu = pickMode === "cpu";
    const people = cpu ? DATA.FRIENDS : DATA.PEOPLE;
    list.dataset.n = String(people.length);
    for (const p of people) {
      const btn = doc.createElement("button");
      btn.className = "bn-person tap" + (cpu ? " bn-person--cpu" : "");
      btn.type = "button";
      btn.setAttribute("role", "listitem");
      btn.dataset.who = p.id;
      btn.setAttribute("aria-label", p.say + (cpu ? " in the iPad" : ""));
      btn.innerHTML = '<span class="bn-person__face' + (cpu ? " bn-tablet" : "") + '" aria-hidden="true">' + R.faceHTML(p) + "</span>" +
        '<span class="bn-person__label">' + p.say + "</span>";
      btn.addEventListener("click", () => {
        newGame(whoBox, p.id, cpu);
      });
      list.appendChild(btn);
    }
  }

  // ---- A game ------------------------------------------------------------------
  // game: { box, friend, cpu, st, board, busy, hopLock }
  let game = null, pending = null;
  function playVisible() { return !!play && !play.hidden && !doc.hidden; }
  function seatPerson(i) { return DATA.person(game.st.seats[i].who); }
  const nameOf = (i) => seatPerson(i).say;

  function newGame(box, friend, cpu) {
    const b = DATA.box(box);
    // Josh starts against the computer; two people take turns starting
    const first = cpu ? 0 : (save.next[box] || 0);
    if (!cpu) save.next[box] = first ? 0 : 1;
    const seed = (Date.now() ^ Math.floor(now() * 1000)) >>> 0;
    // the 🐦 joins Apple Spin from his third game there (as the comets do)
    const birds = b.birdsAfter != null && (save.done[box] || 0) >= b.birdsAfter;
    const st = L.create({ board: b.board, seats: [{ who: "josh" }, { who: friend, cpu }], seed, first, birds });
    save.last = { box, who: friend, cpu };
    save.games[box] = { st: L.snapshot(st), at: Date.now() };
    own.add(box);
    persist();
    pending = { box, st };
    if (location.hash === "#board-play") startPending(); else location.hash = "#board-play";
  }

  function startPending() {
    const p = pending;
    pending = null;
    clearLater();
    let st = p.st || null, box = p.box;
    if (!st && save.games[box]) st = L.restore(save.games[box].st);
    if (!st) { location.hash = "#board-home"; return; }
    begin(box, st);
  }

  function begin(box, st) {
    clearLater();
    hideParty();
    const board = DATA.board(st.board);
    game = { box, st, board, friend: st.seats[1].who, cpu: st.seats[1].cpu, busy: false, hopUntil: 0, counted: st.phase === "done" };
    play.querySelector(".bn-title").textContent = DATA.box(box).name;
    play.dataset.game = board.game;
    play.dataset.box = box;
    svgWrap.innerHTML = board.game === "spin" ? R.orchardSVG() : R.boardSVG(board);
    applesEl.innerHTML = "";
    hidePop();
    hideMark();
    endRides();
    endCheer();
    for (let i = 0; i < 2; i++) {
      const p = seatPerson(i);
      tokens[i].querySelector(".bn-token__face").innerHTML = R.faceHTML(p);
      tokens[i].style.borderColor = p.colour;
      tokens[i].style.transitionDuration = "0ms";
      pads[i].querySelector(".bn-pad__face").innerHTML = R.faceHTML(p);
      pads[i].querySelector(".bn-pad__face").classList.toggle("bn-tablet", !!st.seats[i].cpu);
      pads[i].style.borderColor = p.colour;
    }
    layout();
    paintAll();
    // the next frame, so the tokens jump to their squares without a slide
    later(() => { for (const t of tokens) t.style.transitionDuration = ""; }, 30);
    if (st.phase === "done") { showParty(); return; }
    startTurn(true);
  }

  // Size the board to the space it is given (a square grid of cells), so the
  // page never scrolls in portrait and the cells are as big as they can be.
  function layout() {
    if (!game) return;
    const field = play.querySelector(".bn-field");
    const w = field.clientWidth, h = field.clientHeight;
    const b = game.board;
    const cell = Math.max(20, Math.floor(Math.min(w / b.cols, h / b.rows)));
    boardEl.style.width = cell * b.cols + "px";
    boardEl.style.height = cell * b.rows + "px";
    boardEl.style.left = Math.max(0, Math.round((w - cell * b.cols) / 2)) + "px";
    boardEl.style.top = Math.max(0, Math.round((h - cell * b.rows) / 2)) + "px";
    for (const t of tokens) { t.style.width = Math.round(cell * 0.62) + "px"; t.style.height = Math.round(cell * 0.62) + "px"; }
    // the pop and the apples scale with the board (an apple fills its slot)
    popEl.style.fontSize = Math.max(18, Math.round(cell * 0.5)) + "px";
    applesEl.style.fontSize = Math.round(cell * 0.4) + "px";
  }

  // 🍎 a face badge stands between each tree and its basket: whose is whose,
  // and (with the halo) whose basket this turn fills
  function orchardFrac(p) { return { x: p.x / R.ORCH, y: p.y / R.ORCH }; }
  function placeTokens() {
    const st = game.st, b = game.board;
    if (b.game === "spin") {
      for (let i = 0; i < 2; i++) {
        const sp = orchardFrac(R.ORCHARD.face[i]);
        tokens[i].classList.remove("bn-token--shared");
        tokens[i].style.left = (sp.x * 100) + "%";
        tokens[i].style.top = (sp.y * 100) + "%";
        tokens[i].dataset.pos = String(game.shown[i]);
      }
      return;
    }
    const shared = st.seats[0].pos === st.seats[1].pos;
    for (let i = 0; i < 2; i++) {
      const sp = R.spot(b, st.seats[i].pos, i, shared);
      tokens[i].classList.toggle("bn-token--shared", shared);
      tokens[i].style.left = (sp.x * 100) + "%";
      tokens[i].style.top = (sp.y * 100) + "%";
      tokens[i].dataset.pos = String(st.seats[i].pos);
    }
  }
  // Put token i on square n (the moment of a hop), whatever the engine says
  // now — the engine may already be further along than the animation.
  function moveToken(i, n, ms) {
    const b = game.board, other = game.shown[1 - i];
    game.shown[i] = n;
    const shared = other === n;
    for (const k of [0, 1]) {
      const sp = R.spot(b, game.shown[k], k, shared);
      if (ms != null && k === i) tokens[k].style.transitionDuration = ms + "ms";
      tokens[k].style.left = (sp.x * 100) + "%";
      tokens[k].style.top = (sp.y * 100) + "%";
      tokens[k].dataset.pos = String(game.shown[k]);
      tokens[k].classList.toggle("bn-token--shared", shared);
    }
    if (ms != null) later(() => { tokens[i].style.transitionDuration = ""; }, ms + 20);
    tokens[i].classList.remove("bn-token--hop");
    void tokens[i].offsetWidth;
    tokens[i].classList.add("bn-token--hop");
  }

  function paintAll() {
    game.shown = game.st.seats.map((s) => s.pos);
    game.shownPie = game.st.pie || 0;
    game.tipped = 0;
    // the ⭐ on each pad: the engine counts a ride's star the moment it is
    // decided, the pad the moment the token LANDS (a star that arrived before
    // the ride did gave the ending away)
    game.shownStars = game.st.seats.map((s) => s.stars);
    if (game.showTurn == null) { game.showTurn = game.st.turn; game.showMover = game.st.mover; }
    placeTokens();
    paintApples();
    paintPads();
    paintBoardLabel();
  }
  function paintBoardLabel() {
    const st = game.st;
    if (game.board.game === "spin") {
      boardEl.setAttribute("aria-label", st.seats.map((s, i) => nameOf(i) + " has " + game.shown[i] + (game.shown[i] === 1 ? " apple" : " apples")).join(". ") +
        ". " + game.shownPie + " in the pie.");
      return;
    }
    boardEl.setAttribute("aria-label", st.seats.map((s, i) => nameOf(i) + (s.home ? " is home" : " is on " + game.shown[i])).join(". "));
  }

  // The pads: the active one is bright and ringed, the other dimmed. The dice
  // pad shows the die (its dots go dark one per hop); the card pad the card.
  // The pads follow the turn ON SCREEN (game.showTurn), not the engine's:
  // the engine hands the turn over the moment the last hop lands, while the
  // ride, the card's glide and the hand-over are still playing, so reading
  // st.turn lit the next pad early and put a drawn card on the wrong pad.
  function paintPads() {
    const st = game.st;
    for (let i = 0; i < 2; i++) {
      const pad = pads[i], s = st.seats[i];
      const active = st.phase !== "done" && game.showTurn === i;
      pad.classList.toggle("bn-pad--on", active);
      pad.classList.toggle("bn-pad--wait", !active);
      tokens[i].classList.toggle("bn-token--on", st.phase !== "done" && game.showMover === i);
      const act = pad.querySelector(".bn-pad__act");
      if (game.board.game === "dice") {
        // while the dice tumble, a tumbling face; then the real one, its
        // dots going dark one per hop
        if (active && game.tumbleFace) act.innerHTML = dieHTML(game.tumbleFace, game.tumbleFace);
        else if (active && game.rolled) act.innerHTML = dieHTML(st.die, st.phase === "hop" && st.turn === i ? st.left : 0);
        else act.innerHTML = dieHTML(0, 0);
        pad.querySelector(".bn-pad__stars").textContent = game.shownStars[i] ? "⭐ " + game.shownStars[i] : "";
        const hopping = active && st.phase === "hop" && st.turn === i;
        pad.setAttribute("aria-label", nameOf(i) + (active ? (hopping ? ": tap to hop, " + st.left + " to go" : ": tap to roll the dice") : ": wait for your turn") + (s.home ? ", home" : ""));
      } else if (game.board.game === "spin") {
        // while it spins, the WHEEL spins (it used to tilt and flash apples):
        // drawn once, so its turning is never restarted mid-spin
        if (active && game.tumbling) {
          if (!act.querySelector(".bn-spinner--go")) act.innerHTML = '<span class="bn-spinner bn-spinner--go" style="animation-duration:' + T.tumble + 'ms">' + R.spinnerSVG() + "</span>";
        }
        else if (active && game.rolled) act.innerHTML = spinHTML(st.die, st.phase === "pick" && st.turn === i ? st.left : 0);
        else act.innerHTML = '<span class="bn-spinner">' + R.spinnerSVG() + "</span>";
        pad.querySelector(".bn-pad__stars").textContent = "";
        const picking = active && st.phase === "pick" && st.turn === i;
        pad.setAttribute("aria-label", nameOf(i) + (active ? (picking ? ": tap to pick, " + st.left + " to go" : ": tap to spin") : ": wait for your turn") + (s.home ? ", basket full" : ""));
      } else {
        const c = active && game.cardShown ? game.cardShown : null;
        // a card just drawn FLIPS over (once: a later repaint shows it still)
        act.innerHTML = c ? cardHTML(c, game.cardFresh) : '<span class="bn-card bn-card--back">🌈</span>';
        if (c) game.cardFresh = false;
        // a zoom earns a ⭐, counted on the pad as Moon Race counts its rides
        pad.querySelector(".bn-pad__stars").textContent = game.shownStars[i] ? "⭐ " + game.shownStars[i] : "";
        pad.setAttribute("aria-label", nameOf(i) + (active ? ": tap to flip a card" : ": wait for your turn") + (s.home ? ", home" : ""));
      }
      pad.classList.toggle("bn-pad--home", s.home);
      // Home first, this player now HELPS: the friend's face sits on their
      // pad, so with the sound off he can still see whose token his tap moves
      const help = pad.querySelector(".bn-pad__help"), friend = 1 - i;
      const helping = s.home && !st.seats[friend].home;
      help.hidden = !helping;
      if (helping) {
        if (help.dataset.who !== st.seats[friend].who) { help.innerHTML = R.faceHTML(seatPerson(friend)); help.dataset.who = st.seats[friend].who; }
        help.style.borderColor = seatPerson(friend).colour;
        pad.setAttribute("aria-label", pad.getAttribute("aria-label") + ", helping " + nameOf(friend));
      }
    }
  }
  // A die: up to nine dot places, `n` dots, the first `lit` of them lit
  const DOTS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function dieHTML(n, lit) {
    // not rolled yet: just a die to tap (an empty frame beside it read as a
    // missing picture)
    if (!n) return '<span class="bn-die bn-die--cue" data-n="0"><span class="bn-die__cue">🎲</span></span>';
    const on = DOTS[n] || [];
    let s = '<span class="bn-die' + (n ? "" : " bn-die--blank") + '" data-n="' + n + '">';
    for (let k = 0; k < 9; k++) {
      const idx = on.indexOf(k);
      // dots that are still to hop stay lit; hopped ones go dark (left lit = the LAST `lit` dots)
      const cls = idx < 0 ? "bn-dot bn-dot--none" : idx >= on.length - lit ? "bn-dot" : "bn-dot bn-dot--used";
      s += '<span class="' + cls + '"></span>';
    }
    return s + "</span>";
  }
  // 🍎 a spin's result on the pad: that many apples, picked ones going pale
  // (the die's dots), or the silly bird
  function spinHTML(n, lit) {
    if (n === 0) return '<span class="bn-spin bn-spin--bird" data-n="0">🐦</span>';
    let s = '<span class="bn-spin" data-n="' + n + '">';
    for (let k = 0; k < n; k++) s += '<span class="bn-spin__apple' + (k >= n - lit ? "" : " bn-spin__apple--used") + '">🍎</span>';
    return s + "</span>";
  }
  function cardHTML(card, flip) {
    const b = game.board, f = flip ? " bn-card--flip" : "";
    if (card.kind === "pic") {
      const lm = (b.landmarks || []).find((l) => l.at === card.at);
      return '<span class="bn-card bn-card--pic' + f + '">' + (lm ? lm.pic : "⭐") + "</span>";
    }
    return '<span class="bn-card' + f + '">' + R.shapeSVG(card.c, { two: card.kind === "two" }) + "</span>";
  }

  // ---- The turn routine ---------------------------------------------------------
  function startTurn(fresh) {
    const st = game.st;
    if (st.phase === "done") { showParty(); return; }
    game.busy = false;
    game.cpuWaiting = false;
    game.cardShown = null;
    game.tumbleFace = 0;
    game.showTurn = st.turn;
    game.showMover = st.mover;
    game.rolled = st.phase === "hop" || st.phase === "pick";   // a game restored mid-move shows its die / spin
    paintPads();
    persistGame();
    const i = st.turn;
    if (st.seats[i].cpu) {
      sayPlay(fill(SAY.turn, { n: nameOf(i) }));
      later(cpuTurn, fresh ? T.cpuThink + 400 : T.cpuThink);
      return;
    }
    // his turn: the line, and — the first time ever — the hand that shows how
    const first = !save.intro[game.board.game];
    if (st.phase === "hop") sayPlay(SAY.hopFirst);
    else if (st.phase === "pick") sayPlay(SAY.pickFirst);
    else sayPlay(fill(SAY.turn, { n: nameOf(i) }) + (first ? " " + firstLine() : ""));
    if (first) showHand(i);
    if (st.phase === "hop" && save.auto) autoHops();
    if (st.phase === "pick" && save.auto) autoPicks();
  }
  function firstLine() { const g = game.board.game; return g === "dice" ? SAY.rollFirst : g === "spin" ? SAY.spinFirst : SAY.flipFirst; }

  function padTap(i) {
    if (!game || !playVisible()) return;
    const st = game.st;
    if (st.phase === "done") return;
    // whose turn it is ON SCREEN: through a hand-over the engine has already
    // passed the turn on while the lit pad is still the one that just moved
    const shown = game.showTurn == null ? st.turn : game.showTurn;
    if (i !== shown || st.seats[i].cpu) {
      // not this pad's turn: a kind wiggle, never a buzzer
      wiggle(pads[i]);
      sayPlay(fill(SAY.notYet, { n: nameOf(shown) }));
      return;
    }
    if (game.busy || i !== st.turn) return;
    if (game.board.game === "cards") return flipCard();
    if (st.phase === "roll") return rollDice();
    if (st.phase === "hop" && !save.auto) return hopOnce();
    if (st.phase === "spin") return spinApples();
    if (st.phase === "pick" && !save.auto) return pickOnce();
  }
  function wiggle(el) {
    SFX.wiggle();
    el.classList.remove("bn-wiggle");
    void el.offsetWidth;
    el.classList.add("bn-wiggle");
    later(() => el.classList.remove("bn-wiggle"), 420);
  }

  function rollDice() {
    game.busy = true;
    hideHand();
    // the dice tumble (a fixed cycle — the result is the engine's, drawn now)
    const ev = L.roll(game.st);
    if (!ev.length) { game.busy = false; return; }
    game.rolled = true;
    game.showMover = game.st.mover;
    let k = 0;
    const faces = [3, 6, 2, 5, 1, 4];
    const spin = () => {
      game.tumbleFace = faces[k++ % faces.length];
      SFX.tick();
      paintPads();
      if (k * 100 < T.tumble) later(spin, 100);
    };
    spin();
    later(() => {
      game.tumbleFace = 0;
      SFX.thunk();
      game.busy = false;
      paintPads();
      persistGame();
      const st = game.st;
      if (st.seats[st.turn].cpu) { later(cpuHop, T.cpuHop); return; }
      if (!save.intro.dice) { sayPlay(SAY.hopFirst); showHand(st.turn); }
      if (save.auto) autoHops();
    }, T.tumble);
  }

  function autoHops() {
    if (!game || game.st.phase !== "hop") return;
    later(() => { if (game && game.st.phase === "hop" && !game.busy) { hopOnce(); autoHops(); } }, T.autoHop);
  }

  // One hop: the token moves one square, a dot goes dark, the square's number
  // is said. A tap while the last hop is still moving is ignored — that is
  // the hammer's echo, and the dots still lit say how many are left.
  function hopOnce() {
    const st = game.st;
    if (now() < game.hopUntil) return;
    const ev = L.hop(st);
    if (!ev.length) return;
    game.hopUntil = now() + T.hop;
    hideHand();
    if (!save.intro.dice && !st.seats[ev[0].seat].cpu) { save.intro.dice = true; persist(); }
    playEvents(ev);
  }
  function cpuHop() {
    if (!game || game.st.phase !== "hop") return;
    const ev = L.hop(game.st);
    if (!ev.length) return;
    playEvents(ev, () => { if (game && game.st.phase === "hop") later(cpuHop, T.cpuHop); });
  }

  function cpuTurn() {
    if (!game) return;
    // Hidden (another app, a sleeping iPad): the turn WAITS rather than being
    // dropped, and plays when the screen is back (the visibilitychange hook).
    // Dropped, nothing called it again and his taps only ever wiggled.
    if (!playVisible()) { game.cpuWaiting = true; return; }
    game.cpuWaiting = false;
    if (game.busy) return;
    const st = game.st;
    if (st.phase === "done" || !st.seats[st.turn].cpu) return;
    if (game.board.game === "cards") return flipCard();
    if (st.phase === "roll") return rollDice();
    if (st.phase === "spin") return spinApples();
    if (st.phase === "pick") return cpuPick();
    cpuHop();
  }

  // ---- 🍎 Apple Spin: spin, then one apple per tap ------------------------------
  function spinApples() {
    game.busy = true;
    hideHand();
    const ev = L.spin(game.st);
    if (!ev.length) { game.busy = false; return; }
    game.rolled = true;
    game.showMover = game.st.mover;
    game.tumbling = true;
    let k = 0;
    paintPads();
    const go = () => {
      k++;
      SFX.tick();
      if (k * 100 < T.tumble) later(go, 100);
    };
    go();
    later(() => {
      game.tumbling = false;
      game.tumbleFace = 0;
      SFX.thunk();
      game.busy = false;
      paintPads();
      const st = game.st;
      // a 🐦 is the whole turn: show it, then the turn passes
      if (ev[0].face === 0) { playEvents(ev.slice(1)); return; }
      persistGame();
      if (st.seats[st.turn].cpu) { later(cpuPick, T.cpuHop); return; }
      if (!save.intro.spin) { sayPlay(SAY.pickFirst); showHand(st.turn); }
      if (save.auto) autoPicks();
    }, T.tumble);
  }
  function autoPicks() {
    if (!game || game.st.phase !== "pick") return;
    later(() => { if (game && game.st.phase === "pick" && !game.busy) { pickOnce(); autoPicks(); } }, T.autoHop);
  }
  function pickOnce() {
    const st = game.st;
    if (now() < game.hopUntil) return;
    const ev = L.pick(st);
    if (!ev.length) return;
    game.hopUntil = now() + T.hop;
    hideHand();
    // the TAPPER's seat, read off the event: a pick that ends the turn has
    // already handed st.turn to the other player (hopOnce reads it the same way)
    if (!save.intro.spin && !st.seats[ev[0].seat].cpu) { save.intro.spin = true; persist(); }
    playEvents(ev);
  }
  function cpuPick() {
    if (!game || game.st.phase !== "pick") return;
    const ev = L.pick(game.st);
    if (!ev.length) return;
    playEvents(ev, () => { if (game && game.st.phase === "pick") later(cpuPick, T.cpuHop); });
  }

  // The apples that move: every apple in a basket or the pie is drawn from
  // game.shown / game.shownPie. `fly` brings ONE apple in from where it was
  // picked (a tree, a basket), so the eye follows it into its slot.
  function paintApples(fly) {
    if (!game || game.board.game !== "spin") return;
    let html = "";
    const at = (p, cls, extra) => {
      const f = orchardFrac(p);
      return '<span class="bn-apple' + (cls || "") + '" style="left:' + (f.x * 100).toFixed(2) + "%;top:" + (f.y * 100).toFixed(2) + '%"' + (extra || "") + ">🍎</span>";
    };
    for (let i = 0; i < 2; i++) {
      for (let k = 0; k < game.shown[i]; k++) html += at(R.slotOf(i, k), "", ' data-seat="' + i + '" data-k="' + k + '"');
    }
    for (let k = 0; k < Math.min(game.shownPie, 14); k++) html += at(R.pieSpot(k), " bn-apple--pie", ' data-pie="' + k + '"');
    applesEl.innerHTML = html;
    if (!fly) return;
    const el = fly.pie != null ? applesEl.querySelector('[data-pie="' + fly.pie + '"]')
      : applesEl.querySelector('[data-seat="' + fly.seat + '"][data-k="' + fly.k + '"]');
    if (!el) return;
    const from = orchardFrac(fly.from), to = { left: el.style.left, top: el.style.top };
    el.style.transitionDuration = "0ms";
    el.style.left = (from.x * 100) + "%";
    el.style.top = (from.y * 100) + "%";
    void el.offsetWidth;
    el.style.transitionDuration = (fly.ms || T.hop) + "ms";
    el.style.left = to.left;
    el.style.top = to.top;
  }
  // 🍎 the finale: basket i tips its ten apples into the pie. Each apple
  // flies from its slot to the dish; the pie keeps (up to) the apples it can
  // show, and the count pops: 10, then 20.
  function tipBasket(i) {
    if (!game || game.board.game !== "spin") return;
    const n = game.shown[i];
    // the basket empties as its apples leave (drawn first: a repaint clears
    // the flying ones), and the pie fills as they land
    game.shown[i] = 0;
    paintApples();
    for (let k = 0; k < n; k++) {
      const el = doc.createElement("span");
      el.className = "bn-apple bn-apple--tip";
      const a = orchardFrac(R.slotOf(i, k)), b = orchardFrac(R.pieSpot(k % 14));
      el.style.left = (a.x * 100) + "%"; el.style.top = (a.y * 100) + "%";
      el.textContent = "🍎";
      applesEl.appendChild(el);
      void el.offsetWidth;
      el.style.transitionDuration = (T.tip * 0.6) + "ms";
      el.style.transitionDelay = (k * 30) + "ms";
      el.style.left = (b.x * 100) + "%"; el.style.top = (b.y * 100) + "%";
    }
    game.tipped = (game.tipped || 0) + n;
    later(() => { if (game) { game.shownPie += n; paintApples(); paintBoardLabel(); } }, T.tip * 0.6 + n * 30 + 20);
    SFX.pie();
    popAt(orchardFrac(R.ORCHARD.pie), String(game.tipped));
  }
  // an apple the 🐦 carries BACK up the tree: a loose apple that flies and goes
  function flyAway(from, to, ms) {
    const el = doc.createElement("span");
    el.className = "bn-apple bn-apple--away";
    const a = orchardFrac(from), b = orchardFrac(to);
    el.style.left = (a.x * 100) + "%"; el.style.top = (a.y * 100) + "%";
    el.textContent = "🐦";
    applesEl.appendChild(el);
    void el.offsetWidth;
    el.style.transitionDuration = ms + "ms";
    el.style.left = (b.x * 100) + "%"; el.style.top = (b.y * 100) + "%";
    later(() => el.remove(), ms + 40);
  }

  function flipCard() {
    game.busy = true;
    hideHand();
    const ev = L.drawCard(game.st);
    if (!ev.length) { game.busy = false; return; }
    if (!save.intro.cards && !game.st.seats[ev[0].seat].cpu) { save.intro.cards = true; persist(); }
    playEvents(ev);
  }

  // Play the engine's events out as pictures and sounds, in order. The engine
  // has already moved; this only SHOWS it. When the last event is played, the
  // next turn starts (unless `then` takes over).
  function playEvents(ev, then) {
    let t = 0;
    // Anything more than a plain hop (or one picked apple) holds the board
    // until the next turn starts: no pad may act while a ride, a card, the
    // pie or the hand-over plays.
    if (ev.some((e) => e.type !== "hop" && e.type !== "pick")) game.busy = true;
    const at = (ms, fn) => { t += ms; later(fn, t); };
    let turnEnded = false;
    for (const e of ev) {
      if (e.type === "hop") {
        moveToken(e.seat, e.to, T.hop);
        paintPads();
        SFX.hop(e.to);
        sayPlay(String(e.to));
        popOnSquare(e.to, String(e.to));
        paintBoardLabel();
      } else if (e.type === "pick") {
        // one apple from the tree into the next slot of the ten-frame
        game.shown[e.seat] = e.to;
        paintApples({ seat: e.seat, k: e.to - 1, from: R.treeSpot(e.seat, e.to - 1) });
        paintPads();
        SFX.plop(e.to);
        sayPlay(String(e.to));
        popAt(orchardFrac(R.slotOf(e.seat, e.to - 1)), String(e.to));
        paintBoardLabel();
      } else if (e.type === "pie") {
        at(T.hop + 200, () => {
          game.shownPie = e.pie;
          paintApples({ pie: Math.min(e.pie, 14) - 1, from: R.slotOf(e.seat, 9), ms: T.ride });
          SFX.pie();
          sayPlay(fill(SAY.pie, { k: e.n }));
          popAt(orchardFrac(R.ORCHARD.pie), "+" + e.n);
          paintBoardLabel();
        });
        at(T.ride, () => {});
      } else if (e.type === "bird") {
        at(T.hop, () => {
          const from = R.slotOf(e.seat, e.to);
          game.shown[e.seat] = e.to;
          paintApples();
          flyAway(from, R.treeSpot(e.seat, e.to), T.ride);
          SFX.tweet();
          sayPlay(fill(SAY.bird, { to: e.to }));
          popAt(orchardFrac(R.slotOf(e.seat, Math.max(0, e.to - 1))), String(e.to));
          paintPads();
          paintBoardLabel();
        });
        at(T.ride, () => {});
      } else if (e.type === "card") {
        game.cardShown = e.card;
        game.cardFresh = true;
        game.showMover = e.mover;
        paintPads();
        SFX.flip();
        sayPlay(cardLine(e.card));
        // the square the card sends him to lights up, so the match of card
        // and square is SEEN before the token sets off
        showMark(e.to);
        at(T.card, () => {});
        if (e.zoom) {
          // a picture card AHEAD is a ZOOM: one swoop, grown and glowing like a
          // booster ride, landing with its ⭐. Square by square it crawled:
          // up to 26 squares at a glide each, about eight seconds of nothing
          at(0, () => {
            tokens[e.mover].classList.add("bn-token--ride");
            moveToken(e.mover, e.to, T.ride);
            SFX.boost();
            cheer(e.mover);
          });
          at(T.ride, () => {
            tokens[e.mover].classList.remove("bn-token--ride");
            hideMark();
            popOnSquare(e.to, "⭐");
            landStar(e.mover);
            paintBoardLabel();
          });
          at(T.hop, () => {});
        } else {
          for (const n of e.path) at(T.glide, () => { moveToken(e.mover, n, T.glide); SFX.glide(); });
          at(0, () => { hideMark(); sayPlay(String(e.to)); popOnSquare(e.to, String(e.to)); paintBoardLabel(); });
        }
      } else if (e.type === "ride") {
        at(T.hop + 120, () => {
          // a ride is a RIDE: the token grows and glows on the way, and lands
          // with its star
          tokens[e.seat].classList.add("bn-token--ride");
          later(() => { tokens[e.seat].classList.remove("bn-token--ride"); popOnSquare(e.to, "⭐"); landStar(e.seat); }, T.ride);
          moveToken(e.seat, e.to, T.ride);
          if (e.kind === "boost") { SFX.boost(); sayPlay(fill(SAY.boost, { to: e.to })); }
          else { SFX.comet(); sayPlay(fill(SAY.comet, { to: e.to })); }
          cheer(e.seat);
          paintPads();
          paintBoardLabel();
        });
        at(T.ride, () => {});
      } else if (e.type === "home") {
        at(T.hop, () => {
          SFX.home();
          sayPlay(fill(endLine("home"), { n: nameOf(e.seat) }));
          paintPads();
          cheer(e.seat, true);
          try { if (global.JoshEffects && playVisible()) global.JoshEffects.stars(); } catch (err) { /* ignore */ }
        });
        at(900, () => {});
      } else if (e.type === "helper") {
        at(0, () => sayPlay(fill(SAY.helper, { n: nameOf(e.seat), m: nameOf(e.helps) })));
        at(900, () => {});
      } else if (e.type === "turn") {
        turnEnded = true;
        at(T.handoff, () => { SFX.whoosh(); startTurn(); });
      } else if (e.type === "end") {
        turnEnded = true;
        countFinish();
        // 🍎 both baskets TIP into the pie, counting by tens — "ten, twenty!"
        // — then the spare apples on top: the plan's finale (§6), which had
        // only ever been the total, popped once
        if (game.board.game === "spin") {
          for (const i of [0, 1]) at(T.tip, () => tipBasket(i));
          if (game.st.pie > 0) at(T.tip, () => { popAt(orchardFrac(R.ORCHARD.pie), String(20 + game.st.pie)); SFX.pie(); });
        }
        at(T.handoff, () => { finishGame(); });
      }
    }
    if (!turnEnded) {
      persistGame();
      if (then) then();
    }
  }
  function cardLine(card) {
    if (card.kind === "pic") {
      const lm = (game.board.landmarks || []).find((l) => l.at === card.at);
      return fill(SAY.cardPic, { p: lm ? lm.say : "" });
    }
    const c = DATA.colour(card.c);
    return cap(fill(card.kind === "two" ? SAY.cardTwo : SAY.card, { c: c.name, s: c.shape }));
  }

  function persistGame() {
    if (!game) return;
    own.add(game.box);
    if (game.st.phase === "done") { countFinish(); return; }
    save.games[game.box] = { st: L.snapshot(game.st), at: Date.now() };
    persist();
  }

  // A finished game counts the moment the engine says it is over, not when
  // the party appears: leaving inside the hand-over cancels the party's timer,
  // and counting there lost the game (and Comet Moon's unlock with it).
  // Once per game, whichever comes first.
  function countFinish() {
    if (!game || game.counted) return;
    game.counted = true;
    own.add(game.box);
    save.done[game.box] = (save.done[game.box] || 0) + 1;
    added[game.box] = (added[game.box] || 0) + 1;
    delete save.games[game.box];
    persist();
  }
  function finishGame() {
    countFinish();
    showParty();
  }
  function showParty() {
    paintPads();
    const faces = party.querySelectorAll(".bn-party__face"), hauls = party.querySelectorAll(".bn-party__haul");
    // the haul: every ⭐ a ride or a zoom gave (Apple Spin's haul is the pie)
    const stars = game.st.seats.map((s) => s.stars);
    const any = game.board.game !== "spin" && stars.some((n) => n > 0);
    for (let i = 0; i < 2; i++) {
      faces[i].innerHTML = R.faceHTML(seatPerson(i));
      hauls[i].textContent = any ? "⭐ " + stars[i] : "";
      hauls[i].hidden = !any;
    }
    party.setAttribute("aria-label", "Everyone is home!" + (any ? " " + [0, 1].map((i) => nameOf(i) + " has " + stars[i] + (stars[i] === 1 ? " star" : " stars")).join(", ") + "." : ""));
    party.hidden = false;
    party.__shownAt = now();
    sayPlay(endLine("end"));
    if (game.board.game === "spin") popAt(orchardFrac(R.ORCHARD.pie), String(20 + (game.st.pie || 0)));
    try { if (global.JoshAudio && !global.JoshAudio.isMuted() && playVisible()) global.JoshAudio.winCue(); } catch (e) { /* ignore */ }
    try { if (global.JoshEffects && playVisible()) global.JoshEffects.confetti(); } catch (e) { /* ignore */ }
  }
  function hideParty() { if (party) party.hidden = true; }
  // The line a box says when someone gets home ("home") or everyone is ("end")
  function endLine(kind) {
    const g = game.board.game;
    if (g === "spin") return kind === "home" ? SAY.full : fill(SAY.endApple, { k: 20 + (game.st.pie || 0) });
    if (g === "dice") return kind === "home" ? SAY.homeMoon : SAY.endMoon;
    return kind === "home" ? SAY.homeTrail : SAY.endTrail;
  }

  // ---- The number that pops (counting with the sound off) ------------------------
  // The plan's "the square's number pops up and is said": with the sound OFF
  // (the default) the voice says nothing, so the number has to be SEEN.
  function popAt(f, text, below) {
    if (!popEl) return;
    popEl.textContent = text;
    popEl.style.left = (f.x * 100) + "%";
    popEl.style.top = (f.y * 100) + "%";
    popEl.classList.toggle("bn-pop--below", !!below);
    popEl.hidden = false;
    popEl.classList.remove("bn-pop--go");
    void popEl.offsetWidth;
    popEl.classList.add("bn-pop--go");
    cancelLater(popEl.__t);
    popEl.__t = later(hidePop, T.pop);
  }
  // Above the square, where it grows out of the number — except on the TOP
  // row, where "above" is off the board and over the bar (on an iPad it sat on
  // the 🏠 button): there it pops BELOW the square instead.
  function popOnSquare(n, text) {
    const b = game.board, c = R.centre(b, n), top = L.cellOf(b, n).row === b.rows - 1;
    const y = top ? c.y + R.CELL * 0.42 : c.y - R.CELL * 0.42;
    popAt({ x: c.x / (b.cols * R.CELL), y: y / (b.rows * R.CELL) }, text, top);
  }
  function hidePop() { if (popEl) { popEl.hidden = true; popEl.classList.remove("bn-pop--go"); } }
  // 🌈 the target square's ring
  function showMark(n) {
    if (!markEl || game.board.game !== "cards") return;
    const b = game.board, c = L.cellOf(b, n);
    markEl.style.left = (c.col / b.cols * 100) + "%";
    markEl.style.top = ((b.rows - 1 - c.row) / b.rows * 100) + "%";
    markEl.style.width = (100 / b.cols) + "%";
    markEl.style.height = (100 / b.rows) + "%";
    markEl.dataset.n = String(n);
    markEl.hidden = false;
  }
  function hideMark() { if (markEl) markEl.hidden = true; }
  // A ride's glow is taken off by a timer, and clearLater() cancels timers: so
  // whatever cancels them (a new game, leaving) takes the glow off itself, or
  // the next game opens with a token grown over the numbers.
  function endRides() { for (const t of tokens) if (t) t.classList.remove("bn-token--ride"); }
  function landStar(i) {
    if (!game || !game.shownStars) return;
    game.shownStars[i] = Math.min(game.st.seats[i].stars, game.shownStars[i] + 1);
    paintPads();
  }

  // ---- The friend cheers (a friend, not an opponent) -----------------------------
  // A big moment for one player — a ride, a zoom, home, a full basket — and the
  // OTHER player's face on their pad throws up a 🎉 and bounces. The computer
  // friend also says it ("Whoa, Josh!"), but the sound is OFF by default, so
  // the cheer has to be SEEN: before, it was a voice line and nothing else.
  function cheer(i, quiet) {
    if (!game || !playVisible()) return;
    const f = 1 - i, pad = pads[f];
    const b = pad && pad.querySelector(".bn-pad__cheer");
    if (!b) return;
    b.hidden = false;
    b.classList.remove("bn-cheer--go");
    void b.offsetWidth;
    b.classList.add("bn-cheer--go");
    pad.classList.add("bn-pad--cheer");
    cancelLater(b.__t);
    b.__t = later(endCheer, T.cheer);
    if (!quiet && game.st.seats[f].cpu) sayPlay(fill(SAY.cpuCheer, { n: nameOf(i) }));
  }
  function endCheer() {
    for (const p of pads) {
      if (!p) continue;
      p.classList.remove("bn-pad--cheer");
      const b = p.querySelector(".bn-pad__cheer");
      if (b) { b.hidden = true; b.classList.remove("bn-cheer--go"); }
    }
  }

  // ---- The hand that shows how (first time, and on 👂) ---------------------------
  function showHand(i) {
    const pad = pads[i];
    if (!pad) return;
    const r = pad.getBoundingClientRect(), pr = play.getBoundingClientRect();
    hand.style.left = (r.left - pr.left + r.width * 0.5) + "px";
    hand.style.top = (r.top - pr.top + r.height * 0.45) + "px";
    hand.hidden = false;
  }
  function hideHand() { if (hand) hand.hidden = true; }
  function hint() {
    if (!game) return;
    const st = game.st;
    if (st.phase === "done") { say(endLine("end")); return; }
    const i = st.turn;
    if (st.seats[i].cpu) { say(fill(SAY.turn, { n: nameOf(i) })); return; }
    if (st.phase === "hop") say(SAY.hopFirst);
    else if (st.phase === "pick") say(SAY.pickFirst);
    else say(fill(SAY.turn, { n: nameOf(i) }) + " " + firstLine());
    showHand(i);
    later(hideHand, 2600);
  }

  function leavePlay() {
    clearLater();
    // the spin's own timer just died, so it can never end its tumble: left
    // set, the pad would come back showing a spinning 🐦 that was never spun
    if (game) game.tumbling = false;
    hideHand();
    hidePop();
    hideMark();
    endRides();
    endCheer();
    if (game) {
      game.busy = false;
      persistGame();
    }
  }

  // ---- Routing (main.js delegates every board-* hash) ---------------------------
  function show(el) {
    for (const s of [shelf, who, pick, play]) if (s && s !== el) s.hidden = true;
    el.hidden = false;
    el.__shownAt = now();
    doc.body.classList.add("board-mode");
    doc.body.classList.toggle("in-game", el === play);
    global.scrollTo(0, 0);
  }
  const GameNight = {
    route(id) {
      if (!shelf) return false;
      if (play && !play.hidden && id !== "board-play") leavePlay();
      // what the other tab stored, before anything here decides from it
      syncSave();
      if (id === "board-home") {
        paintShelf();
        show(shelf);
        later(() => { if (!shelf.hidden) say(SAY.shelf); }, 300);
        return true;
      }
      let m = /^board-who-([a-z]+)$/.exec(id);
      if (m) {
        const b = DATA.box(m[1]);
        if (!b || !boxOpen(b)) return false;
        whoBox = b.id;
        paintWho();
        show(who);
        later(() => { if (!who.hidden) say(SAY.who); }, 300);
        return true;
      }
      m = /^board-pick-([a-z]+)-(cpu|here)$/.exec(id);
      if (m) {
        const b = DATA.box(m[1]);
        if (!b || !boxOpen(b)) return false;
        whoBox = b.id;
        pickMode = m[2];
        paintPick();
        show(pick);
        return true;
      }
      if (id === "board-play") {
        show(play);
        if (pending) startPending();
        else if (game && game.st.phase !== "done") { layout(); paintAll(); startTurn(); }
        else if (game) { layout(); paintAll(); showParty(); }
        else {
          // a deep link: carry on the last box's game, else the shelf
          const box = save.last && save.games[save.last.box] ? save.last.box : Object.keys(save.games)[0];
          if (box) { pending = { box }; startPending(); } else { location.hash = "#board-home"; }
        }
        return true;
      }
      return false;
    },
    onLeave() {
      if (play && !play.hidden) leavePlay();
      for (const s of [shelf, who, pick, play]) if (s) s.hidden = true;
      if (doc.body) doc.body.classList.remove("board-mode");
    },
  };
  global.GameNight = GameNight;

  // ---- Test hooks (the __HOLE / __TD precedent) ----------------------------------
  global.__BOARD = {
    state: () => (game ? L.snapshot(game.st) : null),
    save: () => JSON.parse(JSON.stringify(save)),
    reset(opts) {
      clearLater();
      game = null; pending = null;
      save = freshSave();
      own.clear(); added = {};
      if (opts && opts.introSeen) { save.intro.dice = true; save.intro.cards = true; save.intro.spin = true; }
      if (opts && opts.done) Object.assign(save.done, opts.done);
      // a reset WRITES, it does not fold: persist() keeps the larger of each
      // finished-games count and ORs "has been shown how", so a reset through
      // it would bring the old progress straight back (Gobble's resetProgress
      // lesson; a test caught it here, Comet Moon staying unlocked)
      try { global.localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* private mode */ }
    },
    // Start a game with a chosen seed (so a test knows the dice), as the who
    // screen would.
    start(box, friend, cpu, seed, first, birds) {
      const b = DATA.box(box);
      const st = L.create({ board: b.board, seats: [{ who: "josh" }, { who: friend, cpu: !!cpu }], seed: seed || 1, first: first || 0, birds: !!birds });
      save.games[box] = { st: L.snapshot(st), at: Date.now() };
      save.last = { box, who: friend, cpu: !!cpu };
      own.add(box);
      persist();
      pending = { box, st };
      if (location.hash === "#board-play" && play && !play.hidden) startPending(); else location.hash = "#board-play";
    },
    // Open a game from a snapshot (validated exactly as a saved one is) — a
    // finished one opens straight onto its party.
    load(box, snap) {
      const st = L.restore(snap);
      if (!st || !DATA.box(box) || DATA.box(box).board !== st.board) return false;
      pending = { box, st };
      if (location.hash === "#board-play" && play && !play.hidden) startPending(); else location.hash = "#board-play";
      return true;
    },
    busy: () => !!(game && (game.busy || timers.size)),
    timers: () => timers.size,
    shown: () => (game ? game.shown.slice() : null),
    T,
  };

  doc.addEventListener("visibilitychange", () => {
    if (game && game.cpuWaiting && playVisible()) { game.cpuWaiting = false; later(cpuTurn, T.cpuThink); }
  });

  try { build(); } catch (e) { console.error("Game Night: build failed:", e); }
})(typeof window !== "undefined" ? window : globalThis);
