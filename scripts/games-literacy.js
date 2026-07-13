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
        api.setPrompt("Which word did you hear? Read and find it!", ["👂", "🔤", "👆"]);
        api.speak();
        api.say(r.target);
        // Show the target in UPPERCASE while the choices stay lowercase, so it
        // can't be solved by pixel-matching identical shapes — the child must
        // actually READ the word (audio-supported). His live sight-word edge.
        target.textContent = r.target.toUpperCase();
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

  // ---- Digraph Sort: does it start with "sh" or "ch"? ([W]) ----
  F.register({
    id: "digraph",
    icon: "🔠",
    title: "sh or ch?",
    skill: "digraphs sh/ch [W]",
    start(api) {
      const C = api.C;
      const ROUNDS = 6;
      let round = 0;
      const itemEl = api.el("div", { class: "sort__item", aria: { hidden: "true" } });
      const bins = api.el("div", { class: "sort__bins" });
      api.stage.append(itemEl, bins);

      function newRound() {
        const r = L.makeSort(C.DIGRAPH_SETS[0]);
        api.setPrompt("Does it start with sh or ch?", ["👀", "👂", "🔠"]);
        api.speak();
        api.say((C.DIGRAPH_WORDS || {})[r.item] || ""); // name the picture aloud
        itemEl.textContent = r.item;
        itemEl.classList.remove("pop"); void itemEl.offsetWidth; itemEl.classList.add("pop");
        bins.innerHTML = "";
        r.bins.forEach((b, i) => {
          const btn = api.el("button", {
            class: "sort__bin tap", type: "button",
            dataset: i === r.correctIndex ? { correct: "1" } : {}, aria: { label: b.label },
          }, [api.el("span", { class: "sort__binLetters" }, [b.emoji])]);
          btn.addEventListener("click", () => {
            if (i === r.correctIndex) { round += 1; if (round >= ROUNDS) api.win(); else { api.roundWin(); newRound(); } }
            else api.tryAgain(btn);
          });
          bins.appendChild(btn);
        });
      }
      newRound();
    },
  });

  // ---- Big & Little Letters: tap the lowercase that matches the uppercase ([W]) ----
  F.register({
    id: "letter-match",
    icon: "🔡",
    title: "Big & Little Letters",
    skill: "letters / matching [W]",
    start(api) {
      const ROUNDS = 5;
      let round = 0;
      const target = api.el("div", { class: "letter__big", aria: { hidden: "true" } });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(target, choices);

      function newRound() {
        const r = L.makeLetterMatch();
        api.setPrompt("Find the little letter that matches!", ["👀", "🔡", "👉"]);
        api.speak();
        api.say("Letter " + r.upper);
        target.textContent = r.upper;
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--lower tap", type: "button", text: ch.lower,
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.lower },
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

  // ---- Missing Letter: which letter completes the word? ([M]) ----
  F.register({
    id: "missing-letter",
    icon: "❓",
    title: "Missing Letter",
    skill: "CVC decode [M]",
    start(api) {
      const C = api.C;
      const ROUNDS = 5;
      let round = 0;
      const pic = api.el("div", { class: "big-pic", aria: { hidden: "true" } });
      const wordEl = api.el("div", { class: "ml__word" });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(pic, wordEl, choices);

      function newRound() {
        const r = L.makeMissingLetter(C.CVC_WORDS);
        api.setPrompt("Which letter is missing?", ["👀", "🔤", "❓"]);
        api.speak();
        api.say(r.word);
        pic.textContent = r.emoji;
        wordEl.innerHTML = "";
        r.word.split("").forEach((ltr, i) => {
          wordEl.appendChild(api.el("span", {
            class: "ml__slot" + (i === r.blankIndex ? " ml__slot--blank" : ""),
          }, [i === r.blankIndex ? "?" : ltr.toUpperCase()]));
        });
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--letter tap", type: "button", text: ch.letter.toUpperCase(),
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.letter },
          });
          b.addEventListener("click", () => {
            if (ch.correct) {
              const slot = wordEl.children[r.blankIndex];
              slot.textContent = ch.letter.toUpperCase();
              slot.classList.remove("ml__slot--blank");
              round += 1;
              if (round >= ROUNDS) api.win(); else { api.roundWin(); newRound(); }
            } else api.tryAgain(b);
          });
          choices.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Finish the Word: which sound starts it — sh, ch, or th? ([W]) ----
  F.register({
    id: "digraph-finish",
    icon: "🔡",
    title: "sh, ch, or th?",
    skill: "digraphs sh·ch·th [W]",
    start(api) {
      const C = api.C;
      const ROUNDS = 5;
      let round = 0;
      const pic = api.el("div", { class: "big-pic", aria: { hidden: "true" } });
      const wordEl = api.el("div", { class: "digf__word", aria: { hidden: "true" } });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(pic, wordEl, choices);

      function newRound() {
        const r = L.makeDigraphFinish(C.DIGRAPH_FINISH);
        api.setPrompt("Which sound starts the word?", ["👂", "🔡", "❓"]);
        api.speak();
        api.say(r.word);
        pic.textContent = r.emoji;
        wordEl.innerHTML = "";
        wordEl.append(
          api.el("span", { class: "digf__blank" }, ["_ _"]),
          api.el("span", { class: "digf__rest" }, [r.rest])
        );
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--letter tap", type: "button", text: ch.digraph,
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.digraph },
          });
          b.addEventListener("click", () => {
            if (ch.correct) {
              wordEl.querySelector(".digf__blank").textContent = r.digraph;
              round += 1;
              if (round >= ROUNDS) api.win({ say: "You finished the word!" }); else { api.roundWin(); newRound(); }
            } else api.tryAgain(b);
          });
          choices.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Letter Maker: trace the numbered dots over a faint letter ([W]) ----
  // Reuses the lacing mechanic to teach letter FORMATION (his writing edge).
  F.register({
    id: "letter-maker",
    icon: "✏️",
    title: "Letter Maker",
    skill: "letter formation / writing [W]",
    start(api) {
      const C = api.C;
      const ROUNDS = 4;
      let round = 0, step = 0, dots = [];
      const stage = api.el("div", { class: "trace__stage" });
      const guide = api.el("div", { class: "lm__guide", aria: { hidden: "true" } });
      stage.appendChild(guide);
      api.stage.append(stage);

      function newRound() {
        const lp = api.randItem(C.LETTER_PATHS);
        step = 0; dots = [];
        guide.textContent = lp.letter;
        api.setPrompt("Trace the letter — tap the dots in order!", ["👆", "🔢", "✏️"]);
        api.speak();
        api.say("Trace the letter " + lp.letter);
        [...stage.querySelectorAll(".trace__dot, .trace__line")].forEach((n) => n.remove());

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("class", "trace__line");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.setAttribute("preserveAspectRatio", "none");
        const poly = document.createElementNS(svgNS, "polyline");
        poly.setAttribute("points", lp.dots.map((p) => p.x + "," + p.y).join(" "));
        poly.setAttribute("fill", "none"); poly.setAttribute("stroke", "#b7c6d6");
        poly.setAttribute("stroke-width", "2.5"); poly.setAttribute("stroke-dasharray", "5 4"); poly.setAttribute("stroke-linecap", "round");
        svg.appendChild(poly);
        stage.appendChild(svg);

        lp.dots.forEach((p, i) => {
          const dot = api.el("button", {
            class: "trace__dot tap" + (i === 0 ? " trace__dot--start" : ""),
            type: "button", dataset: i === 0 ? { correct: "1" } : {}, aria: { label: "dot " + (i + 1) },
          }, [String(i + 1)]);
          dot.style.left = p.x + "%"; dot.style.top = p.y + "%";
          dot.addEventListener("click", () => {
            if (i === step) {
              dot.classList.add("trace__dot--done");
              delete dot.dataset.correct;
              step += 1;
              if (step >= lp.dots.length) {
                round += 1;
                if (round >= ROUNDS) api.win({ say: "You wrote your letters!" }); else { api.roundWin(); newRound(); }
              } else if (dots[step]) dots[step].dataset.correct = "1";
            } else api.tryAgain(dot);
          });
          stage.appendChild(dot); dots.push(dot);
        });
      }
      newRound();
    },
  });

  // ---- Rhyme Train: find EVERY picture that rhymes with the target ([W]) ----
  // Extends Which-Rhymes? (pick one) into a visual hunt (find them all), on his
  // live rhyming edge. Control-of-error stays the self-naming pictures + audio.
  F.register({
    id: "rhyme-train",
    icon: "🚂",
    title: "Rhyme Train",
    skill: "rhyming [W]",
    start(api) {
      const C = api.C;
      const ROUNDS = 5;
      let round = 0, need = 0, got = 0;
      const target = api.el("div", { class: "find__target" });
      const field = api.el("div", { class: "find__field" });
      api.stage.append(target, field);

      function newRound() {
        const r = L.makeRhymeHunt(C.RHYME_GROUPS, 6);
        need = r.count; got = 0;
        target.innerHTML = "";
        target.append(
          api.el("span", { class: "find__targetEmoji", text: r.target.emoji }),
          api.el("span", { class: "find__targetLabel", text: "Rhymes with " + r.target.word })
        );
        api.setPrompt("Find all that rhyme!", ["👂", "🚂", "👆"]);
        api.speak();
        api.say("Rhymes with " + r.target.word);
        field.innerHTML = "";
        r.cells.forEach((cell) => {
          const b = api.el("button", {
            class: "find__cell tap", type: "button", text: cell.emoji,
            dataset: cell.correct ? { correct: "1" } : {}, aria: { label: cell.word },
          });
          b.addEventListener("click", () => {
            if (cell.correct && !b.dataset.done) {
              b.dataset.done = "1"; delete b.dataset.correct; b.classList.add("find__cell--found");
              got += 1; api.say(cell.word);
              if (got >= need) { round += 1; if (round >= ROUNDS) api.win({ say: "You found all the rhymes!" }); else { api.roundWin(); newRound(); } }
            } else if (!cell.correct) api.tryAgain(b);
          });
          field.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Spell My Name: tap the scrambled letters in order ([W] writing name) ----
  // His literal writing edge is his name; this personalizes hardest (his loves say
  // personalization is the cheapest big lift) and rotates his friends' names too.
  F.register({
    id: "name-spell",
    icon: "✍️",
    title: "Spell My Name",
    skill: "name / letters [W]",
    start(api) {
      const NAMES = api.C.NAMES || [{ name: "Josh", letters: "JOSH" }];
      const ROUNDS = Math.min(3, NAMES.length);
      let round = 0, step = 0, letters = [];
      const nameLabel = api.el("div", { class: "ns__name" });
      const slots = api.el("div", { class: "ns__slots" });
      const tray = api.el("div", { class: "choices choices--4 ns__tray" });
      api.stage.append(nameLabel, slots, tray);

      function flagNext() {
        [...tray.children].forEach((t) => {
          if (!t.dataset.done && t.dataset.letter === letters[step]) t.dataset.correct = "1";
          else if (!t.dataset.done) delete t.dataset.correct;
        });
      }
      function newRound() {
        const entry = NAMES[round % NAMES.length];
        const r = L.makeNameSpell(entry.letters);
        letters = r.letters; step = 0;
        nameLabel.textContent = entry.name;
        api.setPrompt("Spell " + entry.name + "! Tap the letters in order.", ["👀", "🔤", "✍️"]);
        api.speak(); api.say("Spell " + entry.name);
        slots.innerHTML = "";
        letters.forEach(() => slots.appendChild(api.el("span", { class: "ns__slot" }, ["_"])));
        tray.innerHTML = "";
        r.tiles.forEach((t) => {
          const b = api.el("button", {
            class: "choice choice--letter ns__tile tap", type: "button", text: t.letter,
            dataset: { letter: t.letter }, aria: { label: t.letter },
          });
          b.addEventListener("click", () => {
            if (b.dataset.done) return;
            if (b.dataset.letter === letters[step]) {
              b.dataset.done = "1"; b.classList.add("choice--used"); delete b.dataset.correct;
              slots.children[step].textContent = letters[step];
              api.say(letters[step]);
              step += 1;
              if (step >= letters.length) { round += 1; if (round >= ROUNDS) api.win({ say: "You spelled the names! Amazing!" }); else { api.roundWin(); newRound(); } }
              else flagNext();
            } else api.tryAgain(b);
          });
          tray.appendChild(b);
        });
        flagNext();
      }
      newRound();
    },
  });

  // ---- Read & Zap: read the printed word, tap its picture ([M] reading) ----
  // The inverse of Build-a-Word: real whole-word reading, but control-of-error
  // is a SELF-NAMING picture so a non-reader still self-checks (audio helps).
  F.register({
    id: "read-zap",
    icon: "🕸️",
    title: "Read & Zap",
    skill: "read words / decode [M]",
    start(api) {
      const ROUNDS = 5;
      let round = 0;
      const word = api.el("div", { class: "readzap__word", aria: { label: "word" } });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(word, choices);

      function newRound() {
        const r = L.makeWordPicture(api.C.CVC_WORDS);
        api.setPrompt("Read the word — tap its picture!", ["👀", "🔤", "👆"]);
        api.speak();
        api.say(r.word);
        word.textContent = r.word;
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice tap", type: "button", text: ch.emoji,
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: "picture" },
          });
          b.addEventListener("click", () => {
            if (ch.correct) {
              b.classList.add("readzap__hit");
              round += 1;
              if (round >= ROUNDS) api.win({ say: "You read it! Zap!" }); else { api.roundWin(); newRound(); }
            } else api.tryAgain(b);
          });
          choices.appendChild(b);
        });
      }
      newRound();
    },
  });
})();
