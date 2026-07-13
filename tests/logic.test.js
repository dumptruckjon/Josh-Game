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

test("makeBigAdd: two-digit, no regrouping, honest sum, one correct choice", () => {
  const rng = mulberry32(32);
  for (let i = 0; i < 4000; i++) {
    const r = L.makeBigAdd(rng);
    assert.equal(r.a, r.aTens * 10 + r.aOnes, "a split is consistent");
    assert.equal(r.b, r.bTens * 10 + r.bOnes, "b split is consistent");
    assert.ok(r.a >= 10 && r.b >= 10, "both are two-digit");
    assert.ok(r.aOnes + r.bOnes <= 9, "ones never carry");
    assert.ok(r.aTens + r.bTens <= 9, "tens never overflow past 90");
    assert.equal(r.sum, r.a + r.b, "sum is truthful");
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1, "exactly one correct");
    assert.equal(correct[0].n, r.sum, "correct choice is the sum");
    assert.equal(new Set(r.choices.map((c) => c.n)).size, r.choices.length, "no duplicate choices");
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
    r.cells.forEach((c) => assert.ok(c.h >= 1 && c.h <= 2, "stack height 1-2"));
    const correct = r.choices.filter((c) => c.correct);
    assert.equal(correct.length, 1, "exactly one correct footprint");
    assert.equal([...correct[0].occ].sort().join(","), occSet, "correct choice is the true footprint");
    // every choice is a distinct footprint, size 2-3
    const keys = r.choices.map((c) => [...c.occ].sort().join(","));
    assert.equal(new Set(keys).size, r.choices.length, "footprints are distinct");
    r.choices.forEach((c) => assert.ok(c.occ.length >= 2 && c.occ.length <= 3, "2-3 cells"));
  }
});
