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
  // Letters whose LOWERCASE forms are visually identical on iOS Safari (SF Pro):
  // capital-i "I" and lowercase-L "l" both render as a bare vertical stroke, so
  // if "I" is the target and "l" a distractor, the true answer "i" (with a dot)
  // looks LESS like the target than the wrong "l" — a shape-matching non-reader
  // is pulled to the wrong tile. Never let two members of a confusable group be
  // the target + a distractor together. (Groups keyed by uppercase index.)
  const LETTER_CONFUSABLES = [[8, 11]]; // I / L  (lowercase "i" vs "l")
  function lettersConfusable(a, b) {
    return LETTER_CONFUSABLES.some((g) => g.indexOf(a) !== -1 && g.indexOf(b) !== -1);
  }
  function makeLetterMatch(rng = Math.random) {
    const i = randInt(0, 25, rng);
    const upper = ALPHABET[i];
    const used = new Set([i]);
    const wrongIdx = [];
    while (wrongIdx.length < 2) {
      const w = randInt(0, 25, rng);
      if (used.has(w)) continue;
      // No two of {target, distractor1, distractor2} may be a confusable pair —
      // so "i" and "l" can never share a board, whichever slots they'd land in.
      if (lettersConfusable(i, w) || wrongIdx.some((x) => lettersConfusable(x, w))) continue;
      used.add(w); wrongIdx.push(w);
    }
    const choices = shuffle([{ lower: upper.toLowerCase(), correct: true }, ...wrongIdx.map((w) => ({ lower: ALPHABET[w].toLowerCase(), correct: false }))], rng);
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
    const banned = new Set(cat.excludeFillers || []); // audit: a filler that is ALSO a member (✈️ in the sky) is never offered
    cats.forEach((c, i) => { if (i !== ci) c.items.forEach((e) => { if (!banned.has(e)) others.push(e); }); });
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

  // --- A REAL 4×4 sudoku (rows, columns AND 2×2 boxes each hold all 4) --------
  // makeLatinSquare only guarantees rows + columns, so a 2×2 box could repeat a
  // digit — fine for Josh's picture-squares, but 华丽's tile is titled 四宫数独
  // ("four-BOX sudoku"), so it needs the box constraint to be honest. Starts from
  // one valid solution and applies only box-preserving symmetries (symbol relabel,
  // row-swap within a band, col-swap within a stack, band/stack swap, transpose),
  // every one of which keeps it a valid sudoku. One cell is blanked; its answer is
  // the unique value that fits its row/column/box.
  function makeSudoku4(symbols, rng = Math.random) {
    if (!Array.isArray(symbols) || symbols.length < 4) throw new Error("makeSudoku4 needs >= 4 symbols");
    const s = sample(symbols, 4, rng); // 4 distinct symbols for indices 0..3
    let g = [[0, 1, 2, 3], [2, 3, 0, 1], [1, 0, 3, 2], [3, 2, 1, 0]]; // a valid 4×4 sudoku
    const swapRows = (a, b) => { const t = g[a]; g[a] = g[b]; g[b] = t; };
    const swapCols = (a, b) => g.forEach((row) => { const t = row[a]; row[a] = row[b]; row[b] = t; });
    if (rng() < 0.5) swapRows(0, 1);
    if (rng() < 0.5) swapRows(2, 3);
    if (rng() < 0.5) swapCols(0, 1);
    if (rng() < 0.5) swapCols(2, 3);
    if (rng() < 0.5) { swapRows(0, 2); swapRows(1, 3); } // swap the two bands
    if (rng() < 0.5) { swapCols(0, 2); swapCols(1, 3); } // swap the two stacks
    if (rng() < 0.5) g = g[0].map((_, c) => g.map((row) => row[c])); // transpose (still a valid sudoku)
    const grid = g.map((row) => row.map((v) => s[v]));
    const blankR = randInt(0, 3, rng), blankC = randInt(0, 3, rng);
    const answer = grid[blankR][blankC];
    const choices = shuffle(s.map((sym) => ({ sym, correct: sym === answer })), rng);
    return { grid, blankR, blankC, answer, choices, symbols: s, n: 4 };
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

  // --- Listen & Answer (pick which character has the asked-for object) ----
  // Picks a story + one of its (character, object) pairs to ask about; the answer
  // is that pair's character, and the choices are all the story's characters.
  function makeListen(stories, rng = Math.random) {
    if (!Array.isArray(stories) || !stories.length) throw new Error("makeListen needs stories");
    const st = stories[randInt(0, stories.length - 1, rng)];
    const askPair = st.pairs[randInt(0, st.pairs.length - 1, rng)];
    const choices = shuffle(st.pairs.map((p) => ({ c: p.c, correct: p.c === askPair.c })), rng);
    return { pairs: st.pairs, ask: askPair, choices };
  }

  // --- 🎨 Mix It! Paint Lab ------------------------------------------------
  // Pick a mix (never the same twice in a row) and 3 result choices: the true
  // result + 2 other mixes' results — every choice is a REAL mixable color.
  function makeColorMix(mixes, rng, lastIdx) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * mixes.length);
    if (mixes.length > 1 && idx === lastIdx) idx = (idx + 1) % mixes.length;
    const mix = mixes[idx];
    const others = shuffle(mixes.filter((m, i) => i !== idx).map((m) => m.out), rng).slice(0, 2);
    const choices = shuffle([{ ...mix.out, correct: true }, ...others.map((o) => ({ ...o, correct: false }))], rng);
    return { idx, mix, choices };
  }

  // --- 🛁 Sink or Float? ---------------------------------------------------
  // Pick an item from the shared truth set (never repeating), with its answer.
  function makeSinkFloat(set, rng, lastItem) {
    const rnd = rng || Math.random;
    const all = [];
    for (const bin of set.bins) for (const item of bin.items) all.push({ item, answer: bin.label === "Sinks" ? "sink" : "float", why: bin.why });
    let pool = all.filter((x) => x.item !== lastItem);
    if (!pool.length) pool = all;
    return pool[Math.floor(rnd() * pool.length)];
  }

  // --- 🐣 Mama & Baby ------------------------------------------------------
  function makeMamaBaby(pairs, rng, lastIdx) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * pairs.length);
    if (pairs.length > 1 && idx === lastIdx) idx = (idx + 1) % pairs.length;
    const pair = pairs[idx];
    const others = shuffle(pairs.filter((p, i) => i !== idx), rng).slice(0, 2);
    const choices = shuffle([{ emoji: pair.mama, name: pair.mamaName, correct: true },
      ...others.map((p) => ({ emoji: p.mama, name: p.mamaName, correct: false }))], rng);
    return { idx, pair, choices };
  }

  // --- 🍪 Fair Shares ------------------------------------------------------
  // A dealable round: friends × per = total treats, dealt one each in rotation.
  function makeFairShare(rng, hard) {
    const rnd = rng || Math.random;
    const friends = hard ? 3 : 2;
    const per = 2 + Math.floor(rnd() * 2); // 2..3 each
    return { friends, per, total: friends * per };
  }

  // --- 👀 Quick Peek (subitizing) -------------------------------------------
  // Dice-style dot layouts (percent positions) so 1-6 always LOOK canonical —
  // subitizing is pattern recognition, not counting.
  const PEEK_LAYOUTS = {
    1: [[50, 50]],
    2: [[30, 30], [70, 70]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[30, 30], [70, 30], [30, 70], [70, 70]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[30, 24], [70, 24], [30, 50], [70, 50], [30, 76], [70, 76]],
  };
  function makeQuickPeek(rng, max, lastN) {
    const rnd = rng || Math.random;
    const lo = 2, hi = Math.min(Math.max(max || 5, lo + 1), 6);
    let n = lo + Math.floor(rnd() * (hi - lo + 1));
    if (n === lastN) n = lo + ((n - lo + 1) % (hi - lo + 1));
    const opts = new Set([n]);
    while (opts.size < 3) {
      const d = Math.max(1, Math.min(6, n + (Math.floor(rnd() * 5) - 2)));
      opts.add(d);
    }
    const choices = shuffle([...opts].map((v) => ({ n: v, correct: v === n })), rng);
    return { n, dots: PEEK_LAYOUTS[n], choices };
  }

  // --- 🚂 Alphabet Train (reuses the shared ALPHABET const above) ----------
  function makeAlphaTrain(rng, lastStart) {
    const rnd = rng || Math.random;
    // A 4-letter window can start anywhere from A..W so the last window is WXYZ —
    // (length - 3) starts in all, which lets Z finally appear (it used to be
    // unreachable because the range stopped one window short).
    const windows = ALPHABET.length - 3;
    let start = Math.floor(rnd() * windows);
    if (start === lastStart) start = (start + 3) % windows;
    const letters = ALPHABET.slice(start, start + 4).split("");
    const blankIdx = 1 + Math.floor(rnd() * 3); // never the first car (an anchor stays)
    const answer = letters[blankIdx];
    const opts = new Set([answer]);
    while (opts.size < 3) {
      const off = Math.floor(rnd() * 7) - 3;
      const j = Math.min(ALPHABET.length - 1, Math.max(0, start + blankIdx + off));
      opts.add(ALPHABET[j]);
    }
    const choices = shuffle([...opts].map((ch) => ({ ch, correct: ch === answer })), rng);
    return { start, letters, blankIdx, answer, choices };
  }

  // --- 🔎 Letter Hunt ------------------------------------------------------
  // A field of letter balloons: `need` copies of the target (lowercase mixed in
  // once ramped), the rest clearly-different distractor letters.
  function makeLetterHunt(letters, rng, opts) {
    opts = opts || {};
    const rnd = rng || Math.random;
    let target = letters[Math.floor(rnd() * letters.length)];
    if (target === opts.lastTarget) target = letters[(letters.indexOf(target) + 1) % letters.length];
    // A game may pin the target (e.g. 找福字 always hunts 福) so the tile title
    // and the round always agree; distractors are still the other letters.
    if (opts.target && letters.indexOf(opts.target) !== -1) target = opts.target;
    const size = opts.size || 9;
    const need = opts.need || 3;
    const distractors = shuffle(letters.filter((l) => l !== target), rng);
    const cells = [];
    for (let i = 0; i < need; i++) {
      const lower = opts.mixCase && i % 2 === 1; // ramped: every other target is lowercase
      cells.push({ ch: lower ? target.toLowerCase() : target, correct: true });
    }
    for (let i = 0; cells.length < size; i++) cells.push({ ch: distractors[i % distractors.length], correct: false });
    return { target, need, cells: shuffle(cells, rng) };
  }

  // --- 🧩 Which Piece Fits? -------------------------------------------------
  // A hole shaped like one of the SHAPES; 3 piece choices, one matching.
  function makePieceFit(shapes, rng, lastName) {
    const rnd = rng || Math.random;
    let pool = shapes.filter((s) => s.name !== lastName);
    if (!pool.length) pool = shapes.slice();
    const shape = pool[Math.floor(rnd() * pool.length)];
    const others = shuffle(shapes.filter((s) => s.name !== shape.name), rng).slice(0, 2);
    const choices = shuffle([{ ...shape, correct: true }, ...others.map((s) => ({ ...s, correct: false }))], rng);
    return { shape, choices };
  }

  // --- ☁️ Who Hid? ----------------------------------------------------------
  // A lineup of 4 distinct characters; one hides behind a cloud. The choices
  // are all FROM the lineup (the visible three eliminate themselves — the
  // self-checking Montessori way).
  function makeWhoHid(pool, rng) {
    const lineup = sample(pool, 4, rng);
    const hiddenIdx = Math.floor((rng || Math.random)() * 4);
    const hidden = lineup[hiddenIdx];
    const others = shuffle(lineup.filter((c, i) => i !== hiddenIdx), rng).slice(0, 2);
    const choices = shuffle([{ ...hidden, correct: true }, ...others.map((c) => ({ ...c, correct: false }))], rng);
    return { lineup, hiddenIdx, choices };
  }

  // --- 🥁 Copy My Beat ------------------------------------------------------
  // A drum sequence over 3 drums, no two consecutive hits the same (clearer to
  // echo). Order-only — timing is never part of the task.
  function makeBeat(rng, len) {
    const rnd = rng || Math.random;
    const n = Math.max(2, Math.min(4, len || 2));
    const seq = [];
    for (let i = 0; i < n; i++) {
      let d = Math.floor(rnd() * 3);
      if (i > 0 && d === seq[i - 1]) d = (d + 1) % 3;
      seq.push(d);
    }
    return { seq };
  }

  // --- 😊 How Do They Feel? -------------------------------------------------
  function makeFeeling(feelings, stories, rng, lastIdx) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * stories.length);
    if (stories.length > 1 && idx === lastIdx) idx = (idx + 1) % stories.length;
    const story = stories[idx];
    const correct = feelings.find((f) => f.id === story.feel);
    const others = shuffle(feelings.filter((f) => f.id !== story.feel), rng).slice(0, 2);
    const choices = shuffle([{ ...correct, correct: true }, ...others.map((f) => ({ ...f, correct: false }))], rng);
    return { idx, story, choices };
  }

  // --- 🤝 Kind Helpers ------------------------------------------------------
  function makeKindness(scenarios, rng, lastIdx) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * scenarios.length);
    if (scenarios.length > 1 && idx === lastIdx) idx = (idx + 1) % scenarios.length;
    const scenario = scenarios[idx];
    return { idx, scenario, options: shuffle(scenario.options.slice(), rng) };
  }

  // --- 📅 Day Train ---------------------------------------------------------
  // The week with one missing day (never the first car — Sunday anchors the
  // sequence); choices are the answer + its two calendar neighbours.
  function makeDayTrain(days, rng, lastBlank) {
    const rnd = rng || Math.random;
    let blankIdx = 1 + Math.floor(rnd() * (days.length - 1));
    if (blankIdx === lastBlank) blankIdx = 1 + (blankIdx % (days.length - 1));
    const answer = days[blankIdx];
    const opts = new Set([blankIdx]);
    while (opts.size < 3) {
      const d = Math.min(days.length - 1, Math.max(0, blankIdx + (Math.floor(rnd() * 5) - 2)));
      opts.add(d);
    }
    const choices = shuffle([...opts].map((i) => ({ ...days[i], correct: i === blankIdx })), rng);
    return { blankIdx, answer, choices };
  }

  // --- 🌦️ Dress Me! ---------------------------------------------------------
  // The right gear for this weather + the OTHER weathers' gear as (silly)
  // distractors — mittens in the sunshine is a giggle, not a trap.
  function makeWeather(weathers, rng, lastIdx) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * weathers.length);
    if (weathers.length > 1 && idx === lastIdx) idx = (idx + 1) % weathers.length;
    const weather = weathers[idx];
    const others = shuffle(weathers.filter((w, i) => i !== idx), rng).slice(0, 2);
    const choices = shuffle([{ emoji: weather.gear, name: weather.gearName, correct: true },
      ...others.map((w) => ({ emoji: w.gear, name: w.gearName, correct: false }))], rng);
    return { idx, weather, choices };
  }

  // --- 🌈 Season Windows ----------------------------------------------------
  function makeSeasonItem(seasons, rng, lastItem) {
    const rnd = rng || Math.random;
    const all = [];
    seasons.forEach((s, si) => s.items.forEach((item) => all.push({ item, seasonIdx: si, seasonName: s.name })));
    let pool = all.filter((x) => x.item !== lastItem);
    if (!pool.length) pool = all;
    return pool[Math.floor(rnd() * pool.length)];
  }

  // --- 华丽's games: generic + Chinese-content round makers -----------------

  // A window of `win` consecutive items from an ordered list with ONE blank
  // (never the first slot — an anchor always shows). Generic: mahjong runs,
  // the zodiac train, moon phases… choices = the answer + near neighbours.
  function makeOrderTrain(list, rng, opts) {
    opts = opts || {};
    const rnd = rng || Math.random;
    const win = Math.max(3, Math.min(opts.window || 4, list.length));
    let start = Math.floor(rnd() * (list.length - win + 1));
    if (start === opts.lastStart && list.length - win > 0) start = (start + 1) % (list.length - win + 1);
    const items = list.slice(start, start + win);
    const blankIdx = 1 + Math.floor(rnd() * (win - 1));
    const answerIdx = start + blankIdx;
    const opt = new Set([answerIdx]);
    while (opt.size < 3) {
      const j = Math.min(list.length - 1, Math.max(0, answerIdx + (Math.floor(rnd() * 5) - 2)));
      opt.add(j);
    }
    const choices = shuffle([...opt].map((j) => ({ value: list[j], correct: j === answerIdx })), rng);
    return { start, items, blankIdx, answer: list[answerIdx], choices };
  }

  // 成语填空: blank one character of a real idiom; choices = the true character
  // + the idiom's own curated wrong characters.
  function makeIdiomFill(idioms, rng, lastIdx) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * idioms.length);
    if (idioms.length > 1 && idx === lastIdx) idx = (idx + 1) % idioms.length;
    const idiom = idioms[idx];
    const answer = idiom.text[idiom.blank];
    const display = idiom.text.split("").map((ch, i) => (i === idiom.blank ? "▢" : ch)).join("");
    const choices = shuffle([{ ch: answer, correct: true }, ...idiom.wrong.map((ch) => ({ ch, correct: false }))], rng);
    return { idx, idiom, display, answer, choices };
  }

  // 唐诗接句: show one line, pick the TRUE next line among lines from other poems.
  function makePoemNext(poems, rng, lastKey) {
    const rnd = rng || Math.random;
    const all = [];
    poems.forEach((p, pi) => { for (let li = 0; li < p.lines.length - 1; li++) all.push({ pi, li }); });
    let pool = all.filter(({ pi, li }) => pi + ":" + li !== lastKey);
    if (!pool.length) pool = all;
    const pick = pool[Math.floor(rnd() * pool.length)];
    const poem = poems[pick.pi];
    const prompt = poem.lines[pick.li];
    const answer = poem.lines[pick.li + 1];
    const others = shuffle(
      poems.filter((p, pi) => pi !== pick.pi).flatMap((p) => p.lines), rng
    ).slice(0, 2);
    const choices = shuffle([{ line: answer, correct: true }, ...others.map((line) => ({ line, correct: false }))], rng);
    return { key: pick.pi + ":" + pick.li, poem, prompt, answer, choices };
  }

  // 量词搭配: the noun's one true measure word + two other nouns' measure words.
  function makeMeasureWord(pairs, rng, lastIdx) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * pairs.length);
    if (pairs.length > 1 && idx === lastIdx) idx = (idx + 1) % pairs.length;
    const pair = pairs[idx];
    // A distractor measure word must be UNIQUELY wrong for this noun. Some nouns
    // legitimately take more than one 量词 (e.g. 鞋 → 双 for a pair but 只 for a
    // single shoe); pair.alsoOk lists those so they can never be offered as a
    // "wrong" answer that is actually valid.
    const alsoOk = pair.alsoOk || [];
    const others = shuffle(
      [...new Set(pairs.filter((p, i) => i !== idx).map((p) => p.mw))]
        .filter((mw) => mw !== pair.mw && alsoOk.indexOf(mw) === -1),
      rng
    ).slice(0, 2);
    const choices = shuffle([{ mw: pair.mw, correct: true }, ...others.map((mw) => ({ mw, correct: false }))], rng);
    return { idx, pair, choices };
  }

  // Generic "prompt → pick its partner" (antonyms 大↔小, dish → its city, …).
  // Items are {q, a}; choices are three DISTINCT `a` values.
  function makePairPick(items, rng, lastIdx) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * items.length);
    if (items.length > 1 && idx === lastIdx) idx = (idx + 1) % items.length;
    const item = items[idx];
    // `avoid` (audit): an item may list answers that are ALSO defensible for its
    // prompt (Opposites' big vs a small-looking 🐌; rain also opens sunflowers) —
    // those can never be offered as its distractors.
    const others = shuffle([...new Set(items.filter((p, i) => i !== idx).map((p) => p.a))].filter((a) => a !== item.a && !(item.avoid || []).includes(a)), rng).slice(0, 2);
    const choices = shuffle([{ a: item.a, correct: true }, ...others.map((a) => ({ a, correct: false }))], rng);
    return { idx, item, choices };
  }

  // 记菜单: memorize k dishes, then find exactly those k among n cards.
  function makeMenuMemory(dishes, rng, opts) {
    opts = opts || {};
    const rnd = rng || Math.random;
    const n = Math.min(opts.n || 6, dishes.length);
    const k = Math.min(opts.k || 3, n - 1);
    const board = sample(dishes, n, rng);
    const menu = sample(board, k, rng);
    const wanted = new Set(menu);
    return { menu, cells: shuffle(board.map((name) => ({ name, correct: wanted.has(name) })), rng), k, n };
  }

  // 买菜算账: two market items, add the prices.
  function makeMarket(items, rng) {
    const rnd = rng || Math.random;
    const [a, b] = sample(items, 2, rng);
    const total = a.price + b.price;
    const opt = new Set([total]);
    while (opt.size < 3) {
      const d = Math.max(1, total + (Math.floor(rnd() * 5) - 2));
      opt.add(d);
    }
    const choices = shuffle([...opt].map((n) => ({ n, correct: n === total })), rng);
    return { a, b, total, choices };
  }

  // 找零钱: pay with a 10元 note, get the right change back.
  function makeChange(rng, lastCost) {
    const rnd = rng || Math.random;
    let cost = 2 + Math.floor(rnd() * 8); // 2..9 元
    if (cost === lastCost) cost = 2 + (cost - 1) % 8;
    const change = 10 - cost;
    const opt = new Set([change]);
    while (opt.size < 3) {
      const d = Math.max(1, Math.min(9, change + (Math.floor(rnd() * 5) - 2)));
      opt.add(d);
    }
    const choices = shuffle([...opt].map((n) => ({ n, correct: n === change })), rng);
    return { pay: 10, cost, change, choices };
  }

  // 找不同的字: a grid of one character with ONE lookalike hiding in it
  // (我我我找我我 — the classic). Pairs are curated lookalikes; either member
  // may play the crowd or the hider.
  function makeCharCrowd(pairs, size, rng) {
    const rnd = rng || Math.random;
    size = size || 9;
    const pair = pairs[Math.floor(rnd() * pairs.length)];
    const flip = rnd() < 0.5;
    const base = flip ? pair.a : pair.b;
    const odd = flip ? pair.b : pair.a;
    const oddIndex = Math.floor(rnd() * size);
    const cells = [];
    for (let i = 0; i < size; i++) cells.push({ ch: i === oddIndex ? odd : base, correct: i === oddIndex });
    return { base, odd, cells, oddIndex };
  }

  // --- 该填几 (missing addend): a + ? = sum, mental-math style ------------
  function makeMissingAddend(rng, opts) {
    opts = opts || {};
    const max = opts.max || 9;
    const a = randInt(2, max, rng);
    const answer = randInt(1, max, rng);
    const sum = a + answer;
    // Two near-miss distractors, always positive and distinct from the answer.
    const w1 = answer + 1;
    const w2 = answer > 1 ? answer - 1 : answer + 2;
    const choices = shuffle(
      [{ n: answer, correct: true }, { n: w1, correct: false }, { n: w2, correct: false }],
      rng
    );
    return { a, sum, answer, choices };
  }

  // --- Tic-Tac-Toe winner -------------------------------------------------
  const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  function tttWinner(board) {
    for (const [a, b, c] of TTT_LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return null;
  }

  // ================= Road to 140 — Wave 2 logic =================
  // A nickel is worth 5 pennies: 3 piles, counts distinct, exactly one === 5.
  function makeCoinTrade(rng = Math.random) {
    const value = 5;
    const used = new Set([value]);
    const wrongs = [];
    while (wrongs.length < 2) { const w = randInt(1, 9, rng); if (!used.has(w)) { used.add(w); wrongs.push(w); } }
    const piles = shuffle([{ count: value, correct: true }, ...wrongs.map((count) => ({ count, correct: false }))], rng);
    return { value, piles };
  }
  // Doubles: n + n. Sum is always 2n; 3 distinct positive choices.
  function makeDouble(rng = Math.random, max = 5) {
    const n = randInt(1, Math.max(1, max), rng);
    const sum = 2 * n;
    const opt = new Set([sum]);
    const deltas = [1, -1, 2, -2, 3];
    let di = 0;
    while (opt.size < 3 && di < 30) { const d = sum + deltas[di % deltas.length]; di++; if (d >= 1) opt.add(d); }
    const choices = shuffle([...opt].map((v) => ({ n: v, correct: v === sum })), rng);
    return { n, sum, choices };
  }
  // Three rows of distinct length (pairwise gap >= 2); ask longest/shortest.
  function makeLengthPick(rng, last) {
    const rnd = rng || Math.random;
    const base = 2 + Math.floor(rnd() * 3);
    const lens = shuffle([base, base + 2, base + 4], rng);
    let ask = rnd() < 0.5 ? "longest" : "shortest";
    if (ask === last) ask = ask === "longest" ? "shortest" : "longest";
    const target = ask === "longest" ? Math.max.apply(null, lens) : Math.min.apply(null, lens);
    let flagged = false;
    const rows = lens.map((len) => { const c = !flagged && len === target; if (c) flagged = true; return { len, correct: c }; });
    return { ask, rows };
  }
  // Descending order: order 0 is the LARGEST value (tap-first).
  function makeCountdown(len, rng = Math.random) {
    len = Math.max(3, Math.min(len || 5, 10));
    const items = [];
    for (let i = 0; i < len; i++) items.push({ value: len - i, order: i });
    return { len, items: shuffle(items, rng) };
  }
  // Seesaw: the heavier side is DOWN. Ask heavier/lighter; exactly one correct.
  function makeSeesaw(pairs, rng, lastIdx) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * pairs.length);
    if (pairs.length > 1 && idx === lastIdx) idx = (idx + 1) % pairs.length;
    const pair = pairs[idx];
    const ask = rnd() < 0.5 ? "heavier" : "lighter";
    const heavyLeft = rnd() < 0.5;
    const heavySide = { emoji: pair.heavy, name: pair.heavyName, heavy: true };
    const lightSide = { emoji: pair.light, name: pair.lightName, heavy: false };
    const sides = heavyLeft ? [heavySide, lightSide] : [lightSide, heavySide];
    const correctIdx = sides.findIndex((s) => (ask === "heavier" ? s.heavy : !s.heavy));
    return { idx, pair, ask, sides, heavyLeft, correctIdx };
  }
  // Count the sides of a shape (circle = 0). 3 distinct numeral choices.
  function makeSideCount(shapes, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * shapes.length);
    if (shapes.length > 1 && idx === last) idx = (idx + 1) % shapes.length;
    const shape = shapes[idx];
    const sides = shape.sides;
    const opt = new Set([sides]);
    const cand = [sides + 1, sides - 1, sides + 2, 3, 4, 0];
    let ci = 0;
    while (opt.size < 3 && ci < 40) { const d = cand[ci % cand.length]; ci++; if (d >= 0 && d !== sides) opt.add(d); }
    const choices = shuffle([...opt].map((v) => ({ n: v, correct: v === sides })), rng);
    return { idx, shape, sides, choices };
  }
  // Ending sound: mirror of makeFirstSound (the word's LAST letter).
  function makeEndSound(words, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * words.length);
    if (words.length > 1 && idx === last) idx = (idx + 1) % words.length;
    const w = words[idx];
    const others = shuffle([...new Set(words.filter((x, i) => i !== idx).map((x) => x.letter))].filter((l) => l !== w.letter), rng).slice(0, 2);
    const choices = shuffle([{ letter: w.letter, correct: true }, ...others.map((letter) => ({ letter, correct: false }))], rng);
    return { idx, word: w, choices };
  }
  // Missing middle vowel of a pictured CVC word.
  function makeVowelPick(words, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * words.length);
    if (words.length > 1 && idx === last) idx = (idx + 1) % words.length;
    const w = words[idx];
    const vowelIdx = 1; // CVC middle
    const display = w.word.split("").map((ch, i) => (i === vowelIdx ? "▢" : ch)).join("");
    const VOWELS = ["a", "e", "i", "o", "u"];
    const others = shuffle(VOWELS.filter((v) => v !== w.vowel), rng).slice(0, 2);
    const choices = shuffle([{ v: w.vowel, correct: true }, ...others.map((v) => ({ v, correct: false }))], rng);
    return { idx, word: w, display, vowelIdx, choices };
  }
  // Word families: sort a pictured word to its rime house (2 bins per round).
  function makeFamilySort(sets, rng = Math.random) {
    const set = sets[randInt(0, sets.length - 1, rng)];
    const bi = randInt(0, set.bins.length - 1, rng);
    const items = set.bins[bi].words;
    const item = items[randInt(0, items.length - 1, rng)];
    return { item, bins: set.bins.map((b) => ({ label: b.label })), correctIndex: bi, setName: set.name };
  }

  // ================= Road to 140 — Wave 3 logic =================
  // Pattern interpolation: the blank is in the MIDDLE (context on both sides).
  function makePatternFix(pair, allTokens, rng = Math.random) {
    const unitIdx = PATTERN_UNITS[randInt(0, PATTERN_UNITS.length - 1, rng)];
    const unit = unitIdx.map((i) => pair[i]);
    const shownCount = 2 * unit.length + randInt(0, unit.length - 1, rng);
    const cells = [];
    for (let i = 0; i < shownCount; i++) cells.push(unit[i % unit.length]);
    const blankIdx = 1 + randInt(0, cells.length - 3, rng); // never first or last
    const answer = cells[blankIdx];
    const tokens = new Set(pair);
    if (Array.isArray(allTokens)) { const pool = allTokens.filter((t) => !tokens.has(t)); if (pool.length) tokens.add(pool[randInt(0, pool.length - 1, rng)]); }
    const choices = shuffle([...tokens].map((t) => ({ token: t, correct: t === answer })), rng);
    return { cells, blankIdx, answer, choices };
  }
  // 2×2 attribute matrix (rows = size, cols = color); complete the bottom-right.
  function makeMatrix2(rng = Math.random, opts) {
    opts = opts || {};
    const colorsAll = opts.colors || [{ key: "red", hex: "#e23636" }, { key: "blue", hex: "#2b6cff" }, { key: "green", hex: "#38b000" }, { key: "yellow", hex: "#f4c430" }];
    const cols = sample(colorsAll, 2, rng);
    const sizes = ["big", "small"];
    const shown = [
      { size: "big", color: cols[0] }, { size: "big", color: cols[1] },
      { size: "small", color: cols[0] },
    ];
    const missing = { size: "small", color: cols[1] };
    const all = [];
    for (const s of sizes) for (const c of cols) all.push({ size: s, color: c });
    const distractors = shuffle(all.filter((x) => !(x.size === missing.size && x.color.key === missing.color.key)), rng).slice(0, 2);
    const choices = shuffle([Object.assign({ correct: true }, missing), ...distractors.map((d) => Object.assign({ correct: false }, d))], rng);
    return { cols, sizes, shown, missing, choices };
  }
  // Left or Right (the star may be a decoy — the question is about SIDES).
  function makeLeftRight(rng, last) {
    const rnd = rng || Math.random;
    let side = rnd() < 0.5 ? "left" : "right";
    if (side === last) side = side === "left" ? "right" : "left";
    const starSide = rnd() < 0.5 ? "left" : "right";
    return { side, starSide, correctIdx: side === "left" ? 0 : 1 };
  }
  // Count the blocks (single-height iso layouts, so every top face is visible).
  function makeBlockCount(layouts, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * layouts.length);
    if (layouts.length > 1 && idx === last) idx = (idx + 1) % layouts.length;
    const cells = layouts[idx];
    const n = cells.length;
    const opt = new Set([n]);
    const cand = [n + 1, n - 1, n + 2, n - 2];
    let ci = 0;
    while (opt.size < 3 && ci < 20) { const d = cand[ci % cand.length]; ci++; if (d >= 1 && d !== n) opt.add(d); }
    const choices = shuffle([...opt].map((v) => ({ n: v, correct: v === n })), rng);
    return { idx, cells, n, choices };
  }
  // Mental rotation: the correct choice is the SAME asymmetric shape, rotated.
  function makeTurnMatch(shapes, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * shapes.length);
    if (shapes.length > 1 && idx === last) idx = (idx + 1) % shapes.length;
    const target = shapes[idx];
    const rots = [90, 180, 270];
    const others = shuffle(shapes.filter((s, i) => i !== idx), rng).slice(0, 2);
    const choices = shuffle([
      { shape: target, rot: rots[Math.floor(rnd() * rots.length)], correct: true },
      ...others.map((s) => ({ shape: s, rot: rots[Math.floor(rnd() * rots.length)], correct: false })),
    ], rng);
    return { idx, target, choices };
  }
  // Build the sentence: word tiles shuffled with true ranks (dupes ok by rank).
  function makeSentence(sentences, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * sentences.length);
    if (sentences.length > 1 && idx === last) idx = (idx + 1) % sentences.length;
    const s = sentences[idx];
    const tiles = shuffle(s.words.map((word, rank) => ({ word, rank })), rng);
    return { idx, words: s.words, emoji: s.emoji, tiles };
  }
  // Silly stories: exactly one card matches BOTH the animal and the item.
  function makeSilly(scenes, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * scenes.length);
    if (scenes.length > 1 && idx === last) idx = (idx + 1) % scenes.length;
    const scene = scenes[idx];
    const otherAnimals = scenes.filter((s) => s.animal !== scene.animal).map((s) => s.animal);
    const otherItems = scenes.filter((s) => s.item !== scene.item).map((s) => s.item);
    const dAnimal = otherAnimals[Math.floor(rnd() * otherAnimals.length)];
    const dItem = otherItems[Math.floor(rnd() * otherItems.length)];
    const choices = shuffle([
      { animal: scene.animal, item: scene.item, correct: true },
      { animal: dAnimal, item: scene.item, correct: false },
      { animal: scene.animal, item: dItem, correct: false },
    ], rng);
    return { idx, scene, choices };
  }
  // More-in-scene: two kinds at distinct counts (2..5); answer is the bigger.
  function makeSceneCompare(kinds, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * kinds.length);
    if (kinds.length > 1 && idx === last) idx = (idx + 1) % kinds.length;
    const kind = kinds[idx];
    const na = 2 + Math.floor(rnd() * 4);
    let nb = 2 + Math.floor(rnd() * 4);
    while (nb === na) nb = 2 + Math.floor(rnd() * 4);
    return { idx, a: { emoji: kind.a, n: na }, b: { emoji: kind.b, n: nb }, answerIdx: na > nb ? 0 : 1 };
  }
  // Two-clue deduction: a (kind + color) clue pair narrows 6 unique cards to one.
  function makeClueHunt(cards, rng) {
    const rnd = rng || Math.random;
    const answerIdx = Math.floor(rnd() * cards.length);
    const answer = cards[answerIdx];
    return { cards, answerIdx, answer, clues: [{ type: "kind", value: answer.kind }, { type: "color", value: answer.color }] };
  }
  // Consecutive alphabet run of `len` letters (whole alphabet reachable).
  function alphaRun(rng, len) {
    const rnd = rng || Math.random;
    len = Math.max(2, Math.min(len || 8, 26));
    const start = Math.floor(rnd() * (26 - len + 1));
    return ALPHABET.slice(start, start + len).split("");
  }
  // ================= Road to 140 — Wave 4 logic =================
  // Who Eats This? — pick the food's eater; distractors are animals NOT in the
  // food's `eaters` list (the no-distractor-is-also-correct discipline).
  function makeWhoEats(items, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * items.length);
    if (items.length > 1 && idx === last) idx = (idx + 1) % items.length;
    const food = items[idx];
    // Every animal that appears anywhere, minus any that can eat THIS food.
    const eaterSet = new Set(food.eaters);
    const pool = [];
    for (const it of items) for (const a of it.eaters) if (!eaterSet.has(a) && !pool.includes(a)) pool.push(a);
    const distractors = shuffle(pool, rng).slice(0, 2);
    const choices = shuffle([
      { animal: food.answer, correct: true },
      ...distractors.map((a) => ({ animal: a, correct: false })),
    ], rng);
    return { idx, food, choices };
  }
  // Simon-Says body part picker — a plain no-repeat picker over labelled zones.
  function makePartPick(parts, rng, last) {
    const rnd = rng || Math.random;
    let correctIdx = Math.floor(rnd() * parts.length);
    if (parts.length > 1 && correctIdx === last) correctIdx = (correctIdx + 1) % parts.length;
    return { part: parts[correctIdx], correctIdx };
  }
  // ================= Road to 180 — Set 2 logic =================
  // Who Uses This? — pick the helper for a tool; distractors are helpers NOT in
  // the tool's `users` list (the who-eats / no-also-correct discipline).
  function makeHelperTool(items, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * items.length);
    if (items.length > 1 && idx === last) idx = (idx + 1) % items.length;
    const item = items[idx];
    const userSet = new Set(item.users);
    const pool = [];
    for (const it of items) if (!userSet.has(it.helper) && !pool.includes(it.helper)) pool.push(it.helper);
    const distractors = shuffle(pool, rng).slice(0, 2);
    const choices = shuffle([
      { helper: item.helper, name: item.helperName, correct: true },
      ...distractors.map((h) => ({ helper: h, name: null, correct: false })),
    ], rng);
    return { idx, item, choices };
  }
  // Little helper: 3 number chips around a target (all >=1, distinct).
  function numChoices(t, rng) {
    const opt = new Set([t]);
    const cand = [t + 1, t - 1, t + 2, t - 2];
    let ci = 0;
    while (opt.size < 3 && ci < 20) { const d = cand[ci % cand.length]; ci++; if (d >= 1 && d !== t) opt.add(d); }
    return shuffle([...opt].map((v) => ({ n: v, correct: v === t })), rng);
  }
  // Coin Mix-Up — a nickel (5) plus 1-4 pennies; total 6-9.
  function makeCoinMix(rng, last) {
    const rnd = rng || Math.random;
    let pennies = 1 + Math.floor(rnd() * 4);
    if (5 + pennies === last) pennies = 1 + (pennies % 4);
    const total = 5 + pennies;
    return { pennies, total, choices: numChoices(total, rng) };
  }
  // Ordinal position — first..last, counted from the fixed front (index 0).
  function makeOrdinal(rng, opts) {
    opts = opts || {};
    const rnd = rng || Math.random;
    const len = opts.len || (4 + Math.floor(rnd() * 2));
    let ord = 1 + Math.floor(rnd() * len);
    if (ord === opts.last) ord = ord === len ? 1 : ord + 1;
    return { len, ord, correctIdx: ord - 1 };
  }
  // More or Fewer than 5 — n is NEVER exactly 5.
  function makeAboutFive(rng, last) {
    const rnd = rng || Math.random;
    const pool = [2, 3, 4, 6, 7, 8];
    let n = pool[Math.floor(rnd() * pool.length)];
    if (n === last) n = pool[(pool.indexOf(n) + 1) % pool.length];
    return { n, answerIdx: n < 5 ? 0 : 1 };
  }
  // Pictograph — 3 columns of distinct heights (2-5); ask most/least (alternates).
  function makeGraphPick(kinds, rng, last) {
    const picks = sample(kinds, 3, rng);
    const heights = shuffle([2, 3, 4, 5], rng).slice(0, 3);
    const cols = picks.map((e, i) => ({ emoji: e, n: heights[i] }));
    const ask = last === "most" ? "least" : "most";
    let answerIdx = 0;
    for (let i = 1; i < cols.length; i++) {
      if (ask === "most" ? cols[i].n > cols[answerIdx].n : cols[i].n < cols[answerIdx].n) answerIdx = i;
    }
    return { cols, ask, answerIdx };
  }
  // Fullest / emptiest — 3 glasses at distinct fill levels (30% apart).
  function makeGlassPick(rng, last) {
    const fills = shuffle([20, 50, 80], rng);
    const ask = last === "full" ? "empty" : "full";
    const target = ask === "full" ? Math.max(...fills) : Math.min(...fills);
    return { fills, ask, answerIdx: fills.indexOf(target) };
  }
  // Partner Up — n ducks (3-6); parity is the taught outcome.
  function makePartnerUp(rng, last) {
    const rnd = rng || Math.random;
    let n = 3 + Math.floor(rnd() * 4);
    if (n === last) n = n === 6 ? 3 : n + 1;
    return { n, parity: n % 2 === 0 ? "even" : "odd" };
  }
  // Categorize-then-count — k members (2-5) of ONE category among fillers drawn
  // ONLY from other (disjoint) categories, so a filler is never a member.
  function makeCategoryCount(cats, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * cats.length);
    if (cats.length > 1 && idx === last) idx = (idx + 1) % cats.length;
    const cat = cats[idx];
    const k = Math.min(2 + Math.floor(rnd() * 4), cat.items.length);
    const members = sample(cat.items, k, rng);
    const banned2 = new Set(cat.excludeFillers || []); // audit: same filler exclusion as makeCategoryHunt
    const others = cats.filter((_, i) => i !== idx).reduce((a, c) => a.concat(c.items), []).filter((e) => !banned2.has(e));
    const fillers = sample(others, Math.min(3 + Math.floor(rnd() * 3), others.length), rng);
    const cells = shuffle(members.map((e) => ({ e, member: true })).concat(fillers.map((e) => ({ e, member: false }))), rng);
    return { idx, cat, k: members.length, cells, choices: numChoices(members.length, rng) };
  }
  // Size discrimination — 7 distinct glyph sizes; ask biggest/tiniest (alternates).
  function makeSizePick(rng, last) {
    const sizes = shuffle([20, 26, 32, 38, 44, 50, 56], rng);
    const ask = last === "biggest" ? "tiniest" : "biggest";
    const target = ask === "biggest" ? Math.max(...sizes) : Math.min(...sizes);
    return { sizes, ask, answerIdx: sizes.indexOf(target) };
  }
  // ================= Road to 180 — Set 2, Wave 7 logic =================
  // Copy My Picture — pick a target 3×3 pattern (bool[9]) to recreate (toggle B).
  function makeCopyGrid(patterns, rng, last, cells) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * patterns.length);
    if (patterns.length > 1 && idx === last) idx = (idx + 1) % patterns.length;
    let model = patterns[idx].slice();
    // peek-copy passes a cell budget (2|3): trim lit cells to the smallest few.
    if (cells) {
      const lit = model.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
      if (lit.length > cells) {
        const keep = new Set(sample(lit, cells, rng));
        model = model.map((v, i) => v && keep.has(i));
      }
    }
    return { idx, model };
  }
  // Finish the Butterfly — the play half is the mirror of the shown half across
  // an axis ("row" = the horizontal fold used by the vertical stack layout).
  function makeMirrorHalf(patterns, rng, last, axis) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * patterns.length);
    if (patterns.length > 1 && idx === last) idx = (idx + 1) % patterns.length;
    const left = patterns[idx].slice();
    const target = new Array(9);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const sr = axis === "row" ? 2 - r : r;
        const sc = axis === "col" ? 2 - c : c;
        target[r * 3 + c] = left[sr * 3 + sc];
      }
    }
    return { idx, left, target };
  }
  // Will It Fit? — exactly ONE item is smaller than the box; the other two are at
  // least box×1.3 (never a judgment call).
  function makeFitsInside(rng, last) {
    const rnd = rng || Math.random;
    const small = 0.5 + rnd() * 0.32; // 0.50 – 0.82  (< 1)
    const big1 = 1.3 + rnd() * 0.35;  // 1.30 – 1.65  (>= box × 1.3)
    const big2 = 1.3 + rnd() * 0.35;
    const items = shuffle([
      { scale: small, correct: true },
      { scale: big1, correct: false },
      { scale: big2, correct: false },
    ], rng);
    return { boxScale: 1, items };
  }
  // Which Path Leads Home? — a content-authored polyline trio; the generator only
  // picks which slot is the unbroken one (the game draws the rest with a gap).
  function makeWhichPath(trios, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * trios.length);
    if (trios.length > 1 && idx === last) idx = (idx + 1) % trios.length;
    return { idx, trio: trios[idx], answerIdx: Math.floor(rnd() * trios[idx].length) };
  }
  // Who's Behind the Curtain? — the answer + 2 distractors, each a DISTINCT
  // silhouette class (never two look-alike shapes together — shadow-match lesson).
  function makeCurtainPeek(pool, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * pool.length);
    if (pool.length > 1 && idx === last) idx = (idx + 1) % pool.length;
    const answer = pool[idx];
    const used = new Set([answer.silhouette]);
    const picked = [];
    for (const o of shuffle(pool.filter((_, i) => i !== idx), rng)) {
      if (!used.has(o.silhouette)) { picked.push(o); used.add(o.silhouette); }
      if (picked.length >= 2) break;
    }
    const choices = shuffle([Object.assign({ correct: true }, answer), ...picked.map((p) => Object.assign({ correct: false }, p))], rng);
    return { idx, answer, choices };
  }
  // What Goes First? — a physically-forced clothing order; items shown shuffled.
  function makeDressOrder(pairs, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * pairs.length);
    if (pairs.length > 1 && idx === last) idx = (idx + 1) % pairs.length;
    const pair = pairs[idx];
    const items = rnd() < 0.5 ? [pair.first, pair.second] : [pair.second, pair.first];
    return { idx, pair, items, firstIdx: items.indexOf(pair.first) };
  }
  // Treasure Hunt — pick an as-yet-UNUSED spot for this clue (so a 3-clue arc
  // never repeats a zone) plus a position word for flavor. The named spot is the
  // answer regardless of the preposition.
  function makeTreasureClue(spots, prepositions, rng, used) {
    const rnd = rng || Math.random;
    const avail = spots.map((_, i) => i).filter((i) => !used.includes(i));
    const correctIdx = avail[Math.floor(rnd() * avail.length)];
    const preposition = prepositions[Math.floor(rnd() * prepositions.length)];
    return { spot: spots[correctIdx], preposition, correctIdx };
  }

  // ================= Road to 180 — Set 2, Wave 8 =================
  // Rhyme Pairs deck — a concentration deck where a "pair" is two DIFFERENT
  // pictures that RHYME. Draw 3 pairs from 3 DISTINCT rhyme groups, so no
  // cross-group card can accidentally rhyme (RHYME_GROUPS are pairwise
  // non-rhyming). The `group` index is the match key.
  function makeRhymePairsDeck(groups, rng) {
    const rnd = rng || Math.random;
    if (!Array.isArray(groups) || groups.length < 3) throw new Error("makeRhymePairsDeck needs >= 3 groups");
    const gis = shuffle(groups.map((_, i) => i), rng).slice(0, 3); // 3 DISTINCT groups
    const cards = [];
    gis.forEach((gi) => {
      const g = groups[gi];
      if (g.length < 2) throw new Error("rhyme group needs >= 2 members");
      const two = sample(g, 2, rng); // two DIFFERENT rhyming members
      two.forEach((m) => cards.push({ emoji: m.emoji, word: m.word, group: gi }));
    });
    return { cards: shuffle(cards, rng), groups: gis };
  }

  // Name Balloon Hunt — pop every balloon holding a letter of `name`. Each
  // occurrence of a letter is its own target with its own `slot` (so RAEGAR's
  // two R's / two A's each fill a distinct slot and spell the name). Distractor
  // balloons EXCLUDE every letter of the name (case-insensitive) so no wrong
  // balloon is ever secretly a name letter.
  function makeNameHunt(name, letters, rng) {
    const rnd = rng || Math.random;
    const chars = String(name).toUpperCase().split("");
    const nameSet = new Set(chars);
    const distractors = shuffle(letters.filter((l) => !nameSet.has(String(l).toUpperCase())), rng);
    if (!distractors.length) throw new Error("makeNameHunt needs distractor letters outside the name");
    const size = Math.max(9, chars.length + 4);
    const cells = chars.map((ch, i) => ({ ch, correct: true, slot: i }));
    for (let i = 0; cells.length < size; i++) cells.push({ ch: distractors[i % distractors.length], correct: false });
    return { name: chars.join(""), targets: chars, cells: shuffle(cells, rng) };
  }

  // Team Balance — deal n blocks (2-5) into the left pan; the shared job is to
  // add n to the right pan to level the scale. Trivial, no-repeat.
  function makeBalance(rng, last) {
    const rnd = rng || Math.random;
    let n = 2 + Math.floor(rnd() * 4); // 2..5
    if (n === last) n = n >= 5 ? 2 : n + 1;
    return { n };
  }

  // ================= Road to 200 — Set 3, Wave 9 =================
  // Duck Pond Stories — an acted-out spoken addition story: a ducks + b more,
  // total <= 8, both addends >= 1. Choices are 3 distinct numerals incl. total.
  function makeStoryAdd(actors, rng, last) {
    const rnd = rng || Math.random;
    let a, b, total, guard = 0;
    do {
      a = 1 + Math.floor(rnd() * 4); // 1..4
      b = 1 + Math.floor(rnd() * 4); // 1..4
      total = a + b;
      guard += 1;
    } while ((total > 8 || total === last) && guard < 60);
    const actor = actors[Math.floor(rnd() * actors.length)];
    return { a, b, total, actor, choices: numChoices(total, rng) };
  }

  // Two Words Make One — a transparent compound; distractors are OTHER compounds
  // that share NO part word with the prompt pair (so no distractor is also-valid).
  function makeCompound(compounds, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * compounds.length);
    if (compounds.length > 1 && idx === last) idx = (idx + 1) % compounds.length;
    const c = compounds[idx];
    const pool = compounds.filter((o, i) => i !== idx && o.parts.every((p) => !c.parts.includes(p)));
    const distractors = shuffle(pool, rng).slice(0, 2);
    const choices = shuffle(
      [{ result: c.result, word: c.word, correct: true },
        ...distractors.map((o) => ({ result: o.result, word: o.word, correct: false }))],
      rng
    );
    return { idx, a: c.a, b: c.b, result: c.result, word: c.word, choices };
  }

  // This Goes With That — a picture analogy A:B :: C:? Each set carries its own
  // explicit, relation-NEUTRAL distractors (unrelated objects), so no distractor
  // can satisfy the round's relation with C.
  function makeAnalogy(sets, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * sets.length);
    if (sets.length > 1 && idx === last) idx = (idx + 1) % sets.length;
    const s = sets[idx];
    const distractors = shuffle(s.distractors.slice(), rng).slice(0, 2);
    const choices = shuffle(
      [{ emoji: s.d.emoji, word: s.d.word, correct: true },
        ...distractors.map((o) => ({ emoji: o.emoji, word: o.word, correct: false }))],
      rng
    );
    return { idx, set: s, a: s.a, b: s.b, c: s.c, d: s.d, choices };
  }

  // Fix the Toys — a 6-card deck: 3 toys each split into a left + right half
  // (matched by toy key). Mechanic-A pair clearing joins the halves.
  function makeHalvesDeck(pool, rng) {
    const toys = sample(pool, 3, rng);
    const cards = [];
    toys.forEach((t) => {
      cards.push({ key: t.key, half: "L", emoji: t.emoji });
      cards.push({ key: t.key, half: "R", emoji: t.emoji });
    });
    return { cards: shuffle(cards, rng), toys };
  }

  // ================= Road to 200 — Set 3, Wave 10 =================
  // How Tall? — measure a thing in unit blocks (height 3-6, no repeat).
  function makeHowTall(things, rng, last) {
    const rnd = rng || Math.random;
    let h = 3 + Math.floor(rnd() * 4); // 3..6
    if (h === last) h = h >= 6 ? 3 : h + 1;
    const thing = things[Math.floor(rnd() * things.length)];
    return { height: h, thing };
  }

  // Drum the Word — how many syllables (parts) in the pictured word. 3 numeral chips.
  function makePartsPick(words, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * words.length);
    if (words.length > 1 && idx === last) idx = (idx + 1) % words.length;
    const w = words[idx];
    return { idx, word: w, count: w.parts, choices: numChoices(w.parts, rng) };
  }

  // Robot Talk — hear a blended CVC word, tap its picture. The two distractor
  // pictures have DIFFERENT beginning sounds (all 3 onsets distinct) so a child
  // who catches only the first phoneme is never trapped between two candidates.
  function makeBlendPick(words, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * words.length);
    if (words.length > 1 && idx === last) idx = (idx + 1) % words.length;
    const w = words[idx];
    const onset = w.word[0];
    const picked = [], usedOnsets = new Set([onset]);
    for (const o of shuffle(words.filter((_, i) => i !== idx), rng)) {
      if (!usedOnsets.has(o.word[0])) { picked.push(o); usedOnsets.add(o.word[0]); }
      if (picked.length >= 2) break;
    }
    const choices = shuffle([{ emoji: w.emoji, word: w.word, correct: true }, ...picked.map((o) => ({ emoji: o.emoji, word: o.word, correct: false }))], rng);
    return { idx, word: w, choices };
  }

  // What's Missing? — one part of a drawn scene is gone; the two distractor chips
  // are parts that ARE present (so the control of error is lookable).
  function makeMissingPart(scenes, rng, last) {
    const rnd = rng || Math.random;
    let idx = Math.floor(rnd() * scenes.length);
    if (scenes.length > 1 && idx === last) idx = (idx + 1) % scenes.length;
    const scene = scenes[idx];
    const missing = scene.parts[Math.floor(rnd() * scene.parts.length)];
    const present = shuffle(scene.parts.filter((p) => p.key !== missing.key), rng).slice(0, 2);
    const choices = shuffle([{ ...missing, correct: true }, ...present.map((p) => ({ ...p, correct: false }))], rng);
    return { idx, scene, missing, choices };
  }

  // Drive Home — a run of 3 independent forks; each has exactly ONE continuing
  // branch (the other is blocked). The generator picks which side continues.
  function makeForkRun(blockers, rng) {
    const rnd = rng || Math.random;
    const forks = [];
    for (let i = 0; i < 3; i++) forks.push({ goodSide: rnd() < 0.5 ? "left" : "right", blocker: blockers[Math.floor(rnd() * blockers.length)] });
    return { forks };
  }

  // Shape Spy — pick a target shape (rotating); the child taps every zone of that
  // shape in the scene. `need` = how many of that shape are present.
  function makeShapeSpy(scene, rng, lastShape) {
    const rnd = rng || Math.random;
    const shapes = [];
    scene.zones.forEach((z) => { if (!shapes.includes(z.shape)) shapes.push(z.shape); });
    let shape = shapes[Math.floor(rnd() * shapes.length)];
    if (shapes.length > 1 && shape === lastShape) shape = shapes[(shapes.indexOf(shape) + 1) % shapes.length];
    return { shape, zones: scene.zones, need: scene.zones.filter((z) => z.shape === shape).length };
  }

  // Hide & Seek! — 4 of the scene's spots hide a friend (with a peek clue), 2 are
  // empty decoys. Returns the assignment for this round.
  function makeHideSpots(spots, friends, rng) {
    const order = shuffle(spots.map((_, i) => i), rng);
    const hiding = new Set(order.slice(0, 4));
    const fr = shuffle(friends.slice(), rng);
    let fi = 0;
    const assigned = spots.map((s, i) => hiding.has(i)
      ? { x: s.x, y: s.y, peek: s.peek, hiding: true, friend: fr[fi++ % fr.length] }
      : { x: s.x, y: s.y, peek: s.peek, hiding: false });
    return { spots: assigned, need: 4 };
  }

  const API = {
    randInt, pickIndex, shuffle, sample, makeOddOneOut, makePattern, PATTERN_UNITS,
    makeSkipCount, makeTakeAway, makeCompare,
    makeCoinTrade, makeDouble, makeLengthPick, makeCountdown, makeSeesaw,
    makeSideCount, makeEndSound, makeVowelPick, makeFamilySort,
    makePatternFix, makeMatrix2, makeLeftRight, makeBlockCount, makeTurnMatch,
    makeSentence, makeSilly, makeSceneCompare, makeClueHunt, alphaRun,
    makeWhoEats, makePartPick, makeHelperTool,
    makeCoinMix, makeOrdinal, makeAboutFive, makeGraphPick, makeGlassPick,
    makePartnerUp, makeCategoryCount, makeSizePick,
    makeCopyGrid, makeMirrorHalf, makeFitsInside, makeWhichPath, makeCurtainPeek, makeDressOrder,
    makeTreasureClue, makeRhymePairsDeck, makeNameHunt, makeBalance,
    makeStoryAdd, makeCompound, makeAnalogy, makeHalvesDeck,
    makeHowTall, makePartsPick, makeBlendPick, makeMissingPart, makeForkRun, makeShapeSpy, makeHideSpots,
    makeFirstSound, makeRhyme, makeSightWord, makeCVC,
    makeShadowMatch, makeOrder, makeSort,
    makeAddition, makeNumberMatch, makeClock, tensOnes,
    makeLetterMatch, makeMissingLetter, makeSpotDifference,
    makeFindHero, makeCrowd, makeFindCount, tttWinner, TTT_LINES, makeTeen,
    makeMakeTen, makeBigAdd, makeWordPicture, makeDeduce, makeTwins, makeCategoryHunt, makeSolidMatch,
    makePiggyBank, makeNumberCompare, makeLatinSquare, makeRhymeHunt, makeNumberSequence,
    makeDigraphFinish, makeStoryOrder, makeConjunctionHunt,
    makeContinentMatch, makeSoundHunt, makeTopView, makeWebRescue, makeNameSpell,
    article, makeOddFeature, makeListen,
    makeColorMix, makeSinkFloat, makeMamaBaby, makeFairShare, makeQuickPeek, PEEK_LAYOUTS,
    makeAlphaTrain, ALPHABET, makeLetterHunt,
    makePieceFit, makeWhoHid, makeBeat, makeFeeling, makeKindness, makeDayTrain, makeWeather, makeSeasonItem,
    makeOrderTrain, makeIdiomFill, makePoemNext, makeMeasureWord, makePairPick,
    makeMenuMemory, makeMarket, makeChange, makeCharCrowd, makeMissingAddend, makeSudoku4,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else global.JoshLogic = API;
})(typeof window !== "undefined" ? window : globalThis);
