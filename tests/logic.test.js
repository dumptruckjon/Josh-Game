// Deep unit tests for scripts/logic.js — the pure, correctness-critical core of
// every game. Deterministic via a seeded RNG, plus property checks over many
// random iterations. No browser needed.

const test = require("node:test");
const assert = require("node:assert");
const L = require("../scripts/logic.js");
const content = require("../scripts/content.js");

// Small seeded PRNG so tests are deterministic and reproducible.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("randInt stays in range and hits both ends", () => {
  const rng = mulberry32(1);
  const seen = new Set();
  for (let i = 0; i < 5000; i++) {
    const n = L.randInt(2, 7, rng);
    assert.ok(n >= 2 && n <= 7 && Number.isInteger(n), `out of range: ${n}`);
    seen.add(n);
  }
  assert.equal(seen.size, 6, "should reach every value in [2,7]");
});

test("pickIndex never repeats and covers the whole range", () => {
  const rng = mulberry32(2);
  const len = 8;
  const seen = new Set();
  let cur = -1, repeats = 0;
  for (let i = 0; i < 5000; i++) {
    const n = L.pickIndex(len, cur, rng);
    if (n === cur) repeats++;
    seen.add(n);
    cur = n;
  }
  assert.equal(repeats, 0, "never the same twice in a row");
  assert.equal(seen.size, len, "reaches every index");
  assert.equal(L.pickIndex(1, 0, rng), 0, "len 1 -> 0");
});

test("shuffle preserves the multiset and length", () => {
  const rng = mulberry32(3);
  const src = ["a", "b", "c", "d", "e", "f"];
  for (let i = 0; i < 200; i++) {
    const out = L.shuffle(src, rng);
    assert.equal(out.length, src.length);
    assert.deepEqual([...out].sort(), [...src].sort());
  }
  // does not mutate the source
  const before = src.slice();
  L.shuffle(src, rng);
  assert.deepEqual(src, before);
});

test("sample returns k distinct items, clamped to length", () => {
  const rng = mulberry32(4);
  const src = [1, 2, 3, 4, 5];
  const three = L.sample(src, 3, rng);
  assert.equal(three.length, 3);
  assert.equal(new Set(three).size, 3, "distinct");
  three.forEach((x) => assert.ok(src.includes(x)));
  assert.equal(L.sample(src, 99, rng).length, 5, "clamped to length");
  assert.equal(L.sample(src, 0, rng).length, 0);
});

test("makeOddOneOut: exactly one odd, and it truly differs", () => {
  const rng = mulberry32(5);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeOddOneOut(content.ODD_GROUPS, rng);
    assert.equal(r.tiles.length, 4, "four tiles");
    const correct = r.tiles.filter((t) => t.correct);
    assert.equal(correct.length, 1, "exactly one correct (odd) tile");
    const others = r.tiles.filter((t) => !t.correct).map((t) => t.emoji);
    assert.ok(!others.includes(correct[0].emoji), "the odd tile is not a duplicate of the majority");
    assert.equal(correct[0].emoji, r.odd, "reported odd matches the correct tile");
    // the three majority tiles are distinct
    assert.equal(new Set(others).size, 3, "majority tiles are distinct");
  }
  assert.throws(() => L.makeOddOneOut([{ name: "x", items: ["🍎"] }], rng), />= 2 groups/);
});

test("makePattern: choices hold exactly one correct = the true next token", () => {
  const rng = mulberry32(6);
  const allTokens = [].concat.apply([], content.PATTERN_SETS);
  for (let i = 0; i < 3000; i++) {
    const pair = content.PATTERN_SETS[L.randInt(0, content.PATTERN_SETS.length - 1, rng)];
    const r = L.makePattern(pair, allTokens, rng);
    // Independently recompute the expected next token from the unit + sequence.
    const expected = r.unit[r.sequence.length % r.unit.length];
    assert.equal(r.answer, expected, "answer is the true next in the repeating unit");
    // The shown sequence really is the unit repeating.
    r.sequence.forEach((tok, k) => assert.equal(tok, r.unit[k % r.unit.length], "sequence follows the unit"));
    assert.ok(r.sequence.length >= 4, "enough of the pattern is shown");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1, "exactly one correct choice");
    assert.equal(correct[0].token, r.answer, "the correct choice is the answer");
    assert.ok(r.choices.length >= 2 && r.choices.length <= 3, "2-3 choices");
    assert.equal(new Set(r.choices.map((c) => c.token)).size, r.choices.length, "choices are distinct");
  }
  assert.throws(() => L.makePattern(["🔴"], allTokens, rng), /2-token/);
});

test("makeSkipCount: real skip sequence, hidden term, one correct choice", () => {
  const rng = mulberry32(7);
  for (const step of [2, 5, 10]) {
    for (let i = 0; i < 1500; i++) {
      const r = L.makeSkipCount(step, 5, rng);
      assert.equal(r.sequence.length, 5);
      r.sequence.forEach((v, k) => assert.equal(v, step * (k + 1), "sequence counts by step"));
      assert.ok(r.hideIndex >= 1 && r.hideIndex <= 4, "hidden term is interior");
      assert.equal(r.answer, r.sequence[r.hideIndex], "answer is the hidden term");
      const correct = r.choices.filter((c) => c.correct);
      assert.equal(correct.length, 1, "exactly one correct choice");
      assert.equal(correct[0].n, r.answer);
      assert.equal(new Set(r.choices.map((c) => c.n)).size, r.choices.length, "choices distinct");
      r.choices.forEach((c) => assert.ok(c.n > 0, "no non-positive choices"));
    }
  }
  assert.throws(() => L.makeSkipCount(0, 5, rng), /step > 0/);
});

test("makeTakeAway: answer = start - minus, one correct, valid choices", () => {
  const rng = mulberry32(8);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeTakeAway(rng);
    assert.ok(r.start >= 3 && r.start <= 9);
    assert.ok(r.minus >= 1 && r.minus <= r.start - 1, "minus keeps answer >= 1");
    assert.equal(r.answer, r.start - r.minus, "answer is the difference");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].n, r.answer);
    assert.equal(new Set(r.choices.map((c) => c.n)).size, r.choices.length, "choices distinct");
    r.choices.forEach((c) => assert.ok(c.n >= 0));
  }
});

test("makeCompare: two different quantities, correct side is the bigger one", () => {
  const rng = mulberry32(9);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeCompare(rng);
    assert.notEqual(r.a, r.b, "quantities differ");
    assert.ok(r.a >= 1 && r.a <= 7 && r.b >= 1 && r.b <= 7);
    assert.equal(r.moreLeft, r.a > r.b);
    assert.equal(r.answer, r.a > r.b ? "left" : "right");
  }
});

test("makeFirstSound: correct letter is the picture's beginning letter", () => {
  const rng = mulberry32(10);
  const byWord = Object.fromEntries(content.FIRST_SOUND_WORDS.map((w) => [w.word, w.letter]));
  for (let i = 0; i < 3000; i++) {
    const r = L.makeFirstSound(content.FIRST_SOUND_WORDS, rng);
    assert.equal(r.answer, byWord[r.word], "answer matches the word's letter");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].letter, r.answer);
    assert.equal(new Set(r.choices.map((c) => c.letter)).size, r.choices.length, "letters distinct");
  }
  assert.throws(() => L.makeFirstSound([{ emoji: "🍎", word: "a", letter: "A" }], rng), />= 3/);
});

