// Literacy games. Audio-first (the picture is spoken when sound is on) but fully
// playable with sound off — the picture names itself. Test contract kept.
(function () {
  const F = window.JoshFramework;
  const L = window.JoshLogic;
  if (!F || !L) return;

  // ---- First-Sound: tap the beginning letter of the picture ([M]) ----
  F.register({
    id: "first-sound",
    icon: "🔤",
    title: "Beginning Sound",
    skill: "beginning sounds [M]",
    start(api) {
      const C = api.C;
      const ROUNDS = 5;
      let round = 0;
      const pic = api.el("div", { class: "big-pic", aria: { hidden: "true" } });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(pic, choices);

      function newRound() {
        const r = L.makeFirstSound(C.FIRST_SOUND_WORDS);
        api.setPrompt("What sound does it start with?", ["👀", "🔊", "🔤"]);
        api.speak();
        api.say(r.word);
        pic.textContent = r.emoji;
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--letter tap", type: "button", text: ch.letter,
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.letter },
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

  // ---- Rhyme Match: tap the picture that rhymes ([W]) ----
  F.register({
    id: "rhyme",
    icon: "🎵",
    title: "Which Rhymes?",
    skill: "rhyming [W]",
    start(api) {
      const C = api.C;
      const ROUNDS = 5;
      let round = 0;
      const target = api.el("div", { class: "big-pic", aria: { hidden: "true" } });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(target, choices);

      function newRound() {
        const r = L.makeRhyme(C.RHYME_GROUPS);
        api.setPrompt("Which one rhymes?", ["👀", "👂", "❓"]);
        api.speak();
        api.say(r.target.word);
        target.textContent = r.target.emoji;
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice tap", type: "button", text: ch.emoji,
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.word },
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

  // ---- Build-a-Word: place the letters in order to spell the CVC word ([M]) ----
  F.register({
    id: "build-word",
    icon: "✏️",
    title: "Spell the Word",
    skill: "CVC decode [M]",
    start(api) {
      const C = api.C;
      const ROUNDS = 5;
      let round = 0, word = "", filled = 0, slotEls = [], letterBtns = [];

      const pic = api.el("div", { class: "big-pic", aria: { hidden: "true" } });
      const slots = api.el("div", { class: "word__slots" });
      const letters = api.el("div", { class: "choices choices--3" });
      api.stage.append(pic, slots, letters);

      function refreshCorrect() {
        letterBtns.forEach((b) => {
          if (!b.dataset.used && b.dataset.letter === word[filled]) b.dataset.correct = "1";
          else delete b.dataset.correct;
        });
      }
      function newRound() {
        const r = L.makeCVC(C.CVC_WORDS);
        word = r.word; filled = 0; slotEls = []; letterBtns = [];
        api.setPrompt("Spell the word!", ["👀", "🔤", "🔊"]);
        api.speak();
        api.say(word);
        pic.textContent = r.emoji;
        slots.innerHTML = "";
        for (let i = 0; i < word.length; i++) { const s = api.el("span", { class: "word__slot" }); slots.appendChild(s); slotEls.push(s); }
        letters.innerHTML = "";
        r.buttons.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--letter tap", type: "button", text: ch.toUpperCase(),
            dataset: { letter: ch }, aria: { label: ch },
          });
          b.addEventListener("click", () => {
            if (b.dataset.used) return;
            if (b.dataset.letter === word[filled]) {
              b.dataset.used = "1"; b.classList.add("choice--used"); delete b.dataset.correct;
              slotEls[filled].textContent = word[filled].toUpperCase();
              slotEls[filled].classList.add("filled");
              filled += 1;
              api.say(word[filled - 1]);
              if (filled === word.length) {
                round += 1;
                if (round >= ROUNDS) api.win({ say: "You spelled " + word + "!" });
                else { api.roundWin({ say: word }); newRound(); }
              } else refreshCorrect();
            } else api.tryAgain(b);
          });
          letters.appendChild(b); letterBtns.push(b);
        });
        refreshCorrect();
      }
      newRound();
    },
  });

  // ---- Sight-Word Pop: tap the word that matches ([W], audio-reinforced) ----
  F.register({
    id: "sight-word",
    icon: "👀",
    title: "Find the Word",
    skill: "sight words [W]",
    start(api) {
      const C = api.C;
      const ROUNDS = 5;
      let round = 0;
      const target = api.el("div", { class: "sight__target" });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(target, choices);

      function newRound() {
        const r = L.makeSightWord(C.SIGHT_WORDS);
        api.setPrompt("Find the same word!", ["👀", "🟰", "🔤"]);
        api.speak();
        api.say(r.target);
        target.textContent = r.target;
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--word tap", type: "button", text: ch.word,
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.word },
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
})();
