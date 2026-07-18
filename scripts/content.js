// ALL editable content for Josh's Games — words, emoji, colors, and per-game
// data as plain data. Edit here to personalize. Works BOTH in the browser
// (sets window.JoshContent) and in Node tests (module.exports).
//
// Built for Josh (age 4) — see JOSH_PROFILE.md. Emoji-first, zero reading
// required to play; every picture "names itself" so naming tasks are fair.

(function (global) {
  // Shared sort sets defined ONCE and referenced from both the Alive-or-Not
  // rotation (SORT_SETS) and their own dedicated game tiles — a single source
  // of truth, so the sink/float and plant/animal facts can never fork.
  const SINK_FLOAT_SET = { name: "sinkfloat", prompt: "Will it sink or float?", icons: ["👀", "⬇️", "⬆️"], bins: [
    { label: "Sinks", emoji: "⬇️", why: "It sinks — it's heavy for its size.", items: ["🪨", "🔑", "🥄", "🧱", "⚓", "🪙"] },
    { label: "Floats", emoji: "⬆️", why: "It floats — it's light and traps air.", items: ["🍃", "🎈", "🦆", "🛟", "🪵", "🍎"] },
  ] };
  const PLANT_ANIMAL_SET = { name: "plantanimal", prompt: "Is it a plant or an animal?", icons: ["👀", "🌿", "🐾"], bins: [
    // Note: no fungi (🍄 is not a plant) — keep the two categories truthful.
    { label: "Plant", emoji: "🌿", why: "It's a plant — it grows in one spot.", items: ["🌳", "🌻", "🌵", "🌷", "🌼", "🌴"] },
    { label: "Animal", emoji: "🐾", why: "It's an animal — it moves and eats.", items: ["🐶", "🐱", "🐟", "🐘", "🦁", "🐸"] },
  ] };

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
    // Silly (never scary) baddies for the Spidey web-up toy — original homage
    // names + friendly emoji only. They pop up and Josh webs them (no timer).
    VILLAINS: [
      { name: "Goblin", emoji: "👺" },
      { name: "Rhino", emoji: "🦏" },
      { name: "Doc Ock", emoji: "🐙" },
      { name: "Sandy", emoji: "🏜️" },
      { name: "Sparky", emoji: "⚡" },
      { name: "Vulture", emoji: "🦅" },
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
      { name: "living", prompt: "Is it alive?", icons: ["👀", "🌱", "🪨"], bins: [
        // Tricky-but-true edge cases (a snail/cactus ARE alive; a robot/candle/
        // watch are NOT, though they move or flicker) so it stops being obvious.
        { label: "Alive", emoji: "🌱", why: "It's alive — it grows and needs food.", items: ["🐶", "🐱", "🌳", "🌷", "🐝", "🐟", "🦋", "🐢", "🌻", "🐛", "🌵", "🐌"] },
        { label: "Not alive", emoji: "🪨", why: "It's not alive — it doesn't grow or eat.", items: ["🪨", "🚗", "⚽", "🥄", "📦", "🔑", "👟", "🪑", "🧱", "🤖", "🕯️", "⌚"] },
      ] },
      SINK_FLOAT_SET,
      PLANT_ANIMAL_SET,
    ],
    // The same sets, surfaced for their DEDICATED game tiles (same objects —
    // one truth). PLANT_ANIMAL_SETS feeds the sorter engine; SINK_FLOAT_SET
    // feeds the predict-then-see tub game.
    SINK_FLOAT_SET,
    PLANT_ANIMAL_SETS: [PLANT_ANIMAL_SET],
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
        { label: "sh", emoji: "sh", items: ["🚢", "🦐", "👟", "🐚", "🦈"] }, // ship, shrimp, shoe, shell, shark
        { label: "ch", emoji: "ch", items: ["🧀", "🍒", "🪑", "🐤", "🍫"] }, // cheese, cherry, chair, chick, chocolate
      ] },
    ],
    // Spoken word for each digraph picture, so the sort game NAMES the picture
    // aloud like every other literacy game (removes any self-naming ambiguity
    // when sound is on — e.g. 🦐 is "shrimp", 🐤 is "chick").
    DIGRAPH_WORDS: {
      "🚢": "ship", "🦐": "shrimp", "👟": "shoe", "🐚": "shell", "🦈": "shark",
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
      { name: "Circle", svg: '<circle cx="50" cy="50" r="40"/>', objects: ["🍪", "🕐"] }, // cookie, clock — genuinely FLAT circles (a ⚽ soccer ball is a 3D sphere, taught in Shape's Real Twin)
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

    // ---- Make an Island (landform maker) — place the feature, name it ----
    // A 3×3 top-down map that MATCHES the definition. The surround (`base`) fills
    // the whole grid as context (all ocean / all field); Josh taps the MIDDLE to
    // place the `feature`, so the result is literally "land with water all around"
    // (island) or "water with land all around" (lake). A friendly `reveals` item
    // then pops ON the landform and the spoken `say` names it (gentle [P]
    // exposure). Mountain was dropped — height can't be shown on a flat top-down
    // grid, so it never read as a mountain.
    LANDFORMS: [
      { name: "Island", base: "💧", feature: "🟩", reveals: ["🌴", "🏖️", "⛵"], say: "That's an island — land with water all around!" },
      { name: "Lake", base: "🟩", feature: "💧", reveals: ["🦆", "🐟", "🛶"], say: "That's a lake — water with land all around!" },
    ],

    // ---- 🎨 Mix It! Paint Lab — real color theory, one mix per round ----
    // Pour pot a + pot b → the bowl turns `out`. The truth table is restated in
    // content.test.js so a mix can never silently go wrong.
    MIXES: [
      { a: { name: "red", hex: "#e23636" }, b: { name: "yellow", hex: "#ffd24d" }, out: { name: "orange", hex: "#ff9331" } },
      { a: { name: "yellow", hex: "#ffd24d" }, b: { name: "blue", hex: "#2b6cff" }, out: { name: "green", hex: "#3fa34d" } },
      { a: { name: "blue", hex: "#2b6cff" }, b: { name: "red", hex: "#e23636" }, out: { name: "purple", hex: "#8c4fd8" } },
      { a: { name: "red", hex: "#e23636" }, b: { name: "white", hex: "#f6f7fb" }, out: { name: "pink", hex: "#ff9ec2" } },
    ],

    // ---- 🐣 Mama & Baby — each baby's real mama (self-naming pictures) ----
    MAMA_BABY: [
      { baby: "🐤", babyName: "Chick", mama: "🐔", mamaName: "Hen" },
      { baby: "🐶", babyName: "Puppy", mama: "🐕", mamaName: "Dog" },
      { baby: "🐱", babyName: "Kitten", mama: "🐈", mamaName: "Cat" },
      { baby: "🐛", babyName: "Caterpillar", mama: "🦋", mamaName: "Butterfly" },
    ],

    // ---- 👀 Quick Peek (subitizing) — the countable that hides behind a cloud ----
    PEEK_ITEMS: ["⭐", "🍓", "🐞", "🔵"],

    // ---- 🍪 Fair Shares — treats to deal around the friends ----
    SHARE_TREATS: ["🍪", "🍓", "🧁"],

    // ---- 🔎 Letter Hunt — visually clear letters (no I/O lookalike traps) ----
    HUNT_LETTERS: ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "R", "S", "T"],

    // ---- 😊 How Do They Feel? (SEL — name the feeling, then help) ----
    // Four clear feeling faces. Every story's `feel` maps to one of them; a
    // truth table in content.test.js keeps story→feeling honest. Naming a
    // feeling is never "wrong to have" — the game only ever identifies.
    FEELINGS: [
      { id: "happy", face: "😊", name: "happy" },
      { id: "sad", face: "😢", name: "sad" },
      { id: "mad", face: "😠", name: "mad" },
      { id: "surprised", face: "😲", name: "surprised" },
    ],
    FEELING_STORIES: [
      { who: "Raegar", say: "Raegar's block tower fell down.", icons: ["🧱", "⬇️"], feel: "sad" },
      { who: "River", say: "River got a puppy for his birthday!", icons: ["🎁", "🐶"], feel: "happy" },
      { who: "Viraj", say: "Viraj's balloon popped. POP!", icons: ["🎈", "💥"], feel: "surprised" },
      { who: "Josh", say: "Someone took Josh's truck without asking.", icons: ["🚚", "🙅"], feel: "mad" },
      { who: "Raegar", say: "Raegar is going to the playground today!", icons: ["🛝", "🎉"], feel: "happy" },
      { who: "River", say: "River dropped his ice cream on the ground.", icons: ["🍦", "⬇️"], feel: "sad" },
      { who: "Josh", say: "Josh found a surprise present on his chair!", icons: ["🎁", "✨"], feel: "surprised" },
    ],

    // ---- 🤝 Kind Helpers (SEL — tap the kind thing to do) ----
    // Exactly ONE kind option per scenario (truth-tabled); the others are
    // silly-neutral, never mean, so a miss is a giggle and a redirect.
    KINDNESS: [
      { say: "River dropped all his crayons!", icons: ["🖍️", "⬇️"],
        options: [{ emoji: "🤲", name: "help pick them up", kind: true }, { emoji: "🏃", name: "run away", kind: false }, { emoji: "😴", name: "take a nap", kind: false }] },
      { say: "Raegar is feeling sad today.", icons: ["😢", "💭"],
        options: [{ emoji: "🤗", name: "give him a hug", kind: true }, { emoji: "🙈", name: "hide", kind: false }, { emoji: "🍕", name: "eat pizza", kind: false }] },
      { say: "There is one cookie left, and Viraj wants one too.", icons: ["🍪", "🤔"],
        options: [{ emoji: "🤝", name: "share it", kind: true }, { emoji: "🏃", name: "run away with it", kind: false }, { emoji: "🙈", name: "hide it", kind: false }] },
      { say: "Josh's friend's tower fell over.", icons: ["🧱", "💥"],
        options: [{ emoji: "🤲", name: "help build it again", kind: true }, { emoji: "😴", name: "take a nap", kind: false }, { emoji: "🦖", name: "play dinosaurs alone", kind: false }] },
      { say: "A new friend is standing all alone.", icons: ["🧍", "💭"],
        options: [{ emoji: "👋", name: "say hi and play together", kind: true }, { emoji: "🙈", name: "hide", kind: false }, { emoji: "🍕", name: "eat pizza", kind: false }] },
    ],

    // ---- 📅 Day Train (days of the week, in rainbow order) ----
    DAYS: [
      { name: "Sunday", abbr: "Sun", color: "#e23636" },
      { name: "Monday", abbr: "Mon", color: "#ff9f43" },
      { name: "Tuesday", abbr: "Tue", color: "#ffd24d" },
      { name: "Wednesday", abbr: "Wed", color: "#7be08a" },
      { name: "Thursday", abbr: "Thu", color: "#5ec8ff" },
      { name: "Friday", abbr: "Fri", color: "#7a5cd6" },
      { name: "Saturday", abbr: "Sat", color: "#ec4e9c" },
    ],

    // ---- 🌦️ Dress Me! (weather → the right gear, worn ON the friend) ----
    // `spot` places the gear on the portrait: hat = on the head, hand = beside
    // the body (held), over = floating above (an umbrella).
    WEATHERS: [
      { sky: "🌧️", name: "raining", say: "It's raining!", gear: "☂️", gearName: "umbrella", spot: "over" },
      { sky: "☀️", name: "sunny", say: "It's sunny!", gear: "🧢", gearName: "cap", spot: "hat" },
      { sky: "❄️", name: "snowing", say: "It's snowing!", gear: "🧤", gearName: "mittens", spot: "hand" },
    ],

    // ---- 🌈 Season Windows (which season does it belong to?) ----
    // Items are unique across seasons (truth-tabled) and name themselves.
    SEASONS: [
      { name: "Winter", icon: "❄️", tint: "#dff1ff", items: ["⛄", "🧣"] },
      { name: "Spring", icon: "🌸", tint: "#e8f8e0", items: ["🌷", "🐣"] },
      { name: "Summer", icon: "☀️", tint: "#fff3c9", items: ["🍉", "🍦"] },
      { name: "Fall", icon: "🍂", tint: "#ffe1c4", items: ["🎃", "🍁"] },
    ],

    // ---- Continents (Montessori colors + a signature animal that lives there) ----
    // A friendly, stylized world map (not exact coastlines). The animal sits on
    // its home continent so the picture is self-checking. Colors follow the
    // Montessori continent-map convention. Blobs use a 0 0 200 110 viewBox.
    // Each continent's signature animal must be ICONIC to ONE continent for a
    // preschooler, so "Animal Homes" (which shows the animal alone) never marks a
    // genuinely-true home wrong. Bison→N.America and hedgehog→Europe replace the
    // old eagle/deer, whose multi-continent ranges made a correct tap get bumped
    // (eagles + deer live across several of these continents). Panda/kangaroo/
    // llama/lion/penguin are each single-continent-iconic for a child.
    CONTINENTS: [
      { name: "North America", color: "#ff8c42", animal: "🦬", cx: 40, cy: 34, rx: 26, ry: 21 },
      { name: "South America", color: "#ff6fa5", animal: "🦙", cx: 60, cy: 83, rx: 15, ry: 22 },
      { name: "Europe", color: "#e0524f", animal: "🦔", cx: 104, cy: 30, rx: 13, ry: 11 },
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
      { id: "vehicles", icon: "🚦", items: ["🚗", "🚌", "🚒", "🚜", "🚲", "✈️", "🚁", "🚚"] },
      { id: "food", icon: "🍽️", items: ["🍎", "🍌", "🍓", "🍇", "🍊", "🍪", "🍕", "🥕"] },
      { id: "sky", icon: "🌌", items: ["⭐", "🌙", "☀️", "🌈", "☁️", "🌟"] },
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
    // 4-picture sets for the harder 4×4 Picture Squares tier (mastery-gated).
    SQUARE_QUADS: [
      ["🍎", "🍌", "🍓", "🍇"],
      ["🐶", "🐱", "🐰", "🐸"],
      ["⭐", "❤️", "🔵", "🟢"],
      ["🚗", "🚀", "🚌", "🚂"],
      ["☀️", "🌙", "🌈", "⚡"],
    ],
    // ---- Read & Do: first decodable sentences (read → tap the matching picture) ----
    // Each sentence is a few short, decodable/sight words ABOUT its `answer`
    // picture; `pics` are the 3 choices (answer + 2 distractors). The spoken
    // prompt reads the whole sentence (👂), so it's playable with sound off too.
    // Ground truth (answer really matches the sentence) is locked in content.test.
    SENTENCES: [
      { text: "the dog can run", answer: "🐶", pics: ["🐶", "🐱", "🐰"] },
      { text: "a cat is sad", answer: "🐱", pics: ["🐱", "🐶", "🐭"] },
      { text: "the sun is hot", answer: "☀️", pics: ["☀️", "🌙", "⭐"] },
      { text: "a big pig", answer: "🐷", pics: ["🐷", "🐔", "🐭"] },
      { text: "the bug is red", answer: "🐞", pics: ["🐞", "🦋", "🐝"] },
      { text: "a fish can swim", answer: "🐟", pics: ["🐟", "🐦", "🐸"] },
      { text: "the frog can hop", answer: "🐸", pics: ["🐸", "🐢", "🐍"] },
      { text: "a red bus", answer: "🚌", pics: ["🚌", "🚗", "🚂"] },
    ],
    // ---- Listen & Answer: hear a tiny story, tap who has the thing ----
    // Each story is 3 (character has object) pairs. The 👂 narrates it, but the
    // scene also SHOWS each pairing, so it's playable with sound off (look &
    // answer). Names (cn/on) drive the narration; the truth (who has what) is
    // locked in content.test — a story can never point to the wrong answer.
    LISTEN_STORIES: [
      { pairs: [{ c: "🐶", cn: "dog", o: "🦴", on: "bone" }, { c: "🐱", cn: "cat", o: "🐟", on: "fish" }, { c: "🐰", cn: "bunny", o: "🥕", on: "carrot" }] },
      { pairs: [{ c: "🐻", cn: "bear", o: "🍯", on: "honey" }, { c: "🐭", cn: "mouse", o: "🧀", on: "cheese" }, { c: "🐵", cn: "monkey", o: "🍌", on: "banana" }] },
      { pairs: [{ c: "🐧", cn: "penguin", o: "🐟", on: "fish" }, { c: "🦁", cn: "lion", o: "🥩", on: "meat" }, { c: "🐴", cn: "horse", o: "🍎", on: "apple" }] },
      { pairs: [{ c: "🧒", cn: "Josh", o: "⚽", on: "ball" }, { c: "👦", cn: "River", o: "🎈", on: "balloon" }, { c: "🧑", cn: "Viraj", o: "🚗", on: "car" }] },
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

    // ================= Road to 140 — Wave 1 content =================
    // Opposites: ONE direction per pair (prompt = a-emoji, answer = b-emoji) so a
    // distractor (another pair's b) can never be a valid opposite of the prompt
    // AND never equals the prompt emoji. Each concept appears in exactly one pair.
    OPPOSITE_PAIRS: [
      { a: "hot", ae: "🔥", b: "cold", be: "🧊" },
      { a: "big", ae: "🐘", b: "small", be: "🐭" },
      { a: "day", ae: "☀️", b: "night", be: "🌙" },
      { a: "up", ae: "⬆️", b: "down", be: "⬇️" },
      { a: "happy", ae: "😊", b: "sad", be: "😢" },
      { a: "open", ae: "📖", b: "closed", be: "📕" },
      { a: "wet", ae: "💧", b: "dry", be: "🏜️" },
      { a: "fast", ae: "🐆", b: "slow", be: "🐌" },
    ],
    // Tracks: each track TYPE appears once and each animal once, so the drawn
    // track uniquely identifies the answer among any 3 distinct-animal choices.
    TRACKS: [
      { track: "paw", animal: "🐶", name: "dog" },
      { track: "bird", animal: "🐦", name: "bird" },
      { track: "snake", animal: "🐍", name: "snake" },
      { track: "hoof", animal: "🐴", name: "horse" },
      { track: "web", animal: "🦆", name: "duck" },
      { track: "hop", animal: "🐰", name: "bunny" },
    ],
    // Animal sounds: sounds unique, animals unique (self-naming pictures). 🐑 is
    // fine here — both "sheep" and "lamb" say BAA, so the answer is unambiguous.
    ANIMAL_SOUNDS: [
      { sound: "MOO", animal: "🐮", name: "cow" },
      { sound: "WOOF", animal: "🐶", name: "dog" },
      { sound: "MEOW", animal: "🐱", name: "cat" },
      { sound: "QUACK", animal: "🦆", name: "duck" },
      { sound: "BAA", animal: "🐑", name: "sheep" },
      { sound: "OINK", animal: "🐷", name: "pig" },
    ],
    // Nocturnal sort (its own tile, distinct from the day/night SCENE sorter).
    NIGHT_DAY_SETS: [
      { name: "nightday", bins: [
        { label: "Night", emoji: "🌙", why: "Owls wake up when the moon comes out!", items: ["🦉", "🦇", "🦝"] },
        { label: "Day", emoji: "☀️", why: "These friends play when the sun is up!", items: ["🐓", "🐝", "🦋"] },
      ] },
    ],
    // Speed sort.
    FAST_SLOW_SETS: [
      { name: "fastslow", bins: [
        { label: "Fast", emoji: "💨", why: "A cheetah is the fastest runner of all!", items: ["🐆", "🚀", "🏎️", "⚡"] },
        { label: "Slow", emoji: "🐌", why: "A snail creeps along ever so slowly.", items: ["🐌", "🐢", "🦥", "🚶"] },
      ] },
    ],
    // Star Search distractor pool (space things that are NOT a star).
    STAR_POOL: ["🌙", "☁️", "🚀", "🛸", "🪐"],

    // ================= Road to 140 — Wave 2 content =================
    // Weight pairs (heavier listed FIRST). Kid-obvious only; no emoji in two pairs.
    WEIGHT_PAIRS: [
      { heavy: "🐘", heavyName: "elephant", light: "🐭", lightName: "mouse" },
      { heavy: "🐻", heavyName: "bear", light: "🐰", lightName: "bunny" },
      { heavy: "🚗", heavyName: "car", light: "🎈", lightName: "balloon" },
      { heavy: "🐋", heavyName: "whale", light: "🐟", lightName: "fish" },
      { heavy: "🪨", heavyName: "rock", light: "🍃", lightName: "leaf" },
      { heavy: "🐴", heavyName: "horse", light: "🐤", lightName: "chick" },
    ],
    // Shapes for Count the Sides (circle = 0 straight sides).
    SIDE_SHAPES: [
      { name: "triangle", sides: 3, svg: '<polygon points="50,8 92,88 8,88"/>' },
      { name: "square", sides: 4, svg: '<rect x="14" y="14" width="72" height="72"/>' },
      { name: "rectangle", sides: 4, svg: '<rect x="8" y="26" width="84" height="48"/>' },
      { name: "pentagon", sides: 5, svg: '<polygon points="50,6 92,38 76,90 24,90 8,38"/>' },
      { name: "hexagon", sides: 6, svg: '<polygon points="50,6 88,28 88,72 50,94 12,72 12,28"/>' },
      { name: "circle", sides: 0, svg: '<circle cx="50" cy="50" r="42"/>' },
    ],
    // Ending sounds: word's LAST letter, all final letters DISTINCT, self-naming.
    END_WORDS: [
      { emoji: "🚌", word: "bus", letter: "S" },
      { emoji: "🐱", word: "cat", letter: "T" },
      { emoji: "☀️", word: "sun", letter: "N" },
      { emoji: "🥤", word: "cup", letter: "P" },
      { emoji: "🐶", word: "dog", letter: "G" },
      { emoji: "⭐", word: "star", letter: "R" },
      { emoji: "🛏️", word: "bed", letter: "D" },
      { emoji: "🦊", word: "fox", letter: "X" },
    ],
    // Missing middle vowel of a pictured CVC word (the picture is control-of-error).
    VOWEL_WORDS: [
      { emoji: "🐱", word: "cat", vowel: "a" },
      { emoji: "🐶", word: "dog", vowel: "o" },
      { emoji: "☀️", word: "sun", vowel: "u" },
      { emoji: "🐷", word: "pig", vowel: "i" },
      { emoji: "🛏️", word: "bed", vowel: "e" },
      { emoji: "🎩", word: "hat", vowel: "a" },
      { emoji: "🕸️", word: "web", vowel: "e" },
      { emoji: "🐛", word: "bug", vowel: "u" },
    ],
    // Word families: 3 sets of two disjoint rimes; every picture self-names.
    WORD_FAMILIES: [
      { name: "at-og", bins: [
        { label: "-at", words: [{ emoji: "🐱", word: "cat" }, { emoji: "🎩", word: "hat" }, { emoji: "🦇", word: "bat" }] },
        { label: "-og", words: [{ emoji: "🐶", word: "dog" }, { emoji: "🪵", word: "log" }, { emoji: "🐸", word: "frog" }] },
      ] },
      { name: "en-ug", bins: [
        { label: "-en", words: [{ emoji: "🐔", word: "hen" }, { emoji: "🖊️", word: "pen" }, { emoji: "🔟", word: "ten" }] },
        { label: "-ug", words: [{ emoji: "🐛", word: "bug" }, { emoji: "☕", word: "mug" }] },
      ] },
      { name: "ed-un", bins: [
        { label: "-ed", words: [{ emoji: "🛏️", word: "bed" }, { emoji: "🔴", word: "red" }, { emoji: "🛷", word: "sled" }] },
        { label: "-un", words: [{ emoji: "☀️", word: "sun" }, { emoji: "🏃", word: "run" }] },
      ] },
    ],
    // Big/little letter concentration — upper/lower differ visibly; NO I or L
    // (their lowercase forms are the iOS confusable pair).
    LETTER_PAIR_POOL: ["A", "B", "D", "E", "G", "M", "N", "Q", "R", "T"],

    // ================= Road to 140 — Wave 3 content =================
    // Silly Stories: absurd animal+item combos. Animals and items are DISJOINT
    // sets (an item never doubles as an animal) so the composite card is clear.
    SILLY_SCENES: [
      { animal: "🐶", item: "🎩", say: "The dog wears a hat!" },
      { animal: "🐱", item: "👑", say: "The cat wears a crown!" },
      { animal: "🐸", item: "👟", say: "The frog wears a shoe!" },
      { animal: "🐷", item: "🎈", say: "The pig holds a balloon!" },
      { animal: "🐵", item: "🕶️", say: "The monkey wears sunglasses!" },
      { animal: "🐰", item: "☂️", say: "The bunny holds an umbrella!" },
    ],
    // Build the Sentence: short, spoken-supported, decodable-leaning; <= 5 words.
    BUILD_SENTENCES: [
      { emoji: "🐶💤", words: ["The", "dog", "naps"] },
      { emoji: "🐱🥛", words: ["The", "cat", "likes", "milk"] },
      { emoji: "☀️🔆", words: ["The", "sun", "is", "hot"] },
      { emoji: "🐸🦘", words: ["The", "frog", "can", "hop"] },
      { emoji: "🐦🎵", words: ["The", "bird", "can", "sing"] },
      { emoji: "🐟🌊", words: ["The", "fish", "can", "swim"] },
    ],
    // Mental rotation — ASYMMETRIC filled shapes only (a rotated symmetric shape
    // would be indistinguishable). Curated to exactly these four.
    SHAPES_ASYM: [
      { name: "arrow", svg: '<polygon points="8,38 58,38 58,20 92,50 58,80 58,62 8,62"/>' },
      { name: "flag", svg: '<polygon points="20,8 20,92 27,92 27,52 72,36 27,20 27,8"/>' },
      { name: "boot", svg: '<polygon points="30,8 55,8 55,60 88,60 88,88 30,88"/>' },
      { name: "bolt", svg: '<polygon points="56,6 24,52 46,52 36,94 80,40 56,40 70,6"/>' },
    ],
    // More-in-scene: two kinds counted against each other.
    SCENE_KINDS: [
      { a: "🐟", b: "🦆" }, { a: "⭐", b: "🌙" }, { a: "🚗", b: "🚌" }, { a: "🍎", b: "🍌" },
    ],
    // Little Detective: 6 UNIQUE kind×color cards, so a (kind + color) clue pair
    // always narrows to exactly one. Each emoji truly is that kind and color.
    CLUE_CARDS: [
      { kind: "animal", color: "red", emoji: "🐞" },
      { kind: "animal", color: "blue", emoji: "🐳" },
      { kind: "animal", color: "green", emoji: "🐸" },
      { kind: "vehicle", color: "red", emoji: "🚗" },
      { kind: "vehicle", color: "blue", emoji: "🚙" },
      { kind: "vehicle", color: "green", emoji: "🚜" },
    ],
    // Count the Blocks — single-height iso layouts (grid [col,row] cells).
    BLOCK_LAYOUTS: [
      [[0, 0], [1, 0], [2, 0]],
      [[0, 0], [1, 0], [2, 0], [3, 0]],
      [[0, 0], [1, 0], [0, 1], [1, 1]],
      [[0, 0], [1, 0], [2, 0], [0, 1]],
      [[0, 0], [0, 1], [0, 2]],
      [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1]],
      [[0, 0], [1, 0], [0, 1]],
      [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1]],
    ],

    // ================= Road to 140 — Wave 4 content =================
    // Who Eats This? — SIX iconic food↔animal pairs whose diets don't overlap in
    // kid-canon (rabbit-carrot, dog-bone, panda-bamboo, monkey-banana,
    // squirrel-acorn, mouse-cheese). `eaters` lists every plausible eater in the
    // pool so no distractor is ever also-correct (the alsoOk discipline).
    FOOD_EATERS: [
      { food: "🥕", say: "the carrot", answer: "🐰", eaters: ["🐰"] },
      { food: "🦴", say: "the bone", answer: "🐶", eaters: ["🐶"] },
      { food: "🎋", say: "the bamboo", answer: "🐼", eaters: ["🐼"] },
      { food: "🍌", say: "the banana", answer: "🐵", eaters: ["🐵"] },
      { food: "🌰", say: "the acorn", answer: "🐿️", eaters: ["🐿️"] },
      { food: "🧀", say: "the cheese", answer: "🐭", eaters: ["🐭"] },
    ],
    // Simon Says: Touch! — five zones on a JoshArt figure. x/y are CENTER
    // percentages of a 240×400 box; 80px zone buttons. Positions are chosen so
    // every pair is ≥14px apart at 320px (restated + checked in content.test.js).
    // hand sits left / tummy right at the same height so the two mid-body zones
    // never collide (a touch-the-part game — separation matters more than exact
    // anatomy).
    BODY_PARTS: [
      { key: "head", label: "head", emoji: "😀", x: 50, y: 12 },
      { key: "hand", label: "hand", emoji: "✋", x: 23, y: 38 },
      { key: "tummy", label: "tummy", emoji: "🎽", x: 73, y: 38 },
      { key: "knee", label: "knee", emoji: "🦵", x: 50, y: 66 },
      { key: "foot", label: "foot", emoji: "👣", x: 50, y: 90 },
    ],
    BODY_FIGURE_BOX: { w: 240, h: 400, dot: 80, minGap: 14 },
    // Team House Build — fixed 6-step build order, each with a spoken line.
    HOUSE_STEPS: [
      { emoji: "🟫", say: "the floor" },
      { emoji: "🧱", say: "a wall" },
      { emoji: "🪟", say: "a window" },
      { emoji: "🚪", say: "the door" },
      { emoji: "🔺", say: "the roof" },
      { emoji: "🚩", say: "a flag on top" },
    ],
    // Hello Around the World — each friend greets in a language from their
    // heritage (matches FRIENDS + the profile). The zh line uses the zh-CN voice.
    GREETINGS: [
      { name: "Josh", word: "Hello!", say: "Hello!" },
      { name: "River", word: "你好!", say: "你好", lang: "zh-CN" },
      { name: "Viraj", word: "Namaste!", say: "Namaste!" },
      { name: "Raegar", word: "Privet!", say: "Privet!" },
    ],
    // Grandma's Visit — hunt grandma's 3 things among Josh's toys (disjoint sets).
    GRANDMA_ITEMS: {
      targets: [
        { emoji: "🀄", say: "her mahjong tile" },
        { emoji: "🏮", say: "her red lantern" },
        { emoji: "🍵", say: "her cup of tea" },
      ],
      toys: ["🚗", "🧸", "⚽", "🎈", "🦖", "🚀"],
    },
  };

  if (typeof module !== "undefined" && module.exports) module.exports = CONTENT;
  else global.JoshContent = CONTENT;
})(typeof window !== "undefined" ? window : globalThis);
