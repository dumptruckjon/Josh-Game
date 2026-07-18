// 华丽的游戏（二）— memory, mental math, folk culture, sharp eyes, calm (20 games).
// Same rules as games-hl-a.js: every def is hl/zh, registers into HER categories,
// and honors the TEST CONTRACT (data-correct chain → api.win(); toys tickPlay).
(function () {
  const F = window.JoshFramework;
  const L = window.JoshLogic;
  const HL = window.HualiContent;
  const A = window.JoshAudio || { say() {}, tone() {}, unlock() {}, isMuted: () => true };
  if (!F || !L || !HL) return;

  function reg(cat, def) {
    def.hl = true;
    def.lang = "zh";
    def.hlCat = cat;
    def.homeHash = "#hl-cat-" + cat;
    F.register(def);
  }

  const zodiacEmoji = {};
  (HL.ZODIAC || []).forEach((z) => { zodiacEmoji[z.name] = z.emoji; });

  // A simple original opera-mask motif, tinted per color (visual pairing only).
  function maskSVG(color) {
    return '<svg viewBox="0 0 100 120" role="img" aria-hidden="true">' +
      '<path d="M50 6 C22 6 12 30 12 56 C12 92 30 114 50 114 C70 114 88 92 88 56 C88 30 78 6 50 6 Z" fill="' + color + '" stroke="#7c1f1f" stroke-width="4"/>' +
      '<path d="M50 6 C42 26 42 94 50 114 M28 22 C36 40 36 84 30 102 M72 22 C64 40 64 84 70 102" fill="none" stroke="#7c1f1f" stroke-width="2.5" opacity="0.55"/>' +
      '<ellipse cx="33" cy="50" rx="11" ry="7" fill="#fff" stroke="#7c1f1f" stroke-width="2.5"/>' +
      '<ellipse cx="67" cy="50" rx="11" ry="7" fill="#fff" stroke="#7c1f1f" stroke-width="2.5"/>' +
      '<circle cx="33" cy="50" r="3.4" fill="#26150f"/><circle cx="67" cy="50" r="3.4" fill="#26150f"/>' +
      '<path d="M38 84 Q50 92 62 84" fill="none" stroke="#7c1f1f" stroke-width="3.5" stroke-linecap="round"/>' +
      '<path d="M46 30 Q50 24 54 30 M24 36 Q30 30 36 34 M64 34 Q70 30 76 36" fill="none" stroke="#7c1f1f" stroke-width="2.5" stroke-linecap="round"/>' +
      "</svg>";
  }

  // ================= 🧠 记忆锻炼（补） =================

  // 谁藏起来了 — one zodiac friend slips behind a red envelope; who is it?
  reg("hlc-memory", {
    id: "hl-who-hid", icon: "🧧", title: "谁藏起来了",
    skill: "观察与排除",
    start(api) {
      const ROUNDS = 3;
      let round = 0;
      const row = api.el("div", { class: "hl-lineup", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3 hl-choices" });
      api.stage.append(row, chips);
      function newRound() {
        const r = L.makeWhoHid(HL.ZODIAC, undefined);
        api.setPrompt("红包后面藏的是谁？", ["🧧", "🤔", "👉"]);
        api.speak();
        row.innerHTML = "";
        r.lineup.forEach((z, i) => {
          row.appendChild(api.el("span", { class: "hl-lineupcell" + (i === r.hiddenIdx ? " hl-lineupcell--hid" : "") },
            [i === r.hiddenIdx ? "🧧" : z.emoji]));
        });
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice hl-zochip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.name },
          }, [ch.emoji + " " + ch.name]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            const hid = row.querySelector(".hl-lineupcell--hid");
            if (hid) { hid.textContent = ch.emoji; hid.classList.remove("hl-lineupcell--hid"); hid.classList.add("pop"); }
            api.say("是" + ch.name + "！被您找出来了！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "谁都藏不住，好记性！" });
            else { api.roundWin(); setTimeout(() => { if (row.isConnected) newRound(); }, 800); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 照样敲 — watch the drum/gong/woodfish order, then echo it (order, never timing).
  reg("hlc-memory", {
    id: "hl-echo", icon: "🥁", title: "照样敲",
    skill: "顺序记忆",
    start(api) {
      const INS = HL.ECHO_INSTRUMENTS;
      const ROUNDS = 3;
      let round = 0, r = null, step = 0, demoing = false;
      const pad = api.el("div", { class: "cb__pad hl-echopad" });
      const replay = api.el("button", { class: "btn-big cb__replay", type: "button", aria: { label: "再看一遍" } }, ["▶️ 再看一遍"]);
      api.stage.append(pad, replay);
      const drums = INS.map((d, i) => {
        const b = api.el("button", {
          class: "cb__drum tap", type: "button",
          style: { background: d.color }, aria: { label: d.name },
        }, [d.emoji]);
        b.addEventListener("click", () => {
          if (demoing) return;
          try { if (A.tone) A.tone(d.freq, { duration: 0.25 }); } catch (e) { /* ignore */ }
          b.classList.remove("cb__drum--hit"); void b.offsetWidth; b.classList.add("cb__drum--hit");
          if (i !== r.seq[step]) { api.tryAgain(b); step = 0; arm(); return; }
          delete b.dataset.correct;
          step += 1;
          if (step >= r.seq.length) {
            round += 1;
            if (round >= ROUNDS) api.win({ say: "每一下都敲对了，节奏感真好！" });
            else { api.roundWin({ say: "敲对了！" }); newRound(); }
          } else arm();
        });
        pad.appendChild(b);
        return b;
      });
      function arm() {
        drums.forEach((b) => b.removeAttribute("data-correct"));
        if (r && step < r.seq.length) drums[r.seq[step]].dataset.correct = "1";
      }
      function playDemo() {
        demoing = true;
        drums.forEach((b) => b.classList.add("cb__drum--wait"));
        r.seq.forEach((di, k) => {
          setTimeout(() => {
            if (!pad.isConnected) return;
            const b = drums[di];
            b.classList.remove("cb__drum--hit"); void b.offsetWidth; b.classList.add("cb__drum--hit");
            try { if (A.tone && A.isMuted && !A.isMuted()) A.tone(INS[di].freq, { duration: 0.25 }); } catch (e) { /* ignore */ }
          }, 500 + k * 650);
        });
        setTimeout(() => {
          if (!pad.isConnected) return;
          demoing = false;
          drums.forEach((b) => b.classList.remove("cb__drum--wait"));
          api.say("该您敲了！");
          arm();
        }, 500 + r.seq.length * 650 + 250);
      }
      replay.addEventListener("click", () => { if (!demoing) { step = 0; playDemo(); } });
      function newRound() {
        r = L.makeBeat(undefined, api.shouldRamp(2) ? 4 : 3);
        step = 0;
        api.setPrompt("看一看敲的顺序，再照样敲！", ["👀", "🥁", "👉"]);
        api.speak();
        playDemo();
      }
      newRound();
    },
  });

  // ================= 🧮 心算算术（补） =================

  // 心算加法 — two-digit addition in the head, the wet-market way.
  reg("hlc-math", {
    id: "hl-bigadd", icon: "➕", title: "心算加法",
    skill: "两位数加法",
    start(api) {
      const ROUNDS = 4;
      let round = 0, r = null;
      const line = api.el("div", { class: "hl-bigline hl-mathline" });
      const chips = api.el("div", { class: "choices choices--3 hl-choices" });
      api.stage.append(line, chips);
      function newRound() {
        r = L.makeBigAdd(undefined, api.shouldRamp(2));
        api.setPrompt("心算一下等于几？", ["➕", "🧠", "👉"]);
        api.speak(); api.say(r.a + "加" + r.b + "等于几？");
        line.textContent = r.a + " + " + r.b + " = ？";
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--num hl-numchip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: String(ch.n) },
          }, [String(ch.n)]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            line.textContent = r.a + " + " + r.b + " = " + r.sum;
            line.classList.remove("pop"); void line.offsetWidth; line.classList.add("pop");
            api.say(r.a + "加" + r.b + "等于" + r.sum + "！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "心算又快又准！" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 该填几 — the missing addend (4 + ？ = 9).
  reg("hlc-math", {
    id: "hl-missing", icon: "❓", title: "该填几",
    skill: "凑数心算",
    start(api) {
      const ROUNDS = 4;
      let round = 0, r = null;
      const line = api.el("div", { class: "hl-bigline hl-mathline" });
      const chips = api.el("div", { class: "choices choices--3 hl-choices" });
      api.stage.append(line, chips);
      function newRound() {
        r = L.makeMissingAddend(undefined, { max: api.shouldRamp(2) ? 20 : 9 });
        api.setPrompt("空里该填几？", ["❓", "🧠", "👉"]);
        api.speak(); api.say(r.a + "加几等于" + r.sum + "？");
        line.textContent = r.a + " + ？ = " + r.sum;
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--num hl-numchip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: String(ch.n) },
          }, [String(ch.n)]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            line.textContent = r.a + " + " + r.answer + " = " + r.sum;
            line.classList.remove("pop"); void line.offsetWidth; line.classList.add("pop");
            api.say(r.a + "加" + r.answer + "等于" + r.sum + "，对啦！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "数感真好！" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ================= 🏮 民俗文化 =================

  // 生肖排队 — the twelve-animal cycle with one gap.
  reg("hlc-culture", {
    id: "hl-zodiac-order", icon: "🐲", title: "生肖排队",
    skill: "十二生肖顺序",
    start(api) {
      const ROUNDS = 4;
      let round = 0, lastStart = -1, r = null;
      const names = HL.ZODIAC.map((z) => z.name);
      const row = api.el("div", { class: "hl-run hl-zorun", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3 hl-choices" });
      api.stage.append(row, chips);
      function newRound() {
        r = L.makeOrderTrain(names, undefined, { window: 4, lastStart });
        lastStart = r.start;
        api.setPrompt("生肖排排队——缺了谁？", ["🐲", "🤔", "👉"]);
        api.speak();
        row.innerHTML = "";
        r.items.forEach((name, i) => {
          const cell = api.el("span", { class: "hl-runtile hl-zocell" + (i === r.blankIdx ? " hl-runtile--blank" : "") });
          cell.innerHTML = i === r.blankIdx ? "？" : '<span class="hl-zoemoji">' + zodiacEmoji[name] + '</span><span class="hl-zoname">' + name + "</span>";
          row.appendChild(cell);
        });
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice hl-zochip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.value },
          }, [zodiacEmoji[ch.value] + " " + ch.value]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            const blank = row.querySelector(".hl-runtile--blank");
            if (blank) { blank.innerHTML = '<span class="hl-zoemoji">' + zodiacEmoji[r.answer] + '</span><span class="hl-zoname">' + r.answer + "</span>"; blank.classList.remove("hl-runtile--blank"); blank.classList.add("pop"); }
            api.say("对！是" + r.answer + "！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "十二生肖烂熟于心！" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 节日风俗 — which festival does this custom belong to?
  reg("hlc-culture", {
    id: "hl-festival", icon: "🏮", title: "节日风俗",
    skill: "传统节日",
    start(api) {
      const ROUNDS = 4;
      let round = 0, lastItem = null, r = null, set = null;
      const itemEl = api.el("div", { class: "hl-bigline hl-festitem" });
      const bins = api.el("div", { class: "choices choices--3 hl-choices" });
      api.stage.append(itemEl, bins);
      function newRound() {
        set = api.randItem(HL.FESTIVAL_SETS);
        r = L.makeSort(set, undefined);
        for (let tries = 0; tries < 6 && r.item === lastItem; tries++) r = L.makeSort(set, undefined);
        lastItem = r.item;
        api.setPrompt("「" + r.item + "」是哪个节日的风俗？", ["🏮", "🤔", "👉"]);
        api.speak();
        itemEl.textContent = r.item;
        bins.innerHTML = "";
        r.bins.forEach((bin, i) => {
          const b = api.el("button", {
            class: "choice hl-festbin tap", type: "button",
            dataset: i === r.correctIndex ? { correct: "1" } : {}, aria: { label: bin.label },
          }, [bin.emoji + " " + bin.label]);
          b.addEventListener("click", () => {
            if (i !== r.correctIndex) { api.tryAgain(b); return; }
            api.say(set.bins[r.correctIndex].why);
            round += 1;
            if (round >= ROUNDS) api.win({ say: "节日风俗样样懂！" });
            else { api.roundWin(); newRound(); }
          });
          bins.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 名菜之乡 — match the famous dish to its home town.
  reg("hlc-culture", {
    id: "hl-regional", icon: "🥟", title: "名菜之乡",
    skill: "各地名菜",
    start(api) {
      const ROUNDS = 4;
      let round = 0, lastIdx = -1, r = null;
      const items = HL.REGIONAL.map((p) => ({ q: p.dish, a: p.city }));
      const dishEl = api.el("div", { class: "hl-bigline" });
      const chips = api.el("div", { class: "choices choices--3 hl-choices" });
      api.stage.append(dishEl, chips);
      function newRound() {
        r = L.makePairPick(items, undefined, lastIdx);
        lastIdx = r.idx;
        api.setPrompt("「" + r.item.q + "」是哪里的名菜？", ["🥟", "🗺️", "👉"]);
        api.speak();
        dishEl.textContent = r.item.q;
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice hl-citychip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.a },
          }, [ch.a]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            api.say(r.item.a + r.item.q + "，有名极了！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "各地名菜您都门儿清！" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 四季分明 — which season does it belong to?
  reg("hlc-culture", {
    id: "hl-season", icon: "🍂", title: "四季分明",
    skill: "四季常识",
    start(api) {
      const ROUNDS = 4;
      let round = 0, lastItem = null, r = null;
      const itemEl = api.el("div", { class: "hl-bigline" });
      const bins = api.el("div", { class: "choices choices--4 hl-choices hl-seasonrow" });
      api.stage.append(itemEl, bins);
      function newRound() {
        r = L.makeSeasonItem(HL.HL_SEASONS, undefined, lastItem);
        lastItem = r.item;
        api.setPrompt("「" + r.item + "」属于哪个季节？", ["🍂", "🤔", "👉"]);
        api.speak();
        itemEl.textContent = r.item;
        bins.innerHTML = "";
        HL.HL_SEASONS.forEach((s, i) => {
          const b = api.el("button", {
            class: "choice hl-seasonbin tap", type: "button",
            style: { background: s.tint },
            dataset: i === r.seasonIdx ? { correct: "1" } : {}, aria: { label: s.name },
          }, [s.icon + " " + s.name]);
          b.addEventListener("click", () => {
            if (i !== r.seasonIdx) { api.tryAgain(b); return; }
            api.say(r.item + "是" + r.seasonName + "天的，答对了！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "四季变化都在您心里！" });
            else { api.roundWin(); newRound(); }
          });
          bins.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 脸谱找对 — find the two identical opera masks (visual pairing).
  reg("hlc-culture", {
    id: "hl-mask-pair", icon: "🎭", title: "脸谱找对",
    skill: "脸谱观察",
    start(api) {
      const ROUNDS = 3;
      let round = 0, found = 0, r = null;
      const grid = api.el("div", { class: "hl-grid3 hl-maskgrid" });
      api.stage.append(grid);
      function newRound() {
        r = L.makeTwins(HL.MASK_COLORS, 6, undefined);
        found = 0;
        api.setPrompt("找出两张一模一样的脸谱！", ["🎭", "👀", "✌️"]);
        api.speak();
        grid.innerHTML = "";
        r.cells.forEach((cell) => {
          const b = api.el("button", {
            class: "choice hl-maskbtn tap art-fill", type: "button",
            dataset: cell.correct ? { correct: "1" } : {}, aria: { label: "脸谱" },
          });
          b.innerHTML = maskSVG(cell.emoji);
          b.addEventListener("click", () => {
            if (!cell.correct) { api.tryAgain(b); return; }
            if (b.dataset.done) return;
            b.dataset.done = "1"; delete b.dataset.correct;
            b.classList.add("hl-maskbtn--hit");
            found += 1;
            if (found >= 2) {
              api.say("两张脸谱一模一样！");
              round += 1;
              if (round >= ROUNDS) api.win({ say: "脸谱都逃不过您的眼睛！" });
              else { api.roundWin(); newRound(); }
            }
          });
          grid.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 猜灯谜 — classic folk riddles under a lantern.
  reg("hlc-culture", {
    id: "hl-riddle", icon: "🏮", title: "猜灯谜",
    skill: "谜语",
    start(api) {
      const ROUNDS = 3;
      let round = 0, lastIdx = -1;
      const card = api.el("div", { class: "hl-riddlecard" });
      const chips = api.el("div", { class: "choices choices--3 hl-choices" });
      api.stage.append(card, chips);
      function newRound() {
        let idx = api.pickIndex(HL.RIDDLES.length, lastIdx);
        lastIdx = idx;
        const r = HL.RIDDLES[idx];
        api.setPrompt("猜一猜，是什么？", ["🏮", "🤔", "👉"]);
        api.speak(); api.say(r.q + "猜一猜，是什么？");
        card.textContent = r.q;
        chips.innerHTML = "";
        const choices = api.shuffle([
          { t: r.a, correct: true },
          ...r.wrong.map((w) => ({ t: w, correct: false })),
        ]);
        choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice hl-citychip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: ch.t },
          }, [ch.t]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            card.textContent = r.emoji + " 谜底：" + r.a;
            card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
            api.say("谜底是" + r.a + "！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "灯谜大王就是您！" });
            else { api.roundWin(); setTimeout(() => { if (card.isConnected) newRound(); }, 900); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ================= 👁️ 眼明手快 =================

  // 点灯笼 — light every lantern hiding among balloons and lamps.
  reg("hlc-eyes", {
    id: "hl-lantern", icon: "🏮", title: "点灯笼",
    skill: "目标搜索",
    start(api) {
      const ROUNDS = 3;
      let round = 0, need = 0;
      const grid = api.el("div", { class: "hl-grid3" });
      api.stage.append(grid);
      function newRound() {
        const K = api.shouldRamp(2) ? 4 : 3;
        const distract = HL.LANTERN_POOL.filter((e) => e !== "🏮");
        const cells = api.shuffle([
          ...Array.from({ length: K }, () => ({ emoji: "🏮", correct: true })),
          ...Array.from({ length: 9 - K }, () => ({ emoji: api.randItem(distract), correct: false })),
        ]);
        need = K;
        api.setPrompt("把每个灯笼都点亮！", ["🏮", "👀", "👆"]);
        api.speak();
        grid.innerHTML = "";
        cells.forEach((cell) => {
          const b = api.el("button", {
            class: "choice hl-spot tap", type: "button",
            dataset: cell.correct ? { correct: "1" } : {}, aria: { label: cell.correct ? "灯笼" : "不是灯笼" },
          }, [cell.emoji]);
          b.addEventListener("click", () => {
            if (!cell.correct) { api.tryAgain(b); return; }
            if (b.dataset.done) return;
            b.dataset.done = "1"; delete b.dataset.correct;
            b.classList.add("hl-spot--lit");
            api.say("亮了！");
            need -= 1;
            if (need <= 0) {
              round += 1;
              if (round >= ROUNDS) api.win({ say: "灯笼全点亮了，真喜庆！" });
              else { api.roundWin(); newRound(); }
            }
          });
          grid.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 数金鱼 — how many of the target swim in the pond?
  reg("hlc-eyes", {
    id: "hl-koi", icon: "🐟", title: "数金鱼",
    skill: "数数眼力",
    start(api) {
      const ROUNDS = 3;
      let round = 0, r = null;
      const nameOf = {}, mwOf = {};
      HL.KOI_POOL.forEach((k) => { nameOf[k.emoji] = k.name; mwOf[k.emoji] = k.mw || "个"; });
      const pond = api.el("div", { class: "hl-grid4 hl-pond", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3 hl-choices" });
      api.stage.append(pond, chips);
      function newRound() {
        r = L.makeFindCount(HL.KOI_POOL.map((k) => k.emoji), 12, undefined);
        api.setPrompt("池塘里有几" + mwOf[r.target] + nameOf[r.target] + "？", ["🐟", "🧮", "🤔"]);
        api.speak();
        pond.innerHTML = "";
        r.cells.forEach((emoji) => {
          pond.appendChild(api.el("span", { class: "hl-pondcell" + (emoji === r.target ? " hl-pondcell--target" : "") }, [emoji]));
        });
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice choice--num hl-numchip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: String(ch.n) },
          }, [String(ch.n)]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            pond.classList.add("hl-pond--glow");
            setTimeout(() => pond.classList.remove("hl-pond--glow"), 700);
            api.say(r.count + mwOf[r.target] + nameOf[r.target] + "，数得真准！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "数得又准又快！" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 找熊猫 — find the single hidden target in a bustling crowd.
  reg("hlc-eyes", {
    id: "hl-panda", icon: "🐼", title: "找一找",
    skill: "人群搜索",
    start(api) {
      const ROUNDS = 3;
      let round = 0, r = null;
      const targetEl = api.el("div", { class: "hl-target hl-spottarget" });
      const grid = api.el("div", { class: "hl-grid4" });
      api.stage.append(targetEl, grid);
      function newRound() {
        r = L.makeFindHero(HL.SPOT_POOL, 12, 1, undefined);
        api.setPrompt("在人群里找到它！", ["👀", "🔍", "☝️"]);
        api.speak();
        targetEl.textContent = "找：" + r.target;
        grid.innerHTML = "";
        r.cells.forEach((cell) => {
          const b = api.el("button", {
            class: "choice hl-spot tap", type: "button",
            dataset: cell.correct ? { correct: "1" } : {}, aria: { label: cell.correct ? "目标" : "路人" },
          }, [cell.emoji]);
          b.addEventListener("click", () => {
            if (!cell.correct) { api.tryAgain(b); return; }
            b.classList.add("pop");
            api.say("找到了！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "藏得再深也逃不过您！" });
            else { api.roundWin(); newRound(); }
          });
          grid.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 按提示找 — two clues at once: the right COLOR of the right SHAPE.
  reg("hlc-eyes", {
    id: "hl-hunt-two", icon: "🔍", title: "按提示找",
    skill: "双重条件搜索",
    start(api) {
      const ROUNDS = 3;
      let round = 0, r = null;
      const clueEl = api.el("div", { class: "hl-bigline hl-clue" });
      const grid = api.el("div", { class: "hl-grid3" });
      api.stage.append(clueEl, grid);
      function shapeEl(cell) {
        const s = api.el("span", { class: "hl-shape", aria: { hidden: "true" } });
        s.style.background = cell.color.hex;
        if (cell.shape === "圆形") s.style.borderRadius = "50%";
        else if (cell.shape === "三角") { s.style.clipPath = "polygon(50% 0, 0 100%, 100% 100%)"; s.style.webkitClipPath = "polygon(50% 0, 0 100%, 100% 100%)"; }
        else s.style.borderRadius = "12%";
        return s;
      }
      function newRound() {
        r = L.makeConjunctionHunt(HL.HL_HUNT_COLORS, HL.HL_HUNT_SHAPES, 9, undefined);
        api.setPrompt("找到" + r.color.key + "的" + r.shape + "！", ["🔍", "🎨", "👉"]);
        api.speak();
        clueEl.textContent = r.color.key + " + " + r.shape;
        grid.innerHTML = "";
        r.cells.forEach((cell) => {
          const b = api.el("button", {
            class: "choice hl-shapebtn tap", type: "button",
            dataset: cell.correct ? { correct: "1" } : {}, aria: { label: cell.color.key + cell.shape },
          }, [shapeEl(cell)]);
          b.addEventListener("click", () => {
            if (!cell.correct) { api.tryAgain(b); return; }
            b.classList.add("pop");
            api.say(r.color.key + "的" + r.shape + "，找到了！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "提示一说您就找到！" });
            else { api.roundWin(); newRound(); }
          });
          grid.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 两幅找不同 — compare the top row with the bottom row; tap what changed.
  reg("hlc-eyes", {
    id: "hl-diff", icon: "🖼️", title: "两幅找不同",
    skill: "找不同",
    start(api) {
      const ROUNDS = 3;
      let round = 0, r = null;
      const topRow = api.el("div", { class: "hl-diffrow hl-diffrow--ref", aria: { hidden: "true" } });
      const vs = api.el("div", { class: "hl-diffvs", aria: { hidden: "true" }, text: "▲ 上图 · 下图哪里不同？ ▼" });
      const botRow = api.el("div", { class: "hl-diffrow" });
      api.stage.append(topRow, vs, botRow);
      function newRound() {
        r = L.makeSpotDifference(HL.SPOT_POOL, api.shouldRamp(2) ? 5 : 4, undefined);
        api.setPrompt("两幅图哪里不一样？点下面那一个！", ["🖼️", "👀", "☝️"]);
        api.speak();
        topRow.innerHTML = "";
        r.before.forEach((emoji) => topRow.appendChild(api.el("span", { class: "hl-diffcell" }, [emoji])));
        botRow.innerHTML = "";
        r.after.forEach((emoji, i) => {
          const b = api.el("button", {
            class: "choice hl-diffcell hl-diffbtn tap", type: "button",
            dataset: i === r.diffIndex ? { correct: "1" } : {}, aria: { label: emoji },
          }, [emoji]);
          b.addEventListener("click", () => {
            if (i !== r.diffIndex) { api.tryAgain(b); return; }
            b.classList.add("pop");
            api.say("对！" + r.before[r.diffIndex] + "变成了" + r.after[r.diffIndex] + "！");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "火眼金睛，名不虚传！" });
            else { api.roundWin(); newRound(); }
          });
          botRow.appendChild(b);
        });
      }
      newRound();
    },
  });

  // ================= 🍵 静心时光 =================

  // 深呼吸 — the lotus grows as you breathe in, settles as you breathe out.
  reg("hlc-calm", {
    id: "hl-breathe", icon: "🪷", title: "深呼吸",
    skill: "静心放松",
    start(api) {
      const BREATHS = 4;
      let n = 0;
      const lotus = api.el("button", {
        class: "breathe__star hl-lotus tap", type: "button",
        dataset: { correct: "1" }, aria: { label: "深呼吸" }, text: "🪷",
      });
      const label = api.el("div", { class: "breathe__label hl-calmlabel" }, ["点一点荷花，跟着呼吸"]);
      api.stage.append(lotus, label);
      api.setPrompt("点荷花，吸气……呼气……", ["🪷", "🌬️", "😌"]);
      api.speak();
      lotus.addEventListener("click", () => {
        if (n >= BREATHS) return;
        n += 1;
        lotus.classList.add("breathe--big");
        setTimeout(() => lotus.classList.remove("breathe--big"), 1600);
        label.textContent = HL.BREATHE.in + " " + HL.BREATHE.out + "（" + n + "）";
        api.say(HL.BREATHE.in);
        setTimeout(() => { if (lotus.isConnected && n <= BREATHS) api.say(HL.BREATHE.out); }, 1700);
        if (n >= BREATHS) {
          delete lotus.dataset.correct;
          api.win({ say: HL.BREATHE.done });
        }
      });
    },
  });

  // 古筝五音 — the pentatonic strings (宫商角徵羽); a musical toy that still
  // earns its sticker after a short tune (click-count, never a timer).
  reg("hlc-calm", {
    id: "hl-guzheng", icon: "🎶", title: "古筝五音",
    skill: "五声音阶",
    start(api) {
      const pad = api.el("div", { class: "choices hl-strings" });
      api.stage.append(pad);
      api.setPrompt("拨一拨琴弦，听五声音阶！", ["🎶", "👆", "😊"]);
      api.speak();
      const note = api.el("div", { class: "music__hint" }, ["🔈 记得打开声音，才能听到琴声哦！"]);
      api.stage.append(note);
      pad.addEventListener("pointerdown", function warm() { if (A && A.unlock) A.unlock(); pad.removeEventListener("pointerdown", warm); }, { once: true });
      let notes = 0, won = false;
      HL.PENTATONIC.forEach((p) => {
        const bar = api.el("button", {
          class: "choice hl-string tap", type: "button",
          dataset: { toy: "1" }, aria: { label: p.name },
        }, [p.name]);
        bar.addEventListener("click", () => {
          api.tickPlay();
          bar.classList.remove("music__hit"); void bar.offsetWidth; bar.classList.add("music__hit");
          if (A && A.tone) A.tone(p.freq);
          notes += 1;
          if (notes === 6 && !won) { won = true; api.win({ say: "您弹了一支小曲，真好听！" }); }
        });
        pad.appendChild(bar);
      });
    },
  });

  // 月亮圆缺 — the waxing moon with one phase missing.
  reg("hlc-calm", {
    id: "hl-moon", icon: "🌕", title: "月亮圆缺",
    skill: "月相变化",
    start(api) {
      const ROUNDS = 3;
      let round = 0, lastStart = -1, r = null;
      const row = api.el("div", { class: "hl-run hl-moonrow", aria: { hidden: "true" } });
      const chips = api.el("div", { class: "choices choices--3 hl-choices" });
      api.stage.append(row, chips);
      function newRound() {
        r = L.makeOrderTrain(HL.MOON, undefined, { window: 4, lastStart });
        lastStart = r.start;
        api.setPrompt("月亮慢慢变圆——缺的是哪个？", ["🌙", "🤔", "👉"]);
        api.speak();
        row.innerHTML = "";
        r.items.forEach((m, i) => {
          row.appendChild(api.el("span", { class: "hl-runtile hl-mooncell" + (i === r.blankIdx ? " hl-runtile--blank" : "") }, [i === r.blankIdx ? "？" : m]));
        });
        chips.innerHTML = "";
        r.choices.forEach((ch) => {
          const b = api.el("button", {
            class: "choice hl-moonchip tap", type: "button",
            dataset: ch.correct ? { correct: "1" } : {}, aria: { label: "月相" },
          }, [ch.value]);
          b.addEventListener("click", () => {
            if (!ch.correct) { api.tryAgain(b); return; }
            const blank = row.querySelector(".hl-runtile--blank");
            if (blank) { blank.textContent = r.answer; blank.classList.remove("hl-runtile--blank"); blank.classList.add("pop"); }
            api.say("对啦！月亮就是这样慢慢变圆的。");
            round += 1;
            if (round >= ROUNDS) api.win({ say: "月有阴晴圆缺，您全知道！" });
            else { api.roundWin(); newRound(); }
          });
          chips.appendChild(b);
        });
      }
      newRound();
    },
  });

  // 描福字 — trace the dots over a big watermark 福, in order.
  reg("hlc-calm", {
    id: "hl-fu-trace", icon: "🖌️", title: "描福字",
    skill: "手眼描画",
    start(api) {
      let step = 0;
      const box = api.el("div", { class: "hl-fubox" });
      const mark = api.el("span", { class: "hl-fumark", aria: { hidden: "true" }, text: "福" });
      box.appendChild(mark);
      const dots = HL.FU_PATH.map((p, i) => {
        const d = api.el("button", {
          class: "hl-fudot tap", type: "button",
          style: { left: p.x + "%", top: p.y + "%" },
          dataset: i === 0 ? { correct: "1" } : {}, aria: { label: "第" + (i + 1) + "笔" },
        }, [String(i + 1)]);
        d.addEventListener("click", () => {
          if (d.dataset.done) return;
          if (i !== step) { api.tryAgain(d); return; }
          d.dataset.done = "1"; delete d.dataset.correct;
          d.classList.add("hl-fudot--done");
          api.say(String(i + 1));
          step += 1;
          if (step < dots.length) dots[step].dataset.correct = "1";
          else {
            mark.classList.add("hl-fumark--done");
            api.win({ say: "福字描好了，福气到家！" });
          }
        });
        box.appendChild(d);
        return d;
      });
      api.stage.append(box);
      api.setPrompt("跟着数字，一笔一笔描个福字！", ["🖌️", "🧧", "☝️"]);
      api.speak();
    },
  });

  // 泡茶 — tap the four steps of a good pot of tea in order.
  reg("hlc-calm", {
    id: "hl-tea", icon: "🍵", title: "泡茶",
    skill: "生活顺序",
    start(api) {
      const r = L.makeStoryOrder([{ name: "泡茶", steps: HL.TEA_STEPS }], undefined);
      const iconOf = {};
      HL.TEA_STEPS.forEach((s, i) => { iconOf[s] = HL.TEA_EMOJI[i]; });
      let step = 0;
      const doneRow = api.el("div", { class: "hl-tearow", aria: { hidden: "true" } });
      const tray = api.el("div", { class: "choices choices--4 hl-choices hl-teatray" });
      api.stage.append(doneRow, tray);
      api.setPrompt("泡一壶好茶——先做什么，后做什么？", ["🍵", "🤔", "☝️"]);
      api.speak();
      function flagNext() {
        tray.querySelectorAll(".hl-teastep").forEach((x) => {
          if (!x.dataset.done && Number(x.dataset.rank) === step) x.dataset.correct = "1";
          else delete x.dataset.correct;
        });
      }
      r.tiles.forEach((t) => {
        const b = api.el("button", {
          class: "choice hl-teastep tap", type: "button",
          dataset: { rank: String(t.rank) }, aria: { label: t.emoji },
        }, [iconOf[t.emoji] + " " + t.emoji]);
        b.addEventListener("click", () => {
          if (b.dataset.done) return;
          if (Number(b.dataset.rank) !== step) { api.tryAgain(b); return; }
          b.dataset.done = "1"; delete b.dataset.correct;
          b.classList.add("hl-teastep--done");
          doneRow.appendChild(api.el("span", { class: "hl-teadone pop" }, [iconOf[t.emoji]]));
          api.say(t.emoji);
          step += 1;
          if (step >= r.order.length) api.win({ say: "一杯好茶泡好了，请慢用！" });
          else flagNext();
        });
        tray.appendChild(b);
      });
      flagNext();
    },
  });
})();
