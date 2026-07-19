// 华丽的游戏（一）— tiles, words & poetry, memory, mental math (20 games).
// Every def: id "hl-…", hl: true (never in Josh's menus), hlCat (her category),
// homeHash (Home returns to HER category), lang: "zh" (Mandarin voice + zh
// framework strings). Same TEST CONTRACT as every Josh game: data-correct
// chain → api.win(); the generic harness plays each one to a win.
(function () {
  const F = window.JoshFramework;
  const L = window.JoshLogic;
  const HL = window.HualiContent;
  if (!F || !L || !HL) return;

  function reg(cat, def) {
    def.hl = true;
    def.lang = "zh";
    def.hlCat = cat;
    def.homeHash = "#hl-cat-" + cat;
    F.register(def);
  }

  // All 27 text tiles (一万…九条) built once from the content suits.
  function allTiles() {
    const out = [];
    for (const suit of HL.TILE_SUITS) for (const n of HL.TILE_NUMBERS) out.push(n + suit);
    return out;
  }
  function tileButton(api, text, props) {
    const b = api.el("button", Object.assign({ class: "choice hl-tilebtn tap", type: "button", aria: { label: text } }, props || {}));
    b.innerHTML = '<span class="hl-tileface">' + text.split("").join("<br>") + "</span>";
    return b;
  }

  // ================= 🀄 麻将牌艺 =================

  // 找对子 — one pair hides among distinct tiles; tap BOTH twins.
  reg("hlc-tiles", {
    id: "hl-tile-pair", icon: "🀄", title: "找对子",
    skill: "麻将找对 — 观察力",
    start(api) {
      const ROUNDS = 3;
      let round = 0, found = 0, r = null;
      const grid = api.el("div", { class: "hl-grid3" });
      api.stage.append(grid);
      function newRound() {
        r = L.makeTwins(allTiles(), 9, undefined);
        found = 0;
        api.setPrompt("找出一样的两张牌！", ["🀄", "👀", "✌️"]);
        api.speak();
        grid.innerHTML = "";
        r.cells.forEach((cell) => {
          const b = tileButton(api, cell.emoji, { dataset: cell.correct ? { correct: "1" } : {} });
          b.addEventListener("click", () => {
            if (!cell.correct) { api.tryAgain(b); return; }
            if (b.dataset.done) return;
            b.dataset.done = "1"; delete b.dataset.correct;
            b.classList.add("hl-tilebtn--hit");
            found += 1;
            if (found >= 2) {
              api.say("找到了！是" + r.twin + "！");
              round += 1;
              if (round >= ROUNDS) api.win({ say: "对子全找到了！好眼力！" });
              else { api.roundWin(); newRound(); }
            }
          });
          grid.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 麻将配对 — concentration: flip cards to match tile pairs.
  // Like Josh's Memory Match, only the currently-solvable pair carries
  // data-correct (syncFlags) so the generic harness always advances.
  reg("hlc-tiles", {
    id: "hl-tile-memory", icon: "🎴", title: "麻将配对",
    skill: "翻牌记忆",
    start(api) {
      const PAIRS = 4;
      const picks = api.shuffle(allTiles()).slice(0, PAIRS);
      const deck = api.shuffle([...picks, ...picks]);
      let open = null, matched = 0, lock = false;
      const cards = [];
      api.setPrompt("翻两张一样的牌！", ["🎴", "🧠", "✌️"]);
      const grid = api.el("div", { class: "hl-grid4" });
      api.stage.append(grid);
      function syncFlags() {
        cards.forEach((c) => delete c.dataset.correct);
        const rem = cards.filter((c) => !c.classList.contains("hl-card--done"));
        if (open) {
          const m = rem.find((c) => c !== open && c.dataset.tile === open.dataset.tile);
          if (m) m.dataset.correct = "1";
        } else if (rem.length) {
          const t = rem[0].dataset.tile;
          rem.filter((c) => c.dataset.tile === t).forEach((c) => (c.dataset.correct = "1"));
        }
      }
      deck.forEach((tile) => {
        const b = api.el("button", { class: "choice hl-tilebtn hl-card tap", type: "button", dataset: { tile: tile }, aria: { label: "牌" } });
        b.innerHTML = '<span class="hl-cardback">🀄</span><span class="hl-tileface">' + tile.split("").join("<br>") + "</span>";
        b.addEventListener("click", () => {
          if (lock || b.classList.contains("hl-card--open") || b.classList.contains("hl-card--done")) return;
          b.classList.add("hl-card--open");
          if (!open) { open = b; syncFlags(); return; }
          const a = open; open = null;
          if (a.dataset.tile === b.dataset.tile) {
            a.classList.add("hl-card--done"); b.classList.add("hl-card--done");
            api.say("配上了！" + tile + "！");
            matched += 1;
            syncFlags();
            if (matched >= PAIRS) api.win({ say: "全配对了！记性真好！" });
            else api.roundWin();
          } else {
            lock = true;
            setTimeout(() => { a.classList.remove("hl-card--open"); b.classList.remove("hl-card--open"); lock = false; syncFlags(); }, 750);
          }
        });
        grid.appendChild(b);
        cards.push(b);
      });
      syncFlags();
    },
  });

  // 缺哪张牌 — a run with one missing tile (三筒 四筒 __ 六筒).
  reg("hlc-tiles", {
    id: "hl-tile-run", icon: "🃏", title: "缺哪张牌",
    skill: "顺子接龙",
    start(api) {
      const ROUNDS = 4;
      let round = 0, lastStart = -1, r = null, suit = "筒";
      const row = api.el("div", { class: "hl-run", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3 hl-choices" });
      api.stage.append(row, chips);
      function newRound() {
        suit = api.randItem(HL.TILE_SUITS);
        const list = HL.TILE_NUMBERS.map((n) => n + suit);
        r = L.makeOrderTrain(list, undefined, { window: 4, lastStart });
        lastStart = r.start;
        api.setPrompt("缺了哪张牌？", ["🀄", "🤔", "👉"]);
        api.speak();
        row.innerHTML = "";
        r.items.forEach((tile, i) => {
          const cell = api.el("span", { class: "hl-runtile" + (i === r.blankIdx ? " hl-runtile--blank" : "") });
          cell.innerHTML = i === r.blankIdx ? "？" : '<span class="hl-tileface">' + tile.split("").join("<br>") + "</span>";
          row.appendChild(cell);
        });
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = tileButton(api, ch.value, { dataset: ch.correct ? { correct: "1" } : {} });
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            const blank = row.querySelector(".hl-runtile--blank");
            if (blank) { blank.innerHTML = '<span class="hl-tileface">' + r.answer.split("").join("<br>") + "</span>"; blank.classList.remove("hl-runtile--blank"); blank.classList.add("pop"); }
            api.say("对！是" + r.answer + "！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "顺子全接上了！" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 哪张不一样 — a field of one tile with a single different one hiding.
  reg("hlc-tiles", {
    id: "hl-tile-odd", icon: "🔎", title: "哪张不一样",
    skill: "火眼金睛",
    start(api) {
      const ROUNDS = 3;
      let round = 0;
      const grid = api.el("div", { class: "hl-grid3" });
      api.stage.append(grid);
      function newRound() {
        const r = L.makeCrowd(allTiles(), 9, undefined);
        api.setPrompt("哪张牌不一样？", ["🀄", "👀", "☝️"]);
        api.speak();
        grid.innerHTML = "";
        r.cells.forEach((cell) => {
          const b = tileButton(api, cell.emoji, { dataset: cell.correct ? { correct: "1" } : {} });
          b.addEventListener("click", () => {
            if (!cell.correct) { api.tryAgain(b); return; }
            b.classList.add("pop");
            api.say("找到了！这张是" + cell.emoji + "！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "每张都逃不过您的眼睛！" });
            else { api.roundWin(); newRound(); }
          });
          grid.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 数一数 — how many 🀄 tiles are on the table?
  reg("hlc-tiles", {
    id: "hl-tile-count", icon: "🧮", title: "数一数",
    skill: "点数",
    start(api) {
      const ROUNDS = 4;
      let round = 0, lastN = 0;
      const field = api.el("div", { class: "hl-countfield", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3 hl-choices" });
      api.stage.append(field, chips);
      function newRound() {
        const r = L.makeQuickPeek(undefined, 6, lastN);
        lastN = r.n;
        api.setPrompt("桌上有几张牌？", ["🀄", "🧮", "🤔"]);
        api.speak();
        field.innerHTML = "";
        r.dots.forEach(([x, y]) => {
          field.appendChild(api.el("span", { class: "hl-countdot", text: "🀄", style: { left: x + "%", top: y + "%" } }));
        });
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--num hl-numchip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: String(ch.n) },
          }, [String(ch.n)]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            api.say(r.n + "张，没错！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "张张都数得清！" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 快看快记 — the tiles hide behind a red cloth; peek freely, then answer.
  reg("hlc-tiles", {
    id: "hl-tile-peek", icon: "👀", title: "快看快记",
    skill: "瞬间记忆",
    start(api) {
      const ROUNDS = 4;
      let round = 0, lastN = 0, shown = false;
      const box = api.el("div", { class: "qp__box hl-peekbox" });
      const dots = api.el("div", { class: "qp__dots", aria: { hidden: "true" } });
      const cloth = api.el("button", { class: "qp__cloud hl-cloth tap", type: "button", text: "🧧", aria: { label: "看一看" } });
      box.append(dots, cloth);
      const chips = api.el("div", { class: "choices choices--3 hl-choices" });
      api.stage.append(box, chips);
      cloth.addEventListener("click", () => {
        shown = !shown;
        box.classList.toggle("qp__box--open", shown);
        if (shown) api.say("看！");
      });
      function newRound() {
        const r = L.makeQuickPeek(undefined, 6, lastN);
        lastN = r.n;
        shown = false;
        box.classList.remove("qp__box--open");
        api.setPrompt("掀开红包看一眼——有几个？", ["🧧", "👀", "🔢"]);
        api.speak();
        dots.innerHTML = "";
        r.dots.forEach(([x, y]) => {
          dots.appendChild(api.el("span", { class: "qp__dot", text: "🏮", style: { left: x + "%", top: y + "%" } }));
        });
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--num hl-numchip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: String(ch.n) },
          }, [String(ch.n)]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            box.classList.add("qp__box--open");
            api.say(r.n + "个！好记性！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "看一眼就记住，真了不起！" });
            else { api.roundWin(); setTimeout(() => { if (box.isConnected) newRound(); }, 900); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ================= 📜 诗词成语 =================

  // 唐诗接句 — the next line of a beloved Tang poem.
  reg("hlc-words", {
    id: "hl-poem", icon: "📜", title: "唐诗接句",
    skill: "唐诗",
    start(api) {
      const ROUNDS = 4;
      let round = 0, lastKey = null, r = null;
      const promptEl = api.el("div", { class: "hl-bigline" });
      const byline = api.el("div", { class: "hl-byline" });
      const chips = api.el("div", { class: "choices hl-lines" });
      api.stage.append(promptEl, byline, chips);
      function newRound() {
        r = L.makePoemNext(HL.POEMS, undefined, lastKey);
        lastKey = r.key;
        api.setPrompt("下一句是什么？", ["📜", "🤔", "👉"]);
        api.speak(); api.say(r.prompt + "。下一句是什么？");
        promptEl.textContent = r.prompt + "，";
        byline.textContent = "——《" + r.poem.title + "》 " + r.poem.author;
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice hl-linechip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.line },
          }, [ch.line]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            api.say(r.prompt + "，" + r.answer + "。");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "诗句张口就来，真有学问！" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 成语填空 — fill the blanked character of a real idiom.
  reg("hlc-words", {
    id: "hl-idiom", icon: "✍️", title: "成语填空",
    skill: "成语",
    start(api) {
      const ROUNDS = 4;
      let round = 0, lastIdx = -1, r = null;
      const promptEl = api.el("div", { class: "hl-bigline hl-idiom" });
      const chips = api.el("div", { class: "choices choices--3 hl-choices" });
      api.stage.append(promptEl, chips);
      function newRound() {
        r = L.makeIdiomFill(HL.IDIOMS, undefined, lastIdx);
        lastIdx = r.idx;
        api.setPrompt("补全这个成语！", ["✍️", "🤔", "👉"]);
        api.speak();
        promptEl.textContent = r.display;
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice hl-charchip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.ch },
          }, [ch.ch]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            promptEl.textContent = r.idiom.text;
            promptEl.classList.remove("pop"); void promptEl.offsetWidth; promptEl.classList.add("pop");
            api.say(r.idiom.text + "！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "成语难不倒您！" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 反义词 — tap the opposite.
  reg("hlc-words", {
    id: "hl-anton", icon: "↔️", title: "反义词",
    skill: "反义词",
    start(api) {
      const ROUNDS = 4;
      let round = 0, lastIdx = -1, r = null;
      const items = HL.ANTONYMS.map((p) => ({ q: p.a, a: p.b }));
      const promptEl = api.el("div", { class: "hl-bigchar" });
      const chips = api.el("div", { class: "choices choices--3 hl-choices" });
      api.stage.append(promptEl, chips);
      function newRound() {
        r = L.makePairPick(items, undefined, lastIdx);
        lastIdx = r.idx;
        api.setPrompt("它的反义词是什么？", ["↔️", "🤔", "👉"]);
        api.speak(); api.say(r.item.q + "的反义词是什么？");
        promptEl.textContent = r.item.q;
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice hl-charchip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.a },
          }, [ch.a]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            api.say(r.item.q + "对" + r.item.a + "，答对了！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "反义词全对！" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 量词搭配 — 一__马: pick the measure word.
  reg("hlc-words", {
    id: "hl-mw", icon: "🔡", title: "量词搭配",
    skill: "量词",
    start(api) {
      const ROUNDS = 4;
      let round = 0, lastIdx = -1, r = null;
      const promptEl = api.el("div", { class: "hl-bigline" });
      const chips = api.el("div", { class: "choices choices--3 hl-choices" });
      api.stage.append(promptEl, chips);
      function newRound() {
        r = L.makeMeasureWord(HL.MEASURE_WORDS, undefined, lastIdx);
        lastIdx = r.idx;
        api.setPrompt("一▢" + r.pair.noun + " — 填哪个量词？", ["🔡", "🤔", "👉"]);
        api.speak(); api.say("一什么" + r.pair.noun + "？");
        promptEl.textContent = "一▢" + r.pair.noun + " " + r.pair.emoji;
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice hl-charchip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.mw },
          }, [ch.mw]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            promptEl.textContent = "一" + r.pair.mw + r.pair.noun + " " + r.pair.emoji;
            promptEl.classList.remove("pop"); void promptEl.offsetWidth; promptEl.classList.add("pop");
            api.say("一" + r.pair.mw + r.pair.noun + "，对啦！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "量词用得真地道！" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 找"福"字 — pop every card with the target character (same-radical lookalikes).
  reg("hlc-words", {
    id: "hl-fu-hunt", icon: "🧧", title: "找福字",
    skill: "找字眼力",
    start(api) {
      const ROUNDS = 3;
      let round = 0, need = 0;
      const targetEl = api.el("div", { class: "hl-bigchar hl-target" });
      const grid = api.el("div", { class: "hl-grid3" });
      api.stage.append(targetEl, grid);
      function newRound() {
        // Always hunt 福 (luck) so the 找福字 tile and the round agree; the
        // distractors are the same-radical lookalikes 祝/礼/神/视/祖.
        const r = L.makeLetterHunt(HL.HUNT_CHARS, undefined, { target: "福", mixCase: false });
        need = r.need;
        api.setPrompt("把每个「" + r.target + "」字都找出来！", ["🧧", "👀", "👉"]);
        api.speak();
        targetEl.textContent = r.target;
        grid.innerHTML = "";
        r.cells.forEach((cell) => {
          const b = api.el("button", {
            class: "choice hl-charchip hl-charcell tap", type: "button",
            dataset: cell.correct ? { correct: "1" } : {}, aria: { label: cell.ch },
          }, [cell.ch]);
          b.addEventListener("click", () => {
            if (!cell.correct) { api.tryAgain(b); return; }
            if (b.dataset.done) return;
            b.dataset.done = "1"; delete b.dataset.correct;
            b.classList.add("hl-charcell--hit");
            api.say(r.target + "！");
            need -= 1;
            if (need <= 0) {
              round += 1;
              if (round >= ROUNDS) api.win({ say: "福气满满，全找到了！" });
              else { api.roundWin(); newRound(); }
            }
          });
          grid.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 找不同的字 — 我我我找我我: the classic lookalike hunt.
  reg("hlc-words", {
    id: "hl-char-odd", icon: "🈳", title: "找不同的字",
    skill: "字形分辨",
    start(api) {
      const ROUNDS = 3;
      let round = 0;
      const grid = api.el("div", { class: "hl-grid3" });
      api.stage.append(grid);
      function newRound() {
        const r = L.makeCharCrowd(HL.CHAR_PAIRS, 9, undefined);
        api.setPrompt("满屏都是「" + r.base + "」，藏着一个不一样的字！", ["🈳", "👀", "☝️"]);
        api.speak();
        grid.innerHTML = "";
        r.cells.forEach((cell) => {
          const b = api.el("button", {
            class: "choice hl-charchip hl-charcell tap", type: "button",
            dataset: cell.correct ? { correct: "1" } : {}, aria: { label: cell.ch },
          }, [cell.ch]);
          b.addEventListener("click", () => {
            if (!cell.correct) { api.tryAgain(b); return; }
            b.classList.add("pop");
            api.say("找到了！是「" + r.odd + "」字！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "一眼就看穿，厉害！" });
            else { api.roundWin(); newRound(); }
          });
          grid.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ================= 🧠 记忆锻炼 =================

  // 翻牌配对 — zodiac concentration. syncFlags keeps data-correct on the
  // currently-solvable pair only (the harness always advances).
  reg("hlc-memory", {
    id: "hl-memory", icon: "🐲", title: "翻牌配对",
    skill: "记忆配对",
    start(api) {
      const PAIRS = 5;
      const picks = api.shuffle(HL.ZODIAC.slice()).slice(0, PAIRS);
      const deck = api.shuffle([...picks, ...picks]);
      let open = null, matched = 0, lock = false;
      const cards = [];
      api.setPrompt("翻两张一样的！", ["🐲", "🧠", "✌️"]);
      const grid = api.el("div", { class: "hl-grid5" });
      api.stage.append(grid);
      function syncFlags() {
        cards.forEach((c) => delete c.dataset.correct);
        const rem = cards.filter((c) => !c.classList.contains("hl-card--done"));
        if (open) {
          const m = rem.find((c) => c !== open && c.dataset.tile === open.dataset.tile);
          if (m) m.dataset.correct = "1";
        } else if (rem.length) {
          const t = rem[0].dataset.tile;
          rem.filter((c) => c.dataset.tile === t).forEach((c) => (c.dataset.correct = "1"));
        }
      }
      deck.forEach((z) => {
        const b = api.el("button", { class: "choice hl-card tap", type: "button", dataset: { tile: z.name }, aria: { label: "牌" } });
        b.innerHTML = '<span class="hl-cardback">🏮</span><span class="hl-cardface">' + z.emoji + "</span>";
        b.addEventListener("click", () => {
          if (lock || b.classList.contains("hl-card--open") || b.classList.contains("hl-card--done")) return;
          b.classList.add("hl-card--open");
          if (!open) { open = b; syncFlags(); return; }
          const a = open; open = null;
          if (a.dataset.tile === b.dataset.tile) {
            a.classList.add("hl-card--done"); b.classList.add("hl-card--done");
            api.say("配上了！是" + z.name + "！");
            matched += 1;
            syncFlags();
            if (matched >= PAIRS) api.win({ say: "全部配对成功！" });
            else api.roundWin();
          } else {
            lock = true;
            setTimeout(() => { a.classList.remove("hl-card--open"); b.classList.remove("hl-card--open"); lock = false; syncFlags(); }, 750);
          }
        });
        grid.appendChild(b);
        cards.push(b);
      });
      syncFlags();
    },
  });

  // 什么变了 — one thing in the row quietly changed.
  reg("hlc-memory", {
    id: "hl-changed", icon: "🔄", title: "什么变了",
    skill: "观察记忆",
    start(api) {
      const ROUNDS = 3;
      let round = 0;
      const beforeRow = api.el("div", { class: "hl-row", aria: { hidden: "true" } });
      const label = api.el("div", { class: "hl-byline", text: "↓ 现在" });
      const afterRow = api.el("div", { class: "hl-row hl-row--after" });
      api.stage.append(beforeRow, label, afterRow);
      function newRound() {
        const r = L.makeSpotDifference(HL.SPOT_POOL, 4, undefined);
        api.setPrompt("下面这排，哪个变了？", ["👀", "🔄", "☝️"]);
        api.speak();
        beforeRow.textContent = r.before.join(" ");
        afterRow.innerHTML = "";
        r.after.forEach((emoji, i) => {
          const b = api.el("button", {
            class: "choice hl-spot tap", type: "button",
            dataset: i === r.diffIndex ? { correct: "1" } : {}, aria: { label: emoji },
          }, [emoji]);
          b.addEventListener("click", () => {
            if (i !== r.diffIndex) { api.tryAgain(b); return; }
            b.classList.add("pop");
            api.say("对！" + r.before[r.diffIndex] + "变成了" + emoji + "！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "什么都瞒不过您！" });
            else { api.roundWin(); newRound(); }
          });
          afterRow.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 记菜单 — memorize the order, then pick exactly those dishes.
  reg("hlc-memory", {
    id: "hl-menu", icon: "🥢", title: "记菜单",
    skill: "购物清单记忆",
    start(api) {
      const ROUNDS = 3;
      let round = 0, r = null, got = 0;
      const menuEl = api.el("div", { class: "hl-menu" });
      const grid = api.el("div", { class: "hl-grid3", hidden: "" });
      const showBtn = api.el("button", { class: "btn-big hl-gobtn", type: "button" }, ["记好了，开始点菜 🥢"]);
      api.stage.append(menuEl, showBtn, grid);
      // While the menu is being memorized, the ONLY correct next tap is the Go
      // button (the hidden dishes must not carry data-correct, or the test
      // harness would click them through the hidden grid and stall).
      showBtn.addEventListener("click", () => {
        if (!grid.hidden) return;
        menuEl.classList.add("hl-menu--dim");
        grid.hidden = false;
        delete showBtn.dataset.correct;
        grid.querySelectorAll(".hl-dish").forEach((b, i) => {
          if (r.cells[i].correct && !b.dataset.done) b.dataset.correct = "1";
        });
      });
      function newRound() {
        r = L.makeMenuMemory(HL.DISHES, undefined, { k: 3, n: 6 });
        got = 0;
        api.setPrompt("先记住这三道菜！", ["🥢", "🧠", "📝"]);
        api.speak(); api.say("今天点的菜是：" + r.menu.join("，") + "。");
        menuEl.classList.remove("hl-menu--dim");
        menuEl.textContent = r.menu.join("  ·  ");
        grid.hidden = true;
        showBtn.dataset.correct = "1";
        grid.innerHTML = "";
        r.cells.forEach((cell) => {
          const b = api.el("button", {
            class: "choice hl-dish tap", type: "button", aria: { label: cell.name },
          }, [cell.name]);
          b.addEventListener("click", () => {
            if (grid.hidden) return;
            if (!cell.correct) { api.tryAgain(b); return; }
            if (b.dataset.done) return;
            b.dataset.done = "1"; delete b.dataset.correct;
            b.classList.add("hl-dish--hit");
            api.say(cell.name + "，点上了！");
            got += 1;
            if (got >= r.k) {
              round += 1;
              if (round >= ROUNDS) api.win({ say: "三道菜一道不落，记性真好！" });
              else { api.roundWin(); newRound(); }
            }
          });
          grid.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 先后顺序 — tap the steps of a familiar sequence in order.
  reg("hlc-memory", {
    id: "hl-seq-order", icon: "1️⃣", title: "先后顺序",
    skill: "顺序整理",
    start(api) {
      const ROUNDS = 3;
      let round = 0, next = 0, r = null;
      const nameEl = api.el("div", { class: "hl-byline" });
      const row = api.el("div", { class: "choices hl-steps" });
      api.stage.append(nameEl, row);
      function newRound() {
        r = L.makeStoryOrder(HL.SEQUENCES, undefined);
        next = 0;
        api.setPrompt("按先后顺序，一步一步点！", ["1️⃣", "2️⃣", "3️⃣"]);
        api.speak(); api.say(r.name + "，先做什么？按顺序点一点。");
        nameEl.textContent = "《" + r.name + "》";
        row.innerHTML = "";
        r.tiles.forEach((t) => {
          const b = api.el("button", {
            class: "choice hl-dish tap", type: "button",
            dataset: t.rank === 0 ? { correct: "1" } : {}, aria: { label: t.emoji },
          }, [t.emoji]);
          b.addEventListener("click", () => {
            if (t.rank !== next) { api.tryAgain(b); return; }
            b.classList.add("hl-dish--hit");
            b.removeAttribute("data-correct");
            api.say(t.emoji + "！");
            next += 1;
            const upcoming = [...row.querySelectorAll("button")].find((x) => !x.classList.contains("hl-dish--hit") && r.tiles[[...row.children].indexOf(x)].rank === next);
            if (upcoming) upcoming.dataset.correct = "1";
            if (next >= r.order.length) {
              round += 1;
              if (round >= ROUNDS) api.win({ say: "条理清清楚楚！" });
              else { api.roundWin(); newRound(); }
            }
          });
          row.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ================= 🧮 心算算术 =================

  // 买菜算账 — add two market prices.
  reg("hlc-math", {
    id: "hl-market", icon: "🥬", title: "买菜算账",
    skill: "加法心算",
    start(api) {
      const ROUNDS = 4;
      let round = 0, r = null;
      const line = api.el("div", { class: "hl-bigline" });
      const chips = api.el("div", { class: "choices choices--3 hl-choices" });
      api.stage.append(line, chips);
      function newRound() {
        r = L.makeMarket(HL.MARKET, undefined);
        api.setPrompt("一共多少元？", ["🥬", "➕", "💰"]);
        api.speak(); api.say(r.a.name + r.a.price + "元，" + r.b.name + r.b.price + "元，一共多少元？");
        line.textContent = r.a.emoji + r.a.name + r.a.price + "元 + " + r.b.emoji + r.b.name + r.b.price + "元 = ?";
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--num hl-numchip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.n + "元" },
          }, [ch.n + "元"]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            api.say("一共" + r.total + "元，算得真快！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "买菜算账，心里有数！" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 找零钱 — pay 10元, how much change?
  reg("hlc-math", {
    id: "hl-change", icon: "💴", title: "找零钱",
    skill: "减法心算",
    start(api) {
      const ROUNDS = 4;
      let round = 0, lastCost = 0, r = null;
      const line = api.el("div", { class: "hl-bigline" });
      const chips = api.el("div", { class: "choices choices--3 hl-choices" });
      api.stage.append(line, chips);
      function newRound() {
        r = L.makeChange(undefined, lastCost);
        lastCost = r.cost;
        api.setPrompt("该找回多少元？", ["💴", "➖", "🤔"]);
        api.speak(); api.say("付了10元，东西" + r.cost + "元，该找回多少元？");
        line.textContent = "付 10元 − 花 " + r.cost + "元 = 找 ?元";
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--num hl-numchip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: "找" + ch.n + "元" },
          }, [ch.n + "元"]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            api.say("找回" + r.change + "元，一分不差！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "账算得清清楚楚！" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 四宫数独 — a REAL 4×4 sudoku (box-valid via makeSudoku4, not just a Latin square) with one blank.
  reg("hlc-math", {
    id: "hl-sudoku", icon: "🔢", title: "四宫数独",
    skill: "数独推理",
    start(api) {
      const ROUNDS = 3;
      let round = 0, r = null;
      const grid = api.el("div", { class: "sudoku__grid sudoku__grid--4 hl-sudoku", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--4 hl-choices" });
      api.stage.append(grid, chips);
      function newRound() {
        r = L.makeSudoku4(["1", "2", "3", "4"], undefined);
        api.setPrompt("每行、每列、每个小格都不能重复——空格填几？", ["🔢", "🧩", "🤔"]);
        api.speak();
        grid.innerHTML = "";
        r.grid.forEach((rowArr, ri) => {
          rowArr.forEach((v, ci) => {
            const isBlank = ri === r.blankR && ci === r.blankC;
            grid.appendChild(api.el("span", { class: "sudoku__cell" + (isBlank ? " sudoku__cell--blank" : ""), text: isBlank ? "？" : v }));
          });
        });
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--num hl-numchip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.sym },
          }, [ch.sym]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            const blank = grid.querySelector(".sudoku__cell--blank");
            if (blank) { blank.textContent = r.answer; blank.classList.remove("sudoku__cell--blank"); blank.classList.add("pop"); }
            api.say("填" + r.answer + "，正好不重复！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "数独高手就是您！" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 哪个大 — compare two 2-digit numbers.
  reg("hlc-math", {
    id: "hl-compare", icon: "⚖️", title: "哪个大",
    skill: "数感比较",
    start(api) {
      const ROUNDS = 4;
      let round = 0;
      const cards = api.el("div", { class: "choices hl-compare" });
      api.stage.append(cards);
      function newRound() {
        const r = L.makeNumberCompare(11, 99, undefined);
        api.setPrompt("哪个数大？", ["⚖️", "🤔", "👉"]);
        api.speak(); api.say(r.a + "和" + r.b + "，哪个大？");
        cards.innerHTML = "";
        [{ n: r.a, ok: r.answer === "a" }, { n: r.b, ok: r.answer === "b" }].forEach((c) => {
          const b = api.el("button", {
            class: "choice choice--num hl-numchip hl-numbig tap", type: "button",
            dataset: c.ok ? { correct: "1" } : {}, aria: { label: String(c.n) },
          }, [String(c.n)]);
          b.addEventListener("click", () => {
            if (!c.ok) { api.tryAgain(b); return; }
            api.say(r.bigger + "大，答对了！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "大小一眼就分清！" });
            else { api.roundWin(); newRound(); }
          });
          cards.appendChild(b);
        });
      }
      newRound();
    },
  });
})();
