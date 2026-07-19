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
        const len = 5 + Math.min(round, 2); // longer runs to track as it goes (5 → 7)
        const r = L.makeSkipCount(step, len);
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
      const ask = api.el("div", { class: "choices choices--3 more__ask", hidden: "" });
      api.stage.append(row, ask);

      function panel(n, obj, correct) {
        const p = api.el("button", {
          class: "more__panel tap", type: "button",
          dataset: correct ? { correct: "1" } : {}, aria: { label: n + " things" },
        });
        for (let i = 0; i < n; i++) p.appendChild(api.el("span", { class: "more__dot", text: obj }));
        return p;
      }

      function advance() {
        round += 1;
        if (round >= ROUNDS) api.win();
        else { api.roundWin(); newRound(); }
      }
      // B#3 / depth: after finding the bigger side, count HOW MANY MORE — turns a
      // simple "which is bigger?" ([P]) into real difference-counting ([W]).
      function howMany(diff) {
        api.setPrompt("How many MORE? Tap the number!", ["🔢", "👆", "😊"]);
        api.speak();
        const opts = new Set([diff]);
        while (opts.size < 3) { const d = api.randInt(1, Math.max(diff + 2, 4)); if (d !== diff) opts.add(d); }
        ask.innerHTML = "";
        api.shuffle([...opts]).forEach((nOpt) => {
          const b = api.el("button", {
            class: "choice choice--num tap", type: "button", text: String(nOpt),
            dataset: nOpt === diff ? { correct: "1" } : {}, aria: { label: String(nOpt) },
          });
          b.addEventListener("click", () => { if (nOpt === diff) { api.say(String(diff) + " more"); advance(); } else api.tryAgain(b); });
          ask.appendChild(b);
        });
        ask.hidden = false;
      }
      function newRound() {
        const r = L.makeCompare();
        const obj = api.randItem(C.COUNT_OBJECTS);
        const diff = Math.abs(r.a - r.b);
        let picked = false;
        ask.hidden = true; ask.innerHTML = "";
        api.setPrompt("Tap the side with MORE.", ["👀", "👉", "🔢"]);
        api.speak();
        row.innerHTML = "";
        const left = panel(r.a, obj, r.moreLeft);
        const right = panel(r.b, obj, !r.moreLeft);
        [left, right].forEach((p) => p.addEventListener("click", () => {
          if (picked) return;
          if (p.dataset.correct) {
            picked = true;
            p.classList.add("more__win");
            delete left.dataset.correct; delete right.dataset.correct;
            howMany(diff);
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

      // Numberblocks-style: each addend is a number-FRIEND (a stack of n cubes
      // with a face), so "3 + 2" is a 3-friend and a 2-friend that merge into a
      // 5-friend you tap to count — his favourite characters ARE the maths.
      const BC = C.BLOCK_COLORS || ["#5ec8ff", "#ff9f43", "#ffd24d", "#7be08a", "#3ec7c7", "#5ec8ff", "#8a7bff", "#c77dff", "#ff7ac0", "#a0d468"];
      const nf = (n) => (window.JoshArt && window.JoshArt.numberFriend) ? window.JoshArt.numberFriend(n, BC[(n - 1) % BC.length]) : "🧱";
      function group(count) {
        return api.el("div", { class: "add__group add__group--friend art-fill", aria: { hidden: "true" }, html: nf(count) });
      }
      function advance() {
        round += 1;
        if (round >= ROUNDS) api.win();
        else { api.roundWin(); setTimeout(newRound, 60); }
      }
      // A#4 + B#3: on the right answer the two friends slide together into ONE
      // friend, then the child taps it to COUNT (a second thought per round, and
      // the transformation IS the concept: "add" = put them together and count).
      function merge(sum) {
        choices.innerHTML = ""; // consume the choices
        scene.classList.add("add__scene--merge");
        api.say("Put them together");
        setTimeout(() => {
          scene.classList.remove("add__scene--merge");
          scene.innerHTML = "";
          const pile = api.el("button", { class: "add__pile add__pile--friend tap art-fill", type: "button", dataset: { correct: "1" }, aria: { label: "count the pile" }, html: nf(sum) });
          scene.appendChild(pile);
          api.setPrompt("Tap the friend to count them!", ["👆", "🔢", "😊"]);
          api.speak();
          pile.addEventListener("click", () => {
            delete pile.dataset.correct;
            pile.classList.remove("chomp"); void pile.offsetWidth; pile.classList.add("chomp");
            api.say(String(sum));
            advance();
          });
        }, 240);
      }
      function newRound() {
        const r = L.makeAddition();
        const sum = r.a + r.b;
        api.setPrompt("How many all together?", ["👀", "➕", "🔢"]);
        api.speak();
        scene.innerHTML = "";
        scene.append(group(r.a), api.el("div", { class: "add__plus", text: "➕" }), group(r.b));
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", { class: "choice choice--num tap", type: "button", text: String(ch.n), dataset: ch.correct ? { correct: "1" } : {}, aria: { label: String(ch.n) } });
          b.addEventListener("click", () => { if (ch.correct) merge(sum); else api.tryAgain(b); });
          choices.appendChild(b);
        });
        api.mascot();
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
      api.mascot();

      // Each group is a Numberblocks-style number-FRIEND of that many cubes, so
      // "which has this many?" is matched by counting a friend's blocks.
      const BC = C.BLOCK_COLORS || ["#5ec8ff", "#ff9f43", "#ffd24d", "#7be08a", "#3ec7c7", "#5ec8ff", "#8a7bff", "#c77dff", "#ff7ac0", "#a0d468"];
      const nf = (n) => (window.JoshArt && window.JoshArt.numberFriend) ? window.JoshArt.numberFriend(n, BC[(n - 1) % BC.length]) : "🧱";
      function newRound() {
        const r = L.makeNumberMatch();
        numEl.textContent = String(r.n);
        api.setPrompt("Tap the friend with this many blocks.", ["👀", "🔢", "👉"]);
        api.speak();
        api.say(String(r.n));
        groups.innerHTML = "";
        r.groups.forEach((g) => {
          const b = api.el("button", { class: "choice nm__group nm__group--friend tap art-fill", type: "button", dataset: g.correct ? { correct: "1" } : {}, aria: { label: g.count + " blocks" }, html: nf(g.count) });
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

      function draw(hour, min) {
        min = min || 0;
        // Hour hand creeps toward the next number at half-past; minute hand points
        // up (12) at o'clock and down (6) at half-past.
        const hrad = (((hour % 12) + min / 60) * 30 - 90) * Math.PI / 180;
        const hx = 50 + 24 * Math.cos(hrad), hy = 50 + 24 * Math.sin(hrad);
        const mrad = (min * 6 - 90) * Math.PI / 180;
        const mx = 50 + 34 * Math.cos(mrad), my = 50 + 34 * Math.sin(mrad);
        let ticks = "";
        for (let h = 1; h <= 12; h++) {
          const a = (h * 30 - 90) * Math.PI / 180;
          const x = 50 + 40 * Math.cos(a), y = 50 + 40 * Math.sin(a);
          ticks += '<text x="' + x.toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" font-size="9" text-anchor="middle" fill="#33445a">' + h + "</text>";
        }
        clock.innerHTML = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="#fff" stroke="#5ec8ff" stroke-width="3"/>' + ticks +
          '<line x1="50" y1="50" x2="' + mx.toFixed(1) + '" y2="' + my.toFixed(1) + '" stroke="#2b6cff" stroke-width="2.6" stroke-linecap="round"/>' +
          '<line x1="50" y1="50" x2="' + hx.toFixed(1) + '" y2="' + hy.toFixed(1) + '" stroke="#e23636" stroke-width="4.4" stroke-linecap="round"/><circle cx="50" cy="50" r="3.5" fill="#333"/></svg>';
      }
      function newRound() {
        // Adaptive: o'clock only until Josh masters it, then add half-past (:30).
        const r = L.makeClock(undefined, api.shouldRamp(2));
        draw(r.hour, r.min);
        api.setPrompt("What time is it?", ["👀", "🕐", "🔢"]);
        api.speak();
        api.say(r.min === 30 ? ("half past " + r.hour) : (r.hour + " o'clock"));
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
        // Dim a pile that would overshoot, so a non-reader sees which to tap next
        // (a +10 tap with < 10 to go was a silent no-op). Mirrors piggy-bank coins.
        tensBtn.classList.toggle("pv__pile--off", remaining < 10);
        onesBtn.classList.toggle("pv__pile--off", remaining < 1);
        built.innerHTML = "";
        const t = L.tensOnes(total);
        for (let i = 0; i < t.tens; i++) built.appendChild(api.el("span", { class: "pv__ten", text: "🔟" }));
        for (let i = 0; i < t.ones; i++) built.appendChild(api.el("span", { class: "pv__one", text: "🟡" }));
        if (total > 0 && built.lastChild) built.lastChild.classList.add("pop"); // A#4: the newest piece pops in
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
        // Climb toward 99 in later rounds (his ten-board-to-100 is mastered).
        target = round < 2 ? api.randInt(11, 39) : api.randInt(41, 99);
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

      let cells = [];
      function advance() {
        round += 1;
        if (round >= ROUNDS) api.win({ say: "You made ten!" });
        else { api.roundWin(); setTimeout(newRound, 80); }
      }
      // A#4: on the right answer, the empty cells actually FILL up to ten (a quick
      // staggered pop), so the bond is something you SEE complete — not just a
      // number that disappears.
      function fillToTen(have) {
        choices.innerHTML = "";
        let i = have;
        (function step() {
          if (i >= 10) { setTimeout(advance, 140); return; }
          const c = cells[i];
          if (c) { c.classList.remove("maketen__cell--empty"); c.classList.add("tenf__cell--on", "pop"); c.textContent = "🔵"; }
          i += 1;
          setTimeout(step, 45);
        })();
      }
      function newRound() {
        const r = L.makeMakeTen();
        api.setPrompt("How many MORE to make ten?", ["👀", "➕", "🔟"]);
        api.speak();
        frame.innerHTML = ""; cells = [];
        for (let i = 0; i < 10; i++) {
          const on = i < r.have;
          const c = api.el("span", { class: "tenf__cell" + (on ? " tenf__cell--on" : " maketen__cell--empty") }, [on ? "🔵" : ""]);
          frame.appendChild(c); cells.push(c);
        }
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--num tap", type: "button", text: String(ch.n),
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: String(ch.n) },
          });
          b.addEventListener("click", () => {
            if (ch.correct) fillToTen(r.have);
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
        const r = L.makeBigAdd(undefined, round >= 2); // later rounds may carry past ten
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
        // Always reflect the new total — including the coin that FILLS the piggy.
        // (Previously the display only updated in the not-yet-full branch, so a
        // finished round was left showing one coin short, e.g. "4¢ / 5¢".)
        worthEl.textContent = worth + "¢ / " + price + "¢";
        jar.appendChild(api.el("span", { class: "piggy__coin pop", aria: { hidden: "true" } }, [val === 5 ? "🪙" : "🟤"]));
        api.say(String(worth));
        if (worth >= price) {
          delete penny.dataset.correct; delete nickel.dataset.correct;
          penny.classList.add("coin--off"); nickel.classList.add("coin--off"); // full — no more coins needed
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
        // Adaptive: stay in 1–10 until Josh shows mastery (2 clean wins in a row),
        // then ramp into the teens — and drop back to 1–10 if he stumbles.
        const max = api.shouldRamp(2) ? 19 : 10;
        const r = L.makeNumberCompare(1, max);
        api.setPrompt("The muncher wants the BIGGER number!", ["👀", "🐊", "🔢"]);
        api.speak();
        cards.innerHTML = "";
        cards.append(card(r.a, r.answer === "a"), card(r.b, r.answer === "b"));
      }
      newRound();
    },
  });

  // ---- 🍪 Fair Shares (deal treats equally — early division + fairness) ----
  // "One for you, one for you…": the NEXT friend to serve carries data-correct;
  // tap their plate and a treat lands on it. When the plate stack is empty,
  // every plate has the same count — the fairness is VISIBLE and spoken.
  F.register({
    id: "fair-share",
    icon: "🍪",
    title: "Fair Shares",
    skill: "share equally [W] — early division",
    start(api) {
      const C = api.C;
      const L = window.JoshLogic;
      const ROUNDS = 3;
      let round = 0, r = null, dealt = 0, treat = "🍪";
      const pile = api.el("div", { class: "fs__pile", aria: { hidden: "true" } });
      const row = api.el("div", { class: "fs__row" });
      api.stage.append(pile, row);

      function plates() { return [...row.querySelectorAll(".fs__plate")]; }

      function newRound() {
        r = L.makeFairShare(undefined, api.shouldRamp(2));
        dealt = 0;
        treat = api.randItem(C.SHARE_TREATS || ["🍪"]);
        api.setPrompt("Share them out — one each!", ["🍪", "🤲", "😊"]);
        api.speak(); api.say("Share the treats so everyone gets the same!");
        pile.textContent = treat.repeat(r.total);
        row.innerHTML = "";
        for (let i = 0; i < r.friends; i++) {
          const f = api.friend();
          const face = api.el("span", { class: "fs__face art-fill", aria: { hidden: "true" } });
          if (window.JoshArt && window.JoshArt.friend && f.art) face.innerHTML = window.JoshArt.friend(f.art);
          else face.textContent = f.emoji;
          const count = api.el("span", { class: "fs__count", aria: { hidden: "true" } });
          const plate = api.el("button", {
            class: "fs__plate tap", type: "button",
            dataset: i === 0 ? { correct: "1" } : {}, aria: { label: f.name + "'s plate" },
          }, [face, count]);
          plate.__n = 0;
          plate.__name = f.name;
          plate.addEventListener("click", () => {
            if (plate.dataset.correct !== "1") { api.tryAgain(plate); api.say(plate.__name + " has one — someone else's turn!"); return; }
            plate.__n += 1;
            dealt += 1;
            count.textContent = treat.repeat(plate.__n);
            plate.classList.remove("pop"); void plate.offsetWidth; plate.classList.add("pop");
            pile.textContent = treat.repeat(r.total - dealt);
            delete plate.dataset.correct;
            if (dealt >= r.total) {
              api.say("Look — everyone has " + r.per + "! That's fair!");
              round += 1;
              if (round >= ROUNDS) api.win({ say: "You shared everything fairly! What a kind friend!" });
              else { api.roundWin(); setTimeout(() => { if (row.isConnected) newRound(); }, 900); }
            } else {
              // The NEXT plate in the round-robin gets the turn.
              const ps = plates();
              const next = ps[dealt % ps.length];
              next.dataset.correct = "1";
              api.say(next.__name + "'s turn!");
            }
          });
          row.appendChild(plate);
        }
      }
      newRound();
    },
  });

  // ---- 👀 Quick Peek (subitizing — see how many WITHOUT counting) ----
  // The dots hide behind a friendly cloud. Josh taps the cloud to peek as many
  // times as he likes (fully self-paced — never a timer), then answers.
  F.register({
    id: "quick-peek",
    icon: "👀",
    title: "Quick Peek",
    skill: "subitizing 2-6 [W]",
    start(api) {
      const C = api.C;
      const L = window.JoshLogic;
      const ROUNDS = 4;
      let round = 0, lastN = 0, r = null, shown = false;
      const stagebox = api.el("div", { class: "qp__box" });
      const dots = api.el("div", { class: "qp__dots", aria: { hidden: "true" } });
      const cloud = api.el("button", { class: "qp__cloud tap", type: "button", text: "☁️", aria: { label: "peek" } });
      stagebox.append(dots, cloud);
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(stagebox, chips);

      cloud.addEventListener("click", () => {
        shown = !shown;
        stagebox.classList.toggle("qp__box--open", shown);
        if (shown) api.say("Peek!");
      });

      function newRound() {
        r = L.makeQuickPeek(undefined, api.shouldRamp(2) ? 6 : 5, lastN);
        lastN = r.n;
        shown = false;
        stagebox.classList.remove("qp__box--open");
        api.setPrompt("Peek! How many do you see?", ["☁️", "👀", "🔢"]);
        api.speak();
        const item = api.randItem(C.PEEK_ITEMS || ["⭐"]);
        dots.innerHTML = "";
        r.dots.forEach(([x, y]) => {
          dots.appendChild(api.el("span", { class: "qp__dot", text: item, style: { left: x + "%", top: y + "%" } }));
        });
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--num tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: String(ch.n) },
          }, [String(ch.n)]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            stagebox.classList.add("qp__box--open"); // show the dots as the proof
            round += 1;
            if (round >= ROUNDS) api.win({ say: r.n + "! You saw it super fast!" });
            else { api.roundWin({ say: r.n + "! Quick eyes!" }); setTimeout(() => { if (dots.isConnected) newRound(); }, 900); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Number Line Hop (a frog sits on the missing number) [M/W] ----
  F.register({
    id: "line-hop",
    icon: "🐸",
    title: "Number Line Hop",
    skill: "numbers on a line [M/W]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 4;
      let round = 0, lastStart = -1, r = null;
      const line = api.el("div", { class: "line__row", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(line, chips);
      function newRound() {
        const ramp = api.shouldRamp(2);
        const lo = ramp ? 8 : 0, hi = ramp ? 20 : 10;
        const list = []; for (let n = lo; n <= hi; n++) list.push(String(n));
        r = L.makeOrderTrain(list, undefined, { window: 4, lastStart });
        lastStart = r.start;
        api.setPrompt("Which number is missing?", ["🐸", "🔢", "👉"]);
        api.speak();
        line.innerHTML = "";
        r.items.forEach((v, i) => {
          const cell = api.el("div", { class: "line__tile" + (i === r.blankIdx ? " line__tile--blank" : "") });
          if (i === r.blankIdx) cell.innerHTML = '<span class="line__frog">🐸</span><span class="line__q">?</span>';
          else cell.textContent = v;
          line.appendChild(cell);
        });
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--num tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.value },
          }, [ch.value]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            const blank = line.querySelector(".line__tile--blank");
            if (blank) { blank.textContent = r.answer; blank.classList.remove("line__tile--blank"); blank.classList.add("pop"); }
            api.say(r.answer + "!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "You know the number line!" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Nickel Trade (a nickel is worth 5 pennies) [NA→P] ----
  F.register({
    id: "nickel-trade", icon: "🪙", title: "Nickel Trade", skill: "money / coins [NA→P]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 4; let round = 0, r = null;
      const nickel = api.el("div", { class: "nickel__top" }, ["🪙", api.el("span", { class: "nickel__label" }, ["5¢"])]);
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(nickel, chips);
      function newRound() {
        r = L.makeCoinTrade();
        api.setPrompt("A nickel is 5 pennies. Tap the pile of 5!", ["🪙", "👀", "👉"]);
        api.speak();
        chips.innerHTML = "";
        r.piles.forEach((p) => {
          const pile = api.el("button", {
            class: "choice nickel__pile tap", type: "button",
            dataset: p.correct ? { correct: "1" } : {}, aria: { label: p.count + " pennies" },
          });
          pile.innerHTML = Array.from({ length: p.count }, () => '<span class="nickel__coin">🪙</span>').join("");
          pile.addEventListener("click", () => {
            if (!p.correct) { api.tryAgain(pile); return; }
            pile.classList.add("pop");
            api.say("Five pennies make a nickel!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "You know your coins!" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(pile);
        });
      }
      newRound();
    },
  });

  // ---- Double It! (n + n; the mirrored wings are the control of error) [W] ----
  F.register({
    id: "double-up", icon: "🦋", title: "Double It!", skill: "doubles [W]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 4; let round = 0, r = null;
      function dots(n) { return Array.from({ length: n }, () => '<span class="double__dot">🔴</span>').join(""); }
      const wings = api.el("div", { class: "double__wings", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(wings, chips);
      function newRound() {
        r = L.makeDouble(undefined, api.shouldRamp(2) ? 5 : 3);
        api.setPrompt(r.n + " and " + r.n + " — how many in all?", ["🦋", "➕", "🤔"]);
        api.speak(); api.say(r.n + " dots and " + r.n + " dots. How many in all?");
        wings.innerHTML = '<div class="double__wing">' + dots(r.n) + '</div><div class="double__body">🦋</div><div class="double__wing">' + dots(r.n) + "</div>";
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--num tap", type: "button", text: String(ch.n),
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: String(ch.n) },
          });
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            wings.classList.remove("pop"); void wings.offsetWidth; wings.classList.add("pop");
            api.say(r.n + " and " + r.n + " is " + r.sum + "!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "Double trouble — you got them all!" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Long or Short? (compare caterpillar lengths) [P] ----
  F.register({
    id: "long-short", icon: "📏", title: "Long or Short?", skill: "measurement [P]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 4; let round = 0, lastAsk = null, r = null;
      const rows = api.el("div", { class: "cater" });
      api.stage.append(rows);
      function newRound() {
        r = L.makeLengthPick(undefined, lastAsk); lastAsk = r.ask;
        api.setPrompt(r.ask === "longest" ? "Tap the LONGEST!" : "Tap the SHORTEST!", ["📏", r.ask === "longest" ? "↔️" : "🤏", "👉"]);
        api.speak();
        rows.innerHTML = "";
        r.rows.forEach((row) => {
          const b = api.el("button", {
            class: "choice cater__row tap", type: "button",
            dataset: row.correct ? { correct: "1" } : {}, aria: { label: row.len + " long" },
          });
          b.innerHTML = '<span class="cater__head">🐛</span>' + Array.from({ length: row.len }, () => '<span class="cater__seg">🟢</span>').join("");
          b.addEventListener("click", () => {
            if (!row.correct) { api.tryAgain(b); return; }
            api.say(r.ask === "longest" ? "That's the longest!" : "That's the shortest!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "You measured them all!" });
            else { api.roundWin(); newRound(); }
          });
          rows.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Blast-Off Countdown (tap numbers biggest → smallest) [W] ----
  F.register({
    id: "count-down", icon: "🚀", title: "Blast-Off Countdown", skill: "descending order [W]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 3; let round = 0, step = 0, r = null;
      const rocketEl = api.el("div", { class: "cd__rocket art-fill", aria: { hidden: "true" }, html: (window.JoshArt && window.JoshArt.rocket) ? window.JoshArt.rocket() : "🚀" });
      const numEl = api.el("div", { class: "cd__num", aria: { hidden: "true" } });
      const tray = api.el("div", { class: "choices choices--3" });
      api.stage.append(rocketEl, numEl, tray);
      function flagNext() {
        [...tray.children].forEach((c, i) => {
          if (!c.dataset.done && r.items[i].order === step) c.dataset.correct = "1";
          else if (!c.dataset.done) delete c.dataset.correct;
        });
      }
      function newRound() {
        r = L.makeCountdown(api.shouldRamp(2) ? 10 : 5);
        step = 0;
        api.setPrompt("Tap the numbers from BIGGEST to smallest — then blast off!", ["🚀", "🔢", "⬇️"]);
        api.speak();
        numEl.textContent = String(r.len);
        rocketEl.classList.remove("cd__rocket--launch");
        tray.innerHTML = "";
        r.items.forEach((it) => {
          const b = api.el("button", {
            class: "choice choice--num tap", type: "button", text: String(it.value),
            dataset: it.order === 0 ? { correct: "1" } : {}, aria: { label: String(it.value) },
          });
          b.addEventListener("click", () => {
            if (b.dataset.done) return;
            if (it.order !== step) { api.tryAgain(b); return; }
            b.dataset.done = "1"; b.classList.add("choice--used"); delete b.dataset.correct;
            step += 1;
            if (step >= r.items.length) {
              numEl.textContent = "🚀";
              rocketEl.classList.add("cd__rocket--launch");
              round += 1;
              if (round >= ROUNDS) api.win({ say: "Blast off! You counted down!" });
              else { api.roundWin(); newRound(); }
            } else { numEl.textContent = String(it.value - 1); api.say(String(it.value - 1)); flagNext(); }
          });
          tray.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Heavy or Light? (the heavier side of the seesaw is DOWN) [P] ----
  F.register({
    id: "seesaw", icon: "⚖️", title: "Heavy or Light?", skill: "weight compare [P]",
    start(api) {
      const C = api.C; const L = window.JoshLogic;
      const ROUNDS = 4; let round = 0, lastIdx = -1, r = null;
      const beam = api.el("div", { class: "seesaw", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices seesaw__choices" });
      api.stage.append(beam, chips);
      function newRound() {
        r = L.makeSeesaw(C.WEIGHT_PAIRS, undefined, lastIdx); lastIdx = r.idx;
        api.setPrompt(r.ask === "heavier" ? "Tap the HEAVIER one!" : "Tap the LIGHTER one!", ["⚖️", r.ask === "heavier" ? "⬇️" : "⬆️", "👉"]);
        api.speak();
        beam.className = "seesaw " + (r.heavyLeft ? "seesaw--left" : "seesaw--right");
        beam.innerHTML = '<span class="seesaw__pan">' + r.sides[0].emoji + '</span><span class="seesaw__bar"></span><span class="seesaw__pan">' + r.sides[1].emoji + "</span>";
        chips.innerHTML = "";
        r.sides.forEach((s, i) => {
          const b = api.el("button", {
            class: "choice tap", type: "button", text: s.emoji,
            dataset: i === r.correctIdx ? { correct: "1" } : {}, aria: { label: s.name },
          });
          b.addEventListener("click", () => {
            if (i !== r.correctIdx) { api.tryAgain(b); return; }
            api.say("The " + s.name + " is " + r.ask + "!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "You know heavy and light!" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Count the Sides (geometry × counting; circle = 0) [W] ----
  F.register({
    id: "side-count", icon: "🔺", title: "Count the Sides", skill: "geometry / counting [W]",
    start(api) {
      const C = api.C; const L = window.JoshLogic;
      const ROUNDS = 4; let round = 0, last = -1, r = null;
      const shapeEl = api.el("div", { class: "sides__shape", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(shapeEl, chips);
      function newRound() {
        r = L.makeSideCount(C.SIDE_SHAPES, undefined, last); last = r.idx;
        api.setPrompt("How many sides?", ["🔺", "🔢", "👉"]);
        api.speak();
        shapeEl.innerHTML = '<svg viewBox="0 0 100 100" fill="#5aa9e6" stroke="#2b6cff" stroke-width="3" role="img" aria-hidden="true">' + r.shape.svg + "</svg>";
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--num tap", type: "button", text: String(ch.n),
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: String(ch.n) },
          });
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            api.say(r.sides === 0 ? "A circle has no straight sides — zero!" : r.sides + " sides!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "You counted every side!" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ================= Road to 180 — Set 2, Wave 6 =================
  // ---- Coin Mix-Up (a nickel + some pennies → the total) ----
  F.register({
    id: "coin-mix", icon: "💰", title: "Coin Mix-Up", skill: "money: nickel + pennies [W]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 4; let round = 0, last = -1;
      const pile = api.el("div", { class: "coinmix__pile", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(pile, chips);
      function newRound() {
        const r = L.makeCoinMix(undefined, last); last = r.total;
        pile.innerHTML = "";
        pile.appendChild(api.el("span", { class: "coin coin--nickel" }, ["5¢"]));
        for (let i = 0; i < r.pennies; i++) pile.appendChild(api.el("span", { class: "coin coin--penny" }, ["1¢"]));
        api.setPrompt("How many cents in all?", ["🪙", "➕", "🔢"]);
        api.speak(); api.say("A nickel is 5 cents. How many cents in all?");
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", { class: "choice choice--num tap", type: "button", text: ch.n + "¢", dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.n + " cents" } });
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            const nk = pile.querySelector(".coin--nickel");
            if (nk) { nk.classList.remove("coin--nickel"); nk.classList.add("coin--penny", "pop"); nk.textContent = "1¢"; for (let i = 0; i < 4; i++) pile.insertBefore(api.el("span", { class: "coin coin--penny pop" }, ["1¢"]), nk.nextSibling); }
            api.say(r.total + " cents!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "You counted the money!" }); else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- First, Second, Third! (ordinal position in a queue) ----
  F.register({
    id: "ordinal-line", icon: "🥇", title: "First, Second, Third!", skill: "ordinal words [P]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 4; let round = 0, last = -1;
      const ORD = ["1st", "2nd", "3rd", "4th", "5th"];
      const POOL = (api.C.ANIMALS || []).map((a) => a.emoji || a).filter((e) => typeof e === "string");
      const line = api.el("div", { class: "ord__line" });
      api.stage.append(line);
      function newRound() {
        const r = L.makeOrdinal(undefined, { last });
        last = r.ord;
        const animals = api.shuffle((POOL.length ? POOL : ["🐶", "🐱", "🐰", "🐸", "🐵"]).slice()).slice(0, r.len);
        api.setPrompt("Tap the " + ORD[r.ord - 1] + " one in line!", ["🍦", "🔢", "👉"]);
        api.speak(); api.say("Tap the " + ORD[r.ord - 1] + " one in line!");
        line.innerHTML = "";
        line.appendChild(api.el("div", { class: "ord__stand", aria: { hidden: "true" } }, ["🍦"]));
        animals.forEach((em, i) => {
          const b = api.el("button", {
            class: "choice ord__animal tap", type: "button",
            dataset: i === r.correctIdx ? { correct: "1" } : {}, aria: { label: ORD[i] + " in line" },
          }, [
            api.el("span", { class: "ord__badge", aria: { hidden: "true" } }, [ORD[i]]),
            api.el("span", { class: "ord__face", aria: { hidden: "true" } }, [em]),
          ]);
          b.addEventListener("click", () => {
            if (i !== r.correctIdx) { api.tryAgain(b); return; }
            b.classList.add("ord__animal--hop"); api.say("The " + ORD[r.ord - 1] + " one!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "You know first, second, third!" }); else { api.roundWin(); newRound(); }
          });
          line.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- More or Fewer than 5? (number sense around a benchmark) ----
  F.register({
    id: "about-five", icon: "🖐️", title: "More or Fewer than 5?", skill: "number sense [W]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 4; let round = 0, last = -1;
      const OBJ = api.C.COUNT_OBJECTS || ["⭐"];
      const scene = api.el("div", { class: "af__scene", aria: { hidden: "true" } });
      const bins = api.el("div", { class: "choices choices--2" });
      api.stage.append(scene, bins);
      function newRound() {
        const r = L.makeAboutFive(undefined, last); last = r.n;
        const em = api.randItem(OBJ);
        scene.innerHTML = "";
        for (let i = 0; i < r.n; i++) scene.appendChild(api.el("span", { class: "af__item" }, [em]));
        api.setPrompt("Fewer than 5, or more than 5?", ["🖐️", "❓", "🔢"]);
        api.speak();
        bins.innerHTML = "";
        [{ label: "Fewer than 5", emoji: "🤏" }, { label: "More than 5", emoji: "✋" }].forEach((bin, i) => {
          const b = api.el("button", {
            class: "choice af__bin tap", type: "button",
            dataset: i === r.answerIdx ? { correct: "1" } : {}, aria: { label: bin.label },
          }, [
            api.el("span", { class: "af__binIcon", aria: { hidden: "true" } }, [bin.emoji]),
            api.el("span", { class: "af__binText" }, [bin.label]),
          ]);
          b.addEventListener("click", () => {
            if (i !== r.answerIdx) { api.tryAgain(b); return; }
            api.say(r.n + "! That's " + (r.n < 5 ? "fewer" : "more") + " than 5.");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "Great number sense!" }); else { api.roundWin(); newRound(); }
          });
          bins.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- The Fruit Graph (pictograph reading — most / fewest) ----
  F.register({
    id: "fruit-graph", icon: "📊", title: "The Fruit Graph", skill: "pictograph reading [P]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 4; let round = 0, lastAsk = null;
      const graph = api.el("div", { class: "choices choices--3 graph" });
      api.stage.append(graph);
      function newRound() {
        const r = L.makeGraphPick(api.C.GRAPH_FRUITS || ["🍎", "🍌", "🍇"], undefined, lastAsk); lastAsk = r.ask;
        api.setPrompt(r.ask === "most" ? "Which fruit is there the MOST of?" : "Which fruit is there the FEWEST of?", [r.ask === "most" ? "⬆️" : "⬇️", "📊", "👉"]);
        api.speak(); api.say(r.ask === "most" ? "Which has the most?" : "Which has the fewest?");
        graph.innerHTML = "";
        r.cols.forEach((c, i) => {
          const stack = api.el("button", { class: "choice graph__col tap", type: "button", dataset: i === r.answerIdx ? { correct: "1" } : {}, aria: { label: c.n + " fruit" } });
          for (let k = 0; k < c.n; k++) stack.appendChild(api.el("span", { class: "graph__fruit", aria: { hidden: "true" } }, [c.emoji]));
          stack.addEventListener("click", () => {
            if (i !== r.answerIdx) { api.tryAgain(stack); return; }
            api.say(c.n + "!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "You read the graph!" }); else { api.roundWin(); newRound(); }
          });
          graph.appendChild(stack);
        });
      }
      newRound();
    },
  });

  // ---- Fullest Glass (volume compare) ----
  F.register({
    id: "full-glass", icon: "🥛", title: "Fullest Glass", skill: "volume compare [P]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 4; let round = 0, lastAsk = null;
      const row = api.el("div", { class: "choices choices--3 glass__row" });
      api.stage.append(row);
      function glassSVG(fill) {
        return '<svg viewBox="0 0 60 110" width="100%" height="118" aria-hidden="true"><rect x="10" y="4" width="40" height="100" rx="6" fill="none" stroke="#8fb7d6" stroke-width="3"/><rect x="13" y="' + (104 - fill) + '" width="34" height="' + fill + '" rx="3" fill="#5ec8ff" opacity="0.85"/></svg>';
      }
      function newRound() {
        const r = L.makeGlassPick(undefined, lastAsk); lastAsk = r.ask;
        api.setPrompt(r.ask === "full" ? "Tap the FULLEST glass!" : "Tap the EMPTIEST glass!", ["🥛", "👀", "👉"]);
        api.speak(); api.say(r.ask === "full" ? "Which glass is the fullest?" : "Which glass is the emptiest?");
        row.innerHTML = "";
        r.fills.forEach((f, i) => {
          const b = api.el("button", { class: "choice glass__glass tap", type: "button", html: glassSVG(f), dataset: i === r.answerIdx ? { correct: "1" } : {}, aria: { label: "glass" } });
          b.addEventListener("click", () => {
            if (i !== r.answerIdx) { api.tryAgain(b); return; }
            api.say(r.ask === "full" ? "That one is the fullest!" : "That one is the emptiest!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "You compared them all!" }); else { api.roundWin(); newRound(); }
          });
          row.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Partner Up! (parity through pairing — mechanic A-lite, toy contract) ----
  F.register({
    id: "partner-up", icon: "🦆", title: "Partner Up!", skill: "odd / even [P]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 4; let round = 0, last = -1;
      const banner = api.el("div", { class: "partner__say", aria: { live: "polite" } }, ["Can every duck find a partner?"]);
      const pond = api.el("div", { class: "choices choices--3 partner__pond" });
      api.stage.append(banner, pond);
      function newRound() {
        const r = L.makePartnerUp(undefined, last); last = r.n;
        let held = null, paired = 0;
        banner.textContent = "Can every duck find a partner?";
        api.setPrompt("Tap two ducks to pair them!", ["🦆", "🤝", "🦆"]);
        api.speak();
        pond.innerHTML = "";
        const ducks = [];
        function reflag() {
          ducks.forEach((d) => delete d.dataset.correct);
          ducks.forEach((d) => { if (!d.dataset.paired && d !== held) d.dataset.correct = "1"; });
        }
        function finish() {
          // Clear every flag BEFORE the deferred newRound — otherwise the just-
          // paired (now disabled) duck keeps its data-correct through the 950ms
          // gap, and the every-game harness spins on a disabled [data-correct]
          // (the "disabled-but-still-tagged control strands the harness" footgun).
          ducks.forEach((d) => delete d.dataset.correct);
          const leftover = ducks.find((d) => !d.dataset.paired);
          if (r.parity === "odd" && leftover) { leftover.textContent = "🦆☂️"; banner.textContent = "ODD — one duck is left over!"; api.say("Odd! One duck is left over."); }
          else { banner.textContent = "EVEN — everyone has a partner!"; api.say("Even! Everyone has a partner!"); }
          round += 1;
          if (round >= ROUNDS) api.win({ say: "You know odd and even!" }); else { api.roundWin(); setTimeout(newRound, 950); }
        }
        for (let i = 0; i < r.n; i++) {
          const b = api.el("button", { class: "choice partner__duck tap", type: "button", aria: { label: "duck" } }, ["🦆"]);
          b.addEventListener("click", () => {
            if (b.dataset.paired) return;
            if (held === b) { held = null; b.classList.remove("held"); reflag(); return; }
            if (!held) { held = b; b.classList.add("held"); reflag(); return; }
            [held, b].forEach((d) => { d.dataset.paired = "1"; d.classList.remove("held"); d.classList.add("partner__duck--paired"); d.disabled = true; });
            held = null; paired += 2;
            api.say("A pair!");
            if (r.n - paired < 2) finish(); else reflag();
          });
          pond.appendChild(b); ducks.push(b);
        }
        reflag();
      }
      newRound();
    },
  });

  // ================= Road to 200 — Set 3, Wave 9 =================
  // ---- Number Maker (trace digits 1-5 — the trace family's missing third) ----
  // Reuses Letter Maker's dot-order machinery verbatim over PATHS_DIGITS.
  F.register({
    id: "number-maker", icon: "✍️", title: "Number Maker", skill: "numeral formation / writing [M]",
    start(api) {
      const C = api.C;
      const ROUNDS = 4;
      let round = 0, step = 0, dots = [];
      const stage = api.el("div", { class: "trace__stage" });
      const guide = api.el("div", { class: "lm__guide", aria: { hidden: "true" } });
      stage.appendChild(guide);
      api.stage.append(stage);
      function newRound() {
        const lp = api.randItem(C.PATHS_DIGITS);
        step = 0; dots = [];
        guide.textContent = lp.letter;
        api.setPrompt("Trace the number — tap the dots in order!", ["👆", "🔢", "✍️"]);
        api.speak(); api.say("Trace the number " + lp.letter);
        [...stage.querySelectorAll(".trace__dot, .trace__line")].forEach((n) => n.remove());
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("class", "trace__line"); svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("preserveAspectRatio", "none");
        const poly = document.createElementNS(svgNS, "polyline");
        poly.setAttribute("points", lp.dots.map((p) => p.x + "," + p.y).join(" "));
        poly.setAttribute("fill", "none"); poly.setAttribute("stroke", "#b7c6d6");
        poly.setAttribute("stroke-width", "2.5"); poly.setAttribute("stroke-dasharray", "5 4"); poly.setAttribute("stroke-linecap", "round");
        svg.appendChild(poly); stage.appendChild(svg);
        lp.dots.forEach((p, i) => {
          const dot = api.el("button", {
            class: "trace__dot tap" + (i === 0 ? " trace__dot--start" : ""),
            type: "button", dataset: i === 0 ? { correct: "1" } : {}, aria: { label: "dot " + (i + 1) },
          }, [String(i + 1)]);
          dot.style.left = p.x + "%"; dot.style.top = p.y + "%";
          dot.addEventListener("click", () => {
            if (i === step) {
              dot.classList.add("trace__dot--done"); delete dot.dataset.correct; step += 1;
              if (step >= lp.dots.length) {
                round += 1;
                if (round >= ROUNDS) api.win({ say: "You wrote your numbers!" }); else { api.roundWin(); newRound(); }
              } else if (dots[step]) dots[step].dataset.correct = "1";
            } else api.tryAgain(dot);
          });
          stage.appendChild(dot); dots.push(dot);
        });
      }
      newRound();
    },
  });

  // ---- Duck Pond Stories (acted-out spoken addition — mechanic G) ----
  // The pond PERFORMS a spoken story (a ducks swim in, then b more); the answer
  // is provable by re-counting what's on screen (the profile-legal word problem).
  F.register({
    id: "duck-add", icon: "🦆", title: "Duck Pond Stories", skill: "addition in a story [W]",
    start(api) {
      const L = window.JoshLogic;
      const C = api.C;
      const ROUNDS = 4;
      let round = 0, last = -1;
      const pond = api.el("div", { class: "pond__scene", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(pond, chips);
      function newRound() {
        const r = L.makeStoryAdd(C.STORY_ACTORS, undefined, last); last = r.total;
        pond.innerHTML = "";
        api.setPrompt("Listen to the story — how many " + r.actor.name + "?", ["👂", r.actor.emoji, "🔢"]);
        api.speak();
        api.say(numberWord(r.a) + " " + r.actor.name + " " + r.actor.verb + " in the pond. Then " + numberWord(r.b) + " more come! How many " + r.actor.name + " now?");
        // Act it out: a ducks glide in, then b more (a beat later), each counting.
        let shown = 0;
        function addDuck(extra) {
          const d = api.el("span", { class: "pond__actor pop" + (extra ? " pond__actor--extra" : ""), aria: { hidden: "true" }, text: r.actor.emoji });
          pond.appendChild(d); shown += 1;
        }
        for (let i = 0; i < r.a; i++) addDuck(false);
        setTimeout(() => { if (pond.isConnected) for (let i = 0; i < r.b; i++) addDuck(true); }, 650);
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", { class: "choice choice--num tap", type: "button", text: String(ch.n), dataset: ch.correct ? { correct: "1" } : {}, aria: { label: String(ch.n) } });
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            [...pond.children].forEach((el, i) => setTimeout(() => { if (el.isConnected) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); api.say(String(i + 1)); } }, i * 200));
            round += 1;
            if (round >= ROUNDS) api.win({ say: "Yes! " + r.a + " and " + r.b + " make " + r.total + "!" }); else { api.roundWin({ say: r.a + " and " + r.b + " make " + r.total + "!" }); setTimeout(() => { if (chips.isConnected) newRound(); }, 900); }
          });
          chips.appendChild(b);
        });
      }
      function numberWord(n) { return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"][n] || String(n); }
      newRound();
    },
  });

  // ================= Road to 200 — Set 3, Wave 10 =================
  // ---- How Tall? (measure a thing in unit blocks — mechanic M) ----
  // Stack unit blocks up to the thing's head; the dashed alignment line shows
  // when they're even. The flag clears on the COMPLETING block (piggy-bank law).
  F.register({
    id: "how-tall", icon: "📏", title: "How Tall?", skill: "measure with units [P→W]",
    start(api) {
      const L = window.JoshLogic;
      const THINGS = api.C.TALL_THINGS || [];
      const ROUNDS = 3;
      let round = 0, last = -1, n = 0, stacked = 0;
      const measure = api.el("div", { class: "tall__measure" });
      const col = api.el("div", { class: "tall__col" });
      const thing = api.el("div", { class: "tall__thing", aria: { hidden: "true" } });
      measure.append(col, thing);
      const addBtn = api.el("button", { class: "btn-big tall__add", type: "button" }, ["➕ Add a block"]);
      api.stage.append(measure, addBtn);
      function newRound() {
        const r = L.makeHowTall(THINGS, undefined, last); n = r.height; last = n; stacked = 0;
        col.innerHTML = "";
        // ghost slots show the target height (control of error is visual)
        for (let i = 0; i < n; i++) col.appendChild(api.el("span", { class: "tall__slot" }));
        thing.textContent = r.thing.emoji;
        thing.style.fontSize = (34 + n * 8) + "px";
        addBtn.dataset.correct = "1"; addBtn.disabled = false;
        api.setPrompt("Stack blocks to measure the " + r.thing.name + "!", ["📏", "🧱", "👆"]);
        api.speak(); api.say("How many blocks tall is the " + r.thing.name + "? Stack them up!");
      }
      addBtn.addEventListener("click", () => {
        if (stacked >= n) return;
        const slot = col.children[n - 1 - stacked];
        if (slot) { slot.classList.add("tall__slot--on", "pop"); }
        stacked += 1;
        api.say(String(stacked));
        if (stacked >= n) {
          delete addBtn.dataset.correct; addBtn.disabled = true;
          measure.classList.add("tall__measure--done");
          api.say("The " + THINGS.find((t) => t.emoji === thing.textContent).name + " is " + stacked + " blocks tall!");
          round += 1;
          if (round >= ROUNDS) { setTimeout(() => api.win({ say: "You measured them all!" }), 300); return; }
          api.roundWin();
          setTimeout(() => { if (measure.isConnected) { measure.classList.remove("tall__measure--done"); newRound(); } }, 900);
        }
      });
      newRound();
    },
  });
})();
