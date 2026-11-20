// 🗺️ World — geography for Josh: Washington (where he lives), the USA, China
// (his family's other home) and the world. Six games on the shared framework,
// all no-fail, ≥75px, playable with the sound off (every answer is a picture,
// every place wears one). Content truth lives in content.js and is restated in
// content.test.js; the two maps' tap geometry is tested like SPY_SCENE.
(function () {
  const F = window.JoshFramework;
  const L = window.JoshLogic;
  const C = window.JoshContent || {};
  if (!F || !L) return;
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  // One `own` thing among two from far away (Washington Wonders, China Trip).
  function oddPlaceGame(cfg) {
    F.register({
      id: cfg.id, icon: cfg.icon, title: cfg.title, skill: cfg.skill,
      start(api) {
        const ROUNDS = 4;
        let round = 0, last = -1;
        // Three BIG cards and the buddy below: three 96px cards alone left
        // most of a phone's play area empty (measured on an iPhone 17 Pro).
        const chips = api.el("div", { class: "choices choices--3 choices--world" });
        api.stage.append(chips);
        api.mascot();
        api.stage.classList.add("world-pick");
        function newRound() {
          const r = L.makeOddPlace(cfg.own(), cfg.far(), undefined, last); last = r.idx;
          api.setPrompt(cfg.ask, cfg.icons, cfg.ask);
          api.speak();
          chips.innerHTML = "";
          r.choices.forEach((ch) => {
            const b = api.el("button", {
              class: "choice tap", type: "button", text: ch.item.e,
              dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.item.name },
            });
            b.addEventListener("click", () => {
              if (!ch.correct) { api.tryAgain(b); api.say(cap(ch.item.name) + "? " + cfg.notHere); return; }
              api.say(ch.item.fact);
              if (ch.item.zh) api.say(ch.item.zh, { lang: "zh-CN" });
              round += 1;
              if (round >= ROUNDS) api.win({ say: cfg.done }); else { api.roundWin(); api.nextRound(newRound, 1400); }
            });
            chips.appendChild(b);
          });
        }
        newRound();
      },
    });
  }

  oddPlaceGame({
    id: "wa-wonders", icon: "🌲", title: "Washington Wonders", skill: "home state geography [W]",
    own: () => (C.WA_WONDERS || {}).wa || [], far: () => (C.WA_WONDERS || {}).far || [],
    ask: "Which one is in Washington, where we live?", icons: ["🏠", "🌲", "👉"],
    notHere: "Not in Washington!",
    done: "You know Washington!",
  });

  oddPlaceGame({
    id: "china-trip", icon: "🐼", title: "China Trip", skill: "China & culture [W]",
    own: () => (C.CHINA_TRIP || {}).china || [], far: () => (C.CHINA_TRIP || {}).far || [],
    ask: "Which one is from China?", icons: ["✈️", "🏮", "👉"],
    notHere: "That's not from China!",
    done: "What a trip to China!",
  });

  // A drawn map with ≥75px place buttons on top (F.sceneZones, the one
  // implementation). Each round names one place; finding it marks it.
  function mapGame(cfg) {
    F.register({
      id: cfg.id, icon: cfg.icon, title: cfg.title, skill: cfg.skill,
      start(api) {
        const scene = cfg.scene();
        const zones = scene.zones.map((z) => Object.assign({ label: z.say || z.name }, z));
        const ROUNDS = cfg.rounds || zones.length;
        let round = 0, order = [], target = null;
        const built = F.sceneZones(api, scene.box, zones, (z, b) => {
          if (z !== target) { api.tryAgain(b); api.say(cfg.wrong(z, target)); return; }
          delete b.dataset.correct; b.classList.add("scene__zone--found");
          if (cfg.marker) { b.appendChild(api.el("span", { class: "map__marker", aria: { hidden: "true" } }, [cfg.marker])); }
          api.say(cfg.found(z));
          round += 1;
          if (round >= ROUNDS) api.win({ say: cfg.done }); else { api.roundWin(); api.nextRound(newRound, 1200); }
        });
        const art = api.el("div", { class: "map__art", aria: { hidden: "true" } });
        art.innerHTML = cfg.svg;
        built.stage.classList.add("map__stage");
        // Its shape, for the tablet size (styles/main.css): a map that stays
        // 340px on an iPad is a phone picture in a ten-inch column.
        built.stage.style.setProperty("--map-r", String(scene.box.h / scene.box.w));
        built.stage.style.setProperty("--map-h", scene.box.h + "px");
        built.stage.insertBefore(art, built.stage.firstChild);
        built.btns.forEach((b, i) => b.appendChild(api.el("span", { class: "map__pin", aria: { hidden: "true" } }, [zones[i].e])));
        api.stage.append(built.stage);
        function newRound() {
          if (!order.length) order = api.shuffle(zones.slice());
          target = order.shift();
          built.btns.forEach((b, i) => {
            b.classList.remove("scene__zone--found");
            const m = b.querySelector(".map__marker"); if (m) m.remove();
            if (zones[i] === target) b.dataset.correct = "1"; else delete b.dataset.correct;
          });
          api.setPrompt(cfg.caption(target), [cfg.marker || "👀", target.e, "👆"], cfg.ask(target));
          api.speak();
        }
        newRound();
      },
    });
  }

  // Washington: the Pacific to the west, the long hook of Puget Sound with
  // Seattle on its east shore, the Cascades running north-south EAST of the
  // city with Mount Rainier at their south end, and the dry east where the
  // apples grow. Stylized, but every side is true — and each drawn region
  // carries data-region so a test can check every pin lands on its own region
  // (Seattle once sat on top of the mountains it is west of).
  const WA_SVG = '<svg viewBox="0 0 280 300" preserveAspectRatio="none" width="100%" height="100%">' +
    '<rect data-region="ocean" width="280" height="300" fill="#8fd3ff"/>' +
    '<path data-region="land" d="M60 30 L272 30 L272 262 L230 262 C200 250 170 270 140 262 C110 255 90 268 70 262 L66 220 C58 190 70 160 58 130 C66 100 52 70 60 30 Z" fill="#7ccf7a" stroke="#3d7a3a" stroke-width="3"/>' +
    '<path data-region="dry" d="M206 30 L272 30 L272 262 L230 262 C220 256 212 258 206 260 Z" fill="#e8d28c"/>' +
    '<path data-region="sound" d="M108 30 C104 60 118 80 108 110 C102 130 116 140 112 160 L122 160 C126 140 114 128 122 108 C130 80 118 58 120 30 Z" fill="#8fd3ff"/>' +
    '<path data-region="cascades" d="M192 40 L206 80 L178 80 Z M182 104 L196 144 L168 144 Z M176 162 L190 200 L162 200 Z" fill="#6b7f62"/>' +
    '<path data-region="rainier" d="M140 196 L172 262 L108 262 Z" fill="#7d8c86"/><path d="M140 196 L152 222 L128 222 Z" fill="#ffffff"/>' +
    '</svg>';
  mapGame({
    id: "wa-map", icon: "🏔️", title: "Washington Map", skill: "reading a map [W]",
    scene: () => C.WA_MAP, svg: WA_SVG,
    caption: (z) => "Tap " + z.say + "!",
    ask: (z) => z.ask,
    found: (z) => "That's " + z.say + "!",
    wrong: (z, t) => "That's " + z.say + ". " + t.ask,
    done: "You can read the map of Washington!",
  });

  // The world: oceans all round, the seven continents where they sit.
  const WORLD_SVG = '<svg viewBox="0 0 280 320" preserveAspectRatio="none" width="100%" height="100%">' +
    '<rect width="280" height="320" fill="#8fd3ff"/>' +
    '<path data-region="na" d="M8 20 C30 6 70 10 84 26 C92 44 74 70 60 88 C52 96 44 104 38 98 C30 80 10 70 8 48 Z" fill="#7ccf7a"/>' +
    '<path data-region="eu" d="M112 34 C126 22 156 24 166 36 C164 54 146 72 124 76 C112 70 106 50 112 34 Z" fill="#9edc7a"/>' +
    '<path data-region="as" d="M180 20 C214 4 268 14 276 40 C278 70 258 96 226 100 C204 98 188 78 180 52 Z" fill="#c2d86a"/>' +
    '<path data-region="sa" d="M28 128 C46 116 70 124 70 146 C66 176 52 200 40 214 C30 200 22 170 24 148 Z" fill="#7ccf7a"/>' +
    '<path data-region="af" d="M112 120 C134 108 164 114 170 136 C170 168 154 194 140 212 C124 196 108 166 108 140 Z" fill="#e8c46a"/>' +
    '<path data-region="au" d="M210 146 C230 134 262 140 268 160 C266 182 244 194 222 190 C208 182 204 160 210 146 Z" fill="#e8b25a"/>' +
    '<path data-region="an" d="M50 286 C90 262 190 262 230 286 C200 306 90 308 50 286 Z" fill="#f4f9ff" stroke="#c9dcef" stroke-width="2"/>' +
    '</svg>';
  mapGame({
    id: "world-fly", icon: "✈️", title: "Fly Around the World", skill: "the seven continents [W]",
    scene: () => C.WORLD_MAP, svg: WORLD_SVG, marker: "✈️", rounds: 5,
    caption: (z) => "Fly to " + z.name + "!",
    ask: (z) => "Fly the plane to " + z.name + ", " + z.hint + "!",
    found: (z) => "Welcome to " + z.name + "!",
    wrong: (z, t) => "That's " + z.name + ". Fly to " + t.name + "!",
    done: "You flew all around the world!",
  });

  // Flags. Flag Friends: hear a country, tap its flag. Where in the World?:
  // see a thing a country is known for, tap that country's flag.
  function flagGame(cfg) {
    F.register({
      id: cfg.id, icon: cfg.icon, title: cfg.title, skill: cfg.skill,
      start(api) {
        const ROUNDS = 5;
        let round = 0, last = -1;
        const big = api.el("div", { class: "pick__big pick__big--world", aria: { hidden: "true" } });
        const chips = api.el("div", { class: "choices choices--3 choices--world" });
        api.stage.append(big, chips);
        api.mascot();
        api.stage.classList.add("world-pick");
        function newRound() {
          const r = L.makeFlagPick(C.COUNTRIES || [], undefined, last); last = r.idx;
          const c = r.country;
          big.textContent = cfg.big(c);
          api.setPrompt(cfg.caption(c), cfg.icons(c), cfg.ask(c));
          api.speak();
          chips.innerHTML = "";
          r.choices.forEach((ch) => {
            const b = api.el("button", {
              class: "choice choice--flag tap", type: "button", text: ch.country.flag,
              dataset: ch.correct ? { correct: "1" } : {}, aria: { label: "the flag of " + ch.country.name },
            });
            b.addEventListener("click", () => {
              if (!ch.correct) { api.tryAgain(b); api.say("That's the flag of " + ch.country.name + "."); return; }
              api.say(cfg.found(c));
              round += 1;
              if (round >= ROUNDS) api.win({ say: cfg.done }); else { api.roundWin(); api.nextRound(newRound, 1100); }
            });
            chips.appendChild(b);
          });
        }
        newRound();
      },
    });
  }

  flagGame({
    id: "flag-friends", icon: "🚩", title: "Flag Friends", skill: "country flags [W]",
    big: (c) => c.thing,
    caption: (c) => "Which flag is " + c.name + "'s?",
    icons: (c) => ["🚩", c.thing, "👉"],
    ask: (c) => "Find the flag of " + c.name + "!",
    found: (c) => "That's the flag of " + c.name + "!",
    done: "You know the flags of the world!",
  });

  flagGame({
    id: "where-world", icon: "🌍", title: "Where in the World?", skill: "countries & what they're known for [W]",
    big: (c) => c.thing,
    caption: () => "Where in the world is it? Tap its flag!",
    icons: (c) => [c.thing, "🌍", "🚩"],
    ask: (c) => "Where do you find " + c.thingName + "? Tap the flag!",
    found: (c) => "You find " + c.thingName + " in " + c.name + "!",
    done: "You're a world traveler!",
  });
})();
