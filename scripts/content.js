// ALL editable content for Josh's Games — words, emoji, colors, and per-game
// data as plain data. Edit here to personalize. Works BOTH in the browser
// (sets window.JoshContent) and in Node tests (module.exports).
//
// Built for Josh (age 4) — see JOSH_PROFILE.md. Emoji-first, zero reading
// required to play; every picture "names itself" so naming tasks are fair.

(function (global) {
  const CONTENT = {
    TITLE: "Josh's Games",

    // ---- People Josh knows (rotate a different friend through each game) ----
    FRIENDS: [
      { name: "Raegar", emoji: "🧑🏽" },
      { name: "River", emoji: "🧒🏻" },
      { name: "Viraj", emoji: "🧑🏾" },
      { name: "Josh", emoji: "🧒" },
    ],
    // Josh's heroes (Spidey & His Amazing Friends), kept silly + friendly.
    HEROES: [
      { name: "Spidey", emoji: "🕷️", color: "#e23636" },
      { name: "Ghost-Spider", emoji: "🕸️", color: "#ec4e9c" },
      { name: "Spin", emoji: "🕸️", color: "#2b6cff" },
    ],

    // Happy cheers (shown) and short spoken praise (spoken when sound is on).
    CHEERS: [
      "Yay! 🎉", "Hooray! 🌟", "Wheee! 🎈", "So fun! 💫",
      "Great job! 👏", "Woohoo! 🎊", "Amazing! 🌈", "You did it! ⭐",
    ],
    PRAISE_SPOKEN: [
      "Yay! You did it!", "Great job!", "Hooray!", "Awesome!",
      "You're amazing!", "Woohoo!", "Nice work!", "Super!",
    ],
    TRYAGAIN_SPOKEN: ["Try again!", "Almost! Try another.", "Oops, try again!", "So close! Try again."],

    // Bright, high-contrast confetti colors.
    CONFETTI_COLORS: ["#ff5e7e", "#ffd24d", "#5ec8ff", "#7be08a", "#c77dff", "#ffa64d"],

    // ---- "Say hi to the animals" toy ----
    ANIMALS: [
      { emoji: "🐶", name: "Dog" }, { emoji: "🐱", name: "Cat" },
      { emoji: "🐰", name: "Bunny" }, { emoji: "🐻", name: "Bear" },
      { emoji: "🦁", name: "Lion" }, { emoji: "🐸", name: "Frog" },
      { emoji: "🐷", name: "Pig" }, { emoji: "🐵", name: "Monkey" },
      { emoji: "🐘", name: "Elephant" }, { emoji: "🦊", name: "Fox" },
      { emoji: "🐧", name: "Penguin" }, { emoji: "🦄", name: "Unicorn" },
      { emoji: "🐢", name: "Turtle" }, { emoji: "🐝", name: "Bee" },
    ],

    // ---- Count & Feed (math [M], counting 1-10) ----
    // A hungry friend; tap snacks to feed exactly the target number.
    EATERS: [
      { emoji: "🦖", name: "Dino" }, { emoji: "🐵", name: "Monkey" },
      { emoji: "🐳", name: "Whale" }, { emoji: "🐰", name: "Bunny" },
      { emoji: "🐷", name: "Piggy" },
    ],
    SNACKS: ["🍎", "🍌", "🍓", "🍇", "🍪", "🧀", "🥕", "🍊"],

    // ---- Odd One Out (logic) ----
    // Each group is one "kind"; a round shows 3 from one group + 1 from another.
    ODD_GROUPS: [
      { name: "fruit", items: ["🍎", "🍌", "🍓", "🍇", "🍊", "🍉"] },
      { name: "animal", items: ["🐶", "🐱", "🐰", "🐸", "🐵", "🦊"] },
      { name: "vehicle", items: ["🚗", "🚌", "🚒", "🚜", "🚀", "🚲"] },
      { name: "food", items: ["🍕", "🍔", "🌭", "🍟", "🍩", "🍪"] },
      { name: "shape", items: ["⭐", "❤️", "🔵", "🔺", "⬛", "🟢"] },
      { name: "bug", items: ["🐝", "🐛", "🦋", "🐞", "🐜", "🕷️"] },
    ],

    // ---- What Comes Next (pattern logic) ----
    // Token sets used to build AB / ABC / AABB patterns.
    PATTERN_SETS: [
      ["🔴", "🔵"], ["⭐", "🌙"], ["🍎", "🍌"], ["🐶", "🐱"],
      ["🔺", "🟩"], ["🚗", "🚀"], ["❤️", "💛"], ["🌸", "🌻"],
    ],

    // Countable objects reused by Take-Away and Which Has More.
    COUNT_OBJECTS: ["🍎", "🐸", "⭐", "🚗", "🐟", "🌼", "🧸", "🍌", "🐤", "🎈"],
    // Skip-count steps: 2s and 5s are his growth edges; 10s is confidence.
    SKIP_STEPS: [2, 5, 10],
    // Coin Shop rewards — a sticker to "buy" with pennies.
    STICKERS: ["⭐", "🌈", "🚀", "🦄", "🍭", "🎈", "🐶", "🌸", "🦋", "🍩"],
    // Numberblock-style tower block colors (1..10).
    BLOCK_COLORS: ["#ff5e5e", "#ff9f43", "#ffd24d", "#7be08a", "#3ec7c7",
      "#5ec8ff", "#8a7bff", "#c77dff", "#ff7ac0", "#a0d468"],

    // ---- Literacy ----
    // First-sound: each picture NAMES ITSELF and its beginning letter is clear.
    FIRST_SOUND_WORDS: [
      { emoji: "🍎", word: "apple", letter: "A" },
      { emoji: "🐝", word: "bee", letter: "B" },
      { emoji: "🐱", word: "cat", letter: "C" },
      { emoji: "🐶", word: "dog", letter: "D" },
      { emoji: "🥚", word: "egg", letter: "E" },
      { emoji: "🐟", word: "fish", letter: "F" },
      { emoji: "🦁", word: "lion", letter: "L" },
      { emoji: "🌙", word: "moon", letter: "M" },
      { emoji: "☀️", word: "sun", letter: "S" },
      { emoji: "🐢", word: "turtle", letter: "T" },
    ],
    // Rhyme groups — every member's picture names itself.
    RHYME_GROUPS: [
      [{ emoji: "🐱", word: "cat" }, { emoji: "🎩", word: "hat" }, { emoji: "🦇", word: "bat" }],
      [{ emoji: "🐶", word: "dog" }, { emoji: "🐸", word: "frog" }, { emoji: "🪵", word: "log" }],
      [{ emoji: "⭐", word: "star" }, { emoji: "🚗", word: "car" }, { emoji: "🫙", word: "jar" }],
      [{ emoji: "🐝", word: "bee" }, { emoji: "🌳", word: "tree" }, { emoji: "🔑", word: "key" }],
      [{ emoji: "🌙", word: "moon" }, { emoji: "🥄", word: "spoon" }],
      [{ emoji: "🐌", word: "snail" }, { emoji: "🐋", word: "whale" }],
    ],
    // Sight (non-phonetic) words — visual matching, audio-reinforced.
    SIGHT_WORDS: ["the", "you", "was", "are", "see", "my", "he", "she", "we", "and", "go", "like"],
    // CVC words to build — clear, self-naming pictures.
    CVC_WORDS: [
      { emoji: "🐱", word: "cat" }, { emoji: "🐶", word: "dog" }, { emoji: "☀️", word: "sun" },
      { emoji: "🐷", word: "pig" }, { emoji: "🚌", word: "bus" }, { emoji: "🎩", word: "hat" },
      { emoji: "🛏️", word: "bed" }, { emoji: "📦", word: "box" },
    ],

    // ---- Logic & puzzles ----
    MEMORY_EMOJIS: ["🐶", "🐱", "🦊", "🐼", "🐸", "🦄", "🐝", "🐢", "🍎", "⭐", "🚗", "🌈"],
    // Shadow match uses distinct GEOMETRIC shapes (inline SVG) so silhouettes are
    // clearly different even when solid black — emoji silhouettes look identical.
    SHAPES: [
      { name: "circle", svg: '<circle cx="50" cy="50" r="44"/>' },
      { name: "square", svg: '<rect x="12" y="12" width="76" height="76" rx="10"/>' },
      { name: "triangle", svg: '<polygon points="50,8 92,88 8,88"/>' },
      { name: "star", svg: '<polygon points="50,5 61,38 96,38 68,59 79,92 50,71 21,92 32,59 4,38 39,38"/>' },
      { name: "heart", svg: '<path d="M50 30 C35 8 5 14 5 40 C5 66 35 76 50 92 C65 76 95 66 95 40 C95 14 65 8 50 30 Z"/>' },
      { name: "diamond", svg: '<polygon points="50,6 92,50 50,94 8,50"/>' },
      { name: "moon", svg: '<path d="M66 10 A40 40 0 1 0 66 90 A32 32 0 1 1 66 10 Z"/>' },
      { name: "hexagon", svg: '<polygon points="50,6 88,28 88,72 50,94 12,72 12,28"/>' },
      { name: "arrow", svg: '<polygon points="8,38 58,38 58,18 94,50 58,82 58,62 8,62"/>' },
      { name: "plus", svg: '<polygon points="38,8 62,8 62,38 92,38 92,62 62,62 62,92 38,92 38,62 8,62 8,38 38,38"/>' },
    ],
    ORDER_POOL: ["🐟", "⭐", "🎈", "🍎", "🐛", "🚗", "❤️", "🌟", "🐰", "🍩"],

    // ---- Science & sorting (each SET has 2-3 bins; the item's bin is correct) ----
    SORT_SETS: [
      { name: "living", bins: [
        { label: "Alive", emoji: "🌱", items: ["🐶", "🐱", "🌳", "🌷", "🐝", "🐟", "🦋", "🐢", "🌻"] },
        { label: "Not alive", emoji: "🪨", items: ["🪨", "🚗", "⚽", "🥄", "📦", "🔑", "👟", "🪑", "🧱"] },
      ] },
      { name: "sinkfloat", bins: [
        { label: "Sinks", emoji: "⬇️", items: ["🪨", "🔑", "🥄", "🧱", "⚓", "🪙"] },
        { label: "Floats", emoji: "⬆️", items: ["🍃", "🎈", "🦆", "🛟", "🪵", "🍎"] },
      ] },
      { name: "plantanimal", bins: [
        // Note: no fungi (🍄 is not a plant) — keep the two categories truthful.
        { label: "Plant", emoji: "🌿", items: ["🌳", "🌻", "🌵", "🌷", "🌼", "🌴"] },
        { label: "Animal", emoji: "🐾", items: ["🐶", "🐱", "🐟", "🐘", "🦁", "🐸"] },
      ] },
    ],
    COLOR_SETS: [
      { name: "redblue", bins: [
        { label: "Red", emoji: "🔴", items: ["🍎", "🍓", "🍅", "🌹", "❤️"] },
        { label: "Blue", emoji: "🔵", items: ["🫐", "💙", "🌀", "💧", "🐳"] },
      ] },
      { name: "yellowgreen", bins: [
        { label: "Yellow", emoji: "🟡", items: ["🍌", "🌟", "🌻", "🧀", "🐤"] },
        { label: "Green", emoji: "🟢", items: ["🥦", "🐸", "🌲", "🥝", "🍀"] },
      ] },
    ],
    LAW_SETS: [
      { name: "law", bins: [
        { label: "Land", emoji: "🚗", items: ["🚗", "🚙", "🚌", "🐘", "🦁", "🏠"] },
        { label: "Air", emoji: "✈️", items: ["✈️", "🚁", "🦅", "🎈", "🚀", "🦋"] },
        { label: "Water", emoji: "🐟", items: ["🐟", "🐬", "🚤", "🐠", "🐙", "⛵"] },
      ] },
    ],
    DAY_NIGHT_SETS: [
      { name: "daynight", bins: [
        { label: "Day", emoji: "🌞", items: ["🌻", "🌈", "⛅", "🏖️", "🪁", "🌅"] },
        { label: "Night", emoji: "🌙", items: ["⭐", "🦉", "🌌", "🛌", "🕯️", "🦇"] },
      ] },
    ],
    HOT_COLD_SETS: [
      { name: "hotcold", bins: [
        { label: "Hot", emoji: "🔥", items: ["☀️", "🌶️", "🍲", "☕", "🏜️", "🌋"] },
        { label: "Cold", emoji: "❄️", items: ["🧊", "⛄", "🍦", "🐧", "🏔️", "🥶"] },
      ] },
    ],

    // ---- Digraphs (sh / ch) — every picture names itself and starts with the sound ----
    DIGRAPH_SETS: [
      { name: "shch", bins: [
        { label: "sh", emoji: "sh", items: ["🚢", "🐑", "👟", "🐚", "🦈"] }, // ship, sheep, shoe, shell, shark
        { label: "ch", emoji: "ch", items: ["🧀", "🍒", "🪑", "🐤", "🍫"] }, // cheese, cherry, chair, chick, chocolate
      ] },
    ],
    // ---- Spot-the-difference picture pool (distinct, self-naming) ----
    SPOT_POOL: ["🐶", "🐱", "🐰", "🦊", "🐸", "🐵", "🐷", "🐻", "🦁", "🐼",
      "🐝", "🦋", "🐟", "🐢", "⭐", "❤️", "🚗", "🎈", "🍎", "🌈"],
    // ---- Find-it games (visual search) — big, varied, clearly-different set ----
    FIND_POOL: ["🐶", "🐱", "🐰", "🦊", "🐸", "🐵", "🐷", "🐻", "🦁", "🐼",
      "🐝", "🦋", "🐟", "🐢", "🐙", "🐧", "🦄", "⭐", "❤️", "🚗", "🚀", "🎈", "🍎", "🌈"],

    // ---- Trace-the-Path (fine-motor / lacing) ----
    // Each path is dots as (x,y) percentages; tap green start -> red finish in
    // order. Positions are spaced so 76px dots never collide (verified by tests).
    PATHS: [
      [{ x: 24, y: 6 }, { x: 70, y: 27 }, { x: 28, y: 50 }, { x: 72, y: 72 }, { x: 44, y: 93 }],
      [{ x: 70, y: 6 }, { x: 26, y: 27 }, { x: 68, y: 50 }, { x: 30, y: 72 }, { x: 60, y: 93 }],
      [{ x: 45, y: 6 }, { x: 72, y: 28 }, { x: 25, y: 50 }, { x: 66, y: 72 }, { x: 35, y: 93 }],
    ],
  };

  if (typeof module !== "undefined" && module.exports) module.exports = CONTENT;
  else global.JoshContent = CONTENT;
})(typeof window !== "undefined" ? window : globalThis);
