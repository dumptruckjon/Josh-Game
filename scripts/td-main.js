// Fort Josh: Toybox Defense — glue (TD-1): routing + save + game loop + input
// + sfx + the __TD debug/test hooks (the real-time analog of data-correct).
// Exposes window.JonTD, which scripts/main.js routes td-* hashes through.

(function (global) {
  const doc = global.document;
  if (!doc) return;
  const DATA = global.TDData, TD = global.TDLogic, UI = global.TDUI, R = global.TDRender;
  if (!DATA || !TD || !UI || !R) return;
  const A = global.JoshAudio || { tone() {}, isMuted: () => true, winCue() {} };

  const SAVE_KEY = "jon-td-save-v1";
  const DT_MS = 1000 / DATA.TICK_RATE;

  // ---- Save (jon-td-* namespace ONLY — never the kid star flags; survives Josh's reset) ----
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) { const s = JSON.parse(raw); if (s && s.v === 1) return s; }
    } catch (e) { /* private mode → session-only play */ }
    return { v: 1, stars: {}, settings: { sfx: true } };
  }
  function persist(save, opts) {
    try {
      // AUDIT: two fort tabs used whole-blob last-writer-wins, silently wiping
      // stars/achievements earned in the other tab. Fold the stored copy's
      // MONOTONIC fields in before writing: stars/endlessBest per-key max, ach
      // union. meta is NOT merged (a respec legitimately REMOVES nodes) and
      // settings/difficulty/midRun stay last-writer-wins. A deliberate reset
      // passes {force:true} to skip the merge — otherwise it could never clear.
      if (!(opts && opts.force)) {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
          const other = JSON.parse(raw);
          if (other && other.v === 1) {
            if (other.stars && typeof other.stars === "object") {
              // per-difficulty per-level max; a legacy FLAT map written by an
              // old-version tab folds into the normal ladder (the boot rule)
              if (!save.stars || typeof save.stars !== "object") save.stars = {};
              for (const d of ["casual", "normal", "heroic"]) {
                const theirs = other.stars[d];
                if (!theirs || typeof theirs !== "object") continue;
                const mine = save.stars[d] = (save.stars[d] && typeof save.stars[d] === "object") ? save.stars[d] : {};
                for (const k in theirs) mine[k] = Math.max(mine[k] | 0, theirs[k] | 0);
              }
              for (const k in other.stars) {
                if (!/^\d+$/.test(k)) continue;
                const mine = save.stars.normal = save.stars.normal || {};
                mine[k] = Math.max(mine[k] | 0, other.stars[k] | 0);
              }
            }
            if (Array.isArray(other.ach)) save.ach = [...new Set([...(save.ach || []), ...other.ach])];
            if (other.bests && typeof other.bests === "object") {
              // a personal best only ever goes UP, so it folds like stars
              save.bests = save.bests || {};
              for (const k in other.bests) {
                const mine = save.bests[k], theirs = other.bests[k];
                if (!theirs) continue;
                if (!mine || (theirs.lives | 0) > (mine.lives | 0)) save.bests[k] = theirs;
              }
            }
            if (other.endlessBest && typeof other.endlessBest === "object") {
              save.endlessBest = save.endlessBest || {};
              for (const w in other.endlessBest) save.endlessBest[w] = Math.max(save.endlessBest[w] || 0, other.endlessBest[w] || 0);
            }
          }
        }
      }
    } catch (e) { /* merge is best-effort; the write below is what matters */ }
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
  }
  let save = load();
  // Stars are PER-DIFFICULTY ladders (user request 2026-07): each difficulty is
  // its own independent progression. Shape: { casual: {lvl:⭐}, normal: {…},
  // heroic: {…} }. A legacy flat {lvl:⭐} map (pre-split saves) migrates into
  // "normal" (the shipped default), losing nothing; corrupt values reset.
  if (!save.stars || typeof save.stars !== "object") save.stars = {}; // never let a win crash on save.stars[key]
  if (!save.stars.casual && !save.stars.normal && !save.stars.heroic) {
    const legacy = save.stars;
    save.stars = { casual: {}, normal: {}, heroic: {} };
    for (const k in legacy) { const v = legacy[k] | 0; if (v > 0 && /^\d+$/.test(k)) save.stars.normal[k] = Math.min(3, v); }
  } else {
    for (const d of ["casual", "normal", "heroic"]) if (!save.stars[d] || typeof save.stars[d] !== "object") save.stars[d] = {};
  }
  if (!save.difficulty || !DATA.DIFFICULTIES[save.difficulty]) save.difficulty = "normal";
  if (!save.settings) save.settings = { sfx: true };
  if (typeof save.settings.dmgNumbers !== "boolean") save.settings.dmgNumbers = false; // TD-6 opt-in
  if (typeof save.settings.music !== "boolean") save.settings.music = false;            // TD-6 opt-in, off by default
  if (!Array.isArray(save.meta)) save.meta = [];   // TD-5 star-tree nodes owned
  if (!Array.isArray(save.ach)) save.ach = [];     // TD-5 achievement ids earned
  if (!save.endlessBest) save.endlessBest = {};    // TD-5 best endless wave per world
  if (!("midRun" in save)) save.midRun = null;     // TD-5 resume checkpoint
  if (!save.bests || typeof save.bests !== "object") save.bests = {}; // TD-13 best run per level+difficulty

  // ---- THE one owner of "wipe the fort" (RULE 7) ----
  // Both the grown-ups ⚙️ Reset button and the __TD.resetSave test hook build the
  // fresh save HERE, so a newly persisted field can never be cleared by one path
  // and missed by the other (the documented save-field-coverage bug class: a
  // reset that leaves a field `undefined` crashes the next win). `keepPrefs`
  // preserves the player's SETTINGS + difficulty chip — those are preferences,
  // not progress, exactly like Josh's reset preserving the mute toggle.
  function freshSave(keepPrefs) {
    const s = {
      v: 1,
      stars: { casual: {}, normal: {}, heroic: {} },
      settings: { sfx: true, music: false, dmgNumbers: false },
      difficulty: "normal",
      meta: [],
      ach: [],
      endlessBest: {},
      midRun: null,
      bests: {},
    };
    if (keepPrefs) {
      if (save && save.settings) s.settings = JSON.parse(JSON.stringify(save.settings));
      if (save && save.difficulty && DATA.DIFFICULTIES[save.difficulty]) s.difficulty = save.difficulty;
    }
    return s;
  }
  // opts.keepPrefs — keep settings + difficulty chip (the grown-ups reset does).
  // opts.dropRun   — also tear down a parked board (the grown-ups reset does, so
  //                  a wiped fort can't be resumed into a stale run).
  function resetProgress(opts) {
    const o = opts || {};
    save = freshSave(o.keepPrefs);
    // force: a deliberate reset MUST skip the two-tab monotonic merge, or the
    // stored copy's stars/badges/endless bests would fold straight back in.
    persist(save, { force: true });
    if (o.dropRun) { stopLoop(); cur = null; }
    return true;
  }

  // ---- TD-5 achievements: earn once, toast, persist (never on a cheated run) ----
  function earnAch(id) {
    if (!Array.isArray(save.ach)) save.ach = [];
    if (save.ach.indexOf(id) >= 0) return;
    const def = DATA.ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return;
    save.ach.push(id); persist(save);
    UI.toast(def.icon, def.name); sfx("upgrade");
  }
  // The shared meta economy (star tree, Star Collector / Full Fort) counts each
  // level's BEST stars across the three ladders — the ceiling stays 36, so the
  // per-difficulty split inflates nothing and no existing save loses anything.
  function bestStarsOf(levelId) {
    const k = String(levelId); let m = 0;
    for (const d of ["casual", "normal", "heroic"]) { const o = save.stars && save.stars[d]; if (o && (o[k] | 0) > m) m = o[k] | 0; }
    return m;
  }
  function totalStars() { let s = 0; for (const l of DATA.LEVELS) s += bestStarsOf(l.id); return s; }
  // Derived from the shipped level count, never a literal 36 — World 4 took the
  // ceiling to 48, and a literal would fire "Full Fort" a whole world early.
  const STAR_CEILING = () => DATA.LEVELS.length * 3;
  function checkStarAchievements() {
    const t = totalStars(), cap = STAR_CEILING();
    if (t >= Math.round(cap / 2)) earnAch("starcollector");
    if (t >= cap) earnAch("fullfort");
  }

  // ---- SFX (through the ONE iOS-safe JoshAudio.tone; global 🔇 + fort toggle) ----
  let lastShotCue = 0;
  // ---- Haptics ----
  // navigator.vibrate is NOT supported by Safari on iOS (iPhone or iPad), so this
  // is a real no-op there — feature-checked rather than pretending. It fires on
  // Android/Chrome, is gated by the same 🔔 setting as sound, and respects
  // prefers-reduced-motion (a buzz is motion for anyone sensitive to it).
  const CAN_BUZZ = (() => {
    try {
      if (!global.navigator || typeof global.navigator.vibrate !== "function") return false;
      if (global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
      return true;
    } catch (e) { return false; }
  })();
  const BUZZ = {
    build: 12, upgrade: [10, 40, 18], sell: 10, crit: [8, 30, 8],
    splash: 26, leak: [40, 60, 40], wave: 18, boss: [60, 90, 60, 90, 120],
    lever: [14, 40, 14], deny: [8, 50, 8], won: [30, 60, 30, 60, 90], lost: [90, 120, 90],
    ability: 20, phase: [50, 70, 50], lowlives: [70, 80, 70], cleared: [16, 30, 16],
  };
  function buzz(kind) {
    if (!CAN_BUZZ || !save.settings.sfx) return;
    const pat = BUZZ[kind];
    if (!pat) return;
    try { global.navigator.vibrate(pat); } catch (e) { /* never break play */ }
  }
  function sfx(kind, arg) {
    buzz(kind); // haptics ride the SAME call site as audio, so a new cue gets both
    if (!save.settings.sfx) return;
    try {
      if (A.isMuted && A.isMuted()) return; // fort sounds respect the global 🔇 too
      if (kind === "build") { A.tone(660, { duration: 0.08, gain: 0.12 }); setTimeout(() => A.tone(880, { duration: 0.1, gain: 0.12 }), 70); }
      else if (kind === "upgrade") { [520, 660, 880].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.09, gain: 0.12 }), i * 70)); }
      else if (kind === "sell") A.tone(280, { duration: 0.12, gain: 0.1, type: "sine" });
      else if (kind === "shoot") {
        const now = Date.now();
        if (now - lastShotCue > 110) {
          lastShotCue = now;
          // a mortar THUMPs, a dart TICKs — distinct so the ear reads the mix
          if (arg === "mortar") A.tone(180, { duration: 0.07, gain: 0.09, type: "sine" });
          else if (arg === "fan") A.tone(880, { duration: 0.05, gain: 0.05, type: "sine" });
          else A.tone(1500, { duration: 0.03, gain: 0.05, type: "square" });
        }
      }
      else if (kind === "crit") A.tone(2100, { duration: 0.05, gain: 0.08, type: "square" }); // a sharp sparkle on a Sniper crit
      else if (kind === "die") A.tone(980, { duration: 0.06, gain: 0.07 });
      else if (kind === "chain") A.tone(1200, { duration: 0.08, gain: 0.08, type: "square" });
      else if (kind === "splash") A.tone(110, { duration: 0.18, gain: 0.14, type: "sine" });
      else if (kind === "leak") { A.tone(330, { duration: 0.12, gain: 0.1, type: "sine" }); setTimeout(() => A.tone(262, { duration: 0.16, gain: 0.1, type: "sine" }), 110); }
      else if (kind === "wave") { [440, 440, 440, 587].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.07, gain: 0.1 }), i * 90)); }
      else if (kind === "boss") { [220, 175, 220, 175].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.22, gain: 0.16, type: "square" }), i * 240)); } // klaxon
      else if (kind === "lever") { [523, 784].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.09, gain: 0.12, type: "square" }), i * 80)); } // a ka-CHUNK track switch
      else if (kind === "deny") A.tone(196, { duration: 0.12, gain: 0.08, type: "sine" }); // lever on cooldown — a soft low bump
      else if (kind === "won") { if (A.winCue) A.winCue(); }
      else if (kind === "lost") { [392, 330, 262].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.18, gain: 0.1, type: "sine" }), i * 160)); }
      // ---- added cues: the fort had no sound for several real moments ----
      else if (kind === "ability") { [740, 988].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.07, gain: 0.11, type: "square" }), i * 60)); } // a power lands
      else if (kind === "arm") A.tone(1046, { duration: 0.05, gain: 0.07, type: "square" }); // a power is armed, waiting for your tap
      else if (kind === "cleared") { [659, 880].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.1, gain: 0.11 }), i * 110)); } // wave survived
      else if (kind === "phase") { [147, 196, 147].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.16, gain: 0.15, type: "square" }), i * 150)); } // a boss escalates
      else if (kind === "lowlives") { [330, 294].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.2, gain: 0.13, type: "sine" }), i * 200)); } // the door is nearly down
      else if (kind === "tier") { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.08, gain: 0.12 }), i * 65)); } // tier-4 branch taken
    } catch (e) { /* audio must never break play */ }
  }

  // ---- TD-6 optional music: a gentle looping lullaby-march via scheduled tones
  //      (the Team-Song setTimeout-composer precedent). OFF by default, behind its
  //      own toggle, mute-gated — never gates gameplay on a timer. ----
  let musicTimer = 0;
  const MELODY = [392, 440, 494, 523, 494, 440, 392, 330]; // G A B C B A G E
  function stopMusic() { if (musicTimer) { clearTimeout(musicTimer); musicTimer = 0; } }
  function startMusic() {
    stopMusic();
    if (!save.settings.music || !save.settings.sfx) return;
    let i = 0;
    const step = () => {
      try {
        if (!save.settings.music || !save.settings.sfx || (A.isMuted && A.isMuted())) { musicTimer = 0; return; }
        A.tone(MELODY[i % MELODY.length], { duration: 0.28, gain: 0.045, type: "sine" });
        i += 1;
        musicTimer = setTimeout(step, 430);
      } catch (e) { musicTimer = 0; }
    };
    musicTimer = setTimeout(step, 300);
  }

  // ---- The running session ----
  let cur = null; // { engine, render, raf, acc, lastT, speed, paused, selPadId, selTowerId }

  // ---- Screen wake lock ----
  // Watching a wave resolve is exactly when a phone decides you have gone away.
  // navigator.wakeLock needs Safari 16.4+/iOS 16.4+, so it works on a modern
  // phone and is a clean no-op on Josh's iOS 14.2 iPad (the platform floor) —
  // feature-checked, never thrown. The lock is dropped by the browser whenever
  // the tab backgrounds, so it must be RE-acquired on visibilitychange.
  let wakeLock = null;
  function keepAwake() {
    try {
      if (!global.navigator || !global.navigator.wakeLock || wakeLock) return;
      global.navigator.wakeLock.request("screen").then((wl) => {
        wakeLock = wl;
        wl.addEventListener("release", () => { wakeLock = null; });
      }).catch(() => { wakeLock = null; });
    } catch (e) { wakeLock = null; }
  }
  function letSleep() {
    try { if (wakeLock) { wakeLock.release(); } } catch (e) { /* ignore */ }
    wakeLock = null;
  }
  if (doc.addEventListener) {
    doc.addEventListener("visibilitychange", () => {
      // re-acquire when we come back, but ONLY if a battle is actually live
      if (!doc.hidden && cur && !cur.paused) keepAwake();
      else if (doc.hidden) wakeLock = null; // the browser already dropped it
    });
  }

  function stopLoop() { if (cur && cur.raf) { cancelAnimationFrame(cur.raf); cur.raf = 0; } stopMusic(); letSleep(); }

  // TD-5: award every achievement this outcome earns (skipped on a cheated run).
  function awardWinAchievements(st) {
    if (st.cheated) return;
    if (st.levelId === 1) earnAch("doorman");
    if (st.levelId === 4) earnAch("bossbonker");
    if (st.levelId === 8 && cur.soldiersLost <= 3) earnAch("dysondenied");
    if (st.levelId === 12) earnAch("unplugged");
    if (!cur.leaked) earnAch("noleaks");                    // all 20 stickers kept safe
    if (st.difficulty === "heroic") earnAch("heroicheart");
    const linesUsed = Object.keys(cur.lines);
    if (st.levelId === 2 && linesUsed.length === 1 && linesUsed[0] === "dart") earnAch("peapurist");
    checkStarAchievements();
  }

  function phaseWatch(prevPhase) {
    const st = cur.engine.state;
    if (st.phase === prevPhase) return;
    // a fresh build phase (a wave boundary) is the mid-run checkpoint (§9.3)
    if (st.phase === "build" && st.waveIdx !== cur.lastBuildWave) {
      cur.lastBuildWave = st.waveIdx; writeMidRun();
      if (st.waveIdx > 0) sfx("cleared");                       // you survived one
      if (st.lives <= 5 && !cur.warned) { cur.warned = true; sfx("lowlives"); } // the door is nearly down
    }
    // The power strip is wave-only, so a wave ending must DISARM — otherwise a
    // half-armed power survives into the build phase (where its strip is hidden)
    // and silently eats the first pad tap. Same class as the stale rally arm.
    if (st.phase !== "wave" && cur.abilArmId) { cur.abilArmId = null; UI.abilityHint(""); }
    if (st.phase === "won") {
      stopLoop();
      if (!st.cheated) {
        // the star lands on the RUN's difficulty ladder (a resumed run can
        // differ from the currently-selected chip — the run's own difficulty
        // is the truth)
        const key = String(st.levelId);
        const lad = save.stars[st.difficulty] || (save.stars[st.difficulty] = {});
        lad[key] = Math.max(lad[key] | 0, st.stars);
        persist(save);
      }
      clearMidRun();
      awardWinAchievements(st);
      sfx("won");
      const nextId = st.levelId + 1;
      const nextExists = !!DATA.LEVELS.find((l) => l.id === nextId);
      // TD-13: a personal best per level PER DIFFICULTY (they are independent
      // ladders, so a casual clear must never overwrite a heroic one).
      let pb = false;
      if (!st.cheated && !st.endless) {
        const bk = st.levelId + ":" + st.difficulty;
        const prev = save.bests[bk];
        if (!prev || st.lives > (prev.lives | 0)) { save.bests[bk] = { lives: st.lives, stars: st.stars }; pb = !!prev; }
        persist(save);
      }
      UI.showVictory(st.stars, st.lives, {
        continueOn: () => { UI.closeOverlay(); location.hash = "#td-home"; },
        nextLevel: nextExists ? nextId : null,
        onNext: nextExists ? () => { UI.closeOverlay(); location.hash = "#td-play"; startLevel(nextId, {}); } : null,
      }, runSummary(pb));
    } else if (st.phase === "lost") {
      stopLoop();
      clearMidRun();
      sfx("lost");
      if (st.endless) {
        const world = cur.levelDef.world, score = st.waveIdx;
        const best = (save.endlessBest[world] || 0);
        if (!st.cheated && score > best) { save.endlessBest[world] = score; persist(save); }
        if (!st.cheated && score >= 20) earnAch("marathoner");
        UI.showDefeat({
          retry: () => { UI.closeOverlay(); startEndless(world); },
          quit: () => { UI.closeOverlay(); location.hash = "#td-home"; },
        }, { score, best: Math.max(best, score) });
      } else {
        UI.showDefeat({
          retry: () => { UI.closeOverlay(); startLevel(st.levelId, { seed: st.seed }); },
          retrynew: () => { UI.closeOverlay(); startLevel(st.levelId, { seed: (Date.now() % 100000) }); },
          quit: () => { UI.closeOverlay(); location.hash = "#td-home"; },
          guide: (type) => { UI.closeOverlay(); UI.showGuide(type); },
        }, null, postMortem(), runSummary(false));
      }
    }
  }

  // TD-12: what actually killed this run. Built from the leaks we recorded as
  // events drained, plus the lines actually on the board — so it can name the
  // real problem ("14 fliers got through and you had nothing that reaches air")
  // instead of the old flavour-only "the toys got sleepy".
  // TD-13: what your board actually DID this run. Every number is accumulated
  // from events the engine already emits, so nothing here can disagree with the
  // simulation — and damage-by-line is the number that makes "which towers are
  // carrying?" answerable for the first time.
  function runSummary(isPersonalBest) {
    if (!cur) return null;
    const st = cur.engine.state;
    // Read straight off engine STATE (exact, cap-proof) rather than the event
    // stream — only the dart ever emitted a "hit" event, so event accounting
    // would have credited splash/zap/melee to nobody.
    const dmg = st.dmgBy || {};
    const total = Object.keys(dmg).reduce((a, k) => a + dmg[k], 0);
    const NAME = { dart: "🎯 Dart", mortar: "💥 Mortar", fan: "❄ Fan", camp: "🪖 Camp", ability: "🧨 Abilities" };
    const rows = Object.keys(dmg).sort((a, b) => dmg[b] - dmg[a]).map((k) => ({
      line: k, label: NAME[k] || k, dmg: Math.round(dmg[k]),
      pct: total ? Math.round((dmg[k] / total) * 100) : 0,
    }));
    const spent = st.towers.reduce((a, t) => a + (t.spent || 0), 0);
    const bk = st.levelId + ":" + st.difficulty;
    const best = save.bests[bk];
    return {
      rows, kills: st.kills || 0, gold: st.goldEarned || 0, spent,
      towers: st.towers.length,
      best: best ? best.lives : null,
      personalBest: !!isPersonalBest,
    };
  }

  function postMortem() {
    if (!cur) return null;
    const leaks = cur.leaks || {};
    const types = Object.keys(leaks).sort((a, b) => leaks[b] - leaks[a]);
    if (!types.length) return null;
    const lines = {};
    for (const t of cur.engine.state.towers) lines[t.lineId] = true;
    const built = Object.keys(lines);
    let advice = null, focus = types[0];
    // The counter matrix, read the same way the guide reads it.
    for (const t of types) {
      const def = DATA.ENEMIES[t];
      if (!def) continue;
      const reach = TD.reachedBy(def);
      if (built.length && !reach.some((r) => lines[r])) {
        advice = "Nothing you built could even reach the " + def.name + ". Try: " + reach.join(" or ") + ".";
        focus = t; break;
      }
      if (def.splashResist && built.length === 1 && built[0] === "mortar") { advice = "The " + def.name + " soaks splash — bring single-target damage."; focus = t; break; }
      if (def.slowHeal && built.length === 1 && built[0] === "fan") { advice = "The " + def.name + " regrows while slowed — slows alone can't kill it."; focus = t; break; }
      if (def.armor >= 0.5 && built.length === 1 && built[0] === "dart") { advice = "The " + def.name + " is armored — a dart's bonk lands at half. The Fan's zap ignores armor."; focus = t; break; }
    }
    return {
      wave: cur.leakWave || cur.engine.state.waveIdx + 1,
      rows: types.slice(0, 4).map((t) => ({ type: t, icon: (DATA.ENEMIES[t] || {}).icon || "•", name: (DATA.ENEMIES[t] || {}).name || t, n: leaks[t] })),
      total: types.reduce((a, t) => a + leaks[t], 0),
      advice, focus,
    };
  }

  function drainEvents() {
    const evs = cur.engine.events;
    for (const e of evs) {
      cur.render.pushFx(e);
      if (e.type === "shoot") sfx("shoot", e.tower);
      else if (e.type === "hit" && e.crit) sfx("crit");
      else if (e.type === "die") { sfx("die"); if (!cur.sawKill && !cur.engine.state.cheated) { cur.sawKill = true; earnAch("firstblood"); } }
      else if (e.type === "leak") {
        sfx("leak"); cur.leaked = true;
        // TD-12 post-mortem: WHICH toy got through, and on which wave. The
        // defeat screen used to say only "the toys got sleepy" — no diagnosis
        // at all — even though the engine already emits everything needed.
        cur.leaks = cur.leaks || {};
        cur.leaks[e.enemy] = (cur.leaks[e.enemy] || 0) + 1;
        cur.leakWave = cur.engine.state.waveIdx + 1;
      }
      else if (e.type === "soldier-down") cur.soldiersLost += 1; // TD-5 Dyson Denied tracking
      else if (e.type === "wave") sfx("wave");
      else if (e.type === "ability") sfx("ability"); // a power actually landed
      else if (e.type === "chain") sfx("chain");
      else if (e.type === "splash") sfx("splash");
      else if (e.type === "boss") { UI.showBanner("⚠ " + e.name + " incoming!"); sfx("boss"); }
      else if (e.type === "phase") { UI.showBanner("⚠ " + e.name + " is getting angrier!"); sfx("phase"); }
    }
    evs.length = 0;
  }

  function frame(t) {
    if (!cur) return;
    cur.raf = requestAnimationFrame(frame);
    if (cur.paused) { cur.lastT = t; return; }
    if (!cur.lastT) cur.lastT = t;
    let elapsed = Math.min(100, t - cur.lastT); // clamp: background tabs / hiccups
    cur.lastT = t;
    cur.acc += elapsed * cur.speed;
    const prevPhase = cur.engine.state.phase;
    let ticks = 0;
    while (cur.acc >= DT_MS && ticks < 6) {
      cur.engine.tick();
      cur.render.afterTick();
      cur.acc -= DT_MS;
      ticks += 1;
    }
    drainEvents();
    // TD-5 Ice Age: 20 enemies slowed at once (checked cheaply a few times/sec)
    if (!cur.sawIce && !cur.engine.state.cheated && (cur.engine.state.tick & 7) === 0) {
      const st = cur.engine.state, tk = st.tick;
      let slowed = 0; for (const e of st.enemies) if (e.alive && tk < e.slowUntil) slowed++;
      if (slowed >= 20) { cur.sawIce = true; earnAch("iceage"); }
    }
    phaseWatch(prevPhase);
    cur.render.draw(Math.max(0, Math.min(1, cur.acc / DT_MS)));
    if ((cur.engine.state.tick & 7) === 0) UI.hud(cur.engine.state); // ~4Hz
  }

  // Build an on-the-fly endless "level" from a world's arena (§7.5). Not in
  // DATA.LEVELS, so it never touches the campaign audits.
  function endlessLevelDef(world) {
    const a = DATA.ENDLESS.arenas[world] || DATA.ENDLESS.arenas.bedroom;
    return { id: "endless-" + world, name: "Endless " + world, world, endless: { world }, startGold: a.startGold, budgetBase: DATA.ENDLESS.base, path: a.path, pads: a.pads };
  }

  function startLevel(levelId, opts) {
    opts = opts || {};
    // opts.levelDef lets an endless run pass its generated arena directly.
    const levelDef = opts.levelDef || DATA.LEVELS.find((l) => l.id === levelId);
    if (!levelDef) { location.hash = "#td-home"; return; }
    stopLoop();
    // Difficulty flows from the fort-home selector (persisted in save); a test
    // hook may override per-call. The engine fully supports casual/normal/heroic
    // (hp/speed/bounty/start-gold multipliers) — casual eases, heroic bites hard.
    const difficulty = opts.difficulty || save.difficulty || "normal";
    // TD-5: the owned star-tree nodes flow in as pure engine input; a test hook
    // may override per-call (opts.meta).
    const meta = opts.meta || save.meta || [];
    const engine = TD.createEngine(levelDef, { seed: opts.seed == null ? (Date.now() % 100000) : opts.seed, difficulty, meta });
    // 🧸 Kid mode is a PLAY mode, not progression: mark the run cheated so it can
    // never write a star or earn a badge, and paint the kid-sized control skin.
    if (difficulty === "kid") { engine.state.cheated = true; doc.body.classList.add("td-kid"); }
    else doc.body.classList.remove("td-kid");
    const render = R.create(UI.canvas, engine);
    if (render.setDamageNumbers) render.setDamageNumbers(save.settings.dmgNumbers); // TD-6 opt-in numbers
    cur = { engine, render, levelDef, raf: 0, acc: 0, lastT: 0, speed: 1, paused: false, selPadId: null, selTowerId: null,
      lines: {}, soldiersLost: 0, sawKill: false, lastBuildWave: -1, // TD-5 achievement context
      leaks: {}, leakWave: 0 }; // TD-12 post-mortem context (the tallies live in engine state)
    // The HUD reads the CALL/RUSH offer straight off the engine, so the button
    // can never promise gold the engine would refuse (the dead-control lesson).
    UI._callInfo = () => (cur ? cur.engine.callInfo() : null);
    startMusic(); // TD-6 optional looping march (no-op unless the toggle is on)
    keepAwake();  // don't let the phone doze while a wave plays out
    UI.closeOverlay();
    UI.hideBubble();
    if (UI.hideBanner) UI.hideBanner(); // never inherit the previous level's boss klaxon
    UI.hud(engine.state);
    const speedBtn = doc.querySelector("#screen-td-play .td-speed");
    if (speedBtn) speedBtn.textContent = "1×";
    render.resize();
    render.draw(0);
    cur.raf = requestAnimationFrame(frame);
  }

  function startEndless(world) {
    location.hash = "#td-play";
    startLevel(null, { levelDef: endlessLevelDef(world) });
  }

  // ---- TD-5 mid-run checkpoint (§9.3): snapshot at each wave boundary, restore
  //      on Resume, clear on win/loss/quit. Only towers + scalars — honest
  //      wave-granularity (mid-wave enemy positions are NOT saved). ----
  function writeMidRun() {
    if (!cur || cur.engine.state.cheated) return;
    const st = cur.engine.state;
    if (st.phase !== "build") return;
    save.midRun = {
      levelId: st.levelId, endless: st.endless, world: cur.levelDef.world,
      difficulty: st.difficulty, seed: st.seed, waveIdx: st.waveIdx,
      gold: st.gold, lives: st.lives, meta: (save.meta || []).slice(),
      // achievement context so a resumed win is judged against the WHOLE run,
      // not just the post-resume slice (No Leaks / Dyson Denied / First Blood).
      leaked: !!cur.leaked, soldiersLost: cur.soldiersLost || 0, sawKill: !!cur.sawKill,
      shieldUsed: !!st.shieldUsed, // TD-8: a spent 🌟 Sticker Shield stays spent across a resume (else the free leak re-grants per segment)
      leverRoute: st.leverRoute || 0, // TD-7 audit: the thrown track survives a resume (leverCd deliberately NOT saved — an old absolute tick would wrongly lock a fresh engine)
      towers: st.towers.map((t) => ({ lineId: t.lineId, tier: t.tier, branch: t.branch, padId: t.padId, targeting: t.targeting, rallyX: t.rallyX, rallyY: t.rallyY })),
    };
    persist(save);
  }
  function clearMidRun() { if (save.midRun) { save.midRun = null; persist(save); } }

  // Called whenever we navigate AWAY from a live battle (to the fort or out of
  // the fort). (1) An endless run that's quit — not lost — still earned its
  // wave: record the best score + Marathoner here, since phaseWatch only fires
  // those on defeat. (2) Clear transient field-interaction state so a
  // half-armed camp rally (or a stale selection) can't eat the first pad tap
  // on the next visit.
  function leavingPlay() {
    if (!cur) return;
    const st = cur.engine && cur.engine.state;
    if (st && st.endless && !st.cheated && st.phase !== "won" && st.phase !== "lost") {
      const world = cur.levelDef.world, score = st.waveIdx;
      if (score > (save.endlessBest[world] || 0)) { save.endlessBest[world] = score; persist(save); }
      if (score >= 20) earnAch("marathoner"); // earnAch de-dupes + persists
    }
    cur.rallyArmId = 0; cur.abilArmId = null; cur.selPadId = null; cur.selTowerId = null;
    if (cur.render) cur.render.setSelection(null);
  }

  function resumeMidRun() {
    const mr = save.midRun;
    if (!mr) { location.hash = "#td-home"; return; }
    const levelDef = mr.endless ? endlessLevelDef(mr.world) : DATA.LEVELS.find((l) => l.id === mr.levelId);
    if (!levelDef) { clearMidRun(); location.hash = "#td-home"; return; }
    location.hash = "#td-play";
    startLevel(mr.levelId, { levelDef, seed: mr.seed, difficulty: mr.difficulty, meta: mr.meta });
    // Carry the pre-checkpoint achievement context across the resume so the win
    // is judged honestly against the whole run (startLevel reset these to fresh).
    cur.leaked = !!mr.leaked;
    cur.soldiersLost = mr.soldiersLost || 0;
    cur.sawKill = !!mr.sawKill;
    // Cold restore: set the checkpoint directly (no leaky fast-forward). The
    // engine schedules the correct next wave from state.waveIdx on the next CALL.
    const e = cur.engine;
    const bumpGold = () => { e.state.gold = 9e9; }; // rebuild is already "paid" in mr.gold
    for (const t of mr.towers) {
      bumpGold();
      if (!e.place(t.lineId, t.padId).ok) continue;
      cur.lines[t.lineId] = true; // rebuilt via engine.place(), not the UI handler → track the line for Pea Purist
      const nt = e.state.towers[e.state.towers.length - 1];
      if (t.tier >= 2) { bumpGold(); e.upgrade(nt.id); }
      if (t.tier >= 3) { bumpGold(); e.upgrade(nt.id); }
      if (t.tier >= 4 && t.branch) { bumpGold(); e.branch(nt.id, t.branch); }
      if (t.targeting) e.setTargeting(nt.id, t.targeting);
      if (t.lineId === "camp") e.rally(nt.id, t.rallyX, t.rallyY);
    }
    // A checkpoint is always taken at a BUILD boundary, where sent === cleared —
    // so one saved number restores both counters (a rushed overlap can never be
    // mid-flight in a checkpoint).
    e.state.waveIdx = mr.waveIdx; e.state.sentIdx = mr.waveIdx;
    e.state.gold = mr.gold; e.state.lives = mr.lives;
    e.state.shieldUsed = !!mr.shieldUsed; // TD-8: restore a spent Sticker Shield (legacy midRun lacks it → false, matching a fresh run)
    e.state.leverRoute = mr.leverRoute || 0; // legacy midRun saves lack the field → default short (the save-field-coverage lesson)
    e.state.phase = "build"; e.state.cheated = false; // restored progress is honest
    cur.lastBuildWave = mr.waveIdx; // don't immediately re-checkpoint the restore
    cur.render.afterTick(); cur.render.resize(); cur.render.draw(0); UI.hud(e.state);
  }

  // A compact stat line for the tower panel — so the player can read what a
  // tower actually does at its current tier (premium-TD table stakes).
  function statLine(t) {
    const def = DATA.TOWERS[t.lineId];
    const s = (t.tier === 4 && t.branch) ? def.branches[t.branch] : def.tiers[t.tier - 1];
    if (t.lineId === "fan") {
      let str = "❄ " + Math.round(s.slow * 100) + "% slow · " + s.auraRange + " aura";
      if (s.chain) str += " · chain"; else if (s.zapDps) str += " · " + s.zapDps + " zap";
      return str;
    }
    if (t.lineId === "camp") {
      const dps = s.soldiers * s.dmg / s.rate;
      return "🪖 " + s.soldiers + "×" + s.hp + "hp · " + dps.toFixed(0) + " dps";
    }
    const dps = s.dmg / s.rate; // dart / mortar
    let str = dps.toFixed(0) + " dps · " + s.range + " rng";
    if (s.splash) str += " · 💥" + s.splash;
    if (s.crit) str += " · crit";
    return str;
  }

  // Is a real level running (something to lose)? build/wave only — not won/lost.
  function inLevel() {
    return !!(cur && cur.engine && (cur.engine.state.phase === "build" || cur.engine.state.phase === "wave"));
  }
  // Guard any exit that abandons the level: confirm first, pausing the battle
  // while the player decides so nothing leaks. "Keep playing" resumes.
  function promptLeave(onLeave) {
    if (!inLevel()) { onLeave(); return; }
    cur.paused = true;
    UI.confirm({
      title: "Leave the battle?",
      msg: "You'll lose your progress on this level.",
      yes: "🏰 Leave", no: "↩ Keep playing",
      onYes: () => { UI.closeOverlay(); onLeave(); },
      onNo: () => { UI.closeOverlay(); if (cur) cur.paused = false; },
    });
  }

  // Plain-English refusals. A power that silently declines reads as broken —
  // and one that charges you for nothing reads worse.
  function abilityWhy(reason, def) {
    const name = def ? def.name : "That";
    if (reason === "not-in-wave") return "⏳ " + name + " only works during a wave";
    if (reason === "gold") return "🪙 Not enough gold for " + name + " (" + (def ? def.gold : "?") + ")";
    if (reason === "cooldown") return "⏱ " + name + " is still recharging";
    if (reason === "no-targets") return "🎯 Nothing in the blast — tap closer to the toys";
    if (reason === "no-soldiers") return "🪖 No soldiers to rally — build an Army Guys camp first";
    if (reason === "all-healthy") return "🪖 Your squad is already up and at full health";
    if (reason === "no-tower") return "⚡ Tap one of your towers to overclock it";
    return name + " can't be used right now";
  }

  // ---- Field input: tap pads to build, towers to manage ----
  function fieldTap(ev) {
    if (!cur) return;
    const rect = UI.canvas.getBoundingClientRect();
    // ONE mapping shared with the renderer — taps stay correct in the rotated
    // (portrait-filling) orientation exactly as in landscape.
    const w = cur.render.screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top);
    const gx = w.x, gy = w.y;
    // TD-9 ability mode: this tap RESOLVES an armed ability (a point on the
    // field, or the tower under the tap) instead of selecting anything.
    if (cur.abilArmId) {
      const id = cur.abilArmId;
      cur.abilArmId = null;
      const def = (DATA.ABILITIES || []).find((a) => a.id === id);
      let r;
      if (def && def.kind === "tower") {
        let t = null, bestT = 0.9 * 0.9;
        for (const tw of cur.engine.state.towers) {
          const d = (tw.cx + 0.5 - gx) ** 2 + (tw.cy + 0.5 - gy) ** 2;
          if (d < bestT) { bestT = d; t = tw; }
        }
        r = t ? cur.engine.useAbility(id, { towerId: t.id }) : { ok: false, reason: "no-tower" };
      } else {
        r = cur.engine.useAbility(id, { x: gx, y: gy });
      }
      UI.hideBubble(); cur.render.setSelection(null);
      if (r.ok) { sfx(id === "drop" ? "splash" : "build"); UI.hud(cur.engine.state); UI.abilityHint(""); }
      else { sfx("deny"); UI.abilityHint(abilityWhy(r.reason, def)); }
      UI.abilities(cur.engine.state, null);
      return;
    }
    // rally mode: this tap plants the camp's flag instead of selecting
    if (cur.rallyArmId) {
      const armed = cur.rallyArmId;
      cur.rallyArmId = 0;
      const r = cur.engine.rally(armed, gx, gy);
      UI.hideBubble();
      cur.render.setSelection(r.ok ? { tower: armed } : null);
      if (r.ok) sfx("build");
      return;
    }
    // TD-7: tap the track-switch lever to send the train the long way
    const lever = cur.engine.levelDef.lever;
    if (lever && (lever.cx + 0.5 - gx) ** 2 + (lever.cy + 0.5 - gy) ** 2 <= 0.95 * 0.95) {
      const r = cur.engine.pullLever();
      UI.hideBubble(); cur.render.setSelection(null);
      cur.selPadId = null; cur.selTowerId = null;
      if (r.ok) sfx("lever");
      else if (r.reason === "cooldown") sfx("deny");
      return;
    }
    // nearest pad within 0.9 cells
    let pad = null, best = 0.9 * 0.9;
    for (const p of cur.engine.levelDef.pads) {
      const d = (p.cx + 0.5 - gx) ** 2 + (p.cy + 0.5 - gy) ** 2;
      if (d < best) { best = d; pad = p; }
    }
    UI.hideBubble();
    cur.render.setSelection(null);
    cur.selPadId = null; cur.selTowerId = null;
    if (!pad) { UI.hud(cur.engine.state); return; }

    const tower = cur.engine.state.towers.find((t) => t.padId === pad.id);
    const sp = cur.render.worldToScreen(pad.cx + 0.5, pad.cy + 0.5);
    const bx = UI.canvas.offsetLeft + sp.x, by = UI.canvas.offsetTop + sp.y;
    if (!tower) {
      // ---- build menu: all four toy lines, priced; unaffordable ones dim ----
      cur.selPadId = pad.id;
      cur.render.setSelection({ pad, ghostRange: DATA.TOWERS.dart.tiers[0].range });
      const gold = cur.engine.state.gold;
      const lines = ["dart", "mortar", "fan", "camp"];
      UI.showBubble(
        '<div class="td-buildmenu">' +
        lines.map((id) => {
          const d = DATA.TOWERS[id];
          const cost = d.tiers[0].cost;
          // icon + ROLE (single-shot / splash / slows / blocks path) + price, so
          // a player knows what each toy DOES, not just what it costs.
          // data-cost lets UI.prices() re-colour this LIVE as gold comes in —
          // red while you can't afford it, green the moment you can, without
          // closing and reopening the dialog.
          return '<button class="td-buy" data-line="' + id + '" data-cost="' + cost + '" type="button">' +
            '<span class="td-buy__icon">' + d.icon + "</span>" +
            '<span class="td-buy__role">' + d.role + "</span>" +
            '<span class="td-buy__cost">' + cost + "🪙</span>" +
            "</button>";
        }).join("") +
        "</div>",
        bx, by
      );
      UI.prices(cur.engine.state.gold);
      UI.bubble.querySelectorAll(".td-buy").forEach((btn) => {
        btn.addEventListener("click", (e2) => {
          e2.stopPropagation();
          const r = cur.engine.place(btn.dataset.line, pad.id);
          if (r.ok) { sfx("build"); if (cur.lines) cur.lines[btn.dataset.line] = true; UI.hideBubble(); cur.render.setSelection(null); }
          else {
            UI.bubble.classList.add("td-bubble--no");
            setTimeout(() => UI.bubble.classList.remove("td-bubble--no"), 300);
          }
          UI.hud(cur.engine.state);
        });
      });
    } else {
      // ---- tower panel: upgrade | branch cards at tier 3 | targeting/rally | sell ----
      cur.selTowerId = tower.id;
      cur.render.setSelection({ tower: tower.id });
      const def = DATA.TOWERS[tower.lineId];
      const s = (tower.tier === 4 && tower.branch) ? def.branches[tower.branch] : def.tiers[tower.tier - 1];
      const refund = Math.floor(tower.spent * DATA.RULES.sellRefund);
      let middle = "";
      if (tower.tier < 3) {
        middle = '<button class="td-up" data-cost="' + def.tiers[tower.tier].cost + '" type="button">⬆ ' + def.tiers[tower.tier].cost + "🪙</button>";
      } else if (tower.tier === 3) {
        middle =
          '<button class="td-branch" data-b="a" data-cost="' + def.branches.a.cost + '" type="button">' + def.branches.a.name + " " + def.branches.a.cost + "🪙</button>" +
          '<button class="td-branch" data-b="b" data-cost="' + def.branches.b.cost + '" type="button">' + def.branches.b.name + " " + def.branches.b.cost + "🪙</button>";
      }
      const control = tower.lineId === "camp"
        ? '<button class="td-rally" type="button">🚩 Rally</button>'
        : '<button class="td-target" type="button">🎯 ' + tower.targeting + "</button>";
      UI.showBubble(
        '<div class="td-panel">' +
          '<span class="td-panel__name">' + s.name + "</span>" +
          '<span class="td-panel__stats">' + statLine(tower) + "</span>" +
          middle + control +
          '<button class="td-sell" type="button">💰 sell ' + refund + "</button>" +
        "</div>",
        bx, by
      );
      const up = UI.bubble.querySelector(".td-up");
      if (up) up.addEventListener("click", (e2) => {
        e2.stopPropagation();
        if (cur.engine.upgrade(tower.id).ok) sfx("upgrade");
        UI.hideBubble(); cur.render.setSelection(null); UI.hud(cur.engine.state);
      });
      UI.bubble.querySelectorAll(".td-branch").forEach((btn) => {
        btn.addEventListener("click", (e2) => {
          e2.stopPropagation();
          if (cur.engine.branch(tower.id, btn.dataset.b).ok) sfx("tier");
          else {
            UI.bubble.classList.add("td-bubble--no");
            setTimeout(() => UI.bubble.classList.remove("td-bubble--no"), 300);
            return;
          }
          UI.hideBubble(); cur.render.setSelection(null); UI.hud(cur.engine.state);
        });
      });
      const rallyBtn = UI.bubble.querySelector(".td-rally");
      if (rallyBtn) rallyBtn.addEventListener("click", (e2) => {
        e2.stopPropagation();
        cur.rallyArmId = tower.id; // next field tap plants the flag
        UI.showBubble('<div class="td-panel"><span class="td-panel__name">🚩 tap the field</span></div>', bx, by);
        UI.bubble.classList.add("td-bubble--hint"); // click-transparent — the field tap must pass through
      });
      UI.bubble.querySelector(".td-sell").addEventListener("click", (e2) => {
        e2.stopPropagation();
        if (cur.engine.sell(tower.id).ok) sfx("sell");
        UI.hideBubble(); cur.render.setSelection(null); UI.hud(cur.engine.state);
      });
      const targetBtn = UI.bubble.querySelector(".td-target");
      if (targetBtn) targetBtn.addEventListener("click", (e2) => {
        e2.stopPropagation();
        const modes = ["first", "last", "strong", "close"];
        const nextMode = modes[(modes.indexOf(tower.targeting) + 1) % modes.length];
        cur.engine.setTargeting(tower.id, nextMode);
        e2.target.textContent = "🎯 " + nextMode;
      });
    }
  }

  // ---- Screen/routing hooks (main.js delegates all td-* hashes here) ----
  // No gate: the fort opens directly from the front door's 🏰 tile. An unknown
  // td-* hash still returns false so main.js falls back to the front door.
  const JonTD = {
    route(id) {
      // main.js hides every screen before delegating, but route() is also called
      // DIRECTLY (the reset button, the resume-dismiss, the leave hook). Those
      // callers only ever un-hid the destination, so a direct call could leave
      // BOTH fort screens in flow — the play screen stacked under a ~900px home,
      // which pushed the field's top past the viewport and rebuilt the canvas at
      // its minimum cell. Park the sibling here so every caller is equivalent.
      const park = (other) => { const o = doc.getElementById(other); if (o) o.hidden = true; };
      if (id === "td-home") park("screen-td-play");
      if (id === "td-play") park("screen-td-home");
      if (id === "td-home") {
        leavingPlay(); // record any endless milestone + clear armed-rally/selection before parking the run
        doc.body.classList.add("td-mode");
        doc.body.classList.remove("in-game");
        UI.renderLevelGrid(
          save,
          (n) => { location.hash = "#td-play"; startLevel(n, {}); },
          (d) => { if (DATA.DIFFICULTIES[d]) { save.difficulty = d; persist(save); } } // sticks for the next level start
        );
        UI.renderResume(save, resumeMidRun, () => { clearMidRun(); JonTD.route("td-home"); }); // TD-5 resume banner
        const s = doc.getElementById("screen-td-home");
        if (s) s.hidden = false;
        if (cur) { cur.paused = true; }
        global.scrollTo(0, 0);
        return true;
      }
      if (id === "td-play") {
        doc.body.classList.add("td-mode");
        doc.body.classList.add("in-game");
        const s = doc.getElementById("screen-td-play");
        if (s) s.hidden = false;
        if (!cur) startLevel(1, {}); // deep entry → default to L1
        else { cur.paused = false; }
        // startLevel may have run while the screen was still hidden (hash
        // routing is async) — the canvas would have sized against a 0-width
        // parent. Re-measure now that the screen is visible.
        if (cur) { cur.render.resize(); cur.render.draw(0); }
        global.scrollTo(0, 0);
        return true;
      }
      return false;
    },
    onLeave() {
      leavingPlay(); // leaving the fort entirely: same milestone-record + transient-state clear
      doc.body.classList.remove("td-mode");
      if (cur) cur.paused = true;
      UI.hideBubble();
      UI.closeOverlay();
    },
  };
  global.JonTD = JonTD;

  // ---- Wire the shell once the DOM exists (scripts are deferred → DOM ready) ----
  UI.buildScreens({
    exitFort: () => { location.hash = ""; },
    quitToFort: () => { promptLeave(() => { location.hash = "#td-home"; }); },
    // TD-9: tapping an ability button. An "instant" one fires immediately; a
    // point/tower one ARMS and the next field tap resolves it (the rally-flag
    // precedent). Re-tapping an armed ability disarms it — a toddler-proof
    // toggle, and the same double-tap forgiveness the kid games learned.
    useAbility: (id) => {
      if (!cur) return;
      const def = (DATA.ABILITIES || []).find((a) => a.id === id);
      if (!def) return;
      if (cur.abilArmId === id) { cur.abilArmId = null; UI.abilities(cur.engine.state, null); return; }
      const ready = cur.engine.abilityReady(id);
      if (!ready.ok) {
        sfx("deny");
        UI.abilityHint(abilityWhy(ready.reason, def));
        UI.abilities(cur.engine.state, cur.abilArmId);
        return;
      }
      if (def.kind === "instant") {
        // The no-op refusal happens INSIDE useAbility (abilityReady only checks
        // phase/gold/cooldown), so this branch needs its own explanation.
        const r = cur.engine.useAbility(id, {});
        if (r.ok) { sfx("build"); UI.hud(cur.engine.state); UI.abilityHint(""); }
        else { sfx("deny"); UI.abilityHint(abilityWhy(r.reason, def)); }
        UI.abilities(cur.engine.state, null);
        return;
      }
      cur.abilArmId = id;
      cur.rallyArmId = 0; // the two arm-modes are mutually exclusive
      UI.hideBubble(); cur.render.setSelection(null);
      sfx("arm");
      UI.abilityHint(def.kind === "tower" ? "⚡ Tap one of your towers" : def.icon + " Tap the field — " + def.role);
      UI.abilities(cur.engine.state, id);
    },
    togglePause: () => {
      if (!cur) return;
      if (cur.paused) { cur.paused = false; UI.closeOverlay(); return; }
      cur.paused = true;
      const openPause = () => UI.showPause({
        resume: () => { cur.paused = false; UI.closeOverlay(); },
        restart: () => { UI.closeOverlay(); startLevel(cur.levelDef ? cur.levelDef.id : cur.engine.state.levelId, cur.engine.state.endless ? { levelDef: cur.levelDef } : {}); },
        sfx: () => { save.settings.sfx = !save.settings.sfx; persist(save); if (!save.settings.sfx) stopMusic(); else startMusic(); openPause(); },
        music: () => { save.settings.music = !save.settings.music; persist(save); if (save.settings.music) startMusic(); else stopMusic(); openPause(); },
        dmg: () => { save.settings.dmgNumbers = !save.settings.dmgNumbers; persist(save); if (cur.render.setDamageNumbers) cur.render.setDamageNumbers(save.settings.dmgNumbers); openPause(); },
        quit: () => { UI.closeOverlay(); promptLeave(() => { location.hash = "#td-home"; }); },
      }, save.settings);
      openPause();
    },
    toggleSpeed: () => {
      if (!cur) return;
      // 1× → 2× → 3× → 1×. 3× is 90 ticks/sec; the frame loop already caps at
      // 6 ticks per frame, so a slow frame can never spiral.
      cur.speed = cur.speed >= 3 ? 1 : cur.speed + 1;
      const b = doc.querySelector("#screen-td-play .td-speed");
      if (b) b.textContent = cur.speed + "×";
    },
    // CALL in build starts the wave early; CALL during a wave RUSHES the next
    // one on top of it (up to RULES.maxWavesInFlight). A refusal is explained
    // rather than silent — the ability lesson, applied to the wave button.
    callWave: () => {
      if (!cur) return;
      const r = cur.engine.callWave();
      if (r.ok) {
        sfx(cur.engine.state.sentIdx - cur.engine.state.waveIdx > 1 ? "boss" : "wave");
        if (cur.engine.state.sentIdx - cur.engine.state.waveIdx > 1) {
          UI.abilityHint("⏩ Two waves at once — hold the line!");
        }
      } else if (r.reason === "too-many-waves") {
        sfx("deny");
        UI.abilityHint("⏩ Already two waves out — clear one first");
      } else if (r.reason === "no-more-waves") {
        sfx("deny");
        UI.abilityHint("⏩ That was the last wave");
      }
      UI.hud(cur.engine.state);
    },
    fieldTap,
    // TD-5 meta screens (opened from the fort home)
    openTree: () => UI.showStarTree(save, (newMeta) => { save.meta = newMeta; persist(save); }),
    openAchievements: () => UI.showAchievements(save),
    openEndless: () => UI.showEndless(save, (world) => startEndless(world)),
    // 🧸 Kid Fort: the first level, kid difficulty, kid-sized buttons, no losing.
    kidFort: () => { location.hash = "#td-play"; startLevel(1, { difficulty: "kid" }); },
    // Grown-ups reset: wipe progress (keeping sound/graphics prefs + the
    // difficulty chip), drop any parked run, then re-render the fort home so the
    // grid re-locks, the star tree empties and the Resume banner disappears.
    // TD-14 backup: the save as text, and a VALIDATING restore. A bad paste must
    // never destroy a good save, so nothing is written until it parses AND looks
    // like a fort save; the restored blob then goes through the same boot
    // coercion as a normal load (via reload) so a stale shape can't crash a win.
    exportSave: () => JSON.stringify(save),
    importSave: (text) => {
      let incoming = null;
      try { incoming = JSON.parse(String(text || "").trim()); } catch (e) { return { ok: false, reason: "parse" }; }
      if (!incoming || typeof incoming !== "object" || incoming.v !== 1) return { ok: false, reason: "shape" };
      if (typeof incoming.stars !== "object" || incoming.stars === null) return { ok: false, reason: "shape" };
      save = incoming;
      persist(save, { force: true }); // a deliberate restore, like a reset
      global.location.reload();       // re-boot so every field gets its coercion
      return { ok: true };
    },
    resetFort: () => {
      resetProgress({ keepPrefs: true, dropRun: true });
      JonTD.route("td-home");
      UI.notice("⚙️", "<b>Fort reset</b><br>Everything starts over.");
    },
  });
  doc.addEventListener("visibilitychange", () => { if (doc.hidden && cur) cur.paused = true; });
  global.addEventListener("resize", () => { if (cur) { cur.render.resize(); cur.render.draw(0); } });
  // Tapping anywhere OUTSIDE the bubble/panel (and off the canvas — canvas taps
  // re-evaluate in fieldTap) dismisses it, like every native dialog should.
  doc.addEventListener("pointerdown", (ev) => {
    const b = UI.bubble;
    if (!b || b.hidden) return;
    const t = ev.target;
    if (b.contains(t) || t === UI.canvas) return;
    UI.hideBubble();
    if (cur) { cur.render.setSelection(null); cur.selPadId = null; cur.selTowerId = null; }
  }, true);

  // ---- __TD: the debug/test hooks (PLAN §9.4) — deterministic, renderer-free ----
  global.__TD = {
    engine: () => (cur ? cur.engine : null),
    render: () => (cur ? cur.render : null), // TD-6: shakeInfo/setDamageNumbers for tests
    state: () => (cur ? cur.engine.state : null),
    hash: () => (cur ? TD.hashState(cur.engine.state) : 0),
    // Orientation contract for tests: the ONE world↔screen mapping + mode.
    w2s: (x, y) => (cur ? cur.render.worldToScreen(x, y) : { x: 0, y: 0 }),
    isRotated: () => (cur ? cur.render.isRotated() : false),
    newGame: (levelId, opts) => { startLevel(levelId, opts || {}); if (cur) cur.paused = true; return true; },
    grantGold: (n) => { if (cur) { cur.engine.state.gold += n; cur.engine.state.cheated = true; } },
    resetSave: () => resetProgress(), // the ONE owner — a new save field is covered here automatically
    // read-only test hooks (audit guardrails): the resume checkpoint, the live
    // achievement context, the earned-badge list, and a trigger for resume.
    midRun: () => (save.midRun ? JSON.parse(JSON.stringify(save.midRun)) : null),
    ctx: () => (cur ? { leaked: !!cur.leaked, soldiersLost: cur.soldiersLost || 0, lines: Object.keys(cur.lines || {}) } : null),
    ach: () => (save.ach || []).slice(),
    endlessBest: () => Object.assign({}, save.endlessBest),
    resume: () => { resumeMidRun(); return cur ? cur.engine.state.phase : null; },
    startEndless: (world) => { startEndless(world); if (cur) cur.paused = true; return true; },
    // Exercises the real leave chokepoint — including the hash, so the router
    // and the screens agree afterwards exactly as they do when the player taps
    // 🏠 (the app always leaves via the hash; a route() call alone left the hash
    // pointing at a screen that was no longer showing).
    leaveToHome: () => { location.hash = "#td-home"; JonTD.route("td-home"); return true; },
    // Synchronous command script: [["place","dart","p3"],["upgrade",0],["call"],
    // ["tick",30],["untilPhase","build",50000]] — runs with the renderer paused.
    script: (cmds) => {
      if (!cur) return false;
      const e = cur.engine;
      for (const c of cmds) {
        if (c[0] === "place") e.place(c[1], c[2]);
        else if (c[0] === "upgrade") { const t = e.state.towers[c[1]]; if (t) e.upgrade(t.id); }
        else if (c[0] === "sell") { const t = e.state.towers[c[1]]; if (t) e.sell(t.id); }
        else if (c[0] === "target") { const t = e.state.towers[c[1]]; if (t) e.setTargeting(t.id, c[2]); }
        else if (c[0] === "call") e.callWave();
        else if (c[0] === "tick") { for (let i = 0; i < c[1]; i++) e.tick(); }
        else if (c[0] === "untilPhase") {
          let guard = 0;
          const cap = c[2] || 100000;
          while (e.state.phase !== c[1] && e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < cap) e.tick();
        }
      }
      cur.render.afterTick();
      drainEvents();
      phaseWatch("(scripted)");
      cur.render.draw(0);
      UI.hud(e.state);
      return e.state.phase;
    },
    // The exact CI winning plan from tests/td-logic.test.js, reproducible in-browser.
    winL1: (seed) => {
      global.__TD.newGame(1, { seed: seed == null ? 7 : seed });
      const e = cur.engine;
      const s = global.__TD.script;
      s([["place", "dart", "p3"], ["place", "dart", "p2"], ["place", "dart", "p4"]]);
      let guard = 0;
      while (e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < 40) {
        const wave = e.state.waveIdx + 1;
        if (wave === 3) s([["upgrade", 0]]);
        if (wave === 5) { s([["upgrade", 0]]); s([["place", "dart", "p6"]]); }
        s([["call"], ["untilPhase", "build", 200000]]);
      }
      return e.state.phase;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
