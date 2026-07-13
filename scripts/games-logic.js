// Logic & reasoning games — a strong screen-native strand for Josh. Each keeps
// the test contract: the correct next tap carries data-correct; win sets won.
(function () {
  const F = window.JoshFramework;
  const L = window.JoshLogic;
  if (!F || !L) return;

  // ---- Odd One Out ----
  // Three pictures of one kind + one that doesn't belong. Tap the different one.
  F.register({
    id: "odd-one-out",
    icon: "🔎",
    title: "Which is Different?",
    skill: "logic (odd-one-out)",
    start(api) {
      const C = api.C;
      const ROUNDS = 5;
      let round = 0;

      const grid = api.el("div", { class: "choices choices--4" });
      api.stage.appendChild(grid);

      function newRound() {
        const { tiles } = L.makeOddOneOut(C.ODD_GROUPS);
        api.setPrompt("Tap the one that is different.", ["👀", "👉", "❓"]);
        api.speak();
        grid.innerHTML = "";
        tiles.forEach((t) => {
          const b = api.el("button", {
            class: "choice tap", type: "button", text: t.emoji,
            dataset: t.correct ? { correct: "1" } : {}, aria: { label: "picture" },
          });
          b.addEventListener("click", () => {
            if (t.correct) {
              round += 1;
              if (round >= ROUNDS) api.win();
              else { api.roundWin(); newRound(); }
            } else {
              api.tryAgain(b);
            }
          });
          grid.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- What Comes Next (patterns) ----
  // A repeating pattern with the next spot as a ❓. Tap the picture that fits.
  F.register({
    id: "what-next",
    icon: "➡️",
    title: "What Comes Next?",
    skill: "logic (patterns)",
    start(api) {
      const C = api.C;
      const ROUNDS = 5;
      let round = 0;
      const allTokens = [].concat.apply([], C.PATTERN_SETS);

      const seqEl = api.el("div", { class: "pattern__seq" });
      const choicesEl = api.el("div", { class: "choices choices--3" });
      api.stage.append(seqEl, choicesEl);

      function newRound() {
        const pair = api.randItem(C.PATTERN_SETS);
        const { sequence, choices } = L.makePattern(pair, allTokens);
        api.setPrompt("What comes next?", ["👀", "➡️", "❓"]);
        api.speak();

        seqEl.innerHTML = "";
        sequence.forEach((tok) => seqEl.appendChild(api.el("span", { class: "pattern__cell", text: tok })));
        seqEl.appendChild(api.el("span", { class: "pattern__cell pattern__q", text: "❓" }));

        choicesEl.innerHTML = "";
        choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice tap", type: "button", text: ch.token,
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: "choice" },
          });
          b.addEventListener("click", () => {
            if (ch.correct) {
              round += 1;
              if (round >= ROUNDS) api.win();
              else { api.roundWin(); newRound(); }
            } else {
              api.tryAgain(b);
            }
          });
          choicesEl.appendChild(b);
        });
      }
      newRound();
    },
  });
})();
