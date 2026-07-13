// Gentle cause->effect toys (confidence / calm). No win state — pure play.
(function () {
  const F = window.JoshFramework;
  if (!F) return;

  // "Say hi to the animals" — tap the giant card: it celebrates and a brand-new
  // animal pops in (never the same twice in a row). No wrong move, no timer.
  F.register({
    id: "animals",
    icon: "🐾",
    title: "Hi, Animals!",
    skill: "hello / confidence [M]",
    start(api) {
      const C = api.C;
      let idx = api.randInt(0, C.ANIMALS.length - 1);
      api.setPrompt("Tap the animal to say hi!", ["👉", "🐾", "🎉"]);

      const emoji = api.el("span", { class: "animal__emoji", aria: { hidden: "true" } });
      const name = api.el("span", { class: "animal__name" });
      const card = api.el("button", {
        class: "animal-card tap", type: "button",
        dataset: { toy: "1" }, aria: { label: "animal" },
      }, [emoji, name]);

      function show(i) {
        emoji.textContent = C.ANIMALS[i].emoji;
        name.textContent = C.ANIMALS[i].name;
        card.setAttribute("aria-label", C.ANIMALS[i].name);
      }
      show(idx);

      card.addEventListener("click", () => {
        api.tickPlay();
        api.roundWin();
        idx = api.pickIndex(C.ANIMALS.length, idx);
        show(idx);
        api.say(C.ANIMALS[idx].name);
        card.classList.remove("pop");
        void card.offsetWidth;
        card.classList.add("pop");
      });

      api.stage.appendChild(card);
    },
  });
})();
