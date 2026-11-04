// 🎲 Game Night (PLAN_BOARD.md) — ALL content: the boxes on the shelf, their
// boards, the players, and every line the game says. The engine
// (board-logic.js) reads this; nothing here runs. Dual export, so the node
// tests read exactly what the page reads.
//
// The board games are luck games for a four-year-old and a friend (or the
// computer). Only the MECHANICS of the classics are borrowed — Snakes &
// Ladders (traditional), the colour-card trail of Candy Land and the spinner of
// Hi-Ho Cherry-O (trademarks), and the hundred chart —
// under our own names and art.

(function (global) {
  "use strict";

  // ---- The players --------------------------------------------------------
  // Josh is always seat 1. The other seat is a friend in the iPad (the
  // computer plays them, shown inside a little tablet frame) or a person here.
  // `face` is a JoshArt.friend spec name (content.js FRIENDS) or an emoji;
  // `colour` is the token's colour (a friend's own shirt colour), `say` the
  // name the voice uses.
  const JOSH = { id: "josh", face: "Josh", colour: "#e23636", say: "Josh" };
  const FRIENDS = [
    { id: "river", face: "River", colour: "#2bb3c0", say: "River" },
    { id: "raegar", face: "Raegar", colour: "#4caf6d", say: "Raegar" },
    { id: "viraj", face: "Viraj", colour: "#ff9f43", say: "Viraj" },
  ];
  // Who can sit beside him for real. Six, so the picker is an even 3 x 2.
  const PEOPLE = FRIENDS.concat([
    { id: "mom", emoji: "👩", colour: "#9a4fd6", say: "Mom" },
    { id: "dad", emoji: "👨", colour: "#2f6fe0", say: "Dad" },
    { id: "grandma", emoji: "👵", colour: "#c98a00", say: "Grandma" },
  ]);

  // ---- 🌈 Rainbow Trail's colours ---------------------------------------
  // A colour AND a shape on every square and every card, so the match reads in
  // any colour vision (the fort's lesson: hue was never what separated things,
  // shape was). Each shape's spoken name is part of the card's line.
  const COLOURS = [
    { id: "R", name: "red", shape: "heart", fill: "#e5394b" },
    { id: "B", name: "blue", shape: "circle", fill: "#2f7fe0" },
    { id: "Y", name: "yellow", shape: "star", fill: "#ffc21a" },
    { id: "G", name: "green", shape: "triangle", fill: "#22a352" },
    { id: "P", name: "purple", shape: "diamond", fill: "#9a4fd6" },
  ];

  // ---- 🐔 Hen House's farm animals ----------------------------------------
  // A square's animal and a spinner face are the same picture: spin a 🐄 and
  // the hen walks to the next 🐄. Four animals a four-year-old names at once,
  // each a different shape (never two that look alike), each said by name.
  const ANIMALS = [
    { id: "C", pic: "🐄", say: "cow" },
    { id: "P", pic: "🐖", say: "pig" },
    { id: "S", pic: "🐑", say: "sheep" },
    { id: "D", pic: "🐕", say: "dog" },
  ];

  // ---- 🧺 Picnic Lotto's foods -----------------------------------------------
  // Sixteen foods a four-year-old names at once, each a different SHAPE (never
  // two reds that look alike, never two round fruits side by side in his
  // eye): every blanket is six of them, and the two blankets never share one.
  const FOODS = [
    { id: "banana", pic: "🍌", say: "a banana" },
    { id: "strawberry", pic: "🍓", say: "a strawberry" },
    { id: "grapes", pic: "🍇", say: "some grapes" },
    { id: "watermelon", pic: "🍉", say: "a watermelon" },
    { id: "pizza", pic: "🍕", say: "a pizza" },
    { id: "cheese", pic: "🧀", say: "some cheese" },
    { id: "carrot", pic: "🥕", say: "a carrot" },
    { id: "cookie", pic: "🍪", say: "a cookie" },
    { id: "cupcake", pic: "🧁", say: "a cupcake" },
    { id: "donut", pic: "🍩", say: "a donut" },
    { id: "pretzel", pic: "🥨", say: "a pretzel" },
    { id: "corn", pic: "🌽", say: "some corn" },
    { id: "icecream", pic: "🍦", say: "an ice cream" },
    { id: "sandwich", pic: "🥪", say: "a sandwich" },
    { id: "broccoli", pic: "🥦", say: "some broccoli" },
    { id: "cherries", pic: "🍒", say: "some cherries" },
  ];

  // ---- 👀 Twin Spot's pictures --------------------------------------------
  // Thirteen pictures a four-year-old names at once, each a different shape
  // and colour, so two of them are never confused for one another.
  const SPOTS = [
    { id: "dog", pic: "🐶", say: "the dog" },
    { id: "cat", pic: "🐱", say: "the cat" },
    { id: "frog", pic: "🐸", say: "the frog" },
    { id: "lion", pic: "🦁", say: "the lion" },
    { id: "elephant", pic: "🐘", say: "the elephant" },
    { id: "apple", pic: "🍎", say: "the apple" },
    { id: "banana", pic: "🍌", say: "the banana" },
    { id: "car", pic: "🚗", say: "the car" },
    { id: "rocket", pic: "🚀", say: "the rocket" },
    { id: "ball", pic: "⚽", say: "the ball" },
    { id: "star", pic: "⭐", say: "the star" },
    { id: "flower", pic: "🌸", say: "the flower" },
    { id: "balloon", pic: "🎈", say: "the balloon" },
  ];

  // ---- 🧠 Peek-a-Pair's pictures -------------------------------------------
  // Twelve pictures that never look alike; a board uses four of them, twice.
  const PAIRS = [
    { id: "duck", pic: "🦆", say: "duck", two: "ducks" },
    { id: "pig", pic: "🐷", say: "pig", two: "pigs" },
    { id: "bear", pic: "🐻", say: "bear", two: "bears" },
    { id: "fish", pic: "🐟", say: "fish", two: "fish" },
    { id: "truck", pic: "🚚", say: "truck", two: "trucks" },
    { id: "boat", pic: "⛵", say: "boat", two: "boats" },
    { id: "cake", pic: "🎂", say: "cake", two: "cakes" },
    { id: "drum", pic: "🥁", say: "drum", two: "drums" },
    { id: "kite", pic: "🪁", say: "kite", two: "kites" },
    { id: "sun", pic: "🌻", say: "sunflower", two: "sunflowers" },
    { id: "car", pic: "🚒", say: "fire engine", two: "fire engines" },
    { id: "egg", pic: "🍳", say: "egg", two: "eggs" },
  ];

  // ---- The boards ---------------------------------------------------------
  // Squares are numbered 1..size and snake back and forth from the bottom left
  // (row 1 runs left to right, row 2 right to left, …), exactly like a real
  // Snakes & Ladders board. Tokens start ON square 1; reaching `size` is home.
  // No exact roll: overshoot is home.
  //
  // Moon Race jumps: a 🚀 booster carries you UP from its foot to its top; a
  // ☄️ comet slides you DOWN from its head to its tail and gives you a ⭐. The
  // no-lose laws (board-logic.test.js): a comet drops at most one row (never
  // more than `cols` squares), never starts in the first or top row, and no
  // jump ever lands on another jump's start.
  const BOARDS = [
    {
      id: "moon", box: "moon", game: "dice", name: "Moon Race",
      cols: 6, rows: 6, size: 36,
      jumps: [
        { from: 4, to: 15, kind: "boost" },
        { from: 11, to: 20, kind: "boost" },
        { from: 22, to: 29, kind: "boost" },
      ],
    },
    {
      id: "comet", box: "comet", game: "dice", name: "Comet Moon",
      cols: 6, rows: 6, size: 36,
      jumps: [
        { from: 3, to: 14, kind: "boost" },
        { from: 10, to: 21, kind: "boost" },
        { from: 19, to: 28, kind: "boost" },
        { from: 26, to: 33, kind: "boost" },
        { from: 17, to: 12, kind: "comet" },
        { from: 24, to: 18, kind: "comet" },
        { from: 30, to: 25, kind: "comet" },
      ],
    },
    {
      id: "rainbow", box: "rainbow", game: "cards", name: "Rainbow Trail",
      cols: 6, rows: 6, size: 36,
      // squares 2..35, one letter each (1 is the start, 36 the cake). Found by
      // a seeded search for the laws board-logic.test.js restates: no two
      // neighbours share a colour, every colour is never more than 7 squares
      // ahead (so one card is never a long wait), and each colour appears 6 or
      // 7 times.
      colours: "GYBRPGYPBRPGYBRPGYRBPGYRGYBPBRGYPB",
      // a picture card ZOOMS you forward to its landmark, or — behind you, in
      // a game's first cards — slides you back to it, as in Candy Land
      landmarks: [
        { at: 9, pic: "🦕", say: "Dino land" },
        { at: 19, pic: "🚀", say: "Rocket land" },
        { at: 28, pic: "🏰", say: "Castle land" },
      ],
    },
    {
      // 💯 Hundred Hop: a race down a real HUNDRED CHART (1 at the top left,
      // reading like a book, 100 at the bottom right — the Montessori hundred
      // board he has mastered). `layout: "chart"` is that reading order, so a
      // square straight BELOW is ten more. The die (`faces`) is three small
      // numbers and three TEN-BARS: a ten is one tap, straight down one row,
      // "ten more!". Landing on a tens square (`tens`) earns a ⭐ — counting by
      // tens. Each bag of six adds 36, so a game is about 17 rolls each.
      id: "hundred", box: "hundred", game: "dice", name: "Hundred Hop",
      cols: 10, rows: 10, size: 100, layout: "chart",
      faces: [1, 2, 3, 10, 10, 10], tens: true, jumps: [],
      lines: { home: "{n} made it to one hundred!", end: "You both made it to one hundred! High five!" },
    },
    {
      // 🐔 Hen House (the Count Your Chickens shape): CO-OP. One shared hen
      // walks the farm from the field (square 1, where the chicks wait) to the
      // hen house (36). Spin an animal, and the hen walks to the next square
      // with that animal — and every square she walks, one chick follows her
      // home, counted. So a spin's chicks are the squares between, and he
      // counts them hop by hop. From his third game a 🦊 fox joins the
      // spinner (`foxAfter`): it never hurts — one chick runs out to PLAY, and
      // every chick comes home at the end, so the count always ends at 35.
      // `animals`: squares 2..35, one letter each, found by a seeded search
      // for the laws board-logic.test.js restates (no two neighbours alike,
      // no ABAB, every animal never more than 6 squares ahead, 8 or 9 of each).
      id: "hen", box: "hen", game: "hen", name: "Hen House", coop: true,
      cols: 6, rows: 6, size: 36,
      animals: "SDPCSPDCPDSCDPCSPDSCDSPDCSCDPSCPCD",
    },
    {
      // 🧺 Picnic Lotto (picture lotto): each player's picnic BLANKET shows six
      // foods, and the two blankets never share one. One basket holds all
      // twelve; on your turn you take one out, and then find WHOSE blanket it
      // goes on — yours, or your friend's ("A banana! Whose is it?") — and
      // tap that player's pad. A wrong guess only wiggles; after two, the
      // spot glows. Both blankets fill (twelve foods, six turns each) and the
      // picnic is ONE party. `spots` is a blanket's size; the picture is two
      // blankets side by side, each two across and three down, over the two
      // pads that own them.
      id: "lotto", box: "lotto", game: "lotto", name: "Picnic Lotto", coop: true,
      cols: 4.4, rows: 3.3, size: 6, spots: 6,
      lines: { home: "{n}'s blanket is full!", end: "Both blankets are full! Picnic time!" },
    },
    {
      // 👀 Twin Spot (the Spot It shape, a trademark: only the mechanic is
      // borrowed). Thirteen cards of four pictures, and ANY two cards share
      // exactly ONE picture — the order-3 projective plane, each `deck` entry
      // a card's four picture indexes into SPOTS (a guardrail proves every
      // pair shares exactly one). One card lies in the middle; on your turn
      // you flip the next one and find the ONE picture on both — no race, no
      // clock, take turns. A wrong picture only wiggles; after two, the twin
      // glows on both cards. Found, your card becomes the middle one and goes
      // on your pile; twelve flips, one party.
      id: "spot", box: "spot", game: "spot", name: "Twin Spot", coop: true,
      cols: 4.4, rows: 2.2, size: 12,
      deck: [[0, 3, 6, 9], [1, 4, 7, 9], [2, 5, 8, 9], [0, 4, 8, 10], [1, 5, 6, 10], [2, 3, 7, 10], [0, 5, 7, 11], [1, 3, 8, 11], [2, 4, 6, 11], [0, 1, 2, 12], [3, 4, 5, 12], [6, 7, 8, 12], [9, 10, 11, 12]],
      lines: { home: "", end: "All the twins are found! High five!" },
    },
    {
      // 🧠 Peek-a-Pair (memory, the classic Concentration — a game of SKILL a
      // four-year-old is often better at than his grown-up). Nine cards face
      // down, three by three: four PAIRS and one ⭐. On your turn flip two:
      // a pair is yours and you go again; not a pair and they turn back over
      // (look hard!) and it is your friend's turn. The ⭐ is a free star and
      // another go. A cleared board deals a SECOND (`boards`), so a game is
      // eight pairs. Nine, not twelve: three rows of 75px cards is what a
      // 320x568 phone's field holds.
      id: "pairs", box: "pairs", game: "pairs", name: "Peek-a-Pair", coop: true,
      cols: 3, rows: 3, size: 9, boards: 2, pairsPer: 4,
      lines: { home: "", end: "Every pair is found! What a memory!" },
    },
    {
      // 🍎 Apple Spin (Hi-Ho Cherry-O's mechanic): no track at all. Each
      // player fills their own TEN-FRAME basket from a big tree; `size` is the
      // basket. A spin says how many apples to pick (one tap, one apple); a
      // full basket's spare apples go into the shared pie, and the one who
      // fills first helps fill the friend's basket. `spinner` is each player's
      // fair bag (small numbers, so he sees them at a glance); from his third
      // Apple game a silly 🐦 joins it (`bird`, the comet's gentle cousin).
      id: "apple", box: "apple", game: "spin", name: "Apple Spin",
      cols: 6, rows: 6, size: 10,
      spinner: [1, 1, 2, 2, 3, 4],
    },
  ];

  // ---- The shelf: one box per game, in order ------------------------------
  // `unlockAfter`: the box appears once this many games of another box are
  // finished (Comet Moon's slides arrive only from his THIRD Moon game, the
  // owner's decision 6). A box that is not there yet is simply not on the
  // shelf — never a padlock.
  const BOXES = [
    { id: "moon", board: "moon", name: "Moon Race", pic: "🚀", colour: "#3b4cc0" },
    { id: "comet", board: "comet", name: "Comet Moon", pic: "☄️", colour: "#6a3fb8", unlockAfter: { box: "moon", games: 2 } },
    { id: "rainbow", board: "rainbow", name: "Rainbow Trail", pic: "🌈", colour: "#e0569b" },
    // the 🐦 joins from his THIRD Apple game, exactly as the comets do
    { id: "apple", board: "apple", name: "Apple Spin", pic: "🍎", colour: "#d63b3b", birdsAfter: 2 },
    { id: "hundred", board: "hundred", name: "Hundred Hop", pic: "💯", colour: "#e08a00" },
    // the 🦊 joins from his THIRD Hen House game, exactly as the comets do
    { id: "hen", board: "hen", name: "Hen House", pic: "🐔", colour: "#c2410c", foxAfter: 2 },
    // the THINKING games (`kind: "think"`) stand on their own shelf: games of
    // finding, remembering and choosing, not only of luck
    { id: "lotto", board: "lotto", name: "Picnic Lotto", pic: "🧺", colour: "#2f9e6e", kind: "think" },
    { id: "spot", board: "spot", name: "Twin Spot", pic: "👀", colour: "#7c3aed", kind: "think" },
    { id: "pairs", board: "pairs", name: "Peek-a-Pair", pic: "🧠", colour: "#db2777", kind: "think" },
  ];

  // ---- Every line the game says ------------------------------------------
  // `{n}` is a player's spoken name, `{to}` a square number. Never a picture
  // (a voice reads an emoji as silence or as its name), and never the words a
  // race uses for the one behind (a guardrail greps this table).
  const SAY = {
    shelf: "Pick a game!",
    who: "Who's playing with you?",
    cpu: "Play with a friend in the iPad!",
    here: "A friend is here with me!",
    turn: "{n}'s turn!",
    rollFirst: "Tap your dice!",
    hopFirst: "Tap to hop! One tap, one hop.",
    flipFirst: "Tap to flip a card!",
    boost: "Blast off! Up to {to}!",
    comet: "Wheee! Down to {to}. A star for you!",
    homeMoon: "{n} made it to the Moon!",
    homeTrail: "{n} made it to the party!",
    helper: "Now {n} helps {m}!",
    endMoon: "You both made it to the Moon! High five!",
    endTrail: "You both made it to the party! Hooray!",
    notYet: "It's {n}'s turn. You're next!",
    cpuCheer: "Whoa, {n}!",
    card: "{c} {s}!",
    cardTwo: "Two {c} {s}s!",
    cardPic: "{p}! Zoom!",
    cardBack: "{p}! Whoosh, back to {p}!",
    cardPicGo: "{p}!",
    keepGoing: "Keep playing!",
    spinFirst: "Tap to spin!",
    pickFirst: "Tap to pick! One tap, one apple.",
    full: "{n}'s basket is full! Ten apples!",
    pie: "{k} more for the pie!",
    bird: "Tweet! A silly bird put one back. {to} in the basket.",
    endApple: "Ten, twenty! {k} apples in the pie! Yum!",
    tenFirst: "Tap once for ten more!",
    henSpin: "A {a}! Walk to the {a}!",
    henFirst: "Tap to walk! One tap, one chick.",
    fox: "Oh! A fox wants to play. One chick ran out to play!",
    henHome: "The hen is home! Here come the chicks who were playing!",
    endHen: "All {k} chicks are home! We did it together!",
    basketFirst: "Tap the basket!",
    whose: "{f}! Whose is it?",
    whoseFirst: "Tap the friend whose blanket has it!",
    giveMine: "{f} for {n}!",
    lookAgain: "Look again! Where is {f}?",
    endLotto: "Both blankets are full! Picnic time!",
    flipFirst2: "Tap to flip a card!",
    findTwin: "Find the picture on BOTH cards!",
    foundTwin: "Yes! {s}!",
    notTwin: "Look again! Is it on both cards?",
    pairsFirst: "Tap two cards!",
    pairYes: "Two {p}! A pair! Go again!",
    pairNo: "Not a pair. Remember where they are!",
    pairStar: "A star! Go again!",
    pairsNew: "A new board!",
    ten: "{to}! Ten more!",
    tens: "{to}! A star!",
  };

  const BoardData = { JOSH, FRIENDS, PEOPLE, COLOURS, ANIMALS, FOODS, SPOTS, PAIRS, BOARDS, BOXES, SAY };
  BoardData.spot = (k) => SPOTS[k] || null;
  BoardData.pairPic = (id) => PAIRS.find((p) => p.id === id) || null;
  BoardData.food = (id) => FOODS.find((f) => f.id === id) || null;
  BoardData.animal = (id) => ANIMALS.find((a) => a.id === id) || null;
  BoardData.board = (id) => BOARDS.find((b) => b.id === id) || null;
  BoardData.box = (id) => BOXES.find((b) => b.id === id) || null;
  BoardData.person = (id) => (id === "josh" ? JOSH : PEOPLE.find((p) => p.id === id) || null);
  BoardData.colour = (id) => COLOURS.find((c) => c.id === id) || null;

  global.BoardData = BoardData;
  if (typeof module !== "undefined" && module.exports) module.exports = BoardData;
})(typeof window !== "undefined" ? window : globalThis);
