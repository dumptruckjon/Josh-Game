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
  };

  if (typeof module !== "undefined" && module.exports) module.exports = CONTENT;
  else global.JoshContent = CONTENT;
})(typeof window !== "undefined" ? window : globalThis);
