// Smoke + structure tests for Josh's Games. No dependencies — runs with
// `node --test`. Guards against regressions: missing files/refs, malformed
// content, missing cache-bust tokens, lost mobile/kid guardrails, JS syntax.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const content = require("../scripts/content.js");

test("core files exist", () => {
  for (const f of [
    "index.html", "styles/main.css", "sw.js", "manifest.webmanifest",
    "scripts/main.js", "scripts/content.js", "scripts/effects.js",
  ]) {
    assert.ok(fs.existsSync(path.join(root, f)), `missing ${f}`);
  }
});

test("index links styles, content, effects, and main — all cache-busted", () => {
  const html = read("index.html");
  assert.match(html, /styles\/main\.css\?v=/, "css not cache-busted");
  assert.match(html, /scripts\/content\.js\?v=/, "content.js not cache-busted");
  assert.match(html, /scripts\/effects\.js\?v=/, "effects.js not cache-busted");
  assert.match(html, /scripts\/main\.js\?v=/, "main.js not cache-busted");
  assert.match(html, /manifest\.webmanifest\?v=/, "manifest not cache-busted");
});

test("index has the required UI hooks", () => {
  const html = read("index.html");
  for (const id of [
    'id="sound-toggle"', 'id="animal-card"', 'id="animal-emoji"',
    'id="animal-name"', 'id="animal-cheer"', 'id="friend-count"', 'id="toy-h"',
  ]) {
    assert.ok(html.includes(id), `missing element ${id}`);
  }
});

