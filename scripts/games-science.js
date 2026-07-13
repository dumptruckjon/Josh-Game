// Science & sorting games — a fresh, confidence-building domain for Josh (his
// science skills are all mastered but under-used). One shared tap-to-sort
// mechanic, several category sets. Test contract kept (correct bin = data-correct).
(function () {
  const F = window.JoshFramework;
  const L = window.JoshLogic;
  const C = window.JoshContent || {};
  if (!F || !L) return;

  // Factory: build a "tap the right bin for this item" game from a config.
  function sorter(cfg) {
    F.register({
      id: cfg.id,
      icon: cfg.icon,
      title: cfg.title,
      skill: cfg.skill,
      start(api) {
        const ROUNDS = 6;
        let round = 0;
        const itemEl = api.el("div", { class: "sort__item", aria: { hidden: "true" } });
        const bins = api.el("div", { class: "sort__bins" });
        api.stage.append(itemEl, bins);

        function newRound() {
          // Later rounds use a harder set if provided (e.g. a 3-bin variant), so
          // a 2-way sorter stops being a 50/50 guess as it goes.
          const pool = (round >= 3 && cfg.hardSets) ? cfg.hardSets : cfg.sets;
          const set = api.randItem(pool);
          const r = L.makeSort(set);
          api.setPrompt(cfg.prompt, cfg.icons);
          api.speak();
          itemEl.textContent = r.item;
          itemEl.classList.remove("pop");
          void itemEl.offsetWidth;
          itemEl.classList.add("pop");
          bins.classList.toggle("sort__bins--3", r.bins.length === 3);
          bins.innerHTML = "";
          r.bins.forEach((b, i) => {
            const btn = api.el("button", {
              class: "sort__bin tap", type: "button",
              dataset: i === r.correctIndex ? { correct: "1" } : {}, aria: { label: b.label },
            }, [
              api.el("span", { class: "sort__binIcon", aria: { hidden: "true" }, text: b.emoji }),
              api.el("span", { class: "sort__binLabel", text: b.label }),
            ]);
            btn.addEventListener("click", () => {
              if (i === r.correctIndex) {
                btn.classList.add("sort__bin--hit");
                round += 1;
                if (round >= ROUNDS) api.win();
                else { api.roundWin(); newRound(); }
              } else api.tryAgain(btn);
            });
            bins.appendChild(btn);
          });
        }
        newRound();
      },
    });
  }

  sorter({ id: "science-sort", icon: "🔬", title: "Alive or Not?", skill: "science sort [M]", sets: C.SORT_SETS, prompt: "Where does it go?", icons: ["👀", "🔬", "👉"] });
  sorter({ id: "color-sort", icon: "🎨", title: "Sort the Colors", skill: "sort by color [M→W]", sets: C.COLOR_SETS, hardSets: C.COLOR_SETS_3, prompt: "Which color bin?", icons: ["👀", "🎨", "👉"] });
  sorter({ id: "law-sort", icon: "🌍", title: "Land, Air, Water", skill: "sort L/A/W [M]", sets: C.LAW_SETS, threeBins: true, prompt: "Land, air, or water?", icons: ["👀", "🌍", "👉"] });
  sorter({ id: "day-night", icon: "🌗", title: "Day or Night?", skill: "sort day/night [M]", sets: C.DAY_NIGHT_SETS, prompt: "Is it day or night?", icons: ["👀", "🌗", "👉"] });
  sorter({ id: "hot-cold", icon: "🌡️", title: "Hot or Cold?", skill: "sort hot/cold [M]", sets: C.HOT_COLD_SETS, prompt: "Is it hot or cold?", icons: ["👀", "🌡️", "👉"] });
  sorter({ id: "magnet-magic", icon: "🧲", title: "Will It Stick?", skill: "magnetic or not [M]", sets: C.MAGNET_SETS, prompt: "Will the magnet grab it?", icons: ["👀", "🧲", "👉"] });
  sorter({ id: "blue-planet", icon: "🌊", title: "Land or Water?", skill: "land & water [M]", sets: C.BLUE_PLANET_SETS, prompt: "Is it land or water?", icons: ["👀", "🌊", "👉"] });

  // ---- Shape's Real Twin: match a 3D solid to a real object of that shape ----
  // Geometry solids are one of Josh's working edges — and this diversifies the
  // science strand away from tap-a-bin sorters.
  F.register({
    id: "solid-match",
    icon: "🔺",
    title: "Shape's Real Twin",
    skill: "3D solids [W]",
    start(api) {
      const ROUNDS = 5;
      let round = 0;
      const solid = api.el("div", { class: "solid__shape art-fill", aria: { hidden: "true" } });
      const label = api.el("div", { class: "solid__label" });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(solid, label, choices);

      function newRound() {
        const r = L.makeSolidMatch(C.SOLID_SETS);
        solid.innerHTML = '<svg viewBox="0 0 100 100">' + r.svg + "</svg>";
        label.textContent = r.name;
        api.setPrompt("Which real thing is this shape?", ["👀", "🔺", "👆"]);
        api.speak();
        api.say(r.name);
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice tap", type: "button", text: ch.emoji,
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: "object" },
          });
          b.addEventListener("click", () => {
            if (ch.correct) { round += 1; if (round >= ROUNDS) api.win({ say: "That's the shape!" }); else { api.roundWin(); newRound(); } }
            else api.tryAgain(b);
          });
          choices.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Make an Island (landforms — a gentle [P] "build it, name it") ----
  // Tap the middle cells to raise the land; the shape completes, a picture
  // pops, and audio names the landform. Corners stay the base (water/land) so
  // the island/lake contrast is visible. Wrong (corner) taps are a soft bump.
  F.register({
    id: "landform-maker",
    icon: "🏝️",
    title: "Make an Island",
    skill: "landforms [P]",
    start(api) {
      const LFS = C.LANDFORMS || [];
      const ROUNDS = Math.min(4, LFS.length * 2 || 4);
      let round = 0, remaining = 0, current = null;
      const label = api.el("div", { class: "lf__label" });
      const wrap = api.el("div", { class: "lf__wrap" });
      const grid = api.el("div", { class: "lf__grid" });
      const reveal = api.el("div", { class: "lf__reveal", aria: { hidden: "true" } });
      wrap.append(grid, reveal);
      api.stage.append(label, wrap);

      function newRound() {
        current = LFS[round % LFS.length];
        const fillSet = new Set(current.fill);
        remaining = current.fill.length;
        label.textContent = "Make a " + current.name + "!";
        api.setPrompt("Make a " + current.name + "! Tap the middle.", ["👆", "🏝️", "😊"]);
        api.speak(); api.say("Make a " + current.name);
        grid.innerHTML = "";
        for (let i = 0; i < 9; i++) {
          const isTarget = fillSet.has(i);
          const cell = api.el("button", {
            class: "lf__cell tap", type: "button",
            dataset: isTarget ? { correct: "1" } : {}, aria: { label: isTarget ? "middle" : "edge" },
          }, [current.base]);
          cell.addEventListener("click", () => {
            if (!isTarget) { api.tryAgain(cell); return; }
            if (cell.dataset.done) return;
            cell.dataset.done = "1"; delete cell.dataset.correct;
            cell.textContent = current.tile; cell.classList.remove("pop"); void cell.offsetWidth; cell.classList.add("pop");
            remaining -= 1;
            if (remaining <= 0) {
              // Show the landform reveal and (re)start its fade — a fixed overlay
              // that the next round's grid rebuild does NOT clear.
              reveal.textContent = current.reveal;
              reveal.classList.remove("lf__reveal--on"); void reveal.offsetWidth; reveal.classList.add("lf__reveal--on");
              api.say(current.say);
              round += 1;
              if (round >= ROUNDS) api.win({ say: "You made all the landforms!" });
              else { api.roundWin(); newRound(); } // new grid ready instantly; reveal fades over it
            }
          });
          grid.appendChild(cell);
        }
      }
      newRound();
    },
  });

  // ---- Find the Shape (2D plane shapes → a real-world object) ----
  // Plane shapes / geometry cabinet is a working edge; this parallels the 3D
  // solid-match with flat shapes.
  F.register({
    id: "plane-shape",
    icon: "🔷",
    title: "Find the Shape",
    skill: "plane shapes [W]",
    start(api) {
      const ROUNDS = 5;
      let round = 0;
      const shapeEl = api.el("div", { class: "solid__shape art-fill", aria: { hidden: "true" } });
      const label = api.el("div", { class: "solid__label" });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(shapeEl, label, choices);

      function newRound() {
        const r = L.makeSolidMatch(C.PLANE_SHAPES);
        shapeEl.innerHTML = '<svg viewBox="0 0 100 100" style="fill:#5ec8ff;stroke:#2b6cff;stroke-width:2">' + r.svg + "</svg>";
        label.textContent = r.name;
        api.setPrompt("Which real thing is this shape?", ["👀", "🔷", "👆"]);
        api.speak(); api.say(r.name);
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice tap", type: "button", text: ch.emoji,
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: "object" },
          });
          b.addEventListener("click", () => {
            if (ch.correct) { round += 1; if (round >= ROUNDS) api.win({ say: "That's the shape!" }); else { api.roundWin(); newRound(); } }
            else api.tryAgain(b);
          });
          choices.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Animal Homes (single-continent identification — no on-map giveaway) ----
  // Harder than "Where Do They Live?": the animal is shown ALONE, and each chip
  // is a mini world-map with just ONE continent lit — so the child must actually
  // know where the animal lives, then find that continent's position.
  F.register({
    id: "continent-home",
    icon: "🗺️",
    title: "Animal Homes",
    skill: "continents / geography [W]",
    start(api) {
      const CONTS = C.CONTINENTS || [];
      const ROUNDS = 6;
      let round = 0;
      const animalEl = api.el("div", { class: "geo__animal", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(animalEl, chips);

      function miniMap(litIndex) {
        let blobs = "";
        CONTS.forEach((k, i) => {
          const on = i === litIndex;
          blobs += '<ellipse cx="' + k.cx + '" cy="' + k.cy + '" rx="' + k.rx + '" ry="' + k.ry + '" fill="' + (on ? k.color : "#cfd8e3") + '"' + (on ? ' stroke="#1b2b44" stroke-width="4"' : "") + "/>";
        });
        return '<svg viewBox="0 0 200 112">' + blobs + "</svg>";
      }
      function newRound() {
        const r = L.makeContinentMatch(CONTS);
        animalEl.textContent = r.animal;
        api.setPrompt("Where does it live? Find its home!", ["👀", "🗺️", "👆"]);
        api.speak();
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const idx = CONTS.findIndex((c) => c.name === ch.name);
          const b = api.el("button", {
            class: "choice geo__homeChip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.name }, html: miniMap(idx),
          });
          b.addEventListener("click", () => {
            if (ch.correct) { api.say(ch.name); round += 1; if (round >= ROUNDS) api.win({ say: "You know where they live!" }); else { api.roundWin(); newRound(); } }
            else api.tryAgain(b);
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Where Do They Live? (continents — his #1 geography working edge) ----
  // A friendly Montessori-colored world map. Each animal sits on its home
  // continent (self-checking); tap the chip whose color matches that continent.
  F.register({
    id: "continent-match",
    icon: "🌍",
    title: "Where Do They Live?",
    skill: "continents / geography [W]",
    start(api) {
      const CONTS = C.CONTINENTS || [];
      const ROUNDS = 6;
      let round = 0;
      const animalEl = api.el("div", { class: "geo__animal", aria: { hidden: "true" } });
      const mapWrap = api.el("div", { class: "geo__map", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(animalEl, mapWrap, chips);

      function drawMap(targetIndex) {
        let blobs = "";
        CONTS.forEach((k, i) => {
          const hl = i === targetIndex;
          blobs += '<ellipse cx="' + k.cx + '" cy="' + k.cy + '" rx="' + k.rx + '" ry="' + k.ry + '" fill="' + k.color + '"' +
            (hl ? ' stroke="#1b2b44" stroke-width="3"' : ' opacity="0.9"') + "/>";
          blobs += '<text x="' + k.cx + '" y="' + (k.cy + 3) + '" font-size="' + (hl ? 15 : 9) + '" text-anchor="middle">' + k.animal + "</text>";
        });
        mapWrap.innerHTML = '<svg viewBox="0 0 200 112"><rect x="0" y="0" width="200" height="112" rx="8" fill="#bfe9ff"/>' + blobs + "</svg>";
      }
      function newRound() {
        const r = L.makeContinentMatch(CONTS);
        drawMap(r.targetIndex);
        animalEl.textContent = r.animal;
        api.setPrompt("Where does it live? Tap its home!", ["👀", "🌍", "👆"]);
        api.speak();
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice geo__chip tap", type: "button", style: { background: ch.color },
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.name },
          });
          b.addEventListener("click", () => {
            if (ch.correct) { api.say(ch.name); round += 1; if (round >= ROUNDS) api.win({ say: "You know your continents!" }); else { api.roundWin(); newRound(); } }
            else api.tryAgain(b);
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });
})();