test("makeRhyme: the correct choice really rhymes (same group) and is unique", () => {
  const rng = mulberry32(11);
  // build a lookup: word -> group index
  const groupOf = new Map();
  content.RHYME_GROUPS.forEach((g, gi) => g.forEach((it) => groupOf.set(it.word, gi)));
  for (let i = 0; i < 3000; i++) {
    const r = L.makeRhyme(content.RHYME_GROUPS, rng);
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1, "exactly one rhyming choice");
    assert.equal(groupOf.get(correct[0].word), groupOf.get(r.target.word), "correct shares the target's rhyme group");
    assert.notEqual(correct[0].word, r.target.word, "correct is a different word than the target");
    // distractors are NOT in the target's group
    r.choices.filter((c) => !c.correct).forEach((c) =>
      assert.notEqual(groupOf.get(c.word), groupOf.get(r.target.word), "distractors do not rhyme"));
  }
});

test("makeSightWord: one correct match, all choices distinct", () => {
  const rng = mulberry32(12);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeSightWord(content.SIGHT_WORDS, rng);
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].word, r.target);
    assert.equal(new Set(r.choices.map((c) => c.word)).size, r.choices.length, "choices distinct");
  }
});

test("makeCVC: buttons are a permutation of the word's letters", () => {
  const rng = mulberry32(13);
  for (let i = 0; i < 2000; i++) {
    const r = L.makeCVC(content.CVC_WORDS, rng);
    assert.deepEqual(r.buttons.slice().sort(), r.letters.slice().sort(), "buttons are a permutation of the letters");
    assert.equal(r.letters.join(""), r.word, "letters spell the word");
    assert.equal(r.buttons.length, r.word.length, "one button per letter");
  }
});

test("makeShadowMatch: the correct shadow is the same shape as the target", () => {
  const rng = mulberry32(14);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeShadowMatch(content.SHAPES, rng);
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].emoji, r.target, "the correct shadow is the target shape");
    assert.equal(new Set(r.choices.map((c) => c.emoji.name)).size, r.choices.length, "choices are distinct shapes");
  }
  assert.throws(() => L.makeShadowMatch(content.SHAPES.slice(0, 2), rng), />= 3/);
});

test("SHAPES are distinct, well-formed inline SVG", () => {
  assert.ok(content.SHAPES.length >= 6, "need several distinct shapes");
  const names = content.SHAPES.map((s) => s.name);
  assert.equal(new Set(names).size, names.length, "shape names unique");
  content.SHAPES.forEach((s) => {
    assert.ok(typeof s.name === "string" && s.name.length, "shape needs a name");
    assert.match(s.svg, /^<(circle|rect|polygon|path)/, `shape ${s.name} needs SVG markup`);
  });
});

test("makeOrder: ranks are a full 1..count permutation", () => {
  const rng = mulberry32(15);
  for (const count of [3, 4]) {
    for (let i = 0; i < 1500; i++) {
      const r = L.makeOrder(content.ORDER_POOL, count, rng);
      assert.equal(r.items.length, count);
      const ranks = r.items.map((it) => it.rank).sort((a, b) => a - b);
      assert.deepEqual(ranks, Array.from({ length: count }, (_, k) => k + 1), "ranks are 1..count");
      assert.ok(content.ORDER_POOL.includes(r.emoji));
    }
  }
});

test("makeSort: the item truly belongs to the correct bin", () => {
  const rng = mulberry32(16);
  const allSets = [...content.SORT_SETS, ...content.COLOR_SETS, ...content.LAW_SETS,
    ...content.DAY_NIGHT_SETS, ...content.HOT_COLD_SETS, ...content.DIGRAPH_SETS];
  for (const set of allSets) {
    for (let i = 0; i < 800; i++) {
      const r = L.makeSort(set, rng);
      assert.ok(r.correctIndex >= 0 && r.correctIndex < set.bins.length, "valid bin index");
      assert.ok(set.bins[r.correctIndex].items.includes(r.item), "item is in the correct bin");
      assert.equal(r.bins.length, set.bins.length, "returns every bin as a choice");
    }
  }
  assert.throws(() => L.makeSort({ bins: [{ label: "x", emoji: "x", items: ["a"] }] }, rng), />= 2 bins/);
});

test("every sortable item lives in exactly one bin of its set (no ambiguity)", () => {
  const allSets = [...content.SORT_SETS, ...content.COLOR_SETS, ...content.LAW_SETS,
    ...content.DAY_NIGHT_SETS, ...content.HOT_COLD_SETS, ...content.DIGRAPH_SETS];
  for (const set of allSets) {
    const seen = new Map();
    set.bins.forEach((b, bi) => b.items.forEach((it) => {
      assert.ok(!seen.has(it), `item ${it} appears in two bins of set ${set.name}`);
      seen.set(it, bi);
    }));
  }
});

test("makeAddition: sum = a + b, one correct, distinct positive choices", () => {
  const rng = mulberry32(17);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeAddition(rng);
    assert.equal(r.sum, r.a + r.b);
    assert.ok(r.a >= 1 && r.b >= 1);
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].n, r.sum);
    assert.equal(new Set(r.choices.map((c) => c.n)).size, r.choices.length);
    r.choices.forEach((c) => assert.ok(c.n > 0));
  }
});

test("makeNumberMatch: exactly one group has n items; counts distinct", () => {
  const rng = mulberry32(18);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeNumberMatch(rng);
    assert.ok(r.n >= 1 && r.n <= 9);
    const correct = r.groups.filter((g) => g.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].count, r.n, "the correct group holds exactly n");
    assert.equal(new Set(r.groups.map((g) => g.count)).size, r.groups.length, "group counts distinct");
  }
});

test("makeClock: correct hour, label matches, hours distinct", () => {
  const rng = mulberry32(19);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeClock(rng);
    assert.ok(r.hour >= 1 && r.hour <= 12);
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].hour, r.hour);
    assert.equal(correct[0].label, r.hour + ":00");
    assert.equal(new Set(r.choices.map((c) => c.hour)).size, r.choices.length, "hours distinct");
  }
});

test("makeClock half-past tier: min in {0,30}, correct label matches the time, labels distinct", () => {
  const rng = mulberry32(191);
  for (let i = 0; i < 4000; i++) {
    const r = L.makeClock(rng, true);
    assert.ok(r.hour >= 1 && r.hour <= 12);
    assert.ok(r.min === 0 || r.min === 30, "minutes are o'clock (0) or half-past (30)");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1, "exactly one correct");
    assert.equal(correct[0].label, r.hour + ":" + (r.min === 30 ? "30" : "00"), "correct label matches the drawn time");
    const labels = r.choices.map((c) => c.label);
    assert.equal(new Set(labels).size, labels.length, "choice labels are distinct (never two identical times)");
    r.choices.forEach((c) => assert.match(c.label, /^\d{1,2}:(00|30)$/, "every label is H:00 or H:30"));
  }
});

test("tensOnes: tens*10 + ones === n and ones < 10", () => {
  for (let n = 0; n <= 99; n++) {
    const { tens, ones } = L.tensOnes(n);
    assert.equal(tens * 10 + ones, n);
    assert.ok(ones >= 0 && ones < 10);
  }
});

test("makeLetterMatch: correct lowercase is the uppercase lowercased; distinct", () => {
  const rng = mulberry32(20);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeLetterMatch(rng);
    assert.match(r.upper, /^[A-Z]$/);
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].lower, r.upper.toLowerCase());
    assert.equal(new Set(r.choices.map((c) => c.lower)).size, r.choices.length, "choices distinct");
    // Never offer both "i" and "l" together: on iOS the target "I" and the
    // distractor "l" render as identical bare strokes, pulling a shape-matcher to
    // the wrong tile. If the target is I, l must never be a choice (and v.v.).
    const lowers = r.choices.map((c) => c.lower);
    assert.ok(!(lowers.includes("i") && lowers.includes("l")),
      `letter-match offered the i/l confusable pair together (target ${r.upper})`);
  }
});

