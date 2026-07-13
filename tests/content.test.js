// CORRECTNESS tests. This is a teaching tool for Josh, so every answer must be
// TRUE. These tests independently restate the ground truth for the content and
// assert the data agrees — so a future edit can never silently make an answer
// wrong. When you change a fact in content.js, update the truth here too; that
// friction is the point.

const test = require("node:test");
const assert = require("node:assert");
const content = require("../scripts/content.js");

// ---------- First sound: the keyed letter is really the word's first letter ----------
test("first-sound: letter is the word's beginning letter (and A-Z)", () => {
  for (const w of content.FIRST_SOUND_WORDS) {
    assert.match(w.letter, /^[A-Z]$/, `bad letter for ${w.word}`);
    assert.equal(w.letter, w.word[0].toUpperCase(), `${w.word} should start with ${w.letter}`);
    assert.ok(w.word.length >= 2, `word too short: ${w.word}`);
  }
});

// ---------- CVC: build-a-word / missing-letter words are truly consonant-vowel-consonant ----------
test("CVC words are exactly consonant-vowel-consonant", () => {
  const CVC = /^[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvwxyz]$/;
  for (const w of content.CVC_WORDS) {
    assert.match(w.word, CVC, `${w.word} is not a clean CVC word`);
  }
});

// ---------- Rhyme: every member of a group truly rhymes; groups never cross-rhyme ----------
const RHYME_KEY = {
  cat: "at", hat: "at", bat: "at",
  dog: "og", frog: "og", log: "og",
  star: "ar", car: "ar", jar: "ar",
  bee: "ee", tree: "ee", key: "ee",
  moon: "oon", spoon: "oon",
  snail: "ale", whale: "ale",
};
test("rhyme groups: all members share one rhyme; each group's rhyme is unique", () => {
  const groupKeys = [];
  for (const group of content.RHYME_GROUPS) {
    const keys = group.map((it) => {
      assert.ok(RHYME_KEY[it.word], `no rhyme key known for "${it.word}" — verify it rhymes`);
      return RHYME_KEY[it.word];
    });
    assert.equal(new Set(keys).size, 1, `group ${group.map((g) => g.word)} does not all rhyme`);
    groupKeys.push(keys[0]);
  }
  // Distinct rhymes per group => a distractor from another group can never rhyme.
  assert.equal(new Set(groupKeys).size, groupKeys.length, "two rhyme groups share a rhyme (distractors could rhyme)");
});

// ---------- Sight words are genuinely common high-frequency (Dolch/Fry) words ----------
const SIGHT_OK = new Set([
  "the", "of", "and", "a", "to", "in", "is", "you", "that", "it", "he", "was", "for", "on", "are",
  "as", "with", "his", "they", "i", "at", "be", "this", "have", "from", "or", "one", "had", "by",
  "but", "not", "what", "all", "were", "we", "when", "your", "can", "said", "there", "use", "an",
  "which", "she", "do", "how", "their", "if", "will", "up", "look", "go", "see", "my", "like", "me",
  "come", "some", "make", "play", "run", "jump", "little", "big", "yes", "no",
]);
test("sight words are real common words (Dolch/Fry)", () => {
  for (const w of content.SIGHT_WORDS) {
    assert.ok(SIGHT_OK.has(w), `"${w}" is not a recognized common sight word`);
  }
});

// ---------- Digraphs: every "sh" picture starts with sh, every "ch" with ch ----------
const DIGRAPH_WORD = {
  "🚢": "ship", "🐑": "sheep", "👟": "shoe", "🐚": "shell", "🦈": "shark",
  "🧀": "cheese", "🍒": "cherry", "🪑": "chair", "🐤": "chick", "🍫": "chocolate",
};
test("digraph pictures really start with their sound (sh / ch)", () => {
  const set = content.DIGRAPH_SETS[0];
  for (const bin of set.bins) {
    for (const emoji of bin.items) {
      const word = DIGRAPH_WORD[emoji];
      assert.ok(word, `no known word for digraph picture ${emoji}`);
      assert.ok(word.startsWith(bin.label), `${word} (${emoji}) does not start with "${bin.label}"`);
    }
  }
});

