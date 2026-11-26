// 🎨 Color Book — the engine and the pages, headless (PLAN_COLOR.md §5).
// Every law here reads the REAL pages, so a new page inherits all of them.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const L = require("../scripts/color-logic.js");
const D = require("../scripts/color-data.js");

const PAGES = D.PAGES;
const GEO = PAGES.map((p) => { const r = L.raster(p); return { r, labels: L.labels(p, r) }; });

test("a book of at least ten pages, each its own: id, name, spoken name, picture, level in order", () => {
  assert.ok(PAGES.length >= 10, "at least ten pages (the owner asked for ten or more)");
  for (const k of ["id", "name", "say", "icon", "cheer"]) {
    const vals = PAGES.map((p) => p[k]);
    assert.equal(new Set(vals).size, vals.length, "every page has its own " + k);
    for (const v of vals) assert.ok(typeof v === "string" && v.length, k + " is set");
  }
  PAGES.forEach((p, i) => assert.equal(p.level, i + 1, p.id + " is page " + (i + 1)));
  for (const p of PAGES) assert.ok(!/\p{Extended_Pictographic}/u.test(p.say + p.cheer), p.id + ": a spoken line never reads a picture");
});

test("every page's colors are numbered 1..k, every color is used, every number has a color", () => {
  for (const p of PAGES) {
    const ns = p.colors.map((c) => c.n);
    assert.deepEqual(ns, ns.map((_, i) => i + 1), p.id + ": colors numbered 1.." + ns.length + " with no gap");
    const used = new Set(p.regions.filter((r) => r.n).map((r) => r.n));
    for (const n of ns) assert.ok(used.has(n), p.id + ": color " + n + " paints at least one shape");
    for (const n of used) assert.ok(ns.includes(n), p.id + ": number " + n + " has a pot");
    for (const c of p.colors) assert.match(c.hex, /^#[0-9a-f]{6}$/i, p.id + ": " + c.name + " is a color");
    for (const r of p.regions) if (!r.n) assert.match(r.fill, /^#[0-9a-f]{6}$/i, p.id + ": a fixed shape has a color");
    assert.ok(p.colors.every((c) => c.name && !/\p{Extended_Pictographic}/u.test(c.name)), p.id + ": every color has a spoken name");
  }
});

test("the ladder: three colors first, more as the book goes on, never fewer than the page before, eight at the end", () => {
  // the first shelf is the ladder; every other shelf climbs on its own
  const ks = PAGES.filter((p) => p.shelf === "numbers").map((p) => p.colors.length);
  assert.equal(ks[0], 3, "page 1 has three colors");
  for (let i = 1; i < ks.length; i++) assert.ok(ks[i] >= ks[i - 1], "page " + (i + 1) + " has no fewer colors than page " + i + " (" + ks.join(",") + ")");
  assert.ok(ks[ks.length - 1] >= 8, "the last page has eight colors");
  const n = (p) => L.numbered(p).length;
  const ladder = PAGES.filter((p) => p.shelf === "numbers");
  assert.ok(n(ladder[0]) <= 10 && n(ladder[ladder.length - 1]) > n(ladder[0]), "the first page has few shapes, the last more");
  for (const sh of D.SHELVES) {
    const k = PAGES.filter((p) => p.shelf === sh.id).map((p) => p.colors.length);
    for (let i = 1; i < k.length; i++) assert.ok(k[i] >= k[i - 1], sh.id + ": no page has fewer colors than the one before it (" + k.join(",") + ")");
  }
});

test("THE SIZE LAW: every numbered shape is wide enough to hold its number on a 320px phone", () => {
  // r is the radius of the widest circle inside the shape's VISIBLE part (what
  // later shapes and ink lines leave of it), in units of the 200-unit page.
  let checked = 0;
  PAGES.forEach((p, k) => p.regions.forEach((reg, i) => {
    if (!reg.n) return;
    checked++;
    const lab = GEO[k].labels[i];
    assert.ok(lab.r >= L.needR(reg, p), `${p.id} shape #${i} (number ${reg.n}${reg.sum ? ", a sum" : reg.diff ? ", a take-away" : p.label ? ", " + p.label : ""}) is only ${lab.r.toFixed(1)} wide where its number goes; it needs ${L.needR(reg, p)}`);
  }));
  assert.ok(checked >= 120, "the law read every shape (" + checked + ")");
});

test("every number sits INSIDE its own shape (what a tap there hits is that shape)", () => {
  PAGES.forEach((p, k) => p.regions.forEach((reg, i) => {
    if (!reg.n) return;
    const lab = GEO[k].labels[i];
    assert.equal(L.ownerAt(GEO[k].r, lab.x, lab.y), i, `${p.id}: the number of shape #${i} sits on shape #${L.ownerAt(GEO[k].r, lab.x, lab.y)}`);
  }));
});

test("color by MATH on the last three pages of the ladder: a sum makes its number, only on a shape wide enough for it", () => {
  const ladder = PAGES.filter((p) => p.shelf === "numbers");
  const mathPages = ladder.filter((p) => p.math);
  assert.deepEqual(mathPages.map((p) => p.id), ladder.slice(-3).map((p) => p.id), "the ladder's last three pages are the math pages");
  for (const p of PAGES) {
    const sums = p.regions.filter((r) => r.sum);
    if (!(p.math && p.shelf === "numbers")) { assert.equal(sums.length, 0, p.id + ": sums only on the ladder's math pages"); continue; }
    assert.ok(sums.length >= 2, p.id + ": a math page has at least two sums");
    for (const r of sums) {
      assert.ok(r.sum.every((v) => Number.isInteger(v) && v >= 1), p.id + ": a sum adds two whole numbers he knows");
      assert.equal(r.sum[0] + r.sum[1], r.n, p.id + ": " + r.sum.join("+") + " must make " + r.n);
      assert.equal(L.labelText(r), r.sum[0] + "+" + r.sum[1]);
    }
  }
});

test("the pots: every color is distinct from every other on its page, and its number reads on it", () => {
  for (const p of PAGES) {
    for (let a = 0; a < p.colors.length; a++) for (let b = a + 1; b < p.colors.length; b++) {
      const x = L.hexRgb(p.colors[a].hex), y = L.hexRgb(p.colors[b].hex);
      const d = Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
      assert.ok(d >= 60, `${p.id}: ${p.colors[a].name} and ${p.colors[b].name} are too alike (${d.toFixed(0)})`);
    }
    for (const c of p.colors) {
      const ink = L.inkOn(c.hex);
      assert.ok(L.contrast(ink, c.hex) >= 3, `${p.id}: the number on the ${c.name} pot reads (${L.contrast(ink, c.hex).toFixed(2)}:1)`);
    }
    // an unpainted shape is white: no paint may be so pale it looks unpainted
    for (const c of p.colors) assert.ok(L.contrast(c.hex, "#ffffff") >= 1.08, `${p.id}: ${c.name} must not look like an unpainted shape`);
  }
  // the gray of an unpainted shape's number reads on white (AA)
  assert.ok(L.contrast("#5f6675", "#ffffff") >= 4.5);
});

test("the tap judge: a tap on a number paints it; never a shape of another color; never one already painted", () => {
  PAGES.forEach((p, k) => {
    const g = GEO[k];
    const done = new Set();
    for (const i of L.numbered(p)) {
      const lab = g.labels[i], n = p.regions[i].n;
      const v = L.judge(p, g.r, lab.x, lab.y, n, done);
      assert.deepEqual(v, { kind: "fill", i }, `${p.id}: a tap on the number of #${i} with pot ${n} paints #${i}`);
      // with another pot chosen, it never paints a shape of the wrong color
      const other = p.colors.find((c) => c.n !== n).n;
      const w = L.judge(p, g.r, lab.x, lab.y, other, done);
      if (w.kind === "fill") assert.equal(p.regions[w.i].n, other, `${p.id}: pot ${other} only ever paints ${other}s`);
      else assert.equal(w.kind, "wrong", `${p.id}: a tap well inside #${i} with pot ${other} is a wrong tap, not nothing`);
    }
    // a page completely painted: nothing is painted twice
    const all = new Set(L.numbered(p));
    for (const i of L.numbered(p)) { const lab = g.labels[i]; assert.notEqual(L.judge(p, g.r, lab.x, lab.y, p.regions[i].n, all).kind, "fill", p.id + ": a painted shape is never painted again"); }
  });
});

test("the tap judge is FORGIVING: a finger just beside a shape of the chosen color paints it", () => {
  // the rocket's window band (#…) and stripe: tap 8 units outside a shape's
  // edge, on the background, with that shape's color chosen
  let tried = 0;
  PAGES.forEach((p, k) => {
    const g = GEO[k];
    for (const i of L.numbered(p)) {
      if (i === 0) continue; // the background itself
      const reg = p.regions[i];
      const lab = g.labels[i];
      // walk right from the number until we leave the shape, then 6 units more
      let x = lab.x;
      while (x < L.W && L.ownerAt(g.r, x, lab.y) === i) x += 0.5;
      x += 6;
      if (x >= L.W) continue;
      tried++;
      const v = L.judge(p, g.r, x, lab.y, reg.n, new Set());
      assert.equal(v.kind, "fill", `${p.id}: a tap 6 units beside #${i} still paints a ${reg.n}`);
      assert.equal(p.regions[v.i].n, reg.n);
    }
  });
  assert.ok(tried >= 60, "tried " + tried);
});

test("a whole page painted in a child's order finishes, and the pots move on by themselves", () => {
  for (const p of PAGES) {
    const done = new Set();
    let sel = L.nextColor(p, done, p.colors[p.colors.length - 1].n);
    assert.equal(sel, 1, p.id + ": the first pot chosen is number 1");
    let guard = 0;
    while (!L.finished(p, done) && guard++ < 500) {
      const i = L.numbered(p).find((k) => !done.has(k) && p.regions[k].n === sel);
      if (i == null) { sel = L.nextColor(p, done, sel); continue; }
      done.add(i);
      if (L.remaining(p, done)[sel] === 0) sel = L.nextColor(p, done, sel);
    }
    assert.ok(L.finished(p, done), p.id + " is finished");
    assert.equal(L.nextColor(p, done, 1), null, p.id + ": no pot is left once it is done");
  }
});

test("what comes alive is on the page, and every animation it asks for exists (with a reduced-motion stop)", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "styles", "main.css"), "utf8");
  // EVERY reduced-motion block's contents (it read only the last one, which
  // stopped being the Color Book's the day another world's block followed it)
  let reduced = "";
  for (let i = css.indexOf("@media (prefers-reduced-motion: reduce)"); i >= 0; i = css.indexOf("@media (prefers-reduced-motion: reduce)", i + 1)) {
    let d = 0, j = css.indexOf("{", i);
    for (let k = j; k < css.length; k++) { if (css[k] === "{") d++; else if (css[k] === "}" && --d === 0) { reduced += css.slice(j, k + 1); break; } }
  }
  for (const p of PAGES) {
    assert.ok(p.alive && p.alive.length, p.id + " comes alive");
    for (const a of p.alive) {
      assert.ok(p.regions.some((r) => r.part === a.part), `${p.id}: the part "${a.part}" is drawn`);
      assert.ok(css.includes(".cb-anim--" + a.anim + " {"), `${p.id}: the "${a.anim}" animation exists`);
      assert.ok(reduced.includes(".cb-anim--" + a.anim), `${p.id}: "${a.anim}" stops under reduced motion`);
      if (a.origin) assert.ok(a.origin.every((v) => v >= 0 && v <= 200), p.id + ": its pivot is on the page");
    }
  }
});

