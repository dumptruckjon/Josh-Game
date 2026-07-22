// Fort Josh: Toybox Defense — UI shell (TD-1).
// Injects the 🏰 top-bar door, the "Jon" name gate (adult space, data-adult),
// and builds the two fort screens (#screen-td-home, #screen-td-play) into the
// page — the same dynamic-injection pattern as 华丽's world. All interaction
// wiring lives here; the loop/save/routing glue lives in td-main.js (JonTD).

(function (global) {
  const doc = global.document;
  if (!doc) return;

  const UI = {};

  // ---- The 🏰 door (top bar, beside 👵🏻 and the sound toggle) ----
  UI.injectDoor = function (onTap) {
    const bar = doc.querySelector(".topbar");
    if (!bar || doc.getElementById("td-door")) return;
    const btn = doc.createElement("button");
    btn.id = "td-door";
    btn.className = "btn-round";
    btn.type = "button";
    btn.setAttribute("aria-label", "Fort");
    btn.textContent = "🏰";
    btn.addEventListener("click", onTap);
    const sound = doc.getElementById("sound-toggle");
    bar.insertBefore(btn, sound || null);
  };

  // ---- The name gate: ONLY the exact input "Jon" (trim + NFC) unlocks ----
  UI.openGate = function (onUnlock) {
    let overlay = doc.querySelector(".td-gate");
    if (!overlay) {
      overlay = doc.createElement("div");
      overlay.className = "td-gate";
      overlay.innerHTML =
        '<div class="td-gate__box" role="dialog" aria-modal="true" data-adult="1" aria-label="Who goes there?">' +
          '<p class="td-gate__msg">Who goes there? 🏰</p>' +
          '<input class="td-gate__input" type="text" inputmode="text" autocomplete="off" ' +
            'autocapitalize="none" autocorrect="off" spellcheck="false" aria-label="Who goes there?" />' +
          '<p class="td-gate__err" hidden>The fort stays closed.</p>' +
          '<div class="td-gate__row">' +
            '<button class="td-gate__cancel" type="button">Back</button>' +
            '<button class="td-gate__ok" type="button">Knock</button>' +
          "</div>" +
        "</div>";
      doc.body.appendChild(overlay);
      const input = overlay.querySelector(".td-gate__input");
      const err = overlay.querySelector(".td-gate__err");
      const tryOpen = () => {
        const name = String(input.value || "").trim().normalize("NFC");
        if (name === "Jon") { overlay.hidden = true; err.hidden = true; input.value = ""; overlay.__unlock(); }
        else { err.hidden = false; input.select && input.select(); }
      };
      overlay.querySelector(".td-gate__ok").addEventListener("click", tryOpen);
      input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") tryOpen(); });
      overlay.querySelector(".td-gate__cancel").addEventListener("click", () => { overlay.hidden = true; });
      overlay.addEventListener("click", (ev) => { if (ev.target === overlay) overlay.hidden = true; });
    }
    overlay.__unlock = onUnlock;
    overlay.hidden = false;
    overlay.querySelector(".td-gate__err").hidden = true;
    overlay.querySelector(".td-gate__input").value = "";
    setTimeout(() => { try { overlay.querySelector(".td-gate__input").focus(); } catch (e) { /* ignore */ } }, 30);
  };

  // ---- Screens ----
  UI.buildScreens = function (hooks) {
    const screens = doc.getElementById("screens");
    if (!screens || doc.getElementById("screen-td-home")) return;

    // Fort home
    const home = doc.createElement("section");
    home.id = "screen-td-home";
    home.className = "screen td-screen";
    home.hidden = true;
    home.innerHTML =
      '<div class="td-bar">' +
        '<button class="btn-round td-exit" type="button" aria-label="Back to Josh">🏠</button>' +
        '<h2 class="td-title">🏰 Fort Josh</h2>' +
        '<span class="td-bar__pad" aria-hidden="true"></span>' +
      "</div>" +
      '<p class="td-sub">Toybox Defense</p>' +
      '<div class="td-diff" role="group" aria-label="Difficulty"></div>' +
      '<div class="td-levels" role="list"></div>' +
      '<p class="td-note">5 levels live — beat one to unlock the next. The full toybox arsenal (4 tower lines, upgrades &amp; exclusive branches) is yours. More levels, enemies &amp; bosses are on the way.</p>';
    screens.appendChild(home);
    home.querySelector(".td-exit").addEventListener("click", hooks.exitFort);

    // Play screen
    const play = doc.createElement("section");
    play.id = "screen-td-play";
    play.className = "screen td-screen";
    play.hidden = true;
    // ONE slim bar (everything in a row) + the CALL button FLOATING over the
    // field — nothing below the canvas, so portrait needs zero scrolling.
    play.innerHTML =
      '<div class="td-bar td-bar--play">' +
        '<button class="btn-round td-mini td-quit" type="button" aria-label="Back to the fort">🏠</button>' +
        '<div class="td-hud">' +
          '<span class="td-hud__lives">❤ 20</span>' +
          '<span class="td-hud__gold">🪙 0</span>' +
          '<span class="td-hud__wave">wave 0/0</span>' +
        "</div>" +
        '<button class="btn-round td-mini td-speed" type="button" aria-label="Game speed">1×</button>' +
        '<button class="btn-round td-mini td-pause" type="button" aria-label="Pause">⏸</button>' +
      "</div>" +
      '<div class="td-canvas-wrap">' +
        '<canvas class="td-canvas" aria-label="Toybox Defense battlefield"></canvas>' +
        '<div class="td-nextwave" aria-live="polite" hidden></div>' +
        '<div class="td-banner" aria-live="assertive" hidden></div>' +
        '<button class="td-btn td-btn--call td-call" type="button" aria-label="Call the next wave">▶ CALL</button>' +
      "</div>";
    screens.appendChild(play);
    play.querySelector(".td-quit").addEventListener("click", hooks.quitToFort);
    play.querySelector(".td-pause").addEventListener("click", hooks.togglePause);
    play.querySelector(".td-speed").addEventListener("click", hooks.toggleSpeed);
    play.querySelector(".td-call").addEventListener("click", hooks.callWave);

    // In-field build bubble + tower panel (positioned over the canvas)
    const wrap = play.querySelector(".td-canvas-wrap");
    const bubble = doc.createElement("div");
    bubble.className = "td-bubble";
    bubble.hidden = true;
    wrap.appendChild(bubble);
    UI.bubble = bubble;

    UI.canvas = play.querySelector(".td-canvas");
    play.querySelector(".td-canvas").addEventListener("click", (ev) => hooks.fieldTap(ev));
  };

  UI.renderLevelGrid = function (save, onPick, onSetDifficulty) {
    // Difficulty selector — the engine fully supports casual/normal/heroic; the
    // choice sticks (persisted) and applies to the next level you start.
    const diffWrap = doc.querySelector("#screen-td-home .td-diff");
    if (diffWrap) {
      const DIFFS = [["casual", "😌 Easy"], ["normal", "⚔️ Normal"], ["heroic", "💀 Hard"]];
      const cur = (save.difficulty && global.TDData.DIFFICULTIES[save.difficulty]) ? save.difficulty : "normal";
      diffWrap.innerHTML = "";
      DIFFS.forEach(function (d) {
        const b = doc.createElement("button");
        b.type = "button";
        b.className = "td-diffbtn" + (d[0] === cur ? " td-diffbtn--on" : "");
        b.dataset.diff = d[0];
        b.textContent = d[1];
        b.setAttribute("aria-pressed", d[0] === cur ? "true" : "false");
        b.addEventListener("click", function () {
          if (onSetDifficulty) onSetDifficulty(d[0]);
          UI.renderLevelGrid(save, onPick, onSetDifficulty); // re-highlight
        });
        diffWrap.appendChild(b);
      });
    }
    const grid = doc.querySelector("#screen-td-home .td-levels");
    if (!grid) return;
    grid.innerHTML = "";
    const LEVELS = global.TDData.LEVELS;
    const TOTAL_PLANNED = 12;
    const starsOf = (k) => (save.stars && save.stars[String(k)]) || 0;
    for (let n = 1; n <= TOTAL_PLANNED; n++) {
      const def = LEVELS.find((l) => l.id === n);
      // Progression: L1 is always open; every later level unlocks once the
      // PREVIOUS one is beaten (any-difficulty win = ≥1 star) — so beating L1
      // opens L2, and so on (PLAN §7 unlock rule).
      const unlocked = n === 1 || starsOf(n - 1) >= 1;
      const playable = !!def && unlocked;
      const card = doc.createElement("button");
      card.type = "button";
      card.className = "td-level" + (playable ? "" : " td-level--locked");
      if (playable) {
        const stars = starsOf(n);
        card.innerHTML =
          '<span class="td-level__n">' + n + "</span>" +
          '<span class="td-level__name">' + def.name + "</span>" +
          '<span class="td-level__stars">' + "⭐".repeat(stars) + '<span class="td-level__dim">' + "⭐".repeat(Math.max(0, 3 - stars)) + "</span></span>";
        card.addEventListener("click", () => onPick(n));
      } else if (def && !unlocked) {
        // built, but still locked behind the previous level — tell the player why
        card.disabled = true;
        card.innerHTML = '<span class="td-level__n">' + n + "</span>" +
          '<span class="td-level__name">🔒</span>' +
          '<span class="td-level__stars td-level__need">win ' + (n - 1) + " ⭐</span>";
      } else {
        card.disabled = true;
        card.innerHTML = '<span class="td-level__n">' + n + '</span><span class="td-level__name">🔒</span>';
      }
      grid.appendChild(card);
    }
  };

  // ---- HUD + bubbles ----
  UI.hud = function (state) {
    const q = (s) => doc.querySelector("#screen-td-play " + s);
    const lives = q(".td-hud__lives"), gold = q(".td-hud__gold"), wave = q(".td-hud__wave");
    if (lives) lives.textContent = "❤ " + state.lives;
    if (gold) gold.textContent = "🪙 " + state.gold;
    const level = global.TDData.LEVELS.find((l) => l.id === state.levelId);
    const total = level.waves.length;
    if (wave) {
      // The wave you're facing or about to face (1-based) — never the old "0/6".
      const n = Math.min(state.waveIdx + 1, total);
      wave.textContent = "wave " + n + "/" + total;
    }
    const call = q(".td-call");
    if (call) {
      if (state.phase === "build") {
        const secs = Math.ceil(state.countdown / global.TDData.TICK_RATE);
        const bonus = Math.ceil((state.countdown / global.TDData.TICK_RATE) * global.TDData.RULES.earlyCallRate);
        call.hidden = false;
        call.textContent = "▶ CALL +" + bonus + "🪙 (" + secs + "s)";
      } else call.hidden = true;
    }
    // Next-wave preview: during the build phase, show WHAT is coming (enemy icons
    // + counts) so the player can plan their build — a premium-TD staple.
    const nw = q(".td-nextwave");
    if (nw) {
      if (state.phase === "build" && state.waveIdx < total) {
        const groups = level.waves[state.waveIdx].groups;
        const counts = {};
        groups.forEach((g) => { counts[g.type] = (counts[g.type] || 0) + g.count; });
        const parts = Object.keys(counts).map((type) => {
          const def = global.TDData.ENEMIES[type];
          return (def && def.icon ? def.icon : "•") + counts[type];
        });
        nw.textContent = "Next: " + parts.join("  ");
        nw.hidden = false;
      } else nw.hidden = true;
    }
  };

  UI.showBubble = function (html, xPx, yPx) {
    const b = UI.bubble;
    if (!b) return;
    b.innerHTML = html;
    b.classList.remove("td-bubble--below", "td-bubble--hint");
    b.hidden = false;
    // Position + clamp ENTIRELY in the FIELD's own offset coordinates (real px
    // via clientWidth/offsetWidth), NOT the viewport. The old clamp trusted
    // documentElement.clientWidth + `vw`, which iOS Safari can report wider than
    // the visible viewport (any page overflow, the URL-bar, zoom) — so a dialog
    // that "fit" in headless Chromium still ran off the right on the real phone.
    // The field is a controlled element; clamping to it can't be fooled.
    b.style.transform = "none"; // we place by top-left, no translate to reason about
    const place = () => {
      const wrap = b.parentElement;
      const wrapW = wrap.clientWidth, wrapH = wrap.clientHeight;
      // The dialog can never be wider than the field itself.
      b.style.maxWidth = Math.max(140, wrapW - 16) + "px";
      const dw = b.offsetWidth, dh = b.offsetHeight;
      let left = xPx - dw / 2;                               // centred on the pad…
      left = Math.max(8, Math.min(left, wrapW - dw - 8));    // …then clamped inside the field
      let top = yPx - dh - 14;                               // above the pad…
      if (top < 8) top = yPx + 22;                           // …or below if it would clip the top
      top = Math.max(8, Math.min(top, wrapH - dh - 8));
      b.style.left = Math.round(left) + "px";
      b.style.top = Math.round(top) + "px";
    };
    place();
    // Re-place next frame in case emoji/layout metrics settle a tick late.
    if (global.requestAnimationFrame) global.requestAnimationFrame(() => { if (!b.hidden) place(); });
  };

  // A yes/no confirm overlay (adult space — text is fine). Pauses nothing itself;
  // the caller decides. Reused for "leave the level?" so progress is never lost
  // to an accidental tap on 🏠.
  UI.confirm = function (opts) {
    const el = overlay("td-overlay--confirm",
      "<h3>" + (opts.title || "Are you sure?") + "</h3>" +
      (opts.msg ? '<p class="td-overlay__warn">' + opts.msg + "</p>" : "") +
      '<button class="td-btn td-btn--call" data-act="no" type="button">' + (opts.no || "↩ Keep playing") + "</button>" +
      '<button class="td-btn td-btn--danger" data-act="yes" type="button">' + (opts.yes || "Leave") + "</button>");
    el.addEventListener("click", (ev) => {
      const act = ev.target && ev.target.dataset && ev.target.dataset.act;
      if (act === "yes") { if (opts.onYes) opts.onYes(); }
      else if (act === "no") { if (opts.onNo) opts.onNo(); }
    });
    return el;
  };
  UI.hideBubble = function () { if (UI.bubble) UI.bubble.hidden = true; };

  // A big transient banner over the field — the boss klaxon/name reveal.
  UI.showBanner = function (text) {
    const el = doc.querySelector("#screen-td-play .td-banner");
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    el.classList.remove("td-banner--in"); void el.offsetWidth; el.classList.add("td-banner--in");
    if (UI._bannerT) clearTimeout(UI._bannerT);
    UI._bannerT = setTimeout(() => { el.hidden = true; }, 2600);
  };

  // ---- Overlays (pause / victory / defeat) ----
  function overlay(cls, html) {
    let el = doc.querySelector(".td-overlay");
    if (el) el.remove();
    el = doc.createElement("div");
    el.className = "td-overlay " + cls;
    el.innerHTML = '<div class="td-overlay__box">' + html + "</div>";
    doc.getElementById("screen-td-play").appendChild(el);
    return el;
  }
  UI.closeOverlay = function () { const el = doc.querySelector(".td-overlay"); if (el) el.remove(); };

  UI.showPause = function (hooks, settings) {
    const el = overlay("td-overlay--pause",
      '<h3>Paused</h3>' +
      '<button class="td-btn" data-act="resume" type="button">▶ Resume</button>' +
      '<button class="td-btn" data-act="restart" type="button">🔁 Restart level</button>' +
      '<button class="td-btn" data-act="sfx" type="button">' + (settings.sfx ? "🔔 Sounds on" : "🔕 Sounds off") + "</button>" +
      '<button class="td-btn" data-act="quit" type="button">🏰 Back to the fort</button>');
    el.addEventListener("click", (ev) => {
      const act = ev.target && ev.target.dataset && ev.target.dataset.act;
      if (act) hooks[act]();
    });
  };

  UI.showVictory = function (stars, lives, hooks) {
    const hasNext = !!hooks.nextLevel;
    const el = overlay("td-overlay--win",
      '<h3>Fort defended! 🎉</h3>' +
      '<p class="td-overlay__stars">' + "⭐".repeat(stars) + '<span class="td-level__dim">' + "⭐".repeat(3 - stars) + "</span></p>" +
      "<p>" + lives + " of 20 stickers kept safe</p>" +
      (hasNext ? '<p class="td-overlay__warn">🔓 Level ' + hooks.nextLevel + ' unlocked!</p>' : "") +
      (hasNext ? '<button class="td-btn td-btn--call" data-act="next" type="button">▶ Next level</button>' : "") +
      '<button class="td-btn" data-act="continue" type="button">' + (hasNext ? "🏰 Back to the fort" : "Continue") + "</button>");
    el.addEventListener("click", (ev) => {
      const act = ev.target && ev.target.dataset && ev.target.dataset.act;
      if (act === "continue") hooks.continueOn();
      else if (act === "next" && hooks.onNext) hooks.onNext();
    });
  };

  UI.showDefeat = function (hooks) {
    const el = overlay("td-overlay--lose",
      '<h3>The toys got sleepy… 😴</h3>' +
      "<p>The fort door ran out of stickers this time.</p>" +
      '<button class="td-btn" data-act="retry" type="button">🔁 Try again</button>' +
      '<button class="td-btn" data-act="retrynew" type="button">🎲 New shuffle</button>' +
      '<button class="td-btn" data-act="quit" type="button">🏰 Back to the fort</button>');
    el.addEventListener("click", (ev) => {
      const act = ev.target && ev.target.dataset && ev.target.dataset.act;
      if (act) hooks[act]();
    });
  };

  if (typeof module !== "undefined" && module.exports) module.exports = UI;
  global.TDUI = UI;
})(typeof window !== "undefined" ? window : globalThis);
