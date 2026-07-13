// Pure game logic for Josh's Games — no DOM, fully deterministic when given an
// `rng`. This is where the CORRECTNESS of each game lives, so it can be unit
// tested exhaustively (tests/logic.test.js) and never silently break.
//
// Works in the browser (window.JoshLogic) and Node (module.exports).

(function (global) {
  // --- primitives ---------------------------------------------------------

  // Random int in [min, max] inclusive.
  function randInt(min, max, rng = Math.random) {
    return min + Math.floor(rng() * (max - min + 1));
  }

  // Pick an index in [0, len) avoiding `current` when possible (no repeats).
  function pickIndex(len, current, rng = Math.random) {
    if (len <= 1) return 0;
    let next = current;
    while (next === current) next = Math.floor(rng() * len);
    return next;
  }

  // Fisher–Yates shuffle (returns a new array).
  function shuffle(arr, rng = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Pick `k` distinct items from arr (no repeats). k is clamped to arr.length.
  function sample(arr, k, rng = Math.random) {
    return shuffle(arr, rng).slice(0, Math.max(0, Math.min(k, arr.length)));
  }

  // --- Odd One Out --------------------------------------------------------
  // 3 tiles from one group + 1 "odd" tile from a different group. Returns
  // tiles in shuffled order; exactly one has correct:true (the odd one).
  function makeOddOneOut(groups, rng = Math.random) {
    if (!Array.isArray(groups) || groups.length < 2) {
      throw new Error("makeOddOneOut needs >= 2 groups");
    }
    const gi = randInt(0, groups.length - 1, rng);
    let oj = pickIndex(groups.length, gi, rng);
    const majority = groups[gi];
    const other = groups[oj];
    const three = sample(majority.items, 3, rng);
    // Odd tile must not accidentally collide with a majority tile.
    const oddPool = other.items.filter((e) => !three.includes(e));
    const odd = oddPool.length ? oddPool[randInt(0, oddPool.length - 1, rng)] : other.items[0];
    const tiles = shuffle(
      [
        ...three.map((emoji) => ({ emoji, correct: false })),
        { emoji: odd, correct: true },
      ],
      rng
    );
    return { tiles, odd, groupName: majority.name, oddGroup: other.name };
  }

  // --- What Comes Next (patterns) ----------------------------------------
  // Build a repeating pattern from a 2-token set and ask for the next token.
  // Units use indices into the pair: AB=[0,1], AAB=[0,0,1], ABB=[0,1,1].
  const PATTERN_UNITS = [
    [0, 1], // A B A B ...
    [0, 0, 1], // A A B A A B ...
    [0, 1, 1], // A B B A B B ...
  ];
  function makePattern(pair, allTokens, rng = Math.random) {
    if (!Array.isArray(pair) || pair.length < 2) {
      throw new Error("makePattern needs a 2-token pair");
    }
    const unitIdx = PATTERN_UNITS[randInt(0, PATTERN_UNITS.length - 1, rng)];
    const unit = unitIdx.map((i) => pair[i]);
    const cycles = 2; // show two full repeats...
    const extra = randInt(0, unit.length - 1, rng); // ...plus a partial, so the answer varies
    const shownCount = cycles * unit.length + extra;
    const sequence = [];
    for (let i = 0; i < shownCount; i++) sequence.push(unit[i % unit.length]);
    const answer = unit[shownCount % unit.length];

    // Choices: the two tokens in the pair + one distractor from another set.
    const choiceTokens = new Set(pair);
    if (Array.isArray(allTokens)) {
      const distractPool = allTokens.filter((t) => !choiceTokens.has(t));
      if (distractPool.length) choiceTokens.add(distractPool[randInt(0, distractPool.length - 1, rng)]);
    }
    const choices = shuffle(
      [...choiceTokens].map((token) => ({ token, correct: token === answer })),
      rng
    );
    return { sequence, answer, choices, unit };
  }

  const API = { randInt, pickIndex, shuffle, sample, makeOddOneOut, makePattern, PATTERN_UNITS };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else global.JoshLogic = API;
})(typeof window !== "undefined" ? window : globalThis);
