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

  // ---- per-world level-card tint, DERIVED from the world's own floor ----
  // This was FIVE hand-written CSS rules, split across TWO blocks 700 lines apart
  // (backyard + toystore near the top, attic + garage + moving down by the retired
  // Kid Fort skin) — which is why nobody noticed the list had stopped covering the
  // campaign: worlds 7-10 (the New House, the Sort Line, the Toy Works and the
  // Party) shipped with NO tint while CLAUDE.md claimed the fort home "shows world
  // tints". The counting law, on a stylesheet, with the extra twist that a list
  // living in two places is a list nobody can audit.
  //
  // Luminance is CAPPED rather than trusted: the card's own text is #9db4dd, which
  // needs a background under ~0.061 relative luminance to clear AA, and a floor
  // like the party's plum carpet is far lighter than that. So the floor colour is
  // pulled toward the card navy until it is dark enough BY CONSTRUCTION, which is
  // what lets an 11th world inherit this with no contrast review.
  const TINTS = {};
  function worldTint(w) {
    if (TINTS[w] !== undefined) return TINTS[w];
    const f = ((global.TDData.WORLDS || {})[w] || {}).floor;
    if (!f || !f.top) return (TINTS[w] = null);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const BASE = [14, 24, 48];                       // the default card navy
    let c = [1, 3, 5].map((i) => parseInt(f.top.slice(i, i + 2), 16));
    for (let k = 0; k < 40 && lum(c) > 0.045; k++) c = c.map((v, i) => Math.round(v * 0.86 + BASE[i] * 0.14));
    const border = c.map((v) => Math.min(255, Math.round(v * 1.9 + 26)));
    return (TINTS[w] = { bg: "rgb(" + c.join(",") + ")", border: "rgb(" + border.join(",") + ")" });
  }

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
        // `.td-mini` is the fort's OWN top-bar control size, and its comment says
        // why: "adult-sized (>=44) - the fort is Jon's space". Without it this
        // button falls through to `.btn-round`, which is Josh's kid chrome sized
        // by the 76px `--tap` token — so the same 🏠, doing the same job, was
        // 76px here and 54px on the play screen, and the largest, brightest
        // control on an adult screen was the one that LEAVES it.
        '<button class="btn-round td-mini td-exit" type="button" aria-label="Back to the front door">🏠</button>' +
        '<h2 class="td-title">🏰 Fort Josh</h2>' +
        '<span class="td-bar__pad" aria-hidden="true"></span>' +
      "</div>" +
      '<p class="td-sub">Toybox Defense</p>' +
      '<div class="td-resume" hidden></div>' +
      '<div class="td-diff" role="group" aria-label="Difficulty"></div>' +
      '<div class="td-meta" role="group" aria-label="Meta">' +
        '<button class="td-metabtn td-tree-open" type="button">⭐ Star Tree</button>' +
        '<button class="td-metabtn td-powers-open" type="button">🎒 Powers</button>' +
        '<button class="td-metabtn td-chips-open" type="button">🎖️ Challenges</button>' +
        '<button class="td-metabtn td-ach-open" type="button">🏅 Badges</button>' +
        '<button class="td-metabtn td-endless-open" type="button">♾️ Endless</button>' +
        '<button class="td-metabtn td-daily-open" type="button">📅 Daily</button>' +
        '<button class="td-metabtn td-guide-open" type="button">📖 Guide</button>' +
      "</div>" +
      '<div class="td-levels" role="list"></div>' +
      // COUNTS ARE DERIVED. "16 levels across 4 worlds" was a literal, and its
      // sibling (`TOTAL_PLANNED = 12`) is why the whole attic shipped with no
      // card on the grid — the levels existed and no one could reach them.
      '<p class="td-note">' + global.TDData.LEVELS.length + ' levels across ' +
        new Set(global.TDData.LEVELS.map(function (l) { return l.world; })).size +
        ' worlds — beat one to unlock the next. Face ' + UI.rosterBlurb() + ' and ' +
        global.TDData.LEVELS.filter(function (l) { return l.waves.some(function (w) { return w.boss; }); }).length +
        ' bosses, with the full arsenal: ' + Object.keys(global.TDData.TOWERS).length +
        ' tower lines, upgrades &amp; exclusive tier-4 branches. 👑 marks a boss finale.</p>' +
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
    home.querySelector(".td-chips-open").addEventListener("click", hooks.openChips);
    home.querySelector(".td-ach-open").addEventListener("click", hooks.openAchievements);
    home.querySelector(".td-endless-open").addEventListener("click", hooks.openEndless);
    home.querySelector(".td-daily-open").addEventListener("click", hooks.openDaily);
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
          // …and it must show its PRICE on its face. It shipped reading "⚙️ 0"
          // with the gold cost only in `title`/`aria-label` — and a title is a
          // HOVER affordance, which a touch device does not have, so on the
          // actual phone this is a buy button that never says what it costs
          // until after you have pressed it. That is the third instance of the
          // same class (TD-12's abilities, then ⚙️ itself being unnamed): if a
          // control takes a resource, the number goes on the button.
          '<button type="button" class="td-hud__charge" data-adult="1" data-buycharge="1"' +
          ' title="Toy Energy — every power costs some. You get more each wave, and can buy one more during a wave.">' +
          '<span class="td-hud__chargeN">⚙️ 0</span><span class="td-hud__chargeBuy" hidden></span></button>' +
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
    // SECOND LAYER against the double-tap zoom, reported from real play on CALL
    // / RUSH and on the ⚙️ buy button. `touch-action: manipulation` is declared
    // page-wide, on `.td-screen`, on every control AND (now) on their
    // containers — and `touch-action` intersects down the ancestor chain, so on
    // paper the gesture is already dead. It is still reaching the player, and
    // this is a DEVICE-ONLY bug: WebKit is not installed in the dev sandbox, so
    // Chromium cannot prove or disprove the iOS behaviour either way. When you
    // cannot verify a layer, add a second one that works by a different
    // mechanism.
    //
    // preventDefault on the SECOND `touchend` inside the double-tap window
    // cancels the gesture at its source (it is what fastclick was built on),
    // and it needs `{ passive: false }` or the call is ignored outright.
    //
    // Swallowing that tap is not a cost here, it is the POINT: these are the
    // fort's rapid-tap controls, and a second press within 350ms is a fumble in
    // every one of them. CALL already has `RULES.rushSettle` for exactly this
    // reason — a doubled press must not send a wave you have not seen — and the
    // ⚙️ exchange is capped at one purchase a wave anyway. The first tap is
    // never touched, so nothing becomes less responsive.
    UI.noDoubleTapZoom = function (el) {
      if (!el || el.dataset.ndtz) return;
      el.dataset.ndtz = "1";
      let last = -1e9;
      el.addEventListener("touchend", function (ev) {
        const now = (ev && typeof ev.timeStamp === "number") ? ev.timeStamp : 0;
        if (now - last < 350) ev.preventDefault();   // kills the zoom AND the stray click
        last = now;
      }, { passive: false });
    };

    screens.appendChild(play);
    play.querySelector(".td-quit").addEventListener("click", hooks.quitToFort);
    play.querySelector(".td-pause").addEventListener("click", hooks.togglePause);
    play.querySelector(".td-speed").addEventListener("click", hooks.toggleSpeed);
    play.querySelector(".td-call").addEventListener("click", hooks.callWave);
    play.querySelector(".td-hud__charge").addEventListener("click", hooks.buyCharge);
    for (const el of play.querySelectorAll(".td-call, .td-hud__charge, .td-speed, .td-pause")) UI.noDoubleTapZoom(el);

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
          (a.charges === undefined ? 1 : a.charges) + " toy energy, ready again every " + a.cooldown + " seconds");
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
        UI.noDoubleTapZoom(b);   // the strip is rebuilt per run, so guard each new tile
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

  // "Beaten" has exactly ONE definition — >= 1 star on that ladder — and both the
  // grid's unlock rule and the count under each difficulty chip read it, so the
  // number a chip advertises can never disagree with how many cards the grid
  // actually opens. Two copies of this predicate is how `hurriedMult` got two
  // writers and how the wake lock's acquire and release drifted apart.
  const beatenOn = (save, diff, id) =>
    ((((save.stars || {})[diff]) || {})[String(id)] | 0) >= 1;
  // …and the victory screen's "🔓 unlocked!" claim reads it too: that line was
  // shown whenever a next level EXISTS, so replaying a level you had already
  // beaten announced an unlock that happened hours ago. Three readers, one
  // predicate — a second copy here would let the grid and the announcement
  // disagree about what "beaten" means.
  UI.levelBeaten = beatenOn;
  UI.ladderBeaten = function (save, diff) {
    return global.TDData.LEVELS.filter((l) => beatenOn(save, diff, l.id)).length;
  };

  // The blurb used to ENUMERATE the roster in prose — "(splitters, armor,
  // chargers, ghosts, moles, shielded bots, fliers, soakers, jammers, greased
  // runners, spawners, padding, blaring stereos)" — while claiming to describe
  // "the whole toybox roster". Measured, it named 13 of the 25 trick shapes the
  // roster actually carries: every enemy shipped since (the Junk Healer, the
  // Drip Slime, 🦆's zap resist, 🛢️'s oil, 🎇's death-jam, the Piñata's gold
  // burst) went unmentioned, and the boss kits never appeared at all. A prose
  // list of 25 shapes is unmaintainable by construction, so it is DERIVED into
  // two numbers instead, and the enumeration is delegated to the ONE surface
  // that already derives it — 📖 the Toybox Guide. The body count is the
  // costume fact this file just taught the guide: 35 toys wearing 56 names.
  UI.rosterBlurb = function () {
    const E = global.TDData.ENEMIES, L = global.TDLogic;
    const ids = Object.keys(E);
    const bodies = ids.filter((k) => !E[k].skinOf).length;
    const tricks = new Set();
    // the presentational trait keys are not TRICKS: "no tricks", where you meet
    // it, and the two costume lines.
    const NOT_A_TRICK = new Set(["plain", "home", "skin", "costumes", "boss"]);
    for (const k of ids) for (const t of L.enemyTraits(E[k])) if (!NOT_A_TRICK.has(t.key)) tricks.add(t.key);
    return bodies + " different toys wearing " + ids.length + " names, with " +
      tricks.size + " tricks between them (📖 the Guide explains every one)";
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
      // DERIVED from the data, never a written literal — this was three
      // hard-coded [id, name] pairs, which is both the "a list that outlives its
      // contents" shape (Kid Fort proved a mode and its button must not be able
      // to disagree) and a second owner for a string the pause menu and the
      // resume banner also want. The name lives on the difficulty itself now.
      const DIFFS = Object.keys(global.TDData.DIFFICULTIES || {});
      diffWrap.innerHTML = "";
      DIFFS.forEach(function (id) {
        const b = doc.createElement("button");
        b.type = "button";
        b.className = "td-diffbtn" + (id === selDiff ? " td-diffbtn--on" : "");
        b.dataset.diff = id;
        // Each ladder is an independent progression, and NOTHING said so: with 24
        // levels beaten on Normal, tapping Hard collapses the grid from 25
        // playable cards to 1, which reads as "my save is gone" rather than "this
        // is a different ladder". The count is what makes the collapse legible —
        // you can see Normal still holds 24/40 while you stand on Hard's 0/40.
        // Deliberately ALWAYS shown, unlike the meta row's badges: the message
        // here is the COMPARISON between the three, so hiding a zero would
        // destroy it, and on a fresh save three 0/40s teach the split at once.
        const beat = UI.ladderBeaten(save, id);
        b.textContent = "";
        b.appendChild(doc.createTextNode(UI.difficultyLabel(id)));
        const n = doc.createElement("span");
        n.className = "td-diffbtn__n";
        n.textContent = beat + "/" + global.TDData.LEVELS.length;
        b.appendChild(n);
        b.setAttribute("aria-label", UI.difficultyLabel(id) + " — " + beat +
          " of " + global.TDData.LEVELS.length + " levels beaten");
        b.setAttribute("aria-pressed", id === selDiff ? "true" : "false");
        b.addEventListener("click", function () {
          if (onSetDifficulty) onSetDifficulty(id);
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
    let nextCard = null;
    // The grid is 40 cards in a flat 3-wide run, separated only by a background
    // tint — so the ten worlds this game invests a whole floor, road, crowd and
    // boss in are unnamed on the one screen where you pick a level, and finding
    // a world to farm stars in is a scroll-and-squint. A heading whenever the
    // world CHANGES is derived end to end (the boundary from the levels' own
    // `world` field, the name from DATA.WORLDS, the count from the SELECTED
    // ladder), so an eleventh world needs no code here — the same law that keeps
    // the card count itself off a literal. The ⭐ x/y half is the actionable one:
    // stars are spendable power, so it says where there are still some to earn.
    let lastWorld = null;
    const worldHead = (w) => {
      const def = (global.TDData.WORLDS || {})[w];
      const mine = LEVELS.filter((l) => l.world === w);
      if (!def || !mine.length) return null;
      const got = mine.reduce((a, l) => a + starsOf(l.id), 0);
      const head = doc.createElement("div");
      head.className = "td-worldhead";
      head.dataset.world = w;
      const t = worldTint(w);
      if (t) head.style.borderColor = t.border;
      head.innerHTML = '<span class="td-worldhead__name">' + def.label + "</span>" +
        '<span class="td-worldhead__stars">⭐ ' + got + "/" + (mine.length * 3) + "</span>";
      return head;
    };

    for (let n = 1; n <= TOTAL_PLANNED; n++) {
      const def = LEVELS.find((l) => l.id === n);
      // Progression: L1 is always open; every later level unlocks once the
      // PREVIOUS one is beaten ON THIS DIFFICULTY (≥1 star on this ladder) —
      // so beating L1 opens L2, and so on, per ladder (PLAN §7 unlock rule).
      const unlocked = n === 1 || beatenOn(save, selDiff, n - 1);
      const playable = !!def && unlocked;
      const card = doc.createElement("button");
      card.type = "button";
      card.className = "td-level" + (playable ? "" : " td-level--locked");
      if (def && def.world) {
        card.dataset.world = def.world;
        const t = worldTint(def.world);   // DERIVED from the world's own floor
        if (t) { card.style.background = t.bg; card.style.borderColor = t.border; }
      }
      if (playable) {
        const stars = starsOf(n);
        const badge = Math.max(1, Math.min(3, def.badge || 1)); // difficulty 1-3
        const isBoss = def.waves.some((w) => w.boss);
        const pips = '<span class="td-level__badge td-badge--' + badge + '">' +
          "●".repeat(badge) + '<span class="td-level__dim">' + "●".repeat(3 - badge) + "</span></span>";
        // TD-18: the challenge chips WON on this level, stamped on its card —
        // icons resolved through the data so a retired chip id just drops out.
        const wonChips = ((save.chipsWon || {})[n] || [])
          .map((id) => (global.TDData.CHIPS || []).find((c) => c.id === id))
          .filter(Boolean);
        const chipTxt = wonChips.length
          ? '<span class="td-level__chips" title="challenges done here">' + wonChips.map((c) => c.icon).join("") + "</span>"
          : "";
        // TD: what this level DOES to you, derived from its own fields through
        // the same TDLogic.levelGimmicks the Toybox Guide reads — so a new
        // mechanic appears here the moment it exists, and a retired one drops
        // out. It belongs on the CARD because the loadout, the powers and the
        // chips are all chosen on this screen, BEFORE you enter: "this one is a
        // night level" is exactly the cue that says pack 🦉 Night Owl, and the
        // guide could only tell you after a cross-reference.
        //
        // It shares the NUMBER's row rather than adding one, because adding
        // content to this 40-card grid has broken a layout twice (it once
        // pushed every fort dialog below the fold, and it later broke the
        // contrast audit's opened-proof). A first cut put it in an absolutely
        // positioned corner, which measured free and then COLLIDED with the
        // level number at 320px on the two 3-gimmick levels — a flex row cannot
        // overlap, so the guarantee is structural rather than arithmetic.
        const tricks = global.TDLogic.levelGimmicks(def);   // `L` is scoped to the guide, not here
        const trickTxt = tricks.length
          ? '<span class="td-level__tricks" aria-label="' +
            tricks.map((g) => g.name).join(", ") + '">' +
            tricks.map((g) => g.icon).join("") + "</span>"
          : "";
        card.innerHTML =
          '<span class="td-level__top"><span class="td-level__n">' + n +
          (isBoss ? " 👑" : "") + "</span>" + trickTxt + "</span>" +
          '<span class="td-level__name">' + def.name + "</span>" +
          pips +
          '<span class="td-level__stars">' + "⭐".repeat(stars) + '<span class="td-level__dim">' + "⭐".repeat(Math.max(0, 3 - stars)) + "</span></span>" +
          chipTxt;
        // NAME IT. A button with no aria-label is announced as its concatenated
        // textContent, which here was "1🕳️Under the Bed●●●⭐⭐⭐🥵" — and that is
        // not merely unhelpful, it is WRONG: the unearned stars and the unearned
        // difficulty pips are DIM, not absent, so a 2-of-3 level announced
        // "star star star". The same defect the difficulty chips already had
        // (their two lines concatenated to "⚔️ Normal24/40") and the same fix.
        // Everything meaningful has to be in here, because an explicit label
        // REPLACES the content for assistive tech — so the tricks, the boss and
        // the chips are named in words, exactly as ▶ Next names them.
        card.setAttribute("aria-label", [
          "Level " + n + ", " + def.name,
          isBoss ? "boss finale" : "",
          tricks.length ? tricks.map((g) => g.name).join(", ") : "",
          "difficulty " + badge + " of 3",
          stars + " of 3 stars",
          wonChips.length ? "challenges done: " + wonChips.map((c) => c.name).join(", ") : "",
        ].filter(Boolean).join(". ") + ".");
        card.addEventListener("click", () => onPick(n));
      } else if (def && !unlocked) {
        // built, but still locked behind the previous level — tell the player why
        card.disabled = true;
        card.innerHTML = '<span class="td-level__n">' + n + "</span>" +
          '<span class="td-level__name">🔒</span>' +
          '<span class="td-level__stars td-level__need">win ' + (n - 1) + " ⭐</span>";
        // "9🔒win 8 ⭐" reads as "nine, locked, win eight star". Say the rule.
        card.setAttribute("aria-label",
          "Level " + n + ", locked. Win level " + (n - 1) + " to open it.");
      } else {
        card.disabled = true;
        card.innerHTML = '<span class="td-level__n">' + n + '</span><span class="td-level__name">🔒</span>';
        card.setAttribute("aria-label", "Level " + n + ", locked.");
      }
      // The card the player is most likely to want: the first PLAYABLE level not
      // yet beaten on THIS ladder. Tagged while the grid is built, because this
      // loop is the one place that already knows `playable` and `stars` — a
      // second computation of "which level is next" is how two owners drift.
      if (playable && starsOf(n) === 0 && !nextCard) nextCard = card;
      if (def && def.world && def.world !== lastWorld) {
        lastWorld = def.world;
        const head = worldHead(def.world);
        if (head) grid.appendChild(head);
      }
      grid.appendChild(card);
    }
    if (nextCard) nextCard.dataset.next = "1";
    UI.renderMetaCounts(save);
  };

  // Bring the next level to play into view. The fort home is 2001-2101px tall
  // and the route ends with scrollTo(0, 0), so the level you actually want is
  // BELOW the fold from level 13 onward and 1668px down by level 37 — and you
  // return to this screen after every single level, so the player who has
  // invested the most scrolls the furthest, every time. Measured at 390x844:
  // in view at 0 and 4 beaten, out of view at 12, 20, 28 and 36.
  //
  // Deliberately only when it is OUT of view: re-centring a card the player can
  // already see moves the page for nothing. And deliberately NOT called from the
  // difficulty chips, which sit at the top of this screen — yanking the grid
  // while a thumb is on a chip is the "never move the page under the thumb" rule.
  UI.focusNextLevel = function () {
    // A PARKED RUN outranks the next level. The Resume banner sits above the
    // grid, so scrolling down would push the one control the player almost
    // certainly wants off the top of the screen — a QoL change that quietly
    // buries a better affordance is not an improvement.
    const resume = doc.querySelector("#screen-td-home .td-resume");
    if (resume && !resume.hidden) return null;
    const card = doc.querySelector("#screen-td-home .td-level[data-next]");
    if (!card || !card.scrollIntoView) return null;
    const r = card.getBoundingClientRect();
    const vh = global.innerHeight || 0;
    if (r.top >= 0 && r.bottom <= vh) return null;         // already visible: leave the page alone
    // INSTANT, deliberately. This fires while the screen is being entered, before
    // the player has looked at it, so there is nothing for an animation to
    // explain — and the scroll can be 1051px, which as a smooth swoop is a long
    // distracting slide the player did not ask for. Landing already in the right
    // place is calmer, needs no prefers-reduced-motion gate, and is what makes
    // this observable to a test rather than a race against an animation.
    card.scrollIntoView({ block: "center", behavior: "auto" });
    return card;
  };

  // A live count on the fort-home meta buttons. The seven of them showed no
  // numbers at all, so "you have stars waiting to be spent" was invisible until
  // you opened the tree — and unspent stars are literally unused power in a
  // 40-node, 140⭐ tree. ONE owner, called from the home render AND from
  // showStarTree, because the tree's Done button only closes the overlay: with
  // no refresh there, spending six stars would leave the button still saying six,
  // which is the worst moment for it to be wrong.
  // Today's date, injected ONCE by td-main so the local-midnight rule that
  // decides "which daily is this" keeps a single owner instead of being
  // re-derived here. Absent (a bare UI test) → no daily badge, never a crash.
  UI.today = null;
  // The ONE owner of the meta row's badges. It marks only what a player can ACT
  // on: stars waiting to be spent, challenge chips armed for the next run, and a
  // daily that today has not touched. The other four buttons are deliberately
  // bare, and the reasons are recorded so nobody "completes the set": 🎒 Powers
  // is always slots-of-slots (activePowers never leaves a pack under-filled), 🏅
  // Badges are earned rather than spent, and ♾️ Endless / 📖 Guide carry no
  // per-visit state. A badge on those would be decoration, which this project
  // has deleted twice for being unfalsifiable.
  UI.renderMetaCounts = function (save) {
    const home = doc.querySelector("#screen-td-home");
    if (!home) return null;
    let first = null;
    const mark = (sel, count, label) => {
      const btn = home.querySelector(sel);
      if (!btn) return;
      const old = btn.querySelector(".td-metabtn__n");
      if (old) old.remove();
      btn.classList.remove("td-metabtn--n");
      btn.removeAttribute("aria-label");
      if (!count) return;                 // nothing to act on: no badge, no noise
      const n = doc.createElement("span");
      n.className = "td-metabtn__n";
      n.textContent = String(count);
      // The button's own text already says what it is; this is the count, so the
      // accessible name has to carry it too (a title is hover-only on a phone).
      btn.setAttribute("aria-label", label);
      btn.classList.add("td-metabtn--n");   // reserve the corner — see the CSS
      btn.appendChild(n);
      if (!first) first = n;
    };
    const avail = starTotals(save).avail;
    mark(".td-tree-open", avail, "Star Tree — " + avail + " star" + (avail === 1 ? "" : "s") + " to spend");
    // Resolved through the data, so a retired chip id simply drops out — the
    // same treatment the level cards' won-chip stamps already use.
    const armed = (save.chipsArmed || [])
      .filter((id) => (global.TDData.CHIPS || []).some((c) => c.id === id)).length;
    mark(".td-chips-open", armed,
      "Challenges — " + armed + " armed for your next run");
    // One puzzle per calendar day: an unplayed one is the whole reason to open
    // this, and once today's is recorded the badge goes away rather than nagging.
    const today = UI.today ? UI.today() : "";
    const fresh = today && (save.daily || {}).day !== today ? 1 : 0;
    mark(".td-daily-open", fresh, "Daily Toybox — today's is unplayed");
    return first;
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
    // How far in, and how much is LEFT. The banner named the level and the
    // rules and then said "wave 6" — with no total, so you could not tell a run
    // two waves from its finale from one barely started, and with no lives at
    // all, which is the fact that actually decides it: picking up a run parked
    // on 3 hearts is a different proposition from one parked on 20, and the
    // alternative (restart it) is one tap away on the grid. Both numbers were
    // already in the checkpoint and neither was shown. Same law as the ⬆
    // preview, the % road figure and the star goal — the information belongs at
    // the moment of the decision. `lives` is guarded because a hand-edited or
    // truncated 💾 Backup reaches here: a field one short must degrade.
    const label = UI.runLabel(mr.levelId, mr.endless, mr.daily,
      { difficulty: mr.difficulty, chips: mr.chips }) +
      " · " + UI.waveLabel(mr.levelId, mr.endless, mr.waveIdx) +
      (typeof mr.lives === "number" ? " · ❤️ " + mr.lives : "");
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
    // Each line names its role, and — MEASURED 2026-08 — so does each of its two
    // tier-4 BRANCHES, which had no explanation anywhere in the app. That was a
    // real trap rather than a gap: the panel advertises Sniper Scope at 47.3 dps
    // against the tier-3 dart's 34.3, and converting every dart to Sniper loses
    // L22/L26/L31 outright plus 5 of 9 boss finales, because 85 damage a shot is
    // overkill against 30 of the 42 non-boss bodies. DERIVED from the data, so a
    // ninth branch documents itself (guardrail-locked).
    const branchRow = (k) => Object.keys(T[k].branches || {}).map((bk) => {
      const b = T[k].branches[bk];
      return '<li class="td-guide__branch"><span class="td-guide__tico">✦</span><b>' + b.name + "</b> — " + b.role +
        " <i>(" + b.cost + "🪙)</i></li>";
    }).join("");
    const towerRow = Object.keys(T).map((k) =>
      '<li><span class="td-guide__tico">' + (LINE[k] || "•") + "</span><b>" + T[k].name + "</b> — " + (T[k].role || "") +
      (k === "mortar" || k === "camp" ? " <i>(cannot hit fliers)</i>" : "") + "</li>" + branchRow(k)).join("");
    // Abilities were explained NOWHERE — the button showed only an icon and a
    // price. They belong in the guide beside the towers.
    // Which powers are PACKED — read through the one owner in td-main (the same
    // list the engine is handed), so the guide can never disagree with the strip.
    const packed = new Set(UI._packedPowers ? UI._packedPowers() : (global.TDData.ABILITIES || []).map((a) => a.id));
    const abilRow = (global.TDData.ABILITIES || []).map((a) =>
      '<li><span class="td-guide__tico">' + a.icon + "</span><b>" + a.name + "</b> — " + a.role +
      ' <i>(' + a.gold + "🪙 · " + (a.charges === undefined ? 1 : a.charges) + "⚙️ · " + a.cooldown + "s · " +
      (a.kind === "tower" ? "tap a tower" : a.kind === "point" ? "tap the field" : "instant") +
      // …and HOW BIG. The row already stated what it costs, how often, and
      // where to tap — and left out the one number that decides WHERE: a 130🪙
      // blast you aim by eye is a guess. Only shown when the ability has a
      // radius, so an instant one does not grow a meaningless "0 cells".
      (a.radius ? " · " + a.radius + " cells wide" : "") +
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
      '<p class="td-overlay__sub" data-sec="🧸 Toys">What each toy does — and what can actually hit it.</p>' +
      '<ul class="td-guide__towers">' + towerRow + "</ul>" +
      // WHERE you build is worth as much as WHAT you build: a sweep of every pad
      // on a boss finale moved the result by up to 5 lives with the same tower
      // and the same branch, purely from which socket it stood on. Nothing said
      // so, and nothing could be read off the board. Hence the figure on every
      // build button and tower panel — and hence this paragraph, because a
      // number the player cannot interpret is the ⚙️ mistake again.
      '<p class="td-overlay__sub" data-sec="📍 Placement">Placement — <b>% road</b></p>' +
      '<ul class="td-guide__towers"><li><span class="td-guide__tico">🛣️</span>Every build button and tower panel says how much of the ' +
      "road that socket reaches. The same tower is worth several times more from one pad than another, so the figure — not the price — " +
      "is usually the choice. A 🪖 Army Guys camp shows none: it blocks the lane rather than shooting down it.</li>" +
      '<li><span class="td-guide__tico">✦</span>At tier 3 a branch card also shows the move, e.g. <i>road 12%→28%</i>. Some ultimates ' +
      "reach FURTHER and some reach LESS — a Minigun trades reach for rate — so check the arrow before spending.</li>" +
      '<li><span class="td-guide__tico">⬆</span>Below tier 3 the panel previews the upgrade on a green <i>→</i> line: the same figures ' +
      "the tower shows now, as they would be one tier up. Compare the two lines rather than the price.</li></ul>" +
      // Targeting was a cycle button with four words on it and no explanation
      // anywhere — and "first" vs "close" is genuinely ambiguous. It is also
      // NOT cosmetic: over the boss finales the best mode swings a level by
      // 4-9 lives and the winner differs per level, which is exactly the kind
      // of lever that is worthless if the player cannot read it. DERIVED from
      // DATA.TARGETING, so a sixth mode documents itself.
      '<p class="td-overlay__sub" data-sec="🎯 Aiming">Aiming — the 🎯 button</p>' +
      '<ul class="td-guide__towers"><li><span class="td-guide__tico">🎯</span>Every gun aims on its OWN setting; tap 🎯 on its panel to ' +
      "cycle. It is worth real lives — on a boss level the best setting can be several lives better than the worst, and which one wins " +
      "differs from level to level, so it is worth a try when a wave keeps getting through. Your last choice is remembered per " +
      "toy line, so the next one you build of that line opens already aimed that way.</li>" +
      Object.keys(global.TDData.TARGETING || {}).map(function (m) {
        const t = global.TDData.TARGETING[m];
        return '<li><span class="td-guide__tico">·</span><b>' + (t.name || m) + "</b> — " + t.desc + "</li>";
      }).join("") +
      "</ul>" +
      // Each power's cost line reads "130🪙 · 1⚙️", and ⚙️ was never DEFINED
      // anywhere in the app — the symbol appeared in the HUD, on every ability
      // button and here, and nothing said what it was. Numbers quoted from RULES
      // so they cannot drift from the engine.
      '<p class="td-overlay__sub" data-sec="🎒 Powers">Powers — usable during a wave only. Each costs gold 🪙 <b>and</b> ⚙️ Toy Energy: you get ' +
        global.TDData.RULES.chargePerWave + " more ⚙️ every wave you send, banked up to " +
        global.TDData.RULES.chargeMax + ". That is what stops late-game gold making the powers free. " +
        "The strip holds " + global.TDData.RULES.abilitySlots + " of the " + (global.TDData.ABILITIES || []).length +
        ", so 🎒 Powers on the fort home is where you choose which ones you bring. 🎒 marks what is packed. " +
        "Once your board is full and gold has nowhere left to go, <b>tap the ⚙️ in the top bar</b> to buy " +
        global.TDData.RULES.chargeBuyMax + " more energy for " + global.TDData.RULES.chargeBuyBase +
        "🪙 — once per wave, so an overflowing purse buys options, never a free win.</p>" +
      '<ul class="td-guide__towers td-guide__abils">' + abilRow + "</ul>" +
      // The wave button does two different jobs; say so, or ⏩ RUSH is a mystery.
      '<p class="td-overlay__sub" data-sec="▶ Waves">The wave button</p>' +
      '<ul class="td-guide__towers"><li><b>▶ CALL</b> — start the next wave early. The sooner you call, the more gold.</li>' +
      "<li><b>⏩ RUSH</b> — send the NEXT wave on top of the one already walking, for the same bonus. Up to " +
      (global.TDData.RULES.maxWavesInFlight || 2) + " waves at once. Big gold, big risk — and the " +
      "<b>Next:</b> strip over the field stays up whenever RUSH is on offer, so you can see what you would " +
      "be sending.</li></ul>" +
      '<p class="td-overlay__sub" data-sec="🕳️ Tricks">Level tricks — the board itself fights back.</p>' +
      '<ul class="td-guide__towers td-guide__gimmicks">' + gimRow + "</ul>" +
      // TD-18: a resource shipped without a name was this guide's founding
      // defect (⚙️), so the chips explain themselves here from their own data.
      '<p class="td-overlay__sub" data-sec="🎖️ Chips">🎖️ Challenges — arm a chip, win with it on, and it stamps that level’s card. ' +
      "A chip only ever takes a tool away, so it never makes a run easier — and every one is beatable " +
      "on every level (measured on casual with the tools that remain, not assumed).</p>" +
      '<ul class="td-guide__towers td-guide__chips">' +
      (global.TDData.CHIPS || []).map((c) =>
        '<li><span class="td-guide__tico">' + c.icon + "</span><b>" + c.name + "</b> — " + c.desc + "</li>").join("") +
      "</ul>" +
      '<p class="td-overlay__sub" data-sec="⭐ Tree">⭐ Star Tree — spend the stars you earn, then bring ' +
      (global.TDData.RULES.metaSlots || 6) + " into a run.</p>" +
      '<ul class="td-guide__towers td-guide__tree">' + treeRow + "</ul>" +
      // The roster is 77% of this dialog and had NO heading of its own, so the
      // guide's longest stretch was also its least navigable.
      '<p class="td-overlay__sub" data-sec="👾 Enemies">Every toy that comes for you.</p>' +
      '<div class="td-guide__list">' + order.map(card).join("") + "</div>" +
      '<button class="td-btn td-guide-done" type="button">Done</button>');
    el.querySelector(".td-guide-done").addEventListener("click", UI.closeOverlay);
    // CONTENTS. This dialog is 15,490px tall — 21 screens — and had no way to
    // jump at all: reaching the star-tree section meant scrolling 3,342px, and
    // the 56-enemy roster runs to the end. The row is DERIVED from the sections'
    // own `data-sec` labels, so a ninth section appears here the moment it is
    // written, and it is built AFTER render because it needs the real elements.
    const box = el.querySelector(".td-overlay__box");
    const secs = [...box.querySelectorAll("[data-sec]")];
    if (secs.length > 1) {
      const nav = doc.createElement("div");
      nav.className = "td-guide__toc";
      secs.forEach((sec, i) => {
        sec.id = "td-sec-" + i;
        const b = doc.createElement("button");
        b.type = "button";
        b.className = "td-guide__tocbtn";
        b.textContent = sec.dataset.sec;
        b.dataset.go = String(i);   // NOT data-sec: that is the SECTION's own marker
        b.addEventListener("click", () => {
          // scroll the BOX, not the page: the dialog is the scrollport, and
          // scrollIntoView on a sticky-headed box lands the heading under the
          // strip. Offset by the strip's own height.
          const top = sec.offsetTop - box.offsetTop -
            (box.querySelector(".td-overlay__top") || { offsetHeight: 0 }).offsetHeight;
          box.scrollTop = Math.max(0, top);
        });
        nav.appendChild(b);
      });
      const h3 = box.querySelector("h3");
      if (h3 && h3.nextSibling) box.insertBefore(nav, h3.nextSibling);
      else box.appendChild(nav);
    }
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
  // `note` is a short line that rides the STICKY strip beside the ✕, so it stays
  // on screen while the dialog scrolls. The star tree is why it exists: its
  // budget ("⭐ 14 to spend") was a big two-line block at the very top, which
  // scrolls away — so the number you are deciding against disappeared the moment
  // you started browsing the 40 nodes it applies to. Same law as the ⬆ preview
  // and the `% road` figure: the information belongs at the moment of the
  // decision. Always rendered (empty when absent) so the ✕ keeps its right edge.
  function metaOverlay(cls, html, note) {
    let el = doc.querySelector(".td-overlay");
    if (el) el.remove();
    el = doc.createElement("div");
    el.className = "td-overlay " + cls;
    // The ✕ rides in a full-width STRIP, not as a bare floating circle. As a
    // circle it was `position: sticky` over the box's right edge, so every line
    // that scrolled past it lost its right end — measured across the nine fort
    // dialogs, it covered real content in FIVE: a star-tree node's ⭐ cost (the
    // number you decide with), a badge's description, the endless blurb, the
    // reset dialog's own title, and 601px² of the guide. An opaque full-width
    // strip turns that into ordinary scrolling — content passes under a clean
    // horizontal edge — and costs no width, where reserving a right gutter
    // would take 52px of a 296px dialog.
    el.innerHTML = '<div class="td-overlay__box td-overlay__box--wide">' +
      '<div class="td-overlay__top">' +
      '<span class="td-overlay__note">' + (note || "") + "</span>" +
      '<button class="td-overlay__x" type="button" data-adult="1" aria-label="Close">✕</button>' +
      "</div>" +
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
    UI.renderMetaCounts(save);   // buying/refunding re-enters here, so the button behind the dialog stays true
    // The budget rides the STICKY strip instead of a big block at the top: it was
    // `.td-overlay__stars`, the VICTORY screen's display-size star row, so one
    // short fact took 68px across two lines — and then scrolled out of sight,
    // which is the half that mattered. Measured, the header ran to y=247 of a
    // 488px box at 320px, so HALF the dialog was header and 3 of 40 nodes were
    // visible.
    const el = metaOverlay("td-tree", '<h3>⭐ Star Tree</h3>' +
      '<p class="td-overlay__sub td-tree__slots">🎒 ' + equipped.length + " / " + SLOTS +
      " equipped — a run brings only what is packed, so the tree is a choice every battle.</p>" +
      branches +
      '<div class="td-overlay__row"><button class="td-btn td-tree-respec" type="button">↺ Refund all</button>' +
      '<button class="td-btn td-btn--call td-tree-done" type="button">Done</button></div>',
      '<b class="td-tree__avail">⭐ ' + t.avail + "</b> to spend · " + t.spent + " used");
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
      // A FULL pack refuses an un-packed power, and the refusal has to reach the
      // control the player actually aims at. The whole ROW is the target — 255px
      // against the ＋ button's 48 — and it was left enabled while only the ＋
      // carried `disabled`, so tapping the obvious thing did nothing at all and
      // said nothing about why. That is the fort's own "a control that can't be
      // used says why" law inverted: the tiny control showed the refusal and the
      // big one swallowed it. Both now carry the same state and the same reason.
      const refused = !on && eq.size >= SLOTS;
      const why = refused
        ? ' title="Pack is full — take one out first" disabled'
        : "";
      return '<div class="td-node-row">' +
        '<button class="td-node' + (on ? " td-node--on" : "") + '" data-power="' + a.id + '" type="button"' + why + ">" +
        '<span class="td-node__icon">' + a.icon + "</span>" +
        '<span class="td-node__body"><span class="td-node__name">' + a.name + "</span>" +
        '<span class="td-node__desc">' + a.role + "</span></span>" +
        // …and HOW OFTEN it comes back. The pack is a trade of 4 for 5, and the
        // cooldown is most of what separates them (20s to 30s across the pool) —
        // it was stated in the 📖 Guide and NOT on the screen where the choice is
        // made, which is the same "the information belongs at the moment of the
        // decision" law as the ⬆ upgrade preview and the % road figure. It takes
        // its own LINE rather than joining the nowrap cost run, because that cell
        // is the documented iOS-wider-emoji spill risk and a second line costs no
        // width at all.
        '<span class="td-node__cost">' + a.gold + "🪙 ·" + (a.charges === undefined ? 1 : a.charges) + "⚙️" +
        '<span class="td-node__cd">every ' + a.cooldown + 's</span></span></button>' +
        '<button class="td-node__equip' + (on ? " td-node__equip--on" : "") + '" type="button"' + why +
        ' data-equippow="' + a.id + '" aria-label="' + (on ? "Leave behind " : refused ? "Pack is full, take one out first — " : "Pack ") + a.name + '">' + (on ? "🎒" : "＋") + "</button></div>";
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

  // TD-18 Daily Toybox: today's board, said out loud before you commit — which
  // arena, which chip (if any), and both bests. The pick itself is computed in
  // td-main (it owns the calendar); this overlay just states it.
  UI.showDaily = function (pick, save, onPlay) {
    const arena = (global.TDData.ENDLESS.worlds[pick.world] || {}).label || pick.world;
    const chip = pick.chip ? (global.TDData.CHIPS || []).find((c) => c.id === pick.chip) : null;
    const d = save.daily || { day: "", best: 0, allTime: 0 };
    const today = d.day === pick.day ? (d.best | 0) : 0;
    metaOverlay("td-daily", "<h3>📅 Daily Toybox</h3>" +
      '<p class="td-overlay__sub">One endless board a day — same seed all day, so every attempt is the ' +
      "same puzzle and your best is a fair best. It rolls over at midnight.</p>" +
      '<div class="td-daily__card">' +
        '<p class="td-daily__arena">' + arena + "</p>" +
        '<p class="td-daily__mod">' + (chip ? chip.icon + " " + chip.name + " — " + chip.desc : "🙂 No twist today — full toybox") + "</p>" +
        '<p class="td-daily__best">Today’s best: <b>wave ' + today + "</b> · All-time daily best: <b>wave " + (d.allTime | 0) + "</b></p>" +
      "</div>" +
      '<div class="td-overlay__row">' +
        '<button class="td-btn td-btn--call td-daily-play" type="button">▶ Play today’s board</button>' +
        '<button class="td-btn td-daily-done" type="button">Done</button>' +
      "</div>").querySelectorAll(".td-daily-play, .td-daily-done").forEach((b) =>
        b.addEventListener("click", () => { UI.closeOverlay(); if (b.classList.contains("td-daily-play")) onPlay(); }));
  };

  // TD-18 Challenge chips: arm opt-in constraints for the next run. Same shape
  // as the Powers pack on purpose (one toggle affordance, one rebuild pattern).
  // With the shipped set every COMBINATION is playable — the three line bans
  // together leave the dart, which is the measured dart-mono arm, and Quiet
  // Hands removes nothing the oracle uses — but if a future chip ever bans the
  // DART, this picker needs a guard against arming all four lines at once.
  UI.showChips = function (save, onChange) {
    const pool = global.TDData.CHIPS || [];
    const real = new Set(pool.map((c) => c.id));
    const armed = new Set((save.chipsArmed || []).filter((id) => real.has(id)));
    // how many level-cards each chip is stamped on — the collection readout
    const wonCount = (id) => {
      let n = 0;
      const w = save.chipsWon || {};
      for (const k in w) if (Array.isArray(w[k]) && w[k].indexOf(id) >= 0) n++;
      return n;
    };
    const total = global.TDData.LEVELS.length;
    const rows = pool.map((c) => {
      const on = armed.has(c.id);
      return '<div class="td-node-row">' +
        '<button class="td-node' + (on ? " td-node--on" : "") + '" data-chip="' + c.id + '" type="button">' +
        '<span class="td-node__icon">' + c.icon + "</span>" +
        '<span class="td-node__body"><span class="td-node__name">' + c.name + "</span>" +
        '<span class="td-node__desc">' + c.desc + "</span></span>" +
        '<span class="td-node__cost">' + wonCount(c.id) + "/" + total + "</span></button>" +
        '<button class="td-node__equip' + (on ? " td-node__equip--on" : "") + '" type="button"' +
        ' data-armchip="' + c.id + '" aria-label="' + (on ? "Disarm " : "Arm ") + c.name + '">' + (on ? "🎖️" : "＋") + "</button></div>";
    }).join("");
    const el = metaOverlay("td-chips", "<h3>🎖️ Challenges</h3>" +
      // Copy is for the PLAYER, not for the next engineer. The first cut ended
      // "(on casual at least — that was measured, not hoped)", which is a note to
      // a colleague about how the chips were verified; a screenshot pass caught
      // it. Say what the chip does and what it is worth; keep the methodology in
      // the commit message and CLAUDE.md, where it belongs.
      '<p class="td-overlay__sub">Arm a chip, then WIN a level with it still on — it stamps that level’s card. ' +
      "A chip only ever takes a tool away, so it never makes a run easier — and every one of them can be " +
      "beaten on every level.</p>" +
      '<div class="td-nodes">' + rows + "</div>" +
      '<div class="td-overlay__row"><button class="td-btn td-btn--call td-chips-done" type="button">Done</button></div>');
    const toggle = (id) => {
      if (armed.has(id)) armed.delete(id); else armed.add(id);
      onChange([...armed]);
      UI.showChips(save, onChange);
    };
    el.querySelectorAll("[data-chip]").forEach((b) => b.addEventListener("click", () => toggle(b.dataset.chip)));
    el.querySelectorAll("[data-armchip]").forEach((b) => b.addEventListener("click", (ev) => { ev.stopPropagation(); toggle(b.dataset.armchip); }));
    el.querySelector(".td-chips-done").addEventListener("click", UI.closeOverlay);
  };

  // Badges: the 12-achievement grid, earned lit + named, locked dimmed.
  UI.showAchievements = function (save) {
    const got = new Set(save.ach || []);
    // The star thresholds are DERIVED from the shipped level count, exactly like
    // the code that awards them — a literal "18" / "36" in the data went stale
    // the moment World 4 raised the ceiling to 48.
    const cap = global.TDData.LEVELS.length * 3;
    const starDesc = { starcollector: "Earn " + Math.round(cap / 2) + " stars", fullfort: "Earn all " + cap + " stars" };
    // HOW CLOSE AM I? Three of the badges have a COUNTABLE target and the grid
    // showed a player at 58 of 60 stars exactly what it showed one at 3 — the
    // same law as the victory screen's star goal and the ⬆ preview: a number you
    // are being scored on should be visible rather than inferred. The
    // DENOMINATORS are the award site's own thresholds, derived from the shipped
    // level count, so the readout cannot promise a bar the code does not use.
    // Only while UNEARNED: once you have it the count is noise, which is the
    // same signal-not-decoration rule the meta-row badges follow.
    const earnedStars = starTotals(save).earned;
    const bestWave = Math.max(0, ...Object.values(save.endlessBest || {}).map((v) => v | 0));
    const marathonAt = 20;                       // the bar earnAch("marathoner") uses
    const progress = {
      starcollector: [earnedStars, Math.round(cap / 2)],
      fullfort: [earnedStars, cap],
      // only once there IS an endless run to measure — "0 of 20" before you have
      // ever opened an arena is a bar, not progress.
      marathoner: bestWave > 0 ? [bestWave, marathonAt] : null,
    };
    const cells = ACHS().map((a) => {
      const has = got.has(a.id);
      const p = !has && progress[a.id];
      // A GHOST of the badge you will win, not a padlock. 16 of the 19 cells wore
      // the identical 🔒, so the grid showed no hint of what any of them IS until
      // you had it — the same defect Josh's Sticker Book already fixed ("170 of
      // 200 slots were the identical ❓"), never carried across to the fort. The
      // earned state is still unmistakable without the lock (gold border, green
      // fill), and OPACITY does the dimming: a CSS `filter` on art rendered in
      // bulk is this project's documented WebKit rasterization cliff.
      //   …and because the lock was also the only thing SAYING "locked", the
      // card gets an explicit accessible name — dropping a glyph that carried
      // meaning without replacing it is how the level cards' own label went
      // wrong, one screen over.
      return '<div class="td-ach' + (has ? " td-ach--on" : "") + '" aria-label="' +
        a.name + (has ? ", earned" : ", locked") + ". " + (starDesc[a.id] || a.desc) + '">' +
        '<span class="td-ach__icon' + (has ? "" : " td-ach__icon--ghost") + '">' + a.icon + "</span>" +
        '<span class="td-ach__name">' + a.name + "</span>" +
        '<span class="td-ach__desc">' + (starDesc[a.id] || a.desc) +
        // no new colour: it inherits the description's, so it adds no AA risk to
        // an overlay the contrast audit already walks. The class is the test's
        // handle, nothing more.
        (p ? ' · <b class="td-ach__prog">' + p[0] + "/" + p[1] + "</b>" : "") +
        "</span></div>";
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
    // …and ORDERED by the campaign, not by the order somebody typed the keys of
    // a second literal. Those two had drifted: 📦 Moving Day was declared above
    // 🔧 Garage, so world 6 listed above world 5 and an UNLOCKED arena sat below
    // a locked one — on the screen whose whole job is showing what is open.
    // TDLogic.byWorldOrder is the ONE owner (it keeps an unknown world at the
    // end rather than dropping it, because an unreachable arena is exactly the
    // defect the comment above records).
    const W = global.TDData.ENDLESS.worlds;
    const worlds = global.TDLogic.byWorldOrder(Object.keys(W)).map((w) => [w, W[w].label || w]);
    const best = save.endlessBest || {};
    const rows = worlds.map(([w, label]) => {
      const open = UI.endlessUnlocked(save, w);
      // the lock hint counts the world's ACTUAL levels — "the 4 levels" was a
      // literal that happened to be right for four worlds of four
      const n = worldLevels(w).length;
      // "3⭐ the 4 levels" had no verb, and a best score read as a bare "🏆 12" —
      // 12 of WHAT. The unit was already written, in a variable this function
      // computed and then never used; that dead line is what named the fix.
      const state = open
        ? (best[w] ? "🏆 wave " + best[w] : "new!")
        : "🔒 3⭐ all " + n + " levels";
      return '<button class="td-endless' + (open ? "" : " td-endless--locked") + '"' + (open ? "" : " disabled") +
        ' data-world="' + w + '">' + label + '<span class="td-endless__best">' + state + "</span></button>";
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
  // An outcome (or any) overlay drops the scrim over the whole screen, and the
  // toast paints UNDER it by design — so a toast still alive when a dialog opens
  // becomes a dimmed ghost at the bottom of the picture. It has already had its
  // moment; take it away rather than leaving it to be half-read.
  UI.clearToasts = function () {
    for (const t of doc.querySelectorAll(".td-toast")) t.remove();
  };
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
      // Write the COUNT into its own span. This used to be
      // `charge.textContent = ...`, which is why the price could only ever live
      // in the title: a whole-node write erases any child you add.
      const nEl = charge.querySelector(".td-hud__chargeN");
      if (nEl) nEl.textContent = "⚙️ " + (state.charge || 0);
      else charge.textContent = "⚙️ " + (state.charge || 0);
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
      // THE PRICE, ON THE BUTTON. Shown whenever a purchase is a thing that
      // could happen — including when it is refused for GOLD, which is exactly
      // the moment you want the number. Hidden only when there is no purchase to
      // price at all (bank full, or already bought this wave), so the readout
      // never shows a cost for something you cannot buy at any price.
      const buyEl = charge.querySelector(".td-hud__chargeBuy");
      if (buyEl) {
        const priceable = price > 0 && (r.ok || r.reason === "gold" || r.reason === "not-in-wave");
        buyEl.hidden = !priceable;
        buyEl.textContent = priceable ? price + "🪙" : "";
      }
      charge.disabled = !r.ok;
      charge.classList.toggle("is-buyable", !!r.ok);
      charge.title = why;
      charge.setAttribute("aria-label", (state.charge || 0) + " toy energy. " + why);
    }
    const level = global.TDData.LEVELS.find((l) => l.id === state.levelId);
    const endless = state.endless || !level; // endless runs aren't in DATA.LEVELS
    const total = level ? level.waves.length : 0;
    if (wave) wave.textContent = UI.waveLabel(state.levelId, state.endless, state.waveIdx, state.sentIdx);
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
        label.textContent = "▶ CALL";
        // The figure comes from the engine or it is not shown. This fallback
        // used to re-derive it from RULES.earlyCallRate, which ⏩ Early Bird
        // multiplies by 1.5 — so whenever it was reached it UNDERSTATED an
        // owning run by a third, the quiet half of this class: an overcharge
        // gets reported, being handed more than the label promised never is.
        // If the engine has not spoken yet, show the clock, not a guess.
        meta.textContent = !ok ? "" : info ? "+" + info.bonus + "🪙 · " + secs + "s" : secs + "s";
      } else if (!over) {
        label.textContent = "⏩ RUSH";
        // HOW MUCH OF THIS WAVE IS LEFT. The build phase has a countdown and the
        // wave phase had nothing at all, so the most-asked in-wave question —
        // "am I nearly through this, or do I hold my gold?" — was unanswerable,
        // and it is exactly the question ⏩ RUSH is a bet against. It rides this
        // meta line because the line ALREADY carries a "· "-joined pair during
        // build (bonus · seconds), so the widest string this button ever renders
        // is one that already ships: no new element, and none of the HUD reflow
        // risk that once had the ⚙️ hopping between rows. Most of a fresh wave is
        // still QUEUED rather than on screen, which is the half you cannot see.
        const eng2 = hudEngine && hudEngine();
        const left = eng2 && eng2.bodiesLeft ? eng2.bodiesLeft() : null;
        const why = ok ? "+" + info.bonus + "🪙"
          : info.reason === "too-soon" ? "steady…"
            : info.reason === "too-many-waves" ? info.max + " waves out"
              : "last wave";
        meta.textContent = left == null ? why : why + " · " + left + " left";
      }
    }
    // Next-wave preview: during the build phase, show WHAT is coming (enemy icons
    // + counts) so the player can plan their build — a premium-TD staple.
    const nw = q(".td-nextwave");
    if (nw) {
      // What's coming is the next UNSENT wave (sentIdx), which equals waveIdx at
      // every build boundary but not while a rushed wave is still walking.
      const nextIdx = state.sentIdx == null ? state.waveIdx : state.sentIdx;
      // Show it exactly when the next wave IS a decision. It used to be
      // build-phase only — then TD-15 made CALL work mid-wave as ⏩ RUSH, which
      // drops that next wave on top of the one already walking for the same
      // early-call gold, and the preview was never revisited. So the one
      // decision whose entire cost/benefit is "what is in the next wave" was
      // made with the thing that says so switched off. It reads `ok` off the
      // SAME callInfo the button reads, so the pill and the button can never
      // disagree, and it hides again the moment RUSH is refused (steady… / N
      // waves out / last wave) rather than becoming permanent furniture over
      // the spawn end of the field.
      const rush = UI._callInfo ? UI._callInfo() : null;
      const rushable = state.phase !== "build" && !!(rush && rush.ok);
      if (!endless && (state.phase === "build" || rushable) && nextIdx < total) {
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
        const txt = (scouting ? "Next 2: " : "Next: ") + parts.join("  ") + (flank ? "   🚪" + flank : "");
        // Re-anchor on the TEXT, the LEVEL and the canvas WIDTH together. Keying
        // on the text alone was a real staleness bug, found by a probe
        // disagreeing with its own prediction: two levels whose wave-1 preview
        // reads the same leave the previous level's corner in place, and a
        // rotation moves every lane without changing a character.
        const key = state.levelId + ":" + (UI.canvas ? UI.canvas.clientWidth : 0) + ":" + txt;
        const fresh = nw.dataset.anchorKey !== key || nw.hidden;
        nw.dataset.anchorKey = key;
        nw.textContent = txt;
        nw.hidden = false;
        // Pick the corner that sits CLEAREST of the lanes. Measured across all 40
        // maps, the fixed centre anchor lands on a lane's first cells on 10 of
        // them — harmless while this only showed during BUILD (an empty road) and
        // a real cost now that it stays up through a wave, with bodies walking
        // underneath it. Best-of-three clears 39; L7's lane spans the whole band
        // at this height, so it keeps the centre and is no worse than before.
        // Recomputed only when the TEXT changes (a wave boundary), never per
        // frame — it costs one layout read.
        if (fresh) UI.anchorPreview(nw);
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
  // Choose the pill's horizontal anchor: whichever of left / centre / right keeps
  // the most distance from every lane point in the pill's own horizontal band.
  // Ties and hopeless maps fall back to the centre, so this can never be WORSE
  // than the fixed anchor it replaces.
  UI.anchorPreview = function (nw) {
    nw.classList.remove("td-nextwave--left", "td-nextwave--right");
    const pts = UI._lanePts ? UI._lanePts() : [];
    const cv = UI.canvas;
    if (!pts.length || !cv || !cv.clientWidth) return "center";
    const w = nw.offsetWidth, cw = cv.clientWidth;
    if (!w || w >= cw - 16) return "center";
    const top = nw.offsetTop, bot = top + nw.offsetHeight;
    const band = pts.filter((q) => q.y >= top - 14 && q.y <= bot + 14);
    if (!band.length) return "center";
    const spans = { left: [8, 8 + w], center: [(cw - w) / 2, (cw + w) / 2], right: [cw - w - 8, cw - 8] };
    let best = "center", bestGap = -1;
    for (const k of ["center", "left", "right"]) {
      const [a, b] = spans[k];
      let gap = Infinity;
      for (const q of band) gap = Math.min(gap, Math.max(a - q.x, 0, q.x - b));
      if (gap > bestGap) { bestGap = gap; best = k; }
    }
    if (best !== "center") nw.classList.add("td-nextwave--" + best);
    return best;
  };

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
    UI.clearToasts();   // a toast under the scrim is a dimmed ghost — see clearToasts
    el = doc.createElement("div");
    el.className = "td-overlay " + cls;
    el.innerHTML = '<div class="td-overlay__box">' + html + "</div>";
    const host = hostScreen();
    if (host) host.appendChild(el);
    return el;
  }
  UI.closeOverlay = function () { const el = doc.querySelector(".td-overlay"); if (el) el.remove(); };

  // ONE owner of "what is this run called". Nothing in a live battle said which
  // level you were on — not the HUD, not the pause menu — so a resumed or
  // returned-to run had no answer short of quitting to the fort. The resume
  // banner already built this sentence inline; a second copy in the pause menu
  // is exactly how two owners drift, so both read this.
  // The ONE reader of a difficulty's player-facing name. Falls back to the id so
  // a tier added without a label degrades to something readable rather than
  // rendering "undefined" — a field one short must degrade, not disable.
  // ONE owner of "how far into this run are we". The HUD held the only copy —
  // including the load-bearing `endless || !level` predicate, which is the thing
  // that stops it throwing every frame on an id like "endless-bedroom" that is
  // not in DATA.LEVELS — and the resume banner had quietly grown a second,
  // poorer one beside it (`"wave " + (waveIdx + 1)`: no total, and no endless
  // branch to get wrong only because it never showed one). Two formatters for
  // one fact is how the sell refund and the ⚙️ price drifted from the engine.
  // `sentIdx` is optional: a checkpoint is written at a wave BOUNDARY, where it
  // always equals waveIdx, so the banner simply has no span to name.
  UI.waveLabel = function (levelId, endless, waveIdx, sentIdx) {
    const level = global.TDData.LEVELS.find((l) => l.id === levelId);
    const inf = endless || !level;                 // endless runs aren't in DATA.LEVELS
    const total = level ? level.waves.length : 0;
    const sent = sentIdx == null ? waveIdx : sentIdx;
    // The wave you're facing or about to face (1-based) — never the old "0/6".
    // With a RUSHED wave, TWO are walking at once, so name both: "wave 3-4/12".
    const first = Math.min(waveIdx + 1, inf ? Infinity : total);
    const last = Math.min(Math.max(sent, waveIdx + 1), inf ? Infinity : total);
    const span = last > first ? first + "-" + last : String(first);
    return "wave " + span + (inf ? " ♾️" : "/" + total);
  };
  UI.difficultyLabel = function (id) {
    const d = (global.TDData.DIFFICULTIES || {})[id];
    return (d && d.label) || String(id || "");
  };
  // What RULES is this run under? The label is shared by the pause menu and the
  // RESUME BANNER, and deciding whether to pick a parked run back up without
  // knowing which ladder it is on — or that you armed ⛺ Camp's Closed — is a
  // decision made blind. `rules` is read off the RUN (state.difficulty /
  // state.chips, or the checkpoint's own copies), never off the save: a ladder
  // switched or a chip re-armed while a run is parked must not retroactively
  // relabel the run being restored (the checkpoint-fidelity law).
  UI.runLabel = function (levelId, endless, daily, rules) {
    const r = rules || {};
    const chips = (r.chips || []).map((id) => ((global.TDData.CHIPS || []).find((c) => c.id === id) || {}).icon)
      .filter(Boolean).join("");
    const extra = (r.difficulty ? " · " + UI.difficultyLabel(r.difficulty) : "") + (chips ? " · " + chips : "");
    if (daily) return "📅 Daily Toybox" + extra;
    const lvl = global.TDData.LEVELS.find((l) => l.id === levelId);
    // `endless || !lvl` is the same predicate UI.hud uses, and it is load-bearing:
    // an endless id is a STRING like "endless-bedroom" that is NOT in
    // DATA.LEVELS, the documented trap that had the HUD throwing every frame.
    if (endless || !lvl) {
      const w = String(levelId || "").replace(/^endless-/, "");
      const meta = (global.TDData.ENDLESS && global.TDData.ENDLESS.worlds[w]) || null;
      return "♾️ Endless" + (meta && meta.label ? " · " + meta.label : "") + extra;
    }
    return "Level " + lvl.id + " · " + lvl.name + extra;
  };

  UI.showPause = function (hooks, settings, label) {
    const el = overlay("td-overlay--pause",
      '<h3>Paused</h3>' +
      (label ? '<p class="td-overlay__sub td-pause__where">' + label + "</p>" : "") +
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

  // Badges earned AT an outcome are rendered inside that outcome's box — the
  // toast is deliberately painted under the overlay so it can never cover these
  // buttons, which meant the announcement was arriving dimmed behind the scrim.
  // Reuses .td-sum__line, a pairing the fort's contrast audit already walks.
  function earnedHtml(earned) {
    if (!earned || !earned.length) return "";
    // The message is wrapped in its OWN span rather than left as a bare text
    // node: this line is a flex container, and a flex container turns each child
    // into an item and TRIMS the whitespace at their boundaries — so
    // "<b>Badge earned!</b> Doorman" rendered as "Badge earned!Doorman" while
    // textContent still reported the space. Only looking at the picture (or
    // measuring the gap) catches that; a text assertion cannot.
    return '<div class="td-earned">' + earned.map((e) =>
      '<p class="td-sum__line td-earned__line"><span class="td-earned__icon">' + e.icon + "</span>" +
      '<span class="td-earned__txt">' + e.html.replace(/<br>/g, " ") + "</span></p>").join("") + "</div>";
  }

  UI.showVictory = function (stars, lives, maxLives, goal, hooks, rs, earned) {
    const hasNext = !!hooks.nextLevel;
    // ▶ Next skips the fort home entirely — which is the ONE screen where the
    // ⭐ loadout, the 🎒 powers and the 🎖️ chips are chosen, and where a level
    // card states what the level DOES to you. So the fastest path into a level
    // was also the only one that told you nothing about it: you went straight
    // into a night level, a fork or a boss finale blind, with no cue to go back
    // and pack 🦉 Night Owl. It carries the SAME derived trick strip the card
    // does (TDLogic.levelGimmicks + the level's own boss flag), so an eleventh
    // gimmick turns up here for free. Icons on the button, WORDS in the label —
    // an icon strip is opaque to a screen reader.
    const nx = hasNext ? (global.TDData.LEVELS.find((l) => l.id === hooks.nextLevel) || null) : null;
    const nxTricks = nx ? global.TDLogic.levelGimmicks(nx) : [];
    const nxBoss = nx && nx.waves.some((w) => w.boss);
    const nxText = nx ? "▶ Next: " + nx.id + " · " + nx.name + (nxBoss ? " 👑" : "") +
      (nxTricks.length ? " " + nxTricks.map((g) => g.icon).join("") : "") : "▶ Next level";
    const nxAria = nx ? "Next level: " + nx.id + ", " + nx.name +
      (nxBoss ? ", boss finale" : "") +
      (nxTricks.length ? ", " + nxTricks.map((g) => g.name).join(", ") : "") : "Next level";
    const el = overlay("td-overlay--win",
      '<h3>Fort defended! 🎉</h3>' +
      '<p class="td-overlay__stars">' + "⭐".repeat(stars) + '<span class="td-level__dim">' + "⭐".repeat(3 - stars) + "</span></p>" +
      "<p>" + lives + " of " + maxLives + " stickers kept safe</p>" +
      // …and what the next star would have taken. Nothing in the fort has ever
      // named these thresholds, so a 2-star finish gave you no idea what the
      // bar was. Absent at 3 stars, where there is nothing left to say.
      // Styled with the summary's existing dim line rather than a new class:
      // it is informational and must not compete with the stars, and reusing an
      // already contrast-audited colour adds no new AA risk to this overlay.
      // The second class is only the test's handle.
      (goal ? '<p class="td-sum__line td-overlay__goal">' + (goal.need - lives) + " more for "
        + "⭐".repeat(goal.stars) + "</p>" : "") +
      summaryHtml(rs) +
      earnedHtml(earned) +
      // Only claim an unlock that ACTUALLY just happened. This was gated on
      // `hasNext` — "does a next level exist" — so replaying a level you beat
      // long ago announced "🔓 Level 24 unlocked!" every single time.
      (hasNext && hooks.nextIsNew ? '<p class="td-overlay__warn">🔓 Level ' + hooks.nextLevel + ' unlocked!</p>' : "") +
      (hasNext ? '<button class="td-btn td-btn--call" data-act="next" type="button" aria-label="' + nxAria + '">' + nxText + "</button>" : "") +
      '<button class="td-btn" data-act="continue" type="button">' + (hasNext ? "🏰 Back to the fort" : "Continue") + "</button>");
    el.addEventListener("click", (ev) => {
      const act = ev.target && ev.target.dataset && ev.target.dataset.act;
      if (act === "continue") hooks.continueOn();
      else if (act === "next" && hooks.onNext) hooks.onNext();
    });
  };

  UI.showDefeat = function (hooks, endless, pm, rs, earned) {
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
          // A flank is its own diagnosis, and it is ADDITIVE rather than
          // instead of: the wave can both come in behind you AND carry
          // something your board could not answer.
          (pm.flank ? '<p class="td-pm__advice">🚪 ' + pm.flank +
            " of that wave came in through the side door, behind your guns — cover it next time.</p>" : "") +
          '<button class="td-btn td-pm__guide" type="button" data-act="guide">📖 See the guide</button>' +
        "</div>" : "") + summaryHtml(rs) + earnedHtml(earned);
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
