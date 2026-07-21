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
      '<div class="td-levels" role="list"></div>' +
      '<p class="td-note">TD-1 preview: Level 1 is live. Levels 2-12, more toys and the bosses arrive in the next phases.</p>';
    screens.appendChild(home);
    home.querySelector(".td-exit").addEventListener("click", hooks.exitFort);

    // Play screen
    const play = doc.createElement("section");
    play.id = "screen-td-play";
    play.className = "screen td-screen";
    play.hidden = true;
    play.innerHTML =
      '<div class="td-bar">' +
        '<button class="btn-round td-quit" type="button" aria-label="Back to the fort">🏠</button>' +
        '<div class="td-hud">' +
          '<span class="td-hud__lives">❤ 20</span>' +
          '<span class="td-hud__gold">🪙 0</span>' +
          '<span class="td-hud__wave">wave 0/0</span>' +
        "</div>" +
        '<button class="btn-round td-pause" type="button" aria-label="Pause">⏸</button>' +
      "</div>" +
      '<div class="td-canvas-wrap"><canvas class="td-canvas" aria-label="Toybox Defense battlefield"></canvas></div>' +
      '<div class="td-controls">' +
        '<button class="td-btn td-speed" type="button" aria-label="Game speed">1×</button>' +
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

  UI.renderLevelGrid = function (save, onPick) {
    const grid = doc.querySelector("#screen-td-home .td-levels");
    if (!grid) return;
    grid.innerHTML = "";
    const LEVELS = global.TDData.LEVELS;
    const TOTAL_PLANNED = 12;
    for (let n = 1; n <= TOTAL_PLANNED; n++) {
      const def = LEVELS.find((l) => l.id === n);
      const card = doc.createElement("button");
      card.type = "button";
      card.className = "td-level" + (def ? "" : " td-level--locked");
      if (def) {
        const stars = (save.stars && save.stars[String(n)]) || 0;
        card.innerHTML =
          '<span class="td-level__n">' + n + "</span>" +
          '<span class="td-level__name">' + def.name + "</span>" +
          '<span class="td-level__stars">' + "⭐".repeat(stars) + '<span class="td-level__dim">' + "⭐".repeat(Math.max(0, 3 - stars)) + "</span></span>";
        card.addEventListener("click", () => onPick(n));
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
    if (wave) {
      const total = global.TDData.LEVELS.find((l) => l.id === state.levelId).waves.length;
      const shown = Math.min(state.phase === "build" ? state.waveIdx : state.waveIdx + (state.phase === "wave" ? 1 : 0), total);
      wave.textContent = "wave " + shown + "/" + total;
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
  };

  UI.showBubble = function (html, xPx, yPx) {
    const b = UI.bubble;
    if (!b) return;
    b.innerHTML = html;
    b.classList.remove("td-bubble--below");
    b.hidden = false;
    b.style.left = Math.round(xPx) + "px";
    b.style.top = Math.round(yPx) + "px";
    // A dialog must ALWAYS fit on screen — never half off the page. Measure the
    // rendered bubble and (a) flip below the anchor if it pokes above the
    // viewport, (b) clamp horizontally to an 8px margin.
    const fit = () => {
      const r = b.getBoundingClientRect();
      if (r.top < 8) {
        b.classList.add("td-bubble--below");
      }
      const r2 = b.getBoundingClientRect();
      const vw = doc.documentElement.clientWidth;
      let shift = 0;
      if (r2.left < 8) shift = 8 - r2.left;
      else if (r2.right > vw - 8) shift = (vw - 8) - r2.right;
      if (shift) b.style.left = Math.round(xPx + shift) + "px";
      const r3 = b.getBoundingClientRect();
      const vh = doc.documentElement.clientHeight;
      if (r3.bottom > vh - 8) b.classList.remove("td-bubble--below");
    };
    fit();
  };
  UI.hideBubble = function () { if (UI.bubble) UI.bubble.hidden = true; };

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
    const el = overlay("td-overlay--win",
      '<h3>Fort defended! 🎉</h3>' +
      '<p class="td-overlay__stars">' + "⭐".repeat(stars) + '<span class="td-level__dim">' + "⭐".repeat(3 - stars) + "</span></p>" +
      "<p>" + lives + " of 20 stickers kept safe</p>" +
      '<button class="td-btn td-btn--call" data-act="continue" type="button">Continue</button>');
    el.addEventListener("click", (ev) => {
      if (ev.target && ev.target.dataset && ev.target.dataset.act === "continue") hooks.continueOn();
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