test("pageSvg: one path per shape (in order), a number per unpainted numbered shape, no ids, thumbnails without hooks", () => {
  for (const p of PAGES) {
    const k = PAGES.indexOf(p);
    const svg = L.pageSvg(p, { labels: GEO[k].labels });
    assert.equal((svg.match(/data-i="/g) || []).length, p.regions.length, p.id + ": every shape is drawn and can be tapped");
    assert.equal((svg.match(/class="cb-label[" ]/g) || []).length, L.numbered(p).length, p.id + ": every numbered shape shows its number");
    assert.ok(!/\sid="/.test(svg), p.id + ": no ids (two copies of a page on one screen must not collide)");
    assert.equal((svg.match(/<svg/g) || []).length, 1);
    assert.equal((svg.match(/<g/g) || []).length, (svg.match(/<\/g>/g) || []).length, p.id + ": groups balance");
    const fills = {}; L.numbered(p).forEach((i) => { fills[i] = "#123456"; });
    const painted = L.pageSvg(p, { fills, labels: GEO[k].labels });
    assert.equal((painted.match(/class="cb-label[" ]/g) || []).length, 0, p.id + ": a painted shape loses its number");
    const thumb = L.pageSvg(p, { fills, thumb: true });
    assert.ok(!/data-i=/.test(thumb), p.id + ": a thumbnail carries no tap hooks");
    // shading only ever references the shared, document-wide light
    const shaded = L.pageSvg(p, { fills, shade: true });
    for (const m of shaded.matchAll(/url\(#([^)]+)\)/g)) assert.equal(m[1], "jart-lit", p.id + ": the light is the one index.html declares");
    if (!p.mosaic) assert.ok(/url\(#jart-lit\) none/.test(shaded), p.id + ": with a fallback if it is missing");
  }
});

test("geometry helpers: a square raster, a clipped line, a sampled path", () => {
  const sq = { regions: [{ pts: L.rect(50, 50, 100, 100), n: 1 }], ink: [] };
  const lab = L.labels(sq)[0];
  assert.ok(Math.abs(lab.x - 100) <= 1 && Math.abs(lab.y - 100) <= 1, "a square's number is at its middle");
  assert.ok(Math.abs(lab.r - 50) <= 1, "and it is 50 wide there");
  assert.ok(Math.abs(lab.area - 10000) <= 200, "its area is 100x100");
  const seg = L.clipLine([0, 100], [200, 100], L.rect(50, 50, 100, 100));
  assert.ok(Math.abs(seg[0][0] - 50) < 1e-6 && Math.abs(seg[1][0] - 150) < 1e-6, "a line through a square is clipped to it");
  assert.equal(L.clipLine([0, 10], [200, 10], L.rect(50, 50, 100, 100)), null, "a line that misses is gone");
  const p = L.path("M0 0 L10 0 L10 10 Z");
  assert.deepEqual(p, [[0, 0], [10, 0], [10, 10]]);
  assert.equal(L.path("M0 0 C10 0 10 10 0 10 Z").length, 13, "a curve is sampled");
});

// ---- The upgrade (compared with the color-by-number apps): magic crayons, a
// sound for each page, his Chinese, and no clue on a pick.

test("choosing a color gives no clue: nothing marks the shapes waiting for it, and a number reads on the white page", () => {
  // The owner (2026-11-25): lighting the shapes waiting for a color the second
  // he picks it was far too easy — finding the numbers IS the game. Nothing in
  // the page's code may tint or mark them on a pick; only the long-quiet hint
  // (one ring, color-main.js hint()) ever shows one.
  const main = fs.readFileSync(path.join(__dirname, "..", "scripts", "color-main.js"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "..", "styles", "main.css"), "utf8");
  assert.ok(!/cb-want|markWanted|wantTint/.test(main + css), "no shimmer on the waiting shapes");
  const pick = main.slice(main.indexOf("function pickColor("), main.indexOf("\n  }\n", main.indexOf("function pickColor(")));
  assert.ok(pick.length > 50, "pickColor exists");
  assert.ok(!/classList\.(add|toggle)\([^)]*cb-/.test(pick) && !/cb-find/.test(pick.replace(/clearHint\(\)/g, "")), "a pick adds no mark to a shape");
  const label = "#5f6675"; // .cb-label in main.css
  assert.match(css, /\.cb-label \{[^}]*fill: #5f6675/, "the label color measured here is the one main.css paints");
  assert.ok(L.contrast(label, "#ffffff") >= 4.5, "on the white page the number is AA");
});

test("paint: a color, or a color with magic; only the four magic crayons are paint", () => {
  assert.deepEqual(L.FX, ["rainbow", "glitter", "stripes", "dots"]);
  for (const ok of ["#a1b2c3", "#A1B2C3 rainbow", "#000000 glitter", "#ffffff stripes", "#123456 dots"]) assert.ok(L.isPaint(ok), ok);
  for (const no of ["#abc", "red", "#a1b2c3 zap", "#a1b2c3  dots", " #a1b2c3", "#a1b2c3 dots extra", null, 7, "url(#x)"]) assert.ok(!L.isPaint(no), String(no));
  assert.deepEqual(L.paintOf("#112233 dots"), { hex: "#112233", fx: "dots" });
  assert.deepEqual(L.paintOf("#112233"), { hex: "#112233", fx: null });
  // rainbow replaces the color, with the color as the fallback paint
  assert.equal(L.paintFill("#112233 rainbow"), "url(#cb-fx-rainbow) #112233");
  assert.equal(L.paintFill("#112233 glitter"), "#112233", "glitter lies OVER the color");
  assert.equal(L.paintOver("#112233"), "", "a plain color has nothing over it");
  assert.match(L.paintOver("#112233 dots", "M0 0Z"), /class="cb-fx" d="M0 0Z" fill="url\(#cb-fx-dots\) none" pointer-events="none"/);
  // pageSvg puts the magic right after its shape, and still declares no ids
  const p = PAGES[0], i = L.numbered(p)[0];
  const svg = L.pageSvg(p, { fills: { [i]: "#7950f2 stripes" } });
  assert.ok(!/ id=/.test(svg), "a page declares no ids (the patterns are index.html's)");
  const at = svg.indexOf('data-i="' + i + '"');
  const over = svg.indexOf('class="cb-fx"');
  assert.ok(at > 0 && over > at && svg.lastIndexOf("<path", over - 1) > at - 200, "the stripes lie right over their shape");
  const rb = L.pageSvg(p, { fills: { [i]: "#7950f2 rainbow" }, thumb: true });
  assert.match(rb, /fill="url\(#cb-fx-rainbow\) #7950f2"/, "a rainbow thumbnail asks for the shared gradient");
});

test("every magic crayon's gradient or pattern is declared ONCE in index.html (ids resolve document-wide)", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "");
  for (const fx of L.FX) {
    const n = (html.match(new RegExp('id="cb-fx-' + fx + '"', "g")) || []).length;
    assert.equal(n, 1, "cb-fx-" + fx + " is declared once (saw " + n + ")");
  }
  // and the crayon box offers exactly these, magic first
  assert.deepEqual(D.MAGIC.map((m) => m.fx), L.FX, "one magic crayon per magic paint");
  for (const m of D.MAGIC) assert.ok(m.label && m.say && !/\p{Extended_Pictographic}/u.test(m.say), m.fx + " is named and said in words");
});

test("every page has a sound when it comes alive, and every sound is one the player knows", () => {
  const main = fs.readFileSync(path.join(__dirname, "..", "scripts", "color-main.js"), "utf8");
  const sfx = main.slice(main.indexOf("const SFX = {"), main.indexOf("function pageSound"));
  assert.ok(sfx.length > 200, "the SFX table must be found");
  const known = [...sfx.matchAll(/^\s+([a-z]+): \{ notes:/gm)].map((m) => m[1]);
  assert.ok(known.length >= 8, "the player knows its sounds (saw " + known.join(", ") + ")");
  for (const p of PAGES) assert.ok(known.includes(p.sound), p.id + " sounds like '" + p.sound + "', which the player does not know");
  // and the page's sound plays through the mute-gated tone() only
  const ps = main.slice(main.indexOf("function pageSound"), main.indexOf("function comeAlive"));
  assert.ok(/\btone\(/.test(ps) && !/JoshAudio/.test(ps), "pageSound plays through tone(), which the mute silences");
});

test("his Chinese: a finished color is said in English, then in Chinese — each name restated, none missing", () => {
  // Restated truth (an everyday word for each color a page uses).
  const TRUTH = {
    red: "红色", orange: "橙色", yellow: "黄色", green: "绿色", blue: "蓝色", purple: "紫色",
    pink: "粉色", brown: "棕色", black: "黑色", white: "白色", gray: "灰色", silver: "银色",
    "sky blue": "天蓝色", "light blue": "浅蓝色", "dark blue": "深蓝色", "dark green": "深绿色", "light green": "浅绿色",
  };
  assert.deepEqual(D.COLOR_ZH, TRUTH);
  // colors with no plain everyday Chinese word a four-year-old would hear stay English
  const ENGLISH_ONLY = ["cream", "tan", "teal", "mint"];
  const used = new Set(PAGES.flatMap((p) => p.colors.map((c) => c.name)));
  for (const name of used) assert.ok(D.COLOR_ZH[name] || ENGLISH_ONLY.includes(name), "the color '" + name + "' has no Chinese and is not declared English-only");
  for (const e of ENGLISH_ONLY) assert.ok(used.has(e), "'" + e + "' is declared English-only but no page uses it (a dead carve-out)");
  for (const zh of Object.values(D.COLOR_ZH)) assert.match(zh, /^\p{Script=Han}+$/u);
  const main = fs.readFileSync(path.join(__dirname, "..", "scripts", "color-main.js"), "utf8");
  assert.match(main, /lang: "zh-CN"/, "the Chinese is said in a Chinese voice");
});

// ---- The other shelves (the owner, 2026-11-25: "all six"): count the dots,
// 一 二 三, take away, mystery pictures, big pictures, and draw your own.

test("the book's shelves: every page on exactly one, in shelf order, at least three to a shelf", () => {
  const ids = D.SHELVES.map((s) => s.id);
  assert.deepEqual(ids, ["numbers", "dots", "zh", "minus", "mystery", "big"]);
  for (const sh of D.SHELVES) {
    assert.ok(sh.title && sh.icon && sh.say, sh.id + " is named");
    assert.ok(PAGES.filter((p) => p.shelf === sh.id).length >= 3, sh.id + " holds at least three pages");
  }
  const order = PAGES.map((p) => ids.indexOf(p.shelf));
  assert.ok(order.every((k) => k >= 0), "every page is on a shelf");
  for (let i = 1; i < order.length; i++) assert.ok(order[i] >= order[i - 1], "the pages run shelf by shelf");
  assert.ok(PAGES.length >= 27, "the book has its new pages (" + PAGES.length + ")");
});

test("🎲 count the dots: each shape shows a die's dots for its number — every dot inside its shape, none touching", () => {
  assert.deepEqual(Object.keys(L.DIE).map(Number), [1, 2, 3, 4, 5, 6]);
  for (const n of [1, 2, 3, 4, 5, 6]) assert.equal(L.DIE[n].length, n, "the die shows " + n + " dots for " + n);
  const dots = PAGES.filter((p) => p.label === "dots");
  assert.ok(dots.length >= 3);
  for (const p of dots) {
    const k = PAGES.indexOf(p), g = GEO[k];
    assert.ok(p.colors.length <= 6, p.id + ": a die counts to six at most");
    const svg = L.pageSvg(p, { labels: g.labels });
    for (const i of L.numbered(p)) {
      const reg = p.regions[i], ds = L.dotsAt(reg.n, g.labels[i]);
      assert.equal(ds.length, reg.n, p.id + " #" + i + ": " + reg.n + " dots");
      for (const [x, y, r] of ds) {
        for (let a = 0; a < 8; a++) {
          const t = (a * Math.PI) / 4;
          assert.equal(L.ownerAt(g.r, x + Math.cos(t) * (r + 1.2), y + Math.sin(t) * (r + 1.2)), i, `${p.id} #${i}: a dot runs off its shape`);
        }
      }
      for (let a = 0; a < ds.length; a++) for (let b = a + 1; b < ds.length; b++) {
        const d = Math.hypot(ds[a][0] - ds[b][0], ds[a][1] - ds[b][1]);
        assert.ok(d >= ds[a][2] * 2 + 1.5, `${p.id} #${i}: two dots touch (${d.toFixed(1)})`);
      }
      assert.ok(ds[0][2] * 2 >= 3.6, p.id + ": a dot is a dot, not a speck");
    }
    assert.equal((svg.match(/<circle /g) || []).length, L.numbered(p).reduce((t, i) => t + p.regions[i].n, 0), p.id + ": the page draws exactly the dots it should");
    assert.ok(!/<text class="cb-label/.test(svg), p.id + ": no digits on a dots page");
  }
});

test("🏮 一 二 三: a Chinese page writes every number in Chinese, in a Chinese face, restated here", () => {
  assert.deepEqual(L.ZH_NUM, ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]);
  const zh = PAGES.filter((p) => p.label === "zh");
  assert.ok(zh.length >= 3);
  for (const p of zh) {
    assert.ok(p.colors.length <= 10);
    const svg = L.pageSvg(p, { labels: GEO[PAGES.indexOf(p)].labels });
    for (const i of L.numbered(p)) assert.equal(L.labelText(p.regions[i], p), L.ZH_NUM[p.regions[i].n]);
    assert.equal((svg.match(/class="cb-label cb-label--zh" lang="zh-CN"/g) || []).length, L.numbered(p).length, p.id + ": every number is marked Chinese");
    assert.ok(!/>\d+</.test(svg), p.id + ": no digit is written on a Chinese page");
    if (p.cheerZh) assert.match(p.cheerZh, /^\p{Script=Han}+$/u, p.id + ": the Chinese cheer is Chinese only (an English voice never reads it)");
    assert.ok(!/\p{Script=Han}/u.test(p.cheer + p.say), p.id + ": the English lines carry no Chinese");
  }
  const css = fs.readFileSync(path.join(__dirname, "..", "styles", "main.css"), "utf8");
  assert.match(css, /\.cb-label--zh \{ font-family: "PingFang SC"/, "the numerals ask for a Simplified Chinese face by name, first");
});

test("➖ take away: every take-away makes its number, inside ten, written with a real minus sign", () => {
  assert.equal(L.MINUS, "−");
  const minus = PAGES.filter((p) => p.shelf === "minus");
  assert.ok(minus.length >= 3);
  for (const p of PAGES) {
    const diffs = p.regions.filter((r) => r.diff);
    if (p.shelf !== "minus") { assert.equal(diffs.length, 0, p.id + ": take-aways only on the take-away shelf"); continue; }
    assert.ok(diffs.length >= 3, p.id + ": a take-away page has at least three take-aways");
    for (const r of diffs) {
      const [a, b] = r.diff;
      assert.ok(Number.isInteger(a) && Number.isInteger(b) && b >= 1 && a <= 10 && a > b, p.id + ": " + a + "-" + b + " is a take-away inside ten");
      assert.equal(a - b, r.n, p.id + ": " + a + "-" + b + " must leave " + r.n);
      assert.equal(L.labelText(r, p), a + "−" + b);
    }
  }
});

test("❓ mystery pictures: a grid of squares; painted squares take their own color as an outline, so the finished picture is seamless", () => {
  const ms = PAGES.filter((p) => p.mystery);
  assert.ok(ms.length >= 3 && ms.every((p) => p.shelf === "mystery" && p.mosaic));
  // the builder: a run along a row is one shape; a run under the same run joins it
  const m = L.mosaic(["aab", "aab", "ccc"], { a: 1, b: 2, c: "#123456" });
  assert.deepEqual(m.map((r) => r.n || r.fill), [1, 2, "#123456"], "three shapes, not nine squares");
  assert.throws(() => L.mosaic(["ax"], { a: 1 }), /no key/);
  for (const p of ms) {
    const k = PAGES.indexOf(p), all = {};
    for (const reg of p.regions) {
      const xs = reg.pts.map((q) => q[0]), ys = reg.pts.map((q) => q[1]);
      assert.equal(reg.pts.length, 4, p.id + ": every shape is a rectangle of squares");
      for (const v of xs.concat(ys)) assert.ok(Math.abs(v / 20 - Math.round(v / 20)) < 1e-9, p.id + ": on the 10x10 grid");
    }
    L.numbered(p).forEach((i) => { all[i] = p.colors.find((c) => c.n === p.regions[i].n).hex; });
    const done = L.pageSvg(p, { fills: all, shade: true });
    assert.ok(!/stroke="#232634"/.test(done), p.id + ": a finished mystery picture has no grid lines");
    assert.ok(!/jart-lit/.test(done), p.id + ": and is not shaded square by square");
    const fresh = L.pageSvg(p, { labels: GEO[k].labels });
    assert.equal((fresh.match(/stroke="#232634"/g) || []).length, p.regions.length, p.id + ": a fresh one shows the whole grid");
    assert.ok(L.numbered(p).length >= 15, p.id + ": enough squares to be a mystery (" + L.numbered(p).length + ")");
  }
});

test("🌟 big pictures: nine colors and at least twenty shapes each, more than any page of the ladder but its math pages", () => {
  const big = PAGES.filter((p) => p.shelf === "big");
  assert.ok(big.length >= 3);
  const ladderMax = Math.max(...PAGES.filter((p) => p.shelf === "numbers").map((p) => p.colors.length));
  for (const p of big) {
    assert.ok(p.colors.length === 9 && p.colors.length > ladderMax, p.id + ": nine colors (the ladder tops out at " + ladderMax + ")");
    assert.ok(L.numbered(p).length >= 20, p.id + ": at least twenty shapes (" + L.numbered(p).length + ")");
  }
});
