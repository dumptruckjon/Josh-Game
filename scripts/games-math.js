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
          // The plain blocks morph into a friendly number-friend character.
          tower.innerHTML = "";
          tower.appendChild(api.el("div", {
            class: "build__friend pop",
            html: (window.JoshArt && window.JoshArt.numberFriend)
              ? window.JoshArt.numberFriend(target, C.BLOCK_COLORS[(target - 1) % C.BLOCK_COLORS.length])
              : "😄",
          }));
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

  // ---- Add It Up (combine two groups, [W]) ----
  F.register({
    id: "add-up",
    icon: "➕",
    title: "Add It Up",
    skill: "addition [W]",
    start(api) {
      const C = api.C;
      const L = window.JoshLogic;
      const ROUNDS = 5;
      let round = 0;
      const scene = api.el("div", { class: "add__scene" });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(scene, choices);

      function group(count, obj) {
        const g = api.el("div", { class: "add__group" });
        for (let i = 0; i < count; i++) g.appendChild(api.el("span", { class: "add__dot", text: obj }));
        return g;
      }
      function newRound() {
        const r = L.makeAddition();
        const obj = api.randItem(C.COUNT_OBJECTS);
        api.setPrompt("How many all together?", ["👀", "➕", "🔢"]);
        api.speak();
        scene.innerHTML = "";
        scene.append(group(r.a, obj), api.el("div", { class: "add__plus", text: "➕" }), group(r.b, obj));
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", { class: "choice choice--num tap", type: "button", text: String(ch.n), dataset: ch.correct ? { correct: "1" } : {}, aria: { label: String(ch.n) } });
          b.addEventListener("click", () => { if (ch.correct) { round += 1; if (round >= ROUNDS) api.win(); else { api.roundWin(); newRound(); } } else api.tryAgain(b); });
          choices.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Find the Number (numeral -> matching quantity, [M]) ----
  F.register({
    id: "number-match",
    icon: "🔢",
    title: "Find the Number",
    skill: "quantify 1-10 [M]",
    start(api) {
      const C = api.C;
      const L = window.JoshLogic;
      const ROUNDS = 5;
      let round = 0;
      const numEl = api.el("div", { class: "nm__num", aria: { hidden: "true" } });
      const groups = api.el("div", { class: "choices choices--3" });
      api.stage.append(numEl, groups);

      function newRound() {
        const r = L.makeNumberMatch();
        const obj = api.randItem(C.COUNT_OBJECTS);
        numEl.textContent = String(r.n);
        api.setPrompt("Tap the group with this many.", ["👀", "🔢", "👉"]);
        api.speak();
        api.say(String(r.n));
        groups.innerHTML = "";
        r.groups.forEach((g) => {
          const b = api.el("button", { class: "choice nm__group tap", type: "button", dataset: g.correct ? { correct: "1" } : {}, aria: { label: g.count + " things" } });
          for (let i = 0; i < g.count; i++) b.appendChild(api.el("span", { class: "nm__dot", text: obj }));
          b.addEventListener("click", () => { if (g.correct) { round += 1; if (round >= ROUNDS) api.win(); else { api.roundWin(); newRound(); } } else api.tryAgain(b); });
          groups.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- What Time? (o'clock, [P]) ----
  F.register({
    id: "clock",
    icon: "🕐",
    title: "What Time?",
    skill: "clock / time [P]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 5;
      let round = 0;
      const clock = api.el("div", { class: "clock", aria: { hidden: "true" } });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(clock, choices);

      function draw(hour) {
        const rad = ((hour % 12) * 30 - 90) * Math.PI / 180;
        const hx = 50 + 26 * Math.cos(rad), hy = 50 + 26 * Math.sin(rad);
        let ticks = "";
        for (let h = 1; h <= 12; h++) {
          const a = (h * 30 - 90) * Math.PI / 180;
          const x = 50 + 40 * Math.cos(a), y = 50 + 40 * Math.sin(a);
          ticks += '<text x="' + x.toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" font-size="9" text-anchor="middle" fill="#33445a">' + h + "</text>";
        }
        clock.innerHTML = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="#fff" stroke="#5ec8ff" stroke-width="3"/>' + ticks +
          '<line x1="50" y1="50" x2="' + hx.toFixed(1) + '" y2="' + hy.toFixed(1) + '" stroke="#e23636" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="50" r="3.5" fill="#333"/></svg>';
      }
      function newRound() {
        const r = L.makeClock();
        draw(r.hour);
        api.setPrompt("What time is it?", ["👀", "🕐", "🔢"]);
        api.speak();
        api.say(r.hour + " o'clock");
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", { class: "choice choice--time tap", type: "button", text: ch.label, dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.label } });
          b.addEventListener("click", () => { if (ch.correct) { round += 1; if (round >= ROUNDS) api.win(); else { api.roundWin(); newRound(); } } else api.tryAgain(b); });
          choices.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Build the Number (place value: tens + ones, [W]) ----
  F.register({
    id: "place-value",
    icon: "🔟",
    title: "Build the Number",
    skill: "place value [W]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 4;
      let round = 0, target = 0, total = 0;
      const targetEl = api.el("div", { class: "pv__target", aria: { hidden: "true" } });
      const built = api.el("div", { class: "pv__built" });
      const tensBtn = api.el("button", { class: "pv__pile tap", type: "button", aria: { label: "add ten" } }, ["🔟", api.el("span", { class: "pv__plus" }, ["+10"])]);
      const onesBtn = api.el("button", { class: "pv__pile tap", type: "button", aria: { label: "add one" } }, ["🟡", api.el("span", { class: "pv__plus" }, ["+1"])]);
      const piles = api.el("div", { class: "pv__piles" }, [tensBtn, onesBtn]);
      const nextBtn = api.el("button", { class: "btn-big", type: "button", hidden: "" }, ["Next ▶"]);
      api.stage.append(targetEl, built, piles, nextBtn);

      function refresh() {
        const remaining = target - total;
        if (remaining >= 10) { tensBtn.dataset.correct = "1"; delete onesBtn.dataset.correct; }
        else if (remaining > 0) { onesBtn.dataset.correct = "1"; delete tensBtn.dataset.correct; }
        else { delete tensBtn.dataset.correct; delete onesBtn.dataset.correct; }
        built.innerHTML = "";
        const t = L.tensOnes(total);
        for (let i = 0; i < t.tens; i++) built.appendChild(api.el("span", { class: "pv__ten", text: "🔟" }));
        for (let i = 0; i < t.ones; i++) built.appendChild(api.el("span", { class: "pv__one", text: "🟡" }));
      }
      function check() {
        if (total === target) {
          delete tensBtn.dataset.correct; delete onesBtn.dataset.correct;
          round += 1;
          if (round >= ROUNDS) api.win({ say: "You built it!" });
          else { api.roundWin(); nextBtn.hidden = false; nextBtn.dataset.correct = "1"; }
        }
      }
      function newRound() {
        target = api.randInt(11, 39);
        total = 0;
        targetEl.textContent = String(target);
        api.setPrompt("Build the number " + target + "!", ["👀", "🔟", "🟡"]);
        api.speak();
        refresh();
      }
      tensBtn.addEventListener("click", () => { if (target - total >= 10) { total += 10; api.say(String(total)); refresh(); check(); } });
      onesBtn.addEventListener("click", () => { if (target - total >= 1) { total += 1; api.say(String(total)); refresh(); check(); } });
      nextBtn.addEventListener("click", () => { nextBtn.hidden = true; delete nextBtn.dataset.correct; newRound(); });
      newRound();
    },
  });

  // ---- Ten & Some More (teen numbers on a ten-frame, [M/W]) ----
  F.register({
    id: "ten-frame",
    icon: "🔟",
    title: "Ten & Some More",
    skill: "teen numbers 11-19 [M/W]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 4;
      let round = 0, target = 0, filled = 0, cells = [];
      const targetEl = api.el("div", { class: "pv__target", aria: { hidden: "true" } });
      const frame = api.el("div", { class: "tenf__grid" });
      const extra = api.el("div", { class: "tenf__extra" });
      const wrap = api.el("div", { class: "tenf" }, [frame, extra]);
      const addBtn = api.el("button", { class: "btn-big", type: "button", dataset: { correct: "1" } }, ["➕ Add one"]);
      const nextBtn = api.el("button", { class: "btn-big", type: "button", hidden: "" }, ["Next ▶"]);
      api.stage.append(targetEl, wrap, addBtn, nextBtn);

      function newRound() {
        const t = L.makeTeen();
        target = t.target; filled = 0;
        targetEl.textContent = String(target);
        addBtn.hidden = false; addBtn.dataset.correct = "1";
        frame.innerHTML = ""; extra.innerHTML = ""; cells = [];
        for (let i = 0; i < 10; i++) { const c = api.el("span", { class: "tenf__cell" }); frame.appendChild(c); cells.push(c); }
        api.setPrompt("Fill ten, then some more — make " + target + "!", ["👀", "🔟", "➕"]);
        api.speak();
      }
      addBtn.addEventListener("click", () => {
        if (filled >= target) return;
        filled += 1;
        if (filled <= 10) { cells[filled - 1].classList.add("tenf__cell--on"); cells[filled - 1].textContent = "🔵"; }
        else extra.appendChild(api.el("span", { class: "tenf__one pop" }, ["🟡"]));
        api.say(String(filled));
        if (filled === target) {
          delete addBtn.dataset.correct; addBtn.hidden = true;
          round += 1;
          if (round >= ROUNDS) api.win({ say: "You made " + target + "!" });
          else { api.roundWin(); nextBtn.hidden = false; nextBtn.dataset.correct = "1"; }
        }
      });
      nextBtn.addEventListener("click", () => { nextBtn.hidden = true; delete nextBtn.dataset.correct; newRound(); });
      newRound();
    },
  });

  // ---- Set the Clock (move the hour hand to the target time, [P]) ----
  F.register({
    id: "set-clock",
    icon: "🕓",
    title: "Set the Clock",
    skill: "clock / time [P]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 5;
      let round = 0, target = 0, hand = 12;
      const targetEl = api.el("div", { class: "setclock__target" });
      const clock = api.el("div", { class: "clock", aria: { hidden: "true" } });
      const advBtn = api.el("button", { class: "btn-big", type: "button" }, ["Next hour ➡️"]);
      const setBtn = api.el("button", { class: "btn-big setclock__set", type: "button", hidden: "" }, ["Set it! ✓"]);
      const row = api.el("div", { class: "setclock__row" }, [advBtn, setBtn]);
      api.stage.append(targetEl, clock, row);

      function draw() {
        const rad = ((hand % 12) * 30 - 90) * Math.PI / 180;
        const hx = 50 + 26 * Math.cos(rad), hy = 50 + 26 * Math.sin(rad);
        let ticks = "";
        for (let h = 1; h <= 12; h++) {
          const a = (h * 30 - 90) * Math.PI / 180;
          const x = 50 + 40 * Math.cos(a), y = 50 + 40 * Math.sin(a);
          ticks += '<text x="' + x.toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" font-size="9" text-anchor="middle" fill="#33445a">' + h + "</text>";
        }
        clock.innerHTML = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="#fff" stroke="#5ec8ff" stroke-width="3"/>' + ticks +
          '<line x1="50" y1="50" x2="' + hx.toFixed(1) + '" y2="' + hy.toFixed(1) + '" stroke="#e23636" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="50" r="3.5" fill="#333"/></svg>';
      }
      function updateBtns() {
        if (hand === target) { delete advBtn.dataset.correct; setBtn.hidden = false; setBtn.dataset.correct = "1"; }
        else { advBtn.dataset.correct = "1"; setBtn.hidden = true; delete setBtn.dataset.correct; }
      }
      function newRound() {
        target = L.randInt(1, 12);
        hand = L.randInt(1, 12);
        if (hand === target) hand = (hand % 12) + 1;
        targetEl.textContent = "Make it " + target + " o'clock";
        api.setPrompt("Make the clock say " + target + " o'clock!", ["👀", "🕓", "➡️"]);
        api.speak();
        draw(); updateBtns();
      }
      advBtn.addEventListener("click", () => { hand = (hand % 12) + 1; draw(); api.say(hand + " o'clock"); updateBtns(); });
      setBtn.addEventListener("click", () => {
        if (hand !== target) { api.tryAgain(setBtn); return; }
        round += 1;
        if (round >= ROUNDS) api.win(); else { api.roundWin(); newRound(); }
      });
      newRound();
    },
  });

  // ---- Make Ten (number bonds to 10 — his foundation working edge, [W]) ----
  // A ten-frame shows some filled; tap how many MORE make ten. Control-of-error
  // is concrete: the empty cells ARE the answer, so a non-reader can self-check.
  F.register({
    id: "make-ten",
    icon: "🔟",
    title: "Make Ten",
    skill: "number bonds to 10 [W]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 5;
      let round = 0;
      const frame = api.el("div", { class: "tenf__grid maketen__grid" });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(frame, choices);

      function newRound() {
        const r = L.makeMakeTen();
        api.setPrompt("How many MORE to make ten?", ["👀", "➕", "🔟"]);
        api.speak();
        frame.innerHTML = "";
        for (let i = 0; i < 10; i++) {
          const on = i < r.have;
          frame.appendChild(api.el("span", { class: "tenf__cell" + (on ? " tenf__cell--on" : " maketen__cell--empty") }, [on ? "🔵" : ""]));
        }
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--num tap", type: "button", text: String(ch.n),
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: String(ch.n) },
          });
          b.addEventListener("click", () => {
            if (ch.correct) { round += 1; if (round >= ROUNDS) api.win({ say: "You made ten!" }); else { api.roundWin(); newRound(); } }
            else api.tryAgain(b);
          });
          choices.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Big Add (two-digit addition — his HEADLINE math working edge, [W]) ----
  // a + b shown as golden-bead-style tens rods + ones dots (concrete), pick the
  // sum. No regrouping, so the count is honest and re-countable.
  F.register({
    id: "big-add",
    icon: "🧮",
    title: "Add Big Numbers",
    skill: "2-digit addition [W]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 5;
      let round = 0;
      const board = api.el("div", { class: "bigadd" });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(board, choices);

      function group(tens, ones) {
        const g = api.el("div", { class: "bigadd__num" });
        const rods = api.el("div", { class: "bigadd__rods" });
        for (let i = 0; i < tens; i++) rods.appendChild(api.el("span", { class: "bigadd__rod", aria: { hidden: "true" } }));
        const dots = api.el("div", { class: "bigadd__dots" });
        for (let i = 0; i < ones; i++) dots.appendChild(api.el("span", { class: "bigadd__dot", aria: { hidden: "true" } }));
        g.append(rods, dots);
        return g;
      }

      function newRound() {
        const r = L.makeBigAdd();
        api.setPrompt("Put them together — how many all together?", ["👀", "➕", "🔢"]);
        api.speak();
        board.innerHTML = "";
        board.append(
          group(r.aTens, r.aOnes),
          api.el("div", { class: "bigadd__plus", aria: { hidden: "true" } }, ["➕"]),
          group(r.bTens, r.bOnes)
        );
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--num tap", type: "button", text: String(ch.n),
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: String(ch.n) },
          });
          b.addEventListener("click", () => {
            if (ch.correct) { round += 1; if (round >= ROUNDS) api.win({ say: "You added big numbers!" }); else { api.roundWin(); newRound(); } }
            else api.tryAgain(b);
          });
          choices.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Piggy Bank (coin VALUE — the next step in money, [NEW]) ----
  // Fill the piggy to an exact price. A penny is worth 1¢, a nickel 5¢ (drawn
  // as labeled discs — never a bare ambiguous coin). Running WORTH is spoken.
  F.register({
    id: "piggy-bank",
    icon: "🐷",
    title: "Piggy Bank",
    skill: "money / coin value [NEW]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 4;
      let round = 0, price = 0, worth = 0;
      const tag = api.el("div", { class: "piggy__tag" });
      const worthEl = api.el("div", { class: "piggy__worth", aria: { live: "polite" } });
      const jar = api.el("div", { class: "piggy__jar" }, ["🐷"]);
      const penny = api.el("button", { class: "coin coin--penny tap", type: "button", aria: { label: "one cent penny" } }, ["1¢"]);
      const nickel = api.el("button", { class: "coin coin--nickel tap", type: "button", aria: { label: "five cent nickel" } }, ["5¢"]);
      const nextBtn = api.el("button", { class: "btn-big", type: "button", hidden: "" }, ["Next ▶"]);
      const coins = api.el("div", { class: "piggy__coins" }, [penny, nickel]);
      api.stage.append(tag, worthEl, jar, coins, nextBtn);

      function refresh() {
        const left = price - worth;
        worthEl.textContent = worth + "¢ / " + price + "¢";
        // A coin is a correct next tap only if it won't overpay.
        [[penny, 1], [nickel, 5]].forEach(([btn, val]) => {
          if (val <= left) btn.dataset.correct = "1"; else delete btn.dataset.correct;
          btn.classList.toggle("coin--off", val > left);
        });
      }
      function drop(val) {
        if (val > price - worth) { api.tryAgain(val === 1 ? penny : nickel); return; }
        worth += val;
        jar.appendChild(api.el("span", { class: "piggy__coin pop", aria: { hidden: "true" } }, [val === 5 ? "🪙" : "🟤"]));
        api.say(String(worth));
        if (worth >= price) {
          delete penny.dataset.correct; delete nickel.dataset.correct;
          round += 1;
          if (round >= ROUNDS) api.win({ say: "The piggy is full! Yay!" });
          else { api.roundWin(); nextBtn.hidden = false; nextBtn.dataset.correct = "1"; }
        } else refresh();
      }
      function newRound() {
        const r = L.makePiggyBank();
        price = r.price; worth = 0;
        jar.innerHTML = "🐷";
        tag.textContent = "Fill to " + price + "¢";
        api.setPrompt("Fill the piggy to " + price + " cents!", ["👀", "🪙", "🐷"]);
        api.speak();
        refresh();
      }
      penny.addEventListener("click", () => drop(1));
      nickel.addEventListener("click", () => drop(5));
      nextBtn.addEventListener("click", () => { nextBtn.hidden = true; delete nextBtn.dataset.correct; newRound(); });
      newRound();
    },
  });

  // ---- Number Muncher (which numeral is BIGGER — symbolic magnitude, [P→W]) ----
  // Compares written numbers (a real step past which-more's dot groups). A tiny
  // tower of that height under each numeral is the concrete non-reader check.
  F.register({
    id: "number-muncher",
    icon: "🐊",
    title: "Which Is Bigger?",
    skill: "compare numerals [P→W]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 5;
      let round = 0;
      const gator = api.el("div", { class: "muncher__gator", aria: { hidden: "true" } }, ["🐊"]);
      const cards = api.el("div", { class: "muncher__cards" });
      api.stage.append(gator, cards);

      function card(n, correct) {
        const dots = api.el("div", { class: "muncher__tower", aria: { hidden: "true" } });
        for (let i = 0; i < n; i++) dots.appendChild(api.el("span", { class: "muncher__cube" }));
        const b = api.el("button", {
          class: "muncher__card tap", type: "button",
          dataset: correct ? { correct: "1" } : {}, aria: { label: String(n) },
        }, [api.el("span", { class: "muncher__num" }, [String(n)]), dots]);
        b.addEventListener("click", () => {
          if (correct) { round += 1; if (round >= ROUNDS) api.win({ say: "You found the bigger number!" }); else { api.roundWin(); newRound(); } }
          else api.tryAgain(b);
        });
        return b;
      }
      function newRound() {
        const max = round < 3 ? 10 : 19; // ease into teens
        const r = L.makeNumberCompare(1, max);
        api.setPrompt("The muncher wants the BIGGER number!", ["👀", "🐊", "🔢"]);
        api.speak();
        cards.innerHTML = "";
        cards.append(card(r.a, r.answer === "a"), card(r.b, r.answer === "b"));
      }
      newRound();
    },
  });
})();