test("makeMissingLetter: the answer is the letter at the blank; distinct choices", () => {
  const rng = mulberry32(21);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeMissingLetter(content.CVC_WORDS, rng);
    assert.equal(r.answer, r.word[r.blankIndex], "answer is the blanked letter");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].letter, r.answer);
    assert.equal(new Set(r.choices.map((c) => c.letter)).size, r.choices.length, "choices distinct");
  }
});

test("makeSpotDifference: exactly one position changes between the rows", () => {
  const rng = mulberry32(22);
  for (const count of [3, 4]) {
    for (let i = 0; i < 1500; i++) {
      const r = L.makeSpotDifference(content.SPOT_POOL, count, rng);
      assert.equal(r.before.length, count);
      assert.equal(r.after.length, count);
      let diffs = 0;
      for (let k = 0; k < count; k++) if (r.before[k] !== r.after[k]) diffs++;
      assert.equal(diffs, 1, "exactly one item differs");
      assert.notEqual(r.after[r.diffIndex], r.before[r.diffIndex], "the changed one is at diffIndex");
    }
  }
  assert.throws(() => L.makeSpotDifference(["🐶", "🐱"], 3, rng), /pool > count/);
});

test("makeFindHero: exactly K target copies, rest are distractors", () => {
  const rng = mulberry32(23);
  for (const size of [9, 13, 17]) {
    for (let i = 0; i < 1000; i++) {
      const r = L.makeFindHero(content.FIND_POOL, size, 0, rng);
      assert.equal(r.cells.length, size);
      const correct = r.cells.filter((c) => c.correct);
      assert.equal(correct.length, r.count, "count matches the number of correct cells");
      correct.forEach((c) => assert.equal(c.emoji, r.target, "every correct cell is the target"));
      r.cells.filter((c) => !c.correct).forEach((c) => assert.notEqual(c.emoji, r.target, "distractors are not the target"));
    }
  }
});

test("makeCrowd: exactly one odd cell that differs from the base", () => {
  const rng = mulberry32(24);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeCrowd(content.FIND_POOL, 12, rng);
    const correct = r.cells.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(r.cells[r.oddIndex].emoji, r.odd);
    assert.notEqual(r.odd, r.base);
    r.cells.forEach((c, i) => { if (i !== r.oddIndex) assert.equal(c.emoji, r.base, "the crowd is all the base"); });
  }
});

test("makeFindCount: the count really equals the target's copies in the scene", () => {
  const rng = mulberry32(25);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeFindCount(content.FIND_POOL, 12, rng);
    const actual = r.cells.filter((e) => e === r.target).length;
    assert.equal(actual, r.count, "count equals real occurrences");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].n, r.count);
  }
});

test("makeTeen: target 11-19 and it is truly ten plus some ones", () => {
  const rng = mulberry32(26);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeTeen(rng);
    assert.ok(r.target >= 11 && r.target <= 19);
    assert.equal(r.tens, 1);
    assert.equal(r.tens * 10 + r.ones, r.target, "ten and some more equals the teen");
    assert.ok(r.ones >= 1 && r.ones <= 9);
  }
});

test("tttWinner: detects rows, columns, diagonals; null otherwise", () => {
  const X = "X", O = "O", _ = "";
  assert.equal(L.tttWinner([X, X, X, _, _, _, _, _, _]), X, "top row");
  assert.equal(L.tttWinner([_, _, _, O, O, O, _, _, _]), O, "middle row");
  assert.equal(L.tttWinner([X, _, _, X, _, _, X, _, _]), X, "left column");
  assert.equal(L.tttWinner([X, _, _, _, X, _, _, _, X]), X, "diagonal");
  assert.equal(L.tttWinner([O, _, X, _, X, _, X, _, O]), X, "anti-diagonal");
  assert.equal(L.tttWinner([X, O, X, O, O, X, X, X, O]), null, "full board, no line");
  assert.equal(L.tttWinner([_, _, _, _, _, _, _, _, _]), null, "empty");
});

// ---------- New games (batch): Make Ten, Big Add, Read & Zap, deduction, twins, category, solids ----------

test("makeMakeTen: have+need is always exactly ten; one correct choice", () => {
  const rng = mulberry32(31);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeMakeTen(rng);
    assert.ok(r.have >= 1 && r.have <= 9, "have in 1..9");
    assert.equal(r.have + r.need, 10, "have + need must equal ten");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1, "exactly one correct");
    assert.equal(correct[0].n, r.need, "correct choice is the need");
    assert.equal(new Set(r.choices.map((c) => c.n)).size, r.choices.length, "no duplicate choices");
  }
});

test("makeBigAdd: honest two-digit sum; easy never carries, hard may carry", () => {
  const rng = mulberry32(32);
  for (let i = 0; i < 4000; i++) {
    // easy (default) — the gentle no-carry first taste
    const e = L.makeBigAdd(rng);
    assert.equal(e.a, e.aTens * 10 + e.aOnes, "a split is consistent");
    assert.equal(e.b, e.bTens * 10 + e.bOnes, "b split is consistent");
    assert.ok(e.a >= 10 && e.b >= 10, "both are two-digit");
    assert.ok(e.aOnes + e.bOnes <= 9, "easy never carries");
    assert.equal(e.carry, false, "easy carry flag is false");
    assert.equal(e.sum, e.a + e.b, "sum is truthful");
    let correct = e.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1, "exactly one correct");
    assert.equal(correct[0].n, e.sum, "correct choice is the sum");
    assert.equal(new Set(e.choices.map((c) => c.n)).size, e.choices.length, "no duplicate choices");

    // hard — bigger numbers that may regroup; sum stays truthful
    const h = L.makeBigAdd(rng, true);
    assert.ok(h.a >= 10 && h.b >= 10, "hard addends are two-digit");
    assert.equal(h.sum, h.a + h.b, "hard sum is truthful");
    assert.equal(h.carry, h.aOnes + h.bOnes >= 10, "carry flag matches the ones");
    const hc = h.choices.filter((c) => c.correct);
    assert.equal(hc.length, 1, "hard: exactly one correct");
    assert.equal(hc[0].n, h.sum, "hard: correct choice is the sum");
    assert.equal(new Set(h.choices.map((c) => c.n)).size, h.choices.length, "hard: distinct choices");
  }
});

test("makeNumberSequence: a varied consecutive run, tagged with ascending order", () => {
  const rng = mulberry32(72);
  for (const [len, maxStart] of [[4, 6], [5, 15]]) {
    const starts = new Set();
    for (let i = 0; i < 2000; i++) {
      const r = L.makeNumberSequence(len, maxStart, rng);
      assert.equal(r.values.length, len, "run has the right length");
      // consecutive
      for (let k = 1; k < len; k++) assert.equal(r.values[k], r.values[k - 1] + 1, "values are consecutive");
      assert.ok(r.start >= 1 && r.start <= maxStart, "start within range");
      starts.add(r.start);
      // items: each value tagged with its ascending index; orders are a full permutation
      const orders = r.items.map((it) => it.order).sort((a, b) => a - b);
      assert.deepEqual(orders, r.values.map((_, i) => i), "orders are 0..len-1");
      for (const it of r.items) assert.equal(it.value, r.start + it.order, "value matches its ascending order");
    }
    assert.ok(starts.size > 1, "the run actually varies (not always the same numbers)");
  }
});

test("makeWordPicture: the correct picture belongs to the shown word", () => {
  const rng = mulberry32(33);
  const byWord = Object.fromEntries(content.CVC_WORDS.map((w) => [w.word, w.emoji]));
  for (let i = 0; i < 3000; i++) {
    const r = L.makeWordPicture(content.CVC_WORDS, rng);
    assert.equal(r.answer, byWord[r.word], "answer emoji matches the word");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1, "exactly one correct");
    assert.equal(correct[0].emoji, r.answer, "the correct choice is the word's picture");
    assert.equal(r.choices.length, 3, "three choices");
    assert.equal(new Set(r.choices.map((c) => c.emoji)).size, 3, "distinct pictures");
  }
});

