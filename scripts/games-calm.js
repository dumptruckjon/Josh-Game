// Calm / fine-motor / co-op games. These protect Josh's growth edges
// (frustration tolerance, confidence) and lean on his TOP lever: 2-player co-op.
// No losing, gentle pace. Test contract kept.
(function () {
  const F = window.JoshFramework;
  const C = window.JoshContent || {};
  if (!F) return;

  // ---- Breathing Star (calm corner / SEL) ----
  // Tap the star to take slow breaths. No wrong answer — a reset for hard moments.
  F.register({
    id: "breathe",
    icon: "🌬️",
    title: "Breathing Star",
    skill: "calm down / SEL [W]",
    start(api) {
      const BREATHS = 4;
      let n = 0;
      const star = api.el("button", {
        class: "breathe__star breathe__star--art tap art-fill", type: "button",
        dataset: { correct: "1" }, aria: { label: "breathe" },
        html: (window.JoshArt && window.JoshArt.star) ? window.JoshArt.star("#ffd24d") : "⭐",
      });
      const label = api.el("div", { class: "breathe__label" }, ["Tap the star and breathe"]);
      api.stage.append(star, label);
      api.setPrompt("Tap the star. Breathe in… and out…", ["🌬️", "⭐", "😌"]);
      api.speak();

      star.addEventListener("click", () => {
        n += 1;
        star.classList.add("breathe--big");
        setTimeout(() => star.classList.remove("breathe--big"), 1600);
        label.textContent = "Breathe in… and out…  (" + n + ")";
        api.say("Breathe");
        if (n >= BREATHS) {
          delete star.dataset.correct;
          api.win({ say: "Nice and calm. Good job." });
        }
      });
    },
  });

  // ---- "I Did It!" Certificate (autonomy / confidence) ----
  F.register({
    id: "certificate",
    icon: "🏅",
    title: "I Did It!",
    skill: "confidence / autonomy [W]",
    start(api) {
      const NEED = 3;
      let placed = 0;
      const cert = api.el("div", { class: "cert" }, [
        api.el("div", { class: "cert__title" }, ["🌟 Great job, Josh! 🌟"]),
      ]);
      const stickers = api.el("div", { class: "cert__stickers" });
      cert.appendChild(stickers);
      const addBtn = api.el("button", { class: "btn-big", type: "button", dataset: { correct: "1" } }, ["Add a sticker 🌟"]);
      const finishBtn = api.el("button", { class: "btn-big cert__finish", type: "button", hidden: "" }, ["I did it! 🎉"]);
      api.stage.append(cert, addBtn, finishBtn);
      api.setPrompt("Decorate your prize, then tap “I did it!”", ["🌟", "✍️", "🎉"]);
      api.speak();

      addBtn.addEventListener("click", () => {
        if (placed >= NEED) return;
        placed += 1;
        stickers.appendChild(api.el("span", { class: "cert__sticker pop", text: api.randItem(C.STICKERS || ["⭐"]) }));
        api.say("Sticker!");
        if (placed >= NEED) {
          delete addBtn.dataset.correct;
          addBtn.hidden = true;
          finishBtn.hidden = false;
          finishBtn.dataset.correct = "1";
        }
      });
      finishBtn.addEventListener("click", () => {
        delete finishBtn.dataset.correct;
        api.win({ say: "You did it, Josh! I'm so proud of you!" });
      });
    },
  });

  // ---- Trace-the-Path (lacing / fine-motor) ----
  // Follow the dashed trail: tap green start → red finish, in order.
  F.register({
    id: "trace-path",
    icon: "🧵",
    title: "Follow the Path",
    skill: "lacing / fine-motor [W]",
    start(api) {
      const ROUNDS = 3;
      let round = 0, step = 0, dots = [];
      const stage = api.el("div", { class: "trace__stage" });
      api.stage.append(stage);

      function newRound() {
        const path = api.randItem(C.PATHS);
        step = 0; dots = [];
        api.setPrompt("Follow the path — green to red!", ["🟢", "👉", "🔴"]);
        api.speak();
        stage.innerHTML = "";

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("class", "trace__line");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.setAttribute("preserveAspectRatio", "none");
        const poly = document.createElementNS(svgNS, "polyline");
        poly.setAttribute("points", path.map((p) => p.x + "," + p.y).join(" "));
        poly.setAttribute("fill", "none");
        poly.setAttribute("stroke", "#b7c6d6");
        poly.setAttribute("stroke-width", "2.5");
        poly.setAttribute("stroke-dasharray", "5 4");
        poly.setAttribute("stroke-linecap", "round");
        svg.appendChild(poly);
        stage.appendChild(svg);

        path.forEach((p, i) => {
          const isStart = i === 0, isEnd = i === path.length - 1;
          const dot = api.el("button", {
            class: "trace__dot tap" + (isStart ? " trace__dot--start" : "") + (isEnd ? " trace__dot--end" : ""),
            type: "button", dataset: i === 0 ? { correct: "1" } : {},
            aria: { label: isStart ? "start" : isEnd ? "finish" : "step " + i },
          }, [isStart ? "🟢" : isEnd ? "🔴" : String(i + 1)]);
          dot.style.left = p.x + "%";
          dot.style.top = p.y + "%";
          dot.addEventListener("click", () => {
            if (i === step) {
              dot.classList.add("trace__dot--done");
              step += 1;
              delete dot.dataset.correct;
              if (step >= path.length) {
                round += 1;
                if (round >= ROUNDS) api.win();
                else { api.roundWin(); newRound(); }
              } else if (dots[step]) {
                dots[step].dataset.correct = "1";
              }
            } else api.tryAgain(dot);
          });
          stage.appendChild(dot);
          dots.push(dot);
        });
      }
      newRound();
    },
  });

  // ---- Team Hop (2-player co-op — HIS TOP LEVER) ----
  // Take turns tapping to hop your hero home. Nobody loses: when BOTH reach home
  // you win together. A turn indicator shows whose go it is (no adult referee).
  F.register({
    id: "team-hop",
    icon: "🤝",
    title: "Team Hop (2 players)",
    skill: "co-op / turn-taking [W]",
    start(api) {
      const GOAL = 5;
      let friend = api.friend();
      if (friend.name === "Josh") friend = api.friend();
      const players = [
        { name: "Josh", emoji: "🕷️", pos: 0, done: false },
        { name: friend.name, emoji: "🕸️", pos: 0, done: false },
      ];
      let turn = 0;

      const turnEl = api.el("div", { class: "coop__turn", aria: { live: "polite" } });
      const lanes = api.el("div", { class: "coop__lanes" });
      api.stage.append(turnEl, lanes);

      const laneEls = players.map((p) => {
        const token = api.el("span", { class: "coop__token", text: p.emoji });
        const home = api.el("span", { class: "coop__home", text: "🏠" });
        const track = api.el("div", { class: "coop__track" }, [token, home]);
        const btn = api.el("button", { class: "coop__btn tap", type: "button", aria: { label: p.name + " hop" } }, [p.emoji + " Hop!"]);
        const lane = api.el("div", { class: "coop__lane" }, [track, btn]);
        lanes.appendChild(lane);
        btn.addEventListener("click", () => hop(players.indexOf(p)));
        return { token, btn };
      });

      function place(idx) { laneEls[idx].token.style.left = (players[idx].pos / GOAL * 100) + "%"; }

      function updateTurn() {
        if (players[0].done && players[1].done) return;
        if (players[turn].done) turn = turn === 0 ? 1 : 0;
        players.forEach((p, idx) => {
          const active = idx === turn && !p.done;
          laneEls[idx].btn.classList.toggle("coop__btn--active", active);
          if (active) laneEls[idx].btn.dataset.correct = "1"; else delete laneEls[idx].btn.dataset.correct;
        });
        turnEl.textContent = players[turn].emoji + " " + players[turn].name + "’s turn!";
      }

      function hop(idx) {
        if (players[idx].done) return;
        if (idx !== turn) { api.tryAgain(laneEls[idx].btn); return; }
        players[idx].pos += 1;
        place(idx);
        api.say("Hop!");
        if (players[idx].pos >= GOAL) { players[idx].done = true; laneEls[idx].token.textContent = "🎉"; }
        if (players[0].done && players[1].done) { api.win({ say: "You both got home! Yay!" }); return; }
        turn = turn === 0 ? 1 : 0;
        updateTurn();
      }

      api.setPrompt("Take turns! Help both heroes hop home.", ["🕷️", "🔁", "🏠"]);
      api.speak();
      players.forEach((_, i) => place(i));
      updateTurn();
    },
  });

  // ---- Team Tower (2-player co-op build) ----
  // Take turns adding blocks to a SHARED tower; reach the goal together = win.
  F.register({
    id: "team-build",
    icon: "🏗️",
    title: "Team Tower (2 players)",
    skill: "co-op / build together [W]",
    start(api) {
      const GOAL = 6;
      let friend = api.friend();
      if (friend.name === "Josh") friend = api.friend();
      const players = [{ name: "Josh", emoji: "🕷️" }, { name: friend.name, emoji: "🕸️" }];
      let turn = 0, count = 0;

      const turnEl = api.el("div", { class: "coop__turn", aria: { live: "polite" } });
      const tower = api.el("div", { class: "build__tower" });
      const p0 = api.el("button", { class: "coop__btn tap", type: "button", aria: { label: players[0].name + " add block" } }, [players[0].emoji + " Add block"]);
      const p1 = api.el("button", { class: "coop__btn tap", type: "button", aria: { label: players[1].name + " add block" } }, [players[1].emoji + " Add block"]);
      const btns = api.el("div", { class: "coop__lanes" }, [p0, p1]);
      api.stage.append(turnEl, tower, btns);
      const laneBtns = [p0, p1];

      function update() {
        laneBtns.forEach((b, i) => {
          const active = i === turn;
          b.classList.toggle("coop__btn--active", active);
          if (active) b.dataset.correct = "1"; else delete b.dataset.correct;
        });
        turnEl.textContent = players[turn].emoji + " " + players[turn].name + "’s turn!";
      }
      function add(i) {
        if (i !== turn) { api.tryAgain(laneBtns[i]); return; }
        count += 1;
        const block = api.el("div", {
          class: "build__block pop",
          style: { background: (api.C.BLOCK_COLORS || ["#5ec8ff"])[(count - 1) % (api.C.BLOCK_COLORS || ["#5ec8ff"]).length] },
        }, [players[i].emoji]);
        tower.insertBefore(block, tower.firstChild);
        api.say("Block " + count);
        if (count >= GOAL) { api.win({ say: "You built it together! Yay!" }); return; }
        turn = turn === 0 ? 1 : 0;
        update();
      }
      p0.addEventListener("click", () => add(0));
      p1.addEventListener("click", () => add(1));
      api.setPrompt("Take turns adding blocks to your tower!", ["🕷️", "🔁", "🏗️"]);
      api.speak();
      update();
    },
  });

  // ---- Team Count (2-player co-op: take turns counting to 10 together) ----
  F.register({
    id: "team-count",
    icon: "🔟",
    title: "Team Count (2 players)",
    skill: "co-op / counting together",
    start(api) {
      const GOAL = 10;
      let friend = api.friend();
      if (friend.name === "Josh") friend = api.friend();
      const players = [{ name: "Josh", emoji: "🕷️" }, { name: friend.name, emoji: "🕸️" }];
      let turn = 0, count = 0;

      const turnEl = api.el("div", { class: "coop__turn", aria: { live: "polite" } });
      const countEl = api.el("div", { class: "tc__count" }, ["0"]);
      const dots = api.el("div", { class: "tc__dots" });
      const p0 = api.el("button", { class: "coop__btn tap", type: "button", aria: { label: players[0].name + " add one" } }, [players[0].emoji + " +1"]);
      const p1 = api.el("button", { class: "coop__btn tap", type: "button", aria: { label: players[1].name + " add one" } }, [players[1].emoji + " +1"]);
      const btns = api.el("div", { class: "coop__lanes" }, [p0, p1]);
      api.stage.append(turnEl, countEl, dots, btns);
      const laneBtns = [p0, p1];
      for (let i = 0; i < GOAL; i++) dots.appendChild(api.el("span", { class: "tc__dot" }));

      function update() {
        laneBtns.forEach((b, i) => {
          const active = i === turn;
          b.classList.toggle("coop__btn--active", active);
          if (active) b.dataset.correct = "1"; else delete b.dataset.correct;
        });
        turnEl.textContent = players[turn].emoji + " " + players[turn].name + "’s turn!";
      }
      function add(i) {
        if (i !== turn) { api.tryAgain(laneBtns[i]); return; }
        count += 1;
        countEl.textContent = String(count);
        if (dots.children[count - 1]) dots.children[count - 1].classList.add("tc__dot--on");
        api.say(String(count));
        if (count >= GOAL) { laneBtns.forEach((b) => delete b.dataset.correct); api.win({ say: "You counted to ten together! Yay!" }); return; }
        turn = turn === 0 ? 1 : 0;
        update();
      }
      p0.addEventListener("click", () => add(0));
      p1.addEventListener("click", () => add(1));
      api.setPrompt("Take turns! Count to 10 together.", ["🕷️", "🔁", "🔟"]);
      api.speak();
      update();
    },
  });

  // ---- Team Rocket (2-player co-op: take turns fueling, then blast off) ----
  F.register({
    id: "team-rocket",
    icon: "🚀",
    title: "Team Rocket (2 players)",
    skill: "co-op / build together",
    start(api) {
      const GOAL = 8;
      let friend = api.friend();
      if (friend.name === "Josh") friend = api.friend();
      const players = [{ name: "Josh", emoji: "🕷️" }, { name: friend.name, emoji: "🕸️" }];
      let turn = 0, fuel = 0;

      const turnEl = api.el("div", { class: "coop__turn", aria: { live: "polite" } });
      const rocketEl = api.el("div", { class: "rocket-art art-fill", aria: { hidden: "true" }, html: (window.JoshArt && window.JoshArt.rocket) ? window.JoshArt.rocket() : "🚀" });
      const gauge = api.el("div", { class: "tc__dots" });
      const p0 = api.el("button", { class: "coop__btn tap", type: "button", aria: { label: players[0].name + " add fuel" } }, [players[0].emoji + " Fuel"]);
      const p1 = api.el("button", { class: "coop__btn tap", type: "button", aria: { label: players[1].name + " add fuel" } }, [players[1].emoji + " Fuel"]);
      const btns = api.el("div", { class: "coop__lanes" }, [p0, p1]);
      api.stage.append(turnEl, rocketEl, gauge, btns);
      const laneBtns = [p0, p1];
      for (let i = 0; i < GOAL; i++) gauge.appendChild(api.el("span", { class: "tc__dot" }));

      function update() {
        laneBtns.forEach((b, i) => {
          const active = i === turn;
          b.classList.toggle("coop__btn--active", active);
          if (active) b.dataset.correct = "1"; else delete b.dataset.correct;
        });
        turnEl.textContent = players[turn].emoji + " " + players[turn].name + "’s turn — fuel up!";
      }
      function add(i) {
        if (i !== turn) { api.tryAgain(laneBtns[i]); return; }
        fuel += 1;
        if (gauge.children[fuel - 1]) gauge.children[fuel - 1].classList.add("tc__dot--on");
        api.say("Fuel " + fuel);
        if (fuel >= GOAL) {
          rocketEl.classList.add("rocket-art--launch");
          laneBtns.forEach((b) => delete b.dataset.correct);
          api.win({ say: "Blast off! You did it together!" });
          return;
        }
        turn = turn === 0 ? 1 : 0;
        update();
      }
      p0.addEventListener("click", () => add(0));
      p1.addEventListener("click", () => add(1));
      api.setPrompt("Take turns adding fuel, then blast off!", ["🕷️", "🔁", "🚀"]);
      api.speak();
      update();
    },
  });

  // ---- Team Treasure Hunt (2-player co-op find — take turns, share the chest) ----
  F.register({
    id: "team-treasure",
    icon: "💎",
    title: "Team Treasure (2 players)",
    skill: "co-op / visual search [W]",
    start(api) {
      const L = window.JoshLogic;
      const GOAL = 6;
      const POOL = (api.C.FIND_POOL || ["🐶", "🐱", "⭐"]);
      let friend = api.friend();
      if (friend.name === "Josh") friend = api.friend();
      const players = [{ name: "Josh", emoji: "🕷️" }, { name: friend.name, emoji: "🕸️" }];
      let turn = 0, found = 0;

      const turnEl = api.el("div", { class: "coop__turn", aria: { live: "polite" } });
      const chest = api.el("div", { class: "tt2__chest" });
      const field = api.el("div", { class: "find__field" });
      api.stage.append(turnEl, chest, field);
      for (let i = 0; i < GOAL; i++) chest.appendChild(api.el("span", { class: "tt2__slot" }, ["▫️"]));

      function place() {
        turnEl.textContent = players[turn].emoji + " " + players[turn].name + "’s turn — find the 💎!";
        const size = 9;
        // one treasure among distractors (distractors are never 💎)
        const distract = L.sample(POOL.filter((e) => e !== "💎"), size - 1);
        const cells = L.shuffle([{ emoji: "💎", correct: true }, ...distract.map((e) => ({ emoji: e, correct: false }))]);
        field.innerHTML = "";
        cells.forEach((cell) => {
          const b = api.el("button", {
            class: "find__cell tap", type: "button", text: cell.emoji,
            dataset: cell.correct ? { correct: "1" } : {}, aria: { label: cell.correct ? "treasure" : "picture" },
          });
          b.addEventListener("click", () => {
            if (!cell.correct) { api.tryAgain(b); return; }
            found += 1;
            if (chest.children[found - 1]) chest.children[found - 1].textContent = "💎";
            api.say("Treasure! " + found);
            if (found >= GOAL) { field.innerHTML = ""; api.win({ say: "You filled the treasure chest together! Yay!" }); return; }
            turn = turn === 0 ? 1 : 0;
            place();
          });
          field.appendChild(b);
        });
      }
      api.setPrompt("Take turns finding the treasure — fill the chest together!", ["🕷️", "🔁", "💎"]);
      api.speak();
      place();
    },
  });

  // ---- Stepping-Stone Bridge (2-player co-op: build ONE shared path) ----
  // Unlike Team Hop's two parallel lanes, both kids build a SINGLE bridge across
  // the river in order, then cross together — pure cooperation, nobody "ahead."
  F.register({
    id: "team-bridge",
    icon: "🌉",
    title: "Team Bridge (2 players)",
    skill: "co-op / counting together [W]",
    start(api) {
      const GOAL = 6;
      let friend = api.friend();
      if (friend.name === "Josh") friend = api.friend();
      const players = [{ name: "Josh", emoji: "🕷️" }, { name: friend.name, emoji: "🕸️" }];
      let turn = 0, placed = 0;

      const turnEl = api.el("div", { class: "coop__turn", aria: { live: "polite" } });
      const river = api.el("div", { class: "bridge" });
      const heroL = api.el("span", { class: "bridge__hero bridge__hero--l" }, [players[0].emoji]);
      const heroR = api.el("span", { class: "bridge__hero bridge__hero--r" }, [players[1].emoji]);
      const stones = api.el("div", { class: "bridge__stones" });
      const slots = [];
      for (let i = 0; i < GOAL; i++) {
        const s = api.el("span", { class: "bridge__slot" });
        stones.appendChild(s); slots.push(s);
      }
      river.append(heroL, stones, heroR);

      const p0 = api.el("button", { class: "coop__btn tap", type: "button", aria: { label: players[0].name + " place a stone" } }, [players[0].emoji + " Stone"]);
      const p1 = api.el("button", { class: "coop__btn tap", type: "button", aria: { label: players[1].name + " place a stone" } }, [players[1].emoji + " Stone"]);
      const btns = api.el("div", { class: "coop__lanes" }, [p0, p1]);
      api.stage.append(turnEl, river, btns);
      const laneBtns = [p0, p1];

      function update() {
        laneBtns.forEach((b, i) => {
          const active = i === turn;
          b.classList.toggle("coop__btn--active", active);
          if (active) b.dataset.correct = "1"; else delete b.dataset.correct;
        });
        turnEl.textContent = players[turn].emoji + " " + players[turn].name + "’s turn — place a stone!";
      }
      function add(i) {
        if (i !== turn) { api.tryAgain(laneBtns[i]); return; }
        // Stones fill strictly left→right so the bridge is always continuous.
        slots[placed].classList.add("bridge__slot--on");
        slots[placed].textContent = "🪨";
        placed += 1;
        api.say(String(placed));
        if (placed >= GOAL) {
          laneBtns.forEach((b) => delete b.dataset.correct);
          river.classList.add("bridge--cross");
          api.win({ say: "You built the bridge and crossed together! Yay!" });
          return;
        }
        turn = turn === 0 ? 1 : 0;
        update();
      }
      p0.addEventListener("click", () => add(0));
      p1.addEventListener("click", () => add(1));
      api.setPrompt("Take turns building one bridge, then cross together!", ["🕷️", "🔁", "🌉"]);
      api.speak();
      update();
    },
  });
})();