test("feature inits are isolated so one failure can't break the others", () => {
  const js = read("scripts/main.js");
  assert.match(js, /try\s*\{\s*init\(\)/, "inits should run inside try/catch");
});

test("shared effects module exists, is loaded, and is precached", () => {
  const fx = read("scripts/effects.js");
  assert.match(fx, /JoshEffects/);
  assert.match(fx, /confetti/);
  assert.match(fx, /stars/);
  assert.match(read("index.html"), /scripts\/effects\.js\?v=/, "index should load effects.js");
  assert.match(read("sw.js"), /effects\.js/, "SW should precache effects.js");
});

// ---------- Content module ----------
test("animals are well-formed (unique emoji + a name)", () => {
  assert.ok(Array.isArray(content.ANIMALS) && content.ANIMALS.length >= 8,
    `expected >= 8 animals, got ${content.ANIMALS && content.ANIMALS.length}`);
  const emojis = new Set();
  for (const a of content.ANIMALS) {
    assert.ok(a && typeof a.emoji === "string" && a.emoji.length > 0, "animal missing emoji");
    assert.ok(a && typeof a.name === "string" && a.name.length > 0, "animal missing name");
    emojis.add(a.emoji);
  }
  // Unique emoji matters: a fresh tap must always LOOK different.
  assert.equal(emojis.size, content.ANIMALS.length, "animal emojis must be unique");
});

test("cheers, confetti colors, and the title are present", () => {
  assert.ok(Array.isArray(content.CHEERS) && content.CHEERS.length >= 4,
    "need at least a few cheers");
  for (const c of content.CHEERS) assert.ok(typeof c === "string" && c.length > 0, "empty cheer");
  assert.ok(Array.isArray(content.CONFETTI_COLORS) && content.CONFETTI_COLORS.length >= 4,
    "need at least 4 confetti colors");
  for (const col of content.CONFETTI_COLORS) {
    assert.match(col, /^#[0-9a-fA-F]{3,8}$/, `bad color ${col}`);
  }
  assert.ok(typeof content.TITLE === "string" && content.TITLE.length > 0, "TITLE missing");
});

// ---------- Behavior wiring (main.js) ----------
test("main.js wires the features and persistence keys", () => {
  const js = read("scripts/main.js");
  for (const sym of [
    "initSound", "initAnimalToy", "pickIndex",
    "josh-friends", "josh-muted",
    "serviceWorker.register", "JoshEffects", "confetti",
  ]) {
    assert.ok(js.includes(sym), `main.js missing ${sym}`);
  }
  assert.match(js, /Math\.random\(\)/, "selection should be randomized");
});

test("no game timers — a 4-year-old plays at their own pace", () => {
  const js = read("scripts/main.js");
  assert.ok(!/setInterval\(/.test(js), "no countdown/interval timers in the toys");
});

test("celebrations are not bound to global scroll or document gestures", () => {
  const js = read("scripts/main.js");
  assert.ok(!/addEventListener\(\s*["']scroll["']/.test(js),
    "nothing should react to scrolling");
  assert.ok(!/document\.addEventListener\(\s*["'](touchmove|touchstart|click)["']/.test(js),
    "no document-level tap/scroll celebrations");
});

// ---------- Mobile / kid guardrails ----------
test("background is a static gradient (no animated full-page background)", () => {
  const css = read("styles/main.css");
  assert.match(css, /linear-gradient\(/, "should have a gradient background");
  const keyframes = (css.match(/@keyframes\s+([A-Za-z0-9_-]+)/g) || [])
    .map((s) => s.split(/\s+/)[1]);
  assert.deepEqual(keyframes, ["pop"],
    `only the small "pop" animation is allowed (no animated background); found: ${keyframes.join(", ")}`);
});

test("mobile / iOS Safari optimizations are in place", () => {
  const html = read("index.html");
  assert.match(html, /name="viewport"[^>]*viewport-fit=cover/, "viewport-fit=cover missing");
  assert.match(html, /apple-mobile-web-app-capable/, "iOS web-app meta missing");

  const css = read("styles/main.css");
  // Strip comments so a "100vh" mentioned in documentation doesn't trip the
  // check — we only care about the actual declared values.
  const cssValues = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(cssValues, /100dvh/, "use dvh to avoid the iOS 100vh toolbar gap");
  assert.ok(!cssValues.includes("100vh"), "use 100dvh, never bare 100vh");
  assert.match(css, /env\(safe-area-inset/, "respect the notch with safe-area insets");
  assert.match(css, /-webkit-backdrop-filter/, "Safari needs -webkit-backdrop-filter");
  assert.match(css, /touch-action:\s*manipulation/, "prevent double-tap zoom on tappables");
  assert.match(css, /-webkit-tap-highlight-color/, "remove the iOS tap highlight");
});

test("tap targets are sized for little fingers (>= 75px)", () => {
  const css = read("styles/main.css");
  const m = css.match(/--tap:\s*(\d+)px/);
  assert.ok(m && Number(m[1]) >= 75, `--tap should be >= 75px, got ${m && m[1]}`);
  assert.match(css, /min-height:\s*var\(--tap\)/, "tappables should enforce the min tap height");
});

test("PWA: manifest, icons, and service worker are wired up", () => {
  const html = read("index.html");
  assert.match(html, /rel="manifest"/, "manifest link missing");
  assert.match(html, /rel="apple-touch-icon"/, "apple-touch-icon link missing");

  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.display, "standalone", "manifest should be standalone");
  assert.ok(manifest.start_url, "manifest needs start_url");
  const sizes = (manifest.icons || []).map((i) => i.sizes);
  assert.ok(sizes.includes("192x192") && sizes.includes("512x512"), "need 192 & 512 icons");
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(root, icon.src)), `missing icon file ${icon.src}`);
  }

  const sw = read("sw.js");
  assert.match(sw, /addEventListener\(\s*["']fetch["']/, "SW needs a fetch handler");
  assert.match(sw, /addEventListener\(\s*["']install["']/, "SW needs an install handler");
  assert.match(read("scripts/main.js"), /serviceWorker\.register/, "main.js should register the SW");
});

// ---------- Pure logic ----------
test("pickIndex never repeats and can reach every item", () => {
  // Mirror of the picker in main.js.
  function pickIndex(len, current) {
    if (len <= 1) return 0;
    let next = current;
    while (next === current) next = Math.floor(Math.random() * len);
    return next;
  }
  const len = content.ANIMALS.length;
  const seen = new Set();
  let cur = -1, repeats = 0;
  for (let i = 0; i < 5000; i++) {
    const n = pickIndex(len, cur);
    if (n === cur) repeats++;
    seen.add(n);
    cur = n;
  }
  assert.equal(repeats, 0, "should never return the same index twice in a row");
  assert.equal(seen.size, len, "should be able to reach every animal");
});

// ---------- Syntax ----------
test("scripts are valid JavaScript", () => {
  for (const f of ["scripts/content.js", "scripts/effects.js", "scripts/main.js"]) {
    execFileSync(process.execPath, ["--check", path.join(root, f)]);
  }
});
