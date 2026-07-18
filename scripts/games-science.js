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
        api.mascot(); // a friendly buddy fills the space and reacts to each sort

        function newRound() {
          // Adaptive: once Josh has mastered the easy sort (a clean streak), a
          // harder set kicks in (e.g. a 3-bin variant), so it stops being a 50/50
          // guess — and it eases back to the simple set the moment he stumbles.
          const pool = (api.shouldRamp(2) && cfg.hardSets) ? cfg.hardSets : cfg.sets;
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
                // B#1: say WHY it belongs here, so a correct-by-guess tap still
                // teaches (turns a 50/50 into a little lesson).
                const why = set.bins[r.correctIndex] && set.bins[r.correctIndex].why;
                if (why) api.say(why);
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
  sorter({ id: "plant-animal", icon: "🌿", title: "Plant or Animal?", skill: "plant vs animal [M]", sets: C.PLANT_ANIMAL_SETS, prompt: "Is it a plant or an animal?", icons: ["👀", "🌿", "🐾"] });

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

  // ---- Make an Island (landforms — a gentle [P] "place it, name it") ----
  // A 3×3 top-down map that MATCHES the words: the whole grid starts as the
  // surround (all ocean for an island, all field for a lake) and Josh taps the
  // MIDDLE to place the feature — so the result is literally "land with water
  // ALL AROUND" (island) / "water with land all around" (lake). The middle is
  // the only correct tap ("Tap the middle" is now true); a tap on the water/
  // land around is a soft nudge, never a fail. When the feature lands, the
  // surround ripples ("…all around!"), a friendly picture pops ON the landform,
  // and audio names it. The reveal celebrates the landform you just made and
  // ONLY advances after it has played (so last round's picture never bleeds
  // onto the next round's grid — the old duck-over-mountain bug).
  const LF_CENTER = 4; // the middle of the 3×3 — the feature you place
  F.register({
    id: "landform-maker",
    icon: "🏝️",
    title: "Make an Island",
    skill: "landforms [P]",
    start(api) {
      const LFS = C.LANDFORMS || [];
      if (!LFS.length) return;
      const ROUNDS = 3; // island → lake → island (a short, gentle arc)
      let round = 0, current = null, revealIdx = 0;
      const label = api.el("div", { class: "lf__label" });
      const wrap = api.el("div", { class: "lf__wrap" });
      const grid = api.el("div", { class: "lf__grid" });
      const reveal = api.el("div", { class: "lf__reveal", aria: { hidden: "true" } });
      wrap.append(grid, reveal);
      api.stage.append(label, wrap);

      function newRound() {
        current = LFS[round % LFS.length];
        const a = L.article(current.name); // "a Island" → "an Island"
        label.textContent = "Make " + a + " " + current.name + "!";
        api.setPrompt("Make " + a + " " + current.name + "! Tap the middle.", ["👆", "🏝️", "😊"]);
        api.speak(); api.say("Make " + a + " " + current.name + ". Tap the middle.");
        grid.innerHTML = "";
        reveal.classList.remove("lf__reveal--on"); reveal.textContent = "";
        for (let i = 0; i < 9; i++) {
          const isCenter = i === LF_CENTER;
          const cell = api.el("button", {
            class: "lf__cell tap" + (isCenter ? " lf__cell--target" : ""), type: "button",
            dataset: isCenter ? { correct: "1" } : {},
            aria: { label: isCenter ? "middle" : "around" },
          }, [current.base]); // every cell starts as the surround (all around)
          cell.addEventListener("click", () => {
            if (!isCenter) { api.tryAgain(cell); return; } // the water/land around: gentle nudge to the middle
            if (cell.dataset.done) return;
            cell.dataset.done = "1"; delete cell.dataset.correct; cell.classList.remove("lf__cell--target");
            // Place the feature in the middle; the surround (already all around) ripples.
            cell.textContent = current.feature;
            cell.classList.remove("pop"); void cell.offsetWidth; cell.classList.add("pop");
            grid.querySelectorAll(".lf__cell").forEach((c, ci) => {
              if (ci === LF_CENTER) return;
              c.classList.remove("lf__around--pulse"); void c.offsetWidth; c.classList.add("lf__around--pulse");
            });
            // A friendly picture pops ON the landform + the spoken definition.
            reveal.textContent = current.reveals[revealIdx % current.reveals.length];
            revealIdx += 1;
            reveal.classList.remove("lf__reveal--on"); void reveal.offsetWidth; reveal.classList.add("lf__reveal--on");
            api.say(current.say);
            round += 1;
            if (round >= ROUNDS) { api.win({ say: "You made all the landforms!" }); return; }
            api.roundWin();
            // Let the reveal celebrate THIS landform, THEN build the next round.
            setTimeout(() => { if (grid.isConnected) newRound(); }, 1000);
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
        // The target continent is drawn BIG, bold and in its own colour; the
        // others recede to faint ghosts over a clear ocean — so the three choice
        // chips look obviously different (was: identical grey maps, one tiny dot).
        let blobs = '<rect x="0" y="0" width="200" height="112" rx="10" fill="#bfe4ff"/>';
        CONTS.forEach((k, i) => {
          if (i === litIndex) return; // faint ghosts first, lit one on top
          blobs += '<ellipse cx="' + k.cx + '" cy="' + k.cy + '" rx="' + k.rx + '" ry="' + k.ry + '" fill="#d3ddea"/>';
        });
        const k = CONTS[litIndex];
        if (k) {
          const rx = (k.rx * 1.2).toFixed(1), ry = (k.ry * 1.2).toFixed(1);
          blobs += '<ellipse cx="' + k.cx + '" cy="' + k.cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + k.color + '" stroke="#1b2b44" stroke-width="4"/>';
        }
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

  // ---- 🎨 Mix It! Paint Lab (real color mixing — cause→effect magic) ----
  // Pour pot A, pour pot B (the strict data-correct chain), the bowl swirls
  // into the NEW color, then "What did we make?" — 3 color choices, each a
  // real mixable color. Truth table lives in content.js MIXES.
  F.register({
    id: "color-mix",
    icon: "🎨",
    title: "Mix It!",
    skill: "color mixing [P]",
    start(api) {
      const A = window.JoshAudio || { say() {}, isMuted: () => true };
      const ROUNDS = 4;
      let round = 0, lastIdx = -1, r = null, step = 0;
      const bench = api.el("div", { class: "mix__bench" });
      const bowl = api.el("div", { class: "mix__bowl", aria: { hidden: "true" } });
      const choices = api.el("div", { class: "choices choices--3 mix__choices", hidden: "" });
      api.stage.append(bench, bowl, choices);

      const blip = (f, o) => { try { if (A.tone && A.isMuted && !A.isMuted()) A.tone(f, o); } catch (e) { /* ignore */ } };

      function newRound() {
        r = L.makeColorMix(C.MIXES, undefined, lastIdx);
        lastIdx = r.idx;
        step = 0;
        api.setPrompt("Pour the paints — what will they make?", ["🎨", "🫗", "🌈"]);
        api.speak(); api.say("Pour the " + r.mix.a.name + " paint!");
        bowl.style.background = "#eceff4";
        bowl.classList.remove("mix__bowl--swirl");
        bowl.textContent = "";
        choices.hidden = true;
        bench.innerHTML = "";
        // Either pot may be poured first (order can't be "wrong" — no-fail law);
        // data-correct simply rides whichever pot hasn't been poured yet so the
        // harness always has a valid next tap.
        [r.mix.a, r.mix.b].forEach((pot, i) => {
          const b = api.el("button", {
            class: "mix__pot tap", type: "button",
            dataset: i === 0 ? { correct: "1" } : {}, aria: { label: pot.name + " paint" },
          }, [api.el("span", { class: "mix__paint", style: { background: pot.hex }, aria: { hidden: "true" } })]);
          b.addEventListener("click", () => {
            if (b.dataset.done || step >= 2) return;
            b.dataset.done = "1"; delete b.dataset.correct;
            b.classList.add("mix__pot--poured");
            blip(i === 0 ? 392 : 494, { duration: 0.25, gain: 0.2 });
            if (step === 0) {
              step = 1;
              bowl.style.background = pot.hex; // first color fills the bowl
              const otherPot = [...bench.querySelectorAll(".mix__pot")].find((p) => !p.dataset.done);
              if (otherPot) otherPot.dataset.correct = "1";
              api.say("Now pour the " + (i === 0 ? r.mix.b.name : r.mix.a.name) + "!");
            } else {
              step = 2;
              bowl.style.background = r.mix.out.hex; // the mix reveals itself
              bowl.classList.add("mix__bowl--swirl");
              api.say("Look! What color did we make?");
              choices.hidden = false;
              choices.innerHTML = "";
              r.choices.forEach((ch) => {
                const cb = api.el("button", {
                  class: "choice mix__chip tap", type: "button",
                  dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.name },
                }, [api.el("span", { class: "mix__paint", style: { background: ch.hex }, aria: { hidden: "true" } })]);
                cb.addEventListener("click", () => {
                  if (!ch.correct) { api.tryAgain(cb); return; }
                  cb.classList.add("pop");
                  round += 1;
                  if (round >= ROUNDS) api.win({ say: r.mix.a.name + " and " + r.mix.b.name + " make " + r.mix.out.name + "! You're a paint scientist!" });
                  else { api.roundWin({ say: r.mix.a.name + " and " + r.mix.b.name + " make " + r.mix.out.name + "!" }); newRound(); }
                });
                choices.appendChild(cb);
              });
            }
          });
          bench.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- 🛁 Sink or Float? (predict → then SEE the answer — the science method) ----
  // Josh predicts by tapping ⬇️ or ⬆️; the item then plops into the tub and
  // sinks to the bottom or bobs on top — the water itself confirms the truth.
  F.register({
    id: "sink-float",
    icon: "🛁",
    title: "Sink or Float?",
    skill: "sink vs float [M] — predict & test",
    start(api) {
      const ROUNDS = 5;
      let round = 0, lastItem = null, r = null;
      const tub = api.el("div", { class: "tub", aria: { hidden: "true" } });
      const floater = api.el("span", { class: "tub__item" });
      const water = api.el("div", { class: "tub__water" });
      tub.append(floater, water);
      const bins = api.el("div", { class: "choices choices--3 tub__choices" });
      api.stage.append(tub, bins);

      function newRound() {
        r = L.makeSinkFloat(C.SINK_FLOAT_SET, undefined, lastItem);
        lastItem = r.item;
        api.setPrompt("Will it sink or float?", ["👀", "🛁", "🤔"]);
        api.speak();
        floater.textContent = r.item;
        floater.className = "tub__item"; // reset position (above the water)
        bins.innerHTML = "";
        [{ key: "sink", label: "Sinks", emoji: "⬇️" }, { key: "float", label: "Floats", emoji: "⬆️" }].forEach((opt) => {
          const b = api.el("button", {
            class: "choice tub__guess tap", type: "button",
            dataset: opt.key === r.answer ? { correct: "1" } : {}, aria: { label: opt.label },
          }, [opt.emoji]);
          b.addEventListener("click", () => {
            if (opt.key !== r.answer) { api.tryAgain(b); return; }
            if (bins.dataset.resolved) return; // this round's experiment already ran
            bins.dataset.resolved = "1";
            // Consume the answer so no stale correct-target lingers through the
            // splash animation (the harness must wait for the next round).
            for (const g of bins.querySelectorAll(".tub__guess")) g.removeAttribute("data-correct");
            // The experiment: drop it in and let the water show the answer.
            floater.classList.add(r.answer === "sink" ? "tub__item--sink" : "tub__item--float");
            api.say(r.why);
            round += 1;
            if (round >= ROUNDS) setTimeout(() => api.win({ say: "You tested them all, scientist!" }), 650);
            else { api.roundWin(); setTimeout(() => { delete bins.dataset.resolved; newRound(); }, 950); }
          });
          bins.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- 🐣 Mama & Baby (match each baby animal to its mama) ----
  F.register({
    id: "mama-baby",
    icon: "🐣",
    title: "Mama & Baby",
    skill: "baby animals [M]",
    start(api) {
      const ROUNDS = 4;
      let round = 0, lastIdx = -1, r = null;
      const babyEl = api.el("div", { class: "mb__baby", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(babyEl, chips);
      api.mascot();

      function newRound() {
        r = L.makeMamaBaby(C.MAMA_BABY, undefined, lastIdx);
        lastIdx = r.idx;
        api.setPrompt("Who is the mama?", ["🐣", "👀", "💞"]);
        api.speak(); api.say("I'm a " + r.pair.babyName + "! Where's my mama?");
        babyEl.textContent = r.pair.baby;
        babyEl.classList.remove("pop"); void babyEl.offsetWidth; babyEl.classList.add("pop");
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice mb__mama tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.name },
          }, [ch.emoji]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            // The nuzzle: baby hops over to its mama + hearts.
            b.classList.add("mb__mama--nuzzle");
            const heart = api.el("span", { class: "mb__heart", text: "💞", aria: { hidden: "true" } });
            b.appendChild(heart);
            setTimeout(() => heart.remove(), 1100);
            round += 1;
            if (round >= ROUNDS) api.win({ say: "Every baby found its mama!" });
            else { api.roundWin({ say: "The " + r.pair.babyName + "'s mama is the " + ch.name + "!" }); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });
})();
