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
        '<button class="td-metabtn td-powers-open" type="button">🎒 Powers</button>' +
        '<button class="td-metabtn td-ach-open" type="button">🏅 Badges</button>' +
        '<button class="td-metabtn td-endless-open" type="button">♾️ Endless</button>' +
        '<button class="td-metabtn td-guide-open" type="button">📖 Guide</button>' +
      "</div>" +
      '<div class="td-levels" role="list"></div>' +
      // COUNTS ARE DERIVED. "16 levels across 4 worlds" was a literal, and its
      // sibling (`TOTAL_PLANNED = 12`) is why the whole attic shipped with no
      // card on the grid — the levels existed and no one could reach them.
      '<p class="td-note">' + global.TDData.LEVELS.length + ' levels across ' +
        new Set(global.TDData.LEVELS.map(function (l) { return l.world; })).size +
        ' worlds — beat one to unlock the next. Face the whole toybox roster (splitters, armor, chargers, ghosts, moles, shielded bots, fliers, soakers, jammers, greased runners, spawners, padding, blaring stereos) and ' +
        global.TDData.LEVELS.filter(function (l) { return l.waves.some(function (w) { return w.boss; }); }).length +
        ' bosses, with the full arsenal: 4 tower lines, upgrades &amp; exclusive tier-4 branches. 👑 marks a boss finale.</p>' +
      // Start-over control. Deliberately small and quiet (data-adult exempts it
      // from the kid ≥75px audit) and behind a type-the-word gate, exactly like
      // Josh's ⚙️ Grown-ups star reset — Josh reaches the fort from the front
      // door, so an accidental wipe has to be impossible for little hands.
      '<div class="td-adminrow">' +
        '<button class="td-backup-open" type="button" data-adult="1" aria-label="Back up or restore fort progress">💾 Backup</button>' +
        '<button class="td-reset-open" type="button" data-adult="1" aria-label="Reset all fort progress">⚙️ Reset fort</button>' +
      "</div>";
    screens.appendChild(home);
    home.querySelector(".td-exit").addEventListener("click", hooks.exitFort);
    home.querySelector(".td-tree-open").addEventListener("click", hooks.openTree);
    home.querySelector(".td-powers-open").addEventListener("click", hooks.openPowers);
    home.querySelector(".td-ach-open").addEventListener("click", hooks.openAchievements);
    home.querySelector(".td-endless-open").addEventListener("click", hooks.openEndless);
    home.querySelector(".td-guide-open").addEventListener("click", () => UI.showGuide());
    home.querySelector(".td-reset-open").addEventListener("click", () => UI.showResetGate(hooks.resetFort));
    home.querySelector(".td-backup-open").addEventListener("click", () => UI.showBackup(hooks.exportSave, hooks.importSave));

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
          '<span class="td-hud__lives" title="Stickers left — lose them all and the run ends">❤️ 20</span>' +
          '<span class="td-hud__gold" title="Gold — spend it on towers and upgrades">🪙 0</span>' +
          // ⚙️ shipped as a BARE NUMERAL that nothing in the app ever named — the
          // owner's first question on seeing it was "what does the gear mean?",
          // which is the same defect TD-12 fixed for the abilities (whose names
          // lived only in an aria-label). Now it says so on hover, to a screen
          // reader, and in the guide's Powers section.
          // The ⚙️ readout is also THE EXCHANGE: tap it mid-wave to trade gold
          // for one more energy. It lives here rather than in the ability strip
          // because that strip is a hard 4-column grid — a shipped guardrail
          // proves a 5th tile physically overlaps at 320px — so a new control
          // has to cost no layout.
          // The STATIC title names the resource from the first paint, before any
          // HUD tick has run; UI.hud() then refines it with the live price and
          // the reason it is refused. Both matter — a control that names itself
          // only after a frame has passed is nameless exactly when it is new.
          '<button type="button" class="td-hud__charge" data-adult="1" data-buycharge="1"' +
          ' title="Toy Energy — every power costs some. You get more each wave, and can buy one more during a wave.">⚙️ 0</button>' +
          '<span class="td-hud__wave">wave 0/0</span>' +
        "</div>" +
        '<button class="btn-round td-mini td-speed" type="button" aria-label="Game speed">1×</button>' +
        '<button class="btn-round td-mini td-pause" type="button" aria-label="Pause">⏸</button>' +
      "</div>" +
      '<div class="td-canvas-wrap">' +
        '<canvas class="td-canvas" aria-label="Toybox Defense battlefield"></canvas>' +
        '<div class="td-nextwave" aria-live="polite" hidden></div>' +
        '<div class="td-banner" aria-live="assertive" hidden></div>' +
      "</div>" +
      // ALL controls live OUTSIDE the canvas wrap — a real layout block under
      // the field in portrait (where there is dead space, because portrait is
      // width-limited) and a column in a RESERVED side gutter in landscape. A
      // control that floats over the battlefield eats field taps (pads, the
      // lever) and hides the exit corridor where leaks happen. CALL floated
      // until now and looked safe, because the audit only measured 390×844 and
      // 844×390 — the two sizes where it happens to miss everything. On every
      // other phone it buried pads DURING BUILD, which makes them permanently
      // unbuildable: 3 at 375×667, 12 at 320×568, 36 (and a LEVER) at 320×480.
      '<div class="td-controls">' +
        '<button class="td-call" type="button" aria-label="Call the next wave">' +
          '<span class="td-call__label">▶ CALL</span>' +
          '<span class="td-call__meta"></span>' +
        "</button>" +
        '<div class="td-abils" role="group" aria-label="Abilities"></div>' +
      "</div>";
    screens.appendChild(play);
    play.querySelector(".td-quit").addEventListener("click", hooks.quitToFort);
    play.querySelector(".td-pause").addEventListener("click", hooks.togglePause);
    play.querySelector(".td-speed").addEventListener("click", hooks.toggleSpeed);
    play.querySelector(".td-call").addEventListener("click", hooks.callWave);
    play.querySelector(".td-hud__charge").addEventListener("click", hooks.buyCharge);

    // TD-9 ability bar: one button per EQUIPPED ability. A "point"/"tower"
    // ability ARMS (the next field tap resolves it); an "instant" one fires now.
    //
    // P6: it used to be built ONCE from the whole of `TDData.ABILITIES`, which
    // was fine only while the pool was exactly the strip's width. It is rebuilt
    // per run from the run's own list now, so the strip is always exactly
    // `RULES.abilitySlots` tiles no matter how large the pool grows — the CSS
    // (a hard `repeat(4, minmax(0,1fr))`) never has to change.
    const abilWrap = play.querySelector(".td-abils");
    UI.abilityStrip = function (ids) {
      const pool = global.TDData.ABILITIES || [];
      const list = (Array.isArray(ids) && ids.length ? ids : pool.map((a) => a.id))
        .map((id) => pool.find((a) => a.id === id)).filter(Boolean)
        .slice(0, global.TDData.RULES.abilitySlots);
      abilWrap.innerHTML = "";
      for (const a of list) {
        const b = doc.createElement("button");
        b.className = "td-abil";
        b.type = "button";
        b.dataset.abil = a.id;
        b.dataset.adult = "1"; // the fort is Jon's space — adult-sized, not kid-sized
        // The ⚙️ badge is aria-hidden (it is a glyph, not a sentence), so the
        // label has to NAME the second currency — the "ship the name with the
        // number" rule that ⚙️ Toy Energy already cost us once.
        b.setAttribute("aria-label", a.name + " — " + a.role + ", costs " + a.gold + " gold and " +
          (a.charges === undefined ? 1 : a.charges) + " toy energy");
        // The NAME is on the button, not just in the aria-label — a sighted player
        // was shown "🧨 130" and nothing else, so no power explained itself.
        // The two costs are SEPARATE elements, not one string. As a single
        // "130🪙 ·1⚙️" it could not fit a 56px content box, so it wrapped
        // mid-string and spilled past the rounded border — and iOS renders emoji
        // WIDER than headless Chromium, so it measured fine here and looked
        // broken on the phone (the tower panel and the next-wave line have both
        // been bitten by exactly that). Gold stays on the cost line; the ⚙️
        // energy charge moves to a corner badge, which halves the line's width
        // and gives each cost its own place instead of a run-on.
        const charges = a.charges === undefined ? 1 : a.charges;
        b.innerHTML = '<span class="td-abil__icon">' + a.icon + "</span>" +
          '<span class="td-abil__name">' + (a.short || a.name) + "</span>" +
          '<span class="td-abil__cost">' + a.gold + "🪙</span>" +
          '<span class="td-abil__gear" aria-hidden="true">' + charges + "⚙️</span>" +
          '<span class="td-abil__cd" hidden></span>';
        b.addEventListener("click", (ev) => { ev.stopPropagation(); hooks.useAbility(a.id); });
        abilWrap.appendChild(b);
      }
    };
    UI.abilityStrip(null);

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
    // The selected difficulty is the LADDER the grid shows (each difficulty is
    // an independent progression — user request 2026-07).
    const selDiff = (save.difficulty && global.TDData.DIFFICULTIES[save.difficulty]) ? save.difficulty : "normal";
    // Difficulty selector — the engine fully supports casual/normal/heroic; the
    // choice sticks (persisted), applies to the next level you start, and picks
    // which ladder's stars/locks the grid below displays.
    const diffWrap = doc.querySelector("#screen-td-home .td-diff");
    if (diffWrap) {
      const DIFFS = [["casual", "😌 Easy"], ["normal", "⚔️ Normal"], ["heroic", "💀 Hard"]];
      diffWrap.innerHTML = "";
      DIFFS.forEach(function (d) {
        const b = doc.createElement("button");
        b.type = "button";
        b.className = "td-diffbtn" + (d[0] === selDiff ? " td-diffbtn--on" : "");
        b.dataset.diff = d[0];
        b.textContent = d[1];
        b.setAttribute("aria-pressed", d[0] === selDiff ? "true" : "false");
        b.addEventListener("click", function () {
          if (onSetDifficulty) onSetDifficulty(d[0]);
          UI.renderLevelGrid(save, onPick, onSetDifficulty); // re-highlight + re-ladder the grid
        });
        diffWrap.appendChild(b);
      });
    }
    const grid = doc.querySelector("#screen-td-home .td-levels");
    if (!grid) return;
    grid.innerHTML = "";
    const LEVELS = global.TDData.LEVELS;
    // DERIVED from the shipped data, never a literal. This was hard-coded to 12
    // from when World 4 was still a plan, so when the attic actually SHIPPED its
    // four levels (and the Tickmaster) had no slot on the grid and were
    // unreachable — the mirror image of the documented "a level-select that shows
    // locked slots must actually HAVE levels behind them". Same law as the star
    // ceiling: count what exists.
    const TOTAL_PLANNED = LEVELS.length;
    // Stars + locks are PER-DIFFICULTY: the grid shows the SELECTED ladder's
    // stars, and level N+1 unlocks by beating level N on THAT difficulty.
    const dstars = (save.stars && save.stars[selDiff]) || {};
    const starsOf = (k) => dstars[String(k)] | 0;
    for (let n = 1; n <= TOTAL_PLANNED; n++) {
      const def = LEVELS.find((l) => l.id === n);
      // Progression: L1 is always open; every later level unlocks once the
      // PREVIOUS one is beaten ON THIS DIFFICULTY (≥1 star on this ladder) —
      // so beating L1 opens L2, and so on, per ladder (PLAN §7 unlock rule).
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
  // Best stars per level across the three difficulty ladders — the star-tree /
  // endless economy is deliberately difficulty-AGNOSTIC (ceiling stays 36), so
  // the per-difficulty ladder split inflates nothing and loses nothing.
  function bestStarsOf(save, k) {
    let m = 0;
    for (const d of ["casual", "normal", "heroic"]) { const o = save.stars && save.stars[d]; if (o && (o[k] | 0) > m) m = o[k] | 0; }
    return m;
  }
  function starTotals(save) {
    let earned = 0; for (const l of global.TDData.LEVELS) earned += bestStarsOf(save, String(l.id));
    let spent = 0; const owned = new Set(save.meta || []);
    for (const n of NODES()) if (owned.has(n.id)) spent += n.cost;
    return { earned, spent, avail: earned - spent };
  }
  const worldLevels = (world) => global.TDData.LEVELS.filter((l) => l.world === world).map((l) => l.id);
  UI.endlessUnlocked = function (save, world) { return worldLevels(world).every((id) => bestStarsOf(save, String(id)) >= 3); };

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

  // ---- TD-14 Backup: fort progress survives a cleared browser ----
  // localStorage is the ONLY store, and a browser wipe / private-mode session
  // takes it with no warning. This hands you the save as text to keep, and takes
  // it back. Import validates before replacing anything — a bad paste must never
  // destroy a good save.
  UI.showBackup = function (onExport, onImport) {
    const el = metaOverlay("td-overlay--backup",
      "<h3>💾 Fort backup</h3>" +
      '<p class="td-overlay__sub">Copy this text somewhere safe. Paste it back here to restore your fort on any device.</p>' +
      '<textarea class="td-backup__box" rows="4" spellcheck="false" aria-label="Fort save data"></textarea>' +
      '<p class="td-backup__msg" hidden></p>' +
      '<div class="td-overlay__row">' +
        '<button class="td-btn td-backup-load" type="button">📥 Restore</button>' +
        '<button class="td-btn td-backup-done" type="button">Done</button>' +
      "</div>");
    const box = el.querySelector(".td-backup__box");
    const msg = el.querySelector(".td-backup__msg");
    box.value = onExport ? onExport() : "";
    box.addEventListener("focus", () => { try { box.select(); } catch (e) { /* ignore */ } });
    el.querySelector(".td-backup-load").addEventListener("click", () => {
      const r = onImport ? onImport(box.value) : { ok: false, reason: "unavailable" };
      msg.hidden = false;
      msg.textContent = r.ok ? "✅ Restored — your fort is back." : "⚠️ That doesn't look like a fort save. Nothing was changed.";
      msg.className = "td-backup__msg " + (r.ok ? "td-backup__msg--ok" : "td-backup__msg--bad");
    });
    el.querySelector(".td-backup-done").addEventListener("click", UI.closeOverlay);
    el.addEventListener("click", (ev) => { if (ev.target === el) UI.closeOverlay(); });
    return el;
  };

  // ---- Grown-ups: wipe the fort (a type-the-word gate, like Josh's ⭐ reset) ----
  // Nothing but the exact word "reset" clears anything. onConfirm() is the ONE
  // owner in td-main (resetProgress) — this dialog never touches storage itself.
  UI.showResetGate = function (onConfirm) {
    const el = metaOverlay("td-overlay--reset",
      "<h3>⚙️ Start the fort over?</h3>" +
      '<p class="td-overlay__sub">Clears <b>all</b> fort progress: level stars on every difficulty, the star tree, badges, endless bests and any saved run. Your sound &amp; graphics settings stay.</p>' +
      '<p class="td-overlay__warn">Type <b>reset</b> to confirm.</p>' +
      '<input class="td-reset__input" type="text" inputmode="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" aria-label="Type the word reset" />' +
      '<p class="td-reset__err" hidden>That’s not the word. Type <b>reset</b>.</p>' +
      '<div class="td-overlay__row">' +
        '<button class="td-btn td-reset-cancel" type="button">↩ Cancel</button>' +
        '<button class="td-btn td-btn--danger td-reset-ok" type="button">Reset</button>' +
      "</div>");
    const input = el.querySelector(".td-reset__input");
    const err = el.querySelector(".td-reset__err");
    const box = el.querySelector(".td-overlay__box");
    setTimeout(() => { try { input.focus(); } catch (e) { /* ignore */ } }, 30);
    function submit() {
      if (input.value.trim().toLowerCase() === "reset") {
        UI.closeOverlay();
        if (onConfirm) onConfirm();
      } else {
        err.hidden = false;
        box.classList.remove("td-bump"); void box.offsetWidth; box.classList.add("td-bump");
        try { input.select(); } catch (e) { /* ignore */ }
      }
    }
    el.querySelector(".td-reset-ok").addEventListener("click", submit);
    el.querySelector(".td-reset-cancel").addEventListener("click", UI.closeOverlay);
    input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); submit(); } });
    el.addEventListener("click", (ev) => { if (ev.target === el) UI.closeOverlay(); }); // tap the dim area to cancel
    return el;
  };

  // ---- TD-12 Toybox Guide: the counter matrix, finally visible ----
  // Every enemy card is BUILT from TDLogic.enemyTraits/reachedBy, which read the
  // enemy's own data fields — so a new enemy or a new trait explains itself and
  // the guide can never drift from the engine.
  UI.showGuide = function (focusType) {
    const L = global.TDLogic, E = global.TDData.ENEMIES, T = global.TDData.TOWERS;
    const LINE = { dart: "🎯", mortar: "💥", fan: "❄️", camp: "🪖" };
    const order = Object.keys(E);
    const card = (type) => {
      const d = E[type];
      if (!d) return "";
      const reach = L.reachedBy(d).map((k) => LINE[k] || k).join(" ");
      const traits = L.enemyTraits(d).map((t) => '<li><span class="td-guide__tico">' + t.icon + "</span>" + t.text + "</li>").join("");
      return '<div class="td-guide__card' + (focusType === type ? " td-guide__card--focus" : "") + '" data-enemy="' + type + '">' +
        '<div class="td-guide__head"><span class="td-guide__icon">' + d.icon + "</span>" +
          '<span class="td-guide__name">' + d.name + "</span></div>" +
        '<p class="td-guide__stats">❤️ ' + d.hp + " · 🏃 " + d.speed + (d.armor ? " · 🛡️ " + Math.round(d.armor * 100) + "%" : "") + (d.shield ? " · 🔋 " + d.shield : "") + " · 🪙 " + d.bounty + "</p>" +
        '<p class="td-guide__reach">Can be hit by: ' + reach + "</p>" +
        "<ul class=\"td-guide__traits\">" + traits + "</ul></div>";
    };
    const towerRow = Object.keys(T).map((k) =>
      '<li><span class="td-guide__tico">' + (LINE[k] || "•") + "</span><b>" + T[k].name + "</b> — " + (T[k].role || "") +
      (k === "mortar" || k === "camp" ? " <i>(cannot hit fliers)</i>" : "") + "</li>").join("");
    // Abilities were explained NOWHERE — the button showed only an icon and a
    // price. They belong in the guide beside the towers.
    // Which powers are PACKED — read through the one owner in td-main (the same
    // list the engine is handed), so the guide can never disagree with the strip.
    const packed = new Set(UI._packedPowers ? UI._packedPowers() : (global.TDData.ABILITIES || []).map((a) => a.id));
    const abilRow = (global.TDData.ABILITIES || []).map((a) =>
      '<li><span class="td-guide__tico">' + a.icon + "</span><b>" + a.name + "</b> — " + a.role +
      ' <i>(' + a.gold + "🪙 · " + (a.charges === undefined ? 1 : a.charges) + "⚙️ · " + a.cooldown + "s · " +
      (a.kind === "tower" ? "tap a tower" : a.kind === "point" ? "tap the field" : "instant") +
      ")</i>" + (packed.has(a.id) ? " 🎒" : "") + "</li>").join("");
    // TD-16 shipped five level gimmicks and documented NONE of them — nothing
    // anywhere said night cuts your reach, or that a brown patch slows while a
    // chevron strip speeds up. Derived from the level data via
    // TDLogic.levelGimmicks (the enemyTraits discipline), and each entry names
    // which levels use it, so a new gimmick documents itself.
    const gseen = new Map();
    for (const lv of global.TDData.LEVELS) {
      for (const g of L.levelGimmicks(lv)) {
        if (!gseen.has(g.key)) gseen.set(g.key, { g: g, on: [] });
        gseen.get(g.key).on.push(lv.id);
      }
    }
    const gimRow = [...gseen.values()].map((v) =>
      '<li><span class="td-guide__tico">' + v.g.icon + "</span><b>" + v.g.name + "</b> — " + v.g.text +
      ' <i>(levels ' + v.on.join(", ") + ")</i></li>").join("");
    // The star tree grew to 30 nodes across three branches and was documented
    // NOWHERE outside the buy screen — the same condition that made TD-12 write
    // this guide in the first place, and that TD-16's gimmicks hit again. Derived
    // from DATA.META_NODES (grouped by its own branch list), so a 31st node
    // documents itself and the totals can never drift from the data.
    const BR = { fire: "🎯 Firepower", econ: "💰 Economy", fort: "🏰 Fortification" };
    const nodes = global.TDData.META_NODES || [];
    const treeRow = Object.keys(BR).filter((b) => nodes.some((n) => n.branch === b)).map((b) => {
      const mine = nodes.filter((n) => n.branch === b);
      return '<li><b>' + BR[b] + "</b> <i>(" + mine.length + " skills, " +
        mine.reduce((s, n) => s + n.cost, 0) + "⭐)</i><ul>" +
        mine.map((n) => '<li><span class="td-guide__tico">' + n.icon + "</span>" + n.name +
          " — " + n.desc + " <i>(" + n.cost + "⭐" +
          (n.req ? ", after " + ((nodes.find((x) => x.id === n.req) || {}).name || n.req) : "") +
          (n.reqSpend ? ", needs " + n.reqSpend + "⭐ spent in this branch" : "") + ")</i></li>").join("") +
        "</ul></li>";
    }).join("");

    const el = metaOverlay("td-overlay--guide",
      "<h3>📖 Toybox Guide</h3>" +
      '<p class="td-overlay__sub">What each toy does — and what can actually hit it.</p>' +
      '<ul class="td-guide__towers">' + towerRow + "</ul>" +
      // Each power's cost line reads "130🪙 · 1⚙️", and ⚙️ was never DEFINED
      // anywhere in the app — the symbol appeared in the HUD, on every ability
      // button and here, and nothing said what it was. Numbers quoted from RULES
      // so they cannot drift from the engine.
      '<p class="td-overlay__sub">Powers — usable during a wave only. Each costs gold 🪙 <b>and</b> ⚙️ Toy Energy: you get ' +
        global.TDData.RULES.chargePerWave + " more ⚙️ every wave you send, banked up to " +
        global.TDData.RULES.chargeMax + ". That is what stops late-game gold making the powers free. " +
        "The strip holds " + global.TDData.RULES.abilitySlots + " of the " + (global.TDData.ABILITIES || []).length +
        ", so 🎒 Powers on the fort home is where you choose which ones you bring. 🎒 marks what is packed. " +
        "Once your board is full and gold has nowhere left to go, <b>tap the ⚙️ in the top bar</b> to buy " +
        global.TDData.RULES.chargeBuyMax + " more energy for " + global.TDData.RULES.chargeBuyBase +
        "🪙 — once per wave, so an overflowing purse buys options, never a free win.</p>" +
      '<ul class="td-guide__towers td-guide__abils">' + abilRow + "</ul>" +
      // The wave button does two different jobs; say so, or ⏩ RUSH is a mystery.
      '<p class="td-overlay__sub">The wave button</p>' +
      '<ul class="td-guide__towers"><li><b>▶ CALL</b> — start the next wave early. The sooner you call, the more gold.</li>' +
      "<li><b>⏩ RUSH</b> — send the NEXT wave on top of the one already walking, for the same bonus. Up to " +
      (global.TDData.RULES.maxWavesInFlight || 2) + " waves at once. Big gold, big risk.</li></ul>" +
      '<p class="td-overlay__sub">Level tricks — the board itself fights back.</p>' +
      '<ul class="td-guide__towers td-guide__gimmicks">' + gimRow + "</ul>" +
      '<p class="td-overlay__sub">⭐ Star Tree — spend the stars you earn, then bring ' +
      (global.TDData.RULES.metaSlots || 6) + " into a run.</p>" +
      '<ul class="td-guide__towers td-guide__tree">' + treeRow + "</ul>" +
      '<div class="td-guide__list">' + order.map(card).join("") + "</div>" +
      '<button class="td-btn td-guide-done" type="button">Done</button>');
    el.querySelector(".td-guide-done").addEventListener("click", UI.closeOverlay);
    if (focusType) {
      const f = el.querySelector('.td-guide__card[data-enemy="' + focusType + '"]');
      if (f && f.scrollIntoView) f.scrollIntoView({ block: "center" });
    }
    return el;
  };

  // THE host for anything that floats over the fort: the screen that is actually
  // VISIBLE. An overlay parked on a hidden screen is itself hidden — that is how
  // the guide, opened from the defeat overlay on the PLAY screen, rendered as
  // nothing (caught by a browser test, invisible to reading the code).
  function hostScreen() {
    const play = doc.getElementById("screen-td-play"), fort = doc.getElementById("screen-td-home");
    if (play && !play.hidden) return play;
    if (fort && !fort.hidden) return fort;
    return play || fort;
  }
  // Every meta dialog (star tree, guide, badges, endless, powers, backup) gets a
  // ✕ in the top-right, injected HERE so there is ONE owner and a new dialog
  // inherits it — reported from real play as having to scroll all the way to the
  // bottom of the tree just to close it. The bottom "Done" stays: it is the
  // natural end of a read-through. The ✕ is `position: sticky`, so it rides the
  // top edge of the box as it scrolls; if sticky is unavailable it degrades to
  // sitting at the top of the content, which is still one scroll-UP instead of
  // a scroll to the very bottom.
  function metaOverlay(cls, html) {
    let el = doc.querySelector(".td-overlay");
    if (el) el.remove();
    el = doc.createElement("div");
    el.className = "td-overlay " + cls;
    el.innerHTML = '<div class="td-overlay__box td-overlay__box--wide">' +
      '<button class="td-overlay__x" type="button" data-adult="1" aria-label="Close">✕</button>' +
      html + "</div>";
    el.querySelector(".td-overlay__x").addEventListener("click", UI.closeOverlay);
    const host = hostScreen();
    if (host) host.appendChild(el);
    return el;
  }

  // TD-8 star tree: 3 themed branches × ranked skills + a 👑 capstone each.
  // Tap to buy; tap an owned node to refund it (free respec). Rank II needs its
  // rank I; a capstone needs reqSpend ⭐ spent inside its branch. Refunding
  // CASCADES so the owned set always stays self-consistent (removing rank I
  // also drops rank II; dropping branch spend below a capstone's requirement
  // drops the capstone). onChange(newMeta) persists + is followed by a re-render.
  function branchSpend(owned, branch, exceptId) {
    let sp = 0;
    for (const n of NODES()) if (n.branch === branch && n.id !== exceptId && owned.has(n.id)) sp += n.cost;
    return sp;
  }
  function treeLockReason(owned, n) {
    if (n.req && !owned.has(n.req)) {
      const r = NODES().find((x) => x.id === n.req);
      return "needs " + (r ? r.name : n.req);
    }
    if (n.reqSpend && branchSpend(owned, n.branch, n.id) < n.reqSpend) return "spend ⭐" + n.reqSpend + " in this branch";
    return null;
  }
  function cascadeConsistent(set) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of NODES()) {
        if (!set.has(n.id)) continue;
        if ((n.req && !set.has(n.req)) || (n.reqSpend && branchSpend(set, n.branch, n.id) < n.reqSpend)) {
          set.delete(n.id); changed = true;
        }
      }
    }
  }
  UI.showStarTree = function (save, onChange, keepScroll) {
    const t = starTotals(save);
    const owned = new Set(save.meta || []);
    const SLOTS = global.TDData.RULES.metaSlots;
    // P4: OWNING a node and BRINGING it are different. Equipped ∩ owned, capped —
    // the same rule the engine is handed, computed from the same two fields, so
    // the overlay can never show a loadout the run would not actually use.
    const equipped = (save.loadout || []).filter((id) => owned.has(id)).slice(0, SLOTS);
    const eq = new Set(equipped);
    const branches = (global.TDData.META_BRANCHES || []).map((br) => {
      const rows = NODES().filter((n) => n.branch === br.id).map((n) => {
        const has = owned.has(n.id);
        const locked = has ? null : treeLockReason(owned, n);
        const buyable = has || (!locked && t.avail >= n.cost);
        const on = eq.has(n.id);
        // the equip toggle only exists once you own the node; a full rack still
        // lets you UN-equip, or the last slot would be a trap
        const equipBtn = has
          ? '<button class="td-node__equip' + (on ? " td-node__equip--on" : "") + '" type="button"' +
            (!on && eq.size >= SLOTS ? " disabled" : "") +
            ' data-equip="' + n.id + '" aria-label="' + (on ? "Unequip " : "Equip ") + n.name + '">' + (on ? "🎒" : "＋") + "</button>"
          : "";
        return '<div class="td-node-row">' +
          '<button class="td-node' + (has ? " td-node--on" : "") + (locked ? " td-node--locked" : "") + '"' + (buyable ? "" : " disabled") +
          ' data-node="' + n.id + '">' +
          '<span class="td-node__icon">' + n.icon + "</span>" +
          '<span class="td-node__body"><span class="td-node__name">' + n.name + (n.reqSpend ? " 👑" : "") + "</span>" +
          '<span class="td-node__desc">' + (locked ? "🔒 " + locked : n.desc) + "</span></span>" +
          '<span class="td-node__cost">' + (has ? "✓" : "⭐" + n.cost) + "</span></button>" + equipBtn + "</div>";
      }).join("");
      return '<p class="td-tree__branch">' + br.icon + " " + br.name +
        ' <span class="td-tree__spent">⭐' + branchSpend(owned, br.id, null) + " spent</span></p>" +
        '<div class="td-nodes">' + rows + "</div>";
    }).join("");
    const el = metaOverlay("td-tree", '<h3>⭐ Star Tree</h3>' +
      '<p class="td-overlay__stars td-tree__avail">⭐ ' + t.avail + " to spend · " + t.spent + " used</p>" +
      '<p class="td-overlay__sub td-tree__slots">🎒 ' + equipped.length + " / " + SLOTS +
      " equipped — a run brings only what is packed, so the tree is a choice every battle.</p>" +
      branches +
      '<div class="td-overlay__row"><button class="td-btn td-tree-respec" type="button">↺ Refund all</button>' +
      '<button class="td-btn td-btn--call td-tree-done" type="button">Done</button></div>');
    // Buying/refunding rebuilds the whole overlay (metaOverlay removes + re-appends),
    // which would reset scrollTop to 0 — on a real phone the 23-node tree is far
    // taller than its 86dvh box, so a tap near the bottom (Fortification branch)
    // would jump you back to the top every time. Preserve the box's scroll across
    // the re-render. (390×844 in tests hides this; a real device shows it.)
    const box = el.querySelector(".td-overlay__box");
    if (box && keepScroll) box.scrollTop = keepScroll;
    const rerender = (meta, load) => { const top = box ? box.scrollTop : 0; onChange(meta, load); UI.showStarTree(save, onChange, top); };
    el.querySelectorAll(".td-node").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.node; const set = new Set(save.meta || []);
      const node = NODES().find((n) => n.id === id);
      if (!node) return;
      if (set.has(id)) { set.delete(id); cascadeConsistent(set); }
      else {
        if (treeLockReason(set, node) || starTotals(save).avail < node.cost) return;
        set.add(id);
        // a freshly bought node auto-equips while there is room — buying
        // something that then does nothing until a second tap reads as broken
        if (eq.size < SLOTS) eq.add(id);
      }
      rerender([...set], [...eq]);
    }));
    el.querySelectorAll(".td-node__equip").forEach((b) => b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = b.dataset.equip;
      if (eq.has(id)) eq.delete(id);
      else if (eq.size < SLOTS) eq.add(id);
      rerender(save.meta || [], [...eq]);
    }));
    el.querySelector(".td-tree-respec").addEventListener("click", () => rerender([], []));
    el.querySelector(".td-tree-done").addEventListener("click", UI.closeOverlay);
  };

  // P6 Powers pack: bring RULES.abilitySlots of the pool. Deliberately the same
  // shape as the star tree's equip toggle — one slot budget, one "＋ / 🎒"
  // affordance, one scroll-preserving rebuild — because a second UX for the
  // same idea is how two owners of one concept start disagreeing.
  UI.showPowers = function (save, onChange, keepScroll) {
    const pool = global.TDData.ABILITIES || [];
    const SLOTS = global.TDData.RULES.abilitySlots;
    const real = new Set(pool.map((a) => a.id));
    const eq = new Set((save.powers || []).filter((id) => real.has(id)).slice(0, SLOTS));
    const rows = pool.map((a) => {
      const on = eq.has(a.id);
      return '<div class="td-node-row">' +
        '<button class="td-node' + (on ? " td-node--on" : "") + '" data-power="' + a.id + '" type="button">' +
        '<span class="td-node__icon">' + a.icon + "</span>" +
        '<span class="td-node__body"><span class="td-node__name">' + a.name + "</span>" +
        '<span class="td-node__desc">' + a.role + "</span></span>" +
        '<span class="td-node__cost">' + a.gold + "🪙 ·" + (a.charges === undefined ? 1 : a.charges) + "⚙️</span></button>" +
        '<button class="td-node__equip' + (on ? " td-node__equip--on" : "") + '" type="button"' +
        (!on && eq.size >= SLOTS ? " disabled" : "") +
        ' data-equippow="' + a.id + '" aria-label="' + (on ? "Leave behind " : "Pack ") + a.name + '">' + (on ? "🎒" : "＋") + "</button></div>";
    }).join("");
    const el = metaOverlay("td-powers", "<h3>🎒 Powers Pack</h3>" +
      '<p class="td-overlay__sub">' + eq.size + " / " + SLOTS +
      " packed — the strip holds " + SLOTS + ", so bringing one power means leaving another behind.</p>" +
      '<div class="td-nodes">' + rows + "</div>" +
      '<div class="td-overlay__row"><button class="td-btn td-btn--call td-powers-done" type="button">Done</button></div>');
    const box = el.querySelector(".td-overlay__box");
    if (box && keepScroll) box.scrollTop = keepScroll;
    const rerender = () => { const top = box ? box.scrollTop : 0; onChange([...eq]); UI.showPowers(save, onChange, top); };
    const toggle = (id) => {
      if (eq.has(id)) { if (eq.size > 1) eq.delete(id); }  // never pack an EMPTY strip
      else if (eq.size < SLOTS) eq.add(id);
      rerender();
    };
    el.querySelectorAll("[data-power]").forEach((b) => b.addEventListener("click", () => toggle(b.dataset.power)));
    el.querySelectorAll("[data-equippow]").forEach((b) => b.addEventListener("click", (ev) => { ev.stopPropagation(); toggle(b.dataset.equippow); }));
    el.querySelector(".td-powers-done").addEventListener("click", UI.closeOverlay);
  };

  // Badges: the 12-achievement grid, earned lit + named, locked dimmed.
  UI.showAchievements = function (save) {
    const got = new Set(save.ach || []);
    // The star thresholds are DERIVED from the shipped level count, exactly like
    // the code that awards them — a literal "18" / "36" in the data went stale
    // the moment World 4 raised the ceiling to 48.
    const cap = global.TDData.LEVELS.length * 3;
    const starDesc = { starcollector: "Earn " + Math.round(cap / 2) + " stars", fullfort: "Earn all " + cap + " stars" };
    const cells = ACHS().map((a) => {
      const has = got.has(a.id);
      return '<div class="td-ach' + (has ? " td-ach--on" : "") + '">' +
        '<span class="td-ach__icon">' + (has ? a.icon : "🔒") + "</span>" +
        '<span class="td-ach__name">' + a.name + "</span>" +
        '<span class="td-ach__desc">' + (starDesc[a.id] || a.desc) + "</span></div>";
    }).join("");
    const el = metaOverlay("td-achgrid", '<h3>🏅 Badges</h3>' +
      '<p class="td-overlay__stars">' + got.size + " / " + ACHS().length + "</p>" +
      '<div class="td-achs">' + cells + "</div>" +
      '<button class="td-btn td-btn--call td-ach-done" type="button">Done</button>');
    el.querySelector(".td-ach-done").addEventListener("click", UI.closeOverlay);
  };

  // Endless picker: one button per world, unlocked once its 4 levels are 3⭐.
  UI.showEndless = function (save, onPick) {
    // DERIVED from the data, never a literal list — World 4's attic arena
    // existed in ENDLESS.worlds and could not be reached because this line
    // named three worlds (the "level grid says 12" lesson, again).
    const W = global.TDData.ENDLESS.worlds;
    const worlds = Object.keys(W).map((w) => [w, W[w].label || w]);
    const best = save.endlessBest || {};
    const rows = worlds.map(([w, label]) => {
      const open = UI.endlessUnlocked(save, w);
      const b = best[w] ? (" · best wave " + best[w]) : "";
      // the lock hint counts the world's ACTUAL levels — "the 4 levels" was a
      // literal that happened to be right for four worlds of four
      const n = worldLevels(w).length;
      return '<button class="td-endless' + (open ? "" : " td-endless--locked") + '"' + (open ? "" : " disabled") +
        ' data-world="' + w + '">' + label + (open ? '<span class="td-endless__best">' + (best[w] ? "🏆 " + best[w] : "new!") + "</span>" : '<span class="td-endless__best">🔒 3⭐ the ' + n + ' levels</span>') + "</button>";
    }).join("");
    const el = metaOverlay("td-endlesspick", '<h3>♾️ Endless</h3>' +
      '<p class="td-overlay__sub">Survive as long as you can — the toys never stop coming.</p>' +
      '<div class="td-endlessrows">' + rows + "</div>" +
      '<button class="td-btn td-endless-done" type="button">Close</button>');
    el.querySelectorAll(".td-endless").forEach((b) => b.addEventListener("click", () => { if (b.dataset.world) { UI.closeOverlay(); onPick(b.dataset.world); } }));
    el.querySelector(".td-endless-done").addEventListener("click", UI.closeOverlay);
  };

  // Achievement toast — a brief celebratory slide-in (auto-dismiss).
  // ONE toast implementation. It mounts on the screen that is actually VISIBLE —
  // a fort-home toast (e.g. the grown-ups reset) would be invisible if it always
  // went to the hidden play screen.
  UI.notice = function (icon, html) {
    const host = hostScreen();
    if (!host) return null;
    // A single win can earn several badges at once — cascade them up the screen
    // and give EACH its own removal timer, so an earlier toast is never orphaned
    // (a shared timer would only ever remove the newest, leaking the rest).
    const stackIdx = host.querySelectorAll(".td-toast").length;
    const el = doc.createElement("div");
    el.className = "td-toast";
    if (stackIdx) el.style.bottom = "calc(24px + env(safe-area-inset-bottom) + " + (stackIdx * 64) + "px)";
    el.innerHTML = '<span class="td-toast__icon">' + icon + '</span><span class="td-toast__txt">' + html + "</span>";
    host.appendChild(el);
    setTimeout(() => { el.remove(); }, 2800);
    return el;
  };
  UI.toast = function (icon, name) { return UI.notice(icon, "<b>Badge earned!</b><br>" + name); };

  // ---- HUD + bubbles ----
  UI.hud = function (state) {
    const q = (s) => doc.querySelector("#screen-td-play " + s);
    const lives = q(".td-hud__lives"), gold = q(".td-hud__gold"), wave = q(".td-hud__wave");
    if (lives) lives.textContent = "❤️ " + state.lives;
    if (gold) gold.textContent = "🪙 " + state.gold;
    // ⚙️ Toy Energy is the powers' real cost late, so it belongs beside gold —
    // a resource you can't see is a resource you can't plan around.
    const charge = q(".td-hud__charge");
    if (charge) {
      charge.textContent = "⚙️ " + (state.charge || 0);
      // NAME the resource and its price, every frame. ⚙️ shipped once as a bare
      // numeral that nothing in the app ever explained — the documented "a
      // symbol the player cannot decode is a mechanic they cannot plan around"
      // defect — so the exchange must not repeat it: the button says what it
      // costs, and says why when it refuses.
      const eng = hudEngine && hudEngine();
      const r = eng && eng.buyChargeReady ? eng.buyChargeReady() : { ok: false, reason: "none" };
      const price = eng && eng.chargePrice ? eng.chargePrice() : 0;
      const why = {
        "not-in-wave": "Toy Energy — buy more once a wave is walking",
        "wave-limit": "Toy Energy — you have already bought one this wave",
        full: "Toy Energy — your bank is full",
        gold: "Toy Energy — costs " + price + " gold, and you cannot afford it yet",
      }[r.reason] || ("Toy Energy — tap to buy one more for " + price + " gold");
      charge.disabled = !r.ok;
      charge.classList.toggle("is-buyable", !!r.ok);
      charge.title = why;
      charge.setAttribute("aria-label", (state.charge || 0) + " toy energy. " + why);
    }
    const level = global.TDData.LEVELS.find((l) => l.id === state.levelId);
    const endless = state.endless || !level; // endless runs aren't in DATA.LEVELS
    const total = level ? level.waves.length : 0;
    if (wave) {
      // The wave you're facing or about to face (1-based) — never the old "0/6".
      // With a RUSHED wave, TWO are walking at once, so name both: "wave 3-4/12".
      const sent = state.sentIdx == null ? state.waveIdx : state.sentIdx;
      const first = Math.min(state.waveIdx + 1, endless ? Infinity : total);
      const last = Math.min(Math.max(sent, state.waveIdx + 1), endless ? Infinity : total);
      const span = last > first ? first + "-" + last : String(first);
      if (endless) wave.textContent = "wave " + span + " ♾️";
      else wave.textContent = "wave " + span + "/" + total;
    }
    const call = q(".td-call");
    if (call) {
      // The CALL button lives in BOTH phases now: during build it starts the
      // wave early for gold; during a wave it RUSHES the next one on top of the
      // one already walking (same gold, real danger). It only disappears when
      // there is genuinely nothing to send — the cap is reached, or the last
      // wave is out — so it is never a dead control.
      const info = UI._callInfo ? UI._callInfo() : null;
      const label = call.querySelector(".td-call__label");
      const meta = call.querySelector(".td-call__meta");
      const over = state.phase === "won" || state.phase === "lost";
      // The button is now IN THE LAYOUT, so hiding it would resize the field
      // under the player's thumb at every phase boundary. When it can't be used
      // it goes INERT and says why — the same treatment the powers already get,
      // and better than a control that silently vanishes.
      call.hidden = over;
      const ok = !info || info.ok;
      call.disabled = !ok;
      call.classList.toggle("td-call--off", !ok);
      call.classList.toggle("td-call--rush", state.phase !== "build");
      if (state.phase === "build") {
        const secs = Math.ceil(state.countdown / global.TDData.TICK_RATE);
        const bonus = info ? info.bonus : Math.ceil((state.countdown / global.TDData.TICK_RATE) * global.TDData.RULES.earlyCallRate);
        label.textContent = "▶ CALL";
        meta.textContent = ok ? "+" + bonus + "🪙 · " + secs + "s" : "";
      } else if (!over) {
        label.textContent = "⏩ RUSH";
        meta.textContent = ok ? "+" + info.bonus + "🪙"
          : info.reason === "too-soon" ? "steady…"
            : info.reason === "too-many-waves" ? info.max + " waves out"
              : "last wave";
      }
    }
    // Next-wave preview: during the build phase, show WHAT is coming (enemy icons
    // + counts) so the player can plan their build — a premium-TD staple.
    const nw = q(".td-nextwave");
    if (nw) {
      // What's coming is the next UNSENT wave (sentIdx), which equals waveIdx at
      // every build boundary but not while a rushed wave is still walking.
      const nextIdx = state.sentIdx == null ? state.waveIdx : state.sentIdx;
      if (!endless && state.phase === "build" && nextIdx < total) {
        // 🧭 Scout Report is the tree's one PURE-INFORMATION node: it changes no
        // engine number at all (so it carries exactly zero balance risk) and
        // reads the run's own equipped loadout, not save.meta — what you BROUGHT
        // is what you see.
        const scouting = (state.meta || []).indexOf("scoutreport") >= 0 && nextIdx + 1 < total;
        const groups = level.waves[nextIdx].groups.concat(scouting ? level.waves[nextIdx + 1].groups : []);
        const counts = {};
        groups.forEach((g) => { counts[g.type] = (counts[g.type] || 0) + g.count; });
        const parts = Object.keys(counts).map((type) => {
          const def = global.TDData.ENEMIES[type];
          return (def && def.icon ? def.icon : "•") + counts[type];
        });
        // A flank has to be ANTICIPATED, not discovered. The preview named the
        // enemies but never said any of them skip most of the lane, so the first
        // you knew of a side door was 45 marbles appearing behind your guns
        // (reported from real play). Count what comes through and say so.
        // Kept to an ICON + count, not "45 side door": this pill is nowrap-ish and
        // iOS renders emoji WIDER than headless Chromium, so a long line measures
        // fine here and spills off a real 320px phone (the tower-panel lesson).
        // The field marker says WHERE; this says a flank is coming at all.
        const flank = groups.filter((g) => g.at > 0).reduce((n, g) => n + g.count, 0);
        nw.textContent = (scouting ? "Next 2: " : "Next: ") + parts.join("  ") + (flank ? "   🚪" + flank : "");
        nw.hidden = false;
      } else nw.hidden = true;
    }
    UI.abilities(state);
    UI.prices(state.gold); // an open build/upgrade dialog re-colours as gold arrives
  };

  // TD-9: refresh the ability strip — affordable / on-cooldown / armed. Reads
  // ONLY the engine state, so the button can never disagree with what a tap will
  // actually do (the "dead feature" lesson: the control must reflect the engine).
  // A one-line hint over the field: what an armed ability is waiting for, or why
  // the last tap was refused. Without this a refusal was a silent blip.
  UI.abilityHint = function (text) {
    let el = doc.querySelector("#screen-td-play .td-abilhint");
    if (!el) {
      const wrap = doc.querySelector("#screen-td-play .td-canvas-wrap");
      if (!wrap) return;
      el = doc.createElement("div");
      el.className = "td-abilhint";
      el.setAttribute("aria-live", "polite");
      wrap.appendChild(el);
    }
    if (!text) { el.hidden = true; el.textContent = ""; return; }
    el.hidden = false;
    el.textContent = text;
    if (UI._hintT) clearTimeout(UI._hintT);
    UI._hintT = setTimeout(() => { el.hidden = true; }, 2200);
  };

  UI.abilities = function (state, armedId) {
    const wrap = doc.querySelector("#screen-td-play .td-abils");
    if (!wrap) return;
    const over = state.phase === "won" || state.phase === "lost";
    wrap.hidden = over;
    // Powers are WAVE-only (the engine refuses `not-in-wave`). During build they
    // go INERT rather than hidden: dimmed and untappable, so a build-phase tap
    // can never be a mystery refusal — but still laid out, so the field does not
    // resize at every phase boundary.
    wrap.classList.toggle("td-abils--idle", state.phase !== "wave");
    for (const b of wrap.querySelectorAll(".td-abil")) {
      const def = (global.TDData.ABILITIES || []).find((a) => a.id === b.dataset.abil);
      if (!def) continue;
      const left = Math.max(0, ((state.abilityCd || {})[def.id] || 0) - state.tick) / global.TDData.TICK_RATE;
      const poor = state.gold < def.gold;
      b.classList.toggle("td-abil--cool", left > 0);
      b.classList.toggle("td-abil--poor", !left && poor);
      b.classList.toggle("td-abil--armed", armedId === def.id);
      const cd = b.querySelector(".td-abil__cd");
      if (cd) { cd.hidden = left <= 0; cd.textContent = left > 0 ? Math.ceil(left) + "s" : ""; }
    }
  };

  UI.showBubble = function (html, xPx, yPx) {
    const b = UI.bubble;
    if (!b) return;
    b.innerHTML = html;
    b.classList.remove("td-bubble--below", "td-bubble--hint");
    // Colour every price BEFORE the dialog is revealed. Doing it after (which is
    // what leaving it to UI.hud did) shows one frame of the base colour, so an
    // unaffordable upgrade flashed as if it were buyable.
    paintPrices();
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
  // Live affordability. Every price in the field bubble carries data-cost, so
  // this can re-colour them as gold comes in — RED while you can't afford it,
  // GREEN the moment you can — WITHOUT closing and reopening the dialog. Called
  // from UI.hud(), i.e. every frame the HUD updates.
  //   The gold is CACHED here because showBubble has to paint the affordance
  // before the dialog is ever visible. It used to run only from UI.hud(), i.e.
  // one frame LATE — so every price appeared in its base colour first (the
  // branch cards are purple) and only then flipped to red. Reported as "the
  // colour flashes purple even if I cannot afford it", and that flash is a lie
  // in the exact moment a player is deciding.
  //   It reads the LIVE gold through a source function rather than a cached
  // number. A cache looked equivalent and was not: gold that moves without a HUD
  // tick (a grant, a direct state edit) left the next dialog opening painted
  // from a stale figure — caught by the shipped RED→GREEN test, which sets gold
  // and opens immediately.
  let lastGold = 0;
  let goldFn = null;
  UI.setGoldSource = function (fn) { goldFn = fn; };
  function currentGold() { return goldFn ? goldFn() : lastGold; }
  // The same injection for the ENGINE itself, so the HUD can ask it what a
  // purchase costs and why it is refused instead of re-deriving either — the
  // `priceOf` lesson: the engine is the single source of a price.
  let engineFn = null;
  UI.setEngineSource = function (fn) { engineFn = fn; };
  function hudEngine() { return engineFn ? engineFn() : null; }
  function paintPrices() {
    if (!UI.bubble) return;
    const gold = currentGold();
    for (const el of UI.bubble.querySelectorAll("[data-cost]")) {
      const cost = +el.dataset.cost;
      // A non-finite cost means "not purchasable" (the engine returns Infinity),
      // and NaN would make every comparison false in a way that looks the same
      // but is not — so be explicit rather than relying on the coincidence.
      const can = Number.isFinite(cost) && gold >= cost;
      el.classList.toggle("td-afford", can);
      el.classList.toggle("td-afford--no", !can);
      el.disabled = !can;
    }
  }
  UI.paintPrices = paintPrices;          // showBubble paints BEFORE revealing
  UI.prices = function (gold) {
    lastGold = gold;                      // fallback only; the source function wins
    if (UI.bubble && UI.bubble.hidden) return;
    paintPrices();
  };
  UI.lastGold = function () { return lastGold; };

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
    const host = hostScreen();
    if (host) host.appendChild(el);
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

  // TD-13: the run summary — damage BY LINE (which towers actually carried),
  // kills, gold, and your personal best for this level+difficulty. One renderer,
  // shown on victory AND defeat, so a loss teaches as much as a win.
  function summaryHtml(rs) {
    if (!rs || !rs.rows.length) return "";
    return '<div class="td-sum">' +
      '<p class="td-sum__head">Your board</p>' +
      '<ul class="td-sum__bars">' + rs.rows.map((r) =>
        '<li><span class="td-sum__label">' + r.label + "</span>" +
        '<span class="td-sum__bar"><i style="width:' + r.pct + '%"></i></span>' +
        '<span class="td-sum__pct">' + r.pct + "%</span></li>").join("") + "</ul>" +
      '<p class="td-sum__line">💀 ' + rs.kills + " defeated · 🪙 " + rs.gold + " earned · 🏗️ " + rs.towers + " towers (" + rs.spent + "🪙)</p>" +
      (rs.personalBest ? '<p class="td-sum__pb">🏆 New personal best!</p>'
        : (rs.best != null ? '<p class="td-sum__line">Best here: ' + rs.best + " stickers kept</p>" : "")) +
      "</div>";
  }

  UI.showVictory = function (stars, lives, hooks, rs) {
    const hasNext = !!hooks.nextLevel;
    const el = overlay("td-overlay--win",
      '<h3>Fort defended! 🎉</h3>' +
      '<p class="td-overlay__stars">' + "⭐".repeat(stars) + '<span class="td-level__dim">' + "⭐".repeat(3 - stars) + "</span></p>" +
      "<p>" + lives + " of 20 stickers kept safe</p>" +
      summaryHtml(rs) +
      (hasNext ? '<p class="td-overlay__warn">🔓 Level ' + hooks.nextLevel + ' unlocked!</p>' : "") +
      (hasNext ? '<button class="td-btn td-btn--call" data-act="next" type="button">▶ Next level</button>' : "") +
      '<button class="td-btn" data-act="continue" type="button">' + (hasNext ? "🏰 Back to the fort" : "Continue") + "</button>");
    el.addEventListener("click", (ev) => {
      const act = ev.target && ev.target.dataset && ev.target.dataset.act;
      if (act === "continue") hooks.continueOn();
      else if (act === "next" && hooks.onNext) hooks.onNext();
    });
  };

  UI.showDefeat = function (hooks, endless, pm, rs) {
    // endless: { score, best } — an endless run ends only in defeat, so its
    // "score" (waves survived) is the headline, not a failure.
    const head = endless ? '<h3>♾️ Run over!</h3>' +
        '<p class="td-overlay__stars">🏁 wave ' + endless.score + "</p>" +
        "<p>" + (endless.score >= endless.best ? "🏆 New best!" : "Best: wave " + endless.best) + "</p>"
      : '<h3>The toys got sleepy… 😴</h3><p>The fort door ran out of stickers this time.</p>' +
        // TD-12 post-mortem: the defeat screen used to be flavour ONLY — no
        // diagnosis at all, even though the engine emits every leak. Now it
        // names the wave, what got through, and (when the board had a real
        // blind spot) what to bring instead.
        (pm ? '<div class="td-pm">' +
          '<p class="td-pm__wave">Wave ' + pm.wave + " · " + pm.total + " got past you</p>" +
          '<ul class="td-pm__list">' + pm.rows.map((r) =>
            '<li><span class="td-pm__ico">' + r.icon + "</span>" + r.name + '<span class="td-pm__n">×' + r.n + "</span></li>").join("") + "</ul>" +
          (pm.advice ? '<p class="td-pm__advice">' + pm.advice + "</p>" : "") +
          '<button class="td-btn td-pm__guide" type="button" data-act="guide">📖 See the guide</button>' +
        "</div>" : "") + summaryHtml(rs);
    const el = overlay("td-overlay--lose",
      head +
      '<button class="td-btn" data-act="retry" type="button">🔁 ' + (endless ? "Again" : "Try again") + "</button>" +
      (endless ? "" : '<button class="td-btn" data-act="retrynew" type="button">🎲 New shuffle</button>') +
      '<button class="td-btn" data-act="quit" type="button">🏰 Back to the fort</button>');
    el.addEventListener("click", (ev) => {
      const act = ev.target && ev.target.dataset && ev.target.dataset.act;
      if (!act || !hooks[act]) return;
      // "guide" carries the enemy the post-mortem blamed, so the guide opens
      // scrolled to the thing that actually beat you.
      if (act === "guide") hooks.guide(pm && pm.focus);
      else hooks[act]();
    });
  };

  if (typeof module !== "undefined" && module.exports) module.exports = UI;
  global.TDUI = UI;
})(typeof window !== "undefined" ? window : globalThis);
