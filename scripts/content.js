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
    // Each friend has an original portrait spec so they show up as clearly
    // DIFFERENT kids (distinct skin + hair + shirt), gently reflecting each one.
    // Raegar: Indian/Russian · River: Chinese · Viraj: Indian · Josh: white/Chinese.
    FRIENDS: [
      { name: "Raegar", emoji: "🧑🏽", art: { skin: "#d9a066", hair: "#3a2417", style: "wavy", shirt: "#4caf6d" } },
      { name: "River", emoji: "🧒🏻", art: { skin: "#f3d0aa", hair: "#1b1b22", style: "bowl", shirt: "#2bb3c0" } },
      { name: "Viraj", emoji: "🧑🏾", art: { skin: "#a9713f", hair: "#17110d", style: "curly", shirt: "#ff9f43" } },
      { name: "Josh", emoji: "🧒", art: { skin: "#f1c9a5", hair: "#1a1a20", style: "fringe", shirt: "#e23636" } },
    ],
    // Josh's heroes (Spidey & His Amazing Friends), kept silly + friendly.
    // (Emoji + names only — original homage, not the copyrighted artwork.)
    HEROES: [
      { name: "Spidey", emoji: "🕷️", color: "#e23636" },
      { name: "Ghost-Spider", emoji: "🕸️", color: "#ec4e9c" },
      { name: "Spin", emoji: "🕸️", color: "#2b6cff" },
    ],
    // Rescue pups (Paw Patrol homage) — a name + pup emoji + a rescue vehicle.
    // collar = each pup's signature colour, so the rescue scene shows visibly
    // DIFFERENT pups (not four identical 🐶) and you can count one kind.
    PUPS: [
      { name: "Chase", emoji: "🐕‍🦺", job: "🚓", collar: "#2b6cff" },
      { name: "Marshall", emoji: "🐶", job: "🚒", collar: "#e23636" },
      { name: "Skye", emoji: "🐩", job: "🚁", collar: "#ff7ac0" },
      { name: "Rubble", emoji: "🐶", job: "🚜", collar: "#ffd24d" },
      { name: "Rocky", emoji: "🐶", job: "♻️", collar: "#7be08a" },
      { name: "Zuma", emoji: "🐶", job: "🚤", collar: "#ff9f43" },
    ],
    // Construction crew (Rubble & Crew homage).
    CREW: [
      { name: "Rubble", emoji: "🚧" }, { name: "Charger", emoji: "🏎️" },
      { name: "Wheeler", emoji: "🚜" }, { name: "Mix", emoji: "🚛" },
    ],
    // Fun pictures a dot-to-dot can reveal at the end.
    REVEALS: ["🕷️", "⭐", "❤️", "🚀", "🐶", "🦄", "🌈", "🎈", "🦋", "🚒"],

    // ---- Color by Number (coarse, 3-wide pixel pictures) ----
    // Each digit is a color number; the picture emerges as you color the cells.
    // "0" is background (not colored by the child) so the picture reads as a real
    // SHAPE emerging from the grid, not a solid rectangle of colour. Each picture
    // carries a `reveal` emoji shown big when it's finished (the payoff).
    CBN_COLORS: { 0: "#e9eef5", 1: "#ff5e5e", 2: "#bfe9ff", 3: "#7be08a", 4: "#ffd24d", 5: "#b98a5e", 6: "#ff9f43" },
    CBN_PICTURES: [
      // Rounds use the first three — keep those multi-colour and recognisable.
      { name: "House", reveal: "🏠", rows: ["010", "111", "222", "242"] },
      { name: "Tree", reveal: "🌳", rows: ["030", "333", "030", "050"] },
      { name: "Flower", reveal: "🌸", rows: ["101", "141", "101", "030"] },
      { name: "Heart", reveal: "❤️", rows: ["101", "111", "010"] },
      { name: "Sun", reveal: "☀️", rows: ["404", "444", "404"] },
      { name: "Star", reveal: "⭐", rows: ["040", "444", "404"] },
      { name: "Fish", reveal: "🐟", rows: ["060", "666", "060"] },
      { name: "Apple", reveal: "🍎", rows: ["030", "111", "111", "010"] },
      { name: "Butterfly", reveal: "🦋", rows: ["606", "666", "606"] },
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
    // Harder "which is different": three identical + one differing by ONE feature
    // (orientation or colour) within the same family. Used in later rounds.
    ODD_FEATURES: [
      { name: "up/down", base: "⬆️", odd: "⬇️" },
      { name: "left/right", base: "➡️", odd: "⬅️" },
      { name: "point", base: "👉", odd: "👈" },
      { name: "thumb", base: "👍", odd: "👎" },
      { name: "moon", base: "🌑", odd: "🌕" },
      { name: "heart colour", base: "❤️", odd: "💙" },
      { name: "circle colour", base: "🔴", odd: "🔵" },
      { name: "dot colour", base: "🟢", odd: "🟡" },
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
        // Tricky-but-true edge cases (a snail/cactus ARE alive; a robot/candle/
        // watch are NOT, though they move or flicker) so it stops being obvious.
        { label: "Alive", emoji: "🌱", why: "It's alive — it grows and needs food.", items: ["🐶", "🐱", "🌳", "🌷", "🐝", "🐟", "🦋", "🐢", "🌻", "🐛", "🌵", "🐌"] },
        { label: "Not alive", emoji: "🪨", why: "It's not alive — it doesn't grow or eat.", items: ["🪨", "🚗", "⚽", "🥄", "📦", "🔑", "👟", "🪑", "🧱", "🤖", "🕯️", "⌚"] },
      ] },
      { name: "sinkfloat", bins: [
        { label: "Sinks", emoji: "⬇️", why: "It sinks — it's heavy for its size.", items: ["🪨", "🔑", "🥄", "🧱", "⚓", "🪙"] },
        { label: "Floats", emoji: "⬆️", why: "It floats — it's light and traps air.", items: ["🍃", "🎈", "🦆", "🛟", "🪵", "🍎"] },
      ] },
      { name: "plantanimal", bins: [
        // Note: no fungi (🍄 is not a plant) — keep the two categories truthful.
        { label: "Plant", emoji: "🌿", why: "It's a plant — it grows in one spot.", items: ["🌳", "🌻", "🌵", "🌷", "🌼", "🌴"] },
        { label: "Animal", emoji: "🐾", why: "It's an animal — it moves and eats.", items: ["🐶", "🐱", "🐟", "🐘", "🦁", "🐸"] },
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
        { label: "Day", emoji: "🌞", why: "We see it in the daytime.", items: ["🌻", "🌈", "⛅", "🏖️", "🪁", "🌅"] },
        { label: "Night", emoji: "🌙", why: "We see it at night.", items: ["⭐", "🦉", "🌌", "🛌", "🕯️", "🦇"] },
      ] },
    ],
    HOT_COLD_SETS: [
      { name: "hotcold", bins: [
        { label: "Hot", emoji: "🔥", why: "It's hot!", items: ["☀️", "🌶️", "🍲", "☕", "🏜️", "🌋"] },
        { label: "Cold", emoji: "❄️", why: "It's cold!", items: ["🧊", "⛄", "🍦", "🐧", "🏔️", "🥶"] },
      ] },
    ],

    // ---- Digraphs (sh / ch) — every picture names itself and starts with the sound ----
    DIGRAPH_SETS: [
      { name: "shch", bins: [
        { label: "sh", emoji: "sh", items: ["🚢", "🐑", "👟", "🐚", "🦈"] }, // ship, sheep, shoe, shell, shark
        { label: "ch", emoji: "ch", items: ["🧀", "🍒", "🪑", "🐤", "🍫"] }, // cheese, cherry, chair, chick, chocolate
      ] },
    ],
    // Spoken word for each digraph picture, so the sort game NAMES the picture
    // aloud like every other literacy game (removes any self-naming ambiguity
    // when sound is on — e.g. 🐑 is "sheep", not "lamb").
    DIGRAPH_WORDS: {
      "🚢": "ship", "🐑": "sheep", "👟": "shoe", "🐚": "shell", "🦈": "shark",
      "🧀": "cheese", "🍒": "cherry", "🪑": "chair", "🐤": "chick", "🍫": "chocolate",
    },
    // ---- Spot-the-difference picture pool (distinct, self-naming) ----
    SPOT_POOL: ["🐶", "🐱", "🐰", "🦊", "🐸", "🐵", "🐷", "🐻", "🦁", "🐼",
      "🐝", "🦋", "🐟", "🐢", "⭐", "❤️", "🚗", "🎈", "🍎", "🌈"],
    // ---- Find-it games (visual search) — big, varied, clearly-different set ----
    FIND_POOL: ["🐶", "🐱", "🐰", "🦊", "🐸", "🐵", "🐷", "🐻", "🦁", "🐼",
      "🐝", "🦋", "🐟", "🐢", "🐙", "🐧", "🦄", "⭐", "❤️", "🚗", "🚀", "🎈", "🍎", "🌈"],

    // ---- Spell My Name (personalized letter-order) — FIRST NAMES ONLY (privacy) ----
    NAMES: [
      { name: "Josh", letters: "JOSH" },
      { name: "Raegar", letters: "RAEGAR" },
      { name: "River", letters: "RIVER" },
      { name: "Viraj", letters: "VIRAJ" },
    ],

    // ---- Plane shapes (2D) → a real-world object of that shape ----
    PLANE_SHAPES: [
      { name: "Circle", svg: '<circle cx="50" cy="50" r="40"/>', objects: ["🍪", "⚽", "🕐"] },
      { name: "Square", svg: '<rect x="14" y="14" width="72" height="72" rx="6"/>', objects: ["🪟", "🧇"] }, // window, waffle — both genuinely FLAT squares (a gift box is a 3D box, taught in Shape's Real Twin)
      { name: "Triangle", svg: '<polygon points="50,12 88,84 12,84"/>', objects: ["🍕", "📐", "🔺"] },
      { name: "Star", svg: '<polygon points="50,8 61,38 94,38 67,58 78,90 50,70 22,90 33,58 6,38 39,38"/>', objects: ["⭐", "🌟", "✨"] },
      { name: "Heart", svg: '<path d="M50 30 C36 10 8 16 8 40 C8 64 36 74 50 90 C64 74 92 64 92 40 C92 16 64 10 50 30 Z"/>', objects: ["❤️", "💗", "💖"] },
    ],

    // ---- Sort the Colors: a harder 3-bin (primary colors) set for later rounds ----
    COLOR_SETS_3: [
      { name: "rby", bins: [
        { label: "Red", emoji: "🔴", items: ["🍎", "🍓", "🍅", "🌹", "❤️"] },
        { label: "Blue", emoji: "🔵", items: ["🫐", "💙", "🌀", "💧", "🐳"] },
        { label: "Yellow", emoji: "🟡", items: ["🍌", "🌟", "🌻", "🧀", "🐤"] },
      ] },
    ],

    // ---- Web Rescue Reveal — friendly faces to free from the webs ----
    RESCUE_POOL: ["🐶", "🐱", "🐰", "🐦", "🐹", "🐢", "🦋", "🐝", "🦸", "🕷️"],

    // ---- Make an Island (landform maker) — build the shape, name it ----
    // 3×3 grid: fill the plus (indices 1,3,4,5,7) with `tile`, corners stay the
    // base. The reveal + spoken name teach the concept (gentle [P] exposure).
    LANDFORMS: [
      { name: "Island", base: "💧", fill: [1, 3, 4, 5, 7], tile: "🟩", reveal: "🌴", say: "That's an island — land with water all around!" },
      { name: "Lake", base: "🟩", fill: [1, 3, 4, 5, 7], tile: "💧", reveal: "🦆", say: "That's a lake — water with land all around!" },
      { name: "Mountain", base: "🟩", fill: [1, 3, 4, 5, 7], tile: "🟫", reveal: "⛰️", say: "That's a mountain — tall, high-up land!" },
    ],

    // ---- Continents (Montessori colors + a signature animal that lives there) ----
    // A friendly, stylized world map (not exact coastlines). The animal sits on
    // its home continent so the picture is self-checking. Colors follow the
    // Montessori continent-map convention. Blobs use a 0 0 200 110 viewBox.
    CONTINENTS: [
      { name: "North America", color: "#ff8c42", animal: "🦅", cx: 40, cy: 34, rx: 26, ry: 21 },
      { name: "South America", color: "#ff6fa5", animal: "🦙", cx: 60, cy: 83, rx: 15, ry: 22 },
      { name: "Europe", color: "#e0524f", animal: "🦌", cx: 104, cy: 30, rx: 13, ry: 11 },
      { name: "Africa", color: "#4caf50", animal: "🦁", cx: 109, cy: 66, rx: 19, ry: 24 },
      { name: "Asia", color: "#f4c430", animal: "🐼", cx: 151, cy: 36, rx: 31, ry: 21 },
      { name: "Australia", color: "#a0693c", animal: "🦘", cx: 168, cy: 85, rx: 16, ry: 12 },
      { name: "Antarctica", color: "#cdd8e3", animal: "🐧", cx: 100, cy: 105, rx: 64, ry: 8 },
    ],

    // ---- Blue Planet: Land or Water? (geography sort) ----
    BLUE_PLANET_SETS: [
      { name: "landwater", bins: [
        { label: "Land", emoji: "🏝️", items: ["🏔️", "🌋", "🏜️", "🌳", "🏕️", "🏙️"] },
        { label: "Water", emoji: "🌊", items: ["🐟", "🐳", "⛵", "🏄", "💧", "🐠"] },
      ] },
    ],

    // ---- Finish the Word (sh / ch / th) — each word starts with its digraph ----
    DIGRAPH_FINISH: [
      { emoji: "🚢", word: "ship", digraph: "sh" },
      { emoji: "🐚", word: "shell", digraph: "sh" },
      { emoji: "👟", word: "shoe", digraph: "sh" },
      { emoji: "🦈", word: "shark", digraph: "sh" },
      { emoji: "🪑", word: "chair", digraph: "ch" },
      { emoji: "🧀", word: "cheese", digraph: "ch" },
      { emoji: "🍒", word: "cherry", digraph: "ch" },
      { emoji: "🐤", word: "chick", digraph: "ch" },
      { emoji: "👍", word: "thumb", digraph: "th" },
      { emoji: "3️⃣", word: "three", digraph: "th" },
      { emoji: "🌡️", word: "thermometer", digraph: "th" },
    ],

    // ---- Put the Story in Order — steps are in TRUE first→last order ----
    STORY_SEQUENCES: [
      { name: "Chicken", steps: ["🥚", "🐣", "🐔"] },   // egg → chick → hen
      { name: "Butterfly", steps: ["🥚", "🐛", "🦋"] }, // egg → caterpillar → butterfly
      { name: "Tree", steps: ["🌱", "🌿", "🌳"] },       // sprout → plant → tree
      { name: "Grow up", steps: ["👶", "🧒", "🧓"] },     // baby → child → grown
      { name: "Apple", steps: ["🌱", "🌸", "🍎"] },       // sprout → blossom → fruit
    ],

    // ---- Letter Maker (trace ordered dots over a faint guide letter) ----
    // Dots are big tap targets, so each is well-spread; the faint glyph carries
    // recognizability. Simple open letters only.
    LETTER_PATHS: [
      { letter: "L", dots: [{ x: 26, y: 12 }, { x: 26, y: 86 }, { x: 82, y: 86 }] },
      { letter: "V", dots: [{ x: 16, y: 12 }, { x: 50, y: 86 }, { x: 84, y: 12 }] },
      { letter: "O", dots: [{ x: 50, y: 8 }, { x: 86, y: 50 }, { x: 50, y: 90 }, { x: 14, y: 50 }] },
      { letter: "C", dots: [{ x: 84, y: 16 }, { x: 24, y: 30 }, { x: 24, y: 72 }, { x: 84, y: 86 }] },
      { letter: "U", dots: [{ x: 18, y: 12 }, { x: 30, y: 84 }, { x: 70, y: 84 }, { x: 82, y: 12 }] },
    ],

    // ---- The Big Red One (feature-conjunction: color × shape) ----
    CONJ_COLORS: [
      { name: "red", hex: "#e23636" }, { name: "blue", hex: "#2b6cff" },
      { name: "green", hex: "#38b000" }, { name: "yellow", hex: "#f6bd16" },
    ],
    CONJ_SHAPES: [
      { name: "circle", svg: '<circle cx="50" cy="50" r="40"/>' },
      { name: "square", svg: '<rect x="14" y="14" width="72" height="72" rx="10"/>' },
      { name: "star", svg: '<polygon points="50,8 61,38 94,38 67,58 78,90 50,70 22,90 33,58 6,38 39,38"/>' },
      { name: "heart", svg: '<path d="M50 30 C36 10 8 16 8 40 C8 64 36 74 50 90 C64 74 92 64 92 40 C92 16 64 10 50 30 Z"/>' },
    ],

    // ---- Will It Stick? (magnetic vs not — a science sort) ----
    // NOTE ON TRUTH: only clearly ferromagnetic (steel/iron) items go in "Sticks".
    // Coins (🪙) are NOT magnetic and keys (🔑) are usually brass — both removed to
    // avoid teaching a falsehood a child would disprove with a real magnet.
    MAGNET_SETS: [
      { name: "magnet", bins: [
        { label: "Sticks", emoji: "🧲", items: ["🔩", "⚙️", "📎", "🥫", "🔧", "🧷"] },
        { label: "No", emoji: "🚫", items: ["🪵", "🧸", "🍎", "📗", "🧦", "🎈"] },
      ] },
    ],

    // ---- I Spy: Find Them All (category hunt) ----
    // DISJOINT sets — every emoji belongs to exactly ONE category, so a filler
    // from another category can never accidentally be a hidden member.
    FIND_CATEGORIES: [
      { id: "animals", icon: "🐾", items: ["🐶", "🐱", "🐰", "🦊", "🐸", "🐵", "🐷", "🐻", "🦁", "🐼"] },
      { id: "vehicles", icon: "🚗", items: ["🚗", "🚌", "🚒", "🚜", "🚲", "✈️", "🚁", "🚚"] },
      { id: "food", icon: "🍎", items: ["🍎", "🍌", "🍓", "🍇", "🍊", "🍪", "🍕", "🥕"] },
      { id: "sky", icon: "⭐", items: ["⭐", "🌙", "☀️", "🌈", "☁️", "🌟"] },
    ],

    // ---- Shape's Real Twin (3D solids → a real-world object of that shape) ----
    // Each solid has a friendly SVG and self-naming real objects. Disjoint sets.
    SOLID_SETS: [
      { name: "Ball", objects: ["⚽", "🏀", "🌍", "🍊"],
        svg: '<circle cx="50" cy="55" r="34" fill="#5ec8ff" stroke="#2b6cff" stroke-width="2.5"/><ellipse cx="40" cy="44" rx="11" ry="7" fill="rgba(255,255,255,0.55)"/>' },
      { name: "Box", objects: ["📦", "🎲", "🧊"],
        svg: '<polygon points="30,38 60,38 72,26 42,26" fill="#ffe08a"/><rect x="30" y="38" width="30" height="36" fill="#ffb703"/><polygon points="60,38 72,26 72,62 60,74" fill="#e59400"/>' },
      { name: "Cone", objects: ["🍦", "🥕"],
        svg: '<polygon points="50,22 68,72 32,72" fill="#ff8fa3"/><ellipse cx="50" cy="72" rx="18" ry="6" fill="#e05e77"/>' },
      { name: "Can", objects: ["🥫", "🥁", "🔋"],
        svg: '<ellipse cx="50" cy="30" rx="20" ry="7" fill="#a0d468"/><rect x="30" y="30" width="40" height="42" fill="#7be08a"/><ellipse cx="50" cy="72" rx="20" ry="7" fill="#5cc46a"/>' },
    ],

    // ---- Picture Squares (mini picture-sudoku) — trios of distinct pictures ----
    SQUARE_TRIOS: [
      ["🍎", "🍌", "🍓"],
      ["🐶", "🐱", "🐰"],
      ["⭐", "❤️", "🔵"],
      ["🚗", "🚀", "🚌"],
      ["☀️", "🌙", "🌈"],
      ["🐝", "🦋", "🐞"],
    ],

    // ---- Who Is It? (multi-attribute deduction) ----
    // Two positive attributes: a body color and a held item. All 6 combos are
    // distinct, so a (color + item) clue pair always narrows to exactly one.
    DEDUCE_COLORS: [
      { key: "red", hex: "#e23636", dot: "🔴" },
      { key: "blue", hex: "#2b6cff", dot: "🔵" },
      { key: "green", hex: "#38b000", dot: "🟢" },
    ],
    DEDUCE_ITEMS: [
      { key: "star", emoji: "⭐" },
      { key: "balloon", emoji: "🎈" },
    ],

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
