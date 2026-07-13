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
      const star = api.el("button", { class: "breathe__star tap", type: "button", dataset: { correct: "1" }, aria: { label: "breathe" } }, ["⭐"]);
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
})();
