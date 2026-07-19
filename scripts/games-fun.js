// Pure-delight cause->effect games. Big, forgiving, no reading. Some are toys
// (no win), some are gentle "do it N times" wins. Test contract kept.
(function () {
  const F = window.JoshFramework;
  const A = window.JoshAudio;
  const C = window.JoshContent || {};
  if (!F) return;

  // ---- Pop the Bubbles (pop them all) ----
  F.register({
    id: "bubbles",
    icon: "🔵",
    title: "Pop the Bubbles",
    skill: "cause→effect / counting",
    start(api) {
      const N = api.randInt(6, 10);
      let popped = 0;
      const field = api.el("div", { class: "bub__field" });
      api.stage.append(field);
      api.setPrompt("Pop all the bubbles!", ["👆", "🔵", "🎉"]);
      api.speak();
      for (let i = 0; i < N; i++) {
        const b = api.el("button", { class: "bub tap", type: "button", dataset: { correct: "1" }, aria: { label: "bubble" } }, ["🔵"]);
        b.addEventListener("click", () => {
          if (b.dataset.done) return;
          b.dataset.done = "1"; delete b.dataset.correct;
          b.classList.add("bub--pop"); b.textContent = "✨";
          popped += 1;
          api.say(String(popped));
          if (popped === N) api.win({ say: "You popped them all!" });
        });
        field.appendChild(b);
      }
    },
  });

  // ---- Peekaboo (tap a door, a friend pops out) ----
  F.register({
    id: "peekaboo",
    icon: "🙈",
    title: "Peekaboo!",
    skill: "cause→effect / object permanence",
    start(api) {
      const ART = window.JoshArt;
      const grid = api.el("div", { class: "peek__grid" });
      api.stage.append(grid);
      api.setPrompt("Tap a door — who is hiding?", ["👆", "🚪", "🐰"]);
      api.speak();
      // Behind the doors: Josh & his friends, the heroes, and some animals — so
      // "who is hiding?" is often someone he knows.
      const reveals = [];
      (C.FRIENDS || []).forEach((f) => reveals.push({ art: (ART && ART.friend && f.art) ? ART.friend(f.art) : null, emoji: f.emoji, name: f.name }));
      (C.HEROES || []).forEach((h) => reveals.push({ art: (ART && ART.hero) ? ART.hero(h.color) : null, emoji: h.emoji, name: h.name }));
      (C.ANIMALS || [{ emoji: "🐰", name: "Bunny" }]).forEach((a) => reveals.push({ art: null, emoji: a.emoji, name: a.name }));
      const pool = api.shuffle(reveals);
      // Endless toy, but collectible: after a handful of peekaboos Josh earns this
      // game's sticker ONCE (api.win), then keeps playing. Every tile fillable.
      let opens = 0, won = false;
      for (let i = 0; i < 6; i++) {
        const who = pool[i % pool.length];
        let open = false;
        const cell = api.el("button", { class: "peek tap", type: "button", dataset: { toy: "1" }, aria: { label: "peek" } }, ["🚪"]);
        cell.addEventListener("click", () => {
          open = !open;
          cell.innerHTML = "";
          if (open) {
            if (who.art) { const s = document.createElement("span"); s.className = "peek__art art-fill"; s.setAttribute("aria-hidden", "true"); s.innerHTML = who.art; cell.appendChild(s); }
            else cell.textContent = who.emoji;
            cell.classList.add("peek--open");
            api.tickPlay();
            opens += 1;
            // A few peekaboos (not a timer) earns the sticker — kept low for short bursts.
            if (opens === 4 && !won) { won = true; api.win({ say: "Peekaboo! You found everyone!" }); }
            else { api.roundWin(); api.say(who.name); }
          } else {
            cell.textContent = "🚪";
            cell.classList.remove("peek--open");
          }
        });
        grid.appendChild(cell);
      }
    },
  });

  // ---- Pump the Balloon (pump it big, watch it float) ----
  F.register({
    id: "balloon",
    icon: "🎈",
    title: "Pump the Balloon",
    skill: "cause→effect / counting",
    start(api) {
      const ROUNDS = 3;
      const FULL = 5;
      const COLORS = ["#ff5e7e", "#5ec8ff", "#7be08a", "#ffd24d", "#c77dff"];
      let round = 0, pumps = 0;
      const art = api.el("div", { class: "balloon__art art-fill", aria: { hidden: "true" } });
      const bal = api.el("div", { class: "balloon" }, [art]);
      const pumpBtn = api.el("button", { class: "btn-big", type: "button", dataset: { correct: "1" } }, ["Pump! ⬆️"]);
      const nextBtn = api.el("button", { class: "btn-big", type: "button", hidden: "" }, ["Again 🎈"]);
      api.stage.append(bal, pumpBtn, nextBtn);

      function draw() { art.style.width = (58 + pumps * 20) + "px"; }
      function newRound() {
        pumps = 0;
        art.innerHTML = (window.JoshArt && window.JoshArt.balloon) ? window.JoshArt.balloon(api.randItem(COLORS)) : "🎈";
        draw();
        bal.classList.remove("balloon--float");
        pumpBtn.hidden = false; pumpBtn.dataset.correct = "1";
        api.setPrompt("Pump the balloon BIG!", ["👆", "🎈", "⬆️"]);
        api.speak();
      }
      pumpBtn.addEventListener("click", () => {
        if (pumps >= FULL) return;
        pumps += 1;
        draw();
        api.say(String(pumps));
        if (pumps === FULL) {
          delete pumpBtn.dataset.correct; pumpBtn.hidden = true;
          bal.classList.add("balloon--float");
          round += 1;
          if (round >= ROUNDS) api.win({ say: "Whee! Up it goes!" });
          else { api.roundWin(); nextBtn.hidden = false; nextBtn.dataset.correct = "1"; }
        }
      });
      nextBtn.addEventListener("click", () => { nextBtn.hidden = true; delete nextBtn.dataset.correct; newRound(); });
      newRound();
    },
  });

  // ---- Music Pad (tap colorful pads to make notes; sound-on) ----
  F.register({
    id: "music-pad",
    icon: "🎵",
    title: "Music Pad",
    skill: "cause→effect / music",
    start(api) {
      const COLORS = ["#ff5e5e", "#ff9f43", "#ffd24d", "#7be08a", "#5ec8ff", "#c77dff"];
      const NOTES = [262, 294, 330, 392, 440, 523]; // a friendly pentatonic-ish set
      const pad = api.el("div", { class: "choices choices--3 music" });
      api.stage.append(pad);
      api.setPrompt("Tap the pads to make music!", ["👆", "🎵", "😊"]);
      api.speak();
      const note = api.el("div", { class: "music__hint" }, ["🔈 Turn the volume up — and check the side switch isn't on silent!"]);
      api.stage.append(note);
      // Sound goes through the shared, iOS-safe JoshAudio.tone() — never a
      // per-game AudioContext (a guardrail test enforces that, so the iOS
      // resume-before-schedule fix can never regress in one game).
      pad.addEventListener("pointerdown", function warm() { if (A && A.unlock) A.unlock(); pad.removeEventListener("pointerdown", warm); }, { once: true });
      // Endless toy, but collectible: after playing a little tune Josh earns this
      // game's sticker ONCE (api.win), then keeps making music. Every tile fillable.
      let notes = 0, won = false;
      COLORS.forEach((c, i) => {
        const bar = api.el("button", { class: "choice music__pad tap", type: "button", dataset: { toy: "1" }, style: { background: c }, aria: { label: "note " + (i + 1) } }, ["🎵"]);
        bar.addEventListener("click", () => {
          api.tickPlay();
          bar.classList.remove("music__hit"); void bar.offsetWidth; bar.classList.add("music__hit");
          if (A && A.tone) A.tone(NOTES[i]);
          notes += 1;
          // A few notes (not a timer) earns the sticker — kept low for short bursts.
          if (notes === 5 && !won) { won = true; api.win({ say: "You made a song! Yay!" }); }
        });
        pad.appendChild(bar);
      });
    },
  });

  // ---- Grow! (Numberblocks homage — tap to stack cubes 1→10) ----
  // His #1 interest (number-friends) turns plain counting-to-ten into a
  // satisfying morph-and-grow toy. Uses the original SVG numberFriend art.
  F.register({
    id: "grow",
    icon: "🧱",
    title: "Grow!",
    skill: "counting 1→10 / number friends [M]",
    start(api) {
      const GOAL = 10;
      const BLOCKS = C.BLOCK_COLORS || ["#ff5e5e", "#ff9f43", "#ffd24d", "#7be08a", "#3ec7c7", "#5ec8ff", "#8a7bff", "#c77dff", "#ff7ac0", "#a0d468"];
      let n = 1;
      // A faint ghost of the GOAL friend stands behind, so the little one has a
      // buddy and a visible height to grow INTO (was: a tiny friend alone in space).
      const wrap = api.el("div", { class: "grow__wrap" });
      const ghost = api.el("div", {
        class: "grow__ghost art-fill", aria: { hidden: "true" },
        html: (window.JoshArt && window.JoshArt.numberFriend) ? window.JoshArt.numberFriend(GOAL, "#c9d3e0") : "",
      });
      const stage = api.el("button", {
        class: "grow__stage tap art-fill", type: "button", dataset: { correct: "1" },
        aria: { label: "grow the number" },
      });
      wrap.append(ghost, stage);
      const num = api.el("div", { class: "grow__num", aria: { hidden: "true" } }, ["1"]);
      api.stage.append(wrap, num);
      api.setPrompt("Tap to grow the number friend!", ["👆", "🧱", "🔟"]);
      api.speak();

      function draw() {
        stage.innerHTML = (window.JoshArt && window.JoshArt.numberFriend) ? window.JoshArt.numberFriend(n, BLOCKS[(n - 1) % BLOCKS.length]) : "🧱";
        num.textContent = String(n);
      }
      draw();

      stage.addEventListener("click", () => {
        if (n >= GOAL) return;
        n += 1;
        stage.classList.remove("grow--pop"); void stage.offsetWidth; stage.classList.add("grow--pop");
        draw();
        api.say(String(n));
        if (n >= GOAL) { delete stage.dataset.correct; api.win({ say: "Ten! You made Ten!" }); }
      });
    },
  });

  // ---- Thwip! Web Up (Spidey homage cause→effect: web up the bugs) ----
  // Each tap shoots an SVG web strand from the hero to that bug and wraps it;
  // when all are webbed a full web has visibly built up (transformation, not a
  // bolted-on reward). Sound goes through the shared iOS-safe JoshAudio.tone.
  F.register({
    id: "thwip-web",
    icon: "🕸️",
    title: "Thwip! Web Up",
    skill: "cause→effect / hero play",
    start(api) {
      const NEED = 6;
      let webbed = 0;
      const heroColor = (api.hero() || {}).color || "#e23636";
      const stage = api.el("div", { class: "thwip" });
      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("class", "thwip__web");
      svg.setAttribute("preserveAspectRatio", "none");
      const hero = api.el("div", { class: "thwip__hero art-fill", aria: { hidden: "true" }, html: (window.JoshArt && window.JoshArt.hero) ? window.JoshArt.hero(heroColor) : "🕷️" });
      const grid = api.el("div", { class: "choices choices--3 thwip__bugs" });
      stage.append(svg, hero, grid);
      api.stage.append(stage);
      api.setPrompt("Thwip! Web up all the bugs!", ["👆", "🕸️", "🐛"]);
      api.speak();
      grid.addEventListener("pointerdown", function warm() { if (A && A.unlock) A.unlock(); grid.removeEventListener("pointerdown", warm); }, { once: true });

      function drawStrand(bug) {
        try {
          const s = stage.getBoundingClientRect();
          const h = hero.getBoundingClientRect();
          const r = bug.getBoundingClientRect();
          if (!s.width || !s.height) return;
          svg.setAttribute("viewBox", "0 0 " + s.width + " " + s.height);
          const line = document.createElementNS(svgNS, "line");
          line.setAttribute("x1", (h.left + h.width / 2 - s.left).toFixed(1));
          line.setAttribute("y1", (h.top + h.height / 2 - s.top).toFixed(1));
          line.setAttribute("x2", (r.left + r.width / 2 - s.left).toFixed(1));
          line.setAttribute("y2", (r.top + r.height / 2 - s.top).toFixed(1));
          line.setAttribute("class", "thwip__strand");
          svg.appendChild(line);
        } catch (e) { /* strand is decorative; never let it break play */ }
      }
      for (let i = 0; i < NEED; i++) {
        const b = api.el("button", { class: "choice thwip__bug tap", type: "button", dataset: { correct: "1" }, aria: { label: "bug" } }, ["🐛"]);
        b.addEventListener("click", () => {
          if (b.dataset.done) return;
          b.dataset.done = "1"; delete b.dataset.correct;
          b.textContent = "🕸️"; b.classList.add("thwip__bug--webbed");
          drawStrand(b);
          // Sound is OFF by default — only thwip when the grown-up turned it on.
          try { if (A && A.tone && A.isMuted && !A.isMuted()) A.tone(520 + webbed * 45, { duration: 0.22, type: "square", gain: 0.18 }); } catch (e) { /* ignore */ }
          webbed += 1; api.say("Thwip!");
          if (webbed >= NEED) api.win({ say: "You webbed them all! Go, web-warrior!" });
        });
        grid.appendChild(b);
      }
    },
  });

  // ---- Color by Number (coarse pixel picture; pick a color, tap its numbers) ----
  F.register({
    id: "color-number",
    icon: "🎨",
    title: "Color by Number",
    skill: "color / number match",
    start(api) {
      const CC = C.CBN_COLORS || {};
      const PICS = C.CBN_PICTURES || [{ name: "Heart", reveal: "❤️", rows: ["101", "111", "010"] }];
      const ROUNDS = Math.min(3, PICS.length);
      let round = 0, cells = [], selected = null, remaining = {}, currentPic = null;

      const legend = api.el("div", { class: "cbn__legend" });
      const grid = api.el("div", { class: "cbn__grid" });
      const reveal = api.el("div", { class: "cbn__reveal", aria: { hidden: "true" } });
      api.stage.append(legend, grid, reveal);

      function markPalette() {
        selected = null;
        [...legend.children].forEach((b) => {
          b.classList.remove("cbn__swatch--sel");
          if (remaining[b.dataset.num] > 0) b.dataset.correct = "1"; else delete b.dataset.correct;
        });
        cells.forEach((c) => delete c.dataset.correct);
      }
      function selectColor(num, btn) {
        selected = num;
        [...legend.children].forEach((b) => { b.classList.remove("cbn__swatch--sel"); delete b.dataset.correct; });
        btn.classList.add("cbn__swatch--sel");
        cells.forEach((c) => { if (!c.dataset.done && c.dataset.num === num) c.dataset.correct = "1"; else delete c.dataset.correct; });
      }
      function onCell(cell) {
        if (cell.dataset.done) return;
        if (selected && cell.dataset.num === selected) {
          cell.dataset.done = "1"; delete cell.dataset.correct;
          cell.classList.add("cbn__cell--done");
          cell.style.background = CC[selected] || "#ccc";
          cell.textContent = "";
          remaining[selected] -= 1;
          api.say("Color");
          if (cells.every((c) => c.dataset.done)) finishPicture();
          else if (remaining[selected] === 0) markPalette();
        } else api.tryAgain(cell);
      }
      // A#5: reveal the finished picture big (name + emoji) — the payoff that
      // turns "colour a grid of numbers" into "look what you made!".
      function finishPicture() {
        const pic = currentPic || {};
        reveal.textContent = pic.reveal || "🎉";
        reveal.classList.remove("cbn__reveal--on"); void reveal.offsetWidth; reveal.classList.add("cbn__reveal--on");
        api.say("You made a " + (pic.name || "picture") + "!");
        round += 1;
        if (round >= ROUNDS) { setTimeout(() => api.win({ say: "Beautiful!" }), 520); }
        else { api.roundWin(); setTimeout(() => { reveal.classList.remove("cbn__reveal--on"); reveal.textContent = ""; newRound(); }, 660); }
      }
      function newRound() {
        const pic = PICS[round % PICS.length];
        currentPic = pic;
        cells = []; selected = null; remaining = {};
        reveal.classList.remove("cbn__reveal--on"); reveal.textContent = "";
        api.setPrompt("Pick a color, then tap its numbers!", ["🎨", "🔢", "👆"]);
        api.speak();
        grid.style.setProperty("--cbn-cols", String(pic.rows[0].length));
        grid.innerHTML = "";
        pic.rows.forEach((row) => {
          for (const ch of row) {
            if (ch === "0") { // background — pre-filled, not a tap target, not counted
              const bg = api.el("div", { class: "cbn__cell cbn__cell--bg", dataset: { done: "1", num: "0" }, aria: { hidden: "true" }, style: { background: CC["0"] || "#eef" } });
              grid.appendChild(bg); cells.push(bg);
              continue;
            }
            remaining[ch] = (remaining[ch] || 0) + 1;
            const cell = api.el("button", { class: "cbn__cell tap", type: "button", dataset: { num: ch }, aria: { label: "number " + ch } }, [ch]);
            cell.addEventListener("click", () => onCell(cell));
            grid.appendChild(cell); cells.push(cell);
          }
        });
        legend.innerHTML = "";
        const nums = [...new Set(pic.rows.join("").split(""))].filter((n) => n !== "0").sort();
        nums.forEach((num) => {
          const btn = api.el("button", { class: "cbn__swatch tap", type: "button", dataset: { num: num }, style: { background: CC[num] || "#ccc" }, aria: { label: "color " + num } }, [num]);
          btn.addEventListener("click", () => selectColor(num, btn));
          legend.appendChild(btn);
        });
        markPalette();
      }
      newRound();
    },
  });

  // ---- Thwip the Villains (Spidey web-up cause->effect TOY) ----
  // Silly baddies pop up and BOB in place (they never run off, no timer). Josh
  // taps one → THWIP, it's wrapped in a web cocoon with a comic pop + sound. Web
  // the whole batch → confetti → a fresh batch. Endless, missless, no reading.
  F.register({
    id: "thwip-villains",
    icon: "🕸️",
    title: "Thwip the Villains",
    skill: "cause→effect / Spidey play [P]",
    start(api) {
      const villains = (C.VILLAINS && C.VILLAINS.length) ? C.VILLAINS : [{ name: "Baddie", emoji: "👾" }];
      api.setPrompt("Web up the silly baddies!", ["🕸️", "👉", "😆"]);
      const heroSvg = (window.JoshArt && window.JoshArt.hero) ? window.JoshArt.hero("#e23636") : "🕷️";
      const hero = api.el("div", { class: "villains__hero art-fill", aria: { hidden: "true" }, html: heroSvg });
      const field = api.el("div", { class: "villains" });
      api.stage.append(hero, field);

      let webbed = 0, won = false;
      function thwip(btn) {
        if (btn.classList.contains("villain--webbed")) return;
        btn.classList.add("villain--webbed");
        delete btn.dataset.toy; // consumed — the harness moves to the next baddie
        api.tickPlay();
        // A quick "thwip" — only when sound is on (off by default), iOS-safe path.
        try { if (A && A.tone && A.isMuted && !A.isMuted()) A.tone(760, { duration: 0.1, type: "sawtooth" }); } catch (e) { /* ignore */ }
        webbed += 1;
        if (webbed >= field.children.length) {
          // Clearing the whole batch earns this game's sticker ONCE (api.win), then
          // a fresh batch keeps the endless play going. So the tile is collectible.
          if (!won) { won = true; api.win({ say: "You webbed them all! Web-warrior!" }); }
          else api.roundWin();
          webbed = 0; setTimeout(spawn, 700);
        }
      }
      function spawn() {
        field.innerHTML = "";
        webbed = 0;
        for (let i = 0; i < 6; i++) {
          const v = api.randItem(villains);
          const btn = api.el("button", { class: "villain tap", type: "button", dataset: { toy: "1" }, aria: { label: v.name } }, [
            api.el("span", { class: "villain__guy", aria: { hidden: "true" } }, [v.emoji]),
            api.el("span", { class: "villain__web", aria: { hidden: "true" } }, ["🕸️"]),
          ]);
          btn.addEventListener("click", () => thwip(btn));
          field.appendChild(btn);
        }
      }
      spawn();
    },
  });

  // ---- 🌦️ Dress Me! (weather → the right gear, worn ON the friend) ----
  // Look out the window, pick the right gear, and the friend VISIBLY gets it:
  // cap on the head, umbrella overhead, mittens in hand. Wrong-weather gear is
  // a giggle (mittens in the sunshine!), redirected gently.
  F.register({
    id: "dress-me",
    icon: "🌦️",
    title: "Dress Me!",
    skill: "weather & dressing [M→W]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 3;
      let round = 0, lastIdx = -1, r = null;
      const scene = api.el("div", { class: "dm__scene", aria: { hidden: "true" } });
      const windowEl = api.el("span", { class: "dm__window" });
      const kid = api.el("span", { class: "dm__kid art-fill" });
      const gearSpot = api.el("span", { class: "dm__gear" });
      scene.append(windowEl, kid, gearSpot);
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(scene, chips);

      function newRound() {
        r = L.makeWeather(C.WEATHERS, undefined, lastIdx);
        lastIdx = r.idx;
        const friend = api.friend();
        if (window.JoshArt && window.JoshArt.friend && friend.art) kid.innerHTML = window.JoshArt.friend(friend.art);
        else kid.textContent = friend.emoji;
        api.setPrompt("What should " + friend.name + " wear?", ["👀", r.weather.sky, "🤔"]);
        api.speak(); api.say(r.weather.say + " What should " + friend.name + " wear?");
        windowEl.textContent = r.weather.sky;
        gearSpot.textContent = "";
        gearSpot.className = "dm__gear";
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice dm__chip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.name },
          }, [ch.emoji]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); api.say(L.article(ch.name) + " " + ch.name + "? Not today! Hee hee."); return; }
            gearSpot.textContent = ch.emoji; // the friend actually GETS the gear
            gearSpot.classList.add("dm__gear--" + r.weather.spot, "pop");
            kid.classList.remove("pop"); void kid.offsetWidth; kid.classList.add("pop");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "All dressed for every weather!" });
            else { api.roundWin({ say: L.article(ch.name) + " " + ch.name + " — perfect for " + r.weather.name + "!" }); setTimeout(() => { if (scene.isConnected) newRound(); }, 900); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- 🌈 Season Windows (which season does it belong to?) ----
  // Four tinted season windows; each right answer flies the item INTO its
  // window, so the seasons visibly fill with their own things.
  F.register({
    id: "seasons",
    icon: "🌈",
    title: "Season Windows",
    skill: "seasons [M]",
    start(api) {
      const L = window.JoshLogic;
      const ROUNDS = 5;
      let round = 0, lastItem = null, r = null;
      const itemEl = api.el("div", { class: "sw__item", aria: { hidden: "true" } });
      const grid = api.el("div", { class: "sw__grid" });
      api.stage.append(itemEl, grid);

      const windows = C.SEASONS.map((s, i) => {
        const inner = api.el("span", { class: "sw__collected", aria: { hidden: "true" } });
        const b = api.el("button", {
          class: "sw__window tap", type: "button",
          style: { background: s.tint }, aria: { label: s.name },
        }, [api.el("span", { class: "sw__icon", text: s.icon, aria: { hidden: "true" } }), inner]);
        b.__inner = inner;
        b.addEventListener("click", () => {
          if (i !== r.seasonIdx) { api.tryAgain(b); return; }
          b.__inner.textContent += r.item; // the item joins its season
          b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
          delete b.dataset.correct;
          round += 1;
          if (round >= ROUNDS) api.win({ say: "You know all the seasons!" });
          else { api.roundWin({ say: r.item + " belongs in " + r.seasonName + "!" }); newRound(); }
        });
        grid.appendChild(b);
        return b;
      });

      function newRound() {
        r = L.makeSeasonItem(C.SEASONS, undefined, lastItem);
        lastItem = r.item;
        api.setPrompt("Which season does it belong to?", ["👀", "🌈", "👉"]);
        api.speak(); api.say("Where does this belong? Which season?");
        itemEl.textContent = r.item;
        itemEl.classList.remove("pop"); void itemEl.offsetWidth; itemEl.classList.add("pop");
        windows.forEach((w, i) => { if (i === r.seasonIdx) w.dataset.correct = "1"; else w.removeAttribute("data-correct"); });
      }
      newRound();
    },
  });

  // ================= Road to 140 — Wave 4 =================

  // ---- Fireworks Show (tap the sky → a burst; counts them) ----
  F.register({
    id: "fireworks",
    icon: "🎆",
    title: "Fireworks Show",
    skill: "cause→effect / counting [P]",
    start(api) {
      api.setPrompt("Tap the sky for fireworks!", ["👆", "🎆", "✨"]);
      const sky = api.el("button", { class: "fw__sky tap", type: "button", dataset: { toy: "1" }, aria: { label: "night sky" } });
      api.stage.append(sky);
      const COLORS = ["#ffd166", "#ef476f", "#06d6a0", "#4cc9f0", "#f78c6b", "#c77dff"];
      let bursts = 0, won = false;
      sky.addEventListener("click", () => {
        const burst = api.el("span", { class: "fw__burst", aria: { hidden: "true" } });
        burst.style.left = api.randInt(14, 86) + "%";
        burst.style.top = api.randInt(10, 68) + "%";
        burst.style.background = api.randItem(COLORS);
        sky.appendChild(burst);
        setTimeout(() => burst.remove(), 950);
        api.tickPlay();
        try { if (A && A.tone && A.isMuted && !A.isMuted()) A.tone(api.randInt(420, 720), { duration: 0.12, type: "triangle" }); } catch (e) { /* ignore */ }
        bursts += 1;
        api.say(String(bursts));
        if (bursts >= 6) {
          if (!won) { won = true; api.win({ say: "What a show!" }); } else api.roundWin();
        }
      });
    },
  });

  // ---- Silly Face Maker (cycle a hat / face / glasses — pure autonomy) ----
  F.register({
    id: "silly-face",
    icon: "😜",
    title: "Silly Face Maker",
    skill: "cause→effect / autonomy [P]",
    start(api) {
      const LAYERS = [
        { key: "hat", cls: "silly2__hat", label: "hat", opts: ["🎩", "👑", "🧢", "🎓", "⛑️"] },
        { key: "face", cls: "silly2__face", label: "face", opts: ["😀", "😜", "🤪", "😎", "🥳", "😝"] },
        { key: "spex", cls: "silly2__spex", label: "glasses", opts: ["🕶️", "👓", "🥽"] },
      ];
      api.setPrompt("Make a silly face!", ["🎩", "😜", "🕶️"]);
      const face = api.el("div", { class: "silly2__stage", aria: { hidden: "true" } });
      const spans = {};
      LAYERS.forEach((ly) => { ly.idx = 0; const s = api.el("span", { class: ly.cls }, [ly.opts[0]]); spans[ly.key] = s; face.appendChild(s); });
      const btns = api.el("div", { class: "choices choices--3" });
      let taps = 0, won = false;
      LAYERS.forEach((ly) => {
        const b = api.el("button", { class: "choice silly2__btn tap", type: "button", dataset: { toy: "1" }, aria: { label: "change " + ly.label } }, [ly.opts[0]]);
        b.addEventListener("click", () => {
          ly.idx = (ly.idx + 1) % ly.opts.length;
          spans[ly.key].textContent = ly.opts[ly.idx];
          b.textContent = ly.opts[ly.idx];
          api.tickPlay();
          try { if (A && A.tone && A.isMuted && !A.isMuted()) A.tone(500 + ly.idx * 40, { duration: 0.08 }); } catch (e) { /* ignore */ }
          taps += 1;
          if (taps >= 6) {
            if (!won) { won = true; api.win({ say: "What a fantastic silly face!" }); } else api.roundWin();
          }
        });
        btns.appendChild(b);
      });
      api.stage.append(face, btns);
    },
  });

  // ---- Web Swing! (tap the numbered buildings in order; hero hops across) ----
  F.register({
    id: "web-swing",
    icon: "🕸️",
    title: "Web Swing!",
    skill: "ordered taps / hero play [P]",
    start(api) {
      const N = 5, ROUNDS = 2;
      let round = 0, step = 0, dir = 1;
      const heroSvg = (window.JoshArt && window.JoshArt.hero) ? window.JoshArt.hero("#e23636") : "🕷️";
      const city = api.el("div", { class: "swing__city" });
      api.stage.append(city);
      let buildings = [];
      function newRound() {
        step = 0; city.innerHTML = ""; buildings = [];
        const seq = dir === 1 ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0];
        api.setPrompt("Swing across the city — tap 1, 2, 3…", ["👆", "🕸️", "🏙️"]);
        api.speak();
        for (let i = 0; i < N; i++) {
          const rank = seq.indexOf(i);
          const b = api.el("button", { class: "swing__bldg tap", type: "button", aria: { label: "building " + (rank + 1) } }, [
            api.el("span", { class: "swing__num", aria: { hidden: "true" } }, [String(rank + 1)]),
            api.el("span", { class: "swing__hero art-fill", aria: { hidden: "true" } }),
          ]);
          b.__rank = rank;
          if (rank === 0) b.dataset.correct = "1";
          b.addEventListener("click", () => {
            if (b.__rank !== step) { api.tryAgain(b); return; }
            [...city.querySelectorAll(".swing__hero")].forEach((h) => (h.innerHTML = ""));
            b.querySelector(".swing__hero").innerHTML = heroSvg;
            delete b.dataset.correct;
            step += 1;
            if (step >= N) {
              round += 1; dir = -dir;
              if (round >= ROUNDS) api.win({ say: "You swung across the whole city!" });
              else { api.roundWin(); setTimeout(newRound, 350); }
            } else {
              const next = buildings.find((bb) => bb.__rank === step);
              if (next) next.dataset.correct = "1";
            }
          });
          buildings.push(b); city.appendChild(b);
        }
      }
      newRound();
    },
  });

  // ---- Birthday Cake (put 5 candles on, then blow them out) ----
  F.register({
    id: "birthday-cake",
    icon: "🎂",
    title: "Birthday Cake",
    skill: "counting / celebrate [P]",
    start(api) {
      const NEED = 5;
      let candles = 0, phase = "add";
      const cake = api.el("button", { class: "cake__cake tap", type: "button", aria: { label: "the cake" } }, [
        api.el("span", { class: "cake__flames", aria: { hidden: "true" } }),
        api.el("span", { class: "cake__base", aria: { hidden: "true" } }, ["🎂"]),
      ]);
      const flames = cake.querySelector(".cake__flames");
      const pile = api.el("button", { class: "choice cake__pile tap", type: "button", dataset: { correct: "1" }, aria: { label: "add a candle" } }, ["🕯️"]);
      api.stage.append(cake, pile);
      api.setPrompt("Josh is turning FIVE! Add 5 candles!", ["🎂", "🕯️", "5️⃣"]);
      api.speak();
      pile.addEventListener("click", () => {
        if (phase !== "add") return;
        candles += 1;
        flames.appendChild(api.el("span", { class: "cake__candle", aria: { hidden: "true" } }, ["🕯️"]));
        api.say(String(candles));
        if (candles >= NEED) {
          phase = "blow";
          delete pile.dataset.correct; pile.disabled = true; pile.classList.add("choice--used");
          cake.dataset.correct = "1";
          api.setPrompt("Now blow them out!", ["🎂", "💨", "🎉"]);
          api.speak(); api.say("Now blow them out!");
        }
      });
      cake.addEventListener("click", () => {
        if (phase !== "blow") return;
        phase = "done";
        delete cake.dataset.correct;
        flames.innerHTML = "💨";
        api.win({ say: "Happy birthday, Josh! Hooray!" });
      });
    },
  });

  // ---- Hatch the Egg! (tap to crack, the 4th tap hatches a surprise baby) ----
  F.register({
    id: "hatch-egg",
    icon: "🥚",
    title: "Hatch the Egg!",
    skill: "cause→effect / surprise [P]",
    start(api) {
      const BABIES = api.C.EGG_BABIES || ["🐣"];
      api.setPrompt("Tap the egg to hatch it!", ["👆", "🥚", "🐣"]);
      const egg = api.el("button", { class: "egg tap", type: "button", dataset: { toy: "1" }, aria: { label: "egg" } }, ["🥚"]);
      api.stage.append(egg);
      let taps = 0, won = false;
      egg.addEventListener("click", () => {
        api.tickPlay();
        taps += 1;
        api.say(String(taps));
        egg.classList.remove("egg--wobble"); void egg.offsetWidth; egg.classList.add("egg--wobble");
        if (taps < 4) {
          egg.classList.add("egg--crack" + taps);
        } else {
          egg.textContent = api.randItem(BABIES);
          egg.classList.add("egg--hatched");
          try { if (window.JoshEffects && window.JoshEffects.confetti) window.JoshEffects.confetti(); } catch (e) { /* ignore */ }
          if (!won) { won = true; api.win({ say: "Hello, little one!" }); } else { api.roundWin(); api.say("Hello, little one!"); }
          setTimeout(() => {
            taps = 0; egg.textContent = "🥚";
            egg.classList.remove("egg--crack1", "egg--crack2", "egg--crack3", "egg--hatched");
          }, 950);
        }
      });
    },
  });

  // ---- Splat Studio (tap the canvas → a color splat; sponge wipes it clean) ----
  F.register({
    id: "paint-splat",
    icon: "🎨",
    title: "Splat Studio",
    skill: "creative cause→effect [P]",
    start(api) {
      const COLORS = api.C.SPLAT_COLORS || [{ hex: "#e23636", name: "red" }];
      api.setPrompt("Tap the canvas to splat paint!", ["👆", "🎨", "🌈"]);
      const canvas = api.el("button", { class: "splat__canvas tap", type: "button", dataset: { toy: "1" }, aria: { label: "canvas" } });
      const sponge = api.el("button", { class: "splat__sponge tap", type: "button", dataset: { toy: "1" }, aria: { label: "wipe clean" } }, ["🧽"]);
      api.stage.append(canvas, sponge);
      let splats = 0, won = false;
      canvas.addEventListener("click", () => {
        const c = api.randItem(COLORS);
        const blob = api.el("span", { class: "splat__blob", aria: { hidden: "true" } });
        blob.style.left = api.randInt(8, 88) + "%"; blob.style.top = api.randInt(8, 82) + "%";
        blob.style.background = c.hex; blob.style.width = blob.style.height = api.randInt(38, 66) + "px";
        canvas.appendChild(blob);
        api.tickPlay(); api.say(c.name);
        splats += 1;
        if (splats >= 6) { if (!won) { won = true; api.win({ say: "A masterpiece!" }); } else api.roundWin(); }
      });
      sponge.addEventListener("click", () => {
        [...canvas.querySelectorAll(".splat__blob")].forEach((b) => b.remove());
        api.tickPlay(); api.say("All clean!");
      });
    },
  });

  // ================= Road to 180 — Set 2, Wave 8 =================
  // ---- The Car Wash (ordered stations transform a muddy car) ----
  // Four stations carry the flag one at a time (soap → scrub → rinse → dry);
  // each visibly changes the car. A sparkling car honks thanks → win. ROUNDS=2.
  F.register({
    id: "car-wash", icon: "🚗", title: "The Car Wash", skill: "ordered stations [M]",
    start(api) {
      const STATIONS = C.CAR_WASH_STATIONS || [];
      const CARS = C.CAR_WASH_CARS || ["🚗"];
      const ROUNDS = 2;
      let round = 0;
      const carEl = api.el("div", { class: "cw__car cw--muddy", aria: { hidden: "true" } }, [CARS[0]]);
      const row = api.el("div", { class: "choices choices--4 cw__stations" });
      api.stage.append(carEl, row);

      function newRound() {
        let step = 0;
        carEl.className = "cw__car cw--muddy";
        carEl.textContent = CARS[round % CARS.length];
        row.innerHTML = "";
        api.setPrompt("Wash the car! Soap, scrub, rinse, dry.", ["🧼", "🧽", "💨"]);
        api.speak();
        const btns = STATIONS.map((st, i) => {
          const b = api.el("button", { class: "choice cw__station tap", type: "button", text: st.emoji, aria: { label: st.name } });
          b.addEventListener("click", () => {
            if (i !== step) { api.tryAgain(b); return; }
            b.disabled = true; b.classList.add("choice--used"); delete b.dataset.correct;
            carEl.classList.add(st.cls);
            api.say(st.say);
            step += 1;
            if (step >= STATIONS.length) {
              carEl.classList.add("cw--clean"); carEl.classList.remove("cw--muddy");
              try { if (A && A.tone && A.isMuted && !A.isMuted()) A.tone(520, { duration: 0.14, type: "square" }); } catch (e) { /* ignore */ }
              round += 1;
              if (round >= ROUNDS) api.win({ say: "Sparkly clean! Beep beep — thank you!" });
              else { api.roundWin({ say: "All clean! Here comes another one." }); setTimeout(() => { if (row.isConnected) newRound(); }, 700); }
              return;
            }
            flag();
          });
          row.appendChild(b);
          return b;
        });
        function flag() { btns.forEach((b, i) => { if (i === step && !b.disabled) b.dataset.correct = "1"; else delete b.dataset.correct; }); }
        flag();
      }
      newRound();
    },
  });

  // ================= Road to 200 — Set 3, Wave 9 =================
  // ---- Dump Truck! (load the rocks, count, then DUMP — the namesake game) ----
  F.register({
    id: "dump-truck", icon: "🚚", title: "Dump Truck!", skill: "load, count & dump [M]",
    start(api) {
      const LOADS = C.TRUCK_LOADS || [3, 4, 5];
      let round = 0;
      const truck = api.el("div", { class: "truck__rig", aria: { hidden: "true" } }, [
        api.el("span", { class: "truck__bed" }),
        api.el("span", { class: "truck__cab", text: "🚚" }),
      ]);
      const bed = truck.querySelector(".truck__bed");
      const rocks = api.el("div", { class: "choices choices--3 truck__rocks" });
      const lever = api.el("button", { class: "btn-big truck__lever", type: "button", hidden: "" }, ["⬇️ DUMP!"]);
      api.stage.append(truck, rocks, lever);

      function newRound() {
        const n = LOADS[round % LOADS.length];
        let loaded = 0;
        truck.classList.remove("truck__rig--dump");
        bed.innerHTML = "";
        lever.hidden = true; delete lever.dataset.correct;
        rocks.innerHTML = "";
        api.setPrompt("Load the rocks, then pull the DUMP lever!", ["🪨", "🚚", "⬇️"]);
        api.speak(); api.say("Load " + n + " rocks into the truck!");
        for (let i = 0; i < n; i++) {
          const r = api.el("button", { class: "choice truck__rock tap", type: "button", dataset: { correct: "1" }, aria: { label: "rock" }, text: "🪨" });
          r.addEventListener("click", () => {
            if (r.dataset.loaded) return;
            r.dataset.loaded = "1"; delete r.dataset.correct;
            r.classList.add("truck__rock--gone"); r.disabled = true;
            bed.appendChild(api.el("span", { class: "truck__load pop", aria: { hidden: "true" }, text: "🪨" }));
            loaded += 1;
            try { if (A && A.tone && A.isMuted && !A.isMuted()) A.tone(300 + loaded * 40, { duration: 0.1 }); } catch (e) { /* ignore */ }
            api.say(String(loaded));
            if (loaded >= n) { lever.hidden = false; lever.dataset.correct = "1"; api.say("Now pull the DUMP lever!"); }
          });
          rocks.appendChild(r);
        }
      }
      lever.addEventListener("click", () => {
        if (lever.hidden || lever.dataset.done) return;
        lever.dataset.done = "1"; delete lever.dataset.correct;
        truck.classList.add("truck__rig--dump");
        api.say("Dump!");
        setTimeout(() => {
          round += 1;
          if (round >= LOADS.length) api.win({ say: "You dumped them all! Beep beep!" });
          else { api.roundWin(); delete lever.dataset.done; newRound(); }
        }, 700);
      });
      newRound();
    },
  });
})();
