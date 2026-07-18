// 华丽 correctness tests — the GROUND TRUTH for Grandma Huali's world, restated
// so no culturally-loaded answer (poem lines, idioms, zodiac order, measure
// words, festivals, regional dishes, seasons…) can ever silently go wrong.
// This is a teaching/companion tool for a fluent native reader: a wrong fact is
// a shipped bug. Update BOTH the content and this truth table, deliberately.

const test = require("node:test");
const assert = require("node:assert");
const HL = require("../scripts/hl-content.js");

const isCJK = (s) => /[一-鿿]/.test(s);

// ---------- The gate ----------
test("gate: only the exact name 华丽 is the answer, all strings Chinese", () => {
  assert.equal(HL.GATE.answer, "华丽");
  for (const k of ["question", "placeholder", "wrong", "ok", "cancel"]) {
    assert.ok(HL.GATE[k] && isCJK(HL.GATE[k]), `GATE.${k} must be Chinese text`);
  }
  assert.equal(HL.GATE.question, "你叫什么名字？");
});

test("framework voice lines are Chinese and non-empty", () => {
  assert.ok(HL.PRAISE.length >= 3 && HL.PRAISE.every(isCJK));
  assert.ok(HL.TRYAGAIN.length >= 2 && HL.TRYAGAIN.every(isCJK));
  assert.ok(isCJK(HL.AGAIN_LABEL));
  assert.ok(isCJK(HL.GREETING) && HL.GREETING.includes("华丽"));
});

