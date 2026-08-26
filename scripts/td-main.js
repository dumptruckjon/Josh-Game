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
      // union. meta is NOT merged (a respec legitimately REMOVES nodes), and
      // `loadout` follows meta for exactly the same reason — un-equipping is a
      // deliberate removal, so unioning it would resurrect a pack you just
      // emptied. `powers` is the same shape of choice and follows the same rule.
      // settings/difficulty/midRun stay last-writer-wins. A deliberate
      // reset passes {force:true} to skip the merge — otherwise it could never clear.
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
            // TD-18: a chip WON only ever accumulates, so it folds as a per-level
            // union like `ach`. `chipsArmed` is a preference and stays
            // last-writer-wins, exactly like `loadout` — disarming is deliberate.
            if (other.chipsWon && typeof other.chipsWon === "object") {
              save.chipsWon = save.chipsWon || {};
              for (const k in other.chipsWon) {
                if (!Array.isArray(other.chipsWon[k])) continue;
                save.chipsWon[k] = [...new Set([...(save.chipsWon[k] || []), ...other.chipsWon[k]])];
              }
            }
            // TD-18 daily: allTime is monotonic; today's best folds as max only
            // when both tabs are on the SAME day — a later day string wins
            // outright (ISO dates compare lexically), because yesterday's score
            // must never survive as today's.
            if (other.daily && typeof other.daily === "object") {
              const mine = save.daily = (save.daily && typeof save.daily === "object") ? save.daily : { day: "", best: 0, allTime: 0 };
              mine.allTime = Math.max(mine.allTime | 0, other.daily.allTime | 0);
              if (other.daily.day === mine.day) mine.best = Math.max(mine.best | 0, other.daily.best | 0);
              else if (String(other.daily.day || "") > String(mine.day || "")) { mine.day = other.daily.day; mine.best = other.daily.best | 0; }
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
  // A hand-edited or restored backup can name a difficulty that no longer
  // exists (the retired `kid` mode is exactly that case), so an unknown chip
  // always falls back to normal rather than sticking as an unselectable run.
  if (!save.difficulty || !DATA.DIFFICULTIES[save.difficulty]) save.difficulty = "normal";
  if (!save.settings) save.settings = { sfx: true };
  if (typeof save.settings.dmgNumbers !== "boolean") save.settings.dmgNumbers = false; // TD-6 opt-in
  if (typeof save.settings.music !== "boolean") save.settings.music = false;            // TD-6 opt-in, off by default
  // Field speed is remembered between levels — retapping ⏩ on all 40 levels
  // (and on every restart) is the friction this removes. CLAMPED because it is
  // a NUMBER, not a flag: the frame loop does `acc += elapsed * speed`, so a
  // hand-edited or restored `speed: 0` would freeze the battle for ever and a
  // huge value would make it unplayable. A field one short must degrade, not
  // disable.
  const sp = Math.round(Number(save.settings.speed));
  save.settings.speed = sp >= 1 && sp <= 3 ? sp : 1;
  // 🎯 Remembered aim: the LAST targeting mode you chose for a tower LINE becomes
  // the opening mode for the next tower of that line. Exactly the ⏩ speed fix's
  // shape — a per-tower control that resets every level is one you re-tap on 10-14
  // towers across all 40 of them — and it matters more here, because `AUDIT
  // targeting is a LIVE lever` measures the best mode at 4-9 lives on a boss
  // finale. It is a PREFERENCE, so it lives inside `settings`: the grown-ups
  // reset's keepPrefs clones it for free and the two-tab merge treats it
  // last-writer-wins like every other setting, with no eleventh top-level field.
  // A junk container would make every lookup throw, so coerce it — a field one
  // short must degrade, not disable.
  if (!save.settings.aim || typeof save.settings.aim !== "object") save.settings.aim = {};
  if (!Array.isArray(save.meta)) save.meta = [];   // TD-5 star-tree nodes owned
  // P4: what you OWN and what you BRING are now different things. A run may
  // equip at most RULES.metaSlots of the nodes you own, so allocation is a
  // decision every run rather than a purchase you make once. A save from before
  // this migrates by auto-equipping the first slots-worth it owns, so nobody
  // logs in to a fort that suddenly forgot its upgrades.
  if (!Array.isArray(save.loadout)) save.loadout = save.meta.slice(0, DATA.RULES.metaSlots);
  // P6: which POWERS this fort brings to a run. DERIVED from the data, never a
  // written literal (the TOTAL_PLANNED lesson), so a save from before the pool
  // grew migrates to the first slots-worth and nobody logs in to an empty strip.
  if (!Array.isArray(save.powers)) save.powers = DATA.ABILITIES.slice(0, DATA.RULES.abilitySlots).map((a) => a.id);
  if (!Array.isArray(save.ach)) save.ach = [];     // TD-5 achievement ids earned
  if (!save.endlessBest) save.endlessBest = {};    // TD-5 best endless wave per world
  if (!("midRun" in save)) save.midRun = null;     // TD-5 resume checkpoint
  if (!save.bests || typeof save.bests !== "object") save.bests = {}; // TD-13 best run per level+difficulty
  // TD-18 challenge chips: what is ARMED for the next run (a preference, like
  // the loadout) and what has been WON per level (progress, per-level id lists).
  if (!Array.isArray(save.chipsArmed)) save.chipsArmed = [];
  if (!save.chipsWon || typeof save.chipsWon !== "object") save.chipsWon = {};
  // TD-18 Daily Toybox: today's best and the all-time daily best. Bounded on
  // purpose — one day + one number, never a growing per-day history.
  if (!save.daily || typeof save.daily !== "object") save.daily = { day: "", best: 0, allTime: 0 };

  // THE one owner of "which nodes is this run actually running with". Equipped
  // ∩ owned, capped at the slot budget — so a hand-edited save, a refund, or a
  // shrunken RULES.metaSlots can never hand a run more than the rules allow.
  function activeLoadout() {
    const owned = new Set(save.meta || []);
    return (save.loadout || []).filter((id) => owned.has(id)).slice(0, DATA.RULES.metaSlots);
  }
  // TD-18: the one owner of "which chips constrain the next run". Armed ∩ real
  // — a hand-edited save cannot invent a ban — and deliberately NOT forced
  // non-empty: no chips is the normal state.
  function activeChips() {
    const real = new Set((DATA.CHIPS || []).map((c) => c.id));
    return (save.chipsArmed || []).filter((id) => real.has(id));
  }
  // The same owner for POWERS: equipped ∩ real, capped at the slot budget, and
  // never empty (a hand-edited save that cleared it would leave a run with no
  // strip at all, which reads as the feature being broken).
  function activePowers() {
    const real = new Set(DATA.ABILITIES.map((a) => a.id));
    const eq = (save.powers || []).filter((id) => real.has(id)).slice(0, DATA.RULES.abilitySlots);
    return eq.length ? eq : DATA.ABILITIES.slice(0, DATA.RULES.abilitySlots).map((a) => a.id);
  }

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
      settings: { sfx: true, music: false, dmgNumbers: false, speed: 1, aim: {} },
      difficulty: "normal",
      meta: [],
      loadout: [],
      powers: DATA.ABILITIES.slice(0, DATA.RULES.abilitySlots).map((a) => a.id),
      ach: [],
      endlessBest: {},
      midRun: null,
      bests: {},
      chipsArmed: [],
      chipsWon: {},
      daily: { day: "", best: 0, allTime: 0 },
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
    if (o.dropRun) abandonRun();
    return true;
  }

  // ---- TD-5 achievements: earn once, toast, persist (never on a cheated run) ----
  // ANNOUNCE A BADGE WHERE IT WAS EARNED. The toast is deliberately z-15 so it
  // can never cover the outcome screen's buttons in landscape (an earlier
  // audit's call, and the right one) — but most badges are earned at the moment
  // of a WIN, when that screen is up, so the announcement was being dimmed to
  // near-illegibility behind its 70% scrim and clipped at the bottom. Flipping
  // the z-index would just trade one defect for the one already fixed. So a
  // badge earned while an outcome is on screen is rendered INSIDE that screen,
  // beside the stars and the unlock, and a badge earned mid-run (First Blood,
  // Ice Age) still toasts, because nothing is covering it then.
  let pendingEarned = [];
  function announce(icon, html) {
    const st = cur && cur.engine ? cur.engine.state : null;
    if (st && (st.phase === "won" || st.phase === "lost")) pendingEarned.push({ icon, html });
    else if (UI.notice) UI.notice(icon, html);
  }
  // Drained unconditionally at BOTH outcome screens, so an entry can never leak
  // into the next run's box.
  function drainEarned() { const e = pendingEarned; pendingEarned = []; return e; }
  function earnAch(id) {
    if (!Array.isArray(save.ach)) save.ach = [];
    if (save.ach.indexOf(id) >= 0) return;
    const def = DATA.ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return;
    save.ach.push(id); persist(save);
    announce(def.icon, "<b>Badge earned!</b><br>" + def.name); sfx("upgrade");
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
  let lastStripCue = 0;
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
  // THE AUDIO GATES, in ONE place. Reported from real play: turning Sounds off
  // in the pause menu also killed the music, because startMusic() and its
  // per-note step() both early-returned on `!save.settings.sfx` and the Sounds
  // toggle itself called stopMusic(). They are offered as two separate buttons,
  // so they must be two separate switches:
  //   🔇 (the global JoshAudio mute) is the parent's master — it silences all.
  //   🔔 Sounds = the game's effects. Haptics ride the same call site.
  //   🎵 Music  = the looping march.
  // Neither of the two may silence the other; only the master silences both.
  function audioMuted() { return !!(A.isMuted && A.isMuted()); }
  function sfxOn() { return !audioMuted() && !!save.settings.sfx; }
  // NOTE the deliberate asymmetry, which is why there is no `musicOn()` twin:
  // for effects the two conditions are one gate (no cue either way), but for
  // music they mean different things — Music off ENDS the loop, while the mute
  // only skips the note so unmuting resumes mid-phrase. Collapsing them into
  // one predicate would have silently made a mute kill the loop for good.
  function buzz(kind) {
    // Haptics deliberately follow the Sounds switch but NOT the global 🔇 —
    // that mute is about sound, and a silenced phone should still buzz.
    if (!CAN_BUZZ || !save.settings.sfx) return;
    const pat = BUZZ[kind];
    if (!pat) return;
    try { global.navigator.vibrate(pat); } catch (e) { /* never break play */ }
  }
  function sfx(kind, arg) {
    buzz(kind); // haptics ride the SAME call site as audio, so a new cue gets both
    if (!sfxOn()) return;   // the ONE gate: Sounds off, or the global 🔇
    try {
      if (kind === "build") { A.tone(660, { duration: 0.08, gain: 0.12 }); setTimeout(() => A.tone(880, { duration: 0.1, gain: 0.12 }), 70); }
      else if (kind === "upgrade") { [520, 660, 880].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.09, gain: 0.12 }), i * 70)); }
      else if (kind === "sell") A.tone(280, { duration: 0.12, gain: 0.1, type: "sine" });
      // 🎯 the Rust Ray's corrosive tick — a short falling rasp, deliberately dry
      // and quiet so it sits UNDER the dart's own report rather than competing
      // with it. Throttled on the same principle as `shoot`: a Rust Ray fires
      // twice a second and several may be on the board, and an unthrottled cue
      // is how a burst of kills once asked for 100 oscillators at once.
      else if (kind === "strip") {
        const now = Date.now();
        if (now - lastStripCue > 140) {
          lastStripCue = now;
          A.tone(340, { duration: 0.06, gain: 0.055, type: "sawtooth" });
          setTimeout(() => A.tone(240, { duration: 0.07, gain: 0.045, type: "sawtooth" }), 45);
        }
      }
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
      // 🌟 the shield ate that one. Deliberately the OPPOSITE SHAPE to the leak
      // cue above — rising where that one falls — so the ear alone separates a
      // save from a loss without looking at the door.
      // The FIRST note fires synchronously, exactly like the leak cue it answers:
      // a `setTimeout(…, 0)` first note is still a tick late, and this is
      // feedback for something that just happened.
      else if (kind === "shielded") {
        A.tone(784, { duration: 0.09, gain: 0.11 });
        [1047, 1319].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.09, gain: 0.11 }), (i + 1) * 70));
      }
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
      // A purchase confirmation, short and bright — distinct from `build`.
      else if (kind === "buycharge") { A.tone(988, { duration: 0.06, gain: 0.1, type: "square" }); setTimeout(() => A.tone(1319, { duration: 0.06, gain: 0.1, type: "square" }), 70); }
      // A new personal best in endless — the one number that mode is about.
      else if (kind === "newbest") { A.tone(659, { duration: 0.1, gain: 0.13 }); [880, 1047, 1319].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.1, gain: 0.13 }), (i + 1) * 90)); }
      else if (kind === "tier") { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.08, gain: 0.12 }), i * 65)); } // tier-4 branch taken
    } catch (e) { /* audio must never break play */ }
  }

  // ---- TD-6 optional music: a gentle looping lullaby-march via scheduled tones
  //      (the Team-Song setTimeout-composer precedent). OFF by default, behind its
  //      own toggle, mute-gated — never gates gameplay on a timer. ----
  let musicTimer = 0;
  // Two rewrites so far, and each fixed the same complaint one level up.
  // v1 was ONE bare sine walking an 8-note scale up and back, looping every 3.4
  // seconds. v2 (TD-6) made it a real toy-march — melody over a walking bass,
  // AB across 8 bars — and that is what was still playing when the soundtrack
  // was called thin again: ONE key and ONE arrangement, the same in all ten
  // worlds and identical whether you were building in silence or watching a
  // boss walk in. v3 keeps the march and gives it a per-world key, a
  // phase-aware arrangement and a boss voice; see DATA.MUSIC + TDLogic.musicStep.
  //   Still the setTimeout composer — the documented Team-Song precedent —
  // because JoshAudio.tone() only plays at `currentTime` and gameplay is never
  // gated on a timer. Off by default, behind its own toggle, mute-gated, and
  // it re-checks both every step so a mid-song mute really does silence it.
  function stopMusic() { if (musicTimer) { clearTimeout(musicTimer); musicTimer = 0; } }
  // The score itself is DATA (DATA.MUSIC) and the arrangement is a PURE function
  // (TDLogic.musicStep, aliased TD here), so what plays is unit-testable with no
  // audio at all.
  // This is only the player: it keeps the clock, reads the live run for context,
  // and sounds whatever the step returns through the ONE iOS-safe tone().
  function musicCtx() {
    if (!cur) return { phase: "build" };
    const st = cur.engine.state, def = cur.engine.levelDef;
    const w = (def.waves || [])[st.waveIdx];
    // DANGER is the one thing you want to hear without looking at the HUD,
    // because during a wave you are watching the field. A proportion of the
    // run's own starting lives, not a constant: a loadout can start you at 24.
    // A PROPORTION of what this run started with, never of a literal 20 — the
    // score already knew ❤️ Extra Hearts moves that total while the victory
    // screen was printing "24 of 20", which is the codebase disagreeing with
    // itself. Both ask the engine now.
    const danger = st.lives <= Math.max(3, Math.ceil(cur.engine.maxLives() * 0.3));
    return { world: def.world, phase: st.phase === "wave" ? "wave" : "build",
             boss: !!(w && w.boss), danger: danger };
  }
  function startMusic() {
    stopMusic();
    if (!save.settings.music) return;   // NOT gated on Sounds — they are independent
    let i = 0;
    const step = () => {
      try {
        // Music OFF stops the loop; the global 🔇 only skips the NOTES, keeping
        // the loop alive so unmuting resumes mid-phrase instead of needing the
        // music toggled off and on again.
        if (!save.settings.music) { musicTimer = 0; return; }
        if (!audioMuted()) {
          const voices = TD.musicStep(i, musicCtx());
          for (const v of voices) {
            A.tone(v.hz, { duration: v.duration, gain: v.gain, type: v.type, plain: v.plain });
          }
        }
        i += 1;
        musicTimer = setTimeout(step, (DATA.MUSIC && DATA.MUSIC.stepMs) || 190);
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
  let wakeLock = null, wakePending = false;
  // THE predicate: the screen is held awake exactly while a battle is LIVE,
  // visible and unpaused. Having one predicate matters — the first cut acquired
  // in startLevel and released only in stopLoop, so pausing or quitting to the
  // fort mid-run left the lock held indefinitely while you browsed the star
  // tree. (The visibilitychange handler already tested `!cur.paused`, so the
  // code disagreed with itself about whether a paused battle should hold it.)
  function wakeWanted() {
    if (!cur || doc.hidden || cur.paused) return false;
    const ph = cur.engine.state.phase;
    return ph !== "won" && ph !== "lost";
  }
  function keepAwake() {
    try {
      if (!global.navigator || !global.navigator.wakeLock || wakeLock || wakePending) return;
      wakePending = true;
      global.navigator.wakeLock.request("screen").then((wl) => {
        wakePending = false;
        // the request is async — the player may have paused or quit meanwhile
        if (!wakeWanted()) { try { wl.release(); } catch (e) { /* ignore */ } return; }
        wakeLock = wl;
        wl.addEventListener("release", () => { wakeLock = null; });
      }).catch(() => { wakePending = false; wakeLock = null; });
    } catch (e) { wakePending = false; wakeLock = null; }
  }
  function letSleep() {
    try { if (wakeLock) { wakeLock.release(); } } catch (e) { /* ignore */ }
    wakeLock = null;
  }
  // The ONE owner. Every place that can change those conditions calls this, so
  // a future state (a new overlay, a new phase) cannot forget one half.
  function syncWake() { if (wakeWanted()) keepAwake(); else letSleep(); }

  // ---- and the soundtrack's own predicate, which the music never had ----
  // The wake lock got one BECAUSE of exactly this bug, and the music was left
  // with none: it started in startLevel and stopped only in stopLoop, so
  // backgrounding the tab (which auto-pauses the battle) left the loop
  // scheduling — throttled to ~1Hz by the browser, i.e. the march degrades to
  // an arrhythmic drone while you are in another app — and quitting to the
  // fort mid-run played battle music over the menu, with musicCtx() reading a
  // parked run for its build/wave/boss/danger arrangement.
  //
  // Deliberately NOT wakeWanted(). The two agree about a backgrounded tab and
  // a finished run, and differ on PAUSE: a pause menu sits OVER a visible
  // battlefield and should keep its music (which is what games do), while a
  // battle you have navigated away from should not. Gating on "the play screen
  // is not hidden" is the fort's version of the framework-wide law that all
  // speech and cues gate on `!screen.hidden`.
  function musicWanted() {
    if (!save.settings.music || !cur || doc.hidden) return false;
    const play = doc.getElementById("screen-td-play");
    if (play && play.hidden) return false;
    const ph = cur.engine.state.phase;
    return ph !== "won" && ph !== "lost";
  }
  // THE owner. startMusic() restarts the phrase from bar 1, so it must only be
  // reached when the loop is not already running, or every syncRun() — and
  // there is one on each pause, resume and route — would stutter the music.
  function syncMusic() { if (musicWanted()) { if (!musicTimer) startMusic(); } else stopMusic(); }

  // One call for both, so a future state cannot remember the lock and forget
  // the music. This is the thing every site calls; the two halves keep their
  // own predicates because they genuinely disagree about a paused battle.
  function syncRun() { syncWake(); syncMusic(); }
  if (doc.addEventListener) {
    // The browser drops the lock whenever the tab backgrounds, so coming back
    // has to re-acquire — and going away must forget the stale handle.
    doc.addEventListener("visibilitychange", syncRun);
  }

  // The pause menu, hoisted out of togglePause: returning from the background
  // has to be able to re-open it (the battle was auto-paused and nothing said so).
  function showPauseMenu() {
    if (!cur) return;
    const openPause = () => UI.showPause({
      resume: () => { cur.paused = false; cur.autoPaused = false; UI.closeOverlay(); syncRun(); },
      restart: () => {
        // Carry the RUN's difficulty. Dropping it silently converted a Kid Fort
        // run into an adult one (RULE 5 controls gone, defeat reachable).
        const st0 = cur.engine.state;
        const id = cur.levelDef ? cur.levelDef.id : st0.levelId;
        const opts = Object.assign(continueOpts(st0), st0.endless ? { levelDef: cur.levelDef } : {});
        UI.closeOverlay();
        // Same gate as leaving: this discards a live board with no undo.
        promptDiscard(() => startLevel(id, opts), RESTART_COPY);
      },
      // Toggling Sounds must NOT touch the music — that coupling is the bug.
      sfx: () => { save.settings.sfx = !save.settings.sfx; persist(save); openPause(); },
      music: () => { save.settings.music = !save.settings.music; persist(save); syncMusic(); openPause(); },
      dmg: () => { save.settings.dmgNumbers = !save.settings.dmgNumbers; persist(save); if (cur.render.setDamageNumbers) cur.render.setDamageNumbers(save.settings.dmgNumbers); openPause(); },
      quit: () => { UI.closeOverlay(); promptDiscard(() => { location.hash = "#td-home"; }, LEAVE_COPY); },
    }, save.settings,
    // Which level is this? Nothing in a live battle said so.
    UI.runLabel(cur.engine.state.levelId, cur.engine.state.endless, cur.dailyDay,
      { difficulty: cur.engine.state.difficulty, chips: cur.engine.state.chips }));
    openPause();
  }

  function stopLoop() { if (cur && cur.raf) { cancelAnimationFrame(cur.raf); cur.raf = 0; } stopMusic(); letSleep(); }

  // TD-5: award every achievement this outcome earns (skipped on a cheated run).
  function awardWinAchievements(st) {
    if (st.cheated) return;
    if (st.levelId === 1) earnAch("doorman");
    if (st.levelId === 4) earnAch("bossbonker");
    if (st.levelId === 8 && cur.soldiersLost <= 3) earnAch("dysondenied");
    if (st.levelId === 12) earnAch("unplugged");
    if (st.levelId === 16) earnAch("windeddown");
    if (st.levelId === 20) earnAch("toolsdown");
    if (st.levelId === 24) earnAch("notleaving");
    if (st.levelId === 28) earnAch("gooddog");
    if (st.levelId === 32) earnAch("scrapped");
    if (st.levelId === 36) earnAch("pressed");
    if (st.levelId === 40) earnAch("unwrapped");
    if (!cur.leaked) earnAch("noleaks");                    // all 20 stickers kept safe
    if (st.difficulty === "heroic") earnAch("heroicheart");
    const linesUsed = Object.keys(cur.lines);
    if (st.levelId === 2 && linesUsed.length === 1 && linesUsed[0] === "dart") earnAch("peapurist");
    checkStarAchievements();
  }

  // TD-5 Ice Age: 20 enemies slowed at once. ONE owner, because this is the only
  // badge sampled PER FRAME rather than awarded at an outcome — and while it
  // lived inline in loop(), __TD.script (how every fort test advances the
  // engine) never ran it, so a scripted run could reach 23 slowed and earn
  // nothing. The gate and both guards live in here so no call site can forget
  // them; the checks are cheap but run a few times a second, not every tick.
  function sampleIceAge() {
    if (!cur || cur.sawIce || cur.engine.state.cheated) return;
    const st = cur.engine.state, tk = st.tick;
    if ((tk & 7) !== 0) return;
    let slowed = 0;
    for (const e of st.enemies) if (e.alive && tk < e.slowUntil) slowed++;
    if (slowed >= 20) { cur.sawIce = true; earnAch("iceage"); }
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
    // …and the MIRROR of it: a wave STARTING must close the tower panel / build
    // menu. That bubble is absolutely positioned over the field with
    // pointer-events: auto, so left open it both hides and BLOCKS TAPS on a
    // measured 21% of the battlefield — exactly the ground an aimed power (🧨,
    // 🍯) needs, and exactly when the fight starts. The CALL button already
    // cleared it; the countdown simply RUNNING OUT did not, so the two routes
    // into the same state disagreed. One rule here covers both. Opening the
    // panel DURING a wave is untouched — building mid-wave is legal.
    if (st.phase === "wave" && prevPhase === "build") { UI.hideBubble(); cur.render.setSelection(null); }
    if (st.phase === "won") {
      stopLoop();
      // Was the next level ALREADY open before this win? The unlock rule is
      // "beat N with a star → N+1 opens", so it is exactly whether THIS level
      // already carried a star on the RUN's own ladder — read through the same
      // UI.levelBeaten the grid uses, and captured BEFORE the write below,
      // which is the only moment the question is answerable.
      const wasBeaten = UI.levelBeaten(save, st.difficulty, st.levelId);
      if (!st.cheated) {
        // the star lands on the RUN's difficulty ladder (a resumed run can
        // differ from the currently-selected chip — the run's own difficulty
        // is the truth)
        const key = String(st.levelId);
        const lad = save.stars[st.difficulty] || (save.stars[st.difficulty] = {});
        lad[key] = Math.max(lad[key] | 0, st.stars);
        persist(save);
      }
      if (!st.cheated) clearMidRun(); // a kid win must not delete the grown-up's saved run
      awardWinAchievements(st);
      // TD-18: a chip survives to the WIN → it is stamped on this level's card.
      // Campaign levels only (an endless/daily id is a string), never a cheated
      // run, and only chips the data still declares — the same three gates the
      // badges use, because a chip is the same kind of earned record.
      if (!st.cheated && typeof st.levelId === "number" && (st.chips || []).length) {
        const real = new Set((DATA.CHIPS || []).map((c) => c.id));
        const wonHere = save.chipsWon[st.levelId] = save.chipsWon[st.levelId] || [];
        const fresh = st.chips.filter((c) => real.has(c) && wonHere.indexOf(c) < 0);
        if (fresh.length) {
          wonHere.push(...fresh);
          persist(save);
          const names = fresh.map((id) => { const d = DATA.CHIPS.find((c) => c.id === id); return d ? d.icon + " " + d.name : id; });
          announce("🎖️", "<b>Challenge done!</b><br>" + names.join(" · "));
        }
      }
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
      UI.showVictory(st.stars, st.lives, cur.engine.maxLives(), cur.engine.starGoal(), {
        continueOn: () => { UI.closeOverlay(); location.hash = "#td-home"; },
        // A cheated (kid) win unlocks nothing, so it must not offer ▶ Next level —
        // it escaped kid mode into an adult run and promised a lock it never opened.
        nextLevel: nextExists && !st.cheated ? nextId : null,
        nextIsNew: !wasBeaten,
        onNext: nextExists && !st.cheated
          ? () => { UI.closeOverlay(); location.hash = "#td-play"; startLevel(nextId, continueOpts(st)); }
          : null,
      }, runSummary(pb), drainEarned());
    } else if (st.phase === "lost") {
      stopLoop();
      clearMidRun();
      sfx("lost");
      if (st.endless && cur.dailyDay) {
        // TD-18 daily: its own ladder — a daily score never writes the world's
        // endlessBest (that grid is the endless mode's record, and the daily
        // can visit arenas the player has not unlocked there). Marathoner still
        // counts: a daily IS an endless run, and 20 waves is 20 waves.
        const score = st.waveIdx, day = cur.dailyDay;
        recordDaily(score);
        if (!st.cheated && score >= 20) earnAch("marathoner");
        UI.showDefeat({
          retry: () => { UI.closeOverlay(); startDaily(day); },
          quit: () => { UI.closeOverlay(); location.hash = "#td-home"; },
        }, { score, best: save.daily.best | 0 }, null, null, drainEarned());
      } else if (st.endless) {
        const world = cur.levelDef.world, score = st.waveIdx;
        const best = (save.endlessBest[world] || 0);
        if (!st.cheated && score > best) { save.endlessBest[world] = score; persist(save); }
        if (!st.cheated && score >= 20) earnAch("marathoner");
        UI.showDefeat({
          retry: () => { UI.closeOverlay(); startEndless(world, continueOpts(st)); },
          quit: () => { UI.closeOverlay(); location.hash = "#td-home"; },
        }, { score, best: Math.max(best, score) }, null, null, drainEarned());
      } else {
        UI.showDefeat({
          retry: () => { UI.closeOverlay(); startLevel(st.levelId, Object.assign(continueOpts(st), { seed: st.seed })); },
          retrynew: () => { UI.closeOverlay(); startLevel(st.levelId, Object.assign(continueOpts(st), { seed: (Date.now() % 100000) })); },
          quit: () => { UI.closeOverlay(); location.hash = "#td-home"; },
          guide: (type) => { UI.closeOverlay(); UI.showGuide(type); },
        }, null, postMortem(), runSummary(false), drainEarned());
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
    const NAME = { dart: "🎯 Dart", mortar: "💥 Mortar", fan: "❄️ Fan", camp: "🪖 Camp", ability: "🧨 Abilities" };
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
    // Did that wave come in through a SIDE DOOR? Derived from the level's own
    // wave table rather than tracked on the enemy, so it costs the engine
    // nothing. It matters because it is the one defeat whose fix is POSITIONAL:
    // no change of tower line helps if part of the wave walks in behind your
    // guns, and the counter-matrix advice above would otherwise send you off to
    // rebuild for the wrong reason.
    const lw = (cur.engine.levelDef.waves || [])[(cur.leakWave || cur.engine.state.waveIdx + 1) - 1];
    const flank = lw ? lw.groups.filter((g) => g.at > 0).reduce((n, g) => n + g.count, 0) : 0;
    return {
      flank: flank,
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
        // A SHIELDED leak costs nothing, so it must not SOUND like a
        // catastrophe. 🌟 Sticker Shield is a 6⭐ capstone behind an 8⭐ in-branch
        // spend whose entire effect is this one moment, and the moment was
        // presented exactly like losing stickers — same descending cue, same red
        // wash — while the lives counter did not move, which reads as a bug
        // rather than as a rescue. The tell was two adjacent lines disagreeing:
        // the renderer's toll label already checked `shielded` and nothing else
        // in either dispatcher did.
        //   `cur.leaked` and the post-mortem count deliberately do NOT change:
        // the body genuinely got past you, and 🛡️ No Leaks staying honest about
        // that is a documented choice, not an oversight.
        sfx(e.shielded ? "shielded" : "leak"); cur.leaked = true;
        // TD-12 post-mortem: WHICH toy got through, and on which wave. The
        // defeat screen used to say only "the toys got sleepy" — no diagnosis
        // at all — even though the engine already emits everything needed.
        cur.leaks = cur.leaks || {};
        cur.leaks[e.enemy] = (cur.leaks[e.enemy] || 0) + 1;
        cur.leakWave = cur.engine.state.waveIdx + 1;
      }
      // Every other purchase in the fort rings — build, upgrade, sell, a tier-4
      // branch. Spending 450 gold on ⚙️ Toy Energy emitted `buycharge` and
      // NOTHING listened: it was one of exactly two event types with no consumer
      // in either dispatcher, found by diffing the engine's emit list against
      // both of them.
      else if (e.type === "buycharge") sfx("buycharge");
      // ENDLESS has ONE number that matters — the wave you reached — and it was
      // revealed only on the defeat screen, after the run. Passing your own
      // record is the moment the mode exists for, so it is announced when it
      // happens. Once per run, and only when there IS a record: a first visit has
      // nothing to say, and a banner on every wave after the record would be
      // furniture rather than a signal. A DAILY is excluded because it scores on
      // its own ladder and never writes the world's endlessBest.
      else if (e.type === "endless-wave") {
        if (!cur.dailyDay && !cur.bestBeaten && cur.endlessRecord > 0 && e.n > cur.endlessRecord) {
          cur.bestBeaten = true;
          UI.showBanner("🏆 New best — wave " + e.n + "!");
          sfx("newbest");
        }
      }
      else if (e.type === "soldier-down") cur.soldiersLost += 1; // TD-5 Dyson Denied tracking
      else if (e.type === "wave") sfx("wave");
      else if (e.type === "ability") sfx("ability"); // a power actually landed
      else if (e.type === "chain") sfx("chain");
      else if (e.type === "splash") sfx("splash");
      else if (e.type === "strip") sfx("strip"); // 🎯 a Rust Ray softening a body
      else if (e.type === "boss") { UI.showBanner("⚠️ " + e.name + " incoming!"); sfx("boss"); }
      else if (e.type === "phase") { UI.showBanner("⚠️ " + e.name + " is getting angrier!"); sfx("phase"); }
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
    sampleIceAge();
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

  // Prices paint from the LIVE engine gold, not a cached figure — one owner,
  // read at the moment a dialog is built.
  if (UI.setGoldSource) UI.setGoldSource(() => (cur && cur.engine) ? cur.engine.state.gold : 0);
  // CONTINUING a run — retry, retry-with-a-new-shuffle, restart, or ▶ Next — must
  // carry that RUN's rules, not whatever the fort home happens to be set to now.
  // The two can genuinely disagree: park a heroic run, switch the chip to Easy,
  // resume (the checkpoint restores heroic), lose — and the shipped retry
  // handed you a CASUAL run, so a win there wrote a casual star for what the
  // screen had called Hard. Reproduced before it was fixed. Three siblings had
  // two policies (restart and ▶ Next carried the difficulty, retry carried
  // nothing) and none of the four carried the CHIPS, so a resumed challenge run
  // silently stopped being a challenge on every one of those paths.
  //   Deliberately NOT meta/powers: those are a fort-home loadout that every
  // start re-reads, including the very first one, whereas the difficulty and the
  // chips cannot be changed from the play screen and decide how a win is SCORED.
  function continueOpts(st) {
    return { difficulty: st.difficulty, chips: (st.chips || []).slice() };
  }
  if (UI.setEngineSource) UI.setEngineSource(() => (cur && cur.engine) ? cur.engine : null);
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
    // TD-5: the star-tree nodes flow in as pure engine input; a test hook may
    // override per-call (opts.meta). P4: what a RUN brings is the equipped
    // LOADOUT, not everything owned — one owner, so the engine, the checkpoint
    // and the UI can never disagree about which nodes are live.
    const meta = opts.meta || activeLoadout();
    // P6: the POWERS this run brings, through the same one owner. The engine's
    // own default is the whole pool (so sims stay unchanged); a real run is
    // always handed its equipped, slot-capped four.
    const powers = opts.powers || activePowers();
    // TD-18: the CHIPS this run is constrained by. An explicit [] (a resumed
    // legacy checkpoint) stays empty — `[] || x` keeps the array — while an
    // ordinary start reads whatever the player armed on the fort home.
    const chips = opts.chips || activeChips();
    const engine = TD.createEngine(levelDef, { seed: opts.seed == null ? (Date.now() % 100000) : opts.seed, difficulty, meta, powers, chips });
    const render = R.create(UI.canvas, engine);
    if (render.setDamageNumbers) render.setDamageNumbers(save.settings.dmgNumbers); // TD-6 opt-in numbers
    cur = { engine, render, levelDef, raf: 0, acc: 0, lastT: 0, speed: save.settings.speed || 1, paused: false, selPadId: null, selTowerId: null,
      lines: {}, soldiersLost: 0, sawKill: false, lastBuildWave: -1, // TD-5 achievement context
      leaks: {}, leakWave: 0, // TD-12 post-mortem context (the tallies live in engine state)
      // The endless record to beat, read ONCE off the save and kept on the RUN.
      // Same reasoning as the checkpoint reading its rules off the run rather
      // than the save: a record that moved mid-run (a second tab, or this run's
      // own defeat write) would silently re-arm or disarm the announcement.
      endlessRecord: engine.state.endless && levelDef && levelDef.world
        ? (save.endlessBest[levelDef.world] | 0) : 0,
      bestBeaten: false };
    // The HUD reads the CALL/RUSH offer straight off the engine, so the button
    // can never promise gold the engine would refuse (the dead-control lesson).
    UI._callInfo = () => (cur ? cur.engine.callInfo() : null);
    // Where the LANES are, in canvas coordinates. The next-wave pill floats over
    // the field, and once it started staying up during a WAVE it began covering
    // the bodies walking in on 10 of the 40 maps — a control that cannot steal a
    // tap can still hide the thing you are deciding about. The pill picks its own
    // corner from this; only td-main has both the level's lanes and the render's
    // one world↔screen mapping, and only the UI knows how wide the pill is, so
    // the geometry is injected and the choice is made where the width lives.
    UI._lanePts = () => {
      if (!cur) return [];
      const out = [];
      for (const path of (cur.levelDef.paths || [cur.levelDef.path] || [])) {
        for (const pt of path || []) {
          const s = cur.render.worldToScreen(pt[0] + 0.5, pt[1] + 0.5);
          out.push({ x: s.x, y: s.y });
        }
      }
      return out;
    };
    syncRun();   // starts the march and holds the screen awake, under one predicate each
    UI.closeOverlay();
    UI.hideBubble();
    if (UI.hideBanner) UI.hideBanner(); // never inherit the previous level's boss klaxon
    if (UI.abilityStrip) UI.abilityStrip(engine.state.powers); // P6: the strip IS the run's loadout
    UI.hud(engine.state);
    const speedBtn = doc.querySelector("#screen-td-play .td-speed");
    if (speedBtn) speedBtn.textContent = cur.speed + "×";
    render.resize();
    render.draw(0);
    cur.raf = requestAnimationFrame(frame);
  }

  // `opts` is how an endless RETRY continues the run's own rules; the picker on
  // the fort home passes none, so choosing an arena there correctly reads what
  // is selected now. endlessBest is not keyed by difficulty, so a silent switch
  // mid-session would put two different games on one scoreboard.
  function startEndless(world, opts) {
    location.hash = "#td-play";
    startLevel(null, Object.assign({ levelDef: endlessLevelDef(world) }, opts || {}));
  }

  // ---- TD-18 DAILY TOYBOX ----
  // A fresh puzzle every day, for free, because the engine is deterministic by
  // seed — the same property the whole test strategy rests on. The SHELL reads
  // the calendar (Date is banned inside the engine, and startLevel already
  // seeds ordinary runs from Date.now()); the engine just gets numbers.
  function dayKey(d) {
    const t = d || new Date();
    // LOCAL date, not UTC: "today's puzzle" should roll over at Jon's midnight.
    return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
  }
  // Three independently-seeded draws from one day string. FNV alone with
  // different seeds is only weakly decorrelated (measured 36/40 in the sticker
  // work), so each stream gets the murmur3 finalizer — the fix that took the
  // seals to 40/40.
  function dayHash(day, seed) {
    let h = seed >>> 0;
    for (const ch of day) h = ((h ^ ch.codePointAt(0)) * 16777619) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }
  function dailyPick(day) {
    const worlds = Object.keys(DATA.ENDLESS.arenas);        // DERIVED — a new arena joins the rotation by existing
    const world = worlds[dayHash(day, 2166136261) % worlds.length];
    // one day in (chips+1) is unmodified — a breather is part of the rotation
    const mods = [null].concat((DATA.CHIPS || []).map((c) => c.id));
    const chip = mods[dayHash(day, 0x9e3779b1) % mods.length];
    const seed = dayHash(day, 0x85ebca6b) % 100000;
    return { day, world, chip, seed };
  }
  function startDaily(dayOverride) {
    const pick = dailyPick(dayOverride || dayKey());
    location.hash = "#td-play";
    // Difficulty pinned to NORMAL so the day's board is the same board no
    // matter where the fort-home chip sits — a daily is one shared puzzle.
    startLevel(null, { levelDef: endlessLevelDef(pick.world), seed: pick.seed,
      difficulty: "normal", chips: pick.chip ? [pick.chip] : [] });
    if (cur) cur.dailyDay = pick.day;
  }
  // Score a finished/abandoned daily. ONE owner called from both exits (the
  // lost branch and leavingPlay) — the endless-milestone lesson: a record kept
  // only on defeat is lost on a quit.
  function recordDaily(score) {
    if (!cur || !cur.dailyDay || cur.engine.state.cheated) return;
    const d = save.daily;
    if (d.day === cur.dailyDay) d.best = Math.max(d.best | 0, score);
    else { d.day = cur.dailyDay; d.best = score; }
    d.allTime = Math.max(d.allTime | 0, score);
    persist(save);
  }

  // ---- TD-5 mid-run checkpoint (§9.3): snapshot at each wave boundary, restore
  //      on Resume, clear on win/loss/quit. Only towers + scalars — honest
  //      wave-granularity (mid-wave enemy positions are NOT saved). ----
  function writeMidRun() {
    if (!cur || cur.engine.state.cheated) return;
    // TD-18: a daily is a single sitting, deliberately — resuming YESTERDAY'S
    // daily today would score a stale board under a fresh day, and carrying the
    // day key through the checkpoint buys that ambiguity for no real gain.
    // Quitting a daily records its score on the way out instead (leavingPlay).
    if (cur.dailyDay) return;
    const st = cur.engine.state;
    if (st.phase !== "build") return;
    save.midRun = {
      levelId: st.levelId, endless: st.endless, world: cur.levelDef.world,
      difficulty: st.difficulty, seed: st.seed, waveIdx: st.waveIdx,
      // the LOADOUT, not everything owned: handing a resumed run every node you
      // have ever bought is the checkpoint-fidelity bug class, now on its
      // seventh instance (leaked / soldiersLost / lines / leverRoute / shieldUsed / charge)
      // — and read off the RUN (st.meta), exactly like powers and chips below.
      // It used to call activeLoadout(), which reads the SAVE: park a run, respec
      // on the fort home, resume, play one wave, and phaseWatch rewrote the
      // checkpoint with the NEW loadout while the live engine still ran the old
      // one, so the next resume silently changed the run's rules. Two of these
      // three siblings had the right policy and one did not — the shape that
      // gave hurriedMult two writers and drifted the wake lock apart.
      // ...and the POWERS, for the same reason: the checkpoint must carry
      // everything the resumed run's rules depend on, or a run resumed after the
      // pool changed comes back with a strip it never chose. Read off the RUN
      // (st.powers), not the save, so a loadout edited while a run is parked
      // cannot retroactively rewrite the run that is being restored.
      gold: st.gold, lives: st.lives, meta: (st.meta || []).slice(), powers: (st.powers || []).slice(),
      // TD-18: the CHIPS, same law — a resumed challenge run must still be the
      // challenge, read off the RUN so re-arming chips while one is parked
      // cannot retroactively loosen (or tighten) the run being restored.
      chips: (st.chips || []).slice(),
      // achievement context so a resumed win is judged against the WHOLE run,
      // not just the post-resume slice (No Leaks / Dyson Denied / First Blood).
      leaked: !!cur.leaked, soldiersLost: cur.soldiersLost || 0, sawKill: !!cur.sawKill,
      shieldUsed: !!st.shieldUsed, // TD-8: a spent 🌟 Sticker Shield stays spent across a resume (else the free leak re-grants per segment)
      charge: st.charge || 0,     // ⚙️ Toy Energy is per-RUN, so it rides the checkpoint (the shieldUsed precedent — that one shipped missing once)
      // TD-17: the diversion is TIMED, so it deliberately does NOT ride the
      // checkpoint. Saving leverRoute:1 without its expiry tick would restore a
      // PERMANENT diversion — reintroducing exactly the free-upgrade this phase
      // removed — and an absolute expiry from an old run is meaningless in a
      // fresh engine (the same reasoning that already kept leverCd out). A
      // checkpoint is a wave boundary and the diversion lasts seconds, so a
      // resumed run correctly comes back on the short route with the lever armed.
      // The build COUNTDOWN, or a resume hands back a full build phase every
      // time — and the early-call bonus is computed from it, so quitting at 1
      // second left and resuming turned "gold traded for build time" into free
      // gold, once per wave, for as many waves as you cared to cycle.
      countdown: st.countdown,
      // The run tallies the summary screen reports. Rebuilding towers through
      // engine.place() re-earns nothing, so without these a resumed run showed
      // only its post-resume damage and called it the whole run.
      dmgBy: Object.assign({}, st.dmgBy), kills: st.kills, goldEarned: st.goldEarned,
      towers: st.towers.map((t) => ({ lineId: t.lineId, tier: t.tier, branch: t.branch, padId: t.padId, targeting: t.targeting, rallyX: t.rallyX, rallyY: t.rallyY })),
    };
    persist(save);
  }
  function clearMidRun() { if (save.midRun) { save.midRun = null; persist(save); } }

  // DISCARD the saved run — the ✕ on the fort's Resume banner. This has to be
  // ONE owner, because clearing the checkpoint alone does not hold: if a run is
  // still LIVE and parked in its build phase, the very next `route("td-home")`
  // calls leavingPlay() → writeMidRun() and puts the checkpoint straight back,
  // so the banner never went away and the button read as broken. (It only
  // misbehaved for a game IN PROGRESS — quitting mid-WAVE writes no checkpoint,
  // so the ✕ appeared to work, which is what made it look intermittent.)
  //
  // "There is no saved run" and "a live run is about to check-point itself" are
  // contradictory states, so discarding must ABANDON the run as well as erase
  // the checkpoint: stop the loop, drop `cur`, then clear. Anything that wants
  // to throw a run away goes through here — the reset button used to keep its
  // own copy of `stopLoop(); cur = null;`, and two copies of a teardown is
  // exactly how the wake lock's acquire and release paths drifted apart.
  function abandonRun() { stopLoop(); cur = null; }
  function discardRun() { abandonRun(); clearMidRun(); }

  // Called whenever we navigate AWAY from a live battle (to the fort or out of
  // the fort). (1) An endless run that's quit — not lost — still earned its
  // wave: record the best score + Marathoner here, since phaseWatch only fires
  // those on defeat. (2) Clear transient field-interaction state so a
  // half-armed camp rally (or a stale selection) can't eat the first pad tap
  // on the next visit.
  function leavingPlay() {
    if (!cur) return;
    const st = cur.engine && cur.engine.state;
    // Refresh the checkpoint with the state you are actually LEAVING. It used
    // to hold the wave boundary only, so towers bought during this build phase
    // were silently lost on resume — and the stale countdown was the free-gold
    // hole above. Wave-boundary granularity is unchanged: quitting mid-WAVE
    // still keeps the last build checkpoint (writeMidRun refuses otherwise).
    if (st && st.phase === "build") writeMidRun();
    if (st && st.endless && !st.cheated && st.phase !== "won" && st.phase !== "lost") {
      const score = st.waveIdx;
      if (cur.dailyDay) {
        // TD-18: a quit daily still records — the endless-milestone lesson —
        // and never touches the world's endlessBest ladder.
        recordDaily(score);
      } else {
        const world = cur.levelDef.world;
        if (score > (save.endlessBest[world] || 0)) { save.endlessBest[world] = score; persist(save); }
      }
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
    // The towers array below is coerced (`Array.isArray(mr.towers) ? … : []`)
    // because a malformed backup once threw "mr.towers is not iterable" here.
    // The SCALARS beside it were never given the same treatment — the same
    // function disagreeing with itself, which is the smell that found the wake
    // lock and the soundtrack. A restored backup is a PASTE, validated only as
    // "parses, is an object, v === 1, stars is an object", so a truncated or
    // hand-edited one arrives here intact.
    //
    // And a junk waveIdx does not fail politely. Verified against the engine:
    // the board comes back looking perfectly correct and the FIRST ▶ CALL
    // throws "Cannot read properties of null (reading 'groups')" inside the
    // click handler, so the run simply freezes in build with nothing said.
    //
    // DISCARD rather than clamp: resuming at a silently-corrected wave with
    // the saved gold is a worse lie than "that run could not be read", and it
    // matches the !levelDef branch one line up.
    //
    // Endless has no wave TABLE — its waves are generated — so it needs its own
    // bound or every endless resume would be thrown away. 1000 is far past any
    // reachable run (the budget is 300·1.16^n, already 1e33 by wave 500) and
    // far below where the generator goes non-finite, so anything above it is
    // corruption rather than play.
    // A real finite NUMBER, not a coercible one: Number(null) is 0 and
    // Number("2") is 2, so coercing would wave through a null `lives` (a run
    // that is dead on arrival) while looking like it had checked. An integer
    // wave, too — waves[1.5] is undefined and throws exactly like waves[999].
    const num = (v) => typeof v === "number" && Number.isFinite(v);
    const maxWave = levelDef.endless ? 1000 : (levelDef.waves || []).length;
    if (!num(mr.waveIdx) || mr.waveIdx !== Math.floor(mr.waveIdx) ||
        mr.waveIdx < 0 || mr.waveIdx >= maxWave || !num(mr.gold) || !num(mr.lives)) {
      clearMidRun(); location.hash = "#td-home"; return;
    }
    location.hash = "#td-play";
    // A legacy checkpoint has no `powers` — fall through to the live loadout,
    // which is what a pre-P6 resume effectively did. A legacy checkpoint has no
    // `chips` either → an unconstrained run, matching what it was when parked
    // (a chipped checkpoint's towers are all legal lines by construction, so
    // the rebuild below can never be refused by its own run's ban).
    // meta is guarded like its two neighbours, which it was not: a restored
    // backup is a PASTE, and `metaMods` opens with `new Set(meta || [])`, so an
    // object/number/boolean throws "is not iterable" INSIDE createEngine —
    // measured, not assumed — and tapping Resume simply breaks the fort. Three
    // fields on one line, two guarded and one not, is the same smell that had
    // `meta` reading the save while powers and chips read the run.
    //
    // Not `&& .length` like powers, deliberately: an EMPTY loadout is a real
    // choice (bring nothing), and falling back to activeLoadout() there would
    // hand a deliberately-empty run whatever is equipped NOW — reintroducing
    // the very bug fixed one function up. `[] || x` is `[]`, so startLevel
    // keeps it. Only a NON-array falls through to the live loadout, which is
    // exactly what a legacy pre-P4 checkpoint (no meta at all) already does.
    startLevel(mr.levelId, { levelDef, seed: mr.seed, difficulty: mr.difficulty,
      meta: Array.isArray(mr.meta) ? mr.meta : null,
      powers: Array.isArray(mr.powers) && mr.powers.length ? mr.powers : null,
      chips: Array.isArray(mr.chips) ? mr.chips : [] });
    // Carry the pre-checkpoint achievement context across the resume so the win
    // is judged honestly against the whole run (startLevel reset these to fresh).
    cur.leaked = !!mr.leaked;
    cur.soldiersLost = mr.soldiersLost || 0;
    cur.sawKill = !!mr.sawKill;
    // Cold restore: set the checkpoint directly (no leaky fast-forward). The
    // engine schedules the correct next wave from state.waveIdx on the next CALL.
    const e = cur.engine;
    const bumpGold = () => { e.state.gold = 9e9; }; // rebuild is already "paid" in mr.gold
    // A restored BACKUP can carry anything — a midRun whose `towers` is not an
    // array threw "mr.towers is not iterable" and killed the whole resume.
    for (const t of (Array.isArray(mr.towers) ? mr.towers : [])) {
      if (!t || typeof t !== "object") continue;
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
    // A legacy checkpoint has no charge; give it a wave's worth rather than
    // zero, so an old saved run is never resumed into a dead power strip.
    // THIS run's wave, from the engine — 🔋 Spare Battery makes it bigger, and
    // the raw rule would quietly hand an owning run less than a wave.
    e.state.charge = mr.charge === undefined ? e.chargeGrant() : mr.charge;
    e.state.leverRoute = 0; e.state.leverUntil = 0; e.state.leverCd = 0; // TD-17: resume on the short route, lever armed (a timed diversion cannot be checkpointed — see writeMidRun)
    // legacy midRun saves lack these → keep the fresh values (a full countdown,
    // a zeroed tally), which is exactly what a pre-fix resume already did
    if (typeof mr.countdown === "number") e.state.countdown = mr.countdown;
    if (mr.dmgBy) e.state.dmgBy = Object.assign({}, mr.dmgBy);
    if (typeof mr.kills === "number") e.state.kills = mr.kills;
    if (typeof mr.goldEarned === "number") e.state.goldEarned = mr.goldEarned;
    e.state.phase = "build"; e.state.cheated = false; // restored progress is honest
    cur.lastBuildWave = mr.waveIdx; // don't immediately re-checkpoint the restore
    cur.render.afterTick(); cur.render.resize(); cur.render.draw(0); UI.hud(e.state);
  }

  // A compact stat line for the tower panel — so the player can read what a
  // tower actually does at its current tier (premium-TD table stakes).
  function statLine(t, tierAt) {
    const def = DATA.TOWERS[t.lineId];
    const tier = tierAt || t.tier;
    // ASK THE ENGINE. These are the numbers the tower actually fights with —
    // night, 🦉, ⚡ a power pad and 🧊 Tail Wind all move the range, and five
    // star-tree nodes move dps/splash/aura/soldier-hp/crit. Read from DATA this
    // line said "3 rng" on a night level while the ring beside it drew 2.55.
    const s = (cur && cur.engine.towerStats && cur.engine.towerStats(t.id, tierAt))
      || ((tier === 4 && t.branch) ? def.branches[t.branch] : def.tiers[tier - 1]);
    // Engine values are floats (2.4 aura + 0.3 Cold Front is 2.7000000000000002,
    // and a night range is 2.5499999…), so every number is formatted rather than
    // concatenated — a stat line reading "2.7000000000000002 aura" would be a
    // worse bug than the stale one this replaced.
    const num = (v) => String(Math.round(v * 100) / 100);
    if (t.lineId === "fan") {
      let str = "❄️ " + Math.round(s.slow * 100) + "% slow · " + num(s.auraRange) + " aura";
      if (s.chain) str += " · chain"; else if (s.zapDps) str += " · " + s.zapDps + " zap";
      return str + roadTxt(t, tier);
    }
    if (t.lineId === "camp") {
      const dps = s.soldiers * s.dmg / s.rate;
      return "🪖 " + s.soldiers + "×" + s.hp + "hp · " + dps.toFixed(0) + " dps";
    }
    const dps = s.dmg / s.rate; // dart / mortar
    let str = dps.toFixed(0) + " dps · " + num(s.range) + " rng";
    if (s.splash) str += " · 💥" + num(s.splash);
    if (s.crit) str += " · crit";
    return str + roadTxt(t, tier);
  }

  // How much of the lane this tower actually reaches from the pad it stands on.
  // A built tower's placement is otherwise invisible: the panel states dps and
  // range, and a 3-cell reach is worth 25% of the road on one pad and 5% on
  // another — a difference the branch audit measured at up to 5 lives. Asked of
  // the ENGINE (night, 🦉, ⚡ and 🎯 all live in there), and the tower's own
  // branch is passed so a tier-4 reads its OWN reach rather than tier 3's.
  function roadTxt(t, tierAt) {
    if (!cur || !cur.engine.coverageOf) return "";
    const c = cur.engine.coverageOf(t.lineId, tierAt || t.tier, t.cx, t.cy, t.branch);
    return c == null ? "" : " · " + (c * 100).toFixed(0) + "% road";
  }

  // Is a real level running (something to lose)? build/wave only — not won/lost.
  function inLevel() {
    return !!(cur && cur.engine && (cur.engine.state.phase === "build" || cur.engine.state.phase === "wave"));
  }
  // Guard any exit that abandons the level: confirm first, pausing the battle
  // while the player decides so nothing leaks. "Keep playing" resumes.
  // The ONE owner. Every action that throws a live battle away goes through this
  // — leaving to the fort AND restarting the level. They shipped with opposite
  // policies: 🏠 confirmed, while 🔁 Restart tore the board down on one tap,
  // from the row DIRECTLY BELOW ▶ Resume, which is the button you press most.
  // Two adjacent siblings disagreeing about the same rule is this project's
  // recurring tell (hurriedMult's two writers; the wake lock's drifted acquire
  // and release; writeMidRun's three fields with two policies), and restarting
  // is if anything the worse of the two — leaving at least keeps the last
  // wave-boundary checkpoint, restarting keeps nothing.
  function promptDiscard(onGo, copy) {
    if (!inLevel()) { onGo(); return; }
    cur.paused = true; syncRun(); // a battle paused behind a confirm must not hold the screen awake
    UI.confirm({
      title: copy.title,
      msg: "You'll lose your progress on this level.",
      yes: copy.yes, no: "↩ Keep playing",
      onYes: () => { UI.closeOverlay(); onGo(); },
      onNo: () => { UI.closeOverlay(); if (cur) { cur.paused = false; syncRun(); } }, // keep-playing resumes the battle — take the lock back
    });
  }
  const LEAVE_COPY = { title: "Leave the battle?", yes: "🏰 Leave" };
  const RESTART_COPY = { title: "Start this level over?", yes: "🔁 Restart" };

  // 🎯 The ONE owner of remembered aim. A freshly placed tower opens on whatever
  // mode you last chose for THAT line, so a board can be aimed once instead of
  // tower by tower. Three deliberate limits keep it a pure tap-saver rather than
  // a new power: it applies only at place() time (a tier-4 branch's own
  // `defaultTargeting` — the Sniper's `strong` — is a declaration, not a
  // leftover, so branching is left alone); it goes through the engine's own
  // setTargeting, so a `cheap` remembered from before a respec is refused
  // (`locked`) and the line's default simply stands; and every mode it can set
  // is one the player could set by hand, so no sim moves — the auto-solver never
  // calls setTargeting at all.
  function applyAim(lineId, padId) {
    const want = save.settings.aim && save.settings.aim[lineId];
    if (!want || !cur || !cur.engine) return;
    const t = cur.engine.state.towers.find((x) => x.padId === padId);
    if (t) cur.engine.setTargeting(t.id, want);
  }

  // Plain-English refusals. A power that silently declines reads as broken —
  // and one that charges you for nothing reads worse.
  function abilityWhy(reason, def) {
    const name = def ? def.name : "That";
    if (reason === "chip") return "🔇 Powers are off for this challenge — Quiet Hands is armed";
    if (reason === "not-in-wave") return "⏳ " + name + " only works during a wave";
    if (reason === "gold") return "🪙 Not enough gold for " + name + " (" + (def ? def.gold : "?") + ")";
    if (reason === "cooldown") return "⏱ " + name + " is still recharging";
    // THIS run's grant, not the raw rule: 🔋 Spare Battery adds to it, so an
    // owning run was told it banks less than it does (the sell-refund class).
    if (reason === "charge") return "⚙️ Out of toy energy — you get " + cur.engine.chargeGrant() + " more each wave";
    if (reason === "no-targets") return "🎯 Nothing in the blast — tap closer to the toys";
    if (reason === "no-soldiers") return "🪖 No soldiers to rally — build an Army Guys camp first";
    if (reason === "all-healthy") return "🪖 Your squad is already up and at full health";
    if (reason === "no-tower") return "⚡ Tap one of your towers to overclock it";
    return name + " can't be used right now";
  }

  // ---- Field input: tap pads to build, towers to manage ----
  // What a targeting mode is CALLED, for the player. Exactly one mode's name
  // differs from its engine id — `cheap` is shown as "weakest", because the mode
  // finishes the almost-dead and "cheap" reads as something about gold — and
  // that is precisely the one this used to get wrong: the panel's initial render
  // read `.name` while the cycle handler eighty lines below printed the raw id,
  // so the mode you pay 6⭐ for was labelled "weakest" until you tapped to select
  // it and then became "cheap". Two owners of one string, disagreeing on the one
  // string that mattered. The fallback keeps a name-less sixth mode readable
  // rather than rendering `undefined`.
  function targetName(mode) {
    return ((DATA.TARGETING || {})[mode] || {}).name || mode;
  }

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
        // screenToWorld gives WORLD units (the centre of cell 10,5 is 10.5,5.5);
        // the engine measures everything — enemy positions, pads, puddles — in
        // CELL-INDEX space. The tower pick above already converts (`cx + 0.5`);
        // a point ability must too, or the blast lands 0.7 cells down-right of
        // the finger and an enemy visibly inside the puddle isn't slowed.
        r = cur.engine.useAbility(id, { x: gx - 0.5, y: gy - 0.5 });
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
      const r = cur.engine.rally(armed, gx, gy);
      if (r.ok) {
        cur.rallyArmId = 0;
        UI.hideBubble();
        cur.render.setSelection({ tower: armed });
        sfx("build");
        UI.abilityHint("");
        return;
      }
      // A REFUSED rally used to be completely silent: no cue, no reason, the arm
      // consumed and — worst of all — `setSelection(null)`, which deletes the
      // camp's rallyRange RING, i.e. the one guide you would aim by. So a tap a
      // few pixels too far evaporated the whole interaction and you had to
      // reopen the panel to try again. Abilities got exactly this treatment
      // twenty lines up (a deny cue plus a reason on the shared hint line) and
      // the one other armed, aimed control never did — two adjacent handlers
      // disagreeing, this file's most reliable tell.
      //   The arm and the selection are BOTH kept, so the next tap can simply be
      // closer; leaving the play screen still clears the arm, as it always has.
      sfx("deny");
      cur.render.setSelection({ tower: armed });
      UI.abilityHint(r.reason === "range"
        ? "🚩 Too far from the camp — tap inside the ring"
        : "🚩 That spot will not take a flag");
      return;
    }
    // TD-7: tap the track-switch lever to send the train the long way
    const lever = cur.engine.levelDef.lever;
    if (lever && (lever.cx + 0.5 - gx) ** 2 + (lever.cy + 0.5 - gy) ** 2 <= 0.95 * 0.95) {
      const r = cur.engine.pullLever();
      UI.hideBubble(); cur.render.setSelection(null);
      cur.selPadId = null; cur.selTowerId = null;
      // TD-17: say WHY a refused tap did nothing. The lever now has three
      // refusals (mid-diversion, cooling down, not in a wave) where it used to
      // have one, and a silent blip is the exact defect the abilities' hint line
      // was added to fix — so it reuses that line rather than growing its own.
      if (r.ok) { sfx("lever"); UI.abilityHint(""); }
      else {
        sfx("deny");
        UI.abilityHint(
          r.reason === "running" ? "🔀 Already running — it snaps back on its own"
          : r.reason === "cooldown" ? "⏳ The switch is resetting"
          : r.reason === "not-in-wave" ? "⏳ The switch only works during a wave"
          : "");
      }
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
      // ---- build menu: every toy line, priced; unaffordable ones dim ----
      cur.selPadId = pad.id;
      // The ghost ring is the dart's reach as a reference, asked of the ENGINE so
      // it carries night dimming and this pad's ⚡ boost — the shipped literal
      // showed the same circle on a power pad as on an ordinary one.
      cur.render.setSelection({ pad, ghostRange: cur.engine.reachAt("dart", 1, pad.cx, pad.cy) });
      const gold = cur.engine.state.gold;
      // DERIVED from the data, never a written literal. This was
      // `["dart","mortar","fan","camp"]` — the same shape as the
      // `TOTAL_PLANNED = 12` that left a whole world's levels with no card and
      // unreachable by the player. A 5th tower line is a real design decision
      // (and is currently recorded as NO, because neither oracle plan would buy
      // it, so it would ship provably untested as a feature) — but if one is
      // ever added, it must not ALSO need a code hunt to become buyable.
      // `.td-buildmenu` is a wrapping 2-column grid, so a 5th button costs no
      // layout, unlike the ability strip's hard four.
      const lines = Object.keys(DATA.TOWERS);
      UI.showBubble(
        '<div class="td-buildmenu">' +
        lines.map((id) => {
          const d = DATA.TOWERS[id];
          // ASK THE ENGINE, never re-derive from DATA: a meta discount applies
          // inside the engine, so a locally-computed price can show a number the
          // engine does not charge (and grey the button out at golds that CAN
          // afford it). Building is undiscounted today; it routes through the
          // same owner so the next economy node cannot reintroduce that.
          const cost = cur.engine.priceOf("build", id);
          // icon + ROLE (single-shot / splash / slows / blocks path) + price, so
          // a player knows what each toy DOES, not just what it costs.
          // data-cost lets UI.prices() re-colour this LIVE as gold comes in —
          // red while you can't afford it, green the moment you can, without
          // closing and reopening the dialog.
          // LANE COVERAGE — how much of the road this toy can actually shoot
          // FROM THIS PAD. Placement was the fort's biggest invisible decision:
          // the branch audit measured up to 5 lives from which tower you
          // convert, and a pad's worth was unknowable until after you had spent
          // the gold. Asked of the ENGINE, never re-derived, because night
          // dimming, 🦉 Night Owl, ⚡ a power pad and 🎯 Close Quarters all live
          // in there — the same rule the prices needed. A Camp returns null (it
          // blocks rather than shoots) and simply shows no figure, rather than a
          // percentage that would assert something false about it.
          const cov = cur.engine.coverageOf(id, 1, pad.cx, pad.cy);
          const covTxt = cov == null ? "" :
            '<span class="td-buy__cov" title="how much of the road this reaches from here">' +
            (cov * 100).toFixed(0) + "% road</span>";
          // TD-18: a chip-banned line renders LOCKED, asked of the ENGINE (the
          // ban lives on the run). It deliberately carries NO data-cost —
          // paintPrices re-enables every affordable [data-cost] button on each
          // repaint, so a priced-but-banned button would flick back tappable.
          // No price shown either: a price on a thing this run may never buy is
          // noise, and the role line says exactly why it refuses instead of the
          // button reading as broken (the dead-control law).
          const banned = cur.engine.lineAllowed && !cur.engine.lineAllowed(id);
          if (banned) {
            return '<button class="td-buy td-buy--chipban" data-line="' + id + '" type="button" disabled>' +
              '<span class="td-buy__icon">' + d.icon + "</span>" +
              '<span class="td-buy__role">off for this challenge</span>' +
              '<span class="td-buy__cost">🎖️</span>' +
              "</button>";
          }
          return '<button class="td-buy" data-line="' + id + '" data-cost="' + cost + '" type="button">' +
            '<span class="td-buy__icon">' + d.icon + "</span>" +
            '<span class="td-buy__role">' + d.role + "</span>" +
            covTxt +
            '<span class="td-buy__cost">' + cost + "🪙</span>" +
            "</button>";
        }).join("") +
        "</div>",
        bx, by
      );
      // (no repaint here: UI.showBubble paints every price BEFORE revealing the
      //  dialog, which is the ONE owner of that. A second call here would be
      //  redundant and would make the no-flash guardrail unable to fail.)
      UI.bubble.querySelectorAll(".td-buy").forEach((btn) => {
        btn.addEventListener("click", (e2) => {
          e2.stopPropagation();
          const r = cur.engine.place(btn.dataset.line, pad.id);
          if (r.ok) { sfx("build"); if (cur.lines) cur.lines[btn.dataset.line] = true; applyAim(btn.dataset.line, pad.id); UI.hideBubble(); cur.render.setSelection(null); }
          else {
            UI.bubble.classList.add("td-bubble--no");
            setTimeout(() => UI.bubble.classList.remove("td-bubble--no"), 300);
          }
          UI.hud(cur.engine.state);
        });
      });
    } else {
      // ---- tower panel: upgrade | branch cards at tier 3 | targeting/rally | sell ----
      // The panel STAYS OPEN after a purchase and re-renders itself, so a tower
      // can be taken 1→2→3 in one opening instead of re-tapping it each time.
      // That is why the whole thing is a function: buying changes the tier, the
      // price, the stat line and the sell refund, so the only honest way to keep
      // it up is to rebuild it from the tower's CURRENT state.
      cur.selTowerId = tower.id;
      cur.render.setSelection({ tower: tower.id });
      const towerId = tower.id;
      const renderPanel = () => {
        // Re-fetch from state: after an upgrade the tier/spent have moved, and a
        // sold tower is gone entirely (in which case there is nothing to show).
        const t = cur.engine.state.towers.find((x) => x.id === towerId);
        if (!t) { UI.hideBubble(); cur.render.setSelection(null); return; }
        const def = DATA.TOWERS[t.lineId];
        const s = (t.tier === 4 && t.branch) ? def.branches[t.branch] : def.tiers[t.tier - 1];
        // Refund from the ENGINE for the same reason the prices below are:
        // ♻️ Trade-In pays 90% where the raw rule says 80%, so a DATA-derived
        // label told an owning run it would get less than it actually got.
        const refund = cur.engine.refundOf(t.id);
        let middle = "";
        if (t.tier < 3) {
          // Price from the ENGINE, so the label and the affordability gate are
          // the number actually charged (🔧 Handyman took 110 → 99, and the old
          // DATA-derived label showed 110 and greyed out the button at 100-109).
          const c = cur.engine.priceOf("upgrade", t.id);
          middle = '<button class="td-up" data-cost="' + c + '" type="button">⬆ ' + c + "🪙</button>";
        } else if (t.tier === 3) {
          // Each branch states its ROLE at the moment of choosing, because the
          // panel's dps line actively MISLEADS here: Sniper Scope reads 47.3
          // against the tier-3 dart's 34.3, yet converting every dart to Sniper
          // LOSES L22/L26/L31 and 5 of 9 boss finales — 85 damage a shot is
          // overkill against 30 of the 42 non-boss bodies (median hp 34).
          //
          // DERIVED from the line's own branch map — the counting law. This was
          // the ONLY place in the fort that hard-coded "a" and "b" (the engine's
          // branch() has always been generic and the Toybox Guide already
          // derived), so a line with three ultimates needs no code hunt. The row
          // is a GRID sized to the count, because a third card left to WRAP
          // measured +111px (239 → 350) and fell past the fold at 320x480,
          // 320x568 and landscape 844x390.
          // A branch can also MOVE the reach, in either direction — Sniper Scope
          // takes the dart 3 → 5.5 and Minigun DROPS it to 2.2 — so each card
          // states what it would cover FROM THIS PAD, and the arrow only appears
          // when the figure actually changes (a silent shrink on a 300-gold
          // purchase is exactly the class of thing the overkill warning exists
          // for). Appended to the existing role line rather than given a row of
          // its own: a third card row already measured +111px and fell past the
          // fold at 320×480.
          const now = cur.engine.coverageOf(t.lineId, t.tier, t.cx, t.cy);
          const keys = Object.keys(def.branches || {});
          middle = '<div class="td-branchrow td-branchrow--' + keys.length + '">' + keys.map((k) => {
            const b = def.branches[k];
            const c = cur.engine.priceOf("branch", { towerId: t.id, choice: k });
            const bc = cur.engine.coverageOf(t.lineId, 4, t.cx, t.cy, k);
            const pct = (v) => (v * 100).toFixed(0) + "%";
            const road = (bc == null || now == null || pct(bc) === pct(now)) ? ""
              : " · road " + pct(now) + "→" + pct(bc);
            return '<button class="td-branch" data-b="' + k + '" data-cost="' + c + '" type="button" aria-label="' +
              b.name + " — " + b.role + road + ", " + c + ' gold">' +
              '<span class="td-branch__name">' + b.name + " " + c + "🪙</span>" +
              '<span class="td-branch__role">' + b.role + road + "</span></button>";
          }).join("") + "</div>";
        }
        // ASK THE ENGINE: it owns whether this tower is still un-acted-upon.
        const undo = cur.engine.undoInfo && cur.engine.undoInfo();
        const canUndo = !!(undo && undo.id === t.id);
        const control = t.lineId === "camp"
          ? '<button class="td-rally" type="button">🚩 Rally</button>'
          // the PLAYER's word, not the engine's id: the mode you unlock read
          // "cheap" on the button while the 🔻 Weak Spot node that grants it
          // promises "Weakest" aim, which is what the engine actually does.
          : '<button class="td-target" type="button">🎯 ' +
            targetName(t.targeting) + "</button>";
        UI.showBubble(
          '<div class="td-panel">' +
            '<span class="td-panel__name">' + s.name + "</span>" +
            '<span class="td-panel__stats">' + statLine(t) + "</span>" +
            // What ⬆ actually BUYS. The most frequent decision in the game
            // showed a price and nothing else, while the tier-3 branch cards
            // beside it have always stated their move (road 12%→28%). Same
            // formatter as the line above, deliberately — a second one is how
            // the current and the preview drift apart, which is the defect
            // that made the panel print 110 while the engine charged 99.
            (t.tier < 3
              ? '<span class="td-panel__next">→ ' + statLine(t, t.tier + 1) + "</span>"
              : "") +
            middle + control +
            // ↩ UNDO takes the SELL slot rather than sitting beside it. Same
            // button, same place, same size — so offering it costs no layout,
            // which matters because this panel is already measured against the
            // fold at 320x480 and a fourth control would push a tier-3 panel
            // past it. When it is not on offer the slot is the ordinary sell.
            (canUndo
              ? '<button class="td-sell td-sell--undo" type="button">↩ undo ' + undo.refund + "</button>"
              : '<button class="td-sell" type="button">💰 sell ' + refund + "</button>") +
          "</div>",
          bx, by
        );
        wirePanel();
      };
      const nope = () => { // refused: shake, but never close — the player is mid-decision
        UI.bubble.classList.add("td-bubble--no");
        setTimeout(() => { if (UI.bubble) UI.bubble.classList.remove("td-bubble--no"); }, 300);
      };
      function wirePanel() {
      const up = UI.bubble.querySelector(".td-up");
      if (up) up.addEventListener("click", (e2) => {
        e2.stopPropagation();
        if (cur.engine.upgrade(towerId).ok) { sfx("upgrade"); UI.hud(cur.engine.state); renderPanel(); }
        else { nope(); UI.hud(cur.engine.state); }
      });
      UI.bubble.querySelectorAll(".td-branch").forEach((btn) => {
        btn.addEventListener("click", (e2) => {
          e2.stopPropagation();
          if (cur.engine.branch(towerId, btn.dataset.b).ok) { sfx("tier"); UI.hud(cur.engine.state); renderPanel(); }
          else { nope(); UI.hud(cur.engine.state); }
        });
      });
      const rallyBtn = UI.bubble.querySelector(".td-rally");
      if (rallyBtn) rallyBtn.addEventListener("click", (e2) => {
        e2.stopPropagation();
        cur.rallyArmId = towerId; // next field tap plants the flag
        UI.showBubble('<div class="td-panel"><span class="td-panel__name">🚩 tap the field</span></div>', bx, by);
        UI.bubble.classList.add("td-bubble--hint"); // click-transparent — the field tap must pass through
      });
      // Selling is the ONE panel action that still closes: the thing the panel
      // is about no longer exists.
      UI.bubble.querySelector(".td-sell").addEventListener("click", (e2) => {
        e2.stopPropagation();
        // The SAME button does both, and which one is decided by the ENGINE, not
        // by the label: a panel left open across a phase change would otherwise
        // still be showing "undo" for a tower that has since fought a wave.
        const u = cur.engine.undoInfo && cur.engine.undoInfo();
        const ok = (u && u.id === towerId) ? cur.engine.undoLast().ok : cur.engine.sell(towerId).ok;
        if (ok) sfx("sell");
        UI.hideBubble(); cur.render.setSelection(null); UI.hud(cur.engine.state);
      });
      const targetBtn = UI.bubble.querySelector(".td-target");
      if (targetBtn) targetBtn.addEventListener("click", (e2) => {
        e2.stopPropagation();
        // ASK THE ENGINE which modes this run allows, rather than re-deriving it
        // from save.meta: `mods` is fixed at createEngine, so a resumed run or a
        // mid-session respec could leave these two disagreeing — the button
        // offering "cheap" (the 🔻 Weak Spot node) while the engine refuses it.
        // And honour the result before relabelling, or the button lies.
        // Read the CURRENT tower: a tier-4 branch can set its own default aim,
        // so the closure's snapshot would cycle from a stale mode.
        const live = cur.engine.state.towers.find((x) => x.id === towerId);
        if (!live) return;
        const modes = cur.engine.targetingModes();
        const nextMode = modes[(modes.indexOf(live.targeting) + 1) % modes.length];
        const r = cur.engine.setTargeting(towerId, nextMode);
        if (r.ok) {
          e2.target.textContent = "🎯 " + targetName(nextMode);
          // Remember it for the NEXT tower of this line (see the boot coercion).
          save.settings.aim[live.lineId] = nextMode; persist(save);
        } else sfx("deny");
      });
      }
      renderPanel();
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
      if (id === "td-home") { park("screen-td-play"); UI.closeOverlay(); } // never leave a modal mounted over a live battle
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
        UI.renderResume(save, resumeMidRun, () => { discardRun(); JonTD.route("td-home"); }); // TD-5 resume banner
        const s = doc.getElementById("screen-td-home");
        if (s) s.hidden = false;
        if (cur) { cur.paused = true; syncRun(); } // browsing the fort must not hold the screen awake
        global.scrollTo(0, 0);
        // …then bring the level you are actually here to play into view. Top-of
        // -page is right when there is nothing to continue (a fresh save, or a
        // fully-beaten ladder); from level 13 onward it buries the next level
        // below the fold, on every single return to the fort.
        UI.focusNextLevel();
        return true;
      }
      if (id === "td-play") {
        doc.body.classList.add("td-mode");
        doc.body.classList.add("in-game");
        const s = doc.getElementById("screen-td-play");
        if (s) s.hidden = false;
        // Deep entry with no live run. If a checkpoint exists, send the player to
        // the fort so the Resume banner can offer it — starting a fresh L1 here
        // DESTROYED the saved run on any reload from this hash.
        if (!cur && save.midRun) { location.hash = "#td-home"; return true; }
        if (!cur) startLevel(1, {}); // deep entry → default to L1
        else { cur.paused = false; syncRun(); }
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
      if (cur) { cur.paused = true; syncRun(); }
      UI.hideBubble();
      UI.closeOverlay();
    },
  };
  global.JonTD = JonTD;

  // ---- Wire the shell once the DOM exists (scripts are deferred → DOM ready) ----
  // The guide reads the packed set through the ONE owner (the same list the
  // engine is handed), so a 🎒 in the guide always means "this is on the strip".
  UI._packedPowers = () => activePowers();
  // The local-midnight rule that decides "which daily is this" has ONE owner
  // (dayKey), and the fort home's 📅 badge needs to ask it. Inject the reader
  // rather than re-deriving the date in the UI — a second copy of that rule is
  // how two owners of one string always start.
  UI.today = dayKey;
  UI.buildScreens({
    exitFort: () => { location.hash = ""; },
    quitToFort: () => { promptDiscard(() => { location.hash = "#td-home"; }, LEAVE_COPY); },
    // TD-9: tapping an ability button. An "instant" one fires immediately; a
    // point/tower one ARMS and the next field tap resolves it (the rally-flag
    // precedent). Re-tapping an armed ability disarms it — a toddler-proof
    // toggle, and the same double-tap forgiveness the kid games learned.
    // ⚙️ THE EXCHANGE — trade surplus gold for one more Toy Energy. The refusal
    // SPEAKS through the same hint line the powers use, because a control that
    // silently does nothing is the exact defect that made three powers read as
    // broken ("some of them don't even seem to work at all").
    buyCharge: () => {
      if (!cur) return;
      const r = cur.engine.buyCharge();
      if (!r.ok) {
        sfx("deny");
        UI.abilityHint({
          "not-in-wave": "⚙️ Buy energy once the wave is walking",
          "wave-limit": "⚙️ Only one extra energy per wave",
          full: "⚙️ Your energy is already full",
          gold: "⚙️ Not enough gold for another energy (" + cur.engine.chargePrice() + "🪙)",
        }[r.reason] || "⚙️ Cannot buy energy right now");
      } else {
        sfx("upgrade");
        UI.abilityHint("");
      }
      UI.hud(cur.engine.state);
      UI.abilities(cur.engine.state, cur.abilArmId);
    },
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
      // A finished run has no pause state — tapping ⏸ on the victory/defeat
      // screen used to swap the results away for a Paused menu you could not
      // get back from (losing ▶ Next level / 🔁 Try again / the run summary).
      if (!inLevel()) return;
      if (cur.paused) { cur.paused = false; cur.autoPaused = false; UI.closeOverlay(); syncRun(); return; }
      cur.paused = true;
      syncRun(); // a paused battle must NOT hold the screen awake
      showPauseMenu();
    },
    toggleSpeed: () => {
      if (!cur) return;
      // 1× → 2× → 3× → 1×. 3× is 90 ticks/sec; the frame loop already caps at
      // 6 ticks per frame, so a slow frame can never spiral.
      cur.speed = cur.speed >= 3 ? 1 : cur.speed + 1;
      save.settings.speed = cur.speed; persist(save);   // remembered for the next level
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
    openTree: () => UI.showStarTree(save, (newMeta, newLoadout) => {
      save.meta = newMeta;
      if (newLoadout) save.loadout = newLoadout;
      // a refunded node can never stay equipped
      save.loadout = (save.loadout || []).filter((id) => save.meta.indexOf(id) >= 0);
      persist(save);
    }),
    // P6 powers pack. `powers` is a CHOICE, so like `meta`/`loadout` it is
    // last-writer-wins across two tabs, never unioned — unioning would resurrect
    // a power you deliberately left behind.
    openPowers: () => UI.showPowers(save, (picked) => { save.powers = picked; persist(save); }),
    openChips: () => UI.showChips(save, (armed) => {
      save.chipsArmed = armed; persist(save);
      UI.renderMetaCounts(save);   // the 🎖️ badge is what says a constraint is armed at all
    }),
    openAchievements: () => UI.showAchievements(save),
    openEndless: () => UI.showEndless(save, (world) => startEndless(world)),
    openDaily: () => UI.showDaily(dailyPick(dayKey()), save, () => startDaily()),
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
  doc.addEventListener("visibilitychange", () => {
    if (!cur) return;
    if (doc.hidden) { cur.paused = true; cur.autoPaused = true; syncRun(); return; } // the browser drops the lock anyway; keep our own state honest
    // Coming BACK has to be escapable. Without this the battle stayed paused for
    // ever with nothing on screen saying so, and ⏸ (a toggle) then resumed
    // instead of pausing — the control lied about its own state.
    if (cur.autoPaused && cur.paused && inLevel()) { cur.autoPaused = false; showPauseMenu(); }
    else cur.autoPaused = false;
  });
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
    newGame: (levelId, opts) => { startLevel(levelId, opts || {}); if (cur) { cur.paused = true; syncRun(); } return true; },
    grantGold: (n) => { if (cur) { cur.engine.state.gold += n; cur.engine.state.cheated = true; } },
    // The ONE owner — a new save field is covered here automatically. It DROPS
    // the parked run too, exactly like the grown-ups button: without that,
    // `cur` survived the wipe and the very next navigation ran
    // leavingPlay() -> writeMidRun() and RESURRECTED a checkpoint from the
    // run that had just been reset — so a test that reset and moved on left
    // a stale midRun behind, and a later `#td-play` bounced back to the fort
    // home. Same shape as the ✕-discard bug: something downstream in the
    // same call re-creates what you just deleted.
    resetSave: () => resetProgress({ dropRun: true }),
    // read-only test hooks (audit guardrails): the resume checkpoint, the live
    // achievement context, the earned-badge list, and a trigger for resume.
    midRun: () => (save.midRun ? JSON.parse(JSON.stringify(save.midRun)) : null),
    ctx: () => (cur ? { leaked: !!cur.leaked, soldiersLost: cur.soldiersLost || 0, lines: Object.keys(cur.lines || {}) } : null),
    ach: () => (save.ach || []).slice(),
    endlessBest: () => Object.assign({}, save.endlessBest),
    resume: () => { resumeMidRun(); return cur ? cur.engine.state.phase : null; },
    startEndless: (world) => { startEndless(world); if (cur) { cur.paused = true; syncRun(); } return true; },
    // TD-18 daily: the pick for any day (a FIXTURE injection point, so a test
    // can pin the calendar) and a way to play it. Info and act, separately.
    dailyInfo: (day) => dailyPick(day || dayKey()),
    playDaily: (day) => { startDaily(day); if (cur) { cur.paused = true; syncRun(); } return true; },
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
        // Record the LINE too, exactly as the UI's build handler and the resume
        // path both do. e.place() alone does not — `cur.lines` is written by the
        // button handler — so a scripted run left it EMPTY and 🎯 Pea Purist
        // ("win L2 with only Darts") could never earn. Same shape as the Ice Age
        // sampler above: the hook advances the engine but skips a side effect
        // the real UI performs, and the resume path already carried a comment
        // saying exactly this.
        if (c[0] === "place") { const r = e.place(c[1], c[2]); if (r && r.ok && cur.lines) cur.lines[c[1]] = true; }
        else if (c[0] === "upgrade") { const t = e.state.towers[c[1]]; if (t) e.upgrade(t.id); }
        else if (c[0] === "sell") { const t = e.state.towers[c[1]]; if (t) e.sell(t.id); }
        else if (c[0] === "target") { const t = e.state.towers[c[1]]; if (t) e.setTargeting(t.id, c[2]); }
        else if (c[0] === "call") e.callWave();
        else if (c[0] === "tick") { for (let i = 0; i < c[1]; i++) { e.tick(); sampleIceAge(); } }
        else if (c[0] === "untilPhase") {
          let guard = 0;
          const cap = c[2] || 100000;
          while (e.state.phase !== c[1] && e.state.phase !== "won" && e.state.phase !== "lost" && guard++ < cap) { e.tick(); sampleIceAge(); }
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
    winL1: (seed, opts) => {
      // opts passes through (chips, meta, …) so a fixture can win under a
      // constraint — the chip-stamp test needs the win and the chips on the
      // SAME run, and a second newGame here would silently drop them.
      global.__TD.newGame(1, Object.assign({ seed: seed == null ? 7 : seed }, opts || {}));
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
