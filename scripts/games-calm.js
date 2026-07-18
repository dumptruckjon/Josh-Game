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
})();