// ---------- Categories / navigation ----------
test("7 categories with unique hlc- ids, Chinese titles, valid colors", () => {
  assert.equal(HL.CATEGORIES.length, 7);
  const ids = HL.CATEGORIES.map((c) => c.id);
  assert.equal(new Set(ids).size, 7, "category ids unique");
  for (const c of HL.CATEGORIES) {
    assert.match(c.id, /^hlc-/, `category id ${c.id} must be hlc- prefixed`);
    assert.ok(c.icon && isCJK(c.title), `category ${c.id} needs icon + Chinese title`);
    assert.match(c.color, /^#[0-9a-fA-F]{6}$/);
  }
  assert.ok(HL.STICKER_POOL.length >= 20, "sticker pool should be roomy");
  assert.equal(new Set(HL.STICKER_POOL).size, HL.STICKER_POOL.length, "stickers unique");
});

// ---------- 🀄 Tiles ----------
test("tile numbers/suits: 9 unique numerals x 3 unique suits = 27 distinct tiles", () => {
  assert.deepEqual(HL.TILE_NUMBERS, ["一", "二", "三", "四", "五", "六", "七", "八", "九"]);
  assert.deepEqual(HL.TILE_SUITS, ["万", "筒", "条"]);
  const all = [];
  for (const s of HL.TILE_SUITS) for (const n of HL.TILE_NUMBERS) all.push(n + s);
  assert.equal(new Set(all).size, 27);
});

// ---------- 📜 Tang poems: the canonical texts, verbatim ----------
test("POEMS restate the real Tang classics exactly", () => {
  const TRUTH = {
    "静夜思": { author: "李白", lines: ["床前明月光", "疑是地上霜", "举头望明月", "低头思故乡"] },
    "春晓": { author: "孟浩然", lines: ["春眠不觉晓", "处处闻啼鸟", "夜来风雨声", "花落知多少"] },
    "悯农": { author: "李绅", lines: ["锄禾日当午", "汗滴禾下土", "谁知盘中餐", "粒粒皆辛苦"] },
    "登鹳雀楼": { author: "王之涣", lines: ["白日依山尽", "黄河入海流", "欲穷千里目", "更上一层楼"] },
    "咏鹅": { author: "骆宾王", lines: ["鹅鹅鹅", "曲项向天歌", "白毛浮绿水", "红掌拨清波"] },
  };
  assert.equal(HL.POEMS.length, Object.keys(TRUTH).length);
  for (const p of HL.POEMS) {
    const t = TRUTH[p.title];
    assert.ok(t, `unexpected poem ${p.title}`);
    assert.equal(p.author, t.author, `${p.title} author`);
    assert.deepEqual(p.lines, t.lines, `${p.title} lines must be the canonical text`);
  }
});

// ---------- 📜 Idioms ----------
test("IDIOMS are real 4-character idioms; distractor chars never fit", () => {
  // The canonical set (update deliberately if content changes).
  const REAL = ["画蛇添足", "守株待兔", "井底之蛙", "亡羊补牢", "对牛弹琴", "马到成功", "一箭双雕", "拔苗助长", "半途而废", "雪中送炭"];
  assert.deepEqual(HL.IDIOMS.map((i) => i.text), REAL);
  for (const i of HL.IDIOMS) {
    assert.equal(i.text.length, 4, `${i.text} must be 4 characters`);
    assert.ok(i.blank >= 0 && i.blank < 4);
    const answer = i.text[i.blank];
    assert.equal(i.wrong.length, 2, `${i.text} needs 2 distractors`);
    for (const w of i.wrong) {
      assert.notEqual(w, answer, `${i.text}: distractor ${w} equals the answer`);
      assert.equal(w.length, 1, `${i.text}: distractor ${w} must be one character`);
      // Swapping in the distractor must NOT rebuild one of our real idioms.
      const forged = i.text.slice(0, i.blank) + w + i.text.slice(i.blank + 1);
      assert.ok(!REAL.includes(forged), `${forged} would also be a real idiom`);
    }
  }
});

// ---------- 📜 Measure words: standard usage, one right answer each ----------
test("MEASURE_WORDS restate the standard 量词 truth table", () => {
  const TRUTH = { 马: "匹", 牛: "头", 鱼: "条", 鸟: "只", 书: "本", 伞: "把", 车: "辆", 花: "朵", 衣服: "件", 鞋: "双" };
  assert.equal(HL.MEASURE_WORDS.length, Object.keys(TRUTH).length);
  for (const m of HL.MEASURE_WORDS) {
    assert.equal(m.mw, TRUTH[m.noun], `一${TRUTH[m.noun]}${m.noun} is the standard pairing`);
    assert.ok(m.emoji, `${m.noun} needs an emoji`);
  }
  const nouns = HL.MEASURE_WORDS.map((m) => m.noun);
  assert.equal(new Set(nouns).size, nouns.length, "nouns unique");
  // 鞋 legitimately takes 只 for a single shoe, so it must declare alsoOk:["只"]
  // (the game filters alsoOk out of the distractors) AND show a PAIR so 双 reads
  // right — otherwise "一只鞋" is a true answer the game would mark wrong.
  const shoe = HL.MEASURE_WORDS.find((m) => m.noun === "鞋");
  assert.ok((shoe.alsoOk || []).includes("只"), "鞋 must list 只 as an also-valid 量词");
  assert.ok(shoe.emoji.length > 2, "鞋 should be shown as a pair of shoes so 双 is unambiguous");
});

// ---------- 📜 Antonyms ----------
test("ANTONYMS restate the classic opposite pairs", () => {
  const TRUTH = [["大", "小"], ["上", "下"], ["左", "右"], ["多", "少"], ["高", "矮"], ["长", "短"], ["快", "慢"], ["冷", "热"]];
  assert.deepEqual(HL.ANTONYMS.map((p) => [p.a, p.b]), TRUTH);
  const chars = HL.ANTONYMS.flatMap((p) => [p.a, p.b]);
  assert.equal(new Set(chars).size, chars.length, "each character appears in exactly one pair (so a distractor can never also be a right answer)");
});

// ---------- 📜 Character hunts ----------
test("HUNT_CHARS and CHAR_PAIRS are lookalike-safe", () => {
  assert.ok(HL.HUNT_CHARS.length >= 4);
  assert.equal(new Set(HL.HUNT_CHARS).size, HL.HUNT_CHARS.length);
  for (const p of HL.CHAR_PAIRS) {
    assert.notEqual(p.a, p.b, "a lookalike pair must be two DIFFERENT characters");
    assert.equal(p.a.length, 1); assert.equal(p.b.length, 1);
  }
});

// ---------- 🧠 Memory pools ----------
test("dishes / sequences / tea steps are well-formed", () => {
  assert.ok(HL.DISHES.length >= 8);
  assert.equal(new Set(HL.DISHES).size, HL.DISHES.length, "dishes unique (menu game needs distinct cells)");
  for (const s of HL.SEQUENCES) {
    assert.ok(s.steps.length >= 3, `${s.name} needs >= 3 steps`);
    assert.equal(new Set(s.steps).size, s.steps.length, `${s.name} steps unique`);
  }
  assert.equal(HL.TEA_STEPS.length, HL.TEA_EMOJI.length, "each tea step has its icon");
  assert.deepEqual(HL.TEA_STEPS, ["烧水", "放茶叶", "倒热水", "慢慢品"], "the tea ritual order is the truth the game teaches");
});

// ---------- 🧮 Market ----------
test("MARKET items carry honest small prices", () => {
  assert.ok(HL.MARKET.length >= 4);
  const names = HL.MARKET.map((m) => m.name);
  assert.equal(new Set(names).size, names.length);
  for (const m of HL.MARKET) {
    assert.ok(Number.isInteger(m.price) && m.price >= 1 && m.price <= 9, `${m.name} price 1..9 for mental math`);
    assert.ok(m.emoji && isCJK(m.name));
  }
});

// ---------- 🏮 Zodiac: THE canonical cycle ----------
test("ZODIAC is the canonical 12-animal cycle, in order", () => {
  assert.deepEqual(
    HL.ZODIAC.map((z) => z.name),
    ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"],
    "生肖 order is fixed truth — the order game teaches it"
  );
  const emojis = HL.ZODIAC.map((z) => z.emoji);
  assert.equal(new Set(emojis).size, 12, "zodiac emojis unique (concentration pairs depend on it)");
});

// ---------- 🏮 Festivals ----------
test("FESTIVAL_SETS: real festival↔custom pairings, no item in two bins", () => {
  const KNOWN = new Set(["春节", "端午节", "中秋节", "元宵节", "重阳节", "清明节", "七夕节"]);
  for (const set of HL.FESTIVAL_SETS) {
    assert.ok(set.bins.length >= 3, `${set.name} needs >= 3 bins`);
    const all = [];
    for (const b of set.bins) {
      assert.ok(KNOWN.has(b.label), `${b.label} must be a real festival`);
      assert.ok(b.why && b.why.includes(b.label), `${b.label} why-line should name the festival`);
      assert.ok(b.items.length >= 3);
      all.push(...b.items);
    }
    assert.equal(new Set(all).size, all.length, `${set.name}: an item must belong to exactly ONE bin (otherwise a "wrong" tap could be right)`);
  }
  // Spot-check the load-bearing pairings.
  const bins = HL.FESTIVAL_SETS.flatMap((s) => s.bins);
  const find = (item) => bins.filter((b) => b.items.includes(item)).map((b) => b.label);
  assert.deepEqual(find("粽子"), ["端午节"], "zongzi belongs to Dragon Boat");
  assert.deepEqual(find("月饼"), ["中秋节"], "mooncake belongs to Mid-Autumn");
  assert.deepEqual(find("汤圆"), ["元宵节"], "tangyuan belongs to Lantern Festival");
  assert.deepEqual(find("登高"), ["重阳节"], "climbing belongs to Double Ninth");
});

// ---------- 🏮 Regional dishes ----------
test("REGIONAL restates the famous dish↔place truth", () => {
  const TRUTH = { 烤鸭: "北京", 麻辣火锅: "四川", 点心: "广东", 拉面: "兰州", 小笼包: "上海", 刀削面: "山西" };
  assert.equal(HL.REGIONAL.length, Object.keys(TRUTH).length);
  for (const r of HL.REGIONAL) assert.equal(r.city, TRUTH[r.dish], `${r.dish} → ${TRUTH[r.dish]}`);
  const cities = HL.REGIONAL.map((r) => r.city);
  assert.equal(new Set(cities).size, cities.length, "cities unique so a distractor city is never also correct");
});

// ---------- 🏮 Seasons ----------
test("HL_SEASONS: four seasons, each item belongs to exactly one", () => {
  assert.deepEqual(HL.HL_SEASONS.map((s) => s.name), ["春", "夏", "秋", "冬"]);
  const all = HL.HL_SEASONS.flatMap((s) => s.items);
  assert.equal(new Set(all).size, all.length, "no item may sit in two seasons");
  const seasonOf = {};
  HL.HL_SEASONS.forEach((s) => s.items.forEach((i) => { seasonOf[i] = s.name; }));
  // The load-bearing associations, restated.
  assert.equal(seasonOf["桃花"], "春"); assert.equal(seasonOf["燕子"], "春");
  assert.equal(seasonOf["荷花"], "夏"); assert.equal(seasonOf["西瓜"], "夏");
  assert.equal(seasonOf["菊花"], "秋"); assert.equal(seasonOf["大雁"], "秋");
  assert.equal(seasonOf["雪花"], "冬"); assert.equal(seasonOf["腊梅"], "冬");
});

// ---------- 🏮 Riddles ----------
test("RIDDLES: canonical folk answers; distractors never equal the answer", () => {
  const TRUTH = { 花生: "🥜", 雨: "🌧️", 手指: "🖐️", 月亮: "🌙", 西瓜: "🍉", 荷花: "🪷" };
  assert.equal(HL.RIDDLES.length, Object.keys(TRUTH).length);
  for (const r of HL.RIDDLES) {
    assert.ok(TRUTH[r.a], `unexpected riddle answer ${r.a}`);
    assert.equal(r.emoji, TRUTH[r.a]);
    assert.ok(isCJK(r.q) && r.q.length >= 8, "a riddle needs its full verse");
    assert.equal(r.wrong.length, 2);
    for (const w of r.wrong) assert.notEqual(w, r.a);
  }
});

// ---------- 👁️ Eye-game pools ----------
test("eye-game pools are unique and big enough for their logic functions", () => {
  assert.ok(HL.LANTERN_POOL.includes("🏮") && HL.LANTERN_POOL.length >= 3);
  assert.equal(new Set(HL.LANTERN_POOL).size, HL.LANTERN_POOL.length);
  // Only 🏮 may be a real lantern — every other pool member is a wrong tap, so a
  // lantern-like distractor (the old 🪔 oil lamp) would be unfair.
  assert.deepEqual(HL.LANTERN_POOL.filter((e) => "🏮🪔🎏".includes(e)), ["🏮"],
    "no lamp-like distractor may share the 灯笼 board with 🏮");
  const koi = HL.KOI_POOL.map((k) => k.emoji);
  assert.ok(koi.length >= 3, "makeFindCount needs >= 3");
  assert.equal(new Set(koi).size, koi.length);
  // Each pond creature carries its correct 量词 (the count game speaks 几X…), and
  // it must be the standard one — 金鱼→条 (never 个), consistent with 鱼→条 above.
  const KOI_MW = { 金鱼: "条", 鸭子: "只", 乌龟: "只", 荷花: "朵" };
  for (const k of HL.KOI_POOL) assert.equal(k.mw, KOI_MW[k.name], `${k.name} needs its standard 量词 一${KOI_MW[k.name]}`);
  for (const k of HL.KOI_POOL) assert.ok(isCJK(k.name));
  assert.ok(HL.SPOT_POOL.length >= 7, "makeSpotDifference(count 5) needs pool > count; makeTwins/FindHero need room");
  assert.equal(new Set(HL.SPOT_POOL).size, HL.SPOT_POOL.length);
  assert.equal(HL.HL_HUNT_COLORS.length, 3);
  assert.equal(new Set(HL.HL_HUNT_COLORS.map((c) => c.key)).size, 3);
  for (const c of HL.HL_HUNT_COLORS) assert.match(c.hex, /^#[0-9a-fA-F]{6}$/);
  assert.equal(new Set(HL.HL_HUNT_SHAPES).size, HL.HL_HUNT_SHAPES.length);
  assert.ok(HL.MASK_COLORS.length >= 6, "the mask twin grid shows 6 cells (needs >= 6 distinct colors)");
  assert.equal(new Set(HL.MASK_COLORS).size, HL.MASK_COLORS.length);
});

// ---------- 🍵 Calm ----------
test("PENTATONIC is 宫商角徵羽 with ascending frequencies", () => {
  assert.deepEqual(HL.PENTATONIC.map((p) => p.name), ["宫", "商", "角", "徵", "羽"]);
  for (let i = 1; i < HL.PENTATONIC.length; i++) {
    assert.ok(HL.PENTATONIC[i].freq > HL.PENTATONIC[i - 1].freq, "scale must ascend");
  }
});

test("MOON is the waxing sequence new → full", () => {
  assert.deepEqual(HL.MOON, ["🌑", "🌒", "🌓", "🌔", "🌕"]);
});

test("ECHO_INSTRUMENTS: three distinct Chinese percussion voices", () => {
  assert.equal(HL.ECHO_INSTRUMENTS.length, 3, "the echo game's drums array maps 1:1 to makeBeat's 3 voices");
  const names = HL.ECHO_INSTRUMENTS.map((i) => i.name);
  assert.equal(new Set(names).size, 3);
  const freqs = HL.ECHO_INSTRUMENTS.map((i) => i.freq);
  assert.equal(new Set(freqs).size, 3, "each instrument needs its own pitch");
});

test("BREATHE lines exist and are Chinese", () => {
  for (const k of ["in", "out", "done"]) assert.ok(isCJK(HL.BREATHE[k]), `BREATHE.${k}`);
});

// ---------- 🖌️ 福-trace geometry: the dots must PASS the mobile tap audit ----------
test("FU_PATH dots stay tappable: no overlap and >=14px gaps at 320px-wide layout", () => {
  // Mirror of tests/mobile.test.js's audit, applied to the trace layout the CSS
  // produces at its tightest: a 292px-wide, 430px-tall box with 76px dots
  // centred on each point. If a future path edit crowds two dots, this fails
  // BEFORE the browser suite does.
  const W = 292, H = 430, SIZE = 76, MIN_GAP = 14;
  const boxes = HL.FU_PATH.map((p) => {
    assert.ok(p.x >= 8 && p.x <= 92 && p.y >= 8 && p.y <= 92, "dot centres must stay inside the box");
    const cx = (p.x / 100) * W, cy = (p.y / 100) * H;
    return { x: cx - SIZE / 2, y: cy - SIZE / 2, r: cx + SIZE / 2, b: cy + SIZE / 2 };
  });
  assert.ok(boxes.length >= 5, "a trace needs a real path");
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], c = boxes[j];
      const ox = Math.min(a.r, c.r) - Math.max(a.x, c.x);
      const oy = Math.min(a.b, c.b) - Math.max(a.y, c.y);
      assert.ok(!(ox > 1 && oy > 1), `dots ${i + 1} and ${j + 1} overlap`);
      if (ox > 4) assert.ok(Math.max(a.y, c.y) - Math.min(a.b, c.b) >= MIN_GAP, `dots ${i + 1}/${j + 1} vertically too close`);
      else if (oy > 4) assert.ok(Math.max(a.x, c.x) - Math.min(a.r, c.r) >= MIN_GAP, `dots ${i + 1}/${j + 1} horizontally too close`);
    }
  }
});
