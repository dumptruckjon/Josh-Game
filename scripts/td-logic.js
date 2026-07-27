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
    // JSON.stringify turns NaN and +/-Infinity into "null", so a state that had
    // gone numerically bad hashed IDENTICALLY to a healthy one — the hash was
    // blind to precisely the corruption it exists to catch. Name them instead.
    if (typeof v === "number" && !isFinite(v)) return '"#' + String(v) + '"';
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
      // ranked skills: the highest owned rank wins (rank II requires rank I in
      // the tree UI, but the engine tolerates any set — pure input)
      startGold: s.has("startgold2") ? 80 : s.has("startgold") ? 40 : 0,
      lives: s.has("lives2") ? 4 : s.has("lives") ? 2 : 0,
      dartDmg: s.has("dartdmg2") ? 1.2 : s.has("dartdmg") ? 1.1 : 1,
      mortarSplash: s.has("mortarsplash2") ? 1.2 : s.has("mortarsplash") ? 1.1 : 1,
      fanAura: s.has("fanrange") ? 0.3 : 0,
      soldierHp: s.has("soldierhp2") ? 1.3 : s.has("soldierhp") ? 1.15 : 1,
      earlyCall: s.has("earlycall") ? 1.5 : 1,
      sellRefund: s.has("sellrefund") ? 0.9 : R.sellRefund,
      branchCost: s.has("branchcost") ? 0.9 : 1,
      cheapTarget: s.has("cheaptarget"),
      // TD-8 abilities + capstones (each consumed at exactly ONE engine site)
      bounty: s.has("bounty") ? 1.08 : 1,
      critBonus: s.has("critchance") ? 0.03 : 0,
      nightOwl: s.has("nightowl"),
      guardDog: s.has("guarddog") ? 0.75 : 1,
      patchKit: s.has("patchkit"),
      bossDmg: s.has("bossdmg") ? 1.15 : 1,
      allowance: s.has("allowance") ? 12 : 0,
      stickerShield: s.has("stickershield"),
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

  // `how` → the tower line that dealt it. One table, used by the run summary.
  const HOW_LINE = { dart: "dart", splash: "mortar", zap: "fan", melee: "camp", ability: "ability" };

  function createEngine(levelDef, opts) {
    opts = opts || {};
    const difficulty = opts.difficulty || "normal";
    const diff = DATA.DIFFICULTIES[difficulty] || DATA.DIFFICULTIES.normal;
    const seed = hashSeed(levelDef.id, difficulty, opts.seed == null ? 1 : opts.seed);
    const rng = mulberry32(seed);
    // TD-7: a level may define multiple lanes (`paths[]`) — a fork/merge or a
    // lever-switched track. Single-path levels are exactly `[levelDef.path]`, so
    // every enemy stays `pathIdx` 0 and behaviour is byte-identical to before.
    const paths = (levelDef.paths && levelDef.paths.length ? levelDef.paths : [levelDef.path]).map(buildPath);
    const path = paths[0]; // primary lane: rendering default + single-path reference
    const epath = (e) => paths[e.pathIdx || 0]; // the lane an enemy is travelling
    const epos = (e) => posAt(epath(e), e.dist); // its world position on that lane
    let nextId = 1;
    let spawnLane = 0; // round-robin lane cursor for non-lever multi-lane levels
    // Level gimmicks (TD-4): night dims every tower's reach EXCEPT the Fan (it
    // "feels" the cold, not sees), and conveyor strips speed enemies over a
    // stretch of the lane. Both are pure data read in the hot loops.
    // TD-5: star-tree modifiers (pure input) + endless setup (a separate seeded
    // stream generates each wave, so composition is reproducible per seed).
    // (mods computed FIRST — the night range multiplier below reads Night Owl.)
    const mods = metaMods(opts.meta);
    const nightBase = levelDef.night ? R.nightRangeMult : 1;
    const rangeMul = mods.nightOwl ? 1 - (1 - nightBase) / 2 : nightBase; // 🦉 halves the dimming
    const zones = levelDef.zones && levelDef.zones.length ? levelDef.zones : null;
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
      // waveIdx = waves CLEARED. sentIdx = waves SENT. They are equal at every
      // build boundary (so a mid-run checkpoint stays compatible) and diverge
      // only while an early-rushed wave overlaps the one already walking.
      waveIdx: 0,
      sentIdx: 0,
      lastCallTick: -9999, // a RUSH must be deliberate — see callInfo's `too-soon`
      gold: levelDef.startGold + diff.startGold + mods.startGold,
      lives: R.lives + mods.lives,
      stars: 0,
      cheated: false,
      shieldUsed: false, // 🌟 Sticker Shield: has the one free leak been spent?
      endless: !!endlessWorld,
      leverRoute: 0, // TD-7: which lane new / pre-fork enemies take (lever levels)
      leverCd: 0,    // tick until the lever can be thrown again
      abilityCd: {}, // TD-9: ability id → tick it becomes usable again
      puddles: [],   // TD-9: live Sticky Floor zones { x, y, r, slow, until }
      // TD-13 run tallies. These live in STATE, not in the event stream: the
      // event buffer is capped at 400, so a scripted/headless run that
      // simulates a whole wave before draining would silently lose most of it.
      // In state they are exact, deterministic, and readable by a node sim.
      dmgBy: {}, kills: 0, goldEarned: 0,
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

    // APPENDS, never replaces — a rushed wave has to join the queue of the one
    // already walking. (At a normal wave start the queue is empty, so every
    // historical stream is byte-identical.)
    function scheduleWave(idx) {
      const wave = waveAt(idx);
      for (const g of wave.groups) {
        for (let i = 0; i < g.count; i++) {
          const jitter = (rng() - 0.5) * 0.3;
          const at = Math.max(0, g.delay + i * g.gap + jitter);
          // TD-16 🚪 Side Door: `g.at` is a path DISTANCE — the group walks in
          // partway down the lane instead of at the entrance, so a board packed
          // around the door does nothing about them. spawnEnemy already took a
          // dist (split children, boss summons), so this is one carried field.
          spawnQueue.push({ tick: state.tick + Math.round(at * DATA.TICK_RATE), type: g.type, dist: g.at || 0 });
        }
      }
      spawnQueue.sort((a, b) => a.tick - b.tick || (a.type < b.type ? -1 : 1));
    }

    function startWave() {
      state.phase = "wave";
      scheduleWave(state.sentIdx);
      state.sentIdx += 1;
      emit({ type: "wave", n: state.sentIdx, inFlight: state.sentIdx - state.waveIdx });
    }

    function spawnEnemy(type, dist, pathIdx) {
      const def = DATA.ENEMIES[type];
      // lane: split/summon children inherit their parent's (passed in); a lever
      // level sends fresh spawns down the currently-thrown route; a plain
      // multi-lane level round-robins; a single-path level is always lane 0.
      const lane = pathIdx != null ? pathIdx
        : levelDef.lever ? state.leverRoute
        : paths.length > 1 ? (spawnLane++ % paths.length)
        : 0;
      state.enemies.push({
        id: nextId++, type, pathIdx: lane, spawnCd: 0, hurriedUntil: 0, hurriedMult: 1,
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
        sapCd: 0, lastPhase: -1, // TD-10 sap timer; boss phase-crossing tracker
        alive: true,
      });
      if (def.boss) emit({ type: "boss", name: def.name });
    }

    // TD-9 Overclock: ONE fire-rate multiplier read at every cooldown-set site,
    // so any future tower line inherits the ability without new code.
    // TD-16 ⚡ Power Pad: a pad may carry a permanent `boost`, and it rides the
    // SAME multiplier — so the socket buffs a Dart, a Mortar, a tier-4 Minigun
    // and any line added later without one extra call site. The two stack
    // (an Overclocked tower on a power pad really is both).
    function padOf(t) { return t ? padById(t.padId) : null; }
    function padBoost(t) { const p = padOf(t); return (p && p.boost) || null; }
    function boostOf(t) {
      const over = (t && t.boostUntil && state.tick < t.boostUntil) ? (t.boostMult || 2) : 1;
      const pb = padBoost(t);
      return over * ((pb && pb.rate) || 1);
    }
    // …and the matching REACH wrapper. A range buff has to reach every site a
    // range is read at — dart acquire, dart sticky-KEEP, mortar, fan aura, fan
    // zap — which is the documented "grep every place a target is chosen OR
    // kept" discipline, applied to distance instead of eligibility.
    function reachOf(t, r) { const pb = padBoost(t); return pb && pb.range ? r * pb.range : r; }
    // A soldier whose camp has been SOLD is an orphan: it is about to pack up, so
    // the Rally Horn must not count it as somebody to rally (it charged 80 gold
    // and a 30s cooldown to revive nobody).
    function livingCamp(s) { return !!towerById(s.campId); }
    function applySlow(e, pct, seconds) {
      // W5 Grease Racer: greased wheels — slows simply do not stick. Guarded in
      // the ONE slow path, so the Fan's aura, a Blizzard's cone and the Sticky
      // Floor puddle all honour it without their own check. It is the first
      // enemy that hard-counters the Fan, which is otherwise universal.
      if (enemyDef(e).slowImmune) return;
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
      // W6 Boom Box: an ally is blaring a beat nearby, so this one hustles. The
      // FLAG is written by hurryTick (one pass, the Junk Healer's shape) and
      // only READ here — effSpeed is already the single place a speed is
      // decided, so zones, enrage, boss phases and this all compose instead of
      // each growing their own speed computation.
      if (e.hurriedUntil && state.tick < e.hurriedUntil) base *= e.hurriedMult || 1;
      return base * (1 - slow);
    }

    // TD-10 Loose Screw: jams the NEAREST shooting tower within reach. Nearest
    // (not random) on purpose — you can SEE which gun is about to go quiet, so
    // it's a readable emergency rather than a dice roll, and it costs no rng
    // draw, which keeps every historical replay stream byte-identical.
    function sapTick() {
      for (const e of state.enemies) {
        if (!e.alive) continue;
        const def = enemyDef(e);
        if (!def.sap || isHidden(e)) continue;
        if (e.sapCd === 0) { e.sapCd = state.tick + Math.round(def.sap.every * DATA.TICK_RATE); continue; }
        if (state.tick < e.sapCd) continue;
        e.sapCd = state.tick + Math.round(def.sap.every * DATA.TICK_RATE);
        const p = epos(e);
        let victim = null, best = def.sap.radius * def.sap.radius;
        for (const t of state.towers) {
          if (t.lineId === "camp") continue; // camps are bodies, not electronics
          if (t.disabledUntil && state.tick < t.disabledUntil) continue;
          const d = (t.cx + 0.5 - p.x) ** 2 + (t.cy + 0.5 - p.y) ** 2;
          if (d < best) { best = d; victim = t; }
        }
        if (victim) {
          victim.disabledUntil = state.tick + Math.round(def.sap.seconds * DATA.TICK_RATE);
          emit({ type: "disable", x: victim.cx, y: victim.cy, seconds: def.sap.seconds });
        }
      }
    }

    // Junk Healer: mend nearby wounded allies (never itself) each tick.
    function healTick() {
      for (const h of state.enemies) {
        if (!h.alive) continue;
        const def = enemyDef(h);
        if (!def.heal) continue;
        const hp = epos(h), r2 = def.heal.radius * def.heal.radius;
        for (const e of state.enemies) {
          if (!e.alive || e === h || e.hp >= e.maxHp) continue;
          const p = epos(e);
          if ((p.x - hp.x) ** 2 + (p.y - hp.y) ** 2 <= r2) e.hp = Math.min(e.maxHp, e.hp + def.heal.hps * DT);
        }
      }
    }

    // W6 Boom Box: hurry every ally in earshot. A write pass, not a per-enemy
    // scan inside effSpeed — the same reason healTick exists. A hurrier does not
    // hurry ITSELF (it is already the thing you should be shooting), and a
    // hidden one is inaudible, matching every other aura in the game.
    function hurryTick() {
      for (const h of state.enemies) {
        if (!h.alive) continue;
        const def = enemyDef(h);
        if (!def.hurry || isHidden(h)) continue;
        const hp2 = epos(h), r2 = def.hurry.radius * def.hurry.radius;
        for (const e of state.enemies) {
          if (!e.alive || e === h) continue;
          const p = epos(e);
          if ((p.x - hp2.x) ** 2 + (p.y - hp2.y) ** 2 <= r2) {
            e.hurriedUntil = state.tick + 2;      // refreshed every tick it is in range
            e.hurriedMult = def.hurry.mult;
          }
        }
      }
    }

    // 🐕 Guard Dog trains downed soldiers back 25% faster — ONE helper so every
    // KO path (stomp/suck here, melee death below) uses the same clock.
    const respawnTicks = (cs) => Math.round(cs.respawn * DATA.TICK_RATE * mods.guardDog);
    // KO a soldier (stomp/suck): send it to respawn, free whatever it held.
    function downSoldier(s) {
      const camp = towerById(s.campId);
      const cs = camp ? statsOf(DATA.TOWERS.camp, camp) : { respawn: 8 };
      s.alive = false; s.respawnAt = state.tick + respawnTicks(cs);
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
        const bp = epos(b), r2 = def.stomp.radius * def.stomp.radius;
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
        const bp = epos(e);
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
        // Emit once per phase crossing so the UI can sound/shake the escalation —
        // a boss getting scarier was previously silent.
        const phIdx = def.phases ? def.phases.indexOf(ph) : -1;
        if (phIdx >= 0 && e.lastPhase !== phIdx) { e.lastPhase = phIdx; if (phIdx > 0) emit({ type: "phase", name: def.name, phase: phIdx }); }
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
            for (let i = 0; i < ph.spawn.count; i++) pendingSpawns.push({ type: ph.spawn.type, dist: Math.max(0, e.dist - 0.5 - i * 0.4), pathIdx: e.pathIdx || 0 });
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
      const bounty = Math.round(def.bounty * diff.bounty * mods.bounty); // 🪙 Bounty Hunter
      state.gold += bounty + (def.goldBurst || 0); // Piñata candy-burst
      state.kills += 1;
      state.goldEarned += bounty + (def.goldBurst || 0);
      // Splitters (Mud Blob) spawn children at the death spot — BUFFERED so we
      // never mutate state.enemies mid-iteration; flushed after the combat pass.
      if (def.split) for (let i = 0; i < def.split.count; i++) pendingSpawns.push({ type: def.split.into, dist: e.dist, pathIdx: e.pathIdx || 0 });
      const p = epos(e);
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
    // `preScaled` = the caller already applied the damage multipliers (the Fan's
    // beam has to, because it delivers 1 damage per tick and rounding here would
    // erase every percentage). Everything else passes it undefined.
    function dealDamage(e, hpDmg, shieldDmg, how, preScaled) {
      // 👊 Boss Bonker: bosses take +15% of EVERYTHING (hp + shield), applied in
      // the ONE damage path so every tower/soldier hit benefits alike.
      if (!preScaled && mods.bossDmg > 1 && enemyDef(e).boss) {
        hpDmg = Math.round(hpDmg * mods.bossDmg);
        shieldDmg = Math.round(shieldDmg * mods.bossDmg);
      }
      // TD-10 Couch Cushion: soaks AREA damage. Applied in the ONE damage path
      // and keyed on `how`, so mortar splash and the Toy Box Drop both honour
      // it — and a future AoE inherits it for free. A chain-lightning jump is
      // deliberately NOT area damage: it arcs to one enemy at a time (`how` is
      // "zap"), which is exactly the "use single-target" answer the Cushion's
      // own guide line tells you to reach for. An older comment here claimed
      // chain was included; it never was, and it should not be.
      const sr = enemyDef(e).splashResist;
      if (sr && (how === "splash" || how === "ability")) {
        hpDmg = Math.round(hpDmg * (1 - sr));
        shieldDmg = Math.round(shieldDmg * (1 - sr));
      }
      // W6 Bubble Wrap: the Cushion's MIRROR. A single hit only pops one bubble,
      // so the BONK family (a dart's pellet, a soldier's swing) lands soft while
      // splash, zap and abilities tear straight through. It is the first enemy
      // that directly answers the Dart — the generalist that clears 16/16 on
      // normal — and it sits here, beside its mirror, in the one damage path, so
      // every future source is keyed by its own `how` with no new call site.
      const br = enemyDef(e).bonkResist;
      if (br && (how === "dart" || how === "melee")) {
        hpDmg = Math.round(hpDmg * (1 - br));
        shieldDmg = Math.round(shieldDmg * (1 - br));
      }
      const hpBefore = e.hp, shieldBefore = e.shield || 0;
      if (shieldDmg && e.shield) e.shield = Math.max(0, e.shield - shieldDmg);
      if (hpDmg > 0) { e.hp -= hpDmg; triggerCharge(e); }
      // Damage BY LINE, tallied in the ONE damage path — `how` already names the
      // source at every call site (dart / splash=mortar / zap=fan / melee=camp /
      // ability), so no call site had to change and a future line gets counted
      // the moment it routes through here.
      // It credits what LANDED, not what was swung: a 300-damage Toy Box Drop on
      // a 6hp sock did 6 points of work, and counting the swing made the biggest
      // gun look like the best gun (the dart read 76% of a run against 58% real).
      const src = HOW_LINE[how];
      if (src) {
        const eff = Math.min(Math.max(0, hpDmg), Math.max(0, hpBefore))
          + Math.min(Math.max(0, shieldDmg), shieldBefore);
        state.dmgBy[src] = (state.dmgBy[src] || 0) + eff;
      }
      if (e.hp <= 0) killEnemy(e, how);
    }
    function leakEnemy(e) {
      e.alive = false;
      if (e.blockedBy) { const s = soldierById(e.blockedBy); if (s) s.engagedId = 0; e.blockedBy = 0; }
      // 🌟 Sticker Shield: the FIRST leak each run costs no lives. The leak
      // still HAPPENED (event fires, so the "No Leaks" badge stays honest) —
      // only the life cost is absorbed, once.
      if (mods.stickerShield && !state.shieldUsed) {
        state.shieldUsed = true;
        emit({ type: "leak", enemy: e.type, shielded: true });
        return;
      }
      const toll = enemyDef(e).lives;
      state.lives -= toll;
      // The COST rides the event: a boss eating 8 stickers at once has to read
      // as a catastrophe on the field, not as the same red flash a sock makes.
      emit({ type: "leak", enemy: e.type, lives: toll, boss: !!enemyDef(e).boss });
      // 🧸 Kid mode has NO failure state (RULE 5): the stickers can run low and
      // the leak still happens, but the fort never falls over. One flag, read at
      // the ONE place a run can be lost.
      if (state.lives <= 0) {
        state.lives = diff.noLose ? 1 : 0;
        if (!diff.noLose) { state.phase = "lost"; emit({ type: "lost" }); }
      }
    }

    // W5 Bolt Bucket: drips minions while ALIVE (the Mud Blob splits once, on
    // death — this is the opposite). Buffered like every other mid-tick spawn,
    // and it stops the moment the carrier dies, so killing the source early and
    // far from the door is the whole answer to it.
    function spawnerTick() {
      for (const e of state.enemies) {
        if (!e.alive) continue;
        const sp = enemyDef(e).spawner;
        if (!sp) continue;
        if (state.tick < (e.spawnCd || 0)) continue;
        // A LOAD, not a fountain. Unbounded drip is unbudgetable: 10 buckets on
        // a late wave out-lived their own HP by 7× and dropped ~18k of free HP
        // onto an 11k wave, wiping a flawless board in one go. `max` bounds the
        // load so the wave-budget audit's number stays the honest one.
        const cap = sp.max || Infinity;
        if ((e.spawned || 0) >= cap) continue;
        e.spawnCd = state.tick + Math.round(sp.every * DATA.TICK_RATE);
        const n = Math.min(sp.count, cap - (e.spawned || 0));
        e.spawned = (e.spawned || 0) + n;
        for (let i = 0; i < n; i++) {
          pendingSpawns.push({ type: sp.type, dist: Math.max(0, e.dist - 0.3 - i * 0.35), pathIdx: e.pathIdx || 0 });
        }
        emit({ type: "summon", x: epos(e).x, y: epos(e).y });
      }
    }

    function finishIfWaveDone() {
      if (spawnQueue.length || state.enemies.some((e) => e.alive)) return;
      state.enemies.length = 0;
      // Every wave that was SENT is now cleared — including any the player
      // rushed on top, so the two counters re-converge at the build boundary.
      const clearedFrom = state.waveIdx;
      state.waveIdx = state.sentIdx;
      // TD-8 capstone/ability payouts on a CLEARED wave (skipped when this wave
      // just won the level — the run is over, and Patch Kit must never inflate
      // the lives-based star count at the finish line). Patch Kit never heals
      // above the run's starting lives.
      // PER WAVE CLEARED, not per clearing: a RUSH overlaps two waves and they
      // finish together, so a single payout gave the Allowance once for two
      // waves and could skip a Patch Kit heal entirely by stepping over the 5th
      // (waveIdx 4 → 6). Without a rush this loop runs exactly once, so every
      // historical run is byte-identical.
      const levelWon = !endlessWorld && state.waveIdx >= waves.length;
      if (!levelWon) {
        for (let n = clearedFrom + 1; n <= state.waveIdx; n++) {
          if (mods.allowance) { state.gold += mods.allowance; state.goldEarned += mods.allowance; } // 💵 Allowance
          if (mods.patchKit && n % 5 === 0) state.lives = Math.min(R.lives + mods.lives, state.lives + 1); // 🩹 Patch Kit
        }
      }
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
          const pb = epos(best), pe = epos(e);
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
      if (def.tunnel) { const tot = epath(e).total; if (e.dist > tot / 3 && e.dist < (tot * 2) / 3) return true; }
      return false;
    }
    function candidates(t, minR, maxR, fliersOk) {
      const out = [];
      for (const e of state.enemies) {
        if (!e.alive || isHidden(e)) continue;
        if (!fliersOk && enemyDef(e).flier) continue;
        const p = epos(e);
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
      let bestD = Infinity, bestDist = 0, bestPath = path;
      for (const pth of paths) { // TD-7: nearest point across every lane
        for (let d = 0; d <= pth.total; d += 0.2) {
          const p = posAt(pth, d);
          const dd = (p.x - px) ** 2 + (p.y - py) ** 2;
          if (dd < bestD) { bestD = dd; bestDist = d; bestPath = pth; }
        }
      }
      const a = posAt(bestPath, Math.max(0, bestDist - 0.35));
      const b = posAt(bestPath, Math.min(bestPath.total, bestDist + 0.35));
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
      // nearest point on the path within rally range of the pad (sampled).
      // KNOWN, MEASURED, DELIBERATELY UNCHANGED: the comparison below mixes
      // spaces — a path point is a cell index, `pad.cx + 0.5` is a world
      // centre — so the default rally point is biased half a cell down-right,
      // and rally()'s own range check (which measures from t.cx) disagrees with
      // it by that much. Removing the bias is cosmetically correct and moves
      // 237 of the 247 shipped pads' default rally points, by up to 6 cells
      // where two lanes are near-equidistant, changing every camp's opening
      // posture on levels that were tuned with it — and it takes the count of
      // soldier posts sitting >0.5 cells off a lane from 1 to 4. The old point
      // is a real point ON the lane and the player can re-rally anywhere, so
      // the trade is not worth it. Fix it only alongside a camp re-tune.
      let best = null, bestD = Infinity;
      for (const pth of paths) { // TD-7: rally to the nearest point on ANY lane
        for (let d = 0; d <= pth.total; d += 0.25) {
          const p = posAt(pth, d);
          const dd = (p.x - (pad.cx + 0.5)) ** 2 + (p.y - (pad.cy + 0.5)) ** 2;
          if (dd < bestD) { bestD = dd; best = p; }
        }
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
          const p = epos(e);
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
            // ⚡ Overclock on a camp speeds up its SQUAD (the camp itself never
            // shoots, so the three cooldown sites never reached it).
            sol.meleeCd = Math.round(cs.rate * DATA.TICK_RATE / boostOf(camp));
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
                sol.respawnAt = state.tick + respawnTicks(cs);
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
          const dartRange = reachOf(t, s.range * rangeMul); // night dims the dart's reach; ⚡ a power pad extends it
          let keep = false;
          if (cur && t.targeting === "first" && !isHidden(cur)) { // drop a target that phased/tunnelled away
            const p = epos(cur);
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
            t.cooldown = Math.round(s.rate * DATA.TICK_RATE / boostOf(t));
            let dmg = s.dmg * mods.dartDmg; // TD-5 Sharp Darts
            if (s.spinUp) dmg = Math.max(1, Math.round(s.dmg * mods.dartDmg * (t.heat || s.heatFloor)));
            let crit = false;
            // 🍀 Lucky Darts adds flat crit chance to the whole dart line. The
            // rng draw only happens when a chance EXISTS, so meta-less runs
            // keep their exact historical rng stream (determinism hashes hold).
            const critChance = (s.crit || 0) + mods.critBonus;
            if (critChance > 0 && rng() < critChance) { dmg = Math.round(dmg * (s.critMult || 1.5)); crit = true; }
            state.projectiles.push({
              id: nextId++, x: t.cx, y: t.cy, targetId: t.targetId,
              dmg, dmgType: s.dmgType, speed: def.projectileSpeed, crit,
            });
            emit({ type: "shoot", x: t.cx, y: t.cy, tower: t.lineId });
          }
        } else if (def.kind === "mortar") {
          const cands = candidates(t, s.rangeMin, reachOf(t, s.range * rangeMul), false);
          const targetId = pickByMode(cands, t.targeting, t);
          const target = targetId ? enemyById(targetId) : null;
          if (target && t.cooldown <= 0) {
            t.cooldown = Math.round(s.rate * DATA.TICK_RATE / boostOf(t));
            const p = epos(target);
            const flight = Math.sqrt((p.x - t.cx) ** 2 + (p.y - t.cy) ** 2) / def.shellSpeed;
            const lead = posAt(epath(target), target.dist + effSpeed(target) * flight);
            state.shells.push({
              id: nextId++, sx: t.cx, sy: t.cy, x: t.cx, y: t.cy,
              tx: lead.x, ty: lead.y, t: 0, T: Math.max(1, Math.round(flight * DATA.TICK_RATE)),
              dmg: s.dmg, splash: s.splash * mods.mortarSplash, goo: s.goo || null, // TD-5 Big Booms
            });
            emit({ type: "shoot", x: t.cx, y: t.cy, tower: t.lineId });
          }
        } else if (def.kind === "fan") {
          // aura: slow (and Blizzard brittle) everything in range, fliers half
          const aura = candidates(t, 0, reachOf(t, s.auraRange + mods.fanAura), true); // TD-5 Cold Front
          for (const e of aura) {
            applySlow(e, s.slow, 0.5);
            if (s.brittle) e.brittleUntil = state.tick + Math.round(s.brittle * DATA.TICK_RATE);
          }
          if (s.chain) {
            if (t.cooldown <= 0) {
              const first = pickByMode(candidates(t, 0, reachOf(t, s.zapRange), true), t.targeting, t);
              if (first) {
                t.cooldown = Math.round(s.chain.rate * DATA.TICK_RATE / boostOf(t));
                const hitIds = [];
                let cur2 = enemyById(first);
                let dmg = s.chain.dmg;
                const points = [{ x: t.cx, y: t.cy }];
                while (cur2 && hitIds.length < s.chain.targets) {
                  hitIds.push(cur2.id);
                  const p = epos(cur2);
                  points.push({ x: p.x, y: p.y });
                  const hit = computeHit(Math.round(dmg), "zap", cur2);
                  dealDamage(cur2, hit.hpDmg, hit.shieldDmg, "zap");
                  dmg *= s.chain.decay;
                  // jump: nearest alive enemy within jump range of the last hit
                  let next = null, bestD = s.chain.jump * s.chain.jump;
                  for (const e of state.enemies) {
                    if (!e.alive || isHidden(e) || hitIds.indexOf(e.id) >= 0) continue; // chain can't arc onto a hidden (phased/tunnelling) enemy
                    const q = epos(e);
                    const dd = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
                    if (dd <= bestD) { bestD = dd; next = e; }
                  }
                  cur2 = next;
                }
                emit({ type: "chain", points });
              }
            }
          } else if (s.zapDps) {
            const beamId = pickByMode(candidates(t, 0, reachOf(t, s.zapRange), true), t.targeting, t);
            const beamTarget = beamId ? enemyById(beamId) : null;
            if (beamTarget) {
              // ⚡ Overclock: the Fan has no cooldown to divide, so the boost has
              // to scale the beam's accumulation or the ability is a paid no-op.
              // Multipliers must scale the BEAM, not the single point of damage
              // it delivers per tick. computeHit and dealDamage both ROUND, and
              // a 6-14 dps beam accumulates to exactly 1 — so brittle (+20%)
              // and Boss Bonker (+15%) rounded straight back to 1 and did
              // literally nothing on a Fan. Applied to the accumulator instead,
              // and dealDamage is told not to re-apply them. (Armor never
              // touches zap, and splashResist is keyed on splash/ability, so
              // the beam loses nothing by taking this path.)
              const zapBoss = (mods.bossDmg > 1 && enemyDef(beamTarget).boss) ? mods.bossDmg : 1;
              const zapBrittle = beamTarget.brittle ? R.brittleBonus : 1;
              t.zapAcc = (t.zapAcc || 0) + s.zapDps * DT * boostOf(t) * zapBoss * zapBrittle;
              if (t.zapAcc >= 1) {
                const whole = Math.floor(t.zapAcc);
                t.zapAcc -= whole;
                // a shield soaks zap first — the same split computeHit does
                const sh = Math.min(whole, beamTarget.shield || 0);
                dealDamage(beamTarget, whole - sh, sh, "zap", true);
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
            const p = epos(e);
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
        // A puddle laid down BEFORE the wave must still burn down — this branch
        // returns early, so without this a pre-placed Sticky Floor would live
        // for ever (caught by the browser test, not by reading the code).
        puddleTick();
        if (state.countdown <= 0) startWave();
        return;
      }

      while (spawnQueue.length && spawnQueue[0].tick <= state.tick) {
        const q = spawnQueue.shift();
        spawnEnemy(q.type, q.dist || 0);
      }

      // status upkeep + movement
      for (const e of state.enemies) {
        if (!e.alive) continue;
        e.brittle = state.tick < e.brittleUntil;
        // TD-10 Drip Slime: a slow FEEDS it. A fan-only board can hold it still
        // for ever and never kill it — bring damage, not just crowd control.
        const shDef = enemyDef(e);
        if (shDef.slowHeal && state.tick < e.slowUntil && e.slowPct > 0) {
          e.hp = Math.min(e.maxHp, e.hp + shDef.slowHeal.hps * DT);
        }
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
        if (e.dist >= epath(e).total) leakEnemy(e);
      }
      if (state.phase === "lost") return;

      soldierTick();
      if (state.phase === "lost") return;
      bossTick();  // Vacuum King sucks soldiers / The Static jams+summons
      stompTick(); // bosses stomp soldiers
      healTick();  // healers mend allies (before towers fire, so it's felt)
      sapTick();   // Loose Screws jam a nearby gun
      puddleTick(); // TD-9 Sticky Floor zones re-slow whatever is standing in them
      fireTowers();

      // dart projectiles home
      for (const pr of state.projectiles) {
        const target = enemyById(pr.targetId);
        if (!target) { pr.dead = true; continue; }
        // The LAST damage path without an isHidden gate: acquisition, splash and
        // the chain jump all check it, but a dart already in the air landed on a
        // phased Glitter Ghost / tunnelling Digger Mole anyway. The shot fizzles.
        if (isHidden(target)) { pr.dead = true; continue; }
        const tp = epos(target);
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
      hurryTick();
      spawnerTick();
      // flush split-children (Mud Blob) now that the combat pass is done
      while (pendingSpawns.length) { const s = pendingSpawns.shift(); spawnEnemy(s.type, s.dist, s.pathIdx); }
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
    // How much gold calling right now would pay, and whether it is allowed.
    // Mid-wave the whole upcoming build phase is being skipped, so it pays the
    // full-countdown rate — the same formula, at its maximum.
    function callInfo() {
      const over = state.phase === "won" || state.phase === "lost";
      const secondsLeft = state.phase === "build" ? state.countdown / DATA.TICK_RATE : R.buildCountdown;
      const bonus = Math.ceil(secondsLeft * R.earlyCallRate * mods.earlyCall); // TD-5 Early Bird
      const inFlight = state.sentIdx - state.waveIdx;
      const more = endlessWorld || state.sentIdx < waves.length;
      // A RUSH must be a DELIBERATE act. Without this, a fumbled double-tap on
      // CALL — the button relabels itself from ▶ CALL to ⏩ RUSH the instant the
      // wave starts — would dump a second wave on you before you saw the first.
      // (The toddler-chaos guardrail caught exactly that.)
      const settle = Math.round((R.rushSettle || 2) * DATA.TICK_RATE);
      let reason = "";
      if (over) reason = "over";
      else if (!more) reason = "no-more-waves";
      else if (state.phase === "wave" && inFlight >= (R.maxWavesInFlight || 2)) reason = "too-many-waves";
      else if (state.phase === "wave" && state.tick - state.lastCallTick < settle) reason = "too-soon";
      return { ok: !reason, reason, bonus, inFlight, max: R.maxWavesInFlight || 2 };
    }
    function callWave() {
      const info = callInfo();
      if (!info.ok) return { ok: false, reason: info.reason };
      state.gold += info.bonus;
      // The run summary reports "gold earned", and this is real income — on a
      // run that always calls early it is hundreds of gold. It used to count
      // bounties only, so the line understated a third of what you made.
      state.goldEarned += info.bonus;
      state.countdown = 0;
      state.lastCallTick = state.tick;
      startWave();
      return { ok: true, bonus: info.bonus };
    }
    // TD-7: throw the track-switch lever (L10). Toggles which lane fresh spawns
    // take AND reroutes every enemy still on the shared prefix (dist < fork.at) —
    // which is seamless because both lanes share identical geometry up to the
    // fork, so the enemy's world position is unchanged; it just diverges when it
    // reaches the split. An 8s cooldown keeps it a deliberate, active-play tool.
    function pullLever() {
      if (!levelDef.lever) return { ok: false, reason: "no-lever" };
      if (state.phase !== "wave" && state.phase !== "build") return { ok: false, reason: "over" };
      if (state.tick < state.leverCd) return { ok: false, reason: "cooldown" };
      state.leverRoute = state.leverRoute ? 0 : 1;
      state.leverCd = state.tick + Math.round((R.leverCooldown || 8) * DATA.TICK_RATE);
      const forkAt = levelDef.fork ? levelDef.fork.at : 0;
      for (const e of state.enemies) if (e.alive && e.dist < forkAt) e.pathIdx = state.leverRoute;
      emit({ type: "lever", route: state.leverRoute });
      return { ok: true, route: state.leverRoute };
    }

    // ---- TD-9 active abilities: the in-WAVE decision layer ----
    // Each costs gold AND sits on a tick-stamped cooldown, so an ability is a
    // real trade against a tower rather than free power. Zero rng: a headless
    // sim can drive every one of them and a replay stays byte-identical.
    const abilityDef = (id) => (DATA.ABILITIES || []).find((a) => a.id === id) || null;
    function abilityReady(id) {
      const def = abilityDef(id);
      if (!def) return { ok: false, reason: "bad-ability" };
      // These are IN-WAVE abilities. Outside a wave there is nothing to hit and
      // a puddle would expire before the first enemy arrived, so spending gold
      // then is pure loss — refuse it rather than quietly take the money.
      if (state.phase !== "wave") return { ok: false, reason: "not-in-wave" };
      if (state.tick < (state.abilityCd[id] || 0)) return { ok: false, reason: "cooldown" };
      if (state.gold < def.gold) return { ok: false, reason: "gold" };
      return { ok: true, def };
    }
    // Would this use actually DO anything? An ability that changes nothing must
    // never charge gold or start a cooldown — that reads exactly like a broken
    // button (reported: "some of them don't even seem to work at all").
    function abilityWouldDo(def, o) {
      // The horn revives the downed AND heals the hurt, so it is useful whenever
      // any soldier is less than fully fit — not only when one is flat on its
      // back. (Reported: it refused while a camp was on the board.)
      if (def.kind === "instant") return state.soldiers.some((s) => livingCamp(s) && (!s.alive || s.hp < s.maxHp));
      if (def.kind === "tower") return !!towerById(o.towerId);
      if (def.dmg) {                                                             // something in the blast
        const r2 = def.radius * def.radius;
        return state.enemies.some((e) => {
          if (!e.alive || isHidden(e)) return false;
          const p = epos(e);
          return (p.x - o.x) ** 2 + (p.y - o.y) ** 2 <= r2;
        });
      }
      return true; // a zone is placed AHEAD of enemies on purpose — always valid
    }
    function useAbility(id, opts) {
      const chk = abilityReady(id);
      if (!chk.ok) return chk;
      const def = chk.def, o = opts || {};
      if (def.kind === "point" && (typeof o.x !== "number" || typeof o.y !== "number")) return { ok: false, reason: "needs-point" };
      if (!abilityWouldDo(def, o)) {
        // Distinguish "you have no camp" from "your squad is already fine" —
        // telling someone to build a camp they already own is worse than silence.
        const why = def.kind === "instant"
          ? (state.soldiers.length ? "all-healthy" : "no-soldiers")
          : def.kind === "tower" ? "no-tower" : "no-targets";
        return { ok: false, reason: why };
      }
      let hits = 0;
      if (def.kind === "point") {
        const r2 = def.radius * def.radius;
        for (const e of state.enemies) {
          if (!e.alive || isHidden(e)) continue; // an untargetable enemy is untargetable by EVERY damage path
          const p = epos(e);
          if ((p.x - o.x) ** 2 + (p.y - o.y) ** 2 > r2) continue;
          hits++;
          if (def.dmg) {
            const hit = computeHit(def.dmg, def.dmgType || "bonk", e);
            dealDamage(e, hit.hpDmg, hit.shieldDmg, "ability");
          }
        }
        if (def.slow) {
          // A LIVE zone, not a one-shot: enemies that walk in later are slowed
          // too. Refreshed each tick through the ONE applySlow (flier factor,
          // cap and strongest-wins all inherited).
          state.puddles.push({ x: o.x, y: o.y, r: def.radius, slow: def.slow, until: state.tick + Math.round(def.seconds * DATA.TICK_RATE) });
        }
      } else if (def.kind === "tower") {
        const t = towerById(o.towerId);
        t.boostUntil = state.tick + Math.round(def.seconds * DATA.TICK_RATE);
        t.boostMult = def.mult;
        hits = 1;
      } else { // instant — Rally Horn: every downed soldier back up NOW
        for (const t of state.towers) {
          if (t.lineId !== "camp") continue;
          const s = statsOf(DATA.TOWERS.camp, t);
          for (const sol of state.soldiers) {
            if (sol.campId !== t.id) continue;
            const wasHurt = !sol.alive || sol.hp < sol.maxHp;
            sol.hp = Math.round(s.hp * mods.soldierHp); sol.maxHp = sol.hp;
            if (!sol.alive) { sol.alive = true; sol.respawnAt = 0; sol.engagedId = 0; sol.x = t.cx; sol.y = t.cy; }
            if (wasHurt) hits++; // a heal counts too — the horn did something
          }
        }
      }
      state.gold -= def.gold;
      state.abilityCd[id] = state.tick + Math.round(def.cooldown * DATA.TICK_RATE);
      emit({ type: "ability", id, x: o.x, y: o.y, radius: def.radius || 0, hits });
      return { ok: true, hits };
    }
    // Live Sticky Floor zones re-apply their slow every tick (a short refresh so
    // leaving the puddle wears off quickly), and expire on their own tick.
    function puddleTick() {
      if (!state.puddles.length) return;
      for (let i = state.puddles.length - 1; i >= 0; i--) if (state.tick >= state.puddles[i].until) state.puddles.splice(i, 1);
      for (const z of state.puddles) {
        const r2 = z.r * z.r;
        for (const e of state.enemies) {
          if (!e.alive) continue;
          const p = epos(e);
          if (isHidden(e)) continue; // untargetable means untouchable — the Fan's aura already skips these
          if ((p.x - z.x) ** 2 + (p.y - z.y) ** 2 <= r2) applySlow(e, z.slow, 0.25);
        }
      }
    }

    return {
      state, events, tick, place, upgrade, branch, sell, setTargeting, rally, callWave,
      callInfo: () => callInfo(), // what a CALL right now would pay, and whether it is allowed
      pullLever, useAbility, abilityReady: (id) => abilityReady(id),
      paths, path, posAt: (dist) => posAt(path, dist), posOn: (pathIdx, dist) => posAt(paths[pathIdx || 0], dist),
      isHidden: (e) => isHidden(e), // pure read: is this enemy currently untargetable (phased ghost / tunnelling mole)?
      // Guardrail seam, the isHidden precedent: the ONE damage path, so a test
      // can prove a resistance is keyed on the right `how` without reaching
      // into internals or inferring it from a time-to-kill with confounds.
      dealDamage: (e, hpDmg, shieldDmg, how) => dealDamage(e, hpDmg, shieldDmg, how),
      rangeMul, // effective night range multiplier (Night Owl included) — the renderer's preview must match the engine
      levelDef,
    };
  }

  // ---- TD-12: the counter matrix, derived from the DATA (never hand-written) ----
  // The heart of this game was invisible: nothing told you that only Dart and Fan
  // hit air, that armor halves a dart's bonk, or that a shield eats the Fan's
  // zap. `enemyTraits` reads each enemy's own fields, so the guide can never
  // drift from the engine — add a field, the guide explains it.
  function enemyTraits(def) {
    if (!def) return [];
    const out = [];
    if (def.flier) out.push({ key: "flier", icon: "🪁", text: "Flies — only Dart and Fan can reach it" });
    if (def.armor >= 0.5) out.push({ key: "armor", icon: "🛡️", text: "Armored — bonk damage halved; the Fan's zap ignores armor" });
    else if (def.armor > 0) out.push({ key: "armor", icon: "🛡️", text: "Lightly armored — bonk damage reduced" });
    if (def.shield > 0) out.push({ key: "shield", icon: "🔋", text: "Shielded — the shield soaks zap first, and regrows" });
    if (def.splashResist) out.push({ key: "splash", icon: "🛋️", text: "Soaks blasts — splash lands at " + Math.round((1 - def.splashResist) * 100) + "%; use single-target" });
    if (def.slowHeal) out.push({ key: "slowheal", icon: "💧", text: "Regrows while SLOWED — slows alone will never kill it" });
    if (def.bonkResist) out.push({ key: "bonkresist", icon: "🧻", text: "Padded — single hits (dart, soldier) land at " + Math.round((1 - def.bonkResist) * 100) + "%; answer it with splash or zap" });
    if (def.hurry) out.push({ key: "hurry", icon: "📻", text: "Blares a beat — everything near it moves " + Math.round((def.hurry.mult - 1) * 100) + "% faster. Shoot the music, not the dancers" });
    if (def.slowImmune) out.push({ key: "slowimmune", icon: "🛹", text: "Greased — slows do NOTHING to it; you need damage or a body in the way" });
    if (def.spawner) out.push({ key: "spawner", icon: "🪣", text: "Drips out " + def.spawner.count + " × " + (DATA.ENEMIES[def.spawner.type] || { name: def.spawner.type }).name + " every " + def.spawner.every + "s while alive" + (def.spawner.max ? " (up to " + def.spawner.max + ")" : "") + " — kill it early and far from the door" });
    if (def.sap) out.push({ key: "sap", icon: "🔩", text: "Jams the nearest gun — camps are immune" });
    if (def.phase) out.push({ key: "phase", icon: "👻", text: "Phases out — untargetable in bursts" });
    if (def.tunnel) out.push({ key: "tunnel", icon: "🦫", text: "Tunnels the middle — untargetable and unblockable there" });
    if (def.split) out.push({ key: "split", icon: "🟤", text: "Splits into " + def.split.count + " when it dies" });
    if (def.heal) out.push({ key: "heal", icon: "🔧", text: "Mends nearby allies — kill it first" });
    if (def.charge) out.push({ key: "charge", icon: "🐂", text: "Charges when hit" });
    if (def.goldBurst) out.push({ key: "gold", icon: "🪅", text: "Bursts +" + def.goldBurst + " gold when popped" });
    if (def.boss) out.push({ key: "boss", icon: "👑", text: "Boss — its kit escalates as its health drops" });
    // The toll is the single most consequential number on the card: letting one
    // of these reach the door is not the same as letting a sock through.
    if (def.lives > 1) out.push({ key: "toll", icon: "💔", text: "Costs " + def.lives + " stickers if it reaches the door" });
    if (!out.length) out.push({ key: "plain", icon: "•", text: "No tricks — anything can hit it" });
    return out;
  }
  // Which tower lines can even REACH this enemy. The one place that answers
  // "why is nothing shooting it?" — the question the game never answered.
  function reachedBy(def) {
    const all = ["dart", "mortar", "fan", "camp"];
    if (def && def.flier) return ["dart", "fan"]; // mortar is ground-only, camps are bodies
    // Soldiers never engage a BOSS (tryEngage skips ed.boss), so listing the camp
    // on a boss card was the guide teaching something the engine forbids.
    if (def && def.boss) return ["dart", "mortar", "fan"];
    return all;
  }

  // The same problem `enemyTraits` solved for the roster, now for the BOARD.
  // TD-16 shipped five level gimmicks and documented exactly none of them: the
  // Toybox Guide covered enemies, towers and powers, so nothing anywhere told you
  // that night cuts Dart/Mortar reach, or that a brown patch slows and a chevron
  // strip speeds up. A player who cannot name a mechanic cannot plan around it —
  // which is precisely how the 🚪 side door came back as "it's malfunctioning".
  //
  // DERIVED from the level's own fields, like enemyTraits, so a new gimmick
  // explains itself and the guide can never drift from the data. A coverage
  // guardrail asserts every gimmick-bearing field produces an entry.
  function levelGimmicks(def) {
    if (!def) return [];
    const out = [];
    const zones = def.zones || [];
    const slow = zones.filter((z) => z.mult < 1), fast = zones.filter((z) => z.mult > 1);
    if (slow.length) out.push({ key: "mud", icon: "🕳️", name: "Mud Patch",
      text: "A gloopy brown stretch of lane. Anything crossing it walks at " + Math.round(slow[0].mult * 100) + "% speed — free extra seconds for whatever covers it." });
    if (fast.length) out.push({ key: "conveyor", icon: "➡️", name: "Conveyor",
      text: "A strip of scrolling arrows. It shoves everything along at " + Math.round(fast[0].mult * 100) + "% speed, so guns covering it get LESS time. Don't spend your board here." });
    if (def.night) out.push({ key: "night", icon: "🌙", name: "Lights Out",
      // read off RULES, never a literal — the guide must quote the engine's number
      text: "The room is dark: Dart and Mortar reach " + Math.round(DATA.RULES.nightRangeMult * 100) + "% as far. The Fan is unaffected — its aura doesn't need to see. A selected tower's ring always shows its TRUE reach." });
    if ((def.pads || []).some((p) => p.boost)) {
      const b = (def.pads.find((p) => p.boost) || {}).boost || {};
      out.push({ key: "power", icon: "⚡", name: "Power Pad",
        text: "A socket ringed in amber. Whatever you build on it fires " + Math.round(((b.rate || 1) - 1) * 100) + "% faster and reaches " + Math.round(((b.range || 1) - 1) * 100) + "% further. Put your best gun here." });
    }
    if ((def.waves || []).some((w) => (w.groups || []).some((g) => g.at > 0))) out.push({ key: "door", icon: "🚪", name: "Side Door",
      text: "Part of a wave walks in PARTWAY down the lane instead of at the start — behind anything you built up front. The door is marked on the field, and the next-wave line says how many are coming through it." });
    if (def.fork && def.lever) out.push({ key: "lever", icon: "🔀", name: "Track Switch",
      text: "A lever on the field. Tap it to send the traffic the long way round; the live route lights up and the button says which way it is thrown. The long way is slower for them and longer under your guns." });
    return out;
  }

  const API = { createEngine, computeHit, hashState, buildPath, posAt, mulberry32, hashSeed, metaMods, generateEndlessWave, enemyTraits, reachedBy, levelGimmicks, DT };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (global && typeof global === "object") global.TDLogic = API;
})(typeof window !== "undefined" ? window : globalThis);