test("makeDeduce: clues narrow to EXACTLY one character", () => {
  const rng = mulberry32(34);
  const colors = content.DEDUCE_COLORS.map((c) => c.key);
  const items = content.DEDUCE_ITEMS.map((i) => i.key);
  for (let i = 0; i < 4000; i++) {
    const r = L.makeDeduce(colors, items, rng);
    assert.equal(r.characters.length, colors.length * items.length, "all combos present");
    // every combo is unique
    const combos = new Set(r.characters.map((c) => c.color + "|" + c.item));
    assert.equal(combos.size, r.characters.length, "no duplicate character");
    // exactly one satisfies BOTH clues
    const matches = r.characters.filter((c) => c.color === r.clueColor && c.item === r.clueItem);
    assert.equal(matches.length, 1, "clue pair identifies exactly one");
    assert.equal(r.answerIndex, r.characters.indexOf(matches[0]), "answerIndex points at it");
    // every other character fails at least one clue
    r.characters.forEach((c, idx) => {
      if (idx === r.answerIndex) return;
      assert.ok(c.color !== r.clueColor || c.item !== r.clueItem, "distractor fails a clue");
    });
  }
});

test("makeTwins: exactly ONE duplicated glyph (the twins), all else unique", () => {
  const rng = mulberry32(35);
  for (const size of [8, 10, 12, 16]) {
    for (let i = 0; i < 800; i++) {
      const r = L.makeTwins(content.FIND_POOL, size, rng);
      assert.equal(r.cells.length, size, "field is the right size");
      const counts = {};
      r.cells.forEach((c) => { counts[c.emoji] = (counts[c.emoji] || 0) + 1; });
      const dupes = Object.entries(counts).filter(([, n]) => n > 1);
      assert.equal(dupes.length, 1, "exactly one glyph appears more than once");
      assert.equal(dupes[0][1], 2, "and it appears exactly twice");
      assert.equal(dupes[0][0], r.twin, "the duplicated glyph is the twin");
      const correct = r.cells.filter((c) => c.correct);
      assert.equal(correct.length, 2, "both twins are marked correct");
      assert.ok(correct.every((c) => c.emoji === r.twin), "correct cells are the twin glyph");
    }
  }
});

test("makeCategoryHunt: every 'correct' cell is a real member; fillers never are", () => {
  const rng = mulberry32(36);
  const cats = content.FIND_CATEGORIES;
  const memberOf = {};
  cats.forEach((c) => c.items.forEach((e) => { memberOf[e] = c.id; }));
  for (let i = 0; i < 3000; i++) {
    const r = L.makeCategoryHunt(cats, 9, rng);
    const members = r.cells.filter((c) => c.correct);
    assert.ok(members.length >= 2, "at least two to find");
    assert.equal(members.length, r.count, "count matches the correct cells");
    members.forEach((c) => assert.equal(memberOf[c.emoji], r.catId, "member truly belongs to the category"));
    r.cells.filter((c) => !c.correct).forEach((c) =>
      assert.notEqual(memberOf[c.emoji], r.catId, "a filler is never a hidden member"));
  }
});

test("makeSolidMatch: correct object belongs to the shown solid, distractors don't", () => {
  const rng = mulberry32(37);
  const sets = content.SOLID_SETS;
  const solidOf = {};
  sets.forEach((s) => s.objects.forEach((o) => { solidOf[o] = s.name; }));
  for (let i = 0; i < 3000; i++) {
    const r = L.makeSolidMatch(sets, rng);
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1, "exactly one correct");
    assert.equal(correct[0].emoji, r.answer, "correct choice is the answer");
    assert.equal(solidOf[r.answer], r.name, "answer object matches the solid");
    r.choices.filter((c) => !c.correct).forEach((c) =>
      assert.notEqual(solidOf[c.emoji], r.name, "distractor is a DIFFERENT solid's object"));
    assert.equal(new Set(r.choices.map((c) => c.emoji)).size, 3, "distinct objects");
  }
});

// ---------- Second batch: Piggy Bank, Number Muncher, Picture Squares, Rhyme Train ----------

test("makePiggyBank: a valid, small, exactly-payable price", () => {
  const rng = mulberry32(41);
  for (let i = 0; i < 3000; i++) {
    const r = L.makePiggyBank(rng);
    assert.ok(r.price >= 3 && r.price <= 10, "price is small");
    assert.equal(r.nickels * 5 + r.pennies, r.price, "decomposition equals the price exactly");
    assert.ok(r.pennies >= 0 && r.pennies < 5, "greedy pennies < 5");
  }
});

test("makeNumberCompare: never a tie; the larger is always correct", () => {
  const rng = mulberry32(42);
  for (const max of [10, 19]) {
    for (let i = 0; i < 3000; i++) {
      const r = L.makeNumberCompare(1, max, rng);
      assert.notEqual(r.a, r.b, "never equal");
      assert.equal(r.bigger, Math.max(r.a, r.b), "bigger is the max");
      const chosen = r.answer === "a" ? r.a : r.b;
      assert.equal(chosen, r.bigger, "the correct side is the strictly larger number");
    }
  }
});

test("makeLatinSquare: valid 3x3 (each symbol once per row & column); unique answer", () => {
  const rng = mulberry32(43);
  for (const trio of content.SQUARE_TRIOS) {
    for (let i = 0; i < 500; i++) {
      const r = L.makeLatinSquare(trio, rng);
      const set = new Set(r.symbols);
      assert.equal(set.size, 3, "three distinct symbols");
      for (let row = 0; row < 3; row++) {
        assert.deepEqual([...r.grid[row]].sort(), [...r.symbols].sort(), `row ${row} has all three`);
      }
      for (let col = 0; col < 3; col++) {
        const column = [r.grid[0][col], r.grid[1][col], r.grid[2][col]];
        assert.deepEqual([...column].sort(), [...r.symbols].sort(), `col ${col} has all three`);
      }
      assert.equal(r.answer, r.grid[r.blankR][r.blankC], "answer is the blanked cell's symbol");
      const correct = r.choices.filter((c) => c.correct);
      assert.equal(correct.length, 1, "exactly one correct choice");
      assert.equal(correct[0].sym, r.answer, "correct choice is the answer");
    }
  }
});

test("makeLatinSquare: valid 4x4 tier (each of 4 symbols once per row & column); unique answer", () => {
  const rng = mulberry32(430);
  for (const quad of content.SQUARE_QUADS) {
    for (let i = 0; i < 500; i++) {
      const r = L.makeLatinSquare(quad, rng, 4);
      assert.equal(r.n, 4, "n is 4");
      assert.equal(new Set(r.symbols).size, 4, "four distinct symbols");
      const sorted = [...r.symbols].sort();
      for (let row = 0; row < 4; row++) assert.deepEqual([...r.grid[row]].sort(), sorted, `row ${row} has all four`);
      for (let col = 0; col < 4; col++) {
        const column = [r.grid[0][col], r.grid[1][col], r.grid[2][col], r.grid[3][col]];
        assert.deepEqual([...column].sort(), sorted, `col ${col} has all four`);
      }
      assert.equal(r.answer, r.grid[r.blankR][r.blankC], "answer is the blanked cell");
      const correct = r.choices.filter((c) => c.correct);
      assert.equal(correct.length, 1, "exactly one correct choice");
      assert.equal(r.choices.length, 4, "four choices in the 4×4 tier");
    }
  }
});

