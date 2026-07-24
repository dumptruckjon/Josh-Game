// Fort Josh: Toybox Defense — UI shell (TD-1).
// Builds the two fort screens (#screen-td-home, #screen-td-play) into the
// page — the same dynamic-injection pattern as 华丽's world. The fort opens
// from the front door's 🏰 tile (the old "Jon" name gate was removed by
// request 2026-07); it remains an ADULT-designed space (data-adult controls,
// real difficulty). All interaction wiring lives here; the loop/save/routing
// glue lives in td-main.js (JonTD).

(function (global) {
  const doc = global.document;
  if (!doc) return;

  const UI = {};

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
        '<button class="btn-round td-exit" type="button" aria-label="Back to the front door">🏠</button>' +
        '<h2 class="td-title">🏰 Fort Josh</h2>' +
        '<span class="td-bar__pad" aria-hidden="true"></span>' +
      "</div>" +
      '<p class="td-sub">Toybox Defense</p>' +
      '<div class="td-resume" hidden></div>' +
      '<div class="td-diff" role="group" aria-label="Difficulty"></div>' +
      '<div class="td-meta" role="group" aria-label="Meta">' +
        '<button class="td-metabtn td-tree-open" type="button">⭐ Star Tree</button>' +
        '<button class="td-metabtn td-ach-open" type="button">🏅 Badges</button>' +
        '<button class="td-metabtn td-endless-open" type="button">♾️ Endless</button>' +
      "</div>" +
      '<div class="td-levels" role="list"></div>' +
      '<p class="td-note">12 levels across 3 worlds — beat one to unlock the next. Face the whole toybox roster (splitters, armor, chargers, ghosts, moles, shielded bots, fliers) and three bosses, with the full arsenal: 4 tower lines, upgrades &amp; exclusive tier-4 branches. 👑 marks a boss finale.</p>';
    screens.appendChild(home);
    home.querySelector(".td-exit").addEventListener("click", hooks.exitFort);
    home.querySelector(".td-tree-open").addEventListener("click", hooks.openTree);
    home.querySelector(".td-ach-open").addEventListener("click", hooks.openAchievements);
    home.querySelector(".td-endless-open").addEventListener("click", hooks.openEndless);

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
      if (def && def.world) card.dataset.world = def.world; // wood / grass / neon tint
      if (playable) {
        const stars = starsOf(n);
        const badge = Math.max(1, Math.min(3, def.badge || 1)); // difficulty 1-3
        const isBoss = def.waves.some((w) => w.boss);
        const pips = '<span class="td-level__badge td-badge--' + badge + '">' +
          "●".repeat(badge) + '<span class="td-level__dim">' + "●".repeat(3 - badge) + "</span></span>";
        card.innerHTML =
          '<span class="td-level__n">' + n + (isBoss ? " 👑" : "") + "</span>" +
          '<span class="td-level__name">' + def.name + "</span>" +
          pips +
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

  // ---- TD-5 META: star accounting, resume banner, star tree, badges, endless ----
  const NODES = () => global.TDData.META_NODES;
  const ACHS = () => global.TDData.ACHIEVEMENTS;
  function starTotals(save) {
    let earned = 0; for (const k in (save.stars || {})) earned += save.stars[k];
    let spent = 0; const owned = new Set(save.meta || []);
    for (const n of NODES()) if (owned.has(n.id)) spent += n.cost;
    return { earned, spent, avail: earned - spent };
  }
  const worldLevels = (world) => global.TDData.LEVELS.filter((l) => l.world === world).map((l) => l.id);
  UI.endlessUnlocked = function (save, world) { return worldLevels(world).every((id) => ((save.stars || {})[id] || 0) >= 3); };

  // Resume banner on the fort home (present only when a mid-run checkpoint exists).
  UI.renderResume = function (save, onResume, onDiscard) {
    const el = doc.querySelector("#screen-td-home .td-resume");
    if (!el) return;
    const mr = save.midRun;
    if (!mr) { el.hidden = true; el.innerHTML = ""; return; }
    const lvl = global.TDData.LEVELS.find((l) => l.id === mr.levelId);
    const label = mr.endless ? ("Endless · wave " + (mr.waveIdx + 1)) : ((lvl ? lvl.name : "Level " + mr.levelId) + " · wave " + (mr.waveIdx + 1));
    el.hidden = false;
    el.innerHTML = '<span class="td-resume__txt">▶ Resume: ' + label + "</span>" +
      '<button class="td-resume__go" type="button">Resume</button>' +
      '<button class="td-resume__x" type="button" aria-label="Discard">✕</button>';
    el.querySelector(".td-resume__go").addEventListener("click", onResume);
    el.querySelector(".td-resume__x").addEventListener("click", onDiscard);
  };

  function metaOverlay(cls, html) {
    let el = doc.querySelector(".td-overlay");
    if (el) el.remove();
    el = doc.createElement("div");
    el.className = "td-overlay " + cls;
    el.innerHTML = '<div class="td-overlay__box td-overlay__box--wide">' + html + "</div>";
    doc.getElementById("screen-td-home").appendChild(el);
    return el;
  }

  // Star tree: spend earned ⭐ on permanent buffs; tap an owned node to refund it
  // (free respec). onChange(newMeta) persists + is followed by a re-render.
  UI.showStarTree = function (save, onChange) {
    const t = starTotals(save);
    const owned = new Set(save.meta || []);
    const rows = NODES().map((n) => {
      const has = owned.has(n.id);
      const affordable = has || t.avail >= n.cost;
      return '<button class="td-node' + (has ? " td-node--on" : "") + '"' + (affordable ? "" : " disabled") +
        ' data-node="' + n.id + '">' +
        '<span class="td-node__icon">' + n.icon + "</span>" +
        '<span class="td-node__body"><span class="td-node__name">' + n.name + "</span>" +
        '<span class="td-node__desc">' + n.desc + "</span></span>" +
        '<span class="td-node__cost">' + (has ? "✓" : "⭐" + n.cost) + "</span></button>";
    }).join("");
    const el = metaOverlay("td-tree", '<h3>⭐ Star Tree</h3>' +
      '<p class="td-overlay__stars td-tree__avail">⭐ ' + t.avail + " to spend · " + t.spent + " used</p>" +
      '<div class="td-nodes">' + rows + "</div>" +
      '<div class="td-overlay__row"><button class="td-btn td-tree-respec" type="button">↺ Refund all</button>' +
      '<button class="td-btn td-btn--call td-tree-done" type="button">Done</button></div>');
    el.querySelectorAll(".td-node").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.node; const set = new Set(save.meta || []);
      if (set.has(id)) set.delete(id);
      else { const node = NODES().find((n) => n.id === id); if (starTotals(save).avail >= node.cost) set.add(id); else return; }
      onChange([...set]); UI.showStarTree(save, onChange); // re-render with new state
    }));
    el.querySelector(".td-tree-respec").addEventListener("click", () => { onChange([]); UI.showStarTree(save, onChange); });
    el.querySelector(".td-tree-done").addEventListener("click", UI.closeOverlay);
  };

  // Badges: the 12-achievement grid, earned lit + named, locked dimmed.
  UI.showAchievements = function (save) {
    const got = new Set(save.ach || []);
    const cells = ACHS().map((a) => {
      const has = got.has(a.id);
      return '<div class="td-ach' + (has ? " td-ach--on" : "") + '">' +
        '<span class="td-ach__icon">' + (has ? a.icon : "🔒") + "</span>" +
        '<span class="td-ach__name">' + a.name + "</span>" +
        '<span class="td-ach__desc">' + a.desc + "</span></div>";
    }).join("");
    const el = metaOverlay("td-achgrid", '<h3>🏅 Badges</h3>' +
      '<p class="td-overlay__stars">' + got.size + " / " + ACHS().length + "</p>" +
      '<div class="td-achs">' + cells + "</div>" +
      '<button class="td-btn td-btn--call td-ach-done" type="button">Done</button>');
    el.querySelector(".td-ach-done").addEventListener("click", UI.closeOverlay);
  };

  // Endless picker: one button per world, unlocked once its 4 levels are 3⭐.
  UI.showEndless = function (save, onPick) {
    const worlds = [["bedroom", "🛏 Bedroom"], ["backyard", "🌳 Backyard"], ["toystore", "🧸 Toy Store"]];
    const best = save.endlessBest || {};
    const rows = worlds.map(([w, label]) => {
      const open = UI.endlessUnlocked(save, w);
      const b = best[w] ? (" · best wave " + best[w]) : "";
      return '<button class="td-endless' + (open ? "" : " td-endless--locked") + '"' + (open ? "" : " disabled") +
        ' data-world="' + w + '">' + label + (open ? '<span class="td-endless__best">' + (best[w] ? "🏆 " + best[w] : "new!") + "</span>" : '<span class="td-endless__best">🔒 3⭐ the 4 levels</span>') + "</button>";
    }).join("");
    const el = metaOverlay("td-endlesspick", '<h3>♾️ Endless</h3>' +
      '<p class="td-overlay__sub">Survive as long as you can — the toys never stop coming.</p>' +
      '<div class="td-endlessrows">' + rows + "</div>" +
      '<button class="td-btn td-endless-done" type="button">Close</button>');
    el.querySelectorAll(".td-endless").forEach((b) => b.addEventListener("click", () => { if (b.dataset.world) { UI.closeOverlay(); onPick(b.dataset.world); } }));
    el.querySelector(".td-endless-done").addEventListener("click", UI.closeOverlay);
  };

  // Achievement toast — a brief celebratory slide-in (auto-dismiss).
  UI.toast = function (icon, name) {
    let host = doc.querySelector("#screen-td-play") || doc.getElementById("screen-td-home");
    if (!host) return;
    // A single win can earn several badges at once — cascade them up the screen
    // and give EACH its own removal timer, so an earlier toast is never orphaned
    // (a shared timer would only ever remove the newest, leaking the rest).
    const stackIdx = host.querySelectorAll(".td-toast").length;
    const el = doc.createElement("div");
    el.className = "td-toast";
    if (stackIdx) el.style.bottom = "calc(24px + env(safe-area-inset-bottom) + " + (stackIdx * 64) + "px)";
    el.innerHTML = '<span class="td-toast__icon">' + icon + '</span><span class="td-toast__txt"><b>Badge earned!</b><br>' + name + "</span>";
    host.appendChild(el);
    setTimeout(() => { el.remove(); }, 2800);
  };

  // ---- HUD + bubbles ----
  UI.hud = function (state) {
    const q = (s) => doc.querySelector("#screen-td-play " + s);
    const lives = q(".td-hud__lives"), gold = q(".td-hud__gold"), wave = q(".td-hud__wave");
    if (lives) lives.textContent = "❤ " + state.lives;
    if (gold) gold.textContent = "🪙 " + state.gold;
    const level = global.TDData.LEVELS.find((l) => l.id === state.levelId);
    const endless = state.endless || !level; // endless runs aren't in DATA.LEVELS
    const total = level ? level.waves.length : 0;
    if (wave) {
      // The wave you're facing or about to face (1-based) — never the old "0/6".
      if (endless) wave.textContent = "wave " + (state.waveIdx + 1) + " ♾️";
      else wave.textContent = "wave " + Math.min(state.waveIdx + 1, total) + "/" + total;
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
      if (!endless && state.phase === "build" && state.waveIdx < total) {
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
  // Clear any lingering banner (e.g. a boss klaxon) so a fresh level never
  // inherits the PREVIOUS level's banner text.
  UI.hideBanner = function () {
    if (UI._bannerT) { clearTimeout(UI._bannerT); UI._bannerT = null; }
    const el = doc.querySelector("#screen-td-play .td-banner");
    if (el) { el.hidden = true; el.classList.remove("td-banner--in"); }
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
      '<button class="td-btn" data-act="music" type="button">' + (settings.music ? "🎵 Music on" : "🎵 Music off") + "</button>" +
      '<button class="td-btn" data-act="dmg" type="button">' + (settings.dmgNumbers ? "🔢 Damage numbers on" : "🔢 Damage numbers off") + "</button>" +
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

  UI.showDefeat = function (hooks, endless) {
    // endless: { score, best } — an endless run ends only in defeat, so its
    // "score" (waves survived) is the headline, not a failure.
    const head = endless ? '<h3>♾️ Run over!</h3>' +
        '<p class="td-overlay__stars">🏁 wave ' + endless.score + "</p>" +
        "<p>" + (endless.score >= endless.best ? "🏆 New best!" : "Best: wave " + endless.best) + "</p>"
      : '<h3>The toys got sleepy… 😴</h3><p>The fort door ran out of stickers this time.</p>';
    const el = overlay("td-overlay--lose",
      head +
      '<button class="td-btn" data-act="retry" type="button">🔁 ' + (endless ? "Again" : "Try again") + "</button>" +
      (endless ? "" : '<button class="td-btn" data-act="retrynew" type="button">🎲 New shuffle</button>') +
      '<button class="td-btn" data-act="quit" type="button">🏰 Back to the fort</button>');
    el.addEventListener("click", (ev) => {
      const act = ev.target && ev.target.dataset && ev.target.dataset.act;
      if (act) hooks[act]();
    });
  };

  if (typeof module !== "undefined" && module.exports) module.exports = UI;
  global.TDUI = UI;
})(typeof window !== "undefined" ? window : globalThis);
