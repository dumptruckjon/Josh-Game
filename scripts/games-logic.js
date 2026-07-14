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
      api.mascot();

      function newRound() {
        // B#2 escalation: the first rounds are a category outlier (a rabbit among
        // bugs — easy). Later rounds keep the category constant and differ by ONE
        // feature (three arrows up, one down; three red, one blue) — real visual
        // discrimination instead of "spot the odd kind".
        const feature = round >= 2 && Array.isArray(C.ODD_FEATURES) && C.ODD_FEATURES.length;
        const r = feature ? L.makeOddFeature(C.ODD_FEATURES) : L.makeOddOneOut(C.ODD_GROUPS);
        api.setPrompt("Tap the one that is different.", ["👀", "👉", "❓"]);
        api.speak();
        grid.innerHTML = "";
        r.tiles.forEach((t) => {
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

  // ---- Shadow Match: tap the black silhouette that matches the bright shape ----
  // Uses distinct GEOMETRIC shapes (SVG) — a black star vs heart vs circle is
  // unmistakable, unlike emoji silhouettes which all look like the same blob.
  F.register({
    id: "shadow-match",
    icon: "🌓",
    title: "Match the Shadow",
    skill: "logic (silhouette match)",
    start(api) {
      const C = api.C;
      const ROUNDS = 5;
      let round = 0;
      const COLORS = C.CONFETTI_COLORS || ["#ff5e7e"];
      const target = api.el("div", { class: "shape shape--target", aria: { hidden: "true" } });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(target, choices);

      function shapeSvg(shape, fill) {
        return '<svg viewBox="0 0 100 100" style="fill:' + fill + '" aria-hidden="true">' + shape.svg + "</svg>";
      }
      function newRound() {
        const r = L.makeShadowMatch(C.SHAPES);
        api.setPrompt("Which shadow matches?", ["👀", "⬛", "❓"]);
        api.speak();
        target.innerHTML = shapeSvg(r.target, api.randItem(COLORS));
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--shape tap", type: "button", html: shapeSvg(ch.emoji, "#232838"),
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.emoji.name + " shadow" },
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

  // ---- Order by Size: tap the pictures from smallest to biggest ----
  F.register({
    id: "order-size",
    icon: "📏",
    title: "Small to Big",
    skill: "logic (sequencing / grading)",
    start(api) {
      const C = api.C;
      const ROUNDS = 5;
      let round = 0, need = 1, count = 3;
      const tray = api.el("div", { class: "choices choices--3" });
      api.stage.append(tray);

      function flagNext() {
        tray.querySelectorAll(".order__item").forEach((x) => {
          if (!x.dataset.done && Number(x.dataset.rank) === need) x.dataset.correct = "1";
          else if (!x.dataset.done) delete x.dataset.correct;
        });
      }
      function newRound() {
        // Grade more items as the rounds go on (3 → 4 → 5).
        const n = round < 2 ? 3 : (round < 4 ? 4 : 5);
        const r = L.makeOrder(C.ORDER_POOL, n);
        count = r.count; need = 1;
        api.setPrompt("Tap them from small to big!", ["👀", "🔼", "😊"]);
        api.speak();
        tray.innerHTML = "";
        r.items.forEach((it) => {
          const b = api.el("button", {
            class: "choice order__item tap", type: "button", text: r.emoji,
            dataset: it.rank === 1 ? { rank: String(it.rank), correct: "1" } : { rank: String(it.rank) },
            aria: { label: "size " + it.rank },
          });
          // Gentle size gradient that stays inside the button at any count.
          b.style.fontSize = (1.1 + it.rank * (2.6 / count)) + "rem";
          b.addEventListener("click", () => {
            if (b.dataset.done) return;
            if (Number(b.dataset.rank) === need) {
              b.dataset.done = "1"; delete b.dataset.correct; b.classList.add("order__item--done");
              need += 1;
              if (need > count) {
                round += 1;
                if (round >= ROUNDS) api.win(); else { api.roundWin(); newRound(); }
              } else flagNext();
            } else api.tryAgain(b);
          });
          tray.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Memory Match: find the pairs (his mastered puzzle love) ----
  // The next solvable pair is flagged data-correct for the test harness; those
  // attributes are invisible to the player (cards still show their backs).
  F.register({
    id: "memory",
    icon: "🃏",
    title: "Memory Match",
    skill: "puzzles / matching [M]",
    start(api) {
      const C = api.C;
      const PAIRS = 4;
      let first = null, lock = false, matched = 0, cards = [];
      const grid = api.el("div", { class: "memory-grid" });
      api.stage.append(grid);

      function syncFlags() {
        cards.forEach((c) => delete c.dataset.correct);
        if (first) {
          const m = cards.find((c) => c !== first && !c.dataset.matched && c.dataset.emoji === first.dataset.emoji);
          if (m) m.dataset.correct = "1";
        } else {
          const rem = cards.filter((c) => !c.dataset.matched);
          if (rem.length) {
            const e = rem[0].dataset.emoji;
            rem.filter((c) => c.dataset.emoji === e).forEach((c) => (c.dataset.correct = "1"));
          }
        }
      }
      function flip(card) {
        if (lock || card.dataset.matched || card === first || card.classList.contains("flipped")) return;
        card.classList.add("flipped");
        card.textContent = card.dataset.emoji;
        if (!first) { first = card; syncFlags(); return; }
        if (card.dataset.emoji === first.dataset.emoji) {
          card.dataset.matched = "1"; first.dataset.matched = "1";
          card.classList.add("matched"); first.classList.add("matched");
          first = null; matched += 1;
          syncFlags();
          api.roundWin();
          if (matched === PAIRS) api.win({ say: "You found them all!" });
        } else {
          lock = true;
          const a = first; first = null;
          setTimeout(() => {
            a.classList.remove("flipped"); a.textContent = "";
            card.classList.remove("flipped"); card.textContent = "";
            lock = false; syncFlags();
          }, 700);
        }
      }
      function build() {
        const pool = L.shuffle(C.MEMORY_EMOJIS).slice(0, PAIRS);
        const deck = L.shuffle([...pool, ...pool]);
        cards = []; first = null; lock = false; matched = 0;
        api.setPrompt("Find the matching pairs!", ["👀", "🃏", "🎉"]);
        api.speak();
        grid.innerHTML = "";
        deck.forEach((em) => {
          const card = api.el("button", { class: "memory-card tap", type: "button", dataset: { emoji: em }, aria: { label: "card" } }, [""]);
          card.addEventListener("click", () => flip(card));
          grid.appendChild(card);
          cards.push(card);
        });
        syncFlags();
      }
      build();
    },
  });

  // ---- Put in Order: tap the numbers 1, 2, 3… in order ([M]) ----
  F.register({
    id: "order-num",
    icon: "🔢",
    title: "Put in Order",
    skill: "number sequence [M]",
    start(api) {
      const ROUNDS = 5;
      let round = 0, step = 0, count = 4;
      const tray = api.el("div", { class: "choices choices--4" });
      api.stage.append(tray);

      function flagNext() {
        tray.querySelectorAll(".order__item").forEach((x) => {
          if (!x.dataset.done && Number(x.dataset.order) === step) x.dataset.correct = "1";
          else if (!x.dataset.done) delete x.dataset.correct;
        });
      }
      function newRound() {
        // Scale up: longer runs, and later rounds start higher (into the teens),
        // so it never plays the trivial always-"1-2-3-4" it used to.
        const len = round < 2 ? 4 : 5;
        const maxStart = round < 2 ? 6 : 15;
        const r = L.makeNumberSequence(len, maxStart);
        count = len; step = 0;
        api.setPrompt("Tap the numbers in order, smallest first!", ["👀", "🔢", "🔼"]);
        api.speak();
        tray.innerHTML = "";
        r.items.forEach((it) => {
          const b = api.el("button", {
            class: "choice choice--num order__item tap", type: "button", text: String(it.value),
            dataset: it.order === 0 ? { order: String(it.order), correct: "1" } : { order: String(it.order) },
            aria: { label: String(it.value) },
          });
          b.addEventListener("click", () => {
            if (b.dataset.done) return;
            if (Number(b.dataset.order) === step) {
              b.dataset.done = "1"; delete b.dataset.correct; b.classList.add("order__item--done");
              api.say(String(it.value));
              step += 1;
              if (step >= count) { round += 1; if (round >= ROUNDS) api.win(); else { api.roundWin(); newRound(); } }
              else flagNext();
            } else api.tryAgain(b);
          });
          tray.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- What Changed: compare two rows, tap the one that's different ----
  F.register({
    id: "spot-diff",
    icon: "🔀",
    title: "What Changed?",
    skill: "logic (spot the difference)",
    start(api) {
      const C = api.C;
      const ROUNDS = 5;
      let round = 0;
      const beforeRow = api.el("div", { class: "spot__row" });
      const label = api.el("div", { class: "spot__label" }, ["⬆️ look   ⬇️ tap what changed"]);
      const afterRow = api.el("div", { class: "choices choices--3" });
      api.stage.append(beforeRow, label, afterRow);

      function newRound() {
        const r = L.makeSpotDifference(C.SPOT_POOL, 3);
        api.setPrompt("One picture changed. Tap it!", ["👀", "🔀", "👉"]);
        api.speak();
        beforeRow.innerHTML = "";
        r.before.forEach((e) => beforeRow.appendChild(api.el("span", { class: "spot__cell", text: e })));
        afterRow.innerHTML = "";
        r.after.forEach((e, i) => {
          const b = api.el("button", {
            class: "choice spot__pick tap", type: "button", text: e,
            dataset: i === r.diffIndex ? { correct: "1" } : {}, aria: { label: "picture" },
          });
          b.addEventListener("click", () => {
            if (i === r.diffIndex) { round += 1; if (round >= ROUNDS) api.win(); else { api.roundWin(); newRound(); } }
            else api.tryAgain(b);
          });
          afterRow.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Who Is It? (multi-attribute deduction / "Guess-Who") ----
  // Six friendly heroes vary by COLOR and a held ITEM. Two positive clues
  // (a color + an item) always narrow to exactly one — real deduction, and
  // Josh loves a challenge. Round 1 auto-dims the ruled-out ones as a demo.
  F.register({
    id: "who-is-it",
    icon: "🕵️",
    title: "Who Is It?",
    skill: "deduction / attributes [W]",
    start(api) {
      const C = api.C;
      const COLORS = C.DEDUCE_COLORS || [{ key: "red", hex: "#e23636", dot: "🔴" }, { key: "blue", hex: "#2b6cff", dot: "🔵" }, { key: "green", hex: "#38b000", dot: "🟢" }];
      const ITEMS = C.DEDUCE_ITEMS || [{ key: "star", emoji: "⭐" }, { key: "ball", emoji: "🎈" }];
      const ROUNDS = 5;
      let round = 0;
      const clue = api.el("div", { class: "wi__clues", aria: { live: "polite" } });
      const grid = api.el("div", { class: "wi__grid" });
      api.stage.append(clue, grid);

      function newRound() {
        const r = L.makeDeduce(COLORS.map((c) => c.key), ITEMS.map((i) => i.key));
        const colorOf = (k) => COLORS.find((c) => c.key === k);
        const itemOf = (k) => ITEMS.find((i) => i.key === k);
        api.setPrompt("Find the one that matches BOTH clues!", ["👀", "🔎", "🕵️"]);
        api.speak();

        clue.innerHTML = "";
        clue.append(
          api.el("span", { class: "wi__clue" }, [colorOf(r.clueColor).dot]),
          api.el("span", { class: "wi__cluePlus" }, ["+"]),
          api.el("span", { class: "wi__clue" }, [itemOf(r.clueItem).emoji])
        );

        grid.innerHTML = "";
        r.characters.forEach((ch, idx) => {
          const col = colorOf(ch.color), it = itemOf(ch.item);
          const correct = idx === r.answerIndex;
          const card = api.el("button", {
            class: "wi__card tap", type: "button",
            dataset: correct ? { correct: "1" } : {}, aria: { label: "character" },
          }, [
            api.el("span", { class: "wi__hero art-fill", aria: { hidden: "true" }, html: (window.JoshArt && window.JoshArt.hero) ? window.JoshArt.hero(col.hex) : "🦸" }),
            api.el("span", { class: "wi__item", aria: { hidden: "true" } }, [it.emoji]),
          ]);
          // Round-1 demo: gently fade the ones ruled out by the clues.
          if (round === 0 && !correct) card.classList.add("wi__card--dim");
          card.addEventListener("click", () => {
            if (correct) {
              round += 1;
              if (round >= ROUNDS) api.win({ say: "You found the right one!" }); else { api.roundWin(); newRound(); }
            } else api.tryAgain(card);
          });
          grid.appendChild(card);
        });
      }
      newRound();
    },
  });

  // ---- Bird's-Eye Blocks (top-down spatial reasoning) ----
  // Look at the blocks from the side; pick the view from straight ABOVE (which
  // cells are covered). Height is a friendly distractor. Fills a working edge no
  // other game touches.
  F.register({
    id: "birds-eye",
    icon: "🚁",
    title: "Look From Above",
    skill: "top-down / spatial [W]",
    start(api) {
      const ROUNDS = 4;
      let round = 0;
      const scene = api.el("div", { class: "be__scene", aria: { hidden: "true" } });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(scene, choices);

      // One isometric cube with its top-center at (x,y).
      function cube(x, y) {
        const w = 16, h2 = 8, fh = 16;
        const top = (x) + "," + (y) + " " + (x + w) + "," + (y + h2) + " " + x + "," + (y + 2 * h2) + " " + (x - w) + "," + (y + h2);
        const left = (x - w) + "," + (y + h2) + " " + x + "," + (y + 2 * h2) + " " + x + "," + (y + 2 * h2 + fh) + " " + (x - w) + "," + (y + h2 + fh);
        const right = (x + w) + "," + (y + h2) + " " + x + "," + (y + 2 * h2) + " " + x + "," + (y + 2 * h2 + fh) + " " + (x + w) + "," + (y + h2 + fh);
        return '<polygon points="' + left + '" fill="#3f7fd6"/><polygon points="' + right + '" fill="#2b5fa8"/><polygon points="' + top + '" fill="#7db4ff"/>';
      }
      function drawScene(cells) {
        const w = 16, h2 = 8, fh = 16;
        // paint back cells (smaller r+c) first, bottom cube first
        const sorted = cells.slice().sort((a, b) => (a.r + a.c) - (b.r + b.c));
        let svg = "";
        sorted.forEach((cell) => {
          const bx = 60 + (cell.c - cell.r) * w;
          const by = 34 + (cell.c + cell.r) * h2;
          for (let i = 0; i < cell.h; i++) svg += cube(bx, by - i * fh);
        });
        scene.innerHTML = '<svg viewBox="0 0 120 120">' + svg + "</svg>";
      }
      function footprint(occ) {
        // Lay the 4 map cells out as a DIAMOND that matches the isometric scene's
        // screen positions (cell 0 = back/top, 1 = right, 2 = left, 3 = front/bottom),
        // so a block at the top of the scene lines up with the lit cell at the top
        // of the map — no 45° mental rotation for a 4-year-old.
        const pos = ["be__cell--n", "be__cell--e", "be__cell--w", "be__cell--s"];
        let g = "";
        for (let i = 0; i < 4; i++) {
          const on = occ.includes(i);
          g += '<span class="be__cell ' + pos[i] + (on ? " be__cell--on" : "") + '"></span>';
        }
        return '<span class="be__grid">' + g + "</span>";
      }
      function newRound() {
        const r = L.makeTopView();
        drawScene(r.cells);
        api.setPrompt("Which one is the view from above?", ["👀", "🚁", "⬇️"]);
        api.speak();
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice be__choice tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: "top view" },
            html: footprint(ch.occ),
          });
          b.addEventListener("click", () => {
            if (ch.correct) { round += 1; if (round >= ROUNDS) api.win({ say: "You saw it from above!" }); else { api.roundWin(); newRound(); } }
            else api.tryAgain(b);
          });
          choices.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Put the Story in Order (temporal sequencing) ----
  // Tap the pictures in the order they happen: first → next → last.
  F.register({
    id: "story-order",
    icon: "📖",
    title: "Put in Order",
    skill: "sequencing / what happens next [W]",
    start(api) {
      const C = api.C;
      const ROUNDS = 4;
      let round = 0, step = 0;
      const track = api.el("div", { class: "story__track" });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(track, choices);

      function newRound() {
        const r = L.makeStoryOrder(C.STORY_SEQUENCES);
        step = 0;
        api.setPrompt("What happens first, next, last?", ["1️⃣", "2️⃣", "3️⃣"]);
        api.speak();
        track.innerHTML = "";
        for (let i = 0; i < r.order.length; i++) track.appendChild(api.el("span", { class: "story__slot", aria: { hidden: "true" } }, [String(i + 1)]));
        choices.innerHTML = "";
        r.tiles.forEach((tile) => {
          const b = api.el("button", {
            class: "choice tap", type: "button", text: tile.emoji,
            dataset: tile.rank === 0 ? { correct: "1" } : {}, aria: { label: "picture" },
          });
          b.addEventListener("click", () => {
            if (tile.rank === step) {
              b.disabled = true; b.classList.add("choice--used"); delete b.dataset.correct;
              track.children[step].textContent = tile.emoji;
              step += 1;
              if (step >= r.tiles.length) {
                round += 1;
                if (round >= ROUNDS) api.win({ say: "You put the story in order!" }); else { api.roundWin(); newRound(); }
              } else {
                // promote the next-in-order tile to be the correct tap
                [...choices.children].forEach((c, idx) => {
                  if (!c.disabled && r.tiles[idx].rank === step) c.dataset.correct = "1"; else if (!c.disabled) delete c.dataset.correct;
                });
              }
            } else api.tryAgain(b);
          });
          choices.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Picture Squares (mini picture-sudoku / Latin square) ----
  // Each of 3 pictures appears once per row AND once per column. One cell is
  // blank — deduce which picture belongs there (row/column elimination).
  F.register({
    id: "picture-squares",
    icon: "🧩",
    title: "Picture Squares",
    skill: "deduction / sudoku [W]",
    start(api) {
      const C = api.C;
      const TRIOS = C.SQUARE_TRIOS || [["🍎", "🍌", "🍓"]];
      const QUADS = C.SQUARE_QUADS || [["🍎", "🍌", "🍓", "🍇"]];
      const ROUNDS = 4;
      let round = 0;
      const grid = api.el("div", { class: "sudoku__grid" });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(grid, choices);

      function newRound() {
        // Adaptive: ramp from a 3×3 to the harder 4×4 grid once Josh has it mastered.
        const n = api.shouldRamp(2) ? 4 : 3;
        const r = L.makeLatinSquare(api.randItem(n === 4 ? QUADS : TRIOS), undefined, n);
        api.setPrompt("Which picture is missing?", ["👀", "🧩", "❓"]);
        api.speak();
        grid.classList.toggle("sudoku__grid--4", n === 4);
        grid.innerHTML = "";
        for (let row = 0; row < n; row++) {
          for (let col = 0; col < n; col++) {
            const isBlank = row === r.blankR && col === r.blankC;
            grid.appendChild(api.el("span", {
              class: "sudoku__cell" + (isBlank ? " sudoku__cell--blank" : ""), aria: { hidden: "true" },
            }, [isBlank ? "" : r.grid[row][col]]));
          }
        }
        choices.className = "choices " + (n === 4 ? "choices--4" : "choices--3");
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice tap", type: "button", text: ch.sym,
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: "picture" },
          });
          b.addEventListener("click", () => {
            if (ch.correct) { round += 1; if (round >= ROUNDS) api.win({ say: "You solved it!" }); else { api.roundWin(); newRound(); } }
            else api.tryAgain(b);
          });
          choices.appendChild(b);
        });
      }
      newRound();
    },
  });
})();