test("makeListen: the asked object's owner is the one correct choice among all characters", () => {
  const rng = mulberry32(77);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeListen(content.LISTEN_STORIES, rng);
    assert.ok(r.pairs.some((p) => p.o === r.ask.o && p.c === r.ask.c), "the asked pair is a real pair in the story");
    assert.equal(r.choices.length, r.pairs.length, "one choice per character");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1, "exactly one correct");
    assert.equal(correct[0].c, r.ask.c, "the correct character is the one who has the asked object");
  }
});

test("makeRhymeHunt: every 'correct' cell shares the target's rhyme group; fillers don't", () => {
  const rng = mulberry32(44);
  const groupOf = {};
  content.RHYME_GROUPS.forEach((g, gi) => g.forEach((it) => { groupOf[it.word] = gi; }));
  for (let i = 0; i < 3000; i++) {
    const r = L.makeRhymeHunt(content.RHYME_GROUPS, 6, rng);
    const tGroup = groupOf[r.target.word];
    const correct = r.cells.filter((c) => c.correct);
    assert.ok(correct.length >= 1, "at least one rhyme to find");
    assert.equal(correct.length, r.count, "count matches correct cells");
    correct.forEach((c) => {
      assert.equal(groupOf[c.word], tGroup, `${c.word} must rhyme with ${r.target.word}`);
      assert.notEqual(c.word, r.target.word, "target itself is not a choice");
    });
    r.cells.filter((c) => !c.correct).forEach((c) =>
      assert.notEqual(groupOf[c.word], tGroup, `${c.word} must NOT rhyme with the target`));
  }
});

// ---------- Third batch: Finish the Word, Story Order, Conjunction Hunt ----------

test("makeDigraphFinish: the correct choice is the word's real digraph", () => {
  const rng = mulberry32(51);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeDigraphFinish(content.DIGRAPH_FINISH, rng);
    assert.ok(r.word.startsWith(r.digraph), `${r.word} must start with ${r.digraph}`);
    assert.equal(r.rest, r.word.slice(r.digraph.length), "rest is the tail after the digraph");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1, "exactly one correct");
    assert.equal(correct[0].digraph, r.digraph, "correct choice is the true digraph");
    assert.equal(r.choices.length, 3, "three choices");
    assert.equal(new Set(r.choices.map((c) => c.digraph)).size, 3, "distinct digraph choices");
  }
});

test("makeStoryOrder: tiles are the sequence, tagged with true ranks 0..n", () => {
  const rng = mulberry32(52);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeStoryOrder(content.STORY_SEQUENCES, rng);
    assert.equal(r.tiles.length, r.order.length, "a tile per step");
    // ranks are a full permutation of 0..n-1
    assert.deepEqual([...r.tiles.map((t) => t.rank)].sort((a, b) => a - b), r.order.map((_, i) => i));
    // each tile's emoji matches the correct-order emoji at its rank
    for (const t of r.tiles) assert.equal(t.emoji, r.order[t.rank], "tile emoji matches its ranked position");
  }
});

test("makeConjunctionHunt: EXACTLY one cell matches both color and shape", () => {
  const rng = mulberry32(53);
  const colors = content.CONJ_COLORS.map((c) => c.name);
  const shapes = content.CONJ_SHAPES.map((s) => s.name);
  const maxCombos = colors.length * shapes.length;
  for (const size of [9, 13, 20]) {
    for (let i = 0; i < 800; i++) {
      const r = L.makeConjunctionHunt(colors, shapes, size, rng);
      assert.equal(r.cells.length, Math.min(size, maxCombos), "field clamps to available combos");
      const both = r.cells.filter((c) => c.color === r.color && c.shape === r.shape);
      assert.equal(both.length, 1, "exactly one has BOTH target attributes");
      assert.equal(both[0].correct, true, "and it is the correct one");
      assert.equal(r.cells.filter((c) => c.correct).length, 1, "exactly one correct cell");
      // every distractor differs in color OR shape
      r.cells.filter((c) => !c.correct).forEach((c) =>
        assert.ok(c.color !== r.color || c.shape !== r.shape, "distractor is not the full conjunction"));
    }
  }
});

// ---------- Fourth batch: Continent match, Sound Hunt ----------

test("makeContinentMatch: one correct chip = the animal's home continent", () => {
  const rng = mulberry32(61);
  const conts = content.CONTINENTS;
  for (let i = 0; i < 3000; i++) {
    const r = L.makeContinentMatch(conts, rng);
    assert.ok(r.targetIndex >= 0 && r.targetIndex < conts.length, "valid target");
    const target = conts[r.targetIndex];
    assert.equal(r.animal, target.animal, "animal is the target's animal");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1, "exactly one correct");
    assert.equal(correct[0].name, target.name, "correct chip is the home continent");
    assert.equal(correct[0].color, target.color, "correct chip carries the home color");
    assert.equal(r.choices.length, 3, "three chips");
    assert.equal(new Set(r.choices.map((c) => c.name)).size, 3, "distinct continents");
  }
});

test("makeSoundHunt: the correct picture starts with the target letter; distractors don't", () => {
  const rng = mulberry32(62);
  const words = content.FIRST_SOUND_WORDS;
  for (let i = 0; i < 3000; i++) {
    const r = L.makeSoundHunt(words, 6, rng);
    const correct = r.cells.filter((c) => c.correct);
    assert.equal(correct.length, 1, "exactly one correct");
    assert.equal(correct[0].word[0].toUpperCase(), r.letter, "correct picture starts with the letter");
    r.cells.filter((c) => !c.correct).forEach((c) =>
      assert.notEqual(c.word[0].toUpperCase(), r.letter, "a distractor never starts with the target letter"));
  }
});

test("makeTopView: correct footprint = the true occupancy; distractors differ", () => {
  const rng = mulberry32(63);
  for (let i = 0; i < 3000; i++) {
    const r = L.makeTopView(rng);
    const occSet = [...r.occ].sort().join(",");
    // arrangement cells occupy exactly the occ indices
    const cellIdx = r.cells.map((c) => c.r * 2 + c.c).sort((a, b) => a - b).join(",");
    assert.equal(cellIdx, occSet, "the drawn cells match the occupancy");
    // Uniform single-cube height: a taller front block must never be able to hide
    // a back block (that made the footprint indeterminable — an unsolvable round).
    r.cells.forEach((c) => assert.equal(c.h, 1, "every block is a single cube (no occlusion)"));
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1, "exactly one correct footprint");
    assert.equal([...correct[0].occ].sort().join(","), occSet, "correct choice is the true footprint");
    // every choice is a distinct footprint, size 2-3
    const keys = r.choices.map((c) => [...c.occ].sort().join(","));
    assert.equal(new Set(keys).size, r.choices.length, "footprints are distinct");
    r.choices.forEach((c) => assert.ok(c.occ.length >= 2 && c.occ.length <= 3, "2-3 cells"));
  }
});

test("makeWebRescue: exactly `count` cells hide a friend; the rest are empty", () => {
  const rng = mulberry32(64);
  const pool = content.RESCUE_POOL;
  for (const size of [9, 11, 13]) {
    for (let i = 0; i < 800; i++) {
      const r = L.makeWebRescue(pool, size, rng);
      assert.equal(r.cells.length, size, "field is the right size");
      const friends = r.cells.filter((c) => c.correct);
      assert.ok(friends.length >= 2 && friends.length <= 4, "2-4 to rescue");
      assert.equal(friends.length, r.count, "count matches the friend cells");
      friends.forEach((c) => assert.ok(pool.includes(c.friend), "a friend is a real pool member"));
      r.cells.filter((c) => !c.correct).forEach((c) => assert.equal(c.friend, null, "empty cells hide nobody"));
    }
  }
});

