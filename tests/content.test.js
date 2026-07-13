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

// ---------- I Spy categories are DISJOINT (a filler can never be a hidden member) ----------
test("find categories are disjoint and each item belongs to exactly one", () => {
  const seen = new Map();
  for (const cat of content.FIND_CATEGORIES) {
    assert.ok(cat.items.length >= 4, `category ${cat.id} needs several items`);
    for (const e of cat.items) {
      assert.ok(!seen.has(e), `"${e}" is in both ${seen.get(e)} and ${cat.id} — categories must be disjoint`);
      seen.set(e, cat.id);
    }
  }
});

// ---------- 3D solids: each real object is truly that solid's shape ----------
// Independent ground truth: object -> the ONE solid whose shape it has.
const SOLID_TRUTH = {
  "⚽": "Ball", "🏀": "Ball", "🌍": "Ball", "🍊": "Ball",
  "📦": "Box", "🎲": "Box", "🧊": "Box",
  "🍦": "Cone", "🥕": "Cone",
  "🥫": "Can", "🥁": "Can", "🔋": "Can",
};
test("every solid's objects really have that solid's 3D shape (and are disjoint)", () => {
  const seen = new Map();
  for (const solid of content.SOLID_SETS) {
    assert.ok(solid.objects.length >= 2, `${solid.name} needs >= 2 objects`);
    assert.ok(/^<.*>$/s.test(solid.svg.trim()), `${solid.name} needs an SVG body`);
    for (const o of solid.objects) {
      assert.equal(SOLID_TRUTH[o], solid.name, `${o} should be shaped like a ${solid.name}`);
      assert.ok(!seen.has(o), `${o} is used by two solids`);
      seen.set(o, solid.name);
    }
  }
});

// ---------- Who Is It? attributes make deduction solvable ----------
test("deduction attributes are distinct so a color+item clue is unique", () => {
  const colors = content.DEDUCE_COLORS.map((c) => c.key);
  const items = content.DEDUCE_ITEMS.map((i) => i.key);
  assert.equal(new Set(colors).size, colors.length, "colors must be distinct");
  assert.equal(new Set(items).size, items.length, "items must be distinct");
  assert.ok(colors.length >= 2 && items.length >= 2, "need >= 2 of each for 6 unique combos");
  for (const c of content.DEDUCE_COLORS) assert.match(c.hex, /^#[0-9a-f]{6}$/i, `${c.key} needs a hex`);
});

// ---------- Blue Planet: land features vs water, verified ----------
const LANDWATER_TRUTH = {
  Land: ["🏔️", "🌋", "🏜️", "🌳", "🏕️", "🏙️"],
  Water: ["🐟", "🐳", "⛵", "🏄", "💧", "🐠"],
};
test("blue-planet land/water sort matches verified truth", () => {
  const set = content.BLUE_PLANET_SETS[0];
  for (const bin of set.bins) {
    assert.deepEqual([...bin.items].sort(), [...LANDWATER_TRUTH[bin.label]].sort(),
      `land/water bin "${bin.label}" does not match the verified truth`);
  }
});

// ---------- Continents: distinct colors + one signature animal each ----------
test("continents have distinct colors and names and a signature animal", () => {
  const conts = content.CONTINENTS;
  assert.ok(conts.length >= 6, "need at least six continents");
  assert.equal(new Set(conts.map((c) => c.name)).size, conts.length, "names distinct");
  assert.equal(new Set(conts.map((c) => c.color)).size, conts.length, "colors distinct (so a color clue is unambiguous)");
  assert.equal(new Set(conts.map((c) => c.animal)).size, conts.length, "each continent has its own animal");
  for (const c of conts) {
    assert.match(c.color, /^#[0-9a-f]{6}$/i, `${c.name} needs a hex color`);
    assert.ok(typeof c.cx === "number" && typeof c.cy === "number" && c.rx > 0 && c.ry > 0, `${c.name} needs a map blob`);
  }
});

// ---------- Finish the Word: every word truly begins with its digraph ----------
test("digraph-finish words really start with their sh/ch/th", () => {
  const OK = new Set(["sh", "ch", "th"]);
  const digs = new Set();
  for (const w of content.DIGRAPH_FINISH) {
    assert.ok(OK.has(w.digraph), `${w.word} has an unexpected digraph ${w.digraph}`);
    assert.ok(w.word.startsWith(w.digraph), `${w.word} must start with ${w.digraph}`);
    digs.add(w.digraph);
  }
  assert.equal(digs.size, 3, "need all three of sh, ch, th present for distractors");
});

// ---------- Story sequences are clean 3-picture, distinct-emoji sequences ----------
test("story sequences are 3 distinct pictures each", () => {
  assert.ok(content.STORY_SEQUENCES.length >= 3, "need several sequences");
  for (const s of content.STORY_SEQUENCES) {
    assert.ok(s.steps.length >= 3, `${s.name} needs >= 3 steps`);
    assert.equal(new Set(s.steps).size, s.steps.length, `${s.name} steps must be distinct`);
  }
});

// ---------- Letter-maker paths are simple, well-formed ----------
test("letter paths have a guide letter and >= 3 ordered dots", () => {
  for (const lp of content.LETTER_PATHS) {
    assert.match(lp.letter, /^[A-Z]$/, `letter must be A-Z, got ${lp.letter}`);
    assert.ok(lp.dots.length >= 3, `${lp.letter} needs >= 3 dots`);
    for (const d of lp.dots) {
      assert.ok(d.x >= 0 && d.x <= 100 && d.y >= 0 && d.y <= 100, `${lp.letter} dot out of bounds`);
    }
  }
});

// ---------- Magnet sort: only truly magnetic (ferrous/metal) items stick ----------
const MAGNET_TRUTH = {
  Sticks: ["🔑", "🪙", "🔩", "⚙️", "📎", "🥫"],
  No: ["🪵", "🧸", "🍎", "📗", "🧦", "🎈"],
};
test("magnet sort matches verified magnetic truth", () => {
  const set = content.MAGNET_SETS[0];
  for (const bin of set.bins) {
    assert.deepEqual([...bin.items].sort(), [...MAGNET_TRUTH[bin.label]].sort(),
      `magnet bin "${bin.label}" does not match the verified truth`);
  }
});

// ---------- Conjunction attributes are distinct (so a color+shape clue is unique) ----------
test("conjunction colors and shapes are distinct", () => {
  const colors = content.CONJ_COLORS.map((c) => c.name);
  const shapes = content.CONJ_SHAPES.map((s) => s.name);
  assert.equal(new Set(colors).size, colors.length, "distinct colors");
  assert.equal(new Set(shapes).size, shapes.length, "distinct shapes");
  assert.ok(colors.length >= 2 && shapes.length >= 2, "need >= 2 of each");
  for (const c of content.CONJ_COLORS) assert.match(c.hex, /^#[0-9a-f]{6}$/i, `${c.name} needs a hex`);
});

test("picture-square trios are exactly 3 distinct, self-naming pictures", () => {
  assert.ok(content.SQUARE_TRIOS.length >= 3, "need several trios to rotate");
  for (const trio of content.SQUARE_TRIOS) {
    assert.equal(trio.length, 3, `trio ${trio} must have 3 symbols`);
    assert.equal(new Set(trio).size, 3, `trio ${trio} must be all distinct`);
  }
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
