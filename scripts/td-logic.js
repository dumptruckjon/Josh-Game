// Fort Josh: Toybox Defense — the PURE deterministic engine (TD-1).
// Zero DOM access. Dual-export (window.TDLogic + module.exports) so node tests
// run entire levels headless at 1000× speed — that IS the test strategy for a
// real-time game (PLAN_TOWER_DEFENSE.md §2/§10): fixed 30Hz timestep, seeded
// RNG only (never the ambient random), plain-JSON state = save = replay = test.

(function (global) {
  const DATA = (typeof module !== "undefined" && module.exports)
    ? require("./td-data.js")
    : global.TDData;

  const DT = 1 / DATA.TICK_RATE;

  // ---- Seeded RNG (mulberry32) — every random draw in the engine goes here. ----
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashSeed(levelId, difficulty, runSeed) {
    let h = 2166136261 >>> 0;
    const s = levelId + "|" + difficulty + "|" + runSeed;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  // ---- Path helpers: waypoints → cumulative segments; (dist) → (x,y). ----
  function buildPath(waypoints) {
    const segs = [];
    let total = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const [ax, ay] = waypoints[i - 1];
      const [bx, by] = waypoints[i];
      const len = Math.abs(bx - ax) + Math.abs(by - ay); // axis-aligned paths
      segs.push({ ax, ay, bx, by, start: total, len });
      total += len;
    }
    return { segs, total };
  }
  function posAt(path, dist) {
    const d = Math.max(0, Math.min(dist, path.total));
    for (const s of path.segs) {
      if (d <= s.start + s.len) {
        const t = s.len ? (d - s.start) / s.len : 0;
        return { x: s.ax + (s.bx - s.ax) * t, y: s.ay + (s.by - s.ay) * t };
      }
    }
    const last = path.segs[path.segs.length - 1];
    return { x: last.bx, y: last.by };
  }

  // ---- Combat math (§5.1) — pure, unit-tested directly. ----
  // Order: Zap is absorbed by shield first; Bonk is reduced by armor; brittle
  // multiplies everything. Returns { hpDmg, shieldDmg } (integers, half-up).
  function computeHit(dmg, dmgType, enemy) {
    let d = dmg;
    let shieldDmg = 0;
    if (dmgType === "zap" && enemy.shield > 0) {
      shieldDmg = Math.min(d, enemy.shield);
      d -= shieldDmg;
    }
    if (dmgType === "bonk") d *= (1 - (enemy.armor || 0));
    if (enemy.brittle) d *= 1.2; // the engine maintains this flag (Blizzard aura, TD-2)
    return { hpDmg: Math.round(d), shieldDmg: Math.round(shieldDmg) };
  }

  // ---- Stable state hash (tests + replay verification). ----
  function stableStringify(v) {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
  }
  function hashState(state) {
    const s = stableStringify(state);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  // ---- The engine ----
  function createEngine(levelDef, opts) {
    opts = opts || {};
    const difficulty = opts.difficulty || "normal";
    const diff = DATA.DIFFICULTIES[difficulty] || DATA.DIFFICULTIES.normal;
    const seed = hashSeed(levelDef.id, difficulty, opts.seed == null ? 1 : opts.seed);
    const rng = mulberry32(seed);
    const path = buildPath(levelDef.path);
    let nextId = 1;

    const state = {
      levelId: levelDef.id,
      difficulty,
      seed: opts.seed == null ? 1 : opts.seed,
      tick: 0,
      phase: "build", // build | wave | won | lost
      countdown: DATA.RULES.buildCountdownFirst * DATA.TICK_RATE, // ticks
      waveIdx: 0,     // NEXT wave to run (0-based); during "wave" it's the running one
      gold: levelDef.startGold + diff.startGold,
      lives: DATA.RULES.lives,
      stars: 0,
      cheated: false,
      enemies: [],
      towers: [],
      projectiles: [],
    };
    let spawnQueue = []; // [{tick, type}] for the running wave, ascending

    const events = [];
    const emit = (e) => { events.push(e); if (events.length > 400) events.splice(0, events.length - 400); };

    function padById(id) { return levelDef.pads.find((p) => p.id === id) || null; }
    function towerAt(padId) { return state.towers.find((t) => t.padId === padId) || null; }
    function towerById(id) { return state.towers.find((t) => t.id === id) || null; }

    function scheduleWave(idx) {
      const wave = levelDef.waves[idx];
      spawnQueue = [];
      for (const g of wave.groups) {
        for (let i = 0; i < g.count; i++) {
          // Tiny seeded jitter (±0.15s) — the one place TD-1 rolls the rng, so
          // a different seed provably produces a different run (tested).
          const jitter = (rng() - 0.5) * 0.3;
          const at = Math.max(0, g.delay + i * g.gap + jitter);
          spawnQueue.push({ tick: state.tick + Math.round(at * DATA.TICK_RATE), type: g.type });
        }
      }
      spawnQueue.sort((a, b) => a.tick - b.tick || (a.type < b.type ? -1 : 1));
    }

    function startWave() {
      state.phase = "wave";
      scheduleWave(state.waveIdx);
      emit({ type: "wave", n: state.waveIdx + 1 });
    }

    function spawnEnemy(type) {
      const def = DATA.ENEMIES[type];
      state.enemies.push({
        id: nextId++, type,
        dist: 0,
        hp: Math.round(def.hp * diff.hp),
        maxHp: Math.round(def.hp * diff.hp),
        shield: def.shield, armor: def.armor,
        speed: def.speed * diff.speed,
        alive: true,
      });
    }

    function killEnemy(e, byTower) {
      e.alive = false;
      const bounty = Math.round(DATA.ENEMIES[e.type].bounty * diff.bounty);
      state.gold += bounty;
      const p = posAt(path, e.dist);
      emit({ type: "die", x: p.x, y: p.y, bounty, enemy: e.type, byTower });
    }

    function leakEnemy(e) {
      e.alive = false;
      state.lives -= DATA.ENEMIES[e.type].lives;
      emit({ type: "leak", enemy: e.type });
      if (state.lives <= 0) { state.lives = 0; state.phase = "lost"; emit({ type: "lost" }); }
    }

    function finishIfWaveDone() {
      if (spawnQueue.length || state.enemies.some((e) => e.alive)) return;
      state.enemies.length = 0;
      state.waveIdx += 1;
      if (state.waveIdx >= levelDef.waves.length) {
        state.phase = "won";
        const kept = state.lives;
        for (const [need, stars] of DATA.RULES.stars) { if (kept >= need) { state.stars = stars; break; } }
        emit({ type: "won", stars: state.stars, lives: kept });
      } else {
        state.phase = "build";
        state.countdown = DATA.RULES.buildCountdown * DATA.TICK_RATE;
      }
    }

    function pickTarget(t, def) {
      const inRange = [];
      for (const e of state.enemies) {
        if (!e.alive) continue;
        const p = posAt(path, e.dist);
        const dx = p.x - t.cx, dy = p.y - t.cy;
        if (dx * dx + dy * dy <= def.tiers[t.tier - 1].range * def.tiers[t.tier - 1].range) inRange.push(e);
      }
      if (!inRange.length) return 0;
      let best = inRange[0];
      for (const e of inRange) {
        if (t.targeting === "first" && e.dist > best.dist) best = e;
        else if (t.targeting === "last" && e.dist < best.dist) best = e;
        else if (t.targeting === "strong" && (e.hp > best.hp || (e.hp === best.hp && e.dist > best.dist))) best = e;
        else if (t.targeting === "close") {
          const pb = posAt(path, best.dist), pe = posAt(path, e.dist);
          const db = (pb.x - t.cx) ** 2 + (pb.y - t.cy) ** 2;
          const de = (pe.x - t.cx) ** 2 + (pe.y - t.cy) ** 2;
          if (de < db) best = e;
        }
      }
      return best.id;
    }

    function enemyById(id) { return state.enemies.find((e) => e.id === id && e.alive) || null; }

    function tick() {
      if (state.phase === "won" || state.phase === "lost") return;
      state.tick += 1;

      if (state.phase === "build") {
        state.countdown -= 1;
        if (state.countdown <= 0) startWave();
        return; // nothing moves during build (towers idle, field empty)
      }

      // 1) spawns due this tick
      while (spawnQueue.length && spawnQueue[0].tick <= state.tick) {
        spawnEnemy(spawnQueue.shift().type);
      }

      // 2) enemies walk (index order — determinism law)
      for (const e of state.enemies) {
        if (!e.alive) continue;
        e.dist += e.speed * DT;
        if (e.dist >= path.total) leakEnemy(e);
      }
      if (state.phase === "lost") return;

      // 3) towers acquire + fire
      for (const t of state.towers) {
        const def = DATA.TOWERS[t.lineId];
        const tierDef = def.tiers[t.tier - 1];
        if (t.cooldown > 0) t.cooldown -= 1;
        const cur = enemyById(t.targetId);
        if (!cur) t.targetId = pickTarget(t, def);
        else {
          const p = posAt(path, cur.dist);
          const dx = p.x - t.cx, dy = p.y - t.cy;
          if (dx * dx + dy * dy > tierDef.range * tierDef.range) t.targetId = pickTarget(t, def);
        }
        if (t.targetId && t.cooldown <= 0) {
          t.cooldown = Math.round(tierDef.rate * DATA.TICK_RATE);
          state.projectiles.push({
            id: nextId++, x: t.cx, y: t.cy, targetId: t.targetId,
            dmg: tierDef.dmg, dmgType: tierDef.dmgType, speed: def.projectileSpeed,
          });
          emit({ type: "shoot", x: t.cx, y: t.cy, tower: t.lineId });
        }
      }

      // 4) projectiles home + hit
      for (const pr of state.projectiles) {
        const target = enemyById(pr.targetId);
        if (!target) { pr.dead = true; continue; } // target gone → fizzle
        const tp = posAt(path, target.dist);
        const dx = tp.x - pr.x, dy = tp.y - pr.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const step = pr.speed * DT;
        if (d <= Math.max(0.18, step)) {
          const hit = computeHit(pr.dmg, pr.dmgType, target);
          target.hp -= hit.hpDmg;
          if (target.shield) target.shield = Math.max(0, target.shield - hit.shieldDmg);
          emit({ type: "hit", x: tp.x, y: tp.y });
          if (target.hp <= 0) killEnemy(target, pr.dmgType);
          pr.dead = true;
        } else {
          pr.x += (dx / d) * step;
          pr.y += (dy / d) * step;
        }
      }
      state.projectiles = state.projectiles.filter((p) => !p.dead);
      state.enemies = state.enemies.filter((e) => e.alive || state.phase !== "wave");

      finishIfWaveDone();
    }

    // ---- Player commands (all validated; {ok, reason?}) ----
    function place(lineId, padId) {
      const def = DATA.TOWERS[lineId];
      const pad = padById(padId);
      if (!def || !pad) return { ok: false, reason: "bad-id" };
      if (towerAt(padId)) return { ok: false, reason: "occupied" };
      if (state.phase === "won" || state.phase === "lost") return { ok: false, reason: "over" };
      const cost = def.tiers[0].cost;
      if (state.gold < cost) return { ok: false, reason: "gold" };
      state.gold -= cost;
      state.towers.push({
        id: nextId++, lineId, tier: 1, branch: "", padId,
        cx: pad.cx, cy: pad.cy, cooldown: 0, targetId: 0,
        targeting: "first", spent: cost,
      });
      emit({ type: "build", x: pad.cx, y: pad.cy });
      return { ok: true };
    }
    function upgrade(towerId) {
      const t = towerById(towerId);
      if (!t) return { ok: false, reason: "bad-id" };
      const def = DATA.TOWERS[t.lineId];
      if (t.tier >= def.tiers.length) return { ok: false, reason: "max" };
      const cost = def.tiers[t.tier].cost;
      if (state.gold < cost) return { ok: false, reason: "gold" };
      state.gold -= cost; t.tier += 1; t.spent += cost;
      emit({ type: "upgrade", x: t.cx, y: t.cy });
      return { ok: true };
    }
    function sell(towerId) {
      const i = state.towers.findIndex((t) => t.id === towerId);
      if (i < 0) return { ok: false, reason: "bad-id" };
      const refund = Math.floor(state.towers[i].spent * DATA.RULES.sellRefund);
      state.gold += refund;
      emit({ type: "sell", x: state.towers[i].cx, y: state.towers[i].cy, refund });
      state.towers.splice(i, 1);
      return { ok: true, refund };
    }
    function setTargeting(towerId, mode) {
      const t = towerById(towerId);
      if (!t) return { ok: false, reason: "bad-id" };
      if (["first", "last", "strong", "close"].indexOf(mode) < 0) return { ok: false, reason: "bad-mode" };
      t.targeting = mode; t.targetId = 0;
      return { ok: true };
    }
    function callWave() {
      if (state.phase !== "build") return { ok: false, reason: "not-build" };
      const secondsLeft = state.countdown / DATA.TICK_RATE;
      const bonus = Math.ceil(secondsLeft * DATA.RULES.earlyCallRate);
      state.gold += bonus;
      state.countdown = 0;
      startWave();
      return { ok: true, bonus };
    }
    const notYet = () => ({ ok: false, reason: "not-built-yet" }); // TD-2+ API kept stable

    return {
      state, events, tick, place, upgrade, sell, setTargeting, callWave,
      branch: notYet, rally: notYet, pullLever: notYet,
      path, posAt: (dist) => posAt(path, dist),
      levelDef,
    };
  }

  const API = { createEngine, computeHit, hashState, buildPath, posAt, mulberry32, hashSeed, DT };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (global && typeof global === "object") global.TDLogic = API;
})(typeof window !== "undefined" ? window : globalThis);