test("makeNameSpell: tiles are a shuffled permutation of the name's letters", () => {
  const rng = mulberry32(73);
  for (const entry of content.NAMES) {
    for (let i = 0; i < 400; i++) {
      const r = L.makeNameSpell(entry.letters, rng);
      assert.equal(r.letters.join(""), entry.letters.toUpperCase(), "letters are the name (uppercased)");
      assert.equal(r.tiles.length, r.letters.length, "a tile per letter");
      assert.deepEqual([...r.tiles.map((t) => t.letter)].sort(), [...r.letters].sort(), "tiles are a permutation of the letters");
      r.tiles.forEach((t) => assert.match(t.letter, /^[A-Z]$/, "each tile letter is A-Z"));
    }
  }
});

test("article: picks a/an by sound so prompts never read 'a Island'", () => {
  // The concrete bug this fixes: landform names spliced after "Make a ".
  assert.equal(L.article("Island"), "an", "vowel start → an");
  assert.equal(L.article("Lake"), "a", "consonant start → a");
  assert.equal(L.article("Mountain"), "a");
  // Case/whitespace tolerant.
  assert.equal(L.article("  island  "), "an");
  assert.equal(L.article("APPLE"), "an");
  // Vowel letters generally take "an".
  for (const w of ["apple", "elephant", "igloo", "octopus", "umbrella", "egg", "owl"]) {
    assert.equal(L.article(w), "an", w + " → an");
  }
  // Consonant letters generally take "a".
  for (const w of ["dog", "banana", "kite", "sun", "web", "zebra"]) {
    assert.equal(L.article(w), "a", w + " → a");
  }
  // Sound-not-spelling exceptions a kid word set will actually hit.
  assert.equal(L.article("unicorn"), "a", "a unicorn (consonant y-sound)");
  assert.equal(L.article("uniform"), "a");
  assert.equal(L.article("one"), "a", "a one");
  assert.equal(L.article("hour"), "an", "an hour (silent h)");
  assert.equal(L.article("honest"), "an");
  // Degenerate input never throws.
  assert.equal(L.article(""), "a");
  assert.equal(L.article(null), "a");
  assert.equal(L.article(undefined), "a");
});

test("makeOddFeature: three identical + exactly one different (the odd)", () => {
  const rng = mulberry32(41);
  assert.ok(Array.isArray(content.ODD_FEATURES) && content.ODD_FEATURES.length, "need feature sets");
  for (let i = 0; i < 500; i++) {
    const r = L.makeOddFeature(content.ODD_FEATURES, rng);
    assert.equal(r.tiles.length, 4, "four tiles");
    const correct = r.tiles.filter((t) => t.correct);
    assert.equal(correct.length, 1, "exactly one odd");
    assert.equal(correct[0].emoji, r.odd, "the odd tile is the set's odd emoji");
    const base = r.tiles.filter((t) => !t.correct);
    assert.equal(base.length, 3, "three base tiles");
    base.forEach((t) => assert.equal(t.emoji, r.base, "base tiles are identical"));
    assert.notEqual(r.base, r.odd, "base and odd differ");
  }
});

// ---------- Ship A: color-mix / sink-float / mama-baby / fair-share / quick-peek / alpha-train / letter-hunt ----------

test("makeColorMix: one correct choice = the true mix result; never repeats the last mix", () => {
  const rng = mulberry32(201);
  let last = -1;
  for (let i = 0; i < 300; i++) {
    const r = L.makeColorMix(content.MIXES, rng, last);
    assert.notEqual(r.idx, last, "never the same mix twice in a row");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1, "exactly one correct color");
    assert.equal(correct[0].name, r.mix.out.name, "the correct choice IS the mix's result");
    assert.equal(new Set(r.choices.map((c) => c.name)).size, 3, "three distinct color choices");
    last = r.idx;
  }
});

test("makeSinkFloat: the answer always matches the truth set; item never repeats", () => {
  const rng = mulberry32(202);
  const sinks = new Set(content.SINK_FLOAT_SET.bins.find((b) => b.label === "Sinks").items);
  let last = null;
  for (let i = 0; i < 300; i++) {
    const r = L.makeSinkFloat(content.SINK_FLOAT_SET, rng, last);
    assert.notEqual(r.item, last, "never the same item twice in a row");
    assert.equal(r.answer, sinks.has(r.item) ? "sink" : "float", `${r.item} answer must match the truth set`);
    assert.ok(r.why && r.why.length > 8, "carries the spoken why");
    last = r.item;
  }
});

test("makeMamaBaby: the correct mama belongs to the shown baby; 3 distinct mama choices", () => {
  const rng = mulberry32(203);
  let last = -1;
  for (let i = 0; i < 300; i++) {
    const r = L.makeMamaBaby(content.MAMA_BABY, rng, last);
    assert.notEqual(r.idx, last, "never the same baby twice in a row");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].emoji, r.pair.mama, "the correct choice is THIS baby's mama");
    assert.equal(new Set(r.choices.map((c) => c.emoji)).size, 3, "three distinct mamas");
    last = r.idx;
  }
});

test("makeFairShare: total always divides evenly among the friends", () => {
  const rng = mulberry32(204);
  for (let i = 0; i < 200; i++) {
    for (const hard of [false, true]) {
      const r = L.makeFairShare(rng, hard);
      assert.equal(r.friends, hard ? 3 : 2);
      assert.ok(r.per >= 2 && r.per <= 3, `per in [2,3], got ${r.per}`);
      assert.equal(r.total, r.friends * r.per, "total = friends × per (always fair)");
      assert.equal(r.total % r.friends, 0, "always divides evenly — fairness is guaranteed");
    }
  }
});

test("makeQuickPeek: n in range, canonical dice layout, one correct choice, no repeat", () => {
  const rng = mulberry32(205);
  let last = 0;
  for (let i = 0; i < 300; i++) {
    const r = L.makeQuickPeek(rng, 6, last);
    assert.ok(r.n >= 2 && r.n <= 6, `n in [2,6], got ${r.n}`);
    assert.notEqual(r.n, last, "never the same count twice in a row");
    assert.equal(r.dots.length, r.n, "the layout shows exactly n dots");
    assert.deepEqual(r.dots, L.PEEK_LAYOUTS[r.n], "dots use the canonical dice pattern (subitizing needs stable shapes)");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].n, r.n);
    assert.equal(new Set(r.choices.map((c) => c.n)).size, 3, "three distinct number choices");
    last = r.n;
  }
});

test("makeAlphaTrain: a real consecutive alphabet window; blank never the first car", () => {
  const rng = mulberry32(206);
  let last = -1;
  for (let i = 0; i < 400; i++) {
    const r = L.makeAlphaTrain(rng, last);
    assert.equal(r.letters.length, 4);
    assert.equal(L.ALPHABET.slice(r.start, r.start + 4), r.letters.join(""), "letters are consecutive A-Z");
    assert.ok(r.blankIdx >= 1 && r.blankIdx <= 3, "the engine-side anchor letter always shows");
    assert.equal(r.answer, r.letters[r.blankIdx]);
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].ch, r.answer);
    assert.equal(new Set(r.choices.map((c) => c.ch)).size, 3, "three distinct letter choices");
    last = r.start;
  }
});

