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
      phase: "build",
      countdown: R.buildCountdownFirst * DATA.TICK_RATE,
      waveIdx: 0,
      gold: levelDef.startGold + diff.startGold,
      lives: R.lives,
      stars: 0,
      cheated: false,
      enemies: [],
      towers: [],
      soldiers: [],
      projectiles: [],
      shells: [],
    };
    let spawnQueue = [];

    const events = [];
    const emit = (e) => { events.push(e); if (events.length > 400) events.splice(0, events.length - 400); };

    const padById = (id) => levelDef.pads.find((p) => p.id === id) || null;
    const towerAt = (padId) => state.towers.find((t) => t.padId === padId) || null;
    const towerById = (id) => state.towers.find((t) => t.id === id) || null;
    const enemyById = (id) => state.enemies.find((e) => e.id === id && e.alive) || null;
    const soldierById = (id) => state.soldiers.find((s) => s.id === id && s.alive) || null;
    const enemyDef = (e) => DATA.ENEMIES[e.type];

    function scheduleWave(idx) {
      const wave = levelDef.waves[idx];
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

    function spawnEnemy(type) {
      const def = DATA.ENEMIES[type];
      state.enemies.push({
        id: nextId++, type,
        dist: 0,
        hp: Math.round(def.hp * diff.hp),
        maxHp: Math.round(def.hp * diff.hp),
        shield: def.shield, armor: def.armor,
        speed: def.speed * diff.speed,
        slowPct: 0, slowUntil: 0,
        brittle: false, brittleUntil: 0,
        blockedBy: 0, stunnedUntil: 0, meleeCd: 0, stunApplied: false,
        alive: true,
      });
    }

    function applySlow(e, pct, seconds) {
      let p = pct * (enemyDef(e).flier ? R.flierSlowFactor : 1);
      p = Math.min(p, R.slowCap);
      const active = state.tick < e.slowUntil ? e.slowPct : 0;
      if (p >= active) { e.slowPct = p; e.slowUntil = state.tick + Math.round(seconds * DATA.TICK_RATE); }
    }
    function effSpeed(e) {
      const slow = state.tick < e.slowUntil ? e.slowPct : 0;
      return e.speed * (1 - slow);
    }

    function killEnemy(e, how) {
      e.alive = false;
      if (e.blockedBy) { const s = soldierById(e.blockedBy); if (s) s.engagedId = 0; e.blockedBy = 0; }
      const bounty = Math.round(enemyDef(e).bounty * diff.bounty);
      state.gold += bounty;
      const p = posAt(path, e.dist);
      emit({ type: "die", x: p.x, y: p.y, bounty, enemy: e.type, how });
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
      if (state.waveIdx >= levelDef.waves.length) {
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
        else if (mode === "close") {
          const pb = posAt(path, best.dist), pe = posAt(path, e.dist);
          if ((pe.x - t.cx) ** 2 + (pe.y - t.cy) ** 2 < (pb.x - t.cx) ** 2 + (pb.y - t.cy) ** 2) best = e;
        }
      }
      return best.id;
    }
    function candidates(t, minR, maxR, fliersOk) {
      const out = [];
      for (const e of state.enemies) {
        if (!e.alive) continue;
        if (!fliersOk && enemyDef(e).flier) continue;
        const p = posAt(path, e.dist);
        const d2 = (p.x - t.cx) ** 2 + (p.y - t.cy) ** 2;
        if (d2 <= maxR * maxR && d2 >= minR * minR) out.push(e);
      }
      return out;
    }

    // ---- Soldiers ----
    function rallySlots(t) {
      const s = statsOf(DATA.TOWERS.camp, t);
      const offs = [[0, -0.3], [-0.4, 0.25], [0.4, 0.25], [0, 0.7]];
      const out = [];
      for (let i = 0; i < s.soldiers; i++) out.push({ x: t.rallyX + offs[i % offs.length][0], y: t.rallyY + offs[i % offs.length][1] });
      return out;
    }
    function spawnSoldiers(t) {
      const s = statsOf(DATA.TOWERS.camp, t);
      const slots = rallySlots(t);
      for (let i = 0; i < s.soldiers; i++) {
        state.soldiers.push({
          id: nextId++, campId: t.id, slot: i,
          hp: s.hp, maxHp: s.hp,
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
            sol.alive = true; sol.hp = s.hp; sol.maxHp = s.hp;
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
          if (ed.flier || ed.boss) continue;
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
          // melee trade — soldier swings
          if (sol.meleeCd > 0) sol.meleeCd -= 1;
          if (sol.meleeCd <= 0) {
            sol.meleeCd = Math.round(cs.rate * DATA.TICK_RATE);
            const hit = computeHit(cs.dmg, "bonk", foe);
            foe.hp -= hit.hpDmg;
            if (foe.hp <= 0) { killEnemy(foe, "melee"); sol.engagedId = 0; continue; }
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
        if (t.cooldown > 0) t.cooldown -= 1;

        if (def.kind === "dart") {
          const cur = enemyById(t.targetId);
          let keep = false;
          if (cur) {
            const p = posAt(path, cur.dist);
            keep = (p.x - t.cx) ** 2 + (p.y - t.cy) ** 2 <= s.range * s.range;
          }
          if (!keep) {
            t.targetId = pickByMode(candidates(t, 0, s.range, def.hitsFliers), t.targeting, t);
            if (s.spinUp) t.heat = s.heatFloor; // retarget resets the spin-up
          } else if (s.spinUp) {
            t.heat = Math.min(1, (t.heat || s.heatFloor) + DT / s.spinUp);
          }
          if (t.targetId && t.cooldown <= 0) {
            t.cooldown = Math.round(s.rate * DATA.TICK_RATE);
            let dmg = s.dmg;
            if (s.spinUp) dmg = Math.max(1, Math.round(s.dmg * (t.heat || s.heatFloor)));
            let crit = false;
            if (s.crit && rng() < s.crit) { dmg = Math.round(dmg * s.critMult); crit = true; }
            state.projectiles.push({
              id: nextId++, x: t.cx, y: t.cy, targetId: t.targetId,
              dmg, dmgType: s.dmgType, speed: def.projectileSpeed, crit,
            });
            emit({ type: "shoot", x: t.cx, y: t.cy, tower: t.lineId });
          }
        } else if (def.kind === "mortar") {
          const cands = candidates(t, s.rangeMin, s.range, false);
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
              dmg: s.dmg, splash: s.splash, goo: s.goo || null,
            });
            emit({ type: "shoot", x: t.cx, y: t.cy, tower: t.lineId });
          }
        } else if (def.kind === "fan") {
          // aura: slow (and Blizzard brittle) everything in range, fliers half
          const aura = candidates(t, 0, s.auraRange, true);
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
                  cur2.hp -= hit.hpDmg;
                  if (cur2.shield) cur2.shield = Math.max(0, cur2.shield - hit.shieldDmg);
                  if (cur2.hp <= 0) killEnemy(cur2, "zap");
                  dmg *= s.chain.decay;
                  // jump: nearest alive enemy within jump range of the last hit
                  let next = null, bestD = s.chain.jump * s.chain.jump;
                  for (const e of state.enemies) {
                    if (!e.alive || hitIds.indexOf(e.id) >= 0) continue;
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
                beamTarget.hp -= hit.hpDmg;
                if (beamTarget.shield) beamTarget.shield = Math.max(0, beamTarget.shield - hit.shieldDmg);
                if (beamTarget.hp <= 0) killEnemy(beamTarget, "zap");
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
            if (!e.alive || enemyDef(e).flier) continue;
            const p = posAt(path, e.dist);
            const d = Math.sqrt((p.x - sh.tx) ** 2 + (p.y - sh.ty) ** 2);
            if (d <= sh.splash) {
              const factor = d <= 0.5 ? 1 : Math.max(0.25, 1 - ((d - 0.5) / (sh.splash - 0.5)) * 0.75);
              const hit = computeHit(sh.dmg * factor, "bonk", e);
              e.hp -= hit.hpDmg;
              if (sh.goo) applySlow(e, sh.goo.slow, sh.goo.seconds);
              if (e.hp <= 0) killEnemy(e, "splash");
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
          target.hp -= hit.hpDmg;
          if (target.shield) target.shield = Math.max(0, target.shield - hit.shieldDmg);
          emit({ type: "hit", x: tp.x, y: tp.y, crit: pr.crit || false });
          if (target.hp <= 0) killEnemy(target, "dart");
          pr.dead = true;
        } else {
          pr.x += (dx / d) * step;
          pr.y += (dy / d) * step;
        }
      }
      state.projectiles = state.projectiles.filter((p) => !p.dead);
      shellTick();
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
        rallyX: 0, rallyY: 0,
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
        for (const sol of state.soldiers) if (sol.campId === t.id && sol.alive) { sol.hp = s.hp; sol.maxHp = s.hp; }
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
      if (state.gold < b.cost) return { ok: false, reason: "gold" };
      state.gold -= b.cost; t.tier = 4; t.branch = choice; t.spent += b.cost;
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
      const refund = Math.floor(t.spent * R.sellRefund);
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
      if (["first", "last", "strong", "close"].indexOf(mode) < 0) return { ok: false, reason: "bad-mode" };
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
        if (sol.campId === t.id && sol.alive && !sol.engagedId) {
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
      const bonus = Math.ceil(secondsLeft * R.earlyCallRate);
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
      levelDef,
    };
  }

  const API = { createEngine, computeHit, hashState, buildPath, posAt, mulberry32, hashSeed, DT };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (global && typeof global === "object") global.TDLogic = API;
})(typeof window !== "undefined" ? window : globalThis);
