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
      const grid = api.el("div", { class: "peek__grid" });
      api.stage.append(grid);
      api.setPrompt("Tap a door — who is hiding?", ["👆", "🚪", "🐰"]);
      api.speak();
      for (let i = 0; i < 6; i++) {
        const animal = api.randItem(C.ANIMALS || [{ emoji: "🐰", name: "Bunny" }]);
        let open = false;
        const cell = api.el("button", { class: "peek tap", type: "button", dataset: { toy: "1" }, aria: { label: "peek" } }, ["🚪"]);
        cell.addEventListener("click", () => {
          open = !open;
          if (open) {
            cell.textContent = animal.emoji;
            cell.classList.add("peek--open");
            api.tickPlay();
            api.roundWin();
            api.say(animal.name);
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
      let round = 0, pumps = 0;
      const bal = api.el("div", { class: "balloon", aria: { hidden: "true" } }, ["🎈"]);
      const pumpBtn = api.el("button", { class: "btn-big", type: "button", dataset: { correct: "1" } }, ["Pump! ⬆️"]);
      const nextBtn = api.el("button", { class: "btn-big", type: "button", hidden: "" }, ["Again 🎈"]);
      api.stage.append(bal, pumpBtn, nextBtn);

      function newRound() {
        pumps = 0;
        bal.style.fontSize = "3rem";
        bal.classList.remove("balloon--float");
        pumpBtn.hidden = false; pumpBtn.dataset.correct = "1";
        api.setPrompt("Pump the balloon BIG!", ["👆", "🎈", "⬆️"]);
        api.speak();
      }
      pumpBtn.addEventListener("click", () => {
        if (pumps >= FULL) return;
        pumps += 1;
        bal.style.fontSize = (3 + pumps * 1.2) + "rem";
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
      // A music instrument the child deliberately opened should always make
      // sound — WebAudio is gesture-triggered (iOS-safe) and independent of the
      // voice-mute (which silences spoken prompts, not the instrument). The key
      // fix: RESUME the context — browsers start it "suspended" and it stays
      // silent otherwise.
      let ctx = null;
      function tone(freq) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          ctx = ctx || new AC();
          if (ctx.state === "suspended" && ctx.resume) ctx.resume();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "triangle"; o.frequency.value = freq;
          const t = ctx.currentTime;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.28, t + 0.02); // soft attack
          o.connect(g); g.connect(ctx.destination);
          o.start(t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
          o.stop(t + 0.65);
        } catch (e) { /* ignore */ }
      }
      COLORS.forEach((c, i) => {
        const bar = api.el("button", { class: "choice music__pad tap", type: "button", dataset: { toy: "1" }, style: { background: c }, aria: { label: "note " + (i + 1) } }, ["🎵"]);
        bar.addEventListener("click", () => {
          api.tickPlay();
          bar.classList.remove("music__hit"); void bar.offsetWidth; bar.classList.add("music__hit");
          tone(NOTES[i]);
        });
        pad.appendChild(bar);
      });
    },
  });
})();
