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
    icon: "🫧",
    title: "Pop the Bubbles",
    skill: "cause→effect / counting",
    start(api) {
      const N = api.randInt(6, 10);
      let popped = 0;
      const field = api.el("div", { class: "bub__field" });
      api.stage.append(field);
      api.setPrompt("Pop all the bubbles!", ["👆", "🫧", "🎉"]);
      api.speak();
      for (let i = 0; i < N; i++) {
        const b = api.el("button", { class: "bub tap", type: "button", dataset: { correct: "1" }, aria: { label: "bubble" } }, ["🫧"]);
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
            if (opens === 6 && !won) { won = true; api.win({ say: "Peekaboo! You found everyone!" }); }
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
          if (notes === 8 && !won) { won = true; api.win({ say: "You made a song! Yay!" }); }
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
})();
