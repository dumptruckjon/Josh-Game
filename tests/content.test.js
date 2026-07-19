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
  star: "ar", car: "ar", guitar: "ar",
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
  "🚢": "ship", "🦐": "shrimp", "👟": "shoe", "🐚": "shell", "🦈": "shark",
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
  living: { Alive: ["🐶", "🐱", "🌳", "🌷", "🐝", "🐟", "🦋", "🐢", "🌻", "🐛", "🌵", "🐌"], "Not alive": ["🪨", "🚗", "⚽", "🥄", "📦", "🔑", "👟", "🪑", "🧱", "🤖", "🕯️", "⌚"] },
  sinkfloat: { Sinks: ["🪨", "🔑", "🥄", "🧱", "⚓", "🪙"], Floats: ["🍃", "🎈", "🦆", "🛶", "🪵", "🍎"] },
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

// ---------- Landforms build config is valid (3x3 plus-shape, known cells) ----------
test("landforms match their definition: a center feature with the surround all around", () => {
  assert.ok(content.LANDFORMS.length >= 2, "need at least two landforms");
  for (const lf of content.LANDFORMS) {
    // The picture must be the INVERSE of the old plus-fill: a `feature` placed in
    // the middle, surrounded on every side by a DIFFERENT `base` — so the grid
    // literally reads "<feature> with <base> all around".
    assert.ok(lf.name && lf.base && lf.feature, `${lf.name} needs a name, a base (surround) and a feature (middle)`);
    assert.notEqual(lf.base, lf.feature, `${lf.name}: the middle feature must differ from the surround (or nothing shows)`);
    assert.ok(Array.isArray(lf.reveals) && lf.reveals.length >= 1, `${lf.name} needs at least one reveal picture`);
    assert.ok(lf.reveals.every((r) => typeof r === "string" && r.length), `${lf.name} reveals must be non-empty strings`);
    assert.ok(lf.say && /all around/i.test(lf.say), `${lf.name}'s spoken line must teach the "all around" concept`);
  }
  // Island = land in water; Lake = water in land (the two must be true inverses).
  const island = content.LANDFORMS.find((l) => l.name === "Island");
  const lake = content.LANDFORMS.find((l) => l.name === "Lake");
  assert.ok(island && lake, "keep both Island and Lake");
  assert.equal(island.base, lake.feature, "the island's water-surround is the lake's water-middle");
  assert.equal(island.feature, lake.base, "the island's land-middle is the lake's land-surround");
  // Mountain was intentionally dropped (height can't be shown top-down).
  assert.ok(!content.LANDFORMS.some((l) => l.name === "Mountain"), "Mountain should be gone (not top-down representable)");
});

test("rescue pool is several distinct friendly faces", () => {
  assert.ok(content.RESCUE_POOL.length >= 4, "need a few faces to rescue");
  assert.equal(new Set(content.RESCUE_POOL).size, content.RESCUE_POOL.length, "distinct faces");
});

test("villains (Thwip the Villains) are several distinct silly baddies", () => {
  assert.ok(Array.isArray(content.VILLAINS) && content.VILLAINS.length >= 4, "need a few baddies to web");
  content.VILLAINS.forEach((v) => assert.ok(v.name && v.emoji, "a villain needs a name + emoji"));
  assert.equal(new Set(content.VILLAINS.map((v) => v.emoji)).size, content.VILLAINS.length, "villain emojis are distinct");
});

test("Listen & Answer stories: distinct characters + objects, each with a spoken name", () => {
  assert.ok(Array.isArray(content.LISTEN_STORIES) && content.LISTEN_STORIES.length >= 3, "need several stories");
  for (const s of content.LISTEN_STORIES) {
    assert.ok(Array.isArray(s.pairs) && s.pairs.length >= 2 && s.pairs.length <= 3, "2–3 pairs per story");
    const chars = s.pairs.map((p) => p.c), objs = s.pairs.map((p) => p.o);
    assert.equal(new Set(chars).size, chars.length, "characters are distinct (so 'who has it' is unique)");
    assert.equal(new Set(objs).size, objs.length, "objects are distinct (so the question has one answer)");
    s.pairs.forEach((p) => {
      assert.ok(p.c && p.o && p.cn && p.on, "each pair needs a character+object emoji and their spoken names");
    });
  }
});

