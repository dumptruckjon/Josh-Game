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
        const r = L.makeOrder(C.ORDER_POOL, 3);
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
          b.style.fontSize = (1.3 + it.rank * 0.8) + "rem";
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
})();
