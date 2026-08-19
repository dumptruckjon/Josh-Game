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

  // 🎯 Rust Ray strips armour, and this is the ONE place armour is ever read —
  // so the strip covers the Dart, the Mortar's splash, a soldier's melee and
  // every ability at once, with no call site knowing about it (the Oil Drum's
  // one-write-zero-new-reads shape). `stripped` is resolved once per tick
  // beside `brittle`, so this stays a pure function of the enemy it is handed.
  // A body without the fields — every plain-object test fixture — degrades to
  // its plain armour rather than NaN: a field one short must degrade, not
  // disable (the `mult`-less zone and the `delay`-less wave group).
  function effArmor(enemy) {
    const a = enemy.armor || 0;
    if (!enemy.stripped) return a;
    return Math.max(0, a * (1 - (enemy.stripAmt || 0)));
  }

  // ---- Combat math (§5.1) — pure, unit-tested directly. ----
  function computeHit(dmg, dmgType, enemy) {
    let d = dmg;
    let shieldDmg = 0;
    if (dmgType === "zap" && enemy.shield > 0) {
      shieldDmg = Math.min(d, enemy.shield);
      d -= shieldDmg;
    }
    if (dmgType === "bonk") d *= (1 - effArmor(enemy));
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
      // ---- breadth (P4.3): seven NEW KINDS, each consumed at exactly ONE
      // engine site. Deliberately none of them is raw damage: three individual
      // Firepower nodes already erase a boss finale on their own, and under a
      // 6-slot pack it is CHOICE that makes the tree interesting, not power.
      // Every one is situational — dead weight on the wrong level, which is
      // precisely what makes packing it a decision.
      charge: s.has("sparebattery") ? 1 : 0,      // ⚙️ energy per wave
      slowSeconds: s.has("deepfreeze") ? 1.4 : 1, // slows linger
      abilityRadius: s.has("widerblast") ? 1.25 : 1,
      jamMul: s.has("fieldrepair") ? 0.5 : 1,     // a jammed gun returns sooner
      chainPlus: s.has("ricochet") ? 1 : 0,       // the Fan's chain jumps once more
      marchMul: s.has("quickmarch") ? 1.6 : 1,    // soldiers reach their post sooner
      // ---- breadth (W9 unblock): five MORE new kinds, same discipline — each
      // consumed at exactly ONE engine site, none of them raw damage. The tree
      // had to outgrow the star CEILING (`LEVELS.length * 3`) before a ninth
      // world could ship, and CLAUDE.md is explicit that it grows by BREADTH,
      // never by adding ranks, because a rank is power and a kind is a choice.
      abilityCdMul: s.has("quickhands") ? 0.8 : 1, // powers come back sooner
      mortarMinMul: s.has("closequarters") ? 0.6 : 1, // the tube's dead zone shrinks
      upgradeCost: s.has("handyman") ? 0.9 : 1,   // tiers 1-3 are cheaper (NOT branches — that is Bulk Deal)
      warmedUp: s.has("warmedup"),                // start a level with the energy bank full
      // ---- breadth (W10 unblock): five MORE kinds, same discipline again —
      // each consumed at exactly ONE engine site, none of them raw tower
      // damage, and every one SITUATIONAL (dead weight on the wrong board),
      // which is what makes packing it a decision rather than a power creep.
      // A tenth world takes the ceiling to 120⭐, and CLAUDE.md is explicit
      // that the tree grows by BREADTH, never by ranks: a rank is power, a
      // kind is a choice.
      chainDecayPlus: s.has("livewire") ? 0.12 : 0,  // 🔗 the Fan's chain keeps more per jump
      critMul: s.has("steadyaim") ? 1.25 : 1,        // 🎯 a crit hits harder (never more OFTEN)
      goldBurstMul: s.has("coinmagnet") ? 1.6 : 1,   // 🧲 piñata bursts pay more
      soldierArmor: s.has("padding") ? 0.25 : 0,     // 🧱 soldiers take less melee
      soldierDmg: s.has("drillsergeant") ? 1.25 : 1, // 🥁 soldiers hit harder
      // 🛬 Soft Landing cuts the toll of a MULTI-life leak only. A boss leak is
      // worth 6-10 stickers and is what QUANTIZES a finale (measured: L8 ended
      // on exactly 10 lives on all 8 seeds), so this is the one node aimed at
      // that shape — and it deliberately cannot touch a 1-life sock, or it
      // would just be Extra Hearts by another name.
      softLanding: s.has("softlanding") ? 2 : 0,
      // NOTE: 🧭 Scout Report is deliberately absent here. It is the tree's one
      // pure-INFORMATION node and the wave preview reads it from the run's own
      // `state.meta`, so a metaMods key for it would be dead code — and a dead
      // key made the "every node changes something" guardrail pass for the wrong
      // reason. UI-only nodes are named in that test instead.
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
    const runMeta = (opts.meta || []).slice();   // what this run was actually handed
    // P6 powers: DERIVED, never a written literal (the TOTAL_PLANNED lesson).
    // With no opt the run carries the whole pool, which keeps every existing
    // engine test and sim byte-identical; a real run is handed its equipped four.
    const runPowers = Array.isArray(opts.powers) ? opts.powers.slice() : (DATA.ABILITIES || []).map((a) => a.id);
    // TD-18 challenge chips: opt-in CONSTRAINTS, pure input exactly like meta
    // and powers. The default is NO chips, so every shipped sim and test is
    // byte-identical; bans derive from DATA.CHIPS (the picker's own definition,
    // one owner) and an unknown id degrades to no effect — a hand-edited save
    // must never crash the engine or invent a ban that nothing declared.
    const runChips = Array.isArray(opts.chips) ? opts.chips.slice() : [];
    const chipDefs = (DATA.CHIPS || []).filter((c) => runChips.indexOf(c.id) >= 0);
    const chipLineBans = new Set(chipDefs.filter((c) => c.ban && c.ban.line).map((c) => c.ban.line));
    const chipNoPowers = chipDefs.some((c) => c.ban && c.ban.powers);
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
      lives: maxLives(),
      stars: 0,
      cheated: false,
      shieldUsed: false, // 🌟 Sticker Shield: has the one free leak been spent?
      endless: !!endlessWorld,
      leverRoute: 0, // TD-7: which lane new / pre-fork enemies take (lever levels)
      leverCd: 0,    // tick the lever re-arms (starts when the diversion ENDS, not when it is thrown)
      leverUntil: 0, // TD-17: tick the timed diversion expires and the track snaps back to short
      abilityCd: {}, // TD-9: ability id → tick it becomes usable again
      // ⚙️ Toy Energy: +chargePerWave on each wave SENT, capped at chargeMax.
      // 🔌 Warmed Up starts the bank full, so wave 1 can afford a power.
      charge: mods.warmedUp ? DATA.RULES.chargeMax : 0,
      chargeBought: 0,                            // ⚙️ bought with gold THIS wave
      meta: runMeta, // P4: the EQUIPPED loadout this run brought (pure input, recorded so it is testable)
      // P6: the POWERS this run brought. Recorded ON the run for the same reason
      // `meta` is — a guardrail that only inspects the checkpoint misses the live
      // path. The engine's own default is the WHOLE pool (so every shipped engine
      // test is unchanged); the UI always passes a real, slot-capped list.
      powers: runPowers,
      // TD-18: the chips this run is constrained by — recorded ON the run for
      // the same reason meta and powers are, and so the checkpoint can carry
      // them (a resumed challenge run must still be the challenge).
      chips: runChips,
      markId: 0, markUntil: 0, // 📌 Call the Shot: whole-board focus fire, tick-stamped
      puddles: [],   // TD-9: live Sticky Floor zones { x, y, r, slow, until }
      reveals: [],   // 🧨's reveal rider: { x, y, r, until } — read by the ONE isHidden gate
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
          // `|| 0` on delay and a default gap: a group missing either used to
          // make `at` NaN, and `Math.max(0, NaN)` is NaN — so the spawn tick was
          // NaN, the enemy never arrived, and the WAVE NEVER FINISHED. A level
          // authored one field short did not fail loudly; it hung, and a sim
          // reported it as an unwinnable level. Exactly the class already
          // documented for a `mult`-less zone silently NaN-ing every enemy's
          // `dist`. Every shipped group carries both (guardrail-locked), so
          // this changes no historical stream — it just refuses to hang.
          const at = Math.max(0, (g.delay || 0) + i * (g.gap || 0.6) + jitter);
          // TD-16 🚪 Side Door: `g.at` is a path DISTANCE — the group walks in
          // partway down the lane instead of at the entrance, so a board packed
          // around the door does nothing about them. spawnEnemy already took a
          // dist (split children, boss summons), so this is one carried field.
          spawnQueue.push({ tick: state.tick + Math.round(at * DATA.TICK_RATE), type: g.type, dist: g.at || 0 });
        }
      }
      spawnQueue.sort((a, b) => a.tick - b.tick || (sortKey(a.type) < sortKey(b.type) ? -1 : 1));
    }
    // Same-tick spawns need a deterministic order, and this tiebreak used to be
    // the raw type id — so an enemy's NAME was load-bearing on the tick stream.
    // Measured: cloning the four backbone types under new ids left every one of
    // 384 runs' phase/lives/gold/kills identical but moved `tick` on 22 of them,
    // purely from the re-sort. An id is a name; the ORDER is the behaviour. A
    // reskin therefore declares its ancestor's key and replays byte-identically.
    // Default-noop: with no `sortKey` an enemy sorts on its own id exactly as
    // before, which is what keeps every shipped level's stream unchanged.
    function sortKey(type) {
      const d = DATA.ENEMIES[type];
      return (d && d.sortKey) || type;
    }

    function startWave() {
      const wasBuild = state.phase !== "wave";
      state.phase = "wave";
      if (wasBuild) thawBoosts();     // a ⏩ RUSH is mid-wave; nothing was frozen
      scheduleWave(state.sentIdx);
      state.sentIdx += 1;
      // ⚙️ Toy Energy. Gold stopped being a cost for the powers: a fully-built
      // board holds 0-145 gold through wave 10 and then 351 → 1115 → 2375 →
      // 3533 → 5393 on L24, i.e. 67 free uses of the cheapest power on the last
      // wave alone. A per-KILL grant cannot fix that — supply scales with wave
      // size, which grows 1.18^n, while cooldown-limited demand grows only with
      // wave duration, so uses/wave rises at every rate. A flat per-WAVE grant
      // is constant by construction, and tightens exactly where the problem is.
      // Granted per wave SENT, so a ⏩ RUSH pays for the wave it sends and not
      // for the one it happens to clear alongside it.
      // 🔋 Spare Battery raises BOTH the per-wave grant and the bank, read once
      const extraCharge = chargeBonus;
      state.charge = Math.min(chargeCap(), (state.charge || 0) + R.chargePerWave + extraCharge);
      // …and the ⚙️ EXCHANGE resets with the grant. Reported from real play:
      // "on normal I end levels with thousands of extra money even when I have
      // max level towers on every spot" — measured, 21 of 36 levels reach a
      // board with literally nothing left to buy, on average 2.2 waves before
      // the level ends, leaving 2,770 gold unspent (up to 8,138 on L31). So
      // gold stops being a resource exactly when the powers become the only
      // decision left. It can now be traded for ⚙️, which re-couples the two
      // currencies without re-opening the defect Phase 3 closed: the number
      // bought is capped PER WAVE, so the per-wave energy budget stays flat by
      // construction and cannot scale with wave size the way a per-kill grant
      // did. It needs no checkpoint field — a checkpoint is a wave boundary,
      // where this is always 0.
      state.chargeBought = 0;
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
        stripped: false, stripUntil: 0, stripAmt: 0, // 🎯 Rust Ray: armour peeled off
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
      // ⚡ Overclock is a burst FOLLOWED BY A CRASH — one expression here, so all
      // five cooldown-set sites (soldier melee, dart, mortar, fan chain, fan zap
      // accumulator) inherit both halves and a future tower line does too.
      let over = 1;
      if (t && t.boostUntil && state.tick < t.boostUntil) over = t.boostMult || 2;
      else if (t && t.crashUntil && state.tick < t.crashUntil) over = t.crashMult || 1;
      const pb = padBoost(t);
      // 🧊 Tail Wind MULTIPLIES in rather than assigning, so a supported tower
      // that is also Overclocked and also on a ⚡ power pad gets all three —
      // three independent factors cannot clobber each other, which assignment
      // provably can (the 📻/🛢️ hurry bug).
      return over * ((pb && pb.rate) || 1) * ((t && t.supRate) || 1);
    }
    // …and the matching REACH wrapper. A range buff has to reach every site a
    // range is read at — dart acquire, dart sticky-KEEP, mortar, fan aura, fan
    // zap — which is the documented "grep every place a target is chosen OR
    // kept" discipline, applied to distance instead of eligibility.
    function reachOf(t, r) {
      const pb = padBoost(t);
      return r * ((pb && pb.range) || 1) * ((t && t.supRange) || 1);
    }
    // 🧊 Tail Wind: the ONE writer of a tower's support multipliers. A write pass
    // (the Junk Healer's shape) feeding the two existing single-read wrappers
    // above, so every range read the fort has — dart acquire, dart sticky-KEEP,
    // mortar, fan aura, fan zap — and every cooldown-set site inherit it with no
    // call-site change. STRONGEST WINS, so two overlapping Tail Winds do not
    // stack, and a fan never supports ITSELF.
    function supportTick() {
      const fans = [];
      for (const t of state.towers) {
        const st = statsOf(DATA.TOWERS[t.lineId], t);
        if (st && st.support) fans.push({ t, s: st });
      }
      // Nothing to do AND nothing to clean up — so a board with no Tail Wind
      // never writes these fields at all and its state stays byte-identical to
      // every historical run. The `hadSupport` latch is what makes SELLING the
      // last one clear the buffs instead of freezing them on.
      if (!fans.length && !state.hadSupport) return;
      state.hadSupport = fans.length > 0;
      for (const t of state.towers) { t.supRate = 1; t.supRange = 1; }
      for (const f of fans) {
        // its OWN radius, sized to the maps (see td-data). `|| auraRange` so a
        // support block one field short degrades instead of NaN-ing every
        // distance. Support does NOT chain: every supRange was reset to 1 just
        // above, so two Tail Winds cannot bootstrap each other's reach.
        const rr = reachOf(f.t, f.s.support.radius || f.s.auraRange);
        for (const t of state.towers) {
          if (t.id === f.t.id) continue; // a support tower never supports itself
          const dx = t.cx - f.t.cx, dy = t.cy - f.t.cy;
          if (dx * dx + dy * dy > rr * rr) continue;
          t.supRate = Math.max(t.supRate, f.s.support.rate || 1);
          t.supRange = Math.max(t.supRange, f.s.support.range || 1);
        }
      }
    }
    // A soldier whose camp has been SOLD is an orphan: it is about to pack up, so
    // the Rally Horn must not count it as somebody to rally (it charged 80 gold
    // and a 30s cooldown to revive nobody).
    function livingCamp(s) { return !!towerById(s.campId); }
    // Jamming a gun had TWO writers (the Loose Screw's sap and a boss's disable
    // phase), so 🧰 Field Repair would have applied to one and not the other —
    // the documented "grep every place" class. One owner now.
    function jamTower(t, seconds) {
      t.disabledUntil = state.tick + Math.round(seconds * mods.jamMul * DATA.TICK_RATE);
    }
    function applySlow(e, pct, seconds) {
      // W5 Grease Racer: greased wheels — slows simply do not stick. Guarded in
      // the ONE slow path, so the Fan's aura, a Blizzard's cone and the Sticky
      // Floor puddle all honour it without their own check. It is the first
      // enemy that hard-counters the Fan, which is otherwise universal.
      if (enemyDef(e).slowImmune) return;
      let p = pct * (enemyDef(e).flier ? R.flierSlowFactor : 1);
      p = Math.min(p, R.slowCap);
      const active = state.tick < e.slowUntil ? e.slowPct : 0;
      // 🧊 Deep Freeze lengthens every slow from the ONE place a slow is applied,
      // so the Fan's aura, a Blizzard cone and the Sticky Floor all inherit it.
      if (p >= active) { e.slowPct = p; e.slowUntil = state.tick + Math.round(seconds * mods.slowSeconds * DATA.TICK_RATE); }
    }
    // 🎯 Rust Ray's armour strip. STRONGEST WINS through ONE owner, exactly as
    // applySlow and applyHurry do — two Rust Rays on the same body must not
    // stack into full penetration, and a weaker/expiring strip must never
    // downgrade a stronger live one (the 📻-into-🛢️ bug, which shipped precisely
    // because a second writer arrived with a different policy).
    function applyStrip(e, amount, seconds) {
      const active = state.tick < e.stripUntil ? (e.stripAmt || 0) : 0;
      if (amount >= active) {
        e.stripAmt = amount;
        e.stripUntil = state.tick + Math.round(seconds * DATA.TICK_RATE);
        // the mechanic was INVISIBLE without this: nothing in the renderer knew
        // a body had been softened, so a 270-gold gun changed nothing you could
        // see — the Fan-fires-with-no-visual defect, third instance. Events are
        // not part of `state`, so this cannot move the determinism hash.
        emit({ type: "strip", x: epos(e).x, y: epos(e).y, id: e.id });
      }
    }
    // The applySlow of hurries: STRONGEST WINS, one owner, so the two sources
    // cannot disagree. `hurriedMult` had a single writer (📻 Boom Box) until the
    // 🛢️ Oil Drum's slick became a second one, and the two shipped with
    // different policies — the puddle took the max, hurryTick assigned
    // unconditionally and runs LAST — so a Boom Box walking into an oil slick
    // DOWNGRADED the enemy from ×1.45 to ×1.35 (measured: 2.308 → 2.151 cells
    // per 60 ticks, a 6.8% loss). Reachable on L34/L36, which carry both, the
    // moment ⏩ RUSH puts two waves on the field. effSpeed being the single
    // READ is not enough when a field has two WRITERS.
    function applyHurry(e, mult, ticks) {
      if (!(mult > 1)) return;
      const until = e.hurriedUntil || 0;
      const cur = until > state.tick ? (e.hurriedMult || 1) : 1;   // expired ⇒ no hurry
      if (mult > cur) e.hurriedMult = mult;
      const till = state.tick + ticks;
      if (till > until) e.hurriedUntil = till;
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
      // `z.mult == null ? 1` because a zone may now carry a DAMAGE band and no
      // speed at all — and a bare `base *= undefined` is NaN, which propagates
      // into `dist` and quietly freezes every enemy on the level. Same class as
      // the `delay`-less wave group that hung a whole wave: a data field one
      // short must degrade, not corrupt.
      if (zones) for (const z of zones) { if (e.dist >= z.from && e.dist <= z.to) { base *= (z.mult == null ? 1 : z.mult); break; } }
      // W6 Boom Box: an ally is blaring a beat nearby, so this one hustles. The
      // FLAG is written by hurryTick (one pass, the Junk Healer's shape) and
      // only READ here — effSpeed is already the single place a speed is
      // decided, so zones, enrage, boss phases and this all compose instead of
      // each growing their own speed computation.
      if (e.hurriedUntil && state.tick < e.hurriedUntil) base *= e.hurriedMult || 1;
      return base * (1 - slow);
    }
    // ⛱️ Blanket Cover — the 4th gimmick shape. `zones[].mult` scales TIME in
    // range; this scales DAMAGE in range. They are the two factors of the same
    // integral, which is why it is the same array, the same disjointness rule
    // and the same renderer machinery as the conveyor and the mud patch.
    //
    // First POSITIONAL match wins, exactly like effSpeed's loop breaks on the
    // first positional match — not "first match that happens to carry a dmg",
    // which would let a level's two overlapping zones disagree about which one
    // applies. (Zones are guardrailed disjoint anyway; matching effSpeed's
    // semantics keeps the two readings of the same array identical.)
    //
    // Shipped one-sided (below 1 only). A dmg > 1 "spotlight" was measured to
    // turn a LOSING dart-mono board into a winning one on two levels, which is
    // the exact property `AUDIT mono builds` exists to protect — the two halves
    // are not symmetric knobs, so only the cover half ships.
    function zoneDmg(e) {
      if (!zones) return 1;
      for (const z of zones) if (e.dist >= z.from && e.dist <= z.to) return z.dmg == null ? 1 : z.dmg;
      return 1;
    }

    // TD-10 Loose Screw: jams the NEAREST shooting tower within reach. Nearest
    // (not random) on purpose — you can SEE which gun is about to go quiet, so
    // it's a readable emergency rather than a dice roll, and it costs no rng
    // draw, which keeps every historical replay stream byte-identical.
    // THE one owner of "which gun does a jammer reach from here" — the Loose
    // Screw's periodic sap and the Sparkler's on-death burst both ask this, so
    // they can never disagree about reach or about what counts as jammable.
    //
    // Measured in CELL-INDEX space, like every other tower↔enemy distance in
    // this engine (targeting, the dart's sticky-keep, the mortar's flight time
    // all read `p.x - t.cx`). This was the ONE site that added +0.5 to the
    // tower and not to the lane point — a 0.707-cell bias on a 3.5 radius, the
    // sixth instance of this engine's two coordinate spaces disagreeing, and
    // the same bug shape as defaultRally's. Nearest, not random: a jam is meant
    // to be a readable emergency, and it costs no rng draw.
    // THE one owner of "jam the nearest gun". Two enemies ask for it — the
    // Loose Screw on a timer and the 🎇 Sparkler where it DIES — and a second
    // copy is exactly how the bug below hid for as long as it did.
    //
    // `aimBias` is added to a tower's cell index before measuring, and it is a
    // parameter rather than a constant because the two callers genuinely
    // disagree. The Sparkler is new content and passes 0 — the raw index space
    // that `candidates()`, the dart's sticky-KEEP and the mortar all use. The
    // Screw passes 0.5 because it has ALWAYS compared a tower's WORLD CENTRE
    // (`cx + 0.5`) against a raw lane INDEX: a real instance of this engine's
    // two-spaces-one-half-cell-apart bug, and the only targeting site that has
    // it. It is PINNED, not fixed, and the reason is measured rather than
    // assumed: the Screw's radius and period were tuned around the bias, and
    // correcting it (8 seeds, all 40 levels) moves real outcomes on 28
    // Screw-bearing levels and breaks two shipped contracts — PLAYABILITY
    // (L16 finishes on 4 lives @seed 7 against its ≥5 floor) and TD7 lever
    // advantage (L31's diversion falls from ≥6 lives to 2, because a sharper
    // Screw makes the thin board lose on BOTH routes, so the fork stops being
    // worth throwing). Straightening it is a two-level re-tune that needs its
    // own 8-seed verification, not a rider on a feature batch. See CLAUDE.md.
    function nearestJammable(x, y, radius, aimBias) {
      const b = aimBias || 0;
      let victim = null, best = radius * radius;
      for (const t of state.towers) {
        if (t.lineId === "camp") continue; // camps are bodies, not electronics
        if (t.disabledUntil && state.tick < t.disabledUntil) continue;
        const d = (t.cx + b - x) ** 2 + (t.cy + b - y) ** 2;
        if (d < best) { best = d; victim = t; }
      }
      return victim;
    }
    function jamNearest(x, y, radius, seconds, aimBias) {
      const victim = nearestJammable(x, y, radius, aimBias);
      if (!victim) return null;
      jamTower(victim, seconds);
      emit({ type: "disable", x: victim.cx, y: victim.cy, seconds });
      return victim;
    }
    const SCREW_AIM_BIAS = 0.5; // ^ pinned legacy aim — see nearestJammable
    function sapTick() {
      for (const e of state.enemies) {
        if (!e.alive) continue;
        const def = enemyDef(e);
        if (!def.sap || isHidden(e)) continue;
        if (e.sapCd === 0) { e.sapCd = state.tick + Math.round(def.sap.every * DATA.TICK_RATE); continue; }
        if (state.tick < e.sapCd) continue;
        e.sapCd = state.tick + Math.round(def.sap.every * DATA.TICK_RATE);
        const p = epos(e);
        jamNearest(p.x, p.y, def.sap.radius, def.sap.seconds, SCREW_AIM_BIAS);
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
          // through the ONE owner: this used to assign unconditionally and runs
          // AFTER puddleTick, so a weaker beat overwrote a stronger oil slick
          if ((p.x - hp2.x) ** 2 + (p.y - hp2.y) ** 2 <= r2) applyHurry(e, def.hurry.mult, 2);
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
              jamTower(victim, ph.disable.seconds);
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
      const burst = Math.round((def.goldBurst || 0) * mods.goldBurstMul); // 🧲 Coin Magnet — ONE local, because this was read twice
      state.gold += bounty + burst; // Piñata candy-burst
      state.kills += 1;
      state.goldEarned += bounty + burst;
      // Splitters (Mud Blob) spawn children at the death spot — BUFFERED so we
      // never mutate state.enemies mid-iteration; flushed after the combat pass.
      if (def.split) for (let i = 0; i < def.split.count; i++) pendingSpawns.push({ type: def.split.into, dist: e.dist, pathIdx: e.pathIdx || 0 });
      const p = epos(e);
      // 🛢️ Oil Drum: it SPILLS where it dies, and whatever crosses the slick
      // hustles. Written HERE, in the one idempotent death path, so it fires
      // whichever line landed the kill — and read nowhere new: a slick is a
      // `state.puddles` entry (the Sticky Floor's own array) carrying `hurry`
      // instead of `slow`, and `effSpeed` already has exactly one place that
      // reads a hurry flag (the Boom Box's). So the whole mechanic is one write
      // and zero new read sites.
      //   It is a DECISION, not a stat: killing drums in front of your best guns
      // speeds the rest of the wave through your own kill zone, so *where* you
      // break them matters. That is the axis the roster was missing — every
      // other recent shape was a resist, and resists measured at zero lives.
      if (def.spill) state.puddles.push({ x: p.x, y: p.y, r: def.spill.r,
        hurry: def.spill.mult, until: state.tick + Math.round(def.spill.seconds * DATA.TICK_RATE) });
      // 🎇 Sparkler: it POPS when it dies and jams the nearest gun. Written in
      // the one idempotent death path, so it fires whichever line landed the
      // kill (the Oil Drum's shape), and routed through the ONE jam owner, so
      // it shares the Screw's reach rule and its camps-are-immune rule with no
      // second read site.
      //   Like the drum it is a DECISION rather than a stat: killing sparklers
      // on top of your best gun silences that gun, so *where* you break them is
      // the question. Unlike the drum it answers a different axis — the drum
      // speeds the wave up, this one takes a tower off the board — and unlike
      // the Screw (which jams on a timer, wherever it happens to be) the player
      // chooses when and where it goes off.
      if (def.jamBurst) jamNearest(p.x, p.y, def.jamBurst.radius, def.jamBurst.seconds);
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
      // P6 🦆 Rubber Duck: the one EMPTY cell of the resist matrix. `armor`
      // blunts bonk, `splashResist` soaks area, `bonkResist` pads single hits,
      // `slowImmune` kills the Fan's slow and a `shield` buffers its zap — but
      // NOTHING attenuated the Fan's damage. Keyed on `how === "zap"`, so it
      // covers BOTH fan paths (the beam and the Static branch's chain jump) from
      // this one site.
      //   The `!preScaled` gate is NOT optional. The beam delivers ONE point of
      // damage per tick and this function rounds, so `Math.round(1 * 0.5) = 0`
      // — an ungated clause means the beam deals literally ZERO damage at every
      // tier, for ever. That is why the multiplier is applied to the beam's
      // ACCUMULATOR instead (the same reason brittle and Boss Bonker are), and
      // why an "it survives much longer" style assertion would pass on the
      // broken build: surviving infinitely longer satisfies it.
      const zr = enemyDef(e).zapResist;
      if (!preScaled && zr && how === "zap") {
        hpDmg = Math.round(hpDmg * (1 - zr));
        shieldDmg = Math.round(shieldDmg * (1 - zr));
      }
      // ⛱️ Blanket Cover: a stretch of lane where everything you shoot lands
      // soft. ONE clause here, so every `how` — dart, splash, the chain's zap,
      // a soldier's swing, an ability — inherits it with no call-site change.
      // The Fan's BEAM is the exception and is handled at its accumulator for
      // the documented reason: it delivers 1-damage packets, so a fraction
      // applied to that rounded point would be erased entirely.
      if (!preScaled) {
        const zd = zoneDmg(e);
        if (zd !== 1) { hpDmg = Math.round(hpDmg * zd); shieldDmg = Math.round(shieldDmg * zd); }
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
      // 🛬 Soft Landing softens a leak, but the FLOOR is what makes it a
      // boss-shaped node rather than Extra Hearts by another name: a 1-life sock
      // still costs exactly 1, while a 6-10 sticker boss — the thing that
      // QUANTIZES a finale — costs 2 less. The clamp alone does that, so there
      // is deliberately no `lives > 1` guard: `max(1, 1 - 2)` is already 1, and
      // a guard that cannot change an outcome is dead code whose test cannot
      // fail (this one was written, and a mutation walked straight through it).
      const toll = Math.max(1, enemyDef(e).lives - mods.softLanding);
      state.lives -= toll;
      // The COST rides the event: a boss eating 8 stickers at once has to read
      // as a catastrophe on the field, not as the same red flash a sock makes.
      emit({ type: "leak", enemy: e.type, lives: toll, boss: !!enemyDef(e).boss });
      // The ONE place a run can be lost. The retired kid mode's `noLose` flag
      // used to spare the fort here; with that mode gone every difficulty is
      // losable and this branch is unconditional.
      if (state.lives <= 0) {
        state.lives = 0;
        state.phase = "lost";
        emit({ type: "lost" });
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
          if (mods.patchKit && n % 5 === 0) state.lives = Math.min(maxLives(), state.lives + 1); // 🩹 Patch Kit
        }
      }
      // Endless never "wins" — it just keeps generating harder waves; the score
      // is waveIdx (waves survived), read off the state when the run finally leaks.
      if (endlessWorld) {
        emit({ type: "endless-wave", n: state.waveIdx });
        state.phase = "build";
        freezeBoosts();
        state.countdown = R.buildCountdown * DATA.TICK_RATE;
      } else if (state.waveIdx >= waves.length) {
        state.phase = "won";
        for (const [need, stars] of R.stars) { if (state.lives >= need) { state.stars = stars; break; } }
        emit({ type: "won", stars: state.stars, lives: state.lives });
      } else {
        state.phase = "build";
        freezeBoosts();
        state.countdown = R.buildCountdown * DATA.TICK_RATE;
      }
    }

    // ⚡ Overclock's CRASH must not be dodgeable. The build countdown is 20s and
    // the crash is 12s, so an unclamped one is skipped entirely by casting on a
    // wave's last straggler — an opt-out downside is just a buff. So a live
    // boost or crash is FROZEN at the wave boundary (remaining ticks banked) and
    // re-anchored when the next wave goes out. Nothing is fired between waves,
    // so freezing costs the player nothing they would have used.
    function freezeBoosts() {
      for (const t of state.towers) {
        if (t.boostUntil > state.tick) { t.boostRemain = t.boostUntil - state.tick; t.boostUntil = 0; }
        if (t.crashUntil > state.tick) { t.crashRemain = t.crashUntil - state.tick; t.crashUntil = 0; }
      }
    }
    function thawBoosts() {
      for (const t of state.towers) {
        if (t.boostRemain) { t.boostUntil = state.tick + t.boostRemain; t.boostRemain = 0; }
        if (t.crashRemain) { t.crashUntil = state.tick + t.crashRemain; t.crashRemain = 0; }
      }
    }

    // ---- Targeting (shared): candidates already filtered; pick by mode. ----
    function pickByMode(cands, mode, t) {
      if (!cands.length) return 0;
      // 📌 Call the Shot overrides every mode while it lasts. ONE clause here
      // covers the dart's acquire, the mortar, the Fan's zap beam AND the Static
      // chain's first link, because this is the single chooser for all four —
      // the other half of the pair is the dart's sticky-KEEP branch below, which
      // is exactly where the shipped "a phased ghost kept its lock" bug lived.
      if (state.tick < state.markUntil && state.markId) {
        for (const e of cands) if (e.id === state.markId) return e.id;
      }
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
      if (!def.phase && !def.tunnel) return false;      // nothing else can hide
      // 🧨's reveal rider. ONE clause at the top of the ONE gate, so it covers
      // every read site at once — acquisition, the dart's sticky KEEP, mortar
      // splash, chain jumps, soldier engage and the puddle — rather than being
      // bolted onto whichever path someone remembered.
      if (revealedAt(e)) return false;
      if (def.phase && e.phaseHidden) return true;
      if (def.tunnel) { const tot = epath(e).total; if (e.dist > tot / 3 && e.dist < (tot * 2) / 3) return true; }
      return false;
    }
    function revealedAt(e) {
      if (!state.reveals.length) return false;
      const p = epos(e);
      for (const z of state.reveals) {
        if (state.tick >= z.until) continue;
        if ((p.x - z.x) ** 2 + (p.y - z.y) ** 2 <= z.r * z.r) return true;
      }
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
    // The lane point nearest (px,py), across EVERY lane — the one owner for
    // "where on the road is this?". Deterministic (fixed sampling, no RNG).
    function pathNearest(px, py) {
      let bestD = Infinity, bestDist = 0, bestPath = path;
      for (const pth of paths) { // TD-7: nearest point across every lane
        for (let d = 0; d <= pth.total; d += 0.2) {
          const p = posAt(pth, d);
          const dd = (p.x - px) ** 2 + (p.y - py) ** 2;
          if (dd < bestD) { bestD = dd; bestDist = d; bestPath = pth; }
        }
      }
      return { pth: bestPath, dist: bestDist };
    }
    // Unit tangent of a lane at an arc-length position.
    function tangentAt(pth, dist) {
      const a = posAt(pth, Math.max(0, dist - 0.35));
      const b = posAt(pth, Math.min(pth.total, dist + 0.35));
      let tx = b.x - a.x, ty = b.y - a.y;
      const m = Math.hypot(tx, ty) || 1;
      return { x: tx / m, y: ty / m };
    }
    function rallySlots(t) {
      const s = statsOf(DATA.TOWERS.camp, t);
      // Soldiers line up ALONG the lane, standing ON the path ribbon as a
      // visible blockade. They are spread by the lane's own ARC LENGTH, not
      // along a straight tangent through the rally point: a tangent leaves the
      // polyline wherever the road turns, and — the shipped defect this fixes —
      // it runs straight off the END of the road. 22 of 501 camp-able pads put
      // a soldier 0.52 cells past the last waypoint; L18/p2 rallies at the exit
      // (23,0) and posted a guy at (23.52,-0.10), i.e. off the board on a
      // 24-wide grid. MEASURED, so as not to overstate it: that soldier is not
      // inert — 0.53 off the lane is still inside the 0.55 engage radius — but
      // it is out of position and one stagger-width from useless, blocking 8
      // bodies where its two siblings block 17 and 18. Walking the arc makes
      // "on the lane" true by construction for every lane shape and every rally
      // point, so no future spacing or lane geometry can tip it past 0.55.
      const near = pathNearest(t.rallyX, t.rallyY);
      // A rally point the player placed OFF the lane keeps its offset, so the
      // rally control means exactly what it did before — only the SPREAD changed.
      const anchor = posAt(near.pth, near.dist);
      const offX = t.rallyX - anchor.x, offY = t.rallyY - anchor.y;
      // Slide the whole squad's window inside the lane rather than clamping each
      // post, so the wall stays evenly spaced instead of stacking men at the end.
      const span = (s.soldiers - 1) * 0.52;
      const centre = span >= near.pth.total
        ? near.pth.total / 2
        : Math.max(span / 2, Math.min(near.pth.total - span / 2, near.dist));
      const out = [];
      for (let i = 0; i < s.soldiers; i++) {
        const d = centre + (i - (s.soldiers - 1) / 2) * 0.52;
        const p = posAt(near.pth, d);
        const tan = tangentAt(near.pth, d);
        // a tiny stagger, kept well inside the ribbon so every guy is still on it
        const perp = (i % 2 === 0 ? -0.1 : 0.1);
        out.push({ x: p.x + offX - tan.y * perp, y: p.y + offY + tan.x * perp });
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
    // The ONE range gate for a rally flag. rally() and defaultRally() must agree
    // about what "in range" means, or the engine can hand a camp an opening
    // posture the player is then refused when they try to restore it.
    function rallyRangeOK(cx, cy, x, y) {
      const rr = DATA.TOWERS.camp.rallyRange;
      return (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr;
    }
    function rallyClamp(cx, cy, x, y) {
      if (rallyRangeOK(cx, cy, x, y)) return { x, y };
      const rr = DATA.TOWERS.camp.rallyRange;
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1;
      const k = (rr - 1e-6) / d; // land strictly inside, so the gate cannot round us out
      return { x: cx + dx * k, y: cy + dy * k };
    }
    function defaultRally(pad) {
      // Nearest point on ANY lane, measured in the engine's own space, then
      // pulled inside rally()'s gate.
      //
      // This carried a documented half-cell bias for a long time — a path point
      // is a CELL INDEX and `pad.cx + 0.5` is a world CENTRE, so only one side
      // of the comparison got the +0.5 (the fifth instance of this engine's two
      // coordinate spaces disagreeing). It was deferred as cosmetic; measured,
      // it was not. On 16 of 501 camp-able pads the biased default landed up to
      // 3.04 cells from the pad against a rallyRange of 2.5, i.e. rally() would
      // REFUSE it — so those camps opened on a flag position the player could
      // never choose or put back. Removing the bias alone leaves 9, because
      // those pads are genuinely >2.5 cells from every lane and no lane point
      // is reachable from them at all; the clamp is what makes the default
      // always a state rally() accepts, posting the squad as far up the road as
      // the flag can actually go. The old objection about soldier posts is gone
      // with it: posts now walk the lane's arc, so they are on the lane
      // whichever point is chosen.
      let best = null, bestD = Infinity;
      for (const pth of paths) { // TD-7: rally to the nearest point on ANY lane
        for (let d = 0; d <= pth.total; d += 0.25) {
          const p = posAt(pth, d);
          const dd = (p.x - pad.cx) ** 2 + (p.y - pad.cy) ** 2;
          if (dd < bestD) { bestD = dd; best = p; }
        }
      }
      return rallyClamp(pad.cx, pad.cy, best ? best.x : pad.cx, best ? best.y : pad.cy);
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
            const hit = computeHit(cs.dmg * mods.soldierDmg, "bonk", foe); // 🥁 Drill Sergeant
            dealDamage(foe, hit.hpDmg, 0, "melee");
            if (!foe.alive) { sol.engagedId = 0; continue; }
          }
          // foe swings back (unless stunned)
          const fd = enemyDef(foe);
          if (state.tick >= foe.stunnedUntil) {
            if (foe.meleeCd > 0) foe.meleeCd -= 1;
            if (foe.meleeCd <= 0 && fd.meleeDmg > 0) {
              foe.meleeCd = Math.round(fd.meleeRate * DATA.TICK_RATE);
              sol.hp -= Math.round(fd.meleeDmg * (1 - Math.min(0.9, (cs.armor || 0) + mods.soldierArmor))); // 🧱 Padding
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
          const step = Math.min(d, R.soldierWalkSpeed * mods.marchMul * DT);
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
          // 📌 the sticky half. Without this a `first`-mode dart holds its old
          // lock through the whole mark and the power reads as broken on the
          // MOST-BUILT line — the documented "grep every place a target is
          // chosen OR kept" pair, and the reason the ghost fix needed two edits.
          if (keep && state.tick < state.markUntil && state.markId && t.targetId !== state.markId) keep = false;
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
            if (critChance > 0 && rng() < critChance) { dmg = Math.round(dmg * (s.critMult || 1.5) * mods.critMul); crit = true; }
            state.projectiles.push({
              id: nextId++, x: t.cx, y: t.cy, targetId: t.targetId,
              dmg, dmgType: s.dmgType, speed: def.projectileSpeed, crit,
              strip: s.strip || null, // 🎯 the debuff rides the dart, applied where it LANDS
            });
            emit({ type: "shoot", x: t.cx, y: t.cy, tower: t.lineId });
          }
        } else if (def.kind === "mortar") {
          // 🎯 Close Quarters shrinks the tube's dead zone. This is the only
          // candidates() call in the engine that passes a non-zero minimum, so
          // the node has exactly one read site.
          //   `|| 0` is load-bearing: a stat block WITHOUT a rangeMin would make
          // `undefined * 0.6` NaN, and `d2 >= NaN` is false for every enemy — the
          // mortar would silently never fire again. Both shipped tier-4 branches
          // happen to declare one, so today this is luck rather than design; the
          // coercion plus the guardrail in td-logic.test.js make it design. Same
          // class as the `mult`-less zone and the `delay`-less wave group: a
          // field one short must degrade, not disable.
          const cands = candidates(t, (s.rangeMin || 0) * mods.mortarMinMul, reachOf(t, s.range * rangeMul), false);
          const targetId = pickByMode(cands, t.targeting, t);
          // Record it on the SAME field the dart and the fan use. The mortar
          // kept its choice in a local, so "what is this tower engaging" was
          // knowable for two lines out of three — invisible to the renderer and
          // untestable without inferring it from where a shell landed. Never
          // read by combat (the mortar re-picks every tick), so behaviour is
          // unchanged; it is the one seam a future aiming cue reads.
          t.targetId = targetId || 0;
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
                while (cur2 && hitIds.length < s.chain.targets + mods.chainPlus) {
                  hitIds.push(cur2.id);
                  const p = epos(cur2);
                  points.push({ x: p.x, y: p.y });
                  const hit = computeHit(Math.round(dmg), "zap", cur2);
                  dealDamage(cur2, hit.hpDmg, hit.shieldDmg, "zap");
                  dmg *= Math.min(0.95, s.chain.decay + mods.chainDecayPlus); // 🔗 Live Wire, capped so a chain always weakens
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
            // The Fan's beam target used to be computed and THROWN AWAY, so the
            // renderer had nothing to draw and Fan tiers 1-3 plus the Blizzard
            // branch — three of the four variants — fired with literally no
            // visual: you paid 300 gold and the field looked identical. It is
            // recorded on the SAME `t.targetId` the Dart already uses ("what
            // this tower is engaging") rather than a second parallel field, so
            // the renderer needs one rule for both lines. Deterministic: a pure
            // function of state, recomputed every tick, never read by combat.
            t.targetId = beamId || 0;
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
              // 🦆 zapResist rides the ACCUMULATOR for the documented reason:
              // applying a fraction to the single rounded point of damage the
              // beam delivers would floor it to zero and silently disable the
              // Fan entirely. dealDamage is told `preScaled`, so it does not
              // re-apply it.
              const zapResist = 1 - (enemyDef(beamTarget).zapResist || 0);
              // ⛱️ the beam's half of the cover band, for the same rounding
              // reason: applied at dealDamage it would be Math.round(1 * 0.75)
              // = 1 and the Fan would silently ignore the zone entirely.
              t.zapAcc = (t.zapAcc || 0) + s.zapDps * DT * boostOf(t) * zapBoss * zapBrittle * zapResist * zoneDmg(beamTarget);
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
          // STICKY BOMB LEAVES GOO — it says so on its own tooltip ("the goo it
          // LEAVES slows whatever WALKS IN") and it did not. The only thing it
          // did was slow the bodies caught in the blast at the instant of
          // detonation, so nothing lingered, nothing could walk in, and there
          // was nothing on the ground to draw: the branch's whole identity was a
          // sentence. Reported from real play as "shouldn't it leave goo on the
          // path that's visible?" — the documented "a named mechanic must BE
          // that mechanic" class (四宫数独 was a Latin square).
          //
          // It routes through `state.puddles`, the ONE lingering-ground-effect
          // path the 🍯 Sticky Floor ability and the 🛢️ Oil Drum's spill already
          // share, so it inherits `puddleTick`'s slow application, its
          // `isHidden` gate, its expiry, its checkpoint behaviour and — free —
          // the renderer that already draws a puddle. No new mechanism, and the
          // picture comes with it.
          if (sh.goo) {
            state.puddles.push({
              x: sh.tx, y: sh.ty, r: sh.splash,
              slow: sh.goo.slow,
              until: state.tick + Math.round(sh.goo.seconds * DATA.TICK_RATE),
            });
          }
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
        // …and the same trap for the Tail Wind: this branch returns early, so
        // without this a support fan bought BETWEEN waves would leave its
        // neighbours' stats stale until the wave started — and the tower panel
        // READS those stats, so the player would be shown a lie about the tower
        // they just paid 300 gold to help. Combat is unaffected either way
        // (nothing fires during build); truthfulness is the point.
        supportTick();
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
        e.stripped = state.tick < e.stripUntil; // 🎯 resolved here so effArmor stays pure
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
      supportTick(); // 🧊 Tail Wind buffs neighbours — must land BEFORE they fire
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
          // `id` so the struck BODY can react, not just the air around it. A
          // render cue belongs on the EVENT, computed once at the damage site —
          // the same shape `dmg` and `tower` already took. Events are not part
          // of `state`, so this cannot move the determinism hash.
          emit({ type: "hit", x: tp.x, y: tp.y, crit: pr.crit || false, dmg: hit.hpDmg + hit.shieldDmg, id: target.id }); // dmg for the opt-in damage-number fx
          // 🎯 the strip lands where the dart LANDS, and BEFORE the damage, so
          // this very shot already benefits from the armour it just peeled.
          if (pr.strip) applyStrip(target, pr.strip.amount, pr.strip.seconds);
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
      leverTick(); // TD-17: the timed track diversion expires on its own
      spawnerTick();
      // flush split-children (Mud Blob) now that the combat pass is done
      while (pendingSpawns.length) { const s = pendingSpawns.shift(); spawnEnemy(s.type, s.dist, s.pathIdx); }
      state.enemies = state.enemies.filter((e) => e.alive || state.phase !== "wave");

      finishIfWaveDone();
    }

    // ---- Player commands ----
    // How much of the lane a pad can SHOOT, for a prospective build or a built
    // tower — the number that makes placement visible (see laneCoverage).
    //
    // ASK THE ENGINE, never re-derive. Every modifier to reach lives in here:
    // night dimming, 🦉 Night Owl halving it, ⚡ a power pad extending it, and
    // 🎯 Close Quarters shrinking the Mortar's dead zone. The UI computing this
    // from DATA would drift exactly as the tower panel's prices did when they
    // showed 110 while the engine charged 99.
    //
    // Reach is DERIVED from whichever field the line actually has, so a fifth
    // line inherits this without a code hunt: `range` for a gun, `auraRange`
    // for the Fan (night-exempt by design — only dart and mortar dim). A Camp
    // returns null: its soldiers BLOCK rather than shoot, so a coverage % would
    // assert something false about it.
    function statOf(lineId, tier, branchKey) {
      const def = DATA.TOWERS[lineId];
      if (!def) return null;
      // A tier-4 branch is its OWN stat block, and its reach can move in either
      // direction: Sniper Scope takes the dart 3 → 5.5 while Minigun DROPS it to
      // 2.2. Clamping tier 4 down to tier 3's stats would have quietly asserted
      // that a branch never changes what it covers, which is false for 3 of the
      // 10 shipped branches — and the shrink is the one a player most needs told.
      return (tier === 4 && branchKey && def.branches && def.branches[branchKey])
        ? def.branches[branchKey]
        : def.tiers[Math.max(0, Math.min(2, (tier || 1) - 1))];
    }
    // THE reach of a stat block, in cells: `{ reach, dead }`, or null for a line
    // that does not shoot. `sup` is a built tower's support multiplier (🧊 Tail
    // Wind) — absent for a prospective build, because nothing is standing there
    // yet to be buffed.
    //
    // The LARGEST radius at which this tower affects the lane at all, taken over
    // every reach field the stat block has. The Fan carries TWO — a 1.8-cell
    // slow aura and a 2.2-cell zap — and reading only the aura understated it
    // badly enough to be a lie: it reported a tier-1 fan covering 0% of the lane
    // on 312 of 451 pads, when the zap reaches from most of them. Derived rather
    // than listed, so a future stat cannot be silently missed the same way.
    function reachInfo(st, cx, cy, sup) {
      if (!st) return null;
      const pad = (levelDef.pads || []).find((q) => q.cx === cx && q.cy === cy);
      const boost = pad && pad.boost && pad.boost.range ? pad.boost.range : 1;
      let reach = 0, dead = 0;
      if (st.range != null) {                       // a gun: night dims it
        reach = Math.max(reach, st.range * rangeMul);
        dead = (st.rangeMin || 0) * mods.mortarMinMul;
      }
      // the Fan is night-EXEMPT by design — only dart and mortar dim. `fanAura`
      // is ❄️ Cold Front, applied at the aura's own read site in the tick.
      if (st.auraRange != null) reach = Math.max(reach, st.auraRange + mods.fanAura);
      if (st.zapRange != null) reach = Math.max(reach, st.zapRange);
      if (!reach) return null;                      // a Camp blocks, it does not shoot
      // Only the OUTER radius takes the pad boost and the support multiplier —
      // the engine's own mortar call passes `rangeMin * mortarMinMul` raw and
      // wraps only the max in `reachOf()`. Scaling the dead zone here too would
      // be this surface disagreeing with the engine about the one thing it
      // exists to report, and it would grow the hole under a mortar standing on
      // a ⚡ power pad — a spot where the engine says it can still fire.
      return { reach: reach * boost * (sup || 1), dead: dead };
    }
    function coverageOf(lineId, tier, cx, cy, branchKey) {
      const r = reachInfo(statOf(lineId, tier, branchKey), cx, cy);
      return r ? laneCoverage(levelDef, cx, cy, r.reach, r.dead) : null;
    }
    // What the RENDERER must draw as a tower's range ring. It had been doing its
    // own arithmetic and understated the truth four ways: the Fan's ring used
    // `auraRange` while its zap reaches further (22% / 14% / 8% short at tiers
    // 1-3), ❄️ Cold Front was ignored, a ⚡ power pad's +18% never showed on the
    // six levels that have one, and 🧊 Tail Wind — a 300-gold branch whose whole
    // pitch is that neighbours "fire faster and FURTHER" — bought a buff the
    // player could not see. Same lesson as the prices: ask the engine.
    function towerReach(towerId) {
      const t = state.towers.find((x) => x.id === towerId);
      if (!t) return null;
      const r = reachInfo(statOf(t.lineId, t.tier, t.branch), t.cx, t.cy, t.supRange);
      return r ? r.reach : null;
    }
    // The stat block a built tower ACTUALLY fights with — its tier/branch stats
    // with this run's meta and this level applied. The tower panel prints these.
    //
    // It used to print raw DATA, and was wrong on six axes. The worst needs no
    // meta at all: on a night level the panel said "3 rng" while the engine used
    // 2.55 and the range RING beside it drew 2.55, and on a ⚡ power pad it said
    // 3 against a real 3.54 — hiding the whole benefit of the socket, which is
    // the one thing the % road figure was shipped to make visible. With nodes
    // owned it also understated dart dps (34 vs 41 on Sharp Darts II), mortar
    // splash (1.6 vs 1.92), fan aura (2.4 vs 2.70), soldier hp (120 vs 156) and
    // showed no crit at all on a 🍀 Lucky Darts run.
    //
    // Range comes from towerReach, already the ONE owner. The rest apply exactly
    // the mods the combat sites apply and nothing else — keyed on `kind`, like
    // the combat branches themselves, so a fifth line of a known kind inherits
    // them. This is a SECOND multiplication of the same `mods`, so it is pinned
    // BEHAVIOURALLY (the panel's dps must equal the damage a shot really deals)
    // rather than structurally; a drift shows up as a failing number, not as a
    // reviewer noticing.
    // `tierAt`/`branchAt` ask the same question about a DIFFERENT tier of the
    // same tower — what the panel needs to show what an upgrade actually buys,
    // which until now was a price and nothing else. Deliberately a parameter
    // rather than a second function: this is the only place the star-tree mods
    // are applied to a printable stat block, and two copies of that is exactly
    // how the panel came to print 110 while the engine charged 99. The tower's
    // OWN cx/cy/supRange are used, so the preview keeps its power pad and its
    // 🧊 Tail Wind support — an upgraded tower does not lose them.
    function towerStats(towerId, tierAt, branchAt) {
      const t = state.towers.find((x) => x.id === towerId);
      if (!t) return null;
      const def = DATA.TOWERS[t.lineId];
      const tier = tierAt || t.tier;
      const branch = branchAt === undefined ? t.branch : branchAt;
      const out = Object.assign({}, statOf(t.lineId, tier, branch));
      const r = reachInfo(statOf(t.lineId, tier, branch), t.cx, t.cy, t.supRange);
      const reach = r ? r.reach : null;
      if (reach != null) out.range = reach;
      // Every multiplied field is coerced: a stat block one field short must
      // DEGRADE, not disable. `undefined * 1.2` is NaN and this line is printed
      // to the player, so the failure would be a panel reading "NaN dps" — the
      // same class as the `mult`-less zone that froze every enemy and the
      // `delay`-less wave group that hung a level. Shipped data carries all of
      // them (a derived guardrail asserts that, so an author hears about it at
      // authoring time rather than the player hearing about it on the panel).
      const n = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
      if (def.kind === "dart") {
        out.dmg = n(out.dmg, 0) * mods.dartDmg;
        out.crit = n(out.crit, 0) + mods.critBonus;
      } else if (def.kind === "mortar") {
        out.splash = n(out.splash, 0) * mods.mortarSplash;
      } else if (def.kind === "fan") {
        out.auraRange = n(out.auraRange, 0) + mods.fanAura;
      } else if (def.kind === "camp") {
        out.hp = Math.round(n(out.hp, 0) * mods.soldierHp);
      }
      return out;
    }
    // …and for a pad you have not built on yet, where no support applies.
    function reachAt(lineId, tier, cx, cy, branchKey) {
      const r = reachInfo(statOf(lineId, tier, branchKey), cx, cy, 1);
      return r ? r.reach : null;
    }

    // What selling this tower ACTUALLY pays — the one owner, for exactly the
    // reason priceOf below is one. ♻️ Trade-In lifts the refund 80% → 90%, and
    // the tower panel used to label its button `Math.floor(t.spent *
    // DATA.RULES.sellRefund)` — the raw rule — so a run owning the node was
    // shown 272 on a tier-3 dart and handed 306. Same defect as the price flash,
    // on the money moving the other way, which is why it went unreported:
    // nobody complains about being given MORE than the label promised.
    let lastBuild = null;   // { id, cost, tick } — see undoLast()
    function maxLives() { return R.lives + mods.lives; }
    function refundOf(towerId) {
      const t = towerById(towerId);
      if (!t) return 0;
      return Math.floor(t.spent * mods.sellRefund);
    }
    // THE one place a price is computed. `place`/`upgrade`/`branch` all read it,
    // and the UI asks the ENGINE for it rather than re-deriving it from DATA —
    // the same lesson already recorded for targeting modes ("ask the engine
    // which modes this run allows"), applied to money.
    //   It had really drifted: the panel printed `def.tiers[tier].cost` while
    // upgrade() charged that × `mods.upgradeCost` (🔧 Handyman, 0.9), and the
    // branch buttons ignored `mods.branchCost` (💰 Bulk Deal) the same way. So a
    // run owning either node showed a price it was not charged AND greyed the
    // button out at golds it could actually afford. Building happens to be
    // undiscounted today, which is exactly why it must route through here too —
    // otherwise the next economy node reintroduces the bug on a third path.
    // Returns Infinity for anything unpurchasable, so `gold >= price` is false.
    function priceOf(kind, a) {
      if (kind === "build") {
        const def = DATA.TOWERS[a];
        return def ? def.tiers[0].cost : Infinity;
      }
      if (kind === "upgrade") {
        const t = towerById(a);
        if (!t || t.tier >= 3) return Infinity;
        return Math.round(DATA.TOWERS[t.lineId].tiers[t.tier].cost * mods.upgradeCost);
      }
      if (kind === "branch") {
        const t = a && towerById(a.towerId);
        if (!t) return Infinity;
        const def = DATA.TOWERS[t.lineId];
        const b = def.branches && def.branches[a.choice];
        return b ? Math.round(b.cost * mods.branchCost) : Infinity;
      }
      return Infinity;
    }
    function place(lineId, padId) {
      const def = DATA.TOWERS[lineId];
      const pad = padById(padId);
      if (!def || !pad) return { ok: false, reason: "bad-id" };
      // TD-18: a chip-banned line is refused before anything else about the
      // pad is considered — the ban is a property of the RUN, not the spot.
      if (chipLineBans.has(lineId)) return { ok: false, reason: "chip" };
      if (towerAt(padId)) return { ok: false, reason: "occupied" };
      if (state.phase === "won" || state.phase === "lost") return { ok: false, reason: "over" };
      const cost = priceOf("build", lineId);
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
      // Deliberately a CLOSURE var and not a field on `state`: undo is a UI
      // affordance, not engine truth. Keeping it out of state means hashState is
      // untouched (the determinism suite is this engine's whole test strategy)
      // and a mid-run checkpoint cannot restore a stale undo — a resumed run
      // correctly offers none, exactly like `leverCd`.
      lastBuild = { id: t.id, cost: cost, tick: state.tick };
      if (lineId === "camp") spawnSoldiers(t);
      emit({ type: "build", x: pad.cx, y: pad.cy });
      return { ok: true };
    }
    function upgrade(towerId) {
      // an upgrade or a branch is a COMMITMENT: no undo after it
      if (lastBuild && lastBuild.id === towerId) lastBuild = null;
      const t = towerById(towerId);
      if (!t) return { ok: false, reason: "bad-id" };
      const def = DATA.TOWERS[t.lineId];
      if (t.tier >= 3) return { ok: false, reason: t.tier === 3 ? "branch-required" : "max" };
      // 🔧 Handyman: tiers 1-3 only. Bulk Deal already owns tier-4 branch
      // prices, and two nodes discounting the same purchase would stack into
      // a cheaper board than either was priced for.
      const cost = priceOf("upgrade", t.id);
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
      // an upgrade or a branch is a COMMITMENT: no undo after it
      if (lastBuild && lastBuild.id === towerId) lastBuild = null;
      const t = towerById(towerId);
      if (!t) return { ok: false, reason: "bad-id" };
      if (t.tier !== 3 || t.branch) return { ok: false, reason: "not-tier3" };
      const def = DATA.TOWERS[t.lineId];
      const b = def.branches && def.branches[choice];
      if (!b) return { ok: false, reason: "bad-branch" };
      const bCost = priceOf("branch", { towerId: t.id, choice }); // TD-5 Bulk Deal, via the one price owner
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
    // ONE teardown, so an undo can never forget the half a sell remembers — the
    // blocked-enemy release in particular, which is the only thing in the engine
    // that can strand a live enemy pointing at a soldier that no longer exists.
    function removeTower(i, refund, how) {
      const t = state.towers[i];
      state.gold += refund;
      for (const sol of state.soldiers) {
        if (sol.campId === t.id) {
          if (sol.alive && sol.engagedId) { const foe = enemyById(sol.engagedId); if (foe) foe.blockedBy = 0; }
          sol.alive = false; sol.respawnAt = 0; sol.campId = -1;
        }
      }
      emit({ type: how, x: t.cx, y: t.cy, refund });
      state.towers.splice(i, 1);
      if (lastBuild && lastBuild.id === t.id) lastBuild = null;
      return refund;
    }
    function sell(towerId) {
      const i = state.towers.findIndex((t) => t.id === towerId);
      if (i < 0) return { ok: false, reason: "bad-id" };
      return { ok: true, refund: removeTower(i, refundOf(towerId), "sell") };
    }
    // ---- ↩ Undo the last placement (TD-19) ----
    // The most expensive mistake in this game is a tower on the wrong pad, and
    // sell only pays back 80% (90% with ♻️ Trade-In) — so the fix for a mis-tap
    // costs a fifth of the tower. Undo pays ALL of it, and is deliberately
    // narrow: the tower you JUST placed, before you have upgraded it, inside a
    // few seconds. Outside that it is an ordinary sell at the ordinary rate, so
    // this can never become a way to rent towers for free.
    function undoInfo() {
      if (!lastBuild) return null;
      // BUILD PHASE ONLY, and cleared when a wave is called — which together
      // mean the tower has provably never acted. A time window was the first
      // cut and it is the wrong rule: 8 seconds of a tower SHOOTING is real
      // value, so a wave-phase undo at full price is renting a gun for free.
      // Tied to the phase instead, the offer is generous (the whole build, not
      // a countdown) and the exploit does not exist rather than being small.
      if (state.phase !== "build") return null;
      const t = towerById(lastBuild.id);
      if (!t) return null;
      return { id: t.id, refund: t.spent };
    }
    function undoLast() {
      const info = undoInfo();
      if (!info) return { ok: false, reason: "nothing" };
      const i = state.towers.findIndex((t) => t.id === info.id);
      return { ok: true, refund: removeTower(i, info.refund, "sell") };
    }
    // The ONE list of targeting modes, and the ONE place that says which are
    // legal in THIS run. The UI used to keep its own copy and decide "cheap"
    // from save.meta — but `mods` is computed once at createEngine from
    // opts.meta, so a resumed run (or a respec mid-session) could leave the
    // button offering a mode the engine then refuses, while the label changed
    // anyway. That is the documented "a control must reflect the engine" class,
    // and it becomes a live bug the moment per-run loadouts land.
    const TARGET_MODES = ["first", "last", "strong", "close", "cheap"];
    function targetingModes() {
      return TARGET_MODES.filter((m) => m !== "cheap" || mods.cheapTarget);
    }
    function setTargeting(towerId, mode) {
      const t = towerById(towerId);
      if (!t) return { ok: false, reason: "bad-id" };
      if (TARGET_MODES.indexOf(mode) < 0) return { ok: false, reason: "bad-mode" };
      if (mode === "cheap" && !mods.cheapTarget) return { ok: false, reason: "locked" }; // needs the star-tree node
      t.targeting = mode; t.targetId = 0;
      return { ok: true };
    }
    function rally(towerId, x, y) {
      const t = towerById(towerId);
      if (!t || t.lineId !== "camp") return { ok: false, reason: "bad-id" };
      // the SAME gate defaultRally clamps to, so the opening posture is always a
      // position the player is allowed to choose again
      if (!rallyRangeOK(t.cx, t.cy, x, y)) return { ok: false, reason: "range" };
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
      // Sending a wave COMMITS the board. Without this, the next build phase
      // would still be holding a reference to a tower that has just fought a
      // whole wave, and offer it back at full price.
      lastBuild = null;
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
    // ONE owner for changing which lane traffic takes, so the manual throw and
    // the automatic snap-back can never drift (the wake-lock lesson). Rerouting
    // pre-fork enemies is seamless BOTH ways: the lanes share identical geometry
    // up to the fork, so an enemy's world position is unchanged either direction
    // — it just diverges (or stops diverging) when it reaches the split.
    function setRoute(r) {
      state.leverRoute = r;
      const forkAt = levelDef.fork ? levelDef.fork.at : 0;
      for (const e of state.enemies) if (e.alive && e.dist < forkAt) e.pathIdx = r;
      emit({ type: "lever", route: r });
    }
    // TD-17: throw the track-switch lever. It is a TIMED DIVERSION — see
    // RULES.leverHold. While the diversion is running the lever is INERT rather
    // than a toggle: the long route is strictly better for the player, so an
    // "end it early" button is a trap, never a play.
    function pullLever() {
      if (!levelDef.lever) return { ok: false, reason: "no-lever" };
      // WAVE-ONLY, like every other timed effect (TD-9 abilities refuse with
      // not-in-wave for the same reason): there is nothing to divert during
      // build, so a pull there would burn the whole diversion and its cooldown
      // on an empty lane. A refusal, never a silent waste.
      if (state.phase !== "wave") return { ok: false, reason: "not-in-wave" };
      if (state.leverRoute) return { ok: false, reason: "running" };  // already diverted
      if (state.tick < state.leverCd) return { ok: false, reason: "cooldown" };
      state.leverUntil = state.tick + Math.round((R.leverHold || 10) * DATA.TICK_RATE);
      setRoute(1);
      return { ok: true, route: 1, until: state.leverUntil };
    }
    // Called every tick: the diversion expires on its own and the cooldown only
    // starts THEN, so the cycle a player sees is hold → snap back → wait → ready.
    // Tick-based, therefore game-time: at 3× speed the timer drains 3× faster in
    // wall-clock and the enemies march 3× further, which is the same diversion.
    function leverTick() {
      if (!levelDef.lever || !state.leverRoute) return;
      if (state.tick < state.leverUntil) return;
      setRoute(0);
      state.leverCd = state.tick + Math.round((R.leverCooldown || 14) * DATA.TICK_RATE);
    }

    // ---- TD-9 active abilities: the in-WAVE decision layer ----
    // Each costs gold AND sits on a tick-stamped cooldown, so an ability is a
    // real trade against a tower rather than free power. Zero rng: a headless
    // sim can drive every one of them and a replay stays byte-identical.
    const abilityDef = (id) => (DATA.ABILITIES || []).find((a) => a.id === id) || null;
    // ⚙️ THE EXCHANGE. Price is one computation so the button, the refusal and
    // the charge can never disagree — the `priceOf` lesson, applied to the
    // second currency. Doubling within a wave means a surplus is absorbable at
    // any size without the first one being expensive.
    function chargePrice() {
      const R = DATA.RULES;
      return Math.round((R.chargeBuyBase || 450) * Math.pow(2, state.chargeBought || 0));
    }
    // THE ⚙️ bank ceiling, and the ONE place `mods.charge` is read — 🔋 Spare
    // Battery raises the bank as well as the grant, and a shipped guardrail
    // requires exactly one read site precisely so a buff cannot apply to the
    // per-wave grant and not to the exchange (it caught this when the exchange
    // first computed its own cap).
    // Read ONCE. `mods` is fixed for a run, so a const is the honest shape and
    // it keeps the "exactly one read site" law satisfiable while the grant and
    // the exchange both need the number.
    const chargeBonus = mods.charge;
    function chargeCap() { return DATA.RULES.chargeMax + chargeBonus; }
    // Refusals are named, never silent, and nothing is charged for a purchase
    // that would do nothing — the documented "a power that changes nothing must
    // never charge you" law, which is what made three powers read as broken.
    function buyChargeReady() {
      const R = DATA.RULES;
      if (state.phase !== "wave") return { ok: false, reason: "not-in-wave" };
      if ((state.chargeBought || 0) >= (R.chargeBuyMax || 0)) return { ok: false, reason: "wave-limit" };
      if ((state.charge || 0) >= chargeCap()) return { ok: false, reason: "full" };
      if (state.gold < chargePrice()) return { ok: false, reason: "gold" };
      return { ok: true };
    }
    function buyCharge() {
      const r = buyChargeReady();
      if (!r.ok) return r;
      state.gold -= chargePrice();
      state.charge = (state.charge || 0) + 1;
      state.chargeBought = (state.chargeBought || 0) + 1;
      emit({ type: "buycharge", charge: state.charge, gold: state.gold });
      return { ok: true };
    }
    function abilityReady(id) {
      const def = abilityDef(id);
      if (!def) return { ok: false, reason: "bad-ability" };
      // TD-18 🔇 Quiet Hands: the whole strip is off for this run. Checked
      // before everything — a chip is a run-level vow, not a resource state.
      if (chipNoPowers) return { ok: false, reason: "chip" };
      // P6: you brought RULES.abilitySlots of the pool. Checked FIRST — an
      // un-equipped power is not a resource state, so "you didn't bring it"
      // must never be masked by "you're out of energy".
      if (state.powers.indexOf(id) < 0) return { ok: false, reason: "not-equipped" };
      // These are IN-WAVE abilities. Outside a wave there is nothing to hit and
      // a puddle would expire before the first enemy arrived, so spending gold
      // then is pure loss — refuse it rather than quietly take the money.
      if (state.phase !== "wave") return { ok: false, reason: "not-in-wave" };
      if (state.tick < (state.abilityCd[id] || 0)) return { ok: false, reason: "cooldown" };
      // ⚙️ Toy Energy is the scarce resource late; gold is the scarce one early.
      // Checked BEFORE gold so a broke early board still reads "you can't afford
      // it" rather than the newer, less obvious reason.
      const need = def.charges === undefined ? 1 : def.charges;
      if (state.gold < def.gold) return { ok: false, reason: "gold" };
      if ((state.charge || 0) < need) return { ok: false, reason: "charge" };
      return { ok: true, def, need };
    }
    // Would this use actually DO anything? An ability that changes nothing must
    // never charge gold or start a cooldown — that reads exactly like a broken
    // button (reported: "some of them don't even seem to work at all").
    // 💣 Wider Blast, read ONCE per ability so the blast, the reveal, the puddle
    // and the ring the player sees are all the same circle.
    // The ONE place mods.abilityRadius is read. It takes a RAW radius, not a def,
    // because 🧨 also carries a `reveal.radius` — the first cut scaled that
    // inline and quietly gave the node a second read site.
    function scaleRadius(r) { return (r || 0) * mods.abilityRadius; }
    function abilityRadius(def) { return scaleRadius(def.radius); }
    // 📌 the NEAREST non-hidden enemy to the tap, inside the ring. One owner, so
    // `abilityWouldDo` and `useAbility` can never disagree about what was
    // marked (the "a power that changes nothing must never charge you" law needs
    // the check and the act to be the same computation). Untargetable enemies are
    // excluded through the ONE isHidden gate — you cannot focus-fire a phased
    // ghost, and nothing may charge you for trying.
    function markTargetAt(o) {
      const def = abilityDef("mark");
      const r2 = scaleRadius(def ? def.radius : 0) ** 2;
      let best = null, bd = Infinity;
      for (const e of state.enemies) {
        if (!e.alive || isHidden(e)) continue;
        const p = epos(e);
        const d2 = (p.x - o.x) ** 2 + (p.y - o.y) ** 2;
        if (d2 <= r2 && d2 < bd) { bd = d2; best = e; }
      }
      return best;
    }
    function abilityWouldDo(def, o) {
      // The horn revives the downed AND heals the hurt, so it is useful whenever
      // any soldier is less than fully fit — not only when one is flat on its
      // back. (Reported: it refused while a camp was on the board.)
      if (def.kind === "instant") return state.soldiers.some((s) => livingCamp(s) && (!s.alive || s.hp < s.maxHp));
      if (def.kind === "tower") return !!towerById(o.towerId);
      // 📌 needs BOTH halves to be real: something to point at, and a gun that
      // can be pointed. A camp does not aim, so a camp-only board would pay 70
      // gold and two ⚙️ for nothing — the "a power that changes nothing must
      // never charge you" law, which is what made three powers read as broken.
      if (def.mark) {
        if (!state.towers.some((t) => t.lineId !== "camp")) return false;
        return !!markTargetAt(o);
      }
      if (def.dmg) {                                                             // something in the blast
        // A REVEALING blast counts hidden enemies as targets — it is what
        // un-hides them. Without this, tapping 🧨 into a crater full of phased
        // ghosts (L12's boss wave ships eight) refused with "nothing in the
        // blast", so the ability read as broken exactly where it is needed.
        const r2 = abilityRadius(def) ** 2;
        return state.enemies.some((e) => {
          if (!e.alive || (!def.reveal && isHidden(e))) return false;
          const p = epos(e);
          return (p.x - o.x) ** 2 + (p.y - o.y) ** 2 <= r2;
        });
      }
      return true; // a zone is placed AHEAD of enemies on purpose — always valid
    }
    function useAbility(id, opts) {
      // A malformed call is a CALLER bug, not a resource state, so it is
      // reported before gold / energy / cooldown — otherwise "you're out of
      // energy" masks "you forgot to pass a point".
      const early = abilityDef(id), o = opts || {};
      if (early && early.kind === "point" && (typeof o.x !== "number" || typeof o.y !== "number")) return { ok: false, reason: "needs-point" };
      const chk = abilityReady(id);
      if (!chk.ok) return chk;
      const def = chk.def;
      if (!abilityWouldDo(def, o)) {
        // Distinguish "you have no camp" from "your squad is already fine" —
        // telling someone to build a camp they already own is worse than silence.
        const why = def.kind === "instant"
          ? (state.soldiers.length ? "all-healthy" : "no-soldiers")
          : def.kind === "tower" ? "no-tower"
            // 📌 fails two different ways and they need different advice: "you
            // have no gun to aim" is a build problem, "nothing there" is an aim
            // problem. Reporting one as the other is what made a working power
            // read as broken.
            : (def.mark && !state.towers.some((t) => t.lineId !== "camp")) ? "no-tower"
              : "no-targets";
        return { ok: false, reason: why };
      }
      let hits = 0;
      if (def.kind === "point") {
        // The reveal is pushed BEFORE the damage loop, so the same tap that
        // flushes a phased ghost out also hits it — otherwise the rider would
        // only ever help the shot after.
        const rad = abilityRadius(def);
        if (def.mark) {
          // Pure state, tick-stamped, zero rng — so a headless sim drives it and
          // a replay stays byte-identical. Deliberately NOT checkpointed: an
          // absolute tick restored into a fresh engine is the documented
          // `leverCd` trap (it would hand a resumed run a mark that never ends).
          const m = markTargetAt(o);
          state.markId = m.id;
          state.markUntil = state.tick + Math.round(def.mark.seconds * DATA.TICK_RATE);
          hits = 1;
        }
        if (def.reveal) state.reveals.push({ x: o.x, y: o.y, r: scaleRadius(def.reveal.radius), until: state.tick + Math.round(def.reveal.seconds * DATA.TICK_RATE) });
        const r2 = rad * rad;
        if (!def.mark) for (const e of state.enemies) {   // a mark hits exactly one thing: the one it marked
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
          state.puddles.push({ x: o.x, y: o.y, r: rad, slow: def.slow, until: state.tick + Math.round(def.seconds * DATA.TICK_RATE) });
        }
      } else if (def.kind === "tower") {
        const t = towerById(o.towerId);
        t.boostUntil = state.tick + Math.round(def.seconds * DATA.TICK_RATE);
        t.boostMult = def.mult;
        if (def.crashSeconds) {
          t.crashUntil = t.boostUntil + Math.round(def.crashSeconds * DATA.TICK_RATE);
          t.crashMult = def.crashMult || 1;
        }
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
      state.charge -= chk.need;
      // ⏱️ Fast Hands: the ONE place a power's cooldown is set.
      state.abilityCd[id] = state.tick + Math.round(def.cooldown * DATA.TICK_RATE * mods.abilityCdMul);
      emit({ type: "ability", id, x: o.x, y: o.y, radius: abilityRadius(def), hits, charge: state.charge });
      return { ok: true, hits, charge: state.charge };
    }
    // Live Sticky Floor zones re-apply their slow every tick (a short refresh so
    // leaving the puddle wears off quickly), and expire on their own tick.
    function puddleTick() {
      // reveal zones expire on the same beat (cheap, and keeps `state` small so
      // the plain-JSON determinism hash stays honest)
      for (let i = state.reveals.length - 1; i >= 0; i--) if (state.tick >= state.reveals[i].until) state.reveals.splice(i, 1);
      if (!state.puddles.length) return;
      for (let i = state.puddles.length - 1; i >= 0; i--) if (state.tick >= state.puddles[i].until) state.puddles.splice(i, 1);
      for (const z of state.puddles) {
        const r2 = z.r * z.r;
        for (const e of state.enemies) {
          if (!e.alive) continue;
          const p = epos(e);
          if (isHidden(e)) continue; // untargetable means untouchable — the Fan's aura already skips these
          if ((p.x - z.x) ** 2 + (p.y - z.y) ** 2 <= r2) {
            if (z.slow) applySlow(e, z.slow, 0.25);
            // 🛢️ an oil slick is the Sticky Floor's mirror — it HURRIES. It writes
            // the Boom Box's own flag rather than growing a second speed field,
            // because `effSpeed` already has exactly one place that reads a hurry
            // and every speed effect must keep composing there — and it goes
            // through `applyHurry`, the ONE owner, so strongest wins whichever
            // source got there first (the slow's own rule).
            if (z.hurry) applyHurry(e, z.hurry, 2);
          }
        }
      }
    }

    return {
      state, events, tick, place, upgrade, branch, sell, undoLast, undoInfo, setTargeting, targetingModes, rally, callWave, priceOf, refundOf, coverageOf, towerReach, towerStats, reachAt,
      applyStrip, // 🎯 exposed like isHidden/dealDamage: a guardrail must drive the seam, not infer it
      chargePrice, buyCharge, buyChargeReady,
      // What THIS run banks per wave sent. 🔋 Spare Battery adds to it, so a UI
      // that prints RULES.chargePerWave is telling an owning run the wrong
      // number — the sell-refund defect, one unit smaller. Ask the engine.
      chargeGrant: () => R.chargePerWave + chargeBonus,
      // What THIS run STARTED with. ❤️ Extra Hearts moves it to 22 or 24, so a
      // UI that prints a literal 20 renders "24 of 20 stickers kept safe" —
      // which it did. Same shape as the sell-refund and charge-per-wave defects
      // (the panel re-deriving a number the meta had already moved), and the
      // same fix: the engine owns it and everything else asks. The Patch Kit
      // cap was the second computation of this quantity and now reads it too.
      maxLives,
      callInfo: () => callInfo(), // what a CALL right now would pay, and whether it is allowed
      pullLever, useAbility, abilityReady: (id) => abilityReady(id),
      // TD-18: may this run build this line? The build menu asks the ENGINE
      // rather than re-deriving the ban from save + DATA (the price-flash law).
      lineAllowed: (id) => !chipLineBans.has(id),
      // the renderer paints a revealed hider differently, and the guardrails
      // drive this rather than inferring it from a time-to-kill
      isRevealed: (e) => revealedAt(e),
      // TD-17 the ONE place the lever's timing is described, so the button, the
      // field overlay and the tests can never disagree about what it is doing.
      // NOTE: distinct from render.leverInfo(), which reports what the last DRAW
      // lit — this is engine truth and needs no draw first.
      leverState: () => {
        if (!levelDef.lever) return null;
        const rate = DATA.TICK_RATE;
        if (state.leverRoute) return { phase: "running", secs: Math.max(0, (state.leverUntil - state.tick) / rate), route: 1 };
        if (state.tick < state.leverCd) return { phase: "cooldown", secs: Math.max(0, (state.leverCd - state.tick) / rate), route: 0 };
        return { phase: "ready", secs: 0, route: 0 };
      },
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
    if (def.zapResist) out.push({ key: "zapresist", icon: "🦆", text: "Rubber — the Fan's zap lands at " + Math.round((1 - def.zapResist) * 100) + "%; hit it with darts or a blast instead" });
    if (def.hurry) out.push({ key: "hurry", icon: "📻", text: "Blares a beat — everything near it moves " + Math.round((def.hurry.mult - 1) * 100) + "% faster. Shoot the music, not the dancers" });
    if (def.spill) out.push({ key: "spill", icon: "🛢️", text: "Spills where it DIES — a slick that lasts " + def.spill.seconds + "s and hurries anything crossing it by " + Math.round((def.spill.mult - 1) * 100) + "%. Break it early, not in front of your best guns" });
    if (def.jamBurst) out.push({ key: "jamburst", icon: "🎇", text: "POPS where it DIES — jams the nearest gun within " + def.jamBurst.radius + " cells for " + def.jamBurst.seconds + "s. Army Guys are bodies, not electronics, so they never jam. Kill it away from your best tower" });
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
    // These four were SHIPPED mechanics with no card line at all: the Bed
    // Monster's stomp, the Static's hp-gated phases, the Vacuum King's suck and
    // its enrage. The FIELD_TRAIT guardrail hand-listed the fields it checked,
    // so it never asked about them — the "a scan's own list is part of the
    // scan" class, applied to a trait table. It derives now, so a new field
    // must either produce a line or join a documented non-trait list.
    if (def.stomp) out.push({ key: "stomp", icon: "💥", text: "Stomps every " + def.stomp.seconds + "s — knocks out soldiers standing near it, and a body in the road will not stop it" });
    if (def.suck) out.push({ key: "suck", icon: "🌪️", text: "Inhales the nearest soldier every " + def.suck.every + "s — blocking it costs you the blocker" });
    if (def.enrage) out.push({ key: "enrage", icon: "😡", text: "Enrages below " + Math.round(def.enrage.hpPct * 100) + "% health — moves " + Math.round((def.enrage.mult - 1) * 100) + "% faster" });
    if (def.phases) {
      const kit = [];
      for (const p of def.phases) {
        if (p.disable) kit.push("jams a gun every " + p.disable.every + "s");
        if (p.spawn) kit.push("calls in " + p.spawn.count + " × " + (DATA.ENEMIES[p.spawn.type] || { name: p.spawn.type }).name);
        if (p.speedMult) kit.push("dashes " + Math.round((p.speedMult - 1) * 100) + "% faster");
        if (p.armor) kit.push("hardens to " + Math.round(p.armor * 100) + "% armor");
      }
      const uniq = kit.filter((t, i) => kit.indexOf(t) === i);
      if (uniq.length) out.push({ key: "phases", icon: "⚡", text: "Escalates as it weakens — " + uniq.join(", ") + ". Burst it down before the next stage" });
    }
    // The toll is the single most consequential number on the card: letting one
    // of these reach the door is not the same as letting a sock through.
    if (def.lives > 1) out.push({ key: "toll", icon: "💔", text: "Costs " + def.lives + " stickers if it reaches the door" });
    if (!out.length) out.push({ key: "plain", icon: "•", text: "No tricks — anything can hit it" });
    // Phase 2: a world's EXCLUSIVE backbone shapes are its regulars, and the
    // guide never said where you meet anything. Derived by matching the def
    // against WORLDS[].backbone, so a new world's crowd documents itself and
    // ten "no tricks" cards stop reading as ten copies of the same enemy.
    const home = homeWorld(def);
    if (home) out.push({ key: "home", icon: "🏠", text: "The regular crowd in the " + DATA.WORLDS[home].label });
    return out;
  }
  // The one world whose backbone holds this enemy, or "" when it is shared (the
  // Plastic Knight and the Kite Hawk turn up nearly everywhere, so naming a
  // home for them would be noise rather than information).
  function homeWorld(def) {
    let found = "";
    for (const [key, w] of Object.entries(DATA.WORLDS)) {
      const mine = w.backbone.ground.concat([w.backbone.flier]).some((t) => DATA.ENEMIES[t] === def);
      if (!mine) continue;
      if (found) return "";      // shared across worlds — not anybody's regular
      found = key;
    }
    return found;
  }
  // Which tower lines can even REACH this enemy. The one place that answers
  // "why is nothing shooting it?" — the question the game never answered.
  function reachedBy(def) {
    // DERIVED from the arsenal, not a hand-kept list. The line names and the air
    // answer were both literals here, so a 5th tower line — or a change to which
    // lines reach air — would have left the guide teaching the old matrix while
    // the engine did something else. `hitsFliers` is already the data field the
    // engine's own targeting honours, so read that.
    const all = Object.keys(DATA.TOWERS);
    if (def && def.flier) return all.filter((k) => DATA.TOWERS[k].hitsFliers);
    // Soldiers never engage a BOSS (tryEngage skips ed.boss), so listing the camp
    // on a boss card was the guide teaching something the engine forbids.
    // …and a camp is BODIES: fireTowers' soldier-engage skips `ed.boss`, so the
    // camp can never touch a boss and listing it would teach the opposite.
    if (def && def.boss) return all.filter((k) => DATA.TOWERS[k].kind !== "camp");
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
    const slow = zones.filter((z) => z.mult != null && z.mult < 1), fast = zones.filter((z) => z.mult != null && z.mult > 1);
    const cover = zones.filter((z) => z.dmg != null && z.dmg < 1);
    if (slow.length) out.push({ key: "mud", icon: "🕳️", name: "Mud Patch",
      text: "A gloopy brown stretch of lane. Anything crossing it walks at " + Math.round(slow[0].mult * 100) + "% speed — free extra seconds for whatever covers it." });
    if (fast.length) out.push({ key: "conveyor", icon: "➡️", name: "Conveyor",
      text: "A strip of scrolling arrows. It shoves everything along at " + Math.round(fast[0].mult * 100) + "% speed, so guns covering it get LESS time. Don't spend your board here." });
    if (cover.length) out.push({ key: "cover", icon: "⛱️", name: "Blanket Cover",
      text: "A stretch of lane under cover. Anything you shoot in there only lands at " + Math.round(cover[0].dmg * 100) + "% — build somewhere the shots count." });
    if (def.night) out.push({ key: "night", icon: "🌙", name: "Lights Out",
      // read off RULES, never a literal — the guide must quote the engine's number
      text: "The room is dark: Dart and Mortar reach " + Math.round(DATA.RULES.nightRangeMult * 100) + "% as far. The Fan is unaffected — its aura doesn't need to see. A selected tower's ring always shows its TRUE reach." });
    if ((def.pads || []).some((p) => p.boost)) {
      const b = (def.pads.find((p) => p.boost) || {}).boost || {};
      out.push({ key: "power", icon: "⚡", name: "Power Pad",
        text: "A socket ringed in amber. Whatever you build on it fires " + Math.round(((b.rate || 1) - 1) * 100) + "% faster and reaches " + Math.round(((b.range || 1) - 1) * 100) + "% further. Put your best gun here." });
    }
    if ((def.waves || []).some((w) => (w.groups || []).some((g) => g.at > 0))) out.push({ key: "door", icon: "🚪", name: "Side Door",
      // The advance warning is the POINT of this entry: a marker that appears
      // when the thing happens is not a warning, and this door was reported as
      // unanticipatable twice before it warned early. Say so, or the guide
      // describes the version that was broken.
      text: "Part of a wave walks in PARTWAY down the lane instead of at the start — behind anything you built up front. The door pings on the field a whole wave BEFORE it opens, so you always get a full build phase of notice, and the next-wave line says how many are coming through it." });
    if (def.fork && def.lever) out.push({ key: "lever", icon: "🔀", name: "Track Switch",
      // numbers quoted from RULES, never re-typed — the guide must not drift
      text: "A lever on the field. Tap it to divert the traffic the long way for " + (DATA.RULES.leverHold || 10) +
        "s — the live route lights up and the button counts down. It snaps back on its own and re-arms " +
        (DATA.RULES.leverCooldown || 10) + "s later, so the question is not whether to use it but WHICH part of a wave to spend it on." });
    return out;
  }

  // ---- Decorative floor props: WHERE, decided purely (§art) ----
  // The board is 336 cells; the lane occupies ~65 and the pads ≤14, so ~76% of
  // every screen was bare floor and the Bedroom, the Garage and Moving Day were
  // told apart by a palette and a hatch pattern alone — the field read as a
  // diagram rather than a room.
  //
  // Placement lives HERE, beside enemyTraits/reachedBy/levelGimmicks, for the
  // reasons that make those pure too: it is testable without a browser, it has
  // no rng (the same multiplicative hash the floor speckle uses, so the same
  // level always dresses identically), and it takes NO cell size — a resize()
  // can never shift a prop.
  //
  // Clearance is measured against EVERY lane, not lane 0. That is the TD-11
  // lesson stated as code: a fork level's switch track is a lane an enemy really
  // walks, and the original pad-geometry audit checked only the default one.
  // ---- laneCoverage: how much of the lane a pad can actually SHOOT ----
  //
  // Placement is the fort's biggest INVISIBLE decision. The tier-4 branch audit
  // measured it: converting the same tower at a different pad swings L20 by up
  // to 5 lives (Sniper reads 15 at one pad and 20 at another, Bertha 10 vs 13),
  // which is more than most branches' entire headline value — and nothing in
  // the game says a word about it. The panel tells you what a tower DOES; this
  // is the number that tells you where it works.
  //
  // Cell-INDEX space on both sides. A tower stores `cx: pad.cx` and targets
  // against `posAt`'s indices, so index space is the truth here; adding the
  // canvas's half-cell centring is the +0.5 error this renderer has been bitten
  // by repeatedly, and it would bias every distance by up to a half-cell.
  //
  // LANE 0 only, deliberately: enemies walk the default route unless a lever is
  // thrown, so scoring the union over every lane would flatter a pad that only
  // covers a branch nobody is walking. A fork's second lane is the lever's
  // business, not this number's.
  //
  // rangeMin is the Mortar's dead zone — the one stat that makes two pads at
  // equal distance genuinely different — so it is subtracted, not ignored.
  function laneCoverage(levelDef, cx, cy, range, rangeMin) {
    const lane = buildPath((levelDef.paths && levelDef.paths.length ? levelDef.paths : [levelDef.path])[0]);
    if (!lane.total) return 0;
    const lo = (rangeMin || 0) * (rangeMin || 0), hi = (range || 0) * (range || 0);
    if (hi <= 0) return 0;
    const STEP = 0.05;                       // ~800-1300 samples on a shipped lane
    let hits = 0, n = 0;
    for (let d = 0; d <= lane.total; d += STEP) {
      const p = posAt(lane, d);
      const dx = p.x - cx, dy = p.y - cy, r2 = dx * dx + dy * dy;
      n += 1;
      if (r2 <= hi && r2 >= lo) hits += 1;
    }
    return n ? hits / n : 0;
  }

  function propCells(levelDef, grid, opts) {
    const o = opts || {};
    const LANE = o.lane == null ? 1.6 : o.lane;   // never touch the corridor an enemy walks
    const PAD = o.pad == null ? 1.4 : o.pad;      // nor crowd a build socket
    const want = o.count == null ? 7 : o.count;
    const G = grid || DATA.GRID;
    const lanes = (levelDef.paths && levelDef.paths.length ? levelDef.paths : [levelDef.path]).map(buildPath);
    const pads = levelDef.pads || [];
    // distance from a point to a polyline, in CELL-INDEX space — the same space
    // pads and path points are stored in (the documented "two coordinate spaces
    // one +0.5 apart" trap: mixing them biases every distance by a half-cell)
    function toLane(px, py, path) {
      let best = Infinity;
      for (const s of path.segs) {
        const dx = s.bx - s.ax, dy = s.by - s.ay;
        const len2 = dx * dx + dy * dy;
        let t = len2 ? ((px - s.ax) * dx + (py - s.ay) * dy) / len2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        best = Math.min(best, Math.hypot(px - (s.ax + dx * t), py - (s.ay + dy * t)));
      }
      return best;
    }
    const free = [];
    for (let y = 1; y < G.h - 1; y++) for (let x = 1; x < G.w - 1; x++) {
      if (lanes.some((p) => toLane(x, y, p) < LANE)) continue;
      if (pads.some((p) => Math.hypot(x - p.cx, y - p.cy) < PAD)) continue;
      if (levelDef.lever && Math.hypot(x - levelDef.lever.cx, y - levelDef.lever.cy) < PAD) continue;
      free.push([x, y]);
    }
    // Spread them out: consider the eligible cells in a deterministic shuffled
    // order and greedily take any that is far enough from one already placed.
    //
    // The first cut walked the list on a fixed STRIDE, which only enumerates
    // every index when the stride is coprime with the length — otherwise it
    // cycles a subset, and the tightest maps got 2 props instead of 7. Sorting
    // by a per-cell hash visits all of them and is still a pure function of the
    // level, so two calls agree exactly.
    const seed = String(levelDef.id).split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const key = (c) => (((c[0] * 73856093) ^ (c[1] * 19349663) ^ (seed * 83492791)) >>> 0);
    const order = free.slice().sort((a, b) => key(a) - key(b) || a[0] - b[0] || a[1] - b[1]);
    const out = [];
    // Two passes: prefer well-separated props, then fill any shortfall with a
    // looser gap rather than silently shipping a bare board.
    for (const gap of [3, 2]) {
      for (const [x, y] of order) {
        if (out.length >= want) break;
        if (out.some((p) => Math.hypot(p.x - x, p.y - y) < gap)) continue;
        const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        out.push({ x, y, kind: h % 3, s: 1.4 + ((h >>> 5) % 9) / 10 });
      }
    }
    return out;
  }

  // ---- 🎵 musicStep: what the soundtrack plays on step i ----
  // PURE, so the score is unit-testable with no audio and no browser — the same
  // reason enemyTraits/levelGimmicks/laneCoverage live here. It returns voices;
  // td-main is the only thing that knows how to sound them, and it does that
  // through the ONE iOS-safe JoshAudio.tone().
  //
  // Three things the old loop did not do, and they are the whole point:
  //   · a per-WORLD key, so ten rooms do not share one tune (DATA.WORLDS[].music)
  //   · a PHASE-aware arrangement — build is sparse and quiet so you can think,
  //     a wave is the full march with percussion and a harmony line
  //   · a BOSS voice — the minor scale plus a low drone, regardless of world
  function musicStep(i, ctx) {
    const M = DATA.MUSIC, c = ctx || {};
    const w = DATA.WORLDS[c.world] || {};
    const mus = w.music || { root: 196, mode: "bright" };
    // TENSE covers both reasons the music should stop being cheerful: a boss is
    // walking in, or the door is nearly down. They get the same voice on
    // purpose — the message is "this is serious", and splitting it into two
    // moods would only make both of them less legible.
    const boss = !!c.boss;
    const tense = boss || !!c.danger;
    const quiet = c.phase === "build";
    const scale = M.scales[tense ? "dark" : (mus.mode || "bright")] || M.scales.bright;
    const total = M.form.length * 16;
    const step = ((i % total) + total) % total;
    const phrase = M.form[Math.floor(step / 16)];
    const k = step % 16;
    // a field one short must degrade, not disable: an unknown degree would make
    // `scale[deg]` undefined and hand NaN straight to the oscillator.
    // ONE site, so melody, harmony, bass and the boss drone all inherit the
    // audible floor — the drone is the one that needed it (root/8 = 18.4Hz in
    // the garage) but a future low voice gets it for free.
    const floorHz = M.floorHz > 0 ? M.floorHz : 55;
    const hz = (deg, oct) => {
      const semi = scale[deg];
      if (typeof semi !== "number") return 0;
      let f = mus.root * Math.pow(2, (semi + 12 * (oct || 0)) / 12);
      // guard BEFORE the loop: a root of 0 or a NaN would spin here for ever,
      // and this runs inside the tick. A field one short must degrade, not hang.
      if (!(f > 0)) return 0;
      // FOLD, never clamp: doubling preserves the pitch class exactly, so the
      // harmony is unchanged and only the register moves. The BOUND is
      // deliberately defence-in-depth and cannot fail while the guard above
      // stands — say so rather than implying two protections where there is
      // one. Its whole job is that removing that guard then produces a wrong
      // NUMBER a test can report, instead of an infinite loop inside the tick:
      // verified, the unbounded version hangs `node --test` rather than failing
      // it, which is one step worse than a green test because it reads as
      // broken infrastructure. 12 covers a factor of 4096; the deepest real
      // case needs 2.
      for (let n = 0; n < 12 && f < floorHz; n++) f *= 2;
      return f;
    };
    const out = [];
    const mel = M.mel[phrase][k];
    // BUILD keeps only the strong beats — the same tune, thinned out, so the
    // quiet phase is recognisably the same piece rather than a second track.
    if (mel != null && !(quiet && k % 4 !== 0)) {
      const f = hz(mel);
      if (f) out.push({ hz: f, duration: 0.26, gain: quiet ? 0.034 : 0.05, type: "triangle" });
      // a third above, only under a wave: it is what makes the march sound
      // arranged rather than single-voiced, and it is the first thing to go
      // when the board is calm.
      const h = hz(mel + 2);
      if (h && !quiet) out.push({ hz: h, duration: 0.22, gain: 0.02, type: "triangle" });
    }
    if (k % 2 === 0) {
      const f = hz(M.bass[phrase][k / 2], -2);
      if (f) out.push({ hz: f, duration: 0.3, gain: quiet ? 0.038 : 0.055, type: "sine", plain: true });
    }
    if (!quiet) {
      const p = M.perc[k];
      if (p === "k") out.push({ hz: 70, duration: 0.09, gain: 0.05, type: "sine", plain: true });
      else if (p === "t") out.push({ hz: 1180, duration: 0.035, gain: 0.018, type: "triangle", plain: true });
    }
    // the boss drone lands once per phrase, not once per step — four voices in
    // a tick is already the busiest this ever gets, and JoshAudio caps at 12.
    if (tense && k === 0) {
      const f = hz(0, -3);
      if (f) out.push({ hz: f, duration: 1.1, gain: 0.03, type: "sine", plain: true });
    }
    return out;
  }

  const API = { createEngine, computeHit, hashState, buildPath, posAt, mulberry32, hashSeed, metaMods, generateEndlessWave, enemyTraits, reachedBy, levelGimmicks, propCells, laneCoverage, musicStep, DT };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (global && typeof global === "object") global.TDLogic = API;
})(typeof window !== "undefined" ? window : globalThis);