test("makeLetterHunt: exactly `need` targets (case-honest), the rest distractors", () => {
  const rng = mulberry32(207);
  let last = null;
  for (let i = 0; i < 300; i++) {
    const mixCase = i % 2 === 1;
    const r = L.makeLetterHunt(content.HUNT_LETTERS, rng, { lastTarget: last, mixCase });
    assert.notEqual(r.target, last, "never the same target twice in a row");
    const targets = r.cells.filter((c) => c.correct);
    assert.equal(targets.length, r.need, "exactly `need` target balloons");
    for (const t of targets) assert.equal(t.ch.toUpperCase(), r.target, "every target IS the target letter (any case)");
    if (!mixCase) for (const t of targets) assert.equal(t.ch, r.target, "un-ramped rounds are all-uppercase");
    for (const d of r.cells.filter((c) => !c.correct)) {
      assert.notEqual(d.ch.toUpperCase(), r.target, "a distractor may never BE the target letter");
    }
    assert.equal(r.cells.length, 9, "a full 3×3 balloon sky");
    last = r.target;
  }
});

// ---------- Ship B: piece-fit / who-hid / copy-beat / feelings / kindness / day-train / weather / seasons ----------

test("makePieceFit: the correct piece IS the hole's shape; 3 distinct; no repeat", () => {
  const rng = mulberry32(301);
  let last = null;
  for (let i = 0; i < 300; i++) {
    const r = L.makePieceFit(content.SHAPES, rng, last);
    assert.notEqual(r.shape.name, last, "never the same hole twice in a row");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].name, r.shape.name, "the correct piece matches the hole");
    assert.equal(new Set(r.choices.map((c) => c.name)).size, 3, "three distinct pieces");
    last = r.shape.name;
  }
});

test("makeWhoHid: 4 distinct characters; choices come FROM the lineup (self-checking)", () => {
  const rng = mulberry32(302);
  for (let i = 0; i < 300; i++) {
    const r = L.makeWhoHid(content.ANIMALS, rng);
    assert.equal(r.lineup.length, 4);
    assert.equal(new Set(r.lineup.map((c) => c.emoji)).size, 4, "lineup all distinct");
    const lineupEmojis = new Set(r.lineup.map((c) => c.emoji));
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].emoji, r.lineup[r.hiddenIdx].emoji, "the answer IS the hidden one");
    for (const c of r.choices) assert.ok(lineupEmojis.has(c.emoji), "every choice is from the lineup (elimination works)");
    assert.equal(new Set(r.choices.map((c) => c.emoji)).size, 3, "three distinct choices");
  }
});

test("makeBeat: length as asked (2-4), drums 0-2, never two identical hits in a row", () => {
  const rng = mulberry32(303);
  for (let i = 0; i < 400; i++) {
    const len = 2 + (i % 3);
    const r = L.makeBeat(rng, len);
    assert.equal(r.seq.length, len);
    for (const d of r.seq) assert.ok(d >= 0 && d <= 2, "drum index in range");
    for (let k = 1; k < r.seq.length; k++) assert.notEqual(r.seq[k], r.seq[k - 1], "no doubled hit (clearer to echo)");
  }
});

test("makeFeeling: the correct face matches the story's feeling; 3 distinct faces", () => {
  const rng = mulberry32(304);
  let last = -1;
  for (let i = 0; i < 300; i++) {
    const r = L.makeFeeling(content.FEELINGS, content.FEELING_STORIES, rng, last);
    assert.notEqual(r.idx, last, "never the same story twice in a row");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].id, r.story.feel, "the correct face IS the story's feeling");
    assert.equal(new Set(r.choices.map((c) => c.id)).size, 3, "three distinct feelings offered");
    last = r.idx;
  }
});

test("makeKindness: options preserved and shuffled; exactly one kind", () => {
  const rng = mulberry32(305);
  let last = -1;
  for (let i = 0; i < 300; i++) {
    const r = L.makeKindness(content.KINDNESS, rng, last);
    assert.notEqual(r.idx, last, "never the same scenario twice in a row");
    assert.equal(r.options.length, 3);
    assert.equal(r.options.filter((o) => o.kind).length, 1, "exactly one kind option survives the shuffle");
    last = r.idx;
  }
});

test("makeDayTrain: the blank is a real day (never Sunday, the anchor); choices distinct", () => {
  const rng = mulberry32(306);
  let last = -1;
  for (let i = 0; i < 400; i++) {
    const r = L.makeDayTrain(content.DAYS, rng, last);
    assert.ok(r.blankIdx >= 1 && r.blankIdx <= 6, "Sunday anchors the train — never the blank");
    assert.notEqual(r.blankIdx, last, "never the same blank twice in a row");
    assert.equal(r.answer.name, content.DAYS[r.blankIdx].name);
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].name, r.answer.name);
    assert.equal(new Set(r.choices.map((c) => c.name)).size, 3, "three distinct day choices");
    last = r.blankIdx;
  }
});

test("makeWeather: correct gear = this weather's gear; distractors from OTHER weathers", () => {
  const rng = mulberry32(307);
  const gearOf = Object.fromEntries(content.WEATHERS.map((w) => [w.gear, w.name]));
  let last = -1;
  for (let i = 0; i < 300; i++) {
    const r = L.makeWeather(content.WEATHERS, rng, last);
    assert.notEqual(r.idx, last, "never the same weather twice in a row");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1);
    assert.equal(correct[0].emoji, r.weather.gear);
    for (const c of r.choices) assert.ok(gearOf[c.emoji], "every choice is a real weather's gear");
    assert.equal(new Set(r.choices.map((c) => c.emoji)).size, 3, "three distinct gear choices");
    last = r.idx;
  }
});

test("makeSeasonItem: the item's season index is truthful; item never repeats", () => {
  const rng = mulberry32(308);
  let last = null;
  for (let i = 0; i < 300; i++) {
    const r = L.makeSeasonItem(content.SEASONS, rng, last);
    assert.notEqual(r.item, last, "never the same item twice in a row");
    assert.ok(content.SEASONS[r.seasonIdx].items.includes(r.item), "seasonIdx points at the item's real season");
    assert.equal(r.seasonName, content.SEASONS[r.seasonIdx].name);
    last = r.item;
  }
});

// ================= 华丽 (Huali) logic functions =================
const HL = require("../scripts/hl-content.js");

test("makeOrderTrain: a consecutive window, blank never first, honest choices", () => {
  const rng = mulberry32(71);
  const list = HL.TILE_NUMBERS.map((n) => n + "筒");
  let lastStart = -1;
  for (let i = 0; i < 400; i++) {
    const r = L.makeOrderTrain(list, rng, { window: 4, lastStart });
    assert.equal(r.items.length, 4);
    // the window really is consecutive slices of the source list
    assert.deepEqual(r.items, list.slice(r.start, r.start + 4));
    assert.ok(r.blankIdx >= 1 && r.blankIdx < 4, "blank never in the first slot");
    assert.equal(r.answer, r.items[r.blankIdx], "answer is the blanked item");
    assert.equal(r.choices.filter((c) => c.correct).length, 1);
    assert.ok(r.choices.some((c) => c.correct && c.value === r.answer));
    assert.equal(new Set(r.choices.map((c) => c.value)).size, r.choices.length, "choices distinct");
    assert.notEqual(r.start, lastStart === -1 ? NaN : lastStart, "start varies from lastStart");
    lastStart = r.start;
  }
  // works on the 5-item moon list and the 12-item zodiac too
  const m = L.makeOrderTrain(HL.MOON, rng, { window: 4 });
  assert.deepEqual(m.items, HL.MOON.slice(m.start, m.start + 4));
  const z = L.makeOrderTrain(HL.ZODIAC.map((x) => x.name), rng, { window: 4 });
  assert.equal(z.items.length, 4);
});

