// Math games. Weighted to Josh's edges but this file opens with a confidence
// [M] counting game. Each game keeps the test contract (data-correct / won).
(function () {
  const F = window.JoshFramework;
  if (!F) return;

  // ---- Count & Feed (counting 1:1, [M] confidence) ----
  // Feed a hungry friend EXACTLY N snacks: tap each snack, count 1..N aloud, the
  // friend chomps. Control-of-error is concrete — exactly N snacks are present.
  F.register({
    id: "count-feed",
    icon: "🍎",
    title: "Count & Feed",
    skill: "counting 1-10 [M]",
    start(api) {
      const C = api.C;
      const ROUNDS = 4;
      let round = 0;

      const eaterEl = api.el("div", { class: "feed__eater", aria: { hidden: "true" } });
      const countEl = api.el("div", { class: "feed__count", aria: { live: "polite" } });
      const tray = api.el("div", { class: "feed__tray" });
      api.stage.append(eaterEl, countEl, tray);

      function newRound() {
        const eater = api.randItem(C.EATERS);
        const n = api.randInt(1, 8);
        const snack = api.randItem(C.SNACKS);
        let fed = 0;

        eaterEl.textContent = eater.emoji;
        countEl.textContent = "0 / " + n;
        api.setPrompt("Feed " + eater.name + " " + n + "!", ["👀", snack, "😋"]);
        api.speak();

        tray.innerHTML = "";
        for (let i = 0; i < n; i++) {
          const b = api.el("button", {
            class: "feed__snack tap", type: "button", text: snack,
            dataset: { correct: "1" }, aria: { label: "snack" },
          });
          b.addEventListener("click", () => {
            if (b.dataset.done) return;
            b.dataset.done = "1";
            delete b.dataset.correct;
            b.classList.add("eaten");
            fed += 1;
            countEl.textContent = fed + " / " + n;
            eaterEl.classList.remove("chomp");
            void eaterEl.offsetWidth;
            eaterEl.classList.add("chomp");
            api.say(String(fed));
            if (fed === n) {
              round += 1;
              if (round >= ROUNDS) {
                api.win({ say: "You fed everyone! Yay!" });
              } else {
                api.roundWin();
                newRound();
              }
            }
          });
          tray.appendChild(b);
        }
      }

      newRound();
    },
  });
})();
