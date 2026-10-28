// 🎲 Game Night (PLAN_BOARD.md) — ALL content: the boxes on the shelf, their
// boards, the players, and every line the game says. The engine
// (board-logic.js) reads this; nothing here runs. Dual export, so the node
// tests read exactly what the page reads.
//
// The board games are luck games for a four-year-old and a friend (or the
// computer). Only the MECHANICS of the classics are borrowed — Snakes &
// Ladders (traditional) and the colour-card trail of Candy Land, a trademark —
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
      // a picture card ZOOMS you forward to its landmark
      landmarks: [
        { at: 9, pic: "🦕", say: "Dino land" },
        { at: 19, pic: "🚀", say: "Rocket land" },
        { at: 28, pic: "🏰", say: "Castle land" },
      ],
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
    keepGoing: "Keep playing!",
    spinFirst: "Tap to spin!",
    pickFirst: "Tap to pick! One tap, one apple.",
    full: "{n}'s basket is full! Ten apples!",
    pie: "{k} more for the pie!",
    bird: "Tweet! A silly bird put one back. {to} in the basket.",
    endApple: "Ten, twenty! {k} apples in the pie! Yum!",
  };

  const BoardData = { JOSH, FRIENDS, PEOPLE, COLOURS, BOARDS, BOXES, SAY };
  BoardData.board = (id) => BOARDS.find((b) => b.id === id) || null;
  BoardData.box = (id) => BOXES.find((b) => b.id === id) || null;
  BoardData.person = (id) => (id === "josh" ? JOSH : PEOPLE.find((p) => p.id === id) || null);
  BoardData.colour = (id) => COLOURS.find((c) => c.id === id) || null;

  global.BoardData = BoardData;
  if (typeof module !== "undefined" && module.exports) module.exports = BoardData;
})(typeof window !== "undefined" ? window : globalThis);
