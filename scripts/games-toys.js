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

      // Endless toy, but it's still collectible: after a few friendly hellos Josh
      // earns this game's sticker ONCE (api.win), then keeps playing forever. So
      // every tile in the Sticker Book can be filled — no permanently-empty slot.
      let hellos = 0, won = false;
      card.addEventListener("click", () => {
        api.tickPlay();
        idx = api.pickIndex(C.ANIMALS.length, idx);
        show(idx);
        card.classList.remove("pop");
        void card.offsetWidth;
        card.classList.add("pop");
        hellos += 1;
        if (hellos === 5 && !won) { won = true; api.win({ say: "You said hi to so many animals! Yay!" }); }
        else { api.roundWin(); api.say(C.ANIMALS[idx].name); }
      });

      api.stage.appendChild(card);
    },
  });
})();
