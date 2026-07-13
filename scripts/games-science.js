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
        const bins = api.el("div", { class: "sort__bins" + (cfg.threeBins ? " sort__bins--3" : "") });
        api.stage.append(itemEl, bins);

        function newRound() {
          const set = api.randItem(cfg.sets);
          const r = L.makeSort(set);
          api.setPrompt(cfg.prompt, cfg.icons);
          api.speak();
          itemEl.textContent = r.item;
          itemEl.classList.remove("pop");
          void itemEl.offsetWidth;
          itemEl.classList.add("pop");
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
  sorter({ id: "color-sort", icon: "🎨", title: "Sort the Colors", skill: "sort by color [M]", sets: C.COLOR_SETS, prompt: "Which color bin?", icons: ["👀", "🎨", "👉"] });
  sorter({ id: "law-sort", icon: "🌍", title: "Land, Air, Water", skill: "sort L/A/W [M]", sets: C.LAW_SETS, threeBins: true, prompt: "Land, air, or water?", icons: ["👀", "🌍", "👉"] });
  sorter({ id: "day-night", icon: "🌗", title: "Day or Night?", skill: "sort day/night [M]", sets: C.DAY_NIGHT_SETS, prompt: "Is it day or night?", icons: ["👀", "🌗", "👉"] });
  sorter({ id: "hot-cold", icon: "🌡️", title: "Hot or Cold?", skill: "sort hot/cold [M]", sets: C.HOT_COLD_SETS, prompt: "Is it hot or cold?", icons: ["👀", "🌡️", "👉"] });
  sorter({ id: "magnet-magic", icon: "🧲", title: "Will It Stick?", skill: "magnetic or not [M]", sets: C.MAGNET_SETS, prompt: "Will the magnet grab it?", icons: ["👀", "🧲", "👉"] });

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
})();
