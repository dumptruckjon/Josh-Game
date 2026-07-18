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
      api.mascot();

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
      api.mascot();

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
      const FRIENDS = api.C.FRIENDS || [];
      let round = 0, step = 0, letters = [];
      // Josh's own name always leads (it's "Spell My Name"), then the friends
      // rotate in a shuffled order so every friend — Viraj included — gets spelled
      // across sessions (a fixed round%N order used to skip the 4th name forever).
      const order = NAMES.length > 1 ? [NAMES[0]].concat(api.shuffle(NAMES.slice(1))) : NAMES.slice();
      const face = api.el("div", { class: "ns__face art-fill", aria: { hidden: "true" } });
      const nameLabel = api.el("div", { class: "ns__name" });
      const slots = api.el("div", { class: "ns__slots" });
      const tray = api.el("div", { class: "choices choices--4 ns__tray" });
      api.stage.append(face, nameLabel, slots, tray);

      function flagNext() {
        [...tray.children].forEach((t) => {
          if (!t.dataset.done && t.dataset.letter === letters[step]) t.dataset.correct = "1";
          else if (!t.dataset.done) delete t.dataset.correct;
        });
      }
      function newRound() {
        const entry = order[round % order.length];
        const r = L.makeNameSpell(entry.letters);
        letters = r.letters; step = 0;
        const spec = (FRIENDS.find((f) => f.name === entry.name) || {}).art;
        face.innerHTML = (spec && window.JoshArt && window.JoshArt.friend) ? window.JoshArt.friend(spec) : "";
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
      api.mascot();

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

  // ---- Read & Do (read a whole SENTENCE, tap the matching picture) ----
  // The bridge from single-word decoding (read-zap) to reading a sentence. The
  // 👂 reads the sentence aloud, and the picture choices are self-naming, so it
  // stays playable with sound off (the non-reader law).
  F.register({
    id: "read-do",
    icon: "📖",
    title: "Read & Do",
    skill: "read a sentence → picture [P→W]",
    start(api) {
      const SENTENCES = (api.C.SENTENCES && api.C.SENTENCES.length) ? api.C.SENTENCES : [{ text: "the dog", answer: "🐶", pics: ["🐶", "🐱", "🐰"] }];
      const ROUNDS = 4;
      let round = 0;
      const sentence = api.el("div", { class: "sentence" });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(sentence, choices);

      function newRound() {
        const s = api.randItem(SENTENCES);
        api.setPrompt(s.text, ["👂", "📖", "👉"]); // the spoken prompt IS the sentence (👂 replays it)
        api.speak();
        sentence.innerHTML = "";
        s.text.split(" ").forEach((w) => sentence.appendChild(api.el("span", { class: "sentence__word", text: w })));
        choices.innerHTML = "";
        api.shuffle(s.pics.slice()).forEach((p) => {
          const b = api.el("button", {
            class: "choice tap", type: "button", text: p,
            dataset: p === s.answer ? { correct: "1" } : {}, aria: { label: "picture" },
          });
          b.addEventListener("click", () => {
            if (p === s.answer) { round += 1; if (round >= ROUNDS) api.win({ say: "You read it!" }); else { api.roundWin(); newRound(); } }
            else api.tryAgain(b);
          });
          choices.appendChild(b);
        });
        api.mascot();
      }
      newRound();
    },
  });

  // ---- Listen & Answer (hear a tiny story, tap who has the thing) ----
  // Oral comprehension: 👂 narrates "the dog has a bone…", then asks "who has the
  // fish?" and Josh taps the character. The scene ALSO shows each pairing, so it's
  // playable with sound off (look & answer). A friend stars in the last story.
  F.register({
    id: "listen-answer",
    icon: "👂",
    title: "Listen & Answer",
    skill: "listening comprehension [P→W]",
    start(api) {
      const STORIES = (api.C.LISTEN_STORIES && api.C.LISTEN_STORIES.length) ? api.C.LISTEN_STORIES
        : [{ pairs: [{ c: "🐶", cn: "dog", o: "🦴", on: "bone" }, { c: "🐱", cn: "cat", o: "🐟", on: "fish" }] }];
      const ROUNDS = 4;
      let round = 0;
      const scene = api.el("div", { class: "listen__scene" });
      const q = api.el("div", { class: "listen__q" });
      const choices = api.el("div", { class: "choices choices--3" });
      api.stage.append(scene, q, choices);

      function newRound() {
        const r = L.makeListen(STORIES);
        scene.innerHTML = "";
        r.pairs.forEach((p) => {
          scene.appendChild(api.el("div", { class: "listen__pair", aria: { hidden: "true" } }, [
            api.el("span", { class: "listen__c", text: p.c }),
            api.el("span", { class: "listen__o", text: p.o }),
          ]));
        });
        q.innerHTML = "";
        q.append(
          api.el("span", { class: "listen__qobj", aria: { hidden: "true" }, text: r.ask.o }),
          api.el("span", { class: "listen__qmark", text: "❓" })
        );
        // No article before a proper name: "Josh has the ball", not "The Josh…".
        // (Capitalised cn = a friend's name; lowercase = a common-noun animal.)
        const story = r.pairs.map((p) => (/^[A-Z]/.test(p.cn) ? "" : "The ") + p.cn + " has the " + p.on + ".").join(" ");
        api.setPrompt(story + " Who has the " + r.ask.on + "?", ["👂", "🐾", r.ask.o]);
        api.speak();
        choices.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice tap", type: "button", text: ch.c,
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: "character" },
          });
          b.addEventListener("click", () => {
            if (ch.correct) { round += 1; if (round >= ROUNDS) api.win({ say: "You listened!" }); else { api.roundWin(); newRound(); } }
            else api.tryAgain(b);
          });
          choices.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- 🚂 Alphabet Train (letter ORDER — which letter is missing?) ----
  // Four letter-cars roll in with one missing (never the engine car, so an
  // anchor always shows). Tap the right letter and it chugs into place; the
  // whole train then chants its letters in order.
  F.register({
    id: "alpha-train",
    icon: "🚂",
    title: "Alphabet Train",
    skill: "alphabet order [W]",
    start(api) {
      const ROUNDS = 4;
      let round = 0, lastStart = -1, r = null;
      const train = api.el("div", { class: "at__train", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(train, chips);
      api.mascot();

      function newRound() {
        r = L.makeAlphaTrain(undefined, lastStart);
        lastStart = r.start;
        api.setPrompt("Which letter is missing?", ["🚂", "🔤", "🤔"]);
        api.speak(); api.say("Which letter is missing from the train?");
        train.innerHTML = "";
        train.appendChild(api.el("span", { class: "at__engine", text: "🚂", aria: { hidden: "true" } }));
        r.letters.forEach((ch, i) => {
          train.appendChild(api.el("span", {
            class: "at__car" + (i === r.blankIdx ? " at__car--blank" : ""),
            text: i === r.blankIdx ? "?" : ch,
          }));
        });
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--letter tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.ch },
          }, [ch.ch]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            const blank = train.querySelector(".at__car--blank");
            if (blank) { blank.textContent = r.answer; blank.classList.remove("at__car--blank"); blank.classList.add("pop"); }
            api.say(r.letters.join(", ") + "!"); // the completed train chants its letters
            round += 1;
            if (round >= ROUNDS) api.win({ say: "You know your alphabet order!" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Ending Sound (beginning-sound's sibling: the LAST letter) [W] ----
  F.register({
    id: "end-sound", icon: "🔚", title: "Ending Sound", skill: "ending sounds [W]",
    start(api) {
      const C = api.C;
      const ROUNDS = 4; let round = 0, last = -1, r = null;
      const pic = api.el("div", { class: "fs__pic", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(pic, chips);
      function newRound() {
        r = L.makeEndSound(C.END_WORDS, undefined, last); last = r.idx;
        api.setPrompt("What sound does it END with?", ["👂", "🔚", "👉"]);
        api.speak(); api.say("What sound does " + r.word.word + " end with?");
        pic.textContent = r.word.emoji;
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--letter tap", type: "button", text: ch.letter,
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.letter },
          });
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            api.say(r.word.word + " ends with " + r.word.letter + "!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "Great listening!" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- The Missing Middle (pick the CVC vowel; the picture is control-of-error) [W] ----
  F.register({
    id: "vowel-pick", icon: "🅰️", title: "The Missing Middle", skill: "CVC vowels [W]",
    start(api) {
      const C = api.C;
      const ROUNDS = 4; let round = 0, last = -1, r = null;
      const pic = api.el("div", { class: "fs__pic", aria: { hidden: "true" } });
      const wordEl = api.el("div", { class: "vowel__word" });
      const chips = api.el("div", { class: "choices choices--3" });
      api.stage.append(pic, wordEl, chips);
      function newRound() {
        r = L.makeVowelPick(C.VOWEL_WORDS, undefined, last); last = r.idx;
        api.setPrompt("Which letter is missing?", ["🅰️", "🤔", "👉"]);
        api.speak(); api.say("What sound is in the middle of " + r.word.word + "?");
        pic.textContent = r.word.emoji;
        wordEl.textContent = r.display;
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--letter choice--lower tap", type: "button", text: ch.v,
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.v },
          });
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            wordEl.textContent = r.word.word;
            wordEl.classList.remove("pop"); void wordEl.offsetWidth; wordEl.classList.add("pop");
            api.say(r.word.word + "!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "You spelled them all!" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Word Family Houses (sort a pictured word to its rime) [W] ----
  F.register({
    id: "word-family", icon: "🏠", title: "Word Family Houses", skill: "rimes [W]",
    start(api) {
      const C = api.C;
      const ROUNDS = 6; let round = 0, r = null;
      const card = api.el("div", { class: "wf__card" });
      const bins = api.el("div", { class: "choices wf__houses" });
      api.stage.append(card, bins);
      function newRound() {
        r = L.makeFamilySort(C.WORD_FAMILIES);
        api.setPrompt("Which house does it live in?", ["🏠", "👂", "👉"]);
        api.speak(); api.say(r.item.word + ". Which family?");
        card.innerHTML = '<span class="wf__emoji">' + r.item.emoji + '</span><span class="wf__word">' + r.item.word + "</span>";
        bins.innerHTML = "";
        r.bins.forEach((bin, i) => {
          const b = api.el("button", {
            class: "choice wf__house tap", type: "button",
            dataset: i === r.correctIndex ? { correct: "1" } : {}, aria: { label: bin.label },
          }, ["🏠 " + bin.label]);
          b.addEventListener("click", () => {
            if (i !== r.correctIndex) { api.tryAgain(b); return; }
            api.say(r.item.word + " is in the " + bin.label + " house!");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "You found every family!" });
            else { api.roundWin(); newRound(); }
          });
          bins.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ---- Letter Pairs (concentration: match a BIG letter to its little twin) [W] ----
  // Only the currently-solvable pair carries data-correct (syncFlags) — mirrors
  // Memory Match, so the generic harness always advances.
  F.register({
    id: "letter-pairs", icon: "🃏", title: "Letter Pairs", skill: "big & little letters [W]",
    start(api) {
      const C = api.C;
      const PAIRS = 4;
      const picks = api.shuffle((C.LETTER_PAIR_POOL || []).slice()).slice(0, PAIRS);
      const deck = api.shuffle(picks.flatMap((k) => [{ key: k, face: k }, { key: k, face: k.toLowerCase() }]));
      let first = null, lock = false, matched = 0;
      const cards = [];
      const grid = api.el("div", { class: "memory-grid" });
      api.stage.append(grid);
      api.setPrompt("Flip the big letter and its little twin!", ["🔤", "🧠", "✌️"]);
      api.speak();
      function syncFlags() {
        cards.forEach((c) => delete c.dataset.correct);
        if (first) {
          const m = cards.find((c) => c !== first && !c.dataset.matched && c.dataset.key === first.dataset.key);
          if (m) m.dataset.correct = "1";
        } else {
          const rem = cards.filter((c) => !c.dataset.matched);
          if (rem.length) { const k = rem[0].dataset.key; rem.filter((c) => c.dataset.key === k).forEach((c) => (c.dataset.correct = "1")); }
        }
      }
      function flip(card) {
        if (lock || card.dataset.matched || card === first || card.classList.contains("flipped")) return;
        card.classList.add("flipped"); card.textContent = card.__face;
        if (!first) { first = card; syncFlags(); return; }
        if (card.dataset.key === first.dataset.key) {
          card.dataset.matched = "1"; first.dataset.matched = "1"; card.classList.add("matched"); first.classList.add("matched");
          first = null; matched += 1; syncFlags(); api.roundWin();
          if (matched === PAIRS) api.win({ say: "You matched every letter!" });
        } else {
          lock = true; const a = first; first = null;
          setTimeout(() => { a.classList.remove("flipped"); a.textContent = ""; card.classList.remove("flipped"); card.textContent = ""; lock = false; syncFlags(); }, 700);
        }
      }
      deck.forEach((cd) => {
        const card = api.el("button", { class: "memory-card tap", type: "button", dataset: { key: cd.key }, aria: { label: "card" } }, [""]);
        card.__face = cd.face;
        card.addEventListener("click", () => flip(card));
        grid.appendChild(card); cards.push(card);
      });
      syncFlags();
    },
  });
})();
