// 华丽的世界 — the hidden second site for Josh's grandma Huali (华丽):
// a 👵🏻 door in the top bar, a Chinese name-gate (only 华丽 passes), and a
// red-and-gold launcher with 7 categories + her own 🏮 sticker collection.
// Her games register through the SAME framework (ids prefixed "hl-",
// def.hl = true, def.lang = "zh") so they inherit the whole test contract;
// this file only builds her navigation shell. Josh's launcher never shows
// her games (they carry no CATEGORY_OF entry) and his star-reset preserves
// her progress (main.js skips josh-won-hl-*).

(function () {
  const HL = window.HualiContent;
  const F = window.JoshFramework;
  const A = window.JoshAudio || { say() {} };
  if (!HL || !F) return;

  const OK_FLAG = "hl-ok"; // session flag: the name gate was passed this visit
  function unlocked() { try { return sessionStorage.getItem(OK_FLAG) === "1"; } catch (e) { return false; } }
  function unlock() { try { sessionStorage.setItem(OK_FLAG, "1"); } catch (e) { /* ignore */ } }

  const sayZh = (t) => A.say(t, { lang: "zh-CN" });
  function wonAlready(id) {
    if (window.JoshProgress) return window.JoshProgress.isWon(id);
    try { return localStorage.getItem("josh-won-" + id) === "1"; } catch (e) { return false; }
  }
  // A stable Chinese-motif sticker per game (FNV-ish hash into the pool).
  function stickerFor(id) {
    let h = 2166136261;
    for (const ch of id) h = ((h ^ ch.codePointAt(0)) * 16777619) >>> 0;
    return HL.STICKER_POOL[h % HL.STICKER_POOL.length];
  }

  let refreshHlStickers = null;

  document.addEventListener("DOMContentLoaded", () => {
    for (const init of [initDoor, initWorld, initThemeSync]) {
      try { init(); } catch (e) { console.error("Huali: init failed:", e); }
    }
  });

  // ---- The 👵🏻 door + the Chinese name gate --------------------------------
  function initDoor() {
    const sound = document.getElementById("sound-toggle");
    if (!sound || !sound.parentNode) return;

    const door = document.createElement("button");
    door.id = "hl-door";
    door.className = "btn-round hl-door";
    door.type = "button";
    door.setAttribute("aria-label", "华丽的游戏");
    door.textContent = "👵🏻";
    sound.parentNode.insertBefore(door, sound);

    // NOTE: deliberately NOT the shared .gate/.gate__* classes — Josh's reset
    // gate is located by tests as ".gate", and a second .gate overlay would
    // trip Playwright's strict-mode locators. Her gate is styled on its own.
    const overlay = document.createElement("div");
    overlay.className = "hl-gate";
    overlay.hidden = true;
    overlay.innerHTML =
      // data-adult: the gate is for the grown-up entering her name, so its
      // buttons are adult-sized and exempt from the kid >=75px tap audit.
      '<div class="hl-gate__box" role="dialog" aria-modal="true" data-adult="1" aria-label="' + HL.GATE.question + '">' +
        '<p class="hl-gate__msg">' + HL.GATE.question + "</p>" +
        '<input class="hl-gate__input" type="text" inputmode="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="' + HL.GATE.placeholder + '" aria-label="' + HL.GATE.question + '" />' +
        '<p class="hl-gate__err" hidden>' + HL.GATE.wrong + "</p>" +
        '<div class="hl-gate__row">' +
          '<button class="hl-gate__cancel" type="button">' + HL.GATE.cancel + "</button>" +
          '<button class="hl-gate__ok" type="button">' + HL.GATE.ok + "</button>" +
        "</div>" +
      "</div>";
    document.body.appendChild(overlay);

    const input = overlay.querySelector(".hl-gate__input");
    const err = overlay.querySelector(".hl-gate__err");
    const box = overlay.querySelector(".hl-gate__box");

    function open() {
      overlay.hidden = false; err.hidden = true; input.value = "";
      sayZh(HL.GATE.question);
      setTimeout(() => { try { input.focus(); } catch (e) { /* ignore */ } }, 30);
    }
    function close() { overlay.hidden = true; }
    function submit() {
      // Exact name only (trimmed + NFC-normalised); EVERYTHING else is rejected.
      let v = String(input.value || "").trim();
      try { v = v.normalize("NFC"); } catch (e) { /* older engines: compare raw */ }
      if (v === HL.GATE.answer) {
        unlock();
        close();
        sayZh(HL.GREETING);
        location.hash = "#hl-home";
      } else {
        err.hidden = false;
        box.classList.remove("bump"); void box.offsetWidth; box.classList.add("bump");
        try { input.select(); } catch (e) { /* ignore */ }
      }
    }

    door.addEventListener("click", open);
    overlay.querySelector(".hl-gate__ok").addEventListener("click", submit);
    overlay.querySelector(".hl-gate__cancel").addEventListener("click", close);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  }

  // ---- Her world: home + 7 categories + the 🏮 sticker book ----------------
  function hlTile(def) {
    const tile = document.createElement("button");
    tile.className = "tile tap hl-tile";
    tile.type = "button";
    tile.dataset.go = def.id;
    tile.setAttribute("role", "listitem");
    tile.setAttribute("aria-label", def.title);
    tile.innerHTML = '<span class="tile__icon" aria-hidden="true"></span><span class="tile__label"></span>';
    tile.querySelector(".tile__icon").textContent = def.icon;
    tile.querySelector(".tile__label").textContent = def.title;
    tile.addEventListener("click", () => { location.hash = "#" + def.id; });
    if (wonAlready(def.id)) {
      const s = document.createElement("span");
      s.className = "tile__badge";
      s.setAttribute("aria-hidden", "true");
      s.textContent = "⭐";
      tile.appendChild(s);
    }
    return tile;
  }

  // Nav screens are static shells: no game to start, and showing one first
  // checks the gate flag (a deep link without the name bounces home).
  function guardScreen(s, onShow) {
    s.__start = function () {};
    s.__started = true;
    s.__onShow = function () {
      if (!unlocked()) { location.hash = ""; return; }
      if (onShow) onShow();
    };
  }

  function bar(titleText, backHash) {
    const b = document.createElement("div");
    b.className = "game__bar";
    const back = document.createElement("button");
    back.className = "btn-round game__home";
    back.type = "button";
    back.setAttribute("aria-label", HL.HOME_LABEL);
    back.textContent = "🏠";
    back.addEventListener("click", () => { location.hash = backHash; });
    const title = document.createElement("h2");
    title.className = "game__title";
    title.textContent = titleText;
    b.append(back, title, document.createElement("span"));
    return b;
  }

  function initWorld() {
    const screens = document.getElementById("screens");
    if (!screens) return;
    const games = (window.JoshGames || []).filter((g) => g.hl);
    if (!games.length) return;

    const byCat = {};
    games.forEach((def) => {
      const cat = def.hlCat || "";
      if (cat) (byCat[cat] = byCat[cat] || []).push(def);
    });

    // -- Home --
    const home = document.createElement("section");
    home.className = "screen hl-screen hl-home";
    home.id = "screen-hl-home";
    home.hidden = true;
    home.appendChild(bar(HL.TITLE, ""));
    const hello = document.createElement("p");
    hello.className = "hl-hello";
    hello.textContent = HL.GREETING;
    home.appendChild(hello);
    const grid = document.createElement("div");
    grid.className = "home-grid";
    grid.setAttribute("role", "list");
    grid.setAttribute("aria-label", HL.TITLE);
    home.appendChild(grid);

    const surprise = document.createElement("button");
    surprise.className = "tile tile--surprise tap hl-tile";
    surprise.type = "button";
    surprise.setAttribute("role", "listitem");
    surprise.setAttribute("aria-label", HL.SURPRISE_TILE);
    surprise.innerHTML = '<span class="tile__icon" aria-hidden="true">🎲</span><span class="tile__label">' + HL.SURPRISE_TILE + "</span>";
    surprise.addEventListener("click", () => {
      const g = games[Math.floor(Math.random() * games.length)];
      if (g) location.hash = "#" + g.id;
    });
    grid.appendChild(surprise);

    const stickersTile = document.createElement("button");
    stickersTile.className = "tile tile--stickers tap hl-tile";
    stickersTile.type = "button";
    stickersTile.setAttribute("role", "listitem");
    stickersTile.setAttribute("aria-label", HL.STICKERS_TITLE);
    stickersTile.innerHTML = '<span class="tile__icon" aria-hidden="true">🏮</span><span class="tile__label">' + HL.STICKERS_TILE + "</span>";
    stickersTile.addEventListener("click", () => { location.hash = "#hl-stickers"; });
    grid.appendChild(stickersTile);

    HL.CATEGORIES.forEach((cat) => {
      const list = byCat[cat.id] || [];
      if (!list.length) return;

      const tile = document.createElement("button");
      tile.className = "tile tile--cat tap hl-tile";
      tile.type = "button";
      tile.dataset.cat = cat.id;
      tile.setAttribute("role", "listitem");
      tile.setAttribute("aria-label", cat.title);
      tile.style.setProperty("--cat-color", cat.color);
      tile.innerHTML = '<span class="tile__icon" aria-hidden="true"></span><span class="tile__label"></span>';
      tile.querySelector(".tile__icon").textContent = cat.icon;
      tile.querySelector(".tile__label").textContent = cat.title;
      tile.addEventListener("click", () => { location.hash = "#hl-cat-" + cat.id; });
      grid.appendChild(tile);

      const screen = document.createElement("section");
      screen.className = "screen category hl-screen";
      screen.id = "screen-hl-cat-" + cat.id;
      screen.hidden = true;
      screen.appendChild(bar(cat.icon + " " + cat.title, "#hl-home"));
      const cgrid = document.createElement("div");
      cgrid.className = "home-grid";
      list.forEach((def) => cgrid.appendChild(hlTile(def)));
      screen.appendChild(cgrid);
      guardScreen(screen);
      screens.appendChild(screen);
    });

    guardScreen(home);
    screens.appendChild(home);

    // -- 🏮 sticker book (same slot classes as Josh's, so the shared
    //    josh-won listener plops her stickers live too) --
    const book = document.createElement("section");
    book.className = "screen stickers hl-screen";
    book.id = "screen-hl-stickers";
    book.hidden = true;
    book.appendChild(bar(HL.STICKERS_TITLE, "#hl-home"));

    const meter = document.createElement("div");
    meter.className = "sticker-meter";
    meter.setAttribute("aria-hidden", "true");
    const meterFill = document.createElement("div");
    meterFill.className = "sticker-meter__fill";
    const meterText = document.createElement("div");
    meterText.className = "sticker-meter__text";
    meter.append(meterFill, meterText);
    book.appendChild(meter);

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
      art.className = "sticker-slot__art hl-sticker";
      art.setAttribute("aria-hidden", "true");
      art.textContent = stickerFor(def.id);
      slot.append(seal, art);
      slot.addEventListener("click", () => {
        if (slot.classList.contains("is-won")) { location.hash = "#" + def.id; }
        else { sayZh("先玩这个游戏，赢了就有贴纸！"); slot.classList.remove("bump"); void slot.offsetWidth; slot.classList.add("bump"); }
      });
      sgrid.appendChild(slot);
    });
    book.appendChild(sgrid);

    refreshHlStickers = function () {
      let won = 0;
      games.forEach((def) => {
        const slot = sgrid.querySelector('.sticker-slot[data-sticker="' + def.id + '"]');
        const isWon = wonAlready(def.id);
        if (slot) slot.classList.toggle("is-won", isWon);
        if (isWon) won += 1;
      });
      meterFill.style.width = games.length ? Math.round((won / games.length) * 100) + "%" : "0%";
      meterText.textContent = "🏮 " + won + " / " + games.length;
      book.dataset.won = String(won);
    };
    guardScreen(book, refreshHlStickers);
    refreshHlStickers();
    screens.appendChild(book);
  }

  // ---- Theme: red & gold whenever the current screen belongs to her world ----
  function initThemeSync() {
    const sync = () => {
      const h = (location.hash || "").slice(1);
      // belt-and-suspenders (audit): only a REAL hl screen turns the theme on —
      // a junk #hl-* hash must never paint Josh's home red-gold.
      document.body.classList.toggle("hl-mode", h.indexOf("hl-") === 0 && !!document.getElementById("screen-" + h));
    };
    window.addEventListener("hashchange", sync);
    sync();
  }
})();
