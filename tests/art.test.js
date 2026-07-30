// Unit tests for scripts/art.js — the original homage SVG art. Ensures every
// character returns a well-formed <svg> string (so it renders, not breaks).

const test = require("node:test");
const assert = require("node:assert");
const ART = require("../scripts/art.js");

test("every character returns a well-formed 100x100 svg string", () => {
  const samples = {
    hero: ART.hero("#e23636"),
    numberFriend: ART.numberFriend(5, "#5ec8ff"),
    pup: ART.pup("#2b6cff"),
    truck: ART.truck(),
    star: ART.star(),
    rocket: ART.rocket(),
    balloon: ART.balloon(),
    home: ART.home(),
    kid: ART.kid("#e8b98c", "#7be08a"),
    friend: ART.friend({ skin: "#f1c9a5", hair: "#1a1a20", style: "fringe", shirt: "#e23636" }),
  };
  for (const [name, s] of Object.entries(samples)) {
    assert.ok(typeof s === "string" && s.startsWith("<svg") && s.endsWith("</svg>"), `${name} should be an svg string`);
    assert.ok(s.includes('viewBox="0 0 100 100"'), `${name} uses the 100x100 viewBox`);
    // roughly balanced angle brackets (no truncated tags)
    const open = (s.match(/</g) || []).length;
    const close = (s.match(/>/g) || []).length;
    assert.equal(open, close, `${name} has balanced tag brackets`);
  }
});

test("numberFriend draws exactly n cubes for n = 1..10 (and clamps out of range)", () => {
  for (let n = 1; n <= 10; n++) {
    const cubes = (ART.numberFriend(n, "#5ec8ff").match(/<rect /g) || []).length;
    assert.equal(cubes, n, `n=${n} should draw n cubes`);
  }
  assert.equal((ART.numberFriend(0).match(/<rect /g) || []).length, 1, "clamps to >= 1");
  assert.equal((ART.numberFriend(99).match(/<rect /g) || []).length, 10, "clamps to <= 10");
});

