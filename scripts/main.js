// Josh's Games — launcher + router + boot. Builds the home grid from the game
// registry (window.JoshGames), mounts each game's screen, and switches screens
// via the URL hash (so the phone Back button works and games are deep-linkable
// and testable). Feature-isolated: one broken game can't take down the rest.

(function () {
  const C = window.JoshContent || {};
  const A = window.JoshAudio || { isMuted: () => true, toggle() {} };
  const F = window.JoshFramework;

  // Top-level categories (the home menu). Icons carry the meaning for a non-reader.
  const CATEGORIES = [
    { id: "numbers", icon: "🔢", title: "Numbers", color: "#5ec8ff" },
    { id: "letters", icon: "🔤", title: "Letters", color: "#ff7ac0" },
    { id: "thinking", icon: "🧠", title: "Thinking", color: "#c77dff" },
    { id: "find", icon: "🔍", title: "Find It", color: "#3ec7c7" },
    { id: "science", icon: "🔬", title: "Science", color: "#7be08a" },
    { id: "play", icon: "🎉", title: "Fun & Play", color: "#ffa64d" },
    { id: "friends", icon: "🤝", title: "Calm & Friends", color: "#ff5e7e" },
  ];
  // Which category each game belongs to. Every registered game MUST appear here
  // (a test fails otherwise, so a new game can't slip in uncategorized).
  const CATEGORY_OF = {
    "count-feed": "numbers", "number-builder": "numbers", "skip-hop": "numbers", "take-away": "numbers",
    "which-more": "numbers", "coin-shop": "numbers", "add-up": "numbers", "number-match": "numbers",
    "clock": "numbers", "place-value": "numbers", "ten-frame": "numbers", "set-clock": "numbers",
    "make-ten": "numbers", "big-add": "numbers", "piggy-bank": "numbers", "number-muncher": "numbers",
    "fair-share": "numbers", "quick-peek": "numbers",
    "first-sound": "letters", "rhyme": "letters", "build-word": "letters", "sight-word": "letters",
    "digraph": "letters", "letter-match": "letters", "missing-letter": "letters", "read-zap": "letters",
    "rhyme-train": "letters", "digraph-finish": "letters", "letter-maker": "letters", "name-spell": "letters",
    "read-do": "letters", "listen-answer": "letters", "alpha-train": "letters",
    "odd-one-out": "thinking", "what-next": "thinking", "shadow-match": "thinking", "order-size": "thinking",
    "memory": "thinking", "order-num": "thinking", "spot-diff": "thinking", "color-number": "thinking",
    "who-is-it": "thinking", "picture-squares": "thinking", "story-order": "thinking", "birds-eye": "thinking",
    "piece-fit": "thinking", "who-hid": "thinking", "copy-beat": "thinking",
    "find-hero": "find", "find-crowd": "find", "find-count": "find", "dot-dot": "find", "rescue": "find",
    "find-twins": "find", "i-spy": "find", "big-red-one": "find", "web-reveal": "find", "letter-hunt": "find",
    "science-sort": "science", "color-sort": "science", "law-sort": "science", "day-night": "science", "hot-cold": "science",
    "solid-match": "science", "magnet-magic": "science", "blue-planet": "science", "continent-match": "science",
    "landform-maker": "science", "plane-shape": "science", "continent-home": "science",
    "plant-animal": "science", "color-mix": "science", "sink-float": "science", "mama-baby": "science",
    "tic-tac-toe": "friends",
    "animals": "play", "bubbles": "play", "peekaboo": "play", "balloon": "play", "music-pad": "play",
    "grow": "play", "thwip-web": "play", "thwip-villains": "play", "dress-me": "play", "seasons": "play",
    "breathe": "friends", "certificate": "friends", "trace-path": "friends", "team-hop": "friends", "team-build": "friends",
    "team-count": "friends", "team-rocket": "friends", "team-bridge": "friends", "team-treasure": "friends",
    "team-sound-hunt": "friends", "memory-together": "friends", "friend-race": "friends",
    "feelings": "friends", "kind-helpers": "friends", "day-train": "friends",
  };

  // Set by initLauncher once the Sticker Book screen exists; re-syncs every slot
  // + the star meter from JoshProgress. Held at module scope so the router and
  // the grown-ups reset can refresh the book too.
  let refreshStickers = null;

  document.addEventListener("DOMContentLoaded", () => {
    for (const init of [initSound, initLauncher, initParentGate, initBuddy]) {
      try { init(); } catch (e) { console.error("Josh: init failed:", e); }
    }
  });

  // Mount Josh's buddy companion on the home screen (above the game grid).
  function initBuddy() {
    const home = document.getElementById("screen-home");
    const grid = document.getElementById("home-grid");
    if (home && window.JoshBuddy && window.JoshBuddy.mount) window.JoshBuddy.mount(home, grid);
  }

  // Register the service worker (PWA / offline). Best-effort; never blocks UI.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((e) =>
        console.warn("Josh: service worker registration failed:", e)
      );
    });
  }

  // ---- Grown-ups: reset the ⭐ badges (a text parent-gate) ----
  // A small, discreet button (marked data-adult so it is exempt from the kid
  // ≥75px audit — it is deliberately small so a preschooler ignores it). It pops
  // a text box that ONLY accepts the word "reset" (any case); nothing else clears
  // anything. Clearing removes every josh-won-* flag and its ⭐ badge.
  function clearStars() {
    let n = 0;
    if (window.JoshProgress && window.JoshProgress.clear) {
      n = window.JoshProgress.clear();
    } else {
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf("josh-won-") === 0) keys.push(k);
        }
        keys.forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
        n = keys.length;
      } catch (e) { /* localStorage may be unavailable */ }
    }
    document.querySelectorAll(".tile__badge").forEach((b) => b.remove());
    document.querySelectorAll(".sticker-slot.is-won").forEach((s) => s.classList.remove("is-won"));
    if (typeof refreshStickers === "function") refreshStickers();
    return n;
  }

  function initParentGate() {
    const home = document.getElementById("screen-home");
    if (!home) return;

    const btn = document.createElement("button");
    btn.id = "reset-stars";
    btn.className = "reset-stars";
    btn.type = "button";
    btn.dataset.adult = "1"; // exempt from the kid tap-size audit (adult-only control)
    btn.setAttribute("aria-label", "Grown-ups: reset stars");
    btn.textContent = "⚙️ Grown-ups";
    home.appendChild(btn);

    const overlay = document.createElement("div");
    overlay.className = "gate";
    overlay.hidden = true;
    overlay.dataset.adult = "1";
    overlay.innerHTML =
      '<div class="gate__box" role="dialog" aria-modal="true" aria-label="Reset stars">' +
        '<p class="gate__msg">Grown-ups: type <b>reset</b> to clear all&nbsp;⭐</p>' +
        '<input class="gate__input" type="text" inputmode="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" aria-label="Type the word reset" />' +
        '<p class="gate__err" hidden>That’s not the word. Type <b>reset</b>.</p>' +
        '<div class="gate__row">' +
          '<button class="gate__cancel" type="button" data-adult="1">Cancel</button>' +
          '<button class="gate__ok" type="button" data-adult="1">OK</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    const input = overlay.querySelector(".gate__input");
    const err = overlay.querySelector(".gate__err");
    const box = overlay.querySelector(".gate__box");

    function open() { overlay.hidden = false; err.hidden = true; input.value = ""; setTimeout(() => { try { input.focus(); } catch (e) { /* ignore */ } }, 30); }
    function close() { overlay.hidden = true; }
    function toast(msg) {
      const t = document.createElement("div");
      t.className = "gate__done";
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 1600);
    }
    function submit() {
      if (input.value.trim().toLowerCase() === "reset") {
        const n = clearStars();
        close();
        toast(n ? "Stars cleared! ✨" : "No stars to clear.");
      } else {
        err.hidden = false;
        box.classList.remove("bump"); void box.offsetWidth; box.classList.add("bump");
        try { input.select(); } catch (e) { /* ignore */ }
      }
    }

    btn.addEventListener("click", open);
    overlay.querySelector(".gate__ok").addEventListener("click", submit);
    overlay.querySelector(".gate__cancel").addEventListener("click", close);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); }); // tap the dim area to cancel
  }

  // ---- Big sound on/off toggle (off by default) ----
  function initSound() {
    const btn = document.getElementById("sound-toggle");
    if (!btn) return;
    function upd() {
      const m = A.isMuted();
      btn.textContent = m ? "🔇" : "🔊";
      btn.setAttribute("aria-label", m ? "Sound is off. Tap to turn sound on." : "Sound is on. Tap to turn sound off.");
      btn.setAttribute("aria-pressed", String(!m));
    }
    upd();
    btn.addEventListener("click", () => { A.toggle(); upd(); });
  }

  // ---- Launcher: category tiles -> per-category game grids -> games ----
  function wonAlready(id) {
    if (window.JoshProgress) return window.JoshProgress.isWon(id);
    try { return localStorage.getItem("josh-won-" + id) === "1"; } catch (e) { return false; }
  }
  function addBadge(tile) {
    if (tile && !tile.querySelector(".tile__badge")) {
      const s = document.createElement("span");
      s.className = "tile__badge";
      s.setAttribute("aria-hidden", "true");
      s.textContent = "⭐";
      tile.appendChild(s);
    }
  }
  function markTileWon(id) { addBadge(document.querySelector('.tile[data-go="' + id + '"]')); }

  function gameTile(def) {
    const tile = document.createElement("button");
    tile.className = "tile tap";
    tile.type = "button";
    tile.dataset.go = def.id;
    tile.setAttribute("role", "listitem");
    tile.setAttribute("aria-label", def.title);
    tile.innerHTML = '<span class="tile__icon" aria-hidden="true"></span><span class="tile__label"></span>';
    tile.querySelector(".tile__icon").textContent = def.icon;
    tile.querySelector(".tile__label").textContent = def.title;
    tile.addEventListener("click", () => { location.hash = "#" + def.id; });
    if (wonAlready(def.id)) addBadge(tile);
    return tile;
  }

  function initLauncher() {
    const screens = document.getElementById("screens");
    const grid = document.getElementById("home-grid");
    if (!screens || !grid || !F) return;
    const games = window.JoshGames || [];

    // Group games by category; record each game's category on its def so the
    // in-game Home button can return to the right category screen.
    const byCat = {};
    games.forEach((def) => {
      const cat = CATEGORY_OF[def.id] || "";
      def.cat = cat;
      if (cat) (byCat[cat] = byCat[cat] || []).push(def);
    });

    // Home: a "Surprise!" tile + one big tile per category.
    const surprise = document.createElement("button");
    surprise.className = "tile tile--surprise tap";
    surprise.type = "button";
    surprise.setAttribute("role", "listitem");
    surprise.setAttribute("aria-label", "Surprise game");
    surprise.innerHTML = '<span class="tile__icon" aria-hidden="true">🎲</span><span class="tile__label">Surprise!</span>';
    surprise.addEventListener("click", () => {
      const g = games[Math.floor(Math.random() * games.length)];
      if (g) location.hash = "#" + g.id;
    });
    grid.appendChild(surprise);

    // A Sticker Book tile: opens a scrapbook that fills as Josh wins games.
    const stickersTile = document.createElement("button");
    stickersTile.className = "tile tile--stickers tap";
    stickersTile.type = "button";
    stickersTile.setAttribute("role", "listitem");
    stickersTile.setAttribute("aria-label", "Sticker book");
    stickersTile.innerHTML = '<span class="tile__icon" aria-hidden="true">📖</span><span class="tile__label">Stickers</span>';
    stickersTile.addEventListener("click", () => { location.hash = "#stickers"; });
    grid.appendChild(stickersTile);

    CATEGORIES.forEach((cat) => {
      const list = byCat[cat.id] || [];
      if (!list.length) return;

      const tile = document.createElement("button");
      tile.className = "tile tile--cat tap";
      tile.type = "button";
      tile.dataset.cat = cat.id;
      tile.setAttribute("role", "listitem");
      tile.setAttribute("aria-label", cat.title);
      tile.style.setProperty("--cat-color", cat.color);
      tile.innerHTML = '<span class="tile__icon" aria-hidden="true"></span><span class="tile__label"></span>';
      tile.querySelector(".tile__icon").textContent = cat.icon;
      tile.querySelector(".tile__label").textContent = cat.title;
      tile.addEventListener("click", () => { location.hash = "#cat-" + cat.id; });
      grid.appendChild(tile);

      // A screen holding this category's games.
      const screen = document.createElement("section");
      screen.className = "screen category";
      screen.id = "screen-cat-" + cat.id;
      screen.hidden = true;
      const bar = document.createElement("div");
      bar.className = "game__bar";
      const back = document.createElement("button");
      back.className = "btn-round game__home";
      back.type = "button";
      back.setAttribute("aria-label", "Home");
      back.textContent = "🏠";
      back.addEventListener("click", () => { location.hash = ""; });
      const title = document.createElement("h2");
      title.className = "game__title";
      title.textContent = cat.icon + " " + cat.title;
      bar.append(back, title, document.createElement("span"));
      const cgrid = document.createElement("div");
      cgrid.className = "home-grid";
      list.forEach((def) => cgrid.appendChild(gameTile(def)));
      screen.append(bar, cgrid);
      screens.appendChild(screen);
    });

    // Build the actual game screens.
    games.forEach((def) => { screens.appendChild(F.buildGameScreen(def)); });

    // ---- Sticker Book: a scrapbook with one slot per game ----
    // Every win "plops" that game's signature sticker (from JoshStickers) into
    // its slot, and a star meter shows how full the book is — turning the
    // invisible josh-won flags into something Josh can flip through.
    buildStickerBook(screens, games);

    // Live-badge a game the moment it's first beaten, and fill its sticker slot.
    window.addEventListener("josh-won", (e) => {
      if (!e.detail || !e.detail.id) return;
      markTileWon(e.detail.id);
      const slot = document.querySelector('.sticker-slot[data-sticker="' + e.detail.id + '"]');
      if (slot && !slot.classList.contains("is-won")) {
        slot.classList.add("is-won");
        slot.classList.remove("plop"); void slot.offsetWidth; slot.classList.add("plop");
      }
      if (typeof refreshStickers === "function") refreshStickers();
    });

    window.addEventListener("hashchange", route);
    route();
  }

  // Build the #screen-stickers scrapbook and wire refreshStickers().
  function buildStickerBook(screens, games) {
    const ST = window.JoshStickers;
    const screen = document.createElement("section");
    screen.className = "screen stickers";
    screen.id = "screen-stickers";
    screen.hidden = true;

    const bar = document.createElement("div");
    bar.className = "game__bar";
    const back = document.createElement("button");
    back.className = "btn-round game__home";
    back.type = "button";
    back.setAttribute("aria-label", "Home");
    back.textContent = "🏠";
    back.addEventListener("click", () => { location.hash = ""; });
    const title = document.createElement("h2");
    title.className = "game__title";
    title.textContent = "📖 My Stickers";
    bar.append(back, title, document.createElement("span"));

    const meter = document.createElement("div");
    meter.className = "sticker-meter";
    meter.setAttribute("aria-hidden", "true");
    const meterFill = document.createElement("div");
    meterFill.className = "sticker-meter__fill";
    const meterText = document.createElement("div");
    meterText.className = "sticker-meter__text";
    meter.append(meterFill, meterText);

    const sgrid = document.createElement("div");
    sgrid.className = "sticker-grid";
    games.forEach((def) => {
      const slot = document.createElement("button");
      slot.className = "sticker-slot tap";
      slot.type = "button";
      slot.dataset.sticker = def.id;
      slot.setAttribute("aria-label", def.title);
      const seal = document.createElement("span");
      seal.className = "sticker-slot__seal";
      seal.setAttribute("aria-hidden", "true");
      seal.textContent = "❓";
      const art = document.createElement("span");
      art.className = "sticker-slot__art art-fill";
      art.setAttribute("aria-hidden", "true");
      try { art.innerHTML = ST ? ST.artFor(def) : ""; } catch (e) { art.textContent = "⭐"; }
      slot.append(seal, art);
      slot.addEventListener("click", () => {
        if (slot.classList.contains("is-won")) { location.hash = "#" + def.id; } // a won sticker replays its game
        else { if (A.say) A.say("Play to win this one!"); slot.classList.remove("bump"); void slot.offsetWidth; slot.classList.add("bump"); }
      });
      sgrid.appendChild(slot);
    });

    screen.append(bar, meter, sgrid);
    screens.appendChild(screen);

    refreshStickers = function () {
      const total = games.length;
      let won = 0;
      games.forEach((def) => {
        const slot = sgrid.querySelector('.sticker-slot[data-sticker="' + def.id + '"]');
        const isWon = wonAlready(def.id);
        if (slot) slot.classList.toggle("is-won", isWon);
        if (isWon) won += 1;
      });
      meterFill.style.width = total ? Math.round((won / total) * 100) + "%" : "0%";
      meterText.textContent = "⭐ " + won + " / " + total;
      screen.dataset.won = String(won);
    };
    refreshStickers();
  }

  function route() {
    const id = (location.hash || "").replace(/^#/, "");
    const home = document.getElementById("screen-home");
    document.querySelectorAll(".screen").forEach((s) => { s.hidden = true; });

    if (!id || id === "home") {
      if (home) home.hidden = false;
      document.body.classList.remove("in-game");
      window.scrollTo(0, 0);
      return;
    }
    // A category screen (#cat-<id>) stays "out of game".
    if (id.indexOf("cat-") === 0) {
      const cs = document.getElementById("screen-" + id);
      if (cs) { cs.hidden = false; document.body.classList.remove("in-game"); window.scrollTo(0, 0); return; }
    }
    // The Sticker Book (#stickers) is an out-of-game screen; re-sync it on show.
    if (id === "stickers") {
      const ss = document.getElementById("screen-stickers");
      if (ss) {
        ss.hidden = false;
        document.body.classList.remove("in-game");
        if (typeof refreshStickers === "function") refreshStickers();
        window.scrollTo(0, 0);
        return;
      }
    }
    const target = document.getElementById("screen-" + id);
    if (target) {
      target.hidden = false;
      document.body.classList.add("in-game");
      if (!target.__started) { target.__start(); target.__started = true; }
      if (target.__onShow) target.__onShow();
      window.scrollTo(0, 0);
    } else if (home) {
      home.hidden = false;
      document.body.classList.remove("in-game");
    }
  }
})();
