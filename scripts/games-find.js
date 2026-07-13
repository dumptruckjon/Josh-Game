// Find-style games — Josh's favorite (he loves searching, the harder the
// better). Difficulty scales up each round (more to search). Plus Tic-Tac-Toe.
(function () {
  const F = window.JoshFramework;
  const L = window.JoshLogic;
  const C = window.JoshContent || {};
  if (!F || !L) return;

  // ---- Find the Heroes: tap every copy of the target hidden in the field ----
  F.register({
    id: "find-hero",
    icon: "🔎",
    title: "Find the Heroes",
    skill: "visual search",
    start(api) {
      const ROUNDS = 5;
      let round = 0, found = 0, need = 0;
      const target = api.el("div", { class: "find__target" });
      const field = api.el("div", { class: "find__field" });
      api.stage.append(target, field);

      function newRound() {
        const size = 9 + round * 2; // harder each round
        const r = L.makeFindHero(C.FIND_POOL, size);
        need = r.count; found = 0;
        target.innerHTML = "";
        target.append(
          api.el("span", { class: "find__targetEmoji", text: r.target }),
          api.el("span", { class: "find__targetLabel", text: "Find " + r.count + "!" })
        );
        api.setPrompt("Find all " + r.count + " of these!", ["👀", "🔎", "👆"]);
        api.speak();
        field.innerHTML = "";
        r.cells.forEach((cell) => {
          const b = api.el("button", {
            class: "find__cell tap", type: "button", text: cell.emoji,
            dataset: cell.correct ? { correct: "1" } : {}, aria: { label: "picture" },
          });
          b.addEventListener("click", () => {
            if (cell.correct && !b.dataset.done) {
              b.dataset.done = "1"; delete b.dataset.correct; b.classList.add("find__cell--found");
              found += 1; api.say(String(found));
              if (found >= need) { round += 1; if (round >= ROUNDS) api.win(); else { api.roundWin(); newRound(); } }
            } else if (!cell.correct) api.tryAgain(b);
          });
          field.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Spot the One: a crowd all the same but ONE — find the different one ----
  F.register({
    id: "find-crowd",
    icon: "🕵️",
    title: "Spot the One",
    skill: "visual search",
    start(api) {
      const ROUNDS = 5;
      let round = 0;
      const field = api.el("div", { class: "find__field" });
      api.stage.append(field);

      function newRound() {
        const size = 9 + round * 2;
        const r = L.makeCrowd(C.FIND_POOL, size);
        api.setPrompt("They're all the same but ONE. Find it!", ["👀", "🕵️", "👆"]);
        api.speak();
        field.innerHTML = "";
        r.cells.forEach((cell) => {
          const b = api.el("button", {
            class: "find__cell tap", type: "button", text: cell.emoji,
            dataset: cell.correct ? { correct: "1" } : {}, aria: { label: "picture" },
          });
          b.addEventListener("click", () => {
            if (cell.correct) { round += 1; if (round >= ROUNDS) api.win(); else { api.roundWin(); newRound(); } }
            else api.tryAgain(b);
          });
          field.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Count in the Scene: count the target in a busy field, tap the number ----
  F.register({
    id: "find-count",
    icon: "🧮",
    title: "Count Them All",
    skill: "count in a scene",
    start(api) {
      const ROUNDS = 5;
      let round = 0;
      const target = api.el("div", { class: "find__target" });
      const field = api.el("div", { class: "find__field find__field--dense" });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(target, field, choices);

      function newRound() {
        const r = L.makeFindCount(C.FIND_POOL, 12 + round * 2);
        target.innerHTML = "";
        target.append(
          api.el("span", { class: "find__targetEmoji", text: r.target }),
          api.el("span", { class: "find__targetLabel", text: "How many?" })
        );
        api.setPrompt("How many of these do you see?", ["👀", "🔢", "🧮"]);
        api.speak();
        field.innerHTML = "";
        r.cells.forEach((e) => field.appendChild(api.el("span", { class: "find__dot", text: e })));
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--num tap", type: "button", text: String(ch.n),
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: String(ch.n) },
          });
          b.addEventListener("click", () => {
            if (ch.correct) { round += 1; if (round >= ROUNDS) api.win(); else { api.roundWin(); newRound(); } }
            else api.tryAgain(b);
          });
          choices.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Tic-Tac-Toe (2 players, take turns; celebrate any win, no "you lose") ----
  F.register({
    id: "tic-tac-toe",
    icon: "⭕",
    title: "Tic-Tac-Toe (2 players)",
    skill: "co-op / strategy",
    start(api) {
      let friend = api.friend();
      if (friend.name === "Josh") friend = api.friend();
      const marks = ["🕷️", "🕸️"];
      const names = ["Josh", friend.name];
      let turn = 0, over = false;
      const board = ["", "", "", "", "", "", "", "", ""];

      const turnEl = api.el("div", { class: "coop__turn", aria: { live: "polite" } });
      const grid = api.el("div", { class: "ttt" });
      api.stage.append(turnEl, grid);
      const cells = [];

      function update() { turnEl.textContent = marks[turn] + " " + names[turn] + "’s turn!"; }
      function place(i) {
        if (over || board[i]) return;
        board[i] = marks[turn];
        cells[i].textContent = marks[turn];
        cells[i].classList.add("ttt__cell--set");
        delete cells[i].dataset.correct;
        const w = L.tttWinner(board);
        if (w) { over = true; cells.forEach((c) => delete c.dataset.correct); api.win({ say: names[turn] + " got three in a row! Yay!" }); return; }
        if (board.every(Boolean)) { over = true; api.win({ say: "Good game! Play again?" }); return; }
        turn = turn === 0 ? 1 : 0;
        update();
      }
      for (let i = 0; i < 9; i++) {
        const c = api.el("button", { class: "ttt__cell tap", type: "button", dataset: { correct: "1" }, aria: { label: "square" } });
        c.addEventListener("click", () => place(i));
        grid.appendChild(c); cells.push(c);
      }
      api.setPrompt("Take turns! Get three in a row.", ["🕷️", "🔁", "⭕"]);
      api.speak();
      update();
    },
  });
})();