test("numberFriend is COUNTABLE: square cubes, a face on its own cube, and bigger n = more ink", () => {
  // It is the countable in build-number, add-up and number-match, the whole of
  // the Grow! toy, three buddy tiles and a Sticker Book kind. The old drawing
  // pinned the cube WIDTH at 44 and split a fixed 76-unit height between the
  // cubes, so all three of these properties were false and nothing could fail:
  // cubes ran 2.75:1 at n=1 and 7.86:1 at n=10 (stripes, not blocks); the face
  // was placed by a fixed 4-unit offset so at n=10 the mouth landed in the GAP
  // between cube 1 and cube 2; and ink PEAKED at n=5 (29.0%) and fell to 24.6%
  // at n=10, so in add-up — a game whose beat is two friends merging into their
  // sum — 4 + 5 = 9 drew a sum smaller than either addend.
  const boxOf = (svg) => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const put = (x, y, p) => { p = p || 0; x0 = Math.min(x0, x - p); x1 = Math.max(x1, x + p); y0 = Math.min(y0, y - p); y1 = Math.max(y1, y + p); };
    for (const m of svg.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*stroke-width="([\d.]+)"/g)) {
      const [x, y, w, h, sw] = m.slice(1).map(Number); put(x, y, sw / 2); put(x + w, y + h, sw / 2);
    }
    for (const m of svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"(?:[^>]*stroke-width="([\d.]+)")?/g)) {
      const [cx, cy, r, sw] = m.slice(1).map((v) => Number(v || 0)); put(cx, cy, r + sw / 2);
    }
    for (const m of svg.matchAll(/<ellipse cx="([-\d.]+)" cy="([-\d.]+)" rx="([\d.]+)" ry="([\d.]+)"/g)) {
      const [cx, cy, rx, ry] = m.slice(1).map(Number); put(cx - rx, cy - ry); put(cx + rx, cy + ry);
    }
    for (const m of svg.matchAll(/<path d="([^"]+)"[^>]*stroke-width="([\d.]+)"/g)) {
      const sw = Number(m[2]); const nums = (m[1].match(/-?[\d.]+/g) || []).map(Number);
      for (let i = 0; i + 1 < nums.length; i += 2) put(nums[i], nums[i + 1], sw / 2);
    }
    return { x0, x1, y0, y1 };
  };
  let prevInk = -1;
  for (let n = 1; n <= 10; n++) {
    const svg = ART.numberFriend(n, "#5ec8ff");
    const cubes = [...svg.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map((m) => m.slice(1).map(Number));
    assert.equal(cubes.length, n, `n=${n} draws n cubes`);
    // 1. A cube is a CUBE. A stack of stripes is not countable as blocks.
    cubes.forEach(([, , w, h]) => assert.ok(Math.abs(w / h - 1) < 0.02, `n=${n}: a cube must be square (got ${w.toFixed(1)}x${h.toFixed(1)} = ${(w / h).toFixed(2)}:1)`));
    // 2. Bigger number, bigger friend — monotonic ink, so a sum can never draw
    //    smaller than one of its addends.
    const ink = cubes.reduce((a, r) => a + r[2] * r[3], 0);
    assert.ok(ink > prevInk, `n=${n} must draw MORE ink than n=${n - 1} (${(ink / 100).toFixed(1)}% vs ${(prevInk / 100).toFixed(1)}%) — add-up merges two friends into their sum`);
    prevInk = ink;
    // 3. The face lives INSIDE one cube — never in a seam, never spanning two.
    const face = svg.slice(svg.indexOf('<circle cx='));
    const fb = boxOf(face);
    const holds = cubes.some((c) => fb.x0 >= c[0] - 0.6 && fb.x1 <= c[0] + c[2] + 0.6 && fb.y0 >= c[1] - 0.6 && fb.y1 <= c[1] + c[3] + 0.6);
    assert.ok(holds, `n=${n}: the eyes and mouth must fit inside ONE cube (face box x[${fb.x0.toFixed(1)},${fb.x1.toFixed(1)}] y[${fb.y0.toFixed(1)},${fb.y1.toFixed(1)}])`);
    // 4. Nothing — arms, feet, seams — escapes the viewBox.
    const b = boxOf(svg);
    assert.ok(b.x0 >= 0 && b.x1 <= 100 && b.y0 >= 0 && b.y1 <= 100,
      `n=${n}: every part stays in the 100x100 box (got x[${b.x0.toFixed(1)},${b.x1.toFixed(1)}] y[${b.y0.toFixed(1)},${b.y1.toFixed(1)}])`);
  }
});

