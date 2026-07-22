// Fort Josh: Toybox Defense — glue (TD-1): routing + save + game loop + input
// + sfx + the __TD debug/test hooks (the real-time analog of data-correct).
// Exposes window.JonTD, which scripts/main.js routes td-* hashes through.

(function (global) {
  const doc = global.document;
  if (!doc) return;
  const DATA = global.TDData, TD = global.TDLogic, UI = global.TDUI, R = global.TDRender;
  if (!DATA || !TD || !UI || !R) return;
  const A = global.JoshAudio || { tone() {}, isMuted: () => true, winCue() {} };

  const OK_FLAG = "td-ok";
  const SAVE_KEY = "jon-td-save-v1";
  const DT_MS = 1000 / DATA.TICK_RATE;

  function unlocked() { try { return sessionStorage.getItem(OK_FLAG) === "1"; } catch (e) { return false; } }
  function unlock() { try { sessionStorage.setItem(OK_FLAG, "1"); } catch (e) { /* ignore */ } }

  // ---- Save (jon-td-* namespace ONLY — never the kid star flags; survives Josh's reset) ----
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) { const s = JSON.parse(raw); if (s && s.v === 1) return s; }
    } catch (e) { /* private mode → session-only play */ }
    return { v: 1, stars: {}, settings: { sfx: true } };
  }
  function persist(save) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
  }
  let save = load();
  if (!save.difficulty || !DATA.DIFFICULTIES[save.difficulty]) save.difficulty = "normal";
  if (!save.settings) save.settings = { sfx: true };

  // ---- SFX (through the ONE iOS-safe JoshAudio.tone; global 🔇 + fort toggle) ----
  let lastShotCue = 0;
  function sfx(kind) {
    if (!save.settings.sfx) return;
    try {
      if (A.isMuted && A.isMuted()) return; // fort sounds respect the global 🔇 too
      if (kind === "build") { A.tone(660, { duration: 0.08, gain: 0.12 }); setTimeout(() => A.tone(880, { duration: 0.1, gain: 0.12 }), 70); }
      else if (kind === "upgrade") { [520, 660, 880].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.09, gain: 0.12 }), i * 70)); }
      else if (kind === "sell") A.tone(280, { duration: 0.12, gain: 0.1, type: "sine" });
      else if (kind === "shoot") {
        const now = Date.now();
        if (now - lastShotCue > 120) { lastShotCue = now; A.tone(1500, { duration: 0.03, gain: 0.05, type: "square" }); }
      }
      else if (kind === "die") A.tone(980, { duration: 0.06, gain: 0.07 });
      else if (kind === "chain") A.tone(1200, { duration: 0.08, gain: 0.08, type: "square" });
      else if (kind === "splash") A.tone(110, { duration: 0.18, gain: 0.14, type: "sine" });
      else if (kind === "leak") { A.tone(330, { duration: 0.12, gain: 0.1, type: "sine" }); setTimeout(() => A.tone(262, { duration: 0.16, gain: 0.1, type: "sine" }), 110); }
      else if (kind === "wave") { [440, 440, 440, 587].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.07, gain: 0.1 }), i * 90)); }
      else if (kind === "boss") { [220, 175, 220, 175].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.22, gain: 0.16, type: "square" }), i * 240)); } // klaxon
      else if (kind === "won") { if (A.winCue) A.winCue(); }
      else if (kind === "lost") { [392, 330, 262].forEach((f, i) => setTimeout(() => A.tone(f, { duration: 0.18, gain: 0.1, type: "sine" }), i * 160)); }
    } catch (e) { /* audio must never break play */ }
  }

  // ---- The running session ----
  let cur = null; // { engine, render, raf, acc, lastT, speed, paused, selPadId, selTowerId }

  function stopLoop() { if (cur && cur.raf) { cancelAnimationFrame(cur.raf); cur.raf = 0; } }

  function phaseWatch(prevPhase) {
    const st = cur.engine.state;
    if (st.phase === prevPhase) return;
    if (st.phase === "won") {
      stopLoop();
      if (!st.cheated) {
        const key = String(st.levelId);
        save.stars[key] = Math.max(save.stars[key] || 0, st.stars);
        persist(save);
      }
      sfx("won");
      const nextId = st.levelId + 1;
      const nextExists = !!DATA.LEVELS.find((l) => l.id === nextId);
      UI.showVictory(st.stars, st.lives, {
        continueOn: () => { UI.closeOverlay(); location.hash = "#td-home"; },
        nextLevel: nextExists ? nextId : null,
        onNext: nextExists ? () => { UI.closeOverlay(); location.hash = "#td-play"; startLevel(nextId, {}); } : null,
      });
    } else if (st.phase === "lost") {
      stopLoop();
      sfx("lost");
      UI.showDefeat({
        retry: () => { UI.closeOverlay(); startLevel(st.levelId, { seed: st.seed }); },
        retrynew: () => { UI.closeOverlay(); startLevel(st.levelId, { seed: (Date.now() % 100000) }); },
        quit: () => { UI.closeOverlay(); location.hash = "#td-home"; },
      });
    }
  }

  function drainEvents() {
    const evs = cur.engine.events;
    for (const e of evs) {
      cur.render.pushFx(e);
      if (e.type === "shoot") sfx("shoot");
      else if (e.type === "die") sfx("die");
      else if (e.type === "leak") sfx("leak");
      else if (e.type === "wave") sfx("wave");
      else if (e.type === "chain") sfx("chain");
      else if (e.type === "splash") sfx("splash");
      else if (e.type === "boss") { UI.showBanner("⚠ " + e.name + " incoming!"); sfx("boss"); }
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
    phaseWatch(prevPhase);
    cur.render.draw(Math.max(0, Math.min(1, cur.acc / DT_MS)));
    if ((cur.engine.state.tick & 7) === 0) UI.hud(cur.engine.state); // ~4Hz
  }

  function startLevel(levelId, opts) {
    opts = opts || {};
    const levelDef = DATA.LEVELS.find((l) => l.id === levelId);
    if (!levelDef) { location.hash = "#td-home"; return; }
    stopLoop();
    // Difficulty flows from the fort-home selector (persisted in save); a test
    // hook may override per-call. The engine fully supports casual/normal/heroic
    // (hp/speed/bounty/start-gold multipliers) — casual eases, heroic bites hard.
    const difficulty = opts.difficulty || save.difficulty || "normal";
    const engine = TD.createEngine(levelDef, { seed: opts.seed == null ? (Date.now() % 100000) : opts.seed, difficulty });
    const render = R.create(UI.canvas, engine);
    cur = { engine, render, raf: 0, acc: 0, lastT: 0, speed: 1, paused: false, selPadId: null, selTowerId: null };
    UI.closeOverlay();
    UI.hideBubble();
    UI.hud(engine.state);
    const speedBtn = doc.querySelector("#screen-td-play .td-speed");
    if (speedBtn) speedBtn.textContent = "1×";
    render.resize();
    render.draw(0);
    cur.raf = requestAnimationFrame(frame);
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

  // ---- Field input: tap pads to build, towers to manage ----
  function fieldTap(ev) {
    if (!cur) return;
    const rect = UI.canvas.getBoundingClientRect();
    // ONE mapping shared with the renderer — taps stay correct in the rotated
    // (portrait-filling) orientation exactly as in landscape.
    const w = cur.render.screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top);
    const gx = w.x, gy = w.y;
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
          return '<button class="td-buy" data-line="' + id + '" type="button"' + (gold < cost ? " disabled" : "") + ">" +
            '<span class="td-buy__icon">' + d.icon + "</span>" +
            '<span class="td-buy__role">' + d.role + "</span>" +
            '<span class="td-buy__cost">' + cost + "🪙</span>" +
            "</button>";
        }).join("") +
        "</div>",
        bx, by
      );
      UI.bubble.querySelectorAll(".td-buy").forEach((btn) => {
        btn.addEventListener("click", (e2) => {
          e2.stopPropagation();
          const r = cur.engine.place(btn.dataset.line, pad.id);
          if (r.ok) { sfx("build"); UI.hideBubble(); cur.render.setSelection(null); }
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
        middle = '<button class="td-up" type="button">⬆ ' + def.tiers[tower.tier].cost + "🪙</button>";
      } else if (tower.tier === 3) {
        middle =
          '<button class="td-branch" data-b="a" type="button">' + def.branches.a.name + " " + def.branches.a.cost + "🪙</button>" +
          '<button class="td-branch" data-b="b" type="button">' + def.branches.b.name + " " + def.branches.b.cost + "🪙</button>";
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
          if (cur.engine.branch(tower.id, btn.dataset.b).ok) sfx("upgrade");
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
  const JonTD = {
    route(id) {
      if (!unlocked()) return false; // main.js bounces to Josh's home
      if (id === "td-home") {
        doc.body.classList.add("td-mode");
        doc.body.classList.remove("in-game");
        UI.renderLevelGrid(
          save,
          (n) => { location.hash = "#td-play"; startLevel(n, {}); },
          (d) => { if (DATA.DIFFICULTIES[d]) { save.difficulty = d; persist(save); } } // sticks for the next level start
        );
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
      doc.body.classList.remove("td-mode");
      if (cur) cur.paused = true;
      UI.hideBubble();
      UI.closeOverlay();
    },
    openGate() {
      if (unlocked()) { location.hash = "#td-home"; return; }
      UI.openGate(() => { unlock(); location.hash = "#td-home"; });
    },
  };
  global.JonTD = JonTD;

  // ---- Wire the shell once the DOM exists (scripts are deferred → DOM ready) ----
  UI.injectDoor(() => JonTD.openGate());
  UI.buildScreens({
    exitFort: () => { location.hash = ""; },
    quitToFort: () => { promptLeave(() => { location.hash = "#td-home"; }); },
    togglePause: () => {
      if (!cur) return;
      if (cur.paused) { cur.paused = false; UI.closeOverlay(); return; }
      cur.paused = true;
      UI.showPause({
        resume: () => { cur.paused = false; UI.closeOverlay(); },
        restart: () => { UI.closeOverlay(); startLevel(cur.engine.state.levelId, {}); },
        sfx: () => { save.settings.sfx = !save.settings.sfx; persist(save); cur.paused = false; UI.closeOverlay(); },
        quit: () => { UI.closeOverlay(); promptLeave(() => { location.hash = "#td-home"; }); },
      }, save.settings);
    },
    toggleSpeed: () => {
      if (!cur) return;
      cur.speed = cur.speed === 1 ? 2 : 1;
      const b = doc.querySelector("#screen-td-play .td-speed");
      if (b) b.textContent = cur.speed + "×";
    },
    callWave: () => { if (cur) { cur.engine.callWave(); UI.hud(cur.engine.state); } },
    fieldTap,
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
    state: () => (cur ? cur.engine.state : null),
    hash: () => (cur ? TD.hashState(cur.engine.state) : 0),
    // Orientation contract for tests: the ONE world↔screen mapping + mode.
    w2s: (x, y) => (cur ? cur.render.worldToScreen(x, y) : { x: 0, y: 0 }),
    isRotated: () => (cur ? cur.render.isRotated() : false),
    newGame: (levelId, opts) => { startLevel(levelId, opts || {}); if (cur) cur.paused = true; return true; },
    grantGold: (n) => { if (cur) { cur.engine.state.gold += n; cur.engine.state.cheated = true; } },
    resetSave: () => { save = { v: 1, stars: {}, settings: { sfx: true }, difficulty: "normal" }; persist(save); return true; },
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
