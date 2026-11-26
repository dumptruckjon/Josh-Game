// 🚧 Dig Site — the first of the New Worlds (PLAN_TOWN.md §2): Josh runs a
// building site. Four jobs, each a few big taps, each ending with the thing
// he built being USED (a garden grows in the hole, cars drive the road, a flag
// flies on the tower, footprints walk the new path):
//   1. Fill the Hole   — dig three scoops into the dump truck, drive it to the
//                        hole and tip it; three truckloads fill it (counting).
//   2. Clear the Road  — the bulldozer pushes four rocks off, then the roller
//                        smooths the road in order, 1 2 3 4 (counting order).
//   3. Crane Tower     — stack blocks to match the plan, bottom to top (each
//                        colour also wears its own shape, so it reads in any
//                        colour vision).
//   4. Mix the Cement  — sand and water as the recipe card shows, mix, pour.
// Everything plays through the New Worlds shell (town-main.js): api.next marks
// what to tap, api.done ends the job. The machines are drawn here as flat
// SVG; the dump truck is JoshArt.truck (it tips and carries rocks).

(function (global) {
  "use strict";
  const T = global.Town;
  if (!T) return;
  const ART = () => global.JoshArt;
  const INK = "#2b2b3a";
  const svg = (inner) => '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' + inner + "</svg>";
  const tracks = (y) => '<rect x="10" y="' + y + '" width="64" height="14" rx="7" fill="#3d3d4a" stroke="' + INK + '" stroke-width="2"/>' +
    [20, 32, 44, 56, 66].map((x) => '<circle cx="' + x + '" cy="' + (y + 7) + '" r="4" fill="#9a9aa8"/>').join("");

  // The digger: its arm at an angle (0 = up, 1 = bucket down in the dirt).
  function excavator(a) {
    const ang = -40 + 70 * (a || 0);
    return svg(
      '<ellipse cx="44" cy="92" rx="38" ry="5" fill="rgba(0,0,0,0.14)"/>' +
      tracks(74) +
      '<rect x="16" y="50" width="48" height="24" rx="5" fill="#ffc21a" stroke="' + INK + '" stroke-width="2"/>' +
      '<rect x="20" y="30" width="22" height="22" rx="4" fill="#ffc21a" stroke="' + INK + '" stroke-width="2"/>' +
      '<rect x="24" y="34" width="14" height="11" rx="2" fill="#bfe9ff"/>' +
      '<g transform="rotate(' + ang.toFixed(1) + ' 58 54)">' +
        '<path d="M56 52 L84 30 L90 36 L62 58 Z" fill="#ffb000" stroke="' + INK + '" stroke-width="2"/>' +
        '<path d="M84 30 L96 54 L90 58 L80 38 Z" fill="#ffb000" stroke="' + INK + '" stroke-width="2"/>' +
        '<path d="M88 54 L100 56 L96 68 L84 64 Z" fill="#6e6e7a" stroke="' + INK + '" stroke-width="2"/>' +
      "</g>");
  }
  function bulldozer() {
    return svg(
      '<ellipse cx="50" cy="92" rx="40" ry="5" fill="rgba(0,0,0,0.14)"/>' +
      tracks(74).replace(/x="10"/, 'x="24"').replace(/cx="(\d+)"/g, (m, x) => 'cx="' + (+x + 14) + '"') +
      '<rect x="30" y="48" width="48" height="26" rx="5" fill="#ffc21a" stroke="' + INK + '" stroke-width="2"/>' +
      '<rect x="52" y="28" width="22" height="22" rx="4" fill="#ffc21a" stroke="' + INK + '" stroke-width="2"/>' +
      '<rect x="56" y="32" width="14" height="11" rx="2" fill="#bfe9ff"/>' +
      '<path d="M8 50 Q16 66 8 86 L20 86 L24 50 Z" fill="#8a8a96" stroke="' + INK + '" stroke-width="2"/>' +
      '<path d="M22 62 L32 62" stroke="' + INK + '" stroke-width="4"/>');
  }
  function roller() {
    return svg(
      '<ellipse cx="50" cy="92" rx="40" ry="5" fill="rgba(0,0,0,0.14)"/>' +
      '<rect x="8" y="58" width="36" height="30" rx="15" fill="#8a8a96" stroke="' + INK + '" stroke-width="2"/>' +
      '<rect x="14" y="66" width="24" height="4" rx="2" fill="#b8b8c4"/>' +
      '<rect x="40" y="46" width="44" height="26" rx="5" fill="#ffc21a" stroke="' + INK + '" stroke-width="2"/>' +
      '<rect x="58" y="24" width="22" height="24" rx="4" fill="#ffc21a" stroke="' + INK + '" stroke-width="2"/>' +
      '<rect x="62" y="28" width="14" height="11" rx="2" fill="#bfe9ff"/>' +
      '<circle cx="74" cy="80" r="9" fill="#3d3d4a" stroke="' + INK + '" stroke-width="2"/><circle cx="74" cy="80" r="3.5" fill="#9a9aa8"/>');
  }
  // The cement mixer: its drum's stripes at an angle (it spins when mixing),
  // and how full it is (0..1, shown as a grey pour line in the drum's mouth).
  function mixer(spin, full) {
    const s = (spin || 0) * 360;
    return svg(
      '<ellipse cx="50" cy="92" rx="42" ry="5" fill="rgba(0,0,0,0.14)"/>' +
      '<rect x="8" y="66" width="84" height="10" fill="#555"/>' +
      '<rect x="70" y="44" width="22" height="24" rx="3" fill="#ff7a59" stroke="' + INK + '" stroke-width="2"/>' +
      '<rect x="74" y="48" width="13" height="10" rx="2" fill="#bfe9ff"/>' +
      '<g transform="rotate(' + (-14).toFixed(1) + ' 38 48)">' +
        '<ellipse cx="38" cy="48" rx="30" ry="19" fill="#e9eef5" stroke="' + INK + '" stroke-width="2"/>' +
        '<g transform="rotate(' + s.toFixed(1) + ' 38 48)"><path d="M16 40 Q38 30 60 40 M14 52 Q38 42 62 52" stroke="#ff7a59" stroke-width="5" fill="none"/></g>' +
        (full > 0 ? '<ellipse cx="66" cy="44" rx="4" ry="' + (2 + 6 * Math.min(1, full)).toFixed(1) + '" fill="#9aa0a8" stroke="' + INK + '" stroke-width="1.5"/>' : "") +
      "</g>" +
      '<circle cx="26" cy="80" r="9" fill="#333"/><circle cx="26" cy="80" r="4" fill="#aaa"/>' +
      '<circle cx="78" cy="80" r="9" fill="#333"/><circle cx="78" cy="80" r="4" fill="#aaa"/>');
  }
  function crane() {
    return svg(
      '<rect x="18" y="10" width="8" height="84" fill="#ffc21a" stroke="' + INK + '" stroke-width="2"/>' +
      [20, 36, 52, 68, 84].map((y) => '<path d="M18 ' + y + " L26 " + (y + 8) + '" stroke="' + INK + '" stroke-width="1.5"/>').join("") +
      '<rect x="6" y="8" width="90" height="7" fill="#ffc21a" stroke="' + INK + '" stroke-width="2"/>' +
      '<rect x="4" y="15" width="12" height="10" fill="#6e6e7a" stroke="' + INK + '" stroke-width="2"/>' +
      '<path d="M84 15 L84 40" stroke="' + INK + '" stroke-width="2"/>' +
      '<path d="M80 40 L88 40 L88 44 Q84 52 80 46" fill="none" stroke="' + INK + '" stroke-width="3"/>');
  }
  const sandPile = () => svg('<ellipse cx="50" cy="90" rx="44" ry="6" fill="rgba(0,0,0,0.14)"/><path d="M6 88 Q30 30 50 26 Q70 30 94 88 Z" fill="#e8b96a" stroke="' + INK + '" stroke-width="2"/><circle cx="38" cy="60" r="2.5" fill="#c69244"/><circle cx="58" cy="50" r="2.5" fill="#c69244"/><circle cx="64" cy="72" r="2.5" fill="#c69244"/>');
  const dirtPile = () => '<svg class="dig-dirt" viewBox="0 0 100 40" aria-hidden="true" focusable="false"><path d="M0 40 Q20 6 50 4 Q80 6 100 40 Z" fill="#8b5a2b" stroke="' + INK + '" stroke-width="2"/></svg>';

  // ---- Shared bits -----------------------------------------------------------------
  const el = (tag, cls, html) => { const e = global.document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  function thing(cls, label, html) {
    const wrap = el("div", "dig-wrap " + cls);
    const b = el("button", "dig-thing tap", html);
    b.type = "button";
    b.setAttribute("aria-label", label);
    wrap.appendChild(b);
    return { wrap, b };
  }
  const COUNT = ["", "One", "Two", "Three", "Four", "Five", "Six"];
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // play frames f(0..n-1) one after another (instant under reduced motion)
  function frames(api, n, ms, f, then) {
    if (api.reduce()) { f(n - 1); then(); return; }
    let i = 0;
    const step = () => { f(i); i += 1; if (i < n) api.later(step, ms); else api.later(then, ms); };
    step();
  }

  // ---- 1. Fill the Hole -------------------------------------------------------------
  const LOADS = 3, SCOOPS = 3;
  function fillHole(api) {
    const scene = el("div", "dig-scene dig-scene--hole");
    const dig = thing("dig-digger", "The digger", '<span class="dig-art">' + excavator(0) + "</span>" + dirtPile());
    const truck = thing("dig-truck", "The dump truck", '<span class="dig-art">' + ART().truck("#ffb703", { load: 0 }) + "</span>");
    const hole = el("div", "dig-hole", '<span class="dig-hole__dirt"></span><span class="dig-hole__garden" aria-hidden="true"></span>');
    hole.setAttribute("role", "img");
    hole.setAttribute("aria-label", "The hole");
    const pips = el("div", "dig-pips", Array.from({ length: LOADS }, () => '<span class="dig-pip"></span>').join(""));
    pips.setAttribute("aria-hidden", "true");
    scene.append(dig.wrap, truck.wrap, pips, hole);
    api.stage.appendChild(scene);
    let scoops = 0, loads = 0, busy = false;
    const paintTruck = (tip) => { truck.b.querySelector(".dig-art").innerHTML = ART().truck("#ffb703", { load: scoops, tip }); };
    api.prompt("🚚 🚚 🚚 ➡️ 🕳️", "Fill the hole with three truckloads of dirt! Tap the digger.");
    api.next(dig.b);
    dig.b.addEventListener("click", () => {
      if (busy) return;
      if (scoops >= SCOOPS) { api.bump(dig.b, "The truck is full! Tap the truck."); return; }
      busy = true;
      frames(api, 4, 120, (i) => { dig.b.querySelector(".dig-art").innerHTML = excavator([0.5, 1, 0.5, 0][i]); }, () => {
        scoops += 1;
        paintTruck(0);
        api.tone(NOTES[scoops - 1], { duration: 0.2 });
        api.good(truck.b, COUNT[scoops] + "!");
        busy = false;
        if (scoops === SCOOPS) { api.say("The truck is full! Tap the truck."); api.next(truck.b); }
        else api.next(dig.b);
      });
    });
    truck.b.addEventListener("click", () => {
      if (busy) return;
      if (scoops < SCOOPS) { api.bump(truck.b, "Not full yet! Tap the digger."); return; }
      busy = true;
      api.next([]);
      const g = api.gap(truck.wrap, hole);
      api.move(truck.wrap, g.dx, g.dy - 20, 600);
      api.later(() => {
        frames(api, 4, 110, (i) => paintTruck([0.3, 0.7, 1, 1][i]), () => {
          scoops = 0;
          loads += 1;
          paintTruck(0);
          hole.style.setProperty("--fill", String(loads / LOADS));
          pips.children[loads - 1].classList.add("dig-pip--full");
          api.tone(NOTES[loads + 1], { duration: 0.3 });
          api.move(truck.wrap, 0, 0, 600);
          if (loads === LOADS) {
            api.later(() => {
              hole.classList.add("dig-hole--garden");
              hole.querySelector(".dig-hole__garden").textContent = "🌻🌷🐶";
              hole.setAttribute("aria-label", "A garden where the hole was");
              api.done("Three loads! The hole is full, and now it is a garden!");
            }, 650);
          } else {
            api.say(COUNT[loads] + " load! Fill the truck again.");
            api.later(() => { busy = false; api.next(dig.b); }, api.reduce() ? 0 : 650);
          }
        });
      }, api.reduce() ? 0 : 650);
    });
  }

  // ---- 2. Clear the Road ------------------------------------------------------------
  const SEGS = 4;
  function clearRoad(api) {
    const scene = el("div", "dig-scene dig-scene--road");
    const mach = thing("dig-machine", "The bulldozer", '<span class="dig-art">' + bulldozer() + "</span>");
    const side = el("div", "dig-side", "");
    side.setAttribute("aria-hidden", "true");
    const road = el("div", "dig-road");
    const segs = [];
    for (let i = 0; i < SEGS; i++) {
      const s = el("button", "dig-seg tap", '<span class="dig-seg__rock" aria-hidden="true">🪨</span><span class="dig-seg__num" aria-hidden="true">' + (i + 1) + "</span>");
      s.type = "button";
      s.setAttribute("aria-label", "Road part " + (i + 1) + ", with a rock");
      segs.push(s);
      road.appendChild(s);
    }
    const top = el("div", "dig-roadtop");
    top.append(mach.wrap, side);
    scene.append(top, road);
    api.stage.appendChild(scene);
    let phase = "rocks", pushed = 0, smooth = 0, busy = false;
    api.prompt("🪨 🪨 🪨 🪨 ➡️ 🛣️", "Push the rocks off the road! Tap a rock.");
    api.next(segs);
    mach.b.addEventListener("click", () => {
      api.bump(mach.b, phase === "rocks" ? "Tap a rock on the road!" : "Tap number " + (smooth + 1) + " on the road!");
    });
    segs.forEach((s, i) => s.addEventListener("click", () => {
      if (busy) return;
      if (phase === "rocks") {
        if (s.classList.contains("dig-seg--clear")) { api.bump(s, "That one is clear! Find another rock."); return; }
        busy = true;
        const g = api.gap(mach.wrap, s);
        api.move(mach.wrap, g.dx, g.dy - 30, 450);
        api.later(() => {
          s.classList.add("dig-seg--clear");
          s.setAttribute("aria-label", "Road part " + (i + 1));
          side.appendChild(el("span", "dig-side__rock", "🪨"));
          pushed += 1;
          api.tone(NOTES[pushed - 1], { duration: 0.2 });
          api.good(s, COUNT[pushed] + "!");
          api.move(mach.wrap, 0, 0, 450);
          api.later(() => {
            busy = false;
            if (pushed < SEGS) { api.next(segs.filter((x) => !x.classList.contains("dig-seg--clear"))); return; }
            phase = "roll";
            mach.b.querySelector(".dig-art").innerHTML = roller();
            mach.b.setAttribute("aria-label", "The road roller");
            road.classList.add("dig-road--numbers");
            api.prompt("1️⃣ 2️⃣ 3️⃣ 4️⃣", "All clear! Now roll the road flat. Tap number one.");
            api.next(segs[0]);
          }, api.reduce() ? 0 : 460);
        }, api.reduce() ? 0 : 460);
        return;
      }
      if (s.classList.contains("dig-seg--smooth")) { api.bump(s, "That part is done! Tap number " + (smooth + 1) + "."); return; }
      if (i !== smooth) { api.bump(s, "Number " + (smooth + 1) + " first!"); return; }
      busy = true;
      const g = api.gap(mach.wrap, s);
      api.move(mach.wrap, g.dx, g.dy - 30, 450);
      api.later(() => {
        s.classList.add("dig-seg--smooth");
        smooth += 1;
        api.tone(NOTES[smooth], { duration: 0.25 });
        api.good(s, COUNT[smooth] + "!");
        busy = false;
        if (smooth < SEGS) { api.next(segs[smooth]); return; }
        api.move(mach.wrap, 0, 0, 450);
        road.classList.add("dig-road--cars");
        road.appendChild(el("span", "dig-car", "🚗"));
        road.appendChild(el("span", "dig-car dig-car--2", "🚌"));
        api.later(() => api.done("The road is ready! Beep beep!"), 600);
      }, api.reduce() ? 0 : 460);
    }));
  }

  // ---- 3. Crane Tower ---------------------------------------------------------------
  // Each colour wears its own shape too, so the plan reads in any colour vision.
  const BLOCKS = [
    { id: "red", say: "red", hex: "#e23b3b", mark: "●" },
    { id: "blue", say: "blue", hex: "#2f6fe0", mark: "■" },
    { id: "yellow", say: "yellow", hex: "#f2c200", mark: "▲" },
    { id: "green", say: "green", hex: "#2fa35a", mark: "★" },
    { id: "purple", say: "purple", hex: "#8a4fd8", mark: "◆" },
  ];
  const TALL = 4;
  const blockHtml = (b) => '<span class="dig-block__mark" aria-hidden="true">' + b.mark + "</span>";
  function craneTower(api) {
    const pick = shuffle(BLOCKS.slice(), api.rng);
    const plan = pick.slice(0, TALL);
    const scene = el("div", "dig-scene dig-scene--tower");
    const card = el("div", "dig-plan");
    card.setAttribute("role", "img");
    card.setAttribute("aria-label", "The plan, from the bottom: " + plan.map((b) => b.say).join(", "));
    plan.slice().reverse().forEach((b) => {
      const p = el("span", "dig-plan__row", blockHtml(b));
      p.style.background = b.hex;
      p.dataset.block = b.id;
      card.appendChild(p);
    });
    const site = el("div", "dig-site");
    site.appendChild(el("span", "dig-crane", crane()));
    const tower = el("div", "dig-tower");
    tower.setAttribute("aria-label", "The tower");
    site.appendChild(tower);
    const ground = el("div", "dig-ground");
    const btns = shuffle(pick.slice(), api.rng).map((b) => {
      const t = thing("dig-blockwrap", b.say + " block", blockHtml(b));
      t.b.classList.add("dig-block");
      t.b.style.background = b.hex;
      t.b.dataset.block = b.id;
      ground.appendChild(t.wrap);
      return { b, t };
    });
    const top = el("div", "dig-towertop");
    top.append(card, site);
    scene.append(top, ground);
    api.stage.appendChild(scene);
    let k = 0, busy = false;
    const target = () => btns.find((x) => x.b === plan[k]);
    api.prompt("📋 ➡️ 🏗️", "Build the tower just like the plan! Start at the bottom: the " + plan[0].say + " one.");
    api.next(target().t.b);
    btns.forEach((x) => x.t.b.addEventListener("click", () => {
      if (busy || k >= TALL || x.t.wrap.classList.contains("dig-used")) return;
      if (x.b !== plan[k]) { api.bump(x.t.b, "Look at the plan! The " + plan[k].say + " one is next."); return; }
      busy = true;
      api.next([]);
      const slot = el("span", "dig-tower__block", blockHtml(x.b));
      slot.style.background = x.b.hex;
      slot.style.visibility = "hidden";
      tower.prepend(slot);
      const g = api.gap(x.t.wrap, slot);
      x.t.wrap.classList.add("dig-hooked");
      api.move(x.t.wrap, g.dx, g.dy, 650);
      api.later(() => {
        slot.style.visibility = "";
        x.t.wrap.classList.add("dig-used");
        x.t.b.disabled = true;
        x.t.b.setAttribute("aria-hidden", "true");
        card.querySelector('[data-block="' + x.b.id + '"]').classList.add("dig-plan__row--done");
        k += 1;
        api.tone(NOTES[k], { duration: 0.25 });
        api.good(slot, COUNT[k] + "!");
        busy = false;
        if (k < TALL) { api.say("Now the " + plan[k].say + " one."); api.next(target().t.b); return; }
        tower.prepend(el("span", "dig-flag", "🚩"));
        api.later(() => api.done("Four blocks high! What a tall tower!"), 500);
      }, api.reduce() ? 0 : 660);
    }));
  }

  // ---- 4. Mix the Cement ------------------------------------------------------------
  function mixCement(api) {
    const sand = 2 + Math.floor(api.rng() * 3);  // 2..4
    const water = 1 + Math.floor(api.rng() * 2); // 1..2
    const scene = el("div", "dig-scene dig-scene--mix");
    const card = el("div", "dig-recipe",
      '<span class="dig-recipe__row"><span class="dig-recipe__bag">' + sandPile() + "</span>×<b>" + sand + "</b></span>" +
      '<span class="dig-recipe__row"><span class="dig-recipe__icon" aria-hidden="true">🪣</span>×<b>' + water + "</b></span>");
    card.setAttribute("role", "img");
    card.setAttribute("aria-label", "The recipe: " + sand + " sand and " + water + " water");
    const s = thing("dig-sand", "The sand", '<span class="dig-art">' + sandPile() + "</span>");
    const w = thing("dig-water", "The water", '<span class="dig-art dig-art--emoji" aria-hidden="true">🪣</span>');
    const m = thing("dig-mixer", "The cement mixer", '<span class="dig-art">' + mixer(0, 0) + "</span>");
    const mold = el("button", "dig-mold tap", Array.from({ length: 4 }, () => '<span class="dig-mold__sq"></span>').join(""));
    mold.type = "button";
    mold.setAttribute("aria-label", "The path to pour");
    const tray = el("div", "dig-mixrow");
    tray.append(s.wrap, w.wrap, m.wrap);
    scene.append(card, tray, mold);
    api.stage.appendChild(scene);
    let ns = 0, nw = 0, phase = "sand", busy = false;
    const full = () => (ns + nw) / (sand + water);
    api.prompt("📋 ➡️ 🪣 ➡️ ⬜⬜⬜⬜", "Make cement! Look at the card: " + sand + " sand and " + water + " water. Tap the sand.");
    api.next(s.b);
    s.b.addEventListener("click", () => {
      if (busy) return;
      if (phase !== "sand") { api.bump(s.b, phase === "water" ? "That's enough sand! Now the water." : "Tap the " + (phase === "mix" ? "mixer" : "path") + "!"); return; }
      ns += 1;
      m.b.querySelector(".dig-art").innerHTML = mixer(0, full());
      api.tone(NOTES[ns - 1], { duration: 0.2 });
      api.good(m.b, COUNT[ns] + " sand!");
      if (ns === sand) { phase = "water"; api.say("Now " + COUNT[water].toLowerCase() + " water."); api.next(w.b); } else api.next(s.b);
    });
    w.b.addEventListener("click", () => {
      if (busy) return;
      if (phase !== "water") { api.bump(w.b, phase === "sand" ? "Sand first! Look at the card." : "Tap the " + (phase === "mix" ? "mixer" : "path") + "!"); return; }
      nw += 1;
      m.b.querySelector(".dig-art").innerHTML = mixer(0, full());
      api.tone(NOTES[nw + 1], { duration: 0.2 });
      api.good(m.b, COUNT[nw] + " water!");
      if (nw === water) { phase = "mix"; api.say("Mix it up! Tap the mixer."); api.next(m.b); } else api.next(w.b);
    });
    m.b.addEventListener("click", () => {
      if (busy) return;
      if (phase !== "mix") { api.bump(m.b, phase === "pour" ? "Tap the path to pour!" : "Look at the card first!"); return; }
      busy = true;
      api.next([]);
      api.say("Mix, mix, mix!");
      frames(api, 8, 110, (i) => { m.b.querySelector(".dig-art").innerHTML = mixer(i / 8, 1); api.tone(392 + 40 * (i % 2), { duration: 0.08, gain: 0.12 }); }, () => {
        busy = false;
        phase = "pour";
        api.prompt("⬜⬜⬜⬜ 👇", "Now pour it! Tap the path.");
        api.next(mold);
      });
    });
    mold.addEventListener("click", () => {
      if (busy) return;
      if (phase !== "pour") { api.bump(mold, "Make the cement first!"); return; }
      busy = true;
      api.next([]);
      const sq = [...mold.querySelectorAll(".dig-mold__sq")];
      frames(api, sq.length, 220, (i) => { sq[i].classList.add("dig-mold__sq--full"); api.tone(NOTES[i], { duration: 0.15 }); }, () => {
        mold.classList.add("dig-mold--done");
        mold.appendChild(el("span", "dig-feet", "👣"));
        mold.setAttribute("aria-label", "A new path with footprints");
        api.done("A brand new path! Let's walk on it!");
      });
    });
  }

  T.register({
    id: "dig",
    name: "Dig Site",
    icon: "🚧",
    color: "#ffe38a",
    say: "Welcome to the Dig Site! Pick a job.",
    levels: [
      { id: "hole", name: "Fill the Hole", icon: "🕳️", doneIcon: "🌻", play: fillHole },
      { id: "road", name: "Clear the Road", icon: "🪨", doneIcon: "🛣️", play: clearRoad },
      { id: "tower", name: "Crane Tower", icon: "🏗️", doneIcon: "🏢", play: craneTower },
      { id: "cement", name: "Mix the Cement", icon: "🪣", doneIcon: "👣", play: mixCement },
    ],
    play(api, level) { level.play(api); },
    // for the tests: the pictures this world draws
    art: { excavator, bulldozer, roller, mixer, crane },
  });
})(typeof window !== "undefined" ? window : globalThis);