test("hero() draws a FIGURE, not a blob — it fills its box and stays a colour search", () => {
  // The default buddy for any child who never opens the picker: buddy.js builds
  // its roster HEROES-first and falls back to ROSTER[0], so this drawing is the
  // home companion AND the celebration pop on all 200 wins. It shipped as four
  // shapes — a body ellipse and a head circle in the same colour and tangent,
  // fusing into a figure-8, with no arms, legs or hands — and screenshotted at
  // 120px it read as a red peanut with eyes. Nothing could fail, because "is a
  // valid balanced svg" was the whole bar.
  const s = ART.hero("#e23636");
  const els = (s.match(/<(?:path|circle|ellipse|rect|line|polygon)\b/g) || []).length;
  assert.ok(els >= 12, `the hero needs a real figure — legs, boots, torso, arms, hands, emblem, head, webbing, eyes (got ${els} elements; the old blob had 6)`);
  // Ink extent: every numeric coordinate in the markup, so a drawing that
  // huddles in the middle of its viewBox fails.
  const nums = (s.match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter((n) => n >= 0 && n <= 100);
  assert.ok(nums.length > 40, "the coordinates are readable");
  assert.ok(Math.max(...nums) - Math.min(...nums) >= 80, "the figure spans its 100x100 box rather than sitting as a blob in the middle");
  // It must stay a PURE function of colour, and most of the ink must BE that
  // colour — find-hero is a colour search, so a hard-coded suit silently breaks it.
  const a = ART.hero("#e23636"), b = ART.hero("#2b6cff");
  assert.notEqual(a, b, "the suit colour is a parameter, not a constant");
  assert.equal(a, ART.hero("#e23636"), "hero() is pure — the e2e buddy test compares innerHTML byte-for-byte");
  assert.ok(a.split("#e23636").length - 1 >= 4, "most of the ink is the parameter colour, so find-hero stays a colour search");
  assert.ok(b.indexOf("#e23636") < 0, "no leftover hard-coded red when another colour is asked for");
});

test("shade() is a pure, clamped hex transform (the ONE place a second tone comes from)", () => {
  assert.equal(ART.shade("#808080", 0), "#808080");
  assert.equal(ART.shade("#000000", 1), "#ffffff");
  assert.equal(ART.shade("#ffffff", -1), "#000000");
  // darker is darker, lighter is lighter, on every channel
  const dk = ART.shade("#e23636", -0.34), lt = ART.shade("#e23636", 0.2);
  const chan = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  chan(dk).forEach((c, i) => assert.ok(c <= chan("#e23636")[i], "darker on every channel"));
  chan(lt).forEach((c, i) => assert.ok(c >= chan("#e23636")[i], "lighter on every channel"));
  assert.equal(ART.shade("not-a-hex", -0.3), "not-a-hex", "a non-hex passes through rather than throwing mid-draw");
});

test("the Sticker Book gives every one of Josh's 200 games its OWN sticker", () => {
  // It shipped with 73 unique pictures across 200 slots: 160 of 200 games shared
  // a sticker with another, the largest group was 25 games holding a BYTE-
  // IDENTICAL rocket (the one art kind that discarded its colour argument), and
  // the key had only two axes — kind x colour = 8 x 12 = 96 combinations to cover
  // 200 games. A collection where a quarter of the prizes are the same picture is
  // not a collection. Each sticker is now a picture ON a shaped badge, keyed on
  // two independently-seeded hashes; slicing ONE hash into bit-fields correlates
  // the axes through the modulo and left exactly the 5 pairs the birthday bound
  // predicts, which is how the second stream was found.
  const path = require("path");
  const fs = require("fs");
  const ROOT = path.join(__dirname, "..");
  global.window = global.window || global;
  require(path.join(ROOT, "scripts/art.js"));
  require(path.join(ROOT, "scripts/stickers.js"));
  const S = (global.window || global).JoshStickers;
  const main = fs.readFileSync(path.join(ROOT, "scripts/main.js"), "utf8");
  const block = main.match(/CATEGORY_OF\s*=\s*\{[\s\S]*?\n {2}\};/);
  assert.ok(block, "found the CATEGORY_OF map that lists every one of Josh's games");
  const ids = [...block[0].matchAll(/"([a-z0-9-]+)":/g)].map((m) => m[1]);
  assert.equal(ids.length, 200, "Josh has 200 games");
  const seen = new Map();
  for (const id of ids) {
    const svg = S.artFor({ id });
    assert.ok(svg.startsWith('<svg viewBox="0 0 100 100"') && svg.endsWith("</svg>"), `${id}'s sticker is a valid 100x100 svg`);
    assert.equal((svg.match(/</g) || []).length, (svg.match(/>/g) || []).length, `${id}'s sticker has balanced tags`);
    assert.equal(svg, S.artFor({ id }), `${id}'s sticker is deterministic — the same game always shows the same prize`);
    // An SVG fragment id resolves DOCUMENT-WIDE, and the Sticker Book paints all
    // 200 of these into one page — so a `<defs><radialGradient id="bg">` per badge
    // means every `url(#bg)` resolves to the FIRST one and 200 varied badge
    // colours collapse into a single gradient. The uniqueness check below cannot
    // see it (the strings all differ); only this can.
    assert.ok(svg.indexOf("id=") < 0,
      `${id}'s sticker declares an id — 200 stickers share one document, so a duplicate id silently repoints every other sticker's fill at the first one`);
    assert.ok(svg.indexOf("url(#") < 0, `${id}'s sticker references a fragment id, which collides across the 200-slot book`);
    const dup = seen.get(svg);
    assert.ok(!dup, `${id} and ${dup} draw the IDENTICAL sticker — every game needs its own prize`);
    seen.set(svg, id);
  }
  assert.equal(seen.size, 200, "200 games, 200 distinct stickers");
});

test("pup() draws a different DOG per spec, not one dog with a different collar", () => {
  const base = "#2b6cff";
  const floppy = ART.pup(base, { coat: "#d8a86b", ears: "floppy" });
  const pointy = ART.pup(base, { coat: "#d8a86b", ears: "pointy" });
  const round = ART.pup(base, { coat: "#d8a86b", ears: "round" });
  assert.notEqual(floppy, pointy, "ear shape changes the silhouette");
  assert.notEqual(pointy, round, "…all three of them");
  assert.notEqual(floppy, round, "…pairwise");
  // The coat must actually paint the body, and patches/cap must be additive.
  assert.ok(ART.pup(base, { coat: "#f4ece0", ears: "floppy" }).indexOf("#f4ece0") >= 0, "the coat colour reaches the drawing");
  const plain = ART.pup(base, { coat: "#d8a86b", ears: "floppy" });
  const patched = ART.pup(base, { coat: "#d8a86b", ears: "floppy", patch: "#4a4038" });
  const capped = ART.pup(base, { coat: "#d8a86b", ears: "floppy", cap: "#e23636" });
  assert.ok(patched.length > plain.length, "patches add ink");
  assert.ok(capped.length > plain.length, "a cap adds ink");
  // Backwards compatible: called with no spec it still draws a valid pup.
  const bare = ART.pup(base);
  assert.ok(bare.startsWith("<svg") && bare.endsWith("</svg>"), "a spec-less call still draws");
  // And the six SHIPPED pups must all render differently.
  const path = require("path");
  const C = require(path.join(__dirname, "..", "scripts/content.js"));
  const drawn = (C.PUPS || []).map((p) => ART.pup(p.collar, p.art));
  assert.equal(new Set(drawn).size, drawn.length, "every shipped pup renders as its own dog");
});

test("truck() tips its bed and carries a countable load (Dump Truck is the namesake)", () => {
  // It shipped as a 🚚 DELIVERY-van emoji glued to a flat orange div, while this
  // function had one caller in the whole repo and was never seen in a game. A
  // dump truck's entire appeal is the bed going up — an emoji cannot tip, cannot
  // be partly loaded, and is not even the right vehicle.
  const flat = ART.truck("#ffb703", { tip: 0, load: 0 });
  const tipped = ART.truck("#ffb703", { tip: 1, load: 0 });
  assert.notEqual(flat, tipped, "the bed actually tips");
  assert.match(flat, /rotate\(-?0(\.0)? /, "flat is an unrotated bed");
  assert.match(tipped, /rotate\(-30/, "fully tipped rotates the bed about the rear axle");
  // The load must be COUNTABLE — this is a counting game, so n rocks means n rocks.
  const rockCount = (s) => (s.match(/fill="#8d8b86"/g) || []).length;
  for (let n = 0; n <= 5; n++) {
    assert.equal(rockCount(ART.truck("#ffb703", { load: n })), n, `load ${n} draws ${n} rocks`);
  }
  assert.equal(rockCount(ART.truck("#ffb703", { load: 99 })), 5, "an out-of-range load clamps rather than overflowing the bed");
  assert.equal(rockCount(ART.truck("#ffb703", { load: -3 })), 0, "…in both directions");
  // Backwards compatible: the sticker book calls truck(colour) with no opts.
  const bare = ART.truck("#ffb703");
  assert.ok(bare.startsWith("<svg") && bare.endsWith("</svg>"), "an opts-less call still draws");
  assert.equal(rockCount(bare), 0, "…empty and level");
  assert.ok(ART.truck("#2b6cff").indexOf("#2b6cff") >= 0, "the body colour is still a parameter");
});
