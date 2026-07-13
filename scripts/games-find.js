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

  // ---- Dot to Dot: tap the numbers 1..N in order to reveal a picture ----
  F.register({
    id: "dot-dot",
    icon: "✏️",
    title: "Dot to Dot",
    skill: "number order / reveal",
    start(api) {
      const ROUNDS = 3;
      let round = 0, step = 0, dots = [];
      const stage = api.el("div", { class: "trace__stage" });
      const reveal = api.el("div", { class: "dot__reveal", aria: { hidden: "true" } });
      stage.appendChild(reveal);
      api.stage.append(stage);

      function newRound() {
        const path = api.randItem(api.C.PATHS);
        const rv = api.randItem(api.C.REVEALS);
        step = 0; dots = [];
        reveal.textContent = ""; reveal.classList.remove("dot__reveal--on");
        api.setPrompt("Tap the numbers in order: 1, 2, 3…", ["👆", "🔢", "✨"]);
        api.speak();
        [...stage.querySelectorAll(".trace__dot, .trace__line")].forEach((n) => n.remove());

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("class", "trace__line");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.setAttribute("preserveAspectRatio", "none");
        const poly = document.createElementNS(svgNS, "polyline");
        poly.setAttribute("points", path.map((p) => p.x + "," + p.y).join(" "));
        poly.setAttribute("fill", "none"); poly.setAttribute("stroke", "#b7c6d6");
        poly.setAttribute("stroke-width", "2.5"); poly.setAttribute("stroke-dasharray", "5 4"); poly.setAttribute("stroke-linecap", "round");
        svg.appendChild(poly);
        stage.appendChild(svg);

        path.forEach((p, i) => {
          const dot = api.el("button", {
            class: "trace__dot tap", type: "button",
            dataset: i === 0 ? { correct: "1" } : {}, aria: { label: "dot " + (i + 1) },
          }, [String(i + 1)]);
          dot.style.left = p.x + "%"; dot.style.top = p.y + "%";
          dot.addEventListener("click", () => {
            if (i === step) {
              dot.classList.add("trace__dot--done");
              delete dot.dataset.correct;
              step += 1;
              if (step >= path.length) {
                reveal.textContent = rv; reveal.classList.add("dot__reveal--on");
                round += 1;
                if (round >= ROUNDS) api.win(); else { api.roundWin(); newRound(); }
              } else if (dots[step]) dots[step].dataset.correct = "1";
            } else api.tryAgain(dot);
          });
          stage.appendChild(dot); dots.push(dot);
        });
      }
      newRound();
    },
  });

  // ---- Paw Patrol Rescue: count how many of a pup you can find (homage) ----
  F.register({
    id: "rescue",
    icon: "🚒",
    title: "Paw Patrol Rescue",
    skill: "count / find",
    start(api) {
      const C = api.C;
      const ROUNDS = 5;
      let round = 0;
      const target = api.el("div", { class: "find__target" });
      const field = api.el("div", { class: "find__field find__field--dense" });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(target, field, choices);

      function newRound() {
        const pup = api.randItem(C.PUPS || [{ name: "Pup", emoji: "🐶", job: "🚒" }]);
        const K = api.randInt(2, 5);
        const others = (C.FIND_POOL || ["⭐"]).filter((e) => e !== pup.emoji);
        const total = 12 + round * 2;
        const cells = [];
        for (let i = 0; i < K; i++) cells.push(pup.emoji);
        for (let i = 0; i < total - K; i++) cells.push(api.randItem(others));
        const scene = L.shuffle(cells);
        const used = new Set([K]); const wrongs = [];
        while (wrongs.length < 2) { const w = api.randInt(1, 9); if (!used.has(w)) { used.add(w); wrongs.push(w); } }
        const chs = L.shuffle([{ n: K, correct: true }, ...wrongs.map((n) => ({ n, correct: false }))]);

        target.innerHTML = "";
        target.append(api.el("span", { class: "find__targetEmoji", text: pup.emoji }), api.el("span", { class: "find__targetLabel", text: pup.name }));
        api.setPrompt("How many " + pup.name + " pups can you find?", ["👀", "🐶", pup.job]);
        api.speak();
        field.innerHTML = "";
        scene.forEach((e) => field.appendChild(api.el("span", { class: "find__dot", text: e })));
        choices.innerHTML = "";
        chs.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--num tap", type: "button", text: String(ch.n),
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: String(ch.n) },
          });
          b.addEventListener("click", () => {
            if (ch.correct) { round += 1; if (round >= ROUNDS) api.win({ say: "Paw Patrol saved the day!" }); else { api.roundWin(); newRound(); } }
            else api.tryAgain(b);
          });
          choices.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- The Big Red One: find the one matching BOTH clues (color + shape) ----
  // Feature-conjunction search — genuinely harder (hold two attributes at once),
  // which Josh loves. Exactly one cell has the target color AND shape.
  F.register({
    id: "big-red-one",
    icon: "🎯",
    title: "The Big One",
    skill: "two-clue visual search [W]",
    start(api) {
      const COLORS = C.CONJ_COLORS || [{ name: "red", hex: "#e23636" }, { name: "blue", hex: "#2b6cff" }];
      const SHAPES = C.CONJ_SHAPES || [{ name: "circle", svg: '<circle cx="50" cy="50" r="40"/>' }];
      const ROUNDS = 5;
      let round = 0;
      const clue = api.el("div", { class: "conj__clue", aria: { live: "polite" } });
      const field = api.el("div", { class: "find__field" });
      api.stage.append(clue, field);

      function tile(cell, correct) {
        const shape = SHAPES.find((s) => s.name === cell.shape) || SHAPES[0];
        const color = COLORS.find((c) => c.name === cell.color) || COLORS[0];
        const b = api.el("button", {
          class: "find__cell conj__cell tap", type: "button",
          dataset: correct ? { correct: "1" } : {}, aria: { label: cell.color + " " + cell.shape },
          html: '<svg viewBox="0 0 100 100" style="fill:' + color.hex + '">' + shape.svg + "</svg>",
        });
        b.addEventListener("click", () => {
          if (correct) { round += 1; if (round >= ROUNDS) api.win({ say: "You found it!" }); else { api.roundWin(); newRound(); } }
          else api.tryAgain(b);
        });
        return b;
      }
      function newRound() {
        const size = 9 + round * 2;
        const r = L.makeConjunctionHunt(COLORS.map((c) => c.name), SHAPES.map((s) => s.name), size);
        const color = COLORS.find((c) => c.name === r.color);
        const shape = SHAPES.find((s) => s.name === r.shape);
        clue.innerHTML = "";
        clue.append(
          api.el("span", { class: "conj__swatch", style: { background: color.hex }, aria: { hidden: "true" } }),
          api.el("span", { class: "conj__plus" }, ["+"]),
          api.el("span", { class: "conj__shapeIcon art-fill", aria: { hidden: "true" }, html: '<svg viewBox="0 0 100 100" style="fill:#33445a">' + shape.svg + "</svg>" })
        );
        api.setPrompt("Find the one that matches BOTH!", ["👀", "🎯", "👆"]);
        api.speak();
        field.innerHTML = "";
        r.cells.forEach((cell) => field.appendChild(tile(cell, cell.correct)));
      }
      newRound();
    },
  });

  // ---- Find the Twins: everything is different except ONE matching pair ----
  // A brand-new find mechanic (vs copies-of-a-target / one-odd-in-a-crowd). Tap
  // one twin, then its match. The field grows each round (he loves it harder).
  F.register({
    id: "find-twins",
    icon: "👯",
    title: "Find the Twins",
    skill: "visual matching",
    start(api) {
      const ROUNDS = 5;
      let round = 0, firstPicked = null;
      const field = api.el("div", { class: "find__field" });
      api.stage.append(field);

      function newRound() {
        const size = 8 + round * 2; // 8 → 16
        const r = L.makeTwins(C.FIND_POOL, size);
        firstPicked = null;
        api.setPrompt("Find the TWO that are the same!", ["👀", "👯", "👆"]);
        api.speak();
        field.innerHTML = "";
        r.cells.forEach((cell) => {
          const b = api.el("button", {
            class: "find__cell tap", type: "button", text: cell.emoji,
            dataset: cell.correct ? { correct: "1" } : {}, aria: { label: "picture" },
          });
          b.addEventListener("click", () => {
            if (!cell.correct) { api.tryAgain(b); return; }
            if (b.dataset.done) return;
            if (!firstPicked) {
              // First twin chosen: lift it and wait for its partner. Remove its
              // data-correct so the harness taps the OTHER twin next.
              firstPicked = b;
              b.dataset.done = "1"; delete b.dataset.correct;
              b.classList.add("find__cell--found");
              api.say("One!");
            } else {
              // Second twin: match! Ribbon snap, round advances.
              b.classList.add("find__cell--found");
              delete b.dataset.correct;
              round += 1;
              if (round >= ROUNDS) api.win({ say: "You found the twins!" }); else { api.roundWin(); newRound(); }
            }
          });
          field.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- I Spy: Find Them All — tap EVERY picture in the named category ----
  F.register({
    id: "i-spy",
    icon: "🔦",
    title: "I Spy: Find Them All",
    skill: "sort in a scene / category",
    start(api) {
      const ROUNDS = 5;
      let round = 0, need = 0, got = 0;
      const target = api.el("div", { class: "find__target" });
      const field = api.el("div", { class: "find__field" });
      api.stage.append(target, field);

      function newRound() {
        const size = 9 + round * 2;
        const r = L.makeCategoryHunt(C.FIND_CATEGORIES, size);
        need = r.count; got = 0;
        target.innerHTML = "";
        target.append(
          api.el("span", { class: "find__targetEmoji", text: r.catIcon }),
          api.el("span", { class: "find__targetLabel", text: "Find them all!" })
        );
        api.setPrompt("Find all of these!", ["👀", r.catIcon, "👆"]);
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
              got += 1; api.say(String(got));
              if (got >= need) { round += 1; if (round >= ROUNDS) api.win(); else { api.roundWin(); newRound(); } }
            } else if (!cell.correct) api.tryAgain(b);
          });
          field.appendChild(b);
        });
      }
      newRound();
    },
  });
})();
