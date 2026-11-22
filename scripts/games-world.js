// 🗺️ World — geography for Josh: Washington (where he lives), the USA, China
// (his family's other home) and the world. Fourteen games on the shared framework,
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
        let round = 0; const seen = [];
        // Three BIG cards and the buddy below: three 96px cards alone left
        // most of a phone's play area empty (measured on an iPhone 17 Pro).
        const chips = api.el("div", { class: "choices choices--3 choices--world" });
        api.stage.append(chips);
        api.mascot();
        api.stage.classList.add("world-pick");
        function newRound() {
          const r = L.makeOddPlace(cfg.own(), cfg.far(), undefined, seen); seen.push(r.idx);
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

  oddPlaceGame({
    id: "wa-animals", icon: "🦦", title: "Washington Animals", skill: "animals where we live [W]",
    own: () => (C.WA_ANIMALS || {}).wa || [], far: () => (C.WA_ANIMALS || {}).far || [],
    ask: "Which animal lives wild in Washington?", icons: ["🏠", "🐾", "👉"],
    notHere: "Not wild in Washington!",
    done: "You know Washington's animals!",
  });

  // A drawn map with ≥75px place buttons on top (F.sceneZones, the one
  // implementation). Each round names one place; finding it marks it.
  // `map` names the content scene, so the tests find every map game from the
  // registry. With `items`, each round asks about an ITEM (an animal) whose
  // place is one of the zones, and the pins carry no pictures (they would be
  // the answers). Every place that has a Chinese name (`zh`) says it after the
  // English, in a Chinese voice, when it is found.
  function mapGame(cfg) {
    F.register({
      id: cfg.id, icon: cfg.icon, title: cfg.title, skill: cfg.skill, map: cfg.map,
      start(api) {
        const scene = C[cfg.map];
        // the real map (tools/map-gen.js): its outlines, each pin's place and
        // each place's true spot
        const shape = (window.JoshMaps || {})[cfg.map] || { svg: "", pins: {}, spots: {} };
        const zones = scene.zones.map((z) => Object.assign({ label: z.say || z.name }, z, { x: (shape.pins[z.id] || [50, 50])[0], y: (shape.pins[z.id] || [50, 50])[1] }));
        const ROUNDS = cfg.rounds || zones.length;
        let round = 0, order = [], target = null, item = null, lastAt = null;
        const built = F.sceneZones(api, scene.box, zones, (z, b) => {
          // an animal that ALSO lives wild here: a true answer, never a "try again"
          const also = !!(item && item.also && item.also.includes(z.id));
          if (z !== target && !also) { api.tryAgain(b); api.say(cfg.wrong(z, target, item)); return; }
          built.btns.forEach((x) => delete x.dataset.correct); b.classList.add("scene__zone--found");
          // the plane lands there; on Animal Safari the animal moves in (its
          // pin has no picture, so a found pin was an empty green box)
          const mark = cfg.marker || (item && item.e);
          if (mark) { b.appendChild(api.el("span", { class: "map__marker" + (cfg.marker ? "" : " map__marker--home"), aria: { hidden: "true" } }, [mark])); }
          api.say(z === target ? cfg.found(z, item) : cfg.alsoFound(z, item, target));
          if (z.zh) api.say(z.zh, { lang: "zh-CN" });
          round += 1;
          if (round >= ROUNDS) api.win({ say: cfg.done }); else { api.roundWin(); api.nextRound(newRound, 1200); }
        });
        const art = api.el("div", { class: "map__art", aria: { hidden: "true" } });
        art.innerHTML = shape.svg;
        built.stage.classList.add("map__stage");
        // Its shape, for the tablet size (styles/main.css): a map that stays
        // 340px on an iPad is a phone picture in a ten-inch column.
        built.stage.style.setProperty("--map-r", String(scene.box.h / scene.box.w));
        built.stage.style.setProperty("--map-h", scene.box.h + "px");
        built.stage.insertBefore(art, built.stage.firstChild);
        if (!cfg.items) built.btns.forEach((b, i) => b.appendChild(api.el("span", { class: "map__pin", aria: { hidden: "true" } }, [zones[i].e])));
        const ask = cfg.items ? api.el("div", { class: "map__ask", aria: { hidden: "true" } }) : null;
        if (ask) api.stage.append(ask);
        api.stage.append(built.stage);
        function newRound() {
          if (cfg.items) {
            // never the same continent twice running: the same pin twice is no question
            if (!order.length) order = api.shuffle(C[cfg.items].slice());
            let k = order.findIndex((it) => it.at !== lastAt);
            if (k < 0) { order = api.shuffle(C[cfg.items].filter((it) => it.at !== lastAt)); k = 0; }
            item = order.splice(k, 1)[0]; lastAt = item.at;
            target = zones.find((z) => z.id === item.at);
            ask.textContent = item.e;
          } else {
            if (!order.length) order = api.shuffle(zones.slice());
            target = order.shift();
          }
          built.btns.forEach((b, i) => {
            b.classList.remove("scene__zone--found");
            const m = b.querySelector(".map__marker"); if (m) m.remove();
            if (zones[i] === target) b.dataset.correct = "1"; else delete b.dataset.correct;
          });
          api.setPrompt(cfg.caption(target, item), [cfg.marker || "👀", item ? item.e : target.e, "👆"], cfg.ask(target, item));
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
  mapGame({
    id: "wa-map", icon: "🏔️", title: "Washington Map", skill: "reading a map [W]",
    map: "WA_MAP",
    caption: (z) => "Tap " + z.say + "!",
    ask: (z) => z.ask,
    found: (z) => "That's " + z.say + "!",
    wrong: (z, t) => "That's " + z.say + ". " + t.ask,
    done: "You can read the map of Washington!",
  });

  // The world: oceans all round, the seven continents where they sit.
  mapGame({
    id: "world-fly", icon: "✈️", title: "Fly Around the World", skill: "the seven continents [W]",
    map: "WORLD_MAP", marker: "✈️", rounds: 5,
    caption: (z) => "Fly to " + z.name + "!",
    ask: (z) => "Fly the plane to " + z.name + ", " + z.hint + "!",
    found: (z) => "Welcome to " + z.name + "!",
    wrong: (z, t) => "That's " + z.name + ". Fly to " + t.name + "!",
    done: "You flew all around the world!",
  });

  // Animal Safari: the same world map, an animal in the question, no pictures
  // on the continents — he has to know where it lives.
  mapGame({
    id: "animal-safari", icon: "🦒", title: "Animal Safari", skill: "where animals live in the world [W]",
    map: "WORLD_MAP", items: "ANIMAL_SAFARI", rounds: 6,
    caption: (z, it) => "Where does " + it.name + " live?",
    ask: (z, it) => "Where in the world does " + it.name + " live? Tap its home!",
    found: (z, it) => cap(it.name) + " lives in " + z.name + "!",
    alsoFound: (z, it) => "Yes! " + cap(it.name) + " lives in " + z.name + " too!",
    wrong: (z, t, it) => "That's " + z.name + ". Where does " + it.name + " live?",
    done: "You know where the animals live!",
  });

  // The five oceans round a simple world: every sea a drawn region, the
  // continents (no region) between them where they sit on a map.
  mapGame({
    id: "ocean-map", icon: "🌊", title: "Ocean Map", skill: "the five oceans [W]",
    map: "OCEAN_MAP",
    caption: (z) => "Tap " + z.say + "!",
    ask: (z) => z.ask,
    found: (z) => "That's " + z.say + "!",
    wrong: (z, t) => "That's " + z.say + ". " + t.ask,
    done: "You know the oceans of the world!",
  });

  // The continents up close: each one stylized, every place on its real side,
  // and each pin on its own drawn region (the map test checks it).
  mapGame({
    id: "europe-map", icon: "🗼", title: "Europe Map", skill: "the map of Europe [W]",
    map: "EUROPE_MAP",
    caption: (z) => "Tap " + z.say + "!",
    ask: (z) => z.ask,
    found: (z) => "That's " + z.say + "!",
    wrong: (z, t) => "That's " + z.say + ". " + t.ask,
    done: "You can read the map of Europe!",
  });
  mapGame({
    id: "south-america-map", icon: "🦜", title: "South America Map", skill: "the map of South America [W]",
    map: "SOUTH_AMERICA_MAP",
    caption: (z) => "Tap " + z.say + "!",
    ask: (z) => z.ask,
    found: (z) => "That's " + z.say + "!",
    wrong: (z, t) => "That's " + z.say + ". " + t.ask,
    done: "You can read the map of South America!",
  });
  mapGame({
    id: "asia-map", icon: "🏯", title: "Asia Map", skill: "the map of Asia [W]",
    map: "ASIA_MAP",
    caption: (z) => "Tap " + z.say + "!",
    ask: (z) => z.ask,
    found: (z) => "That's " + z.say + "!",
    wrong: (z, t) => "That's " + z.say + ". " + t.ask,
    done: "You can read the map of Asia!",
  });
  mapGame({
    id: "africa-map", icon: "🦓", title: "Africa Map", skill: "the map of Africa [W]",
    map: "AFRICA_MAP",
    caption: (z) => "Tap " + z.say + "!",
    ask: (z) => z.ask,
    found: (z) => "That's " + z.say + "!",
    wrong: (z, t) => "That's " + z.say + ". " + t.ask,
    done: "You can read the map of Africa!",
  });
  mapGame({
    id: "north-america-map", icon: "🍁", title: "North America Map", skill: "the map of North America [W]",
    map: "NORTH_AMERICA_MAP",
    caption: (z) => "Tap " + z.say + "!",
    ask: (z) => z.ask,
    found: (z) => "That's " + z.say + "!",
    wrong: (z, t) => "That's " + z.say + ". " + t.ask,
    done: "You can read the map of North America!",
  });
  mapGame({
    id: "india-map", icon: "🐘", title: "India Map", skill: "the map of India [W]",
    map: "INDIA_MAP",
    caption: (z) => "Tap " + z.say + "!",
    ask: (z) => z.ask,
    found: (z) => "That's " + z.say + "!",
    wrong: (z, t) => "That's " + z.say + ". " + t.ask,
    done: "You can read the map of India!",
  });
  mapGame({
    id: "australia-map", icon: "🦘", title: "Australia Map", skill: "the map of Australia [W]",
    map: "AUSTRALIA_MAP",
    caption: (z) => "Tap " + z.say + "!",
    ask: (z) => z.ask,
    found: (z) => "That's " + z.say + "!",
    wrong: (z, t) => "That's " + z.say + ". " + t.ask,
    done: "You can read the map of Australia!",
  });

  // The USA: the lower 48 with five states drawn where they sit, Alaska and
  // Hawaii in their own boxes at the bottom (the way a US map shows them).
  mapGame({
    id: "usa-map", icon: "🇺🇸", title: "USA Map", skill: "the states of the USA [W]",
    map: "USA_MAP", rounds: 6,
    caption: (z) => "Tap " + z.say + "!",
    ask: (z) => z.ask,
    found: (z) => "That's " + z.say + "!",
    wrong: (z, t) => "That's " + z.say + ". " + t.ask,
    done: "You can read the map of the USA!",
  });

  // China: the Great Wall across the north, Beijing at its east end, Shanghai
  // on the coast south of it, the panda forests inland to the west, and Mount
  // Everest on the far south-west edge.
  mapGame({
    id: "china-map", icon: "🧱", title: "China Map", skill: "places in China [W]",
    map: "CHINA_MAP",
    caption: (z) => "Tap " + z.say + "!",
    ask: (z) => z.ask,
    found: (z) => "That's " + z.say + "!",
    wrong: (z, t) => "That's " + z.say + ". " + t.ask,
    done: "You can read the map of China!",
  });

  // Flags. Flag Friends: hear a country, tap its flag. Where in the World?:
  // see a thing a country is known for, tap that country's flag.
  function flagGame(cfg) {
    F.register({
      id: cfg.id, icon: cfg.icon, title: cfg.title, skill: cfg.skill,
      start(api) {
        const ROUNDS = 5;
        let round = 0; const seen = [];
        const big = api.el("div", { class: "pick__big pick__big--world", aria: { hidden: "true" } });
        const chips = api.el("div", { class: "choices choices--3 choices--world" });
        api.stage.append(big, chips);
        api.mascot();
        api.stage.classList.add("world-pick");
        function newRound() {
          const r = L.makeFlagPick(C.COUNTRIES || [], undefined, seen); seen.push(r.idx);
          const c = r.country;
          big.textContent = cfg.big(c);
          api.setPrompt(cfg.caption(c), cfg.icons(c), cfg.ask(c));
          api.speak();
          chips.innerHTML = "";
          r.choices.forEach((ch) => {
            // a choice is a FLAG (Where in the World?) or a THING (Flag Friends)
            const o = ch.country, thing = cfg.pick === "thing";
            const b = api.el("button", {
              class: "choice " + (thing ? "choice--thing" : "choice--flag") + " tap", type: "button", text: thing ? o.thing : o.flag,
              dataset: ch.correct ? { correct: "1" } : {}, aria: { label: thing ? o.thingName : "the flag of " + o.name },
            });
            b.addEventListener("click", () => {
              if (!ch.correct) { api.tryAgain(b); api.say(thing ? (o.plural ? "Those are " : "That's ") + o.thingName + ", from " + o.name + "." : "That's the flag of " + o.name + "."); return; }
              api.say(cfg.found(c));
              if (c.zh) api.say(c.zh, { lang: "zh-CN" });
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
    // the flag is the question and the answer is what the country is known
    // for — the other way round from Where in the World?, so the two differ.
    id: "flag-friends", icon: "🚩", title: "Flag Friends", skill: "country flags [W]",
    pick: "thing",
    big: (c) => c.flag,
    caption: (c) => "What is " + c.name + " known for?",
    icons: (c) => [c.flag, "🤔", "👉"],
    ask: (c) => "This is the flag of " + c.name + ". What is " + c.name + " known for?",
    found: (c) => c.name.replace(/^the /, "The ") + " is known for " + c.thingName + "!",
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
