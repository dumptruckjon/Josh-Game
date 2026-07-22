// Fort Josh: Toybox Defense — the PURE deterministic engine (TD-2: full arsenal).
// Zero DOM access. Dual-export (window.TDLogic + module.exports) so node tests
// run entire levels headless — that IS the test strategy for a real-time game
// (PLAN_TOWER_DEFENSE.md §2/§10): fixed 30Hz timestep, seeded RNG only (never
// the ambient random), plain-JSON state = save = replay = test.
//
// TD-2 mechanics (§4-§5): slows (strongest-wins, capped, fliers take half),
// brittle (+20% all damage), mortar shells (min-range, ground-only, splash with
// linear falloff, Sticky goo), fan auras + zap beam (fractional accumulator) +
// Static chain lightning, Sniper crits (seeded) + Minigun spin-up, and Army Guys
// soldiers: rally points, path blocking, melee trades, respawns, Dino double-
// block, RC stun. Deterministic order per tick: spawn → status → move → leak →
// soldiers → towers → projectiles/shells → cleanup.

(function (global) {
  const DATA = (typeof module !== "undefined" && module.exports)
    ? require("./td-data.js")
    : global.TDData;

  const DT = 1 / DATA.TICK_RATE;
  const R = DATA.RULES;

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

  function buildPath(waypoints) {
    const segs = [];
    let total = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const [ax, ay] = waypoints[i - 1];
      const [bx, by] = waypoints[i];
      const len = Math.abs(bx - ax) + Math.abs(by - ay);
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
  function computeHit(dmg, dmgType, enemy) {
    let d = dmg;
    let shieldDmg = 0;
    if (dmgType === "zap" && enemy.shield > 0) {
      shieldDmg = Math.min(d, enemy.shield);
      d -= shieldDmg;
    }
    if (dmgType === "bonk") d *= (1 - (enemy.armor || 0));
    if (enemy.brittle) d *= R.brittleBonus;
    return { hpDmg: Math.round(d), shieldDmg: Math.round(shieldDmg) };
  }

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

  // Resolved stat block for a tower (tier 1-3 → tiers[]; tier 4 → its branch).
  function statsOf(def, t) {
    if (t.tier === 4 && t.branch) return def.branches[t.branch];
    return def.tiers[t.tier - 1];
  }

  // TD-5 star-tree modifiers (§8.1) — pure function of the owned node ids, so a
  // sim can drive ANY loadout. Neutral defaults = an empty tree = vanilla play.
  function metaMods(meta) {
    const s = new Set(meta || []);
    return {
      startGold: s.has("startgold") ? 40 : 0,
      lives: s.has("lives") ? 2 : 0,
      dartDmg: s.has("dartdmg") ? 1.1 : 1,
      mortarSplash: s.has("mortarsplash") ? 1.1 : 1,
      fanAura: s.has("fanrange") ? 0.3 : 0,
      soldierHp: s.has("soldierhp") ? 1.15 : 1,
      earlyCall: s.has("earlycall") ? 1.5 : 1,
      sellRefund: s.has("sellrefund") ? 0.9 : R.sellRefund,
      branchCost: s.has("branchcost") ? 0.9 : 1,
      cheapTarget: s.has("cheaptarget"),
    };
  }

  // Deterministic endless wave generator (§7.5): budget grows base·growth^n; a
  // separate seeded stream keeps composition reproducible regardless of combat
  // rng draws. Every miniBossEvery-th wave adds a mini-boss (flagged boss so the
  // budget audit and finale logic treat it right).
  function generateEndlessWave(world, n, rng) {
    const cfg = DATA.ENDLESS;
    const w = cfg.worlds[world] || cfg.worlds.bedroom;
    const budget = cfg.base * Math.pow(cfg.growth, n);
    const groups = [];
    let remaining = budget;
    const nGroups = 2 + Math.floor(rng() * 2); // 2-3 groups
    for (let g = 0; g < nGroups; g++) {
      const type = w.pool[Math.floor(rng() * w.pool.length)];
      const hp = DATA.ENEMIES[type].hp;
      const share = g === nGroups - 1 ? remaining : remaining * (0.4 + rng() * 0.3);
      const count = Math.max(1, Math.round(share / hp));
      remaining -= count * hp;
      groups.push({ type, count, gap: 0.55 + rng() * 0.4, delay: g === 0 ? 0 : 2 + g });
    }
    const wave = { groups };
    if ((n + 1) % cfg.miniBossEvery === 0) { // a mini-boss punctuates every 5th wave
      wave.boss = true;
      wave.groups.unshift({ type: w.miniBoss, count: 1 + Math.floor(n / 10), gap: 1.5, delay: 0 });
    }
    return wave;
  }

  function createEngine(levelDef, opts) {
    opts = opts || {};
    const difficulty = opts.difficulty || "normal";
    const diff = DATA.DIFFICULTIES[difficulty] || DATA.DIFFICULTIES.normal;
    const seed = hashSeed(levelDef.id, difficulty, opts.seed == null ? 1 : opts.seed);
    const rng = mulberry32(seed);
    const path = buildPath(levelDef.path);
    let nextId = 1;
    // Level gimmicks (TD-4): night dims every tower's reach EXCEPT the Fan (it
    // "feels" the cold, not sees), and conveyor strips speed enemies over a
    // stretch of the lane. Both are pure data read in the hot loops.
    const rangeMul = levelDef.night ? R.nightRangeMult : 1;
    const zones = levelDef.zones && levelDef.zones.length ? levelDef.zones : null;
    // TD-5: star-tree modifiers (pure input) + endless setup (a separate seeded
    // stream generates each wave, so composition is reproducible per seed).
    const mods = metaMods(opts.meta);
    const endlessWorld = levelDef.endless ? levelDef.endless.world : null;
    const genRng = endlessWorld ? mulberry32((seed ^ 0x9e3779b9) >>> 0) : null;
    // waves may grow (endless) — keep a mutable local list, never touch levelDef.
    const waves = (levelDef.waves || []).slice();
    function waveAt(idx) {
      if (waves[idx]) return waves[idx];
      if (endlessWorld) { waves[idx] = generateEndlessWave(endlessWorld, idx, genRng); return waves[idx]; }
      return null;
    }

    const state = {
      levelId: levelDef.id,
      difficulty,
      seed: opts.seed == null ? 1 : opts.seed,
      tick: 0,
      phase: "build",
      countdown: R.buildCountdownFirst * DATA.TICK_RATE,
      waveIdx: 0,
      gold: levelDef.startGold + diff.startGold + mods.startGold,
      lives: R.lives + mods.lives,
      stars: 0,
      cheated: false,
      endless: !!endlessWorld,
      enemies: [],
      towers: [],
      soldiers: [],
      projectiles: [],
      shells: [],
    };
    let spawnQueue = [];
    let pendingSpawns = []; // split-children buffered mid-tick, flushed after combat

    const events = [];
    const emit = (e) => { events.push(e); if (events.length > 400) events.splice(0, events.length - 400); };

    const padById = (id) => levelDef.pads.find((p) => p.id === id) || null;
    const towerAt = (padId) => state.towers.find((t) => t.padId === padId) || null;
    const towerById = (id) => state.towers.find((t) => t.id === id) || null;
    const enemyById = (id) => state.enemies.find((e) => e.id === id && e.alive) || null;
    const soldierById = (id) => state.soldiers.find((s) => s.id === id && s.alive) || null;
    const enemyDef = (e) => DATA.ENEMIES[e.type];

    function scheduleWave(idx) {
      const wave = waveAt(idx);
      spawnQueue = [];
      for (const g of wave.groups) {
        for (let i = 0; i < g.count; i++) {
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

    function spawnEnemy(type, dist) {
      const def = DATA.ENEMIES[type];
      state.enemies.push({
        id: nextId++, type,
        dist: dist || 0,
        hp: Math.round(def.hp * diff.hp),
        maxHp: Math.round(def.hp * diff.hp),
        shield: def.shield, armor: def.armor,
        speed: def.speed * diff.speed,
        slowPct: 0, slowUntil: 0,
        brittle: false, brittleUntil: 0,
        blockedBy: 0, stunnedUntil: 0, meleeCd: 0, stunApplied: false,
        chargeUntil: 0, chargeCd: 0, stompCd: 0, phaseHidden: false,
        suckCd: 0, disableCd: 0, minionCd: 0, speedMult: 0, // TD-4 boss timers
        alive: true,
      });
      if (def.boss) emit({ type: "boss", name: def.name });
    }

    function applySlow(e, pct, seconds) {
      let p = pct * (enemyDef(e).flier ? R.flierSlowFactor : 1);
      p = Math.min(p, R.slowCap);
      const active = state.tick < e.slowUntil ? e.slowPct : 0;
      if (p >= active) { e.slowPct = p; e.slowUntil = state.tick + Math.round(seconds * DATA.TICK_RATE); }
    }
    function effSpeed(e) {
      const slow = state.tick < e.slowUntil ? e.slowPct : 0;
      const def = enemyDef(e);
      // Wind-up Bull: while charging, run at its charge speed (slow still bites).
      let base = (def.charge && state.tick < e.chargeUntil) ? def.charge.speed * diff.speed : e.speed;
      // Vacuum King enrage: a brief hustle once it drops below its hp threshold.
      if (def.enrage && e.hp <= e.maxHp * def.enrage.hpPct) base *= def.enrage.mult;
      // The Static P3 (or any boss phase) can set a live speed multiplier.
      if (e.speedMult) base *= e.speedMult;
      // Conveyor strip (Slip'n'Slide): faster while inside a speed zone.
      if (zones) for (const z of zones) { if (e.dist >= z.from && e.dist <= z.to) { base *= z.mult; break; } }
      return base * (1 - slow);
    }

    // Junk Healer: mend nearby wounded allies (never itself) each tick.
    function healTick() {
      for (const h of state.enemies) {
        if (!h.alive) continue;
        const def = enemyDef(h);
        if (!def.heal) continue;
        const hp = posAt(path, h.dist), r2 = def.heal.radius * def.heal.radius;
        for (const e of state.enemies) {
          if (!e.alive || e === h || e.hp >= e.maxHp) continue;
          const p = posAt(path, e.dist);
          if ((p.x - hp.x) ** 2 + (p.y - hp.y) ** 2 <= r2) e.hp = Math.min(e.maxHp, e.hp + def.heal.hps * DT);
        }
      }
    }

    // KO a soldier (stomp/suck): send it to respawn, free whatever it held.
    function downSoldier(s) {
      const camp = towerById(s.campId);
      const cs = camp ? statsOf(DATA.TOWERS.camp, camp) : { respawn: 8 };
      s.alive = false; s.respawnAt = state.tick + Math.round(cs.respawn * DATA.TICK_RATE);
      if (s.engagedId) { const foe = enemyById(s.engagedId); if (foe) foe.blockedBy = 0; s.engagedId = 0; }
      emit({ type: "soldier-down", x: s.x, y: s.y });
    }

    // Boss stomp (Bed Monster): periodic AoE that damages soldiers near the boss.
    function stompTick() {
      for (const b of state.enemies) {
        if (!b.alive) continue;
        const def = enemyDef(b);
        if (!def.stomp) continue;
        if (b.stompCd === 0) { b.stompCd = state.tick + Math.round(def.stomp.seconds * DATA.TICK_RATE); continue; }
        if (state.tick < b.stompCd) continue;
        b.stompCd = state.tick + Math.round(def.stomp.seconds * DATA.TICK_RATE);
        const bp = posAt(path, b.dist), r2 = def.stomp.radius * def.stomp.radius;
        for (const s of state.soldiers) {
          if (!s.alive) continue;
          if ((s.x - bp.x) ** 2 + (s.y - bp.y) ** 2 <= r2) {
            s.hp -= def.stomp.dmg;
            if (s.hp <= 0) downSoldier(s);
          }
        }
        emit({ type: "stomp", x: bp.x, y: bp.y, r: def.stomp.radius });
      }
    }

    // Boss ability engine (TD-4): Vacuum King inhales the nearest soldier on a
    // cadence (+ enrages via effSpeed); The Static escalates by hp% — jams a
    // random gun, then summons Battery Bots. Deterministic (seeded rng only).
    function activePhase(e, def) {
      if (!def.phases) return null;
      const frac = e.hp / e.maxHp;
      let ph = null;
      for (const p of def.phases) if (frac <= p.upTo) ph = p; // phases ordered by descending upTo
      return ph;
    }
    function bossTick() {
      for (const e of state.enemies) {
        if (!e.alive) continue;
        const def = enemyDef(e);
        if (!def.boss) continue;
        const bp = posAt(path, e.dist);
        // Vacuum King: suck the nearest living soldier (instant KO) on a timer.
        if (def.suck) {
          if (e.suckCd === 0) e.suckCd = state.tick + Math.round(def.suck.every * DATA.TICK_RATE);
          else if (state.tick >= e.suckCd) {
            e.suckCd = state.tick + Math.round(def.suck.every * DATA.TICK_RATE);
            let best = null, bestD = Infinity;
            for (const s of state.soldiers) {
              if (!s.alive) continue;
              const dd = (s.x - bp.x) ** 2 + (s.y - bp.y) ** 2;
              if (dd < bestD) { bestD = dd; best = s; }
            }
            if (best) { emit({ type: "suck", x: bp.x, y: bp.y, sx: best.x, sy: best.y }); downSoldier(best); }
          }
        }
        // The Static: hp%-gated escalation.
        const ph = activePhase(e, def);
        e.speedMult = ph && ph.speedMult ? ph.speedMult : 0;
        if (ph && ph.disable) {
          if (e.disableCd === 0) e.disableCd = state.tick + Math.round(ph.disable.every * DATA.TICK_RATE);
          else if (state.tick >= e.disableCd) {
            e.disableCd = state.tick + Math.round(ph.disable.every * DATA.TICK_RATE);
            // jam a random SHOOTING tower (camps are bodies, not electronics)
            const live = state.towers.filter((t) => t.lineId !== "camp" && !(t.disabledUntil && state.tick < t.disabledUntil));
            if (live.length) {
              const victim = live[Math.floor(rng() * live.length)];
              victim.disabledUntil = state.tick + Math.round(ph.disable.seconds * DATA.TICK_RATE);
              emit({ type: "disable", x: victim.cx, y: victim.cy, seconds: ph.disable.seconds });
            }
          }
        }
        if (ph && ph.spawn) {
          if (e.minionCd === 0) e.minionCd = state.tick + Math.round(ph.spawn.every * DATA.TICK_RATE);
          else if (state.tick >= e.minionCd) {
            e.minionCd = state.tick + Math.round(ph.spawn.every * DATA.TICK_RATE);
            for (let i = 0; i < ph.spawn.count; i++) pendingSpawns.push({ type: ph.spawn.type, dist: Math.max(0, e.dist - 0.5 - i * 0.4) });
            emit({ type: "summon", x: bp.x, y: bp.y });
          }
        }
      }
    }

    function killEnemy(e, how) {
      if (!e.alive) return; // idempotent — a split/gold-burst must never double-fire
      e.alive = false;
      if (e.blockedBy) { const s = soldierById(e.blockedBy); if (s) s.engagedId = 0; e.blockedBy = 0; }
      const def = enemyDef(e);
      const bounty = Math.round(def.bounty * diff.bounty);
      state.gold += bounty + (def.goldBurst || 0); // Piñata candy-burst
      // Splitters (Mud Blob) spawn children at the death spot — BUFFERED so we
      // never mutate state.enemies mid-iteration; flushed after the combat pass.
      if (def.split) for (let i = 0; i < def.split.count; i++) pendingSpawns.push({ type: def.split.into, dist: e.dist });
      const p = posAt(path, e.dist);
      emit({ type: "die", x: p.x, y: p.y, bounty, enemy: e.type, how });
    }

    // ONE damage path so every ability (armor/shield via computeHit, Bull charge
    // on hit, split/gold on death) fires no matter which tower dealt the blow.
    function triggerCharge(e) {
      const def = enemyDef(e);
      if (!def.charge || state.tick < e.chargeCd) return;
      e.chargeUntil = state.tick + Math.round(def.charge.seconds * DATA.TICK_RATE);
      e.chargeCd = state.tick + Math.round(def.charge.cooldown * DATA.TICK_RATE);
    }
    function dealDamage(e, hpDmg, shieldDmg, how) {
      if (shieldDmg && e.shield) e.shield = Math.max(0, e.shield - shieldDmg);
      if (hpDmg > 0) { e.hp -= hpDmg; triggerCharge(e); }
      if (e.hp <= 0) killEnemy(e, how);
    }
    function leakEnemy(e) {
      e.alive = false;
      if (e.blockedBy) { const s = soldierById(e.blockedBy); if (s) s.engagedId = 0; e.blockedBy = 0; }
      state.lives -= enemyDef(e).lives;
      emit({ type: "leak", enemy: e.type });
      if (state.lives <= 0) { state.lives = 0; state.phase = "lost"; emit({ type: "lost" }); }
    }

    function finishIfWaveDone() {
      if (spawnQueue.length || state.enemies.some((e) => e.alive)) return;
      state.enemies.length = 0;
      state.waveIdx += 1;
      // Endless never "wins" — it just keeps generating harder waves; the score
      // is waveIdx (waves survived), read off the state when the run finally leaks.
      if (endlessWorld) {
        emit({ type: "endless-wave", n: state.waveIdx });
        state.phase = "build";
        state.countdown = R.buildCountdown * DATA.TICK_RATE;
      } else if (state.waveIdx >= waves.length) {
        state.phase = "won";
        for (const [need, stars] of R.stars) { if (state.lives >= need) { state.stars = stars; break; } }
        emit({ type: "won", stars: state.stars, lives: state.lives });
      } else {
        state.phase = "build";
        state.countdown = R.buildCountdown * DATA.TICK_RATE;
      }
    }

    // ---- Targeting (shared): candidates already filtered; pick by mode. ----
    function pickByMode(cands, mode, t) {
      if (!cands.length) return 0;
      let best = cands[0];
      for (const e of cands) {
        if (mode === "first" && e.dist > best.dist) best = e;
        else if (mode === "last" && e.dist < best.dist) best = e;
        else if (mode === "strong" && (e.hp > best.hp || (e.hp === best.hp && e.dist > best.dist))) best = e;
        else if (mode === "cheap" && (e.hp < best.hp || (e.hp === best.hp && e.dist > best.dist))) best = e; // TD-5 "Weakest": finish the almost-dead
        else if (mode === "close") {
          const pb = posAt(path, best.dist), pe = posAt(path, e.dist);
          if ((pe.x - t.cx) ** 2 + (pe.y - t.cy) ** 2 < (pb.x - t.cx) ** 2 + (pb.y - t.cy) ** 2) best = e;
        }
      }
      return best.id;
    }
    // Untargetable/unblockable right now: a Glitter Ghost mid-phase or a Digger
    // Mole tunnelling under the middle third of the lane. (TD-4)
    function isHidden(e) {
      const def = enemyDef(e);
      if (def.phase && e.phaseHidden) return true;
      if (def.tunnel && e.dist > path.total / 3 && e.dist < (path.total * 2) / 3) return true;
      return false;
    }
    function candidates(t, minR, maxR, fliersOk) {
      const out = [];
      for (const e of state.enemies) {
        if (!e.alive || isHidden(e)) continue;
        if (!fliersOk && enemyDef(e).flier) continue;
        const p = posAt(path, e.dist);
        const d2 = (p.x - t.cx) ** 2 + (p.y - t.cy) ** 2;
        if (d2 <= maxR * maxR && d2 >= minR * minR) out.push(e);
      }
      return out;
    }

    // ---- Soldiers ----
    // Unit tangent of the path at its nearest point to (px,py) — so a camp's
    // soldiers line up ALONG the lane, standing ON the path ribbon as a visible
    // blockade, instead of scattering to the side of it. Deterministic (fixed
    // sampling, no RNG).
    function pathTangentAt(px, py) {
      let bestD = Infinity, bestDist = 0;
      for (let d = 0; d <= path.total; d += 0.2) {
        const p = posAt(path, d);
        const dd = (p.x - px) ** 2 + (p.y - py) ** 2;
        if (dd < bestD) { bestD = dd; bestDist = d; }
      }
      const a = posAt(path, Math.max(0, bestDist - 0.35));
      const b = posAt(path, Math.min(path.total, bestDist + 0.35));
      let tx = b.x - a.x, ty = b.y - a.y;
      const m = Math.hypot(tx, ty) || 1;
      return { x: tx / m, y: ty / m };
    }
    function rallySlots(t) {
      const s = statsOf(DATA.TOWERS.camp, t);
      const tan = pathTangentAt(t.rallyX, t.rallyY);
      const nx = -tan.y, ny = tan.x; // in-ribbon perpendicular
      const out = [];
      // spread soldiers along the lane (centred on the rally point), with a tiny
      // stagger kept well inside the ribbon so every guy stands on the path
      for (let i = 0; i < s.soldiers; i++) {
        const along = (i - (s.soldiers - 1) / 2) * 0.52;
        const perp = (i % 2 === 0 ? -0.1 : 0.1);
        out.push({ x: t.rallyX + tan.x * along + nx * perp, y: t.rallyY + tan.y * along + ny * perp });
      }
      return out;
    }
    function spawnSoldiers(t) {
      const s = statsOf(DATA.TOWERS.camp, t);
      const slots = rallySlots(t);
      for (let i = 0; i < s.soldiers; i++) {
        state.soldiers.push({
          id: nextId++, campId: t.id, slot: i,
          hp: Math.round(s.hp * mods.soldierHp), maxHp: Math.round(s.hp * mods.soldierHp), // TD-5 Tough Troops
          x: t.cx, y: t.cy, tx: slots[i].x, ty: slots[i].y,
          engagedId: 0, meleeCd: 0, respawnAt: 0, alive: true,
        });
      }
    }
    function defaultRally(pad) {
      // nearest point on the path within rally range of the pad (sampled)
      let best = null, bestD = Infinity;
      for (let d = 0; d <= path.total; d += 0.25) {
        const p = posAt(path, d);
        const dd = (p.x - (pad.cx + 0.5)) ** 2 + (p.y - (pad.cy + 0.5)) ** 2;
        if (dd < bestD) { bestD = dd; best = p; }
      }
      return best || { x: pad.cx + 0.5, y: pad.cy + 0.5 };
    }

    function soldierTick() {
      for (const t of state.towers) {
        if (t.lineId !== "camp") continue;
        const s = statsOf(DATA.TOWERS.camp, t);
        const mine = state.soldiers.filter((x) => x.campId === t.id);
        // respawns
        for (const sol of mine) {
          if (!sol.alive && sol.respawnAt && state.tick >= sol.respawnAt) {
            sol.alive = true; sol.hp = Math.round(s.hp * mods.soldierHp); sol.maxHp = sol.hp;
            sol.x = t.cx; sol.y = t.cy; sol.engagedId = 0; sol.respawnAt = 0;
            const slots = rallySlots(t);
            sol.tx = slots[sol.slot % slots.length].x; sol.ty = slots[sol.slot % slots.length].y;
          }
        }
      }
      const countBlocked = (sol) => state.enemies.filter((x) => x.alive && x.blockedBy === sol.id).length;
      const tryEngage = (sol, cs, maxBlocks) => {
        for (const e of state.enemies) {
          if (!e.alive || e.blockedBy) continue;
          const ed = enemyDef(e);
          if (ed.flier || ed.boss || isHidden(e)) continue;
          const p = posAt(path, e.dist);
          if ((p.x - sol.x) ** 2 + (p.y - sol.y) ** 2 <= 0.55 * 0.55) {
            e.blockedBy = sol.id;
            if (!sol.engagedId) sol.engagedId = e.id;
            if (cs.stun && !e.stunApplied) {
              e.stunApplied = true;
              e.stunnedUntil = state.tick + Math.round(cs.stun * DATA.TICK_RATE);
              emit({ type: "stun", x: p.x, y: p.y });
            }
            if (countBlocked(sol) >= maxBlocks) break;
          }
        }
      };
      for (const sol of state.soldiers) {
        if (!sol.alive) continue;
        const camp = towerById(sol.campId);
        if (!camp) { sol.alive = false; continue; } // camp sold → soldiers pack up
        const cs = statsOf(DATA.TOWERS.camp, camp);
        const maxBlocks = cs.blocks || 1;
        // if our foe just died but others are still held by us, adopt the next one
        if (!sol.engagedId) {
          const adopted = state.enemies.find((x) => x.alive && x.blockedBy === sol.id);
          if (adopted) sol.engagedId = adopted.id;
        }
        if (sol.engagedId) {
          const foe = enemyById(sol.engagedId);
          if (!foe) { sol.engagedId = 0; continue; }
          if (isHidden(foe)) { sol.engagedId = 0; continue; } // foe phased/tunnelled → disengage, don't swing at a hidden enemy
          // melee trade — soldier swings
          if (sol.meleeCd > 0) sol.meleeCd -= 1;
          if (sol.meleeCd <= 0) {
            sol.meleeCd = Math.round(cs.rate * DATA.TICK_RATE);
            const hit = computeHit(cs.dmg, "bonk", foe);
            dealDamage(foe, hit.hpDmg, 0, "melee");
            if (!foe.alive) { sol.engagedId = 0; continue; }
          }
          // foe swings back (unless stunned)
          const fd = enemyDef(foe);
          if (state.tick >= foe.stunnedUntil) {
            if (foe.meleeCd > 0) foe.meleeCd -= 1;
            if (foe.meleeCd <= 0 && fd.meleeDmg > 0) {
              foe.meleeCd = Math.round(fd.meleeRate * DATA.TICK_RATE);
              sol.hp -= Math.round(fd.meleeDmg * (1 - (cs.armor || 0)));
              if (sol.hp <= 0) {
                sol.alive = false;
                sol.respawnAt = state.tick + Math.round(cs.respawn * DATA.TICK_RATE);
                foe.blockedBy = 0; sol.engagedId = 0;
                emit({ type: "soldier-down", x: sol.x, y: sol.y });
              }
            }
          }
          // a multi-blocker (Dino) keeps grabbing while it has spare capacity
          if (sol.alive && countBlocked(sol) < maxBlocks) tryEngage(sol, cs, maxBlocks);
          continue;
        }
        // walk to post
        const dx = sol.tx - sol.x, dy = sol.ty - sol.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0.05) {
          const step = Math.min(d, R.soldierWalkSpeed * DT);
          sol.x += (dx / d) * step; sol.y += (dy / d) * step;
          continue;
        }
        // at post → engage whatever unblocked ground enemies are in reach
        tryEngage(sol, cs, maxBlocks);
      }
    }

    // ---- Tower fire dispatch ----
    function fireTowers() {
      for (const t of state.towers) {
        const def = DATA.TOWERS[t.lineId];
        const s = statsOf(def, t);
        if (t.disabledUntil && state.tick < t.disabledUntil) continue; // The Static jammed this gun
        if (t.cooldown > 0) t.cooldown -= 1;

        if (def.kind === "dart") {
          // "first" stays STICKY (no thrash — hold the leader until it dies or
          // leaves range). strong/last/close must RE-EVALUATE every tick — the
          // old sticky-keep honored the mode only at acquisition, so a stronger
          // (or newly-most-progressed / closer) enemy entering range was ignored
          // and the mode read as inert. fan/mortar already re-pick each tick.
          const cur = enemyById(t.targetId);
          const dartRange = s.range * rangeMul; // night dims the dart's reach
          let keep = false;
          if (cur && t.targeting === "first" && !isHidden(cur)) { // drop a target that phased/tunnelled away
            const p = posAt(path, cur.dist);
            keep = (p.x - t.cx) ** 2 + (p.y - t.cy) ** 2 <= dartRange * dartRange;
          }
          const prevTarget = t.targetId;
          if (!keep) t.targetId = pickByMode(candidates(t, 0, dartRange, def.hitsFliers), t.targeting, t);
          if (s.spinUp) {
            // Minigun spin-up ramps only while locked on the SAME target; a real
            // retarget resets it (a same-tick re-pick of the same enemy does not).
            if (t.targetId && t.targetId === prevTarget) t.heat = Math.min(1, (t.heat || s.heatFloor) + DT / s.spinUp);
            else t.heat = s.heatFloor;
          }
          if (t.targetId && t.cooldown <= 0) {
            t.cooldown = Math.round(s.rate * DATA.TICK_RATE);
            let dmg = s.dmg * mods.dartDmg; // TD-5 Sharp Darts
            if (s.spinUp) dmg = Math.max(1, Math.round(s.dmg * mods.dartDmg * (t.heat || s.heatFloor)));
            let crit = false;
            if (s.crit && rng() < s.crit) { dmg = Math.round(dmg * s.critMult); crit = true; }
            state.projectiles.push({
              id: nextId++, x: t.cx, y: t.cy, targetId: t.targetId,
              dmg, dmgType: s.dmgType, speed: def.projectileSpeed, crit,
            });
            emit({ type: "shoot", x: t.cx, y: t.cy, tower: t.lineId });
          }
        } else if (def.kind === "mortar") {
          const cands = candidates(t, s.rangeMin, s.range * rangeMul, false);
          const targetId = pickByMode(cands, t.targeting, t);
          const target = targetId ? enemyById(targetId) : null;
          if (target && t.cooldown <= 0) {
            t.cooldown = Math.round(s.rate * DATA.TICK_RATE);
            const p = posAt(path, target.dist);
            const flight = Math.sqrt((p.x - t.cx) ** 2 + (p.y - t.cy) ** 2) / def.shellSpeed;
            const lead = posAt(path, target.dist + effSpeed(target) * flight);
            state.shells.push({
              id: nextId++, sx: t.cx, sy: t.cy, x: t.cx, y: t.cy,
              tx: lead.x, ty: lead.y, t: 0, T: Math.max(1, Math.round(flight * DATA.TICK_RATE)),
              dmg: s.dmg, splash: s.splash * mods.mortarSplash, goo: s.goo || null, // TD-5 Big Booms
            });
            emit({ type: "shoot", x: t.cx, y: t.cy, tower: t.lineId });
          }
        } else if (def.kind === "fan") {
          // aura: slow (and Blizzard brittle) everything in range, fliers half
          const aura = candidates(t, 0, s.auraRange + mods.fanAura, true); // TD-5 Cold Front
          for (const e of aura) {
            applySlow(e, s.slow, 0.5);
            if (s.brittle) e.brittleUntil = state.tick + Math.round(s.brittle * DATA.TICK_RATE);
          }
          if (s.chain) {
            if (t.cooldown <= 0) {
              const first = pickByMode(candidates(t, 0, s.zapRange, true), t.targeting, t);
              if (first) {
                t.cooldown = Math.round(s.chain.rate * DATA.TICK_RATE);
                const hitIds = [];
                let cur2 = enemyById(first);
                let dmg = s.chain.dmg;
                const points = [{ x: t.cx, y: t.cy }];
                while (cur2 && hitIds.length < s.chain.targets) {
                  hitIds.push(cur2.id);
                  const p = posAt(path, cur2.dist);
                  points.push({ x: p.x, y: p.y });
                  const hit = computeHit(Math.round(dmg), "zap", cur2);
                  dealDamage(cur2, hit.hpDmg, hit.shieldDmg, "zap");
                  dmg *= s.chain.decay;
                  // jump: nearest alive enemy within jump range of the last hit
                  let next = null, bestD = s.chain.jump * s.chain.jump;
                  for (const e of state.enemies) {
                    if (!e.alive || isHidden(e) || hitIds.indexOf(e.id) >= 0) continue; // chain can't arc onto a hidden (phased/tunnelling) enemy
                    const q = posAt(path, e.dist);
                    const dd = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
                    if (dd <= bestD) { bestD = dd; next = e; }
                  }
                  cur2 = next;
                }
                emit({ type: "chain", points });
              }
            }
          } else if (s.zapDps) {
            const beamId = pickByMode(candidates(t, 0, s.zapRange, true), t.targeting, t);
            const beamTarget = beamId ? enemyById(beamId) : null;
            if (beamTarget) {
              t.zapAcc = (t.zapAcc || 0) + s.zapDps * DT;
              if (t.zapAcc >= 1) {
                const whole = Math.floor(t.zapAcc);
                t.zapAcc -= whole;
                const hit = computeHit(whole, "zap", beamTarget);
                dealDamage(beamTarget, hit.hpDmg, hit.shieldDmg, "zap");
              }
            }
          }
        }
        // camps do their work in soldierTick()
      }
    }

    function shellTick() {
      for (const sh of state.shells) {
        sh.t += 1;
        const f = Math.min(1, sh.t / sh.T);
        sh.x = sh.sx + (sh.tx - sh.sx) * f;
        sh.y = sh.sy + (sh.ty - sh.sy) * f;
        if (sh.t >= sh.T) {
          sh.dead = true;
          emit({ type: "splash", x: sh.tx, y: sh.ty, r: sh.splash });
          for (const e of state.enemies) {
            if (!e.alive || enemyDef(e).flier || isHidden(e)) continue; // hidden (phased ghost / tunnelling mole) is untargetable, incl. by AoE
            const p = posAt(path, e.dist);
            const d = Math.sqrt((p.x - sh.tx) ** 2 + (p.y - sh.ty) ** 2);
            if (d <= sh.splash) {
              const factor = d <= 0.5 ? 1 : Math.max(0.25, 1 - ((d - 0.5) / (sh.splash - 0.5)) * 0.75);
              const hit = computeHit(sh.dmg * factor, "bonk", e);
              if (sh.goo) applySlow(e, sh.goo.slow, sh.goo.seconds);
              dealDamage(e, hit.hpDmg, hit.shieldDmg, "splash");
            }
          }
        }
      }
      state.shells = state.shells.filter((s) => !s.dead);
    }

    function tick() {
      if (state.phase === "won" || state.phase === "lost") return;
      state.tick += 1;

      if (state.phase === "build") {
        state.countdown -= 1;
        soldierTick(); // army guys deploy/walk to their rally posts between waves
        if (state.countdown <= 0) startWave();
        return;
      }

      while (spawnQueue.length && spawnQueue[0].tick <= state.tick) {
        spawnEnemy(spawnQueue.shift().type);
      }

      // status upkeep + movement
      for (const e of state.enemies) {
        if (!e.alive) continue;
        e.brittle = state.tick < e.brittleUntil;
        const def0 = enemyDef(e);
        // Glitter Ghost: phase in/out on a fixed cadence (deterministic).
        if (def0.phase) {
          const period = Math.round(def0.phase.every * DATA.TICK_RATE);
          e.phaseHidden = (state.tick % period) < Math.round(def0.phase.on * DATA.TICK_RATE);
        }
        // Battery Bot / Vacuum King: regenerate the Zap-absorbing shield.
        if (def0.shieldRegen && e.shield < def0.shield) e.shield = Math.min(def0.shield, e.shield + def0.shieldRegen * DT);
        // A ghost mid-phase / a mole underground can't be held by a blocker.
        if (e.blockedBy && isHidden(e)) { const s = soldierById(e.blockedBy); if (s) s.engagedId = 0; e.blockedBy = 0; }
        if (e.blockedBy) {
          const s = soldierById(e.blockedBy);
          if (!s) e.blockedBy = 0; // blocker died/despawned → resume next tick
          else continue;           // held in melee — no movement
        }
        if (state.tick < e.stunnedUntil) continue;
        e.dist += effSpeed(e) * DT;
        if (e.dist >= path.total) leakEnemy(e);
      }
      if (state.phase === "lost") return;

      soldierTick();
      if (state.phase === "lost") return;
      bossTick();  // Vacuum King sucks soldiers / The Static jams+summons
      stompTick(); // bosses stomp soldiers
      healTick();  // healers mend allies (before towers fire, so it's felt)
      fireTowers();

      // dart projectiles home
      for (const pr of state.projectiles) {
        const target = enemyById(pr.targetId);
        if (!target) { pr.dead = true; continue; }
        const tp = posAt(path, target.dist);
        const dx = tp.x - pr.x, dy = tp.y - pr.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const step = pr.speed * DT;
        if (d <= Math.max(0.18, step)) {
          const hit = computeHit(pr.dmg, pr.dmgType, target);
          emit({ type: "hit", x: tp.x, y: tp.y, crit: pr.crit || false, dmg: hit.hpDmg + hit.shieldDmg }); // dmg for the opt-in damage-number fx
          dealDamage(target, hit.hpDmg, hit.shieldDmg, "dart");
          pr.dead = true;
        } else {
          pr.x += (dx / d) * step;
          pr.y += (dy / d) * step;
        }
      }
      state.projectiles = state.projectiles.filter((p) => !p.dead);
      shellTick();
      // flush split-children (Mud Blob) now that the combat pass is done
      while (pendingSpawns.length) { const s = pendingSpawns.shift(); spawnEnemy(s.type, s.dist); }
      state.enemies = state.enemies.filter((e) => e.alive || state.phase !== "wave");

      finishIfWaveDone();
    }

    // ---- Player commands ----
    function place(lineId, padId) {
      const def = DATA.TOWERS[lineId];
      const pad = padById(padId);
      if (!def || !pad) return { ok: false, reason: "bad-id" };
      if (towerAt(padId)) return { ok: false, reason: "occupied" };
      if (state.phase === "won" || state.phase === "lost") return { ok: false, reason: "over" };
      const cost = def.tiers[0].cost;
      if (state.gold < cost) return { ok: false, reason: "gold" };
      state.gold -= cost;
      const t = {
        id: nextId++, lineId, tier: 1, branch: "", padId,
        cx: pad.cx, cy: pad.cy, cooldown: 0, targetId: 0, zapAcc: 0, heat: 0,
        targeting: def.defaultTargeting || "first", spent: cost,
        rallyX: 0, rallyY: 0, disabledUntil: 0, // TD-4: The Static can jam a gun
      };
      if (lineId === "camp") {
        const r = defaultRally(pad);
        t.rallyX = r.x; t.rallyY = r.y;
      }
      state.towers.push(t);
      if (lineId === "camp") spawnSoldiers(t);
      emit({ type: "build", x: pad.cx, y: pad.cy });
      return { ok: true };
    }
    function upgrade(towerId) {
      const t = towerById(towerId);
      if (!t) return { ok: false, reason: "bad-id" };
      const def = DATA.TOWERS[t.lineId];
      if (t.tier >= 3) return { ok: false, reason: t.tier === 3 ? "branch-required" : "max" };
      const cost = def.tiers[t.tier].cost;
      if (state.gold < cost) return { ok: false, reason: "gold" };
      state.gold -= cost; t.tier += 1; t.spent += cost;
      if (t.lineId === "camp") { // squad refits: heal to the new tier's hp
        const s = statsOf(def, t);
        for (const sol of state.soldiers) if (sol.campId === t.id && sol.alive) { sol.hp = Math.round(s.hp * mods.soldierHp); sol.maxHp = sol.hp; }
      }
      emit({ type: "upgrade", x: t.cx, y: t.cy });
      return { ok: true };
    }
    function branch(towerId, choice) {
      const t = towerById(towerId);
      if (!t) return { ok: false, reason: "bad-id" };
      if (t.tier !== 3 || t.branch) return { ok: false, reason: "not-tier3" };
      const def = DATA.TOWERS[t.lineId];
      const b = def.branches && def.branches[choice];
      if (!b) return { ok: false, reason: "bad-branch" };
      const bCost = Math.round(b.cost * mods.branchCost); // TD-5 Bulk Deal
      if (state.gold < bCost) return { ok: false, reason: "gold" };
      state.gold -= bCost; t.tier = 4; t.branch = choice; t.spent += bCost;
      if (b.defaultTargeting) t.targeting = b.defaultTargeting;
      if (t.lineId === "camp") {
        // rebuild the squad to the branch's roster
        for (const sol of state.soldiers) if (sol.campId === t.id) { sol.alive = false; sol.respawnAt = 0; sol.campId = -1; }
        spawnSoldiers(t);
      }
      emit({ type: "upgrade", x: t.cx, y: t.cy });
      return { ok: true };
    }
    function sell(towerId) {
      const i = state.towers.findIndex((t) => t.id === towerId);
      if (i < 0) return { ok: false, reason: "bad-id" };
      const t = state.towers[i];
      const refund = Math.floor(t.spent * mods.sellRefund); // TD-5 Trade-In (else R.sellRefund)
      state.gold += refund;
      for (const sol of state.soldiers) {
        if (sol.campId === t.id) {
          if (sol.alive && sol.engagedId) { const foe = enemyById(sol.engagedId); if (foe) foe.blockedBy = 0; }
          sol.alive = false; sol.respawnAt = 0; sol.campId = -1;
        }
      }
      emit({ type: "sell", x: t.cx, y: t.cy, refund });
      state.towers.splice(i, 1);
      return { ok: true, refund };
    }
    function setTargeting(towerId, mode) {
      const t = towerById(towerId);
      if (!t) return { ok: false, reason: "bad-id" };
      if (["first", "last", "strong", "close", "cheap"].indexOf(mode) < 0) return { ok: false, reason: "bad-mode" };
      if (mode === "cheap" && !mods.cheapTarget) return { ok: false, reason: "locked" }; // needs the star-tree node
      t.targeting = mode; t.targetId = 0;
      return { ok: true };
    }
    function rally(towerId, x, y) {
      const t = towerById(towerId);
      if (!t || t.lineId !== "camp") return { ok: false, reason: "bad-id" };
      const rr = DATA.TOWERS.camp.rallyRange;
      if ((x - t.cx) ** 2 + (y - t.cy) ** 2 > rr * rr) return { ok: false, reason: "range" };
      t.rallyX = x; t.rallyY = y;
      const slots = rallySlots(t);
      for (const sol of state.soldiers) {
        // Update EVERY living soldier's post — including one mid-melee. An
        // engaged soldier keeps fighting (soldierTick's engaged branch runs and
        // `continue`s before the walk step); it marches to the NEW post only
        // once it disengages, so a rally issued during combat is honored.
        if (sol.campId === t.id && sol.alive) {
          sol.tx = slots[sol.slot % slots.length].x;
          sol.ty = slots[sol.slot % slots.length].y;
        }
      }
      emit({ type: "rally", x, y });
      return { ok: true };
    }
    function callWave() {
      if (state.phase !== "build") return { ok: false, reason: "not-build" };
      const secondsLeft = state.countdown / DATA.TICK_RATE;
      const bonus = Math.ceil(secondsLeft * R.earlyCallRate * mods.earlyCall); // TD-5 Early Bird
      state.gold += bonus;
      state.countdown = 0;
      startWave();
      return { ok: true, bonus };
    }
    const notYet = () => ({ ok: false, reason: "not-built-yet" }); // TD-4 (levers)

    return {
      state, events, tick, place, upgrade, branch, sell, setTargeting, rally, callWave,
      pullLever: notYet,
      path, posAt: (dist) => posAt(path, dist),
      isHidden: (e) => isHidden(e), // pure read: is this enemy currently untargetable (phased ghost / tunnelling mole)?
      levelDef,
    };
  }

  const API = { createEngine, computeHit, hashState, buildPath, posAt, mulberry32, hashSeed, metaMods, generateEndlessWave, DT };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (global && typeof global === "object") global.TDLogic = API;
})(typeof window !== "undefined" ? window : globalThis);
