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
  const T = { tumble: 700, hop: 240, autoHop: 480, cpuThink: 900, cpuHop: 560, ride: 900, card: 520, glide: 300, handoff: 700 };
  const now = () => (global.performance && global.performance.now ? global.performance.now() : Date.now());
  const $ = (sel, root) => (root || doc).querySelector(sel);
  const fill = (line, o) => String(line).replace(/\{(\w+)\}/g, (m, k) => (o && o[k] != null ? o[k] : m));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---- The save -------------------------------------------------------------
  // games: the game in progress per box ({ st, at }) · done: games finished per
  // box · intro: whether he has been shown how (dice / cards) · auto: the
  // grown-up "hop by itself" switch · next: who starts the next two-person
  // game per box · last: the last box and its players.
  function freshSave() { return { v: 1, games: {}, done: {}, intro: { dice: false, cards: false }, auto: false, next: {}, last: null }; }
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
    if (isObj(raw.intro)) { s.intro.dice = raw.intro.dice === true; s.intro.cards = raw.intro.cards === true; }
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
  };

  // ---- The screens -----------------------------------------------------------
  let shelf = null, who = null, pick = null, play = null;
  let boardEl = null, svgWrap = null, tokens = [null, null], pads = [null, null], hand = null, party = null;
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
          '<div class="bn-token bn-token--0" aria-hidden="true"><span class="bn-token__face"></span></div>' +
          '<div class="bn-token bn-token--1" aria-hidden="true"><span class="bn-token__face"></span></div>' +
        "</div>" +
        '<div class="bn-party" role="dialog" aria-label="Everyone is home!" hidden>' +
          '<div class="bn-party__box">' +
            '<div class="bn-party__faces" aria-hidden="true"><span class="bn-party__face"></span><span class="bn-party__face"></span></div>' +
            '<div class="bn-party__row">' +
              '<button class="btn-big bn-again" type="button" aria-label="Play again">🔁</button>' +
              '<button class="btn-big bn-shelf" type="button" aria-label="Back to the games">🏠</button>' +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>" +
      '<div class="bn-tray">' +
        '<button class="bn-pad bn-pad--0" type="button" data-seat="0"><span class="bn-pad__face" aria-hidden="true"></span><span class="bn-pad__act" aria-hidden="true"></span><span class="bn-pad__stars" aria-hidden="true"></span></button>' +
        '<button class="bn-pad bn-pad--1" type="button" data-seat="1"><span class="bn-pad__face" aria-hidden="true"></span><span class="bn-pad__act" aria-hidden="true"></span><span class="bn-pad__stars" aria-hidden="true"></span></button>' +
      "</div>" +
      '<div class="bn-hand" aria-hidden="true" hidden>👆</div>');
    boardEl = play.querySelector(".bn-board");
    svgWrap = play.querySelector(".bn-svgwrap");
    tokens = [...play.querySelectorAll(".bn-token")];
    pads = [...play.querySelectorAll(".bn-pad")];
    hand = play.querySelector(".bn-hand");
    party = play.querySelector(".bn-party");
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
    for (const b of DATA.BOXES) {
      if (!boxOpen(b)) continue;
      const btn = doc.createElement("button");
      btn.className = "bn-box tap";
      btn.type = "button";
      btn.setAttribute("role", "listitem");
      btn.dataset.box = b.id;
      btn.style.borderBottomColor = b.colour;
      const g = save.games[b.id];
      btn.setAttribute("aria-label", b.name + (g ? ", a game is waiting" : ""));
      btn.innerHTML = '<span class="bn-box__pic" aria-hidden="true">' + b.pic + "</span>" +
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
    const st = L.create({ board: b.board, seats: [{ who: "josh" }, { who: friend, cpu }], seed, first });
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
    svgWrap.innerHTML = R.boardSVG(board);
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
  }

  function placeTokens() {
    const st = game.st, b = game.board;
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
    if (game.showTurn == null) { game.showTurn = game.st.turn; game.showMover = game.st.mover; }
    placeTokens();
    paintPads();
    paintBoardLabel();
  }
  function paintBoardLabel() {
    const st = game.st;
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
        pad.querySelector(".bn-pad__stars").textContent = s.stars ? "⭐ " + s.stars : "";
        const hopping = active && st.phase === "hop" && st.turn === i;
        pad.setAttribute("aria-label", nameOf(i) + (active ? (hopping ? ": tap to hop, " + st.left + " to go" : ": tap to roll the dice") : ": wait for your turn") + (s.home ? ", home" : ""));
      } else {
        const c = active && game.cardShown ? game.cardShown : null;
        act.innerHTML = c ? cardHTML(c) : '<span class="bn-card bn-card--back">🌈</span>';
        pad.querySelector(".bn-pad__stars").textContent = "";
        pad.setAttribute("aria-label", nameOf(i) + (active ? ": tap to flip a card" : ": wait for your turn") + (s.home ? ", home" : ""));
      }
      pad.classList.toggle("bn-pad--home", s.home);
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
  function cardHTML(card) {
    const b = game.board;
    if (card.kind === "pic") {
      const lm = (b.landmarks || []).find((l) => l.at === card.at);
      return '<span class="bn-card bn-card--pic">' + (lm ? lm.pic : "⭐") + "</span>";
    }
    return '<span class="bn-card">' + R.shapeSVG(card.c, { two: card.kind === "two" }) + "</span>";
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
    game.rolled = st.phase === "hop";   // a game restored mid-hop shows its die
    paintPads();
    persistGame();
    const i = st.turn;
    if (st.seats[i].cpu) {
      sayPlay(fill(SAY.turn, { n: nameOf(i) }));
      later(cpuTurn, fresh ? T.cpuThink + 400 : T.cpuThink);
      return;
    }
    // his turn: the line, and — the first time ever — the hand that shows how
    const first = game.board.game === "dice" ? !save.intro.dice : !save.intro.cards;
    if (st.phase === "hop") sayPlay(SAY.hopFirst);
    else sayPlay(fill(SAY.turn, { n: nameOf(i) }) + (first ? " " + (game.board.game === "dice" ? SAY.rollFirst : SAY.flipFirst) : ""));
    if (first) showHand(i);
    if (st.phase === "hop" && save.auto) autoHops();
  }

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
    cpuHop();
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
    // Anything more than a plain hop holds the board until the next turn
    // starts: no pad may act while a ride, a card or the hand-over plays.
    if (ev.some((e) => e.type !== "hop")) game.busy = true;
    const at = (ms, fn) => { t += ms; later(fn, t); };
    let turnEnded = false;
    for (const e of ev) {
      if (e.type === "hop") {
        moveToken(e.seat, e.to, T.hop);
        paintPads();
        SFX.hop(e.to);
        sayPlay(String(e.to));
        paintBoardLabel();
      } else if (e.type === "card") {
        game.cardShown = e.card;
        game.showMover = e.mover;
        paintPads();
        SFX.flip();
        sayPlay(cardLine(e.card));
        at(T.card, () => {});
        for (const n of e.path) at(T.glide, () => { moveToken(e.mover, n, T.glide); SFX.glide(); });
        at(0, () => { sayPlay(String(e.to)); paintBoardLabel(); });
      } else if (e.type === "ride") {
        at(T.hop + 120, () => {
          moveToken(e.seat, e.to, T.ride);
          if (e.kind === "boost") {
            SFX.boost();
            sayPlay(fill(SAY.boost, { to: e.to }));
            // the computer friend cheers HIM on (a friend, not an opponent)
            if (game.cpu && e.seat === 0) sayPlay(fill(SAY.cpuCheer, { n: nameOf(0) }));
          }
          else { SFX.comet(); sayPlay(fill(SAY.comet, { to: e.to })); }
          paintPads();
          paintBoardLabel();
        });
        at(T.ride, () => {});
      } else if (e.type === "home") {
        at(T.hop, () => {
          SFX.home();
          sayPlay(fill(game.board.game === "dice" ? SAY.homeMoon : SAY.homeTrail, { n: nameOf(e.seat) }));
          paintPads();
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
    const faces = party.querySelectorAll(".bn-party__face");
    for (let i = 0; i < 2; i++) faces[i].innerHTML = R.faceHTML(seatPerson(i));
    party.hidden = false;
    party.__shownAt = now();
    sayPlay(game.board.game === "dice" ? SAY.endMoon : SAY.endTrail);
    try { if (global.JoshAudio && !global.JoshAudio.isMuted() && playVisible()) global.JoshAudio.winCue(); } catch (e) { /* ignore */ }
    try { if (global.JoshEffects && playVisible()) global.JoshEffects.confetti(); } catch (e) { /* ignore */ }
  }
  function hideParty() { if (party) party.hidden = true; }

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
    if (st.phase === "done") { say(game.board.game === "dice" ? SAY.endMoon : SAY.endTrail); return; }
    const i = st.turn;
    if (st.seats[i].cpu) { say(fill(SAY.turn, { n: nameOf(i) })); return; }
    if (game.board.game === "cards") say(fill(SAY.turn, { n: nameOf(i) }) + " " + SAY.flipFirst);
    else if (st.phase === "hop") say(SAY.hopFirst);
    else say(fill(SAY.turn, { n: nameOf(i) }) + " " + SAY.rollFirst);
    showHand(i);
    later(hideHand, 2600);
  }

  function leavePlay() {
    clearLater();
    hideHand();
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
      if (opts && opts.introSeen) { save.intro.dice = true; save.intro.cards = true; }
      if (opts && opts.done) Object.assign(save.done, opts.done);
      // a reset WRITES, it does not fold: persist() keeps the larger of each
      // finished-games count and ORs "has been shown how", so a reset through
      // it would bring the old progress straight back (Gobble's resetProgress
      // lesson; a test caught it here, Comet Moon staying unlocked)
      try { global.localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* private mode */ }
    },
    // Start a game with a chosen seed (so a test knows the dice), as the who
    // screen would.
    start(box, friend, cpu, seed, first) {
      const b = DATA.box(box);
      const st = L.create({ board: b.board, seats: [{ who: "josh" }, { who: friend, cpu: !!cpu }], seed: seed || 1, first: first || 0 });
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
