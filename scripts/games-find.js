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

      // The heroes are drawn as original masked-hero art (red = Spidey, pink =
      // Ghost-Spider, blue = Spin); "find all the red ones" is a colour search.
      const HERO_COLORS = (C.HEROES || []).map((h) => h.color).filter(Boolean);
      const POOL = HERO_COLORS.length >= 3 ? HERO_COLORS : ["#e23636", "#ec4e9c", "#2b6cff"];
      const heroArt = (c) => (window.JoshArt && window.JoshArt.hero) ? window.JoshArt.hero(c) : "🕷️";
      function newRound() {
        const size = 9 + round * 2; // harder each round
        const r = L.makeFindHero(POOL, size);
        need = r.count; found = 0;
        target.innerHTML = "";
        target.append(
          api.el("span", { class: "find__targetArt art-fill", aria: { hidden: "true" }, html: heroArt(r.target) }),
          api.el("span", { class: "find__targetLabel", text: "Find " + r.count + "!" })
        );
        api.setPrompt("Find all " + r.count + " of these heroes!", ["👀", "🕷️", "👆"]);
        api.speak();
        field.innerHTML = "";
        r.cells.forEach((cell) => {
          const b = api.el("button", {
            class: "find__cell find__cell--art tap", type: "button",
            html: '<span class="find__cellArt art-fill" aria-hidden="true">' + heroArt(cell.emoji) + "</span>",
            dataset: cell.correct ? { correct: "1" } : {}, aria: { label: "hero" },
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
        // Do NOT clear the reveal here: the previous round set it and it fades on
        // its own (CSS). Clearing synchronously would wipe it before it ever paints.
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
                reveal.textContent = rv;
                reveal.classList.remove("dot__reveal--on"); void reveal.offsetWidth; reveal.classList.add("dot__reveal--on");
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

      // Pups are drawn as original rescue-pup art with each one's signature COLLAR
      // colour, so the scene has visibly different pups to count (not identical 🐶).
      const pupArt = (c) => (window.JoshArt && window.JoshArt.pup) ? window.JoshArt.pup(c) : "🐶";
      function newRound() {
        const PUPS = C.PUPS || [{ name: "Pup", job: "🚒", collar: "#e23636" }];
        const pup = api.randItem(PUPS);
        const others = PUPS.filter((p) => p.collar !== pup.collar);
        const K = api.randInt(2, 5);
        const total = 12 + round * 2;
        const cells = [];
        for (let i = 0; i < K; i++) cells.push(pup.collar);
        for (let i = 0; i < total - K; i++) cells.push((api.randItem(others) || pup).collar);
        const scene = L.shuffle(cells);
        const used = new Set([K]); const wrongs = [];
        while (wrongs.length < 2) { const w = api.randInt(1, 9); if (!used.has(w)) { used.add(w); wrongs.push(w); } }
        const chs = L.shuffle([{ n: K, correct: true }, ...wrongs.map((n) => ({ n, correct: false }))]);

        target.innerHTML = "";
        target.append(api.el("span", { class: "find__targetArt art-fill", aria: { hidden: "true" }, html: pupArt(pup.collar) }), api.el("span", { class: "find__targetLabel", text: pup.name }));
        api.setPrompt("How many " + pup.name + " pups can you find?", ["👀", "🐶", pup.job]);
        api.speak();
        field.innerHTML = "";
        scene.forEach((c) => field.appendChild(api.el("span", { class: "find__dot find__dot--art art-fill", aria: { hidden: "true" }, html: pupArt(c) })));
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

  // ---- Web Rescue Reveal: clear the webs to free the trapped friends ----
  // A find game with occlusion: every cell is web-covered, some hide a friend.
  // Tapping reveals what's underneath — an empty puff (no-fail) or a rescue.
  F.register({
    id: "web-reveal",
    icon: "🕸️",
    title: "Web Rescue",
    skill: "visual search / reveal",
    start(api) {
      const C = api.C;
      const ROUNDS = 5;
      let round = 0, need = 0, freed = 0;
      const target = api.el("div", { class: "find__target" });
      const field = api.el("div", { class: "find__field" });
      api.stage.append(target, field);

      function newRound() {
        const size = 9 + round; // 9 → 13
        const r = L.makeWebRescue(C.RESCUE_POOL, size);
        need = r.count; freed = 0;
        target.innerHTML = "";
        target.append(
          api.el("span", { class: "find__targetEmoji", text: "🕸️" }),
          api.el("span", { class: "find__targetLabel", text: "Free " + r.count + "!" })
        );
        api.setPrompt("Tap the webs to free your friends!", ["👆", "🕸️", "🐾"]);
        api.speak();
        field.innerHTML = "";
        r.cells.forEach((cell) => {
          const b = api.el("button", {
            class: "find__cell web__cell tap", type: "button", text: "🕸️",
            dataset: cell.correct ? { correct: "1" } : {}, aria: { label: "web" },
          });
          b.addEventListener("click", () => {
            if (b.dataset.done) return;
            b.dataset.done = "1"; b.classList.add("web__cell--open");
            if (cell.correct) {
              delete b.dataset.correct; b.textContent = cell.friend;
              freed += 1; api.say("Rescued!");
              if (freed >= need) { round += 1; if (round >= ROUNDS) api.win({ say: "You freed all your friends! Hooray!" }); else { api.roundWin(); newRound(); } }
            } else {
              b.textContent = "✨"; // an empty web — no-fail, just a puff
            }
          });
          field.appendChild(b);
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
        // Show a meta category icon PLUS three example members ("find things LIKE
        // these"), so a non-reader reads it as a whole group, not one exact emoji.
        const cat = (C.FIND_CATEGORIES || []).find((c) => c.id === r.catId);
        const egs = cat ? cat.items.slice(0, 3) : [];
        target.innerHTML = "";
        target.append(
          api.el("span", { class: "find__targetEmoji", text: r.catIcon }),
          api.el("span", { class: "find__targetLabel", text: "Find them all!" }),
          api.el("span", { class: "find__egs", aria: { hidden: "true" } }, egs.map((e) => api.el("span", { class: "find__eg", text: e })))
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

  // ---- 🔎 Letter Hunt (pop every balloon with the target letter) ----
  // Letter recognition as a hunt: a sky of letter balloons; pop each one that
  // matches. Once Josh is ramping, lowercase twins sneak in (B and b are the
  // same letter — the core case-pairing insight).
  F.register({
    id: "letter-hunt",
    icon: "🎈",
    title: "Letter Hunt",
    skill: "letter recognition [M→W]",
    start(api) {
      const ROUNDS = 3;
      let round = 0, lastTarget = null, need = 0;
      const targetEl = api.el("div", { class: "lh__target" });
      const field = api.el("div", { class: "lh__field" });
      api.stage.append(targetEl, field);

      function newRound() {
        const r = L.makeLetterHunt(C.HUNT_LETTERS, undefined, { lastTarget, mixCase: api.shouldRamp(2) });
        lastTarget = r.target;
        need = r.need;
        api.setPrompt("Pop every " + r.target + " balloon!", ["🔎", "🎈", r.target]);
        api.speak(); api.say("Pop every balloon with " + r.target + "!");
        targetEl.textContent = r.target;
        field.innerHTML = "";
        r.cells.forEach((cell) => {
          const b = api.el("button", {
            class: "lh__balloon tap", type: "button",
            dataset: cell.correct ? { correct: "1" } : {}, aria: { label: cell.ch },
          }, [cell.ch]);
          b.addEventListener("click", () => {
            if (!cell.correct) { api.tryAgain(b); return; }
            if (b.dataset.done) return;
            b.dataset.done = "1"; delete b.dataset.correct;
            b.classList.add("lh__balloon--pop");
            api.say(cell.ch === cell.ch.toLowerCase() ? "Little " + r.target + "!" : r.target + "!");
            need -= 1;
            if (need <= 0) {
              round += 1;
              if (round >= ROUNDS) api.win({ say: "You found every letter!" });
              else { api.roundWin(); newRound(); }
            }
          });
          field.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Number Hunt (letter-hunt's numeral sibling) [M→W] ----
  F.register({
    id: "number-hunt",
    icon: "🎈",
    title: "Number Hunt",
    skill: "numeral recognition [M→W]",
    start(api) {
      const ROUNDS = 3;
      let round = 0, lastTarget = null, need = 0;
      const targetEl = api.el("div", { class: "lh__target" });
      const field = api.el("div", { class: "lh__field" });
      api.stage.append(targetEl, field);
      function newRound() {
        const ramp = api.shouldRamp(2);
        const lo = ramp ? 7 : 1, hi = ramp ? 19 : 9;
        const pool = []; for (let n = lo; n <= hi; n++) pool.push(String(n));
        const r = L.makeLetterHunt(pool, undefined, { lastTarget, mixCase: false });
        lastTarget = r.target; need = r.need;
        api.setPrompt("Pop every " + r.target + " balloon!", ["🔎", "🎈", r.target]);
        api.speak(); api.say("Pop every balloon with the number " + r.target + "!");
        targetEl.textContent = r.target;
        field.innerHTML = "";
        r.cells.forEach((cell) => {
          const b = api.el("button", {
            class: "lh__balloon tap", type: "button",
            dataset: cell.correct ? { correct: "1" } : {}, aria: { label: cell.ch },
          }, [cell.ch]);
          b.addEventListener("click", () => {
            if (!cell.correct) { api.tryAgain(b); return; }
            if (b.dataset.done) return;
            b.dataset.done = "1"; delete b.dataset.correct; b.classList.add("lh__balloon--pop");
            api.say(r.target + "!");
            need -= 1;
            if (need <= 0) { round += 1; if (round >= ROUNDS) api.win({ say: "You found every number!" }); else { api.roundWin(); newRound(); } }
          });
          field.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Star Search (a cozy space hunt; found stars light a constellation) [M] ----
  F.register({
    id: "star-search",
    icon: "🌟",
    title: "Star Search",
    skill: "visual search / space [M]",
    start(api) {
      const ROUNDS = 3;
      let round = 0, need = 0;
      const grid = api.el("div", { class: "star__field" });
      api.stage.append(grid);
      function newRound() {
        const K = api.shouldRamp(2) ? 4 : 3;
        const distract = (api.C.STAR_POOL || ["🌙", "🚀"]);
        const cells = api.shuffle([
          ...Array.from({ length: K }, () => ({ emoji: "⭐", correct: true })),
          ...Array.from({ length: 9 - K }, () => ({ emoji: api.randItem(distract), correct: false })),
        ]);
        need = K;
        api.setPrompt("Find and tap all the stars!", ["🌟", "👀", "👆"]);
        api.speak();
        grid.classList.remove("star__field--constellation");
        grid.innerHTML = "";
        cells.forEach((cell) => {
          const b = api.el("button", {
            class: "choice star__cell tap", type: "button",
            dataset: cell.correct ? { correct: "1" } : {}, aria: { label: cell.correct ? "star" : "not a star" },
          }, [cell.emoji]);
          b.addEventListener("click", () => {
            if (!cell.correct) { api.tryAgain(b); return; }
            if (b.dataset.done) return;
            b.dataset.done = "1"; delete b.dataset.correct; b.classList.add("star__cell--lit");
            api.say("Star!");
            need -= 1;
            if (need <= 0) {
              grid.classList.add("star__field--constellation");
              round += 1;
              if (round >= ROUNDS) api.win({ say: "You found every star! Look — a constellation!" });
              else { api.roundWin(); setTimeout(() => { if (grid.isConnected) newRound(); }, 700); }
            }
          });
          grid.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Whose Tracks? (infer the animal from its footprints) [W] ----
  // Each track TYPE maps to ONE animal, so the drawn track uniquely identifies
  // the answer among any three distinct-animal choices (no ambiguity).
  function trackSVG(type) {
    const stamp = {
      paw: '<g><circle cx="0" cy="14" r="7"/><circle cx="-9" cy="2" r="3.2"/><circle cx="-3" cy="-3" r="3.2"/><circle cx="3" cy="-3" r="3.2"/><circle cx="9" cy="2" r="3.2"/></g>',
      snake: '<path d="M-14 0 Q-7 -12 0 0 T14 0" stroke="#3a2417" stroke-width="4" fill="none" stroke-linecap="round"/>',
      // Deer: a CLOVEN print — two facing crescents (true to a deer, not a horse).
      hoof: '<g fill="none" stroke="#3a2417" stroke-width="4"><path d="M-9 -8 A8 10 0 0 0 -9 10"/><path d="M9 -8 A8 10 0 0 1 9 10"/></g>',
      // Duck: a WEBBED foot — a filled membrane fans between three toes, so it can
      // never read as a songbird's separate-toed track.
      web: '<g stroke="#3a2417" stroke-width="3" stroke-linecap="round"><polygon points="0,10 -10,-8 0,-11 10,-8" fill="#3a2417" opacity="0.5" stroke="none"/><path d="M0 10 L-10 -8 M0 10 L0 -11 M0 10 L10 -8" fill="none"/></g>',
      hop: '<g><circle cx="-6" cy="-6" r="5"/><circle cx="6" cy="-6" r="5"/><circle cx="-4" cy="9" r="3"/><circle cx="4" cy="9" r="3"/></g>',
      // Bear: a big pad with four long claw slashes above it.
      claw: '<g><ellipse cx="0" cy="11" rx="9" ry="7" fill="#3a2417"/><path d="M-9 -1 l-2 -8 M-3 -5 l-1 -9 M3 -5 l1 -9 M9 -1 l2 -8" stroke="#3a2417" stroke-width="3" stroke-linecap="round" fill="none"/></g>',
    };
    const one = stamp[type] || stamp.paw;
    let out = '<svg viewBox="0 0 300 90" role="img" aria-hidden="true" fill="#5a3a22">';
    for (let i = 0; i < 3; i++) out += '<g transform="translate(' + (60 + i * 90) + ',' + (30 + i * 8) + ')">' + one + "</g>";
    return out + "</svg>";
  }
  F.register({
    id: "whose-tracks",
    icon: "🐾",
    title: "Whose Tracks?",
    skill: "inference / animals [W]",
    start(api) {
      const ROUNDS = 4;
      let round = 0, lastIdx = -1, r = null;
      const items = (api.C.TRACKS || []).map((t) => ({ q: t.track, a: t.animal, name: t.name }));
      const scene = api.el("div", { class: "tracks__scene art-fill", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(scene, chips);
      function newRound() {
        r = L.makePairPick(items, undefined, lastIdx);
        lastIdx = r.idx;
        api.setPrompt("Who made these tracks?", ["🐾", "🤔", "👉"]);
        api.speak();
        scene.innerHTML = trackSVG(r.item.q);
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: "animal" },
          }, [ch.a]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            api.say("The " + r.item.name + " made those tracks!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "You're a great tracker!" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ================= Road to 140 — Wave 3 =================

  // ---- Which Has More? (count two kinds in one scene) ----
  // A pond mixes two kinds at different counts. Tap the KIND there are more of —
  // counting-and-compare where both groups share the same space.
  F.register({
    id: "more-in-scene",
    icon: "🦆",
    title: "More in the Pond",
    skill: "count & compare in a scene [W]",
    start(api) {
      const ROUNDS = 4;
      let round = 0, last = -1;
      const pond = api.el("div", { class: "more__pond", aria: { hidden: "true" } });
      const choices = api.el("div", { class: "choices choices--2" });
      api.stage.append(pond, choices);
      function newRound() {
        const r = L.makeSceneCompare(api.C.SCENE_KINDS, undefined, last); last = r.idx;
        // Build a shuffled mix so neither kind is clustered (real counting).
        const mix = [];
        for (let i = 0; i < r.a.n; i++) mix.push(r.a.emoji);
        for (let i = 0; i < r.b.n; i++) mix.push(r.b.emoji);
        api.shuffle(mix);
        pond.innerHTML = "";
        mix.forEach((e) => pond.appendChild(api.el("span", { class: "more__item" }, [e])));
        api.setPrompt("Which are there more of?", [r.a.emoji, "❓", r.b.emoji]);
        api.speak();
        choices.innerHTML = "";
        [r.a, r.b].forEach((g, i) => {
          const b = api.el("button", {
            class: "choice more__choice tap", type: "button", text: g.emoji,
            dataset: i === r.answerIdx ? { correct: "1" } : {}, aria: { label: "more of these" },
          });
          b.addEventListener("click", () => {
            if (i !== r.answerIdx) { api.tryAgain(b); return; }
            api.say("Yes! There are more of those!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "Great counting!" }); else { api.roundWin(); newRound(); }
          });
          choices.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Little Detective (two-clue deduction) ----
  // Two clues — a KIND (🐾 animal / 🚦 goes) and a COLOR dot — narrow six unique
  // cards to exactly one. The scene self-checks: non-matching cards fade, so the
  // answer reveals itself even before Josh taps.
  F.register({
    id: "clue-hunt",
    icon: "🕵️",
    title: "Little Detective",
    skill: "two-clue deduction [W]",
    start(api) {
      const ROUNDS = 4;
      let round = 0;
      const KIND_ICON = { animal: "🐾", vehicle: "🚦" };
      const KIND_WORD = { animal: "animal", vehicle: "one that goes vroom" };
      const COLOR_DOT = { red: "🔴", blue: "🔵", green: "🟢" };
      const bar = api.el("div", { class: "clue__bar", aria: { hidden: "true" } });
      const grid = api.el("div", { class: "clue__grid choices choices--3" });
      api.stage.append(bar, grid);
      function newRound() {
        const r = L.makeClueHunt(api.C.CLUE_CARDS);
        const kind = r.clues[0].value, color = r.clues[1].value;
        bar.innerHTML = "";
        bar.appendChild(api.el("span", { class: "clue__card" }, [KIND_ICON[kind]]));
        bar.appendChild(api.el("span", { class: "clue__plus" }, ["+"]));
        bar.appendChild(api.el("span", { class: "clue__card" }, [COLOR_DOT[color]]));
        api.setPrompt("Find the one that matches BOTH clues!", [KIND_ICON[kind], COLOR_DOT[color], "🔍"]);
        api.speak();
        api.say("Find the " + color + " " + KIND_WORD[kind] + "!");
        grid.innerHTML = "";
        const btns = r.cards.map((card, i) => {
          const b = api.el("button", {
            class: "choice clue__pick tap", type: "button", text: card.emoji,
            dataset: i === r.answerIdx ? { correct: "1" } : {}, aria: { label: "clue card" },
          });
          b.addEventListener("click", () => {
            if (i !== r.answerIdx) { api.tryAgain(b); return; }
            api.say("Detective! You found it!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "Super detective!" }); else { api.roundWin(); newRound(); }
          });
          return b;
        });
        btns.forEach((b) => grid.appendChild(b));
        // Self-checking elimination (visual only; the answer never dims).
        setTimeout(() => { r.cards.forEach((c, i) => { if (c.kind !== kind) btns[i].classList.add("clue__pick--dim"); }); }, 650);
        setTimeout(() => { r.cards.forEach((c, i) => { if (c.color !== color) btns[i].classList.add("clue__pick--dim"); }); }, 1300);
      }
      newRound();
    },
  });

  // ================= Road to 180 — Set 2, Wave 5 =================
  // ---- Match Them All (face-up pair clearing — mechanic A, no memory load) ----
  // Same normative pick-and-place contract as set-table: held=null flags every
  // un-matched card; once a card is held, ONLY its twin holds the flag.
  F.register({
    id: "match-all",
    icon: "🧤",
    title: "Match Them All",
    skill: "matching pairs [M]",
    start(api) {
      const POOL = api.C.MATCH_PAIRS || ["🧤", "🧦", "🥤"];
      const ROUNDS = 3;
      let round = 0;
      const grid = api.el("div", { class: "choices choices--3 match__grid" });
      api.stage.append(grid);
      function newRound() {
        const picks = api.shuffle(POOL.slice()).slice(0, 3);
        const deck = api.shuffle(picks.reduce((a, e) => a.concat([e, e]), []));
        let held = null, matched = 0;
        grid.innerHTML = "";
        const cards = deck.map((e) => {
          const b = api.el("button", { class: "choice match__card tap", type: "button", dataset: { face: e }, aria: { label: "card" }, text: e });
          b.addEventListener("click", () => {
            if (b.dataset.done) return;
            if (held === b) { held = null; b.classList.remove("held"); reflag(); return; }
            if (!held) { held = b; b.classList.add("held"); reflag(); return; }
            if (b.dataset.face === held.dataset.face) {
              b.dataset.done = held.dataset.done = "1";
              b.classList.add("match__card--gone"); held.classList.add("match__card--gone");
              b.classList.remove("held"); held.classList.remove("held");
              b.disabled = held.disabled = true;
              held = null; matched += 1;
              api.say("Match!");
              if (matched >= picks.length) {
                round += 1;
                if (round >= ROUNDS) api.win({ say: "You matched them all!" }); else { api.roundWin(); newRound(); }
              } else reflag();
            } else api.tryAgain(b);
          });
          grid.appendChild(b); return b;
        });
        function reflag() {
          cards.forEach((c) => delete c.dataset.correct);
          if (held) {
            const twin = cards.find((c) => c !== held && !c.dataset.done && c.dataset.face === held.dataset.face);
            if (twin) twin.dataset.correct = "1";
          } else cards.forEach((c) => { if (!c.dataset.done) c.dataset.correct = "1"; });
        }
        api.setPrompt("Tap a card, then find its twin!", ["🧤", "🤝", "😊"]);
        api.speak();
        reflag();
      }
      newRound();
    },
  });

  // ================= Road to 180 — Set 2, Wave 6 =================
  // ---- Count the Animals (categorize-then-count: filter, THEN count) ----
  F.register({
    id: "category-count", icon: "🐾", title: "Count the Animals", skill: "categorize then count [W]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 4; let round = 0, last = -1;
      const CATNAME = { animals: "animals", vehicles: "cars and trucks", food: "foods", sky: "sky things" };
      const scene = api.el("div", { class: "catcount__scene", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(scene, chips);
      function newRound() {
        const r = L.makeCategoryCount(api.C.FIND_CATEGORIES, undefined, last); last = r.idx;
        const nm = CATNAME[r.cat.id] || r.cat.id;
        scene.innerHTML = "";
        r.cells.forEach((c) => scene.appendChild(api.el("span", { class: "catcount__item" }, [c.e])));
        api.setPrompt("How many " + nm + "?", [r.cat.icon, "🔢", "👀"]);
        api.speak(); api.say("How many " + nm + "?");
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", { class: "choice choice--num tap", type: "button", text: String(ch.n), dataset: ch.correct ? { correct: "1" } : {}, aria: { label: String(ch.n) } });
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            [...scene.children].forEach((el, i) => { if (r.cells[i] && r.cells[i].member) el.classList.add("catcount__item--hit"); });
            api.say(r.k + " " + nm + "!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "You counted them!" }); else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Find the Tiniest (size discrimination; uniform hit box, varying glyph) ----
  F.register({
    id: "smallest-hunt", icon: "🔎", title: "Find the Tiniest", skill: "size discrimination [M]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 4; let round = 0, lastAsk = null;
      const sky = api.el("div", { class: "choices choices--3 sizehunt__sky" });
      api.stage.append(sky);
      function newRound() {
        const r = L.makeSizePick(undefined, lastAsk); lastAsk = r.ask;
        api.setPrompt(r.ask === "biggest" ? "Tap the BIGGEST star!" : "Tap the TINIEST star!", [r.ask === "biggest" ? "⭐" : "✨", "👀", "👉"]);
        api.speak(); api.say(r.ask === "biggest" ? "Which star is the biggest?" : "Which star is the tiniest?");
        sky.innerHTML = "";
        r.sizes.forEach((sz, i) => {
          const b = api.el("button", { class: "choice sizehunt__star tap", type: "button", dataset: i === r.answerIdx ? { correct: "1" } : {}, aria: { label: "star" } }, [
            api.el("span", { class: "sizehunt__glyph", style: { fontSize: sz + "px" }, aria: { hidden: "true" } }, ["⭐"]),
          ]);
          b.addEventListener("click", () => {
            if (i !== r.answerIdx) { api.tryAgain(b); return; }
            api.say(r.ask === "biggest" ? "The biggest one!" : "The tiniest one!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "You have sharp eyes!" }); else { api.roundWin(); newRound(); }
          });
          sky.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Sandwich Shop (functional category — foods go in, silly things don't) ----
  F.register({
    id: "sandwich-shop", icon: "🥪", title: "Sandwich Shop", skill: "functional category [M]",
    start(api) {
      const ROUNDS = 3; let round = 0, lastIdx = -1;
      const tray = api.el("div", { class: "sandwich__tray", aria: { hidden: "true" } });
      const grid = api.el("div", { class: "choices choices--3 sandwich__grid" });
      api.stage.append(tray, grid);
      function newRound() {
        const sets = api.C.MEAL_SETS || [];
        let idx = api.randInt(0, sets.length - 1);
        if (sets.length > 1 && idx === lastIdx) idx = (idx + 1) % sets.length;
        lastIdx = idx;
        const set = sets[idx];
        const foods = set.foods.slice();
        const sillies = api.shuffle(set.sillies.slice()).slice(0, Math.max(0, 9 - foods.length));
        const cells = api.shuffle(foods.map((e) => ({ e, food: true })).concat(sillies.map((e) => ({ e, food: false }))));
        let found = 0;
        tray.innerHTML = "";
        api.setPrompt("Make " + set.name + " — find everything that goes in it!", ["🥪", "🔍", "😋"]);
        api.speak(); api.say("Find everything that goes in " + set.name + "!");
        grid.innerHTML = "";
        cells.forEach((c) => {
          const b = api.el("button", { class: "choice sandwich__cell tap", type: "button", text: c.e, dataset: c.food ? { correct: "1" } : {}, aria: { label: "food" } });
          b.addEventListener("click", () => {
            if (!c.food) { api.tryAgain(b); api.say("Silly! That doesn't go in " + set.name + "! Hee hee."); return; }
            if (!b.dataset.correct) return;
            delete b.dataset.correct; b.disabled = true; b.classList.add("sandwich__cell--got");
            tray.appendChild(api.el("span", { class: "sandwich__layer pop", aria: { hidden: "true" } }, [c.e]));
            found += 1;
            if (found >= foods.length) { round += 1; if (round >= ROUNDS) api.win({ say: "Yum! You made it!" }); else { api.roundWin(); newRound(); } }
          });
          grid.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ================= Road to 180 — Set 2, Wave 7 =================
  // ---- Treasure Hunt! (position words — a 3-clue arc; mechanic F-ish) ----
  F.register({
    id: "treasure-map", icon: "🗺️", title: "Treasure Hunt!", skill: "position words + listening [P]",
    start(api) {
      const L = window.JoshLogic;
      const SPOTS = api.C.TREASURE_SPOTS || [];
      const PREP = api.C.PREPOSITIONS || [];
      const chest = api.el("div", { class: "treasure__chest", aria: { hidden: "true" } }, ["🗺️"]);
      const grid = api.el("div", { class: "choices choices--4 treasure__grid" });
      api.stage.append(chest, grid);
      let used = [], shards = 0, cur = null;
      const btns = SPOTS.map((s, i) => {
        const b = api.el("button", { class: "choice treasure__spot tap", type: "button", text: s.emoji, aria: { label: s.name } });
        b.addEventListener("click", () => {
          if (!cur || i !== cur.correctIdx || !b.dataset.correct) { api.tryAgain(b); return; }
          delete b.dataset.correct; b.classList.add("treasure__spot--dug");
          chest.appendChild(api.el("span", { class: "treasure__shard pop", aria: { hidden: "true" } }, ["🧩"]));
          used.push(i); shards += 1;
          api.say("You found a piece of the map!");
          if (shards >= 3) { chest.textContent = "🧰"; chest.classList.add("pop"); api.win({ say: "X marks the spot — you found the treasure!" }); }
          else nextClue();
        });
        return b;
      });
      btns.forEach((b) => grid.appendChild(b));
      function nextClue() {
        cur = L.makeTreasureClue(SPOTS, PREP, undefined, used);
        btns.forEach((b, i) => { if (i === cur.correctIdx) b.dataset.correct = "1"; else delete b.dataset.correct; });
        api.setPrompt("Look " + cur.preposition.word + " " + cur.spot.name + "!", [cur.preposition.icon, cur.spot.emoji, "🔍"]);
        api.speak(); api.say("Look " + cur.preposition.word + " " + cur.spot.name + "!");
      }
      nextClue();
    },
  });
})();
