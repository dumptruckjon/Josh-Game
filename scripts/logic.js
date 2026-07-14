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
  function makeClock(rng = Math.random, allowHalf = false) {
    const lab = (h, m) => h + ":" + (m === 30 ? "30" : "00");
    const hour = randInt(1, 12, rng);
    const min = (allowHalf && randInt(0, 1, rng) === 1) ? 30 : 0;
    const correctLabel = lab(hour, min);
    const used = new Set([correctLabel]);
    const wrongs = [];
    let guard = 0;
    while (wrongs.length < 2 && guard++ < 300) {
      const h = randInt(1, 12, rng);
      const m = (allowHalf && randInt(0, 1, rng) === 1) ? 30 : 0;
      const l = lab(h, m);
      if (!used.has(l)) { used.add(l); wrongs.push({ hour: h, min: m, label: l }); }
    }
    const choices = shuffle(
      [{ hour, min, label: correctLabel, correct: true }, ...wrongs.map((w) => ({ hour: w.hour, min: w.min, label: w.label, correct: false }))],
      rng
    );
    return { hour, min, choices };
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

  // --- Find games (visual search) -----------------------------------------
  // A field with K copies of a target hidden among distractors.
  function makeFindHero(pool, size, targets, rng = Math.random) {
    if (!Array.isArray(pool) || pool.length < 3) throw new Error("makeFindHero needs >= 3");
    size = size || 12;
    const target = pool[randInt(0, pool.length - 1, rng)];
    const K = Math.min(targets || randInt(2, 4, rng), size);
    const distract = pool.filter((e) => e !== target);
    const cells = [];
    for (let i = 0; i < K; i++) cells.push({ emoji: target, correct: true });
    for (let i = 0; i < size - K; i++) cells.push({ emoji: distract[randInt(0, distract.length - 1, rng)], correct: false });
    return { target, count: K, cells: shuffle(cells, rng) };
  }

  // A crowd of one emoji with exactly ONE different (spot the odd one).
  function makeCrowd(pool, size, rng = Math.random) {
    if (!Array.isArray(pool) || pool.length < 2) throw new Error("makeCrowd needs >= 2");
    size = size || 12;
    const base = pool[randInt(0, pool.length - 1, rng)];
    let odd = base;
    while (odd === base) odd = pool[randInt(0, pool.length - 1, rng)];
    const cells = [];
    for (let i = 0; i < size; i++) cells.push({ emoji: base, correct: false });
    const oddIndex = randInt(0, size - 1, rng);
    cells[oddIndex] = { emoji: odd, correct: true };
    return { base, odd, oddIndex, cells };
  }

  // A scene to count: K copies of the target among distractors; number choices.
  function makeFindCount(pool, size, rng = Math.random) {
    if (!Array.isArray(pool) || pool.length < 3) throw new Error("makeFindCount needs >= 3");
    size = size || 10;
    const target = pool[randInt(0, pool.length - 1, rng)];
    const K = Math.min(randInt(2, 5, rng), size);
    const distract = pool.filter((e) => e !== target);
    const cells = [];
    for (let i = 0; i < K; i++) cells.push(target);
    for (let i = 0; i < size - K; i++) cells.push(distract[randInt(0, distract.length - 1, rng)]);
    const used = new Set([K]);
    const wrongs = [];
    while (wrongs.length < 2) { const w = randInt(1, Math.min(size, 9), rng); if (!used.has(w)) { used.add(w); wrongs.push(w); } }
    const choices = shuffle([{ n: K, correct: true }, ...wrongs.map((n) => ({ n, correct: false }))], rng);
    return { target, count: K, cells: shuffle(cells, rng), choices };
  }

  // --- Teen numbers (10 + some more) --------------------------------------
  function makeTeen(rng = Math.random) {
    const target = randInt(11, 19, rng);
    return { target, tens: 1, ones: target - 10 };
  }

  // --- Make Ten (number bonds to 10) --------------------------------------
  // Show `have` filled on a ten-frame; the answer is how many MORE make ten.
  function makeMakeTen(rng = Math.random) {
    const have = randInt(1, 9, rng);
    const need = 10 - have;
    const pool = [need + 1, need - 1, need + 2, need - 2].filter((v) => v >= 0 && v <= 10 && v !== need);
    const distractors = shuffle([...new Set(pool)], rng).slice(0, 2);
    const choices = shuffle([{ n: need, correct: true }, ...distractors.map((n) => ({ n, correct: false }))], rng);
    return { have, need, choices };
  }

  // --- Big Add (two-digit addition) — scales with `hard` --------------------
  // Easy: no regrouping (ones sums <= 9), small tens — a gentle first taste.
  // Hard (later rounds): bigger tens and ones that may CARRY past ten. The sum is
  // always honest and the tens/ones split drives the block visual either way.
  function makeBigAdd(rng = Math.random, hard = false) {
    const maxTens = hard ? 3 : 2, maxOnes = hard ? 9 : 4;
    const tensA = randInt(1, maxTens, rng), onesA = randInt(0, maxOnes, rng);
    const tensB = randInt(1, maxTens, rng), onesB = randInt(0, maxOnes, rng);
    const a = tensA * 10 + onesA, b = tensB * 10 + onesB;
    const sum = a + b;
    const pool = [sum + 1, sum - 1, sum + 10, sum - 10, sum + 2].filter((v) => v > 0 && v !== sum);
    const distractors = shuffle([...new Set(pool)], rng).slice(0, 2);
    const choices = shuffle([{ n: sum, correct: true }, ...distractors.map((n) => ({ n, correct: false }))], rng);
    return { a, b, sum, aTens: tensA, aOnes: onesA, bTens: tensB, bOnes: onesB, carry: onesA + onesB >= 10, choices };
  }

  // --- Number sequence to put in order (a VARIED consecutive run) ----------
  // Fixes the old "always 1-2-3-4": a random run of `len` consecutive numbers
  // starting anywhere up to maxStart (so it can stretch into the teens). Each
  // tile carries its ascending `order` (0-based) so the game marks the next.
  function makeNumberSequence(len, maxStart, rng = Math.random) {
    len = len || 4;
    const start = randInt(1, Math.max(1, maxStart || 6), rng);
    const values = [];
    for (let i = 0; i < len; i++) values.push(start + i);
    const items = shuffle(values.map((value, i) => ({ value, order: i })), rng);
    return { start, len, values, items };
  }

  // --- Read & Zap (decode a printed word, tap its picture) ----------------
  function makeWordPicture(words, rng = Math.random) {
    if (!Array.isArray(words) || words.length < 3) throw new Error("makeWordPicture needs >= 3 words");
    const w = words[randInt(0, words.length - 1, rng)];
    const others = shuffle(words.filter((x) => x.word !== w.word), rng).slice(0, 2);
    const choices = shuffle(
      [{ emoji: w.emoji, correct: true }, ...others.map((o) => ({ emoji: o.emoji, correct: false }))],
      rng
    );
    return { word: w.word, answer: w.emoji, choices };
  }

  // --- Who Is It? (multi-attribute deduction / "Guess-Who") ---------------
  // Build all color×item combos (each unique), then pick one color + one item
  // clue. Because every combo is distinct, EXACTLY one character matches both.
  function makeDeduce(colors, items, rng = Math.random) {
    if (!Array.isArray(colors) || colors.length < 2 || !Array.isArray(items) || items.length < 2) {
      throw new Error("makeDeduce needs >= 2 colors and >= 2 items");
    }
    const combos = [];
    for (const color of colors) for (const item of items) combos.push({ color, item });
    const characters = shuffle(combos, rng);
    const clueColor = colors[randInt(0, colors.length - 1, rng)];
    const clueItem = items[randInt(0, items.length - 1, rng)];
    const answerIndex = characters.findIndex((c) => c.color === clueColor && c.item === clueItem);
    return { characters, clueColor, clueItem, answerIndex };
  }

  // --- Find the Twins (one matching pair in an all-unique field) ----------
  function makeTwins(pool, size, rng = Math.random) {
    size = size || 8;
    if (!Array.isArray(pool) || pool.length < size) throw new Error("makeTwins needs pool >= size");
    const picks = sample(pool, size - 1, rng); // size-1 DISTINCT glyphs
    const twin = picks[randInt(0, picks.length - 1, rng)];
    const cells = [...picks, twin].map((emoji) => ({ emoji, correct: emoji === twin }));
    return { twin, cells: shuffle(cells, rng) };
  }

  // --- I Spy: Find Them All (tap every member of a category) --------------
  // cats: [{ id, icon, items:[emoji] }] with DISJOINT item sets (so a filler
  // from another category can never be a hidden member).
  function makeCategoryHunt(cats, size, rng = Math.random) {
    if (!Array.isArray(cats) || cats.length < 2) throw new Error("makeCategoryHunt needs >= 2 categories");
    size = size || 9;
    const ci = randInt(0, cats.length - 1, rng);
    const cat = cats[ci];
    const K = Math.min(cat.items.length, randInt(2, 4, rng));
    const members = sample(cat.items, K, rng);
    const others = [];
    cats.forEach((c, i) => { if (i !== ci) c.items.forEach((e) => others.push(e)); });
    const fillers = sample(others, Math.max(0, size - K), rng);
    const cells = shuffle(
      [...members.map((emoji) => ({ emoji, correct: true })), ...fillers.map((emoji) => ({ emoji, correct: false }))],
      rng
    );
    return { catId: cat.id, catIcon: cat.icon, count: K, cells };
  }

  // --- Shape's Real Twin (match a 3D solid to a real object) --------------
  function makeSolidMatch(sets, rng = Math.random) {
    if (!Array.isArray(sets) || sets.length < 3) throw new Error("makeSolidMatch needs >= 3 solids");
    const si = randInt(0, sets.length - 1, rng);
    const solid = sets[si];
    const answer = solid.objects[randInt(0, solid.objects.length - 1, rng)];
    const others = [];
    sets.forEach((s, i) => { if (i !== si) s.objects.forEach((o) => others.push(o)); });
    const distractors = sample(others, 2, rng);
    const choices = shuffle(
      [{ emoji: answer, correct: true }, ...distractors.map((emoji) => ({ emoji, correct: false }))],
      rng
    );
    return { name: solid.name, svg: solid.svg, answer, choices };
  }

  // --- Piggy Bank (fill to an exact price with pennies/nickels) -----------
  // Returns a small price plus one valid nickel/penny decomposition (display
  // hint). A penny (1¢) is always addable while money is owed, so the game
  // always lands EXACTLY on the price and can never overpay.
  function makePiggyBank(rng = Math.random) {
    const price = randInt(3, 10, rng);
    const nickels = Math.floor(price / 5);
    const pennies = price - nickels * 5;
    return { price, nickels, pennies };
  }

  // --- Number Muncher (compare two written numerals) ----------------------
  function makeNumberCompare(min, max, rng = Math.random) {
    const a = randInt(min, max, rng);
    let b = randInt(min, max, rng);
    while (b === a) b = randInt(min, max, rng); // never a tie
    return { a, b, bigger: Math.max(a, b), answer: a > b ? "a" : "b" };
  }

  // --- Picture Squares (a solved 3×3 Latin square, one cell blanked) ------
  // Each of 3 symbols appears exactly once per row AND per column; blank one
  // cell and the missing symbol for that row/column is the unique answer.
  function makeLatinSquare(symbols, rng = Math.random, n = 3) {
    n = (n === 4) ? 4 : 3; // 3×3 (default) or the harder 4×4 tier
    if (!Array.isArray(symbols) || symbols.length < n) throw new Error("makeLatinSquare needs >= " + n + " symbols");
    const s = sample(symbols, n, rng); // n distinct symbols
    const idx = []; for (let i = 0; i < n; i++) idx.push(i);
    const base = idx.map((r) => idx.map((c) => (r + c) % n)); // a cyclic Latin square of indices
    const rowOrder = shuffle(idx.slice(), rng), colOrder = shuffle(idx.slice(), rng);
    const grid = rowOrder.map((r) => colOrder.map((c) => s[base[r][c]]));
    const blankR = randInt(0, n - 1, rng), blankC = randInt(0, n - 1, rng);
    const answer = grid[blankR][blankC];
    const choices = shuffle(s.map((sym) => ({ sym, correct: sym === answer })), rng);
    return { grid, blankR, blankC, answer, choices, symbols: s, n };
  }

  // --- Rhyme Train / Rhyme Hunt (find every picture that rhymes) ----------
  function makeRhymeHunt(groups, size, rng = Math.random) {
    if (!Array.isArray(groups) || groups.length < 2) throw new Error("makeRhymeHunt needs >= 2 groups");
    size = size || 6;
    const gi = randInt(0, groups.length - 1, rng);
    const g = groups[gi];
    const ti = randInt(0, g.length - 1, rng);
    const target = g[ti];
    const rhymers = g.filter((_, i) => i !== ti); // every one truly rhymes with target
    const K = rhymers.length;
    const others = [];
    groups.forEach((grp, idx) => { if (idx !== gi) grp.forEach((it) => others.push(it)); });
    const fillers = sample(others, Math.max(0, size - K), rng);
    const cells = shuffle(
      [...rhymers.map((it) => ({ emoji: it.emoji, word: it.word, correct: true })),
        ...fillers.map((it) => ({ emoji: it.emoji, word: it.word, correct: false }))],
      rng
    );
    return { target, count: K, cells };
  }

  // --- Finish the Word (which digraph starts it: sh / ch / th) -------------
  function makeDigraphFinish(words, rng = Math.random) {
    if (!Array.isArray(words) || words.length < 3) throw new Error("makeDigraphFinish needs >= 3 words");
    const w = words[randInt(0, words.length - 1, rng)];
    const all = [...new Set(words.map((x) => x.digraph))];
    const distractors = shuffle(all.filter((d) => d !== w.digraph), rng).slice(0, 2);
    const choices = shuffle(
      [{ digraph: w.digraph, correct: true }, ...distractors.map((d) => ({ digraph: d, correct: false }))],
      rng
    );
    return { emoji: w.emoji, word: w.word, digraph: w.digraph, rest: w.word.slice(w.digraph.length), choices };
  }

  // --- Put the Story in Order (tap 3 pictures first -> next -> last) -------
  // Each sequence is given in TRUE temporal order; we shuffle for display and
  // tag every tile with its correct rank (0,1,2).
  function makeStoryOrder(sequences, rng = Math.random) {
    if (!Array.isArray(sequences) || !sequences.length) throw new Error("makeStoryOrder needs sequences");
    const seq = sequences[randInt(0, sequences.length - 1, rng)];
    const tiles = shuffle(seq.steps.map((emoji, rank) => ({ emoji, rank })), rng);
    return { name: seq.name, order: seq.steps, tiles };
  }

  // --- The Big Red One (feature-conjunction search: match BOTH clues) ------
  // A field of colored shapes; exactly ONE has BOTH the target color AND the
  // target shape. Distractors may share one attribute, never both.
  function makeConjunctionHunt(colors, shapes, size, rng = Math.random) {
    if (!Array.isArray(colors) || colors.length < 2 || !Array.isArray(shapes) || shapes.length < 2) {
      throw new Error("makeConjunctionHunt needs >= 2 colors and >= 2 shapes");
    }
    size = size || 9;
    // Can't show more DISTINCT color×shape tiles than combos exist.
    size = Math.min(size, colors.length * shapes.length);
    const color = colors[randInt(0, colors.length - 1, rng)];
    const shape = shapes[randInt(0, shapes.length - 1, rng)];
    // All combos except the exact target are legal distractors.
    const pool = [];
    for (const c of colors) for (const s of shapes) {
      if (c === color && s === shape) continue;
      pool.push({ color: c, shape: s });
    }
    const distractors = sample(pool, Math.max(0, size - 1), rng);
    const cells = shuffle(
      [{ color, shape, correct: true }, ...distractors.map((d) => ({ ...d, correct: false }))],
      rng
    );
    return { color, shape, cells };
  }

  // --- Continent match (which continent does this animal live on?) --------
  // The animal sits on its home continent in the map (control of error); the
  // child taps the chip whose color matches that continent.
  function makeContinentMatch(continents, rng = Math.random) {
    if (!Array.isArray(continents) || continents.length < 3) throw new Error("makeContinentMatch needs >= 3 continents");
    const targetIndex = randInt(0, continents.length - 1, rng);
    const target = continents[targetIndex];
    const others = shuffle(continents.filter((c) => c.name !== target.name), rng).slice(0, 2);
    const choices = shuffle(
      [{ name: target.name, color: target.color, correct: true },
        ...others.map((c) => ({ name: c.name, color: c.color, correct: false }))],
      rng
    );
    return { targetIndex, animal: target.animal, name: target.name, choices };
  }

  // --- Sound Hunt (find the picture that starts with the target sound) -----
  function makeSoundHunt(words, size, rng = Math.random) {
    if (!Array.isArray(words) || words.length < 3) throw new Error("makeSoundHunt needs >= 3 words");
    size = size || 6;
    const w = words[randInt(0, words.length - 1, rng)];
    const distractors = shuffle(words.filter((x) => x.letter !== w.letter), rng).slice(0, size - 1);
    const cells = shuffle(
      [{ emoji: w.emoji, word: w.word, correct: true },
        ...distractors.map((d) => ({ emoji: d.emoji, word: d.word, correct: false }))],
      rng
    );
    return { letter: w.letter, word: w.word, emoji: w.emoji, cells };
  }

  // --- Bird's-Eye view (which top-down footprint matches the blocks) ------
  // A 2×2 table of block stacks (heights 1-2). Seen from directly ABOVE you see
  // only the FOOTPRINT — which of the 4 cells are occupied (height is a
  // distractor). The answer is that occupancy pattern; distractors are other
  // patterns.
  function makeTopView(rng = Math.random) {
    const k = randInt(2, 3, rng); // 2-3 occupied cells (never all 4 / never trivial 1)
    const occ = sample([0, 1, 2, 3], k, rng).sort((a, b) => a - b);
    // Every block is a SINGLE cube (height 1). Variable heights made the puzzle
    // ambiguous: in the isometric view the back cell (0) and front cell (3) share
    // a screen column, so a height-2 front block fully HID the back block — you
    // couldn't tell if that cell was occupied. Uniform height keeps the footprint
    // always fully visible, so every round is unambiguously solvable.
    const cells = occ.map((idx) => ({ r: idx >> 1, c: idx & 1, h: 1 }));
    const key = (arr) => [0, 1, 2, 3].map((i) => (arr.includes(i) ? "1" : "0")).join("");
    const correctKey = key(occ);
    // Enumerate all size-2..3 occupancy patterns, keep two distinct distractors.
    const subsets = [];
    for (let mask = 1; mask < 16; mask++) {
      const s = [0, 1, 2, 3].filter((i) => mask & (1 << i));
      if (s.length >= 2 && s.length <= 3) subsets.push(s);
    }
    const seen = new Set([correctKey]);
    const distractors = [];
    for (const s of shuffle(subsets, rng)) {
      const kk = key(s);
      if (!seen.has(kk)) { seen.add(kk); distractors.push(s); }
      if (distractors.length >= 2) break;
    }
    const choices = shuffle(
      [{ occ: occ.slice(), correct: true }, ...distractors.map((s) => ({ occ: s, correct: false }))],
      rng
    );
    return { cells, occ, choices };
  }

  // --- Web Rescue Reveal (clear webs to find trapped friends) -------------
  // A grid of web-covered cells; K hide a friend (correct), the rest are empty.
  // Revealing an empty is never "wrong" (no-fail) — you just rescue the K.
  function makeWebRescue(pool, size, rng = Math.random) {
    if (!Array.isArray(pool) || !pool.length) throw new Error("makeWebRescue needs a pool");
    size = size || 9;
    const K = Math.min(size, randInt(2, 4, rng));
    const friends = [];
    for (let i = 0; i < K; i++) friends.push(pool[randInt(0, pool.length - 1, rng)]);
    const cells = [];
    for (const f of friends) cells.push({ friend: f, correct: true });
    for (let i = 0; i < size - K; i++) cells.push({ friend: null, correct: false });
    return { count: K, cells: shuffle(cells, rng) };
  }

  // --- Spell My Name (scrambled letters to place left-to-right) -----------
  // Returns the name's letters plus a shuffled set of tiles. The game matches by
  // LETTER at the current position, so repeated letters (RAEGAR) are handled:
  // any not-yet-used tile of the needed letter is accepted.
  function makeNameSpell(letters, rng = Math.random) {
    const arr = String(letters).toUpperCase().split("");
    const tiles = shuffle(arr.map((letter, id) => ({ letter, id })), rng);
    return { letters: arr, tiles };
  }

  // --- Odd One Out by a single FEATURE (harder than a category outlier) ---
  // Three identical tiles + one that differs by ONE feature (orientation, colour).
  // Same family, so the child must actually discriminate, not just spot the kind.
  function makeOddFeature(sets, rng = Math.random) {
    if (!Array.isArray(sets) || !sets.length) throw new Error("makeOddFeature needs sets");
    const set = sets[randInt(0, sets.length - 1, rng)];
    const tiles = shuffle([
      { emoji: set.base, correct: false },
      { emoji: set.base, correct: false },
      { emoji: set.base, correct: false },
      { emoji: set.odd, correct: true },
    ], rng);
    return { tiles, base: set.base, odd: set.odd, feature: set.name };
  }

  // --- "a" vs "an" for a following word (kid-content grammar helper) ------
  // Any prompt that splices a word after "a"/"an" ("Make a " + name) must pick
  // the article by the word's SOUND, not just spelling, or it reads "a Island".
  // Vowel-letter start → "an"; consonant-letter start → "a"; plus the common
  // kid-word exceptions where letter and sound disagree (a unicorn, an hour).
  // Centralised here so every game (and every future game) stays grammatical.
  const AN_EXCEPTIONS = { hour: 1, honest: 1, honor: 1, honour: 1, heir: 1 };
  const A_EXCEPTIONS = {
    unicorn: 1, uniform: 1, unit: 1, university: 1, universe: 1, union: 1,
    use: 1, used: 1, useful: 1, user: 1, one: 1, once: 1, ukulele: 1,
    ufo: 1, european: 1, ewe: 1,
  };
  function article(word) {
    const w = String(word == null ? "" : word).trim().toLowerCase();
    if (!w) return "a";
    if (A_EXCEPTIONS[w]) return "a";
    if (AN_EXCEPTIONS[w]) return "an";
    return "aeiou".indexOf(w[0]) >= 0 ? "an" : "a";
  }

  // --- Tic-Tac-Toe winner -------------------------------------------------
  const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  function tttWinner(board) {
    for (const [a, b, c] of TTT_LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return null;
  }

  const API = {
    randInt, pickIndex, shuffle, sample, makeOddOneOut, makePattern, PATTERN_UNITS,
    makeSkipCount, makeTakeAway, makeCompare,
    makeFirstSound, makeRhyme, makeSightWord, makeCVC,
    makeShadowMatch, makeOrder, makeSort,
    makeAddition, makeNumberMatch, makeClock, tensOnes,
    makeLetterMatch, makeMissingLetter, makeSpotDifference,
    makeFindHero, makeCrowd, makeFindCount, tttWinner, TTT_LINES, makeTeen,
    makeMakeTen, makeBigAdd, makeWordPicture, makeDeduce, makeTwins, makeCategoryHunt, makeSolidMatch,
    makePiggyBank, makeNumberCompare, makeLatinSquare, makeRhymeHunt, makeNumberSequence,
    makeDigraphFinish, makeStoryOrder, makeConjunctionHunt,
    makeContinentMatch, makeSoundHunt, makeTopView, makeWebRescue, makeNameSpell,
    article, makeOddFeature,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else global.JoshLogic = API;
})(typeof window !== "undefined" ? window : globalThis);
