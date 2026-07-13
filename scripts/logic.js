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

  // --- Literacy -----------------------------------------------------------
  // First sound: a picture + its beginning letter, with 2 distractor letters.
  function makeFirstSound(words, rng = Math.random) {
    if (!Array.isArray(words) || words.length < 3) throw new Error("makeFirstSound needs >= 3 words");
    const w = words[randInt(0, words.length - 1, rng)];
    const answer = w.letter;
    const others = [...new Set(words.map((x) => x.letter).filter((l) => l !== answer))];
    const distractors = shuffle(others, rng).slice(0, 2);
    const choices = shuffle(
      [{ letter: answer, correct: true }, ...distractors.map((l) => ({ letter: l, correct: false }))],
      rng
    );
    return { emoji: w.emoji, word: w.word, answer, choices };
  }

  // Rhyme: a target picture + one that rhymes (same group) + 2 that don't.
  function makeRhyme(groups, rng = Math.random) {
    if (!Array.isArray(groups) || groups.length < 2) throw new Error("makeRhyme needs >= 2 groups");
    const gi = randInt(0, groups.length - 1, rng);
    const g = groups[gi];
    if (g.length < 2) throw new Error("each rhyme group needs >= 2 members");
    const ti = randInt(0, g.length - 1, rng);
    const target = g[ti];
    const correct = g[pickIndex(g.length, ti, rng)];
    const otherItems = [];
    groups.forEach((grp, idx) => { if (idx !== gi) grp.forEach((it) => otherItems.push(it)); });
    const distractors = shuffle(otherItems, rng).slice(0, 2);
    const choices = shuffle(
      [{ emoji: correct.emoji, word: correct.word, correct: true },
        ...distractors.map((it) => ({ emoji: it.emoji, word: it.word, correct: false }))],
      rng
    );
    return { target, choices };
  }

  // Sight word: a target word + 2 distractor words (visual matching).
  function makeSightWord(words, rng = Math.random) {
    if (!Array.isArray(words) || words.length < 3) throw new Error("makeSightWord needs >= 3 words");
    const target = words[randInt(0, words.length - 1, rng)];
    const others = shuffle(words.filter((w) => w !== target), rng).slice(0, 2);
    const choices = shuffle(
      [{ word: target, correct: true }, ...others.map((w) => ({ word: w, correct: false }))],
      rng
    );
    return { target, choices };
  }

  // CVC build: a picture + its letters, shuffled, to place in order.
  function makeCVC(words, rng = Math.random) {
    if (!Array.isArray(words) || !words.length) throw new Error("makeCVC needs words");
    const w = words[randInt(0, words.length - 1, rng)];
    const letters = w.word.split("");
    return { emoji: w.emoji, word: w.word, letters, buttons: shuffle(letters, rng) };
  }

  // --- Shadow match: a picture + its silhouette among distractors ---------
  function makeShadowMatch(pool, rng = Math.random) {
    if (!Array.isArray(pool) || pool.length < 3) throw new Error("makeShadowMatch needs >= 3");
    const target = pool[randInt(0, pool.length - 1, rng)];
    const others = shuffle(pool.filter((e) => e !== target), rng).slice(0, 2);
    const choices = shuffle(
      [{ emoji: target, correct: true }, ...others.map((e) => ({ emoji: e, correct: false }))],
      rng
    );
    return { target, choices };
  }

  // --- Order by size: one emoji at `count` distinct sizes (ranks 1..count) ---
  function makeOrder(pool, count, rng = Math.random) {
    if (!Array.isArray(pool) || !pool.length) throw new Error("makeOrder needs a pool");
    count = count || 3;
    const emoji = pool[randInt(0, pool.length - 1, rng)];
    const ranks = shuffle(Array.from({ length: count }, (_, i) => i + 1), rng);
    return { emoji, count, items: ranks.map((rank) => ({ rank })) };
  }

  // --- Sort into bins (science / color / land-air-water) ------------------
  // A category set has bins, each with items. Pick a random item; the correct
  // bin is the one it came from.
  function makeSort(set, rng = Math.random) {
    const bins = set && set.bins;
    if (!Array.isArray(bins) || bins.length < 2) throw new Error("makeSort needs >= 2 bins");
    const bi = randInt(0, bins.length - 1, rng);
    const items = bins[bi].items;
    const item = items[randInt(0, items.length - 1, rng)];
    return { item, bins: bins.map((b) => ({ label: b.label, emoji: b.emoji })), correctIndex: bi, setName: set.name };
  }

  // --- Addition (combine two small groups) --------------------------------
  function makeAddition(rng = Math.random) {
    const a = randInt(1, 5, rng);
    const b = randInt(1, 5, rng);
    const sum = a + b;
    const pool = [sum + 1, sum - 1, sum + 2, sum - 2].filter((v) => v > 0 && v !== sum);
    const distractors = shuffle([...new Set(pool)], rng).slice(0, 2);
    const choices = shuffle([{ n: sum, correct: true }, ...distractors.map((n) => ({ n, correct: false }))], rng);
    return { a, b, sum, choices };
  }

  // --- Number match (numeral -> the group with that many) -----------------
  function makeNumberMatch(rng = Math.random) {
    const n = randInt(1, 9, rng);
    const used = new Set([n]);
    const wrongs = [];
    while (wrongs.length < 2) { const w = randInt(1, 9, rng); if (!used.has(w)) { used.add(w); wrongs.push(w); } }
    const groups = shuffle([{ count: n, correct: true }, ...wrongs.map((c) => ({ count: c, correct: false }))], rng);
    return { n, groups };
  }

  // --- Clock (o'clock): the hour + digital-time choices -------------------
  function makeClock(rng = Math.random) {
    const hour = randInt(1, 12, rng);
    const used = new Set([hour]);
    const wrongs = [];
    while (wrongs.length < 2) { const w = randInt(1, 12, rng); if (!used.has(w)) { used.add(w); wrongs.push(w); } }
    const choices = shuffle(
      [{ hour, label: hour + ":00", correct: true }, ...wrongs.map((h) => ({ hour: h, label: h + ":00", correct: false }))],
      rng
    );
    return { hour, choices };
  }

  // --- Place value: split a number into tens + ones -----------------------
  function tensOnes(n) { return { tens: Math.floor(n / 10), ones: n % 10 }; }

  // --- Letter match (uppercase -> its lowercase) --------------------------
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function makeLetterMatch(rng = Math.random) {
    const i = randInt(0, 25, rng);
    const upper = ALPHABET[i];
    const used = new Set([i]);
    const wrongs = [];
    while (wrongs.length < 2) { const w = randInt(0, 25, rng); if (!used.has(w)) { used.add(w); wrongs.push(ALPHABET[w].toLowerCase()); } }
    const choices = shuffle([{ lower: upper.toLowerCase(), correct: true }, ...wrongs.map((l) => ({ lower: l, correct: false }))], rng);
    return { upper, answer: upper.toLowerCase(), choices };
  }

  // --- Missing letter in a known word -------------------------------------
  function makeMissingLetter(words, rng = Math.random) {
    if (!Array.isArray(words) || !words.length) throw new Error("makeMissingLetter needs words");
    const w = words[randInt(0, words.length - 1, rng)];
    const blankIndex = randInt(0, w.word.length - 1, rng);
    const answer = w.word[blankIndex];
    const az = "abcdefghijklmnopqrstuvwxyz";
    const used = new Set([answer]);
    const wrongs = [];
    while (wrongs.length < 2) { const c = az[randInt(0, 25, rng)]; if (!used.has(c)) { used.add(c); wrongs.push(c); } }
    const choices = shuffle([{ letter: answer, correct: true }, ...wrongs.map((l) => ({ letter: l, correct: false }))], rng);
    return { emoji: w.emoji, word: w.word, blankIndex, answer, choices };
  }

  // --- Spot the difference: two rows, one item swapped --------------------
  function makeSpotDifference(pool, count, rng = Math.random) {
    count = count || 3;
    if (!Array.isArray(pool) || pool.length < count + 1) throw new Error("makeSpotDifference needs pool > count");
    const before = sample(pool, count, rng);
    const diffIndex = randInt(0, count - 1, rng);
    const replacement = shuffle(pool.filter((e) => !before.includes(e)), rng)[0];
    const after = before.slice();
    after[diffIndex] = replacement;
    return { before, after, diffIndex, count };
  }

  const API = {
    randInt, pickIndex, shuffle, sample, makeOddOneOut, makePattern, PATTERN_UNITS,
    makeSkipCount, makeTakeAway, makeCompare,
    makeFirstSound, makeRhyme, makeSightWord, makeCVC,
    makeShadowMatch, makeOrder, makeSort,
    makeAddition, makeNumberMatch, makeClock, tensOnes,
    makeLetterMatch, makeMissingLetter, makeSpotDifference,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else global.JoshLogic = API;
})(typeof window !== "undefined" ? window : globalThis);
