// 华丽的游戏 — ALL editable content for Grandma Huali's hidden world. Every
// visible string is simplified Chinese (she reads fluently — text is first-class
// here, the opposite of Josh's non-reader law). Cultural facts (poems, idioms,
// zodiac order, festivals, measure words…) are restated as ground truth in
// tests/hl-content.test.js so no answer can ever silently go wrong.
// Works in the browser (window.HualiContent) AND Node tests (module.exports).

(function (global) {
  const CONTENT = {
    TITLE: "华丽的游戏",
    GREETING: "华丽，你好！欢迎回来！",

    // ---- The name gate (the door into her world) ----
    GATE: {
      question: "你叫什么名字？",
      placeholder: "请输入名字",
      answer: "华丽",
      wrong: "不对哦，再试一次。",
      ok: "确定",
      cancel: "取消",
    },

    // ---- Framework voice lines for zh games (mirrors PRAISE/TRYAGAIN) ----
    PRAISE: ["太棒了！", "真厉害！", "好极了！", "答对了！", "您真棒！"],
    TRYAGAIN: ["再试试。", "再想一想。", "差一点，再来。"],
    AGAIN_LABEL: "再来 🔁",

    // ---- Categories (7, mirrors Josh's launcher) ----
    CATEGORIES: [
      { id: "hlc-tiles", icon: "🀄", title: "麻将牌艺", color: "#c62828" },
      { id: "hlc-words", icon: "📜", title: "诗词成语", color: "#ad6800" },
      { id: "hlc-memory", icon: "🧠", title: "记忆锻炼", color: "#7a4fd0" },
      { id: "hlc-math", icon: "🧮", title: "心算算术", color: "#1769aa" },
      { id: "hlc-culture", icon: "🏮", title: "民俗文化", color: "#b23c17" },
      { id: "hlc-eyes", icon: "👁️", title: "眼明手快", color: "#2e7d32" },
      { id: "hlc-calm", icon: "🍵", title: "静心时光", color: "#00796b" },
    ],
    STICKERS_TITLE: "🏮 我的贴纸",
    STICKERS_TILE: "贴纸",
    SURPRISE_TILE: "随便玩",
    HOME_LABEL: "回主页",
    // Deterministic sticker pool (Chinese motifs; picked by a stable hash).
    STICKER_POOL: ["🏮", "🧧", "🐉", "🐼", "🍵", "🥟", "🥮", "🌸", "🪷", "🌕", "🐭", "🐮", "🐯", "🐰", "🐍", "🐴", "🐑", "🐵", "🐔", "🐶", "🐷", "🐲", "🦚", "🌺", "🍊"],

    // ---- 🀄 Tiles: suits + numbers (drawn as text tiles — no flaky glyphs) ----
    TILE_NUMBERS: ["一", "二", "三", "四", "五", "六", "七", "八", "九"],
    TILE_SUITS: ["万", "筒", "条"],

    // ---- 📜 Tang poems (each: title, author, 4 lines — verified classics) ----
    POEMS: [
      { title: "静夜思", author: "李白", lines: ["床前明月光", "疑是地上霜", "举头望明月", "低头思故乡"] },
      { title: "春晓", author: "孟浩然", lines: ["春眠不觉晓", "处处闻啼鸟", "夜来风雨声", "花落知多少"] },
      { title: "悯农", author: "李绅", lines: ["锄禾日当午", "汗滴禾下土", "谁知盘中餐", "粒粒皆辛苦"] },
      { title: "登鹳雀楼", author: "王之涣", lines: ["白日依山尽", "黄河入海流", "欲穷千里目", "更上一层楼"] },
      { title: "咏鹅", author: "骆宾王", lines: ["鹅鹅鹅", "曲项向天歌", "白毛浮绿水", "红掌拨清波"] },
    ],

    // ---- 📜 Idioms: the last character is blanked; distractors must NOT form
    // another real idiom (verified in the truth test) ----
    IDIOMS: [
      { text: "画蛇添足", blank: 3, wrong: ["手", "头"] },
      { text: "守株待兔", blank: 3, wrong: ["鱼", "鸟"] },
      { text: "井底之蛙", blank: 3, wrong: ["鱼", "龟"] },
      { text: "亡羊补牢", blank: 3, wrong: ["门", "窗"] },
      { text: "对牛弹琴", blank: 3, wrong: ["鼓", "琵"] },
      { text: "马到成功", blank: 3, wrong: ["家", "名"] },
      { text: "一箭双雕", blank: 3, wrong: ["鹰", "虎"] },
      { text: "拔苗助长", blank: 3, wrong: ["高", "大"] },
      { text: "半途而废", blank: 3, wrong: ["停", "退"] },
      { text: "雪中送炭", blank: 3, wrong: ["花", "衣"] },
    ],

    // ---- 📜 Measure words (量词) — each noun's ONE correct measure word ----
    MEASURE_WORDS: [
      { noun: "马", emoji: "🐴", mw: "匹" },
      { noun: "牛", emoji: "🐮", mw: "头" },
      { noun: "鱼", emoji: "🐟", mw: "条" },
      { noun: "鸟", emoji: "🐦", mw: "只" },
      { noun: "书", emoji: "📖", mw: "本" },
      { noun: "伞", emoji: "☂️", mw: "把" },
      { noun: "车", emoji: "🚗", mw: "辆" },
      { noun: "花", emoji: "🌸", mw: "朵" },
      { noun: "衣服", emoji: "👕", mw: "件" },
      // 鞋: 双 (a pair) is the taught answer — shown as a PAIR so it reads
      // unambiguously; 只 (one shoe) is also valid Chinese, so it's marked alsoOk
      // and never offered as a "wrong" distractor.
      { noun: "鞋", emoji: "👟👟", mw: "双", alsoOk: ["只"] },
    ],

    // ---- 📜 Antonym pairs (反义词) ----
    ANTONYMS: [
      { a: "大", b: "小" }, { a: "上", b: "下" }, { a: "左", b: "右" }, { a: "多", b: "少" },
      { a: "高", b: "矮" }, { a: "长", b: "短" }, { a: "快", b: "慢" }, { a: "冷", b: "热" },
    ],

    // ---- 📜 Character hunts: find the target among same-radical lookalikes ----
    HUNT_CHARS: ["福", "祝", "礼", "神", "视", "祖"],
    // Similar-looking character pairs (the classic 我我我找我我 eye puzzle).
    CHAR_PAIRS: [
      { a: "我", b: "找" }, { a: "大", b: "太" }, { a: "天", b: "夫" },
      { a: "己", b: "已" }, { a: "日", b: "目" }, { a: "王", b: "玉" },
    ],

    // ---- 🧠 Memory: the dish list to remember (记菜单) ----
    DISHES: ["红烧肉", "清蒸鱼", "麻婆豆腐", "饺子", "青菜", "米饭", "汤圆", "包子", "炒面", "馄饨"],
    // Ordered life sequences (先后顺序) — first → last.
    SEQUENCES: [
      { name: "种花", steps: ["播种", "浇水", "发芽", "开花"] },
      { name: "包饺子", steps: ["和面", "擀皮", "包馅", "下锅"] },
      { name: "一天", steps: ["早上", "中午", "下午", "晚上"] },
    ],
    // 泡茶 order (its own calm-culture game) + one icon per step (index-matched).
    TEA_STEPS: ["烧水", "放茶叶", "倒热水", "慢慢品"],
    TEA_EMOJI: ["🫖", "🍃", "💧", "🍵"],

    // ---- 🧮 Market items with honest prices (元) ----
    MARKET: [
      { name: "白菜", emoji: "🥬", price: 2 },
      { name: "胡萝卜", emoji: "🥕", price: 3 },
      { name: "苹果", emoji: "🍎", price: 5 },
      { name: "鸡蛋", emoji: "🥚", price: 4 },
      { name: "玉米", emoji: "🌽", price: 1 },
      { name: "橘子", emoji: "🍊", price: 6 },
    ],

    // ---- 🏮 Zodiac (生肖) — the canonical 12, in order ----
    ZODIAC: [
      { name: "鼠", emoji: "🐭" }, { name: "牛", emoji: "🐮" }, { name: "虎", emoji: "🐯" },
      { name: "兔", emoji: "🐰" }, { name: "龙", emoji: "🐲" }, { name: "蛇", emoji: "🐍" },
      { name: "马", emoji: "🐴" }, { name: "羊", emoji: "🐑" }, { name: "猴", emoji: "🐵" },
      { name: "鸡", emoji: "🐔" }, { name: "狗", emoji: "🐶" }, { name: "猪", emoji: "🐷" },
    ],

    // ---- 🏮 Festivals: sort the custom/food to its festival (2 sets, 3 bins) ----
    FESTIVAL_SETS: [
      { name: "festivals1", bins: [
        { label: "春节", emoji: "🧧", why: "春节吃饺子、贴春联、发红包。", items: ["饺子", "红包", "春联"] },
        { label: "端午节", emoji: "🛶", why: "端午节吃粽子、赛龙舟。", items: ["粽子", "龙舟", "艾草"] },
        { label: "中秋节", emoji: "🌕", why: "中秋节吃月饼、赏月。", items: ["月饼", "赏月", "嫦娥"] },
      ] },
      { name: "festivals2", bins: [
        { label: "元宵节", emoji: "🏮", why: "元宵节吃汤圆、看花灯。", items: ["汤圆", "花灯", "猜灯谜"] },
        { label: "重阳节", emoji: "⛰️", why: "重阳节登高、赏菊花。", items: ["登高", "菊花", "敬老"] },
        { label: "春节", emoji: "🧧", why: "春节放鞭炮、拜年。", items: ["鞭炮", "拜年", "年夜饭"] },
      ] },
    ],

    // ---- 🏮 Regional dishes (各地名菜): dish → its famous home city ----
    REGIONAL: [
      { dish: "烤鸭", city: "北京" },
      { dish: "麻辣火锅", city: "四川" },
      { dish: "点心", city: "广东" },
      { dish: "拉面", city: "兰州" },
      { dish: "小笼包", city: "上海" },
      { dish: "刀削面", city: "山西" },
    ],

    // ---- 🏮 Chinese seasons (四季): each item belongs to ONE season ----
    HL_SEASONS: [
      { name: "春", icon: "🌱", tint: "#e8f8e0", items: ["燕子", "桃花", "发芽"] },
      { name: "夏", icon: "☀️", tint: "#fff3c9", items: ["荷花", "西瓜", "知了"] },
      { name: "秋", icon: "🍂", tint: "#ffe1c4", items: ["菊花", "落叶", "大雁"] },
      { name: "冬", icon: "❄️", tint: "#dff1ff", items: ["雪花", "腊梅", "冰"] },
    ],

    // ---- 🏮 Opera masks (京剧脸谱) — a VISUAL pairing game (no lore claims) ----
    MASK_COLORS: ["#c62828", "#1a1a1a", "#f5f5f5", "#1769aa", "#f9a825", "#2e7d32"],

    // ---- 🏮 Classic folk riddles (猜灯谜) — traditional, public-domain 谜语.
    // Answers are the canonical ones; wrong choices must never also fit (the
    // truth test asserts they differ from the answer).
    RIDDLES: [
      { q: "麻屋子，红帐子，里头睡个白胖子。", a: "花生", emoji: "🥜", wrong: ["核桃", "鸡蛋"] },
      { q: "千条线，万条线，掉到水里看不见。", a: "雨", emoji: "🌧️", wrong: ["雪", "风"] },
      { q: "五个兄弟，住在一起，名字不同，高矮不齐。", a: "手指", emoji: "🖐️", wrong: ["筷子", "牙齿"] },
      { q: "有时落在山腰，有时挂在树梢，有时像面圆镜，有时像把镰刀。", a: "月亮", emoji: "🌙", wrong: ["太阳", "星星"] },
      { q: "身穿绿衣裳，肚里水汪汪，生的子儿多，个个黑脸膛。", a: "西瓜", emoji: "🍉", wrong: ["冬瓜", "葡萄"] },
      { q: "一个小姑娘，坐在水中央，身穿粉红袄，坐在绿船上。", a: "荷花", emoji: "🪷", wrong: ["桃花", "菊花"] },
    ],

    // ---- 👁️ Eye games: pools ----
    // Only 🏮 is a 灯笼; the distractors are clearly NOT lanterns (a balloon and
    // a wind-chime — the old 🪔 oil-lamp read as lamp-like and could give pause).
    LANTERN_POOL: ["🏮", "🎈", "🎐"],
    // Each pond creature carries its correct 量词 so the count prompt stays on
    // message (the site teaches 鱼→条 elsewhere): 金鱼→条, 鸭子/乌龟→只, 荷花→朵.
    KOI_POOL: [
      { emoji: "🐟", name: "金鱼", mw: "条" }, { emoji: "🦆", name: "鸭子", mw: "只" },
      { emoji: "🐢", name: "乌龟", mw: "只" }, { emoji: "🪷", name: "荷花", mw: "朵" },
    ],
    SPOT_POOL: ["🍵", "🏮", "🥟", "🌸", "🐼", "🧧", "🍊", "🥮", "🪭", "🐉"],
    // Two-clue hunt (按提示找): color + shape lattice, in Chinese.
    HL_HUNT_COLORS: [
      { key: "红色", hex: "#c62828" }, { key: "金色", hex: "#f9a825" }, { key: "绿色", hex: "#2e7d32" },
    ],
    HL_HUNT_SHAPES: ["圆形", "方形", "三角"],

    // ---- 🧠 Chinese percussion trio for the echo game (照样敲) ----
    ECHO_INSTRUMENTS: [
      { name: "鼓", emoji: "🥁", freq: 220, color: "#c62828" },
      { name: "锣", emoji: "🔔", freq: 330, color: "#f9a825" },
      { name: "木鱼", emoji: "🪵", freq: 440, color: "#8d6e63" },
    ],

    // ---- 🍵 Calm: the pentatonic scale (五声音阶 — 宫商角徵羽) ----
    PENTATONIC: [
      { name: "宫", freq: 261.63 },  // do (C4)
      { name: "商", freq: 293.66 },  // re (D4)
      { name: "角", freq: 329.63 },  // mi (E4)
      { name: "徵", freq: 392.00 },  // sol (G4)
      { name: "羽", freq: 440.00 },  // la (A4)
    ],
    // Moon phases new → full (月亮圆缺), waxing order.
    MOON: ["🌑", "🌒", "🌓", "🌔", "🌕"],
    // Breathing (深呼吸) spoken pacing lines.
    BREATHE: { in: "吸气……", out: "呼气……", done: "真舒服。心静自然凉。" },
    // 福-tracing dot path (stroke-order-ish flow over a watermark 福).
    FU_PATH: [
      { x: 22, y: 18 }, { x: 20, y: 52 }, { x: 24, y: 86 },
      { x: 62, y: 14 }, { x: 76, y: 38 }, { x: 58, y: 62 }, { x: 78, y: 86 },
    ],
  };

  if (typeof module !== "undefined" && module.exports) module.exports = CONTENT;
  else global.HualiContent = CONTENT;
})(typeof window !== "undefined" ? window : globalThis);
