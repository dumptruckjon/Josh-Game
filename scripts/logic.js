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

  // --- Skip counting (count by 2s / 5s / 10s) ----------------------------
  // Build step, 2*step, ... count terms, hide one interior term, ask for it.
  function makeSkipCount(step, count, rng = Math.random) {
    if (!(step > 0)) throw new Error("makeSkipCount needs step > 0");
    count = count || 5;
    const sequence = [];
    for (let i = 1; i <= count; i++) sequence.push(step * i);
    const hideIndex = randInt(1, count - 1, rng); // never hide the first (keep context)
    const answer = sequence[hideIndex];
    const pool = [answer + step, answer - step, answer + 2 * step, answer - 2 * step, answer + 1, answer - 1]
      .filter((v) => v > 0 && v !== answer);
    const distractors = shuffle([...new Set(pool)], rng).slice(0, 2);
    const choices = shuffle(
      [{ n: answer, correct: true }, ...distractors.map((n) => ({ n, correct: false }))],
      rng
    );
    return { step, sequence, hideIndex, answer, choices };
  }

  // --- Take-away (simple subtraction) ------------------------------------
  function makeTakeAway(rng = Math.random) {
    const start = randInt(3, 9, rng);
    const minus = randInt(1, start - 1, rng);
    const answer = start - minus;
    const pool = [answer + 1, answer - 1, answer + 2, answer - 2, start]
      .filter((v) => v >= 0 && v !== answer);
    const distractors = shuffle([...new Set(pool)], rng).slice(0, 2);
    const choices = shuffle(
      [{ n: answer, correct: true }, ...distractors.map((n) => ({ n, correct: false }))],
      rng
    );
    return { start, minus, answer, choices };
  }

  // --- Compare quantities (which has more?) ------------------------------
  function makeCompare(rng = Math.random) {
    const a = randInt(1, 7, rng);
    let b = randInt(1, 7, rng);
    while (b === a) b = randInt(1, 7, rng);
    const moreLeft = a > b;
    return { a, b, moreLeft, answer: moreLeft ? "left" : "right" };
  }

  const API = {
    randInt, pickIndex, shuffle, sample, makeOddOneOut, makePattern, PATTERN_UNITS,
    makeSkipCount, makeTakeAway, makeCompare,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else global.JoshLogic = API;
})(typeof window !== "undefined" ? window : globalThis);
