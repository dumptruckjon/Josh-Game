// 🌱 Josh's Garden — the fifth New World (PLAN_TOWN.md §3): a garden that
// GROWS with everything he does. Its home shows his garden: one flower for
// every game he has beaten and every level he has finished in the New Worlds
// (read through JoshProgress and Town, the owners of those, never a save
// key), so playing anywhere makes it bloom. Four jobs tend it:
//   1. Plant Flowers — dig, drop a seed, water it (counted), let the sun out:
//                      it sprouts, grows and blooms. Three flowers.
//   2. Pull Carrots  — pull up the carrots the sign asks for, counted.
//   3. Pick Apples   — pick only the RED apples (the green ones are not ripe;
//                      each also wears its own look, so it reads in any colour
//                      vision: a red apple shines, a green one has a leaf).
//   4. Butterflies   — a butterfly lands on the flower of its own colour (and
//                      shape: each colour is a different flower).

(function (global) {
  "use strict";
  const T = global.Town;
  const doc = global.document;
  if (!T || !doc) return;
  const el = (tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
  const COUNT = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];
  function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // How many flowers his garden has: games he has beaten + New Worlds levels.
  function bloom() {
    let n = 0;
    // Only his own games that exist: never 华丽's, never a stale id a removed
    // game left in storage (the Sticker Book counts the same way).
    try {
      const mine = new Set((global.JoshGames || []).filter((g) => !g.hl).map((g) => g.id));
      n += (global.JoshProgress ? global.JoshProgress.wonIds() : []).filter((id) => mine.has(id)).length;
    } catch (e) { /* ignore */ }
    try { n += global.Town.starCount(); } catch (e) { /* ignore */ }
    return n;
  }
  const FLOWERS = ["🌷", "🌻", "🌼", "🌸", "🌹", "🌺"];
  function banner() {
    const n = bloom();
    const shown = Math.min(n, 30);
    let f = "";
    for (let i = 0; i < shown; i++) f += FLOWERS[i % FLOWERS.length];
    return '<div class="gar-plot" role="img" aria-label="Josh\'s garden has ' + n + (n === 1 ? " flower" : " flowers") + '">' +
      (f || '<span class="gar-plot__empty">🌱</span>') + (n > 30 ? '<span class="gar-plot__more">+' + (n - 30) + "</span>" : "") + "</div>";
  }

  // ---- 1. Plant Flowers -------------------------------------------------------------
  const STAGES = ["🕳️", "🌰", "🌱", "🌿"]; // dug, seeded, sprout, leaves
  function plant(api) {
    const n = 3, waters = 2;
    const scene = el("div", "gar-scene");
    const beds = el("div", "gar-beds");
    const plots = [];
    for (let i = 0; i < n; i++) {
      const b = el("button", "gar-bed tap", '<span class="gar-bed__in" aria-hidden="true"></span>');
      b.type = "button";
      b.setAttribute("aria-label", "Garden bed " + (i + 1));
      beds.appendChild(b);
      plots.push({ b, stage: -1, wet: 0 });
    }
    const tools = el("div", "gar-tools");
    const mk = (pic, label) => { const b = el("button", "gar-tool tap", '<span aria-hidden="true">' + pic + "</span>"); b.type = "button"; b.setAttribute("aria-label", label); tools.appendChild(b); return b; };
    const shovel = mk("⛏️", "Dig"), seed = mk("🌰", "Seed"), can = mk("💧", "Water"), sun = mk("☀️", "Sun");
    scene.append(beds, tools);
    api.stage.appendChild(scene);
    let p = 0, phase = "dig";
    const cur = () => plots[p];
    const paint = (x) => { x.b.querySelector(".gar-bed__in").textContent = x.stage < 0 ? "" : x.stage >= 4 ? x.flower : STAGES[x.stage]; };
    const tool = { dig: shovel, seed, water: can, sun };
    const say = { dig: "Dig a hole! Tap the pick.", seed: "Now drop in a seed!", water: "Water it! Two splashes.", sun: "Now the sun!" };
    function ask() { cur().b.classList.add("gar-bed--now"); api.next(tool[phase]); }
    api.prompt("⛏️ 🌰 💧 ☀️ ➡️ 🌷", "Let's plant three flowers! " + say.dig);
    ask();
    const press = (name) => () => {
      if (p >= n) return;
      if (name !== phase) { api.bump(tool[name], "Not yet! " + say[phase]); return; }
      const x = cur();
      if (phase === "dig") { x.stage = 0; phase = "seed"; }
      else if (phase === "seed") { x.stage = 1; phase = "water"; }
      else if (phase === "water") { x.wet += 1; x.stage = 2; if (x.wet >= waters) phase = "sun"; api.say(COUNT[x.wet] + "!"); }
      else if (phase === "sun") {
        x.stage = 3;
        paint(x);
        api.later(() => {
          x.stage = 4;
          x.flower = FLOWERS[(p + Math.floor(api.rng() * 6)) % FLOWERS.length];
          paint(x);
          x.b.classList.remove("gar-bed--now");
          x.b.classList.add("gar-bed--bloom");
          x.b.setAttribute("aria-label", "A flower");
          api.good(x.b, "It bloomed!");
          p += 1;
          if (p === n) { api.later(() => api.done("Three flowers! Your garden is beautiful!"), api.reduce() ? 0 : 500); return; }
          phase = "dig";
          api.say("Now the next bed! " + say.dig);
          ask();
        }, api.reduce() ? 0 : 450);
        api.next([]);
        api.tone(NOTES[5], { duration: 0.3 });
        return;
      }
      paint(x);
      api.tone(NOTES[["dig", "seed", "water"].indexOf(name) + x.wet], { duration: 0.2 });
      api.good(x.b);
      if (name !== "water") api.say(say[phase]);
      else if (phase === "sun") api.say(say.sun);
      ask();
    };
    for (const name of ["dig", "seed", "water", "sun"]) tool[name].addEventListener("click", press(name));
    plots.forEach((x) => x.b.addEventListener("click", () => {
      if (p >= n) return;
      if (x !== cur()) { api.bump(x.b, x.stage >= 4 ? "That one has bloomed!" : "This bed first!"); return; }
      api.bump(x.b, say[phase]); // the bed he touched answers, and says which tool comes next
    }));
  }

  // ---- 2. Pull Carrots ---------------------------------------------------------------
  function carrots(api) {
    const want = 3 + Math.floor(api.rng() * 3); // 3..5
    const total = 6;
    const scene = el("div", "gar-scene");
    const sign = el("div", "gar-sign", '<span aria-hidden="true">🥕</span> × <b>' + want + "</b>");
    sign.setAttribute("role", "img");
    sign.setAttribute("aria-label", "Pull " + want + " carrots");
    const patch = el("div", "gar-patch");
    const tops = [];
    for (let i = 0; i < total; i++) {
      const b = el("button", "gar-top tap", '<span aria-hidden="true">🌿</span>');
      b.type = "button";
      b.setAttribute("aria-label", "A carrot top");
      patch.appendChild(b);
      tops.push(b);
    }
    const basket = el("div", "gar-basket", '<span class="gar-basket__in" aria-hidden="true"></span><span aria-hidden="true">🧺</span>');
    basket.setAttribute("role", "img");
    basket.setAttribute("aria-label", "The basket");
    scene.append(sign, patch, basket);
    api.stage.appendChild(scene);
    let got = 0;
    api.prompt("🥕 × " + want + " ➡️ 🧺", "Pull up " + COUNT[want].toLowerCase() + " carrots! Look at the sign.");
    api.next(tops);
    tops.forEach((b) => b.addEventListener("click", () => {
      if (got >= want) return;
      if (b.classList.contains("gar-top--pulled")) { api.bump(b, "That one is pulled! Pick another."); return; }
      got += 1;
      b.classList.add("gar-top--pulled");
      b.querySelector("span").textContent = "🕳️";
      b.setAttribute("aria-label", "A hole");
      b.disabled = true;
      basket.querySelector(".gar-basket__in").textContent += "🥕";
      api.tone(NOTES[got - 1], { duration: 0.2 });
      api.good(basket, COUNT[got] + "!");
      if (got === want) {
        api.next([]);
        api.later(() => api.done(COUNT[want] + " carrots! Crunch crunch!"), api.reduce() ? 0 : 500);
      } else api.next(tops.filter((x) => !x.classList.contains("gar-top--pulled")));
    }));
  }

  // ---- 3. Pick Apples ----------------------------------------------------------------
  function apples(api) {
    const red = 3 + Math.floor(api.rng() * 2); // 3..4
    const green = 6 - red;
    const kinds = shuffle(Array.from({ length: red }, () => "red").concat(Array.from({ length: green }, () => "green")), api.rng);
    const scene = el("div", "gar-scene");
    const tree = el("div", "gar-tree");
    const buttons = kinds.map((k) => {
      const b = el("button", "gar-apple gar-apple--" + k + " tap", '<span aria-hidden="true">' + (k === "red" ? "🍎" : "🍏") + "</span>");
      b.type = "button";
      b.setAttribute("aria-label", k === "red" ? "A red apple" : "A green apple");
      b.dataset.kind = k;
      tree.appendChild(b);
      return b;
    });
    const basket = el("div", "gar-basket", '<span class="gar-basket__in" aria-hidden="true"></span><span aria-hidden="true">🧺</span>');
    basket.setAttribute("role", "img");
    basket.setAttribute("aria-label", "The basket");
    scene.append(tree, basket);
    api.stage.appendChild(scene);
    let got = 0;
    api.prompt("🍎 ➡️ 🧺", "Pick the red apples! The green ones are not ready yet.");
    const left = () => buttons.filter((b) => b.dataset.kind === "red" && !b.disabled);
    api.next(left());
    buttons.forEach((b) => b.addEventListener("click", () => {
      if (got >= red) return;
      if (b.dataset.kind !== "red") { api.bump(b, "That one is green! It's not ready. Pick a red one."); return; }
      got += 1;
      b.disabled = true;
      b.classList.add("gar-apple--picked");
      b.setAttribute("aria-label", "Picked");
      basket.querySelector(".gar-basket__in").textContent += "🍎";
      api.tone(NOTES[got - 1], { duration: 0.2 });
      api.good(basket, COUNT[got] + "!");
      if (got === red) { api.next([]); api.later(() => api.done("All " + COUNT[red].toLowerCase() + " red apples! Yum!"), api.reduce() ? 0 : 500); }
      else api.next(left());
    }));
  }

  // ---- 4. Butterflies ---------------------------------------------------------------
  // Each colour is a different flower, so the match reads by shape too.
  const BLOOMS = [{ c: "red", say: "red", pic: "🌹", hex: "#e23b3b" }, { c: "yellow", say: "yellow", pic: "🌻", hex: "#f2c200" }, { c: "pink", say: "pink", pic: "🌸", hex: "#ff7ac0" }];
  function butterflies(api) {
    const flowers = shuffle(BLOOMS.slice(0, 3), api.rng);
    const order = shuffle(flowers.slice(), api.rng);
    const scene = el("div", "gar-scene");
    const sky = el("div", "gar-sky");
    const fly = el("div", "gar-fly", '<span class="gar-fly__wing" aria-hidden="true">🦋</span><span class="gar-fly__dot" aria-hidden="true"></span>');
    fly.setAttribute("role", "img");
    sky.appendChild(fly);
    const bed = el("div", "gar-flowers");
    const btns = flowers.map((f) => {
      const b = el("button", "gar-flower tap", '<span aria-hidden="true">' + f.pic + "</span>");
      b.type = "button";
      b.style.setProperty("--flower", f.hex);
      b.setAttribute("aria-label", "A " + f.say + " flower");
      b.dataset.c = f.c;
      bed.appendChild(b);
      return b;
    });
    scene.append(sky, bed);
    api.stage.appendChild(scene);
    let k = 0, busy = false;
    const now = () => order[k];
    function show() {
      const f = now();
      fly.style.setProperty("--fly", f.hex);
      fly.querySelector(".gar-fly__dot").textContent = f.pic;
      fly.setAttribute("aria-label", "A " + f.say + " butterfly");
      api.next(btns.find((b) => b.dataset.c === f.c));
    }
    api.prompt("🦋 ➡️ 🌸", "The butterfly wants the flower of its own color! This one is " + now().say + ".");
    show();
    btns.forEach((b) => b.addEventListener("click", () => {
      if (busy || k >= order.length) return;
      if (b.dataset.c !== now().c) { api.bump(b, "That flower is " + BLOOMS.find((x) => x.c === b.dataset.c).say + ". The butterfly is " + now().say + "!"); return; }
      busy = true;
      api.next([]);
      const g = api.gap(fly, b);
      api.move(fly, g.dx, g.dy - 30, 600);
      api.later(() => {
        b.classList.add("gar-flower--visited");
        b.querySelector("span").textContent = now().pic + "🦋";
        k += 1;
        api.tone(NOTES[k + 1], { duration: 0.25 });
        api.good(b, "Yes! " + COUNT[k] + "!");
        api.move(fly, 0, 0, 0);
        busy = false;
        if (k === order.length) { fly.hidden = true; api.later(() => api.done("Every butterfly found its flower!"), api.reduce() ? 0 : 400); return; }
        show();
        api.say("Here comes a " + now().say + " butterfly!");
      }, api.reduce() ? 0 : 620);
    }));
  }

  T.register({
    id: "garden",
    name: "Josh's Garden",
    icon: "🌱",
    color: "#d8f5c8",
    say: "Welcome to your garden! Every game you play makes it grow.",
    banner,
    levels: [
      { id: "plant", name: "Plant Flowers", icon: "🌰", doneIcon: "🌷", play: plant },
      { id: "carrots", name: "Pull Carrots", icon: "🥕", doneIcon: "🥕", play: carrots },
      { id: "apples", name: "Pick Apples", icon: "🍎", doneIcon: "🧺", play: apples },
      { id: "butterflies", name: "Butterflies", icon: "🦋", doneIcon: "🦋", play: butterflies },
    ],
    play(api, level) { level.play(api); },
    bloom,
  });
})(typeof window !== "undefined" ? window : globalThis);
