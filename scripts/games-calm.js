// Calm / fine-motor / co-op games. These protect Josh's growth edges
// (frustration tolerance, confidence) and lean on his TOP lever: 2-player co-op.
// No losing, gentle pace. Test contract kept.
(function () {
  const F = window.JoshFramework;
  const C = window.JoshContent || {};
  if (!F) return;

  const FRIENDS = C.FRIENDS || [];
  const artOf = (nm) => (FRIENDS.find((f) => f.name === nm) || {}).art;
  // Co-op turn banner showing the current player's PORTRAIT — so "Josh's turn!"
  // shows Josh's face and each friend shows theirs. Shared by every co-op game.
  function coopTurn(turnEl, player, tail) {
    turnEl.innerHTML = "";
    const spec = player.art || artOf(player.name);
    const face = document.createElement("span");
    face.className = "coop__face art-fill";
    face.setAttribute("aria-hidden", "true");
    face.innerHTML = (window.JoshArt && window.JoshArt.friend && spec) ? window.JoshArt.friend(spec) : (player.emoji || "");
    turnEl.append(face, document.createTextNode(" " + player.name + "’s turn" + (tail || "!")));
  }

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
        if (n >= BREATHS) return; // already calm & won — don't re-fire the celebration
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
        api.el("div", {
          class: "cert__face art-fill", aria: { hidden: "true" },
          html: (window.JoshArt && window.JoshArt.friend && artOf("Josh")) ? window.JoshArt.friend(artOf("Josh")) : "",
        }),
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
      let finished = false;
      finishBtn.addEventListener("click", () => {
        if (finished) return; // don't re-fire the celebration on extra taps
        finished = true;
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
        coopTurn(turnEl, players[turn]);
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
    title: "Team Number Tower (2 players)",
    skill: "co-op / count to 10 [M]",
    start(api) {
      const GOAL = 10;
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
        coopTurn(turnEl, players[turn]);
      }
      function add(i) {
        if (i !== turn) { api.tryAgain(laneBtns[i]); return; }
        count += 1;
        const block = api.el("div", {
          class: "build__block pop",
          style: { background: (api.C.BLOCK_COLORS || ["#5ec8ff"])[(count - 1) % (api.C.BLOCK_COLORS || ["#5ec8ff"]).length] },
        }, [String(count)]); // numbered like a Numberblock — count aloud as it grows
        tower.insertBefore(block, tower.firstChild);
        api.say(String(count));
        if (count >= GOAL) { api.win({ say: "You built a tower of ten together! Yay!" }); return; }
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
    title: "Team Count by 2s (2 players)",
    skill: "co-op / count by 2s [W]",
    start(api) {
      const GOAL = 10;
      let friend = api.friend();
      if (friend.name === "Josh") friend = api.friend();
      const players = [{ name: "Josh", emoji: "🕷️" }, { name: friend.name, emoji: "🕸️" }];
      let turn = 0, count = 0;

      const turnEl = api.el("div", { class: "coop__turn", aria: { live: "polite" } });
      const countEl = api.el("div", { class: "tc__count" }, ["0"]);
      const dots = api.el("div", { class: "tc__dots" });
      const p0 = api.el("button", { class: "coop__btn tap", type: "button", aria: { label: players[0].name + " add two" } }, [players[0].emoji + " +2"]);
      const p1 = api.el("button", { class: "coop__btn tap", type: "button", aria: { label: players[1].name + " add two" } }, [players[1].emoji + " +2"]);
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
        coopTurn(turnEl, players[turn]);
      }
      function add(i) {
        if (i !== turn) { api.tryAgain(laneBtns[i]); return; }
        count += 2; // skip-count by 2s: 2, 4, 6, 8, 10
        countEl.textContent = String(count);
        for (let d = count - 2; d < count; d++) if (dots.children[d]) dots.children[d].classList.add("tc__dot--on");
        api.say(String(count));
        if (count >= GOAL) { laneBtns.forEach((b) => delete b.dataset.correct); api.win({ say: "You counted by twos to ten! Yay!" }); return; }
        turn = turn === 0 ? 1 : 0;
        update();
      }
      p0.addEventListener("click", () => add(0));
      p1.addEventListener("click", () => add(1));
      api.setPrompt("Take turns! Count by 2s to 10 together.", ["🕷️", "🔁", "🔢"]);
      api.speak();
      update();
    },
  });

  // ---- Team Rocket (2-player co-op: take turns fueling, then blast off) ----
  F.register({
    id: "team-rocket",
    icon: "🚀",
    title: "Team Countdown (2 players)",
    skill: "co-op / count down [W]",
    start(api) {
      const START = 5;
      let friend = api.friend();
      if (friend.name === "Josh") friend = api.friend();
      const players = [{ name: "Josh", emoji: "🕷️" }, { name: friend.name, emoji: "🕸️" }];
      let turn = 0, remaining = START;

      const turnEl = api.el("div", { class: "coop__turn", aria: { live: "polite" } });
      const rocketEl = api.el("div", { class: "rocket-art art-fill", aria: { hidden: "true" }, html: (window.JoshArt && window.JoshArt.rocket) ? window.JoshArt.rocket() : "🚀" });
      // A big live number so the countdown is VISIBLE (5→4→3→2→1→🚀), not only
      // spoken — a non-reader can watch it drop.
      const numEl = api.el("div", { class: "tc__num", aria: { hidden: "true" }, text: String(START) });
      const gauge = api.el("div", { class: "tc__dots" });
      const p0 = api.el("button", { class: "coop__btn tap", type: "button", aria: { label: players[0].name + " count down" } }, [players[0].emoji + " Count down"]);
      const p1 = api.el("button", { class: "coop__btn tap", type: "button", aria: { label: players[1].name + " count down" } }, [players[1].emoji + " Count down"]);
      const btns = api.el("div", { class: "coop__lanes" }, [p0, p1]);
      api.stage.append(turnEl, rocketEl, numEl, gauge, btns);
      const laneBtns = [p0, p1];
      // Start with all lights ON; each turn takes one away as we count down.
      for (let i = 0; i < START; i++) gauge.appendChild(api.el("span", { class: "tc__dot tc__dot--on" }));

      function update() {
        laneBtns.forEach((b, i) => {
          const active = i === turn;
          b.classList.toggle("coop__btn--active", active);
          if (active) b.dataset.correct = "1"; else delete b.dataset.correct;
        });
        coopTurn(turnEl, players[turn], " — fuel up!");
      }
      function add(i) {
        if (i !== turn) { api.tryAgain(laneBtns[i]); return; }
        remaining -= 1;
        if (gauge.children[remaining]) gauge.children[remaining].classList.remove("tc__dot--on");
        numEl.textContent = remaining > 0 ? String(remaining) : "🚀";
        api.say(remaining > 0 ? String(remaining) : "Blast off!");
        if (remaining <= 0) {
          rocketEl.classList.add("rocket-art--launch");
          laneBtns.forEach((b) => delete b.dataset.correct);
          api.win({ say: "Zero — blast off! You counted down together!" });
          return;
        }
        turn = turn === 0 ? 1 : 0;
        update();
      }
      p0.addEventListener("click", () => add(0));
      p1.addEventListener("click", () => add(1));
      api.setPrompt("Take turns counting down: 5, 4, 3, 2, 1… blast off!", ["🕷️", "🔁", "🚀"]);
      api.speak();
      update();
    },
  });

  // ---- Team Sound Hunt (2-player co-op: take turns finding a starting sound) ----
  F.register({
    id: "team-sound-hunt",
    icon: "👂",
    title: "Team Sound Hunt (2 players)",
    skill: "co-op / beginning sounds [W]",
    start(api) {
      const L = window.JoshLogic;
      const WORDS = api.C.FIRST_SOUND_WORDS || [];
      const GOAL = 6;
      let friend = api.friend();
      if (friend.name === "Josh") friend = api.friend();
      const players = [{ name: "Josh", emoji: "🕷️" }, { name: friend.name, emoji: "🕸️" }];
      let turn = 0, found = 0;

      const turnEl = api.el("div", { class: "coop__turn", aria: { live: "polite" } });
      const targetEl = api.el("div", { class: "find__target" });
      const basket = api.el("div", { class: "tt2__chest" });
      const field = api.el("div", { class: "find__field" });
      api.stage.append(turnEl, targetEl, basket, field);
      for (let i = 0; i < GOAL; i++) basket.appendChild(api.el("span", { class: "tt2__slot" }, ["▫️"]));

      function place() {
        const r = L.makeSoundHunt(WORDS, 6);
        coopTurn(turnEl, players[turn]);
        targetEl.innerHTML = "";
        targetEl.append(
          api.el("span", { class: "find__targetEmoji", text: r.letter }),
          api.el("span", { class: "find__targetLabel", text: "find this sound" })
        );
        api.setPrompt("Find something that starts with " + r.letter + "!", ["👂", r.letter, "👆"]);
        api.speak();
        field.innerHTML = "";
        r.cells.forEach((cell) => {
          const b = api.el("button", {
            class: "find__cell tap", type: "button", text: cell.emoji,
            dataset: cell.correct ? { correct: "1" } : {}, aria: { label: cell.word },
          });
          b.addEventListener("click", () => {
            if (!cell.correct) { api.tryAgain(b); return; }
            found += 1;
            if (basket.children[found - 1]) basket.children[found - 1].textContent = "⭐";
            api.say(cell.word);
            if (found >= GOAL) { field.innerHTML = ""; api.win({ say: "Great teamwork! You found them all!" }); return; }
            turn = turn === 0 ? 1 : 0;
            place();
          });
          field.appendChild(b);
        });
      }
      api.setPrompt("Take turns! Find the starting sound together.", ["🕷️", "🔁", "👂"]);
      api.speak();
      place();
    },
  });

  // ---- Memory Together (2-player co-op concentration — find pairs as a team) ----
  F.register({
    id: "memory-together",
    icon: "🧠",
    title: "Memory Together (2 players)",
    skill: "co-op / memory [M]",
    start(api) {
      const L = window.JoshLogic;
      const C = api.C;
      const PAIRS = 4;
      let friend = api.friend();
      if (friend.name === "Josh") friend = api.friend();
      const players = [{ name: "Josh", emoji: "🕷️" }, { name: friend.name, emoji: "🕸️" }];
      let turn = 0, first = null, lock = false, matched = 0, cards = [];

      const turnEl = api.el("div", { class: "coop__turn", aria: { live: "polite" } });
      const grid = api.el("div", { class: "memory-grid" });
      api.stage.append(turnEl, grid);

      function showTurn() { coopTurn(turnEl, players[turn]); }
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
          if (matched === PAIRS) { api.win({ say: "You found them all — together!" }); return; }
          turn = turn === 0 ? 1 : 0; showTurn(); // a match passes the turn too (fair, no-lose)
        } else {
          lock = true;
          const a = first; first = null;
          setTimeout(() => {
            a.classList.remove("flipped"); a.textContent = "";
            card.classList.remove("flipped"); card.textContent = "";
            lock = false; turn = turn === 0 ? 1 : 0; showTurn(); syncFlags();
          }, 700);
        }
      }
      function build() {
        const pool = L.shuffle(C.MEMORY_EMOJIS).slice(0, PAIRS);
        const deck = L.shuffle([...pool, ...pool]);
        cards = []; first = null; lock = false; matched = 0; turn = 0;
        api.setPrompt("Take turns! Find the matching pairs together.", ["🕷️", "🔁", "🃏"]);
        api.speak();
        grid.innerHTML = "";
        deck.forEach((em) => {
          const card = api.el("button", { class: "memory-card tap", type: "button", dataset: { emoji: em }, aria: { label: "card" } }, [""]);
          card.addEventListener("click", () => flip(card));
          grid.appendChild(card); cards.push(card);
        });
        showTurn();
        syncFlags();
      }
      build();
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
        coopTurn(turnEl, players[turn], " — find the 💎!");
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
        coopTurn(turnEl, players[turn], " — place a stone!");
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

  // ---- Friends Race (co-op skill race — take turns, everyone's a winner) ----
  // Two friends race up the track by answering a real skill (which rhymes?),
  // personalised with the friends' own PORTRAITS as the racers. No losing: when
  // the first reaches the flag, both hop to the finish and celebrate together.
  F.register({
    id: "friend-race",
    icon: "🏁",
    title: "Friends Race (2 players)",
    skill: "co-op + rhyming [W]",
    start(api) {
      const L = window.JoshLogic || {};
      const ART = window.JoshArt;
      const FRIENDS = C.FRIENDS || [];
      const GOAL = 4;
      const specOf = (nm) => (FRIENDS.find((f) => f.name === nm) || {}).art;
      const face = (spec) => (ART && ART.friend) ? ART.friend(spec) : "";
      let other = api.friend(); if (other.name === "Josh") other = api.friend();
      const players = [
        { name: "Josh", spec: specOf("Josh"), step: 0 },
        { name: other.name, spec: specOf(other.name), step: 0 },
      ];
      let turn = 0, done = false;

      const turnEl = api.el("div", { class: "coop__turn", aria: { live: "polite" } });
      const target = api.el("div", { class: "big-pic", aria: { hidden: "true" } });
      const choices = api.el("div", { class: "choices choices--3" });
      const track = api.el("div", { class: "race__track" });
      const tokens = players.map((p) => {
        const rail = api.el("div", { class: "race__rail" });
        const tok = api.el("div", { class: "race__token art-fill", aria: { hidden: "true" }, html: face(p.spec) });
        rail.appendChild(tok);
        track.appendChild(api.el("div", { class: "race__lane" }, [rail, api.el("span", { class: "race__flag" }, ["🏁"])]));
        return tok;
      });
      api.stage.append(turnEl, target, choices, track);

      function place() { players.forEach((p, i) => { tokens[i].style.left = (4 + (p.step / GOAL) * 76) + "%"; }); }
      function showTurn() {
        turnEl.innerHTML = "";
        turnEl.append(
          api.el("span", { class: "race__mini art-fill", aria: { hidden: "true" }, html: face(players[turn].spec) }),
          document.createTextNode(" " + players[turn].name + "’s turn!")
        );
      }
      function newRound() {
        showTurn();
        const r = L.makeRhyme(C.RHYME_GROUPS);
        target.textContent = r.target.emoji;
        api.setPrompt("Which one rhymes? " + players[turn].name + "’s turn!", ["👀", "👂", "🏁"]);
        api.speak();
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice tap", type: "button", text: ch.emoji,
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.word || "picture" },
          });
          b.addEventListener("click", () => {
            if (done) return;
            if (!ch.correct) { api.tryAgain(b); return; }
            players[turn].step += 1;
            place();
            if (players[turn].step >= GOAL) {
              done = true;
              players.forEach((p) => { p.step = GOAL; }); place();
              delete b.dataset.correct;
              api.win({ say: "You both raced to the finish! Hooray!" });
              return;
            }
            turn = turn === 0 ? 1 : 0;
            api.roundWin();
            newRound();
          });
          choices.appendChild(b);
        });
      }
      place();
      newRound();
    },
  });

  // ---- 😊 How Do They Feel? (SEL — name the feeling, then help with a breath) ----
  // Identifying a feeling is NEVER judged — the game names it, then models the
  // helping move (one big breath together). This is Josh's real growth edge.
  F.register({
    id: "feelings",
    icon: "😊",
    title: "How Do They Feel?",
    skill: "feelings / empathy [W]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 4;
      let round = 0, lastIdx = -1, r = null;
      const sceneIcons = api.el("div", { class: "fl__icons", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(sceneIcons, chips);
      api.mascot();

      function newRound() {
        r = L.makeFeeling(C.FEELINGS, C.FEELING_STORIES, undefined, lastIdx);
        lastIdx = r.idx;
        api.setPrompt("How do they feel?", ["👂", "🤔", "💛"]);
        api.speak(); api.say(r.story.say + " How does " + r.story.who + " feel?");
        sceneIcons.textContent = r.story.icons.join(" ");
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice fl__face tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.name },
          }, [ch.face]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            b.classList.add("pop");
            const helped = ch.id === "happy" || ch.id === "surprised"
              ? "Yes — " + r.story.who + " feels " + ch.name + "!"
              : "Yes — " + r.story.who + " feels " + ch.name + ". Let's take a big breath together. Breathe in... and out. That helps!";
            round += 1;
            if (round >= ROUNDS) api.win({ say: helped + " You're so good at feelings!" });
            else { api.roundWin({ say: helped }); setTimeout(() => { if (chips.isConnected) newRound(); }, 700); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- 🤝 Kind Helpers (SEL — tap the kind thing to do) ----
  // The un-kind options are silly-neutral (nap, pizza, hide), never mean; a
  // miss is a giggle and a gentle "what would HELP?" redirect.
  F.register({
    id: "kind-helpers",
    icon: "🤝",
    title: "Kind Helpers",
    skill: "kindness / conflict resolution [W]",
    start(api) {
      const L = window.JoshLogic;
      const A = window.JoshAudio || { say() {} };
      const ROUNDS = 4;
      let round = 0, lastIdx = -1, r = null;
      const sceneIcons = api.el("div", { class: "fl__icons", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(sceneIcons, chips);
      api.mascot();

      function newRound() {
        r = L.makeKindness(C.KINDNESS, undefined, lastIdx);
        lastIdx = r.idx;
        api.setPrompt("What's the KIND thing to do?", ["👂", "💛", "👉"]);
        api.speak(); api.say(r.scenario.say + " What's the kind thing to do?");
        sceneIcons.textContent = r.scenario.icons.join(" ");
        chips.innerHTML = "";
        r.options.forEach((opt) => {
          const b = api.el("button", {
            class: "choice kh__opt tap", type: "button",
            dataset: opt.kind ? { correct: "1" } : {}, aria: { label: opt.name },
          }, [opt.emoji]);
          b.addEventListener("click", () => {
            if (!opt.kind) { api.tryAgain(b); A.say("Hmm — what would HELP?"); return; }
            const heart = api.el("span", { class: "kh__heart", text: "💞", aria: { hidden: "true" } });
            b.appendChild(heart);
            setTimeout(() => heart.remove(), 1100);
            round += 1;
            if (round >= ROUNDS) api.win({ say: opt.name + " — that's so kind! You're a wonderful helper!" });
            else { api.roundWin({ say: opt.name + " — that's so kind!" }); setTimeout(() => { if (chips.isConnected) newRound(); }, 700); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- 📅 Day Train (days of the week in rainbow order) ----
  // The week rolls in with one missing day-car. Choices SPEAK their day on the
  // correct tap, and the color rainbow keeps it solvable with sound off (the
  // missing car's color matches its choice — position + color, not reading).
  F.register({
    id: "day-train",
    icon: "📅",
    title: "Day Train",
    skill: "days of the week [M]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 4;
      let round = 0, lastBlank = -1, r = null;
      const train = api.el("div", { class: "dt__train", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(train, chips);

      function newRound() {
        r = L.makeDayTrain(C.DAYS, undefined, lastBlank);
        lastBlank = r.blankIdx;
        api.setPrompt("Which day is missing?", ["📅", "🚂", "🤔"]);
        api.speak(); api.say("Which day is missing? It comes after " + C.DAYS[r.blankIdx - 1].name + "!");
        train.innerHTML = "";
        C.DAYS.forEach((d, i) => {
          train.appendChild(api.el("span", {
            class: "dt__car" + (i === r.blankIdx ? " dt__car--blank" : ""),
            style: i === r.blankIdx ? {} : { background: d.color },
            text: i === r.blankIdx ? "?" : d.abbr,
          }));
        });
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice dt__choice tap", type: "button",
            style: { background: ch.color },
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.name },
          }, [ch.abbr]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); api.say("That's " + ch.name + ". Which one is missing?"); return; }
            const blank = train.querySelector(".dt__car--blank");
            if (blank) { blank.textContent = ch.abbr; blank.style.background = ch.color; blank.classList.remove("dt__car--blank"); blank.classList.add("pop"); }
            api.say(ch.name + "! " + C.DAYS.map((d) => d.name).join(", ") + "!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "You know the whole week!" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Team Story Time (2 players take turns ordering a story) [W] ----
  F.register({
    id: "team-story",
    icon: "📖",
    title: "Team Story Time (2 players)",
    skill: "co-op / sequencing [W]",
    start(api) {
      const C = api.C;
      const L = window.JoshLogic;
      const ROUNDS = 2;
      let round = 0, step = 0, turn = 0;
      let friend = api.friend(); if (friend.name === "Josh") friend = api.friend();
      const players = [{ name: "Josh", emoji: "🕷️" }, { name: friend.name, emoji: "🕸️", art: friend.art }];
      const turnEl = api.el("div", { class: "coop__turn", aria: { live: "polite" } });
      const track = api.el("div", { class: "story__track" });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(turnEl, track, choices);
      function newRound() {
        const r = L.makeStoryOrder(C.STORY_SEQUENCES);
        step = 0;
        api.setPrompt("Take turns! What happens first, next, last?", ["1️⃣", "2️⃣", "3️⃣"]);
        api.speak();
        coopTurn(turnEl, players[turn], " — your turn!");
        track.innerHTML = "";
        for (let i = 0; i < r.order.length; i++) track.appendChild(api.el("span", { class: "story__slot", aria: { hidden: "true" } }, [String(i + 1)]));
        choices.innerHTML = "";
        r.tiles.forEach((tile, idx) => {
          const b = api.el("button", {
            class: "choice tap", type: "button", text: tile.emoji,
            dataset: tile.rank === 0 ? { correct: "1" } : {}, aria: { label: "picture" },
          });
          b.addEventListener("click", () => {
            if (tile.rank !== step) { api.tryAgain(b); return; }
            b.disabled = true; b.classList.add("choice--used"); delete b.dataset.correct;
            track.children[step].textContent = tile.emoji;
            step += 1;
            turn = turn === 0 ? 1 : 0;
            if (step >= r.tiles.length) {
              round += 1;
              if (round >= ROUNDS) api.win({ say: "You told the whole story together!" });
              else { api.roundWin(); newRound(); }
            } else {
              coopTurn(turnEl, players[turn], " — your turn!");
              [...choices.children].forEach((c, i) => { if (!c.disabled && r.tiles[i].rank === step) c.dataset.correct = "1"; else if (!c.disabled) delete c.dataset.correct; });
            }
          });
          choices.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Quiet Garden (a calm cause→effect toy; buds bloom with a soft note) [M] ----
  F.register({
    id: "garden",
    icon: "🌷",
    title: "Quiet Garden",
    skill: "calm / cause→effect [M]",
    start(api) {
      const A = window.JoshAudio || { tone() {}, unlock() {} };
      const NOTES = [330, 392, 440, 494, 523];
      const FLOWERS = ["🌷", "🌸", "🌼", "🌺", "🌻"];
      const pad = api.el("div", { class: "choices choices--3 garden" });
      api.stage.append(pad);
      api.setPrompt("Tap a bud and watch it bloom.", ["🌱", "👆", "😌"]);
      api.speak();
      pad.addEventListener("pointerdown", function warm() { if (A.unlock) A.unlock(); pad.removeEventListener("pointerdown", warm); }, { once: true });
      let bloomed = 0, won = false;
      for (let i = 0; i < 5; i++) {
        const bud = api.el("button", { class: "choice garden__bud tap", type: "button", dataset: { toy: "1" }, aria: { label: "flower bud" } }, ["🌱"]);
        let open = false;
        bud.addEventListener("click", () => {
          api.tickPlay();
          if (!open) {
            open = true; bud.textContent = FLOWERS[i]; bud.classList.add("garden__bud--open");
            if (A.tone) A.tone(NOTES[i], { duration: 0.5 });
            bloomed += 1;
            if (bloomed >= 5 && !won) { won = true; api.win({ say: "What a peaceful garden." }); }
          } else { open = false; bud.textContent = "🌱"; bud.classList.remove("garden__bud--open"); }
        });
        pad.appendChild(bud);
      }
    },
  });

  // ================= Road to 140 — Wave 4 =================

  // ---- Team House Build (2 players — take turns placing pieces) ----
  F.register({
    id: "team-house",
    icon: "🏘️",
    title: "Team House Build (2 players)",
    skill: "co-op / build [W]",
    start(api) {
      const steps = api.C.HOUSE_STEPS || [];
      let friend = api.friend();
      if (friend.name === "Josh") friend = api.friend();
      const players = [{ name: "Josh", emoji: "🧒" }, { name: friend.name, emoji: friend.emoji }];
      let turn = 0, step = 0;
      const turnEl = api.el("div", { class: "coop__turn", aria: { live: "polite" } });
      const house = api.el("div", { class: "house__build", aria: { hidden: "true" } });
      const tray = api.el("div", { class: "choices choices--3" });
      api.stage.append(turnEl, house, tray);
      const trayBtns = steps.map((st, i) => {
        const b = api.el("button", { class: "choice house__piece tap", type: "button", text: st.emoji, aria: { label: "build piece" } });
        b.addEventListener("click", () => {
          if (i !== step) { api.tryAgain(b); return; }
          b.disabled = true; b.classList.add("choice--used"); delete b.dataset.correct;
          house.appendChild(api.el("span", { class: "house__part pop", aria: { hidden: "true" } }, [st.emoji]));
          api.say("We added " + st.say + "!");
          step += 1;
          if (step >= steps.length) { api.win({ say: "You built a house together! Home sweet home!" }); return; }
          turn = turn === 0 ? 1 : 0;
          update();
        });
        return b;
      });
      trayBtns.forEach((b) => tray.appendChild(b));
      function update() {
        trayBtns.forEach((b, i) => { if (i === step && !b.disabled) b.dataset.correct = "1"; else delete b.dataset.correct; });
        coopTurn(turnEl, players[turn], " — add the next piece!");
      }
      api.setPrompt("Take turns building the house!", ["🔁", "🏗️", "🏠"]);
      api.speak();
      update();
    },
  });

  // ---- Hello Around the World (greet each friend in their language) ----
  F.register({
    id: "world-hello",
    icon: "👋",
    title: "Hello Around the World",
    skill: "hello / cultures [M]",
    start(api) {
      const A = window.JoshAudio;
      const greetings = api.C.GREETINGS || [];
      let greeted = 0;
      const bubble = api.el("div", { class: "hello__bubble", aria: { live: "polite" } }, ["Tap a friend to say hello!"]);
      const grid = api.el("div", { class: "choices choices--4 hello__grid" });
      api.stage.append(bubble, grid);
      greetings.forEach((g) => {
        const spec = artOf(g.name);
        const b = api.el("button", {
          class: "choice hello__friend tap art-fill", type: "button",
          dataset: { correct: "1" }, aria: { label: "say hello to " + g.name },
          html: (window.JoshArt && window.JoshArt.friend && spec) ? window.JoshArt.friend(spec) : "🧒",
        });
        b.addEventListener("click", () => {
          b.classList.remove("hello__friend--wave"); void b.offsetWidth; b.classList.add("hello__friend--wave");
          bubble.textContent = g.name + ": " + g.word;
          if (g.lang && A && A.say) A.say(g.say, { lang: g.lang }); else api.say(g.say);
          if (b.dataset.correct) {
            delete b.dataset.correct; greeted += 1;
            if (greeted >= greetings.length) api.win({ say: "You said hello around the whole world!" });
          }
        });
        grid.appendChild(b);
      });
      api.setPrompt("Say hello to each friend!", ["👋", "🌍", "😊"]);
      api.speak();
    },
  });

  // ---- Team Pizza Party (2 players — deal the slices fairly) ----
  F.register({
    id: "team-pizza",
    icon: "🍕",
    title: "Team Pizza Party (2 players)",
    skill: "co-op / fair shares [W]",
    start(api) {
      let friend = api.friend();
      if (friend.name === "Josh") friend = api.friend();
      const players = [{ name: "Josh", emoji: "🧒" }, { name: friend.name, emoji: friend.emoji }];
      let turn = 0, left = 6;
      const turnEl = api.el("div", { class: "coop__turn", aria: { live: "polite" } });
      const plates = api.el("div", { class: "pizza__plates", aria: { hidden: "true" } });
      const plate0 = api.el("div", { class: "pizza__plate" });
      const plate1 = api.el("div", { class: "pizza__plate" });
      plates.append(plate0, plate1);
      const plateEls = [plate0, plate1];
      const tray = api.el("div", { class: "choices choices--3 pizza__tray" });
      api.stage.append(turnEl, plates, tray);
      const slices = [];
      for (let i = 0; i < 6; i++) {
        const b = api.el("button", { class: "choice pizza__slice tap", type: "button", text: "🍕", aria: { label: "pizza slice" } });
        b.addEventListener("click", () => {
          if (b.disabled) return;
          if (!b.dataset.correct) { api.tryAgain(b); return; }
          b.disabled = true; b.classList.add("choice--used"); delete b.dataset.correct;
          plateEls[turn].appendChild(api.el("span", { class: "pizza__got pop", aria: { hidden: "true" } }, ["🍕"]));
          api.say(players[turn].name + " gets a slice!");
          left -= 1;
          if (left <= 0) { api.win({ say: "Three slices each — fair and square!" }); return; }
          turn = turn === 0 ? 1 : 0;
          update();
        });
        slices.push(b); tray.appendChild(b);
      }
      function update() {
        const next = slices.find((s) => !s.disabled);
        slices.forEach((s) => delete s.dataset.correct);
        if (next) next.dataset.correct = "1";
        coopTurn(turnEl, players[turn], " — take a slice!");
      }
      api.setPrompt("Take turns — one slice each!", ["🔁", "🍕", "😋"]);
      api.speak();
      update();
    },
  });

  // ---- Grandma's Visit (find Grandma's 3 things — a warm cross-world moment) ----
  F.register({
    id: "grandma-helper",
    icon: "👵🏻",
    title: "Grandma's Visit",
    skill: "find & help / warmth [M]",
    start(api) {
      const A = window.JoshAudio;
      const data = api.C.GRANDMA_ITEMS || { targets: [], toys: [] };
      const targets = data.targets || [], toys = data.toys || [];
      let found = 0;
      const grid = api.el("div", { class: "grandma__grid choices choices--3" });
      api.stage.append(grid);
      const cells = [];
      targets.forEach((t) => cells.push({ emoji: t.emoji, say: t.say, target: true }));
      api.shuffle(toys.slice()).slice(0, 9 - targets.length).forEach((e) => cells.push({ emoji: e, target: false }));
      api.shuffle(cells);
      cells.forEach((c) => {
        const b = api.el("button", {
          class: "choice grandma__cell tap", type: "button", text: c.emoji,
          dataset: c.target ? { correct: "1" } : {}, aria: { label: "thing" },
        });
        b.addEventListener("click", () => {
          if (!c.target) { api.tryAgain(b); return; }
          if (!b.dataset.correct) return;
          delete b.dataset.correct; b.classList.add("grandma__cell--found");
          api.say("You found " + c.say + "!");
          found += 1;
          if (found >= targets.length) {
            api.stage.appendChild(api.el("div", { class: "grandma__pop pop", aria: { hidden: "true" } }, ["👵🏻"]));
            try { if (A && A.say) A.say("谢谢", { lang: "zh-CN" }); } catch (e) { /* ignore */ }
            api.win({ say: "Thank you, Josh!" });
          }
        });
        grid.appendChild(b);
      });
      api.setPrompt("Help Grandma find her things!", ["🀄", "🏮", "🍵"]);
      api.speak();
    },
  });

  // ================= Road to 180 — Set 2, Wave 5 =================
  // ---- Month Train (Day Train's big sibling — the months in order) ----
  F.register({
    id: "month-train",
    icon: "🚂",
    title: "Month Train",
    skill: "months of the year [M]",
    start(api) {
      const L = window.JoshLogic;
      const MONTHS = api.C.MONTHS || [];
      const ROUNDS = 4;
      let round = 0, lastStart = -1, r = null;
      const train = api.el("div", { class: "dt__train mt__train", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(train, chips);
      function car(m) { return '<span class="mt__ico">' + m.icon + '</span><span class="mt__abbr">' + m.abbr + "</span>"; }
      function newRound() {
        r = L.makeOrderTrain(MONTHS, undefined, { window: 4, lastStart });
        lastStart = r.start;
        api.setPrompt("Which month is missing?", ["📅", "🚂", "🤔"]);
        api.speak(); api.say("Which month is missing?");
        train.innerHTML = "";
        r.items.forEach((m, i) => {
          const blank = i === r.blankIdx;
          train.appendChild(api.el("span", {
            class: "dt__car mt__car" + (blank ? " dt__car--blank" : ""),
            style: blank ? {} : { background: m.tint },
            html: blank ? "?" : car(m),
          }));
        });
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const m = ch.value;
          const b = api.el("button", {
            class: "choice dt__choice mt__choice tap", type: "button", style: { background: m.tint },
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: m.name }, html: car(m),
          });
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); api.say("That's " + m.name + "."); return; }
            const blank = train.querySelector(".dt__car--blank");
            if (blank) { blank.innerHTML = car(m); blank.style.background = m.tint; blank.classList.remove("dt__car--blank"); blank.classList.add("pop"); }
            api.say(m.name + "!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "You know the months of the year!" }); else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Set the Table (mechanic A: pick-and-place) ----
  // NORMATIVE mechanic-A wiring (every future pick-and-place game copies this):
  // exactly ONE data-correct at a time — held=null flags every un-placed pick;
  // once an item is held, the flag MOVES to its matching (still-empty) slot.
  // A held item can be re-tapped to put it down. Wrong slot = gentle bump.
  F.register({
    id: "set-table",
    icon: "🍽️",
    title: "Set the Table",
    skill: "practical life [M]",
    start(api) {
      const A = window.JoshAudio;
      const ALL = api.C.TABLE_ITEMS || [];
      const ROUNDS = 2;
      let round = 0;
      const outlines = api.el("div", { class: "table__outlines" });
      const tray = api.el("div", { class: "choices choices--3 table__tray" });
      api.stage.append(outlines, tray);

      function newRound() {
        const items = ALL.slice(0, round === 0 ? 3 : 5);
        let held = null, placed = 0;
        const slotByName = {};
        outlines.innerHTML = ""; tray.innerHTML = "";
        api.shuffle(items.slice()).forEach((it) => {
          const slot = api.el("div", { class: "table__slot", dataset: { name: it.name, empty: "1" }, aria: { hidden: "true" }, text: it.emoji });
          outlines.appendChild(slot); slotByName[it.name] = slot;
        });
        const trayBtns = api.shuffle(items.slice()).map((it) => {
          const b = api.el("button", { class: "choice table__item tap", type: "button", dataset: { name: it.name }, aria: { label: it.name }, text: it.emoji });
          b.addEventListener("click", () => {
            if (b.dataset.placed) return;
            if (held === b) { held = null; b.classList.remove("held"); reflag(); return; }
            if (held) held.classList.remove("held");
            held = b; b.classList.add("held"); reflag();
          });
          tray.appendChild(b); return b;
        });
        function reflag() {
          trayBtns.forEach((t) => delete t.dataset.correct);
          Object.values(slotByName).forEach((s) => delete s.dataset.correct);
          if (held) { const s = slotByName[held.dataset.name]; if (s && s.dataset.empty) s.dataset.correct = "1"; }
          else trayBtns.forEach((t) => { if (!t.dataset.placed) t.dataset.correct = "1"; });
        }
        Object.values(slotByName).forEach((slot) => {
          slot.addEventListener("click", () => {
            if (!held) return;
            if (slot.dataset.name === held.dataset.name && slot.dataset.empty) {
              slot.classList.add("table__slot--set", "pop"); delete slot.dataset.empty;
              held.dataset.placed = "1"; held.classList.remove("held"); held.classList.add("choice--used"); held.disabled = true;
              held = null; placed += 1;
              try { if (A && A.tone && A.isMuted && !A.isMuted()) A.tone(660, { duration: 0.1 }); } catch (e) { /* ignore */ }
              api.say("There!");
              if (placed >= items.length) {
                round += 1;
                if (round >= ROUNDS) api.win({ say: "Dinner is ready! You set the whole table!" }); else { api.roundWin(); newRound(); }
              } else reflag();
            } else api.tryAgain(slot);
          });
        });
        api.setPrompt("Set the table — tap a thing, then where it goes!", ["🍽️", "👆", "😊"]);
        api.speak();
        reflag();
      }
      newRound();
    },
  });
})();