test("Read & Do sentences: short words, and the correct picture really is one of the 3 choices", () => {
  assert.ok(Array.isArray(content.SENTENCES) && content.SENTENCES.length >= 4, "need several sentences");
  for (const s of content.SENTENCES) {
    assert.ok(typeof s.text === "string" && s.text.trim(), `sentence needs text`);
    const words = s.text.trim().split(/\s+/);
    assert.ok(words.length >= 2 && words.length <= 4, `"${s.text}" should be 2–4 short words`);
    assert.equal(s.text, s.text.toLowerCase(), `"${s.text}" stays lowercase (early reading)`);
    assert.ok(Array.isArray(s.pics) && s.pics.length === 3, `"${s.text}" needs exactly 3 picture choices`);
    assert.equal(new Set(s.pics).size, 3, `"${s.text}" choices must be distinct`);
    assert.ok(s.pics.includes(s.answer), `"${s.text}" answer must be one of its choices`);
  }
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
  // "Animal Homes" shows the animal ALONE, so each signature animal MUST be
  // single-continent-iconic for a preschooler — otherwise a genuinely-true home
  // gets marked wrong. Eagle (🦅) and deer (🦌) were multi-continent and are
  // banned here; bison→N.America and hedgehog→Europe replaced them.
  const HOME = {};
  conts.forEach((c) => { HOME[c.name] = c.animal; });
  assert.equal(HOME["North America"], "🦬", "N.America's animal must be the (single-continent) bison, not a multi-continent eagle");
  assert.equal(HOME["Europe"], "🦔", "Europe's animal must be the hedgehog, not a multi-continent deer");
  const MULTI_CONTINENT = ["🦅", "🦌", "🐺", "🦊", "🐻", "🦉"]; // ranges span several of these continents
  for (const c of conts) {
    assert.ok(!MULTI_CONTINENT.includes(c.animal),
      `${c.name}'s animal ${c.animal} has a multi-continent range — a lone-animal home quiz would mark a true tap wrong`);
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
// Only genuinely ferromagnetic (steel/iron) items stick. Coins/brass keys do NOT.
const MAGNET_TRUTH = {
  Sticks: ["🔩", "⚙️", "📎", "🥫", "🔧", "🧷"],
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

// ---------- Plane shapes: each object really has that shape ----------
const PLANE_TRUTH = {
  "🍪": "Circle", "🕐": "Circle",
  "🪟": "Square", "🧇": "Square",
  "🍕": "Triangle", "📐": "Triangle", "🔺": "Triangle",
  "⭐": "Star", "🌟": "Star", "✨": "Star",
  "❤️": "Heart", "💗": "Heart", "💖": "Heart",
};
test("every plane-shape's objects really have that shape (and are disjoint)", () => {
  const seen = new Map();
  for (const shape of content.PLANE_SHAPES) {
    assert.ok(shape.objects.length >= 2, `${shape.name} needs >= 2 objects`);
    assert.ok(/^<.*>$/s.test(shape.svg.trim()), `${shape.name} needs an SVG body`);
    for (const o of shape.objects) {
      assert.equal(PLANE_TRUTH[o], shape.name, `${o} should be shaped like a ${shape.name}`);
      assert.ok(!seen.has(o), `${o} is used by two shapes`);
      seen.set(o, shape.name);
    }
  }
});

// Self-healing guardrail (RULE 7): the same emoji must NEVER be taught as both a
// 2D plane shape AND a 3D solid — that contradicts itself for a 4-year-old (a ⚽
// can't be both "a circle" and "a ball"). The two truth tables passed on their
// own and never cross-checked, so a soccer ball slipped into Circle; lock it out.
test("no object is classified as BOTH a plane shape (2D) and a solid (3D)", () => {
  const plane = new Set(content.PLANE_SHAPES.flatMap((s) => s.objects));
  const overlap = content.SOLID_SETS.flatMap((s) => s.objects).filter((o) => plane.has(o));
  assert.deepEqual(overlap, [], `these emoji are taught as both a flat shape and a 3D solid: ${overlap.join(" ")}`);
});

// ---------- 3-bin color sort matches the verified 2-bin color truth ----------
test("the harder 3-bin color set is truthful (red/blue/yellow)", () => {
  const truth = { Red: ["🍎", "🍓", "🍅", "🌹", "❤️"], Blue: ["🫐", "💙", "🌀", "💧", "🐳"], Yellow: ["🍌", "🌟", "🌻", "🧀", "🐤"] };
  const set = content.COLOR_SETS_3[0];
  assert.equal(set.bins.length, 3, "3-bin set has three colors");
  for (const bin of set.bins) {
    assert.deepEqual([...bin.items].sort(), [...truth[bin.label]].sort(), `color bin "${bin.label}" must match the verified truth`);
  }
});

// ---------- Names are first-name-only (privacy) and letters match ----------
test("names are first-name-only, uppercase A-Z, letters match the name", () => {
  assert.ok(content.NAMES.some((n) => n.name === "Josh"), "Josh's name is present");
  for (const n of content.NAMES) {
    assert.ok(!/\s/.test(n.name), `${n.name} must be a single first name (privacy)`);
    assert.match(n.letters, /^[A-Z]+$/, `${n.name} letters must be uppercase A-Z`);
    assert.equal(n.letters, n.name.toUpperCase(), `${n.name} letters must spell the name`);
  }
});

test("picture-square trios are exactly 3 distinct, self-naming pictures", () => {
  assert.ok(content.SQUARE_TRIOS.length >= 3, "need several trios to rotate");
  for (const trio of content.SQUARE_TRIOS) {
    assert.equal(trio.length, 3, `trio ${trio} must have 3 symbols`);
    assert.equal(new Set(trio).size, 3, `trio ${trio} must be all distinct`);
  }
});

test("picture-square quads (the 4×4 tier) are exactly 4 distinct pictures", () => {
  assert.ok(Array.isArray(content.SQUARE_QUADS) && content.SQUARE_QUADS.length >= 3, "need several quads");
  for (const quad of content.SQUARE_QUADS) {
    assert.equal(quad.length, 4, `quad ${quad} must have 4 symbols`);
    assert.equal(new Set(quad).size, 4, `quad ${quad} must be all distinct`);
  }
});

test("color-by-number pictures are valid (equal-width rows; known colors; <=3 wide; reveal+name)", () => {
  const keys = new Set(Object.keys(content.CBN_COLORS));
  assert.ok(keys.has("0"), "'0' must be a known color (the silhouette background)");
  for (const pic of content.CBN_PICTURES) {
    assert.ok(pic.rows.length >= 2, `${pic.name} needs rows`);
    assert.ok(pic.name && pic.reveal, `${pic.name || "a picture"} must carry a name + reveal emoji (the payoff)`);
    const w = pic.rows[0].length;
    assert.ok(w <= 3, `${pic.name} must be <= 3 wide so cells stay >= 75px at 320px`);
    // At least one non-background cell, or there's nothing to colour.
    assert.ok(pic.rows.join("").split("").some((c) => c !== "0"), `${pic.name} must have colourable cells`);
    for (const row of pic.rows) {
      assert.equal(row.length, w, `${pic.name} rows must be equal width`);
      for (const ch of row) assert.ok(keys.has(ch), `${pic.name} uses undefined color number "${ch}"`);
    }
  }
});

test("odd-one-out FEATURE sets: base and odd differ (a real one-feature distinction)", () => {
  assert.ok(Array.isArray(content.ODD_FEATURES) && content.ODD_FEATURES.length >= 4, "need several feature sets");
  for (const s of content.ODD_FEATURES) {
    assert.ok(s.base && s.odd, `feature set "${s.name}" needs base + odd`);
    assert.notEqual(s.base, s.odd, `feature set "${s.name}" base and odd must differ`);
  }
});

test("rescue pups have distinct collar colours (so counting one kind is unambiguous)", () => {
  const pups = content.PUPS || [];
  assert.ok(pups.length >= 3, "need several pups");
  for (const p of pups) assert.match(p.collar || "", /^#[0-9a-f]{6}$/i, `${p.name} needs a collar colour`);
  const collars = pups.map((p) => p.collar);
  assert.equal(new Set(collars).size, collars.length, "every pup's collar colour is distinct");
});

test("each friend has a portrait spec and the four are clearly differentiable", () => {
  const friends = content.FRIENDS || [];
  assert.ok(friends.length >= 4, "need Josh + friends");
  const styles = ["fringe", "wavy", "bowl", "curly", "short"];
  for (const f of friends) {
    assert.ok(f.art, `${f.name} needs an art spec`);
    for (const k of ["skin", "hair", "shirt", "style"]) assert.ok(f.art[k], `${f.name} art needs ${k}`);
    assert.ok(styles.includes(f.art.style), `${f.name} uses a known hair style`);
  }
  // "clearly differentiable": no two friends share the same shirt colour, and the
  // skin/hair/style combo is unique per friend (so Josh, Raegar, River, Viraj all
  // look like different kids).
  const shirts = friends.map((f) => f.art.shirt);
  assert.equal(new Set(shirts).size, shirts.length, "every friend has a distinct shirt colour");
  const combos = friends.map((f) => [f.art.skin, f.art.hair, f.art.style].join("|"));
  assert.equal(new Set(combos).size, combos.length, "every friend has a distinct skin+hair+style");
});

test("the narrated sorters carry a truthful 'why' on every bin", () => {
  // B#1: a correct-by-guess tap still teaches, so the flagged sorters must speak.
  const narrated = [...content.SORT_SETS, ...content.DAY_NIGHT_SETS, ...content.HOT_COLD_SETS];
  for (const set of narrated) {
    for (const bin of set.bins) {
      assert.ok(typeof bin.why === "string" && bin.why.length > 0,
        `sorter "${set.name}" bin "${bin.label}" needs a spoken why`);
    }
  }
});

test("science-sort's multi-domain rounds each name their own question", () => {
  // The "Alive or Not?" tile rotates 3 different domains; each set must carry its
  // OWN prompt + icons so a sound-off child knows which sort this round is.
  for (const set of content.SORT_SETS) {
    assert.ok(typeof set.prompt === "string" && set.prompt.length > 0,
      `SORT_SETS "${set.name}" needs its own prompt (it shares the science-sort tile)`);
    assert.ok(Array.isArray(set.icons) && set.icons.length >= 2,
      `SORT_SETS "${set.name}" needs an icon strip`);
  }
});

// ---------- 🎨 Mix It!: real color theory, restated ----------
test("color mixes match real color theory (and every choice color is real)", () => {
  const TRUTH = { "red+yellow": "orange", "yellow+blue": "green", "blue+red": "purple", "red+white": "pink" };
  assert.ok(content.MIXES.length >= 4, "need several mixes");
  for (const m of content.MIXES) {
    const key = m.a.name + "+" + m.b.name;
    assert.equal(m.out.name, TRUTH[key], `${key} must make ${TRUTH[key]}, not ${m.out.name}`);
    for (const c of [m.a, m.b, m.out]) {
      assert.match(c.hex, /^#[0-9a-f]{6}$/i, `${c.name} needs a real hex color`);
      assert.ok(c.name && c.name.length > 2, "every paint needs a spoken name");
    }
  }
  assert.equal(new Set(content.MIXES.map((m) => m.out.name)).size, content.MIXES.length,
    "each mix makes a DIFFERENT color (so answer choices can't collide)");
});

// ---------- 🛁 Sink or Float: shared truth set is wired to the tile ----------
test("sink/float: the dedicated game shares ONE truth set with Alive-or-Not's rotation", () => {
  assert.ok(content.SINK_FLOAT_SET, "SINK_FLOAT_SET must be exported for the tub game");
  assert.ok(content.SORT_SETS.includes(content.SINK_FLOAT_SET), "the SAME object must live in SORT_SETS (one truth, never forked)");
  // Restate the physical truth.
  const sinks = content.SINK_FLOAT_SET.bins.find((b) => b.label === "Sinks").items;
  const floats = content.SINK_FLOAT_SET.bins.find((b) => b.label === "Floats").items;
  for (const heavy of ["🪨", "🔑", "⚓", "🪙"]) assert.ok(sinks.includes(heavy), `${heavy} sinks`);
  for (const light of ["🦆", "🎈", "🪵", "🍎"]) assert.ok(floats.includes(light), `${light} floats (yes — apples float!)`);
});

test("plant/animal: the dedicated sorter shares ONE truth set with Alive-or-Not's rotation", () => {
  assert.ok(Array.isArray(content.PLANT_ANIMAL_SETS) && content.PLANT_ANIMAL_SETS.length === 1);
  assert.ok(content.SORT_SETS.includes(content.PLANT_ANIMAL_SETS[0]), "same object, one truth");
});

// ---------- 🐣 Mama & Baby: real pairs, restated ----------
test("mama & baby pairs are true (and every glyph is distinct)", () => {
  const TRUTH = { Chick: "Hen", Puppy: "Dog", Kitten: "Cat", Caterpillar: "Butterfly" };
  assert.ok(content.MAMA_BABY.length >= 4, "need several pairs");
  const glyphs = [];
  for (const p of content.MAMA_BABY) {
    assert.equal(p.mamaName, TRUTH[p.babyName], `${p.babyName}'s mama must be ${TRUTH[p.babyName]}`);
    assert.notEqual(p.baby, p.mama, `${p.babyName}: baby and mama need different pictures`);
    glyphs.push(p.baby, p.mama);
  }
  assert.equal(new Set(glyphs).size, glyphs.length, "no glyph may appear in two pairs (choices would collide)");
});

// ---------- 🔎 Letter Hunt: the letter pool is visually honest ----------
test("letter-hunt pool: uppercase A-Z only, unique, no I/O lookalike traps", () => {
  assert.ok(content.HUNT_LETTERS.length >= 10, "need a rich letter pool");
  assert.equal(new Set(content.HUNT_LETTERS).size, content.HUNT_LETTERS.length, "letters unique");
  for (const ch of content.HUNT_LETTERS) assert.match(ch, /^[A-Z]$/, `bad letter ${ch}`);
  for (const trap of ["I", "O", "Q"]) assert.ok(!content.HUNT_LETTERS.includes(trap), `${trap} is a lookalike trap (l/0) — keep it out`);
});

// ---------- 😊 Feelings: every story maps to a real feeling, sensibly ----------
test("feeling stories: truthful story→feeling mapping, spoken + pictured", () => {
  const TRUTH = {
    "Raegar's block tower fell down.": "sad",
    "River got a puppy for his birthday!": "happy",
    "Viraj's balloon popped. POP!": "surprised",
    "Someone took Josh's truck without asking.": "mad",
    "Raegar is going to the playground today!": "happy",
    "River dropped his ice cream on the ground.": "sad",
    "Josh found a surprise present on his chair!": "surprised",
  };
  const ids = new Set(content.FEELINGS.map((f) => f.id));
  assert.ok(ids.size >= 4, "need at least 4 distinct feelings");
  assert.equal(new Set(content.FEELINGS.map((f) => f.face)).size, content.FEELINGS.length, "feeling faces distinct");
  for (const s of content.FEELING_STORIES) {
    assert.equal(s.feel, TRUTH[s.say], `"${s.say}" should feel ${TRUTH[s.say]}`);
    assert.ok(ids.has(s.feel), `unknown feeling "${s.feel}"`);
    assert.ok(s.icons && s.icons.length >= 2, "every story needs picture support (non-reader law)");
    assert.ok(s.who && s.who.length, "every story names a friend");
  }
  // Every feeling is reachable (no dead choice face).
  const used = new Set(content.FEELING_STORIES.map((s) => s.feel));
  for (const id of ids) assert.ok(used.has(id), `feeling "${id}" is never the answer — add a story or drop the face`);
});

// ---------- 🤝 Kindness: exactly one kind option, others silly-neutral ----------
test("kindness scenarios: exactly ONE kind option; the rest never mean", () => {
  const MEAN = ["👊", "😡", "🤬", "💢", "😤"];
  assert.ok(content.KINDNESS.length >= 4, "need several scenarios");
  for (const sc of content.KINDNESS) {
    const kind = sc.options.filter((o) => o.kind);
    assert.equal(kind.length, 1, `"${sc.say}" needs exactly one kind option`);
    assert.equal(sc.options.length, 3, "three options each");
    assert.ok(sc.icons && sc.icons.length >= 2, "picture support required");
    for (const o of sc.options) {
      assert.ok(!MEAN.includes(o.emoji), `option ${o.emoji} reads mean — un-kind options must be silly-neutral`);
      assert.ok(o.name && o.name.length > 2, "every option has a spoken name");
    }
  }
});

// ---------- 📅 Days: the real week, in order, with distinct rainbow colors ----------
test("day train: the 7 real days in calendar order, distinct colors", () => {
  const REAL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  assert.deepEqual(content.DAYS.map((d) => d.name), REAL, "days must be the real week, in order");
  assert.equal(new Set(content.DAYS.map((d) => d.color)).size, 7, "each day needs its own color (sound-off solvability)");
  for (const d of content.DAYS) assert.ok(d.abbr && d.abbr.length === 3, `${d.name} needs a 3-letter abbr`);
});

// ---------- 🌦️ Weather: truthful gear, one per weather ----------
test("dress-me weather: the gear truly matches the weather", () => {
  const TRUTH = { raining: "☂️", sunny: "🧢", snowing: "🧤" };
  assert.ok(content.WEATHERS.length >= 3);
  for (const w of content.WEATHERS) {
    assert.equal(w.gear, TRUTH[w.name], `${w.name} gear should be ${TRUTH[w.name]}`);
    assert.ok(["hat", "hand", "over"].includes(w.spot), `${w.name} needs a valid wear spot`);
    assert.ok(w.say && w.sky, "every weather is spoken and pictured");
  }
  assert.equal(new Set(content.WEATHERS.map((w) => w.gear)).size, content.WEATHERS.length, "gear distinct (choices can't collide)");
});

// ---------- 🌈 Seasons: truthful membership, items unique across seasons ----------
test("season items are truthful and belong to exactly one season", () => {
  const TRUTH = { "⛄": "Winter", "🧣": "Winter", "🌷": "Spring", "🐣": "Spring", "🍉": "Summer", "🍦": "Summer", "🎃": "Fall", "🍁": "Fall" };
  assert.equal(content.SEASONS.length, 4, "four seasons");
  const seen = new Map();
  for (const s of content.SEASONS) {
    assert.ok(s.icon && s.tint, `${s.name} needs an icon + window tint`);
    for (const item of s.items) {
      assert.equal(TRUTH[item], s.name, `${item} belongs in ${TRUTH[item]}, not ${s.name}`);
      assert.ok(!seen.has(item), `${item} appears in two seasons`);
      seen.set(item, s.name);
    }
  }
});

// ================= Road to 140 — Wave 1 truth tables =================
test("W1 opposites: real opposite pairs; each concept in exactly one pair", () => {
  const P = content.OPPOSITE_PAIRS;
  assert.ok(P.length >= 6);
  const words = [], emojis = [];
  for (const p of P) {
    assert.ok(p.a && p.b && p.ae && p.be, "each pair needs word+emoji on both sides");
    assert.notEqual(p.a, p.b);
    words.push(p.a, p.b); emojis.push(p.ae, p.be);
  }
  assert.equal(new Set(words).size, words.length, "every concept appears once (so no distractor is also a valid opposite)");
  assert.equal(new Set(emojis).size, emojis.length, "every emoji distinct (a distractor never equals the prompt emoji)");
});

test("W1 tracks: each track type & each animal is unique (unambiguous inference)", () => {
  const T = content.TRACKS;
  assert.ok(T.length >= 4);
  assert.equal(new Set(T.map((t) => t.track)).size, T.length, "track types unique — the drawn track identifies ONE animal");
  assert.equal(new Set(T.map((t) => t.animal)).size, T.length, "animals unique");
  // A duck IS a bird: never offer a generic 🐦 alongside 🦆 (its track would be a
  // defensibly-correct distractor — the eagle/deer lesson, applied to tracks).
  const animals = T.map((t) => t.animal);
  assert.ok(!(animals.includes("🐦") && animals.includes("🦆")),
    "a duck IS a bird — the generic bird and the duck can never both be track answers");
});

test("W1 animal sounds: sounds unique, animals unique", () => {
  const S = content.ANIMAL_SOUNDS;
  assert.ok(S.length >= 5);
  assert.equal(new Set(S.map((s) => s.sound)).size, S.length, "sounds unique");
  assert.equal(new Set(S.map((s) => s.animal)).size, S.length, "animals unique");
  for (const s of S) assert.ok(/^[A-Z]+$/.test(s.sound), `${s.sound} should be an all-caps decodable sound word`);
});

test("W1 night/day + fast/slow sorters: single-bin items + spoken whys", () => {
  for (const setArr of [content.NIGHT_DAY_SETS, content.FAST_SLOW_SETS]) {
    for (const set of setArr) {
      const all = [];
      for (const bin of set.bins) {
        assert.ok(bin.why && bin.why.length > 0, `${set.name} ${bin.label} needs a spoken why`);
        assert.ok(bin.items.length >= 2);
        all.push(...bin.items);
      }
      assert.equal(new Set(all).size, all.length, `${set.name}: an item must sit in exactly ONE bin`);
    }
  }
});

// ================= Road to 140 — Wave 2 truth tables =================
test("W2 weight pairs: heavy != light; no emoji reused across pairs", () => {
  const P = content.WEIGHT_PAIRS;
  const seen = new Set();
  for (const p of P) {
    assert.notEqual(p.heavy, p.light);
    for (const e of [p.heavy, p.light]) { assert.ok(!seen.has(e), e + " reused"); seen.add(e); }
  }
});
test("W2 side shapes: side counts are the real geometric truth", () => {
  const TRUTH = { triangle: 3, square: 4, rectangle: 4, pentagon: 5, hexagon: 6, circle: 0 };
  for (const s of content.SIDE_SHAPES) {
    assert.equal(s.sides, TRUTH[s.name], s.name + " must have " + TRUTH[s.name] + " sides");
    assert.ok(/^<(polygon|rect|circle)/.test(s.svg.trim()), s.name + " needs an svg body");
  }
});
test("W2 end sounds: word truly ends with letter; all final letters unique", () => {
  const W = content.END_WORDS;
  for (const w of W) assert.equal(w.letter, w.word[w.word.length - 1].toUpperCase(), w.word + " ends with " + w.letter);
  assert.equal(new Set(W.map((w) => w.letter)).size, W.length, "final letters unique (a distractor can never also be right)");
});
test("W2 vowel words: keyed vowel is the middle letter of a CVC word", () => {
  const CVC = /^[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvwxyz]$/;
  for (const w of content.VOWEL_WORDS) {
    assert.match(w.word, CVC, w.word + " must be CVC");
    assert.equal(w.word[1], w.vowel, w.word + " middle vowel is " + w.vowel);
  }
});
test("W2 word families: every word ends with its rime; no word in two families", () => {
  const seen = new Set();
  for (const set of content.WORD_FAMILIES) {
    assert.equal(set.bins.length, 2, "two houses per round");
    for (const bin of set.bins) {
      const rime = bin.label.replace("-", "");
      for (const it of bin.words) {
        assert.ok(it.word.endsWith(rime), it.word + " must end with " + rime);
        assert.ok(!seen.has(it.word), it.word + " appears in two families");
        seen.add(it.word);
      }
    }
  }
});
test("W2 letter-pair pool excludes the i/l confusable and is roomy", () => {
  const P = content.LETTER_PAIR_POOL;
  assert.ok(P.length >= 6);
  assert.ok(!P.includes("I") && !P.includes("L"), "I and L are the iOS confusable pair — excluded");
  assert.equal(new Set(P).size, P.length, "unique");
});

// ================= Road to 140 — Wave 3 truth tables =================
test("W3 silly scenes: animals & items unique, and the two sets are disjoint", () => {
  const S = content.SILLY_SCENES;
  const animals = S.map((s) => s.animal), items = S.map((s) => s.item);
  assert.equal(new Set(animals).size, animals.length, "animals unique");
  assert.equal(new Set(items).size, items.length, "items unique");
  for (const a of animals) assert.ok(!items.includes(a), a + " is both an animal and an item");
  for (const s of S) assert.ok(s.say && s.say.length > 0, "each scene needs a spoken line");
});
test("W3 sentences: 2..5 words, non-empty, with a scene emoji", () => {
  for (const s of content.BUILD_SENTENCES) {
    assert.ok(s.words.length >= 2 && s.words.length <= 5, "sentence length 2..5");
    for (const w of s.words) assert.ok(w && w.length > 0);
    assert.ok(s.emoji && s.emoji.length > 0);
  }
});
test("W3 asymmetric shapes: exactly the curated four filled polygons", () => {
  const names = content.SHAPES_ASYM.map((s) => s.name);
  assert.deepEqual([...names].sort(), ["arrow", "bolt", "boot", "flag"], "curated asymmetric set only (no symmetric shapes)");
  for (const s of content.SHAPES_ASYM) assert.ok(/^<polygon/.test(s.svg.trim()), s.name + " must be a filled polygon");
});
test("W3 clue cards: 6 UNIQUE kind×color combos", () => {
  const combos = content.CLUE_CARDS.map((c) => c.kind + ":" + c.color);
  assert.equal(content.CLUE_CARDS.length, 6);
  assert.equal(new Set(combos).size, 6, "each kind×color combo appears once (a 2-clue pair narrows to one)");
  assert.equal(new Set(content.CLUE_CARDS.map((c) => c.emoji)).size, 6, "emojis unique");
});
test("W3 block layouts: every layout is single-height (no repeated cell)", () => {
  for (const layout of content.BLOCK_LAYOUTS) {
    const keys = layout.map((c) => c[0] + "," + c[1]);
    assert.equal(new Set(keys).size, keys.length, "no two cubes share a cell (single height, tops visible)");
    assert.ok(layout.length >= 3);
  }
});

// ================= Road to 140 — Wave 4 truth tables =================
test("W4 who-eats: each food's answer is in its eaters; foods & answers unique", () => {
  const F = content.FOOD_EATERS;
  const foods = F.map((f) => f.food);
  assert.equal(new Set(foods).size, foods.length, "foods unique");
  for (const f of F) {
    assert.ok(Array.isArray(f.eaters) && f.eaters.length >= 1, f.say + " needs eaters");
    assert.ok(f.eaters.includes(f.answer), f.say + "'s answer must be one of its eaters");
    assert.ok(f.say && f.say.length > 0, "each food needs a spoken name");
  }
  // No animal's diet crosses foods in a way that would make a distractor also-correct:
  // every (food, other-food.answer) pair must NOT be an eater of that food.
  for (const a of F) for (const b of F) {
    if (a === b) continue;
    assert.ok(!a.eaters.includes(b.answer), b.answer + " must not be a valid eater of " + a.say);
  }
});
test("W4 body-parts: 5 zones fit the box and every pair is >= minGap apart at 320px", () => {
  const parts = content.BODY_PARTS, box = content.BODY_FIGURE_BOX;
  assert.equal(parts.length, 5);
  assert.equal(new Set(parts.map((p) => p.key)).size, 5, "part keys unique");
  const r = box.dot / 2;
  const centers = parts.map((p) => ({ x: (p.x / 100) * box.w, y: (p.y / 100) * box.h, label: p.label }));
  // each zone stays inside the figure box
  for (const c of centers) {
    assert.ok(c.x - r >= -0.01 && c.x + r <= box.w + 0.01, c.label + " x within box");
    assert.ok(c.y - r >= -0.01 && c.y + r <= box.h + 0.01, c.label + " y within box");
  }
  // no two zones overlap, and axis-adjacent zones keep >= minGap (mirrors mobile audit)
  for (let i = 0; i < centers.length; i++) for (let j = i + 1; j < centers.length; j++) {
    const a = centers[i], c = centers[j];
    const dx = Math.abs(a.x - c.x), dy = Math.abs(a.y - c.y);
    const overlapX = dx < box.dot, overlapY = dy < box.dot;
    assert.ok(!(overlapX && overlapY), a.label + " overlaps " + c.label);
    if (overlapX) assert.ok(dy - box.dot >= box.minGap, a.label + "/" + c.label + " vertical gap < minGap");
    if (overlapY) assert.ok(dx - box.dot >= box.minGap, a.label + "/" + c.label + " horizontal gap < minGap");
  }
});
test("W4 greetings: each friend exists in FRIENDS and has a greeting word", () => {
  const names = content.FRIENDS.map((f) => f.name);
  for (const g of content.GREETINGS) {
    assert.ok(names.includes(g.name), g.name + " must be a real friend");
    assert.ok(g.word && g.word.length > 0, g.name + " needs a greeting word");
    assert.ok(g.say && g.say.length > 0, g.name + " needs a spoken form");
  }
  // Every friend gets exactly one greeting.
  assert.equal(new Set(content.GREETINGS.map((g) => g.name)).size, content.GREETINGS.length, "one greeting per friend");
});
test("W4 house steps: 6 ordered pieces, each with an emoji + spoken line", () => {
  assert.equal(content.HOUSE_STEPS.length, 6);
  for (const s of content.HOUSE_STEPS) {
    assert.ok(s.emoji && s.emoji.length > 0);
    assert.ok(s.say && s.say.length > 0);
  }
});
test("W4 grandma items: 3 targets, >=6 toys, and the two sets are disjoint", () => {
  const g = content.GRANDMA_ITEMS;
  assert.equal(g.targets.length, 3, "exactly 3 things to find");
  assert.ok(g.toys.length >= 6, "at least 6 toy distractors for a 9-cell grid");
  const targetEmoji = g.targets.map((t) => t.emoji);
  for (const t of g.targets) assert.ok(t.say && t.say.length > 0, "each target needs a spoken name");
  for (const toy of g.toys) assert.ok(!targetEmoji.includes(toy), toy + " is both a target and a toy");
  assert.equal(new Set(targetEmoji).size, 3, "target emojis unique");
});