test("makeIdiomFill: blanks the right character, wrong chars can't be right", () => {
  const rng = mulberry32(72);
  let last = -1;
  for (let i = 0; i < 300; i++) {
    const r = L.makeIdiomFill(HL.IDIOMS, rng, last);
    assert.notEqual(r.idx, last, "no immediate repeat");
    assert.equal(r.answer, r.idiom.text[r.idiom.blank]);
    assert.equal(r.display.length, 4);
    assert.equal(r.display[r.idiom.blank], "▢");
    assert.equal(r.choices.filter((c) => c.correct).length, 1);
    for (const c of r.choices) if (!c.correct) assert.notEqual(c.ch, r.answer);
    last = r.idx;
  }
});

test("makePoemNext: the answer is ALWAYS the poem's true next line; distractors from other poems", () => {
  const rng = mulberry32(73);
  let last = null;
  for (let i = 0; i < 400; i++) {
    const r = L.makePoemNext(HL.POEMS, rng, last);
    assert.notEqual(r.key, last, "no immediate repeat of the same prompt line");
    const li = r.poem.lines.indexOf(r.prompt);
    assert.ok(li >= 0 && li < r.poem.lines.length - 1, "prompt is a non-final line");
    assert.equal(r.answer, r.poem.lines[li + 1], "answer is the real next line");
    assert.equal(r.choices.filter((c) => c.correct).length, 1);
    for (const c of r.choices) {
      if (!c.correct) assert.ok(!r.poem.lines.includes(c.line), "a distractor must come from a DIFFERENT poem (never a plausible other line of this one)");
    }
    last = r.key;
  }
});

test("makeMeasureWord: one correct 量词, distractors are other nouns' words", () => {
  const rng = mulberry32(74);
  let last = -1;
  for (let i = 0; i < 300; i++) {
    const r = L.makeMeasureWord(HL.MEASURE_WORDS, rng, last);
    assert.notEqual(r.idx, last);
    assert.equal(r.choices.filter((c) => c.correct).length, 1);
    assert.ok(r.choices.some((c) => c.correct && c.mw === r.pair.mw));
    assert.equal(new Set(r.choices.map((c) => c.mw)).size, r.choices.length, "no duplicate chips");
    // A distractor must never be an ALSO-valid 量词 for the noun (e.g. 只 for 鞋):
    // marking a grammatically-correct answer wrong would teach a falsehood.
    (r.pair.alsoOk || []).forEach((ok) => {
      assert.ok(!r.choices.some((c) => !c.correct && c.mw === ok),
        `measure-word offered alsoOk "${ok}" as a wrong answer for ${r.pair.noun}`);
    });
    last = r.idx;
  }
});

test("makeMeasureWord: the 鞋 alsoOk guard actually excludes 只 across many draws", () => {
  const rng = mulberry32(741);
  const shoeIdx = HL.MEASURE_WORDS.findIndex((p) => p.noun === "鞋");
  assert.ok(shoeIdx >= 0 && (HL.MEASURE_WORDS[shoeIdx].alsoOk || []).includes("只"),
    "鞋 must declare 只 as an also-valid 量词 so it's never a wrong distractor");
  let sawShoe = 0;
  for (let i = 0; i < 2000; i++) {
    const r = L.makeMeasureWord(HL.MEASURE_WORDS, rng, -1);
    if (r.pair.noun !== "鞋") continue;
    sawShoe++;
    assert.ok(!r.choices.some((c) => !c.correct && c.mw === "只"), "只 must never be a wrong choice for 鞋");
  }
  assert.ok(sawShoe > 50, "expected 鞋 to come up many times");
});

test("makePairPick: generic q→a pairing with deduped distractors (regional, antonyms)", () => {
  const rng = mulberry32(75);
  for (const items of [
    HL.REGIONAL.map((p) => ({ q: p.dish, a: p.city })),
    HL.ANTONYMS.map((p) => ({ q: p.a, a: p.b })),
  ]) {
    let last = -1;
    for (let i = 0; i < 300; i++) {
      const r = L.makePairPick(items, rng, last);
      assert.notEqual(r.idx, last);
      assert.equal(r.choices.filter((c) => c.correct).length, 1);
      assert.ok(r.choices.some((c) => c.correct && c.a === r.item.a));
      assert.equal(new Set(r.choices.map((c) => c.a)).size, r.choices.length, "a wrong chip can never read the same as the right one");
      last = r.idx;
    }
  }
});

test("makeMenuMemory: k dishes to remember hide among n, flags exactly them", () => {
  const rng = mulberry32(76);
  for (let i = 0; i < 300; i++) {
    const r = L.makeMenuMemory(HL.DISHES, rng, { k: 3, n: 6 });
    assert.equal(r.menu.length, 3);
    assert.equal(r.cells.length, 6);
    assert.equal(r.cells.filter((c) => c.correct).length, 3);
    const menuSet = new Set(r.menu);
    for (const c of r.cells) assert.equal(c.correct, menuSet.has(c.name), `${c.name} flag must match menu membership`);
    assert.equal(new Set(r.cells.map((c) => c.name)).size, 6, "board dishes distinct");
  }
});

test("makeMarket: total is the true sum of two distinct items", () => {
  const rng = mulberry32(77);
  for (let i = 0; i < 300; i++) {
    const r = L.makeMarket(HL.MARKET, rng);
    assert.notEqual(r.a.name, r.b.name, "two different items");
    assert.equal(r.total, r.a.price + r.b.price);
    assert.equal(r.choices.filter((c) => c.correct).length, 1);
    assert.ok(r.choices.some((c) => c.correct && c.n === r.total));
    for (const c of r.choices) assert.ok(c.n >= 1);
  }
});

test("makeChange: change from 10元 is always 10 - cost", () => {
  const rng = mulberry32(78);
  let last = 0;
  for (let i = 0; i < 300; i++) {
    const r = L.makeChange(rng, last);
    assert.ok(r.cost >= 2 && r.cost <= 9);
    assert.notEqual(r.cost, last, "no immediate repeat");
    assert.equal(r.change, 10 - r.cost);
    assert.equal(r.pay, 10);
    assert.equal(r.choices.filter((c) => c.correct).length, 1);
    assert.ok(r.choices.some((c) => c.correct && c.n === r.change));
    last = r.cost;
  }
});

test("makeCharCrowd: one lookalike hides in a field of the base character", () => {
  const rng = mulberry32(79);
  for (let i = 0; i < 300; i++) {
    const r = L.makeCharCrowd(HL.CHAR_PAIRS, 9, rng);
    assert.equal(r.cells.length, 9);
    assert.notEqual(r.base, r.odd);
    assert.equal(r.cells.filter((c) => c.correct).length, 1, "exactly one odd cell");
    r.cells.forEach((c, idx) => {
      if (idx === r.oddIndex) { assert.equal(c.ch, r.odd); assert.ok(c.correct); }
      else { assert.equal(c.ch, r.base); assert.ok(!c.correct); }
    });
    // base/odd really are a curated lookalike pair
    assert.ok(HL.CHAR_PAIRS.some((p) => (p.a === r.base && p.b === r.odd) || (p.b === r.base && p.a === r.odd)));
  }
});

test("makeMissingAddend: a + answer = sum with distinct positive choices", () => {
  const rng = mulberry32(80);
  for (const max of [9, 20]) {
    for (let i = 0; i < 400; i++) {
      const r = L.makeMissingAddend(rng, { max });
      assert.ok(r.a >= 2 && r.a <= max);
      assert.ok(r.answer >= 1 && r.answer <= max);
      assert.equal(r.a + r.answer, r.sum, "the equation must be true");
      assert.equal(r.choices.length, 3);
      assert.equal(r.choices.filter((c) => c.correct).length, 1);
      assert.ok(r.choices.some((c) => c.correct && c.n === r.answer));
      assert.equal(new Set(r.choices.map((c) => c.n)).size, 3, "choices distinct");
      for (const c of r.choices) assert.ok(c.n >= 1, "never a zero/negative chip");
    }
  }
});
