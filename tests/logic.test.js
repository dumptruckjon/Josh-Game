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
