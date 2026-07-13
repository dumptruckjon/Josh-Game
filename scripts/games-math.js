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

  // ---- Build a Number (Numberblock-style, counting/build [M/W]) ----
  F.register({
    id: "number-builder",
    icon: "🧱",
    title: "Build a Number",
    skill: "count & build [M/W]",
    start(api) {
      const C = api.C;
      const ROUNDS = 4;
      let round = 0, target = 0, count = 0;

      const targetEl = api.el("div", { class: "build__target", aria: { hidden: "true" } });
      const tower = api.el("div", { class: "build__tower" });
      const addBtn = api.el("button", { class: "btn-big", type: "button", dataset: { correct: "1" } }, ["➕ Add a block"]);
      const nextBtn = api.el("button", { class: "btn-big build__next", type: "button", hidden: "" }, ["Next ▶"]);
      api.stage.append(targetEl, tower, addBtn, nextBtn);

      function newRound() {
        target = api.randInt(1, 10);
        count = 0;
        tower.innerHTML = "";
        targetEl.textContent = target;
        addBtn.hidden = false;
        addBtn.dataset.correct = "1";
        api.setPrompt("Build the number " + target + "!", ["👀", "🧱", "🔢"]);
        api.speak();
      }

      addBtn.addEventListener("click", () => {
        if (count >= target) return;
        count += 1;
        const block = api.el("div", {
          class: "build__block pop",
          style: { background: C.BLOCK_COLORS[(count - 1) % C.BLOCK_COLORS.length] },
        }, [String(count)]);
        tower.insertBefore(block, tower.firstChild);
        api.say(String(count));
        if (count === target) {
          tower.insertBefore(api.el("div", { class: "build__face pop" }, ["😄"]), tower.firstChild);
          delete addBtn.dataset.correct;
          addBtn.hidden = true;
          round += 1;
          if (round >= ROUNDS) api.win({ say: "You built them all!" });
          else { api.roundWin(); nextBtn.hidden = false; nextBtn.dataset.correct = "1"; }
        }
      });
      nextBtn.addEventListener("click", () => {
        nextBtn.hidden = true;
        delete nextBtn.dataset.correct;
        newRound();
      });

      newRound();
    },
  });

  // ---- Skip-Count Hop (count by 2s / 5s / 10s, [W]) ----
  F.register({
    id: "skip-hop",
    icon: "🐸",
    title: "Hop & Count",
    skill: "count by 2s/5s [W]",
    start(api) {
      const C = api.C;
      const L = window.JoshLogic;
      const ROUNDS = 5;
      let round = 0;

      const path = api.el("div", { class: "hop__path" });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(path, choices);

      function newRound() {
        const step = api.randItem(C.SKIP_STEPS);
        const r = L.makeSkipCount(step, 5);
        api.setPrompt("Count by " + step + "s. Which is missing?", ["👀", "🐸", "❓"]);
        api.speak();

        path.innerHTML = "";
        r.sequence.forEach((v, i) => {
          const isQ = i === r.hideIndex;
          path.appendChild(api.el("span", { class: "hop__stone" + (isQ ? " hop__stone--q" : "") }, [isQ ? "❓" : String(v)]));
        });

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

  // ---- Take-Away (simple subtraction, [P]) ----
  F.register({
    id: "take-away",
    icon: "✋",
    title: "How Many Are Left?",
    skill: "subtraction [P]",
    start(api) {
      const C = api.C;
      const L = window.JoshLogic;
      const ROUNDS = 5;
      let round = 0;

      const scene = api.el("div", { class: "take__scene" });
      const eq = api.el("div", { class: "take__eq", aria: { hidden: "true" } });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(scene, eq, choices);

      function newRound() {
        const r = L.makeTakeAway();
        const obj = api.randItem(C.COUNT_OBJECTS);
        api.setPrompt("Some hop away. How many are left?", ["👀", "👋", "🔢"]);
        api.speak();

        scene.innerHTML = "";
        for (let i = 0; i < r.start; i++) {
          scene.appendChild(api.el("span", { class: "take__obj" + (i >= r.answer ? " take__obj--gone" : ""), text: obj }));
        }
        eq.textContent = r.start + " − " + r.minus + " = ?";

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

  // ---- Which Has More (compare quantities, [P]) ----
  F.register({
    id: "which-more",
    icon: "⚖️",
    title: "Which Has More?",
    skill: "compare quantities [P]",
    start(api) {
      const C = api.C;
      const L = window.JoshLogic;
      const ROUNDS = 5;
      let round = 0;

      const row = api.el("div", { class: "more__row" });
      api.stage.append(row);

      function panel(n, obj, correct) {
        const p = api.el("button", {
          class: "more__panel tap", type: "button",
          dataset: correct ? { correct: "1" } : {}, aria: { label: n + " things" },
        });
        for (let i = 0; i < n; i++) p.appendChild(api.el("span", { class: "more__dot", text: obj }));
        return p;
      }

      function newRound() {
        const r = L.makeCompare();
        const obj = api.randItem(C.COUNT_OBJECTS);
        api.setPrompt("Tap the side with MORE.", ["👀", "👉", "🔢"]);
        api.speak();
        row.innerHTML = "";
        const left = panel(r.a, obj, r.moreLeft);
        const right = panel(r.b, obj, !r.moreLeft);
        [left, right].forEach((p) => p.addEventListener("click", () => {
          if (p.dataset.correct) {
            p.classList.add("more__win");
            round += 1;
            if (round >= ROUNDS) api.win();
            else { api.roundWin(); newRound(); }
          } else api.tryAgain(p);
        }));
        row.append(left, right);
      }
      newRound();
    },
  });

  // ---- Coin Shop (money, brand-new [NA] — scaffold from zero) ----
  F.register({
    id: "coin-shop",
    icon: "🪙",
    title: "Penny Shop",
    skill: "money / coins [NEW]",
    start(api) {
      const C = api.C;
      const ROUNDS = 4;
      let round = 0, price = 0, paid = 0;

      const shop = api.el("div", { class: "coin__shop" });
      const jar = api.el("div", { class: "coin__jar" });
      const pile = api.el("div", { class: "coin__pile" });
      const nextBtn = api.el("button", { class: "btn-big", type: "button", hidden: "" }, ["Next ▶"]);
      api.stage.append(shop, jar, pile, nextBtn);

      function newRound() {
        price = api.randInt(1, 5);
        paid = 0;
        const sticker = api.randItem(C.STICKERS);
        shop.innerHTML = "";
        shop.append(
          api.el("div", { class: "coin__sticker coin__sticker--ghost", text: sticker }),
          api.el("div", { class: "coin__price", text: price + "¢" })
        );
        jar.innerHTML = "";
        for (let i = 0; i < price; i++) jar.appendChild(api.el("span", { class: "coin__slot", text: "⭕" }));
        pile.innerHTML = "";
        for (let i = 0; i < price; i++) {
          const penny = api.el("button", {
            class: "coin__penny tap", type: "button", text: "🪙",
            dataset: { correct: "1" }, aria: { label: "penny" },
          });
          penny.addEventListener("click", () => {
            if (penny.dataset.done) return;
            penny.dataset.done = "1";
            delete penny.dataset.correct;
            penny.classList.add("coin__penny--used");
            const slot = jar.children[paid];
            if (slot) slot.textContent = "🪙";
            paid += 1;
            api.say(paid + (paid === 1 ? " cent" : " cents"));
            if (paid === price) {
              const st = shop.querySelector(".coin__sticker");
              if (st) st.classList.remove("coin__sticker--ghost");
              round += 1;
              if (round >= ROUNDS) api.win({ say: "You bought them all!" });
              else { api.roundWin(); nextBtn.hidden = false; nextBtn.dataset.correct = "1"; }
            }
          });
          pile.appendChild(penny);
        }
        api.setPrompt("Pay " + price + (price === 1 ? " penny" : " pennies") + " to buy it!", ["👀", "🪙", "🛍️"]);
        api.speak();
      }
      nextBtn.addEventListener("click", () => {
        nextBtn.hidden = true;
        delete nextBtn.dataset.correct;
        newRound();
      });
      newRound();
    },
  });
})();
