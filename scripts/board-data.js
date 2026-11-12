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
  // Each friend in the iPad plays their OWN way (PLAN_BOARD.md §18): `sharp`
  // is how often they see the clever move (0.5 is each game's own level — see
  // board-logic.js sharpOf), `tag` a word for the grown-up under their face,
  // and `oops` what they say of their own slip (lightly: how to take one is
  // shown, not told). The luck is the same fair luck for all three.
  const FRIENDS = [
    { id: "river", face: "River", colour: "#2bb3c0", say: "River", sharp: 0.65, tag: "careful", oops: "Hmm! I missed that one." },
    { id: "raegar", face: "Raegar", colour: "#4caf6d", say: "Raegar", sharp: 0.35, tag: "playful", oops: "Oops! Silly me!" },
    { id: "viraj", face: "Viraj", colour: "#ff9f43", say: "Viraj", sharp: 0.5, tag: "steady", oops: "Oh well! Next time." },
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
  // more than `cols` squares), never starts in the first or top row, no jump
  // ever lands on another jump's start, and no two jumps' lines CROSS (a board
  // of crossing lines is a tangle a four-year-old cannot follow).
  const BOARDS = [
    {
      id: "moon", box: "moon", game: "dice", name: "Moon Race",
      cols: 6, rows: 6, size: 36,
      jumps: [
        { from: 4, to: 15, kind: "boost" },
        { from: 12, to: 23, kind: "boost" },
        { from: 22, to: 29, kind: "boost" },
      ],
    },
    {
      // 🎲 Pick a Die (a dice race with a CHOICE): roll TWO dice, see the
      // square each would take you to light up, and pick one. Five rockets, so
      // two dice can often reach one: the skill is picking the die that lands
      // on a rocket. Boosters only (his Moon Race rules), no comets.
      id: "pickdie", box: "pickdie", game: "dice", name: "Pick a Die", two: true,
      cols: 6, rows: 6, size: 36,
      jumps: [
        { from: 3, to: 13, kind: "boost" },
        { from: 8, to: 16, kind: "boost" },
        { from: 15, to: 23, kind: "boost" },
        { from: 21, to: 29, kind: "boost" },
        { from: 26, to: 34, kind: "boost" },
      ],
    },
    {
      // 🔭 Moon Call (Moon Race's level two, §18): roll, and BEFORE hopping,
      // call where the hops will end — three numbers to pick from, the right
      // one and two near misses. A right call is a ⭐ and the rocket hops by
      // itself; a miss costs nothing: he hops and counts, and the count shows
      // the answer. Counting ON in his head is the skill.
      id: "call", box: "call", game: "dice", name: "Moon Call", call: true,
      cols: 6, rows: 6, size: 36,
      jumps: [
        { from: 7, to: 17, kind: "boost" },
        { from: 12, to: 21, kind: "boost" },
        { from: 20, to: 28, kind: "boost" },
      ],
    },
    {
      id: "comet", box: "comet", game: "dice", name: "Comet Moon",
      cols: 6, rows: 6, size: 36,
      jumps: [
        // (each comet drops straight DOWN one row, so it never sweeps across
        // the board; the boosters climb the two sides: no line crosses another)
        { from: 2, to: 13, kind: "boost" },
        { from: 6, to: 18, kind: "boost" },
        { from: 19, to: 30, kind: "boost" },
        { from: 23, to: 34, kind: "boost" },
        { from: 15, to: 10, kind: "comet" },
        { from: 21, to: 16, kind: "comet" },
        { from: 27, to: 22, kind: "comet" },
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
      // 🌈 Rainbow Pick (Rainbow Trail's level two, §18): flip TWO cards, see
      // where each would take you (both squares light up, wearing the card),
      // and play one. The other waits at the back of your pile. The trail is
      // Rainbow Trail's own, so the colours are the ones he already knows.
      id: "rainbow2", box: "rainbow2", game: "cards", name: "Rainbow Pick", pick2: true,
      cols: 6, rows: 6, size: 36,
      colours: "GYBRPGYPBRPGYBRPGYRBPGYRGYBPBRGYPB",
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
      // 🐸 Hop by Twos and 🦘 Hop by Fives (PLAN_BOARD.md §18): SKIP COUNTING,
      // his working edge. Twenty pads from 0; the die is how many HOPS (1, 2
      // or 3) and every hop is `step` more, said and popped as he taps: "2,
      // 4, 6!". A square's number is (n - 1) × step (board-logic.js labelOf),
      // so his token is only ever ON a number of the count. `starAt`: the
      // numbers a turn may END on for a ⭐. `art` is the board's look.
      id: "twos", box: "twos", game: "dice", name: "Hop by Twos",
      cols: 3, rows: 7, size: 21, step: 2, faces: [1, 1, 2, 2, 3, 3], starAt: [10, 20, 30], jumps: [], art: "pond",
      lines: { home: "{n} hopped all the way to forty!", end: "You both counted by twos to forty! High five!", hop: "Tap to hop! Every hop is two more." },
    },
    {
      id: "fives", box: "fives", game: "dice", name: "Hop by Fives",
      cols: 3, rows: 7, size: 21, step: 5, faces: [1, 1, 2, 2, 3, 3], starAt: [50], jumps: [], art: "sand",
      lines: { home: "{n} hopped all the way to one hundred!", end: "You both counted by fives to one hundred! High five!", hop: "Tap to hop! Every hop is five more." },
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
      // 🚪 Shut the Doors (shut-the-box, for a four-year-old: a game of
      // NUMBER BONDS). Each player has six doors, 1 to 6. Roll the die, then
      // shut the door with that number — or TWO doors that make it (5 is 4
      // and 1, or 3 and 2): two at once is a ⭐. No door fits? Roll again,
      // so every turn shuts a door. First to shut all six helps the other, so
      // it ends with every door shut and one party. The choice is the skill:
      // two small doors now can leave a roll that fits nothing later.
      id: "doors", box: "doors", game: "doors", name: "Shut the Doors",
      cols: 3, rows: 2, size: 6,
      lines: { home: "{n} shut every door!", end: "Every door is shut! Hooray!" },
    },
    {
      // 🚪 Doors to Nine (Shut the Doors' level two, §18): nine doors, 1 to
      // 9, and TWO dice — 11 is 9 and 2, or 5 and 6 — until 7, 8 and 9 are
      // shut, then one die, as in the classic box, so the last small doors
      // can always be made. More ways to make each roll: more to choose.
      id: "doors9", box: "doors9", game: "doors", name: "Doors to Nine",
      cols: 3, rows: 3, size: 9,
      lines: { home: "{n} shut every door!", end: "Every door is shut! Hooray!" },
    },
    {
      // 🌰 Acorn Pots (mancala, for a four-year-old — the bean emoji is Emoji 14.0,
      // invisible on his iPad, so the seeds are acorns and the store is a
      // squirrel's NEST). Each player has three pots of three acorns and a
      // nest. Tap one of your pots: its acorns go one by one into the next
      // pots round the board (yours, your nest, then your friend's pots —
      // never your friend's nest). The LAST acorn in your own nest is a ⭐
      // and you go again: the skill is counting how far each pot is from the
      // nest. When a side runs out, the acorns left go to their own nests.
      // Co-op: one party, and every acorn ends in a nest.
      id: "acorns", box: "acorns", game: "acorns", name: "Acorn Pots", coop: true,
      cols: 2, rows: 5, pots: 3, start: 3, size: 18,
      lines: { home: "", end: "Every acorn is in a nest! Hooray!" },
    },
    {
      // 🁢 Dot Dominoes: fifteen tiles, every pair of 1 to 5 dots once (no
      // blanks: a four-year-old matches DOTS). One tile starts the line; each
      // player holds four, face up, and six wait in the pile. On your turn lay
      // a tile whose dots match an open end of the line (it goes on by
      // itself); a double is a ⭐. Nothing matches? Take one from the pile.
      // Nothing matches and the pile is empty: your friend goes on. Co-op:
      // the line is finished when every tile is laid (or nobody can lay
      // one), and there is one party. The skill is WHICH tile: keep the ones
      // that match each other.
      id: "dominoes", box: "dominoes", game: "dominoes", name: "Dot Dominoes", coop: true,
      cols: 4, rows: 4, max: 5, hand: 4, size: 15,
      lines: { home: "", end: "The line is finished! What a long line!" },
    },
    {
      // 🁢 Six-Dot Dominoes (Dot Dominoes' level two, §18): every pair of 1 to
      // SIX dots, twenty-one tiles — six dots is the most a die shows, and a
      // longer line means more ends to choose between.
      id: "dominoes6", box: "dominoes6", game: "dominoes", name: "Six-Dot Dominoes", coop: true,
      cols: 4, rows: 4, max: 6, hand: 4, size: 21,
      lines: { home: "", end: "The line is finished! What a long line!" },
    },
    {
      // 🏴‍☠️ Treasure Dig (co-op, a game of REASONING): a treasure is buried
      // under one of nine sand squares. Take turns digging one; a square
      // without it shows an ARROW pointing toward it, so the next dig is
      // worked out, not guessed — and the arrows his friend dug count too.
      // Whoever finds it gets the ⭐ and a new treasure is buried; four
      // treasures, one party.
      id: "dig", box: "dig", game: "dig", name: "Treasure Dig", coop: true,
      cols: 3, rows: 3, treasures: 4, size: 4,
      lines: { home: "", end: "Every treasure is found! Hooray!" },
    },
    {
      // 🍪 Cookie Jar (Nim, for a four-year-old: a game of PLANNING). A jar of
      // cookies; on your turn take ONE, TWO or THREE. The LAST cookie in the
      // jar is the golden one, and whoever takes it gets the ⭐. Then the next
      // jar is opened; four jars, so both players eat plenty and there is one
      // party. The skill: leave your friend FOUR (or eight) — whatever they
      // take then, the golden one is yours. `take` is the most a turn takes.
      id: "cookies", box: "cookies", game: "nim", name: "Cookie Jar", coop: true,
      cols: 3, rows: 3, jars: [7, 9, 6, 10], take: 3, size: 32,
      lines: { home: "", end: "Every jar is empty! Yum!" },
    },
    {
      // 🔴 Line Up (connect three, for a four-year-old: a game of LINES).
      // Three columns, four high: tap a column and your counter drops to the
      // bottom of it. Three of yours in a row — across, up, or slanting — is a
      // ⭐ (every new line counts, so one counter can make two). The board
      // fills, a fresh one is set up, and after two boards there is one party.
      // The skill: make a line, and stop your friend's. Three columns, because
      // four 75px columns and their gaps are wider than a 320px phone; five
      // high (a tall board is a portrait board): measured, five rows give 5.5
      // ⭐s a game against four rows' 3.5, with the same edge for looking.
      // `size` is each player's drops in all (every cell of both boards).
      id: "lineup", box: "lineup", game: "lines", name: "Line Up", coop: true,
      cols: 3, rows: 5, boards: 2, size: 15,
      lines: { home: "", end: "Both boards are full! What lines!" },
    },
    {
      // 🃏 Top Card (a trick game, for a four-year-old: a game of BIGGER and of
      // SAVING). Each player has their own ten cards, 1 to 10, and holds three
      // face up. The leader plays one; the other answers with one of theirs:
      // the bigger card wins the trick and a ⭐ (the same number: nobody's).
      // Both take a card back up to three, the lead goes to the other player,
      // and after ten tricks there is one party. The skill: beat it with the
      // SMALLEST card that does, and when you cannot, give your smallest —
      // keep the big ones for when they count.
      id: "topcard", box: "topcard", game: "top", name: "Top Card", coop: true,
      cols: 3, rows: 3, deck: 10, hand: 3, size: 10,
      lines: { home: "", end: "Every card is played! What a game!" },
    },
    {
      // 🔟 Teen Top Card (Top Card's level two, §18): each player's ten cards
      // are 11 to 20, a full ten-frame and some more, so the cards to beat
      // all start with the same ten and the ONES decide the trick.
      id: "topteen", box: "topteen", game: "top", name: "Teen Top Card", coop: true,
      cols: 3, rows: 3, deck: 10, low: 11, hand: 3, size: 10,
      lines: { home: "", end: "Every card is played! What a game!" },
    },
    {
      // 🎨 Colour Grab (a territory game, for a four-year-old: a game of
      // LOOKING AHEAD). A grid of colours (each with its shape, so it reads in
      // any colour vision). Josh starts in the bottom left corner and his
      // friend in the top right. Pick a colour: your patch turns that colour
      // and swallows every touching square of it. Never your own colour or
      // your friend's, so it is a choice of three. A grab of `big` squares or
      // more is a ⭐; every square grabbed, one party. The skill: pick the
      // colour that grabs the most.
      id: "grab", box: "grab", game: "grab", name: "Colour Grab", coop: true,
      cols: 6, rows: 7, big: 4, size: 42,
      lines: { home: "", end: "Every square is grabbed! What a picture!" },
    },
    {
      // 🎲 Dice Match (keep or roll again, for a four-year-old: a game of
      // MATCHING). Roll three dice, then twice: tap the dice to KEEP and roll
      // the rest again. Two the same is a ⭐; all three the same is three ⭐s.
      // Five turns each, one party. The skill: keep the ones that match.
      id: "dicematch", box: "dicematch", game: "match3", name: "Dice Match", coop: true,
      cols: 3, rows: 3, rounds: 5, rerolls: 2, size: 9,
      lines: { home: "", end: "Every turn is rolled! What dice!" },
    },
    {
      // 🎲 Dice Run (Dice Match's level two, §18): three in a row — 2, 3, 4,
      // in any order — is two ⭐s, so a roll can chase a pair or a run, and
      // which to keep becomes a real choice.
      id: "dicerun", box: "dicerun", game: "match3", name: "Dice Run", coop: true, run: true,
      cols: 3, rows: 3, rounds: 5, rerolls: 2, size: 9,
      lines: { home: "", end: "Every turn is rolled! What dice!" },
    },
    {
      // 🐭 Mouse Maze: a mouse EACH in a garden of plant pots, and one piece
      // of cheese. Each player holds three ARROW cards (up, down, left or
      // right, one step or two); play one and your mouse scurries that way.
      // Whoever's mouse reaches the cheese gets the ⭐, and new cheese appears
      // about as far from both. (One shared mouse was built first and
      // measured: the friend's arrow undid his, a median 39 turns, and the
      // skill was worth only 51% of the cheese.)
      // Five cheeses, one party. The skill: which arrow takes it there.
      id: "maze", box: "maze", game: "maze", name: "Mouse Maze", coop: true,
      cols: 4, rows: 5, pots: 3, cheese: 5, hand: 3, size: 20,
      lines: { home: "", end: "Every cheese is found! Squeak!" },
    },
    {
      // 🐭 Twisty Maze (Mouse Maze's level two, §18): eight more arrow cards,
      // each a TURN — a step one way, then a step another — so getting round
      // a pot can be one card, if he sees it.
      id: "maze2", box: "maze2", game: "maze", name: "Twisty Maze", coop: true, turns: true,
      cols: 4, rows: 5, pots: 3, cheese: 5, hand: 3, size: 20,
      lines: { home: "", end: "Every cheese is found! Squeak!" },
    },
    {
      // 🕵️ Who's Hiding (Guess Who, together, for a four-year-old: a game of
      // RULING OUT). Nine friends on the board: a dog, a cat or a bunny, in a
      // red, blue or yellow shirt, some in a hat. One of them is hiding. On
      // your turn ask one of three questions ("Is it a cat?", "Is it red?",
      // "Does it have a hat?"); the answer puts down everyone it rules out.
      // Leave just one standing and you found them: a ⭐, and somebody new
      // hides. Four hiders, one party. The skill: ask the question that puts
      // the most down — and never ask about a cat when no cat is left.
      // (Measured: dealing only questions that rule someone out left the
      // skill worth 56% of the finds; with a useless one possible, 61%.)
      id: "hide", box: "hide", game: "hide", name: "Who's Hiding", coop: true,
      cols: 3, rows: 3, rounds: 4, ask: 3, size: 9,
      lines: { home: "", end: "Everybody is found! Peekaboo!" },
    },
    {
      // 🌈 Colour Match (a matching card game, for a four-year-old: a game of
      // SAME COLOUR OR SAME NUMBER). Each player holds three cards; a card is
      // one to five shapes in its colour (three red hearts). Play a card that
      // matches the card on top — its colour or its number. Nothing matches:
      // turn a new card over onto the pile. Whoever plays their last card gets the ⭐ and
      // new cards are dealt; three rounds, one party. (Measured: which
      // matching card you play barely changes who empties first, so this is
      // a game of LOOKING — seeing that three blue is like three red — not of
      // choosing.)
      id: "colourmatch", box: "colourmatch", game: "cmatch", name: "Colour Match", coop: true,
      cols: 3, rows: 3, hand: 3, rounds: 3, size: 3,
      lines: { home: "", end: "Every card is played! What colours!" },
    },
    {
      // 🔢 Number Bingo (for a four-year-old: a game of KNOWING THE NUMBER
      // ON THE DIE). Each player has their own card of nine squares holding
      // the numbers 1 to 6. Roll the die and tap that number on your card to
      // cover it; not on your card this time, the turn passes. A row, a
      // column or a corner-to-corner line covered is a ⭐. A full card shouts
      // BINGO, and its owner's rolls then help fill the friend's card, so the
      // game ends with both cards full and one party.
      id: "bingo", box: "bingo", game: "bingo", name: "Number Bingo",
      cols: 3, rows: 3, size: 9,
      lines: { home: "", end: "Both cards are full! Bingo!" },
    },
    {
      // ➕ Sum Bingo (Number Bingo's level two, §18): roll TWO little dice of
      // one to three dots, count ALL the dots, and cover that number. The card
      // holds 2 to 6, its squares wearing their dots too, so counting all is
      // enough: adding is his working edge.
      id: "sums", box: "sums", game: "bingo", name: "Sum Bingo", sums: true,
      cols: 3, rows: 3, size: 9,
      lines: { home: "", end: "Both cards are full! You added it all up! Bingo!" },
    },
    {
      // ⛄ Snowman Build (a building game, for a four-year-old: a game of
      // WHAT COMES FIRST). Each snowman starts as a big snowball. A picture
      // die of snowman parts — the tummy, the head, a hat, a carrot nose, a
      // scarf, and ❄️ magic snow (any part!). Roll it and tap your
      // snowman to put the part on; a part you have, or one that cannot go on
      // yet (a head with no tummy), and the turn passes. A whole snowman is a
      // ⭐, and its builder's rolls then help build the friend's, so the game
      // ends with two snowmen and one party.
      id: "snowman", box: "snowman", game: "snow", name: "Snowman Build",
      cols: 3, rows: 3, size: 6,
      lines: { home: "", end: "Two snowmen! Brrr, what a pair!" },
    },
    {
      // 🐟 Go Fish (pairs, both hands face up: for a four-year-old, a game of
      // SPOTTING THE SAME). Ten fish-pond pictures, two of each; five cards
      // each. Tap a card to ask your friend for that picture: they have it,
      // they give it (a pair, a ⭐, ask again); they do not, "Go fish!" — one
      // from the pond, and the turn passes. When the computer asks him, HE
      // finds the picture in his hand and gives it (or taps Go fish). Every
      // pair made, one party. The skill: ask for a picture you BOTH have.
      id: "gofish", box: "gofish", game: "fish", name: "Go Fish", coop: true,
      cols: 3, rows: 3, hand: 5, size: 10,
      lines: { home: "", end: "Every pair is made! What a catch!" },
    },
    {
      // 🍯 Honey Ten (making ten, for a four-year-old: a game of NUMBER BONDS
      // he can SEE). Eighteen flowers, 1 to 9 twice, nine in the meadow, each
      // a ten-frame of dots. Tap a flower — its ten-frame shows how many more
      // make ten — then the one that makes ten with it: a jar of honey, a ⭐,
      // and new flowers. Not ten: the two are said ("7 and 2 make 9") and
      // the turn passes. There is always a ten to find; every ten made, one
      // party.
      id: "honeyten", box: "honeyten", game: "ten", name: "Honey Ten", coop: true,
      cols: 3, rows: 3, size: 9,
      lines: { home: "", end: "Every ten is made! Buzz buzz!" },
    },
    {
      // 🍯 Honey Twenty (Honey Ten's level two, §18): the flowers are 1 to 9
      // and 11 to 19, once each, drawn as TWO ten-frames, and two make
      // TWENTY — so every twenty is a teen and its little one (13 and 7: ten,
      // and three and seven make the other ten).
      id: "honey20", box: "honey20", game: "ten", name: "Honey Twenty", coop: true, target: 20,
      cols: 3, rows: 3, size: 9,
      lines: { home: "", end: "Every twenty is made! Buzz buzz!" },
    },
    {
      // 🔼 Higher or Lower (a guessing card game, for a four-year-old: a game
      // of BIGGER AND SMALLER). One card of 1 to 10 is turned up. Will the next
      // be bigger or smaller? Tap ⬆️ or ⬇️ and turn it over: right is a ⭐, and
      // it becomes the card to beat for your friend. Twelve cards, one party.
      // The skill: a small card, guess bigger; a big card, guess smaller.
      id: "hilo", box: "hilo", game: "hilo", name: "Higher or Lower", coop: true,
      cols: 3, rows: 3, flips: 12, size: 12,
      lines: { home: "", end: "Every card is turned! What guesses!" },
    },
    {
      // 🚂 Pattern Train (for a four-year-old: a game of WHAT COMES NEXT). A
      // train of colour cars in a pattern — red, blue, red, blue, red… — and
      // the next car missing. Three cars wait at the station: tap the one that
      // carries the pattern on, a ⭐, and a new train pulls in. Another car
      // breaks the pattern: the turn passes, and the same train waits for the
      // friend. Eight trains, the patterns growing; one party.
      id: "train", box: "train", game: "train", name: "Pattern Train", coop: true,
      cols: 3, rows: 3, trains: 8, size: 8,
      lines: { home: "", end: "Every train is finished! Choo choo!" },
    },
    {
      // 🚂 Long Train (Pattern Train's level two, §18): patterns of four and
      // five cars, three colours in each, and seven cars shown so one whole
      // repeat is always in sight. The answer is in the pattern every time.
      id: "train2", box: "train2", game: "train", name: "Long Train", coop: true,
      cols: 3, rows: 3, trains: 8, size: 8, shown: 7,
      patterns: ["AABC", "ABBC", "ABCC", "ABAC", "ABCB", "ABCA", "AABCC", "ABCBA"],
      lines: { home: "", end: "Every long train is finished! Choo choo!" },
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
    { id: "bingo", board: "bingo", name: "Number Bingo", pic: "🔢", colour: "#0369a1" },
    // adding (§18): Sum Bingo once he has played Number Bingo twice
    { id: "sums", board: "sums", name: "Sum Bingo", pic: "➕", colour: "#0f5f8c", unlockAfter: { box: "bingo", games: 2 } },
    { id: "snowman", board: "snowman", name: "Snowman Build", pic: "⛄", colour: "#0e7490" },
    // the 🐦 joins from his THIRD Apple game, exactly as the comets do
    { id: "apple", board: "apple", name: "Apple Spin", pic: "🍎", colour: "#d63b3b", birdsAfter: 2 },
    { id: "hundred", board: "hundred", name: "Hundred Hop", pic: "💯", colour: "#e08a00" },
    // skip counting (§18): by fives once he has hopped by twos twice
    { id: "twos", board: "twos", name: "Hop by Twos", pic: "🐸", colour: "#12715b" },
    { id: "fives", board: "fives", name: "Hop by Fives", pic: "🦘", colour: "#a8551a", unlockAfter: { box: "twos", games: 2 } },
    // the 🦊 joins from his THIRD Hen House game, exactly as the comets do
    { id: "hen", board: "hen", name: "Hen House", pic: "🐔", colour: "#c2410c", foxAfter: 2 },
    // the THINKING games (`kind: "think"`) stand on their own shelf: games of
    // finding, remembering and choosing, not only of luck
    { id: "lotto", board: "lotto", name: "Picnic Lotto", pic: "🧺", colour: "#2f9e6e", kind: "think" },
    { id: "spot", board: "spot", name: "Twin Spot", pic: "👀", colour: "#7c3aed", kind: "think" },
    { id: "pairs", board: "pairs", name: "Peek-a-Pair", pic: "🧠", colour: "#db2777", kind: "think" },
    // (drawn: 🚪 is the shelf bar's way OUT, so it cannot also be a box)
    { id: "doors", board: "doors", name: "Shut the Doors", pic: "", art: "doors", colour: "#b45309", kind: "think" },
    { id: "doors9", board: "doors9", name: "Doors to Nine", pic: "", art: "doors9", colour: "#92400e", kind: "think", unlockAfter: { box: "doors", games: 2 } },
    { id: "acorns", board: "acorns", name: "Acorn Pots", pic: "🌰", colour: "#92400e", kind: "think" },
    // (no domino emoji is a picture on every phone, so its box is drawn)
    { id: "dig", board: "dig", name: "Treasure Dig", pic: "🏴‍☠️", colour: "#a16207", kind: "think" },
    { id: "dominoes", board: "dominoes", name: "Dot Dominoes", pic: "", art: "domino", colour: "#0f766e", kind: "think" },
    // level two of a thinking game (§18): once he has played it twice
    { id: "dominoes6", board: "dominoes6", name: "Six-Dot Dominoes", pic: "", art: "domino6", colour: "#115e59", kind: "think", unlockAfter: { box: "dominoes", games: 2 } },
    { id: "cookies", board: "cookies", name: "Cookie Jar", pic: "🍪", colour: "#9a3412", kind: "think" },
    { id: "lineup", board: "lineup", name: "Line Up", pic: "🔴", colour: "#be123c", kind: "think" },
    { id: "topcard", board: "topcard", name: "Top Card", pic: "🃏", colour: "#4338ca", kind: "think" },
    { id: "topteen", board: "topteen", name: "Teen Top Card", pic: "🔟", colour: "#3730a3", kind: "think", unlockAfter: { box: "topcard", games: 2 } },
    { id: "grab", board: "grab", name: "Colour Grab", pic: "🎨", colour: "#0e7490", kind: "think" },
    // (choosing the die that lands on a rocket gets home first 70% of the time
    // against 29%: a game of choosing, so it stands with the thinking games)
    { id: "pickdie", board: "pickdie", name: "Pick a Die", pic: "🎲", colour: "#2563eb", kind: "think" },
    { id: "rainbow2", board: "rainbow2", name: "Rainbow Pick", pic: "🍭", colour: "#be3a82", kind: "think", unlockAfter: { box: "rainbow", games: 2 } },
    { id: "call", board: "call", name: "Moon Call", pic: "🔭", colour: "#1d4ed8", kind: "think", unlockAfter: { box: "moon", games: 2 } },
    { id: "dicematch", board: "dicematch", name: "Dice Match", pic: "🎯", colour: "#b91c1c", kind: "think" },
    { id: "dicerun", board: "dicerun", name: "Dice Run", pic: "🪜", colour: "#991b1b", kind: "think", unlockAfter: { box: "dicematch", games: 2 } },
    { id: "maze", board: "maze", name: "Mouse Maze", pic: "🐭", colour: "#a16207", kind: "think" },
    { id: "maze2", board: "maze2", name: "Twisty Maze", pic: "🌀", colour: "#854d0e", kind: "think", unlockAfter: { box: "maze", games: 2 } },
    { id: "hide", board: "hide", name: "Who's Hiding", pic: "🕵️", colour: "#475569", kind: "think" },
    { id: "train", board: "train", name: "Pattern Train", pic: "🚂", colour: "#15803d", kind: "think" },
    { id: "train2", board: "train2", name: "Long Train", pic: "🚃", colour: "#166534", kind: "think", unlockAfter: { box: "train", games: 2 } },
    { id: "hilo", board: "hilo", name: "Higher or Lower", pic: "🔼", colour: "#be185d", kind: "think" },
    { id: "honeyten", board: "honeyten", name: "Honey Ten", pic: "🍯", colour: "#b45309", kind: "think" },
    { id: "honey20", board: "honey20", name: "Honey Twenty", pic: "🐝", colour: "#92400e", kind: "think", unlockAfter: { box: "honeyten", games: 2 } },
    { id: "gofish", board: "gofish", name: "Go Fish", pic: "🐟", colour: "#0369a1", kind: "think" },
    { id: "colourmatch", board: "colourmatch", name: "Colour Match", pic: "🎴", colour: "#7e22ce", kind: "think" },
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
    // §18 E: both hands up at the party
    highFive: "High five!",
    // 🌙 tonight's three games
    tonight: "Three games tonight! Who's playing with you?",
    nightDone: "That's game night! Good night!",
    // (the token button on who's playing)
    tokenAs: "You play as {t}! Tap to change.",
    turn: "{n}'s turn!",
    rollFirst: "Tap your dice!",
    hopFirst: "Tap to hop! One tap, one hop.",
    flipFirst: "Tap to flip a card!",
    boost: "Blast off! Up to {to}!",
    // (a star for the token's player, by name: "you" in a two-player game
    // was nobody in particular, and on River's comet it was not him)
    comet: "Wheee! Down to {to}. A star for {n}!",
    homeMoon: "{n} made it to the Moon!",
    homeTrail: "{n} made it to the party!",
    helper: "Now {n} helps {m}!",
    endMoon: "You both made it to the Moon! High five!",
    endTrail: "You both made it to the party! Hooray!",
    notYet: "It's {n}'s turn. You're next!",
    cpuCheer: "Whoa, {n}!",
    // a CLEVER move, named by why (`smart` + the engine's `why`): said the
    // first time each player makes it in a game, with a 💡 over their face
    smartFour: "{n} left {left}. Clever!",
    smartArrows: "{n} followed the arrows. Clever!",
    smartBlock: "{n} stopped the line. Clever!",
    smartEnough: "Just big enough. Clever, {n}!",
    smartSave: "{n} saved the big cards. Clever!",
    smartMost: "{n} took the biggest grab. Clever!",
    smartFar: "{n} picked the card that goes further. Clever!",
    smartRocket: "{n} saw the rocket. Clever!",
    smartNear: "The quick way to the cheese. Clever, {n}!",
    smartAsk: "A good question, {n}!",
    smartSee: "{n} saw that {m} has one. Clever!",
    smartKeep: "{n} kept the same ones. Clever!",
    smartRecall: "{n} remembered where it was!",
    smartOddsUp: "{d} is small, so bigger is a good guess!",
    smartOddsDown: "{d} is big, so smaller is a good guess!",
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
    // (said as a TAKE-AWAY, §18: subtraction is new to him, and here he can
    // see it happen — one apple leaves the ten-frame)
    bird: "Tweet! A silly bird took one back. {from} take away one is {to}.",
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
    doorsFirst: "Roll the dice!",
    doorsPick: "Shut door {d}, or two doors that make {d}!",
    doorsPickTwo: "Find two doors that make {d}!",
    doorsDice: "{a} and {b} make {d}!",
    doorsAgain: "Two doors! Roll again, {n}!",
    doorsShut: "Door {d} is shut!",
    doorsTwo: "{a} and {b} make {d}! Two doors!",
    doorsHold: "{a}… and what makes {d}?",
    doorsNo: "No door makes {d}. Roll again!",
    doorsMiss: "That does not make {d}. Try another!",
    pairYes: "Two {p}! A pair! Go again!",
    pairNo: "Not a pair. Remember where they are!",
    pairStar: "A star! Go again!",
    pairsNew: "A new board!",
    acornsFirst: "Tap one of your pots!",
    domFirst: "Tap a tile that matches an end!",
    domLay: "{n} matches {n}!",
    domDouble: "A double! A star!",
    domDraw: "Nothing matches. Take one from the pile!",
    domTake: "You found one that matches!",
    domPass: "Nothing to lay. {n}'s turn!",
    domMiss: "That one does not match. Look at the ends!",
    digFirst: "Dig a square! The arrows point to the treasure!",
    digArrow: "Not here! The arrow points {d}!",
    digFound: "Treasure! {n} found it!",
    digNew: "A new treasure is buried!",
    nimFirst: "Take one, two or three cookies! The last one is golden!",
    nimLeft: "{d} left!",
    nimGold: "{n} got the golden cookie!",
    nimJar: "A new jar of cookies!",
    linesFirst: "Tap a column! Three in a row is a star!",
    linesThree: "Three in a row for {n}!",
    linesNew: "A new board!",
    topLead: "Play a card!",
    topFollow: "Bigger than {d}? Play a card!",
    topWin: "{d} is bigger than {e}! A star for {n}!",
    topSame: "{d} and {d}! The same!",
    grabFirst: "Pick a colour! Your patch grabs every square of that colour it touches!",
    grabGot: "{d} squares!",
    grabOne: "One square!",
    grabNone: "No squares this time!",
    grabBig: "A big grab for {n}!",
    pickFirstDie: "Two dice! Tap the one you want!",
    pickDieAgain: "Pick a die!",
    // the die he picked, as a SUM (§18: adding on is his working edge): where
    // he stands, how many more, where that lands — then the hops count it out
    pickSum: "{a} and {d} more is {to}!",
    // 🌈 Rainbow Pick
    twoFirst: "Two cards! Which one takes you further? Tap it!",
    twoAgain: "Which card?",
    // 🔭 Moon Call
    callFirst: "Where will you land? Count on in your head, then tap the number!",
    callAgain: "Where will you land?",
    callRight: "Yes! {a} and {d} more is {to}! A star!",
    callMiss: "Let's hop and count to see!",
    mazeFirst: "Play an arrow to move the mouse!",
    mazeCheese: "Cheese! A star for {n}!",
    mazeNew: "New cheese!",
    mazeSteps: "{d} steps {w}!",
    mazeStep: "One step {w}!",
    mazeTurn: "{a}, then {b}!",
    hideFirst: "Ask a question! Who is hiding?",
    hideAnimal: "Is it a {w}?",
    hideColour: "Is it {w}?",
    hideHat: "Does it have a hat?",
    hideYes: "Yes!",
    hideNo: "No!",
    hideNobody: "Nobody goes down!",
    hideFound: "Found! The {w}! A star for {n}!",
    hideNew: "Somebody new is hiding!",
    cmFirst: "Play a card with the same colour or the same number!",
    cmPlay: "{w}!",
    cmMiss: "Not that one! Same colour or same number.",
    cmNone: "No match! Turn over a new card.",
    cmOut: "{n} played every card! A star!",
    cmDeal: "New cards!",
    trainFirst: "What comes next? Tap the car that keeps the pattern!",
    trainRight: "Yes! {w} comes next! A star for {n}!",
    trainMiss: "That one breaks the pattern. {n}, can you find it?",
    trainNew: "A new train!",
    hiloFirst: "Will the next card be bigger or smaller?",
    hiloBig: "Bigger?",
    hiloSmall: "Smaller?",
    hiloRight: "{d}! Yes! A star for {n}!",
    hiloWrong: "{d}! Oh, not this time!",
    hiloSame: "{d}! The same!",
    honeyFirst: "Tap two flowers that make ten!",
    honeyHold: "{d}! What makes ten with {d}?",
    honeyPair: "{a} and {b} make ten! Honey for {n}!",
    honeyMiss: "{a} and {b} make {c}. Not ten this time!",
    honey20First: "Tap two flowers that make twenty!",
    honey20Hold: "{d}! What makes twenty with {d}?",
    honey20Pair: "{a} and {b} make twenty! Honey for {n}!",
    honey20Miss: "{a} and {b} make {c}. Not twenty this time!",
    fishFirst: "Tap a card to ask for it! Ask for one you both have!",
    fishAsk: "Do you have the {w}?",
    fishYes: "Yes! Here it is! A pair for {n}!",
    fishNo: "No! Go fish!",
    fishCatch: "Caught the {w}!",
    fishLucky: "The {w}! A pair for {n}!",
    fishGive: "Find the {w} in your hand!",
    fishNone: "No {w}? Tap Go fish!",
    fishEmpty: "The pond is empty!",
    snowFirst: "Roll the snowman die!",
    snowMagic: "Magic snow! The {w}! Tap the snowman to put it on!",
    snowBuild: "{w}! Tap the snowman to put it on!",
    snowHelp: "{w}! Tap {n}'s snowman to put it on!",
    // 🎁 a part his snowman cannot take, the friend's can (§18)
    snowGift: "{n} needs the {w}! Tap {n}'s snowman to give it!",
    snowGave: "A present for {n}! So kind! A star!",
    snowHave: "{w}! The snowman has one already.",
    snowFirstNeed: "{w}! Not yet. First the {x}!",
    snowOn: "On goes the {w}!",
    snowDone: "{n}'s snowman is all built! A star!",
    bingoFirst: "Roll the die, then find the number on your card!",
    bingoFind: "{d}! Find {d} on your card!",
    bingoHelp: "{d}! Find {d} on {n}'s card!",
    bingoNone: "{d}! Not on the card this time.",
    bingoMiss: "Look for {d}!",
    // ➕ Sum Bingo: the number is never said first — he counts the dots
    bingoSumFind: "{a} and {b}! Count all the dots, and find it on your card!",
    bingoSumHelp: "{a} and {b}! Count all the dots, and find it on {n}'s card!",
    bingoSumNone: "{a} and {b} make {d}. Not on the card this time.",
    bingoSum: "{a} and {b} make {d}!",
    bingoLine: "A line! A star for {n}!",
    bingoFull: "{n}'s card is full! Bingo!",
    m3First: "Roll your three dice!",
    m3RunFirst: "Roll your three dice! Three in a row is two stars!",
    m3Run: "Three in a row, {a} up to {c}! Two stars for {n}!",
    m3Keep: "Tap the dice to keep, then roll the rest!",
    m3Pair: "Two the same! A star for {n}!",
    m3Three: "Three the same! Three stars for {n}!",
    m3None: "No match this time!",
    domWhich: "It fits both ends! Which end?",
    domBack: "Not that one. Back it goes!",
    domOut: "{n} laid every tile! A star!",
    acornsAgain: "In your nest! Go again!",
    acornsSome: "{n} in your nest!",
    acornsRest: "The last acorns go home to their nests!",
    ten: "{to}! Ten more!",
    tens: "{to}! A star!",
  };

  // 🕵️ who can hide: three animals, three shirt colours (the first three of
  // COLOURS, each with its shape), a hat or none
  const HIDERS = {
    animals: [{ id: "dog", pic: "🐶", say: "dog" }, { id: "cat", pic: "🐱", say: "cat" }, { id: "bunny", pic: "🐰", say: "bunny" }],
    colours: ["R", "B", "Y"],
    hat: "🎩",
  };
  // ⛄ the snowman's six parts, die face by die face (index 0 unused)
  // (face 1 of the die is ❄️ magic snow; part 1, the big ball, starts built)
  const SNOW_PARTS = [null, { say: "big ball", die: "magic snow", pic: "❄️" }, { say: "tummy" }, { say: "head" }, { say: "hat", pic: "🎩" }, { say: "carrot nose", pic: "🥕" }, { say: "scarf", pic: "🧣" }];
  // 🐟 the ten pictures of Go Fish (each twice in the deck)
  const FISH = [
    { pic: "🐟", say: "fish" }, { pic: "🐙", say: "octopus" }, { pic: "🦀", say: "crab" }, { pic: "🐢", say: "turtle" }, { pic: "🐸", say: "frog" },
    { pic: "🦆", say: "duck" }, { pic: "🐳", say: "whale" }, { pic: "🐧", say: "penguin" }, { pic: "🐚", say: "shell" }, { pic: "🐬", say: "dolphin" },
  ];
  // §18 E: counting in Chinese (a grown-up switch, so Grandma can play
  // too): the number a hop, an apple or a chick lands on, said and popped
  // as 一, 二, 三… up to 一百二十 (the biggest count any board makes is the
  // Apple Spin pie, 20 and a few). The first ten are 华丽's own CN_NUM, which
  // a test reads, so the two worlds cannot count differently.
  const ZH_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  function zhNum(n) {
    if (!Number.isInteger(n) || n < 0 || n > 999) return String(n);
    if (n <= 10) return ZH_DIGITS[n];
    if (n < 20) return "十" + ZH_DIGITS[n - 10];
    if (n < 100) return ZH_DIGITS[Math.floor(n / 10)] + "十" + (n % 10 ? ZH_DIGITS[n % 10] : "");
    const h = Math.floor(n / 100), r = n % 100;
    if (!r) return ZH_DIGITS[h] + "百";
    // 一百零五 · 一百一十 · 一百二十三 (a ten after a hundred keeps its 一)
    return ZH_DIGITS[h] + "百" + (r < 10 ? "零" + ZH_DIGITS[r] : ZH_DIGITS[Math.floor(r / 10)] + "十" + (r % 10 ? ZH_DIGITS[r % 10] : ""));
  }
  // §18 E: what Josh plays as on a race board — himself (his face, the
  // default), a race car, a dump truck or his buddy (the one he picked on the
  // home screen). A friend keeps their face: the token says whose it is.
  const TOKENS = [
    { id: "face", say: "you" },
    // (a race car, not a rocket: Moon Race's boosters are rockets, and a
    // token must never wear a picture the board already uses)
    { id: "car", pic: "🏎️", say: "a race car" },
    { id: "truck", say: "a dump truck" },
    { id: "buddy", say: "your buddy" },
  ];
  const BoardData = { FISH, SNOW_PARTS, HIDERS, JOSH, FRIENDS, PEOPLE, COLOURS, ANIMALS, FOODS, SPOTS, PAIRS, BOARDS, BOXES, SAY, TOKENS, zhNum };
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
