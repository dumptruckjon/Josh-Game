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
        const zones = scene.zones.map((z) => Object.assign({ label: z.say || z.name }, z));
        const ROUNDS = cfg.rounds || zones.length;
        let round = 0, order = [], target = null, item = null, lastAt = null;
        const built = F.sceneZones(api, scene.box, zones, (z, b) => {
          // an animal that ALSO lives wild here: a true answer, never a "try again"
          const also = !!(item && item.also && item.also.includes(z.id));
          if (z !== target && !also) { api.tryAgain(b); api.say(cfg.wrong(z, target, item)); return; }
          built.btns.forEach((x) => delete x.dataset.correct); b.classList.add("scene__zone--found");
          if (cfg.marker) { b.appendChild(api.el("span", { class: "map__marker", aria: { hidden: "true" } }, [cfg.marker])); }
          api.say(z === target ? cfg.found(z, item) : cfg.alsoFound(z, item, target));
          if (z.zh) api.say(z.zh, { lang: "zh-CN" });
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
    map: "WA_MAP", svg: WA_SVG,
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
    map: "WORLD_MAP", svg: WORLD_SVG, marker: "✈️", rounds: 5,
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
    map: "WORLD_MAP", items: "ANIMAL_SAFARI", svg: WORLD_SVG, rounds: 6,
    caption: (z, it) => "Where does " + it.name + " live?",
    ask: (z, it) => "Where in the world does " + it.name + " live? Tap its home!",
    found: (z, it) => cap(it.name) + " lives in " + z.name + "!",
    alsoFound: (z, it) => "Yes! " + cap(it.name) + " lives in " + z.name + " too!",
    wrong: (z, t, it) => "That's " + z.name + ". Where does " + it.name + " live?",
    done: "You know where the animals live!",
  });

  // The five oceans round a simple world: every sea a drawn region, the
  // continents (no region) between them where they sit on a map.
  const OCEAN_SVG = '<svg viewBox="0 0 280 320" preserveAspectRatio="none" width="100%" height="100%">' +
    // one sea colour: the oceans are named by their pins, not by stripes
    // (a base sea under the regions, so their shared edges leave no seam)
    '<rect width="280" height="320" fill="#86cff7"/>' +
    '<rect data-region="pacific" x="0" y="40" width="74" height="215" fill="#86cff7"/>' +
    '<rect data-region="atlantic" x="74" y="40" width="98" height="215" fill="#86cff7"/>' +
    '<rect data-region="indian" x="172" y="40" width="108" height="215" fill="#86cff7"/>' +
    '<rect data-region="arctic" x="0" y="0" width="280" height="40" fill="#cdeefc"/>' +
    '<rect data-region="southern" x="0" y="255" width="280" height="65" fill="#a7dcf7"/>' +
    '<path d="M80 46 C96 40 114 46 112 70 C108 94 98 112 88 124 C80 108 76 78 80 46 Z" fill="#7ccf7a"/>' +
    '<path d="M92 140 C104 136 110 150 106 172 C102 196 98 212 94 224 C88 204 86 166 92 140 Z" fill="#7ccf7a"/>' +
    '<path d="M178 48 C188 42 200 46 200 60 C198 76 188 88 180 90 C176 76 174 60 178 48 Z" fill="#9edc7a"/>' +
    '<path d="M178 104 C190 100 204 106 204 128 C202 158 194 188 186 208 C178 188 174 150 178 104 Z" fill="#e8c46a"/>' +
    '<path d="M208 44 C236 34 270 42 276 64 C276 94 256 120 230 124 C216 116 208 88 208 44 Z" fill="#c2d86a"/>' +
    '<path d="M250 228 C260 222 274 226 276 238 C274 250 262 256 254 252 C246 246 246 236 250 228 Z" fill="#e8b25a"/>' +
    '<path d="M40 300 C90 288 190 288 240 300 C200 316 80 316 40 300 Z" fill="#f4f9ff" stroke="#c9dcef" stroke-width="2"/>' +
    '</svg>';
  mapGame({
    id: "ocean-map", icon: "🌊", title: "Ocean Map", skill: "the five oceans [W]",
    map: "OCEAN_MAP", svg: OCEAN_SVG,
    caption: (z) => "Tap " + z.say + "!",
    ask: (z) => z.ask,
    found: (z) => "That's " + z.say + "!",
    wrong: (z, t) => "That's " + z.say + ". " + t.ask,
    done: "You know the oceans of the world!",
  });

  // The continents up close: each one stylized, every place on its real side,
  // and each pin on its own drawn region (the map test checks it).
  const EUROPE_SVG = '<svg viewBox="0 0 280 320" preserveAspectRatio="none" width="100%" height="100%">' +
    '<rect data-region="sea" width="280" height="320" fill="#8fd3ff"/>' +
    '<path data-region="land" d="M95 40 L190 15 L278 15 L278 210 L205 232 L200 300 L165 305 L150 240 L120 240 L108 305 L28 305 L26 236 L78 226 L78 160 L100 118 Z" fill="#cfe8a8" stroke="#7a9a5a" stroke-width="2"/>' +
    '<path data-region="norway" d="M108 14 L152 8 L164 58 L142 96 L116 80 Z" fill="#a9d8f0"/>' +
    '<path data-region="russia" d="M190 18 L278 18 L278 200 L196 200 Z" fill="#e8a8a8"/>' +
    '<path data-region="france" d="M80 165 L150 160 L156 226 L95 236 L80 200 Z" fill="#a8b8f0"/>' +
    '<path data-region="spain" d="M28 244 L100 240 L106 305 L32 305 Z" fill="#f4cf6a"/>' +
    '<path data-region="italy" d="M160 235 L185 230 L200 290 L186 312 L170 302 L178 275 Z" fill="#9edc7a"/>' +
    '<ellipse data-region="uk" cx="60" cy="118" rx="22" ry="36" fill="#c9a8e8"/>' +
    '</svg>';
  mapGame({
    id: "europe-map", icon: "🗼", title: "Europe Map", skill: "the map of Europe [W]",
    map: "EUROPE_MAP", svg: EUROPE_SVG,
    caption: (z) => "Tap " + z.say + "!",
    ask: (z) => z.ask,
    found: (z) => "That's " + z.say + "!",
    wrong: (z, t) => "That's " + z.say + ". " + t.ask,
    done: "You can read the map of Europe!",
  });
  const SOUTH_AMERICA_SVG = '<svg viewBox="0 0 280 320" preserveAspectRatio="none" width="100%" height="100%">' +
    '<rect data-region="sea" width="280" height="320" fill="#8fd3ff"/>' +
    '<path data-region="land" d="M70 8 L150 6 L200 40 L252 90 L240 150 L190 200 L150 250 L132 312 L108 314 L95 260 L70 190 L42 130 L38 70 Z" fill="#cfe8a8" stroke="#7a9a5a" stroke-width="2"/>' +
    '<path data-region="colombia" d="M70 10 L140 8 L136 56 L80 56 Z" fill="#f4cf6a"/>' +
    '<ellipse data-region="amazon" cx="174" cy="112" rx="50" ry="35" fill="#4fa84a"/>' +
    '<path data-region="peru" d="M42 108 L90 108 L96 182 L60 182 Z" fill="#e8a8a8"/>' +
    '<path data-region="argentina" d="M95 225 L150 225 L132 310 L110 310 Z" fill="#a9d8f0"/>' +
    '</svg>';
  mapGame({
    id: "south-america-map", icon: "🦜", title: "South America Map", skill: "the map of South America [W]",
    map: "SOUTH_AMERICA_MAP", svg: SOUTH_AMERICA_SVG,
    caption: (z) => "Tap " + z.say + "!",
    ask: (z) => z.ask,
    found: (z) => "That's " + z.say + "!",
    wrong: (z, t) => "That's " + z.say + ". " + t.ask,
    done: "You can read the map of South America!",
  });
  const AUSTRALIA_SVG = '<svg viewBox="0 0 280 320" preserveAspectRatio="none" width="100%" height="100%">' +
    '<rect data-region="sea" width="280" height="320" fill="#8fd3ff"/>' +
    '<path data-region="land" d="M14 122 L60 82 L110 72 L150 42 L180 62 L200 22 L230 62 L266 140 L262 232 L222 272 L170 262 L130 242 L90 252 L40 232 L12 180 Z" fill="#e8b25a" stroke="#a8722a" stroke-width="2"/>' +
    '<path data-region="reef" d="M205 40 L240 50 L250 100 L225 100 Z" fill="#5fd0c8"/>' +
    '<ellipse data-region="perth" cx="40" cy="176" rx="22" ry="28" fill="#f4cf6a"/>' +
    '<path data-region="uluru" d="M108 172 L160 172 L154 148 L116 148 Z" fill="#c8552a"/>' +
    '<circle data-region="sydney" cx="224" cy="224" r="18" fill="#e05a4f"/>' +
    '</svg>';
  mapGame({
    id: "australia-map", icon: "🦘", title: "Australia Map", skill: "the map of Australia [W]",
    map: "AUSTRALIA_MAP", svg: AUSTRALIA_SVG,
    caption: (z) => "Tap " + z.say + "!",
    ask: (z) => z.ask,
    found: (z) => "That's " + z.say + "!",
    wrong: (z, t) => "That's " + z.say + ". " + t.ask,
    done: "You can read the map of Australia!",
  });

  // The USA: the lower 48 with five states drawn where they sit, Alaska and
  // Hawaii in their own boxes at the bottom (the way a US map shows them).
  const USA_SVG = '<svg viewBox="0 0 280 320" preserveAspectRatio="none" width="100%" height="100%">' +
    '<rect data-region="sea" width="280" height="320" fill="#8fd3ff"/>' +
    '<path data-region="land" d="M20 28 L84 28 L210 30 L230 26 L256 30 L262 44 L250 72 L244 110 L232 150 L246 168 L256 200 L250 214 L240 210 L230 180 L206 178 L180 190 L160 196 L150 216 L132 200 L116 178 L96 178 L48 174 C34 150 24 126 22 100 Z" fill="#f2e2b0" stroke="#a88a45" stroke-width="2"/>' +
    '<path data-region="wa" d="M22 30 L84 30 L84 66 L22 66 Z" fill="#7ccf7a"/>' +
    '<path data-region="ca" d="M22 100 L58 100 L58 128 L92 162 L86 176 L48 172 C36 150 26 130 22 100 Z" fill="#f4c46a"/>' +
    '<path data-region="tx" d="M108 128 L138 128 L138 146 L176 150 L178 188 L160 194 L150 214 L134 200 L116 176 L96 176 L100 160 L108 160 Z" fill="#e88f6a"/>' +
    '<path data-region="fl" d="M206 166 L240 160 L246 168 L256 200 L250 212 L240 208 L232 182 L206 178 Z" fill="#7cc6d8"/>' +
    '<path data-region="ny" d="M222 44 L256 34 L262 50 L250 70 L226 72 L220 58 Z" fill="#c79ae0"/>' +
    '<rect x="8" y="234" width="84" height="76" rx="8" fill="#b9e4ff"/>' +
    '<path data-region="ak" d="M16 246 L70 242 L82 268 L64 296 L42 288 L18 298 Z" fill="#e9f4f9" stroke="#8fb3c8" stroke-width="2"/>' +
    '<rect x="108" y="234" width="96" height="76" rx="8" fill="#b9e4ff"/>' +
    '<circle cx="126" cy="258" r="5" fill="#7ccf7a"/><circle cx="138" cy="264" r="6" fill="#7ccf7a"/>' +
    '<ellipse data-region="hi" cx="158" cy="280" rx="18" ry="15" fill="#7ccf7a"/>' +
    '</svg>';
  mapGame({
    id: "usa-map", icon: "🇺🇸", title: "USA Map", skill: "the states of the USA [W]",
    map: "USA_MAP", svg: USA_SVG, rounds: 6,
    caption: (z) => "Tap " + z.say + "!",
    ask: (z) => z.ask,
    found: (z) => "That's " + z.say + "!",
    wrong: (z, t) => "That's " + z.say + ". " + t.ask,
    done: "You can read the map of the USA!",
  });

  // China: the Great Wall across the north, Beijing at its east end, Shanghai
  // on the coast south of it, the panda forests inland to the west, and Mount
  // Everest on the far south-west edge.
  const CHINA_SVG = '<svg viewBox="0 0 280 320" preserveAspectRatio="none" width="100%" height="100%">' +
    '<rect data-region="sea" width="280" height="320" fill="#8fd3ff"/>' +
    '<path data-region="land" d="M20 120 C40 90 70 70 110 60 C140 40 170 30 200 34 L230 20 L262 40 L256 70 L236 84 L232 104 L246 120 L244 150 L254 190 L240 230 L208 252 L170 262 L130 250 L90 268 L60 286 L24 284 L14 200 L20 160 Z" fill="#f2d98c" stroke="#a88a45" stroke-width="2"/>' +
    '<path data-region="wall" d="M58 62 L120 46 L200 40 L214 52 L200 58 L120 64 L62 76 Z" fill="#b5835a"/>' +
    '<ellipse data-region="pandas" cx="140" cy="211" rx="36" ry="28" fill="#6fbf5e"/>' +
    '<path data-region="everest" d="M45 222 L74 282 L16 282 Z" fill="#8c9aa3"/><path d="M45 222 L55 244 L35 244 Z" fill="#ffffff"/>' +
    '<circle data-region="beijing" cx="224" cy="122" r="18" fill="#e05a4f"/>' +
    '<circle data-region="shanghai" cx="238" cy="211" r="17" fill="#e05a4f"/>' +
    '</svg>';
  mapGame({
    id: "china-map", icon: "🧱", title: "China Map", skill: "places in China [W]",
    map: "CHINA_MAP", svg: CHINA_SVG,
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
            // a choice is a FLAG (Where in the World?) or a THING (Flag Friends)
            const o = ch.country, thing = cfg.pick === "thing";
            const b = api.el("button", {
              class: "choice " + (thing ? "choice--thing" : "choice--flag") + " tap", type: "button", text: thing ? o.thing : o.flag,
              dataset: ch.correct ? { correct: "1" } : {}, aria: { label: thing ? o.thingName : "the flag of " + o.name },
            });
            b.addEventListener("click", () => {
              if (!ch.correct) { api.tryAgain(b); api.say(thing ? "That's " + o.thingName + ", from " + o.name + "." : "That's the flag of " + o.name + "."); return; }
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
