// ALL editable content for Josh's Games lives here — words, emoji, colors, and
// config as plain data. This one file is the place a grown-up edits to change
// anything, and it works BOTH in the browser (sets window.JoshContent) and in
// Node tests (module.exports), so the tests assert the real content.
//
// Designed for a 4-year-old: emoji-first, zero reading required to play.

(function (global) {
  const CONTENT = {
    // Shown on the home screen (for the grown-up — Josh can't read yet).
    TITLE: "Josh's Games",

    // ---- "Say hi to the animals" toy ----
    // A big friendly animal to tap. `name` is spoken aloud (when sound is on)
    // and read by the grown-up; the emoji is what Josh sees.
    ANIMALS: [
      { emoji: "🐶", name: "Dog" },
      { emoji: "🐱", name: "Cat" },
      { emoji: "🐰", name: "Bunny" },
      { emoji: "🐻", name: "Bear" },
      { emoji: "🦁", name: "Lion" },
      { emoji: "🐸", name: "Frog" },
      { emoji: "🐷", name: "Pig" },
      { emoji: "🐵", name: "Monkey" },
      { emoji: "🐘", name: "Elephant" },
      { emoji: "🦊", name: "Fox" },
      { emoji: "🐧", name: "Penguin" },
      { emoji: "🦄", name: "Unicorn" },
      { emoji: "🐢", name: "Turtle" },
      { emoji: "🐝", name: "Bee" },
    ],

    // Happy little cheers shown after every tap. There are NO wrong answers, so
    // every one of these is encouraging — we celebrate everything.
    CHEERS: [
      "Yay! 🎉",
      "Hooray! 🌟",
      "Wheee! 🎈",
      "So fun! 💫",
      "Good job! 👏",
      "Woohoo! 🎊",
      "Amazing! 🌈",
      "Yippee! ✨",
    ],

    // Bright, high-contrast confetti colors for celebrations.
    CONFETTI_COLORS: ["#ff5e7e", "#ffd24d", "#5ec8ff", "#7be08a", "#c77dff", "#ffa64d"],
  };

  if (typeof module !== "undefined" && module.exports) module.exports = CONTENT;
  else global.JoshContent = CONTENT;
})(typeof window !== "undefined" ? window : globalThis);
