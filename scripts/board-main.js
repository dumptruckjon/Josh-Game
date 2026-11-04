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
  // the games whose FIRST game teaches its rule with a glow (see `teach`)
  const TEACH = ["doors", "dominoes", "acorns", "nim", "lines", "top", "grab", "match3", "maze"];
  // the games whose BOARD is the buttons, so a pad only says whose turn it is
  // (and the ⭐s): on a short phone those pads give way to the board
  // The games that draw their OWN board (no track picture, no tokens): ONE
  // list, where there used to be the same eleven names typed out three times
  const OWN_BOARD = ["spot", "pairs", "doors", "acorns", "dominoes", "dig", "nim", "lines", "top", "grab", "match3", "maze"];
  const PAD_TURN = ["pairs", "acorns", "dominoes", "dig", "nim", "lines", "top", "grab", "match3", "maze"];
  const KEY = "josh-board-v1";
  // A double-tap is a PLACE and a TIME (the framework's echo guard): a screen
  // that has just appeared ignores a finger for this long.
  const ECHO_MS = 350;
  // A game in progress waits on its box until the next day (decision 9).
  const KEEP_MS = 24 * 60 * 60 * 1000;
  // The pace of everything that is NOT his finger: the dice tumbling, a hop,
  // a ride, the hand-over, and the computer friend's turn.
  const T = { tumble: 700, hop: 240, autoHop: 480, cpuThink: 900, cpuHop: 560, ride: 900, card: 520, glide: 300, handoff: 700, pop: 700, cheer: 1400, tip: 1000, ten: 520, look: 1500 };
  const now = () => (global.performance && global.performance.now ? global.performance.now() : Date.now());
  const $ = (sel, root) => (root || doc).querySelector(sel);
  const fill = (line, o) => String(line).replace(/\{(\w+)\}/g, (m, k) => (o && o[k] != null ? o[k] : m));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---- The save -------------------------------------------------------------
  // games: the game in progress per box ({ st, at }) · done: games finished per
  // box · intro: whether he has been shown how (dice / cards) · auto: the
  // grown-up "hop by itself" switch · next: who starts the next two-person
  // game per box · last: the last box and its players.
  // "has been shown how", per kind of game (each kind's first-time hand)
  const INTRO = ["dice", "cards", "spin", "hen", "lotto", "spot", "pairs", "doors", "acorns", "dominoes", "dig", "nim", "lines", "top", "grab", "match3", "maze"];
  function freshSave() { const intro = {}; for (const k of INTRO) intro[k] = false; return { v: 1, games: {}, done: {}, intro, auto: false, next: {}, last: null }; }
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
    if (isObj(raw.intro)) for (const k of INTRO) s.intro[k] = raw.intro[k] === true;
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
    for (const k of INTRO) save.intro[k] = save.intro[k] || disk.intro[k];
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
    ten: () => notes([[392, 0, { type: "triangle" }], [523.25, 120, { type: "triangle", duration: 0.25 }]]),
  };

  // ---- The screens -----------------------------------------------------------
  let shelf = null, who = null, pick = null, play = null;
  let boardEl = null, svgWrap = null, tokens = [null, null], pads = [null, null], hand = null, party = null;
  let applesEl = null, popEl = null, markEl = null, coopEl = null, spotsEl = null, pairsEl = null, doorsEl = null, acornsEl = null, domEl = null, digEl = null, nimEl = null, linesEl = null, topEl = null, grabEl = null, m3El = null, mazeEl = null, chooseEl = null, targetEls = [];
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
      // two shelves: the LUCK games and the THINKING games (the owner,
      // 2026-11-04: "at least some going forward need skill vs pure luck")
      '<div class="bn-shelves"></div>' +
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
          // 🎲 Pick a Die: the square each die would take him to, wearing that
          // die's dots
          '<div class="bn-target" aria-hidden="true" hidden></div><div class="bn-target" aria-hidden="true" hidden></div>' +
          // 🐔 the chicks home in the hen house, counted as she brings them
          '<div class="bn-coop" aria-hidden="true" hidden></div>' +
          // 🍎 the apples that move (in the baskets, the pie, and flying)
          '<div class="bn-apples" aria-hidden="true"></div>' +
          // 👀 Twin Spot: the middle card (pictures) and the flipped card (its
          // four pictures are the buttons: find the one on both)
          '<div class="bn-spots" hidden><div class="bn-spotcard bn-spotcard--mid" aria-hidden="true"></div><div class="bn-spotcard bn-spotcard--hand" role="group" aria-label="The card you flipped"></div></div>' +
          // 🧠 Peek-a-Pair: the nine cards, face down (each a button)
          '<div class="bn-pairs" role="group" aria-label="The cards" hidden></div>' +
          // 🌰 Acorn Pots: the ring of pots and the two nests (his pots are
          // the buttons)
          '<div class="bn-acorns" role="group" aria-label="The pots" hidden></div>' +
          // 🏴‍☠️ Treasure Dig: nine sand squares (each a button to dig)
          '<div class="bn-dig" role="group" aria-label="The sand" hidden></div>' +
          // 🍪 Cookie Jar: the jar (the cookies in it, the golden one at the
          // bottom) over the takes — one, two or three (the buttons)
          // 🔴 Line Up: three columns (each a button: the counter drops to its
          // bottom), five slots high
          '<div class="bn-lines" role="group" aria-label="The board" hidden></div>' +
          // 🃏 Top Card: the table (each player's card this trick, under their
          // face) over the hand of three (the buttons)
          // 🎨 Colour Grab: the grid (a picture: each patch outlined in its
          // player's colour) over the three colours to pick (the buttons)
          '<div class="bn-grab" hidden><div class="bn-grab__grid" role="img"></div><div class="bn-grab__pick" role="group" aria-label="Pick a colour"></div></div>' +
          '<div class="bn-top" hidden><div class="bn-top__table" aria-hidden="true"></div><div class="bn-top__hand" role="group" aria-label="Your cards"></div></div>' +
          '<div class="bn-maze" hidden><div class="bn-maze__grid" role="img"></div><div class="bn-maze__hand" role="group" aria-label="Your arrow cards"></div></div>' +
          '<div class="bn-m3" hidden><div class="bn-m3__dice" role="group" aria-label="The three dice"></div><div class="bn-m3__roll"></div></div>' +
          '<div class="bn-nim" hidden><div class="bn-jar" role="img"></div><div class="bn-take" role="group" aria-label="How many cookies?"></div></div>' +
          // 🁢 Dot Dominoes: the line's two open ends (big; buttons while a
          // tile waits for him to choose), the line itself small between
          // them, and the mover's hand (the tiles are buttons)
          '<div class="bn-dom" hidden><div class="bn-dom__row"><span class="bn-dom__end" data-side="left"></span><div class="bn-dom__line" aria-hidden="true"></div><span class="bn-dom__end" data-side="right"></span></div><div class="bn-dom__hand" role="group" aria-label="The tiles"></div></div>' +
          // 🚪 Shut the Doors: the waiting player's doors (small), and the
          // mover's six (big buttons: tap the ones that make the roll)
          '<div class="bn-doors" hidden><div class="bn-doors__other" role="group"></div><div class="bn-doors__grid" role="group" aria-label="The doors"></div></div>' +
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
        // 🎲 Pick a Die: the two dice to pick from, over the pads while he picks
        '<div class="bn-choose" role="group" aria-label="Pick a die" hidden></div>' +
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
    spotsEl = play.querySelector(".bn-spots");
    spotsEl.addEventListener("click", (e) => {
      const b = e.target.closest(".bn-twin");
      if (b && spotsEl.contains(b) && b.tagName === "BUTTON") pickTwin(Number(b.dataset.p), b);
    });
    doorsEl = play.querySelector(".bn-doors");
    doorsEl.addEventListener("click", (e) => {
      const b = e.target.closest(".bn-door");
      if (b && doorsEl.contains(b) && b.tagName === "BUTTON") tapDoor(Number(b.dataset.n), b);
    });
    pairsEl = play.querySelector(".bn-pairs");
    pairsEl.addEventListener("click", (e) => {
      const b = e.target.closest(".bn-pc");
      if (b && pairsEl.contains(b) && b.tagName === "BUTTON") tapPair(Number(b.dataset.k), b);
    });
    digEl = play.querySelector(".bn-dig");
    digEl.addEventListener("click", (e) => {
      const b = e.target.closest(".bn-sand");
      if (b && digEl.contains(b) && b.tagName === "BUTTON") tapDig(Number(b.dataset.k), b);
    });
    grabEl = play.querySelector(".bn-grab");
    grabEl.addEventListener("click", (e) => {
      const b = e.target.closest(".bn-swatch");
      if (b && grabEl.contains(b) && b.tagName === "BUTTON") tapSwatch(b.dataset.c, b);
    });
    topEl = play.querySelector(".bn-top");
    topEl.addEventListener("click", (e) => {
      const b = e.target.closest(".bn-tc");
      if (b && topEl.contains(b) && b.tagName === "BUTTON") tapCard(Number(b.dataset.v), b);
    });
    linesEl = play.querySelector(".bn-lines");
    linesEl.addEventListener("click", (e) => {
      const b = e.target.closest(".bn-col");
      if (b && linesEl.contains(b) && b.tagName === "BUTTON") tapColumn(Number(b.dataset.c), b);
    });
    mazeEl = play.querySelector(".bn-maze");
    mazeEl.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b && mazeEl.contains(b) && b.dataset.k != null) tapArrow(Number(b.dataset.k), b);
    });
    m3El = play.querySelector(".bn-m3");
    m3El.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || !m3El.contains(b)) return;
      if (b.classList.contains("bn-m3roll")) tapRoll3(b);
      else if (b.dataset.k != null) tapKeep(Number(b.dataset.k), b);
    });
    nimEl = play.querySelector(".bn-nim");
    nimEl.addEventListener("click", (e) => {
      const b = e.target.closest(".bn-takeb");
      if (b && nimEl.contains(b) && b.tagName === "BUTTON") tapTake(Number(b.dataset.n), b);
    });
    domEl = play.querySelector(".bn-dom");
    domEl.addEventListener("click", (e) => {
      const t = e.target.closest("button.bn-domt, button.bn-dom__end");
      if (!t || !domEl.contains(t)) return;
      if (t.classList.contains("bn-dom__end")) tapEnd(t.dataset.side, t);
      else tapTile(t.dataset.id, t);
    });
    acornsEl = play.querySelector(".bn-acorns");
    acornsEl.addEventListener("click", (e) => {
      const b = e.target.closest(".bn-pot");
      if (b && acornsEl.contains(b) && b.tagName === "BUTTON") tapPot(Number(b.dataset.k), b);
    });
    popEl = play.querySelector(".bn-pop");
    markEl = play.querySelector(".bn-mark");
    targetEls = [...play.querySelectorAll(".bn-target")];
    chooseEl = play.querySelector(".bn-choose");
    chooseEl.addEventListener("click", (e) => {
      const b = e.target.closest(".bn-pickd");
      if (b && chooseEl.contains(b) && b.tagName === "BUTTON") tapChoose(Number(b.dataset.k), b);
    });
    coopEl = play.querySelector(".bn-coop");
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
  const KINDS = [
    { id: "luck", head: "🎲 Lucky games", label: "Lucky games" },
    { id: "think", head: "🧠 Thinking games", label: "Thinking games" },
  ];
  function paintShelf() {
    const wrap = shelf.querySelector(".bn-shelves");
    wrap.innerHTML = "";
    for (const kind of KINDS) {
      const open = DATA.BOXES.filter((b) => (b.kind || "luck") === kind.id && boxOpen(b));
      if (!open.length) continue;
      const head = doc.createElement("h2");
      head.className = "bn-shelves__head";
      head.textContent = kind.head;
      wrap.appendChild(head);
      const list = doc.createElement("div");
      list.className = "bn-boxes";
      list.dataset.kind = kind.id;
      list.setAttribute("role", "list");
      list.setAttribute("aria-label", kind.label);
      wrap.appendChild(list);
      paintBoxes(list, open);
    }
    const auto = shelf.querySelector(".bn-auto");
    auto.textContent = save.auto ? "Grown-ups: hops by themselves" : "Grown-ups: hops by tap";
    auto.setAttribute("aria-pressed", save.auto ? "true" : "false");
  }
  function paintBoxes(list, open) {
    // Two columns: rows of single boxes put the last one below the fold of a
    // small phone. An ODD shelf's last box spans both columns (the front
    // door's wide door), so no row is ragged.
    list.dataset.cols = open.length >= 2 ? "2" : "1";
    list.dataset.odd = open.length >= 2 && open.length % 2 ? "1" : "0";
    for (const b of open) {
      const btn = doc.createElement("button");
      btn.className = "bn-box tap";
      btn.type = "button";
      btn.setAttribute("role", "listitem");
      btn.dataset.box = b.id;
      btn.style.borderBottomColor = b.colour;
      const g = save.games[b.id], played = save.done[b.id] || 0;
      btn.setAttribute("aria-label", b.name + (played ? ", played " + played + (played === 1 ? " time" : " times") : "") + (g ? ", a game is waiting" : ""));
      btn.innerHTML = '<span class="bn-box__pic" aria-hidden="true">' + (b.art === "domino" ? domSVG(5, 2, false) : b.pic) + "</span>" +
        // every game finished here earns the box a 🏆 — he sees the pile grow
        (played ? '<span class="bn-box__won" aria-hidden="true">🏆 ' + played + "</span>" : "") +
        '<span class="bn-box__label">' + b.name + "</span>" +
        // a game waiting on this box shows its two players peeking out
        (g ? '<span class="bn-box__wait" aria-hidden="true">' + g.st.seats.map((s) => '<span class="bn-box__peek">' + R.faceHTML(DATA.person(s.who)) + "</span>").join("") + "</span>" : "");
      btn.addEventListener("click", () => { location.hash = "#board-who-" + b.id; });
      list.appendChild(btn);
    }
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
    // the 🦊 joins Hen House from his third game there (the same rule)
    const fox = b.foxAfter != null && (save.done[box] || 0) >= b.foxAfter;
    const st = L.create({ board: b.board, seats: [{ who: "josh" }, { who: friend, cpu }], seed, first, birds, fox });
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
    game = { box, st, board, friend: st.seats[1].who, cpu: st.seats[1].cpu, busy: false, hopUntil: 0, counted: st.phase === "done", // the FIRST game of a game with a rule to learn TEACHES it: what fits glows
      // from the start (🚪 a way to make the roll · 🁢 the tiles that match an end
      // · 🌰 the pot whose last acorn lands in his own nest); after that it glows
      // only after two misses (🚪 🁢) or not at all (🌰 — counting IS the skill)
      teach: TEACH.indexOf(board.game) >= 0 && !save.intro[board.game] };
    play.querySelector(".bn-title").textContent = DATA.box(box).name;
    play.dataset.game = board.game;
    play.dataset.pad = PAD_TURN.indexOf(board.game) >= 0 ? "turn" : "act";
    play.dataset.box = box;
    boardEl.classList.toggle("bn-board--chart", board.layout === "chart");
    svgWrap.innerHTML = OWN_BOARD.indexOf(board.game) >= 0 ? "" : board.game === "spin" ? R.orchardSVG() : board.game === "lotto" ? R.picnicSVG(board, st.seats.map((s) => DATA.person(s.who).colour)) : R.boardSVG(board);
    applesEl.innerHTML = "";
    hidePop();
    hideMark();
    endRides();
    endCheer();
    const farm = board.game === "hen";
    for (let i = 0; i < 2; i++) {
      const p = seatPerson(i);
      // 🐔 co-op: ONE token, the hen, that both players walk home
      // 🧺 a picnic has no tokens at all: the foods are the pieces
      tokens[i].hidden = (farm && i === 1) || board.game === "lotto" || OWN_BOARD.indexOf(board.game) >= 0;
      tokens[i].querySelector(".bn-token__face").innerHTML = farm ? '<span class="bn-emoji">🐔</span>' : R.faceHTML(p);
      tokens[i].style.borderColor = farm ? "#c2410c" : p.colour;
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
    spotsEl.hidden = b.game !== "spot";
    pairsEl.hidden = b.game !== "pairs";
    doorsEl.hidden = b.game !== "doors";
    acornsEl.hidden = b.game !== "acorns";
    domEl.hidden = b.game !== "dominoes";
    digEl.hidden = b.game !== "dig";
    nimEl.hidden = b.game !== "nim";
    m3El.hidden = b.game !== "match3";
    mazeEl.hidden = b.game !== "maze";
    linesEl.hidden = b.game !== "lines";
    topEl.hidden = b.game !== "top";
    grabEl.hidden = b.game !== "grab";
    if (b.game === "grab") return layoutGrab(w, h);
    if (b.game === "top") return layoutTop(w, h);
    if (b.game === "lines") return layoutLines(w, h);
    if (b.game === "dig") return layoutDig(w, h);
    if (b.game === "nim") return layoutNim(w, h);
    if (b.game === "match3") return layoutM3(w, h);
    if (b.game === "maze") return layoutMaze(w, h);
    if (b.game === "dominoes") return layoutDom(w, h);
    if (b.game === "acorns") return layoutAcorns(w, h);
    if (b.game === "doors") return layoutDoors(w, h);
    if (b.game === "spot") return layoutSpot(w, h);
    if (b.game === "pairs") return layoutPairs(w, h);
    const cell = Math.max(20, Math.floor(Math.min(w / b.cols, h / b.rows)));
    boardEl.style.width = cell * b.cols + "px";
    boardEl.style.height = cell * b.rows + "px";
    boardEl.style.left = Math.max(0, Math.round((w - cell * b.cols) / 2)) + "px";
    boardEl.style.top = Math.max(0, Math.round((h - cell * b.rows) / 2)) + "px";
    // (on a hundred chart the token is a ring round its whole square)
    const tk = Math.round(cell * (b.layout === "chart" ? 1 : 0.62));
    for (const t of tokens) { t.style.width = tk + "px"; t.style.height = tk + "px"; }
    // the pop and the apples scale with the board (an apple fills its slot)
    popEl.style.fontSize = Math.max(18, Math.round(cell * 0.5)) + "px";
    applesEl.style.fontSize = Math.round(cell * 0.4) + "px";
  }

  // 👀 Twin Spot fills its field with two cards: the flipped one (four 75px+
  // buttons, 16px apart) and the middle one (pictures only, smaller). Side by
  // side or stacked, whichever gives the BUTTONS more room.
  function layoutSpot(w, h) {
    const PAD = 6, GAP = 16, MGAP = 6, BETWEEN = 12, MID = 0.5;
    const side = Math.min((w - 2 * PAD - GAP - BETWEEN - 2 * PAD - MGAP) / (2 + 2 * MID), (h - 2 * PAD - GAP) / 2);
    const stack = Math.min((w - 2 * PAD - GAP) / 2, (h - 2 * PAD - GAP - BETWEEN - 2 * PAD - MGAP) / (2 + 2 * MID));
    const stacked = stack > side;
    const s = Math.max(40, Math.floor(Math.min(130, stacked ? stack : side)));
    spotsEl.classList.toggle("bn-spots--stack", stacked);
    spotsEl.style.setProperty("--twin", s + "px");
    spotsEl.style.setProperty("--mid", Math.floor(s * MID) + "px");
    boardEl.style.width = w + "px";
    boardEl.style.height = h + "px";
    boardEl.style.left = "0px";
    boardEl.style.top = "0px";
  }
  // 🧠 Peek-a-Pair's nine cards: as many across as gives them the most room
  // (three by three on a phone held upright, a wider row on its side), every
  // card 75px+ and 16px from the next
  function layoutPairs(w, h) {
    const GAP = 16, n = game.board.pairsPer * 2 + 1;
    // a card may be a little wider than tall (a playing card on its side):
    // on a short phone that is what keeps it 75px tall
    let best = { ch: 0, cw: 0, cols: 3 };
    for (const cols of [3, 4, 5]) {
      const rows = Math.ceil(n / cols);
      const sw = Math.floor((w - (cols - 1) * GAP) / cols), sh = Math.floor((h - (rows - 1) * GAP) / rows);
      const ch = Math.min(sh, sw, 140), cw = Math.min(sw, Math.round(ch * 1.15));
      if (ch > best.ch || (ch === best.ch && cw > best.cw)) best = { ch, cw, cols };
    }
    const ch = Math.max(40, best.ch), cw = Math.max(40, best.cw);
    pairsEl.style.setProperty("--pch", ch + "px");
    pairsEl.style.setProperty("--pcw", cw + "px");
    pairsEl.style.setProperty("--pcols", String(best.cols));
    pairsEl.style.fontSize = Math.round(Math.min(cw, ch) * 0.55) + "px";
    boardEl.style.width = w + "px";
    boardEl.style.height = h + "px";
    boardEl.style.left = "0px";
    boardEl.style.top = "0px";
  }
  // 🚪 the mover's six doors three by two, as big as the field allows, under
  // the waiting player's six small ones
  function layoutDoors(w, h) {
    const GAP = 16, STRIP = 40;
    const cell = Math.max(40, Math.floor(Math.min((w - 2 * GAP) / 3, (h - STRIP - GAP - GAP) / 2, 130)));
    doorsEl.style.setProperty("--door", cell + "px");
    doorsEl.style.fontSize = Math.round(cell * 0.5) + "px";
    boardEl.style.width = w + "px";
    boardEl.style.height = h + "px";
    boardEl.style.left = "0px";
    boardEl.style.top = "0px";
  }
  // The doors shown follow the turn ON SCREEN (`game.showMover`) and the
  // shut doors as they were SHOWN (`game.shownShut`): the engine has already
  // handed the turn over while the doors are still closing
  function paintDoors() {
    if (!game || game.board.game !== "doors") return;
    const st = game.st, m = game.showMover == null ? st.mover : game.showMover, o = 1 - m;
    const shut = game.shownShut, live = st.phase === "shut" && st.mover === m;
    // the FIRST game teaches: a way to make the roll glows from the start;
    // after that it glows only after two misses
    const ways = live && (st.misses >= 2 || game.teach) ? L.doorWays(st) : [];
    const hint = ways.length ? (ways.find((x) => st.held == null || x.indexOf(st.held) >= 0) || ways[0]) : [];
    const cpu = st.phase !== "done" && st.seats[game.showTurn == null ? st.turn : game.showTurn].cpu;
    let html = "";
    for (let n = 1; n <= 6; n++) {
      // a SHUT door is a closed wooden door (its number small on it); an
      // OPEN one is a lit doorway showing its number AND its dots, the die's
      // own dots, so he can match the roll by counting
      if (shut[m].indexOf(n) >= 0) { html += '<span class="bn-door bn-door--shut' + (game.doorsGo && game.doorsGo.indexOf(n) >= 0 ? " bn-door--go" : "") + '" aria-hidden="true"><span class="bn-door__n">' + n + "</span></span>"; continue; }
      const held = live && st.held === n;
      html += '<button class="bn-door tap' + (held ? " bn-door--held" : "") + (hint.indexOf(n) >= 0 && !held ? " bn-door--hint" : "") +
        '" type="button" data-n="' + n + '" aria-label="Door ' + n + (held ? ", held" : "") + '"><span class="bn-door__n">' + n + "</span>" + pipsHTML(n) + "</button>";
    }
    const grid = doorsEl.querySelector(".bn-doors__grid");
    grid.innerHTML = html;
    grid.setAttribute("aria-label", nameOf(m) + "'s doors");
    grid.classList.toggle("bn-doors__grid--cpu", !!cpu);
    grid.style.borderColor = seatPerson(m).colour;
    // the row above the doors: WHOSE doors these are (their face), then what
    // to make — the roll's dots and its number, or, with a door held,
    // "held + ? = roll" — so the goal sits beside the doors, not down on the pad
    let goal = '<span class="bn-doors__face">' + R.faceHTML(seatPerson(m)) + "</span>";
    if (live) {
      const want = '<span class="bn-goal__die">' + pipsHTML(st.die) + '</span><span class="bn-goal__n">' + st.die + "</span>";
      goal += st.held != null
        ? '<span class="bn-goal__die">' + pipsHTML(st.held) + '</span><span class="bn-goal__op">+</span><span class="bn-goal__q">?</span><span class="bn-goal__op">=</span>' + want
        : '<span class="bn-goal__op">🎯</span>' + want;
    }
    const row = doorsEl.querySelector(".bn-doors__other");
    row.innerHTML = goal;
    row.setAttribute("aria-label", live ? (st.held != null ? st.held + " and what make " + st.die : "Make " + st.die) : nameOf(m) + "'s doors");
  }
  // a door's (or the goal's) dots: the die's own pattern, small
  function pipsHTML(n) {
    const on = DOTS[n] || [];
    let s = '<span class="bn-pips" aria-hidden="true">';
    for (let k = 0; k < 9; k++) s += '<span class="bn-pip' + (on.indexOf(k) < 0 ? " bn-pip--none" : "") + '"></span>';
    return s + "</span>";
  }
  function tapDoor(n, btn) {
    if (!game || game.board.game !== "doors" || game.busy || !playVisible()) return;
    const st = game.st;
    if (st.phase !== "shut") return;
    if (btn && st.seats[st.turn].cpu) return;   // the computer's turn
    const ev = L.shutDoor(st, n);
    if (!ev.length) return;   // a shut door, or the one already held (the echo)
    hideHand();
    const e = ev[0];
    if (e.type === "hold") {
      SFX.plop(n);
      sayPlay(fill(SAY.doorsHold, { a: n, d: st.die }));
      paintDoors();
      persistGame();
      return;
    }
    if (e.type === "miss") {
      // not a way to make the roll: a kind wiggle (after two, a way glows)
      paintDoors();
      const again = doorsEl.querySelector('.bn-door[data-n="' + n + '"]');
      if (again) wiggle(again);
      sayPlay(fill(SAY.doorsMiss, { d: st.die }));
      persistGame();
      return;
    }
    if (!save.intro.doors && !st.seats[e.seat].cpu) { save.intro.doors = true; persist(); }
    playEvents(ev);
  }
  function cpuDoors() {
    if (!game || game.board.game !== "doors") return;
    if (!playVisible()) { game.cpuWaiting = true; return; }
    const st = game.st;
    if (game.busy || st.phase !== "shut" || !st.seats[st.turn].cpu) return;
    const way = L.doorChoice(st);
    tapDoor(way[0], null);
    if (way.length > 1) later(() => { if (game && game.st.phase === "shut") tapDoor(way[1], null); }, T.cpuHop);
  }
  // after a roll: nothing fits (roll again), or tap the doors that make it
  function afterDoorsRoll(ev) {
    const st = game.st;
    if (ev.some((e) => e.type === "stuck")) {
      game.busy = true;
      sayPlay(fill(SAY.doorsNo, { d: st.die }));
      later(() => {
        if (!game) return;
        game.busy = false;
        paintPads();
        if (st.seats[st.turn].cpu) later(cpuTurn, T.cpuHop);
      }, T.look);
      return;
    }
    paintDoors();
    if (st.seats[st.turn].cpu) { later(cpuDoors, T.cpuHop); return; }
    sayPlay(fill(SAY.doorsPick, { d: st.die }));
  }
  // 🏴‍☠️ the nine squares, three by three, as big as the field allows
  function layoutDig(w, h) {
    const GAP = 16, cell = Math.max(40, Math.min(140, Math.floor((w - 2 * GAP) / 3), Math.floor((h - 2 * GAP) / 3)));
    digEl.style.setProperty("--sand", cell + "px");
    digEl.style.fontSize = Math.round(cell * 0.5) + "px";
    boardEl.style.width = w + "px";
    boardEl.style.height = h + "px";
    boardEl.style.left = "0px";
    boardEl.style.top = "0px";
  }
  // the arrow a dug square shows (with VS16: a picture, not a thin glyph)
  const ARROW = { "up-left": "↖️", up: "⬆️", "up-right": "↗️", left: "⬅️", right: "➡️", "down-left": "↙️", down: "⬇️", "down-right": "↘️" };
  const ARROW_SAY = { "up-left": "up and left", up: "up", "up-right": "up and right", left: "left", right: "right", "down-left": "down and left", down: "down", "down-right": "down and right" };
  // What the sand SHOWS (`game.gv`): the engine has buried the next treasure
  // while the found one is still glowing
  function digView() {
    const st = game.st, b = game.board, arrows = {};
    st.dug.forEach((d, k) => { if (d) arrows[k] = L.digDir(b, k, st.spot); });
    return { dug: st.dug.slice(), arrows, gem: -1, fresh: -1 };
  }
  function paintDig() {
    if (!game || game.board.game !== "dig" || !game.gv) return;
    const v = game.gv, st = game.st;
    const turn = game.showTurn == null ? st.turn : game.showTurn;
    const mine = st.phase === "dig" && !game.busy && !st.seats[turn].cpu;
    let html = "";
    v.dug.forEach((d, k) => {
      if (k === v.gem) { html += '<span class="bn-sand bn-sand--gem" role="img" aria-label="The treasure!"><span class="bn-sand__pic" aria-hidden="true">💎</span></span>'; return; }
      if (d) {
        const a = v.arrows[k];
        html += '<span class="bn-sand bn-sand--dug' + (k === v.fresh ? " bn-sand--fresh" : "") + '" role="img" aria-label="Dug: the arrow points ' + (ARROW_SAY[a] || "") + '"><span class="bn-sand__pic" aria-hidden="true">' + (ARROW[a] || "") + "</span></span>";
        return;
      }
      const cls = "bn-sand";
      html += mine ? '<button class="tap ' + cls + '" type="button" data-k="' + k + '" aria-label="Dig here"></button>' : '<span class="' + cls + ' bn-sand--still" role="img" aria-label="Sand"></span>';
    });
    digEl.innerHTML = html;
  }
  function tapDig(k, btn) {
    if (!game || game.board.game !== "dig" || game.busy || !playVisible()) return;
    const st = game.st;
    if (st.phase !== "dig") return;
    if (btn && st.seats[st.turn].cpu) return;
    const ev = L.digAt(st, k);
    if (!ev.length) return;   // a square already dug (the hammer's echo)
    hideHand();
    if (!save.intro.dig && !st.seats[ev[0].seat].cpu) { save.intro.dig = true; persist(); }
    playEvents(ev);
  }
  function cpuDig() {
    if (!game || game.board.game !== "dig") return;
    if (!playVisible()) { game.cpuWaiting = true; return; }
    const st = game.st;
    if (game.busy || st.phase !== "dig" || !st.seats[st.turn].cpu) return;
    tapDig(L.digChoice(st), null);
  }
  // 🎲 Pick a Die: the two dice (big buttons, over the pads) and, on the
  // board, the square each would take him to — wearing that die's dots, so
  // the button and its square are the same picture. His first game lights the
  // die that lands on a rocket (or, with none, the bigger one).
  function showChoice() {
    const st = game && game.st;
    if (!st || st.phase !== "choose" || !st.dice || st.dice.length !== 2) { hideChoice(); return; }
    const mine = !st.seats[st.turn].cpu, best = mine && game.teach ? L.dieBest(st) : [], b = game.board;
    const same = st.dice[0] === st.dice[1];
    let html = "";
    for (const k of same ? [0] : [0, 1]) {
      const to = L.dieTarget(st, k), j = L.jumpAt(b, to), rocket = j && j.kind === "boost" && to < b.size;
      const label = "Pick the " + st.dice[k] + ": to square " + to + (rocket ? ", a rocket" : to >= b.size ? ", the Moon" : "");
      html += mine
        ? '<button class="tap bn-pickd' + (best.indexOf(k) >= 0 ? " bn-pickd--hint" : "") + '" type="button" data-k="' + k + '" aria-label="' + label + '">' + dieHTML(st.dice[k], st.dice[k]) + '<span class="bn-pickd__to" aria-hidden="true">' + to + (rocket ? " 🚀" : "") + "</span></button>"
        : '<span class="bn-pickd bn-pickd--still" role="img" aria-label="' + label + '">' + dieHTML(st.dice[k], st.dice[k]) + '<span class="bn-pickd__to" aria-hidden="true">' + to + "</span></span>";
    }
    chooseEl.innerHTML = html;
    chooseEl.dataset.n = same ? "1" : "2";
    chooseEl.hidden = false;
    play.querySelector(".bn-tray").classList.add("bn-tray--choose");
    for (let k = 0; k < 2; k++) {
      const el = targetEls[k];
      if (same && k === 1) { el.hidden = true; continue; }
      const to = L.dieTarget(st, k), c = L.cellOf(b, to);
      el.style.left = (c.col / b.cols * 100) + "%";
      el.style.top = ((b.rows - 1 - c.row) / b.rows * 100) + "%";
      el.style.width = (100 / b.cols) + "%";
      el.style.height = (100 / b.rows) + "%";
      el.innerHTML = dieHTML(st.dice[k], st.dice[k]);
      el.dataset.n = String(to);
      el.hidden = false;
    }
  }
  function hideChoice() {
    if (chooseEl) { chooseEl.hidden = true; chooseEl.innerHTML = ""; }
    if (play) { const t = play.querySelector(".bn-tray"); if (t) t.classList.remove("bn-tray--choose"); }
    for (const el of targetEls) el.hidden = true;
  }
  function tapChoose(k, btn) {
    if (!game || game.busy || !playVisible()) return;
    const st = game.st;
    if (st.phase !== "choose") return;
    if (btn && st.seats[st.turn].cpu) return;
    const ev = L.chooseDie(st, k);
    if (!ev.length) return;
    // (gone in the same tap: a doubled tap must find nothing left to pick)
    hideChoice();
    hideHand();
    if (!save.intro.pickdie && !st.seats[st.turn].cpu) { save.intro.pickdie = true; persist(); }
    persistGame();
    playEvents(ev);
    // (the pick is not a hop, so it held the board: after its beat the hops
    // are his to tap — or the computer's, or the grown-up's auto-hop)
    later(() => {
      if (!game || game.st.phase !== "hop") return;
      game.busy = false;
      paintPads();
      if (game.st.seats[game.st.turn].cpu) later(cpuHop, T.cpuHop);
      else if (save.auto) autoHops();
      else if (!save.intro[introKey()]) { sayPlay(hopLine()); showHand(game.st.turn); }
    }, T.glide + 20);
  }
  function cpuChoose() {
    if (!game) return;
    if (!playVisible()) { game.cpuWaiting = true; return; }
    const st = game.st;
    if (game.busy || st.phase !== "choose" || !st.seats[st.turn].cpu) return;
    tapChoose(L.dieChoice(st), null);
  }
  // 🎨 the grid over the three colours, as big as the field allows
  function layoutGrab(w, h) {
    const b = game.board, GAP = 16, row = Math.max(80, Math.min(104, Math.floor(h * 0.22)));
    const cell = Math.max(18, Math.min(64, Math.floor(w / b.cols), Math.floor((h - row - GAP - 10) / b.rows)));
    grabEl.style.setProperty("--grab-w", cell * b.cols + "px");
    grabEl.style.setProperty("--grab-h", cell * b.rows + "px");
    grabEl.style.setProperty("--pick-h", row + "px");
    boardEl.style.width = w + "px";
    boardEl.style.height = h + "px";
    boardEl.style.left = "0px";
    boardEl.style.top = "0px";
  }
  // What the grid SHOWS (`game.gbv`): the squares grabbed this turn pulse
  function grabView() { const st = game.st; return { paint: st.paint.slice(), owner: st.owner.slice(), fresh: [] }; }
  // The grid as one picture: each square its colour and its white shape; each
  // patch outlined in its player's colour, with their face on its corner
  function grabSVG(v) {
    const b = game.board, C = b.cols, Rw = b.rows, U = 100, W = C * U, H = Rw * U;
    let sq = "", edge = "", pulse = "";
    for (let k = 0; k < v.paint.length; k++) {
      const col = DATA.colour(v.paint[k]), x = (k % C) * U, y = (Rw - 1 - Math.floor(k / C)) * U;
      sq += '<rect x="' + (x + 3) + '" y="' + (y + 3) + '" width="94" height="94" rx="16" fill="' + col.fill + '"/>';
      sq += '<g transform="translate(' + (x + 50) + " " + (y + 50) + ') scale(26)" fill="#ffffff" fill-opacity="0.9">' + R.shapePath(col.shape) + "</g>";
      if (v.fresh.indexOf(k) >= 0) pulse += '<rect class="bn-grab__fresh" x="' + (x + 6) + '" y="' + (y + 6) + '" width="88" height="88" rx="14"/>';
      const o = v.owner[k];
      if (o < 0) continue;
      // the patch's outline: every side that is not the same player's square
      const stroke = seatPerson(o).colour, same = (m) => m >= 0 && m < v.paint.length && v.owner[m] === o;
      const sides = [[k % C > 0 ? k - 1 : -1, x, y, x, y + U], [k % C < C - 1 ? k + 1 : -1, x + U, y, x + U, y + U], [k + C, x, y, x + U, y], [k - C, x, y + U, x + U, y + U]];
      for (const [m, x1, y1, x2, y2] of sides) if (!same(m)) edge += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + stroke + '" stroke-width="14" stroke-linecap="round"/>';
    }
    return '<svg class="bn-grab__svg" viewBox="-8 -8 ' + (W + 16) + " " + (H + 16) + '" aria-hidden="true" focusable="false">' + sq + pulse + '<g stroke-opacity="1">' + edge + "</g></svg>";
  }
  function paintGrab() {
    if (!game || game.board.game !== "grab" || !game.gbv) return;
    const v = game.gbv, st = game.st, b = game.board;
    const turn = game.showTurn == null ? st.turn : game.showTurn;
    const mine = st.phase === "pick" && !game.busy && !st.seats[turn].cpu;
    const grid = grabEl.querySelector(".bn-grab__grid");
    // each player's face sits on their corner (seat 0 the bottom left)
    grid.innerHTML = grabSVG(v) + [0, 1].map((j) => '<span class="bn-grab__who bn-grab__who--' + j + '" style="border-color:' + seatPerson(j).colour + '" aria-hidden="true">' + R.faceHTML(seatPerson(j)) + "</span>").join("");
    grid.setAttribute("aria-label", boardEl.getAttribute("aria-label") || "The grid");
    // the three colours: never the mover's own, never the friend's; his first
    // game lights the one that grabs the most
    const opts = st.phase === "pick" ? L.grabOptions(st) : [];
    const best = mine && game.teach ? L.grabBest(st) : [];
    let pick = "";
    for (const c of opts) {
      const col = DATA.colour(c), label = col.name + " " + col.shape;
      if (mine) pick += '<button class="tap bn-swatch' + (best.indexOf(c) >= 0 ? " bn-swatch--hint" : "") + '" type="button" data-c="' + c + '" aria-label="Pick ' + label + '">' + R.shapeSVG(c) + "</button>";
      else pick += '<span class="bn-swatch bn-swatch--still" role="img" aria-label="' + label + '">' + R.shapeSVG(c) + "</span>";
    }
    grabEl.querySelector(".bn-grab__pick").innerHTML = pick;
  }
  function tapSwatch(c, btn) {
    if (!game || game.board.game !== "grab" || game.busy || !playVisible()) return;
    const st = game.st;
    if (st.phase !== "pick") return;
    if (btn && st.seats[st.turn].cpu) return;
    const ev = L.grabColour(st, c);
    if (!ev.length) return;
    hideHand();
    if (!save.intro.grab && !st.seats[ev[0].seat].cpu) { save.intro.grab = true; persist(); }
    playEvents(ev);
  }
  function cpuGrab() {
    if (!game || game.board.game !== "grab") return;
    if (!playVisible()) { game.cpuWaiting = true; return; }
    const st = game.st;
    if (game.busy || st.phase !== "pick" || !st.seats[st.turn].cpu) return;
    tapSwatch(L.grabChoice(st), null);
  }
  // 🃏 the table (two cards side by side) over the hand of three
  function layoutTop(w, h) {
    const GAP = 16;
    // the hand first (three big buttons, a card 1.15 times as tall as wide),
    // then the table takes the height that is left (its two cards are only
    // looked at, so they may be smaller on a short phone)
    const hw = Math.max(75, Math.min(120, Math.floor((w - 2 * GAP) / 3))), hh = Math.max(75, Math.round(hw * 1.15));
    const room = h - hh - GAP - 14;
    const tw = Math.max(48, Math.min(150, Math.floor(room / 1.2), Math.floor((w - GAP) / 2) - 12));
    topEl.style.setProperty("--tc-w", hw + "px");
    topEl.style.setProperty("--tc-h", hh + "px");
    topEl.style.setProperty("--tt-w", tw + "px");
    topEl.style.fontSize = Math.round(Math.min(hw, tw) * 0.42) + "px";
    boardEl.style.width = w + "px";
    boardEl.style.height = h + "px";
    boardEl.style.left = "0px";
    boardEl.style.top = "0px";
  }
  // What the table SHOWS (`game.tv`): the engine has already cleared the
  // table and refilled the hands while the trick's winner is still glowing
  function topView() { const st = game.st; return { hands: st.hands.map((h) => h.slice()), table: st.table.slice(), win: null, fresh: -1 }; }
  // a number card: the numeral and its dots in a ten-frame (two rows of five)
  function numCardHTML(v) {
    let dots = "";
    for (let k = 0; k < 10; k++) dots += '<span class="bn-tc__dot' + (k < v ? "" : " bn-tc__dot--none") + '"></span>';
    return '<span class="bn-tc__n" aria-hidden="true">' + v + '</span><span class="bn-tc__dots" aria-hidden="true">' + dots + "</span>";
  }
  function paintTop() {
    if (!game || game.board.game !== "top" || !game.tv) return;
    const v = game.tv, st = game.st;
    const turn = game.showTurn == null ? st.turn : game.showTurn;
    const mine = (st.phase === "lead" || st.phase === "follow") && !game.busy && !st.seats[turn].cpu;
    // the table: each player's card under their face, in the pads' order
    // (his on the left, over his pad)
    let table = "";
    for (const j of [0, 1]) {
      const card = v.table[j], p = seatPerson(j);
      // (the face is a badge on the spot's corner, so the card keeps the height)
      table += '<span class="bn-top__spot' + (v.win === j ? " bn-top__spot--win" : "") + '" style="border-color:' + p.colour + '"><span class="bn-top__who" style="border-color:' + p.colour + '">' + R.faceHTML(p) + "</span>" +
        (card != null ? '<span class="bn-tc bn-tc--table' + (v.fresh === j ? " bn-tc--fresh" : "") + '">' + numCardHTML(card) + "</span>" : '<span class="bn-tc bn-tc--empty"></span>') + "</span>";
    }
    topEl.querySelector(".bn-top__table").innerHTML = table;
    // the hand: the player on the move (or, while the computer plays, his
    // own, so he can plan); his first game lights the saving card
    const hs = st.seats[turn].cpu ? 1 - turn : turn;
    const best = mine && game.teach && st.phase === "follow" ? L.topBest(st) : null;
    let hand = "";
    for (const c of v.hands[hs].slice().sort((x, y) => x - y)) {
      if (mine && hs === turn) hand += '<button class="tap bn-tc' + (c === best ? " bn-tc--hint" : "") + '" type="button" data-v="' + c + '" aria-label="Play ' + c + '">' + numCardHTML(c) + "</button>";
      else hand += '<span class="bn-tc bn-tc--still" role="img" aria-label="' + c + '">' + numCardHTML(c) + "</span>";
    }
    const handEl = topEl.querySelector(".bn-top__hand");
    handEl.innerHTML = hand;
    handEl.setAttribute("aria-label", nameOf(hs) + "'s cards");
    topEl.querySelector(".bn-top__table").setAttribute("aria-label", [0, 1].map((j) => nameOf(j) + (v.table[j] != null ? " played " + v.table[j] : " has not played")).join(". "));
  }
  function tapCard(c, btn) {
    if (!game || game.board.game !== "top" || game.busy || !playVisible()) return;
    const st = game.st;
    if (st.phase !== "lead" && st.phase !== "follow") return;
    if (btn && st.seats[st.turn].cpu) return;
    const ev = L.playCard(st, c);
    if (!ev.length) return;
    hideHand();
    if (!save.intro.top && !st.seats[ev[0].seat].cpu) { save.intro.top = true; persist(); }
    playEvents(ev);
  }
  function cpuTop() {
    if (!game || game.board.game !== "top") return;
    if (!playVisible()) { game.cpuWaiting = true; return; }
    const st = game.st;
    if (game.busy || (st.phase !== "lead" && st.phase !== "follow") || !st.seats[st.turn].cpu) return;
    tapCard(L.topChoice(st), null);
  }
  // 🔴 three columns, five slots high, as big as the field allows
  function layoutLines(w, h) {
    const b = game.board, GAP = 16, PAD = 8, SGAP = 6;
    const colW = Math.max(75, Math.min(130, Math.floor((w - (b.cols - 1) * GAP) / b.cols)));
    const slot = Math.max(30, Math.min(colW - 2 * PAD, Math.floor((h - 8 - 2 * PAD - (b.rows - 1) * SGAP) / b.rows)));
    linesEl.style.setProperty("--col-w", colW + "px");
    linesEl.style.setProperty("--slot", slot + "px");
    boardEl.style.width = w + "px";
    boardEl.style.height = h + "px";
    boardEl.style.left = "0px";
    boardEl.style.top = "0px";
  }
  // What the board SHOWS (`game.lv`): the counters, the cells of the lines
  // made (they glow), and the counter just dropped (it falls in)
  function linesView() {
    const st = game.st, b = game.board, lines = [];
    for (const ln of L.linesOf(b)) if (st.grid[ln[0]] >= 0 && ln.every((k) => st.grid[k] === st.grid[ln[0]])) lines.push(...ln);
    return { grid: st.grid.slice(), lines, fresh: -1 };
  }
  function paintLines() {
    if (!game || game.board.game !== "lines" || !game.lv) return;
    const v = game.lv, st = game.st, b = game.board;
    const turn = game.showTurn == null ? st.turn : game.showTurn;
    const mine = st.phase === "drop" && !game.busy && !st.seats[turn].cpu;
    // his first game: the column that makes his line (or stops his friend's)
    const best = mine && game.teach ? L.linesBest(st) : [];
    let html = "";
    for (let c = 0; c < b.cols; c++) {
      let slots = "";
      for (let r = b.rows - 1; r >= 0; r--) {
        const k = r * b.cols + c, g = v.grid[k];
        if (g < 0) { slots += '<span class="bn-slot"></span>'; continue; }
        slots += '<span class="bn-slot bn-slot--on' + (v.lines.indexOf(k) >= 0 ? " bn-slot--line" : "") + (k === v.fresh ? " bn-slot--fresh" : "") + '" style="border-color:' + seatPerson(g).colour + '">' + R.faceHTML(seatPerson(g)) + "</span>";
      }
      const full = L.dropRow(st, c) < 0;
      const filled = v.grid.filter((x, k) => k % b.cols === c && x >= 0).length;
      const label = "Column " + (c + 1) + ": " + (full ? "full" : filled + (filled === 1 ? " counter" : " counters"));
      if (mine && !full) html += '<button class="tap bn-col' + (best.indexOf(c) >= 0 ? " bn-col--hint" : "") + '" type="button" data-c="' + c + '" aria-label="' + label + ', drop here">' + slots + "</button>";
      else html += '<span class="bn-col bn-col--still' + (full ? " bn-col--full" : "") + '" role="img" aria-label="' + label + '">' + slots + "</span>";
    }
    linesEl.innerHTML = html;
  }
  function tapColumn(c, btn) {
    if (!game || game.board.game !== "lines" || game.busy || !playVisible()) return;
    const st = game.st;
    if (st.phase !== "drop") return;
    if (btn && st.seats[st.turn].cpu) return;
    const ev = L.dropLine(st, c);
    if (!ev.length) return;   // a full column (or the hammer's echo)
    hideHand();
    if (!save.intro.lines && !st.seats[ev[0].seat].cpu) { save.intro.lines = true; persist(); }
    playEvents(ev);
  }
  function cpuLines() {
    if (!game || game.board.game !== "lines") return;
    if (!playVisible()) { game.cpuWaiting = true; return; }
    const st = game.st;
    if (game.busy || st.phase !== "drop" || !st.seats[st.turn].cpu) return;
    tapColumn(L.linesChoice(st), null);
  }
  // 🐭 the garden over the three arrow cards, as big as the field allows
  function layoutMaze(w, h) {
    const b = game.board, GAP = 16, row = Math.max(80, Math.min(104, Math.floor(h * 0.22)));
    const cell = Math.max(30, Math.min(96, Math.floor((w - 8) / b.cols), Math.floor((h - row - GAP - 8) / b.rows)));
    mazeEl.style.setProperty("--maze-cell", cell + "px");
    mazeEl.style.setProperty("--maze-row", row + "px");
    boardEl.style.width = w + "px";
    boardEl.style.height = h + "px";
    boardEl.style.left = "0px";
    boardEl.style.top = "0px";
  }
  // What the garden SHOWS (`game.zv`): a mouse is still scurrying, and the
  // cheese still sits there being eaten, after the engine has moved on
  function mazeView() { const st = game.st; return { mice: st.mice.slice(), cheese: st.cheese, eaten: false, used: null }; }
  const ARROWS = ["⬆️", "⬇️", "⬅️", "➡️"];
  function paintMaze() {
    if (!game || game.board.game !== "maze" || !game.zv) return;
    const v = game.zv, st = game.st, b = game.board;
    const turn = game.showTurn == null ? st.turn : game.showTurn;
    const mine = st.phase === "move" && !game.busy && !st.seats[turn].cpu && st.turn === turn;
    let html = "";
    for (let r = 0; r < b.rows; r++) for (let c = 0; c < b.cols; c++) {
      const k = r * b.cols + c, here = [0, 1].filter((i) => v.mice[i] === k);
      let inner = "";
      if (st.pots.indexOf(k) >= 0) inner = '<span class="bn-maze__pot" aria-hidden="true">🪴</span>';
      else if (k === v.cheese) inner = '<span class="bn-maze__cheese' + (v.eaten ? " bn-maze__cheese--eaten" : "") + '" aria-hidden="true">🧀</span>';
      for (const i of here) inner += '<span class="bn-mouse bn-mouse--' + i + (here.length === 2 ? " bn-mouse--pair" : "") + (i === turn && st.phase !== "done" ? " bn-mouse--go" : "") + '" style="border-color:' + seatPerson(i).colour + '" aria-hidden="true">🐭</span>';
      html += '<span class="bn-maze__sq' + (st.pots.indexOf(k) >= 0 ? " bn-maze__sq--pot" : "") + '">' + inner + "</span>";
    }
    const grid = mazeEl.querySelector(".bn-maze__grid");
    grid.innerHTML = html;
    grid.setAttribute("aria-label", "The garden. " + [0, 1].map((i) => nameOf(i) + "'s mouse").join(" and ") + " and the cheese.");
    // the mover's three arrows: an arrow each step (one or two); his first
    // game lights the one that takes his mouse nearest the cheese
    const hand = st.phase === "move" ? st.hands[turn] : [];
    const best = mine && game.teach ? L.mazeBest(st) : [];
    let cards = "";
    hand.forEach((id, k) => {
      const n = (id & 1) + 1, word = L.MAZE_WORDS[id >> 1];
      const goes = L.mazePath(st, id, st.mice[turn]).length > 0;
      const pics = '<span class="bn-arrow__pic" aria-hidden="true">' + ARROWS[id >> 1].repeat(n) + "</span>";
      const label = (n === 1 ? "One step " : "Two steps ") + word + (goes ? "" : ", but the way is blocked");
      if (mine && goes && v.used == null) cards += '<button class="tap bn-arrow' + (best.indexOf(k) >= 0 ? " bn-arrow--hint" : "") + '" type="button" data-k="' + k + '" aria-label="' + label + '">' + pics + "</button>";
      else cards += '<span class="bn-arrow bn-arrow--still' + (v.used === id ? " bn-arrow--used" : "") + '" role="img" aria-label="' + label + '">' + pics + "</span>";
    });
    mazeEl.querySelector(".bn-maze__hand").innerHTML = cards;
  }
  function tapArrow(k, btn) {
    if (!game || game.board.game !== "maze" || game.busy || !playVisible()) return;
    const st = game.st;
    if (st.phase !== "move") return;
    if (btn && st.seats[st.turn].cpu) return;
    const ev = L.moveMouse(st, k);
    if (!ev.length) return;
    hideHand();
    if (!save.intro.maze && !st.seats[ev[0].seat].cpu) { save.intro.maze = true; persist(); }
    playEvents(ev);
  }
  function cpuMaze() {
    if (!game || game.board.game !== "maze") return;
    if (!playVisible()) { game.cpuWaiting = true; return; }
    const st = game.st;
    if (game.busy || st.phase !== "move" || !st.seats[st.turn].cpu) return;
    tapArrow(L.mazeChoice(st), null);
  }
  // 🎯 three big dice over the roll button, as big as the field allows (three
  // across fits a 320 phone: the tap ceiling)
  function layoutM3(w, h) {
    const GAP = 16, row = Math.max(80, Math.min(110, Math.floor(h * 0.26)));
    const die = Math.max(80, Math.min(150, Math.floor((w - 2 * GAP - 8) / 3), Math.floor(h - row - GAP - 40)));
    m3El.style.setProperty("--m3-die", die + "px");
    m3El.style.setProperty("--m3-roll", row + "px");
    boardEl.style.width = w + "px";
    boardEl.style.height = h + "px";
    boardEl.style.left = "0px";
    boardEl.style.top = "0px";
  }
  // What the dice SHOW (`game.mv`): before the first roll of a turn, three
  // dice to roll; the engine has already scored a turn while its last roll
  // is still tumbling
  function m3View() {
    const st = game.st, rolled = st.phase === "keep";
    return { dice: rolled ? st.dice.slice() : [0, 0, 0], held: rolled ? st.held.slice() : [false, false, false], left: rolled ? st.left : 0, rolling: false, glow: [] };
  }
  function paintM3() {
    if (!game || game.board.game !== "match3" || !game.mv) return;
    const v = game.mv, st = game.st;
    const turn = game.showTurn == null ? st.turn : game.showTurn;
    const mine = !game.busy && !st.seats[turn].cpu && st.turn === turn && (st.phase === "roll" || st.phase === "keep");
    const keeping = mine && st.phase === "keep" && !v.rolling;
    // his first game: the dice worth keeping glow (the ones that match)
    const hint = keeping && game.teach ? L.m3Keep(v.dice) : [false, false, false];
    let html = "";
    for (let k = 0; k < 3; k++) {
      const n = v.dice[k], held = v.held[k], go = v.rolling && !held;
      const cls = "bn-m3d" + (held ? " bn-m3d--held" : "") + (go ? " bn-m3d--go" : "") + (v.glow[k] ? " bn-m3d--win" : "") + (hint[k] && !held ? " bn-m3d--hint" : "");
      const face = go || !n ? dieHTML(0, 0) : dieHTML(n, n);
      const label = !n ? "A die to roll" : "A " + n + (held ? ", kept" : "");
      if (keeping) html += '<button class="tap ' + cls + '" type="button" data-k="' + k + '" aria-pressed="' + held + '" aria-label="' + label + (held ? ". Tap to roll it again" : ". Tap to keep it") + '">' + face + (held ? '<span class="bn-m3d__keep" aria-hidden="true">✋</span>' : "") + "</button>";
      else html += '<span class="' + cls + '" role="img" aria-label="' + label + '">' + face + (held ? '<span class="bn-m3d__keep" aria-hidden="true">✋</span>' : "") + "</span>";
    }
    m3El.querySelector(".bn-m3__dice").innerHTML = html;
    // the roll: three dice first, then the ones not kept (a dot per roll left)
    const left = st.phase === "keep" ? v.left : game.board.rerolls;
    const pips = '<span class="bn-m3roll__left" aria-hidden="true">' + "●".repeat(left) + "</span>";
    const label = st.phase === "keep" ? "Roll the dice not kept again. " + left + (left === 1 ? " roll left" : " rolls left") : "Roll the three dice";
    m3El.querySelector(".bn-m3__roll").innerHTML = mine && !v.rolling
      ? '<button class="tap bn-m3roll" type="button" aria-label="' + label + '"><span class="bn-m3roll__pic" aria-hidden="true">🎲</span>' + pips + "</button>"
      : '<span class="bn-m3roll bn-m3roll--still" role="img" aria-label="' + label + '"><span class="bn-m3roll__pic" aria-hidden="true">🎲</span>' + pips + "</span>";
  }
  function tapRoll3(btn) {
    if (!game || game.board.game !== "match3" || game.busy || !playVisible()) return;
    const st = game.st;
    if (st.phase !== "roll" && st.phase !== "keep") return;
    if (btn && st.seats[st.turn].cpu) return;
    const ev = L.rollMatch(st);
    if (!ev.length) return;
    hideHand();
    if (!save.intro.match3 && !st.seats[ev[0].seat].cpu) { save.intro.match3 = true; persist(); }
    playEvents(ev);
  }
  // keep (or let go of) a die: no wait, so it never holds the board
  function tapKeep(k, btn) {
    if (!game || game.board.game !== "match3" || game.busy || !playVisible()) return;
    const st = game.st;
    if (st.phase !== "keep" || game.mv.rolling) return;
    if (btn && st.seats[st.turn].cpu) return;
    const ev = L.holdDie(st, k);
    if (!ev.length) return;
    game.mv.held = st.held.slice();
    SFX.tick();
    paintM3();
    persistGame();
  }
  function cpuM3() {
    if (!game || game.board.game !== "match3") return;
    if (!playVisible()) { game.cpuWaiting = true; return; }
    const st = game.st;
    if (game.busy || !st.seats[st.turn].cpu) return;
    if (st.phase === "roll") return tapRoll3(null);
    if (st.phase !== "keep") return;
    const want = L.m3Choice(st);
    for (let k = 0; k < 3; k++) if (st.held[k] !== want[k]) L.holdDie(st, k);
    game.mv.held = st.held.slice();
    SFX.tick();
    paintM3();
    persistGame();
    game.busy = true;
    later(() => { if (!game) return; game.busy = false; tapRoll3(null); }, T.cpuThink);
  }
  // 🍪 the jar over the takes, as big as the field allows
  function layoutNim(w, h) {
    const GAP = 16, row = Math.max(80, Math.min(112, Math.floor(h * 0.24)));
    const jarH = Math.max(150, h - row - GAP - 8), jarW = Math.max(150, Math.min(w - 8, Math.round(jarH * 0.92), 340));
    nimEl.style.setProperty("--jar-w", jarW + "px");
    nimEl.style.setProperty("--jar-h", jarH + "px");
    nimEl.style.setProperty("--take-h", row + "px");
    // (a cookie is 1.25em and they stand 24% of the jar apart, so a cookie
    // never pokes out of its place or the jar)
    nimEl.style.fontSize = Math.round(Math.min(jarW, jarH) / 5.6) + "px";
    boardEl.style.width = w + "px";
    boardEl.style.height = h + "px";
    boardEl.style.left = "0px";
    boardEl.style.top = "0px";
  }
  // What the jar SHOWS (`game.cv`): the engine has already opened the next
  // jar while the golden cookie is still glowing
  function nimView() { const st = game.st; return { cookies: st.cookies, jar: st.jar, going: 0, gold: false }; }
  // where cookie k sits in the jar: four a row, filled from the bottom, the
  // golden one (k = 0) at the bottom, so it is the last one left
  function cookieAt(k) { const row = Math.floor(k / 4), col = k % 4; return { x: 14 + col * 24, y: 86 - row * 24 }; }
  function paintNim() {
    if (!game || game.board.game !== "nim" || !game.cv) return;
    const v = game.cv, st = game.st;
    const turn = game.showTurn == null ? st.turn : game.showTurn;
    const mine = st.phase === "take" && !game.busy && !st.seats[turn].cpu;
    const jar = nimEl.querySelector(".bn-jar");
    let html = '<span class="bn-jar__n" aria-hidden="true">' + (v.cookies - v.going) + "</span>";
    for (let k = 0; k < v.cookies; k++) {
      const p = cookieAt(k), gold = k === 0;
      const going = k >= v.cookies - v.going || (gold && v.gold);
      html += '<span class="bn-cookie' + (gold ? " bn-cookie--gold" : "") + (going ? " bn-cookie--go" : "") + '" style="left:' + p.x + "%;top:" + p.y + '%" aria-hidden="true">🍪</span>';
    }
    jar.innerHTML = html;
    jar.setAttribute("aria-label", (v.cookies - v.going) + ((v.cookies - v.going) === 1 ? " cookie" : " cookies") + " in the jar. The last one is golden.");
    // the takes: one, two or three (never more than are left); his first game
    // lights the one that leaves his friend a multiple of four
    const best = mine && game.teach ? L.nimBest(st) : 0;
    let take = "";
    for (let n = 1; n <= game.board.take; n++) {
      const pics = '<span class="bn-takeb__pics" aria-hidden="true">' + "🍪".repeat(n) + '</span><span class="bn-takeb__n" aria-hidden="true">' + n + "</span>";
      const can = n <= st.cookies && st.phase === "take";
      const label = "Take " + (n === 1 ? "one cookie" : n === 2 ? "two cookies" : "three cookies");
      if (mine && can) take += '<button class="tap bn-takeb' + (n === best ? " bn-takeb--hint" : "") + '" type="button" data-n="' + n + '" aria-label="' + label + '">' + pics + "</button>";
      else take += '<span class="bn-takeb bn-takeb--still' + (can ? "" : " bn-takeb--none") + '" role="img" aria-label="' + label + '">' + pics + "</span>";
    }
    nimEl.querySelector(".bn-take").innerHTML = take;
  }
  function tapTake(n, btn) {
    if (!game || game.board.game !== "nim" || game.busy || !playVisible()) return;
    const st = game.st;
    if (st.phase !== "take") return;
    if (btn && st.seats[st.turn].cpu) return;
    const ev = L.takeCookies(st, n);
    if (!ev.length) return;
    hideHand();
    if (!save.intro.nim && !st.seats[ev[0].seat].cpu) { save.intro.nim = true; persist(); }
    playEvents(ev);
  }
  function cpuNim() {
    if (!game || game.board.game !== "nim") return;
    if (!playVisible()) { game.cpuWaiting = true; return; }
    const st = game.st;
    if (game.busy || st.phase !== "take" || !st.seats[st.turn].cpu) return;
    tapTake(L.nimChoice(st), null);
  }
  // 🁢 one domino, drawn: two halves of dots (1 to 5), side by side or one
  // above the other. The dots are the same five patterns as the die.
  const PIPS = { 1: [[50, 50]], 2: [[27, 27], [73, 73]], 3: [[25, 25], [50, 50], [75, 75]], 4: [[27, 27], [73, 27], [27, 73], [73, 73]], 5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]] };
  function domSVG(a, b, upright) {
    const half = (n, dx, dy) => (PIPS[n] || []).map((p) => '<circle cx="' + (p[0] + dx) + '" cy="' + (p[1] + dy) + '" r="10" fill="#1f2937"/>').join("");
    const w = upright ? 100 : 200, h = upright ? 200 : 100;
    return '<svg class="bn-domsvg" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true"><rect x="3" y="3" width="' + (w - 6) + '" height="' + (h - 6) + '" rx="16" fill="#fffdf6" stroke="#1f2937" stroke-width="5"/>' +
      (upright ? '<line x1="14" y1="100" x2="86" y2="100" stroke="#1f2937" stroke-width="4"/>' + half(a, 0, 0) + half(b, 0, 100)
        : '<line x1="100" y1="14" x2="100" y2="86" stroke="#1f2937" stroke-width="4"/>' + half(a, 0, 0) + half(b, 100, 0)) + "</svg>";
  }
  function dotFace(n) {
    return '<svg class="bn-domsvg" viewBox="0 0 100 100" aria-hidden="true"><rect x="3" y="3" width="94" height="94" rx="16" fill="#fffdf6" stroke="#1f2937" stroke-width="5"/>' +
      (PIPS[n] || []).map((p) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="11" fill="#1f2937"/>').join("") + "</svg>";
  }
  // the room: the ends row (two big ends, the line between them), then the
  // hand as many across as fit, every tile 75px+ and 16px from the next
  function layoutDom(w, h) {
    const GAP = 16;
    const end = Math.max(75, Math.min(120, Math.floor(h * 0.26)));
    const handH = h - end - GAP;
    // four across when they fit (a hand is four tiles; a fished fifth wraps),
    // else three; room for two rows, since a fished tile makes five
    const cols = (w - 3 * GAP) / 4 >= 75 ? 4 : 3;
    const cw = Math.floor((w - (cols - 1) * GAP) / cols);
    const th = Math.max(75, Math.min(Math.floor((handH - GAP) / 2), Math.round(cw * 1.7), 170));
    const best = { tw: Math.max(75, Math.min(cw, Math.round(th / 1.4))), th, cols };
    game.domLine = { w: Math.max(40, w - 2 * end - 2 * GAP), h: end };
    domEl.style.setProperty("--end", end + "px");
    domEl.style.setProperty("--tw", best.tw + "px");
    domEl.style.setProperty("--th", best.th + "px");
    domEl.style.setProperty("--tcols", String(best.cols));
    boardEl.style.width = w + "px";
    boardEl.style.height = h + "px";
    boardEl.style.left = "0px";
    boardEl.style.top = "0px";
  }
  // What the tiles SHOW (`game.dv`): the engine has laid the tile and
  // handed the turn on while the tile is still sliding into the line
  function domView() {
    const st = game.st;
    return { line: st.line.map((t) => t.slice()), ends: st.ends.slice(), hands: st.hands.map((h) => h.slice()), held: st.held, glow: [], fish: null, fishOk: false, fresh: null };
  }
  const domName = (id) => { const t = String(id).split("-"); return t[0] + " and " + t[1]; };
  function paintDom() {
    if (!game || game.board.game !== "dominoes" || !game.dv) return;
    const v = game.dv, st = game.st;
    const turn = game.showTurn == null ? st.turn : game.showTurn;
    const mine = st.phase === "lay" && !game.busy && !st.seats[turn].cpu && turn === st.turn;
    // the two ends: buttons only while a held tile waits for him to choose
    const sides = v.held && mine ? L.domSides(st, v.held) : [];
    for (const side of ["left", "right"]) {
      const old = domEl.querySelector('.bn-dom__end[data-side="' + side + '"]');
      const n = v.ends[side === "left" ? 0 : 1], live = sides.indexOf(side) >= 0;
      const el = document.createElement(live ? "button" : "span");
      el.className = "bn-dom__end" + (live ? " tap bn-dom__end--go" : "");
      el.dataset.side = side;
      if (live) { el.type = "button"; el.setAttribute("aria-label", "Put it on the " + side + " end, the " + n); }
      else { el.setAttribute("role", "img"); el.setAttribute("aria-label", "The " + side + " end: " + n); }
      el.innerHTML = dotFace(n) + '<span class="bn-dom__arrow" aria-hidden="true">' + (side === "left" ? "◀️" : "▶️") + "</span>";
      old.replaceWith(el);
    }
    // the line, small, end to end (the fished tile shows here a moment)
    let line = v.line.map((t, k) => '<span class="bn-dom__bit' + (k === v.fresh ? " bn-dom__bit--new" : "") + '">' + domSVG(t[0], t[1], false) + "</span>").join("");
    if (v.fish) line = '<span class="bn-dom__fish' + (v.fishOk ? " bn-dom__fish--ok" : "") + '">' + domSVG(...v.fish.split("-").map(Number), false) + "</span>";
    const lineEl = domEl.querySelector(".bn-dom__line");
    lineEl.innerHTML = line;
    // the line's tiles as big as lets all of them fit between the ends
    const room = game.domLine || { w: 120, h: 90 }, n = v.line.length;
    let bw = 48;
    while (bw > 12 && Math.ceil(n / Math.max(1, Math.floor((room.w + 4) / (bw + 4)))) * (bw / 2 + 4) > room.h) bw -= 2;
    lineEl.style.setProperty("--bitw", bw + "px");
    // the mover's hand: big tiles, buttons on his turn
    const hand = v.hands[turn] || [];
    let html = "";
    for (const id of hand) {
      const t = id.split("-").map(Number), cls = "bn-domt" + (v.held === id ? " bn-domt--held" : "") + (v.glow.indexOf(id) >= 0 ? " bn-domt--hint" : "");
      html += mine ? '<button class="tap ' + cls + '" type="button" data-id="' + id + '" aria-label="The ' + domName(id) + (v.held === id ? ", held" : "") + '">' + domSVG(t[0], t[1], true) + "</button>"
        : '<span class="' + cls + '" role="img" aria-label="The ' + domName(id) + '">' + domSVG(t[0], t[1], true) + "</span>";
    }
    const handEl = domEl.querySelector(".bn-dom__hand");
    handEl.innerHTML = html;
    handEl.setAttribute("aria-label", nameOf(turn) + "'s tiles");
    handEl.classList.toggle("bn-dom__hand--cpu", !!st.seats[turn].cpu);
  }
  function tapTile(id, btn) {
    if (!game || game.board.game !== "dominoes" || game.busy || !playVisible()) return;
    const st = game.st;
    if (st.phase !== "lay") return;
    if (btn && st.seats[st.turn].cpu) return;
    domMove(L.layTile(st, id), id);
  }
  function tapEnd(side) {
    if (!game || game.board.game !== "dominoes" || game.busy || !playVisible()) return;
    const st = game.st;
    if (st.phase !== "lay" || !st.held || st.seats[st.turn].cpu) return;
    domMove(L.layTile(st, st.held, side), st.held);
  }
  function domMove(ev, id) {
    if (!ev.length) return;   // the tile already held (the hammer's echo), or not his
    const e = ev[0], st = game.st;
    hideHand();
    if (e.type === "hold") {
      game.dv.held = id;
      paintDom();
      sayPlay(SAY.domWhich);
      persistGame();
      return;
    }
    if (e.type === "miss") {
      game.dv.held = null;
      // after two, the tiles that match glow
      if (e.misses >= 2 || game.teach) game.dv.glow = domFits();
      paintDom();
      const again = domEl.querySelector('.bn-domt[data-id="' + id + '"]');
      if (again) wiggle(again);
      sayPlay(SAY.domMiss);
      persistGame();
      return;
    }
    if (!save.intro.dominoes && !st.seats[e.seat].cpu) { save.intro.dominoes = true; persist(); }
    playEvents(ev);
  }
  function fishTile() {
    if (!game || game.board.game !== "dominoes" || game.busy || !playVisible()) return;
    const st = game.st;
    if (st.phase !== "draw") return;
    const ev = L.drawTile(st);
    if (ev.length) playEvents(ev);
  }
  function cpuDom() {
    if (!game || game.board.game !== "dominoes") return;
    if (!playVisible()) { game.cpuWaiting = true; return; }
    const st = game.st;
    if (game.busy || st.phase === "done" || !st.seats[st.turn].cpu) return;
    if (st.phase === "draw") return fishTile();
    const c = L.domChoice(st);
    if (c) domMove(L.layTile(st, c[0], c[1]), c[0]);
  }
  // 🌰 where the pots stand. Three shapes, the one that gives the biggest pots:
  // TALL (a phone held upright) — the board stood on its end between the
  // pads: seat 0's pots down the left into its nest at the bottom, seat 1's
  // up the right into its nest at the top, round the way the acorns go; MID
  // (a short phone) — the same ring with the nests in a middle column; WIDE
  // (a phone on its side) — the classic board, a nest at each end.
  // For each ring place: [grid-column, grid-row].
  const ACORN_SHAPES = {
    tall: { cols: "repeat(2, minmax(0, 1fr))", at: [["1", "2"], ["1", "3"], ["1", "4"], ["1 / span 2", "5"], ["2", "4"], ["2", "3"], ["2", "2"], ["1 / span 2", "1"]] },
    mid: { cols: "repeat(3, minmax(0, 1fr))", at: [["1", "1"], ["1", "2"], ["1", "3"], ["2", "3"], ["3", "3"], ["3", "2"], ["3", "1"], ["2", "1"]] },
    wide: { cols: "var(--nestw, 56px) repeat(3, minmax(0, 1fr)) var(--nestw, 56px)", at: [["2", "2"], ["3", "2"], ["4", "2"], ["5", "1 / span 2"], ["4", "1"], ["3", "1"], ["2", "1"], ["1", "1 / span 2"]] },
  };
  function layoutAcorns(w, h) {
    const GAP = 16, NW = 60, cap = (n) => Math.max(40, Math.min(140, Math.floor(n)));
    const nest = Math.max(48, Math.min(96, Math.round((h - 4 * GAP) * 0.17)));
    const fits = {
      tall: cap(Math.min((h - 2 * nest - 4 * GAP) / 3, (w - GAP) / 2)),
      mid: cap(Math.min((h - 2 * GAP) / 3, (w - 2 * GAP) / 3)),
      wide: cap(Math.min((h - GAP) / 2, (w - 2 * NW - 4 * GAP) / 3)),
    };
    // upright, the tall board is the clearest (big nests) whenever it fits
    const shape = fits.tall >= 80 ? "tall" : fits.mid >= fits.wide ? "mid" : "wide";
    const pot = fits[shape];
    const sh = ACORN_SHAPES[shape];
    acornsEl.style.gridTemplateColumns = sh.cols;
    acornsEl.style.gridTemplateRows = shape === "tall" ? "var(--nest) repeat(3, var(--pot)) var(--nest)" : shape === "mid" ? "repeat(3, var(--pot))" : "repeat(2, var(--pot))";
    acornsEl.style.setProperty("--pot", pot + "px");
    acornsEl.style.setProperty("--nest", nest + "px");
    acornsEl.style.setProperty("--nestw", NW + "px");
    acornsEl.style.fontSize = Math.round(pot * 0.2) + "px";
    const changed = acornsEl.dataset.shape !== shape;
    acornsEl.dataset.shape = shape;
    boardEl.style.width = w + "px";
    boardEl.style.height = h + "px";
    boardEl.style.left = "0px";
    boardEl.style.top = "0px";
    if (changed) paintAcorns();
  }
  // What the pots SHOW (`game.av`): the engine has sown the whole pot while
  // the acorns are still dropping in one by one
  // 🁢 the tiles in the mover's hand that match an open end
  function domFits() { const st = game.st; return st.hands[st.turn].filter((x) => L.domSides(st, x).length); }
  function acornsView() { return { pots: game.st.pots.slice(), drop: -1, c: 0, from: -1, glow: -1 }; }
  function acornPile(n) {
    if (!n) return "";
    if (n > 6) return '<span class="bn-pot__acorn">🌰</span><span class="bn-pot__x">×' + n + "</span>";
    return '<span class="bn-pot__acorn">' + "🌰".repeat(n) + "</span>";
  }
  function paintAcorns() {
    if (!game || game.board.game !== "acorns" || !game.av) return;
    const v = game.av, st = game.st;
    const turn = game.showTurn == null ? st.turn : game.showTurn;
    const mine = st.phase !== "done" && !game.busy && !st.seats[turn].cpu;
    // 🌰 his first game: the pot whose last acorn lands in his nest glows
    const yes = mine && game.teach && st.phase === "choose" && turn === st.turn ? L.acornAgains(st) : [];
    let html = "";
    v.pots.forEach((n, k) => {
      const seat = k < 4 ? 0 : 1, nest = k % 4 === 3, [col, row] = (ACORN_SHAPES[acornsEl.dataset.shape] || ACORN_SHAPES.tall).at[k];
      const cls = (nest ? "bn-nest" : "bn-pot") + " bn-pot--" + seat + (k === v.drop ? " bn-pot--drop" : "") + (k === v.from ? " bn-pot--from" : "") + (k === v.glow || yes.indexOf(k) >= 0 ? " bn-pot--yes" : "");
      const style = ' style="grid-column:' + col + ";grid-row:" + row + ";border-color:" + seatPerson(seat).colour + '"';
      const pop = k === v.drop ? '<span class="bn-pot__pop">' + v.c + "</span>" : "";
      const label = nameOf(seat) + (nest ? "'s nest: " : "'s pot: ") + n + (n === 1 ? " acorn" : " acorns");
      if (nest) {
        html += '<span class="' + cls + '"' + style + ' aria-label="' + label + '" role="img"><span class="bn-nest__face" aria-hidden="true">' + R.faceHTML(seatPerson(seat)) + '</span><span class="bn-nest__n" aria-hidden="true">🐿️ ' + n + "</span>" + pop + "</span>";
      } else if (mine && seat === turn && n > 0) {
        html += '<button class="tap ' + cls + '" type="button"' + style + ' data-k="' + k + '" aria-label="' + label + '"><span class="bn-pot__pile" aria-hidden="true">' + acornPile(n) + '</span><span class="bn-pot__n" aria-hidden="true">' + n + "</span>" + pop + "</button>";
      } else {
        html += '<span class="' + cls + ' bn-pot--still"' + style + ' role="img" aria-label="' + label + '"><span class="bn-pot__pile" aria-hidden="true">' + acornPile(n) + '</span><span class="bn-pot__n" aria-hidden="true">' + n + "</span>" + pop + "</span>";
      }
    });
    acornsEl.innerHTML = html;
  }
  function tapPot(k, btn) {
    if (!game || game.board.game !== "acorns" || game.busy || !playVisible()) return;
    const st = game.st;
    if (st.phase !== "choose") return;
    if (btn && st.seats[st.turn].cpu) return;   // the computer's turn
    const ev = L.sowPot(st, k);
    if (!ev.length) return;   // an empty pot, or not his (the hammer's echo)
    hideHand();
    if (!save.intro.acorns && !st.seats[ev[0].seat].cpu) { save.intro.acorns = true; persist(); }
    game.busy = true;
    playEvents(ev);
  }
  function cpuAcorn() {
    if (!game || game.board.game !== "acorns") return;
    if (!playVisible()) { game.cpuWaiting = true; return; }
    const st = game.st;
    if (game.busy || st.phase === "done" || !st.seats[st.turn].cpu) return;
    tapPot(L.acornChoice(st), null);
  }
  // What the screen shows of the cards (`game.pv`): the engine has already
  // moved on (a pair taken, a miss turned back, a new board dealt) while the
  // screen still shows the moment, so the pictures follow these, not the state
  function pairsView() {
    const st = game.st;
    return { cards: st.cards.slice(), gone: st.gone.slice(), up: st.open.slice(), glow: [], fresh: -1 };
  }
  function pairSay(id) { return id === L.STAR ? "a star" : (DATA.pairPic(id) || {}).say || ""; }
  function paintPairs() {
    if (!game || game.board.game !== "pairs") return;
    const v = game.pv, st = game.st, cpu = st.phase !== "done" && st.seats[game.showTurn == null ? st.turn : game.showTurn].cpu;
    let html = "";
    v.cards.forEach((id, k) => {
      if (v.gone[k]) { html += '<span class="bn-pc bn-pc--gone" aria-hidden="true"></span>'; return; }
      const up = v.up.indexOf(k) >= 0;
      const pic = id === L.STAR ? "⭐" : (DATA.pairPic(id) || {}).pic || "";
      html += '<button class="bn-pc tap' + (up ? " bn-pc--up" : "") + (v.glow.indexOf(k) >= 0 ? " bn-pc--yes" : "") + (k === v.fresh ? " bn-pc--flip" : "") +
        '" type="button" data-k="' + k + '" aria-label="' + (up ? "The " + pairSay(id) : "A card, face down") + '">' +
        '<span class="bn-pc__pic" aria-hidden="true">' + (up ? pic : "") + "</span></button>";
    });
    pairsEl.innerHTML = html;
    v.fresh = -1;
    // the computer's turn: its cards are not his to tap
    pairsEl.classList.toggle("bn-pairs--cpu", !!cpu);
  }
  function tapPair(k, btn) {
    if (!game || game.board.game !== "pairs" || game.busy || !playVisible()) return;
    const st = game.st;
    if (st.phase !== "flip" && st.phase !== "second") return;
    if (btn && st.seats[st.turn].cpu) return;   // the computer's turn
    const ev = L.peekPair(st, k);
    if (!ev.length) return;   // a card already up (the hammer's echo) or gone
    hideHand();
    if (!save.intro.pairs && !st.seats[ev[0].seat].cpu) { save.intro.pairs = true; persist(); }
    playEvents(ev);
  }
  function cpuPair() {
    if (!game || game.board.game !== "pairs") return;
    if (!playVisible()) { game.cpuWaiting = true; return; }
    const st = game.st;
    if (game.busy || st.phase === "done" || !st.seats[st.turn].cpu) return;
    tapPair(L.pairChoice(st), null);
  }
  // The cards: the middle one's pictures, and the flipped one's as buttons.
  // A card's pictures turn and size a little each (as on the real cards), the
  // same way every time for that card — only the picture, never its tap box.
  const TILT = [-14, 9, -5, 16, 0, -10, 12, -16];
  function cardPics(k, buttons, cls) {
    const pics = game.board.deck[k] || [];
    return pics.map((p, j) => {
      const sp = DATA.spot(p), rot = TILT[(k * 3 + j) % TILT.length], big = (k + j) % 3 === 0 ? 1.12 : (k + j) % 3 === 1 ? 0.9 : 1;
      const inner = '<span class="bn-twin__pic" style="transform:rotate(' + rot + "deg) scale(" + big + ')">' + (sp ? sp.pic : "") + "</span>";
      return buttons
        ? '<button class="bn-twin tap' + (cls(p) || "") + '" type="button" data-p="' + p + '" aria-label="' + (sp ? sp.say.replace(/^the /, "") : "") + '">' + inner + "</button>"
        : '<span class="bn-twin bn-twin--mid' + (cls(p) || "") + '" data-p="' + p + '">' + inner + "</span>";
    }).join("");
  }
  function paintSpots() {
    if (!game || game.board.game !== "spot") return;
    const st = game.st, twin = st.phase === "find" ? L.twinOf(game.board, st.centre, st.hand) : -1;
    const glow = (p) => (game.spotYes === p ? " bn-twin--yes" : st.phase === "find" && st.misses >= 2 && p === twin ? " bn-twin--hint" : "");
    const mid = game.spotMid != null ? game.spotMid : st.centre;
    spotsEl.querySelector(".bn-spotcard--mid").innerHTML = cardPics(mid, false, glow);
    const hand = spotsEl.querySelector(".bn-spotcard--hand");
    const shown = game.spotHand != null ? game.spotHand : st.phase === "find" ? st.hand : null;
    hand.innerHTML = shown != null ? cardPics(shown, true, glow) : '<span class="bn-spotcard__back" aria-hidden="true">👀</span>';
    hand.classList.toggle("bn-spotcard--back", shown == null);
    hand.classList.toggle("bn-spotcard--flip", !!game.spotFresh);
    game.spotFresh = false;
    // the computer's turn: its card is not his to tap
    hand.classList.toggle("bn-spotcard--cpu", !!(shown != null && st.seats[st.turn].cpu));
  }
  function flipSpot() {
    const ev = L.flipSpot(game.st);
    if (!ev.length) return;
    hideHand();
    game.busy = true;
    game.rolled = true;
    game.spotHand = null;
    game.spotFresh = true;
    SFX.flip();
    paintSpots();
    paintPads();
    persistGame();
    const st = game.st;
    if (st.seats[st.turn].cpu) {
      // the computer looks… and finds it: a worked example, at his pace
      later(() => { if (!game) return; game.busy = false; pickTwin(ev[0].twin, null); }, T.cpuThink + 500);
      return;
    }
    sayPlay(SAY.findTwin);
    later(() => { if (game) { game.busy = false; paintPads(); } }, T.card);
  }
  function pickTwin(p, btn) {
    if (!game || game.board.game !== "spot" || game.busy || !playVisible()) return;
    const st = game.st;
    if (st.phase !== "find") return;
    if (btn && st.seats[st.turn].cpu) return;   // the computer's card is not his to tap
    const hand = st.hand, centre = st.centre;
    const ev = L.findSpot(st, p);
    if (!ev.length) return;
    if (ev[0].type === "miss") {
      // not on both: a kind wiggle (after two, the twin glows on both cards)
      paintSpots();
      const again = spotsEl.querySelector('.bn-spotcard--hand .bn-twin[data-p="' + p + '"]');
      if (again) wiggle(again);
      sayPlay(SAY.notTwin);
      persistGame();
      return;
    }
    if (!save.intro.spot && !st.seats[ev[0].seat].cpu) { save.intro.spot = true; persist(); }
    // the twin glows on BOTH cards before the card moves to the middle
    game.spotYes = ev[0].twin;
    game.spotHand = hand;
    game.spotMid = centre;
    paintSpots();
    playEvents(ev);
  }

  // 🍎 a face badge stands between each tree and its basket: whose is whose,
  // and (with the halo) whose basket this turn fills
  function orchardFrac(p) { return { x: p.x / R.ORCH, y: p.y / R.ORCH }; }
  function placeTokens() {
    const st = game.st, b = game.board;
    if (b.game === "lotto" || OWN_BOARD.indexOf(b.game) >= 0) return;
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
    const shared = b.game !== "hen" && st.seats[0].pos === st.seats[1].pos;
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
    if (b.game === "hen") game.shown[1 - i] = n;   // one hen: both seats stand where she does
    const shared = b.game !== "hen" && other === n;
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
    game.shownCoop = game.st.coop || 0;
    game.shownPlaced = game.st.placed ? game.st.placed.map((p) => p.slice()) : null;
    game.landed = null;
    game.spotYes = null; game.spotHand = null; game.spotMid = null;
    game.pv = game.board.game === "pairs" ? pairsView() : null;
    game.av = game.board.game === "acorns" ? acornsView() : null;
    game.dv = game.board.game === "dominoes" ? domView() : null;
    game.gv = game.board.game === "dig" ? digView() : null;
    game.cv = game.board.game === "nim" ? nimView() : null;
    game.mv = game.board.game === "match3" ? m3View() : null;
    game.zv = game.board.game === "maze" ? mazeView() : null;
    game.lv = game.board.game === "lines" ? linesView() : null;
    game.tv = game.board.game === "top" ? topView() : null;
    game.gbv = game.board.game === "grab" ? grabView() : null;
    game.shownShut = game.st.seats.map((s) => (s.shut ? s.shut.slice() : []));
    game.doorsGo = null;
    placeTokens();
    paintSpots();
    paintPairs();
    paintDoors();
    paintAcorns();
    paintDom();
    paintDig();
    paintNim();
    paintM3();
    paintMaze();
    paintLines();
    paintTop();
    paintGrab();
    paintApples();
    paintFoods();
    paintCoop();
    paintPads();
    paintBoardLabel();
  }
  // 🐔 the hen house's count: "🐥 12", on the hen house square
  function paintCoop() {
    if (!coopEl) return;
    const b = game.board;
    coopEl.hidden = b.game !== "hen";
    if (coopEl.hidden) return;
    const c = R.centre(b, b.size);
    coopEl.style.left = (c.x / (b.cols * R.CELL) * 100) + "%";
    coopEl.style.top = ((c.y - R.CELL * 0.3) / (b.rows * R.CELL) * 100) + "%";
    coopEl.textContent = "🐥 " + game.shownCoop;
    coopEl.dataset.n = String(game.shownCoop);
  }
  function paintBoardLabel() {
    const st = game.st;
    if (game.board.game === "spin") {
      boardEl.setAttribute("aria-label", st.seats.map((s, i) => nameOf(i) + " has " + game.shown[i] + (game.shown[i] === 1 ? " apple" : " apples")).join(". ") +
        ". " + game.shownPie + " in the pie.");
      return;
    }
    if (game.board.game === "doors") {
      boardEl.setAttribute("aria-label", [0, 1].map((i) => nameOf(i) + " has shut " + game.shownShut[i].length + " of 6 doors").join(". ") + ".");
      return;
    }
    if (game.board.game === "grab") {
      const v = game.gbv || grabView();
      boardEl.setAttribute("aria-label", [0, 1].map((i) => nameOf(i) + " has " + v.owner.filter((o) => o === i).length + " squares, " + DATA.colour(v.paint[v.owner.indexOf(i)]).name).join(". ") + ". " + v.owner.filter((o) => o < 0).length + " squares to grab.");
      return;
    }
    if (game.board.game === "top") {
      const t = st.gone[0].length;
      boardEl.setAttribute("aria-label", (t < game.board.deck ? "Trick " + (t + 1) + " of " + game.board.deck + ". " : "") + [0, 1].map((i) => nameOf(i) + " has " + game.shownStars[i] + (game.shownStars[i] === 1 ? " star" : " stars")).join(". ") + ".");
      return;
    }
    if (game.board.game === "lines") {
      boardEl.setAttribute("aria-label", "Board " + (st.boardNo + 1) + " of " + game.board.boards + ". " + [0, 1].map((i) => nameOf(i) + " has " + game.shownStars[i] + (game.shownStars[i] === 1 ? " star" : " stars")).join(". ") + ".");
      return;
    }
    if (game.board.game === "maze") {
      boardEl.setAttribute("aria-label", "Cheese " + (Math.min(st.found + 1, game.board.cheese)) + " of " + game.board.cheese + ". " + [0, 1].map((i) => nameOf(i) + " has " + game.shownStars[i] + (game.shownStars[i] === 1 ? " star" : " stars")).join(". ") + ".");
      return;
    }
    if (game.board.game === "match3") {
      boardEl.setAttribute("aria-label", [0, 1].map((i) => nameOf(i) + " has played " + st.seats[i].pos + " of " + game.board.rounds + " turns and has " + game.shownStars[i] + (game.shownStars[i] === 1 ? " star" : " stars")).join(". ") + ".");
      return;
    }
    if (game.board.game === "nim") {
      boardEl.setAttribute("aria-label", "Jar " + (st.jar + 1) + " of " + game.board.jars.length + ". " + [0, 1].map((i) => nameOf(i) + " has " + st.seats[i].stars + (st.seats[i].stars === 1 ? " golden cookie" : " golden cookies")).join(". ") + ".");
      return;
    }
    if (game.board.game === "dig") {
      boardEl.setAttribute("aria-label", st.found + (st.found === 1 ? " treasure" : " treasures") + " found of " + game.board.treasures + ".");
      return;
    }
    if (game.board.game === "dominoes") {
      boardEl.setAttribute("aria-label", "The line has " + st.line.length + " tiles. Its ends are " + st.ends[0] + " and " + st.ends[1] + ". " + [0, 1].map((i) => nameOf(i) + " has " + st.hands[i].length + (st.hands[i].length === 1 ? " tile" : " tiles")).join(". ") + ".");
      return;
    }
    if (game.board.game === "acorns") {
      boardEl.setAttribute("aria-label", [0, 1].map((i) => nameOf(i) + " has " + st.seats[i].pos + (st.seats[i].pos === 1 ? " acorn" : " acorns") + " in the nest").join(". ") + ".");
      return;
    }
    if (game.board.game === "pairs") {
      const left = st.gone.filter((g) => !g).length;
      boardEl.setAttribute("aria-label", left + (left === 1 ? " card" : " cards") + " left. " + [0, 1].map((i) => nameOf(i) + " has found " + st.seats[i].pos + (st.seats[i].pos === 1 ? " pair" : " pairs")).join(". ") + ".");
      return;
    }
    if (game.board.game === "spot") {
      boardEl.setAttribute("aria-label", "The middle card shows " + game.board.deck[st.centre].map((p) => DATA.spot(p).say.replace(/^the /, "")).join(", ") + ". " + [0, 1].map((i) => nameOf(i) + " has found " + st.seats[i].pos).join(". ") + ".");
      return;
    }
    if (game.board.game === "lotto") {
      boardEl.setAttribute("aria-label", [0, 1].map((i) => nameOf(i) + "'s blanket has " + game.shownPlaced[i].length + " of " + game.board.spots).join(". ") + ".");
      return;
    }
    if (game.board.game === "hen") {
      boardEl.setAttribute("aria-label", "The hen is " + (st.seats[0].home ? "home" : "on square " + game.shown[0]) + ". " + game.shownCoop + (game.shownCoop === 1 ? " chick is" : " chicks are") + " in the hen house.");
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
      if (game.board.game === "dice" || game.board.game === "doors") {
        // while the dice tumble, a tumbling face; then the real one, its
        // dots going dark one per hop
        if (active && game.tumbleFace && game.board.two) act.innerHTML = '<span class="bn-dice2">' + dieHTML(game.tumbleFace, game.tumbleFace) + dieHTML(7 - game.tumbleFace, 7 - game.tumbleFace) + "</span>";
        else if (active && game.tumbleFace) act.innerHTML = dieHTML(game.tumbleFace, game.tumbleFace);
        // 🎲 his two dice, while he picks one (the big ones are in the choice)
        else if (active && st.phase === "choose" && st.dice && st.dice.length === 2) act.innerHTML = '<span class="bn-dice2">' + dieHTML(st.dice[0], st.dice[0]) + dieHTML(st.dice[1], st.dice[1]) + "</span>";
        // (🚪 the roll stays lit while he finds the doors that make it)
        else if (active && game.rolled) act.innerHTML = dieHTML(st.die, game.board.game === "doors" ? (st.phase === "shut" ? st.die : 0) : st.phase === "hop" && st.turn === i ? st.left : 0);
        else act.innerHTML = dieHTML(0, 0);
        pad.querySelector(".bn-pad__stars").textContent = game.shownStars[i] ? "⭐ " + game.shownStars[i] : "";
        const hopping = active && st.phase === "hop" && st.turn === i;
        const shutting = active && st.phase === "shut";
        const choosing = active && st.phase === "choose";
        pad.setAttribute("aria-label", nameOf(i) + (active ? (choosing ? ": pick one of the two dice" : shutting ? ": shut the doors that make " + st.die : hopping ? (st.die === L.TEN ? ": tap for ten more" : ": tap to hop, " + st.left + " to go") : ": tap to roll the dice") : ": wait for your turn") + (s.home ? (game.board.game === "doors" ? ", every door shut" : ", home") : ""));
      } else if (game.board.game === "grab") {
        // 🎨 the colours under the grid are the buttons; the pad shows the
        // player's own colour now (their patch's) and the ⭐s
        const v = game.gbv || grabView(), c = v.paint[v.owner.indexOf(i)];
        act.innerHTML = '<span class="bn-card bn-card--basket bn-swatch--pad">' + R.shapeSVG(c) + "</span>";
        pad.querySelector(".bn-pad__stars").textContent = game.shownStars[i] ? "⭐ " + game.shownStars[i] : "";
        pad.setAttribute("aria-label", nameOf(i) + "'s colour is " + DATA.colour(c).name + (active ? ": pick a colour" : ": wait for your turn"));
      } else if (game.board.game === "top") {
        // 🃏 the hand is the buttons; the pad is whose turn it is and the ⭐s
        act.innerHTML = '<span class="bn-card bn-card--basket">🃏</span>';
        pad.querySelector(".bn-pad__stars").textContent = game.shownStars[i] ? "⭐ " + game.shownStars[i] : "";
        pad.setAttribute("aria-label", nameOf(i) + (active ? (st.phase === "follow" ? ": play a card bigger than " + st.table[st.lead] : ": play a card") : ": wait for your turn"));
      } else if (game.board.game === "lines") {
        // 🔴 the columns are the buttons; the pad shows the player's own
        // counter (their face on their colour) and the ⭐s
        act.innerHTML = '<span class="bn-card bn-card--basket"><span class="bn-slot bn-slot--on bn-slot--mini" style="border-color:' + seatPerson(i).colour + '">' + R.faceHTML(seatPerson(i)) + "</span></span>";
        pad.querySelector(".bn-pad__stars").textContent = game.shownStars[i] ? "⭐ " + game.shownStars[i] : "";
        pad.setAttribute("aria-label", nameOf(i) + (active ? ": tap a column to drop your counter" : ": wait for your turn"));
      } else if (game.board.game === "maze") {
        // 🐭 the arrow cards are the buttons; the pad is the player's own
        // mouse (in their colour) and the ⭐s
        act.innerHTML = '<span class="bn-card bn-card--basket"><span class="bn-mouse bn-mouse--mini" style="border-color:' + seatPerson(i).colour + '">🐭</span></span>';
        pad.querySelector(".bn-pad__stars").textContent = game.shownStars[i] ? "⭐ " + game.shownStars[i] : "";
        pad.setAttribute("aria-label", nameOf(i) + (active ? ": play an arrow to move your mouse" : ": wait for your turn"));
      } else if (game.board.game === "match3") {
        // 🎯 the dice and the roll are on the board; the pad is whose turn it
        // is and the ⭐s (five 🎲s, one a turn left, ran off the pad)
        const left = game.board.rounds - st.seats[i].pos;
        act.innerHTML = '<span class="bn-card bn-card--basket">🎲</span>';
        pad.querySelector(".bn-pad__stars").textContent = game.shownStars[i] ? "⭐ " + game.shownStars[i] : "";
        pad.setAttribute("aria-label", nameOf(i) + (active ? ": roll, then tap the dice to keep" : ": wait for your turn") + ". " + left + (left === 1 ? " turn left" : " turns left"));
      } else if (game.board.game === "nim") {
        // 🍪 the takes under the jar are the buttons; the pad is whose turn it
        // is and the ⭐s (a golden cookie each)
        act.innerHTML = '<span class="bn-card bn-card--basket">🍪</span>';
        pad.querySelector(".bn-pad__stars").textContent = game.shownStars[i] ? "⭐ " + game.shownStars[i] : "";
        pad.setAttribute("aria-label", nameOf(i) + (active ? ": take one, two or three cookies" : ": wait for your turn"));
      } else if (game.board.game === "dig") {
        // 🏴‍☠️ the sand is the buttons; the pad is whose turn and the ⭐s
        act.innerHTML = '<span class="bn-card bn-card--basket">⛏️</span>';
        pad.querySelector(".bn-pad__stars").textContent = game.shownStars[i] ? "⭐ " + game.shownStars[i] : "";
        pad.setAttribute("aria-label", nameOf(i) + (active ? ": dig a square" : ": wait for your turn"));
      } else if (game.board.game === "dominoes") {
        // 🁢 the tiles are the buttons; the pad fishes from the pile when
        // nothing in his hand matches (a face-down tile to tap)
        const fishing = active && st.phase === "draw" && st.turn === i;
        act.innerHTML = fishing ? '<span class="bn-card bn-card--back bn-dom__pile">🎣</span>' : '<span class="bn-card bn-card--basket bn-dom__count">' + domSVG(5, 3, true) + '<span class="bn-dom__n">' + (game.dv ? game.dv.hands[i].length : st.hands[i].length) + "</span></span>";
        pad.querySelector(".bn-pad__stars").textContent = game.shownStars[i] ? "⭐ " + game.shownStars[i] : "";
        pad.setAttribute("aria-label", nameOf(i) + (active ? (fishing ? ": tap to take a tile from the pile" : ": tap a tile that matches an end") : ": wait for your turn"));
      } else if (game.board.game === "acorns") {
        // 🌰 the pots on the board are the buttons; the pad is whose turn it
        // is and the ⭐ count (a last acorn in the nest)
        act.innerHTML = '<span class="bn-card bn-card--basket">🌰</span>';
        pad.querySelector(".bn-pad__stars").textContent = game.shownStars[i] ? "⭐ " + game.shownStars[i] : "";
        pad.setAttribute("aria-label", nameOf(i) + (active ? ": tap one of your pots" : ": wait for your turn"));
      } else if (game.board.game === "pairs") {
        // 🧠 the cards on the board are the buttons; the pad is whose turn it
        // is and the ⭐ count (a pair or a star found)
        act.innerHTML = '<span class="bn-card bn-card--basket">🧠</span>';
        pad.querySelector(".bn-pad__stars").textContent = game.shownStars[i] ? "⭐ " + game.shownStars[i] : "";
        pad.setAttribute("aria-label", nameOf(i) + (active ? ": tap two cards" : ": wait for your turn"));
      } else if (game.board.game === "spot") {
        // 👀 a card back to tap (flip), then a magnifier while he looks; his
        // pile of found twins is his ⭐ count
        act.innerHTML = active && st.phase === "find" ? '<span class="bn-card bn-card--food">🔍</span>' : '<span class="bn-card bn-card--basket">👀</span>';
        pad.querySelector(".bn-pad__stars").textContent = game.shownStars[i] ? "⭐ " + game.shownStars[i] : "";
        pad.setAttribute("aria-label", nameOf(i) + (active ? (st.phase === "find" ? ": find the picture on both cards" : ": tap to flip a card") : ": wait for your turn"));
      } else if (game.board.game === "lotto") {
        // 🧺 the basket to tap; then the food in hand, big. While it is in a
        // human's hand BOTH pads are answers ("whose is it?"), so both light.
        const giving = st.phase === "give" && game.showTurn === st.turn && !st.seats[st.turn].cpu;
        if (active && game.foodShown) act.innerHTML = '<span class="bn-card bn-card--food">' + (DATA.food(game.foodShown) || {}).pic + "</span>";
        else act.innerHTML = '<span class="bn-card bn-card--basket">🧺</span>';
        if (giving) { pad.classList.add("bn-pad--on", "bn-pad--ask"); pad.classList.remove("bn-pad--wait"); }
        else pad.classList.remove("bn-pad--ask");
        pad.querySelector(".bn-pad__stars").textContent = "";
        pad.setAttribute("aria-label", giving ? "Give it to " + nameOf(i) : nameOf(i) + (active ? ": tap the basket" : ": wait for your turn") + (s.home ? ", blanket full" : ""));
      } else if (game.board.game === "hen") {
        // 🐔 the farm's spinner: the wheel turns, then shows the ANIMAL spun
        // and one 🐥 per square to walk, each going pale as a chick runs home
        if (active && game.tumbling) {
          if (!act.querySelector(".bn-spinner--go")) act.innerHTML = '<span class="bn-spinner bn-spinner--go" style="animation-duration:' + T.tumble + 'ms">' + R.farmSpinnerSVG() + "</span>";
        } else if (active && game.rolled && st.phase === "hop" && st.turn === i) act.innerHTML = farmHTML(st.card, st.die, st.left);
        else if (active && game.rolled && st.card === L.FOX) act.innerHTML = farmHTML(L.FOX, 0, 0);
        else act.innerHTML = '<span class="bn-spinner">' + R.farmSpinnerSVG() + "</span>";
        pad.querySelector(".bn-pad__stars").textContent = "";
        const walking = active && st.phase === "hop" && st.turn === i;
        pad.setAttribute("aria-label", nameOf(i) + (active ? (walking ? ": tap to walk, " + st.left + " to go" : ": tap to spin") : ": wait for your turn"));
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
    // 💯 a TEN is a ten-bar of golden beads (the Montessori ten): one tap,
    // ten more. Its beads stay lit until that tap, then all go dark at once.
    if (n === L.TEN) {
      let b = '<span class="bn-die bn-die--ten" data-n="10">';
      for (let k = 0; k < 10; k++) b += '<span class="bn-bead' + (lit ? "" : " bn-bead--used") + '"></span>';
      return b + "</span>";
    }
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
  // 🐔 a spin's result on the pad: the animal, and a 🐥 per square to walk
  function farmHTML(face, n, lit) {
    if (face === L.FOX) return '<span class="bn-spin bn-spin--fox" data-face="F">🦊</span>';
    const an = DATA.animal(face);
    let s = '<span class="bn-spin bn-spin--farm" data-face="' + face + '"><span class="bn-spin__animal">' + (an ? an.pic : "") + '</span><span class="bn-spin__chicks">';
    for (let k = 0; k < n; k++) s += '<span class="bn-spin__chick' + (k >= n - lit ? "" : " bn-spin__chick--used") + '">🐥</span>';
    return s + "</span></span>";
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
    game.rolled = st.phase === "hop" || st.phase === "choose" || st.phase === "pick" || st.phase === "give" || st.phase === "find" || st.phase === "second" || st.phase === "shut";   // a game restored mid-move shows its die / spin / food
    game.foodShown = st.phase === "give" ? st.food : null;
    paintPads();
    paintPairs();
    paintDoors();
    paintAcorns();
    // 🁢 his first game: the tiles that match an end glow on every turn
    if (game.dv) { game.dv.held = st.held; game.dv.glow = game.teach && !st.seats[st.turn].cpu && st.phase === "lay" ? domFits() : []; }
    paintDom();
    paintDig();
    paintNim();
    if (game.board.game === "match3") game.mv = m3View();
    paintM3();
    paintMaze();
    paintLines();
    paintTop();
    paintGrab();
    persistGame();
    const i = st.turn;
    if (st.seats[i].cpu) {
      sayPlay(fill(SAY.turn, { n: nameOf(i) }));
      later(cpuTurn, fresh ? T.cpuThink + 400 : T.cpuThink);
      return;
    }
    // his turn: the line, and — the first time ever — the hand that shows how
    const first = !save.intro[game.board.game];
    if (st.phase === "hop") sayPlay(hopLine());
    else if (st.phase === "pick") sayPlay(SAY.pickFirst);
    else if (st.phase === "second") sayPlay(SAY.pairsFirst);
    else if (st.phase === "shut") sayPlay(fill(SAY.doorsPick, { d: st.die }));
    else if (st.phase === "draw") sayPlay(fill(SAY.turn, { n: nameOf(i) }) + " " + SAY.domDraw);
    else if (st.phase === "choose") sayPlay(SAY.pickDieAgain);
    else if (st.phase === "follow") sayPlay(fill(SAY.turn, { n: nameOf(i) }) + " " + fill(SAY.topFollow, { d: st.table[st.lead] }));
    else sayPlay(fill(SAY.turn, { n: nameOf(i) }) + (first ? " " + firstLine() : ""));
    if (st.phase === "choose") showChoice();
    else hideChoice();
    if (first) showHand(i);
    if (st.phase === "hop" && save.auto) autoHops();
    if (st.phase === "pick" && save.auto) autoPicks();
  }
  // what to do with a die just rolled: hop once a tap — or, for a 💯 ten-bar,
  // one tap for ten more
  function hopLine() { return !game ? SAY.hopFirst : game.board.game === "hen" ? SAY.henFirst : game.st.die === L.TEN ? SAY.tenFirst : SAY.hopFirst; }
  // which first-time hand a HOP belongs to: the dice's, or the farm's
  function introKey() { return game && game.board.game === "hen" ? "hen" : "dice"; }
  function firstLine() { const g = game.board.game; return g === "dice" ? SAY.rollFirst : g === "spin" || g === "hen" ? SAY.spinFirst : g === "lotto" ? SAY.basketFirst : g === "pairs" ? SAY.pairsFirst : g === "doors" ? SAY.doorsFirst : g === "acorns" ? SAY.acornsFirst : g === "dominoes" ? SAY.domFirst : g === "dig" ? SAY.digFirst : g === "nim" ? SAY.nimFirst : g === "match3" ? SAY.m3First : g === "maze" ? SAY.mazeFirst : g === "lines" ? SAY.linesFirst : g === "top" ? SAY.topLead : g === "grab" ? SAY.grabFirst : SAY.flipFirst; }

  function padTap(i) {
    if (!game || !playVisible()) return;
    const st = game.st;
    if (st.phase === "done") return;
    // whose turn it is ON SCREEN: through a hand-over the engine has already
    // passed the turn on while the lit pad is still the one that just moved
    const shown = game.showTurn == null ? st.turn : game.showTurn;
    // 🧺 "whose is it?": while a food is in his hand, BOTH pads are answers
    // (his own, or his friend's — the computer's too)
    if (game.board.game === "lotto" && st.phase === "give" && !st.seats[st.turn].cpu && shown === st.turn) {
      if (!game.busy) giveTo(i);
      return;
    }
    if (i !== shown || st.seats[i].cpu) {
      // not this pad's turn: a kind wiggle, never a buzzer
      wiggle(pads[i]);
      sayPlay(fill(SAY.notYet, { n: nameOf(shown) }));
      return;
    }
    if (game.busy || i !== st.turn) return;
    if (game.board.game === "cards") return flipCard();
    if (game.board.game === "lotto") return takeFood();
    if (game.board.game === "spot") { if (st.phase === "flip") flipSpot(); return; }
    // 🧠 the cards are the buttons: his pad only says (and shows) what to do
    if (game.board.game === "pairs") { sayPlay(SAY.pairsFirst); showHand(i); later(hideHand, 2600); return; }
    if (game.board.game === "acorns") { sayPlay(SAY.acornsFirst); showHand(i); later(hideHand, 2600); return; }
    if (game.board.game === "dig") { sayPlay(SAY.digFirst); showHand(i); later(hideHand, 2600); return; }
    if (game.board.game === "nim") { sayPlay(SAY.nimFirst); showHand(i); later(hideHand, 2600); return; }
    if (game.board.game === "match3") return tapRoll3(pads[i]);
    if (game.board.game === "maze") { sayPlay(SAY.mazeFirst); showHand(i); later(hideHand, 2600); return; }
    if (game.board.game === "lines") { sayPlay(SAY.linesFirst); showHand(i); later(hideHand, 2600); return; }
    if (game.board.game === "grab") { sayPlay(SAY.grabFirst); showHand(i); later(hideHand, 2600); return; }
    if (game.board.game === "top") { sayPlay(st.phase === "follow" ? fill(SAY.topFollow, { d: st.table[st.lead] }) : SAY.topLead); showHand(i); later(hideHand, 2600); return; }
    if (game.board.game === "dominoes") {
      if (st.phase === "draw") return fishTile();
      sayPlay(SAY.domFirst); showHand(i); later(hideHand, 2600); return;
    }
    // 🚪 rolled: the doors are the buttons now
    if (game.board.game === "doors" && st.phase === "shut") { sayPlay(fill(SAY.doorsPick, { d: st.die })); return; }
    if (st.phase === "choose") { sayPlay(SAY.pickDieAgain); showChoice(); showHand(i); later(hideHand, 2600); return; }
    if (st.phase === "roll") return rollDice();
    if (st.phase === "hop" && !save.auto) return hopOnce();
    if (st.phase === "spin") return game.board.game === "hen" ? spinFarm() : spinApples();
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
    // the faces this board's die really has (a hundred chart's has ten-bars)
    const all = L.facesOf(game.board), faces = [];
    for (const f of [3, 6, 10, 2, 5, 1, 4]) if (all.indexOf(f) >= 0) faces.push(f);
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
      if (game.board.game === "doors") { afterDoorsRoll(ev); return; }
      if (st.phase === "choose") { showChoice(); if (st.seats[st.turn].cpu) later(cpuChoose, T.cpuHop); else sayPlay(save.intro.pickdie ? SAY.pickDieAgain : SAY.pickFirstDie); return; }
      if (st.seats[st.turn].cpu) { later(cpuHop, T.cpuHop); return; }
      if (!save.intro[introKey()]) { sayPlay(hopLine()); showHand(st.turn); }
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
    if (!save.intro[introKey()] && !st.seats[ev[0].seat].cpu) { save.intro[introKey()] = true; persist(); }
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
    if (game.board.game === "lotto") return takeFood();
    if (game.board.game === "spot") return flipSpot();
    if (game.board.game === "pairs") return cpuPair();
    if (game.board.game === "acorns") return cpuAcorn();
    if (game.board.game === "dominoes") return cpuDom();
    if (game.board.game === "dig") return cpuDig();
    if (game.board.game === "nim") return cpuNim();
    if (game.board.game === "match3") return cpuM3();
    if (game.board.game === "maze") return cpuMaze();
    if (game.board.game === "lines") return cpuLines();
    if (game.board.game === "top") return cpuTop();
    if (game.board.game === "grab") return cpuGrab();
    if (game.board.game === "doors" && st.phase === "shut") return cpuDoors();
    if (st.phase === "choose") return cpuChoose();
    if (st.phase === "roll") return rollDice();
    if (st.phase === "spin") return game.board.game === "hen" ? spinFarm() : spinApples();
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
  // ---- 🧺 Picnic Lotto: take a food, then find whose blanket it goes on -------
  const foodSay = (id) => { const f = DATA.food(id); return f ? f.say : ""; };
  function whoseLine() { return cap(fill(SAY.whose, { f: foodSay(game.st.food) })); }
  function takeFood() {
    const ev = L.takeFood(game.st);
    if (!ev.length) return;
    hideHand();
    game.busy = true;
    game.rolled = true;
    game.foodShown = ev[0].food;
    SFX.flip();
    paintPads();
    paintFoods();
    persistGame();
    const st = game.st;
    if (st.seats[st.turn].cpu) {
      // the computer finds it itself, at a pace he can follow: a worked
      // example of looking at both blankets
      sayPlay(cap(foodSay(ev[0].food)) + "!");
      later(() => { game.busy = false; giveTo(L.ownerOf(game.st, game.st.food)); }, T.cpuThink);
      return;
    }
    sayPlay(whoseLine() + (save.intro.lotto ? "" : " " + SAY.whoseFirst));
    later(() => { game.busy = false; paintPads(); }, T.card);
  }
  function giveTo(i) {
    const st = game.st, ev = L.giveFood(st, i);
    if (!ev.length) return;
    if (ev[0].type === "miss") {
      // not there: a kind wiggle, and after two the food's own spot glows
      wiggle(pads[i]);
      sayPlay(fill(SAY.lookAgain, { f: foodSay(st.food) }));
      paintFoods();
      persistGame();
      return;
    }
    if (!save.intro.lotto && !st.seats[ev[0].seat].cpu) { save.intro.lotto = true; persist(); }
    playEvents(ev);
  }
  // Every food on the two blankets: the ones placed in full colour, the ones
  // still to come as a faint picture of what to look for, the one in hand's
  // spot glowing once he has looked twice
  function paintFoods() {
    if (!game || game.board.game !== "lotto") return;
    const st = game.st, b = game.board, sp = game.shownPlaced || st.placed;
    let html = "";
    for (let i = 0; i < 2; i++) {
      for (let k = 0; k < b.spots; k++) {
        const id = st.blankets[i][k], f = DATA.food(id), p = R.spotOf(i, k);
        const on = sp[i].indexOf(id) >= 0;
        const hintOn = !on && st.phase === "give" && st.food === id && st.misses >= 2;
        html += '<span class="bn-food' + (on ? " bn-food--on" : " bn-food--ghost") + (hintOn ? " bn-food--hint" : "") + (game.landed === id ? " bn-food--land" : "") +
          '" data-seat="' + i + '" data-k="' + k + '" data-food="' + id + '" style="left:' + (p.x / R.PIC.w * 100) + "%;top:" + (p.y / R.PIC.h * 100) + '%">' + (f ? f.pic : "") + "</span>";
      }
    }
    applesEl.innerHTML = html;
  }

  // 🐔 the farm's spinner: it turns, lands on an animal, and the square the
  // hen walks to lights up (the 🌈 card's mark) — then one tap, one chick.
  // A 🦊 is the whole turn.
  function spinFarm() {
    game.busy = true;
    hideHand();
    const ev = L.spin(game.st);
    if (!ev.length) { game.busy = false; return; }
    game.rolled = true;
    game.tumbling = true;
    let k = 0;
    paintPads();
    const go = () => { k++; SFX.tick(); if (k * 100 < T.tumble) later(go, 100); };
    go();
    later(() => {
      game.tumbling = false;
      SFX.thunk();
      game.busy = false;
      paintPads();
      const st = game.st, e = ev[0];
      if (e.face === L.FOX) { playEvents(ev.slice(1)); return; }
      const an = DATA.animal(e.face);
      sayPlay(fill(SAY.henSpin, { a: an ? an.say : "" }));
      showMark(e.to);
      persistGame();
      if (st.seats[st.turn].cpu) { later(cpuHop, T.cpuHop); return; }
      if (!save.intro.hen) { sayPlay(SAY.henFirst); showHand(st.turn); }
      if (save.auto) autoHops();
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
      if (e.type === "hop" && game.board.game === "hen") {
        // 🐔 the hen walks one square and one chick runs into the hen house:
        // the COUNT is the chicks home, popped and said
        moveToken(0, e.to, T.hop);
        game.shownCoop = e.coop;
        paintCoop();
        paintPads();
        SFX.plop(e.coop);
        sayPlay(String(e.coop));
        popOnSquare(e.to, String(e.coop));
        if (e.left === 0) hideMark();
        paintBoardLabel();
      } else if (e.type === "shut") {
        // 🚪 the door (or two) swings shut; two at once is a number bond: ⭐
        at(0, () => {
          game.shownShut[e.mover] = game.shownShut[e.mover].concat(e.doors);
          game.doorsGo = e.doors;
          paintDoors();
          SFX.thunk();
          if (e.doors.length === 2) {
            SFX.boost();
            sayPlay(fill(SAY.doorsTwo, { a: e.doors[0], b: e.doors[1], d: e.die }));
            landStar(e.seat);
            cheer(e.seat, true);
          } else sayPlay(fill(SAY.doorsShut, { d: e.doors[0] }));
          paintBoardLabel();
        });
        at(T.ride, () => { game.doorsGo = null; });
      } else if (e.type === "hole") {
        // 🏴‍☠️ not here: the hole shows an arrow toward the treasure
        at(0, () => {
          game.gv.dug[e.k] = true; game.gv.arrows[e.k] = e.dir; game.gv.fresh = e.k;
          paintDig();
          SFX.thunk();
          sayPlay(fill(SAY.digArrow, { d: ARROW_SAY[e.dir] || "" }));
        });
        at(T.look, () => { game.gv.fresh = -1; paintDig(); });
      } else if (e.type === "treasure") {
        at(0, () => {
          game.gv.dug[e.k] = true; game.gv.gem = e.k;
          paintDig();
          SFX.home();
          sayPlay(fill(SAY.digFound, { n: nameOf(e.seat) }));
          cheer(e.seat, true);
        });
        at(T.ride, () => { landStar(e.seat); paintBoardLabel(); });
      } else if (e.type === "choose") {
        // 🎲 the die he picked is the roll: the choice goes, its dots light
        at(0, () => {
          hideChoice();
          paintPads();
          SFX.thunk();
          sayPlay(String(e.die));
        });
        at(T.glide, () => {});
      } else if (e.type === "grab") {
        // 🎨 the patch turns its new colour and swallows the squares that
        // touch it (they pulse), and the count is said
        at(0, () => {
          const v = game.gbv;
          for (let k = 0; k < v.paint.length; k++) if (v.owner[k] === e.seat) v.paint[k] = e.c;
          for (const k of e.cells) { v.owner[k] = e.seat; v.paint[k] = e.c; }
          v.fresh = e.cells.slice();
          paintGrab();
          paintPads();
          paintBoardLabel();
          SFX.plop(e.cells.length);
          sayPlay(e.cells.length > 1 ? fill(SAY.grabGot, { d: e.cells.length }) : e.cells.length ? SAY.grabOne : SAY.grabNone);
        });
        at(T.glide, () => { game.gbv.fresh = []; });
      } else if (e.type === "bigGrab") {
        // a big grab is a ⭐
        at(0, () => { SFX.boost(); sayPlay(fill(SAY.grabBig, { n: nameOf(e.seat) })); cheer(e.seat, true); });
        at(T.ride, () => { landStar(e.seat); paintGrab(); });
      } else if (e.type === "lead" || e.type === "answer") {
        // 🃏 a card goes from the hand onto the table, under its player's face
        at(0, () => {
          const v = game.tv;
          v.hands[e.seat] = v.hands[e.seat].filter((x) => x !== e.v);
          v.table[e.seat] = e.v; v.fresh = e.seat;
          paintTop();
          SFX.flip();
          sayPlay(String(e.v));
        });
        at(T.glide, () => { game.tv.fresh = -1; });
      } else if (e.type === "trick") {
        // the bigger one glows and its player gets the ⭐; then the table is
        // cleared and both hands fill back up
        at(T.glide, () => {
          game.tv.win = e.win;
          paintTop();
          if (e.win >= 0) {
            SFX.boost();
            sayPlay(fill(SAY.topWin, { d: e.cards[e.win], e: e.cards[1 - e.win], n: nameOf(e.win) }));
            cheer(e.win, true);
          } else { SFX.thunk(); sayPlay(fill(SAY.topSame, { d: e.cards[0] })); }
        });
        at(T.ride, () => { if (e.win >= 0) landStar(e.win); paintBoardLabel(); });
        at(T.look - T.ride, () => { game.tv = topView(); paintTop(); });
      } else if (e.type === "drop") {
        // 🔴 the counter falls to the bottom of its column
        at(0, () => {
          game.lv.grid[e.cell] = e.seat; game.lv.fresh = e.cell;
          paintLines();
          SFX.plop(e.row);
        });
        at(T.glide, () => { game.lv.fresh = -1; });
      } else if (e.type === "line") {
        // three in a row: the three glow gold, a ⭐
        at(0, () => {
          game.lv.lines = game.lv.lines.concat(e.cells);
          paintLines();
          SFX.boost();
          sayPlay(fill(SAY.linesThree, { n: nameOf(e.seat) }));
          cheer(e.seat, true);
        });
        at(T.ride, () => { landStar(e.seat); paintBoardLabel(); });
      } else if (e.type === "fresh") {
        at(T.look, () => { game.lv = linesView(); SFX.whoosh(); sayPlay(SAY.linesNew); paintLines(); paintBoardLabel(); });
      } else if (e.type === "scurry") {
        // 🐭 the mouse scurries square by square; the steps are counted
        const word = L.MAZE_WORDS[e.dir];
        at(0, () => { game.zv.used = e.card; paintMaze(); sayPlay(e.path.length === 1 ? fill(SAY.mazeStep, { w: word }) : fill(SAY.mazeSteps, { d: e.path.length, w: word })); });
        e.path.forEach((sq, k) => at(k ? T.hop + 60 : T.glide, () => {
          game.zv.mice[e.seat] = sq;
          game.zv.used = null;
          paintMaze();
          SFX.hop(k);
        }));
        at(T.hop, () => {});
      } else if (e.type === "cheese") {
        at(0, () => {
          game.zv.eaten = true;
          paintMaze();
          SFX.home();
          sayPlay(fill(SAY.mazeCheese, { n: nameOf(e.seat) }));
          cheer(e.seat, true);
        });
        at(T.ride, () => { landStar(e.seat); paintBoardLabel(); });
      } else if (e.type === "newcheese") {
        at(T.look - T.ride, () => { game.zv.cheese = e.at; game.zv.eaten = false; SFX.whoosh(); sayPlay(SAY.mazeNew); paintMaze(); });
      } else if (e.type === "roll3") {
        // 🎯 the dice not kept tumble, then land: the faces are said
        at(0, () => { game.mv.rolling = true; game.mv.glow = []; paintM3(); SFX.thunk(); });
        at(T.tumble, () => {
          const v = game.mv;
          v.rolling = false; v.dice = e.dice.slice(); v.left = game.st.phase === "keep" && game.st.turn === e.seat ? game.st.left : 0;
          v.held = e.all ? [false, false, false] : v.held;
          paintM3();
          SFX.tick();
          sayPlay(e.dice.join(", "));
        });
      } else if (e.type === "match") {
        // two the same is a ⭐, three the same three ⭐s: the matching dice glow
        at(T.glide, () => {
          const v = game.mv;
          v.dice = e.dice.slice(); v.held = [false, false, false]; v.left = 0;
          v.glow = e.stars ? L.m3Keep(e.dice) : [];
          paintM3();
          if (e.stars) { SFX.home(); sayPlay(fill(e.stars === 3 ? SAY.m3Three : SAY.m3Pair, { n: nameOf(e.seat) })); cheer(e.seat, true); }
          else { SFX.whoosh(); sayPlay(SAY.m3None); }
        });
        for (let k = 0; k < e.stars; k++) at(k ? T.glide : T.ride, () => { landStar(e.seat); paintBoardLabel(); });
        if (!e.stars) at(T.ride, () => {});
      } else if (e.type === "nibble") {
        // 🍪 the cookies taken leave the jar (from the top), and the jar's
        // count is said: he counts how many are left
        at(0, () => {
          game.cv.going = e.n;
          paintNim();
          SFX.plop(e.left);
          if (e.left > 0) sayPlay(fill(SAY.nimLeft, { d: e.left }));
        });
        at(T.glide * 2, () => { game.cv.cookies = e.left; game.cv.going = 0; paintNim(); });
      } else if (e.type === "golden") {
        // the last one is the golden cookie: a ⭐
        at(0, () => {
          game.cv.gold = true;
          paintNim();
          SFX.home();
          sayPlay(fill(SAY.nimGold, { n: nameOf(e.seat) }));
          cheer(e.seat, true);
        });
        at(T.ride, () => { landStar(e.seat); paintBoardLabel(); });
      } else if (e.type === "jar") {
        at(T.cheer - T.ride, () => { game.cv = { cookies: e.n, jar: e.jar, going: 0, gold: false }; SFX.whoosh(); sayPlay(SAY.nimJar); paintNim(); paintBoardLabel(); });
      } else if (e.type === "bury") {
        at(T.look, () => { game.gv = digView(); SFX.whoosh(); sayPlay(SAY.digNew); paintDig(); });
      } else if (e.type === "lay") {
        // 🁢 the tile goes on its end: the dots that match are said
        at(0, () => {
          const v = game.dv;
          v.hands[e.seat] = v.hands[e.seat].filter((x) => x !== e.id);
          if (e.side === "right") { v.line.push(e.tile); v.fresh = v.line.length - 1; } else { v.line.unshift(e.tile); v.fresh = 0; }
          v.ends = e.ends.slice();
          v.held = null; v.glow = [];
          paintDom();
          SFX.glide();
          const n = e.side === "right" ? e.tile[0] : e.tile[1];
          sayPlay(e.double ? SAY.domDouble : fill(SAY.domLay, { n }));
          if (e.double || e.out) cheer(e.seat, true);
        });
        at(T.ride, () => {
          game.dv.fresh = null;
          if (e.double) landStar(e.seat);
          paintDom();
          paintBoardLabel();
        });
        if (e.out) at(400, () => { landStar(e.seat); SFX.home(); sayPlay(fill(SAY.domOut, { n: nameOf(e.seat) })); paintPads(); });
      } else if (e.type === "take") {
        // fishing: the pile's top tile turns over — it matches (into his
        // hand), or back under the pile it goes
        at(0, () => {
          game.dv.fish = e.id; game.dv.fishOk = e.fits;
          paintDom();
          SFX.flip();
          sayPlay(e.fits ? SAY.domTake : SAY.domBack);
        });
        at(T.look, () => {
          game.dv.fish = null;
          if (e.fits) { game.dv.hands[e.seat].push(e.id); game.dv.glow = [e.id]; }
          paintDom();
          paintPads();
        });
      } else if (e.type === "pass") {
        at(0, () => sayPlay(fill(SAY.domPass, { n: nameOf(e.seat) })));
        at(900, () => {});
      } else if (e.type === "scoop") {
        // 🌰 he lifts the pot's acorns...
        at(0, () => { game.av.pots[e.from] = 0; game.av.from = e.from; paintAcorns(); SFX.flip(); });
        at(300, () => {});
      } else if (e.type === "sow") {
        // ...and they drop in one by one, each pot counting "1, 2, 3"
        at(0, () => {
          game.av.pots[e.to] += 1;
          game.av.drop = e.to;
          game.av.c = e.c;
          paintAcorns();
          SFX.glide();
        });
        at(T.hop + 160, () => {});
      } else if (e.type === "again") {
        // the last one in his own nest: a ⭐, and he goes again
        at(0, () => {
          game.av.drop = -1; game.av.from = -1; game.av.glow = L.ACORN_NEST(e.seat);
          paintAcorns();
          SFX.boost();
          sayPlay(SAY.acornsAgain);
          cheer(e.seat, true);
        });
        at(T.ride, () => { game.av.glow = -1; landStar(e.seat); paintAcorns(); paintBoardLabel(); });
      } else if (e.type === "landed") {
        at(0, () => { game.av.drop = -1; game.av.from = -1; paintAcorns(); paintBoardLabel(); });
        at(400, () => {});
      } else if (e.type === "sweep") {
        // a side is empty: what is left goes home to its own nest
        at(0, () => {
          for (const k of [0, 1, 2]) game.av.pots[e.seat * 4 + k] = 0;
          game.av.pots[L.ACORN_NEST(e.seat)] += e.n;
          game.av.drop = -1; game.av.from = -1;
          paintAcorns();
          SFX.whoosh();
          sayPlay(SAY.acornsRest);
        });
        at(T.ride, () => {});
      } else if (e.type === "peek") {
        // 🧠 a card turns over and its picture is said
        at(0, () => {
          game.pv.up.push(e.k);
          game.pv.fresh = e.k;
          SFX.flip();
          sayPlay(cap(pairSay(e.pic)));
          paintPairs();
        });
        // a short hold only: he turns his second card as soon as he likes
        at(250, () => {});
      } else if (e.type === "star") {
        at(0, () => { game.pv.glow.push(e.k); paintPairs(); SFX.boost(); sayPlay(SAY.pairStar); cheer(e.seat, true); });
        at(T.ride, () => {
          game.pv.gone[e.k] = true;
          game.pv.glow = [];
          landStar(e.seat);
          paintPairs();
          paintBoardLabel();
        });
      } else if (e.type === "pair") {
        // a pair! both glow, then go to the finder's pile (a ⭐ on the pad)
        at(0, () => {
          game.pv.glow.push(e.a, e.b);
          paintPairs();
          SFX.home();
          sayPlay(fill(SAY.pairYes, { p: (DATA.pairPic(e.pic) || {}).two || "" }));
          cheer(e.seat, true);
        });
        at(T.ride, () => {
          game.pv.gone[e.a] = game.pv.gone[e.b] = true;
          game.pv.glow = [];
          game.pv.up = [];
          landStar(e.seat);
          paintPairs();
          paintBoardLabel();
        });
      } else if (e.type === "nopair") {
        // not a pair: both stay up a moment (look hard!), then turn back over
        at(0, () => sayPlay(SAY.pairNo));
        at(T.look, () => { game.pv.up = []; paintPairs(); });
      } else if (e.type === "deal") {
        // a cleared board: the next nine cards, face down
        at(400, () => { game.pv = pairsView(); SFX.whoosh(); sayPlay(SAY.pairsNew); paintPairs(); paintBoardLabel(); });
        at(T.card, () => {});
      } else if (e.type === "found") {
        // 👀 the twin! it glows on both cards, then the found card slides to
        // the middle and onto the finder's pile
        SFX.home();
        sayPlay(cap(fill(SAY.foundTwin, { s: (DATA.spot(e.twin) || {}).say || "" })));
        cheer(e.seat, true);
        at(T.ride, () => {
          game.spotYes = null; game.spotHand = null; game.spotMid = null;
          landStar(e.seat);
          paintSpots();
          paintPads();
        });
      } else if (e.type === "give") {
        // 🧺 the food lands on its spot on the right blanket
        game.foodShown = null;
        game.shownPlaced[e.owner].push(e.food);
        game.landed = e.food;
        paintFoods();
        paintPads();
        SFX.plop(e.count);
        sayPlay(cap(fill(SAY.giveMine, { f: foodSay(e.food), n: nameOf(e.owner) })));
        const p = R.spotOf(e.owner, e.slot);
        popAt({ x: p.x / R.PIC.w, y: (p.y - 30) / R.PIC.h }, String(e.count));
        paintBoardLabel();
        if (e.owner !== e.seat) cheer(e.seat, true);
        at(T.hop + 300, () => { game.landed = null; });
      } else if (e.type === "full") {
        at(T.hop, () => {
          SFX.home();
          sayPlay(fill(endLine("home"), { n: nameOf(e.seat) }));
          cheer(e.seat, true);
          try { if (global.JoshEffects && playVisible()) global.JoshEffects.stars(); } catch (err) { /* ignore */ }
        });
        at(900, () => {});
      } else if (e.type === "fox") {
        // 🦊 a fox wants to play: one chick runs OUT of the hen house to play
        // (it comes home at the end) — never a scold, a friendly tweet
        at(T.hop, () => {
          game.shownCoop = e.coop;
          paintCoop();
          SFX.tweet();
          sayPlay(SAY.fox);
          const c = R.centre(game.board, game.board.size);
          popAt({ x: c.x / (game.board.cols * R.CELL), y: (c.y + R.CELL * 0.35) / (game.board.rows * R.CELL) }, "🦊", true);
          paintBoardLabel();
        });
        at(T.ride, () => {});
      } else if (e.type === "henhome") {
        // the hen is home: the chicks who were out playing run home too
        at(T.hop + 120, () => {
          game.shownCoop = e.coop;
          paintCoop();
          hideMark();
          SFX.home();
          sayPlay(SAY.henHome);
          try { if (global.JoshEffects && playVisible()) global.JoshEffects.stars(); } catch (err) { /* ignore */ }
          paintBoardLabel();
        });
        at(900, () => {});
      } else if (e.type === "hop" && e.ten) {
        // 💯 a ten-bar: one slide straight DOWN one row of the chart, ten
        // more ("24… 34! Ten more!"): slower than a hop, so the straight-down
        // line is seen
        moveToken(e.seat, e.to, T.ten);
        paintPads();
        SFX.ten();
        sayPlay(fill(SAY.ten, { to: e.to }));
        popOnSquare(e.to, String(e.to));
        paintBoardLabel();
        at(T.ten, () => {});
      } else if (e.type === "hop") {
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
        sayPlay(cardLine(e));
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
        } else if (e.back) {
          // a picture card BEHIND slides him back to it, as in Candy Land: one
          // swoop, like a comet, so he SEES where the picture is — never a
          // square-by-square crawl backwards. No star: it is not a ride.
          at(0, () => {
            tokens[e.mover].classList.add("bn-token--ride");
            moveToken(e.mover, e.to, T.ride);
            SFX.comet();
          });
          at(T.ride, () => {
            tokens[e.mover].classList.remove("bn-token--ride");
            hideMark();
            popOnSquare(e.to, String(e.to));
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
      } else if (e.type === "tens") {
        // 💯 a turn ending on a tens square: a ⭐, counting by tens
        at(T.hop + 120, () => {
          popOnSquare(e.at, "⭐");
          landStar(e.seat);
          SFX.boost();
          sayPlay(fill(SAY.tens, { to: e.at }));
          cheer(e.seat);
          paintPads();
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
      // 🧠 a card, a pair or a star: the turn goes on (his next card, or the
      // computer's) once the moment has been shown
      // 🁢 a fished tile: fish again, or lay it (his, or the computer's)
      if (game.board.game === "dominoes") {
        at(0, () => {
          if (!game) return;
          game.busy = false;
          paintPads();
          paintDom();
          const st = game.st;
          if (st.phase !== "done" && st.seats[st.turn].cpu) later(cpuDom, T.cpuHop);
          else if (st.phase === "lay") sayPlay(SAY.domFirst);
        });
      }
      // 🎯 dice rolled, and the turn goes on: keep some, roll again
      if (game.board.game === "match3") {
        at(0, () => {
          if (!game) return;
          game.busy = false;
          paintPads();
          paintM3();
          const st = game.st;
          if (st.phase === "keep" && st.seats[st.turn].cpu) later(cpuM3, T.cpuThink);
          else if (st.phase === "keep" && !game.m3Told) { game.m3Told = true; sayPlay(SAY.m3Keep); }
        });
      }
      // 🌰 a last acorn in the nest: his next pot (or the computer's)
      if (game.board.game === "acorns") {
        at(0, () => {
          if (!game) return;
          game.busy = false;
          paintPads();
          paintAcorns();
          const st = game.st;
          if (st.phase !== "done" && st.seats[st.turn].cpu) later(cpuAcorn, T.cpuThink);
        });
      }
      if (game.board.game === "pairs") {
        at(0, () => {
          if (!game) return;
          game.busy = false;
          paintPads();
          paintPairs();
          const st = game.st;
          if (st.phase !== "done" && st.seats[st.turn].cpu) later(cpuPair, T.cpuThink);
        });
      }
    }
  }
  function cardLine(e) {
    const card = e.card;
    if (card.kind === "pic") {
      const lm = (game.board.landmarks || []).find((l) => l.at === card.at);
      return fill(e.zoom ? SAY.cardPic : e.back ? SAY.cardBack : SAY.cardPicGo, { p: lm ? lm.say : "" });
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
    if (game.board.lines) return fill(game.board.lines[kind], { k: game.st.coop });
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
    if (!markEl || (game.board.game !== "cards" && game.board.game !== "hen")) return;
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
    // 🧠 the cards are the buttons, so the hand points at one face down
    // (🌰 a pot: the one whose last acorn reaches his nest, if there is one)
    const again = game && game.board.game === "acorns" ? L.acornAgains(game.st) : [];
    const card = game && game.board.game === "pairs" ? pairsEl.querySelector("button.bn-pc:not(.bn-pc--up)")
      : game && game.board.game === "dig" ? digEl.querySelector("button.bn-sand")
      : game && game.st.phase === "choose" && !chooseEl.hidden ? chooseEl.querySelector("button.bn-pickd--hint") || chooseEl.querySelector("button.bn-pickd")
      : game && game.board.game === "grab" ? grabEl.querySelector("button.bn-swatch--hint") || grabEl.querySelector("button.bn-swatch")
      : game && game.board.game === "top" ? topEl.querySelector("button.bn-tc--hint") || topEl.querySelector("button.bn-tc")
      : game && game.board.game === "lines" ? linesEl.querySelector("button.bn-col--hint") || linesEl.querySelector("button.bn-col")
      : game && game.board.game === "maze" ? mazeEl.querySelector("button.bn-arrow--hint") || mazeEl.querySelector("button.bn-arrow")
      : game && game.board.game === "match3" ? m3El.querySelector("button.bn-m3d--hint") || m3El.querySelector("button.bn-m3roll")
      : game && game.board.game === "nim" ? nimEl.querySelector("button.bn-takeb--hint") || nimEl.querySelector("button.bn-takeb")
      : game && game.board.game === "dominoes" ? (game.st.phase === "lay" && (domEl.querySelector("button.bn-domt") && [...domEl.querySelectorAll("button.bn-domt")].find((b) => L.domSides(game.st, b.dataset.id).length))) || null
      : game && game.board.game === "acorns" ? (again.length && acornsEl.querySelector('button.bn-pot[data-k="' + again[again.length - 1] + '"]')) || acornsEl.querySelector("button.bn-pot") : null;
    const pad = card || pads[i];
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
    if (st.phase === "hop") say(hopLine());
    else if (st.phase === "pick") say(SAY.pickFirst);
    else if (st.phase === "give") say(whoseLine() + " " + SAY.whoseFirst);
    else if (st.phase === "find") say(SAY.findTwin);
    else if (st.phase === "second") say(SAY.pairsFirst);
    else if (st.phase === "shut") say(fill(SAY.doorsPick, { d: st.die }));
    else if (st.phase === "draw") say(SAY.domDraw);
    else if (st.phase === "choose") say(SAY.pickDieAgain);
    else if (st.phase === "follow") say(fill(SAY.topFollow, { d: st.table[st.lead] }));
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
    hideChoice();
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
      if (opts && opts.introSeen) for (const k of INTRO) save.intro[k] = true;
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
      const st = L.create({ board: b.board, seats: [{ who: "josh" }, { who: friend, cpu: !!cpu }], seed: seed || 1, first: first || 0, birds: !!birds, fox: !!birds });
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