// ---------- Sorts: every item is in the TRUTHFUL bin (independent ground truth) ----------
// Each entry is the verified, real-world-correct membership. Content must match
// exactly; adding/moving an item requires updating this truth (a deliberate gate).
const SORT_TRUTH = {
  living: { Alive: ["🐶", "🐱", "🌳", "🌷", "🐝", "🐟", "🦋", "🐢", "🌻"], "Not alive": ["🪨", "🚗", "⚽", "🥄", "📦", "🔑", "👟", "🪑", "🧱"] },
  sinkfloat: { Sinks: ["🪨", "🔑", "🥄", "🧱", "⚓", "🪙"], Floats: ["🍃", "🎈", "🦆", "🛟", "🪵", "🍎"] },
  plantanimal: { Plant: ["🌳", "🌻", "🌵", "🌷", "🌼", "🌴"], Animal: ["🐶", "🐱", "🐟", "🐘", "🦁", "🐸"] },
  daynight: { Day: ["🌻", "🌈", "⛅", "🏖️", "🪁", "🌅"], Night: ["⭐", "🦉", "🌌", "🛌", "🕯️", "🦇"] },
  hotcold: { Hot: ["☀️", "🌶️", "🍲", "☕", "🏜️", "🌋"], Cold: ["🧊", "⛄", "🍦", "🐧", "🏔️", "🥶"] },
  law: { Land: ["🚗", "🚙", "🚌", "🐘", "🦁", "🏠"], Air: ["✈️", "🚁", "🦅", "🎈", "🚀", "🦋"], Water: ["🐟", "🐬", "🚤", "🐠", "🐙", "⛵"] },
  redblue: { Red: ["🍎", "🍓", "🍅", "🌹", "❤️"], Blue: ["🫐", "💙", "🌀", "💧", "🐳"] },
  yellowgreen: { Yellow: ["🍌", "🌟", "🌻", "🧀", "🐤"], Green: ["🥦", "🐸", "🌲", "🥝", "🍀"] },
};
test("every sortable item is in the truthful bin", () => {
  const allSets = [
    ...content.SORT_SETS, ...content.COLOR_SETS, ...content.LAW_SETS,
    ...content.DAY_NIGHT_SETS, ...content.HOT_COLD_SETS,
  ];
  const byName = Object.fromEntries(allSets.map((s) => [s.name, s]));
  for (const [name, truth] of Object.entries(SORT_TRUTH)) {
    const set = byName[name];
    assert.ok(set, `missing sort set "${name}"`);
    // exact bin membership must equal the truth
    for (const bin of set.bins) {
      const truthItems = truth[bin.label];
      assert.ok(truthItems, `no truth for bin "${bin.label}" in set "${name}"`);
      assert.deepEqual([...bin.items].sort(), [...truthItems].sort(),
        `set "${name}" bin "${bin.label}" does not match verified truth`);
    }
    // and no extra bins beyond the truth
    assert.equal(set.bins.length, Object.keys(truth).length, `set "${name}" has an unexpected number of bins`);
  }
});

// ---------- A couple of config sanity checks ----------
test("skip-count steps and block colors are as intended", () => {
  assert.deepEqual(content.SKIP_STEPS, [2, 5, 10]);
  assert.equal(content.BLOCK_COLORS.length, 10, "need 10 tower colors (1..10)");
});

test("color-by-number pictures are valid (equal-width rows; known colors; <=3 wide)", () => {
  const keys = new Set(Object.keys(content.CBN_COLORS));
  for (const pic of content.CBN_PICTURES) {
    assert.ok(pic.rows.length >= 2, `${pic.name} needs rows`);
    const w = pic.rows[0].length;
    assert.ok(w <= 3, `${pic.name} must be <= 3 wide so cells stay >= 75px at 320px`);
    for (const row of pic.rows) {
      assert.equal(row.length, w, `${pic.name} rows must be equal width`);
      for (const ch of row) assert.ok(keys.has(ch), `${pic.name} uses undefined color number "${ch}"`);
    }
  }
});
